import { LOOK_COLORS, LOOK_ICONS } from '@basedb/contracts'
import { describe, expect, it } from 'vitest'
import { OPTION_ICONS } from '../../src/lib/option-icons'
import { PRESET_COLORS } from '../../src/lib/options'

/**
 * The server publishes the pictograms an agent or a program may choose; the picker draws
 * them. The two lists are one: a name the server accepts must be one the screen draws.
 */
describe('the look the server publishes is the look the picker draws', () => {
  it('names the same pictograms, in the same order', () => {
    expect(OPTION_ICONS.map((i) => i.name)).toEqual([...LOOK_ICONS])
  })

  it('offers the same colours first', () => {
    expect([...PRESET_COLORS]).toEqual([...LOOK_COLORS])
  })
})
