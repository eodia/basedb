import { catalogMigrations } from '@basedb/catalog-schema'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ProviderTransport } from '../../src/ai/draft.js'
import {
  aiFieldStatus,
  disableAiField,
  requestAiSweep,
  runAiCell,
  setAiField,
  startAiWorker,
} from '../../src/ai/field.js'
import { addField, setFieldRequired } from '../../src/catalog/fields.js'
import { createBase, createTable } from '../../src/catalog/operations.js'
import type { BasedbError } from '../../src/errors/index.js'
import { createRecord } from '../../src/records/create.js'
import { deleteRecord, updateRecord } from '../../src/records/update.js'
import { Pools } from '../../src/runtime/pool.js'
import { type RequestContext, sealContext } from '../../src/tx/context.js'

/**
 * The AI field against a real database — chapter 12 §9.
 *
 * The provider is a fake that answers from what it was sent, so every test reads, in the
 * value written, the prompt the kernel built: the right columns, in the right row, read
 * as a person reads them.
 */

const TENANT_REF = 't4z56fq'

let container: StartedPostgreSqlContainer
let pools: Pools
let ctx: RequestContext
let tableId: string
let relation: string

/** What the fake provider was asked, in order. */
const calls: string[] = []
/** The expected formats it was told, in the same order (`undefined`: free text). */
const formats: Array<string | undefined> = []
let failing = false
/** When set, the provider answers this, whatever it was asked. */
let answer: string | null = null

const transport: ProviderTransport = async (request) => {
  if (failing) throw new Error('fournisseur injoignable')
  const instruction = String(request.payload.instruction)
  calls.push(instruction)
  formats.push(
    typeof request.payload.expected_format === 'string'
      ? request.payload.expected_format
      : undefined,
  )
  return {
    text: JSON.stringify({ value: answer ?? `IA: ${instruction}` }),
    inputTokens: 10,
    outputTokens: 5,
  }
}

async function failure(promise: Promise<unknown>): Promise<BasedbError> {
  try {
    await promise
  } catch (e) {
    return e as BasedbError
  }
  throw new Error('aucun refus')
}

async function cells(column: string): Promise<Array<{ nom: string; value: string | null }>> {
  return pools.withConnection('data', (exec) =>
    exec.query<{ nom: string; value: string | null }>(
      `SELECT nom, "${column}" AS value FROM ${relation} ORDER BY nom`,
    ),
  )
}

async function idOf(nom: string): Promise<string> {
  const [row] = await pools.withConnection('data', (exec) =>
    exec.query<{ _id: string }>(`SELECT "_id" FROM ${relation} WHERE nom = $1`, [nom]),
  )
  return row._id
}

async function config(fieldId: string) {
  const [row] = await pools.withConnection('catalog', (exec) =>
    exec.query<{
      next_sweep_at: Date | null
      sweep_after: string | null
      last_error: string | null
      computed_count: string
    }>(
      `SELECT next_sweep_at, sweep_after, last_error, computed_count
         FROM _basedb.field_ai_config WHERE field_id = $1`,
      [fieldId],
    ),
  )
  return row
}

const worker = () => startAiWorker(pools, transport, { intervalMs: 3_600_000, perField: 50 })

beforeAll(async () => {
  process.env.BASEDB_AI_PROVIDER = 'anthropic'
  process.env.BASEDB_AI_MODEL = 'modele-de-test'
  process.env.BASEDB_AI_API_KEY = 'cle-de-test'

  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  pools = new Pools({ connectionString: container.getConnectionUri() })
  await pools.withConnection('ddl', async (exec) => {
    for (const m of catalogMigrations()) await exec.query(m.sql, [], 'ddl')
    // The journal is partitioned and ships with none: the calls are counted in it.
    const now = new Date()
    for (let offset = -1; offset <= 1; offset++) {
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1))
      const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 1))
      await exec.query(
        `CREATE TABLE _basedb.ai_call_${offset + 1} PARTITION OF _basedb.ai_call
           FOR VALUES FROM ('${from.toISOString()}') TO ('${to.toISOString()}')`,
        [],
        'ddl',
      )
    }
  })
  const bootstrap = await pools.withConnection('catalog', async (exec) => {
    await exec.query('BEGIN')
    const [t] = await exec.query<{ id: string; created_by: string }>(
      `INSERT INTO _basedb.tenant (ref, label, is_system, created_by)
       VALUES ($1, 'Bootstrap', true, _basedb_local.uuid_generate_v7())
       RETURNING id, created_by`,
      [TENANT_REF],
      'insert',
    )
    await exec.query(
      `INSERT INTO _basedb.app_user
         (id, tenant_id, email, display_name, is_system, is_instance_admin, created_by, updated_by)
       VALUES ($1, $2, 'bootstrap@basedb.local', 'Bootstrap', true, true, $1, $1)`,
      [t.created_by, t.id],
      'insert',
    )
    await exec.query('COMMIT')
    return t
  })
  const now = new Date()
  ctx = sealContext({
    requestId: '018f3c2a-0000-7000-8000-00000000009a',
    actor: { kind: 'user', id: bootstrap.created_by },
    tenantId: TENANT_REF,
    surface: 'rest',
    timestamp: now,
    deadline: new Date(now.getTime() + 300_000),
    permissions: { version: '1', rowPredicate: 'TRUE' },
  })

  const base = await createBase(pools, ctx, { label: 'Chantiers' })
  const table = await createTable(pools, ctx, {
    baseId: base.baseId,
    label: 'Visites',
    fields: [
      { label: 'Nom', kind: 'short_text' },
      { label: 'Notes', kind: 'long_text' },
    ],
  })
  tableId = table.tableId
  relation = `"${base.schemaName}"."${table.tableName}"`
  await addField(pools, ctx, {
    tableId,
    label: 'Statut',
    kind: 'select',
    options: [{ value: 'urgent', label: 'Urgent' }, { value: 'calme' }],
  })
  await createRecord(pools, ctx, {
    tableId,
    values: { nom: 'Alpha', notes: 'Fuite sous l’évier', statut: 'urgent' },
  })
  await createRecord(pools, ctx, { tableId, values: { nom: 'Bravo', notes: 'Porte qui grince' } })
}, 180_000)

afterAll(async () => {
  Reflect.deleteProperty(process.env, 'BASEDB_AI_PROVIDER')
  Reflect.deleteProperty(process.env, 'BASEDB_AI_MODEL')
  Reflect.deleteProperty(process.env, 'BASEDB_AI_API_KEY')
  await pools?.end()
  await container?.stop()
})

describe('creating an AI field', () => {
  it('asks for consent, and a prompt citing columns that exist', async () => {
    const prompt = { prompt: 'Résume {{Notes}}', refresh: { mode: 'if_empty' as const } }
    expect(
      (
        await failure(
          addField(pools, ctx, { tableId, label: 'Sans accord', kind: 'short_text', ai: prompt }),
        )
      ).code,
    ).toBe('AI_CONSENT_REQUIRED')

    const unknown = await failure(
      addField(pools, ctx, {
        tableId,
        label: 'Inconnue',
        kind: 'short_text',
        ai: { ...prompt, prompt: 'Résume {{Adresse}}', consent: true },
      }),
    )
    expect(unknown.details).toMatchObject({ reason: 'variable_inconnue', variable: 'Adresse' })

    const circular = await failure(
      addField(pools, ctx, {
        tableId,
        label: 'Boucle',
        kind: 'short_text',
        ai: { ...prompt, prompt: 'Reprends {{Boucle}}', consent: true },
      }),
    )
    expect(circular.details?.reason).toBe('variable_circulaire')

    const tooOften = await failure(
      addField(pools, ctx, {
        tableId,
        label: 'Trop souvent',
        kind: 'short_text',
        ai: {
          prompt: 'Résume {{Notes}}',
          refresh: { mode: 'schedule', cron: '*/5 * * * *', timezone: 'Europe/Paris' },
          consent: true,
        },
      }),
    )
    expect(tooOften.details?.reason).toBe('frequence_trop_haute')

    // Nothing of the refused attempts was left behind: the column is created with its
    // configuration or not at all.
    const [left] = await pools.withConnection('catalog', (exec) =>
      exec.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM _basedb.field
          WHERE table_id = $1 AND label IN ('Sans accord', 'Inconnue', 'Boucle', 'Trop souvent')`,
        [tableId],
      ),
    )
    expect(left.n).toBe('0')
  })

  it('is refused while AI is off', async () => {
    const provider = process.env.BASEDB_AI_PROVIDER
    Reflect.deleteProperty(process.env, 'BASEDB_AI_PROVIDER')
    try {
      const off = await failure(
        addField(pools, ctx, {
          tableId,
          label: 'Éteinte',
          kind: 'short_text',
          ai: { prompt: 'Résume {{Notes}}', refresh: { mode: 'if_empty' }, consent: true },
        }),
      )
      expect(off.code).toBe('AI_DISABLED')
    } finally {
      process.env.BASEDB_AI_PROVIDER = provider
    }
  })
})

describe('the provider from the environment', () => {
  it('takes the key under the provider’s own name, MISTRAL_API_KEY', async () => {
    const saved = { ...process.env }
    process.env.BASEDB_AI_PROVIDER = 'mistral'
    process.env.BASEDB_AI_MODEL = 'mistral-small-latest'
    Reflect.deleteProperty(process.env, 'BASEDB_AI_API_KEY')
    try {
      const without = await failure(
        addField(pools, ctx, {
          tableId,
          label: 'Sans clé',
          kind: 'short_text',
          ai: { prompt: 'Résume {{Notes}}', refresh: { mode: 'if_empty' }, consent: true },
        }),
      )
      expect(without.code).toBe('AI_NOT_CONFIGURED')

      process.env.MISTRAL_API_KEY = 'cle-mistral-de-test'
      const field = await addField(pools, ctx, {
        tableId,
        label: 'Avec clé Mistral',
        kind: 'short_text',
        ai: { prompt: 'Résume {{Notes}}', refresh: { mode: 'if_empty' }, consent: true },
      })
      expect(field.kind).toBe('short_text')
      await pools.withConnection('ddl', (exec) =>
        exec.query(`ALTER TABLE ${relation} DROP COLUMN "${field.name}"`, [], 'ddl'),
      )
      await pools.withConnection('catalog', (exec) =>
        exec.query(
          'UPDATE _basedb.field SET is_live = false, deleted_at = now() WHERE id = $1',
          [field.fieldId],
          'update',
        ),
      )
    } finally {
      for (const key of [
        'BASEDB_AI_PROVIDER',
        'BASEDB_AI_MODEL',
        'BASEDB_AI_API_KEY',
        'MISTRAL_API_KEY',
      ]) {
        if (saved[key] === undefined) Reflect.deleteProperty(process.env, key)
        else process.env[key] = saved[key]
      }
    }
  })
})

describe('an AI field at work', () => {
  let fieldId: string
  let column: string

  it('is created with its prompt kept under physical names', async () => {
    const field = await addField(pools, ctx, {
      tableId,
      label: 'Résumé',
      kind: 'short_text',
      ai: {
        prompt: 'Résume {{ notes }} pour {{Nom}} ({{statut}}).',
        refresh: { mode: 'if_empty' },
        consent: true,
      },
    })
    fieldId = field.fieldId
    column = field.name
    expect(field.sql[0]).toMatch(/ADD COLUMN "resume" text NULL/)

    const status = await aiFieldStatus(pools, ctx, fieldId)
    expect(status).toMatchObject({
      prompt: 'Résume {{notes}} pour {{nom}} ({{statut}}).',
      refresh: { mode: 'if_empty', cron: null, timezone: null },
      nextSweepAt: null,
      sweeping: false,
      computedCount: 0,
    })
    expect(status.cited.map((c) => c.label)).toEqual(['Notes', 'Nom', 'Statut'])
  })

  it('is never written by a person', async () => {
    const [row] = await cells(column)
    const [alpha] = await pools.withConnection('data', (exec) =>
      exec.query<{ _id: string }>(`SELECT "_id" FROM ${relation} WHERE nom = $1`, [row.nom]),
    )
    const refused = await failure(
      updateRecord(pools, ctx, { tableId, recordId: alpha._id, values: { [column]: 'à la main' } }),
    )
    expect(refused.code).toBe('FIELD_NOT_WRITABLE')
    const created = await failure(
      createRecord(pools, ctx, { tableId, values: { nom: 'X', [column]: 'à la main' } }),
    )
    expect(created.code).toBe('FIELD_NOT_WRITABLE')
    // Nor required: nobody could give a new row its value.
    const required = await failure(setFieldRequired(pools, ctx, { fieldId, required: true }))
    expect(required.details?.reason).toBe('champ_ia')
  })

  it('fills the empty cells with the row’s values in the prompt, once', async () => {
    calls.length = 0
    const w = worker()
    try {
      expect(await w.pass()).toBe(2)
      expect(await cells(column)).toEqual([
        { nom: 'Alpha', value: 'IA: Résume Fuite sous l’évier pour Alpha (Urgent).' },
        { nom: 'Bravo', value: 'IA: Résume Porte qui grince pour Bravo ((vide)).' },
      ])
      // Filled: nothing left to do, nothing called.
      expect(await w.pass()).toBe(0)
      expect(calls).toHaveLength(2)

      // A new row is filled at the next pass.
      await createRecord(pools, ctx, { tableId, values: { nom: 'Charlie', notes: 'Volet' } })
      expect(await w.pass()).toBe(1)
      expect((await cells(column))[2].value).toBe('IA: Résume Volet pour Charlie ((vide)).')
    } finally {
      await w.stop()
    }
    const after = await config(fieldId)
    expect(Number(after.computed_count)).toBe(3)
    expect(after.last_error).toBeNull()

    // Every call is journaled, as the kernel's.
    const [journal] = await pools.withConnection('catalog', (exec) =>
      exec.query<{ n: string; surfaces: string[] }>(
        `SELECT count(*)::text AS n, array_agg(DISTINCT surface) AS surfaces
           FROM _basedb.ai_call WHERE usage_kind = 'field_compute'`,
      ),
    )
    expect(journal).toEqual({ n: '3', surfaces: ['system'] })
  })

  it('recomputes one row on demand, whatever it held', async () => {
    const [alpha] = await pools.withConnection('data', (exec) =>
      exec.query<{ _id: string }>(`SELECT "_id" FROM ${relation} WHERE nom = 'Alpha'`),
    )
    await updateRecord(pools, ctx, {
      tableId,
      recordId: alpha._id,
      values: { notes: 'Fuite réparée' },
    })
    const { value } = await runAiCell(pools, ctx, transport, {
      fieldId,
      recordId: alpha._id,
    })
    expect(value).toBe('IA: Résume Fuite réparée pour Alpha (Urgent).')
    expect((await cells(column))[0].value).toBe(value)
    expect(Number((await config(fieldId)).computed_count)).toBe(4)
  })

  it('is computed again when a person changes a column it cites', async () => {
    const bravo = await idOf('Bravo')
    const before = 'IA: Résume Porte qui grince pour Bravo ((vide)).'

    // A value written back as it was, or a column the prompt does not cite: nothing to redo.
    const ville = await addField(pools, ctx, { tableId, label: 'Ville', kind: 'short_text' })
    const same = await updateRecord(pools, ctx, {
      tableId,
      recordId: bravo,
      values: { notes: 'Porte qui grince', [ville.name]: 'Lyon' },
    })
    expect(same.row[column]).toBe(before)

    // A cited value that changes: the cell is emptied by the same write…
    const changed = await updateRecord(pools, ctx, {
      tableId,
      recordId: bravo,
      values: { notes: 'Porte huilée' },
    })
    expect(changed.row[column]).toBeNull()

    // …and the next pass fills it from the new values.
    calls.length = 0
    const w = worker()
    try {
      expect(await w.pass()).toBe(1)
    } finally {
      await w.stop()
    }
    expect((await cells(column))[1].value).toBe('IA: Résume Porte huilée pour Bravo ((vide)).')
  })

  it('drops an answer to values that changed while the model was answering', async () => {
    const charlie = await idOf('Charlie')
    await updateRecord(pools, ctx, { tableId, recordId: charlie, values: { notes: 'Volet cassé' } })

    // The notes change again while the provider is being asked about the first ones.
    let typing = true
    const slow: ProviderTransport = async (request) => {
      if (typing) {
        typing = false
        await updateRecord(pools, ctx, {
          tableId,
          recordId: charlie,
          values: { notes: 'Volet remplacé' },
        })
      }
      return transport(request)
    }
    const w = startAiWorker(pools, slow, { intervalMs: 3_600_000, perField: 50 })
    try {
      await w.pass()
      // The answer about « Volet cassé » is not written: the row no longer says that.
      expect((await cells(column))[2].value).toBeNull()
      await w.pass()
    } finally {
      await w.stop()
    }
    expect((await cells(column))[2].value).toBe('IA: Résume Volet remplacé pour Charlie ((vide)).')
  })

  it('settles a row whose cited columns are all empty, without asking the model', async () => {
    // Only the column the prompt does not cite: nothing for the model to read.
    const created = await createRecord(pools, ctx, { tableId, values: { ville: 'Nantes' } })
    const id = String(created.row._id)
    const cell = async () => {
      const [row] = await pools.withConnection('data', (exec) =>
        exec.query<{ value: string | null }>(
          `SELECT "${column}" AS value FROM ${relation} WHERE "_id" = $1`,
          [id],
        ),
      )
      return row.value
    }

    calls.length = 0
    const w = worker()
    try {
      await w.pass()
      // Settled as empty, not left NULL for the next pass to try again.
      expect(await cell()).toBe('')
      await w.pass()
      expect(calls).toHaveLength(0)

      // A cited column filled: emptied by the write, then computed.
      await updateRecord(pools, ctx, { tableId, recordId: id, values: { notes: 'Grenier' } })
      await w.pass()
    } finally {
      await w.stop()
    }
    expect(calls).toEqual(['Résume Grenier pour (vide) ((vide)).'])
    expect(await cell()).toBe('IA: Résume Grenier pour (vide) ((vide)).')
    await deleteRecord(pools, ctx, { tableId, recordId: id })
  })

  it('writes an empty answer as such, and does not ask again', async () => {
    const charlie = await idOf('Charlie')
    await updateRecord(pools, ctx, {
      tableId,
      recordId: charlie,
      values: { notes: 'Rien de notable' },
    })
    let asked = 0
    const silent: ProviderTransport = async () => {
      asked++
      return { text: JSON.stringify({ value: '' }), inputTokens: 1, outputTokens: 1 }
    }
    const w = startAiWorker(pools, silent, { intervalMs: 3_600_000, perField: 50 })
    try {
      await w.pass()
      await w.pass()
    } finally {
      await w.stop()
    }
    expect(asked).toBe(1)
    expect((await cells(column))[2].value).toBe('')
    expect((await aiFieldStatus(pools, ctx, fieldId)).lastError).toBeNull()
  })

  it('changes its prompt with a fresh consent, and recomputes every row when asked', async () => {
    const refused = await failure(
      setAiField(pools, ctx, {
        fieldId,
        input: { prompt: 'Titre pour {{Nom}}', refresh: { mode: 'if_empty' } },
      }),
    )
    expect(refused.code).toBe('AI_CONSENT_REQUIRED')

    const status = await setAiField(pools, ctx, {
      fieldId,
      input: { prompt: 'Titre pour {{Nom}}', refresh: { mode: 'if_empty' }, consent: true },
      recompute: true,
    })
    expect(status.sweeping).toBe(true)

    const w = worker()
    try {
      expect(await w.pass()).toBe(3)
    } finally {
      await w.stop()
    }
    expect((await cells(column)).map((c) => c.value)).toEqual([
      'IA: Titre pour Alpha',
      'IA: Titre pour Bravo',
      'IA: Titre pour Charlie',
    ])
    expect((await aiFieldStatus(pools, ctx, fieldId)).sweeping).toBe(false)
  })

  it('recomputes on its schedule, read in the author’s zone', async () => {
    const status = await setAiField(pools, ctx, {
      fieldId,
      input: {
        prompt: 'Relance pour {{Nom}}',
        refresh: { mode: 'schedule', cron: '0 8 * * 1', timezone: 'Europe/Paris' },
        consent: true,
      },
    })
    const next = new Date(status.nextSweepAt ?? '')
    expect(next.getTime()).toBeGreaterThan(Date.now())
    // A Monday, 8 h in Paris.
    const paris = new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(next)
    expect(paris).toBe('lundi 08:00')

    // Not due: the pass leaves the values alone.
    const w = worker()
    try {
      expect(await w.pass()).toBe(0)
      // Due: every row is recomputed, and the next run moves forward.
      await pools.withConnection('catalog', (exec) =>
        exec.query(
          `UPDATE _basedb.field_ai_config SET next_sweep_at = now() - interval '1 minute'
            WHERE field_id = $1`,
          [fieldId],
          'update',
        ),
      )
      expect(await w.pass()).toBe(3)
    } finally {
      await w.stop()
    }
    expect((await cells(column))[1].value).toBe('IA: Relance pour Bravo')
    const after = await config(fieldId)
    expect(after.sweep_after).toBeNull()
    expect(new Date(after.next_sweep_at ?? 0).getTime()).toBeGreaterThan(Date.now())
  })

  it('says what went wrong when the provider does not answer, and waits', async () => {
    await requestAiSweep(pools, ctx, fieldId)
    failing = true
    const w = worker()
    try {
      await w.pass()
      // Paused: a second pass does not call a provider that just failed.
      calls.length = 0
      expect(await w.pass()).toBe(0)
    } finally {
      failing = false
      await w.stop()
    }
    expect((await aiFieldStatus(pools, ctx, fieldId)).lastError).toBe('AI_PROVIDER_UNAVAILABLE')
    // The recomputation is still pending, for when the provider is back.
    expect((await aiFieldStatus(pools, ctx, fieldId)).sweeping).toBe(true)
  })

  it('leaves a field another process holds', async () => {
    await pools.withConnection('catalog', (exec) =>
      exec.query(
        `UPDATE _basedb.field_ai_config SET lease_until = now() + interval '1 minute'
          WHERE field_id = $1`,
        [fieldId],
        'update',
      ),
    )
    calls.length = 0
    const w = worker()
    try {
      expect(await w.pass()).toBe(0)
    } finally {
      await w.stop()
    }
    expect(calls).toHaveLength(0)
  })
})

describe('the AI, an option of other types', () => {
  it('fills a number with the number the answer holds, and refuses an answer without one', async () => {
    const field = await addField(pools, ctx, {
      tableId,
      label: 'Gravité',
      kind: 'number',
      ai: {
        prompt: 'Note la gravité de {{Notes}} sur 10',
        refresh: { mode: 'if_empty' },
        consent: true,
      },
    })
    expect(field.kind).toBe('number')
    answer = 'Environ 1 234,5 points'
    try {
      const alpha = await idOf('Alpha')
      const computed = await runAiCell(pools, ctx, transport, {
        fieldId: field.fieldId,
        recordId: alpha,
      })
      expect(computed.value).toBe('1234.5')
      expect(formats.at(-1)).toMatch(/un nombre seul/)
      const [row] = (await cells(field.name)).filter((c) => c.nom === 'Alpha')
      expect(Number(row?.value)).toBe(1234.5)

      answer = 'Je ne sais pas.'
      const refused = await failure(
        runAiCell(pools, ctx, transport, { fieldId: field.fieldId, recordId: alpha }),
      )
      expect(refused.code).toBe('AI_RESPONSE_UNUSABLE')
      expect(refused.details).toMatchObject({ reason: 'type_attendu', kind: 'number' })
      // Nothing was forced into the column: it holds what it held.
      const [still] = (await cells(field.name)).filter((c) => c.nom === 'Alpha')
      expect(Number(still?.value)).toBe(1234.5)
    } finally {
      answer = null
    }
  })

  it('is not offered to a type whose value a model cannot write', async () => {
    const refused = await failure(
      addField(pools, ctx, {
        tableId,
        label: 'Rendez-vous',
        kind: 'datetime',
        ai: { prompt: 'Quand {{Nom}} ?', refresh: { mode: 'if_empty' }, consent: true },
      }),
    )
    expect(refused.details).toMatchObject({ reason: 'type_sans_ia', kind: 'datetime' })
  })

  it('is switched on for an existing choice, then off: the field is writable again', async () => {
    const field = await addField(pools, ctx, {
      tableId,
      label: 'Priorité',
      kind: 'select',
      options: [
        { value: 'haute', label: 'Haute' },
        { value: 'basse', label: 'Basse' },
      ],
    })
    const alpha = await idOf('Alpha')
    await setAiField(pools, ctx, {
      fieldId: field.fieldId,
      input: { prompt: 'Priorité de {{Notes}}', refresh: { mode: 'if_empty' }, consent: true },
    })
    // Computed now: nobody writes it.
    const writing = await failure(
      updateRecord(pools, ctx, { tableId, recordId: alpha, values: { priorite: 'basse' } }),
    )
    expect(writing.code).toBe('FIELD_NOT_WRITABLE')

    answer = 'Priorité : Haute.'
    try {
      const computed = await runAiCell(pools, ctx, transport, {
        fieldId: field.fieldId,
        recordId: alpha,
      })
      expect(computed.value).toBe('haute')
      expect(formats.at(-1)).toContain('« Haute »')
    } finally {
      answer = null
    }

    await disableAiField(pools, ctx, field.fieldId)
    expect((await failure(aiFieldStatus(pools, ctx, field.fieldId))).details).toMatchObject({
      reason: 'pas_un_champ_ia',
    })
    await updateRecord(pools, ctx, { tableId, recordId: alpha, values: { priorite: 'basse' } })
    const [row] = (await cells(field.name)).filter((c) => c.nom === 'Alpha')
    expect(row?.value).toBe('basse')
  })
})

describe('a server compatible with OpenAI’s API', () => {
  it('is handed the operator’s address and headers, and journaled under its own name', async () => {
    const saved = Object.fromEntries(
      ['BASEDB_AI_PROVIDER', 'BASEDB_AI_BASE_URL', 'BASEDB_AI_HEADERS', 'BASEDB_AI_API_KEY'].map(
        (k) => [k, process.env[k]],
      ),
    )
    process.env.BASEDB_AI_PROVIDER = 'openai_compatible'
    process.env.BASEDB_AI_BASE_URL = 'https://atelier.openai.azure.com/openai/v1'
    process.env.BASEDB_AI_HEADERS = '{"api-key": "cle-azure"}'
    Reflect.deleteProperty(process.env, 'BASEDB_AI_API_KEY')
    const sent: Array<Parameters<ProviderTransport>[0]> = []
    const azure: ProviderTransport = async (request) => {
      sent.push(request)
      return transport(request)
    }
    try {
      const field = await addField(pools, ctx, {
        tableId,
        label: 'Par Azure',
        kind: 'short_text',
        ai: { prompt: 'Résume {{Notes}}', refresh: { mode: 'if_empty' }, consent: true },
      })
      const { value } = await runAiCell(pools, ctx, azure, {
        fieldId: field.fieldId,
        recordId: await idOf('Alpha'),
      })
      expect(value).toMatch(/^IA: Résume /)
      expect(sent).toHaveLength(1)
      expect(sent[0]).toMatchObject({
        provider: 'openai_compatible',
        apiKey: '',
        baseUrl: 'https://atelier.openai.azure.com/openai/v1',
        headers: { 'api-key': 'cle-azure' },
      })

      // The journal says where the data went: its CHECK knows the fourth provider.
      const journal = await pools.withConnection('catalog', (exec) =>
        exec.query<{ provider: string; status: string; key_scope: string }>(
          `SELECT provider, status, key_scope FROM _basedb.ai_call
            WHERE provider = 'openai_compatible'`,
        ),
      )
      expect(journal).toEqual([
        { provider: 'openai_compatible', status: 'accepted', key_scope: 'instance' },
      ])
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) Reflect.deleteProperty(process.env, key)
        else process.env[key] = value
      }
    }
  })
})
