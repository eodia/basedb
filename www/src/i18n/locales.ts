/**
 * The site's twenty languages — the same as the application's
 * (`packages/contracts/src/locales.ts`), matched to a browser by the same rules.
 *
 * French is the source and lives at the root URLs (`/basedb/…`); every other language has
 * its own directory (`/basedb/en/…`), under the same paths. This module is also read by
 * `astro.config.mjs`: it imports nothing from Astro.
 */

export const LOCALES = [
	{ code: 'fr', lang: 'fr', label: 'Français', og: 'fr_FR' },
	{ code: 'en', lang: 'en', label: 'English', og: 'en_US' },
	{ code: 'de', lang: 'de', label: 'Deutsch', og: 'de_DE' },
	{ code: 'es', lang: 'es', label: 'Español', og: 'es_ES' },
	{ code: 'it', lang: 'it', label: 'Italiano', og: 'it_IT' },
	{ code: 'pt-br', lang: 'pt-BR', label: 'Português (Brasil)', og: 'pt_BR' },
	{ code: 'nl', lang: 'nl', label: 'Nederlands', og: 'nl_NL' },
	{ code: 'pl', lang: 'pl', label: 'Polski', og: 'pl_PL' },
	{ code: 'cs', lang: 'cs', label: 'Čeština', og: 'cs_CZ' },
	{ code: 'sv', lang: 'sv', label: 'Svenska', og: 'sv_SE' },
	{ code: 'da', lang: 'da', label: 'Dansk', og: 'da_DK' },
	{ code: 'nb', lang: 'nb', label: 'Norsk bokmål', og: 'nb_NO' },
	{ code: 'fi', lang: 'fi', label: 'Suomi', og: 'fi_FI' },
	{ code: 'ro', lang: 'ro', label: 'Română', og: 'ro_RO' },
	{ code: 'hu', lang: 'hu', label: 'Magyar', og: 'hu_HU' },
	{ code: 'tr', lang: 'tr', label: 'Türkçe', og: 'tr_TR' },
	{ code: 'uk', lang: 'uk', label: 'Українська', og: 'uk_UA' },
	{ code: 'ja', lang: 'ja', label: '日本語', og: 'ja_JP' },
	{ code: 'zh-cn', lang: 'zh-CN', label: '简体中文', og: 'zh_CN' },
	{ code: 'ko', lang: 'ko', label: '한국어', og: 'ko_KR' },
] as const;

/** A language of the site, by its code: its URL directory, or `fr` for the root. */
export type Locale = (typeof LOCALES)[number]['code'];
export type LocaleInfo = (typeof LOCALES)[number];

/** The source language, served at the root. */
export const DEFAULT_LOCALE: Locale = 'fr';
/** The language of a browser that asks for none of ours. */
export const FALLBACK_LOCALE: Locale = 'en';

/** The nineteen languages served under their own directory. */
export const PREFIXED_LOCALES = LOCALES.filter((l) => l.code !== DEFAULT_LOCALE);

const CODES: readonly string[] = LOCALES.map((l) => l.code);

export function isLocale(value: unknown): value is Locale {
	return typeof value === 'string' && CODES.includes(value);
}

export function localeInfo(locale: Locale): LocaleInfo {
	return LOCALES.find((l) => l.code === locale) ?? LOCALES[0];
}

/** Starlight's name for a language: `root` for French, its directory otherwise. */
export function starlightKey(locale: Locale): string {
	return locale === DEFAULT_LOCALE ? 'root' : locale;
}

/** The locales as Starlight declares them. */
export function starlightLocales(): Record<string, { label: string; lang: string }> {
	return Object.fromEntries(LOCALES.map((l) => [starlightKey(l.code), { label: l.label, lang: l.lang }]));
}

/** The site's base path, without its trailing slash: `/basedb`. */
const BASE = ((import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/basedb/').replace(/\/$/, '');

/** The language of a URL path (with or without the base): its first directory, French otherwise. */
export function localeFromPath(pathname: string): Locale {
	const rest = pathname.startsWith(`${BASE}/`) || pathname === BASE ? pathname.slice(BASE.length) : pathname;
	const first = (rest.split('/')[1] ?? '').toLowerCase();
	return isLocale(first) && first !== DEFAULT_LOCALE ? first : DEFAULT_LOCALE;
}

/**
 * A path as the French site writes it — `/fonctionnalites/vues/`, without the base or a
 * language —, whatever language and base the given path carries.
 */
export function stripLocale(pathname: string): string {
	let rest = pathname.startsWith(`${BASE}/`) || pathname === BASE ? pathname.slice(BASE.length) : pathname;
	const locale = localeFromPath(rest);
	if (locale !== DEFAULT_LOCALE) rest = rest.slice(locale.length + 1);
	return rest.startsWith('/') ? rest : `/${rest}`;
}

/**
 * The address of a page of the site in a language. `path` is written as on the French
 * site, from the root and without the base: `localizedPath('en', '/fonctionnalites/vues/')`
 * gives `/basedb/en/fonctionnalites/vues/`, and French keeps `/basedb/fonctionnalites/vues/`.
 * External addresses and anchors pass through; files (`/modeles/catalogue.json`) exist
 * once, at the root, and are never prefixed.
 */
export function localizedPath(locale: Locale, path: string): string {
	if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('#') || path.startsWith('//')) return path;
	const site = stripLocale(path);
	const [pathname = '/'] = site.split(/[?#]/);
	const isFile = /\.[a-z0-9]+$/i.test(pathname);
	const dir = locale === DEFAULT_LOCALE || isFile ? '' : `/${locale}`;
	return `${BASE}${dir}${site}`;
}

/**
 * The language a tag asks for, if the site speaks it: the exact tag first, then its
 * language alone — `pt-PT` reads Brazilian Portuguese, any Chinese reads simplified
 * Chinese, and Norwegian in any of its forms reads bokmål.
 */
export function localeOfTag(tag: string): Locale | null {
	const clean = tag.trim().toLowerCase().replace(/_/g, '-');
	if (clean === '') return null;
	if (isLocale(clean)) return clean;
	const language = clean.split('-')[0] ?? '';
	if (language === 'pt') return 'pt-br';
	if (language === 'zh') return 'zh-cn';
	if (language === 'no' || language === 'nn' || language === 'nb') return 'nb';
	return isLocale(language) ? language : null;
}

/** The first language of a browser's list the site speaks, and English otherwise. */
export function matchLocale(tags: readonly string[]): Locale {
	for (const tag of tags) {
		const found = localeOfTag(tag);
		if (found !== null) return found;
	}
	return FALLBACK_LOCALE;
}
