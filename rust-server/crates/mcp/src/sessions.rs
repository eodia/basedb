//! Agent sessions and quotas (`sessions.ts`, chapter 09 §9.4 and §11.4) — in process
//! memory, and nowhere else. A session proves nothing by itself: the token is revalidated
//! at every message.

use indexmap::IndexMap;
use serde_json::Value;

/// §9.4: a session idle this long is closed; the client replays `initialize`.
pub const SESSION_IDLE_MS: f64 = 30.0 * 60_000.0;
/// §9.4: requests in flight per session.
pub const MAX_IN_FLIGHT: u32 = 4;
/// Sessions kept per token: the oldest goes when a client opens one too many.
const SESSIONS_PER_TOKEN: usize = 16;

#[derive(Debug, Clone)]
pub struct Session {
    pub id: String,
    /// A digest of the token's secret, never the secret.
    pub token_key: String,
    pub protocol_version: String,
    /// `clientInfo`, as declared (`{name?, version?}`), or `None`.
    pub client: Option<Value>,
    pub last_seen: f64,
    pub in_flight: u32,
}

#[derive(Default)]
pub struct Sessions {
    sessions: IndexMap<String, Session>,
}

impl Sessions {
    pub fn open(&mut self, token_key: &str, protocol_version: &str, client: Option<Value>, now: f64) -> Session {
        self.sweep(now);
        let oldest = self
            .sessions
            .values()
            .filter(|s| s.token_key == token_key)
            .fold((0usize, None::<&Session>), |(n, oldest), s| (n + 1, if oldest.is_some_and(|o| o.last_seen <= s.last_seen) { oldest } else { Some(s) }));
        if oldest.0 >= SESSIONS_PER_TOKEN {
            if let Some(id) = oldest.1.map(|s| s.id.clone()) {
                self.sessions.shift_remove(&id);
            }
        }
        let session = Session {
            id: uuid::Uuid::new_v4().to_string(),
            token_key: token_key.to_string(),
            protocol_version: protocol_version.to_string(),
            client,
            last_seen: now,
            in_flight: 0,
        };
        self.sessions.insert(session.id.clone(), session.clone());
        session
    }

    /// The session a message names — `None` when it is unknown, idle past its bound, or
    /// opened with another token (the three answer alike).
    pub fn find(&mut self, id: &str, token_key: &str, now: f64) -> Option<Session> {
        let session = self.sessions.get_mut(id)?;
        if now - session.last_seen > SESSION_IDLE_MS {
            self.sessions.shift_remove(id);
            return None;
        }
        if session.token_key != token_key {
            return None;
        }
        session.last_seen = now;
        Some(session.clone())
    }

    pub fn close(&mut self, id: &str) {
        self.sessions.shift_remove(id);
    }

    /// A token that stopped being valid closes every session it opened (§9.4).
    pub fn close_token(&mut self, token_key: &str) {
        self.sessions.retain(|_, s| s.token_key != token_key);
    }

    /// `session.inFlight` — 0 for a session closed meanwhile.
    pub fn in_flight(&self, id: &str) -> u32 {
        self.sessions.get(id).map_or(0, |s| s.in_flight)
    }

    /// `inFlight += delta` on the session object: once closed, it is no one's business.
    pub fn add_in_flight(&mut self, id: &str, delta: i32) {
        if let Some(s) = self.sessions.get_mut(id) {
            s.in_flight = s.in_flight.saturating_add_signed(delta);
        }
    }

    fn sweep(&mut self, now: f64) {
        self.sessions.retain(|_, s| now - s.last_seen <= SESSION_IDLE_MS);
    }
}

/// Calls per token and per minute — §11.4, a token bucket in memory.
pub struct Quota {
    per_minute: f64,
    burst: f64,
    buckets: std::collections::HashMap<String, (f64, f64)>,
}

impl Default for Quota {
    fn default() -> Self {
        Quota { per_minute: 240.0, burst: 60.0, buckets: Default::default() }
    }
}

impl Quota {
    /// `0` when the call may proceed, else the seconds to wait.
    pub fn take(&mut self, key: &str, now: f64) -> u64 {
        let rate = self.per_minute / 60_000.0;
        let bucket = self.buckets.entry(key.to_string()).or_insert((self.burst, now));
        bucket.0 = self.burst.min(bucket.0 + (now - bucket.1) * rate);
        bucket.1 = now;
        if bucket.0 >= 1.0 {
            bucket.0 -= 1.0;
            return 0;
        }
        (((1.0 - bucket.0) / rate / 1000.0).ceil()).max(1.0) as u64
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sessions_follow_their_token() {
        let mut s = Sessions::default();
        let a = s.open("k", "2025-06-18", None, 0.0);
        assert!(s.find(&a.id, "other", 1.0).is_none());
        assert!(s.find(&a.id, "k", 2.0).is_some());
        assert!(s.find(&a.id, "k", 2.0 + SESSION_IDLE_MS + 1.0).is_none());
        assert!(s.find(&a.id, "k", 3.0).is_none(), "an idle session is gone for good");
        let first = s.open("k", "v", None, 10.0);
        for i in 0..16 {
            s.open("k", "v", None, 11.0 + f64::from(i));
        }
        assert!(s.find(&first.id, "k", 100.0).is_none(), "the oldest went");
        s.close_token("k");
        assert_eq!(s.sessions.len(), 0);
    }

    #[test]
    fn quota_is_a_bucket() {
        let mut q = Quota::default();
        for _ in 0..60 {
            assert_eq!(q.take("k", 0.0), 0);
        }
        assert_eq!(q.take("k", 0.0), 1);
        assert_eq!(q.take("k", 250.0), 0);
        assert_eq!(q.take("other", 0.0), 0);
    }
}
