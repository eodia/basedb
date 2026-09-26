import { cn } from '@/lib/utils'
import {
  AlignLeft,
  Calendar,
  CaseSensitive,
  CircleChevronDown,
  Clock,
  Hash,
  Image as ImageIcon,
  Link,
  Link2,
  ListChecks,
  Lock,
  Paperclip,
  Sigma,
  ToggleLeft,
} from 'lucide-react'

/**
 * The glyph a column header wears.
 *
 * It comes from the field's `kind`, which comes from the catalog — never from a guess
 * about the column's name. A column called `date_de_naissance` that is stored as text is
 * a text column, and the header must say so.
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
  formula: Sigma,
  file: Paperclip,
  image: ImageIcon,
  url: Link,
  system: Lock,
} as const

export function FieldIcon({
  kind,
  className,
}: { readonly kind: string; readonly className?: string }) {
  const Icon = ICONS[kind as keyof typeof ICONS] ?? CaseSensitive
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
  url: 'Lien URL',
  formula: 'Formule',
  file: 'Document',
  image: 'Image',
  system: 'Colonne système',
}

/** A type as one picks it: its glyph and its name, side by side. */
export function KindLabel({ kind }: { readonly kind: string }) {
  return (
    <span className="flex items-center gap-2">
      <FieldIcon kind={kind} />
      {KIND_LABELS[kind] ?? kind}
    </span>
  )
}
