//! Les courriels sortants, tels `mail/transport.ts` et `mail/smtp.ts` : le relais de
//! l'opérateur (`BASEDB_SMTP_HOST`, `_PORT` 587 par défaut, `_SECURE` `tls` | `starttls` |
//! `none` — `tls` par défaut sur le port 465, `starttls` sinon —, `_USER`, `_PASSWORD`,
//! `_HELO`) et l'expéditeur `BASEDB_MAIL_FROM` (`basedb <no-reply@exemple.fr>`).
//!
//! `starttls` EXIGE STARTTLS (Node refuse un relais qui ne le propose pas), TLS 1.2 au moins,
//! certificats du magasin système. Sans relais et avec `BASEDB_DEV_MAIL=1`, le courriel est
//! affiché dans le journal, comme `server.ts` l'affiche, et jamais envoyé.
//!
//! Le message est construit par lettre (texte et HTML en alternatives, pièces jointes) ;
//! `Auto-Submitted: auto-generated` marque un courriel écrit par une machine (RFC 3834).

use crate::config::{parse_address, SmtpConfig};
use crate::error::AppError;
use lettre::message::header::{ContentType, HeaderName, HeaderValue};
use lettre::message::{Attachment, Mailbox, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::transport::smtp::client::{Tls, TlsParameters};
use lettre::transport::smtp::extension::ClientId;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use std::time::Duration;

/// A file attached (`MailFile`).
#[derive(Debug, Clone)]
pub struct MailFile {
    pub name: String,
    pub content_type: String,
    pub bytes: Vec<u8>,
}

/// `MailMessage`.
#[derive(Debug, Clone, Default)]
pub struct MailMessage {
    pub to: String,
    pub subject: String,
    /// The plain text — the whole message for every client.
    pub body: String,
    pub html: Option<String>,
    pub reply_to: Option<String>,
    pub automatic: bool,
    pub also: Vec<String>,
    pub cc: Vec<String>,
    pub attachments: Vec<MailFile>,
}

/// The transport the configuration describes.
pub fn transport(config: &SmtpConfig) -> Result<AsyncSmtpTransport<Tokio1Executor>, String> {
    let params = TlsParameters::builder(config.host.clone())
        .set_min_tls_version(lettre::transport::smtp::client::TlsVersion::Tlsv12)
        .build()
        .map_err(|e| e.to_string())?;
    let tls = match config.secure.as_str() {
        "tls" => Tls::Wrapper(params),
        "starttls" => Tls::Required(params),
        _ => Tls::None,
    };
    let mut b = AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(config.host.clone())
        .port(config.port)
        .tls(tls)
        .hello_name(ClientId::Domain(config.helo.clone()))
        .timeout(Some(Duration::from_secs(20)));
    if let Some(user) = config.user.as_ref().filter(|u| !u.is_empty()) {
        b = b.credentials(Credentials::new(user.clone(), config.password.clone().unwrap_or_default()));
    }
    Ok(b.build())
}

#[derive(Clone)]
struct AutoSubmitted;

impl lettre::message::header::Header for AutoSubmitted {
    fn name() -> HeaderName {
        HeaderName::new_from_ascii_str("Auto-Submitted")
    }
    fn parse(_: &str) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        Ok(AutoSubmitted)
    }
    fn display(&self) -> HeaderValue {
        HeaderValue::new(Self::name(), "auto-generated".into())
    }
}

fn mailbox(text: &str) -> Result<Mailbox, String> {
    let (address, name) = parse_address(text).ok_or_else(|| format!("adresse invalide : {text}"))?;
    Ok(Mailbox::new(name, address.parse().map_err(|e| format!("adresse invalide : {e}"))?))
}

/// The message `composeMail` would send.
pub fn compose(from: &str, m: &MailMessage) -> Result<Message, String> {
    let mut b = Message::builder().from(mailbox(from)?).subject(m.subject.clone());
    let mut seen: Vec<String> = Vec::new();
    for to in std::iter::once(&m.to).chain(m.also.iter()) {
        if !seen.contains(to) {
            seen.push(to.clone());
            b = b.to(mailbox(to)?);
        }
    }
    for cc in &m.cc {
        b = b.cc(mailbox(cc)?);
    }
    if let Some(reply) = m.reply_to.as_deref().and_then(|r| mailbox(r).ok()) {
        b = b.reply_to(reply);
    }
    if m.automatic {
        b = b.header(AutoSubmitted);
    }
    let text = SinglePart::plain(m.body.clone());
    let content = match &m.html {
        Some(html) => MultiPart::alternative().singlepart(text).singlepart(SinglePart::html(html.clone())),
        None if m.attachments.is_empty() => return b.singlepart(text).map_err(|e| e.to_string()),
        None => MultiPart::mixed().singlepart(text),
    };
    let body = if m.attachments.is_empty() {
        content
    } else {
        let mut mixed = if m.html.is_some() { MultiPart::mixed().multipart(content) } else { content };
        for f in &m.attachments {
            let kind = ContentType::parse(&f.content_type).unwrap_or(ContentType::parse("application/octet-stream").unwrap());
            mixed = mixed.singlepart(Attachment::new(f.name.clone()).body(f.bytes.clone(), kind));
        }
        mixed
    };
    b.multipart(body).map_err(|e| e.to_string())
}

/// The way out: the relay, the journal (development), or nothing.
pub enum Mailer {
    Smtp { from: String, transport: AsyncSmtpTransport<Tokio1Executor> },
    Development,
    None,
}

impl Mailer {
    pub fn from_config(smtp: Option<&SmtpConfig>, dev_mail: bool) -> Result<Mailer, String> {
        Ok(match smtp {
            Some(s) => Mailer::Smtp { from: s.from.clone(), transport: transport(s)? },
            None if dev_mail => Mailer::Development,
            None => Mailer::None,
        })
    }

    pub fn available(&self) -> bool {
        !matches!(self, Mailer::None)
    }

    /// Sends one message. Without a mailer, `INTERNAL_ERROR` — callers check `available()`.
    pub async fn send(&self, m: &MailMessage) -> Result<(), AppError> {
        match self {
            Mailer::Smtp { from, transport } => {
                let message = compose(from, m).map_err(AppError::internal)?;
                transport.send(message).await.map_err(|e| AppError::internal(format!("envoi SMTP impossible : {e}")))?;
                Ok(())
            }
            Mailer::Development => {
                println!("[courriel · développement] {} — {}", m.to, m.subject);
                println!("[courriel · développement] {}", m.body);
                Ok(())
            }
            Mailer::None => Err(AppError::internal("aucun relais de courriel")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn smtp(secure: &str) -> SmtpConfig {
        SmtpConfig {
            host: "smtp.exemple.fr".into(),
            port: 587,
            secure: secure.into(),
            user: Some("u".into()),
            password: Some("p".into()),
            helo: "exemple.fr".into(),
            from: "basedb <no-reply@exemple.fr>".into(),
            from_address: "no-reply@exemple.fr".into(),
        }
    }

    #[tokio::test]
    async fn transports_for_each_mode() {
        for mode in ["tls", "starttls", "none"] {
            assert!(transport(&smtp(mode)).is_ok());
        }
        assert!(Mailer::from_config(None, true).unwrap().available());
        assert!(!Mailer::from_config(None, false).unwrap().available());
    }

    #[test]
    fn composes_messages() {
        let m = MailMessage {
            to: "a@b.fr".into(),
            also: vec!["a@b.fr".into(), "c@d.fr".into()],
            subject: "Sujet é".into(),
            body: "texte".into(),
            html: Some("<p>texte</p>".into()),
            automatic: true,
            attachments: vec![MailFile { name: "d.csv".into(), content_type: "text/csv".into(), bytes: b"a,b".to_vec() }],
            ..Default::default()
        };
        let raw = String::from_utf8_lossy(&compose("basedb <no-reply@exemple.fr>", &m).unwrap().formatted()).into_owned();
        assert!(raw.contains("Auto-Submitted: auto-generated"), "{raw}");
        assert!(raw.contains("multipart/mixed") && raw.contains("multipart/alternative") && raw.contains("d.csv"), "{raw}");
        assert!(raw.contains("To: a@b.fr, c@d.fr"), "{raw}");
        assert!(compose("pas une adresse", &m).is_err());
    }
}
