import { getCollection } from 'astro:content';
import {
	type Template,
	type TemplateSummary,
	checkTemplate,
	summarizeTemplate,
} from '../../../packages/contracts/src/templates';

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

export const KIND_LABELS: Record<string, string> = {
	short_text: 'Texte court',
	long_text: 'Texte long',
	number: 'Nombre',
	boolean: 'Case à cocher',
	date: 'Date',
	datetime: 'Date et heure',
	select: 'Choix',
	multi_select: 'Choix multiples',
	url: 'Lien URL',
	email: 'E-mail',
	user: 'Personne',
	autonumber: 'Numéro automatique',
	formula: 'Formule',
	lookup: 'Recherche',
	rollup: 'Cumul',
	count: 'Décompte',
	button: 'Bouton',
	link: 'Relation',
	multi_link: 'Relation multiple',
};

export const VIEW_LABELS: Record<string, string> = {
	grid: 'Grille',
	kanban: 'Kanban',
	calendar: 'Calendrier',
	timeline: 'Chronologie',
	gallery: 'Galerie',
	list: 'Liste',
	form: 'Formulaire',
};

export function plural(n: number, one: string, many: string): string {
	return `${n} ${n > 1 ? many : one}`;
}
