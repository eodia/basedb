import { describe, expect, it } from 'vitest'
import { findFonts } from '../../src/documents/fonts.js'
import { MAX_IMAGE_BYTES, decodeImage, imageFacts } from '../../src/documents/images.js'
import {
  type LaidBlock,
  type LaidDocument,
  layoutPdf,
  mix,
  onColor,
} from '../../src/documents/layout.js'
import { DEFAULT_THEME, parseSpec, readSpec } from '../../src/documents/spec.js'

/**
 * Documents without a database — chapter 21: a definition read strictly when written and
 * leniently when stored, pictures recognised by their bytes, and pages composed.
 */

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)
/** A JPEG reduced to what says its size: SOI, an APP0 segment, a SOF0 of 3 × 2. */
const JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x02, 0x00,
  0x03, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9,
])

const reason = (run: () => unknown): string => {
  try {
    run()
  } catch (e) {
    return String((e as { details?: { reason?: string } }).details?.reason)
  }
  return 'accepté'
}

describe('a definition', () => {
  it('written before themes reads with the settings that drew it then', () => {
    const spec = parseSpec({
      page: { size: 'LETTER', orientation: 'landscape' },
      locale: 'de',
      footer: '  SIRET <123>   — {{numero}} ',
      blocks: [
        { kind: 'text', html: '<p>Bonjour</p>' },
        { kind: 'fields', fields: ['a'] },
        {
          kind: 'rows',
          title: 'Lignes',
          source: { kind: 'incoming', table: 't', field: 'f' },
          columns: ['x', 'y'],
          totals: ['y', 'z'],
        },
        { kind: 'break' },
      ],
    })
    expect(spec.page).toEqual({ size: 'LETTER', orientation: 'landscape', valign: 'top' })
    expect(spec.theme).toEqual(DEFAULT_THEME)
    expect(spec.header.show).toBe('none')
    expect(spec.footer).toEqual({
      html: '<p>SIRET &lt;123&gt; — {{numero}}</p>',
      align: 'left',
      page_numbers: true,
      rule: false,
    })
    expect(spec.blocks).toEqual([
      { kind: 'text', html: '<p>Bonjour</p>', align: 'left', size: 'normal', style: 'plain' },
      { kind: 'fields', fields: ['a'], columns: 1, labels: 'beside', hide_empty: false },
      {
        kind: 'rows',
        title: 'Lignes',
        source: { kind: 'incoming', table: 't', field: 'f' },
        columns: ['x', 'y'],
        totals: ['y'],
        style: 'light',
        zebra: false,
        headers: {},
        widths: {},
        align: {},
      },
      { kind: 'break' },
    ])
  })

  it('sanitizes its texts and normalises its colours', () => {
    const spec = parseSpec({
      theme: { accent: '#ABC', text: '#0F172A' },
      header: { show: 'every', left: '<p onclick="x()">Nous<script>alert(1)</script></p>' },
      blocks: [{ kind: 'text', html: '<p style="color:red">a</p><img src=x>' }],
    })
    expect(spec.theme.accent).toBe('#aabbcc')
    expect(spec.theme.text).toBe('#0f172a')
    expect(spec.header.left).toBe('<p>Nous</p>')
    expect(spec.blocks[0]).toMatchObject({ html: '<p>a</p>' })
  })

  it('is refused where it is wrong, naming the reason', () => {
    const blocks = [{ kind: 'text', html: '<p>a</p>' }]
    expect(reason(() => parseSpec({ blocks: [] }))).toBe('aucun_bloc')
    expect(reason(() => parseSpec({ theme: { accent: 'rouge' }, blocks }))).toBe('couleur_invalide')
    expect(reason(() => parseSpec({ theme: { margin: 2 }, blocks }))).toBe('valeur_hors_bornes')
    expect(reason(() => parseSpec({ theme: { font: 'comic' }, blocks }))).toBe('valeur_inconnue')
    expect(reason(() => parseSpec({ page: { size: 'A3' }, blocks }))).toBe('format_inconnu')
    expect(
      reason(() => parseSpec({ blocks: [{ kind: 'columns', columns: [[{ kind: 'rows' }], []] }] })),
    ).toBe('bloc_interdit_en_colonne')
    expect(
      reason(() => parseSpec({ blocks: [{ kind: 'columns', columns: [[], [], [], []] }] })),
    ).toBe('deux_ou_trois_colonnes')
    expect(reason(() => parseSpec({ blocks: [{ kind: 'image', source: null }] }))).toBe(
      'image_attendue',
    )
    const logo = { kind: 'upload', data: `data:image/png;base64,${PNG.toString('base64')}` }
    expect(
      reason(() =>
        parseSpec({ blocks: Array.from({ length: 9 }, () => ({ kind: 'image', source: logo })) }),
      ),
    ).toBe('trop_d_images')
    const spacers = Array.from({ length: 26 }, () => ({ kind: 'spacer', height: 4 }))
    expect(
      reason(() => parseSpec({ blocks: [{ kind: 'columns', columns: [spacers, spacers] }] })),
    ).toBe('trop_de_blocs')
  })

  it('as stored is never refused: what no longer reads is left out', () => {
    const spec = readSpec({
      theme: { accent: 'rouge', size: 99 },
      header: { show: 'partout', logo: { kind: 'upload', data: 'data:image/png;base64,AAAA' } },
      blocks: [
        { kind: 'gif-animé' },
        { kind: 'text', html: '<p>reste</p>', align: 'diagonale' },
        { kind: 'image', source: { kind: 'upload', data: 'pas une image' } },
      ],
    })
    expect(spec.theme.accent).toBe(DEFAULT_THEME.accent)
    expect(spec.theme.size).toBe(DEFAULT_THEME.size)
    expect(spec.header).toMatchObject({ show: 'none', logo: null })
    expect(spec.blocks).toEqual([
      { kind: 'text', html: '<p>reste</p>', align: 'left', size: 'normal', style: 'plain' },
    ])
    expect(readSpec('nimporte quoi').blocks).toHaveLength(1)
  })
})

describe('a picture', () => {
  it('is recognised by its bytes: PNG and JPEG, with their size', () => {
    expect(imageFacts(PNG)).toEqual({ type: 'image/png', width: 1, height: 1 })
    expect(imageFacts(JPEG)).toEqual({ type: 'image/jpeg', width: 3, height: 2 })
    expect(imageFacts(Buffer.from('GIF89a......'))).toBeNull()
    expect(imageFacts(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull()
  })

  it('sent as an address is checked, its type taken from its bytes', () => {
    const asJpeg = `data:image/jpeg;base64,${PNG.toString('base64')}`
    const decoded = decodeImage(asJpeg)
    expect(decoded).toMatchObject({ facts: { type: 'image/png' } })
    expect(decodeImage('data:image/png;base64,PHNjcmlwdD4=')).toBe('invalid')
    expect(decodeImage('https://exemple.fr/logo.png')).toBe('invalid')
    expect(decodeImage(42)).toBe('invalid')
    const heavy = Buffer.concat([PNG, Buffer.alloc(MAX_IMAGE_BYTES)]).toString('base64')
    expect(decodeImage(`data:image/png;base64,${heavy}`)).toBe('too_large')
  })
})

describe('colours', () => {
  it('mix towards white, and a band takes the text that reads best on it', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(onColor('#0f766e')).toBe('#ffffff')
    expect(onColor('#1d4ed8')).toBe('#ffffff')
    expect(onColor('#fde047')).toBe('#111827')
  })
})

const pagesOf = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length

const document = (
  blocks: readonly LaidBlock[],
  extra: Partial<LaidDocument> = {},
): LaidDocument => ({
  title: 'Essai',
  locale: 'fr',
  page: { size: 'A4', orientation: 'portrait' },
  footer: { html: '<p>Pied</p>', align: 'left', pageNumbers: true, rule: false },
  pageLabel: (p, n) => `${p} / ${n}`,
  blocks,
  ...extra,
})

describe('pages', () => {
  const fonts = findFonts('fr')

  it('are set from every kind of block', async () => {
    const pdf = await layoutPdf(
      document(
        [
          {
            kind: 'title',
            text: 'Titre',
            subtitle: 'Sous-titre',
            style: 'bleed',
            align: 'left',
            size: 'huge',
          },
          {
            kind: 'html',
            html: '<h1>Un</h1><p>Texte <strong>gras</strong> et <a href="https://exemple.fr">lien</a>.</p><ul><li>a<ul><li>b</li></ul></li></ul><blockquote><p>cité</p></blockquote><hr><pre>code</pre>',
            style: 'tint',
            align: 'justify',
          },
          {
            kind: 'fields',
            rows: [
              { label: 'A', value: '1' },
              { label: 'B', value: '' },
            ],
            columns: 2,
            labels: 'above',
          },
          {
            kind: 'fields',
            rows: [
              { label: 'HT', value: '10 €' },
              { label: 'TTC', value: '12 €' },
            ],
            labels: 'summary',
          },
          { kind: 'image', data: PNG, width: 20, align: 'center' },
          { kind: 'divider', color: 'accent', thickness: 2 },
          { kind: 'spacer', height: 10 },
          {
            kind: 'columns',
            widths: [2, 1],
            columns: [
              [{ kind: 'html', html: '<p>gauche</p>', style: 'border' }],
              [
                { kind: 'image', data: PNG, width: 100, align: 'right' },
                { kind: 'html', html: '<p>droite</p>', style: 'bar' },
              ],
            ],
          },
          {
            kind: 'table',
            title: 'Lignes',
            columns: [
              { label: 'Nom', numeric: false },
              { label: 'Qté', numeric: true, align: 'center', width: 10 },
            ],
            rows: [['a', '1']],
            totals: ['Total', '1'],
            more: null,
            style: 'accent',
            zebra: true,
          },
          { kind: 'break' },
          { kind: 'html', html: '<p>après le saut</p>' },
        ],
        {
          theme: { ...DEFAULT_THEME, accent: '#0f766e', border: 'double', titles: 'rule' },
          header: {
            show: 'every',
            logo: PNG,
            logoWidth: 30,
            left: '<p>Nous</p>',
            right: '<p>Eux</p>',
            rule: true,
          },
        },
      ),
      fonts,
    )
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    // The square pictures fill the first page; the break starts the last.
    expect(pagesOf(pdf)).toBe(3)
  })

  it('set a document that fits in the middle of its page, when asked', async () => {
    const blocks: LaidBlock[] = [{ kind: 'html', html: '<p>Attestation</p>' }]
    const top = await layoutPdf(document(blocks), fonts)
    const centered = await layoutPdf(
      document(blocks, { page: { size: 'A4', orientation: 'landscape', valign: 'center' } }),
      fonts,
    )
    expect(pagesOf(top)).toBe(1)
    expect(pagesOf(centered)).toBe(1)
  })

  it('carry a long table over, its head repeated', async () => {
    const rows = Array.from({ length: 120 }, (_, i) => [`Ligne ${i}`, String(i)])
    const pdf = await layoutPdf(
      document([
        {
          kind: 'table',
          title: '',
          columns: [
            { label: 'Nom', numeric: false },
            { label: 'N', numeric: true },
          ],
          rows,
          totals: null,
          more: null,
        },
      ]),
      fonts,
    )
    expect(pagesOf(pdf)).toBeGreaterThanOrEqual(3)
  })

  it('carry a text longer than a page out of its box, and a cell longer than half a page', async () => {
    const long = `<p>${'Une phrase assez longue pour remplir des lignes. '.repeat(400)}</p>`
    const pdf = await layoutPdf(
      document([
        { kind: 'html', html: long, style: 'tint' },
        { kind: 'fields', rows: [{ label: 'Note', value: 'mot '.repeat(3000) }] },
      ]),
      fonts,
    )
    expect(pagesOf(pdf)).toBeGreaterThanOrEqual(4)
  })

  it('are set without any font file, in the PDF’s own faces', async () => {
    const pdf = await layoutPdf(
      document([{ kind: 'html', html: '<p>Łódź — 東京 — 1 234,50 €</p>' }], {
        theme: { ...DEFAULT_THEME, font: 'serif' },
      }),
      null,
    )
    expect(pagesOf(pdf)).toBe(1)
  })

  it('leave out a picture they cannot read rather than failing', async () => {
    const pdf = await layoutPdf(
      document([{ kind: 'image', data: Buffer.from('pas une image'), width: 50, align: 'left' }]),
      fonts,
    )
    expect(pagesOf(pdf)).toBe(1)
  })
})
