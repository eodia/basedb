'use client'

import { FieldIcon } from '@/components/app/field-icon'
import { TemplateEditor } from '@/components/app/views/template-editor'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Choice as ChoiceField } from '@/components/ui/choice'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Hint } from '@/components/ui/tooltip'
import type { Field, SavedView, Table, ViewKind } from '@/lib/api/client'
import { CARD_TEMPLATE_MAX } from '@/lib/card-template'
import { $t } from '@/lib/i18n'
import type { ViewState } from '@/lib/store/workspace'
import { cn } from '@/lib/utils'
import {
  type DataSpec,
  type FormQuestion,
  KIND_INFO,
  VIEW_KINDS,
  askableFields,
  businessFields,
  dateFields,
  defaultSpec,
  formSpec,
  freeLabel,
  gridSpecOf,
  groupFields,
  listGroupFields,
  pictureFields,
  selectFields,
  selfLinkFields,
  unavailableReason,
} from '@/lib/views'
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, Filter, GripVertical, Lock } from 'lucide-react'
import { type ReactNode, useEffect, useId, useMemo, useState } from 'react'

/**
 * Creating a view, and configuring one — the same dialog (ch. 11 §1.4).
 *
 * What it asks depends on the kind, and it asks what the kind cannot do without first:
 *
 *   la nature de la vue, son nom ;
 *   ses CHAMPS PIVOTS — la liste de choix qui forme les colonnes d'un kanban, la date
 *   d'un calendrier, le début et la fin d'une chronologie, et ce qui les regroupe ou les
 *   colore ;
 *   les champs affichés, masqués et leur ordre — les colonnes d'une grille, le contenu des
 *   cartes, les questions d'un formulaire et la façon de les poser ;
 *   le filtre et le tri en cours, repris ou non.
 *
 * Every pivot is preset on the first field that can take it, so that a table which allows
 * the kind can have its view in one click. A kind the table cannot take says why.
 */

export interface ViewDraft {
  readonly label: string
  readonly kind: ViewKind
  readonly description: string | null
  readonly spec: Readonly<Record<string, unknown>>
  /** A new view kept for its author alone (ch. 11 §1.6); ignored when configuring. */
  readonly personal: boolean
}

type Spec = Record<string, unknown>

export function ViewDialog({
  open,
  table,
  views,
  kind: initialKind,
  view,
  current,
  layout,
  canBuild,
  onClose,
  onSubmit,
}: {
  readonly open: boolean
  readonly table: Table
  readonly views: readonly SavedView[]
  /** The kind picked in the selector, for a new view. */
  readonly kind: ViewKind
  /** The view being configured; absent for a new one. */
  readonly view?: SavedView
  /** The filter and the sort on screen, which a new view may take over. */
  readonly current: DataSpec
  /** The grid layout on screen: a new GRID starts from it — « enregistrer comme vue ». */
  readonly layout?: ViewState
  /**
   * Whether the reader builds the base: they alone create collaborative views — anyone
   * else's new view is personal.
   */
  readonly canBuild: boolean
  readonly onClose: () => void
  /** Resolves to the refusal to show, or `null` once written. */
  readonly onSubmit: (draft: ViewDraft) => Promise<string | null>
}) {
  const editing = view !== undefined
  const fields = useMemo(() => businessFields(table), [table])
  const [kind, setKind] = useState<ViewKind>(view?.kind ?? initialKind)
  const [label, setLabel] = useState('')
  const [labelTouched, setLabelTouched] = useState(false)
  const [description, setDescription] = useState('')
  const [spec, setSpec] = useState<Spec>({})
  const [takeCurrent, setTakeCurrent] = useState(true)
  const [personal, setPersonal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasCurrent = current.filter !== '' || current.sorts.length > 0
  const takeId = useId()
  const personalId = useId()

  // Each opening starts from the view as saved, or from the kind's defaults.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on OPEN only, not on every render of the parent
  useEffect(() => {
    if (!open) return
    const k = view?.kind ?? initialKind
    setKind(k)
    setLabel(view?.label ?? freeLabel(KIND_INFO[k].label, views))
    setLabelTouched(editing)
    setDescription(view?.description ?? '')
    setSpec(view === undefined ? startingSpec(k) : { ...view.spec })
    setTakeCurrent(true)
    setPersonal(!canBuild)
    setError(null)
    setBusy(false)
  }, [open])

  const startingSpec = (k: ViewKind): Spec =>
    k === 'grid' && layout !== undefined
      ? { ...gridSpecOf(layout) }
      : { ...defaultSpec(k, table, current) }

  const choose = (next: ViewKind) => {
    if (editing || next === kind) return
    setKind(next)
    setSpec(startingSpec(next))
    if (!labelTouched) setLabel(freeLabel(KIND_INFO[next].label, views))
    setError(null)
  }

  const set = (key: string, value: unknown) => setSpec((s) => ({ ...s, [key]: value }))
  const get = (key: string): string | null =>
    typeof spec[key] === 'string' && spec[key] !== '' ? (spec[key] as string) : null
  const list = (key: string): string[] =>
    Array.isArray(spec[key]) ? (spec[key] as unknown[]).filter((v) => typeof v === 'string') : []

  const blocked = editing ? null : unavailableReason(kind, table)
  const missing = missingPivot(kind, spec)
  const ready = label.trim() !== '' && blocked === null && missing === null && !busy

  const submit = async () => {
    if (!ready) return
    let out: Spec = { ...spec }
    if (KIND_INFO[kind].data && !editing) {
      out = takeCurrent
        ? { ...out, filter: current.filter, sorts: current.sorts }
        : { ...out, filter: '', sorts: [] }
    }
    setBusy(true)
    setError(null)
    const refusal = await onSubmit({
      label: label.trim(),
      kind,
      description: description.trim() === '' ? null : description.trim(),
      spec: out,
      personal: personal || !canBuild,
    })
    setBusy(false)
    if (refusal !== null) setError(refusal)
  }

  const Icon = KIND_INFO[kind].icon

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="flex max-h-[88vh] max-w-2xl flex-col gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Icon className="size-4 text-primary" />
            {editing
              ? $t('Configurer « {label} »', { label: view.label })
              : $t('Nouvelle vue de {label}', { label: table.label })}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? `${KIND_INFO[kind].label} — ${KIND_INFO[kind].summary}`
              : personal || !canBuild
                ? $t('Une vue personnelle n’est vue que par vous. Elle ne change aucune donnée.')
                : $t(
                    'Une vue est partagée avec tous ceux qui lisent la table. Elle ne change aucune donnée.',
                  )}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5 scroll-discret">
          {!editing && (
            <fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <legend className="sr-only">{$t('Type de vue')}</legend>
              {VIEW_KINDS.map((k) => {
                const info = KIND_INFO[k]
                const reason = unavailableReason(k, table)
                const KindIcon = info.icon
                return (
                  <Hint key={k} label={reason ?? info.summary}>
                    <button
                      type="button"
                      aria-pressed={kind === k}
                      onClick={() => choose(k)}
                      className={cn(
                        'flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-accent/60',
                        kind === k && 'border-primary bg-primary/5 ring-1 ring-primary',
                        reason !== null && 'opacity-60',
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <KindIcon
                          className={cn(
                            'size-4',
                            kind === k ? 'text-primary' : 'text-muted-foreground',
                          )}
                        />
                        {info.label}
                      </span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {reason ?? info.summary}
                      </span>
                    </button>
                  </Hint>
                )
              })}
            </fieldset>
          )}

          {blocked !== null ? (
            <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
              {$t(
                '{blocked} Ajoutez-en un depuis l’écran « Structure », puis revenez créer la vue.',
                { blocked },
              )}
            </p>
          ) : (
            <>
              <Section title={$t('Nom')}>
                <Input
                  value={label}
                  onChange={(e) => {
                    setLabel(e.target.value)
                    setLabelTouched(true)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && void submit()}
                  placeholder={KIND_INFO[kind].label}
                  maxLength={255}
                  aria-label={$t('Nom de la vue')}
                  autoFocus
                />
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={$t('À quoi sert cette vue ? (facultatif)')}
                  rows={2}
                  maxLength={1000}
                  className="mt-2 min-h-0 resize-none text-sm"
                  aria-label={$t('Description de la vue')}
                />
                {!editing && (
                  <div className="mt-2 flex items-start gap-2.5 text-sm">
                    <Checkbox
                      id={personalId}
                      checked={personal || !canBuild}
                      disabled={!canBuild}
                      onCheckedChange={(v) => setPersonal(v === true)}
                      className="mt-0.5"
                    />
                    <div>
                      <label htmlFor={personalId}>{$t('Vue personnelle')}</label>
                      <p className="text-xs text-muted-foreground">
                        {canBuild
                          ? $t(
                              'Visible par vous seul ; les autres ne la voient pas dans leur liste.',
                            )
                          : $t(
                              'Vous ne construisez pas cette base : vos vues sont les vôtres, invisibles pour les autres.',
                            )}
                      </p>
                    </div>
                  </div>
                )}
              </Section>

              {kind === 'kanban' && (
                <Section title={$t('Champs pivots')}>
                  <Pivot
                    label={$t('Colonnes selon')}
                    hint={$t(
                      'Une colonne par choix de la liste ; glisser une carte change sa valeur, glisser l’en-tête d’une colonne la déplace.',
                    )}
                    required
                    fields={selectFields(fields)}
                    value={get('group_by')}
                    // The columns' order was the order of ANOTHER list's choices.
                    onChange={(v) => setSpec((s) => ({ ...s, group_by: v, group_order: [] }))}
                  />
                  <Pivot
                    label={$t('Titre des cartes')}
                    fields={fields}
                    value={get('title_field')}
                    onChange={(v) => set('title_field', v)}
                    placeholder={$t('Colonne d’affichage de la table')}
                  />
                  <Pivot
                    label={$t('Image de couverture')}
                    fields={pictureFields(fields)}
                    value={get('cover_field')}
                    onChange={(v) => set('cover_field', v)}
                    placeholder={$t('Aucune')}
                  />
                  <Toggle
                    label={$t('Masquer les colonnes vides')}
                    checked={spec.hide_empty === true}
                    onChange={(v) => set('hide_empty', v)}
                  />
                </Section>
              )}

              {kind === 'calendar' && (
                <Section title={$t('Champs pivots')}>
                  <Pivot
                    label={$t('Date')}
                    hint={$t('Le jour où chaque ligne est posée.')}
                    required
                    fields={dateFields(fields)}
                    value={get('date_field')}
                    onChange={(v) => set('date_field', v)}
                  />
                  <Pivot
                    label={$t('Date de fin')}
                    hint={$t('Facultative : une ligne s’étend alors sur plusieurs jours.')}
                    fields={dateFields(fields).filter((f) => f.name !== get('date_field'))}
                    value={get('end_field')}
                    onChange={(v) => set('end_field', v)}
                    placeholder={$t('Aucune')}
                  />
                  <Pivot
                    label={$t('Titre')}
                    fields={fields}
                    value={get('title_field')}
                    onChange={(v) => set('title_field', v)}
                    placeholder={$t('Colonne d’affichage de la table')}
                  />
                  <Pivot
                    label={$t('Couleur selon')}
                    fields={selectFields(fields)}
                    value={get('color_field')}
                    onChange={(v) => set('color_field', v)}
                    placeholder={$t('Aucune')}
                  />
                  <Choice
                    label={$t('Affichage')}
                    value={spec.mode === 'week' ? 'week' : 'month'}
                    options={[
                      ['month', $t('Mois')],
                      ['week', $t('Semaine')],
                    ]}
                    onChange={(v) => set('mode', v)}
                  />
                </Section>
              )}

              {kind === 'timeline' && (
                <Section title={$t('Champs pivots')}>
                  <Pivot
                    label={$t('Début')}
                    required
                    fields={dateFields(fields)}
                    value={get('start_field')}
                    onChange={(v) => set('start_field', v)}
                  />
                  <Pivot
                    label={$t('Fin')}
                    hint={$t('Sans fin, chaque barre dure un jour.')}
                    fields={dateFields(fields).filter((f) => f.name !== get('start_field'))}
                    value={get('end_field')}
                    onChange={(v) => set('end_field', v)}
                    placeholder={$t('Aucune')}
                  />
                  <Pivot
                    label={$t('Regrouper par')}
                    hint={$t('Une bande par choix d’une liste, ou par ligne liée.')}
                    fields={groupFields(fields)}
                    value={get('group_by')}
                    onChange={(v) => set('group_by', v)}
                    placeholder={$t('Pas de regroupement')}
                  />
                  <Pivot
                    label={$t('Titre')}
                    fields={fields}
                    value={get('title_field')}
                    onChange={(v) => set('title_field', v)}
                    placeholder={$t('Colonne d’affichage de la table')}
                  />
                  <Pivot
                    label={$t('Couleur selon')}
                    fields={selectFields(fields)}
                    value={get('color_field')}
                    onChange={(v) => set('color_field', v)}
                    placeholder={$t('Aucune')}
                  />
                  <Pivot
                    label={$t('Dépend de')}
                    hint={$t(
                      'Une relation de la table vers elle-même : une flèche relie chaque ligne à celles dont elle dépend.',
                    )}
                    fields={selfLinkFields(table, fields)}
                    value={get('depends_on')}
                    onChange={(v) => set('depends_on', v)}
                    placeholder={$t('Pas de dépendances')}
                  />
                  <Choice
                    label={$t('Échelle')}
                    value={typeof spec.scale === 'string' ? spec.scale : 'week'}
                    options={[
                      ['day', $t('Jour')],
                      ['week', $t('Semaine')],
                      ['month', $t('Mois')],
                    ]}
                    onChange={(v) => set('scale', v)}
                  />
                </Section>
              )}

              {kind === 'gallery' && (
                <Section title={$t('Cartes')}>
                  <Pivot
                    label={$t('Titre des cartes')}
                    fields={fields}
                    value={get('title_field')}
                    onChange={(v) => set('title_field', v)}
                    placeholder={$t('Colonne d’affichage de la table')}
                  />
                  <Pivot
                    label={$t('Image de couverture')}
                    fields={pictureFields(fields)}
                    value={get('cover_field')}
                    onChange={(v) => set('cover_field', v)}
                    placeholder={$t('Aucune')}
                  />
                  {get('cover_field') !== null && (
                    <Choice
                      label={$t('Image')}
                      value={spec.cover_fit === 'contain' ? 'contain' : 'cover'}
                      options={[
                        ['cover', $t('Recadrée')],
                        ['contain', $t('Entière')],
                      ]}
                      onChange={(v) => set('cover_fit', v)}
                    />
                  )}
                  <Choice
                    label={$t('Taille des cartes')}
                    value={
                      spec.card_size === 'small' || spec.card_size === 'large'
                        ? spec.card_size
                        : 'medium'
                    }
                    options={[
                      ['small', $t('Petites')],
                      ['medium', $t('Moyennes')],
                      ['large', $t('Grandes')],
                    ]}
                    onChange={(v) => set('card_size', v)}
                  />
                  <Pivot
                    label={$t('Couleur selon')}
                    fields={selectFields(fields)}
                    value={get('color_field')}
                    onChange={(v) => set('color_field', v)}
                    placeholder={$t('Aucune')}
                  />
                </Section>
              )}

              {kind === 'list' && (
                <Section title={$t('Lignes')}>
                  <Pivot
                    label={$t('Titre')}
                    fields={fields}
                    value={get('title_field')}
                    onChange={(v) => set('title_field', v)}
                    placeholder={$t('Colonne d’affichage de la table')}
                  />
                  <Pivot
                    label={$t('Regrouper par')}
                    hint={$t(
                      'Un groupe repliable par choix d’une liste, par ligne liée ou par personne.',
                    )}
                    fields={listGroupFields(fields)}
                    value={get('group_by')}
                    onChange={(v) => set('group_by', v)}
                    placeholder={$t('Pas de regroupement')}
                  />
                </Section>
              )}

              {kind === 'grid' && (
                <Section
                  title={$t('Colonnes affichées')}
                  hint={$t('Décochez pour masquer, glissez pour ordonner.')}
                >
                  <FieldChecklist
                    fields={fields}
                    selected={gridVisible(fields, list('hidden'), list('column_order'))}
                    onChange={(visible) => {
                      const hidden = fields
                        .filter((f) => !visible.includes(f.name))
                        .map((f) => f.name)
                      setSpec((s) => ({ ...s, hidden, column_order: [...visible, ...hidden] }))
                    }}
                  />
                </Section>
              )}

              {(kind === 'kanban' ||
                kind === 'calendar' ||
                kind === 'timeline' ||
                kind === 'gallery' ||
                kind === 'list') && (
                <Section
                  title={
                    kind === 'timeline'
                      ? $t('Champs sur les barres')
                      : kind === 'list'
                        ? $t('Champs sur chaque ligne')
                        : $t('Champs sur les cartes')
                  }
                  hint={
                    kind === 'list'
                      ? $t('Après le titre, dans cet ordre.')
                      : $t('Sous le titre, dans cet ordre.')
                  }
                >
                  <FieldChecklist
                    fields={fields.filter(
                      (f) => f.name !== (get('title_field') ?? table.display_field),
                    )}
                    selected={list('card_fields')}
                    onChange={(next) => set('card_fields', next)}
                  />
                </Section>
              )}

              {kind === 'kanban' && (
                <Section
                  title={$t('Description des cartes')}
                  hint={$t(
                    'Une phrase sous le titre de chaque carte ; chaque {{champ}} y est remplacé par la valeur de la ligne.',
                  )}
                >
                  <TemplateEditor
                    id="card-template"
                    value={typeof spec.card_template === 'string' ? spec.card_template : ''}
                    onChange={(next) => set('card_template', next)}
                    fields={fields}
                    max={CARD_TEMPLATE_MAX}
                    placeholder={$t('Livraison prévue le {{Date}} pour {{Client}}.')}
                  />
                </Section>
              )}

              {(kind === 'form' || kind === 'survey') && (
                <FormSettings kind={kind} fields={fields} spec={spec} setSpec={setSpec} />
              )}

              {KIND_INFO[kind].data && !editing && hasCurrent && (
                <Section title={$t('Filtre et tri')}>
                  <div className="flex items-start gap-2.5 text-sm">
                    <Checkbox
                      id={takeId}
                      checked={takeCurrent}
                      onCheckedChange={(v) => setTakeCurrent(v === true)}
                      className="mt-0.5"
                    />
                    <div>
                      <label htmlFor={takeId}>{$t('Reprendre le filtre et le tri affichés')}</label>
                      <CurrentSummary current={current} fields={fields} />
                    </div>
                  </div>
                </Section>
              )}
            </>
          )}
        </div>

        <DialogFooter className="items-center border-t px-6 py-4">
          {(error ?? (blocked === null ? missing : null)) !== null && (
            <p
              role="alert"
              className={cn(
                'mr-auto text-sm',
                error === null ? 'text-muted-foreground' : 'text-destructive',
              )}
            >
              {error ?? missing}
            </p>
          )}
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {$t('Annuler')}
          </Button>
          <Button onClick={() => void submit()} disabled={!ready}>
            {busy ? $t('Enregistrement…') : editing ? $t('Enregistrer') : $t('Créer la vue')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** What still keeps the view from being created, said in the footer. */
function missingPivot(kind: ViewKind, spec: Spec): string | null {
  const has = (key: string) => typeof spec[key] === 'string' && spec[key] !== ''
  switch (kind) {
    case 'kanban':
      return has('group_by') ? null : $t('Choisissez le champ qui forme les colonnes.')
    case 'calendar':
      return has('date_field') ? null : $t('Choisissez le champ date.')
    case 'timeline':
      return has('start_field') ? null : $t('Choisissez le champ de début.')
    case 'form':
    case 'survey':
      return Array.isArray(spec.fields) && spec.fields.length > 0
        ? null
        : $t('Ajoutez au moins une question.')
    default:
      return null
  }
}

/** The visible columns of a grid spec, in their order. */
function gridVisible(
  fields: readonly Field[],
  hidden: readonly string[],
  order: readonly string[],
): string[] {
  const names = fields.map((f) => f.name)
  const ordered = [
    ...order.filter((n) => names.includes(n)),
    ...names.filter((n) => !order.includes(n)),
  ]
  return ordered.filter((n) => !hidden.includes(n))
}

function Section({
  title,
  hint,
  children,
}: {
  readonly title: string
  readonly hint?: string
  readonly children: ReactNode
}) {
  return (
    <section className="space-y-2.5">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        {hint !== undefined && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

/** One pivot: a field of the right kind, or none when it is optional. */
function Pivot({
  label,
  hint,
  required = false,
  fields,
  value,
  onChange,
  placeholder = $t('Choisir un champ'),
}: {
  readonly label: string
  readonly hint?: string
  readonly required?: boolean
  readonly fields: readonly Field[]
  readonly value: string | null
  readonly onChange: (value: string | null) => void
  readonly placeholder?: string
}) {
  const known = value !== null && fields.some((f) => f.name === value)
  return (
    <div className="grid grid-cols-[150px_1fr] items-start gap-3">
      <div className="pt-2 text-sm">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </div>
      <div className="min-w-0 space-y-1">
        <ChoiceField
          value={known ? (value as string) : ''}
          onValueChange={(v) => onChange(v === '' ? null : v)}
          options={[
            {
              value: '',
              label: placeholder,
              render: <span className="text-muted-foreground">{placeholder}</span>,
            },
            ...fields.map((f) => ({
              value: f.name,
              label: f.label,
              render: (
                <span className="flex items-center gap-2">
                  <FieldIcon kind={f.kind} format={f.format?.display} />
                  {f.label}
                </span>
              ),
            })),
          ]}
          aria-label={label}
          size="default"
          className={cn(!known && 'text-muted-foreground')}
        />
        {hint !== undefined && <p className="text-xs text-muted-foreground">{hint}</p>}
        {fields.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {$t('Aucun champ de ce type dans la table.')}
          </p>
        )}
      </div>
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  readonly label: string
  readonly checked: boolean
  readonly onChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <div className="grid grid-cols-[150px_1fr] items-center gap-3 text-sm">
      <label htmlFor={id}>{label}</label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

/** A switch and the words that say what it does — a click on either flips it. */
function SwitchRow({
  label,
  checked,
  disabled = false,
  onChange,
  className,
}: {
  readonly label: string
  readonly checked: boolean
  readonly disabled?: boolean
  readonly onChange: (checked: boolean) => void
  readonly className?: string
}) {
  const id = useId()
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
      <label htmlFor={id}>{label}</label>
    </div>
  )
}

function Choice({
  label,
  value,
  options,
  onChange,
}: {
  readonly label: string
  readonly value: string
  readonly options: ReadonlyArray<readonly [string, string]>
  readonly onChange: (value: string) => void
}) {
  return (
    <div className="grid grid-cols-[150px_1fr] items-center gap-3 text-sm">
      <span>{label}</span>
      <fieldset className="flex w-fit rounded-md border p-0.5">
        <legend className="sr-only">{label}</legend>
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={cn(
              'rounded px-2.5 py-1 text-xs',
              value === v
                ? 'bg-secondary font-medium'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {text}
          </button>
        ))}
      </fieldset>
    </div>
  )
}

/** The filter and sort a new view would take over, in words. */
function CurrentSummary({
  current,
  fields,
}: {
  readonly current: DataSpec
  readonly fields: readonly Field[]
}) {
  const labelOf = (name: string) => fields.find((f) => f.name === name)?.label ?? name
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      {current.filter !== '' && (
        <span className="flex max-w-full items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono">
          <Filter className="size-3 shrink-0" />
          <span className="truncate">{current.filter}</span>
        </span>
      )}
      {current.sorts.map((s) => (
        <span key={s.field} className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5">
          {s.direction === 'asc' ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )}
          {labelOf(s.field)}
        </span>
      ))}
    </span>
  )
}

/**
 * A list of fields to tick and to order: the ticked ones first, in their order, and the
 * others after them in the table's. A field in `locked` cannot be unticked — the reason is
 * its lock's title.
 */
function FieldChecklist({
  fields,
  selected,
  onChange,
  locked,
  extra,
}: {
  readonly fields: readonly Field[]
  readonly selected: readonly string[]
  readonly onChange: (next: string[]) => void
  readonly locked?: ReadonlySet<string>
  /** More settings under a ticked field. */
  readonly extra?: (field: Field) => ReactNode
}) {
  const kept = selected.filter((n) => fields.some((f) => f.name === n))
  const order = [...kept, ...fields.map((f) => f.name).filter((n) => !kept.includes(n))]
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over === null || active.id === over.id) return
    const moved = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)))
    // Ticking is kept; only the place changes.
    onChange(moved.filter((n) => kept.includes(n)))
  }

  const toggle = (name: string, on: boolean) => {
    if (on) onChange(order.filter((n) => kept.includes(n) || n === name))
    else onChange(kept.filter((n) => n !== name))
  }

  if (fields.length === 0) {
    return <p className="text-sm text-muted-foreground">{$t('Aucun champ.')}</p>
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0 flex-1 overflow-hidden rounded-lg border">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            {order.map((name, index) => {
              const field = fields.find((f) => f.name === name) as Field
              const on = kept.includes(name)
              return (
                <ChecklistRow
                  key={name}
                  field={field}
                  on={on}
                  first={index === 0}
                  locked={locked?.has(name) === true}
                  onToggle={(v) => toggle(name, v)}
                >
                  {on && extra?.(field)}
                </ChecklistRow>
              )
            })}
          </SortableContext>
        </DndContext>
      </div>
      <div className="flex shrink-0 flex-col gap-1 self-start">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => onChange(order)}
        >
          {$t('Tout')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => onChange(order.filter((n) => locked?.has(n) === true))}
        >
          {$t('Aucun')}
        </Button>
      </div>
    </div>
  )
}

function ChecklistRow({
  field,
  on,
  first,
  locked,
  onToggle,
  children,
}: {
  readonly field: Field
  readonly on: boolean
  readonly first: boolean
  readonly locked: boolean
  readonly onToggle: (on: boolean) => void
  readonly children?: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.name,
  })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('bg-background', !first && 'border-t', isDragging && 'relative z-10 shadow-md')}
    >
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab rounded p-0.5 text-muted-foreground hover:bg-accent active:cursor-grabbing"
          aria-label={$t('Déplacer {label}', { label: field.label })}
        >
          <GripVertical className="size-4" />
        </button>
        <Checkbox
          checked={on}
          disabled={locked}
          onCheckedChange={(v) => onToggle(v === true)}
          aria-label={field.label}
        />
        <FieldIcon kind={field.kind} format={field.format?.display} />
        <span className={cn('min-w-0 flex-1 truncate text-sm', !on && 'text-muted-foreground')}>
          {field.label}
        </span>
        {locked && (
          <Hint label={$t('Champ obligatoire de la table : le formulaire doit le demander')}>
            <span>
              <Lock className="size-3.5 text-muted-foreground" />
            </span>
          </Hint>
        )}
      </div>
      {children}
    </div>
  )
}

/** A form's page and its questions — shared by the form and the survey. */
function FormSettings({
  kind,
  fields,
  spec,
  setSpec,
}: {
  readonly kind: 'form' | 'survey'
  readonly fields: readonly Field[]
  readonly spec: Spec
  readonly setSpec: (update: (s: Spec) => Spec) => void
}) {
  const form = formSpec(spec)
  const askable = askableFields(fields)
  // A field the table requires cannot be left out: the row would be refused.
  const locked = new Set(askable.filter((f) => f.required === true).map((f) => f.name))
  const byName = new Map(form.fields.map((q) => [q.field, q]))

  const setQuestions = (names: readonly string[]) =>
    setSpec((s) => ({
      ...s,
      fields: names.map(
        (n): FormQuestion =>
          byName.get(n) ?? {
            field: n,
            required: askable.find((f) => f.name === n)?.required === true,
            label: '',
            help: '',
          },
      ),
    }))
  const patchQuestion = (name: string, patch: Partial<FormQuestion>) =>
    setSpec((s) => ({
      ...s,
      fields: formSpec(s).fields.map((q) => (q.field === name ? { ...q, ...patch } : q)),
    }))
  const setText = (key: string) => (e: { target: { value: string } }) =>
    setSpec((s) => ({ ...s, [key]: e.target.value }))

  return (
    <>
      <Section title={kind === 'survey' ? $t('Accueil') : $t('En-tête')}>
        <Input
          value={form.title}
          onChange={setText('title')}
          placeholder={$t('Titre')}
          maxLength={255}
          aria-label={$t('Titre du formulaire')}
        />
        <Textarea
          value={form.description}
          onChange={setText('description')}
          placeholder={
            kind === 'survey'
              ? $t('Ce que la personne va remplir, et pourquoi')
              : $t('Consignes, en tête du formulaire')
          }
          rows={3}
          maxLength={4000}
          className="mt-2 text-sm"
          aria-label={$t('Présentation du formulaire')}
        />
      </Section>

      <Section
        title={$t('Questions')}
        hint={
          kind === 'survey'
            ? $t(
                'Une par écran, dans cet ordre. Les champs calculés et en lecture seule ne sont pas proposés.',
              )
            : $t('Dans cet ordre. Les champs calculés et en lecture seule ne sont pas proposés.')
        }
      >
        <FieldChecklist
          fields={askable}
          selected={form.fields.map((q) => q.field)}
          onChange={setQuestions}
          locked={locked}
          extra={(field) => {
            const q = byName.get(field.name)
            if (q === undefined) return null
            return (
              <div className="grid gap-2 border-t border-dashed bg-muted/30 py-2 pr-2 pl-10 sm:grid-cols-2">
                <Input
                  value={q.label}
                  onChange={(e) => patchQuestion(field.name, { label: e.target.value })}
                  placeholder={$t('Intitulé : {label}', { label: field.label })}
                  className="h-8 text-xs"
                  maxLength={255}
                  aria-label={$t('Intitulé de la question {label}', { label: field.label })}
                />
                <Input
                  value={q.help}
                  onChange={(e) => patchQuestion(field.name, { help: e.target.value })}
                  placeholder={field.description ?? $t('Aide sous la question')}
                  className="h-8 text-xs"
                  maxLength={1000}
                  aria-label={$t('Aide de la question {label}', { label: field.label })}
                />
                <SwitchRow
                  className="text-xs sm:col-span-2"
                  label={$t('Réponse obligatoire')}
                  checked={q.required || locked.has(field.name)}
                  disabled={locked.has(field.name)}
                  onChange={(v) => patchQuestion(field.name, { required: v })}
                />
              </div>
            )
          }}
        />
      </Section>

      <Section title={$t('Envoi')}>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={form.submit_label}
            onChange={setText('submit_label')}
            placeholder={$t('Libellé du bouton : Envoyer')}
            maxLength={60}
            aria-label={$t('Libellé du bouton d’envoi')}
          />
          <SwitchRow
            className="text-sm"
            label={$t('Proposer une nouvelle réponse')}
            checked={form.allow_another}
            onChange={(v) => setSpec((s) => ({ ...s, allow_another: v }))}
          />
        </div>
        <Textarea
          value={form.success_message}
          onChange={setText('success_message')}
          placeholder={$t('Message après l’envoi : Merci, votre réponse a été enregistrée.')}
          rows={2}
          maxLength={2000}
          className="text-sm"
          aria-label={$t('Message après l’envoi')}
        />
      </Section>
    </>
  )
}
