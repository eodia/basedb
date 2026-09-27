import { $t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  AlignLeft,
  Banknote,
  Calculator,
  Calendar,
  CaseSensitive,
  CircleChevronDown,
  Clock,
  Hash,
  Image as ImageIcon,
  Link,
  Link2,
  ListChecks,
  ListOrdered,
  Lock,
  Mail,
  MousePointerClick,
  Paperclip,
  Percent,
  Phone,
  Pilcrow,
  ScanBarcode,
  ScanSearch,
  Sigma,
  Star,
  Tally5,
  Timer,
  ToggleLeft,
  UserRound,
  Waypoints,
} from 'lucide-react'

/**
 * The glyph a column header wears.
 *
 * It comes from the field's `kind`, which comes from the catalog — never from a guess
 * about the column's name. A column called `date_de_naissance` that is stored as text is
 * a text column, and the header must say so. A format (ch. 04 §2.11) refines it: a number
 * read as a currency wears a banknote, one read as a rating a star.
 */
const ICONS = {
  short_text: CaseSensitive,
  long_text: AlignLeft,
  number: Hash,
  boolean: ToggleLeft,
  date: Calendar,
  datetime: Clock,
  select: CircleChevronDown,
  multi_select: ListChecks,
  link: Link2,
  multi_link: Waypoints,
  formula: Sigma,
  lookup: ScanSearch,
  rollup: Calculator,
  count: Tally5,
  file: Paperclip,
  image: ImageIcon,
  url: Link,
  email: Mail,
  autonumber: ListOrdered,
  user: UserRound,
  button: MousePointerClick,
  system: Lock,
} as const

const FORMAT_ICONS = {
  currency: Banknote,
  percent: Percent,
  duration: Timer,
  rating: Star,
  phone: Phone,
  barcode: ScanBarcode,
  /** Not a display format: the rich variant of a long text, drawn apart where it is chosen. */
  html: Pilcrow,
} as const

export function FieldIcon({
  kind,
  format,
  className,
}: {
  readonly kind: string
  /** The field's display format, when it has one. */
  readonly format?: string
  readonly className?: string
}) {
  const Icon =
    (format === undefined ? undefined : FORMAT_ICONS[format as keyof typeof FORMAT_ICONS]) ??
    ICONS[kind as keyof typeof ICONS] ??
    CaseSensitive
  return <Icon className={cn('size-3.5 shrink-0 text-muted-foreground', className)} />
}

/** How each type is named to a human, in one word. */
export const KIND_LABELS: Readonly<Record<string, string>> = {
  short_text: $t('Texte'),
  long_text: $t('Texte long'),
  number: $t('Nombre'),
  boolean: $t('Booléen'),
  date: $t('Date'),
  datetime: $t('Date et heure'),
  select: $t('Liste de choix'),
  multi_select: $t('Choix multiple'),
  link: $t('Relation'),
  multi_link: $t('Relation multiple'),
  lookup: $t('Recherche'),
  rollup: $t('Cumul'),
  count: $t('Décompte'),
  url: 'Lien URL',
  email: $t('E-mail'),
  autonumber: $t('Numéro automatique'),
  user: $t('Personne'),
  formula: 'Formule',
  file: $t('Document'),
  image: $t('Image'),
  system: $t('Colonne système'),
}

/** How each format is named, when it names the field better than its type does. */
export const FORMAT_LABELS: Readonly<Record<string, string>> = {
  integer: $t('Entier'),
  currency: $t('Monnaie'),
  percent: $t('Pourcentage'),
  duration: $t('Durée'),
  rating: $t('Note'),
  phone: $t('Téléphone'),
  barcode: $t('Code-barres'),
  html: $t('Texte riche'),
}

/**
 * The format a field's glyph and name go by: its display format — or `html` for the rich
 * variant of a long text (chapter 04 §2.2), which is no display format but reads as one.
 */
export function shownFormat(field: {
  readonly unsafe_html?: boolean
  readonly format?: { readonly display: string }
}): string | undefined {
  return field.unsafe_html === true ? 'html' : field.format?.display
}

/** A type as one picks it: its glyph and its name, side by side. */
export function KindLabel({ kind, format }: { readonly kind: string; readonly format?: string }) {
  return (
    <span className="flex items-center gap-2">
      <FieldIcon kind={kind} format={format} />
      {(format === undefined ? undefined : FORMAT_LABELS[format]) ?? KIND_LABELS[kind] ?? kind}
    </span>
  )
}
