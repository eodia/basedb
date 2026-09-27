'use client'

import { CodeGroup } from '@/components/api-reference/code-block'
import { cancelled, useElevated } from '@/components/app/elevation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { type Webhook, type WebhookDelivery, type WebhookEvent, api } from '@/lib/api/client'
import { $t, intlLocale } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { ChevronDown, Loader2, Pause, Play, Trash2, Webhook as WebhookIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

/**
 * The webhooks of a base — chapter 08 §10: another system told, within the second, that a
 * row was created, modified or deleted, with the row before and after, signed.
 *
 * Everything that leaves goes to an HTTPS address that is publicly routable: a webhook
 * must not become a way to reach the instance's own network. The signing secret is shown
 * once, like a token's. What the list shows of a delivery is its state and the HTTP code
 * the other side answered — never the network detail, which is what a scanner would want.
 */

const EVENTS: ReadonlyArray<{ id: WebhookEvent; label: string }> = [
  { id: 'create', label: $t('Création||écriture qui déclenche un webhook') },
  { id: 'update', label: $t('Modification||écriture qui déclenche un webhook') },
  { id: 'delete', label: $t('Suppression||écriture qui déclenche un webhook') },
]

const STATUS: Readonly<Record<string, string>> = {
  pending: $t('En attente'),
  in_flight: $t('En cours'),
  delivered: $t('Livrée'),
  failed: $t('Échec'),
  abandoned: $t('Abandonnée'),
}

const REASON: Readonly<Record<string, string>> = {
  failures: $t('arrêté après des échecs répétés'),
  field_masked: $t('arrêté : un champ lui est devenu invisible'),
  manual: $t('arrêté'),
}

const TIME = new Intl.DateTimeFormat(intlLocale(), { dateStyle: 'short', timeStyle: 'medium' })

/** How the other side checks a delivery: the HMAC of the raw body (§10.5). */
function verification(): { lang: string; title: string; body: string }[] {
  return [
    {
      lang: 'js',
      title: $t('Vérifier la signature (Node.js)'),
      body: [
        "import { createHmac, timingSafeEqual } from 'node:crypto'",
        '',
        `// ${$t('header : X-Basedb-Signature, « t=1758204180,v1=… » ; body : le corps BRUT reçu.')}`,
        'function authentique(header, body, secret) {',
        "  const { t, v1 } = Object.fromEntries(header.split(',').map((p) => p.split('=')))",
        "  const attendu = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')",
        '  const frais = Math.abs(Date.now() / 1000 - Number(t)) < 300',
        "  return frais && timingSafeEqual(Buffer.from(v1, 'hex'), Buffer.from(attendu, 'hex'))",
        '}',
      ].join('\n'),
    },
  ]
}

export function WebhookDialog({
  open,
  base,
  onClose,
}: {
  readonly open: boolean
  readonly base: {
    readonly name: string
    readonly label: string
    readonly tables: ReadonlyArray<{ readonly name: string; readonly label: string }>
  }
  readonly onClose: () => void
}) {
  const elevated = useElevated()
  const [hooks, setHooks] = useState<readonly Webhook[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [issued, setIssued] = useState<{ label: string; secret: string } | null>(null)
  const [openDeliveries, setOpenDeliveries] = useState<string | null>(null)

  // The form of a new webhook.
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('https://')
  const [chosen, setChosen] = useState<Readonly<Record<string, readonly WebhookEvent[]>>>({})

  const load = useCallback(async () => {
    try {
      setHooks(await api.webhooks(base.name))
    } catch (e) {
      setHooks([])
      setError(messageFor(e))
    }
  }, [base.name])

  useEffect(() => {
    if (!open) return
    setHooks(null)
    setError(null)
    setIssued(null)
    setLabel('')
    setUrl('https://')
    setChosen({})
    setOpenDeliveries(null)
    void load()
  }, [open, load])

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await elevated(fn)
      await load()
    } catch (e) {
      if (!cancelled(e)) setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  const toggle = (table: string, event: WebhookEvent, on: boolean) =>
    setChosen((was) => {
      const current = new Set(was[table] ?? [])
      if (on) current.add(event)
      else current.delete(event)
      return { ...was, [table]: EVENTS.map((e) => e.id).filter((id) => current.has(id)) }
    })

  const subscriptions = Object.entries(chosen)
    .filter(([, events]) => events.length > 0)
    .map(([table, events]) => ({ table, events }))
  const ready =
    label.trim() !== '' && /^https?:\/\/.+/.test(url) && subscriptions.length > 0 && !busy

  const create = () =>
    act(async () => {
      const created = await api.createWebhook({
        base: base.name,
        label: label.trim(),
        url: url.trim(),
        subscriptions,
      })
      setIssued({ label: created.label, secret: created.secret })
      setLabel('')
      setUrl('https://')
      setChosen({})
    })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{$t('Webhooks — {label}', { label: base.label })}</DialogTitle>
          <DialogDescription>
            {$t(
              'Un webhook prévient un autre système, dans la seconde, qu’une ligne a été créée, modifiée ou supprimée — y compris en SQL direct —, avec la ligne complète avant et après. Chaque envoi est signé.',
            )}
          </DialogDescription>
        </DialogHeader>

        {issued !== null ? (
          <div className="min-w-0 space-y-3">
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
              {$t(
                'Copiez le secret de « {label} » maintenant : il ne sera plus jamais affiché. Il sert au système destinataire à vérifier que chaque envoi vient bien d’ici.',
                { label: issued.label },
              )}
            </p>
            <code className="block break-all rounded-md border bg-muted px-3 py-2 font-mono text-sm select-all">
              {issued.secret}
            </code>
            <CodeGroup blocks={verification()} />
            <DialogFooter>
              <Button onClick={() => setIssued(null)}>{$t('Terminé')}</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="min-w-0 space-y-5">
            <section className="space-y-2">
              <h3 className="text-sm font-medium">{$t('Webhooks de cette base')}</h3>
              {hooks === null ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> {$t('Chargement…')}
                </p>
              ) : hooks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {$t('Aucun webhook pour l’instant.')}
                </p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {hooks.map((hook) => (
                    <li key={hook.id} className="px-3 py-2.5 text-sm">
                      <div className="flex items-start gap-3">
                        <WebhookIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{hook.label}</span>
                            {hook.active ? (
                              <Badge variant="secondary">{$t('Actif')}</Badge>
                            ) : (
                              <Badge variant="outline">
                                {REASON[hook.disabled_reason ?? 'manual'] ?? $t('arrêté')}
                              </Badge>
                            )}
                          </div>
                          <p className="truncate font-mono text-[11px] text-muted-foreground">
                            {hook.url}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {hook.subscriptions
                              .map(
                                (s) =>
                                  `${s.table_label} (${s.events
                                    .map((e) => EVENTS.find((x) => x.id === e)?.label.toLowerCase())
                                    .join(', ')})`,
                              )
                              .join(' · ')}
                          </p>
                          {hook.last_delivery !== null && (
                            <p className="text-xs text-muted-foreground">
                              {$t('Dernier envoi : {value}{value2} — {format}', {
                                value:
                                  STATUS[hook.last_delivery.status] ?? hook.last_delivery.status,
                                value2:
                                  hook.last_delivery.response_code !== null &&
                                  ` (${hook.last_delivery.response_code})`,
                                format: TIME.format(new Date(hook.last_delivery.at)),
                              })}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Hint label={hook.active ? $t('Arrêter') : $t('Reprendre')}>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={
                                hook.active
                                  ? $t('Arrêter {label}', { label: hook.label })
                                  : $t('Reprendre {label}', { label: hook.label })
                              }
                              disabled={busy}
                              onClick={() =>
                                void act(() => api.setWebhookActive(hook.id, !hook.active))
                              }
                            >
                              {hook.active ? (
                                <Pause className="size-4" />
                              ) : (
                                <Play className="size-4" />
                              )}
                            </Button>
                          </Hint>
                          <Hint label={$t('Supprimer')}>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive"
                              aria-label={$t('Supprimer {label}', { label: hook.label })}
                              disabled={busy}
                              onClick={() => void act(() => api.deleteWebhook(hook.id))}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </Hint>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenDeliveries((was) => (was === hook.id ? null : hook.id))
                        }
                        className="mt-1.5 ml-7 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <ChevronDown
                          className={cn(
                            'size-3 transition-transform',
                            openDeliveries === hook.id && 'rotate-180',
                          )}
                        />
                        {$t('Derniers envois')}
                      </button>
                      {openDeliveries === hook.id && <Deliveries webhookId={hook.id} />}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-medium">{$t('Nouveau webhook')}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="webhook-label">{$t('Nom')}</Label>
                  <Input
                    id="webhook-label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder={$t('Synchronisation ERP')}
                    maxLength={200}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="webhook-url">{$t('Adresse (HTTPS)')}</Label>
                  <Input
                    id="webhook-url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://exemple.fr/basedb"
                    inputMode="url"
                  />
                </div>
              </div>
              <fieldset className="space-y-1.5">
                <legend className="mb-1.5 text-sm font-medium">{$t('Quand prévenir')}</legend>
                <div className="overflow-hidden rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-medium">{$t('Table')}</th>
                        {EVENTS.map((e) => (
                          <th key={e.id} className="px-3 py-1.5 font-medium">
                            {e.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {base.tables.map((t) => (
                        <tr key={t.name}>
                          <td className="px-3 py-1.5">{t.label}</td>
                          {EVENTS.map((e) => (
                            <td key={e.id} className="px-3 py-1.5 text-center">
                              <Checkbox
                                aria-label={$t('{label} dans {label2}', {
                                  label: e.label,
                                  label2: t.label,
                                })}
                                checked={(chosen[t.name] ?? []).includes(e.id)}
                                onCheckedChange={(on) => toggle(t.name, e.id, on === true)}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  {$t(
                    'Vous devez pouvoir lire tous les champs des tables choisies : un envoi n’est jamais amputé d’un champ.',
                  )}
                </p>
              </fieldset>
            </section>

            {error !== null && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={onClose} disabled={busy}>
                {$t('Fermer')}
              </Button>
              <Button onClick={() => void create()} disabled={!ready}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {$t('Créer le webhook')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** The last deliveries of a webhook: state, attempts, the code the other side answered. */
function Deliveries({ webhookId }: { readonly webhookId: string }) {
  const [rows, setRows] = useState<readonly WebhookDelivery[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.webhookDeliveries(webhookId).then(setRows, (e: unknown) => {
      setRows([])
      setError(messageFor(e))
    })
  }, [webhookId])

  if (rows === null) {
    return <Loader2 className="mt-2 ml-7 size-4 animate-spin text-muted-foreground" />
  }
  if (error !== null) return <p className="mt-2 ml-7 text-xs text-destructive">{error}</p>
  if (rows.length === 0) {
    return (
      <p className="mt-2 ml-7 text-xs text-muted-foreground">{$t('Rien n’a encore été envoyé.')}</p>
    )
  }
  return (
    <ul className="mt-2 ml-7 space-y-1 text-xs">
      {rows.slice(0, 20).map((d) => (
        <li key={d.id} className="flex flex-wrap items-center gap-x-2 text-muted-foreground">
          <span
            className={cn(
              'font-medium',
              d.status === 'delivered' && 'text-emerald-600 dark:text-emerald-400',
              d.status === 'failed' && 'text-destructive',
            )}
          >
            {STATUS[d.status] ?? d.status}
          </span>
          <span>{TIME.format(new Date(d.created_at))}</span>
          <span>
            {d.table_label ?? '—'} ·{' '}
            {d.op === 'insert'
              ? $t('création')
              : d.op === 'update'
                ? $t('modification')
                : $t('suppression')}
          </span>
          {d.response_code !== null && (
            <span>{$t('HTTP {response_code}', { response_code: d.response_code })}</span>
          )}
          {d.attempts > 1 && <span>{$t('{attempts} tentatives', { attempts: d.attempts })}</span>}
          {d.status === 'pending' && d.next_attempt_at !== null && (
            <span>
              {$t('nouvel essai {format}', { format: TIME.format(new Date(d.next_attempt_at)) })}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
