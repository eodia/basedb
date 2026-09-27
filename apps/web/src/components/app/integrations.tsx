'use client'

import { SidebarToggle } from '@/components/app/sidebar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Hint } from '@/components/ui/tooltip'
import {
  type DescribedBase,
  type Integration,
  type SyncSourceKind,
  type SyncedTable,
  api,
} from '@/lib/api/client'
import { relativeTime } from '@/lib/collab'
import { $t } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import {
  CalendarDays,
  CircleAlert,
  CircleCheck,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Trash2,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

/**
 * The integrations of a base — chapter 19, on screen: its Slack connections, its synced
 * tables and how they are doing, and how to see a view in Google Agenda. For whoever
 * builds the base.
 */

const SOURCES: ReadonlyArray<{
  kind: SyncSourceKind
  label: string
  hint: string
  placeholder: string
}> = [
  {
    kind: 'csv',
    label: $t('Fichier CSV en ligne'),
    hint: $t(
      'Un export publié, une feuille de calcul publiée au format CSV. Les colonnes sont typées d’après leur contenu.',
    ),
    placeholder: 'https://exemple.fr/export/stock.csv',
  },
  {
    kind: 'ics',
    label: $t('Agenda (Google Agenda, iCalendar)'),
    hint: $t('Dans Google Agenda : Paramètres de l’agenda → « Adresse secrète au format iCal ».'),
    placeholder: 'https://calendar.google.com/calendar/ical/…/basic.ics',
  },
  {
    kind: 'basedb',
    label: $t('Vue partagée d’un basedb'),
    hint: $t(
      'Le lien de la vue partagée (ou de son API) : ses champs et ses lignes, tels que son propriétaire les montre.',
    ),
    placeholder: 'https://…/api/v1/views/…',
  },
]

export function IntegrationsPanel({
  base,
  onBack,
  onChanged,
}: {
  readonly base: DescribedBase
  readonly onBack: () => void
  /** A table appeared, or became an ordinary one: the base is to be reread. */
  readonly onChanged: () => void
}) {
  const builds = base.actions.includes('manage_schema')
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <SidebarToggle />
        <span className="text-sm text-muted-foreground">{base.label}</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">{$t('Intégrations')}</span>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={onBack}>
          {$t('Retour aux données')}
        </Button>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto scroll-discret">
        {builds ? (
          <div className="mx-auto max-w-3xl space-y-10 px-6 py-6">
            <Slack base={base} />
            <Synced base={base} onChanged={onChanged} />
            <Agenda />
          </div>
        ) : (
          <p className="p-10 text-center text-sm text-muted-foreground">
            {$t('Les intégrations d’une base sont réglées par ceux qui la construisent.')}
          </p>
        )}
      </main>
    </div>
  )
}

function Section({
  icon,
  title,
  hint,
  action,
  children,
}: {
  readonly icon: ReactNode
  readonly title: string
  readonly hint: string
  readonly action?: ReactNode
  readonly children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-muted-foreground">{icon}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Slack({ base }: { readonly base: DescribedBase }) {
  const [items, setItems] = useState<readonly Integration[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setItems(await api.integrations(base.name))
    } catch (e) {
      setError(messageFor(e))
    }
  }, [base.name])
  useEffect(() => {
    void load()
  }, [load])

  const test = async (item: Integration) => {
    try {
      await api.testIntegration(base.name, item.id)
      toast($t('Message d’essai envoyé à « {label} »', { label: item.label }))
    } catch (e) {
      toast.error(messageFor(e))
    }
  }

  return (
    <Section
      icon={<MessageSquare className="size-5" />}
      title={$t('Slack')}
      hint={$t(
        'Un canal Slack, prévenu par les automatisations de la base (action « Envoyer sur Slack »).',
      )}
      action={
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAdding(true)}>
          <Plus className="size-4" />
          {$t('Connecter un canal')}
        </Button>
      }
    >
      {error !== null && <p className="text-sm text-destructive">{error}</p>}
      {items === null && error === null && (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      )}
      {items?.length === 0 && (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          {$t(
            'Aucun canal connecté. Dans Slack, créez un « webhook entrant » pour le canal voulu, puis collez son adresse ici.',
          )}
        </p>
      )}
      {items !== null && items.length > 0 && (
        <div className="divide-y rounded-lg border">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{item.label}</span>
                <span className="block font-mono text-xs text-muted-foreground">
                  {$t('hooks.slack.com {hint}', { hint: item.hint })}
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => void test(item)}
              >
                <Send className="size-3.5" />
                {$t('Tester')}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={$t('Supprimer {label}', { label: item.label })}
                onClick={async () => {
                  await api
                    .deleteIntegration(base.name, item.id)
                    .catch((e) => setError(messageFor(e)))
                  void load()
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <SlackDialog
        open={adding}
        base={base}
        onClose={() => setAdding(false)}
        onDone={() => {
          setAdding(false)
          void load()
        }}
      />
    </Section>
  )
}

function SlackDialog({
  open,
  base,
  onClose,
  onDone,
}: {
  readonly open: boolean
  readonly base: DescribedBase
  readonly onClose: () => void
  readonly onDone: () => void
}) {
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    setLabel('')
    setUrl('')
    setError(null)
  }, [open])
  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.createIntegration(base.name, { label: label.trim(), url: url.trim() })
      onDone()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{$t('Connecter un canal Slack')}</DialogTitle>
          <DialogDescription>
            {$t(
              'L’adresse du webhook entrant vaut autorisation : elle est scellée, et ne sera plus jamais affichée en entier.',
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="slack-label">{$t('Nom')}</Label>
            <Input
              id="slack-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="#chantier"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slack-url">{$t('Adresse du webhook entrant')}</Label>
            <Input
              id="slack-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/…"
              className="font-mono text-xs"
            />
          </div>
          {error !== null && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {$t('Annuler')}
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={busy || label.trim() === '' || url.trim() === ''}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {$t('Connecter')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SyncStatus({ table }: { readonly table: SyncedTable }) {
  if (table.last_status === null)
    return <span className="text-muted-foreground">{$t('Jamais synchronisée')}</span>
  const counts = table.last_counts
  return (
    <span
      className={cn(
        'flex items-center gap-1',
        table.last_status === 'failed' && 'text-destructive',
      )}
    >
      {table.last_status === 'ok' ? (
        <CircleCheck className="size-3.5 text-emerald-600" />
      ) : (
        <CircleAlert className="size-3.5" />
      )}
      {table.last_synced_at === null ? '' : relativeTime(table.last_synced_at)}
      {table.last_status === 'ok' && counts !== null && (
        <span className="text-muted-foreground">
          · +{counts.created} ~{counts.updated} −{counts.deleted}
        </span>
      )}
      {table.last_status === 'failed' && table.last_error !== null && (
        <span>· {table.last_error}</span>
      )}
    </span>
  )
}

function Synced({
  base,
  onChanged,
}: {
  readonly base: DescribedBase
  readonly onChanged: () => void
}) {
  const [items, setItems] = useState<readonly SyncedTable[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setItems(await api.syncedTables(base.name))
    } catch (e) {
      setError(messageFor(e))
    }
  }, [base.name])
  useEffect(() => {
    void load()
  }, [load])

  const run = async (table: SyncedTable) => {
    setBusy(table.table)
    try {
      const result = await api.runSyncedTable(base.name, table.table)
      const c = result.last_counts
      toast(
        $t('« {label} » synchronisée{value}', {
          label: table.label,
          value: c === null ? '' : ` : +${c.created} ~${c.updated} −${c.deleted}`,
        }),
      )
    } catch (e) {
      toast.error(messageFor(e))
    } finally {
      setBusy(null)
      void load()
    }
  }

  return (
    <Section
      icon={<RefreshCw className="size-5" />}
      title={$t('Tables synchronisées')}
      hint={$t(
        'Des tables tenues à jour depuis une source : un fichier CSV, un agenda, la vue d’une autre base. Elles se lisent comme les autres, mais ne s’écrivent pas à la main.',
      )}
      action={
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAdding(true)}>
          <Plus className="size-4" />
          {$t('Nouvelle table synchronisée')}
        </Button>
      }
    >
      {error !== null && <p className="text-sm text-destructive">{error}</p>}
      {items === null && error === null && (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      )}
      {items?.length === 0 && (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          {$t('Aucune table synchronisée.')}
        </p>
      )}
      {items !== null && items.length > 0 && (
        <div className="divide-y rounded-lg border">
          {items.map((table) => (
            <div key={table.table_id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{table.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {$t('{label} · {host} · toutes les {interval_minutes} min', {
                    label: SOURCES.find((s) => s.kind === table.source_kind)?.label,
                    host: table.host,
                    interval_minutes: table.interval_minutes,
                  })}
                </span>
                <span className="block text-xs">
                  <SyncStatus table={table} />
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={busy === table.table}
                onClick={() => void run(table)}
              >
                <RefreshCw className={cn('size-3.5', busy === table.table && 'animate-spin')} />
                {$t('Synchroniser')}
              </Button>
              <Hint label={$t('La table redevient une table ordinaire, avec ses lignes')}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={async () => {
                    await api
                      .stopSyncedTable(base.name, table.table)
                      .catch((e) => setError(messageFor(e)))
                    void load()
                    onChanged()
                  }}
                >
                  {$t('Arrêter')}
                </Button>
              </Hint>
            </div>
          ))}
        </div>
      )}
      <SyncDialog
        open={adding}
        base={base}
        onClose={() => setAdding(false)}
        onDone={(created) => {
          setAdding(false)
          toast(
            $t('Table « {label} » créée : {value} lignes', {
              label: created.label,
              value: created.last_counts?.created ?? 0,
            }),
          )
          void load()
          onChanged()
        }}
      />
    </Section>
  )
}

function SyncDialog({
  open,
  base,
  onClose,
  onDone,
}: {
  readonly open: boolean
  readonly base: DescribedBase
  readonly onClose: () => void
  readonly onDone: (created: SyncedTable) => void
}) {
  const [kind, setKind] = useState<SyncSourceKind>('csv')
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [interval, setInterval_] = useState(60)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    setKind('csv')
    setLabel('')
    setUrl('')
    setInterval_(60)
    setError(null)
  }, [open])
  const source = SOURCES.find((s) => s.kind === kind) ?? SOURCES[0]
  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      onDone(
        await api.createSyncedTable(base.name, {
          label: label.trim(),
          source: { kind, url: url.trim() },
          interval_minutes: interval,
        }),
      )
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{$t('Nouvelle table synchronisée')}</DialogTitle>
          <DialogDescription>
            {$t(
              'La table est créée avec les colonnes de la source, puis tenue à jour par le serveur.',
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-1.5">
            {SOURCES.map((s) => (
              <button
                key={s.kind}
                type="button"
                aria-pressed={kind === s.kind}
                onClick={() => setKind(s.kind)}
                className={cn(
                  'rounded-lg border p-2.5 text-left text-sm hover:bg-accent/60',
                  kind === s.kind && 'border-primary bg-primary/5 ring-1 ring-primary',
                )}
              >
                <span className="block font-medium">{s.label}</span>
                <span className="block text-xs text-muted-foreground">{s.hint}</span>
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sync-label">{$t('Nom de la table')}</Label>
            <Input
              id="sync-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={$t('Stock')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sync-url">{$t('Adresse de la source')}</Label>
            <Input
              id="sync-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={source?.placeholder}
              className="font-mono text-xs"
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Label htmlFor="sync-interval">{$t('Synchroniser toutes les')}</Label>
            <Input
              id="sync-interval"
              type="number"
              min={15}
              max={1440}
              value={interval}
              onChange={(e) => setInterval_(Number(e.target.value))}
              className="h-8 w-24"
            />
            <span className="text-muted-foreground">{$t('minutes')}</span>
          </div>
          {error !== null && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {$t('Annuler')}
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={busy || label.trim() === '' || url.trim() === ''}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? $t('Lecture de la source…') : $t('Créer la table')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Agenda() {
  return (
    <Section
      icon={<CalendarDays className="size-5" />}
      title={$t('Google Agenda')}
      hint={$t('Voir les échéances de la base dans un agenda, ou importer un agenda dans la base.')}
    >
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
        <li>
          <span className="text-foreground">{$t('Voir une vue dans un agenda')}</span>{' '}
          {$t(
            ': partagez publiquement une vue calendrier ou chronologie ; son dialogue de partage donne l’adresse de son flux iCalendar. Dans Google Agenda : « Autres agendas » → « À partir de l’URL ».',
          )}
        </li>
        <li>
          <span className="text-foreground">{$t('Importer un agenda')}</span>{' '}
          {$t(
            ': créez une table synchronisée de source « Agenda » avec l’adresse secrète iCal de l’agenda Google.',
          )}
        </li>
      </ol>
    </Section>
  )
}
