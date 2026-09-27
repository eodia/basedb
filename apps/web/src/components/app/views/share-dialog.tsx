'use client'

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
import { Switch } from '@/components/ui/switch'
import {
  type FormSharing,
  type ShareAccess,
  type ShareState,
  type TableRef,
  type ViewKind,
  api,
  calendarFeedUrl,
  sharedViewApiUrl,
} from '@/lib/api/client'
import { $t, $tp, groupName, intlLocale } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Code2,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  RefreshCw,
  Users,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useState } from 'react'

/**
 * Sharing a view — chapter 15, on screen.
 *
 * One link per view. PUBLIC, anyone who has it opens it, with no account; for MEMBERS, the
 * person signs in first — and the link can be kept to some groups. Either way it needs no
 * right on the table: a form's answer is written, a data view's rows are read, on the
 * authority of whoever saved the sharing last, which the dialog says, since it is what
 * suspends the link if that right goes.
 *
 * A form is ANSWERED at `/f/<jeton>`, until a date or a number of answers; any other view
 * is READ at `/v/<jeton>` (§10), and may be framed by another site.
 */

const DATE = new Intl.DateTimeFormat(intlLocale(), { dateStyle: 'medium', timeStyle: 'short' })

const STATE: Readonly<Record<ShareState, { label: string; tone: string }>> = {
  open: { label: $t('Ouvert'), tone: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300' },
  inactive: { label: $t('Désactivé'), tone: 'bg-muted text-muted-foreground' },
  closed: { label: $t('Fermé'), tone: 'bg-muted text-muted-foreground' },
  full: { label: $t('Complet'), tone: 'bg-amber-500/15 text-amber-800 dark:text-amber-300' },
  authority: { label: $t('Suspendu'), tone: 'bg-rose-500/15 text-rose-800 dark:text-rose-300' },
}

/** `2026-10-01T18:00:00.000Z` → the value of a `datetime-local` input, in local time. */
function toLocalInput(iso: string | null): string {
  if (iso === null) return ''
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Whether a view is answered through its link — a form — rather than read. */
export const answered = (kind: ViewKind) => kind === 'form' || kind === 'survey'

export function shareUrl(token: string, kind: ViewKind = 'form'): string {
  return `${window.location.origin}/${answered(kind) ? 'f' : 'v'}/${token}`
}

/** The code another site pastes to frame a shared view. */
export const embedCode = (url: string, title: string) =>
  `<iframe src="${url}?embed=1" title="${title.replace(/"/g, '&quot;')}" width="100%" height="560" style="border:1px solid #e5e7eb;border-radius:8px" loading="lazy"></iframe>`

export function AccessChoice({
  value,
  onChange,
  disabled,
  reading,
  subject = $t('la vue'),
}: {
  readonly value: ShareAccess
  readonly onChange: (value: ShareAccess) => void
  readonly disabled: boolean
  /** A view to read, not a form to answer: the words change. */
  readonly reading: boolean
  /** What is read, in the sentences: « la vue », « le tableau de bord ». */
  readonly subject?: string
}) {
  const choices: ReadonlyArray<{
    value: ShareAccess
    icon: typeof Globe
    title: string
    text: string
  }> = [
    {
      value: 'public',
      icon: Globe,
      title: $t('Public'),
      text: reading
        ? $t('Toute personne qui a le lien lit {subject}, sans compte.', { subject })
        : $t('Toute personne qui a le lien répond, sans compte.'),
    },
    {
      value: 'members',
      icon: Users,
      title: $t('Membres connectés'),
      text: reading
        ? $t('La personne se connecte d’abord pour lire {subject}.', { subject })
        : $t('La personne se connecte d’abord ; sa réponse porte son nom.'),
    },
  ]
  return (
    <fieldset className="grid gap-2 sm:grid-cols-2">
      <legend className="sr-only">{reading ? $t('Qui peut lire') : $t('Qui peut répondre')}</legend>
      {choices.map((choice) => (
        <label
          key={choice.value}
          htmlFor={`share-access-${choice.value}`}
          className={cn(
            'flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-left transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
            value === choice.value
              ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
              : 'hover:bg-accent',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <input
            id={`share-access-${choice.value}`}
            type="radio"
            name="share-access"
            value={choice.value}
            checked={value === choice.value}
            disabled={disabled}
            onChange={() => onChange(choice.value)}
            className="sr-only"
          />
          <choice.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>
            <span className="block text-sm font-medium">{choice.title}</span>
            <span className="block text-xs text-muted-foreground">{choice.text}</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}

/** An address to copy, with what it is for. */
export function CopyRow({
  icon,
  hint,
  value,
  label,
  copied,
  onCopy,
}: {
  readonly icon: ReactNode
  readonly hint: string
  readonly value: string
  readonly label: string
  readonly copied: boolean
  readonly onCopy: () => void
}) {
  return (
    <div className="space-y-1.5">
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <span className="mt-0.5 shrink-0">{icon}</span>
        {hint}
      </p>
      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          aria-label={label}
          className="h-8 font-mono text-xs"
        />
        <Button variant="outline" size="icon-sm" onClick={onCopy} aria-label={`Copier : ${label}`}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  )
}

export function ShareFormDialog({
  table,
  view,
  onClose,
}: {
  readonly table: TableRef & { readonly label: string }
  /** The view to share — `null` closes the dialog. */
  readonly view: { readonly id: string; readonly label: string; readonly kind: ViewKind } | null
  readonly onClose: () => void
}) {
  const reading = view !== null && !answered(view.kind)
  const [sharing, setSharing] = useState<FormSharing | null>(null)
  const [access, setAccess] = useState<ShareAccess>('public')
  const [active, setActive] = useState(true)
  const [closesAt, setClosesAt] = useState('')
  const [maxResponses, setMaxResponses] = useState('')
  const [groups, setGroups] = useState<ReadonlySet<string>>(new Set())
  const [canEmbed, setCanEmbed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<'link' | 'code' | 'feed' | 'api' | null>(null)
  const [renewing, setRenewing] = useState(false)

  /** The form reflects what the server holds — after a load, and after every save. */
  const adopt = useCallback((next: FormSharing) => {
    setSharing(next)
    const share = next.share
    setAccess(share?.access ?? 'public')
    setActive(share?.active ?? true)
    setClosesAt(toLocalInput(share?.closes_at ?? null))
    setMaxResponses(share?.max_responses == null ? '' : String(share.max_responses))
    setGroups(new Set(share?.groups ?? []))
    setCanEmbed(share?.can_embed ?? false)
  }, [])

  const viewId = view?.id ?? null
  // Keyed on the table's names, not on the object a parent may rebuild at every render.
  const { base, name } = table
  useEffect(() => {
    if (viewId === null) {
      setSharing(null)
      setError(null)
      setRenewing(false)
      return
    }
    api.formSharing({ base, name }, viewId).then(adopt, (e) => setError(messageFor(e)))
  }, [base, name, viewId, adopt])

  const maxOk = maxResponses.trim() === '' || /^[1-9]\d{0,6}$/.test(maxResponses.trim())

  const save = async (overrides: Partial<{ active: boolean; canEmbed: boolean }> = {}) => {
    if (viewId === null || !maxOk) return
    setBusy(true)
    setError(null)
    try {
      adopt(
        await api.saveFormSharing(table, viewId, {
          access,
          active: overrides.active ?? active,
          // Read, a view is neither closed at a date nor filled up (§10).
          closes_at: reading || closesAt === '' ? null : new Date(closesAt).toISOString(),
          max_responses: reading || maxResponses.trim() === '' ? null : Number(maxResponses.trim()),
          groups: access === 'members' ? [...groups] : [],
          can_embed: reading && (overrides.canEmbed ?? canEmbed),
        }),
      )
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  const act = async (work: () => Promise<FormSharing | undefined>) => {
    setBusy(true)
    setError(null)
    try {
      const next = await work()
      if (next !== undefined) adopt(next)
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  const share = sharing?.share ?? null
  const url =
    share === null || share.token === '' || view === null ? null : shareUrl(share.token, view.kind)
  const code = url === null || view === null ? null : embedCode(url, view.label)
  // Chapter 19: what an agenda subscribes to, what another base synchronises from — both
  // read without an account, so a public link only.
  const open = share !== null && share.token !== '' && share.access === 'public'
  const feed =
    open && reading && (view?.kind === 'calendar' || view?.kind === 'timeline')
      ? calendarFeedUrl(share.token)
      : null
  const apiUrl = open && reading ? sharedViewApiUrl(share.token) : null

  const copy = async (what: 'link' | 'code' | 'feed' | 'api') => {
    const text = { link: url, code, feed, api: apiUrl }[what]
    if (text === null) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // A browser without clipboard access: the text stays selectable in its box.
    }
  }

  return (
    <Dialog open={view !== null} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{$t('Partager « {label} »', { label: view?.label })}</DialogTitle>
          <DialogDescription>
            {reading ? (
              <>
                {$t(
                  'Lire ne demande aucun droit sur la table : le lien montre les lignes et les champs de la vue, avec son filtre et son tri, sans rien permettre d’y changer.',
                )}
              </>
            ) : (
              <>
                {$t(
                  'Répondre ne demande aucun droit sur la table : chaque réponse ajoute une ligne à « {label} », et rien d’autre de la table n’est montré.',
                  { label: table.label },
                )}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {sharing === null && error === null ? (
          <div className="py-10 text-center">
            <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            {share !== null && (
              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      STATE[share.state].tone,
                    )}
                  >
                    {STATE[share.state].label}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {reading
                      ? $t('Lecture seule')
                      : $tp(share.response_count, '{count} réponse', '{count} réponses')}
                    {!reading &&
                      share.last_response_at !== null &&
                      $t(' · dernière le {format}', {
                        format: DATE.format(new Date(share.last_response_at)),
                      })}
                  </span>
                  <Label htmlFor="share-active" className="text-xs font-normal">
                    {$t('Lien actif')}
                  </Label>
                  <Switch
                    id="share-active"
                    checked={active}
                    disabled={busy}
                    onCheckedChange={(checked) => {
                      setActive(checked)
                      void save({ active: checked })
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={url ?? 'Lien illisible : régénérez-le.'}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label={reading ? $t('Lien de la vue') : $t('Lien du formulaire')}
                    className="h-8 font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => void copy('link')}
                    disabled={url === null}
                    aria-label={$t('Copier le lien')}
                    title={$t('Copier le lien')}
                  >
                    {copied === 'link' ? <Check className="size-4" /> : <Copy className="size-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    asChild={url !== null}
                    disabled={url === null}
                    aria-label={reading ? $t('Ouvrir la vue') : $t('Ouvrir le formulaire')}
                    title={reading ? $t('Ouvrir la vue') : $t('Ouvrir le formulaire')}
                  >
                    {url === null ? (
                      <ExternalLink className="size-4" />
                    ) : (
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="size-4" />
                      </a>
                    )}
                  </Button>
                </div>
                {renewing ? (
                  <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-xs">
                    <span className="min-w-0 flex-1">
                      {$t(
                        'L’ancien lien cessera de fonctionner immédiatement, pour tous ceux qui l’ont reçu.',
                      )}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setRenewing(false)}>
                      {$t('Annuler')}
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setRenewing(false)
                        if (viewId !== null) {
                          void act(() => api.regenerateFormShare(table, viewId))
                        }
                      }}
                    >
                      {$t('Régénérer')}
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRenewing(true)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className="size-3" />
                    {$t('Régénérer le lien')}
                  </button>
                )}
                {share.state === 'authority' && (
                  <p className="text-xs text-rose-700 dark:text-rose-400">
                    {$t('{value}{value2} Enregistrez pour en devenir la personne qui publie.', {
                      value: share.published_by.name ?? $t('La personne qui l’a publié'),
                      value2: reading
                        ? $t(' ne peut plus lire cette table : la vue partagée est suspendue.')
                        : $t(
                            ' ne peut plus ajouter de lignes à cette table : le formulaire est suspendu.',
                          ),
                    })}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>{reading ? $t('Qui peut lire') : $t('Qui peut répondre')}</Label>
              <AccessChoice value={access} onChange={setAccess} disabled={busy} reading={reading} />
            </div>

            {access === 'members' && (sharing?.groups.length ?? 0) > 0 && (
              <div className="space-y-2">
                <Label>{$t('Réservé aux groupes')}</Label>
                <p className="text-xs text-muted-foreground">
                  {reading
                    ? $t('Aucun coché : tout membre connecté lit la vue.')
                    : $t('Aucun coché : tout membre connecté répond.')}
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {sharing?.groups.map((group) => (
                    <label
                      key={group.id}
                      htmlFor={`share-group-${group.id}`}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        id={`share-group-${group.id}`}
                        checked={groups.has(group.id)}
                        disabled={busy}
                        onCheckedChange={(checked) =>
                          setGroups((was) => {
                            const next = new Set(was)
                            if (checked === true) next.add(group.id)
                            else next.delete(group.id)
                            return next
                          })
                        }
                      />
                      <span className="truncate">{groupName(group.label)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {reading && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Switch
                    id="share-embed"
                    checked={canEmbed}
                    disabled={busy}
                    onCheckedChange={(checked) => {
                      setCanEmbed(checked)
                      if (share !== null) void save({ canEmbed: checked })
                    }}
                  />
                  <Label htmlFor="share-embed" className="font-normal">
                    {$t('Autoriser l’intégration à un autre site')}
                  </Label>
                </div>
                {share?.can_embed === true && code !== null && (
                  <div className="space-y-1.5">
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Code2 className="size-3.5" />
                      {$t('Code à coller dans la page qui intègre la vue :')}
                    </p>
                    <div className="flex items-start gap-2">
                      <textarea
                        readOnly
                        value={code}
                        rows={3}
                        onFocus={(e) => e.currentTarget.select()}
                        aria-label={$t('Code d’intégration')}
                        className="min-w-0 flex-1 resize-none rounded-md border bg-muted/40 px-2 py-1.5 font-mono text-[11px] leading-snug"
                      />
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => void copy('code')}
                        aria-label={$t('Copier le code')}
                        title={$t('Copier le code')}
                      >
                        {copied === 'code' ? (
                          <Check className="size-4" />
                        ) : (
                          <Copy className="size-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {feed !== null && (
              <CopyRow
                icon={<CalendarDays className="size-3.5" />}
                hint={$t(
                  'Flux iCalendar, pour s’abonner à la vue depuis Google Agenda (« Autres agendas » → « À partir de l’URL »), Outlook ou Calendrier :',
                )}
                value={feed}
                label={$t('Adresse du flux d’agenda')}
                copied={copied === 'feed'}
                onCopy={() => void copy('feed')}
              />
            )}
            {apiUrl !== null && (
              <CopyRow
                icon={<RefreshCw className="size-3.5" />}
                hint={$t('Adresse de l’API de la vue, pour la synchroniser dans une autre base :')}
                value={apiUrl}
                label={$t('Adresse de l’API de la vue')}
                copied={copied === 'api'}
                onCopy={() => void copy('api')}
              />
            )}

            {!reading && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="share-closes">{$t('Fermer le')}</Label>
                  <Input
                    id="share-closes"
                    type="datetime-local"
                    value={closesAt}
                    onChange={(e) => setClosesAt(e.target.value)}
                    disabled={busy}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="share-max">{$t('Nombre maximal de réponses')}</Label>
                  <Input
                    id="share-max"
                    inputMode="numeric"
                    value={maxResponses}
                    onChange={(e) => setMaxResponses(e.target.value)}
                    placeholder={$t('Illimité')}
                    disabled={busy}
                    className={cn('h-8', !maxOk && 'border-destructive')}
                  />
                </div>
              </div>
            )}

            {(sharing?.omitted.length ?? 0) > 0 && (
              <div className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
                <p className="flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="size-3.5 text-amber-500" />
                  {$t('Questions non posées par le lien')}
                </p>
                {sharing?.omitted.map((o) => (
                  <p key={o.field} className="text-muted-foreground">
                    <span className="text-foreground">{o.field}</span> — {o.reason}
                  </p>
                ))}
              </div>
            )}

            {share !== null && (
              <p className="text-xs text-muted-foreground">
                {$t('{value} avec les droits de', {
                  value: reading ? $t('Les lignes se lisent') : $t('Les réponses s’écrivent'),
                })}{' '}
                <span className="font-medium text-foreground">
                  {share.published_by.name ?? $t('la personne qui l’a publié')}
                </span>
                {$t(', qui a enregistré ce partage en dernier.')}
              </p>
            )}

            {error !== null && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {share !== null ? (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={busy}
              onClick={() => {
                if (viewId === null) return
                void act(async () => {
                  await api.deleteFormShare(table, viewId)
                  return api.formSharing(table, viewId)
                })
              }}
            >
              {$t('Arrêter le partage')}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              {$t('Fermer')}
            </Button>
            <Button onClick={() => void save()} disabled={busy || !maxOk || sharing === null}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {share === null ? $t('Créer le lien') : $t('Enregistrer')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
