/**
 * The Danish texts of the landing pages, laid over the French ones (`fr.ts`).
 *
 * See `../README.md`.
 */
import type { DeepPartial, Dict } from './index';

export default {
	meta: {
		home: {
			title: 'basedb — den kollaborative database, hvor hver tabel er en rigtig PostgreSQL-tabel',
			description: 'Gitre og otte visninger, formler, delte formularer og visninger, kommentarer, automatiseringer, dashboards, tilladelser helt ned til feltet, fuld historik, REST-API og MCP-server — på rigtige PostgreSQL-tabeller med læsbare navne. Selvhostet, AGPL-3.0.',
		},
		changelog: {
			title: 'Nyheder — basedb',
			description: 'Hvad der er ændret i basedb, version for version.',
		},
		roadmap: {
			title: 'Køreplan — basedb',
			description: 'Det, basedb skal kunne som det næste.',
		},
		gallery: {
			title: 'Skabeloner — basedb',
			description: 'Databaser klar til brug: sagsstyring, anmeldelsesanalyse, CRM, rekruttering… med eksempelrækker, visninger, dashboards og felter beregnet af AI.',
		},
		template: {
			title: '{label} — basedb-skabeloner',
		},
	},
	eodia: {
		home: 'https://eodia.com/',
		about: 'https://eodia.com/about/',
		contact: 'https://eodia.com/contact/',
	},
	demo: {
		short: 'Demo',
		cta: 'Prøv demoen',
	},
	nav: {
		aria: 'Hovednavigation',
		home: 'basedb — forside',
		links: [
			{
				href: '/#fonctionnalites',
				label: 'Funktioner',
			},
			{
				href: '/modeles/',
				label: 'Skabeloner',
			},
			{
				href: '/guides/introduction/',
				label: 'Dokumentation',
			},
			{
				href: '/nouveautes/',
				label: 'Nyheder',
			},
		],
		developers: 'Udviklere',
		github: 'basedbs GitHub-repository',
		install: 'Installer',
		menu: {
			open: 'Åbn menuen',
			close: 'Luk menuen',
			features: {
				label: 'Funktioner',
				groups: {
					organize: {
						title: 'Organisér',
						items: {
							tables: {
								href: '/fonctionnalites/tables-et-champs/',
								title: 'Tabeller og felter',
								text: 'Felter til alt, relationer og formler på fransk.',
							},
							views: {
								href: '/fonctionnalites/vues/',
								title: 'Otte visninger',
								text: 'Gitter, kanban, kalender, tidslinje, galleri, liste, formular, spørgeskema.',
							},
							forms: {
								href: '/fonctionnalites/formulaires-partages/',
								title: 'Formularer',
								text: 'Et link, du deler: hvert svar bliver en række.',
							},
							files: {
								href: '/fonctionnalites/fichiers/',
								title: 'Filer og billeder',
								text: 'Tilbud, billeder, kontrakter, gemt sammen med deres række.',
							},
						},
					},
					collaborate: {
						title: 'Samarbejd',
						items: {
							live: {
								href: '/fonctionnalites/collaboration/',
								title: 'Realtid og kommentarer',
								text: 'Se andre arbejde, kommenter en række, nævn en kollega.',
							},
							rights: {
								href: '/fonctionnalites/droits/',
								title: 'Tilladelser og grupper',
								text: 'Hvem ser hvad, og hvem redigerer hvad — helt ned til kolonnen.',
							},
							history: {
								href: '/fonctionnalites/historique/',
								title: 'Historik',
								text: 'Hver ændring gemmes og kan fortrydes.',
							},
							shared: {
								href: '/fonctionnalites/vues-partagees/',
								title: 'Delte visninger',
								text: 'Én visning via et link — på dit websted eller i din kalender.',
							},
						},
					},
					automate: {
						title: 'Automatisér og analysér',
						items: {
							automations: {
								href: '/fonctionnalites/automatisations/',
								title: 'Automatiseringer',
								text: 'Når en række ændres: giv besked, opret, skriv, spørg AI.',
							},
							dashboards: {
								href: '/fonctionnalites/tableaux-de-bord/',
								title: 'Dashboards',
								text: 'Femten visualiseringer, fælles filtre, et link at dele.',
							},
							ai: {
								href: '/fonctionnalites/ia/',
								title: 'AI og Copilot',
								text: 'En database i én sætning, felter der udfylder sig selv.',
							},
							templates: {
								href: '/modeles/',
								title: 'Skabeloner',
								text: 'Ti databaser klar til brug, som du kan tilpasse.',
							},
						},
					},
				},
				feature: {
					tag: 'Nyt',
					title: 'Automatiseringerne i flow',
					text: 'Søg, beslut, spørg AI: en grafeditor, og hver kørsel læses igen trin for trin.',
					href: '/nouveautes/',
					cta: 'Alle nyheder',
				},
				all: 'Alle funktioner',
			},
			solutions: {
				label: 'Løsninger',
				title: 'Til hvert team',
				items: {
					crm: {
						team: 'Salg',
						text: 'Pipeline, kontakter, opfølgning.',
					},
					recrutement: {
						team: 'HR',
						text: 'Ansøgninger, samtaler, AI-sammenfatninger.',
					},
					'calendrier-editorial': {
						team: 'Marketing',
						text: 'Artikler, opslag og planlagte nyhedsbreve.',
					},
					inventaire: {
						team: 'Drift',
						text: 'Beregnet lagerbeholdning, mangler set i god tid.',
					},
					'gestion-projet': {
						team: 'Projekter',
						text: 'Milepæle, opgaver og afhængigheder.',
					},
					'suivi-tickets': {
						team: 'Produkt',
						text: 'Fejl og ønsker sorteret af AI.',
					},
					'base-connaissances': {
						team: 'Support',
						text: 'Hjælpeartikler, spørgsmål, forslag til svar.',
					},
					evenements: {
						team: 'Arrangementer',
						text: 'Tilmeldinger, pladser, feedback.',
					},
					'analyse-avis': {
						team: 'Kunderelationer',
						text: 'Anmeldelser læst og klassificeret af AI.',
					},
				},
				ask: {
					title: 'Noget andet i tankerne?',
					text: 'Beskriv dit behov i én sætning: AI foreslår en skræddersyet database.',
					href: '/modeles/',
				},
				all: 'Alle skabeloner',
			},
			developers: {
				label: 'Udviklere',
				groups: {
					build: {
						title: 'Integrér',
						items: {
							api: {
								href: '/integrations/api-rest/',
								title: 'REST-API',
								text: 'De samme data som brugerfladen, beskrevet i OpenAPI 3.1.',
							},
							mcp: {
								href: '/integrations/mcp/',
								title: 'MCP-server',
								text: 'Værktøjer til dine AI-agenter, under dine tilladelser.',
							},
							webhooks: {
								href: '/integrations/webhooks/',
								title: 'Webhooks',
								text: 'Hver skrivning, signeret, i rækkefølge og gensendt ved fejl.',
							},
							sql: {
								href: '/integrations/sql/',
								title: 'Direkte SQL',
								text: 'Rigtige PostgreSQL-tabeller, med læsbare navne.',
							},
							sync: {
								href: '/integrations/synchronisation/',
								title: 'Synkronisering',
								text: 'Tabeller, der holdes opdateret udefra.',
							},
						},
					},
					host: {
						title: 'Hosting',
						items: {
							docker: {
								href: '/hebergement/docker/',
								title: 'Docker Compose',
								text: 'Ét image, én PostgreSQL-database, kun én port.',
							},
							env: {
								href: '/hebergement/variables/',
								title: 'Variabler',
								text: 'Alt indstilles i filen .env.',
							},
							https: {
								href: '/hebergement/https/',
								title: 'Domæne og HTTPS',
								text: 'Bag din egen proxy, eller med den medfølgende Caddy.',
							},
							sso: {
								href: '/hebergement/connexion/',
								title: 'Login og SSO',
								text: 'Google, Microsoft, enhver OpenID Connect-udbyder.',
							},
							backup: {
								href: '/hebergement/sauvegardes/',
								title: 'Backup og opdateringer',
								text: 'pg_dump, og opdateringer uden datatab.',
							},
						},
					},
				},
				feature: {
					title: 'Udviklersiden',
					text: 'En rigtig PostgreSQL-tabel bag hvert gitter.',
					href: '/developpeurs/',
				},
			},
			resources: {
				label: 'Ressourcer',
				groups: {
					learn: {
						title: 'Lær',
						items: {
							docs: {
								href: '/guides/introduction/',
								title: 'Dokumentation',
								text: 'Hele basedb, trin for trin.',
							},
							start: {
								href: '/guides/premiers-pas/',
								title: 'Kom godt i gang',
								text: 'Din første database, fra import til visning.',
							},
							install: {
								href: '/guides/installation/',
								title: 'Installation',
								text: 'To filer og én kommando.',
							},
							principles: {
								href: '/architecture/principes/',
								title: 'Principperne',
								text: 'Hvordan basedb er bygget, og hvorfor.',
							},
						},
					},
					follow: {
						title: 'Følg projektet',
						items: {
							news: {
								href: '/nouveautes/',
								title: 'Nyheder',
								text: 'Det, der er ændret, version for version.',
							},
							roadmap: {
								href: '/feuille-de-route/',
								title: 'Køreplan',
								text: 'Det, der kommer som det næste.',
							},
							github: {
								href: 'https://github.com/eodia/basedb',
								title: 'GitHub',
								text: 'Koden, tickets og versionerne.',
							},
							eodia: {
								href: 'https://eodia.com/',
								title: 'Eodia',
								text: 'Studiet, der laver basedb.',
							},
						},
					},
				},
			},
		},
	},
	language: {
		label: 'Sprog',
		current: 'Sprog: {name}',
	},
	footer: {
		tagline: 'Den kollaborative database, hvor hver tabel er en rigtig PostgreSQL-tabel.',
		madeBy: 'Fri software fra <a class="eodia" href="https://eodia.com/">Eodia</a>, et AI-native softwarestudie.',
		columns: {
			product: {
				title: 'Produkt',
				links: [
					{
						href: '/#fonctionnalites',
						label: 'Funktioner',
					},
					{
						href: '/nouveautes/',
						label: 'Nyheder',
					},
					{
						href: '/feuille-de-route/',
						label: 'Køreplan',
					},
					{
						href: '/#faq',
						label: 'Ofte stillede spørgsmål',
					},
				],
			},
			docs: {
				title: 'Dokumentation',
				links: [
					{
						href: '/guides/introduction/',
						label: 'Introduktion',
					},
					{
						href: '/guides/installation/',
						label: 'Installation',
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
						label: 'Miljøvariabler',
					},
					{
						href: '/hebergement/https/',
						label: 'Domæne og HTTPS',
					},
					{
						href: '/hebergement/sauvegardes/',
						label: 'Backup',
					},
				],
			},
			project: {
				title: 'Projekt',
				links: [
					{
						href: 'https://github.com/eodia/basedb',
						label: 'GitHub',
					},
					{
						href: 'https://github.com/eodia/basedb/tree/main/docs/architecture',
						label: 'Arkitekturdokument',
					},
					{
						href: 'https://github.com/eodia/basedb/blob/main/LICENSE',
						label: 'AGPL-3.0-licens',
					},
					{
						href: 'https://github.com/eodia/basedb/issues',
						label: 'Rapportér et problem',
					},
				],
			},
			eodia: {
				title: 'Eodia',
				links: [
					{
						href: 'https://eodia.com/',
						label: 'Studiet',
					},
					{
						href: 'https://eodia.com/about/',
						label: 'Om os',
					},
					{
						href: 'https://eodia.com/contact/',
						label: 'Kontakt os',
					},
				],
			},
		},
		copyright: '© {year} <a href="https://eodia.com/">Eodia</a> · AGPL-3.0-or-later',
		builtWith: 'Sitet er bygget med Astro og Starlight.',
	},
	docsFooter: {
		madeBy: 'basedb er fri software fra <a href="https://eodia.com/">Eodia</a>, et AI-native softwarestudie.',
	},
	teams: {
		meta: {
			title: 'basedb — alt jeres arbejde, på ét sted',
			description: 'Kunder, projekter, lager, ansøgninger: en database, hele teamet redigerer på samme tid, som tabel, kanban eller kalender, med dashboards, automatiseringer og AI. Uden kode, fri og gratis.',
		},
		hero: {
			eyebrow: 'basedb',
			title: 'Alt jeres arbejde.',
			titleAccent: 'Endelig på ét sted.',
			lead: 'Tabeller, kalendere, formularer, dashboards og automatiseringer, til hele teamet. Lige så enkelt som et regneark. Uden en linje kode.',
			primary: 'Se skabelonerne',
			secondary: 'Se demoen',
			facts: ['Uden kode', 'Fri og gratis', 'Dine data bliver hos dig'],
		},
		story: {
			grid: {
				title: 'Hele teamet, i den samme tabel.',
				text: 'Alle arbejder i den på samme tid, og alle ser det samme, opdateret.',
			},
			copilot: {
				title: 'Spørg. Copilot tager sig af det.',
				text: '»Hvem skal jeg følge op på i denne uge?« — Copilot foreslår det rette filter, og du anvender det med et klik.',
			},
			kanban: {
				title: 'Træk. Det er opdateret.',
				text: 'Hver fase bliver en kolonne; at flytte et kort er at redigere rækken.',
			},
			calendar: {
				title: 'Hver dato på sin plads.',
				text: 'Møderne vises af sig selv og følger med helt ind i din kalender.',
			},
			dashboard: {
				title: 'Og alt, med et blik.',
				text: 'Tallene beregner sig selv, ud fra de samme rækker.',
			},
		},
		stage: {
			aria: 'Et teams kundeopfølgning i basedb: tabel, Copilot, kanban, kalender, dashboard',
			tabs: {
				grid: 'Tabel',
				copilot: 'Copilot',
				kanban: 'Kanban',
				calendar: 'Kalender',
				dashboard: 'Dashboard',
			},
			project: 'Hovedprojekt',
			projectMeta: 'Projekt · 2 databaser',
			filterNav: 'Filtrér navigationen',
			base: 'Salg',
			otherBase: 'Support',
			tables: ['Kunder', 'Kontakter', 'Tilbud'],
			baseSection: 'Database · Salg',
			screens: ['Dashboards', 'Automatiseringer'],
			user: 'Léa Martin',
			views: {
				grid: 'Alle rækker',
				kanban: 'Efter fase',
				calendar: 'Møder',
			},
			toolbar: {
				filter: 'Filtrér',
				columns: 'Kolonner',
				group: 'Grupper',
				colors: 'Farver',
				sort: 'Sortér',
				configure: 'Konfigurer',
			},
			search: 'Søg…',
			add: 'Tilføj',
			columns: {
				name: 'Kunde',
				status: 'Fase',
				owner: 'Ansvarlig',
				amount: 'Beløb',
				next: 'Næste møde',
			},
			statuses: {
				contact: 'Skal kontaktes',
				meeting: 'Møde',
				quote: 'Tilbud sendt',
				signed: 'Signeret',
			},
			clients: [
				'Bageriet Holm',
				'Lindeklinikken',
				'H.C. Andersen Gymnasiet',
				'Cykler til Alle',
				'Delikatessen',
				'Fjordsmedjen',
				'Snedkeriet Lund',
			],
			addRow: 'Tilføj en række',
			perPage: 'Rækker pr. side',
			card: 'Fulgt af {owner}, møde den {date}',
			addCard: 'Tilføj et kort',
			today: 'I dag',
			month: 'Måned',
			week: 'Uge',
			dashboards: 'Dashboards',
			questions: 'Spørgsmål',
			dashboard: 'Salgsopfølgning',
			dashboardText: 'Det vigtigste, med et blik.',
			dashboardTabs: ['Overblik', 'Aktivitet'],
			period: 'Periode',
			thisYear: 'I år',
			share: 'Del',
			edit: 'Rediger',
			explore: 'Udforsk dataene',
			chart: 'Beløb pr. kunde',
			byStage: 'Kunder pr. fase',
			kpis: {
				signed: 'Signeret',
				pending: 'Afventende tilbud',
				rate: 'Signerede kunder',
			},
			copilot: {
				question: 'Hvem skal jeg følge op på i denne uge?',
				thinking: 'Tænker…',
				answer: 'Fire kunder venter på svar: to tilbud sendt og to møder, der skal forberedes.',
				card: 'Filtrér Kunder',
				filter: 'Fase: Tilbud sendt eller Møde',
				apply: 'Anvend filteret',
				applied: 'Filter anvendt',
				placeholder: 'Spørg Copilot…',
				filtered: '{n} filtrerede rækker',
			},
		},
		video: {
			eyebrow: 'Demoen',
			title: 'Hele basedb,',
			titleAccent: 'på fire minutter.',
			text: 'Opret en database, udfyld den, del den, automatisér den, styr den: den fulde rundvisning, med kommentarer.',
			play: 'Afspil videoen',
			duration: '4 min. 35 sek.',
			chapters: 'Kapitler',
			captions: 'Fransk',
			inFrench: 'Videoen er på fransk, med franske undertekster.',
			list: [
				{ time: '0:08', title: 'Opret en database' },
				{ time: '0:35', title: 'Tabeller, felter og formler' },
				{ time: '1:10', title: 'Rækkedetaljer og samarbejde' },
				{ time: '1:33', title: 'Otte visninger af de samme rækker' },
				{ time: '2:01', title: 'Formularer og AI' },
				{ time: '2:37', title: 'Automatiseringer' },
				{ time: '2:59', title: 'Dashboards' },
				{ time: '3:15', title: 'SQL til alle' },
				{ time: '3:43', title: 'Historik og tilladelser' },
				{ time: '4:01', title: 'API, MCP og Copilot' },
			],
		},
		together: {
			eyebrow: 'Samarbejde',
			title: 'Alle sammen.',
			titleAccent: 'På samme tid.',
			text: 'Andres ændringer vises i realtid. Du ser, hvem der kigger på hvilken række, I diskuterer den der, hvor den er, og et @ er nok til at give en kollega besked.',
			demo: {
				path: 'Salg / Tilbud',
				here: '3 personer på denne tabel',
				columns: {
					client: 'Kunde',
					status: 'Fase',
					amount: 'Beløb',
					due: 'Forfaldsdato',
				},
				statuses: {
					draft: 'Kladde',
					sent: 'Sendt',
					signed: 'Signeret',
				},
				rows: [
					'Bageriet Holm',
					'Lindeklinikken',
					'H.C. Andersen Gymnasiet',
					'Cykler til Alle',
					'Delikatessen',
					'Fjordsmedjen',
				],
				comment: '@{name} kan du godkende dette tilbud før i aften?',
				reply: 'Det er godkendt!',
				toast: '{name} har ændret »{field}«',
			},
			points: {
				live: {
					title: 'I realtid',
					text: 'Hver ændring vises straks hos de andre, uden at siden skal genindlæses.',
				},
				comments: {
					title: 'Kommentarer og omtaler',
					text: 'Du kommenterer en række, nævner en kollega med @, og klokken giver besked.',
				},
				undo: {
					title: 'Fortryd uden risiko',
					text: 'Ctrl+Z fortryder din seneste ændring — aldrig en kollegas.',
				},
			},
			link: {
				href: '/fonctionnalites/collaboration/',
				label: 'Arbejd sammen',
			},
		},
		automate: {
			eyebrow: 'Automatiseringer',
			title: 'Den arbejder',
			titleAccent: 'mens du sover.',
			text: 'Beskriv én gang, hvad der skal ske. Når en række ændres, hver morgen på et fast tidspunkt eller med et klik på en knap, kører basedb trinnene igennem — og hver kørsel kan læses igen, trin for trin.',
			clock: '03:12',
			when: 'Når',
			trigger: 'et tilbud skifter til »Signeret«',
			steps: {
				find: {
					kind: 'Find en række',
					text: 'Tilbuddets kunde',
				},
				ai: {
					kind: 'Spørg AI',
					text: 'Skriv en takkebesked',
				},
				create: {
					kind: 'Opret en række',
					text: 'Fakturaen, i Fakturaer',
				},
				notify: {
					kind: 'Giv besked',
					text: 'Bogholderiet',
				},
				slack: {
					kind: 'Send til Slack',
					text: 'I kanalen #salg',
				},
			},
			answer: 'Tak for din tillid! Vi går i gang med jeres projekt allerede på mandag, og fakturaen følger med på mail.',
			done: 'Gennemført · 5 trin · 1,2 s',
			copilot: {
				prompt: 'Når et tilbud bliver signeret, giv bogholderiet besked og opret fakturaen.',
				text: 'Én sætning til Copilot, og automatiseringen er bygget: du skal bare læse den igennem.',
			},
			link: {
				href: '/fonctionnalites/automatisations/',
				label: 'Automatiseringerne',
			},
		},
		glance: {
			eyebrow: 'Dashboards',
			title: 'Se alt.',
			titleAccent: 'Med et blik.',
			text: 'Tal, kurver, mål: dine dashboards bygges med musen ud fra dine tabeller og holder sig selv opdateret. Ét filter, og hele dashboardet følger med.',
			demo: {
				title: 'Salgsstyring',
				filters: ['Dette år', 'Alle byer'],
				revenue: 'Omsætning',
				signed: 'Signerede tilbud',
				rate: 'Signeringsrate',
				goal: 'Årligt mål',
				byMonth: 'Omsætning pr. måned',
				byStage: 'Tilbud pr. fase',
				stages: ['Sendt', 'Under forhandling', 'Signeret'],
				bySector: 'Kunder pr. branche',
				sectors: ['Handel', 'Sundhed', 'Uddannelse', 'Industri'],
				shared: 'Delt via link',
			},
			points: {
				viz: {
					title: 'Femten visualiseringer',
					text: 'Tal, tendenser, mål, kurver, brancher, tragte, krydstabeller, kort.',
				},
				filters: {
					title: 'Fælles filtre',
					text: 'Perioden, en kunde, en by: ét filter styrer ét kort, flere, eller hele dashboardet.',
				},
				share: {
					title: 'Delt via link',
					text: 'Offentligt eller forbeholdt teamet, og kan indlejres på et andet websted.',
				},
			},
			link: {
				href: '/fonctionnalites/tableaux-de-bord/',
				label: 'Dashboards',
			},
		},
		ai: {
			eyebrow: 'Kunstig intelligens',
			title: 'Beskriv.',
			titleAccent: 'basedb bygger.',
			text: 'Én sætning er nok til at få en komplet database, som du læser igennem, før du opretter den. Bagefter foreslår Copilot filtre, grafer og automatiseringer, og AI-felterne opsummerer, klassificerer og skriver for dig.',
			prompt: 'En opfølgning af ansøgninger til vores tre ledige stillinger, med samtalerne.',
			thinking: 'Tre tabeller forbundet, klar til at læse igennem.',
			tables: {
				jobs: {
					name: 'Stillinger',
					fields: ['Titel', 'Afdeling', 'Åbnet den'],
				},
				people: {
					name: 'Kandidater',
					fields: ['Navn', 'Stilling', 'Fase', 'Sammenfatning'],
				},
				talks: {
					name: 'Samtaler',
					fields: ['Kandidat', 'Dato', 'Med', 'Vurdering'],
				},
			},
			aiField: 'Sammenfatning',
			aiValue: 'Seks års erfaring med projektstyring, god med kunder; skal uddybes: engelsk.',
			create: 'Opret database',
			providers: 'Med udbyderen af dit valg — OpenAI, Anthropic, Mistral, eller en model installeret hos dig selv. Intet sendes uden din accept.',
			link: {
				href: '/fonctionnalites/ia/',
				label: 'AI i basedb',
			},
		},
		features: {
			title: 'Alt, hvad du har brug for.',
			titleAccent: 'Og meget mere.',
			text: 'Hver funktion skriver i de samme tabeller, under de samme tilladelser, i den samme historik.',
			tiles: {
				views: {
					stat: '8',
					title: 'måder at se dine data på',
					text: 'Gitter, kanban, kalender, tidslinje, galleri, liste, formular og spørgeskema, på de samme rækker. Alle vælger deres egen.',
					href: '/fonctionnalites/vues/',
				},
				history: {
					stat: 'Ctrl+Z',
					title: 'Intet går tabt',
					text: 'Hver ændring gemmes med den tidligere værdi; en fejl kan fortrydes, en slettet række kan gendannes.',
					href: '/fonctionnalites/historique/',
				},
				forms: {
					title: 'Formularer',
					text: 'Et offentligt link eller forbeholdt teamet: hvert svar lander i tabellen, uden at åbne resten.',
					href: '/fonctionnalites/formulaires-partages/',
				},
				viz: {
					stat: '15',
					title: 'visualiseringer',
					text: 'Tal, tendenser, mål, kurver, brancher, tragte, krydstabeller og kort.',
					href: '/fonctionnalites/tableaux-de-bord/',
				},
				formulas: {
					code: 'SI([Montant] > 10000; "Grand compte"; "")',
					title: 'Formler på fransk',
					text: 'Ligesom i et regneark — SI, ARRONDI, JOURS… — men beregnet for hele teamet.',
					href: '/fonctionnalites/tables-et-champs/#formler',
				},
				rights: {
					title: 'Alle ser kun det, de skal se',
					text: 'Læse, redigere, administrere — team for team; en følsom kolonne kan skjules.',
					href: '/fonctionnalites/droits/',
				},
				mentions: {
					bubble: '@Camille',
					title: 'Kommentarer og omtaler',
					text: 'I diskuterer en række der, hvor den er, og klokken giver besked.',
					href: '/fonctionnalites/collaboration/',
				},
				relations: {
					title: 'Alt er forbundet',
					text: 'Kunder, projekter, fakturaer: summer og opslag går igennem relationerne.',
					href: '/fonctionnalites/tables-et-champs/',
				},
				templates: {
					stat: '10',
					title: 'skabeloner klar til brug',
					text: 'CRM, rekruttering, lager, arrangementer… eller en database beskrevet for AI i én sætning.',
					href: '/modeles/',
				},
				import: {
					title: 'Import med et enkelt træk',
					text: 'Træk en CSV-fil ind: kolonner og typer gættes, og tabellen oprettes.',
					href: '/guides/premiers-pas/',
				},
				agenda: {
					title: 'Helt ind i din kalender',
					text: 'En kalender bliver til et feed til Google Kalender, Outlook eller Apple Calendar.',
					href: '/fonctionnalites/vues-partagees/',
				},
				files: {
					title: 'Filer og billeder',
					text: 'Tilbud, billeder, kontrakter; et billede bliver forsiden på et kort.',
					href: '/fonctionnalites/fichiers/',
				},
				share: {
					title: 'Delte visninger',
					text: 'En skrivebeskyttet visning via et link, der kan indlejres på dit websted.',
					href: '/fonctionnalites/vues-partagees/',
				},
				sync: {
					title: 'Synkroniserede tabeller',
					text: 'Holdt opdateret fra en online-CSV, en kalender eller en anden basedb.',
					href: '/integrations/synchronisation/',
				},
				signin: {
					title: 'Enkel login',
					text: 'Google, Microsoft eller adgangskode; du inviterer dine kolleger med et link.',
					href: '/hebergement/connexion/',
				},
				languages: {
					title: 'På dit eget sprog',
					text: 'Brugerfladen bruger den enkeltes sprog, ét af tyve.',
					href: '/fonctionnalites/droits/#dine-indstillinger',
				},
			},
		},
		yours: {
			eyebrow: 'Fri og selvhostet',
			per: 'pr. person. For evigt.',
			text: 'basedb er fri software. Installer det på din egen server, og inviter hele teamet: ingen abonnement, ingen licenser at holde styr på, og dine data bliver hos dig.',
			points: {
				home: {
					title: 'Hos dig selv',
					text: 'På din egen server eller din udbyders, med backup som enhver anden PostgreSQL-database.',
				},
				free: {
					title: 'Frit',
					text: 'Under AGPL-3.0-licensen: koden er åben, og det bliver den ved med at være.',
				},
				ai: {
					title: 'AI efter eget valg',
					text: 'En udbyder fra markedet, en model installeret hos dig selv — eller ingen AI overhovedet.',
				},
			},
			link: {
				href: '/guides/installation/',
				label: 'Installer basedb',
			},
		},
		gallery: {
			eyebrow: 'Skabeloner',
			title: 'Klar på et minut.',
			text: 'Start med en skabelon, med dens tabeller, visninger, dashboard og eksempelrækker, og tilpas den til jeres måde at arbejde på.',
			use: 'Se',
			ask: {
				title: 'Ingen af dem passer?',
				text: 'Beskriv dit behov i én sætning: AI foreslår en skræddersyet database.',
			},
			all: 'Se alle skabeloner',
			previous: 'Tidligere skabeloner',
			next: 'Næste skabeloner',
		},
		developers: {
			title: 'Og den tekniske side?',
			text: 'Hver tabel er en rigtig PostgreSQL-tabel. REST-API, webhooks, MCP-server til AI-agenter, og en installation med én kommando.',
			link: 'Udviklersiden',
		},
		faq: {
			title: 'Dine spørgsmål',
			items: [
				{
					q: 'Skal man kunne kode?',
					a: 'Nej. Du opretter dine tabeller, visninger, formularer, dashboards og automatiseringer med musen. Formlerne skrives på fransk, ligesom i et regneark: SI, ARRONDI, JOURS…',
				},
				{
					q: 'Hvad koster det?',
					a: 'Ingenting: basedb er fri software, uden abonnement eller pris pr. person. Du skal blot have en server at installere det på.',
				},
				{
					q: 'Hvordan installerer man det?',
					a: 'På en server, med Docker: to filer og én kommando, et par minutter for den, der står for jeres it. Installationsguiden forklarer det hele, trin for trin.',
				},
				{
					q: 'Kan vi bruge vores gamle regneark?',
					a: 'Ja: gem dit ark som CSV, og træk det ind i basedb. Importen gætter typen for hver kolonne, opretter tabellen og fortæller række for række, hvad den ikke kunne overføre.',
				},
				{
					q: 'Kan flere arbejde i det samtidig?',
					a: 'Det er sådan, det er tænkt. De andres ændringer vises i realtid, du kan kommentere en række, nævne en kollega med @, og en klokke giver besked.',
				},
				{
					q: 'Og AI — læser den vores data?',
					a: 'Kun hvis du bestemmer det. Uden en konfigureret AI-udbyder sendes der intet. Derefter sender et felt eller en automatisering, der bruger AI, kun det, dens instruktion nævner — efter din accept.',
				},
				{
					q: 'På hvilket sprog?',
					a: 'På dit eget: brugerfladen bruger din browsers sprog, ud af tyve, og alle kan selv skifte det i deres indstillinger.',
				},
			],
		},
		cta: {
			title: 'Jeres team fortjener bedre',
			titleAccent: 'end en delt fil.',
			text: 'Start med en skabelon, inviter jeres kolleger, og læg »FINAL (2)« bag jer.',
			primary: 'Se skabelonerne',
			secondary: 'Installer basedb',
		},
	},
	hero: {
		badge: 'Nyt: automatiseringer i flow, dashboards og SQL-views',
		title: ['Den kollaborative', 'database, hvor hver', 'tabel er en rigtig'],
		titleAccent: 'PostgreSQL-tabel.',
		lead: 'Enkelheden fra et delt regneark — gitre, visninger, formularer, tilladelser — og data, der lever i tabeller <strong>med typer og læsbare navne</strong>. Dit team arbejder i brugerfladen; dine scripts, dine BI-værktøjer, dine AI-agenter og <code>psql</code> læser de samme rækker.',
		install: 'Installer med Docker',
		features: 'Se funktionerne',
		copy: 'Kopiér kommandoen',
		facts: ['Selvhostet', 'AGPL-3.0', 'REST-API & MCP-server'],
		demo: {
			url: 'basedb.dit-domæne.dk',
			project: 'Hovedprojekt',
			projectMeta: 'Projekt · 2 databaser',
			filter: 'Filtrér databaser og tabeller',
			sales: 'Salg',
			support: 'Support',
			environment: 'Produktion',
			clients: 'Kunder',
			opportunities: 'Salgsmuligheder',
			quotes: 'Tilbud',
			baseSection: 'Database · Salg',
			screens: ['Dashboards', 'Automatiseringer'],
			copilot: '✦ Copilot',
			allRows: '▦ Alle rækker ▾',
			tools: ['Filtrér', 'Grupper', 'Farver'],
			search: 'Søg…',
			add: '+ Tilføj',
			columns: {
				name: 'Navn',
				status: 'Status',
				amount: 'Beløb',
				client: 'Kunde',
			},
			statuses: {
				nouveau: 'Ny',
				qualifie: 'Kvalificeret',
				proposition: 'Tilbud',
				negociation: 'Forhandling',
				gagne: 'Vundet',
				perdu: 'Tabt',
			},
			deals: {
				portail: {
					name: 'Ny portal',
					client: 'Skovby Kommune',
				},
				erp: {
					name: 'ERP-migrering',
					client: 'Kjær Gruppen',
				},
				audit: {
					name: 'Sikkerhedsaudit',
					client: 'Klinik Skt. Rochus',
				},
				billetterie: {
					name: 'Onlinebilletsalg',
					client: 'Teatret ved Torvet',
				},
				flotte: {
					name: 'Flådesporing',
					client: 'Kragh Transport',
				},
				mobile: {
					name: 'Mobilapp',
					client: 'Studio Mørch',
				},
				intranet: {
					name: 'Nyt intranet',
					client: '',
				},
			},
			toastTitle: 'Formular »Tilbudsforespørgsel«',
			toastText: 'offentligt svar · oprettede »{name}«',
			cursor: 'Camille',
			psqlRows: '(2 rækker)',
		},
	},
	showcase: {
		label: 'Brugerfladen, som den er',
		title: 'Alt, hvad dit team forventer af et delt regneark.',
		tabs: 'Skærmbilleder af brugerfladen',
		alt: 'basedb — {labelLower}: {caption}',
		shots: {
			grille: {
				label: 'Gitter',
				caption: 'Et gitter, der skriver i en rigtig tabel — og beregnede felter: en varighed med en formel, kundens by med et opslag, antallet af opgaver med en optælling.',
			},
			kanban: {
				label: 'Kanban',
				caption: 'De samme rækker i kolonner, efter et enkeltvalg: et forsidebillede, en beskrivelse, der citerer rækken. At trække et kort er det samme som at redigere rækken.',
			},
			galerie: {
				label: 'Galleri',
				caption: 'Kort med deres billede, en farve pr. status: galleriet, én af de otte måder at læse en tabel.',
			},
			chronologie: {
				label: 'Tidslinje',
				caption: 'Bjælker mellem to datoer og pilene for deres afhængigheder — røde, når rækkefølgen ikke længere holder.',
			},
			tableaux: {
				label: 'Dashboards',
				caption: 'Kort i et gitter, i faner, under fælles filtre: en tendens, et mål, stablede serier — læst med hver persons egne tilladelser.',
			},
			automatisations: {
				label: 'Automatiseringer',
				caption: 'Når en opgave er udført: find det, der mangler i projektet; er der intet tilbage, skriver AI afslutningsteksten, og projektet skifter til »Livré«. Hver kørsel kan læses i flowet, trin for trin.',
			},
			commentaires: {
				label: 'Kommentarer',
				caption: 'En række diskuteres der, hvor den er: kommentarer, omtaler, notifikationer.',
			},
			formulaire: {
				label: 'Formular',
				caption: 'En formular deles via et link, offentligt eller forbeholdt indloggede medlemmer.',
			},
			historique: {
				label: 'Historik',
				caption: 'Hver skrivning, uanset hvor den kommer fra — en person, en automatisering, direkte SQL — med de tidligere værdier.',
			},
			sql: {
				label: 'SQL',
				caption: 'En forespørgsel på de rigtige navne, gemt under tabellerne til hele teamet — og hver person kører den med sine egne tilladelser.',
			},
			vuesSql: {
				label: 'SQL-views',
				caption: 'Rigtige PostgreSQL-views, placeret blandt tabellerne med deres farve og ikon — og læsbare fra psql.',
			},
		},
	},
	features: {
		postgres: {
			label: 'PostgreSQL, uden oversættelse',
			title: 'Et gitter til teamet, en rigtig tabel {til dine værktøjer.}',
			lead: 'Ingen generisk model, ingen JSON-rodekasse, ingen <code>field_1837</code>: en database er et skema, en tabel er en tabel, et felt er en kolonne med type og læsbart navn.',
			bullets: [
				'<strong>Native typer</strong>: <code>text</code>, <code>numeric</code>, <code>date</code>, <code>timestamptz</code>, <code>boolean</code> — og rigtige fremmednøgler til relationerne.',
				'<strong>Begrænsninger, som databasen håndhæver</strong>: enkeltvalg som <code>CHECK</code>, webadresser og e-mails valideret, relationer som <code>FOREIGN KEY</code>.',
				'<strong>Formler beregnet af PostgreSQL</strong>: <code>JOURS([Fin]; [Début])</code> bliver til en genereret kolonne, som <code>psql</code> læser som alle andre.',
				'<strong>Direkte SQL er stadig tilladt</strong> — og selv det kommer med i historikken via en trigger.',
				'<strong>SQL-forespørgsler og -views</strong> i brugerfladen: forespørgsler gemt under tabellerne, til dig selv eller til teamet, og rigtige PostgreSQL-views placeret blandt dem, som <code>psql</code> også læser.',
				'<strong>At omdøbe er ikke at ødelægge</strong>: det gamle navn betjenes stadig af et kompatibilitetsalias, mens du migrerer dine forespørgsler.',
			],
			links: [
				{
					href: '/integrations/sql/',
					label: 'Arbejd i SQL',
				},
				{
					href: '/fonctionnalites/requetes-et-vues-sql/',
					label: 'Forespørgsler og SQL-views',
				},
				{
					href: '/architecture/principes/',
					label: 'Principperne',
				},
			],
		},
		automations: {
			label: 'Automatisér',
			title: 'Automatiseringer som flow, {AI i hvert trin.}',
			lead: 'Når en række ændres, på et fast tidspunkt eller med et klik: en grafeditor kæder trinnene sammen, og hver kørsel kan gennemgås i flowet.',
			bullets: [
				'<strong>Et overskueligt flow</strong>: udløseren og derefter hvert trin som et kort; et <strong>+</strong> på en linje tilføjer et trin på det sted.',
				'<strong>Find, beslut, skriv</strong>: find en række, tag den ene eller den anden gren alt efter betingelser, rediger, opret, giv besked, kald en webhook, skriv på Slack.',
				'<strong>Spørg AI</strong> i et trin: en instruktion, der citerer rækken, et svar læst som tekst, tal, dato eller valg, som de efterfølgende trin genbruger.',
				'<strong>Copilot</strong> foreslår en hel automatisering ud fra én sætning eller forklarer, hvorfor en kørsel mislykkedes — intet gemmes uden dig.',
				'<strong>Med tilladelserne for den, der skrev den</strong>, og i historikken som enhver anden skrivning.',
			],
			links: [
				{
					href: '/fonctionnalites/automatisations/',
					label: 'Automatiseringerne',
				},
				{
					href: '/fonctionnalites/automatisations/#copilot',
					label: 'Copilot',
				},
			],
			alt: 'basedb — automatiseringen »Projet livré« i floweditoren: når en opgave er udført, noter tidspunktet, find det, der mangler i projektet, tag grenen »Ellers«, spørg AI om afslutningsteksten, og lever så projektet; til højre dens seneste kørsler, trin for trin.',
		},
		dashboards: {
			label: 'Analysér',
			title: 'Dashboards {uden at forlade dine tabeller.}',
			lead: 'Spørgsmål stillet med musen eller i SQL, femten visualiseringer, fælles filtre — hver person læser dem med sine egne tilladelser.',
			bullets: [
				'<strong>Spørgsmål</strong>: en tabel, dens sammenkædninger, filtre og mål pr. dag, uge, måned eller år — eller skrivebeskyttet SQL.',
				'<strong>Femten visualiseringer</strong>: nøgletal, tendens, mål, måler, søjler, linjer, cirkeldiagram, tragt, krydstabel, landkort…',
				'<strong>Udforsk med ét klik</strong>: et punkt åbner sine rækker eller en finere periode.',
				'<strong>Fælles filtre</strong>, der styrer ét, flere eller alle kort.',
				'<strong>Del via et link</strong>, offentligt eller kun for medlemmer, og indlejr på et andet websted.',
			],
			links: [
				{
					href: '/fonctionnalites/tableaux-de-bord/',
					label: 'Dashboards',
				},
			],
			alt: 'basedb — et dashboard: månedens tendens, et indbetalingsmål, omsætning pr. måned, stemningen i anmeldelserne, under filtre for periode og kunde.',
		},
		rights: {
			label: 'Samarbejd uden at åbne for alt',
			title: 'Tilladelser helt ned til feltet, {en historik uden huller.}',
			lead: 'Tilladelser gives til grupper på et projekt, en database eller en tabel og gælder for alt derunder. En følsom kolonne kan skjules for en gruppe eller gøres skrivebeskyttet for den.',
			bullets: [
				'<strong>Fire niveauer</strong>: Ingen adgang, Læse, Redigere, Administrere — som lægges sammen fra den ene gruppe til den anden.',
				'<strong>Selv SQL følger dine tilladelser</strong>: i brugerfladen ser en forespørgsel kun de tabeller og felter, der er åbne for dig — og det er PostgreSQL, der håndhæver det.',
				'<strong>Hver skrivning registreres</strong> i sin egen transaktion: brugerflade, API, agent, offentlig formular eller direkte SQL.',
				'<strong>En ændring kan fortrydes</strong>, en slettet række gendannes — og en slettet database også.',
				'<strong>Administration skal bekræftes</strong>: at ændre en tilladelse kræver, at du har indtastet din adgangskode igen inden for de seneste fem minutter.',
			],
			links: [
				{
					href: '/fonctionnalites/droits/',
					label: 'Tilladelser og grupper',
				},
				{
					href: '/fonctionnalites/historique/',
					label: 'Historikken',
				},
			],
		},
		agents: {
			label: 'REST-API · MCP · webhooks',
			title: 'Dine AI-agenter får adgang til data, {ikke til hele nøgleknippet.}',
			lead: 'MCP-serveren giver agenterne tolv værktøjer; REST-API’et giver dine programmer de samme data. Ét kontrolpunkt for tilladelser, de samme logs.',
			bullets: [
				'<strong>Ét token pr. database</strong>, skrivebeskyttet som standard og aldrig med flere tilladelser end den person, der oprettede det.',
				'<strong>En agent sletter intet</strong> og ændrer ikke strukturen: den foreslår, et menneske godkender.',
				'<strong>Genereret dokumentation</strong> for hver database, filtreret efter dine tilladelser, med dens OpenAPI 3.1-specifikation.',
				'<strong>Webhooks</strong> ved hver skrivning: signerede, leveret i rækkefølge og sendt igen ved fejl.',
			],
			links: [
				{
					href: '/integrations/mcp/',
					label: 'Forbind en agent',
				},
				{
					href: '/integrations/api-rest/',
					label: 'REST-API’et',
				},
			],
		},
	},
	sqlVisual: {
		interface: 'Brugerflade',
		title: 'Nyt felt · Salgsmuligheder',
		labelField: 'Etiket',
		labelValue: 'Beløb',
		typeField: 'Type',
		typeValue: 'Tal',
		descriptionField: 'Beskrivelse',
		descriptionValue: 'Kontraktens beløb ekskl. moms',
		required: 'Påkrævet',
		ai: 'AI',
		migration: 'en planlagt migrering, korte låse',
	},
	rightsVisual: {
		groups: ['Administratorer', 'Sælgere', 'Support'],
		project: 'Hovedprojekt',
		sales: 'Salg',
		opportunities: 'Salgsmuligheder',
		clients: 'Kunder',
		support: 'Support',
		inherited: 'arvet',
		levels: {
			none: 'Ingen adgang',
			read: 'Læse',
			edit: 'Redigere',
			manage: 'Administrere',
		},
		field: 'Feltet »Avance«',
		hidden: 'Skjult',
		sqlChange: '<b>Direkte SQL-session</b> redigerede <b>»ERP-migrering«</b>',
		sqlMeta: '02:46 · lokal forbindelse · psql',
		sqlDiff: 'Beløb: <s>125.000</s> → 130.000',
		undo: '↶ Fortryd',
		formChange: '<b>Formularen »Tilbudsforespørgsel«</b> oprettede <b>»Nyt intranet«</b>',
		formMeta: 'offentligt svar · udgivet af Camille',
	},
	agentVisual: {
		agent: 'Agent',
		via: 'forbundet via MCP · token »Salg«',
		question: 'Hvor mange salgsmuligheder er i forhandling, og for hvilket beløb?',
		listArgs: 'opportunites · statut = Forhandling',
		answer: 'To salgsmuligheder, <b>182.000 €</b> i alt: ERP-migrering (130.000 €) og Flådesporing (52.000 €).',
		request: 'Tilføj et felt »Sandsynlighed« i procent.',
		proposeArgs: 'opportunites · Sandsynlighed · number',
		proposed: 'Det er foreslået: en person i teamet skal godkende det i basedb.',
		badge: 'Forslag',
		expires: 'udløber om 23 t',
		what: 'Tilføj feltet <b>»Sandsynlighed«</b> (Tal) til <b>Salgsmuligheder</b>',
		by: 'Foreslået af agenten · token »Salg«',
		refuse: 'Afvis',
		approve: 'Godkend',
	},
	bento: {
		label: 'Og alt det andet',
		title: 'Det, du forventer af et teamværktøj, uden at give slip på PostgreSQL.',
		text: 'Hver funktion skriver i de samme tabeller, under de samme tilladelser, i den samme historik.',
		more: 'Læs mere →',
		views: {
			title: 'Otte visninger af de samme rækker',
			text: 'Fælles for hele teamet eller personlige for dig alene: hver person vælger sin måde at læse på, og ingen kopierer data.',
			chips: ['Gitter', 'Kanban', 'Kalender', 'Tidslinje', 'Galleri', 'Liste', 'Formular', 'Spørgeskema'],
		},
		forms: {
			title: 'Delte formularer',
			text: 'Et offentligt link eller et, der er forbeholdt indloggede medlemmer. At svare giver ingen tilladelser til tabellen.',
			href: '/fonctionnalites/formulaires-partages/',
		},
		environments: {
			title: 'Miljøer',
			text: 'Én database, flere udgaver. Sammenlign strukturen, migrer fra den ene til den anden, synkroniser rækker.',
			chips: ['Produktion', 'Test', 'Udvikling'],
			href: '/fonctionnalites/environnements/',
		},
		collaboration: {
			title: 'Arbejd sammen',
			text: 'Andres skrivninger kommer ind i realtid, du ser, hvem der kigger på hvilken række, og I diskuterer den der, hvor den er: kommentarer, omtaler, notifikationer. Ctrl+Z fortryder den seneste skrivning og afviser hellere end at overskrive en andens arbejde.',
			chips: ['Realtid', 'Tilstedeværelse', 'Kommentarer', 'Omtaler', 'Ctrl+Z'],
			href: '/fonctionnalites/collaboration/',
		},
		small: {
			ai: {
				title: 'AI i gitteret',
				text: 'Et felt, som en model udfylder ud fra de andre kolonner, og en Copilot, der foreslår filtre, forespørgsler og kolonner, som anvendes med ét klik. OpenAI, Anthropic, Mistral, eller en model, der køres på din egen maskine.',
				code: 'Opsummer {{Notes}} i én sætning',
				href: '/fonctionnalites/ia/',
			},
			formulas: {
				title: 'Relationer og formler',
				text: 'Rigtige fremmednøgler, formler på fransk beregnet af PostgreSQL og opslag, aggregeringer og optællinger på tværs af relationer.',
				code: 'ARRONDI([Montant HT] * (1 + [Taux de TVA]); 2)',
				href: '/fonctionnalites/tables-et-champs/#formler',
			},
			richText: {
				title: 'Formateret tekst og variabler',
				text: 'En visuel editor til formateret tekst, renset ved skrivning; og i enhver lang tekst læses {{Ville}} med rækkens værdi.',
				code: 'Levering den {{Date}} i {{Ville}}',
				href: '/fonctionnalites/tables-et-champs/#formateret-tekst-og-variabler',
			},
			languages: {
				title: 'På dit eget sprog',
				text: 'Brugerfladen bruger browserens sprog, ét af tyve; alle kan selv skifte det i deres indstillinger.',
				href: '/fonctionnalites/droits/#dine-indstillinger',
			},
			sharedViews: {
				title: 'Delte visninger',
				text: 'En skrivebeskyttet visning via et link, som kan indlejres på et andet websted; en kalender bliver til et feed til din kalenderapp.',
				href: '/fonctionnalites/vues-partagees/',
			},
			syncedTables: {
				title: 'Synkroniserede tabeller',
				text: 'En tabel, der holdes opdateret fra en online-CSV, en kalender eller en delt visning fra en anden basedb.',
				href: '/integrations/synchronisation/',
			},
			templates: {
				title: 'Databaseskabeloner',
				text: 'Ti skabeloner klar til brug, en database beskrevet for AI i én sætning, og din egen gemt som skabelon.',
				href: '/modeles/',
			},
			files: {
				title: 'Filer og billeder',
				text: 'På værtens disk eller i S3-kompatibelt lager: AWS, Scaleway, OVH, Cloudflare R2, Garage, MinIO…',
				href: '/fonctionnalites/fichiers/',
			},
			import: {
				title: 'CSV- og JSON-import',
				text: 'Træk en fil ind: importen gætter typerne, opretter tabellen eller supplerer en eksisterende og fortæller række for række, hvad der blev afvist.',
				href: '/guides/premiers-pas/',
			},
			accounts: {
				title: 'Konti og invitationer',
				text: 'Alle opretter deres egen konto og egne projekter og inviterer via et link med Læse, Redigere eller Administrere; login med adgangskode, Google, Microsoft eller en hvilken som helst OpenID Connect-udbyder.',
				href: '/hebergement/connexion/',
			},
			webhooks: {
				title: 'Webhooks',
				text: 'Hver skrivning kan give et andet system besked: signerede payloads, leveret i rækkefølge og sendt igen ved fejl.',
				href: '/integrations/webhooks/',
			},
			settings: {
				title: 'Personlige indstillinger',
				text: 'Dit sprog, dit tema, datoernes rækkefølge, dine notifikationer, dine sessioner og dine tokens samlet ét sted.',
				href: '/fonctionnalites/droits/#dine-indstillinger',
			},
		},
	},
	selfHost: {
		label: 'Selvhostet',
		title: 'Dine data bliver {hos dig.}',
		lead: 'basedb er fri software (AGPL-3.0): ét image, én PostgreSQL-database, og det er det hele — ingen påtvunget tredjepartstjeneste, ingen telemetri. Tag backup med <code>pg_dump</code>, og læs dataene med en hvilken som helst PostgreSQL-klient.',
		services: {
			db: 'PostgreSQL 16, dine data',
			basedb: 'Brugerfladen, REST-API’et og MCP-serveren på én port',
			proxy: 'Caddy, automatisk HTTPS (valgfrit)',
		},
		links: [
			{
				href: '/hebergement/docker/',
				label: 'Guide til Docker Compose →',
			},
			{
				href: '/hebergement/variables/',
				label: 'Alle variablerne →',
			},
		],
		steps: [
			{
				title: 'Hent basedb',
				code: 'git clone https://github.com/eodia/basedb.git\ncd basedb && cp .env.example .env',
			},
			{
				title: 'To hemmeligheder i .env',
				code: 'POSTGRES_PASSWORD=en-solid-adgangskode\n# openssl rand -base64 32\nBASEDB_ENCRYPTION_KEY=…',
			},
			{
				title: 'Start',
				code: 'docker compose up -d\n# derefter http://localhost:3000: opret din konto',
			},
		],
	},
	faq: {
		label: 'Ofte stillede spørgsmål',
		title: 'Det, vi ofte bliver spurgt om.',
		text: 'Et andet spørgsmål? <a href="/guides/introduction/">Dokumentationen</a> har sikkert svaret.',
		items: {
			difference: {
				q: 'Hvordan adskiller basedb sig fra andre kollaborative databaser?',
				a: 'Ved det sted, hvor dataene lever. Hvor andre gemmer dine rækker i en generisk model (nummererede kolonner, JSON-dokumenter), opretter basedb en rigtig PostgreSQL-tabel for hver tabel og en rigtig kolonne med type for hvert felt, med læsbare navne. Dine data kan bruges uden basedb.',
			},
			sql: {
				q: 'Kan jeg skrive direkte i tabellerne med SQL?',
				a: 'Ja. Begrænsningerne (typer, påkrævet, enkeltvalg, fremmednøgler) håndhæves af PostgreSQL selv, og en trigger registrerer selv skrivninger via direkte SQL i historikken sammen med den session, der foretog dem. Brugerfladens SQL-konsol og psql læser de samme tabeller; i brugerfladen skriver hver person SQL med sine egne tilladelser, gemmer sine forespørgsler og kan, hvis personen administrerer databasen, gøre dem til rigtige PostgreSQL-views.',
			},
			ai: {
				q: 'Hvad sendes til en AI-udbyder?',
				a: 'Intet, før du har konfigureret en udbyder. Derefter sendes som standard kun strukturen og din sætning, når det gælder strukturudkast og Copilot; at lade Copilot læse data er et afkrydsningsfelt pr. samtale. En databaseskabelon, som du beder AI om, sender kun din sætning. Et AI-felt sender de kolonner, som dets instruktion citerer, efter udtrykkeligt samtykke.',
			},
			together: {
				q: 'Kan flere arbejde i den samme tabel?',
				a: 'Ja. Andres skrivninger vises uden genindlæsning, med deres ansigt på den tabel eller række, de kigger på. Du kommenterer en række, omtaler nogen med @, og klokken giver besked. Og Ctrl+Z fortryder kun dine egne skrivninger: den afviser hellere end at overskrive det, en anden har ændret siden.',
			},
			languages: {
				q: 'På hvilke sprog?',
				a: 'Tyve: fransk, engelsk, tysk, spansk, italiensk, brasiliansk portugisisk, nederlandsk, polsk, tjekkisk, svensk, dansk, norsk, finsk, rumænsk, ungarsk, tyrkisk, ukrainsk, japansk, forenklet kinesisk og koreansk. Brugerfladen bruger browserens sprog, og hver person kan skifte det i sine indstillinger; dette site og dokumentationen findes på de samme sprog.',
			},
			agent: {
				q: 'Hvordan forbinder en AI-agent sig?',
				a: 'Via MCP-serveren med et integrationstoken, der er begrænset til én database og skrivebeskyttet som standard. En agent læser, opretter og redigerer rækker efter sine tilladelser; den sletter intet og ændrer ikke strukturen: den foreslår, og et menneske godkender.',
			},
			postgres: {
				q: 'Hvilken version af PostgreSQL kræves?',
				a: 'PostgreSQL 16 eller nyere med udvidelserne pg_trgm og unaccent (tilgængelige i det officielle image). Den medfølgende docker-compose starter en PostgreSQL 16; du kan også pege DATABASE_URL mod din egen server.',
			},
			production: {
				q: 'Er det klar til produktion?',
				a: 'basedb er under aktiv udvikling: kernen, API’et, MCP-serveren og brugerfladen virker og er dækket af mere end tusind tests, men nogle funktioner mangler stadig (se køreplanen). Prøv det, og tag backup af din database som af enhver anden PostgreSQL-database.',
			},
			license: {
				q: 'Under hvilken licens?',
				a: 'AGPL-3.0-or-later. Du kan frit bruge, ændre og hoste det; hvis du tilbyder en ændret version som tjeneste, deler du kildekoden.',
			},
		},
	},
	cta: {
		title: 'Dine data fortjener {rigtige tabeller.}',
		text: 'Installer basedb på få minutter, invitér dit team, og bevar kontrollen over hver række.',
		install: 'Installer basedb',
		github: 'Se koden på GitHub',
	},
	changelog: {
		label: 'Nyheder',
		title: 'Hvad der er ændret i basedb',
		intro: 'Detaljerne om hver ændring findes i <a href="https://github.com/eodia/basedb/commits/main">repositoriets historik</a>. Det, der kommer bagefter: <a href="/feuille-de-route/">køreplanen</a>.',
		entries: {
			languages: {
				date: '2026-09-27',
				title: 'Formateret tekst, variabler, et mere overskueligt kanban',
				tag: 'Ny',
				items: [
					'<strong>Formateret tekst</strong>: en ny felttype, formateret i en visuel editor — overskrifter, lister, citater, links —, renset ved skrivning og beskyttet af en begrænsning mod direkte SQL. <a href="/fonctionnalites/tables-et-champs/#formateret-tekst-og-variabler">Formateret tekst og variabler</a>',
					'<strong>Variabler</strong>: en lang tekst citerer en kolonne i sin række — <code>{{Ville}}</code> — og læses overalt med dens værdi: gitter, rækkedetaljer, API, MCP-server, delte visninger, automatiseringer. Kolonnen beholder citatet, og det er det, <code>psql</code> læser.',
					'<strong>Et mere overskueligt kanban</strong>: luftigere kort, et forsidebillede og en beskrivelse, der citerer rækkens værdier — »Levering den {{Date}} til {{Client}}«. <a href="/fonctionnalites/vues/">Visningerne</a>',
					'<strong>Omdøb i ét greb</strong>: én dialog for en database, en tabel eller et felt; etiketten ændres altid, og en administrator kan også omdøbe i databasen, understøttet af en konsekvensanalyse. <a href="/fonctionnalites/tables-et-champs/#rediger-strukturen">Rediger strukturen</a>',
					'<strong>Tyve sprog</strong>: brugerfladen, dette site og dokumentationen på fransk, engelsk, tysk, spansk, italiensk, portugisisk (Brasilien), nederlandsk, polsk, tjekkisk, svensk, dansk, norsk, finsk, rumænsk, ungarsk, tyrkisk, ukrainsk, japansk, forenklet kinesisk og koreansk. basedb bruger browserens sprog; <strong>Indstillinger › Udseende › Sprog</strong> vælger et andet, som følger dig fra computer til computer. Tal og datoer følger sproget. <a href="/fonctionnalites/droits/#dine-indstillinger">Dine indstillinger</a>',
				],
			},
			aiProvider: {
				date: '2026-09-27',
				title: 'AI efter dit eget valg, også på din egen maskine',
				tag: 'Ny',
				items: [
					'<strong>En fjerde AI-udbyder</strong>: enhver server, der taler OpenAIs API — Azure, en virksomhedsgateway, en model, der køres på din egen maskine —, angivet i <code>.env</code>. Kaldloggen viser, hvem dataene er sendt til. <a href="/fonctionnalites/ia/">AI i basedb</a>',
					'<strong>Loginskærmen</strong> viser, efter gitteret og SQL-fanen, et dashboard, der reagerer på et filter, og en automatisering, der kører — AI-trinnet inklusive.',
				],
			},
			flows: {
				date: '2026-09-27',
				title: 'Automatiseringer som flow',
				tag: 'Ny',
				items: [
					'<strong>En grafeditor</strong>: udløseren og derefter hvert trin som et kort; et <strong>+</strong> på en linje tilføjer et trin på det sted. En enkel automatisering fylder stadig kun to kort. <a href="/fonctionnalites/automatisations/">Automatiseringerne</a>',
					'<strong>Find en række</strong> — kunden på en ordre, den seneste ubetalte faktura — og rediger den, citér den, eller forbind den med en nyoprettet række.',
					'<strong>Betingelser med flere grene</strong>: den første, hvis betingelse er opfyldt, tages, »Ellers« når ingen er det; grenene mødes igen bagefter.',
					'<strong>Data går fra trin til trin</strong>: <code>{{e2.client}}</code> citerer det, et trin har fundet eller oprettet, <code>{{e3.reponse.numero}}</code> det, en webhook har svaret; menuen ved hver tekst tilbyder kun det, der med sikkerhed er sket før.',
					'<strong>Hver kørsel, trin for trin</strong>: lagt oven på flowet tegner den den valgte gren op og fortæller for hvert trin, hvad det gjorde, og hvor lang tid det tog.',
					'<strong>Copilot til automatiseringer</strong>: beskriv, hvad databasen skal gøre af sig selv, eller spørg, hvorfor en kørsel mislykkedes; den foreslår en hel automatisering, som du placerer i flowet med ét klik, gennemlæser og derefter gemmer — intet gemmes uden dig. <a href="/fonctionnalites/automatisations/#copilot">Copilot</a>',
					'<strong>Spørg AI</strong> i et trin, som i et AI-felt: en instruktion, der citerer rækken og de foregående trin, et svar læst som tekst, tal, ja eller nej, dato eller valg fra en liste, som de efterfølgende trin skriver eller sender. <a href="/fonctionnalites/automatisations/#spørg-ai">Spørg AI</a>',
				],
			},
			dashboards: {
				date: '2026-09-27',
				title: 'Dashboards: spørgsmål, diagrammer, filtre',
				tag: 'Ny',
				items: [
					'<strong>Spørgsmål</strong> stillet med musen — en tabel, dens sammenkædninger, filtre, mål pr. dag, uge, måned eller år — eller skrevet i <strong>SQL</strong>, skrivebeskyttet og med dine egne tilladelser, variabler inklusive. <a href="/fonctionnalites/tableaux-de-bord/">Dashboards</a>',
					'<strong>Femten visualiseringer</strong>: nøgletal, tendens i forhold til den foregående periode, fremskridt mod et mål, måler, histogram, søjler, linje, områder, kombineret, cirkeldiagram, tragt, punktdiagram, tabel, krydstabel, landkort over Frankrig eller verden.',
					'<strong>Udforsk med ét klik</strong>: et punkt åbner sine rækker, en finere periode, en anden fordeling.',
					'<strong>Dashboards i et gitter</strong>: kort, der flyttes og ændrer størrelse med musen, faner, afsnitstitler, tekster, indlejrede sider.',
					'<strong>Fælles filtre</strong> — periode, kategori, tekst, tal, datogruppering — der styrer ét, flere eller alle kort, med en standardværdi.',
					'<strong>Diagrammer efter din smag</strong>: farve og navn for hver serie eller hver andel, ring, halvcirkel eller rose, stabling med totaler, udjævnede kurver eller trapper, akser, inddelinger, logaritmisk skala; tabeller med omdøbte kolonner, med søjler og farver efter værdien.',
					'<strong>Copilot til dashboards</strong>: en samtale, der foreslår spørgsmål, ændringer af dashboardet — som kan fortrydes — og værdier til dets filtre, som anvendes med ét klik. Kun strukturen sendes til udbyderen, medmindre du tillader den at læse resultaterne. <a href="/fonctionnalites/tableaux-de-bord/#copilot">Copilot</a>',
					'<strong>Del et dashboard</strong> via et link, offentligt eller forbeholdt medlemmer — om nødvendigt bestemte grupper — og indlejr det på et andet websted: kort og filtre, skrivebeskyttet, læst med tilladelserne for den, der udgav det. <a href="/fonctionnalites/tableaux-de-bord/#del-et-dashboard">Del</a>',
					'»Brugerflader« hedder nu <strong>Dashboards</strong>; de eksisterende åbnes, som de er, i det nye gitter.',
				],
			},
			sqlViews: {
				date: '2026-09-27',
				title: 'Gemte forespørgsler og SQL-views',
				tag: 'Ny',
				items: [
					'<strong>SQL til alle</strong>: uden niveauet Administrere køres en SQL-fane skrivebeskyttet med dine egne tilladelser, håndhævet af PostgreSQL selv — en lukket tabel findes ikke, et skjult felt afvises. Mærket »Dine tilladelser« minder om det. <a href="/fonctionnalites/requetes-et-vues-sql/">Forespørgsler og SQL-views</a>',
					'<strong>Gemte forespørgsler</strong>, placeret under tabellerne i afsnittet »Forespørgsler«: personlige, for hele databasen eller for grupper. At dele en forespørgsel deler dens tekst, aldrig det, som dens forfatter kan læse; åbnet fra sidepanelet køres den straks, skrivebeskyttet.',
					'<strong>SQL-views</strong>: rigtige PostgreSQL-views, placeret blandt tabellerne med en farve, et ikon og et lille øje, og som også kan læses fra <code>psql</code> og dine værktøjer. Hver person læser dem med sine egne tilladelser, og sidepanelet viser dem kun for dem, der kan læse alt i dem.',
					'Views følger strukturen: en omdøbning ødelægger dem ikke, en ændret formel fjerner dem et øjeblik og sætter dem derefter tilbage; et view, der ikke længere holder, venter på at blive rettet, med definitionen bevaret.',
				],
			},
			settings: {
				date: '2026-09-27',
				title: 'Dine indstillinger',
				tag: 'Ny',
				items: [
					'<strong>Indstillinger</strong> i profilmenuen: dit navn, din adresse og de identitetsudbydere, der er knyttet til din konto; din adgangskode og dine åbne sessioner. <a href="/fonctionnalites/droits/">Konti og login</a>',
					'<strong>Udseende</strong>: temaet, datoernes rækkefølge — <code>25/09/2026</code> eller <code>2026-09-25</code> — og kalendernes første ugedag; de to sidste følger dig fra computer til computer.',
					'<strong>Notifikationer</strong>: fravælg dem, du ikke længere vil have, én type ad gangen. <strong>Tokens</strong>: dem, du har oprettet, på tværs af alle dine databaser, deres seneste brug og tilbagekaldelse af dem.',
				],
			},
			v020: {
				date: '2026-09-26',
				title: 'Version 0.2.0: egen konto, egne projekter, egne invitationer',
				tag: 'Ny',
				items: [
					'<strong>Første login</strong>: på en ny instans opretter den første side administratorkontoen med din adresse og din adgangskode — ingen standardkonto længere og ingen adgangskode at lede efter i logfilerne. <a href="/guides/installation/">Installationen</a>',
					'<strong>Oprettelse af konti</strong>: alle opretter deres egen konto og derefter deres egne projekter, som de selv administrerer. Administrationen kan lukke for det eller forbeholde det bestemte domæner. <a href="/hebergement/connexion/">Konti og login</a>',
					'<strong>Del et projekt eller en database</strong>: den, der har niveauet Administrere, inviterer via et link med Læse, Redigere eller Administrere; ser, hvem der har adgang, ændrer et niveau eller fjerner det. Aldrig mere end det, vedkommende selv administrerer.',
					'<strong>Fortrolighed</strong>: hver person ser nu kun de personer, vedkommende deler et projekt med, og et projektnavn, som en anden allerede har taget, kan ikke længere gættes.',
					'<strong>Login med Google, Microsoft</strong> og enhver OpenID Connect-udbyder (Keycloak, GitLab…), angivet i <code>.env</code>; et første login opretter kontoen, hvis oprettelse af konti tillader det. <a href="/hebergement/connexion/">Konfigurer</a>',
					'<strong>Ny loginskærm</strong> i applikationens tema, lyst eller mørkt, og diskret animeret; illustrerede tomme skærme i applikationen.',
					'<strong>Opdateringer uden tab</strong>: basedb opdaterer selv sit katalog ved opstart, også en 0.1-installation, og nægter at starte på en database, som en nyere version allerede har opdateret. <a href="/hebergement/sauvegardes/">Opdater</a>',
				],
			},
			dockerImage: {
				date: '2026-09-26',
				title: 'Ét enkelt Docker-image',
				tag: 'Hosting',
				items: [
					'basedb er samlet i <strong>ét enkelt image</strong>, <code>eodia/basedb</code> på Docker Hub, til amd64 og arm64: brugerfladen, API’et under <code>/api</code> og MCP-serveren under <code>/mcp</code> på <strong>én port</strong>. <a href="/guides/installation/">Installationen</a>',
					'To filer er nok — <code>docker-compose.yml</code> og <code>.env</code> — uden at klone repositoriet eller bygge noget; opdatering sker med <code>docker compose pull</code>.',
					'Bag et domæne har HTTPS-proxyen ikke længere nogen routing at klare: alt går til port 3000.',
				],
			},
			automations: {
				date: '2026-09-26',
				title: 'Automatiseringer, brugerflader, formler, samarbejde',
				tag: 'Ny',
				items: [
					'<strong>Formler</strong> på fransk — <code>SI</code>, <code>ARRONDI</code>, <code>JOURS</code>… — som bliver til kolonner genereret af PostgreSQL; <strong>opslag</strong>, <strong>aggregeringer</strong> og <strong>optællinger</strong> på tværs af relationer. <a href="/fonctionnalites/tables-et-champs/">Felterne</a>',
					'<strong>Nye typer</strong>: multipel relation, person, e-mail, autonummer, knap; og formater, der vælges som typer — valuta, procent, varighed, bedømmelse med stjerner, telefon, stregkode.',
					'<strong>Otte visninger</strong>: <strong>galleriet</strong> og <strong>listen</strong> slutter sig til de seks andre; <strong>personlige visninger</strong> for alle læsere, låste visninger, manuel rækkefølge, afhængigheder i tidslinjen. <a href="/fonctionnalites/vues/">Visningerne</a>',
					'<strong>Gitteret</strong>: hurtigsøgning, gruppering, opsummering pr. kolonne over hele filteret, farver efter regler, rækkehøjde.',
					'<strong>Delte visninger</strong>, skrivebeskyttede og til at indlejre på et andet websted; en kalender bliver til et <strong>iCalendar-feed</strong> til Google Kalender, Outlook eller Apple Kalender. <a href="/fonctionnalites/vues-partagees/">Deling</a>',
					'<strong>Samarbejde</strong>: kommentarer og omtaler, notifikationer, andres skrivninger i realtid, tilstedeværelse i tabellen og på rækken. <a href="/fonctionnalites/collaboration/">Arbejd sammen</a>',
					'<strong>Ctrl+Z</strong> fortryder den seneste skrivning — en celle, et flyttet kort, en hel import — og afviser hellere end at overskrive det, en anden har ændret siden.',
					'<strong>Automatiseringer</strong>: når en række oprettes eller ændres, på et fast tidspunkt eller med et klik på en knap — rediger, opret, giv besked, kald en webhook, skriv på Slack. <a href="/fonctionnalites/automatisations/">Automatisér</a>',
					'<strong>Brugerflader</strong>: dashboards — tal, diagrammer, lister, tekster — læst med hver persons egne tilladelser. <a href="/fonctionnalites/tableaux-de-bord/">Dashboards</a>',
					'<strong>Integrationer</strong>: en Slack-kanal og <strong>synkroniserede tabeller</strong> fra en online-CSV, en kalender eller en visning fra en anden basedb. <a href="/integrations/synchronisation/">Integrationerne</a>',
					'<strong>Databaseskabeloner</strong>: et galleri med ti skabeloner, en database beskrevet for AI i én sætning, og enhver database kan gemmes som skabelon. <a href="/modeles/">Galleriet</a>',
					'<strong>Tilladelser</strong>: Struktur-skærmen bliver skrivebeskyttet for dem, der ikke har niveauet Administrere.',
					'<strong>Ny identitet</strong>: et logo, en farvepalet og en ny loginskærm.',
				],
			},
			simpler: {
				date: '2026-09-26',
				title: 'En enklere brugerflade',
				items: [
					'<strong>Sidepanelet</strong> viser nu kun databaserne og deres tabeller; skærmene for den åbne database — Struktur, Historik, Brugerflader, Automatiseringer — er samlet i en blok lige over profilen.',
					'<strong>Profilmenuen</strong> rummer det, der ikke er data: API- og MCP-dokumentationen, integrationerne, brugerne og tilladelserne.',
					'<strong>En SQL-forespørgsel</strong> åbnes med »+« i fanelinjen eller fra databasens menu, uden dublet i sidepanelet.',
					'<strong>Ny database</strong> tilbyder skabeloner og AI direkte i dialogen; demodatabasen går gennem det samme galleri.',
					'<strong>Skærmen tilbyder ikke længere det, der ville blive afvist</strong>: ingen strukturknapper uden Administrere, intet »Slet« uden tilladelse til at slette; og en læser opretter sine egne visninger i stedet for at løbe ind i en fejlmeddelelse.',
					'<strong>Systemkolonnerne</strong> er samlet under »Systemoplysninger« i stedet for at blive tilbudt i hver tabel.',
					'<strong>Rækkedetaljerne</strong> får deres kommentarer, en knap til at skrive eller ringe og en bedømmelse, der sættes med ét klik.',
					'<strong>Loginskærmen</strong> dropper sin animerede 3D-baggrund til fordel for en let skærm, der respekterer indstillingen »reducer bevægelse«.',
				],
			},
			environments: {
				date: '2026-09-26',
				title: 'Miljøer, delte formularer, visninger',
				items: [
					'<strong>Miljøer</strong>: produktion, test og udvikling for den samme database; sammenligning side om side, migreringsplan, synkronisering af rækker.',
					'<strong>Strukturhistorik</strong>: hver oprettelse eller ændring af en tabel eller et felt, registreret af en trigger på kataloget.',
					'<strong>Delte formularer</strong>: et offentligt link eller et, der er forbeholdt medlemmer, lukning efter dato eller antal svar, svarene tilskrevet i historikken.',
					'<strong>Seks visninger</strong>: gitter, kanban, kalender, tidslinje, formular, spørgeskema.',
					'<strong>Datahistorik</strong>: fortryd en ændring, gendan en slettet række.',
					'<strong>AI</strong>: AI-tilvalget på ethvert felt og Copilot.',
					'<strong>Relation</strong> og <strong>URL</strong>: to adskilte typer; lang tekst skrives i Markdown.',
					'<strong>Webhooks</strong>, signerede og i rækkefølge; <strong>agenternes forslag</strong>, som skal godkendes.',
					'<strong>Docker</strong>: en Dockerfile med tre targets, en komplet docker-compose, en valgfri HTTPS-proxy.',
				],
			},
			projects: {
				date: '2026-09-25',
				title: 'Projekter, tilladelser, MCP-server',
				items: [
					'<strong>Projekter</strong> over databaserne og tilladelser via <strong>grupper</strong> på fire niveauer: Ingen adgang, Læse, Redigere, Administrere.',
					'<strong>Konti</strong>: midlertidig adgangskode, der skiftes ved første login, forhøjet session til administration.',
					'<strong>MCP-server</strong> og stdio-relæ; <strong>integrationstokens</strong>, der er fælles for REST-API’et og MCP.',
					'<strong>Genereret dokumentation</strong> »API og MCP« for hver database.',
				],
			},
			fields: {
				date: '2026-09-20',
				title: 'Felter, enkeltvalg, import',
				items: [
					'Rediger et felt og mulighederne i et enkeltvalg.',
					'<strong>Import</strong> af CSV- og JSON-filer.',
					'En tabels menu: omdøb, beskriv, slet.',
				],
			},
			firstCommit: {
				date: '2026-09-20',
				title: 'Første commit',
				items: [
					'Monorepoet: navngivning, register over fejlkoder, katalog udtrukket fra arkitekturdokumentet, kerne, API, brugerflade.',
				],
			},
		},
	},
	roadmap: {
		label: 'Køreplan',
		title: 'Det, der kommer',
		intro: 'basedb er under aktiv udvikling. Denne side fortæller, hvad der stadig mangler, uden lovede datoer. En idé, et behov? <a href="https://github.com/eodia/basedb/issues">Opret et issue</a>. Det, der allerede er her: <a href="/nouveautes/">nyhederne</a>.',
		columns: {
			next: {
				title: 'Snart',
				items: {
					restoreTable: {
						title: 'Gendan en enkelt tabel',
						text: 'En slettet tabel kan stadig læses i SQL under sit henlagte navn; at hente den alene tilbage fra brugerfladen er på vej.',
					},
					aiSettings: {
						title: 'AI-indstillinger i brugerfladen',
						text: 'Udbyder, model og nøgle pr. arbejdsområde uden at gå via API’ets miljø.',
					},
					mail: {
						title: 'Notifikationer og invitationer via e-mail',
						text: 'Omtaler, svar og udpegninger kommer i dag ind i basedb, og invitationer som et link, du selv sender; de vil også kunne sendes via e-mail.',
					},
				},
			},
			later: {
				title: 'Senere',
				items: {
					formLinks: {
						title: 'Relationer og filer i delte formularer',
						text: 'En begrænset søgning i den tilknyttede tabel, en afgrænset filupload for anonyme besøgende.',
					},
					moreEvents: {
						title: 'Flere hændelser med notifikation',
						text: 'Få besked om et svar på en formular, et forslag fra en agent, en deaktiveret webhook.',
					},
					sqlViewsAcross: {
						title: 'SQL-views på tværs af miljøer',
						text: 'Kopiér SQL-views med strukturen, når der oprettes eller sammenlignes miljøer, og i databaseskabeloner.',
					},
					loops: {
						title: 'Løkker og ventetid i automatiseringer',
						text: 'Gentag trin for hver fundet række, vent før det næste (»tre dage efter«), og tag flows med i databaseskabeloner.',
					},
					textFormulas: {
						title: 'Formler på tekst',
						text: 'Udtræk, erstat eller afkort en del af en tekst.',
					},
					bulk: {
						title: 'Erklærede masseoperationer',
						text: 'Ændringer af tusindvis af rækker, registreret i historikken som én operation.',
					},
					tombstones: {
						title: 'Oprydning i gravsten',
						text: 'Oprydning i sletningsspor, der ikke længere er brug for.',
					},
				},
			},
		},
	},
	gallery: {
		label: 'Skabeloner',
		title: 'En database klar på få sekunder',
		intro: 'Hver skabelon opretter tabeller, der er forbundet med hinanden, eksempelrækker, visninger, et dashboard, automatiseringer — og felter, som AI selv udfylder. I basedb: <strong>Ny database</strong> og derefter <strong>Start fra en skabelon</strong>. Passer intet? Beskriv dit behov i én sætning: AI foreslår en skræddersyet database.',
		filter: 'Filtrér efter kategori',
		all: 'Alle',
		otherCategory: 'Andre',
		ai: '✦ AI',
		tables: {
			one: '{n} tabel',
			other: '{n} tabeller',
		},
		rows: {
			one: '{n} række',
			other: '{n} rækker',
		},
		views: {
			one: '{n} visning',
			other: '{n} visninger',
		},
		howtoTitle: 'Skriv skabeloner i JSON',
		howto: 'En skabelon er en JSON-fil: dens tabeller, felter, relationer, rækker, visninger, dashboards, automatiseringer og instruktionerne til dens AI-felter. Skabelonerne på denne side er filerne i repositoriets mappe <a href="https://github.com/eodia/basedb/tree/main/packages/templates/catalog"><code>packages/templates/catalog</code></a>; hver basedb-instans læser <a href="/modeles/catalogue.json"><code>catalogue.json</code></a> og tilbyder dem til sine brugere. En administrator kan også importere sine egne skabeloner i sin instans, og enhver database kan gemmes som skabelon.',
		format: {
			href: '/fonctionnalites/modeles/',
			label: 'Skabelonformatet →',
		},
		back: '← Alle skabeloner',
		defaultCategory: 'Skabelon',
		sampleRows: {
			one: '{n} eksempelrække',
			other: '{n} eksempelrækker',
		},
		aiTitle: 'Hvad AI beregner',
		useTitle: 'Brug denne skabelon',
		useSteps: [
			'I basedb: <strong>Ny database</strong>.',
			'<strong>Start fra en skabelon</strong>, og vælg derefter »{label}«.',
		],
		create: '<strong>Opret databasen</strong>.',
		createWithAi: '<strong>Opret databasen</strong> — og acceptér, hvis du vil, at AI-felterne beregnes af din AI-udbyder.',
		download: 'Download JSON-filen',
		downloadNote: 'For at importere den i din instans eller tilpasse den, før du foreslår den til kataloget.',
		viewMeta: '— {kind}, {table}',
		dashboard: '<strong>Dashboard</strong> »{label}« — {blocks}',
		blocks: {
			one: '{n} blok',
			other: '{n} blokke',
		},
		automation: '<strong>Automatisering</strong> »{label}«',
		yes: 'Ja',
		no: 'Nej',
		me: 'Dig',
		kinds: {
			short_text: 'Kort tekst',
			long_text: 'Lang tekst',
			rich_text: 'Formateret tekst',
			number: 'Tal',
			boolean: 'Afkrydsningsfelt',
			date: 'Dato',
			datetime: 'Dato og klokkeslæt',
			select: 'Enkeltvalg',
			multi_select: 'Flervalg',
			url: 'URL',
			email: 'E-mail',
			user: 'Person',
			autonumber: 'Autonummer',
			formula: 'Formel',
			lookup: 'Opslag',
			rollup: 'Aggregering',
			count: 'Antal',
			button: 'Knap',
			link: 'Relation',
			multi_link: 'Multipel relation',
		},
		viewKinds: {
			grid: 'Gitter',
			kanban: 'Kanban',
			calendar: 'Kalender',
			timeline: 'Tidslinje',
			gallery: 'Galleri',
			list: 'Liste',
			form: 'Formular',
		},
	},
	templates: {
		demo: {
			label: 'Demo: Atelier Lumen',
			summary: 'Et lille bureau med dets kunder, projekter, opgaver, fakturaer og anmeldelser: alle sider af basedb i én database.',
			description: 'Demodatabasen. Atelier Lumen er et fiktivt designbureau. Databasen viser relationer mellem tabeller, opslag og aggregeringer (omsætning pr. kunde, gennemsnitlig bedømmelse), formler (beløb inkl. moms, forsinkelse), tre felter beregnet af AI ud fra kundeanmeldelser (stemning, tema, foreslået svar), alle slags visninger — gitter, kanban, kalender, tidslinje med afhængigheder, galleri, liste, formular —, et dashboard og to automatiseringer.',
			category: 'Demo',
			tags: ['AI', 'Relationer', 'Alle visninger', 'Dashboard'],
		},
		'analyse-avis': {
			label: 'Analyse af kundeanmeldelser',
			summary: 'Indsaml anmeldelser, og lad AI udlede stemningen, temaerne, hvor meget det haster, og et udkast til svar.',
			description: 'Til en butik, en restaurant eller et brand: anmeldelserne kommer fra en offentlig formular eller en import, og AI læser hver enkelt. Den klassificerer stemningen, finder hovedtemaet, markerer dem, der kræver et hurtigt svar, udtrækker kundens forslag og skriver et svar, som skal gennemlæses. Produkterne samler deres gennemsnitlige bedømmelse og antal anmeldelser; et dashboard følger tilfredsheden.',
			category: 'Kunderelationer',
			tags: ['AI', 'Formular', 'Dashboard'],
		},
		'base-connaissances': {
			label: 'Vidensbase',
			summary: 'Hjælpeartikler og kundespørgsmål: AI opsummerer, klassificerer og foreslår et svar ud fra artiklerne.',
			description: 'Til en supportafdeling. Hjælpeartiklerne er ordnet efter kategori og følges over tid; kundernes spørgsmål kommer ind via en offentlig formular. AI opsummerer hver artikel og vurderer dens niveau, klassificerer hvert spørgsmål og skriver et udkast til svar, som skal gennemlæses.',
			category: 'Support',
			tags: ['AI', 'Formular', 'Liste'],
		},
		'calendrier-editorial': {
			label: 'Redaktionel kalender',
			summary: 'Artikler, opslag og nyhedsbreve planlagt i en kalender; AI foreslår fængende indledninger og nøgleord.',
			description: 'Til et marketingteam eller en redaktion. Hvert indhold går fra idé til udgivelse, placeres i udgivelseskalenderen og hører til en kampagne. AI foreslår en fængende indledning og nøgleord ud fra briefet, og en formular gør det muligt for hele virksomheden at foreslå et emne.',
			category: 'Marketing',
			tags: ['AI', 'Kalender', 'Kanban', 'Formular'],
		},
		crm: {
			label: 'Salgs-CRM',
			summary: 'Virksomheder, kontakter og salgsmuligheder: en salgspipeline, dialogen med kunderne og AI, der foreslår næste skridt.',
			description: 'Et let CRM til et salgsteam. Salgsmulighederne bevæger sig gennem en pipeline og har et beløb vægtet efter deres sandsynlighed, og AI vurderer risikoen og foreslår næste handling ud fra noterne. Dialogen med kunderne registreres og opsummeres, og virksomhederne samler, hvad de repræsenterer.',
			category: 'Salg',
			tags: ['AI', 'Pipeline', 'Kanban', 'Kalender'],
		},
		evenements: {
			label: 'Arrangementer og tilmeldinger',
			summary: 'Konferencer, workshops og webinarer: tilmeldingerne, de ledige pladser og deltagernes feedback læst af AI.',
			description: 'Til tilbagevendende arrangementer. Hvert arrangement tæller sine tilmeldte og ledige pladser; tilmeldingerne følges helt frem til fremmødet. Efter arrangementet giver deltagerne feedback, som AI klassificerer efter stemning og opsummerer. En offentlig formular gør det muligt at tilmelde sig mailinglisten.',
			category: 'Arrangementer',
			tags: ['AI', 'Kalender', 'Formular', 'Aggregeringer'],
		},
		'gestion-projet': {
			label: 'Projektstyring',
			summary: 'Projekter, opgaver og milepæle: en køreplan, afhængigheder mellem opgaver, et kanban og en kalender.',
			description: 'Til at styre flere projekter parallelt. Hvert projekt summerer sine opgaver og timer; opgaverne følges i kanban og planlægges på en tidslinje, der viser deres afhængigheder, og milepælene kan ses i en kalender. AI skriver en statusrapport om projektet til ledelsen ud fra dets beskrivelse og fremdrift.',
			category: 'Organisering',
			tags: ['Tidslinje', 'Afhængigheder', 'Kanban', 'AI'],
		},
		inventaire: {
			label: 'Lager og beholdning',
			summary: 'Varer, leverandører og lagerbevægelser: lagerbeholdningen beregnes af sig selv, og mangler kan ses i god tid.',
			description: 'Til et værksted, en butik eller en intern servicefunktion. Hver indgang eller udgang er en bevægelse; hver vares lagerbeholdning er summen af dem, dens værdi en formel, og varer under deres minimumsbeholdning vises i »À commander« (skal bestilles). AI skriver hver vares beskrivelse ud fra dens navn og kategori.',
			category: 'Drift',
			tags: ['Aggregeringer', 'Formler', 'Galleri', 'AI'],
		},
		recrutement: {
			label: 'Rekruttering',
			summary: 'Ledige stillinger, kandidater og samtaler; AI sammenfatter hver ansøgning og foreslår punkter, der bør uddybes.',
			description: 'Opfølgning på rekrutteringer fra ansøgning til ansættelse. Kandidaterne søger via en offentlig formular og går trin for trin videre i et kanban, og samtalerne planlægges i en kalender. AI læser ansøgningen og noterne: en sammenfatning og spørgsmål til samtalen. Den hjælper med at læse, den beslutter ikke.',
			category: 'HR',
			tags: ['AI', 'Formular', 'Kanban', 'Kalender'],
		},
		'suivi-tickets': {
			label: 'Sagsstyring',
			summary: 'Fejl og ønsker sorteret af AI og fulgt pr. sprint, indtil de er løst, med en formular til indberetning.',
			description: 'Et ticketsystem til et produktteam. Hver ticket er knyttet til en komponent og en sprint; AI foreslår en kategori, vurderer alvorligheden og opsummerer indberetningen. Et kanban følger fremdriften, en tidslinje viser sprintene, en formular gør det muligt for alle at indberette et problem, og en automatisering registrerer løsningsdatoen.',
			category: 'Produkt og teknik',
			tags: ['AI', 'Kanban', 'Formular', 'Sprints'],
		},
	},
} satisfies DeepPartial<Dict>;
