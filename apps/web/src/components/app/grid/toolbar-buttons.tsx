'use client'

import { ConfirmDialog } from '@/components/app/admin/users-tab'
import { Button } from '@/components/ui/button'
import { Choice } from '@/components/ui/choice'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Hint } from '@/components/ui/tooltip'
import {
  ApiError,
  type Automation,
  type Table,
  type TableButton,
  type TableButtonInput,
  api,
} from '@/lib/api/client'
import { $t, $tp } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { PRESET_COLORS } from '@/lib/options'
import { cn } from '@/lib/utils'
import { Ellipsis, ExternalLink, Loader2, Pencil, Plus, Trash2, Zap } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

/**
 * The buttons of a table's toolbar — chapter 11 §1.6. They belong to the table: every grid
 * of it shows them, to whoever reads it; whoever builds it sets them, from the « Affichage »
 * menu. One opens an address; another starts an automation on its target — the rows
 * ticked, the rows of the view on screen, or none.
 */

const TARGETS: ReadonlyArray<{ readonly value: TableButton['target']; readonly label: string }> = [
  { value: 'selection', label: $t('Les lignes cochées') },
  { value: 'view', label: $t('Toutes les lignes de la vue') },
  { value: 'none', label: $t('Aucune ligne') },
]

/** The buttons of a table, read again when one is set. */
export function useTableButtons(table: Table | null): {
  readonly buttons: readonly TableButton[]
  readonly reload: () => void
} {
  const [buttons, setButtons] = useState<readonly TableButton[]>([])
  const [version, setVersion] = useState(0)
  const ref = table === null ? null : { base: table.base, name: table.name }
  const key = ref === null ? null : `${ref.base}/${ref.name}`
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` names the table; `version` asks again
  useEffect(() => {
    if (ref === null) {
      setButtons([])
      return
    }
    let live = true
    api
      .tableButtons(ref)
      .then((list) => {
        if (live) setButtons(list)
      })
      // No buttons rather than a broken bar: the grid is what the person came for.
      .catch(() => {
        if (live) setButtons([])
      })
    return () => {
      live = false
    }
  }, [key, version])
  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { buttons, reload }
}

/** Why a press was refused, in the words of the bar. */
function pressRefusal(e: unknown): string {
  if (e instanceof ApiError) {
    const reason = e.details.reason
    if (reason === 'trop_de_lignes') {
      return $t('Plus de {maximum} lignes : filtrez la vue ou cochez moins de lignes.', {
        maximum: String(e.details.maximum ?? 100),
      })
    }
    if (reason === 'aucune_ligne') return $t('Aucune ligne sur laquelle lancer l’automatisation.')
    if (e.code === 'RATE_LIMIT_EXCEEDED' && reason === 'debit') {
      return $t('L’automatisation a atteint son nombre d’exécutions pour cette heure.')
    }
  }
  return messageFor(e)
}

/**
 * The buttons in the bar. Ticked rows are what a « lignes cochées » button acts on — it
 * waits, greyed, until there are some; the view's filter is what a « vue » button reads.
 */
export function TableButtonsBar({
  table,
  buttons,
  selection,
  filter,
}: {
  readonly table: Table
  readonly buttons: readonly TableButton[]
  /** The rows ticked, by `_id`. */
  readonly selection: readonly string[]
  /** The filter the view's rows are read with, its quick search included. */
  readonly filter: string
}) {
  const [asking, setAsking] = useState<TableButton | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  if (buttons.length === 0) return null

  const press = async (button: TableButton) => {
    setBusy(button.id)
    try {
      const pressed = await api.pressTableButton(table, button.id, {
        ...(button.target === 'selection' ? { records: selection } : {}),
        ...(button.target === 'view' ? { filter } : {}),
      })
      toast.success(
        $tp(
          pressed.runs,
          '« {label} » : {count} exécution lancée',
          '« {label} » : {count} exécutions lancées',
          { label: button.label },
        ),
      )
    } finally {
      setBusy(null)
    }
  }

  const click = (button: TableButton) => {
    if (button.action === 'url') {
      if (button.url !== null) window.open(button.url, '_blank', 'noopener,noreferrer')
      return
    }
    // A whole view is asked about, whatever the button says: it may be many rows.
    if (button.confirm || button.target === 'view') {
      setAsking(button)
      return
    }
    press(button).catch((e: unknown) => toast.error(pressRefusal(e)))
  }

  return (
    <div className="flex items-center gap-1">
      {buttons.map((button) => {
        const waiting = button.action === 'automation' && button.target === 'selection'
        const disabled = busy === button.id || (waiting && selection.length === 0)
        const control = (
          <Button
            key={button.id}
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            disabled={disabled}
            onClick={() => click(button)}
            style={
              button.color === null
                ? undefined
                : {
                    borderColor: `color-mix(in srgb, ${button.color} 45%, transparent)`,
                    backgroundColor: `color-mix(in srgb, ${button.color} 10%, transparent)`,
                  }
            }
          >
            {busy === button.id ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : button.action === 'url' ? (
              <ExternalLink className="size-3.5" />
            ) : (
              <Zap className="size-3.5" style={{ color: button.color ?? undefined }} />
            )}
            <span className="max-w-40 truncate">{button.label}</span>
          </Button>
        )
        return waiting && selection.length === 0 ? (
          <Hint key={button.id} label={$t('Cochez des lignes pour lancer ce bouton')}>
            <span tabIndex={-1}>{control}</span>
          </Hint>
        ) : (
          control
        )
      })}
      <ConfirmDialog
        open={asking !== null}
        title={asking?.label ?? ''}
        body={
          asking === null
            ? ''
            : asking.target === 'selection'
              ? $tp(
                  selection.length,
                  'Lancer « {automation} » sur la ligne cochée ?',
                  'Lancer « {automation} » sur les {count} lignes cochées ?',
                  { automation: asking.automation?.label ?? '' },
                )
              : asking.target === 'view'
                ? $t('Lancer « {automation} » sur toutes les lignes de la vue ?', {
                    automation: asking.automation?.label ?? '',
                  })
                : $t('Lancer « {automation} » ?', { automation: asking.automation?.label ?? '' })
        }
        action={$t('Lancer')}
        onClose={() => setAsking(null)}
        onConfirm={async () => {
          if (asking === null) return
          try {
            await press(asking)
          } catch (e) {
            throw new Error(pressRefusal(e))
          }
          setAsking(null)
        }}
      />
    </div>
  )
}

/**
 * The « Boutons » part of the « Affichage » menu, for whoever builds the table: its
 * buttons to change, and one more to add.
 */
export function ButtonsSection({
  buttons,
  onEdit,
  onAdd,
}: {
  readonly buttons: readonly TableButton[]
  readonly onEdit: (button: TableButton) => void
  readonly onAdd: () => void
}) {
  return (
    <section className="space-y-1 border-t pt-3">
      <p className="text-xs font-medium">{$t('Boutons de la barre')}</p>
      {buttons.map((button) => (
        <button
          key={button.id}
          type="button"
          onClick={() => onEdit(button)}
          className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-accent"
        >
          {button.action === 'url' ? (
            <ExternalLink className="size-3.5 text-muted-foreground" />
          ) : (
            <Zap className="size-3.5" style={{ color: button.color ?? undefined }} />
          )}
          <span className="flex-1 truncate">{button.label}</span>
          <Pencil className="size-3 text-muted-foreground" />
        </button>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Plus className="size-3.5" />
        {$t('Ajouter un bouton…')}
      </button>
    </section>
  )
}

/** Setting a button: what it says, what it does, on which rows. */
export function ButtonDialog({
  open,
  table,
  button,
  onClose,
  onSaved,
}: {
  readonly open: boolean
  readonly table: Table
  /** The button changed; `null` for a new one. */
  readonly button: TableButton | null
  readonly onClose: () => void
  readonly onSaved: () => void
}) {
  const [label, setLabel] = useState('')
  const [color, setColor] = useState<string | null>(null)
  const [action, setAction] = useState<TableButton['action']>('automation')
  const [url, setUrl] = useState('')
  const [target, setTarget] = useState<TableButton['target']>('selection')
  const [automation, setAutomation] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [automations, setAutomations] = useState<readonly Automation[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLabel(button?.label ?? '')
    setColor(button?.color ?? null)
    setAction(button?.action ?? 'automation')
    setUrl(button?.url ?? '')
    setTarget(button?.target ?? 'selection')
    setAutomation(button?.automation?.id ?? null)
    setConfirm(button?.confirm ?? false)
    setError(null)
    api
      .automations(table.base)
      .then(setAutomations)
      .catch(() => setAutomations([]))
  }, [open, button, table.base])

  // A row goes to an automation started by a button of THIS table; no row, to one with no
  // table at all — the server says the same.
  const fitting = (automations ?? []).filter((a) =>
    target === 'none'
      ? a.trigger.table === null
      : a.trigger.kind === 'button' &&
        (a.trigger.table === table.name || a.trigger.table === table.id),
  )
  const chosen = fitting.some((a) => a.id === automation) ? automation : null

  const save = async () => {
    setBusy(true)
    setError(null)
    const input: TableButtonInput =
      action === 'url'
        ? { label: label.trim(), color, action, url: url.trim(), confirm }
        : { label: label.trim(), color, action, automation: chosen ?? '', target, confirm }
    try {
      if (button === null) await api.createTableButton(table, input)
      else await api.updateTableButton(table, button.id, input)
      onSaved()
      onClose()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (button === null) return
    setBusy(true)
    try {
      await api.deleteTableButton(table, button.id)
      onSaved()
      onClose()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  const ready =
    label.trim() !== '' &&
    (action === 'url' ? /^(https?:\/\/|mailto:)/i.test(url.trim()) : chosen !== null)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {button === null ? $t('Nouveau bouton') : $t('Modifier le bouton')}
          </DialogTitle>
          <DialogDescription>
            {$t(
              'Il s’affiche dans la barre de toutes les vues grille de « {table} », pour tous ceux qui la lisent.',
              {
                table: table.label,
              },
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="table-button-label">{$t('Libellé')}</Label>
            <Input
              id="table-button-label"
              value={label}
              maxLength={60}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={$t('Relancer le client')}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">{$t('Couleur')}</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setColor(null)}
                aria-pressed={color === null}
                className={cn(
                  'rounded-md border px-2 py-0.5 text-xs',
                  color === null ? 'border-primary bg-primary/5' : 'hover:bg-accent',
                )}
              >
                {$t('Aucune')}
              </button>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'size-6 rounded-full ring-offset-2 ring-offset-background',
                    color === c && 'ring-2 ring-foreground/60',
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={$t('Couleur {color}', { color: c })}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">{$t('Action')}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  ['automation', $t('Lancer une automatisation'), Zap],
                  ['url', $t('Ouvrir une adresse'), ExternalLink],
                ] as const
              ).map(([value, text, Icon]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={action === value}
                  onClick={() => setAction(value)}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm',
                    action === value ? 'border-primary bg-primary/5' : 'hover:bg-accent',
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {text}
                </button>
              ))}
            </div>
          </div>

          {action === 'url' ? (
            <div className="space-y-1.5">
              <Label htmlFor="table-button-url">{$t('Adresse')}</Label>
              <Input
                id="table-button-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://"
              />
              <p className="text-xs text-muted-foreground">
                {$t(
                  'Une page web (https://) ou un courriel (mailto:), ouvert dans un nouvel onglet.',
                )}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="table-button-target">{$t('Sur quelles lignes')}</Label>
                <Choice
                  id="table-button-target"
                  value={target}
                  onValueChange={(v) => setTarget(v as TableButton['target'])}
                  options={TARGETS}
                  aria-label={$t('Sur quelles lignes')}
                />
                <p className="text-xs text-muted-foreground">
                  {target === 'selection'
                    ? $t('Une exécution par ligne cochée, 100 au plus.')
                    : target === 'view'
                      ? $t(
                          'Une exécution par ligne de la vue, son filtre compris, 100 au plus ; une confirmation est toujours demandée.',
                        )
                      : $t(
                          'Une seule exécution, pour une automatisation sans table : planifiée ou appelée par son adresse.',
                        )}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="table-button-automation">{$t('Automatisation')}</Label>
                <Choice
                  id="table-button-automation"
                  value={chosen}
                  onValueChange={setAutomation}
                  options={fitting.map((a) => ({ value: a.id, label: a.label }))}
                  placeholder={
                    automations === null
                      ? $t('Chargement…')
                      : fitting.length === 0
                        ? $t('Aucune automatisation ne convient')
                        : $t('Choisir une automatisation')
                  }
                  disabled={fitting.length === 0}
                  aria-label={$t('Automatisation')}
                />
                {automations !== null && fitting.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {target === 'none'
                      ? $t(
                          'Créez d’abord une automatisation planifiée ou déclenchée par son adresse.',
                        )
                      : $t(
                          'Créez d’abord une automatisation déclenchée par un bouton sur cette table.',
                        )}
                  </p>
                )}
              </div>
            </>
          )}

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="table-button-confirm" className="font-normal">
              {$t('Demander confirmation avant de lancer')}
            </Label>
            <Switch id="table-button-confirm" checked={confirm} onCheckedChange={setConfirm} />
          </div>

          {error !== null && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          {button !== null ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={$t('Autres actions')}>
                  <Ellipsis className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  variant="destructive"
                  disabled={busy}
                  onSelect={() => void remove()}
                >
                  <Trash2 className="size-4" />
                  {$t('Supprimer le bouton')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              {$t('Annuler')}
            </Button>
            <Button onClick={() => void save()} disabled={busy || !ready}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {$t('Enregistrer')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
