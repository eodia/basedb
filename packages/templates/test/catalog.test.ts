import { checkTemplate } from '@basedb/contracts'
import { describe, expect, it } from 'vitest'
import { bundledTemplates } from '../src/index.js'

/**
 * The official catalog — chapter 20 §3.1.
 *
 * What this guards: every file the site publishes and the application carries is a
 * template the strict validator accepts, under the key its file is named after — a broken
 * template is caught here, not in someone's gallery.
 */

describe('the catalog', () => {
  const files = bundledTemplates()

  it('holds the demonstration and a few more', () => {
    expect(files.map((f) => f.file)).toContain('demo.json')
    expect(files.length).toBeGreaterThanOrEqual(2)
  })

  for (const { file, raw } of files) {
    it(`${file} is a valid template, keyed by its file name`, () => {
      const check = checkTemplate(raw)
      expect(check.issues).toEqual([])
      expect(check.ok && check.template.key).toBe(file.replace(/\.json$/, ''))
    })
  }
})
