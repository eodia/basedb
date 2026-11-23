//! A PostgreSQL connection that says what node-postgres says: the type of every column, the
//! command tag of every statement, each result of a multi-statement text, rows as text.
//! `tokio-postgres` gives neither types nor tags for a simple query, and only decodes the
//! types it knows: the SQL console runs arbitrary text, so it speaks the protocol itself.

use bytes::BytesMut;
use fallible_iterator::FallibleIterator;
use postgres_protocol::authentication::md5_hash;
use postgres_protocol::authentication::sasl::{ChannelBinding, ScramSha256};
use postgres_protocol::message::backend::{ErrorResponseBody, Message};
use postgres_protocol::message::frontend;
use postgres_protocol::IsNull;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

/// A failure as node-postgres reports one: the server's fields, or no code at all when the
/// connection itself failed.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct PgError {
    pub code: Option<String>,
    pub message: String,
    pub detail: Option<String>,
    pub hint: Option<String>,
    pub position: Option<String>,
}

impl PgError {
    fn io(e: impl std::fmt::Display) -> PgError {
        PgError { message: e.to_string(), ..PgError::default() }
    }

    fn of(body: &ErrorResponseBody) -> PgError {
        let mut e = PgError::default();
        let mut fields = body.fields();
        while let Ok(Some(f)) = fields.next() {
            let value = String::from_utf8_lossy(f.value_bytes()).into_owned();
            match f.type_() {
                b'C' => e.code = Some(value),
                b'M' => e.message = value,
                b'D' => e.detail = Some(value),
                b'H' => e.hint = Some(value),
                b'P' => e.position = Some(value),
                _ => {}
            }
        }
        e
    }
}

/// One statement's result (`Result` of node-postgres, `rowMode: 'array'`).
#[derive(Debug, Clone, Default, PartialEq)]
pub struct QueryResult {
    pub command: Option<String>,
    pub row_count: Option<i64>,
    /// Name and type OID of each column.
    pub fields: Vec<(String, u32)>,
    pub rows: Vec<Vec<Option<String>>>,
}

impl QueryResult {
    /// `addCommandComplete`: `/^([A-Za-z]+)(?: (\d+))?(?: (\d+))?/`.
    fn complete(&mut self, tag: &str) {
        let command: String = tag.chars().take_while(|c| c.is_ascii_alphabetic()).collect();
        if command.is_empty() {
            return;
        }
        let mut numbers = Vec::new();
        let mut rest = &tag[command.len()..];
        while numbers.len() < 2 {
            let Some(after) = rest.strip_prefix(' ') else { break };
            let digits: String = after.chars().take_while(char::is_ascii_digit).collect();
            if digits.is_empty() {
                break;
            }
            rest = &after[digits.len()..];
            numbers.push(digits);
        }
        self.command = Some(command);
        if let Some(n) = numbers.get(1).or(numbers.first()) {
            self.row_count = n.parse().ok();
        }
    }
}

/// Where and as whom to connect.
#[derive(Debug, Clone)]
pub struct ConnectOptions {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub user: String,
    pub password: String,
    /// The startup `options` (`-c key=value …`).
    pub options: String,
    pub application_name: String,
}

impl ConnectOptions {
    /// The server and database of `database_url`, as another role.
    pub fn of_url(database_url: &str, user: &str, password: &str, options: String, application_name: &str) -> Result<ConnectOptions, PgError> {
        let cfg: tokio_postgres::Config = database_url.parse().map_err(PgError::io)?;
        let host = match cfg.get_hosts().first() {
            Some(tokio_postgres::config::Host::Tcp(h)) => h.clone(),
            _ => "localhost".to_string(),
        };
        let port = cfg.get_ports().first().copied().unwrap_or(5432);
        let database = cfg.get_dbname().map(str::to_string).unwrap_or_else(|| user.to_string());
        Ok(ConnectOptions { host, port, database, user: user.into(), password: password.into(), options, application_name: application_name.into() })
    }
}

pub struct WireClient {
    stream: TcpStream,
    buf: BytesMut,
}

const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);

impl WireClient {
    pub async fn connect(o: &ConnectOptions) -> Result<WireClient, PgError> {
        let stream = tokio::time::timeout(CONNECT_TIMEOUT, TcpStream::connect((o.host.as_str(), o.port)))
            .await
            .map_err(|_| PgError::io("Connection terminated due to connection timeout"))?
            .map_err(PgError::io)?;
        let _ = stream.set_nodelay(true);
        let mut client = WireClient { stream, buf: BytesMut::with_capacity(8192) };
        let mut out = BytesMut::new();
        frontend::startup_message(
            [("user", o.user.as_str()), ("database", o.database.as_str()), ("options", o.options.as_str()), ("application_name", o.application_name.as_str())],
            &mut out,
        )
        .map_err(PgError::io)?;
        client.send(&out).await?;
        tokio::time::timeout(CONNECT_TIMEOUT, client.authenticate(o)).await.map_err(|_| PgError::io("Connection terminated due to connection timeout"))??;
        Ok(client)
    }

    async fn authenticate(&mut self, o: &ConnectOptions) -> Result<(), PgError> {
        let mut scram: Option<ScramSha256> = None;
        loop {
            let mut out = BytesMut::new();
            match self.read().await? {
                Message::AuthenticationOk | Message::ParameterStatus(_) | Message::BackendKeyData(_) | Message::NoticeResponse(_) => continue,
                Message::ReadyForQuery(_) => return Ok(()),
                Message::ErrorResponse(body) => return Err(PgError::of(&body)),
                Message::AuthenticationCleartextPassword => frontend::password_message(o.password.as_bytes(), &mut out).map_err(PgError::io)?,
                Message::AuthenticationMd5Password(body) => {
                    let hash = md5_hash(o.user.as_bytes(), o.password.as_bytes(), body.salt());
                    frontend::password_message(hash.as_bytes(), &mut out).map_err(PgError::io)?;
                }
                Message::AuthenticationSasl(body) => {
                    let mut mechanisms = body.mechanisms();
                    let mut scram_offered = false;
                    while let Ok(Some(m)) = mechanisms.next() {
                        scram_offered |= m == "SCRAM-SHA-256";
                    }
                    if !scram_offered {
                        return Err(PgError::io("SASL: Only mechanism SCRAM-SHA-256 is currently supported"));
                    }
                    let s = ScramSha256::new(o.password.as_bytes(), ChannelBinding::unsupported());
                    frontend::sasl_initial_response("SCRAM-SHA-256", s.message(), &mut out).map_err(PgError::io)?;
                    scram = Some(s);
                }
                Message::AuthenticationSaslContinue(body) => {
                    let s = scram.as_mut().ok_or_else(|| PgError::io("SASL: unexpected continuation"))?;
                    s.update(body.data()).map_err(PgError::io)?;
                    frontend::sasl_response(s.message(), &mut out).map_err(PgError::io)?;
                }
                Message::AuthenticationSaslFinal(body) => {
                    let s = scram.as_mut().ok_or_else(|| PgError::io("SASL: unexpected final message"))?;
                    s.finish(body.data()).map_err(PgError::io)?;
                    continue;
                }
                _ => return Err(PgError::io("authentication method not supported")),
            }
            self.send(&out).await?;
        }
    }

    async fn send(&mut self, out: &[u8]) -> Result<(), PgError> {
        self.stream.write_all(out).await.map_err(PgError::io)
    }

    async fn read(&mut self) -> Result<Message, PgError> {
        loop {
            if let Some(m) = Message::parse(&mut self.buf).map_err(PgError::io)? {
                return Ok(m);
            }
            if self.stream.read_buf(&mut self.buf).await.map_err(PgError::io)? == 0 {
                return Err(PgError::io("Connection terminated unexpectedly"));
            }
        }
    }

    /// The simple protocol: every statement of the text, one result each (`client.query(text)`).
    pub async fn simple(&mut self, sql: &str) -> Result<Vec<QueryResult>, PgError> {
        let mut out = BytesMut::new();
        frontend::query(sql, &mut out).map_err(PgError::io)?;
        self.send(&out).await?;
        self.results().await
    }

    /// The extended protocol, unnamed statement and portal, text parameters and results:
    /// one statement and no more.
    pub async fn extended(&mut self, sql: &str, params: &[Option<&str>]) -> Result<QueryResult, PgError> {
        let mut out = BytesMut::new();
        frontend::parse("", sql, std::iter::empty(), &mut out).map_err(PgError::io)?;
        frontend::bind(
            "",
            "",
            std::iter::empty::<i16>(),
            params.iter().copied(),
            |v, buf| match v {
                None => Ok(IsNull::Yes),
                Some(s) => {
                    buf.extend_from_slice(s.as_bytes());
                    Ok(IsNull::No)
                }
            },
            std::iter::empty::<i16>(),
            &mut out,
        )
        .map_err(|_| PgError::io("bind"))?;
        frontend::describe(b'P', "", &mut out).map_err(PgError::io)?;
        frontend::execute("", 0, &mut out).map_err(PgError::io)?;
        frontend::sync(&mut out);
        self.send(&out).await?;
        Ok(self.results().await?.pop().unwrap_or_default())
    }

    /// Reads up to `ReadyForQuery`, a new result for each statement after the first that
    /// completed (`_checkForMultirow`); the first error, once the server is ready again.
    async fn results(&mut self) -> Result<Vec<QueryResult>, PgError> {
        let mut results = vec![QueryResult::default()];
        let mut error: Option<PgError> = None;
        loop {
            match self.read().await? {
                Message::RowDescription(body) => {
                    next_if_complete(&mut results);
                    let mut fields = body.fields();
                    let current = results.last_mut().expect("a result");
                    while let Ok(Some(f)) = fields.next() {
                        current.fields.push((f.name().to_string(), f.type_oid()));
                    }
                }
                Message::DataRow(body) => {
                    let buffer = body.buffer();
                    let mut ranges = body.ranges();
                    let mut row = Vec::new();
                    while let Ok(Some(r)) = ranges.next() {
                        row.push(r.map(|r| String::from_utf8_lossy(&buffer[r]).into_owned()));
                    }
                    results.last_mut().expect("a result").rows.push(row);
                }
                Message::CommandComplete(body) => {
                    next_if_complete(&mut results);
                    let tag = body.tag().map_err(PgError::io)?.to_string();
                    results.last_mut().expect("a result").complete(&tag);
                }
                Message::ErrorResponse(body) => {
                    if error.is_none() {
                        error = Some(PgError::of(&body));
                    }
                }
                Message::CopyInResponse(_) => {
                    let mut out = BytesMut::new();
                    frontend::copy_fail("No source stream defined", &mut out).map_err(PgError::io)?;
                    self.send(&out).await?;
                }
                Message::ReadyForQuery(_) => break,
                _ => {}
            }
        }
        match error {
            Some(e) => Err(e),
            None => Ok(results),
        }
    }

    /// Closes the connection.
    pub async fn close(mut self) {
        let mut out = BytesMut::new();
        frontend::terminate(&mut out);
        let _ = self.send(&out).await;
        let _ = self.stream.shutdown().await;
    }
}

fn next_if_complete(results: &mut Vec<QueryResult>) {
    if results.last().is_some_and(|r| r.command.is_some()) {
        results.push(QueryResult::default());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn command_tags_read_as_node_postgres() {
        let mut r = QueryResult::default();
        r.complete("INSERT 0 3");
        assert_eq!((r.command.as_deref(), r.row_count), (Some("INSERT"), Some(3)));
        let mut r = QueryResult::default();
        r.complete("SELECT 12");
        assert_eq!((r.command.as_deref(), r.row_count), (Some("SELECT"), Some(12)));
        let mut r = QueryResult::default();
        r.complete("CREATE TABLE");
        assert_eq!((r.command.as_deref(), r.row_count), (Some("CREATE"), None));
    }
}
