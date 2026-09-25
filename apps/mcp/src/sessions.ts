import { randomUUID } from 'node:crypto'

/**
 * Agent sessions and quotas — chapter 09 §9.4 and §11.4.
 *
 * In process memory, and nowhere else: approximate across several instances, which A4
 * assumes. A session proves nothing by itself — the token is revalidated at EVERY
 * message — it only carries what the handshake settled: the protocol revision, the
 * client's declared name, and the requests in flight.
 */

/** §9.4: a session idle this long is closed; the client replays `initialize`. */
export const SESSION_IDLE_MS = 30 * 60_000
/** §9.4: requests in flight per session. */
export const MAX_IN_FLIGHT = 4
/** Sessions kept per token: the oldest goes when a client opens one too many. */
const SESSIONS_PER_TOKEN = 16

export interface Session {
  readonly id: string
  /** The token the session was opened with — a digest of its secret, never the secret. */
  readonly tokenKey: string
  readonly protocolVersion: string
  /** `clientInfo`, as declared: logged with `verified: false`, trusted by nothing (§9.3). */
  readonly client: { readonly name?: unknown; readonly version?: unknown } | null
  lastSeen: number
  inFlight: number
}

export class Sessions {
  private readonly sessions = new Map<string, Session>()

  open(tokenKey: string, protocolVersion: string, client: Session['client'], now: number): Session {
    this.sweep(now)
    const mine = [...this.sessions.values()].filter((s) => s.tokenKey === tokenKey)
    if (mine.length >= SESSIONS_PER_TOKEN) {
      const oldest = mine.sort((a, b) => a.lastSeen - b.lastSeen)[0]
      if (oldest !== undefined) this.sessions.delete(oldest.id)
    }
    const session: Session = {
      id: randomUUID(),
      tokenKey,
      protocolVersion,
      client,
      lastSeen: now,
      inFlight: 0,
    }
    this.sessions.set(session.id, session)
    return session
  }

  /**
   * The session a message names — or `null` when it is unknown, idle past its bound, or
   * opened with ANOTHER token. The three answer alike: a session id is not a credential,
   * and holding one proves nothing about the token presented with it.
   */
  find(id: string, tokenKey: string, now: number): Session | null {
    const session = this.sessions.get(id)
    if (session === undefined) return null
    if (now - session.lastSeen > SESSION_IDLE_MS) {
      this.sessions.delete(id)
      return null
    }
    if (session.tokenKey !== tokenKey) return null
    session.lastSeen = now
    return session
  }

  close(id: string): void {
    this.sessions.delete(id)
  }

  /** A token that stopped being valid closes every session it opened (§9.4). */
  closeToken(tokenKey: string): void {
    for (const [id, session] of this.sessions) {
      if (session.tokenKey === tokenKey) this.sessions.delete(id)
    }
  }

  private sweep(now: number): void {
    for (const [id, session] of this.sessions) {
      if (now - session.lastSeen > SESSION_IDLE_MS) this.sessions.delete(id)
    }
  }

  get size(): number {
    return this.sessions.size
  }
}

/**
 * Calls per token and per minute — §11.4, a token bucket in memory.
 *
 * The check precedes every resolution of an object and names none: a refusal here says
 * nothing about the catalog.
 */
export class Quota {
  private readonly buckets = new Map<string, { tokens: number; at: number }>()

  constructor(
    private readonly perMinute: number = 240,
    private readonly burst: number = 60,
  ) {}

  /** `0` when the call may proceed, else the seconds to wait. */
  take(key: string, now: number): number {
    const rate = this.perMinute / 60_000
    const bucket = this.buckets.get(key) ?? { tokens: this.burst, at: now }
    bucket.tokens = Math.min(this.burst, bucket.tokens + (now - bucket.at) * rate)
    bucket.at = now
    this.buckets.set(key, bucket)
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1
      return 0
    }
    return Math.max(1, Math.ceil((1 - bucket.tokens) / rate / 1000))
  }

  get limits(): { readonly calls_per_minute: number; readonly burst: number } {
    return { calls_per_minute: this.perMinute, burst: this.burst }
  }
}
