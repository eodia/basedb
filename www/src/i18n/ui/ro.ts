/**
 * The Romanian texts of the landing pages, laid over the French ones (`fr.ts`).
 *
 * See `../README.md`.
 */
import type { DeepPartial, Dict } from './index';

export default {
	meta: {
		home: {
			title: 'basedb — baza colaborativă în care fiecare tabel este un tabel PostgreSQL real',
			description: 'Grile și zece vizualizări, formule, formulare, quiz și vizualizări partajate, comentarii, automatizări, tablouri de bord, permisiuni până la nivel de câmp, istoric complet, API REST și server MCP — pe tabele PostgreSQL reale, cu nume clare. Auto-găzduit, AGPL-3.0.',
		},
		changelog: {
			title: 'Noutăți — basedb',
			description: 'Ce s-a schimbat în basedb, de la o versiune la alta.',
		},
		roadmap: {
			title: 'Foaie de parcurs — basedb',
			description: 'Ce va face basedb în continuare.',
		},
		gallery: {
			title: 'Șabloane — basedb',
			description: 'Baze gata de folosit: urmărirea tichetelor, analiza recenziilor, CRM, recrutare… cu rândurile de exemplu, vizualizările, tablourile de bord și câmpurile lor calculate de AI.',
		},
		template: {
			title: '{label} — șabloane basedb',
		},
	},
	eodia: {
		home: 'https://eodia.com/',
		about: 'https://eodia.com/about/',
		contact: 'https://eodia.com/contact/',
	},
	demo: {
		short: 'Demo',
		cta: 'Încercați demonstrația',
	},
	nav: {
		aria: 'Navigare principală',
		home: 'basedb — acasă',
		links: [
			{
				href: '/#fonctionnalites',
				label: 'Funcționalități',
			},
			{
				href: '/modeles/',
				label: 'Șabloane',
			},
			{
				href: '/guides/introduction/',
				label: 'Documentație',
			},
			{
				href: '/nouveautes/',
				label: 'Noutăți',
			},
		],
		developers: 'Dezvoltatori',
		github: 'Depozitul GitHub al basedb',
		install: 'Instalați',
		menu: {
			open: 'Deschideți meniul',
			close: 'Închideți meniul',
			features: {
				label: 'Funcționalități',
				groups: {
					organize: {
						title: 'Organizare',
						items: {
							tables: {
								href: '/fonctionnalites/tables-et-champs/',
								title: 'Tabele și câmpuri',
								text: 'Câmpuri pentru orice, relații, formule ca într-o foaie de calcul.',
							},
							views: {
								href: '/fonctionnalites/vues/',
								title: 'Zece vizualizări',
								text: 'Grilă, kanban, calendar, cronologie, galerie, listă, hartă, formular, chestionar, quiz.',
							},
							forms: {
								href: '/fonctionnalites/formulaires-partages/',
								title: 'Formulare',
								text: 'Un link de partajat: fiecare răspuns devine un rând.',
							},
							files: {
								href: '/fonctionnalites/fichiers/',
								title: 'Fișiere și imagini',
								text: 'Oferte, fotografii, contracte, păstrate alături de rândul lor.',
							},
						},
					},
					collaborate: {
						title: 'Colaborare',
						items: {
							live: {
								href: '/fonctionnalites/collaboration/',
								title: 'Timp real și comentarii',
								text: 'Vedeți-i pe ceilalți lucrând, comentați un rând, menționați un coleg.',
							},
							rights: {
								href: '/fonctionnalites/droits/',
								title: 'Permisiuni și echipe',
								text: 'Cine vede ce și cine modifică ce, până la nivel de coloană.',
							},
							history: {
								href: '/fonctionnalites/historique/',
								title: 'Istoric',
								text: 'Fiecare modificare păstrată, și anulabilă.',
							},
							shared: {
								href: '/fonctionnalites/vues-partagees/',
								title: 'Vizualizări partajate',
								text: 'O vizualizare printr-un link, pe site-ul dumneavoastră sau în agenda dumneavoastră.',
							},
						},
					},
					automate: {
						title: 'Automatizare și analiză',
						items: {
							automations: {
								href: '/fonctionnalites/automatisations/',
								title: 'Automatizări',
								text: 'Când un rând se schimbă: anunțați, creați, scrieți, întrebați AI-ul.',
							},
							dashboards: {
								href: '/fonctionnalites/tableaux-de-bord/',
								title: 'Tablouri de bord',
								text: 'Cincisprezece reprezentări vizuale, filtre comune, un link de partajat.',
							},
							ai: {
								href: '/fonctionnalites/ia/',
								title: 'AI și Copilot',
								text: 'O bază într-o frază, câmpuri care se completează singure.',
							},
							templates: {
								href: '/modeles/',
								title: 'Șabloane',
								text: 'Zece baze gata de folosit, de adaptat.',
							},
						},
					},
				},
				feature: {
					tag: 'Nou',
					title: 'Automatizările în flux',
					text: 'Căutați, decideți, întrebați AI-ul: un editor grafic, iar fiecare execuție se recitește pas cu pas.',
					href: '/nouveautes/',
					cta: 'Toate noutățile',
				},
				all: 'Toate funcționalitățile',
			},
			solutions: {
				label: 'Soluții',
				title: 'Pentru fiecare echipă',
				items: {
					crm: {
						team: 'Vânzări',
						text: 'Pipeline, contacte, urmăriri.',
					},
					recrutement: {
						team: 'Resurse umane',
						text: 'Candidaturi, interviuri, sinteze realizate de AI.',
					},
					'calendrier-editorial': {
						team: 'Marketing',
						text: 'Articole, postări și newslettere planificate.',
					},
					inventaire: {
						team: 'Operațiuni',
						text: 'Un stoc calculat, rupturile de stoc văzute din timp.',
					},
					'gestion-projet': {
						team: 'Proiecte',
						text: 'Repere, sarcini și dependențe.',
					},
					'suivi-tickets': {
						team: 'Produs',
						text: 'Buguri și solicitări sortate de AI.',
					},
					'base-connaissances': {
						team: 'Asistență',
						text: 'Articole de ajutor, întrebări, răspunsuri propuse.',
					},
					evenements: {
						team: 'Evenimente',
						text: 'Înscrieri, locuri, feedback.',
					},
					'analyse-avis': {
						team: 'Relația cu clienții',
						text: 'Recenzii citite și clasificate de AI.',
					},
				},
				ask: {
					title: 'Altceva în minte?',
					text: 'Descrieți-vă nevoia într-o frază: AI-ul vă propune o bază pe măsură.',
					href: '/modeles/',
				},
				all: 'Toate șabloanele',
			},
			developers: {
				label: 'Dezvoltatori',
				groups: {
					build: {
						title: 'Integrare',
						items: {
							api: {
								href: '/integrations/api-rest/',
								title: 'API REST',
								text: 'Aceleași date ca în interfață, descrise în OpenAPI 3.1.',
							},
							mcp: {
								href: '/integrations/mcp/',
								title: 'Server MCP',
								text: 'Instrumente pentru agenții dumneavoastră AI, sub permisiunile dumneavoastră.',
							},
							webhooks: {
								href: '/integrations/webhooks/',
								title: 'Webhookuri',
								text: 'Fiecare scriere, semnată, ordonată, reîncercată.',
							},
							sql: {
								href: '/integrations/sql/',
								title: 'SQL direct',
								text: 'Tabele PostgreSQL reale, cu nume clare.',
							},
							sync: {
								href: '/integrations/synchronisation/',
								title: 'Sincronizare',
								text: 'Tabele actualizate din altă parte.',
							},
						},
					},
					host: {
						title: 'Găzduire',
						items: {
							docker: {
								href: '/hebergement/docker/',
								title: 'Docker Compose',
								text: 'O imagine, o bază PostgreSQL, un singur port.',
							},
							env: {
								href: '/hebergement/variables/',
								title: 'Variabile',
								text: 'Totul se configurează în fișierul .env.',
							},
							https: {
								href: '/hebergement/https/',
								title: 'Domeniu și HTTPS',
								text: 'În spatele propriului dumneavoastră proxy, sau cu Caddy, inclus.',
							},
							sso: {
								href: '/hebergement/connexion/',
								title: 'Conectare și SSO',
								text: 'Google, Microsoft, orice furnizor OpenID Connect.',
							},
							backup: {
								href: '/hebergement/sauvegardes/',
								title: 'Copii de rezervă și actualizări',
								text: 'pg_dump, și actualizări fără pierderi.',
							},
						},
					},
				},
				feature: {
					title: 'Pagina dezvoltatorilor',
					text: 'Un tabel PostgreSQL real în spatele fiecărei grile.',
					href: '/developpeurs/',
				},
			},
			resources: {
				label: 'Resurse',
				groups: {
					learn: {
						title: 'Învățare',
						items: {
							docs: {
								href: '/guides/introduction/',
								title: 'Documentație',
								text: 'Tot basedb, pas cu pas.',
							},
							start: {
								href: '/guides/premiers-pas/',
								title: 'Primii pași',
								text: 'O primă bază, de la import la vizualizare.',
							},
							install: {
								href: '/guides/installation/',
								title: 'Instalare',
								text: 'Două fișiere și o comandă.',
							},
							principles: {
								href: '/architecture/principes/',
								title: 'Principiile',
								text: 'Cum este construit basedb, și de ce.',
							},
						},
					},
					follow: {
						title: 'Urmărirea proiectului',
						items: {
							news: {
								href: '/nouveautes/',
								title: 'Noutăți',
								text: 'Ce s-a schimbat, versiune după versiune.',
							},
							roadmap: {
								href: '/feuille-de-route/',
								title: 'Foaie de parcurs',
								text: 'Ce urmează.',
							},
							github: {
								href: 'https://github.com/eodia/basedb',
								title: 'GitHub',
								text: 'Codul, tichetele, versiunile.',
							},
							eodia: {
								href: 'https://eodia.com/',
								title: 'Eodia',
								text: 'Studioul care creează basedb.',
							},
						},
					},
				},
			},
		},
	},
	language: {
		label: 'Limbă',
		current: 'Limbă: {name}',
	},
	footer: {
		tagline: 'Baza colaborativă în care fiecare tabel este un tabel PostgreSQL real.',
		madeBy: 'Software liber dezvoltat de <a class="eodia" href="https://eodia.com/">Eodia</a>, un studio de software AI-nativ.',
		columns: {
			product: {
				title: 'Produs',
				links: [
					{
						href: '/#fonctionnalites',
						label: 'Funcționalități',
					},
					{
						href: '/nouveautes/',
						label: 'Noutăți',
					},
					{
						href: '/feuille-de-route/',
						label: 'Foaie de parcurs',
					},
					{
						href: '/#faq',
						label: 'Întrebări frecvente',
					},
				],
			},
			docs: {
				title: 'Documentație',
				links: [
					{
						href: '/guides/introduction/',
						label: 'Introducere',
					},
					{
						href: '/guides/installation/',
						label: 'Instalare',
					},
					{
						href: '/integrations/api-rest/',
						label: 'API REST',
					},
					{
						href: '/integrations/mcp/',
						label: 'Server MCP',
					},
				],
			},
			hosting: {
				title: 'Găzduire',
				links: [
					{
						href: '/hebergement/docker/',
						label: 'Docker Compose',
					},
					{
						href: '/hebergement/variables/',
						label: 'Variabile de mediu',
					},
					{
						href: '/hebergement/https/',
						label: 'Domeniu și HTTPS',
					},
					{
						href: '/hebergement/sauvegardes/',
						label: 'Copii de rezervă',
					},
				],
			},
			project: {
				title: 'Proiect',
				links: [
					{
						href: 'https://github.com/eodia/basedb',
						label: 'GitHub',
					},
					{
						href: 'https://github.com/eodia/basedb/tree/main/docs/architecture',
						label: 'Documentul de arhitectură',
					},
					{
						href: 'https://github.com/eodia/basedb/blob/main/LICENSE',
						label: 'Licența AGPL-3.0',
					},
					{
						href: 'https://github.com/eodia/basedb/issues',
						label: 'Raportați o problemă',
					},
				],
			},
			eodia: {
				title: 'Eodia',
				links: [
					{
						href: 'https://eodia.com/',
						label: 'Studioul',
					},
					{
						href: 'https://eodia.com/about/',
						label: 'Despre noi',
					},
					{
						href: 'https://eodia.com/contact/',
						label: 'Contactați-ne',
					},
				],
			},
		},
		copyright: '© {year} <a href="https://eodia.com/">Eodia</a> · AGPL-3.0-or-later',
		builtWith: 'Site construit cu Astro și Starlight.',
	},
	docsFooter: {
		madeBy: 'basedb este software liber dezvoltat de <a href="https://eodia.com/">Eodia</a>, un studio de software AI-nativ.',
	},
	teams: {
		meta: {
			title: 'basedb — baza colaborativă a întregii echipe',
			description: 'Toată munca dumneavoastră într-un singur loc, modificată de toată echipa în același timp: în tabel, în kanban sau în calendar, cu formulare, tablouri de bord, automatizări și AI. Fără cod, liber și gratuit.',
		},
		hero: {
			eyebrow: 'basedb',
			title: 'Toată munca dumneavoastră.',
			titleAccent: 'În sfârșit, într-un singur loc.',
			lead: 'Tabele, calendare, formulare, tablouri de bord și automatizări, pentru toată echipa. La fel de simplu ca o foaie de calcul. Fără o singură linie de cod.',
			primary: 'Descoperiți șabloanele',
			secondary: 'Vizionați demonstrația',
			facts: ['Fără cod', 'Liber și gratuit', 'Datele dumneavoastră rămân la dumneavoastră'],
		},
		story: {
			grid: {
				title: 'Toată echipa, în același tabel.',
				text: 'Fiecare lucrează aici în același timp, iar toată lumea vede același lucru, la zi.',
			},
			copilot: {
				title: 'Întrebați. Copilot se ocupă.',
				text: '„Pe cine trebuie să recontactez săptămâna aceasta?” — vă propune filtrul potrivit, iar dumneavoastră îl aplicați cu un clic.',
			},
			kanban: {
				title: 'Glisați. E la zi.',
				text: 'Fiecare etapă devine o coloană; a deplasa un card înseamnă a modifica rândul.',
			},
			calendar: {
				title: 'Fiecare dată la locul ei.',
				text: 'Programările se afișează de la sine și se urmăresc până în agenda dumneavoastră.',
			},
			dashboard: {
				title: 'Și totul, dintr-o privire.',
				text: 'Cifrele se calculează singure, pe baza acelorași rânduri.',
			},
		},
		stage: {
			aria: 'Urmărirea clienților unei echipe în basedb: tabel, Copilot, kanban, calendar, tablou de bord',
			tabs: {
				grid: 'Tabel',
				copilot: 'Copilot',
				kanban: 'Kanban',
				calendar: 'Calendar',
				dashboard: 'Tablou de bord',
			},
			project: 'Proiect principal',
			projectMeta: 'Proiect · 2 baze',
			filterNav: 'Filtrați navigarea',
			base: 'Vânzări',
			otherBase: 'Asistență',
			tables: ['Clienți', 'Contacte', 'Oferte'],
			baseSection: 'Bază · Vânzări',
			screens: ['Tablouri de bord', 'Automatizări'],
			user: 'Léa Martin',
			views: { grid: 'Toate rândurile', kanban: 'Pe etape', calendar: 'Programări' },
			toolbar: {
				filter: 'Filtrați',
				columns: 'Coloane',
				group: 'Grupați',
				colors: 'Culori',
				sort: 'Sortați',
				configure: 'Configurați',
			},
			search: 'Căutați…',
			add: 'Adăugați',
			columns: {
				name: 'Client',
				status: 'Etapă',
				owner: 'Urmărit de',
				amount: 'Sumă',
				next: 'Următoarea programare',
			},
			statuses: {
				contact: 'De contactat',
				meeting: 'Programare',
				quote: 'Ofertă trimisă',
				signed: 'Semnat',
			},
			clients: [
				'Brutăria Ionescu',
				'Clinica Tei',
				'Liceul Mihai Eminescu',
				'Biciclete Solidare',
				'Băcănia Fină',
				'Forjele Argeș',
				'Atelierul Popescu',
			],
			addRow: 'Adăugați un rând',
			perPage: 'Rânduri pe pagină',
			card: 'Urmărit de {owner}, programare pe {date}',
			addCard: 'Adăugați un card',
			today: 'Astăzi',
			month: 'Lună',
			week: 'Săptămână',
			dashboards: 'Tablouri de bord',
			questions: 'Întrebări',
			dashboard: 'Urmărire comercială',
			dashboardText: 'Esențialul, dintr-o privire.',
			dashboardTabs: ['Prezentare generală', 'Activitate'],
			period: 'Perioadă',
			thisYear: 'Anul acesta',
			share: 'Partajați',
			edit: 'Editați',
			explore: 'Explorați datele',
			chart: 'Sumă pe client',
			byStage: 'Clienți pe etape',
			kpis: {
				signed: 'Semnat',
				pending: 'Oferte în așteptare',
				rate: 'Clienți semnați',
			},
			copilot: {
				question: 'Pe cine trebuie să recontactez săptămâna aceasta?',
				thinking: 'Se gândește…',
				answer: 'Patru clienți așteaptă un răspuns: două oferte trimise și două programări de pregătit.',
				card: 'Filtrare Clienți',
				filter: 'Etapă: Ofertă trimisă sau Programare',
				apply: 'Aplicați filtrul',
				applied: 'Filtru aplicat',
				placeholder: 'Întrebați Copilot…',
				filtered: '{n} rânduri filtrate',
			},
		},
		teaser: {
			tabs: { label: 'Alegeți filmul', short: 'În 40 de secunde', full: 'Turul complet' },
			titleAccent: 'în 40 de secunde.',
			text: 'Tabele, vizualizări, formulare, automatizări și IA: esențialul basedb, pe muzică.',
			duration: '40 s',
			inEnglish: 'Textele din film sunt în engleză.',
		},

		video: {
			eyebrow: 'Demonstrația',
			title: 'Tot basedb,',
			titleAccent: 'în șapte minute.',
			text: 'Creați o bază, completați-o, partajați-o, automatizați-o, pilotați-o: vizita completă, comentată.',
			play: 'Redați videoclipul',
			duration: '6 min 36 s',
			chapters: 'Capitole',
			captions: 'Engleză',
			inEnglish: 'Videoclipul este în engleză, cu subtitrări în engleză.',
			list: [
				{ time: '0:10', title: 'Creați o bază' },
				{ time: '0:49', title: 'Tabele, câmpuri și formule' },
				{ time: '1:31', title: 'Detaliile rândului și colaborare' },
				{ time: '1:56', title: 'Șase vizualizări pe aceleași rânduri' },
				{ time: '2:29', title: 'Formulare și chestionare' },
				{ time: '3:28', title: 'Quiz' },
				{ time: '4:10', title: 'Automatizări' },
				{ time: '4:39', title: 'Tablouri de bord' },
				{ time: '4:59', title: 'SQL pentru fiecare' },
				{ time: '5:30', title: 'Istoric și permisiuni' },
				{ time: '5:53', title: 'API, MCP și Copilot' },
			],
		},
		together: {
			eyebrow: 'Colaborare',
			title: 'Toată lumea.',
			titleAccent: 'În același timp.',
			text: 'Modificările celorlalți ajung în direct. Vedeți cine se uită la ce rând, discutați despre el chiar acolo unde se află, și un @ este suficient pentru a anunța un coleg.',
			demo: {
				path: 'Vânzări / Oferte',
				here: '3 persoane pe acest tabel',
				columns: {
					client: 'Client',
					status: 'Etapă',
					amount: 'Sumă',
					due: 'Termen',
				},
				statuses: {
					draft: 'Ciornă',
					sent: 'Trimis',
					signed: 'Semnat',
				},
				rows: [
					'Brutăria Ionescu',
					'Clinica Tei',
					'Liceul Mihai Eminescu',
					'Biciclete Solidare',
					'Băcănia Fină',
					'Forjele Argeș',
				],
				comment: '@{name} poți valida oferta asta până în seara asta?',
				reply: 'S-a validat!',
				toast: '{name} a modificat „{field}”',
			},
			points: {
				live: {
					title: 'În direct',
					text: 'Fiecare modificare apare imediat la ceilalți, fără să reîncărcați pagina.',
				},
				comments: {
					title: 'Comentarii și mențiuni',
					text: 'Comentați un rând, menționați un coleg cu @, iar clopoțelul îl anunță.',
				},
				undo: {
					title: 'Anulare fără riscuri',
					text: 'Ctrl+Z anulează ultima dumneavoastră modificare — niciodată pe a unui coleg.',
				},
			},
			link: {
				href: '/fonctionnalites/collaboration/',
				label: 'Lucrul împreună',
			},
		},
		forms: {
			eyebrow: 'Formulare și chestionare',
			title: 'Puneți-vă întrebările.',
			titleAccent: 'Răspunsurile se ordonează singure.',
			text: 'Un formular pe o singură pagină, sau un chestionar care pune o întrebare pe ecran, în culorile dumneavoastră: distribuiți linkul, iar fiecare răspuns devine un rând din tabelul dumneavoastră. Cine răspunde nu vede nimic altceva.',
			modes: {
				label: 'Afișați întrebările',
				survey: 'Chestionar',
				form: 'Formular',
			},
			demo: {
				title: 'Cerere de ofertă',
				description: 'Trei întrebări, iar noi vă răspundem în 48 de ore.',
				count: '3 întrebări',
				start: 'Începeți',
				ok: 'OK',
				hint: 'sau Enter',
				submit: 'Trimiteți cererea',
				org: {
					label: 'Organizația dumneavoastră',
					answer: 'Cafeneaua Artelor',
				},
				need: {
					label: 'Necesitatea dumneavoastră',
					options: ['Site web', 'Identitate vizuală', 'Catalog'],
				},
				budget: {
					label: 'Bugetul dumneavoastră',
					help: 'Fără TVA, chiar dacă este aproximativ.',
				},
				sent: 'S-a trimis!',
				thanks: 'Mulțumim! Vă răspundem în 48 de ore.',
				poweredBy: 'Formular realizat cu basedb',
				path: 'Vânzări / Cereri',
				view: 'Toate cererile',
				columns: {
					org: 'Organizație',
					need: 'Necesitate',
					budget: 'Buget',
					stage: 'Etapă',
				},
				stages: {
					new: 'Nouă',
					called: 'Recontactată',
					quote: 'Ofertă trimisă',
				},
				rows: ['Brutăria Ionescu', 'Clinica Tei', 'Biciclete Solidare', 'Forjele Argeș'],
				open: 'Deschis',
				answers: {
					one: '{n} răspuns',
					few: '{n} răspunsuri',
					other: '{n} de răspunsuri',
				},
				active: 'Link activ',
			},
			points: {
				survey: {
					title: 'O întrebare pe ecran',
					text: 'Pe tot ecranul, de la tastatură: Enter pentru a continua, A, B, C pentru a alege — o alegere unică trece automat mai departe, iar trimiterea se sărbătorește.',
				},
				access: {
					title: 'Public sau rezervat',
					text: 'Oricine are linkul răspunde fără cont — sau doar membrii conectați, iar răspunsul le poartă numele.',
				},
				closed: {
					title: 'Restul rămâne închis',
					text: 'Răspunsul nu arată nimic altceva din tabel. Linkul se închide la o dată, sau după un număr de răspunsuri.',
				},
			},
			link: {
				href: '/fonctionnalites/formulaires-partages/',
				label: 'Formularele',
			},
		},
		automate: {
			eyebrow: 'Automatizări',
			title: 'Lucrează',
			titleAccent: 'în timp ce dumneavoastră dormiți.',
			text: 'Când un rând sosește sau se modifică, la o oră fixă sau printr-un clic pe un buton, basedb înlănțuie pașii: alege ramura potrivită, întreabă AI, anunță pe cine trebuie. Iar fiecare execuție poate fi recitită, pas cu pas.',
			clock: '03:12',
			crumb: 'Vânzări / Automatizări',
			create: 'Automatizare nouă',
			list: [
				{
					name: 'Cerere nouă',
					when: 'Un rând este creat',
				},
				{
					name: 'Ofertă semnată',
					when: 'Un rând este modificat',
				},
				{
					name: 'Recontactări de luni',
					when: 'În fiecare luni la 09:00',
				},
			],
			active: 'Activă',
			test: 'Testați pe un rând',
			save: 'Salvați',
			when: 'Când',
			trigger: 'Un rând este creat',
			table: 'În Cereri',
			steps: {
				branch: {
					kind: 'Condiție',
					text: '2 ramuri',
					run: 'ramura „Proiect mare”',
				},
				notify: {
					kind: 'Anunțare persoană',
					text: 'Léa Martin',
					run: '1 persoană notificată',
				},
				create: {
					kind: 'Creare rând',
					text: 'O programare, în Agendă',
					run: 'efectuat',
				},
				slack: {
					kind: 'Trimitere pe Slack',
					text: 'În canalul #vânzări',
					run: 'efectuat',
				},
				ai: {
					kind: 'Întrebați AI',
					text: 'Redactarea unui prim răspuns',
					run: 'răspuns de {n} caractere',
				},
				update: {
					kind: 'Modificare rând',
					text: 'Răspuns, Etapă',
					run: 'efectuat',
				},
			},
			paths: {
				big: 'Proiect mare',
				condition: 'budget gt 5000',
				otherwise: 'Altfel',
			},
			answer: 'Bună ziua, și mulțumim pentru cererea dumneavoastră! Léa, care se va ocupa de noua dumneavoastră identitate vizuală, vă sună mâine dimineață.',
			addStep: 'Adăugați un pas',
			tabs: {
				settings: 'Opțiuni',
				runs: 'Execuții',
			},
			runsText: 'Ultimele 50, păstrate 30 de zile. Alegeți una pentru a vedea, pe flux, ramura pe care a urmat-o.',
			running: 'În curs',
			succeeded: 'Reușită',
			started: 'rând creat · {when}',
			now: 'chiar acum',
			earlier: ['ieri la 18:40', 'ieri la 11:02'],
			done: 'Reușită · 5 pași · 1,3 s',
			points: {
				when: {
					title: 'La momentul potrivit',
					text: 'Un rând creat sau modificat, o oră fixă, un buton — și o condiție pentru a porni doar când trebuie.',
				},
				paths: {
					title: 'Mai multe ramuri',
					text: 'O condiție deschide ramuri, fiecare cu pașii ei; ce găsește un pas, următorul îl poate cita.',
				},
				copilot: {
					title: 'Descrisă într-o frază',
					text: '„Când sosește o cerere, anunțați-o pe Léa dacă bugetul depășește 5.000 €”: Copilot construiește fluxul, dumneavoastră îl recitiți.',
				},
			},
			link: {
				href: '/fonctionnalites/automatisations/',
				label: 'Automatizările',
			},
		},
		glance: {
			eyebrow: 'Tablouri de bord',
			title: 'Vedeți tot.',
			titleAccent: 'Dintr-o privire.',
			text: 'Cifre, curbe, obiective: tablourile dumneavoastră de bord se construiesc cu mouse-ul din tabelele dumneavoastră și rămân la zi de la sine. Un filtru, și tot tabloul urmează.',
			demo: {
				title: 'Pilotaj comercial',
				filters: ['Anul acesta', 'Toate orașele'],
				revenue: 'Cifră de afaceri',
				signed: 'Oferte semnate',
				rate: 'Rata de semnare',
				goal: 'Obiectiv anual',
				byMonth: 'Cifră de afaceri pe lună',
				byStage: 'Oferte pe etapă',
				stages: ['Trimise', 'În discuție', 'Semnate'],
				bySector: 'Clienți pe sector',
				sectors: ['Comerț', 'Sănătate', 'Educație', 'Industrie'],
				shared: 'Partajat printr-un link',
			},
			points: {
				viz: {
					title: 'Cincisprezece reprezentări vizuale',
					text: 'Cifre, tendințe, obiective, curbe, sectoare, pâlnii, tabele încrucișate, hărți.',
				},
				filters: {
					title: 'Filtre comune',
					text: 'Perioada, un client, un oraș: un filtru pilotează un card, mai multe, sau tot tabloul.',
				},
				share: {
					title: 'Partajat printr-un link',
					text: 'Public sau rezervat echipei, și care se poate încorpora în alt site.',
				},
			},
			link: {
				href: '/fonctionnalites/tableaux-de-bord/',
				label: 'Tablourile de bord',
			},
		},
		ai: {
			eyebrow: 'Inteligență artificială',
			title: 'Descrieți.',
			titleAccent: 'basedb construiește.',
			text: 'O frază este suficientă pentru a obține o bază completă, pe care o recitiți înainte de a o crea. Apoi, Copilot propune filtre, grafice și automatizări, iar câmpurile AI rezumă, clasifică și redactează în locul dumneavoastră.',
			prompt: 'O urmărire a candidaturilor pentru cele trei posturi deschise ale noastre, cu interviurile.',
			thinking: 'Trei tabele legate între ele, pregătite de recitit.',
			tables: {
				jobs: {
					name: 'Posturi',
					fields: ['Titlu', 'Departament', 'Deschis la'],
				},
				people: {
					name: 'Candidați',
					fields: ['Nume', 'Post', 'Etapă', 'Sinteză'],
				},
				talks: {
					name: 'Interviuri',
					fields: ['Candidat', 'Data', 'Cu', 'Părere'],
				},
			},
			aiField: 'Sinteză',
			aiValue: 'Șase ani de management de proiect, comunică bine cu clienții; de aprofundat: engleza.',
			create: 'Creați baza',
			providers: 'Cu furnizorul la alegerea dumneavoastră — OpenAI, Anthropic, Mistral, sau un model instalat la dumneavoastră. Nimic nu este trimis fără acordul dumneavoastră.',
			link: {
				href: '/fonctionnalites/ia/',
				label: 'AI-ul în basedb',
			},
		},
		features: {
			title: 'Tot ce aveți nevoie.',
			titleAccent: 'Și mult mai mult.',
			text: 'Fiecare funcție scrie în aceleași tabele, cu aceleași permisiuni, în același istoric.',
			tiles: {
				views: {
					stat: '10',
					title: 'moduri de a vă vedea datele',
					text: 'Grilă, kanban, calendar, cronologie, galerie, listă, hartă, formular, chestionar și quiz, pe aceleași rânduri. Fiecare o alege pe a sa.',
					href: '/fonctionnalites/vues/',
				},
				history: {
					stat: 'Ctrl+Z',
					title: 'Nimic nu se pierde',
					text: 'Fiecare modificare este păstrată împreună cu valoarea de dinainte; o eroare se anulează, un rând șters se restaurează.',
					href: '/fonctionnalites/historique/',
				},
				forms: {
					title: 'Formulare',
					text: 'Un link public sau rezervat echipei: fiecare răspuns ajunge în tabel, fără să deschidă restul.',
					href: '/fonctionnalites/formulaires-partages/',
				},
				viz: {
					stat: '15',
					title: 'reprezentări vizuale',
					text: 'Cifre, tendințe, obiective, curbe, sectoare, pâlnii, tabele încrucișate și hărți.',
					href: '/fonctionnalites/tableaux-de-bord/',
				},
				formulas: {
					code: 'IF([Montant] > 10000, "Grand compte", "")',
					title: 'Formule în franceză sau engleză',
					text: 'Ca într-o foaie de calcul — SI, ARRONDI, JOURS… sau IF, ROUND, DAYS — dar calculate pentru toată echipa.',
					href: '/fonctionnalites/tables-et-champs/#formule',
				},
				rights: {
					title: 'Fiecare vede ce trebuie să vadă',
					text: 'Citire, editare, gestionare, echipă cu echipă; o coloană sensibilă poate fi ascunsă.',
					href: '/fonctionnalites/droits/',
				},
				mentions: {
					bubble: '@Camille',
					title: 'Comentarii și mențiuni',
					text: 'Se discută despre un rând chiar acolo unde se află, iar clopoțelul anunță.',
					href: '/fonctionnalites/collaboration/',
				},
				relations: {
					title: 'Totul este legat',
					text: 'Clienți, proiecte, facturi: totalurile și căutările trec prin relații.',
					href: '/fonctionnalites/tables-et-champs/',
				},
				templates: {
					stat: '10',
					title: 'șabloane pregătite',
					text: 'CRM, recrutare, stocuri, evenimente… sau o bază descrisă AI-ului într-o frază.',
					href: '/modeles/',
				},
				import: {
					title: 'Import într-un gest',
					text: 'Trageți un registru de lucru Excel sau un CSV: coloanele și tipurile sunt ghicite, tabelul este creat.',
					href: '/guides/premiers-pas/',
				},
				agenda: {
					title: 'Până în agenda dumneavoastră',
					text: 'Un calendar devine un flux pentru Google Agenda, Outlook sau Apple Calendar.',
					href: '/fonctionnalites/vues-partagees/',
				},
				files: {
					title: 'Fișiere și imagini',
					text: 'Oferte, fotografii, contracte; o imagine devine coperta unui card.',
					href: '/fonctionnalites/fichiers/',
				},
				share: {
					title: 'Vizualizări partajate',
					text: 'O vizualizare doar în citire, printr-un link, care se poate încorpora în site-ul dumneavoastră.',
					href: '/fonctionnalites/vues-partagees/',
				},
				sync: {
					title: 'Tabele sincronizate',
					text: 'Actualizate dintr-un CSV online, o agendă sau un alt basedb.',
					href: '/integrations/synchronisation/',
				},
				signin: {
					title: 'Conectare simplă',
					text: 'Google, Microsoft sau parolă; colegii sunt invitați printr-un link.',
					href: '/hebergement/connexion/',
				},
				languages: {
					title: 'În limba dumneavoastră',
					text: 'Interfața ia limba fiecăruia, dintre douăzeci.',
					href: '/fonctionnalites/droits/#setările-dumneavoastră',
				},
			},
		},
		yours: {
			eyebrow: 'Liber și auto-găzduit',
			per: 'pe persoană. Pentru totdeauna.',
			text: 'basedb este un software liber. Instalați-l pe propriul dumneavoastră server și invitați toată echipa: fără abonament, fără licențe de numărat, iar datele dumneavoastră rămân la dumneavoastră.',
			points: {
				home: {
					title: 'La dumneavoastră',
					text: 'Pe propriul dumneavoastră server sau cel al furnizorului de găzduire, cu copii de rezervă ca orice bază PostgreSQL.',
				},
				free: {
					title: 'Liber',
					text: 'Sub licența AGPL-3.0: codul este deschis, și va rămâne așa.',
				},
				ai: {
					title: 'AI-ul la alegerea dumneavoastră',
					text: 'Un furnizor de pe piață, un model instalat la dumneavoastră — sau deloc AI.',
				},
			},
			link: {
				href: '/guides/installation/',
				label: 'Instalați basedb',
			},
		},
		gallery: {
			eyebrow: 'Șabloane',
			title: 'Pregătit într-un minut.',
			text: 'Partiți de la un șablon, cu tabelele, vizualizările, tabloul de bord și rândurile de exemplu ale sale, apoi adaptați-l felului dumneavoastră de a lucra.',
			use: 'Descoperiți',
			ask: {
				title: 'Nu se potrivește nimic?',
				text: 'Descrieți-vă nevoia într-o frază: AI-ul vă propune o bază pe măsură.',
			},
			all: 'Vedeți toate șabloanele',
			previous: 'Șabloanele precedente',
			next: 'Șabloanele următoare',
		},
		developers: {
			title: 'Și partea tehnică?',
			text: 'Fiecare tabel este un tabel PostgreSQL real. API REST, webhookuri, server MCP pentru agenții AI, și o instalare printr-o singură comandă.',
			link: 'Pagina dezvoltatorilor',
		},
		faq: {
			title: 'Întrebările dumneavoastră',
			items: [
				{
					q: 'Trebuie să știți să programați?',
					a: 'Nu. Tabelele, vizualizările, formularele, tablourile de bord și automatizările dumneavoastră se creează cu mouse-ul. Formulele se scriu ca într-o foaie de calcul, în franceză sau în engleză: SI sau IF, ARRONDI sau ROUND, JOURS sau DAYS…',
				},
				{
					q: 'Cât costă?',
					a: 'Nimic: basedb este un software liber, fără abonament sau preț pe persoană. Aveți nevoie doar de un server pe care să îl instalați.',
				},
				{
					q: 'Cum se instalează?',
					a: 'Pe un server, cu Docker: două fișiere și o comandă, câteva minute pentru persoana care se ocupă de partea informatică. Ghidul de instalare explică totul, pas cu pas.',
				},
				{
					q: 'Putem prelua foile noastre de calcul?',
					a: 'Da: trageți registrul dumneavoastră de lucru Excel, sau un CSV, în basedb. Importul ghicește tipul fiecărei coloane, creează tabelul și spune, rând cu rând, ce nu a putut prelua.',
				},
				{
					q: 'Se poate lucra cu mai multe persoane, în același timp?',
					a: 'Exact pentru asta este făcut. Modificările celorlalți apar în timp real, comentați un rând, menționați un coleg cu @, iar un clopoțel vă anunță.',
				},
				{
					q: 'Iar AI-ul, ne citește datele?',
					a: 'Doar dacă decideți dumneavoastră. Fără un furnizor de AI configurat, nimic nu pleacă. Apoi, un câmp sau o automatizare care apelează AI-ul trimite doar ce citează instrucțiunea sa, după acordul dumneavoastră.',
				},
				{
					q: 'În ce limbă?',
					a: 'În a dumneavoastră: interfața preia limba browserului dumneavoastră, dintre douăzeci, iar fiecare o poate schimba în setările sale.',
				},
			],
		},
		cta: {
			title: 'Echipa dumneavoastră merită mai bine',
			titleAccent: 'decât un fișier partajat.',
			text: 'Partiți de la un șablon, invitați-vă colegii, și lăsați „FINAL (2)” în urmă.',
			primary: 'Descoperiți șabloanele',
			secondary: 'Instalați basedb',
		},
	},
	hero: {
		badge: 'Nou: automatizări în flux, tablouri de bord și vizualizări SQL',
		title: ['Baza colaborativă', 'în care fiecare tabel', 'este un tabel'],
		titleAccent: 'PostgreSQL real.',
		lead: 'Simplitatea unei foi de calcul partajate — grile, vizualizări, formulare, permisiuni — și date care trăiesc în tabele <strong>tipizate și cu nume clare</strong>. Echipa dumneavoastră lucrează în interfață; scripturile, instrumentele de BI, agenții AI și <code>psql</code> citesc aceleași rânduri.',
		install: 'Instalați cu Docker',
		features: 'Vedeți funcționalitățile',
		copy: 'Copiați comanda',
		facts: ['Auto-găzduit', 'AGPL-3.0', 'API REST și server MCP'],
		demo: {
			url: 'basedb.domeniul-dvs.ro',
			project: 'Proiect principal',
			projectMeta: 'Proiect · 2 baze',
			filter: 'Filtrați bazele și tabelele',
			sales: 'Vânzări',
			support: 'Asistență',
			environment: 'Producție',
			clients: 'Clienți',
			opportunities: 'Oportunități',
			quotes: 'Oferte',
			baseSection: 'Bază · Vânzări',
			screens: ['Tablouri de bord', 'Automatizări'],
			copilot: '✦ Copilot',
			allRows: '▦ Toate rândurile ▾',
			tools: ['Filtrați', 'Grupați', 'Culori'],
			search: 'Căutați…',
			add: '+ Adăugați',
			columns: {
				name: 'Nume',
				status: 'Status',
				amount: 'Sumă',
				client: 'Client',
			},
			statuses: {
				nouveau: 'Nou',
				qualifie: 'Calificat',
				proposition: 'Propunere',
				negociation: 'Negociere',
				gagne: 'Câștigat',
				perdu: 'Pierdut',
			},
			deals: {
				portail: {
					name: 'Refacerea portalului',
					client: 'Primăria Pădureni',
				},
				erp: {
					name: 'Migrare ERP',
					client: 'Grupul Delorme',
				},
				audit: {
					name: 'Audit de securitate',
					client: 'Clinica Sfântul Roc',
				},
				billetterie: {
					name: 'Bilete online',
					client: 'Teatrul Rotonda',
				},
				flotte: {
					name: 'Monitorizarea flotei',
					client: 'Transporturi Kerlann',
				},
				mobile: {
					name: 'Aplicație mobilă',
					client: 'Atelierul Moreau',
				},
				intranet: {
					name: 'Refacerea intranetului',
					client: '',
				},
			},
			toastTitle: 'Formularul „Cerere de ofertă”',
			toastText: 'răspuns public · a creat „{name}”',
			cursor: 'Camille',
			psqlRows: '(2 rânduri)',
		},
	},
	showcase: {
		label: 'Interfața, așa cum este',
		title: 'Tot ce așteaptă echipa dumneavoastră de la o foaie de calcul partajată.',
		tabs: 'Capturi de ecran ale interfeței',
		alt: 'basedb — {labelLower}: {caption}',
		shots: {
			grille: {
				label: 'Grilă',
				caption: 'O grilă care scrie într-un tabel real — și câmpuri calculate: o durată printr-o formulă, orașul clientului printr-o căutare, numărul de sarcini printr-o numărare.',
			},
			kanban: {
				label: 'Kanban',
				caption: 'Aceleași rânduri pe coloane, după o selecție unică: o imagine de copertă, o descriere care citează rândul. A muta un card înseamnă a modifica rândul.',
			},
			galerie: {
				label: 'Galerie',
				caption: 'Carduri cu imaginea lor, o culoare pe status: galeria, una dintre cele opt moduri de a citi un tabel.',
			},
			chronologie: {
				label: 'Cronologie',
				caption: 'Bare între două date și săgețile dependențelor lor — cu roșu când ordinea nu mai este respectată.',
			},
			tableaux: {
				label: 'Tablouri de bord',
				caption: 'Carduri în grilă, în file, sub filtre comune: o tendință, un obiectiv, serii stivuite — citite cu permisiunile fiecăruia.',
			},
			automatisations: {
				label: 'Automatizări',
				caption: 'Când o sarcină este finalizată, se caută ce a mai rămas din proiect; dacă nu mai rămâne nimic, AI-ul redactează mesajul de bilanț și proiectul trece la „Livrat”. Fiecare execuție se citește pe flux, pas cu pas.',
			},
			commentaires: {
				label: 'Comentarii',
				caption: 'Discutați despre un rând chiar acolo unde se află: comentarii, mențiuni, notificări.',
			},
			formulaire: {
				label: 'Formular',
				caption: 'Un formular se partajează printr-un link, public sau rezervat membrilor conectați.',
			},
			historique: {
				label: 'Istoric',
				caption: 'Fiecare scriere, oricare i-ar fi sursa — o persoană, o automatizare, SQL direct — cu valorile de dinainte.',
			},
			sql: {
				label: 'SQL',
				caption: 'O interogare pe numele reale, salvată sub tabele pentru toată echipa — pe care fiecare o execută cu propriile permisiuni.',
			},
			vuesSql: {
				label: 'Vizualizări SQL',
				caption: 'Vizualizări PostgreSQL reale, așezate printre tabele cu culoarea și pictograma lor — și care pot fi citite din psql.',
			},
		},
	},
	features: {
		postgres: {
			label: 'PostgreSQL, fără traducere',
			title: 'O grilă pentru echipă, un tabel real {pentru toate instrumentele.}',
			lead: 'Niciun model generic, niciun JSON în care încape orice, niciun <code>field_1837</code>: o bază este o schemă, un tabel este un tabel, un câmp este o coloană tipizată, cu un nume clar.',
			bullets: [
				'<strong>Tipuri native</strong>: <code>text</code>, <code>numeric</code>, <code>date</code>, <code>timestamptz</code>, <code>boolean</code> — și chei străine reale pentru relații.',
				'<strong>Constrângeri garantate de baza de date</strong>: selecții unice ca <code>CHECK</code>, adrese web și e-mailuri verificate, relații ca <code>FOREIGN KEY</code>.',
				'<strong>Formule calculate de PostgreSQL</strong>: <code>JOURS([Fin]; [Début])</code> devine o coloană generată, pe care <code>psql</code> o citește ca pe oricare alta.',
				'<strong>SQL-ul direct rămâne permis</strong> — și chiar și el intră în istoric, printr-un trigger.',
				'<strong>Interogări și vizualizări SQL</strong> în interfață: interogări salvate sub tabele, pentru dumneavoastră sau pentru echipă, și vizualizări PostgreSQL reale așezate printre ele, pe care le citește și <code>psql</code>.',
				'<strong>A redenumi nu înseamnă a strica</strong>: vechiul nume rămâne disponibil printr-un alias de compatibilitate, cât timp vă migrați interogările.',
			],
			links: [
				{
					href: '/integrations/sql/',
					label: 'Lucrul în SQL',
				},
				{
					href: '/fonctionnalites/requetes-et-vues-sql/',
					label: 'Interogări și vizualizări SQL',
				},
				{
					href: '/architecture/principes/',
					label: 'Principiile',
				},
			],
		},
		automations: {
			label: 'Automatizați',
			title: 'Automatizări în flux, {AI la fiecare pas.}',
			lead: 'Când un rând se schimbă, la oră fixă sau cu un clic: un editor de tip graf înlănțuie pașii, iar fiecare execuție poate fi revăzută pe flux.',
			bullets: [
				'<strong>Un flux lizibil</strong>: declanșatorul, apoi fiecare pas pe câte un card; un <strong>+</strong> pe o linie adaugă un pas chiar în acel loc.',
				'<strong>Căutați, decideți, scrieți</strong>: găsiți un rând, luați o ramură sau alta în funcție de condiții, modificați, creați, anunțați, apelați un webhook, scrieți pe Slack.',
				'<strong>Întrebați AI</strong> într-un pas: o instrucțiune care citează rândul, un răspuns citit ca text, număr, dată sau opțiune, pe care pașii următori îl reutilizează.',
				'<strong>Copilot</strong> propune o automatizare întreagă pornind de la o singură frază sau explică de ce a eșuat o execuție — nimic nu se salvează fără dumneavoastră.',
				'<strong>Cu permisiunile celui care a scris-o</strong> și în istoric, ca orice altă scriere.',
			],
			links: [
				{
					href: '/fonctionnalites/automatisations/',
					label: 'Automatizările',
				},
				{
					href: '/fonctionnalites/automatisations/#copilot',
					label: 'Copilot',
				},
			],
			alt: 'basedb — automatizarea „Proiect livrat” în editorul de flux: când o sarcină este finalizată, se notează ora, se caută ce a mai rămas din proiect, se ia ramura „Altfel”, se cere AI-ului mesajul de bilanț, apoi proiectul este livrat; în dreapta, ultimele sale execuții, pas cu pas.',
		},
		dashboards: {
			label: 'Analizați',
			title: 'Tablouri de bord {fără să vă părăsiți tabelele.}',
			lead: 'Întrebări formulate cu mouse-ul sau în SQL, cincisprezece reprezentări vizuale, filtre comune — fiecare le citește cu propriile permisiuni.',
			bullets: [
				'<strong>Întrebări</strong>: un tabel și tabelele unite cu el, filtre și măsuri pe zi, săptămână, lună sau an — ori SQL doar în citire.',
				'<strong>Cincisprezece reprezentări vizuale</strong>: cifră, tendință, obiectiv, cadran, bare, linii, sectoare, pâlnie, tabel pivot, hartă…',
				'<strong>Explorare cu un clic</strong>: un punct își deschide rândurile sau o perioadă mai fină.',
				'<strong>Filtre comune</strong> care controlează unul, mai multe sau toate cardurile.',
				'<strong>Partajare printr-un link</strong>, public sau rezervat membrilor, și încorporare în alt site.',
			],
			links: [
				{
					href: '/fonctionnalites/tableaux-de-bord/',
					label: 'Tablourile de bord',
				},
			],
			alt: 'basedb — un tablou de bord: tendința lunii, obiectivul de încasări, cifra de afaceri pe lună, sentimentul recenziilor, sub filtre de perioadă și de client.',
		},
		rights: {
			label: 'Colaborați fără a deschide totul',
			title: 'Permisiuni până la nivel de câmp, {un istoric fără goluri.}',
			lead: 'Permisiunile se acordă grupurilor, pe un proiect, o bază sau un tabel, și coboară asupra a tot ce se află dedesubt. O coloană sensibilă poate fi ascunsă unui grup sau făcută nemodificabilă pentru el.',
			bullets: [
				'<strong>Patru niveluri</strong>: Fără acces, Citire, Editare, Gestionare — cumulative de la un grup la altul.',
				'<strong>Chiar și SQL-ul respectă permisiunile dumneavoastră</strong>: în interfață, o interogare vede doar tabelele și câmpurile care vă sunt deschise — iar PostgreSQL este cel care aplică regula.',
				'<strong>Fiecare scriere este capturată</strong> în tranzacția ei: interfață, API, agent, formular public sau SQL direct.',
				'<strong>O modificare se poate anula</strong>, un rând șters se poate restaura, la fel și o bază ștearsă.',
				'<strong>Administrarea cere confirmare</strong>: schimbarea unei permisiuni cere ca parola să fi fost reintrodusă în ultimele cinci minute.',
			],
			links: [
				{
					href: '/fonctionnalites/droits/',
					label: 'Permisiuni și grupuri',
				},
				{
					href: '/fonctionnalites/historique/',
					label: 'Istoricul',
				},
			],
		},
		agents: {
			label: 'API REST · MCP · webhookuri',
			title: 'Agenții AI primesc acces la date, {nu cheile castelului.}',
			lead: 'Serverul MCP le oferă agenților douăsprezece instrumente; API-ul REST oferă aceleași date programelor dumneavoastră. Un singur punct de control al permisiunilor, aceleași jurnale.',
			bullets: [
				'<strong>Un token pentru fiecare bază</strong>, implicit doar în citire, niciodată cu mai multe permisiuni decât persoana care l-a creat.',
				'<strong>Un agent nu șterge nimic</strong> și nu schimbă structura: o propune, iar o persoană aprobă.',
				'<strong>O documentație generată</strong> pentru fiecare bază, filtrată după permisiunile dumneavoastră, cu specificația ei OpenAPI 3.1.',
				'<strong>Webhookuri</strong> semnate, ordonate și reîncercate, la fiecare scriere.',
			],
			links: [
				{
					href: '/integrations/mcp/',
					label: 'Conectați un agent',
				},
				{
					href: '/integrations/api-rest/',
					label: 'API-ul REST',
				},
			],
		},
	},
	sqlVisual: {
		interface: 'Interfață',
		title: 'Câmp nou · Oportunități',
		labelField: 'Etichetă',
		labelValue: 'Sumă',
		typeField: 'Tip',
		typeValue: 'Număr',
		descriptionField: 'Descriere',
		descriptionValue: 'Valoarea contractului, fără TVA',
		required: 'Obligatoriu',
		ai: 'AI',
		migration: 'o migrare planificată, blocări scurte',
	},
	rightsVisual: {
		groups: ['Administratori', 'Comerciali', 'Asistență'],
		project: 'Proiect principal',
		sales: 'Vânzări',
		opportunities: 'Oportunități',
		clients: 'Clienți',
		support: 'Asistență',
		inherited: 'moștenit',
		levels: {
			none: 'Fără acces',
			read: 'Citire',
			edit: 'Editare',
			manage: 'Gestionare',
		},
		field: 'Câmpul „Marjă”',
		hidden: 'Ascuns',
		sqlChange: '<b>Sesiune SQL directă</b> a modificat <b>„Migrare ERP”</b>',
		sqlMeta: '02:46 · conexiune locală · psql',
		sqlDiff: 'Sumă: <s>125.000</s> → 130.000',
		undo: '↶ Anulați',
		formChange: '<b>Formularul „Cerere de ofertă”</b> a creat <b>„Refacerea intranetului”</b>',
		formMeta: 'răspuns public · publicat de Camille',
	},
	agentVisual: {
		agent: 'Agent',
		via: 'conectat prin MCP · tokenul „Vânzări”',
		question: 'Câte oportunități sunt în negociere și pentru ce sumă?',
		listArgs: 'opportunites · statut = Negociere',
		answer: 'Două oportunități, <b>182.000 €</b> în total: Migrare ERP (130.000 €) și Monitorizarea flotei (52.000 €).',
		request: 'Adaugă un câmp „Probabilitate”, în procente.',
		proposeArgs: 'opportunites · Probabilitate · number',
		proposed: 'Am trimis propunerea: o persoană din echipă trebuie să o aprobe în basedb.',
		badge: 'Propunere',
		expires: 'expiră în 23 h',
		what: 'Adăugarea câmpului <b>„Probabilitate”</b> (Număr) în <b>Oportunități</b>',
		by: 'Propusă de agent · tokenul „Vânzări”',
		refuse: 'Refuzați',
		approve: 'Aprobați',
	},
	bento: {
		label: 'Și tot restul',
		title: 'Ce așteptați de la un instrument de echipă, fără să renunțați la PostgreSQL.',
		text: 'Fiecare funcție scrie în aceleași tabele, cu aceleași permisiuni, în același istoric.',
		more: 'Aflați mai multe →',
		views: {
			title: 'Zece vizualizări ale acelorași rânduri',
			text: 'Colaborative pentru toată echipa sau personale, doar pentru dumneavoastră: fiecare își alege felul de a citi, nimeni nu copiază datele.',
			chips: ['Grilă', 'Kanban', 'Calendar', 'Cronologie', 'Galerie', 'Listă', 'Hartă', 'Formular', 'Chestionar', 'Quiz'],
		},
		forms: {
			title: 'Formulare partajate',
			text: 'Un link public sau rezervat membrilor conectați. A răspunde nu oferă nicio permisiune asupra tabelului.',
			href: '/fonctionnalites/formulaires-partages/',
		},
		environments: {
			title: 'Medii',
			text: 'O bază, mai multe variante. Comparați structura, migrați de la una la alta, sincronizați rânduri.',
			chips: ['Producție', 'Testare', 'Dezvoltare'],
			href: '/fonctionnalites/environnements/',
		},
		collaboration: {
			title: 'Lucrul împreună',
			text: 'Scrierile celorlalți sosesc în timp real, vedeți cine se uită la ce rând și discutați despre el chiar acolo unde se află: comentarii, mențiuni, notificări. Ctrl+Z anulează ultima scriere și refuză în loc să suprascrie munca altcuiva.',
			chips: ['Timp real', 'Prezență', 'Comentarii', 'Mențiuni', 'Ctrl+Z'],
			href: '/fonctionnalites/collaboration/',
		},
		small: {
			ai: {
				title: 'AI în grilă',
				text: 'Un câmp completat de un model pornind de la celelalte coloane și un Copilot care propune filtre, interogări și coloane, aplicate cu un clic. OpenAI, Anthropic, Mistral, sau un model servit pe propriul dumneavoastră server.',
				code: 'Rezumă {{Notes}} într-o frază',
				href: '/fonctionnalites/ia/',
			},
			formulas: {
				title: 'Relații și formule',
				text: 'Chei străine reale, formule în franceză sau în engleză calculate de PostgreSQL și căutări, agregări și numărări prin relații.',
				code: 'ROUND([Montant HT] * (1 + [Taux de TVA]), 2)',
				href: '/fonctionnalites/tables-et-champs/#formule',
			},
			richText: {
				title: 'Text formatat și variabile',
				text: 'Un editor vizual pentru textul formatat, curățat la scriere; iar în orice text lung, {{Ville}} se citește cu valoarea din rând.',
				code: 'Livrare pe {{Date}} la {{Ville}}',
				href: '/fonctionnalites/tables-et-champs/#text-formatat-și-variabile',
			},
			languages: {
				title: 'În limba dumneavoastră',
				text: 'Interfața preia limba browserului, dintre douăzeci; fiecare o poate schimba în setările sale.',
				href: '/fonctionnalites/droits/#setările-dumneavoastră',
			},
			sharedViews: {
				title: 'Vizualizări partajate',
				text: 'O vizualizare doar în citire, printr-un link, care se poate încorpora în alt site; un calendar devine un flux pentru agenda dumneavoastră.',
				href: '/fonctionnalites/vues-partagees/',
			},
			syncedTables: {
				title: 'Tabele sincronizate',
				text: 'Un tabel actualizat dintr-un CSV online, dintr-o agendă sau din vizualizarea partajată a unui alt basedb.',
				href: '/integrations/synchronisation/',
			},
			templates: {
				title: 'Șabloane pentru baze',
				text: 'Zece șabloane gata de folosit, o bază descrisă AI-ului într-o frază și propria bază salvată ca șablon.',
				href: '/modeles/',
			},
			files: {
				title: 'Fișiere și imagini',
				text: 'Pe discul gazdei sau într-un spațiu de stocare compatibil S3: AWS, Scaleway, OVH, Cloudflare R2, Garage, MinIO…',
				href: '/fonctionnalites/fichiers/',
			},
			import: {
				title: 'Import Excel, CSV și JSON',
				text: 'Trageți un fișier: importul ghicește tipurile, creează tabelul sau completează un tabel existent și spune rând cu rând ce a fost refuzat.',
				href: '/guides/premiers-pas/',
			},
			accounts: {
				title: 'Conturi și invitații',
				text: 'Fiecare își creează contul și proiectele și invită printr-un link, cu Citire, Editare sau Gestionare; conectare cu parolă, Google, Microsoft sau orice furnizor OpenID Connect.',
				href: '/hebergement/connexion/',
			},
			webhooks: {
				title: 'Webhookuri',
				text: 'Fiecare scriere poate anunța un alt sistem: apeluri semnate, livrate în ordine, reîncercate.',
				href: '/integrations/webhooks/',
			},
			settings: {
				title: 'Setări personale',
				text: 'Limba, tema, ordinea datelor, notificările, sesiunile și tokenurile dumneavoastră, în același loc.',
				href: '/fonctionnalites/droits/#setările-dumneavoastră',
			},
		},
	},
	selfHost: {
		label: 'Auto-găzduit',
		title: 'Datele rămân {la dumneavoastră.}',
		lead: 'basedb este software liber (AGPL-3.0): o singură imagine, o bază de date PostgreSQL și atât — niciun serviciu terț impus, nicio telemetrie. Faceți-i copii de rezervă cu <code>pg_dump</code>, citiți-l cu orice client PostgreSQL.',
		services: {
			db: 'PostgreSQL 16, datele dumneavoastră',
			basedb: 'Interfața, API-ul REST și serverul MCP, pe un singur port',
			proxy: 'Caddy, HTTPS automat (opțional)',
		},
		links: [
			{
				href: '/hebergement/docker/',
				label: 'Ghidul Docker Compose →',
			},
			{
				href: '/hebergement/variables/',
				label: 'Toate variabilele →',
			},
		],
		steps: [
			{
				title: 'Obțineți basedb',
				code: 'git clone https://github.com/eodia/basedb.git\ncd basedb && cp .env.example .env',
			},
			{
				title: 'Două secrete în .env',
				code: 'POSTGRES_PASSWORD=o-parola-puternica\n# openssl rand -base64 32\nBASEDB_ENCRYPTION_KEY=…',
			},
			{
				title: 'Porniți',
				code: 'docker compose up -d\n# apoi http://localhost:3000: creați-vă contul',
			},
		],
	},
	faq: {
		label: 'Întrebări frecvente',
		title: 'Întrebările pe care le primim des.',
		text: 'Altă întrebare? <a href="/guides/introduction/">Documentația</a> are, cu siguranță, răspunsul.',
		items: {
			difference: {
				q: 'Prin ce diferă basedb de alte baze de date colaborative?',
				a: 'Prin locul în care stau datele. Acolo unde altele vă păstrează rândurile într-un model generic (coloane numerotate, documente JSON), basedb creează un tabel PostgreSQL real pentru fiecare tabel și o coloană tipizată reală pentru fiecare câmp, cu nume lizibile. Datele rămân utilizabile și fără basedb.',
			},
			sql: {
				q: 'Pot scrie direct în SQL în tabele?',
				a: 'Da. Constrângerile (tipuri, obligatoriu, selecții unice, chei străine) sunt garantate chiar de PostgreSQL, iar un trigger înregistrează în istoric chiar și scrierile făcute prin SQL direct, împreună cu sesiunea care le-a făcut. Consola SQL a interfeței și psql citesc aceleași tabele; în interfață, fiecare scrie SQL cu propriile permisiuni, își salvează interogările și, dacă gestionează baza, le transformă în vizualizări PostgreSQL reale.',
			},
			ai: {
				q: 'Ce ajunge la un furnizor de AI?',
				a: 'Nimic, cât timp nu ați configurat un furnizor. După aceea, pentru ciornele de structură și Copilot, implicit pleacă doar structura și fraza dumneavoastră; citirea datelor de către Copilot este o casetă de bifat, pentru fiecare conversație. Un șablon de bază cerut AI-ului trimite doar fraza dumneavoastră. Un câmp AI trimite coloanele pe care le citează instrucțiunea sa, după un consimțământ explicit.',
			},
			together: {
				q: 'Pot lucra mai multe persoane pe același tabel?',
				a: 'Da. Scrierile celorlalți apar fără reîncărcare, cu avatarul lor pe tabelul sau pe rândul la care se uită. Comentați un rând, menționați pe cineva cu @, iar clopoțelul îl anunță. Iar Ctrl+Z anulează doar propriile scrieri: refuză în loc să suprascrie ce a schimbat altcineva între timp.',
			},
			languages: {
				q: 'În ce limbi?',
				a: 'Douăzeci: franceză, engleză, germană, spaniolă, italiană, portugheză braziliană, neerlandeză, poloneză, cehă, suedeză, daneză, norvegiană, finlandeză, română, maghiară, turcă, ucraineană, japoneză, chineză simplificată și coreeană. Interfața preia limba browserului, iar fiecare o poate schimba în setările sale; acest site și documentația există în aceleași limbi.',
			},
			agent: {
				q: 'Cum se conectează un agent AI?',
				a: 'Prin serverul MCP, cu un token de integrare limitat la o bază, implicit doar în citire. Un agent citește, creează și modifică rânduri în limita permisiunilor sale; nu șterge nimic și nu schimbă structura: o propune, iar o persoană aprobă.',
			},
			postgres: {
				q: 'Ce versiune de PostgreSQL este necesară?',
				a: 'PostgreSQL 16 sau mai nou, cu extensiile pg_trgm și unaccent (disponibile în imaginea oficială). docker-compose-ul furnizat pornește un PostgreSQL 16; puteți, de asemenea, să direcționați DATABASE_URL către propriul server.',
			},
			production: {
				q: 'Este pregătit pentru producție?',
				a: 'basedb se află în dezvoltare activă: nucleul, API-ul, serverul MCP și interfața funcționează și sunt acoperite de peste o mie de teste, dar unele funcții urmează să apară (vedeți foaia de parcurs). Încercați-l și faceți copii de rezervă ale bazei, ca pentru orice bază de date PostgreSQL.',
			},
			license: {
				q: 'Sub ce licență?',
				a: 'AGPL-3.0-or-later. Îl puteți folosi, modifica și găzdui liber; dacă oferiți o versiune modificată ca serviciu, îi partajați sursele.',
			},
		},
	},
	cta: {
		title: 'Datele dumneavoastră merită {tabele reale.}',
		text: 'Instalați basedb în câteva minute, invitați-vă echipa și păstrați controlul asupra fiecărui rând.',
		install: 'Instalați basedb',
		github: 'Vedeți codul pe GitHub',
	},
	changelog: {
		label: 'Noutăți',
		title: 'Ce s-a schimbat în basedb',
		intro: 'Detaliile fiecărei schimbări se află în <a href="https://github.com/eodia/basedb/commits/main">istoricul depozitului</a>. Ce urmează: <a href="/feuille-de-route/">foaia de parcurs</a>.',
		entries: {
			applications: {
				date: '2026-09-30',
				title: 'Pentru aplicațiile care se bazează pe basedb',
				tag: 'Nou',
				items: [
					'<strong>O bază creată dintr-un model printr-un singur apel</strong>: serverul aplică tot modelul — tabele, relații, rânduri, vizualizări, automatizări —, sau nimic dacă un pas eșuează. Galeria recurge și ea la el, o aplicație care se instalează tot așa. <a href="/integrations/api-rest/#crearea-unei-baze-dintr-un-model">Crearea unei baze dintr-un model</a>',
					'<strong>Verificarea unui token</strong>: o aplicație căreia i se transmite tokenul unei persoane întreabă basedb dacă acesta este încă valid, și pentru cine — contul său, grupurile sale. <a href="/integrations/api-rest/#verificarea-unui-token">Verificarea unui token</a>',
					'<strong>Serverele dumneavoastră interne</strong>: webhookurile și automatizările contactează pe cele pe care le indicați în <code>BASEDB_WEBHOOK_ALLOW</code>, HTTP inclus; un program poate și el urmări un tabel în timp real cu un token de integrare. <a href="/integrations/webhooks/#fără-webhook-urmărirea-unui-tabel">Urmărirea unui tabel</a>',
					'<strong>Sub o cale, în spatele unei porți de acces</strong>: basedb se publică la o adresă precum <code>https://passerelle.example.com/basedb/</code>, fie că poarta de acces păstrează calea, fie că o elimină. <a href="/hebergement/docker/#în-spatele-unei-porți-de-acces-sub-o-cale">În spatele unei porți de acces</a>',
					'<strong>Un webhook, toate tabelele dintr-o dată</strong>: bifați sau debifați un eveniment pentru toate tabelele, sau toate evenimentele unui tabel, cu un clic.',
				],
			},
			loopsWebhooks: {
				date: '2026-09-30',
				title: 'Automatizări care vă parcurg rândurile și vorbesc cu API-uri',
				tag: 'Nou',
				items: [
					'<strong>Pentru fiecare rând</strong>: un pas care își repetă pașii pe fiecare rând dintr-un tabel care răspunde unui filtru — în fiecare luni, retrimiteți toate facturile neplătite, nu doar prima. <a href="/fonctionnalites/automatisations/#pentru-fiecare-rând">Pentru fiecare rând</a>',
					'<strong>Un webhook care vorbește cu orice API</strong>: metoda, o adresă care citează rândul, anteturi, un corp în JSON, sub formă de formular sau de text, compus cu valorile rândului. <a href="/fonctionnalites/automatisations/#apelați-un-serviciu">Apelați un serviciu</a>',
					'<strong>O cheie de API rămâne secretă</strong>: criptată, nu mai este afișată niciodată — nici pe ecran, nici de API, nici de Copilot — și pleacă doar către gazda pentru care ați dat-o.',
				],
			},
			maps: {
				date: '2026-09-30',
				title: 'Harta, și adrese care își găsesc locul',
				tag: 'Nou',
				items: [
					'<strong>O a zecea vizualizare, harta</strong>: fiecare rând așezat la locul lui, după adresa sa sau după latitudinea și longitudinea sa. Un pin ia culoarea unui statut și deschide fișa dintr-un clic. <a href="/fonctionnalites/vues/#hartă">Harta</a>',
					'<strong>O adresă este localizată o singură dată pentru totdeauna</strong>, de serviciul OpenStreetMap sau de cel pe care îl alegeți: pinii apar pe măsura răspunsurilor, apoi imediat. O adresă negăsită este numărată, niciodată înlăturată în tăcere.',
					'<strong>Formatul Adresă</strong> pentru un text scurt: un clic îl deschide pe hartă, iar în fișă, <strong>Găsiți adresa</strong> propune adresele complete care corespund. <a href="/fonctionnalites/tables-et-champs/#formate-de-afișare">Formatele</a>',
				],
			},
			documents: {
				date: '2026-09-30',
				title: 'PDF-uri din rândurile dumneavoastră',
				tag: 'Nou',
				items: [
					'<strong>Un deviz, o factură, o fișă în PDF</strong>, din meniul unui rând: fișa imprimabilă fără nimic de reglat, sau un model — texte care citează câmpurile, câmpurile rândului, tabelul rândurilor legate cu totalul lor, întreruperi de pagină. <a href="/fonctionnalites/documents/">Documentele</a>',
					'<strong>Fiecare cu permisiunile sale</strong>: un câmp ascuns pentru dumneavoastră nu apare în PDF-ul dumneavoastră. Cele douăzeci de limbi se scriu acolo, chineza, japoneza și coreeana incluse, iar API-ul redă același document.',
				],
			},
			rows: {
				date: '2026-09-30',
				title: 'Drepturi până la nivel de rând, valori implicite, importul Excel',
				tag: 'Nou',
				items: [
					'<strong>Fiecare cu rândurile sale</strong>: un grup vede doar rândurile unui filtru — „Comercial sunt eu”, „Regiune este Nord” —, în interfață, în API, în serverul MCP ca și în SQL, unde PostgreSQL aplică aceeași regulă. <a href="/fonctionnalites/droits/#până-la-nivel-de-rând">Până la nivel de rând</a>',
					'<strong>Valori implicite</strong>: o valoare fixă, data de astăzi, momentul creării sau persoana care creează rândul, precompletate pe ecran și aplicate peste tot în altă parte. <a href="/fonctionnalites/tables-et-champs/#valori-implicite">Valori implicite</a>',
					'<strong>Trageți un registru de lucru Excel</strong>: alegeți foaia, datele, sumele și casetele de selectare sunt reluate ca atare, iar o formulă își dă valoarea. <a href="/guides/premiers-pas/">Primii pași</a>',
				],
			},
			mail: {
				date: '2026-09-30',
				title: 'E-mailuri',
				tag: 'Nou',
				items: [
					'<strong>Un pas „Trimiteți un e-mail”</strong> în automatizări: unui membru, persoanei dintr-un câmp, adresei unui client, cu valorile rândului în subiect și în text. <a href="/fonctionnalites/automatisations/">Automatizările</a>',
					'<strong>Notificările prin e-mail</strong> când nu le-ați citit, grupate, de ales una câte una în setările dumneavoastră; iar <strong>parola uitată</strong> se resetează printr-un link. <a href="/fonctionnalites/collaboration/#prin-e-mail">Prin e-mail</a>',
					'Este suficient să indicați instanței serverul de trimitere al mesageriei dumneavoastră. <a href="/hebergement/variables/#e-mailuri">Variabilele</a>',
				],
			},
			integrations: {
				date: '2026-09-30',
				title: 'n8n și un SDK TypeScript',
				tag: 'Nou',
				items: [
					'<strong>Noduri n8n</strong>: citiți și scrieți rândurile unui tabel dintr-un flux de lucru, și lansați unul la fiecare rând creat, modificat sau șters — prin verificare sau prin webhook semnat. <a href="/integrations/n8n/">n8n</a>',
					'<strong>Un SDK TypeScript</strong>, cu tipurile tabelelor dumneavoastră generate din instanța dumneavoastră: un tabel sau un câmp care nu există este o eroare chiar înainte de execuție. <a href="/integrations/sdk/">SDK-ul</a>',
				],
			},
			quiz: {
				date: '2026-09-29',
				title: 'Quizul: întrebări care numără punctele',
				tag: 'Nou',
				items: [
					'<strong>O nouă vizualizare, quizul</strong>: un chestionar în care fiecare întrebare poate avea răspunsul ei corect și punctele ei — o opțiune, mai multe, da sau nu, un număr, o dată, sau textele acceptate, fără a ține cont de majuscule sau de diacritice. <a href="/fonctionnalites/vues/#quiz">Quizul</a>',
					'<strong>Corectat cum doriți</strong>: după fiecare întrebare — verde, sau roșu cu răspunsul corect, punctajul care crește în partea de sus a ecranului —, la final, sau niciodată. Un prag de promovare face ecranul să spună „Promovat!” sau „Nu de data aceasta…”.',
					'<strong>Punctajul la final</strong>, într-un inel care se umple, apoi corectarea fiecărei întrebări. Se scrie într-un câmp număr al tabelului: sortați grila după el, iată clasamentul.',
					'<strong>Partajat printr-un link, fără trișare</strong>: pagina nu primește niciun răspuns corect, serverul este cel care corectează și numără. <a href="/fonctionnalites/formulaires-partages/#un-quiz-partajat">Un quiz partajat</a>',
					'<strong>Creați o vizualizare</strong>, în partea de jos a selectorului de vizualizări, așază cele nouă tipuri în două familii — cele care arată rândurile, cele care colectează răspunsuri —, fiecare cu iconița ei colorată.',
				],
			},
			forms: {
				date: '2026-09-29',
				title: 'Formulare pe care ai chef să le completezi',
				tag: 'Nou',
				items: [
					'<strong>Chestionarul ocupă tot ecranul</strong>: câte o întrebare pe rând, care apare alunecând, carduri mari pentru alegeri, stele pentru o notă, și totul de la tastatură — <strong>Enter</strong>, literele A, B, C…, D sau N, cifrele. O alegere unică trece singură la următoarea. <a href="/fonctionnalites/vues/#formular-și-chestionar">Formular și chestionar</a>',
					'<strong>O înfățișare a ta</strong>: opt teme, de la Luminoasă la Noapte, trecând prin Hârtie, o culoare, un font, o aliniere — o poartă și pagina unui link partajat.',
					'<strong>Întrebați doar dacă…</strong>: o întrebare se pune doar dacă un răspuns anterior o cere; o întrebare ascunsă nu este nici obligatorie, nici înregistrată.',
					'<strong>Nimic de reglat pentru a începe</strong>: un formular nou întreabă ce răspunde o persoană, nu starea pe care o completează echipa ulterior, poartă culoarea tabelului său și arată un exemplu în fiecare câmp. Iar trimiterea se sărbătorește, confetti inclus.',
				],
			},
			formulaLanguages: {
				date: '2026-09-28',
				title: 'Formule în franceză sau în engleză',
				tag: 'Nou',
				items: [
					'<strong>Tastați o formulă în franceză sau în engleză</strong>, pe orice ecran, chiar și combinând cele două limbi: <code>SI</code> sau <code>IF</code>, <code>ARRONDI</code> sau <code>ROUND</code>, <code>JOURS</code> sau <code>DAYS</code>… Argumentele se separă prin <code>;</code> sau prin <code>,</code>. <a href="/fonctionnalites/tables-et-champs/#formule">Formulele</a>',
					'<strong>Ea se recitește în limba ecranului</strong>: în franceză pe un ecran francez, în engleză în celelalte nouăsprezece limbi — inclusiv formulele existente și panoul „Funcții”. API-ul redă o formulă în limba cerută, altfel în engleză.',
					'Șabloanele oficiale, servite într-o altă limbă decât franceza, vin cu formulele lor în engleză. Nimic nu se schimbă în bază: aceleași coloane, același SQL, fără migrare.',
				],
			},
			search: {
				date: '2026-09-27',
				title: 'Totul, dintr-un singur loc: Ctrl+K',
				tag: 'Nou',
				items: [
					'<strong>Un singur câmp pentru tot</strong> — <strong>Ctrl+K</strong>, sau câmpul din centrul barei de sus: tabele, vizualizări, întrebări, tablouri de bord, automatizări, coloane și rândurile în sine, citite cu drepturile dumneavoastră; pe un ecran mare, previzualizarea rezultatului ales. <a href="/fonctionnalites/recherche/">Căutarea</a>',
					'<strong>Tastați așa cum gândiți</strong>: fără diacritice și fără majuscule, după inițiale — <code>cn</code> pentru „Client nou” —, o greșeală de tastare este iertată, <code>clienti cluj</code> pentru a căuta „cluj” în tabelul clienților; ce deschideți des revine în frunte.',
					'<strong>Toate comenzile de la tastatură</strong>: creați, mergeți la, închideți, anulați, schimbați tema, copiați linkul paginii. <code>&gt;</code> caută doar în comenzi, <code>#</code> în obiecte, <code>/</code> în rânduri; <strong>Tab</strong> caută într-un tabel sau într-o bază.',
					'<strong>Aveți o întrebare?</strong> Tastați-o: <strong>Întrebați Copilot</strong> i-o adresează, pe baza deschisă.',
				],
			},
			questions: {
				date: '2026-09-27',
				title: 'Întrebări proprii, cifre în text',
				tag: 'Nou',
				items: [
					'<strong>Fiecare își salvează întrebările</strong>, fără nivelul Gestionare: personale, doar dumneavoastră le vedeți; cine gestionează baza le partajează cu toată baza sau cu grupuri, ca interogările. <a href="/fonctionnalites/tableaux-de-bord/">Tablourile de bord</a>',
					'<strong>O întrebare într-o filă</strong>, alături de tabele: <strong>Întrebare nouă</strong> și <strong>Întrebare SQL nouă</strong>, la <strong>+</strong> din bara de file și în meniul bazei; fila păstrează ce ați lăsat în ea. <strong>Salvați o copie</strong> face a dumneavoastră o întrebare pe care nu o puteți modifica.',
					'<strong>Cifre în text</strong>: un text de tablou de bord, acum formatat, citează o valoare — <code>{{chiffre_affaires}}</code> — extrasă dintr-un card, o întrebare sau un filtru, calculată cu drepturile cititorului, chiar și într-un tablou de bord partajat printr-un link. <a href="/fonctionnalites/tableaux-de-bord/#cifre-în-text">Cifre în text</a>',
					'Interogările, vizualizările SQL și întrebările se șterg și din meniul lor, cu un clic dreapta.',
				],
			},
			addresses: {
				date: '2026-09-27',
				title: 'O adresă pentru fiecare ecran',
				tag: 'Nou',
				items: [
					'<strong>Adresa urmează ecranul</strong>: un tabel, o vizualizare, detaliile unui rând, un tablou de bord, o automatizare, o întrebare, setările dumneavoastră — <code>/bases/ventes/tables/opportunites?ligne=…</code>. Adăugați-o la favorite, lipiți-o într-un mesaj: se ajunge în același loc, cu drepturile proprii. <a href="/fonctionnalites/collaboration/#un-link-către-fiecare-ecran">Un link către fiecare ecran</a>',
					'Butoanele <strong>înapoi</strong> și <strong>înainte</strong> ale navigatorului vă readuc unde erați; o adresă care nu duce nicăieri afișează „Această pagină nu există”.',
				],
			},
			demo: {
				date: '2026-09-27',
				title: 'O demonstrație de încercat, în limba dumneavoastră',
				tag: 'Nou',
				items: [
					'<strong>Demonstrația</strong>, pe <a href="https://demo.basedb.eodia.com">demo.basedb.eodia.com</a>: contul este precompletat în limba navigatorului dumneavoastră, cu o bază în această limbă. Puteți citi tot și modifica ce există deja; creările, ștergerile și AI-ul sunt dezactivate acolo, iar baza revine în fiecare noapte la starea inițială.',
					'<strong>Propria dumneavoastră demonstrație</strong>: <code>BASEDB_DEMO=1</code> deschide o instanță pentru toată lumea, cu un cont partajat pe limbă, pregătit dinainte. <a href="/hebergement/variables/#demo-publică">Variabilele</a>',
					'<strong>O limbă pentru fiecare link</strong>: <code>?lang=de</code> la finalul unei adrese basedb arată în germană ecranul de conectare sau o pagină partajată; astfel site-ul duce la demonstrație în limba paginii. <a href="/fonctionnalites/droits/#setările-dumneavoastră">Setările dumneavoastră</a>',
				],
			},
			templateLanguages: {
				date: '2026-09-27',
				title: 'Șabloanele în limba dumneavoastră',
				tag: 'Nou',
				items: [
					'<strong>Șabloanele oficiale se creează în limba ecranului</strong>: tabele, câmpuri, opțiuni, vizualizări, tablouri de bord, automatizări, instrucțiuni pentru AI — și rânduri de exemplu dintr-o lume adaptată fiecărei limbi: „Boulangerie Martin” din Lyon devine „Martin’s Bakery” în Portland. <a href="/fonctionnalites/modeles/#în-limba-dumneavoastră">Șabloanele</a>',
					'<a href="/modeles/">Galeria site-ului</a> arată fiecare șablon în limba paginii.',
					'<strong>Un șablon, mai multe dicționare</strong>: un șablon se scrie o singură dată, în franceză; fiecare limbă îi traduce doar textele, iar basedb urmărește el însuși fiecare etichetă oriunde este citată. Un dicționar care ar rupe șablonul nu este servit. <a href="/fonctionnalites/modeles/#publicarea-unui-șablon-pentru-toate-instanțele">Publicarea unui șablon</a>',
				],
			},
			details: {
				date: '2026-09-27',
				title: 'Și altele',
				items: [
					'<strong>Un șablon fără rândurile sale de exemplu</strong>: „Încărcați datele de exemplu”, debifată, creează tabele goale, pregătite pentru datele dumneavoastră. <a href="/fonctionnalites/modeles/#pornirea-de-la-un-șablon">Pornirea de la un șablon</a>',
					'<strong>Documentația API și MCP</strong> a fiecărei baze se scrie în limba ecranului dumneavoastră. <a href="/integrations/api-rest/#documentația-generată">Documentația generată</a>',
					'Indicii vizuale în tema aplicației, pretutindeni unde navigatorul le arăta pe ale sale; „Ștergeți” din meniuri, în roșu; data completă la trecerea peste ora unui comentariu.',
				],
			},
			aiProvider: {
				date: '2026-09-27',
				title: 'AI-ul ales de dumneavoastră, chiar și pe propriul server',
				tag: 'Nou',
				items: [
					'<strong>Un al patrulea furnizor de AI</strong>: orice server care vorbește API-ul OpenAI — Azure, o poartă de acces a companiei, un model rulat pe propriul dumneavoastră server —, declarat în <code>.env</code>. Jurnalul apelurilor spune cui au fost trimise datele. <a href="/fonctionnalites/ia/">AI-ul în basedb</a>',
					'<strong>Ecranul de conectare</strong> arată, după grilă și SQL, un tablou de bord care urmărește un filtru și o automatizare care se execută, cu o etapă de AI inclusă.',
				],
			},
			languages: {
				date: '2026-09-27',
				title: 'Text formatat, variabile, un kanban mai lizibil',
				tag: 'Nou',
				items: [
					'<strong>Text formatat</strong>: un nou tip de câmp, formatat într-un editor vizual — titluri, liste, citate, linkuri —, curățat la scriere și protejat printr-o constrângere împotriva SQL-ului direct. <a href="/fonctionnalites/tables-et-champs/#text-formatat-și-variabile">Text formatat și variabile</a>',
					'<strong>Variabile</strong>: un text lung citează o coloană a rândului său — <code>{{Ville}}</code> — și se citește peste tot cu valoarea ei: grilă, detaliile rândului, API, server MCP, vizualizări partajate, automatizări. Coloana păstrează citarea, iar aceasta este ce citește <code>psql</code>.',
					'<strong>Un kanban mai lizibil</strong>: carduri mai aerisite, o imagine de copertă și o descriere care citează valorile rândului — „Livrare pe {{Date}} pentru {{Client}}”. <a href="/fonctionnalites/vues/">Vizualizările</a>',
					'<strong>Redenumire dintr-o singură mișcare</strong>: un singur dialog pentru o bază, un tabel sau un câmp; eticheta se schimbă întotdeauna, iar un administrator poate redenumi și în baza de date, pe baza unei analize de impact. <a href="/fonctionnalites/tables-et-champs/#modificarea-structurii">Modificarea structurii</a>',
					'<strong>Douăzeci de limbi</strong>: interfața, acest site și documentația în franceză, engleză, germană, spaniolă, italiană, portugheză (Brazilia), neerlandeză, poloneză, cehă, suedeză, daneză, norvegiană, finlandeză, română, maghiară, turcă, ucraineană, japoneză, chineză simplificată și coreeană. basedb preia limba browserului; <strong>Setări › Aspect › Limbă</strong> fixează alta, care vă urmează de pe un dispozitiv pe altul. Numerele și datele urmează limba. <a href="/fonctionnalites/droits/#setările-dumneavoastră">Setările dumneavoastră</a>',
				],
			},
			flows: {
				date: '2026-09-27',
				title: 'Automatizări în flux',
				tag: 'Nou',
				items: [
					'<strong>Un editor de tip graf</strong>: declanșatorul, apoi fiecare pas pe câte un card; un <strong>+</strong> pe o linie adaugă un pas chiar în acel loc. O automatizare simplă încape în continuare în două carduri. <a href="/fonctionnalites/automatisations/">Automatizările</a>',
					'<strong>Căutarea unui rând</strong> — clientul unei comenzi, ultima factură neplătită — apoi modificarea lui, citarea lui sau legarea lui de un rând nou creat.',
					'<strong>Condiții cu mai multe ramuri</strong>: este luată prima a cărei condiție este îndeplinită, „Altfel” când niciuna nu este; ramurile se reunesc apoi.',
					'<strong>Datele trec de la un pas la altul</strong>: <code>{{e2.client}}</code> citează ce a găsit sau a creat un pas, <code>{{e3.reponse.numero}}</code> ce a răspuns un webhook; meniul fiecărui text propune doar ce s-a petrecut cu siguranță înainte.',
					'<strong>Fiecare execuție, pas cu pas</strong>: afișată peste flux, trasează ramura urmată și spune, pentru fiecare pas, ce a făcut și în cât timp.',
					'<strong>Copilot pentru automatizări</strong>: descrieți ce trebuie să facă baza de la sine sau întrebați de ce a eșuat o execuție; propune o automatizare întreagă, pe care o aplicați pe flux cu un clic, o recitiți, apoi o salvați — nimic nu se salvează fără dumneavoastră. <a href="/fonctionnalites/automatisations/#copilot">Copilot</a>',
					'<strong>Întrebați AI</strong> într-un pas, ca într-un câmp AI: o instrucțiune care citează rândul și pașii anteriori, un răspuns citit ca text, număr, da sau nu, dată sau opțiune dintr-o listă, pe care pașii următori îl scriu sau îl trimit. <a href="/fonctionnalites/automatisations/#întrebați-ai">Întrebați AI</a>',
				],
			},
			dashboards: {
				date: '2026-09-27',
				title: 'Tablouri de bord: întrebări, grafice, filtre',
				tag: 'Nou',
				items: [
					'<strong>Întrebări</strong> formulate cu mouse-ul — un tabel și tabelele unite cu el, filtre, măsuri pe zi, săptămână, lună sau an — sau scrise în <strong>SQL</strong>, doar în citire și cu propriile permisiuni, inclusiv variabile. <a href="/fonctionnalites/tableaux-de-bord/">Tablourile de bord</a>',
					'<strong>Cincisprezece reprezentări vizuale</strong>: cifră, tendință față de perioada anterioară, progres spre un obiectiv, cadran, histogramă, bare, linie, arii, combinat, sectoare, pâlnie, diagramă de dispersie, tabel, tabel pivot, hartă a Franței sau a lumii.',
					'<strong>Explorare cu un clic</strong>: un punct își deschide rândurile, o perioadă mai fină, o altă defalcare.',
					'<strong>Tablouri de bord pe grilă</strong>: carduri mutate și redimensionate cu mouse-ul, file, titluri de secțiune, texte, pagini încorporate.',
					'<strong>Filtre comune</strong> — perioadă, categorie, text, număr, grupare după dată — care controlează unul, mai multe sau toate cardurile, cu o valoare implicită.',
					'<strong>Grafice pe gustul dumneavoastră</strong>: culoarea și numele fiecărei serii sau felii, inel, semicerc sau trandafir, stivuire cu totaluri, linii netezite sau în trepte, axe, gradații, scară logaritmică; tabele cu coloane redenumite, cu bare și culori după valoare.',
					'<strong>Copilot pentru tablouri de bord</strong>: o conversație care propune întrebări, modificări ale tabloului — care pot fi anulate — și valori pentru filtrele lui, de aplicat cu un clic. Doar structura pleacă la furnizor, cu excepția cazului în care îi permiteți să citească rezultatele. <a href="/fonctionnalites/tableaux-de-bord/#copilot">Copilot</a>',
					'<strong>Partajarea unui tablou de bord</strong> printr-un link, public sau rezervat membrilor — la nevoie, anumitor grupuri — și încorporarea lui în alt site: carduri și filtre doar în citire, citite cu permisiunile celui care l-a publicat. <a href="/fonctionnalites/tableaux-de-bord/#partajarea-unui-tablou-de-bord">Partajare</a>',
					'„Interfețe” se numesc de acum <strong>Tablouri de bord</strong>; tablourile existente se deschid ca înainte, pe noua grilă.',
				],
			},
			sqlViews: {
				date: '2026-09-27',
				title: 'Interogări salvate și vizualizări SQL',
				tag: 'Nou',
				items: [
					'<strong>SQL pentru fiecare</strong>: fără nivelul Gestionare, o filă SQL se execută doar în citire, cu propriile permisiuni, aplicate chiar de PostgreSQL — un tabel închis nu există, un câmp ascuns este refuzat. Insigna „Permisiunile dumneavoastră” vă amintește acest lucru. <a href="/fonctionnalites/requetes-et-vues-sql/">Interogări și vizualizări SQL</a>',
					'<strong>Interogări salvate</strong>, așezate sub tabele în secțiunea „Interogări”: personale, pentru toată baza sau pentru anumite grupuri. Partajarea unei interogări îi partajează textul, niciodată ce poate citi autorul ei; deschisă din bara laterală, se execută imediat, doar în citire.',
					'<strong>Vizualizări SQL</strong>: vizualizări PostgreSQL reale, așezate printre tabele cu o culoare, o pictogramă și un mic ochi, care pot fi citite și din <code>psql</code> și din instrumentele dumneavoastră. Fiecare le citește cu propriile permisiuni, iar bara laterală le arată doar celor care pot citi tot ce conțin.',
					'Vizualizările urmează structura: o redenumire nu le strică, o formulă modificată le retrage o clipă, apoi le repune; cea care nu mai este validă rămâne de corectat, cu definiția păstrată.',
				],
			},
			settings: {
				date: '2026-09-27',
				title: 'Setările dumneavoastră',
				tag: 'Nou',
				items: [
					'<strong>Setări</strong>, în meniul profilului: numele, adresa și furnizorii de identitate legați de contul dumneavoastră; parola și sesiunile deschise. <a href="/fonctionnalites/droits/">Conturi și conectare</a>',
					'<strong>Aspect</strong>: tema, ordinea datelor — <code>25/09/2026</code> sau <code>2026-09-25</code> — și prima zi a săptămânii în calendare; ultimele două vă urmează de pe un dispozitiv pe altul.',
					'<strong>Notificări</strong>: refuzați-le pe cele pe care nu le mai doriți, câte un tip odată. <strong>Tokenuri</strong>: cele pe care le-ați creat, în toate bazele dumneavoastră, ultima lor utilizare și revocarea lor.',
				],
			},
			v020: {
				date: '2026-09-26',
				title: 'Versiunea 0.2.0: fiecare cu contul, proiectele și invitațiile sale',
				tag: 'Nou',
				items: [
					'<strong>Prima conectare</strong>: pe o instanță nouă, prima pagină creează contul de administrator, cu adresa și parola dumneavoastră — gata cu contul implicit și cu parola căutată prin jurnale. <a href="/guides/installation/">Instalarea</a>',
					'<strong>Crearea de conturi</strong>: fiecare își creează contul, apoi propriile proiecte, pe care le gestionează. Administrarea o poate închide sau o poate rezerva anumitor domenii. <a href="/hebergement/connexion/">Conturi și conectare</a>',
					'<strong>Partajarea unui proiect sau a unei baze</strong>: cine are nivelul Gestionare invită printr-un link, cu Citire, Editare sau Gestionare; vede cine are acces, schimbă un nivel, îl retrage. Niciodată mai mult decât ceea ce gestionează.',
					'<strong>Confidențialitate</strong>: fiecare vede de acum doar persoanele cu care partajează un proiect, iar un nume de proiect deja folosit de altcineva nu mai poate fi ghicit.',
					'<strong>Conectare cu Google, Microsoft</strong> și orice furnizor OpenID Connect (Keycloak, GitLab…), declarați în <code>.env</code>; o primă conectare creează contul dacă crearea de conturi o permite. <a href="/hebergement/connexion/">Configurare</a>',
					'<strong>Un nou ecran de conectare</strong>, în tema aplicației, luminoasă sau întunecată, animat cu discreție; ecrane goale ilustrate în aplicație.',
					'<strong>Actualizări fără pierderi</strong>: basedb își actualizează singur catalogul la pornire, inclusiv pe o instalare 0.1, și refuză să pornească pe o bază de date pe care o versiune mai recentă a actualizat-o deja. <a href="/hebergement/sauvegardes/">Actualizarea</a>',
				],
			},
			dockerImage: {
				date: '2026-09-26',
				title: 'O singură imagine Docker',
				tag: 'Găzduire',
				items: [
					'basedb încape într-o <strong>singură imagine</strong>, <code>eodia/basedb</code> pe Docker Hub, pentru amd64 și arm64: interfața, API-ul sub <code>/api</code> și serverul MCP sub <code>/mcp</code>, pe <strong>un singur port</strong>. <a href="/guides/installation/">Instalarea</a>',
					'Două fișiere sunt suficiente — <code>docker-compose.yml</code> și <code>.env</code> — fără a clona depozitul și fără a construi nimic; actualizarea se face cu <code>docker compose pull</code>.',
					'În spatele unui domeniu, proxy-ul HTTPS nu mai are nicio rutare de făcut: totul merge la portul 3000.',
				],
			},
			automations: {
				date: '2026-09-26',
				title: 'Automatizări, interfețe, formule, colaborare',
				tag: 'Nou',
				items: [
					'<strong>Formule</strong> în franceză — <code>SI</code>, <code>ARRONDI</code>, <code>JOURS</code>… — devenite coloane generate de PostgreSQL; <strong>căutări</strong>, <strong>agregări</strong> și <strong>numărări</strong> prin relații. <a href="/fonctionnalites/tables-et-champs/">Câmpurile</a>',
					'<strong>Tipuri noi</strong>: relație multiplă, persoană, e-mail, număr automat, buton; și formate alese ca niște tipuri — monedă, procent, durată, evaluare cu stele, telefon, cod de bare.',
					'<strong>Opt vizualizări</strong>: <strong>galeria</strong> și <strong>lista</strong> li se alătură celorlalte șase; <strong>vizualizări personale</strong> pentru orice cititor, vizualizări blocate, ordine manuală, dependențe în cronologie. <a href="/fonctionnalites/vues/">Vizualizările</a>',
					'<strong>Grila</strong>: căutare rapidă, grupare, rezumat pe coloană pentru tot filtrul, culori după reguli, înălțimea rândurilor.',
					'<strong>Vizualizări partajate</strong> doar în citire, care se pot încorpora în alt site; un calendar devine un <strong>flux iCalendar</strong> pentru Google Calendar, Outlook sau Apple Calendar. <a href="/fonctionnalites/vues-partagees/">Partajarea</a>',
					'<strong>Colaborare</strong>: comentarii și mențiuni, notificări, scrierile celorlalți în timp real, prezență pe tabel și pe rând. <a href="/fonctionnalites/collaboration/">Lucrul împreună</a>',
					'<strong>Ctrl+Z</strong> anulează ultima scriere — o celulă, un card mutat, un import întreg — și refuză în loc să suprascrie ce a schimbat altcineva între timp.',
					'<strong>Automatizări</strong>: când un rând este creat sau modificat, la oră fixă sau cu un clic pe un buton — modificați, creați, anunțați, apelați un webhook, scrieți pe Slack. <a href="/fonctionnalites/automatisations/">Automatizați</a>',
					'<strong>Interfețe</strong>: tablouri de bord — cifre, grafice, liste, texte — citite cu permisiunile fiecăruia. <a href="/fonctionnalites/tableaux-de-bord/">Tablourile de bord</a>',
					'<strong>Integrări</strong>: un canal Slack și <strong>tabele sincronizate</strong> dintr-un CSV online, dintr-o agendă sau din vizualizarea unui alt basedb. <a href="/integrations/synchronisation/">Integrările</a>',
					'<strong>Șabloane pentru baze</strong>: o galerie de zece șabloane, o bază descrisă AI-ului într-o frază și orice bază poate fi salvată ca șablon. <a href="/modeles/">Galeria</a>',
					'<strong>Permisiuni</strong>: ecranul Structură devine doar de consultare pentru cine nu are nivelul Gestionare.',
					'<strong>O nouă identitate</strong>: un logo, o paletă și un ecran de conectare refăcut.',
				],
			},
			simpler: {
				date: '2026-09-26',
				title: 'O interfață mai simplă',
				items: [
					'<strong>Bara laterală</strong> listează de acum doar bazele și tabelele lor; ecranele bazei deschise — Structură, Istoric, Interfețe, Automatizări — sunt reunite într-un bloc, chiar deasupra profilului.',
					'<strong>Meniul profilului</strong> găzduiește ce nu ține de date: documentația API și MCP, integrările, utilizatorii și permisiunile.',
					'<strong>O interogare SQL</strong> se deschide din „+” al barei de file sau din meniul bazei, fără dublură în bara laterală.',
					'<strong>Bază nouă</strong> propune șabloanele și AI-ul chiar din dialog; baza demonstrativă trece prin aceeași galerie.',
					'<strong>Ecranul nu mai propune ce ar fi refuzat</strong>: niciun buton de structură fără Gestionare, niciun „Ștergeți” fără dreptul de a șterge; iar un cititor își creează propriile vizualizări în loc să se lovească de un mesaj.',
					'<strong>Coloanele de sistem</strong> sunt grupate sub „Informații de sistem”, în loc să fie propuse pe fiecare tabel.',
					'<strong>Detaliile rândului</strong> primesc comentariile lui, un buton pentru a scrie sau a suna și o evaluare care se setează cu un clic.',
					'<strong>Ecranul de conectare</strong> renunță la fundalul animat 3D pentru un ecran ușor, care respectă preferința „mai puțină mișcare”.',
				],
			},
			environments: {
				date: '2026-09-26',
				title: 'Medii, formulare partajate, vizualizări',
				items: [
					'<strong>Medii</strong>: producție, testare, dezvoltare pentru aceeași bază; comparare alăturată, plan de migrare, sincronizarea rândurilor.',
					'<strong>Istoricul structurii</strong>: fiecare creare sau modificare de tabel și de câmp, capturată printr-un trigger pe catalog.',
					'<strong>Formulare partajate</strong>: un link public sau rezervat membrilor, închidere la o dată sau după un număr de răspunsuri, atribuirea răspunsurilor în istoric.',
					'<strong>Șase vizualizări</strong>: grilă, kanban, calendar, cronologie, formular, chestionar.',
					'<strong>Istoricul datelor</strong>: anularea unei modificări, restaurarea unui rând șters.',
					'<strong>AI</strong>: opțiunea AI pe orice câmp și Copilot.',
					'<strong>Relație</strong> și <strong>URL</strong>: două tipuri distincte; textul lung se scrie în Markdown.',
					'<strong>Webhookuri</strong> semnate și ordonate, <strong>propuneri ale agenților</strong> de aprobat.',
					'<strong>Docker</strong>: un Dockerfile cu trei ținte, un docker-compose complet, un proxy HTTPS opțional.',
				],
			},
			projects: {
				date: '2026-09-25',
				title: 'Proiecte, permisiuni, server MCP',
				items: [
					'<strong>Proiecte</strong> deasupra bazelor și permisiuni pe <strong>grupuri</strong>, pe patru niveluri: Fără acces, Citire, Editare, Gestionare.',
					'<strong>Conturi</strong>: parolă temporară, schimbată la prima conectare, sesiune privilegiată pentru administrare.',
					'<strong>Server MCP</strong> și releu stdio; <strong>tokenuri de integrare</strong> comune API-ului REST și MCP.',
					'<strong>Documentație generată</strong> „API și MCP” pentru fiecare bază.',
				],
			},
			fields: {
				date: '2026-09-20',
				title: 'Câmpuri, selecții unice, import',
				items: [
					'Modificarea unui câmp și a opțiunilor unei selecții unice.',
					'<strong>Import</strong> de fișiere CSV și JSON.',
					'Meniul unui tabel: redenumire, descriere, ștergere.',
				],
			},
			firstCommit: {
				date: '2026-09-20',
				title: 'Primul commit',
				items: [
					'Monorepo-ul: denumirea, registrul codurilor de eroare, catalogul extras din documentul de arhitectură, nucleul, API-ul, interfața.',
				],
			},
		},
	},
	roadmap: {
		label: 'Foaie de parcurs',
		title: 'Ce urmează',
		intro: 'basedb se află în dezvoltare activă. Această pagină spune ce lipsește încă, fără vreo dată promisă. O idee, o nevoie? <a href="https://github.com/eodia/basedb/issues">Deschideți un tichet</a>. Ce există deja: <a href="/nouveautes/">noutățile</a>.',
		columns: {
			next: {
				title: 'În curând',
				items: {
					restoreTable: {
						title: 'Restaurarea unui singur tabel',
						text: 'Un tabel șters rămâne lizibil în SQL sub numele său retrogradat; readucerea lui separată din interfață urmează.',
					},
					aiSettings: {
						title: 'Setările AI în interfață',
						text: 'Furnizor, model și cheie pentru fiecare spațiu de lucru, fără a trece prin mediul API-ului.',
					},
					mail: {
						title: 'Notificări și invitații prin e-mail',
						text: 'Mențiunile, răspunsurile și desemnările sosesc azi în basedb, iar invitațiile printr-un link pe care îl trimiteți chiar dumneavoastră; vor putea pleca și prin e-mail.',
					},
				},
			},
			later: {
				title: 'Mai târziu',
				items: {
					formLinks: {
						title: 'Relații și fișiere în formularele partajate',
						text: 'O căutare restrânsă în tabelul legat, o încărcare de fișiere limitată pentru vizitatorii necunoscuți.',
					},
					moreEvents: {
						title: 'Mai multe evenimente notificate',
						text: 'Să fiți anunțat despre un răspuns la un formular, o propunere a unui agent, un webhook dezactivat.',
					},
					sqlViewsAcross: {
						title: 'Vizualizări SQL de la un mediu la altul',
						text: 'Copierea vizualizărilor SQL împreună cu structura la crearea sau compararea mediilor, precum și în șabloanele pentru baze.',
					},
					loops: {
						title: 'Așteptări în automatizări',
						text: 'Așteptarea înainte de pasul următor („trei zile mai târziu”) și includerea fluxurilor — condiții, căutări, bucle — în șabloanele pentru baze.',
					},
					textFormulas: {
						title: 'Formule pe text',
						text: 'Extragerea, înlocuirea sau trunchierea unei părți dintr-un text.',
					},
					bulk: {
						title: 'Operațiuni în masă declarate',
						text: 'Modificări pe mii de rânduri, înregistrate în istoric ca o singură operațiune.',
					},
					tombstones: {
						title: 'Curățarea marcajelor de ștergere',
						text: 'Eliminarea urmelor de ștergere care nu mai sunt necesare.',
					},
				},
			},
		},
	},
	gallery: {
		label: 'Șabloane',
		title: 'O bază gata în câteva secunde',
		intro: 'Fiecare șablon creează tabele legate între ele, rânduri de exemplu, vizualizări, un tablou de bord, automatizări — și câmpuri pe care AI-ul le completează singur. În basedb: <strong>Bază nouă</strong>, apoi <strong>Porniți de la un șablon</strong>. Nu se potrivește nimic? Descrieți-vă nevoia într-o frază: AI-ul vă propune o bază pe măsură.',
		filter: 'Filtrați după categorie',
		all: 'Toate',
		otherCategory: 'Altele',
		ai: '✦ AI',
		tables: {
			one: '{n} tabel',
			few: '{n} tabele',
			other: '{n} de tabele',
		},
		rows: {
			one: '{n} rând',
			few: '{n} rânduri',
			other: '{n} de rânduri',
		},
		views: {
			one: '{n} vizualizare',
			few: '{n} vizualizări',
			other: '{n} de vizualizări',
		},
		howtoTitle: 'Configurarea șabloanelor în JSON',
		howto: 'Un șablon este un fișier JSON: tabelele, câmpurile, relațiile, rândurile, vizualizările, tablourile de bord, automatizările și instrucțiunile câmpurilor AI. Șabloanele de pe această pagină sunt fișierele din dosarul <a href="https://github.com/eodia/basedb/tree/main/packages/templates/catalog"><code>packages/templates/catalog</code></a> al depozitului; fiecare instanță basedb citește <a href="/modeles/catalogue.json"><code>catalogue.json</code></a> și le propune utilizatorilor ei. Un administrator își poate importa și propriile șabloane în instanța sa, iar orice bază poate fi salvată ca șablon.',
		format: {
			href: '/fonctionnalites/modeles/',
			label: 'Formatul șabloanelor →',
		},
		back: '← Toate șabloanele',
		defaultCategory: 'Șablon',
		sampleRows: {
			one: '{n} rând de exemplu',
			few: '{n} rânduri de exemplu',
			other: '{n} de rânduri de exemplu',
		},
		aiTitle: 'Ce calculează AI-ul',
		useTitle: 'Folosiți acest șablon',
		useSteps: [
			'În basedb, <strong>Bază nouă</strong>.',
			'<strong>Porniți de la un șablon</strong>, apoi „{label}”.',
		],
		create: '<strong>Creați baza</strong>.',
		createWithAi: '<strong>Creați baza</strong> — acceptând, dacă doriți, ca furnizorul dumneavoastră de AI să calculeze câmpurile AI.',
		download: 'Descărcați JSON-ul',
		downloadNote: 'Pentru a-l importa în instanța dumneavoastră sau pentru a-l adapta înainte de a-l propune pentru catalog.',
		viewMeta: '— {kind}, {table}',
		dashboard: '<strong>Tablou de bord</strong> „{label}” — {blocks}',
		blocks: {
			one: '{n} bloc',
			few: '{n} blocuri',
			other: '{n} de blocuri',
		},
		automation: '<strong>Automatizare</strong> „{label}”',
		yes: 'Da',
		no: 'Nu',
		me: 'Dumneavoastră',
		kinds: {
			short_text: 'Text scurt',
			long_text: 'Text lung',
			rich_text: 'Text formatat',
			number: 'Număr',
			boolean: 'Casetă de selectare',
			date: 'Dată',
			datetime: 'Dată și oră',
			select: 'Selecție unică',
			multi_select: 'Selecție multiplă',
			url: 'URL',
			email: 'E-mail',
			user: 'Persoană',
			autonumber: 'Număr automat',
			formula: 'Formulă',
			lookup: 'Căutare',
			rollup: 'Agregare',
			count: 'Numărare',
			button: 'Buton',
			link: 'Relație',
			multi_link: 'Relație multiplă',
		},
		viewKinds: {
			grid: 'Grilă',
			kanban: 'Kanban',
			calendar: 'Calendar',
			timeline: 'Cronologie',
			gallery: 'Galerie',
			list: 'Listă',
			form: 'Formular',
		},
	},
	templates: {
		demo: {
			label: 'Demo: Atelierul Lumen',
			summary: 'O mică agenție, clienții, proiectele, sarcinile, facturile și recenziile ei: toate fațetele basedb într-o singură bază.',
			description: 'Baza demonstrativă. Atelierul Lumen este o agenție de design fictivă. Baza ei arată relațiile dintre tabele, căutările și agregările (cifra de afaceri pe client, evaluarea medie), formulele (suma cu TVA, întârzierea), trei câmpuri calculate de AI pe recenziile clienților (sentiment, temă, răspuns sugerat), fiecare tip de vizualizare — grilă, kanban, calendar, cronologie cu dependențe, galerie, listă, formular —, un tablou de bord și două automatizări.',
			category: 'Demonstrație',
			tags: ['AI', 'Relații', 'Toate vizualizările', 'Tablou de bord'],
		},
		'analyse-avis': {
			label: 'Analiza recenziilor clienților',
			summary: 'Colectați recenziile și lăsați AI-ul să extragă sentimentul, temele, urgența și o ciornă de răspuns.',
			description: 'Pentru un magazin, un restaurant sau un brand: recenziile sosesc dintr-un formular public sau dintr-un import, iar AI-ul le citește pe fiecare. Clasifică sentimentul, identifică tema principală, semnalează recenziile care cer un răspuns rapid, extrage sugestia clientului și redactează un răspuns de verificat. Produsele își cumulează evaluarea medie și numărul de recenzii; un tablou de bord urmărește satisfacția.',
			category: 'Relația cu clienții',
			tags: ['AI', 'Formular', 'Tablou de bord'],
		},
		'base-connaissances': {
			label: 'Bază de cunoștințe',
			summary: 'Articole de ajutor și întrebări ale clienților: AI-ul rezumă, clasifică și propune un răspuns pornind de la articole.',
			description: 'Pentru un serviciu de asistență. Articolele de ajutor sunt organizate pe categorii și urmărite în timp; întrebările clienților sosesc printr-un formular public. AI-ul rezumă fiecare articol și îi evaluează nivelul, clasifică fiecare întrebare și redactează o ciornă de răspuns de verificat.',
			category: 'Asistență',
			tags: ['AI', 'Formular', 'Listă'],
		},
		'calendrier-editorial': {
			label: 'Calendar editorial',
			summary: 'Articole, postări și newslettere planificate într-un calendar; AI-ul propune titluri atractive și cuvinte-cheie.',
			description: 'Pentru o echipă de marketing sau o redacție. Fiecare conținut avansează de la idee la publicare, se plasează în calendarul aparițiilor și aparține unei campanii. AI-ul propune un titlu atractiv și cuvinte-cheie pornind de la brief, iar un formular permite întregii companii să sugereze un subiect.',
			category: 'Marketing',
			tags: ['AI', 'Calendar', 'Kanban', 'Formular'],
		},
		crm: {
			label: 'CRM comercial',
			summary: 'Companii, contacte și oportunități: un pipeline de vânzări, schimburile de mesaje și AI-ul care recomandă pasul următor.',
			description: 'Un CRM simplu pentru o echipă de vânzări. Oportunitățile avansează într-un pipeline, au o sumă ponderată cu probabilitatea lor, iar AI-ul le evaluează riscul și recomandă următoarea acțiune pornind de la note. Schimburile cu clienții sunt consemnate și rezumate, iar companiile cumulează ceea ce reprezintă.',
			category: 'Vânzări',
			tags: ['AI', 'Pipeline', 'Kanban', 'Calendar'],
		},
		evenements: {
			label: 'Evenimente și înscrieri',
			summary: 'Conferințe, ateliere și webinarii: înscrierile, locurile rămase și feedbackul participanților citit de AI.',
			description: 'Pentru organizarea de evenimente recurente. Fiecare eveniment își numără înscrișii și locurile rămase; înscrierile avansează până la prezență. După eveniment, participanții lasă un feedback pe care AI-ul îl clasifică după sentiment și îl rezumă. Un formular public permite înscrierea în lista de difuzare.',
			category: 'Evenimente',
			tags: ['AI', 'Calendar', 'Formular', 'Agregări'],
		},
		'gestion-projet': {
			label: 'Management de proiect',
			summary: 'Proiecte, sarcini și repere: o foaie de parcurs, dependențe între sarcini, un kanban și un calendar.',
			description: 'Pentru gestionarea mai multor proiecte în paralel. Fiecare proiect își cumulează sarcinile și orele; sarcinile se urmăresc în kanban, se planifică pe o cronologie care le desenează dependențele, iar reperele se citesc într-un calendar. AI-ul redactează pentru conducere o stare a proiectului pornind de la descrierea și progresul acestuia.',
			category: 'Organizare',
			tags: ['Cronologie', 'Dependențe', 'Kanban', 'AI'],
		},
		inventaire: {
			label: 'Inventar și stocuri',
			summary: 'Articole, furnizori și mișcări: stocul se calculează singur, iar rupturile de stoc se văd din timp.',
			description: 'Pentru un atelier, un magazin sau un serviciu administrativ. Fiecare intrare sau ieșire este o mișcare; stocul fiecărui articol este suma acestora, valoarea lui o formulă, iar articolele sub prag apar în „De comandat”. AI-ul redactează fișa fiecărui articol pornind de la numele și categoria lui.',
			category: 'Operațiuni',
			tags: ['Agregări', 'Formule', 'Galerie', 'AI'],
		},
		recrutement: {
			label: 'Recrutare',
			summary: 'Posturi deschise, candidați și interviuri; AI-ul sintetizează fiecare candidatură și sugerează punctele de aprofundat.',
			description: 'Urmărirea recrutărilor, de la candidatură la angajare. Candidații aplică printr-un formular public, avansează pas cu pas într-un kanban, iar interviurile se planifică într-un calendar. AI-ul citește scrisoarea de intenție și notele: o sinteză și întrebările de pus la interviu. Ajută la citire, nu decide.',
			category: 'Resurse umane',
			tags: ['AI', 'Formular', 'Kanban', 'Calendar'],
		},
		'suivi-tickets': {
			label: 'Urmărirea tichetelor',
			summary: 'Buguri și solicitări sortate de AI, urmărite pe sprinturi până la rezolvare, cu un formular de raportare.',
			description: 'Un sistem de gestionare a tichetelor pentru o echipă de produs. Fiecare tichet este asociat unei componente și unui sprint; AI-ul propune o categorie, estimează gravitatea și rezumă raportarea. Un kanban urmărește progresul, o cronologie arată sprinturile, un formular permite oricui să raporteze o problemă, iar o automatizare notează data rezolvării.',
			category: 'Produs și tehnic',
			tags: ['AI', 'Kanban', 'Formular', 'Sprinturi'],
		},
	},
} satisfies DeepPartial<Dict>;
