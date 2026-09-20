import { describe, expect, it } from 'vitest'
import {
  MAX_IMAGE_CHARS,
  MAX_OPTIONS,
  type SelectOptionInput,
  normalizeOptions,
} from '../../src/catalog/select-options.js'
import type { BasedbError } from '../../src/errors/index.js'

/**
 * The look of an option — chapter 04 §3.
 *
 * `normalizeOptions` is shared by the creation of a `select` and by the replacement of its
 * list, so a list that one accepts is a list the other accepts. What is checked here is
 * the contract between the screen (a colour picker, an icon name, a downscaled picture)
 * and the catalog's own CHECK constraints: a value the screen can send must be one the
 * database will store, and one it cannot must be refused with a reason, not a 500.
 */

function refusal(options: readonly SelectOptionInput[]): BasedbError {
  try {
    normalizeOptions(options)
  } catch (e) {
    return e as BasedbError
  }
  throw new Error('aucun refus')
}

const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

describe('the shape of an option', () => {
  it('defaults the label to the value and every look to null', () => {
    expect(normalizeOptions([{ value: 'actif' }])).toEqual([
      { value: 'actif', label: 'actif', color: null, icon: null, image: null },
    ])
  })

  it('trims the value and the label, and keeps their order', () => {
    const [first, second] = normalizeOptions([
      { value: '  b ', label: ' Bravo ' },
      { value: 'a', label: '   ' },
    ])
    expect([first.value, first.label]).toEqual(['b', 'Bravo'])
    expect([second.value, second.label]).toEqual(['a', 'a'])
  })

  it('treats an empty string as "no look" — what an emptied input sends', () => {
    const [option] = normalizeOptions([{ value: 'x', color: '', icon: ' ', image: '' }])
    expect([option.color, option.icon, option.image]).toEqual([null, null, null])
  })
})

describe('the colour', () => {
  it('accepts any hex colour and stores #rrggbb in lowercase', () => {
    const colors = normalizeOptions([
      { value: 'a', color: '#FF8800' },
      { value: 'b', color: '#abc' },
      { value: 'c', color: '  #0A0B0C ' },
    ]).map((o) => o.color)
    expect(colors).toEqual(['#ff8800', '#aabbcc', '#0a0b0c'])
  })

  it.each(['red', '#12345', '#1234567', 'ff8800', '#gg0000', 'rgb(1,2,3)'])(
    'refuses %s',
    (color) => {
      const error = refusal([{ value: 'a', color }])
      expect(error.code).toBe('REQUEST_INVALID')
      expect(error.details).toMatchObject({ reason: 'couleur_invalide', option: 'a' })
    },
  )
})

describe('the pictogram and the picture', () => {
  it('accepts a kebab-case icon name', () => {
    expect(normalizeOptions([{ value: 'a', icon: 'circle-check-big' }])[0].icon).toBe(
      'circle-check-big',
    )
  })

  it.each(['CircleCheck', 'circle_check', '-x', 'x-', 'a b', 'x'.repeat(65)])(
    'refuses the icon %s',
    (icon) => {
      // The 65-character name matches the pattern: only the length refuses it, and the
      // CHECK constraint would not — so the kernel has to.
      const error = refusal([{ value: 'a', icon }])
      expect(error.details).toMatchObject({ reason: 'icone_invalide' })
    },
  )

  it('accepts a small data URL and an https URL', () => {
    const [a, b] = normalizeOptions([
      { value: 'a', image: PIXEL },
      { value: 'b', image: 'https://example.com/pastille.png' },
    ])
    expect(a.image).toBe(PIXEL)
    expect(b.image).toBe('https://example.com/pastille.png')
  })

  it.each([
    'http://example.com/a.png',
    'javascript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    'ftp://example.com/a.png',
    'pastille.png',
  ])('refuses the image %s', (image) => {
    expect(refusal([{ value: 'a', image }]).details).toMatchObject({ reason: 'image_invalide' })
  })

  it('refuses a picture above the ceiling that keeps the catalog light', () => {
    const image = `data:image/png;base64,${'A'.repeat(MAX_IMAGE_CHARS)}`
    expect(refusal([{ value: 'a', image }]).details).toMatchObject({
      reason: 'image_trop_grande',
    })
  })

  it('refuses both at once: an option shows a pictogram OR a picture', () => {
    expect(refusal([{ value: 'a', icon: 'star', image: PIXEL }]).details).toMatchObject({
      reason: 'icone_et_image',
    })
  })
})

describe('the list', () => {
  it('refuses an empty list, a duplicate, an empty value, a NUL and an oversized value', () => {
    expect(refusal([]).details).toMatchObject({ reason: 'liste_vide' })
    expect(refusal([{ value: 'a' }, { value: ' a ' }]).code).toBe('DUPLICATE_VALUE')
    expect(refusal([{ value: '   ' }]).details).toMatchObject({ reason: 'vide' })
    expect(refusal([{ value: 'a\0b' }]).details).toMatchObject({ reason: 'caractere_nul' })
    expect(refusal([{ value: 'x'.repeat(201) }]).details).toMatchObject({ reason: 'trop_long' })
  })

  it('refuses more than 200 options', () => {
    const many = Array.from({ length: MAX_OPTIONS + 1 }, (_, i) => ({ value: `v${i}` }))
    expect(refusal(many).details).toMatchObject({ reason: 'trop_d_options', maximum: MAX_OPTIONS })
    expect(normalizeOptions(many.slice(0, MAX_OPTIONS))).toHaveLength(MAX_OPTIONS)
  })

  it('refuses a label over 255 characters', () => {
    expect(refusal([{ value: 'a', label: 'é'.repeat(256) }]).code).toBe('LABEL_TOO_LONG')
  })

  it('refuses an entry that is not an object with a value', () => {
    expect(refusal([{} as SelectOptionInput]).details).toMatchObject({ reason: 'valeur_absente' })
    expect(refusal([null as unknown as SelectOptionInput]).details).toMatchObject({
      reason: 'valeur_absente',
    })
  })
})
