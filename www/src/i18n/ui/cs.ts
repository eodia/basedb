/**
 * The Czech texts of the landing pages, laid over the French ones (`fr.ts`).
 *
 * See `../README.md`.
 */
import type { DeepPartial, Dict } from './index';

export default {
	meta: {
		home: {
			title: 'basedb – kolaborativní databáze, v níž je každá tabulka skutečnou tabulkou PostgreSQL',
			description: 'Mřížky a osm zobrazení, vzorce, sdílené formuláře a zobrazení, komentáře, automatizace, řídicí panely, oprávnění až na úroveň pole, úplná historie, REST API a server MCP – nad skutečnými tabulkami PostgreSQL se srozumitelnými názvy. Na vlastních serverech, AGPL-3.0.',
		},
		changelog: {
			title: 'Novinky – basedb',
			description: 'Co se v basedb změnilo, verze za verzí.',
		},
		roadmap: {
			title: 'Plán vývoje – basedb',
			description: 'Co basedb přinese dál.',
		},
		gallery: {
			title: 'Šablony – basedb',
			description: 'Databáze připravené k použití: sledování tiketů, analýza recenzí, CRM, nábor… s ukázkovými řádky, zobrazeními, řídicími panely a poli, která počítá AI.',
		},
		template: {
			title: '{label} – šablony basedb',
		},
	},
	eodia: {
		home: 'https://eodia.com/',
		about: 'https://eodia.com/about/',
		contact: 'https://eodia.com/contact/',
	},
	demo: {
		short: 'Ukázka',
		cta: 'Vyzkoušet ukázku',
	},
	nav: {
		aria: 'Hlavní navigace',
		home: 'basedb – úvodní stránka',
		links: [
			{
				href: '/#fonctionnalites',
				label: 'Funkce',
			},
			{
				href: '/modeles/',
				label: 'Šablony',
			},
			{
				href: '/guides/introduction/',
				label: 'Dokumentace',
			},
			{
				href: '/nouveautes/',
				label: 'Novinky',
			},
		],
		developers: 'Vývojáři',
		github: 'Repozitář basedb na GitHubu',
		install: 'Instalovat',
		menu: {
			open: 'Otevřít menu',
			close: 'Zavřít menu',
			features: {
				label: 'Funkce',
				groups: {
					organize: {
						title: 'Organizovat',
						items: {
							tables: {
								href: '/fonctionnalites/tables-et-champs/',
								title: 'Tabulky a pole',
								text: 'Pole pro vše, vazby, vzorce jako v tabulkovém procesoru.',
							},
							views: {
								href: '/fonctionnalites/vues/',
								title: 'Osm zobrazení',
								text: 'Mřížka, kanban, kalendář, časová osa, galerie, seznam, formulář, dotazník.',
							},
							forms: {
								href: '/fonctionnalites/formulaires-partages/',
								title: 'Formuláře',
								text: 'Odkaz ke sdílení: každá odpověď se stane řádkem.',
							},
							files: {
								href: '/fonctionnalites/fichiers/',
								title: 'Soubory a obrázky',
								text: 'Cenové nabídky, fotografie, smlouvy, uložené u svého řádku.',
							},
						},
					},
					collaborate: {
						title: 'Spolupracovat',
						items: {
							live: {
								href: '/fonctionnalites/collaboration/',
								title: 'Reálný čas a komentáře',
								text: 'Vidět ostatní při práci, okomentovat řádek, zmínit kolegu.',
							},
							rights: {
								href: '/fonctionnalites/droits/',
								title: 'Oprávnění a týmy',
								text: 'Kdo vidí co a kdo co upravuje, až na úroveň sloupce.',
							},
							history: {
								href: '/fonctionnalites/historique/',
								title: 'Historie',
								text: 'Každá úprava uložená a vratná.',
							},
							shared: {
								href: '/fonctionnalites/vues-partagees/',
								title: 'Sdílená zobrazení',
								text: 'Zobrazení odkazem, na vašem webu nebo ve vašem kalendáři.',
							},
						},
					},
					automate: {
						title: 'Automatizovat a analyzovat',
						items: {
							automations: {
								href: '/fonctionnalites/automatisations/',
								title: 'Automatizace',
								text: 'Když se řádek změní: upozornit, vytvořit, zapsat, zeptat se AI.',
							},
							dashboards: {
								href: '/fonctionnalites/tableaux-de-bord/',
								title: 'Řídicí panely',
								text: 'Patnáct vizualizací, společné filtry, odkaz ke sdílení.',
							},
							ai: {
								href: '/fonctionnalites/ia/',
								title: 'AI a Copilot',
								text: 'Databáze jednou větou, pole, která se vyplní sama.',
							},
							templates: {
								href: '/modeles/',
								title: 'Šablony',
								text: 'Deset databází připravených k použití, k úpravě.',
							},
						},
					},
				},
				feature: {
					tag: 'Novinka',
					title: 'Automatizace jako tok',
					text: 'Vyhledat, rozhodnout, zeptat se AI: grafový editor, a každé spuštění si můžete znovu přečíst krok za krokem.',
					href: '/nouveautes/',
					cta: 'Všechny novinky',
				},
				all: 'Všechny funkce',
			},
			solutions: {
				label: 'Řešení',
				title: 'Pro každý tým',
				items: {
					crm: {
						team: 'Prodej',
						text: 'Pipeline, kontakty, upomínky.',
					},
					recrutement: {
						team: 'Lidské zdroje',
						text: 'Přihlášky, pohovory, shrnutí od AI.',
					},
					'calendrier-editorial': {
						team: 'Marketing',
						text: 'Články, příspěvky a newslettery, naplánované.',
					},
					inventaire: {
						team: 'Provoz',
						text: 'Zásoba se počítá sama, výpadky vidět předem.',
					},
					'gestion-projet': {
						team: 'Projekty',
						text: 'Milníky, úkoly a závislosti.',
					},
					'suivi-tickets': {
						team: 'Produkt',
						text: 'Chyby a požadavky tříděné AI.',
					},
					'base-connaissances': {
						team: 'Podpora',
						text: 'Články nápovědy, otázky, navržené odpovědi.',
					},
					evenements: {
						team: 'Pořádání akcí',
						text: 'Přihlášky, místa, zpětná vazba.',
					},
					'analyse-avis': {
						team: 'Péče o zákazníky',
						text: 'Recenze čtené a tříděné AI.',
					},
				},
				ask: {
					title: 'Máte na mysli něco jiného?',
					text: 'Popište svou potřebu jednou větou: AI vám navrhne databázi na míru.',
					href: '/modeles/',
				},
				all: 'Všechny šablony',
			},
			developers: {
				label: 'Vývojáři',
				groups: {
					build: {
						title: 'Integrovat',
						items: {
							api: {
								href: '/integrations/api-rest/',
								title: 'REST API',
								text: 'Stejná data jako v rozhraní, popsaná v OpenAPI 3.1.',
							},
							mcp: {
								href: '/integrations/mcp/',
								title: 'Server MCP',
								text: 'Nástroje pro vaše AI agenty, s vašimi oprávněními.',
							},
							webhooks: {
								href: '/integrations/webhooks/',
								title: 'Webhooky',
								text: 'Každý zápis, podepsaný, řazený, opakovaně zkoušený.',
							},
							sql: {
								href: '/integrations/sql/',
								title: 'Přímé SQL',
								text: 'Skutečné tabulky PostgreSQL, se srozumitelnými názvy.',
							},
							sync: {
								href: '/integrations/synchronisation/',
								title: 'Synchronizace',
								text: 'Tabulky udržované aktuální odjinud.',
							},
						},
					},
					host: {
						title: 'Hostovat',
						items: {
							docker: {
								href: '/hebergement/docker/',
								title: 'Docker Compose',
								text: 'Jeden obraz, databáze PostgreSQL, jediný port.',
							},
							env: {
								href: '/hebergement/variables/',
								title: 'Proměnné',
								text: 'Vše se nastavuje v souboru .env.',
							},
							https: {
								href: '/hebergement/https/',
								title: 'Doména a HTTPS',
								text: 'Za vaším proxy, nebo s dodaným Caddy.',
							},
							sso: {
								href: '/hebergement/connexion/',
								title: 'Přihlášení a SSO',
								text: 'Google, Microsoft, libovolný poskytovatel OpenID Connect.',
							},
							backup: {
								href: '/hebergement/sauvegardes/',
								title: 'Zálohy a aktualizace',
								text: 'pg_dump a aktualizace beze ztráty dat.',
							},
						},
					},
				},
				feature: {
					title: 'Stránka pro vývojáře',
					text: 'Za každou mřížkou skutečná tabulka PostgreSQL.',
					href: '/developpeurs/',
				},
			},
			resources: {
				label: 'Zdroje',
				groups: {
					learn: {
						title: 'Naučit se',
						items: {
							docs: {
								href: '/guides/introduction/',
								title: 'Dokumentace',
								text: 'Celý basedb, krok za krokem.',
							},
							start: {
								href: '/guides/premiers-pas/',
								title: 'První kroky',
								text: 'První databáze, od importu až po zobrazení.',
							},
							install: {
								href: '/guides/installation/',
								title: 'Instalace',
								text: 'Dva soubory a jeden příkaz.',
							},
							principles: {
								href: '/architecture/principes/',
								title: 'Principy',
								text: 'Jak je basedb postavené a proč.',
							},
						},
					},
					follow: {
						title: 'Sledovat projekt',
						items: {
							news: {
								href: '/nouveautes/',
								title: 'Novinky',
								text: 'Co se změnilo, verze po verzi.',
							},
							roadmap: {
								href: '/feuille-de-route/',
								title: 'Plán vývoje',
								text: 'Co bude dál.',
							},
							github: {
								href: 'https://github.com/eodia/basedb',
								title: 'GitHub',
								text: 'Kód, tikety, verze.',
							},
							eodia: {
								href: 'https://eodia.com/',
								title: 'Eodia',
								text: 'Studio, které stojí za basedb.',
							},
						},
					},
				},
			},
		},
	},
	language: {
		label: 'Jazyk',
		current: 'Jazyk: {name}',
	},
	footer: {
		tagline: 'Kolaborativní databáze, v níž je každá tabulka skutečnou tabulkou PostgreSQL.',
		madeBy: 'Svobodný software od <a class="eodia" href="https://eodia.com/">Eodia</a>, softwarového studia stavějícího na AI.',
		columns: {
			product: {
				title: 'Produkt',
				links: [
					{
						href: '/#fonctionnalites',
						label: 'Funkce',
					},
					{
						href: '/nouveautes/',
						label: 'Novinky',
					},
					{
						href: '/feuille-de-route/',
						label: 'Plán vývoje',
					},
					{
						href: '/#faq',
						label: 'Časté otázky',
					},
				],
			},
			docs: {
				title: 'Dokumentace',
				links: [
					{
						href: '/guides/introduction/',
						label: 'Úvod',
					},
					{
						href: '/guides/installation/',
						label: 'Instalace',
					},
					{
						href: '/integrations/api-rest/',
						label: 'REST API',
					},
					{
						href: '/integrations/mcp/',
						label: 'Server MCP',
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
						label: 'Proměnné prostředí',
					},
					{
						href: '/hebergement/https/',
						label: 'Doména a HTTPS',
					},
					{
						href: '/hebergement/sauvegardes/',
						label: 'Zálohy',
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
						label: 'Architektonický dokument',
					},
					{
						href: 'https://github.com/eodia/basedb/blob/main/LICENSE',
						label: 'Licence AGPL-3.0',
					},
					{
						href: 'https://github.com/eodia/basedb/issues',
						label: 'Nahlásit problém',
					},
				],
			},
			eodia: {
				title: 'Eodia',
				links: [
					{
						href: 'https://eodia.com/',
						label: 'Studio',
					},
					{
						href: 'https://eodia.com/about/',
						label: 'O nás',
					},
					{
						href: 'https://eodia.com/contact/',
						label: 'Kontakt',
					},
				],
			},
		},
		copyright: '© {year} <a href="https://eodia.com/">Eodia</a> · AGPL-3.0-or-later',
		builtWith: 'Web je postavený na Astro a Starlight.',
	},
	docsFooter: {
		madeBy: 'basedb je svobodný software od <a href="https://eodia.com/">Eodia</a>, softwarového studia stavějícího na AI.',
	},
	teams: {
		meta: {
			title: 'basedb – veškerá vaše práce na jednom místě',
			description: 'Zákazníci, projekty, sklady, přihlášky: databáze, kterou celý tým upravuje současně, v tabulce, kanbanu nebo kalendáři, s řídicími panely, automatizacemi a AI. Bez kódu, svobodná a zdarma.',
		},
		hero: {
			eyebrow: 'basedb',
			title: 'Veškerá vaše práce.',
			titleAccent: 'Konečně na jednom místě.',
			lead: 'Tabulky, kalendáře, formuláře, řídicí panely a automatizace pro celý tým. Stejně jednoduché jako tabulkový procesor. Bez jediného řádku kódu.',
			primary: 'Prohlédnout šablony',
			secondary: 'Zhlédnout ukázku',
			facts: ['Bez kódu', 'Svobodné a zdarma', 'Vaše data zůstávají u vás'],
		},
		story: {
			grid: {
				title: 'Celý tým v jedné tabulce.',
				text: 'Všichni v ní pracují současně a každý vidí totéž, vždy aktuální.',
			},
			copilot: {
				title: 'Zeptejte se. Copilot to zařídí.',
				text: '„Koho mám tento týden znovu kontaktovat?“ – Copilot navrhne správný filtr, který použijete jedním kliknutím.',
			},
			kanban: {
				title: 'Přetáhněte. Je to aktuální.',
				text: 'Každá fáze se stane sloupcem; přesunutí karty znamená úpravu řádku.',
			},
			calendar: {
				title: 'Každý termín na svém místě.',
				text: 'Schůzky se zobrazí samy od sebe a lze je sledovat až ve vašem kalendáři.',
			},
			dashboard: {
				title: 'A vše na jeden pohled.',
				text: 'Čísla se počítají sama, ze stejných řádků.',
			},
		},
		stage: {
			aria: 'Sledování zákazníků týmu v basedb: tabulka, Copilot, kanban, kalendář, řídicí panel',
			tabs: {
				grid: 'Tabulka',
				copilot: 'Copilot',
				kanban: 'Kanban',
				calendar: 'Kalendář',
				dashboard: 'Řídicí panel',
			},
			project: 'Hlavní projekt',
			projectMeta: 'Projekt · 2 databáze',
			filterNav: 'Filtrovat navigaci',
			base: 'Prodej',
			otherBase: 'Podpora',
			tables: ['Zákazníci', 'Kontakty', 'Nabídky'],
			baseSection: 'Databáze · Prodej',
			screens: ['Řídicí panely', 'Automatizace'],
			user: 'Léa Martin',
			views: { grid: 'Všechny řádky', kanban: 'Podle fáze', calendar: 'Schůzky' },
			toolbar: {
				filter: 'Filtrovat',
				columns: 'Sloupce',
				group: 'Seskupit',
				colors: 'Barvy',
				sort: 'Seřadit',
				configure: 'Nastavit',
			},
			search: 'Hledat…',
			add: 'Přidat',
			columns: {
				name: 'Zákazník',
				status: 'Fáze',
				owner: 'Řeší',
				amount: 'Částka',
				next: 'Další schůzka',
			},
			statuses: {
				contact: 'Kontaktovat',
				meeting: 'Schůzka',
				quote: 'Nabídka odeslána',
				signed: 'Podepsáno',
			},
			clients: [
				'Pekárna Martin',
				'Klinika U Lípy',
				'Gymnázium Karla Čapka',
				'Cyklodílna Solidarita',
				'Lahůdkářství Dobrota',
				'Kovárna Vltava',
				'Ateliér Moreau',
			],
			addRow: 'Přidat záznam',
			perPage: 'Řádků na stránku',
			card: 'Řeší {owner}, schůzka {date}',
			addCard: 'Přidat kartu',
			today: 'Dnes',
			month: 'Měsíc',
			week: 'Týden',
			dashboards: 'Řídicí panely',
			questions: 'Otázky',
			dashboard: 'Obchodní sledování',
			dashboardText: 'To nejdůležitější na jeden pohled.',
			dashboardTabs: ['Přehled', 'Aktivita'],
			period: 'Období',
			thisYear: 'Tento rok',
			share: 'Sdílet',
			edit: 'Upravit',
			explore: 'Prozkoumat data',
			chart: 'Částka podle zákazníka',
			byStage: 'Zákazníci podle fáze',
			kpis: {
				signed: 'Podepsáno',
				pending: 'Nabídky v čekání',
				rate: 'Podepsaní zákazníci',
			},
			copilot: {
				question: 'Koho mám tento týden znovu kontaktovat?',
				thinking: 'Přemýšlím…',
				answer: 'Čtyři zákazníci čekají na odpověď: dva mají odeslanou nabídku a dva čekají na schůzku.',
				card: 'Filtrovat Zákazníci',
				filter: 'Fáze: Nabídka odeslána nebo Schůzka',
				apply: 'Použít filtr',
				applied: 'Filtr použit',
				placeholder: 'Zeptejte se Copilotu…',
				filtered: '{n} filtrované řádky',
			},
		},

		video: {
			eyebrow: 'Ukázka',
			title: 'Celé basedb,',
			titleAccent: 've čtyřech minutách.',
			text: 'Vytvořit databázi, naplnit ji, sdílet, automatizovat a řídit: kompletní prohlídka s komentářem.',
			play: 'Přehrát video',
			duration: '4 min 35 s',
			chapters: 'Kapitoly',
			captions: 'Francouzština',
			inFrench: 'Video je ve francouzštině, s francouzskými titulky.',
			list: [
				{ time: '0:08', title: 'Vytvořit databázi' },
				{ time: '0:35', title: 'Tabulky, pole a vzorce' },
				{ time: '1:10', title: 'Detaily řádků a spolupráce' },
				{ time: '1:33', title: 'Osm zobrazení nad stejnými řádky' },
				{ time: '2:01', title: 'Formuláře a AI' },
				{ time: '2:37', title: 'Automatizace' },
				{ time: '2:59', title: 'Řídicí panely' },
				{ time: '3:15', title: 'SQL pro každého' },
				{ time: '3:43', title: 'Historie a oprávnění' },
				{ time: '4:01', title: 'API, MCP a Copilot' },
			],
		},

		together: {
			eyebrow: 'Spolupráce',
			title: 'Všichni.',
			titleAccent: 'Najednou.',
			text: 'Zápisy ostatních přicházejí v reálném čase. Vidíte, kdo se dívá na který řádek, diskutujete o něm přímo tam, kde se nachází, a stačí @, abyste upozornili kolegu.',
			demo: {
				path: 'Prodej / Nabídky',
				here: '3 lidé na této tabulce',
				columns: {
					client: 'Zákazník',
					status: 'Fáze',
					amount: 'Částka',
					due: 'Termín',
				},
				statuses: {
					draft: 'Koncept',
					sent: 'Odesláno',
					signed: 'Podepsáno',
				},
				rows: [
					'Pekárna Martin',
					'Klinika U Lípy',
					'Gymnázium Karla Čapka',
					'Cyklodílna Solidarita',
					'Lahůdkářství Dobrota',
					'Kovárna Vltava',
				],
				comment: '@{name} můžeš tuhle nabídku schválit ještě dnes večer?',
				reply: 'Schváleno!',
				toast: 'Úprava pole „{field}“ od {name}',
			},
			points: {
				live: {
					title: 'V reálném čase',
					text: 'Každý zápis se hned zobrazí ostatním, bez nutnosti znovu načítat stránku.',
				},
				comments: {
					title: 'Komentáře a zmínky',
					text: 'Řádek okomentujete, kolegu zmíníte pomocí @, a zvonek ho upozorní.',
				},
				undo: {
					title: 'Bezpečné vrácení zpět',
					text: 'Ctrl+Z vrátí vaši poslední úpravu – nikdy úpravu kolegy.',
				},
			},
			link: {
				href: '/fonctionnalites/collaboration/',
				label: 'Spolupráce',
			},
		},
		forms: {
			eyebrow: 'Formuláře a dotazníky',
			title: 'Pokládejte otázky.',
			titleAccent: 'Odpovědi se řadí samy.',
			text: 'Formulář na jedné stránce, nebo dotazník, který klade jednu otázku na obrazovku, ve vašich barvách: sdílejte odkaz, a každá odpověď se stane řádkem vaší tabulky. Kdo odpovídá, nevidí nic jiného.',
			modes: {
				label: 'Zobrazit otázky',
				survey: 'Dotazník',
				form: 'Formulář',
			},
			demo: {
				title: 'Poptávka',
				description: 'Tři otázky, a ozveme se vám do 48 hodin.',
				count: '3 otázky',
				start: 'Začít',
				ok: 'OK',
				hint: 'nebo Enter',
				submit: 'Odeslat mou poptávku',
				org: {
					label: 'Vaše organizace',
					answer: 'Kavárna Umění',
				},
				need: {
					label: 'Vaše potřeba',
					options: ['Webové stránky', 'Vizuální identita', 'Katalog'],
				},
				budget: {
					label: 'Váš rozpočet',
					help: 'Bez DPH, i orientačně.',
				},
				sent: 'Odesláno!',
				thanks: 'Děkujeme! Ozveme se vám do 48 hodin.',
				poweredBy: 'Formulář běží na basedb',
				path: 'Prodej / Poptávky',
				view: 'Všechny poptávky',
				columns: {
					org: 'Organizace',
					need: 'Potřeba',
					budget: 'Rozpočet',
					stage: 'Fáze',
				},
				stages: {
					new: 'Nové',
					called: 'Zavoláno zpět',
					quote: 'Nabídka odeslána',
				},
				rows: ['Pekárna Martin', 'Klinika U Lípy', 'Cyklodílna Solidarita', 'Kovárna Vltava'],
				open: 'Otevřeno',
				answers: {
					one: '{n} odpověď',
					few: '{n} odpovědi',
					many: '{n} odpovědi',
					other: '{n} odpovědí',
				},
				active: 'Aktivní odkaz',
			},
			points: {
				survey: {
					title: 'Jedna otázka na obrazovku',
					text: 'Na celou obrazovku, z klávesnice: Enter pro pokračování, A, B, C pro výběr — jediná volba sama přejde dál, a odeslání se slaví.',
				},
				access: {
					title: 'Veřejný, nebo jen pro přihlášené',
					text: 'Kdokoli s odkazem odpoví bez účtu — nebo jen přihlášení členové, a odpověď ponese jejich jméno.',
				},
				closed: {
					title: 'Zbytek zůstává uzavřený',
					text: 'Odpovídání neukazuje nic dalšího z tabulky. Odkaz se uzavře k datu, nebo po počtu odpovědí.',
				},
			},
			link: {
				href: '/fonctionnalites/formulaires-partages/',
				label: 'Formuláře',
			},
		},
		automate: {
			eyebrow: 'Automatizace',
			title: 'Pracuje',
			titleAccent: 'zatímco vy spíte.',
			text: 'Když řádek vznikne nebo se změní, v pevný čas nebo jedním kliknutím na tlačítko, basedb provede kroky za sebou: vybere správnou větev, zeptá se AI, upozorní, koho je třeba. A každé spuštění si můžete znovu přečíst krok za krokem.',
			clock: '03:12',
			crumb: 'Prodej / Automatizace',
			create: 'Nová automatizace',
			list: [
				{
					name: 'Nová poptávka',
					when: 'Vytvoří se řádek',
				},
				{
					name: 'Nabídka podepsána',
					when: 'Upraví se řádek',
				},
				{
					name: 'Pondělní upomínky',
					when: 'Každé pondělí v 09:00',
				},
			],
			active: 'Aktivní',
			test: 'Otestovat na řádku',
			save: 'Uložit',
			when: 'Když',
			trigger: 'Vytvoří se řádek',
			table: 'Tabulka: Poptávky',
			steps: {
				branch: {
					kind: 'Podmínka',
					text: '2 větve',
					run: 'větev „Velký projekt“',
				},
				notify: {
					kind: 'Upozornit někoho',
					text: 'Léa Martin',
					run: 'Upozorněna 1 osoba',
				},
				create: {
					kind: 'Vytvořit řádek',
					text: 'Schůzka, v Kalendáři',
					run: 'hotovo',
				},
				slack: {
					kind: 'Odeslat do Slacku',
					text: 'Do kanálu #prodej',
					run: 'hotovo',
				},
				ai: {
					kind: 'Zeptat se AI',
					text: 'Napsat první odpověď',
					run: 'odpověď o {n} znacích',
				},
				update: {
					kind: 'Upravit řádek',
					text: 'Odpověď, Fáze',
					run: 'hotovo',
				},
			},
			paths: {
				big: 'Velký projekt',
				condition: 'budget gt 5000',
				otherwise: 'Jinak',
			},
			answer: 'Dobrý den, děkujeme za vaši poptávku! Léa, která bude mít na starosti vaši novou vizuální identitu, vám zítra ráno zavolá.',
			addStep: 'Přidat krok',
			tabs: {
				settings: 'Nastavení',
				runs: 'Spuštění',
			},
			runsText: 'Posledních 50, uchovávaných 30 dní. Vyberte jedno a uvidíte v toku, kterou větví prošlo.',
			running: 'Probíhá',
			succeeded: 'Úspěšné',
			started: 'řádek vytvořen · {when}',
			now: 'právě teď',
			earlier: ['včera v 18:40', 'včera v 11:02'],
			done: 'Úspěšné · 5 kroků · 1,3 s',
			points: {
				when: {
					title: 'Ve správný okamžik',
					text: 'Vytvořený nebo změněný řádek, pevný čas, tlačítko — a podmínka, aby se spustilo jen tehdy, kdy je potřeba.',
				},
				paths: {
					title: 'Několik větví',
					text: 'Podmínka otevírá větve, každá se svými kroky; co jeden krok najde, může další citovat.',
				},
				copilot: {
					title: 'Popsaná jednou větou',
					text: '„Když přijde poptávka, upozorni Léa, pokud rozpočet přesáhne 5 000 €“: Copilot sestaví tok a vy ho zkontrolujete.',
				},
			},
			link: {
				href: '/fonctionnalites/automatisations/',
				label: 'Automatizace',
			},
		},
		glance: {
			eyebrow: 'Řídicí panely',
			title: 'Vidíte vše.',
			titleAccent: 'Na jeden pohled.',
			text: 'Čísla, křivky, cíle: vaše řídicí panely se sestavují myší z vašich tabulek a samy zůstávají aktuální. Jeden filtr, a celý panel se přizpůsobí.',
			demo: {
				title: 'Obchodní přehled',
				filters: ['Tento rok', 'Všechna města'],
				revenue: 'Obrat',
				signed: 'Podepsané nabídky',
				rate: 'Úspěšnost podpisu',
				goal: 'Roční cíl',
				byMonth: 'Obrat podle měsíce',
				byStage: 'Nabídky podle fáze',
				stages: ['Odeslané', 'V jednání', 'Podepsané'],
				bySector: 'Zákazníci podle odvětví',
				sectors: ['Obchod', 'Zdravotnictví', 'Školství', 'Průmysl'],
				shared: 'Sdíleno odkazem',
			},
			points: {
				viz: {
					title: 'Patnáct vizualizací',
					text: 'Čísla, trendy, cíle, křivky, sektory, trychtýře, kontingenční tabulky, mapy.',
				},
				filters: {
					title: 'Společné filtry',
					text: 'Období, zákazník, město: filtr ovládá jednu kartu, několik, nebo celý panel.',
				},
				share: {
					title: 'Sdíleno odkazem',
					text: 'Veřejně nebo jen pro tým, a vložitelné na jiný web.',
				},
			},
			link: {
				href: '/fonctionnalites/tableaux-de-bord/',
				label: 'Řídicí panely',
			},
		},
		ai: {
			eyebrow: 'AI',
			title: 'Popište.',
			titleAccent: 'basedb postaví.',
			text: 'Jedna věta stačí k získání kompletní databáze, kterou si před vytvořením prohlédnete. Copilot pak navrhne filtry, grafy a automatizace, a pole AI za vás shrnují, třídí a píšou.',
			prompt: 'Sledování přihlášek na naše tři otevřené pozice, včetně pohovorů.',
			thinking: 'Tři propojené tabulky, připravené k prohlédnutí.',
			tables: {
				jobs: {
					name: 'Pozice',
					fields: ['Název', 'Oddělení', 'Otevřeno od'],
				},
				people: {
					name: 'Kandidáti',
					fields: ['Jméno', 'Pozice', 'Fáze', 'Shrnutí'],
				},
				talks: {
					name: 'Pohovory',
					fields: ['Kandidát', 'Datum', 'S kým', 'Hodnocení'],
				},
			},
			aiField: 'Shrnutí',
			aiValue: 'Šest let v projektovém řízení, vstřícný k zákazníkům; co prověřit: angličtina.',
			create: 'Vytvořit databázi',
			providers: 'S poskytovatelem podle vašeho výběru – OpenAI, Anthropic, Mistral, nebo model instalovaný u vás. Bez vašeho souhlasu nic neodejde.',
			link: {
				href: '/fonctionnalites/ia/',
				label: 'AI v basedb',
			},
		},
		features: {
			title: 'Vše, co potřebujete.',
			titleAccent: 'A ještě mnohem víc.',
			text: 'Každá funkce zapisuje do stejných tabulek, se stejnými oprávněními, do stejné historie.',
			tiles: {
				views: {
					stat: '8',
					title: 'způsobů, jak zobrazit svá data',
					text: 'Mřížka, kanban, kalendář, časová osa, galerie, seznam, formulář a dotazník, nad stejnými řádky. Každý si vybere tu svou.',
					href: '/fonctionnalites/vues/',
				},
				history: {
					stat: 'Ctrl+Z',
					title: 'Nic se neztratí',
					text: 'Každá úprava se uchovává s předchozí hodnotou; chyba se dá vrátit, smazaný řádek obnovit.',
					href: '/fonctionnalites/historique/',
				},
				forms: {
					title: 'Formuláře',
					text: 'Veřejný odkaz nebo odkaz jen pro tým: každá odpověď se objeví v tabulce, aniž byste otevírali zbytek.',
					href: '/fonctionnalites/formulaires-partages/',
				},
				viz: {
					stat: '15',
					title: 'vizualizací',
					text: 'Čísla, trendy, cíle, křivky, sektory, trychtýře, kontingenční tabulky a mapy.',
					href: '/fonctionnalites/tableaux-de-bord/',
				},
				formulas: {
					code: 'IF([Montant] > 10000, "Grand compte", "")',
					title: 'Vzorce ve francouzštině nebo angličtině',
					text: 'Jako v tabulkovém procesoru – SI, ARRONDI, JOURS… nebo IF, ROUND, DAYS – ale počítané pro celý tým.',
					href: '/fonctionnalites/tables-et-champs/#vzorce',
				},
				rights: {
					title: 'Každý vidí jen to, co má',
					text: 'Čtení, úpravy, správa, tým po týmu; citlivý sloupec lze skrýt.',
					href: '/fonctionnalites/droits/',
				},
				mentions: {
					bubble: '@Camille',
					title: 'Komentáře a zmínky',
					text: 'O řádku se diskutuje přímo tam, kde se nachází, a zvonek upozorní.',
					href: '/fonctionnalites/collaboration/',
				},
				relations: {
					title: 'Vše je propojené',
					text: 'Zákazníci, projekty, faktury: agregace a vyhledávání procházejí přes vazby.',
					href: '/fonctionnalites/tables-et-champs/',
				},
				templates: {
					stat: '10',
					title: 'připravených šablon',
					text: 'CRM, nábor, sklady, akce… nebo databáze popsaná AI jednou větou.',
					href: '/modeles/',
				},
				import: {
					title: 'Import jedním gestem',
					text: 'Přetáhněte soubor CSV: sloupce a typy se odhadnou, tabulka se vytvoří.',
					href: '/guides/premiers-pas/',
				},
				agenda: {
					title: 'Až do vašeho kalendáře',
					text: 'Z kalendáře se stane kanál iCalendar pro Kalendář Google, Outlook nebo Kalendář Apple.',
					href: '/fonctionnalites/vues-partagees/',
				},
				files: {
					title: 'Soubory a obrázky',
					text: 'Cenové nabídky, fotografie, smlouvy; obrázek se stane titulním obrázkem karty.',
					href: '/fonctionnalites/fichiers/',
				},
				share: {
					title: 'Sdílená zobrazení',
					text: 'Zobrazení jen pro čtení, dostupné odkazem, které lze vložit do vašeho webu.',
					href: '/fonctionnalites/vues-partagees/',
				},
				sync: {
					title: 'Synchronizované tabulky',
					text: 'Udržované aktuální z online CSV, kalendáře nebo jiné instalace basedb.',
					href: '/integrations/synchronisation/',
				},
				signin: {
					title: 'Snadné přihlášení',
					text: 'Google, Microsoft nebo heslo; kolegy pozvete odkazem.',
					href: '/hebergement/connexion/',
				},
				languages: {
					title: 'Ve vašem jazyce',
					text: 'Rozhraní přebírá jazyk každého, z dvacítky dostupných.',
					href: '/fonctionnalites/droits/#vaše-nastavení',
				},
			},
		},
		yours: {
			eyebrow: 'Svobodné a na vlastních serverech',
			per: 'na osobu. Navždy.',
			text: 'basedb je svobodný software. Nainstalujte si ho na svůj server a pozvěte celý tým: žádné předplatné, žádné licence k počítání, a vaše data zůstávají u vás.',
			points: {
				home: {
					title: 'U vás',
					text: 'Na vašem serveru nebo u vašeho poskytovatele hostingu, zálohované jako každá databáze PostgreSQL.',
				},
				free: {
					title: 'Svobodné',
					text: 'Pod licencí AGPL-3.0: kód je otevřený a otevřený zůstane.',
				},
				ai: {
					title: 'AI podle vašeho výběru',
					text: 'Poskytovatel z trhu, model instalovaný u vás – nebo žádná AI.',
				},
			},
			link: {
				href: '/guides/installation/',
				label: 'Nainstalovat basedb',
			},
		},
		gallery: {
			eyebrow: 'Šablony',
			title: 'Připraveno za minutu.',
			text: 'Vyjděte ze šablony s jejími tabulkami, zobrazeními, řídicím panelem a ukázkovými řádky, a přizpůsobte si ji svému způsobu práce.',
			use: 'Prohlédnout',
			ask: {
				title: 'Nic nevyhovuje?',
				text: 'Popište svou potřebu jednou větou: AI vám navrhne databázi na míru.',
			},
			all: 'Zobrazit všechny šablony',
			previous: 'Předchozí šablony',
			next: 'Další šablony',
		},
		developers: {
			title: 'A co technická stránka?',
			text: 'Každá tabulka je skutečná tabulka PostgreSQL. REST API, webhooky, server MCP pro AI agenty a instalace jedním příkazem.',
			link: 'Stránka pro vývojáře',
		},
		faq: {
			title: 'Vaše otázky',
			items: [
				{
					q: 'Musím umět programovat?',
					a: 'Ne. Tabulky, zobrazení, formuláře, řídicí panely i automatizace vytvoříte myší. Vzorce se píší jako v tabulkovém procesoru, ve francouzštině nebo angličtině: SI nebo IF, ARRONDI nebo ROUND, JOURS nebo DAYS…',
				},
				{
					q: 'Kolik to stojí?',
					a: 'Nic: basedb je svobodný software, bez předplatného a bez ceny za osobu. Potřebujete jen server, na který ho nainstalujete.',
				},
				{
					q: 'Jak se instaluje?',
					a: 'Na server, pomocí Dockeru: dva soubory a jeden příkaz, pár minut pro toho, kdo se u vás stará o IT. Instalační návod vysvětluje vše krok za krokem.',
				},
				{
					q: 'Můžeme převzít naše tabulky?',
					a: 'Ano: uložte svůj list jako CSV a přetáhněte ho do basedb. Import odhadne typ každého sloupce, vytvoří tabulku a řádek po řádku uvede, co se mu nepodařilo převzít.',
				},
				{
					q: 'Může na tom pracovat víc lidí najednou?',
					a: 'Přesně k tomu to je určeno. Zápisy ostatních se zobrazují v reálném čase, řádek okomentujete, kolegu zmíníte pomocí @, a zvonek upozorní.',
				},
				{
					q: 'A AI, čte naše data?',
					a: 'Jen pokud se pro to rozhodnete. Bez nastaveného poskytovatele AI nikam nic neodchází. Pak pole nebo automatizace, která AI využívá, odešle jen to, co cituje její pokyn, a to po vašem souhlasu.',
				},
				{
					q: 'V jakém jazyce?',
					a: 'Ve vašem: rozhraní převezme jazyk vašeho prohlížeče, z dvaceti dostupných, a každý si ho může změnit v nastavení.',
				},
			],
		},
		cta: {
			title: 'Váš tým si zaslouží víc',
			titleAccent: 'než sdílený soubor.',
			text: 'Vyjděte ze šablony, pozvěte své kolegy a nechte „FINAL (2)“ za sebou.',
			primary: 'Prohlédnout šablony',
			secondary: 'Nainstalovat basedb',
		},
	},
	hero: {
		badge: 'Novinka: automatizace jako tok, řídicí panely a pohledy SQL',
		title: ['Kolaborativní databáze,', 'v níž je každá tabulka', 'skutečnou tabulkou'],
		titleAccent: 'PostgreSQL.',
		lead: 'Jednoduchost sdíleného tabulkového procesoru – mřížky, zobrazení, formuláře, oprávnění – a data, která žijí v tabulkách <strong>typovaných a srozumitelně pojmenovaných</strong>. Váš tým pracuje v rozhraní; vaše skripty, nástroje BI, AI agenti a <code>psql</code> čtou tytéž řádky.',
		install: 'Instalovat pomocí Dockeru',
		features: 'Zobrazit funkce',
		copy: 'Kopírovat příkaz',
		facts: ['Na vlastních serverech', 'AGPL-3.0', 'REST API a server MCP'],
		demo: {
			url: 'basedb.vase-domena.cz',
			project: 'Hlavní projekt',
			projectMeta: 'Projekt · 2 databáze',
			filter: 'Filtrovat databáze a tabulky',
			sales: 'Prodej',
			support: 'Podpora',
			environment: 'Produkční',
			clients: 'Zákazníci',
			opportunities: 'Příležitosti',
			quotes: 'Cenové nabídky',
			baseSection: 'Databáze · Prodej',
			screens: ['Řídicí panely', 'Automatizace'],
			copilot: '✦ Copilot',
			allRows: '▦ Všechny řádky ▾',
			tools: ['Filtrovat', 'Seskupit', 'Barvy'],
			search: 'Hledat…',
			add: '+ Přidat',
			columns: {
				name: 'Název',
				status: 'Stav',
				amount: 'Částka',
				client: 'Zákazník',
			},
			statuses: {
				nouveau: 'Nová',
				qualifie: 'Kvalifikovaná',
				proposition: 'Nabídka',
				negociation: 'Vyjednávání',
				gagne: 'Získaná',
				perdu: 'Ztracená',
			},
			deals: {
				portail: {
					name: 'Redesign portálu',
					client: 'Městský úřad Tábor',
				},
				erp: {
					name: 'Migrace ERP',
					client: 'Skupina Dvořák',
				},
				audit: {
					name: 'Bezpečnostní audit',
					client: 'Klinika sv. Rocha',
				},
				billetterie: {
					name: 'Online vstupenky',
					client: 'Divadlo Na Rozcestí',
				},
				flotte: {
					name: 'Sledování flotily',
					client: 'Autodoprava Kratochvíl',
				},
				mobile: {
					name: 'Mobilní aplikace',
					client: 'Ateliér Moravec',
				},
				intranet: {
					name: 'Redesign intranetu',
					client: '',
				},
			},
			toastTitle: 'Formulář „Žádost o nabídku“',
			toastText: 'veřejná odpověď · vytvořil „{name}“',
			cursor: 'Klára',
			psqlRows: '(2 řádky)',
		},
	},
	showcase: {
		label: 'Skutečné rozhraní',
		title: 'Vše, co váš tým čeká od sdíleného tabulkového procesoru.',
		tabs: 'Snímky rozhraní',
		alt: 'basedb – {labelLower}: {caption}',
		shots: {
			grille: {
				label: 'Mřížka',
				caption: 'Mřížka, která zapisuje do skutečné tabulky – a počítaná pole: doba trvání ze vzorce, město zákazníka z vyhledávání, počet úkolů z pole Počet.',
			},
			kanban: {
				label: 'Kanban',
				caption: 'Tytéž řádky ve sloupcích podle jednoduchého výběru: titulní obrázek a popis, který cituje řádek. Přetažením karty upravíte řádek.',
			},
			galerie: {
				label: 'Galerie',
				caption: 'Karty s vlastním obrázkem, barva podle stavu: galerie, jeden z osmi způsobů, jak číst tabulku.',
			},
			chronologie: {
				label: 'Časová osa',
				caption: 'Pruhy mezi dvěma daty a šipky jejich závislostí – červeně, když pořadí přestane platit.',
			},
			tableaux: {
				label: 'Řídicí panely',
				caption: 'Karty v mřížce, na záložkách, pod společnými filtry: trend, cíl, skládané řady – každý je čte se svými oprávněními.',
			},
			automatisations: {
				label: 'Automatizace',
				caption: 'Když je úkol hotový, vyhledat, co z projektu zbývá; pokud nezbývá nic, AI napíše závěrečné slovo a projekt přejde na „Dodáno“. Každé spuštění si projdete přímo v toku, krok za krokem.',
			},
			commentaires: {
				label: 'Komentáře',
				caption: 'O řádku se diskutuje přímo tam, kde se nachází: komentáře, zmínky, oznámení.',
			},
			formulaire: {
				label: 'Formulář',
				caption: 'Formulář se sdílí odkazem, veřejně nebo jen pro přihlášené členy.',
			},
			historique: {
				label: 'Historie',
				caption: 'Každý zápis, ať přichází odkudkoli – od člověka, z automatizace, z přímého SQL – i s předchozími hodnotami.',
			},
			sql: {
				label: 'SQL',
				caption: 'Dotaz nad skutečnými názvy, uložený pod tabulkami pro celý tým – každý ho spouští se svými vlastními oprávněními.',
			},
			vuesSql: {
				label: 'Pohledy SQL',
				caption: 'Skutečné pohledy PostgreSQL, zařazené mezi tabulky se svou barvou a ikonou – a čitelné z psql.',
			},
		},
	},
	features: {
		postgres: {
			label: 'PostgreSQL bez prostředníků',
			title: 'Mřížka pro tým, skutečná tabulka {pro vaše nástroje.}',
			lead: 'Žádný generický model, žádný univerzální JSON, žádné <code>field_1837</code>: databáze je schéma, tabulka je tabulka, pole je typovaný sloupec se srozumitelným názvem.',
			bullets: [
				'<strong>Nativní typy</strong>: <code>text</code>, <code>numeric</code>, <code>date</code>, <code>timestamptz</code>, <code>boolean</code> – a pro vazby skutečné cizí klíče.',
				'<strong>Omezení hlídaná databází</strong>: jednoduché výběry jako <code>CHECK</code>, ověřované webové a e-mailové adresy, vazby jako <code>FOREIGN KEY</code>.',
				'<strong>Vzorce počítané PostgreSQL</strong>: z <code>JOURS([Fin]; [Début])</code> se stane generovaný sloupec, který <code>psql</code> čte jako kterýkoli jiný.',
				'<strong>Přímé SQL zůstává povolené</strong> – a i ono se zaznamenává do historie, pomocí triggeru.',
				'<strong>Dotazy a pohledy SQL</strong> v rozhraní: dotazy uložené pod tabulkami, pro vás nebo pro tým, a skutečné pohledy PostgreSQL zařazené mezi ně, které čte i <code>psql</code>.',
				'<strong>Přejmenování nic nerozbije</strong>: starý název dál obsluhuje alias pro kompatibilitu, dokud nepřevedete své dotazy.',
			],
			links: [
				{
					href: '/integrations/sql/',
					label: 'Práce v SQL',
				},
				{
					href: '/fonctionnalites/requetes-et-vues-sql/',
					label: 'Dotazy a pohledy SQL',
				},
				{
					href: '/architecture/principes/',
					label: 'Principy',
				},
			],
		},
		automations: {
			label: 'Automatizovat',
			title: 'Automatizace jako tok, {s AI v každém kroku.}',
			lead: 'Když se změní řádek, v pevný čas nebo kliknutím: grafový editor řetězí kroky a každé spuštění si projdete přímo v toku.',
			bullets: [
				'<strong>Přehledný tok</strong>: spouštěč, pak každý krok jako karta; <strong>+</strong> na spojnici přidá krok na dané místo.',
				'<strong>Vyhledat, rozhodnout, zapsat</strong>: najít řádek, vydat se jednou či druhou větví podle podmínek, upravit, vytvořit, upozornit, zavolat webhook, napsat do Slacku.',
				'<strong>Zeptat se AI</strong> v kroku: pokyn, který cituje řádek, a odpověď čtená jako text, číslo, datum nebo volba, kterou znovu použijí následující kroky.',
				'<strong>Copilot</strong> navrhne celou automatizaci z jediné věty nebo vysvětlí, proč spuštění selhalo – bez vás se nic neuloží.',
				'<strong>S oprávněními toho, kdo ji napsal</strong>, a v historii jako každý jiný zápis.',
			],
			links: [
				{
					href: '/fonctionnalites/automatisations/',
					label: 'Automatizace',
				},
				{
					href: '/fonctionnalites/automatisations/#copilot',
					label: 'Copilot',
				},
			],
			alt: 'basedb – automatizace „Projekt dodán“ v editoru toku: když je úkol hotový, zaznamenat čas, vyhledat, co z projektu zbývá, vydat se větví „Jinak“, zeptat se AI na závěrečné slovo, a pak projekt dodat; vpravo její poslední spuštění, krok za krokem.',
		},
		dashboards: {
			label: 'Analyzovat',
			title: 'Řídicí panely {přímo nad vašimi tabulkami.}',
			lead: 'Otázky kladené myší nebo v SQL, patnáct vizualizací, společné filtry – každý je čte se svými vlastními oprávněními.',
			bullets: [
				'<strong>Otázky</strong>: tabulka, její spojení, filtry a míry po dnech, týdnech, měsících nebo letech – nebo SQL jen pro čtení.',
				'<strong>Patnáct vizualizací</strong>: číslo, trend, postup, měřidlo, sloupce, křivky, výseče, trychtýř, kontingenční tabulka, mapa…',
				'<strong>Průzkum jedním kliknutím</strong>: bod otevře své řádky nebo jemnější období.',
				'<strong>Společné filtry</strong>, které řídí jednu, několik nebo všechny karty.',
				'<strong>Sdílení odkazem</strong>, veřejně nebo jen pro členy, a vložení na jiný web.',
			],
			links: [
				{
					href: '/fonctionnalites/tableaux-de-bord/',
					label: 'Řídicí panely',
				},
			],
			alt: 'basedb – řídicí panel: trend měsíce, cíl inkasa, obrat po měsících, sentiment recenzí, pod filtry období a zákazníka.',
		},
		rights: {
			label: 'Spolupráce bez otevírání všeho',
			title: 'Oprávnění až na úroveň pole, {historie bez mezer.}',
			lead: 'Oprávnění se udělují skupinám, na projekt, databázi nebo tabulku, a platí pro vše, co je pod nimi. Citlivý sloupec lze před skupinou skrýt nebo ho pro ni nastavit jako neupravitelný.',
			bullets: [
				'<strong>Čtyři úrovně</strong>: Bez přístupu, Čtení, Úpravy, Správa – sčítají se napříč skupinami.',
				'<strong>I SQL se řídí vašimi oprávněními</strong>: v rozhraní dotaz vidí jen tabulky a pole, která máte otevřená – a vynucuje to sám PostgreSQL.',
				'<strong>Každý zápis se zachytí</strong> ve své transakci: rozhraní, API, agent, veřejný formulář nebo přímé SQL.',
				'<strong>Změnu lze vrátit</strong>, odstraněný řádek obnovit, a odstraněnou databázi také.',
				'<strong>Administrace vyžaduje potvrzení</strong>: ke změně oprávnění musíte během posledních pěti minut znovu zadat heslo.',
			],
			links: [
				{
					href: '/fonctionnalites/droits/',
					label: 'Oprávnění a skupiny',
				},
				{
					href: '/fonctionnalites/historique/',
					label: 'Historie',
				},
			],
		},
		agents: {
			label: 'REST API · MCP · webhooky',
			title: 'Vaši AI agenti mají přístup k datům, {ne ke klíčům od hradu.}',
			lead: 'Server MCP dává agentům dvanáct nástrojů; REST API dává vašim programům tatáž data. Jediný bod kontroly oprávnění, tytéž protokoly.',
			bullets: [
				'<strong>Jeden token na databázi</strong>, ve výchozím nastavení jen pro čtení, nikdy s většími oprávněními, než má osoba, která ho vytvořila.',
				'<strong>Agent nic neodstraní</strong> a nemění strukturu: navrhne změnu, člověk ji schválí.',
				'<strong>Generovaná dokumentace</strong> pro každou databázi, filtrovaná podle vašich oprávnění, se specifikací OpenAPI 3.1.',
				'<strong>Webhooky</strong> při každém zápisu: podepsané, doručované v pořadí a opakované.',
			],
			links: [
				{
					href: '/integrations/mcp/',
					label: 'Připojit agenta',
				},
				{
					href: '/integrations/api-rest/',
					label: 'REST API',
				},
			],
		},
	},
	sqlVisual: {
		interface: 'Rozhraní',
		title: 'Nové pole · Příležitosti',
		labelField: 'Popisek',
		labelValue: 'Částka',
		typeField: 'Typ',
		typeValue: 'Číslo',
		descriptionField: 'Popis',
		descriptionValue: 'Částka smlouvy bez DPH',
		required: 'Povinné',
		ai: 'AI',
		migration: 'plánovaná migrace, krátké zámky',
	},
	rightsVisual: {
		groups: ['Správci', 'Obchodníci', 'Podpora'],
		project: 'Hlavní projekt',
		sales: 'Prodej',
		opportunities: 'Příležitosti',
		clients: 'Zákazníci',
		support: 'Podpora',
		inherited: 'zděděno',
		levels: {
			none: 'Bez přístupu',
			read: 'Čtení',
			edit: 'Úpravy',
			manage: 'Správa',
		},
		field: 'Pole „Marže“',
		hidden: 'Skryté',
		sqlChange: '<b>Přímá relace SQL</b> upravila <b>„Migrace ERP“</b>',
		sqlMeta: '02:46 · místní připojení · psql',
		sqlDiff: 'Částka: <s>125 000</s> → 130 000',
		undo: '↶ Vrátit',
		formChange: '<b>Formulář „Žádost o nabídku“</b> vytvořil <b>„Redesign intranetu“</b>',
		formMeta: 'veřejná odpověď · zveřejnila Klára',
	},
	agentVisual: {
		agent: 'Agent',
		via: 'připojený přes MCP · token „Prodej“',
		question: 'Kolik příležitostí je ve vyjednávání a v jaké částce?',
		listArgs: 'opportunites · statut = Vyjednávání',
		answer: 'Dvě příležitosti, celkem <b>182 000 €</b>: Migrace ERP (130 000 €) a Sledování flotily (52 000 €).',
		request: 'Přidej pole „Pravděpodobnost“ v procentech.',
		proposeArgs: 'opportunites · Pravděpodobnost · number',
		proposed: 'Navrženo: někdo z týmu to musí v basedb schválit.',
		badge: 'Návrh',
		expires: 'vyprší za 23 h',
		what: 'Přidat pole <b>„Pravděpodobnost“</b> (Číslo) do tabulky <b>Příležitosti</b>',
		by: 'Navrhl agent · token „Prodej“',
		refuse: 'Zamítnout',
		approve: 'Schválit',
	},
	bento: {
		label: 'A vše ostatní',
		title: 'Co čekáte od týmového nástroje, aniž byste se vzdali PostgreSQL.',
		text: 'Každá funkce zapisuje do týchž tabulek, pod stejnými oprávněními, do stejné historie.',
		more: 'Zjistit více →',
		views: {
			title: 'Osm zobrazení týchž řádků',
			text: 'Společná pro celý tým, nebo osobní jen pro vás: každý si volí svůj způsob čtení a nikdo nekopíruje data.',
			chips: ['Mřížka', 'Kanban', 'Kalendář', 'Časová osa', 'Galerie', 'Seznam', 'Formulář', 'Dotazník'],
		},
		forms: {
			title: 'Sdílené formuláře',
			text: 'Veřejný odkaz, nebo jen pro přihlášené členy. Odpověď nedává žádné oprávnění k tabulce.',
			href: '/fonctionnalites/formulaires-partages/',
		},
		environments: {
			title: 'Prostředí',
			text: 'Jedna databáze, několik variant. Porovnejte strukturu, migrujte z jedné do druhé, synchronizujte řádky.',
			chips: ['Produkční', 'Testovací', 'Vývojové'],
			href: '/fonctionnalites/environnements/',
		},
		collaboration: {
			title: 'Společná práce',
			text: 'Zápisy ostatních přicházejí v reálném čase, vidíte, kdo se dívá na který řádek, a diskutujete o něm přímo tam, kde se nachází: komentáře, zmínky, oznámení. Ctrl+Z vrátí poslední zápis a raději odmítne, než aby přepsal práci někoho jiného.',
			chips: ['Reálný čas', 'Přítomnost', 'Komentáře', 'Zmínky', 'Ctrl+Z'],
			href: '/fonctionnalites/collaboration/',
		},
		small: {
			ai: {
				title: 'AI v mřížce',
				text: 'Pole vyplňované modelem na základě ostatních sloupců a Copilot, který navrhuje filtry, dotazy a sloupce, použité jedním kliknutím. OpenAI, Anthropic, Mistral, nebo model provozovaný na vašem vlastním serveru.',
				code: 'Shrň {{Notes}} jednou větou',
				href: '/fonctionnalites/ia/',
			},
			formulas: {
				title: 'Vazby a vzorce',
				text: 'Skutečné cizí klíče, vzorce ve francouzštině nebo angličtině počítané PostgreSQL a vyhledávání, agregace a počty přes vazby.',
				code: 'ROUND([Montant HT] * (1 + [Taux de TVA]), 2)',
				href: '/fonctionnalites/tables-et-champs/#vzorce',
			},
			richText: {
				title: 'Formátovaný text a proměnné',
				text: 'Vizuální editor pro formátovaný text, sanitizovaný při zápisu; a v každém dlouhém textu se {{Ville}} čte jako hodnota řádku.',
				code: 'Doručení {{Date}} do města {{Ville}}',
				href: '/fonctionnalites/tables-et-champs/#formátovaný-text-a-proměnné',
			},
			languages: {
				title: 'Ve vašem jazyce',
				text: 'Rozhraní převezme jazyk prohlížeče, jeden z dvaceti; každý si ho může změnit v nastavení.',
				href: '/fonctionnalites/droits/#vaše-nastavení',
			},
			sharedViews: {
				title: 'Sdílená zobrazení',
				text: 'Zobrazení jen pro čtení přes odkaz, které lze vložit na jiný web; kalendář můžete odebírat ve své kalendářové aplikaci.',
				href: '/fonctionnalites/vues-partagees/',
			},
			syncedTables: {
				title: 'Synchronizované tabulky',
				text: 'Tabulka udržovaná aktuální z online CSV, z kalendáře nebo ze sdíleného zobrazení jiného basedb.',
				href: '/integrations/synchronisation/',
			},
			templates: {
				title: 'Šablony databází',
				text: 'Deset šablon připravených k použití, databáze popsaná AI jednou větou a vaše vlastní uložená jako šablona.',
				href: '/modeles/',
			},
			files: {
				title: 'Soubory a obrázky',
				text: 'Na disku hostitele nebo v úložišti kompatibilním se S3: AWS, Scaleway, OVH, Cloudflare R2, Garage, MinIO…',
				href: '/fonctionnalites/fichiers/',
			},
			import: {
				title: 'Import CSV a JSON',
				text: 'Přetáhněte soubor: import odhadne typy, vytvoří tabulku nebo doplní existující a řádek po řádku řekne, co bylo odmítnuto.',
				href: '/guides/premiers-pas/',
			},
			accounts: {
				title: 'Účty a pozvánky',
				text: 'Každý si vytvoří účet a projekty a zve odkazem s úrovní Čtení, Úpravy nebo Správa; přihlášení heslem, přes Google, Microsoft nebo libovolného poskytovatele OpenID Connect.',
				href: '/hebergement/connexion/',
			},
			webhooks: {
				title: 'Webhooky',
				text: 'Každý zápis může upozornit jiný systém: podepsaná data, doručovaná v pořadí, při chybě opakovaná.',
				href: '/integrations/webhooks/',
			},
			settings: {
				title: 'Osobní nastavení',
				text: 'Váš jazyk, motiv, pořadí data, oznámení, relace a tokeny na jednom místě.',
				href: '/fonctionnalites/droits/#vaše-nastavení',
			},
		},
	},
	selfHost: {
		label: 'Na vlastních serverech',
		title: 'Vaše data zůstávají {u vás.}',
		lead: 'basedb je svobodný software (AGPL-3.0): jediný obraz, databáze PostgreSQL, a to je vše – žádná vnucená služba třetí strany, žádná telemetrie. Zálohujte ho pomocí <code>pg_dump</code>, čtěte ho libovolným klientem PostgreSQL.',
		services: {
			db: 'PostgreSQL 16, vaše data',
			basedb: 'Rozhraní, REST API a server MCP na jediném portu',
			proxy: 'Caddy, automatické HTTPS (volitelně)',
		},
		links: [
			{
				href: '/hebergement/docker/',
				label: 'Průvodce Docker Compose →',
			},
			{
				href: '/hebergement/variables/',
				label: 'Všechny proměnné →',
			},
		],
		steps: [
			{
				title: 'Stáhnout basedb',
				code: 'git clone https://github.com/eodia/basedb.git\ncd basedb && cp .env.example .env',
			},
			{
				title: 'Dvě tajemství v .env',
				code: 'POSTGRES_PASSWORD=silne-heslo\n# openssl rand -base64 32\nBASEDB_ENCRYPTION_KEY=…',
			},
			{
				title: 'Spustit',
				code: 'docker compose up -d\n# pak http://localhost:3000: vytvořte si účet',
			},
		],
	},
	faq: {
		label: 'Časté otázky',
		title: 'Na co se nás často ptáte.',
		text: 'Máte jinou otázku? <a href="/guides/introduction/">Dokumentace</a> na ni nejspíš odpoví.',
		items: {
			difference: {
				q: 'Čím se basedb liší od jiných kolaborativních databází?',
				a: 'Tím, kde žijí data. Tam, kde jiné ukládají vaše řádky do generického modelu (číslované sloupce, dokumenty JSON), vytváří basedb pro každou tabulku skutečnou tabulku PostgreSQL a pro každé pole skutečný typovaný sloupec se srozumitelným názvem. Vaše data zůstanou použitelná i bez basedb.',
			},
			sql: {
				q: 'Mohu do tabulek zapisovat přímo v SQL?',
				a: 'Ano. Omezení (typy, povinnost, jednoduché výběry, cizí klíče) hlídá sám PostgreSQL a trigger zaznamenává do historie i zápisy provedené přímým SQL, spolu s relací, která je provedla. Konzole SQL v rozhraní i psql čtou tytéž tabulky; v rozhraní každý píše SQL se svými vlastními oprávněními, ukládá své dotazy, a pokud databázi spravuje, dělá z nich skutečné pohledy PostgreSQL.',
			},
			ai: {
				q: 'Co odchází k poskytovateli AI?',
				a: 'Nic, dokud poskytovatele nenastavíte. Poté u konceptů struktury a Copilota ve výchozím nastavení odchází jen struktura a vaše věta; čtení dat Copilotem je zaškrtávací políčko, pro každou konverzaci zvlášť. Šablona databáze vyžádaná od AI odešle jen vaši větu. Pole AI odešle sloupce, které cituje jeho pokyn, a to po výslovném souhlasu.',
			},
			together: {
				q: 'Může na stejné tabulce pracovat více lidí?',
				a: 'Ano. Zápisy ostatních se zobrazují bez obnovení stránky, s jejich tváří na tabulce nebo řádku, na který se dívají. Řádek okomentujete, někoho zmíníte pomocí @ a zvonek dá vědět. A Ctrl+Z vrací jen vaše vlastní zápisy: raději odmítne, než aby přepsal to, co mezitím změnil někdo jiný.',
			},
			languages: {
				q: 'V jakých jazycích?',
				a: 'Ve dvaceti: ve francouzštině, angličtině, němčině, španělštině, italštině, brazilské portugalštině, nizozemštině, polštině, češtině, švédštině, dánštině, norštině, finštině, rumunštině, maďarštině, turečtině, ukrajinštině, japonštině, zjednodušené čínštině a korejštině. Rozhraní převezme jazyk prohlížeče a každý si ho může změnit v nastavení; tento web i dokumentace existují ve stejných jazycích.',
			},
			agent: {
				q: 'Jak se připojí AI agent?',
				a: 'Přes server MCP, s integračním tokenem omezeným na jednu databázi, ve výchozím nastavení jen pro čtení. Agent čte, vytváří a upravuje řádky podle svých oprávnění; nic neodstraňuje a nemění strukturu: navrhne změnu a člověk ji schválí.',
			},
			postgres: {
				q: 'Jakou verzi PostgreSQL potřebuji?',
				a: 'PostgreSQL 16 nebo novější, s rozšířeními pg_trgm a unaccent (dostupnými v oficiálním obrazu). Dodaný docker-compose spustí PostgreSQL 16; DATABASE_URL můžete také nasměrovat na vlastní server.',
			},
			production: {
				q: 'Je basedb připravené pro produkční provoz?',
				a: 'basedb je v aktivním vývoji: jádro, API, server MCP a rozhraní fungují a pokrývá je více než tisíc testů, ale některé funkce teprve přijdou (viz plán vývoje). Vyzkoušejte ho a zálohujte svou databázi jako kteroukoli databázi PostgreSQL.',
			},
			license: {
				q: 'Pod jakou licencí?',
				a: 'AGPL-3.0-or-later. Můžete ho volně používat, upravovat a hostovat; pokud upravenou verzi nabízíte jako službu, sdílíte její zdrojový kód.',
			},
		},
	},
	cta: {
		title: 'Vaše data si zaslouží {skutečné tabulky.}',
		text: 'Nainstalujte basedb během několika minut, pozvěte svůj tým a mějte každý řádek pod kontrolou.',
		install: 'Instalovat basedb',
		github: 'Zobrazit kód na GitHubu',
	},
	changelog: {
		label: 'Novinky',
		title: 'Co se v basedb změnilo',
		intro: 'Podrobnosti o každé změně najdete v <a href="https://github.com/eodia/basedb/commits/main">historii repozitáře</a>. Co přijde dál: <a href="/feuille-de-route/">plán vývoje</a>.',
		entries: {
			forms: {
				date: '2026-09-29',
				title: 'Formuláře, které chcete vyplňovat',
				tag: 'Novinka',
				items: [
					'<strong>Dotazník zabírá celou obrazovku</strong>: jedna otázka za druhou, která přijíždí zboku, velké karty pro výběr, hvězdičky pro hodnocení, a vše z klávesnice — <strong>Enter</strong>, písmena A, B, C…, A nebo N, číslice. Jediná volba sama přejde dál. <a href="/fonctionnalites/vues/#formulář-a-dotazník">Formulář a dotazník</a>',
					'<strong>Vlastní vzhled</strong>: osm motivů, od Světlého po Noc přes Papír, barva, písmo, zarovnání — stránka sdíleného odkazu ho nese také.',
					'<strong>Zeptat se jen když…</strong>: otázka se položí, jen když to vyžaduje dřívější odpověď; skrytá otázka není ani povinná, ani uložená.',
					'<strong>Nic k nastavení na začátek</strong>: nový formulář se ptá na to, co osoba odpovídá, ne na stav, který tým doplní později, nese barvu své tabulky a v každém poli ukazuje příklad. A odeslání se slaví, včetně konfet.',
				],
			},
			formulaLanguages: {
				date: '2026-09-28',
				title: 'Vzorce ve francouzštině nebo angličtině',
				tag: 'Novinka',
				items: [
					'<strong>Vzorec napište ve francouzštině nebo angličtině</strong>, na jakékoli obrazovce, i s mísením obou jazyků: <code>SI</code> nebo <code>IF</code>, <code>ARRONDI</code> nebo <code>ROUND</code>, <code>JOURS</code> nebo <code>DAYS</code>… Argumenty se oddělují znakem <code>;</code> nebo <code>,</code>. <a href="/fonctionnalites/tables-et-champs/#vzorce">Vzorce</a>',
					'<strong>Znovu se čte v jazyce obrazovky</strong>: ve francouzštině na francouzské obrazovce, v angličtině v ostatních devatenácti jazycích – včetně existujících vzorců a panelu „Funkce“. API vrátí vzorec v požadovaném jazyce, jinak v angličtině.',
					'Oficiální šablony, nabízené v jiném jazyce než francouzštině, přicházejí se svými vzorci v angličtině. V databázi se nic nemění: stejné sloupce, stejné SQL, bez migrace.',
				],
			},
			search: {
				date: '2026-09-27',
				title: 'Najít vše: Ctrl+K',
				tag: 'Novinka',
				items: [
					'<strong>Jedno pole pro vše</strong> — <strong>Ctrl+K</strong>, nebo pole uprostřed horní lišty: tabulky, zobrazení, otázky, řídicí panely, automatizace, sloupce a samotné řádky, čtené s vašimi oprávněními; na velké obrazovce náhled zvoleného výsledku. <a href="/fonctionnalites/recherche/">Vyhledávání</a>',
					'<strong>Pište, jak přemýšlíte</strong>: bez diakritiky a velkých písmen, podle iniciál — <code>nk</code> pro „Nový klient“ —, jeden překlep se promine, <code>zakaznici praha</code> pro vyhledání „praha“ v tabulce klientů; co často otevíráte, se posouvá nahoru.',
					'<strong>Všechny příkazy z klávesnice</strong>: vytvořit, přejít na, zavřít, vrátit zpět, změnit motiv, kopírovat odkaz na stránku. <code>&gt;</code> hledá jen příkazy, <code>#</code> objekty, <code>/</code> řádky; <strong>Tab</strong> hledá uvnitř tabulky nebo databáze.',
					'<strong>Máte otázku?</strong> Napište ji: <strong>Zeptat se Copilota</strong> ji položí, na otevřené databázi.',
				],
			},
			questions: {
				date: '2026-09-27',
				title: 'Vlastní otázky, čísla v textu',
				tag: 'Novinka',
				items: [
					'<strong>Každý si ukládá své otázky</strong>, bez úrovně Správa: osobní vidíte jen vy; kdo správuje databázi, je sdílí s celou databází nebo se skupinami, stejně jako dotazy. <a href="/fonctionnalites/tableaux-de-bord/">Řídicí panely</a>',
					'<strong>Otázka na záložce</strong>, vedle tabulek: <strong>Nová otázka</strong> a <strong>Nová otázka SQL</strong>, u <strong>+</strong> na liště záložek a v nabídce databáze; záložka si ponechá, co jste v ní zanechali. <strong>Uložit kopii</strong> udělá vaší otázku, kterou nemůžete upravit.',
					'<strong>Čísla v textu</strong>: text řídicího panelu, nyní formátovaný, cituje hodnotu — <code>{{chiffre_affaires}}</code> — pocházející z karty, otázky nebo filtru, počítanou s oprávněními čtenáře, i v řídicím panelu sdíleném odkazem. <a href="/fonctionnalites/tableaux-de-bord/#čísla-v-textu">Čísla v textu</a>',
					'Dotazy, pohledy SQL a otázky se dají odstranit i z jejich nabídky, pravým kliknutím.',
				],
			},
			addresses: {
				date: '2026-09-27',
				title: 'Adresa pro každou obrazovku',
				tag: 'Novinka',
				items: [
					'<strong>Adresa sleduje obrazovku</strong>: tabulka, zobrazení, detail řádku, řídicí panel, automatizace, otázka, vaše nastavení — <code>/bases/ventes/tables/opportunites?ligne=…</code>. Přidejte si ji do záložek, vložte ji do zprávy: dostanete se na stejné místo, se svými vlastními oprávněními. <a href="/fonctionnalites/collaboration/#odkaz-na-každou-obrazovku">Odkaz na každou obrazovku</a>',
					'Tlačítka <strong>zpět</strong> a <strong>vpřed</strong> v prohlížeči vás vrátí tam, kde jste byli; adresa, která nikam nevede, zobrazí „Tato stránka neexistuje“.',
				],
			},
			demo: {
				date: '2026-09-27',
				title: 'Demoverze k vyzkoušení, ve vašem jazyce',
				tag: 'Novinka',
				items: [
					'<strong>Demoverze</strong> na <a href="https://demo.basedb.eodia.com">demo.basedb.eodia.com</a>: účet je přednastavený v jazyce vašeho prohlížeče, s databází v tomto jazyce. Vše se tam čte a upravuje to, co existuje; vytváření, mazání a AI jsou tam vypnuté a databáze se každou noc vrací do svého výchozího stavu.',
					'<strong>Vaše vlastní demoverze</strong>: <code>BASEDB_DEMO=1</code> otevře instanci všem, se sdíleným účtem na jazyk, připraveným předem. <a href="/hebergement/variables/#veřejná-demoverze">Proměnné</a>',
					'<strong>Jeden jazyk na odkaz</strong>: <code>?lang=de</code> na konci adresy basedb zobrazí německy přihlašovací obrazovku nebo sdílenou stránku; web tak vede k demoverzi v jazyce stránky. <a href="/fonctionnalites/droits/#vaše-nastavení">Vaše nastavení</a>',
				],
			},
			templateLanguages: {
				date: '2026-09-27',
				title: 'Šablony ve vašem jazyce',
				tag: 'Novinka',
				items: [
					'<strong>Oficiální šablony se vytvářejí v jazyce obrazovky</strong>: tabulky, pole, možnosti volby, zobrazení, řídicí panely, automatizace, pokyny pro AI — a ukázkové řádky ze světa upraveného pro každý jazyk: z „Boulangerie Martin“ z Lyonu se stává „Pekárna Novákova“ v Brně. <a href="/fonctionnalites/modeles/#ve-vašem-jazyce">Šablony</a>',
					'<a href="/modeles/">Galerie na webu</a> zobrazuje každou šablonu v jazyce stránky.',
					'<strong>Jedna šablona, více slovníků</strong>: šablona se píše jednou, ve francouzštině; každý jazyk v ní překládá jen texty, a basedb sám sleduje každý popisek všude, kde je citován. Slovník, který by šablonu porušil, se nepoužije. <a href="/fonctionnalites/modeles/#zveřejnění-šablony-pro-všechny-instance">Zveřejnění šablony</a>',
				],
			},
			details: {
				date: '2026-09-27',
				title: 'A také',
				items: [
					'<strong>Šablona bez ukázkových řádků</strong>: „Načíst ukázková data“, odškrtnuté, vytvoří prázdné tabulky, připravené pro vaše data. <a href="/fonctionnalites/modeles/#začít-ze-šablony">Začít ze šablony</a>',
					'<strong>Dokumentace API a MCP</strong> každé databáze se píše v jazyce vaší obrazovky. <a href="/integrations/api-rest/#vygenerovaná-dokumentace">Vygenerovaná dokumentace</a>',
					'Bublinové nápovědy v motivu aplikace, všude, kde dřív prohlížeč ukazoval své vlastní; „Odstranit“ v nabídkách červeně; úplné datum po najetí na čas komentáře.',
				],
			},
			languages: {
				date: '2026-09-27',
				title: 'Formátovaný text, proměnné, přehlednější kanban',
				tag: 'Novinka',
				items: [
					'<strong>Formátovaný text</strong>: nový typ pole, formátovaný ve vizuálním editoru – nadpisy, seznamy, citace, odkazy –, sanitizovaný při zápisu a chráněný omezením proti přímému SQL. <a href="/fonctionnalites/tables-et-champs/#formátovaný-text-a-proměnné">Formátovaný text a proměnné</a>',
					'<strong>Proměnné</strong>: dlouhý text cituje sloupec svého řádku – <code>{{Ville}}</code> – a všude se čte s jeho hodnotou: v mřížce, v detailu řádku, v API, na serveru MCP, ve sdílených zobrazeních, v automatizacích. Sloupec uchovává citaci, kterou čte <code>psql</code>.',
					'<strong>Přehlednější kanban</strong>: vzdušnější karty, titulní obrázek a popis, který cituje hodnoty řádku – „Doručení {{Date}} pro {{Client}}“. <a href="/fonctionnalites/vues/">Zobrazení</a>',
					'<strong>Přejmenování jedním gestem</strong>: jediný dialog pro databázi, tabulku nebo pole; popisek se změní vždy a správce může přejmenovat i v databázi, s analýzou dopadu. <a href="/fonctionnalites/tables-et-champs/#úprava-struktury">Úprava struktury</a>',
					'<strong>Dvacet jazyků</strong>: rozhraní, tento web a dokumentace ve francouzštině, angličtině, němčině, španělštině, italštině, portugalštině (Brazílie), nizozemštině, polštině, češtině, švédštině, dánštině, norštině, finštině, rumunštině, maďarštině, turečtině, ukrajinštině, japonštině, zjednodušené čínštině a korejštině. basedb převezme jazyk prohlížeče; <strong>Nastavení › Vzhled › Jazyk</strong> nastaví jiný, který vás provází z jednoho počítače na druhý. Čísla a data se řídí jazykem. <a href="/fonctionnalites/droits/#vaše-nastavení">Vaše nastavení</a>',
				],
			},
			flows: {
				date: '2026-09-27',
				title: 'Automatizace jako tok',
				tag: 'Novinka',
				items: [
					'<strong>Grafový editor</strong>: spouštěč, pak každý krok jako karta; <strong>+</strong> na spojnici přidá krok na dané místo. Jednoduchá automatizace se stále vejde do dvou karet. <a href="/fonctionnalites/automatisations/">Automatizace</a>',
					'<strong>Vyhledání řádku</strong> – zákazníka objednávky, poslední nezaplacené faktury – a pak jeho úprava, citace nebo propojení s vytvořeným řádkem.',
					'<strong>Podmínky s několika větvemi</strong>: použije se první, jejíž podmínka je splněna, a „Jinak“, když není splněna žádná; větve se pak opět spojí.',
					'<strong>Data přecházejí z kroku do kroku</strong>: <code>{{e2.client}}</code> cituje, co krok našel nebo vytvořil, <code>{{e3.reponse.numero}}</code>, co odpověděl webhook; nabídka každého textu nabízí jen to, co před ním s jistotou proběhlo.',
					'<strong>Každé spuštění krok za krokem</strong>: zobrazené přímo na toku vyznačí použitou větev a u každého kroku uvede, co udělal a jak dlouho to trvalo.',
					'<strong>Copilot automatizací</strong>: popište, co má databáze dělat sama, nebo se zeptejte, proč spuštění selhalo; navrhne celou automatizaci, kterou jedním kliknutím umístíte do toku, zkontrolujete a pak uložíte – bez vás se nic neuloží. <a href="/fonctionnalites/automatisations/#copilot">Copilot</a>',
					'<strong>Zeptat se AI</strong> v kroku, stejně jako v poli AI: pokyn, který cituje řádek a předchozí kroky, a odpověď čtená jako text, číslo, ano či ne, datum nebo volba ze seznamu, kterou následující kroky zapíší nebo odešlou. <a href="/fonctionnalites/automatisations/#zeptat-se-ai">Zeptat se AI</a>',
				],
			},
			dashboards: {
				date: '2026-09-27',
				title: 'Řídicí panely: otázky, grafy, filtry',
				tag: 'Novinka',
				items: [
					'<strong>Otázky</strong> kladené myší – tabulka, její spojení, filtry, míry po dnech, týdnech, měsících nebo letech – nebo psané v <strong>SQL</strong>, jen pro čtení a s vašimi vlastními oprávněními, včetně proměnných. <a href="/fonctionnalites/tableaux-de-bord/">Řídicí panely</a>',
					'<strong>Patnáct vizualizací</strong>: číslo, trend oproti předchozímu období, postup k cíli, měřidlo, sloupce, pruhy, křivka, plochy, kombinovaný graf, výseče, trychtýř, bodový graf, tabulka, kontingenční tabulka, mapa Francie nebo světa.',
					'<strong>Průzkum jedním kliknutím</strong>: bod otevře své řádky, jemnější období nebo jiné rozdělení.',
					'<strong>Řídicí panely v mřížce</strong>: karty přesouvané a zvětšované myší, záložky, nadpisy sekcí, texty, vložené stránky.',
					'<strong>Společné filtry</strong> – období, kategorie, text, číslo, seskupení data –, které řídí jednu, několik nebo všechny karty, s výchozí hodnotou.',
					'<strong>Grafy podle vašich představ</strong>: barva a název každé řady nebo výseče, prstenec, půlkruh nebo růžice, skládání se součty, vyhlazené nebo schodovité křivky, osy, dílky, logaritmická škála; tabulky s přejmenovanými sloupci, s pruhy a barvami podle hodnoty.',
					'<strong>Copilot řídicích panelů</strong>: konverzace, která navrhuje otázky, úpravy panelu – vratné – a hodnoty jeho filtrů, použitelné jedním kliknutím. K poskytovateli odchází jen struktura, pokud mu nepovolíte číst výsledky. <a href="/fonctionnalites/tableaux-de-bord/#copilot">Copilot</a>',
					'<strong>Sdílení řídicího panelu</strong> odkazem, veřejně nebo jen pro členy – případně pro vybrané skupiny – a jeho vložení na jiný web: karty a filtry jen pro čtení, čtené s oprávněními toho, kdo panel zveřejnil. <a href="/fonctionnalites/tableaux-de-bord/#sdílení-řídicího-panelu">Sdílení</a>',
					'„Rozhraní“ se nyní jmenují <strong>Řídicí panely</strong>; existující panely se otevřou beze změny, na nové mřížce.',
				],
			},
			sqlViews: {
				date: '2026-09-27',
				title: 'Uložené dotazy a pohledy SQL',
				tag: 'Novinka',
				items: [
					'<strong>SQL pro každého</strong>: bez úrovně Správa se záložka SQL provádí jen pro čtení, s vašimi vlastními oprávněními, která uplatňuje sám PostgreSQL – uzavřená tabulka neexistuje, skryté pole je odmítnuto. Připomíná to štítek „Vaše oprávnění“. <a href="/fonctionnalites/requetes-et-vues-sql/">Dotazy a pohledy SQL</a>',
					'<strong>Uložené dotazy</strong>, zařazené pod tabulkami v sekci „Dotazy“: osobní, pro celou databázi nebo pro skupiny. Sdílení dotazu sdílí jeho text, nikdy to, co smí číst jeho autor; otevřený z postranního panelu se hned provede, jen pro čtení.',
					'<strong>Pohledy SQL</strong>: skutečné pohledy PostgreSQL, zařazené mezi tabulky s barvou, ikonou a malým okem, čitelné i z <code>psql</code> a vašich nástrojů. Každý je čte se svými vlastními oprávněními a postranní panel je ukazuje jen těm, kdo v nich smí číst vše.',
					'Pohledy sledují strukturu: přejmenování je nerozbije, změněný vzorec je na okamžik odebere a pak vrátí; ten, který už neobstojí, zůstane k opravě, s uchovanou definicí.',
				],
			},
			aiProvider: {
				date: '2026-09-27',
				title: 'AI podle vašeho výběru, i na vlastním serveru',
				tag: 'Novinka',
				items: [
					'<strong>Čtvrtý poskytovatel AI</strong>: libovolný server, který mluví API OpenAI – Azure, podniková brána, model provozovaný na vašem vlastním serveru –, deklarovaný v <code>.env</code>. Protokol volání říká, komu data odešla. <a href="/fonctionnalites/ia/">AI v basedb</a>',
					'<strong>Přihlašovací obrazovka</strong> ukazuje, po mřížce a SQL, řídicí panel, který sleduje filtr, a automatizaci, která se spouští, včetně kroku AI.',
				],
			},
			settings: {
				date: '2026-09-27',
				title: 'Vaše nastavení',
				tag: 'Novinka',
				items: [
					'<strong>Nastavení</strong> v nabídce profilu: vaše jméno, adresa a poskytovatelé identity propojení s vaším účtem; vaše heslo a otevřené relace. <a href="/fonctionnalites/droits/">Účty a přihlášení</a>',
					'<strong>Vzhled</strong>: motiv, pořadí data – <code>25/09/2026</code> nebo <code>2026-09-25</code> – a první den týdne v kalendářích; poslední dvě vás provázejí z jednoho počítače na druhý.',
					'<strong>Oznámení</strong>: vypněte ta, která už nechcete dostávat, jeden druh po druhém. <strong>Tokeny</strong>: ty, které jste vytvořili ve všech svých databázích, jejich poslední použití a jejich odvolání.',
				],
			},
			v020: {
				date: '2026-09-26',
				title: 'Verze 0.2.0: vlastní účet, projekty a pozvánky pro každého',
				tag: 'Novinka',
				items: [
					'<strong>První přihlášení</strong>: na nové instanci vytvoří první stránka účet správce s vaší adresou a heslem – už žádný výchozí účet ani heslo hledané v protokolech. <a href="/guides/installation/">Instalace</a>',
					'<strong>Vytváření účtů</strong>: každý si vytvoří účet a pak vlastní projekty, které spravuje. Administrace ho může uzavřít nebo vyhradit pro určité domény. <a href="/hebergement/connexion/">Účty a přihlášení</a>',
					'<strong>Sdílení projektu nebo databáze</strong>: kdo má úroveň Správa, zve odkazem s úrovní Čtení, Úpravy nebo Správa; vidí, kdo má přístup, mění úroveň, odebírá ji. Nikdy víc, než sám spravuje.',
					'<strong>Soukromí</strong>: každý nyní vidí jen osoby, s nimiž sdílí projekt, a název projektu, který už používá někdo jiný, se nedá uhodnout.',
					'<strong>Přihlášení přes Google, Microsoft</strong> a libovolného poskytovatele OpenID Connect (Keycloak, GitLab…), deklarované v <code>.env</code>; první přihlášení vytvoří účet, pokud to vytváření účtů dovoluje. <a href="/hebergement/connexion/">Nastavit</a>',
					'<strong>Nová přihlašovací obrazovka</strong> v motivu aplikace, světlá nebo tmavá, se střídmou animací; ilustrované prázdné obrazovky v aplikaci.',
					'<strong>Aktualizace bez ztráty dat</strong>: basedb při spuštění aktualizuje svůj katalog automaticky, včetně instalací 0.1, a odmítne se spustit nad databází, kterou už aktualizovala novější verze. <a href="/hebergement/sauvegardes/">Aktualizace</a>',
				],
			},
			dockerImage: {
				date: '2026-09-26',
				title: 'Jediný obraz Dockeru',
				tag: 'Hosting',
				items: [
					'basedb se vejde do <strong>jediného obrazu</strong>, <code>eodia/basedb</code> na Docker Hubu, pro amd64 a arm64: rozhraní, API pod <code>/api</code> a server MCP pod <code>/mcp</code>, na <strong>jediném portu</strong>. <a href="/guides/installation/">Instalace</a>',
					'Stačí dva soubory – <code>docker-compose.yml</code> a <code>.env</code> – bez klonování repozitáře a bez sestavování; aktualizace se provádí pomocí <code>docker compose pull</code>.',
					'Za doménou už proxy HTTPS nemusí nic směrovat: vše jde na port 3000.',
				],
			},
			automations: {
				date: '2026-09-26',
				title: 'Automatizace, rozhraní, vzorce, spolupráce',
				tag: 'Novinka',
				items: [
					'<strong>Vzorce</strong> ve francouzštině – <code>SI</code>, <code>ARRONDI</code>, <code>JOURS</code>… –, z nichž se stávají sloupce generované PostgreSQL; <strong>vyhledávání</strong>, <strong>agregace</strong> a <strong>počty</strong> přes vazby. <a href="/fonctionnalites/tables-et-champs/">Pole</a>',
					'<strong>Nové typy</strong>: vícenásobná vazba, osoba, e-mail, automatické číslo, tlačítko; a formáty volené jako typy – měna, procento, doba trvání, hodnocení hvězdičkami, telefon, čárový kód.',
					'<strong>Osm zobrazení</strong>: k šesti dalším přibývá <strong>galerie</strong> a <strong>seznam</strong>; <strong>osobní zobrazení</strong> pro každého čtenáře, uzamčená zobrazení, ruční řazení, závislosti na časové ose. <a href="/fonctionnalites/vues/">Zobrazení</a>',
					'<strong>Mřížka</strong>: rychlé hledání, seskupování, souhrn sloupce za celý filtr, barvy podle pravidel, výška řádků.',
					'<strong>Sdílená zobrazení</strong> jen pro čtení, která lze vložit na jiný web; z kalendáře se stane <strong>kanál iCalendar</strong> pro Kalendář Google, Outlook nebo Kalendář Apple. <a href="/fonctionnalites/vues-partagees/">Sdílení</a>',
					'<strong>Spolupráce</strong>: komentáře a zmínky, oznámení, zápisy ostatních v reálném čase, přítomnost na tabulce a na řádku. <a href="/fonctionnalites/collaboration/">Společná práce</a>',
					'<strong>Ctrl+Z</strong> vrátí poslední zápis – buňku, přesunutou kartu, celý import – a raději odmítne, než aby přepsal to, co mezitím změnil někdo jiný.',
					'<strong>Automatizace</strong>: když je řádek vytvořen nebo upraven, v pevný čas nebo kliknutím na tlačítko – upravit, vytvořit, upozornit, zavolat webhook, napsat do Slacku. <a href="/fonctionnalites/automatisations/">Automatizovat</a>',
					'<strong>Rozhraní</strong>: řídicí panely – čísla, grafy, seznamy, texty – čtené s oprávněními každého. <a href="/fonctionnalites/tableaux-de-bord/">Řídicí panely</a>',
					'<strong>Integrace</strong>: kanál Slacku a <strong>synchronizované tabulky</strong> z online CSV, z kalendáře nebo ze zobrazení jiného basedb. <a href="/integrations/synchronisation/">Integrace</a>',
					'<strong>Šablony databází</strong>: galerie deseti šablon, databáze popsaná AI jednou větou a možnost uložit jako šablonu kteroukoli databázi. <a href="/modeles/">Galerie</a>',
					'<strong>Oprávnění</strong>: obrazovku Struktura lze bez úrovně Správa jen prohlížet.',
					'<strong>Nová identita</strong>: logo, paleta barev a přepracovaná přihlašovací obrazovka.',
				],
			},
			simpler: {
				date: '2026-09-26',
				title: 'Jednodušší rozhraní',
				items: [
					'<strong>Postranní panel</strong> už vypisuje jen databáze a jejich tabulky; obrazovky otevřené databáze – Struktura, Historie, Rozhraní, Automatizace – jsou soustředěny v jednom bloku, těsně nad profilem.',
					'<strong>Nabídka profilu</strong> obsahuje to, co nejsou data: dokumentaci API a MCP, integrace, uživatele a oprávnění.',
					'<strong>Dotaz SQL</strong> se otevírá přes „+“ na liště záložek nebo z nabídky databáze, bez duplikátu v postranním panelu.',
					'<strong>Nová databáze</strong> nabízí šablony a AI přímo v dialogu; ukázková databáze prochází stejnou galerií.',
					'<strong>Obrazovka už nenabízí to, co by bylo odmítnuto</strong>: žádná tlačítka struktury bez úrovně Správa, žádné „Odstranit“ bez oprávnění odstraňovat; a čtenář si vytváří vlastní zobrazení, místo aby narazil na chybovou zprávu.',
					'<strong>Systémové sloupce</strong> jsou zařazeny pod „Systémové informace“, místo aby se nabízely u každé tabulky.',
					'<strong>Detail řádku</strong> získává své komentáře, tlačítko pro napsání e-mailu nebo zavolání a hodnocení nastavitelné jedním kliknutím.',
					'<strong>Přihlášení</strong> opouští animované 3D pozadí ve prospěch lehké obrazovky, která respektuje předvolbu „omezit pohyb“.',
				],
			},
			environments: {
				date: '2026-09-26',
				title: 'Prostředí, sdílené formuláře, zobrazení',
				items: [
					'<strong>Prostředí</strong>: produkční, testovací a vývojové pro tutéž databázi; porovnání vedle sebe, plán migrace, synchronizace řádků.',
					'<strong>Historie struktury</strong>: každé vytvoření nebo úprava tabulky a pole, zachycené triggerem nad katalogem.',
					'<strong>Sdílené formuláře</strong>: veřejný odkaz nebo jen pro členy, uzavření k datu nebo po určitém počtu odpovědí, připsání odpovědí v historii.',
					'<strong>Šest zobrazení</strong>: mřížka, kanban, kalendář, časová osa, formulář, dotazník.',
					'<strong>Historie dat</strong>: vrácení změny, obnovení odstraněného řádku.',
					'<strong>AI</strong>: možnost AI u libovolného pole a Copilot.',
					'<strong>Vazba</strong> a <strong>URL</strong>: dva samostatné typy; dlouhý text se píše v Markdownu.',
					'<strong>Webhooky</strong> podepsané a doručované v pořadí, <strong>návrhy agentů</strong> ke schválení.',
					'<strong>Docker</strong>: Dockerfile se třemi cíli, kompletní docker-compose, volitelná proxy HTTPS.',
				],
			},
			projects: {
				date: '2026-09-25',
				title: 'Projekty, oprávnění, server MCP',
				items: [
					'<strong>Projekty</strong> nad databázemi a oprávnění podle <strong>skupin</strong> ve čtyřech úrovních: Bez přístupu, Čtení, Úpravy, Správa.',
					'<strong>Účty</strong>: dočasné heslo, jeho změna při prvním přihlášení, privilegovaná relace pro administraci.',
					'<strong>Server MCP</strong> a relé stdio; <strong>integrační tokeny</strong> společné pro REST API a MCP.',
					'<strong>Generovaná dokumentace</strong> „API a MCP“ pro každou databázi.',
				],
			},
			fields: {
				date: '2026-09-20',
				title: 'Pole, jednoduché výběry, import',
				items: [
					'Úprava pole a možností jednoduchého výběru.',
					'<strong>Import</strong> souborů CSV a JSON.',
					'Nabídka tabulky: přejmenovat, popsat, odstranit.',
				],
			},
			firstCommit: {
				date: '2026-09-20',
				title: 'První commit',
				items: [
					'Monorepo: pojmenování, registr chybových kódů, katalog převzatý z architektonického dokumentu, jádro, API, rozhraní.',
				],
			},
		},
	},
	roadmap: {
		label: 'Plán vývoje',
		title: 'Co přijde dál',
		intro: 'basedb je v aktivním vývoji. Tato stránka říká, co ještě chybí, bez slibovaných termínů. Máte nápad nebo potřebu? <a href="https://github.com/eodia/basedb/issues">Založte issue</a>. Co už je hotové: <a href="/nouveautes/">novinky</a>.',
		columns: {
			next: {
				title: 'Brzy',
				items: {
					restoreTable: {
						title: 'Obnovení samotné tabulky',
						text: 'Odstraněná tabulka zůstává čitelná v SQL pod svým odsunutým názvem; její samostatné obnovení z rozhraní teprve přijde.',
					},
					aiSettings: {
						title: 'Nastavení AI v rozhraní',
						text: 'Poskytovatel, model a klíč pro každý pracovní prostor, bez nastavování prostředí API.',
					},
					mail: {
						title: 'Oznámení a pozvánky e-mailem',
						text: 'Zmínky, odpovědi a přiřazení dnes přicházejí v basedb, pozvánky jako odkaz, který pošlete sami; budou moci odcházet i e-mailem.',
					},
				},
			},
			later: {
				title: 'Později',
				items: {
					formLinks: {
						title: 'Vazby a soubory ve sdílených formulářích',
						text: 'Omezené vyhledávání v propojené tabulce, omezené nahrávání souborů pro neznámé osoby.',
					},
					moreEvents: {
						title: 'Více oznamovaných událostí',
						text: 'Upozornění na odpověď ve formuláři, na návrh agenta, na deaktivovaný webhook.',
					},
					sqlViewsAcross: {
						title: 'Pohledy SQL napříč prostředími',
						text: 'Kopírování pohledů SQL spolu se strukturou při vytváření nebo porovnávání prostředí a v šablonách databází.',
					},
					loops: {
						title: 'Smyčky a čekání v automatizacích',
						text: 'Opakování kroků pro každý nalezený řádek, čekání před dalším krokem („tři dny poté“) a přenášení toků v šablonách databází.',
					},
					textFormulas: {
						title: 'Vzorce pro text',
						text: 'Vyjmutí, nahrazení nebo zkrácení části textu.',
					},
					bulk: {
						title: 'Deklarované hromadné operace',
						text: 'Úpravy tisíců řádků zaznamenané v historii jako jediná operace.',
					},
					tombstones: {
						title: 'Vyčištění náhrobků',
						text: 'Úklid stop po odstranění, které už nejsou potřeba.',
					},
				},
			},
		},
	},
	gallery: {
		label: 'Šablony',
		title: 'Databáze připravená za pár sekund',
		intro: 'Každá šablona vytvoří propojené tabulky, ukázkové řádky, zobrazení, řídicí panel, automatizace – a pole, která vyplňuje sama AI. V basedb: <strong>Nová databáze</strong>, pak <strong>Začít ze šablony</strong>. Nic nevyhovuje? Popište svou potřebu jednou větou: AI vám navrhne databázi na míru.',
		filter: 'Filtrovat podle kategorie',
		all: 'Všechny',
		otherCategory: 'Ostatní',
		ai: '✦ AI',
		tables: {
			one: '{n} tabulka',
			few: '{n} tabulky',
			many: '{n} tabulky',
			other: '{n} tabulek',
		},
		rows: {
			one: '{n} řádek',
			few: '{n} řádky',
			many: '{n} řádku',
			other: '{n} řádků',
		},
		views: {
			one: '{n} zobrazení',
			few: '{n} zobrazení',
			many: '{n} zobrazení',
			other: '{n} zobrazení',
		},
		howtoTitle: 'Zápis šablon v JSON',
		howto: 'Šablona je soubor JSON: její tabulky, pole, vazby, řádky, zobrazení, řídicí panely, automatizace a pokyny jejích polí AI. Šablony na této stránce jsou soubory ze složky <a href="https://github.com/eodia/basedb/tree/main/packages/templates/catalog"><code>packages/templates/catalog</code></a> v repozitáři; každá instance basedb čte <a href="/modeles/catalogue.json"><code>catalogue.json</code></a> a nabízí je svým uživatelům. Správce může do své instance importovat i vlastní šablony a jako šablonu lze uložit kteroukoli databázi.',
		format: {
			href: '/fonctionnalites/modeles/',
			label: 'Formát šablon →',
		},
		back: '← Všechny šablony',
		defaultCategory: 'Šablona',
		sampleRows: {
			one: '{n} ukázkový řádek',
			few: '{n} ukázkové řádky',
			many: '{n} ukázkového řádku',
			other: '{n} ukázkových řádků',
		},
		aiTitle: 'Co počítá AI',
		useTitle: 'Použít tuto šablonu',
		useSteps: [
			'V basedb <strong>Nová databáze</strong>.',
			'<strong>Začít ze šablony</strong>, pak „{label}“.',
		],
		create: '<strong>Vytvořit databázi</strong>.',
		createWithAi: '<strong>Vytvořit databázi</strong> – a pokud chcete, souhlasit s tím, aby pole AI počítal váš poskytovatel AI.',
		download: 'Stáhnout JSON',
		downloadNote: 'K importu do vaší instance nebo k úpravě, než ji navrhnete do katalogu.',
		viewMeta: '– {kind}, {table}',
		dashboard: '<strong>Řídicí panel</strong> „{label}“ – {blocks}',
		blocks: {
			one: '{n} blok',
			few: '{n} bloky',
			many: '{n} bloku',
			other: '{n} bloků',
		},
		automation: '<strong>Automatizace</strong> „{label}“',
		yes: 'Ano',
		no: 'Ne',
		me: 'Vy',
		kinds: {
			short_text: 'Krátký text',
			long_text: 'Dlouhý text',
			rich_text: 'Formátovaný text',
			number: 'Číslo',
			boolean: 'Zaškrtávací políčko',
			date: 'Datum',
			datetime: 'Datum a čas',
			select: 'Jednoduchý výběr',
			multi_select: 'Vícenásobný výběr',
			url: 'URL',
			email: 'E-mail',
			user: 'Osoba',
			autonumber: 'Automatické číslo',
			formula: 'Vzorec',
			lookup: 'Vyhledávání',
			rollup: 'Agregace',
			count: 'Počet',
			button: 'Tlačítko',
			link: 'Vazba',
			multi_link: 'Vícenásobná vazba',
		},
		viewKinds: {
			grid: 'Mřížka',
			kanban: 'Kanban',
			calendar: 'Kalendář',
			timeline: 'Časová osa',
			gallery: 'Galerie',
			list: 'Seznam',
			form: 'Formulář',
		},
	},
	templates: {
		demo: {
			label: 'Ukázka: Ateliér Lumen',
			summary: 'Malá agentura, její klienti, projekty, úkoly, faktury a recenze: všechny stránky basedb v jediné databázi.',
			description: 'Ukázková databáze. Ateliér Lumen je smyšlené designové studio. Jeho databáze ukazuje vazby mezi tabulkami, vyhledávání a agregace (obrat podle zákazníka, průměrné hodnocení), vzorce (částka s DPH, zpoždění), tři pole počítaná AI nad zákaznickými recenzemi (sentiment, téma, navržená odpověď), všechny druhy zobrazení – mřížku, kanban, kalendář, časovou osu se závislostmi, galerii, seznam, formulář –, řídicí panel a dvě automatizace.',
			category: 'Ukázka',
			tags: ['AI', 'Vazby', 'Všechna zobrazení', 'Řídicí panel'],
		},
		'analyse-avis': {
			label: 'Analýza zákaznických recenzí',
			summary: 'Sbírejte recenze a nechte AI určit sentiment, témata, naléhavost a návrh odpovědi.',
			description: 'Pro obchod, restauraci nebo značku: recenze přicházejí z veřejného formuláře nebo z importu a AI každou z nich přečte. Určí sentiment, najde hlavní téma, označí ty, které vyžadují rychlou odpověď, vytáhne návrh zákazníka a připraví odpověď ke kontrole. Produkty sčítají průměrné hodnocení a počet recenzí; řídicí panel sleduje spokojenost.',
			category: 'Péče o zákazníky',
			tags: ['AI', 'Formulář', 'Řídicí panel'],
		},
		'base-connaissances': {
			label: 'Znalostní báze',
			summary: 'Články nápovědy a dotazy zákazníků: AI shrnuje, třídí a navrhuje odpověď na základě článků.',
			description: 'Pro oddělení podpory. Články nápovědy jsou řazeny podle kategorií a sledovány v čase; dotazy zákazníků přicházejí přes veřejný formulář. AI shrne každý článek a ohodnotí jeho úroveň, zařadí každý dotaz a připraví koncept odpovědi ke kontrole.',
			category: 'Podpora',
			tags: ['AI', 'Formulář', 'Seznam'],
		},
		'calendrier-editorial': {
			label: 'Redakční kalendář',
			summary: 'Články, příspěvky a newslettery naplánované v kalendáři; AI navrhuje úvodní háčky a klíčová slova.',
			description: 'Pro marketingový tým nebo redakci. Každý obsah postupuje od nápadu k publikaci, má místo v kalendáři vydání a patří ke kampani. AI z briefu navrhne úvodní háček a klíčová slova a formulář umožní celé firmě navrhnout téma.',
			category: 'Marketing',
			tags: ['AI', 'Kalendář', 'Kanban', 'Formulář'],
		},
		crm: {
			label: 'Obchodní CRM',
			summary: 'Firmy, kontakty a obchodní příležitosti: obchodní pipeline, komunikace a AI, která radí další krok.',
			description: 'Jednoduché CRM pro obchodní tým. Příležitosti postupují pipeline a nesou částku váženou svou pravděpodobností; AI z poznámek posoudí jejich riziko a poradí další krok. Komunikace se zákazníky se zaznamenává a shrnuje a firmy sčítají, co představují.',
			category: 'Prodej',
			tags: ['AI', 'Pipeline', 'Kanban', 'Kalendář'],
		},
		evenements: {
			label: 'Akce a přihlášky',
			summary: 'Konference, workshopy a webináře: přihlášky, volná místa a zpětná vazba účastníků, kterou čte AI.',
			description: 'Pro pořádání opakovaných akcí. Každá akce počítá své přihlášené a zbývající místa; přihlášky postupují až k účasti. Po akci zanechají účastníci zpětnou vazbu, kterou AI roztřídí podle sentimentu a shrne. Veřejný formulář umožňuje přihlásit se k odběru novinek.',
			category: 'Pořádání akcí',
			tags: ['AI', 'Kalendář', 'Formulář', 'Agregace'],
		},
		'gestion-projet': {
			label: 'Řízení projektů',
			summary: 'Projekty, úkoly a milníky: plán, závislosti mezi úkoly, kanban a kalendář.',
			description: 'Pro řízení více projektů souběžně. Každý projekt sčítá své úkoly a hodiny; úkoly se sledují v kanbanu, plánují se na časové ose, která vykresluje jejich závislosti, a milníky se čtou v kalendáři. AI z popisu a postupu projektu připraví pro vedení přehled o stavu projektu.',
			category: 'Organizace',
			tags: ['Časová osa', 'Závislosti', 'Kanban', 'AI'],
		},
		inventaire: {
			label: 'Sklad a zásoby',
			summary: 'Položky, dodavatelé a pohyby: zásoba se počítá sama a výpadky jsou vidět předem.',
			description: 'Pro dílnu, obchod nebo provozní oddělení. Každý příjem nebo výdej je pohyb; zásoba každé položky je jejich součtem, její hodnota vzorcem a položky pod minimální zásobou se objeví v zobrazení „À commander“ (k objednání). AI napíše popis každé položky podle jejího názvu a kategorie.',
			category: 'Provoz',
			tags: ['Agregace', 'Vzorce', 'Galerie', 'AI'],
		},
		recrutement: {
			label: 'Nábor',
			summary: 'Otevřené pozice, kandidáti a pohovory; AI shrne každou přihlášku a navrhne body k prověření.',
			description: 'Sledování náboru od přihlášky po nástup. Kandidáti se hlásí přes veřejný formulář, postupují krok za krokem v kanbanu a pohovory se plánují v kalendáři. AI čte motivační dopis a poznámky: shrnutí a otázky, které položit u pohovoru. Pomáhá číst, nerozhoduje.',
			category: 'Lidské zdroje',
			tags: ['AI', 'Formulář', 'Kanban', 'Kalendář'],
		},
		'suivi-tickets': {
			label: 'Sledování tiketů',
			summary: 'Chyby a požadavky tříděné AI, sledované po sprintech až do vyřešení, s formulářem pro nahlášení.',
			description: 'Správa tiketů pro produktový tým. Každý tiket patří ke komponentě a ke sprintu; AI navrhne kategorii, odhadne závažnost a shrne hlášení. Kanban sleduje postup, časová osa ukazuje sprinty, formulář umožní komukoli nahlásit problém a automatizace zaznamená datum vyřešení.',
			category: 'Produkt a technika',
			tags: ['AI', 'Kanban', 'Formulář', 'Sprinty'],
		},
	},
} satisfies DeepPartial<Dict>;
