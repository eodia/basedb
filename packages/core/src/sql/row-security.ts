import { createHash } from 'node:crypto'
import { qualify, quoteIdentifier } from '@basedb/naming'
import { quoteLiteral } from '../ddl/emit.js'
import { policyExpression } from '../rbac/rows.js'
import type { Executor } from '../runtime/pool.js'

/**
 * Row rules in PostgreSQL itself — chapter 05 §16, for the one surface where PostgreSQL
 * holds a second line (§9): SQL written in the interface.
 *
 * A table that carries a row rule has PostgreSQL's row security on. The product's own
 * connections are the table's owner and read past it; the two roles SQL is run as do not:
 *
 *   — the console of a base's managers, `basedb_console`, gets a policy that keeps every
 *     row: « Gestion » sees the whole table;
 *   — each reader's role, `basedb_reader_<id>`, gets the person's own predicate, set when
 *     their grants are brought in line before each call (`reader.ts`).
 *
 * A role PostgreSQL knows nothing about — a login the operator made for a tool of theirs —
 * sees no row of such a table unless it bypasses row security: a table that hides rows
 * from some shows none by default. The documentation says so where it speaks of SQL.
 */

/** The managers' console role (`console.ts`). */
export const CONSOLE_ROLE = 'basedb_console'
const CONSOLE_POLICY = 'basedb_console_all'
const READER_PREFIX = 'basedb_rows_'

/** Row security on, the console keeping every row. Run by the OWNER, on the `ddl` pool. */
export async function enableRowSecurity(exec: Executor, relation: string): Promise<void> {
  await exec.query(
    `DO $do$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${quoteLiteral(CONSOLE_ROLE)}) THEN
         EXECUTE 'CREATE ROLE ' || quote_ident(${quoteLiteral(CONSOLE_ROLE)}) || ' NOLOGIN';
       END IF;
       IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = ${quoteLiteral(relation)}::regclass
                                                 AND polname = ${quoteLiteral(CONSOLE_POLICY)}) THEN
         EXECUTE 'CREATE POLICY ${CONSOLE_POLICY} ON ${relation.replaceAll("'", "''")} FOR ALL TO '
                 || quote_ident(${quoteLiteral(CONSOLE_ROLE)}) || ' USING (true) WITH CHECK (true)';
       END IF;
     END $do$;`,
    [],
    'ddl',
  )
  await exec.query(`ALTER TABLE ${relation} ENABLE ROW LEVEL SECURITY`, [], 'ddl')
}

/** Row security off, and the policies the product put on the table gone with it. */
export async function disableRowSecurity(exec: Executor, relation: string): Promise<void> {
  const policies = await exec.query<{ polname: string }>(
    `SELECT polname FROM pg_policy
      WHERE polrelid = $1::regclass AND (polname = $2 OR polname LIKE $3)`,
    [relation, CONSOLE_POLICY, `${READER_PREFIX}%`],
  )
  for (const { polname } of policies) {
    await exec.query(`DROP POLICY IF EXISTS ${quoteIdentifier(polname)} ON ${relation}`, [], 'ddl')
  }
  await exec.query(`ALTER TABLE ${relation} DISABLE ROW LEVEL SECURITY`, [], 'ddl')
}

/**
 * The statements that give a reader's role its predicate on each table it reads — none
 * when nothing changed. A table under row security gets a policy for the role even when
 * its predicate is `TRUE`: without one, it would see nothing there. A table not under row
 * security while the person's predicate narrows it is put under it first: the rule was
 * saved, and PostgreSQL must hold it whatever happened to the statement that should have
 * turned it on.
 *
 * The policy's name carries a digest of its predicate: a changed rule is a new name, the
 * old policy dropped — no comparison of PostgreSQL's rewritten expression with ours.
 */
export async function readerPolicies(
  exec: Executor,
  role: string,
  schema: string,
  rows: ReadonlyMap<string, string>,
): Promise<string[]> {
  if (rows.size === 0) return []
  const state = await exec.query<{ relname: string; rls: boolean; polname: string | null }>(
    `SELECT c.relname, c.relrowsecurity AS rls, p.polname
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       LEFT JOIN pg_policy p ON p.polrelid = c.oid AND p.polname LIKE $4
                            AND (SELECT oid FROM pg_roles WHERE rolname = $1) = ANY(p.polroles)
      WHERE n.nspname = $2 AND c.relname = ANY($3::text[]) AND c.relkind IN ('r', 'p')`,
    [role, schema, [...rows.keys()], `${READER_PREFIX}%`],
  )
  const statements: string[] = []
  const who = role.replace(/^basedb_reader_/, '')
  for (const [table, predicate] of rows) {
    const relation = qualify(schema, table)
    const here = state.filter((s) => s.relname === table)
    const rls = here[0]?.rls ?? false
    if (!rls && predicate === 'TRUE') continue
    if (!rls) await enableRowSecurity(exec, relation)
    const digest = createHash('sha256').update(predicate).digest('hex').slice(0, 8)
    const wanted = `${READER_PREFIX}${who}_${digest}`
    const held = here.map((s) => s.polname).filter((p): p is string => p !== null)
    if (held.includes(wanted)) continue
    for (const old of held) {
      statements.push(`DROP POLICY IF EXISTS ${quoteIdentifier(old)} ON ${relation}`)
    }
    statements.push(
      `CREATE POLICY ${quoteIdentifier(wanted)} ON ${relation} FOR SELECT TO ${quoteIdentifier(role)}
         USING (${policyExpression(predicate)})`,
    )
  }
  return statements
}
