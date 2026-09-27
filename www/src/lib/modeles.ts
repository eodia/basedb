import { getCollection } from 'astro:content';
import { type TemplateDictionary, localizeTemplate } from '../../../packages/contracts/src/template-i18n';
import {
	type Template,
	type TemplateSummary,
	checkTemplate,
	summarizeTemplate,
} from '../../../packages/contracts/src/templates';
import { type Locale, getDict, getOverrides, localeInfo } from '../i18n';
import type { TemplateText } from '../i18n/types';

/**
 * The catalog the site publishes — chapter 20 §3.1. Every file is checked by the same
 * validator as the server's and the interface's: a template the instances would refuse
 * fails the site's build instead of reaching them.
 */
export async function catalog(): Promise<Array<{ template: Template; summary: TemplateSummary }>> {
	const entries = await getCollection('modeles');
	const out = entries.map((entry) => {
		const check = checkTemplate(entry.data);
		if (!check.ok) {
			const issues = check.issues.map((i) => `  ${i.path} : ${i.message}`).join('\n');
			throw new Error(`Modèle invalide : ${entry.id}\n${issues}`);
		}
		return { template: check.template, summary: summarizeTemplate(check.template) };
	});
	warnOnce(out.map((e) => e.template));
	// The demonstration first, then by category and label.
	return out.sort((a, b) =>
		a.template.key === 'demo'
			? -1
			: b.template.key === 'demo'
				? 1
				: (a.summary.category ?? '').localeCompare(b.summary.category ?? '') ||
					a.template.label.localeCompare(b.template.label),
	);
}

/**
 * The templates' texts in the other languages, by the application's code of the language and
 * the template's key: `packages/templates/i18n/<langue>/<clé>.json`, each the French text →
 * its translation. The same files the instances carry; the site also publishes them
 * (`/modeles/i18n/<langue>.json`), for an instance to take the newest.
 */
const DICTIONARIES = import.meta.glob<{ default: TemplateDictionary }>(
	'../../../packages/templates/i18n/*/*.json',
	{ eager: true },
);

/** A template's dictionary in a language (the application's code: `pt-BR`), if it has one. */
export function templateDictionary(lang: string, key: string): TemplateDictionary | undefined {
	return DICTIONARIES[`../../../packages/templates/i18n/${lang}/${key}.json`]?.default;
}

/** The languages that have the templates' texts, and each one's dictionaries by key. */
export function templateDictionaries(): Map<string, Record<string, TemplateDictionary>> {
	const out = new Map<string, Record<string, TemplateDictionary>>();
	for (const [file, module] of Object.entries(DICTIONARIES)) {
		const [, lang, key] = /\/i18n\/([^/]+)\/([^/]+)\.json$/.exec(file) ?? [];
		if (lang === undefined || key === undefined) continue;
		out.set(lang, { ...out.get(lang), [key]: module.default });
	}
	return out;
}

/**
 * A template in a language: its contents through the language's dictionary, as an instance
 * serves it; the French file when the language has none, or when the dictionary would break it.
 */
export function localizedTemplate(locale: Locale, template: Template): Template {
	const dictionary = templateDictionary(localeInfo(locale).lang, template.key);
	if (dictionary === undefined) return template;
	const check = localizeTemplate(template, dictionary);
	return check.ok ? check.template : template;
}

/**
 * What the gallery shows of a template in a language: the site's own words for it when the
 * language has them (`templates.<key>` of `src/i18n/ui/<code>.ts`), else the template's in
 * that language, else the file's French.
 */
export function templateText(locale: Locale, template: Template): TemplateText {
	const own = (getOverrides(locale)?.templates as Record<string, Partial<TemplateText> | undefined> | undefined)?.[
		template.key
	];
	const local = localizedTemplate(locale, template);
	const category = local.category ?? getDict(locale).gallery.otherCategory;
	return {
		label: own?.label ?? local.label,
		summary: own?.summary ?? local.summary,
		description: own?.description ?? local.description ?? '',
		category: own?.category ?? category,
		tags: own?.tags ?? [...local.tags],
	};
}

/** The catalog in a language's order: the demonstration first, then by category and name as it reads them. */
export function sortForLocale<T extends { template: Template }>(locale: Locale, entries: T[]): T[] {
	const collator = new Intl.Collator(localeInfo(locale).lang);
	const text = new Map(entries.map((e) => [e.template.key, templateText(locale, e.template)]));
	return [...entries].sort((a, b) => {
		if (a.template.key === 'demo') return -1;
		if (b.template.key === 'demo') return 1;
		const ta = text.get(a.template.key)!;
		const tb = text.get(b.template.key)!;
		return collator.compare(ta.category, tb.category) || collator.compare(ta.label, tb.label);
	});
}

let warned = false;

/** The French of `src/i18n/ui/fr.ts` mirrors the files, for translators: say when they part. */
function warnOnce(templates: readonly Template[]): void {
	if (warned) return;
	warned = true;
	const french = getDict('fr').templates as Record<string, TemplateText | undefined>;
	for (const t of templates) {
		const text = french[t.key];
		if (text === undefined) {
			console.warn(`[i18n] le modèle « ${t.key} » manque à src/i18n/ui/fr.ts (templates) : ses traductions ne le verront pas.`);
			continue;
		}
		const differs =
			text.label !== t.label ||
			text.summary !== t.summary ||
			text.description !== (t.description ?? '') ||
			text.category !== (t.category ?? '') ||
			text.tags.join('|') !== t.tags.join('|');
		if (differs) console.warn(`[i18n] le modèle « ${t.key} » a changé : mettez à jour templates.${t.key} dans src/i18n/ui/fr.ts.`);
	}
}
