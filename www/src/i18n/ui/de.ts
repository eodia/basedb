/**
 * The German texts of the landing pages, laid over the French ones (`fr.ts`).
 *
 * See `../README.md`.
 */
import type { DeepPartial, Dict } from './index';

export default {
	meta: {
		home: {
			title: 'basedb – die kollaborative Datenbank, in der jede Tabelle eine echte PostgreSQL-Tabelle ist',
			description: 'Raster und acht Ansichten, Formeln, freigegebene Formulare und Ansichten, Kommentare, Automatisierungen, Dashboards, Berechtigungen bis auf Feldebene, lückenloser Verlauf, REST-API und MCP-Server – auf echten PostgreSQL-Tabellen mit lesbaren Namen. Selbst gehostet, AGPL-3.0.',
		},
		changelog: {
			title: 'Neuigkeiten – basedb',
			description: 'Was sich in basedb geändert hat, Version für Version.',
		},
		roadmap: {
			title: 'Roadmap – basedb',
			description: 'Was basedb als Nächstes können wird.',
		},
		gallery: {
			title: 'Vorlagen – basedb',
			description: 'Einsatzbereite Datenbanken: Ticketverfolgung, Bewertungsanalyse, CRM, Recruiting … mit Beispielzeilen, Ansichten, Dashboards und von der KI berechneten Feldern.',
		},
		template: {
			title: '{label} – basedb-Vorlagen',
		},
	},
	eodia: {
		home: 'https://eodia.com/',
		about: 'https://eodia.com/about/',
		contact: 'https://eodia.com/contact/',
	},
	nav: {
		aria: 'Hauptnavigation',
		home: 'basedb – Startseite',
		links: [
			{
				href: '/#fonctionnalites',
				label: 'Funktionen',
			},
			{
				href: '/modeles/',
				label: 'Vorlagen',
			},
			{
				href: '/guides/introduction/',
				label: 'Dokumentation',
			},
			{
				href: '/nouveautes/',
				label: 'Neuigkeiten',
			},
		],
		developers: 'Entwickler',
		github: 'Das GitHub-Repository von basedb',
		install: 'Installieren',
		menu: {
			open: 'Menü öffnen',
			close: 'Menü schließen',
			features: {
				label: 'Funktionen',
				groups: {
					organize: {
						title: 'Organisieren',
						items: {
							tables: {
								href: '/fonctionnalites/tables-et-champs/',
								title: 'Tabellen und Felder',
								text: 'Felder für alles, Verknüpfungen, Formeln auf Französisch.',
							},
							views: {
								href: '/fonctionnalites/vues/',
								title: 'Acht Ansichten',
								text: 'Raster, Kanban, Kalender, Zeitachse, Galerie, Liste, Formular, Umfrage.',
							},
							forms: {
								href: '/fonctionnalites/formulaires-partages/',
								title: 'Formulare',
								text: 'Ein Link zum Teilen: Jede Antwort wird zu einer Zeile.',
							},
							files: {
								href: '/fonctionnalites/fichiers/',
								title: 'Dateien und Bilder',
								text: 'Angebote, Fotos, Verträge – abgelegt bei ihrer Zeile.',
							},
						},
					},
					collaborate: {
						title: 'Zusammenarbeiten',
						items: {
							live: {
								href: '/fonctionnalites/collaboration/',
								title: 'Echtzeit und Kommentare',
								text: 'Die anderen bei der Arbeit sehen, eine Zeile kommentieren, eine Kollegin oder einen Kollegen erwähnen.',
							},
							rights: {
								href: '/fonctionnalites/droits/',
								title: 'Berechtigungen und Teams',
								text: 'Wer was sieht und wer was ändert, bis auf die Spalte genau.',
							},
							history: {
								href: '/fonctionnalites/historique/',
								title: 'Verlauf',
								text: 'Jede Änderung festgehalten und rückgängig machbar.',
							},
							shared: {
								href: '/fonctionnalites/vues-partagees/',
								title: 'Freigegebene Ansichten',
								text: 'Eine Ansicht per Link, auf Ihrer Website oder in Ihrem Kalender.',
							},
						},
					},
					automate: {
						title: 'Automatisieren und analysieren',
						items: {
							automations: {
								href: '/fonctionnalites/automatisations/',
								title: 'Automatisierungen',
								text: 'Wenn sich eine Zeile ändert: benachrichtigen, anlegen, schreiben, die KI fragen.',
							},
							dashboards: {
								href: '/fonctionnalites/tableaux-de-bord/',
								title: 'Dashboards',
								text: 'Fünfzehn Visualisierungen, gemeinsame Filter, ein Link zum Teilen.',
							},
							ai: {
								href: '/fonctionnalites/ia/',
								title: 'KI und Copilot',
								text: 'Eine Datenbank in einem Satz, Felder, die sich selbst ausfüllen.',
							},
							templates: {
								href: '/modeles/',
								title: 'Vorlagen',
								text: 'Zehn einsatzbereite Datenbanken, zum Anpassen.',
							},
						},
					},
				},
				feature: {
					tag: 'Neu',
					title: 'Automatisierungen als Ablauf',
					text: 'Suchen, entscheiden, die KI fragen: ein Graph-Editor, und jede Ausführung lässt sich Schritt für Schritt nachlesen.',
					href: '/nouveautes/',
					cta: 'Alle Neuigkeiten',
				},
				all: 'Alle Funktionen',
			},
			solutions: {
				label: 'Lösungen',
				title: 'Für jedes Team',
				items: {
					crm: {
						team: 'Vertrieb',
						text: 'Pipeline, Kontakte, Nachfassaktionen.',
					},
					recrutement: {
						team: 'Personalwesen',
						text: 'Bewerbungen, Gespräche, Zusammenfassungen durch die KI.',
					},
					'calendrier-editorial': {
						team: 'Marketing',
						text: 'Artikel, Posts und Newsletter, geplant.',
					},
					inventaire: {
						team: 'Betrieb',
						text: 'Ein berechneter Bestand, Engpässe im Voraus sichtbar.',
					},
					'gestion-projet': {
						team: 'Projekte',
						text: 'Meilensteine, Aufgaben und Abhängigkeiten.',
					},
					'suivi-tickets': {
						team: 'Produkt',
						text: 'Bugs und Anfragen, von der KI sortiert.',
					},
					'base-connaissances': {
						team: 'Support',
						text: 'Hilfeartikel, Fragen, vorgeschlagene Antworten.',
					},
					evenements: {
						team: 'Veranstaltungen',
						text: 'Anmeldungen, Plätze, Rückmeldungen.',
					},
					'analyse-avis': {
						team: 'Kundenbeziehung',
						text: 'Bewertungen, von der KI gelesen und eingeordnet.',
					},
				},
				ask: {
					title: 'Etwas anderes im Kopf?',
					text: 'Beschreiben Sie Ihren Bedarf in einem Satz: Die KI schlägt Ihnen eine maßgeschneiderte Datenbank vor.',
					href: '/modeles/',
				},
				all: 'Alle Vorlagen',
			},
			developers: {
				label: 'Entwickler',
				groups: {
					build: {
						title: 'Integrieren',
						items: {
							api: {
								href: '/integrations/api-rest/',
								title: 'REST-API',
								text: 'Dieselben Daten wie die Oberfläche, beschrieben in OpenAPI 3.1.',
							},
							mcp: {
								href: '/integrations/mcp/',
								title: 'MCP-Server',
								text: 'Tools für Ihre KI-Agenten, unter Ihren Berechtigungen.',
							},
							webhooks: {
								href: '/integrations/webhooks/',
								title: 'Webhooks',
								text: 'Jeder Schreibvorgang signiert, geordnet, bei Fehlern wiederholt.',
							},
							sql: {
								href: '/integrations/sql/',
								title: 'Direktes SQL',
								text: 'Echte PostgreSQL-Tabellen, mit lesbaren Namen.',
							},
							sync: {
								href: '/integrations/synchronisation/',
								title: 'Synchronisierung',
								text: 'Tabellen, aktuell gehalten von anderswo.',
							},
						},
					},
					host: {
						title: 'Hosten',
						items: {
							docker: {
								href: '/hebergement/docker/',
								title: 'Docker Compose',
								text: 'Ein Image, eine PostgreSQL-Datenbank, ein einziger Port.',
							},
							env: {
								href: '/hebergement/variables/',
								title: 'Variablen',
								text: 'Alles wird in der Datei .env eingestellt.',
							},
							https: {
								href: '/hebergement/https/',
								title: 'Domain und HTTPS',
								text: 'Hinter Ihrem eigenen Proxy, oder mit dem mitgelieferten Caddy.',
							},
							sso: {
								href: '/hebergement/connexion/',
								title: 'Anmeldung und SSO',
								text: 'Google, Microsoft, jeder OpenID-Connect-Anbieter.',
							},
							backup: {
								href: '/hebergement/sauvegardes/',
								title: 'Sicherungen und Updates',
								text: 'pg_dump, und Updates ohne Verlust.',
							},
						},
					},
				},
				feature: {
					title: 'Die Seite für Entwickler',
					text: 'Eine echte PostgreSQL-Tabelle hinter jedem Raster.',
					href: '/developpeurs/',
				},
			},
			resources: {
				label: 'Ressourcen',
				groups: {
					learn: {
						title: 'Lernen',
						items: {
							docs: {
								href: '/guides/introduction/',
								title: 'Dokumentation',
								text: 'Alles über basedb, Schritt für Schritt.',
							},
							start: {
								href: '/guides/premiers-pas/',
								title: 'Erste Schritte',
								text: 'Eine erste Datenbank, vom Import bis zur Ansicht.',
							},
							install: {
								href: '/guides/installation/',
								title: 'Installation',
								text: 'Zwei Dateien und ein Befehl.',
							},
							principles: {
								href: '/architecture/principes/',
								title: 'Die Prinzipien',
								text: 'Wie basedb aufgebaut ist, und warum.',
							},
						},
					},
					follow: {
						title: 'Dem Projekt folgen',
						items: {
							news: {
								href: '/nouveautes/',
								title: 'Neuigkeiten',
								text: 'Was sich geändert hat, Version für Version.',
							},
							roadmap: {
								href: '/feuille-de-route/',
								title: 'Roadmap',
								text: 'Was als Nächstes kommt.',
							},
							github: {
								href: 'https://github.com/eodia/basedb',
								title: 'GitHub',
								text: 'Der Code, die Tickets, die Versionen.',
							},
							eodia: {
								href: 'https://eodia.com/',
								title: 'Eodia',
								text: 'Das Studio hinter basedb.',
							},
						},
					},
				},
			},
		},
	},
	language: {
		label: 'Sprache',
		current: 'Sprache: {name}',
	},
	footer: {
		tagline: 'Die kollaborative Datenbank, in der jede Tabelle eine echte PostgreSQL-Tabelle ist.',
		madeBy: 'Freie Software von <a class="eodia" href="https://eodia.com/">Eodia</a>, einem KI-nativen Softwarestudio.',
		columns: {
			product: {
				title: 'Produkt',
				links: [
					{
						href: '/#fonctionnalites',
						label: 'Funktionen',
					},
					{
						href: '/nouveautes/',
						label: 'Neuigkeiten',
					},
					{
						href: '/feuille-de-route/',
						label: 'Roadmap',
					},
					{
						href: '/#faq',
						label: 'Häufige Fragen',
					},
				],
			},
			docs: {
				title: 'Dokumentation',
				links: [
					{
						href: '/guides/introduction/',
						label: 'Einführung',
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
						label: 'MCP-Server',
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
						label: 'Umgebungsvariablen',
					},
					{
						href: '/hebergement/https/',
						label: 'Domain und HTTPS',
					},
					{
						href: '/hebergement/sauvegardes/',
						label: 'Backups',
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
						label: 'Architekturdokument',
					},
					{
						href: 'https://github.com/eodia/basedb/blob/main/LICENSE',
						label: 'Lizenz AGPL-3.0',
					},
					{
						href: 'https://github.com/eodia/basedb/issues',
						label: 'Problem melden',
					},
				],
			},
			eodia: {
				title: 'Eodia',
				links: [
					{
						href: 'https://eodia.com/',
						label: 'Das Studio',
					},
					{
						href: 'https://eodia.com/about/',
						label: 'Über uns',
					},
					{
						href: 'https://eodia.com/contact/',
						label: 'Kontakt',
					},
				],
			},
		},
		copyright: '© {year} <a href="https://eodia.com/">Eodia</a> · AGPL-3.0-or-later',
		builtWith: 'Website erstellt mit Astro und Starlight.',
	},
	docsFooter: {
		madeBy: 'basedb ist freie Software von <a href="https://eodia.com/">Eodia</a>, einem KI-nativen Softwarestudio.',
	},
	teams: {
		meta: {
			title: 'basedb – Ihre ganze Arbeit an einem Ort',
			description: 'Kunden, Projekte, Lagerbestand, Bewerbungen: eine Datenbank, die das ganze Team gleichzeitig bearbeitet, als Tabelle, Kanban oder Kalender, mit Dashboards, Automatisierungen und KI. Ohne Code, frei und kostenlos.',
		},
		hero: {
			eyebrow: 'basedb',
			title: 'Ihre ganze Arbeit.',
			titleAccent: 'Endlich an einem Ort.',
			lead: 'Tabellen, Kalender, Formulare, Dashboards und Automatisierungen, für das ganze Team. So einfach wie eine Tabellenkalkulation. Ohne eine Zeile Code.',
			primary: 'Vorlagen entdecken',
			secondary: 'Demo ansehen',
			facts: ['Ohne Code', 'Frei und kostenlos', 'Ihre Daten bleiben bei Ihnen'],
		},
		story: {
			grid: {
				title: 'Das ganze Team, in derselben Tabelle.',
				text: 'Alle arbeiten gleichzeitig darin, und alle sehen dasselbe, aktuell.',
			},
			copilot: {
				title: 'Fragen Sie. Der Copilot übernimmt.',
				text: '„Bei wem muss ich diese Woche nachfassen?“ – er schlägt Ihnen den passenden Filter vor, und Sie wenden ihn mit einem Klick an.',
			},
			kanban: {
				title: 'Ziehen. Schon aktuell.',
				text: 'Jede Phase wird zu einer Spalte; eine Karte verschieben heißt, die Zeile ändern.',
			},
			calendar: {
				title: 'Jedes Datum an seinem Platz.',
				text: 'Die Termine erscheinen von selbst und lassen sich bis in Ihren eigenen Kalender verfolgen.',
			},
			dashboard: {
				title: 'Und alles, auf einen Blick.',
				text: 'Die Zahlen berechnen sich selbst, aus denselben Zeilen.',
			},
		},
		stage: {
			aria: 'Die Kundenbetreuung eines Teams in basedb: Tabelle, Copilot, Kanban, Kalender, Dashboard',
			tabs: {
				grid: 'Tabelle',
				copilot: 'Copilot',
				kanban: 'Kanban',
				calendar: 'Kalender',
				dashboard: 'Dashboard',
			},
			project: 'Hauptprojekt',
			projectMeta: 'Projekt · 2 Datenbanken',
			filterNav: 'Navigation filtern',
			base: 'Vertrieb',
			otherBase: 'Support',
			tables: ['Kunden', 'Kontakte', 'Angebote'],
			baseSection: 'Datenbank · Vertrieb',
			screens: ['Dashboards', 'Automatisierungen'],
			user: 'Léa Martin',
			views: { grid: 'Alle Zeilen', kanban: 'Nach Phase', calendar: 'Termine' },
			toolbar: {
				filter: 'Filtern',
				columns: 'Spalten',
				group: 'Gruppieren',
				colors: 'Farben',
				sort: 'Sortieren',
				configure: 'Konfigurieren',
			},
			search: 'Suchen…',
			add: 'Hinzufügen',
			columns: {
				name: 'Kunde',
				status: 'Phase',
				owner: 'Betreut von',
				amount: 'Betrag',
				next: 'Nächster Termin',
			},
			statuses: {
				contact: 'Zu kontaktieren',
				meeting: 'Termin',
				quote: 'Angebot gesendet',
				signed: 'Unterschrieben',
			},
			clients: [
				'Bäckerei Martin',
				'Klinik Lindenhof',
				'Gymnasium Nordpark',
				'Fahrradwerkstatt Wendepunkt',
				'Feinkost Vogel',
				'Rheinschmiede',
				'Schreinerei Hoffmann',
			],
			addRow: 'Zeile hinzufügen',
			perPage: 'Zeilen pro Seite',
			card: 'Betreut von {owner}, Termin am {date}',
			addCard: 'Karte hinzufügen',
			today: 'Heute',
			month: 'Monat',
			week: 'Woche',
			dashboards: 'Dashboards',
			questions: 'Fragen',
			dashboard: 'Vertriebsübersicht',
			dashboardText: 'Das Wichtigste auf einen Blick.',
			dashboardTabs: ['Übersicht', 'Aktivität'],
			period: 'Zeitraum',
			thisYear: 'Dieses Jahr',
			share: 'Freigeben',
			edit: 'Bearbeiten',
			explore: 'Daten erkunden',
			chart: 'Betrag pro Kunde',
			byStage: 'Kunden nach Phase',
			kpis: {
				signed: 'Unterschrieben',
				pending: 'Offene Angebote',
				rate: 'Abschlussquote',
			},
			copilot: {
				question: 'Bei wem muss ich diese Woche nachfassen?',
				thinking: 'Nachdenken…',
				answer: 'Vier Kunden warten auf eine Antwort: zwei gesendete Angebote und zwei vorzubereitende Termine.',
				card: 'Kunden filtern',
				filter: 'Phase: Angebot gesendet oder Termin',
				apply: 'Filter anwenden',
				applied: 'Filter angewendet',
				placeholder: 'Fragen Sie den Copilot…',
				filtered: '{n} gefilterte Zeilen',
			},
		},
		video: {
			eyebrow: 'Die Demo',
			title: 'Ganz basedb,',
			titleAccent: 'in vier Minuten.',
			text: 'Eine Datenbank erstellen, befüllen, teilen, automatisieren, steuern: die vollständige, kommentierte Führung.',
			play: 'Video abspielen',
			duration: '4:35 Min.',
			chapters: 'Kapitel',
			captions: 'Französisch',
			inFrench: 'Das Video ist auf Französisch, mit französischen Untertiteln.',
			list: [
				{ time: '0:08', title: 'Eine Datenbank erstellen' },
				{ time: '0:35', title: 'Tabellen, Felder und Formeln' },
				{ time: '1:10', title: 'Zeilendetails und Zusammenarbeit' },
				{ time: '1:33', title: 'Acht Ansichten auf denselben Zeilen' },
				{ time: '2:01', title: 'Formulare und KI' },
				{ time: '2:37', title: 'Automatisierungen' },
				{ time: '2:59', title: 'Dashboards' },
				{ time: '3:15', title: 'SQL für alle' },
				{ time: '3:43', title: 'Verlauf und Berechtigungen' },
				{ time: '4:01', title: 'API, MCP und Copilot' },
			],
		},
		together: {
			eyebrow: 'Zusammenarbeit',
			title: 'Alle.',
			titleAccent: 'Gleichzeitig.',
			text: 'Die Änderungen der anderen kommen live an. Man sieht, wer welche Zeile ansieht, bespricht sie genau dort, und ein @ reicht, um eine Kollegin oder einen Kollegen zu benachrichtigen.',
			demo: {
				path: 'Vertrieb / Angebote',
				here: '3 Personen in dieser Tabelle',
				columns: {
					client: 'Kunde',
					status: 'Phase',
					amount: 'Betrag',
					due: 'Fälligkeit',
				},
				statuses: {
					draft: 'Entwurf',
					sent: 'Gesendet',
					signed: 'Unterschrieben',
				},
				rows: [
					'Bäckerei Martin',
					'Klinik Lindenhof',
					'Gymnasium Nordpark',
					'Fahrradwerkstatt Wendepunkt',
					'Feinkost Vogel',
					'Rheinschmiede',
				],
				comment: '@{name} kannst du dieses Angebot noch heute Abend freigeben?',
				reply: 'Freigegeben!',
				toast: '{name} hat „{field}“ geändert',
			},
			points: {
				live: {
					title: 'Live',
					text: 'Jede Änderung erscheint sofort bei den anderen, ohne die Seite neu zu laden.',
				},
				comments: {
					title: 'Kommentare und Erwähnungen',
					text: 'Man kommentiert eine Zeile, erwähnt eine Kollegin oder einen Kollegen mit @, und die Glocke benachrichtigt sie.',
				},
				undo: {
					title: 'Risikofrei rückgängig machen',
					text: 'Strg+Z macht Ihre letzte Änderung rückgängig – nie die eines Kollegen.',
				},
			},
			link: {
				href: '/fonctionnalites/collaboration/',
				label: 'Zusammenarbeiten',
			},
		},
		automate: {
			eyebrow: 'Automatisierungen',
			title: 'Es arbeitet,',
			titleAccent: 'während Sie schlafen.',
			text: 'Beschreiben Sie einmal, was passieren soll. Wenn sich eine Zeile ändert, jeden Morgen zu einer festen Uhrzeit oder mit einem Klick auf eine Schaltfläche, reiht basedb die Schritte aneinander – und jede Ausführung lässt sich Schritt für Schritt nachlesen.',
			clock: '03:12',
			when: 'Wenn',
			trigger: 'ein Angebot zu „Unterschrieben“ wechselt',
			steps: {
				find: {
					kind: 'Zeile suchen',
					text: 'Der Kunde des Angebots',
				},
				ai: {
					kind: 'KI fragen',
					text: 'Ein Dankeswort verfassen',
				},
				create: {
					kind: 'Zeile erstellen',
					text: 'Die Rechnung, in Rechnungen',
				},
				notify: {
					kind: 'Jemanden benachrichtigen',
					text: 'Die Buchhaltung',
				},
				slack: {
					kind: 'An Slack senden',
					text: 'Im Kanal #vertrieb',
				},
			},
			answer: 'Vielen Dank für Ihr Vertrauen! Wir starten Ihr Projekt ab Montag, Ihre Rechnung folgt per E-Mail.',
			done: 'Erfolgreich · 5 Schritte · 1,2 s',
			copilot: {
				prompt: 'Wenn ein Angebot unterschrieben wird, benachrichtige die Buchhaltung und erstelle die Rechnung.',
				text: 'Ein Satz an den Copilot, und die Automatisierung steht: Sie müssen sie nur noch prüfen.',
			},
			link: {
				href: '/fonctionnalites/automatisations/',
				label: 'Automatisierungen',
			},
		},
		glance: {
			eyebrow: 'Dashboards',
			title: 'Sehen Sie alles.',
			titleAccent: 'Auf einen Blick.',
			text: 'Zahlen, Kurven, Ziele: Ihre Dashboards entstehen mit der Maus aus Ihren Tabellen und bleiben von selbst aktuell. Ein Filter, und das ganze Dashboard folgt.',
			demo: {
				title: 'Vertriebssteuerung',
				filters: ['Dieses Jahr', 'Alle Städte'],
				revenue: 'Umsatz',
				signed: 'Unterschriebene Angebote',
				rate: 'Abschlussquote',
				goal: 'Jahresziel',
				byMonth: 'Umsatz pro Monat',
				byStage: 'Angebote nach Phase',
				stages: ['Gesendet', 'In Verhandlung', 'Unterschrieben'],
				bySector: 'Kunden nach Branche',
				sectors: ['Handel', 'Gesundheit', 'Bildung', 'Industrie'],
				shared: 'Per Link geteilt',
			},
			points: {
				viz: {
					title: 'Fünfzehn Visualisierungen',
					text: 'Kennzahlen, Trends, Fortschritt, Linien, Kreise, Trichter, Kreuztabellen, Landkarten.',
				},
				filters: {
					title: 'Gemeinsame Filter',
					text: 'Der Zeitraum, ein Kunde, eine Stadt: Ein Filter steuert eine Karte, mehrere oder das ganze Dashboard.',
				},
				share: {
					title: 'Per Link geteilt',
					text: 'Öffentlich oder nur fürs Team, und in eine andere Website einbindbar.',
				},
			},
			link: {
				href: '/fonctionnalites/tableaux-de-bord/',
				label: 'Dashboards',
			},
		},
		ai: {
			eyebrow: 'Künstliche Intelligenz',
			title: 'Beschreiben Sie.',
			titleAccent: 'basedb erstellt.',
			text: 'Ein Satz reicht für eine vollständige Datenbank, die Sie vor dem Erstellen noch prüfen. Danach schlägt der Copilot Filter, Diagramme und Automatisierungen vor, und KI-Felder fassen zusammen, sortieren und schreiben an Ihrer Stelle.',
			prompt: 'Eine Bewerbungsverfolgung für unsere drei offenen Stellen, mit den Gesprächen.',
			thinking: 'Drei verknüpfte Tabellen, bereit zum Durchsehen.',
			tables: {
				jobs: {
					name: 'Stellen',
					fields: ['Bezeichnung', 'Abteilung', 'Eröffnet am'],
				},
				people: {
					name: 'Bewerber',
					fields: ['Name', 'Stelle', 'Phase', 'Zusammenfassung'],
				},
				talks: {
					name: 'Gespräche',
					fields: ['Bewerber', 'Datum', 'Mit', 'Eindruck'],
				},
			},
			aiField: 'Zusammenfassung',
			aiValue: 'Sechs Jahre Projektmanagement, sicher im Kundenumgang; noch zu prüfen: Englisch.',
			create: 'Datenbank erstellen',
			providers: 'Mit dem Anbieter Ihrer Wahl – OpenAI, Anthropic, Mistral, oder einem bei Ihnen installierten Modell. Ohne Ihre Zustimmung geht nichts hinaus.',
			link: {
				href: '/fonctionnalites/ia/',
				label: 'KI in basedb',
			},
		},
		features: {
			title: 'Alles, was Sie brauchen.',
			titleAccent: 'Und noch viel mehr.',
			text: 'Jede Funktion schreibt in dieselben Tabellen, unter denselben Berechtigungen, in denselben Verlauf.',
			tiles: {
				views: {
					stat: '8',
					title: 'Möglichkeiten, Ihre Daten zu sehen',
					text: 'Raster, Kanban, Kalender, Zeitachse, Galerie, Liste, Formular und Umfrage, auf denselben Zeilen. Jeder wählt seine eigene.',
					href: '/fonctionnalites/vues/',
				},
				history: {
					stat: 'Strg+Z',
					title: 'Nichts geht verloren',
					text: 'Jede Änderung wird mit ihrem vorherigen Wert aufbewahrt; ein Fehler lässt sich rückgängig machen, eine gelöschte Zeile wiederherstellen.',
					href: '/fonctionnalites/historique/',
				},
				forms: {
					title: 'Formulare',
					text: 'Ein öffentlicher Link oder einer nur für das Team: Jede Antwort landet in der Tabelle, ohne den Rest zu öffnen.',
					href: '/fonctionnalites/formulaires-partages/',
				},
				viz: {
					stat: '15',
					title: 'Visualisierungen',
					text: 'Kennzahlen, Trends, Fortschritt, Linien, Kreise, Trichter, Kreuztabellen und Landkarten.',
					href: '/fonctionnalites/tableaux-de-bord/',
				},
				formulas: {
					code: 'SI([Montant] > 10000; "Grand compte"; "")',
					title: 'Formeln auf Französisch',
					text: 'Wie in einer Tabellenkalkulation – SI, ARRONDI, JOURS … – aber berechnet für das ganze Team.',
					href: '/fonctionnalites/tables-et-champs/#formeln',
				},
				rights: {
					title: 'Jeder sieht, was er sehen soll',
					text: 'Lesen, Bearbeiten, Verwalten, Team für Team; eine sensible Spalte lässt sich ausblenden.',
					href: '/fonctionnalites/droits/',
				},
				mentions: {
					bubble: '@Camille',
					title: 'Kommentare und Erwähnungen',
					text: 'Man bespricht eine Zeile dort, wo sie steht, und die Glocke benachrichtigt.',
					href: '/fonctionnalites/collaboration/',
				},
				relations: {
					title: 'Alles ist verknüpft',
					text: 'Kunden, Projekte, Rechnungen: Aggregationen und Nachschlagefelder reichen über Verknüpfungen hinweg.',
					href: '/fonctionnalites/tables-et-champs/',
				},
				templates: {
					stat: '10',
					title: 'fertige Vorlagen',
					text: 'CRM, Recruiting, Lagerbestand, Veranstaltungen … oder eine der KI in einem Satz beschriebene Datenbank.',
					href: '/modeles/',
				},
				import: {
					title: 'Import mit einer Geste',
					text: 'Ziehen Sie eine CSV-Datei hinein: Spalten und Typen werden erkannt, die Tabelle wird erstellt.',
					href: '/guides/premiers-pas/',
				},
				agenda: {
					title: 'Bis in Ihren Kalender',
					text: 'Ein Kalender wird zum Kalender-Feed für Google Kalender, Outlook oder Apple Kalender.',
					href: '/fonctionnalites/vues-partagees/',
				},
				files: {
					title: 'Dateien und Bilder',
					text: 'Angebote, Fotos, Verträge; ein Bild wird zum Titelbild einer Karte.',
					href: '/fonctionnalites/fichiers/',
				},
				share: {
					title: 'Freigegebene Ansichten',
					text: 'Eine schreibgeschützte Ansicht per Link, einbindbar in Ihre Website.',
					href: '/fonctionnalites/vues-partagees/',
				},
				sync: {
					title: 'Synchronisierte Tabellen',
					text: 'Aktuell gehalten aus einer Online-CSV-Datei, einem Kalender oder einem anderen basedb.',
					href: '/integrations/synchronisation/',
				},
				signin: {
					title: 'Einfache Anmeldung',
					text: 'Google, Microsoft oder Passwort; Kolleginnen und Kollegen werden per Link eingeladen.',
					href: '/hebergement/connexion/',
				},
				languages: {
					title: 'In Ihrer Sprache',
					text: 'Die Oberfläche übernimmt die Sprache jeder Person, aus zwanzig verschiedenen.',
					href: '/fonctionnalites/droits/#ihre-einstellungen',
				},
			},
		},
		yours: {
			eyebrow: 'Frei und selbst gehostet',
			per: 'pro Person. Für immer.',
			text: 'basedb ist freie Software. Installieren Sie es auf Ihrem Server und laden Sie das ganze Team ein: kein Abonnement, keine zu zählenden Lizenzen, und Ihre Daten bleiben bei Ihnen.',
			points: {
				home: {
					title: 'Bei Ihnen',
					text: 'Auf Ihrem Server oder dem Ihres Hosters, gesichert wie jede PostgreSQL-Datenbank.',
				},
				free: {
					title: 'Frei',
					text: 'Unter der AGPL-3.0-Lizenz: Der Code ist offen und bleibt es.',
				},
				ai: {
					title: 'Die KI Ihrer Wahl',
					text: 'Ein Anbieter vom Markt, ein bei Ihnen installiertes Modell – oder gar keine KI.',
				},
			},
			link: {
				href: '/guides/installation/',
				label: 'basedb installieren',
			},
		},
		gallery: {
			eyebrow: 'Vorlagen',
			title: 'Fertig in einer Minute.',
			text: 'Starten Sie mit einer Vorlage, mit ihren Tabellen, Ansichten, ihrem Dashboard und Beispielzeilen, und passen Sie sie dann an Ihre Arbeitsweise an.',
			use: 'Entdecken',
			ask: {
				title: 'Nichts Passendes gefunden?',
				text: 'Beschreiben Sie Ihren Bedarf in einem Satz: Die KI schlägt Ihnen eine maßgeschneiderte Datenbank vor.',
			},
			all: 'Alle Vorlagen ansehen',
			previous: 'Vorherige Vorlagen',
			next: 'Nächste Vorlagen',
		},
		developers: {
			title: 'Und auf der technischen Seite?',
			text: 'Jede Tabelle ist eine echte PostgreSQL-Tabelle. REST-API, Webhooks, MCP-Server für KI-Agenten, und eine Installation mit einem Befehl.',
			link: 'Die Seite für Entwickler',
		},
		faq: {
			title: 'Ihre Fragen',
			items: [
				{
					q: 'Muss man programmieren können?',
					a: 'Nein. Tabellen, Ansichten, Formulare, Dashboards und Automatisierungen werden mit der Maus erstellt. Formeln schreibt man auf Französisch, wie in einer Tabellenkalkulation: SI, ARRONDI, JOURS …',
				},
				{
					q: 'Was kostet es?',
					a: 'Nichts: basedb ist freie Software, ohne Abonnement und ohne Preis pro Person. Sie brauchen nur einen Server, auf dem Sie es installieren.',
				},
				{
					q: 'Wie installiert man es?',
					a: 'Auf einem Server, mit Docker: zwei Dateien und ein Befehl, wenige Minuten für die Person, die sich um Ihre IT kümmert. Die Installationsanleitung erklärt alles, Schritt für Schritt.',
				},
				{
					q: 'Können wir unsere Tabellenkalkulationen übernehmen?',
					a: 'Ja: Speichern Sie Ihre Tabelle als CSV und ziehen Sie sie in basedb. Der Import erkennt den Typ jeder Spalte, erstellt die Tabelle und sagt Zeile für Zeile, was er nicht übernehmen konnte.',
				},
				{
					q: 'Kann man zu mehreren gleichzeitig arbeiten?',
					a: 'Genau dafür ist es gemacht. Die Änderungen der anderen erscheinen live, man kommentiert eine Zeile, erwähnt eine Kollegin oder einen Kollegen mit @, und eine Glocke benachrichtigt.',
				},
				{
					q: 'Und die KI, liest sie unsere Daten?',
					a: 'Nur, wenn Sie es entscheiden. Ohne eingerichteten KI-Anbieter geht nichts hinaus. Danach sendet ein Feld oder eine Automatisierung, die die KI aufruft, nur das, was ihre Anweisung zitiert, nach Ihrer Zustimmung.',
				},
				{
					q: 'In welcher Sprache?',
					a: 'In Ihrer eigenen: Die Oberfläche übernimmt die Sprache Ihres Browsers, aus zwanzig, und jeder kann sie in seinen Einstellungen ändern.',
				},
			],
		},
		cta: {
			title: 'Ihr Team hat Besseres verdient',
			titleAccent: 'als eine geteilte Datei.',
			text: 'Starten Sie mit einer Vorlage, laden Sie Ihre Kolleginnen und Kollegen ein, und lassen Sie die „FINAL (2)“ hinter sich.',
			primary: 'Vorlagen entdecken',
			secondary: 'basedb installieren',
		},
	},
	hero: {
		badge: 'Neu: Automatisierungen als Ablauf, Dashboards und SQL-Views',
		title: ['Die kollaborative', 'Datenbank – jede', 'Tabelle eine echte'],
		titleAccent: 'PostgreSQL-Tabelle.',
		lead: 'Die Einfachheit einer geteilten Tabellenkalkulation – Raster, Ansichten, Formulare, Berechtigungen – und Daten, die in <strong>typisierten Tabellen mit lesbaren Namen</strong> liegen. Ihr Team arbeitet in der Oberfläche; Ihre Skripte, Ihre BI-Tools, Ihre KI-Agenten und <code>psql</code> lesen dieselben Zeilen.',
		install: 'Mit Docker installieren',
		features: 'Funktionen ansehen',
		copy: 'Befehl kopieren',
		facts: ['Selbst gehostet', 'AGPL-3.0', 'REST-API & MCP-Server'],
		demo: {
			url: 'basedb.ihre-domain.de',
			project: 'Hauptprojekt',
			projectMeta: 'Projekt · 2 Datenbanken',
			filter: 'Datenbanken und Tabellen filtern',
			sales: 'Vertrieb',
			support: 'Support',
			environment: 'Produktion',
			clients: 'Kunden',
			opportunities: 'Verkaufschancen',
			quotes: 'Angebote',
			baseSection: 'Datenbank · Vertrieb',
			screens: ['Dashboards', 'Automatisierungen'],
			copilot: '✦ Copilot',
			allRows: '▦ Alle Zeilen ▾',
			tools: ['Filtern', 'Gruppieren', 'Farben'],
			search: 'Suchen…',
			add: '+ Hinzufügen',
			columns: {
				name: 'Name',
				status: 'Status',
				amount: 'Betrag',
				client: 'Kunde',
			},
			statuses: {
				nouveau: 'Neu',
				qualifie: 'Qualifiziert',
				proposition: 'Angebot',
				negociation: 'Verhandlung',
				gagne: 'Gewonnen',
				perdu: 'Verloren',
			},
			deals: {
				portail: {
					name: 'Portal-Relaunch',
					client: 'Stadt Lindau',
				},
				erp: {
					name: 'ERP-Migration',
					client: 'Brandt-Gruppe',
				},
				audit: {
					name: 'Sicherheitsaudit',
					client: 'Klinik St. Rochus',
				},
				billetterie: {
					name: 'Online-Ticketing',
					client: 'Theater am Markt',
				},
				flotte: {
					name: 'Fuhrpark-Tracking',
					client: 'Spedition Kerner',
				},
				mobile: {
					name: 'Mobile App',
					client: 'Atelier Moser',
				},
				intranet: {
					name: 'Intranet-Relaunch',
					client: '',
				},
			},
			toastTitle: 'Formular „Angebotsanfrage“',
			toastText: 'öffentliche Antwort · hat „{name}“ erstellt',
			cursor: 'Camille',
			psqlRows: '(2 Zeilen)',
		},
	},
	showcase: {
		label: 'Die echte Oberfläche',
		title: 'Alles, was Ihr Team von einer geteilten Tabellenkalkulation erwartet.',
		tabs: 'Screenshots der Oberfläche',
		alt: 'basedb – {labelLower}: {caption}',
		shots: {
			grille: {
				label: 'Raster',
				caption: 'Ein Raster, das in eine echte Tabelle schreibt – und berechnete Felder: eine Dauer per Formel, der Ort des Kunden per Nachschlagefeld, die Zahl der Aufgaben per Anzahl-Feld.',
			},
			kanban: {
				label: 'Kanban',
				caption: 'Dieselben Zeilen in Spalten, nach einer Einfachauswahl: ein Titelbild, eine Beschreibung, die die Zeile zitiert. Eine Karte verschieben heißt, die Zeile ändern.',
			},
			galerie: {
				label: 'Galerie',
				caption: 'Karten mit ihrem Bild, eine Farbe pro Status: die Galerie, eine von acht Möglichkeiten, eine Tabelle zu lesen.',
			},
			chronologie: {
				label: 'Zeitachse',
				caption: 'Balken zwischen zwei Datumsangaben und die Pfeile ihrer Abhängigkeiten – rot, wenn die Reihenfolge nicht mehr stimmt.',
			},
			tableaux: {
				label: 'Dashboards',
				caption: 'Karten im Raster, in Reitern, unter gemeinsamen Filtern: ein Trend, ein Ziel, gestapelte Reihen – gelesen mit den Berechtigungen jeder Person.',
			},
			automatisations: {
				label: 'Automatisierungen',
				caption: 'Ist eine Aufgabe erledigt, wird gesucht, was vom Projekt noch offen ist; bleibt nichts mehr übrig, verfasst die KI das Abschlusswort, und das Projekt wechselt zu „Ausgeliefert“. Jede Ausführung lässt sich auf dem Ablauf nachlesen, Schritt für Schritt.',
			},
			commentaires: {
				label: 'Kommentare',
				caption: 'Über eine Zeile spricht man dort, wo sie steht: Kommentare, Erwähnungen, Benachrichtigungen.',
			},
			formulaire: {
				label: 'Formular',
				caption: 'Ein Formular wird per Link freigegeben, öffentlich oder nur für angemeldete Mitglieder.',
			},
			historique: {
				label: 'Verlauf',
				caption: 'Jeder Schreibvorgang, woher er auch kommt – eine Person, eine Automatisierung, direktes SQL –, mit den vorherigen Werten.',
			},
			sql: {
				label: 'SQL',
				caption: 'Eine Abfrage auf die echten Namen, unter den Tabellen für das ganze Team gespeichert – und jede Person führt sie mit ihren eigenen Berechtigungen aus.',
			},
			vuesSql: {
				label: 'SQL-Views',
				caption: 'Echte PostgreSQL-Views, zwischen den Tabellen einsortiert, mit Farbe und Symbol – und aus psql lesbar.',
			},
		},
	},
	features: {
		postgres: {
			label: 'PostgreSQL, ohne Übersetzung',
			title: 'Ein Raster fürs Team, eine echte Tabelle {für Ihre Tools.}',
			lead: 'Kein generisches Modell, kein JSON als Sammelbecken, kein <code>field_1837</code>: Eine Datenbank ist ein Schema, eine Tabelle ist eine Tabelle, ein Feld ist eine typisierte Spalte mit lesbarem Namen.',
			bullets: [
				'<strong>Native Typen</strong>: <code>text</code>, <code>numeric</code>, <code>date</code>, <code>timestamptz</code>, <code>boolean</code> – und echte Fremdschlüssel für Verknüpfungen.',
				'<strong>Constraints, die die Datenbank durchsetzt</strong>: Einfachauswahlen als <code>CHECK</code>, geprüfte Web- und E-Mail-Adressen, Verknüpfungen als <code>FOREIGN KEY</code>.',
				'<strong>Von PostgreSQL berechnete Formeln</strong>: <code>JOURS([Fin]; [Début])</code> wird zu einer generierten Spalte, die <code>psql</code> wie jede andere liest.',
				'<strong>Direktes SQL bleibt erlaubt</strong> – und selbst das landet im Verlauf, per Trigger.',
				'<strong>SQL-Abfragen und SQL-Views</strong> in der Oberfläche: Abfragen, unter den Tabellen gespeichert, für Sie selbst oder fürs Team, und echte PostgreSQL-Views zwischen ihnen, die auch <code>psql</code> liest.',
				'<strong>Umbenennen heißt nicht kaputtmachen</strong>: Der alte Name bleibt über einen Kompatibilitätsalias erreichbar, solange Sie Ihre Abfragen migrieren.',
			],
			links: [
				{
					href: '/integrations/sql/',
					label: 'Mit SQL arbeiten',
				},
				{
					href: '/fonctionnalites/requetes-et-vues-sql/',
					label: 'Abfragen und SQL-Views',
				},
				{
					href: '/architecture/principes/',
					label: 'Die Prinzipien',
				},
			],
		},
		automations: {
			label: 'Automatisieren',
			title: 'Automatisierungen als Ablauf, {KI in jedem Schritt.}',
			lead: 'Wenn sich eine Zeile ändert, zu fester Uhrzeit oder per Klick: Ein Graph-Editor verkettet die Schritte, und jede Ausführung lässt sich auf dem Ablauf nachvollziehen.',
			bullets: [
				'<strong>Ein lesbarer Ablauf</strong>: der Auslöser, dann jeder Schritt als Karte; ein <strong>+</strong> auf einer Linie fügt genau dort einen Schritt ein.',
				'<strong>Suchen, entscheiden, schreiben</strong>: eine Zeile finden, je nach Bedingungen den einen oder anderen Zweig nehmen, bearbeiten, anlegen, benachrichtigen, einen Webhook aufrufen, in Slack schreiben.',
				'<strong>KI fragen</strong> in einem Schritt: eine Anweisung, die die Zeile zitiert, eine Antwort, gelesen als Text, Zahl, Datum oder Auswahl, die die folgenden Schritte weiterverwenden.',
				'<strong>Der Copilot</strong> schlägt aus einem einzigen Satz eine ganze Automatisierung vor oder erklärt, warum eine Ausführung fehlgeschlagen ist – nichts wird ohne Sie gespeichert.',
				'<strong>Mit den Berechtigungen der Person, die sie geschrieben hat</strong>, und im Verlauf wie jeder andere Schreibvorgang.',
			],
			links: [
				{
					href: '/fonctionnalites/automatisations/',
					label: 'Die Automatisierungen',
				},
				{
					href: '/fonctionnalites/automatisations/#der-copilot',
					label: 'Der Copilot',
				},
			],
			alt: 'basedb – die Automatisierung „Projekt ausgeliefert“ im Ablauf-Editor: Ist eine Aufgabe erledigt, die Uhrzeit festhalten, suchen, was vom Projekt noch offen ist, den Zweig „Sonst“ nehmen, die KI nach dem Abschlusswort fragen und das Projekt ausliefern; rechts ihre letzten Ausführungen, Schritt für Schritt.',
		},
		dashboards: {
			label: 'Analysieren',
			title: 'Dashboards, {ohne Ihre Tabellen zu verlassen.}',
			lead: 'Fragen per Maus oder in SQL, fünfzehn Visualisierungen, gemeinsame Filter – und jede Person liest sie mit ihren eigenen Berechtigungen.',
			bullets: [
				'<strong>Fragen</strong>: eine Tabelle, ihre Joins, Filter und Kennzahlen nach Tag, Woche, Monat oder Jahr – oder schreibgeschütztes SQL.',
				'<strong>Fünfzehn Visualisierungen</strong>: Kennzahl, Trend, Fortschritt, Messanzeige, Balken, Linien, Kreis, Trichter, Kreuztabelle, Landkarte …',
				'<strong>Mit einem Klick erkunden</strong>: Ein Punkt öffnet seine Zeilen oder einen feineren Zeitraum.',
				'<strong>Gemeinsame Filter</strong>, die eine, mehrere oder alle Karten steuern.',
				'<strong>Per Link freigeben</strong>, öffentlich oder nur für Mitglieder, und in eine andere Website einbetten.',
			],
			links: [
				{
					href: '/fonctionnalites/tableaux-de-bord/',
					label: 'Die Dashboards',
				},
			],
			alt: 'basedb – ein Dashboard: Trend des Monats, Ziel für Zahlungseingänge, Umsatz pro Monat, Stimmung der Bewertungen, unter Filtern für Zeitraum und Kunde.',
		},
		rights: {
			label: 'Zusammenarbeiten, ohne alles zu öffnen',
			title: 'Berechtigungen bis zum Feld, {ein Verlauf ohne Lücken.}',
			lead: 'Berechtigungen werden Gruppen erteilt, auf ein Projekt, eine Datenbank oder eine Tabelle, und gelten für alles darunter. Eine sensible Spalte lässt sich vor einer Gruppe verbergen oder für sie schreibschützen.',
			bullets: [
				'<strong>Vier Stufen</strong>: Kein Zugriff, Lesen, Bearbeiten, Verwalten – über Gruppen hinweg addiert.',
				'<strong>Selbst SQL folgt Ihren Berechtigungen</strong>: In der Oberfläche sieht eine Abfrage nur die Tabellen und Felder, die Ihnen offenstehen – und PostgreSQL selbst setzt das durch.',
				'<strong>Jeder Schreibvorgang wird erfasst</strong>, in seiner eigenen Transaktion: Oberfläche, API, Agent, öffentliches Formular oder direktes SQL.',
				'<strong>Eine Änderung lässt sich rückgängig machen</strong>, eine gelöschte Zeile wiederherstellen, eine gelöschte Datenbank ebenso.',
				'<strong>Administration will bestätigt sein</strong>: Wer eine Berechtigung ändert, muss sein Passwort in den letzten fünf Minuten erneut eingegeben haben.',
			],
			links: [
				{
					href: '/fonctionnalites/droits/',
					label: 'Berechtigungen und Gruppen',
				},
				{
					href: '/fonctionnalites/historique/',
					label: 'Der Verlauf',
				},
			],
		},
		agents: {
			label: 'REST-API · MCP · Webhooks',
			title: 'Ihre KI-Agenten bekommen die Daten, {nicht den Generalschlüssel.}',
			lead: 'Der MCP-Server gibt Agenten zwölf Tools, die REST-API Ihren Programmen dieselben Daten. Eine einzige Stelle, an der Berechtigungen geprüft werden, dieselben Protokolle.',
			bullets: [
				'<strong>Ein Token pro Datenbank</strong>, standardmäßig schreibgeschützt, nie mit mehr Berechtigungen als die Person, die es angelegt hat.',
				'<strong>Ein Agent löscht nichts</strong> und ändert nicht die Struktur: Er schlägt sie vor, ein Mensch genehmigt.',
				'<strong>Eine generierte Dokumentation</strong> für jede Datenbank, nach Ihren Berechtigungen gefiltert, mit ihrer OpenAPI-3.1-Spezifikation.',
				'<strong>Webhooks</strong> bei jedem Schreibvorgang: signiert, geordnet und bei Fehlern wiederholt.',
			],
			links: [
				{
					href: '/integrations/mcp/',
					label: 'Einen Agenten anbinden',
				},
				{
					href: '/integrations/api-rest/',
					label: 'Die REST-API',
				},
			],
		},
	},
	sqlVisual: {
		interface: 'Oberfläche',
		title: 'Neues Feld · Verkaufschancen',
		labelField: 'Bezeichnung',
		labelValue: 'Betrag',
		typeField: 'Typ',
		typeValue: 'Zahl',
		descriptionField: 'Beschreibung',
		descriptionValue: 'Nettobetrag des Vertrags',
		required: 'Erforderlich',
		ai: 'KI',
		migration: 'eine geplante Migration, kurze Sperren',
	},
	rightsVisual: {
		groups: ['Administratoren', 'Vertriebsteam', 'Support'],
		project: 'Hauptprojekt',
		sales: 'Vertrieb',
		opportunities: 'Verkaufschancen',
		clients: 'Kunden',
		support: 'Support',
		inherited: 'geerbt',
		levels: {
			none: 'Kein Zugriff',
			read: 'Lesen',
			edit: 'Bearbeiten',
			manage: 'Verwalten',
		},
		field: 'Feld „Marge“',
		hidden: 'Verborgen',
		sqlChange: '<b>Direkte SQL-Sitzung</b> hat <b>„ERP-Migration“</b> geändert',
		sqlMeta: '02:46 · lokale Verbindung · psql',
		sqlDiff: 'Betrag: <s>125.000</s> → 130.000',
		undo: '↶ Rückgängig',
		formChange: '<b>Formular „Angebotsanfrage“</b> hat <b>„Intranet-Relaunch“</b> erstellt',
		formMeta: 'öffentliche Antwort · veröffentlicht von Camille',
	},
	agentVisual: {
		agent: 'Agent',
		via: 'verbunden über MCP · Token „Vertrieb“',
		question: 'Wie viele Verkaufschancen sind in Verhandlung, und um welchen Betrag geht es?',
		listArgs: 'opportunites · statut = Verhandlung',
		answer: 'Zwei Verkaufschancen, insgesamt <b>182.000 €</b>: ERP-Migration (130.000 €) und Fuhrpark-Tracking (52.000 €).',
		request: 'Füge ein Feld „Wahrscheinlichkeit“ in Prozent hinzu.',
		proposeArgs: 'opportunites · Wahrscheinlichkeit · number',
		proposed: 'Vorgeschlagen: Eine Person aus dem Team muss es in basedb genehmigen.',
		badge: 'Vorschlag',
		expires: 'läuft in 23 Std. ab',
		what: 'Feld <b>„Wahrscheinlichkeit“</b> (Zahl) zu <b>Verkaufschancen</b> hinzufügen',
		by: 'Vorgeschlagen vom Agenten · Token „Vertrieb“',
		refuse: 'Ablehnen',
		approve: 'Genehmigen',
	},
	bento: {
		label: 'Und alles andere',
		title: 'Was man von einem Team-Tool erwartet, ohne PostgreSQL loszulassen.',
		text: 'Jede Funktion schreibt in dieselben Tabellen, unter denselben Berechtigungen, in denselben Verlauf.',
		more: 'Mehr erfahren →',
		views: {
			title: 'Acht Ansichten auf dieselben Zeilen',
			text: 'Kollaborativ für das ganze Team oder persönlich nur für Sie: Jede Person wählt ihre Lesart, niemand kopiert die Daten.',
			chips: ['Raster', 'Kanban', 'Kalender', 'Zeitachse', 'Galerie', 'Liste', 'Formular', 'Umfrage'],
		},
		forms: {
			title: 'Freigegebene Formulare',
			text: 'Ein öffentlicher Link oder einer nur für angemeldete Mitglieder. Wer antwortet, erhält keinerlei Rechte an der Tabelle.',
			href: '/fonctionnalites/formulaires-partages/',
		},
		environments: {
			title: 'Umgebungen',
			text: 'Eine Datenbank, mehrere Ausprägungen. Vergleichen Sie die Struktur, migrieren Sie von einer zur anderen, synchronisieren Sie Zeilen.',
			chips: ['Produktion', 'Staging', 'Entwicklung'],
			href: '/fonctionnalites/environnements/',
		},
		collaboration: {
			title: 'Gemeinsam arbeiten',
			text: 'Die Schreibvorgänge der anderen kommen in Echtzeit an, Sie sehen, wer welche Zeile ansieht, und besprechen sie genau dort, wo sie steht: Kommentare, Erwähnungen, Benachrichtigungen. Strg+Z macht den letzten Schreibvorgang rückgängig – und verweigert, statt die Arbeit eines anderen zu überschreiben.',
			chips: ['Echtzeit', 'Präsenz', 'Kommentare', 'Erwähnungen', 'Strg+Z'],
			href: '/fonctionnalites/collaboration/',
		},
		small: {
			ai: {
				title: 'KI im Raster',
				text: 'Ein Feld, das ein Modell aus den anderen Spalten füllt, und ein Copilot, der Filter, Abfragen und Spalten vorschlägt, mit einem Klick angewendet. OpenAI, Anthropic, Mistral, oder ein Modell, das auf Ihrem eigenen Rechner läuft.',
				code: 'Fasse {{Notes}} in einem Satz zusammen',
				href: '/fonctionnalites/ia/',
			},
			formulas: {
				title: 'Verknüpfungen und Formeln',
				text: 'Echte Fremdschlüssel, Formeln auf Französisch, von PostgreSQL berechnet, und Nachschlagefelder, Aggregationen und Anzahlen über Verknüpfungen hinweg.',
				code: 'ARRONDI([Montant HT] * (1 + [Taux de TVA]); 2)',
				href: '/fonctionnalites/tables-et-champs/#formeln',
			},
			richText: {
				title: 'Formatierter Text und Variablen',
				text: 'Ein visueller Editor für formatierten Text, beim Schreiben bereinigt; und in jedem Langtext wird {{Ville}} mit dem Wert der Zeile gelesen.',
				code: 'Lieferung am {{Date}} in {{Ville}}',
				href: '/fonctionnalites/tables-et-champs/#formatierter-text-und-variablen',
			},
			languages: {
				title: 'In Ihrer Sprache',
				text: 'Die Oberfläche übernimmt die Sprache des Browsers, aus zwanzig möglichen; jede Person kann sie in ihren Einstellungen ändern.',
				href: '/fonctionnalites/droits/#ihre-einstellungen',
			},
			sharedViews: {
				title: 'Freigegebene Ansichten',
				text: 'Eine schreibgeschützte Ansicht per Link, in eine andere Website einbettbar; ein Kalender wird zum Feed für Ihre Kalender-App.',
				href: '/fonctionnalites/vues-partagees/',
			},
			syncedTables: {
				title: 'Synchronisierte Tabellen',
				text: 'Eine Tabelle, aktuell gehalten aus einer Online-CSV, einem Kalender oder der freigegebenen Ansicht eines anderen basedb.',
				href: '/integrations/synchronisation/',
			},
			templates: {
				title: 'Datenbankvorlagen',
				text: 'Zehn einsatzbereite Vorlagen, eine Datenbank, der KI in einem Satz beschrieben, und Ihre eigene als Vorlage gespeichert.',
				href: '/modeles/',
			},
			files: {
				title: 'Dateien und Bilder',
				text: 'Auf der Festplatte des Hosts oder in einem S3-kompatiblen Speicher: AWS, Scaleway, OVH, Cloudflare R2, Garage, MinIO …',
				href: '/fonctionnalites/fichiers/',
			},
			import: {
				title: 'CSV- und JSON-Import',
				text: 'Ziehen Sie eine Datei hinein: Der Import erkennt die Typen, legt die Tabelle an oder ergänzt eine bestehende und sagt Zeile für Zeile, was abgelehnt wurde.',
				href: '/guides/premiers-pas/',
			},
			accounts: {
				title: 'Konten und Einladungen',
				text: 'Jede Person legt ihr Konto und ihre Projekte an und lädt per Link ein, mit Lesen, Bearbeiten oder Verwalten; Anmeldung per Passwort, Google, Microsoft oder jedem OpenID-Connect-Anbieter.',
				href: '/hebergement/connexion/',
			},
			webhooks: {
				title: 'Webhooks',
				text: 'Jeder Schreibvorgang kann ein anderes System benachrichtigen: signierte Payloads, der Reihe nach zugestellt, bei Fehlern wiederholt.',
				href: '/integrations/webhooks/',
			},
			settings: {
				title: 'Persönliche Einstellungen',
				text: 'Ihre Sprache, Ihr Design, die Datumsreihenfolge, Ihre Benachrichtigungen, Ihre Sitzungen und Ihre Token – alles an einem Ort.',
				href: '/fonctionnalites/droits/#ihre-einstellungen',
			},
		},
	},
	selfHost: {
		label: 'Selbst gehostet',
		title: 'Ihre Daten bleiben {bei Ihnen.}',
		lead: 'basedb ist freie Software (AGPL-3.0): ein einziges Image, eine PostgreSQL-Datenbank, und das ist alles – kein vorgeschriebener Drittanbieterdienst, keine Telemetrie. Sichern Sie es mit <code>pg_dump</code>, lesen Sie es mit jedem PostgreSQL-Client.',
		services: {
			db: 'PostgreSQL 16, Ihre Daten',
			basedb: 'Die Oberfläche, die REST-API und der MCP-Server, auf einem einzigen Port',
			proxy: 'Caddy, automatisches HTTPS (optional)',
		},
		links: [
			{
				href: '/hebergement/docker/',
				label: 'Anleitung Docker Compose →',
			},
			{
				href: '/hebergement/variables/',
				label: 'Alle Variablen →',
			},
		],
		steps: [
			{
				title: 'basedb holen',
				code: 'git clone https://github.com/eodia/basedb.git\ncd basedb && cp .env.example .env',
			},
			{
				title: 'Zwei Geheimnisse in .env',
				code: 'POSTGRES_PASSWORD=ein-starkes-passwort\n# openssl rand -base64 32\nBASEDB_ENCRYPTION_KEY=…',
			},
			{
				title: 'Starten',
				code: 'docker compose up -d\n# dann http://localhost:3000 öffnen und Ihr Konto erstellen',
			},
		],
	},
	faq: {
		label: 'Häufige Fragen',
		title: 'Was man uns oft fragt.',
		text: 'Noch eine Frage? <a href="/guides/introduction/">Die Dokumentation</a> beantwortet sie bestimmt.',
		items: {
			difference: {
				q: 'Worin unterscheidet sich basedb von anderen kollaborativen Datenbanken?',
				a: 'Darin, wo die Daten liegen. Wo andere Ihre Zeilen in einem generischen Modell ablegen (nummerierte Spalten, JSON-Dokumente), legt basedb für jede Tabelle eine echte PostgreSQL-Tabelle an und für jedes Feld eine echte typisierte Spalte, mit lesbaren Namen. Ihre Daten bleiben auch ohne basedb nutzbar.',
			},
			sql: {
				q: 'Kann ich direkt per SQL in die Tabellen schreiben?',
				a: 'Ja. Die Constraints (Typen, Pflichtfelder, Einfachauswahlen, Fremdschlüssel) setzt PostgreSQL selbst durch, und ein Trigger schreibt sogar Änderungen per direktem SQL in den Verlauf, zusammen mit der Sitzung, die sie vorgenommen hat. Die SQL-Konsole der Oberfläche und psql lesen dieselben Tabellen; in der Oberfläche schreibt jede Person SQL mit ihren eigenen Berechtigungen, speichert ihre Abfragen und macht daraus, wenn sie die Datenbank verwaltet, echte PostgreSQL-Views.',
			},
			ai: {
				q: 'Was geht an einen KI-Anbieter?',
				a: 'Nichts, solange Sie keinen Anbieter eingerichtet haben. Danach gehen für Strukturentwürfe und den Copilot standardmäßig nur die Struktur und Ihr Satz hinaus; ob der Copilot Daten lesen darf, legt ein Kästchen fest, pro Unterhaltung. Eine bei der KI angefragte Datenbankvorlage sendet nur Ihren Satz. Ein KI-Feld sendet die Spalten, die seine Anweisung zitiert, nach ausdrücklicher Zustimmung.',
			},
			together: {
				q: 'Können mehrere Personen an derselben Tabelle arbeiten?',
				a: 'Ja. Die Schreibvorgänge der anderen erscheinen ohne Neuladen, mit ihrem Avatar an der Tabelle oder Zeile, die sie gerade ansehen. Man kommentiert eine Zeile, erwähnt jemanden mit @, die Glocke meldet es. Und Strg+Z macht nur Ihre eigenen Schreibvorgänge rückgängig: Es verweigert, statt zu überschreiben, was jemand anderes inzwischen geändert hat.',
			},
			languages: {
				q: 'In welchen Sprachen?',
				a: 'In zwanzig: Französisch, Englisch, Deutsch, Spanisch, Italienisch, brasilianisches Portugiesisch, Niederländisch, Polnisch, Tschechisch, Schwedisch, Dänisch, Norwegisch, Finnisch, Rumänisch, Ungarisch, Türkisch, Ukrainisch, Japanisch, vereinfachtes Chinesisch und Koreanisch. Die Oberfläche übernimmt die Sprache des Browsers, und jede Person ändert sie in ihren Einstellungen; diese Website und die Dokumentation gibt es in denselben Sprachen.',
			},
			agent: {
				q: 'Wie verbindet sich ein KI-Agent?',
				a: 'Über den MCP-Server, mit einem Integrationstoken, das auf eine Datenbank beschränkt und standardmäßig schreibgeschützt ist. Ein Agent liest, erstellt und bearbeitet Zeilen gemäß seinen Berechtigungen; er löscht nichts und ändert nicht die Struktur: Er schlägt sie vor, und ein Mensch genehmigt.',
			},
			postgres: {
				q: 'Welche PostgreSQL-Version brauche ich?',
				a: 'PostgreSQL 16 oder neuer, mit den Erweiterungen pg_trgm und unaccent (im offiziellen Image enthalten). Die mitgelieferte docker-compose-Datei startet ein PostgreSQL 16; Sie können DATABASE_URL auch auf Ihren eigenen Server zeigen lassen.',
			},
			production: {
				q: 'Ist es bereit für die Produktion?',
				a: 'basedb wird aktiv entwickelt: Kern, API, MCP-Server und Oberfläche funktionieren und sind durch mehr als tausend Tests abgedeckt, einige Funktionen kommen aber noch (siehe Roadmap). Probieren Sie es aus, und sichern Sie Ihre Datenbank wie jede PostgreSQL-Datenbank.',
			},
			license: {
				q: 'Unter welcher Lizenz?',
				a: 'AGPL-3.0-or-later. Sie dürfen es frei nutzen, ändern und hosten; wenn Sie eine geänderte Version als Dienst anbieten, legen Sie deren Quellcode offen.',
			},
		},
	},
	cta: {
		title: 'Ihre Daten verdienen {echte Tabellen.}',
		text: 'Installieren Sie basedb in wenigen Minuten, laden Sie Ihr Team ein und behalten Sie jede Zeile im Griff.',
		install: 'basedb installieren',
		github: 'Code auf GitHub ansehen',
	},
	changelog: {
		label: 'Neuigkeiten',
		title: 'Was sich in basedb geändert hat',
		intro: 'Jede einzelne Änderung steht im <a href="https://github.com/eodia/basedb/commits/main">Verlauf des Repositorys</a>. Was als Nächstes kommt: die <a href="/feuille-de-route/">Roadmap</a>.',
		entries: {
			languages: {
				date: '2026-09-27',
				title: 'Formatierter Text, Variablen, ein übersichtlicheres Kanban',
				tag: 'Neu',
				items: [
					'<strong>Formatierter Text</strong>: ein neuer Feldtyp, in einem visuellen Editor gestaltet – Überschriften, Listen, Zitate, Links –, beim Schreiben bereinigt und durch eine Constraint gegen direktes SQL abgesichert. <a href="/fonctionnalites/tables-et-champs/#formatierter-text-und-variablen">Formatierter Text und Variablen</a>',
					'<strong>Variablen</strong>: Ein Langtext zitiert eine Spalte seiner Zeile – <code>{{Ville}}</code> – und wird überall mit ihrem Wert gelesen: Raster, Zeilendetails, API, MCP-Server, freigegebene Ansichten, Automatisierungen. Die Spalte behält das Zitat, und das liest <code>psql</code>.',
					'<strong>Ein übersichtlicheres Kanban</strong>: luftigere Karten, ein Titelbild und eine Beschreibung, die Werte der Zeile zitiert – „Lieferung am {{Date}} für {{Client}}“. <a href="/fonctionnalites/vues/">Die Ansichten</a>',
					'<strong>Umbenennen in einem Zug</strong>: ein einziger Dialog für eine Datenbank, eine Tabelle oder ein Feld; die Bezeichnung ändert sich immer, und ein Administrator kann auch in der Datenbank umbenennen, gestützt auf eine Auswirkungsanalyse. <a href="/fonctionnalites/tables-et-champs/#die-struktur-ändern">Die Struktur ändern</a>',
					'<strong>Zwanzig Sprachen</strong>: die Oberfläche, diese Website und die Dokumentation auf Französisch, Englisch, Deutsch, Spanisch, Italienisch, Portugiesisch (Brasilien), Niederländisch, Polnisch, Tschechisch, Schwedisch, Dänisch, Norwegisch, Finnisch, Rumänisch, Ungarisch, Türkisch, Ukrainisch, Japanisch, vereinfachtem Chinesisch und Koreanisch. basedb übernimmt die Sprache des Browsers; <strong>Einstellungen › Darstellung › Sprache</strong> legt eine andere fest, die Ihnen von einem Rechner zum anderen folgt. Zahlen und Datumsangaben richten sich nach der Sprache. <a href="/fonctionnalites/droits/#ihre-einstellungen">Ihre Einstellungen</a>',
				],
			},
			flows: {
				date: '2026-09-27',
				title: 'Automatisierungen als Ablauf',
				tag: 'Neu',
				items: [
					'<strong>Ein Graph-Editor</strong>: der Auslöser, dann jeder Schritt als Karte; ein <strong>+</strong> auf einer Linie fügt genau dort einen Schritt ein. Eine einfache Automatisierung passt weiterhin auf zwei Karten. <a href="/fonctionnalites/automatisations/">Die Automatisierungen</a>',
					'<strong>Eine Zeile suchen</strong> – den Kunden einer Bestellung, die letzte unbezahlte Rechnung – und sie dann bearbeiten, zitieren oder mit einer angelegten Zeile verknüpfen.',
					'<strong>Bedingungen mit mehreren Zweigen</strong>: Der erste, dessen Bedingung erfüllt ist, wird genommen, „Sonst“, wenn keiner es ist; danach laufen die Zweige wieder zusammen.',
					'<strong>Die Daten wandern von Schritt zu Schritt</strong>: <code>{{e2.client}}</code> zitiert, was ein Schritt gefunden oder angelegt hat, <code>{{e3.reponse.numero}}</code>, was ein Webhook geantwortet hat; das Menü jedes Textes bietet nur an, was mit Sicherheit vorher stattgefunden hat.',
					'<strong>Jede Ausführung, Schritt für Schritt</strong>: Auf den Ablauf gelegt, zeichnet sie den genommenen Zweig nach und sagt für jeden Schritt, was er getan hat und wie lange es gedauert hat.',
					'<strong>Der Copilot für Automatisierungen</strong>: Beschreiben Sie, was die Datenbank von selbst tun soll, oder fragen Sie, warum eine Ausführung fehlgeschlagen ist; er schlägt eine ganze Automatisierung vor, die Sie mit einem Klick auf den Ablauf legen, prüfen und dann speichern – nichts wird ohne Sie gespeichert. <a href="/fonctionnalites/automatisations/#der-copilot">Der Copilot</a>',
					'<strong>KI fragen</strong> in einem Schritt, wie in einem KI-Feld: eine Anweisung, die die Zeile und die vorherigen Schritte zitiert, eine Antwort, gelesen als Text, Zahl, Ja oder Nein, Datum oder Auswahl aus einer Liste, die die folgenden Schritte schreiben oder versenden. <a href="/fonctionnalites/automatisations/#ki-fragen">KI fragen</a>',
				],
			},
			dashboards: {
				date: '2026-09-27',
				title: 'Dashboards: Fragen, Diagramme, Filter',
				tag: 'Neu',
				items: [
					'<strong>Fragen</strong>, per Maus gestellt – eine Tabelle, ihre Joins, Filter, Kennzahlen nach Tag, Woche, Monat oder Jahr – oder in <strong>SQL</strong> geschrieben, schreibgeschützt und mit Ihren eigenen Berechtigungen, Variablen inklusive. <a href="/fonctionnalites/tableaux-de-bord/">Die Dashboards</a>',
					'<strong>Fünfzehn Visualisierungen</strong>: Kennzahl, Trend gegenüber dem vorherigen Zeitraum, Fortschritt zu einem Ziel, Messanzeige, Säulen, Balken, Linie, Fläche, Kombiniert, Kreis, Trichter, Streudiagramm, Tabelle, Kreuztabelle, Landkarte Frankreichs oder der Welt.',
					'<strong>Mit einem Klick erkunden</strong>: Ein Punkt öffnet seine Zeilen, einen feineren Zeitraum, eine andere Aufschlüsselung.',
					'<strong>Dashboards im Raster</strong>: Karten, mit der Maus verschoben und in der Größe geändert, Reiter, Abschnittstitel, Texte, eingebettete Seiten.',
					'<strong>Gemeinsame Filter</strong> – Zeitraum, Kategorie, Text, Zahl, Datumsgruppierung –, die eine, mehrere oder alle Karten steuern, mit einem Standardwert.',
					'<strong>Diagramme nach Ihren Wünschen</strong>: Farbe und Name jeder Reihe und jedes Anteils, Ring, Halbkreis oder Rose, Stapelung mit Summen, geglättete oder gestufte Linien, Achsen, Teilstriche, logarithmische Skala; Tabellen mit umbenannten Spalten, mit Balken und Farben je nach Wert.',
					'<strong>Der Copilot für Dashboards</strong>: eine Unterhaltung, die Fragen vorschlägt, Änderungen am Dashboard – rückgängig zu machen – und Werte für seine Filter, mit einem Klick anzuwenden. Nur die Struktur geht an den Anbieter, es sei denn, Sie erlauben ihm, die Ergebnisse zu lesen. <a href="/fonctionnalites/tableaux-de-bord/#der-copilot">Der Copilot</a>',
					'<strong>Ein Dashboard freigeben</strong> per Link, öffentlich oder nur für Mitglieder – bei Bedarf nur für bestimmte Gruppen – und in eine andere Website einbetten: Karten und Filter schreibgeschützt, gelesen mit den Berechtigungen der Person, die es veröffentlicht hat. <a href="/fonctionnalites/tableaux-de-bord/#ein-dashboard-freigeben">Freigeben</a>',
					'„Interfaces“ heißen jetzt <strong>Dashboards</strong>; bestehende öffnen sich unverändert im neuen Raster.',
				],
			},
			sqlViews: {
				date: '2026-09-27',
				title: 'Gespeicherte Abfragen und SQL-Views',
				tag: 'Neu',
				items: [
					'<strong>SQL für alle</strong>: Ohne die Stufe Verwalten läuft ein SQL-Reiter schreibgeschützt, mit Ihren eigenen Berechtigungen, von PostgreSQL selbst durchgesetzt – eine verschlossene Tabelle existiert nicht, ein verborgenes Feld wird verweigert. Das Kennzeichen „Ihre Berechtigungen“ erinnert daran. <a href="/fonctionnalites/requetes-et-vues-sql/">Abfragen und SQL-Views</a>',
					'<strong>Gespeicherte Abfragen</strong>, unter den Tabellen in der Rubrik „Abfragen“ abgelegt: persönlich, für die ganze Datenbank oder für Gruppen. Wer eine Abfrage freigibt, gibt ihren Text frei, nie das, was ihr Autor lesen darf; aus der Seitenleiste geöffnet, läuft sie sofort, schreibgeschützt.',
					'<strong>SQL-Views</strong>: echte PostgreSQL-Views, zwischen den Tabellen einsortiert, mit Farbe, Symbol und einem kleinen Auge, auch aus <code>psql</code> und Ihren Tools lesbar. Jede Person liest sie mit ihren eigenen Berechtigungen, und die Seitenleiste zeigt sie nur denen, die alles darin lesen dürfen.',
					'Die Views folgen der Struktur: Eine Umbenennung macht sie nicht kaputt, eine geänderte Formel nimmt sie kurz heraus und setzt sie dann wieder ein; eine, die nicht mehr passt, bleibt zu korrigieren, ihre Definition bleibt erhalten.',
				],
			},
			aiProvider: {
				date: '2026-09-27',
				title: 'Die KI Ihrer Wahl, bis hin zu Ihrem eigenen Rechner',
				tag: 'Neu',
				items: [
					'<strong>Ein vierter KI-Anbieter</strong>: jeder Server, der die API von OpenAI spricht – Azure, ein Unternehmens-Gateway, ein Modell, das auf Ihrem eigenen Rechner läuft –, in der <code>.env</code> eingetragen. Das Log der Aufrufe zeigt, an wen die Daten gegangen sind. <a href="/fonctionnalites/ia/">Die KI in basedb</a>',
					'<strong>Der Anmeldebildschirm</strong> zeigt, nach dem Raster und SQL, jetzt auch ein Dashboard, das einem Filter folgt, und eine Automatisierung, die abläuft, KI-Schritt eingeschlossen.',
				],
			},
			settings: {
				date: '2026-09-27',
				title: 'Ihre Einstellungen',
				tag: 'Neu',
				items: [
					'<strong>Einstellungen</strong> im Profilmenü: Ihr Name, Ihre Adresse und die mit Ihrem Konto verbundenen Identitätsanbieter; Ihr Passwort und Ihre offenen Sitzungen. <a href="/fonctionnalites/droits/">Konten und Anmeldung</a>',
					'<strong>Darstellung</strong>: das Design, die Datumsreihenfolge – <code>25/09/2026</code> oder <code>2026-09-25</code> – und der erste Wochentag der Kalender; die beiden Letzteren folgen Ihnen von einem Rechner zum anderen.',
					'<strong>Benachrichtigungen</strong>: Schalten Sie die ab, die Sie nicht mehr möchten, Art für Art. <strong>Token</strong>: die, die Sie angelegt haben, über all Ihre Datenbanken hinweg, ihre letzte Verwendung und ihr Widerruf.',
				],
			},
			v020: {
				date: '2026-09-26',
				title: 'Version 0.2.0: eigenes Konto, eigene Projekte, eigene Einladungen',
				tag: 'Neu',
				items: [
					'<strong>Erste Anmeldung</strong>: Auf einer neuen Instanz legt die erste Seite das Administratorkonto an, mit Ihrer Adresse und Ihrem Passwort – kein Standardkonto mehr und kein Passwort, das man in den Logs suchen muss. <a href="/guides/installation/">Die Installation</a>',
					'<strong>Kontoerstellung</strong>: Jede Person legt ihr Konto an, dann ihre eigenen Projekte, die sie verwaltet. Die Administration kann sie schließen oder auf Domains beschränken. <a href="/hebergement/connexion/">Konten und Anmeldung</a>',
					'<strong>Ein Projekt oder eine Datenbank freigeben</strong>: Wer die Stufe Verwalten hat, lädt per Link ein, mit Lesen, Bearbeiten oder Verwalten; sieht, wer Zugriff hat, ändert eine Stufe, entzieht sie. Nie mehr, als man selbst verwaltet.',
					'<strong>Privatsphäre</strong>: Jede Person sieht nur noch die Personen, mit denen sie ein Projekt teilt, und ein Projektname, den schon jemand anderes vergeben hat, lässt sich nicht mehr erraten.',
					'<strong>Anmeldung mit Google, Microsoft</strong> und jedem OpenID-Connect-Anbieter (Keycloak, GitLab …), in der <code>.env</code> eingerichtet; eine erste Anmeldung legt das Konto an, wenn die Kontoerstellung es erlaubt. <a href="/hebergement/connexion/">Einrichten</a>',
					'<strong>Neuer Anmeldebildschirm</strong>, im Design der Anwendung, hell oder dunkel, und dezent animiert; illustrierte leere Zustände in der Anwendung.',
					'<strong>Updates ohne Verlust</strong>: basedb aktualisiert seinen Katalog beim Start selbst, eine 0.1-Installation eingeschlossen, und verweigert den Start auf einer Datenbank, die eine neuere Version bereits aktualisiert hat. <a href="/hebergement/sauvegardes/">Aktualisieren</a>',
				],
			},
			dockerImage: {
				date: '2026-09-26',
				title: 'Ein einziges Docker-Image',
				tag: 'Hosting',
				items: [
					'basedb passt in <strong>ein einziges Image</strong>, <code>eodia/basedb</code> auf Docker Hub, für amd64 und arm64: die Oberfläche, die API unter <code>/api</code> und der MCP-Server unter <code>/mcp</code>, auf <strong>einem einzigen Port</strong>. <a href="/guides/installation/">Die Installation</a>',
					'Zwei Dateien genügen – <code>docker-compose.yml</code> und <code>.env</code> –, ohne das Repository zu klonen oder etwas zu bauen; aktualisiert wird mit <code>docker compose pull</code>.',
					'Hinter einer Domain muss der HTTPS-Proxy nichts mehr routen: Alles geht an Port 3000.',
				],
			},
			automations: {
				date: '2026-09-26',
				title: 'Automatisierungen, Interfaces, Formeln, Zusammenarbeit',
				tag: 'Neu',
				items: [
					'<strong>Formeln</strong> auf Französisch – <code>SI</code>, <code>ARRONDI</code>, <code>JOURS</code> … – als von PostgreSQL generierte Spalten; <strong>Nachschlagefelder</strong>, <strong>Aggregationen</strong> und <strong>Anzahlen</strong> über Verknüpfungen hinweg. <a href="/fonctionnalites/tables-et-champs/">Die Felder</a>',
					'<strong>Neue Typen</strong>: Mehrfachverknüpfung, Person, E-Mail, Autonummer, Schaltfläche; und Formate, die wie Typen gewählt werden – Währung, Prozent, Dauer, Sternebewertung, Telefon, Barcode.',
					'<strong>Acht Ansichten</strong>: <strong>Galerie</strong> und <strong>Liste</strong> kommen zu den sechs anderen hinzu; <strong>persönliche Ansichten</strong> für alle Lesenden, gesperrte Ansichten, manuelle Sortierung, Abhängigkeiten in der Zeitachse. <a href="/fonctionnalites/vues/">Die Ansichten</a>',
					'<strong>Das Raster</strong>: Schnellsuche, Gruppierung, Zusammenfassung pro Spalte über den ganzen Filter, Farben nach Regeln, Zeilenhöhe.',
					'<strong>Freigegebene Ansichten</strong>, schreibgeschützt, in eine andere Website einbettbar; ein Kalender wird zum <strong>iCalendar-Feed</strong> für Google Kalender, Outlook oder Apple Kalender. <a href="/fonctionnalites/vues-partagees/">Die Freigabe</a>',
					'<strong>Zusammenarbeit</strong>: Kommentare und Erwähnungen, Benachrichtigungen, Schreibvorgänge der anderen in Echtzeit, Präsenz auf der Tabelle und auf der Zeile. <a href="/fonctionnalites/collaboration/">Gemeinsam arbeiten</a>',
					'<strong>Strg+Z</strong> macht den letzten Schreibvorgang rückgängig – eine Zelle, eine verschobene Karte, einen ganzen Import – und verweigert, statt zu überschreiben, was jemand anderes inzwischen geändert hat.',
					'<strong>Automatisierungen</strong>: wenn eine Zeile angelegt oder geändert wird, zu fester Uhrzeit oder per Klick auf eine Schaltfläche – bearbeiten, anlegen, benachrichtigen, einen Webhook aufrufen, in Slack schreiben. <a href="/fonctionnalites/automatisations/">Automatisieren</a>',
					'<strong>Interfaces</strong>: Dashboards – Kennzahlen, Diagramme, Listen, Texte –, gelesen mit den Berechtigungen jeder Person. <a href="/fonctionnalites/tableaux-de-bord/">Die Dashboards</a>',
					'<strong>Integrationen</strong>: ein Slack-Kanal und <strong>synchronisierte Tabellen</strong> aus einer Online-CSV, einem Kalender oder der Ansicht eines anderen basedb. <a href="/integrations/synchronisation/">Die Integrationen</a>',
					'<strong>Datenbankvorlagen</strong>: eine Galerie mit zehn Vorlagen, eine Datenbank, der KI in einem Satz beschrieben, und jede Datenbank als Vorlage speicherbar. <a href="/modeles/">Die Galerie</a>',
					'<strong>Berechtigungen</strong>: Der Bildschirm Struktur wird für alle ohne die Stufe Verwalten zur reinen Ansicht.',
					'<strong>Neue Identität</strong>: ein Logo, eine Farbpalette und ein neu gestalteter Anmeldebildschirm.',
				],
			},
			simpler: {
				date: '2026-09-26',
				title: 'Eine einfachere Oberfläche',
				items: [
					'<strong>Die Seitenleiste</strong> listet nur noch die Datenbanken und ihre Tabellen; die Bildschirme der geöffneten Datenbank – Struktur, Verlauf, Interfaces, Automatisierungen – sind in einem Block vereint, direkt über dem Profil.',
					'<strong>Das Profilmenü</strong> nimmt auf, was keine Daten sind: die API- und MCP-Dokumentation, die Integrationen, die Benutzer und die Berechtigungen.',
					'<strong>Eine SQL-Abfrage</strong> öffnet sich über das „+“ der Reiterleiste oder das Menü der Datenbank, ohne Doppelung in der Seitenleiste.',
					'<strong>Neue Datenbank</strong> bietet die Vorlagen und die KI direkt im Dialog an; die Demo-Datenbank läuft über dieselbe Galerie.',
					'<strong>Der Bildschirm bietet nicht mehr an, was abgelehnt würde</strong>: keine Strukturschaltflächen ohne Verwalten, kein „Löschen“ ohne Löschrecht; und wer nur liest, legt eigene Ansichten an, statt an einer Meldung zu scheitern.',
					'<strong>Die Systemspalten</strong> sind unter „Systeminformationen“ zusammengefasst, statt auf jeder Tabelle angeboten zu werden.',
					'<strong>Die Zeilendetails</strong> bekommen ihre Kommentare, eine Schaltfläche zum Schreiben oder Anrufen und eine Bewertung, die sich mit einem Klick setzen lässt.',
					'<strong>Die Anmeldung</strong> verzichtet auf ihren animierten 3D-Hintergrund zugunsten eines leichten Bildschirms, der die Einstellung „Bewegung reduzieren“ respektiert.',
				],
			},
			environments: {
				date: '2026-09-26',
				title: 'Umgebungen, freigegebene Formulare, Ansichten',
				items: [
					'<strong>Umgebungen</strong>: Produktion, Staging, Entwicklung für dieselbe Datenbank; Vergleich nebeneinander, Migrationsplan, Synchronisierung der Zeilen.',
					'<strong>Strukturverlauf</strong>: jedes Anlegen oder Ändern einer Tabelle oder eines Felds, per Trigger auf dem Katalog erfasst.',
					'<strong>Freigegebene Formulare</strong>: ein öffentlicher Link oder einer nur für Mitglieder, Schließen nach Datum oder nach Anzahl der Antworten, Zuordnung der Antworten im Verlauf.',
					'<strong>Sechs Ansichten</strong>: Raster, Kanban, Kalender, Zeitachse, Formular, Umfrage.',
					'<strong>Datenverlauf</strong>: eine Änderung rückgängig machen, eine gelöschte Zeile wiederherstellen.',
					'<strong>KI</strong>: die KI-Option auf jedem Feld und der Copilot.',
					'<strong>Verknüpfung</strong> und <strong>URL</strong>: zwei getrennte Typen; Langtext wird in Markdown geschrieben.',
					'<strong>Webhooks</strong>, signiert und geordnet, <strong>Vorschläge von Agenten</strong> zur Genehmigung.',
					'<strong>Docker</strong>: ein Dockerfile mit drei Zielen, eine vollständige docker-compose-Datei, ein optionaler HTTPS-Proxy.',
				],
			},
			projects: {
				date: '2026-09-25',
				title: 'Projekte, Berechtigungen, MCP-Server',
				items: [
					'<strong>Projekte</strong> oberhalb der Datenbanken und Berechtigungen nach <strong>Gruppen</strong> auf vier Stufen: Kein Zugriff, Lesen, Bearbeiten, Verwalten.',
					'<strong>Konten</strong>: temporäres Passwort, Änderung bei der ersten Anmeldung, erhöhte Sitzung für die Administration.',
					'<strong>MCP-Server</strong> und stdio-Relay; <strong>Integrationstoken</strong>, gemeinsam für REST-API und MCP.',
					'<strong>Generierte Dokumentation</strong> „API und MCP“ für jede Datenbank.',
				],
			},
			fields: {
				date: '2026-09-20',
				title: 'Felder, Einfachauswahlen, Import',
				items: [
					'Ein Feld und die Optionen einer Einfachauswahl bearbeiten.',
					'<strong>Import</strong> von CSV- und JSON-Dateien.',
					'Das Menü einer Tabelle: umbenennen, beschreiben, löschen.',
				],
			},
			firstCommit: {
				date: '2026-09-20',
				title: 'Erster Commit',
				items: [
					'Das Monorepo: Benennung, Register der Fehlercodes, aus dem Architekturdokument extrahierter Katalog, Kern, API, Oberfläche.',
				],
			},
		},
	},
	roadmap: {
		label: 'Roadmap',
		title: 'Was als Nächstes kommt',
		intro: 'basedb wird aktiv entwickelt. Diese Seite nennt, was noch fehlt, ohne versprochene Termine. Eine Idee, ein Bedarf? <a href="https://github.com/eodia/basedb/issues">Eröffnen Sie ein Issue</a>. Was schon da ist: die <a href="/nouveautes/">Neuigkeiten</a>.',
		columns: {
			next: {
				title: 'Demnächst',
				items: {
					restoreTable: {
						title: 'Eine einzelne Tabelle wiederherstellen',
						text: 'Eine gelöschte Tabelle bleibt unter ihrem ausgelagerten Namen per SQL lesbar; sie einzeln aus der Oberfläche zurückzuholen, kommt noch.',
					},
					aiSettings: {
						title: 'KI-Einstellungen in der Oberfläche',
						text: 'Anbieter, Modell und Schlüssel pro Arbeitsbereich, ohne Umweg über die Umgebung der API.',
					},
					mail: {
						title: 'Benachrichtigungen und Einladungen per E-Mail',
						text: 'Erwähnungen, Antworten und Zuweisungen kommen heute in basedb an, Einladungen als Link, den Sie selbst verschicken; künftig können sie auch per E-Mail hinausgehen.',
					},
				},
			},
			later: {
				title: 'Danach',
				items: {
					formLinks: {
						title: 'Verknüpfungen und Dateien in freigegebenen Formularen',
						text: 'Eine eingeschränkte Suche in der verknüpften Tabelle, ein begrenzter Datei-Upload für Unbekannte.',
					},
					moreEvents: {
						title: 'Mehr Ereignisse mit Benachrichtigung',
						text: 'Benachrichtigt werden bei einer Formularantwort, einem Vorschlag eines Agenten, einem deaktivierten Webhook.',
					},
					sqlViewsAcross: {
						title: 'SQL-Views von einer Umgebung zur anderen',
						text: 'SQL-Views mit der Struktur übernehmen, wenn Umgebungen angelegt oder verglichen werden, und in Datenbankvorlagen.',
					},
					loops: {
						title: 'Schleifen und Wartezeiten in Automatisierungen',
						text: 'Schritte für jede gefundene Zeile wiederholen, vor dem nächsten warten („drei Tage danach“) und Abläufe in Datenbankvorlagen mitnehmen.',
					},
					textFormulas: {
						title: 'Formeln für Text',
						text: 'Einen Teil eines Textes extrahieren, ersetzen oder kürzen.',
					},
					bulk: {
						title: 'Deklarierte Massenoperationen',
						text: 'Änderungen an Tausenden von Zeilen, im Verlauf als eine einzige Operation festgehalten.',
					},
					tombstones: {
						title: 'Bereinigung der Tombstones',
						text: 'Das Aufräumen von Löschspuren, die nicht mehr gebraucht werden.',
					},
				},
			},
		},
	},
	gallery: {
		label: 'Vorlagen',
		title: 'Eine Datenbank, in Sekunden bereit',
		intro: 'Jede Vorlage legt miteinander verknüpfte Tabellen an, Beispielzeilen, Ansichten, ein Dashboard, Automatisierungen – und Felder, die die KI selbst ausfüllt. In basedb: <strong>Neue Datenbank</strong>, dann <strong>Von einer Vorlage ausgehen</strong>. Nichts passt? Beschreiben Sie Ihren Bedarf in einem Satz: Die KI schlägt Ihnen eine maßgeschneiderte Datenbank vor.',
		filter: 'Nach Kategorie filtern',
		all: 'Alle',
		otherCategory: 'Sonstige',
		ai: '✦ KI',
		tables: {
			one: '{n} Tabelle',
			other: '{n} Tabellen',
		},
		rows: {
			one: '{n} Zeile',
			other: '{n} Zeilen',
		},
		views: {
			one: '{n} Ansicht',
			other: '{n} Ansichten',
		},
		howtoTitle: 'Vorlagen in JSON beschreiben',
		howto: 'Eine Vorlage ist eine JSON-Datei: ihre Tabellen, Felder, Verknüpfungen, Zeilen, Ansichten, Dashboards, Automatisierungen und die Anweisungen ihrer KI-Felder. Die Vorlagen auf dieser Seite sind die Dateien im Ordner <a href="https://github.com/eodia/basedb/tree/main/packages/templates/catalog"><code>packages/templates/catalog</code></a> des Repositorys; jede basedb-Instanz liest <a href="/modeles/catalogue.json"><code>catalogue.json</code></a> und bietet sie ihren Benutzern an. Ein Administrator kann auch eigene Vorlagen in seine Instanz importieren, und jede Datenbank lässt sich als Vorlage speichern.',
		format: {
			href: '/fonctionnalites/modeles/',
			label: 'Das Vorlagenformat →',
		},
		back: '← Alle Vorlagen',
		defaultCategory: 'Vorlage',
		sampleRows: {
			one: '{n} Beispielzeile',
			other: '{n} Beispielzeilen',
		},
		aiTitle: 'Was die KI berechnet',
		useTitle: 'Diese Vorlage verwenden',
		useSteps: [
			'In basedb auf <strong>Neue Datenbank</strong> klicken.',
			'<strong>Von einer Vorlage ausgehen</strong>, dann „{label}“ wählen.',
		],
		create: '<strong>Datenbank erstellen</strong>.',
		createWithAi: '<strong>Datenbank erstellen</strong> – und, wenn Sie möchten, zustimmen, dass die KI-Felder von Ihrem KI-Anbieter berechnet werden.',
		download: 'JSON herunterladen',
		downloadNote: 'Um die Datei in Ihre Instanz zu importieren oder sie anzupassen, bevor Sie sie für den Katalog vorschlagen.',
		viewMeta: '– {kind}, {table}',
		dashboard: '<strong>Dashboard</strong> „{label}“ – {blocks}',
		blocks: {
			one: '{n} Block',
			other: '{n} Blöcke',
		},
		automation: '<strong>Automatisierung</strong> „{label}“',
		yes: 'Ja',
		no: 'Nein',
		me: 'Sie',
		kinds: {
			short_text: 'Kurztext',
			long_text: 'Langtext',
			rich_text: 'Formatierter Text',
			number: 'Zahl',
			boolean: 'Kontrollkästchen',
			date: 'Datum',
			datetime: 'Datum und Uhrzeit',
			select: 'Einfachauswahl',
			multi_select: 'Mehrfachauswahl',
			url: 'URL',
			email: 'E-Mail',
			user: 'Person',
			autonumber: 'Autonummer',
			formula: 'Formel',
			lookup: 'Nachschlagen',
			rollup: 'Aggregation',
			count: 'Anzahl',
			button: 'Schaltfläche',
			link: 'Verknüpfung',
			multi_link: 'Mehrfachverknüpfung',
		},
		viewKinds: {
			grid: 'Raster',
			kanban: 'Kanban',
			calendar: 'Kalender',
			timeline: 'Zeitachse',
			gallery: 'Galerie',
			list: 'Liste',
			form: 'Formular',
		},
	},
	templates: {
		demo: {
			label: 'Demo: Atelier Lumen',
			summary: 'Eine kleine Agentur, ihre Kunden, Projekte, Aufgaben, Rechnungen und Bewertungen: alle Facetten von basedb in einer einzigen Datenbank.',
			description: 'Die Demo-Datenbank. Atelier Lumen ist eine fiktive Designagentur. Ihre Datenbank zeigt die Verknüpfungen zwischen Tabellen, Nachschlagefelder und Aggregationen (Umsatz pro Kunde, Durchschnittsbewertung), Formeln (Bruttobetrag, Verzug), drei von der KI berechnete Felder zu den Kundenbewertungen (Stimmung, Thema, Antwortvorschlag), jede Art von Ansicht – Raster, Kanban, Kalender, Zeitachse mit Abhängigkeiten, Galerie, Liste, Formular –, ein Dashboard und zwei Automatisierungen.',
			category: 'Demo',
			tags: ['KI', 'Verknüpfungen', 'Alle Ansichten', 'Dashboard'],
		},
		'analyse-avis': {
			label: 'Analyse von Kundenbewertungen',
			summary: 'Sammeln Sie Bewertungen und lassen Sie die KI daraus Stimmung, Themen, Dringlichkeit und einen Antwortentwurf ableiten.',
			description: 'Für ein Geschäft, ein Restaurant oder eine Marke: Die Bewertungen kommen über ein öffentliches Formular oder einen Import herein, und die KI liest jede einzelne. Sie ordnet die Stimmung ein, erkennt das Hauptthema, markiert die, die eine schnelle Antwort brauchen, extrahiert den Vorschlag des Kunden und verfasst eine Antwort zum Gegenlesen. Die Produkte aggregieren ihre Durchschnittsbewertung und die Zahl ihrer Bewertungen; ein Dashboard verfolgt die Zufriedenheit.',
			category: 'Kundenbeziehung',
			tags: ['KI', 'Formular', 'Dashboard'],
		},
		'base-connaissances': {
			label: 'Wissensdatenbank',
			summary: 'Hilfeartikel und Kundenfragen: Die KI fasst zusammen, ordnet ein und schlägt anhand der Artikel eine Antwort vor.',
			description: 'Für ein Support-Team. Die Hilfeartikel sind nach Kategorie geordnet und werden über die Zeit verfolgt; die Fragen der Kunden kommen über ein öffentliches Formular herein. Die KI fasst jeden Artikel zusammen und schätzt sein Niveau ein, ordnet jede Frage ein und verfasst einen Antwortentwurf zum Gegenlesen.',
			category: 'Support',
			tags: ['KI', 'Formular', 'Liste'],
		},
		'calendrier-editorial': {
			label: 'Redaktionskalender',
			summary: 'Artikel, Posts und Newsletter, auf einem Kalender geplant; die KI schlägt Aufhänger und Schlüsselwörter vor.',
			description: 'Für ein Marketingteam oder eine Redaktion. Jeder Inhalt durchläuft den Weg von der Idee bis zur Veröffentlichung, hat seinen Platz im Erscheinungskalender und gehört zu einer Kampagne. Die KI schlägt aus dem Briefing einen Aufhänger und Schlüsselwörter vor, und über ein Formular kann das ganze Unternehmen ein Thema vorschlagen.',
			category: 'Marketing',
			tags: ['KI', 'Kalender', 'Kanban', 'Formular'],
		},
		crm: {
			label: 'Vertriebs-CRM',
			summary: 'Unternehmen, Kontakte und Verkaufschancen: eine Vertriebspipeline, der Austausch und die KI, die den nächsten Schritt empfiehlt.',
			description: 'Ein schlankes CRM für ein Vertriebsteam. Die Verkaufschancen durchlaufen eine Pipeline und tragen einen nach ihrer Wahrscheinlichkeit gewichteten Betrag; die KI schätzt ihr Risiko ein und empfiehlt anhand der Notizen die nächste Aktion. Der Austausch mit den Kunden wird festgehalten und zusammengefasst, die Unternehmen aggregieren, was sie ausmachen.',
			category: 'Vertrieb',
			tags: ['KI', 'Pipeline', 'Kanban', 'Kalender'],
		},
		evenements: {
			label: 'Veranstaltungen und Anmeldungen',
			summary: 'Konferenzen, Workshops und Webinare: Anmeldungen, verbleibende Plätze und die Rückmeldungen der Teilnehmenden, von der KI ausgewertet.',
			description: 'Um wiederkehrende Veranstaltungen zu organisieren. Jede Veranstaltung zählt ihre Angemeldeten und ihre freien Plätze; die Anmeldungen laufen bis zur Teilnahme. Nach der Veranstaltung geben die Teilnehmenden eine Rückmeldung, die die KI nach Stimmung einordnet und zusammenfasst. Über ein öffentliches Formular kann man sich in den Verteiler eintragen.',
			category: 'Veranstaltungen',
			tags: ['KI', 'Kalender', 'Formular', 'Aggregationen'],
		},
		'gestion-projet': {
			label: 'Projektmanagement',
			summary: 'Projekte, Aufgaben und Meilensteine: eine Roadmap, Abhängigkeiten zwischen Aufgaben, ein Kanban und ein Kalender.',
			description: 'Um mehrere Projekte parallel zu steuern. Jedes Projekt aggregiert seine Aufgaben und Stunden; die Aufgaben werden im Kanban verfolgt und auf einer Zeitachse geplant, die ihre Abhängigkeiten zeichnet, und die Meilensteine stehen in einem Kalender. Die KI verfasst aus Beschreibung und Fortschritt einen Statusbericht des Projekts für die Geschäftsleitung.',
			category: 'Organisation',
			tags: ['Zeitachse', 'Abhängigkeiten', 'Kanban', 'KI'],
		},
		inventaire: {
			label: 'Inventar und Lagerbestand',
			summary: 'Artikel, Lieferanten und Warenbewegungen: Der Bestand berechnet sich von selbst, Engpässe sind im Voraus sichtbar.',
			description: 'Für eine Werkstatt, einen Laden oder das Facility-Management.Jeder Zu- oder Abgang ist eine Bewegung; der Bestand jedes Artikels ist ihre Summe, sein Wert eine Formel, und Artikel unter ihrem Mindestbestand erscheinen in der Ansicht „À commander“ (zu bestellen). Die KI verfasst die Beschreibung jedes Artikels aus seinem Namen und seiner Kategorie.',
			category: 'Betrieb',
			tags: ['Aggregationen', 'Formeln', 'Galerie', 'KI'],
		},
		recrutement: {
			label: 'Recruiting',
			summary: 'Offene Stellen, Bewerbende und Vorstellungsgespräche; die KI fasst jede Bewerbung zusammen und schlägt Punkte zum Nachhaken vor.',
			description: 'Ein Recruiting-Tracker, von der Bewerbung bis zur Einstellung. Bewerbende bewerben sich über ein öffentliches Formular, kommen im Kanban Schritt für Schritt voran, und die Gespräche werden in einem Kalender geplant. Die KI liest Anschreiben und Notizen: eine Zusammenfassung und die Fragen, die im Gespräch zu stellen sind. Sie hilft beim Lesen, sie entscheidet nicht.',
			category: 'Personalwesen',
			tags: ['KI', 'Formular', 'Kanban', 'Kalender'],
		},
		'suivi-tickets': {
			label: 'Ticketverfolgung',
			summary: 'Bugs und Anfragen, von der KI sortiert und pro Sprint bis zur Lösung verfolgt, mit einem Meldeformular.',
			description: 'Ein Ticketsystem für ein Produktteam. Jedes Ticket gehört zu einer Komponente und einem Sprint; die KI schlägt eine Kategorie vor, schätzt den Schweregrad ein und fasst die Meldung zusammen. Ein Kanban verfolgt den Fortschritt, eine Zeitachse zeigt die Sprints, über ein Formular kann jede Person ein Problem melden, und eine Automatisierung hält das Datum der Lösung fest.',
			category: 'Produkt und Technik',
			tags: ['KI', 'Kanban', 'Formular', 'Sprints'],
		},
	},
} satisfies DeepPartial<Dict>;
