import { describe, expect, it } from 'vitest'
import { KEEPS_MOD_K, isPaletteKey } from '../../src/lib/store/palette'

/**
 * The command palette's shortcut.
 *
 * What these guard: Ctrl+K (⌘K) opens the palette whatever the keyboard layout, and
 * whatever holds the focus, save an element that keeps the shortcut for itself.
 */

const key = (init: Partial<KeyboardEvent>, keeps = false) =>
  ({
    key: 'k',
    code: 'KeyK',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target: {
      closest: (selector: string) => (keeps && selector === `[${KEEPS_MOD_K}]` ? {} : null),
    },
    ...init,
  }) as unknown as KeyboardEvent

describe('isPaletteKey', () => {
  it('hears Ctrl+K and ⌘K, capital or not', () => {
    expect(isPaletteKey(key({ ctrlKey: true }))).toBe(true)
    expect(isPaletteKey(key({ metaKey: true }))).toBe(true)
    expect(isPaletteKey(key({ ctrlKey: true, key: 'K' }))).toBe(true)
  })

  it('finds the K by its place when the layout types another letter', () => {
    // Ukrainian, Korean: the K key types л, ㅏ.
    expect(isPaletteKey(key({ ctrlKey: true, key: 'л' }))).toBe(true)
    expect(isPaletteKey(key({ ctrlKey: true, key: 'ㅏ' }))).toBe(true)
    // Dvorak: the key in the K place types a T, and T is not K.
    expect(isPaletteKey(key({ ctrlKey: true, key: 't' }))).toBe(false)
    // Dvorak again: the K is elsewhere, and it is still K.
    expect(isPaletteKey(key({ ctrlKey: true, key: 'k', code: 'KeyV' }))).toBe(true)
  })

  it('leaves the other chords alone', () => {
    expect(isPaletteKey(key({}))).toBe(false)
    expect(isPaletteKey(key({ ctrlKey: true, shiftKey: true }))).toBe(false)
    // AltGr is Ctrl+Alt on Windows.
    expect(isPaletteKey(key({ ctrlKey: true, altKey: true }))).toBe(false)
    expect(isPaletteKey(key({ ctrlKey: true, key: 'j', code: 'KeyJ' }))).toBe(false)
  })

  it('lets an element that keeps the shortcut have it', () => {
    expect(isPaletteKey(key({ ctrlKey: true }, true))).toBe(false)
    // Pressed with nothing focused, the key comes from the page itself.
    expect(isPaletteKey(key({ ctrlKey: true, target: null }))).toBe(true)
  })
})
