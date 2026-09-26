import type { APIRoute } from 'astro';
import { catalog } from '../../lib/modeles';

/**
 * The catalog every instance reads — chapter 20 §3.1: `BASEDB_TEMPLATES_URL` points here
 * by default. The whole templates, checked; one request, cached an hour by the instance.
 */
export const GET: APIRoute = async () => {
	const templates = (await catalog()).map((entry) => entry.template);
	return new Response(JSON.stringify({ format: 1, templates }), {
		headers: { 'content-type': 'application/json; charset=utf-8' },
	});
};
