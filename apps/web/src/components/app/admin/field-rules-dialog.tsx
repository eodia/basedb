'use client'

import { cancelled, useElevated } from '@/components/app/elevation'
import { FieldIcon } from '@/components/app/field-icon'
import { Choice as ChoiceField } from '@/components/ui/choice'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Hint } from '@/components/ui/tooltip'
import {
  type AdminUser,
  type EffectiveMask,
  type FieldAccess,
  type FieldRule,
  api,
} from '@/lib/api/client'
import { $t, groupName } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { Eye, EyeOff, Info, Loader2, Lock, Pencil } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

/**
 * Below the grid — the fields of one table, group by group (chapter 05 §4).
 *
 * The grid stops at the table; here a group can be given LESS on one field: hidden, or
 * read-only. A rule never gives more than the group's level on the table. And rights add
 * up: a field hidden for one group stays visible to whoever also belongs to a group that
 * reads it. That is why the second half of the dialog answers the only question that
 * matters in the end — what does this person see, and through which group (§3.3).
 */

type Choice = 'level' | FieldRule

const LEVEL_LABEL: Readonly<Record<string, string>> = {
  read: $t('Lecture'),
  edit: $t('Édition'),
  manage: $t('Gestion'),
}

export function FieldRulesDialog({
  table,
  onClose,
}: {
  /** The table whose fields are set, or `null` when the dialog is closed. */
  readonly table: { readonly id: string; readonly label: string } | null
  readonly onClose: () => void
}) {
  const elevated = useElevated()
  const [access, setAccess] = useState<FieldAccess | null>(null)
  const [users, setUsers] = useState<readonly AdminUser[]>([])
  const [person, setPerson] = useState<string | null>(null)
  const [mask, setMask] = useState<EffectiveMask | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const tableId = table?.id ?? null

  useEffect(() => {
    if (tableId === null) return
    setAccess(null)
    setMask(null)
    setPerson(null)
    setError(null)
    api.fieldAccess(tableId).then(setAccess, (e) => setError(messageFor(e)))
    api.users().then(
      (all) => setUsers(all.filter((u) => !u.disabled)),
      () => setUsers([]),
    )
  }, [tableId])

  const loadMask = useCallback(
    async (userId: string | null) => {
      if (tableId === null || userId === null) {
        setMask(null)
        return
      }
      try {
        setMask(await api.effectiveMask(tableId, userId))
      } catch (e) {
        setError(messageFor(e))
      }
    },
    [tableId],
  )

  const choose = async (fieldId: string, groupId: string, choice: Choice) => {
    const key = `${fieldId}:${groupId}`
    setSaving(key)
    setError(null)
    try {
      const next = await elevated(() =>
        api.setFieldRule(fieldId, groupId, choice === 'level' ? null : choice),
      )
      setAccess(next)
      await loadMask(person)
    } catch (e) {
      if (!cancelled(e)) setError(messageFor(e))
    } finally {
      setSaving(null)
    }
  }

  // Only the groups that reach the table can be restricted on it; the Administrators
  // have everything, everywhere.
  const groups = (access?.groups ?? []).filter((g) => g.system !== 'admins' && g.level !== 'none')

  return (
    <Dialog open={table !== null} onOpenChange={(o) => !o && saving === null && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{$t('Champs — {label}', { label: table?.label })}</DialogTitle>
          <DialogDescription>
            {$t(
              'Masquer un champ à un groupe, ou le rendre non modifiable pour lui. Une règle ne donne jamais plus que le niveau du groupe sur la table. Les droits s’additionnent : un champ masqué pour un groupe reste visible à qui appartient aussi à un groupe qui le lit.',
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
        ) : groups.length === 0 ? (
          <p className="rounded-md border px-3 py-6 text-center text-sm text-muted-foreground">
            {$t(
              'Aucun groupe n’a accès à cette table, en dehors des administrateurs : il n’y a rien à restreindre. Accordez d’abord un niveau dans la grille.',
            )}
          </p>
        ) : (
          <div className="min-w-0 space-y-6">
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">{$t('Champ')}</th>
                    {groups.map((g) => (
                      <th key={g.id} className="min-w-44 px-3 py-2 text-left font-medium">
                        <span className="block truncate">{groupName(g.label)}</span>
                        <span className="font-normal text-muted-foreground">
                          {LEVEL_LABEL[g.level] ?? g.level}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {access.fields.map((field) => (
                    <tr key={field.id} className="border-t">
                      <td className="px-3 py-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <FieldIcon kind={field.kind} />
                          <Hint label={field.name}>
                            <span className="truncate">{field.label}</span>
                          </Hint>
                        </span>
                      </td>
                      {groups.map((g) => {
                        const rule = g.rules[field.id]
                        const key = `${field.id}:${g.id}`
                        return (
                          <td key={g.id} className="px-3 py-1.5">
                            <RuleSelect
                              value={rule ?? 'level'}
                              writes={g.level !== 'read'}
                              saving={saving === key}
                              disabled={saving !== null}
                              label={$t('{label} pour {label2}', {
                                label: field.label,
                                label2: g.label,
                              })}
                              onChange={(choice) => void choose(field.id, g.id, choice)}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <section className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-sm font-medium">{$t('Ce que voit une personne')}</h3>
                <ChoiceField
                  value={person}
                  onValueChange={(id) => {
                    setPerson(id)
                    void loadMask(id)
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
              {mask !== null && <MaskView access={access} mask={mask} />}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

const CHOICES: ReadonlyArray<{ id: Choice; label: string }> = [
  { id: 'level', label: $t('Selon le niveau') },
  { id: 'read_only', label: $t('Lecture seule') },
  { id: 'hidden', label: $t('Masqué') },
]

function RuleSelect({
  value,
  writes,
  saving,
  disabled,
  label,
  onChange,
}: {
  readonly value: Choice
  readonly writes: boolean
  readonly saving: boolean
  readonly disabled: boolean
  readonly label: string
  readonly onChange: (choice: Choice) => void
}) {
  // « Lecture seule » on a group that only reads changes nothing: offered, but said.
  const shown = (id: Choice) =>
    id === 'level'
      ? writes
        ? $t('Modifiable')
        : $t('Lecture')
      : id === 'read_only'
        ? $t('Lecture seule')
        : $t('Masqué')
  return (
    <span className="flex items-center gap-1.5">
      <Select value={value} onValueChange={(v) => onChange(v as Choice)} disabled={disabled}>
        <SelectTrigger
          className={cn(
            'h-8 w-36 text-xs',
            value === 'hidden' && 'border-destructive/40 text-destructive',
            value === 'read_only' && 'border-amber-500/40',
          )}
          aria-label={label}
        >
          <SelectValue>{shown(value)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {CHOICES.map((c) => (
            <SelectItem key={c.id} value={c.id} disabled={c.id === 'read_only' && !writes}>
              {c.id === 'level' ? `${c.label} (${writes ? 'modifiable' : 'lecture'})` : c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {saving && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
    </span>
  )
}

const LEVEL_ICON = { write: Pencil, read: Eye, hidden: EyeOff } as const
const LEVEL_TEXT = { write: $t('Modifiable'), read: $t('Lecture'), hidden: $t('Masqué') } as const

/** The effective mask of one person: what every surface will enforce for them. */
function MaskView({
  access,
  mask,
}: {
  readonly access: FieldAccess
  readonly mask: EffectiveMask
}) {
  if (!mask.reads_table) {
    return (
      <p className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground">
        <Lock className="size-4" />
        {$t(
          '{display_name} n’a accès à cette table par aucun de ses groupes : elle lui est invisible.',
          { display_name: mask.user.display_name },
        )}
      </p>
    )
  }
  const byId = new Map(mask.fields.map((f) => [f.id, f]))
  return (
    <ul className="divide-y rounded-lg border text-sm">
      {access.fields.map((field) => {
        const f = byId.get(field.id)
        if (f === undefined) return null
        const Icon = LEVEL_ICON[f.level]
        // The trap of §3.3, said where it happens: a rule that another group overrides.
        const overridden = f.level !== 'hidden' && f.restricted_by.some((r) => r.rule === 'hidden')
        return (
          <li key={field.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
            <span className="flex min-w-40 flex-1 items-center gap-2">
              <FieldIcon kind={field.kind} />
              <span className="truncate">{field.label}</span>
            </span>
            <span
              className={cn(
                'flex w-28 items-center gap-1.5 text-xs',
                f.level === 'hidden' ? 'text-destructive' : 'text-foreground',
              )}
            >
              <Icon className="size-3.5" />
              {LEVEL_TEXT[f.level]}
            </span>
            <span className="min-w-0 flex-[2] text-xs text-muted-foreground">
              {f.restricted_by.length > 0 && (
                <>
                  {$t('Règle : {map}.', {
                    map: f.restricted_by
                      .map((r) =>
                        $t('{value} pour {group}', {
                          value: r.rule === 'hidden' ? $t('masqué') : $t('lecture seule'),
                          group: r.group,
                        }),
                      )
                      .join(', '),
                  })}{' '}
                </>
              )}
              {overridden && (
                <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                  <Info className="size-3.5" />
                  {$t('Reste visible via {readable_via}.', {
                    readable_via: f.readable_via.join(', '),
                  })}
                </span>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
