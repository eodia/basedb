/**
 * The Dutch texts of the landing pages, laid over the French ones (`fr.ts`).
 *
 * See `../README.md`.
 */
import type { DeepPartial, Dict } from './index';

export default {
	meta: {
		home: {
			title: 'basedb — de collaboratieve database waarin elke tabel een echte PostgreSQL-tabel is',
			description: 'Rasters en tien weergaven, formules, gedeelde formulieren, quiz en weergaven, opmerkingen, automatiseringen, dashboards, rechten tot op het veld, volledige geschiedenis, REST-API en MCP-server — op echte PostgreSQL-tabellen met leesbare namen. Zelf gehost, AGPL-3.0.',
		},
		changelog: {
			title: 'Wat is er nieuw — basedb',
			description: 'Wat er in basedb is veranderd, versie na versie.',
		},
		roadmap: {
			title: 'Roadmap — basedb',
			description: 'Wat basedb hierna gaat doen.',
		},
		gallery: {
			title: 'Sjablonen — basedb',
			description: 'Kant-en-klare databases: ticketopvolging, analyse van reviews, CRM, werving… met hun voorbeeldrijen, weergaven, dashboards en velden die de AI berekent.',
		},
		template: {
			title: '{label} — basedb-sjablonen',
		},
	},
	eodia: {
		home: 'https://eodia.com/',
		about: 'https://eodia.com/about/',
		contact: 'https://eodia.com/contact/',
	},
	demo: {
		short: 'Demo',
		cta: 'Demo uitproberen',
	},
	nav: {
		aria: 'Hoofdnavigatie',
		home: 'basedb — startpagina',
		links: [
			{
				href: '/#fonctionnalites',
				label: 'Functies',
			},
			{
				href: '/modeles/',
				label: 'Sjablonen',
			},
			{
				href: '/guides/introduction/',
				label: 'Documentatie',
			},
			{
				href: '/nouveautes/',
				label: 'Wat is er nieuw',
			},
		],
		developers: 'Ontwikkelaars',
		github: 'De GitHub-repository van basedb',
		install: 'Installeren',
		menu: {
			open: 'Menu openen',
			close: 'Menu sluiten',
			features: {
				label: 'Functies',
				groups: {
					organize: {
						title: 'Organiseren',
						items: {
							tables: {
								href: '/fonctionnalites/tables-et-champs/',
								title: 'Tabellen en velden',
								text: 'Velden voor alles, relaties, formules net als in een spreadsheet.',
							},
							views: {
								href: '/fonctionnalites/vues/',
								title: 'Tien weergaven',
								text: 'Raster, kanban, kalender, tijdlijn, galerie, lijst, landkaart, formulier, enquête, quiz.',
							},
							forms: {
								href: '/fonctionnalites/formulaires-partages/',
								title: 'Formulieren',
								text: 'Een link om te delen: elk antwoord wordt een rij.',
							},
							files: {
								href: '/fonctionnalites/fichiers/',
								title: 'Bestanden en afbeeldingen',
								text: 'Offertes, foto’s, contracten, opgeslagen bij hun rij.',
							},
						},
					},
					collaborate: {
						title: 'Samenwerken',
						items: {
							live: {
								href: '/fonctionnalites/collaboration/',
								title: 'Realtime en opmerkingen',
								text: 'Anderen live aan het werk zien, een opmerking plaatsen bij een rij, een collega vermelden.',
							},
							rights: {
								href: '/fonctionnalites/droits/',
								title: 'Rechten en teams',
								text: 'Wie wat ziet en wie wat mag wijzigen, tot op de kolom.',
							},
							history: {
								href: '/fonctionnalites/historique/',
								title: 'Geschiedenis',
								text: 'Elke wijziging bewaard, en terug te draaien.',
							},
							shared: {
								href: '/fonctionnalites/vues-partagees/',
								title: 'Gedeelde weergaven',
								text: 'Een weergave via een link, op je site of in je agenda.',
							},
						},
					},
					automate: {
						title: 'Automatiseren en analyseren',
						items: {
							automations: {
								href: '/fonctionnalites/automatisations/',
								title: 'Automatiseringen',
								text: 'Als een rij verandert: waarschuwen, aanmaken, schrijven, AI raadplegen.',
							},
							dashboards: {
								href: '/fonctionnalites/tableaux-de-bord/',
								title: 'Dashboards',
								text: 'Vijftien visualisaties, gemeenschappelijke filters, een link om te delen.',
							},
							ai: {
								href: '/fonctionnalites/ia/',
								title: 'AI en Copilot',
								text: 'Een database in één zin, velden die zichzelf invullen.',
							},
							templates: {
								href: '/modeles/',
								title: 'Sjablonen',
								text: 'Tien kant-en-klare databases, aan te passen.',
							},
						},
					},
				},
				feature: {
					tag: 'Nieuw',
					title: 'Automatiseringen als flow',
					text: 'Zoeken, beslissen, AI raadplegen: een grafische editor, en elke uitvoering lees je terug, stap voor stap.',
					href: '/nouveautes/',
					cta: 'Al het nieuws',
				},
				all: 'Alle functies',
			},
			solutions: {
				label: 'Oplossingen',
				title: 'Voor elk team',
				items: {
					crm: {
						team: 'Verkoop',
						text: 'Pijplijn, contacten, opvolging.',
					},
					recrutement: {
						team: 'Human resources',
						text: 'Sollicitaties, gesprekken, samenvattingen door de AI.',
					},
					'calendrier-editorial': {
						team: 'Marketing',
						text: 'Artikelen, posts en nieuwsbrieven, gepland.',
					},
					inventaire: {
						team: 'Bedrijfsvoering',
						text: 'Een voorraad die zich berekent, tekorten die je van tevoren ziet.',
					},
					'gestion-projet': {
						team: 'Projecten',
						text: 'Mijlpalen, taken en afhankelijkheden.',
					},
					'suivi-tickets': {
						team: 'Product',
						text: 'Bugs en verzoeken gesorteerd door de AI.',
					},
					'base-connaissances': {
						team: 'Support',
						text: 'Helpartikelen, vragen, voorgestelde antwoorden.',
					},
					evenements: {
						team: 'Evenementen',
						text: 'Inschrijvingen, plaatsen, feedback.',
					},
					'analyse-avis': {
						team: 'Klantrelaties',
						text: 'Reviews gelezen en gesorteerd door de AI.',
					},
				},
				ask: {
					title: 'Iets anders in gedachten?',
					text: 'Beschrijf je behoefte in één zin: de AI stelt een database op maat voor.',
					href: '/modeles/',
				},
				all: 'Alle sjablonen',
			},
			developers: {
				label: 'Ontwikkelaars',
				groups: {
					build: {
						title: 'Integreren',
						items: {
							api: {
								href: '/integrations/api-rest/',
								title: 'REST-API',
								text: 'Dezelfde gegevens als de interface, beschreven in OpenAPI 3.1.',
							},
							mcp: {
								href: '/integrations/mcp/',
								title: 'MCP-server',
								text: 'Tools voor je AI-agents, onder jouw rechten.',
							},
							webhooks: {
								href: '/integrations/webhooks/',
								title: 'Webhooks',
								text: 'Elke schrijfactie, ondertekend, op volgorde, opnieuw geprobeerd.',
							},
							sql: {
								href: '/integrations/sql/',
								title: 'Directe SQL',
								text: 'Echte PostgreSQL-tabellen, met leesbare namen.',
							},
							sync: {
								href: '/integrations/synchronisation/',
								title: 'Synchronisatie',
								text: 'Tabellen die van elders up-to-date worden gehouden.',
							},
						},
					},
					host: {
						title: 'Hosten',
						items: {
							docker: {
								href: '/hebergement/docker/',
								title: 'Docker Compose',
								text: 'Één image, één PostgreSQL-database, één poort.',
							},
							env: {
								href: '/hebergement/variables/',
								title: 'Variabelen',
								text: 'Alles wordt ingesteld in het bestand .env.',
							},
							https: {
								href: '/hebergement/https/',
								title: 'Domein en HTTPS',
								text: 'Achter je eigen proxy, of met de meegeleverde Caddy.',
							},
							sso: {
								href: '/hebergement/connexion/',
								title: 'Inloggen en SSO',
								text: 'Google, Microsoft, elke OpenID Connect-provider.',
							},
							backup: {
								href: '/hebergement/sauvegardes/',
								title: 'Back-ups en updates',
								text: 'pg_dump, en updates zonder verlies.',
							},
						},
					},
				},
				feature: {
					title: 'De pagina voor ontwikkelaars',
					text: 'Een echte PostgreSQL-tabel achter elk raster.',
					href: '/developpeurs/',
				},
			},
			resources: {
				label: 'Bronnen',
				groups: {
					learn: {
						title: 'Leren',
						items: {
							docs: {
								href: '/guides/introduction/',
								title: 'Documentatie',
								text: 'Heel basedb, stap voor stap.',
							},
							start: {
								href: '/guides/premiers-pas/',
								title: 'Eerste stappen',
								text: 'Een eerste database, van import tot weergave.',
							},
							install: {
								href: '/guides/installation/',
								title: 'Installatie',
								text: 'Twee bestanden en één commando.',
							},
							principles: {
								href: '/architecture/principes/',
								title: 'De principes',
								text: 'Hoe basedb is gebouwd, en waarom.',
							},
						},
					},
					follow: {
						title: 'Het project volgen',
						items: {
							news: {
								href: '/nouveautes/',
								title: 'Wat is er nieuw',
								text: 'Wat er is veranderd, versie na versie.',
							},
							roadmap: {
								href: '/feuille-de-route/',
								title: 'Roadmap',
								text: 'Wat er hierna komt.',
							},
							github: {
								href: 'https://github.com/eodia/basedb',
								title: 'GitHub',
								text: 'De code, de tickets, de versies.',
							},
							eodia: {
								href: 'https://eodia.com/',
								title: 'Eodia',
								text: 'De studio die basedb maakt.',
							},
						},
					},
				},
			},
		},
	},
	language: {
		label: 'Taal',
		current: 'Taal: {name}',
	},
	footer: {
		tagline: 'De collaboratieve database waarin elke tabel een echte PostgreSQL-tabel is.',
		madeBy: 'Vrije software van <a class="eodia" href="https://eodia.com/">Eodia</a>, een AI-native softwarestudio.',
		columns: {
			product: {
				title: 'Product',
				links: [
					{
						href: '/#fonctionnalites',
						label: 'Functies',
					},
					{
						href: '/nouveautes/',
						label: 'Wat is er nieuw',
					},
					{
						href: '/feuille-de-route/',
						label: 'Roadmap',
					},
					{
						href: '/#faq',
						label: 'Veelgestelde vragen',
					},
				],
			},
			docs: {
				title: 'Documentatie',
				links: [
					{
						href: '/guides/introduction/',
						label: 'Introductie',
					},
					{
						href: '/guides/installation/',
						label: 'Installatie',
					},
					{
						href: '/integrations/api-rest/',
						label: 'REST-API',
					},
					{
						href: '/integrations/mcp/',
						label: 'MCP-server',
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
						label: 'Omgevingsvariabelen',
					},
					{
						href: '/hebergement/https/',
						label: 'Domein en HTTPS',
					},
					{
						href: '/hebergement/sauvegardes/',
						label: 'Back-ups',
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
						label: 'Architectuurdocument',
					},
					{
						href: 'https://github.com/eodia/basedb/blob/main/LICENSE',
						label: 'AGPL-3.0-licentie',
					},
					{
						href: 'https://github.com/eodia/basedb/issues',
						label: 'Een probleem melden',
					},
				],
			},
			eodia: {
				title: 'Eodia',
				links: [
					{
						href: 'https://eodia.com/',
						label: 'De studio',
					},
					{
						href: 'https://eodia.com/about/',
						label: 'Over ons',
					},
					{
						href: 'https://eodia.com/contact/',
						label: 'Contact opnemen',
					},
				],
			},
		},
		copyright: '© {year} <a href="https://eodia.com/">Eodia</a> · AGPL-3.0-or-later',
		builtWith: 'Site gebouwd met Astro en Starlight.',
	},
	docsFooter: {
		madeBy: 'basedb is vrije software van <a href="https://eodia.com/">Eodia</a>, een AI-native softwarestudio.',
	},
	teams: {
		meta: {
			title: 'basedb — de collaboratieve database voor je hele team',
			description: 'Al je werk op één plek, door je hele team tegelijk bijgewerkt: in raster, kanban of kalender, met formulieren, dashboards, automatiseringen en AI. Zonder code, vrij en gratis.',
		},
		hero: {
			eyebrow: 'basedb',
			title: 'Al je werk.',
			titleAccent: 'Eindelijk op één plek.',
			lead: 'Rasters, kalenders, formulieren, dashboards en automatiseringen, voor het hele team. Net zo simpel als een spreadsheet. Zonder één regel code.',
			primary: 'Sjablonen bekijken',
			secondary: 'Demo bekijken',
			facts: ['Zonder code', 'Vrij en gratis', 'Je gegevens blijven bij jou'],
		},
		story: {
			grid: {
				title: 'Het hele team, in dezelfde tabel.',
				text: 'Iedereen werkt er tegelijk in, en iedereen ziet hetzelfde, up-to-date.',
			},
			copilot: {
				title: 'Vraag het. De Copilot regelt het.',
				text: '“Wie moet ik deze week opvolgen?” — hij stelt het juiste filter voor, en jij past het toe met één klik.',
			},
			kanban: {
				title: 'Sleep. Het is up-to-date.',
				text: 'Elke fase wordt een kolom; een kaart verslepen is de rij wijzigen.',
			},
			calendar: {
				title: 'Elke datum op zijn plek.',
				text: 'Afspraken verschijnen vanzelf, en volgen mee tot in je agenda.',
			},
			dashboard: {
				title: 'En alles, in één oogopslag.',
				text: 'De cijfers berekenen zichzelf, op basis van dezelfde rijen.',
			},
		},
		stage: {
			aria: 'De klantopvolging van een team in basedb: raster, Copilot, kanban, kalender, dashboard',
			tabs: {
				grid: 'Raster',
				copilot: 'Copilot',
				kanban: 'Kanban',
				calendar: 'Kalender',
				dashboard: 'Dashboard',
			},
			project: 'Hoofdproject',
			projectMeta: 'Project · 2 databases',
			filterNav: 'Navigatie filteren',
			base: 'Verkoop',
			otherBase: 'Support',
			tables: ['Klanten', 'Contacten', 'Offertes'],
			baseSection: 'Database · Verkoop',
			screens: ['Dashboards', 'Automatiseringen'],
			user: 'Léa Martin',
			views: { grid: 'Alle rijen', kanban: 'Op fase', calendar: 'Afspraken' },
			toolbar: {
				filter: 'Filteren',
				columns: 'Kolommen',
				group: 'Groeperen',
				colors: 'Kleuren',
				sort: 'Sorteren',
				configure: 'Instellen',
			},
			search: 'Zoeken…',
			add: 'Toevoegen',
			columns: {
				name: 'Klant',
				status: 'Fase',
				owner: 'Opgevolgd door',
				amount: 'Bedrag',
				next: 'Volgende afspraak',
			},
			statuses: {
				contact: 'Te contacteren',
				meeting: 'Afspraak',
				quote: 'Offerte verstuurd',
				signed: 'Getekend',
			},
			clients: [
				'Bakkerij Martens',
				'Kliniek De Linden',
				'Scholengemeenschap Het Kompas',
				'Fiets voor Iedereen',
				'De Lekkerbek',
				'Smederij De Maas',
				'Atelier Van Dijk',
			],
			addRow: 'Rij toevoegen',
			perPage: 'Rijen per pagina',
			card: 'Opgevolgd door {owner}, afspraak op {date}',
			addCard: 'Kaart toevoegen',
			today: 'Vandaag',
			month: 'Maand',
			week: 'Week',
			dashboards: 'Dashboards',
			questions: 'Vragen',
			dashboard: 'Verkoopopvolging',
			dashboardText: 'Het belangrijkste in één oogopslag.',
			dashboardTabs: ['Overzicht', 'Activiteit'],
			period: 'Periode',
			thisYear: 'Dit jaar',
			share: 'Delen',
			edit: 'Bewerken',
			explore: 'Gegevens verkennen',
			chart: 'Bedrag per klant',
			byStage: 'Klanten per fase',
			kpis: {
				signed: 'Getekend',
				pending: 'Offerte in afwachting',
				rate: 'Getekende klanten',
			},
			copilot: {
				question: 'Wie moet ik deze week opvolgen?',
				thinking: 'Bezig met nadenken…',
				answer: 'Vier klanten wachten op een antwoord: twee verstuurde offertes en twee voor te bereiden afspraken.',
				card: 'Klanten filteren',
				filter: 'Fase: Offerte verstuurd of Afspraak',
				apply: 'Filter toepassen',
				applied: 'Filter toegepast',
				placeholder: 'Vraag het de Copilot…',
				filtered: '{n} rijen gefilterd',
			},
		},
		teaser: {
			tabs: { label: 'Kies de video', short: 'In 40 seconden', full: 'De volledige rondleiding' },
			titleAccent: 'in 40 seconden.',
			text: 'Tabellen, weergaven, formulieren, automatiseringen en AI: de kern van basedb, op muziek.',
			duration: '40 s',
			inEnglish: 'De teksten in de video zijn in het Engels.',
		},

		video: {
			eyebrow: 'De demo',
			title: 'Heel basedb,',
			titleAccent: 'in zeven minuten.',
			text: 'Een database aanmaken, vullen, delen, automatiseren, aansturen: de volledige rondleiding, met commentaar.',
			play: 'Video afspelen',
			duration: '6 min 36 s',
			chapters: 'Hoofdstukken',
			captions: 'Engels',
			inEnglish: 'De video is in het Engels, met Engelse ondertiteling.',
			list: [
				{ time: '0:10', title: 'Een database aanmaken' },
				{ time: '0:49', title: 'Tabellen, velden en formules' },
				{ time: '1:31', title: 'Rijdetails en samenwerking' },
				{ time: '1:56', title: 'Zes weergaven op dezelfde rijen' },
				{ time: '2:29', title: 'Formulieren en enquêtes' },
				{ time: '3:28', title: 'Quiz' },
				{ time: '4:10', title: 'Automatiseringen' },
				{ time: '4:39', title: 'Dashboards' },
				{ time: '4:59', title: 'SQL voor iedereen' },
				{ time: '5:30', title: 'Geschiedenis en rechten' },
				{ time: '5:53', title: 'API, MCP en Copilot' },
			],
		},
		together: {
			eyebrow: 'Samenwerking',
			title: 'Iedereen.',
			titleAccent: 'Tegelijk.',
			text: 'Wijzigingen van anderen verschijnen live. Je ziet wie naar welke rij kijkt, je bespreekt haar op de plek waar ze staat, en een @ is genoeg om een collega te waarschuwen.',
			demo: {
				path: 'Verkoop / Offertes',
				here: '3 personen op deze tabel',
				columns: {
					client: 'Klant',
					status: 'Fase',
					amount: 'Bedrag',
					due: 'Termijn',
				},
				statuses: {
					draft: 'Concept',
					sent: 'Verstuurd',
					signed: 'Getekend',
				},
				rows: [
					'Bakkerij Martens',
					'Kliniek De Linden',
					'Scholengemeenschap Het Kompas',
					'Fiets voor Iedereen',
					'De Lekkerbek',
					'Smederij De Maas',
				],
				comment: '@{name} kun je deze offerte voor vanavond goedkeuren?',
				reply: 'Goedgekeurd!',
				toast: '{name} heeft “{field}” gewijzigd',
			},
			points: {
				live: {
					title: 'Live',
					text: 'Elke wijziging verschijnt meteen bij de anderen, zonder de pagina te herladen.',
				},
				comments: {
					title: 'Opmerkingen en vermeldingen',
					text: 'Je bespreekt een rij op de plek waar ze staat, en de bel waarschuwt.',
				},
				undo: {
					title: 'Veilig ongedaan maken',
					text: 'Ctrl+Z maakt je laatste wijziging ongedaan — nooit die van een collega.',
				},
			},
			link: {
				href: '/fonctionnalites/collaboration/',
				label: 'Samen werken',
			},
		},
		forms: {
			eyebrow: 'Formulieren en enquêtes',
			title: 'Stel je vragen.',
			titleAccent: 'De antwoorden sorteren zichzelf.',
			text: 'Een formulier op één pagina, of een enquête die één vraag per scherm stelt, in je eigen kleuren: deel de link, en elk antwoord wordt een rij in je tabel. Wie antwoordt, ziet verder niets.',
			modes: {
				label: 'Vragen tonen',
				survey: 'Enquête',
				form: 'Formulier',
			},
			demo: {
				title: 'Offerteaanvraag',
				description: 'Drie vragen, en we nemen binnen 48 uur contact met je op.',
				count: '3 vragen',
				start: 'Beginnen',
				ok: 'OK',
				hint: 'of Enter',
				submit: 'Mijn aanvraag versturen',
				org: {
					label: 'Je organisatie',
					answer: 'Café De Kunst',
				},
				need: {
					label: 'Je behoefte',
					options: ['Site', 'Visuele identiteit', 'Catalogus'],
				},
				budget: {
					label: 'Je budget',
					help: 'Exclusief btw, een ruwe schatting volstaat.',
				},
				sent: 'Verzonden!',
				thanks: 'Bedankt! We nemen binnen 48 uur contact met je op.',
				poweredBy: 'Formulier aangedreven door basedb',
				path: 'Verkoop / Aanvragen',
				view: 'Alle aanvragen',
				columns: {
					org: 'Organisatie',
					need: 'Behoefte',
					budget: 'Budget',
					stage: 'Fase',
				},
				stages: {
					new: 'Nieuw',
					called: 'Teruggebeld',
					quote: 'Offerte verzonden',
				},
				rows: ['Bakkerij Martens', 'Kliniek De Linden', 'Fiets voor Iedereen', 'Smederij De Maas'],
				open: 'Open',
				answers: {
					one: '{n} antwoord',
					other: '{n} antwoorden',
				},
				active: 'Link actief',
			},
			points: {
				survey: {
					title: 'Eén vraag per scherm',
					text: 'Op volledig scherm, met het toetsenbord: Enter om door te gaan, A, B, C om te kiezen — een enkele keuze gaat vanzelf naar de volgende, en het versturen wordt gevierd.',
				},
				access: {
					title: 'Openbaar of beperkt',
					text: 'Iedereen met de link antwoordt zonder account — of alleen aangemelde leden, en het antwoord draagt hun naam.',
				},
				closed: {
					title: 'De rest blijft gesloten',
					text: 'Antwoorden toont verder niets van de tabel. De link sluit op een datum, of na een aantal antwoorden.',
				},
			},
			link: {
				href: '/fonctionnalites/formulaires-partages/',
				label: 'Formulieren',
			},
		},
		automate: {
			eyebrow: 'Automatiseringen',
			title: 'Het werkt',
			titleAccent: 'terwijl jij slaapt.',
			text: 'Wanneer een rij binnenkomt of verandert, op een vast tijdstip of met één klik op een knop, doorloopt basedb de stappen: het kiest de juiste vertakking, raadpleegt de AI, waarschuwt wie nodig is. En elke uitvoering lees je terug, stap voor stap.',
			clock: '03:12',
			crumb: 'Verkoop / Automatiseringen',
			create: 'Nieuwe automatisering',
			list: [
				{
					name: 'Nieuwe aanvraag',
					when: 'Er wordt een rij gemaakt',
				},
				{
					name: 'Offerte ondertekend',
					when: 'Er wordt een rij gewijzigd',
				},
				{
					name: 'Herinneringen op maandag',
					when: 'Elke maandag om 09:00',
				},
			],
			active: 'Actief',
			test: 'Testen op een rij',
			save: 'Opslaan',
			when: 'Wanneer',
			trigger: 'Er wordt een rij gemaakt',
			table: 'In Aanvragen',
			steps: {
				branch: {
					kind: 'Voorwaarde',
					text: '2 vertakkingen',
					run: 'vertakking “Groot project”',
				},
				notify: {
					kind: 'Iemand op de hoogte brengen',
					text: 'Léa Martin',
					run: '1 persoon op de hoogte gebracht',
				},
				create: {
					kind: 'Rij maken',
					text: 'Een afspraak, in Kalender',
					run: 'klaar',
				},
				slack: {
					kind: 'Versturen naar Slack',
					text: 'In het kanaal #verkoop',
					run: 'klaar',
				},
				ai: {
					kind: 'AI raadplegen',
					text: 'Een eerste antwoord opstellen',
					run: 'antwoord van {n} tekens',
				},
				update: {
					kind: 'Rij wijzigen',
					text: 'Antwoord, Fase',
					run: 'klaar',
				},
			},
			paths: {
				big: 'Groot project',
				condition: 'budget gt 5000',
				otherwise: 'Anders',
			},
			answer: 'Hallo, en bedankt voor je aanvraag! Léa, die je nieuwe visuele identiteit oppakt, belt je morgenochtend.',
			addStep: 'Stap toevoegen',
			tabs: {
				settings: 'Instellingen',
				runs: 'Uitvoeringen',
			},
			runsText: 'De laatste 50, 30 dagen bewaard. Kies er een om in de flow te zien welke vertakking die heeft gevolgd.',
			running: 'Bezig',
			succeeded: 'Geslaagd',
			started: 'rij gemaakt · {when}',
			now: 'zojuist',
			earlier: ['gisteren om 18:40', 'gisteren om 11:02'],
			done: 'Geslaagd · 5 stappen · 1,3 s',
			points: {
				when: {
					title: 'Op het juiste moment',
					text: 'Een rij die wordt gemaakt of gewijzigd, een vast tijdstip, een knop — en een voorwaarde zodat het alleen start wanneer het moet.',
				},
				paths: {
					title: 'Meerdere vertakkingen',
					text: 'Een voorwaarde opent vertakkingen, elk met eigen stappen; wat een stap vindt, kan de volgende gebruiken.',
				},
				copilot: {
					title: 'Beschreven in één zin',
					text: '“Als er een aanvraag binnenkomt, waarschuw Léa als het budget boven € 5.000 komt”: de Copilot bouwt de flow, jij leest hem na.',
				},
			},
			link: {
				href: '/fonctionnalites/automatisations/',
				label: 'Automatiseringen',
			},
		},
		glance: {
			eyebrow: 'Dashboards',
			title: 'Zie alles.',
			titleAccent: 'In één oogopslag.',
			text: 'Cijfers, lijnen, doelen: je dashboards bouw je met de muis vanuit je tabellen, en ze blijven zelf up-to-date. Eén filter, en het hele dashboard volgt.',
			demo: {
				title: 'Verkoopoverzicht',
				filters: ['Dit jaar', 'Alle steden'],
				revenue: 'Omzet',
				signed: 'Getekende offertes',
				rate: 'Tekenpercentage',
				goal: 'Jaardoel',
				byMonth: 'Omzet per maand',
				byStage: 'Offertes per fase',
				stages: ['Verstuurd', 'In overleg', 'Getekend'],
				bySector: 'Klanten per sector',
				sectors: ['Handel', 'Zorg', 'Onderwijs', 'Industrie'],
				shared: 'Gedeeld via link',
			},
			points: {
				viz: {
					title: 'Vijftien visualisaties',
					text: 'Cijfers, trends, doelen, lijnen, cirkeldiagrammen, trechters, draaitabellen, kaarten.',
				},
				filters: {
					title: 'Gemeenschappelijke filters',
					text: 'De periode, een klant, een stad: één filter stuurt een kaart aan, meerdere, of het hele dashboard.',
				},
				share: {
					title: 'Gedeeld via een link',
					text: 'Openbaar of alleen voor het team, en insluitbaar in een andere site.',
				},
			},
			link: {
				href: '/fonctionnalites/tableaux-de-bord/',
				label: 'De dashboards',
			},
		},
		ai: {
			eyebrow: 'Kunstmatige intelligentie',
			title: 'Beschrijf.',
			titleAccent: 'basedb bouwt.',
			text: 'Eén zin is genoeg voor een complete database, die je naleest voordat je hem aanmaakt. Daarna stelt de Copilot filters, grafieken en automatiseringen voor, en AI-velden vatten samen, classificeren en schrijven in jouw plaats.',
			prompt: 'Een opvolging van de sollicitaties voor onze drie openstaande vacatures, met de gesprekken.',
			thinking: 'Drie gekoppelde tabellen, klaar om na te lezen.',
			tables: {
				jobs: {
					name: 'Vacatures',
					fields: ['Functietitel', 'Afdeling', 'Open sinds'],
				},
				people: {
					name: 'Kandidaten',
					fields: ['Naam', 'Functie', 'Fase', 'Samenvatting'],
				},
				talks: {
					name: 'Gesprekken',
					fields: ['Kandidaat', 'Datum', 'Met', 'Beoordeling'],
				},
			},
			aiField: 'Samenvatting',
			aiValue: 'Zes jaar projectmanagement, goed met klanten; te bekijken: het Engels.',
			create: 'Database maken',
			providers: 'Met de aanbieder van jouw keuze — OpenAI, Anthropic, Mistral, of een model dat op je eigen machine draait. Er gaat niets weg zonder jouw toestemming.',
			link: {
				href: '/fonctionnalites/ia/',
				label: 'AI in basedb',
			},
		},
		features: {
			title: 'Alles wat je nodig hebt.',
			titleAccent: 'En nog veel meer.',
			text: 'Elke functie schrijft in dezelfde tabellen, met dezelfde rechten, in dezelfde geschiedenis.',
			tiles: {
				views: {
					stat: '10',
					title: 'manieren om je gegevens te bekijken',
					text: 'Raster, kanban, kalender, tijdlijn, galerie, lijst, landkaart, formulier, enquête en quiz, op dezelfde rijen. Ieder kiest de zijne.',
					href: '/fonctionnalites/vues/',
				},
				history: {
					stat: 'Ctrl+Z',
					title: 'Niets gaat verloren',
					text: 'Elke wijziging wordt bewaard met de waarde van ervoor; een fout maak je ongedaan, een verwijderde rij herstel je.',
					href: '/fonctionnalites/historique/',
				},
				forms: {
					title: 'Formulieren',
					text: 'Een link, openbaar of alleen voor het team: elk antwoord komt in de tabel, zonder de rest te openen.',
					href: '/fonctionnalites/formulaires-partages/',
				},
				viz: {
					stat: '15',
					title: 'visualisaties',
					text: 'Cijfers, trends, doelen, lijnen, cirkeldiagrammen, trechters, draaitabellen en kaarten.',
					href: '/fonctionnalites/tableaux-de-bord/',
				},
				formulas: {
					code: 'IF([Montant] > 10000, "Grand compte", "")',
					title: 'Formules in het Frans of het Engels',
					text: 'Net als in een spreadsheet — SI, ARRONDI, JOURS… of IF, ROUND, DAYS — maar berekend voor het hele team.',
					href: '/fonctionnalites/tables-et-champs/#formules',
				},
				rights: {
					title: 'Iedereen ziet wat hij moet zien',
					text: 'Lezen, bewerken, beheren, per team; een gevoelige kolom kun je verbergen.',
					href: '/fonctionnalites/droits/',
				},
				mentions: {
					bubble: '@Camille',
					title: 'Opmerkingen en vermeldingen',
					text: 'Je bespreekt een rij op de plek waar ze staat, en de bel waarschuwt.',
					href: '/fonctionnalites/collaboration/',
				},
				relations: {
					title: 'Alles is verbonden',
					text: 'Klanten, projecten, facturen: totalen en opzoekvelden werken dwars door de relaties heen.',
					href: '/fonctionnalites/tables-et-champs/',
				},
				templates: {
					stat: '10',
					title: 'kant-en-klare sjablonen',
					text: 'CRM, werving, voorraad, evenementen… of een database die je in één zin aan de AI beschrijft.',
					href: '/modeles/',
				},
				import: {
					title: 'Import in één sleep',
					text: 'Sleep een Excel-werkmap of een CSV erin: de kolommen en types worden geraden, de tabel wordt aangemaakt.',
					href: '/guides/premiers-pas/',
				},
				agenda: {
					title: 'Tot in je agenda',
					text: 'Een kalender wordt een feed voor Google Agenda, Outlook of Apple Calendar.',
					href: '/fonctionnalites/vues-partagees/',
				},
				files: {
					title: 'Bestanden en afbeeldingen',
					text: 'Offertes, foto’s, contracten; een afbeelding wordt de omslag van een kaart.',
					href: '/fonctionnalites/fichiers/',
				},
				share: {
					title: 'Gedeelde weergaven',
					text: 'Een alleen-lezen weergave via een link, in te sluiten in je eigen site.',
					href: '/fonctionnalites/vues-partagees/',
				},
				sync: {
					title: 'Gesynchroniseerde tabellen',
					text: 'Up-to-date gehouden vanuit een online CSV, een agenda of een andere basedb.',
					href: '/integrations/synchronisation/',
				},
				signin: {
					title: 'Eenvoudig inloggen',
					text: 'Google, Microsoft of een wachtwoord; je nodigt je collega’s uit via een link.',
					href: '/hebergement/connexion/',
				},
				languages: {
					title: 'In jouw taal',
					text: 'De interface neemt de taal van iedereen over, uit twintig talen.',
					href: '/fonctionnalites/droits/#jouw-instellingen',
				},
			},
		},
		yours: {
			eyebrow: 'Vrij en zelf gehost',
			per: 'per persoon. Voor altijd.',
			text: 'basedb is vrije software. Installeer het op je eigen server en nodig het hele team uit: geen abonnement, geen licenties om te tellen, en je gegevens blijven bij jou.',
			points: {
				home: {
					title: 'In eigen huis',
					text: 'Op je eigen server of die van je hoster, met een back-up zoals van elke PostgreSQL-database.',
				},
				free: {
					title: 'Vrij',
					text: 'Onder de AGPL-3.0-licentie: de code is open, en dat blijft zo.',
				},
				ai: {
					title: 'De AI van jouw keuze',
					text: 'Een aanbieder van de markt, een model dat op je eigen machine draait — of helemaal geen AI.',
				},
			},
			link: {
				href: '/guides/installation/',
				label: 'basedb installeren',
			},
		},
		gallery: {
			eyebrow: 'Sjablonen',
			title: 'Klaar in één minuut.',
			text: 'Begin met een sjabloon, met zijn tabellen, weergaven, dashboard en voorbeeldrijen, en pas het aan op jouw manier van werken.',
			use: 'Bekijken',
			ask: {
				title: 'Past er niets?',
				text: 'Beschrijf je behoefte in één zin: de AI stelt een database op maat voor.',
			},
			all: 'Alle sjablonen bekijken',
			previous: 'Vorige sjablonen',
			next: 'Volgende sjablonen',
		},
		developers: {
			title: 'En aan de technische kant?',
			text: 'Elke tabel is een echte PostgreSQL-tabel. REST-API, webhooks, MCP-server voor AI-agents, en een installatie met één commando.',
			link: 'De pagina voor ontwikkelaars',
		},
		faq: {
			title: 'Jouw vragen',
			items: [
				{
					q: 'Moet je kunnen programmeren?',
					a: 'Nee. Je maakt je tabellen, weergaven, formulieren, dashboards en automatiseringen met de muis. Formules schrijf je net als in een spreadsheet, in het Frans of het Engels: SI of IF, ARRONDI of ROUND, JOURS of DAYS…',
				},
				{
					q: 'Hoeveel kost het?',
					a: 'Niets: basedb is vrije software, zonder abonnement of prijs per persoon. Je hebt alleen een server nodig om het op te installeren.',
				},
				{
					q: 'Hoe installeer je het?',
					a: 'Op een server, met Docker: twee bestanden en één commando, een paar minuten voor wie zich met je IT bezighoudt. De installatiehandleiding legt alles stap voor stap uit.',
				},
				{
					q: 'Kunnen we onze spreadsheets overnemen?',
					a: 'Ja: sleep je Excel-werkmap, of een CSV, in basedb. De import raadt het type van elke kolom, maakt de tabel aan, en zegt rij per rij wat hij niet heeft kunnen overnemen.',
				},
				{
					q: 'Kunnen we met meerdere mensen tegelijk werken?',
					a: 'Daar is het voor gemaakt. Wijzigingen van anderen verschijnen live, je plaatst een opmerking bij een rij, vermeldt een collega met @, en een bel waarschuwt je.',
				},
				{
					q: 'En leest de AI onze gegevens?',
					a: 'Alleen als jij dat besluit. Zonder ingestelde AI-provider gaat er niets. Daarna stuurt een veld of automatisering die de AI raadpleegt alleen wat de instructie citeert, na jouw akkoord.',
				},
				{
					q: 'In welke taal?',
					a: 'In de jouwe: de interface neemt de taal van je browser over, uit twintig talen, en iedereen kan die in zijn instellingen wijzigen.',
				},
			],
		},
		cta: {
			title: 'Je team verdient beter',
			titleAccent: 'dan een gedeeld bestand.',
			text: 'Begin met een sjabloon, nodig je collega’s uit, en laat de “FINAL (2)” achter je.',
			primary: 'Sjablonen bekijken',
			secondary: 'basedb installeren',
		},
	},
	hero: {
		badge: 'Nieuw: automatiseringen als flow, dashboards en SQL-views',
		title: ['De collaboratieve', 'database: elke tabel', 'is een echte'],
		titleAccent: 'PostgreSQL-tabel.',
		lead: 'Het gemak van een gedeelde spreadsheet — rasters, weergaven, formulieren, rechten — met gegevens die leven in <strong>getypeerde tabellen met heldere namen</strong>. Je team werkt in de interface; je scripts, je BI-tools, je AI-agents en <code>psql</code> lezen dezelfde rijen.',
		install: 'Installeren met Docker',
		features: 'Functies bekijken',
		copy: 'Commando kopiëren',
		facts: ['Zelf gehost', 'AGPL-3.0', 'REST-API & MCP-server'],
		demo: {
			url: 'basedb.jouw-domein.nl',
			project: 'Hoofdproject',
			projectMeta: 'Project · 2 databases',
			filter: 'Databases en tabellen filteren',
			sales: 'Verkoop',
			support: 'Support',
			environment: 'Productie',
			clients: 'Klanten',
			opportunities: 'Kansen',
			quotes: 'Offertes',
			baseSection: 'Database · Verkoop',
			screens: ['Dashboards', 'Automatiseringen'],
			copilot: '✦ Copilot',
			allRows: '▦ Alle rijen ▾',
			tools: ['Filteren', 'Groeperen', 'Kleuren'],
			search: 'Zoeken…',
			add: '+ Toevoegen',
			columns: {
				name: 'Naam',
				status: 'Status',
				amount: 'Bedrag',
				client: 'Klant',
			},
			statuses: {
				nouveau: 'Nieuw',
				qualifie: 'Gekwalificeerd',
				proposition: 'Voorstel',
				negociation: 'Onderhandeling',
				gagne: 'Gewonnen',
				perdu: 'Verloren',
			},
			deals: {
				portail: {
					name: 'Vernieuwing portaal',
					client: 'Gemeente Waterdam',
				},
				erp: {
					name: 'ERP-migratie',
					client: 'Delorme Groep',
				},
				audit: {
					name: 'Beveiligingsaudit',
					client: 'Kliniek Sint-Rochus',
				},
				billetterie: {
					name: 'Online ticketverkoop',
					client: 'Schouwburg De Ronde',
				},
				flotte: {
					name: 'Wagenparkbeheer',
					client: 'Transport Kerlann',
				},
				mobile: {
					name: 'Mobiele app',
					client: 'Atelier Moreau',
				},
				intranet: {
					name: 'Vernieuwing intranet',
					client: '',
				},
			},
			toastTitle: 'Formulier “Offerteaanvraag”',
			toastText: 'openbaar antwoord · heeft “{name}” aangemaakt',
			cursor: 'Camille',
			psqlRows: '(2 rijen)',
		},
	},
	showcase: {
		label: 'De interface, in het echt',
		title: 'Alles wat je team verwacht van een gedeelde spreadsheet.',
		tabs: 'Schermafbeeldingen van de interface',
		alt: 'basedb — {labelLower}: {caption}',
		shots: {
			grille: {
				label: 'Raster',
				caption: 'Een raster dat in een echte tabel schrijft — met berekende velden: een duur via een formule, de stad van de klant via een opzoekveld, het aantal taken via een telling.',
			},
			kanban: {
				label: 'Kanban',
				caption: 'Dezelfde rijen in kolommen, volgens een enkele keuze: een omslagafbeelding, een beschrijving die de rij citeert. Een kaart verslepen is de rij wijzigen.',
			},
			galerie: {
				label: 'Galerie',
				caption: 'Kaarten met hun afbeelding, een kleur per status: de galerie, een van de acht manieren om een tabel te lezen.',
			},
			chronologie: {
				label: 'Tijdlijn',
				caption: 'Balken tussen twee datums, en de pijlen van hun afhankelijkheden — rood als de volgorde niet meer klopt.',
			},
			tableaux: {
				label: 'Dashboards',
				caption: 'Kaarten in een raster, in tabbladen, onder gemeenschappelijke filters: een trend, een doel, gestapelde reeksen — gelezen met ieders eigen rechten.',
			},
			automatisations: {
				label: 'Automatiseringen',
				caption: 'Als een taak klaar is, wordt gezocht wat er van het project overblijft; als er niets meer over is, schrijft de AI het afrondingsbericht en gaat het project naar “Livré”. Elke uitvoering lees je stap voor stap terug in de flow.',
			},
			commentaires: {
				label: 'Opmerkingen',
				caption: 'Je bespreekt een rij op de plek waar ze staat: opmerkingen, vermeldingen, meldingen.',
			},
			formulaire: {
				label: 'Formulier',
				caption: 'Een formulier deel je via een link, openbaar of alleen voor ingelogde leden.',
			},
			historique: {
				label: 'Geschiedenis',
				caption: 'Elke schrijfactie, waar ze ook vandaan komt — een persoon, een automatisering, directe SQL — met de waarden van ervoor.',
			},
			sql: {
				label: 'SQL',
				caption: 'Een query op de echte namen, opgeslagen onder de tabellen voor het hele team — die ieder uitvoert met zijn eigen rechten.',
			},
			vuesSql: {
				label: 'SQL-views',
				caption: 'Echte PostgreSQL-views, tussen de tabellen geplaatst met hun kleur en pictogram — en leesbaar vanuit psql.',
			},
		},
	},
	features: {
		postgres: {
			label: 'PostgreSQL, zonder vertaallaag',
			title: 'Een raster voor het team, een echte tabel {voor je tools.}',
			lead: 'Geen generiek model, geen JSON als vergaarbak, geen <code>field_1837</code>: een database is een schema, een tabel is een tabel, een veld is een getypeerde kolom met een leesbare naam.',
			bullets: [
				'<strong>Native types</strong>: <code>text</code>, <code>numeric</code>, <code>date</code>, <code>timestamptz</code>, <code>boolean</code> — en echte foreign keys voor relaties.',
				'<strong>Constraints die de database bewaakt</strong>: enkele keuzes als <code>CHECK</code>, gecontroleerde web- en e-mailadressen, relaties als <code>FOREIGN KEY</code>.',
				'<strong>Formules die PostgreSQL berekent</strong>: <code>JOURS([Fin]; [Début])</code> wordt een gegenereerde kolom, die <code>psql</code> leest zoals de andere.',
				'<strong>Directe SQL blijft toegestaan</strong> — en zelfs die komt in de geschiedenis, via een trigger.',
				'<strong>Query’s en SQL-views</strong> in de interface: opgeslagen query’s onder de tabellen, voor jezelf of voor het team, en echte PostgreSQL-views daartussen, die <code>psql</code> ook leest.',
				'<strong>Hernoemen is niet breken</strong>: de oude naam blijft beschikbaar via een compatibiliteitsalias, zolang je je query’s bijwerkt.',
			],
			links: [
				{
					href: '/integrations/sql/',
					label: 'Werken in SQL',
				},
				{
					href: '/fonctionnalites/requetes-et-vues-sql/',
					label: 'Query’s en SQL-views',
				},
				{
					href: '/architecture/principes/',
					label: 'De principes',
				},
			],
		},
		automations: {
			label: 'Automatiseren',
			title: 'Automatiseringen als flow, {AI bij elke stap.}',
			lead: 'Als een rij verandert, op een vast tijdstip of met één klik: een grafische editor zet de stappen achter elkaar, en elke uitvoering lees je terug in de flow.',
			bullets: [
				'<strong>Een leesbare flow</strong>: de trigger, daarna elke stap als kaart; een <strong>+</strong> op een lijn voegt op die plek een stap toe.',
				'<strong>Zoeken, beslissen, schrijven</strong>: een rij vinden, afhankelijk van voorwaarden de ene of de andere vertakking nemen, bewerken, aanmaken, een melding sturen, een webhook aanroepen, naar Slack schrijven.',
				'<strong>AI raadplegen</strong> in een stap: een instructie die de rij citeert, een antwoord gelezen als tekst, getal, datum of keuze, dat de volgende stappen hergebruiken.',
				'<strong>De Copilot</strong> stelt een complete automatisering voor op basis van één zin, of legt uit waarom een uitvoering is mislukt — niets wordt opgeslagen zonder jou.',
				'<strong>Met de rechten van wie haar heeft geschreven</strong>, en in de geschiedenis zoals elke andere schrijfactie.',
			],
			links: [
				{
					href: '/fonctionnalites/automatisations/',
					label: 'De automatiseringen',
				},
				{
					href: '/fonctionnalites/automatisations/#de-copilot',
					label: 'De Copilot',
				},
			],
			alt: 'basedb — de automatisering “Projet livré” in de flow-editor: als een taak klaar is, het tijdstip noteren, zoeken wat er van het project overblijft, de vertakking “Anders” nemen, de AI om het afrondingsbericht vragen, en dan het project leveren; rechts de laatste uitvoeringen, stap voor stap.',
		},
		dashboards: {
			label: 'Analyseren',
			title: 'Dashboards {zonder je tabellen te verlaten.}',
			lead: 'Vragen gesteld met de muis of in SQL, vijftien visualisaties, gemeenschappelijke filters — ieder leest ze met zijn eigen rechten.',
			bullets: [
				'<strong>Vragen</strong>: een tabel, haar koppelingen, filters en maten per dag, week, maand of jaar — of alleen-lezen SQL.',
				'<strong>Vijftien visualisaties</strong>: getal, trend, voortgang, meter, staven, lijnen, cirkel, trechter, draaitabel, landkaart…',
				'<strong>Verkennen met één klik</strong>: een punt opent zijn rijen, of een fijnere periode.',
				'<strong>Gemeenschappelijke filters</strong> die één, meerdere of alle kaarten aansturen.',
				'<strong>Delen via een link</strong>, openbaar of alleen voor leden, en insluiten in een andere site.',
			],
			links: [
				{
					href: '/fonctionnalites/tableaux-de-bord/',
					label: 'De dashboards',
				},
			],
			alt: 'basedb — een dashboard: trend van de maand, incassodoel, omzet per maand, sentiment van de reviews, onder filters op periode en klant.',
		},
		rights: {
			label: 'Samenwerken zonder alles open te zetten',
			title: 'Rechten tot op het veld, {een geschiedenis zonder gaten.}',
			lead: 'Rechten worden toegekend aan groepen, op een project, een database of een tabel, en gelden voor alles wat eronder valt. Een gevoelige kolom kun je voor een groep verbergen, of voor die groep niet bewerkbaar maken.',
			bullets: [
				'<strong>Vier niveaus</strong>: Geen toegang, Lezen, Bewerken, Beheren — de rechten van je groepen tellen op.',
				'<strong>Zelfs SQL volgt je rechten</strong>: in de interface ziet een query alleen de tabellen en velden die voor jou openstaan — en PostgreSQL zelf dwingt dat af.',
				'<strong>Elke schrijfactie wordt vastgelegd</strong> in dezelfde transactie: interface, API, agent, openbaar formulier of directe SQL.',
				'<strong>Een wijziging maak je ongedaan</strong>, een verwijderde rij herstel je, een verwijderde database ook.',
				'<strong>Beheer vraagt om bevestiging</strong>: een recht wijzigen kan alleen als je in de afgelopen vijf minuten je wachtwoord opnieuw hebt ingetypt.',
			],
			links: [
				{
					href: '/fonctionnalites/droits/',
					label: 'Rechten en groepen',
				},
				{
					href: '/fonctionnalites/historique/',
					label: 'De geschiedenis',
				},
			],
		},
		agents: {
			label: 'REST-API · MCP · webhooks',
			title: 'Je AI-agents krijgen de gegevens, {niet de sleutels van de kluis.}',
			lead: 'De MCP-server geeft agents twaalf tools; de REST-API geeft je programma’s dezelfde gegevens. Eén controlepunt voor rechten, dezelfde logs.',
			bullets: [
				'<strong>Eén token per database</strong>, standaard alleen-lezen, nooit met meer rechten dan de persoon die het heeft aangemaakt.',
				'<strong>Een agent verwijdert niets</strong> en wijzigt de structuur niet: hij stelt voor, een mens keurt goed.',
				'<strong>Gegenereerde documentatie</strong> voor elke database, gefilterd op je rechten, met de bijbehorende OpenAPI 3.1-specificatie.',
				'<strong>Webhooks</strong> bij elke schrijfactie: ondertekend, op volgorde en opnieuw geprobeerd.',
			],
			links: [
				{
					href: '/integrations/mcp/',
					label: 'Een agent aansluiten',
				},
				{
					href: '/integrations/api-rest/',
					label: 'De REST-API',
				},
			],
		},
	},
	sqlVisual: {
		interface: 'Interface',
		title: 'Nieuw veld · Kansen',
		labelField: 'Label',
		labelValue: 'Bedrag',
		typeField: 'Type',
		typeValue: 'Getal',
		descriptionField: 'Beschrijving',
		descriptionValue: 'Contractbedrag excl. btw',
		required: 'Verplicht',
		ai: 'AI',
		migration: 'een geplande migratie, korte locks',
	},
	rightsVisual: {
		groups: ['Beheerders', 'Verkopers', 'Support'],
		project: 'Hoofdproject',
		sales: 'Verkoop',
		opportunities: 'Kansen',
		clients: 'Klanten',
		support: 'Support',
		inherited: 'overgenomen',
		levels: {
			none: 'Geen toegang',
			read: 'Lezen',
			edit: 'Bewerken',
			manage: 'Beheren',
		},
		field: 'Veld “Marge”',
		hidden: 'Verborgen',
		sqlChange: '<b>Rechtstreekse SQL-sessie</b> heeft <b>“ERP-migratie”</b> gewijzigd',
		sqlMeta: '02:46 · lokale verbinding · psql',
		sqlDiff: 'Bedrag: <s>125.000</s> → 130.000',
		undo: '↶ Terugdraaien',
		formChange: '<b>Formulier “Offerteaanvraag”</b> heeft <b>“Vernieuwing intranet”</b> aangemaakt',
		formMeta: 'openbaar antwoord · gepubliceerd door Camille',
	},
	agentVisual: {
		agent: 'Agent',
		via: 'verbonden via MCP · token “Verkoop”',
		question: 'Hoeveel kansen zitten er in onderhandeling, en voor welk bedrag?',
		listArgs: 'opportunites · statut = Onderhandeling',
		answer: 'Twee kansen, <b>€ 182.000</b> in totaal: ERP-migratie (€ 130.000) en Wagenparkbeheer (€ 52.000).',
		request: 'Voeg een veld “Waarschijnlijkheid” toe, als percentage.',
		proposeArgs: 'opportunites · Waarschijnlijkheid · number',
		proposed: 'Voorgesteld: iemand van het team moet het goedkeuren in basedb.',
		badge: 'Voorstel',
		expires: 'verloopt over 23 uur',
		what: 'Het veld <b>“Waarschijnlijkheid”</b> (Getal) toevoegen aan <b>Kansen</b>',
		by: 'Voorgesteld door de agent · token “Verkoop”',
		refuse: 'Weigeren',
		approve: 'Goedkeuren',
	},
	bento: {
		label: 'En verder',
		title: 'Wat je van een teamtool verwacht, zonder PostgreSQL los te laten.',
		text: 'Elke functie schrijft in dezelfde tabellen, onder dezelfde rechten, in dezelfde geschiedenis.',
		more: 'Lees meer →',
		views: {
			title: 'Tien weergaven op dezelfde rijen',
			text: 'Gezamenlijk voor het hele team, of persoonlijk voor jou alleen: ieder kiest zijn eigen manier van lezen, niemand kopieert de gegevens.',
			chips: ['Raster', 'Kanban', 'Kalender', 'Tijdlijn', 'Galerie', 'Lijst', 'Landkaart', 'Formulier', 'Enquête', 'Quiz'],
		},
		forms: {
			title: 'Gedeelde formulieren',
			text: 'Een openbare link, of een link alleen voor ingelogde leden. Wie antwoordt, krijgt geen enkel recht op de tabel.',
			href: '/fonctionnalites/formulaires-partages/',
		},
		environments: {
			title: 'Omgevingen',
			text: 'Eén database, meerdere varianten. Vergelijk de structuur, migreer van de ene naar de andere, synchroniseer rijen.',
			chips: ['Productie', 'Acceptatie', 'Ontwikkeling'],
			href: '/fonctionnalites/environnements/',
		},
		collaboration: {
			title: 'Samenwerken',
			text: 'De schrijfacties van anderen komen realtime binnen, je ziet wie naar welke rij kijkt, en je bespreekt haar op de plek waar ze staat: opmerkingen, vermeldingen, meldingen. Ctrl+Z maakt de laatste schrijfactie ongedaan, en weigert liever dan het werk van een ander te overschrijven.',
			chips: ['Realtime', 'Aanwezigheid', 'Opmerkingen', 'Vermeldingen', 'Ctrl+Z'],
			href: '/fonctionnalites/collaboration/',
		},
		small: {
			ai: {
				title: 'AI in het raster',
				text: 'Een veld dat een model invult op basis van de andere kolommen, en een Copilot die filters, query’s en kolommen voorstelt, toe te passen met één klik. OpenAI, Anthropic, Mistral, of een model dat op je eigen machine draait.',
				code: 'Vat {{Notes}} samen in één zin',
				href: '/fonctionnalites/ia/',
			},
			formulas: {
				title: 'Relaties en formules',
				text: 'Echte foreign keys, formules in het Frans of het Engels die PostgreSQL berekent, en opzoekvelden, aggregaties en aantallen via relaties.',
				code: 'ROUND([Montant HT] * (1 + [Taux de TVA]), 2)',
				href: '/fonctionnalites/tables-et-champs/#formules',
			},
			richText: {
				title: 'Opgemaakte tekst en variabelen',
				text: 'Een visuele editor voor opgemaakte tekst, opgeschoond bij het schrijven; en in elke lange tekst wordt {{Ville}} gelezen met de waarde van de rij.',
				code: 'Levering op {{Date}} in {{Ville}}',
				href: '/fonctionnalites/tables-et-champs/#opgemaakte-tekst-en-variabelen',
			},
			languages: {
				title: 'In jouw taal',
				text: 'De interface neemt de taal van je browser over, uit twintig talen; ieder kan die in zijn instellingen wijzigen.',
				href: '/fonctionnalites/droits/#jouw-instellingen',
			},
			sharedViews: {
				title: 'Gedeelde weergaven',
				text: 'Een alleen-lezen weergave via een link, in te sluiten in een andere site; een kalender wordt een feed voor je agenda.',
				href: '/fonctionnalites/vues-partagees/',
			},
			syncedTables: {
				title: 'Gesynchroniseerde tabellen',
				text: 'Een tabel die up-to-date blijft vanuit een online CSV, een agenda, of de gedeelde weergave van een andere basedb.',
				href: '/integrations/synchronisation/',
			},
			templates: {
				title: 'Databasesjablonen',
				text: 'Tien kant-en-klare sjablonen, een database die je in één zin aan de AI beschrijft, en je eigen database opgeslagen als sjabloon.',
				href: '/modeles/',
			},
			files: {
				title: 'Bestanden en afbeeldingen',
				text: 'Op de schijf van de host of in S3-compatibele opslag: AWS, Scaleway, OVH, Cloudflare R2, Garage, MinIO…',
				href: '/fonctionnalites/fichiers/',
			},
			import: {
				title: 'Excel-, CSV- en JSON-import',
				text: 'Sleep een bestand erin: de import raadt de types, maakt de tabel aan of vult een bestaande tabel aan, en meldt rij voor rij wat er is geweigerd.',
				href: '/guides/premiers-pas/',
			},
			accounts: {
				title: 'Accounts en uitnodigingen',
				text: 'Ieder maakt zijn eigen account en projecten aan, en nodigt anderen uit via een link, met Lezen, Bewerken of Beheren; inloggen met een wachtwoord, Google, Microsoft of elke OpenID Connect-provider.',
				href: '/hebergement/connexion/',
			},
			webhooks: {
				title: 'Webhooks',
				text: 'Elke schrijfactie kan een ander systeem op de hoogte brengen: ondertekende payloads, op volgorde afgeleverd, opnieuw geprobeerd.',
				href: '/integrations/webhooks/',
			},
			settings: {
				title: 'Persoonlijke instellingen',
				text: 'Je taal, je thema, de volgorde van datums, je meldingen, je sessies en je tokens, op één plek.',
				href: '/fonctionnalites/droits/#jouw-instellingen',
			},
		},
	},
	selfHost: {
		label: 'Zelf gehost',
		title: 'Je gegevens blijven {in eigen huis.}',
		lead: 'basedb is vrije software (AGPL-3.0): één image, één PostgreSQL-database, en dat is alles — geen verplichte externe dienst, geen telemetrie. Maak een back-up met <code>pg_dump</code>, lees je gegevens met elke PostgreSQL-client.',
		services: {
			db: 'PostgreSQL 16, je gegevens',
			basedb: 'De interface, de REST-API en de MCP-server, op één poort',
			proxy: 'Caddy, automatische HTTPS (optioneel)',
		},
		links: [
			{
				href: '/hebergement/docker/',
				label: 'Handleiding Docker Compose →',
			},
			{
				href: '/hebergement/variables/',
				label: 'Alle variabelen →',
			},
		],
		steps: [
			{
				title: 'basedb ophalen',
				code: 'git clone https://github.com/eodia/basedb.git\ncd basedb && cp .env.example .env',
			},
			{
				title: 'Twee geheimen in .env',
				code: 'POSTGRES_PASSWORD=een-sterk-wachtwoord\n# openssl rand -base64 32\nBASEDB_ENCRYPTION_KEY=…',
			},
			{
				title: 'Starten',
				code: 'docker compose up -d\n# daarna http://localhost:3000: maak je account aan',
			},
		],
	},
	faq: {
		label: 'Veelgestelde vragen',
		title: 'Wat ons vaak gevraagd wordt.',
		text: 'Nog een vraag? <a href="/guides/introduction/">De documentatie</a> heeft vast het antwoord.',
		items: {
			difference: {
				q: 'Waarin verschilt basedb van andere collaboratieve databases?',
				a: 'In de plek waar de gegevens leven. Waar andere hun rijen opbergen in een generiek model (genummerde kolommen, JSON-documenten), maakt basedb per tabel een echte PostgreSQL-tabel en per veld een echte getypeerde kolom, met leesbare namen. Je gegevens blijven bruikbaar zonder basedb.',
			},
			sql: {
				q: 'Kan ik rechtstreeks in SQL naar de tabellen schrijven?',
				a: 'Ja. De constraints (types, verplicht, enkele keuzes, foreign keys) worden door PostgreSQL zelf bewaakt, en een trigger legt zelfs schrijfacties in directe SQL vast in de geschiedenis, met de sessie die ze uitvoerde. De SQL-console van de interface en psql lezen dezelfde tabellen; in de interface schrijft ieder SQL met zijn eigen rechten, slaat zijn query’s op en maakt er, als hij de database beheert, echte PostgreSQL-views van.',
			},
			ai: {
				q: 'Wat gaat er naar een AI-provider?',
				a: 'Niets zolang je geen provider hebt ingesteld. Daarna gaan voor structuurconcepten en de Copilot standaard alleen de structuur en je zin mee; de Copilot gegevens laten lezen is een vinkje, per gesprek. Een databasesjabloon dat je aan de AI vraagt, stuurt alleen je zin. Een AI-veld stuurt de kolommen die zijn instructie citeert, na uitdrukkelijke toestemming.',
			},
			together: {
				q: 'Kunnen meerdere mensen aan dezelfde tabel werken?',
				a: 'Ja. De schrijfacties van anderen verschijnen zonder herladen, met hun gezicht op de tabel of de rij waar ze naar kijken. Je plaatst een opmerking bij een rij, vermeldt iemand met @, en de bel waarschuwt. En Ctrl+Z maakt alleen je eigen schrijfacties ongedaan: het weigert liever dan te overschrijven wat een ander intussen heeft gewijzigd.',
			},
			languages: {
				q: 'In welke talen?',
				a: 'Twintig: Frans, Engels, Duits, Spaans, Italiaans, Braziliaans Portugees, Nederlands, Pools, Tsjechisch, Zweeds, Deens, Noors, Fins, Roemeens, Hongaars, Turks, Oekraïens, Japans, vereenvoudigd Chinees en Koreaans. De interface neemt de taal van de browser over, en ieder wijzigt die in zijn instellingen; deze site en de documentatie bestaan in dezelfde talen.',
			},
			agent: {
				q: 'Hoe maakt een AI-agent verbinding?',
				a: 'Via de MCP-server, met een integratietoken dat beperkt is tot één database, standaard alleen-lezen. Een agent leest, maakt en wijzigt rijen volgens zijn rechten; hij verwijdert niets en wijzigt de structuur niet: hij stelt voor, en een mens keurt goed.',
			},
			postgres: {
				q: 'Welke versie van PostgreSQL is nodig?',
				a: 'PostgreSQL 16 of nieuwer, met de extensies pg_trgm en unaccent (beschikbaar in de officiële image). De meegeleverde docker-compose start een PostgreSQL 16; je kunt DATABASE_URL ook naar je eigen server laten wijzen.',
			},
			production: {
				q: 'Is het klaar voor productie?',
				a: 'basedb wordt actief ontwikkeld: de kern, de API, de MCP-server en de interface werken en worden gedekt door meer dan duizend tests, maar sommige functies moeten nog komen (zie de roadmap). Probeer het uit, en maak back-ups van je database zoals van elke PostgreSQL-database.',
			},
			license: {
				q: 'Onder welke licentie?',
				a: 'AGPL-3.0-or-later. Je mag het vrij gebruiken, wijzigen en hosten; bied je een gewijzigde versie aan als dienst, dan deel je de broncode ervan.',
			},
		},
	},
	cta: {
		title: 'Je gegevens verdienen {echte tabellen.}',
		text: 'Installeer basedb in een paar minuten, nodig je team uit, en houd grip op elke rij.',
		install: 'basedb installeren',
		github: 'Code bekijken op GitHub',
	},
	changelog: {
		label: 'Wat is er nieuw',
		title: 'Wat er in basedb is veranderd',
		intro: 'Elke wijziging in detail staat in <a href="https://github.com/eodia/basedb/commits/main">de geschiedenis van de repository</a>. Wat er hierna komt: de <a href="/feuille-de-route/">roadmap</a>.',
		entries: {
			applications: {
				date: '2026-09-30',
				title: 'Voor toepassingen die op basedb bouwen',
				tag: 'Nieuw',
				items: [
					'<strong>Een database met één aanroep aangemaakt vanuit een sjabloon</strong>: de server past het hele sjabloon toe — tabellen, relaties, rijen, weergaven, automatiseringen — of niets als een stap mislukt. De galerij gebruikt dit, een toepassing die zich ook installeert. <a href="/integrations/api-rest/#een-database-aanmaken-vanuit-een-sjabloon">Een database aanmaken vanuit een sjabloon</a>',
					'<strong>Een token controleren</strong>: een toepassing waaraan het token van iemand wordt doorgegeven, vraagt basedb of het nog geldig is, en voor wie — zijn account, zijn groepen. <a href="/integrations/api-rest/#een-token-controleren">Een token controleren</a>',
					'<strong>Je interne servers</strong>: webhooks en automatiseringen bereiken degenen die je opgeeft in <code>BASEDB_WEBHOOK_ALLOW</code>, HTTP inbegrepen; een programma kan ook een tabel in realtime volgen met een integratietoken. <a href="/integrations/webhooks/#zonder-webhook-een-tabel-volgen">Een tabel volgen</a>',
					'<strong>Onder een pad, achter een gateway</strong>: basedb wordt gepubliceerd op een adres zoals <code>https://passerelle.example.com/basedb/</code>, of de gateway het pad nu behoudt of verwijdert. <a href="/hebergement/docker/#achter-een-gateway-onder-een-pad">Achter een gateway</a>',
					'<strong>Één webhook, alle tabellen tegelijk</strong>: een gebeurtenis aan- of uitvinken voor alle tabellen, of alle gebeurtenissen van één tabel, met één klik.',
				],
			},
			loopsWebhooks: {
				date: '2026-09-30',
				title: 'Automatiseringen die je rijen doorlopen en met API’s praten',
				tag: 'Nieuw',
				items: [
					'<strong>Voor elke rij</strong>: een stap die zijn eigen stappen herhaalt op elke rij van een tabel die aan een filter voldoet — elke maandag alle onbetaalde facturen aanmanen, niet alleen de eerste. <a href="/fonctionnalites/automatisations/#voor-elke-rij">Voor elke rij</a>',
					'<strong>Een webhook die met elke API praat</strong>: de methode, een adres dat de rij citeert, headers, een body in JSON, als formulier of als tekst, samengesteld met de waarden van de rij. <a href="/fonctionnalites/automatisations/#een-dienst-aanroepen">Een dienst aanroepen</a>',
					'<strong>Een API-sleutel blijft geheim</strong>: versleuteld wordt hij nooit meer getoond — niet op het scherm, niet door de API, niet aan Copilot — en gaat alleen naar de host waarvoor je hem hebt opgegeven.',
				],
			},
			maps: {
				date: '2026-09-30',
				title: 'De landkaart, en adressen die zich laten vinden',
				tag: 'Nieuw',
				items: [
					'<strong>Een tiende weergave, de landkaart</strong>: elke rij geplaatst op haar plek, aan de hand van haar adres of haar breedte- en lengtegraad. Een pin krijgt de kleur van een status en opent bij een klik haar rijdetails. <a href="/fonctionnalites/vues/#landkaart">De landkaart</a>',
					'<strong>Een adres wordt eenmalig gelokaliseerd</strong>, door de dienst van OpenStreetMap of de dienst die je kiest: de pins verschijnen naarmate de antwoorden binnenkomen, en daarna meteen. Een onvindbaar adres wordt geteld, nooit stilzwijgend genegeerd.',
					'<strong>Het formaat Adres</strong> voor een korte tekst: een klik opent het op de landkaart, en in de rijdetails stelt <strong>Adres zoeken</strong> de bijpassende volledige adressen voor. <a href="/fonctionnalites/tables-et-champs/#weergaveformaten">Formaten</a>',
				],
			},
			documents: {
				date: '2026-09-30',
				title: 'PDF’s vanuit je rijen',
				tag: 'Nieuw',
				items: [
					'<strong>Een offerte, een factuur, een fiche als PDF</strong>, vanuit het menu van een rij: de afdrukbare fiche zonder iets in te stellen, of een sjabloon — teksten die velden aanhalen, de velden van de rij, de tabel met gekoppelde rijen met haar totaal, pagina-einden. <a href="/fonctionnalites/documents/">De documenten</a>',
					'<strong>Iedereen met zijn eigen rechten</strong>: een veld dat voor jou verborgen is, verschijnt niet in jouw PDF. De twintig talen worden er correct in geschreven, Chinees, Japans en Koreaans inbegrepen, en de API levert hetzelfde document.',
				],
			},
			rows: {
				date: '2026-09-30',
				title: 'Rechten tot op de rij, standaardwaarden, de Excel-import',
				tag: 'Nieuw',
				items: [
					'<strong>Iedereen zijn eigen rijen</strong>: een groep ziet alleen de rijen van een filter — “Verkoper is ik”, “Regio is Noord” —, in de interface, de API, de MCP-server zoals in SQL, waar PostgreSQL dezelfde regel toepast. <a href="/fonctionnalites/droits/#tot-op-de-rij">Tot op de rij</a>',
					'<strong>Standaardwaarden</strong>: een vaste waarde, de datum van vandaag, het moment van aanmaak of de persoon die de rij aanmaakt, vooraf ingevuld op het scherm en overal elders toegepast. <a href="/fonctionnalites/tables-et-champs/#standaardwaarden">Standaardwaarden</a>',
					'<strong>Sleep een Excel-werkmap erin</strong>: kies het werkblad, datums, bedragen en selectievakjes komen aan zoals ze zijn, en een formule levert haar waarde. <a href="/guides/premiers-pas/">Eerste stappen</a>',
				],
			},
			mail: {
				date: '2026-09-30',
				title: 'E-mails',
				tag: 'Nieuw',
				items: [
					'<strong>Een stap “Een e-mail versturen”</strong> in de automatiseringen: aan een lid, aan de persoon van een veld, aan het adres van een klant, met de waarden van de rij in het onderwerp en de tekst. <a href="/fonctionnalites/automatisations/">Automatiseringen</a>',
					'<strong>E-mailmeldingen</strong> wanneer je ze niet hebt gelezen, gebundeld, één voor één te kiezen in je instellingen; en een <strong>wachtwoord vergeten</strong> wordt via een link opnieuw ingesteld. <a href="/fonctionnalites/collaboration/#per-e-mail">Per e-mail</a>',
					'Het volstaat om de instantie de verzendserver van je mail door te geven. <a href="/hebergement/variables/#e-mails">De variabelen</a>',
				],
			},
			integrations: {
				date: '2026-09-30',
				title: 'n8n en een TypeScript-SDK',
				tag: 'Nieuw',
				items: [
					'<strong>n8n-nodes</strong>: de rijen van een tabel lezen en schrijven vanuit een workflow, en er een starten bij elke aangemaakte, gewijzigde of verwijderde rij — via peiling of via een ondertekende webhook. <a href="/integrations/n8n/">n8n</a>',
					'<strong>Een TypeScript-SDK</strong>, met de types van je tabellen gegenereerd vanuit je instantie: een tabel of een veld dat niet bestaat is een fout nog vóór de uitvoering. <a href="/integrations/sdk/">De SDK</a>',
				],
			},
			quiz: {
				date: '2026-09-29',
				title: 'De quiz: vragen die de punten tellen',
				tag: 'Nieuw',
				items: [
					'<strong>Een nieuwe weergave, de quiz</strong>: een enquête waarin elke vraag zijn juiste antwoord en zijn punten kan hebben — een keuze, meerdere, ja of nee, een getal, een datum, of de geaccepteerde teksten, zonder rekening te houden met hoofdletters of accenten. <a href="/fonctionnalites/vues/#quiz">De quiz</a>',
					'<strong>Nagekeken zoals je wilt</strong>: na elke vraag — groen, of rood met het juiste antwoord, de score die boven aan het scherm groeit —, aan het einde, of nooit. Een slagingsgrens laat “Geslaagd!” of “Deze keer niet…” zeggen.',
					'<strong>De score aan het einde</strong>, in een ring die zich vult, dan het antwoordmodel van elke vraag. Hij wordt geschreven in een getalveld van de tabel: sorteer het raster erop, dat is de ranglijst.',
					'<strong>Gedeeld via een link, zonder te kunnen spieken</strong>: de pagina ontvangt geen enkel juist antwoord, de server kijkt na en telt. <a href="/fonctionnalites/formulaires-partages/#een-gedeelde-quiz">Een gedeelde quiz</a>',
					'<strong>Weergave maken</strong>, onderaan de weergavekiezer, verdeelt de negen soorten in twee families — die de rijen laten zien, die antwoorden verzamelen —, elk met een eigen gekleurd icoon.',
				],
			},
			forms: {
				date: '2026-09-29',
				title: 'Formulieren die je met plezier invult',
				tag: 'Nieuw',
				items: [
					'<strong>De enquête neemt het hele scherm in</strong>: één vraag tegelijk, die glijdend verschijnt, grote kaarten voor de keuzes, sterren voor een beoordeling, en alles met het toetsenbord — <strong>Enter</strong>, de letters A, B, C…, J of N, de cijfers. Een enkele keuze gaat vanzelf naar de volgende. <a href="/fonctionnalites/vues/#formulier-en-enquête">Formulier en enquête</a>',
					'<strong>Een eigen uiterlijk</strong>: acht thema’s, van Licht tot Nacht via Papier, een kleur, een lettertype, een uitlijning — de pagina van een gedeelde link draagt het ook.',
					'<strong>Alleen vragen als…</strong>: een vraag wordt alleen gesteld als een eerder antwoord erom vraagt; een verborgen vraag is niet verplicht en wordt niet opgeslagen.',
					'<strong>Niets in te stellen om te beginnen</strong>: een nieuw formulier vraagt wat iemand antwoordt, niet de status die het team later invult, draagt de kleur van zijn tabel en toont een voorbeeld in elk veld. En het verzenden wordt gevierd, confetti inbegrepen.',
				],
			},
			formulaLanguages: {
				date: '2026-09-28',
				title: 'Formules in het Frans of het Engels',
				tag: 'Nieuw',
				items: [
					'<strong>Typ een formule in het Frans of het Engels</strong>, op elk scherm, ook door de twee te mengen: <code>SI</code> of <code>IF</code>, <code>ARRONDI</code> of <code>ROUND</code>, <code>JOURS</code> of <code>DAYS</code>… De argumenten worden gescheiden door <code>;</code> of door <code>,</code>. <a href="/fonctionnalites/tables-et-champs/#formules">De formules</a>',
					'<strong>Ze wordt teruggelezen in de taal van het scherm</strong>: in het Frans op een Frans scherm, in het Engels in de negentien andere talen — bestaande formules en het paneel “Functies” inbegrepen. De API geeft een formule terug in de gevraagde taal, anders in het Engels.',
					'De officiële sjablonen, aangeboden in een andere taal dan het Frans, komen met hun formules in het Engels. Er verandert niets in de database: dezelfde kolommen, dezelfde SQL, zonder migratie.',
				],
			},
			search: {
				date: '2026-09-27',
				title: 'Alles vinden: Ctrl+K',
				tag: 'Nieuw',
				items: [
					'<strong>Één enkel veld voor alles</strong> — <strong>Ctrl+K</strong>, of het veld in het midden van de bovenste balk: tabellen, weergaven, vragen, dashboards, automatiseringen, kolommen, en de rijen zelf, gelezen met jouw rechten; op een groot scherm de voorvertoning van het gekozen resultaat. <a href="/fonctionnalites/recherche/">Zoeken</a>',
					'<strong>Typ zoals je denkt</strong>: zonder accenten of hoofdletters, met initialen — <code>nk</code> voor “Nieuwe klant” —, één typefout wordt vergeven, <code>klanten utrecht</code> om “utrecht” te zoeken in de tabel van de klanten; wat je vaak opent, komt boven.',
					'<strong>Alle opdrachten via het toetsenbord</strong>: aanmaken, naar iets gaan, sluiten, ongedaan maken, van thema wisselen, de link van de pagina kopiëren. <code>&gt;</code> zoekt alleen opdrachten, <code>#</code> objecten, <code>/</code> rijen; <strong>Tab</strong> zoekt binnen een tabel of database.',
					'<strong>Een vraag?</strong> Typ hem: <strong>Aan de Copilot vragen</strong> stelt hem, op de geopende database.',
				],
			},
			questions: {
				date: '2026-09-27',
				title: 'Eigen vragen, cijfers in de tekst',
				tag: 'Nieuw',
				items: [
					'<strong>Iedereen slaat zijn eigen vragen op</strong>, zonder het niveau Beheren: persoonlijke vragen ziet alleen jij; wie de database beheert, deelt ze met de hele database of met groepen, zoals de query’s. <a href="/fonctionnalites/tableaux-de-bord/">Dashboards</a>',
					'<strong>Een vraag in een tabblad</strong>, naast de tabellen: <strong>Nieuwe vraag</strong> en <strong>Nieuwe SQL-vraag</strong>, bij de <strong>+</strong> van de tabbladbalk en in het menu van de database; het tabblad bewaart wat je erin hebt achtergelaten. <strong>Kopie opslaan</strong> maakt een vraag die je niet mag wijzigen van jou.',
					'<strong>Cijfers in de tekst</strong>: een tekst van een dashboard, nu met opmaak, citeert een waarde — <code>{{chiffre_affaires}}</code> — afkomstig van een kaart, een vraag of een filter, berekend met de rechten van de lezer, ook in een dashboard dat via een link is gedeeld. <a href="/fonctionnalites/tableaux-de-bord/#cijfers-in-de-tekst">Cijfers in de tekst</a>',
					'Query’s, SQL-views en vragen kun je ook verwijderen vanuit hun menu, met een rechtsklik.',
				],
			},
			addresses: {
				date: '2026-09-27',
				title: 'Een adres voor elk scherm',
				tag: 'Nieuw',
				items: [
					'<strong>Het adres volgt het scherm</strong>: een tabel, een weergave, de rijdetails van een rij, een dashboard, een automatisering, een vraag, jouw instellingen — <code>/bases/ventes/tables/opportunites?ligne=…</code>. Sla het op als favoriet, plak het in een bericht: je komt op dezelfde plek terecht, met je eigen rechten. <a href="/fonctionnalites/collaboration/#een-link-naar-elk-scherm">Een link naar elk scherm</a>',
					'De knoppen <strong>vorige</strong> en <strong>volgende</strong> van de browser brengen je terug naar waar je was; een adres dat nergens naartoe leidt, toont “Deze pagina bestaat niet”.',
				],
			},
			demo: {
				date: '2026-09-27',
				title: 'Een demo om te proberen, in je taal',
				tag: 'Nieuw',
				items: [
					'<strong>De demo</strong>, op <a href="https://demo.basedb.eodia.com">demo.basedb.eodia.com</a>: het account is vooraf ingevuld in de taal van je browser, met een database in die taal. Je leest er alles en wijzigt wat bestaat; aanmaken, verwijderen en AI staan er uit, en de database komt elke nacht terug in haar oorspronkelijke staat.',
					'<strong>Je eigen demo</strong>: <code>BASEDB_DEMO=1</code> opent een instantie voor iedereen, met een gedeeld account per taal, van tevoren voorbereid. <a href="/hebergement/variables/#openbare-demo">De variabelen</a>',
					'<strong>Eén taal per link</strong>: <code>?lang=de</code> achter een basedb-adres toont het inlogscherm of een gedeelde pagina in het Duits; zo leidt de site naar de demo in de taal van de pagina. <a href="/fonctionnalites/droits/#jouw-instellingen">Jouw instellingen</a>',
				],
			},
			templateLanguages: {
				date: '2026-09-27',
				title: 'De sjablonen in je taal',
				tag: 'Nieuw',
				items: [
					'<strong>De officiële sjablonen worden aangemaakt in de taal van het scherm</strong>: tabellen, velden, keuzes, weergaven, dashboards, automatiseringen, AI-instructies — en voorbeeldrijen uit een wereld die is aangepast aan elke taal: de “Boulangerie Martin” uit Lyon wordt “Bakkerij De Boer” in Utrecht. <a href="/fonctionnalites/modeles/#in-je-taal">De sjablonen</a>',
					'De <a href="/modeles/">galerie van de site</a> toont elk sjabloon in de taal van de pagina.',
					'<strong>Één sjabloon, meerdere woordenboeken</strong>: een sjabloon wordt één keer geschreven, in het Frans; elke taal vertaalt er alleen de teksten van, en basedb volgt zelf elk label waar het wordt aangehaald. Een woordenboek dat het sjabloon zou breken, wordt niet gebruikt. <a href="/fonctionnalites/modeles/#een-sjabloon-publiceren-voor-alle-instanties">Een sjabloon publiceren</a>',
				],
			},
			details: {
				date: '2026-09-27',
				title: 'En verder',
				items: [
					'<strong>Een sjabloon zonder zijn voorbeeldrijen</strong>: “Voorbeeldgegevens laden”, uitgevinkt, maakt lege tabellen, klaar voor je eigen gegevens. <a href="/fonctionnalites/modeles/#starten-vanuit-een-sjabloon">Starten vanuit een sjabloon</a>',
					'<strong>De API- en MCP-documentatie</strong> van elke database wordt geschreven in de taal van je scherm. <a href="/integrations/api-rest/#de-gegenereerde-documentatie">De gegenereerde documentatie</a>',
					'Tooltips in het thema van de applicatie, overal waar de browser vroeger de zijne toonde; de “Verwijderen” in de menu’s in rood; de volledige datum bij het hoveren over het tijdstip van een opmerking.',
				],
			},
			languages: {
				date: '2026-09-27',
				title: 'Opgemaakte tekst, variabelen, een beter leesbaar kanban',
				tag: 'Nieuw',
				items: [
					'<strong>Opgemaakte tekst</strong>: een nieuw veldtype, opgemaakt in een visuele editor — koppen, lijsten, citaten, links —, opgeschoond bij het schrijven en door een constraint beschermd tegen directe SQL. <a href="/fonctionnalites/tables-et-champs/#opgemaakte-tekst-en-variabelen">Opgemaakte tekst en variabelen</a>',
					'<strong>Variabelen</strong>: een lange tekst citeert een kolom van zijn rij — <code>{{Ville}}</code> — en wordt overal met haar waarde gelezen: raster, rijdetails, API, MCP-server, gedeelde weergaven, automatiseringen. De kolom bewaart de verwijzing, en die leest <code>psql</code>.',
					'<strong>Een beter leesbaar kanban</strong>: luchtigere kaarten, een omslagafbeelding, en een beschrijving die de waarden van de rij citeert — “Levering op {{Date}} voor {{Client}}”. <a href="/fonctionnalites/vues/">De weergaven</a>',
					'<strong>Hernoemen in één handeling</strong>: één dialoogvenster voor een database, een tabel of een veld; het label verandert altijd, en een beheerder kan ook in de database hernoemen, met een impactanalyse erbij. <a href="/fonctionnalites/tables-et-champs/#de-structuur-wijzigen">De structuur wijzigen</a>',
					'<strong>Twintig talen</strong>: de interface, deze site en de documentatie in het Frans, Engels, Duits, Spaans, Italiaans, Portugees (Brazilië), Nederlands, Pools, Tsjechisch, Zweeds, Deens, Noors, Fins, Roemeens, Hongaars, Turks, Oekraïens, Japans, vereenvoudigd Chinees en Koreaans. basedb neemt de taal van de browser over; <strong>Instellingen › Uiterlijk › Taal</strong> stelt een andere in, die je van het ene apparaat naar het andere volgt. Getallen en datums volgen de taal. <a href="/fonctionnalites/droits/#jouw-instellingen">Jouw instellingen</a>',
				],
			},
			aiProvider: {
				date: '2026-09-27',
				title: 'De AI van jouw keuze, ook op je eigen machine',
				tag: 'Nieuw',
				items: [
					'<strong>Een vierde AI-provider</strong>: elke server die de API van OpenAI spreekt — Azure, een bedrijfsgateway, een model dat op je eigen machine draait —, opgegeven in de <code>.env</code>. Het logboek van de aanroepen zegt naar wie de gegevens zijn gegaan. <a href="/fonctionnalites/ia/">AI in basedb</a>',
					'<strong>Het inlogscherm</strong> toont, na het raster en SQL, een dashboard dat een filter volgt en een automatisering die wordt uitgevoerd, inclusief de AI-stap.',
				],
			},
			flows: {
				date: '2026-09-27',
				title: 'Automatiseringen als flow',
				tag: 'Nieuw',
				items: [
					'<strong>Een grafische editor</strong>: de trigger, daarna elke stap als kaart; een <strong>+</strong> op een lijn voegt op die plek een stap toe. Een eenvoudige automatisering past nog altijd op twee kaarten. <a href="/fonctionnalites/automatisations/">De automatiseringen</a>',
					'<strong>Een rij zoeken</strong> — de klant van een bestelling, de laatste onbetaalde factuur — en haar daarna wijzigen, citeren, of koppelen aan een nieuw aangemaakte rij.',
					'<strong>Voorwaarden met meerdere vertakkingen</strong>: de eerste waarvan de voorwaarde is vervuld, wordt genomen, “Anders” als geen enkele dat is; daarna komen de vertakkingen weer samen.',
					'<strong>Gegevens gaan van stap naar stap</strong>: <code>{{e2.client}}</code> citeert wat een stap heeft gevonden of aangemaakt, <code>{{e3.reponse.numero}}</code> wat een webhook heeft geantwoord; het menu van elke tekst biedt alleen aan wat met zekerheid eerder is gebeurd.',
					'<strong>Elke uitvoering, stap voor stap</strong>: op de flow geplaatst, tekent ze de genomen vertakking en zegt ze per stap wat die heeft gedaan en hoe lang dat duurde.',
					'<strong>De Copilot van automatiseringen</strong>: beschrijf wat de database uit zichzelf moet doen, of vraag waarom een uitvoering is mislukt; hij stelt een complete automatisering voor, die je met één klik in de flow plaatst, naleest en dan opslaat — niets wordt opgeslagen zonder jou. <a href="/fonctionnalites/automatisations/#de-copilot">De Copilot</a>',
					'<strong>AI raadplegen</strong> in een stap, net als in een AI-veld: een instructie die de rij en de vorige stappen citeert, een antwoord gelezen als tekst, getal, ja of nee, datum of keuze uit een lijst, dat de volgende stappen schrijven of versturen. <a href="/fonctionnalites/automatisations/#ai-raadplegen">AI raadplegen</a>',
				],
			},
			dashboards: {
				date: '2026-09-27',
				title: 'Dashboards: vragen, grafieken, filters',
				tag: 'Nieuw',
				items: [
					'<strong>Vragen</strong> gesteld met de muis — een tabel, haar koppelingen, filters, maten per dag, week, maand of jaar — of geschreven in <strong>SQL</strong>, alleen-lezen en met je eigen rechten, variabelen inbegrepen. <a href="/fonctionnalites/tableaux-de-bord/">De dashboards</a>',
					'<strong>Vijftien visualisaties</strong>: getal, trend ten opzichte van de vorige periode, voortgang naar een doel, meter, kolommen, staven, lijn, vlakken, combinatie, cirkel, trechter, spreidingsdiagram, tabel, draaitabel, landkaart van Frankrijk of van de wereld.',
					'<strong>Verkennen met één klik</strong>: een punt opent zijn rijen, een fijnere periode, een andere verdeling.',
					'<strong>Dashboards in een raster</strong>: kaarten die je met de muis verplaatst en vergroot of verkleint, tabbladen, sectietitels, teksten, ingesloten pagina’s.',
					'<strong>Gemeenschappelijke filters</strong> — periode, categorie, tekst, getal, datumgroepering — die één, meerdere of alle kaarten aansturen, met een standaardwaarde.',
					'<strong>Grafieken naar jouw hand</strong>: kleur en naam van elke reeks of elk segment, ring, halve cirkel of roos, stapelen met totalen, vloeiende lijnen of trappen, assen, schaalverdeling, logaritmische schaal; tabellen met hernoemde kolommen, met balken en kleuren volgens de waarde.',
					'<strong>De Copilot van dashboards</strong>: een gesprek dat vragen voorstelt, wijzigingen van het dashboard — terug te draaien — en waarden voor de filters, toe te passen met één klik. Alleen de structuur gaat naar de provider, tenzij je hem toestaat de resultaten te lezen. <a href="/fonctionnalites/tableaux-de-bord/#de-copilot">De Copilot</a>',
					'<strong>Een dashboard delen</strong> via een link, openbaar of alleen voor leden — desgewenst van bepaalde groepen — en het insluiten in een andere site: kaarten en filters, alleen-lezen, gelezen met de rechten van wie het heeft gepubliceerd. <a href="/fonctionnalites/tableaux-de-bord/#een-dashboard-delen">Delen</a>',
					'“Interfaces” heet voortaan <strong>Dashboards</strong>; bestaande dashboards openen zoals ze waren, op het nieuwe raster.',
				],
			},
			sqlViews: {
				date: '2026-09-27',
				title: 'Opgeslagen query’s en SQL-views',
				tag: 'Nieuw',
				items: [
					'<strong>SQL voor iedereen</strong>: zonder het niveau Beheren wordt een SQL-tabblad alleen-lezen uitgevoerd, met je eigen rechten, toegepast door PostgreSQL zelf — een gesloten tabel bestaat niet, een verborgen veld wordt geweigerd. Het label “Jouw rechten” herinnert je eraan. <a href="/fonctionnalites/requetes-et-vues-sql/">Query’s en SQL-views</a>',
					'<strong>Opgeslagen query’s</strong>, onder de tabellen in de rubriek “Query’s”: persoonlijk, voor de hele database of voor groepen. Een query delen deelt de tekst ervan, nooit wat de auteur mag lezen; vanuit de zijbalk geopend, wordt hij meteen alleen-lezen uitgevoerd.',
					'<strong>SQL-views</strong>: echte PostgreSQL-views, tussen de tabellen geplaatst met een kleur, een pictogram en een klein oog, ook leesbaar vanuit <code>psql</code> en je tools. Ieder leest ze met zijn eigen rechten, en de zijbalk toont ze alleen aan wie alles mag lezen wat ze bevatten.',
					'Views volgen de structuur: hernoemen breekt ze niet, een gewijzigde formule haalt ze even weg en zet ze daarna terug; een view die niet meer klopt, blijft te corrigeren, met behoud van zijn definitie.',
				],
			},
			settings: {
				date: '2026-09-27',
				title: 'Jouw instellingen',
				tag: 'Nieuw',
				items: [
					'<strong>Instellingen</strong>, in het profielmenu: je naam, je adres en de identiteitsproviders die aan je account zijn gekoppeld; je wachtwoord en je open sessies. <a href="/fonctionnalites/droits/">Accounts en inloggen</a>',
					'<strong>Uiterlijk</strong>: het thema, de volgorde van datums — <code>25/09/2026</code> of <code>2026-09-25</code> — en de eerste dag van de week in kalenders; de laatste twee volgen je van het ene apparaat naar het andere.',
					'<strong>Meldingen</strong>: zet de meldingen uit die je niet meer wilt, per soort. <strong>Tokens</strong>: de tokens die je hebt aangemaakt, in al je databases, hun laatste gebruik, en het intrekken ervan.',
				],
			},
			v020: {
				date: '2026-09-26',
				title: 'Versie 0.2.0: ieder zijn eigen account, projecten en uitnodigingen',
				tag: 'Nieuw',
				items: [
					'<strong>Eerste keer inloggen</strong>: op een nieuwe instantie maakt de eerste pagina het beheerdersaccount aan, met je adres en je wachtwoord — geen standaardaccount meer, en geen wachtwoord meer om in de logs op te zoeken. <a href="/guides/installation/">De installatie</a>',
					'<strong>Accounts aanmaken</strong>: ieder maakt zijn eigen account aan, en daarna zijn eigen projecten, die hij beheert. Het beheer kan dit sluiten of voorbehouden aan bepaalde domeinen. <a href="/hebergement/connexion/">Accounts en inloggen</a>',
					'<strong>Een project of een database delen</strong>: wie het niveau Beheren heeft, nodigt uit via een link, met Lezen, Bewerken of Beheren; ziet wie toegang heeft, wijzigt een niveau, trekt het in. Nooit meer dan wat hij beheert.',
					'<strong>Privacy</strong>: ieder ziet alleen nog de mensen met wie hij een project deelt, en een projectnaam die een ander al gebruikt, valt niet meer te raden.',
					'<strong>Inloggen met Google, Microsoft</strong> en elke OpenID Connect-provider (Keycloak, GitLab…), ingesteld in de <code>.env</code>; bij de eerste keer inloggen wordt het account aangemaakt als de instelling voor accounts aanmaken dat toestaat. <a href="/hebergement/connexion/">Instellen</a>',
					'<strong>Nieuw inlogscherm</strong>, in het thema van de applicatie, licht of donker, en ingetogen geanimeerd; geïllustreerde lege schermen in de applicatie.',
					'<strong>Updates zonder verlies</strong>: basedb werkt bij het opstarten zelf zijn catalogus bij, ook bij een 0.1-installatie, en weigert te starten op een database die een nieuwere versie al heeft bijgewerkt. <a href="/hebergement/sauvegardes/">Bijwerken</a>',
				],
			},
			dockerImage: {
				date: '2026-09-26',
				title: 'Eén Docker-image',
				tag: 'Hosting',
				items: [
					'basedb past in <strong>één image</strong>, <code>eodia/basedb</code> op Docker Hub, voor amd64 en arm64: de interface, de API onder <code>/api</code> en de MCP-server onder <code>/mcp</code>, op <strong>één poort</strong>. <a href="/guides/installation/">De installatie</a>',
					'Twee bestanden volstaan — <code>docker-compose.yml</code> en <code>.env</code> — zonder de repository te klonen of iets te bouwen; bijwerken doe je met <code>docker compose pull</code>.',
					'Achter een domein hoeft de HTTPS-proxy niets meer te routeren: alles gaat naar poort 3000.',
				],
			},
			automations: {
				date: '2026-09-26',
				title: 'Automatiseringen, interfaces, formules, samenwerking',
				tag: 'Nieuw',
				items: [
					'<strong>Formules</strong> met Franse functienamen — <code>SI</code>, <code>ARRONDI</code>, <code>JOURS</code>… — die kolommen worden die PostgreSQL genereert; <strong>opzoekvelden</strong>, <strong>aggregaties</strong> en <strong>aantallen</strong> via relaties. <a href="/fonctionnalites/tables-et-champs/">De velden</a>',
					'<strong>Nieuwe types</strong>: meervoudige relatie, persoon, e-mail, automatisch nummer, knop; en formaten die je kiest zoals types — valuta, percentage, duur, beoordeling met sterren, telefoon, streepjescode.',
					'<strong>Acht weergaven</strong>: de <strong>galerie</strong> en de <strong>lijst</strong> voegen zich bij de zes andere; <strong>persoonlijke weergaven</strong> voor elke lezer, vergrendelde weergaven, handmatige volgorde, afhankelijkheden in de tijdlijn. <a href="/fonctionnalites/vues/">De weergaven</a>',
					'<strong>Het raster</strong>: snel zoeken, groeperen, samenvatting per kolom over het hele filter, kleuren volgens regels, rijhoogte.',
					'<strong>Gedeelde weergaven</strong>, alleen-lezen, in te sluiten in een andere site; een kalender wordt een <strong>iCalendar-feed</strong> voor Google Agenda, Outlook of Apple Agenda. <a href="/fonctionnalites/vues-partagees/">Delen</a>',
					'<strong>Samenwerking</strong>: opmerkingen en vermeldingen, meldingen, schrijfacties van anderen in realtime, aanwezigheid op de tabel en op de rij. <a href="/fonctionnalites/collaboration/">Samenwerken</a>',
					'<strong>Ctrl+Z</strong> maakt de laatste schrijfactie ongedaan — een cel, een verplaatste kaart, een hele import — en weigert liever dan te overschrijven wat een ander intussen heeft gewijzigd.',
					'<strong>Automatiseringen</strong>: als een rij wordt aangemaakt of gewijzigd, op een vast tijdstip of met een klik op een knop — bewerken, aanmaken, een melding sturen, een webhook aanroepen, naar Slack schrijven. <a href="/fonctionnalites/automatisations/">Automatiseren</a>',
					'<strong>Interfaces</strong>: dashboards — cijfers, grafieken, lijsten, teksten — gelezen met ieders eigen rechten. <a href="/fonctionnalites/tableaux-de-bord/">De dashboards</a>',
					'<strong>Integraties</strong>: een Slack-kanaal, en <strong>gesynchroniseerde tabellen</strong> vanuit een online CSV, een agenda of de weergave van een andere basedb. <a href="/integrations/synchronisation/">De integraties</a>',
					'<strong>Databasesjablonen</strong>: een galerie met tien sjablonen, een database die je in één zin aan de AI beschrijft, en elke database is als sjabloon op te slaan. <a href="/modeles/">De galerie</a>',
					'<strong>Rechten</strong>: het scherm Structuur wordt alleen-lezen voor wie het niveau Beheren niet heeft.',
					'<strong>Nieuwe huisstijl</strong>: een logo, een kleurenpalet en een vernieuwd inlogscherm.',
				],
			},
			simpler: {
				date: '2026-09-26',
				title: 'Een eenvoudigere interface',
				items: [
					'<strong>De zijbalk</strong> toont alleen nog de databases en hun tabellen; de schermen van de geopende database — Structuur, Geschiedenis, Interfaces, Automatiseringen — staan samen in één blok, net boven het profiel.',
					'<strong>Het profielmenu</strong> bevat wat geen gegevens zijn: de API- en MCP-documentatie, de integraties, de gebruikers en de rechten.',
					'<strong>Een SQL-query</strong> open je met de “+” in de tabbladbalk of via het menu van de database, zonder dubbele vermelding in de zijbalk.',
					'<strong>Nieuwe database</strong> biedt meteen in het dialoogvenster de sjablonen en de AI aan; de demodatabase loopt via dezelfde galerie.',
					'<strong>Het scherm biedt niet meer aan wat geweigerd zou worden</strong>: geen structuurknoppen zonder Beheren, geen “Verwijderen” zonder het recht om te verwijderen; en een lezer maakt zijn eigen weergaven in plaats van op een foutmelding te stuiten.',
					'<strong>De systeemkolommen</strong> staan onder “Systeeminformatie” in plaats van op elke tabel te worden aangeboden.',
					'<strong>De rijdetails</strong> krijgen de opmerkingen van de rij, een knop om te mailen of te bellen, en een beoordeling die je met één klik instelt.',
					'<strong>Het inlogscherm</strong> ruilt zijn geanimeerde 3D-achtergrond in voor een licht scherm, dat de voorkeur “minder beweging” respecteert.',
				],
			},
			environments: {
				date: '2026-09-26',
				title: 'Omgevingen, gedeelde formulieren, weergaven',
				items: [
					'<strong>Omgevingen</strong>: productie, acceptatie en ontwikkeling voor dezelfde database; vergelijking naast elkaar, migratieplan, synchronisatie van rijen.',
					'<strong>Geschiedenis van de structuur</strong>: elke aanmaak of wijziging van een tabel of veld, vastgelegd door een trigger op de catalogus.',
					'<strong>Gedeelde formulieren</strong>: een openbare link of een link alleen voor leden, sluiten op datum of op aantal antwoorden, antwoorden toegeschreven in de geschiedenis.',
					'<strong>Zes weergaven</strong>: raster, kanban, kalender, tijdlijn, formulier, enquête.',
					'<strong>Geschiedenis van de gegevens</strong>: een wijziging ongedaan maken, een verwijderde rij herstellen.',
					'<strong>AI</strong>: de AI-optie op elk veld, en de Copilot.',
					'<strong>Relatie</strong> en <strong>URL</strong>: twee aparte types; lange tekst schrijf je in Markdown.',
					'<strong>Webhooks</strong>, ondertekend en op volgorde; <strong>voorstellen van agents</strong> om goed te keuren.',
					'<strong>Docker</strong>: een Dockerfile met drie targets, een volledige docker-compose, een optionele HTTPS-proxy.',
				],
			},
			projects: {
				date: '2026-09-25',
				title: 'Projecten, rechten, MCP-server',
				items: [
					'<strong>Projecten</strong> boven de databases, en rechten per <strong>groep</strong> op vier niveaus: Geen toegang, Lezen, Bewerken, Beheren.',
					'<strong>Accounts</strong>: tijdelijk wachtwoord, te wijzigen bij de eerste keer inloggen, verhoogde sessie voor het beheer.',
					'<strong>MCP-server</strong> en stdio-relay; <strong>integratietokens</strong> die de REST-API en MCP delen.',
					'<strong>Gegenereerde documentatie</strong> “API en MCP” voor elke database.',
				],
			},
			fields: {
				date: '2026-09-20',
				title: 'Velden, enkele keuzes, import',
				items: [
					'Een veld en de opties van een enkele keuze bewerken.',
					'<strong>Import</strong> van CSV- en JSON-bestanden.',
					'Het menu van een tabel: hernoemen, beschrijven, verwijderen.',
				],
			},
			firstCommit: {
				date: '2026-09-20',
				title: 'Eerste commit',
				items: [
					'De monorepo: naamgeving, register van foutcodes, catalogus afgeleid uit het architectuurdocument, kern, API, interface.',
				],
			},
		},
	},
	roadmap: {
		label: 'Roadmap',
		title: 'Wat er hierna komt',
		intro: 'basedb wordt actief ontwikkeld. Deze pagina zegt wat er nog ontbreekt, zonder beloofde datums. Een idee, een behoefte? <a href="https://github.com/eodia/basedb/issues">Open een issue</a>. Wat er al is: <a href="/nouveautes/">wat is er nieuw</a>.',
		columns: {
			next: {
				title: 'Binnenkort',
				items: {
					restoreTable: {
						title: 'Een losse tabel herstellen',
						text: 'Een verwijderde tabel blijft leesbaar in SQL onder haar verbannen naam; haar los terughalen vanuit de interface komt nog.',
					},
					aiSettings: {
						title: 'AI-instellingen in de interface',
						text: 'Provider, model en sleutel per werkruimte, zonder via de omgeving van de API te gaan.',
					},
					mail: {
						title: 'Meldingen en uitnodigingen per e-mail',
						text: 'Vermeldingen, antwoorden en toewijzingen komen vandaag binnen in basedb, uitnodigingen als een link die je zelf verstuurt; straks kunnen ze ook per e-mail vertrekken.',
					},
				},
			},
			later: {
				title: 'Daarna',
				items: {
					formLinks: {
						title: 'Relaties en bestanden in gedeelde formulieren',
						text: 'Een beperkte zoekfunctie in de gekoppelde tabel, een begrensde bestandsupload voor onbekenden.',
					},
					moreEvents: {
						title: 'Meldingen bij meer gebeurtenissen',
						text: 'Een melding krijgen bij een antwoord op een formulier, een voorstel van een agent, een uitgeschakelde webhook.',
					},
					sqlViewsAcross: {
						title: 'SQL-views over omgevingen heen',
						text: 'SQL-views meekopiëren met de structuur bij het aanmaken of vergelijken van omgevingen, en in databasesjablonen.',
					},
					loops: {
						title: 'Wachttijden in automatiseringen',
						text: 'Wachten vóór de volgende stap (“drie dagen later”), en flows – voorwaarden, zoekacties, lussen – meenemen in databasesjablonen.',
					},
					textFormulas: {
						title: 'Formules op tekst',
						text: 'Een deel van een tekst extraheren, vervangen of inkorten.',
					},
					bulk: {
						title: 'Gedeclareerde bulkbewerkingen',
						text: 'Wijzigingen van duizenden rijen, in de geschiedenis vastgelegd als één bewerking.',
					},
					tombstones: {
						title: 'Tombstones opruimen',
						text: 'Het opruimen van verwijderingssporen die niet meer nodig zijn.',
					},
				},
			},
		},
	},
	gallery: {
		label: 'Sjablonen',
		title: 'Een database, klaar in een paar seconden',
		intro: 'Elk sjabloon maakt tabellen aan die met elkaar zijn gekoppeld, voorbeeldrijen, weergaven, een dashboard, automatiseringen — en velden die de AI zelf invult. In basedb: <strong>Nieuwe database</strong>, daarna <strong>Beginnen met een sjabloon</strong>. Past er niets? Beschrijf je behoefte in één zin: de AI stelt een database op maat voor.',
		filter: 'Filteren op categorie',
		all: 'Alle',
		otherCategory: 'Overige',
		ai: '✦ AI',
		tables: {
			one: '{n} tabel',
			other: '{n} tabellen',
		},
		rows: {
			one: '{n} rij',
			other: '{n} rijen',
		},
		views: {
			one: '{n} weergave',
			other: '{n} weergaven',
		},
		howtoTitle: 'Sjablonen schrijven in JSON',
		howto: 'Een sjabloon is een JSON-bestand: de tabellen, velden, relaties, rijen, weergaven, dashboards, automatiseringen en de instructies van de AI-velden. De sjablonen op deze pagina zijn de bestanden in de map <a href="https://github.com/eodia/basedb/tree/main/packages/templates/catalog"><code>packages/templates/catalog</code></a> van de repository; elke basedb-instantie leest <a href="/modeles/catalogue.json"><code>catalogue.json</code></a> en biedt ze aan haar gebruikers aan. Een beheerder kan ook eigen sjablonen in zijn instantie importeren, en elke database kan als sjabloon worden opgeslagen.',
		format: {
			href: '/fonctionnalites/modeles/',
			label: 'Het formaat van de sjablonen →',
		},
		back: '← Alle sjablonen',
		defaultCategory: 'Sjabloon',
		sampleRows: {
			one: '{n} voorbeeldrij',
			other: '{n} voorbeeldrijen',
		},
		aiTitle: 'Wat de AI berekent',
		useTitle: 'Dit sjabloon gebruiken',
		useSteps: [
			'In basedb: <strong>Nieuwe database</strong>.',
			'<strong>Beginnen met een sjabloon</strong>, daarna “{label}”.',
		],
		create: '<strong>Database maken</strong>.',
		createWithAi: '<strong>Database maken</strong> — en desgewenst akkoord gaan dat de AI-velden door je AI-provider worden berekend.',
		download: 'JSON downloaden',
		downloadNote: 'Om het in je instantie te importeren, of om het aan te passen voordat je het voor de catalogus voorstelt.',
		viewMeta: '— {kind}, {table}',
		dashboard: '<strong>Dashboard</strong> “{label}” — {blocks}',
		blocks: {
			one: '{n} blok',
			other: '{n} blokken',
		},
		automation: '<strong>Automatisering</strong> “{label}”',
		yes: 'Ja',
		no: 'Nee',
		me: 'Jij',
		kinds: {
			short_text: 'Korte tekst',
			long_text: 'Lange tekst',
			rich_text: 'Opgemaakte tekst',
			number: 'Getal',
			boolean: 'Selectievakje',
			date: 'Datum',
			datetime: 'Datum en tijd',
			select: 'Enkele keuze',
			multi_select: 'Meerkeuze',
			url: 'URL',
			email: 'E-mail',
			user: 'Persoon',
			autonumber: 'Automatisch nummer',
			formula: 'Formule',
			lookup: 'Opzoeken',
			rollup: 'Aggregatie',
			count: 'Aantal',
			button: 'Knop',
			link: 'Relatie',
			multi_link: 'Meervoudige relatie',
		},
		viewKinds: {
			grid: 'Raster',
			kanban: 'Kanban',
			calendar: 'Kalender',
			timeline: 'Tijdlijn',
			gallery: 'Galerie',
			list: 'Lijst',
			form: 'Formulier',
		},
	},
	templates: {
		demo: {
			label: 'Demo: Atelier Lumen',
			summary: 'Een klein bureau, met klanten, projecten, taken, facturen en reviews: alle facetten van basedb in één database.',
			description: 'De demodatabase. Atelier Lumen is een fictief ontwerpbureau. De database toont relaties tussen tabellen, opzoekvelden en aggregaties (omzet per klant, gemiddelde beoordeling), formules (bedrag incl. btw, vertraging), drie velden die de AI berekent op basis van klantreviews (sentiment, thema, voorgesteld antwoord), elk soort weergave — raster, kanban, kalender, tijdlijn met afhankelijkheden, galerie, lijst, formulier —, een dashboard en twee automatiseringen.',
			category: 'Demo',
			tags: ['AI', 'Relaties', 'Alle weergaven', 'Dashboard'],
		},
		'analyse-avis': {
			label: 'Analyse van klantreviews',
			summary: 'Verzamel reviews en laat de AI er het sentiment, de thema’s, de urgentie en een conceptantwoord uit halen.',
			description: 'Voor een winkel, een restaurant of een merk: reviews komen binnen via een openbaar formulier of een import, en de AI leest ze allemaal. Ze bepaalt het sentiment, herkent het hoofdthema, markeert reviews die snel een antwoord nodig hebben, haalt de suggestie van de klant eruit en schrijft een antwoord om na te lezen. Producten tellen hun gemiddelde beoordeling en hun aantal reviews op; een dashboard volgt de tevredenheid.',
			category: 'Klantrelaties',
			tags: ['AI', 'Formulier', 'Dashboard'],
		},
		'base-connaissances': {
			label: 'Kennisbank',
			summary: 'Helpartikelen en klantvragen: de AI vat samen, classificeert en stelt een antwoord voor op basis van de artikelen.',
			description: 'Voor een supportafdeling. Helpartikelen zijn per categorie geordend en worden in de tijd gevolgd; klantvragen komen binnen via een openbaar formulier. De AI vat elk artikel samen en beoordeelt het niveau ervan, classificeert elke vraag en schrijft een conceptantwoord om na te lezen.',
			category: 'Support',
			tags: ['AI', 'Formulier', 'Lijst'],
		},
		'calendrier-editorial': {
			label: 'Contentkalender',
			summary: 'Artikelen, posts en nieuwsbrieven gepland in een kalender; de AI stelt pakkende openingszinnen en trefwoorden voor.',
			description: 'Voor een marketingteam of een redactie. Elke content gaat van idee tot publicatie, krijgt een plek op de publicatiekalender en hoort bij een campagne. De AI stelt een pakkende openingszin en trefwoorden voor op basis van de briefing, en via een formulier kan het hele bedrijf een onderwerp voorstellen.',
			category: 'Marketing',
			tags: ['AI', 'Kalender', 'Kanban', 'Formulier'],
		},
		crm: {
			label: 'Sales-CRM',
			summary: 'Bedrijven, contactpersonen en kansen: een verkooppijplijn, de contactmomenten en de AI die de volgende stap aanraadt.',
			description: 'Een lichtgewicht CRM voor een verkoopteam. Kansen gaan door een pijplijn en hebben een bedrag gewogen naar hun waarschijnlijkheid; de AI beoordeelt het risico en raadt de volgende actie aan op basis van de notities. Contactmomenten met klanten worden vastgelegd en samengevat, en bedrijven tellen op wat ze vertegenwoordigen.',
			category: 'Verkoop',
			tags: ['AI', 'Pijplijn', 'Kanban', 'Kalender'],
		},
		evenements: {
			label: 'Evenementen en inschrijvingen',
			summary: 'Conferenties, workshops en webinars: de inschrijvingen, de resterende plaatsen en de feedback van deelnemers, gelezen door de AI.',
			description: 'Voor het organiseren van terugkerende evenementen. Elk evenement telt de inschrijvingen en de resterende plaatsen; inschrijvingen lopen door tot aanwezigheid. Na het evenement laten deelnemers feedback achter die de AI op sentiment sorteert en samenvat. Via een openbaar formulier kun je je aanmelden voor de mailinglijst.',
			category: 'Evenementen',
			tags: ['AI', 'Kalender', 'Formulier', 'Aggregaties'],
		},
		'gestion-projet': {
			label: 'Projectbeheer',
			summary: 'Projecten, taken en mijlpalen: een roadmap, afhankelijkheden tussen taken, een kanbanbord en een kalender.',
			description: 'Voor het aansturen van meerdere projecten tegelijk. Elk project telt zijn taken en uren op; de taken volg je in een kanbanbord, plan je op een tijdlijn die hun afhankelijkheden tekent, en de mijlpalen lees je in een kalender. De AI schrijft een projectweerbericht voor de directie op basis van de beschrijving en de voortgang.',
			category: 'Organisatie',
			tags: ['Tijdlijn', 'Afhankelijkheden', 'Kanban', 'AI'],
		},
		inventaire: {
			label: 'Inventaris en voorraad',
			summary: 'Artikelen, leveranciers en voorraadbewegingen: de voorraad berekent zich vanzelf, tekorten zie je van tevoren.',
			description: 'Voor een werkplaats, een winkel of een facilitaire dienst. Elke in- of uitgaande beweging is een voorraadbeweging; de voorraad van elk artikel is de som ervan, de waarde een formule, en artikelen onder hun drempel verschijnen in “À commander” (te bestellen). De AI schrijft de beschrijving van elk artikel op basis van de naam en de categorie.',
			category: 'Bedrijfsvoering',
			tags: ['Aggregaties', 'Formules', 'Galerie', 'AI'],
		},
		recrutement: {
			label: 'Werving',
			summary: 'Openstaande vacatures, kandidaten en gesprekken; de AI vat elke sollicitatie samen en stelt punten voor om op door te vragen.',
			description: 'Een wervingstraject, van sollicitatie tot aanname. Kandidaten solliciteren via een openbaar formulier, gaan stap voor stap door een kanbanbord, en gesprekken worden in een kalender gepland. De AI leest de motivatiebrief en de notities: een samenvatting, en de vragen om in het gesprek te stellen. Ze helpt bij het lezen, ze beslist niet.',
			category: 'Human resources',
			tags: ['AI', 'Formulier', 'Kanban', 'Kalender'],
		},
		'suivi-tickets': {
			label: 'Ticketopvolging',
			summary: 'Bugs en verzoeken, gesorteerd door de AI en per sprint gevolgd tot ze zijn opgelost, met een meldingsformulier.',
			description: 'Een ticketsysteem voor een productteam. Elk ticket hoort bij een component en een sprint; de AI stelt een categorie voor, schat de ernst in en vat de melding samen. Een kanbanbord volgt de voortgang, een tijdlijn toont de sprints, via een formulier kan iedereen een probleem melden, en een automatisering noteert de datum van oplossing.',
			category: 'Product en techniek',
			tags: ['AI', 'Kanban', 'Formulier', 'Sprints'],
		},
	},
} satisfies DeepPartial<Dict>;
