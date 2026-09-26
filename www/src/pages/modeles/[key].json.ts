import type { APIRoute, GetStaticPaths } from 'astro';
import { catalog } from '../../lib/modeles';

/** One template, to download — and to import into an instance or edit. */
export const getStaticPaths: GetStaticPaths = async () =>
	(await catalog()).map(({ template }) => ({ params: { key: template.key }, props: { template } }));

export const GET: APIRoute = ({ props }) =>
	new Response(JSON.stringify(props.template, null, 2), {
		headers: { 'content-type': 'application/json; charset=utf-8' },
	});
