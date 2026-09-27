/**
 * The French texts of the landing pages — the source every other language translates.
 *
 * - HTML strings (they hold `<strong>`, `<code>`, `<a>`) are rendered as HTML.
 * - Addresses of the site are written as on the French site, from the root and without
 *   `/basedb`: `/fonctionnalites/vues/`, `<a href="/nouveautes/">`. The page gives them
 *   the reader's language; external addresses (`https://…`) stay as they are.
 * - `{name}` stands for a value the page fills in (`{n}`, `{label}`, `{year}`…); in a
 *   title, the part between {braces} is written in the accent hand.
 * - Records keyed by name (`faq.items`, `bento.small`, `changelog.entries`…) are shown in
 *   the order of this file; a translation overrides them one key at a time. A list (the
 *   bullets of a block, the items of an entry) is translated whole.
 *
 * See `../README.md`.
 */
import type {
	ChangelogEntry,
	FeatureText,
	Plural,
	Question,
	RoadmapItem,
	Shot,
	SmallCard,
	TemplateText,
	Tile,
} from '../types';

const forms = (p: Plural): Plural => p;
const feature = (f: FeatureText): FeatureText => f;
const card = (c: SmallCard): SmallCard => c;
const question = (q: Question): Question => q;
const shot = (s: Shot): Shot => s;
const entry = (e: ChangelogEntry): ChangelogEntry => e;
const item = (i: RoadmapItem): RoadmapItem => i;
const template = (t: TemplateText): TemplateText => t;
const tile = (t: Tile): Tile => t;

const fr = {
	meta: {
		home: {
			title: 'basedb — la base collaborative dont chaque table est une vraie table PostgreSQL',
			description:
				'Grilles et huit vues, formules, formulaires et vues partagés, commentaires, automatisations, tableaux de bord, droits au champ près, historique complet, API REST et serveur MCP — sur de vraies tables PostgreSQL, nommées en clair. Auto-hébergé, AGPL-3.0.',
		},
		changelog: {
			title: 'Nouveautés — basedb',
			description: 'Ce qui a changé dans basedb, version après version.',
		},
		roadmap: {
			title: 'Feuille de route — basedb',
			description: 'Ce que basedb va faire ensuite.',
		},
		gallery: {
			title: 'Modèles — basedb',
			description:
				'Des bases prêtes à l’emploi : suivi de tickets, analyse d’avis, CRM, recrutement… avec leurs lignes d’exemple, leurs vues, leurs tableaux de bord et leurs champs calculés par l’IA.',
		},
		/** A template's page; `{label}`: the template's name. */
		template: {
			title: '{label} — modèles basedb',
		},
	},

	/** The pages of Eodia, the studio that makes basedb — in the reader's language when it has one. */
	eodia: {
		home: 'https://eodia.com/fr/',
		about: 'https://eodia.com/fr/about/',
		contact: 'https://eodia.com/fr/contact/',
	},

	/** The words that lead to the public demo (`DEMO_URL`, `lib/demo.ts`). */
	demo: {
		/** In the bar, beside GitHub. */
		short: 'Démo',
		/** A button: the first screen of each home page, the menu on a phone. */
		cta: 'Essayer la démo',
	},

	nav: {
		aria: 'Navigation principale',
		home: 'basedb — accueil',
		links: [
			{ href: '/#fonctionnalites', label: 'Fonctionnalités' },
			{ href: '/modeles/', label: 'Modèles' },
			{ href: '/guides/introduction/', label: 'Documentation' },
			{ href: '/nouveautes/', label: 'Nouveautés' },
		],
		/** The page for developers, after the links: `/developpeurs/`. */
		developers: 'Développeurs',
		github: 'Le dépôt GitHub de basedb',
		install: 'Installer',
		/**
		 * The menu of every landing page: four panels, each entry with the sentence that says
		 * what it is. On a phone, the same panels unfold one under the other.
		 */
		menu: {
			open: 'Ouvrir le menu',
			close: 'Fermer le menu',
			features: {
				label: 'Fonctionnalités',
				groups: {
					organize: {
						title: 'Organiser',
						items: {
							tables: {
								href: '/fonctionnalites/tables-et-champs/',
								title: 'Tables et champs',
								text: 'Des champs pour tout, des relations, des formules en français.',
							},
							views: {
								href: '/fonctionnalites/vues/',
								title: 'Huit vues',
								text: 'Grille, kanban, calendrier, chronologie, galerie, liste, formulaire, questionnaire.',
							},
							forms: {
								href: '/fonctionnalites/formulaires-partages/',
								title: 'Formulaires',
								text: 'Un lien à partager : chaque réponse devient une ligne.',
							},
							files: {
								href: '/fonctionnalites/fichiers/',
								title: 'Fichiers et images',
								text: 'Devis, photos, contrats, rangés avec leur ligne.',
							},
						},
					},
					collaborate: {
						title: 'Collaborer',
						items: {
							live: {
								href: '/fonctionnalites/collaboration/',
								title: 'Temps réel et commentaires',
								text: 'Voir les autres travailler, commenter une ligne, mentionner un collègue.',
							},
							rights: {
								href: '/fonctionnalites/droits/',
								title: 'Droits et équipes',
								text: 'Qui voit quoi et qui modifie quoi, jusqu’à la colonne.',
							},
							history: {
								href: '/fonctionnalites/historique/',
								title: 'Historique',
								text: 'Chaque modification gardée, et annulable.',
							},
							shared: {
								href: '/fonctionnalites/vues-partagees/',
								title: 'Vues partagées',
								text: 'Une vue par un lien, sur votre site ou dans votre agenda.',
							},
						},
					},
					automate: {
						title: 'Automatiser et analyser',
						items: {
							automations: {
								href: '/fonctionnalites/automatisations/',
								title: 'Automatisations',
								text: 'Quand une ligne change : prévenir, créer, écrire, demander à l’IA.',
							},
							dashboards: {
								href: '/fonctionnalites/tableaux-de-bord/',
								title: 'Tableaux de bord',
								text: 'Quinze visualisations, des filtres communs, un lien à partager.',
							},
							ai: {
								href: '/fonctionnalites/ia/',
								title: 'IA et Copilot',
								text: 'Une base en une phrase, des champs qui se remplissent seuls.',
							},
							templates: {
								href: '/modeles/',
								title: 'Modèles',
								text: 'Dix bases prêtes à l’emploi, à adapter.',
							},
						},
					},
				},
				/** The card beside the panel: the latest news. */
				feature: {
					tag: 'Nouveau',
					title: 'Les automatisations en flux',
					text: 'Chercher, décider, demander à l’IA : un éditeur en graphe, et chaque exécution se relit étape par étape.',
					href: '/nouveautes/',
					cta: 'Toutes les nouveautés',
				},
				all: 'Toutes les fonctionnalités',
			},
			solutions: {
				label: 'Solutions',
				title: 'Pour chaque équipe',
				/** By template key (`packages/templates/catalog/`): the team, and what it gets. */
				items: {
					crm: { team: 'Ventes', text: 'Pipeline, contacts, relances.' },
					recrutement: { team: 'Ressources humaines', text: 'Candidatures, entretiens, synthèses par l’IA.' },
					'calendrier-editorial': { team: 'Marketing', text: 'Articles, posts et newsletters planifiés.' },
					inventaire: { team: 'Opérations', text: 'Un stock calculé, des ruptures vues d’avance.' },
					'gestion-projet': { team: 'Projets', text: 'Jalons, tâches et dépendances.' },
					'suivi-tickets': { team: 'Produit', text: 'Bugs et demandes triés par l’IA.' },
					'base-connaissances': { team: 'Support', text: 'Articles d’aide, questions, réponses proposées.' },
					evenements: { team: 'Événementiel', text: 'Inscriptions, places, retours.' },
					'analyse-avis': { team: 'Relation client', text: 'Des avis lus et classés par l’IA.' },
				},
				ask: {
					title: 'Autre chose en tête ?',
					text: 'Décrivez votre besoin en une phrase : l’IA vous propose une base sur mesure.',
					href: '/modeles/',
				},
				all: 'Tous les modèles',
			},
			developers: {
				label: 'Développeurs',
				groups: {
					build: {
						title: 'Intégrer',
						items: {
							api: {
								href: '/integrations/api-rest/',
								title: 'API REST',
								text: 'Les mêmes données que l’interface, décrites en OpenAPI 3.1.',
							},
							mcp: {
								href: '/integrations/mcp/',
								title: 'Serveur MCP',
								text: 'Des outils pour vos agents IA, sous vos droits.',
							},
							webhooks: {
								href: '/integrations/webhooks/',
								title: 'Webhooks',
								text: 'Chaque écriture, signée, ordonnée, réessayée.',
							},
							sql: {
								href: '/integrations/sql/',
								title: 'SQL direct',
								text: 'De vraies tables PostgreSQL, nommées en clair.',
							},
							sync: {
								href: '/integrations/synchronisation/',
								title: 'Synchronisation',
								text: 'Des tables tenues à jour depuis ailleurs.',
							},
						},
					},
					host: {
						title: 'Héberger',
						items: {
							docker: {
								href: '/hebergement/docker/',
								title: 'Docker Compose',
								text: 'Une image, une base PostgreSQL, un seul port.',
							},
							env: {
								href: '/hebergement/variables/',
								title: 'Variables',
								text: 'Tout se règle dans le fichier .env.',
							},
							https: {
								href: '/hebergement/https/',
								title: 'Domaine et HTTPS',
								text: 'Derrière votre proxy, ou avec le Caddy fourni.',
							},
							sso: {
								href: '/hebergement/connexion/',
								title: 'Connexion et SSO',
								text: 'Google, Microsoft, tout fournisseur OpenID Connect.',
							},
							backup: {
								href: '/hebergement/sauvegardes/',
								title: 'Sauvegardes et mises à jour',
								text: 'pg_dump, et des mises à jour sans perte.',
							},
						},
					},
				},
				/** The card beside the panel: the page for developers. */
				feature: {
					title: 'La page des développeurs',
					text: 'Une vraie table PostgreSQL derrière chaque grille.',
					href: '/developpeurs/',
				},
			},
			resources: {
				label: 'Ressources',
				groups: {
					learn: {
						title: 'Apprendre',
						items: {
							docs: {
								href: '/guides/introduction/',
								title: 'Documentation',
								text: 'Tout basedb, pas à pas.',
							},
							start: {
								href: '/guides/premiers-pas/',
								title: 'Premiers pas',
								text: 'Une première base, de l’import à la vue.',
							},
							install: {
								href: '/guides/installation/',
								title: 'Installation',
								text: 'Deux fichiers et une commande.',
							},
							principles: {
								href: '/architecture/principes/',
								title: 'Les principes',
								text: 'Comment basedb est construit, et pourquoi.',
							},
						},
					},
					follow: {
						title: 'Suivre le projet',
						items: {
							news: {
								href: '/nouveautes/',
								title: 'Nouveautés',
								text: 'Ce qui a changé, version après version.',
							},
							roadmap: {
								href: '/feuille-de-route/',
								title: 'Feuille de route',
								text: 'Ce qui vient ensuite.',
							},
							github: {
								href: 'https://github.com/eodia/basedb',
								title: 'GitHub',
								text: 'Le code, les tickets, les versions.',
							},
							eodia: {
								href: 'https://eodia.com/fr/',
								title: 'Eodia',
								text: 'Le studio qui fait basedb.',
							},
						},
					},
				},
			},
		},
	},

	/** The language picker. `{name}`: the current language, by its own name. */
	language: {
		label: 'Langue',
		current: 'Langue : {name}',
	},

	footer: {
		tagline: 'La base collaborative dont chaque table est une vraie table PostgreSQL.',
		/** HTML. */
		madeBy: 'Un logiciel libre d’<a class="eodia" href="https://eodia.com/fr/">Eodia</a>, studio de logiciel IA-natif.',
		columns: {
			product: {
				title: 'Produit',
				links: [
					{ href: '/#fonctionnalites', label: 'Fonctionnalités' },
					{ href: '/nouveautes/', label: 'Nouveautés' },
					{ href: '/feuille-de-route/', label: 'Feuille de route' },
					{ href: '/#faq', label: 'Questions fréquentes' },
				],
			},
			docs: {
				title: 'Documentation',
				links: [
					{ href: '/guides/introduction/', label: 'Introduction' },
					{ href: '/guides/installation/', label: 'Installation' },
					{ href: '/integrations/api-rest/', label: 'API REST' },
					{ href: '/integrations/mcp/', label: 'Serveur MCP' },
				],
			},
			hosting: {
				title: 'Hébergement',
				links: [
					{ href: '/hebergement/docker/', label: 'Docker Compose' },
					{ href: '/hebergement/variables/', label: 'Variables d’environnement' },
					{ href: '/hebergement/https/', label: 'Domaine et HTTPS' },
					{ href: '/hebergement/sauvegardes/', label: 'Sauvegardes' },
				],
			},
			project: {
				title: 'Projet',
				links: [
					{ href: 'https://github.com/eodia/basedb', label: 'GitHub' },
					{ href: 'https://github.com/eodia/basedb/tree/main/docs/architecture', label: 'Document d’architecture' },
					{ href: 'https://github.com/eodia/basedb/blob/main/LICENSE', label: 'Licence AGPL-3.0' },
					{ href: 'https://github.com/eodia/basedb/issues', label: 'Signaler un problème' },
				],
			},
			eodia: {
				title: 'Eodia',
				links: [
					{ href: 'https://eodia.com/fr/', label: 'Le studio' },
					{ href: 'https://eodia.com/fr/about/', label: 'À propos' },
					{ href: 'https://eodia.com/fr/contact/', label: 'Nous contacter' },
				],
			},
		},
		/** HTML; `{year}`: the current year. */
		copyright: '© {year} <a href="https://eodia.com/fr/">Eodia</a> · AGPL-3.0-or-later',
		builtWith: 'Site construit avec Astro et Starlight.',
	},

	/** Under every page of the documentation. HTML. */
	docsFooter: {
		madeBy: 'basedb est un logiciel libre d’<a href="https://eodia.com/fr/">Eodia</a>, studio de logiciel IA-natif.',
	},

	/**
	 * The home page (`/`), for the people who will use basedb — no code, no SQL — told the
	 * way a product keynote is: one idea per screen, and the product doing the talking. The
	 * page for developers is `/developpeurs/`: it reads `meta.home`, `hero`, `showcase`,
	 * `features`, `bento`, `selfHost`, `faq` and `cta`, below.
	 */
	teams: {
		meta: {
			title: 'basedb — tout votre travail, au même endroit',
			description:
				'Clients, projets, stocks, candidatures : une base que toute l’équipe modifie en même temps, en tableau, en kanban ou en calendrier, avec des tableaux de bord, des automatisations et l’IA. Sans code, libre et gratuit.',
		},

		/** The first screen: the headline, over the window the scroll then opens. */
		hero: {
			eyebrow: 'basedb',
			/** The headline, on two lines; the second is drawn in the gradient. */
			title: 'Tout votre travail.',
			titleAccent: 'Enfin au même endroit.',
			lead: 'Tableaux, calendriers, formulaires, tableaux de bord et automatisations, pour toute l’équipe. Aussi simple qu’un tableur. Sans une ligne de code.',
			primary: 'Découvrir les modèles',
			/** Plays the demonstration film, further down. */
			secondary: 'Regarder la démo',
			facts: ['Sans code', 'Libre et gratuit', 'Vos données restent chez vous'],
		},

		/**
		 * The story the scroll tells over the window (`stage`): one caption per view, in this
		 * order — the table, the Copilot asked about it, the kanban, the calendar, the dashboard.
		 */
		story: {
			grid: {
				title: 'Toute l’équipe, dans la même table.',
				text: 'Chacun y travaille en même temps, et tout le monde voit la même chose, à jour.',
			},
			copilot: {
				title: 'Demandez. Le Copilot s’en charge.',
				text: '« Qui dois-je relancer cette semaine ? » — il vous propose le bon filtre, et vous l’appliquez d’un clic.',
			},
			kanban: {
				title: 'Glissez. C’est à jour.',
				text: 'Chaque étape devient une colonne ; déplacer une carte, c’est modifier la ligne.',
			},
			calendar: {
				title: 'Chaque date à sa place.',
				text: 'Les rendez-vous s’affichent d’eux-mêmes, et se suivent jusque dans votre agenda.',
			},
			dashboard: {
				title: 'Et tout, d’un coup d’œil.',
				text: 'Les chiffres se calculent seuls, à partir des mêmes lignes.',
			},
		},

		/**
		 * The window of the story: a team's client follow-up, drawn as basedb draws it — the
		 * same seven rows as a table, filtered by the Copilot, a kanban, a calendar, a
		 * dashboard.
		 */
		stage: {
			aria: 'Le suivi des clients d’une équipe dans basedb : tableau, Copilot, kanban, calendrier, tableau de bord',
			/** The bars under the window, one per view. */
			tabs: {
				grid: 'Tableau',
				copilot: 'Copilot',
				kanban: 'Kanban',
				calendar: 'Calendrier',
				dashboard: 'Tableau de bord',
			},
			/** The sidebar. */
			project: 'Projet principal',
			projectMeta: 'Projet · 2 bases',
			filterNav: 'Filtrer la navigation',
			base: 'Ventes',
			otherBase: 'Support',
			tables: ['Clients', 'Contacts', 'Devis'],
			baseSection: 'Base · Ventes',
			screens: ['Tableaux de bord', 'Automatisations'],
			user: 'Léa Martin',
			/** The toolbar: each view's name, and the tools. */
			views: { grid: 'Toutes les lignes', kanban: 'Par étape', calendar: 'Rendez-vous' },
			toolbar: {
				filter: 'Filtrer',
				columns: 'Colonnes',
				group: 'Grouper',
				colors: 'Couleurs',
				sort: 'Trier',
				configure: 'Configurer',
			},
			search: 'Rechercher…',
			add: 'Ajouter',
			/** The table. */
			columns: { name: 'Client', status: 'Étape', owner: 'Suivi par', amount: 'Montant', next: 'Prochain rendez-vous' },
			statuses: { contact: 'À contacter', meeting: 'Rendez-vous', quote: 'Devis envoyé', signed: 'Signé' },
			/** The clients, in the table's order. */
			clients: [
				'Boulangerie Martin',
				'Clinique des Tilleuls',
				'Lycée Jean Moulin',
				'Vélo Solidaire',
				'L’Épicerie fine',
				'Forges du Rhône',
				'Atelier Moreau',
			],
			addRow: 'Ajouter un enregistrement',
			perPage: 'Lignes par page',
			/** The kanban: a card's description — `{owner}` and `{date}`, the row's values, in bold. */
			card: 'Suivi par {owner}, rendez-vous le {date}',
			addCard: 'Ajouter une carte',
			/** The calendar. */
			today: 'Aujourd’hui',
			month: 'Mois',
			week: 'Semaine',
			/** The dashboard's screen. */
			dashboards: 'Tableaux de bord',
			questions: 'Questions',
			dashboard: 'Suivi commercial',
			dashboardText: 'L’essentiel en un coup d’œil.',
			dashboardTabs: ['Vue d’ensemble', 'Activité'],
			period: 'Période',
			thisYear: 'Cette année',
			share: 'Partager',
			edit: 'Modifier',
			explore: 'Explorer les données',
			chart: 'Montant par client',
			byStage: 'Clients par étape',
			kpis: { signed: 'Signé', pending: 'Devis en attente', rate: 'Clients signés' },
			/** The Copilot, asked who to call back; `filtered`: the toolbar once its filter is on. */
			copilot: {
				question: 'Qui dois-je relancer cette semaine ?',
				thinking: 'Réflexion…',
				answer: 'Quatre clients attendent une réponse : deux devis envoyés et deux rendez-vous à préparer.',
				card: 'Filtrer Clients',
				filter: 'Étape : Devis envoyé ou Rendez-vous',
				apply: 'Appliquer le filtre',
				applied: 'Filtre appliqué',
				placeholder: 'Demandez au Copilot…',
				filtered: '{n} lignes filtrées',
			},
		},

		/**
		 * The demonstration film, after the story: its chapters are its own (they follow the
		 * film's timeline — `time`, in minutes and seconds, is where each one starts).
		 */
		video: {
			eyebrow: 'La démo',
			title: 'Tout basedb,',
			titleAccent: 'en quatre minutes.',
			text: 'Créer une base, la remplir, la partager, l’automatiser, la piloter : la visite complète, commentée.',
			play: 'Lire la vidéo',
			duration: '4 min 35',
			chapters: 'Chapitres',
			/** The label of the subtitles, in the player. */
			captions: 'Français',
			/** Said in every language but French: the film is in French. */
			inFrench: 'La vidéo est en français, avec des sous-titres en français.',
			list: [
				{ time: '0:08', title: 'Créer une base' },
				{ time: '0:35', title: 'Tables, champs et formules' },
				{ time: '1:10', title: 'Fiches et collaboration' },
				{ time: '1:33', title: 'Huit vues sur les mêmes lignes' },
				{ time: '2:01', title: 'Formulaires et IA' },
				{ time: '2:37', title: 'Automatisations' },
				{ time: '2:59', title: 'Tableaux de bord' },
				{ time: '3:15', title: 'Du SQL pour chacun' },
				{ time: '3:43', title: 'Historique et droits' },
				{ time: '4:01', title: 'API, MCP et Copilot' },
			],
		},

		/** Several people in one table, live — the scene plays in the application's dark theme. */
		together: {
			eyebrow: 'Collaboration',
			title: 'Tout le monde.',
			titleAccent: 'En même temps.',
			text: 'Les modifications des autres arrivent en direct. On voit qui regarde quelle ligne, on en discute là où elle se trouve, et un @ suffit pour prévenir un collègue.',
			/** The table the scene plays in. */
			demo: {
				path: 'Ventes / Devis',
				here: '3 personnes sur cette table',
				columns: { client: 'Client', status: 'Étape', amount: 'Montant', due: 'Échéance' },
				statuses: { draft: 'Brouillon', sent: 'Envoyé', signed: 'Signé' },
				rows: ['Boulangerie Martin', 'Clinique des Tilleuls', 'Lycée Jean Moulin', 'Vélo Solidaire', 'L’Épicerie fine', 'Forges du Rhône'],
				/** `{name}`: the colleague mentioned. */
				comment: '@{name} tu peux valider ce devis avant ce soir ?',
				reply: 'C’est validé !',
				/** `{name}`: who changed it; `{field}`: what. */
				toast: '{name} a modifié « {field} »',
			},
			points: {
				live: {
					title: 'En direct',
					text: 'Chaque modification apparaît aussitôt chez les autres, sans recharger la page.',
				},
				comments: {
					title: 'Commentaires et mentions',
					text: 'On commente une ligne, on mentionne un collègue avec @, et la cloche le prévient.',
				},
				undo: {
					title: 'Annuler sans risque',
					text: 'Ctrl+Z annule votre dernière modification — jamais celle d’un collègue.',
				},
			},
			link: { href: '/fonctionnalites/collaboration/', label: 'Travailler à plusieurs' },
		},

		/** An automation that runs step by step as the reader scrolls — at night. */
		automate: {
			eyebrow: 'Automatisations',
			title: 'Il travaille',
			titleAccent: 'pendant que vous dormez.',
			text: 'Décrivez une fois ce qui doit se passer. Quand une ligne change, chaque matin à heure fixe ou d’un clic sur un bouton, basedb enchaîne les étapes — et chaque exécution se relit, étape par étape.',
			/** The time on the clock over the flow: the middle of the night. */
			clock: '03:12',
			when: 'Quand',
			trigger: 'un devis passe à « Signé »',
			steps: {
				find: { kind: 'Chercher une ligne', text: 'Le client du devis' },
				ai: { kind: 'Demander à l’IA', text: 'Rédiger un mot de remerciement' },
				create: { kind: 'Créer une ligne', text: 'La facture, dans Factures' },
				notify: { kind: 'Prévenir quelqu’un', text: 'La comptabilité' },
				slack: { kind: 'Envoyer sur Slack', text: 'Dans le canal #ventes' },
			},
			/** What the AI step writes. */
			answer: 'Merci pour votre confiance ! Nous lançons votre projet dès lundi, et votre facture suit par e-mail.',
			done: 'Réussie · 5 étapes · 1,2 s',
			/** A sentence to the Copilot, and what it does with it. */
			copilot: {
				prompt: 'Quand un devis est signé, préviens la compta et crée la facture.',
				text: 'Une phrase au Copilot, et l’automatisation est construite : vous n’avez plus qu’à relire.',
			},
			link: { href: '/fonctionnalites/automatisations/', label: 'Les automatisations' },
		},

		/** A dashboard, filling up as it comes into view. */
		glance: {
			eyebrow: 'Tableaux de bord',
			title: 'Voyez tout.',
			titleAccent: 'D’un coup d’œil.',
			text: 'Des chiffres, des courbes, des objectifs : vos tableaux de bord se construisent à la souris à partir de vos tables, et restent à jour tout seuls. Un filtre, et tout le tableau suit.',
			demo: {
				title: 'Pilotage commercial',
				filters: ['Cette année', 'Toutes les villes'],
				revenue: 'Chiffre d’affaires',
				signed: 'Devis signés',
				rate: 'Taux de signature',
				goal: 'Objectif annuel',
				byMonth: 'Chiffre d’affaires par mois',
				byStage: 'Devis par étape',
				stages: ['Envoyés', 'En discussion', 'Signés'],
				bySector: 'Clients par secteur',
				sectors: ['Commerce', 'Santé', 'Éducation', 'Industrie'],
				shared: 'Partagé par lien',
			},
			points: {
				viz: {
					title: 'Quinze visualisations',
					text: 'Chiffres, tendances, objectifs, courbes, secteurs, entonnoirs, tableaux croisés, cartes.',
				},
				filters: {
					title: 'Des filtres communs',
					text: 'La période, un client, une ville : un filtre pilote une carte, plusieurs, ou tout le tableau.',
				},
				share: {
					title: 'Partagé d’un lien',
					text: 'Public ou réservé à l’équipe, et intégrable à un autre site.',
				},
			},
			link: { href: '/fonctionnalites/tableaux-de-bord/', label: 'Les tableaux de bord' },
		},

		/** The AI drafting a base from a sentence. */
		ai: {
			eyebrow: 'Intelligence artificielle',
			title: 'Décrivez.',
			titleAccent: 'basedb construit.',
			text: 'Une phrase suffit pour obtenir une base complète, que vous relisez avant de la créer. Ensuite, le Copilot propose filtres, graphiques et automatisations, et les champs IA résument, classent et rédigent à votre place.',
			prompt: 'Un suivi des candidatures pour nos trois postes ouverts, avec les entretiens.',
			thinking: 'Trois tables reliées, prêtes à relire.',
			tables: {
				jobs: { name: 'Postes', fields: ['Intitulé', 'Service', 'Ouvert le'] },
				people: { name: 'Candidats', fields: ['Nom', 'Poste', 'Étape', 'Synthèse'] },
				talks: { name: 'Entretiens', fields: ['Candidat', 'Date', 'Avec', 'Avis'] },
			},
			/** The AI field of the draft, and what it writes for a first candidate. */
			aiField: 'Synthèse',
			aiValue: 'Six ans en gestion de projet, à l’aise avec les clients ; à creuser : l’anglais.',
			create: 'Créer la base',
			providers:
				'Avec le fournisseur de votre choix — OpenAI, Anthropic, Mistral, ou un modèle installé chez vous. Rien ne part sans votre accord.',
			link: { href: '/fonctionnalites/ia/', label: 'L’IA dans basedb' },
		},

		/**
		 * The features, tile by tile — what each one does, in a sentence. The tiles show in
		 * this order; `stat`, `code` and `bubble` are what a tile shows large.
		 */
		features: {
			title: 'Tout ce qu’il faut.',
			titleAccent: 'Et bien plus encore.',
			text: 'Chaque fonction écrit dans les mêmes tables, avec les mêmes droits, dans le même historique.',
			tiles: {
				views: tile({
					stat: '8',
					title: 'façons de voir vos données',
					text: 'Grille, kanban, calendrier, chronologie, galerie, liste, formulaire et questionnaire, sur les mêmes lignes. Chacun choisit la sienne.',
					href: '/fonctionnalites/vues/',
				}),
				history: tile({
					stat: 'Ctrl+Z',
					title: 'Rien ne se perd',
					text: 'Chaque modification est gardée avec la valeur d’avant ; une erreur s’annule, une ligne supprimée se restaure.',
					href: '/fonctionnalites/historique/',
				}),
				forms: tile({
					title: 'Formulaires',
					text: 'Un lien public ou réservé à l’équipe : chaque réponse arrive dans la table, sans ouvrir le reste.',
					href: '/fonctionnalites/formulaires-partages/',
				}),
				viz: tile({
					stat: '15',
					title: 'visualisations',
					text: 'Chiffres, tendances, objectifs, courbes, secteurs, entonnoirs, tableaux croisés et cartes.',
					href: '/fonctionnalites/tableaux-de-bord/',
				}),
				formulas: tile({
					code: 'SI([Montant] > 10000; "Grand compte"; "")',
					title: 'Formules en français',
					text: 'Comme dans un tableur — SI, ARRONDI, JOURS… — mais calculées pour toute l’équipe.',
					href: '/fonctionnalites/tables-et-champs/#formules',
				}),
				rights: tile({
					title: 'Chacun voit ce qu’il doit voir',
					text: 'Lecture, édition, gestion, équipe par équipe ; une colonne sensible peut être masquée.',
					href: '/fonctionnalites/droits/',
				}),
				mentions: tile({
					bubble: '@Camille',
					title: 'Commentaires et mentions',
					text: 'On discute d’une ligne là où elle se trouve, et la cloche prévient.',
					href: '/fonctionnalites/collaboration/',
				}),
				relations: tile({
					title: 'Tout est relié',
					text: 'Clients, projets, factures : les totaux et les recherches traversent les relations.',
					href: '/fonctionnalites/tables-et-champs/',
				}),
				templates: tile({
					stat: '10',
					title: 'modèles prêts',
					text: 'CRM, recrutement, stocks, événements… ou une base décrite en une phrase à l’IA.',
					href: '/modeles/',
				}),
				import: tile({
					title: 'Import en un geste',
					text: 'Glissez un fichier CSV : colonnes et types sont devinés, la table est créée.',
					href: '/guides/premiers-pas/',
				}),
				agenda: tile({
					title: 'Jusque dans votre agenda',
					text: 'Un calendrier devient un flux pour Google Agenda, Outlook ou Apple Calendar.',
					href: '/fonctionnalites/vues-partagees/',
				}),
				files: tile({
					title: 'Fichiers et images',
					text: 'Devis, photos, contrats ; une image devient la couverture d’une carte.',
					href: '/fonctionnalites/fichiers/',
				}),
				share: tile({
					title: 'Vues partagées',
					text: 'Une vue en lecture seule par un lien, intégrable à votre site.',
					href: '/fonctionnalites/vues-partagees/',
				}),
				sync: tile({
					title: 'Tables synchronisées',
					text: 'Tenues à jour depuis un CSV en ligne, un agenda ou un autre basedb.',
					href: '/integrations/synchronisation/',
				}),
				signin: tile({
					title: 'Connexion simple',
					text: 'Google, Microsoft ou mot de passe ; on invite ses collègues par un lien.',
					href: '/hebergement/connexion/',
				}),
				languages: tile({
					title: 'Dans votre langue',
					text: 'L’interface prend la langue de chacun, parmi vingt.',
					href: '/fonctionnalites/droits/#vos-paramètres',
				}),
			},
		},

		/** Free, and at home. */
		yours: {
			eyebrow: 'Libre et auto-hébergé',
			/** Under the price — zero, written in the reader's language. */
			per: 'par personne. Pour toujours.',
			text: 'basedb est un logiciel libre. Installez-le sur votre serveur et invitez toute l’équipe : pas d’abonnement, pas de licence à compter, et vos données restent chez vous.',
			points: {
				home: {
					title: 'Chez vous',
					text: 'Sur votre serveur ou celui de votre hébergeur, sauvegardé comme toute base PostgreSQL.',
				},
				free: {
					title: 'Libre',
					text: 'Sous licence AGPL-3.0 : le code est ouvert, et il le restera.',
				},
				ai: {
					title: 'L’IA de votre choix',
					text: 'Un fournisseur du marché, un modèle installé chez vous — ou pas d’IA du tout.',
				},
			},
			link: { href: '/guides/installation/', label: 'Installer basedb' },
		},

		/** The templates, in a row one scrolls sideways. */
		gallery: {
			eyebrow: 'Modèles',
			title: 'Prêt en une minute.',
			text: 'Partez d’un modèle, avec ses tables, ses vues, son tableau de bord et des lignes d’exemple, puis adaptez-le à votre façon de travailler.',
			use: 'Découvrir',
			ask: {
				title: 'Rien ne correspond ?',
				text: 'Décrivez votre besoin en une phrase : l’IA vous propose une base sur mesure.',
			},
			all: 'Voir tous les modèles',
			previous: 'Modèles précédents',
			next: 'Modèles suivants',
		},

		developers: {
			title: 'Et côté technique ?',
			text: 'Chaque table est une vraie table PostgreSQL. API REST, webhooks, serveur MCP pour les agents IA, et une installation en une commande.',
			link: 'La page des développeurs',
		},

		faq: {
			title: 'Vos questions',
			items: [
				{
					q: 'Faut-il savoir coder ?',
					a: 'Non. On crée ses tables, ses vues, ses formulaires, ses tableaux de bord et ses automatisations à la souris. Les formules s’écrivent en français, comme dans un tableur : SI, ARRONDI, JOURS…',
				},
				{
					q: 'Combien ça coûte ?',
					a: 'Rien : basedb est un logiciel libre, sans abonnement ni prix par personne. Il vous faut seulement un serveur où l’installer.',
				},
				{
					q: 'Comment l’installe-t-on ?',
					a: 'Sur un serveur, avec Docker : deux fichiers et une commande, quelques minutes pour la personne qui s’occupe de votre informatique. Le guide d’installation explique tout, pas à pas.',
				},
				{
					q: 'Peut-on reprendre nos tableurs ?',
					a: 'Oui : enregistrez votre feuille en CSV et glissez-la dans basedb. L’import devine le type de chaque colonne, crée la table, et dit ligne par ligne ce qu’il n’a pas pu reprendre.',
				},
				{
					q: 'Peut-on travailler à plusieurs en même temps ?',
					a: 'C’est fait pour. Les modifications des autres s’affichent en direct, on commente une ligne, on mentionne un collègue avec @, et une cloche prévient.',
				},
				{
					q: 'Et l’IA, elle lit nos données ?',
					a: 'Seulement si vous le décidez. Sans fournisseur d’IA configuré, rien ne part. Ensuite, un champ ou une automatisation qui fait appel à l’IA n’envoie que ce que sa consigne cite, après votre accord.',
				},
				{
					q: 'Dans quelle langue ?',
					a: 'Dans la vôtre : l’interface prend la langue de votre navigateur, parmi vingt, et chacun peut la changer dans ses paramètres.',
				},
			],
		},

		cta: {
			title: 'Votre équipe mérite mieux',
			titleAccent: 'qu’un fichier partagé.',
			text: 'Partez d’un modèle, invitez vos collègues, et laissez les « FINAL (2) » derrière vous.',
			primary: 'Découvrir les modèles',
			secondary: 'Installer basedb',
		},
	},

	hero: {
		badge: 'Nouveau : automatisations en flux, tableaux de bord et vues SQL',
		/** The title, line by line; the last line is written in the accent hand. */
		title: ['La base collaborative', 'où chaque table est', 'une vraie table'],
		titleAccent: 'PostgreSQL.',
		/** HTML. */
		lead: 'La simplicité d’un tableur partagé — grilles, vues, formulaires, droits — et des données qui vivent dans des tables <strong>typées et nommées en clair</strong>. Votre équipe travaille dans l’interface ; vos scripts, vos outils de BI, vos agents IA et <code>psql</code> lisent les mêmes lignes.',
		install: 'Installer avec Docker',
		features: 'Voir les fonctionnalités',
		copy: 'Copier la commande',
		facts: ['Auto-hébergé', 'AGPL-3.0', 'API REST & serveur MCP'],
		/** The interface drawn beside the title. */
		demo: {
			url: 'basedb.votre-domaine.fr',
			project: 'Projet principal',
			projectMeta: 'Projet · 2 bases',
			filter: 'Filtrer les bases et les tables',
			sales: 'Ventes',
			support: 'Support',
			environment: 'Production',
			clients: 'Clients',
			opportunities: 'Opportunités',
			quotes: 'Devis',
			baseSection: 'Base · Ventes',
			screens: ['Tableaux de bord', 'Automatisations'],
			copilot: '✦ Copilot',
			allRows: '▦ Toutes les lignes ▾',
			tools: ['Filtrer', 'Grouper', 'Couleurs'],
			search: 'Rechercher…',
			add: '+ Ajouter',
			columns: { name: 'Nom', status: 'Statut', amount: 'Montant', client: 'Client' },
			statuses: {
				nouveau: 'Nouveau',
				qualifie: 'Qualifié',
				proposition: 'Proposition',
				negociation: 'Négociation',
				gagne: 'Gagné',
				perdu: 'Perdu',
			},
			/** The opportunities of the grid, and their clients. psql shows the names too. */
			deals: {
				portail: { name: 'Refonte du portail', client: 'Mairie de Vannes' },
				erp: { name: 'Migration ERP', client: 'Groupe Delorme' },
				audit: { name: 'Audit de sécurité', client: 'Clinique Saint-Roch' },
				billetterie: { name: 'Billetterie en ligne', client: 'Théâtre du Rond-Point' },
				flotte: { name: 'Suivi de flotte', client: 'Transports Kerlann' },
				mobile: { name: 'Application mobile', client: 'Atelier Moreau' },
				intranet: { name: 'Refonte de l’intranet', client: '' },
			},
			toastTitle: 'Formulaire « Demande de devis »',
			/** `{name}`: the opportunity the form created. */
			toastText: 'réponse publique · a créé « {name} »',
			cursor: 'Camille',
			/** What psql prints under its result. */
			psqlRows: '(2 lignes)',
		},
	},

	showcase: {
		label: 'L’interface, pour de vrai',
		title: 'Tout ce que votre équipe attend d’un tableur partagé.',
		tabs: 'Captures de l’interface',
		/** A screenshot's alternative text: `{label}` (or `{labelLower}`), `{caption}`. */
		alt: 'basedb — {labelLower} : {caption}',
		shots: {
			grille: shot({
				label: 'Grille',
				caption:
					'Une grille qui écrit dans une vraie table — et des champs calculés : une durée par formule, la ville du client par recherche, le nombre de tâches par décompte.',
			}),
			kanban: shot({
				label: 'Kanban',
				caption:
					'Les mêmes lignes en colonnes, selon une liste de choix : une image de couverture, une description qui cite la ligne. Glisser une carte, c’est modifier la ligne.',
			}),
			galerie: shot({
				label: 'Galerie',
				caption: 'Des cartes avec leur image, une couleur par statut : la galerie, l’une des huit façons de lire une table.',
			}),
			chronologie: shot({
				label: 'Chronologie',
				caption: 'Des barres entre deux dates, et les flèches de leurs dépendances — en rouge quand l’ordre ne tient plus.',
			}),
			tableaux: shot({
				label: 'Tableaux de bord',
				caption:
					'Des cartes en grille, en onglets, sous des filtres communs : une tendance, un objectif, des séries empilées — lues avec les droits de chacun.',
			}),
			automatisations: shot({
				label: 'Automatisations',
				caption:
					'Quand une tâche est faite, chercher ce qui reste du projet ; s’il ne reste rien, l’IA rédige le mot de bilan et le projet passe à « Livré ». Chaque exécution se lit sur le flux, étape par étape.',
			}),
			commentaires: shot({
				label: 'Commentaires',
				caption: 'On discute d’une ligne là où elle se trouve : commentaires, mentions, notifications.',
			}),
			formulaire: shot({
				label: 'Formulaire',
				caption: 'Un formulaire se partage par un lien, public ou réservé aux membres connectés.',
			}),
			historique: shot({
				label: 'Historique',
				caption:
					'Chaque écriture, d’où qu’elle vienne — une personne, une automatisation, le SQL direct — avec les valeurs d’avant.',
			}),
			sql: shot({
				label: 'SQL',
				caption:
					'Une requête sur les vrais noms, enregistrée sous les tables pour toute l’équipe — que chacun exécute avec ses propres droits.',
			}),
			vuesSql: shot({
				label: 'Vues SQL',
				caption:
					'De vraies vues PostgreSQL, rangées parmi les tables avec leur couleur et leur pictogramme — et lisibles depuis psql.',
			}),
		},
	},

	/** The five blocks of the home page, in this order. */
	features: {
		postgres: feature({
			label: 'PostgreSQL, sans traduction',
			title: 'Une grille pour l’équipe, une vraie table {pour vos outils.}',
			lead: 'Pas de modèle générique, pas de JSON fourre-tout, pas de <code>field_1837</code> : une base est un schéma, une table est une table, un champ est une colonne typée, nommée en clair.',
			bullets: [
				'<strong>Des types natifs</strong> : <code>text</code>, <code>numeric</code>, <code>date</code>, <code>timestamptz</code>, <code>boolean</code> — et de vraies clés étrangères pour les relations.',
				'<strong>Des contraintes tenues par la base</strong> : listes de choix en <code>CHECK</code>, adresses web et e-mails vérifiés, relations en <code>FOREIGN KEY</code>.',
				'<strong>Des formules calculées par PostgreSQL</strong> : <code>JOURS([Fin]; [Début])</code> devient une colonne générée, que <code>psql</code> lit comme les autres.',
				'<strong>Le SQL direct reste permis</strong> — et même lui est historisé, par déclencheur.',
				'<strong>Des requêtes et des vues SQL</strong> dans l’interface : des requêtes enregistrées sous les tables, pour soi ou pour l’équipe, et de vraies vues PostgreSQL rangées parmi elles, que <code>psql</code> lit aussi.',
				'<strong>Renommer n’est pas casser</strong> : l’ancien nom reste servi par un alias de compatibilité le temps de migrer vos requêtes.',
			],
			links: [
				{ href: '/integrations/sql/', label: 'Travailler en SQL' },
				{ href: '/fonctionnalites/requetes-et-vues-sql/', label: 'Requêtes et vues SQL' },
				{ href: '/architecture/principes/', label: 'Les principes' },
			],
		}),
		automations: feature({
			label: 'Automatiser',
			title: 'Des automatisations en flux, {l’IA à chaque étape.}',
			lead: 'Quand une ligne change, à heure fixe ou d’un clic : un éditeur en graphe enchaîne les étapes, et chaque exécution se relit sur le flux.',
			bullets: [
				'<strong>Un flux lisible</strong> : le déclencheur, puis chaque étape en carte ; un <strong>+</strong> sur un trait ajoute une étape à cet endroit.',
				'<strong>Chercher, décider, écrire</strong> : trouver une ligne, prendre un chemin ou un autre selon des conditions, modifier, créer, prévenir, appeler un webhook, écrire sur Slack.',
				'<strong>Demander à l’IA</strong> dans une étape : une consigne qui cite la ligne, une réponse lue comme texte, nombre, date ou choix, que les étapes suivantes réutilisent.',
				'<strong>Le Copilot</strong> propose une automatisation entière à partir d’une phrase, ou explique pourquoi une exécution a échoué — rien ne s’enregistre sans vous.',
				'<strong>Avec les droits de qui l’a écrite</strong>, et dans l’historique comme toute autre écriture.',
			],
			links: [
				{ href: '/fonctionnalites/automatisations/', label: 'Les automatisations' },
				{ href: '/fonctionnalites/automatisations/#le-copilot', label: 'Le Copilot' },
			],
			alt: 'basedb — l’automatisation « Projet livré » dans l’éditeur en flux : quand une tâche est faite, noter l’heure, chercher ce qui reste du projet, prendre le chemin « Sinon », demander à l’IA le mot de bilan, puis livrer le projet ; à droite, ses dernières exécutions, étape par étape.',
		}),
		dashboards: feature({
			label: 'Analyser',
			title: 'Des tableaux de bord {sans quitter vos tables.}',
			lead: 'Des questions posées à la souris ou en SQL, quinze visualisations, des filtres communs — chacun les lit avec ses propres droits.',
			bullets: [
				'<strong>Des questions</strong> : une table, ses jointures, des filtres et des mesures par jour, semaine, mois ou année — ou du SQL en lecture seule.',
				'<strong>Quinze visualisations</strong> : chiffre, tendance, objectif, jauge, barres, courbes, secteurs, entonnoir, tableau croisé, carte…',
				'<strong>Explorer d’un clic</strong> : un point ouvre ses lignes, ou une période plus fine.',
				'<strong>Des filtres communs</strong> qui pilotent une, plusieurs ou toutes les cartes.',
				'<strong>Partager par un lien</strong>, public ou réservé aux membres, et intégrer à un autre site.',
			],
			links: [{ href: '/fonctionnalites/tableaux-de-bord/', label: 'Les tableaux de bord' }],
			alt: 'basedb — un tableau de bord : tendance du mois, objectif d’encaissement, chiffre d’affaires par mois, sentiment des avis, sous des filtres de période et de client.',
		}),
		rights: feature({
			label: 'Collaborer sans tout ouvrir',
			title: 'Des droits jusqu’au champ, {un historique sans trou.}',
			lead: 'Les droits s’accordent à des groupes, sur un projet, une base ou une table, et descendent sur tout ce qui est dessous. Une colonne sensible peut être masquée à un groupe, ou rendue non modifiable pour lui.',
			bullets: [
				'<strong>Quatre niveaux</strong> : Aucun accès, Lecture, Édition, Gestion — additifs d’un groupe à l’autre.',
				'<strong>Même le SQL suit vos droits</strong> : dans l’interface, une requête ne voit que les tables et les champs qui vous sont ouverts — c’est PostgreSQL qui l’applique.',
				'<strong>Chaque écriture est capturée</strong> dans sa transaction : interface, API, agent, formulaire public ou SQL direct.',
				'<strong>Une modification s’annule</strong>, une ligne supprimée se restaure, une base supprimée aussi.',
				'<strong>L’administration se confirme</strong> : changer un droit demande d’avoir retapé son mot de passe dans les cinq dernières minutes.',
			],
			links: [
				{ href: '/fonctionnalites/droits/', label: 'Droits et groupes' },
				{ href: '/fonctionnalites/historique/', label: 'L’historique' },
			],
		}),
		agents: feature({
			label: 'API REST · MCP · webhooks',
			title: 'Vos agents IA accèdent aux données, {pas aux clés du château.}',
			lead: 'Le serveur MCP donne douze outils aux agents ; l’API REST, les mêmes données à vos programmes. Un seul point de contrôle des droits, les mêmes journaux.',
			bullets: [
				'<strong>Un jeton par base</strong>, en lecture seule par défaut, jamais plus de droits que la personne qui l’a créé.',
				'<strong>Un agent ne supprime rien</strong> et ne change pas la structure : il la propose, une personne approuve.',
				'<strong>Une documentation générée</strong> pour chaque base, filtrée par vos droits, avec sa spécification OpenAPI 3.1.',
				'<strong>Des webhooks</strong> signés, ordonnés et réessayés à chaque écriture.',
			],
			links: [
				{ href: '/integrations/mcp/', label: 'Brancher un agent' },
				{ href: '/integrations/api-rest/', label: 'L’API REST' },
			],
		}),
	},

	/** A field created in the interface, and what PostgreSQL receives. */
	sqlVisual: {
		interface: 'Interface',
		title: 'Nouveau champ · Opportunités',
		labelField: 'Libellé',
		labelValue: 'Montant',
		typeField: 'Type',
		typeValue: 'Nombre',
		descriptionField: 'Description',
		/** Also the column's comment, in the SQL below. */
		descriptionValue: 'Montant HT du contrat',
		required: 'Obligatoire',
		ai: 'IA',
		migration: 'une migration planifiée, verrous courts',
	},

	/** Group levels flowing down a project, a field hidden from one group, and one line of history. */
	rightsVisual: {
		groups: ['Administrateurs', 'Commerciaux', 'Support'],
		project: 'Projet principal',
		sales: 'Ventes',
		opportunities: 'Opportunités',
		clients: 'Clients',
		support: 'Support',
		inherited: 'hérité',
		levels: { none: 'Aucun accès', read: 'Lecture', edit: 'Édition', manage: 'Gestion' },
		field: 'Champ « Marge »',
		hidden: 'Masqué',
		/** HTML. */
		sqlChange: '<b>Session SQL directe</b> a modifié <b>« Migration ERP »</b>',
		sqlMeta: '02:46 · connexion locale · psql',
		/** HTML. */
		sqlDiff: 'Montant : <s>125 000</s> → 130 000',
		undo: '↶ Annuler',
		/** HTML. */
		formChange: '<b>Formulaire « Demande de devis »</b> a créé <b>« Refonte de l’intranet »</b>',
		formMeta: 'réponse publique · publié par Camille',
	},

	/** An agent asks through MCP; the structure change waits for a person. */
	agentVisual: {
		agent: 'Agent',
		via: 'connecté par MCP · jeton « Ventes »',
		question: 'Combien d’opportunités en négociation, et pour quel montant ?',
		listArgs: 'opportunites · statut = Négociation',
		/** HTML. */
		answer: 'Deux opportunités, <b>182 000 €</b> au total : Migration ERP (130 000 €) et Suivi de flotte (52 000 €).',
		request: 'Ajoute un champ « Probabilité » en pourcentage.',
		proposeArgs: 'opportunites · Probabilité · number',
		proposed: 'C’est proposé : une personne de l’équipe doit l’approuver dans basedb.',
		badge: 'Proposition',
		expires: 'expire dans 23 h',
		/** HTML. */
		what: 'Ajouter le champ <b>« Probabilité »</b> (Nombre) à <b>Opportunités</b>',
		by: 'Proposée par l’agent · jeton « Ventes »',
		refuse: 'Refuser',
		approve: 'Approuver',
	},

	bento: {
		label: 'Et tout le reste',
		title: 'Ce qu’on attend d’un outil d’équipe, sans lâcher PostgreSQL.',
		text: 'Chaque fonction écrit dans les mêmes tables, sous les mêmes droits, dans le même historique.',
		more: 'En savoir plus →',
		views: {
			title: 'Huit vues sur les mêmes lignes',
			text: 'Collaboratives pour toute l’équipe, ou personnelles pour soi seul : chacun choisit sa façon de lire, personne ne copie les données.',
			chips: ['Grille', 'Kanban', 'Calendrier', 'Chronologie', 'Galerie', 'Liste', 'Formulaire', 'Questionnaire'],
		},
		forms: {
			title: 'Formulaires partagés',
			text: 'Un lien public, ou réservé aux membres connectés. Répondre ne donne aucun droit sur la table.',
			href: '/fonctionnalites/formulaires-partages/',
		},
		environments: {
			title: 'Environnements',
			text: 'Une base, plusieurs déclinaisons. Comparez la structure, migrez de l’une à l’autre, synchronisez des lignes.',
			chips: ['Production', 'Recette', 'Développement'],
			href: '/fonctionnalites/environnements/',
		},
		collaboration: {
			title: 'Travailler à plusieurs',
			text: 'Les écritures des autres arrivent en temps réel, on voit qui regarde quelle ligne, et on en discute là où elle se trouve : commentaires, mentions, notifications. Ctrl+Z annule la dernière écriture, et refuse plutôt que d’écraser le travail d’un autre.',
			chips: ['Temps réel', 'Présence', 'Commentaires', 'Mentions', 'Ctrl+Z'],
			href: '/fonctionnalites/collaboration/',
		},
		small: {
			ai: card({
				title: 'L’IA dans la grille',
				text: 'Un champ rempli par un modèle à partir des autres colonnes, et un Copilot qui propose filtres, requêtes et colonnes, appliqués d’un clic. OpenAI, Anthropic, Mistral, ou un modèle servi sur votre propre machine.',
				code: 'Résume {{Notes}} en une phrase',
				href: '/fonctionnalites/ia/',
			}),
			formulas: card({
				title: 'Relations et formules',
				text: 'De vraies clés étrangères, des formules en français calculées par PostgreSQL, et des recherches, cumuls et décomptes à travers les relations.',
				code: 'ARRONDI([Montant HT] * (1 + [Taux de TVA]); 2)',
				href: '/fonctionnalites/tables-et-champs/#formules',
			}),
			richText: card({
				title: 'Texte riche et variables',
				text: 'Un éditeur visuel pour le texte mis en forme, assaini à l’écriture ; et dans tout texte long, {{Ville}} se lit avec la valeur de la ligne.',
				code: 'Livraison le {{Date}} à {{Ville}}',
				href: '/fonctionnalites/tables-et-champs/#texte-riche-et-variables',
			}),
			sharedViews: card({
				title: 'Vues partagées',
				text: 'Une vue en lecture seule par un lien, intégrable à un autre site ; un calendrier devient un flux pour votre agenda.',
				href: '/fonctionnalites/vues-partagees/',
			}),
			syncedTables: card({
				title: 'Tables synchronisées',
				text: 'Une table tenue à jour depuis un CSV en ligne, un agenda, ou la vue partagée d’un autre basedb.',
				href: '/integrations/synchronisation/',
			}),
			templates: card({
				title: 'Modèles de base',
				text: 'Dix modèles prêts à l’emploi, une base décrite en une phrase à l’IA, et la vôtre enregistrée comme modèle.',
				href: '/modeles/',
			}),
			files: card({
				title: 'Fichiers et images',
				text: 'Sur le disque de l’hôte ou dans un stockage compatible S3 : AWS, Scaleway, OVH, Cloudflare R2, Garage, MinIO…',
				href: '/fonctionnalites/fichiers/',
			}),
			import: card({
				title: 'Import CSV et JSON',
				text: 'Glissez un fichier : l’import devine les types, crée la table ou complète une table existante, et dit ligne par ligne ce qui est refusé.',
				href: '/guides/premiers-pas/',
			}),
			accounts: card({
				title: 'Comptes et invitations',
				text: 'Chacun crée son compte et ses projets, et invite par un lien en Lecture, Édition ou Gestion ; connexion par mot de passe, Google, Microsoft ou tout fournisseur OpenID Connect.',
				href: '/hebergement/connexion/',
			}),
			webhooks: card({
				title: 'Webhooks',
				text: 'Chaque écriture peut prévenir un autre système : charges signées, livrées dans l’ordre, réessayées.',
				href: '/integrations/webhooks/',
			}),
			settings: card({
				title: 'Paramètres personnels',
				text: 'Votre langue, votre thème, l’ordre des dates, vos notifications, vos sessions et vos jetons, au même endroit.',
				href: '/fonctionnalites/droits/#vos-paramètres',
			}),
			languages: card({
				title: 'Dans votre langue',
				text: 'L’interface prend la langue du navigateur, parmi vingt ; chacun peut la changer dans ses paramètres.',
				href: '/fonctionnalites/droits/#vos-paramètres',
			}),
		},
	},

	selfHost: {
		label: 'Auto-hébergé',
		title: 'Vos données restent {chez vous.}',
		/** HTML. */
		lead: 'basedb est un logiciel libre (AGPL-3.0) : une seule image, une base PostgreSQL, et c’est tout — ni service tiers imposé, ni télémétrie. Sauvegardez-le avec <code>pg_dump</code>, lisez-le avec n’importe quel client PostgreSQL.',
		/** The services of the Compose file, by their name. */
		services: {
			db: 'PostgreSQL 16, vos données',
			basedb: 'L’interface, l’API REST et le serveur MCP, sur un seul port',
			proxy: 'Caddy, HTTPS automatique (option)',
		},
		links: [
			{ href: '/hebergement/docker/', label: 'Guide Docker Compose →' },
			{ href: '/hebergement/variables/', label: 'Toutes les variables →' },
		],
		steps: [
			{
				title: 'Récupérer basedb',
				code: 'git clone https://github.com/eodia/basedb.git\ncd basedb && cp .env.example .env',
			},
			{
				title: 'Deux secrets dans .env',
				code: 'POSTGRES_PASSWORD=un-mot-de-passe-solide\n# openssl rand -base64 32\nBASEDB_ENCRYPTION_KEY=…',
			},
			{
				title: 'Démarrer',
				code: 'docker compose up -d\n# puis http://localhost:3000 : créez votre compte',
			},
		],
	},

	faq: {
		label: 'Questions fréquentes',
		title: 'Ce qu’on nous demande souvent.',
		/** HTML. */
		text: 'Une autre question ? <a href="/guides/introduction/">La documentation</a> y répond sûrement.',
		items: {
			difference: question({
				q: 'En quoi basedb diffère-t-il des autres bases collaboratives ?',
				a: 'Par l’endroit où vivent les données. Là où d’autres rangent vos lignes dans un modèle générique (colonnes numérotées, documents JSON), basedb crée une vraie table PostgreSQL par table, une vraie colonne typée par champ, avec des noms lisibles. Vos données restent exploitables sans basedb.',
			}),
			sql: question({
				q: 'Puis-je écrire directement en SQL dans les tables ?',
				a: 'Oui. Les contraintes (types, obligatoire, listes de choix, clés étrangères) sont tenues par PostgreSQL lui-même, et un déclencheur historise même les écritures faites en SQL direct, avec la session qui les a faites. La console SQL de l’interface et psql lisent les mêmes tables ; dans l’interface, chacun écrit du SQL avec ses propres droits, enregistre ses requêtes et, s’il gère la base, en fait de vraies vues PostgreSQL.',
			}),
			ai: question({
				q: 'Qu’est-ce qui part chez un fournisseur d’IA ?',
				a: 'Rien tant que vous n’avez pas configuré de fournisseur. Ensuite, pour les brouillons de structure et le copilote, seules la structure et votre phrase partent par défaut ; la lecture de données par le copilote est une case à cocher, par conversation. Un modèle de base demandé à l’IA n’envoie que votre phrase. Un champ IA envoie les colonnes que sa consigne cite, après un consentement explicite.',
			}),
			together: question({
				q: 'Peut-on travailler à plusieurs sur la même table ?',
				a: 'Oui. Les écritures des autres s’affichent sans recharger, avec leur visage sur la table ou la ligne qu’ils regardent. On commente une ligne, on mentionne quelqu’un avec @, la cloche prévient. Et Ctrl+Z n’annule que vos propres écritures : il refuse plutôt que d’écraser ce qu’un autre a changé depuis.',
			}),
			languages: question({
				q: 'Dans quelles langues ?',
				a: 'Vingt : français, anglais, allemand, espagnol, italien, portugais du Brésil, néerlandais, polonais, tchèque, suédois, danois, norvégien, finnois, roumain, hongrois, turc, ukrainien, japonais, chinois simplifié et coréen. L’interface prend la langue du navigateur, et chacun la change dans ses paramètres ; ce site et la documentation existent dans les mêmes langues.',
			}),
			agent: question({
				q: 'Comment un agent IA se connecte-t-il ?',
				a: 'Par le serveur MCP, avec un jeton d’intégration limité à une base, en lecture seule par défaut. Un agent lit, crée et modifie des lignes selon ses droits ; il ne supprime rien et ne change pas la structure : il la propose, et une personne approuve.',
			}),
			postgres: question({
				q: 'Quelle version de PostgreSQL faut-il ?',
				a: 'PostgreSQL 16 ou plus récent, avec les extensions pg_trgm et unaccent (disponibles dans l’image officielle). Le docker-compose fourni démarre un PostgreSQL 16 ; vous pouvez aussi pointer DATABASE_URL vers votre propre serveur.',
			}),
			production: question({
				q: 'Est-ce prêt pour la production ?',
				a: 'basedb est en développement actif : le noyau, l’API, le serveur MCP et l’interface fonctionnent et sont couverts par plus de mille tests, mais certaines fonctions restent à venir (voir la feuille de route). Essayez-le, et sauvegardez votre base comme toute base PostgreSQL.',
			}),
			license: question({
				q: 'Sous quelle licence ?',
				a: 'AGPL-3.0-or-later. Vous pouvez l’utiliser, le modifier et l’héberger librement ; si vous proposez une version modifiée comme service, vous en partagez les sources.',
			}),
		},
	},

	cta: {
		title: 'Vos données méritent {de vraies tables.}',
		text: 'Installez basedb en quelques minutes, invitez votre équipe, et gardez la main sur chaque ligne.',
		install: 'Installer basedb',
		github: 'Voir le code sur GitHub',
	},

	changelog: {
		label: 'Nouveautés',
		title: 'Ce qui a changé dans basedb',
		/** HTML. */
		intro: 'Le détail de chaque changement est dans <a href="https://github.com/eodia/basedb/commits/main">l’historique du dépôt</a>. Ce qui vient ensuite : la <a href="/feuille-de-route/">feuille de route</a>.',
		/** Newest first. */
		entries: {
			flows: entry({
				date: '2026-09-27',
				title: 'Automatisations en flux',
				tag: 'Nouveau',
				items: [
					'<strong>Un éditeur en graphe</strong> : le déclencheur, puis chaque étape en carte ; un <strong>+</strong> sur un trait ajoute une étape à cet endroit. Une automatisation simple tient toujours en deux cartes. <a href="/fonctionnalites/automatisations/">Les automatisations</a>',
					'<strong>Chercher une ligne</strong> — le client d’une commande, la dernière facture impayée — puis la modifier, la citer, la relier à une ligne créée.',
					'<strong>Des conditions à plusieurs chemins</strong> : le premier dont la condition est remplie est pris, « Sinon » quand aucun ne l’est ; les chemins se rejoignent ensuite.',
					'<strong>Les données passent d’une étape à l’autre</strong> : <code>{{e2.client}}</code> cite ce qu’une étape a trouvé ou créé, <code>{{e3.reponse.numero}}</code> ce qu’un webhook a répondu ; le menu de chaque texte ne propose que ce qui a eu lieu à coup sûr avant.',
					'<strong>Chaque exécution, étape par étape</strong> : posée sur le flux, elle trace le chemin pris et dit, pour chaque étape, ce qu’elle a fait et en combien de temps.',
					'<strong>Le Copilot des automatisations</strong> : décrivez ce que la base doit faire d’elle-même, ou demandez pourquoi une exécution a échoué ; il propose une automatisation entière, que vous posez sur le flux d’un clic, relisez, puis enregistrez — rien ne s’enregistre sans vous. <a href="/fonctionnalites/automatisations/#le-copilot">Le Copilot</a>',
					'<strong>Demander à l’IA</strong> dans une étape, comme dans un champ IA : une consigne qui cite la ligne et les étapes précédentes, une réponse lue comme texte, nombre, oui ou non, date ou choix dans une liste, que les étapes suivantes écrivent ou envoient. <a href="/fonctionnalites/automatisations/#demander-à-lia">Demander à l’IA</a>',
				],
			}),
			dashboards: entry({
				date: '2026-09-27',
				title: 'Tableaux de bord : questions, graphiques, filtres',
				tag: 'Nouveau',
				items: [
					'<strong>Questions</strong> posées à la souris — une table, ses jointures, des filtres, des mesures par jour, semaine, mois ou année — ou écrites en <strong>SQL</strong>, en lecture seule et avec vos propres droits, variables comprises. <a href="/fonctionnalites/tableaux-de-bord/">Les tableaux de bord</a>',
					'<strong>Quinze visualisations</strong> : chiffre, tendance face à la période précédente, progression vers un objectif, jauge, histogramme, barres, courbe, aires, combiné, secteurs, entonnoir, nuage de points, tableau, tableau croisé, carte de France ou du monde.',
					'<strong>Explorer d’un clic</strong> : un point ouvre ses lignes, une période plus fine, une autre répartition.',
					'<strong>Des tableaux de bord en grille</strong> : cartes déplacées et redimensionnées à la souris, onglets, titres de section, textes, pages intégrées.',
					'<strong>Des filtres communs</strong> — période, catégorie, texte, nombre, regroupement de date — qui pilotent une, plusieurs ou toutes les cartes, avec une valeur par défaut.',
					'<strong>Des graphiques à votre main</strong> : couleur et nom de chaque série ou de chaque part, anneau, demi-cercle ou rose, empilement avec totaux, courbes lissées ou en escalier, axes, graduations, échelle logarithmique ; des tableaux aux colonnes renommées, avec barres et couleurs selon la valeur.',
					'<strong>Le Copilot des tableaux de bord</strong> : une conversation qui propose des questions, des modifications du tableau — annulables — et des valeurs pour ses filtres, à appliquer d’un clic. Seule la structure part chez le fournisseur, sauf si vous l’autorisez à lire les résultats. <a href="/fonctionnalites/tableaux-de-bord/#le-copilot">Le Copilot</a>',
					'<strong>Partager un tableau de bord</strong> par un lien, public ou réservé aux membres — au besoin à des groupes — et l’intégrer à un autre site : cartes et filtres en lecture seule, lus avec les droits de qui l’a publié. <a href="/fonctionnalites/tableaux-de-bord/#partager-un-tableau-de-bord">Partager</a>',
					'« Interfaces » s’appelle désormais <strong>Tableaux de bord</strong> ; les tableaux existants s’ouvrent tels quels, sur la nouvelle grille.',
				],
			}),
			sqlViews: entry({
				date: '2026-09-27',
				title: 'Requêtes enregistrées et vues SQL',
				tag: 'Nouveau',
				items: [
					'<strong>Du SQL pour chacun</strong> : sans le niveau Gestion, un onglet SQL s’exécute en lecture seule, avec vos propres droits, appliqués par PostgreSQL lui-même — une table fermée n’existe pas, un champ masqué est refusé. La pastille « Vos droits » le rappelle. <a href="/fonctionnalites/requetes-et-vues-sql/">Requêtes et vues SQL</a>',
					'<strong>Requêtes enregistrées</strong>, rangées sous les tables dans la rubrique « Requêtes » : personnelles, pour toute la base ou pour des groupes. Partager une requête partage son texte, jamais ce que son auteur peut lire ; ouverte depuis la barre latérale, elle s’exécute aussitôt en lecture seule.',
					'<strong>Vues SQL</strong> : de vraies vues PostgreSQL, rangées parmi les tables avec une couleur, un pictogramme et un petit œil, lisibles aussi depuis <code>psql</code> et vos outils. Chacun les lit avec ses propres droits, et la barre latérale ne les montre qu’à qui peut tout en lire.',
					'Les vues suivent la structure : un renommage ne les casse pas, une formule changée les retire un instant puis les remet ; celle qui ne tient plus reste à corriger, sa définition gardée.',
				],
			}),
			aiProvider: entry({
				date: '2026-09-27',
				title: 'L’IA de votre choix, jusque sur votre machine',
				tag: 'Nouveau',
				items: [
					'<strong>Un quatrième fournisseur d’IA</strong> : tout serveur qui parle l’API d’OpenAI — Azure, une passerelle d’entreprise, un modèle servi sur votre propre machine —, déclaré dans le <code>.env</code>. Le journal des appels dit à qui les données sont parties. <a href="/fonctionnalites/ia/">L’IA dans basedb</a>',
					'<strong>L’écran de connexion</strong> montre, après la grille et le SQL, un tableau de bord qui suit un filtre et une automatisation qui s’exécute, étape IA comprise.',
				],
			}),
			settings: entry({
				date: '2026-09-27',
				title: 'Vos paramètres',
				tag: 'Nouveau',
				items: [
					'<strong>Paramètres</strong>, dans le menu du profil : votre nom, votre adresse et les fournisseurs d’identité liés à votre compte ; votre mot de passe et vos sessions ouvertes. <a href="/fonctionnalites/droits/">Comptes et connexion</a>',
					'<strong>Apparence</strong> : le thème, l’ordre des dates — <code>25/09/2026</code> ou <code>2026-09-25</code> — et le premier jour de la semaine des calendriers ; les deux derniers vous suivent d’un poste à l’autre.',
					'<strong>Notifications</strong> : refusez celles dont vous ne voulez plus, une nature à la fois. <strong>Jetons</strong> : ceux que vous avez créés, sur toutes vos bases, leur dernier usage, et leur révocation.',
				],
			}),
			languages: entry({
				date: '2026-09-27',
				title: 'Texte riche, variables, un kanban plus lisible',
				tag: 'Nouveau',
				items: [
					'<strong>Texte riche</strong> : un nouveau type de champ, mis en forme dans un éditeur visuel — titres, listes, citations, liens —, assaini à l’écriture et gardé par une contrainte contre le SQL direct. <a href="/fonctionnalites/tables-et-champs/#texte-riche-et-variables">Texte riche et variables</a>',
					'<strong>Variables</strong> : un texte long cite une colonne de sa ligne — <code>{{Ville}}</code> — et se lit partout avec sa valeur : grille, fiche, API, serveur MCP, vues partagées, automatisations. La colonne garde la citation, que lit <code>psql</code>.',
					'<strong>Un kanban plus lisible</strong> : des cartes plus aérées, une image de couverture, et une description qui cite les valeurs de la ligne — « Livraison le {{Date}} pour {{Client}} ». <a href="/fonctionnalites/vues/">Les vues</a>',
					'<strong>Renommer en un geste</strong> : un seul dialogue pour une base, une table ou un champ ; le libellé change toujours, et un administrateur peut renommer aussi en base, analyse d’impact à l’appui. <a href="/fonctionnalites/tables-et-champs/#modifier-la-structure">Modifier la structure</a>',
					'<strong>Vingt langues</strong> : l’interface, ce site et la documentation en français, anglais, allemand, espagnol, italien, portugais (Brésil), néerlandais, polonais, tchèque, suédois, danois, norvégien, finnois, roumain, hongrois, turc, ukrainien, japonais, chinois simplifié et coréen. basedb prend la langue du navigateur ; <strong>Paramètres › Apparence › Langue</strong> en fixe une autre, qui vous suit d’un poste à l’autre. Les nombres et les dates suivent la langue. <a href="/fonctionnalites/droits/#vos-paramètres">Vos paramètres</a>',
				],
			}),
			v020: entry({
				date: '2026-09-26',
				title: 'Version 0.2.0 : chacun son compte, ses projets, ses invitations',
				tag: 'Nouveau',
				items: [
					'<strong>Première connexion</strong> : sur une instance neuve, la première page crée le compte administrateur, avec votre adresse et votre mot de passe — plus de compte par défaut ni de mot de passe à chercher dans les journaux. <a href="/guides/installation/">L’installation</a>',
					'<strong>Création de comptes</strong> : chacun crée son compte, puis ses propres projets, dont il devient gestionnaire. L’administration peut la fermer ou la réserver à des domaines. <a href="/hebergement/connexion/">Comptes et connexion</a>',
					'<strong>Partager un projet ou une base</strong> : qui a le niveau Gestion invite par un lien, en Lecture, Modification ou Gestion ; voit qui a accès, change un niveau, le retire. Jamais plus que ce qu’il gère.',
					'<strong>Confidentialité</strong> : chacun ne voit plus que les personnes avec qui il partage un projet, et un nom de projet déjà pris par un autre ne se devine plus.',
					'<strong>Connexion avec Google, Microsoft</strong> et tout fournisseur OpenID Connect (Keycloak, GitLab…), déclarés dans le <code>.env</code> ; une première connexion crée le compte si la création de comptes le permet. <a href="/hebergement/connexion/">Configurer</a>',
					'<strong>Nouvel écran de connexion</strong>, dans le thème de l’application, clair ou sombre, et animé avec retenue ; des écrans vides illustrés dans l’application.',
					'<strong>Mises à jour sans perte</strong> : basedb met son catalogue à jour de lui-même au démarrage, une installation 0.1 comprise, et refuse de démarrer sur une base qu’une version plus récente a déjà mise à jour. <a href="/hebergement/sauvegardes/">Mettre à jour</a>',
				],
			}),
			dockerImage: entry({
				date: '2026-09-26',
				title: 'Une seule image Docker',
				tag: 'Hébergement',
				items: [
					'basedb tient dans <strong>une seule image</strong>, <code>eodia/basedb</code> sur Docker Hub, pour amd64 et arm64 : l’interface, l’API sous <code>/api</code> et le serveur MCP sous <code>/mcp</code>, sur <strong>un seul port</strong>. <a href="/guides/installation/">L’installation</a>',
					'Deux fichiers suffisent — <code>docker-compose.yml</code> et <code>.env</code> — sans cloner le dépôt ni rien construire ; la mise à jour se fait par <code>docker compose pull</code>.',
					'Derrière un domaine, le proxy HTTPS n’a plus de routage à faire : tout va au port 3000.',
				],
			}),
			automations: entry({
				date: '2026-09-26',
				title: 'Automatisations, interfaces, formules, collaboration',
				tag: 'Nouveau',
				items: [
					'<strong>Formules</strong> en français — <code>SI</code>, <code>ARRONDI</code>, <code>JOURS</code>… — devenues des colonnes générées par PostgreSQL ; <strong>recherches</strong>, <strong>cumuls</strong> et <strong>décomptes</strong> à travers les relations. <a href="/fonctionnalites/tables-et-champs/">Les champs</a>',
					'<strong>Nouveaux types</strong> : relation multiple, personne, e-mail, numéro automatique, bouton ; et des formats choisis comme des types — monnaie, pourcentage, durée, note en étoiles, téléphone, code-barres.',
					'<strong>Huit vues</strong> : la <strong>galerie</strong> et la <strong>liste</strong> rejoignent les six autres ; <strong>vues personnelles</strong> pour tout lecteur, vues verrouillées, ordre à la main, dépendances dans la chronologie. <a href="/fonctionnalites/vues/">Les vues</a>',
					'<strong>La grille</strong> : recherche rapide, groupement, résumé par colonne sur tout le filtre, couleurs par règles, hauteur des lignes.',
					'<strong>Vues partagées</strong> en lecture seule, intégrables à un autre site ; un calendrier devient un <strong>flux iCalendar</strong> pour Google Agenda, Outlook ou Apple Calendar. <a href="/fonctionnalites/vues-partagees/">Le partage</a>',
					'<strong>Collaboration</strong> : commentaires et mentions, notifications, écritures des autres en temps réel, présence sur la table et sur la ligne. <a href="/fonctionnalites/collaboration/">Travailler à plusieurs</a>',
					'<strong>Ctrl+Z</strong> annule la dernière écriture — une cellule, une carte déplacée, un import entier — et refuse plutôt que d’écraser ce qu’un autre a changé depuis.',
					'<strong>Automatisations</strong> : quand une ligne est créée ou modifiée, à heure fixe ou d’un clic sur un bouton — modifier, créer, prévenir, appeler un webhook, écrire sur Slack. <a href="/fonctionnalites/automatisations/">Automatiser</a>',
					'<strong>Interfaces</strong> : des tableaux de bord — chiffres, graphiques, listes, textes — lus avec les droits de chacun. <a href="/fonctionnalites/tableaux-de-bord/">Les tableaux de bord</a>',
					'<strong>Intégrations</strong> : un canal Slack, et des <strong>tables synchronisées</strong> depuis un CSV en ligne, un agenda ou la vue d’un autre basedb. <a href="/integrations/synchronisation/">Les intégrations</a>',
					'<strong>Modèles de base</strong> : une galerie de dix modèles, une base décrite en une phrase à l’IA, et toute base enregistrable comme modèle. <a href="/modeles/">La galerie</a>',
					'<strong>Droits</strong> : l’écran Structure passe en consultation seule pour qui n’a pas le niveau Gestion.',
					'<strong>Nouvelle identité</strong> : un logo, une palette, et un écran de connexion refait.',
				],
			}),
			simpler: entry({
				date: '2026-09-26',
				title: 'Une interface plus simple',
				items: [
					'<strong>La barre latérale</strong> ne liste plus que les bases et leurs tables ; les écrans de la base ouverte — Structure, Historique, Interfaces, Automatisations — sont réunis dans un bloc, juste au-dessus du profil.',
					'<strong>Le menu du profil</strong> accueille ce qui n’est pas la donnée : la documentation API et MCP, les intégrations, les utilisateurs et les permissions.',
					'<strong>Une requête SQL</strong> s’ouvre par le « + » de la barre d’onglets ou le menu de la base, sans doublon dans la barre latérale.',
					'<strong>Nouvelle base</strong> propose les modèles et l’IA dès le dialogue ; la base de démonstration passe par la même galerie.',
					'<strong>L’écran ne propose plus ce qui serait refusé</strong> : pas de bouton de structure sans Gestion, pas de « Supprimer » sans droit de supprimer ; et un lecteur crée ses propres vues au lieu de buter sur un message.',
					'<strong>Les colonnes système</strong> sont rangées sous « Informations système » plutôt que proposées sur chaque table.',
					'<strong>La fiche d’une ligne</strong> gagne ses commentaires, un bouton pour écrire ou appeler, et une note qui se règle d’un clic.',
					'<strong>La connexion</strong> abandonne son fond animé en 3D pour un écran léger, qui respecte la préférence « moins de mouvement ».',
				],
			}),
			environments: entry({
				date: '2026-09-26',
				title: 'Environnements, formulaires partagés, vues',
				items: [
					'<strong>Environnements</strong> : production, recette, développement pour une même base ; comparaison côte à côte, plan de migration, synchronisation des lignes.',
					'<strong>Historique des structures</strong> : chaque création ou modification de table et de champ, capturée par déclencheur sur le catalogue.',
					'<strong>Formulaires partagés</strong> : un lien public ou réservé aux membres, fermeture par date ou par nombre de réponses, attribution des réponses dans l’historique.',
					'<strong>Six vues</strong> : grille, kanban, calendrier, chronologie, formulaire, questionnaire.',
					'<strong>Historique des données</strong> : annuler une modification, restaurer une ligne supprimée.',
					'<strong>IA</strong> : l’option IA sur n’importe quel champ, et le copilote.',
					'<strong>Relation</strong> et <strong>Lien URL</strong> : deux types distincts ; le texte long s’écrit en Markdown.',
					'<strong>Webhooks</strong> signés et ordonnés, <strong>propositions des agents</strong> à approuver.',
					'<strong>Docker</strong> : un Dockerfile à trois cibles, un docker-compose complet, un proxy HTTPS en option.',
				],
			}),
			projects: entry({
				date: '2026-09-25',
				title: 'Projets, droits, serveur MCP',
				items: [
					'<strong>Projets</strong> au-dessus des bases, et droits par <strong>groupes</strong> sur quatre niveaux : Aucun accès, Lecture, Édition, Gestion.',
					'<strong>Comptes</strong> : mot de passe temporaire, changement à la première connexion, élévation pour l’administration.',
					'<strong>Serveur MCP</strong> et relais stdio ; <strong>jetons d’intégration</strong> communs à l’API REST et au MCP.',
					'<strong>Documentation générée</strong> « API et MCP » pour chaque base.',
				],
			}),
			fields: entry({
				date: '2026-09-20',
				title: 'Champs, listes de choix, import',
				items: [
					'Modifier un champ et les options d’une liste de choix.',
					'<strong>Import</strong> de fichiers CSV et JSON.',
					'Le menu d’une table : renommer, décrire, supprimer.',
				],
			}),
			firstCommit: entry({
				date: '2026-09-20',
				title: 'Premier commit',
				items: [
					'Le monorepo : nommage, registre des codes d’erreur, catalogue extrait du document d’architecture, noyau, API, interface.',
				],
			}),
		},
	},

	roadmap: {
		label: 'Feuille de route',
		title: 'Ce qui vient ensuite',
		/** HTML. */
		intro: 'basedb est en développement actif. Cette page dit ce qui manque encore, sans date promise. Une idée, un besoin ? <a href="https://github.com/eodia/basedb/issues">Ouvrez un ticket</a>. Ce qui est déjà là : les <a href="/nouveautes/">nouveautés</a>.',
		columns: {
			next: {
				title: 'Prochainement',
				items: {
					restoreTable: item({
						title: 'Restaurer une table seule',
						text: 'Une table supprimée reste lisible en SQL sous son nom relégué ; la ramener seule depuis l’interface est à venir.',
					}),
					aiSettings: item({
						title: 'Réglages de l’IA dans l’interface',
						text: 'Fournisseur, modèle et clé par tenant, sans passer par l’environnement de l’API.',
					}),
					mail: item({
						title: 'Notifications et invitations par courriel',
						text: 'Les mentions, les réponses et les désignations arrivent aujourd’hui dans basedb, les invitations par un lien à envoyer soi-même ; elles pourront aussi partir par courriel.',
					}),
				},
			},
			later: {
				title: 'Ensuite',
				items: {
					formLinks: item({
						title: 'Relations et fichiers dans les formulaires partagés',
						text: 'Une recherche restreinte dans la table liée, un dépôt de fichiers borné pour les inconnus.',
					}),
					moreEvents: item({
						title: 'Plus d’événements notifiés',
						text: 'Être prévenu d’une réponse à un formulaire, d’une proposition d’agent, d’un webhook désactivé.',
					}),
					sqlViewsAcross: item({
						title: 'Vues SQL d’un environnement à l’autre',
						text: 'Recopier les vues SQL avec la structure quand on crée ou compare des environnements, et dans les modèles de base.',
					}),
					loops: item({
						title: 'Boucles et attentes dans les automatisations',
						text: 'Répéter des étapes pour chaque ligne trouvée, attendre avant la suivante (« trois jours après »), et emporter les flux dans les modèles de base.',
					}),
					textFormulas: item({
						title: 'Formules sur le texte',
						text: 'Extraire, remplacer ou tronquer une partie d’un texte.',
					}),
					bulk: item({
						title: 'Opérations en masse déclarées',
						text: 'Des modifications de milliers de lignes, historisées comme une seule opération.',
					}),
					tombstones: item({
						title: 'Épuration des pierres tombales',
						text: 'Le nettoyage des traces de suppression devenues inutiles.',
					}),
				},
			},
		},
	},

	/** The template gallery (`/modeles/`) and each template's page. */
	gallery: {
		label: 'Modèles',
		title: 'Une base prête en quelques secondes',
		/** HTML. */
		intro: 'Chaque modèle crée des tables reliées entre elles, des lignes d’exemple, des vues, un tableau de bord, des automatisations — et des champs que l’IA remplit elle-même. Dans basedb : <strong>Nouvelle base</strong>, puis <strong>Partir d’un modèle</strong>. Rien ne correspond ? Décrivez votre besoin en une phrase : l’IA vous propose une base sur mesure.',
		filter: 'Filtrer par catégorie',
		all: 'Tous',
		otherCategory: 'Autres',
		ai: '✦ IA',
		tables: forms({ one: '{n} table', other: '{n} tables' }),
		rows: forms({ one: '{n} ligne', other: '{n} lignes' }),
		views: forms({ one: '{n} vue', other: '{n} vues' }),
		howtoTitle: 'Paramétrer les modèles en JSON',
		/** HTML. */
		howto: 'Un modèle est un fichier JSON : ses tables, ses champs, ses relations, ses lignes, ses vues, ses tableaux de bord, ses automatisations et les consignes de ses champs IA. Les modèles de cette page sont les fichiers du dossier <a href="https://github.com/eodia/basedb/tree/main/packages/templates/catalog"><code>packages/templates/catalog</code></a> du dépôt ; chaque instance de basedb lit <a href="/modeles/catalogue.json"><code>catalogue.json</code></a> et les propose à ses utilisateurs. Un administrateur peut aussi importer ses propres modèles dans son instance, et toute base peut être enregistrée comme modèle.',
		format: { href: '/fonctionnalites/modeles/', label: 'Le format des modèles →' },

		back: '← Tous les modèles',
		defaultCategory: 'Modèle',
		sampleRows: forms({ one: '{n} ligne d’exemple', other: '{n} lignes d’exemple' }),
		aiTitle: 'Ce que l’IA calcule',
		useTitle: 'Utiliser ce modèle',
		/** HTML; `{label}`: the template's name. */
		useSteps: ['Dans basedb, <strong>Nouvelle base</strong>.', '<strong>Partir d’un modèle</strong>, puis « {label} ».'],
		/** HTML: the last step, without AI fields and with. */
		create: '<strong>Créer la base</strong>.',
		createWithAi:
			'<strong>Créer la base</strong> — en acceptant, si vous le souhaitez, que les champs IA soient calculés par votre fournisseur d’IA.',
		download: 'Télécharger le JSON',
		downloadNote: 'Pour l’importer dans votre instance, ou l’adapter avant de le proposer au catalogue.',
		/** After a view's name: `{kind}` its kind, `{table}` its table. */
		viewMeta: '— {kind}, {table}',
		/** HTML; `{label}`: the dashboard's name, `{blocks}`: its number of blocks. */
		dashboard: '<strong>Tableau de bord</strong> « {label} » — {blocks}',
		blocks: forms({ one: '{n} bloc', other: '{n} blocs' }),
		/** HTML; `{label}`: the automation's name. */
		automation: '<strong>Automatisation</strong> « {label} »',
		yes: 'Oui',
		no: 'Non',
		/** A sample value that stands for whoever creates the base. */
		me: 'Vous',
		kinds: {
			short_text: 'Texte court',
			long_text: 'Texte long',
			rich_text: 'Texte riche',
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
		} as Record<string, string>,
		viewKinds: {
			grid: 'Grille',
			kanban: 'Kanban',
			calendar: 'Calendrier',
			timeline: 'Chronologie',
			gallery: 'Galerie',
			list: 'Liste',
			form: 'Formulaire',
		} as Record<string, string>,
	},

	/**
	 * What the gallery shows of each template of `packages/templates/catalog/`, by its key:
	 * the French here is the files' own (a build warns when they part). The templates'
	 * contents — tables, fields, rows — stay French.
	 */
	templates: {
		demo: template({
			label: 'Démo : Atelier Lumen',
			summary:
				'Une petite agence, ses clients, projets, tâches, factures et avis : toutes les facettes de basedb dans une seule base.',
			description:
				"La base de démonstration. Atelier Lumen est une agence de design fictive. Sa base montre les relations entre tables, les recherches et cumuls (chiffre d'affaires par client, note moyenne), les formules (montant TTC, retard), trois champs calculés par l'IA sur les avis clients (sentiment, thème, réponse suggérée), chaque sorte de vue — grille, kanban, calendrier, chronologie avec dépendances, galerie, liste, formulaire —, un tableau de bord et deux automatisations.",
			category: 'Démonstration',
			tags: ['IA', 'Relations', 'Toutes les vues', 'Tableau de bord'],
		}),
		'analyse-avis': template({
			label: "Analyse d'avis clients",
			summary:
				"Collectez les avis, laissez l'IA en tirer le sentiment, les thèmes, l'urgence et un brouillon de réponse.",
			description:
				"Pour un commerce, un restaurant ou une marque : les avis arrivent d'un formulaire public ou d'un import, et l'IA lit chacun d'eux. Elle classe le sentiment, repère le thème principal, signale ceux qui demandent une réponse rapide, extrait la suggestion du client et rédige une réponse à relire. Les produits cumulent leur note moyenne et leur nombre d'avis ; un tableau de bord suit la satisfaction.",
			category: 'Relation client',
			tags: ['IA', 'Formulaire', 'Tableau de bord'],
		}),
		'base-connaissances': template({
			label: 'Base de connaissances',
			summary:
				"Articles d'aide et questions des clients : l'IA résume, classe et propose une réponse à partir des articles.",
			description:
				"Pour un service support. Les articles d'aide sont rangés par catégorie et suivis dans le temps ; les questions des clients arrivent par un formulaire public. L'IA résume chaque article et en évalue le niveau, classe chaque question et rédige un brouillon de réponse à relire.",
			category: 'Support',
			tags: ['IA', 'Formulaire', 'Liste'],
		}),
		'calendrier-editorial': template({
			label: 'Calendrier éditorial',
			summary: "Articles, posts et newsletters planifiés sur un calendrier ; l'IA propose accroches et mots-clés.",
			description:
				"Pour une équipe marketing ou une rédaction. Chaque contenu avance de l'idée à la publication, se place sur le calendrier des parutions et appartient à une campagne. L'IA propose une accroche et des mots-clés à partir du brief, et un formulaire permet à toute l'entreprise de suggérer un sujet.",
			category: 'Marketing',
			tags: ['IA', 'Calendrier', 'Kanban', 'Formulaire'],
		}),
		crm: template({
			label: 'CRM commercial',
			summary:
				"Entreprises, contacts et opportunités : un pipeline de vente, les échanges, et l'IA qui conseille la prochaine étape.",
			description:
				"Un CRM léger pour une équipe commerciale. Les opportunités avancent dans un pipeline, portent un montant pondéré par leur probabilité, et l'IA en évalue le risque et conseille la prochaine action à partir des notes. Les échanges avec les clients sont consignés et résumés, les entreprises cumulent ce qu'elles représentent.",
			category: 'Ventes',
			tags: ['IA', 'Pipeline', 'Kanban', 'Calendrier'],
		}),
		evenements: template({
			label: 'Événements et inscriptions',
			summary:
				"Conférences, ateliers et webinaires : les inscriptions, les places restantes, et les retours des participants lus par l'IA.",
			description:
				"Pour organiser des événements récurrents. Chaque événement compte ses inscrits et ses places restantes ; les inscriptions avancent jusqu'à la présence. Après l'événement, les participants laissent un retour que l'IA classe par sentiment et résume. Un formulaire public permet de rejoindre la liste de diffusion.",
			category: 'Événementiel',
			tags: ['IA', 'Calendrier', 'Formulaire', 'Cumuls'],
		}),
		'gestion-projet': template({
			label: 'Gestion de projet',
			summary: 'Projets, tâches et jalons : une feuille de route, des dépendances entre tâches, un kanban et un calendrier.',
			description:
				"Pour piloter plusieurs projets en parallèle. Chaque projet cumule ses tâches et ses heures ; les tâches se suivent en kanban, se planifient sur une chronologie qui dessine leurs dépendances, et les jalons se lisent dans un calendrier. L'IA rédige une météo du projet pour la direction à partir de sa description et de son avancement.",
			category: 'Organisation',
			tags: ['Chronologie', 'Dépendances', 'Kanban', 'IA'],
		}),
		inventaire: template({
			label: 'Inventaire et stocks',
			summary: "Articles, fournisseurs et mouvements : le stock se calcule tout seul, les ruptures se voient d'avance.",
			description:
				"Pour un atelier, une boutique ou un service généraux. Chaque entrée ou sortie est un mouvement ; le stock de chaque article en est la somme, sa valeur une formule, et les articles sous leur seuil apparaissent dans « À commander ». L'IA rédige la fiche de chaque article à partir de son nom et de sa catégorie.",
			category: 'Opérations',
			tags: ['Cumuls', 'Formules', 'Galerie', 'IA'],
		}),
		recrutement: template({
			label: 'Recrutement',
			summary: "Postes ouverts, candidats et entretiens ; l'IA synthétise chaque candidature et suggère les points à creuser.",
			description:
				"Un suivi des recrutements, de la candidature à l'embauche. Les candidats postulent par un formulaire public, avancent étape par étape dans un kanban, et les entretiens se planifient dans un calendrier. L'IA lit la lettre de motivation et les notes : une synthèse, et les questions à poser en entretien. Elle aide à lire, elle ne décide pas.",
			category: 'Ressources humaines',
			tags: ['IA', 'Formulaire', 'Kanban', 'Calendrier'],
		}),
		'suivi-tickets': template({
			label: 'Suivi de tickets',
			summary:
				"Bugs et demandes triés par l'IA, suivis par sprint jusqu'à leur résolution, avec un formulaire de signalement.",
			description:
				"Un gestionnaire de tickets pour une équipe produit. Chaque ticket est rattaché à un composant et à un sprint ; l'IA propose une catégorie, estime la gravité et résume le signalement. Un kanban suit l'avancement, une chronologie montre les sprints, un formulaire permet à n'importe qui de signaler un problème, et une automatisation note la date de résolution.",
			category: 'Produit et technique',
			tags: ['IA', 'Kanban', 'Formulaire', 'Sprints'],
		}),
	},
};

export type Dict = typeof fr;
export default fr;
