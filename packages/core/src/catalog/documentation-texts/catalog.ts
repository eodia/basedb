/**
 * The languages of the API and MCP documentation — chapter 11 §10.
 *
 * The same convention as the interface's catalogs: the French sentence of
 * `documentation.ts` is the key, its translation the value, and `{name}` marks a value
 * the generator fills in — a name, a path, a count — which a translation keeps as is.
 *
 * Its own file: each language imports it, and `index.ts` imports each language.
 */
export type Catalog = Readonly<Record<string, string>>
