import type { FieldOption, FieldOptionInput } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { LOOK_COLORS } from '@basedb/contracts'

/**
 * The options of a list of choices, as an editor holds them.
 *
 * An option has a stored VALUE and a free LABEL. The value is what a column holds and what
 * `WHERE statut = 'en_retard'` reads, so once the catalog has it, it is never renamed here
 * (that would be a rewrite of the table's data). A NEW option has no value yet: it is
 * derived from its label when the list is sent, as a slug — the form chapter 04 §3 gives
 * to stored values — and de-duplicated against the others.
 */

/** Mirrors the kernel's ceiling: a picture is a URL, and every catalog read carries it. */
export const MAX_IMAGE_CHARS = 16_384

export interface OptionDraft {
  /** Stable across edits, for React: neither the label nor the position can serve. */
  readonly key: string
  /** Empty for an option that does not exist yet. */
  readonly value: string
  readonly label: string
  readonly color: string | null
  readonly icon: string | null
  readonly image: string | null
  /** True when the catalog already holds this value: it can be re-dressed, not renamed. */
  readonly locked: boolean
}

let sequence = 0
export const nextKey = () => `option-${++sequence}`

export function emptyDraft(): OptionDraft {
  return {
    key: nextKey(),
    value: '',
    label: '',
    color: null,
    icon: null,
    image: null,
    locked: false,
  }
}

export function draftsOf(options: readonly FieldOption[] | undefined): OptionDraft[] {
  return (options ?? []).map((o) => ({
    key: nextKey(),
    value: o.value,
    label: o.label,
    color: o.color ?? null,
    icon: o.icon ?? null,
    image: o.image ?? null,
    locked: true,
  }))
}

/** `À contacter !` becomes `a_contacter`: ASCII, lowercase, words joined by `_`. */
export function slugify(text: string): string {
  const slug = text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return slug === '' ? 'option' : slug.slice(0, 200)
}

/**
 * The value each draft will be stored under: its own when the catalog has it, else the
 * slug of its label — suffixed `_2`, `_3`… when another option already took it.
 */
export function valuesOf(drafts: readonly OptionDraft[]): string[] {
  const taken = new Set(drafts.filter((d) => d.locked).map((d) => d.value))
  return drafts.map((d) => {
    if (d.locked) return d.value
    const base = slugify(d.value !== '' ? d.value : d.label)
    let candidate = base
    for (let n = 2; taken.has(candidate); n++) candidate = `${base}_${n}`
    taken.add(candidate)
    return candidate
  })
}

/** A blank row is not an option: the editor keeps one to type in, the list drops it. */
export const isBlank = (d: OptionDraft) => d.label.trim() === '' && d.value === ''

/** What the API takes: keys present only when set, so the JSON stays as short as it can. */
export function optionsOf(drafts: readonly OptionDraft[]): FieldOptionInput[] {
  const kept = drafts.filter((d) => !isBlank(d))
  const values = valuesOf(kept)
  return kept.map((d, i) => ({
    value: values[i],
    label: d.label.trim() === '' ? values[i] : d.label.trim(),
    ...(d.color === null ? {} : { color: d.color }),
    ...(d.icon === null ? {} : { icon: d.icon }),
    ...(d.image === null ? {} : { image: d.image }),
  }))
}

export const serializeOptions = (drafts: readonly OptionDraft[]) =>
  JSON.stringify(optionsOf(drafts), null, 2)

// ── Colour ───────────────────────────────────────────────────────────────────────────

/** `#abc` and `#AABBCC` both become `#aabbcc`; anything else is not a colour. */
export function normalizeHex(text: string): string | null {
  const t = text.trim()
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(t)) return null
  const hex = t.slice(1).toLowerCase()
  return `#${hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex}`
}

/** A starting point, not a limit: the picker takes any colour. */
export const PRESET_COLORS: readonly string[] = LOOK_COLORS

// ── JSON in, JSON out ────────────────────────────────────────────────────────────────

export type Parsed =
  | { readonly ok: true; readonly drafts: OptionDraft[] }
  | { readonly ok: false; readonly error: string }

const ICON_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/
const IMAGE_URL = /^(https:\/\/\S+|data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/]+=*)$/i

/**
 * Reads a pasted list. It takes what the editor produces — an array of objects — and the
 * two shorter forms a person is likely to have to hand: an array of plain strings, and the
 * `{ "options": [...] }` the API answers with.
 *
 * `known` holds the values the catalog already has, so a pasted option that names one keeps
 * it (locked) instead of being read as a new option that would clash with it.
 */
export function parseOptionsJson(text: string, known: ReadonlySet<string>): Parsed {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: $t('Ce n’est pas du JSON valide.') }
  }
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { options?: unknown })?.options)
      ? (raw as { options: unknown[] }).options
      : null
  if (list === null) {
    return {
      ok: false,
      error: $t('Attendu : une liste, par exemple [{ "value": "actif", "label": "Actif" }].'),
    }
  }
  if (list.length === 0) return { ok: false, error: $t('La liste est vide.') }

  const drafts: OptionDraft[] = []
  for (const [index, item] of list.entries()) {
    const at = $t('Élément {value}', { value: index + 1 })
    const entry = typeof item === 'string' ? { label: item } : (item as Record<string, unknown>)
    if (entry === null || typeof entry !== 'object') {
      return { ok: false, error: $t('{at} : ni un texte ni un objet.', { at }) }
    }

    const value = typeof entry.value === 'string' ? entry.value.trim() : ''
    const label = typeof entry.label === 'string' ? entry.label.trim() : ''
    if (value === '' && label === '')
      return { ok: false, error: $t('{at} : ni « value » ni « label ».', { at }) }

    let color: string | null = null
    if (entry.color !== undefined && entry.color !== null && entry.color !== '') {
      color = typeof entry.color === 'string' ? normalizeHex(entry.color) : null
      if (color === null)
        return { ok: false, error: $t('{at} : couleur invalide (attendu #rrggbb).', { at }) }
    }

    let icon: string | null = null
    if (entry.icon !== undefined && entry.icon !== null && entry.icon !== '') {
      if (typeof entry.icon !== 'string' || !ICON_NAME.test(entry.icon.trim())) {
        return { ok: false, error: $t('{at} : nom de pictogramme invalide.', { at }) }
      }
      icon = entry.icon.trim()
    }

    let image: string | null = null
    if (entry.image !== undefined && entry.image !== null && entry.image !== '') {
      if (typeof entry.image !== 'string' || !IMAGE_URL.test(entry.image.trim())) {
        return { ok: false, error: $t('{at} : image invalide (https ou data:image).', { at }) }
      }
      if (entry.image.trim().length > MAX_IMAGE_CHARS) {
        return { ok: false, error: $t('{at} : image trop lourde.', { at }) }
      }
      image = entry.image.trim()
    }
    if (icon !== null && image !== null) {
      return { ok: false, error: $t('{at} : un pictogramme ou une image, pas les deux.', { at }) }
    }

    const stored = value !== '' ? value : slugify(label)
    drafts.push({
      key: nextKey(),
      value: stored,
      label: label !== '' ? label : value,
      color,
      icon,
      image,
      locked: known.has(stored),
    })
  }

  // Two entries naming the same stored value are one option written twice.
  const seen = new Set<string>()
  for (const d of drafts) {
    if (seen.has(d.value))
      return {
        ok: false,
        error: $t('La valeur « {value} » apparaît deux fois.', { value: d.value }),
      }
    seen.add(d.value)
  }
  return { ok: true, drafts }
}

// ── Pictures ─────────────────────────────────────────────────────────────────────────

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Image illisible.'))
    image.src = url
  })
}

/**
 * Turns a picked file into a small data URL, or refuses it.
 *
 * An option's picture is stored in the catalog and travels with every read of the base, so
 * it has to stay small: the file is drawn onto a canvas at most 64 pixels on a side (then
 * 48, then 32 if it still does not fit) and re-encoded. A vector image comes out rasterised,
 * which is also what keeps a script out of it.
 */
export async function shrinkImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Ce fichier n’est pas une image.')
  const url = URL.createObjectURL(file)
  try {
    const image = await load(url)
    const width = image.naturalWidth > 0 ? image.naturalWidth : 64
    const height = image.naturalHeight > 0 ? image.naturalHeight : 64

    for (const side of [64, 48, 32]) {
      const scale = Math.min(1, side / Math.max(width, height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(width * scale))
      canvas.height = Math.max(1, Math.round(height * scale))
      const context = canvas.getContext('2d')
      if (context === null) throw new Error('Image illisible.')
      context.drawImage(image, 0, 0, canvas.width, canvas.height)

      for (const [type, quality] of [
        ['image/webp', 0.85],
        ['image/png', undefined],
      ] as const) {
        const data = canvas.toDataURL(type, quality)
        // A browser that cannot encode WebP answers with a PNG: only a match is kept.
        if (data.startsWith(`data:${type}`) && data.length <= MAX_IMAGE_CHARS) return data
      }
    }
    throw new Error('Image trop détaillée : choisissez-en une plus simple.')
  } finally {
    URL.revokeObjectURL(url)
  }
}
