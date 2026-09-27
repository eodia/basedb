/**
 * The shapes the dictionaries share. The French dictionary (`ui/fr.ts`) is built with
 * them; a translation only ever overrides texts.
 */

/**
 * A text that depends on a number, `{n}` standing for it. The forms are those of
 * `Intl.PluralRules` — French needs `one` and `other`, Polish or Ukrainian add `few` and
 * `many`; `other` is the one used when a form is missing.
 */
export interface Plural {
	zero?: string;
	one?: string;
	two?: string;
	few?: string;
	many?: string;
	other: string;
}

/**
 * A link. An address of the site is written as on the French site, from the root and
 * without `/basedb` — `/fonctionnalites/vues/` —: the page gives it the reader's language.
 */
export interface Link {
	href: string;
	label: string;
}

/** A feature block of the home page. `title`: the part between {braces} is written in the accent hand. */
export interface FeatureText {
	label: string;
	title: string;
	/** HTML. */
	lead: string;
	/** HTML, one per bullet. */
	bullets: string[];
	links: Link[];
	/** The alternative text of the block's screenshot, when it has one. */
	alt?: string;
}

/** A small card of the "everything else" grid. */
export interface SmallCard {
	title: string;
	text: string;
	/** A formula or a prompt, shown as code. */
	code?: string;
	href: string;
}

/** A question of the FAQ. */
export interface Question {
	q: string;
	a: string;
}

/** A tab of the screenshots' showcase. */
export interface Shot {
	label: string;
	caption: string;
}

/** A dated entry of the changelog. */
export interface ChangelogEntry {
	/** The day, `YYYY-MM-DD`: shown in the reader's language by `Intl.DateTimeFormat`. */
	date: string;
	title: string;
	tag?: string;
	/** HTML, one per item. */
	items: string[];
}

/** An item of the roadmap. */
export interface RoadmapItem {
	title: string;
	text: string;
}

/** What the gallery shows of a template of `packages/templates/catalog/` — its contents stay French. */
export interface TemplateText {
	label: string;
	summary: string;
	description: string;
	category: string;
	tags: string[];
}

/** A tile of the home page's features: a sentence, and what the tile shows large. */
export interface Tile {
	/** A figure, shown large: `8`, `15`, `Ctrl+Z`. */
	stat?: string;
	/** A formula, shown as code. */
	code?: string;
	/** A mention, shown as a speech bubble. */
	bubble?: string;
	title: string;
	text: string;
	href: string;
}
