import type {
  DocumentBlock,
  DocumentColumnBlock,
  DocumentFieldsBlock,
  DocumentSpec,
  Field,
  Table,
} from '@/lib/api/client'
import { $t, locale } from '@/lib/i18n'
import {
  DEFAULT_FOOTER,
  DEFAULT_HEADER,
  DEFAULT_THEME,
  type RowsChoice,
  cite,
  displayOf,
  escapeHtml,
  kindOf,
  numeric,
  rowsColumns,
  shown,
} from './model'

/**
 * Starting points for a new template — an invoice, a quote, a record sheet, a certificate.
 * Each is built from the table it is for: its name column, its dates, its amounts, its
 * picture, the rows linked to it; what the table does not have is left out, never shown
 * empty. The texts are the editor's language, as a person would type them.
 */

export type PresetId = 'blank' | 'invoice' | 'quote' | 'sheet' | 'certificate'

export interface Preset {
  readonly id: PresetId
  readonly label: string
  readonly description: string
  /** The accent its miniature is drawn in. */
  readonly accent: string
}

export function presets(): Preset[] {
  return [
    {
      id: 'blank',
      label: $t('Page vierge'),
      description: $t('Un titre et les champs de la ligne, à composer soi-même.'),
      accent: DEFAULT_THEME.accent,
    },
    {
      id: 'invoice',
      label: $t('Facture'),
      description: $t('En-tête avec logo, client, lignes facturées, totaux et mentions.'),
      accent: '#0f766e',
    },
    {
      id: 'quote',
      label: $t('Devis'),
      description: $t('Bandeau de titre, prestations, conditions et bon pour accord.'),
      accent: '#4338ca',
    },
    {
      id: 'sheet',
      label: $t('Fiche'),
      description: $t('Grand titre, photo, champs en grille et textes longs.'),
      accent: '#c2410c',
    },
    {
      id: 'certificate',
      label: $t('Attestation'),
      description: $t('Paysage, cadre double, texte centré et signature.'),
      accent: '#92400e',
    },
  ]
}

interface Facts {
  readonly table: Table
  readonly named: string | undefined
  readonly date: Field | undefined
  readonly status: Field | undefined
  readonly picture: Field | undefined
  readonly amounts: readonly Field[]
  readonly longTexts: readonly Field[]
  /** Short values worth a line of their own: dates, choices, contacts, links. */
  readonly details: readonly Field[]
  readonly party: Field | undefined
  readonly rows: RowsChoice | undefined
}

function factsOf(table: Table, sources: readonly RowsChoice[]): Facts {
  const fields = shown(table.fields)
  const named = displayOf(table)
  const amount = (f: Field) => numeric(f) && (f.valueField ?? f).format?.display === 'currency'
  return {
    table,
    named,
    date: fields.find((f) => kindOf(f) === 'date' || kindOf(f) === 'datetime'),
    status: fields.find((f) => kindOf(f) === 'select'),
    picture: fields.find((f) => f.kind === 'image'),
    amounts: fields.filter(amount),
    longTexts: fields.filter((f) => f.kind === 'long_text'),
    details: fields.filter(
      (f) =>
        f.name !== named &&
        [
          'date',
          'datetime',
          'select',
          'email',
          'url',
          'user',
          'link',
          'short_text',
          'number',
          'autonumber',
        ].includes(kindOf(f)) &&
        !amount(f),
    ),
    party: fields.find((f) => f.kind === 'link'),
    // A relation whose rows have something to sum first: an invoice's lines.
    rows:
      sources.find((s) => rowsColumns(s.table).totals.length > 0) ??
      sources.find((s) => s.source.kind === 'incoming') ??
      sources[0],
  }
}

const p = (html: string) => `<p>${html}</p>`
const text = (html: string, extra: Partial<Extract<DocumentBlock, { kind: 'text' }>> = {}) =>
  ({ kind: 'text', html, align: 'left', size: 'normal', style: 'plain', ...extra }) as const
const fields = (
  names: readonly string[],
  extra: Partial<DocumentFieldsBlock> = {},
): DocumentFieldsBlock => ({
  kind: 'fields',
  fields: names,
  columns: 1,
  labels: 'beside',
  hide_empty: true,
  ...extra,
})

function rowsBlock(facts: Facts, style: 'light' | 'accent' | 'lines'): DocumentBlock[] {
  if (facts.rows === undefined) return []
  const { columns, totals } = rowsColumns(facts.rows.table)
  if (columns.length === 0) return []
  return [
    {
      kind: 'rows',
      title: '',
      source: facts.rows.source,
      columns,
      totals,
      style,
      zebra: style !== 'lines',
      headers: {},
      widths: {},
      align: {},
    },
  ]
}

/** « N° {{numero}} », « Date : {{date}} »: the lines that say which document this is. */
function reference(facts: Facts): string {
  const lines: string[] = []
  if (facts.named !== undefined)
    lines.push(`<strong>${escapeHtml($t('N° {number}', { number: cite(facts.named) }))}</strong>`)
  if (facts.date !== undefined)
    lines.push(escapeHtml($t('Date : {date}', { date: cite(facts.date.name) })))
  return lines.length === 0 ? '' : p(lines.join('<br>'))
}

const company = () =>
  p(
    [
      `<strong>${escapeHtml($t('Votre entreprise'))}</strong>`,
      escapeHtml($t('Adresse, code postal et ville')),
      escapeHtml($t('Téléphone — courriel')),
    ].join('<br>'),
  )

const legal = () =>
  p(escapeHtml($t('Votre entreprise — SIRET, numéro de TVA, coordonnées bancaires')))

function base(): Omit<DocumentSpec, 'blocks'> {
  return {
    page: { size: 'A4', orientation: 'portrait', valign: 'top' },
    locale: locale(),
    theme: DEFAULT_THEME,
    header: DEFAULT_HEADER,
    footer: DEFAULT_FOOTER,
  }
}

/** A template built from a starting point, for a table. */
export function buildPreset(
  id: PresetId,
  table: Table,
  sources: readonly RowsChoice[],
): { label: string; spec: DocumentSpec } {
  const facts = factsOf(table, sources)
  switch (id) {
    case 'blank':
      return {
        label: $t('Nouveau modèle'),
        spec: {
          ...base(),
          theme: { ...DEFAULT_THEME, titles: 'accent' },
          blocks: [
            {
              kind: 'title',
              text: facts.named === undefined ? table.label : cite(facts.named),
              subtitle: '',
              style: 'accent',
              align: 'left',
              size: 'large',
            },
            fields([]),
          ],
        },
      }
    case 'invoice':
      return { label: $t('Facture'), spec: invoice(facts) }
    case 'quote':
      return { label: $t('Devis'), spec: quote(facts) }
    case 'sheet':
      return { label: $t('Fiche'), spec: sheet(facts) }
    case 'certificate':
      return { label: $t('Attestation'), spec: certificate(facts) }
  }
}

function invoice(facts: Facts): DocumentSpec {
  const recipient: DocumentColumnBlock[] =
    facts.party === undefined
      ? [
          text(
            `<h3>${escapeHtml($t('Facturé à'))}</h3>${p(escapeHtml($t('Nom et adresse du client')))}`,
          ),
        ]
      : [
          text(
            `<h3>${escapeHtml($t('Facturé à'))}</h3>${p(`<strong>${cite(facts.party.name)}</strong>`)}`,
          ),
        ]
  const details = facts.details
    .filter((f) => f.name !== facts.party?.name && f.name !== facts.date?.name)
    .slice(0, 4)
    .map((f) => f.name)
  const blocks: DocumentBlock[] = [
    {
      kind: 'columns',
      widths: [1, 1],
      columns: [
        recipient,
        details.length > 0 ? [fields(details, { labels: 'above', columns: 2 })] : [],
      ],
    },
    { kind: 'spacer', height: 4 },
    ...rowsBlock(facts, 'accent'),
  ]
  const terms = text(
    p(
      `<strong>${escapeHtml($t('Conditions de paiement'))}</strong> — ${escapeHtml(
        $t(
          'À régler par virement à réception de facture. Précisez ici l’échéance et les pénalités de retard.',
        ),
      )}`,
    ),
    { size: 'small', style: 'tint' },
  )
  blocks.push(
    facts.amounts.length > 0
      ? {
          kind: 'columns',
          widths: [3, 2],
          columns: [
            [terms],
            [
              fields(
                facts.amounts.slice(-4).map((f) => f.name),
                { labels: 'summary', hide_empty: false },
              ),
            ],
          ],
        }
      : terms,
  )
  blocks.push(
    text(p(`<em>${escapeHtml($t('Merci de votre confiance.'))}</em>`), {
      align: 'center',
      size: 'small',
    }),
  )
  return {
    ...base(),
    theme: { ...DEFAULT_THEME, accent: '#0f766e', titles: 'accent' },
    header: {
      show: 'every',
      logo: null,
      logo_width: 40,
      left: company(),
      right: `<h1>${escapeHtml($t('FACTURE'))}</h1>${reference(facts)}`,
      rule: true,
    },
    footer: { html: legal(), align: 'left', page_numbers: true, rule: true },
    blocks,
  }
}

function quote(facts: Facts): DocumentSpec {
  const details = facts.details.slice(0, 6).map((f) => f.name)
  const blocks: DocumentBlock[] = [
    {
      kind: 'title',
      text:
        facts.named === undefined
          ? $t('Devis')
          : $t('Devis {number}', { number: cite(facts.named) }),
      subtitle: facts.date === undefined ? '' : $t('du {date}', { date: cite(facts.date.name) }),
      style: 'band',
      align: 'left',
      size: 'large',
    },
  ]
  if (details.length > 0) blocks.push(fields(details, { labels: 'above', columns: 3 }))
  const rows = rowsBlock(facts, 'lines')
  if (rows.length > 0) blocks.push(text(`<h2>${escapeHtml($t('Prestations'))}</h2>`), ...rows)
  if (facts.amounts.length > 0)
    blocks.push({
      kind: 'columns',
      widths: [3, 2],
      columns: [
        [],
        [
          fields(
            facts.amounts.slice(-4).map((f) => f.name),
            { labels: 'summary', hide_empty: false },
          ),
        ],
      ],
    })
  blocks.push(
    text(
      p(
        `<strong>${escapeHtml($t('Validité et délais'))}</strong> — ${escapeHtml(
          $t('Devis valable 30 jours. Précisez ici les délais et les conditions de règlement.'),
        )}`,
      ),
      { style: 'bar' },
    ),
    { kind: 'spacer', height: 6 },
    {
      kind: 'columns',
      widths: [1, 1],
      columns: [
        [
          text(
            p(
              `<strong>${escapeHtml($t('Votre entreprise'))}</strong><br>${escapeHtml($t('Nom et fonction du signataire'))}`,
            ),
            { size: 'small' },
          ),
        ],
        [
          text(
            p(
              `<strong>${escapeHtml($t('Bon pour accord'))}</strong> — ${escapeHtml($t('date et signature du client'))}`,
            ),
            { size: 'small' },
          ),
          { kind: 'spacer', height: 18 },
          { kind: 'divider', color: 'text', thickness: 0.5, width: 80 },
        ],
      ],
    },
  )
  return {
    ...base(),
    theme: { ...DEFAULT_THEME, accent: '#4338ca', titles: 'rule' },
    header: { show: 'first', logo: null, logo_width: 40, left: '', right: company(), rule: false },
    footer: {
      html: legal(),
      align: 'center',
      page_numbers: true,
      rule: true,
    },
    blocks,
  }
}

function sheet(facts: Facts): DocumentSpec {
  const subtitle = facts.status ?? facts.details.find((f) => kindOf(f) === 'short_text')
  // Short values, a price among them, in the table's order — the subtitle's said already.
  const short = shown(facts.table.fields)
    .filter((f) => facts.details.includes(f) || facts.amounts.includes(f))
    .filter((f) => f !== subtitle)
    .map((f) => f.name)
  const blocks: DocumentBlock[] = [
    {
      kind: 'title',
      text: facts.named === undefined ? facts.table.label : cite(facts.named),
      subtitle: subtitle === undefined ? facts.table.label : cite(subtitle.name),
      style: 'bleed',
      align: 'left',
      size: 'huge',
    },
  ]
  const grid = short.slice(0, 8)
  if (facts.picture !== undefined) {
    blocks.push({
      kind: 'columns',
      widths: [1, 1],
      columns: [
        [
          {
            kind: 'image',
            source: { kind: 'field', field: facts.picture.name },
            width: 100,
            align: 'left',
          },
        ],
        grid.length > 0 ? [fields(grid, { labels: 'above', columns: 2 })] : [],
      ],
    })
  } else if (grid.length > 0) {
    blocks.push(fields(grid, { labels: 'above', columns: 3 }))
  }
  for (const long of facts.longTexts.slice(0, 3))
    blocks.push(text(`<h2>${escapeHtml(long.label)}</h2>${p(cite(long.name))}`))
  const rest = shown(facts.table.fields)
    .filter(
      (f) =>
        f.name !== facts.named &&
        f !== subtitle &&
        !grid.includes(f.name) &&
        f.kind !== 'image' &&
        !facts.longTexts.slice(0, 3).includes(f),
    )
    .map((f) => f.name)
  if (rest.length > 0)
    blocks.push({ kind: 'divider', color: 'light', thickness: 1, width: 100 }, fields(rest))
  blocks.push(...rowsBlock(facts, 'light'))
  return {
    ...base(),
    theme: { ...DEFAULT_THEME, accent: '#c2410c', titles: 'accent' },
    footer: {
      html: p(escapeHtml(facts.table.label)),
      align: 'left',
      page_numbers: true,
      rule: false,
    },
    blocks,
  }
}

function certificate(facts: Facts): DocumentSpec {
  const who = facts.named === undefined ? escapeHtml($t('Nom de la personne')) : cite(facts.named)
  const when =
    facts.date === undefined
      ? escapeHtml($t('Fait à …, le …'))
      : escapeHtml($t('Fait à …, le {date}', { date: cite(facts.date.name) }))
  return {
    ...base(),
    page: { size: 'A4', orientation: 'landscape', valign: 'center' },
    theme: {
      ...DEFAULT_THEME,
      accent: '#92400e',
      font: 'serif',
      title_font: 'serif',
      size: 12,
      margin: 26,
      titles: 'accent',
      border: 'double',
    },
    header: { ...DEFAULT_HEADER, show: 'first' },
    footer: { ...DEFAULT_FOOTER, page_numbers: false },
    blocks: [
      {
        kind: 'title',
        text: $t('Attestation'),
        subtitle: $t('Objet de l’attestation'),
        style: 'plain',
        align: 'center',
        size: 'huge',
      },
      { kind: 'divider', color: 'accent', thickness: 1.5, width: 12 },
      text(
        `${p(escapeHtml($t('Nous attestons que')))}<h1>${who}</h1>${p(escapeHtml($t('Décrivez ici ce qui est attesté : une formation suivie, une participation, une réussite.')))}`,
        { align: 'center', size: 'large' },
      ),
      { kind: 'spacer', height: 8 },
      {
        kind: 'columns',
        widths: [1, 1],
        columns: [
          [{ kind: 'spacer', height: 14 }, text(p(when), { align: 'center' })],
          [
            { kind: 'spacer', height: 14 },
            { kind: 'divider', color: 'text', thickness: 0.5, width: 80 },
            text(p(`<strong>${escapeHtml($t('Signature'))}</strong>`), { align: 'center' }),
          ],
        ],
      },
    ],
  }
}
