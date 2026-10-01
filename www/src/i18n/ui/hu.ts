/**
 * The Hungarian texts of the landing pages, laid over the French ones (`fr.ts`).
 *
 * See `../README.md`.
 */
import type { DeepPartial, Dict } from './index';

export default {
	meta: {
		home: {
			title: 'basedb – közös használatú adatbázis, amelyben minden tábla valódi PostgreSQL-tábla',
			description: 'Rács és tíz nézet, képletek, megosztott űrlapok, kvízek és nézetek, megjegyzések, automatizálások, irányítópultok, mezőszintű jogosultságok, teljes előzmények, REST API és MCP-szerver – valódi, beszédes nevű PostgreSQL-táblákon. Saját üzemeltetésű, AGPL-3.0.',
		},
		changelog: {
			title: 'Újdonságok – basedb',
			description: 'Mi változott a basedb-ben, verzióról verzióra.',
		},
		roadmap: {
			title: 'Ütemterv – basedb',
			description: 'Ami a basedb-ben ezután jön.',
		},
		gallery: {
			title: 'Sablonok – basedb',
			description: 'Azonnal használható adatbázisok: hibajegykezelés, véleményelemzés, CRM, toborzás… példasoraikkal, nézeteikkel, irányítópultjaikkal és MI által számított mezőikkel.',
		},
		template: {
			title: '{label} – basedb-sablonok',
		},
	},
	eodia: {
		home: 'https://eodia.com/',
		about: 'https://eodia.com/about/',
		contact: 'https://eodia.com/contact/',
	},
	demo: {
		short: 'Demó',
		cta: 'Demó kipróbálása',
	},
	nav: {
		aria: 'Fő navigáció',
		home: 'basedb – kezdőlap',
		links: [
			{
				href: '/#fonctionnalites',
				label: 'Funkciók',
			},
			{
				href: '/modeles/',
				label: 'Sablonok',
			},
			{
				href: '/guides/introduction/',
				label: 'Dokumentáció',
			},
			{
				href: '/nouveautes/',
				label: 'Újdonságok',
			},
		],
		developers: 'Fejlesztők',
		github: 'A basedb GitHub-tárolója',
		install: 'Telepítés',
		menu: {
			open: 'Menü megnyitása',
			close: 'Menü bezárása',
			features: {
				label: 'Funkciók',
				groups: {
					organize: {
						title: 'Rendszerezés',
						items: {
							tables: {
								href: '/fonctionnalites/tables-et-champs/',
								title: 'Táblák és mezők',
								text: 'Mezők mindenre, kapcsolatok és képletek, mint egy táblázatkezelőben.',
							},
							views: {
								href: '/fonctionnalites/vues/',
								title: 'Tíz nézet',
								text: 'Rács, kanban, naptár, idővonal, galéria, lista, térkép, űrlap, kérdőív, kvíz.',
							},
							forms: {
								href: '/fonctionnalites/formulaires-partages/',
								title: 'Űrlapok',
								text: 'Egy megosztható hivatkozás: minden válasz egy sor lesz.',
							},
							files: {
								href: '/fonctionnalites/fichiers/',
								title: 'Fájlok és képek',
								text: 'Árajánlatok, fotók, szerződések, a soruknál tárolva.',
							},
						},
					},
					collaborate: {
						title: 'Együttműködés',
						items: {
							live: {
								href: '/fonctionnalites/collaboration/',
								title: 'Valós idő és megjegyzések',
								text: 'Lássa, amint mások dolgoznak, kommentáljon egy sort, említsen meg egy kollégát.',
							},
							rights: {
								href: '/fonctionnalites/droits/',
								title: 'Jogosultságok és csapatok',
								text: 'Ki mit lát, és ki mit módosíthat, akár oszlopszinten is.',
							},
							history: {
								href: '/fonctionnalites/historique/',
								title: 'Előzmények',
								text: 'Minden módosítás megőrződik, és visszavonható.',
							},
							shared: {
								href: '/fonctionnalites/vues-partagees/',
								title: 'Megosztott nézetek',
								text: 'Egy nézet egy hivatkozással, a saját webhelyén vagy a naptárában.',
							},
						},
					},
					automate: {
						title: 'Automatizálás és elemzés',
						items: {
							automations: {
								href: '/fonctionnalites/automatisations/',
								title: 'Automatizálások',
								text: 'Amikor egy sor megváltozik: értesítés, létrehozás, írás, MI megkérdezése.',
							},
							dashboards: {
								href: '/fonctionnalites/tableaux-de-bord/',
								title: 'Irányítópultok',
								text: 'Tizenöt vizualizáció, közös szűrők, egy megosztható hivatkozás.',
							},
							ai: {
								href: '/fonctionnalites/ia/',
								title: 'MI és Copilot',
								text: 'Egy adatbázis egy mondatban, mezők, amelyek önmagukat töltik ki.',
							},
							templates: {
								href: '/modeles/',
								title: 'Sablonok',
								text: 'Tíz azonnal használható adatbázis, testre szabható.',
							},
						},
					},
				},
				feature: {
					tag: 'Újdonság',
					title: 'Automatizálások folyamatként',
					text: 'Keresés, döntés, MI megkérdezése: egy gráfszerkesztő, és minden futtatás lépésről lépésre visszanézhető.',
					href: '/nouveautes/',
					cta: 'Minden újdonság',
				},
				all: 'Minden funkció',
			},
			solutions: {
				label: 'Megoldások',
				title: 'Minden csapatnak',
				items: {
					crm: {
						team: 'Értékesítés',
						text: 'Folyamat, kapcsolatok, utókövetés.',
					},
					recrutement: {
						team: 'Emberi erőforrások',
						text: 'Jelentkezések, interjúk, MI által készített összefoglalók.',
					},
					'calendrier-editorial': {
						team: 'Marketing',
						text: 'Ütemezett cikkek, bejegyzések és hírlevelek.',
					},
					inventaire: {
						team: 'Műveletek',
						text: 'Egy kiszámított készlet, előre látható hiányokkal.',
					},
					'gestion-projet': {
						team: 'Projektek',
						text: 'Mérföldkövek, feladatok és függőségek.',
					},
					'suivi-tickets': {
						team: 'Termék',
						text: 'Az MI által rendszerezett hibák és kérések.',
					},
					'base-connaissances': {
						team: 'Ügyfélszolgálat',
						text: 'Súgócikkek, kérdések, javasolt válaszok.',
					},
					evenements: {
						team: 'Rendezvények',
						text: 'Regisztrációk, helyek, visszajelzések.',
					},
					'analyse-avis': {
						team: 'Ügyfélkapcsolat',
						text: 'Az MI által olvasott és osztályozott vélemények.',
					},
				},
				ask: {
					title: 'Más jár a fejében?',
					text: 'Írja le az igényét egy mondatban: az MI egyedi adatbázist javasol.',
					href: '/modeles/',
				},
				all: 'Minden sablon',
			},
			developers: {
				label: 'Fejlesztők',
				groups: {
					build: {
						title: 'Integrálás',
						items: {
							api: {
								href: '/integrations/api-rest/',
								title: 'REST API',
								text: 'Ugyanazok az adatok, mint a felületen, OpenAPI 3.1-ben leírva.',
							},
							mcp: {
								href: '/integrations/mcp/',
								title: 'MCP-szerver',
								text: 'Eszközök az MI-ügynökeinek, az Ön jogosultságai szerint.',
							},
							webhooks: {
								href: '/integrations/webhooks/',
								title: 'Webhookok',
								text: 'Minden írás aláírva, sorrendben, újrapróbálva.',
							},
							sql: {
								href: '/integrations/sql/',
								title: 'Közvetlen SQL',
								text: 'Valódi PostgreSQL-táblák, beszédes nevekkel.',
							},
							sync: {
								href: '/integrations/synchronisation/',
								title: 'Szinkronizálás',
								text: 'Táblák, amelyeket máshonnan tartanak naprakészen.',
							},
						},
					},
					host: {
						title: 'Üzemeltetés',
						items: {
							docker: {
								href: '/hebergement/docker/',
								title: 'Docker Compose',
								text: 'Egy image, egy PostgreSQL-adatbázis, egyetlen port.',
							},
							env: {
								href: '/hebergement/variables/',
								title: 'Változók',
								text: 'Minden a .env fájlban állítható be.',
							},
							https: {
								href: '/hebergement/https/',
								title: 'Domain és HTTPS',
								text: 'A saját proxyja mögött, vagy a mellékelt Caddyval.',
							},
							sso: {
								href: '/hebergement/connexion/',
								title: 'Bejelentkezés és SSO',
								text: 'Google, Microsoft, bármely OpenID Connect-szolgáltató.',
							},
							backup: {
								href: '/hebergement/sauvegardes/',
								title: 'Biztonsági mentések és frissítések',
								text: 'pg_dump, és frissítések adatvesztés nélkül.',
							},
						},
					},
				},
				feature: {
					title: 'A fejlesztők oldala',
					text: 'Valódi PostgreSQL-tábla minden rács mögött.',
					href: '/developpeurs/',
				},
			},
			resources: {
				label: 'Források',
				groups: {
					learn: {
						title: 'Tanulás',
						items: {
							docs: {
								href: '/guides/introduction/',
								title: 'Dokumentáció',
								text: 'A teljes basedb, lépésről lépésre.',
							},
							start: {
								href: '/guides/premiers-pas/',
								title: 'Első lépések',
								text: 'Egy első adatbázis, az importálástól a nézetig.',
							},
							install: {
								href: '/guides/installation/',
								title: 'Telepítés',
								text: 'Két fájl és egy parancs.',
							},
							principles: {
								href: '/architecture/principes/',
								title: 'Az alapelvek',
								text: 'Hogyan épül fel a basedb, és miért.',
							},
						},
					},
					follow: {
						title: 'A projekt követése',
						items: {
							news: {
								href: '/nouveautes/',
								title: 'Újdonságok',
								text: 'Ami változott, verzióról verzióra.',
							},
							roadmap: {
								href: '/feuille-de-route/',
								title: 'Ütemterv',
								text: 'Ami ezután jön.',
							},
							github: {
								href: 'https://github.com/eodia/basedb',
								title: 'GitHub',
								text: 'A kód, a hibajegyek, a verziók.',
							},
							eodia: {
								href: 'https://eodia.com/',
								title: 'Eodia',
								text: 'A stúdió, amely a basedb-t készíti.',
							},
						},
					},
				},
			},
		},
	},
	language: {
		label: 'Nyelv',
		current: 'Nyelv: {name}',
	},
	footer: {
		tagline: 'A közös használatú adatbázis, amelyben minden tábla valódi PostgreSQL-tábla.',
		madeBy: 'Az <a class="eodia" href="https://eodia.com/">Eodia</a>, egy MI-natív szoftverstúdió szabad szoftvere.',
		columns: {
			product: {
				title: 'Termék',
				links: [
					{
						href: '/#fonctionnalites',
						label: 'Funkciók',
					},
					{
						href: '/nouveautes/',
						label: 'Újdonságok',
					},
					{
						href: '/feuille-de-route/',
						label: 'Ütemterv',
					},
					{
						href: '/#faq',
						label: 'Gyakori kérdések',
					},
				],
			},
			docs: {
				title: 'Dokumentáció',
				links: [
					{
						href: '/guides/introduction/',
						label: 'Bevezetés',
					},
					{
						href: '/guides/installation/',
						label: 'Telepítés',
					},
					{
						href: '/integrations/api-rest/',
						label: 'REST API',
					},
					{
						href: '/integrations/mcp/',
						label: 'MCP-szerver',
					},
				],
			},
			hosting: {
				title: 'Üzemeltetés',
				links: [
					{
						href: '/hebergement/docker/',
						label: 'Docker Compose',
					},
					{
						href: '/hebergement/variables/',
						label: 'Környezeti változók',
					},
					{
						href: '/hebergement/https/',
						label: 'Domain és HTTPS',
					},
					{
						href: '/hebergement/sauvegardes/',
						label: 'Biztonsági mentések',
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
						label: 'Architektúra-dokumentum',
					},
					{
						href: 'https://github.com/eodia/basedb/blob/main/LICENSE',
						label: 'AGPL-3.0 licenc',
					},
					{
						href: 'https://github.com/eodia/basedb/issues',
						label: 'Hiba bejelentése',
					},
				],
			},
			eodia: {
				title: 'Eodia',
				links: [
					{
						href: 'https://eodia.com/',
						label: 'A stúdió',
					},
					{
						href: 'https://eodia.com/about/',
						label: 'Rólunk',
					},
					{
						href: 'https://eodia.com/contact/',
						label: 'Kapcsolat',
					},
				],
			},
		},
		copyright: '© {year} <a href="https://eodia.com/">Eodia</a> · AGPL-3.0-or-later',
		builtWith: 'A webhely az Astro és a Starlight segítségével készült.',
	},
	docsFooter: {
		madeBy: 'A basedb az <a href="https://eodia.com/">Eodia</a>, egy MI-natív szoftverstúdió szabad szoftvere.',
	},
	teams: {
		meta: {
			title: 'basedb – közös használatú adatbázis az egész csapatnak',
			description: 'Minden munkája egy helyen, amelyet az egész csapat egyszerre módosít: táblázatban, kanbanon vagy naptárban, űrlapokkal, irányítópultokkal, automatizálásokkal és MI-vel. Kód nélkül, szabad és ingyenes.',
		},
		hero: {
			eyebrow: 'basedb',
			title: 'Minden munkája.',
			titleAccent: 'Végre egy helyen.',
			lead: 'Táblázatok, naptárak, űrlapok, irányítópultok és automatizálások, az egész csapat számára. Olyan egyszerű, mint egy táblázatkezelő. Egy sornyi kód nélkül.',
			primary: 'Sablonok felfedezése',
			secondary: 'Demó megtekintése',
			facts: ['Kód nélkül', 'Szabad és ingyenes', 'Az adatai Önnél maradnak'],
		},
		story: {
			grid: {
				title: 'Az egész csapat, ugyanabban a táblában.',
				text: 'Mindenki egyszerre dolgozik benne, és mindenki ugyanazt látja, naprakészen.',
			},
			copilot: {
				title: 'Kérdezzen. A Copilot elvégzi.',
				text: '„Kit kell felhívnom ezen a héten?” — felkínálja a megfelelő szűrőt, amelyet egy kattintással alkalmaz.',
			},
			kanban: {
				title: 'Húzza. Máris naprakész.',
				text: 'Minden szakasz egy oszlop lesz; egy kártya áthúzása maga a sor módosítása.',
			},
			calendar: {
				title: 'Minden dátum a helyén.',
				text: 'A találkozók önmaguktól megjelennek, és nyomon követhetők akár a saját naptárában is.',
			},
			dashboard: {
				title: 'És minden, egy pillantással.',
				text: 'A számok maguktól kiszámolódnak, ugyanazokból a sorokból.',
			},
		},
		stage: {
			aria: 'Egy csapat ügyfélkövetése a basedb-ben: táblázat, Copilot, kanban, naptár, irányítópult',
			tabs: {
				grid: 'Táblázat',
				copilot: 'Copilot',
				kanban: 'Kanban',
				calendar: 'Naptár',
				dashboard: 'Irányítópult',
			},
			project: 'Fő projekt',
			projectMeta: 'Projekt · 2 adatbázis',
			filterNav: 'Navigáció szűrése',
			base: 'Értékesítés',
			otherBase: 'Ügyfélszolgálat',
			tables: ['Ügyfelek', 'Kapcsolattartók', 'Árajánlatok'],
			baseSection: 'Adatbázis · Értékesítés',
			screens: ['Irányítópultok', 'Automatizálások'],
			user: 'Léa Martin',
			views: { grid: 'Összes sor', kanban: 'Szakasz szerint', calendar: 'Találkozók' },
			toolbar: {
				filter: 'Szűrés',
				columns: 'Oszlopok',
				group: 'Csoportosítás',
				colors: 'Színek',
				sort: 'Rendezés',
				configure: 'Beállítás',
			},
			search: 'Keresés…',
			add: 'Hozzáadás',
			columns: {
				name: 'Ügyfél',
				status: 'Szakasz',
				owner: 'Felelős',
				amount: 'Összeg',
				next: 'Következő találkozó',
			},
			statuses: {
				contact: 'Kapcsolatfelvétel',
				meeting: 'Találkozó',
				quote: 'Árajánlat elküldve',
				signed: 'Aláírva',
			},
			clients: [
				'Márton Pékség',
				'Hársfa Klinika',
				'Kossuth Lajos Gimnázium',
				'Közösségi Kerékpár',
				'Finomságok Boltja',
				'Tisza Vasművek',
				'Kovács Műhely',
			],
			addRow: 'Sor hozzáadása',
			perPage: 'Sorok oldalanként',
			card: 'Felelős: {owner}, találkozó: {date}',
			addCard: 'Kártya hozzáadása',
			today: 'Ma',
			month: 'Hónap',
			week: 'Hét',
			dashboards: 'Irányítópultok',
			questions: 'Kérdések',
			dashboard: 'Értékesítés követése',
			dashboardText: 'A lényeg egy pillantással.',
			dashboardTabs: ['Áttekintés', 'Tevékenység'],
			period: 'Időszak',
			thisYear: 'Ez az év',
			share: 'Megosztás',
			edit: 'Szerkesztés',
			explore: 'Adatok felfedezése',
			chart: 'Összeg ügyfelenként',
			byStage: 'Ügyfelek szakaszonként',
			kpis: {
				signed: 'Aláírva',
				pending: 'Függő árajánlatok',
				rate: 'Aláírt ügyfelek',
			},
			copilot: {
				question: 'Kit kell felhívnom ezen a héten?',
				thinking: 'Gondolkodás…',
				answer: 'Négy ügyfél várja a választ: két elküldött árajánlat és két előkészítendő találkozó.',
				card: 'Ügyfelek szűrése',
				filter: 'Szakasz: Árajánlat elküldve vagy Találkozó',
				apply: 'Szűrő alkalmazása',
				applied: 'Szűrő alkalmazva',
				placeholder: 'Kérdezze a Copilotot…',
				filtered: '{n} sor szűrve',
			},
		},
		teaser: {
			tabs: { label: 'Videó kiválasztása', short: '40 másodpercben', full: 'A teljes bemutató' },
			titleAccent: '40 másodpercben.',
			text: 'Táblák, nézetek, űrlapok, automatizálások és MI: a basedb lényege, zenével.',
			duration: '40 mp',
			inEnglish: 'A videó szövegei angolul vannak.',
		},

		video: {
			eyebrow: 'Demó',
			title: 'A teljes basedb,',
			titleAccent: 'hét percben.',
			text: 'Adatbázis létrehozása, feltöltése, megosztása, automatizálása, irányítása: a teljes, kommentált bemutató.',
			play: 'Videó lejátszása',
			duration: '6 perc 36 mp',
			chapters: 'Fejezetek',
			captions: 'Angol',
			inEnglish: 'A videó angol nyelvű, angol feliratokkal.',
			list: [
				{ time: '0:10', title: 'Adatbázis létrehozása' },
				{ time: '0:49', title: 'Táblák, mezők és formulák' },
				{ time: '1:31', title: 'Sorok részletei és együttműködés' },
				{ time: '1:56', title: 'Hat nézet ugyanazokon a sorokon' },
				{ time: '2:29', title: 'Űrlapok és kérdőívek' },
				{ time: '3:28', title: 'Kvízek' },
				{ time: '4:10', title: 'Automatizálások' },
				{ time: '4:39', title: 'Irányítópultok' },
				{ time: '4:59', title: 'SQL mindenkinek' },
				{ time: '5:30', title: 'Előzmények és jogosultságok' },
				{ time: '5:53', title: 'API, MCP és Copilot' },
			],
		},
		together: {
			eyebrow: 'Együttműködés',
			title: 'Mindenki.',
			titleAccent: 'Egyszerre.',
			text: 'A többiek módosításai azonnal megjelennek. Látja, ki melyik sort nézi, ott beszélhet róla, ahol az található, és egy @ elég egy kollégája értesítéséhez.',
			demo: {
				path: 'Értékesítés / Árajánlatok',
				here: '3 személy ezen a táblán',
				columns: {
					client: 'Ügyfél',
					status: 'Szakasz',
					amount: 'Összeg',
					due: 'Határidő',
				},
				statuses: {
					draft: 'Piszkozat',
					sent: 'Elküldve',
					signed: 'Aláírva',
				},
				rows: [
					'Márton Pékség',
					'Hársfa Klinika',
					'Kossuth Lajos Gimnázium',
					'Közösségi Kerékpár',
					'Finomságok Boltja',
					'Tisza Vasművek',
				],
				comment: '@{name} tudod jóváhagyni ezt az árajánlatot ma estig?',
				reply: 'Jóváhagyva!',
				toast: '{name} módosította: „{field}”',
			},
			points: {
				live: {
					title: 'Valós időben',
					text: 'Minden módosítás azonnal megjelenik a többieknél, az oldal újratöltése nélkül.',
				},
				comments: {
					title: 'Megjegyzések és említések',
					text: 'Kommentálhat egy sort, megemlíthet egy kollégát @-tal, és a csengő értesíti.',
				},
				undo: {
					title: 'Kockázat nélküli visszavonás',
					text: 'A Ctrl+Z az Ön utolsó módosítását vonja vissza — soha nem egy kollégáét.',
				},
			},
			link: {
				href: '/fonctionnalites/collaboration/',
				label: 'Közös munka',
			},
		},
		forms: {
			eyebrow: 'Űrlapok és kérdőívek',
			title: 'Tegye fel kérdéseit.',
			titleAccent: 'A válaszok maguktól rendeződnek.',
			text: 'Egy egyoldalas űrlap, vagy egy kérdőív, amely képernyőnként egy kérdést tesz fel, az Ön arculatában: ossza meg a linket, és minden válaszból egy sor lesz a táblájában. A válaszadó semmi mást nem lát.',
			modes: {
				label: 'Kérdések megjelenítése',
				survey: 'Kérdőív',
				form: 'Űrlap',
			},
			demo: {
				title: 'Árajánlatkérés',
				description: 'Három kérdés, és 48 órán belül jelentkezünk.',
				count: '3 kérdés',
				start: 'Kezdés',
				ok: 'OK',
				hint: 'vagy Enter',
				submit: 'Ajánlatkérés elküldése',
				org: {
					label: 'Az Ön szervezete',
					answer: 'Tóth Kávézó',
				},
				need: {
					label: 'Az Ön igénye',
					options: ['Weboldal', 'Arculat', 'Katalógus'],
				},
				budget: {
					label: 'Az Ön költségvetése',
					help: 'Áfa nélkül, akár hozzávetőlegesen is.',
				},
				sent: 'Elküldve!',
				thanks: 'Köszönjük! 48 órán belül jelentkezünk.',
				poweredBy: 'Az űrlapot a basedb működteti',
				path: 'Értékesítés / Megkeresések',
				view: 'Összes megkeresés',
				columns: {
					org: 'Szervezet',
					need: 'Igény',
					budget: 'Költségvetés',
					stage: 'Szakasz',
				},
				stages: {
					new: 'Új',
					called: 'Visszahívva',
					quote: 'Árajánlat elküldve',
				},
				rows: ['Márton Pékség', 'Hársfa Klinika', 'Közösségi Kerékpár', 'Tisza Vasművek'],
				open: 'Nyitott',
				answers: {
					one: '{n} válasz',
					other: '{n} válasz',
				},
				active: 'Aktív hivatkozás',
			},
			points: {
				survey: {
					title: 'Kérdésenként egy képernyő',
					text: 'Teljes képernyőn, billentyűzetről: Enter a továbblépéshez, A, B, C a választáshoz — az egyetlen választás magától továbblép, a beküldést pedig megünnepeljük.',
				},
				access: {
					title: 'Nyilvános vagy zárt',
					text: 'Bárki válaszolhat a linkkel, fiók nélkül — vagy csak a bejelentkezett tagok, és a válasz az ő nevüket viseli.',
				},
				closed: {
					title: 'A többi zárva marad',
					text: 'A válaszadás semmi mást nem mutat meg a táblából. A link egy adott dátumkor vagy egy bizonyos számú válasz után zárul.',
				},
			},
			link: {
				href: '/fonctionnalites/formulaires-partages/',
				label: 'Az űrlapok',
			},
		},
		automate: {
			eyebrow: 'Automatizálások',
			title: 'Dolgozik',
			titleAccent: 'amíg Ön alszik.',
			text: 'Amikor egy sor érkezik vagy megváltozik, egy megadott időpontban vagy egy gombkattintásra, a basedb végigviszi a lépéseket: kiválasztja a megfelelő ágat, megkérdezi az MI-t, és értesíti, akit kell. Minden futtatás pedig lépésről lépésre visszanézhető.',
			clock: '03:12',
			crumb: 'Értékesítés / Automatizálások',
			create: 'Új automatizálás',
			list: [
				{
					name: 'Új megkeresés',
					when: 'Sor létrehozásakor',
				},
				{
					name: 'Árajánlat aláírva',
					when: 'Sor módosításakor',
				},
				{
					name: 'Hétfői emlékeztetők',
					when: 'Minden hétfőn 9:00-kor',
				},
			],
			active: 'Aktív',
			test: 'Tesztelés egy soron',
			save: 'Mentés',
			when: 'Mikor',
			trigger: 'Sor létrehozásakor',
			table: 'Tábla: Megkeresések',
			steps: {
				branch: {
					kind: 'Feltétel',
					text: '2 ág',
					run: '„Nagy projekt” ág',
				},
				notify: {
					kind: 'Valaki értesítése',
					text: 'Léa Martin',
					run: '1 személy értesítve',
				},
				create: {
					kind: 'Sor létrehozása',
					text: 'Egy találkozó, a Naptárban',
					run: 'kész',
				},
				slack: {
					kind: 'Küldés Slackre',
					text: 'A #ertekesites csatornán',
					run: 'kész',
				},
				ai: {
					kind: 'MI megkérdezése',
					text: 'Első válasz megírása',
					run: '{n} karakteres válasz',
				},
				update: {
					kind: 'Sor módosítása',
					text: 'Válasz, Szakasz',
					run: 'kész',
				},
			},
			paths: {
				big: 'Nagy projekt',
				condition: 'budget gt 5000',
				otherwise: 'Egyébként',
			},
			answer: 'Jó napot, és köszönjük a megkeresését! Léa, aki az Ön új arculatával foglalkozik majd, holnap reggel felhívja Önt.',
			addStep: 'Lépés hozzáadása',
			tabs: {
				settings: 'Beállítások',
				runs: 'Futtatások',
			},
			runsText: 'Az utolsó 50, 30 napig megőrizve. Válasszon ki egyet, hogy lássa a folyamaton, melyik ágon haladt.',
			running: 'Folyamatban',
			succeeded: 'Sikeres',
			started: 'sor létrehozva · {when}',
			now: 'az imént',
			earlier: ['tegnap 18:40-kor', 'tegnap 11:02-kor'],
			done: 'Sikeres · 5 lépés · 1,3 s',
			points: {
				when: {
					title: 'A megfelelő pillanatban',
					text: 'Egy létrehozott vagy módosított sor, egy megadott időpont, egy gomb — és egy feltétel, hogy csak akkor induljon, amikor kell.',
				},
				paths: {
					title: 'Több ág',
					text: 'Egy feltétel ágakat nyit meg, mindegyiknek megvannak a saját lépései; amit egy lépés talál, arra a következő hivatkozhat.',
				},
				copilot: {
					title: 'Egy mondatban leírva',
					text: '„Amikor egy megkeresés érkezik, értesítsd Léát, ha a költségvetés meghaladja az 5 000 €-t” : a Copilot felépíti a folyamatot, Ön pedig átnézi.',
				},
			},
			link: {
				href: '/fonctionnalites/automatisations/',
				label: 'Az automatizálások',
			},
		},
		glance: {
			eyebrow: 'Irányítópultok',
			title: 'Lásson mindent.',
			titleAccent: 'Egy pillantással.',
			text: 'Számok, grafikonok, célok: az irányítópultjai egérrel épülnek fel a tábláiból, és önmaguktól naprakészek maradnak. Egy szűrő, és az egész irányítópult követi.',
			demo: {
				title: 'Értékesítési áttekintés',
				filters: ['Ez az év', 'Minden város'],
				revenue: 'Árbevétel',
				signed: 'Aláírt árajánlatok',
				rate: 'Aláírási arány',
				goal: 'Éves cél',
				byMonth: 'Árbevétel havonta',
				byStage: 'Árajánlatok szakaszonként',
				stages: ['Elküldve', 'Tárgyalás alatt', 'Aláírva'],
				bySector: 'Ügyfelek ágazatonként',
				sectors: ['Kereskedelem', 'Egészségügy', 'Oktatás', 'Ipar'],
				shared: 'Megosztva hivatkozással',
			},
			points: {
				viz: {
					title: 'Tizenöt vizualizáció',
					text: 'Számok, trendek, célok, grafikonok, szektorok, tölcsérek, kereszttáblák, térképek.',
				},
				filters: {
					title: 'Közös szűrők',
					text: 'Az időszak, egy ügyfél, egy város: egy szűrő vezérelhet egy kártyát, többet, vagy az egész irányítópultot.',
				},
				share: {
					title: 'Megosztva egy hivatkozással',
					text: 'Nyilvános vagy csak a csapatnak, és beágyazható egy másik webhelybe.',
				},
			},
			link: {
				href: '/fonctionnalites/tableaux-de-bord/',
				label: 'Az irányítópultok',
			},
		},
		ai: {
			eyebrow: 'Mesterséges intelligencia',
			title: 'Írja le.',
			titleAccent: 'A basedb megépíti.',
			text: 'Egy mondat elég egy teljes adatbázishoz, amelyet létrehozás előtt átnéz. Ezután a Copilot szűrőket, grafikonokat és automatizálásokat javasol, az MI-mezők pedig összefoglalnak, osztályoznak és megírnak Önnek.',
			prompt: 'Jelentkezések követése három nyitott pozíciónkra, az interjúkkal együtt.',
			thinking: 'Három összekapcsolt tábla, átnézésre készen.',
			tables: {
				jobs: {
					name: 'Pozíciók',
					fields: ['Megnevezés', 'Részleg', 'Megnyitva'],
				},
				people: {
					name: 'Jelöltek',
					fields: ['Név', 'Pozíció', 'Szakasz', 'Összefoglaló'],
				},
				talks: {
					name: 'Interjúk',
					fields: ['Jelölt', 'Dátum', 'Kivel', 'Vélemény'],
				},
			},
			aiField: 'Összefoglaló',
			aiValue: 'Hat év projektmenedzsment-tapasztalat, magabiztos ügyfélkapcsolatok; körüljárandó: az angol nyelvtudás.',
			create: 'Adatbázis létrehozása',
			providers: 'Az Ön által választott szolgáltatóval — OpenAI, Anthropic, Mistral, vagy egy, a saját gépén futó modell. Az Ön jóváhagyása nélkül semmi nem kerül elküldésre.',
			link: {
				href: '/fonctionnalites/ia/',
				label: 'Az MI a basedb-ben',
			},
		},
		features: {
			title: 'Minden, amire szükség van.',
			titleAccent: 'És még sok más.',
			text: 'Minden funkció ugyanazokba a táblákba ír, ugyanazokkal a jogosultságokkal, ugyanazokba az előzményekbe.',
			tiles: {
				views: {
					stat: '10',
					title: 'módja, hogy lássa az adatait',
					text: 'Rács, kanban, naptár, idővonal, galéria, lista, térkép, űrlap, kérdőív és kvíz, ugyanazokon a sorokon. Mindenki a saját nézetét választja.',
					href: '/fonctionnalites/vues/',
				},
				history: {
					stat: 'Ctrl+Z',
					title: 'Semmi nem vész el',
					text: 'Minden módosítás megmarad az előző értékével; egy hiba visszavonható, egy törölt sor visszaállítható.',
					href: '/fonctionnalites/historique/',
				},
				forms: {
					title: 'Űrlapok',
					text: 'Nyilvános vagy csak a csapatnak szánt hivatkozás: minden válasz megérkezik a táblába, anélkül hogy a többi látható lenne.',
					href: '/fonctionnalites/formulaires-partages/',
				},
				viz: {
					stat: '15',
					title: 'vizualizáció',
					text: 'Számok, trendek, célok, grafikonok, szektorok, tölcsérek, kereszttáblák és térképek.',
					href: '/fonctionnalites/tableaux-de-bord/',
				},
				formulas: {
					code: 'IF([Montant] > 10000, "Grand compte", "")',
					title: 'Francia vagy angol nyelvű képletek',
					text: 'Mint egy táblázatkezelőben — SI, ARRONDI, JOURS… vagy IF, ROUND, DAYS — de az egész csapat számára kiszámítva.',
					href: '/fonctionnalites/tables-et-champs/#képletek',
				},
				rights: {
					title: 'Mindenki azt látja, amit kell',
					text: 'Olvasás, szerkesztés, kezelés, csapatról csapatra; egy érzékeny oszlop elrejthető.',
					href: '/fonctionnalites/droits/',
				},
				mentions: {
					bubble: '@Camille',
					title: 'Megjegyzések és említések',
					text: 'Egy sorról ott beszélgethet, ahol az található, és a csengő értesíti.',
					href: '/fonctionnalites/collaboration/',
				},
				relations: {
					title: 'Minden összekapcsolódik',
					text: 'Ügyfelek, projektek, számlák: az összesítések és a kikeresések átlépik a kapcsolatokat.',
					href: '/fonctionnalites/tables-et-champs/',
				},
				templates: {
					stat: '10',
					title: 'kész sablon',
					text: 'CRM, toborzás, készlet, események… vagy egy adatbázis, amelyet egy mondatban ír le az MI-nek.',
					href: '/modeles/',
				},
				import: {
					title: 'Importálás egy mozdulattal',
					text: 'Húzzon be egy Excel-munkafüzetet vagy egy CSV-t: az oszlopokat és a típusokat kitalálja, és létrehozza a táblát.',
					href: '/guides/premiers-pas/',
				},
				agenda: {
					title: 'Akár a saját naptárában is',
					text: 'Egy naptár feliratkozható folyamként a Google Naptárban, az Outlookban vagy az Apple Calendarban.',
					href: '/fonctionnalites/vues-partagees/',
				},
				files: {
					title: 'Fájlok és képek',
					text: 'Árajánlatok, fotók, szerződések; egy kép a kártya borítója lesz.',
					href: '/fonctionnalites/fichiers/',
				},
				share: {
					title: 'Megosztott nézetek',
					text: 'Egy csak olvasható nézet egy hivatkozással, beágyazható a saját webhelyébe.',
					href: '/fonctionnalites/vues-partagees/',
				},
				sync: {
					title: 'Szinkronizált táblák',
					text: 'Naprakészen tartva egy online CSV-ből, egy naptárból vagy egy másik basedb-ből.',
					href: '/integrations/synchronisation/',
				},
				signin: {
					title: 'Egyszerű bejelentkezés',
					text: 'Google, Microsoft vagy jelszó; a kollégákat egy hivatkozással hívhatja meg.',
					href: '/hebergement/connexion/',
				},
				languages: {
					title: 'Az Ön nyelvén',
					text: 'A felület mindenki nyelvét felveszi, húsz közül.',
					href: '/fonctionnalites/droits/#az-ön-beállításai',
				},
			},
		},
		yours: {
			eyebrow: 'Szabad és saját üzemeltetésű',
			per: 'személyenként. Örökre.',
			text: 'A basedb szabad szoftver. Telepítse a saját szerverére, és hívja meg az egész csapatát: nincs előfizetés, nincs licencszámolás, és az adatai Önnél maradnak.',
			points: {
				home: {
					title: 'Önnél',
					text: 'A saját szerverén vagy a szolgáltatójáén, ugyanúgy menthető biztonsági mentésbe, mint bármely PostgreSQL-adatbázis.',
				},
				free: {
					title: 'Szabad',
					text: 'AGPL-3.0 licenc alatt: a kód nyílt, és az is marad.',
				},
				ai: {
					title: 'Az Ön választása szerinti MI',
					text: 'Egy piaci szolgáltató, egy saját gépén futó modell — vagy semmilyen MI.',
				},
			},
			link: {
				href: '/guides/installation/',
				label: 'A basedb telepítése',
			},
		},
		gallery: {
			eyebrow: 'Sablonok',
			title: 'Egy perc alatt kész.',
			text: 'Induljon egy sablonból, tábláival, nézeteivel, irányítópultjával és mintasoraival, majd alakítsa a saját munkamódjára.',
			use: 'Felfedezés',
			ask: {
				title: 'Nincs köztük megfelelő?',
				text: 'Írja le az igényét egy mondatban: az MI egyedi adatbázist javasol.',
			},
			all: 'Minden sablon megtekintése',
			previous: 'Előző sablonok',
			next: 'Következő sablonok',
		},
		developers: {
			title: 'És technikai oldalról?',
			text: 'Minden tábla egy valódi PostgreSQL-tábla. REST API, webhookok, MCP-szerver az MI-ügynököknek, és egy parancsban történő telepítés.',
			link: 'A fejlesztők oldala',
		},
		faq: {
			title: 'Az Ön kérdései',
			items: [
				{
					q: 'Kell tudni kódolni?',
					a: 'Nem. A táblákat, nézeteket, űrlapokat, irányítópultokat és automatizálásokat egérrel hozza létre. A képletek úgy íródnak, mint egy táblázatkezelőben, franciául vagy angolul: SI vagy IF, ARRONDI vagy ROUND, JOURS vagy DAYS…',
				},
				{
					q: 'Mennyibe kerül?',
					a: 'Semmibe: a basedb szabad szoftver, előfizetés és személyenkénti díj nélkül. Csak egy szerverre van szüksége, ahová telepítheti.',
				},
				{
					q: 'Hogyan telepíthető?',
					a: 'Egy szerveren, Dockerrel: két fájl és egy parancs, néhány perc annak, aki az informatikájukkal foglalkozik. A telepítési útmutató lépésről lépésre elmagyaráz mindent.',
				},
				{
					q: 'Átvehetjük a táblázatainkat?',
					a: 'Igen: húzza be a basedb-be az Excel-munkafüzetét, vagy egy CSV-t. Az importálás kitalálja minden oszlop típusát, létrehozza a táblát, és soronként megmondja, mit nem tudott átvenni.',
				},
				{
					q: 'Lehet többen egyszerre dolgozni?',
					a: 'Pontosan erre való. A többiek módosításai azonnal megjelennek, kommentálhat egy sort, megemlíthet egy kollégát @-tal, és egy csengő értesít.',
				},
				{
					q: 'És az MI, olvassa az adatainkat?',
					a: 'Csak ha Ön így dönt. Beállított MI-szolgáltató nélkül semmi nem kerül elküldésre. Ezután egy mező vagy egy automatizálás, amely az MI-t hívja, csak azt küldi el, amit az utasítása említ, az Ön jóváhagyása után.',
				},
				{
					q: 'Milyen nyelven?',
					a: 'A saját nyelvén: a felület a böngészője nyelvét veszi fel, húsz közül, és mindenki megváltoztathatja a beállításaiban.',
				},
			],
		},
		cta: {
			title: 'Csapata többet érdemel',
			titleAccent: 'mint egy megosztott fájlt.',
			text: 'Induljon egy sablonból, hívja meg a kollégáit, és hagyja a „FINAL (2)”-t a múltban.',
			primary: 'Sablonok felfedezése',
			secondary: 'A basedb telepítése',
		},
	},
	hero: {
		badge: 'Újdonság: folyamatalapú automatizálások, irányítópultok és SQL-nézetek',
		title: ['A közös adatbázis,', 'amelyben minden', 'tábla valódi'],
		titleAccent: 'PostgreSQL-tábla.',
		lead: 'Egy megosztott táblázat egyszerűsége – rácsok, nézetek, űrlapok, jogosultságok –, az adatok pedig <strong>típusos, beszédes nevű</strong> táblákban élnek. A csapata a felületen dolgozik; a szkriptjei, a BI-eszközei, az MI-ügynökei és a <code>psql</code> ugyanazokat a sorokat olvassák.',
		install: 'Telepítés Dockerrel',
		features: 'A funkciók megtekintése',
		copy: 'Parancs másolása',
		facts: ['Saját üzemeltetésű', 'AGPL-3.0', 'REST API és MCP-szerver'],
		demo: {
			url: 'basedb.sajat-domain.hu',
			project: 'Fő projekt',
			projectMeta: 'Projekt · 2 adatbázis',
			filter: 'Adatbázisok és táblák szűrése',
			sales: 'Értékesítés',
			support: 'Ügyfélszolgálat',
			environment: 'Éles',
			clients: 'Ügyfelek',
			opportunities: 'Lehetőségek',
			quotes: 'Árajánlatok',
			baseSection: 'Adatbázis · Értékesítés',
			screens: ['Irányítópultok', 'Automatizálások'],
			copilot: '✦ Copilot',
			allRows: '▦ Összes sor ▾',
			tools: ['Szűrés', 'Csoportosítás', 'Színek'],
			search: 'Keresés…',
			add: '+ Hozzáadás',
			columns: {
				name: 'Név',
				status: 'Állapot',
				amount: 'Összeg',
				client: 'Ügyfél',
			},
			statuses: {
				nouveau: 'Új',
				qualifie: 'Minősített',
				proposition: 'Ajánlat',
				negociation: 'Tárgyalás',
				gagne: 'Megnyert',
				perdu: 'Elvesztett',
			},
			deals: {
				portail: {
					name: 'Portál megújítása',
					client: 'Tölgyesi Városháza',
				},
				erp: {
					name: 'ERP-migráció',
					client: 'Bartos Holding',
				},
				audit: {
					name: 'Biztonsági audit',
					client: 'Szent Rókus Klinika',
				},
				billetterie: {
					name: 'Online jegyértékesítés',
					client: 'Félhold Színház',
				},
				flotte: {
					name: 'Flottakövetés',
					client: 'Kerlann Fuvarozás',
				},
				mobile: {
					name: 'Mobilalkalmazás',
					client: 'Molnár Műhely',
				},
				intranet: {
					name: 'Intranet megújítása',
					client: '',
				},
			},
			toastTitle: '„Árajánlatkérés” űrlap',
			toastText: 'nyilvános válasz · létrehozta: „{name}”',
			cursor: 'Camille',
			psqlRows: '(2 sor)',
		},
	},
	showcase: {
		label: 'A valódi felület',
		title: 'Minden, amit a csapata egy megosztott táblázattól elvár.',
		tabs: 'A felület képernyőképei',
		alt: 'basedb – {labelLower}: {caption}',
		shots: {
			grille: {
				label: 'Rács',
				caption: 'Egy rács, amely valódi táblába ír – és számított mezők: időtartam képlettel, az ügyfél városa kikereséssel, a feladatok száma darabszámmal.',
			},
			kanban: {
				label: 'Kanban',
				caption: 'Ugyanazok a sorok oszlopokba rendezve, egy választás típusú mező szerint: egy borítókép, egy leírás, amely a sorra hivatkozik. Egy kártya áthúzása maga a sor módosítása.',
			},
			galerie: {
				label: 'Galéria',
				caption: 'Kártyák a képükkel, egy szín állapotonként: a galéria, a nyolc módszer egyike egy tábla megtekintésére.',
			},
			chronologie: {
				label: 'Idővonal',
				caption: 'Sávok két dátum között, és a függőségeik nyilai – pirossal, ha a sorrend már nem tartható.',
			},
			tableaux: {
				label: 'Irányítópultok',
				caption: 'Kártyák rácsban, lapokon, közös szűrők alatt: trend, célkitűzés, halmozott adatsorok – mindenki a saját jogosultságaival olvassa.',
			},
			automatisations: {
				label: 'Automatizálások',
				caption: 'Amikor egy feladat elkészül, megkeresi, mi maradt a projektből; ha nem maradt semmi, az MI megírja az összefoglalót, és a projekt „Leszállítva” állapotba kerül. Minden futtatás lépésről lépésre követhető a folyamaton.',
			},
			commentaires: {
				label: 'Megjegyzések',
				caption: 'Egy sorról ott beszélgethet, ahol az található: megjegyzések, említések, értesítések.',
			},
			formulaire: {
				label: 'Űrlap',
				caption: 'Az űrlap hivatkozással osztható meg, nyilvánosan vagy csak a bejelentkezett tagoknak.',
			},
			historique: {
				label: 'Előzmények',
				caption: 'Minden írás, bárhonnan érkezzen – egy személytől, egy automatizálástól, közvetlen SQL-ből –, a korábbi értékekkel együtt.',
			},
			sql: {
				label: 'SQL',
				caption: 'Egy lekérdezés a valódi neveken, a táblák alá mentve az egész csapatnak – amelyet mindenki a saját jogosultságaival futtat.',
			},
			vuesSql: {
				label: 'SQL-nézetek',
				caption: 'Valódi PostgreSQL-nézetek a táblák között, saját színnel és ikonnal – és a psql-ből is olvashatók.',
			},
		},
	},
	features: {
		postgres: {
			label: 'PostgreSQL, köztes réteg nélkül',
			title: 'Rács a csapatnak, valódi tábla {az eszközeinek.}',
			lead: 'Nincs általános modell, nincs mindent elnyelő JSON, nincs <code>field_1837</code>: az adatbázis egy séma, a tábla egy tábla, a mező egy típusos, beszédes nevű oszlop.',
			bullets: [
				'<strong>Natív típusok</strong>: <code>text</code>, <code>numeric</code>, <code>date</code>, <code>timestamptz</code>, <code>boolean</code> – és valódi idegen kulcsok a kapcsolatokhoz.',
				'<strong>Az adatbázis által érvényesített megszorítások</strong>: választási listák <code>CHECK</code>-ként, ellenőrzött webcímek és e-mail-címek, kapcsolatok <code>FOREIGN KEY</code>-ként.',
				'<strong>A PostgreSQL által számított képletek</strong>: a <code>JOURS([Fin]; [Début])</code> generált oszloppá válik, amelyet a <code>psql</code> ugyanúgy olvas, mint a többit.',
				'<strong>A közvetlen SQL továbbra is megengedett</strong> – és még azt is rögzítik az előzmények, triggerrel.',
				'<strong>Lekérdezések és SQL-nézetek</strong> a felületen: a táblák alá mentett lekérdezések, saját magának vagy a csapatnak, és közöttük elhelyezett valódi PostgreSQL-nézetek, amelyeket a <code>psql</code> is olvas.',
				'<strong>Az átnevezés nem tör el semmit</strong>: a régi nevet egy kompatibilitási alias továbbra is kiszolgálja, amíg átírja a lekérdezéseit.',
			],
			links: [
				{
					href: '/integrations/sql/',
					label: 'Munka SQL-ben',
				},
				{
					href: '/fonctionnalites/requetes-et-vues-sql/',
					label: 'Lekérdezések és SQL-nézetek',
				},
				{
					href: '/architecture/principes/',
					label: 'Az alapelvek',
				},
			],
		},
		automations: {
			label: 'Automatizálás',
			title: 'Automatizálások folyamatként, {MI minden lépésben.}',
			lead: 'Amikor egy sor megváltozik, ütemezetten vagy egy kattintásra: a gráfszerkesztő láncba fűzi a lépéseket, és minden futtatás visszanézhető a folyamaton.',
			bullets: [
				'<strong>Áttekinthető folyamat</strong>: az eseményindító, majd minden lépés egy-egy kártyán; egy vonalon lévő <strong>+</strong> ott ad hozzá egy lépést.',
				'<strong>Keresés, döntés, írás</strong>: egy sor megkeresése, feltételektől függően egyik vagy másik ág, módosítás, létrehozás, értesítés, webhook hívása, üzenet a Slackre.',
				'<strong>MI megkérdezése</strong> egy lépésben: a sorra hivatkozó utasítás, a válasz pedig szövegként, számként, dátumként vagy választásként értelmezve, amelyet a következő lépések újra felhasználnak.',
				'<strong>A Copilot</strong> egyetlen mondatból teljes automatizálást javasol, vagy elmagyarázza, miért volt sikertelen egy futtatás – Ön nélkül semmi nem kerül mentésre.',
				'<strong>Annak a jogosultságaival fut, aki megírta</strong>, és bekerül az előzményekbe, mint bármely más írás.',
			],
			links: [
				{
					href: '/fonctionnalites/automatisations/',
					label: 'Automatizálások',
				},
				{
					href: '/fonctionnalites/automatisations/#a-copilot',
					label: 'A Copilot',
				},
			],
			alt: 'basedb – a „Projekt leszállítva” automatizálás a folyamatszerkesztőben: amikor egy feladat elkészül, rögzíti az időpontot, megkeresi, mi maradt a projektből, az „Egyébként” ágon halad tovább, elkéri az MI-től az összefoglalót, majd leszállítja a projektet; jobb oldalt a legutóbbi futtatásai, lépésről lépésre.',
		},
		dashboards: {
			label: 'Elemzés',
			title: 'Irányítópultok, {egyenesen a tábláiból.}',
			lead: 'Egérrel vagy SQL-ben feltett kérdések, tizenötféle vizualizáció, közös szűrők – mindenki a saját jogosultságaival olvassa őket.',
			bullets: [
				'<strong>Kérdések</strong>: egy tábla, az illesztései, szűrők és mértékek nap, hét, hónap vagy év szerint – vagy csak olvasási SQL.',
				'<strong>Tizenötféle vizualizáció</strong>: szám, trend, előrehaladás, mérő, oszlopok, vonalak, kördiagram, tölcsér, kereszttábla, térkép…',
				'<strong>Felfedezés egy kattintással</strong>: egy pont megnyitja a sorait, vagy egy finomabb időszakot.',
				'<strong>Közös szűrők</strong>, amelyek egy, több vagy az összes kártyát vezérlik.',
				'<strong>Megosztás hivatkozással</strong>, nyilvánosan vagy csak tagoknak, és beágyazás más webhelyre.',
			],
			links: [
				{
					href: '/fonctionnalites/tableaux-de-bord/',
					label: 'Irányítópultok',
				},
			],
			alt: 'basedb – egy irányítópult: a hónap trendje, beszedési cél, havi árbevétel, a vélemények hangulata, időszak- és ügyfélszűrők alatt.',
		},
		rights: {
			label: 'Közös munka, célzott hozzáféréssel',
			title: 'Jogosultságok mezőszintig, {hiánytalan előzmények.}',
			lead: 'A jogosultságokat csoportok kapják, egy projekten, adatbázison vagy táblán, és minden alatta lévőre érvényesek. Egy érzékeny oszlop elrejthető egy csoport elől, vagy nem módosíthatóvá tehető számára.',
			bullets: [
				'<strong>Négy szint</strong>: Nincs hozzáférés, Olvasás, Szerkesztés, Kezelés – csoportról csoportra összeadódnak.',
				'<strong>Még az SQL is az Ön jogosultságait követi</strong>: a felületen egy lekérdezés csak az Ön számára megnyitott táblákat és mezőket látja – és ezt maga a PostgreSQL érvényesíti.',
				'<strong>Minden írás rögzítésre kerül</strong> a saját tranzakciójában: felület, API, ügynök, nyilvános űrlap vagy közvetlen SQL.',
				'<strong>Egy módosítás visszavonható</strong>, egy törölt sor visszaállítható, és egy törölt adatbázis is.',
				'<strong>Az adminisztráció megerősítést kér</strong>: egy jogosultság módosításához az utolsó öt percben újra be kell gépelni a jelszót.',
			],
			links: [
				{
					href: '/fonctionnalites/droits/',
					label: 'Jogosultságok és csoportok',
				},
				{
					href: '/fonctionnalites/historique/',
					label: 'Előzmények',
				},
			],
		},
		agents: {
			label: 'REST API · MCP · webhookok',
			title: 'Az MI-ügynökei az adatokat kapják meg, {nem a kulcsot mindenhez.}',
			lead: 'Az MCP-szerver tizenkét eszközt ad az ügynököknek; a REST API ugyanazokat az adatokat a programjainak. Egyetlen jogosultság-ellenőrzési pont, ugyanazok a naplók.',
			bullets: [
				'<strong>Adatbázisonként egy token</strong>, alapértelmezés szerint csak olvasható, és soha nem kap több jogosultságot, mint a létrehozója.',
				'<strong>Az ügynök semmit nem töröl</strong>, és nem módosítja a struktúrát: javaslatot tesz, egy ember jóváhagyja.',
				'<strong>Generált dokumentáció</strong> minden adatbázishoz, az Ön jogosultságai szerint szűrve, OpenAPI 3.1-specifikációval.',
				'<strong>Webhookok</strong> minden írásnál: aláírva, sorrendben, újrapróbálva.',
			],
			links: [
				{
					href: '/integrations/mcp/',
					label: 'Ügynök csatlakoztatása',
				},
				{
					href: '/integrations/api-rest/',
					label: 'A REST API',
				},
			],
		},
	},
	sqlVisual: {
		interface: 'Felület',
		title: 'Új mező · Lehetőségek',
		labelField: 'Címke',
		labelValue: 'Összeg',
		typeField: 'Típus',
		typeValue: 'Szám',
		descriptionField: 'Leírás',
		descriptionValue: 'A szerződés nettó összege',
		required: 'Kötelező',
		ai: 'MI',
		migration: 'ütemezett migráció, rövid zárolásokkal',
	},
	rightsVisual: {
		groups: ['Adminisztrátorok', 'Értékesítők', 'Ügyfélszolgálat'],
		project: 'Fő projekt',
		sales: 'Értékesítés',
		opportunities: 'Lehetőségek',
		clients: 'Ügyfelek',
		support: 'Ügyfélszolgálat',
		inherited: 'örökölt',
		levels: {
			none: 'Nincs hozzáférés',
			read: 'Olvasás',
			edit: 'Szerkesztés',
			manage: 'Kezelés',
		},
		field: '„Árrés” mező',
		hidden: 'Rejtett',
		sqlChange: '<b>Közvetlen SQL-munkamenet</b> módosította: <b>„ERP-migráció”</b>',
		sqlMeta: '02:46 · helyi kapcsolat · psql',
		sqlDiff: 'Összeg: <s>125 000</s> → 130 000',
		undo: '↶ Visszavonás',
		formChange: '<b>„Árajánlatkérés” űrlap</b> létrehozta: <b>„Intranet megújítása”</b>',
		formMeta: 'nyilvános válasz · közzétette: Camille',
	},
	agentVisual: {
		agent: 'Ügynök',
		via: 'MCP-n keresztül csatlakozva · „Értékesítés” token',
		question: 'Hány lehetőség van tárgyalási szakaszban, és mekkora összegben?',
		listArgs: 'opportunites · statut = Tárgyalás',
		answer: 'Két lehetőség, összesen <b>182 000 €</b>: ERP-migráció (130 000 €) és Flottakövetés (52 000 €).',
		request: 'Adj hozzá egy „Valószínűség” mezőt százalékban.',
		proposeArgs: 'opportunites · Valószínűség · number',
		proposed: 'Javasoltam: a csapat egyik tagjának jóvá kell hagynia a basedb-ben.',
		badge: 'Javaslat',
		expires: '23 óra múlva lejár',
		what: '<b>„Valószínűség”</b> mező (Szám) hozzáadása a <b>Lehetőségek</b> táblához',
		by: 'Az ügynök javasolta · „Értékesítés” token',
		refuse: 'Elutasítás',
		approve: 'Jóváhagyás',
	},
	bento: {
		label: 'És minden más',
		title: 'Amit egy csapateszköztől elvár – és a PostgreSQL marad.',
		text: 'Minden funkció ugyanazokba a táblákba ír, ugyanazokkal a jogosultságokkal, ugyanazokba az előzményekbe.',
		more: 'Bővebben →',
		views: {
			title: 'Tíz nézet ugyanazokra a sorokra',
			text: 'Közösek az egész csapatnak, vagy személyesek, csak Önnek: mindenki a saját módján olvas, és senki nem másolja az adatokat.',
			chips: ['Rács', 'Kanban', 'Naptár', 'Idővonal', 'Galéria', 'Lista', 'Térkép', 'Űrlap', 'Kérdőív', 'Kvíz'],
		},
		forms: {
			title: 'Megosztott űrlapok',
			text: 'Nyilvános hivatkozás, vagy csak a bejelentkezett tagoknak. A kitöltés semmilyen jogosultságot nem ad a táblán.',
			href: '/fonctionnalites/formulaires-partages/',
		},
		environments: {
			title: 'Környezetek',
			text: 'Egy adatbázis, több változat. Hasonlítsa össze a struktúrát, migráljon egyikből a másikba, szinkronizáljon sorokat.',
			chips: ['Éles', 'Teszt', 'Fejlesztői'],
			href: '/fonctionnalites/environnements/',
		},
		collaboration: {
			title: 'Közös munka',
			text: 'A többiek írásai valós időben érkeznek, látszik, ki melyik sort nézi, és a sorról ott lehet beszélgetni, ahol az található: megjegyzések, említések, értesítések. A Ctrl+Z visszavonja az utolsó írást, és inkább elutasít, mint hogy felülírja valaki más munkáját.',
			chips: ['Valós idő', 'Jelenlét', 'Megjegyzések', 'Említések', 'Ctrl+Z'],
			href: '/fonctionnalites/collaboration/',
		},
		small: {
			ai: {
				title: 'MI a rácsban',
				text: 'Egy mező, amelyet egy modell tölt ki a többi oszlopból, és egy Copilot, amely szűrőket, lekérdezéseket és oszlopokat javasol, egy kattintással alkalmazva. OpenAI, Anthropic, Mistral, vagy egy, a saját gépén futó modell.',
				code: 'Foglald össze egy mondatban: {{Notes}}',
				href: '/fonctionnalites/ia/',
			},
			formulas: {
				title: 'Kapcsolatok és képletek',
				text: 'Valódi idegen kulcsok, franciául vagy angolul írt és a PostgreSQL által számított képletek, valamint kikeresések, aggregálások és darabszámok a kapcsolatokon keresztül.',
				code: 'ROUND([Montant HT] * (1 + [Taux de TVA]), 2)',
				href: '/fonctionnalites/tables-et-champs/#képletek',
			},
			richText: {
				title: 'Formázott szöveg és változók',
				text: 'Vizuális szerkesztő a formázott szöveghez, íráskor megtisztítva; és bármely hosszú szövegben a {{Ville}} helyén a sor értéke jelenik meg.',
				code: 'Szállítás: {{Date}}, helyszín: {{Ville}}',
				href: '/fonctionnalites/tables-et-champs/#formázott-szöveg-és-változók',
			},
			languages: {
				title: 'Saját nyelvén',
				text: 'A felület a böngészője nyelvét használja, húsz nyelv közül; mindenki megváltoztathatja a beállításaiban.',
				href: '/fonctionnalites/droits/#az-ön-beállításai',
			},
			sharedViews: {
				title: 'Megosztott nézetek',
				text: 'Csak olvasható nézet hivatkozással, más webhelybe ágyazható; egy naptárra pedig a naptáralkalmazásából is feliratkozhat.',
				href: '/fonctionnalites/vues-partagees/',
			},
			syncedTables: {
				title: 'Szinkronizált táblák',
				text: 'Egy tábla, amelyet egy online CSV, egy naptár vagy egy másik basedb megosztott nézete tart naprakészen.',
				href: '/integrations/synchronisation/',
			},
			templates: {
				title: 'Adatbázissablonok',
				text: 'Tíz azonnal használható sablon, egy mondatban leírt adatbázis az MI-nek, és a saját adatbázisa sablonként mentve.',
				href: '/modeles/',
			},
			files: {
				title: 'Fájlok és képek',
				text: 'A gazdagép lemezén vagy S3-kompatibilis tárolóban: AWS, Scaleway, OVH, Cloudflare R2, Garage, MinIO…',
				href: '/fonctionnalites/fichiers/',
			},
			import: {
				title: 'Excel-, CSV- és JSON-importálás',
				text: 'Húzzon be egy fájlt: az importálás kitalálja a típusokat, létrehozza a táblát vagy kiegészít egy meglévőt, és soronként megmondja, mit utasított el.',
				href: '/guides/premiers-pas/',
			},
			accounts: {
				title: 'Fiókok és meghívások',
				text: 'Mindenki létrehozza a saját fiókját és projektjeit, és hivatkozással hív meg másokat Olvasás, Szerkesztés vagy Kezelés szinttel; bejelentkezés jelszóval, Google-lel, Microsofttal vagy bármely OpenID Connect-szolgáltatóval.',
				href: '/hebergement/connexion/',
			},
			webhooks: {
				title: 'Webhookok',
				text: 'Minden írás értesíthet egy másik rendszert: aláírt, sorrendben kézbesített, szükség esetén újraküldött üzenetekkel.',
				href: '/integrations/webhooks/',
			},
			settings: {
				title: 'Személyes beállítások',
				text: 'A nyelve, a témája, a dátumok sorrendje, az értesítései, a munkamenetei és a tokenjei, egy helyen.',
				href: '/fonctionnalites/droits/#az-ön-beállításai',
			},
		},
	},
	selfHost: {
		label: 'Saját üzemeltetésű',
		title: 'Az adatai {Önnél maradnak.}',
		lead: 'A basedb szabad szoftver (AGPL-3.0): egyetlen lemezkép, egy PostgreSQL-adatbázis, és ennyi – se kötelező külső szolgáltatás, se telemetria. Mentse <code>pg_dump</code>-pal, olvassa bármely PostgreSQL-klienssel.',
		services: {
			db: 'PostgreSQL 16, az Ön adatai',
			basedb: 'A felület, a REST API és az MCP-szerver, egyetlen porton',
			proxy: 'Caddy, automatikus HTTPS (opcionális)',
		},
		links: [
			{
				href: '/hebergement/docker/',
				label: 'Docker Compose-útmutató →',
			},
			{
				href: '/hebergement/variables/',
				label: 'Az összes változó →',
			},
		],
		steps: [
			{
				title: 'A basedb letöltése',
				code: 'git clone https://github.com/eodia/basedb.git\ncd basedb && cp .env.example .env',
			},
			{
				title: 'Két titok a .env fájlban',
				code: 'POSTGRES_PASSWORD=egy-eros-jelszo\n# openssl rand -base64 32\nBASEDB_ENCRYPTION_KEY=…',
			},
			{
				title: 'Indítás',
				code: 'docker compose up -d\n# majd http://localhost:3000: hozza létre a fiókját',
			},
		],
	},
	faq: {
		label: 'Gyakori kérdések',
		title: 'Amit gyakran kérdeznek tőlünk.',
		text: 'Más kérdése van? <a href="/guides/introduction/">A dokumentáció</a> biztosan megválaszolja.',
		items: {
			difference: {
				q: 'Miben különbözik a basedb a többi közös használatú adatbázistól?',
				a: 'Abban, hogy hol élnek az adatok. Ahol mások egy általános modellben tárolják a sorait (számozott oszlopok, JSON-dokumentumok), ott a basedb minden táblához valódi PostgreSQL-táblát, minden mezőhöz valódi típusos oszlopot hoz létre, olvasható nevekkel. Az adatai a basedb nélkül is használhatók maradnak.',
			},
			sql: {
				q: 'Írhatok közvetlenül SQL-ben a táblákba?',
				a: 'Igen. A megszorításokat (típusok, kötelező mezők, választási listák, idegen kulcsok) maga a PostgreSQL érvényesíti, és egy trigger még a közvetlen SQL-lel végzett írásokat is rögzíti az előzményekben, az azokat végző munkamenettel együtt. A felület SQL-konzolja és a psql ugyanazokat a táblákat olvassa; a felületen mindenki a saját jogosultságaival ír SQL-t, menti a lekérdezéseit, és ha kezeli az adatbázist, valódi PostgreSQL-nézeteket készíthet belőlük.',
			},
			ai: {
				q: 'Mi kerül át egy MI-szolgáltatóhoz?',
				a: 'Semmi, amíg nem állít be szolgáltatót. Ezután a struktúrapiszkozatokhoz és a Copilothoz alapértelmezés szerint csak a struktúra és az Ön mondata kerül elküldésre; azt, hogy a Copilot adatokat olvashasson, beszélgetésenként egy jelölőnégyzet engedélyezi. Az MI-től kért adatbázissablon csak az Ön mondatát küldi el. Az MI-mező az utasításában hivatkozott oszlopokat küldi el, kifejezett hozzájárulás után.',
			},
			together: {
				q: 'Dolgozhatnak többen ugyanazon a táblán?',
				a: 'Igen. A többiek írásai újratöltés nélkül jelennek meg, az arcukkal azon a táblán vagy soron, amelyet éppen néznek. Egy sorhoz megjegyzést fűzhet, @-tal megemlíthet valakit, a csengő pedig értesít. A Ctrl+Z pedig csak a saját írásait vonja vissza: inkább elutasít, mint hogy felülírja, amit azóta valaki más módosított.',
			},
			languages: {
				q: 'Milyen nyelveken?',
				a: 'Húszon: francia, angol, német, spanyol, olasz, brazíliai portugál, holland, lengyel, cseh, svéd, dán, norvég, finn, román, magyar, török, ukrán, japán, egyszerűsített kínai és koreai. A felület a böngésző nyelvét használja, és mindenki módosíthatja a beállításaiban; ez a webhely és a dokumentáció ugyanezeken a nyelveken érhető el.',
			},
			agent: {
				q: 'Hogyan csatlakozik egy MI-ügynök?',
				a: 'Az MCP-szerveren keresztül, egyetlen adatbázisra korlátozott, alapértelmezés szerint csak olvasható integrációs tokennel. Az ügynök a jogosultságai szerint olvas, hoz létre és módosít sorokat; semmit nem töröl, és nem módosítja a struktúrát: javaslatot tesz, egy ember pedig jóváhagyja.',
			},
			postgres: {
				q: 'Melyik PostgreSQL-verzió szükséges?',
				a: 'PostgreSQL 16 vagy újabb, a pg_trgm és az unaccent bővítménnyel (a hivatalos lemezképben elérhetők). A mellékelt docker-compose egy PostgreSQL 16-ot indít; a DATABASE_URL változóval a saját szerverére is irányíthatja.',
			},
			production: {
				q: 'Használható éles környezetben?',
				a: 'A basedb aktív fejlesztés alatt áll: a mag, az API, az MCP-szerver és a felület működik, és több mint ezer teszt fedi le őket, de néhány funkció még hátravan (lásd az ütemtervet). Próbálja ki, és mentse az adatbázisát, mint bármely PostgreSQL-adatbázist.',
			},
			license: {
				q: 'Milyen licenc alatt?',
				a: 'AGPL-3.0-or-later. Szabadon használhatja, módosíthatja és üzemeltetheti; ha módosított változatot kínál szolgáltatásként, annak forráskódját meg kell osztania.',
			},
		},
	},
	cta: {
		title: 'Az adatai {valódi táblákat érdemelnek.}',
		text: 'Telepítse a basedb-t néhány perc alatt, hívja meg a csapatát, és tartson kézben minden sort.',
		install: 'A basedb telepítése',
		github: 'A kód megtekintése a GitHubon',
	},
	changelog: {
		label: 'Újdonságok',
		title: 'Mi változott a basedb-ben',
		intro: 'Minden változás részletei <a href="https://github.com/eodia/basedb/commits/main">a tároló előzményeiben</a> találhatók. Ami ezután jön: az <a href="/feuille-de-route/">ütemterv</a>.',
		entries: {
			resilience: {
				date: '2026-10-01',
				title: 'Egy megszakadt kapcsolat már nem állítja meg a basedb-t',
				tag: 'Üzemeltetés',
				items: [
					'<strong>Nincs többé leállás egy megszakadt kapcsolat miatt</strong>: amikor a PostgreSQL bezár egy kapcsolatot — újraindítás, hálózati kimaradás, tétlenül maradt tranzakció —, csak az azt tartó lekérdezés hiúsul meg; a basedb folytatja, és a naplója megmondja, melyik munka tartotta.',
					'<strong>Kevesebb várakozás egy terhelt adatbázison</strong>: egy táblaoldal már nem tart nyitva egy tranzakciót, amíg a kapcsolódó sorokat olvassa, és egy lekérdezés, amely 15 másodpercen belül nem kap kapcsolatot, hibát kap a végtelen várakozás helyett.',
					'<strong>MI-fejlécek úgy olvasva, ahogyan írják őket</strong>: <code>BASEDB_AI_HEADERS</code> elfogadja azt a formát is, amelyre az Ansible átírja, <code>{\'api-key\': \'…\'}</code>, és egy fejlécet soronként; ezekkel az <code>openai_compatible</code> megvan kulcs nélkül.',
				],
			},
			applications: {
				date: '2026-09-30',
				title: 'A basedb-re támaszkodó alkalmazásoknak',
				tag: 'Új',
				items: [
					'<strong>Egyetlen hívással, egy sablonból létrehozott adatbázis</strong>: a szerver az egész sablont alkalmazza — táblákat, kapcsolatokat, sorokat, nézeteket, automatizálásokat —, vagy semmit, ha egy lépés meghiúsul. Ezt használja a galéria is, egy alkalmazás, amely szintén magát telepíti. <a href="/integrations/api-rest/#adatbázis-létrehozása-egy-sablonból">Adatbázis létrehozása egy sablonból</a>',
					'<strong>Token ellenőrzése</strong>: az az alkalmazás, amelynek átadják egy személy tokenét, megkérdezi a basedb-t, hogy az még érvényes-e, és kiért — a fiókjáért, a csoportjaiért. <a href="/integrations/api-rest/#token-ellenőrzése">Token ellenőrzése</a>',
					'<strong>A belső szerverei</strong>: a webhookok és automatizálások csak azokat érik el, amelyeket a <code>BASEDB_WEBHOOK_ALLOW</code>-ban megad, HTTP-vel is; egy program egy integrációs tokennel valós időben is követhet egy táblát. <a href="/integrations/webhooks/#webhook-nélkül-tábla-követése">Tábla követése</a>',
					'<strong>Egy elérési út alatt, egy átjáró mögött</strong>: a basedb egy olyan címen jelenik meg, mint a <code>https://passerelle.example.com/basedb/</code>, akár megtartja az átjáró az elérési utat, akár leveszi. <a href="/hebergement/docker/#egy-átjáró-mögött-egy-elérési-út-alatt">Egy átjáró mögött</a>',
					'<strong>Egy webhook, az összes tábla egyszerre</strong>: egy esemény be- vagy kikapcsolása az összes táblához, vagy egy tábla összes eseményéhez, egyetlen kattintással.',
				],
			},
			loopsWebhooks: {
				date: '2026-09-30',
				title: 'Automatizálások, amelyek bejárják a sorait, és API-kkal beszélnek',
				tag: 'Új',
				items: [
					'<strong>Minden sorra</strong>: egy lépés, amely megismétli a sajátjait egy tábla minden olyan során, amely megfelel egy szűrőnek – minden hétfőn küldjön emlékeztetőt az összes kifizetetlen számláról, nem csak az elsőről. <a href="/fonctionnalites/automatisations/#minden-sorra">Minden sorra</a>',
					'<strong>Egy webhook, amely bármely API-val szóba tud állni</strong>: a metódus, egy sorra hivatkozó cím, fejlécek, valamint egy JSON, űrlap vagy szöveg formátumú, a sor értékeivel összeállított törzs. <a href="/fonctionnalites/automatisations/#szolgáltatás-hívása">Szolgáltatás hívása</a>',
					'<strong>Egy API-kulcs titkos marad</strong>: titkosítva soha többé nem jelenik meg – sem a képernyőn, sem az API-ban, sem a Copilotnak –, és csak arra a hosztra kerül, amelyhez megadta.',
				],
			},
			maps: {
				date: '2026-09-30',
				title: 'A térkép, és címek, amelyek megtalálják a helyüket',
				tag: 'Új',
				items: [
					'<strong>Egy tizedik nézet, a térkép</strong>: minden sor a saját helyén, a címe vagy a szélességi és hosszúsági foka alapján. Egy tű egy státusz színét veszi fel, és egy kattintásra megnyitja a sor részleteit. <a href="/fonctionnalites/vues/#térkép">A térkép</a>',
					'<strong>Egy címet a rendszer egyszer és mindenkorra behatárol</strong>, az OpenStreetMap szolgáltatásával vagy az Ön által választottal: a tűk a válaszok érkezésével jelennek meg, majd azonnal. Egy nem található cím számításra kerül, sosem kerül csendben félretéve.',
					'<strong>A Cím formátum</strong> egy rövid szöveghez: egy kattintás megnyitja a térképen, és a sor részleteiben a <strong>Cím keresése</strong> javasolja a megfelelő, teljesen kiírt címeket. <a href="/fonctionnalites/tables-et-champs/#megjelenítési-formátumok">A formátumok</a>',
				],
			},
			documents: {
				date: '2026-09-30',
				title: 'PDF-ek a soraiból',
				tag: 'Új',
				items: [
					'<strong>Egy árajánlat, egy számla, egy adatlap PDF-ben</strong>, egy sor menüjéből: a nyomtatható adatlap beállítás nélkül, vagy egy sablon — szövegek, amelyek hivatkoznak a mezőkre, a sor mezői, a kapcsolt sorok táblázata az összesítésével, oldaltörések. <a href="/fonctionnalites/documents/">A dokumentumok</a>',
					'<strong>Mindenki a saját jogosultságaival</strong>: az Ön elől elrejtett mező nem jelenik meg az Ön PDF-jében. A húsz nyelv mindegyikén megírható, a kínaival, a japánnal és a koreaival együtt, és az API ugyanazt a dokumentumot adja vissza.',
				],
			},
			rows: {
				date: '2026-09-30',
				title: 'Jogosultságok egészen a sorig, alapértelmezett értékek, Excel-importálás',
				tag: 'Új',
				items: [
					'<strong>Mindenkinek a saját sorai</strong>: egy csoport csak egy szűrő sorait látja — „Értékesítő én vagyok”, „Régió Észak” —, a felületen, az API-ban, az MCP-szerverben, csakúgy mint SQL-ben, ahol a PostgreSQL ugyanazt a szabályt érvényesíti. <a href="/fonctionnalites/droits/#egészen-a-sorig">Egészen a sorig</a>',
					'<strong>Alapértelmezett értékek</strong>: egy rögzített érték, a mai dátum, a létrehozás pillanata vagy a sort létrehozó személy, előre kitöltve a képernyőn és mindenhol máshol alkalmazva. <a href="/fonctionnalites/tables-et-champs/#alapértelmezett-értékek">Alapértelmezett értékek</a>',
					'<strong>Húzzon be egy Excel-munkafüzetet</strong>: válassza ki a munkalapot, a dátumokat, összegeket és jelölőnégyzeteket úgy veszi át, ahogy vannak, és egy képlet megadja az értékét. <a href="/guides/premiers-pas/">Első lépések</a>',
				],
			},
			mail: {
				date: '2026-09-30',
				title: 'E-mailek',
				tag: 'Új',
				items: [
					'<strong>Egy „E-mail küldése” lépés</strong> az automatizálásokban: egy tagnak, egy mező személyének, egy ügyfél címére, a sor értékeivel a tárgyban és a szövegben. <a href="/fonctionnalites/automatisations/">Az automatizálások</a>',
					'<strong>Az e-mail értesítések</strong>, amikor nem olvasta el őket, összegyűjtve, egyenként kiválasztva a beállításaiban; és az <strong>elfelejtett jelszó</strong> egy hivatkozással állítható vissza. <a href="/fonctionnalites/collaboration/#e-mailben">E-mailben</a>',
					'Elég megadni a példánynak a levelezése kiküldő szerverét. <a href="/hebergement/variables/#e-mailek">A változók</a>',
				],
			},
			integrations: {
				date: '2026-09-30',
				title: 'n8n és egy TypeScript SDK',
				tag: 'Új',
				items: [
					'<strong>n8n csomópontok</strong>: egy tábla sorainak olvasása és írása egy workflow-ból, és egy indítása minden létrehozott, módosított vagy törölt sornál — lekérdezéssel vagy aláírt webhookkal. <a href="/integrations/n8n/">n8n</a>',
					'<strong>Egy TypeScript SDK</strong>, a táblái típusaival, amelyeket a példányából generál: egy nem létező tábla vagy mező már a végrehajtás előtt hiba. <a href="/integrations/sdk/">Az SDK</a>',
				],
			},
			quiz: {
				date: '2026-09-29',
				title: 'A kvíz: kérdések, amelyek pontokat számolnak',
				tag: 'Új',
				items: [
					'<strong>Új nézet, a kvíz</strong>: kérdőív, amelynek minden kérdéséhez tartozhat helyes válasz és pontszám — egy választás, több, igen vagy nem, egy szám, egy dátum, vagy elfogadott szövegek, a nagybetűket és az ékezeteket figyelmen kívül hagyva. <a href="/fonctionnalites/vues/#kvíz">A kvíz</a>',
					'<strong>Javítás, ahogy szeretné</strong>: minden kérdés után — zölden, vagy pirosan a helyes válasszal, a pontszám, amely nő a képernyő tetején —, a végén, vagy soha. A teljesítési küszöb miatt a záróképernyő azt mondja: „Teljesítve!” vagy „Ezúttal nem sikerült…”.',
					'<strong>A pontszám a végén</strong>, egy megtelő gyűrűben, majd minden kérdés javítása. A tábla egy számmezőjébe íródik: rendezze a rácsot eszerint, ez a ranglista.',
					'<strong>Hivatkozással megosztva, csalás nélkül</strong>: az oldal egyetlen helyes választ sem kap meg, a szerver javít és számol. <a href="/fonctionnalites/formulaires-partages/#megosztott-kvíz">Megosztott kvíz</a>',
					'<strong>A Nézet létrehozása</strong>, a nézetválasztó alján, a kilenc fajtát két családra osztja — azokra, amelyek megjelenítik a sorokat, és azokra, amelyek válaszokat gyűjtenek —, mindegyiket a saját színes ikonjával.',
				],
			},
			forms: {
				date: '2026-09-29',
				title: 'Űrlapok, amelyeket öröm kitölteni',
				tag: 'Új',
				items: [
					'<strong>A kérdőív az egész képernyőt kitölti</strong>: egyszerre egy kérdés, amely becsúszva jelenik meg, nagy kártyák a választásokhoz, csillagok az értékeléshez, és minden billentyűzetről — <strong>Enter</strong>, az A, B, C… betűk, I vagy N, a számok. Egy egyszeres választás önmagában továbblép a következőre. <a href="/fonctionnalites/vues/#űrlap-és-kérdőív">Űrlap és kérdőív</a>',
					'<strong>Saját megjelenés</strong>: nyolc téma, a Világostól az Éjszakáig, a Papíron át, egy szín, egy betűtípus, egy igazítás — a megosztott hivatkozás oldala is ezt viseli.',
					'<strong>Feltétel hozzáadása…</strong>: egy kérdés csak akkor jelenik meg, ha egy korábbi válasz ezt megkívánja; egy elrejtett kérdés se nem kötelező, se nem kerül mentésre.',
					'<strong>Kezdéshez nincs mit beállítani</strong>: egy új űrlap azt kérdezi, amit egy személy válaszol, nem azt az állapotot, amelyet a csapat később tölt ki, a táblája színét viseli, és minden mezőben egy példát mutat. A beküldést pedig ünneplés kíséri, konfettivel együtt.',
				],
			},
			formulaLanguages: {
				date: '2026-09-28',
				title: 'Francia vagy angol nyelvű képletek',
				tag: 'Új',
				items: [
					'<strong>Írjon képletet franciául vagy angolul</strong>, bármelyik képernyőn, akár a kettőt keverve is: <code>SI</code> vagy <code>IF</code>, <code>ARRONDI</code> vagy <code>ROUND</code>, <code>JOURS</code> vagy <code>DAYS</code>… Az argumentumokat <code>;</code> vagy <code>,</code> választja el. <a href="/fonctionnalites/tables-et-champs/#képletek">A képletek</a>',
					'<strong>A képernyő nyelvén olvasható vissza</strong>: franciául egy francia képernyőn, angolul a másik tizenkilenc nyelven — a meglévő képletekkel és a „Függvények” panellel is. Az API a kért nyelven adja vissza a képletet, egyébként angolul.',
					'A hivatalos sablonok, amelyeket egy franciától eltérő nyelven szolgálnak ki, angol nyelvű képletekkel érkeznek. Az adatbázisban semmi nem változik: ugyanazok az oszlopok, ugyanaz az SQL, migrálás nélkül.',
				],
			},
			search: {
				date: '2026-09-27',
				title: 'Minden megtalálása: Ctrl+K',
				tag: 'Új',
				items: [
					'<strong>Egyetlen mező mindenre</strong> — <strong>Ctrl+K</strong>, vagy a felső sáv közepén lévő mező: táblák, nézetek, kérdések, irányítópultok, automatizálások, oszlopok, és maguk a sorok, az Ön jogosultságaival olvasva; nagy képernyőn a kiválasztott találat előnézete. <a href="/fonctionnalites/recherche/">A keresés</a>',
					'<strong>Gépeljen úgy, ahogyan gondolkodik</strong>: sem ékezetek, sem nagybetűk nem számítanak, kezdőbetűkkel — <code>kp</code> a „Kovács Pékség” névre —, egy elgépelést megbocsát, <code>ügyfelek debrecen</code> a „debrecen” szó kereséséhez az ügyfelek táblájában; amit gyakran megnyit, felkerül a lista elejére.',
					'<strong>Minden billentyűzetes parancs</strong>: létrehozás, ugrás, bezárás, visszavonás, témaváltás, az oldal hivatkozásának másolása. A <code>&gt;</code> csak a parancsok között keres, a <code>#</code> az objektumok között, a <code>/</code> a sorok között; a <strong>Tab</strong> egy táblán vagy adatbázison belül keres.',
					'<strong>Van egy kérdése?</strong> Írja be: a <strong>Copilot megkérdezése</strong> feladja neki, a megnyitott adatbázisban.',
				],
			},
			questions: {
				date: '2026-09-27',
				title: 'Saját kérdések, számok a szövegben',
				tag: 'Új',
				items: [
					'<strong>Mindenki elmenti saját kérdéseit</strong>, Kezelés szint nélkül: a személyeseket csak Ön látja; aki kezeli az adatbázist, megosztja őket a teljes adatbázissal vagy csoportokkal, mint a lekérdezéseket. <a href="/fonctionnalites/tableaux-de-bord/">Az irányítópultok</a>',
					'<strong>Egy kérdés saját lapon</strong>, a táblák mellett: <strong>Új kérdés</strong> és <strong>Új SQL-kérdés</strong>, a lapsáv <strong>+</strong> gombján és az adatbázis menüjében; a lap megtartja, amit rajta hagyott. A <strong>Másolat mentése</strong> az Önévé tesz egy kérdést, amelyet nem tud módosítani.',
					'<strong>Számok a szövegben</strong>: egy irányítópult szövege, immár formázva, egy értékre hivatkozik — <code>{{chiffre_affaires}}</code> — amely egy kártyából, egy kérdésből vagy egy szűrőből származik, az olvasó jogosultságaival kiszámítva, akár egy linkkel megosztott irányítópulton belül is. <a href="/fonctionnalites/tableaux-de-bord/#számok-a-szövegben">Számok a szövegben</a>',
					'A lekérdezések, az SQL-nézetek és a kérdések a menüjükből is törölhetők, jobb kattintással.',
				],
			},
			addresses: {
				date: '2026-09-27',
				title: 'Egy cím minden képernyőhöz',
				tag: 'Új',
				items: [
					'<strong>A cím követi a képernyőt</strong>: egy tábla, egy nézet, egy sor részletei, egy irányítópult, egy automatizálás, egy kérdés, az Ön beállításai — <code>/bases/ventes/tables/opportunites?ligne=…</code>. Tegye könyvjelzőbe, illessze be egy üzenetbe: ugyanarra a helyre érkezik, a saját jogosultságaival. <a href="/fonctionnalites/collaboration/#hivatkozás-minden-képernyőhöz">Hivatkozás minden képernyőhöz</a>',
					'A böngésző <strong>vissza</strong> és <strong>előre</strong> gombjai odavezetik, ahol volt; egy sehová nem vezető cím a „Ez az oldal nem létezik” üzenetet jeleníti meg.',
				],
			},
			demo: {
				date: '2026-09-27',
				title: 'Egy kipróbálható demó, az Ön nyelvén',
				tag: 'Új',
				items: [
					'<strong>A demó</strong>, a <a href="https://demo.basedb.eodia.com">demo.basedb.eodia.com</a> oldalon: a fiók az Ön böngészőjének nyelvén van előre kitöltve, egy ezen a nyelven lévő adatbázissal. Ott mindent elolvashat, és módosíthatja, ami már létezik; a létrehozás, a törlés és az MI ki van kapcsolva, és az adatbázis minden éjjel visszaáll a kiinduló állapotába.',
					'<strong>Az Ön saját demója</strong>: a <code>BASEDB_DEMO=1</code> mindenki számára megnyit egy példányt, nyelvenként egy előre elkészített, megosztott fiókkal. <a href="/hebergement/variables/#nyilvános-demó">A változók</a>',
					'<strong>Egy nyelv linkenként</strong>: a <code>?lang=de</code> egy basedb-cím végén németül jeleníti meg a bejelentkezési képernyőt vagy egy megosztott lapot; a webhely így az oldal nyelvén vezet a demóhoz. <a href="/fonctionnalites/droits/#az-ön-beállításai">Az Ön beállításai</a>',
				],
			},
			templateLanguages: {
				date: '2026-09-27',
				title: 'A sablonok az Ön nyelvén',
				tag: 'Új',
				items: [
					'<strong>A hivatalos sablonok a képernyő nyelvén jönnek létre</strong>: táblák, mezők, választási lehetőségek, nézetek, irányítópultok, automatizálások, MI-utasítások — és mintasorok egy, az adott nyelvhez igazított világból: a lyoni „Boulangerie Martin” a portlandi „Martin’s Bakery”-vé válik. <a href="/fonctionnalites/modeles/#az-ön-nyelvén">A sablonok</a>',
					'A <a href="/modeles/">webhely galériája</a> minden sablont a lap nyelvén mutat meg.',
					'<strong>Egy sablon, több szótár</strong>: egy sablon egyszer íródik meg, franciául; minden nyelv csak a szövegeit fordítja le, és a basedb maga követi minden feliratot, ahol azt idézik. Egy szótárt, amely megtörné a sablont, nem szolgál ki. <a href="/fonctionnalites/modeles/#sablon-közzététele-minden-példány-számára">Sablon közzététele</a>',
				],
			},
			details: {
				date: '2026-09-27',
				title: 'És egyebek',
				items: [
					'<strong>Egy sablon a mintasorai nélkül</strong>: a „Példaadatok betöltése” kikapcsolva, üres táblákat hoz létre, készen az Ön adataira. <a href="/fonctionnalites/modeles/#indulás-egy-sablonból">Indulás egy sablonból</a>',
					'<strong>Az API- és MCP-dokumentáció</strong> minden adatbázishoz az Ön képernyőjének nyelvén íródik. <a href="/integrations/api-rest/#a-generált-dokumentáció">A generált dokumentáció</a>',
					'Súgóbuborékok az alkalmazás témájában, mindenhol, ahol korábban a böngésző mutatta a saját változatait; a menük „Törlés” gombja pirossal; egy megjegyzés idejére mutatva a teljes dátum.',
				],
			},
			aiProvider: {
				date: '2026-09-27',
				title: 'A választott MI, akár a saját gépén',
				tag: 'Új',
				items: [
					'<strong>Egy negyedik MI-szolgáltató</strong>: bármely szerver, amely az OpenAI API-t beszéli — Azure, egy vállalati átjáró, egy, a saját gépén futó modell —, a <code>.env</code> fájlban megadva. A hívások naplója megmondja, kihez kerültek az adatok. <a href="/fonctionnalites/ia/">Az MI a basedb-ben</a>',
					'<strong>A bejelentkezési képernyő</strong> a rács és az SQL után egy irányítópultot is bemutat, amely egy szűrőt követ, valamint egy futó automatizálást, az MI-lépéssel együtt.',
				],
			},
			languages: {
				date: '2026-09-27',
				title: 'Formázott szöveg, változók, áttekinthetőbb kanban',
				tag: 'Új',
				items: [
					'<strong>Formázott szöveg</strong>: új mezőtípus, vizuális szerkesztőben formázva – címsorok, listák, idézetek, hivatkozások –, íráskor megtisztítva, és egy megszorítással a közvetlen SQL ellen is védve. <a href="/fonctionnalites/tables-et-champs/#formázott-szöveg-és-változók">Formázott szöveg és változók</a>',
					'<strong>Változók</strong>: egy hosszú szöveg hivatkozhat a sora egy oszlopára – <code>{{Ville}}</code> –, és mindenhol az értékével jelenik meg: rácsban, a sor részleteiben, az API-ban, az MCP-szerveren, megosztott nézetekben, automatizálásokban. Az oszlop a hivatkozást őrzi meg, ezt olvassa a <code>psql</code>.',
					'<strong>Áttekinthetőbb kanban</strong>: levegősebb kártyák, borítókép, és egy leírás, amely a sor értékeire hivatkozik – „Szállítás: {{Date}}, ügyfél: {{Client}}”. <a href="/fonctionnalites/vues/">Nézetek</a>',
					'<strong>Átnevezés egy mozdulattal</strong>: egyetlen párbeszédablak adatbázishoz, táblához vagy mezőhöz; a címke mindig változik, egy adminisztrátor pedig az adatbázisban is átnevezheti, hatáselemzéssel alátámasztva. <a href="/fonctionnalites/tables-et-champs/#a-struktúra-módosítása">A struktúra módosítása</a>',
					'<strong>Húsz nyelv</strong>: a felület, ez a webhely és a dokumentáció franciául, angolul, németül, spanyolul, olaszul, portugálul (Brazília), hollandul, lengyelül, csehül, svédül, dánul, norvégul, finnül, románul, magyarul, törökül, ukránul, japánul, egyszerűsített kínaiul és koreaiul. A basedb a böngésző nyelvét használja; a <strong>Beállítások › Megjelenés › Nyelv</strong> másikat rögzít, amely gépről gépre követi Önt. A számok és a dátumok a nyelvet követik. <a href="/fonctionnalites/droits/#az-ön-beállításai">Az Ön beállításai</a>',
				],
			},
			flows: {
				date: '2026-09-27',
				title: 'Folyamatalapú automatizálások',
				tag: 'Új',
				items: [
					'<strong>Gráfszerkesztő</strong>: az eseményindító, majd minden lépés egy-egy kártyán; egy vonalon lévő <strong>+</strong> ott ad hozzá egy lépést. Egy egyszerű automatizálás továbbra is elfér két kártyán. <a href="/fonctionnalites/automatisations/">Automatizálások</a>',
					'<strong>Sor keresése</strong> – egy rendelés ügyfele, az utolsó kifizetetlen számla –, majd módosítása, hivatkozás rá, összekapcsolása egy létrehozott sorral.',
					'<strong>Többágú feltételek</strong>: az első ág kerül sorra, amelynek feltétele teljesül, az „Egyébként” pedig akkor, ha egyiké sem; az ágak ezután újra összefutnak.',
					'<strong>Az adatok lépésről lépésre haladnak</strong>: a <code>{{e2.client}}</code> arra hivatkozik, amit egy lépés talált vagy létrehozott, a <code>{{e3.reponse.numero}}</code> arra, amit egy webhook válaszolt; minden szöveg menüje csak azt kínálja fel, ami biztosan megtörtént előtte.',
					'<strong>Minden futtatás, lépésről lépésre</strong>: a folyamatra helyezve kirajzolja a bejárt utat, és minden lépésnél megmondja, mit csinált és mennyi idő alatt.',
					'<strong>Az automatizálások Copilotja</strong>: írja le, mit tegyen az adatbázis magától, vagy kérdezze meg, miért volt sikertelen egy futtatás; teljes automatizálást javasol, amelyet egy kattintással a folyamatra helyez, átnéz, majd ment – Ön nélkül semmi nem kerül mentésre. <a href="/fonctionnalites/automatisations/#a-copilot">A Copilot</a>',
					'<strong>MI megkérdezése</strong> egy lépésben, mint egy MI-mezőben: a sorra és a korábbi lépésekre hivatkozó utasítás, a válasz pedig szövegként, számként, igen/nem értékként, dátumként vagy egy lista elemeként értelmezve, amelyet a következő lépések beírnak vagy elküldenek. <a href="/fonctionnalites/automatisations/#mi-megkérdezése">MI megkérdezése</a>',
				],
			},
			dashboards: {
				date: '2026-09-27',
				title: 'Irányítópultok: kérdések, diagramok, szűrők',
				tag: 'Új',
				items: [
					'<strong>Kérdések</strong> egérrel összeállítva – egy tábla, az illesztései, szűrők, mértékek nap, hét, hónap vagy év szerint – vagy <strong>SQL</strong>-ben megírva, csak olvasási módban és a saját jogosultságaival, változókkal együtt. <a href="/fonctionnalites/tableaux-de-bord/">Irányítópultok</a>',
					'<strong>Tizenötféle vizualizáció</strong>: szám, trend az előző időszakhoz képest, előrehaladás egy cél felé, mérő, oszlopdiagram, sávdiagram, vonaldiagram, területdiagram, kombinált, kördiagram, tölcsér, pontdiagram, táblázat, kereszttábla, Franciaország- vagy világtérkép.',
					'<strong>Felfedezés egy kattintással</strong>: egy pont megnyitja a sorait, egy finomabb időszakot, egy másik bontást.',
					'<strong>Rácsba rendezett irányítópultok</strong>: egérrel mozgatható és átméretezhető kártyák, lapok, szakaszcímek, szövegek, beágyazott oldalak.',
					'<strong>Közös szűrők</strong> – időszak, kategória, szöveg, szám, dátumcsoportosítás –, amelyek egy, több vagy az összes kártyát vezérlik, alapértelmezett értékkel.',
					'<strong>Testre szabható diagramok</strong>: minden adatsor vagy szelet színe és neve, gyűrű, félkör vagy rózsa, halmozás összegekkel, simított vagy lépcsőzetes vonalak, tengelyek, beosztások, logaritmikus skála; táblázatok átnevezett oszlopokkal, érték szerinti sávokkal és színekkel.',
					'<strong>Az irányítópultok Copilotja</strong>: egy beszélgetés, amely kérdéseket, az irányítópult – visszavonható – módosításait és a szűrők értékeit javasolja, egy kattintással alkalmazva. Csak a struktúra kerül a szolgáltatóhoz, hacsak nem engedélyezi neki az eredmények olvasását. <a href="/fonctionnalites/tableaux-de-bord/#a-copilot">A Copilot</a>',
					'<strong>Irányítópult megosztása</strong> hivatkozással, nyilvánosan vagy csak tagoknak – szükség esetén csoportoknak –, és beágyazása más webhelyre: kártyák és szűrők csak olvasható módon, a közzétevő jogosultságaival. <a href="/fonctionnalites/tableaux-de-bord/#irányítópult-megosztása">Megosztás</a>',
					'A „Felületek” neve mostantól <strong>Irányítópultok</strong>; a meglévők változatlanul nyílnak meg, az új rácson.',
				],
			},
			sqlViews: {
				date: '2026-09-27',
				title: 'Mentett lekérdezések és SQL-nézetek',
				tag: 'Új',
				items: [
					'<strong>SQL mindenkinek</strong>: Kezelés szint nélkül egy SQL-lap csak olvasási módban fut, az Ön saját jogosultságaival, amelyeket maga a PostgreSQL alkalmaz – egy hozzáférhetetlen tábla nem létezik, egy rejtett mező elutasításra kerül. Erre „Az Ön jogosultságai” címke emlékeztet. <a href="/fonctionnalites/requetes-et-vues-sql/">Lekérdezések és SQL-nézetek</a>',
					'<strong>Mentett lekérdezések</strong> a táblák alatt, a „Lekérdezések” rovatban: személyesek, az egész adatbázisnak vagy csoportoknak szólók. Egy lekérdezés megosztása a szövegét osztja meg, soha nem azt, amit a szerzője olvashat; az oldalsávból megnyitva azonnal lefut, csak olvasási módban.',
					'<strong>SQL-nézetek</strong>: valódi PostgreSQL-nézetek a táblák között, színnel, ikonnal és egy kis szemmel, a <code>psql</code>-ből és az Ön eszközeiből is olvashatók. Mindenki a saját jogosultságaival olvassa őket, az oldalsáv pedig csak annak mutatja, aki mindent olvashat belőlük.',
					'A nézetek követik a struktúrát: egy átnevezés nem töri el őket, egy módosított képlet egy pillanatra eltávolítja, majd visszahelyezi őket; amelyik már nem állja meg a helyét, javításra vár, a definíciója megmarad.',
				],
			},
			settings: {
				date: '2026-09-27',
				title: 'Az Ön beállításai',
				tag: 'Új',
				items: [
					'<strong>Beállítások</strong> a profilmenüben: a neve, a címe és a fiókjához kapcsolt identitásszolgáltatók; a jelszava és a nyitott munkamenetei. <a href="/fonctionnalites/droits/">Fiókok és bejelentkezés</a>',
					'<strong>Megjelenés</strong>: a téma, a dátumok sorrendje – <code>25/09/2026</code> vagy <code>2026-09-25</code> – és a naptárakban a hét első napja; az utóbbi kettő gépről gépre követi Önt.',
					'<strong>Értesítések</strong>: kapcsolja ki azokat, amelyeket már nem szeretne kapni, típusonként. <strong>Tokenek</strong>: az Ön által létrehozottak az összes adatbázisán, az utolsó használatuk és a visszavonásuk.',
				],
			},
			v020: {
				date: '2026-09-26',
				title: '0.2.0-s verzió: saját fiók, saját projektek, saját meghívások',
				tag: 'Új',
				items: [
					'<strong>Első bejelentkezés</strong>: egy új példányon az első oldal hozza létre az adminisztrátori fiókot, az Ön címével és jelszavával – nincs többé alapértelmezett fiók, sem a naplókban keresgélendő jelszó. <a href="/guides/installation/">Telepítés</a>',
					'<strong>Fióklétrehozás</strong>: mindenki létrehozza a fiókját, majd a saját projektjeit, amelyeknek kezelője lesz. Az adminisztráció lezárhatja, vagy bizonyos domainekre korlátozhatja. <a href="/hebergement/connexion/">Fiókok és bejelentkezés</a>',
					'<strong>Projekt vagy adatbázis megosztása</strong>: akinek Kezelés szintje van, hivatkozással hív meg Olvasás, Szerkesztés vagy Kezelés szinttel; látja, kinek van hozzáférése, módosítja vagy visszavonja a szintjét. Soha nem adhat többet, mint amit maga kezel.',
					'<strong>Adatvédelem</strong>: mindenki csak azokat a személyeket látja, akikkel közös projektje van, és az sem derül ki többé, ha egy projektnevet már más használ.',
					'<strong>Bejelentkezés Google-lel, Microsofttal</strong> és bármely OpenID Connect-szolgáltatóval (Keycloak, GitLab…), a <code>.env</code> fájlban megadva; az első bejelentkezés létrehozza a fiókot, ha a fióklétrehozás engedélyezett. <a href="/hebergement/connexion/">Beállítás</a>',
					'<strong>Új bejelentkezési képernyő</strong> az alkalmazás témájában, világos vagy sötét változatban, visszafogott animációval; illusztrált üres képernyők az alkalmazásban.',
					'<strong>Frissítés adatvesztés nélkül</strong>: a basedb induláskor magától frissíti a katalógusát, egy 0.1-es telepítést is beleértve, és nem indul el olyan adatbázison, amelyet egy újabb verzió már frissített. <a href="/hebergement/sauvegardes/">Frissítés</a>',
				],
			},
			dockerImage: {
				date: '2026-09-26',
				title: 'Egyetlen Docker-lemezkép',
				tag: 'Üzemeltetés',
				items: [
					'A basedb <strong>egyetlen lemezképben</strong> fér el – <code>eodia/basedb</code> a Docker Hubon, amd64-re és arm64-re –: a felület, az API (<code>/api</code>) és az MCP-szerver (<code>/mcp</code>), <strong>egyetlen porton</strong>. <a href="/guides/installation/">Telepítés</a>',
					'Két fájl elég – <code>docker-compose.yml</code> és <code>.env</code> –, a tároló klónozása és bármiféle fordítás nélkül; a frissítés a <code>docker compose pull</code> paranccsal történik.',
					'Egy domain mögött a HTTPS-proxynak már nincs útválasztási feladata: minden a 3000-es portra megy.',
				],
			},
			automations: {
				date: '2026-09-26',
				title: 'Automatizálások, felületek, képletek, együttműködés',
				tag: 'Új',
				items: [
					'<strong>Francia nyelvű képletek</strong> – <code>SI</code>, <code>ARRONDI</code>, <code>JOURS</code>… –, amelyekből a PostgreSQL által generált oszlopok lesznek; <strong>kikeresések</strong>, <strong>aggregálások</strong> és <strong>darabszámok</strong> a kapcsolatokon keresztül. <a href="/fonctionnalites/tables-et-champs/">Mezők</a>',
					'<strong>Új típusok</strong>: többszörös kapcsolat, személy, e-mail, automatikus szám, gomb; és típusként választható formátumok – pénznem, százalék, időtartam, csillagos értékelés, telefon, vonalkód.',
					'<strong>Nyolc nézet</strong>: a <strong>galéria</strong> és a <strong>lista</strong> csatlakozik a másik hathoz; <strong>személyes nézetek</strong> minden olvasónak, zárolt nézetek, kézi sorrend, függőségek az idővonalon. <a href="/fonctionnalites/vues/">Nézetek</a>',
					'<strong>A rács</strong>: gyorskeresés, csoportosítás, oszloponkénti összesítés a teljes szűrt halmazra, szabályalapú színezés, sormagasság.',
					'<strong>Megosztott nézetek</strong> csak olvasható módban, más webhelybe ágyazhatók; a naptárból <strong>iCalendar-hírcsatorna</strong> lesz a Google Naptárhoz, az Outlookhoz vagy az Apple Naptárhoz. <a href="/fonctionnalites/vues-partagees/">Megosztás</a>',
					'<strong>Együttműködés</strong>: megjegyzések és említések, értesítések, a többiek írásai valós időben, jelenlét a táblán és a soron. <a href="/fonctionnalites/collaboration/">Közös munka</a>',
					'<strong>Ctrl+Z</strong>: visszavonja az utolsó írást – egy cellát, egy áthúzott kártyát, egy teljes importálást –, és inkább elutasít, mint hogy felülírja, amit azóta valaki más módosított.',
					'<strong>Automatizálások</strong>: amikor egy sor létrejön vagy módosul, ütemezetten vagy egy gombra kattintva – módosítás, létrehozás, értesítés, webhook hívása, üzenet a Slackre. <a href="/fonctionnalites/automatisations/">Automatizálás</a>',
					'<strong>Felületek</strong>: irányítópultok – számok, diagramok, listák, szövegek –, mindenki a saját jogosultságaival olvassa őket. <a href="/fonctionnalites/tableaux-de-bord/">Irányítópultok</a>',
					'<strong>Integrációk</strong>: egy Slack-csatorna, és <strong>szinkronizált táblák</strong> egy online CSV-ből, egy naptárból vagy egy másik basedb nézetéből. <a href="/integrations/synchronisation/">Integrációk</a>',
					'<strong>Adatbázissablonok</strong>: tíz sablon galériája, egy mondatban leírt adatbázis az MI-nek, és bármely adatbázis menthető sablonként. <a href="/modeles/">A galéria</a>',
					'<strong>Jogosultságok</strong>: a Struktúra képernyő csak megtekintésre szolgál annak, akinek nincs Kezelés szintje.',
					'<strong>Új arculat</strong>: logó, színpaletta és megújult bejelentkezési képernyő.',
				],
			},
			simpler: {
				date: '2026-09-26',
				title: 'Egyszerűbb felület',
				items: [
					'<strong>Az oldalsáv</strong> már csak az adatbázisokat és tábláikat sorolja fel; a megnyitott adatbázis képernyői – Struktúra, Előzmények, Felületek, Automatizálások – egy blokkba kerültek, közvetlenül a profil fölé.',
					'<strong>A profilmenü</strong> ad helyet annak, ami nem adat: az API- és MCP-dokumentációnak, az integrációknak, a felhasználóknak és a jogosultságoknak.',
					'<strong>Egy SQL-lekérdezés</strong> a lapsáv „+” gombjával vagy az adatbázis menüjéből nyílik meg, és már nem jelenik meg kétszer az oldalsávban.',
					'<strong>Az Új adatbázis</strong> már a párbeszédablakban felkínálja a sablonokat és az MI-t; a bemutató adatbázis is ugyanazon a galérián keresztül érhető el.',
					'<strong>A képernyő nem kínálja fel, ami elutasításra kerülne</strong>: nincs struktúragomb Kezelés nélkül, nincs „Törlés” törlési jog nélkül; az olvasó pedig saját nézeteket hoz létre ahelyett, hogy hibaüzenetbe ütközne.',
					'<strong>A rendszeroszlopok</strong> a „Rendszerinformációk” alatt kaptak helyet, ahelyett hogy minden táblán felkínálnák őket.',
					'<strong>A sor részletei</strong> panel megkapja a megjegyzéseket, egy gombot levélíráshoz vagy híváshoz, és egy kattintással beállítható értékelést.',
					'<strong>A bejelentkezés</strong> lemond a 3D-s animált háttérről egy könnyű képernyő javára, amely tiszteletben tartja a „kevesebb mozgás” beállítást.',
				],
			},
			environments: {
				date: '2026-09-26',
				title: 'Környezetek, megosztott űrlapok, nézetek',
				items: [
					'<strong>Környezetek</strong>: éles, teszt és fejlesztői változat ugyanahhoz az adatbázishoz; egymás melletti összehasonlítás, migrációs terv, sorok szinkronizálása.',
					'<strong>Struktúra-előzmények</strong>: minden tábla- és mezőlétrehozás vagy -módosítás, a katalóguson lévő triggerrel rögzítve.',
					'<strong>Megosztott űrlapok</strong>: nyilvános vagy csak tagoknak szóló hivatkozás, lezárás dátum vagy a válaszok száma szerint, a válaszok hozzárendelése az előzményekben.',
					'<strong>Hat nézet</strong>: rács, kanban, naptár, idővonal, űrlap, kérdőív.',
					'<strong>Adatelőzmények</strong>: egy módosítás visszavonása, egy törölt sor visszaállítása.',
					'<strong>MI</strong>: MI-beállítás bármely mezőn, és a Copilot.',
					'<strong>Kapcsolat</strong> és <strong>URL</strong>: két külön típus; a hosszú szöveg Markdownban íródik.',
					'<strong>Webhookok</strong> aláírva és sorrendben, jóváhagyandó <strong>ügynökjavaslatok</strong>.',
					'<strong>Docker</strong>: háromcélú Dockerfile, teljes docker-compose, opcionális HTTPS-proxy.',
				],
			},
			projects: {
				date: '2026-09-25',
				title: 'Projektek, jogosultságok, MCP-szerver',
				items: [
					'<strong>Projektek</strong> az adatbázisok fölött, és <strong>csoportonkénti</strong> jogosultságok négy szinten: Nincs hozzáférés, Olvasás, Szerkesztés, Kezelés.',
					'<strong>Fiókok</strong>: ideiglenes jelszó, csere az első bejelentkezéskor, emelt szintű munkamenet az adminisztrációhoz.',
					'<strong>MCP-szerver</strong> és stdio-továbbító; a REST API-hoz és az MCP-hez közös <strong>integrációs tokenek</strong>.',
					'<strong>Generált „API és MCP” dokumentáció</strong> minden adatbázishoz.',
				],
			},
			fields: {
				date: '2026-09-20',
				title: 'Mezők, választási listák, importálás',
				items: [
					'Egy mező és egy választási lista lehetőségeinek módosítása.',
					'CSV- és JSON-fájlok <strong>importálása</strong>.',
					'A tábla menüje: átnevezés, leírás, törlés.',
				],
			},
			firstCommit: {
				date: '2026-09-20',
				title: 'Első commit',
				items: [
					'A monorepó: elnevezési szabályok, hibakód-nyilvántartás, az architektúra-dokumentumból kinyert katalógus, mag, API, felület.',
				],
			},
		},
	},
	roadmap: {
		label: 'Ütemterv',
		title: 'Ami ezután jön',
		intro: 'A basedb aktív fejlesztés alatt áll. Ez az oldal azt mutatja, mi hiányzik még, ígért dátumok nélkül. Ötlete vagy igénye van? <a href="https://github.com/eodia/basedb/issues">Nyisson egy hibajegyet</a>. Ami már megvan: az <a href="/nouveautes/">újdonságok</a>.',
		columns: {
			next: {
				title: 'Hamarosan',
				items: {
					restoreTable: {
						title: 'Egyetlen tábla visszaállítása',
						text: 'A törölt tábla a félretett neve alatt SQL-ből továbbra is olvasható; önálló visszaállítása a felületről még várat magára.',
					},
					aiSettings: {
						title: 'MI-beállítások a felületen',
						text: 'Szolgáltató, modell és kulcs munkaterületenként, az API környezetének érintése nélkül.',
					},
					mail: {
						title: 'Értesítések és meghívások e-mailben',
						text: 'Az említések, a válaszok és a kijelölések ma a basedb-n belül érkeznek, a meghívások pedig egy hivatkozással, amelyet Önnek kell elküldenie; később e-mailben is kimehetnek.',
					},
				},
			},
			later: {
				title: 'Később',
				items: {
					formLinks: {
						title: 'Kapcsolatok és fájlok a megosztott űrlapokban',
						text: 'Korlátozott keresés a kapcsolt táblában, és korlátozott fájlfeltöltés ismeretlen kitöltőknek.',
					},
					moreEvents: {
						title: 'Értesítés több eseményről',
						text: 'Értesítés egy űrlapra érkezett válaszról, egy ügynök javaslatáról, egy letiltott webhookról.',
					},
					sqlViewsAcross: {
						title: 'SQL-nézetek környezetek között',
						text: 'Az SQL-nézetek átmásolása a struktúrával együtt környezetek létrehozásakor vagy összehasonlításakor, és az adatbázissablonokban.',
					},
					loops: {
						title: 'Várakozás az automatizálásokban',
						text: 'Várakozás a következő lépés előtt („három nappal később”), és a folyamatok – feltételek, keresések, ciklusok – átvitele az adatbázissablonokba.',
					},
					textFormulas: {
						title: 'Szövegképletek',
						text: 'Egy szöveg részének kinyerése, cseréje vagy csonkítása.',
					},
					bulk: {
						title: 'Deklarált tömeges műveletek',
						text: 'Több ezer sor módosítása, egyetlen műveletként rögzítve az előzményekben.',
					},
					tombstones: {
						title: 'Törlési jelölők takarítása',
						text: 'A már szükségtelen törlési nyomok eltávolítása.',
					},
				},
			},
		},
	},
	gallery: {
		label: 'Sablonok',
		title: 'Kész adatbázis másodpercek alatt',
		intro: 'Minden sablon egymással összekapcsolt táblákat, példasorokat, nézeteket, egy irányítópultot, automatizálásokat hoz létre – és olyan mezőket, amelyeket az MI maga tölt ki. A basedb-ben: <strong>Új adatbázis</strong>, majd <strong>Indulás sablonból</strong>. Nincs megfelelő? Írja le egy mondatban, mire van szüksége: az MI testre szabott adatbázist javasol.',
		filter: 'Szűrés kategória szerint',
		all: 'Összes',
		otherCategory: 'Egyéb',
		ai: '✦ MI',
		tables: {
			one: '{n} tábla',
			other: '{n} tábla',
		},
		rows: {
			one: '{n} sor',
			other: '{n} sor',
		},
		views: {
			one: '{n} nézet',
			other: '{n} nézet',
		},
		howtoTitle: 'Sablonok beállítása JSON-ban',
		howto: 'A sablon egy JSON-fájl: a táblái, mezői, kapcsolatai, sorai, nézetei, irányítópultjai, automatizálásai és MI-mezőinek utasításai. Az ezen az oldalon látható sablonok a tároló <a href="https://github.com/eodia/basedb/tree/main/packages/templates/catalog"><code>packages/templates/catalog</code></a> mappájának fájljai; minden basedb-példány beolvassa a <a href="/modeles/catalogue.json"><code>catalogue.json</code></a> fájlt, és felkínálja őket a felhasználóinak. Egy adminisztrátor saját sablonokat is importálhat a példányába, és bármely adatbázis menthető sablonként.',
		format: {
			href: '/fonctionnalites/modeles/',
			label: 'A sablonok formátuma →',
		},
		back: '← Minden sablon',
		defaultCategory: 'Sablon',
		sampleRows: {
			one: '{n} példasor',
			other: '{n} példasor',
		},
		aiTitle: 'Amit az MI kiszámít',
		useTitle: 'A sablon használata',
		useSteps: [
			'A basedb-ben: <strong>Új adatbázis</strong>.',
			'<strong>Indulás sablonból</strong>, majd „{label}”.',
		],
		create: '<strong>Adatbázis létrehozása</strong>.',
		createWithAi: '<strong>Adatbázis létrehozása</strong> – ha szeretné, annak elfogadásával, hogy az MI-mezőket az MI-szolgáltatója számítsa ki.',
		download: 'JSON letöltése',
		downloadNote: 'Hogy importálja a példányába, vagy átalakítsa, mielőtt a katalógusba javasolná.',
		viewMeta: '– {kind}, {table}',
		dashboard: '<strong>Irányítópult</strong>: „{label}” – {blocks}',
		blocks: {
			one: '{n} blokk',
			other: '{n} blokk',
		},
		automation: '<strong>Automatizálás</strong>: „{label}”',
		yes: 'Igen',
		no: 'Nem',
		me: 'Ön',
		kinds: {
			short_text: 'Rövid szöveg',
			long_text: 'Hosszú szöveg',
			rich_text: 'Formázott szöveg',
			number: 'Szám',
			boolean: 'Jelölőnégyzet',
			date: 'Dátum',
			datetime: 'Dátum és idő',
			select: 'Egyszeres választás',
			multi_select: 'Többszörös választás',
			url: 'URL',
			email: 'E-mail',
			user: 'Személy',
			autonumber: 'Automatikus szám',
			formula: 'Képlet',
			lookup: 'Kikeresés',
			rollup: 'Aggregálás',
			count: 'Darabszám',
			button: 'Gomb',
			link: 'Kapcsolat',
			multi_link: 'Többszörös kapcsolat',
		},
		viewKinds: {
			grid: 'Rács',
			kanban: 'Kanban',
			calendar: 'Naptár',
			timeline: 'Idővonal',
			gallery: 'Galéria',
			list: 'Lista',
			form: 'Űrlap',
		},
	},
	templates: {
		demo: {
			label: 'Bemutató: Lumen Műhely',
			summary: 'Egy kis ügynökség az ügyfeleivel, projektjeivel, feladataival, számláival és véleményeivel: a basedb minden oldala egyetlen adatbázisban.',
			description: 'A bemutató adatbázis. A Lumen Műhely egy kitalált tervezőiroda. Az adatbázisa bemutatja a táblák közötti kapcsolatokat, a kikereséseket és aggregálásokat (árbevétel ügyfelenként, átlagos értékelés), a képleteket (bruttó összeg, késés), három MI által számított mezőt az ügyfélvéleményekhez (hangulat, téma, javasolt válasz), minden nézettípust – rács, kanban, naptár, idővonal függőségekkel, galéria, lista, űrlap –, egy irányítópultot és két automatizálást.',
			category: 'Bemutató',
			tags: ['MI', 'Kapcsolatok', 'Minden nézet', 'Irányítópult'],
		},
		'analyse-avis': {
			label: 'Ügyfélvélemények elemzése',
			summary: 'Gyűjtse össze a véleményeket, és hagyja, hogy az MI kinyerje belőlük a hangulatot, a témákat, a sürgősséget és egy válaszvázlatot.',
			description: 'Üzletnek, étteremnek vagy márkának: a vélemények nyilvános űrlapról vagy importból érkeznek, és az MI mindegyiket elolvassa. Osztályozza a hangulatot, azonosítja a fő témát, jelzi a gyors választ igénylőket, kinyeri az ügyfél javaslatát, és átnézendő választ fogalmaz. A termékek összesítik átlagos értékelésüket és véleményeik számát; egy irányítópult követi az elégedettséget.',
			category: 'Ügyfélkapcsolat',
			tags: ['MI', 'Űrlap', 'Irányítópult'],
		},
		'base-connaissances': {
			label: 'Tudásbázis',
			summary: 'Súgócikkek és ügyfélkérdések: az MI összefoglal, kategorizál, és a cikkek alapján választ javasol.',
			description: 'Ügyfélszolgálatnak. A súgócikkek kategóriák szerint rendezettek és időben követhetők; az ügyfélkérdések nyilvános űrlapon érkeznek. Az MI összefoglal minden cikket és értékeli a szintjét, osztályoz minden kérdést, és átnézendő válaszvázlatot ír.',
			category: 'Ügyfélszolgálat',
			tags: ['MI', 'Űrlap', 'Lista'],
		},
		'calendrier-editorial': {
			label: 'Szerkesztőségi naptár',
			summary: 'Naptárba ütemezett cikkek, bejegyzések és hírlevelek; az MI figyelemfelkeltő bevezetőket és kulcsszavakat javasol.',
			description: 'Marketingcsapatnak vagy szerkesztőségnek. Minden tartalom az ötlettől a megjelenésig halad, a megjelenési naptárra kerül, és egy kampányhoz tartozik. Az MI a brief alapján figyelemfelkeltő bevezetőt és kulcsszavakat javasol, egy űrlapon pedig az egész cég javasolhat témát.',
			category: 'Marketing',
			tags: ['MI', 'Naptár', 'Kanban', 'Űrlap'],
		},
		crm: {
			label: 'Értékesítési CRM',
			summary: 'Cégek, kapcsolattartók és lehetőségek: értékesítési folyamat, kommunikáció, és az MI, amely a következő lépést javasolja.',
			description: 'Könnyű CRM értékesítési csapatnak. A lehetőségek egy értékesítési folyamatban haladnak előre, a valószínűségükkel súlyozott összeget kapnak, az MI pedig a jegyzetek alapján értékeli a kockázatukat, és javasolja a következő lépést. Az ügyfelekkel folytatott kommunikáció rögzítve és összefoglalva, a cégeknél pedig összesítve látszik, mekkora üzletet képviselnek.',
			category: 'Értékesítés',
			tags: ['MI', 'Értékesítési folyamat', 'Kanban', 'Naptár'],
		},
		evenements: {
			label: 'Események és regisztrációk',
			summary: 'Konferenciák, workshopok és webináriumok: a regisztrációk, a szabad helyek és a résztvevők visszajelzései, amelyeket az MI dolgoz fel.',
			description: 'Ismétlődő események szervezéséhez. Minden esemény nyilvántartja a regisztráltakat és a szabad helyeket; a regisztrációk a részvételig haladnak előre. Az esemény után a résztvevők visszajelzést adnak, amelyet az MI hangulat szerint osztályoz és összefoglal. Egy nyilvános űrlapon fel lehet iratkozni a levelezőlistára.',
			category: 'Rendezvényszervezés',
			tags: ['MI', 'Naptár', 'Űrlap', 'Aggregálások'],
		},
		'gestion-projet': {
			label: 'Projektmenedzsment',
			summary: 'Projektek, feladatok és mérföldkövek: ütemterv, feladatok közötti függőségek, kanban és naptár.',
			description: 'Több párhuzamos projekt irányításához. Minden projekt összesíti a feladatait és óráit; a feladatok kanbanon követhetők, idővonalon ütemezhetők, amely a függőségeiket is megrajzolja, a mérföldkövek pedig naptárban láthatók. Az MI a leírás és a haladás alapján projekt-helyzetjelentést ír a vezetésnek.',
			category: 'Szervezés',
			tags: ['Idővonal', 'Függőségek', 'Kanban', 'MI'],
		},
		inventaire: {
			label: 'Leltár és készlet',
			summary: 'Cikkek, beszállítók és készletmozgások: a készlet magától számolódik, a hiányok előre láthatók.',
			description: 'Műhelynek, üzletnek vagy üzemeltetési részlegnek. Minden be- és kivételezés egy mozgás; az egyes cikkek készlete ezek összege, értéke egy képlet, a küszöbérték alatti cikkek pedig az „À commander” nézetben jelennek meg. Az MI a neve és kategóriája alapján megírja minden cikk adatlapját.',
			category: 'Műveletek',
			tags: ['Aggregálások', 'Képletek', 'Galéria', 'MI'],
		},
		recrutement: {
			label: 'Toborzás',
			summary: 'Nyitott pozíciók, jelöltek és interjúk; az MI összefoglalja az egyes jelentkezéseket, és javasolja, mire érdemes rákérdezni.',
			description: 'A toborzás követése a jelentkezéstől a felvételig. A jelöltek nyilvános űrlapon jelentkeznek, lépésről lépésre haladnak egy kanbanon, az interjúk pedig naptárban ütemezhetők. Az MI elolvassa a motivációs levelet és a jegyzeteket: összefoglalót ír, és javasolja az interjún felteendő kérdéseket. Segít az olvasásban, de nem dönt.',
			category: 'Emberi erőforrások',
			tags: ['MI', 'Űrlap', 'Kanban', 'Naptár'],
		},
		'suivi-tickets': {
			label: 'Hibajegykezelés',
			summary: 'Az MI által osztályozott hibák és kérések, sprintenként követve a megoldásig, bejelentő űrlappal.',
			description: 'Hibajegykezelő egy termékcsapatnak. Minden jegy egy komponenshez és egy sprinthez tartozik; az MI kategóriát javasol, megbecsüli a súlyosságot, és összefoglalja a bejelentést. Egy kanban követi a haladást, egy idővonal mutatja a sprinteket, egy űrlapon bárki bejelenthet egy problémát, egy automatizálás pedig rögzíti a megoldás dátumát.',
			category: 'Termék és technika',
			tags: ['MI', 'Kanban', 'Űrlap', 'Sprintek'],
		},
	},
} satisfies DeepPartial<Dict>;
