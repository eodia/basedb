/**
 * The Norwegian Bokmål texts of the landing pages, laid over the French ones (`fr.ts`).
 *
 * See `../README.md`.
 */
import type { DeepPartial, Dict } from './index';

export default {
	meta: {
		home: {
			title: 'basedb – samarbeidsdatabasen der hver tabell er en ekte PostgreSQL-tabell',
			description: 'Rutenett og ti visninger, formler, delte skjemaer, quiz og visninger, kommentarer, automatiseringer, instrumentbord, tillatelser helt ned til feltet, full historikk, REST-API og MCP-server – på ekte PostgreSQL-tabeller med lesbare navn. Selvhostet, AGPL-3.0.',
		},
		changelog: {
			title: 'Nyheter – basedb',
			description: 'Hva som er endret i basedb, versjon for versjon.',
		},
		roadmap: {
			title: 'Veikart – basedb',
			description: 'Hva basedb skal gjøre videre.',
		},
		gallery: {
			title: 'Maler – basedb',
			description: 'Ferdige databaser: sakshåndtering, analyse av omtaler, CRM, rekruttering … med eksempelrader, visninger, instrumentbord og felt som KI beregner.',
		},
		template: {
			title: '{label} – basedb-maler',
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
		aria: 'Hovednavigasjon',
		home: 'basedb – forside',
		links: [
			{
				href: '/#fonctionnalites',
				label: 'Funksjoner',
			},
			{
				href: '/modeles/',
				label: 'Maler',
			},
			{
				href: '/guides/introduction/',
				label: 'Dokumentasjon',
			},
			{
				href: '/nouveautes/',
				label: 'Nyheter',
			},
		],
		developers: 'Utviklere',
		github: 'GitHub-depotet til basedb',
		install: 'Installer',
		menu: {
			open: 'Åpne menyen',
			close: 'Lukk menyen',
			features: {
				label: 'Funksjoner',
				groups: {
					organize: {
						title: 'Organisere',
						items: {
							tables: {
								href: '/fonctionnalites/tables-et-champs/',
								title: 'Tabeller og felt',
								text: 'Felt for alt, relasjoner, formler som i et regneark.',
							},
							views: {
								href: '/fonctionnalites/vues/',
								title: 'Ti visninger',
								text: 'Rutenett, kanban, kalender, tidslinje, galleri, liste, kart, skjema, spørreundersøkelse, quiz.',
							},
							forms: {
								href: '/fonctionnalites/formulaires-partages/',
								title: 'Skjemaer',
								text: 'En lenke å dele: hvert svar blir en rad.',
							},
							files: {
								href: '/fonctionnalites/fichiers/',
								title: 'Filer og bilder',
								text: 'Tilbud, bilder, kontrakter, lagret sammen med raden sin.',
							},
						},
					},
					collaborate: {
						title: 'Samarbeide',
						items: {
							live: {
								href: '/fonctionnalites/collaboration/',
								title: 'Sanntid og kommentarer',
								text: 'Se de andre jobbe, kommentere en rad, omtale en kollega.',
							},
							rights: {
								href: '/fonctionnalites/droits/',
								title: 'Tillatelser og team',
								text: 'Hvem ser hva og hvem endrer hva, helt ned til kolonnen.',
							},
							history: {
								href: '/fonctionnalites/historique/',
								title: 'Historikk',
								text: 'Hver endring lagres, og kan angres.',
							},
							shared: {
								href: '/fonctionnalites/vues-partagees/',
								title: 'Delte visninger',
								text: 'En visning via en lenke, på nettstedet ditt eller i kalenderen din.',
							},
						},
					},
					automate: {
						title: 'Automatisere og analysere',
						items: {
							automations: {
								href: '/fonctionnalites/automatisations/',
								title: 'Automatiseringer',
								text: 'Når en rad endres: varsle, opprette, skrive, spørre KI.',
							},
							dashboards: {
								href: '/fonctionnalites/tableaux-de-bord/',
								title: 'Instrumentbord',
								text: 'Femten visualiseringer, felles filtre, en lenke å dele.',
							},
							ai: {
								href: '/fonctionnalites/ia/',
								title: 'KI og Copilot',
								text: 'En database i én setning, felt som fylles ut selv.',
							},
							templates: {
								href: '/modeles/',
								title: 'Maler',
								text: 'Ti ferdige databaser, klare til å tilpasses.',
							},
						},
					},
				},
				feature: {
					tag: 'Nytt',
					title: 'Automatiseringer som flyt',
					text: 'Søke, avgjøre, spørre KI: en grafeditor, og hver kjøring kan leses på nytt trinn for trinn.',
					href: '/nouveautes/',
					cta: 'Alle nyhetene',
				},
				all: 'Alle funksjonene',
			},
			solutions: {
				label: 'Løsninger',
				title: 'For hvert team',
				items: {
					crm: {
						team: 'Salg',
						text: 'Pipeline, kontakter, oppfølging.',
					},
					recrutement: {
						team: 'HR',
						text: 'Søknader, intervjuer, sammendrag fra KI.',
					},
					'calendrier-editorial': {
						team: 'Markedsføring',
						text: 'Artikler, innlegg og nyhetsbrev planlagt.',
					},
					inventaire: {
						team: 'Operasjoner',
						text: 'Beholdning beregnet automatisk, mangler sett i forkant.',
					},
					'gestion-projet': {
						team: 'Prosjekter',
						text: 'Milepæler, oppgaver og avhengigheter.',
					},
					'suivi-tickets': {
						team: 'Produkt',
						text: 'Feil og henvendelser sortert av KI.',
					},
					'base-connaissances': {
						team: 'Kundestøtte',
						text: 'Hjelpeartikler, spørsmål, forslag til svar.',
					},
					evenements: {
						team: 'Arrangementer',
						text: 'Påmeldinger, plasser, tilbakemeldinger.',
					},
					'analyse-avis': {
						team: 'Kunderelasjoner',
						text: 'Omtaler lest og klassifisert av KI.',
					},
				},
				ask: {
					title: 'Noe annet i tankene?',
					text: 'Beskriv behovet ditt i én setning: KI foreslår en skreddersydd database.',
					href: '/modeles/',
				},
				all: 'Alle malene',
			},
			developers: {
				label: 'Utviklere',
				groups: {
					build: {
						title: 'Integrere',
						items: {
							api: {
								href: '/integrations/api-rest/',
								title: 'REST-API',
								text: 'De samme dataene som grensesnittet, beskrevet i OpenAPI 3.1.',
							},
							mcp: {
								href: '/integrations/mcp/',
								title: 'MCP-server',
								text: 'Verktøy for KI-agentene dine, under dine egne tillatelser.',
							},
							webhooks: {
								href: '/integrations/webhooks/',
								title: 'Webhooks',
								text: 'Hver skriving, signert, i rekkefølge, med nye forsøk.',
							},
							sql: {
								href: '/integrations/sql/',
								title: 'Direkte SQL',
								text: 'Ekte PostgreSQL-tabeller, med lesbare navn.',
							},
							sync: {
								href: '/integrations/synchronisation/',
								title: 'Synkronisering',
								text: 'Tabeller holdt oppdatert fra et annet sted.',
							},
						},
					},
					host: {
						title: 'Drifte',
						items: {
							docker: {
								href: '/hebergement/docker/',
								title: 'Docker Compose',
								text: 'Ett image, én PostgreSQL-database, én enkelt port.',
							},
							env: {
								href: '/hebergement/variables/',
								title: 'Variabler',
								text: 'Alt settes opp i .env-filen.',
							},
							https: {
								href: '/hebergement/https/',
								title: 'Domene og HTTPS',
								text: 'Bak din egen proxy, eller med den medfølgende Caddy.',
							},
							sso: {
								href: '/hebergement/connexion/',
								title: 'Innlogging og SSO',
								text: 'Google, Microsoft, eller en hvilken som helst OpenID Connect-leverandør.',
							},
							backup: {
								href: '/hebergement/sauvegardes/',
								title: 'Sikkerhetskopier og oppdateringer',
								text: 'pg_dump, og oppdateringer uten datatap.',
							},
						},
					},
				},
				feature: {
					title: 'Utviklersiden',
					text: 'En ekte PostgreSQL-tabell bak hvert rutenett.',
					href: '/developpeurs/',
				},
			},
			resources: {
				label: 'Ressurser',
				groups: {
					learn: {
						title: 'Lære',
						items: {
							docs: {
								href: '/guides/introduction/',
								title: 'Dokumentasjon',
								text: 'Alt om basedb, steg for steg.',
							},
							start: {
								href: '/guides/premiers-pas/',
								title: 'Kom i gang',
								text: 'Din første database, fra import til visning.',
							},
							install: {
								href: '/guides/installation/',
								title: 'Installasjon',
								text: 'To filer og én kommando.',
							},
							principles: {
								href: '/architecture/principes/',
								title: 'Prinsippene',
								text: 'Hvordan basedb er bygget, og hvorfor.',
							},
						},
					},
					follow: {
						title: 'Følge prosjektet',
						items: {
							news: {
								href: '/nouveautes/',
								title: 'Nyheter',
								text: 'Hva som har endret seg, versjon for versjon.',
							},
							roadmap: {
								href: '/feuille-de-route/',
								title: 'Veikart',
								text: 'Hva som kommer videre.',
							},
							github: {
								href: 'https://github.com/eodia/basedb',
								title: 'GitHub',
								text: 'Koden, sakene, versjonene.',
							},
							eodia: {
								href: 'https://eodia.com/',
								title: 'Eodia',
								text: 'Studioet som lager basedb.',
							},
						},
					},
				},
			},
		},
	},
	language: {
		label: 'Språk',
		current: 'Språk: {name}',
	},
	footer: {
		tagline: 'Samarbeidsdatabasen der hver tabell er en ekte PostgreSQL-tabell.',
		madeBy: 'Fri programvare fra <a class="eodia" href="https://eodia.com/">Eodia</a>, et KI-nativt programvarestudio.',
		columns: {
			product: {
				title: 'Produkt',
				links: [
					{
						href: '/#fonctionnalites',
						label: 'Funksjoner',
					},
					{
						href: '/nouveautes/',
						label: 'Nyheter',
					},
					{
						href: '/feuille-de-route/',
						label: 'Veikart',
					},
					{
						href: '/#faq',
						label: 'Vanlige spørsmål',
					},
				],
			},
			docs: {
				title: 'Dokumentasjon',
				links: [
					{
						href: '/guides/introduction/',
						label: 'Introduksjon',
					},
					{
						href: '/guides/installation/',
						label: 'Installasjon',
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
				title: 'Drift',
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
						label: 'Domene og HTTPS',
					},
					{
						href: '/hebergement/sauvegardes/',
						label: 'Sikkerhetskopier',
					},
				],
			},
			project: {
				title: 'Prosjekt',
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
						label: 'AGPL-3.0-lisens',
					},
					{
						href: 'https://github.com/eodia/basedb/issues',
						label: 'Rapporter et problem',
					},
				],
			},
			eodia: {
				title: 'Eodia',
				links: [
					{
						href: 'https://eodia.com/',
						label: 'Studioet',
					},
					{
						href: 'https://eodia.com/about/',
						label: 'Om oss',
					},
					{
						href: 'https://eodia.com/contact/',
						label: 'Kontakt oss',
					},
				],
			},
		},
		copyright: '© {year} <a href="https://eodia.com/">Eodia</a> · AGPL-3.0-or-later',
		builtWith: 'Nettstedet er bygget med Astro og Starlight.',
	},
	docsFooter: {
		madeBy: 'basedb er fri programvare fra <a href="https://eodia.com/">Eodia</a>, et KI-nativt programvarestudio.',
	},
	teams: {
		meta: {
			title: 'basedb – samarbeidsdatabasen for hele teamet',
			description: 'Alt arbeidet ditt på ett sted, redigert av hele teamet samtidig: som tabell, kanban eller kalender, med skjemaer, instrumentbord, automatiseringer og KI. Uten kode, fri og gratis.',
		},
		hero: {
			eyebrow: 'basedb',
			title: 'Alt arbeidet ditt.',
			titleAccent: 'Endelig på ett sted.',
			lead: 'Tabeller, kalendere, skjemaer, instrumentbord og automatiseringer, for hele teamet. Like enkelt som et regneark. Uten en linje kode.',
			primary: 'Utforsk malene',
			secondary: 'Se demoen',
			facts: ['Uten kode', 'Fri og gratis', 'Dataene dine blir hos deg'],
		},
		story: {
			grid: {
				title: 'Hele teamet, i samme tabell.',
				text: 'Alle jobber der samtidig, og alle ser det samme, oppdatert.',
			},
			copilot: {
				title: 'Spør. Copilot tar seg av det.',
				text: '«Hvem bør jeg følge opp denne uken?» – Copilot foreslår riktig filter, og du bruker det med et klikk.',
			},
			kanban: {
				title: 'Dra. Da er det oppdatert.',
				text: 'Hvert trinn blir en kolonne; å flytte et kort er å endre raden.',
			},
			calendar: {
				title: 'Hver dato på sin plass.',
				text: 'Avtalene vises helt av seg selv, og følger deg til og med i kalenderen din.',
			},
			dashboard: {
				title: 'Og alt, med et blikk.',
				text: 'Tallene beregnes selv, fra de samme radene.',
			},
		},
		stage: {
			aria: 'Kundeoppfølgingen til et team i basedb: tabell, Copilot, kanban, kalender, instrumentbord',
			tabs: {
				grid: 'Tabell',
				copilot: 'Copilot',
				kanban: 'Kanban',
				calendar: 'Kalender',
				dashboard: 'Instrumentbord',
			},
			project: 'Hovedprosjekt',
			projectMeta: 'Prosjekt · 2 databaser',
			filterNav: 'Filtrer navigasjonen',
			base: 'Salg',
			otherBase: 'Kundestøtte',
			tables: ['Kunder', 'Kontakter', 'Tilbud'],
			baseSection: 'Database · Salg',
			screens: ['Instrumentbord', 'Automatiseringer'],
			user: 'Léa Martin',
			views: { grid: 'Alle rader', kanban: 'Per trinn', calendar: 'Møter' },
			toolbar: {
				filter: 'Filtrer',
				columns: 'Kolonner',
				group: 'Grupper',
				colors: 'Farger',
				sort: 'Sorter',
				configure: 'Konfigurer',
			},
			search: 'Søk…',
			add: 'Legg til',
			columns: {
				name: 'Kunde',
				status: 'Trinn',
				owner: 'Ansvarlig',
				amount: 'Beløp',
				next: 'Neste møte',
			},
			statuses: {
				contact: 'Skal kontaktes',
				meeting: 'Møte',
				quote: 'Tilbud sendt',
				signed: 'Signert',
			},
			clients: [
				'Bakeriet Berg',
				'Lindetunet klinikk',
				'Åsen skole',
				'Sykkelhjelpen',
				'Finkost Moen',
				'Fjordsmia',
				'Snekkeriet Lund',
			],
			addRow: 'Legg til en rad',
			perPage: 'Rader per side',
			card: 'Fulgt opp av {owner}, møte {date}',
			addCard: 'Legg til et kort',
			today: 'I dag',
			month: 'Måned',
			week: 'Uke',
			dashboards: 'Instrumentbord',
			questions: 'Spørsmål',
			dashboard: 'Salgsoppfølging',
			dashboardText: 'Det viktigste, med et blikk.',
			dashboardTabs: ['Oversikt', 'Aktivitet'],
			period: 'Periode',
			thisYear: 'I år',
			share: 'Del',
			edit: 'Rediger',
			explore: 'Utforsk dataene',
			chart: 'Beløp per kunde',
			byStage: 'Kunder per trinn',
			kpis: {
				signed: 'Signert',
				pending: 'Tilbud som venter',
				rate: 'Signerte kunder',
			},
			copilot: {
				question: 'Hvem bør jeg følge opp denne uken?',
				thinking: 'Tenker…',
				answer: 'Fire kunder venter på svar: to tilbud sendt og to møter å forberede.',
				card: 'Filtrer Kunder',
				filter: 'Trinn: Tilbud sendt eller Møte',
				apply: 'Bruk filteret',
				applied: 'Filter brukt',
				placeholder: 'Spør Copilot…',
				filtered: '{n} filtrerte rader',
			},
		},
		teaser: {
			tabs: { label: 'Velg video', short: 'På 40 sekunder', full: 'Hele omvisningen' },
			titleAccent: 'på 40 sekunder.',
			text: 'Tabeller, visninger, skjemaer, automatiseringer og KI: det viktigste i basedb, med musikk.',
			duration: '40 s',
			inEnglish: 'Tekstene i videoen er på engelsk.',
		},

		video: {
			eyebrow: 'Demoen',
			title: 'Hele basedb,',
			titleAccent: 'på sju minutter.',
			text: 'Opprette en database, fylle den, dele den, automatisere den, styre den: hele omvisningen, med kommentarer.',
			play: 'Spill av videoen',
			duration: '6 min 36 s',
			chapters: 'Kapitler',
			captions: 'Engelsk',
			inEnglish: 'Videoen er på engelsk, med engelske undertekster.',
			list: [
				{ time: '0:10', title: 'Opprette en database' },
				{ time: '0:49', title: 'Tabeller, felt og formler' },
				{ time: '1:31', title: 'Raddetaljer og samarbeid' },
				{ time: '1:56', title: 'Seks visninger på de samme radene' },
				{ time: '2:29', title: 'Skjemaer og spørreundersøkelser' },
				{ time: '3:28', title: 'Quiz' },
				{ time: '4:10', title: 'Automatiseringer' },
				{ time: '4:39', title: 'Instrumentbord' },
				{ time: '4:59', title: 'SQL for alle' },
				{ time: '5:30', title: 'Historikk og tillatelser' },
				{ time: '5:53', title: 'API, MCP og Copilot' },
			],
		},
		together: {
			eyebrow: 'Samarbeid',
			title: 'Alle.',
			titleAccent: 'Samtidig.',
			text: 'De andres endringer kommer i sanntid. Du ser hvem som ser på hvilken rad, diskuterer den der den er, og en @ er nok for å varsle en kollega.',
			demo: {
				path: 'Salg / Tilbud',
				here: '3 personer på denne tabellen',
				columns: {
					client: 'Kunde',
					status: 'Trinn',
					amount: 'Beløp',
					due: 'Forfall',
				},
				statuses: {
					draft: 'Utkast',
					sent: 'Sendt',
					signed: 'Signert',
				},
				rows: [
					'Bakeriet Berg',
					'Lindetunet klinikk',
					'Åsen skole',
					'Sykkelhjelpen',
					'Finkost Moen',
					'Fjordsmia',
				],
				comment: '@{name} kan du godkjenne dette tilbudet før i kveld?',
				reply: 'Det er godkjent!',
				toast: '{name} endret «{field}»',
			},
			points: {
				live: {
					title: 'I sanntid',
					text: 'Hver endring vises umiddelbart hos de andre, uten å laste siden på nytt.',
				},
				comments: {
					title: 'Kommentarer og omtaler',
					text: 'Du kommenterer en rad, omtaler en kollega med @, og bjellen varsler dem.',
				},
				undo: {
					title: 'Angre uten risiko',
					text: 'Ctrl+Z angrer din siste endring – aldri en kollegas.',
				},
			},
			link: {
				href: '/fonctionnalites/collaboration/',
				label: 'Jobbe sammen',
			},
		},
		forms: {
			eyebrow: 'Skjemaer og spørreundersøkelser',
			title: 'Still spørsmålene dine.',
			titleAccent: 'Svarene sorterer seg selv.',
			text: 'Et skjema på én side, eller en spørreundersøkelse som stiller ett spørsmål per skjerm, i dine farger: del lenken, og hvert svar blir en rad i tabellen din. Den som svarer, ser ikke noe annet.',
			modes: {
				label: 'Vis spørsmålene',
				survey: 'Spørreundersøkelse',
				form: 'Skjema',
			},
			demo: {
				title: 'Tilbudsforespørsel',
				description: 'Tre spørsmål, og vi kommer tilbake til deg innen 48 timer.',
				count: '3 spørsmål',
				start: 'Start',
				ok: 'OK',
				hint: 'eller Enter',
				submit: 'Send forespørselen min',
				org: {
					label: 'Organisasjonen din',
					answer: 'Kafé Haugen',
				},
				need: {
					label: 'Behovet ditt',
					options: ['Nettside', 'Visuell identitet', 'Katalog'],
				},
				budget: {
					label: 'Budsjettet ditt',
					help: 'Uten mva, gjerne omtrentlig.',
				},
				sent: 'Sendt!',
				thanks: 'Takk! Vi kommer tilbake til deg innen 48 timer.',
				poweredBy: 'Skjema levert av basedb',
				path: 'Salg / Forespørsler',
				view: 'Alle forespørsler',
				columns: {
					org: 'Organisasjon',
					need: 'Behov',
					budget: 'Budsjett',
					stage: 'Trinn',
				},
				stages: {
					new: 'Ny',
					called: 'Ringt opp',
					quote: 'Tilbud sendt',
				},
				rows: ['Bakeriet Berg', 'Lindetunet klinikk', 'Sykkelhjelpen', 'Fjordsmia'],
				open: 'Åpen',
				answers: {
					one: '{n} svar',
					other: '{n} svar',
				},
				active: 'Aktiv lenke',
			},
			points: {
				survey: {
					title: 'Ett spørsmål om gangen',
					text: 'I fullskjerm, med tastaturet: Enter for å fortsette, A, B, C for å velge — et enkeltvalg går alene videre, og innsendingen feires.',
				},
				access: {
					title: 'Åpent eller forbeholdt',
					text: 'Alle med lenken kan svare uten konto — eller bare innloggede medlemmer, og svaret bærer navnet deres.',
				},
				closed: {
					title: 'Resten forblir lukket',
					text: 'Å svare viser ikke noe annet av tabellen. Lenken lukkes på en gitt dato, eller etter et antall svar.',
				},
			},
			link: {
				href: '/fonctionnalites/formulaires-partages/',
				label: 'Skjemaene',
			},
		},
		automate: {
			eyebrow: 'Automatiseringer',
			title: 'Den jobber',
			titleAccent: 'mens du sover.',
			text: 'Når en rad kommer inn eller endres, til fast klokkeslett eller med et klikk på en knapp, følger basedb trinnene: den velger riktig gren, spør KI, og varsler dem som skal ha beskjed. Og hver kjøring kan leses på nytt, trinn for trinn.',
			clock: '03:12',
			crumb: 'Salg / Automatiseringer',
			create: 'Ny automatisering',
			list: [
				{
					name: 'Ny forespørsel',
					when: 'En rad opprettes',
				},
				{
					name: 'Tilbud signert',
					when: 'En rad endres',
				},
				{
					name: 'Mandagsoppfølging',
					when: 'Hver mandag kl. 09.00',
				},
			],
			active: 'Aktiv',
			test: 'Test på en rad',
			save: 'Lagre',
			when: 'Når',
			trigger: 'En rad opprettes',
			table: 'I Forespørsler',
			steps: {
				branch: {
					kind: 'Betingelse',
					text: '2 grener',
					run: 'gren «Stort prosjekt»',
				},
				notify: {
					kind: 'Varsle noen',
					text: 'Léa Martin',
					run: '1 person varslet',
				},
				create: {
					kind: 'Opprett en rad',
					text: 'Et møte, i Kalender',
					run: 'utført',
				},
				slack: {
					kind: 'Send til Slack',
					text: 'I kanalen #salg',
					run: 'utført',
				},
				ai: {
					kind: 'Spør KI',
					text: 'Skriv et første svar',
					run: 'svar på {n} tegn',
				},
				update: {
					kind: 'Endre en rad',
					text: 'Svar, Trinn',
					run: 'utført',
				},
			},
			paths: {
				big: 'Stort prosjekt',
				condition: 'budget gt 5000',
				otherwise: 'Ellers',
			},
			answer: 'Hei, og takk for forespørselen din! Léa, som skal følge opp din nye visuelle identitet, ringer deg i morgen tidlig.',
			addStep: 'Legg til et trinn',
			tabs: {
				settings: 'Oppsett',
				runs: 'Kjøringer',
			},
			runsText: 'De 50 siste, beholdt i 30 dager. Velg en for å se grenen den fulgte i flyten.',
			running: 'Pågår',
			succeeded: 'Vellykket',
			started: 'rad opprettet · {when}',
			now: 'akkurat nå',
			earlier: ['i går kl. 18:40', 'i går kl. 11:02'],
			done: 'Vellykket · 5 trinn · 1,3 s',
			points: {
				when: {
					title: 'På rett tidspunkt',
					text: 'En rad som opprettes eller endres, et fast klokkeslett, en knapp — og en betingelse, så det bare starter når det skal.',
				},
				paths: {
					title: 'Flere grener',
					text: 'En betingelse åpner grener, hver med sine trinn; det et trinn finner, kan det neste vise til.',
				},
				copilot: {
					title: 'Beskrevet i én setning',
					text: '«Når en forespørsel kommer inn, varsle Léa hvis budsjettet overstiger 5 000 €» : Copiloten bygger flyten, du leser den gjennom.',
				},
			},
			link: {
				href: '/fonctionnalites/automatisations/',
				label: 'Automatiseringene',
			},
		},
		glance: {
			eyebrow: 'Instrumentbord',
			title: 'Se alt.',
			titleAccent: 'Med et blikk.',
			text: 'Tall, kurver, mål: instrumentbordene dine bygges med musen fra tabellene dine, og holder seg oppdatert helt selv. Ett filter, og hele instrumentbordet følger med.',
			demo: {
				title: 'Salgsstyring',
				filters: ['Dette året', 'Alle byer'],
				revenue: 'Omsetning',
				signed: 'Signerte tilbud',
				rate: 'Signeringsandel',
				goal: 'Årsmål',
				byMonth: 'Omsetning per måned',
				byStage: 'Tilbud per trinn',
				stages: ['Sendte', 'Under forhandling', 'Signerte'],
				bySector: 'Kunder per sektor',
				sectors: ['Handel', 'Helse', 'Utdanning', 'Industri'],
				shared: 'Delt med lenke',
			},
			points: {
				viz: {
					title: 'Femten visualiseringer',
					text: 'Tall, trender, mål, kurver, sektorer, trakter, krysstabeller, kart.',
				},
				filters: {
					title: 'Felles filtre',
					text: 'Perioden, en kunde, en by: ett filter styrer ett kort, flere, eller hele instrumentbordet.',
				},
				share: {
					title: 'Delt med en lenke',
					text: 'Offentlig eller forbeholdt teamet, og kan bygges inn på et annet nettsted.',
				},
			},
			link: {
				href: '/fonctionnalites/tableaux-de-bord/',
				label: 'Instrumentbordene',
			},
		},
		ai: {
			eyebrow: 'Kunstig intelligens',
			title: 'Beskriv.',
			titleAccent: 'basedb bygger.',
			text: 'Én setning er nok for å få en komplett database, som du leser gjennom før du oppretter den. Deretter foreslår Copilot filtre, grafer og automatiseringer, og KI-feltene oppsummerer, klassifiserer og skriver for deg.',
			prompt: 'En oppfølging av søknadene til våre tre ledige stillinger, med intervjuene.',
			thinking: 'Tre koblede tabeller, klare til gjennomlesing.',
			tables: {
				jobs: {
					name: 'Stillinger',
					fields: ['Tittel', 'Avdeling', 'Åpnet'],
				},
				people: {
					name: 'Kandidater',
					fields: ['Navn', 'Stilling', 'Trinn', 'Sammendrag'],
				},
				talks: {
					name: 'Intervjuer',
					fields: ['Kandidat', 'Dato', 'Med', 'Vurdering'],
				},
			},
			aiField: 'Sammendrag',
			aiValue: 'Seks års erfaring med prosjektledelse, trygg i kundemøter; bør sjekkes nærmere: engelsk.',
			create: 'Opprett databasen',
			providers: 'Med leverandøren du selv velger – OpenAI, Anthropic, Mistral, eller en modell installert hos deg selv. Ingenting sendes uten din godkjenning.',
			link: {
				href: '/fonctionnalites/ia/',
				label: 'KI i basedb',
			},
		},
		features: {
			title: 'Alt du trenger.',
			titleAccent: 'Og mye mer.',
			text: 'Hver funksjon skriver i de samme tabellene, under de samme tillatelsene, i den samme historikken.',
			tiles: {
				views: {
					stat: '10',
					title: 'måter å se dataene dine',
					text: 'Rutenett, kanban, kalender, tidslinje, galleri, liste, kart, skjema, spørreundersøkelse og quiz, på de samme radene. Hver enkelt velger sin.',
					href: '/fonctionnalites/vues/',
				},
				history: {
					stat: 'Ctrl+Z',
					title: 'Ingenting går tapt',
					text: 'Hver endring lagres med verdien fra før; en feil kan angres, en slettet rad gjenopprettes.',
					href: '/fonctionnalites/historique/',
				},
				forms: {
					title: 'Skjemaer',
					text: 'En offentlig lenke eller forbeholdt teamet: hvert svar kommer rett i tabellen, uten å åpne resten.',
					href: '/fonctionnalites/formulaires-partages/',
				},
				viz: {
					stat: '15',
					title: 'visualiseringer',
					text: 'Tall, trender, mål, kurver, sektorer, trakter, krysstabeller og kart.',
					href: '/fonctionnalites/tableaux-de-bord/',
				},
				formulas: {
					code: 'IF([Montant] > 10000, "Grand compte", "")',
					title: 'Formler på fransk eller engelsk',
					text: 'Som i et regneark – SI, ARRONDI, JOURS … eller IF, ROUND, DAYS – men beregnet for hele teamet.',
					href: '/fonctionnalites/tables-et-champs/#formler',
				},
				rights: {
					title: 'Alle ser det de skal se',
					text: 'Lese, redigere, administrere, team for team; en sensitiv kolonne kan skjules.',
					href: '/fonctionnalites/droits/',
				},
				mentions: {
					bubble: '@Camille',
					title: 'Kommentarer og omtaler',
					text: 'Du diskuterer en rad der den er, og bjellen varsler.',
					href: '/fonctionnalites/collaboration/',
				},
				relations: {
					title: 'Alt er koblet sammen',
					text: 'Kunder, prosjekter, fakturaer: summene og oppslagene går gjennom relasjonene.',
					href: '/fonctionnalites/tables-et-champs/',
				},
				templates: {
					stat: '10',
					title: 'ferdige maler',
					text: 'CRM, rekruttering, lager, arrangementer … eller en database beskrevet i én setning til KI.',
					href: '/modeles/',
				},
				import: {
					title: 'Import med ett grep',
					text: 'Dra inn en Excel-arbeidsbok eller en CSV-fil: kolonner og typer gjettes, og tabellen opprettes.',
					href: '/guides/premiers-pas/',
				},
				agenda: {
					title: 'Helt inn i kalenderen din',
					text: 'En kalender blir en feed for Google Kalender, Outlook eller Apple Kalender.',
					href: '/fonctionnalites/vues-partagees/',
				},
				files: {
					title: 'Filer og bilder',
					text: 'Tilbud, bilder, kontrakter; et bilde blir forsiden på et kort.',
					href: '/fonctionnalites/fichiers/',
				},
				share: {
					title: 'Delte visninger',
					text: 'En skrivebeskyttet visning via en lenke, som kan bygges inn på nettstedet ditt.',
					href: '/fonctionnalites/vues-partagees/',
				},
				sync: {
					title: 'Synkroniserte tabeller',
					text: 'Holdt oppdatert fra en CSV på nett, en kalender eller en annen basedb.',
					href: '/integrations/synchronisation/',
				},
				signin: {
					title: 'Enkel innlogging',
					text: 'Google, Microsoft eller passord; du inviterer kollegene dine med en lenke.',
					href: '/hebergement/connexion/',
				},
				languages: {
					title: 'På ditt eget språk',
					text: 'Grensesnittet følger språket til hver enkelt, blant tjue.',
					href: '/fonctionnalites/droits/#innstillingene-dine',
				},
			},
		},
		yours: {
			eyebrow: 'Fri og selvhostet',
			per: 'per person. For alltid.',
			text: 'basedb er fri programvare. Installer det på din egen server og inviter hele teamet: ingen abonnement, ingen lisenser å telle, og dataene dine blir hos deg.',
			points: {
				home: {
					title: 'Hos deg',
					text: 'På din egen server eller hos driftsleverandøren din, sikkerhetskopiert som enhver PostgreSQL-database.',
				},
				free: {
					title: 'Fri',
					text: 'Under lisensen AGPL-3.0: koden er åpen, og den forblir det.',
				},
				ai: {
					title: 'KI-en du selv velger',
					text: 'En leverandør fra markedet, en modell installert hos deg selv – eller ingen KI i det hele tatt.',
				},
			},
			link: {
				href: '/guides/installation/',
				label: 'Installer basedb',
			},
		},
		gallery: {
			eyebrow: 'Maler',
			title: 'Klar på ett minutt.',
			text: 'Start fra en mal, med tabeller, visninger, instrumentbord og eksempelrader, og gjør den til din egen.',
			use: 'Utforsk',
			ask: {
				title: 'Passer ingenting?',
				text: 'Beskriv behovet ditt i én setning: KI foreslår en skreddersydd database.',
			},
			all: 'Se alle malene',
			previous: 'Forrige maler',
			next: 'Neste maler',
		},
		developers: {
			title: 'Og på den tekniske siden?',
			text: 'Hver tabell er en ekte PostgreSQL-tabell. REST-API, webhooks, MCP-server for KI-agentene, og en installasjon med én kommando.',
			link: 'Utviklersiden',
		},
		faq: {
			title: 'Spørsmålene dine',
			items: [
				{
					q: 'Må man kunne kode?',
					a: 'Nei. Du oppretter tabellene, visningene, skjemaene, instrumentbordene og automatiseringene dine med musen. Formlene skrives som i et regneark, på fransk eller engelsk: SI eller IF, ARRONDI eller ROUND, JOURS eller DAYS …',
				},
				{
					q: 'Hva koster det?',
					a: 'Ingenting: basedb er fri programvare, uten abonnement eller pris per person. Du trenger bare en server å installere det på.',
				},
				{
					q: 'Hvordan installerer man det?',
					a: 'På en server, med Docker: to filer og én kommando, noen minutter for den som tar seg av IT hos deg. Installasjonsguiden forklarer alt, steg for steg.',
				},
				{
					q: 'Kan vi ta med oss regnearkene våre?',
					a: 'Ja: dra inn Excel-arbeidsboken din, eller en CSV, i basedb. Importen gjetter typen for hver kolonne, oppretter tabellen, og sier rad for rad hva den ikke fikk med seg.',
				},
				{
					q: 'Kan flere jobbe sammen samtidig?',
					a: 'Det er akkurat det det er laget for. De andres endringer vises i sanntid, du kommenterer en rad, omtaler en kollega med @, og en bjelle varsler.',
				},
				{
					q: 'Og KI-en, leser den dataene våre?',
					a: 'Bare hvis du bestemmer det. Uten en konfigurert KI-leverandør sendes ingenting. Deretter sender et felt eller en automatisering som bruker KI, bare det instruksjonen viser til, etter din godkjenning.',
				},
				{
					q: 'På hvilket språk?',
					a: 'På ditt eget: grensesnittet følger nettleserens språk, blant tjue, og hver enkelt kan endre det i innstillingene sine.',
				},
			],
		},
		cta: {
			title: 'Teamet ditt fortjener bedre',
			titleAccent: 'enn en delt fil.',
			text: 'Start fra en mal, inviter kollegene dine, og legg «ENDELIG (2)»-filene bak deg.',
			primary: 'Utforsk malene',
			secondary: 'Installer basedb',
		},
	},
	hero: {
		badge: 'Nytt: automatiseringer som flyt, instrumentbord og SQL-visninger',
		title: ['Samarbeidsdatabasen', 'der hver tabell', 'er en ekte'],
		titleAccent: 'PostgreSQL-tabell.',
		lead: 'Like enkelt som et delt regneark – rutenett, visninger, skjemaer, tillatelser – og data som bor i tabeller som er <strong>typet og navngitt i klartekst</strong>. Teamet ditt jobber i grensesnittet; skriptene dine, BI-verktøyene dine, KI-agentene dine og <code>psql</code> leser de samme radene.',
		install: 'Installer med Docker',
		features: 'Se funksjonene',
		copy: 'Kopier kommandoen',
		facts: ['Selvhostet', 'AGPL-3.0', 'REST-API og MCP-server'],
		demo: {
			url: 'basedb.ditt-domene.no',
			project: 'Hovedprosjekt',
			projectMeta: 'Prosjekt · 2 databaser',
			filter: 'Filtrer databaser og tabeller',
			sales: 'Salg',
			support: 'Kundestøtte',
			environment: 'Produksjon',
			clients: 'Kunder',
			opportunities: 'Salgsmuligheter',
			quotes: 'Tilbud',
			baseSection: 'Database · Salg',
			screens: ['Instrumentbord', 'Automatiseringer'],
			copilot: '✦ Copilot',
			allRows: '▦ Alle rader ▾',
			tools: ['Filtrer', 'Grupper', 'Farger'],
			search: 'Søk…',
			add: '+ Legg til',
			columns: {
				name: 'Navn',
				status: 'Status',
				amount: 'Beløp',
				client: 'Kunde',
			},
			statuses: {
				nouveau: 'Ny',
				qualifie: 'Kvalifisert',
				proposition: 'Forslag',
				negociation: 'Forhandling',
				gagne: 'Vunnet',
				perdu: 'Tapt',
			},
			deals: {
				portail: {
					name: 'Ny portal',
					client: 'Fjordvik kommune',
				},
				erp: {
					name: 'ERP-migrering',
					client: 'Dahl-gruppen',
				},
				audit: {
					name: 'Sikkerhetsrevisjon',
					client: 'Solberg klinikk',
				},
				billetterie: {
					name: 'Billettsalg på nett',
					client: 'Rundtorget teater',
				},
				flotte: {
					name: 'Flåtesporing',
					client: 'Kjerland Transport',
				},
				mobile: {
					name: 'Mobilapp',
					client: 'Moe Atelier',
				},
				intranet: {
					name: 'Nytt intranett',
					client: '',
				},
			},
			toastTitle: 'Skjemaet «Tilbudsforespørsel»',
			toastText: 'offentlig svar · opprettet «{name}»',
			cursor: 'Camille',
			psqlRows: '(2 rader)',
		},
	},
	showcase: {
		label: 'Grensesnittet, på ekte',
		title: 'Alt teamet ditt forventer av et delt regneark.',
		tabs: 'Skjermbilder av grensesnittet',
		alt: 'basedb – {labelLower}: {caption}',
		shots: {
			grille: {
				label: 'Rutenett',
				caption: 'Et rutenett som skriver i en ekte tabell – og beregnede felt: en varighet fra en formel, kundens by fra et oppslag, antall oppgaver fra en telling.',
			},
			kanban: {
				label: 'Kanban',
				caption: 'De samme radene i kolonner, etter et enkeltvalgfelt: et forsidebilde, en beskrivelse som refererer til raden. Å dra et kort er å endre raden.',
			},
			galerie: {
				label: 'Galleri',
				caption: 'Kort med bildet sitt, en farge per status: galleriet, én av de åtte måtene å lese en tabell på.',
			},
			chronologie: {
				label: 'Tidslinje',
				caption: 'Stolper mellom to datoer, og piler for avhengighetene – røde når rekkefølgen ikke lenger holder.',
			},
			tableaux: {
				label: 'Instrumentbord',
				caption: 'Kort i rutenett, i faner, under felles filtre: en trend, et mål, stablede serier – lest med hver enkelts tillatelser.',
			},
			automatisations: {
				label: 'Automatiseringer',
				caption: 'Når en oppgave er ferdig, finn det som gjenstår av prosjektet; hvis ingenting gjenstår, skriver KI avslutningsordet, og prosjektet går over til «Levert». Hver kjøring kan leses på flyten, trinn for trinn.',
			},
			commentaires: {
				label: 'Kommentarer',
				caption: 'Diskuter en rad der den er: kommentarer, omtaler, varsler.',
			},
			formulaire: {
				label: 'Skjema',
				caption: 'Et skjema deles med en lenke, offentlig eller bare for innloggede medlemmer.',
			},
			historique: {
				label: 'Historikk',
				caption: 'Hver skriving, uansett hvor den kommer fra – en person, en automatisering, direkte SQL – med verdiene fra før.',
			},
			sql: {
				label: 'SQL',
				caption: 'En spørring på de ekte navnene, lagret under tabellene for hele teamet – som hver enkelt kjører med sine egne tillatelser.',
			},
			vuesSql: {
				label: 'SQL-visninger',
				caption: 'Ekte PostgreSQL-visninger, plassert blant tabellene med farge og ikon – og lesbare fra psql.',
			},
		},
	},
	features: {
		postgres: {
			label: 'PostgreSQL, uten mellomlag',
			title: 'Et rutenett for teamet, en ekte tabell {for verktøyene dine.}',
			lead: 'Ingen generisk modell, ingen JSON der alt havner, ingen <code>field_1837</code>: en database er et PostgreSQL-skjema, en tabell er en tabell, et felt er en typet kolonne med et lesbart navn.',
			bullets: [
				'<strong>Innebygde typer</strong>: <code>text</code>, <code>numeric</code>, <code>date</code>, <code>timestamptz</code>, <code>boolean</code> – og ekte fremmednøkler for relasjonene.',
				'<strong>Begrensninger som databasen håndhever</strong>: enkeltvalg som <code>CHECK</code>, nettadresser og e-postadresser som kontrolleres, relasjoner som <code>FOREIGN KEY</code>.',
				'<strong>Formler som beregnes av PostgreSQL</strong>: <code>JOURS([Fin]; [Début])</code> blir en generert kolonne, som <code>psql</code> leser som alle andre.',
				'<strong>Direkte SQL er fortsatt tillatt</strong> – og selv den havner i historikken, via en trigger.',
				'<strong>SQL-spørringer og -visninger</strong> i grensesnittet: spørringer lagret under tabellene, for deg selv eller for teamet, og ekte PostgreSQL-visninger plassert blant dem, som <code>psql</code> også leser.',
				'<strong>Å gi nytt navn ødelegger ingenting</strong>: det gamle navnet fungerer fortsatt gjennom et kompatibilitetsalias mens du oppdaterer spørringene dine.',
			],
			links: [
				{
					href: '/integrations/sql/',
					label: 'Jobbe i SQL',
				},
				{
					href: '/fonctionnalites/requetes-et-vues-sql/',
					label: 'Spørringer og SQL-visninger',
				},
				{
					href: '/architecture/principes/',
					label: 'Prinsippene',
				},
			],
		},
		automations: {
			label: 'Automatiser',
			title: 'Automatiseringer som flyt, {KI i hvert trinn.}',
			lead: 'Når en rad endres, på et fast tidspunkt eller med ett klikk: en grafeditor setter trinnene etter hverandre, og hver kjøring kan leses på nytt på flyten.',
			bullets: [
				'<strong>En lesbar flyt</strong>: utløseren, deretter hvert trinn som et kort; en <strong>+</strong> på en linje legger til et trinn akkurat der.',
				'<strong>Finn, bestem, skriv</strong>: finn en rad, ta én gren eller en annen ut fra betingelser, endre, opprett, varsle, kall en webhook, skriv i Slack.',
				'<strong>Spør KI</strong> i et trinn: en instruksjon som refererer til raden, et svar lest som tekst, tall, dato eller valg, som de neste trinnene bruker videre.',
				'<strong>Copilot</strong> foreslår en hel automatisering ut fra én setning, eller forklarer hvorfor en kjøring mislyktes – ingenting lagres uten deg.',
				'<strong>Med tillatelsene til den som skrev den</strong>, og i historikken som all annen skriving.',
			],
			links: [
				{
					href: '/fonctionnalites/automatisations/',
					label: 'Automatiseringer',
				},
				{
					href: '/fonctionnalites/automatisations/#copilot',
					label: 'Copilot',
				},
			],
			alt: 'basedb – automatiseringen «Prosjekt levert» i flyteditoren: når en oppgave er ferdig, noter klokkeslettet, finn det som gjenstår av prosjektet, ta grenen «Ellers», spør KI om et avslutningsord, og lever deretter prosjektet; til høyre de siste kjøringene, trinn for trinn.',
		},
		dashboards: {
			label: 'Analyser',
			title: 'Instrumentbord {uten å forlate tabellene.}',
			lead: 'Spørsmål stilt med musen eller i SQL, femten visualiseringer, felles filtre – hver enkelt leser dem med sine egne tillatelser.',
			bullets: [
				'<strong>Spørsmål</strong>: en tabell, sammenslåingene dens, filtre og mål per dag, uke, måned eller år – eller skrivebeskyttet SQL.',
				'<strong>Femten visualiseringer</strong>: tall, trend, mål, måler, stolper, linjer, sektor, trakt, krysstabell, kart …',
				'<strong>Utforsk med ett klikk</strong>: et punkt åpner radene sine, eller en finere periode.',
				'<strong>Felles filtre</strong> som styrer ett, flere eller alle kortene.',
				'<strong>Del med en lenke</strong>, offentlig eller bare for medlemmer, og bygg inn på et annet nettsted.',
			],
			links: [
				{
					href: '/fonctionnalites/tableaux-de-bord/',
					label: 'Instrumentbord',
				},
			],
			alt: 'basedb – et instrumentbord: månedens trend, innbetalingsmål, omsetning per måned, stemning i omtalene, under filtre for periode og kunde.',
		},
		rights: {
			label: 'Samarbeid uten å åpne alt',
			title: 'Tillatelser helt ned til feltet, {en historikk uten hull.}',
			lead: 'Tillatelser gis til grupper, på et prosjekt, en database eller en tabell, og gjelder alt som ligger under. En sensitiv kolonne kan skjules for en gruppe, eller gjøres skrivebeskyttet for den.',
			bullets: [
				'<strong>Fire nivåer</strong>: Ingen tilgang, Lese, Redigere, Administrere – som legges sammen fra én gruppe til en annen.',
				'<strong>Selv SQL følger tillatelsene dine</strong>: i grensesnittet ser en spørring bare tabellene og feltene som er åpne for deg – og det er PostgreSQL som håndhever det.',
				'<strong>Hver skriving fanges opp</strong> i sin egen transaksjon: grensesnitt, API, agent, offentlig skjema eller direkte SQL.',
				'<strong>En endring kan angres</strong>, en slettet rad gjenopprettes, og en slettet database også.',
				'<strong>Administrasjon må bekreftes</strong>: å endre en tillatelse krever at du har skrevet inn passordet på nytt i løpet av de siste fem minuttene.',
			],
			links: [
				{
					href: '/fonctionnalites/droits/',
					label: 'Tillatelser og grupper',
				},
				{
					href: '/fonctionnalites/historique/',
					label: 'Historikken',
				},
			],
		},
		agents: {
			label: 'REST-API · MCP · webhooks',
			title: 'KI-agentene dine får dataene, {ikke hele nøkkelknippet.}',
			lead: 'MCP-serveren gir agentene tolv verktøy; REST-API-et gir programmene dine de samme dataene. Ett enkelt kontrollpunkt for tillatelser, de samme loggene.',
			bullets: [
				'<strong>Ett token per database</strong>, skrivebeskyttet som standard, aldri med flere tillatelser enn personen som opprettet det.',
				'<strong>En agent sletter ingenting</strong> og endrer ikke strukturen: den foreslår, et menneske godkjenner.',
				'<strong>Generert dokumentasjon</strong> for hver database, filtrert etter tillatelsene dine, med OpenAPI 3.1-spesifikasjon.',
				'<strong>Webhooks</strong> ved hver skriving – signert, i rekkefølge og med nye forsøk.',
			],
			links: [
				{
					href: '/integrations/mcp/',
					label: 'Koble til en agent',
				},
				{
					href: '/integrations/api-rest/',
					label: 'REST-API-et',
				},
			],
		},
	},
	sqlVisual: {
		interface: 'Grensesnitt',
		title: 'Nytt felt · Salgsmuligheter',
		labelField: 'Etikett',
		labelValue: 'Beløp',
		typeField: 'Type',
		typeValue: 'Tall',
		descriptionField: 'Beskrivelse',
		descriptionValue: 'Kontraktsbeløp eks. mva.',
		required: 'Obligatorisk',
		ai: 'KI',
		migration: 'en planlagt migrering, korte låser',
	},
	rightsVisual: {
		groups: ['Administratorer', 'Selgere', 'Kundestøtte'],
		project: 'Hovedprosjekt',
		sales: 'Salg',
		opportunities: 'Salgsmuligheter',
		clients: 'Kunder',
		support: 'Kundestøtte',
		inherited: 'arvet',
		levels: {
			none: 'Ingen tilgang',
			read: 'Lese',
			edit: 'Redigere',
			manage: 'Administrere',
		},
		field: 'Feltet «Margin»',
		hidden: 'Skjult',
		sqlChange: '<b>Direkte SQL-økt</b> endret <b>«ERP-migrering»</b>',
		sqlMeta: '02:46 · lokal tilkobling · psql',
		sqlDiff: 'Beløp: <s>125 000</s> → 130 000',
		undo: '↶ Angre',
		formChange: '<b>Skjemaet «Tilbudsforespørsel»</b> opprettet <b>«Nytt intranett»</b>',
		formMeta: 'offentlig svar · publisert av Camille',
	},
	agentVisual: {
		agent: 'Agent',
		via: 'tilkoblet via MCP · token «Salg»',
		question: 'Hvor mange salgsmuligheter er i forhandling, og for hvilket beløp?',
		listArgs: 'opportunites · statut = Forhandling',
		answer: 'To salgsmuligheter, <b>182 000 €</b> totalt: ERP-migrering (130 000 €) og Flåtesporing (52 000 €).',
		request: 'Legg til et felt «Sannsynlighet» i prosent.',
		proposeArgs: 'opportunites · Sannsynlighet · number',
		proposed: 'Det er foreslått: en person i teamet må godkjenne det i basedb.',
		badge: 'Forslag',
		expires: 'utløper om 23 t',
		what: 'Legg til feltet <b>«Sannsynlighet»</b> (Tall) i <b>Salgsmuligheter</b>',
		by: 'Foreslått av agenten · token «Salg»',
		refuse: 'Avvis',
		approve: 'Godkjenn',
	},
	bento: {
		label: 'Og alt det andre',
		title: 'Det du venter av et teamverktøy, uten å slippe PostgreSQL.',
		text: 'Hver funksjon skriver i de samme tabellene, under de samme tillatelsene, i den samme historikken.',
		more: 'Les mer →',
		views: {
			title: 'Ti visninger av de samme radene',
			text: 'Felles for hele teamet, eller personlige for deg alene: hver enkelt velger sin måte å lese på, ingen kopierer dataene.',
			chips: [
				'Rutenett',
				'Kanban',
				'Kalender',
				'Tidslinje',
				'Galleri',
				'Liste',
				'Kart',
				'Skjema',
				'Spørreundersøkelse',
				'Quiz',
			],
		},
		forms: {
			title: 'Delte skjemaer',
			text: 'En offentlig lenke, eller en som er forbeholdt innloggede medlemmer. Å svare gir ingen tillatelser til tabellen.',
			href: '/fonctionnalites/formulaires-partages/',
		},
		environments: {
			title: 'Miljøer',
			text: 'Én database, flere varianter. Sammenlign strukturen, migrer fra én til en annen, synkroniser rader.',
			chips: ['Produksjon', 'Test', 'Utvikling'],
			href: '/fonctionnalites/environnements/',
		},
		collaboration: {
			title: 'Jobbe sammen',
			text: 'Andres skriving kommer i sanntid, du ser hvem som ser på hvilken rad, og dere diskuterer den der den er: kommentarer, omtaler, varsler. Ctrl+Z angrer den siste skrivingen, og nekter heller enn å overskrive andres arbeid.',
			chips: ['Sanntid', 'Tilstedeværelse', 'Kommentarer', 'Omtaler', 'Ctrl+Z'],
			href: '/fonctionnalites/collaboration/',
		},
		small: {
			ai: {
				title: 'KI i rutenettet',
				text: 'Et felt som fylles ut av en modell ut fra de andre kolonnene, og en Copilot som foreslår filtre, spørringer og kolonner, tatt i bruk med ett klikk. OpenAI, Anthropic, Mistral, eller en modell som kjøres på din egen maskin.',
				code: 'Oppsummer {{Notes}} i én setning',
				href: '/fonctionnalites/ia/',
			},
			formulas: {
				title: 'Relasjoner og formler',
				text: 'Ekte fremmednøkler, formler på fransk eller engelsk beregnet av PostgreSQL, og oppslag, aggregeringer og antall på tvers av relasjonene.',
				code: 'ROUND([Montant HT] * (1 + [Taux de TVA]), 2)',
				href: '/fonctionnalites/tables-et-champs/#formler',
			},
			richText: {
				title: 'Formatert tekst og variabler',
				text: 'En visuell editor for formatert tekst, renset ved skriving; og i all lang tekst leses {{Ville}} med verdien fra raden.',
				code: 'Levering {{Date}} i {{Ville}}',
				href: '/fonctionnalites/tables-et-champs/#formatert-tekst-og-variabler',
			},
			languages: {
				title: 'På ditt språk',
				text: 'Grensesnittet bruker nettleserens språk, ett av tjue; hver enkelt kan endre det i innstillingene sine.',
				href: '/fonctionnalites/droits/#innstillingene-dine',
			},
			sharedViews: {
				title: 'Delte visninger',
				text: 'En skrivebeskyttet visning via en lenke, som kan bygges inn på et annet nettsted; en kalender blir en feed for kalenderappen din.',
				href: '/fonctionnalites/vues-partagees/',
			},
			syncedTables: {
				title: 'Synkroniserte tabeller',
				text: 'En tabell som holdes oppdatert fra en CSV på nett, en kalender eller den delte visningen til en annen basedb.',
				href: '/integrations/synchronisation/',
			},
			templates: {
				title: 'Databasemaler',
				text: 'Ti ferdige maler, en database beskrevet for KI i én setning, og din egen lagret som mal.',
				href: '/modeles/',
			},
			files: {
				title: 'Filer og bilder',
				text: 'På vertens disk eller i S3-kompatibel lagring: AWS, Scaleway, OVH, Cloudflare R2, Garage, MinIO …',
				href: '/fonctionnalites/fichiers/',
			},
			import: {
				title: 'Import av Excel, CSV og JSON',
				text: 'Slipp en fil: importen gjetter typene, oppretter tabellen eller fyller ut en eksisterende, og sier rad for rad hva som ble avvist.',
				href: '/guides/premiers-pas/',
			},
			accounts: {
				title: 'Kontoer og invitasjoner',
				text: 'Hver enkelt oppretter sin egen konto og sine prosjekter, og inviterer via en lenke med Lese, Redigere eller Administrere; innlogging med passord, Google, Microsoft eller en hvilken som helst OpenID Connect-leverandør.',
				href: '/hebergement/connexion/',
			},
			webhooks: {
				title: 'Webhooks',
				text: 'Hver skriving kan varsle et annet system: signerte nyttelaster, levert i rekkefølge, med nye forsøk.',
				href: '/integrations/webhooks/',
			},
			settings: {
				title: 'Personlige innstillinger',
				text: 'Språket ditt, temaet ditt, datorekkefølgen, varslene, øktene og tokenene dine, samlet på ett sted.',
				href: '/fonctionnalites/droits/#innstillingene-dine',
			},
		},
	},
	selfHost: {
		label: 'Selvhostet',
		title: 'Dataene dine blir {hos deg.}',
		lead: 'basedb er fri programvare (AGPL-3.0): ett enkelt image, én PostgreSQL-database, og det er alt – ingen påtvunget tredjepartstjeneste, ingen telemetri. Ta sikkerhetskopi med <code>pg_dump</code>, les med hvilken som helst PostgreSQL-klient.',
		services: {
			db: 'PostgreSQL 16, dataene dine',
			basedb: 'Grensesnittet, REST-API-et og MCP-serveren, på én port',
			proxy: 'Caddy, automatisk HTTPS (valgfritt)',
		},
		links: [
			{
				href: '/hebergement/docker/',
				label: 'Veiledning for Docker Compose →',
			},
			{
				href: '/hebergement/variables/',
				label: 'Alle variablene →',
			},
		],
		steps: [
			{
				title: 'Hent basedb',
				code: 'git clone https://github.com/eodia/basedb.git\ncd basedb && cp .env.example .env',
			},
			{
				title: 'To hemmeligheter i .env',
				code: 'POSTGRES_PASSWORD=et-sterkt-passord\n# openssl rand -base64 32\nBASEDB_ENCRYPTION_KEY=…',
			},
			{
				title: 'Start',
				code: 'docker compose up -d\n# deretter http://localhost:3000: opprett kontoen din',
			},
		],
	},
	faq: {
		label: 'Vanlige spørsmål',
		title: 'Det vi ofte blir spurt om.',
		text: 'Et annet spørsmål? <a href="/guides/introduction/">Dokumentasjonen</a> svarer sikkert på det.',
		items: {
			difference: {
				q: 'Hva skiller basedb fra andre samarbeidsdatabaser?',
				a: 'Hvor dataene bor. Der andre lagrer radene dine i en generisk modell (nummererte kolonner, JSON-dokumenter), oppretter basedb en ekte PostgreSQL-tabell per tabell og en ekte typet kolonne per felt, med lesbare navn. Dataene dine forblir brukbare uten basedb.',
			},
			sql: {
				q: 'Kan jeg skrive direkte i tabellene med SQL?',
				a: 'Ja. Begrensningene (typer, obligatorisk, enkeltvalg, fremmednøkler) håndheves av PostgreSQL selv, og en trigger fører til og med skriving gjort med direkte SQL inn i historikken, sammen med økten som gjorde den. SQL-konsollen i grensesnittet og psql leser de samme tabellene; i grensesnittet skriver hver enkelt SQL med sine egne tillatelser, lagrer spørringene sine og, hvis vedkommende administrerer databasen, gjør dem til ekte PostgreSQL-visninger.',
			},
			ai: {
				q: 'Hva sendes til en KI-leverandør?',
				a: 'Ingenting så lenge du ikke har satt opp en leverandør. Deretter sendes som standard bare strukturen og setningen din for strukturutkast og Copilot; at Copilot kan lese data, er en avkrysningsboks, per samtale. En databasemal du ber KI om, sender bare setningen din. Et KI-felt sender kolonnene instruksjonen refererer til, etter uttrykkelig samtykke.',
			},
			together: {
				q: 'Kan flere jobbe i samme tabell?',
				a: 'Ja. Andres skriving vises uten å laste inn siden på nytt, med ansiktet deres på tabellen eller raden de ser på. Du kommenterer en rad, nevner noen med @, og bjellen varsler. Og Ctrl+Z angrer bare din egen skriving: den nekter heller enn å overskrive det en annen har endret siden.',
			},
			languages: {
				q: 'På hvilke språk?',
				a: 'Tjue: fransk, engelsk, tysk, spansk, italiensk, brasiliansk portugisisk, nederlandsk, polsk, tsjekkisk, svensk, dansk, norsk, finsk, rumensk, ungarsk, tyrkisk, ukrainsk, japansk, forenklet kinesisk og koreansk. Grensesnittet bruker nettleserens språk, og hver enkelt kan endre det i innstillingene; dette nettstedet og dokumentasjonen finnes på de samme språkene.',
			},
			agent: {
				q: 'Hvordan kobler en KI-agent seg til?',
				a: 'Via MCP-serveren, med et integrasjonstoken som er begrenset til én database, skrivebeskyttet som standard. En agent leser, oppretter og endrer rader i tråd med tillatelsene sine; den sletter ingenting og endrer ikke strukturen: den foreslår, og et menneske godkjenner.',
			},
			postgres: {
				q: 'Hvilken versjon av PostgreSQL trengs?',
				a: 'PostgreSQL 16 eller nyere, med utvidelsene pg_trgm og unaccent (tilgjengelige i det offisielle imaget). Den medfølgende docker-compose starter en PostgreSQL 16; du kan også peke DATABASE_URL mot din egen server.',
			},
			production: {
				q: 'Er det klart for produksjon?',
				a: 'basedb er under aktiv utvikling: kjernen, API-et, MCP-serveren og grensesnittet fungerer og dekkes av over tusen tester, men noen funksjoner gjenstår (se veikartet). Prøv det, og ta sikkerhetskopi av databasen din som av enhver PostgreSQL-database.',
			},
			license: {
				q: 'Under hvilken lisens?',
				a: 'AGPL-3.0-or-later. Du kan bruke, endre og hoste det fritt; tilbyr du en endret versjon som en tjeneste, deler du kildekoden.',
			},
		},
	},
	cta: {
		title: 'Dataene dine fortjener {ekte tabeller.}',
		text: 'Installer basedb på noen minutter, inviter teamet ditt, og behold kontrollen over hver rad.',
		install: 'Installer basedb',
		github: 'Se koden på GitHub',
	},
	changelog: {
		label: 'Nyheter',
		title: 'Hva som er endret i basedb',
		intro: 'Detaljene i hver endring står i <a href="https://github.com/eodia/basedb/commits/main">historikken til depotet</a>. Hva som kommer videre: <a href="/feuille-de-route/">veikartet</a>.',
		entries: {
			maps: {
				date: '2026-09-30',
				title: 'Kartet, og adresser som finner sin plass',
				tag: 'Nytt',
				items: [
					'<strong>En tiende visning, kartet</strong>: hver rad plasseres på sitt sted, ut fra adressen eller ut fra breddegrad og lengdegrad. En nål tar fargen til en status og åpner raddetaljene med ett klikk. <a href="/fonctionnalites/vues/#kart">Kartet</a>',
					'<strong>En adresse plasseres én gang for alle</strong>, av OpenStreetMaps tjeneste eller den du velger: nålene dukker opp etter hvert som svarene kommer inn, og deretter umiddelbart. En adresse som ikke finnes, telles, aldri stille utelatt.',
					'<strong>Formatet Adresse</strong> for en kort tekst: ett klikk åpner den på kartet, og i raddetaljene foreslår <strong>Finn adresse</strong> de fullstendige adressene som samsvarer. <a href="/fonctionnalites/tables-et-champs/#visningsformater">Formatene</a>',
				],
			},
			documents: {
				date: '2026-09-30',
				title: 'PDF-er fra radene dine',
				tag: 'Nytt',
				items: [
					'<strong>Et tilbud, en faktura, et ark i PDF</strong>, fra menyen til en rad: det utskriftsvennlige arket uten noe å stille inn, eller en mal — tekster som siterer feltene, radens felter, tabellen med koblede rader og deres totaler, sideskift. <a href="/fonctionnalites/documents/">Dokumentene</a>',
					'<strong>Hver med sine tillatelser</strong>: et felt som er skjult for deg, vises ikke i din PDF. De tjue språkene skrives der, kinesisk, japansk og koreansk inkludert, og API-et gir samme dokument.',
				],
			},
			rows: {
				date: '2026-09-30',
				title: 'Tillatelser helt ned til raden, standardverdier, Excel-import',
				tag: 'Nytt',
				items: [
					'<strong>Hver sine rader</strong>: en gruppe ser bare radene til et filter — «Selger er meg», «Region er Nord» —, i grensesnittet, API-et, MCP-serveren som i SQL, der PostgreSQL håndhever samme regel. <a href="/fonctionnalites/droits/#helt-ned-til-raden">Helt ned til raden</a>',
					'<strong>Standardverdier</strong>: en fast verdi, dagens dato, tidspunktet for opprettelsen eller personen som oppretter raden, forhåndsutfylt på skjermen og brukt overalt ellers. <a href="/fonctionnalites/tables-et-champs/#standardverdier">Standardverdier</a>',
					'<strong>Dra inn en Excel-arbeidsbok</strong>: velg arket, datoene, beløpene og avmerkingsboksene tas over som de er, og en formel gir verdien sin. <a href="/guides/premiers-pas/">Kom i gang</a>',
				],
			},
			mail: {
				date: '2026-09-30',
				title: 'E-poster',
				tag: 'Nytt',
				items: [
					'<strong>Et trinn «Send en e-post»</strong> i automatiseringene: til et medlem, til personen i et felt, til adressen til en kunde, med radens verdier i emnet og teksten. <a href="/fonctionnalites/automatisations/">Automatiseringene</a>',
					'<strong>Varslene på e-post</strong> når du ikke har lest dem, samlet, å velge én for én i innstillingene dine; og <strong>glemt passord</strong> tilbakestilles med en lenke. <a href="/fonctionnalites/collaboration/#på-e-post">På e-post</a>',
					'Det holder å oppgi utsendingsserveren til e-posten din til instansen. <a href="/hebergement/variables/#e-poster">Variablene</a>',
				],
			},
			integrations: {
				date: '2026-09-30',
				title: 'n8n og en TypeScript-SDK',
				tag: 'Nytt',
				items: [
					'<strong>n8n-noder</strong>: lese og skrive radene i en tabell fra en arbeidsflyt, og starte én for hver rad som opprettes, endres eller slettes — ved avlesning eller signert webhook. <a href="/integrations/n8n/">n8n</a>',
					'<strong>En TypeScript-SDK</strong>, med typene til tabellene dine generert fra din instans: en tabell eller et felt som ikke finnes, er en feil allerede før kjøring. <a href="/integrations/sdk/">SDK-en</a>',
				],
			},
			quiz: {
				date: '2026-09-29',
				title: 'Quizen: spørsmål som teller poeng',
				tag: 'Nytt',
				items: [
					'<strong>En ny visning, quiz</strong>: en spørreundersøkelse der hvert spørsmål kan ha sitt riktige svar og sine poeng — ett valg, flere, ja eller nei, et tall, en dato, eller de godkjente tekstene, uten hensyn til store og små bokstaver eller aksenter. <a href="/fonctionnalites/vues/#quiz">Quiz</a>',
					'<strong>Rettet som du vil</strong>: etter hvert spørsmål — i grønt, eller i rødt med det riktige svaret, poengsummen som vokser øverst på skjermen —, til slutt, eller aldri. En beståelsesgrense får det til å si «Bestått!» eller «Ikke denne gangen…».',
					'<strong>Poengsummen til slutt</strong>, i en ring som fylles, og deretter rettingen av hvert spørsmål. Den skrives i et tallfelt i tabellen: sorter rutenettet etter det, der har du rangeringen.',
					'<strong>Delt med en lenke, uten juks</strong>: siden mottar ingen riktige svar, det er serveren som retter og teller. <a href="/fonctionnalites/formulaires-partages/#en-delt-quiz">En delt quiz</a>',
					'<strong>Opprett en visning</strong>, nederst i visningsvelgeren, ordner de ni slagene i to familier — dem som ser radene, dem som samler inn svar —, hver med sitt fargede ikon.',
				],
			},
			forms: {
				date: '2026-09-29',
				title: 'Skjemaer man har lyst til å fylle ut',
				tag: 'Nytt',
				items: [
					'<strong>Spørreundersøkelsen fyller hele skjermen</strong>: ett spørsmål om gangen, som glir inn, store kort for valgene, stjerner for en vurdering, og alt med tastaturet — <strong>Enter</strong>, bokstavene A, B, C…, J eller N, tallene. Et enkeltvalg går alene videre til neste. <a href="/fonctionnalites/vues/#skjema-og-spørreundersøkelse">Skjema og spørreundersøkelse</a>',
					'<strong>Et utseende for seg selv</strong>: åtte temaer, fra Lyst til Natt, innom Papir, en farge, en skrift, en justering — siden til en delt lenke bærer det også.',
					'<strong>Spør bare hvis…</strong>: et spørsmål stilles bare hvis et tidligere svar krever det; et skjult spørsmål er verken påkrevd eller lagret.',
					'<strong>Ingenting å stille inn for å komme i gang</strong>: et nytt skjema spør om det en person svarer, ikke statusen som teamet fyller ut senere, bærer fargen til tabellen sin og viser et eksempel i hvert felt. Og innsendingen feires, konfetti inkludert.',
				],
			},
			formulaLanguages: {
				date: '2026-09-28',
				title: 'Formler på fransk eller engelsk',
				tag: 'Nytt',
				items: [
					'<strong>Skriv en formel på fransk eller engelsk</strong>, på hvilken som helst skjerm, selv om du blander de to: <code>SI</code> eller <code>IF</code>, <code>ARRONDI</code> eller <code>ROUND</code>, <code>JOURS</code> eller <code>DAYS</code> … Argumentene skilles med <code>;</code> eller med <code>,</code>. <a href="/fonctionnalites/tables-et-champs/#formler">Formlene</a>',
					'<strong>Den leses tilbake i skjermens språk</strong>: på fransk på en fransk skjerm, på engelsk i de nitten andre språkene – eksisterende formler og «Funksjoner»-panelet inkludert. API-et gir en formel i språket man ber om, ellers på engelsk.',
					'De offisielle malene, levert på et annet språk enn fransk, kommer med formlene sine på engelsk. Ingenting endres i databasen: samme kolonner, samme SQL, uten migrering.',
				],
			},
			search: {
				date: '2026-09-27',
				title: 'Finne alt: Ctrl+K',
				tag: 'Nytt',
				items: [
					'<strong>Ett eneste felt for alt</strong> – <strong>Ctrl+K</strong>, eller feltet midt i den øverste linjen: tabeller, visninger, spørsmål, instrumentbord, automatiseringer, kolonner, og selve radene, lest med dine rettigheter; på en stor skjerm, forhåndsvisningen av det valgte resultatet. <a href="/fonctionnalites/recherche/">Søket</a>',
					'<strong>Skriv slik du tenker</strong>: ingen aksenter, ingen store bokstaver, ved forbokstaver – <code>nk</code> for «Ny kunde» –, en skrivefeil tilgis, <code>kunder bergen</code> for å søke etter «bergen» i kundetabellen; det du åpner ofte, stiger til toppen.',
					'<strong>Alle kommandoene fra tastaturet</strong>: opprette, gå til, lukke, angre, bytte tema, kopiere lenken til siden. <code>&gt;</code> søker bare i kommandoene, <code>#</code> i objektene, <code>/</code> i radene; <strong>Tab</strong> søker i en tabell eller en database.',
					'<strong>Et spørsmål?</strong> Skriv det: <strong>Spør Copilot</strong> stiller det videre, på den åpne databasen.',
				],
			},
			questions: {
				date: '2026-09-27',
				title: 'Egne spørsmål, tall i teksten',
				tag: 'Nytt',
				items: [
					'<strong>Alle lagrer sine egne spørsmål</strong>, uten nivået Administrere: personlige spørsmål ser bare du; den som administrerer databasen, deler dem med hele databasen eller med grupper, som spørringene. <a href="/fonctionnalites/tableaux-de-bord/">Instrumentbord</a>',
					'<strong>Et spørsmål i en fane</strong>, ved siden av tabellene: <strong>Nytt spørsmål</strong> og <strong>Nytt SQL-spørsmål</strong>, på <strong>+</strong> i fanelinjen og i menyen til databasen; fanen holder på det du har latt ligge der. <strong>Lagre en kopi</strong> gjør et spørsmål du ikke kan endre, til ditt eget.',
					'<strong>Tall i teksten</strong>: en tekst i et instrumentbord, nå formatert, viser til en verdi – <code>{{chiffre_affaires}}</code> – tatt fra et kort, et spørsmål eller et filter, beregnet med leserens rettigheter, også i et instrumentbord delt med en lenke. <a href="/fonctionnalites/tableaux-de-bord/#tall-i-teksten">Tall i teksten</a>',
					'Spørringer, SQL-visninger og spørsmål slettes også fra menyen sin, med høyreklikk.',
				],
			},
			addresses: {
				date: '2026-09-27',
				title: 'En adresse for hver skjerm',
				tag: 'Nytt',
				items: [
					'<strong>Adressen følger skjermen</strong>: en tabell, en visning, raddetaljene for en rad, et instrumentbord, en automatisering, et spørsmål, innstillingene dine – <code>/bases/ventes/tables/opportunites?ligne=…</code>. Legg den til favoritter, lim den inn i en melding: man kommer til samme sted, med sine egne rettigheter. <a href="/fonctionnalites/collaboration/#en-lenke-til-hver-skjerm">En lenke til hver skjerm</a>',
					'Nettleserens knapper <strong>tilbake</strong> og <strong>fremover</strong> fører deg dit du var; en adresse som ikke leder noe sted, viser «Denne siden finnes ikke».',
				],
			},
			demo: {
				date: '2026-09-27',
				title: 'En demo å prøve, på ditt språk',
				tag: 'Nytt',
				items: [
					'<strong>Demoen</strong>, på <a href="https://demo.basedb.eodia.com">demo.basedb.eodia.com</a>: kontoen er forhåndsutfylt på nettleserens språk, med en database på det språket. Der leser du alt og endrer det som finnes; oppretting, sletting og KI er slått av, og databasen går hver natt tilbake til utgangspunktet.',
					'<strong>Din egen demo</strong>: <code>BASEDB_DEMO=1</code> åpner en instans for alle, med en konto delt per språk, forberedt på forhånd. <a href="/hebergement/variables/#offentlig-demo">Variablene</a>',
					'<strong>Ett språk per lenke</strong>: <code>?lang=de</code> på slutten av en basedb-adresse viser innloggingsskjermen eller en delt side på tysk; slik fører nettstedet til demoen i sidens språk. <a href="/fonctionnalites/droits/#innstillingene-dine">Innstillingene dine</a>',
				],
			},
			templateLanguages: {
				date: '2026-09-27',
				title: 'Malene på ditt språk',
				tag: 'Nytt',
				items: [
					'<strong>De offisielle malene skapes på skjermens språk</strong>: tabeller, felt, valg, visninger, instrumentbord, automatiseringer, KI-instrukser – og eksempelrader fra en verden tilpasset hvert språk: «Boulangerie Martin» i Lyon blir «Martin’s Bakery» i Portland. <a href="/fonctionnalites/modeles/#på-ditt-språk">Malene</a>',
					'<a href="/modeles/">Nettstedets galleri</a> viser hver mal på sidens språk.',
					'<strong>Én mal, mange ordbøker</strong>: en mal skrives én gang, på fransk; hvert språk oversetter bare tekstene, og basedb følger selv opp hver etikett der den siteres. En ordbok som ville brutt malen, blir ikke tatt i bruk. <a href="/fonctionnalites/modeles/#publiser-en-mal-for-alle-instanser">Publiser en mal</a>',
				],
			},
			details: {
				date: '2026-09-27',
				title: 'Og ellers',
				items: [
					'<strong>En mal uten eksempelradene sine</strong>: «Last inn eksempeldata», ikke avkrysset, oppretter tomme tabeller, klare for dine egne data. <a href="/fonctionnalites/modeles/#start-fra-en-mal">Start fra en mal</a>',
					'<strong>API- og MCP-dokumentasjonen</strong> til hver database skrives på skjermens språk. <a href="/integrations/api-rest/#den-genererte-dokumentasjonen">Den genererte dokumentasjonen</a>',
					'Verktøytips i appens tema, overalt der nettleseren viste sine egne; «Slett» i menyene i rødt; hele datoen ved å holde musen over klokkeslettet til en kommentar.',
				],
			},
			languages: {
				date: '2026-09-27',
				title: 'Formatert tekst, variabler, en mer lesbar kanban',
				tag: 'Nytt',
				items: [
					'<strong>Formatert tekst</strong>: en ny felttype, formatert i en visuell editor – overskrifter, lister, sitater, lenker –, renset ved skriving og beskyttet av en begrensning mot direkte SQL. <a href="/fonctionnalites/tables-et-champs/#formatert-tekst-og-variabler">Formatert tekst og variabler</a>',
					'<strong>Variabler</strong>: en lang tekst refererer til en kolonne i sin egen rad – <code>{{Ville}}</code> – og leses overalt med verdien: rutenett, raddetaljer, API, MCP-server, delte visninger, automatiseringer. Kolonnen beholder referansen, som er det <code>psql</code> leser.',
					'<strong>En mer lesbar kanban</strong>: luftigere kort, et forsidebilde og en beskrivelse som refererer til radens verdier – «Levering {{Date}} til {{Client}}». <a href="/fonctionnalites/vues/">Visningene</a>',
					'<strong>Gi nytt navn i én operasjon</strong>: én enkelt dialog for en database, en tabell eller et felt; etiketten endres alltid, og en administrator kan også gi nytt navn i databasen, med konsekvensanalyse. <a href="/fonctionnalites/tables-et-champs/#endre-strukturen">Endre strukturen</a>',
					'<strong>Tjue språk</strong>: grensesnittet, dette nettstedet og dokumentasjonen på fransk, engelsk, tysk, spansk, italiensk, portugisisk (Brasil), nederlandsk, polsk, tsjekkisk, svensk, dansk, norsk, finsk, rumensk, ungarsk, tyrkisk, ukrainsk, japansk, forenklet kinesisk og koreansk. basedb bruker nettleserens språk; <strong>Innstillinger › Utseende › Språk</strong> velger et annet, som følger deg fra én maskin til en annen. Tall og datoer følger språket. <a href="/fonctionnalites/droits/#innstillingene-dine">Innstillingene dine</a>',
				],
			},
			aiProvider: {
				date: '2026-09-27',
				title: 'KI-leverandøren du vil, ned til din egen maskin',
				tag: 'Nytt',
				items: [
					'<strong>En fjerde KI-leverandør</strong>: hvilken som helst server som snakker OpenAIs API – Azure, en bedriftsgateway, en modell som kjøres på din egen maskin –, angitt i <code>.env</code>. Loggen over kallene sier hvem dataene gikk til. <a href="/fonctionnalites/ia/">KI i basedb</a>',
					'<strong>Innloggingsskjermbildet</strong> viser nå, etter rutenettet og SQL, et instrumentbord som følger et filter og en automatisering som kjører, KI-trinnet inkludert.',
				],
			},
			flows: {
				date: '2026-09-27',
				title: 'Automatiseringer som flyt',
				tag: 'Nytt',
				items: [
					'<strong>En grafeditor</strong>: utløseren, deretter hvert trinn som et kort; en <strong>+</strong> på en linje legger til et trinn akkurat der. En enkel automatisering får fortsatt plass på to kort. <a href="/fonctionnalites/automatisations/">Automatiseringer</a>',
					'<strong>Finn en rad</strong> – kunden til en ordre, den siste ubetalte fakturaen – og endre den, referer til den, koble den til en rad som er opprettet.',
					'<strong>Betingelser med flere grener</strong>: den første der betingelsen er oppfylt, blir tatt, «Ellers» når ingen er det; grenene møtes igjen etterpå.',
					'<strong>Dataene går fra ett trinn til det neste</strong>: <code>{{e2.client}}</code> refererer til det et trinn har funnet eller opprettet, <code>{{e3.reponse.numero}}</code> til det en webhook svarte; menyen i hver tekst tilbyr bare det som med sikkerhet har skjedd før.',
					'<strong>Hver kjøring, trinn for trinn</strong>: lagt oppå flyten viser den grenen som ble tatt, og sier for hvert trinn hva det gjorde og hvor lang tid det tok.',
					'<strong>Copilot for automatiseringer</strong>: beskriv hva databasen skal gjøre av seg selv, eller spør hvorfor en kjøring mislyktes; den foreslår en hel automatisering, som du legger på flyten med ett klikk, leser gjennom og deretter lagrer – ingenting lagres uten deg. <a href="/fonctionnalites/automatisations/#copilot">Copilot</a>',
					'<strong>Spør KI</strong> i et trinn, som i et KI-felt: en instruksjon som refererer til raden og de forrige trinnene, et svar lest som tekst, tall, ja eller nei, dato eller valg i en liste, som de neste trinnene skriver eller sender. <a href="/fonctionnalites/automatisations/#spør-ki">Spør KI</a>',
				],
			},
			dashboards: {
				date: '2026-09-27',
				title: 'Instrumentbord: spørsmål, diagrammer, filtre',
				tag: 'Nytt',
				items: [
					'<strong>Spørsmål</strong> stilt med musen – en tabell, sammenslåingene dens, filtre, mål per dag, uke, måned eller år – eller skrevet i <strong>SQL</strong>, skrivebeskyttet og med dine egne tillatelser, variabler inkludert. <a href="/fonctionnalites/tableaux-de-bord/">Instrumentbord</a>',
					'<strong>Femten visualiseringer</strong>: tall, trend mot forrige periode, fremdrift mot et mål, måler, histogram, stolper, linje, område, kombinert, sektor, trakt, punktdiagram, tabell, krysstabell, kart over Frankrike eller verden.',
					'<strong>Utforsk med ett klikk</strong>: et punkt åpner radene sine, en finere periode, en annen fordeling.',
					'<strong>Instrumentbord i rutenett</strong>: kort som flyttes og får ny størrelse med musen, faner, seksjonstitler, tekster, innebygde sider.',
					'<strong>Felles filtre</strong> – periode, kategori, tekst, tall, datogruppering – som styrer ett, flere eller alle kortene, med en standardverdi.',
					'<strong>Diagrammer slik du vil ha dem</strong>: farge og navn på hver serie eller hver andel, ring, halvsirkel eller rose, stabling med totaler, utjevnede linjer eller trappelinjer, akser, inndelinger, logaritmisk skala; tabeller med omdøpte kolonner, med stolper og farger etter verdien.',
					'<strong>Copilot for instrumentbord</strong>: en samtale som foreslår spørsmål, endringer i instrumentbordet – som kan angres – og verdier for filtrene, tatt i bruk med ett klikk. Bare strukturen sendes til leverandøren, med mindre du lar den lese resultatene. <a href="/fonctionnalites/tableaux-de-bord/#copilot">Copilot</a>',
					'<strong>Del et instrumentbord</strong> via en lenke, offentlig eller forbeholdt medlemmer – ved behov bestemte grupper – og bygg det inn på et annet nettsted: kort og filtre, skrivebeskyttet, lest med tillatelsene til den som publiserte det. <a href="/fonctionnalites/tableaux-de-bord/#del-et-instrumentbord">Deling</a>',
					'«Grensesnitt» heter nå <strong>Instrumentbord</strong>; de eksisterende åpnes som før, på det nye rutenettet.',
				],
			},
			sqlViews: {
				date: '2026-09-27',
				title: 'Lagrede spørringer og SQL-visninger',
				tag: 'Nytt',
				items: [
					'<strong>SQL for alle</strong>: uten nivået Administrere kjører en SQL-fane skrivebeskyttet, med dine egne tillatelser, håndhevet av PostgreSQL selv – en stengt tabell finnes ikke, et skjult felt avvises. Merket «Dine tillatelser» minner om det. <a href="/fonctionnalites/requetes-et-vues-sql/">Spørringer og SQL-visninger</a>',
					'<strong>Lagrede spørringer</strong>, plassert under tabellene i delen «Spørringer»: personlige, for hele databasen eller for grupper. Å dele en spørring deler teksten, aldri det forfatteren kan lese; åpnet fra sidepanelet kjøres den straks, skrivebeskyttet.',
					'<strong>SQL-visninger</strong>: ekte PostgreSQL-visninger, plassert blant tabellene med en farge, et ikon og et lite øye, som også kan leses fra <code>psql</code> og verktøyene dine. Hver enkelt leser dem med sine egne tillatelser, og sidepanelet viser dem bare til dem som kan lese alt i dem.',
					'Visningene følger strukturen: et nytt navn ødelegger dem ikke, en endret formel fjerner dem et øyeblikk og legger dem tilbake; en visning som ikke lenger holder, må rettes, og definisjonen beholdes.',
				],
			},
			settings: {
				date: '2026-09-27',
				title: 'Innstillingene dine',
				tag: 'Nytt',
				items: [
					'<strong>Innstillinger</strong>, i profilmenyen: navnet ditt, adressen din og identitetsleverandørene som er koblet til kontoen; passordet ditt og de åpne øktene dine. <a href="/fonctionnalites/droits/">Kontoer og innlogging</a>',
					'<strong>Utseende</strong>: temaet, rekkefølgen i datoer – <code>25/09/2026</code> eller <code>2026-09-25</code> – og første ukedag i kalenderne; de to siste følger deg fra én maskin til en annen.',
					'<strong>Varsler</strong>: slå av dem du ikke lenger vil ha, én type om gangen. <strong>Tokener</strong>: dem du har opprettet, i alle databasene dine, når de sist ble brukt, og tilbakekalling av dem.',
				],
			},
			v020: {
				date: '2026-09-26',
				title: 'Versjon 0.2.0: egen konto, egne prosjekter, egne invitasjoner',
				tag: 'Nytt',
				items: [
					'<strong>Første innlogging</strong>: på en ny instans oppretter den første siden administratorkontoen, med din adresse og ditt passord – ingen standardkonto lenger, og intet passord å lete etter i loggene. <a href="/guides/installation/">Installasjonen</a>',
					'<strong>Kontoopprettelse</strong>: hver enkelt oppretter sin egen konto, deretter sine egne prosjekter, som vedkommende administrerer. Administrasjonen kan stenge den eller begrense den til bestemte domener. <a href="/hebergement/connexion/">Kontoer og innlogging</a>',
					'<strong>Del et prosjekt eller en database</strong>: den som har nivået Administrere, inviterer via en lenke, med Lese, Redigere eller Administrere; ser hvem som har tilgang, endrer et nivå, fjerner det. Aldri mer enn det vedkommende selv administrerer.',
					'<strong>Personvern</strong>: hver enkelt ser nå bare personene de deler et prosjekt med, og et prosjektnavn som allerede er tatt av en annen, kan ikke lenger gjettes.',
					'<strong>Innlogging med Google, Microsoft</strong> og en hvilken som helst OpenID Connect-leverandør (Keycloak, GitLab …), angitt i <code>.env</code>; en første innlogging oppretter kontoen hvis kontoopprettelse er tillatt. <a href="/hebergement/connexion/">Sett opp</a>',
					'<strong>Nytt innloggingsskjermbilde</strong>, i applikasjonens tema, lyst eller mørkt, og diskret animert; illustrerte tomme skjermbilder i applikasjonen.',
					'<strong>Oppdateringer uten tap</strong>: basedb oppdaterer katalogen sin selv ved oppstart, også en 0.1-installasjon, og nekter å starte på en database som en nyere versjon allerede har oppdatert. <a href="/hebergement/sauvegardes/">Oppdatere</a>',
				],
			},
			dockerImage: {
				date: '2026-09-26',
				title: 'Ett enkelt Docker-image',
				tag: 'Drift',
				items: [
					'basedb får plass i <strong>ett enkelt image</strong>, <code>eodia/basedb</code> på Docker Hub, for amd64 og arm64: grensesnittet, API-et under <code>/api</code> og MCP-serveren under <code>/mcp</code>, på <strong>én enkelt port</strong>. <a href="/guides/installation/">Installasjonen</a>',
					'To filer er nok – <code>docker-compose.yml</code> og <code>.env</code> – uten å klone depotet eller bygge noe; oppdateringen gjøres med <code>docker compose pull</code>.',
					'Bak et domene har HTTPS-proxyen ingen ruting å gjøre lenger: alt går til port 3000.',
				],
			},
			automations: {
				date: '2026-09-26',
				title: 'Automatiseringer, grensesnitt, formler, samarbeid',
				tag: 'Nytt',
				items: [
					'<strong>Formler</strong> på fransk – <code>SI</code>, <code>ARRONDI</code>, <code>JOURS</code> … – som blir kolonner generert av PostgreSQL; <strong>oppslag</strong>, <strong>aggregeringer</strong> og <strong>antall</strong> på tvers av relasjonene. <a href="/fonctionnalites/tables-et-champs/">Feltene</a>',
					'<strong>Nye typer</strong>: multippel relasjon, person, e-post, autonummer, knapp; og formater som velges som typer – valuta, prosent, varighet, stjernevurdering, telefon, strekkode.',
					'<strong>Åtte visninger</strong>: <strong>galleri</strong> og <strong>liste</strong> slutter seg til de seks andre; <strong>personlige visninger</strong> for alle lesere, låste visninger, manuell rekkefølge, avhengigheter i tidslinjen. <a href="/fonctionnalites/vues/">Visningene</a>',
					'<strong>Rutenettet</strong>: hurtigsøk, gruppering, sammendrag per kolonne over hele filteret, farger etter regler, radhøyde.',
					'<strong>Delte visninger</strong>, skrivebeskyttet, som kan bygges inn på et annet nettsted; en kalender blir en <strong>iCalendar-feed</strong> for Google Kalender, Outlook eller Apple Kalender. <a href="/fonctionnalites/vues-partagees/">Deling</a>',
					'<strong>Samarbeid</strong>: kommentarer og omtaler, varsler, andres skriving i sanntid, tilstedeværelse på tabellen og på raden. <a href="/fonctionnalites/collaboration/">Jobbe sammen</a>',
					'<strong>Ctrl+Z</strong> angrer den siste skrivingen – en celle, et flyttet kort, en hel import – og nekter heller enn å overskrive det en annen har endret siden.',
					'<strong>Automatiseringer</strong>: når en rad opprettes eller endres, på et fast tidspunkt eller med et klikk på en knapp – endre, opprette, varsle, kalle en webhook, skrive i Slack. <a href="/fonctionnalites/automatisations/">Automatiser</a>',
					'<strong>Grensesnitt</strong>: instrumentbord – tall, diagrammer, lister, tekster – lest med hver enkelts tillatelser. <a href="/fonctionnalites/tableaux-de-bord/">Instrumentbord</a>',
					'<strong>Integrasjoner</strong>: en Slack-kanal, og <strong>synkroniserte tabeller</strong> fra en CSV på nett, en kalender eller visningen til en annen basedb. <a href="/integrations/synchronisation/">Integrasjonene</a>',
					'<strong>Databasemaler</strong>: et galleri med ti maler, en database beskrevet for KI i én setning, og enhver database kan lagres som mal. <a href="/modeles/">Galleriet</a>',
					'<strong>Tillatelser</strong>: Struktur-skjermen blir skrivebeskyttet for den som ikke har nivået Administrere.',
					'<strong>Ny identitet</strong>: en logo, en fargepalett og et nytt innloggingsskjermbilde.',
				],
			},
			simpler: {
				date: '2026-09-26',
				title: 'Et enklere grensesnitt',
				items: [
					'<strong>Sidepanelet</strong> viser nå bare databasene og tabellene deres; skjermene for den åpne databasen – Struktur, Historikk, Grensesnitt, Automatiseringer – er samlet i én blokk, rett over profilen.',
					'<strong>Profilmenyen</strong> rommer det som ikke er data: API- og MCP-dokumentasjonen, integrasjonene, brukerne og tillatelsene.',
					'<strong>En SQL-spørring</strong> åpnes med «+» i fanelinjen eller fra databasens meny, uten duplikat i sidepanelet.',
					'<strong>Ny database</strong> tilbyr maler og KI allerede i dialogen; demodatabasen går gjennom det samme galleriet.',
					'<strong>Skjermen tilbyr ikke lenger det som ville blitt avvist</strong>: ingen strukturknapp uten Administrere, ingen «Slett» uten rett til å slette; og en leser oppretter sine egne visninger i stedet for å møte en feilmelding.',
					'<strong>Systemkolonnene</strong> er samlet under «Systeminformasjon» i stedet for å tilbys på hver tabell.',
					'<strong>Raddetaljene</strong> får kommentarer, en knapp for å sende e-post eller ringe, og en vurdering som settes med ett klikk.',
					'<strong>Innloggingen</strong> dropper den animerte 3D-bakgrunnen til fordel for et lett skjermbilde, som respekterer innstillingen «redusert bevegelse».',
				],
			},
			environments: {
				date: '2026-09-26',
				title: 'Miljøer, delte skjemaer, visninger',
				items: [
					'<strong>Miljøer</strong>: produksjon, test og utvikling for samme database; sammenligning side om side, migreringsplan, synkronisering av rader.',
					'<strong>Strukturhistorikk</strong>: hver opprettelse eller endring av en tabell eller et felt, fanget opp av en trigger på katalogen.',
					'<strong>Delte skjemaer</strong>: en offentlig lenke eller en som er forbeholdt medlemmer, stenging etter dato eller antall svar, svarene tilskrevet i historikken.',
					'<strong>Seks visninger</strong>: rutenett, kanban, kalender, tidslinje, skjema, spørreundersøkelse.',
					'<strong>Datahistorikk</strong>: angre en endring, gjenopprette en slettet rad.',
					'<strong>KI</strong>: KI-alternativet på et hvilket som helst felt, og Copilot.',
					'<strong>Relasjon</strong> og <strong>URL</strong>: to separate typer; lang tekst skrives i Markdown.',
					'<strong>Webhooks</strong>, signert og i rekkefølge; <strong>forslag fra agenter</strong> som skal godkjennes.',
					'<strong>Docker</strong>: en Dockerfile med tre mål, en komplett docker-compose, en valgfri HTTPS-proxy.',
				],
			},
			projects: {
				date: '2026-09-25',
				title: 'Prosjekter, tillatelser, MCP-server',
				items: [
					'<strong>Prosjekter</strong> over databasene, og tillatelser per <strong>gruppe</strong> på fire nivåer: Ingen tilgang, Lese, Redigere, Administrere.',
					'<strong>Kontoer</strong>: midlertidig passord, som endres ved første innlogging, forhøyet økt for administrasjon.',
					'<strong>MCP-server</strong> og stdio-relé; <strong>integrasjonstokener</strong> felles for REST-API-et og MCP.',
					'<strong>Generert dokumentasjon</strong> «API og MCP» for hver database.',
				],
			},
			fields: {
				date: '2026-09-20',
				title: 'Felt, enkeltvalg, import',
				items: [
					'Endre et felt og alternativene i et enkeltvalg.',
					'<strong>Import</strong> av CSV- og JSON-filer.',
					'Tabellmenyen: gi nytt navn, beskriv, slett.',
				],
			},
			firstCommit: {
				date: '2026-09-20',
				title: 'Første commit',
				items: [
					'Monorepoet: navngiving, register over feilkoder, katalog hentet fra arkitekturdokumentet, kjerne, API, grensesnitt.',
				],
			},
		},
	},
	roadmap: {
		label: 'Veikart',
		title: 'Hva som kommer videre',
		intro: 'basedb er under aktiv utvikling. Denne siden sier hva som fortsatt mangler, uten lovede datoer. En idé, et behov? <a href="https://github.com/eodia/basedb/issues">Opprett en sak</a>. Det som allerede er på plass: <a href="/nouveautes/">nyhetene</a>.',
		columns: {
			next: {
				title: 'Snart',
				items: {
					restoreTable: {
						title: 'Gjenopprett én enkelt tabell',
						text: 'En slettet tabell kan fortsatt leses i SQL under navnet den er flyttet til side med; å hente den tilbake alene fra grensesnittet kommer.',
					},
					aiSettings: {
						title: 'KI-innstillinger i grensesnittet',
						text: 'Leverandør, modell og nøkkel per arbeidsområde, uten å gå via API-ets miljø.',
					},
					mail: {
						title: 'Varsler og invitasjoner på e-post',
						text: 'Omtaler, svar og tildelinger kommer i dag i basedb, og invitasjoner som en lenke du sender selv; de skal også kunne sendes på e-post.',
					},
				},
			},
			later: {
				title: 'Senere',
				items: {
					formLinks: {
						title: 'Relasjoner og filer i delte skjemaer',
						text: 'Et begrenset søk i den koblede tabellen, en avgrenset filopplasting for ukjente.',
					},
					moreEvents: {
						title: 'Varsler for flere hendelser',
						text: 'Bli varslet om et svar på et skjema, et forslag fra en agent, en deaktivert webhook.',
					},
					sqlViewsAcross: {
						title: 'SQL-visninger fra ett miljø til et annet',
						text: 'Kopiere SQL-visningene sammen med strukturen når man oppretter eller sammenligner miljøer, og i databasemalene.',
					},
					loops: {
						title: 'Løkker og venting i automatiseringer',
						text: 'Gjenta trinn for hver rad som blir funnet, vente før det neste («tre dager etter»), og ta med flytene i databasemalene.',
					},
					textFormulas: {
						title: 'Formler for tekst',
						text: 'Hente ut, erstatte eller korte ned en del av en tekst.',
					},
					bulk: {
						title: 'Deklarerte masseoperasjoner',
						text: 'Endringer i tusenvis av rader, ført i historikken som én enkelt operasjon.',
					},
					tombstones: {
						title: 'Opprydding av gravsteiner',
						text: 'Rydding av slettespor som ikke lenger trengs.',
					},
				},
			},
		},
	},
	gallery: {
		label: 'Maler',
		title: 'En database klar på sekunder',
		intro: 'Hver mal oppretter tabeller som er koblet sammen, eksempelrader, visninger, et instrumentbord, automatiseringer – og felt som KI fyller ut selv. I basedb: <strong>Ny database</strong>, deretter <strong>Start fra en mal</strong>. Passer ingenting? Beskriv behovet ditt i én setning: KI foreslår en skreddersydd database.',
		filter: 'Filtrer etter kategori',
		all: 'Alle',
		otherCategory: 'Andre',
		ai: '✦ KI',
		tables: {
			one: '{n} tabell',
			other: '{n} tabeller',
		},
		rows: {
			one: '{n} rad',
			other: '{n} rader',
		},
		views: {
			one: '{n} visning',
			other: '{n} visninger',
		},
		howtoTitle: 'Sette opp maler i JSON',
		howto: 'En mal er en JSON-fil: tabellene, feltene, relasjonene, radene, visningene, instrumentbordene, automatiseringene og instruksjonene til KI-feltene. Malene på denne siden er filene i mappen <a href="https://github.com/eodia/basedb/tree/main/packages/templates/catalog"><code>packages/templates/catalog</code></a> i depotet; hver basedb-instans leser <a href="/modeles/catalogue.json"><code>catalogue.json</code></a> og tilbyr dem til brukerne sine. En administrator kan også importere sine egne maler til instansen sin, og enhver database kan lagres som mal.',
		format: {
			href: '/fonctionnalites/modeles/',
			label: 'Malformatet →',
		},
		back: '← Alle maler',
		defaultCategory: 'Mal',
		sampleRows: {
			one: '{n} eksempelrad',
			other: '{n} eksempelrader',
		},
		aiTitle: 'Det KI beregner',
		useTitle: 'Bruk denne malen',
		useSteps: [
			'I basedb: <strong>Ny database</strong>.',
			'<strong>Start fra en mal</strong>, deretter «{label}».',
		],
		create: '<strong>Opprett databasen</strong>.',
		createWithAi: '<strong>Opprett databasen</strong> – og godta, hvis du vil, at KI-feltene beregnes av KI-leverandøren din.',
		download: 'Last ned JSON-filen',
		downloadNote: 'For å importere den i instansen din, eller tilpasse den før du foreslår den for katalogen.',
		viewMeta: '– {kind}, {table}',
		dashboard: '<strong>Instrumentbord</strong> «{label}» – {blocks}',
		blocks: {
			one: '{n} blokk',
			other: '{n} blokker',
		},
		automation: '<strong>Automatisering</strong> «{label}»',
		yes: 'Ja',
		no: 'Nei',
		me: 'Du',
		kinds: {
			short_text: 'Kort tekst',
			long_text: 'Lang tekst',
			rich_text: 'Formatert tekst',
			number: 'Tall',
			boolean: 'Avmerkingsboks',
			date: 'Dato',
			datetime: 'Dato og klokkeslett',
			select: 'Enkeltvalg',
			multi_select: 'Flervalg',
			url: 'URL',
			email: 'E-post',
			user: 'Person',
			autonumber: 'Autonummer',
			formula: 'Formel',
			lookup: 'Oppslag',
			rollup: 'Aggregering',
			count: 'Antall',
			button: 'Knapp',
			link: 'Relasjon',
			multi_link: 'Multippel relasjon',
		},
		viewKinds: {
			grid: 'Rutenett',
			kanban: 'Kanban',
			calendar: 'Kalender',
			timeline: 'Tidslinje',
			gallery: 'Galleri',
			list: 'Liste',
			form: 'Skjema',
		},
	},
	templates: {
		demo: {
			label: 'Demo: Lumen Atelier',
			summary: 'Et lite byrå med kunder, prosjekter, oppgaver, fakturaer og omtaler: alle sidene ved basedb i én database.',
			description: 'Demodatabasen. Lumen Atelier er et fiktivt designbyrå. Databasen viser relasjoner mellom tabeller, oppslag og aggregeringer (omsetning per kunde, gjennomsnittlig vurdering), formler (beløp inkl. mva., forsinkelse), tre felt beregnet av KI på kundeomtaler (stemning, tema, foreslått svar), alle typer visninger – rutenett, kanban, kalender, tidslinje med avhengigheter, galleri, liste, skjema –, et instrumentbord og to automatiseringer.',
			category: 'Demonstrasjon',
			tags: ['KI', 'Relasjoner', 'Alle visninger', 'Instrumentbord'],
		},
		'analyse-avis': {
			label: 'Analyse av kundeomtaler',
			summary: 'Samle inn tilbakemeldinger, og la KI hente ut stemning, temaer, hastegrad og et utkast til svar.',
			description: 'For en butikk, en restaurant eller et merke: omtalene kommer fra et offentlig skjema eller en import, og KI leser hver enkelt. Den klassifiserer stemningen, finner hovedtemaet, markerer dem som krever raskt svar, henter ut kundens forslag og skriver et svarutkast som skal leses gjennom. Produktene samler gjennomsnittlig vurdering og antall omtaler; et instrumentbord følger med på tilfredsheten.',
			category: 'Kunderelasjoner',
			tags: ['KI', 'Skjema', 'Instrumentbord'],
		},
		'base-connaissances': {
			label: 'Kunnskapsbase',
			summary: 'Hjelpeartikler og spørsmål fra kunder: KI oppsummerer, klassifiserer og foreslår et svar basert på artiklene.',
			description: 'For en kundestøtteavdeling. Hjelpeartiklene er sortert etter kategori og fulgt opp over tid; kundenes spørsmål kommer inn via et offentlig skjema. KI oppsummerer hver artikkel og vurderer nivået, klassifiserer hvert spørsmål og skriver et svarutkast som skal leses gjennom.',
			category: 'Kundestøtte',
			tags: ['KI', 'Skjema', 'Liste'],
		},
		'calendrier-editorial': {
			label: 'Redaksjonell kalender',
			summary: 'Artikler, innlegg og nyhetsbrev planlagt i en kalender; KI foreslår fengende titler og nøkkelord.',
			description: 'For et markedsføringsteam eller en redaksjon. Hvert innhold går fra idé til publisering, plasseres i publiseringskalenderen og hører til en kampanje. KI foreslår en fengende tittel og nøkkelord basert på briefen, og et skjema lar hele bedriften foreslå et tema.',
			category: 'Markedsføring',
			tags: ['KI', 'Kalender', 'Kanban', 'Skjema'],
		},
		crm: {
			label: 'Salgs-CRM',
			summary: 'Bedrifter, kontakter og salgsmuligheter: en salgspipeline, kommunikasjonen og KI som anbefaler neste steg.',
			description: 'Et enkelt CRM for et salgsteam. Salgsmulighetene går gjennom en pipeline og har et beløp vektet etter sannsynlighet, og KI vurderer risikoen og anbefaler neste handling basert på notatene. Kommunikasjonen med kundene registreres og oppsummeres, og bedriftene summerer det de representerer.',
			category: 'Salg',
			tags: ['KI', 'Pipeline', 'Kanban', 'Kalender'],
		},
		evenements: {
			label: 'Arrangementer og påmeldinger',
			summary: 'Konferanser, workshoper og webinarer: påmeldinger, ledige plasser og deltakernes tilbakemeldinger lest av KI.',
			description: 'For å organisere tilbakevendende arrangementer. Hvert arrangement teller påmeldte og ledige plasser; påmeldingene følges helt fram til oppmøte. Etter arrangementet gir deltakerne en tilbakemelding som KI klassifiserer etter stemning og oppsummerer. Et offentlig skjema lar folk melde seg på e-postlisten.',
			category: 'Arrangementer',
			tags: ['KI', 'Kalender', 'Skjema', 'Aggregeringer'],
		},
		'gestion-projet': {
			label: 'Prosjektstyring',
			summary: 'Prosjekter, oppgaver og milepæler: et veikart, avhengigheter mellom oppgaver, en kanban og en kalender.',
			description: 'For å styre flere prosjekter parallelt. Hvert prosjekt summerer oppgaver og timer; oppgavene følges i kanban, planlegges på en tidslinje som tegner avhengighetene, og milepælene vises i en kalender. KI skriver en statusoppdatering om prosjektet for ledelsen basert på beskrivelsen og fremdriften.',
			category: 'Organisering',
			tags: ['Tidslinje', 'Avhengigheter', 'Kanban', 'KI'],
		},
		inventaire: {
			label: 'Varelager og beholdning',
			summary: 'Varer, leverandører og lagerbevegelser: beholdningen beregnes automatisk, og mangler ses på forhånd.',
			description: 'For et verksted, en butikk eller en driftsavdeling. Hver inngang eller utgang er en bevegelse; lagerbeholdningen for hver vare er summen av dem, verdien en formel, og varer under minstenivået vises i «Må bestilles». KI skriver en beskrivelse av hver vare basert på navn og kategori.',
			category: 'Operasjoner',
			tags: ['Aggregeringer', 'Formler', 'Galleri', 'KI'],
		},
		recrutement: {
			label: 'Rekruttering',
			summary: 'Ledige stillinger, kandidater og intervjuer; KI oppsummerer hver søknad og foreslår punkter å gå nærmere inn på.',
			description: 'Oppfølging av rekrutteringer, fra søknad til ansettelse. Kandidatene søker via et offentlig skjema og går trinn for trinn gjennom en kanban, og intervjuene planlegges i en kalender. KI leser søknadsbrevet og notatene: et sammendrag, og spørsmålene som bør stilles i intervjuet. Den hjelper med å lese, den bestemmer ikke.',
			category: 'HR',
			tags: ['KI', 'Skjema', 'Kanban', 'Kalender'],
		},
		'suivi-tickets': {
			label: 'Sakshåndtering',
			summary: 'Feil og forespørsler sortert av KI og fulgt opp per sprint til de er løst, med et skjema for innmelding.',
			description: 'Et sakshåndteringssystem for et produktteam. Hver sak er knyttet til en komponent og en sprint; KI foreslår en kategori, anslår alvorlighetsgraden og oppsummerer innmeldingen. En kanban følger fremdriften, en tidslinje viser sprintene, et skjema lar hvem som helst melde inn et problem, og en automatisering registrerer løsningsdatoen.',
			category: 'Produkt og teknologi',
			tags: ['KI', 'Kanban', 'Skjema', 'Sprinter'],
		},
	},
} satisfies DeepPartial<Dict>;
