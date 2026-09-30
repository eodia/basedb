/**
 * The Swedish texts of the landing pages, laid over the French ones (`fr.ts`).
 *
 * See `../README.md`.
 */
import type { DeepPartial, Dict } from './index';

export default {
	meta: {
		home: {
			title: 'basedb – databasen för samarbete där varje tabell är en riktig PostgreSQL-tabell',
			description: 'Rutnät och tio vyer, formler, delade formulär, quiz och vyer, kommentarer, automatiseringar, instrumentpaneler, behörigheter ända ned till fältet, fullständig historik, REST-API och MCP-server – på riktiga PostgreSQL-tabeller med läsbara namn. Självhostad, AGPL-3.0.',
		},
		changelog: {
			title: 'Nyheter – basedb',
			description: 'Vad som har ändrats i basedb, version för version.',
		},
		roadmap: {
			title: 'Färdplan – basedb',
			description: 'Vad basedb ska göra härnäst.',
		},
		gallery: {
			title: 'Mallar – basedb',
			description: 'Färdiga databaser: ärendehantering, analys av omdömen, CRM, rekrytering … med exempelrader, vyer, instrumentpaneler och fält som beräknas av AI.',
		},
		template: {
			title: '{label} – basedb-mallar',
		},
	},
	eodia: {
		home: 'https://eodia.com/',
		about: 'https://eodia.com/about/',
		contact: 'https://eodia.com/contact/',
	},
	demo: {
		short: 'Demo',
		cta: 'Prova demon',
	},
	nav: {
		aria: 'Huvudnavigering',
		home: 'basedb – startsida',
		links: [
			{
				href: '/#fonctionnalites',
				label: 'Funktioner',
			},
			{
				href: '/modeles/',
				label: 'Mallar',
			},
			{
				href: '/guides/introduction/',
				label: 'Dokumentation',
			},
			{
				href: '/nouveautes/',
				label: 'Nyheter',
			},
		],
		developers: 'Utvecklare',
		github: 'basedbs repo på GitHub',
		install: 'Installera',
		menu: {
			open: 'Öppna menyn',
			close: 'Stäng menyn',
			features: {
				label: 'Funktioner',
				groups: {
					organize: {
						title: 'Organisera',
						items: {
							tables: {
								href: '/fonctionnalites/tables-et-champs/',
								title: 'Tabeller och fält',
								text: 'Fält för allt, relationer, formler som i ett kalkylark.',
							},
							views: {
								href: '/fonctionnalites/vues/',
								title: 'Tio vyer',
								text: 'Rutnät, kanban, kalender, tidslinje, galleri, lista, karta, formulär, enkät, quiz.',
							},
							forms: {
								href: '/fonctionnalites/formulaires-partages/',
								title: 'Formulär',
								text: 'En länk att dela: varje svar blir en rad.',
							},
							files: {
								href: '/fonctionnalites/fichiers/',
								title: 'Filer och bilder',
								text: 'Offerter, foton, avtal, sparade med sin rad.',
							},
						},
					},
					collaborate: {
						title: 'Samarbeta',
						items: {
							live: {
								href: '/fonctionnalites/collaboration/',
								title: 'Realtid och kommentarer',
								text: 'Se de andra arbeta, kommentera en rad, nämn en kollega.',
							},
							rights: {
								href: '/fonctionnalites/droits/',
								title: 'Behörigheter och team',
								text: 'Vem ser vad och vem ändrar vad, ända ned till kolumnen.',
							},
							history: {
								href: '/fonctionnalites/historique/',
								title: 'Historik',
								text: 'Varje ändring sparad, och möjlig att ångra.',
							},
							shared: {
								href: '/fonctionnalites/vues-partagees/',
								title: 'Delade vyer',
								text: 'En vy via en länk, på din webbplats eller i din kalender.',
							},
						},
					},
					automate: {
						title: 'Automatisera och analysera',
						items: {
							automations: {
								href: '/fonctionnalites/automatisations/',
								title: 'Automatiseringar',
								text: 'När en rad ändras: avisera, skapa, skriv, fråga AI.',
							},
							dashboards: {
								href: '/fonctionnalites/tableaux-de-bord/',
								title: 'Instrumentpaneler',
								text: 'Femton visualiseringar, gemensamma filter, en länk att dela.',
							},
							ai: {
								href: '/fonctionnalites/ia/',
								title: 'AI och Copilot',
								text: 'En databas på en mening, fält som fylls i själva.',
							},
							templates: {
								href: '/modeles/',
								title: 'Mallar',
								text: 'Tio färdiga databaser, redo att anpassa.',
							},
						},
					},
				},
				feature: {
					tag: 'Nytt',
					title: 'Automatiseringar i flöden',
					text: 'Söka, avgöra, fråga AI: en grafisk editor, och varje körning går att läsa igenom, steg för steg.',
					href: '/nouveautes/',
					cta: 'Alla nyheter',
				},
				all: 'Alla funktioner',
			},
			solutions: {
				label: 'Lösningar',
				title: 'För varje team',
				items: {
					crm: {
						team: 'Försäljning',
						text: 'Pipeline, kontakter, uppföljning.',
					},
					recrutement: {
						team: 'HR',
						text: 'Ansökningar, intervjuer, sammanfattningar av AI.',
					},
					'calendrier-editorial': {
						team: 'Marknadsföring',
						text: 'Artiklar, inlägg och nyhetsbrev, planerade i förväg.',
					},
					inventaire: {
						team: 'Drift',
						text: 'Ett beräknat lager, brister sedda i förväg.',
					},
					'gestion-projet': {
						team: 'Projekt',
						text: 'Milstolpar, uppgifter och beroenden.',
					},
					'suivi-tickets': {
						team: 'Produkt',
						text: 'Buggar och önskemål sorterade av AI.',
					},
					'base-connaissances': {
						team: 'Support',
						text: 'Hjälpartiklar, frågor, föreslagna svar.',
					},
					evenements: {
						team: 'Evenemang',
						text: 'Anmälningar, platser, återkoppling.',
					},
					'analyse-avis': {
						team: 'Kundrelationer',
						text: 'Omdömen lästa och klassificerade av AI.',
					},
				},
				ask: {
					title: 'Något annat i åtanke?',
					text: 'Beskriv ditt behov i en mening: AI föreslår en skräddarsydd databas.',
					href: '/modeles/',
				},
				all: 'Alla mallar',
			},
			developers: {
				label: 'Utvecklare',
				groups: {
					build: {
						title: 'Integrera',
						items: {
							api: {
								href: '/integrations/api-rest/',
								title: 'REST-API',
								text: 'Samma data som gränssnittet, beskrivna i OpenAPI 3.1.',
							},
							mcp: {
								href: '/integrations/mcp/',
								title: 'MCP-server',
								text: 'Verktyg för dina AI-agenter, under dina behörigheter.',
							},
							webhooks: {
								href: '/integrations/webhooks/',
								title: 'Webhooks',
								text: 'Varje skrivning, signerad, ordnad, återförsökt.',
							},
							sql: {
								href: '/integrations/sql/',
								title: 'Direkt SQL',
								text: 'Riktiga PostgreSQL-tabeller, med läsbara namn.',
							},
							sync: {
								href: '/integrations/synchronisation/',
								title: 'Synkronisering',
								text: 'Tabeller hållna uppdaterade från ett annat håll.',
							},
						},
					},
					host: {
						title: 'Driftsätta',
						items: {
							docker: {
								href: '/hebergement/docker/',
								title: 'Docker Compose',
								text: 'En avbildning, en PostgreSQL-databas, en enda port.',
							},
							env: {
								href: '/hebergement/variables/',
								title: 'Miljövariabler',
								text: 'Allt ställs in i filen .env.',
							},
							https: {
								href: '/hebergement/https/',
								title: 'Domän och HTTPS',
								text: 'Bakom din proxy, eller med den medföljande Caddy.',
							},
							sso: {
								href: '/hebergement/connexion/',
								title: 'Inloggning och SSO',
								text: 'Google, Microsoft, valfri OpenID Connect-leverantör.',
							},
							backup: {
								href: '/hebergement/sauvegardes/',
								title: 'Säkerhetskopior och uppdateringar',
								text: 'pg_dump, och uppdateringar utan dataförlust.',
							},
						},
					},
				},
				feature: {
					title: 'Utvecklarsidan',
					text: 'En riktig PostgreSQL-tabell bakom varje rutnät.',
					href: '/developpeurs/',
				},
			},
			resources: {
				label: 'Resurser',
				groups: {
					learn: {
						title: 'Lära dig',
						items: {
							docs: {
								href: '/guides/introduction/',
								title: 'Dokumentation',
								text: 'Hela basedb, steg för steg.',
							},
							start: {
								href: '/guides/premiers-pas/',
								title: 'Kom igång',
								text: 'Din första databas, från import till vy.',
							},
							install: {
								href: '/guides/installation/',
								title: 'Installation',
								text: 'Två filer och ett kommando.',
							},
							principles: {
								href: '/architecture/principes/',
								title: 'Principerna',
								text: 'Hur basedb är byggt, och varför.',
							},
						},
					},
					follow: {
						title: 'Följa projektet',
						items: {
							news: {
								href: '/nouveautes/',
								title: 'Nyheter',
								text: 'Vad som har ändrats, version efter version.',
							},
							roadmap: {
								href: '/feuille-de-route/',
								title: 'Färdplan',
								text: 'Vad som kommer härnäst.',
							},
							github: {
								href: 'https://github.com/eodia/basedb',
								title: 'GitHub',
								text: 'Koden, ärendena, versionerna.',
							},
							eodia: {
								href: 'https://eodia.com/',
								title: 'Eodia',
								text: 'Studion som gör basedb.',
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
		tagline: 'Databasen för samarbete där varje tabell är en riktig PostgreSQL-tabell.',
		madeBy: 'Fri programvara från <a class="eodia" href="https://eodia.com/">Eodia</a>, en AI-nativ mjukvarustudio.',
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
						label: 'Nyheter',
					},
					{
						href: '/feuille-de-route/',
						label: 'Färdplan',
					},
					{
						href: '/#faq',
						label: 'Vanliga frågor',
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
				title: 'Drift',
				links: [
					{
						href: '/hebergement/docker/',
						label: 'Docker Compose',
					},
					{
						href: '/hebergement/variables/',
						label: 'Miljövariabler',
					},
					{
						href: '/hebergement/https/',
						label: 'Domän och HTTPS',
					},
					{
						href: '/hebergement/sauvegardes/',
						label: 'Säkerhetskopior',
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
						label: 'Licens AGPL-3.0',
					},
					{
						href: 'https://github.com/eodia/basedb/issues',
						label: 'Rapportera ett problem',
					},
				],
			},
			eodia: {
				title: 'Eodia',
				links: [
					{
						href: 'https://eodia.com/',
						label: 'Studion',
					},
					{
						href: 'https://eodia.com/about/',
						label: 'Om oss',
					},
					{
						href: 'https://eodia.com/contact/',
						label: 'Kontakta oss',
					},
				],
			},
		},
		copyright: '© {year} <a href="https://eodia.com/">Eodia</a> · AGPL-3.0-or-later',
		builtWith: 'Webbplatsen är byggd med Astro och Starlight.',
	},
	docsFooter: {
		madeBy: 'basedb är fri programvara från <a href="https://eodia.com/">Eodia</a>, en AI-nativ mjukvarustudio.',
	},
	teams: {
		meta: {
			title: 'basedb – samarbetsdatabasen för hela teamet',
			description: 'Allt ditt arbete på ett och samma ställe, redigerat av hela teamet samtidigt: i tabell, kanban eller kalender, med formulär, instrumentpaneler, automatiseringar och AI. Utan kod, fri och gratis.',
		},
		hero: {
			eyebrow: 'basedb',
			title: 'Allt ditt arbete.',
			titleAccent: 'Äntligen på samma ställe.',
			lead: 'Tabeller, kalendrar, formulär, instrumentpaneler och automatiseringar, för hela teamet. Lika enkelt som ett kalkylark. Utan en rad kod.',
			primary: 'Utforska mallarna',
			secondary: 'Se demon',
			facts: ['Utan kod', 'Fri och gratis', 'Dina data stannar hos dig'],
		},
		story: {
			grid: {
				title: 'Hela teamet, i samma tabell.',
				text: 'Alla arbetar i den samtidigt, och alla ser samma sak – uppdaterad direkt.',
			},
			copilot: {
				title: 'Fråga. Copilot tar hand om det.',
				text: '”Vem ska jag följa upp den här veckan?” – den föreslår rätt filter, och du använder det med ett klick.',
			},
			kanban: {
				title: 'Dra. Det är uppdaterat.',
				text: 'Varje steg blir en kolumn; att flytta ett kort är att ändra raden.',
			},
			calendar: {
				title: 'Varje datum på sin plats.',
				text: 'Mötena visas av sig själva, och går att följa ända in i din kalender.',
			},
			dashboard: {
				title: 'Och allt, med en blick.',
				text: 'Siffrorna räknas fram själva, från samma rader.',
			},
		},
		stage: {
			aria: 'Ett teams kunduppföljning i basedb: tabell, Copilot, kanban, kalender, instrumentpanel',
			tabs: {
				grid: 'Tabell',
				copilot: 'Copilot',
				kanban: 'Kanban',
				calendar: 'Kalender',
				dashboard: 'Instrumentpanel',
			},
			project: 'Huvudprojekt',
			projectMeta: 'Projekt · 2 databaser',
			filterNav: 'Filtrera navigeringen',
			base: 'Försäljning',
			otherBase: 'Support',
			tables: ['Kunder', 'Kontakter', 'Offerter'],
			baseSection: 'Databas · Försäljning',
			screens: ['Instrumentpaneler', 'Automatiseringar'],
			user: 'Léa Martin',
			views: { grid: 'Alla rader', kanban: 'Efter steg', calendar: 'Möten' },
			toolbar: {
				filter: 'Filtrera',
				columns: 'Kolumner',
				group: 'Gruppera',
				colors: 'Färger',
				sort: 'Sortera',
				configure: 'Konfigurera',
			},
			search: 'Sök…',
			add: 'Lägg till',
			columns: {
				name: 'Kund',
				status: 'Steg',
				owner: 'Ansvarig',
				amount: 'Belopp',
				next: 'Nästa möte',
			},
			statuses: {
				contact: 'Att kontakta',
				meeting: 'Möte',
				quote: 'Offert skickad',
				signed: 'Signerad',
			},
			clients: [
				'Bageri Lindgren',
				'Lindkliniken',
				'Fredrika Bremer-gymnasiet',
				'Cykelhjälpen',
				'Delikatessboden',
				'Klarälvens Smide',
				'Ateljé Holm',
			],
			addRow: 'Lägg till en rad',
			perPage: 'Rader per sida',
			card: 'Ansvarig: {owner}, möte den {date}',
			addCard: 'Lägg till ett kort',
			today: 'I dag',
			month: 'Månad',
			week: 'Vecka',
			dashboards: 'Instrumentpaneler',
			questions: 'Frågor',
			dashboard: 'Säljuppföljning',
			dashboardText: 'Det viktigaste, med en blick.',
			dashboardTabs: ['Översikt', 'Aktivitet'],
			period: 'Period',
			thisYear: 'I år',
			share: 'Dela',
			edit: 'Redigera',
			explore: 'Utforska data',
			chart: 'Belopp per kund',
			byStage: 'Kunder efter steg',
			kpis: {
				signed: 'Signerat',
				pending: 'Väntande offerter',
				rate: 'Signerade kunder',
			},
			copilot: {
				question: 'Vem ska jag följa upp den här veckan?',
				thinking: 'Tänker…',
				answer: 'Fyra kunder väntar på svar: två skickade offerter och två möten att förbereda.',
				card: 'Filtrera Kunder',
				filter: 'Steg: Offert skickad eller Möte',
				apply: 'Tillämpa filtret',
				applied: 'Filter tillämpat',
				placeholder: 'Fråga Copilot…',
				filtered: '{n} filtrerade rader',
			},
		},
		teaser: {
			tabs: { label: 'Välj video', short: 'På 40 sekunder', full: 'Hela rundturen' },
			titleAccent: 'på 40 sekunder.',
			text: 'Tabeller, vyer, formulär, automatiseringar och AI: det viktigaste i basedb, till musik.',
			duration: '40 s',
			inEnglish: 'Texterna i videon är på engelska.',
		},

		video: {
			eyebrow: 'Demon',
			title: 'Hela basedb,',
			titleAccent: 'på sju minuter.',
			text: 'Skapa en databas, fylla den, dela den, automatisera den, styra den: den fullständiga, kommenterade rundturen.',
			play: 'Spela videon',
			duration: '6 min 36 s',
			chapters: 'Kapitel',
			captions: 'Engelska',
			inEnglish: 'Videon är på engelska, med engelska undertexter.',
			list: [
				{ time: '0:10', title: 'Skapa en databas' },
				{ time: '0:49', title: 'Tabeller, fält och formler' },
				{ time: '1:31', title: 'Raddetaljer och samarbete' },
				{ time: '1:56', title: 'Sex vyer på samma rader' },
				{ time: '2:29', title: 'Formulär och enkäter' },
				{ time: '3:28', title: 'Quiz' },
				{ time: '4:10', title: 'Automatiseringar' },
				{ time: '4:39', title: 'Instrumentpaneler' },
				{ time: '4:59', title: 'SQL för alla' },
				{ time: '5:30', title: 'Historik och behörigheter' },
				{ time: '5:53', title: 'API, MCP och Copilot' },
			],
		},
		together: {
			eyebrow: 'Samarbete',
			title: 'Alla.',
			titleAccent: 'Samtidigt.',
			text: 'De andras ändringar kommer in direkt. Du ser vem som tittar på vilken rad, ni diskuterar den där den finns, och ett @ räcker för att meddela en kollega.',
			demo: {
				path: 'Försäljning / Offerter',
				here: '3 personer på denna tabell',
				columns: {
					client: 'Kund',
					status: 'Steg',
					amount: 'Belopp',
					due: 'Förfallodatum',
				},
				statuses: {
					draft: 'Utkast',
					sent: 'Skickad',
					signed: 'Signerad',
				},
				rows: [
					'Bageri Lindgren',
					'Lindkliniken',
					'Fredrika Bremer-gymnasiet',
					'Cykelhjälpen',
					'Delikatessboden',
					'Klarälvens Smide',
				],
				comment: '@{name} kan du godkänna den här offerten innan kvällen?',
				reply: 'Godkänt!',
				toast: '{name} ändrade ”{field}”',
			},
			points: {
				live: {
					title: 'Direkt',
					text: 'Varje ändring visas genast hos de andra, utan att sidan laddas om.',
				},
				comments: {
					title: 'Kommentarer och omnämnanden',
					text: 'Du kommenterar en rad, nämner en kollega med @, och klockan meddelar hen.',
				},
				undo: {
					title: 'Ångra utan risk',
					text: 'Ctrl+Z ångrar din senaste ändring – aldrig en kollegas.',
				},
			},
			link: {
				href: '/fonctionnalites/collaboration/',
				label: 'Arbeta tillsammans',
			},
		},
		forms: {
			eyebrow: 'Formulär och enkäter',
			title: 'Ställ dina frågor.',
			titleAccent: 'Svaren sorterar sig själva.',
			text: 'Ett formulär på en enda sida, eller en enkät som ställer en fråga per skärm, i dina färger: dela länken, och varje svar blir en rad i din tabell. Den som svarar ser inget annat.',
			modes: {
				label: 'Visa frågorna',
				survey: 'Enkät',
				form: 'Formulär',
			},
			demo: {
				title: 'Offertförfrågan',
				description: 'Tre frågor, sedan återkommer vi inom 48 timmar.',
				count: '3 frågor',
				start: 'Börja',
				ok: 'OK',
				hint: 'eller Enter',
				submit: 'Skicka min förfrågan',
				org: {
					label: 'Din organisation',
					answer: 'Konstcaféet',
				},
				need: {
					label: 'Ditt behov',
					options: ['Webbplats', 'Visuell identitet', 'Katalog'],
				},
				budget: {
					label: 'Din budget',
					help: 'Exklusive moms, en ungefärlig siffra räcker.',
				},
				sent: 'Skickat!',
				thanks: 'Tack! Vi återkommer inom 48 timmar.',
				poweredBy: 'Formulär drivet av basedb',
				path: 'Försäljning / Förfrågningar',
				view: 'Alla förfrågningar',
				columns: {
					org: 'Organisation',
					need: 'Behov',
					budget: 'Budget',
					stage: 'Steg',
				},
				stages: {
					new: 'Ny',
					called: 'Uppringd',
					quote: 'Offert skickad',
				},
				rows: ['Bageri Lindgren', 'Lindkliniken', 'Cykelhjälpen', 'Klarälvens Smide'],
				open: 'Öppet',
				answers: {
					one: '{n} svar',
					other: '{n} svar',
				},
				active: 'Aktiv länk',
			},
			points: {
				survey: {
					title: 'En fråga per skärm',
					text: 'I helskärm, med tangentbordet: Enter för att fortsätta, A, B, C för att välja — ett enda val går vidare av sig själv, och att skicka in firas.',
				},
				access: {
					title: 'Öppet eller begränsat',
					text: 'Alla med länken svarar utan konto – eller bara inloggade medlemmar, och svaret bär deras namn.',
				},
				closed: {
					title: 'Resten förblir stängd',
					text: 'Att svara visar inget annat av tabellen. Länken stängs vid ett datum, eller efter ett antal svar.',
				},
			},
			link: {
				href: '/fonctionnalites/formulaires-partages/',
				label: 'Formulären',
			},
		},
		automate: {
			eyebrow: 'Automatiseringar',
			title: 'Den jobbar',
			titleAccent: 'medan du sover.',
			text: 'När en rad kommer in eller ändras, vid en bestämd tid eller med ett klick på en knapp, kör basedb igenom stegen: den väljer rätt gren, frågar AI, aviserar den som behövs. Och varje körning går att läsa igenom, steg för steg.',
			clock: '03:12',
			crumb: 'Försäljning / Automatiseringar',
			create: 'Ny automatisering',
			list: [
				{
					name: 'Ny förfrågan',
					when: 'En rad skapas',
				},
				{
					name: 'Offert signerad',
					when: 'En rad ändras',
				},
				{
					name: 'Påminnelser på måndagar',
					when: 'Varje måndag kl. 09:00',
				},
			],
			active: 'Aktiv',
			test: 'Testa på en rad',
			save: 'Spara',
			when: 'När',
			trigger: 'En rad skapas',
			table: 'I Förfrågningar',
			steps: {
				branch: {
					kind: 'Villkor',
					text: '2 grenar',
					run: 'gren ”Stort projekt”',
				},
				notify: {
					kind: 'Avisera någon',
					text: 'Léa Martin',
					run: '1 person aviserad',
				},
				create: {
					kind: 'Skapa en rad',
					text: 'Ett möte, i Kalender',
					run: 'klart',
				},
				slack: {
					kind: 'Skicka till Slack',
					text: 'I kanalen #forsaljning',
					run: 'klart',
				},
				ai: {
					kind: 'Fråga AI',
					text: 'Skriv ett första svar',
					run: 'svar på {n} tecken',
				},
				update: {
					kind: 'Redigera en rad',
					text: 'Svar, Steg',
					run: 'klart',
				},
			},
			paths: {
				big: 'Stort projekt',
				condition: 'budget gt 5000',
				otherwise: 'Annars',
			},
			answer: 'Hej, och tack för din förfrågan! Léa, som tar hand om din nya visuella identitet, ringer dig imorgon bitti.',
			addStep: 'Lägg till ett steg',
			tabs: {
				settings: 'Inställningar',
				runs: 'Körningar',
			},
			runsText: 'De 50 senaste, sparade i 30 dagar. Välj en för att se vilken gren den tog i flödet.',
			running: 'Pågår',
			succeeded: 'Lyckad',
			started: 'rad skapad · {when}',
			now: 'just nu',
			earlier: ['igår kl. 18:40', 'igår kl. 11:02'],
			done: 'Lyckad · 5 steg · 1,3 s',
			points: {
				when: {
					title: 'Vid rätt tillfälle',
					text: 'En rad som skapas eller ändras, en bestämd tid, en knapp – och ett villkor så att det bara körs när det behövs.',
				},
				paths: {
					title: 'Flera grenar',
					text: 'Ett villkor öppnar grenar, var och en med sina egna steg; det som ett steg hittar kan nästa steg referera till.',
				},
				copilot: {
					title: 'Beskriven i en mening',
					text: '”När en förfrågan kommer in, avisera Léa om budgeten överstiger 5 000 €”: Copiloten bygger flödet, du läser igenom det.',
				},
			},
			link: {
				href: '/fonctionnalites/automatisations/',
				label: 'Automatiseringar',
			},
		},
		glance: {
			eyebrow: 'Instrumentpaneler',
			title: 'Se allt.',
			titleAccent: 'Med en blick.',
			text: 'Siffror, kurvor, mål: dina instrumentpaneler byggs med musen från dina tabeller, och håller sig uppdaterade helt själva. Ett filter, och hela panelen följer med.',
			demo: {
				title: 'Försäljningsstyrning',
				filters: ['I år', 'Alla städer'],
				revenue: 'Omsättning',
				signed: 'Signerade offerter',
				rate: 'Signeringsgrad',
				goal: 'Årsmål',
				byMonth: 'Omsättning per månad',
				byStage: 'Offerter per steg',
				stages: ['Skickade', 'Under förhandling', 'Signerade'],
				bySector: 'Kunder per bransch',
				sectors: ['Handel', 'Vård', 'Utbildning', 'Industri'],
				shared: 'Delad via länk',
			},
			points: {
				viz: {
					title: 'Femton visualiseringar',
					text: 'Tal, trend, framsteg, kurvor, cirkeldiagram, tratt, pivottabeller, kartor.',
				},
				filters: {
					title: 'Gemensamma filter',
					text: 'Perioden, en kund, en stad: ett filter styr ett kort, flera, eller hela panelen.',
				},
				share: {
					title: 'Delad via länk',
					text: 'Offentlig eller förbehållen teamet, och kan bäddas in på en annan webbplats.',
				},
			},
			link: {
				href: '/fonctionnalites/tableaux-de-bord/',
				label: 'Instrumentpaneler',
			},
		},
		ai: {
			eyebrow: 'Artificiell intelligens',
			title: 'Beskriv.',
			titleAccent: 'basedb bygger.',
			text: 'En mening räcker för att få en komplett databas, som du läser igenom innan du skapar den. Sedan föreslår Copiloten filter, diagram och automatiseringar, och AI-fälten sammanfattar, klassificerar och skriver åt dig.',
			prompt: 'En uppföljning av ansökningar till våra tre lediga tjänster, med intervjuerna.',
			thinking: 'Tre kopplade tabeller, redo att läsas igenom.',
			tables: {
				jobs: {
					name: 'Tjänster',
					fields: ['Titel', 'Avdelning', 'Öppnad den'],
				},
				people: {
					name: 'Kandidater',
					fields: ['Namn', 'Tjänst', 'Steg', 'Sammanfattning'],
				},
				talks: {
					name: 'Intervjuer',
					fields: ['Kandidat', 'Datum', 'Med', 'Omdöme'],
				},
			},
			aiField: 'Sammanfattning',
			aiValue: 'Sex år inom projektledning, van vid kundkontakt; att gå djupare i: engelska.',
			create: 'Skapa databasen',
			providers: 'Med leverantören du väljer – OpenAI, Anthropic, Mistral, eller en modell installerad hos dig. Ingenting skickas utan ditt godkännande.',
			link: {
				href: '/fonctionnalites/ia/',
				label: 'AI i basedb',
			},
		},
		features: {
			title: 'Allt du behöver.',
			titleAccent: 'Och mycket mer.',
			text: 'Varje funktion skriver i samma tabeller, med samma behörigheter, i samma historik.',
			tiles: {
				views: {
					stat: '10',
					title: 'sätt att se dina data',
					text: 'Rutnät, kanban, kalender, tidslinje, galleri, lista, karta, formulär, enkät och quiz, på samma rader. Var och en väljer sitt.',
					href: '/fonctionnalites/vues/',
				},
				history: {
					stat: 'Ctrl+Z',
					title: 'Ingenting går förlorat',
					text: 'Varje ändring sparas med det tidigare värdet; ett misstag ångras, en borttagen rad återställs.',
					href: '/fonctionnalites/historique/',
				},
				forms: {
					title: 'Formulär',
					text: 'En offentlig länk eller en förbehållen teamet: varje svar hamnar i tabellen, utan att öppna resten.',
					href: '/fonctionnalites/formulaires-partages/',
				},
				viz: {
					stat: '15',
					title: 'visualiseringar',
					text: 'Tal, trender, mål, kurvor, sektorer, tratt, pivottabeller och kartor.',
					href: '/fonctionnalites/tableaux-de-bord/',
				},
				formulas: {
					code: 'IF([Montant] > 10000, "Grand compte", "")',
					title: 'Formler på franska eller engelska',
					text: 'Som i ett kalkylark – SI, ARRONDI, JOURS … eller IF, ROUND, DAYS – men beräknade för hela teamet.',
					href: '/fonctionnalites/tables-et-champs/#formler',
				},
				rights: {
					title: 'Var och en ser det hen ska se',
					text: 'Läsa, redigera, hantera, team för team; en känslig kolumn kan döljas.',
					href: '/fonctionnalites/droits/',
				},
				mentions: {
					bubble: '@Camille',
					title: 'Kommentarer och omnämnanden',
					text: 'Ni diskuterar en rad där den finns, och klockan meddelar.',
					href: '/fonctionnalites/collaboration/',
				},
				relations: {
					title: 'Allt är kopplat',
					text: 'Kunder, projekt, fakturor: summeringar och uppslag går genom relationerna.',
					href: '/fonctionnalites/tables-et-champs/',
				},
				templates: {
					stat: '10',
					title: 'färdiga mallar',
					text: 'CRM, rekrytering, lager, evenemang … eller en databas som du beskriver för AI i en mening.',
					href: '/modeles/',
				},
				import: {
					title: 'Import i ett drag',
					text: 'Släpp en Excel-arbetsbok eller en CSV-fil: kolumner och typer gissas fram, tabellen skapas.',
					href: '/guides/premiers-pas/',
				},
				agenda: {
					title: 'Ända in i din kalender',
					text: 'En kalender blir ett flöde för Google Kalender, Outlook eller Apple Kalender.',
					href: '/fonctionnalites/vues-partagees/',
				},
				files: {
					title: 'Filer och bilder',
					text: 'Offerter, foton, avtal; en bild blir omslaget på ett kort.',
					href: '/fonctionnalites/fichiers/',
				},
				share: {
					title: 'Delade vyer',
					text: 'En skrivskyddad vy via en länk, som kan bäddas in på din webbplats.',
					href: '/fonctionnalites/vues-partagees/',
				},
				sync: {
					title: 'Synkroniserade tabeller',
					text: 'Hålls uppdaterade från en CSV på nätet, en kalender eller en annan basedb.',
					href: '/integrations/synchronisation/',
				},
				signin: {
					title: 'Enkel inloggning',
					text: 'Google, Microsoft eller lösenord; du bjuder in dina kollegor via en länk.',
					href: '/hebergement/connexion/',
				},
				languages: {
					title: 'På ditt språk',
					text: 'Gränssnittet använder språket för var och en, av tjugo.',
					href: '/fonctionnalites/droits/#dina-inställningar',
				},
			},
		},
		yours: {
			eyebrow: 'Fri och självhostad',
			per: 'per person. För alltid.',
			text: 'basedb är fri programvara. Installera den på din server och bjud in hela teamet: ingen prenumeration, ingen licens att räkna, och dina data stannar hos dig.',
			points: {
				home: {
					title: 'Hos dig',
					text: 'På din egen server eller din leverantörs, säkerhetskopierad som varje PostgreSQL-databas.',
				},
				free: {
					title: 'Fri',
					text: 'Under licensen AGPL-3.0: koden är öppen, och kommer att förbli det.',
				},
				ai: {
					title: 'AI:n du väljer',
					text: 'En leverantör på marknaden, en modell installerad hos dig – eller ingen AI alls.',
				},
			},
			link: {
				href: '/guides/installation/',
				label: 'Installera basedb',
			},
		},
		gallery: {
			eyebrow: 'Mallar',
			title: 'Klar på en minut.',
			text: 'Utgå från en mall, med dess tabeller, vyer, instrumentpanel och exempelrader, och anpassa den sedan efter ditt sätt att arbeta.',
			use: 'Utforska',
			ask: {
				title: 'Passar ingen?',
				text: 'Beskriv ditt behov i en mening: AI föreslår en skräddarsydd databas.',
			},
			all: 'Se alla mallar',
			previous: 'Föregående mallar',
			next: 'Nästa mallar',
		},
		developers: {
			title: 'Och på den tekniska sidan?',
			text: 'Varje tabell är en riktig PostgreSQL-tabell. REST-API, webhooks, MCP-server för AI-agenter, och en installation med ett enda kommando.',
			link: 'Utvecklarsidan',
		},
		faq: {
			title: 'Dina frågor',
			items: [
				{
					q: 'Måste man kunna koda?',
					a: 'Nej. Du skapar dina tabeller, vyer, formulär, instrumentpaneler och automatiseringar med musen. Formlerna skrivs som i ett kalkylark, på franska eller engelska: SI eller IF, ARRONDI eller ROUND, JOURS eller DAYS…',
				},
				{
					q: 'Vad kostar det?',
					a: 'Ingenting: basedb är fri programvara, utan prenumeration eller pris per person. Du behöver bara en server att installera den på.',
				},
				{
					q: 'Hur installerar man den?',
					a: 'På en server, med Docker: två filer och ett kommando, några minuter för den som sköter din IT. Installationsguiden förklarar allt, steg för steg.',
				},
				{
					q: 'Kan vi återanvända våra kalkylark?',
					a: 'Ja: släpp din Excel-arbetsbok, eller en CSV, i basedb. Importen gissar typen för varje kolumn, skapar tabellen, och talar om rad för rad vad den inte kunde ta med.',
				},
				{
					q: 'Kan flera arbeta samtidigt?',
					a: 'Det är precis vad den är gjord för. De andras ändringar visas direkt, du kommenterar en rad, nämner en kollega med @, och en klocka aviserar.',
				},
				{
					q: 'Och läser AI våra data?',
					a: 'Bara om du bestämmer det. Utan en konfigurerad AI-leverantör skickas ingenting. Sedan skickar ett fält eller en automatisering som anropar AI bara det som dess instruktion citerar, efter ditt godkännande.',
				},
				{
					q: 'På vilket språk?',
					a: 'På ditt: gränssnittet använder webbläsarens språk, ett av tjugo, och var och en kan byta det i sina inställningar.',
				},
			],
		},
		cta: {
			title: 'Ditt team förtjänar bättre',
			titleAccent: 'än en delad fil.',
			text: 'Utgå från en mall, bjud in dina kollegor, och lämna ”SLUTGILTIG (2)” bakom dig.',
			primary: 'Utforska mallarna',
			secondary: 'Installera basedb',
		},
	},
	hero: {
		badge: 'Nytt: automatiseringar i flöden, instrumentpaneler och SQL-vyer',
		title: ['Databasen för samarbete', 'där varje tabell', 'är en riktig'],
		titleAccent: 'PostgreSQL-tabell.',
		lead: 'Enkelheten hos ett delat kalkylark – rutnät, vyer, formulär, behörigheter – och data som lever i tabeller som är <strong>typade och har läsbara namn</strong>. Ditt team arbetar i gränssnittet; dina skript, dina BI-verktyg, dina AI-agenter och <code>psql</code> läser samma rader.',
		install: 'Installera med Docker',
		features: 'Se funktionerna',
		copy: 'Kopiera kommandot',
		facts: ['Självhostad', 'AGPL-3.0', 'REST-API och MCP-server'],
		demo: {
			url: 'basedb.din-doman.se',
			project: 'Huvudprojekt',
			projectMeta: 'Projekt · 2 databaser',
			filter: 'Filtrera databaser och tabeller',
			sales: 'Försäljning',
			support: 'Support',
			environment: 'Produktion',
			clients: 'Kunder',
			opportunities: 'Affärsmöjligheter',
			quotes: 'Offerter',
			baseSection: 'Databas · Försäljning',
			screens: ['Instrumentpaneler', 'Automatiseringar'],
			copilot: '✦ Copilot',
			allRows: '▦ Alla rader ▾',
			tools: ['Filtrera', 'Gruppera', 'Färger'],
			search: 'Sök…',
			add: '+ Lägg till',
			columns: {
				name: 'Namn',
				status: 'Status',
				amount: 'Belopp',
				client: 'Kund',
			},
			statuses: {
				nouveau: 'Ny',
				qualifie: 'Kvalificerad',
				proposition: 'Offert',
				negociation: 'Förhandling',
				gagne: 'Vunnen',
				perdu: 'Förlorad',
			},
			deals: {
				portail: {
					name: 'Ny webbportal',
					client: 'Ekeby kommun',
				},
				erp: {
					name: 'ERP-migrering',
					client: 'Dahlgrenkoncernen',
				},
				audit: {
					name: 'Säkerhetsgranskning',
					client: 'Lindängskliniken',
				},
				billetterie: {
					name: 'Biljetter online',
					client: 'Torgteatern',
				},
				flotte: {
					name: 'Fordonsuppföljning',
					client: 'Kjellins Åkeri',
				},
				mobile: {
					name: 'Mobilapp',
					client: 'Studio Moberg',
				},
				intranet: {
					name: 'Nytt intranät',
					client: '',
				},
			},
			toastTitle: 'Formuläret ”Offertförfrågan”',
			toastText: 'offentligt svar · skapade ”{name}”',
			cursor: 'Camille',
			psqlRows: '(2 rader)',
		},
	},
	showcase: {
		label: 'Gränssnittet, på riktigt',
		title: 'Allt ditt team väntar sig av ett delat kalkylark.',
		tabs: 'Skärmbilder av gränssnittet',
		alt: 'basedb – {labelLower}: {caption}',
		shots: {
			grille: {
				label: 'Rutnät',
				caption: 'Ett rutnät som skriver i en riktig tabell – och beräknade fält: en formel ger en varaktighet, ett uppslag kundens ort, ett antal-fält antalet uppgifter.',
			},
			kanban: {
				label: 'Kanban',
				caption: 'Samma rader i kolumner, efter ett enkelval: en omslagsbild, en beskrivning som citerar raden. Att dra ett kort är att ändra raden.',
			},
			galerie: {
				label: 'Galleri',
				caption: 'Kort med sin bild, en färg per status: galleriet, ett av åtta sätt att läsa en tabell.',
			},
			chronologie: {
				label: 'Tidslinje',
				caption: 'Staplar mellan två datum, och pilar för deras beroenden – röda när ordningen inte längre håller.',
			},
			tableaux: {
				label: 'Instrumentpaneler',
				caption: 'Kort i rutnät, i flikar, under gemensamma filter: en trend, ett mål, staplade serier – lästa med var och ens behörigheter.',
			},
			automatisations: {
				label: 'Automatiseringar',
				caption: 'När en uppgift är klar: hitta det som återstår av projektet; om inget återstår skriver AI avslutningsordet och projektet går till ”Levererat”. Varje körning kan läsas i flödet, steg för steg.',
			},
			commentaires: {
				label: 'Kommentarer',
				caption: 'Diskutera en rad där den finns: kommentarer, omnämnanden, aviseringar.',
			},
			formulaire: {
				label: 'Formulär',
				caption: 'Ett formulär delas via en länk, offentlig eller förbehållen inloggade medlemmar.',
			},
			historique: {
				label: 'Historik',
				caption: 'Varje skrivning, var den än kommer ifrån – en person, en automatisering, direkt SQL – med de tidigare värdena.',
			},
			sql: {
				label: 'SQL',
				caption: 'En fråga på de riktiga namnen, sparad under tabellerna för hela teamet – som var och en kör med sina egna behörigheter.',
			},
			vuesSql: {
				label: 'SQL-vyer',
				caption: 'Riktiga PostgreSQL-vyer, placerade bland tabellerna med sin färg och sin ikon – och läsbara från psql.',
			},
		},
	},
	features: {
		postgres: {
			label: 'PostgreSQL, utan mellanlager',
			title: 'Ett rutnät för teamet, en riktig tabell {för dina verktyg.}',
			lead: 'Ingen generisk modell, ingen JSON som slasktratt, inga <code>field_1837</code>: en databas är ett schema, en tabell är en tabell, ett fält är en typad kolumn med ett läsbart namn.',
			bullets: [
				'<strong>Inbyggda typer</strong>: <code>text</code>, <code>numeric</code>, <code>date</code>, <code>timestamptz</code>, <code>boolean</code> – och riktiga främmande nycklar för relationerna.',
				'<strong>Villkor som databasen upprätthåller</strong>: enkelval som <code>CHECK</code>, kontrollerade webb- och e-postadresser, relationer som <code>FOREIGN KEY</code>.',
				'<strong>Formler som beräknas av PostgreSQL</strong>: <code>JOURS([Fin]; [Début])</code> blir en genererad kolumn, som <code>psql</code> läser som alla andra.',
				'<strong>Direkt SQL är fortfarande tillåtet</strong> – och till och med det hamnar i historiken, via en trigger.',
				'<strong>SQL-frågor och SQL-vyer</strong> i gränssnittet: frågor som sparas under tabellerna, för dig själv eller för teamet, och riktiga PostgreSQL-vyer placerade bland dem, som <code>psql</code> också läser.',
				'<strong>Att byta namn förstör inget</strong>: det gamla namnet fortsätter att fungera via ett kompatibilitetsalias medan du migrerar dina frågor.',
			],
			links: [
				{
					href: '/integrations/sql/',
					label: 'Arbeta i SQL',
				},
				{
					href: '/fonctionnalites/requetes-et-vues-sql/',
					label: 'SQL-frågor och SQL-vyer',
				},
				{
					href: '/architecture/principes/',
					label: 'Principerna',
				},
			],
		},
		automations: {
			label: 'Automatisera',
			title: 'Automatiseringar i flöden, {AI i varje steg.}',
			lead: 'När en rad ändras, vid en fast tid eller med ett klick: en grafredigerare kedjar ihop stegen, och varje körning kan granskas i flödet.',
			bullets: [
				'<strong>Ett läsbart flöde</strong>: utlösaren, sedan varje steg som ett kort; ett <strong>+</strong> på en linje lägger till ett steg just där.',
				'<strong>Hitta, besluta, skriva</strong>: hitta en rad, ta en gren eller en annan beroende på villkor, redigera, skapa, avisera, anropa en webhook, skicka till Slack.',
				'<strong>Fråga AI</strong> i ett steg: en instruktion som citerar raden, ett svar som tolkas som text, tal, datum eller val, och som följande steg återanvänder.',
				'<strong>Copilot</strong> föreslår en hel automatisering utifrån en enda mening, eller förklarar varför en körning misslyckades – inget sparas utan dig.',
				'<strong>Med behörigheterna hos den som skrev den</strong>, och i historiken som alla andra skrivningar.',
			],
			links: [
				{
					href: '/fonctionnalites/automatisations/',
					label: 'Automatiseringar',
				},
				{
					href: '/fonctionnalites/automatisations/#copilot',
					label: 'Copilot',
				},
			],
			alt: 'basedb – automatiseringen ”Projekt levererat” i flödesredigeraren: när en uppgift är klar, anteckna tiden, hitta det som återstår av projektet, ta grenen ”Annars”, fråga AI om avslutningsordet och leverera sedan projektet; till höger dess senaste körningar, steg för steg.',
		},
		dashboards: {
			label: 'Analysera',
			title: 'Instrumentpaneler {utan att lämna dina tabeller.}',
			lead: 'Frågor som ställs med musen eller i SQL, femton visualiseringar, gemensamma filter – var och en läser dem med sina egna behörigheter.',
			bullets: [
				'<strong>Frågor</strong>: en tabell, dess kopplingar, filter och mått per dag, vecka, månad eller år – eller skrivskyddad SQL.',
				'<strong>Femton visualiseringar</strong>: tal, trend, framsteg, mätare, staplar, kurvor, cirkeldiagram, tratt, pivottabell, karta …',
				'<strong>Utforska med ett klick</strong>: en punkt öppnar sina rader, eller en finare period.',
				'<strong>Gemensamma filter</strong> som styr ett, flera eller alla kort.',
				'<strong>Dela via en länk</strong>, offentlig eller bara för medlemmar, och bädda in på en annan webbplats.',
			],
			links: [
				{
					href: '/fonctionnalites/tableaux-de-bord/',
					label: 'Instrumentpaneler',
				},
			],
			alt: 'basedb – en instrumentpanel: månadens trend, ett inbetalningsmål, omsättning per månad, stämningen i omdömena, under filter för period och kund.',
		},
		rights: {
			label: 'Samarbeta utan att öppna allt',
			title: 'Behörigheter ända ned till fältet, {en historik utan luckor.}',
			lead: 'Behörigheter ges till grupper, på ett projekt, en databas eller en tabell, och gäller för allt som ligger under. En känslig kolumn kan döljas för en grupp, eller göras oredigerbar för den.',
			bullets: [
				'<strong>Fyra nivåer</strong>: Ingen åtkomst, Läsa, Redigera, Hantera – som läggs ihop från en grupp till en annan.',
				'<strong>Även SQL följer dina behörigheter</strong>: i gränssnittet ser en fråga bara de tabeller och fält som är öppna för dig – och det är PostgreSQL som tillämpar det.',
				'<strong>Varje skrivning fångas</strong> i sin transaktion: gränssnitt, API, agent, offentligt formulär eller direkt SQL.',
				'<strong>En ändring kan ångras</strong>, en borttagen rad återställas, och en borttagen databas likaså.',
				'<strong>Administration kräver bekräftelse</strong>: för att ändra en behörighet måste du ha skrivit in ditt lösenord på nytt under de senaste fem minuterna.',
			],
			links: [
				{
					href: '/fonctionnalites/droits/',
					label: 'Behörigheter och grupper',
				},
				{
					href: '/fonctionnalites/historique/',
					label: 'Historiken',
				},
			],
		},
		agents: {
			label: 'REST-API · MCP · webhooks',
			title: 'Dina AI-agenter når dina data, {inte nycklarna till huset.}',
			lead: 'MCP-servern ger agenterna tolv verktyg; REST-API:et ger dina program samma data. En enda punkt för behörighetskontroll, samma loggar.',
			bullets: [
				'<strong>En token per databas</strong>, skrivskyddad som standard, aldrig med fler behörigheter än personen som skapade den.',
				'<strong>En agent tar inte bort något</strong> och ändrar inte strukturen: den föreslår, en person godkänner.',
				'<strong>Genererad dokumentation</strong> för varje databas, filtrerad efter dina behörigheter, med sin OpenAPI 3.1-specifikation.',
				'<strong>Webhooks</strong> vid varje skrivning: signerade, ordnade och med nya försök.',
			],
			links: [
				{
					href: '/integrations/mcp/',
					label: 'Koppla in en agent',
				},
				{
					href: '/integrations/api-rest/',
					label: 'REST-API:et',
				},
			],
		},
	},
	sqlVisual: {
		interface: 'Gränssnitt',
		title: 'Nytt fält · Affärsmöjligheter',
		labelField: 'Etikett',
		labelValue: 'Belopp',
		typeField: 'Typ',
		typeValue: 'Tal',
		descriptionField: 'Beskrivning',
		descriptionValue: 'Kontraktets belopp exkl. moms',
		required: 'Obligatoriskt',
		ai: 'AI',
		migration: 'en planerad migrering, korta lås',
	},
	rightsVisual: {
		groups: ['Administratörer', 'Säljare', 'Support'],
		project: 'Huvudprojekt',
		sales: 'Försäljning',
		opportunities: 'Affärsmöjligheter',
		clients: 'Kunder',
		support: 'Support',
		inherited: 'ärvd',
		levels: {
			none: 'Ingen åtkomst',
			read: 'Läsa',
			edit: 'Redigera',
			manage: 'Hantera',
		},
		field: 'Fältet ”Marginal”',
		hidden: 'Dolt',
		sqlChange: '<b>Direkt SQL-session</b> ändrade <b>”ERP-migrering”</b>',
		sqlMeta: '02:46 · lokal anslutning · psql',
		sqlDiff: 'Belopp: <s>125 000</s> → 130 000',
		undo: '↶ Ångra',
		formChange: '<b>Formuläret ”Offertförfrågan”</b> skapade <b>”Nytt intranät”</b>',
		formMeta: 'offentligt svar · publicerat av Camille',
	},
	agentVisual: {
		agent: 'Agent',
		via: 'ansluten via MCP · token ”Försäljning”',
		question: 'Hur många affärsmöjligheter är under förhandling, och till vilket belopp?',
		listArgs: 'opportunites · statut = Förhandling',
		answer: 'Två affärsmöjligheter, <b>182 000 €</b> totalt: ERP-migrering (130 000 €) och Fordonsuppföljning (52 000 €).',
		request: 'Lägg till ett fält ”Sannolikhet” i procent.',
		proposeArgs: 'opportunites · Sannolikhet · number',
		proposed: 'Det är föreslaget: någon i teamet måste godkänna det i basedb.',
		badge: 'Förslag',
		expires: 'går ut om 23 h',
		what: 'Lägg till fältet <b>”Sannolikhet”</b> (Tal) i <b>Affärsmöjligheter</b>',
		by: 'Föreslaget av agenten · token ”Försäljning”',
		refuse: 'Avvisa',
		approve: 'Godkänn',
	},
	bento: {
		label: 'Och allt annat',
		title: 'Det du väntar dig av ett teamverktyg, utan att släppa PostgreSQL.',
		text: 'Varje funktion skriver i samma tabeller, under samma behörigheter, i samma historik.',
		more: 'Läs mer →',
		views: {
			title: 'Tio vyer på samma rader',
			text: 'Gemensamma för hela teamet, eller personliga för dig själv: var och en väljer sitt sätt att läsa, och ingen kopierar data.',
			chips: ['Rutnät', 'Kanban', 'Kalender', 'Tidslinje', 'Galleri', 'Lista', 'Karta', 'Formulär', 'Enkät', 'Quiz'],
		},
		forms: {
			title: 'Delade formulär',
			text: 'En offentlig länk, eller en som är förbehållen inloggade medlemmar. Att svara ger ingen behörighet till tabellen.',
			href: '/fonctionnalites/formulaires-partages/',
		},
		environments: {
			title: 'Miljöer',
			text: 'En databas, flera varianter. Jämför strukturen, migrera från den ena till den andra, synkronisera rader.',
			chips: ['Produktion', 'Test', 'Utveckling'],
			href: '/fonctionnalites/environnements/',
		},
		collaboration: {
			title: 'Arbeta tillsammans',
			text: 'De andras skrivningar kommer in i realtid, du ser vem som tittar på vilken rad, och ni diskuterar den där den finns: kommentarer, omnämnanden, aviseringar. Ctrl+Z ångrar den senaste skrivningen, och vägrar hellre än att skriva över någon annans arbete.',
			chips: ['Realtid', 'Närvaro', 'Kommentarer', 'Omnämnanden', 'Ctrl+Z'],
			href: '/fonctionnalites/collaboration/',
		},
		small: {
			ai: {
				title: 'AI i rutnätet',
				text: 'Ett fält som fylls i av en modell utifrån de andra kolumnerna, och en Copilot som föreslår filter, frågor och kolumner, som tillämpas med ett klick. OpenAI, Anthropic, Mistral, eller en modell som körs på din egen dator.',
				code: 'Sammanfatta {{Notes}} i en mening',
				href: '/fonctionnalites/ia/',
			},
			formulas: {
				title: 'Relationer och formler',
				text: 'Riktiga främmande nycklar, formler på franska eller engelska som beräknas av PostgreSQL, och uppslag, aggregeringar och antal genom relationerna.',
				code: 'ROUND([Montant HT] * (1 + [Taux de TVA]), 2)',
				href: '/fonctionnalites/tables-et-champs/#formler',
			},
			richText: {
				title: 'Formaterad text och variabler',
				text: 'En visuell redigerare för formaterad text, som saneras vid skrivning; och i all lång text läses {{Ville}} med radens värde.',
				code: 'Leverans {{Date}} i {{Ville}}',
				href: '/fonctionnalites/tables-et-champs/#formaterad-text-och-variabler',
			},
			languages: {
				title: 'På ditt språk',
				text: 'Gränssnittet använder webbläsarens språk, ett av tjugo; var och en kan byta det i sina inställningar.',
				href: '/fonctionnalites/droits/#dina-inställningar',
			},
			sharedViews: {
				title: 'Delade vyer',
				text: 'En skrivskyddad vy via en länk, som kan bäddas in på en annan webbplats; en kalender blir ett flöde för din kalenderapp.',
				href: '/fonctionnalites/vues-partagees/',
			},
			syncedTables: {
				title: 'Synkroniserade tabeller',
				text: 'En tabell som hålls uppdaterad från en CSV på nätet, en kalender eller en delad vy i en annan basedb.',
				href: '/integrations/synchronisation/',
			},
			templates: {
				title: 'Databasmallar',
				text: 'Tio färdiga mallar, en databas som du beskriver för AI i en mening, och din egen sparad som mall.',
				href: '/modeles/',
			},
			files: {
				title: 'Filer och bilder',
				text: 'På värdens disk eller i en S3-kompatibel lagring: AWS, Scaleway, OVH, Cloudflare R2, Garage, MinIO …',
				href: '/fonctionnalites/fichiers/',
			},
			import: {
				title: 'Import av Excel, CSV och JSON',
				text: 'Släpp en fil: importen gissar typerna, skapar tabellen eller fyller på en befintlig, och säger rad för rad vad som avvisas.',
				href: '/guides/premiers-pas/',
			},
			accounts: {
				title: 'Konton och inbjudningar',
				text: 'Var och en skapar sitt konto och sina projekt, och bjuder in via en länk med Läsa, Redigera eller Hantera; inloggning med lösenord, Google, Microsoft eller valfri OpenID Connect-leverantör.',
				href: '/hebergement/connexion/',
			},
			webhooks: {
				title: 'Webhooks',
				text: 'Varje skrivning kan meddela ett annat system: signerade nyttolaster, levererade i ordning, med nya försök.',
				href: '/integrations/webhooks/',
			},
			settings: {
				title: 'Personliga inställningar',
				text: 'Ditt språk, ditt tema, datumordningen, dina aviseringar, dina sessioner och dina tokens, på ett och samma ställe.',
				href: '/fonctionnalites/droits/#dina-inställningar',
			},
		},
	},
	selfHost: {
		label: 'Självhostad',
		title: 'Dina data stannar {hos dig.}',
		lead: 'basedb är fri programvara (AGPL-3.0): en enda avbildning, en PostgreSQL-databas, och det är allt – ingen påtvingad tredjepartstjänst, ingen telemetri. Säkerhetskopiera med <code>pg_dump</code>, läs med valfri PostgreSQL-klient.',
		services: {
			db: 'PostgreSQL 16, dina data',
			basedb: 'Gränssnittet, REST-API:et och MCP-servern, på en enda port',
			proxy: 'Caddy, automatisk HTTPS (valfritt)',
		},
		links: [
			{
				href: '/hebergement/docker/',
				label: 'Guide för Docker Compose →',
			},
			{
				href: '/hebergement/variables/',
				label: 'Alla variabler →',
			},
		],
		steps: [
			{
				title: 'Hämta basedb',
				code: 'git clone https://github.com/eodia/basedb.git\ncd basedb && cp .env.example .env',
			},
			{
				title: 'Två hemligheter i .env',
				code: 'POSTGRES_PASSWORD=ett-starkt-losenord\n# openssl rand -base64 32\nBASEDB_ENCRYPTION_KEY=…',
			},
			{
				title: 'Starta',
				code: 'docker compose up -d\n# sedan http://localhost:3000: skapa ditt konto',
			},
		],
	},
	faq: {
		label: 'Vanliga frågor',
		title: 'Det vi ofta får frågor om.',
		text: 'En annan fråga? <a href="/guides/introduction/">Dokumentationen</a> har säkert svaret.',
		items: {
			difference: {
				q: 'Hur skiljer sig basedb från andra databaser för samarbete?',
				a: 'Genom var data lever. Där andra lagrar dina rader i en generisk modell (numrerade kolumner, JSON-dokument) skapar basedb en riktig PostgreSQL-tabell per tabell och en riktig typad kolumn per fält, med läsbara namn. Dina data går att använda även utan basedb.',
			},
			sql: {
				q: 'Kan jag skriva direkt i tabellerna med SQL?',
				a: 'Ja. Villkoren (typer, obligatoriska fält, enkelval, främmande nycklar) upprätthålls av PostgreSQL själv, och en trigger registrerar även skrivningar som görs med direkt SQL i historiken, tillsammans med sessionen som gjorde dem. Gränssnittets SQL-konsol och psql läser samma tabeller; i gränssnittet skriver var och en SQL med sina egna behörigheter, sparar sina frågor och, om hen hanterar databasen, gör riktiga PostgreSQL-vyer av dem.',
			},
			ai: {
				q: 'Vad skickas till en AI-leverantör?',
				a: 'Ingenting så länge du inte har konfigurerat någon leverantör. Därefter skickas som standard bara strukturen och din mening, för strukturutkast och Copilot; att låta Copilot läsa data är en kryssruta, per konversation. En databasmall som du ber AI om skickar bara din mening. Ett AI-fält skickar de kolumner som dess instruktion citerar, efter ett uttryckligt samtycke.',
			},
			together: {
				q: 'Kan flera arbeta i samma tabell?',
				a: 'Ja. De andras skrivningar visas utan att sidan laddas om, med deras ansikte på tabellen eller raden de tittar på. Du kommenterar en rad, nämner någon med @, och klockan aviserar. Och Ctrl+Z ångrar bara dina egna skrivningar: det vägrar hellre än att skriva över det som någon annan har ändrat sedan dess.',
			},
			languages: {
				q: 'På vilka språk?',
				a: 'Tjugo: franska, engelska, tyska, spanska, italienska, brasiliansk portugisiska, nederländska, polska, tjeckiska, svenska, danska, norska, finska, rumänska, ungerska, turkiska, ukrainska, japanska, förenklad kinesiska och koreanska. Gränssnittet använder webbläsarens språk, och var och en kan byta i sina inställningar; den här webbplatsen och dokumentationen finns på samma språk.',
			},
			agent: {
				q: 'Hur ansluter en AI-agent?',
				a: 'Via MCP-servern, med en integrationstoken som är begränsad till en databas, skrivskyddad som standard. En agent läser, skapar och ändrar rader enligt sina behörigheter; den tar inte bort något och ändrar inte strukturen: den föreslår, och en person godkänner.',
			},
			postgres: {
				q: 'Vilken version av PostgreSQL behövs?',
				a: 'PostgreSQL 16 eller senare, med tilläggen pg_trgm och unaccent (tillgängliga i den officiella avbildningen). Den medföljande docker-compose-filen startar en PostgreSQL 16; du kan också peka DATABASE_URL mot din egen server.',
			},
			production: {
				q: 'Är det redo för produktion?',
				a: 'basedb är under aktiv utveckling: kärnan, API:et, MCP-servern och gränssnittet fungerar och täcks av mer än tusen tester, men vissa funktioner återstår (se färdplanen). Prova det, och säkerhetskopiera din databas som vilken PostgreSQL-databas som helst.',
			},
			license: {
				q: 'Under vilken licens?',
				a: 'AGPL-3.0-or-later. Du får använda, ändra och hosta det fritt; om du erbjuder en ändrad version som tjänst delar du dess källkod.',
			},
		},
	},
	cta: {
		title: 'Dina data förtjänar {riktiga tabeller.}',
		text: 'Installera basedb på några minuter, bjud in ditt team och behåll kontrollen över varje rad.',
		install: 'Installera basedb',
		github: 'Se koden på GitHub',
	},
	changelog: {
		label: 'Nyheter',
		title: 'Vad som har ändrats i basedb',
		intro: 'Detaljerna för varje ändring finns i <a href="https://github.com/eodia/basedb/commits/main">repots historik</a>. Vad som kommer härnäst: <a href="/feuille-de-route/">färdplanen</a>.',
		entries: {
			maps: {
				date: '2026-09-30',
				title: 'Kartan, och adresser som hittas',
				tag: 'Nytt',
				items: [
					'<strong>En tionde vy, kartan</strong>: varje rad placerad på sin plats, efter sin adress eller sin latitud och longitud. En nål får sin färg från en status och öppnar raddetaljerna med ett klick. <a href="/fonctionnalites/vues/#karta">Kartan</a>',
					'<strong>En adress lokaliseras en gång för alla</strong>, av OpenStreetMaps tjänst eller den du väljer: nålarna dyker upp allteftersom svaren kommer in, och sedan direkt. En adress som inte hittas räknas med, aldrig hoppas över i tysthet.',
					'<strong>Formatet Adress</strong> för en kort text: ett klick öppnar den på kartan, och i raddetaljerna föreslår <strong>Hitta adress</strong> de fullständiga adresser som matchar. <a href="/fonctionnalites/tables-et-champs/#visningsformat">Formaten</a>',
				],
			},
			documents: {
				date: '2026-09-30',
				title: 'PDF-filer från dina rader',
				tag: 'Nytt',
				items: [
					'<strong>En offert, en faktura, en sida i PDF</strong>, från en rads meny: raddetaljerna för utskrift utan att ställa in något, eller en mall — texter som citerar fälten, radens fält, tabellen med länkade rader och dess totalsumma, sidbrytningar. <a href="/fonctionnalites/documents/">Dokumenten</a>',
					'<strong>Var och en med sina behörigheter</strong>: ett fält som är dolt för dig finns inte i din PDF. Alla tjugo språken skrivs där, kinesiska, japanska och koreanska inräknade, och API:et returnerar samma dokument.',
				],
			},
			rows: {
				date: '2026-09-30',
				title: 'Behörigheter ända ned till raden, standardvärden, Excel-import',
				tag: 'Nytt',
				items: [
					'<strong>Var sina rader</strong>: en grupp ser bara raderna för ett filter — ”Säljare” är jag, ”Region” är Norr —, i gränssnittet, i API:et, i MCP-servern liksom i SQL, där PostgreSQL tillämpar samma regel. <a href="/fonctionnalites/droits/#ända-ned-till-raden">Ända ned till raden</a>',
					'<strong>Standardvärden</strong>: ett fast värde, dagens datum, tidpunkten för skapandet eller personen som skapar raden, förifyllda på skärmen och tillämpade överallt annars. <a href="/fonctionnalites/tables-et-champs/#standardvärden">Standardvärden</a>',
					'<strong>Dra in en Excel-arbetsbok</strong>: välj bladet, datum, belopp och kryssrutor kommer som de är, och en formel ger sitt värde. <a href="/guides/premiers-pas/">Kom igång</a>',
				],
			},
			mail: {
				date: '2026-09-30',
				title: 'E-post',
				tag: 'Nytt',
				items: [
					'<strong>Ett steg ”Skicka e-post”</strong> i automatiseringarna: till en medlem, till personen i ett fält, till en kunds adress, med radens värden i ämnet och texten. <a href="/fonctionnalites/automatisations/">Automatiseringarna</a>',
					'<strong>Aviseringar via e-post</strong> när du inte har läst dem, samlade i en, att välja en och en i dina inställningar; och <strong>Glömt lösenord</strong> återställs med en länk. <a href="/fonctionnalites/collaboration/#via-e-post">Via e-post</a>',
					'Det räcker att ange sändningsservern för din e-post åt instansen. <a href="/hebergement/variables/#e-post">Variablerna</a>',
				],
			},
			integrations: {
				date: '2026-09-30',
				title: 'n8n och en TypeScript-SDK',
				tag: 'Nytt',
				items: [
					'<strong>Noder för n8n</strong>: läsa och skriva en tabells rader från ett arbetsflöde, och starta ett för varje rad som skapas, ändras eller tas bort — genom avläsning eller signerad webhook. <a href="/integrations/n8n/">n8n</a>',
					'<strong>En TypeScript-SDK</strong>, med typer för dina tabeller genererade från din instans: en tabell eller ett fält som inte finns är ett fel, redan innan programmet körs. <a href="/integrations/sdk/">SDK:n</a>',
				],
			},
			quiz: {
				date: '2026-09-29',
				title: 'Quiz: frågor som räknar poäng',
				tag: 'Nytt',
				items: [
					'<strong>En ny vy, quizet</strong>: en enkät där varje fråga kan ha sitt rätta svar och sina poäng – ett val, flera, ja eller nej, ett tal, ett datum, eller de godkända texterna, utan hänsyn till versaler eller diakritiska tecken. <a href="/fonctionnalites/vues/#quiz">Quizet</a>',
					'<strong>Rättat som du vill</strong>: efter varje fråga – i grönt, eller i rött med det rätta svaret, poängen som växer högst upp på skärmen –, i slutet, eller aldrig. En gräns för godkänt gör att det står ”Godkänt!” eller ”Inte den här gången…”.',
					'<strong>Poängen i slutet</strong>, i en ring som fylls, sedan facit för varje fråga. Den skrivs i ett talfält i tabellen: sortera rutnätet efter det, där är rankningen.',
					'<strong>Delat via en länk, utan att kunna fuska</strong>: sidan tar inte emot något rätt svar, det är servern som rättar och räknar. <a href="/fonctionnalites/formulaires-partages/#ett-delat-quiz">Ett delat quiz</a>',
					'<strong>Skapa en vy</strong>, längst ned i vyväljaren, delar in de nio sorterna i två familjer – de som visar raderna, de som samlar svar –, var och en med sin egen färgade ikon.',
				],
			},
			forms: {
				date: '2026-09-29',
				title: 'Formulär man har lust att fylla i',
				tag: 'Nytt',
				items: [
					'<strong>Enkäten tar upp hela skärmen</strong>: en fråga i taget, som glider in, stora kort för valen, stjärnor för ett betyg, och allt med tangentbordet — <strong>Enter</strong>, bokstäverna A, B, C…, J eller N, siffrorna. Ett enda val går vidare av sig själv. <a href="/fonctionnalites/vues/#formulär-och-enkät">Formulär och enkät</a>',
					'<strong>Ett eget utseende</strong>: åtta teman, från Ljust till Natt via Papper, en färg, ett typsnitt, en justering — sidan för en delad länk bär det också.',
					'<strong>Fråga endast om…</strong>: en fråga ställs bara om ett tidigare svar kräver det; en dold fråga är varken obligatorisk eller sparad.',
					'<strong>Inget att ställa in för att börja</strong>: ett nytt formulär frågar vad en person svarar, inte statusen som teamet fyller i senare, bär färgen från sin tabell och visar ett exempel i varje fält. Och att skicka in firas, konfetti inräknat.',
				],
			},
			formulaLanguages: {
				date: '2026-09-28',
				title: 'Formler på franska eller engelska',
				tag: 'Nytt',
				items: [
					'<strong>Skriv en formel på franska eller engelska</strong>, på vilken skärm som helst, även genom att blanda de två: <code>SI</code> eller <code>IF</code>, <code>ARRONDI</code> eller <code>ROUND</code>, <code>JOURS</code> eller <code>DAYS</code>… Argumenten skiljs åt med <code>;</code> eller med <code>,</code>. <a href="/fonctionnalites/tables-et-champs/#formler">Formlerna</a>',
					'<strong>Den läses tillbaka på skärmens språk</strong>: på franska på en fransk skärm, på engelska i de nitton andra språken – befintliga formler och panelen ”Funktioner” inräknade. API:et returnerar en formel på det begärda språket, annars på engelska.',
					'De officiella mallarna, som erbjuds på ett annat språk än franska, kommer med sina formler på engelska. Ingenting ändras i databasen: samma kolumner, samma SQL, utan migrering.',
				],
			},
			search: {
				date: '2026-09-27',
				title: 'Hitta allt: Ctrl+K',
				tag: 'Nytt',
				items: [
					'<strong>Ett enda fält för allt</strong> — <strong>Ctrl+K</strong>, eller fältet mitt i listen högst upp: tabeller, vyer, frågor, instrumentpaneler, automatiseringar, kolumner, och raderna själva, lästa med dina behörigheter; på en stor skärm förhandsgranskningen av det valda resultatet. <a href="/fonctionnalites/recherche/">Sökning</a>',
					'<strong>Skriv som du tänker</strong>: utan accenter eller versaler, med initialer — <code>nk</code> för ”Ny kund” —, ett överseende med skrivfel, <code>kunder göteborg</code> för att söka efter ”göteborg” i kundtabellen; det du öppnar ofta stiger upp till toppen.',
					'<strong>Alla kommandon via tangentbordet</strong>: skapa, gå till, stänga, ångra, byta tema, kopiera länken till sidan. <code>&gt;</code> söker bara bland kommandon, <code>#</code> objekt, <code>/</code> rader; <strong>Tab</strong> söker inuti en tabell eller databas.',
					'<strong>En fråga?</strong> Skriv den: <strong>Fråga Copilot</strong> ställer den, på den öppna databasen.',
				],
			},
			questions: {
				date: '2026-09-27',
				title: 'Egna frågor, tal i texten',
				tag: 'Nytt',
				items: [
					'<strong>Var och en sparar sina egna frågor</strong>, utan nivån Hantera: personliga ser bara du; den som hanterar databasen delar dem med hela databasen eller med grupper, som sparade frågor. <a href="/fonctionnalites/tableaux-de-bord/">Instrumentpaneler</a>',
					'<strong>En fråga på en flik</strong>, bredvid tabellerna: <strong>Ny fråga</strong> och <strong>Ny SQL-fråga</strong>, vid <strong>+</strong> i flikfältet och i databasens meny; fliken behåller det du lämnat i den. <strong>Spara en kopia</strong> gör en fråga du inte får ändra till din egen.',
					'<strong>Tal i texten</strong>: en instrumentpanels text, numera formaterad, citerar ett värde — <code>{{chiffre_affaires}}</code> — hämtat från ett kort, en fråga eller ett filter, beräknat med läsarens behörigheter, även i en instrumentpanel som delats via en länk. <a href="/fonctionnalites/tableaux-de-bord/#tal-i-texten">Tal i texten</a>',
					'Sparade frågor, SQL-vyer och frågor kan också tas bort från sin meny, med ett högerklick.',
				],
			},
			addresses: {
				date: '2026-09-27',
				title: 'En adress för varje skärm',
				tag: 'Nytt',
				items: [
					'<strong>Adressen följer skärmen</strong>: en tabell, en vy, raddetaljerna för en rad, en instrumentpanel, en automatisering, en fråga, dina inställningar — <code>/bases/ventes/tables/opportunites?ligne=…</code>. Lägg den som bokmärke, klistra in den i ett meddelande: du hamnar på samma ställe, med dina egna behörigheter. <a href="/fonctionnalites/collaboration/#en-länk-till-varje-skärm">En länk till varje skärm</a>',
					'Webbläsarens knappar <strong>bakåt</strong> och <strong>framåt</strong> tar dig tillbaka dit du var; en adress som inte leder någonstans visar ”Den här sidan finns inte”.',
				],
			},
			demo: {
				date: '2026-09-27',
				title: 'En demo att prova, på ditt språk',
				tag: 'Nytt',
				items: [
					'<strong>Demot</strong>, på <a href="https://demo.basedb.eodia.com">demo.basedb.eodia.com</a>: kontot är förifyllt på din webbläsares språk, med en databas på det språket. Där kan man läsa allt och ändra det som finns; skapande, borttagning och AI är avstängda, och databasen återgår varje natt till sitt ursprungliga skick.',
					'<strong>Ditt eget demo</strong>: <code>BASEDB_DEMO=1</code> öppnar en instans för alla, med ett delat konto per språk, förberett i förväg. <a href="/hebergement/variables/#offentlig-demo">Variablerna</a>',
					'<strong>Ett språk per länk</strong>: <code>?lang=de</code> i slutet av en basedb-adress visar inloggningsskärmen eller en delad sida på tyska; på så sätt leder webbplatsen till demot på sidans språk. <a href="/fonctionnalites/droits/#dina-inställningar">Dina inställningar</a>',
				],
			},
			templateLanguages: {
				date: '2026-09-27',
				title: 'Mallarna på ditt språk',
				tag: 'Nytt',
				items: [
					'<strong>De officiella mallarna skapas på skärmens språk</strong>: tabeller, fält, val, vyer, instrumentpaneler, automatiseringar, AI-instruktioner — och exempelrader från en värld anpassad till varje språk: det franska bageriet ”Boulangerie Martin” i Lyon blir ”Martins bageri” i Göteborg. <a href="/fonctionnalites/modeles/#på-ditt-språk">Mallarna</a>',
					'<a href="/modeles/">Webbplatsens galleri</a> visar varje mall på sidans språk.',
					'<strong>En mall, flera ordböcker</strong>: en mall skrivs en gång, på franska; varje språk översätter bara texterna i den, och basedb följer själv varje etikett där den citeras. En ordbok som skulle förstöra mallen används inte. <a href="/fonctionnalites/modeles/#publicera-en-mall-för-alla-instanser">Publicera en mall</a>',
				],
			},
			details: {
				date: '2026-09-27',
				title: 'Dessutom',
				items: [
					'<strong>En mall utan sina exempelrader</strong>: ”Läs in exempeldata”, avbockad, skapar tomma tabeller, redo för dina egna data. <a href="/fonctionnalites/modeles/#utgå-från-en-mall">Utgå från en mall</a>',
					'<strong>API- och MCP-dokumentationen</strong> för varje databas skrivs på din skärms språk. <a href="/integrations/api-rest/#den-genererade-dokumentationen">Den genererade dokumentationen</a>',
					'Verktygstips i applikationens tema, överallt där webbläsaren tidigare visade sina egna; ”Ta bort” i menyerna i rött; det fullständiga datumet vid hovring över tiden för en kommentar.',
				],
			},
			languages: {
				date: '2026-09-27',
				title: 'Formaterad text, variabler, en mer lättläst kanban',
				tag: 'Nytt',
				items: [
					'<strong>Formaterad text</strong>: en ny fälttyp, formaterad i en visuell redigerare – rubriker, listor, citat, länkar –, sanerad vid skrivning och skyddad av ett villkor mot direkt SQL. <a href="/fonctionnalites/tables-et-champs/#formaterad-text-och-variabler">Formaterad text och variabler</a>',
					'<strong>Variabler</strong>: en lång text citerar en kolumn i sin rad – <code>{{Ville}}</code> – och läses överallt med dess värde: rutnät, raddetaljer, API, MCP-server, delade vyer, automatiseringar. Kolumnen behåller citatet, och det är det som <code>psql</code> läser.',
					'<strong>En mer lättläst kanban</strong>: luftigare kort, en omslagsbild och en beskrivning som citerar radens värden – ”Leverans {{Date}} till {{Client}}”. <a href="/fonctionnalites/vues/">Vyerna</a>',
					'<strong>Byt namn i ett steg</strong>: en enda dialogruta för en databas, en tabell eller ett fält; etiketten ändras alltid, och en administratör kan också byta namn i databasen, med stöd av en konsekvensanalys. <a href="/fonctionnalites/tables-et-champs/#ändra-strukturen">Ändra strukturen</a>',
					'<strong>Tjugo språk</strong>: gränssnittet, den här webbplatsen och dokumentationen på franska, engelska, tyska, spanska, italienska, portugisiska (Brasilien), nederländska, polska, tjeckiska, svenska, danska, norska, finska, rumänska, ungerska, turkiska, ukrainska, japanska, förenklad kinesiska och koreanska. basedb använder webbläsarens språk; <strong>Inställningar › Utseende › Språk</strong> väljer ett annat, som följer dig från en dator till en annan. Tal och datum följer språket. <a href="/fonctionnalites/droits/#dina-inställningar">Dina inställningar</a>',
				],
			},
			aiProvider: {
				date: '2026-09-27',
				title: 'AI:n du väljer, ända till din egen dator',
				tag: 'Nytt',
				items: [
					'<strong>En fjärde AI-leverantör</strong>: alla servrar som talar OpenAI:s API – Azure, en företagsgateway, en modell som körs på din egen dator – angiven i <code>.env</code>. Anropsloggen visar vem uppgifterna gick till. <a href="/fonctionnalites/ia/">AI i basedb</a>',
					'<strong>Inloggningsskärmen</strong> visar nu, efter rutnätet och SQL, en instrumentpanel som följer ett filter och en automatisering som körs, AI-steget inräknat.',
				],
			},
			flows: {
				date: '2026-09-27',
				title: 'Automatiseringar i flöden',
				tag: 'Nytt',
				items: [
					'<strong>En grafredigerare</strong>: utlösaren, sedan varje steg som ett kort; ett <strong>+</strong> på en linje lägger till ett steg just där. En enkel automatisering ryms fortfarande på två kort. <a href="/fonctionnalites/automatisations/">Automatiseringar</a>',
					'<strong>Hitta en rad</strong> – kunden för en order, den senaste obetalda fakturan – och sedan ändra den, citera den eller koppla den till en nyskapad rad.',
					'<strong>Villkor med flera grenar</strong>: den första vars villkor är uppfyllt tas, ”Annars” när inget är det; grenarna går sedan ihop igen.',
					'<strong>Data går från ett steg till nästa</strong>: <code>{{e2.client}}</code> citerar det som ett steg har hittat eller skapat, <code>{{e3.reponse.numero}}</code> det som en webhook svarade; menyn i varje text erbjuder bara det som med säkerhet har hänt tidigare.',
					'<strong>Varje körning, steg för steg</strong>: lagd ovanpå flödet visar den vilken gren som togs och berättar, för varje steg, vad det gjorde och hur lång tid det tog.',
					'<strong>Copilot för automatiseringar</strong>: beskriv vad databasen ska göra av sig själv, eller fråga varför en körning misslyckades; den föreslår en hel automatisering, som du placerar i flödet med ett klick, granskar och sedan sparar – inget sparas utan dig. <a href="/fonctionnalites/automatisations/#copilot">Copilot</a>',
					'<strong>Fråga AI</strong> i ett steg, som i ett AI-fält: en instruktion som citerar raden och de tidigare stegen, ett svar som tolkas som text, tal, ja eller nej, datum eller val i en lista, och som följande steg skriver eller skickar. <a href="/fonctionnalites/automatisations/#fråga-ai">Fråga AI</a>',
				],
			},
			dashboards: {
				date: '2026-09-27',
				title: 'Instrumentpaneler: frågor, diagram, filter',
				tag: 'Nytt',
				items: [
					'<strong>Frågor</strong> som ställs med musen – en tabell, dess kopplingar, filter, mått per dag, vecka, månad eller år – eller skrivs i <strong>SQL</strong>, skrivskyddat och med dina egna behörigheter, variabler inräknade. <a href="/fonctionnalites/tableaux-de-bord/">Instrumentpaneler</a>',
					'<strong>Femton visualiseringar</strong>: tal, trend jämfört med föregående period, framsteg mot ett mål, mätare, kolumndiagram, stapeldiagram, linjediagram, ytdiagram, kombinerat, cirkeldiagram, tratt, punktdiagram, tabell, pivottabell, karta över Frankrike eller världen.',
					'<strong>Utforska med ett klick</strong>: en punkt öppnar sina rader, en finare period, en annan fördelning.',
					'<strong>Instrumentpaneler i rutnät</strong>: kort som flyttas och ändrar storlek med musen, flikar, avsnittsrubriker, texter, inbäddade sidor.',
					'<strong>Gemensamma filter</strong> – period, kategori, text, tal, datumgruppering – som styr ett, flera eller alla kort, med ett standardvärde.',
					'<strong>Diagram som du vill ha dem</strong>: färg och namn för varje serie eller andel, ring, halvcirkel eller rosdiagram, stapling med summor, utjämnade kurvor eller trappkurvor, axlar, skalstreck, logaritmisk skala; tabeller med omdöpta kolumner, med staplar och färger efter värdet.',
					'<strong>Copilot för instrumentpaneler</strong>: en konversation som föreslår frågor, ändringar av panelen – som kan ångras – och värden för dess filter, som tillämpas med ett klick. Bara strukturen går till leverantören, om du inte låter den läsa resultaten. <a href="/fonctionnalites/tableaux-de-bord/#copilot">Copilot</a>',
					'<strong>Dela en instrumentpanel</strong> via en länk, offentlig eller förbehållen medlemmar – vid behov vissa grupper – och bädda in den på en annan webbplats: kort och filter skrivskyddade, lästa med behörigheterna hos den som publicerade den. <a href="/fonctionnalites/tableaux-de-bord/#dela-en-instrumentpanel">Dela</a>',
					'”Gränssnitt” heter nu <strong>Instrumentpaneler</strong>; befintliga paneler öppnas som de är, i det nya rutnätet.',
				],
			},
			sqlViews: {
				date: '2026-09-27',
				title: 'Sparade frågor och SQL-vyer',
				tag: 'Nytt',
				items: [
					'<strong>SQL för alla</strong>: utan nivån Hantera körs en SQL-flik skrivskyddat, med dina egna behörigheter, som tillämpas av PostgreSQL själv – en stängd tabell finns inte, ett dolt fält avvisas. Etiketten ”Dina behörigheter” påminner om det. <a href="/fonctionnalites/requetes-et-vues-sql/">SQL-frågor och SQL-vyer</a>',
					'<strong>Sparade frågor</strong>, placerade under tabellerna i avsnittet ”Frågor”: personliga, för hela databasen eller för grupper. Att dela en fråga delar dess text, aldrig det som dess författare kan läsa; öppnad från sidofältet körs den genast, skrivskyddat.',
					'<strong>SQL-vyer</strong>: riktiga PostgreSQL-vyer, placerade bland tabellerna med en färg, en ikon och ett litet öga, läsbara även från <code>psql</code> och dina verktyg. Var och en läser dem med sina egna behörigheter, och sidofältet visar dem bara för den som kan läsa allt i dem.',
					'Vyerna följer strukturen: ett namnbyte förstör dem inte, en ändrad formel tar bort dem en stund och lägger sedan tillbaka dem; en vy som inte längre håller ligger kvar att rätta, med sin definition sparad.',
				],
			},
			settings: {
				date: '2026-09-27',
				title: 'Dina inställningar',
				tag: 'Nytt',
				items: [
					'<strong>Inställningar</strong>, i profilmenyn: ditt namn, din adress och de identitetsleverantörer som är kopplade till ditt konto; ditt lösenord och dina öppna sessioner. <a href="/fonctionnalites/droits/">Konton och inloggning</a>',
					'<strong>Utseende</strong>: temat, datumordningen – <code>25/09/2026</code> eller <code>2026-09-25</code> – och kalendrarnas första veckodag; de två sista följer dig från en dator till en annan.',
					'<strong>Aviseringar</strong>: tacka nej till dem du inte längre vill ha, en typ i taget. <strong>Tokens</strong>: de du har skapat, i alla dina databaser, när de senast användes, och återkallelse av dem.',
				],
			},
			v020: {
				date: '2026-09-26',
				title: 'Version 0.2.0: eget konto, egna projekt, egna inbjudningar',
				tag: 'Nytt',
				items: [
					'<strong>Första inloggningen</strong>: på en ny instans skapar den första sidan administratörskontot, med din adress och ditt lösenord – inget standardkonto längre, inget lösenord att leta fram i loggarna. <a href="/guides/installation/">Installationen</a>',
					'<strong>Skapa konton</strong>: var och en skapar sitt konto och sedan sina egna projekt, som hen därmed hanterar. Administrationen kan stänga möjligheten eller begränsa den till vissa domäner. <a href="/hebergement/connexion/">Konton och inloggning</a>',
					'<strong>Dela ett projekt eller en databas</strong>: den som har nivån Hantera bjuder in via en länk, med Läsa, Redigera eller Hantera; ser vem som har åtkomst, ändrar en nivå, tar bort den. Aldrig mer än det hen hanterar.',
					'<strong>Integritet</strong>: var och en ser nu bara de personer hen delar ett projekt med, och ett projektnamn som någon annan redan har tagit går inte längre att gissa sig till.',
					'<strong>Inloggning med Google, Microsoft</strong> och valfri OpenID Connect-leverantör (Keycloak, GitLab …), angivna i <code>.env</code>; en första inloggning skapar kontot om kontoskapandet tillåter det. <a href="/hebergement/connexion/">Konfigurera</a>',
					'<strong>Ny inloggningsskärm</strong>, i programmets tema, ljust eller mörkt, och återhållsamt animerad; illustrerade tomma skärmar i programmet.',
					'<strong>Uppdateringar utan förlust</strong>: basedb uppdaterar sin katalog själv vid start, även en 0.1-installation, och vägrar starta på en databas som en nyare version redan har uppdaterat. <a href="/hebergement/sauvegardes/">Uppdatera</a>',
				],
			},
			dockerImage: {
				date: '2026-09-26',
				title: 'En enda Docker-avbildning',
				tag: 'Drift',
				items: [
					'basedb ryms i <strong>en enda avbildning</strong>, <code>eodia/basedb</code> på Docker Hub, för amd64 och arm64: gränssnittet, API:et under <code>/api</code> och MCP-servern under <code>/mcp</code>, på <strong>en enda port</strong>. <a href="/guides/installation/">Installationen</a>',
					'Två filer räcker – <code>docker-compose.yml</code> och <code>.env</code> – utan att klona repot eller bygga något; uppdateringen görs med <code>docker compose pull</code>.',
					'Bakom en domän behöver HTTPS-proxyn inte längre dirigera något: allt går till port 3000.',
				],
			},
			automations: {
				date: '2026-09-26',
				title: 'Automatiseringar, gränssnitt, formler, samarbete',
				tag: 'Nytt',
				items: [
					'<strong>Formler</strong> på franska – <code>SI</code>, <code>ARRONDI</code>, <code>JOURS</code> … – som blir kolumner genererade av PostgreSQL; <strong>uppslag</strong>, <strong>aggregeringar</strong> och <strong>antal</strong> genom relationerna. <a href="/fonctionnalites/tables-et-champs/">Fälten</a>',
					'<strong>Nya typer</strong>: multipel relation, person, e-post, autonummer, knapp; och format som väljs som typer – valuta, procent, varaktighet, betyg i stjärnor, telefon, streckkod.',
					'<strong>Åtta vyer</strong>: <strong>galleri</strong> och <strong>lista</strong> ansluter till de sex andra; <strong>personliga vyer</strong> för alla läsare, låsta vyer, manuell ordning, beroenden i tidslinjen. <a href="/fonctionnalites/vues/">Vyerna</a>',
					'<strong>Rutnätet</strong>: snabbsökning, gruppering, sammanfattning per kolumn över hela filtret, färger efter regler, radhöjd.',
					'<strong>Delade vyer</strong>, skrivskyddade, som kan bäddas in på en annan webbplats; en kalender blir ett <strong>iCalendar-flöde</strong> för Google Kalender, Outlook eller Apple Kalender. <a href="/fonctionnalites/vues-partagees/">Delning</a>',
					'<strong>Samarbete</strong>: kommentarer och omnämnanden, aviseringar, de andras skrivningar i realtid, närvaro i tabellen och på raden. <a href="/fonctionnalites/collaboration/">Arbeta tillsammans</a>',
					'<strong>Ctrl+Z</strong> ångrar den senaste skrivningen – en cell, ett flyttat kort, en hel import – och vägrar hellre än att skriva över det som någon annan har ändrat sedan dess.',
					'<strong>Automatiseringar</strong>: när en rad skapas eller ändras, vid en fast tid eller med ett klick på en knapp – redigera, skapa, avisera, anropa en webhook, skicka till Slack. <a href="/fonctionnalites/automatisations/">Automatisera</a>',
					'<strong>Gränssnitt</strong>: instrumentpaneler – tal, diagram, listor, texter – som läses med var och ens behörigheter. <a href="/fonctionnalites/tableaux-de-bord/">Instrumentpaneler</a>',
					'<strong>Integrationer</strong>: en Slack-kanal, och <strong>synkroniserade tabeller</strong> från en CSV på nätet, en kalender eller en vy i en annan basedb. <a href="/integrations/synchronisation/">Integrationerna</a>',
					'<strong>Databasmallar</strong>: ett galleri med tio mallar, en databas som du beskriver för AI i en mening, och varje databas kan sparas som mall. <a href="/modeles/">Galleriet</a>',
					'<strong>Behörigheter</strong>: skärmen Struktur blir skrivskyddad för den som inte har nivån Hantera.',
					'<strong>Ny identitet</strong>: en logotyp, en palett och en omgjord inloggningsskärm.',
				],
			},
			simpler: {
				date: '2026-09-26',
				title: 'Ett enklare gränssnitt',
				items: [
					'<strong>Sidofältet</strong> listar nu bara databaserna och deras tabeller; den öppna databasens skärmar – Struktur, Historik, Gränssnitt, Automatiseringar – är samlade i ett block, strax ovanför profilen.',
					'<strong>Profilmenyn</strong> rymmer det som inte är data: API- och MCP-dokumentationen, integrationerna, användarna och behörigheterna.',
					'<strong>En SQL-fråga</strong> öppnas med ”+” i flikfältet eller från databasens meny, utan dubblett i sidofältet.',
					'<strong>Ny databas</strong> erbjuder mallarna och AI direkt i dialogrutan; demodatabasen går via samma galleri.',
					'<strong>Skärmen erbjuder inte längre det som skulle avvisas</strong>: inga strukturknappar utan Hantera, inget ”Ta bort” utan rätt att ta bort; och en läsare skapar sina egna vyer i stället för att stöta på ett felmeddelande.',
					'<strong>Systemkolumnerna</strong> ligger under ”Systeminformation” i stället för att erbjudas i varje tabell.',
					'<strong>Raddetaljerna</strong> får sina kommentarer, en knapp för att mejla eller ringa, och ett betyg som sätts med ett klick.',
					'<strong>Inloggningen</strong> överger sin animerade 3D-bakgrund för en lätt skärm, som respekterar inställningen ”minska rörelse”.',
				],
			},
			environments: {
				date: '2026-09-26',
				title: 'Miljöer, delade formulär, vyer',
				items: [
					'<strong>Miljöer</strong>: produktion, test och utveckling för samma databas; jämförelse sida vid sida, migreringsplan, synkronisering av rader.',
					'<strong>Strukturhistorik</strong>: varje skapande eller ändring av en tabell eller ett fält, fångad av en trigger på katalogen.',
					'<strong>Delade formulär</strong>: en offentlig länk eller en för medlemmar, stängning efter datum eller antal svar, svaren tillskrivna i historiken.',
					'<strong>Sex vyer</strong>: rutnät, kanban, kalender, tidslinje, formulär, enkät.',
					'<strong>Datahistorik</strong>: ångra en ändring, återställ en borttagen rad.',
					'<strong>AI</strong>: AI-alternativet på valfritt fält, och Copilot.',
					'<strong>Relation</strong> och <strong>URL</strong>: två separata typer; lång text skrivs i Markdown.',
					'<strong>Webhooks</strong>, signerade och ordnade; <strong>agenternas förslag</strong> att godkänna.',
					'<strong>Docker</strong>: en Dockerfile med tre mål, en komplett docker-compose, en valfri HTTPS-proxy.',
				],
			},
			projects: {
				date: '2026-09-25',
				title: 'Projekt, behörigheter, MCP-server',
				items: [
					'<strong>Projekt</strong> ovanför databaserna, och behörigheter per <strong>grupp</strong> på fyra nivåer: Ingen åtkomst, Läsa, Redigera, Hantera.',
					'<strong>Konton</strong>: tillfälligt lösenord, byte vid första inloggningen, förhöjd session för administration.',
					'<strong>MCP-server</strong> och stdio-relä; <strong>integrationstokens</strong> gemensamma för REST-API:et och MCP.',
					'<strong>Genererad dokumentation</strong> ”API och MCP” för varje databas.',
				],
			},
			fields: {
				date: '2026-09-20',
				title: 'Fält, enkelval, import',
				items: [
					'Redigera ett fält och alternativen i ett enkelval.',
					'<strong>Import</strong> av CSV- och JSON-filer.',
					'Tabellens meny: byt namn, beskriv, ta bort.',
				],
			},
			firstCommit: {
				date: '2026-09-20',
				title: 'Första commit',
				items: [
					'Monorepot: namngivning, register över felkoder, katalog extraherad ur arkitekturdokumentet, kärna, API, gränssnitt.',
				],
			},
		},
	},
	roadmap: {
		label: 'Färdplan',
		title: 'Vad som kommer härnäst',
		intro: 'basedb är under aktiv utveckling. Den här sidan visar vad som fortfarande saknas, utan utlovade datum. En idé, ett behov? <a href="https://github.com/eodia/basedb/issues">Öppna ett ärende</a>. Det som redan finns: <a href="/nouveautes/">nyheterna</a>.',
		columns: {
			next: {
				title: 'Snart',
				items: {
					restoreTable: {
						title: 'Återställa en enskild tabell',
						text: 'En borttagen tabell går fortfarande att läsa i SQL under sitt undanflyttade namn; att ta tillbaka den ensam från gränssnittet är på väg.',
					},
					aiSettings: {
						title: 'AI-inställningar i gränssnittet',
						text: 'Leverantör, modell och nyckel per arbetsyta, utan att gå via API:ets miljö.',
					},
					mail: {
						title: 'Aviseringar och inbjudningar via e-post',
						text: 'Omnämnanden, svar och tilldelningar kommer i dag in i basedb, och inbjudningar som en länk du skickar själv; de ska också kunna skickas via e-post.',
					},
				},
			},
			later: {
				title: 'Senare',
				items: {
					formLinks: {
						title: 'Relationer och filer i delade formulär',
						text: 'En begränsad sökning i den länkade tabellen, en begränsad filuppladdning för okända besökare.',
					},
					moreEvents: {
						title: 'Fler händelser som aviseras',
						text: 'Att bli aviserad om ett formulärsvar, ett agentförslag, en inaktiverad webhook.',
					},
					sqlViewsAcross: {
						title: 'SQL-vyer mellan miljöer',
						text: 'Kopiera SQL-vyerna tillsammans med strukturen när miljöer skapas eller jämförs, och i databasmallar.',
					},
					loops: {
						title: 'Loopar och väntan i automatiseringar',
						text: 'Upprepa steg för varje hittad rad, vänta före nästa (”tre dagar senare”), och ta med flödena i databasmallar.',
					},
					textFormulas: {
						title: 'Formler för text',
						text: 'Extrahera, ersätta eller korta av en del av en text.',
					},
					bulk: {
						title: 'Deklarerade massoperationer',
						text: 'Ändringar av tusentals rader, registrerade i historiken som en enda operation.',
					},
					tombstones: {
						title: 'Rensning av gravstenar',
						text: 'Rensning av spår efter borttagningar som inte längre behövs.',
					},
				},
			},
		},
	},
	gallery: {
		label: 'Mallar',
		title: 'En databas klar på några sekunder',
		intro: 'Varje mall skapar tabeller som är kopplade till varandra, exempelrader, vyer, en instrumentpanel, automatiseringar – och fält som AI fyller i själv. I basedb: <strong>Ny databas</strong>, sedan <strong>Utgå från en mall</strong>. Passar ingen? Beskriv ditt behov i en mening: AI föreslår en skräddarsydd databas.',
		filter: 'Filtrera efter kategori',
		all: 'Alla',
		otherCategory: 'Övrigt',
		ai: '✦ AI',
		tables: {
			one: '{n} tabell',
			other: '{n} tabeller',
		},
		rows: {
			one: '{n} rad',
			other: '{n} rader',
		},
		views: {
			one: '{n} vy',
			other: '{n} vyer',
		},
		howtoTitle: 'Skriva mallar i JSON',
		howto: 'En mall är en JSON-fil: dess tabeller, fält, relationer, rader, vyer, instrumentpaneler, automatiseringar och instruktionerna för dess AI-fält. Mallarna på den här sidan är filerna i repots mapp <a href="https://github.com/eodia/basedb/tree/main/packages/templates/catalog"><code>packages/templates/catalog</code></a>; varje basedb-instans läser <a href="/modeles/catalogue.json"><code>catalogue.json</code></a> och erbjuder dem till sina användare. En administratör kan också importera egna mallar till sin instans, och varje databas kan sparas som mall.',
		format: {
			href: '/fonctionnalites/modeles/',
			label: 'Mallformatet →',
		},
		back: '← Alla mallar',
		defaultCategory: 'Mall',
		sampleRows: {
			one: '{n} exempelrad',
			other: '{n} exempelrader',
		},
		aiTitle: 'Vad AI beräknar',
		useTitle: 'Använd den här mallen',
		useSteps: [
			'I basedb, <strong>Ny databas</strong>.',
			'<strong>Utgå från en mall</strong>, sedan ”{label}”.',
		],
		create: '<strong>Skapa databasen</strong>.',
		createWithAi: '<strong>Skapa databasen</strong> – och godkänn, om du vill, att AI-fälten beräknas av din AI-leverantör.',
		download: 'Ladda ned JSON-filen',
		downloadNote: 'För att importera den till din instans, eller anpassa den innan du föreslår den för katalogen.',
		viewMeta: '– {kind}, {table}',
		dashboard: '<strong>Instrumentpanel</strong> ”{label}” – {blocks}',
		blocks: {
			one: '{n} block',
			other: '{n} block',
		},
		automation: '<strong>Automatisering</strong> ”{label}”',
		yes: 'Ja',
		no: 'Nej',
		me: 'Du',
		kinds: {
			short_text: 'Kort text',
			long_text: 'Lång text',
			rich_text: 'Formaterad text',
			number: 'Tal',
			boolean: 'Kryssruta',
			date: 'Datum',
			datetime: 'Datum och tid',
			select: 'Enkelval',
			multi_select: 'Flerval',
			url: 'URL',
			email: 'E-post',
			user: 'Person',
			autonumber: 'Autonummer',
			formula: 'Formel',
			lookup: 'Uppslag',
			rollup: 'Aggregering',
			count: 'Antal',
			button: 'Knapp',
			link: 'Relation',
			multi_link: 'Multipel relation',
		},
		viewKinds: {
			grid: 'Rutnät',
			kanban: 'Kanban',
			calendar: 'Kalender',
			timeline: 'Tidslinje',
			gallery: 'Galleri',
			list: 'Lista',
			form: 'Formulär',
		},
	},
	templates: {
		demo: {
			label: 'Demo: Ateljé Lumen',
			summary: 'En liten byrå, dess kunder, projekt, uppgifter, fakturor och omdömen: alla sidor av basedb i en enda databas.',
			description: 'Demodatabasen. Ateljé Lumen är en fiktiv designbyrå. Dess databas visar relationer mellan tabeller, uppslag och aggregeringar (omsättning per kund, genomsnittligt betyg), formler (belopp inkl. moms, försening), tre fält som beräknas av AI utifrån kundomdömen (känsloläge, tema, föreslaget svar), alla sorters vyer – rutnät, kanban, kalender, tidslinje med beroenden, galleri, lista, formulär – en instrumentpanel och två automatiseringar.',
			category: 'Demo',
			tags: ['AI', 'Relationer', 'Alla vyer', 'Instrumentpanel'],
		},
		'analyse-avis': {
			label: 'Analys av kundomdömen',
			summary: 'Samla in omdömen och låt AI ta fram känsloläge, teman, brådska och ett utkast till svar.',
			description: 'För en butik, en restaurang eller ett varumärke: omdömena kommer från ett offentligt formulär eller en import, och AI läser vart och ett. Den klassificerar känsloläget, hittar huvudtemat, flaggar de som kräver ett snabbt svar, plockar ut kundens förslag och skriver ett svar att granska. Produkterna summerar sitt genomsnittliga betyg och antal omdömen; en instrumentpanel följer kundnöjdheten.',
			category: 'Kundrelationer',
			tags: ['AI', 'Formulär', 'Instrumentpanel'],
		},
		'base-connaissances': {
			label: 'Kunskapsbas',
			summary: 'Hjälpartiklar och kundfrågor: AI sammanfattar, klassificerar och föreslår ett svar utifrån artiklarna.',
			description: 'För en supportavdelning. Hjälpartiklarna ordnas efter kategori och följs över tid; kundernas frågor kommer in via ett offentligt formulär. AI sammanfattar varje artikel och bedömer dess nivå, klassificerar varje fråga och skriver ett utkast till svar att granska.',
			category: 'Support',
			tags: ['AI', 'Formulär', 'Lista'],
		},
		'calendrier-editorial': {
			label: 'Innehållskalender',
			summary: 'Artiklar, inlägg och nyhetsbrev planerade i en kalender; AI föreslår rubriker och nyckelord.',
			description: 'För ett marknadsföringsteam eller en redaktion. Varje innehåll går från idé till publicering, placeras i publiceringskalendern och hör till en kampanj. AI föreslår en rubrik och nyckelord utifrån briefen, och ett formulär låter hela företaget föreslå ämnen.',
			category: 'Marknadsföring',
			tags: ['AI', 'Kalender', 'Kanban', 'Formulär'],
		},
		crm: {
			label: 'Försäljnings-CRM',
			summary: 'Företag, kontakter och affärsmöjligheter: en säljpipeline, kontakthistorik och AI som föreslår nästa steg.',
			description: 'Ett lätt CRM för ett säljteam. Affärsmöjligheterna går framåt i en pipeline, har ett belopp viktat efter sannolikhet, och AI bedömer risken och föreslår nästa åtgärd utifrån anteckningarna. Kontakterna med kunderna loggas och sammanfattas, och företagen summerar vad de representerar.',
			category: 'Försäljning',
			tags: ['AI', 'Pipeline', 'Kanban', 'Kalender'],
		},
		evenements: {
			label: 'Evenemang och anmälningar',
			summary: 'Konferenser, workshoppar och webbinarier: anmälningar, lediga platser och deltagarnas återkoppling läst av AI.',
			description: 'För att organisera återkommande evenemang. Varje evenemang räknar sina anmälda och sina lediga platser; anmälningarna går framåt ända till närvaro. Efter evenemanget lämnar deltagarna återkoppling som AI klassificerar efter känsloläge och sammanfattar. Ett offentligt formulär gör det möjligt att gå med i utskickslistan.',
			category: 'Evenemang',
			tags: ['AI', 'Kalender', 'Formulär', 'Aggregeringar'],
		},
		'gestion-projet': {
			label: 'Projektledning',
			summary: 'Projekt, uppgifter och milstolpar: en färdplan, beroenden mellan uppgifter, en kanban och en kalender.',
			description: 'För att styra flera projekt parallellt. Varje projekt summerar sina uppgifter och timmar; uppgifterna följs i kanban, planeras på en tidslinje som visar deras beroenden, och milstolparna syns i en kalender. AI skriver en lägesrapport om projektet för ledningen utifrån dess beskrivning och framsteg.',
			category: 'Organisation',
			tags: ['Tidslinje', 'Beroenden', 'Kanban', 'AI'],
		},
		inventaire: {
			label: 'Inventering och lager',
			summary: 'Artiklar, leverantörer och lagerrörelser: lagret beräknas automatiskt och brister syns i förväg.',
			description: 'För en verkstad, en butik eller en intern serviceavdelning. Varje inleverans eller utleverans är en lagerrörelse; lagret för varje artikel är summan av dem, värdet en formel, och artiklar under sin gräns visas i ”Att beställa”. AI skriver en beskrivning av varje artikel utifrån dess namn och kategori.',
			category: 'Drift',
			tags: ['Aggregeringar', 'Formler', 'Galleri', 'AI'],
		},
		recrutement: {
			label: 'Rekrytering',
			summary: 'Lediga tjänster, kandidater och intervjuer; AI sammanfattar varje ansökan och föreslår punkter att gå djupare i.',
			description: 'En rekryteringsuppföljning, från ansökan till anställning. Kandidaterna söker via ett offentligt formulär, går vidare steg för steg i en kanban, och intervjuerna planeras i en kalender. AI läser personligt brev och anteckningar: en sammanfattning och frågor att ställa vid intervjun. Den hjälper till att läsa, den fattar inga beslut.',
			category: 'Personal (HR)',
			tags: ['AI', 'Formulär', 'Kanban', 'Kalender'],
		},
		'suivi-tickets': {
			label: 'Ärendehantering',
			summary: 'Buggar och önskemål som sorteras av AI och följs upp per sprint tills de är lösta, med ett formulär för felrapporter.',
			description: 'En ärendehanterare för ett produktteam. Varje ärende är kopplat till en komponent och en sprint; AI föreslår en kategori, uppskattar allvarlighetsgraden och sammanfattar rapporten. En kanban följer förloppet, en tidslinje visar sprintarna, ett formulär låter vem som helst rapportera ett problem, och en automatisering noterar datumet då det löstes.',
			category: 'Produkt och teknik',
			tags: ['AI', 'Kanban', 'Formulär', 'Sprintar'],
		},
	},
} satisfies DeepPartial<Dict>;
