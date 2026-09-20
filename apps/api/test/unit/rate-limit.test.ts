import { describe, expect, it } from 'vitest'
import { ATTEMPTS, RateLimiter, WINDOW_MS } from '../../src/rate-limit.js'

/**
 * Rate limiting on `/auth/*` — chapter 13 §6.
 *
 * What is checked here is as much what this bucket DOES NOT do. It is approximate with
 * several instances, it is not what stops targeted credential stuffing — the row lockout
 * of §2.4 is — and it must not punish someone who mistyped their password twice.
 */

describe('RateLimiter', () => {
  it('lets ten attempts a minute through, and refuses the eleventh', () => {
    const limiter = new RateLimiter()
    for (let i = 0; i < ATTEMPTS; i++) {
      expect(limiter.check('192.0.2.1', 1000).allowed).toBe(true)
    }
    const refused = limiter.check('192.0.2.1', 1000)
    expect(refused.allowed).toBe(false)
    // `Retry-After` is what tells an honest client when to come back.
    expect(refused.retryAfter).toBeGreaterThan(0)
  })

  it('starts a fresh window once the minute has passed', () => {
    const limiter = new RateLimiter()
    for (let i = 0; i < ATTEMPTS; i++) limiter.check('192.0.2.2', 1000)
    expect(limiter.check('192.0.2.2', 1000 + WINDOW_MS + 1).allowed).toBe(true)
  })

  it('counts each address separately', () => {
    const limiter = new RateLimiter()
    for (let i = 0; i < ATTEMPTS + 1; i++) limiter.check('192.0.2.3', 1000)
    expect(limiter.check('192.0.2.4', 1000).allowed).toBe(true)
  })

  it('makes the wait longer after a RUN of failures', () => {
    const limiter = new RateLimiter()
    const sweep = (start: number) => {
      for (let i = 0; i < ATTEMPTS; i++) {
        limiter.check('192.0.2.5', start)
        limiter.failed('192.0.2.5')
      }
      return limiter.check('192.0.2.5', start)
    }

    const first = sweep(1000)
    // Well past the lock, but well inside the memory of the run: a sweeper who pauses
    // between bursts is still sweeping.
    const second = sweep(1000 + 5 * WINDOW_MS)
    expect(first.allowed).toBe(false)
    expect(second.allowed).toBe(false)
    // Ten more failures, so the penalty moves to its next step.
    expect(second.retryAfter).toBeGreaterThan(first.retryAfter)
  })

  it('clears the run on a success: it punishes a sweep, not a forgetful user', () => {
    const limiter = new RateLimiter()
    for (let i = 0; i < 3; i++) {
      limiter.check('192.0.2.6', 1000)
      limiter.failed('192.0.2.6')
    }
    limiter.succeeded('192.0.2.6')

    // Everything about that address is forgotten, counter included.
    for (let i = 0; i < ATTEMPTS; i++) {
      expect(limiter.check('192.0.2.6', 1000).allowed).toBe(true)
    }
  })

  it('does not grow with every address ever seen', () => {
    // A slow leak in a process meant to run for months is still a leak.
    const limiter = new RateLimiter()
    for (let i = 0; i < 500; i++) limiter.check(`10.0.0.${i}`, 1000)
    expect(limiter.size).toBe(500)

    // One call past two windows sweeps the idle ones — none of them ever failed.
    limiter.check('10.1.0.1', 1000 + 3 * WINDOW_MS)
    expect(limiter.size).toBe(1)
  })

  it('remembers a run of failures far longer than a clean address', () => {
    const limiter = new RateLimiter()
    limiter.check('192.0.2.8', 1000)
    limiter.failed('192.0.2.8')
    limiter.check('192.0.2.9', 1000)

    // Three windows on: the clean address is gone, the failing one is kept.
    limiter.check('10.3.0.1', 1000 + 3 * WINDOW_MS)
    expect(limiter.size).toBe(2)
  })

  it('keeps a locked address even while sweeping', () => {
    const limiter = new RateLimiter()
    for (let i = 0; i < ATTEMPTS + 1; i++) limiter.check('192.0.2.7', 1000)
    // Just inside the lock: forgetting it here would hand the sweeper a clean slate.
    limiter.check('10.2.0.1', 1000 + WINDOW_MS / 2)
    expect(limiter.check('192.0.2.7', 1000 + WINDOW_MS / 2).allowed).toBe(false)
  })
})
