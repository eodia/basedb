import fs from 'node:fs'
import path from 'node:path'
import * as fontkit from 'fontkit'

/**
 * The faces a document is set in — chapter 21 §4.
 *
 * A Latin face in four styles (Latin, Greek, Cyrillic: seventeen of the twenty languages),
 * and a CJK face in two weights for what it lacks — Chinese, Japanese, Korean; each run of
 * text goes in the first face that has all its characters. The image ships Noto Sans and
 * Noto Sans CJK (`/usr/share/fonts`, Debian's packages); `BASEDB_PDF_FONTS` names a folder
 * of one's own; on a developer's machine, the system's faces serve. With none, the PDF's
 * own Helvetica sets what it can, and a character it cannot is written « ? ».
 */

export interface FontFace {
  readonly path: string
  /** The face's PostScript name, in a collection (`.ttc`) that holds several. */
  readonly family?: string
}

export interface FontSet {
  readonly regular: FontFace
  readonly bold: FontFace
  readonly italic: FontFace
  readonly boldItalic: FontFace
  /** For what the Latin face lacks, tried in order: each in a regular and a bold weight. */
  readonly fallbacks: ReadonlyArray<{ readonly regular: FontFace; readonly bold: FontFace }>
}

/** The CJK face whose glyph shapes are the reader's, by the document's language. */
const CJK_REGION: Readonly<Record<string, string>> = { ja: 'jp', ko: 'kr', 'zh-CN': 'sc' }

const exists = (file: string) => {
  try {
    return fs.statSync(file).isFile()
  } catch {
    return false
  }
}

function latinIn(dir: string, names: readonly [string, string, string, string]) {
  const files = names.map((n) => path.join(dir, n))
  return files.every(exists)
    ? {
        regular: { path: files[0] as string },
        bold: { path: files[1] as string },
        italic: { path: files[2] as string },
        boldItalic: { path: files[3] as string },
      }
    : null
}

/** The faces found for a document in `locale`, or `null`: the PDF's built-in Helvetica. */
export function findFonts(locale: string, folder = process.env.BASEDB_PDF_FONTS): FontSet | null {
  const region = CJK_REGION[locale] ?? 'sc'
  const cjk = (dir: string) => {
    const regular = path.join(dir, 'NotoSansCJK-Regular.ttc')
    const bold = path.join(dir, 'NotoSansCJK-Bold.ttc')
    if (!exists(regular)) return []
    const face = { path: regular, family: `NotoSansCJK${region}-Regular` }
    return [
      {
        regular: face,
        bold: exists(bold) ? { path: bold, family: `NotoSansCJK${region}-Bold` } : face,
      },
    ]
  }
  const noto = [
    'NotoSans-Regular.ttf',
    'NotoSans-Bold.ttf',
    'NotoSans-Italic.ttf',
    'NotoSans-BoldItalic.ttf',
  ] as const

  // An operator's folder first, then Debian's, as the image has them.
  for (const [latinDir, cjkDir] of [
    ...(folder ? [[folder, folder]] : []),
    ['/usr/share/fonts/truetype/noto', '/usr/share/fonts/opentype/noto'],
  ] as const) {
    const latin = latinIn(latinDir, noto)
    if (latin !== null) return { ...latin, fallbacks: cjk(cjkDir) }
  }

  // A developer's machine: the system's own faces.
  const windows = 'C:/Windows/Fonts'
  const arial = latinIn(windows, ['arial.ttf', 'arialbd.ttf', 'ariali.ttf', 'arialbi.ttf'])
  if (arial !== null) {
    const at = (file: string, family?: string) =>
      exists(path.join(windows, file))
        ? { path: path.join(windows, file), ...(family === undefined ? {} : { family }) }
        : null
    // The script of the document's language first: its glyph shapes are the reader's.
    const chinese = [at('msyh.ttc', 'MicrosoftYaHei'), at('msyhbd.ttc', 'MicrosoftYaHei-Bold')]
    const japanese = [at('YuGothR.ttc', 'YuGothic-Regular'), at('YuGothB.ttc', 'YuGothic-Bold')]
    const korean = [at('malgun.ttf'), at('malgunbd.ttf')]
    const order =
      locale === 'ja'
        ? [japanese, chinese, korean]
        : locale === 'ko'
          ? [korean, chinese, japanese]
          : [chinese, japanese, korean]
    return {
      ...arial,
      fallbacks: order.flatMap(([regular, bold]) =>
        regular === null || regular === undefined ? [] : [{ regular, bold: bold ?? regular }],
      ),
    }
  }
  const mac = '/System/Library/Fonts/Supplemental'
  const macArial = latinIn(mac, [
    'Arial.ttf',
    'Arial Bold.ttf',
    'Arial Italic.ttf',
    'Arial Bold Italic.ttf',
  ])
  if (macArial !== null) {
    const unicode = path.join(mac, 'Arial Unicode.ttf')
    return {
      ...macArial,
      fallbacks: exists(unicode) ? [{ regular: { path: unicode }, bold: { path: unicode } }] : [],
    }
  }
  return null
}

interface Coverage {
  hasGlyphForCodePoint(codePoint: number): boolean
}

const coverages = new Map<string, Coverage | null>()

/** Whether a face has a glyph for every character of `text`. Read once per face. */
export function covers(face: FontFace, text: string): boolean {
  const key = `${face.path}#${face.family ?? ''}`
  let coverage = coverages.get(key)
  if (coverage === undefined) {
    try {
      coverage = fontkit.openSync(face.path, face.family) as unknown as Coverage
    } catch {
      coverage = null
    }
    coverages.set(key, coverage)
  }
  if (coverage === null) return false
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number
    // Spaces and line breaks are drawn by position, not by glyph.
    if (cp <= 0x20 || cp === 0xa0 || cp === 0x202f) continue
    if (!coverage.hasGlyphForCodePoint(cp)) return false
  }
  return true
}

/** What the built-in Helvetica can write: Windows-1252, the rest as « ? ». */
const WIN_ANSI_EXTRAS = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ')

export function winAnsi(text: string): string {
  let out = ''
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number
    out += cp <= 0xff || WIN_ANSI_EXTRAS.has(ch) ? ch : '?'
  }
  return out
}
