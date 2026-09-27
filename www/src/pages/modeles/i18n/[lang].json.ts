import type { APIRoute, GetStaticPaths } from 'astro';
import { templateDictionaries } from '../../../lib/modeles';

/**
 * The templates' texts in one language — `/modeles/i18n/<langue>.json`, the application's
 * code of the language (`pt-BR`). An instance reads it beside the catalog, to serve the
 * official templates in the reader's language with the newest texts; the dictionaries it
 * carries stand in when the site cannot be read.
 */
export const getStaticPaths: GetStaticPaths = () =>
	[...templateDictionaries().entries()].map(([lang, templates]) => ({
		params: { lang },
		props: { templates },
	}));

export const GET: APIRoute = ({ params, props }) =>
	new Response(JSON.stringify({ format: 1, locale: params.lang, templates: props.templates }), {
		headers: { 'content-type': 'application/json; charset=utf-8' },
	});
