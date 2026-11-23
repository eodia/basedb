//! `basedb-server` : le serveur de basedb. Il migre le catalogue au démarrage
//! (`BASEDB_MIGRATE=1`, ou refuse de démarrer sur un catalogue en retard), amorce le premier
//! administrateur (`BASEDB_BOOTSTRAP=1`), assemble les routes du socle et des domaines, sert
//! `/mcp` et l'interface exportée (`BASEDB_WEB_DIR`), et lance les tâches de fond.
//! Seul sur son port, il fait aussi ce que faisait le routeur de l'image (`front`) : adresse du
//! visiteur, compression, insights sous `/insights` (`BASEDB_INSIGHTS=1`).
//!
//! `basedb-server healthcheck` est la sonde du conteneur ; `basedb-server create-database
//! <url> <url-admin>` crée une base absente (celle d'insights, dans l'image qui le porte).

use basedb_server::{front, socle};

use axum::serve::ListenerExt;
use axum::Router;
use basedb_base::{app, config, migrate, AppState, Shared};

/// Every domain's native routes. Two crates declaring the same method on the same path make
/// this panic at start (and in the test below).
fn routes(st: &Shared) -> Router<Shared> {
    // A rich long text's default is sanitized as the records crate sanitizes the value.
    basedb_catalog::field_config::set_rich_text_sanitizer(basedb_records::html::sanitize_rich_text);
    // A row synchronization drains the change feed into the history first (`drainHistory`).
    basedb_catalog::env_rows::set_history_drainer(|pools| {
        Box::pin(async move {
            let _ = basedb_records::drain::drain_history(&pools).await;
        })
    });
    // A template's sample rows are written as the records crate writes any row.
    basedb_catalog::template_apply::set_template_row_writers(basedb_catalog::template_apply::RowWriters {
        create: |pools, ctx, table, rows| Box::pin(async move { basedb_records::write::create_records(&pools, &ctx, &table, rows).await.map(|b| b.ids) }),
        update: |pools, ctx, table, id, values| Box::pin(async move { basedb_records::write::update_record(&pools, &ctx, &table, &id, values).await.map(|_| ()) }),
    });
    Router::new()
        .merge(basedb_catalog::router(st))
        .merge(basedb_records::router(st))
        .merge(basedb_admin::router(st))
        .merge(basedb_automations::router(st))
        .merge(basedb_ai::router(st))
}

/// The API and the MCP entry point on one port. `/mcp` stays outside `app::build`: no CORS,
/// no demo guard, a request id of its own — as the Node MCP process answered.
fn serve_all(st: &Shared) -> Router {
    basedb_mcp::router(st).with_state(st.clone()).merge(app::build(st.clone(), routes(st)))
}

fn fail(message: String) -> ! {
    eprintln!("{message}");
    std::process::exit(1)
}

/// The catalog brought to the shipped version (`BASEDB_MIGRATE=1`), or checked.
async fn catalog(st: &AppState) {
    let shipped = migrate::shipped_migrations(st.cfg.migrations_dir.as_deref()).unwrap_or_else(|e| fail(e));
    let url = &st.cfg.database_url;
    if st.cfg.migrate {
        let applied = migrate::migrate_catalog(url, migrate::APPLICATION_VERSION, &shipped).await.unwrap_or_else(|e| fail(migrate::refusal(&e)));
        let state = migrate::inspect_catalog(url, &shipped).await.unwrap_or_else(|e| fail(migrate::refusal(&e)));
        if applied.is_empty() {
            println!("Catalogue à jour (version {}).", state.applied);
        } else {
            println!("Catalogue mis à jour : version {}.", state.applied);
        }
        socle::after_migration(st).await.unwrap_or_else(|e| fail(format!("Démarrage refusé : {} {:?}", e.code, e.details)));
    } else {
        let state = migrate::inspect_catalog(url, &shipped).await.unwrap_or_else(|e| fail(migrate::refusal(&e)));
        if !state.pending.is_empty() {
            fail(format!(
                "Le catalogue est en version {}, ce code attend la version {} ({}) : démarrez une fois avec BASEDB_MIGRATE=1.",
                state.applied,
                state.shipped,
                state.pending.join(", ")
            ));
        }
    }
}

/// The interface's static export (`BASEDB_WEB_DIR`, `apps/web/out-static` once built), served
/// beside the API — unset, none: the interface is Next's (crates/web).
fn interface(cfg: &config::Config) -> Option<std::sync::Arc<basedb_web::Site>> {
    let dir = cfg.setting("BASEDB_WEB_DIR")?;
    let runtime = basedb_web::Runtime::from_settings(&cfg.base_path, |k| cfg.setting(k));
    let site = basedb_web::Site::load(std::path::Path::new(&dir), &cfg.base_path, &runtime).unwrap_or_else(|e| fail(e));
    println!("Interface servie depuis {dir} ({} fichiers, chemin « {} »).", site.len(), cfg.base_path);
    Some(std::sync::Arc::new(site))
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some("healthcheck") => socle::healthcheck(),
        Some("create-database") => {
            let (Some(url), Some(admin)) = (args.get(1), args.get(2)) else { fail("basedb-server create-database <url> <url-admin>".into()) };
            match socle::create_database(url, admin).await {
                Ok(true) => println!("Base créée."),
                Ok(false) => {}
                Err(e) => fail(format!("Base injoignable ou non créée : {e}")),
            }
            return;
        }
        _ => {}
    }
    let cfg = config::load().unwrap_or_else(|e| fail(e));
    let st = AppState::new(cfg).unwrap_or_else(|e| fail(e));
    catalog(&st).await;
    if let Some(email) = socle::bootstrap(&st).await.unwrap_or_else(|e| fail(e)) {
        let _ = st.development_email.set(email);
    }
    basedb_admin::oidc::announce(&st.cfg);
    let _partitions = socle::start_partitions(&st);
    let _background = basedb_admin::start_background(&st);
    let _records = basedb_records::start_background(&st);
    let _ai = basedb_ai::start_background(&st);
    let _automations = basedb_automations::start_background(&st);

    let router = serve_all(&st);
    let router = match interface(&st.cfg) {
        Some(site) => basedb_web::wrap(router, site),
        None => router,
    };
    let insights = front::Insights::from_config(&st.cfg).map(std::sync::Arc::new);
    if let Some(i) = &insights {
        println!("insights servi sous {}, depuis {}.", i.at(), i.host());
    }
    let router = front::wrap(router, insights);
    let listener = tokio::net::TcpListener::bind((st.cfg.host.as_str(), st.cfg.port))
        .await
        .unwrap_or_else(|e| fail(format!("Impossible d'écouter sur {}:{} : {e}", st.cfg.host, st.cfg.port)))
        .tap_io(|tcp| {
            let _ = tcp.set_nodelay(true);
        });
    // The MCP entry point on a port of its own too, as the Node process was (`BASEDB_MCP_PORT`).
    if let Some(port) = st.cfg.setting("BASEDB_MCP_PORT").and_then(|p| p.trim().parse::<u16>().ok()) {
        let mcp = tokio::net::TcpListener::bind((st.cfg.host.as_str(), port))
            .await
            .unwrap_or_else(|e| fail(format!("Impossible d'écouter sur {}:{port} : {e}", st.cfg.host)));
        println!("Serveur MCP sur http://{}:{port}/mcp", st.cfg.host);
        let app = basedb_mcp::standalone(&st);
        tokio::spawn(async move {
            if let Err(e) = axum::serve(mcp, app).await {
                eprintln!("Serveur MCP arrêté : {e}");
            }
        });
    }
    println!("basedb-server {} écoute sur http://{}:{}", migrate::APPLICATION_VERSION, st.cfg.host, st.cfg.port);
    axum::serve(listener, router.into_make_service_with_connect_info::<std::net::SocketAddr>())
        .with_graceful_shutdown(socle::stop_signal())
        .await
        .unwrap_or_else(|e| fail(format!("Serveur arrêté : {e}")));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn domains_merge_without_conflict() {
        let st = AppState::new(basedb_base::config::Config::for_tests()).unwrap();
        let _ = serve_all(&st);
    }
}
