import type { BasedbError } from '../errors/index.js'

/**
 * How a thing looks — an option of a list, a base, a table (chapter 04 §3, chapter 02).
 *
 * A colour of any hue, and either a pictogram of the interface's icon library or a small
 * picture. Catalog only: no column of the user's schema knows it, so changing it takes no
 * lock and rewrites no row. One set of rules for the three, so that a look pasted from an
 * option onto a table is either valid on both or refused on both.
 */

/**
 * The longest picture, as the URL that carries it. A data URL of a 64-pixel icon is a few
 * kilobytes; the ceiling is what keeps a catalog read from growing by megabytes, since
 * every look travels with every description of a base.
 */
export const MAX_IMAGE_CHARS = 16_384

export interface LookInput {
  /** `#rgb` or `#rrggbb`; stored as `#rrggbb`, lowercase. */
  readonly color?: string | null
  /** The name of a pictogram, in kebab case. Exclusive with `image`. */
  readonly icon?: string | null
  /** An `https` URL or a `data:image/…;base64,` URL. Exclusive with `icon`. */
  readonly image?: string | null
}

export interface Look {
  readonly color: string | null
  readonly icon: string | null
  readonly image: string | null
}

const COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
const ICON = /^[a-z0-9]+(-[a-z0-9]+)*$/
const DATA_IMAGE = /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/]+=*$/i
const HTTPS_IMAGE = /^https:\/\/[^\s]+$/i

/** Blank is absent: an empty box in a form clears the property rather than failing. */
const present = (raw: string | null | undefined): string | null => {
  const text = typeof raw === 'string' ? raw.trim() : ''
  return text === '' ? null : text
}

/**
 * Validates and normalises a look. `fail` builds the refusal, so each caller names the
 * thing refused — the option of a list, a base, a table — with the same reasons:
 * `icone_invalide`, `image_invalide`, `image_trop_grande`, `icone_et_image`,
 * `couleur_invalide`.
 */
export function normalizeLook(raw: LookInput, fail: (reason: string) => BasedbError): Look {
  const icon = present(raw.icon)
  if (icon !== null && (!ICON.test(icon) || icon.length > 64)) throw fail('icone_invalide')

  const image = present(raw.image)
  if (image !== null) {
    if (!DATA_IMAGE.test(image) && !HTTPS_IMAGE.test(image)) throw fail('image_invalide')
    if (image.length > MAX_IMAGE_CHARS) throw fail('image_trop_grande')
  }
  if (icon !== null && image !== null) throw fail('icone_et_image')

  // `#abc` becomes `#aabbcc`, and case is folded: what the catalog's CHECK expects.
  const text = present(raw.color)
  let color: string | null = null
  if (text !== null) {
    if (!COLOR.test(text)) throw fail('couleur_invalide')
    const hex = text.slice(1).toLowerCase()
    color = `#${hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex}`
  }

  return { color, icon, image }
}

/** True when the request says anything about the look: the three keys travel together. */
export const touchesLook = (raw: LookInput): boolean =>
  raw.color !== undefined || raw.icon !== undefined || raw.image !== undefined
