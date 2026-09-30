'use client'

import { cancelled, useElevated } from '@/components/app/elevation'
import { ExpressionEditor } from '@/components/app/expression-editor'
import { Button } from '@/components/ui/button'
import { Choice as ChoiceField } from '@/components/ui/choice'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  type AdminUser,
  type EffectiveRows,
  type Field,
  type RowAccess,
  api,
} from '@/lib/api/client'
import { $t, $tp, groupName } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { Filter, Loader2, Lock, Rows3, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * Below the grid, beside the fields — the rows of one table, group by group (05 §16).
 *
 * A group may see only the rows a filter keeps, written in the language of the view
 * filters: `commercial eq @moi`, `region in ["nord", "est"]`. `@moi` is whoever looks.
 * Rights add up — a person sees the rows of all their groups, and a group without a rule
 * sees every row — and a group at « Gestion » sees the whole table: its row is shown, not
 * offered. The second half answers the question that matters: how many rows does THIS
 * person see, and through which group.
 */

const LEVEL_LABEL: Readonly<Record<string, string>> = {
  read: $t('Lecture'),
  edit: $t('Édition'),
  manage: $t('Gestion'),
}

/** The rule's fields as the expression editor reads fields — plus « who created the row ». */
function editorFields(access: RowAccess): Field[] {
  return [
    ...access.fields.map(
      (f) =>
        ({
          id: f.name,
          name: f.name,
          label: f.label,
          kind: f.kind,
          ...(f.options === undefined
            ? {}
            : {
                options: f.options.map((o) => ({
                  value: o.value,
                  label: o.label,
                  color: null,
                  icon: null,
                  image: null,
                })),
              }),
        }) as unknown as Field,
    ),
    {
      id: '_created_by',
      name: '_created_by',
      label: $t('Créé par'),
      kind: 'user',
    } as unknown as Field,
  ]
}

/** A few rules written for the person choosing, from the table's own fields. */
function suggestionsFor(access: RowAccess): Array<{ label: string; rule: string }> {
  const out: Array<{ label: string; rule: string }> = []
  for (const f of access.fields) {
    if (f.kind === 'user') {
      out.push({ label: $t('« {label} » est moi', { label: f.label }), rule: `${f.name} eq @moi` })
    }
  }
  out.push({ label: $t('Créées par moi'), rule: '_created_by eq @moi' })
  for (const f of access.fields) {
    const first = f.options?.[0]
    if (f.kind === 'select' && first !== undefined && out.length < 4) {
      out.push({
        label: $t('« {label} » est {option}', { label: f.label, option: first.label }),
        rule: `${f.name} eq "${first.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`,
      })
    }
  }
  return out.slice(0, 4)
}

export function RowRulesDialog({
  table,
  onClose,
}: {
  /** The table whose rows are set, or `null` when the dialog is closed. */
  readonly table: { readonly id: string; readonly label: string } | null
  readonly onClose: () => void
}) {
  const elevated = useElevated()
  const [access, setAccess] = useState<RowAccess | null>(null)
  const [drafts, setDrafts] = useState<Readonly<Record<string, string>>>({})
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({})
  const [users, setUsers] = useState<readonly AdminUser[]>([])
  const [person, setPerson] = useState<string | null>(null)
  const [seen, setSeen] = useState<EffectiveRows | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const tableId = table?.id ?? null

  const adopt = useCallback((next: RowAccess) => {
    setAccess(next)
    setDrafts(Object.fromEntries(next.groups.map((g) => [g.id, g.rule ?? ''])))
  }, [])

  useEffect(() => {
    if (tableId === null) return
    setAccess(null)
    setSeen(null)
    setPerson(null)
    setError(null)
    setErrors({})
    api.rowAccess(tableId).then(adopt, (e) => setError(messageFor(e)))
    api.users().then(
      (all) => setUsers(all.filter((u) => !u.disabled)),
      () => setUsers([]),
    )
  }, [tableId, adopt])

  const loadSeen = useCallback(
    async (userId: string | null) => {
      if (tableId === null || userId === null) {
        setSeen(null)
        return
      }
      try {
        setSeen(await api.effectiveRows(tableId, userId))
      } catch (e) {
        setError(messageFor(e))
      }
    },
    [tableId],
  )

  const save = async (groupId: string, rule: string | null) => {
    if (tableId === null) return
    setSaving(groupId)
    setErrors((all) => ({ ...all, [groupId]: '' }))
    try {
      adopt(await elevated(() => api.setRowRule(tableId, groupId, rule)))
      await loadSeen(person)
    } catch (e) {
      if (!cancelled(e)) setErrors((all) => ({ ...all, [groupId]: messageFor(e) }))
    } finally {
      setSaving(null)
    }
  }

  const fields = useMemo(() => (access === null ? [] : editorFields(access)), [access])
  const suggestions = useMemo(() => (access === null ? [] : suggestionsFor(access)), [access])
  const reaching = (access?.groups ?? []).filter((g) => g.system !== 'admins' && g.level !== 'none')
  const ruled = reaching.filter((g) => g.level !== 'manage')
  const managers = reaching.filter((g) => g.level === 'manage')

  return (
    <Dialog open={table !== null} onOpenChange={(o) => !o && saving === null && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{$t('Lignes — {label}', { label: table?.label })}</DialogTitle>
          <DialogDescription>
            {$t(
              'Ne montrer à un groupe que certaines lignes de la table : celles que retient un filtre, écrit comme celui d’une vue. @moi désigne la personne connectée. Les droits s’additionnent : une personne voit les lignes de tous ses groupes, et un groupe sans règle voit toutes les lignes.',
            )}
          </DialogDescription>
        </DialogHeader>

        {error !== null && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {access === null ? (
          error === null && (
            <div className="py-8 text-center">
              <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
            </div>
          )
        ) : reaching.length === 0 ? (
          <p className="rounded-md border px-3 py-6 text-center text-sm text-muted-foreground">
            {$t(
              'Aucun groupe n’a accès à cette table, en dehors des administrateurs : il n’y a rien à restreindre. Accordez d’abord un niveau dans la grille.',
            )}
          </p>
        ) : (
          <div className="min-w-0 space-y-5">
            <ul className="space-y-3">
              {ruled.map((g) => {
                const draft = drafts[g.id] ?? ''
                const changed = draft.trim() !== (g.rule ?? '')
                return (
                  <li key={g.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium">{groupName(g.label)}</span>
                      <span className="text-xs text-muted-foreground">
                        {LEVEL_LABEL[g.level] ?? g.level}
                      </span>
                      <span
                        className={cn(
                          'ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                          g.rule === null
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-primary/10 text-primary',
                        )}
                      >
                        {g.rule === null ? (
                          <Rows3 className="size-3.5" />
                        ) : (
                          <Filter className="size-3.5" />
                        )}
                        {g.rule === null ? $t('Toutes les lignes') : $t('Lignes filtrées')}
                      </span>
                    </div>
                    <div className="mt-2 flex min-h-9 rounded-lg border">
                      <ExpressionEditor
                        value={draft}
                        fields={fields}
                        placeholder={$t('commercial eq @moi')}
                        onChange={(next) => setDrafts((all) => ({ ...all, [g.id]: next }))}
                        onRun={() => void save(g.id, draft.trim() === '' ? null : draft)}
                        serverError={errors[g.id] || null}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Sparkles className="size-3.5 text-muted-foreground" />
                      {suggestions.map((s) => (
                        <button
                          key={s.rule}
                          type="button"
                          onClick={() => setDrafts((all) => ({ ...all, [g.id]: s.rule }))}
                          className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          {s.label}
                        </button>
                      ))}
                      <span className="ml-auto flex items-center gap-2">
                        {g.rule !== null && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={saving !== null}
                            onClick={() => void save(g.id, null)}
                          >
                            {$t('Toutes les lignes')}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          disabled={saving !== null || !changed}
                          onClick={() => void save(g.id, draft.trim() === '' ? null : draft)}
                        >
                          {saving === g.id && <Loader2 className="size-3.5 animate-spin" />}
                          {$t('Enregistrer')}
                        </Button>
                      </span>
                    </div>
                  </li>
                )
              })}
              {managers.map((g) => (
                <li
                  key={g.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground"
                >
                  <span className="font-medium text-foreground">{groupName(g.label)}</span>
                  <span className="text-xs">{LEVEL_LABEL.manage}</span>
                  <span className="ml-auto text-xs">
                    {$t('Voit toutes les lignes : qui gère la structure voit toute la table.')}
                  </span>
                </li>
              ))}
            </ul>

            <section className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-sm font-medium">{$t('Ce que voit une personne')}</h3>
                <ChoiceField
                  value={person}
                  onValueChange={(id) => {
                    setPerson(id)
                    void loadSeen(id)
                  }}
                  options={users.map((u) => ({
                    value: u.id,
                    label: `${u.display_name} · ${u.email}`,
                  }))}
                  placeholder={$t('Choisir une personne…')}
                  aria-label={$t('Personne')}
                  className="w-64 text-xs"
                />
              </div>
              {seen !== null && <SeenView seen={seen} />}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** How many rows one person sees — what every surface will show them. */
function SeenView({ seen }: { readonly seen: EffectiveRows }) {
  if (!seen.reads_table) {
    return (
      <p className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground">
        <Lock className="size-4" />
        {$t(
          '{display_name} n’a accès à cette table par aucun de ses groupes : elle lui est invisible.',
          { display_name: seen.user.display_name },
        )}
      </p>
    )
  }
  return (
    <div className="rounded-lg border px-3 py-2 text-sm">
      <p>
        {$tp(
          seen.visible,
          '{display_name} voit {count} ligne sur {total}.',
          '{display_name} voit {count} lignes sur {total}.',
          { display_name: seen.user.display_name, total: seen.total },
        )}
      </p>
      <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
        {seen.via.map((v) => (
          <li key={v.group}>
            {v.rule === null
              ? $t('{group} : toutes les lignes', { group: groupName(v.group) })
              : $t('{group} : {rule}', { group: groupName(v.group), rule: v.rule })}
          </li>
        ))}
      </ul>
    </div>
  )
}
