import { Client } from 'pg'
import { startupOptions } from './pool.js'

/**
 * The listening connection — chapter 10 §3.1: one per instance, outside the pools, that
 * never holds a transaction. It hears the channels the instance cares about and hands
 * each notification to whoever subscribed to its channel.
 *
 * A dropped connection is opened again after a growing delay (1 s, 2 s… up to 30 s):
 * nothing depends on a notification arriving — the drain polls anyway, and a missed live
 * signal only delays a refresh (chapter 16 §3.1).
 */

export type NotificationHandler = (payload: string) => void

export class Listener {
  private client: Client | null = null
  private readonly handlers = new Map<string, Set<NotificationHandler>>()
  private stopped = false
  private delay = 1_000
  private timer: NodeJS.Timeout | null = null

  constructor(
    private readonly connectionString: string,
    private readonly channels: readonly string[],
    private readonly onError: (error: unknown) => void,
  ) {}

  /** Whether the connection is up and listening — what `/readyz` reports. */
  get ready(): boolean {
    return this.client !== null
  }

  /** Subscribes to a channel; returns the unsubscription. */
  on(channel: string, handler: NotificationHandler): () => void {
    let set = this.handlers.get(channel)
    if (set === undefined) {
      set = new Set()
      this.handlers.set(channel, set)
    }
    set.add(handler)
    return () => set?.delete(handler)
  }

  async start(): Promise<void> {
    this.stopped = false
    await this.connect()
  }

  async stop(): Promise<void> {
    this.stopped = true
    if (this.timer !== null) clearTimeout(this.timer)
    const client = this.client
    this.client = null
    await client?.end().catch(() => undefined)
  }

  private async connect(): Promise<void> {
    if (this.stopped) return
    const client = new Client({
      connectionString: this.connectionString,
      options: startupOptions(),
      application_name: 'basedb:listen',
      keepAlive: true,
      keepAliveInitialDelayMillis: 30_000,
    })
    const retry = (error: unknown) => {
      if (this.client === client) this.client = null
      client.removeAllListeners()
      client.end().catch(() => undefined)
      if (this.stopped) return
      this.onError(error)
      this.timer = setTimeout(() => void this.connect(), this.delay)
      this.delay = Math.min(this.delay * 2, 30_000)
    }
    client.on('error', retry)
    client.on('end', () => retry(new Error('listening connection closed')))
    client.on('notification', (message) => {
      for (const handler of this.handlers.get(message.channel) ?? []) {
        try {
          handler(message.payload ?? '')
        } catch (error) {
          this.onError(error)
        }
      }
    })
    try {
      await client.connect()
      for (const channel of this.channels) {
        // A channel is an identifier: the names are the kernel's own, never an input.
        await client.query(`LISTEN ${channel}`)
      }
      this.client = client
      this.delay = 1_000
    } catch (error) {
      retry(error)
    }
  }
}
