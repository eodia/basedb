/**
 * The English texts of the landing pages, laid over the French ones (`fr.ts`).
 *
 * See `../README.md`.
 */
import type { DeepPartial, Dict } from './index';

export default {
	meta: {
		home: {
			title: 'basedb — the collaborative database where every table is a real PostgreSQL table',
			description: 'Grids and eight views, formulas, shared forms and views, comments, automations, dashboards, field-level permissions, full history, REST API and MCP server — on real PostgreSQL tables with readable names. Self-hosted, AGPL-3.0.',
		},
		changelog: {
			title: 'What’s new — basedb',
			description: 'What changed in basedb, release after release.',
		},
		roadmap: {
			title: 'Roadmap — basedb',
			description: 'What basedb will do next.',
		},
		gallery: {
			title: 'Templates — basedb',
			description: 'Ready-to-use bases: ticket tracking, review analysis, CRM, recruiting… with their sample rows, views, dashboards and AI-computed fields.',
		},
		template: {
			title: '{label} — basedb templates',
		},
	},
	eodia: {
		home: 'https://eodia.com/',
		about: 'https://eodia.com/about/',
		contact: 'https://eodia.com/contact/',
	},
	demo: {
		short: 'Demo',
		cta: 'Try the demo',
	},
	nav: {
		aria: 'Main navigation',
		home: 'basedb — home',
		links: [
			{
				href: '/#fonctionnalites',
				label: 'Features',
			},
			{
				href: '/modeles/',
				label: 'Templates',
			},
			{
				href: '/guides/introduction/',
				label: 'Documentation',
			},
			{
				href: '/nouveautes/',
				label: 'What’s new',
			},
		],
		developers: 'Developers',
		github: 'basedb’s GitHub repository',
		install: 'Install',
		menu: {
			open: 'Open menu',
			close: 'Close menu',
			features: {
				label: 'Features',
				groups: {
					organize: {
						title: 'Organize',
						items: {
							tables: {
								href: '/fonctionnalites/tables-et-champs/',
								title: 'Tables and fields',
								text: 'Fields for everything, relations, and formulas in French.',
							},
							views: {
								href: '/fonctionnalites/vues/',
								title: 'Eight views',
								text: 'Grid, kanban, calendar, timeline, gallery, list, form, survey.',
							},
							forms: {
								href: '/fonctionnalites/formulaires-partages/',
								title: 'Forms',
								text: 'A link to share: every response becomes a row.',
							},
							files: {
								href: '/fonctionnalites/fichiers/',
								title: 'Files and images',
								text: 'Quotes, photos, contracts, filed with their row.',
							},
						},
					},
					collaborate: {
						title: 'Collaborate',
						items: {
							live: {
								href: '/fonctionnalites/collaboration/',
								title: 'Real time and comments',
								text: 'See others work, comment on a row, mention a colleague.',
							},
							rights: {
								href: '/fonctionnalites/droits/',
								title: 'Permissions and groups',
								text: 'Who sees what and who edits what, down to the column.',
							},
							history: {
								href: '/fonctionnalites/historique/',
								title: 'History',
								text: 'Every change kept, and undoable.',
							},
							shared: {
								href: '/fonctionnalites/vues-partagees/',
								title: 'Shared views',
								text: 'A view through a link, on your site or in your calendar.',
							},
						},
					},
					automate: {
						title: 'Automate and analyze',
						items: {
							automations: {
								href: '/fonctionnalites/automatisations/',
								title: 'Automations',
								text: 'When a row changes: notify, create, write, ask AI.',
							},
							dashboards: {
								href: '/fonctionnalites/tableaux-de-bord/',
								title: 'Dashboards',
								text: 'Fifteen visualizations, shared filters, a link to share.',
							},
							ai: {
								href: '/fonctionnalites/ia/',
								title: 'AI and Copilot',
								text: 'A base in one sentence, fields that fill themselves in.',
							},
							templates: {
								href: '/modeles/',
								title: 'Templates',
								text: 'Ten ready-to-use bases, yours to adapt.',
							},
						},
					},
				},
				feature: {
					tag: 'New',
					title: 'Automations as flows',
					text: 'Find, decide, ask AI: a graph editor, and every run can be reviewed step by step.',
					href: '/nouveautes/',
					cta: 'See what’s new',
				},
				all: 'All the features',
			},
			solutions: {
				label: 'Solutions',
				title: 'For every team',
				items: {
					crm: {
						team: 'Sales',
						text: 'Pipeline, contacts, follow-ups.',
					},
					recrutement: {
						team: 'Human resources',
						text: 'Applications, interviews, AI summaries.',
					},
					'calendrier-editorial': {
						team: 'Marketing',
						text: 'Articles, posts and newsletters, scheduled.',
					},
					inventaire: {
						team: 'Operations',
						text: 'Stock computed for you, shortages seen ahead of time.',
					},
					'gestion-projet': {
						team: 'Organization',
						text: 'Milestones, tasks and dependencies.',
					},
					'suivi-tickets': {
						team: 'Product and engineering',
						text: 'Bugs and requests triaged by AI.',
					},
					'base-connaissances': {
						team: 'Support',
						text: 'Help articles, questions, suggested answers.',
					},
					evenements: {
						team: 'Events',
						text: 'Registrations, seats, feedback.',
					},
					'analyse-avis': {
						team: 'Customer relations',
						text: 'Reviews read and classified by AI.',
					},
				},
				ask: {
					title: 'Something else in mind?',
					text: 'Describe what you need in one sentence: the AI suggests a base built for you.',
					href: '/modeles/',
				},
				all: 'All the templates',
			},
			developers: {
				label: 'Developers',
				groups: {
					build: {
						title: 'Integrate',
						items: {
							api: {
								href: '/integrations/api-rest/',
								title: 'REST API',
								text: 'The same data as the interface, described in OpenAPI 3.1.',
							},
							mcp: {
								href: '/integrations/mcp/',
								title: 'MCP server',
								text: 'Tools for your AI agents, under your permissions.',
							},
							webhooks: {
								href: '/integrations/webhooks/',
								title: 'Webhooks',
								text: 'Every write, signed, ordered, retried.',
							},
							sql: {
								href: '/integrations/sql/',
								title: 'Direct SQL',
								text: 'Real PostgreSQL tables, plainly named.',
							},
							sync: {
								href: '/integrations/synchronisation/',
								title: 'Synced tables',
								text: 'Tables kept up to date from elsewhere.',
							},
						},
					},
					host: {
						title: 'Host',
						items: {
							docker: {
								href: '/hebergement/docker/',
								title: 'Docker Compose',
								text: 'One image, one PostgreSQL database, a single port.',
							},
							env: {
								href: '/hebergement/variables/',
								title: 'Variables',
								text: 'Everything is set in the .env file.',
							},
							https: {
								href: '/hebergement/https/',
								title: 'Domain and HTTPS',
								text: 'Behind your proxy, or with the bundled Caddy.',
							},
							sso: {
								href: '/hebergement/connexion/',
								title: 'Sign-in and SSO',
								text: 'Google, Microsoft, any OpenID Connect provider.',
							},
							backup: {
								href: '/hebergement/sauvegardes/',
								title: 'Backups and updates',
								text: 'pg_dump, and updates without loss.',
							},
						},
					},
				},
				feature: {
					title: 'The developers page',
					text: 'A real PostgreSQL table behind every grid.',
					href: '/developpeurs/',
				},
			},
			resources: {
				label: 'Resources',
				groups: {
					learn: {
						title: 'Learn',
						items: {
							docs: {
								href: '/guides/introduction/',
								title: 'Documentation',
								text: 'All of basedb, step by step.',
							},
							start: {
								href: '/guides/premiers-pas/',
								title: 'Getting started',
								text: 'A first base, from import to view.',
							},
							install: {
								href: '/guides/installation/',
								title: 'Installation',
								text: 'Two files and one command.',
							},
							principles: {
								href: '/architecture/principes/',
								title: 'The principles',
								text: 'How basedb is built, and why.',
							},
						},
					},
					follow: {
						title: 'Follow the project',
						items: {
							news: {
								href: '/nouveautes/',
								title: 'What’s new',
								text: 'What changed, release after release.',
							},
							roadmap: {
								href: '/feuille-de-route/',
								title: 'Roadmap',
								text: 'What comes next.',
							},
							github: {
								href: 'https://github.com/eodia/basedb',
								title: 'GitHub',
								text: 'The code, the issues, the releases.',
							},
							eodia: {
								href: 'https://eodia.com/',
								title: 'Eodia',
								text: 'The studio behind basedb.',
							},
						},
					},
				},
			},
		},
	},
	language: {
		label: 'Language',
		current: 'Language: {name}',
	},
	footer: {
		tagline: 'The collaborative database where every table is a real PostgreSQL table.',
		madeBy: 'Open-source software by <a class="eodia" href="https://eodia.com/">Eodia</a>, an AI-native software studio.',
		columns: {
			product: {
				title: 'Product',
				links: [
					{
						href: '/#fonctionnalites',
						label: 'Features',
					},
					{
						href: '/nouveautes/',
						label: 'What’s new',
					},
					{
						href: '/feuille-de-route/',
						label: 'Roadmap',
					},
					{
						href: '/#faq',
						label: 'FAQ',
					},
				],
			},
			docs: {
				title: 'Documentation',
				links: [
					{
						href: '/guides/introduction/',
						label: 'Introduction',
					},
					{
						href: '/guides/installation/',
						label: 'Installation',
					},
					{
						href: '/integrations/api-rest/',
						label: 'REST API',
					},
					{
						href: '/integrations/mcp/',
						label: 'MCP server',
					},
				],
			},
			hosting: {
				title: 'Hosting',
				links: [
					{
						href: '/hebergement/docker/',
						label: 'Docker Compose',
					},
					{
						href: '/hebergement/variables/',
						label: 'Environment variables',
					},
					{
						href: '/hebergement/https/',
						label: 'Domain and HTTPS',
					},
					{
						href: '/hebergement/sauvegardes/',
						label: 'Backups',
					},
				],
			},
			project: {
				title: 'Project',
				links: [
					{
						href: 'https://github.com/eodia/basedb',
						label: 'GitHub',
					},
					{
						href: 'https://github.com/eodia/basedb/tree/main/docs/architecture',
						label: 'Architecture document',
					},
					{
						href: 'https://github.com/eodia/basedb/blob/main/LICENSE',
						label: 'AGPL-3.0 license',
					},
					{
						href: 'https://github.com/eodia/basedb/issues',
						label: 'Report an issue',
					},
				],
			},
			eodia: {
				title: 'Eodia',
				links: [
					{
						href: 'https://eodia.com/',
						label: 'The studio',
					},
					{
						href: 'https://eodia.com/about/',
						label: 'About',
					},
					{
						href: 'https://eodia.com/contact/',
						label: 'Contact us',
					},
				],
			},
		},
		copyright: '© {year} <a href="https://eodia.com/">Eodia</a> · AGPL-3.0-or-later',
		builtWith: 'Site built with Astro and Starlight.',
	},
	docsFooter: {
		madeBy: 'basedb is open-source software by <a href="https://eodia.com/">Eodia</a>, an AI-native software studio.',
	},
	teams: {
		meta: {
			title: 'basedb — all your work, in one place',
			description: 'Clients, projects, stock, applications: a base your whole team edits together, as a table, a kanban or a calendar, with dashboards, automations and AI. No code, free and open-source.',
		},
		hero: {
			eyebrow: 'basedb',
			title: 'All your work.',
			titleAccent: 'Finally in one place.',
			lead: 'Tables, calendars, forms, dashboards and automations, for the whole team. As simple as a spreadsheet. Without a single line of code.',
			primary: 'Browse the templates',
			secondary: 'Watch the demo',
			facts: ['No code', 'Free and open-source', 'Your data stays with you'],
		},
		story: {
			grid: {
				title: 'The whole team, in the same table.',
				text: 'Everyone works in it at the same time, and everyone sees the same thing, up to date.',
			},
			copilot: {
				title: 'Ask. The Copilot takes care of it.',
				text: '“Who should I follow up with this week?” — it suggests the right filter, and you apply it with one click.',
			},
			kanban: {
				title: 'Drag it. It’s updated.',
				text: 'Each stage becomes a column; moving a card updates the row.',
			},
			calendar: {
				title: 'Every date in its place.',
				text: 'Appointments show up on their own, and follow you all the way into your calendar app.',
			},
			dashboard: {
				title: 'And everything, at a glance.',
				text: 'The numbers calculate themselves, from the same rows.',
			},
		},
		stage: {
			aria: 'A team’s client follow-up in basedb: table, Copilot, kanban, calendar, dashboard',
			tabs: {
				grid: 'Table',
				copilot: 'Copilot',
				kanban: 'Kanban',
				calendar: 'Calendar',
				dashboard: 'Dashboard',
			},
			project: 'Main project',
			projectMeta: 'Project · 2 bases',
			filterNav: 'Filter navigation',
			base: 'Sales',
			otherBase: 'Support',
			tables: ['Clients', 'Contacts', 'Quotes'],
			baseSection: 'Base · Sales',
			screens: ['Dashboards', 'Automations'],
			user: 'Léa Martin',
			views: { grid: 'All rows', kanban: 'By stage', calendar: 'Appointments' },
			toolbar: {
				filter: 'Filter',
				columns: 'Columns',
				group: 'Group',
				colors: 'Colors',
				sort: 'Sort',
				configure: 'Configure',
			},
			search: 'Search…',
			add: 'Add',
			columns: {
				name: 'Client',
				status: 'Stage',
				owner: 'Owner',
				amount: 'Amount',
				next: 'Next appointment',
			},
			statuses: {
				contact: 'To contact',
				meeting: 'Meeting',
				quote: 'Quote sent',
				signed: 'Signed',
			},
			clients: [
				'Martin’s Bakery',
				'Lindenwood Clinic',
				'Lincoln High School',
				'Community Cycles',
				'The Fine Grocer',
				'Riverside Forge',
				'Moreau Workshop',
			],
			addRow: 'Add a row',
			perPage: 'Rows per page',
			card: 'Followed up by {owner}, appointment on {date}',
			addCard: 'Add a card',
			today: 'Today',
			month: 'Month',
			week: 'Week',
			dashboards: 'Dashboards',
			questions: 'Questions',
			dashboard: 'Sales tracking',
			dashboardText: 'The essentials, at a glance.',
			dashboardTabs: ['Overview', 'Activity'],
			period: 'Period',
			thisYear: 'This year',
			share: 'Share',
			edit: 'Edit',
			explore: 'Explore data',
			chart: 'Amount by client',
			byStage: 'Clients by stage',
			kpis: {
				signed: 'Signed',
				pending: 'Quotes pending',
				rate: 'Clients signed',
			},
			copilot: {
				question: 'Who should I follow up with this week?',
				thinking: 'Thinking…',
				answer: 'Four clients are waiting for a reply: two quotes sent and two meetings to prepare.',
				card: 'Filter Clients',
				filter: 'Stage: Quote sent or Meeting',
				apply: 'Apply filter',
				applied: 'Filter applied',
				placeholder: 'Ask the Copilot…',
				filtered: '{n} rows filtered',
			},
		},
		video: {
			eyebrow: 'The demo',
			title: 'All of basedb,',
			titleAccent: 'in four minutes.',
			text: 'Creating a base, filling it, sharing it, automating it, and steering it: the full guided tour.',
			play: 'Play the video',
			duration: '4:35',
			chapters: 'Chapters',
			captions: 'French',
			inFrench: 'The video is in French, with French subtitles.',
			list: [
				{ time: '0:08', title: 'Create a base' },
				{ time: '0:35', title: 'Tables, fields and formulas' },
				{ time: '1:10', title: 'Row details and collaboration' },
				{ time: '1:33', title: 'Eight views on the same rows' },
				{ time: '2:01', title: 'Forms and AI' },
				{ time: '2:37', title: 'Automations' },
				{ time: '2:59', title: 'Dashboards' },
				{ time: '3:15', title: 'SQL for everyone' },
				{ time: '3:43', title: 'History and permissions' },
				{ time: '4:01', title: 'API, MCP and Copilot' },
			],
		},
		together: {
			eyebrow: 'Collaboration',
			title: 'Everyone.',
			titleAccent: 'All at once.',
			text: 'Other people’s changes arrive live. You see who’s looking at which row, discuss it right where it is, and an @ is all it takes to notify a colleague.',
			demo: {
				path: 'Sales / Quotes',
				here: '3 people on this table',
				columns: {
					client: 'Client',
					status: 'Stage',
					amount: 'Amount',
					due: 'Due date',
				},
				statuses: {
					draft: 'Draft',
					sent: 'Sent',
					signed: 'Signed',
				},
				rows: [
					'Martin’s Bakery',
					'Lindenwood Clinic',
					'Lincoln High School',
					'Community Cycles',
					'The Fine Grocer',
					'Riverside Forge',
				],
				comment: '@{name} can you approve this quote before tonight?',
				reply: 'Approved!',
				toast: '{name} edited “{field}”',
			},
			points: {
				live: {
					title: 'Live',
					text: 'Every change appears for others right away, without reloading the page.',
				},
				comments: {
					title: 'Comments and mentions',
					text: 'Comment on a row, mention a colleague with @, and the bell lets them know.',
				},
				undo: {
					title: 'Undo safely',
					text: 'Ctrl+Z undoes your last change — never a colleague’s.',
				},
			},
			link: {
				href: '/fonctionnalites/collaboration/',
				label: 'Working together',
			},
		},
		automate: {
			eyebrow: 'Automations',
			title: 'It works',
			titleAccent: 'while you sleep.',
			text: 'Describe once what should happen. When a row changes, every morning at a set time, or with the click of a button, basedb runs through the steps — and every run can be reviewed, step by step.',
			clock: '03:12',
			when: 'When',
			trigger: 'a quote becomes “Signed”',
			steps: {
				find: {
					kind: 'Find row',
					text: 'The quote’s client',
				},
				ai: {
					kind: 'Ask AI',
					text: 'Draft a thank-you note',
				},
				create: {
					kind: 'Create row',
					text: 'The invoice, in Invoices',
				},
				notify: {
					kind: 'Notify someone',
					text: 'Accounting',
				},
				slack: {
					kind: 'Send to Slack',
					text: 'In the #sales channel',
				},
			},
			answer: 'Thank you for your trust! We’re starting your project on Monday, and your invoice follows by email.',
			done: 'Succeeded · 5 steps · 1.2s',
			copilot: {
				prompt: 'When a quote is signed, notify accounting and create the invoice.',
				text: 'One sentence to the Copilot, and the automation is built: all that’s left is to review it.',
			},
			link: {
				href: '/fonctionnalites/automatisations/',
				label: 'Automations',
			},
		},
		glance: {
			eyebrow: 'Dashboards',
			title: 'See everything.',
			titleAccent: 'At a glance.',
			text: 'Numbers, charts, goals: your dashboards are built with the mouse from your tables, and stay up to date on their own. One filter, and the whole dashboard follows.',
			demo: {
				title: 'Sales performance',
				filters: ['This year', 'All cities'],
				revenue: 'Revenue',
				signed: 'Quotes signed',
				rate: 'Signing rate',
				goal: 'Annual goal',
				byMonth: 'Revenue by month',
				byStage: 'Quotes by stage',
				stages: ['Sent', 'In discussion', 'Signed'],
				bySector: 'Clients by sector',
				sectors: ['Retail', 'Healthcare', 'Education', 'Industry'],
				shared: 'Shared by link',
			},
			points: {
				viz: {
					title: 'Fifteen visualizations',
					text: 'Numbers, trends, goals, charts, sectors, funnels, pivot tables, maps.',
				},
				filters: {
					title: 'Shared filters',
					text: 'The period, a client, a city: one filter can drive one card, several, or the whole dashboard.',
				},
				share: {
					title: 'Shared by a link',
					text: 'Public or restricted to the team, and embeddable in another site.',
				},
			},
			link: {
				href: '/fonctionnalites/tableaux-de-bord/',
				label: 'Dashboards',
			},
		},
		ai: {
			eyebrow: 'Artificial intelligence',
			title: 'Describe it.',
			titleAccent: 'basedb builds it.',
			text: 'One sentence is enough to get a complete base, which you review before creating it. After that, the Copilot suggests filters, charts and automations, and AI fields summarize, classify and draft for you.',
			prompt: 'An application tracker for our three open positions, with interviews.',
			thinking: 'Three related tables, ready to review.',
			tables: {
				jobs: {
					name: 'Positions',
					fields: ['Title', 'Department', 'Opened on'],
				},
				people: {
					name: 'Candidates',
					fields: ['Name', 'Position', 'Stage', 'Summary'],
				},
				talks: {
					name: 'Interviews',
					fields: ['Candidate', 'Date', 'With', 'Feedback'],
				},
			},
			aiField: 'Summary',
			aiValue: 'Six years in project management, comfortable with clients; worth digging into: English.',
			create: 'Create the base',
			providers: 'With the provider of your choice — OpenAI, Anthropic, Mistral, or a model installed on your own servers. Nothing is sent without your approval.',
			link: {
				href: '/fonctionnalites/ia/',
				label: 'AI in basedb',
			},
		},
		features: {
			title: 'Everything you need.',
			titleAccent: 'And a lot more.',
			text: 'Every feature writes to the same tables, with the same permissions, in the same history.',
			tiles: {
				views: {
					stat: '8',
					title: 'ways to see your data',
					text: 'Grid, kanban, calendar, timeline, gallery, list, form and survey, on the same rows. Everyone picks their own.',
					href: '/fonctionnalites/vues/',
				},
				history: {
					stat: 'Ctrl+Z',
					title: 'Nothing is ever lost',
					text: 'Every change is kept with its previous value; a mistake can be undone, a deleted row restored.',
					href: '/fonctionnalites/historique/',
				},
				forms: {
					title: 'Forms',
					text: 'A link, public or restricted to the team: every response lands in the table, without opening up the rest.',
					href: '/fonctionnalites/formulaires-partages/',
				},
				viz: {
					stat: '15',
					title: 'visualizations',
					text: 'Numbers, trends, goals, charts, sectors, funnels, pivot tables and maps.',
					href: '/fonctionnalites/tableaux-de-bord/',
				},
				formulas: {
					code: 'SI([Montant] > 10000; "Grand compte"; "")',
					title: 'Formulas in French',
					text: 'Just like in a spreadsheet — SI, ARRONDI, JOURS… — but computed for the whole team.',
					href: '/fonctionnalites/tables-et-champs/#formulas',
				},
				rights: {
					title: 'Everyone sees what they should',
					text: 'Read, edit, manage, team by team; a sensitive column can be hidden.',
					href: '/fonctionnalites/droits/',
				},
				mentions: {
					bubble: '@Camille',
					title: 'Comments and mentions',
					text: 'Discuss a row right where it is, and the bell lets you know.',
					href: '/fonctionnalites/collaboration/',
				},
				relations: {
					title: 'Everything is connected',
					text: 'Clients, projects, invoices: totals and lookups reach across relations.',
					href: '/fonctionnalites/tables-et-champs/',
				},
				templates: {
					stat: '10',
					title: 'ready-made templates',
					text: 'CRM, recruiting, inventory, events… or a base described to the AI in one sentence.',
					href: '/modeles/',
				},
				import: {
					title: 'Import in one move',
					text: 'Drop a CSV file: columns and types are guessed, and the table is created.',
					href: '/guides/premiers-pas/',
				},
				agenda: {
					title: 'Right into your calendar',
					text: 'A calendar becomes a feed for Google Calendar, Outlook or Apple Calendar.',
					href: '/fonctionnalites/vues-partagees/',
				},
				files: {
					title: 'Files and images',
					text: 'Quotes, photos, contracts; an image becomes a card’s cover.',
					href: '/fonctionnalites/fichiers/',
				},
				share: {
					title: 'Shared views',
					text: 'A read-only view through a link, embeddable in your site.',
					href: '/fonctionnalites/vues-partagees/',
				},
				sync: {
					title: 'Synced tables',
					text: 'Kept up to date from an online CSV, a calendar, or another basedb.',
					href: '/integrations/synchronisation/',
				},
				signin: {
					title: 'Simple sign-in',
					text: 'Google, Microsoft or a password; invite your colleagues through a link.',
					href: '/hebergement/connexion/',
				},
				languages: {
					title: 'In your language',
					text: 'The interface uses everyone’s own language, one of twenty.',
					href: '/fonctionnalites/droits/#your-settings',
				},
			},
		},
		yours: {
			eyebrow: 'Free and self-hosted',
			per: 'per person. Forever.',
			text: 'basedb is open-source software. Install it on your own server and invite your whole team: no subscription, no licenses to count, and your data stays with you.',
			points: {
				home: {
					title: 'On your own servers',
					text: 'On your server or your host’s, backed up like any PostgreSQL database.',
				},
				free: {
					title: 'Open-source',
					text: 'Under the AGPL-3.0 license: the code is open, and it will stay that way.',
				},
				ai: {
					title: 'The AI of your choice',
					text: 'A provider from the market, a model installed on your own servers — or no AI at all.',
				},
			},
			link: {
				href: '/guides/installation/',
				label: 'Install basedb',
			},
		},
		gallery: {
			eyebrow: 'Templates',
			title: 'Ready in a minute.',
			text: 'Start from a template, with its tables, views, dashboard and sample rows, then adapt it to the way you work.',
			use: 'Browse',
			ask: {
				title: 'Nothing quite fits?',
				text: 'Describe what you need in one sentence: the AI suggests a base built for you.',
			},
			all: 'See all the templates',
			previous: 'Previous templates',
			next: 'Next templates',
		},
		developers: {
			title: 'And on the technical side?',
			text: 'Every table is a real PostgreSQL table. REST API, webhooks, an MCP server for AI agents, and a one-command install.',
			link: 'The developers page',
		},
		faq: {
			title: 'Your questions',
			items: [
				{
					q: 'Do I need to know how to code?',
					a: 'No. You create your tables, views, forms, dashboards and automations with the mouse. Formulas are written in French, just like in a spreadsheet: SI, ARRONDI, JOURS…',
				},
				{
					q: 'How much does it cost?',
					a: 'Nothing: basedb is open-source software, with no subscription and no per-person price. All you need is a server to install it on.',
				},
				{
					q: 'How do you install it?',
					a: 'On a server, with Docker: two files and one command, a few minutes for whoever handles your IT. The installation guide explains everything, step by step.',
				},
				{
					q: 'Can we bring over our spreadsheets?',
					a: 'Yes: save your sheet as CSV and drop it into basedb. The import guesses each column’s type, creates the table, and tells you row by row what it couldn’t bring over.',
				},
				{
					q: 'Can several of us work at the same time?',
					a: 'That’s what it’s built for. Other people’s changes show up live, you can comment on a row, mention a colleague with @, and a bell notifies them.',
				},
				{
					q: 'And does the AI read our data?',
					a: 'Only if you decide it should. With no AI provider configured, nothing is sent. After that, a field or an automation that calls the AI only sends what its instructions cite, with your approval.',
				},
				{
					q: 'In what language?',
					a: 'In yours: the interface uses your browser’s language, one of twenty, and everyone can change it in their settings.',
				},
			],
		},
		cta: {
			title: 'Your team deserves better',
			titleAccent: 'than a shared file.',
			text: 'Start from a template, invite your colleagues, and leave the “FINAL (2)” files behind.',
			primary: 'Browse the templates',
			secondary: 'Install basedb',
		},
	},
	hero: {
		badge: 'New: automations as flows, dashboards and SQL views',
		title: ['The collaborative', 'database where every', 'table is a real'],
		titleAccent: 'PostgreSQL table.',
		lead: 'The simplicity of a shared spreadsheet — grids, views, forms, permissions — with data that lives in tables that are <strong>typed and plainly named</strong>. Your team works in the interface; your scripts, your BI tools, your AI agents and <code>psql</code> read the same rows.',
		install: 'Install with Docker',
		features: 'See the features',
		copy: 'Copy the command',
		facts: ['Self-hosted', 'AGPL-3.0', 'REST API & MCP server'],
		demo: {
			url: 'basedb.your-domain.com',
			project: 'Main project',
			projectMeta: 'Project · 2 bases',
			filter: 'Filter bases and tables',
			sales: 'Sales',
			support: 'Support',
			environment: 'Production',
			clients: 'Clients',
			opportunities: 'Opportunities',
			quotes: 'Quotes',
			baseSection: 'Base · Sales',
			screens: ['Dashboards', 'Automations'],
			copilot: '✦ Copilot',
			allRows: '▦ All rows ▾',
			tools: ['Filter', 'Group', 'Colors'],
			search: 'Search…',
			add: '+ Add',
			columns: {
				name: 'Name',
				status: 'Status',
				amount: 'Amount',
				client: 'Client',
			},
			statuses: {
				nouveau: 'New',
				qualifie: 'Qualified',
				proposition: 'Proposal',
				negociation: 'Negotiation',
				gagne: 'Won',
				perdu: 'Lost',
			},
			deals: {
				portail: {
					name: 'Portal redesign',
					client: 'Riverton City Hall',
				},
				erp: {
					name: 'ERP migration',
					client: 'Delorme Group',
				},
				audit: {
					name: 'Security audit',
					client: 'St. Roch Clinic',
				},
				billetterie: {
					name: 'Online ticketing',
					client: 'Crescent Theater',
				},
				flotte: {
					name: 'Fleet tracking',
					client: 'Kerlann Transport',
				},
				mobile: {
					name: 'Mobile app',
					client: 'Moreau Studio',
				},
				intranet: {
					name: 'Intranet redesign',
					client: '',
				},
			},
			toastTitle: 'Form “Quote request”',
			toastText: 'public response · created “{name}”',
			cursor: 'Camille',
			psqlRows: '(2 rows)',
		},
	},
	showcase: {
		label: 'The interface, for real',
		title: 'Everything your team expects from a shared spreadsheet.',
		tabs: 'Interface screenshots',
		alt: 'basedb — {labelLower}: {caption}',
		shots: {
			grille: {
				label: 'Grid',
				caption: 'A grid that writes to a real table — and computed fields: a duration by formula, the client’s city by lookup, the number of tasks by count.',
			},
			kanban: {
				label: 'Kanban',
				caption: 'The same rows in columns, by a single select: a cover image, a description that cites the row. Dragging a card updates the row.',
			},
			galerie: {
				label: 'Gallery',
				caption: 'Cards with their image, a color by status: the gallery, one of eight ways to read a table.',
			},
			chronologie: {
				label: 'Timeline',
				caption: 'Bars between two dates, and arrows for their dependencies — in red when the order no longer holds.',
			},
			tableaux: {
				label: 'Dashboards',
				caption: 'Cards in a grid, in tabs, under shared filters: a trend, a goal, stacked series — read with each person’s own permissions.',
			},
			automatisations: {
				label: 'Automations',
				caption: 'When a task is done, find what is left of the project; if nothing is, the AI drafts the wrap-up note and the project moves to “Delivered”. Every run can be read on the flow, step by step.',
			},
			commentaires: {
				label: 'Comments',
				caption: 'Discuss a row right where it is: comments, mentions, notifications.',
			},
			formulaire: {
				label: 'Form',
				caption: 'A form is shared through a link, public or restricted to signed-in members.',
			},
			historique: {
				label: 'History',
				caption: 'Every write, wherever it comes from — a person, an automation, direct SQL — with the values it replaced.',
			},
			sql: {
				label: 'SQL',
				caption: 'A query on the real names, saved under the tables for the whole team — which everyone runs with their own permissions.',
			},
			vuesSql: {
				label: 'SQL views',
				caption: 'Real PostgreSQL views, filed among the tables with their color and icon — and readable from psql.',
			},
		},
	},
	features: {
		postgres: {
			label: 'PostgreSQL, no translation layer',
			title: 'A grid for the team, a real table {for your tools.}',
			lead: 'No generic model, no catch-all JSON, no <code>field_1837</code>: a base is a schema, a table is a table, a field is a typed column with a readable name.',
			bullets: [
				'<strong>Native types</strong>: <code>text</code>, <code>numeric</code>, <code>date</code>, <code>timestamptz</code>, <code>boolean</code> — and real foreign keys for relations.',
				'<strong>Constraints enforced by the database</strong>: single selects as <code>CHECK</code>, web and email addresses validated, relations as <code>FOREIGN KEY</code>.',
				'<strong>Formulas computed by PostgreSQL</strong>: <code>JOURS([Fin]; [Début])</code> becomes a generated column, which <code>psql</code> reads like any other.',
				'<strong>Direct SQL is still allowed</strong> — and even it is recorded in the history, by a trigger.',
				'<strong>SQL queries and views</strong> in the interface: queries saved under the tables, for yourself or for the team, and real PostgreSQL views filed among them, which <code>psql</code> reads too.',
				'<strong>Renaming doesn’t break anything</strong>: the old name is still served by a compatibility alias while you migrate your queries.',
			],
			links: [
				{
					href: '/integrations/sql/',
					label: 'Working in SQL',
				},
				{
					href: '/fonctionnalites/requetes-et-vues-sql/',
					label: 'SQL queries and views',
				},
				{
					href: '/architecture/principes/',
					label: 'The principles',
				},
			],
		},
		automations: {
			label: 'Automate',
			title: 'Automations as flows, {AI at every step.}',
			lead: 'When a row changes, at a set time or with a click: a graph editor chains the steps, and every run can be reviewed on the flow.',
			bullets: [
				'<strong>A readable flow</strong>: the trigger, then each step as a card; a <strong>+</strong> on a line adds a step right there.',
				'<strong>Find, decide, write</strong>: find a row, take one branch or another depending on conditions, update, create, notify, call a webhook, post to Slack.',
				'<strong>Ask AI</strong> in a step: a prompt that cites the row, an answer read as text, number, date or choice, which the following steps reuse.',
				'<strong>Copilot</strong> proposes a whole automation from a single sentence, or explains why a run failed — nothing is saved without you.',
				'<strong>With the permissions of whoever wrote it</strong>, and in the history like any other write.',
			],
			links: [
				{
					href: '/fonctionnalites/automatisations/',
					label: 'Automations',
				},
				{
					href: '/fonctionnalites/automatisations/#copilot',
					label: 'Copilot',
				},
			],
			alt: 'basedb — the “Project delivered” automation in the flow editor: when a task is done, record the time, find what is left of the project, take the “Otherwise” branch, ask the AI for the wrap-up note, then deliver the project; on the right, its latest runs, step by step.',
		},
		dashboards: {
			label: 'Analyze',
			title: 'Dashboards {without leaving your tables.}',
			lead: 'Questions asked with the mouse or in SQL, fifteen visualizations, shared filters — everyone reads them with their own permissions.',
			bullets: [
				'<strong>Questions</strong>: a table, its joins, filters and measures by day, week, month or year — or read-only SQL.',
				'<strong>Fifteen visualizations</strong>: number, trend, progress, gauge, bars, lines, pie, funnel, pivot table, map…',
				'<strong>Explore in one click</strong>: a point opens its rows, or a finer period.',
				'<strong>Shared filters</strong> that drive one, several or all of the cards.',
				'<strong>Share through a link</strong>, public or members only, and embed in another site.',
			],
			links: [
				{
					href: '/fonctionnalites/tableaux-de-bord/',
					label: 'Dashboards',
				},
			],
			alt: 'basedb — a dashboard: the month’s trend, a collections goal, revenue by month, review sentiment, under period and client filters.',
		},
		rights: {
			label: 'Collaborate without opening everything',
			title: 'Permissions down to the field, {a history with no gaps.}',
			lead: 'Permissions are granted to groups, on a project, a base or a table, and flow down to everything below. A sensitive column can be hidden from a group, or made read-only for it.',
			bullets: [
				'<strong>Four levels</strong>: No access, Read, Edit, Manage — adding up from one group to the next.',
				'<strong>Even SQL follows your permissions</strong>: in the interface, a query sees only the tables and fields open to you — and PostgreSQL itself enforces it.',
				'<strong>Every write is captured</strong> in its own transaction: interface, API, agent, public form or direct SQL.',
				'<strong>A change can be undone</strong>, a deleted row restored, and a deleted base too.',
				'<strong>Administration asks for confirmation</strong>: changing a permission requires having retyped your password within the last five minutes.',
			],
			links: [
				{
					href: '/fonctionnalites/droits/',
					label: 'Permissions and groups',
				},
				{
					href: '/fonctionnalites/historique/',
					label: 'History',
				},
			],
		},
		agents: {
			label: 'REST API · MCP · webhooks',
			title: 'Your AI agents get the data, {not the keys to the kingdom.}',
			lead: 'The MCP server gives agents twelve tools; the REST API gives your programs the same data. A single point of permission control, the same logs.',
			bullets: [
				'<strong>One token per base</strong>, read-only by default, never with more permissions than the person who created it.',
				'<strong>An agent deletes nothing</strong> and doesn’t change the schema: it proposes, a person approves.',
				'<strong>Generated documentation</strong> for every base, filtered by your permissions, with its OpenAPI 3.1 specification.',
				'<strong>Webhooks</strong> on every write: signed, ordered and retried.',
			],
			links: [
				{
					href: '/integrations/mcp/',
					label: 'Connect an agent',
				},
				{
					href: '/integrations/api-rest/',
					label: 'The REST API',
				},
			],
		},
	},
	sqlVisual: {
		interface: 'Interface',
		title: 'New field · Opportunities',
		labelField: 'Label',
		labelValue: 'Amount',
		typeField: 'Type',
		typeValue: 'Number',
		descriptionField: 'Description',
		descriptionValue: 'Contract amount, excluding tax',
		required: 'Required',
		ai: 'AI',
		migration: 'a planned migration, short locks',
	},
	rightsVisual: {
		groups: ['Administrators', 'Sales team', 'Support'],
		project: 'Main project',
		sales: 'Sales',
		opportunities: 'Opportunities',
		clients: 'Clients',
		support: 'Support',
		inherited: 'inherited',
		levels: {
			none: 'No access',
			read: 'Read',
			edit: 'Edit',
			manage: 'Manage',
		},
		field: 'Field “Margin”',
		hidden: 'Hidden',
		sqlChange: '<b>Direct SQL session</b> updated <b>“ERP migration”</b>',
		sqlMeta: '02:46 · local connection · psql',
		sqlDiff: 'Amount: <s>125,000</s> → 130,000',
		undo: '↶ Undo',
		formChange: '<b>Form “Quote request”</b> created <b>“Intranet redesign”</b>',
		formMeta: 'public response · published by Camille',
	},
	agentVisual: {
		agent: 'Agent',
		via: 'connected through MCP · “Sales” token',
		question: 'How many opportunities are in negotiation, and for what amount?',
		listArgs: 'opportunites · statut = Negotiation',
		answer: 'Two opportunities, <b>€182,000</b> in total: ERP migration (€130,000) and Fleet tracking (€52,000).',
		request: 'Add a “Probability” field as a percentage.',
		proposeArgs: 'opportunites · Probability · number',
		proposed: 'Proposed: someone on the team has to approve it in basedb.',
		badge: 'Proposal',
		expires: 'expires in 23 h',
		what: 'Add the <b>“Probability”</b> field (Number) to <b>Opportunities</b>',
		by: 'Proposed by the agent · “Sales” token',
		refuse: 'Reject',
		approve: 'Approve',
	},
	bento: {
		label: 'And everything else',
		title: 'What you expect from a team tool, without letting go of PostgreSQL.',
		text: 'Every feature writes to the same tables, under the same permissions, into the same history.',
		more: 'Learn more →',
		views: {
			title: 'Eight views of the same rows',
			text: 'Collaborative for the whole team, or personal for you alone: everyone picks their own way of reading, and nobody copies the data.',
			chips: ['Grid', 'Kanban', 'Calendar', 'Timeline', 'Gallery', 'List', 'Form', 'Survey'],
		},
		forms: {
			title: 'Shared forms',
			text: 'A public link, or one restricted to signed-in members. Responding grants no permission on the table.',
			href: '/fonctionnalites/formulaires-partages/',
		},
		environments: {
			title: 'Environments',
			text: 'One base, several variants. Compare the schema, migrate from one to another, sync rows.',
			chips: ['Production', 'Staging', 'Development'],
			href: '/fonctionnalites/environnements/',
		},
		collaboration: {
			title: 'Working together',
			text: 'Other people’s writes arrive in real time, you see who is looking at which row, and you discuss it right where it is: comments, mentions, notifications. Ctrl+Z undoes the last write, and refuses rather than overwrite someone else’s work.',
			chips: ['Real time', 'Presence', 'Comments', 'Mentions', 'Ctrl+Z'],
			href: '/fonctionnalites/collaboration/',
		},
		small: {
			ai: {
				title: 'AI in the grid',
				text: 'A field filled in by a model from the other columns, and a Copilot that suggests filters, queries and columns, applied in one click. OpenAI, Anthropic, Mistral, or a model served on your own machine.',
				code: 'Summarize {{Notes}} in one sentence',
				href: '/fonctionnalites/ia/',
			},
			formulas: {
				title: 'Relations and formulas',
				text: 'Real foreign keys, formulas written in French and computed by PostgreSQL, and lookups, rollups and counts across relations.',
				code: 'ARRONDI([Montant HT] * (1 + [Taux de TVA]); 2)',
				href: '/fonctionnalites/tables-et-champs/#formulas',
			},
			richText: {
				title: 'Rich text and variables',
				text: 'A visual editor for formatted text, sanitized on write; and in any long text, {{Ville}} reads as the row’s value.',
				code: 'Delivery on {{Date}} in {{Ville}}',
				href: '/fonctionnalites/tables-et-champs/#rich-text-and-variables',
			},
			languages: {
				title: 'In your language',
				text: 'The interface uses your browser’s language, one of twenty; everyone can change it in their settings.',
				href: '/fonctionnalites/droits/#your-settings',
			},
			sharedViews: {
				title: 'Shared views',
				text: 'A read-only view through a link, embeddable in another site; a calendar becomes a feed for your calendar app.',
				href: '/fonctionnalites/vues-partagees/',
			},
			syncedTables: {
				title: 'Synced tables',
				text: 'A table kept up to date from an online CSV, a calendar, or another basedb’s shared view.',
				href: '/integrations/synchronisation/',
			},
			templates: {
				title: 'Base templates',
				text: 'Ten ready-to-use templates, a base described to the AI in one sentence, and your own saved as a template.',
				href: '/modeles/',
			},
			files: {
				title: 'Files and images',
				text: 'On the host’s disk or in S3-compatible storage: AWS, Scaleway, OVH, Cloudflare R2, Garage, MinIO…',
				href: '/fonctionnalites/fichiers/',
			},
			import: {
				title: 'CSV and JSON import',
				text: 'Drop a file: the import guesses the types, creates the table or fills an existing one, and tells you row by row what was rejected.',
				href: '/guides/premiers-pas/',
			},
			accounts: {
				title: 'Accounts and invitations',
				text: 'Everyone creates their own account and projects, and invites others through a link with Read, Edit or Manage; sign in with a password, Google, Microsoft or any OpenID Connect provider.',
				href: '/hebergement/connexion/',
			},
			webhooks: {
				title: 'Webhooks',
				text: 'Every write can notify another system: signed payloads, delivered in order, retried.',
				href: '/integrations/webhooks/',
			},
			settings: {
				title: 'Personal settings',
				text: 'Your language, your theme, the date order, your notifications, your sessions and your tokens, all in one place.',
				href: '/fonctionnalites/droits/#your-settings',
			},
		},
	},
	selfHost: {
		label: 'Self-hosted',
		title: 'Your data stays {on your servers.}',
		lead: 'basedb is free software (AGPL-3.0): a single image, a PostgreSQL database, and that’s it — no mandatory third-party service, no telemetry. Back it up with <code>pg_dump</code>, read it with any PostgreSQL client.',
		services: {
			db: 'PostgreSQL 16, your data',
			basedb: 'The interface, the REST API and the MCP server, on a single port',
			proxy: 'Caddy, automatic HTTPS (optional)',
		},
		links: [
			{
				href: '/hebergement/docker/',
				label: 'Docker Compose guide →',
			},
			{
				href: '/hebergement/variables/',
				label: 'All the variables →',
			},
		],
		steps: [
			{
				title: 'Get basedb',
				code: 'git clone https://github.com/eodia/basedb.git\ncd basedb && cp .env.example .env',
			},
			{
				title: 'Two secrets in .env',
				code: 'POSTGRES_PASSWORD=a-strong-password\n# openssl rand -base64 32\nBASEDB_ENCRYPTION_KEY=…',
			},
			{
				title: 'Start',
				code: 'docker compose up -d\n# then http://localhost:3000: create your account',
			},
		],
	},
	faq: {
		label: 'FAQ',
		title: 'What people often ask us.',
		text: 'Another question? <a href="/guides/introduction/">The documentation</a> most likely answers it.',
		items: {
			difference: {
				q: 'How is basedb different from other collaborative databases?',
				a: 'In where the data lives. Where others store your rows in a generic model (numbered columns, JSON documents), basedb creates a real PostgreSQL table for each table and a real typed column for each field, with readable names. Your data stays usable without basedb.',
			},
			sql: {
				q: 'Can I write to the tables directly in SQL?',
				a: 'Yes. Constraints (types, required, single selects, foreign keys) are enforced by PostgreSQL itself, and a trigger records even direct SQL writes in the history, along with the session that made them. The interface’s SQL console and psql read the same tables; in the interface, everyone writes SQL with their own permissions, saves their queries and, if they manage the base, turns them into real PostgreSQL views.',
			},
			ai: {
				q: 'What gets sent to an AI provider?',
				a: 'Nothing until you configure a provider. After that, for schema drafts and Copilot, only the schema and your sentence are sent by default; letting Copilot read data is a checkbox, per conversation. A base template requested from the AI sends only your sentence. An AI field sends the columns its prompt cites, after explicit consent.',
			},
			together: {
				q: 'Can several people work on the same table?',
				a: 'Yes. Other people’s writes appear without reloading, with their face on the table or row they’re looking at. You comment on a row, mention someone with @, and the bell lets them know. And Ctrl+Z only undoes your own writes: it refuses rather than overwrite what someone else has changed since.',
			},
			languages: {
				q: 'In which languages?',
				a: 'Twenty: French, English, German, Spanish, Italian, Brazilian Portuguese, Dutch, Polish, Czech, Swedish, Danish, Norwegian, Finnish, Romanian, Hungarian, Turkish, Ukrainian, Japanese, Simplified Chinese and Korean. The interface uses the browser’s language, and everyone can change it in their settings; this site and the documentation exist in the same languages.',
			},
			agent: {
				q: 'How does an AI agent connect?',
				a: 'Through the MCP server, with an integration token limited to one base, read-only by default. An agent reads, creates and updates rows according to its permissions; it deletes nothing and doesn’t change the schema: it proposes, and a person approves.',
			},
			postgres: {
				q: 'Which version of PostgreSQL do I need?',
				a: 'PostgreSQL 16 or later, with the pg_trgm and unaccent extensions (available in the official image). The provided docker-compose starts a PostgreSQL 16; you can also point DATABASE_URL to your own server.',
			},
			production: {
				q: 'Is it ready for production?',
				a: 'basedb is under active development: the core, the API, the MCP server and the interface work and are covered by more than a thousand tests, but some features are still to come (see the roadmap). Try it, and back up your database as you would any PostgreSQL database.',
			},
			license: {
				q: 'Under which license?',
				a: 'AGPL-3.0-or-later. You can use, modify and host it freely; if you offer a modified version as a service, you share its source code.',
			},
		},
	},
	cta: {
		title: 'Your data deserves {real tables.}',
		text: 'Install basedb in minutes, invite your team, and stay in control of every row.',
		install: 'Install basedb',
		github: 'See the code on GitHub',
	},
	changelog: {
		label: 'What’s new',
		title: 'What changed in basedb',
		intro: 'The details of every change are in <a href="https://github.com/eodia/basedb/commits/main">the repository history</a>. What comes next: the <a href="/feuille-de-route/">roadmap</a>.',
		entries: {
			languages: {
				date: '2026-09-27',
				title: 'Rich text, variables, a more readable kanban',
				tag: 'New',
				items: [
					'<strong>Rich text</strong>: a new field type, formatted in a visual editor — headings, lists, quotes, links —, sanitized on write and guarded by a constraint against direct SQL. <a href="/fonctionnalites/tables-et-champs/#rich-text-and-variables">Rich text and variables</a>',
					'<strong>Variables</strong>: a long text cites a column of its row — <code>{{Ville}}</code> — and reads everywhere with its value: grid, row details, API, MCP server, shared views, automations. The column keeps the citation, which is what <code>psql</code> reads.',
					'<strong>A more readable kanban</strong>: roomier cards, a cover image, and a description that cites the row’s values — “Delivery on {{Date}} for {{Client}}”. <a href="/fonctionnalites/vues/">Views</a>',
					'<strong>Renaming in one step</strong>: a single dialog for a base, a table or a field; the label always changes, and an administrator can also rename in the database, backed by an impact analysis. <a href="/fonctionnalites/tables-et-champs/#changing-the-schema">Changing the schema</a>',
					'<strong>Twenty languages</strong>: the interface, this site and the documentation in French, English, German, Spanish, Italian, Portuguese (Brazil), Dutch, Polish, Czech, Swedish, Danish, Norwegian, Finnish, Romanian, Hungarian, Turkish, Ukrainian, Japanese, Simplified Chinese and Korean. basedb uses the browser’s language; <strong>Settings › Appearance › Language</strong> sets another one, which follows you from one computer to another. Numbers and dates follow the language. <a href="/fonctionnalites/droits/#your-settings">Your settings</a>',
				],
			},
			aiProvider: {
				date: '2026-09-27',
				title: 'Your choice of AI, down to your own machine',
				tag: 'New',
				items: [
					'<strong>A fourth AI provider</strong>: any server that speaks OpenAI’s API — Azure, a company gateway, a model served on your own machine —, declared in the <code>.env</code>. The call log says where the data went. <a href="/fonctionnalites/ia/">AI in basedb</a>',
					'<strong>The sign-in screen</strong> now shows, after the grid and SQL, a dashboard that follows a filter and an automation running, AI step included.',
				],
			},
			flows: {
				date: '2026-09-27',
				title: 'Automations as flows',
				tag: 'New',
				items: [
					'<strong>A graph editor</strong>: the trigger, then each step as a card; a <strong>+</strong> on a line adds a step right there. A simple automation still fits in two cards. <a href="/fonctionnalites/automatisations/">Automations</a>',
					'<strong>Find a row</strong> — an order’s client, the latest unpaid invoice — then update it, cite it, or link it to a newly created row.',
					'<strong>Conditions with several branches</strong>: the first one whose condition is met is taken, “Otherwise” when none is; the branches then join up again.',
					'<strong>Data flows from one step to the next</strong>: <code>{{e2.client}}</code> cites what a step found or created, <code>{{e3.reponse.numero}}</code> what a webhook replied; each text’s menu only offers what has certainly happened before.',
					'<strong>Every run, step by step</strong>: laid over the flow, it traces the branch taken and tells, for each step, what it did and how long it took.',
					'<strong>The automations Copilot</strong>: describe what the base should do on its own, or ask why a run failed; it proposes a whole automation, which you apply to the flow in one click, review, then save — nothing is saved without you. <a href="/fonctionnalites/automatisations/#copilot">Copilot</a>',
					'<strong>Ask AI</strong> in a step, as in an AI field: a prompt that cites the row and the previous steps, an answer read as text, number, yes or no, date or choice from a list, which the following steps write or send. <a href="/fonctionnalites/automatisations/#ask-ai">Ask AI</a>',
				],
			},
			dashboards: {
				date: '2026-09-27',
				title: 'Dashboards: questions, charts, filters',
				tag: 'New',
				items: [
					'<strong>Questions</strong> asked with the mouse — a table, its joins, filters, measures by day, week, month or year — or written in <strong>SQL</strong>, read-only and with your own permissions, variables included. <a href="/fonctionnalites/tableaux-de-bord/">Dashboards</a>',
					'<strong>Fifteen visualizations</strong>: number, trend against the previous period, progress toward a goal, gauge, histogram, bars, line, area, combo, pie, funnel, scatter plot, table, pivot table, map of France or of the world.',
					'<strong>Explore in one click</strong>: a point opens its rows, a finer period, another breakdown.',
					'<strong>Dashboards on a grid</strong>: cards moved and resized with the mouse, tabs, section headings, texts, embedded pages.',
					'<strong>Shared filters</strong> — period, category, text, number, date grouping — that drive one, several or all of the cards, with a default value.',
					'<strong>Charts your way</strong>: the color and name of each series or slice, donut, half circle or rose, stacking with totals, smooth or stepped lines, axes, ticks, logarithmic scale; tables with renamed columns, with bars and colors by value.',
					'<strong>The dashboards Copilot</strong>: a conversation that suggests questions, changes to the dashboard — which can be undone — and values for its filters, applied in one click. Only the schema goes to the provider, unless you allow it to read the results. <a href="/fonctionnalites/tableaux-de-bord/#copilot">Copilot</a>',
					'<strong>Share a dashboard</strong> through a link, public or restricted to members — to specific groups if needed — and embed it in another site: cards and filters, read-only, read with the permissions of whoever published it. <a href="/fonctionnalites/tableaux-de-bord/#sharing-a-dashboard">Sharing</a>',
					'“Interfaces” are now called <strong>Dashboards</strong>; existing ones open as they were, on the new grid.',
				],
			},
			sqlViews: {
				date: '2026-09-27',
				title: 'Saved queries and SQL views',
				tag: 'New',
				items: [
					'<strong>SQL for everyone</strong>: without the Manage level, an SQL tab runs read-only, with your own permissions, applied by PostgreSQL itself — a closed table doesn’t exist, a hidden field is refused. The “Your permissions” badge is there as a reminder. <a href="/fonctionnalites/requetes-et-vues-sql/">SQL queries and views</a>',
					'<strong>Saved queries</strong>, filed under the tables in the “Queries” section: personal, for the whole base or for groups. Sharing a query shares its text, never what its author can read; opened from the sidebar, it runs at once, read-only.',
					'<strong>SQL views</strong>: real PostgreSQL views, filed among the tables with a color, an icon and a small eye, also readable from <code>psql</code> and your tools. Everyone reads them with their own permissions, and the sidebar only shows them to those who can read all of what they contain.',
					'Views follow the schema: a rename doesn’t break them, a changed formula removes them for a moment and then puts them back; one that no longer holds is left to fix, its definition kept.',
				],
			},
			settings: {
				date: '2026-09-27',
				title: 'Your settings',
				tag: 'New',
				items: [
					'<strong>Settings</strong>, in the profile menu: your name, your address and the identity providers linked to your account; your password and your open sessions. <a href="/fonctionnalites/droits/">Accounts and sign-in</a>',
					'<strong>Appearance</strong>: the theme, the date order — <code>25/09/2026</code> or <code>2026-09-25</code> — and the first day of the week for calendars; the last two follow you from one computer to another.',
					'<strong>Notifications</strong>: turn off the ones you no longer want, one kind at a time. <strong>Tokens</strong>: the ones you created, across all your bases, their last use, and revoking them.',
				],
			},
			v020: {
				date: '2026-09-26',
				title: 'Version 0.2.0: your own account, projects and invitations',
				tag: 'New',
				items: [
					'<strong>First sign-in</strong>: on a fresh instance, the first page creates the administrator account, with your address and your password — no more default account, no more password to dig out of the logs. <a href="/guides/installation/">Installation</a>',
					'<strong>Account creation</strong>: everyone creates their own account, then their own projects, which they manage. Administration can close it or restrict it to certain domains. <a href="/hebergement/connexion/">Accounts and sign-in</a>',
					'<strong>Share a project or a base</strong>: whoever has the Manage level invites others through a link, with Read, Edit or Manage; sees who has access, changes a level, removes it. Never more than what they manage.',
					'<strong>Privacy</strong>: everyone now only sees the people they share a project with, and a project name already taken by someone else can no longer be guessed.',
					'<strong>Sign in with Google, Microsoft</strong> and any OpenID Connect provider (Keycloak, GitLab…), declared in the <code>.env</code>; a first sign-in creates the account if account creation allows it. <a href="/hebergement/connexion/">Configure</a>',
					'<strong>New sign-in screen</strong>, in the application’s theme, light or dark, with restrained animation; illustrated empty states throughout the application.',
					'<strong>Updates without loss</strong>: basedb updates its catalog by itself at startup, 0.1 installations included, and refuses to start on a database that a more recent version has already updated. <a href="/hebergement/sauvegardes/">Updating</a>',
				],
			},
			dockerImage: {
				date: '2026-09-26',
				title: 'A single Docker image',
				tag: 'Hosting',
				items: [
					'basedb fits in <strong>a single image</strong>, <code>eodia/basedb</code> on Docker Hub, for amd64 and arm64: the interface, the API under <code>/api</code> and the MCP server under <code>/mcp</code>, on <strong>a single port</strong>. <a href="/guides/installation/">Installation</a>',
					'Two files are enough — <code>docker-compose.yml</code> and <code>.env</code> — without cloning the repository or building anything; updating is a <code>docker compose pull</code>.',
					'Behind a domain, the HTTPS proxy no longer has any routing to do: everything goes to port 3000.',
				],
			},
			automations: {
				date: '2026-09-26',
				title: 'Automations, interfaces, formulas, collaboration',
				tag: 'New',
				items: [
					'<strong>Formulas</strong> written in French — <code>SI</code>, <code>ARRONDI</code>, <code>JOURS</code>… — that become columns generated by PostgreSQL; <strong>lookups</strong>, <strong>rollups</strong> and <strong>counts</strong> across relations. <a href="/fonctionnalites/tables-et-champs/">Fields</a>',
					'<strong>New types</strong>: multiple relation, person, email, autonumber, button; and formats chosen like types — currency, percent, duration, star rating, phone, barcode.',
					'<strong>Eight views</strong>: the <strong>gallery</strong> and the <strong>list</strong> join the other six; <strong>personal views</strong> for every reader, locked views, manual ordering, dependencies in the timeline. <a href="/fonctionnalites/vues/">Views</a>',
					'<strong>The grid</strong>: quick search, grouping, per-column summary over the whole filter, colors by rules, row height.',
					'<strong>Shared views</strong>, read-only, embeddable in another site; a calendar becomes an <strong>iCalendar feed</strong> for Google Calendar, Outlook or Apple Calendar. <a href="/fonctionnalites/vues-partagees/">Sharing</a>',
					'<strong>Collaboration</strong>: comments and mentions, notifications, other people’s writes in real time, presence on the table and on the row. <a href="/fonctionnalites/collaboration/">Working together</a>',
					'<strong>Ctrl+Z</strong> undoes the last write — a cell, a moved card, an entire import — and refuses rather than overwrite what someone else has changed since.',
					'<strong>Automations</strong>: when a row is created or updated, at a set time or at the click of a button — update, create, notify, call a webhook, post to Slack. <a href="/fonctionnalites/automatisations/">Automate</a>',
					'<strong>Interfaces</strong>: dashboards — numbers, charts, lists, texts — read with each person’s own permissions. <a href="/fonctionnalites/tableaux-de-bord/">Dashboards</a>',
					'<strong>Integrations</strong>: a Slack channel, and <strong>synced tables</strong> from an online CSV, a calendar or another basedb’s view. <a href="/integrations/synchronisation/">Integrations</a>',
					'<strong>Base templates</strong>: a gallery of ten templates, a base described to the AI in one sentence, and any base can be saved as a template. <a href="/modeles/">The gallery</a>',
					'<strong>Permissions</strong>: the Schema screen becomes view-only for anyone without the Manage level.',
					'<strong>New identity</strong>: a logo, a palette, and a redesigned sign-in screen.',
				],
			},
			simpler: {
				date: '2026-09-26',
				title: 'A simpler interface',
				items: [
					'<strong>The sidebar</strong> now lists only the bases and their tables; the open base’s screens — Schema, History, Interfaces, Automations — are grouped in one block, just above the profile.',
					'<strong>The profile menu</strong> holds what isn’t data: the API and MCP documentation, integrations, users and permissions.',
					'<strong>An SQL query</strong> opens from the “+” in the tab bar or from the base’s menu, with no duplicate in the sidebar.',
					'<strong>New base</strong> offers templates and AI right in the dialog; the demo base goes through the same gallery.',
					'<strong>The screen no longer offers what would be refused</strong>: no schema buttons without Manage, no “Delete” without permission to delete; and a reader creates their own views instead of running into an error message.',
					'<strong>System columns</strong> are filed under “System information” instead of being offered on every table.',
					'<strong>A row’s details</strong> gain its comments, a button to email or call, and a rating set in one click.',
					'<strong>The sign-in screen</strong> drops its animated 3D background for a lightweight screen that respects the “reduce motion” preference.',
				],
			},
			environments: {
				date: '2026-09-26',
				title: 'Environments, shared forms, views',
				items: [
					'<strong>Environments</strong>: production, staging and development for the same base; side-by-side comparison, migration plan, row sync.',
					'<strong>Schema history</strong>: every creation or change of a table or field, captured by a trigger on the catalog.',
					'<strong>Shared forms</strong>: a public or members-only link, closing by date or by number of responses, responses attributed in the history.',
					'<strong>Six views</strong>: grid, kanban, calendar, timeline, form, survey.',
					'<strong>Data history</strong>: undo a change, restore a deleted row.',
					'<strong>AI</strong>: the AI option on any field, and Copilot.',
					'<strong>Relation</strong> and <strong>URL</strong>: two distinct types; long text is written in Markdown.',
					'<strong>Webhooks</strong>, signed and ordered; <strong>agent proposals</strong> to approve.',
					'<strong>Docker</strong>: a Dockerfile with three targets, a complete docker-compose, an optional HTTPS proxy.',
				],
			},
			projects: {
				date: '2026-09-25',
				title: 'Projects, permissions, MCP server',
				items: [
					'<strong>Projects</strong> above bases, and permissions by <strong>groups</strong> on four levels: No access, Read, Edit, Manage.',
					'<strong>Accounts</strong>: temporary password, changed at first sign-in, elevation for administration.',
					'<strong>MCP server</strong> and stdio relay; <strong>integration tokens</strong> shared by the REST API and MCP.',
					'<strong>Generated “API and MCP” documentation</strong> for every base.',
				],
			},
			fields: {
				date: '2026-09-20',
				title: 'Fields, single selects, import',
				items: [
					'Edit a field and the options of a single select.',
					'<strong>Import</strong> CSV and JSON files.',
					'The table menu: rename, describe, delete.',
				],
			},
			firstCommit: {
				date: '2026-09-20',
				title: 'First commit',
				items: [
					'The monorepo: naming, error code registry, catalog extracted from the architecture document, core, API, interface.',
				],
			},
		},
	},
	roadmap: {
		label: 'Roadmap',
		title: 'What comes next',
		intro: 'basedb is under active development. This page says what is still missing, with no promised dates. An idea, a need? <a href="https://github.com/eodia/basedb/issues">Open an issue</a>. What is already there: <a href="/nouveautes/">what’s new</a>.',
		columns: {
			next: {
				title: 'Coming soon',
				items: {
					restoreTable: {
						title: 'Restore a single table',
						text: 'A deleted table stays readable in SQL under its relegated name; bringing it back on its own from the interface is coming.',
					},
					aiSettings: {
						title: 'AI settings in the interface',
						text: 'Provider, model and key per workspace, without going through the API’s environment.',
					},
					mail: {
						title: 'Notifications and invitations by email',
						text: 'Mentions, replies and assignments arrive in basedb today, and invitations as a link you send yourself; they will also be able to go out by email.',
					},
				},
			},
			later: {
				title: 'Later',
				items: {
					formLinks: {
						title: 'Relations and files in shared forms',
						text: 'A restricted search in the linked table, a bounded file upload for anonymous visitors.',
					},
					moreEvents: {
						title: 'More notified events',
						text: 'Being notified of a form response, an agent proposal, a disabled webhook.',
					},
					sqlViewsAcross: {
						title: 'SQL views across environments',
						text: 'Copying SQL views along with the schema when creating or comparing environments, and in base templates.',
					},
					loops: {
						title: 'Loops and waits in automations',
						text: 'Repeating steps for each row found, waiting before the next one (“three days later”), and carrying flows into base templates.',
					},
					textFormulas: {
						title: 'Text formulas',
						text: 'Extracting, replacing or truncating part of a text.',
					},
					bulk: {
						title: 'Declared bulk operations',
						text: 'Changes to thousands of rows, recorded in the history as a single operation.',
					},
					tombstones: {
						title: 'Tombstone purging',
						text: 'Cleaning up deletion traces that are no longer needed.',
					},
				},
			},
		},
	},
	gallery: {
		label: 'Templates',
		title: 'A base ready in seconds',
		intro: 'Each template creates linked tables, sample rows, views, a dashboard, automations — and fields that the AI fills in by itself. In basedb: <strong>New base</strong>, then <strong>Start from a template</strong>. Nothing fits? Describe your need in one sentence: the AI proposes a base tailored to you.',
		filter: 'Filter by category',
		all: 'All',
		otherCategory: 'Other',
		ai: '✦ AI',
		tables: {
			one: '{n} table',
			other: '{n} tables',
		},
		rows: {
			one: '{n} row',
			other: '{n} rows',
		},
		views: {
			one: '{n} view',
			other: '{n} views',
		},
		howtoTitle: 'Writing templates in JSON',
		howto: 'A template is a JSON file: its tables, fields, relations, rows, views, dashboards, automations and the prompts of its AI fields. The templates on this page are the files in the repository’s <a href="https://github.com/eodia/basedb/tree/main/packages/templates/catalog"><code>packages/templates/catalog</code></a> folder; every basedb instance reads <a href="/modeles/catalogue.json"><code>catalogue.json</code></a> and offers them to its users. An administrator can also import their own templates into their instance, and any base can be saved as a template.',
		format: {
			href: '/fonctionnalites/modeles/',
			label: 'The template format →',
		},
		back: '← All templates',
		defaultCategory: 'Template',
		sampleRows: {
			one: '{n} sample row',
			other: '{n} sample rows',
		},
		aiTitle: 'What the AI computes',
		useTitle: 'Use this template',
		useSteps: [
			'In basedb, <strong>New base</strong>.',
			'<strong>Start from a template</strong>, then “{label}”.',
		],
		create: '<strong>Create base</strong>.',
		createWithAi: '<strong>Create base</strong> — agreeing, if you wish, to have the AI fields computed by your AI provider.',
		download: 'Download the JSON',
		downloadNote: 'To import it into your instance, or to adapt it before proposing it for the catalog.',
		viewMeta: '— {kind}, {table}',
		dashboard: '<strong>Dashboard</strong> “{label}” — {blocks}',
		blocks: {
			one: '{n} block',
			other: '{n} blocks',
		},
		automation: '<strong>Automation</strong> “{label}”',
		yes: 'Yes',
		no: 'No',
		me: 'You',
		kinds: {
			short_text: 'Short text',
			long_text: 'Long text',
			rich_text: 'Rich text',
			number: 'Number',
			boolean: 'Checkbox',
			date: 'Date',
			datetime: 'Date and time',
			select: 'Single select',
			multi_select: 'Multiple select',
			url: 'URL',
			email: 'Email',
			user: 'Person',
			autonumber: 'Autonumber',
			formula: 'Formula',
			lookup: 'Lookup',
			rollup: 'Rollup',
			count: 'Count',
			button: 'Button',
			link: 'Relation',
			multi_link: 'Multiple relation',
		},
		viewKinds: {
			grid: 'Grid',
			kanban: 'Kanban',
			calendar: 'Calendar',
			timeline: 'Timeline',
			gallery: 'Gallery',
			list: 'List',
			form: 'Form',
		},
	},
	templates: {
		demo: {
			label: 'Demo: Atelier Lumen',
			summary: 'A small agency, its clients, projects, tasks, invoices and reviews: every facet of basedb in a single base.',
			description: 'The demo base. Atelier Lumen is a fictional design agency. Its base shows relations between tables, lookups and rollups (revenue per client, average rating), formulas (amount including tax, delay), three AI-computed fields on customer reviews (sentiment, topic, suggested reply), every kind of view — grid, kanban, calendar, timeline with dependencies, gallery, list, form —, a dashboard and two automations.',
			category: 'Demo',
			tags: ['AI', 'Relations', 'All views', 'Dashboard'],
		},
		'analyse-avis': {
			label: 'Customer review analysis',
			summary: 'Collect reviews, and let the AI draw out the sentiment, the topics, the urgency and a draft reply.',
			description: 'For a shop, a restaurant or a brand: reviews come in from a public form or an import, and the AI reads each one. It classifies the sentiment, spots the main topic, flags those that need a quick reply, extracts the customer’s suggestion and drafts a reply for you to review. Products roll up their average rating and number of reviews; a dashboard tracks satisfaction.',
			category: 'Customer relations',
			tags: ['AI', 'Form', 'Dashboard'],
		},
		'base-connaissances': {
			label: 'Knowledge base',
			summary: 'Help articles and customer questions: the AI summarizes, classifies and suggests an answer based on the articles.',
			description: 'For a support team. Help articles are organized by category and tracked over time; customer questions come in through a public form. The AI summarizes each article and assesses its level, classifies each question and drafts an answer for you to review.',
			category: 'Support',
			tags: ['AI', 'Form', 'List'],
		},
		'calendrier-editorial': {
			label: 'Editorial calendar',
			summary: 'Articles, posts and newsletters planned on a calendar; the AI suggests hooks and keywords.',
			description: 'For a marketing team or a newsroom. Each piece of content moves from idea to publication, takes its place on the publishing calendar and belongs to a campaign. The AI suggests a hook and keywords from the brief, and a form lets the whole company suggest a topic.',
			category: 'Marketing',
			tags: ['AI', 'Calendar', 'Kanban', 'Form'],
		},
		crm: {
			label: 'Sales CRM',
			summary: 'Companies, contacts and opportunities: a sales pipeline, the interactions, and AI that advises on the next step.',
			description: 'A lightweight CRM for a sales team. Opportunities move through a pipeline and carry an amount weighted by their probability; the AI assesses their risk and advises on the next action from the notes. Interactions with clients are logged and summarized, and companies roll up what they represent.',
			category: 'Sales',
			tags: ['AI', 'Pipeline', 'Kanban', 'Calendar'],
		},
		evenements: {
			label: 'Events and registrations',
			summary: 'Conferences, workshops and webinars: registrations, remaining seats, and attendee feedback read by the AI.',
			description: 'For running recurring events. Each event counts its registrants and its remaining seats; registrations move forward until attendance. After the event, attendees leave feedback that the AI classifies by sentiment and summarizes. A public form lets people join the mailing list.',
			category: 'Events',
			tags: ['AI', 'Calendar', 'Form', 'Rollups'],
		},
		'gestion-projet': {
			label: 'Project management',
			summary: 'Projects, tasks and milestones: a roadmap, dependencies between tasks, a kanban and a calendar.',
			description: 'For running several projects in parallel. Each project rolls up its tasks and hours; tasks are tracked on a kanban and scheduled on a timeline that draws their dependencies, and milestones show up in a calendar. The AI writes a project status update for management from its description and progress.',
			category: 'Organization',
			tags: ['Timeline', 'Dependencies', 'Kanban', 'AI'],
		},
		inventaire: {
			label: 'Inventory and stock',
			summary: 'Items, suppliers and movements: stock computes itself, and shortages show up ahead of time.',
			description: 'For a workshop, a shop or a facilities department. Every incoming or outgoing item is a movement; each item’s stock is their sum, its value a formula, and items below their threshold appear in the “À commander” (to order) view. The AI writes each item’s description from its name and category.',
			category: 'Operations',
			tags: ['Rollups', 'Formulas', 'Gallery', 'AI'],
		},
		recrutement: {
			label: 'Recruiting',
			summary: 'Open positions, candidates and interviews; the AI summarizes each application and suggests points to dig into.',
			description: 'Recruitment tracking, from application to hire. Candidates apply through a public form and move step by step through a kanban, and interviews are scheduled in a calendar. The AI reads the cover letter and the notes: a summary, and the questions to ask in the interview. It helps you read; it doesn’t decide.',
			category: 'Human resources',
			tags: ['AI', 'Form', 'Kanban', 'Calendar'],
		},
		'suivi-tickets': {
			label: 'Ticket tracking',
			summary: 'Bugs and requests triaged by the AI, tracked sprint by sprint until they are resolved, with a reporting form.',
			description: 'A ticket tracker for a product team. Each ticket is attached to a component and a sprint; the AI suggests a category, estimates the severity and summarizes the report. A kanban tracks progress, a timeline shows the sprints, a form lets anyone report a problem, and an automation records the resolution date.',
			category: 'Product and engineering',
			tags: ['AI', 'Kanban', 'Form', 'Sprints'],
		},
	},
} satisfies DeepPartial<Dict>;
