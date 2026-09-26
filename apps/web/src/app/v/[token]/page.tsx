'use client'

import { FieldIcon } from '@/components/app/field-icon'
import type { Row } from '@/components/app/grid/cell'
import { OptionBadge } from '@/components/app/option-badge'
import { CardValue, RecordCard, colorOf, coverOf, titleOf } from '@/components/app/views/card'
import { COLUMNS, COVER } from '@/components/app/views/gallery-view'
import { Login } from '@/components/login'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  ApiError,
  type Field,
  type Member,
  type SharedView,
  type SharedViewField,
  api,
} from '@/lib/api/client'
import { KnownMembers } from '@/lib/members'
import { messageFor } from '@/lib/messages'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { KIND_INFO, localDateOf, orderByHand } from '@/lib/views'
import { Ban, Eye, Link2Off, Loader2, Lock } from 'lucide-react'
import { useParams } from 'next/navigation'
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'

/**
 * A shared view — chapter 15 §10: the page someone opens from a link, to READ.
 *
 * Outside the application: no navigation, no table name, nothing to change — the rows and
 * the fields the view shows, in its order, drawn the way it draws them. A grid is a table,
 * a gallery a wall of cards, a list lines under their groups, a kanban its columns; a
 * calendar and a timeline read as an agenda, day after day. Framed by another site
 * (`?embed=1`), the page has no header, and shows nothing unless its sharing allows it.
 */

type Page =
  | { readonly kind: 'loading' }
  | { readonly kind: 'login' }
  | { readonly kind: 'ready'; readonly view: SharedView }
  | {
      readonly kind: 'refused'
      readonly title: string
      readonly text: string
      readonly icon: 'closed' | 'unknown' | 'locked'
    }

const CLOSED: Readonly<Record<string, string>> = {
  inactive: 'La personne qui l’a partagée a désactivé le lien.',
  authority: 'Elle est suspendue : la personne qui l’a partagée ne peut plus lire cette table.',
  filtre: 'Son filtre cite un champ que la personne qui l’a partagée ne peut plus lire.',
}

function refusal(error: unknown): Page {
  if (error instanceof ApiError && error.code === 'VIEW_SHARE_CLOSED') {
    const reason = typeof error.details.reason === 'string' ? error.details.reason : ''
    return {
      kind: 'refused',
      icon: 'closed',
      title: 'Cette vue n’est plus partagée',
      text: CLOSED[reason] ?? 'Le lien a été fermé.',
    }
  }
  if (error instanceof ApiError && error.code === 'VIEW_SHARE_RESTRICTED') {
    return {
      kind: 'refused',
      icon: 'locked',
      title: 'Vue réservée',
      text: 'Cette vue est réservée à certains groupes, dont vous ne faites pas partie.',
    }
  }
  if (error instanceof ApiError && error.code === 'RESOURCE_NOT_FOUND') {
    return {
      kind: 'refused',
      icon: 'unknown',
      title: 'Lien introuvable',
      text: 'Ce lien ne mène à aucune vue : il a pu être remplacé par un autre, ou retiré.',
    }
  }
  return { kind: 'refused', icon: 'unknown', title: 'Vue indisponible', text: messageFor(error) }
}

/** A shared field, as the application's widgets read one. */
const fieldOf = (f: SharedViewField): Field => ({ ...f, description: null }) as Field

/**
 * The rows as the application's widgets read them. A relation and a person come by their
 * name alone (§10): a relation is given a stand-in identifier — only a key for the chips —
 * and a person one that the page's own list of names resolves.
 */
function screenRows(
  view: SharedView,
  fields: readonly Field[],
): { rows: Row[]; members: Member[] } {
  const people = new Map<string, string>()
  const person = (value: unknown): string | null => {
    const name = (value as { display?: string | null } | null)?.display
    if (value === null || value === undefined) return null
    const label = typeof name === 'string' && name !== '' ? name : 'Utilisateur'
    const known = people.get(label)
    if (known !== undefined) return known
    const id = `personne-${people.size + 1}`
    people.set(label, id)
    return id
  }
  const rows = view.rows.map((raw) => {
    const row: Record<string, unknown> = { ...raw }
    for (const field of fields) {
      const value = raw[field.name]
      if (field.kind === 'user' || field.computed?.result_kind === 'user') {
        row[field.name] = Array.isArray(value) ? value.map(person) : person(value)
      } else if (field.kind === 'link') {
        const link = value as { display?: string | null } | null
        row[field.name] =
          link === null || link === undefined ? null : { id: null, display: link.display ?? '—' }
      } else if (field.kind === 'multi_link') {
        row[field.name] = Array.isArray(value)
          ? value.map((v, i) => ({
              id: `lien-${i}`,
              display: (v as { display?: string | null }).display ?? '—',
            }))
          : []
      }
    }
    return row as Row
  })
  const members = [...people].map(([name, id]) => ({
    id,
    display_name: name,
    email: '',
    disabled: false,
  }))
  return { rows, members }
}

export default function SharedViewPage() {
  const { token } = useParams<{ token: string }>()
  const [page, setPage] = useState<Page>({ kind: 'loading' })
  const [more, setMore] = useState(false)
  // Read after the first paint: the server does not know whether the page is framed.
  const [frame, setFrame] = useState<{ embed: boolean; framed: boolean } | null>(null)

  useEffect(() => useTheme.getState().initialize(), [])
  useEffect(() => {
    let framed = true
    try {
      framed = window.self !== window.top
    } catch {
      // A cross-origin parent refuses to be read: framed, then.
    }
    setFrame({ embed: new URLSearchParams(window.location.search).get('embed') === '1', framed })
  }, [])

  const load = useCallback(async () => {
    setPage({ kind: 'loading' })
    try {
      const view = await api.sharedView(token)
      document.title = view.title
      setPage({ kind: 'ready', view })
    } catch (e) {
      if (e instanceof ApiError && e.code === 'AUTHENTICATION_REQUIRED') {
        setPage({ kind: 'login' })
        return
      }
      setPage(refusal(e))
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const loadMore = async () => {
    if (page.kind !== 'ready' || page.view.next_cursor === null) return
    setMore(true)
    try {
      const next = await api.sharedView(token, page.view.next_cursor)
      setPage({
        kind: 'ready',
        view: {
          ...page.view,
          rows: [...page.view.rows, ...next.rows],
          next_cursor: next.next_cursor,
        },
      })
    } catch (e) {
      setPage(refusal(e))
    } finally {
      setMore(false)
    }
  }

  const view = page.kind === 'ready' ? page.view : null
  const fields = useMemo(() => (view === null ? [] : view.fields.map(fieldOf)), [view])
  const screen = useMemo(
    () => (view === null ? { rows: [], members: [] } : screenRows(view, fields)),
    [view, fields],
  )

  if (frame === null) return null

  // Framed by another site while its sharing does not allow it: nothing is shown (§10).
  const refusedFrame =
    frame.framed && (page.kind !== 'ready' || !page.view.can_embed) && page.kind !== 'loading'
  const bare = frame.embed && frame.framed

  if (page.kind === 'login' && !frame.framed) {
    return (
      <div className="relative">
        <p className="absolute top-4 right-0 left-0 z-10 mx-auto w-fit rounded-full border bg-background/90 px-4 py-1.5 text-sm shadow-xs">
          Connectez-vous pour lire cette vue.
        </p>
        <Login onSignedIn={() => void load()} />
      </div>
    )
  }

  const shown: Page =
    refusedFrame && page.kind === 'ready'
      ? {
          kind: 'refused',
          icon: 'locked',
          title: 'Intégration non autorisée',
          text: 'Cette vue ne peut pas être affichée dans une autre page. Ouvrez son lien directement.',
        }
      : page.kind === 'login'
        ? {
            kind: 'refused',
            icon: 'locked',
            title: 'Connexion nécessaire',
            text: 'Cette vue est réservée aux membres : ouvrez son lien directement pour vous connecter.',
          }
        : page

  return (
    <TooltipProvider delayDuration={300}>
      <KnownMembers members={screen.members}>
        <div className="flex h-dvh flex-col bg-muted/30">
          {shown.kind === 'ready' && !bare && (
            <header className="shrink-0 border-b bg-background px-4 py-3 sm:px-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="text-lg font-semibold">{shown.view.title}</h1>
                <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  <Eye className="size-3" />
                  Lecture seule
                </span>
                {shown.view.reader !== null && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    Connecté : {shown.view.reader}
                  </span>
                )}
              </div>
              {shown.view.description !== null && (
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                  {shown.view.description}
                </p>
              )}
            </header>
          )}

          {shown.kind === 'loading' && (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {shown.kind === 'refused' && (
            <div className="flex flex-1 items-center justify-center px-4">
              <div className="w-full max-w-md rounded-xl border bg-background p-8 text-center shadow-xs">
                {shown.icon === 'closed' ? (
                  <Ban className="mx-auto size-8 text-muted-foreground" />
                ) : shown.icon === 'locked' ? (
                  <Lock className="mx-auto size-8 text-muted-foreground" />
                ) : (
                  <Link2Off className="mx-auto size-8 text-muted-foreground" />
                )}
                <h1 className="mt-4 text-lg font-semibold">{shown.title}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{shown.text}</p>
              </div>
            </div>
          )}
          {shown.kind === 'ready' && (
            <main className="min-h-0 flex-1 overflow-auto scroll-discret">
              <Body view={shown.view} fields={fields} rows={screen.rows} />
              <div className="flex justify-center py-4">
                {shown.view.next_cursor !== null && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={more}
                    onClick={() => void loadMore()}
                  >
                    {more && <Loader2 className="size-4 animate-spin" />}
                    Charger plus
                  </Button>
                )}
              </div>
            </main>
          )}

          {!bare && (
            <footer className="shrink-0 py-2 text-center text-xs text-muted-foreground">
              {shown.kind === 'ready'
                ? `${KIND_INFO[shown.view.kind].label} partagée avec basedb`
                : 'Vue partagée avec basedb'}
            </footer>
          )}
        </div>
      </KnownMembers>
    </TooltipProvider>
  )
}

const str = (spec: Readonly<Record<string, unknown>>, key: string): string | null =>
  typeof spec[key] === 'string' && spec[key] !== '' ? (spec[key] as string) : null
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []

/** The view's body, drawn after its kind. */
function Body({
  view,
  fields,
  rows: given,
}: {
  readonly view: SharedView
  readonly fields: readonly Field[]
  readonly rows: readonly Row[]
}) {
  const { spec } = view
  const byName = (name: string | null) =>
    name === null ? null : (fields.find((f) => f.name === name) ?? null)
  // Without a sort, the rows keep the order they were dragged into (the server sends
  // `manual_order` only then).
  const rows = orderByHand(given, strings(spec.manual_order))
  // The view's title, else the table's display column — the first field the page receives.
  const title = byName(str(spec, 'title_field')) ?? fields[0] ?? null
  const shown = strings(spec.card_fields)
    .map((n) => byName(n))
    .filter((f): f is Field => f !== null && f.name !== title?.name)

  if (rows.length === 0) {
    return <p className="p-10 text-center text-sm text-muted-foreground">Aucune ligne à montrer.</p>
  }

  switch (view.kind) {
    case 'grid':
      return <Grid fields={fields} rows={rows} widths={spec.column_widths} />
    case 'gallery': {
      const size =
        spec.card_size === 'small' || spec.card_size === 'large' ? spec.card_size : 'medium'
      const cover = byName(str(spec, 'cover_field'))
      const color = byName(str(spec, 'color_field'))
      return (
        <div className={cn('grid gap-3 p-4 sm:p-6', COLUMNS[size])}>
          {rows.map((row) => (
            <RecordCard
              key={row._id}
              row={row}
              title={title}
              fields={shown}
              cover={coverOf(row, cover)}
              coverClassName={cn(COVER[size], spec.cover_fit === 'contain' && 'object-contain')}
              coverPlaceholder={cover !== null}
              color={colorOf(row, color)}
            />
          ))}
        </div>
      )
    }
    case 'kanban':
      return (
        <Board
          rows={rows}
          group={byName(str(spec, 'group_by'))}
          order={strings(spec.group_order)}
          title={title}
          fields={shown}
          cover={byName(str(spec, 'cover_field'))}
        />
      )
    case 'calendar':
    case 'timeline':
      return (
        <Agenda
          rows={rows}
          start={byName(str(spec, view.kind === 'calendar' ? 'date_field' : 'start_field'))}
          end={byName(str(spec, 'end_field'))}
          title={title}
          fields={shown}
          color={byName(str(spec, 'color_field'))}
        />
      )
    default:
      return (
        <Lines rows={rows} group={byName(str(spec, 'group_by'))} title={title} fields={shown} />
      )
  }
}

/** The grid: a plain table, in the view's column order and widths. */
function Grid({
  fields,
  rows,
  widths,
}: {
  readonly fields: readonly Field[]
  readonly rows: readonly Row[]
  readonly widths: unknown
}) {
  const width = (name: string) => {
    const w = (widths as Record<string, unknown> | undefined)?.[name]
    return typeof w === 'number' && w >= 60 ? w : 180
  }
  return (
    <table className="w-max min-w-full border-separate border-spacing-0 bg-background text-sm">
      <thead className="sticky top-0 z-10 bg-muted">
        <tr>
          {fields.map((field) => (
            <th
              key={field.name}
              style={{ width: width(field.name), maxWidth: width(field.name) }}
              className="border-r border-b px-2 py-1.5 text-left font-medium"
            >
              <span className="flex items-center gap-1.5">
                <FieldIcon kind={field.kind} format={field.format?.display} className="size-3.5" />
                <span className="truncate">{field.label}</span>
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row._id} className="hover:bg-muted/40">
            {fields.map((field) => (
              <td
                key={field.name}
                style={{ width: width(field.name), maxWidth: width(field.name) }}
                className="h-9 border-r border-b px-2"
              >
                <span className="flex min-w-0 items-center overflow-hidden">
                  <CardValue field={field} row={row} />
                </span>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** The key of a row's group, and how its header reads. */
function groupOf(row: Row, field: Field): { key: string; header: ReactNode } {
  const value = row[field.name]
  if (value === null || value === undefined || value === '') {
    return { key: '', header: <span className="text-muted-foreground">Sans valeur</span> }
  }
  if (field.kind === 'select') {
    const option = field.options?.find((o) => o.value === value)
    return {
      key: String(value),
      header: <OptionBadge option={option ?? { label: String(value) }} />,
    }
  }
  if (field.kind === 'link') {
    const display = (value as { display?: string }).display ?? '—'
    return { key: display, header: <span>{display}</span> }
  }
  return { key: String(value), header: <CardValue field={field} row={row} /> }
}

/** Rows gathered under their group, in the choices' order — or all under none. */
function grouped(
  rows: readonly Row[],
  field: Field | null,
  order: readonly string[] = [],
): Array<{ key: string; header: ReactNode; rows: Row[] }> {
  if (field === null) return [{ key: 'all', header: null, rows: [...rows] }]
  const out: Array<{ key: string; header: ReactNode; rows: Row[] }> = []
  for (const row of rows) {
    const { key, header } = groupOf(row, field)
    const existing = out.find((g) => g.key === key)
    if (existing === undefined) out.push({ key, header, rows: [row] })
    else existing.rows.push(row)
  }
  if (field.kind === 'select') {
    const choices = (field.options ?? []).map((o) => o.value)
    const ranked = [
      ...order.filter((v) => choices.includes(v)),
      ...choices.filter((v) => !order.includes(v)),
    ]
    const rank = (key: string) =>
      key === '' ? 1e6 : ranked.indexOf(key) === -1 ? 1e5 : ranked.indexOf(key)
    out.sort((a, b) => rank(a.key) - rank(b.key))
  }
  return out
}

/** The list: a line per row, under its group. */
function Lines({
  rows,
  group,
  title,
  fields,
}: {
  readonly rows: readonly Row[]
  readonly group: Field | null
  readonly title: Field | null
  readonly fields: readonly Field[]
}) {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      {grouped(rows, group).map((g) => (
        <section key={g.key}>
          {g.header !== null && (
            <h2 className="mb-1.5 flex items-center gap-2 text-sm font-medium">
              {g.header}
              <span className="text-xs font-normal text-muted-foreground">{g.rows.length}</span>
            </h2>
          )}
          <div className="overflow-hidden rounded-lg border bg-background">
            {g.rows.map((row, index) => (
              <div
                key={row._id}
                className={cn('flex items-center gap-4 px-3 py-2 text-sm', index > 0 && 'border-t')}
              >
                <span className="w-56 shrink-0 truncate font-medium">{titleOf(row, title)}</span>
                {fields.map((field) => (
                  <span
                    key={field.name}
                    className="flex min-w-0 max-w-56 flex-1 items-center truncate text-muted-foreground"
                  >
                    <CardValue field={field} row={row} />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

/** The kanban: its columns side by side, the cards in them. */
function Board({
  rows,
  group,
  order,
  title,
  fields,
  cover,
}: {
  readonly rows: readonly Row[]
  readonly group: Field | null
  readonly order: readonly string[]
  readonly title: Field | null
  readonly fields: readonly Field[]
  readonly cover: Field | null
}) {
  return (
    <div className="flex h-full gap-3 p-4 sm:p-6">
      {grouped(rows, group, order).map((g) => (
        <section key={g.key} className="flex w-72 shrink-0 flex-col rounded-lg bg-muted/60 p-2">
          <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-medium">
            {g.header ?? 'Toutes les lignes'}
            <span className="text-xs font-normal text-muted-foreground">{g.rows.length}</span>
          </h2>
          <div className="space-y-2">
            {g.rows.map((row) => (
              <RecordCard
                key={row._id}
                row={row}
                title={title}
                fields={fields}
                cover={coverOf(row, cover)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

const DAY = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const SHORT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

/** A calendar or a timeline, read as an agenda: the rows under the day they start. */
function Agenda({
  rows,
  start,
  end,
  title,
  fields,
  color,
}: {
  readonly rows: readonly Row[]
  readonly start: Field | null
  readonly end: Field | null
  readonly title: Field | null
  readonly fields: readonly Field[]
  readonly color: Field | null
}) {
  const dated = rows
    .map((row) => ({
      row,
      from: start === null ? null : localDateOf(row[start.name], start.kind),
      to: end === null ? null : localDateOf(row[end.name], end.kind),
    }))
    .sort(
      (a, b) =>
        (a.from?.getTime() ?? Number.POSITIVE_INFINITY) -
        (b.from?.getTime() ?? Number.POSITIVE_INFINITY),
    )
  const days: Array<{ key: string; label: string; items: typeof dated }> = []
  for (const item of dated) {
    const key = item.from === null ? '' : item.from.toDateString()
    const label = item.from === null ? 'Sans date' : DAY.format(item.from)
    const day = days.find((d) => d.key === key)
    if (day === undefined) days.push({ key, label, items: [item] })
    else day.items.push(item)
  }
  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      {days.map((day) => (
        <section key={day.key}>
          <h2 className="mb-2 text-sm font-medium first-letter:uppercase">{day.label}</h2>
          <div className="space-y-2">
            {day.items.map(({ row, from, to }) => (
              <div key={row._id} className="flex items-start gap-3">
                {/* A row that lasts says until when; one of a single day says nothing. */}
                <span className="w-20 shrink-0 pt-2 text-right text-xs text-muted-foreground">
                  {from !== null && to !== null && to.getTime() > from.getTime()
                    ? `→ ${SHORT.format(to)}`
                    : ''}
                </span>
                <div className="min-w-0 flex-1">
                  <RecordCard row={row} title={title} fields={fields} color={colorOf(row, color)} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
