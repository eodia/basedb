//! La limitation de débit de `/auth/*`, telle `apps/api/src/rate-limit.ts` (chapitre 13 §6) :
//! dix tentatives par minute et par adresse, une attente qui s'allonge après une SÉRIE
//! d'échecs, effacée par un succès, et des entrées oubliées quand elles dorment.
//!
//! Le seau est en mémoire, par processus : deux instances derrière un même répartiteur
//! comptent chacune de leur côté, comme deux processus Node.

use std::collections::HashMap;
use std::sync::Mutex;

pub const ATTEMPTS: u32 = 10;
pub const WINDOW_MS: i64 = 60_000;
const MAX_PENALTY_STEPS: u32 = 4;
const FAILURE_MEMORY_MS: i64 = 15 * 60_000;

#[derive(Debug, Clone)]
struct Entry {
    attempts: u32,
    window_started_at: i64,
    failures: u32,
    locked_until: i64,
}

/// `Verdict`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Verdict {
    pub allowed: bool,
    pub retry_after: i64,
}

#[derive(Debug, Default)]
struct Inner {
    entries: HashMap<String, Entry>,
    swept_at: i64,
}

/// `RateLimiter`.
#[derive(Debug)]
pub struct RateLimiter {
    attempts: u32,
    window_ms: i64,
    inner: Mutex<Inner>,
}

impl Default for RateLimiter {
    fn default() -> Self {
        RateLimiter::new(ATTEMPTS, WINDOW_MS)
    }
}

fn ceil_seconds(ms: i64) -> i64 {
    (ms + 999).div_euclid(1000)
}

impl RateLimiter {
    pub fn new(attempts: u32, window_ms: i64) -> Self {
        RateLimiter { attempts, window_ms, inner: Mutex::new(Inner::default()) }
    }

    /// `check(key, now)`.
    pub fn check(&self, key: &str, now: i64) -> Verdict {
        let mut inner = self.inner.lock().unwrap();
        self.sweep(&mut inner, now);
        let entry = inner.entries.entry(key.to_string()).or_insert(Entry { attempts: 0, window_started_at: now, failures: 0, locked_until: 0 });
        if entry.locked_until > now {
            return Verdict { allowed: false, retry_after: ceil_seconds(entry.locked_until - now) };
        }
        if now - entry.window_started_at >= self.window_ms {
            entry.attempts = 0;
            entry.window_started_at = now;
        }
        entry.attempts += 1;
        if entry.attempts > self.attempts {
            let step = (entry.failures / self.attempts).min(MAX_PENALTY_STEPS);
            entry.locked_until = now + self.window_ms * 2i64.pow(step);
            return Verdict { allowed: false, retry_after: ceil_seconds(entry.locked_until - now) };
        }
        Verdict { allowed: true, retry_after: 0 }
    }

    /// `failed(key)`.
    pub fn failed(&self, key: &str) {
        if let Some(e) = self.inner.lock().unwrap().entries.get_mut(key) {
            e.failures += 1;
        }
    }

    /// `succeeded(key)`.
    pub fn succeeded(&self, key: &str) {
        self.inner.lock().unwrap().entries.remove(key);
    }

    fn sweep(&self, inner: &mut Inner, now: i64) {
        if now - inner.swept_at < self.window_ms {
            return;
        }
        inner.swept_at = now;
        let window = self.window_ms;
        inner.entries.retain(|_, e| {
            let horizon = if e.failures > 0 { FAILURE_MEMORY_MS } else { 2 * window };
            let idle = now - e.window_started_at > horizon;
            !(idle && e.locked_until <= now)
        });
    }

    pub fn size(&self) -> usize {
        self.inner.lock().unwrap().entries.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ten_a_minute_then_refused() {
        let l = RateLimiter::default();
        for _ in 0..ATTEMPTS {
            assert!(l.check("192.0.2.1", 1000).allowed);
        }
        let refused = l.check("192.0.2.1", 1000);
        assert!(!refused.allowed && refused.retry_after > 0);
    }

    #[test]
    fn fresh_window_after_a_minute() {
        let l = RateLimiter::default();
        for _ in 0..ATTEMPTS {
            l.check("192.0.2.2", 1000);
        }
        assert!(l.check("192.0.2.2", 1000 + WINDOW_MS + 1).allowed);
    }

    #[test]
    fn each_address_separately() {
        let l = RateLimiter::default();
        for _ in 0..=ATTEMPTS {
            l.check("192.0.2.3", 1000);
        }
        assert!(l.check("192.0.2.4", 1000).allowed);
    }

    #[test]
    fn longer_wait_after_a_run_of_failures() {
        let l = RateLimiter::default();
        let sweep = |start: i64| {
            for _ in 0..ATTEMPTS {
                l.check("192.0.2.5", start);
                l.failed("192.0.2.5");
            }
            l.check("192.0.2.5", start)
        };
        let first = sweep(1000);
        let second = sweep(1000 + 5 * WINDOW_MS);
        assert!(!first.allowed && !second.allowed);
        assert!(second.retry_after > first.retry_after);
    }

    #[test]
    fn success_clears_the_run() {
        let l = RateLimiter::default();
        for _ in 0..3 {
            l.check("192.0.2.6", 1000);
            l.failed("192.0.2.6");
        }
        l.succeeded("192.0.2.6");
        for _ in 0..ATTEMPTS {
            assert!(l.check("192.0.2.6", 1000).allowed);
        }
    }

    #[test]
    fn does_not_grow_forever() {
        let l = RateLimiter::default();
        for i in 0..500 {
            l.check(&format!("10.0.0.{i}"), 1000);
        }
        assert_eq!(l.size(), 500);
        l.check("10.1.0.1", 1000 + 3 * WINDOW_MS);
        assert_eq!(l.size(), 1);
    }

    #[test]
    fn remembers_failures_longer() {
        let l = RateLimiter::default();
        l.check("192.0.2.8", 1000);
        l.failed("192.0.2.8");
        l.check("192.0.2.9", 1000);
        l.check("10.3.0.1", 1000 + 3 * WINDOW_MS);
        assert_eq!(l.size(), 2);
    }

    #[test]
    fn keeps_a_locked_address_while_sweeping() {
        let l = RateLimiter::default();
        for _ in 0..=ATTEMPTS {
            l.check("192.0.2.7", 1000);
        }
        l.check("10.2.0.1", 1000 + WINDOW_MS / 2);
        assert!(!l.check("192.0.2.7", 1000 + WINDOW_MS / 2).allowed);
    }
}
