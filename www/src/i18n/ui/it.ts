/**
 * The Italian texts of the landing pages, laid over the French ones (`fr.ts`).
 *
 * See `../README.md`.
 */
import type { DeepPartial, Dict } from './index';

export default {
	meta: {
		home: {
			title: 'basedb — il database collaborativo in cui ogni tabella è una vera tabella PostgreSQL',
			description: 'Griglie e dieci viste, formule, moduli, quiz e viste condivisi, commenti, automazioni, dashboard, permessi fino al singolo campo, cronologia completa, API REST e server MCP — su vere tabelle PostgreSQL, con nomi leggibili. Self-hosted, AGPL-3.0.',
		},
		changelog: {
			title: 'Novità — basedb',
			description: 'Cosa è cambiato in basedb, versione dopo versione.',
		},
		roadmap: {
			title: 'Roadmap — basedb',
			description: 'Cosa farà basedb nei prossimi passi.',
		},
		gallery: {
			title: 'Modelli — basedb',
			description: 'Database pronti all’uso: gestione dei ticket, analisi delle recensioni, CRM, selezione del personale… con le loro righe di esempio, le loro viste, le loro dashboard e i loro campi calcolati dall’IA.',
		},
		template: {
			title: '{label} — modelli basedb',
		},
	},
	eodia: {
		home: 'https://eodia.com/',
		about: 'https://eodia.com/about/',
		contact: 'https://eodia.com/contact/',
	},
	demo: {
		short: 'Demo',
		cta: 'Prova la demo',
	},
	nav: {
		aria: 'Navigazione principale',
		home: 'basedb — home',
		links: [
			{
				href: '/#fonctionnalites',
				label: 'Funzionalità',
			},
			{
				href: '/modeles/',
				label: 'Modelli',
			},
			{
				href: '/guides/introduction/',
				label: 'Documentazione',
			},
			{
				href: '/nouveautes/',
				label: 'Novità',
			},
		],
		developers: 'Sviluppatori',
		github: 'Il repository GitHub di basedb',
		install: 'Installa',
		menu: {
			open: 'Apri il menu',
			close: 'Chiudi il menu',
			features: {
				label: 'Funzionalità',
				groups: {
					organize: {
						title: 'Organizzare',
						items: {
							tables: {
								href: '/fonctionnalites/tables-et-champs/',
								title: 'Tabelle e campi',
								text: 'Campi per tutto, relazioni, formule come in un foglio di calcolo.',
							},
							views: {
								href: '/fonctionnalites/vues/',
								title: 'Dieci viste',
								text: 'Griglia, kanban, calendario, sequenza temporale, galleria, elenco, mappa, modulo, questionario.',
							},
							forms: {
								href: '/fonctionnalites/formulaires-partages/',
								title: 'Moduli',
								text: 'Un link da condividere: ogni risposta diventa una riga.',
							},
							files: {
								href: '/fonctionnalites/fichiers/',
								title: 'File e immagini',
								text: 'Preventivi, foto, contratti, conservati con la loro riga.',
							},
						},
					},
					collaborate: {
						title: 'Collaborare',
						items: {
							live: {
								href: '/fonctionnalites/collaboration/',
								title: 'Tempo reale e commenti',
								text: 'Vedere gli altri lavorare, commentare una riga, menzionare un collega.',
							},
							rights: {
								href: '/fonctionnalites/droits/',
								title: 'Permessi e team',
								text: 'Chi vede cosa e chi modifica cosa, fino alla colonna.',
							},
							history: {
								href: '/fonctionnalites/historique/',
								title: 'Cronologia',
								text: 'Ogni modifica conservata, e annullabile.',
							},
							shared: {
								href: '/fonctionnalites/vues-partagees/',
								title: 'Viste condivise',
								text: 'Una vista tramite un link, sul tuo sito o nella tua agenda.',
							},
						},
					},
					automate: {
						title: 'Automatizzare e analizzare',
						items: {
							automations: {
								href: '/fonctionnalites/automatisations/',
								title: 'Automazioni',
								text: 'Quando una riga cambia: avvisare, creare, scrivere, chiedere all’IA.',
							},
							dashboards: {
								href: '/fonctionnalites/tableaux-de-bord/',
								title: 'Dashboard',
								text: 'Quindici visualizzazioni, filtri comuni, un link da condividere.',
							},
							ai: {
								href: '/fonctionnalites/ia/',
								title: 'IA e Copilot',
								text: 'Un database in una frase, campi che si compilano da soli.',
							},
							templates: {
								href: '/modeles/',
								title: 'Modelli',
								text: 'Dieci database pronti all’uso, da adattare.',
							},
						},
					},
				},
				feature: {
					tag: 'Novità',
					title: 'Le automazioni a flusso',
					text: 'Cercare, decidere, chiedere all’IA: un editor a grafo, e ogni esecuzione si rilegge passaggio per passaggio.',
					href: '/nouveautes/',
					cta: 'Tutte le novità',
				},
				all: 'Tutte le funzionalità',
			},
			solutions: {
				label: 'Soluzioni',
				title: 'Per ogni team',
				items: {
					crm: {
						team: 'Vendite',
						text: 'Pipeline, contatti, solleciti.',
					},
					recrutement: {
						team: 'Risorse umane',
						text: 'Candidature, colloqui, sintesi dall’IA.',
					},
					'calendrier-editorial': {
						team: 'Marketing',
						text: 'Articoli, post e newsletter pianificati.',
					},
					inventaire: {
						team: 'Operazioni',
						text: 'Una giacenza calcolata, rotture di stock viste in anticipo.',
					},
					'gestion-projet': {
						team: 'Progetti',
						text: 'Milestone, attività e dipendenze.',
					},
					'suivi-tickets': {
						team: 'Prodotto',
						text: 'Bug e richieste smistati dall’IA.',
					},
					'base-connaissances': {
						team: 'Supporto',
						text: 'Articoli di aiuto, domande, risposte proposte.',
					},
					evenements: {
						team: 'Eventi',
						text: 'Iscrizioni, posti, feedback.',
					},
					'analyse-avis': {
						team: 'Relazione con i clienti',
						text: 'Recensioni lette e classificate dall’IA.',
					},
				},
				ask: {
					title: 'Hai altro in mente?',
					text: 'Descrivi la tua esigenza in una frase: l’IA ti propone un database su misura.',
					href: '/modeles/',
				},
				all: 'Tutti i modelli',
			},
			developers: {
				label: 'Sviluppatori',
				groups: {
					build: {
						title: 'Integrare',
						items: {
							api: {
								href: '/integrations/api-rest/',
								title: 'API REST',
								text: 'Gli stessi dati dell’interfaccia, descritti in OpenAPI 3.1.',
							},
							mcp: {
								href: '/integrations/mcp/',
								title: 'Server MCP',
								text: 'Strumenti per i tuoi agenti IA, con i tuoi permessi.',
							},
							webhooks: {
								href: '/integrations/webhooks/',
								title: 'Webhook',
								text: 'Ogni scrittura, firmata, ordinata, ritentata.',
							},
							sql: {
								href: '/integrations/sql/',
								title: 'SQL diretto',
								text: 'Vere tabelle PostgreSQL, con nomi leggibili.',
							},
							sync: {
								href: '/integrations/synchronisation/',
								title: 'Sincronizzazione',
								text: 'Tabelle tenute aggiornate da altrove.',
							},
						},
					},
					host: {
						title: 'Hosting',
						items: {
							docker: {
								href: '/hebergement/docker/',
								title: 'Docker Compose',
								text: 'Un’immagine, un database PostgreSQL, una sola porta.',
							},
							env: {
								href: '/hebergement/variables/',
								title: 'Variabili',
								text: 'Tutto si configura nel file .env.',
							},
							https: {
								href: '/hebergement/https/',
								title: 'Dominio e HTTPS',
								text: 'Dietro il tuo proxy, o con il Caddy incluso.',
							},
							sso: {
								href: '/hebergement/connexion/',
								title: 'Connessione e SSO',
								text: 'Google, Microsoft, qualsiasi fornitore OpenID Connect.',
							},
							backup: {
								href: '/hebergement/sauvegardes/',
								title: 'Backup e aggiornamenti',
								text: 'pg_dump, e aggiornamenti senza perdite.',
							},
						},
					},
				},
				feature: {
					title: 'La pagina degli sviluppatori',
					text: 'Una vera tabella PostgreSQL dietro ogni griglia.',
					href: '/developpeurs/',
				},
			},
			resources: {
				label: 'Risorse',
				groups: {
					learn: {
						title: 'Imparare',
						items: {
							docs: {
								href: '/guides/introduction/',
								title: 'Documentazione',
								text: 'Tutto basedb, passo per passo.',
							},
							start: {
								href: '/guides/premiers-pas/',
								title: 'Primi passi',
								text: 'Il tuo primo database, dall’importazione alla vista.',
							},
							install: {
								href: '/guides/installation/',
								title: 'Installazione',
								text: 'Due file e un comando.',
							},
							principles: {
								href: '/architecture/principes/',
								title: 'I principi',
								text: 'Come è costruito basedb, e perché.',
							},
						},
					},
					follow: {
						title: 'Seguire il progetto',
						items: {
							news: {
								href: '/nouveautes/',
								title: 'Novità',
								text: 'Cosa è cambiato, versione dopo versione.',
							},
							roadmap: {
								href: '/feuille-de-route/',
								title: 'Roadmap',
								text: 'Cosa viene dopo.',
							},
							github: {
								href: 'https://github.com/eodia/basedb',
								title: 'GitHub',
								text: 'Il codice, i ticket, le versioni.',
							},
							eodia: {
								href: 'https://eodia.com/',
								title: 'Eodia',
								text: 'Lo studio che crea basedb.',
							},
						},
					},
				},
			},
		},
	},
	language: {
		label: 'Lingua',
		current: 'Lingua: {name}',
	},
	footer: {
		tagline: 'Il database collaborativo in cui ogni tabella è una vera tabella PostgreSQL.',
		madeBy: 'Un software libero di <a class="eodia" href="https://eodia.com/">Eodia</a>, studio di software AI-native.',
		columns: {
			product: {
				title: 'Prodotto',
				links: [
					{
						href: '/#fonctionnalites',
						label: 'Funzionalità',
					},
					{
						href: '/nouveautes/',
						label: 'Novità',
					},
					{
						href: '/feuille-de-route/',
						label: 'Roadmap',
					},
					{
						href: '/#faq',
						label: 'Domande frequenti',
					},
				],
			},
			docs: {
				title: 'Documentazione',
				links: [
					{
						href: '/guides/introduction/',
						label: 'Introduzione',
					},
					{
						href: '/guides/installation/',
						label: 'Installazione',
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
				title: 'Hosting',
				links: [
					{
						href: '/hebergement/docker/',
						label: 'Docker Compose',
					},
					{
						href: '/hebergement/variables/',
						label: 'Variabili d’ambiente',
					},
					{
						href: '/hebergement/https/',
						label: 'Dominio e HTTPS',
					},
					{
						href: '/hebergement/sauvegardes/',
						label: 'Backup',
					},
				],
			},
			project: {
				title: 'Progetto',
				links: [
					{
						href: 'https://github.com/eodia/basedb',
						label: 'GitHub',
					},
					{
						href: 'https://github.com/eodia/basedb/tree/main/docs/architecture',
						label: 'Documento di architettura',
					},
					{
						href: 'https://github.com/eodia/basedb/blob/main/LICENSE',
						label: 'Licenza AGPL-3.0',
					},
					{
						href: 'https://github.com/eodia/basedb/issues',
						label: 'Segnala un problema',
					},
				],
			},
			eodia: {
				title: 'Eodia',
				links: [
					{
						href: 'https://eodia.com/',
						label: 'Lo studio',
					},
					{
						href: 'https://eodia.com/about/',
						label: 'Chi siamo',
					},
					{
						href: 'https://eodia.com/contact/',
						label: 'Contattaci',
					},
				],
			},
		},
		copyright: '© {year} <a href="https://eodia.com/">Eodia</a> · AGPL-3.0-or-later',
		builtWith: 'Sito realizzato con Astro e Starlight.',
	},
	docsFooter: {
		madeBy: 'basedb è un software libero di <a href="https://eodia.com/">Eodia</a>, studio di software AI-native.',
	},
	teams: {
		meta: {
			title: 'basedb — il database collaborativo di tutto il team',
			description: 'Tutto il tuo lavoro in un unico posto, modificato da tutto il team insieme: in tabella, in kanban o in calendario, con moduli, dashboard, automazioni e l’IA. Senza codice, libero e gratuito.',
		},
		hero: {
			eyebrow: 'basedb',
			title: 'Tutto il tuo lavoro.',
			titleAccent: 'Finalmente in un unico posto.',
			lead: 'Tabelle, calendari, moduli, dashboard e automazioni, per tutto il team. Semplice come un foglio di calcolo. Senza una riga di codice.',
			primary: 'Scopri i modelli',
			secondary: 'Guarda la demo',
			facts: ['Senza codice', 'Libero e gratuito', 'I tuoi dati restano da te'],
		},
		story: {
			grid: {
				title: 'Tutto il team, nella stessa tabella.',
				text: 'Ognuno ci lavora insieme, e tutti vedono la stessa cosa, aggiornata.',
			},
			copilot: {
				title: 'Chiedi. Il Copilot se ne occupa.',
				text: '«Chi devo richiamare questa settimana?» — ti propone il filtro giusto, e lo applichi con un clic.',
			},
			kanban: {
				title: 'Trascina. È aggiornato.',
				text: 'Ogni fase diventa una colonna; spostare una scheda significa modificare la riga.',
			},
			calendar: {
				title: 'Ogni data al suo posto.',
				text: 'Gli appuntamenti si visualizzano da soli, e si seguono fino nella tua agenda.',
			},
			dashboard: {
				title: 'E tutto, a colpo d’occhio.',
				text: 'I numeri si calcolano da soli, a partire dalle stesse righe.',
			},
		},
		stage: {
			aria: 'Il monitoraggio dei clienti di un team in basedb: griglia, Copilot, kanban, calendario, dashboard',
			tabs: {
				grid: 'Griglia',
				copilot: 'Copilot',
				kanban: 'Kanban',
				calendar: 'Calendario',
				dashboard: 'Dashboard',
			},
			project: 'Progetto principale',
			projectMeta: 'Progetto · 2 database',
			filterNav: 'Filtra la navigazione',
			base: 'Vendite',
			otherBase: 'Assistenza',
			tables: ['Clienti', 'Contatti', 'Preventivi'],
			baseSection: 'Database · Vendite',
			screens: ['Dashboard', 'Automazioni'],
			user: 'Léa Martin',
			views: { grid: 'Tutte le righe', kanban: 'Per fase', calendar: 'Appuntamenti' },
			toolbar: {
				filter: 'Filtra',
				columns: 'Colonne',
				group: 'Raggruppa',
				colors: 'Colori',
				sort: 'Ordina',
				configure: 'Configura',
			},
			search: 'Cerca…',
			add: 'Aggiungi',
			columns: {
				name: 'Cliente',
				status: 'Fase',
				owner: 'Seguito da',
				amount: 'Importo',
				next: 'Prossimo appuntamento',
			},
			statuses: {
				contact: 'Da contattare',
				meeting: 'Appuntamento',
				quote: 'Preventivo inviato',
				signed: 'Firmato',
			},
			clients: [
				'Panificio Martini',
				'Clinica dei Tigli',
				'Liceo Alessandro Manzoni',
				'Bici Solidale',
				'La Gastronomia Fine',
				'Fonderie del Po',
				'Bottega Moretti',
			],
			addRow: 'Aggiungi un record',
			perPage: 'Righe per pagina',
			card: 'Seguito da {owner}, appuntamento il {date}',
			addCard: 'Aggiungi una scheda',
			today: 'Oggi',
			month: 'Mese',
			week: 'Settimana',
			dashboards: 'Dashboard',
			questions: 'Domande',
			dashboard: 'Monitoraggio commerciale',
			dashboardText: 'L’essenziale a colpo d’occhio.',
			dashboardTabs: ['Panoramica', 'Attività'],
			period: 'Periodo',
			thisYear: 'Quest’anno',
			share: 'Condividi',
			edit: 'Modifica',
			explore: 'Esplora i dati',
			chart: 'Importo per cliente',
			byStage: 'Clienti per fase',
			kpis: {
				signed: 'Firmato',
				pending: 'Preventivi in attesa',
				rate: 'Clienti firmati',
			},
			copilot: {
				question: 'Chi devo richiamare questa settimana?',
				thinking: 'Riflessione…',
				answer: 'Quattro clienti aspettano una risposta: due preventivi inviati e due appuntamenti da preparare.',
				card: 'Filtra Clienti',
				filter: 'Fase: Preventivo inviato o Appuntamento',
				apply: 'Applica il filtro',
				applied: 'Filtro applicato',
				placeholder: 'Chiedi al Copilot…',
				filtered: '{n} righe filtrate',
			},
		},
		teaser: {
			tabs: { label: 'Scegli il video', short: 'In 40 secondi', full: 'Il tour completo' },
			titleAccent: 'in 40 secondi.',
			text: 'Tabelle, viste, moduli, automazioni e IA: l’essenziale di basedb, in musica.',
			duration: '40 s',
			inEnglish: 'I testi del video sono in inglese.',
		},

		video: {
			eyebrow: 'La demo',
			title: 'Tutto basedb,',
			titleAccent: 'in sette minuti.',
			text: 'Creare un database, riempirlo, condividerlo, automatizzarlo, pilotarlo: la visita completa, commentata.',
			play: 'Riproduci il video',
			duration: '6 min 36 s',
			chapters: 'Capitoli',
			captions: 'Inglese',
			inEnglish: 'Il video è in inglese, con sottotitoli in inglese.',
			list: [
				{ time: '0:10', title: 'Creare un database' },
				{ time: '0:49', title: 'Tabelle, campi e formule' },
				{ time: '1:31', title: 'Record e collaborazione' },
				{ time: '1:56', title: 'Sei viste sulle stesse righe' },
				{ time: '2:29', title: 'Moduli e questionari' },
				{ time: '3:28', title: 'Quiz' },
				{ time: '4:10', title: 'Automazioni' },
				{ time: '4:39', title: 'Dashboard' },
				{ time: '4:59', title: 'SQL per tutti' },
				{ time: '5:30', title: 'Cronologia e permessi' },
				{ time: '5:53', title: 'API, MCP e Copilot' },
			],
		},
		together: {
			eyebrow: 'Collaborazione',
			title: 'Tutti.',
			titleAccent: 'Nello stesso momento.',
			text: 'Le modifiche degli altri arrivano in diretta. Vedi chi guarda quale riga, ne discuti dove si trova, e basta una @ per avvisare un collega.',
			demo: {
				path: 'Vendite / Preventivi',
				here: '3 persone su questa tabella',
				columns: {
					client: 'Cliente',
					status: 'Fase',
					amount: 'Importo',
					due: 'Scadenza',
				},
				statuses: {
					draft: 'Bozza',
					sent: 'Inviato',
					signed: 'Firmato',
				},
				rows: [
					'Panificio Martini',
					'Clinica dei Tigli',
					'Liceo Alessandro Manzoni',
					'Bici Solidale',
					'La Gastronomia Fine',
					'Fonderie del Po',
				],
				comment: '@{name} puoi validare questo preventivo entro stasera?',
				reply: 'Validato!',
				toast: '{name} ha modificato «{field}»',
			},
			points: {
				live: {
					title: 'In diretta',
					text: 'Ogni modifica appare subito dagli altri, senza ricaricare la pagina.',
				},
				comments: {
					title: 'Commenti e menzioni',
					text: 'Si commenta una riga, si menziona un collega con @, e la campanella lo avvisa.',
				},
				undo: {
					title: 'Annullare senza rischi',
					text: 'Ctrl+Z annulla la tua ultima modifica — mai quella di un collega.',
				},
			},
			link: {
				href: '/fonctionnalites/collaboration/',
				label: 'Lavorare insieme',
			},
		},
		forms: {
			eyebrow: 'Moduli e questionari',
			title: 'Fai le tue domande.',
			titleAccent: 'Le risposte si ordinano da sole.',
			text: 'Un modulo su una sola pagina, o un questionario che pone una domanda per schermata, con i tuoi colori: condividi il link, e ogni risposta diventa una riga della tua tabella. Chi risponde non vede nient’altro.',
			modes: {
				label: 'Mostra le domande',
				survey: 'Questionario',
				form: 'Modulo',
			},
			demo: {
				title: 'Richiesta di preventivo',
				description: 'Tre domande, e ti rispondiamo entro 48 ore.',
				count: '3 domande',
				start: 'Inizia',
				ok: 'OK',
				hint: 'o Invio',
				submit: 'Invia la mia richiesta',
				org: {
					label: 'La tua organizzazione',
					answer: 'Caffè delle Arti',
				},
				need: {
					label: 'La tua esigenza',
					options: ['Sito web', 'Identità visiva', 'Catalogo'],
				},
				budget: {
					label: 'Il tuo budget',
					help: 'IVA esclusa, anche solo approssimativo.',
				},
				sent: 'Inviato!',
				thanks: 'Grazie! Ti rispondiamo entro 48 ore.',
				poweredBy: 'Modulo realizzato con basedb',
				path: 'Vendite / Richieste',
				view: 'Tutte le richieste',
				columns: {
					org: 'Organizzazione',
					need: 'Esigenza',
					budget: 'Budget',
					stage: 'Fase',
				},
				stages: {
					new: 'Nuova',
					called: 'Richiamata',
					quote: 'Preventivo inviato',
				},
				rows: ['Panificio Martini', 'Clinica dei Tigli', 'Bici Solidale', 'Fonderie del Po'],
				open: 'Aperto',
				answers: {
					one: '{n} risposta',
					other: '{n} risposte',
				},
				active: 'Link attivo',
			},
			points: {
				survey: {
					title: 'Una domanda per schermata',
					text: 'A schermo intero, da tastiera: Invio per continuare, A, B, C per scegliere — una scelta unica fa passare da sola alla successiva, e l’invio si festeggia.',
				},
				access: {
					title: 'Pubblico o riservato',
					text: 'Chiunque abbia il link risponde senza account — oppure solo i membri connessi, e la risposta porta il loro nome.',
				},
				closed: {
					title: 'Il resto resta chiuso',
					text: 'Rispondere non mostra nient’altro della tabella. Il link si chiude a una data, o dopo un numero di risposte.',
				},
			},
			link: {
				href: '/fonctionnalites/formulaires-partages/',
				label: 'I moduli',
			},
		},
		automate: {
			eyebrow: 'Automazioni',
			title: 'Lavora',
			titleAccent: 'mentre dormi.',
			text: 'Quando una riga arriva o cambia, a un’ora fissa o con un clic su un pulsante, basedb concatena i passaggi: sceglie il ramo giusto, chiede all’IA, avvisa chi serve. E ogni esecuzione si può rileggere, passaggio dopo passaggio.',
			clock: '03:12',
			crumb: 'Vendite / Automazioni',
			create: 'Nuova automazione',
			list: [
				{
					name: 'Nuova richiesta',
					when: 'Viene creata una riga',
				},
				{
					name: 'Preventivo firmato',
					when: 'Viene modificata una riga',
				},
				{
					name: 'Solleciti del lunedì',
					when: 'Ogni lunedì alle 09:00',
				},
			],
			active: 'Attiva',
			test: 'Prova su una riga',
			save: 'Salva',
			when: 'Quando',
			trigger: 'Viene creata una riga',
			table: 'In Richieste',
			steps: {
				branch: {
					kind: 'Condizione',
					text: '2 rami',
					run: 'ramo «Grande progetto»',
				},
				notify: {
					kind: 'Avvisa qualcuno',
					text: 'Léa Martin',
					run: '1 persona avvisata',
				},
				create: {
					kind: 'Crea una riga',
					text: 'Un appuntamento, in Agenda',
					run: 'fatto',
				},
				slack: {
					kind: 'Invia su Slack',
					text: 'Nel canale #vendite',
					run: 'fatto',
				},
				ai: {
					kind: 'Chiedi all’IA',
					text: 'Redigere una prima risposta',
					run: 'risposta di {n} caratteri',
				},
				update: {
					kind: 'Modifica una riga',
					text: 'Risposta, Fase',
					run: 'fatto',
				},
			},
			paths: {
				big: 'Grande progetto',
				condition: 'budget gt 5000',
				otherwise: 'Altrimenti',
			},
			answer: 'Buongiorno, e grazie per la Sua richiesta! Léa, che seguirà la Sua nuova identità visiva, Le telefona domani mattina.',
			addStep: 'Aggiungi un passaggio',
			tabs: {
				settings: 'Opzioni',
				runs: 'Esecuzioni',
			},
			runsText: 'Le ultime 50, conservate 30 giorni. Scegline una per vedere, sul flusso, il ramo che ha preso.',
			running: 'In corso',
			succeeded: 'Riuscita',
			started: 'riga creata · {when}',
			now: 'proprio ora',
			earlier: ['ieri alle 18:40', 'ieri alle 11:02'],
			done: 'Riuscita · 5 passaggi · 1,3 s',
			points: {
				when: {
					title: 'Al momento giusto',
					text: 'Una riga creata o modificata, un’ora fissa, un pulsante — e una condizione per partire solo quando serve.',
				},
				paths: {
					title: 'Più rami',
					text: 'Una condizione apre rami, ciascuno con i suoi passaggi; ciò che un passaggio trova, il successivo può citarlo.',
				},
				copilot: {
					title: 'Descritta in una frase',
					text: '«Quando arriva una richiesta, avvisa Léa se il budget supera i 5.000 €»: il Copilot costruisce il flusso, tu lo rileggi.',
				},
			},
			link: {
				href: '/fonctionnalites/automatisations/',
				label: 'Le automazioni',
			},
		},
		glance: {
			eyebrow: 'Dashboard',
			title: 'Vedi tutto.',
			titleAccent: 'A colpo d’occhio.',
			text: 'Numeri, curve, obiettivi: le tue dashboard si costruiscono con il mouse a partire dalle tue tabelle, e restano aggiornate da sole. Un filtro, e tutta la dashboard segue.',
			demo: {
				title: 'Pilotaggio commerciale',
				filters: ['Quest’anno', 'Tutte le città'],
				revenue: 'Fatturato',
				signed: 'Preventivi firmati',
				rate: 'Tasso di firma',
				goal: 'Obiettivo annuale',
				byMonth: 'Fatturato per mese',
				byStage: 'Preventivi per fase',
				stages: ['Inviati', 'In trattativa', 'Firmati'],
				bySector: 'Clienti per settore',
				sectors: ['Commercio', 'Sanità', 'Istruzione', 'Industria'],
				shared: 'Condiviso tramite link',
			},
			points: {
				viz: {
					title: 'Quindici visualizzazioni',
					text: 'Numeri, tendenze, obiettivi, curve, settori, imbuti, tabelle pivot, mappe.',
				},
				filters: {
					title: 'Filtri comuni',
					text: 'Il periodo, un cliente, una città: un filtro pilota una scheda, più schede, o tutta la dashboard.',
				},
				share: {
					title: 'Condiviso da un link',
					text: 'Pubblico o riservato al team, e incorporabile in un altro sito.',
				},
			},
			link: {
				href: '/fonctionnalites/tableaux-de-bord/',
				label: 'Le dashboard',
			},
		},
		ai: {
			eyebrow: 'Intelligenza artificiale',
			title: 'Descrivi.',
			titleAccent: 'basedb costruisce.',
			text: 'Una frase basta per ottenere un database completo, che rileggi prima di crearlo. Poi, il Copilot propone filtri, grafici e automazioni, e i campi IA riassumono, classificano e redigono al posto tuo.',
			prompt: 'Un monitoraggio delle candidature per le nostre tre posizioni aperte, con i colloqui.',
			thinking: 'Tre tabelle collegate, pronte da rileggere.',
			tables: {
				jobs: {
					name: 'Posizioni',
					fields: ['Titolo', 'Reparto', 'Aperta il'],
				},
				people: {
					name: 'Candidati',
					fields: ['Nome', 'Posizione', 'Fase', 'Sintesi'],
				},
				talks: {
					name: 'Colloqui',
					fields: ['Candidato', 'Data', 'Con', 'Parere'],
				},
			},
			aiField: 'Sintesi',
			aiValue: 'Sei anni in gestione progetti, a suo agio con i clienti; da approfondire: l’inglese.',
			create: 'Crea il database',
			providers: 'Con il fornitore di tua scelta — OpenAI, Anthropic, Mistral, o un modello installato da te. Niente parte senza il tuo consenso.',
			link: {
				href: '/fonctionnalites/ia/',
				label: 'L’IA in basedb',
			},
		},
		features: {
			title: 'Tutto quello che serve.',
			titleAccent: 'E molto altro ancora.',
			text: 'Ogni funzione scrive nelle stesse tabelle, con gli stessi permessi, nella stessa cronologia.',
			tiles: {
				views: {
					stat: '10',
					title: 'modi di vedere i tuoi dati',
					text: 'Griglia, kanban, calendario, sequenza temporale, galleria, elenco, mappa, modulo, questionario e quiz, sulle stesse righe. Ognuno sceglie la propria.',
					href: '/fonctionnalites/vues/',
				},
				history: {
					stat: 'Ctrl+Z',
					title: 'Niente si perde',
					text: 'Ogni modifica viene conservata con il valore precedente; un errore si annulla, una riga eliminata si ripristina.',
					href: '/fonctionnalites/historique/',
				},
				forms: {
					title: 'Moduli',
					text: 'Un link pubblico o riservato al team: ogni risposta arriva nella tabella, senza aprire il resto.',
					href: '/fonctionnalites/formulaires-partages/',
				},
				viz: {
					stat: '15',
					title: 'visualizzazioni',
					text: 'Numeri, tendenze, obiettivi, curve, settori, imbuti, tabelle pivot e mappe.',
					href: '/fonctionnalites/tableaux-de-bord/',
				},
				formulas: {
					code: 'IF([Montant] > 10000, "Grand compte", "")',
					title: 'Formule in francese o in inglese',
					text: 'Come in un foglio di calcolo — SI, ARRONDI, JOURS… o IF, ROUND, DAYS — ma calcolate per tutto il team.',
					href: '/fonctionnalites/tables-et-champs/#formule',
				},
				rights: {
					title: 'Ognuno vede quello che deve vedere',
					text: 'Lettura, modifica, gestione, team per team; una colonna sensibile può essere nascosta.',
					href: '/fonctionnalites/droits/',
				},
				mentions: {
					bubble: '@Camille',
					title: 'Commenti e menzioni',
					text: 'Si discute di una riga proprio dove si trova, e la campanella avvisa.',
					href: '/fonctionnalites/collaboration/',
				},
				relations: {
					title: 'Tutto è collegato',
					text: 'Clienti, progetti, fatture: i totali e le ricerche attraversano le relazioni.',
					href: '/fonctionnalites/tables-et-champs/',
				},
				templates: {
					stat: '10',
					title: 'modelli pronti',
					text: 'CRM, selezione del personale, magazzino, eventi… o un database descritto in una frase all’IA.',
					href: '/modeles/',
				},
				import: {
					title: 'Importazione in un gesto',
					text: 'Trascina una cartella di lavoro Excel o un CSV: colonne e tipi vengono indovinati, la tabella viene creata.',
					href: '/guides/premiers-pas/',
				},
				agenda: {
					title: 'Fino nella tua agenda',
					text: 'Un calendario diventa un feed per Google Calendar, Outlook o Apple Calendar.',
					href: '/fonctionnalites/vues-partagees/',
				},
				files: {
					title: 'File e immagini',
					text: 'Preventivi, foto, contratti; un’immagine diventa la copertina di una scheda.',
					href: '/fonctionnalites/fichiers/',
				},
				share: {
					title: 'Viste condivise',
					text: 'Una vista in sola lettura tramite un link, incorporabile nel tuo sito.',
					href: '/fonctionnalites/vues-partagees/',
				},
				sync: {
					title: 'Tabelle sincronizzate',
					text: 'Tenute aggiornate da un CSV online, un’agenda o un altro basedb.',
					href: '/integrations/synchronisation/',
				},
				signin: {
					title: 'Accesso semplice',
					text: 'Google, Microsoft o password; si invitano i colleghi con un link.',
					href: '/hebergement/connexion/',
				},
				languages: {
					title: 'Nella tua lingua',
					text: 'L’interfaccia usa la lingua di ognuno, tra venti disponibili.',
					href: '/fonctionnalites/droits/#le-tue-impostazioni',
				},
			},
		},
		yours: {
			eyebrow: 'Libero e self-hosted',
			per: 'a persona. Per sempre.',
			text: 'basedb è un software libero. Installalo sul tuo server e invita tutto il team: nessun abbonamento, nessuna licenza da contare, e i tuoi dati restano da te.',
			points: {
				home: {
					title: 'Da te',
					text: 'Sul tuo server o su quello del tuo hosting, con backup come qualsiasi database PostgreSQL.',
				},
				free: {
					title: 'Libero',
					text: 'Con licenza AGPL-3.0: il codice è aperto, e lo resterà.',
				},
				ai: {
					title: 'L’IA di tua scelta',
					text: 'Un fornitore del mercato, un modello installato da te — o nessuna IA.',
				},
			},
			link: {
				href: '/guides/installation/',
				label: 'Installa basedb',
			},
		},
		gallery: {
			eyebrow: 'Modelli',
			title: 'Pronto in un minuto.',
			text: 'Parti da un modello, con le sue tabelle, le sue viste, la sua dashboard e righe di esempio, poi adattalo al tuo modo di lavorare.',
			use: 'Scopri',
			ask: {
				title: 'Niente corrisponde?',
				text: 'Descrivi la tua esigenza in una frase: l’IA ti propone un database su misura.',
			},
			all: 'Vedi tutti i modelli',
			previous: 'Modelli precedenti',
			next: 'Modelli successivi',
		},
		developers: {
			title: 'E dal punto di vista tecnico?',
			text: 'Ogni tabella è una vera tabella PostgreSQL. API REST, webhook, server MCP per gli agenti IA, e un’installazione in un comando.',
			link: 'La pagina degli sviluppatori',
		},
		faq: {
			title: 'Le tue domande',
			items: [
				{
					q: 'Bisogna sapere programmare?',
					a: 'No. Si creano le proprie tabelle, viste, moduli, dashboard e automazioni con il mouse. Le formule si scrivono come in un foglio di calcolo, in francese o in inglese: SI o IF, ARRONDI o ROUND, JOURS o DAYS…',
				},
				{
					q: 'Quanto costa?',
					a: 'Niente: basedb è un software libero, senza abbonamento né prezzo a persona. Ti serve solo un server su cui installarlo.',
				},
				{
					q: 'Come si installa?',
					a: 'Su un server, con Docker: due file e un comando, pochi minuti per la persona che si occupa della tua informatica. La guida all’installazione spiega tutto, passo per passo.',
				},
				{
					q: 'Possiamo recuperare i nostri fogli di calcolo?',
					a: 'Sì: trascina la tua cartella di lavoro Excel, o un CSV, in basedb. L’importazione indovina il tipo di ogni colonna, crea la tabella e indica riga per riga ciò che non è riuscita a recuperare.',
				},
				{
					q: 'Si può lavorare in più persone contemporaneamente?',
					a: 'È fatto apposta per questo. Le modifiche degli altri compaiono in diretta, si commenta una riga, si menziona un collega con @, e una campanella avvisa.',
				},
				{
					q: 'E l’IA, legge i nostri dati?',
					a: 'Solo se lo decidi tu. Senza un fornitore di IA configurato, non parte nulla. In seguito, un campo o un’automazione che richiama l’IA invia solo ciò che la sua istruzione cita, dopo il tuo consenso.',
				},
				{
					q: 'In quale lingua?',
					a: 'Nella tua: l’interfaccia usa la lingua del tuo browser, tra venti disponibili, e ognuno può cambiarla nelle proprie impostazioni.',
				},
			],
		},
		cta: {
			title: 'Il tuo team merita di meglio',
			titleAccent: 'che un file condiviso.',
			text: 'Parti da un modello, invita i tuoi colleghi, e lascia i «FINALE (2)» al passato.',
			primary: 'Scopri i modelli',
			secondary: 'Installa basedb',
		},
	},
	hero: {
		badge: 'Novità: automazioni a flusso, dashboard e viste SQL',
		title: ['Il database collaborativo', 'in cui ogni tabella è', 'una vera tabella'],
		titleAccent: 'PostgreSQL.',
		lead: 'La semplicità di un foglio di calcolo condiviso — griglie, viste, moduli, permessi — e dati che vivono in tabelle <strong>tipizzate e con nomi leggibili</strong>. Il tuo team lavora nell’interfaccia; i tuoi script, i tuoi strumenti di BI, i tuoi agenti IA e <code>psql</code> leggono le stesse righe.',
		install: 'Installa con Docker',
		features: 'Scopri le funzionalità',
		copy: 'Copia il comando',
		facts: ['Self-hosted', 'AGPL-3.0', 'API REST & server MCP'],
		demo: {
			url: 'basedb.tuo-dominio.it',
			project: 'Progetto principale',
			projectMeta: 'Progetto · 2 database',
			filter: 'Filtra database e tabelle',
			sales: 'Vendite',
			support: 'Supporto',
			environment: 'Produzione',
			clients: 'Clienti',
			opportunities: 'Opportunità',
			quotes: 'Preventivi',
			baseSection: 'Database · Vendite',
			screens: ['Dashboard', 'Automazioni'],
			copilot: '✦ Copilot',
			allRows: '▦ Tutte le righe ▾',
			tools: ['Filtra', 'Raggruppa', 'Colori'],
			search: 'Cerca…',
			add: '+ Aggiungi',
			columns: {
				name: 'Nome',
				status: 'Stato',
				amount: 'Importo',
				client: 'Cliente',
			},
			statuses: {
				nouveau: 'Nuova',
				qualifie: 'Qualificata',
				proposition: 'Proposta',
				negociation: 'Trattativa',
				gagne: 'Vinta',
				perdu: 'Persa',
			},
			deals: {
				portail: {
					name: 'Rifacimento del portale',
					client: 'Comune di Castelvento',
				},
				erp: {
					name: 'Migrazione ERP',
					client: 'Gruppo Delorme',
				},
				audit: {
					name: 'Audit di sicurezza',
					client: 'Clinica San Rocco',
				},
				billetterie: {
					name: 'Biglietteria online',
					client: 'Teatro della Rotonda',
				},
				flotte: {
					name: 'Monitoraggio flotta',
					client: 'Trasporti Kerlann',
				},
				mobile: {
					name: 'App mobile',
					client: 'Atelier Moreau',
				},
				intranet: {
					name: 'Rifacimento dell’intranet',
					client: '',
				},
			},
			toastTitle: 'Modulo «Richiesta di preventivo»',
			toastText: 'risposta pubblica · ha creato «{name}»',
			cursor: 'Camille',
			psqlRows: '(2 righe)',
		},
	},
	showcase: {
		label: 'L’interfaccia, per davvero',
		title: 'Tutto ciò che il tuo team si aspetta da un foglio di calcolo condiviso.',
		tabs: 'Schermate dell’interfaccia',
		alt: 'basedb — {labelLower}: {caption}',
		shots: {
			grille: {
				label: 'Griglia',
				caption: 'Una griglia che scrive in una vera tabella — e campi calcolati: una durata con una formula, la città del cliente con una ricerca, il numero di attività con un conteggio.',
			},
			kanban: {
				label: 'Kanban',
				caption: 'Le stesse righe in colonne, in base a una selezione singola: un’immagine di copertina, una descrizione che cita la riga. Trascinare una scheda significa modificare la riga.',
			},
			galerie: {
				label: 'Galleria',
				caption: 'Delle carte con la loro immagine, un colore per stato: la galleria, uno degli otto modi di leggere una tabella.',
			},
			chronologie: {
				label: 'Sequenza temporale',
				caption: 'Barre tra due date, e le frecce delle loro dipendenze — in rosso quando l’ordine non regge più.',
			},
			tableaux: {
				label: 'Dashboard',
				caption: 'Schede in griglia, in tab, sotto filtri comuni: una tendenza, un obiettivo, serie in pila — lette con i permessi di ciascuno.',
			},
			automatisations: {
				label: 'Automazioni',
				caption: 'Quando un’attività è fatta, cercare cosa resta del progetto; se non resta nulla, l’IA scrive la nota di chiusura e il progetto passa a «Consegnato». Ogni esecuzione si legge sul flusso, passaggio per passaggio.',
			},
			commentaires: {
				label: 'Commenti',
				caption: 'Si discute di una riga proprio dove si trova: commenti, menzioni, notifiche.',
			},
			formulaire: {
				label: 'Modulo',
				caption: 'Un modulo si condivide tramite un link, pubblico o riservato ai membri connessi.',
			},
			historique: {
				label: 'Cronologia',
				caption: 'Ogni scrittura, da dovunque arrivi — una persona, un’automazione, l’SQL diretto — con i valori precedenti.',
			},
			sql: {
				label: 'SQL',
				caption: 'Una query sui nomi reali, salvata sotto le tabelle per tutto il team — che ognuno esegue con i propri permessi.',
			},
			vuesSql: {
				label: 'Viste SQL',
				caption: 'Vere viste PostgreSQL, sistemate tra le tabelle con il loro colore e la loro icona — e leggibili da psql.',
			},
		},
	},
	features: {
		postgres: {
			label: 'PostgreSQL, senza traduzioni',
			title: 'Una griglia per il team, una vera tabella {per i tuoi strumenti.}',
			lead: 'Nessun modello generico, nessun JSON tuttofare, nessun <code>field_1837</code>: un database è uno schema, una tabella è una tabella, un campo è una colonna tipizzata, con un nome leggibile.',
			bullets: [
				'<strong>Tipi nativi</strong>: <code>text</code>, <code>numeric</code>, <code>date</code>, <code>timestamptz</code>, <code>boolean</code> — e vere chiavi esterne per le relazioni.',
				'<strong>Vincoli garantiti dal database</strong>: selezioni singole come <code>CHECK</code>, indirizzi web ed email verificati, relazioni come <code>FOREIGN KEY</code>.',
				'<strong>Formule calcolate da PostgreSQL</strong>: <code>JOURS([Fin]; [Début])</code> diventa una colonna generata, che <code>psql</code> legge come le altre.',
				'<strong>L’SQL diretto resta consentito</strong> — e persino lui finisce in cronologia, tramite trigger.',
				'<strong>Query e viste SQL</strong> nell’interfaccia: query salvate sotto le tabelle, per sé o per il team, e vere viste PostgreSQL sistemate tra di esse, che anche <code>psql</code> legge.',
				'<strong>Rinominare non significa rompere</strong>: il vecchio nome resta servito da un alias di compatibilità, il tempo di migrare le tue query.',
			],
			links: [
				{
					href: '/integrations/sql/',
					label: 'Lavorare in SQL',
				},
				{
					href: '/fonctionnalites/requetes-et-vues-sql/',
					label: 'Query e viste SQL',
				},
				{
					href: '/architecture/principes/',
					label: 'I principi',
				},
			],
		},
		automations: {
			label: 'Automatizzare',
			title: 'Automazioni a flusso, {l’IA a ogni passaggio.}',
			lead: 'Quando una riga cambia, a orario fisso o con un clic: un editor a grafo concatena i passaggi, e ogni esecuzione si rilegge sul flusso.',
			bullets: [
				'<strong>Un flusso leggibile</strong>: il trigger, poi ogni passaggio in una scheda; un <strong>+</strong> su un collegamento aggiunge un passaggio in quel punto.',
				'<strong>Cercare, decidere, scrivere</strong>: trovare una riga, prendere un ramo o un altro in base a delle condizioni, modificare, creare, avvisare, chiamare un webhook, scrivere su Slack.',
				'<strong>Chiedi all’IA</strong> in un passaggio: un’istruzione che cita la riga, una risposta letta come testo, numero, data o scelta, che i passaggi successivi riutilizzano.',
				'<strong>Il Copilot</strong> propone un’intera automazione a partire da una frase, o spiega perché un’esecuzione non è riuscita — nulla viene salvato senza di te.',
				'<strong>Con i permessi di chi l’ha scritta</strong>, e in cronologia come qualsiasi altra scrittura.',
			],
			links: [
				{
					href: '/fonctionnalites/automatisations/',
					label: 'Le automazioni',
				},
				{
					href: '/fonctionnalites/automatisations/#il-copilot',
					label: 'Il Copilot',
				},
			],
			alt: 'basedb — l’automazione «Progetto consegnato» nell’editor a flusso: quando un’attività è fatta, annotare l’ora, cercare cosa resta del progetto, prendere il ramo «Altrimenti», chiedere all’IA la nota di chiusura, poi consegnare il progetto; a destra, le sue ultime esecuzioni, passaggio per passaggio.',
		},
		dashboards: {
			label: 'Analizzare',
			title: 'Dashboard {senza lasciare le tue tabelle.}',
			lead: 'Domande poste con il mouse o in SQL, quindici visualizzazioni, filtri comuni — ognuno le legge con i propri permessi.',
			bullets: [
				'<strong>Domande</strong>: una tabella, i suoi join, filtri e misure per giorno, settimana, mese o anno — oppure SQL in sola lettura.',
				'<strong>Quindici visualizzazioni</strong>: numero, tendenza, avanzamento, indicatore, barre, linee, torta, imbuto, tabella pivot, mappa…',
				'<strong>Esplorare con un clic</strong>: un punto apre le sue righe, o un periodo più fine.',
				'<strong>Filtri comuni</strong> che controllano una, più o tutte le schede.',
				'<strong>Condividere tramite un link</strong>, pubblico o riservato ai membri, e incorporare in un altro sito.',
			],
			links: [
				{
					href: '/fonctionnalites/tableaux-de-bord/',
					label: 'Le dashboard',
				},
			],
			alt: 'basedb — una dashboard: tendenza del mese, obiettivo di incasso, fatturato per mese, sentiment delle recensioni, sotto filtri di periodo e di cliente.',
		},
		rights: {
			label: 'Collaborare senza aprire tutto',
			title: 'Permessi fino al campo, {una cronologia senza buchi.}',
			lead: 'I permessi si concedono ai gruppi, su un progetto, un database o una tabella, e scendono su tutto ciò che sta sotto. Una colonna sensibile può essere nascosta a un gruppo, o resa non modificabile per lui.',
			bullets: [
				'<strong>Quattro livelli</strong>: Nessun accesso, Lettura, Modifica, Gestione — cumulativi da un gruppo all’altro.',
				'<strong>Anche l’SQL segue i tuoi permessi</strong>: nell’interfaccia, una query vede solo le tabelle e i campi a cui hai accesso — ed è PostgreSQL ad applicarlo.',
				'<strong>Ogni scrittura viene catturata</strong> nella sua transazione: interfaccia, API, agente, modulo pubblico o SQL diretto.',
				'<strong>Una modifica si annulla</strong>, una riga eliminata si ripristina, e anche un database eliminato.',
				'<strong>L’amministrazione chiede conferma</strong>: cambiare un permesso richiede di aver ridigitato la password negli ultimi cinque minuti.',
			],
			links: [
				{
					href: '/fonctionnalites/droits/',
					label: 'Permessi e gruppi',
				},
				{
					href: '/fonctionnalites/historique/',
					label: 'La cronologia',
				},
			],
		},
		agents: {
			label: 'API REST · MCP · webhook',
			title: 'I tuoi agenti IA accedono ai dati, {non alle chiavi di casa.}',
			lead: 'Il server MCP dà dodici strumenti agli agenti; l’API REST, gli stessi dati ai tuoi programmi. Un unico punto di controllo dei permessi, gli stessi log.',
			bullets: [
				'<strong>Un token per database</strong>, in sola lettura per impostazione predefinita, mai con più permessi della persona che l’ha creato.',
				'<strong>Un agente non elimina nulla</strong> e non cambia la struttura: la propone, una persona approva.',
				'<strong>Una documentazione generata</strong> per ogni database, filtrata in base ai tuoi permessi, con la sua specifica OpenAPI 3.1.',
				'<strong>Webhook</strong> firmati, ordinati e ritentati a ogni scrittura.',
			],
			links: [
				{
					href: '/integrations/mcp/',
					label: 'Collegare un agente',
				},
				{
					href: '/integrations/api-rest/',
					label: 'L’API REST',
				},
			],
		},
	},
	sqlVisual: {
		interface: 'Interfaccia',
		title: 'Nuovo campo · Opportunità',
		labelField: 'Etichetta',
		labelValue: 'Importo',
		typeField: 'Tipo',
		typeValue: 'Numero',
		descriptionField: 'Descrizione',
		descriptionValue: 'Importo del contratto IVA esclusa',
		required: 'Obbligatorio',
		ai: 'IA',
		migration: 'una migrazione pianificata, lock brevi',
	},
	rightsVisual: {
		groups: ['Amministratori', 'Commerciali', 'Supporto'],
		project: 'Progetto principale',
		sales: 'Vendite',
		opportunities: 'Opportunità',
		clients: 'Clienti',
		support: 'Supporto',
		inherited: 'ereditato',
		levels: {
			none: 'Nessun accesso',
			read: 'Lettura',
			edit: 'Modifica',
			manage: 'Gestione',
		},
		field: 'Campo «Margine»',
		hidden: 'Nascosto',
		sqlChange: '<b>Sessione SQL diretta</b> ha modificato <b>«Migrazione ERP»</b>',
		sqlMeta: '02:46 · connessione locale · psql',
		sqlDiff: 'Importo: <s>125.000</s> → 130.000',
		undo: '↶ Annulla',
		formChange: '<b>Modulo «Richiesta di preventivo»</b> ha creato <b>«Rifacimento dell’intranet»</b>',
		formMeta: 'risposta pubblica · pubblicato da Camille',
	},
	agentVisual: {
		agent: 'Agente',
		via: 'connesso tramite MCP · token «Vendite»',
		question: 'Quante opportunità sono in trattativa, e per quale importo?',
		listArgs: 'opportunites · statut = Trattativa',
		answer: 'Due opportunità, <b>182.000 €</b> in totale: Migrazione ERP (130.000 €) e Monitoraggio flotta (52.000 €).',
		request: 'Aggiungi un campo «Probabilità» in percentuale.',
		proposeArgs: 'opportunites · Probabilità · number',
		proposed: 'È una proposta: una persona del team deve approvarla in basedb.',
		badge: 'Proposta',
		expires: 'scade tra 23 h',
		what: 'Aggiungere il campo <b>«Probabilità»</b> (Numero) a <b>Opportunità</b>',
		by: 'Proposta dall’agente · token «Vendite»',
		refuse: 'Rifiuta',
		approve: 'Approva',
	},
	bento: {
		label: 'E tutto il resto',
		title: 'Ciò che ci si aspetta da uno strumento di team, senza rinunciare a PostgreSQL.',
		text: 'Ogni funzione scrive nelle stesse tabelle, con gli stessi permessi, nella stessa cronologia.',
		more: 'Scopri di più →',
		views: {
			title: 'Dieci viste sulle stesse righe',
			text: 'Collaborative per tutto il team, o personali solo per te: ognuno sceglie il proprio modo di leggere, nessuno copia i dati.',
			chips: [
				'Griglia',
				'Kanban',
				'Calendario',
				'Sequenza temporale',
				'Galleria',
				'Elenco',
				'Mappa',
				'Modulo',
				'Questionario',
				'Quiz',
			],
		},
		forms: {
			title: 'Moduli condivisi',
			text: 'Un link pubblico, o riservato ai membri connessi. Rispondere non dà alcun permesso sulla tabella.',
			href: '/fonctionnalites/formulaires-partages/',
		},
		environments: {
			title: 'Ambienti',
			text: 'Un database, più varianti. Confronta la struttura, migra dall’una all’altra, sincronizza le righe.',
			chips: ['Produzione', 'Collaudo', 'Sviluppo'],
			href: '/fonctionnalites/environnements/',
		},
		collaboration: {
			title: 'Lavorare insieme',
			text: 'Le scritture degli altri arrivano in tempo reale, vedi chi guarda quale riga, e se ne discute proprio lì: commenti, menzioni, notifiche. Ctrl+Z annulla l’ultima scrittura, e rifiuta piuttosto che sovrascrivere il lavoro di un altro.',
			chips: ['Tempo reale', 'Presenza', 'Commenti', 'Menzioni', 'Ctrl+Z'],
			href: '/fonctionnalites/collaboration/',
		},
		small: {
			ai: {
				title: 'L’IA nella griglia',
				text: 'Un campo compilato da un modello a partire dalle altre colonne, e un Copilot che propone filtri, query e colonne, applicati con un clic. OpenAI, Anthropic, Mistral, o un modello eseguito sul tuo computer.',
				code: 'Riassumi {{Notes}} in una frase',
				href: '/fonctionnalites/ia/',
			},
			formulas: {
				title: 'Relazioni e formule',
				text: 'Vere chiavi esterne, formule in francese o in inglese calcolate da PostgreSQL, e ricerche, aggregazioni e conteggi attraverso le relazioni.',
				code: 'ROUND([Montant HT] * (1 + [Taux de TVA]), 2)',
				href: '/fonctionnalites/tables-et-champs/#formule',
			},
			richText: {
				title: 'Testo formattato e variabili',
				text: 'Un editor visuale per il testo formattato, sanificato in scrittura; e in qualsiasi testo lungo, {{Ville}} si legge con il valore della riga.',
				code: 'Consegna il {{Date}} a {{Ville}}',
				href: '/fonctionnalites/tables-et-champs/#testo-formattato-e-variabili',
			},
			languages: {
				title: 'Nella tua lingua',
				text: 'L’interfaccia usa la lingua del browser, tra venti disponibili; ognuno può cambiarla nelle proprie impostazioni.',
				href: '/fonctionnalites/droits/#le-tue-impostazioni',
			},
			sharedViews: {
				title: 'Viste condivise',
				text: 'Una vista in sola lettura tramite un link, incorporabile in un altro sito; un calendario diventa un feed per la tua agenda.',
				href: '/fonctionnalites/vues-partagees/',
			},
			syncedTables: {
				title: 'Tabelle sincronizzate',
				text: 'Una tabella tenuta aggiornata da un CSV online, un calendario, o la vista condivisa di un altro basedb.',
				href: '/integrations/synchronisation/',
			},
			templates: {
				title: 'Modelli di database',
				text: 'Dieci modelli pronti all’uso, un database descritto in una frase all’IA, e il tuo salvato come modello.',
				href: '/modeles/',
			},
			files: {
				title: 'File e immagini',
				text: 'Sul disco dell’host o in uno storage compatibile S3: AWS, Scaleway, OVH, Cloudflare R2, Garage, MinIO…',
				href: '/fonctionnalites/fichiers/',
			},
			import: {
				title: 'Importazione Excel, CSV e JSON',
				text: 'Trascina un file: l’importazione indovina i tipi, crea la tabella o completa una tabella esistente, e indica riga per riga cosa viene rifiutato.',
				href: '/guides/premiers-pas/',
			},
			accounts: {
				title: 'Account e inviti',
				text: 'Ognuno crea il proprio account e i propri progetti, e invita tramite un link in Lettura, Modifica o Gestione; accesso con password, Google, Microsoft o qualsiasi fornitore OpenID Connect.',
				href: '/hebergement/connexion/',
			},
			webhooks: {
				title: 'Webhook',
				text: 'Ogni scrittura può avvisare un altro sistema: payload firmati, consegnati in ordine, ritentati.',
				href: '/integrations/webhooks/',
			},
			settings: {
				title: 'Impostazioni personali',
				text: 'La tua lingua, il tuo tema, l’ordine delle date, le tue notifiche, le tue sessioni e i tuoi token, in un unico posto.',
				href: '/fonctionnalites/droits/#le-tue-impostazioni',
			},
		},
	},
	selfHost: {
		label: 'Self-hosted',
		title: 'I tuoi dati restano {a casa tua.}',
		lead: 'basedb è un software libero (AGPL-3.0): un’unica immagine, un database PostgreSQL, e basta — nessun servizio di terze parti imposto, nessuna telemetria. Fanne il backup con <code>pg_dump</code>, leggilo con qualsiasi client PostgreSQL.',
		services: {
			db: 'PostgreSQL 16, i tuoi dati',
			basedb: 'L’interfaccia, l’API REST e il server MCP, su un’unica porta',
			proxy: 'Caddy, HTTPS automatico (opzionale)',
		},
		links: [
			{
				href: '/hebergement/docker/',
				label: 'Guida Docker Compose →',
			},
			{
				href: '/hebergement/variables/',
				label: 'Tutte le variabili →',
			},
		],
		steps: [
			{
				title: 'Scarica basedb',
				code: 'git clone https://github.com/eodia/basedb.git\ncd basedb && cp .env.example .env',
			},
			{
				title: 'Due segreti in .env',
				code: 'POSTGRES_PASSWORD=una-password-robusta\n# openssl rand -base64 32\nBASEDB_ENCRYPTION_KEY=…',
			},
			{
				title: 'Avvia',
				code: 'docker compose up -d\n# poi http://localhost:3000: crea il tuo account',
			},
		],
	},
	faq: {
		label: 'Domande frequenti',
		title: 'Quello che ci chiedono spesso.',
		text: 'Un’altra domanda? <a href="/guides/introduction/">La documentazione</a> ha di sicuro la risposta.',
		items: {
			difference: {
				q: 'In cosa basedb è diverso dagli altri database collaborativi?',
				a: 'Nel luogo in cui vivono i dati. Dove altri sistemano le tue righe in un modello generico (colonne numerate, documenti JSON), basedb crea una vera tabella PostgreSQL per ogni tabella, una vera colonna tipizzata per ogni campo, con nomi leggibili. I tuoi dati restano utilizzabili anche senza basedb.',
			},
			sql: {
				q: 'Posso scrivere direttamente in SQL nelle tabelle?',
				a: 'Sì. I vincoli (tipi, obbligatorietà, selezioni singole, chiavi esterne) sono garantiti da PostgreSQL stesso, e un trigger registra in cronologia persino le scritture fatte in SQL diretto, con la sessione che le ha fatte. La console SQL dell’interfaccia e psql leggono le stesse tabelle; nell’interfaccia, ognuno scrive SQL con i propri permessi, salva le sue query e, se gestisce il database, ne ricava vere viste PostgreSQL.',
			},
			ai: {
				q: 'Cosa viene inviato a un fornitore di IA?',
				a: 'Nulla finché non hai configurato un fornitore. Dopo, per le bozze di struttura e il Copilot, per impostazione predefinita vengono inviate solo la struttura e la tua frase; la lettura dei dati da parte del Copilot è una casella da spuntare, per conversazione. Un modello di database chiesto all’IA invia solo la tua frase. Un campo IA invia le colonne citate dalla sua istruzione, dopo un consenso esplicito.',
			},
			together: {
				q: 'Si può lavorare in più persone sulla stessa tabella?',
				a: 'Sì. Le scritture degli altri compaiono senza ricaricare, con il loro volto sulla tabella o sulla riga che stanno guardando. Si commenta una riga, si menziona qualcuno con @, la campanella avvisa. E Ctrl+Z annulla solo le tue scritture: rifiuta piuttosto che sovrascrivere ciò che un altro ha cambiato nel frattempo.',
			},
			languages: {
				q: 'In quali lingue?',
				a: 'Venti: francese, inglese, tedesco, spagnolo, italiano, portoghese del Brasile, olandese, polacco, ceco, svedese, danese, norvegese, finlandese, rumeno, ungherese, turco, ucraino, giapponese, cinese semplificato e coreano. L’interfaccia usa la lingua del browser, e ognuno la cambia nelle proprie impostazioni; questo sito e la documentazione esistono nelle stesse lingue.',
			},
			agent: {
				q: 'Come si collega un agente IA?',
				a: 'Tramite il server MCP, con un token di integrazione limitato a un database, in sola lettura per impostazione predefinita. Un agente legge, crea e modifica righe secondo i suoi permessi; non elimina nulla e non cambia la struttura: la propone, e una persona approva.',
			},
			postgres: {
				q: 'Quale versione di PostgreSQL serve?',
				a: 'PostgreSQL 16 o più recente, con le estensioni pg_trgm e unaccent (disponibili nell’immagine ufficiale). Il docker-compose fornito avvia un PostgreSQL 16; puoi anche far puntare DATABASE_URL al tuo server.',
			},
			production: {
				q: 'È pronto per la produzione?',
				a: 'basedb è in sviluppo attivo: il nucleo, l’API, il server MCP e l’interfaccia funzionano e sono coperti da oltre mille test, ma alcune funzioni devono ancora arrivare (vedi la roadmap). Provalo, e fai il backup del tuo database come di qualsiasi database PostgreSQL.',
			},
			license: {
				q: 'Con quale licenza?',
				a: 'AGPL-3.0-or-later. Puoi usarlo, modificarlo e ospitarlo liberamente; se offri una versione modificata come servizio, ne condividi i sorgenti.',
			},
		},
	},
	cta: {
		title: 'I tuoi dati meritano {vere tabelle.}',
		text: 'Installa basedb in pochi minuti, invita il tuo team e mantieni il controllo su ogni riga.',
		install: 'Installa basedb',
		github: 'Vedi il codice su GitHub',
	},
	changelog: {
		label: 'Novità',
		title: 'Cosa è cambiato in basedb',
		intro: 'Il dettaglio di ogni modifica è nella <a href="https://github.com/eodia/basedb/commits/main">cronologia del repository</a>. Cosa arriverà dopo: la <a href="/feuille-de-route/">roadmap</a>.',
		entries: {
			maps: {
				date: '2026-09-30',
				title: 'La mappa, e indirizzi che si trovano',
				tag: 'Novità',
				items: [
					'<strong>Una decima vista, la mappa</strong>: ogni riga posizionata nel suo punto, in base al suo indirizzo o alla sua latitudine e longitudine. Uno spillo prende il colore di uno stato e apre i suoi dettagli della riga con un clic. <a href="/fonctionnalites/vues/#mappa">La mappa</a>',
					'<strong>Un indirizzo viene localizzato una volta per tutte</strong>, dal servizio di OpenStreetMap o da quello che scegli: gli spilli arrivano man mano che arrivano le risposte, poi subito. Un indirizzo non trovato viene conteggiato, mai scartato in silenzio.',
					'<strong>Il formato Indirizzo</strong> per un testo breve: un clic lo apre sulla mappa, e nei dettagli della riga, <strong>Trova indirizzo</strong> propone gli indirizzi completi corrispondenti. <a href="/fonctionnalites/tables-et-champs/#formati-di-visualizzazione">Formati</a>',
				],
			},
			documents: {
				date: '2026-09-30',
				title: 'PDF a partire dalle tue righe',
				tag: 'Novità',
				items: [
					'<strong>Un preventivo, una fattura, una scheda in PDF</strong>, dal menu di una riga: la scheda stampabile senza impostare nulla, o un modello — testi che citano i campi, i campi della riga, la tabella delle righe collegate con il suo totale, interruzioni di pagina. <a href="/fonctionnalites/documents/">I documenti</a>',
					'<strong>Ognuno con i propri permessi</strong>: un campo nascosto per te non compare nel tuo PDF. Le venti lingue vi si scrivono correttamente, cinese, giapponese e coreano compresi, e l’API restituisce lo stesso documento.',
				],
			},
			rows: {
				date: '2026-09-30',
				title: 'Permessi fino alla riga, valori predefiniti, l’importazione da Excel',
				tag: 'Novità',
				items: [
					'<strong>Ognuno le proprie righe</strong>: un gruppo vede solo le righe di un filtro — «Commerciale è io», «Regione è Nord» —, nell’interfaccia, nell’API, nel server MCP come in SQL, dove PostgreSQL applica la stessa regola. <a href="/fonctionnalites/droits/#fino-alla-riga">Fino alla riga</a>',
					'<strong>Valori predefiniti</strong>: un valore fisso, la data di oggi, il momento della creazione o la persona che crea la riga, precompilati sullo schermo e applicati ovunque altrove. <a href="/fonctionnalites/tables-et-champs/#valori-predefiniti">Valori predefiniti</a>',
					'<strong>Trascina una cartella di lavoro Excel</strong>: scegli il foglio, le date, gli importi e le caselle di controllo arrivano così come sono, e una formula restituisce il suo valore. <a href="/guides/premiers-pas/">Primi passi</a>',
				],
			},
			mail: {
				date: '2026-09-30',
				title: 'Email',
				tag: 'Novità',
				items: [
					'<strong>Un passaggio «Invia un’email»</strong> nelle automazioni: a un membro, alla persona di un campo, all’indirizzo di un cliente, con i valori della riga nell’oggetto e nel testo. <a href="/fonctionnalites/automatisations/">Le automazioni</a>',
					'<strong>Le notifiche via email</strong> quando non le hai lette, raggruppate, da scegliere una per una nelle tue impostazioni; e la <strong>password dimenticata</strong> si reimposta tramite un link. <a href="/fonctionnalites/collaboration/#via-email">Via email</a>',
					'Basta indicare all’istanza il server di invio della tua posta. <a href="/hebergement/variables/#email">Le variabili</a>',
				],
			},
			integrations: {
				date: '2026-09-30',
				title: 'n8n e un SDK TypeScript',
				tag: 'Novità',
				items: [
					'<strong>Nodi n8n</strong>: leggere e scrivere le righe di una tabella da un workflow, e avviarne uno a ogni riga creata, modificata o eliminata — per rilevazione o per webhook firmato. <a href="/integrations/n8n/">n8n</a>',
					'<strong>Un SDK TypeScript</strong>, con i tipi delle tue tabelle generati dalla tua istanza: una tabella o un campo che non esiste è un errore ancora prima dell’esecuzione. <a href="/integrations/sdk/">Lo SDK</a>',
				],
			},
			quiz: {
				date: '2026-09-29',
				title: 'Il quiz: domande che contano i punti',
				tag: 'Novità',
				items: [
					'<strong>Una nuova vista, il quiz</strong>: un questionario in cui ogni domanda può avere la sua risposta corretta e i suoi punti — una scelta, più scelte, sì o no, un numero, una data, o i testi accettati, senza distinguere maiuscole né accenti. <a href="/fonctionnalites/vues/#quiz">Il quiz</a>',
					'<strong>Corretto come preferisci</strong>: dopo ogni domanda — in verde, o in rosso con la risposta corretta, il punteggio che cresce in alto nello schermo —, alla fine, oppure mai. Una soglia di superamento fa dire «Superato!» o «Non questa volta…».',
					'<strong>Il punteggio alla fine</strong>, in un anello che si riempie, poi la correzione di ogni domanda. Si scrive in un campo numerico della tabella: ordina la griglia su di esso, ecco la classifica.',
					'<strong>Condiviso tramite un link, senza imbrogli</strong>: la pagina non riceve nessuna risposta corretta, è il server a correggere e a contare. <a href="/fonctionnalites/formulaires-partages/#un-quiz-condiviso">Un quiz condiviso</a>',
					'<strong>Crea una vista</strong>, in fondo al selettore delle viste, dispone i nove tipi in due famiglie — quelle che mostrano le righe, quelle che raccolgono risposte —, ciascuna con la propria icona a colori.',
				],
			},
			forms: {
				date: '2026-09-29',
				title: 'Moduli che viene voglia di compilare',
				tag: 'Novità',
				items: [
					'<strong>Il questionario occupa tutto lo schermo</strong>: una domanda alla volta, che arriva scorrendo, grandi schede per le scelte, stelle per una valutazione, e tutto da tastiera — <strong>Invio</strong>, le lettere A, B, C…, S o N, le cifre. Una scelta unica fa passare da sola alla successiva. <a href="/fonctionnalites/vues/#modulo-e-questionario">Modulo e questionario</a>',
					'<strong>Un aspetto tutto suo</strong>: otto temi, da Chiaro a Notte passando per Carta, un colore, un carattere, un allineamento — anche la pagina di un link condiviso lo indossa.',
					'<strong>Chiedi solo se…</strong>: una domanda viene posta solo se una risposta precedente lo richiede; una domanda nascosta non è né obbligatoria né salvata.',
					'<strong>Niente da impostare per iniziare</strong>: un modulo nuovo chiede quello che risponde una persona, non lo stato che il team compila in seguito, porta il colore della sua tabella e mostra un esempio in ogni campo. E l’invio si festeggia, coriandoli compresi.',
				],
			},
			formulaLanguages: {
				date: '2026-09-28',
				title: 'Formule in francese o in inglese',
				tag: 'Novità',
				items: [
					'<strong>Scrivi una formula in francese o in inglese</strong>, su qualsiasi schermata, anche mescolando le due lingue: <code>SI</code> o <code>IF</code>, <code>ARRONDI</code> o <code>ROUND</code>, <code>JOURS</code> o <code>DAYS</code>… Gli argomenti si separano con <code>;</code> o con <code>,</code>. <a href="/fonctionnalites/tables-et-champs/#formule">Le formule</a>',
					'<strong>Si rilegge nella lingua della schermata</strong>: in francese su una schermata francese, in inglese nelle altre diciannove lingue — formule esistenti e pannello «Funzioni» compresi. L’API restituisce una formula nella lingua richiesta, altrimenti in inglese.',
					'I modelli ufficiali, serviti in una lingua diversa dal francese, arrivano con le loro formule in inglese. Nel database non cambia nulla: stesse colonne, stesso SQL, senza migrazione.',
				],
			},
			search: {
				date: '2026-09-27',
				title: 'Trovare tutto: Ctrl+K',
				tag: 'Novità',
				items: [
					'<strong>Un solo campo per tutto</strong> — <strong>Ctrl+K</strong>, o il campo al centro della barra superiore: tabelle, viste, domande, dashboard, automazioni, colonne e le righe stesse, lette con i tuoi permessi; su uno schermo grande, l’anteprima del risultato scelto. <a href="/fonctionnalites/recherche/">La ricerca</a>',
					'<strong>Scrivi come pensi</strong>: senza accenti né maiuscole, per iniziali — <code>nc</code> per «Nuovo cliente» —, un errore di battitura perdonato, <code>clients lyon</code> per cercare «lyon» nella tabella dei clienti; ciò che apri spesso risale in alto.',
					'<strong>Tutti i comandi da tastiera</strong>: creare, andare a, chiudere, annullare, cambiare tema, copiare il link della pagina. <code>&gt;</code> cerca solo i comandi, <code>#</code> gli oggetti, <code>/</code> le righe; <strong>Tab</strong> cerca in una tabella o in un database.',
					'<strong>Hai una domanda?</strong> Scrivila: <strong>Chiedi al Copilot</strong> gliela pone, sul database aperto.',
				],
			},
			questions: {
				date: '2026-09-27',
				title: 'Domande personali, numeri nel testo',
				tag: 'Novità',
				items: [
					'<strong>Ognuno salva le proprie domande</strong>, senza il livello Gestione: personali, solo tu le vedi; chi gestisce il database le condivide con tutto il database o con dei gruppi, come le query. <a href="/fonctionnalites/tableaux-de-bord/">I dashboard</a>',
					'<strong>Una domanda in un tab</strong>, accanto alle tabelle: <strong>Nuova domanda</strong> e <strong>Nuova domanda SQL</strong>, al <strong>+</strong> della barra dei tab e nel menu del database; il tab conserva ciò che hai lasciato. <strong>Salva una copia</strong> rende tua una domanda che non puoi modificare.',
					'<strong>Numeri nel testo</strong>: un testo di dashboard, ora formattato, cita un valore — <code>{{chiffre_affaires}}</code> — preso da una scheda, una domanda o un filtro, calcolato con i permessi di chi legge, anche in una dashboard condivisa tramite link. <a href="/fonctionnalites/tableaux-de-bord/#numeri-nel-testo">Numeri nel testo</a>',
					'Query, viste SQL e domande si eliminano anche dal loro menu, con un clic destro.',
				],
			},
			addresses: {
				date: '2026-09-27',
				title: 'Un indirizzo per ogni schermata',
				tag: 'Novità',
				items: [
					'<strong>L’indirizzo segue la schermata</strong>: una tabella, una vista, la scheda di una riga, una dashboard, un’automazione, una domanda, le tue impostazioni — <code>/bases/ventes/tables/opportunites?ligne=…</code>. Aggiungilo ai preferiti, incollalo in un messaggio: si arriva nello stesso punto, con i propri permessi. <a href="/fonctionnalites/collaboration/#un-link-per-ogni-schermata">Un link per ogni schermata</a>',
					'I pulsanti <strong>indietro</strong> e <strong>avanti</strong> del browser ti riportano dove eri; un indirizzo che non porta a nulla mostra «Questa pagina non esiste».',
				],
			},
			demo: {
				date: '2026-09-27',
				title: 'Una demo da provare, nella tua lingua',
				tag: 'Novità',
				items: [
					'<strong>La demo</strong>, su <a href="https://demo.basedb.eodia.com">demo.basedb.eodia.com</a>: l’account è precompilato nella lingua del tuo browser, con un database in quella lingua. Si legge tutto e si modifica ciò che esiste; creazioni, eliminazioni e IA sono disattivate, e il database torna ogni notte al suo stato iniziale.',
					'<strong>La tua demo</strong>: <code>BASEDB_DEMO=1</code> apre un’istanza a tutti, con un account condiviso per lingua, preparato in anticipo. <a href="/hebergement/variables/#demo-pubblica">Le variabili</a>',
					'<strong>Una lingua per link</strong>: <code>?lang=de</code> alla fine di un indirizzo di basedb mostra in tedesco la schermata di accesso o una pagina condivisa; così il sito porta alla demo nella lingua della pagina. <a href="/fonctionnalites/droits/#le-tue-impostazioni">Le tue impostazioni</a>',
				],
			},
			templateLanguages: {
				date: '2026-09-27',
				title: 'I modelli nella tua lingua',
				tag: 'Novità',
				items: [
					'<strong>I modelli ufficiali si creano nella lingua della schermata</strong>: tabelle, campi, scelte, viste, dashboard, automazioni, istruzioni per l’IA — e righe di esempio di un mondo adattato a ogni lingua: la «Boulangerie Martin» di Lyon diventa «Martin’s Bakery» a Portland. <a href="/fonctionnalites/modeles/#nella-tua-lingua">I modelli</a>',
					'La <a href="/modeles/">galleria del sito</a> mostra ogni modello nella lingua della pagina.',
					'<strong>Un modello, più dizionari</strong>: un modello si scrive una sola volta, in francese; ogni lingua ne traduce solo i testi, e basedb stesso segue ogni etichetta ovunque sia citata. Un dizionario che romperebbe il modello non viene servito. <a href="/fonctionnalites/modeles/#pubblicare-un-modello-per-tutte-le-istanze">Pubblicare un modello</a>',
				],
			},
			details: {
				date: '2026-09-27',
				title: 'E anche',
				items: [
					'<strong>Un modello senza le sue righe di esempio</strong>: «Caricare dati di esempio», deselezionata, crea tabelle vuote, pronte per i tuoi dati. <a href="/fonctionnalites/modeles/#partire-da-un-modello">Partire da un modello</a>',
					'<strong>La documentazione API e MCP</strong> di ogni database è scritta nella lingua del tuo schermo. <a href="/integrations/api-rest/#la-documentazione-generata">La documentazione generata</a>',
					'I tooltip seguono ora il tema dell’applicazione, ovunque il browser mostrasse prima i propri; le voci «Elimina» dei menu, in rosso; la data completa al passaggio del mouse sull’ora di un commento.',
				],
			},
			aiProvider: {
				date: '2026-09-27',
				title: 'L’IA di tua scelta, persino sul tuo computer',
				tag: 'Novità',
				items: [
					'<strong>Un quarto fornitore di IA</strong>: qualsiasi server che parla l’API di OpenAI — Azure, un gateway aziendale, un modello eseguito sul tuo computer —, dichiarato nel <code>.env</code>. Il registro delle chiamate indica a chi sono stati inviati i dati. <a href="/fonctionnalites/ia/">L’IA in basedb</a>',
					'<strong>La schermata di accesso</strong> mostra, dopo la griglia e l’SQL, una dashboard che segue un filtro e un’automazione in esecuzione, passaggio IA compreso.',
				],
			},
			languages: {
				date: '2026-09-27',
				title: 'Testo formattato, variabili, un kanban più leggibile',
				tag: 'Novità',
				items: [
					'<strong>Testo formattato</strong>: un nuovo tipo di campo, formattato in un editor visuale — titoli, elenchi, citazioni, link —, sanificato in scrittura e protetto da un vincolo contro l’SQL diretto. <a href="/fonctionnalites/tables-et-champs/#testo-formattato-e-variabili">Testo formattato e variabili</a>',
					'<strong>Variabili</strong>: un testo lungo cita una colonna della sua riga — <code>{{Ville}}</code> — e si legge ovunque con il suo valore: griglia, dettagli della riga, API, server MCP, viste condivise, automazioni. La colonna conserva la citazione, ed è questa che legge <code>psql</code>.',
					'<strong>Un kanban più leggibile</strong>: schede più ariose, un’immagine di copertina, e una descrizione che cita i valori della riga — «Consegna il {{Date}} per {{Client}}». <a href="/fonctionnalites/vues/">Le viste</a>',
					'<strong>Rinominare con un gesto</strong>: un’unica finestra di dialogo per un database, una tabella o un campo; l’etichetta cambia sempre, e un amministratore può rinominare anche nel database, con l’analisi d’impatto a supporto. <a href="/fonctionnalites/tables-et-champs/#modificare-la-struttura">Modificare la struttura</a>',
					'<strong>Venti lingue</strong>: l’interfaccia, questo sito e la documentazione in francese, inglese, tedesco, spagnolo, italiano, portoghese (Brasile), olandese, polacco, ceco, svedese, danese, norvegese, finlandese, rumeno, ungherese, turco, ucraino, giapponese, cinese semplificato e coreano. basedb usa la lingua del browser; <strong>Impostazioni › Aspetto › Lingua</strong> ne imposta un’altra, che ti segue da un dispositivo all’altro. I numeri e le date seguono la lingua. <a href="/fonctionnalites/droits/#le-tue-impostazioni">Le tue impostazioni</a>',
				],
			},
			flows: {
				date: '2026-09-27',
				title: 'Automazioni a flusso',
				tag: 'Novità',
				items: [
					'<strong>Un editor a grafo</strong>: il trigger, poi ogni passaggio in una scheda; un <strong>+</strong> su un collegamento aggiunge un passaggio in quel punto. Un’automazione semplice sta sempre in due schede. <a href="/fonctionnalites/automatisations/">Le automazioni</a>',
					'<strong>Cercare una riga</strong> — il cliente di un ordine, l’ultima fattura non pagata — poi modificarla, citarla, collegarla a una riga creata.',
					'<strong>Condizioni a più rami</strong>: viene preso il primo la cui condizione è soddisfatta, «Altrimenti» quando nessuna lo è; poi i rami si ricongiungono.',
					'<strong>I dati viaggiano da un passaggio all’altro</strong>: <code>{{e2.client}}</code> cita ciò che un passaggio ha trovato o creato, <code>{{e3.reponse.numero}}</code> ciò che un webhook ha risposto; il menu di ogni testo propone solo ciò che è avvenuto con certezza prima.',
					'<strong>Ogni esecuzione, passaggio per passaggio</strong>: sovrapposta al flusso, traccia il percorso seguito e indica, per ogni passaggio, cosa ha fatto e in quanto tempo.',
					'<strong>Il Copilot delle automazioni</strong>: descrivi cosa deve fare il database da solo, o chiedi perché un’esecuzione non è riuscita; propone un’intera automazione, che posizioni nel flusso con un clic, rileggi e poi salvi — nulla viene salvato senza di te. <a href="/fonctionnalites/automatisations/#il-copilot">Il Copilot</a>',
					'<strong>Chiedi all’IA</strong> in un passaggio, come in un campo IA: un’istruzione che cita la riga e i passaggi precedenti, una risposta letta come testo, numero, sì o no, data o scelta in un elenco, che i passaggi successivi scrivono o inviano. <a href="/fonctionnalites/automatisations/#chiedi-allia">Chiedi all’IA</a>',
				],
			},
			dashboards: {
				date: '2026-09-27',
				title: 'Dashboard: domande, grafici, filtri',
				tag: 'Novità',
				items: [
					'<strong>Domande</strong> poste con il mouse — una tabella, i suoi join, filtri, misure per giorno, settimana, mese o anno — o scritte in <strong>SQL</strong>, in sola lettura e con i tuoi permessi, variabili comprese. <a href="/fonctionnalites/tableaux-de-bord/">Le dashboard</a>',
					'<strong>Quindici visualizzazioni</strong>: numero, tendenza rispetto al periodo precedente, avanzamento verso un obiettivo, indicatore, istogramma, barre, linee, aree, combinato, torta, imbuto, dispersione, tabella, tabella pivot, mappa della Francia o del mondo.',
					'<strong>Esplorare con un clic</strong>: un punto apre le sue righe, un periodo più fine, un’altra ripartizione.',
					'<strong>Dashboard a griglia</strong>: schede spostate e ridimensionate con il mouse, tab, titoli di sezione, testi, pagine incorporate.',
					'<strong>Filtri comuni</strong> — periodo, categoria, testo, numero, raggruppamento per data — che controllano una, più o tutte le schede, con un valore predefinito.',
					'<strong>Grafici su misura</strong>: colore e nome di ogni serie o di ogni fetta, anello, semicerchio o rosa, impilamento con totali, linee smussate o a gradini, assi, graduazioni, scala logaritmica; tabelle con colonne rinominate, con barre e colori in base al valore.',
					'<strong>Il Copilot delle dashboard</strong>: una conversazione che propone domande, modifiche della dashboard — annullabili — e valori per i suoi filtri, da applicare con un clic. Al fornitore viene inviata solo la struttura, a meno che tu non gli consenta di leggere i risultati. <a href="/fonctionnalites/tableaux-de-bord/#il-copilot">Il Copilot</a>',
					'<strong>Condividere una dashboard</strong> tramite un link, pubblico o riservato ai membri — se serve, a dei gruppi — e incorporarla in un altro sito: schede e filtri in sola lettura, letti con i permessi di chi l’ha pubblicata. <a href="/fonctionnalites/tableaux-de-bord/#condividere-una-dashboard">Condividere</a>',
					'«Interfacce» ora si chiama <strong>Dashboard</strong>; le dashboard esistenti si aprono così come sono, sulla nuova griglia.',
				],
			},
			sqlViews: {
				date: '2026-09-27',
				title: 'Query salvate e viste SQL',
				tag: 'Novità',
				items: [
					'<strong>SQL per tutti</strong>: senza il livello Gestione, un tab SQL si esegue in sola lettura, con i tuoi permessi, applicati da PostgreSQL stesso — una tabella chiusa non esiste, un campo nascosto viene rifiutato. Il badge «I tuoi permessi» lo ricorda. <a href="/fonctionnalites/requetes-et-vues-sql/">Query e viste SQL</a>',
					'<strong>Query salvate</strong>, sistemate sotto le tabelle nella sezione «Query»: personali, per tutto il database o per dei gruppi. Condividere una query ne condivide il testo, mai ciò che il suo autore può leggere; aperta dalla barra laterale, si esegue subito in sola lettura.',
					'<strong>Viste SQL</strong>: vere viste PostgreSQL, sistemate tra le tabelle con un colore, un’icona e un piccolo occhio, leggibili anche da <code>psql</code> e dai tuoi strumenti. Ognuno le legge con i propri permessi, e la barra laterale le mostra solo a chi può leggerne tutto.',
					'Le viste seguono la struttura: una ridenominazione non le rompe, una formula modificata le toglie per un istante e poi le rimette; quella che non regge più resta da correggere, con la sua definizione conservata.',
				],
			},
			settings: {
				date: '2026-09-27',
				title: 'Le tue impostazioni',
				tag: 'Novità',
				items: [
					'<strong>Impostazioni</strong>, nel menu del profilo: il tuo nome, il tuo indirizzo e i fornitori di identità collegati al tuo account; la tua password e le tue sessioni aperte. <a href="/fonctionnalites/droits/">Account e accesso</a>',
					'<strong>Aspetto</strong>: il tema, l’ordine delle date — <code>25/09/2026</code> o <code>2026-09-25</code> — e il primo giorno della settimana dei calendari; gli ultimi due ti seguono da un dispositivo all’altro.',
					'<strong>Notifiche</strong>: rifiuta quelle che non vuoi più, un tipo alla volta. <strong>Token</strong>: quelli che hai creato, su tutti i tuoi database, il loro ultimo utilizzo e la loro revoca.',
				],
			},
			v020: {
				date: '2026-09-26',
				title: 'Versione 0.2.0: a ciascuno il suo account, i suoi progetti, i suoi inviti',
				tag: 'Novità',
				items: [
					'<strong>Primo accesso</strong>: su un’istanza nuova, la prima pagina crea l’account amministratore, con il tuo indirizzo e la tua password — niente più account predefinito né password da cercare nei log. <a href="/guides/installation/">L’installazione</a>',
					'<strong>Creazione di account</strong>: ognuno crea il proprio account, poi i propri progetti, di cui diventa gestore. L’amministrazione può chiuderla o riservarla a determinati domini. <a href="/hebergement/connexion/">Account e accesso</a>',
					'<strong>Condividere un progetto o un database</strong>: chi ha il livello Gestione invita tramite un link, in Lettura, Modifica o Gestione; vede chi ha accesso, cambia un livello, lo revoca. Mai più di ciò che gestisce.',
					'<strong>Riservatezza</strong>: ognuno vede solo le persone con cui condivide un progetto, e il nome di un progetto già usato da altri non si può più indovinare.',
					'<strong>Accesso con Google, Microsoft</strong> e qualsiasi fornitore OpenID Connect (Keycloak, GitLab…), dichiarati nel <code>.env</code>; un primo accesso crea l’account se la creazione di account lo consente. <a href="/hebergement/connexion/">Configurare</a>',
					'<strong>Nuova schermata di accesso</strong>, nel tema dell’applicazione, chiaro o scuro, e animata con discrezione; schermate vuote illustrate nell’applicazione.',
					'<strong>Aggiornamenti senza perdite</strong>: basedb aggiorna da sé il proprio catalogo all’avvio, anche su un’installazione 0.1, e si rifiuta di avviarsi su un database che una versione più recente ha già aggiornato. <a href="/hebergement/sauvegardes/">Aggiornare</a>',
				],
			},
			dockerImage: {
				date: '2026-09-26',
				title: 'Un’unica immagine Docker',
				tag: 'Hosting',
				items: [
					'basedb sta in <strong>un’unica immagine</strong>, <code>eodia/basedb</code> su Docker Hub, per amd64 e arm64: l’interfaccia, l’API sotto <code>/api</code> e il server MCP sotto <code>/mcp</code>, su <strong>un’unica porta</strong>. <a href="/guides/installation/">L’installazione</a>',
					'Bastano due file — <code>docker-compose.yml</code> e <code>.env</code> — senza clonare il repository né compilare nulla; l’aggiornamento si fa con <code>docker compose pull</code>.',
					'Dietro un dominio, il proxy HTTPS non deve più instradare nulla: tutto va alla porta 3000.',
				],
			},
			automations: {
				date: '2026-09-26',
				title: 'Automazioni, interfacce, formule, collaborazione',
				tag: 'Novità',
				items: [
					'<strong>Formule</strong> in francese — <code>SI</code>, <code>ARRONDI</code>, <code>JOURS</code>… — trasformate in colonne generate da PostgreSQL; <strong>ricerche</strong>, <strong>aggregazioni</strong> e <strong>conteggi</strong> attraverso le relazioni. <a href="/fonctionnalites/tables-et-champs/">I campi</a>',
					'<strong>Nuovi tipi</strong>: relazione multipla, persona, email, numerazione automatica, pulsante; e formati scelti come tipi — valuta, percentuale, durata, valutazione a stelle, telefono, codice a barre.',
					'<strong>Otto viste</strong>: la <strong>galleria</strong> e l’<strong>elenco</strong> si aggiungono alle altre sei; <strong>viste personali</strong> per ogni lettore, viste bloccate, ordinamento manuale, dipendenze nella sequenza temporale. <a href="/fonctionnalites/vues/">Le viste</a>',
					'<strong>La griglia</strong>: ricerca rapida, raggruppamento, riepilogo per colonna su tutto il filtro, colori tramite regole, altezza delle righe.',
					'<strong>Viste condivise</strong> in sola lettura, incorporabili in un altro sito; un calendario diventa un <strong>feed iCalendar</strong> per Google Calendar, Outlook o Apple Calendar. <a href="/fonctionnalites/vues-partagees/">La condivisione</a>',
					'<strong>Collaborazione</strong>: commenti e menzioni, notifiche, scritture degli altri in tempo reale, presenza sulla tabella e sulla riga. <a href="/fonctionnalites/collaboration/">Lavorare insieme</a>',
					'<strong>Ctrl+Z</strong> annulla l’ultima scrittura — una cella, una scheda spostata, un’intera importazione — e rifiuta piuttosto che sovrascrivere ciò che un altro ha cambiato nel frattempo.',
					'<strong>Automazioni</strong>: quando una riga viene creata o modificata, a orario fisso o con un clic su un pulsante — modificare, creare, avvisare, chiamare un webhook, scrivere su Slack. <a href="/fonctionnalites/automatisations/">Automatizzare</a>',
					'<strong>Interfacce</strong>: dashboard — numeri, grafici, elenchi, testi — lette con i permessi di ciascuno. <a href="/fonctionnalites/tableaux-de-bord/">Le dashboard</a>',
					'<strong>Integrazioni</strong>: un canale Slack, e <strong>tabelle sincronizzate</strong> da un CSV online, un calendario o la vista di un altro basedb. <a href="/integrations/synchronisation/">Le integrazioni</a>',
					'<strong>Modelli di database</strong>: una galleria di dieci modelli, un database descritto in una frase all’IA, e ogni database salvabile come modello. <a href="/modeles/">La galleria</a>',
					'<strong>Permessi</strong>: la schermata Struttura passa in sola consultazione per chi non ha il livello Gestione.',
					'<strong>Nuova identità</strong>: un logo, una palette e una schermata di accesso rifatta.',
				],
			},
			simpler: {
				date: '2026-09-26',
				title: 'Un’interfaccia più semplice',
				items: [
					'<strong>La barra laterale</strong> elenca ormai solo i database e le loro tabelle; le schermate del database aperto — Struttura, Cronologia, Interfacce, Automazioni — sono riunite in un riquadro, appena sopra il profilo.',
					'<strong>Il menu del profilo</strong> accoglie ciò che non sono dati: la documentazione API e MCP, le integrazioni, gli utenti e i permessi.',
					'<strong>Una query SQL</strong> si apre dal «+» della barra delle tab o dal menu del database, senza doppioni nella barra laterale.',
					'<strong>Nuovo database</strong> propone i modelli e l’IA già nella finestra di dialogo; il database di dimostrazione passa per la stessa galleria.',
					'<strong>La schermata non propone più ciò che verrebbe rifiutato</strong>: nessun pulsante di struttura senza Gestione, nessun «Elimina» senza il permesso di eliminare; e un lettore crea le proprie viste invece di scontrarsi con un messaggio.',
					'<strong>Le colonne di sistema</strong> sono raccolte sotto «Informazioni di sistema» invece di essere proposte su ogni tabella.',
					'<strong>I dettagli della riga</strong> guadagnano i commenti, un pulsante per scrivere o chiamare, e una valutazione che si imposta con un clic.',
					'<strong>L’accesso</strong> abbandona lo sfondo animato in 3D per una schermata leggera, che rispetta la preferenza «riduci movimento».',
				],
			},
			environments: {
				date: '2026-09-26',
				title: 'Ambienti, moduli condivisi, viste',
				items: [
					'<strong>Ambienti</strong>: produzione, collaudo, sviluppo per uno stesso database; confronto affiancato, piano di migrazione, sincronizzazione delle righe.',
					'<strong>Cronologia delle strutture</strong>: ogni creazione o modifica di tabelle e campi, catturata da un trigger sul catalogo.',
					'<strong>Moduli condivisi</strong>: un link pubblico o riservato ai membri, chiusura per data o per numero di risposte, attribuzione delle risposte nella cronologia.',
					'<strong>Sei viste</strong>: griglia, kanban, calendario, sequenza temporale, modulo, questionario.',
					'<strong>Cronologia dei dati</strong>: annullare una modifica, ripristinare una riga eliminata.',
					'<strong>IA</strong>: l’opzione IA su qualsiasi campo, e il Copilot.',
					'<strong>Relazione</strong> e <strong>URL</strong>: due tipi distinti; il testo lungo si scrive in Markdown.',
					'<strong>Webhook</strong> firmati e ordinati, <strong>proposte degli agenti</strong> da approvare.',
					'<strong>Docker</strong>: un Dockerfile con tre target, un docker-compose completo, un proxy HTTPS opzionale.',
				],
			},
			projects: {
				date: '2026-09-25',
				title: 'Progetti, permessi, server MCP',
				items: [
					'<strong>Progetti</strong> al di sopra dei database, e permessi per <strong>gruppi</strong> su quattro livelli: Nessun accesso, Lettura, Modifica, Gestione.',
					'<strong>Account</strong>: password temporanea, cambio al primo accesso, elevazione per l’amministrazione.',
					'<strong>Server MCP</strong> e relay stdio; <strong>token di integrazione</strong> comuni all’API REST e all’MCP.',
					'<strong>Documentazione generata</strong> «API e MCP» per ogni database.',
				],
			},
			fields: {
				date: '2026-09-20',
				title: 'Campi, selezioni singole, importazione',
				items: [
					'Modificare un campo e le opzioni di una selezione singola.',
					'<strong>Importazione</strong> di file CSV e JSON.',
					'Il menu di una tabella: rinominare, descrivere, eliminare.',
				],
			},
			firstCommit: {
				date: '2026-09-20',
				title: 'Primo commit',
				items: [
					'Il monorepo: convenzioni di denominazione, registro dei codici di errore, catalogo estratto dal documento di architettura, nucleo, API, interfaccia.',
				],
			},
		},
	},
	roadmap: {
		label: 'Roadmap',
		title: 'Cosa arriverà',
		intro: 'basedb è in sviluppo attivo. Questa pagina dice cosa manca ancora, senza date promesse. Un’idea, un’esigenza? <a href="https://github.com/eodia/basedb/issues">Apri una issue</a>. Ciò che c’è già: le <a href="/nouveautes/">novità</a>.',
		columns: {
			next: {
				title: 'Prossimamente',
				items: {
					restoreTable: {
						title: 'Ripristinare una singola tabella',
						text: 'Una tabella eliminata resta leggibile in SQL con il suo nome accantonato; riportarla da sola dall’interfaccia è in arrivo.',
					},
					aiSettings: {
						title: 'Impostazioni dell’IA nell’interfaccia',
						text: 'Fornitore, modello e chiave per spazio di lavoro, senza passare dall’ambiente dell’API.',
					},
					mail: {
						title: 'Notifiche e inviti via email',
						text: 'Le menzioni, le risposte e le assegnazioni oggi arrivano in basedb, gli inviti tramite un link da inviare di persona; potranno partire anche via email.',
					},
				},
			},
			later: {
				title: 'In seguito',
				items: {
					formLinks: {
						title: 'Relazioni e file nei moduli condivisi',
						text: 'Una ricerca limitata nella tabella collegata, un caricamento di file circoscritto per gli sconosciuti.',
					},
					moreEvents: {
						title: 'Più eventi notificati',
						text: 'Essere avvisati di una risposta a un modulo, di una proposta di un agente, di un webhook disattivato.',
					},
					sqlViewsAcross: {
						title: 'Viste SQL da un ambiente all’altro',
						text: 'Copiare le viste SQL insieme alla struttura quando si creano o si confrontano ambienti, e nei modelli di database.',
					},
					loops: {
						title: 'Cicli e attese nelle automazioni',
						text: 'Ripetere dei passaggi per ogni riga trovata, attendere prima del successivo («tre giorni dopo»), e portare i flussi nei modelli di database.',
					},
					textFormulas: {
						title: 'Formule sul testo',
						text: 'Estrarre, sostituire o troncare una parte di un testo.',
					},
					bulk: {
						title: 'Operazioni massive dichiarate',
						text: 'Modifiche su migliaia di righe, registrate in cronologia come un’unica operazione.',
					},
					tombstones: {
						title: 'Pulizia dei tombstone',
						text: 'L’eliminazione definitiva delle tracce di cancellazione diventate inutili.',
					},
				},
			},
		},
	},
	gallery: {
		label: 'Modelli',
		title: 'Un database pronto in pochi secondi',
		intro: 'Ogni modello crea tabelle collegate tra loro, righe di esempio, viste, una dashboard, automazioni — e campi che l’IA compila da sola. In basedb: <strong>Nuovo database</strong>, poi <strong>Parti da un modello</strong>. Niente fa al caso tuo? Descrivi la tua esigenza in una frase: l’IA ti propone un database su misura.',
		filter: 'Filtra per categoria',
		all: 'Tutti',
		otherCategory: 'Altri',
		ai: '✦ IA',
		tables: {
			one: '{n} tabella',
			many: '{n} di tabelle',
			other: '{n} tabelle',
		},
		rows: {
			one: '{n} riga',
			many: '{n} di righe',
			other: '{n} righe',
		},
		views: {
			one: '{n} vista',
			many: '{n} di viste',
			other: '{n} viste',
		},
		howtoTitle: 'Configurare i modelli in JSON',
		howto: 'Un modello è un file JSON: le sue tabelle, i suoi campi, le sue relazioni, le sue righe, le sue viste, le sue dashboard, le sue automazioni e le istruzioni dei suoi campi IA. I modelli di questa pagina sono i file della cartella <a href="https://github.com/eodia/basedb/tree/main/packages/templates/catalog"><code>packages/templates/catalog</code></a> del repository; ogni istanza di basedb legge <a href="/modeles/catalogue.json"><code>catalogue.json</code></a> e li propone ai suoi utenti. Un amministratore può anche importare i propri modelli nella sua istanza, e ogni database può essere salvato come modello.',
		format: {
			href: '/fonctionnalites/modeles/',
			label: 'Il formato dei modelli →',
		},
		back: '← Tutti i modelli',
		defaultCategory: 'Modello',
		sampleRows: {
			one: '{n} riga di esempio',
			many: '{n} di righe di esempio',
			other: '{n} righe di esempio',
		},
		aiTitle: 'Cosa calcola l’IA',
		useTitle: 'Usa questo modello',
		useSteps: [
			'In basedb, <strong>Nuovo database</strong>.',
			'<strong>Parti da un modello</strong>, poi «{label}».',
		],
		create: '<strong>Crea il database</strong>.',
		createWithAi: '<strong>Crea il database</strong> — accettando, se vuoi, che i campi IA vengano calcolati dal tuo fornitore di IA.',
		download: 'Scarica il JSON',
		downloadNote: 'Per importarlo nella tua istanza, o adattarlo prima di proporlo al catalogo.',
		viewMeta: '— {kind}, {table}',
		dashboard: '<strong>Dashboard</strong> «{label}» — {blocks}',
		blocks: {
			one: '{n} blocco',
			many: '{n} di blocchi',
			other: '{n} blocchi',
		},
		automation: '<strong>Automazione</strong> «{label}»',
		yes: 'Sì',
		no: 'No',
		me: 'Tu',
		kinds: {
			short_text: 'Testo breve',
			long_text: 'Testo lungo',
			rich_text: 'Testo formattato',
			number: 'Numero',
			boolean: 'Casella di controllo',
			date: 'Data',
			datetime: 'Data e ora',
			select: 'Selezione singola',
			multi_select: 'Selezione multipla',
			url: 'URL',
			email: 'Email',
			user: 'Persona',
			autonumber: 'Numerazione automatica',
			formula: 'Formula',
			lookup: 'Ricerca',
			rollup: 'Aggregazione',
			count: 'Conteggio',
			button: 'Pulsante',
			link: 'Relazione',
			multi_link: 'Relazione multipla',
		},
		viewKinds: {
			grid: 'Griglia',
			kanban: 'Kanban',
			calendar: 'Calendario',
			timeline: 'Sequenza temporale',
			gallery: 'Galleria',
			list: 'Elenco',
			form: 'Modulo',
		},
	},
	templates: {
		demo: {
			label: 'Demo: Atelier Lumen',
			summary: 'Una piccola agenzia, i suoi clienti, progetti, attività, fatture e recensioni: tutte le sfaccettature di basedb in un unico database.',
			description: 'Il database di dimostrazione. Atelier Lumen è un’agenzia di design fittizia. Il suo database mostra le relazioni tra tabelle, le ricerche e le aggregazioni (fatturato per cliente, valutazione media), le formule (importo IVA inclusa, ritardo), tre campi calcolati dall’IA sulle recensioni dei clienti (sentiment, tema, risposta suggerita), ogni tipo di vista — griglia, kanban, calendario, sequenza temporale con dipendenze, galleria, elenco, modulo —, una dashboard e due automazioni.',
			category: 'Dimostrazione',
			tags: ['IA', 'Relazioni', 'Tutte le viste', 'Dashboard'],
		},
		'analyse-avis': {
			label: 'Analisi delle recensioni',
			summary: 'Raccogli le recensioni, lascia che l’IA ne ricavi il sentiment, i temi, l’urgenza e una bozza di risposta.',
			description: 'Per un negozio, un ristorante o un marchio: le recensioni arrivano da un modulo pubblico o da un’importazione, e l’IA le legge una per una. Classifica il sentiment, individua il tema principale, segnala quelle che richiedono una risposta rapida, estrae il suggerimento del cliente e redige una risposta da rileggere. I prodotti aggregano la loro valutazione media e il loro numero di recensioni; una dashboard monitora la soddisfazione.',
			category: 'Relazione con i clienti',
			tags: ['IA', 'Modulo', 'Dashboard'],
		},
		'base-connaissances': {
			label: 'Base di conoscenza',
			summary: 'Articoli di aiuto e domande dei clienti: l’IA riassume, classifica e propone una risposta a partire dagli articoli.',
			description: 'Per un servizio di assistenza. Gli articoli di aiuto sono ordinati per categoria e seguiti nel tempo; le domande dei clienti arrivano tramite un modulo pubblico. L’IA riassume ogni articolo e ne valuta il livello, classifica ogni domanda e redige una bozza di risposta da rileggere.',
			category: 'Supporto',
			tags: ['IA', 'Modulo', 'Elenco'],
		},
		'calendrier-editorial': {
			label: 'Calendario editoriale',
			summary: 'Articoli, post e newsletter pianificati su un calendario; l’IA propone titoli accattivanti e parole chiave.',
			description: 'Per un team marketing o una redazione. Ogni contenuto avanza dall’idea alla pubblicazione, si colloca sul calendario delle uscite e appartiene a una campagna. L’IA propone un titolo accattivante e delle parole chiave a partire dal brief, e un modulo permette a tutta l’azienda di suggerire un argomento.',
			category: 'Marketing',
			tags: ['IA', 'Calendario', 'Kanban', 'Modulo'],
		},
		crm: {
			label: 'CRM commerciale',
			summary: 'Aziende, contatti e opportunità: una pipeline di vendita, gli scambi, e l’IA che consiglia il prossimo passo.',
			description: 'Un CRM leggero per un team commerciale. Le opportunità avanzano in una pipeline, hanno un importo ponderato in base alla loro probabilità, e l’IA ne valuta il rischio e consiglia la prossima azione a partire dalle note. Gli scambi con i clienti vengono registrati e riassunti, le aziende aggregano ciò che rappresentano.',
			category: 'Vendite',
			tags: ['IA', 'Pipeline', 'Kanban', 'Calendario'],
		},
		evenements: {
			label: 'Eventi e iscrizioni',
			summary: 'Conferenze, workshop e webinar: le iscrizioni, i posti rimasti e i feedback dei partecipanti letti dall’IA.',
			description: 'Per organizzare eventi ricorrenti. Ogni evento conta i suoi iscritti e i posti rimasti; le iscrizioni avanzano fino alla partecipazione. Dopo l’evento, i partecipanti lasciano un feedback che l’IA classifica per sentiment e riassume. Un modulo pubblico permette di iscriversi alla mailing list.',
			category: 'Eventi',
			tags: ['IA', 'Calendario', 'Modulo', 'Aggregazioni'],
		},
		'gestion-projet': {
			label: 'Gestione progetti',
			summary: 'Progetti, attività e milestone: una roadmap, dipendenze tra attività, un kanban e un calendario.',
			description: 'Per gestire più progetti in parallelo. Ogni progetto aggrega le sue attività e le sue ore; le attività si seguono in kanban, si pianificano su una sequenza temporale che ne disegna le dipendenze, e le milestone si leggono in un calendario. L’IA redige un bollettino sullo stato del progetto per la direzione a partire dalla sua descrizione e dal suo avanzamento.',
			category: 'Organizzazione',
			tags: ['Sequenza temporale', 'Dipendenze', 'Kanban', 'IA'],
		},
		inventaire: {
			label: 'Inventario e magazzino',
			summary: 'Articoli, fornitori e movimenti: la giacenza si calcola da sola, le rotture di stock si vedono in anticipo.',
			description: 'Per un laboratorio, un negozio o un ufficio servizi generali. Ogni entrata o uscita è un movimento; la giacenza di ogni articolo ne è la somma, il suo valore una formula, e gli articoli sotto la soglia compaiono nella vista «À commander» (da ordinare). L’IA redige la scheda di ogni articolo a partire dal nome e dalla categoria.',
			category: 'Operazioni',
			tags: ['Aggregazioni', 'Formule', 'Galleria', 'IA'],
		},
		recrutement: {
			label: 'Selezione del personale',
			summary: 'Posizioni aperte, candidati e colloqui; l’IA sintetizza ogni candidatura e suggerisce i punti da approfondire.',
			description: 'Il monitoraggio delle assunzioni, dalla candidatura al contratto. I candidati si propongono tramite un modulo pubblico, avanzano fase per fase in un kanban, e i colloqui si pianificano in un calendario. L’IA legge la lettera di presentazione e le note: una sintesi, e le domande da porre al colloquio. Aiuta a leggere, non decide.',
			category: 'Risorse umane',
			tags: ['IA', 'Modulo', 'Kanban', 'Calendario'],
		},
		'suivi-tickets': {
			label: 'Gestione dei ticket',
			summary: 'Bug e richieste smistati dall’IA, seguiti per sprint fino alla risoluzione, con un modulo di segnalazione.',
			description: 'Un gestore di ticket per un team di prodotto. Ogni ticket è collegato a un componente e a uno sprint; l’IA propone una categoria, stima la gravità e riassume la segnalazione. Un kanban segue l’avanzamento, una sequenza temporale mostra gli sprint, un modulo permette a chiunque di segnalare un problema, e un’automazione annota la data di risoluzione.',
			category: 'Prodotto e tecnologia',
			tags: ['IA', 'Kanban', 'Modulo', 'Sprint'],
		},
	},
} satisfies DeepPartial<Dict>;
