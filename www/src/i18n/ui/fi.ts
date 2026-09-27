/**
 * The Finnish texts of the landing pages, laid over the French ones (`fr.ts`).
 *
 * See `../README.md`.
 */
import type { DeepPartial, Dict } from './index';

export default {
	meta: {
		home: {
			title: 'basedb – yhteiskäyttöinen tietokanta, jonka jokainen taulukko on oikea PostgreSQL-taulukko',
			description: 'Ruudukot ja kahdeksan näkymää, kaavat, jaetut lomakkeet ja näkymät, kommentit, automaatiot, koontinäytöt, kenttätason käyttöoikeudet, täydellinen historia, REST API ja MCP-palvelin – oikeissa, selkeästi nimetyissä PostgreSQL-taulukoissa. Itse ylläpidetty, AGPL-3.0.',
		},
		changelog: {
			title: 'Uutuudet – basedb',
			description: 'Mitä basedb:ssä on muuttunut versio versiolta.',
		},
		roadmap: {
			title: 'Tiekartta – basedb',
			description: 'Mitä basedb tekee seuraavaksi.',
		},
		gallery: {
			title: 'Mallit – basedb',
			description: 'Valmiita tietokantoja: tikettien seuranta, arvioiden analyysi, CRM, rekrytointi… esimerkkiriveineen, näkymineen, koontinäyttöineen ja tekoälyn laskemine kenttineen.',
		},
		template: {
			title: '{label} – basedb-mallit',
		},
	},
	eodia: {
		home: 'https://eodia.com/',
		about: 'https://eodia.com/about/',
		contact: 'https://eodia.com/contact/',
	},
	nav: {
		aria: 'Päänavigaatio',
		home: 'basedb – etusivu',
		links: [
			{
				href: '/#fonctionnalites',
				label: 'Ominaisuudet',
			},
			{
				href: '/modeles/',
				label: 'Mallit',
			},
			{
				href: '/guides/introduction/',
				label: 'Dokumentaatio',
			},
			{
				href: '/nouveautes/',
				label: 'Uutuudet',
			},
		],
		developers: 'Kehittäjät',
		github: 'basedb:n GitHub-tietovarasto',
		install: 'Asenna',
		menu: {
			open: 'Avaa valikko',
			close: 'Sulje valikko',
			features: {
				label: 'Ominaisuudet',
				groups: {
					organize: {
						title: 'Järjestä',
						items: {
							tables: {
								href: '/fonctionnalites/tables-et-champs/',
								title: 'Taulukot ja kentät',
								text: 'Kentät kaikkeen, suhteet, kaavat ranskaksi.',
							},
							views: {
								href: '/fonctionnalites/vues/',
								title: 'Kahdeksan näkymää',
								text: 'Ruudukko, kanban, kalenteri, aikajana, galleria, luettelo, lomake, kyselylomake.',
							},
							forms: {
								href: '/fonctionnalites/formulaires-partages/',
								title: 'Lomakkeet',
								text: 'Linkki jaettavaksi: jokainen vastaus muuttuu riviksi.',
							},
							files: {
								href: '/fonctionnalites/fichiers/',
								title: 'Tiedostot ja kuvat',
								text: 'Tarjoukset, valokuvat, sopimukset, tallennettuina oman rivinsä yhteyteen.',
							},
						},
					},
					collaborate: {
						title: 'Tee yhteistyötä',
						items: {
							live: {
								href: '/fonctionnalites/collaboration/',
								title: 'Reaaliaika ja kommentit',
								text: 'Näe muiden työskentely, kommentoi riviä, mainitse kollega.',
							},
							rights: {
								href: '/fonctionnalites/droits/',
								title: 'Käyttöoikeudet ja tiimit',
								text: 'Kuka näkee mitä ja kuka muokkaa mitä, sarakkeen tarkkuudella.',
							},
							history: {
								href: '/fonctionnalites/historique/',
								title: 'Historia',
								text: 'Jokainen muutos tallennettuna, ja kumottavissa.',
							},
							shared: {
								href: '/fonctionnalites/vues-partagees/',
								title: 'Jaetut näkymät',
								text: 'Näkymä linkin takana, omalla sivustollasi tai kalenterissasi.',
							},
						},
					},
					automate: {
						title: 'Automatisoi ja analysoi',
						items: {
							automations: {
								href: '/fonctionnalites/automatisations/',
								title: 'Automaatiot',
								text: 'Kun rivi muuttuu: ilmoita, luo, kirjoita, kysy tekoälyltä.',
							},
							dashboards: {
								href: '/fonctionnalites/tableaux-de-bord/',
								title: 'Koontinäytöt',
								text: 'Viisitoista visualisointia, yhteiset suodattimet, jaettava linkki.',
							},
							ai: {
								href: '/fonctionnalites/ia/',
								title: 'Tekoäly ja Copilot',
								text: 'Tietokanta yhdellä lauseella, kentät jotka täyttyvät itsestään.',
							},
							templates: {
								href: '/modeles/',
								title: 'Mallit',
								text: 'Kymmenen käyttövalmista tietokantaa, muokattavissa.',
							},
						},
					},
				},
				feature: {
					tag: 'Uutta',
					title: 'Työnkulkuautomaatiot',
					text: 'Etsi, päätä, kysy tekoälyltä: graafieditori, ja jokainen suoritus voidaan lukea vaihe vaiheelta.',
					href: '/nouveautes/',
					cta: 'Kaikki uutuudet',
				},
				all: 'Kaikki ominaisuudet',
			},
			solutions: {
				label: 'Ratkaisut',
				title: 'Jokaiselle tiimille',
				items: {
					crm: {
						team: 'Myynti',
						text: 'Myyntiputki, yhteystiedot, muistutukset.',
					},
					recrutement: {
						team: 'Henkilöstöhallinto',
						text: 'Hakemukset, haastattelut, tekoälyn tiivistelmät.',
					},
					'calendrier-editorial': {
						team: 'Markkinointi',
						text: 'Artikkelit, päivitykset ja uutiskirjeet aikataulutettuina.',
					},
					inventaire: {
						team: 'Operaatiot',
						text: 'Itsestään laskettu varasto, loppumiset näkyvissä etukäteen.',
					},
					'gestion-projet': {
						team: 'Projektit',
						text: 'Virstanpylväät, tehtävät ja riippuvuudet.',
					},
					'suivi-tickets': {
						team: 'Tuote',
						text: 'Tekoälyn lajittelemat bugit ja pyynnöt.',
					},
					'base-connaissances': {
						team: 'Tuki',
						text: 'Ohjeartikkelit, kysymykset, ehdotetut vastaukset.',
					},
					evenements: {
						team: 'Tapahtumat',
						text: 'Ilmoittautumiset, paikat, palaute.',
					},
					'analyse-avis': {
						team: 'Asiakassuhteet',
						text: 'Tekoälyn lukemat ja luokittelemat asiakasarviot.',
					},
				},
				ask: {
					title: 'Jotain muuta mielessä?',
					text: 'Kuvaile tarpeesi yhdellä lauseella: tekoäly ehdottaa räätälöityä tietokantaa.',
					href: '/modeles/',
				},
				all: 'Kaikki mallit',
			},
			developers: {
				label: 'Kehittäjät',
				groups: {
					build: {
						title: 'Integroi',
						items: {
							api: {
								href: '/integrations/api-rest/',
								title: 'REST API',
								text: 'Samat tiedot kuin käyttöliittymässä, kuvattuna OpenAPI 3.1:llä.',
							},
							mcp: {
								href: '/integrations/mcp/',
								title: 'MCP-palvelin',
								text: 'Työkaluja tekoälyagenteillesi, omilla käyttöoikeuksillasi.',
							},
							webhooks: {
								href: '/integrations/webhooks/',
								title: 'Webhookit',
								text: 'Jokainen kirjoitus, allekirjoitettuna, järjestyksessä, uudelleenyritettynä.',
							},
							sql: {
								href: '/integrations/sql/',
								title: 'Suora SQL',
								text: 'Oikeita PostgreSQL-taulukoita, selkeästi nimettyinä.',
							},
							sync: {
								href: '/integrations/synchronisation/',
								title: 'Synkronointi',
								text: 'Taulukoita, jotka pysyvät ajan tasalla muualta.',
							},
						},
					},
					host: {
						title: 'Isännöi',
						items: {
							docker: {
								href: '/hebergement/docker/',
								title: 'Docker Compose',
								text: 'Yksi image, yksi PostgreSQL-tietokanta, yksi portti.',
							},
							env: {
								href: '/hebergement/variables/',
								title: 'Muuttujat',
								text: 'Kaikki asetukset .env-tiedostossa.',
							},
							https: {
								href: '/hebergement/https/',
								title: 'Verkkotunnus ja HTTPS',
								text: 'Omansa proxyn takana, tai mukana tulevalla Caddyllä.',
							},
							sso: {
								href: '/hebergement/connexion/',
								title: 'Kirjautuminen ja SSO',
								text: 'Google, Microsoft, mikä tahansa OpenID Connect -palveluntarjoaja.',
							},
							backup: {
								href: '/hebergement/sauvegardes/',
								title: 'Varmuuskopiot ja päivitykset',
								text: 'pg_dump, ja päivitykset ilman tietojen menetystä.',
							},
						},
					},
				},
				feature: {
					title: 'Kehittäjien sivu',
					text: 'Oikea PostgreSQL-taulukko jokaisen ruudukon takana.',
					href: '/developpeurs/',
				},
			},
			resources: {
				label: 'Resurssit',
				groups: {
					learn: {
						title: 'Opi',
						items: {
							docs: {
								href: '/guides/introduction/',
								title: 'Dokumentaatio',
								text: 'Koko basedb, vaihe vaiheelta.',
							},
							start: {
								href: '/guides/premiers-pas/',
								title: 'Ensimmäiset askeleet',
								text: 'Ensimmäinen tietokanta, tuonnista näkymään.',
							},
							install: {
								href: '/guides/installation/',
								title: 'Asennus',
								text: 'Kaksi tiedostoa ja yksi komento.',
							},
							principles: {
								href: '/architecture/principes/',
								title: 'Periaatteet',
								text: 'Miten basedb on rakennettu, ja miksi.',
							},
						},
					},
					follow: {
						title: 'Seuraa projektia',
						items: {
							news: {
								href: '/nouveautes/',
								title: 'Uutuudet',
								text: 'Mikä on muuttunut, versio versiolta.',
							},
							roadmap: {
								href: '/feuille-de-route/',
								title: 'Tiekartta',
								text: 'Mitä on tulossa seuraavaksi.',
							},
							github: {
								href: 'https://github.com/eodia/basedb',
								title: 'GitHub',
								text: 'Koodi, tiketit, versiot.',
							},
							eodia: {
								href: 'https://eodia.com/',
								title: 'Eodia',
								text: 'Studio, joka tekee basedb:n.',
							},
						},
					},
				},
			},
		},
	},
	language: {
		label: 'Kieli',
		current: 'Kieli: {name}',
	},
	footer: {
		tagline: 'Yhteiskäyttöinen tietokanta, jonka jokainen taulukko on oikea PostgreSQL-taulukko.',
		madeBy: 'Vapaa ohjelmisto, jonka tekee <a class="eodia" href="https://eodia.com/">Eodia</a>, tekoälynatiivi ohjelmistostudio.',
		columns: {
			product: {
				title: 'Tuote',
				links: [
					{
						href: '/#fonctionnalites',
						label: 'Ominaisuudet',
					},
					{
						href: '/nouveautes/',
						label: 'Uutuudet',
					},
					{
						href: '/feuille-de-route/',
						label: 'Tiekartta',
					},
					{
						href: '/#faq',
						label: 'Usein kysyttyä',
					},
				],
			},
			docs: {
				title: 'Dokumentaatio',
				links: [
					{
						href: '/guides/introduction/',
						label: 'Johdanto',
					},
					{
						href: '/guides/installation/',
						label: 'Asennus',
					},
					{
						href: '/integrations/api-rest/',
						label: 'REST API',
					},
					{
						href: '/integrations/mcp/',
						label: 'MCP-palvelin',
					},
				],
			},
			hosting: {
				title: 'Isännöinti',
				links: [
					{
						href: '/hebergement/docker/',
						label: 'Docker Compose',
					},
					{
						href: '/hebergement/variables/',
						label: 'Ympäristömuuttujat',
					},
					{
						href: '/hebergement/https/',
						label: 'Verkkotunnus ja HTTPS',
					},
					{
						href: '/hebergement/sauvegardes/',
						label: 'Varmuuskopiot',
					},
				],
			},
			project: {
				title: 'Projekti',
				links: [
					{
						href: 'https://github.com/eodia/basedb',
						label: 'GitHub',
					},
					{
						href: 'https://github.com/eodia/basedb/tree/main/docs/architecture',
						label: 'Arkkitehtuuridokumentti',
					},
					{
						href: 'https://github.com/eodia/basedb/blob/main/LICENSE',
						label: 'AGPL-3.0-lisenssi',
					},
					{
						href: 'https://github.com/eodia/basedb/issues',
						label: 'Ilmoita ongelmasta',
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
						label: 'Tietoa meistä',
					},
					{
						href: 'https://eodia.com/contact/',
						label: 'Ota yhteyttä',
					},
				],
			},
		},
		copyright: '© {year} <a href="https://eodia.com/">Eodia</a> · AGPL-3.0-or-later',
		builtWith: 'Sivusto on tehty Astrolla ja Starlightilla.',
	},
	docsFooter: {
		madeBy: 'basedb on vapaa ohjelmisto, jonka tekee <a href="https://eodia.com/">Eodia</a>, tekoälynatiivi ohjelmistostudio.',
	},
	teams: {
		meta: {
			title: 'basedb – kaikki työsi, samassa paikassa',
			description: 'Asiakkaat, projektit, varastot, hakemukset: tietokanta, jota koko tiimi muokkaa yhtä aikaa taulukkona, kanbanina tai kalenterina, koontinäyttöineen, automaatioineen ja tekoälyllä. Ei koodia, vapaa ja ilmainen.',
		},
		hero: {
			eyebrow: 'basedb',
			title: 'Kaikki työsi.',
			titleAccent: 'Vihdoin samassa paikassa.',
			lead: 'Taulukot, kalenterit, lomakkeet, koontinäytöt ja automaatiot koko tiimille. Yhtä helppoa kuin taulukkolaskentaohjelma. Ei yhtäkään koodiriviä.',
			primary: 'Tutustu malleihin',
			secondary: 'Katso demo',
			facts: ['Ei koodia', 'Vapaa ja ilmainen', 'Tietosi pysyvät sinulla'],
		},
		story: {
			grid: {
				title: 'Koko tiimi, samassa taulukossa.',
				text: 'Kaikki työskentelevät siinä yhtä aikaa, ja kaikki näkevät saman, ajan tasalla.',
			},
			copilot: {
				title: 'Kysy. Copilot hoitaa sen.',
				text: '”Ketä minun pitäisi muistuttaa tällä viikolla?” — se ehdottaa oikean suodattimen, ja otat sen käyttöön yhdellä napsautuksella.',
			},
			kanban: {
				title: 'Vedä. Se on ajan tasalla.',
				text: 'Jokainen vaihe on omana sarakkeenaan; kortin siirtäminen muokkaa riviä.',
			},
			calendar: {
				title: 'Kaikki päivämäärät paikoillaan.',
				text: 'Tapaamiset ilmestyvät itsestään, ja seuraavat mukana aina kalenteriisi asti.',
			},
			dashboard: {
				title: 'Ja kaikki, yhdellä silmäyksellä.',
				text: 'Luvut lasketaan itsestään, samoista riveistä.',
			},
		},
		stage: {
			aria: 'Tiimin asiakasseuranta basedb:ssä: taulukko, Copilot, kanban, kalenteri, koontinäyttö',
			tabs: {
				grid: 'Taulukko',
				copilot: 'Copilot',
				kanban: 'Kanban',
				calendar: 'Kalenteri',
				dashboard: 'Koontinäyttö',
			},
			project: 'Pääprojekti',
			projectMeta: 'Projekti · 2 tietokantaa',
			filterNav: 'Suodata navigointia',
			base: 'Myynti',
			otherBase: 'Tuki',
			tables: ['Asiakkaat', 'Yhteystiedot', 'Tarjoukset'],
			baseSection: 'Tietokanta · Myynti',
			screens: ['Koontinäytöt', 'Automaatiot'],
			user: 'Léa Martin',
			views: { grid: 'Kaikki rivit', kanban: 'Vaiheittain', calendar: 'Tapaamiset' },
			toolbar: {
				filter: 'Suodata',
				columns: 'Sarakkeet',
				group: 'Ryhmittele',
				colors: 'Värit',
				sort: 'Lajittele',
				configure: 'Määritä',
			},
			search: 'Hae…',
			add: 'Lisää',
			columns: {
				name: 'Asiakas',
				status: 'Vaihe',
				owner: 'Vastuuhenkilö',
				amount: 'Summa',
				next: 'Seuraava tapaaminen',
			},
			statuses: {
				contact: 'Otettava yhteyttä',
				meeting: 'Tapaaminen',
				quote: 'Tarjous lähetetty',
				signed: 'Allekirjoitettu',
			},
			clients: [
				'Leipomo Nieminen',
				'Lääkäriasema Koivikko',
				'Metsälän lukio',
				'Pyörät Kaikille',
				'Herkkukauppa Suola',
				'Vuoksen Konepaja',
				'Studio Mäkelä',
			],
			addRow: 'Lisää rivi',
			perPage: 'Rivejä sivulla',
			card: 'Vastuuhenkilönä {owner}, tapaaminen {date}',
			addCard: 'Lisää kortti',
			today: 'Tänään',
			month: 'Kuukausi',
			week: 'Viikko',
			dashboards: 'Koontinäytöt',
			questions: 'Kysymykset',
			dashboard: 'Myynnin seuranta',
			dashboardText: 'Oleellisin yhdellä silmäyksellä.',
			dashboardTabs: ['Yleiskatsaus', 'Toiminta'],
			period: 'Ajanjakso',
			thisYear: 'Tänä vuonna',
			share: 'Jaa',
			edit: 'Muokkaa',
			explore: 'Tutki tietoja',
			chart: 'Summa asiakkaittain',
			byStage: 'Asiakkaat vaiheittain',
			kpis: {
				signed: 'Allekirjoitettu',
				pending: 'Odottavat tarjoukset',
				rate: 'Allekirjoittaneet asiakkaat',
			},
			copilot: {
				question: 'Ketä minun pitäisi muistuttaa tällä viikolla?',
				thinking: 'Mietitään…',
				answer: 'Neljä asiakasta odottaa vastausta: kaksi lähetettyä tarjousta ja kaksi valmisteltavaa tapaamista.',
				card: 'Suodata Asiakkaat',
				filter: 'Vaihe: Tarjous lähetetty tai Tapaaminen',
				apply: 'Käytä suodatinta',
				applied: 'Suodatin otettu käyttöön',
				placeholder: 'Kysy Copilotilta…',
				filtered: '{n} riviä suodatettu',
			},
		},
		video: {
			eyebrow: 'Demo',
			title: 'Koko basedb,',
			titleAccent: 'neljässä minuutissa.',
			text: 'Tietokannan luominen, täyttäminen, jakaminen, automatisointi ja ohjaaminen: täysi opastettu kierros.',
			play: 'Toista video',
			duration: '4 min 35 s',
			chapters: 'Luvut',
			captions: 'Ranska',
			inFrench: 'Video on ranskaksi, tekstitys ranskaksi.',
			list: [
				{ time: '0:08', title: 'Luo tietokanta' },
				{ time: '0:35', title: 'Taulukot, kentät ja kaavat' },
				{ time: '1:10', title: 'Rivien tiedot ja yhteistyö' },
				{ time: '1:33', title: 'Kahdeksan näkymää samoihin riveihin' },
				{ time: '2:01', title: 'Lomakkeet ja tekoäly' },
				{ time: '2:37', title: 'Automaatiot' },
				{ time: '2:59', title: 'Koontinäytöt' },
				{ time: '3:15', title: 'SQL:ää kaikille' },
				{ time: '3:43', title: 'Historia ja käyttöoikeudet' },
				{ time: '4:01', title: 'API, MCP ja Copilot' },
			],
		},
		together: {
			eyebrow: 'Yhteistyö',
			title: 'Kaikki.',
			titleAccent: 'Samaan aikaan.',
			text: 'Muiden tekemät muutokset näkyvät suoraan. Näet, kuka katsoo mitä riviä, keskustelet siitä samassa paikassa, ja @-merkki riittää kollegan hälyttämiseen.',
			demo: {
				path: 'Myynti / Tarjoukset',
				here: '3 henkilöä tällä taulukolla',
				columns: {
					client: 'Asiakas',
					status: 'Vaihe',
					amount: 'Summa',
					due: 'Eräpäivä',
				},
				statuses: {
					draft: 'Luonnos',
					sent: 'Lähetetty',
					signed: 'Allekirjoitettu',
				},
				rows: [
					'Leipomo Nieminen',
					'Lääkäriasema Koivikko',
					'Metsälän lukio',
					'Pyörät Kaikille',
					'Herkkukauppa Suola',
					'Vuoksen Konepaja',
				],
				comment: '@{name} voitko hyväksyä tämän tarjouksen tänä iltana mennessä?',
				reply: 'Hyväksytty!',
				toast: '{name} muokkasi kenttää ”{field}”',
			},
			points: {
				live: {
					title: 'Reaaliajassa',
					text: 'Jokainen muutos näkyy muille heti, sivua päivittämättä.',
				},
				comments: {
					title: 'Kommentit ja maininnat',
					text: 'Kommentoi riviä, mainitse kollega @-merkillä, ja kello ilmoittaa hänelle.',
				},
				undo: {
					title: 'Kumoa turvallisesti',
					text: 'Ctrl+Z kumoaa vain viimeisimmän muutoksesi – ei koskaan kollegan.',
				},
			},
			link: {
				href: '/fonctionnalites/collaboration/',
				label: 'Yhdessä työskentely',
			},
		},
		automate: {
			eyebrow: 'Automaatiot',
			title: 'Se tekee töitä',
			titleAccent: 'kun nukut.',
			text: 'Kuvaa kerran, mitä pitää tapahtua. Kun rivi muuttuu, joka aamu kiinteään aikaan tai napin painalluksesta, basedb suorittaa vaiheet peräkkäin – ja jokainen suoritus voidaan lukea jälkikäteen, vaihe vaiheelta.',
			clock: '03.12',
			when: 'Kun',
			trigger: 'tarjous siirtyy tilaan ”Allekirjoitettu”',
			steps: {
				find: {
					kind: 'Etsi rivi',
					text: 'Tarjouksen asiakas',
				},
				ai: {
					kind: 'Kysy tekoälyltä',
					text: 'Kirjoita kiitosviesti',
				},
				create: {
					kind: 'Luo rivi',
					text: 'Lasku, taulukossa Laskut',
				},
				notify: {
					kind: 'Ilmoita jollekulle',
					text: 'Kirjanpito',
				},
				slack: {
					kind: 'Lähetä Slackiin',
					text: 'Kanavaan #myynti',
				},
			},
			answer: 'Kiitos luottamuksestanne! Aloitamme projektinne maanantaina, ja laskunne saapuu sähköpostitse.',
			done: 'Onnistui · 5 vaihetta · 1,2 s',
			copilot: {
				prompt: 'Kun tarjous allekirjoitetaan, ilmoita kirjanpitoon ja luo lasku.',
				text: 'Yksi lause Copilotille, ja automaatio on valmis: vain tarkistaminen jää tehtäväksi.',
			},
			link: {
				href: '/fonctionnalites/automatisations/',
				label: 'Automaatiot',
			},
		},
		glance: {
			eyebrow: 'Koontinäytöt',
			title: 'Näe kaikki.',
			titleAccent: 'Yhdellä silmäyksellä.',
			text: 'Lukuja, käyriä, tavoitteita: koontinäyttösi rakennetaan hiirellä taulukoistasi, ja ne pysyvät ajan tasalla itsestään. Yksi suodatin, ja koko näyttö seuraa mukana.',
			demo: {
				title: 'Myynnin seuranta',
				filters: ['Tämä vuosi', 'Kaikki kaupungit'],
				revenue: 'Liikevaihto',
				signed: 'Allekirjoitetut tarjoukset',
				rate: 'Allekirjoitusaste',
				goal: 'Vuositavoite',
				byMonth: 'Liikevaihto kuukausittain',
				byStage: 'Tarjoukset vaiheittain',
				stages: ['Lähetetyt', 'Neuvoteltavana', 'Allekirjoitetut'],
				bySector: 'Asiakkaat toimialoittain',
				sectors: ['Kauppa', 'Terveydenhuolto', 'Koulutus', 'Teollisuus'],
				shared: 'Jaettu linkillä',
			},
			points: {
				viz: {
					title: 'Viisitoista visualisointia',
					text: 'Luvut, trendit, tavoitteet, käyrät, toimialat, suppilot, ristiintaulukot, kartat.',
				},
				filters: {
					title: 'Yhteiset suodattimet',
					text: 'Ajanjakso, asiakas, kaupunki: yksi suodatin ohjaa yhtä korttia, useita, tai koko näyttöä.',
				},
				share: {
					title: 'Jaettu linkillä',
					text: 'Julkinen tai vain tiimille, ja upotettavissa toiselle sivustolle.',
				},
			},
			link: {
				href: '/fonctionnalites/tableaux-de-bord/',
				label: 'Koontinäytöt',
			},
		},
		ai: {
			eyebrow: 'Tekoäly',
			title: 'Kuvaile.',
			titleAccent: 'basedb rakentaa.',
			text: 'Yksi lause riittää täydelliseen tietokantaan, jonka voit tarkistaa ennen luomista. Sen jälkeen Copilot ehdottaa suodattimia, kaavioita ja automaatioita, ja tekoälykentät tiivistävät, luokittelevat ja kirjoittavat puolestasi.',
			prompt: 'Hakemusten seuranta kolmelle avoimelle työpaikallemme, haastattelut mukaan lukien.',
			thinking: 'Kolme toisiinsa liittyvää taulukkoa, valmiina tarkistettavaksi.',
			tables: {
				jobs: {
					name: 'Työpaikat',
					fields: ['Nimike', 'Osasto', 'Avattu'],
				},
				people: {
					name: 'Hakijat',
					fields: ['Nimi', 'Työpaikka', 'Vaihe', 'Yhteenveto'],
				},
				talks: {
					name: 'Haastattelut',
					fields: ['Hakija', 'Päivämäärä', 'Haastattelija', 'Arvio'],
				},
			},
			aiField: 'Yhteenveto',
			aiValue: 'Kuusi vuotta projektinhallintaa, sujuva asiakastyössä; selvitettävä: englannin taito.',
			create: 'Luo tietokanta',
			providers: 'Valitsemallasi palveluntarjoajalla – OpenAI, Anthropic, Mistral, tai omalla palvelimella ajettavalla mallilla. Mitään ei lähetetä ilman suostumustasi.',
			link: {
				href: '/fonctionnalites/ia/',
				label: 'Tekoäly basedb:ssä',
			},
		},
		features: {
			title: 'Kaikki tarpeellinen.',
			titleAccent: 'Ja paljon muuta.',
			text: 'Jokainen toiminto kirjoittaa samoihin taulukkoihin, samoilla käyttöoikeuksilla, samaan historiaan.',
			tiles: {
				views: {
					stat: '8',
					title: 'tapaa nähdä tietosi',
					text: 'Ruudukko, kanban, kalenteri, aikajana, galleria, luettelo, lomake ja kyselylomake, samoilla riveillä. Kukin valitsee omansa.',
					href: '/fonctionnalites/vues/',
				},
				history: {
					stat: 'Ctrl+Z',
					title: 'Mikään ei katoa',
					text: 'Jokainen muutos tallennetaan aiemman arvon kanssa; virheen voi kumota, poistetun rivin palauttaa.',
					href: '/fonctionnalites/historique/',
				},
				forms: {
					title: 'Lomakkeet',
					text: 'Julkinen tai vain tiimille tarkoitettu linkki: jokainen vastaus tulee taulukkoon paljastamatta muuta.',
					href: '/fonctionnalites/formulaires-partages/',
				},
				viz: {
					stat: '15',
					title: 'visualisointia',
					text: 'Luvut, trendit, tavoitteet, käyrät, toimialat, suppilot, ristiintaulukot ja kartat.',
					href: '/fonctionnalites/tableaux-de-bord/',
				},
				formulas: {
					code: 'SI([Montant] > 10000; "Grand compte"; "")',
					title: 'Kaavat ranskaksi',
					text: 'Kuten taulukkolaskennassa – SI, ARRONDI, JOURS… – mutta laskettuna koko tiimille.',
					href: '/fonctionnalites/tables-et-champs/#formules',
				},
				rights: {
					title: 'Kukin näkee sen, minkä pitää',
					text: 'Lukuoikeus, muokkausoikeus, hallintaoikeus, tiimeittäin; arkaluonteisen sarakkeen voi piilottaa.',
					href: '/fonctionnalites/droits/',
				},
				mentions: {
					bubble: '@Camille',
					title: 'Kommentit ja maininnat',
					text: 'Keskustele rivistä sen omalla paikalla, ja kello ilmoittaa siitä.',
					href: '/fonctionnalites/collaboration/',
				},
				relations: {
					title: 'Kaikki on yhteydessä',
					text: 'Asiakkaat, projektit, laskut: summat ja haut kulkevat suhteiden läpi.',
					href: '/fonctionnalites/tables-et-champs/',
				},
				templates: {
					stat: '10',
					title: 'valmista mallia',
					text: 'CRM, rekrytointi, varasto, tapahtumat… tai tekoälylle yhdellä lauseella kuvattu tietokanta.',
					href: '/modeles/',
				},
				import: {
					title: 'Tuonti yhdellä liikkeellä',
					text: 'Vedä CSV-tiedosto sisään: sarakkeet ja tyypit arvataan, taulukko luodaan.',
					href: '/guides/premiers-pas/',
				},
				agenda: {
					title: 'Suoraan kalenteriisi',
					text: 'Kalenterinäkymästä syntyy syöte Google-kalenteriin, Outlookiin tai Apple Calendariin.',
					href: '/fonctionnalites/vues-partagees/',
				},
				files: {
					title: 'Tiedostot ja kuvat',
					text: 'Tarjoukset, valokuvat, sopimukset; kuvasta tulee kortin kansikuva.',
					href: '/fonctionnalites/fichiers/',
				},
				share: {
					title: 'Jaetut näkymät',
					text: 'Vain luku -näkymä linkin takana, upotettavissa omalle sivustollesi.',
					href: '/fonctionnalites/vues-partagees/',
				},
				sync: {
					title: 'Synkronoidut taulukot',
					text: 'Pysyvät ajan tasalla verkko-CSV:stä, kalenterista tai toisesta basedb:stä.',
					href: '/integrations/synchronisation/',
				},
				signin: {
					title: 'Yksinkertainen kirjautuminen',
					text: 'Google, Microsoft tai salasana; kollegat kutsutaan linkillä.',
					href: '/hebergement/connexion/',
				},
				languages: {
					title: 'Omalla kielelläsi',
					text: 'Käyttöliittymä mukautuu kunkin kieleen, kahdestakymmenestä.',
					href: '/fonctionnalites/droits/#asetuksesi',
				},
			},
		},
		yours: {
			eyebrow: 'Vapaa ja itse ylläpidetty',
			per: 'per henkilö. Ikuisesti.',
			text: 'basedb on vapaa ohjelmisto. Asenna se omalle palvelimellesi ja kutsu koko tiimi mukaan: ei tilausmaksua, ei laskettavia lisenssejä, ja tietosi pysyvät sinulla.',
			points: {
				home: {
					title: 'Omalla palvelimellasi',
					text: 'Omalla palvelimellasi tai hosting-palveluntarjoajasi palvelimella, varmuuskopioituna kuten mikä tahansa PostgreSQL-tietokanta.',
				},
				free: {
					title: 'Vapaa',
					text: 'AGPL-3.0-lisenssillä: koodi on avoin, ja pysyy sellaisena.',
				},
				ai: {
					title: 'Valitsemasi tekoäly',
					text: 'Markkinoilla oleva palveluntarjoaja, omalla palvelimella ajettava malli – tai ei tekoälyä lainkaan.',
				},
			},
			link: {
				href: '/guides/installation/',
				label: 'Asenna basedb',
			},
		},
		gallery: {
			eyebrow: 'Mallit',
			title: 'Valmiina minuutissa.',
			text: 'Aloita mallista, jossa on valmiit taulukot, näkymät, koontinäyttö ja esimerkkirivit, ja muokkaa sitä omaan tapaasi työskennellä.',
			use: 'Tutustu',
			ask: {
				title: 'Ei sopivaa mallia?',
				text: 'Kuvaile tarpeesi yhdellä lauseella: tekoäly ehdottaa sinulle räätälöidyn tietokannan.',
			},
			all: 'Katso kaikki mallit',
			previous: 'Edelliset mallit',
			next: 'Seuraavat mallit',
		},
		developers: {
			title: 'Entä tekninen puoli?',
			text: 'Jokainen taulukko on oikea PostgreSQL-taulukko. REST API, webhookit, MCP-palvelin tekoälyagenteille, ja asennus yhdellä komennolla.',
			link: 'Kehittäjien sivu',
		},
		faq: {
			title: 'Kysymyksiäsi',
			items: [
				{
					q: 'Täytyykö osata koodata?',
					a: 'Ei. Taulukot, näkymät, lomakkeet, koontinäytöt ja automaatiot luodaan hiirellä. Kaavat kirjoitetaan ranskaksi, kuten taulukkolaskennassa: SI, ARRONDI, JOURS…',
				},
				{
					q: 'Mitä se maksaa?',
					a: 'Ei mitään: basedb on vapaa ohjelmisto, ilman tilausmaksua tai per henkilö -hintaa. Tarvitaan vain palvelin, johon se asennetaan.',
				},
				{
					q: 'Miten se asennetaan?',
					a: 'Palvelimelle, Dockerilla: kaksi tiedostoa ja yksi komento, muutama minuutti IT-vastuuhenkilöllenne. Asennusopas selittää kaiken vaihe vaiheelta.',
				},
				{
					q: 'Voiko vanhat taulukkolaskentatiedostot tuoda mukaan?',
					a: 'Kyllä: tallenna taulukko CSV-muotoon ja vedä se basedb:hen. Tuonti arvaa kunkin sarakkeen tyypin, luo taulukon ja kertoo rivi riviltä, mitä se ei pystynyt tuomaan.',
				},
				{
					q: 'Voiko useampi työskennellä yhtä aikaa?',
					a: 'Juuri siihen se on tehty. Muiden muutokset näkyvät suoraan, riviä voi kommentoida, kollegan mainita @-merkillä, ja kello ilmoittaa siitä.',
				},
				{
					q: 'Lukeeko tekoäly tietojamme?',
					a: 'Vain jos niin päätät. Jos tekoälypalveluntarjoajaa ei ole määritetty, mitään ei lähetetä. Sen jälkeen tekoälyä käyttävä kenttä tai automaatio lähettää vain sen, mihin sen kehote viittaa, suostumuksesi jälkeen.',
				},
				{
					q: 'Millä kielellä?',
					a: 'Omallasi: käyttöliittymä käyttää selaimesi kieltä, kahdestakymmenestä, ja kukin voi vaihtaa sen omista asetuksistaan.',
				},
			],
		},
		cta: {
			title: 'Tiimisi ansaitsee parempaa',
			titleAccent: 'kuin jaetun tiedoston.',
			text: 'Aloita mallista, kutsu kollegasi mukaan, ja jätä ”LOPULLINEN (2)” -tiedostot taakse.',
			primary: 'Tutustu malleihin',
			secondary: 'Asenna basedb',
		},
	},
	hero: {
		badge: 'Uutta: työnkulkuautomaatiot, koontinäytöt ja SQL-näkymät',
		title: ['Yhteiskäyttöinen tietokanta,', 'jonka jokainen taulukko', 'on oikea'],
		titleAccent: 'PostgreSQL-taulukko.',
		lead: 'Jaetun taulukkolaskennan helppous – ruudukot, näkymät, lomakkeet, käyttöoikeudet – ja tiedot, jotka ovat <strong>tyypitetyissä ja selkeästi nimetyissä</strong> taulukoissa. Tiimisi työskentelee käyttöliittymässä; skriptisi, BI-työkalusi, tekoälyagenttisi ja <code>psql</code> lukevat samoja rivejä.',
		install: 'Asenna Dockerilla',
		features: 'Katso ominaisuudet',
		copy: 'Kopioi komento',
		facts: ['Itse ylläpidetty', 'AGPL-3.0', 'REST API ja MCP-palvelin'],
		demo: {
			url: 'basedb.yrityksesi.fi',
			project: 'Pääprojekti',
			projectMeta: 'Projekti · 2 tietokantaa',
			filter: 'Suodata tietokantoja ja taulukoita',
			sales: 'Myynti',
			support: 'Tuki',
			environment: 'Tuotanto',
			clients: 'Asiakkaat',
			opportunities: 'Mahdollisuudet',
			quotes: 'Tarjoukset',
			baseSection: 'Tietokanta · Myynti',
			screens: ['Koontinäytöt', 'Automaatiot'],
			copilot: '✦ Copilot',
			allRows: '▦ Kaikki rivit ▾',
			tools: ['Suodata', 'Ryhmittele', 'Värit'],
			search: 'Hae…',
			add: '+ Lisää',
			columns: {
				name: 'Nimi',
				status: 'Tila',
				amount: 'Summa',
				client: 'Asiakas',
			},
			statuses: {
				nouveau: 'Uusi',
				qualifie: 'Kvalifioitu',
				proposition: 'Tarjous',
				negociation: 'Neuvottelu',
				gagne: 'Voitettu',
				perdu: 'Hävitty',
			},
			deals: {
				portail: {
					name: 'Portaalin uudistus',
					client: 'Koivulan kaupunki',
				},
				erp: {
					name: 'ERP-migraatio',
					client: 'Laaksonen-konserni',
				},
				audit: {
					name: 'Tietoturva-auditointi',
					client: 'Lääkäriasema Kielo',
				},
				billetterie: {
					name: 'Verkkolipunmyynti',
					client: 'Kehäteatteri',
				},
				flotte: {
					name: 'Kaluston seuranta',
					client: 'Kuljetus Kerola',
				},
				mobile: {
					name: 'Mobiilisovellus',
					client: 'Studio Mäkelä',
				},
				intranet: {
					name: 'Intranetin uudistus',
					client: '',
				},
			},
			toastTitle: 'Lomake ”Tarjouspyyntö”',
			toastText: 'julkinen vastaus · loi rivin ”{name}”',
			cursor: 'Camille',
			psqlRows: '(2 riviä)',
		},
	},
	showcase: {
		label: 'Käyttöliittymä sellaisenaan',
		title: 'Kaikki, mitä tiimisi odottaa jaetulta taulukkolaskennalta.',
		tabs: 'Kuvakaappauksia käyttöliittymästä',
		alt: 'basedb – {labelLower}: {caption}',
		shots: {
			grille: {
				label: 'Ruudukko',
				caption: 'Ruudukko, joka kirjoittaa oikeaan taulukkoon – ja lasketut kentät: kesto kaavalla, asiakkaan kaupunki haulla, tehtävien lukumäärä Määrä-kentällä.',
			},
			kanban: {
				label: 'Kanban',
				caption: 'Samat rivit sarakkeina Yksi valinta -kentän mukaan: kansikuva ja kuvaus, joka viittaa rivin arvoihin. Kortin vetäminen muokkaa riviä.',
			},
			galerie: {
				label: 'Galleria',
				caption: 'Kortteja kuvineen, väri tilan mukaan: galleria on yksi kahdeksasta tavasta lukea taulukkoa.',
			},
			chronologie: {
				label: 'Aikajana',
				caption: 'Palkit kahden päivämäärän välillä ja nuolet niiden riippuvuuksille – punaisina, kun järjestys ei enää pidä.',
			},
			tableaux: {
				label: 'Koontinäytöt',
				caption: 'Kortteja ruudukossa, välilehdillä, yhteisten suodattimien alla: trendi, tavoite, pinottuja sarjoja – kukin lukee ne omilla käyttöoikeuksillaan.',
			},
			automatisations: {
				label: 'Automaatiot',
				caption: 'Kun tehtävä on valmis, etsitään projektin jäljellä olevat tehtävät; jos mitään ei ole jäljellä, tekoäly kirjoittaa yhteenvedon ja projekti siirtyy tilaan ”Toimitettu”. Jokainen suoritus näkyy työnkulussa vaihe vaiheelta.',
			},
			commentaires: {
				label: 'Kommentit',
				caption: 'Rivistä keskustellaan siellä, missä se on: kommentit, maininnat, ilmoitukset.',
			},
			formulaire: {
				label: 'Lomake',
				caption: 'Lomake jaetaan linkillä, julkisena tai vain kirjautuneille jäsenille.',
			},
			historique: {
				label: 'Historia',
				caption: 'Jokainen kirjoitus, tuli se mistä tahansa – henkilöltä, automaatiolta, suorasta SQL:stä – aiempine arvoineen.',
			},
			sql: {
				label: 'SQL',
				caption: 'Kysely oikeilla nimillä, tallennettuna taulukoiden alle koko tiimille – ja jokainen suorittaa sen omilla käyttöoikeuksillaan.',
			},
			vuesSql: {
				label: 'SQL-näkymät',
				caption: 'Oikeita PostgreSQL-näkymiä taulukoiden joukossa omine väreineen ja kuvakkeineen – ja luettavissa psql:stä.',
			},
		},
	},
	features: {
		postgres: {
			label: 'PostgreSQL sellaisenaan',
			title: 'Ruudukko tiimille, oikea taulukko {työkaluillesi.}',
			lead: 'Ei geneeristä mallia, ei kaiken nielevää JSONia, ei <code>field_1837</code>:ää: tietokanta on skeema, taulukko on taulukko, kenttä on tyypitetty, selkeästi nimetty sarake.',
			bullets: [
				'<strong>Natiivit tyypit</strong>: <code>text</code>, <code>numeric</code>, <code>date</code>, <code>timestamptz</code>, <code>boolean</code> – ja viittauksille oikeat vierasavaimet.',
				'<strong>Tietokannan valvomat rajoitteet</strong>: Yksi valinta -kentät <code>CHECK</code>-rajoitteina, tarkistetut verkko- ja sähköpostiosoitteet, viittaukset <code>FOREIGN KEY</code> -avaimina.',
				'<strong>PostgreSQL:n laskemat kaavat</strong>: <code>JOURS([Fin]; [Début])</code> muuttuu generoiduksi sarakkeeksi, jonka <code>psql</code> lukee kuten muutkin.',
				'<strong>Suora SQL on edelleen sallittu</strong> – ja sekin tallentuu historiaan liipaisimen avulla.',
				'<strong>SQL-kyselyt ja -näkymät</strong> käyttöliittymässä: taulukoiden alle tallennettuja kyselyjä itsellesi tai tiimille ja oikeita PostgreSQL-näkymiä taulukoiden joukossa – myös <code>psql</code> lukee niitä.',
				'<strong>Uudelleennimeäminen ei riko mitään</strong>: vanha nimi pysyy käytössä yhteensopivuusaliaksen kautta, kunnes kyselysi on päivitetty.',
			],
			links: [
				{
					href: '/integrations/sql/',
					label: 'Suora SQL',
				},
				{
					href: '/fonctionnalites/requetes-et-vues-sql/',
					label: 'Kyselyt ja SQL-näkymät',
				},
				{
					href: '/architecture/principes/',
					label: 'Periaatteet',
				},
			],
		},
		automations: {
			label: 'Automatisoi',
			title: 'Automaatiot työnkulkuina, {tekoäly joka vaiheessa.}',
			lead: 'Kun rivi muuttuu, tiettyyn aikaan tai napsautuksella: graafieditori ketjuttaa vaiheet, ja jokaisen suorituksen voi käydä läpi työnkulussa.',
			bullets: [
				'<strong>Selkeä työnkulku</strong>: käynnistin ja sitten jokainen vaihe korttina; viivan <strong>+</strong> lisää vaiheen juuri siihen kohtaan.',
				'<strong>Etsi, päätä, kirjoita</strong>: etsi rivi, valitse haara ehtojen mukaan, muokkaa, luo, ilmoita, kutsu webhookia, lähetä Slackiin.',
				'<strong>Kysy tekoälyltä</strong> vaiheessa: kehote, joka viittaa riviin, ja vastaus, joka luetaan tekstinä, lukuna, päivämääränä tai valintana ja jota seuraavat vaiheet käyttävät.',
				'<strong>Copilot</strong> ehdottaa kokonaista automaatiota yhdestä lauseesta tai selittää, miksi suoritus epäonnistui – mitään ei tallenneta ilman sinua.',
				'<strong>Sen kirjoittajan käyttöoikeuksilla</strong>, ja historiassa kuten mikä tahansa muu kirjoitus.',
			],
			links: [
				{
					href: '/fonctionnalites/automatisations/',
					label: 'Automaatiot',
				},
				{
					href: '/fonctionnalites/automatisations/#copilot',
					label: 'Copilot',
				},
			],
			alt: 'basedb – automaatio ”Projekti toimitettu” työnkulkueditorissa: kun tehtävä on valmis, kirjaa kellonaika, etsi projektin jäljellä olevat tehtävät, valitse haara ”Muuten”, kysy tekoälyltä yhteenveto ja toimita projekti; oikealla sen viimeisimmät suoritukset vaihe vaiheelta.',
		},
		dashboards: {
			label: 'Analysoi',
			title: 'Koontinäytöt {taulukoista poistumatta.}',
			lead: 'Hiirellä tai SQL:llä esitettyjä kysymyksiä, viisitoista visualisointia, yhteiset suodattimet – kukin lukee ne omilla käyttöoikeuksillaan.',
			bullets: [
				'<strong>Kysymykset</strong>: taulukko, sen liitokset, suodattimet ja mittarit päivittäin, viikoittain, kuukausittain tai vuosittain – tai SQL:ää vain luku -tilassa.',
				'<strong>Viisitoista visualisointia</strong>: luku, trendi, edistyminen, mittari, palkit, viivat, piirakka, suppilo, ristiintaulukko, kartta…',
				'<strong>Tutki yhdellä napsautuksella</strong>: piste avaa rivinsä tai tarkemman ajanjakson.',
				'<strong>Yhteiset suodattimet</strong>, jotka ohjaavat yhtä, useampaa tai kaikkia kortteja.',
				'<strong>Jaa linkillä</strong>, julkisesti tai vain jäsenille, ja upota toiselle sivustolle.',
			],
			links: [
				{
					href: '/fonctionnalites/tableaux-de-bord/',
					label: 'Koontinäytöt',
				},
			],
			alt: 'basedb – koontinäyttö: kuukauden trendi, maksukertymän tavoite, liikevaihto kuukausittain, arvioiden sävy, ajanjakso- ja asiakassuodattimien alla.',
		},
		rights: {
			label: 'Yhteistyötä avaamatta kaikkea',
			title: 'Käyttöoikeudet kenttätasolle asti, {aukoton historia.}',
			lead: 'Käyttöoikeudet annetaan ryhmille projektiin, tietokantaan tai taulukkoon, ja ne periytyvät kaikkeen sen alla olevaan. Arkaluonteisen sarakkeen voi piilottaa ryhmältä tai tehdä siitä ryhmälle ei-muokattavan.',
			bullets: [
				'<strong>Neljä tasoa</strong>: Ei käyttöoikeutta, Lukuoikeus, Muokkausoikeus, Hallintaoikeus – ryhmien oikeudet summautuvat.',
				'<strong>Myös SQL noudattaa käyttöoikeuksiasi</strong>: käyttöliittymässä kysely näkee vain sinulle avoimet taulukot ja kentät – ja sen valvoo PostgreSQL itse.',
				'<strong>Jokainen kirjoitus tallennetaan</strong> omassa transaktiossaan: käyttöliittymä, API, agentti, julkinen lomake tai suora SQL.',
				'<strong>Muutoksen voi kumota</strong>, poistetun rivin palauttaa – ja poistetun tietokannan myös.',
				'<strong>Ylläpito vaatii vahvistuksen</strong>: käyttöoikeuden muuttaminen edellyttää, että olet kirjoittanut salasanasi uudelleen viimeisten viiden minuutin aikana.',
			],
			links: [
				{
					href: '/fonctionnalites/droits/',
					label: 'Käyttöoikeudet ja ryhmät',
				},
				{
					href: '/fonctionnalites/historique/',
					label: 'Historia',
				},
			],
		},
		agents: {
			label: 'REST API · MCP · webhookit',
			title: 'Tekoälyagenttisi saavat tiedot, {eivät avaimia valtakuntaan.}',
			lead: 'MCP-palvelin antaa agenteille kaksitoista työkalua, REST API samat tiedot ohjelmillesi. Yksi käyttöoikeuksien tarkistuspiste, samat lokit.',
			bullets: [
				'<strong>Yksi tunnus tietokantaa kohden</strong>, oletuksena vain lukuoikeuksin, eikä koskaan enempää oikeuksia kuin sen luoneella henkilöllä.',
				'<strong>Agentti ei poista mitään</strong> eikä muuta rakennetta: se ehdottaa, ja ihminen hyväksyy.',
				'<strong>Automaattisesti luotu dokumentaatio</strong> jokaiselle tietokannalle, käyttöoikeuksiesi mukaan suodatettuna ja OpenAPI 3.1 -määrittelyineen.',
				'<strong>Webhookit</strong> jokaisesta kirjoituksesta: allekirjoitetut, järjestyksessä toimitetut ja tarvittaessa uudelleen yritetyt.',
			],
			links: [
				{
					href: '/integrations/mcp/',
					label: 'Liitä agentti',
				},
				{
					href: '/integrations/api-rest/',
					label: 'REST API',
				},
			],
		},
	},
	sqlVisual: {
		interface: 'Käyttöliittymä',
		title: 'Uusi kenttä · Mahdollisuudet',
		labelField: 'Nimike',
		labelValue: 'Summa',
		typeField: 'Tyyppi',
		typeValue: 'Luku',
		descriptionField: 'Kuvaus',
		descriptionValue: 'Sopimuksen summa ilman ALV:tä',
		required: 'Pakollinen',
		ai: 'Tekoäly',
		migration: 'suunniteltu migraatio, lyhyet lukot',
	},
	rightsVisual: {
		groups: ['Ylläpitäjät', 'Myyjät', 'Tuki'],
		project: 'Pääprojekti',
		sales: 'Myynti',
		opportunities: 'Mahdollisuudet',
		clients: 'Asiakkaat',
		support: 'Tuki',
		inherited: 'peritty',
		levels: {
			none: 'Ei käyttöoikeutta',
			read: 'Lukuoikeus',
			edit: 'Muokkausoikeus',
			manage: 'Hallintaoikeus',
		},
		field: 'Kenttä ”Kate”',
		hidden: 'Piilotettu',
		sqlChange: '<b>Suora SQL-istunto</b> muokkasi riviä <b>”ERP-migraatio”</b>',
		sqlMeta: '02:46 · paikallinen yhteys · psql',
		sqlDiff: 'Summa: <s>125 000</s> → 130 000',
		undo: '↶ Kumoa',
		formChange: '<b>Lomake ”Tarjouspyyntö”</b> loi rivin <b>”Intranetin uudistus”</b>',
		formMeta: 'julkinen vastaus · julkaisija Camille',
	},
	agentVisual: {
		agent: 'Agentti',
		via: 'yhdistetty MCP:n kautta · tunnus ”Myynti”',
		question: 'Montako myyntimahdollisuutta on neuvotteluvaiheessa, ja kuinka suurella summalla?',
		listArgs: 'opportunites · statut = Neuvottelu',
		answer: 'Kaksi myyntimahdollisuutta, yhteensä <b>182 000 €</b>: ERP-migraatio (130 000 €) ja Kaluston seuranta (52 000 €).',
		request: 'Lisää prosenttimuotoinen kenttä ”Todennäköisyys”.',
		proposeArgs: 'opportunites · Todennäköisyys · number',
		proposed: 'Ehdotettu: jonkun tiimistä on hyväksyttävä se basedb:ssä.',
		badge: 'Ehdotus',
		expires: 'vanhenee 23 h:n päästä',
		what: 'Lisää kenttä <b>”Todennäköisyys”</b> (Luku) taulukkoon <b>Mahdollisuudet</b>',
		by: 'Agentin ehdotus · tunnus ”Myynti”',
		refuse: 'Hylkää',
		approve: 'Hyväksy',
	},
	bento: {
		label: 'Ja kaikki muu',
		title: 'Mitä tiimityökalulta odotetaan – PostgreSQL:stä luopumatta.',
		text: 'Jokainen toiminto kirjoittaa samoihin taulukoihin, samoilla käyttöoikeuksilla, samaan historiaan.',
		more: 'Lue lisää →',
		views: {
			title: 'Kahdeksan näkymää samoihin riveihin',
			text: 'Yhteisiä koko tiimille tai henkilökohtaisia vain itselle: kukin valitsee oman tapansa lukea, eikä kukaan kopioi tietoja.',
			chips: ['Ruudukko', 'Kanban', 'Kalenteri', 'Aikajana', 'Galleria', 'Luettelo', 'Lomake', 'Kyselylomake'],
		},
		forms: {
			title: 'Jaetut lomakkeet',
			text: 'Julkinen linkki tai vain kirjautuneille jäsenille. Vastaaminen ei anna mitään oikeuksia taulukkoon.',
			href: '/fonctionnalites/formulaires-partages/',
		},
		environments: {
			title: 'Ympäristöt',
			text: 'Yksi tietokanta, useita versioita. Vertaa rakennetta, siirrä muutokset versiosta toiseen, synkronoi rivejä.',
			chips: ['Tuotanto', 'Testi', 'Kehitys'],
			href: '/fonctionnalites/environnements/',
		},
		collaboration: {
			title: 'Yhdessä työskentely',
			text: 'Muiden kirjoitukset saapuvat reaaliajassa, näet, kuka katsoo mitäkin riviä, ja rivistä keskustellaan siellä, missä se on: kommentit, maininnat, ilmoitukset. Ctrl+Z kumoaa viimeisimmän kirjoituksen – ja kieltäytyy mieluummin kuin korvaa jonkun toisen työn.',
			chips: ['Reaaliaika', 'Läsnäolo', 'Kommentit', 'Maininnat', 'Ctrl+Z'],
			href: '/fonctionnalites/collaboration/',
		},
		small: {
			ai: {
				title: 'Tekoäly ruudukossa',
				text: 'Kenttä, jonka malli täyttää muiden sarakkeiden perusteella, ja Copilot, joka ehdottaa suodattimia, kyselyjä ja sarakkeita yhdellä napsautuksella käyttöön otettaviksi. OpenAI, Anthropic, Mistral tai omalla koneellasi ajettava malli.',
				code: 'Tiivistä {{Notes}} yhteen lauseeseen',
				href: '/fonctionnalites/ia/',
			},
			formulas: {
				title: 'Viittaukset ja kaavat',
				text: 'Oikeat vierasavaimet, ranskankieliset PostgreSQL:n laskemat kaavat sekä haut, koosteet ja määrät viittausten yli.',
				code: 'ARRONDI([Montant HT] * (1 + [Taux de TVA]); 2)',
				href: '/fonctionnalites/tables-et-champs/#kaavat',
			},
			richText: {
				title: 'Muotoiltu teksti ja muuttujat',
				text: 'Visuaalinen editori muotoillulle tekstille, joka puhdistetaan kirjoitettaessa; ja missä tahansa pitkässä tekstissä {{Ville}} luetaan rivin arvona.',
				code: 'Toimituspäivä {{Date}}, paikka {{Ville}}',
				href: '/fonctionnalites/tables-et-champs/#muotoiltu-teksti-ja-muuttujat',
			},
			languages: {
				title: 'Omalla kielelläsi',
				text: 'Käyttöliittymä käyttää selaimen kieltä, yhtä kahdestakymmenestä; kukin voi vaihtaa sen omista asetuksistaan.',
				href: '/fonctionnalites/droits/#asetuksesi',
			},
			sharedViews: {
				title: 'Jaetut näkymät',
				text: 'Vain luku -näkymä linkillä, upotettavissa toiselle sivustolle; kalenterista tulee syöte kalenterisovellukseesi.',
				href: '/fonctionnalites/vues-partagees/',
			},
			syncedTables: {
				title: 'Synkronoidut taulukot',
				text: 'Taulukko, joka pysyy ajan tasalla verkossa olevasta CSV:stä, kalenterista tai toisen basedb:n jaetusta näkymästä.',
				href: '/integrations/synchronisation/',
			},
			templates: {
				title: 'Tietokantamallit',
				text: 'Kymmenen valmista mallia, tekoälylle yhdellä lauseella kuvattu tietokanta ja oma tietokantasi tallennettuna malliksi.',
				href: '/modeles/',
			},
			files: {
				title: 'Tiedostot ja kuvat',
				text: 'Isäntäkoneen levyllä tai S3-yhteensopivassa tallennustilassa: AWS, Scaleway, OVH, Cloudflare R2, Garage, MinIO…',
				href: '/fonctionnalites/fichiers/',
			},
			import: {
				title: 'CSV- ja JSON-tuonti',
				text: 'Pudota tiedosto: tuonti päättelee tyypit, luo taulukon tai täydentää olemassa olevaa ja kertoo rivi riviltä, mitä hylättiin.',
				href: '/guides/premiers-pas/',
			},
			accounts: {
				title: 'Tilit ja kutsut',
				text: 'Jokainen luo oman tilinsä ja projektinsa ja kutsuu muita linkillä tasolle Lukuoikeus, Muokkausoikeus tai Hallintaoikeus; kirjautuminen salasanalla, Googlella, Microsoftilla tai millä tahansa OpenID Connect -palveluntarjoajalla.',
				href: '/hebergement/connexion/',
			},
			webhooks: {
				title: 'Webhookit',
				text: 'Jokaisesta kirjoituksesta voi ilmoittaa toiselle järjestelmälle: allekirjoitetut hyötykuormat, jotka toimitetaan järjestyksessä ja joita yritetään uudelleen.',
				href: '/integrations/webhooks/',
			},
			settings: {
				title: 'Henkilökohtaiset asetukset',
				text: 'Kielesi, teemasi, päivämäärien järjestys, ilmoituksesi, istuntosi ja tunnuksesi – kaikki samassa paikassa.',
				href: '/fonctionnalites/droits/#asetuksesi',
			},
		},
	},
	selfHost: {
		label: 'Itse ylläpidetty',
		title: 'Tietosi pysyvät {omilla palvelimillasi.}',
		lead: 'basedb on vapaa ohjelmisto (AGPL-3.0): yksi Docker-kuva, yksi PostgreSQL-tietokanta, eikä muuta – ei pakollisia kolmannen osapuolen palveluita, ei telemetriaa. Varmuuskopioi se <code>pg_dump</code>-komennolla ja lue sitä millä tahansa PostgreSQL-asiakasohjelmalla.',
		services: {
			db: 'PostgreSQL 16, tietosi',
			basedb: 'Käyttöliittymä, REST API ja MCP-palvelin yhdessä portissa',
			proxy: 'Caddy, automaattinen HTTPS (valinnainen)',
		},
		links: [
			{
				href: '/hebergement/docker/',
				label: 'Docker Compose -opas →',
			},
			{
				href: '/hebergement/variables/',
				label: 'Kaikki muuttujat →',
			},
		],
		steps: [
			{
				title: 'Hae basedb',
				code: 'git clone https://github.com/eodia/basedb.git\ncd basedb && cp .env.example .env',
			},
			{
				title: 'Kaksi salaisuutta .env-tiedostoon',
				code: 'POSTGRES_PASSWORD=vahva-salasana\n# openssl rand -base64 32\nBASEDB_ENCRYPTION_KEY=…',
			},
			{
				title: 'Käynnistä',
				code: 'docker compose up -d\n# sitten http://localhost:3000: luo tilisi',
			},
		],
	},
	faq: {
		label: 'Usein kysyttyä',
		title: 'Mitä meiltä usein kysytään.',
		text: 'Muu kysymys? <a href="/guides/introduction/">Dokumentaatio</a> vastaa siihen todennäköisesti.',
		items: {
			difference: {
				q: 'Miten basedb eroaa muista yhteiskäyttöisistä tietokannoista?',
				a: 'Tietojen sijainnissa. Kun muut tallentavat rivisi geneeriseen malliin (numeroidut sarakkeet, JSON-dokumentit), basedb luo jokaisesta taulukosta oikean PostgreSQL-taulukon ja jokaisesta kentästä oikean tyypitetyn sarakkeen, luettavin nimin. Tietosi ovat käyttökelpoisia myös ilman basedb:tä.',
			},
			sql: {
				q: 'Voinko kirjoittaa taulukoihin suoraan SQL:llä?',
				a: 'Kyllä. Rajoitteita (tyypit, pakollisuus, Yksi valinta -kentät, vierasavaimet) valvoo PostgreSQL itse, ja liipaisin tallentaa historiaan myös suoralla SQL:llä tehdyt kirjoitukset ja istunnon, joka ne teki. Käyttöliittymän SQL-konsoli ja psql lukevat samoja taulukoita; käyttöliittymässä kukin kirjoittaa SQL:ää omilla käyttöoikeuksillaan, tallentaa kyselynsä ja, jos hallinnoi tietokantaa, tekee niistä oikeita PostgreSQL-näkymiä.',
			},
			ai: {
				q: 'Mitä tekoälypalveluntarjoajalle lähtee?',
				a: 'Ei mitään, ennen kuin olet määrittänyt palveluntarjoajan. Sen jälkeen rakenneluonnoksia ja Copilotia varten lähtee oletuksena vain rakenne ja lauseesi; se, saako Copilot lukea tietoja, on keskustelukohtainen valinta. Tekoälyltä pyydetty tietokantamalli lähettää vain lauseesi. Tekoälykenttä lähettää sarakkeet, joihin sen kehote viittaa, nimenomaisen suostumuksen jälkeen.',
			},
			together: {
				q: 'Voiko samassa taulukossa työskennellä usea henkilö?',
				a: 'Kyllä. Muiden kirjoitukset näkyvät ilman uudelleenlatausta, ja heidän kasvonsa näkyvät taulukossa tai rivillä, jota he katsovat. Riviä kommentoidaan, joku mainitaan @-merkillä, ja kello ilmoittaa. Ja Ctrl+Z kumoaa vain omat kirjoituksesi: se kieltäytyy mieluummin kuin korvaa sen, mitä joku toinen on sen jälkeen muuttanut.',
			},
			languages: {
				q: 'Millä kielillä?',
				a: 'Kahdellakymmenellä: ranska, englanti, saksa, espanja, italia, Brasilian portugali, hollanti, puola, tšekki, ruotsi, tanska, norja, suomi, romania, unkari, turkki, ukraina, japani, yksinkertaistettu kiina ja korea. Käyttöliittymä käyttää selaimen kieltä, ja kukin voi vaihtaa sen asetuksistaan; tämä sivusto ja dokumentaatio ovat saatavilla samoilla kielillä.',
			},
			agent: {
				q: 'Miten tekoälyagentti liitetään?',
				a: 'MCP-palvelimen kautta integraatiotunnuksella, joka on rajattu yhteen tietokantaan ja oletuksena vain lukuoikeuksin. Agentti lukee, luo ja muokkaa rivejä käyttöoikeuksiensa mukaan; se ei poista mitään eikä muuta rakennetta: se ehdottaa, ja ihminen hyväksyy.',
			},
			postgres: {
				q: 'Mikä PostgreSQL-versio tarvitaan?',
				a: 'PostgreSQL 16 tai uudempi sekä laajennukset pg_trgm ja unaccent (saatavilla virallisessa kuvassa). Mukana tuleva docker-compose käynnistää PostgreSQL 16:n; voit myös osoittaa DATABASE_URL-muuttujan omaan palvelimeesi.',
			},
			production: {
				q: 'Onko se valmis tuotantokäyttöön?',
				a: 'basedb on aktiivisessa kehityksessä: ydin, API, MCP-palvelin ja käyttöliittymä toimivat, ja niitä kattaa yli tuhat testiä, mutta osa toiminnoista on vielä tulossa (katso tiekartta). Kokeile sitä ja varmuuskopioi tietokantasi kuten minkä tahansa PostgreSQL-tietokannan.',
			},
			license: {
				q: 'Millä lisenssillä?',
				a: 'AGPL-3.0-or-later. Voit käyttää, muokata ja isännöidä sitä vapaasti; jos tarjoat muokattua versiota palveluna, jaat sen lähdekoodin.',
			},
		},
	},
	cta: {
		title: 'Tietosi ansaitsevat {oikeat taulukot.}',
		text: 'Asenna basedb muutamassa minuutissa, kutsu tiimisi ja pidä jokainen rivi hallinnassasi.',
		install: 'Asenna basedb',
		github: 'Katso koodi GitHubissa',
	},
	changelog: {
		label: 'Uutuudet',
		title: 'Mitä basedb:ssä on muuttunut',
		intro: 'Jokaisen muutoksen yksityiskohdat ovat <a href="https://github.com/eodia/basedb/commits/main">tietovaraston historiassa</a>. Mitä seuraavaksi: <a href="/feuille-de-route/">tiekartta</a>.',
		entries: {
			languages: {
				date: '2026-09-27',
				title: 'Muotoiltu teksti, muuttujat, selkeämpi kanban',
				tag: 'Uutta',
				items: [
					'<strong>Muotoiltu teksti</strong>: uusi kenttätyyppi, joka muotoillaan visuaalisessa editorissa – otsikot, luettelot, lainaukset, linkit –, puhdistetaan kirjoitettaessa ja jota rajoite suojaa suoralta SQL:ltä. <a href="/fonctionnalites/tables-et-champs/#muotoiltu-teksti-ja-muuttujat">Muotoiltu teksti ja muuttujat</a>',
					'<strong>Muuttujat</strong>: pitkä teksti viittaa rivinsä sarakkeeseen – <code>{{Ville}}</code> – ja luetaan kaikkialla sen arvolla: ruudukossa, rivin tiedoissa, API:ssa, MCP-palvelimella, jaetuissa näkymissä, automaatioissa. Sarake säilyttää viittauksen, ja sen <code>psql</code> lukee.',
					'<strong>Selkeämpi kanban</strong>: väljemmät kortit, kansikuva ja kuvaus, joka viittaa rivin arvoihin – ”Toimitus {{Date}} asiakkaalle {{Client}}”. <a href="/fonctionnalites/vues/">Näkymät</a>',
					'<strong>Uudelleennimeäminen yhdellä kertaa</strong>: yksi valintaikkuna tietokannalle, taulukolle tai kentälle; nimike vaihtuu aina, ja ylläpitäjä voi nimetä uudelleen myös tietokannassa vaikutusanalyysin tukemana. <a href="/fonctionnalites/tables-et-champs/#rakenteen-muokkaaminen">Rakenteen muokkaaminen</a>',
					'<strong>Kaksikymmentä kieltä</strong>: käyttöliittymä, tämä sivusto ja dokumentaatio ranskaksi, englanniksi, saksaksi, espanjaksi, italiaksi, portugaliksi (Brasilia), hollanniksi, puolaksi, tšekiksi, ruotsiksi, tanskaksi, norjaksi, suomeksi, romaniaksi, unkariksi, turkiksi, ukrainaksi, japaniksi, yksinkertaistetuksi kiinaksi ja koreaksi. basedb käyttää selaimen kieltä; <strong>Asetukset › Ulkoasu › Kieli</strong> asettaa toisen, joka seuraa sinua laitteelta toiselle. Luvut ja päivämäärät noudattavat kieltä. <a href="/fonctionnalites/droits/#asetuksesi">Asetuksesi</a>',
				],
			},
			aiProvider: {
				date: '2026-09-27',
				title: 'Valitsemasi tekoäly, myös omalla koneellasi',
				tag: 'Uutta',
				items: [
					'<strong>Neljäs tekoälypalveluntarjoaja</strong>: mikä tahansa OpenAI:n API:a puhuva palvelin – Azure, yrityksen oma yhdyskäytävä, omalla koneellasi ajettava malli –, määriteltynä <code>.env</code>-tiedostossa. Kutsujen loki kertoo, kenelle tiedot ovat menneet. <a href="/fonctionnalites/ia/">Tekoäly basedb:ssä</a>',
					'<strong>Kirjautumisnäkymä</strong> näyttää ruudukon ja SQL:n jälkeen koontinäytön, joka noudattaa suodatinta, ja automaation, joka suoritetaan tekoälyvaiheineen.',
				],
			},
			flows: {
				date: '2026-09-27',
				title: 'Automaatiot työnkulkuina',
				tag: 'Uutta',
				items: [
					'<strong>Graafieditori</strong>: käynnistin ja sitten jokainen vaihe korttina; viivan <strong>+</strong> lisää vaiheen juuri siihen kohtaan. Yksinkertainen automaatio mahtuu edelleen kahteen korttiin. <a href="/fonctionnalites/automatisations/">Automaatiot</a>',
					'<strong>Etsi rivi</strong> – tilauksen asiakas, viimeisin maksamaton lasku – ja muokkaa sitä, viittaa siihen tai linkitä se luotuun riviin.',
					'<strong>Usean haaran ehdot</strong>: valitaan ensimmäinen haara, jonka ehto täyttyy, ja ”Muuten”, kun mikään ei täyty; haarat yhdistyvät sen jälkeen.',
					'<strong>Tiedot kulkevat vaiheesta toiseen</strong>: <code>{{e2.client}}</code> viittaa siihen, minkä vaihe löysi tai loi, <code>{{e3.reponse.numero}}</code> siihen, mitä webhook vastasi; kunkin tekstin valikko tarjoaa vain sen, mikä on varmasti tapahtunut aiemmin.',
					'<strong>Jokainen suoritus vaihe vaiheelta</strong>: työnkulun päälle asetettuna se piirtää valitun haaran ja kertoo jokaisesta vaiheesta, mitä se teki ja kuinka kauan siihen meni.',
					'<strong>Automaatioiden Copilot</strong>: kuvaile, mitä tietokannan pitäisi tehdä itsestään, tai kysy, miksi suoritus epäonnistui; se ehdottaa kokonaista automaatiota, jonka asetat työnkulkuun yhdellä napsautuksella, käyt läpi ja tallennat – mitään ei tallenneta ilman sinua. <a href="/fonctionnalites/automatisations/#copilot">Copilot</a>',
					'<strong>Kysy tekoälyltä</strong> vaiheessa, kuten tekoälykentässä: kehote, joka viittaa riviin ja aiempiin vaiheisiin, ja vastaus, joka luetaan tekstinä, lukuna, kyllä- tai ei-vastauksena, päivämääränä tai luettelon valintana ja jonka seuraavat vaiheet kirjoittavat tai lähettävät. <a href="/fonctionnalites/automatisations/#kysy-tekoälyltä">Kysy tekoälyltä</a>',
				],
			},
			dashboards: {
				date: '2026-09-27',
				title: 'Koontinäytöt: kysymykset, kaaviot, suodattimet',
				tag: 'Uutta',
				items: [
					'<strong>Kysymykset</strong> hiirellä rakennettuina – taulukko, sen liitokset, suodattimet, mittarit päivittäin, viikoittain, kuukausittain tai vuosittain – tai kirjoitettuina <strong>SQL</strong>:llä, vain luku -tilassa ja omilla käyttöoikeuksillasi, muuttujat mukaan lukien. <a href="/fonctionnalites/tableaux-de-bord/">Koontinäytöt</a>',
					'<strong>Viisitoista visualisointia</strong>: luku, trendi edelliseen ajanjaksoon verrattuna, edistyminen kohti tavoitetta, mittari, pylväät, palkit, viiva, alueet, yhdistelmä, piirakka, suppilo, hajontakaavio, taulukko, ristiintaulukko, Ranskan tai maailman kartta.',
					'<strong>Tutki yhdellä napsautuksella</strong>: piste avaa rivinsä, tarkemman ajanjakson tai toisen jaottelun.',
					'<strong>Koontinäytöt ruudukkona</strong>: hiirellä siirrettävät ja muutettavan kokoiset kortit, välilehdet, osioiden otsikot, tekstit, upotetut sivut.',
					'<strong>Yhteiset suodattimet</strong> – ajanjakso, luokka, teksti, luku, päivämäärien ryhmittely – jotka ohjaavat yhtä, useampaa tai kaikkia kortteja oletusarvoineen.',
					'<strong>Kaaviot mieleisiksesi</strong>: kunkin sarjan tai osuuden väri ja nimi, rengas, puoliympyrä tai ruusu, pinoaminen summineen, pehmennetyt tai porrastetut viivat, akselit, asteikkomerkit, logaritminen asteikko; taulukot uudelleennimetyin sarakkein, palkein ja arvon mukaisin värein.',
					'<strong>Koontinäyttöjen Copilot</strong>: keskustelu, joka ehdottaa kysymyksiä, koontinäytön muutoksia – kumottavissa – ja arvoja sen suodattimille, yhdellä napsautuksella käyttöön otettaviksi. Palveluntarjoajalle lähtee vain rakenne, ellet salli sen lukea tuloksia. <a href="/fonctionnalites/tableaux-de-bord/#copilot">Copilot</a>',
					'<strong>Koontinäytön jakaminen</strong> linkillä, julkisesti tai vain jäsenille – tarvittaessa tietyille ryhmille – ja upottaminen toiselle sivustolle: kortit ja suodattimet vain luku -muodossa, luettuina julkaisijan käyttöoikeuksilla. <a href="/fonctionnalites/tableaux-de-bord/#koontinäytön-jakaminen">Jakaminen</a>',
					'”Interfaces” on nyt nimeltään <strong>Koontinäytöt</strong>; olemassa olevat avautuvat ennallaan uudessa ruudukossa.',
				],
			},
			sqlViews: {
				date: '2026-09-27',
				title: 'Tallennetut kyselyt ja SQL-näkymät',
				tag: 'Uutta',
				items: [
					'<strong>SQL:ää kaikille</strong>: ilman Hallintaoikeus-tasoa SQL-välilehti suoritetaan vain luku -tilassa omilla käyttöoikeuksillasi, joita soveltaa PostgreSQL itse – suljettua taulukkoa ei ole olemassa, piilotettu kenttä hylätään. ”Omat oikeutesi” -merkki muistuttaa siitä. <a href="/fonctionnalites/requetes-et-vues-sql/">Kyselyt ja SQL-näkymät</a>',
					'<strong>Tallennetut kyselyt</strong> taulukoiden alla ”Kyselyt”-osiossa: henkilökohtaiset, koko tietokannalle tai ryhmille. Kyselyn jakaminen jakaa sen tekstin, ei koskaan sitä, mitä sen tekijä saa lukea; sivupalkista avattuna se suoritetaan heti vain luku -tilassa.',
					'<strong>SQL-näkymät</strong>: oikeita PostgreSQL-näkymiä taulukoiden joukossa värin, kuvakkeen ja pienen silmän kera, luettavissa myös <code>psql</code>:stä ja työkaluistasi. Kukin lukee niitä omilla käyttöoikeuksillaan, ja sivupalkki näyttää ne vain niille, jotka voivat lukea ne kokonaan.',
					'Näkymät seuraavat rakennetta: uudelleennimeäminen ei riko niitä, muutettu kaava poistaa ne hetkeksi ja palauttaa ne sitten; näkymä, joka ei enää toimi, jää korjattavaksi, määritelmä tallessa.',
				],
			},
			settings: {
				date: '2026-09-27',
				title: 'Asetuksesi',
				tag: 'Uutta',
				items: [
					'<strong>Asetukset</strong> profiilivalikossa: nimesi, osoitteesi ja tiliisi linkitetyt tunnistautumispalvelut; salasanasi ja avoimet istuntosi. <a href="/fonctionnalites/droits/">Tilit ja kirjautuminen</a>',
					'<strong>Ulkoasu</strong>: teema, päivämäärien järjestys – <code>25/09/2026</code> tai <code>2026-09-25</code> – ja kalentereiden viikon ensimmäinen päivä; kaksi viimeistä seuraavat sinua laitteelta toiselle.',
					'<strong>Ilmoitukset</strong>: kieltäydy niistä, joita et enää halua, tyyppi kerrallaan. <strong>Tunnukset</strong>: luomasi tunnukset kaikissa tietokannoissasi, niiden viimeisin käyttö ja niiden mitätöinti.',
				],
			},
			v020: {
				date: '2026-09-26',
				title: 'Versio 0.2.0: jokaiselle oma tili, projektit ja kutsut',
				tag: 'Uutta',
				items: [
					'<strong>Ensimmäinen kirjautuminen</strong>: uudessa instanssissa ensimmäinen sivu luo ylläpitäjän tilin osoitteellasi ja salasanallasi – ei enää oletustiliä eikä salasanaa, jota pitäisi etsiä lokeista. <a href="/guides/installation/">Asennus</a>',
					'<strong>Tilien luominen</strong>: jokainen luo oman tilinsä ja sitten omat projektinsa, joiden hallinnoija hänestä tulee. Ylläpito voi sulkea tilien luomisen tai rajata sen tiettyihin verkkotunnuksiin. <a href="/hebergement/connexion/">Tilit ja kirjautuminen</a>',
					'<strong>Projektin tai tietokannan jakaminen</strong>: Hallintaoikeus-tason henkilö kutsuu muita linkillä tasolle Lukuoikeus, Muokkausoikeus tai Hallintaoikeus, näkee, kenellä on pääsy, muuttaa tasoa tai poistaa sen. Ei koskaan enempää kuin mitä hän itse hallinnoi.',
					'<strong>Yksityisyys</strong>: kukin näkee enää vain ne henkilöt, joiden kanssa hän jakaa projektin, eikä toisen jo käyttämää projektin nimeä voi enää arvata.',
					'<strong>Kirjautuminen Googlella, Microsoftilla</strong> ja millä tahansa OpenID Connect -palveluntarjoajalla (Keycloak, GitLab…), jotka määritetään <code>.env</code>-tiedostossa; ensimmäinen kirjautuminen luo tilin, jos tilien luominen sen sallii. <a href="/hebergement/connexion/">Määritä</a>',
					'<strong>Uusi kirjautumisnäkymä</strong> sovelluksen teemassa, vaaleana tai tummana ja hillitysti animoituna; kuvitetut tyhjät näkymät sovelluksessa.',
					'<strong>Päivitykset ilman menetyksiä</strong>: basedb päivittää katalogiaan itse käynnistyessään, myös 0.1-asennuksessa, ja kieltäytyy käynnistymästä tietokannassa, jonka uudempi versio on jo päivittänyt. <a href="/hebergement/sauvegardes/">Päivittäminen</a>',
				],
			},
			dockerImage: {
				date: '2026-09-26',
				title: 'Yksi Docker-kuva',
				tag: 'Isännöinti',
				items: [
					'basedb mahtuu <strong>yhteen kuvaan</strong>, <code>eodia/basedb</code> Docker Hubissa, amd64:lle ja arm64:lle: käyttöliittymä, API polussa <code>/api</code> ja MCP-palvelin polussa <code>/mcp</code> <strong>yhdessä portissa</strong>. <a href="/guides/installation/">Asennus</a>',
					'Kaksi tiedostoa riittää – <code>docker-compose.yml</code> ja <code>.env</code> – ilman tietovaraston kloonaamista tai minkään kääntämistä; päivitys tehdään komennolla <code>docker compose pull</code>.',
					'Verkkotunnuksen takana HTTPS-välityspalvelimen ei enää tarvitse reitittää mitään: kaikki menee porttiin 3000.',
				],
			},
			automations: {
				date: '2026-09-26',
				title: 'Automaatiot, Interfaces, kaavat, yhteistyö',
				tag: 'Uutta',
				items: [
					'<strong>Kaavat</strong> ranskaksi – <code>SI</code>, <code>ARRONDI</code>, <code>JOURS</code>… – joista tulee PostgreSQL:n generoimia sarakkeita; <strong>haut</strong>, <strong>koosteet</strong> ja <strong>määrät</strong> viittausten yli. <a href="/fonctionnalites/tables-et-champs/">Kentät</a>',
					'<strong>Uudet tyypit</strong>: moniviittaus, henkilö, sähköposti, automaattinen numero, painike; ja tyyppien tapaan valittavat muodot – valuutta, prosentti, kesto, tähtiarvio, puhelin, viivakoodi.',
					'<strong>Kahdeksan näkymää</strong>: <strong>galleria</strong> ja <strong>luettelo</strong> liittyvät kuuden muun joukkoon; <strong>henkilökohtaiset näkymät</strong> jokaiselle lukijalle, lukitut näkymät, järjestys käsin, riippuvuudet aikajanalla. <a href="/fonctionnalites/vues/">Näkymät</a>',
					'<strong>Ruudukko</strong>: pikahaku, ryhmittely, sarakekohtainen yhteenveto koko suodatuksesta, sääntöjen mukaiset värit, rivikorkeus.',
					'<strong>Jaetut näkymät</strong> vain luku -muodossa, upotettavissa toiselle sivustolle; kalenterista tulee <strong>iCalendar-syöte</strong> Google-kalenteriin, Outlookiin tai Applen Kalenteriin. <a href="/fonctionnalites/vues-partagees/">Jakaminen</a>',
					'<strong>Yhteistyö</strong>: kommentit ja maininnat, ilmoitukset, muiden kirjoitukset reaaliajassa, läsnäolo taulukossa ja rivillä. <a href="/fonctionnalites/collaboration/">Yhdessä työskentely</a>',
					'<strong>Ctrl+Z</strong> kumoaa viimeisimmän kirjoituksen – solun, siirretyn kortin, kokonaisen tuonnin – ja kieltäytyy mieluummin kuin korvaa sen, mitä joku toinen on sen jälkeen muuttanut.',
					'<strong>Automaatiot</strong>: kun rivi luodaan tai sitä muokataan, tiettyyn aikaan tai painiketta napsauttamalla – muokkaa, luo, ilmoita, kutsu webhookia, lähetä Slackiin. <a href="/fonctionnalites/automatisations/">Automatisoi</a>',
					'<strong>Interfaces</strong>: koontinäytöt – luvut, kaaviot, luettelot, tekstit – luettuina kunkin omilla käyttöoikeuksilla. <a href="/fonctionnalites/tableaux-de-bord/">Koontinäytöt</a>',
					'<strong>Integraatiot</strong>: Slack-kanava ja <strong>synkronoidut taulukot</strong> verkossa olevasta CSV:stä, kalenterista tai toisen basedb:n näkymästä. <a href="/integrations/synchronisation/">Integraatiot</a>',
					'<strong>Tietokantamallit</strong>: kymmenen mallin galleria, tekoälylle yhdellä lauseella kuvattu tietokanta, ja minkä tahansa tietokannan voi tallentaa malliksi. <a href="/modeles/">Galleria</a>',
					'<strong>Käyttöoikeudet</strong>: Rakenne-näkymää voi vain selata ilman Hallintaoikeus-tasoa.',
					'<strong>Uusi ilme</strong>: logo, väripaletti ja uudistettu kirjautumisnäkymä.',
				],
			},
			simpler: {
				date: '2026-09-26',
				title: 'Yksinkertaisempi käyttöliittymä',
				items: [
					'<strong>Sivupalkki</strong> luettelee enää vain tietokannat ja niiden taulukot; avoimen tietokannan näkymät – Rakenne, Historia, Interfaces, Automaatiot – on koottu yhteen lohkoon aivan profiilin yläpuolelle.',
					'<strong>Profiilivalikkoon</strong> on koottu se, mikä ei ole tietoa: API- ja MCP-dokumentaatio, integraatiot, käyttäjät ja käyttöoikeudet.',
					'<strong>SQL-kysely</strong> avataan välilehtipalkin ”+”-painikkeesta tai tietokannan valikosta, ilman kaksoiskappaletta sivupalkissa.',
					'<strong>Uusi tietokanta</strong> tarjoaa mallit ja tekoälyn suoraan valintaikkunassa; esittelytietokanta kulkee saman gallerian kautta.',
					'<strong>Näkymä ei enää tarjoa sitä, mikä hylättäisiin</strong>: ei rakennepainikkeita ilman Hallintaoikeutta, ei ”Poista”-toimintoa ilman poisto-oikeutta; ja lukija luo omat näkymänsä sen sijaan, että törmäisi virheilmoitukseen.',
					'<strong>Järjestelmäsarakkeet</strong> on koottu kohtaan ”Järjestelmätiedot” sen sijaan, että niitä tarjottaisiin jokaisessa taulukossa.',
					'<strong>Rivin tiedot</strong> saavat kommenttinsa, painikkeen sähköpostin lähettämiseen tai soittamiseen ja yhdellä napsautuksella asetettavan arvion.',
					'<strong>Kirjautumisnäkymä</strong> luopuu animoidusta 3D-taustastaan kevyen näkymän hyväksi, joka noudattaa ”vähennä liikettä” -asetusta.',
				],
			},
			environments: {
				date: '2026-09-26',
				title: 'Ympäristöt, jaetut lomakkeet, näkymät',
				items: [
					'<strong>Ympäristöt</strong>: tuotanto, testi ja kehitys samalle tietokannalle; rinnakkainen vertailu, migraatiosuunnitelma, rivien synkronointi.',
					'<strong>Rakenteen historia</strong>: jokainen taulukon tai kentän luonti tai muutos, jonka katalogin liipaisin tallentaa.',
					'<strong>Jaetut lomakkeet</strong>: julkinen tai vain jäsenille tarkoitettu linkki, sulkeutuminen päivämäärän tai vastausmäärän mukaan, vastausten tekijät historiassa.',
					'<strong>Kuusi näkymää</strong>: ruudukko, kanban, kalenteri, aikajana, lomake, kyselylomake.',
					'<strong>Tietojen historia</strong>: muutoksen kumoaminen, poistetun rivin palauttaminen.',
					'<strong>Tekoäly</strong>: tekoälyasetus missä tahansa kentässä sekä Copilot.',
					'<strong>Viittaus</strong> ja <strong>URL</strong>: kaksi erillistä tyyppiä; pitkä teksti kirjoitetaan Markdownina.',
					'<strong>Webhookit</strong> allekirjoitettuina ja järjestettyinä, <strong>agenttien ehdotukset</strong> hyväksyttäviksi.',
					'<strong>Docker</strong>: kolmen kohteen Dockerfile, täydellinen docker-compose, valinnainen HTTPS-välityspalvelin.',
				],
			},
			projects: {
				date: '2026-09-25',
				title: 'Projektit, käyttöoikeudet, MCP-palvelin',
				items: [
					'<strong>Projektit</strong> tietokantojen yläpuolella ja käyttöoikeudet <strong>ryhmittäin</strong> neljällä tasolla: Ei käyttöoikeutta, Lukuoikeus, Muokkausoikeus, Hallintaoikeus.',
					'<strong>Tilit</strong>: tilapäinen salasana, vaihto ensimmäisellä kirjautumiskerralla, korotettu istunto ylläpitoa varten.',
					'<strong>MCP-palvelin</strong> ja stdio-välittäjä; REST API:n ja MCP:n yhteiset <strong>integraatiotunnukset</strong>.',
					'<strong>Luotu dokumentaatio</strong> ”API ja MCP” jokaiselle tietokannalle.',
				],
			},
			fields: {
				date: '2026-09-20',
				title: 'Kentät, Yksi valinta -kentät, tuonti',
				items: [
					'Kentän ja Yksi valinta -kentän vaihtoehtojen muokkaaminen.',
					'CSV- ja JSON-tiedostojen <strong>tuonti</strong>.',
					'Taulukon valikko: nimeä uudelleen, kuvaile, poista.',
				],
			},
			firstCommit: {
				date: '2026-09-20',
				title: 'Ensimmäinen commit',
				items: [
					'Monorepo: nimeämiskäytännöt, virhekoodirekisteri, arkkitehtuuridokumentista poimittu katalogi, ydin, API, käyttöliittymä.',
				],
			},
		},
	},
	roadmap: {
		label: 'Tiekartta',
		title: 'Mitä seuraavaksi',
		intro: 'basedb on aktiivisessa kehityksessä. Tämä sivu kertoo, mitä vielä puuttuu, lupaamatta päivämääriä. Idea tai tarve? <a href="https://github.com/eodia/basedb/issues">Avaa tiketti</a>. Mitä on jo tehty: <a href="/nouveautes/">uutuudet</a>.',
		columns: {
			next: {
				title: 'Pian',
				items: {
					restoreTable: {
						title: 'Yksittäisen taulukon palauttaminen',
						text: 'Poistettu taulukko pysyy luettavissa SQL:llä sivuun siirretyllä nimellään; sen palauttaminen yksinään käyttöliittymästä on tulossa.',
					},
					aiSettings: {
						title: 'Tekoälyasetukset käyttöliittymässä',
						text: 'Palveluntarjoaja, malli ja avain työtilakohtaisesti ilman API:n ympäristömuuttujia.',
					},
					mail: {
						title: 'Ilmoitukset ja kutsut sähköpostilla',
						text: 'Maininnat, vastaukset ja osoitukset saapuvat nyt basedb:hen, kutsut linkkinä, jonka lähetät itse; jatkossa ne voivat lähteä myös sähköpostilla.',
					},
				},
			},
			later: {
				title: 'Myöhemmin',
				items: {
					formLinks: {
						title: 'Viittaukset ja tiedostot jaetuissa lomakkeissa',
						text: 'Rajattu haku linkitetystä taulukosta ja rajoitettu tiedostojen lähetys tuntemattomille vastaajille.',
					},
					moreEvents: {
						title: 'Lisää ilmoitettavia tapahtumia',
						text: 'Ilmoitus lomakevastauksesta, agentin ehdotuksesta tai käytöstä poistetusta webhookista.',
					},
					sqlViewsAcross: {
						title: 'SQL-näkymät ympäristöstä toiseen',
						text: 'SQL-näkymien kopioiminen rakenteen mukana, kun ympäristöjä luodaan tai verrataan, sekä tietokantamalleissa.',
					},
					loops: {
						title: 'Silmukat ja odotukset automaatioissa',
						text: 'Vaiheiden toistaminen jokaiselle löydetylle riville, odottaminen ennen seuraavaa (”kolme päivää myöhemmin”) ja työnkulkujen vieminen tietokantamalleihin.',
					},
					textFormulas: {
						title: 'Tekstikaavat',
						text: 'Tekstin osan poimiminen, korvaaminen tai katkaiseminen.',
					},
					bulk: {
						title: 'Ilmoitetut massatoiminnot',
						text: 'Tuhansien rivien muutokset, jotka tallennetaan historiaan yhtenä toimintona.',
					},
					tombstones: {
						title: 'Hautakivien siivous',
						text: 'Tarpeettomiksi käyneiden poistomerkintöjen siivoaminen.',
					},
				},
			},
		},
	},
	gallery: {
		label: 'Mallit',
		title: 'Tietokanta valmiina sekunneissa',
		intro: 'Jokainen malli luo toisiinsa linkitetyt taulukot, esimerkkirivit, näkymät, koontinäytön, automaatiot – ja kentät, jotka tekoäly täyttää itse. basedb:ssä: <strong>Uusi tietokanta</strong> ja sitten <strong>Aloita mallista</strong>. Eikö mikään sovi? Kuvaile tarpeesi yhdellä lauseella: tekoäly ehdottaa sinulle räätälöityä tietokantaa.',
		filter: 'Suodata luokan mukaan',
		all: 'Kaikki',
		otherCategory: 'Muut',
		ai: '✦ Tekoäly',
		tables: {
			one: '{n} taulukko',
			other: '{n} taulukkoa',
		},
		rows: {
			one: '{n} rivi',
			other: '{n} riviä',
		},
		views: {
			one: '{n} näkymä',
			other: '{n} näkymää',
		},
		howtoTitle: 'Mallien määrittäminen JSON-muodossa',
		howto: 'Malli on JSON-tiedosto: sen taulukot, kentät, viittaukset, rivit, näkymät, koontinäytöt, automaatiot ja tekoälykenttien kehotteet. Tämän sivun mallit ovat tietovaraston kansion <a href="https://github.com/eodia/basedb/tree/main/packages/templates/catalog"><code>packages/templates/catalog</code></a> tiedostoja; jokainen basedb-instanssi lukee tiedoston <a href="/modeles/catalogue.json"><code>catalogue.json</code></a> ja tarjoaa mallit käyttäjilleen. Ylläpitäjä voi myös tuoda omia mallejaan instanssiinsa, ja minkä tahansa tietokannan voi tallentaa malliksi.',
		format: {
			href: '/fonctionnalites/modeles/',
			label: 'Mallien muoto →',
		},
		back: '← Kaikki mallit',
		defaultCategory: 'Malli',
		sampleRows: {
			one: '{n} esimerkkirivi',
			other: '{n} esimerkkiriviä',
		},
		aiTitle: 'Mitä tekoäly laskee',
		useTitle: 'Käytä tätä mallia',
		useSteps: [
			'basedb:ssä <strong>Uusi tietokanta</strong>.',
			'<strong>Aloita mallista</strong> ja sitten ”{label}”.',
		],
		create: '<strong>Luo tietokanta</strong>.',
		createWithAi: '<strong>Luo tietokanta</strong> – ja hyväksy halutessasi, että tekoälypalveluntarjoajasi laskee tekoälykentät.',
		download: 'Lataa JSON',
		downloadNote: 'Tuodaksesi sen instanssiisi tai muokataksesi sitä ennen kuin ehdotat sitä katalogiin.',
		viewMeta: '– {kind}, {table}',
		dashboard: '<strong>Koontinäyttö</strong> ”{label}” – {blocks}',
		blocks: {
			one: '{n} lohko',
			other: '{n} lohkoa',
		},
		automation: '<strong>Automaatio</strong> ”{label}”',
		yes: 'Kyllä',
		no: 'Ei',
		me: 'Sinä',
		kinds: {
			short_text: 'Lyhyt teksti',
			long_text: 'Pitkä teksti',
			rich_text: 'Muotoiltu teksti',
			number: 'Luku',
			boolean: 'Valintaruutu',
			date: 'Päivämäärä',
			datetime: 'Päivämäärä ja aika',
			select: 'Yksi valinta',
			multi_select: 'Monivalinta',
			url: 'URL',
			email: 'Sähköposti',
			user: 'Henkilö',
			autonumber: 'Automaattinen numero',
			formula: 'Kaava',
			lookup: 'Haku',
			rollup: 'Kooste',
			count: 'Määrä',
			button: 'Painike',
			link: 'Viittaus',
			multi_link: 'Moniviittaus',
		},
		viewKinds: {
			grid: 'Ruudukko',
			kanban: 'Kanban',
			calendar: 'Kalenteri',
			timeline: 'Aikajana',
			gallery: 'Galleria',
			list: 'Luettelo',
			form: 'Lomake',
		},
	},
	templates: {
		demo: {
			label: 'Esittely: Atelier Lumen',
			summary: 'Pieni suunnittelutoimisto, sen asiakkaat, projektit, tehtävät, laskut ja arviot: basedb:n kaikki puolet yhdessä tietokannassa.',
			description: 'Esittelytietokanta. Atelier Lumen on kuvitteellinen suunnittelutoimisto. Sen tietokanta näyttää taulukoiden väliset viittaukset, haut ja koosteet (liikevaihto asiakasta kohden, keskimääräinen arvio), kaavat (verollinen summa, viive), kolme tekoälyn laskemaa kenttää asiakasarvioista (sävy, aihe, ehdotettu vastaus), kaikki näkymätyypit – ruudukko, kanban, kalenteri, aikajana riippuvuuksineen, galleria, luettelo, lomake –, koontinäytön ja kaksi automaatiota.',
			category: 'Esittely',
			tags: ['Tekoäly', 'Viittaukset', 'Kaikki näkymät', 'Koontinäyttö'],
		},
		'analyse-avis': {
			label: 'Asiakasarvioiden analyysi',
			summary: 'Kerää arviot ja anna tekoälyn poimia niistä sävy, aiheet, kiireellisyys ja vastausluonnos.',
			description: 'Kaupalle, ravintolalle tai brändille: arviot saapuvat julkisesta lomakkeesta tai tuonnista, ja tekoäly lukee jokaisen. Se luokittelee sävyn, tunnistaa pääaiheen, merkitsee nopeaa vastausta vaativat, poimii asiakkaan ehdotuksen ja laatii vastauksen tarkistettavaksi. Tuotteet kokoavat keskimääräisen arvionsa ja arvioidensa määrän; koontinäyttö seuraa tyytyväisyyttä.',
			category: 'Asiakassuhteet',
			tags: ['Tekoäly', 'Lomake', 'Koontinäyttö'],
		},
		'base-connaissances': {
			label: 'Tietämyskanta',
			summary: 'Ohjeartikkelit ja asiakkaiden kysymykset: tekoäly tiivistää, luokittelee ja ehdottaa vastausta artikkelien pohjalta.',
			description: 'Asiakastuelle. Ohjeartikkelit on järjestetty luokittain, ja niitä seurataan ajan mittaan; asiakkaiden kysymykset saapuvat julkisen lomakkeen kautta. Tekoäly tiivistää jokaisen artikkelin ja arvioi sen tason, luokittelee jokaisen kysymyksen ja laatii vastausluonnoksen tarkistettavaksi.',
			category: 'Tuki',
			tags: ['Tekoäly', 'Lomake', 'Luettelo'],
		},
		'calendrier-editorial': {
			label: 'Julkaisukalenteri',
			summary: 'Artikkelit, somepäivitykset ja uutiskirjeet kalenteriin suunniteltuina; tekoäly ehdottaa koukkuja ja avainsanoja.',
			description: 'Markkinointitiimille tai toimitukselle. Jokainen sisältö etenee ideasta julkaisuun, saa paikkansa julkaisukalenterissa ja kuuluu kampanjaan. Tekoäly ehdottaa briefin pohjalta koukun ja avainsanat, ja lomakkeella koko yritys voi ehdottaa aiheita.',
			category: 'Markkinointi',
			tags: ['Tekoäly', 'Kalenteri', 'Kanban', 'Lomake'],
		},
		crm: {
			label: 'Myynnin CRM',
			summary: 'Yritykset, yhteyshenkilöt ja myyntimahdollisuudet: myyntiputki, yhteydenpito ja tekoäly, joka neuvoo seuraavan askeleen.',
			description: 'Kevyt CRM myyntitiimille. Myyntimahdollisuudet etenevät myyntiputkessa, ja niillä on todennäköisyydellä painotettu summa; tekoäly arvioi niiden riskin ja neuvoo muistiinpanojen perusteella seuraavan toimenpiteen. Yhteydenpito asiakkaisiin kirjataan ja tiivistetään, ja yritykset kokoavat, mitä ne edustavat.',
			category: 'Myynti',
			tags: ['Tekoäly', 'Myyntiputki', 'Kanban', 'Kalenteri'],
		},
		evenements: {
			label: 'Tapahtumat ja ilmoittautumiset',
			summary: 'Konferenssit, työpajat ja webinaarit: ilmoittautumiset, vapaat paikat ja osallistujien palaute tekoälyn lukemana.',
			description: 'Toistuvien tapahtumien järjestämiseen. Jokainen tapahtuma laskee ilmoittautuneensa ja vapaat paikkansa; ilmoittautumiset etenevät osallistumiseen asti. Tapahtuman jälkeen osallistujat antavat palautetta, jonka tekoäly luokittelee sävyn mukaan ja tiivistää. Julkisella lomakkeella voi liittyä postituslistalle.',
			category: 'Tapahtumat',
			tags: ['Tekoäly', 'Kalenteri', 'Lomake', 'Koosteet'],
		},
		'gestion-projet': {
			label: 'Projektinhallinta',
			summary: 'Projektit, tehtävät ja virstanpylväät: tiekartta, tehtävien väliset riippuvuudet, kanban ja kalenteri.',
			description: 'Useiden rinnakkaisten projektien ohjaamiseen. Jokainen projekti kokoaa tehtävänsä ja tuntinsa; tehtäviä seurataan kanbanissa ja ne aikataulutetaan aikajanalle, joka piirtää niiden riippuvuudet, ja virstanpylväät näkyvät kalenterissa. Tekoäly kirjoittaa johdolle projektin tilannekatsauksen sen kuvauksen ja edistymisen perusteella.',
			category: 'Organisointi',
			tags: ['Aikajana', 'Riippuvuudet', 'Kanban', 'Tekoäly'],
		},
		inventaire: {
			label: 'Varasto ja inventaario',
			summary: 'Tuotteet, toimittajat ja varastotapahtumat: saldo lasketaan itsestään, ja loppumiset näkyvät etukäteen.',
			description: 'Verstaalle, myymälälle tai kiinteistöpalveluille. Jokainen saapuva tai lähtevä erä on varastotapahtuma; kunkin tuotteen saldo on niiden summa, sen arvo kaava, ja hälytysrajan alittavat tuotteet näkyvät näkymässä ”À commander” (tilattavat). Tekoäly kirjoittaa kunkin tuotteen kuvauksen sen nimen ja luokan perusteella.',
			category: 'Operaatiot',
			tags: ['Koosteet', 'Kaavat', 'Galleria', 'Tekoäly'],
		},
		recrutement: {
			label: 'Rekrytointi',
			summary: 'Avoimet paikat, hakijat ja haastattelut; tekoäly tiivistää jokaisen hakemuksen ja ehdottaa, mihin kannattaa pureutua.',
			description: 'Rekrytointien seuranta hakemuksesta palkkaukseen. Hakijat hakevat julkisella lomakkeella ja etenevät vaihe vaiheelta kanbanissa, ja haastattelut aikataulutetaan kalenteriin. Tekoäly lukee hakukirjeen ja muistiinpanot: tiivistelmä ja haastattelussa esitettävät kysymykset. Se auttaa lukemaan, se ei päätä.',
			category: 'Henkilöstöhallinto',
			tags: ['Tekoäly', 'Lomake', 'Kanban', 'Kalenteri'],
		},
		'suivi-tickets': {
			label: 'Tikettien seuranta',
			summary: 'Tekoälyn lajittelemat bugit ja pyynnöt, joita seurataan sprinteittäin ratkaisuun asti, sekä ilmoituslomake.',
			description: 'Tikettijärjestelmä tuotetiimille. Jokainen tiketti liittyy komponenttiin ja sprinttiin; tekoäly ehdottaa luokkaa, arvioi vakavuuden ja tiivistää ilmoituksen. Kanban seuraa etenemistä, aikajana näyttää sprintit, lomakkeella kuka tahansa voi ilmoittaa ongelmasta, ja automaatio kirjaa ratkaisupäivän.',
			category: 'Tuote ja tekniikka',
			tags: ['Tekoäly', 'Kanban', 'Lomake', 'Sprintit'],
		},
	},
} satisfies DeepPartial<Dict>;
