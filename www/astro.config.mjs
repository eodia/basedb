// @ts-check
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://eodia.github.io',
	base: '/basedb',
	integrations: [
		starlight({
			title: 'basedb',
			logo: {
				light: './src/assets/logo.svg',
				dark: './src/assets/logo-light.svg',
				alt: '',
			},
			favicon: '/favicon.svg',
			head: [
				{ tag: 'link', attrs: { rel: 'apple-touch-icon', sizes: '180x180', href: '/basedb/apple-touch-icon.png' } },
				{ tag: 'meta', attrs: { name: 'theme-color', content: '#143d2b' } },
				{ tag: 'meta', attrs: { name: 'author', content: 'Eodia' } },
				{ tag: 'link', attrs: { rel: 'author', href: 'https://eodia.com/fr/' } },
			],
			description:
				'La base de données collaborative dont chaque table est une vraie table PostgreSQL.',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/eodia/basedb' }],
			editLink: { baseUrl: 'https://github.com/eodia/basedb/edit/main/www/' },
			components: { Footer: './src/components/DocsFooter.astro' },
			customCss: ['./src/styles/starlight-custom.css'],
			defaultLocale: 'root',
			locales: {
				root: { label: 'Français', lang: 'fr' },
			},
			sidebar: [
				{
					label: 'Pour commencer',
					items: [
						{ label: 'Introduction', slug: 'guides/introduction' },
						{ label: 'Installation', slug: 'guides/installation' },
						{ label: 'Premiers pas', slug: 'guides/premiers-pas' },
					],
				},
				{
					label: 'Fonctionnalités',
					items: [
						{ label: 'Tables et champs', slug: 'fonctionnalites/tables-et-champs' },
						{ label: 'Vues', slug: 'fonctionnalites/vues' },
						{ label: 'Formulaires partagés', slug: 'fonctionnalites/formulaires-partages' },
						{ label: 'Vues partagées', slug: 'fonctionnalites/vues-partagees' },
						{ label: 'Collaboration', slug: 'fonctionnalites/collaboration' },
						{ label: 'Automatisations', slug: 'fonctionnalites/automatisations' },
						{ label: 'Interfaces', slug: 'fonctionnalites/interfaces' },
						{ label: 'Environnements', slug: 'fonctionnalites/environnements' },
						{ label: 'Historique', slug: 'fonctionnalites/historique' },
						{ label: 'Droits et groupes', slug: 'fonctionnalites/droits' },
						{ label: 'Intelligence artificielle', slug: 'fonctionnalites/ia' },
						{ label: 'Modèles de base', slug: 'fonctionnalites/modeles' },
						{ label: 'Fichiers', slug: 'fonctionnalites/fichiers' },
					],
				},
				{
					label: 'Intégrations',
					items: [
						{ label: 'API REST', slug: 'integrations/api-rest' },
						{ label: 'Serveur MCP', slug: 'integrations/mcp' },
						{ label: 'Webhooks', slug: 'integrations/webhooks' },
						{ label: 'Slack, agendas, synchronisation', slug: 'integrations/synchronisation' },
						{ label: 'SQL direct', slug: 'integrations/sql' },
					],
				},
				{
					label: 'Hébergement',
					items: [
						{ label: 'Docker Compose', slug: 'hebergement/docker' },
						{ label: 'Variables d’environnement', slug: 'hebergement/variables' },
						{ label: 'Domaine et HTTPS', slug: 'hebergement/https' },
						{ label: 'Sauvegardes et mises à jour', slug: 'hebergement/sauvegardes' },
					],
				},
				{
					label: 'Architecture',
					items: [{ label: 'Principes', slug: 'architecture/principes' }],
				},
			],
		}),
	],
});
