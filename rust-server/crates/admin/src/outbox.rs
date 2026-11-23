//! `mail/outbox.ts`: the mail queue — notifications left unread, automations' mails.
//!
//! The rows due are taken under a lease (`FOR UPDATE SKIP LOCKED`, `attempts + 1`, five
//! minutes) in a short transaction of their own, then sent: a Node sender and this one on the
//! same database never take the same row.

use basedb_records::storage::Storage;
use basedb_base::db::{Exec, PoolName};
use basedb_base::error::SqlOp;
use basedb_base::error::AppError;
use basedb_base::mailer::{compose, MailFile, MailMessage, Mailer};
use basedb_base::Shared;
use indexmap::IndexMap;
use lettre::AsyncTransport;
use serde_json::Value;

const BATCH: i64 = 100;
const BACKOFF_MINUTES: [i32; 5] = [1, 5, 30, 120, 360];
const LISTED: usize = 10;
pub const MAIL_RETENTION_DAYS: i32 = 30;

#[derive(Debug, Clone)]
struct Due {
    id: String,
    origin: String,
    user_id: Option<String>,
    notification_id: Option<String>,
    recipient: String,
    reply_to: Option<String>,
    subject: Option<String>,
    body_text: Option<String>,
    body_html: Option<String>,
    also_to: Option<Vec<String>>,
    cc: Option<Vec<String>>,
    attachments: Option<Vec<Attachment>>,
    attempts: i32,
}

#[derive(Debug, Clone)]
struct Attachment {
    key: String,
    name: String,
    content_type: String,
    owned: bool,
}

/// A refused send: its message, and whether the relay said it is final (5xx).
#[derive(Debug)]
pub struct SendError {
    pub message: String,
    pub permanent: bool,
}

impl SendError {
    fn transient(message: impl Into<String>) -> SendError {
        SendError { message: message.into(), permanent: false }
    }
}

async fn take_due(st: &Shared) -> Result<Vec<Due>, AppError> {
    let conn = std::sync::Arc::new(st.pools.get(PoolName::Catalog).await?);
    conn.rows("BEGIN", &[]).await?;
    let mut guard = basedb_base::tx::TxGuard::new(conn.clone());
    let taken = async {
        let rows = conn
            .rows(
                "SELECT id::text, origin, user_id::text, notification_id::text, recipient, reply_to,
                        subject, body_text, body_html, also_to, cc, attachments, attempts
                   FROM _basedb.mail_outbox
                  WHERE status = 'pending' AND not_before <= clock_timestamp()
                  ORDER BY not_before
                  LIMIT $1
                  FOR UPDATE SKIP LOCKED",
                &[&BATCH],
            )
            .await?;
        let due: Vec<Due> = rows
            .iter()
            .map(|r| Due {
                id: r.get(0),
                origin: r.get(1),
                user_id: r.get(2),
                notification_id: r.get(3),
                recipient: r.get(4),
                reply_to: r.get(5),
                subject: r.get(6),
                body_text: r.get(7),
                body_html: r.get(8),
                also_to: r.get(9),
                cc: r.get(10),
                attachments: r.get::<_, Option<Value>>(11).map(|v| attachments_of(&v)),
                attempts: r.get::<_, i32>(12) + 1,
            })
            .collect();
        if !due.is_empty() {
            let ids: Vec<String> = due.iter().map(|d| d.id.clone()).collect();
            conn.query_op(
                "UPDATE _basedb.mail_outbox
                    SET attempts = attempts + 1, not_before = clock_timestamp() + interval '5 minutes'
                  WHERE id = ANY($1::text[]::uuid[])",
                &[&ids],
                SqlOp::Update,
            )
            .await?;
        }
        Ok::<_, AppError>(due)
    }
    .await;
    match taken {
        Ok(due) => {
            conn.rows("COMMIT", &[]).await?;
            guard.disarm();
            Ok(due)
        }
        Err(e) => {
            if conn.rows("ROLLBACK", &[]).await.is_ok() {
                guard.disarm();
            }
            Err(e)
        }
    }
}

fn attachments_of(v: &Value) -> Vec<Attachment> {
    v.as_array()
        .map(|list| {
            list.iter()
                .map(|a| Attachment {
                    key: a["key"].as_str().unwrap_or("").to_string(),
                    name: a["name"].as_str().unwrap_or("").to_string(),
                    content_type: a["type"].as_str().unwrap_or("").to_string(),
                    owned: a["owned"] == Value::Bool(true),
                })
                .collect()
        })
        .unwrap_or_default()
}

async fn mark_sent<E: Exec + Sync>(exec: &E, ids: &[String]) -> Result<(), AppError> {
    exec.query_op(
        "UPDATE _basedb.mail_outbox SET status = 'sent', done_at = clock_timestamp(), last_error = NULL
          WHERE id = ANY($1::text[]::uuid[])",
        &[&ids],
        SqlOp::Update,
    )
    .await?;
    Ok(())
}

/// Retried later, or failed for good after the last attempt or a final refusal.
async fn mark_failed<E: Exec + Sync>(exec: &E, rows: &[&Due], error: &SendError) -> Result<(), AppError> {
    let reason = crate::common::js_slice(&error.message, 500).to_string();
    for row in rows {
        match BACKOFF_MINUTES.get((row.attempts - 1).max(0) as usize).filter(|_| row.attempts >= 1 && !error.permanent) {
            None => {
                exec.query_op(
                    "UPDATE _basedb.mail_outbox SET status = 'failed', done_at = clock_timestamp(), last_error = $2
                      WHERE id = $1::text::uuid",
                    &[&row.id, &reason],
                    SqlOp::Update,
                )
                .await?;
            }
            Some(wait) => {
                exec.query_op(
                    "UPDATE _basedb.mail_outbox SET not_before = clock_timestamp() + make_interval(mins => $2), last_error = $3
                      WHERE id = $1::text::uuid",
                    &[&row.id, wait, &reason],
                    SqlOp::Update,
                )
                .await?;
            }
        }
    }
    Ok(())
}

fn is_final(row: &Due, error: &SendError) -> bool {
    error.permanent || row.attempts < 1 || BACKOFF_MINUTES.get((row.attempts - 1) as usize).is_none()
}

/// `encodeURIComponent`.
pub fn encode_uri_component(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        if b.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&b) {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

fn without_tenant_prefix(base: &str) -> &str {
    const ALPHABET: &[u8] = b"23456789abcdefghijkmnpqrstuvwxyz";
    let b = base.as_bytes();
    if b.len() > 10 && base.starts_with("b_t") && b[3..9].iter().all(|c| ALPHABET.contains(c)) && b[9] == b'_' {
        &base[10..]
    } else {
        base
    }
}

/// `rowLink`: the address of a row in the interface, as its address bar writes it.
pub fn row_link(public_url: &str, base: &str, table: &str, record: &str) -> String {
    let root = public_url.trim_end_matches('/');
    format!(
        "{root}/bases/{}/tables/{}?ligne={}",
        encode_uri_component(without_tenant_prefix(base)),
        encode_uri_component(table),
        encode_uri_component(record)
    )
}

pub fn escape_html(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for c in text.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            c => out.push(c),
        }
    }
    out
}

#[derive(Debug, Clone)]
pub struct Item {
    pub id: String,
    pub kind: String,
    pub read: bool,
    pub excerpt: String,
    pub record_id: String,
    pub actor: Option<String>,
    pub table_label: String,
    pub table_name: String,
    pub base_name: String,
}

pub struct NotificationMail {
    pub subject: String,
    pub text: String,
    pub html: String,
}

/// `notificationMail`: one person's unread notifications as one mail.
pub fn notification_mail(locale: Option<&str>, name: &str, items: &[Item], public_url: Option<&str>) -> NotificationMail {
    let t = crate::notification_texts::texts(locale);
    let sentence_of = |i: &Item| t.sentence(&i.kind, i.actor.as_deref().unwrap_or(t.someone()), &i.table_label);
    let listed = &items[..items.len().min(LISTED)];
    let subject = if items.len() == 1 { sentence_of(&items[0]) } else { t.several(items.len()) };
    let mut text = vec![t.greeting(name), String::new()];
    let mut html = vec![format!("<p>{}</p>", escape_html(&t.greeting(name)))];
    for item in listed {
        let link = public_url.map(|u| row_link(u, &item.base_name, &item.table_name, &item.record_id));
        text.push(sentence_of(item));
        if !item.excerpt.is_empty() {
            text.push(format!("  {}", item.excerpt));
        }
        if let Some(link) = &link {
            text.push(format!("  {link}"));
        }
        text.push(String::new());
        html.push(format!(
            "<p><strong>{}</strong>{}{}</p>",
            escape_html(&sentence_of(item)),
            if item.excerpt.is_empty() { String::new() } else { format!("<br><em>{}</em>", escape_html(&item.excerpt)) },
            match &link {
                None => String::new(),
                Some(l) => format!("<br><a href=\"{}\">{}</a>", escape_html(l), escape_html(t.open())),
            }
        ));
    }
    if items.len() > listed.len() {
        let more = t.more(items.len() - listed.len());
        html.push(format!("<p>{}</p>", escape_html(&more)));
        text.push(more);
        text.push(String::new());
    }
    let settings = public_url.map(|u| format!("{}/parametres/notifications", u.trim_end_matches('/')));
    text.push("—".into());
    text.push(t.why().into());
    text.push(match &settings {
        None => t.settings().into(),
        Some(s) => format!("{} {s}", t.settings()),
    });
    html.push(format!(
        "<p style=\"color:#6b7280;font-size:12px\">{}<br>{}</p>",
        escape_html(t.why()),
        match &settings {
            None => escape_html(t.settings()),
            Some(s) => format!("<a href=\"{}\" style=\"color:#6b7280\">{}</a>", escape_html(s), escape_html(t.settings())),
        }
    ));
    NotificationMail { subject, text: text.join("\n"), html: html.join("\n") }
}

/// The mailer, with the relay's verdict kept: a 5xx is final, anything else is retried.
async fn send(mailer: &Mailer, message: &MailMessage) -> Result<(), SendError> {
    match mailer {
        Mailer::Smtp { from, transport } => {
            let composed = compose(from, message).map_err(SendError::transient)?;
            transport.send(composed).await.map(|_| ()).map_err(|e| SendError { message: e.to_string(), permanent: e.is_permanent() })
        }
        other => other.send(message).await.map_err(|e| SendError::transient(e.cause.unwrap_or_else(|| e.code.to_string()))),
    }
}

/// One person's notification mails, due together: sent as one, or dropped.
async fn send_notifications<E: Exec + Sync>(exec: &E, st: &Shared, user_id: &str, rows: &[&Due]) -> Result<usize, AppError> {
    let user = exec
        .first(
            "SELECT email, display_name, locale, mailed_notifications AS mailed,
                    (disabled_at IS NOT NULL OR deleted_at IS NOT NULL) AS gone
               FROM _basedb.app_user WHERE id = $1::text::uuid",
            &[&user_id],
        )
        .await?;
    let ids: Vec<Option<String>> = rows.iter().map(|r| r.notification_id.clone()).collect();
    let found = exec
        .rows(
            "SELECT n.id::text, n.kind, n.read_at IS NOT NULL AS read, n.excerpt, n.record_id::text,
                    a.display_name AS actor, t.label AS table_label, tn.name AS table_name,
                    sn.name AS base_name
               FROM _basedb.notification n
               LEFT JOIN _basedb.app_user a  ON a.id = n.actor_id
               JOIN _basedb.table_def t      ON t.id = n.table_id
               JOIN _basedb.physical_name tn ON tn.id = t.name_id
               JOIN _basedb.db_schema s      ON s.id = t.schema_id
               JOIN _basedb.physical_name sn ON sn.id = s.name_id
              WHERE n.id = ANY($1::text[]::uuid[])
              ORDER BY n.created_at",
            &[&ids],
        )
        .await?;
    let wanted = user.as_ref().is_some_and(|u| !u.get::<_, bool>(4));
    let mailed: Vec<String> = user.as_ref().map(|u| u.get::<_, Vec<String>>(3)).unwrap_or_default();
    let items: Vec<Item> = found
        .iter()
        .map(|r| Item {
            id: r.get(0),
            kind: r.get(1),
            read: r.get(2),
            excerpt: r.get::<_, Option<String>>(3).unwrap_or_else(|| "null".into()),
            record_id: r.get(4),
            actor: r.get(5),
            table_label: r.get(6),
            table_name: r.get(7),
            base_name: r.get(8),
        })
        .filter(|i| wanted && !i.read && mailed.contains(&i.kind))
        .collect();
    let kept: std::collections::HashSet<&str> = items.iter().map(|i| i.id.as_str()).collect();
    let (sent, dropped): (Vec<&Due>, Vec<&Due>) = rows.iter().copied().partition(|r| r.notification_id.as_deref().is_some_and(|n| kept.contains(n)));
    if !dropped.is_empty() {
        let ids: Vec<String> = dropped.iter().map(|r| r.id.clone()).collect();
        exec.query_op("DELETE FROM _basedb.mail_outbox WHERE id = ANY($1::text[]::uuid[])", &[&ids], SqlOp::Delete).await?;
    }
    let Some(user) = user.filter(|_| !items.is_empty()) else { return Ok(0) };
    let mail = notification_mail(user.get::<_, Option<String>>(2).as_deref(), &user.get::<_, String>(1), &items, st.cfg.public_url.as_deref());
    let message = MailMessage { to: user.get(0), subject: mail.subject, body: mail.text, html: Some(mail.html), automatic: true, ..Default::default() };
    if let Err(error) = send(&st.mailer, &message).await {
        mark_failed(exec, &sent, &error).await?;
        return Ok(0);
    }
    mark_sent(exec, &sent.iter().map(|r| r.id.clone()).collect::<Vec<_>>()).await?;
    Ok(1)
}

async fn files_of(st: &Shared, attachments: &[Attachment]) -> Result<Vec<MailFile>, SendError> {
    let storage = Storage::new(&st.cfg.files, &st.https);
    let mut out = Vec::new();
    for a in attachments {
        let body = storage.get(&a.key).await.map_err(|e| SendError::transient(e.to_string()))?;
        let bytes = axum::body::to_bytes(body, usize::MAX).await.map_err(|e| SendError::transient(e.to_string()))?;
        out.push(MailFile { name: a.name.clone(), content_type: a.content_type.clone(), bytes: bytes.to_vec() });
    }
    Ok(out)
}

/// The files made for a mail — a PDF — go once it is sent or given up; a field's stay.
async fn release(st: &Shared, row: &Due) {
    let storage = Storage::new(&st.cfg.files, &st.https);
    for a in row.attachments.iter().flatten().filter(|a| a.owned) {
        let _ = storage.delete(&a.key).await;
    }
}

/// `deliverMails`: one pass, the mails due sent. Says how many left.
pub async fn deliver_mails(st: &Shared) -> Result<usize, AppError> {
    let due = take_due(st).await?;
    if due.is_empty() {
        return Ok(0);
    }
    let exec = st.pools.get(PoolName::Catalog).await?;
    let ids: Vec<String> = due.iter().map(|d| d.id.clone()).collect();
    if !st.mailer.available() {
        exec.query_op("DELETE FROM _basedb.mail_outbox WHERE id = ANY($1::text[]::uuid[]) AND origin = 'notification'", &[&ids], SqlOp::Delete).await?;
        exec.query_op(
            "UPDATE _basedb.mail_outbox SET status = 'failed', done_at = clock_timestamp(), last_error = 'no_transport'
              WHERE id = ANY($1::text[]::uuid[]) AND origin = 'automation'",
            &[&ids],
            SqlOp::Update,
        )
        .await?;
        return Ok(0);
    }
    let mut sent = 0;
    let mut by_user: IndexMap<&str, Vec<&Due>> = IndexMap::new();
    for d in &due {
        if let (true, Some(user)) = (d.origin == "notification", d.user_id.as_deref()) {
            by_user.entry(user).or_default().push(d);
        }
    }
    for (user, rows) in &by_user {
        sent += send_notifications(&exec, st, user, rows).await?;
    }
    for d in due.iter().filter(|d| d.origin == "automation") {
        let attachments = match &d.attachments {
            None => Ok(Vec::new()),
            Some(list) => files_of(st, list).await,
        };
        let outcome = match attachments {
            Err(e) => Err(e),
            Ok(attachments) => {
                let message = MailMessage {
                    to: d.recipient.clone(),
                    subject: d.subject.clone().unwrap_or_default(),
                    body: d.body_text.clone().unwrap_or_default(),
                    html: d.body_html.clone(),
                    reply_to: d.reply_to.clone(),
                    also: d.also_to.clone().unwrap_or_default(),
                    cc: d.cc.clone().unwrap_or_default(),
                    attachments,
                    automatic: true,
                };
                send(&st.mailer, &message).await
            }
        };
        match outcome {
            Ok(()) => {
                mark_sent(&exec, std::slice::from_ref(&d.id)).await?;
                release(st, d).await;
                sent += 1;
            }
            Err(error) => {
                mark_failed(&exec, &[d], &error).await?;
                if is_final(d, &error) {
                    release(st, d).await;
                }
            }
        }
    }
    Ok(sent)
}

/// `purgeMails`: sent and failed mails are kept a month, then forgotten.
pub async fn purge_mails(st: &Shared) -> Result<(), AppError> {
    let exec = st.pools.get(PoolName::Catalog).await?;
    exec.query_op(
        "DELETE FROM _basedb.mail_outbox
          WHERE status IN ('sent', 'failed')
            AND done_at < clock_timestamp() - make_interval(days => $1)",
        &[&MAIL_RETENTION_DAYS],
        SqlOp::Delete,
    )
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(n: usize) -> Item {
        Item {
            id: format!("n{n}"),
            kind: "mention".into(),
            read: false,
            excerpt: if n == 0 { "Voir <ceci> & \"cela\"".into() } else { String::new() },
            record_id: "0190-ab".into(),
            actor: if n == 0 { Some("Anne".into()) } else { None },
            table_label: "Factures".into(),
            table_name: "factures".into(),
            base_name: "b_t4z56fq_crm".into(),
        }
    }

    #[test]
    fn links_a_row_as_the_address_bar_writes_it() {
        assert_eq!(row_link("https://x.fr/app//", "b_t4z56fq_crm", "fac tures", "r/1"), "https://x.fr/app/bases/crm/tables/fac%20tures?ligne=r%2F1");
        assert_eq!(row_link("https://x.fr", "b_t4z56fq_", "t", "r"), "https://x.fr/bases/b_t4z56fq_/tables/t?ligne=r");
        assert_eq!(row_link("https://x.fr", "b_t4z56lq_crm", "t", "r"), "https://x.fr/bases/b_t4z56lq_crm/tables/t?ligne=r");
        assert_eq!(encode_uri_component("é!~*'()"), "%C3%A9!~*'()");
    }

    #[test]
    fn one_notification_is_its_own_subject() {
        let mail = notification_mail(None, "Bob", &[item(0)], Some("https://x.fr/"));
        assert_eq!(mail.subject, "Anne vous a mentionné dans Factures");
        assert_eq!(
            mail.text,
            "Bonjour Bob,\n\nAnne vous a mentionné dans Factures\n  Voir <ceci> & \"cela\"\n  https://x.fr/bases/crm/tables/factures?ligne=0190-ab\n\n—\nCe courriel part quand une notification reste dix minutes sans être lue.\nPour choisir ce que vous recevez par courriel : Paramètres › Notifications. https://x.fr/parametres/notifications"
        );
        assert!(mail.html.contains("<br><em>Voir &lt;ceci&gt; &amp; &quot;cela&quot;</em><br><a href=\"https://x.fr/bases/crm/tables/factures?ligne=0190-ab\">Ouvrir dans basedb</a></p>"));
    }

    #[test]
    fn several_are_counted_and_the_rest_summed_up() {
        let items: Vec<Item> = (1..=12).map(item).collect();
        let mail = notification_mail(Some("en"), "Bob", &items, None);
        assert_eq!(mail.subject, "12 unread notifications in basedb");
        assert_eq!(mail.text.matches("Someone mentioned you in Factures").count(), 10);
        assert!(mail.text.contains("And 2 more, in basedb.\n\n—\n"));
        assert!(mail.text.ends_with("To choose what you receive by email: Settings › Notifications."));
        assert!(!mail.html.contains("<a href"));
    }
}
