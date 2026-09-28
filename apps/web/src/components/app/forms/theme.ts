import { $t } from '@/lib/i18n'
import type { FormAlign, FormFont, FormTheme } from '@basedb/contracts'
import type { CSSProperties } from 'react'

/**
 * The looks of a form — chapter 11 §1.4. Each theme is a whole: a background, a type, the
 * colours of its words and fields, the roundness of its corners, and an accent of its own
 * for when neither the form nor its table has one. The accent is what the person acts on:
 * buttons, the chosen answer, the progress, the confetti.
 *
 * Everything reaches the screen as CSS variables on the form's root (`--fm-*`), so the
 * widgets read one vocabulary whatever the theme: a dark theme is a set of values, not a
 * second set of components.
 */

export interface ThemeLook {
  readonly label: string
  readonly dark: boolean
  readonly font: Exclude<FormFont, 'auto'>
  /** The accent when neither the form nor its table chooses one. */
  readonly accent: string
  /** CSS `background`; `var(--fm-accent)` in it follows the accent. */
  readonly background: string
  readonly fg: string
  readonly muted: string
  readonly border: string
  /** Behind the one-page form's questions, and the neutral widgets. */
  readonly surface: string
  /** The inside of a field, a choice not taken. */
  readonly field: string
  readonly radius: string
}

export const THEMES: Readonly<Record<FormTheme, ThemeLook>> = {
  clair: {
    label: $t('Clair'),
    dark: false,
    font: 'sans',
    accent: '#4f46e5',
    background:
      'radial-gradient(1100px 520px at 12% -8%, color-mix(in srgb, var(--fm-accent) 11%, transparent), transparent 70%), #fbfbfd',
    fg: '#0f172a',
    muted: '#64748b',
    border: 'rgba(15, 23, 42, 0.14)',
    surface: '#ffffff',
    field: 'rgba(255, 255, 255, 0.9)',
    radius: '0.75rem',
  },
  doux: {
    label: $t('Doux'),
    dark: false,
    font: 'rounded',
    accent: '#db2777',
    background:
      'radial-gradient(900px 600px at 0% 0%, color-mix(in srgb, var(--fm-accent) 24%, white), transparent 70%), radial-gradient(800px 560px at 100% 100%, color-mix(in srgb, var(--fm-accent) 16%, #fde68a), transparent 70%), #fffaf7',
    fg: '#3b1d2c',
    muted: '#8b6474',
    border: 'rgba(59, 29, 44, 0.14)',
    surface: 'rgba(255, 255, 255, 0.78)',
    field: 'rgba(255, 255, 255, 0.72)',
    radius: '1.25rem',
  },
  aurore: {
    label: $t('Aurore'),
    dark: false,
    font: 'sans',
    accent: '#c2410c',
    background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 42%, #f3c4f0 78%, #d9c8ff 100%)',
    fg: '#2d1219',
    muted: '#7c4a4f',
    border: 'rgba(45, 18, 25, 0.16)',
    surface: 'rgba(255, 255, 255, 0.62)',
    field: 'rgba(255, 255, 255, 0.55)',
    radius: '1rem',
  },
  ocean: {
    label: $t('Océan'),
    dark: true,
    font: 'sans',
    accent: '#38bdf8',
    background: 'linear-gradient(160deg, #0b1e3f 0%, #0f3b6e 52%, #0e7490 100%)',
    fg: '#f0f9ff',
    muted: 'rgba(224, 242, 254, 0.72)',
    border: 'rgba(224, 242, 254, 0.24)',
    surface: 'rgba(255, 255, 255, 0.07)',
    field: 'rgba(255, 255, 255, 0.08)',
    radius: '0.875rem',
  },
  foret: {
    label: $t('Forêt'),
    dark: true,
    font: 'serif',
    accent: '#86efac',
    background:
      'radial-gradient(1000px 600px at 90% -10%, rgba(134, 239, 172, 0.18), transparent 70%), linear-gradient(165deg, #0c2418 0%, #14432b 58%, #1b5e3a 100%)',
    fg: '#ecfdf5',
    muted: 'rgba(209, 250, 229, 0.72)',
    border: 'rgba(209, 250, 229, 0.22)',
    surface: 'rgba(255, 255, 255, 0.06)',
    field: 'rgba(255, 255, 255, 0.07)',
    radius: '0.75rem',
  },
  nuit: {
    label: $t('Nuit'),
    dark: true,
    font: 'sans',
    accent: '#a78bfa',
    background:
      'radial-gradient(900px 520px at 50% -12%, color-mix(in srgb, var(--fm-accent) 34%, transparent), transparent 70%), #09090f',
    fg: '#f5f5f7',
    muted: 'rgba(228, 228, 237, 0.66)',
    border: 'rgba(228, 228, 237, 0.18)',
    surface: 'rgba(255, 255, 255, 0.05)',
    field: 'rgba(255, 255, 255, 0.06)',
    radius: '0.875rem',
  },
  papier: {
    label: $t('Papier'),
    dark: false,
    font: 'serif',
    accent: '#9a3412',
    background:
      'radial-gradient(circle at 20% 10%, rgba(255, 255, 255, 0.7), transparent 55%), #f5efe3',
    fg: '#2b2118',
    muted: '#7a6a58',
    border: 'rgba(43, 33, 24, 0.18)',
    surface: '#fbf8f1',
    field: 'rgba(255, 253, 248, 0.9)',
    radius: '0.375rem',
  },
  minimal: {
    label: $t('Minimal'),
    dark: false,
    font: 'sans',
    accent: '#111111',
    background: '#ffffff',
    fg: '#0a0a0a',
    muted: '#6b6b6b',
    border: 'rgba(0, 0, 0, 0.16)',
    surface: '#ffffff',
    field: '#ffffff',
    radius: '0.25rem',
  },
}

export const FONTS: Readonly<Record<Exclude<FormFont, 'auto'>, { label: string; stack: string }>> =
  {
    sans: {
      label: $t('Sans empattement'),
      stack:
        'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    serif: {
      label: $t('Avec empattement'),
      stack: '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
    },
    rounded: {
      label: $t('Arrondie'),
      stack:
        'ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", "Arial Rounded MT Bold", system-ui, sans-serif',
    },
    mono: {
      label: $t('Machine à écrire'),
      stack:
        'ui-monospace, "SF Mono", "Cascadia Code", "JetBrains Mono", Menlo, Consolas, monospace',
    },
  }

/** The choices that make a form's look — what its spec holds. */
export interface FormLook {
  readonly theme: FormTheme
  /** `#rrggbb`, or empty for the table's colour, then the theme's. */
  readonly accent: string
  readonly font: FormFont
  readonly align: FormAlign
}

/** The accent a form wears: its own, else its table's, else its theme's. */
export function accentOf(look: FormLook, tableColor: string | null | undefined): string {
  if (/^#[0-9a-f]{6}$/i.test(look.accent)) return look.accent
  if (typeof tableColor === 'string' && /^#[0-9a-f]{6}$/i.test(tableColor)) return tableColor
  return THEMES[look.theme].accent
}

/** Relative luminance, WCAG — to write on the accent in white or in near black. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** What is written on the accent: white, unless the accent is light enough to need ink. */
export const onAccent = (accent: string) => (luminance(accent) > 0.45 ? '#0b0b0f' : '#ffffff')

/** The root style of a form: its variables, its background, its type. */
export function lookStyle(
  look: FormLook,
  tableColor: string | null | undefined,
): { readonly style: CSSProperties; readonly dark: boolean; readonly accent: string } {
  const theme = THEMES[look.theme]
  const accent = accentOf(look, tableColor)
  const font = FONTS[look.font === 'auto' ? theme.font : look.font]
  return {
    dark: theme.dark,
    accent,
    style: {
      '--fm-accent': accent,
      '--fm-on-accent': onAccent(accent),
      '--fm-accent-soft': `color-mix(in srgb, ${accent} ${theme.dark ? 22 : 12}%, transparent)`,
      '--fm-accent-line': `color-mix(in srgb, ${accent} 55%, transparent)`,
      '--fm-fg': theme.fg,
      '--fm-muted': theme.muted,
      '--fm-border': theme.border,
      '--fm-surface': theme.surface,
      '--fm-field': theme.field,
      '--fm-radius': theme.radius,
      background: theme.background,
      color: theme.fg,
      fontFamily: font.stack,
      colorScheme: theme.dark ? 'dark' : 'light',
    } as CSSProperties,
  }
}
