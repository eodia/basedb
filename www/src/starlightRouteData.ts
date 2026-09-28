/**
 * What every page of the documentation adds to Starlight's own: the image a shared link
 * shows, in the page's language — `public/og/<code>.jpg`, made by `scripts/og-images.mjs`,
 * the same as the landing pages'. Starlight already says `summary_large_image`.
 */
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { localeFromPath } from './i18n/locales';

export const onRequest = defineRouteMiddleware((context) => {
	const base = import.meta.env.BASE_URL.replace(/\/$/, '');
	const image = new URL(`${base}/og/${localeFromPath(context.url.pathname)}.jpg`, context.site).href;
	context.locals.starlightRoute.head.push(
		{ tag: 'meta', attrs: { property: 'og:image', content: image } },
		{ tag: 'meta', attrs: { property: 'og:image:type', content: 'image/jpeg' } },
		{ tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
		{ tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
	);
});
