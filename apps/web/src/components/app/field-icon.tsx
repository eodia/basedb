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
  short_text: 'Texte',
  long_text: 'Texte long',
  number: 'Nombre',
  boolean: 'Booléen',
  date: 'Date',
  datetime: 'Date et heure',
  select: 'Liste de choix',
  multi_select: 'Choix multiple',
  link: 'Relation',
  multi_link: 'Relation multiple',
  lookup: 'Recherche',
  rollup: 'Cumul',
  count: 'Décompte',
  url: 'Lien URL',
  email: 'E-mail',
  autonumber: 'Numéro automatique',
  user: 'Personne',
  formula: 'Formule',
  file: 'Document',
  image: 'Image',
  system: 'Colonne système',
}

/** How each format is named, when it names the field better than its type does. */
export const FORMAT_LABELS: Readonly<Record<string, string>> = {
  integer: 'Entier',
  currency: 'Monnaie',
  percent: 'Pourcentage',
  duration: 'Durée',
  rating: 'Note',
  phone: 'Téléphone',
  barcode: 'Code-barres',
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
