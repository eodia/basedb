#!/usr/bin/env node
import { createInterface } from 'node:readline'

/**
 * The stdio relay — chapter 09 §1.2 and §9.
 *
 * A thin binary on the user's workstation, launched by the MCP client: it reads the
 * client's JSON-RPC messages on stdin, one per line, carries each to `POST /mcp` on the
 * basedb back end, and writes the answers on stdout. It holds no state beyond the
 * session the back end assigned, and signs nothing: it transports a secret it did not
 * make, so it cannot forge an identity it was not given (§9.3, rule 4).
 *
 *   node apps/mcp/dist/relay.js --url https://basedb.example/mcp
 *
 * The token is read from an ENVIRONMENT VARIABLE — `BASEDB_MCP_TOKEN` unless
 * `--token-env` names another — never from the client's configuration file, which is
 * versioned, synced and readable by every process of the session (§9.2). It is never
 * written to stdout or stderr, whatever happens.
 */

interface Options {
  readonly url: string
  readonly tokenEnv: string
}

function parseArgs(argv: readonly string[]): Options {
  let url = process.env.BASEDB_MCP_URL ?? 'http://localhost:8788/mcp'
  let tokenEnv = 'BASEDB_MCP_TOKEN'
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = argv[i + 1]
    if (arg === '--url' && next !== undefined) {
      url = next
      i++
    } else if (arg === '--token-env' && next !== undefined) {
      tokenEnv = next
      i++
    } else if (arg === '--help' || arg === '-h') {
      process.stderr.write(
        'Usage : basedb-mcp [--url <origine>/mcp] [--token-env <VARIABLE>]\n' +
          'Le jeton est lu dans la variable d’environnement BASEDB_MCP_TOKEN (ou celle nommée).\n',
      )
      process.exit(0)
    }
  }
  return { url, tokenEnv }
}

const options = parseArgs(process.argv.slice(2))
const token = process.env[options.tokenEnv]
if (token === undefined || token.trim() === '') {
  process.stderr.write(
    `basedb-mcp : la variable d’environnement ${options.tokenEnv} ne contient aucun jeton.\n`,
  )
  process.exit(1)
}

const target = new URL(options.url)
if (
  target.protocol !== 'https:' &&
  !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
) {
  // The token travels in every request: over plain HTTP, to anything but this machine,
  // it travels in clear.
  process.stderr.write('basedb-mcp : attention, le jeton transite en clair (URL non HTTPS).\n')
}

type Message = {
  readonly jsonrpc?: unknown
  readonly id?: unknown
  readonly method?: unknown
  readonly params?: unknown
  readonly result?: unknown
}

/** What the back end assigned at the handshake, and what it takes to redo it. */
let sessionId: string | undefined
let protocolVersion: string | undefined
let handshake: { readonly params: unknown } | undefined
let renewing: Promise<void> | null = null
let internalIds = 0

const write = (message: unknown) => {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

const isRequest = (m: Message) =>
  (typeof m.id === 'string' || typeof m.id === 'number') && typeof m.method === 'string'

const unreachable = (id: unknown) =>
  write({
    jsonrpc: '2.0',
    id,
    // No body, no URL, no internal identifier relayed: the client learns that the back
    // end did not answer, and nothing about it (§14.4).
    error: { code: -32000, message: 'Le serveur basedb est injoignable.' },
  })

/** One message to the back end, and the messages it answered with. */
async function post(
  message: Message,
): Promise<{ status: number; messages: Message[]; session?: string }> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    authorization: `Bearer ${token}`,
  }
  if (sessionId !== undefined && message.method !== 'initialize')
    headers['mcp-session-id'] = sessionId
  if (protocolVersion !== undefined && message.method !== 'initialize') {
    headers['mcp-protocol-version'] = protocolVersion
  }

  const response = await fetch(target, { method: 'POST', headers, body: JSON.stringify(message) })
  const session = response.headers.get('mcp-session-id') ?? undefined
  if (response.status === 202) return { status: 202, messages: [], session }

  const text = await response.text()
  const type = response.headers.get('content-type') ?? ''
  const messages: Message[] = []
  const take = (payload: string) => {
    try {
      const parsed = JSON.parse(payload) as Message | Message[]
      messages.push(...(Array.isArray(parsed) ? parsed : [parsed]))
    } catch {
      // Not JSON: nothing of it is relayed.
    }
  }
  if (type.includes('text/event-stream')) {
    for (const event of text.split(/\r?\n\r?\n/)) {
      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n')
      if (data !== '') take(data)
    }
  } else if (text !== '') {
    take(text)
  }
  return { status: response.status, messages, session }
}

/**
 * Replays the handshake after the back end closed an idle session (§9.4). Over stdio
 * the client has no notion of an HTTP session and would never replay it itself.
 */
function renew(): Promise<void> {
  if (renewing !== null) return renewing
  renewing = (async () => {
    if (handshake === undefined) return
    sessionId = undefined
    internalIds += 1
    const answer = await post({
      jsonrpc: '2.0',
      id: `basedb-relay-${internalIds}`,
      method: 'initialize',
      params: handshake.params,
    })
    sessionId = answer.session
    const negotiated = (answer.messages[0]?.result as { protocolVersion?: unknown } | undefined)
      ?.protocolVersion
    if (typeof negotiated === 'string') protocolVersion = negotiated
    await post({ jsonrpc: '2.0', method: 'notifications/initialized' })
  })().finally(() => {
    renewing = null
  })
  return renewing
}

async function forward(message: Message): Promise<void> {
  try {
    let answer = await post(message)
    if (answer.status === 404 && message.method !== 'initialize' && handshake !== undefined) {
      await renew()
      answer = await post(message)
    }
    if (message.method === 'initialize') {
      sessionId = answer.session
      handshake = { params: message.params }
      const negotiated = (answer.messages[0]?.result as { protocolVersion?: unknown } | undefined)
        ?.protocolVersion
      if (typeof negotiated === 'string') protocolVersion = negotiated
    }
    for (const m of answer.messages) write(m)
    if (isRequest(message) && answer.messages.length === 0 && answer.status >= 400) {
      write({
        jsonrpc: '2.0',
        id: message.id,
        error: { code: -32000, message: 'Le serveur basedb a refusé la requête.' },
      })
    }
  } catch {
    if (isRequest(message)) unreachable(message.id)
    else process.stderr.write('basedb-mcp : un message n’a pas pu être transmis.\n')
  }
}

// Four requests in flight at most, as the back end allows per session (§9.4); the
// handshake passes alone, and everything after it waits for its session.
const MAX_IN_FLIGHT = 4
let inFlight = 0
const waiting: Array<() => void> = []
let gate: Promise<void> = Promise.resolve()
const pending = new Set<Promise<void>>()

const acquire = async () => {
  if (inFlight >= MAX_IN_FLIGHT) await new Promise<void>((resolve) => waiting.push(resolve))
  inFlight += 1
}
const release = () => {
  inFlight -= 1
  waiting.shift()?.()
}
const track = (work: Promise<void>) => {
  pending.add(work)
  void work.finally(() => pending.delete(work))
}

const input = createInterface({ input: process.stdin, crlfDelay: Number.POSITIVE_INFINITY })

input.on('line', (line) => {
  if (line.trim() === '') return
  let message: Message
  try {
    message = JSON.parse(line) as Message
  } catch {
    write({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Le message n’est pas du JSON valide.' },
    })
    return
  }
  if (message.method === 'initialize') {
    gate = gate.then(() => forward(message))
    track(gate)
    return
  }
  track(
    gate.then(async () => {
      await acquire()
      try {
        await forward(message)
      } finally {
        release()
      }
    }),
  )
})

input.on('close', async () => {
  await Promise.allSettled([...pending])
  // The session is closed on the back end rather than left to idle out.
  if (sessionId !== undefined) {
    await fetch(target, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}`, 'mcp-session-id': sessionId },
    }).catch(() => undefined)
  }
  process.exit(0)
})
