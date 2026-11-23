//! Catalog migrations — chapter 02, « Amorçage ».
//!
//! The promise to whoever installed basedb: whatever version they run, starting a newer
//! one brings their catalog to exactly what a fresh installation of it has, their data
//! kept — and nothing starts on a catalog whose history the code cannot vouch for.
//!
//! Every published version is rebuilt here from `migrations/sealed.json`, upgraded, and
//! compared with a fresh catalog object by object: a migration that upgrades differently
//! from how it installs fails here, not at a customer's.
//!
//! Each test works in databases of its own (`c_mig_…`), created on the development
//! PostgreSQL (docker compose, :55432) and dropped at the end; it returns early, without
//! failing, when that server is not reachable.

use axum::http::StatusCode;
use basedb_base::auth::open_context;
use basedb_base::migrate::{checksum_of, embedded_migrations, inspect_catalog, migrate_catalog, migrate_catalog_waiting, sealed, CatalogMigration, APPLICATION_VERSION};
use basedb_base::testing::{test_config, Caller, TestApp};
use basedb_base::tx::Surface;
use basedb_base::{AppError, AppState};
use serde_json::{json, Value};
use std::time::Duration;
use tokio_postgres::{Client, NoTls};

const PASSWORD: &str = "des tables bien rangees";

/// The development server, through its `postgres` database.
async fn server() -> Option<String> {
    let url = test_config().ok()?.database_url;
    let connected = tokio::time::timeout(Duration::from_secs(3), tokio_postgres::connect(&url, NoTls)).await;
    if !matches!(connected, Ok(Ok(_))) {
        eprintln!("base de développement injoignable : test ignoré");
        return None;
    }
    Some(url)
}

async fn client(uri: &str) -> Client {
    let (client, connection) = tokio_postgres::connect(uri, NoTls).await.expect("connexion");
    tokio::spawn(async move {
        let _ = connection.await;
    });
    client
}

/// The databases a test made, dropped by [`Databases::drop_all`].
struct Databases {
    server: String,
    names: Vec<String>,
}

impl Databases {
    fn new(server: String) -> Self {
        Databases { server, names: vec![] }
    }

    /// A new, empty database of the server, by its connection string.
    async fn create(&mut self) -> String {
        let name = format!("c_mig_{}", &uuid::Uuid::new_v4().simple().to_string()[..12]);
        client(&self.server).await.batch_execute(&format!("CREATE DATABASE {name}")).await.expect("CREATE DATABASE");
        self.names.push(name.clone());
        with_database(&self.server, &name)
    }

    async fn drop_all(self) {
        let admin = client(&self.server).await;
        for name in self.names {
            let _ = admin.batch_execute(&format!("DROP DATABASE IF EXISTS {name} WITH (FORCE)")).await;
        }
    }
}

/// `uri` pointing at the database `name`.
fn with_database(uri: &str, name: &str) -> String {
    let (scheme, rest) = uri.split_once("://").expect("URL PostgreSQL");
    let (authority, tail) = rest.split_once('/').unwrap_or((rest, ""));
    let query = tail.split_once('?').map(|(_, q)| format!("?{q}")).unwrap_or_default();
    format!("{scheme}://{authority}/{name}{query}")
}

/// `a < b` for `x.y.z` versions.
fn before(a: &str, b: &str) -> bool {
    let parts = |v: &str| v.split('.').map(|p| p.parse::<u64>().unwrap_or(0)).collect::<Vec<_>>();
    let (pa, pb) = (parts(a), parts(b));
    (0..3).map(|i| (pa.get(i).copied().unwrap_or(0), pb.get(i).copied().unwrap_or(0))).find(|(x, y)| x != y).is_some_and(|(x, y)| x < y)
}

fn names(migrations: &[CatalogMigration]) -> Vec<String> {
    migrations.iter().map(|m| m.name.clone()).collect()
}

/// The catalog as an installation of `release` has it: the migrations published up to
/// it, applied as that version did — before 0.2.0 without writing their record — and a
/// little of what people put in it.
async fn installation(dbs: &mut Databases, shipped: &[CatalogMigration], release: &str) -> String {
    let seals = sealed(None).unwrap();
    let last = seals.iter().rposition(|s| s.release == release).expect("version publiée");
    let published = &shipped[..=last];
    let uri = dbs.create().await;
    let c = client(&uri).await;
    for migration in published {
        c.batch_execute(&migration.sql).await.unwrap_or_else(|e| panic!("{} : {e:?}", migration.name));
    }
    if !before(release, "0.2.0") {
        for m in published {
            c.execute(
                "INSERT INTO _basedb.catalog_migration (version, name, checksum, app_release, duration_ms) VALUES ($1, $2, $3, $4, 1)",
                &[&m.version, &m.name, &m.checksum, &release],
            )
            .await
            .unwrap();
        }
    }
    // A tenant, its administrator and a project, as the first start of that version made.
    c.batch_execute(
        "BEGIN;
         WITH t AS (
           INSERT INTO _basedb.tenant (ref, label, is_system, created_by)
           VALUES ('t4z56fq', 't4z56fq', true, _basedb_local.uuid_generate_v7())
           RETURNING id, created_by
         ), u AS (
           INSERT INTO _basedb.app_user (id, tenant_id, email, display_name, is_system, is_instance_admin, created_by, updated_by)
           SELECT created_by, id, 'admin@exemple.fr', 'Administration', true, true, created_by, created_by FROM t
           RETURNING id, tenant_id
         )
         INSERT INTO _basedb.project (tenant_id, label, label_key, created_by, updated_by)
         SELECT tenant_id, 'Projet principal', 'projet principal', id, id FROM u;
         COMMIT;",
    )
    .await
    .unwrap();
    uri
}

/// Every object of the two schemas, by name, with its definition.
async fn fingerprint(uri: &str) -> Vec<String> {
    let rows = client(uri)
        .await
        .query(
            "WITH s(name) AS (VALUES ('_basedb'), ('_basedb_local'))
             SELECT line FROM (
               SELECT 'column ' || table_schema || '.' || table_name || '.' || column_name || ' '
                      || data_type || ' ' || is_nullable || ' ' || coalesce(column_default, '') AS line
                 FROM information_schema.columns WHERE table_schema IN (SELECT name FROM s)
               UNION ALL
               SELECT 'constraint ' || n.nspname || '.' || t.relname || '.' || c.conname || ' '
                      || pg_get_constraintdef(c.oid)
                 FROM pg_constraint c
                 JOIN pg_class t     ON t.oid = c.conrelid
                 JOIN pg_namespace n ON n.oid = t.relnamespace
                WHERE n.nspname IN (SELECT name FROM s)
               UNION ALL
               SELECT 'index ' || indexdef FROM pg_indexes WHERE schemaname IN (SELECT name FROM s)
               UNION ALL
               SELECT 'function ' || n.nspname || '.' || p.proname || '('
                      || pg_get_function_identity_arguments(p.oid) || ') '
                      || md5(pg_get_functiondef(p.oid))
                 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname IN (SELECT name FROM s) AND p.prokind IN ('f', 'p')
               UNION ALL
               SELECT 'trigger ' || pg_get_triggerdef(t.oid)
                 FROM pg_trigger t
                 JOIN pg_class c     ON c.oid = t.tgrelid
                 JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE NOT t.tgisinternal AND n.nspname IN (SELECT name FROM s)
               UNION ALL
               SELECT 'view ' || schemaname || '.' || viewname || ' ' || md5(definition)
                 FROM pg_views WHERE schemaname IN (SELECT name FROM s)
             ) objects ORDER BY line COLLATE \"C\"",
            &[],
        )
        .await
        .unwrap();
    rows.iter().map(|r| r.get(0)).collect()
}

/// `(version, name, app_release)` of every recorded migration.
async fn ledger_of(uri: &str) -> Vec<(i32, String, String)> {
    let rows = client(uri).await.query("SELECT version, name, app_release FROM _basedb.catalog_migration ORDER BY version", &[]).await.unwrap();
    rows.iter().map(|r| (r.get(0), r.get(1), r.get(2))).collect()
}

fn code_of<T: std::fmt::Debug>(outcome: Result<T, AppError>) -> String {
    outcome.expect_err("aucun refus").code.to_string()
}

#[tokio::test]
async fn the_shipped_migrations_are_numbered_without_a_gap_and_the_published_ones_intact() {
    let shipped = embedded_migrations();
    assert_eq!(shipped.iter().map(|m| m.version).collect::<Vec<_>>(), (1..=shipped.len() as i32).collect::<Vec<_>>());
    let seals = sealed(None).unwrap();
    assert!(!seals.is_empty());
    for s in seals {
        let migration = shipped.get(s.version as usize - 1);
        // Edited after publication: an installation that applied it would refuse to start.
        assert_eq!(migration.map(|m| m.name.as_str()), Some(s.name.as_str()), "{} a disparu ou a été renommée", s.name);
        assert_eq!(basedb_base::time::hex(&migration.unwrap().checksum), s.sha256, "{} a été modifiée", s.name);
    }
}

#[tokio::test]
async fn a_fresh_database_receives_every_migration_recorded_with_this_version_and_then_none() {
    let Some(server) = server().await else { return };
    let shipped = embedded_migrations();
    let mut dbs = Databases::new(server);
    let uri = dbs.create().await;
    let state = inspect_catalog(&uri, &shipped).await.unwrap();
    assert_eq!((state.applied, state.shipped, state.pending), (0, shipped.len(), names(&shipped)));
    assert_eq!(migrate_catalog(&uri, "9.9.9", &shipped).await.unwrap(), names(&shipped));
    assert_eq!(
        ledger_of(&uri).await.into_iter().map(|(v, _, r)| (v, r)).collect::<Vec<_>>(),
        shipped.iter().map(|m| (m.version, "9.9.9".to_string())).collect::<Vec<_>>()
    );
    assert!(migrate_catalog(&uri, "9.9.9", &shipped).await.unwrap().is_empty());
    assert!(inspect_catalog(&uri, &shipped).await.unwrap().pending.is_empty());
    dbs.drop_all().await;
}

#[tokio::test]
async fn a_process_that_finds_another_one_migrating_waits_and_only_then_gives_up() {
    let Some(server) = server().await else { return };
    let shipped = embedded_migrations();
    let mut dbs = Databases::new(server);
    let uri = dbs.create().await;
    {
        let holder = client(&uri).await;
        holder.batch_execute("SELECT pg_advisory_lock(1, 1)").await.unwrap();
        let started = std::time::Instant::now();
        assert_eq!(code_of(migrate_catalog_waiting(&uri, "x", &shipped, Duration::from_millis(1500)).await), "LOCK_UNAVAILABLE");
        assert!(started.elapsed() >= Duration::from_millis(1500));
    }
    // The holder gone, its lock is too.
    tokio::time::sleep(Duration::from_millis(200)).await;
    assert_eq!(migrate_catalog(&uri, "x", &shipped).await.unwrap().len(), shipped.len());
    dbs.drop_all().await;
}

#[tokio::test]
async fn two_processes_starting_together_migrate_it_once() {
    let Some(server) = server().await else { return };
    let shipped = embedded_migrations();
    let mut dbs = Databases::new(server);
    let uri = dbs.create().await;
    let (a, b) = tokio::join!(migrate_catalog(&uri, "a", &shipped), migrate_catalog(&uri, "b", &shipped));
    let mut both = a.unwrap();
    both.extend(b.unwrap());
    assert_eq!(both, names(&shipped));
    assert_eq!(ledger_of(&uri).await.len(), shipped.len());
    dbs.drop_all().await;
}

/// The application over the catalog at `uri`: the routers basedb serves.
fn app_on(uri: &str) -> TestApp {
    let mut cfg = test_config().unwrap();
    cfg.database_url = uri.to_string();
    let st = AppState::new(cfg).unwrap();
    let routes = basedb_admin::router(&st).merge(basedb_catalog::router(&st));
    let router = basedb_base::app::build(st.clone(), routes);
    TestApp { st, router }
}

#[tokio::test]
async fn an_installation_of_every_published_version_comes_up_to_exactly_what_a_fresh_one_has() {
    let Some(server) = server().await else { return };
    let shipped = embedded_migrations();
    let mut dbs = Databases::new(server);
    let fresh = dbs.create().await;
    migrate_catalog(&fresh, APPLICATION_VERSION, &shipped).await.unwrap();
    let reference = fingerprint(&fresh).await;
    // Hundreds of columns, constraints, indexes, functions: an empty comparison proves nothing.
    assert!(reference.len() > 500, "{}", reference.len());
    assert!(reference.iter().any(|line| line.contains("_basedb.invitation")));

    let mut releases: Vec<String> = vec![];
    for s in sealed(None).unwrap() {
        if !releases.contains(&s.release) {
            releases.push(s.release);
        }
    }
    for release in releases {
        let old = installation(&mut dbs, &shipped, &release).await;
        let state = inspect_catalog(&old, &shipped).await.unwrap();
        assert_eq!(state.pending.len(), shipped.len() - state.applied, "{release}");
        migrate_catalog(&old, APPLICATION_VERSION, &shipped).await.unwrap_or_else(|e| panic!("{release} : {e:?}"));
        let upgraded = fingerprint(&old).await;
        if upgraded != reference {
            let missing: Vec<_> = reference.iter().filter(|l| !upgraded.contains(l)).collect();
            let extra: Vec<_> = upgraded.iter().filter(|l| !reference.contains(l)).collect();
            panic!("{release} mis à jour diffère d'une installation neuve\nmanque : {missing:#?}\nen trop : {extra:#?}");
        }

        let ledger = ledger_of(&old).await;
        assert_eq!(ledger.iter().map(|(_, n, _)| n.clone()).collect::<Vec<_>>(), names(&shipped), "{release}");
        if before(&release, "0.2.0") {
            assert_eq!(ledger[0].2, "antérieure à 0.2.0");
        }

        // What was there is still there, and the product works on it.
        let app = app_on(&old);
        // What the server does after migrating: error codes, the journals' partitions.
        basedb_server::socle::after_migration(&app.st).await.unwrap();
        let boot = basedb_admin::signup::bootstrap_instance(&app.st, "t4z56fq", None).await.unwrap();
        assert_eq!((boot.email.as_str(), boot.already_done), ("admin@exemple.fr", true), "{release}");
        let (status, body) = app.post("/auth/signup", &json!({ "email": "lea@exemple.fr", "display_name": "Léa Martin", "password": PASSWORD }), &Caller::nobody()).await;
        assert_eq!(status, StatusCode::OK, "{release} : {body}");
        let lea: String = client(&old).await.query_one("SELECT id::text FROM _basedb.app_user WHERE email = 'lea@exemple.fr'", &[]).await.unwrap().get(0);
        let ctx = open_context(&app.st, &lea, "test-migrations", Surface::Rest, None).await.unwrap();
        // The name the administrator's project holds is hers to take too.
        basedb_catalog::projects::create_project(&app.st.pools, &ctx, "Projet principal", None, None).await.unwrap_or_else(|e| panic!("{release} : {e:?}"));
        let ctx = open_context(&app.st, &lea, "test-migrations", Surface::Rest, None).await.unwrap();
        let projects = basedb_catalog::projects::list_projects(&app.st.pools, &ctx).await.unwrap();
        assert_eq!(projects.iter().map(|p| p["label"].clone()).collect::<Vec<_>>(), vec![json!("Projet principal")], "{release}");
        drop(app);
    }
    dbs.drop_all().await;
}

#[tokio::test]
async fn a_recorded_migration_that_differs_stops_everything() {
    let Some(server) = server().await else { return };
    let shipped = embedded_migrations();
    let mut dbs = Databases::new(server);
    let uri = dbs.create().await;
    migrate_catalog(&uri, "x", &shipped).await.unwrap();
    client(&uri).await.batch_execute("UPDATE _basedb.catalog_migration SET checksum = '\\x00' WHERE version = 1").await.unwrap();
    assert_eq!(code_of(inspect_catalog(&uri, &shipped).await), "CATALOG_CHECKSUM_MISMATCH");
    assert_eq!(code_of(migrate_catalog(&uri, "x", &shipped).await), "CATALOG_CHECKSUM_MISMATCH");
    dbs.drop_all().await;
}

#[tokio::test]
async fn a_newer_versions_catalog_is_not_written_into_by_an_older_one() {
    let Some(server) = server().await else { return };
    let shipped = embedded_migrations();
    let mut dbs = Databases::new(server);
    let uri = dbs.create().await;
    migrate_catalog(&uri, "x", &shipped).await.unwrap();
    let next = shipped.len() as i32 + 1;
    client(&uri)
        .await
        .execute(
            "INSERT INTO _basedb.catalog_migration (version, name, checksum, app_release, duration_ms) VALUES ($1, '9999_futur.sql', '\\x00', '99.0.0', 1)",
            &[&next],
        )
        .await
        .unwrap();
    assert_eq!(code_of(inspect_catalog(&uri, &shipped).await), "CATALOG_VERSION_AHEAD");
    assert_eq!(code_of(migrate_catalog(&uri, "x", &shipped).await), "CATALOG_VERSION_AHEAD");
    dbs.drop_all().await;
}

#[tokio::test]
async fn a_migration_that_fails_leaves_the_catalog_at_the_previous_version_and_says_which() {
    let Some(server) = server().await else { return };
    let shipped = embedded_migrations();
    let mut dbs = Databases::new(server);
    let uri = dbs.create().await;
    migrate_catalog(&uri, "x", &shipped).await.unwrap();
    let version = shipped.len() as i32 + 1;
    let broken = CatalogMigration {
        version,
        name: format!("{version:04}_casse.sql"),
        sql: "CREATE TABLE _basedb.essai (id int); SELECT 1 / 0;".into(),
        checksum: checksum_of("casse"),
    };
    let mut with_broken = shipped.clone();
    with_broken.push(broken.clone());
    let error = migrate_catalog(&uri, "x", &with_broken).await.expect_err("la migration cassée passe");
    assert!(format!("{error:?}").contains(&broken.name), "{error:?}");
    assert_eq!(ledger_of(&uri).await.len(), shipped.len());
    let exists: bool = client(&uri).await.query_one("SELECT to_regclass('_basedb.essai') IS NOT NULL", &[]).await.unwrap().get(0);
    assert!(!exists);
    dbs.drop_all().await;
}

/// The tenant's id, its administrator's and its project's.
async fn the_tenant(c: &Client) -> (String, String, String) {
    let r = c.query_one("SELECT t.id::text, t.created_by::text, p.id::text FROM _basedb.tenant t JOIN _basedb.project p ON p.tenant_id = t.id", &[]).await.unwrap();
    (r.get(0), r.get(1), r.get(2))
}

async fn insert(c: &Client, sql: &str, values: &[&(dyn tokio_postgres::types::ToSql + Sync)]) -> String {
    c.query_one(sql, values).await.unwrap_or_else(|e| panic!("{sql} : {e:?}")).get(0)
}

#[tokio::test]
async fn the_questions_of_0_3_0_stay_with_the_whole_base_and_a_new_one_is_its_authors() {
    let Some(server) = server().await else { return };
    let shipped = embedded_migrations();
    let mut dbs = Databases::new(server);
    let uri = installation(&mut dbs, &shipped, "0.3.0").await;
    let c = client(&uri).await;
    let (tenant, admin, project) = the_tenant(&c).await;
    let base = insert(
        &c,
        "INSERT INTO _basedb.base (tenant_id, project_id, label, label_key, created_by, updated_by)
         VALUES ($1::text::uuid, $2::text::uuid, 'Ventes', 'ventes', $3::text::uuid, $3::text::uuid) RETURNING id::text",
        &[&tenant, &project, &admin],
    )
    .await;
    let question = insert(
        &c,
        "INSERT INTO _basedb.question (base_id, label, kind, query, created_by, updated_by)
         VALUES ($1::text::uuid, 'Chiffre du mois', 'sql', '{\"kind\":\"sql\",\"sql\":\"SELECT 1\"}', $2::text::uuid, $2::text::uuid)
         RETURNING id::text",
        &[&base, &admin],
    )
    .await;

    migrate_catalog(&uri, APPLICATION_VERSION, &shipped).await.unwrap();

    let rows = c.query("SELECT id::text, audience::text FROM _basedb.question", &[]).await.unwrap();
    assert_eq!(rows.iter().map(|r| (r.get::<_, String>(0), r.get::<_, String>(1))).collect::<Vec<_>>(), vec![(question, "base".to_string())]);
    let audience: String = c
        .query_one(
            "INSERT INTO _basedb.question (base_id, label, kind, query, created_by, updated_by)
             VALUES ($1::text::uuid, 'À moi', 'sql', '{\"kind\":\"sql\",\"sql\":\"SELECT 2\"}', $2::text::uuid, $2::text::uuid)
             RETURNING audience::text",
            &[&base, &admin],
        )
        .await
        .unwrap()
        .get(0);
    assert_eq!(audience, "personal");
    let saved: bool = c.query_one("SELECT to_regclass('_basedb.saved_query') IS NOT NULL", &[]).await.unwrap().get(0);
    assert!(saved);
    drop(c);
    dbs.drop_all().await;
}

#[tokio::test]
async fn the_saved_queries_of_0_7_0_become_sql_questions_of_the_same_identifier() {
    let Some(server) = server().await else { return };
    let shipped = embedded_migrations();
    let mut dbs = Databases::new(server);
    let uri = installation(&mut dbs, &shipped, "0.7.0").await;
    let c = client(&uri).await;
    let (tenant, admin, project) = the_tenant(&c).await;
    let lea = insert(
        &c,
        "INSERT INTO _basedb.app_user (tenant_id, email, display_name, created_by, updated_by)
         VALUES ($1::text::uuid, 'lea@exemple.fr', 'Léa Martin', $2::text::uuid, $2::text::uuid) RETURNING id::text",
        &[&tenant, &admin],
    )
    .await;
    let base = insert(
        &c,
        "INSERT INTO _basedb.base (tenant_id, project_id, label, label_key, created_by, updated_by)
         VALUES ($1::text::uuid, $2::text::uuid, 'Ventes', 'ventes', $3::text::uuid, $3::text::uuid) RETURNING id::text",
        &[&tenant, &project, &admin],
    )
    .await;
    let group = insert(
        &c,
        "INSERT INTO _basedb.role (tenant_id, label, label_key, name, created_by)
         VALUES ($1::text::uuid, 'Compta', 'compta', 'compta', $2::text::uuid) RETURNING id::text",
        &[&tenant, &admin],
    )
    .await;
    // A question of the base already there: the queries come after it.
    let existing = insert(
        &c,
        "INSERT INTO _basedb.question (base_id, label, kind, query, position, created_by, updated_by)
         VALUES ($1::text::uuid, 'Déjà là', 'sql', '{\"kind\":\"sql\",\"sql\":\"SELECT 0\"}', 7, $2::text::uuid, $2::text::uuid) RETURNING id::text",
        &[&base, &admin],
    )
    .await;
    let query = |label: &'static str, statement: &'static str, audience: &'static str, owner: String| {
        let (c, base) = (&c, base.clone());
        async move {
            let description = format!("Ce que montre « {label} »");
            insert(
                c,
                &format!(
                    "INSERT INTO _basedb.saved_query (base_id, label, label_key, description, statement, audience, owner_id, updated_by)
                     VALUES ($1::text::uuid, $2, lower($2), $3, $4, '{audience}', $5::text::uuid, $5::text::uuid) RETURNING id::text"
                ),
                &[&base, &label, &description, &statement, &owner],
            )
            .await
        }
    };
    let mine = query("Mes relances", "SELECT nom FROM clients", "personal", lea.clone()).await;
    let shared = query("Chiffre du mois", "SELECT sum(montant) FROM ventes", "base", admin.clone()).await;
    let for_group = query("Paie", "SELECT 1", "groups", admin.clone()).await;
    c.execute("INSERT INTO _basedb.saved_query_role (query_id, role_id) VALUES ($1::text::uuid, $2::text::uuid)", &[&for_group, &group]).await.unwrap();

    migrate_catalog(&uri, APPLICATION_VERSION, &shipped).await.unwrap();

    let rows = c
        .query(
            "SELECT id::text, label, description, kind::text, query, visualization, audience::text, position::int,
                    created_by::text, updated_by::text
               FROM _basedb.question WHERE base_id = $1::text::uuid ORDER BY position",
            &[&base],
        )
        .await
        .unwrap();
    // The question that was there stays first; the queries follow, in the order they were written.
    assert_eq!(rows.iter().map(|r| r.get::<_, String>(0)).collect::<Vec<_>>(), vec![existing.clone(), mine.clone(), shared.clone(), for_group.clone()]);
    assert_eq!(rows.iter().map(|r| r.get::<_, i32>(7)).collect::<Vec<_>>(), vec![7, 8, 9, 10]);
    let (m, s) = (&rows[1], &rows[2]);
    assert_eq!(m.get::<_, String>(1), "Mes relances");
    assert_eq!(m.get::<_, Option<String>>(2).as_deref(), Some("Ce que montre « Mes relances »"));
    assert_eq!(m.get::<_, String>(3), "sql");
    assert_eq!(m.get::<_, Value>(4), json!({ "kind": "sql", "sql": "SELECT nom FROM clients" }));
    // Shown as a table until someone chooses another drawing.
    assert_eq!(m.get::<_, Value>(5)["type"], "table");
    assert_eq!((m.get::<_, String>(6), m.get::<_, String>(8), m.get::<_, String>(9)), ("personal".to_string(), lea.clone(), lea.clone()));
    assert_eq!((s.get::<_, String>(6), s.get::<_, String>(8)), ("base".to_string(), admin.clone()));

    let roles = c.query("SELECT question_id::text, role_id::text FROM _basedb.question_role", &[]).await.unwrap();
    assert_eq!(roles.iter().map(|r| (r.get::<_, String>(0), r.get::<_, String>(1))).collect::<Vec<_>>(), vec![(for_group.clone(), group.clone())]);

    // The old table is still there, as it was: nothing is taken from it.
    let old: i64 = c.query_one("SELECT count(*) FROM _basedb.saved_query", &[]).await.unwrap().get(0);
    assert_eq!(old, 3);

    // Run again — the migration is replayable —, it changes nothing: not even a question
    // that was changed since.
    c.execute("UPDATE _basedb.question SET label = 'Renommée', audience = 'base' WHERE id = $1::text::uuid", &[&mine]).await.unwrap();
    c.execute("DELETE FROM _basedb.question_role WHERE question_id = $1::text::uuid", &[&for_group]).await.unwrap();
    c.execute("INSERT INTO _basedb.question_role VALUES ($1::text::uuid, $2::text::uuid)", &[&for_group, &group]).await.unwrap();
    let again = shipped.iter().find(|m| m.name.starts_with("0023_")).expect("0023");
    c.batch_execute(&again.sql).await.unwrap();
    let after = c.query("SELECT id::text, label, audience::text FROM _basedb.question WHERE base_id = $1::text::uuid ORDER BY position", &[&base]).await.unwrap();
    assert_eq!(after.len(), 4);
    assert_eq!((after[1].get::<_, String>(0), after[1].get::<_, String>(1), after[1].get::<_, String>(2)), (mine, "Renommée".to_string(), "base".to_string()));
    assert_eq!(c.query("SELECT 1 FROM _basedb.question_role", &[]).await.unwrap().len(), 1);
    drop(c);
    dbs.drop_all().await;
}
