import type { ImageMetadata } from 'astro';
import type { Locale } from '../i18n';

/**
 * The screenshots of the interface, taken in each language on the same demo base
 * (`src/assets/screens/<locale>/<name>.webp`, see the README): a page shows the application
 * in its own language — French when a picture is missing.
 */
const SCREENS = import.meta.glob<{ default: ImageMetadata }>('../assets/screens/*/*.webp', {
	eager: true,
});

export function screen(locale: Locale, name: string): ImageMetadata {
	const found = SCREENS[`../assets/screens/${locale}/${name}.webp`] ?? SCREENS[`../assets/screens/fr/${name}.webp`];
	if (found === undefined) throw new Error(`No screenshot « ${name} »`);
	return found.default;
}
