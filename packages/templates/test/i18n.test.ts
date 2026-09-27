import { readdirSync } from 'node:fs'
import {
  type Template,
  checkTemplate,
  citedInText,
  citedLabels,
  localizeTemplate,
  templateTexts,
} from '@basedb/contracts'
import { describe, expect, it } from 'vitest'
import { I18N_DIR, bundledDictionaries, bundledTemplates } from '../src/index.js'

/**
 * The official templates in another language — every text through a dictionary, every
 * label followed where it is cited.
 *
 * A pseudo-language marks each text with a `~`: once localized, a template must still be
 * valid, and no citation may still point at a French label — a formula, a filter, a view, a
 * dashboard, an automation or a prompt left behind would be refused by the validator, or
 * would build a base that does not hold.
 */

const templates = bundledTemplates().flatMap(({ raw }) => {
  const check = checkTemplate(raw)
  return check.ok ? [check.template] : []
})

/** Addresses keep their scheme, as a translator keeps it: only the rest is marked. */
const pseudo = (template: Template) =>
  Object.fromEntries(
    templateTexts(template).map(({ text, kind }) => [
      text,
      kind === 'url' || kind === 'email'
        ? text.replace(/^(https?:\/\/|mailto:)?/, '$1~')
        : `~${text}`,
    ]),
  )

describe('localizeTemplate', () => {
  for (const template of templates) {
    it(`${template.key}: every text translated, every citation followed`, () => {
      const check = localizeTemplate(template, pseudo(template))
      expect(check.issues).toEqual([])
      if (!check.ok) return
      const localized = check.template

      expect(localized.label).toBe(`~${template.label}`)
      for (const table of localized.tables) {
        for (const field of table.fields) {
          expect(field.label.startsWith('~')).toBe(true)
          for (const label of citedLabels(field.formula ?? '')) expect(label[0]).toBe('~')
          for (const label of citedInText(field.ai?.prompt ?? '')) expect(label[0]).toBe('~')
          for (const option of field.options ?? []) expect(option.label[0]).toBe('~')
        }
      }
      for (const list of Object.values(localized.rows)) {
        for (const row of list) {
          for (const label of Object.keys(row)) if (label !== '$key') expect(label[0]).toBe('~')
        }
      }
      const filters = [
        ...localized.views.map((v) => String(v.spec.filter ?? '')),
        ...localized.dashboards.flatMap((d) =>
          d.blocks.map((b) => ('filter' in b ? b.filter : '')),
        ),
        ...localized.automations.map((a) => a.condition),
      ]
      for (const filter of filters) {
        for (const label of citedLabels(filter)) expect(label[0]).toBe('~')
        // A choice compared by its label follows its label.
        for (const literal of filter.match(/"[^"]*"/g) ?? []) expect(literal[1]).toBe('~')
      }
    })
  }

  it('keeps the French text a dictionary does not hold', () => {
    const demo = templates.find((t) => t.key === 'demo') as Template
    const check = localizeTemplate(demo, { Clients: 'Customers' })
    expect(check.ok).toBe(true)
    if (!check.ok) return
    expect(check.template.tables.map((t) => t.label)).toContain('Customers')
    expect(check.template.label).toBe(demo.label)
  })

  it('refuses a dictionary that makes two labels one', () => {
    const demo = templates.find((t) => t.key === 'demo') as Template
    const [first, second] = demo.tables[0]?.fields ?? []
    const check = localizeTemplate(demo, {
      [first?.label ?? '']: 'Même',
      [second?.label ?? '']: 'Même',
    })
    expect(check.ok).toBe(false)
  })

  it('lists each text once, with what it is and where it first appears', () => {
    const demo = templates.find((t) => t.key === 'demo') as Template
    const texts = templateTexts(demo)
    expect(new Set(texts.map((t) => t.text)).size).toBe(texts.length)
    expect(texts.find((t) => t.text === 'Clients')).toMatchObject({ kind: 'label' })
    expect(texts.find((t) => t.text === 'Boulangerie Martin')).toMatchObject({ kind: 'value' })
    // Citations are the code's to rewrite, not texts of their own.
    expect(texts.some((t) => t.text.startsWith('[') || t.text === '$moi')).toBe(false)
  })
})

/**
 * The real dictionaries, as the instances carry them: every language holds every template,
 * and every template, once in that language, is still one the validator accepts.
 */
describe('the dictionaries', () => {
  for (const locale of readdirSync(I18N_DIR)) {
    it(`${locale}: every template in this language, still valid`, () => {
      const dictionaries = bundledDictionaries(locale)
      for (const template of templates) {
        const dictionary = dictionaries[template.key]
        expect([template.key, dictionary === undefined]).toEqual([template.key, false])
        const check = localizeTemplate(template, dictionary ?? {})
        expect([template.key, check.issues]).toEqual([template.key, []])
      }
    })
  }
})
