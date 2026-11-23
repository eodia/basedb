//! L'écoute `LISTEN/NOTIFY`, telle `runtime/listener.ts` : une connexion dédiée
//! (`application_name = basedb:listen`, contrat de connexion), un `LISTEN` par canal, des
//! gestionnaires par canal, et une reconnexion avec un délai qui double de 1 s à 30 s.
//!
//! ```ignore
//! let listener = Listener::new(&cfg.database_url, &["basedb_catalog"]);
//! listener.on("basedb_catalog", |payload| println!("{payload}"));
//! listener.start();
//! ```

use crate::db::pg_config;
use futures_util::StreamExt;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio_postgres::{AsyncMessage, NoTls};

pub type NotificationHandler = Arc<dyn Fn(&str) + Send + Sync>;

#[derive(Clone)]
pub struct Listener {
    inner: Arc<Inner>,
}

struct Inner {
    database_url: String,
    channels: Vec<String>,
    handlers: Mutex<HashMap<String, Vec<NotificationHandler>>>,
    ready: AtomicBool,
    stopped: AtomicBool,
}

impl Listener {
    pub fn new(database_url: &str, channels: &[&str]) -> Listener {
        Listener {
            inner: Arc::new(Inner {
                database_url: database_url.to_string(),
                channels: channels.iter().map(|c| c.to_string()).collect(),
                handlers: Mutex::new(HashMap::new()),
                ready: AtomicBool::new(false),
                stopped: AtomicBool::new(true),
            }),
        }
    }

    /// Listening right now (`ready`).
    pub fn ready(&self) -> bool {
        self.inner.ready.load(Ordering::SeqCst)
    }

    /// Adds a handler for a channel. A handler that panics is reported, not propagated.
    pub fn on(&self, channel: &str, handler: impl Fn(&str) + Send + Sync + 'static) {
        self.inner.handlers.lock().unwrap().entry(channel.to_string()).or_default().push(Arc::new(handler));
    }

    /// Starts listening in the background; reconnects until [`Listener::stop`].
    pub fn start(&self) {
        if !self.inner.stopped.swap(false, Ordering::SeqCst) {
            return;
        }
        let inner = self.inner.clone();
        tokio::spawn(async move {
            let mut delay = Duration::from_secs(1);
            while !inner.stopped.load(Ordering::SeqCst) {
                match listen_once(&inner).await {
                    Ok(()) => eprintln!("basedb:listen : connexion d'écoute fermée"),
                    Err(e) => eprintln!("basedb:listen : {e}"),
                }
                if inner.ready.swap(false, Ordering::SeqCst) {
                    delay = Duration::from_secs(1);
                }
                if inner.stopped.load(Ordering::SeqCst) {
                    break;
                }
                tokio::time::sleep(delay).await;
                delay = (delay * 2).min(Duration::from_secs(30));
            }
        });
    }

    pub fn stop(&self) {
        self.inner.stopped.store(true, Ordering::SeqCst);
    }
}

async fn listen_once(inner: &Arc<Inner>) -> Result<(), String> {
    let config = pg_config(&inner.database_url, "basedb:listen", &[])?;
    let (client, mut connection) = config.connect(NoTls).await.map_err(|e| e.to_string())?;
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
    let driver = tokio::spawn(async move {
        let mut stream = futures_util::stream::poll_fn(move |cx| connection.poll_message(cx));
        while let Some(message) = stream.next().await {
            match message {
                Ok(AsyncMessage::Notification(n)) => {
                    let _ = tx.send((n.channel().to_string(), n.payload().to_string()));
                }
                Ok(_) => {}
                Err(e) => return Err(e.to_string()),
            }
        }
        Ok(())
    });
    for channel in &inner.channels {
        client.batch_execute(&format!("LISTEN {channel}")).await.map_err(|e| e.to_string())?;
    }
    inner.ready.store(true, Ordering::SeqCst);
    while let Some((channel, payload)) = rx.recv().await {
        if inner.stopped.load(Ordering::SeqCst) {
            break;
        }
        let handlers = inner.handlers.lock().unwrap().get(&channel).cloned().unwrap_or_default();
        for handler in handlers {
            if std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| handler(&payload))).is_err() {
                eprintln!("basedb:listen : un gestionnaire de {channel} a échoué");
            }
        }
    }
    drop(client);
    driver.await.map_err(|e| e.to_string())?
}
