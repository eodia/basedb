import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

export const collections = {
	docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
	// The official base templates: the files of `packages/templates/catalog/`, read as they
	// are — the site publishes them, and `src/lib/modeles.ts` checks them first.
	modeles: defineCollection({
		loader: glob({ pattern: '*.json', base: '../packages/templates/catalog' }),
		schema: z.record(z.string(), z.unknown()),
	}),
};
