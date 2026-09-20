/**
 * Rate limiting on `/auth/*` — chapter 13 §6, and A4.
 *
 * IN PROCESS MEMORY, and nowhere else: no counter is kept in the database. That makes it
 * APPROXIMATE across several application instances, and the chapter says so plainly —
 * which is why it is not what defends against targeted credential stuffing. The lockout
 * of §2.4 does that, and it is exact because it is a row.
 *
 * What this buys instead is cheap: it blunts a broad sweep from one address before it
 * reaches argon2id, which costs 64 MiB and some 60 ms per attempt. Without it, ten
 * requests a second from one host would be a denial of service against the whole
 * instance, not merely against one account.
 */

/** §6 — ten attempts a minute on the routes with no bearer. */
export const ATTEMPTS = 10
export const WINDOW_MS = 60_000

/** After a run of failures, the wait doubles: 1, 2, 4, 8 minutes, then it stops there. */
const MAX_PENALTY_STEPS = 4

/**
 * How long a run of failures is remembered, beyond the counting window.
 *
 * Much longer than the window on purpose: a run with pauses in it is still a run, and
 * forgetting it after two idle minutes would hand a patient sweeper a clean slate every
 * time. An address that has never failed is forgotten far sooner.
 */
const FAILURE_MEMORY_MS = 15 * 60_000

interface Entry {
  /** Attempts inside the current window. */
  attempts: number
  windowStartedAt: number
  /** Consecutive failures, which drive the penalty. */
  failures: number
  /** Locked until this instant, 0 when free. */
  lockedUntil: number
}

export interface Verdict {
  readonly allowed: boolean
  /** Seconds to put in `Retry-After`. Zero when allowed. */
  readonly retryAfter: number
}

export class RateLimiter {
  private readonly entries = new Map<string, Entry>()
  private sweptAt = 0

  constructor(
    private readonly attempts: number = ATTEMPTS,
    private readonly windowMs: number = WINDOW_MS,
  ) {}

  /** Counts one attempt, and says whether it may proceed. */
  check(key: string, now: number): Verdict {
    this.sweep(now)

    const entry = this.entries.get(key) ?? {
      attempts: 0,
      windowStartedAt: now,
      failures: 0,
      lockedUntil: 0,
    }
    this.entries.set(key, entry)

    if (entry.lockedUntil > now) {
      return { allowed: false, retryAfter: Math.ceil((entry.lockedUntil - now) / 1000) }
    }

    if (now - entry.windowStartedAt >= this.windowMs) {
      entry.attempts = 0
      entry.windowStartedAt = now
    }

    entry.attempts += 1
    if (entry.attempts > this.attempts) {
      const step = Math.min(Math.floor(entry.failures / this.attempts), MAX_PENALTY_STEPS)
      entry.lockedUntil = now + this.windowMs * 2 ** step
      return { allowed: false, retryAfter: Math.ceil((entry.lockedUntil - now) / 1000) }
    }

    return { allowed: true, retryAfter: 0 }
  }

  /** Records a failed attempt, which is what makes the next penalty longer. */
  failed(key: string): void {
    const entry = this.entries.get(key)
    if (entry !== undefined) entry.failures += 1
  }

  /** A success clears the run: the penalty punishes a sweep, not a forgetful user. */
  succeeded(key: string): void {
    this.entries.delete(key)
  }

  /**
   * Drops entries nobody has touched for two windows.
   *
   * Without this the map grows with every address ever seen, which is a slow leak in a
   * process meant to run for months. Swept at most once a window: walking it on every
   * request would cost more than it saves.
   */
  private sweep(now: number): void {
    if (now - this.sweptAt < this.windowMs) return
    this.sweptAt = now
    for (const [key, entry] of this.entries) {
      const horizon = entry.failures > 0 ? FAILURE_MEMORY_MS : 2 * this.windowMs
      const idle = now - entry.windowStartedAt > horizon
      if (idle && entry.lockedUntil <= now) this.entries.delete(key)
    }
  }

  /** For the tests. */
  get size(): number {
    return this.entries.size
  }
}
