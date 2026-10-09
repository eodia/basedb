/**
 * The Polish texts of the landing pages, laid over the French ones (`fr.ts`).
 *
 * See `../README.md`.
 */
import type { DeepPartial, Dict } from './index';

export default {
	meta: {
		home: {
			title: 'basedb – baza do współpracy, w której każda tabela jest prawdziwą tabelą PostgreSQL',
			description: 'Siatki i dziesięć widoków, formuły, udostępniane formularze, quizy i widoki, komentarze, automatyzacje, pulpity, uprawnienia aż do pola, pełna historia, API REST i serwer MCP – na prawdziwych tabelach PostgreSQL o czytelnych nazwach. Samodzielnie hostowany, AGPL-3.0.',
		},
		changelog: {
			title: 'Nowości – basedb',
			description: 'Co zmieniło się w basedb, wersja po wersji.',
		},
		roadmap: {
			title: 'Plan rozwoju – basedb',
			description: 'Co dalej w basedb.',
		},
		gallery: {
			title: 'Szablony – basedb',
			description: 'Gotowe do użycia bazy: obsługa zgłoszeń, analiza opinii, CRM, rekrutacja… z przykładowymi wierszami, widokami, pulpitami i polami obliczanymi przez AI.',
		},
		template: {
			title: '{label} – szablony basedb',
		},
	},
	eodia: {
		home: 'https://eodia.com/',
		about: 'https://eodia.com/about/',
		contact: 'https://eodia.com/contact/',
	},
	demo: {
		short: 'Demo',
		cta: 'Wypróbuj demo',
	},
	nav: {
		aria: 'Nawigacja główna',
		home: 'basedb – strona główna',
		links: [
			{
				href: '/#fonctionnalites',
				label: 'Funkcje',
			},
			{
				href: '/modeles/',
				label: 'Szablony',
			},
			{
				href: '/guides/introduction/',
				label: 'Dokumentacja',
			},
			{
				href: '/nouveautes/',
				label: 'Nowości',
			},
		],
		developers: 'Programiści',
		github: 'Repozytorium basedb na GitHubie',
		install: 'Zainstaluj',
		menu: {
			open: 'Otwórz menu',
			close: 'Zamknij menu',
			features: {
				label: 'Funkcje',
				groups: {
					organize: {
						title: 'Organizacja',
						items: {
							tables: {
								href: '/fonctionnalites/tables-et-champs/',
								title: 'Tabele i pola',
								text: 'Pola na wszystko, relacje, formuły jak w arkuszu kalkulacyjnym.',
							},
							views: {
								href: '/fonctionnalites/vues/',
								title: 'Dziesięć widoków',
								text: 'Siatka, kanban, kalendarz, oś czasu, galeria, lista, mapa, formularz, ankieta, quiz.',
							},
							forms: {
								href: '/fonctionnalites/formulaires-partages/',
								title: 'Formularze',
								text: 'Link do udostępnienia: każda odpowiedź staje się wierszem.',
							},
							files: {
								href: '/fonctionnalites/fichiers/',
								title: 'Pliki i obrazy',
								text: 'Oferty, zdjęcia, umowy – przechowywane razem z wierszem.',
							},
						},
					},
					collaborate: {
						title: 'Współpraca',
						items: {
							live: {
								href: '/fonctionnalites/collaboration/',
								title: 'Czas rzeczywisty i komentarze',
								text: 'Widzisz, jak pracują inni, komentujesz wiersz, wzmiankujesz kolegę.',
							},
							rights: {
								href: '/fonctionnalites/droits/',
								title: 'Uprawnienia i zespoły',
								text: 'Kto widzi co i kto co zmienia, aż do pojedynczej kolumny.',
							},
							history: {
								href: '/fonctionnalites/historique/',
								title: 'Historia',
								text: 'Każda zmiana zapisana i możliwa do wycofania.',
							},
							shared: {
								href: '/fonctionnalites/vues-partagees/',
								title: 'Widoki udostępnione',
								text: 'Widok przez link, na twojej stronie albo w twoim kalendarzu.',
							},
						},
					},
					automate: {
						title: 'Automatyzacja i analiza',
						items: {
							automations: {
								href: '/fonctionnalites/automatisations/',
								title: 'Automatyzacje',
								text: 'Gdy wiersz się zmienia: powiadom, utwórz, zapisz, zapytaj AI.',
							},
							dashboards: {
								href: '/fonctionnalites/tableaux-de-bord/',
								title: 'Pulpity',
								text: 'Piętnaście wizualizacji, wspólne filtry, link do udostępnienia.',
							},
							ai: {
								href: '/fonctionnalites/ia/',
								title: 'AI i Copilot',
								text: 'Baza w jednym zdaniu, pola, które wypełniają się same.',
							},
							templates: {
								href: '/modeles/',
								title: 'Szablony',
								text: 'Dziesięć gotowych baz do adaptacji.',
							},
						},
					},
				},
				feature: {
					tag: 'Nowość',
					title: 'Automatyzacje jako przepływy',
					text: 'Szukaj, decyduj, pytaj AI: edytor w formie grafu, a każde uruchomienie można odtworzyć krok po kroku.',
					href: '/nouveautes/',
					cta: 'Wszystkie nowości',
				},
				all: 'Wszystkie funkcje',
			},
			solutions: {
				label: 'Rozwiązania',
				title: 'Dla każdego zespołu',
				items: {
					crm: {
						team: 'Sprzedaż',
						text: 'Lejek sprzedaży, kontakty, przypomnienia.',
					},
					recrutement: {
						team: 'Zasoby ludzkie',
						text: 'Aplikacje, rozmowy, podsumowania od AI.',
					},
					'calendrier-editorial': {
						team: 'Marketing',
						text: 'Artykuły, posty i newslettery zaplanowane w kalendarzu.',
					},
					inventaire: {
						team: 'Operacje',
						text: 'Stan liczy się sam, a braki widać z wyprzedzeniem.',
					},
					'gestion-projet': {
						team: 'Projekty',
						text: 'Kamienie milowe, zadania i zależności.',
					},
					'suivi-tickets': {
						team: 'Produkt',
						text: 'Błędy i prośby sortowane przez AI.',
					},
					'base-connaissances': {
						team: 'Wsparcie',
						text: 'Artykuły pomocy, pytania, proponowane odpowiedzi.',
					},
					evenements: {
						team: 'Wydarzenia',
						text: 'Zapisy, miejsca, opinie.',
					},
					'analyse-avis': {
						team: 'Relacje z klientami',
						text: 'Opinie czytane i klasyfikowane przez AI.',
					},
				},
				ask: {
					title: 'Masz coś innego na myśli?',
					text: 'Opisz swoją potrzebę jednym zdaniem: AI zaproponuje bazę na miarę.',
					href: '/modeles/',
				},
				all: 'Wszystkie szablony',
			},
			developers: {
				label: 'Programiści',
				groups: {
					build: {
						title: 'Integracja',
						items: {
							api: {
								href: '/integrations/api-rest/',
								title: 'API REST',
								text: 'Te same dane co w interfejsie, opisane w OpenAPI 3.1.',
							},
							mcp: {
								href: '/integrations/mcp/',
								title: 'Serwer MCP',
								text: 'Narzędzia dla twoich agentów AI, w ramach twoich uprawnień.',
							},
							webhooks: {
								href: '/integrations/webhooks/',
								title: 'Webhooki',
								text: 'Każdy zapis: podpisany, w kolejności, ponawiany.',
							},
							sql: {
								href: '/integrations/sql/',
								title: 'Bezpośredni SQL',
								text: 'Prawdziwe tabele PostgreSQL, o czytelnych nazwach.',
							},
							sync: {
								href: '/integrations/synchronisation/',
								title: 'Synchronizacja',
								text: 'Tabele aktualizowane automatycznie z innych źródeł.',
							},
						},
					},
					host: {
						title: 'Hostowanie',
						items: {
							docker: {
								href: '/hebergement/docker/',
								title: 'Docker Compose',
								text: 'Jeden obraz, jedna baza PostgreSQL, jeden port.',
							},
							env: {
								href: '/hebergement/variables/',
								title: 'Zmienne',
								text: 'Wszystko ustawia się w pliku .env.',
							},
							https: {
								href: '/hebergement/https/',
								title: 'Domena i HTTPS',
								text: 'Za twoim proxy albo z dostarczonym Caddy.',
							},
							sso: {
								href: '/hebergement/connexion/',
								title: 'Logowanie i SSO',
								text: 'Google, Microsoft, każdy dostawca OpenID Connect.',
							},
							backup: {
								href: '/hebergement/sauvegardes/',
								title: 'Kopie zapasowe i aktualizacje',
								text: 'pg_dump i aktualizacje bez utraty danych.',
							},
						},
					},
				},
				feature: {
					title: 'Strona dla programistów',
					text: 'Prawdziwa tabela PostgreSQL za każdą siatką.',
					href: '/developpeurs/',
				},
			},
			resources: {
				label: 'Materiały',
				groups: {
					learn: {
						title: 'Nauka',
						items: {
							docs: {
								href: '/guides/introduction/',
								title: 'Dokumentacja',
								text: 'Cały basedb, krok po kroku.',
							},
							start: {
								href: '/guides/premiers-pas/',
								title: 'Pierwsze kroki',
								text: 'Pierwsza baza, od importu do widoku.',
							},
							install: {
								href: '/guides/installation/',
								title: 'Instalacja',
								text: 'Dwa pliki i jedna komenda.',
							},
							principles: {
								href: '/architecture/principes/',
								title: 'Zasady',
								text: 'Jak basedb jest zbudowany i dlaczego.',
							},
						},
					},
					follow: {
						title: 'Śledzenie projektu',
						items: {
							news: {
								href: '/nouveautes/',
								title: 'Nowości',
								text: 'Co się zmieniło, wersja po wersji.',
							},
							roadmap: {
								href: '/feuille-de-route/',
								title: 'Plan rozwoju',
								text: 'Co będzie dalej.',
							},
							github: {
								href: 'https://github.com/eodia/basedb',
								title: 'GitHub',
								text: 'Kod, zgłoszenia, wersje.',
							},
							eodia: {
								href: 'https://eodia.com/',
								title: 'Eodia',
								text: 'Studio, które tworzy basedb.',
							},
						},
					},
				},
			},
		},
	},
	language: {
		label: 'Język',
		current: 'Język: {name}',
	},
	footer: {
		tagline: 'Baza do współpracy, w której każda tabela jest prawdziwą tabelą PostgreSQL.',
		madeBy: 'Wolne oprogramowanie tworzone przez <a class="eodia" href="https://eodia.com/">Eodia</a>, studio oprogramowania natywnie opartego na AI.',
		columns: {
			product: {
				title: 'Produkt',
				links: [
					{
						href: '/#fonctionnalites',
						label: 'Funkcje',
					},
					{
						href: '/nouveautes/',
						label: 'Nowości',
					},
					{
						href: '/feuille-de-route/',
						label: 'Plan rozwoju',
					},
					{
						href: '/#faq',
						label: 'Częste pytania',
					},
				],
			},
			docs: {
				title: 'Dokumentacja',
				links: [
					{
						href: '/guides/introduction/',
						label: 'Wprowadzenie',
					},
					{
						href: '/guides/installation/',
						label: 'Instalacja',
					},
					{
						href: '/integrations/api-rest/',
						label: 'API REST',
					},
					{
						href: '/integrations/mcp/',
						label: 'Serwer MCP',
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
						label: 'Zmienne środowiskowe',
					},
					{
						href: '/hebergement/https/',
						label: 'Domena i HTTPS',
					},
					{
						href: '/hebergement/sauvegardes/',
						label: 'Kopie zapasowe',
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
						label: 'Dokument architektury',
					},
					{
						href: 'https://github.com/eodia/basedb/blob/main/LICENSE',
						label: 'Licencja AGPL-3.0',
					},
					{
						href: 'https://github.com/eodia/basedb/issues',
						label: 'Zgłoś problem',
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
						label: 'O nas',
					},
					{
						href: 'https://eodia.com/contact/',
						label: 'Kontakt',
					},
				],
			},
		},
		copyright: '© {year} <a href="https://eodia.com/">Eodia</a> · AGPL-3.0-or-later',
		builtWith: 'Witryna zbudowana w Astro i Starlight.',
	},
	docsFooter: {
		madeBy: 'basedb to wolne oprogramowanie tworzone przez <a href="https://eodia.com/">Eodia</a>, studio oprogramowania natywnie opartego na AI.',
	},
	teams: {
		meta: {
			title: 'basedb – baza do współpracy dla całego zespołu',
			description: 'Cała twoja praca w jednym miejscu, edytowana przez cały zespół w tym samym czasie: w tabeli, kanbanie albo kalendarzu, z formularzami, pulpitami, automatyzacjami i AI. Bez kodu, otwarta i bezpłatna.',
		},
		hero: {
			eyebrow: 'basedb',
			title: 'Cała twoja praca.',
			titleAccent: 'Nareszcie w jednym miejscu.',
			lead: 'Tabele, kalendarze, formularze, pulpity i automatyzacje dla całego zespołu. Proste jak arkusz kalkulacyjny. Bez linijki kodu.',
			primary: 'Zobacz szablony',
			secondary: 'Obejrzyj demo',
			facts: ['Bez kodu', 'Otwarty i bezpłatny', 'Twoje dane zostają u ciebie'],
		},
		story: {
			grid: {
				title: 'Cały zespół, w tej samej tabeli.',
				text: 'Każdy pracuje w niej w tym samym czasie, a wszyscy widzą to samo, na bieżąco.',
			},
			copilot: {
				title: 'Zapytaj. Copilot się tym zajmie.',
				text: '„Z kim powinnam się skontaktować w tym tygodniu?” — Copilot proponuje właściwy filtr, a ty stosujesz go jednym kliknięciem.',
			},
			kanban: {
				title: 'Przeciągnij. Już jest aktualne.',
				text: 'Każdy etap to kolumna; przesunięcie karty zmienia wiersz.',
			},
			calendar: {
				title: 'Każda data na swoim miejscu.',
				text: 'Terminy wyświetlają się same i można je śledzić nawet we własnym kalendarzu.',
			},
			dashboard: {
				title: 'A wszystko – jednym spojrzeniem.',
				text: 'Liczby wyliczają się same, na podstawie tych samych wierszy.',
			},
		},
		stage: {
			aria: 'Śledzenie klientów zespołu w basedb: tabela, Copilot, kanban, kalendarz, pulpit',
			tabs: {
				grid: 'Siatka',
				copilot: 'Copilot',
				kanban: 'Kanban',
				calendar: 'Kalendarz',
				dashboard: 'Pulpit',
			},
			project: 'Główny projekt',
			projectMeta: 'Projekt · 2 bazy',
			filterNav: 'Filtruj nawigację',
			base: 'Sprzedaż',
			otherBase: 'Wsparcie',
			tables: ['Klienci', 'Kontakty', 'Oferty'],
			baseSection: 'Baza · Sprzedaż',
			screens: ['Pulpity', 'Automatyzacje'],
			user: 'Léa Martin',
			views: { grid: 'Wszystkie wiersze', kanban: 'Według etapu', calendar: 'Spotkania' },
			toolbar: {
				filter: 'Filtruj',
				columns: 'Kolumny',
				group: 'Grupuj',
				colors: 'Kolory',
				sort: 'Sortuj',
				configure: 'Konfiguruj',
			},
			search: 'Szukaj…',
			add: 'Dodaj',
			columns: {
				name: 'Klient',
				status: 'Etap',
				owner: 'Opiekun',
				amount: 'Kwota',
				next: 'Najbliższe spotkanie',
			},
			statuses: {
				contact: 'Do kontaktu',
				meeting: 'Spotkanie',
				quote: 'Oferta wysłana',
				signed: 'Podpisano',
			},
			clients: [
				'Piekarnia Kowalski',
				'Klinika w Lipowie',
				'Liceum Kochanowskiego',
				'Rower Solidarny',
				'Delikatesy Smakosz',
				'Kuźnia nad Wisłą',
				'Warsztat Nowak',
			],
			addRow: 'Dodaj wiersz',
			perPage: 'Wierszy na stronę',
			card: 'Opiekun: {owner}, spotkanie {date}',
			addCard: 'Dodaj kartę',
			today: 'Dzisiaj',
			month: 'Miesiąc',
			week: 'Tydzień',
			dashboards: 'Pulpity',
			questions: 'Pytania',
			dashboard: 'Śledzenie sprzedaży',
			dashboardText: 'Najważniejsze jednym spojrzeniem.',
			dashboardTabs: ['Przegląd', 'Aktywność'],
			period: 'Okres',
			thisYear: 'Ten rok',
			share: 'Udostępnij',
			edit: 'Edytuj',
			explore: 'Eksploruj dane',
			chart: 'Kwota na klienta',
			byStage: 'Klienci według etapu',
			kpis: {
				signed: 'Podpisane',
				pending: 'Oferty w toku',
				rate: 'Podpisani klienci',
			},
			copilot: {
				question: 'Z kim powinnam się skontaktować w tym tygodniu?',
				thinking: 'Analizuję…',
				answer: 'Czterech klientów czeka na odpowiedź: dwie oferty wysłane i dwa spotkania do przygotowania.',
				card: 'Filtruj: Klienci',
				filter: 'Etap: Oferta wysłana lub Spotkanie',
				apply: 'Zastosuj filtr',
				applied: 'Filtr zastosowany',
				placeholder: 'Zapytaj Copilota…',
				filtered: '{n} przefiltrowane wiersze',
			},
		},

		teaser: {
			tabs: { label: 'Wybierz film', short: 'W minutę', full: 'Pełna prezentacja' },
			titleAccent: 'w minutę.',
			text: 'Tabele, widoki, formularze, automatyzacje i AI: to, co najważniejsze w basedb, z lektorem i muzyką.',
			duration: '1 min',
			inEnglish: 'Film jest w języku angielskim, z angielskimi napisami.',
		},

		video: {
			eyebrow: 'Demo',
			title: 'Cały basedb,',
			titleAccent: 'w siedem minut.',
			text: 'Utworzyć bazę, wypełnić ją, udostępnić, zautomatyzować, nadzorować: pełne zwiedzanie, z komentarzem.',
			play: 'Odtwórz wideo',
			duration: '6 min 36 s',
			chapters: 'Rozdziały',
			captions: 'Angielski',
			inEnglish: 'Film jest w języku angielskim, z angielskimi napisami.',
			list: [
				{ time: '0:10', title: 'Tworzenie bazy' },
				{ time: '0:49', title: 'Tabele, pola i formuły' },
				{ time: '1:31', title: 'Szczegóły wiersza i współpraca' },
				{ time: '1:56', title: 'Sześć widoków tych samych wierszy' },
				{ time: '2:29', title: 'Formularze i ankiety' },
				{ time: '3:28', title: 'Quizy' },
				{ time: '4:10', title: 'Automatyzacje' },
				{ time: '4:39', title: 'Pulpity' },
				{ time: '4:59', title: 'SQL dla każdego' },
				{ time: '5:30', title: 'Historia i uprawnienia' },
				{ time: '5:53', title: 'API, MCP i Copilot' },
			],
		},
		together: {
			eyebrow: 'Współpraca',
			title: 'Wszyscy.',
			titleAccent: 'W tym samym czasie.',
			text: 'Zmiany innych pojawiają się na żywo. Widzisz, kto patrzy na który wiersz, rozmawiasz o nim tam, gdzie się znajduje, a @ wystarczy, by powiadomić kolegę.',
			demo: {
				path: 'Sprzedaż / Oferty',
				here: '3 osoby na tej tabeli',
				columns: {
					client: 'Klient',
					status: 'Etap',
					amount: 'Kwota',
					due: 'Termin',
				},
				statuses: {
					draft: 'Szkic',
					sent: 'Wysłano',
					signed: 'Podpisano',
				},
				rows: [
					'Piekarnia Kowalski',
					'Klinika w Lipowie',
					'Liceum Kochanowskiego',
					'Rower Solidarny',
					'Delikatesy Smakosz',
					'Kuźnia nad Wisłą',
				],
				comment: '@{name} możesz zatwierdzić tę ofertę przed wieczorem?',
				reply: 'Zatwierdzone!',
				toast: '{name} zmienił(a) „{field}”',
			},
			points: {
				live: {
					title: 'Na żywo',
					text: 'Każda zmiana pojawia się u innych natychmiast, bez odświeżania strony.',
				},
				comments: {
					title: 'Komentarze i wzmianki',
					text: 'Komentujesz wiersz, wzmiankujesz kolegę przez @, a dzwonek go powiadamia.',
				},
				undo: {
					title: 'Cofnij bez obaw',
					text: 'Ctrl+Z wycofuje twoją ostatnią zmianę – nigdy zmianę kolegi.',
				},
			},
			link: {
				href: '/fonctionnalites/collaboration/',
				label: 'Praca w zespole',
			},
		},
		forms: {
			eyebrow: 'Formularze i ankiety',
			title: 'Zadawaj pytania.',
			titleAccent: 'Odpowiedzi porządkują się same.',
			text: 'Formularz na jednej stronie albo ankieta zadająca jedno pytanie na ekran, w twoich kolorach: udostępnij link, a każda odpowiedź stanie się wierszem twojej tabeli. Osoba odpowiadająca nie widzi nic więcej.',
			modes: {
				label: 'Pokaż pytania',
				survey: 'Ankieta',
				form: 'Formularz',
			},
			demo: {
				title: 'Zapytanie ofertowe',
				description: 'Trzy pytania, i odezwiemy się w ciągu 48 godzin.',
				count: '3 pytania',
				start: 'Rozpocznij',
				ok: 'OK',
				hint: 'lub Enter',
				submit: 'Wyślij moje zapytanie',
				org: {
					label: 'Twoja organizacja',
					answer: 'Kawiarnia Sztuki',
				},
				need: {
					label: 'Twoja potrzeba',
					options: ['Strona internetowa', 'Identyfikacja wizualna', 'Katalog'],
				},
				budget: {
					label: 'Twój budżet',
					help: 'Netto, nawet w przybliżeniu.',
				},
				sent: 'Wysłano!',
				thanks: 'Dziękujemy! Odezwiemy się w ciągu 48 godzin.',
				poweredBy: 'Formularz obsługiwany przez basedb',
				path: 'Sprzedaż / Zapytania',
				view: 'Wszystkie zapytania',
				columns: {
					org: 'Organizacja',
					need: 'Potrzeba',
					budget: 'Budżet',
					stage: 'Etap',
				},
				stages: {
					new: 'Nowe',
					called: 'Oddzwoniono',
					quote: 'Oferta wysłana',
				},
				rows: ['Piekarnia Kowalski', 'Klinika w Lipowie', 'Rower Solidarny', 'Kuźnia nad Wisłą'],
				open: 'Otwarty',
				answers: {
					one: '{n} odpowiedź',
					few: '{n} odpowiedzi',
					many: '{n} odpowiedzi',
					other: '{n} odpowiedzi',
				},
				active: 'Link aktywny',
			},
			points: {
				survey: {
					title: 'Jedno pytanie na ekran',
					text: 'Na pełnym ekranie, z klawiatury: Enter, aby przejść dalej, A, B, C, aby wybrać — pojedynczy wybór sam przechodzi dalej, a wysłanie się świętuje.',
				},
				access: {
					title: 'Publiczny albo tylko dla zalogowanych',
					text: 'Każdy, kto ma link, odpowiada bez konta — albo tylko zalogowani członkowie, a odpowiedź nosi ich imię i nazwisko.',
				},
				closed: {
					title: 'Reszta zostaje zamknięta',
					text: 'Odpowiadanie nie pokazuje niczego innego z tabeli. Link zamyka się w wybranym dniu albo po określonej liczbie odpowiedzi.',
				},
			},
			link: {
				href: '/fonctionnalites/formulaires-partages/',
				label: 'Formularze',
			},
		},
		automate: {
			eyebrow: 'Automatyzacje',
			title: 'Pracuje',
			titleAccent: 'kiedy ty śpisz.',
			text: 'Gdy wiersz się pojawia lub zmienia, o stałej godzinie albo jednym kliknięciem przycisku, basedb wykonuje kolejne kroki: wybiera właściwą gałąź, pyta AI, powiadamia kogo trzeba. A każde uruchomienie można prześledzić krok po kroku.',
			clock: '03:12',
			crumb: 'Sprzedaż / Automatyzacje',
			create: 'Nowa automatyzacja',
			list: [
				{
					name: 'Nowe zapytanie',
					when: 'Wiersz został utworzony',
				},
				{
					name: 'Oferta podpisana',
					when: 'Wiersz został zmieniony',
				},
				{
					name: 'Przypomnienia w poniedziałek',
					when: 'W każdy poniedziałek o 09:00',
				},
			],
			active: 'Aktywna',
			test: 'Testuj na wierszu',
			save: 'Zapisz',
			when: 'Kiedy',
			trigger: 'Wiersz został utworzony',
			table: 'W tabeli Zapytania',
			steps: {
				branch: {
					kind: 'Warunek',
					text: '2 gałęzie',
					run: 'gałąź „Duży projekt”',
				},
				notify: {
					kind: 'Powiadom kogoś',
					text: 'Léa Martin',
					run: 'Powiadomiono 1 osobę',
				},
				create: {
					kind: 'Utwórz wiersz',
					text: 'Spotkanie, w Kalendarzu',
					run: 'wykonano',
				},
				slack: {
					kind: 'Wyślij na Slack',
					text: 'Na kanale #sprzedaż',
					run: 'wykonano',
				},
				ai: {
					kind: 'Zapytaj AI',
					text: 'Zredagować pierwszą odpowiedź',
					run: 'odpowiedź o długości {n} znaków',
				},
				update: {
					kind: 'Edytuj wiersz',
					text: 'Odpowiedź, Etap',
					run: 'wykonano',
				},
			},
			paths: {
				big: 'Duży projekt',
				condition: 'budget gt 5000',
				otherwise: 'W przeciwnym razie',
			},
			answer: 'Dzień dobry, i dziękujemy za zapytanie! Léa, która zajmie się Państwa nową identyfikacją wizualną, zadzwoni jutro rano.',
			addStep: 'Dodaj krok',
			tabs: {
				settings: 'Opcje',
				runs: 'Uruchomienia',
			},
			runsText: 'Ostatnie 50, przechowywane przez 30 dni. Wybierz jedno, aby zobaczyć w przepływie, którą gałęzią poszło.',
			running: 'W toku',
			succeeded: 'Udane',
			started: 'utworzono wiersz · {when}',
			now: 'przed chwilą',
			earlier: ['wczoraj o 18:40', 'wczoraj o 11:02'],
			done: 'Udane · 5 kroków · 1,3 s',
			points: {
				when: {
					title: 'We właściwym momencie',
					text: 'Utworzony lub zmieniony wiersz, stała godzina, przycisk — i warunek, by ruszać tylko wtedy, gdy trzeba.',
				},
				paths: {
					title: 'Kilka gałęzi',
					text: 'Warunek otwiera gałęzie, każda ze swoimi krokami; to, co znajdzie jeden krok, może przywołać następny.',
				},
				copilot: {
					title: 'Opisana jednym zdaniem',
					text: '„Kiedy przychodzi zapytanie, powiadom Léa, jeśli budżet przekracza 5 000 €”: Copilot buduje przepływ, a ty go sprawdzasz.',
				},
			},
			link: {
				href: '/fonctionnalites/automatisations/',
				label: 'Automatyzacje',
			},
		},
		glance: {
			eyebrow: 'Pulpity',
			title: 'Zobacz wszystko.',
			titleAccent: 'Jednym spojrzeniem.',
			text: 'Liczby, wykresy, cele: twoje pulpity budujesz myszką na podstawie własnych tabel, a one same są na bieżąco. Jeden filtr, i cały pulpit się dopasowuje.',
			demo: {
				title: 'Sterowanie sprzedażą',
				filters: ['Ten rok', 'Wszystkie miasta'],
				revenue: 'Przychód',
				signed: 'Podpisane oferty',
				rate: 'Wskaźnik podpisania',
				goal: 'Cel roczny',
				byMonth: 'Przychody według miesięcy',
				byStage: 'Oferty według etapu',
				stages: ['Wysłane', 'W rozmowach', 'Podpisane'],
				bySector: 'Klienci według sektora',
				sectors: ['Handel', 'Zdrowie', 'Edukacja', 'Przemysł'],
				shared: 'Udostępniony przez link',
			},
			points: {
				viz: {
					title: 'Piętnaście wizualizacji',
					text: 'Liczby, trendy, cele, wykresy, sektory, lejki, tabele przestawne, mapy.',
				},
				filters: {
					title: 'Wspólne filtry',
					text: 'Okres, klient, miasto: jeden filtr steruje jedną kartą, kilkoma albo całym pulpitem.',
				},
				share: {
					title: 'Udostępniony linkiem',
					text: 'Publiczny lub tylko dla członków, i do osadzenia w innej witrynie.',
				},
			},
			link: {
				href: '/fonctionnalites/tableaux-de-bord/',
				label: 'Pulpity',
			},
		},
		ai: {
			eyebrow: 'Sztuczna inteligencja',
			title: 'Opisz.',
			titleAccent: 'basedb buduje.',
			text: 'Jedno zdanie wystarczy, by otrzymać kompletną bazę, którą przeglądasz przed utworzeniem. Później Copilot proponuje filtry, wykresy i automatyzacje, a pola AI streszczają, klasyfikują i piszą za ciebie.',
			prompt: 'Śledzenie aplikacji na nasze trzy otwarte stanowiska, razem z rozmowami kwalifikacyjnymi.',
			thinking: 'Trzy powiązane tabele, gotowe do sprawdzenia.',
			tables: {
				jobs: {
					name: 'Stanowiska',
					fields: ['Nazwa', 'Dział', 'Data otwarcia'],
				},
				people: {
					name: 'Kandydaci',
					fields: ['Imię i nazwisko', 'Stanowisko', 'Etap', 'Podsumowanie'],
				},
				talks: {
					name: 'Rozmowy',
					fields: ['Kandydat', 'Data', 'Z kim', 'Opinia'],
				},
			},
			aiField: 'Podsumowanie',
			aiValue: 'Sześć lat w zarządzaniu projektami, swobodnie w kontakcie z klientami; do sprawdzenia: angielski.',
			create: 'Utwórz bazę',
			providers: 'Z dostawcą, którego wybierzesz — OpenAI, Anthropic, Mistral, albo model zainstalowany u ciebie. Nic nie zostaje wysłane bez twojej zgody.',
			link: {
				href: '/fonctionnalites/ia/',
				label: 'AI w basedb',
			},
		},
		features: {
			title: 'Wszystko, czego potrzebujesz.',
			titleAccent: 'I znacznie więcej.',
			text: 'Każda funkcja zapisuje w tych samych tabelach, z tymi samymi uprawnieniami, w tej samej historii.',
			tiles: {
				views: {
					stat: '10',
					title: 'sposobów przeglądania danych',
					text: 'Siatka, kanban, kalendarz, oś czasu, galeria, lista, mapa, formularz, ankieta i quiz na tych samych wierszach. Każdy wybiera swój.',
					href: '/fonctionnalites/vues/',
				},
				history: {
					stat: 'Ctrl+Z',
					title: 'Nic się nie gubi',
					text: 'Każda zmiana jest zapisywana z poprzednią wartością; błąd można wycofać, usunięty wiersz przywrócić.',
					href: '/fonctionnalites/historique/',
				},
				forms: {
					title: 'Formularze',
					text: 'Link publiczny lub tylko dla zespołu: każda odpowiedź trafia do tabeli, bez dostępu do reszty.',
					href: '/fonctionnalites/formulaires-partages/',
				},
				viz: {
					stat: '15',
					title: 'wizualizacji',
					text: 'Liczby, trendy, cele, wykresy, sektory, lejki, tabele przestawne i mapy.',
					href: '/fonctionnalites/tableaux-de-bord/',
				},
				formulas: {
					code: 'IF([Montant] > 10000, "Grand compte", "")',
					title: 'Formuły po francusku lub po angielsku',
					text: 'Jak w arkuszu kalkulacyjnym — SI, ARRONDI, JOURS… albo IF, ROUND, DAYS — ale obliczane dla całego zespołu.',
					href: '/fonctionnalites/tables-et-champs/#formuły',
				},
				rights: {
					title: 'Każdy widzi to, co powinien',
					text: 'Odczyt, edycja, zarządzanie – zespół po zespole; czułą kolumnę można ukryć.',
					href: '/fonctionnalites/droits/',
				},
				mentions: {
					bubble: '@Camille',
					title: 'Komentarze i wzmianki',
					text: 'Rozmawiasz o wierszu tam, gdzie się znajduje, a dzwonek powiadamia.',
					href: '/fonctionnalites/collaboration/',
				},
				relations: {
					title: 'Wszystko jest połączone',
					text: 'Klienci, projekty, faktury: sumy i odnośniki przechodzą przez relacje.',
					href: '/fonctionnalites/tables-et-champs/',
				},
				templates: {
					stat: '10',
					title: 'gotowych szablonów',
					text: 'CRM, rekrutacja, magazyn, wydarzenia… albo baza opisana AI w jednym zdaniu.',
					href: '/modeles/',
				},
				import: {
					title: 'Import jednym gestem',
					text: 'Przeciągnij skoroszyt Excela albo plik CSV: kolumny i typy są odgadywane, tabela zostaje utworzona.',
					href: '/guides/premiers-pas/',
				},
				agenda: {
					title: 'Nawet w twoim kalendarzu',
					text: 'Kalendarz staje się kanałem dla Google Kalendarz, Outlooka albo Apple Calendar.',
					href: '/fonctionnalites/vues-partagees/',
				},
				files: {
					title: 'Pliki i obrazy',
					text: 'Oferty, zdjęcia, umowy; obraz staje się okładką karty.',
					href: '/fonctionnalites/fichiers/',
				},
				share: {
					title: 'Widoki udostępnione',
					text: 'Widok tylko do odczytu udostępniony linkiem, do osadzenia na twojej stronie.',
					href: '/fonctionnalites/vues-partagees/',
				},
				sync: {
					title: 'Tabele synchronizowane',
					text: 'Aktualizowane automatycznie z pliku CSV online, kalendarza albo innego basedb.',
					href: '/integrations/synchronisation/',
				},
				signin: {
					title: 'Proste logowanie',
					text: 'Google, Microsoft albo hasło; kolegów zaprasza się linkiem.',
					href: '/hebergement/connexion/',
				},
				languages: {
					title: 'W twoim języku',
					text: 'Interfejs przyjmuje język każdej osoby, wśród dwudziestu.',
					href: '/fonctionnalites/droits/#twoje-ustawienia',
				},
			},
		},
		yours: {
			eyebrow: 'Otwarty i samodzielnie hostowany',
			per: 'za osobę. Na zawsze.',
			text: 'basedb jest wolnym oprogramowaniem. Zainstaluj je na swoim serwerze i zaproś cały zespół: bez subskrypcji, bez licencji do liczenia, a twoje dane zostają u ciebie.',
			points: {
				home: {
					title: 'U ciebie',
					text: 'Na twoim serwerze albo u twojego hostingodawcy, z kopiami zapasowymi jak każda baza PostgreSQL.',
				},
				free: {
					title: 'Otwarty',
					text: 'Na licencji AGPL-3.0: kod jest otwarty i taki pozostanie.',
				},
				ai: {
					title: 'AI, którą wybierzesz',
					text: 'Dostawca z rynku, model zainstalowany u ciebie — albo żadnej AI.',
				},
			},
			link: {
				href: '/guides/installation/',
				label: 'Zainstaluj basedb',
			},
		},
		gallery: {
			eyebrow: 'Szablony',
			title: 'Gotowe w minutę.',
			text: 'Zacznij od szablonu z jego tabelami, widokami, pulpitem i przykładowymi wierszami, a potem dopasuj go do swojego sposobu pracy.',
			use: 'Zobacz',
			ask: {
				title: 'Nic nie pasuje?',
				text: 'Opisz swoją potrzebę jednym zdaniem: AI zaproponuje bazę na miarę.',
			},
			all: 'Zobacz wszystkie szablony',
			previous: 'Poprzednie szablony',
			next: 'Następne szablony',
		},
		developers: {
			title: 'A po stronie technicznej?',
			text: 'Każda tabela jest prawdziwą tabelą PostgreSQL. API REST, webhooki, serwer MCP dla agentów AI i instalacja jednym poleceniem.',
			link: 'Strona dla programistów',
		},
		faq: {
			title: 'Twoje pytania',
			items: [
				{
					q: 'Trzeba umieć programować?',
					a: 'Nie. Tabele, widoki, formularze, pulpity i automatyzacje tworzy się myszką. Formuły pisze się jak w arkuszu kalkulacyjnym, po francusku lub po angielsku: SI lub IF, ARRONDI lub ROUND, JOURS lub DAYS…',
				},
				{
					q: 'Ile to kosztuje?',
					a: 'Nic: basedb to wolne oprogramowanie, bez subskrypcji i ceny za osobę. Potrzebujesz tylko serwera, na którym je zainstalujesz.',
				},
				{
					q: 'Jak się je instaluje?',
					a: 'Na serwerze, z Dockerem: dwa pliki i jedna komenda, kilka minut dla osoby, która zajmuje się twoją informatyką. Przewodnik instalacji wyjaśnia wszystko, krok po kroku.',
				},
				{
					q: 'Czy można przenieść nasze arkusze kalkulacyjne?',
					a: 'Tak: przeciągnij swój skoroszyt Excela albo plik CSV do basedb. Import odgaduje typ każdej kolumny, tworzy tabelę i mówi wiersz po wierszu, czego nie udało się przenieść.',
				},
				{
					q: 'Czy można pracować razem, w tym samym czasie?',
					a: 'To jest do tego stworzone. Zmiany innych pojawiają się na żywo, komentujesz wiersz, wzmiankujesz kolegę przez @, a dzwonek powiadamia.',
				},
				{
					q: 'A AI, czy czyta nasze dane?',
					a: 'Tylko jeśli o tym zdecydujesz. Bez skonfigurowanego dostawcy AI nic nie zostaje wysłane. Potem pole albo automatyzacja korzystająca z AI wysyła tylko to, co przywołuje jej instrukcja, po twojej zgodzie.',
				},
				{
					q: 'W jakim języku?',
					a: 'W twoim: interfejs przyjmuje język twojej przeglądarki, wśród dwudziestu, a każda osoba może go zmienić w swoich ustawieniach.',
				},
			],
		},
		cta: {
			title: 'Twój zespół zasługuje na więcej',
			titleAccent: 'niż współdzielony plik.',
			text: 'Zacznij od szablonu, zaproś swoich kolegów i zostaw „FINAL (2)” za sobą.',
			primary: 'Zobacz szablony',
			secondary: 'Zainstaluj basedb',
		},
	},
	hero: {
		badge: 'Nowość: automatyzacje jako przepływy, pulpity i widoki SQL',
		title: ['Baza do współpracy,', 'w której każda tabela', 'to prawdziwa tabela'],
		titleAccent: 'PostgreSQL.',
		lead: 'Prostota wspólnego arkusza kalkulacyjnego – siatki, widoki, formularze, uprawnienia – i dane, które żyją w tabelach <strong>typowanych i nazwanych czytelnie</strong>. Twój zespół pracuje w interfejsie; twoje skrypty, narzędzia BI, agenci AI i <code>psql</code> czytają te same wiersze.',
		install: 'Zainstaluj z Dockerem',
		features: 'Zobacz funkcje',
		copy: 'Skopiuj polecenie',
		facts: ['Samodzielnie hostowany', 'AGPL-3.0', 'API REST i serwer MCP'],
		demo: {
			url: 'basedb.twoja-domena.pl',
			project: 'Projekt główny',
			projectMeta: 'Projekt · 2 bazy',
			filter: 'Filtruj bazy i tabele',
			sales: 'Sprzedaż',
			support: 'Wsparcie',
			environment: 'Produkcyjne',
			clients: 'Klienci',
			opportunities: 'Szanse sprzedaży',
			quotes: 'Oferty',
			baseSection: 'Baza · Sprzedaż',
			screens: ['Pulpity', 'Automatyzacje'],
			copilot: '✦ Copilot',
			allRows: '▦ Wszystkie wiersze ▾',
			tools: ['Filtruj', 'Grupuj', 'Kolory'],
			search: 'Szukaj…',
			add: '+ Dodaj',
			columns: {
				name: 'Nazwa',
				status: 'Status',
				amount: 'Kwota',
				client: 'Klient',
			},
			statuses: {
				nouveau: 'Nowa',
				qualifie: 'Kwalifikacja',
				proposition: 'Oferta',
				negociation: 'Negocjacje',
				gagne: 'Wygrana',
				perdu: 'Przegrana',
			},
			deals: {
				portail: {
					name: 'Przebudowa portalu',
					client: 'Urząd Miasta Lipowo',
				},
				erp: {
					name: 'Migracja ERP',
					client: 'Grupa Zawadzki',
				},
				audit: {
					name: 'Audyt bezpieczeństwa',
					client: 'Klinika św. Rocha',
				},
				billetterie: {
					name: 'Sprzedaż biletów online',
					client: 'Teatr Rondo',
				},
				flotte: {
					name: 'Monitoring floty',
					client: 'Transport Krawczyk',
				},
				mobile: {
					name: 'Aplikacja mobilna',
					client: 'Pracownia Morawska',
				},
				intranet: {
					name: 'Przebudowa intranetu',
					client: '',
				},
			},
			toastTitle: 'Formularz „Zapytanie ofertowe”',
			toastText: 'odpowiedź publiczna · utworzono „{name}”',
			cursor: 'Kasia',
			psqlRows: '(2 wiersze)',
		},
	},
	showcase: {
		label: 'Prawdziwy interfejs',
		title: 'Wszystko, czego twój zespół oczekuje od wspólnego arkusza.',
		tabs: 'Zrzuty ekranu interfejsu',
		alt: 'basedb – {labelLower}: {caption}',
		shots: {
			grille: {
				label: 'Siatka',
				caption: 'Siatka, która zapisuje do prawdziwej tabeli – i pola obliczane: czas trwania z formuły, miasto klienta z odnośnika, liczba zadań ze zliczania.',
			},
			kanban: {
				label: 'Kanban',
				caption: 'Te same wiersze w kolumnach, według pojedynczego wyboru: obraz okładki i opis, który przytacza wartości wiersza. Przeciągnięcie karty zmienia wiersz.',
			},
			galerie: {
				label: 'Galeria',
				caption: 'Karty z obrazem, kolor według statusu: Galeria, jeden z ośmiu sposobów przeglądania tabeli.',
			},
			chronologie: {
				label: 'Oś czasu',
				caption: 'Paski między dwiema datami i strzałki ich zależności – czerwone, gdy kolejność przestaje się zgadzać.',
			},
			tableaux: {
				label: 'Pulpity',
				caption: 'Karty w siatce, w zakładkach, przy wspólnych filtrach: trend, cel, serie skumulowane – czytane z uprawnieniami każdego.',
			},
			automatisations: {
				label: 'Automatyzacje',
				caption: 'Gdy zadanie jest zrobione, sprawdź, co zostało z projektu; jeśli nic nie zostało, AI pisze notatkę podsumowującą i projekt przechodzi w stan „Dostarczony”. Każde uruchomienie czyta się na przepływie, krok po kroku.',
			},
			commentaires: {
				label: 'Komentarze',
				caption: 'O wierszu rozmawia się tam, gdzie się znajduje: komentarze, wzmianki, powiadomienia.',
			},
			formulaire: {
				label: 'Formularz',
				caption: 'Formularz udostępnia się przez link, publiczny lub tylko dla zalogowanych członków.',
			},
			historique: {
				label: 'Historia',
				caption: 'Każdy zapis, skądkolwiek pochodzi – od osoby, automatyzacji, z bezpośredniego SQL – z poprzednimi wartościami.',
			},
			sql: {
				label: 'SQL',
				caption: 'Zapytanie na prawdziwych nazwach, zapisane pod tabelami dla całego zespołu – każdy wykonuje je z własnymi uprawnieniami.',
			},
			vuesSql: {
				label: 'Widoki SQL',
				caption: 'Prawdziwe widoki PostgreSQL, ułożone wśród tabel z kolorem i ikoną – i czytelne z psql.',
			},
		},
	},
	features: {
		postgres: {
			label: 'PostgreSQL bez pośredników',
			title: 'Siatka dla zespołu, prawdziwa tabela {dla twoich narzędzi.}',
			lead: 'Żadnego generycznego modelu, żadnego JSON-a na wszystko, żadnego <code>field_1837</code>: baza to schemat, tabela to tabela, pole to typowana kolumna o czytelnej nazwie.',
			bullets: [
				'<strong>Typy natywne</strong>: <code>text</code>, <code>numeric</code>, <code>date</code>, <code>timestamptz</code>, <code>boolean</code> – i prawdziwe klucze obce dla relacji.',
				'<strong>Ograniczenia pilnowane przez bazę</strong>: pojedyncze wybory jako <code>CHECK</code>, sprawdzane adresy internetowe i e-mail, relacje jako <code>FOREIGN KEY</code>.',
				'<strong>Formuły obliczane przez PostgreSQL</strong>: <code>JOURS([Fin]; [Début])</code> staje się kolumną generowaną, którą <code>psql</code> czyta jak każdą inną.',
				'<strong>Bezpośredni SQL jest nadal dozwolony</strong> – i nawet on trafia do historii, dzięki wyzwalaczowi.',
				'<strong>Zapytania i widoki SQL</strong> w interfejsie: zapytania zapisane pod tabelami, dla siebie lub dla zespołu, i prawdziwe widoki PostgreSQL ułożone wśród nich, które <code>psql</code> również czyta.',
				'<strong>Zmiana nazwy niczego nie psuje</strong>: stara nazwa jest nadal obsługiwana przez alias zgodności, dopóki nie zaktualizujesz swoich zapytań.',
			],
			links: [
				{
					href: '/integrations/sql/',
					label: 'Praca w SQL',
				},
				{
					href: '/fonctionnalites/requetes-et-vues-sql/',
					label: 'Zapytania i widoki SQL',
				},
				{
					href: '/architecture/principes/',
					label: 'Zasady',
				},
			],
		},
		automations: {
			label: 'Automatyzacja',
			title: 'Automatyzacje jako przepływy, {AI na każdym kroku.}',
			lead: 'Gdy wiersz się zmienia, o stałej porze lub jednym kliknięciem: edytor grafowy łączy kroki w łańcuch, a każde uruchomienie można prześledzić na przepływie.',
			bullets: [
				'<strong>Czytelny przepływ</strong>: wyzwalacz, a potem każdy krok jako karta; <strong>+</strong> na linii dodaje krok w tym miejscu.',
				'<strong>Znajdź, zdecyduj, zapisz</strong>: znajdź wiersz, wybierz tę lub inną gałąź w zależności od warunków, edytuj, utwórz, powiadom, wywołaj webhook, napisz na Slacku.',
				'<strong>Zapytaj AI</strong> w kroku: polecenie, które przytacza wiersz, i odpowiedź odczytana jako tekst, liczba, data lub wybór, którą wykorzystują kolejne kroki.',
				'<strong>Copilot</strong> proponuje całą automatyzację na podstawie jednego zdania albo wyjaśnia, dlaczego uruchomienie się nie powiodło – nic nie zostaje zapisane bez ciebie.',
				'<strong>Z uprawnieniami osoby, która ją zapisała</strong>, i w historii, jak każdy inny zapis.',
			],
			links: [
				{
					href: '/fonctionnalites/automatisations/',
					label: 'Automatyzacje',
				},
				{
					href: '/fonctionnalites/automatisations/#copilot',
					label: 'Copilot',
				},
			],
			alt: 'basedb – automatyzacja „Projekt dostarczony” w edytorze przepływu: gdy zadanie jest zrobione, zapisz godzinę, sprawdź, co zostało z projektu, wybierz gałąź „W przeciwnym razie”, zapytaj AI o notatkę podsumowującą, a potem dostarcz projekt; po prawej jego ostatnie uruchomienia, krok po kroku.',
		},
		dashboards: {
			label: 'Analiza',
			title: 'Pulpity {bez opuszczania tabel.}',
			lead: 'Pytania zadawane myszą lub w SQL, piętnaście wizualizacji, wspólne filtry – każdy czyta je z własnymi uprawnieniami.',
			bullets: [
				'<strong>Pytania</strong>: tabela, jej złączenia, filtry i miary według dnia, tygodnia, miesiąca lub roku – albo SQL tylko do odczytu.',
				'<strong>Piętnaście wizualizacji</strong>: liczba, trend, cel, wskaźnik, słupki, linie, wykres kołowy, lejek, tabela przestawna, mapa…',
				'<strong>Eksploracja jednym kliknięciem</strong>: punkt otwiera swoje wiersze albo drobniejszy okres.',
				'<strong>Wspólne filtry</strong>, które sterują jedną, kilkoma lub wszystkimi kartami.',
				'<strong>Udostępnianie przez link</strong>, publiczny lub tylko dla członków, i osadzanie w innej witrynie.',
			],
			links: [
				{
					href: '/fonctionnalites/tableaux-de-bord/',
					label: 'Pulpity',
				},
			],
			alt: 'basedb – pulpit: trend miesiąca, cel wpływów, przychody według miesięcy, wydźwięk opinii, przy filtrach okresu i klienta.',
		},
		rights: {
			label: 'Współpraca bez otwierania wszystkiego',
			title: 'Uprawnienia aż do pola, {historia bez luk.}',
			lead: 'Uprawnienia nadaje się grupom, na projekcie, bazie lub tabeli, i przechodzą one na wszystko, co jest poniżej. Wrażliwą kolumnę można ukryć przed grupą albo uczynić dla niej niemodyfikowalną.',
			bullets: [
				'<strong>Cztery poziomy</strong>: Brak dostępu, Odczyt, Edycja, Zarządzanie – sumujące się między grupami.',
				'<strong>Nawet SQL podlega twoim uprawnieniom</strong>: w interfejsie zapytanie widzi tylko tabele i pola, które są dla ciebie otwarte – a egzekwuje to sam PostgreSQL.',
				'<strong>Każdy zapis jest rejestrowany</strong> w swojej transakcji: interfejs, API, agent, formularz publiczny czy bezpośredni SQL.',
				'<strong>Zmianę można cofnąć</strong>, usunięty wiersz przywrócić, usuniętą bazę również.',
				'<strong>Administracja wymaga potwierdzenia</strong>: zmiana uprawnienia wymaga ponownego wpisania hasła w ciągu ostatnich pięciu minut.',
			],
			links: [
				{
					href: '/fonctionnalites/droits/',
					label: 'Uprawnienia i grupy',
				},
				{
					href: '/fonctionnalites/historique/',
					label: 'Historia',
				},
			],
		},
		agents: {
			label: 'API REST · MCP · webhooki',
			title: 'Twoi agenci AI dostają dane, {a nie klucze do zamku.}',
			lead: 'Serwer MCP daje agentom piętnaście narzędzi; API REST – te same dane twoim programom. Jeden punkt kontroli uprawnień, te same dzienniki.',
			bullets: [
				'<strong>Jeden token na całą bazę</strong>, łącznie ze środowiskiem produkcyjnym i testowym, domyślnie tylko do odczytu, nigdy z większymi uprawnieniami niż osoba, która go utworzyła.',
				'<strong>Agent usuwa tylko za twoją zgodą</strong>, jeden wiersz na raz, i nie zmienia struktury: proponuje zmianę, a człowiek ją zatwierdza.',
				'<strong>Generowana dokumentacja</strong> dla każdej bazy, filtrowana według twoich uprawnień, ze specyfikacją OpenAPI 3.1.',
				'<strong>Webhooki</strong> podpisane, uporządkowane i ponawiane przy każdym zapisie.',
			],
			links: [
				{
					href: '/integrations/mcp/',
					label: 'Podłącz agenta',
				},
				{
					href: '/integrations/api-rest/',
					label: 'API REST',
				},
			],
		},
	},
	sqlVisual: {
		interface: 'Interfejs',
		title: 'Nowe pole · Szanse sprzedaży',
		labelField: 'Etykieta',
		labelValue: 'Kwota',
		typeField: 'Typ',
		typeValue: 'Liczba',
		descriptionField: 'Opis',
		descriptionValue: 'Kwota netto umowy',
		required: 'Wymagane',
		ai: 'AI',
		migration: 'zaplanowana migracja, krótkie blokady',
	},
	rightsVisual: {
		groups: ['Administratorzy', 'Handlowcy', 'Wsparcie'],
		project: 'Projekt główny',
		sales: 'Sprzedaż',
		opportunities: 'Szanse sprzedaży',
		clients: 'Klienci',
		support: 'Wsparcie',
		inherited: 'dziedziczony',
		levels: {
			none: 'Brak dostępu',
			read: 'Odczyt',
			edit: 'Edycja',
			manage: 'Zarządzanie',
		},
		field: 'Pole „Marża”',
		hidden: 'Ukryte',
		sqlChange: '<b>Bezpośrednia sesja SQL</b> zmieniła <b>„Migracja ERP”</b>',
		sqlMeta: '02:46 · połączenie lokalne · psql',
		sqlDiff: 'Kwota: <s>125 000</s> → 130 000',
		undo: '↶ Cofnij',
		formChange: '<b>Formularz „Zapytanie ofertowe”</b> utworzył <b>„Przebudowa intranetu”</b>',
		formMeta: 'odpowiedź publiczna · opublikowała Kasia',
	},
	agentVisual: {
		agent: 'Agent',
		via: 'połączony przez MCP · token „Sprzedaż”',
		question: 'Ile szans sprzedaży jest na etapie negocjacji i na jaką kwotę?',
		listArgs: 'opportunites · statut = Negocjacje',
		answer: 'Dwie szanse sprzedaży, łącznie <b>182 000 €</b>: Migracja ERP (130 000 €) i Monitoring floty (52 000 €).',
		request: 'Dodaj pole „Prawdopodobieństwo” w procentach.',
		proposeArgs: 'opportunites · Prawdopodobieństwo · number',
		proposed: 'Zaproponowane: ktoś z zespołu musi to zatwierdzić w basedb.',
		badge: 'Propozycja',
		expires: 'wygasa za 23 godz.',
		what: 'Dodaj pole <b>„Prawdopodobieństwo”</b> (Liczba) do tabeli <b>Szanse sprzedaży</b>',
		by: 'Zaproponowana przez agenta · token „Sprzedaż”',
		refuse: 'Odrzuć',
		approve: 'Zatwierdź',
	},
	bento: {
		label: 'I cała reszta',
		title: 'Czego oczekujesz od narzędzia zespołowego, bez porzucania PostgreSQL.',
		text: 'Każda funkcja zapisuje do tych samych tabel, z tymi samymi uprawnieniami, w tej samej historii.',
		more: 'Dowiedz się więcej →',
		views: {
			title: 'Dziesięć widoków tych samych wierszy',
			text: 'Wspólne dla całego zespołu albo osobiste, tylko dla ciebie: każdy wybiera swój sposób czytania, nikt nie kopiuje danych.',
			chips: ['Siatka', 'Kanban', 'Kalendarz', 'Oś czasu', 'Galeria', 'Lista', 'Mapa', 'Formularz', 'Ankieta', 'Quiz'],
		},
		forms: {
			title: 'Formularze udostępnione',
			text: 'Link publiczny albo tylko dla zalogowanych członków. Odpowiedź nie daje żadnych uprawnień do tabeli.',
			href: '/fonctionnalites/formulaires-partages/',
		},
		environments: {
			title: 'Środowiska',
			text: 'Jedna baza, kilka wariantów. Porównuj strukturę, migruj z jednego do drugiego, synchronizuj wiersze.',
			chips: ['Produkcyjne', 'Testowe', 'Deweloperskie'],
			href: '/fonctionnalites/environnements/',
		},
		collaboration: {
			title: 'Praca w zespole',
			text: 'Zapisy innych osób docierają w czasie rzeczywistym, widać, kto patrzy na który wiersz, a rozmawia się o nim tam, gdzie się znajduje: komentarze, wzmianki, powiadomienia. Ctrl+Z cofa ostatni zapis i odmawia, zamiast nadpisać cudzą pracę.',
			chips: ['Czas rzeczywisty', 'Obecność', 'Komentarze', 'Wzmianki', 'Ctrl+Z'],
			href: '/fonctionnalites/collaboration/',
		},
		small: {
			ai: {
				title: 'AI w siatce',
				text: 'Pole wypełniane przez model na podstawie innych kolumn i Copilot, który proponuje filtry, zapytania i kolumny, stosowane jednym kliknięciem. OpenAI, Anthropic, Mistral lub model działający na twoim własnym serwerze.',
				code: 'Streść {{Notes}} w jednym zdaniu',
				href: '/fonctionnalites/ia/',
			},
			formulas: {
				title: 'Relacje i formuły',
				text: 'Prawdziwe klucze obce, formuły po francusku lub po angielsku obliczane przez PostgreSQL oraz odnośniki, agregacje i zliczania przez relacje.',
				code: 'ROUND([Montant HT] * (1 + [Taux de TVA]), 2)',
				href: '/fonctionnalites/tables-et-champs/#formuły',
			},
			richText: {
				title: 'Tekst sformatowany i zmienne',
				text: 'Edytor wizualny dla sformatowanego tekstu, oczyszczanego przy zapisie; a w każdym długim tekście {{Ville}} czyta się jako wartość z wiersza.',
				code: 'Dostawa {{Date}}, miejsce: {{Ville}}',
				href: '/fonctionnalites/tables-et-champs/#tekst-sformatowany-i-zmienne',
			},
			languages: {
				title: 'W twoim języku',
				text: 'Interfejs przyjmuje język przeglądarki, jeden z dwudziestu; każdy może go zmienić w swoich ustawieniach.',
				href: '/fonctionnalites/droits/#twoje-ustawienia',
			},
			sharedViews: {
				title: 'Widoki udostępnione',
				text: 'Widok tylko do odczytu przez link, do osadzenia w innej witrynie; kalendarz staje się kanałem dla twojej aplikacji kalendarza.',
				href: '/fonctionnalites/vues-partagees/',
			},
			syncedTables: {
				title: 'Tabele synchronizowane',
				text: 'Tabela aktualizowana na bieżąco z pliku CSV online, kalendarza albo widoku udostępnionego innej instancji basedb.',
				href: '/integrations/synchronisation/',
			},
			templates: {
				title: 'Szablony baz',
				text: 'Dziesięć gotowych szablonów, baza opisana AI jednym zdaniem i twoja własna zapisana jako szablon.',
				href: '/modeles/',
			},
			files: {
				title: 'Pliki i obrazy',
				text: 'Na dysku hosta lub w magazynie zgodnym z S3: AWS, Scaleway, OVH, Cloudflare R2, Garage, MinIO…',
				href: '/fonctionnalites/fichiers/',
			},
			import: {
				title: 'Import Excel, CSV i JSON',
				text: 'Przeciągnij plik: import odgaduje typy, tworzy tabelę lub uzupełnia istniejącą i mówi wiersz po wierszu, co zostało odrzucone.',
				href: '/guides/premiers-pas/',
			},
			accounts: {
				title: 'Konta i zaproszenia',
				text: 'Każdy tworzy swoje konto i projekty, a innych zaprasza przez link z poziomem Odczyt, Edycja lub Zarządzanie; logowanie hasłem, przez Google, Microsoft lub dowolnego dostawcę OpenID Connect.',
				href: '/hebergement/connexion/',
			},
			webhooks: {
				title: 'Webhooki',
				text: 'Każdy zapis może powiadomić inny system: podpisane ładunki, dostarczane po kolei, ponawiane.',
				href: '/integrations/webhooks/',
			},
			settings: {
				title: 'Ustawienia osobiste',
				text: 'Twój język, motyw, kolejność elementów daty, powiadomienia, sesje i tokeny – w jednym miejscu.',
				href: '/fonctionnalites/droits/#twoje-ustawienia',
			},
		},
	},
	selfHost: {
		label: 'Samodzielnie hostowany',
		title: 'Twoje dane zostają {u ciebie.}',
		lead: 'basedb to wolne oprogramowanie (AGPL-3.0): jeden obraz, jedna baza PostgreSQL i nic więcej – żadnej narzuconej usługi zewnętrznej, żadnej telemetrii. Twórz kopie zapasowe za pomocą <code>pg_dump</code>, czytaj dane dowolnym klientem PostgreSQL.',
		services: {
			db: 'PostgreSQL 16, twoje dane',
			basedb: 'Interfejs, API REST i serwer MCP na jednym porcie',
			proxy: 'Caddy, automatyczny HTTPS (opcjonalnie)',
		},
		links: [
			{
				href: '/hebergement/docker/',
				label: 'Przewodnik Docker Compose →',
			},
			{
				href: '/hebergement/variables/',
				label: 'Wszystkie zmienne →',
			},
		],
		steps: [
			{
				title: 'Pobierz basedb',
				code: 'git clone https://github.com/eodia/basedb.git\ncd basedb && cp .env.example .env',
			},
			{
				title: 'Dwa sekrety w .env',
				code: 'POSTGRES_PASSWORD=mocne-haslo\n# openssl rand -base64 32\nBASEDB_ENCRYPTION_KEY=…',
			},
			{
				title: 'Uruchom',
				code: 'docker compose up -d\n# potem http://localhost:3000: utwórz swoje konto',
			},
		],
	},
	faq: {
		label: 'Częste pytania',
		title: 'O co często nas pytają.',
		text: 'Masz inne pytanie? <a href="/guides/introduction/">Dokumentacja</a> na pewno na nie odpowiada.',
		items: {
			difference: {
				q: 'Czym basedb różni się od innych baz do współpracy?',
				a: 'Miejscem, w którym żyją dane. Tam, gdzie inni przechowują twoje wiersze w generycznym modelu (numerowane kolumny, dokumenty JSON), basedb tworzy prawdziwą tabelę PostgreSQL dla każdej tabeli i prawdziwą typowaną kolumnę dla każdego pola, z czytelnymi nazwami. Twoje dane pozostają użyteczne bez basedb.',
			},
			sql: {
				q: 'Czy mogę zapisywać do tabel bezpośrednio w SQL?',
				a: 'Tak. Ograniczeń (typy, wymagalność, pojedyncze wybory, klucze obce) pilnuje sam PostgreSQL, a wyzwalacz rejestruje w historii nawet zapisy wykonane bezpośrednio w SQL, wraz z sesją, która je wykonała. Konsola SQL w interfejsie i psql czytają te same tabele; w interfejsie każdy pisze SQL z własnymi uprawnieniami, zapisuje swoje zapytania, a jeśli zarządza bazą – robi z nich prawdziwe widoki PostgreSQL.',
			},
			ai: {
				q: 'Co trafia do dostawcy AI?',
				a: 'Nic, dopóki nie skonfigurujesz dostawcy. Potem, przy szkicach struktury i w Copilocie, domyślnie wychodzi tylko struktura i twoje zdanie; odczyt danych przez Copilota to pole wyboru, osobno w każdej rozmowie. Szablon bazy zamówiony u AI wysyła tylko twoje zdanie. Pole AI wysyła kolumny, które przytacza jego polecenie, po wyraźnej zgodzie.',
			},
			together: {
				q: 'Czy kilka osób może pracować nad tą samą tabelą?',
				a: 'Tak. Zapisy innych wyświetlają się bez przeładowania, z ich awatarem na tabeli lub wierszu, na który patrzą. Komentujesz wiersz, wspominasz kogoś przez @, a dzwonek powiadamia. A Ctrl+Z cofa tylko twoje własne zapisy: odmawia, zamiast nadpisać to, co ktoś inny zmienił w międzyczasie.',
			},
			languages: {
				q: 'W jakich językach?',
				a: 'W dwudziestu: francuskim, angielskim, niemieckim, hiszpańskim, włoskim, portugalskim (Brazylia), niderlandzkim, polskim, czeskim, szwedzkim, duńskim, norweskim, fińskim, rumuńskim, węgierskim, tureckim, ukraińskim, japońskim, chińskim uproszczonym i koreańskim. Interfejs przyjmuje język przeglądarki, a każdy może go zmienić w swoich ustawieniach; ta witryna i dokumentacja istnieją w tych samych językach.',
			},
			agent: {
				q: 'Jak łączy się agent AI?',
				a: 'Przez serwer MCP, z tokenem integracji ograniczonym do jednej bazy, domyślnie tylko do odczytu. Agent czyta, tworzy i zmienia wiersze zgodnie ze swoimi uprawnieniami — a także je usuwa, po jednym na raz, jeśli jego token został do tego utworzony; nie zmienia struktury: proponuje zmianę, a człowiek ją zatwierdza.',
			},
			postgres: {
				q: 'Jakiej wersji PostgreSQL potrzeba?',
				a: 'PostgreSQL 16 lub nowszego, z rozszerzeniami pg_trgm i unaccent (dostępnymi w oficjalnym obrazie). Dołączony docker-compose uruchamia PostgreSQL 16; możesz też wskazać w DATABASE_URL własny serwer.',
			},
			production: {
				q: 'Czy to jest gotowe do produkcji?',
				a: 'basedb jest w fazie aktywnego rozwoju: rdzeń, API, serwer MCP i interfejs działają i są objęte ponad tysiącem testów, ale niektóre funkcje dopiero się pojawią (zobacz plan rozwoju). Wypróbuj go i twórz kopie zapasowe bazy jak każdej bazy PostgreSQL.',
			},
			license: {
				q: 'Na jakiej licencji?',
				a: 'AGPL-3.0-or-later. Możesz go swobodnie używać, zmieniać i hostować; jeśli oferujesz zmodyfikowaną wersję jako usługę, udostępniasz jej kod źródłowy.',
			},
		},
	},
	cta: {
		title: 'Twoje dane zasługują {na prawdziwe tabele.}',
		text: 'Zainstaluj basedb w kilka minut, zaproś zespół i zachowaj kontrolę nad każdym wierszem.',
		install: 'Zainstaluj basedb',
		github: 'Zobacz kod na GitHubie',
	},
	changelog: {
		label: 'Nowości',
		title: 'Co zmieniło się w basedb',
		intro: 'Szczegóły każdej zmiany są w <a href="https://github.com/eodia/basedb/commits/main">historii repozytorium</a>. Co dalej: <a href="/feuille-de-route/">plan rozwoju</a>.',
		entries: {
			oneToken: {
				date: '2026-10-09',
				title: 'Jeden token na całą bazę, środowisko do wyboru',
				tag: 'Nowość',
				items: [
					'<strong>Jeden token</strong> otwiera środowisko produkcyjne, testowe i przyszłe środowiska bazy; przy tworzeniu można go też ograniczyć do jednego. Istniejące tokeny zachowują swoje środowisko. <a href="/fonctionnalites/environnements/#przez-api-sdk-i-mcp">Przez API, SDK i MCP</a>',
					'<strong>Środowisko wybiera się przy wywołaniu</strong>: nagłówek <code>X-Basedb-Environment</code> API REST, <code>db.environment()</code> w SDK, pole Environment w n8n, adres <code>…/mcp?environment=recette</code> albo argument <code>environment</code> narzędzia MCP. <a href="/integrations/mcp/#wybór-środowiska">Wybór środowiska</a>',
					'<strong>Agent bez przekaźnika</strong>: okno tokenów podaje konfigurację HTTP dla Claude Code i plik <code>.mcp.json</code>, po jednym serwerze na środowisko z tym samym tokenem, a token pozostaje w zmiennej środowiskowej.',
				],
			},
			lookByAgents: {
				date: '2026-10-09',
				title: 'Kolory i ikony przez API i MCP',
				tag: 'Nowość',
				items: [
					'<strong>Agent nadaje wygląd temu, co proponuje</strong>: kolor i ikonę tabeli w <code>propose_create_table</code>, każdej opcji w <code>propose_add_field</code>, a dla istniejącej tabeli – nowe narzędzie <code>propose_update_look</code>. Osoba zatwierdza, jak przy całej strukturze. <a href="/integrations/mcp/#kolory-i-ikony">Kolory i ikony</a>',
					'<strong>Przez API</strong> tabelę tworzy się z jej kolorem i ikoną; <code>describe_base</code>, <code>describe_table</code> i <code>/meta</code> je zwracają. <a href="/integrations/api-rest/#kolory-i-ikony">Kolory i ikony</a>',
				],
			},
			agentDelete: {
				date: '2026-10-02',
				title: 'Agenci, którzy usuwają, jeśli im na to pozwolisz',
				tag: 'Nowość',
				items: [
					'<strong>Trzeci poziom tokena</strong>, „Odczyt, zapis i usuwanie”: program usuwa przez API REST, agent przez nowe narzędzie <code>delete_record</code> — jeden wiersz na raz, zwracany w odpowiedzi. <a href="/integrations/mcp/#usuwanie-wierszy">Usuwanie wierszy</a>',
					'<strong>Wycofanie się</strong>: <code>restore_record</code> przywraca usunięty wiersz pod jego identyfikatorem; usunięcie, które relacja kaskadowa rozciągnęłaby na inne wiersze, pozostaje zarezerwowane dla interfejsu.',
				],
			},
			tokens: {
				date: '2026-10-02',
				title: 'Tokeny dla tego, kto zarządza bazą',
				tag: 'Nowość',
				items: [
					'<strong>Poziom Zarządzanie wystarczy</strong>: nadany na bazie lub na jej projekcie, pozwala tworzyć tokeny integracji jej baz, bez bycia administratorem. <a href="/integrations/api-rest/#token">Token</a>',
					'<strong>W przeciwnym razie mówi to jasno</strong>: osobie, która czyta lub zapisuje bez zarządzania bazą, okno tokenów mówi, do kogo się zwrócić; kontu bez hasła – czemu nie może go jeszcze utworzyć.',
				],
			},
			advancedFlows: {
				date: '2026-10-02',
				title: 'Automatyzacje, które czekają, przechwytują niepowodzenia i wysyłają PDF-y',
				tag: 'Nowość',
				items: [
					'<strong>Cztery nowe wyzwalacze</strong>: wiersz jest usuwany; wiersz trafia do filtra — „faktura staje się zaległa”; nadchodzi data — trzy dni przed terminem, o 9:00; inne oprogramowanie wywołuje tajny adres automatyzacji. <a href="/fonctionnalites/automatisations/#usługa-wywołująca-basedb">Usługa wywołująca basedb</a>',
					'<strong>Czekaj</strong> trzy dni, albo do daty z pola, a potem wznów, odczytując wiersz na nowo: „jeśli wciąż nie jest zaakceptowana, ponaglić”. <a href="/fonctionnalites/automatisations/#czekaj">Czekaj</a>',
					'<strong>Generuj PDF i wyślij go</strong>: dokument wiersza, zapisany w polu Plik albo załączony do e-maila — w tekście sformatowanym, z adresatami w kopii i adresem odpowiedzi, do każdego albo jednym do wszystkich. <a href="/fonctionnalites/automatisations/#pdf-i-e-mail">PDF i e-mail</a>',
					'<strong>Usuń wiersz, licz i sumuj, uruchom inną automatyzację</strong>; warunek sprawdza też wartość — odpowiedź AI, sumę —, a wyszukiwanie, które niczego nie znajduje, ma własną gałąź.',
					'<strong>Spróbuj</strong>: kroki, i inne, jeśli jeden się nie powiedzie; webhook sam próbuje ponownie, a pętla kontynuuje mimo wiersza w niepowodzeniu. <a href="/fonctionnalites/automatisations/#spróbuj">Spróbuj</a>',
					'<strong>Wszystkie kroki w zasięgu ręki</strong>: <strong>+</strong> otwiera okno podzielone na kategorie, z wyszukiwaniem, zamiast menu, które mogło być obcięte.',
				],
			},
			designer: {
				date: '2026-10-02',
				title: 'Dokumenty PDF w twoich kolorach',
				tag: 'Nowość',
				items: [
					'<strong>Pięć punktów wyjścia</strong> — faktura, wycena, karta danych, zaświadczenie, pusta strona —, zbudowanych z kolumn twojej tabeli: numer, data, kwoty, zdjęcie, powiązane wiersze. <a href="/fonctionnalites/documents/#nowy-szablon">Nowy szablon</a>',
					'<strong>Twoje logo i twoje kolory</strong>: nagłówek z logo i danymi kontaktowymi, stopka z informacjami prawnymi i numerami stron, kolor akcentu, czcionki szeryfowe albo bezszeryfowe, ramka wokół strony. <a href="/fonctionnalites/documents/#nagłówek-i-stopka">Nagłówek i stopka</a>',
					'<strong>Nowe bloki</strong>: tytuł na banerze, obraz, dwie albo trzy kolumny, podsumowanie netto / brutto, tabela z kolorowym nagłówkiem, separator. Przeciąga się je, aby zmienić ich kolejność, a podgląd śledzi każdą zmianę. <a href="/fonctionnalites/documents/#zawartość-bloki">Bloki</a>',
				],
			},
			resilience: {
				date: '2026-10-01',
				title: 'Zerwane połączenie nie zatrzymuje już basedb',
				tag: 'Hosting',
				items: [
					'<strong>Koniec zatrzymań przez zerwane połączenie</strong>: gdy PostgreSQL zamyka połączenie — restart, przerwa w sieci, transakcja, która pozostała bezczynna —, zawodzi tylko zapytanie, które je przytrzymywało; basedb działa dalej, a jego dziennik podaje, jakie zadanie je przytrzymywało.',
					'<strong>Mniej czekania na obciążonej bazie</strong>: strona tabeli nie utrzymuje już otwartej transakcji podczas odczytu powiązanych wierszy, a zapytanie, które nie otrzyma połączenia w ciągu 15 sekund, zwraca błąd, a nie czeka bez końca.',
					'<strong>Nagłówki AI odczytywane tak, jak się je zapisuje</strong>: <code>BASEDB_AI_HEADERS</code> przyjmuje też postać, którą tworzy Ansible, <code>{\'api-key\': \'…\'}</code>, oraz jeden nagłówek na linię; dzięki nim <code>openai_compatible</code> obywa się bez klucza.',
				],
			},
			applications: {
				date: '2026-09-30',
				title: 'Dla aplikacji, które opierają się na basedb',
				tag: 'Nowość',
				items: [
					'<strong>Baza utworzona z szablonu jednym wywołaniem</strong>: serwer stosuje cały szablon — tabele, relacje, wiersze, widoki, automatyzacje —, albo nic, jeśli jeden etap się nie powiedzie. Korzysta z tego galeria, aplikacja, która też się instaluje. <a href="/integrations/api-rest/#tworzenie-bazy-z-szablonu">Tworzenie bazy z szablonu</a>',
					'<strong>Sprawdzanie tokenu</strong>: aplikacja, której przekazano token danej osoby, pyta basedb, czy jest on wciąż aktualny i dla kogo — jej konto, jej grupy. <a href="/integrations/api-rest/#sprawdzanie-tokenu">Sprawdzanie tokenu</a>',
					'<strong>Twoje wewnętrzne serwery</strong>: webhooki i automatyzacje łączą się tylko z tymi, które wymienisz w <code>BASEDB_WEBHOOK_ALLOW</code>, również przez HTTP; program może też śledzić tabelę w czasie rzeczywistym za pomocą tokenu integracji. <a href="/integrations/webhooks/#bez-webhooka-śledzenie-tabeli">Śledzenie tabeli</a>',
					'<strong>Pod ścieżką, za bramą</strong>: basedb publikuje się pod adresem takim jak <code>https://passerelle.example.com/basedb/</code>, niezależnie od tego, czy brama zachowuje ścieżkę, czy ją usuwa. <a href="/hebergement/docker/#za-bramą-pod-ścieżką">Za bramą</a>',
					'<strong>Jeden webhook, wszystkie tabele naraz</strong>: zaznacz lub odznacz zdarzenie dla wszystkich tabel, albo wszystkie zdarzenia dla jednej tabeli, jednym kliknięciem.',
				],
			},
			loopsWebhooks: {
				date: '2026-09-30',
				title: 'Automatyzacje, które przechodzą przez twoje wiersze i rozmawiają z API',
				tag: 'Nowość',
				items: [
					'<strong>Dla każdego wiersza</strong>: krok, który powtarza swoje kroki na każdym wierszu tabeli spełniającym filtr — w każdy poniedziałek ponaglij wszystkie nieopłacone faktury, nie tylko pierwszą. <a href="/fonctionnalites/automatisations/#dla-każdego-wiersza">Dla każdego wiersza</a>',
					'<strong>Webhook, który rozmawia z dowolnym API</strong>: metoda, adres przytaczający wiersz, nagłówki, treść w JSON-ie, formularzu lub tekście, skomponowana z wartości wiersza. <a href="/fonctionnalites/automatisations/#wywołaj-usługę">Wywołaj usługę</a>',
					'<strong>Klucz API pozostaje tajny</strong>: zaszyfrowany, nie jest już nigdy wyświetlany — ani na ekranie, ani przez API, ani Copilotowi — i trafia tylko do hosta, dla którego go podano.',
				],
			},
			maps: {
				date: '2026-09-30',
				title: 'Mapa i adresy, które się znajdują',
				tag: 'Nowość',
				items: [
					'<strong>Dziesiąty widok, mapa</strong>: każdy wiersz w swoim miejscu, według jego adresu albo jego szerokości i długości geograficznej. Pinezka przyjmuje kolor statusu i otwiera szczegóły po kliknięciu. <a href="/fonctionnalites/vues/#mapa">Mapa</a>',
					'<strong>Adres jest lokalizowany raz na zawsze</strong>, przez usługę OpenStreetMap albo tę, którą wybierzesz: pinezki pojawiają się wraz z odpowiedziami, a potem natychmiast. Nieznaleziony adres jest liczony, nigdy nie jest odrzucany bez informacji.',
					'<strong>Format Adres</strong> dla krótkiego tekstu: kliknięcie otwiera go na mapie, a w szczegółach wiersza <strong>Znajdź adres</strong> proponuje odpowiadające pełne adresy. <a href="/fonctionnalites/tables-et-champs/#formaty-wyświetlania">Formaty</a>',
				],
			},
			documents: {
				date: '2026-09-30',
				title: 'Dokumenty PDF z twoich wierszy',
				tag: 'Nowość',
				items: [
					'<strong>Oferta, faktura, karta w PDF</strong>, z menu wiersza: karta do wydruku bez żadnych ustawień, albo szablon — teksty, które przytaczają pola, pola wiersza, tabela powiązanych wierszy z jej sumą, podziały strony. <a href="/fonctionnalites/documents/">Dokumenty</a>',
					'<strong>Każdy z własnymi uprawnieniami</strong>: pole ukryte przed tobą nie występuje w twoim PDF-ie. Pisze się w nim we wszystkich dwudziestu językach, łącznie z chińskim, japońskim i koreańskim, a API zwraca ten sam dokument.',
				],
			},
			rows: {
				date: '2026-09-30',
				title: 'Uprawnienia aż do wiersza, wartości domyślne, import Excela',
				tag: 'Nowość',
				items: [
					'<strong>Każdy swoje wiersze</strong>: grupa widzi tylko wiersze z filtra — „Sprzedawca” to ja, „Region” to Północ —, w interfejsie, w API, na serwerze MCP, jak i w SQL, gdzie tę samą regułę wymusza sam PostgreSQL. <a href="/fonctionnalites/droits/#aż-do-wiersza">Aż do wiersza</a>',
					'<strong>Wartości domyślne</strong>: ustalona wartość, dzisiejsza data, moment utworzenia albo osoba, która tworzy wiersz, wypełnione na ekranie i stosowane wszędzie indziej. <a href="/fonctionnalites/tables-et-champs/#wartości-domyślne">Wartości domyślne</a>',
					'<strong>Przeciągnij skoroszyt Excela</strong>: wybierz arkusz, daty, kwoty i pola wyboru trafiają takie, jakie są, a formuła podaje swoją wartość. <a href="/guides/premiers-pas/">Pierwsze kroki</a>',
				],
			},
			mail: {
				date: '2026-09-30',
				title: 'E-maile',
				tag: 'Nowość',
				items: [
					'<strong>Krok „Wyślij e-mail”</strong> w automatyzacjach: do członka zespołu, do osoby z pola, na adres klienta, z wartościami wiersza w temacie i treści. <a href="/fonctionnalites/automatisations/">Automatyzacje</a>',
					'<strong>Powiadomienia e-mailem</strong>, kiedy ich nie przeczytasz, zebrane w jednym, do wybrania pojedynczo w ustawieniach; a <strong>Nie pamiętam hasła</strong> resetuje je linkiem. <a href="/fonctionnalites/collaboration/#e-mailem">E-mailem</a>',
					'Wystarczy wskazać instancji serwer wysyłki swojej poczty. <a href="/hebergement/variables/#e-maile">Zmienne</a>',
				],
			},
			integrations: {
				date: '2026-09-30',
				title: 'n8n i SDK TypeScript',
				tag: 'Nowość',
				items: [
					'<strong>Węzły do n8n</strong>: odczytywać i zapisywać wiersze tabeli z workflow, i uruchamiać go przy każdym utworzonym, zmienionym lub usuniętym wierszu — przez sprawdzanie albo przez podpisany webhook. <a href="/integrations/n8n/">n8n</a>',
					'<strong>SDK TypeScript</strong>, z typami twoich tabel generowanymi z twojej instancji: nieistniejąca tabela albo pole to błąd, jeszcze zanim program się uruchomi. <a href="/integrations/sdk/">SDK</a>',
				],
			},
			quiz: {
				date: '2026-09-29',
				title: 'Quiz: pytania, które liczą punkty',
				tag: 'Nowość',
				items: [
					'<strong>Nowy widok, quiz</strong>: ankieta, w której każde pytanie może mieć swoją poprawną odpowiedź i punkty — jeden wybór, kilka, tak lub nie, liczba, data, albo akceptowane teksty, bez rozróżniania wielkości liter i znaków diakrytycznych. <a href="/fonctionnalites/vues/#quiz">Quiz</a>',
					'<strong>Poprawiane, jak chcesz</strong>: po każdym pytaniu — na zielono, albo na czerwono z poprawną odpowiedzią, wynik rosnący u góry ekranu —, na końcu, albo nigdy. Próg zaliczenia sprawia, że pada „Zaliczone!” albo „Nie tym razem…”.',
					'<strong>Wynik na końcu</strong>, w wypełniającym się pierścieniu, a potem poprawne odpowiedzi każdego pytania. Zapisuje się w polu liczbowym tabeli: posortuj siatkę według niego, oto ranking.',
					'<strong>Udostępniany linkiem, bez oszukiwania</strong>: strona nie otrzymuje żadnej poprawnej odpowiedzi, to serwer poprawia i liczy. <a href="/fonctionnalites/formulaires-partages/#udostępniony-quiz">Udostępniony quiz</a>',
					'<strong>Utwórz widok</strong>, na dole selektora widoków, dzieli dziewięć rodzajów na dwie rodziny — te, które pokazują wiersze, te, które zbierają odpowiedzi —, każdy z kolorową ikoną.',
				],
			},
			forms: {
				date: '2026-09-29',
				title: 'Formularze, które chce się wypełniać',
				tag: 'Nowość',
				items: [
					'<strong>Ankieta zajmuje cały ekran</strong>: jedno pytanie naraz, pojawiające się z przesunięciem, duże karty dla wyborów, gwiazdki dla oceny, i wszystko z klawiatury — <strong>Enter</strong>, litery A, B, C…, T lub N, cyfry. Pojedynczy wybór sam przechodzi dalej. <a href="/fonctionnalites/vues/#formularz-i-ankieta">Formularz i ankieta</a>',
					'<strong>Własny wygląd</strong>: osiem motywów, od Jasnego po Noc, przez Papier, kolor, czcionka, wyrównanie — strona udostępnionego linku też go nosi.',
					'<strong>Zadaj tylko, jeśli…</strong>: pytanie pojawia się tylko wtedy, gdy wymaga tego wcześniejsza odpowiedź; ukryte pytanie nie jest ani wymagane, ani zapisywane.',
					'<strong>Nic do ustawienia na początek</strong>: nowy formularz pyta o to, co odpowiada dana osoba, a nie o status, który zespół uzupełnia później, nosi kolor swojej tabeli i pokazuje przykład w każdym polu. A wysłanie się świętuje, razem z konfetti.',
				],
			},
			formulaLanguages: {
				date: '2026-09-28',
				title: 'Formuły po francusku lub po angielsku',
				tag: 'Nowość',
				items: [
					'<strong>Wpisz formułę po francusku lub po angielsku</strong>, na każdym ekranie, nawet mieszając obie: <code>SI</code> lub <code>IF</code>, <code>ARRONDI</code> lub <code>ROUND</code>, <code>JOURS</code> lub <code>DAYS</code>… Argumenty rozdziela się <code>;</code> albo <code>,</code>. <a href="/fonctionnalites/tables-et-champs/#formuły">Formuły</a>',
					'<strong>Odczytuje się ją w języku ekranu</strong>: po francusku na francuskim ekranie, po angielsku w pozostałych dziewiętnastu językach — łącznie z istniejącymi formułami i panelem „Funkcje”. API zwraca formułę w żądanym języku, w przeciwnym razie po angielsku.',
					'Oficjalne szablony, udostępniane w innym języku niż francuski, przychodzą z formułami po angielsku. W bazie nic się nie zmienia: te same kolumny, ten sam SQL, bez migracji.',
				],
			},
			search: {
				date: '2026-09-27',
				title: 'Znajdź wszystko: Ctrl+K',
				tag: 'Nowość',
				items: [
					'<strong>Jedno pole na wszystko</strong> — <strong>Ctrl+K</strong>, albo pole na środku górnego paska: tabele, widoki, pytania, pulpity, automatyzacje, kolumny, i same wiersze, odczytywane z twoimi uprawnieniami; na dużym ekranie podgląd wybranego wyniku. <a href="/fonctionnalites/recherche/">Wyszukiwanie</a>',
					'<strong>Pisz, jak myślisz</strong>: bez znaków diakrytycznych i wielkich liter, po inicjałach — <code>nk</code> dla „Nowy klient” —, wybaczona literówka, <code>klienci krakow</code>, by szukać „krakow” w tabeli klientów; to, co często otwierasz, wypływa na górę.',
					'<strong>Wszystkie polecenia z klawiatury</strong>: tworzenie, przechodzenie do, zamykanie, cofanie, zmiana motywu, kopiowanie linku do strony. <code>&gt;</code> szuka tylko poleceń, <code>#</code> obiektów, <code>/</code> wierszy; <strong>Tab</strong> szuka wewnątrz tabeli lub bazy.',
					'<strong>Masz pytanie?</strong> Wpisz je: <strong>Zapytaj Copilota</strong> zadaje je, na otwartej bazie.',
				],
			},
			questions: {
				date: '2026-09-27',
				title: 'Własne pytania, liczby w tekście',
				tag: 'Nowość',
				items: [
					'<strong>Każdy zapisuje własne pytania</strong>, bez poziomu Zarządzanie: osobiste widzisz tylko ty; kto zarządza bazą, udostępnia je całej bazie albo grupom, tak jak zapytania. <a href="/fonctionnalites/tableaux-de-bord/">Pulpity</a>',
					'<strong>Pytanie w zakładce</strong>, obok tabel: <strong>Nowe pytanie</strong> i <strong>Nowe pytanie SQL</strong>, przy <strong>+</strong> na pasku zakładek i w menu bazy; zakładka zachowuje to, co w niej zostawiłeś. <strong>Zapisz kopię</strong> zamienia w twoje pytanie, którego nie możesz zmieniać.',
					'<strong>Liczby w tekście</strong>: tekst pulpitu, teraz sformatowany, przytacza wartość — <code>{{chiffre_affaires}}</code> — pochodzącą z karty, pytania albo filtra, obliczaną z uprawnieniami czytelnika, nawet w pulpicie udostępnionym linkiem. <a href="/fonctionnalites/tableaux-de-bord/#liczby-w-tekście">Liczby w tekście</a>',
					'Zapytania, widoki SQL i pytania można też usunąć z ich menu, prawym kliknięciem.',
				],
			},
			addresses: {
				date: '2026-09-27',
				title: 'Adres dla każdego ekranu',
				tag: 'Nowość',
				items: [
					'<strong>Adres podąża za ekranem</strong>: tabela, widok, szczegóły wiersza, pulpit, automatyzacja, pytanie, twoje ustawienia — <code>/bases/ventes/tables/opportunites?ligne=…</code>. Dodaj go do zakładek, wklej go w wiadomości: trafiasz w to samo miejsce, z własnymi uprawnieniami. <a href="/fonctionnalites/collaboration/#link-do-każdego-ekranu">Link do każdego ekranu</a>',
					'Przyciski <strong>wstecz</strong> i <strong>dalej</strong> w przeglądarce wracają tam, gdzie byłeś; adres, który nigdzie nie prowadzi, pokazuje „Ta strona nie istnieje”.',
				],
			},
			demo: {
				date: '2026-09-27',
				title: 'Demo do wypróbowania, w twoim języku',
				tag: 'Nowość',
				items: [
					'<strong>Demo</strong>, na <a href="https://demo.basedb.eodia.com">demo.basedb.eodia.com</a>: konto jest wypełnione z góry w języku twojej przeglądarki, z bazą w tym języku. Można tam wszystko przeczytać i zmienić to, co istnieje; tworzenie, usuwanie i AI są tam wyłączone, a baza wraca każdej nocy do swojego stanu początkowego.',
					'<strong>Twoje własne demo</strong>: <code>BASEDB_DEMO=1</code> otwiera instancję dla wszystkich, ze wspólnym kontem na język, przygotowanym z wyprzedzeniem. <a href="/hebergement/variables/#publiczne-demo">Zmienne</a>',
					'<strong>Jeden język na link</strong>: <code>?lang=de</code> na końcu adresu basedb pokazuje po niemiecku ekran logowania albo udostępnioną stronę; tak strona prowadzi do demo w języku strony. <a href="/fonctionnalites/droits/#twoje-ustawienia">Twoje ustawienia</a>',
				],
			},
			templateLanguages: {
				date: '2026-09-27',
				title: 'Szablony w twoim języku',
				tag: 'Nowość',
				items: [
					'<strong>Oficjalne szablony tworzy się w języku ekranu</strong>: tabele, pola, opcje wyboru, widoki, pulpity, automatyzacje, polecenia AI — i wiersze przykładowe ze świata dopasowanego do każdego języka: „Boulangerie Martin” z Lyonu staje się „Piekarnią Kowalski” w Krakowie. <a href="/fonctionnalites/modeles/#w-twoim-języku">Szablony</a>',
					'<a href="/modeles/">Galeria na stronie</a> pokazuje każdy szablon w języku strony.',
					'<strong>Jeden szablon, wiele słowników</strong>: szablon pisze się raz, po francusku; każdy język tłumaczy w nim tylko teksty, a basedb sam śledzi każdą etykietę tam, gdzie jest cytowana. Słownik, który uszkodziłby szablon, nie jest używany. <a href="/fonctionnalites/modeles/#publikowanie-szablonu-dla-wszystkich-instancji">Publikowanie szablonu</a>',
				],
			},
			details: {
				date: '2026-09-27',
				title: 'A poza tym',
				items: [
					'<strong>Szablon bez wierszy przykładowych</strong>: „Wczytaj przykładowe dane”, odznaczone, tworzy puste tabele, gotowe na twoje dane. <a href="/fonctionnalites/modeles/#zacznij-od-szablonu">Zacznij od szablonu</a>',
					'<strong>Dokumentacja API i MCP</strong> każdej bazy jest pisana w języku twojego ekranu. <a href="/integrations/api-rest/#generowana-dokumentacja">Generowana dokumentacja</a>',
					'Podpowiedzi w motywie aplikacji, wszędzie, gdzie wcześniej przeglądarka pokazywała swoje własne; „Usuń” w menu na czerwono; pełna data po najechaniu na godzinę komentarza.',
				],
			},
			aiProvider: {
				date: '2026-09-27',
				title: 'AI według twojego wyboru, nawet na twoim serwerze',
				tag: 'Nowość',
				items: [
					'<strong>Czwarty dostawca AI</strong>: każdy serwer, który mówi językiem API OpenAI — Azure, brama firmowa, model działający na twoim własnym serwerze — zadeklarowany w <code>.env</code>. Dziennik wywołań mówi, do kogo trafiły dane. <a href="/fonctionnalites/ia/">AI w basedb</a>',
					'<strong>Ekran logowania</strong> pokazuje teraz, po siatce i SQL, pulpit, który śledzi filtr, oraz automatyzację w trakcie wykonywania, łącznie z krokiem AI.',
				],
			},
			languages: {
				date: '2026-09-27',
				title: 'Tekst sformatowany, zmienne, czytelniejszy kanban',
				tag: 'Nowość',
				items: [
					'<strong>Tekst sformatowany</strong>: nowy typ pola, formatowany w edytorze wizualnym – nagłówki, listy, cytaty, linki –, oczyszczany przy zapisie i chroniony ograniczeniem przed bezpośrednim SQL. <a href="/fonctionnalites/tables-et-champs/#tekst-sformatowany-i-zmienne">Tekst sformatowany i zmienne</a>',
					'<strong>Zmienne</strong>: długi tekst przytacza kolumnę swojego wiersza – <code>{{Ville}}</code> – i wszędzie czyta się z jej wartością: w siatce, szczegółach wiersza, API, serwerze MCP, widokach udostępnionych, automatyzacjach. Kolumna przechowuje odwołanie, które czyta <code>psql</code>.',
					'<strong>Czytelniejszy kanban</strong>: przestronniejsze karty, obraz okładki i opis, który przytacza wartości wiersza – „Dostawa zaplanowana na {{Date}} dla {{Client}}”. <a href="/fonctionnalites/vues/">Widoki</a>',
					'<strong>Zmiana nazwy jednym gestem</strong>: jedno okno dialogowe dla bazy, tabeli lub pola; etykieta zmienia się zawsze, a administrator może też zmienić nazwę w bazie danych, z analizą wpływu. <a href="/fonctionnalites/tables-et-champs/#zmiana-struktury">Zmiana struktury</a>',
					'<strong>Dwadzieścia języków</strong>: interfejs, ta witryna i dokumentacja w językach: francuskim, angielskim, niemieckim, hiszpańskim, włoskim, portugalskim (Brazylia), niderlandzkim, polskim, czeskim, szwedzkim, duńskim, norweskim, fińskim, rumuńskim, węgierskim, tureckim, ukraińskim, japońskim, chińskim uproszczonym i koreańskim. basedb przyjmuje język przeglądarki; <strong>Ustawienia › Wygląd › Język</strong> ustawia inny, który towarzyszy ci na każdym komputerze. Liczby i daty są zgodne z językiem. <a href="/fonctionnalites/droits/#twoje-ustawienia">Twoje ustawienia</a>',
				],
			},
			flows: {
				date: '2026-09-27',
				title: 'Automatyzacje jako przepływy',
				tag: 'Nowość',
				items: [
					'<strong>Edytor grafowy</strong>: wyzwalacz, a potem każdy krok jako karta; <strong>+</strong> na linii dodaje krok w tym miejscu. Prosta automatyzacja nadal mieści się na dwóch kartach. <a href="/fonctionnalites/automatisations/">Automatyzacje</a>',
					'<strong>Znajdź wiersz</strong> – klienta zamówienia, ostatnią niezapłaconą fakturę – a potem go zmień, przytocz, połącz z utworzonym wierszem.',
					'<strong>Warunki z wieloma gałęziami</strong>: wybierana jest pierwsza, której warunek jest spełniony, a „W przeciwnym razie”, gdy żaden nie jest; gałęzie potem się łączą.',
					'<strong>Dane przechodzą z kroku do kroku</strong>: <code>{{e2.client}}</code> przytacza to, co krok znalazł lub utworzył, <code>{{e3.reponse.numero}}</code> – to, co odpowiedział webhook; menu każdego tekstu proponuje tylko to, co na pewno wydarzyło się wcześniej.',
					'<strong>Każde uruchomienie, krok po kroku</strong>: nałożone na przepływ, rysuje wybraną ścieżkę i mówi przy każdym kroku, co zrobił i ile to trwało.',
					'<strong>Copilot automatyzacji</strong>: opisz, co baza ma robić sama, albo zapytaj, dlaczego uruchomienie się nie powiodło; Copilot proponuje całą automatyzację, którą jednym kliknięciem nakładasz na przepływ, przeglądasz i zapisujesz – nic nie zostaje zapisane bez ciebie. <a href="/fonctionnalites/automatisations/#copilot">Copilot</a>',
					'<strong>Zapytaj AI</strong> w kroku, tak jak w polu AI: polecenie, które przytacza wiersz i poprzednie kroki, odpowiedź odczytana jako tekst, liczba, tak lub nie, data albo wybór z listy, którą kolejne kroki zapisują lub wysyłają. <a href="/fonctionnalites/automatisations/#zapytaj-ai">Zapytaj AI</a>',
				],
			},
			dashboards: {
				date: '2026-09-27',
				title: 'Pulpity: pytania, wykresy, filtry',
				tag: 'Nowość',
				items: [
					'<strong>Pytania</strong> zadawane myszą – tabela, jej złączenia, filtry, miary według dnia, tygodnia, miesiąca lub roku – albo pisane w <strong>SQL</strong>, tylko do odczytu i z twoimi własnymi uprawnieniami, łącznie ze zmiennymi. <a href="/fonctionnalites/tableaux-de-bord/">Pulpity</a>',
					'<strong>Piętnaście wizualizacji</strong>: liczba, trend w porównaniu z poprzednim okresem, postęp w kierunku celu, wskaźnik, histogram, słupki, linia, obszary, wykres łączony, kołowy, lejek, punktowy, tabela, tabela przestawna, mapa Francji lub świata.',
					'<strong>Eksploracja jednym kliknięciem</strong>: punkt otwiera swoje wiersze, drobniejszy okres, inny podział.',
					'<strong>Pulpity w siatce</strong>: karty przesuwane i skalowane myszą, zakładki, tytuły sekcji, teksty, osadzone strony.',
					'<strong>Wspólne filtry</strong> – okres, kategoria, tekst, liczba, grupowanie dat – które sterują jedną, kilkoma lub wszystkimi kartami, z wartością domyślną.',
					'<strong>Wykresy po twojemu</strong>: kolor i nazwa każdej serii lub każdego wycinka, pierścień, półokrąg lub wykres różany, skumulowanie z sumami, linie wygładzone lub schodkowe, osie, podziałki, skala logarytmiczna; tabele ze zmienionymi nazwami kolumn, z paskami i kolorami zależnymi od wartości.',
					'<strong>Copilot pulpitów</strong>: rozmowa, która proponuje pytania, zmiany pulpitu – do cofnięcia – i wartości jego filtrów, stosowane jednym kliknięciem. Do dostawcy trafia tylko struktura, chyba że pozwolisz mu czytać wyniki. <a href="/fonctionnalites/tableaux-de-bord/#copilot">Copilot</a>',
					'<strong>Udostępnianie pulpitu</strong> przez link, publiczny lub tylko dla członków – w razie potrzeby wybranych grup – i osadzanie go w innej witrynie: karty i filtry tylko do odczytu, czytane z uprawnieniami osoby, która go opublikowała. <a href="/fonctionnalites/tableaux-de-bord/#udostępnianie-pulpitu">Udostępnianie</a>',
					'„Interfejsy” nazywają się teraz <strong>Pulpity</strong>; istniejące pulpity otwierają się bez zmian, na nowej siatce.',
				],
			},
			sqlViews: {
				date: '2026-09-27',
				title: 'Zapisane zapytania i widoki SQL',
				tag: 'Nowość',
				items: [
					'<strong>SQL dla każdego</strong>: bez poziomu Zarządzanie zakładka SQL wykonuje się tylko do odczytu, z twoimi własnymi uprawnieniami, egzekwowanymi przez sam PostgreSQL – zamknięta tabela nie istnieje, ukryte pole jest odrzucane. Przypomina o tym plakietka „Twoje uprawnienia”. <a href="/fonctionnalites/requetes-et-vues-sql/">Zapytania i widoki SQL</a>',
					'<strong>Zapisane zapytania</strong>, ułożone pod tabelami w sekcji „Zapytania”: osobiste, dla całej bazy lub dla grup. Udostępnienie zapytania udostępnia jego tekst, nigdy to, co może czytać jego autor; otwarte z paska bocznego, wykonuje się od razu, tylko do odczytu.',
					'<strong>Widoki SQL</strong>: prawdziwe widoki PostgreSQL, ułożone wśród tabel z kolorem, ikoną i małym okiem, czytelne także z <code>psql</code> i twoich narzędzi. Każdy czyta je z własnymi uprawnieniami, a pasek boczny pokazuje je tylko osobom, które mogą przeczytać wszystko, co zawierają.',
					'Widoki podążają za strukturą: zmiana nazwy ich nie psuje, zmieniona formuła usuwa je na chwilę, a potem przywraca; widok, który przestaje działać, czeka na poprawienie, z zachowaną definicją.',
				],
			},
			settings: {
				date: '2026-09-27',
				title: 'Twoje ustawienia',
				tag: 'Nowość',
				items: [
					'<strong>Ustawienia</strong>, w menu profilu: twoje imię i nazwisko, adres i dostawcy tożsamości powiązani z kontem; hasło i otwarte sesje. <a href="/fonctionnalites/droits/">Konta i logowanie</a>',
					'<strong>Wygląd</strong>: motyw, kolejność elementów daty – <code>25/09/2026</code> lub <code>2026-09-25</code> – i pierwszy dzień tygodnia w kalendarzach; dwa ostatnie ustawienia towarzyszą ci na każdym komputerze.',
					'<strong>Powiadomienia</strong>: wyłącz te, których już nie chcesz, rodzaj po rodzaju. <strong>Tokeny</strong>: utworzone przez ciebie we wszystkich twoich bazach, ich ostatnie użycie i unieważnianie.',
				],
			},
			v020: {
				date: '2026-09-26',
				title: 'Wersja 0.2.0: każdy ma swoje konto, projekty i zaproszenia',
				tag: 'Nowość',
				items: [
					'<strong>Pierwsze logowanie</strong>: w nowej instancji pierwsza strona tworzy konto administratora, z twoim adresem i hasłem – koniec z domyślnym kontem i hasłem do wyszukiwania w dziennikach. <a href="/guides/installation/">Instalacja</a>',
					'<strong>Tworzenie kont</strong>: każdy tworzy swoje konto, a potem własne projekty, którymi zarządza. Administracja może je wyłączyć lub ograniczyć do wybranych domen. <a href="/hebergement/connexion/">Konta i logowanie</a>',
					'<strong>Udostępnianie projektu lub bazy</strong>: osoba z poziomem Zarządzanie zaprasza przez link, z poziomem Odczyt, Edycja lub Zarządzanie; widzi, kto ma dostęp, zmienia poziom, odbiera go. Nigdy więcej niż to, czym sama zarządza.',
					'<strong>Prywatność</strong>: każdy widzi już tylko osoby, z którymi dzieli projekt, a nazwy projektu zajętej już przez kogoś innego nie da się odgadnąć.',
					'<strong>Logowanie przez Google, Microsoft</strong> i dowolnego dostawcę OpenID Connect (Keycloak, GitLab…), zadeklarowanych w <code>.env</code>; pierwsze logowanie tworzy konto, jeśli pozwala na to ustawienie tworzenia kont. <a href="/hebergement/connexion/">Konfiguracja</a>',
					'<strong>Nowy ekran logowania</strong>, w motywie aplikacji, jasnym lub ciemnym, z powściągliwą animacją; ilustrowane puste ekrany w aplikacji.',
					'<strong>Aktualizacje bez strat</strong>: basedb sam aktualizuje swój katalog przy uruchomieniu, także w instalacji 0.1, i odmawia uruchomienia na bazie, którą zaktualizowała już nowsza wersja. <a href="/hebergement/sauvegardes/">Aktualizacja</a>',
				],
			},
			dockerImage: {
				date: '2026-09-26',
				title: 'Jeden obraz Dockera',
				tag: 'Hosting',
				items: [
					'basedb mieści się w <strong>jednym obrazie</strong>, <code>eodia/basedb</code> w Docker Hub, dla amd64 i arm64: interfejs, API pod <code>/api</code> i serwer MCP pod <code>/mcp</code>, na <strong>jednym porcie</strong>. <a href="/guides/installation/">Instalacja</a>',
					'Wystarczą dwa pliki – <code>docker-compose.yml</code> i <code>.env</code> – bez klonowania repozytorium i budowania czegokolwiek; aktualizacja to <code>docker compose pull</code>.',
					'Za domeną proxy HTTPS nie musi już niczego routować: wszystko trafia na port 3000.',
				],
			},
			automations: {
				date: '2026-09-26',
				title: 'Automatyzacje, interfejsy, formuły, współpraca',
				tag: 'Nowość',
				items: [
					'<strong>Formuły</strong> po francusku – <code>SI</code>, <code>ARRONDI</code>, <code>JOURS</code>… – które stają się kolumnami generowanymi przez PostgreSQL; <strong>odnośniki</strong>, <strong>agregacje</strong> i <strong>zliczania</strong> przez relacje. <a href="/fonctionnalites/tables-et-champs/">Pola</a>',
					'<strong>Nowe typy</strong>: relacja wielokrotna, osoba, e-mail, autonumer, przycisk; oraz formaty wybierane jak typy – waluta, procent, czas trwania, ocena w gwiazdkach, telefon, kod kreskowy.',
					'<strong>Osiem widoków</strong>: <strong>galeria</strong> i <strong>lista</strong> dołączają do sześciu pozostałych; <strong>widoki osobiste</strong> dla każdego czytającego, widoki zablokowane, ręczna kolejność, zależności na osi czasu. <a href="/fonctionnalites/vues/">Widoki</a>',
					'<strong>Siatka</strong>: szybkie wyszukiwanie, grupowanie, podsumowanie kolumny dla całego filtra, kolory według reguł, wysokość wierszy.',
					'<strong>Widoki udostępnione</strong> tylko do odczytu, do osadzenia w innej witrynie; kalendarz staje się <strong>kanałem iCalendar</strong> dla Kalendarza Google, Outlooka czy Kalendarza Apple. <a href="/fonctionnalites/vues-partagees/">Udostępnianie</a>',
					'<strong>Współpraca</strong>: komentarze i wzmianki, powiadomienia, zapisy innych w czasie rzeczywistym, obecność na tabeli i na wierszu. <a href="/fonctionnalites/collaboration/">Praca w zespole</a>',
					'<strong>Ctrl+Z</strong> cofa ostatni zapis – komórkę, przesuniętą kartę, cały import – i odmawia, zamiast nadpisać to, co ktoś inny zmienił w międzyczasie.',
					'<strong>Automatyzacje</strong>: gdy wiersz zostaje utworzony lub zmieniony, o stałej porze albo kliknięciem przycisku – edytuj, utwórz, powiadom, wywołaj webhook, napisz na Slacku. <a href="/fonctionnalites/automatisations/">Automatyzacja</a>',
					'<strong>Interfejsy</strong>: pulpity – liczby, wykresy, listy, teksty – czytane z uprawnieniami każdego. <a href="/fonctionnalites/tableaux-de-bord/">Pulpity</a>',
					'<strong>Integracje</strong>: kanał Slacka i <strong>tabele synchronizowane</strong> z pliku CSV online, kalendarza lub widoku innej instancji basedb. <a href="/integrations/synchronisation/">Integracje</a>',
					'<strong>Szablony baz</strong>: galeria dziesięciu szablonów, baza opisana AI jednym zdaniem i możliwość zapisania każdej bazy jako szablonu. <a href="/modeles/">Galeria</a>',
					'<strong>Uprawnienia</strong>: ekran Struktura przechodzi w tryb tylko do przeglądania dla osób bez poziomu Zarządzanie.',
					'<strong>Nowa identyfikacja wizualna</strong>: logo, paleta kolorów i przebudowany ekran logowania.',
				],
			},
			simpler: {
				date: '2026-09-26',
				title: 'Prostszy interfejs',
				items: [
					'<strong>Pasek boczny</strong> pokazuje już tylko bazy i ich tabele; ekrany otwartej bazy – Struktura, Historia, Interfejsy, Automatyzacje – są zebrane w jednym bloku, tuż nad profilem.',
					'<strong>Menu profilu</strong> mieści to, co nie jest danymi: dokumentację API i MCP, integracje, użytkowników i uprawnienia.',
					'<strong>Zapytanie SQL</strong> otwiera się przez „+” na pasku zakładek lub z menu bazy, bez dublowania na pasku bocznym.',
					'<strong>Nowa baza</strong> proponuje szablony i AI już w oknie dialogowym; baza demonstracyjna przechodzi przez tę samą galerię.',
					'<strong>Ekran nie proponuje już tego, co zostałoby odrzucone</strong>: bez poziomu Zarządzanie nie ma przycisków struktury, bez prawa do usuwania nie ma „Usuń”; a czytający tworzy własne widoki, zamiast trafiać na komunikat o błędzie.',
					'<strong>Kolumny systemowe</strong> są zebrane w grupie „Informacje systemowe”, zamiast być proponowane w każdej tabeli.',
					'<strong>Szczegóły wiersza</strong> zyskują komentarze, przycisk do napisania wiadomości lub zadzwonienia i ocenę ustawianą jednym kliknięciem.',
					'<strong>Ekran logowania</strong> porzuca animowane tło 3D na rzecz lekkiego ekranu, który respektuje preferencję „ogranicz ruch”.',
				],
			},
			environments: {
				date: '2026-09-26',
				title: 'Środowiska, formularze udostępnione, widoki',
				items: [
					'<strong>Środowiska</strong>: produkcyjne, testowe i deweloperskie dla tej samej bazy; porównanie obok siebie, plan migracji, synchronizacja wierszy.',
					'<strong>Historia struktury</strong>: każde utworzenie lub zmiana tabeli i pola, rejestrowane przez wyzwalacz na katalogu.',
					'<strong>Formularze udostępnione</strong>: link publiczny lub tylko dla członków, zamknięcie w wybranym dniu lub po określonej liczbie odpowiedzi, przypisanie odpowiedzi w historii.',
					'<strong>Sześć widoków</strong>: siatka, kanban, kalendarz, oś czasu, formularz, ankieta.',
					'<strong>Historia danych</strong>: cofnięcie zmiany, przywrócenie usuniętego wiersza.',
					'<strong>AI</strong>: opcja AI w dowolnym polu i Copilot.',
					'<strong>Relacja</strong> i <strong>URL</strong>: dwa odrębne typy; długi tekst pisze się w Markdownie.',
					'<strong>Webhooki</strong> podpisane i uporządkowane, <strong>propozycje agentów</strong> do zatwierdzenia.',
					'<strong>Docker</strong>: Dockerfile z trzema celami, kompletny docker-compose, opcjonalne proxy HTTPS.',
				],
			},
			projects: {
				date: '2026-09-25',
				title: 'Projekty, uprawnienia, serwer MCP',
				items: [
					'<strong>Projekty</strong> nad bazami i uprawnienia według <strong>grup</strong> na czterech poziomach: Brak dostępu, Odczyt, Edycja, Zarządzanie.',
					'<strong>Konta</strong>: hasło tymczasowe, zmiana przy pierwszym logowaniu, sesja uprzywilejowana dla administracji.',
					'<strong>Serwer MCP</strong> i przekaźnik stdio; <strong>tokeny integracji</strong> wspólne dla API REST i MCP.',
					'<strong>Generowana dokumentacja</strong> „API i MCP” dla każdej bazy.',
				],
			},
			fields: {
				date: '2026-09-20',
				title: 'Pola, pojedyncze wybory, import',
				items: [
					'Edycja pola i opcji pojedynczego wyboru.',
					'<strong>Import</strong> plików CSV i JSON.',
					'Menu tabeli: zmiana nazwy, opis, usuwanie.',
				],
			},
			firstCommit: {
				date: '2026-09-20',
				title: 'Pierwszy commit',
				items: [
					'Monorepo: nazewnictwo, rejestr kodów błędów, katalog wyodrębniony z dokumentu architektury, rdzeń, API, interfejs.',
				],
			},
		},
	},
	roadmap: {
		label: 'Plan rozwoju',
		title: 'Co dalej',
		intro: 'basedb jest w fazie aktywnego rozwoju. Ta strona mówi, czego jeszcze brakuje, bez obiecanych terminów. Masz pomysł, potrzebę? <a href="https://github.com/eodia/basedb/issues">Otwórz zgłoszenie</a>. Co już jest: <a href="/nouveautes/">nowości</a>.',
		columns: {
			next: {
				title: 'Wkrótce',
				items: {
					restoreTable: {
						title: 'Przywracanie pojedynczej tabeli',
						text: 'Usunięta tabela pozostaje czytelna w SQL pod swoją odsuniętą nazwą; przywrócenie jej samej z poziomu interfejsu jest w planach.',
					},
					aiSettings: {
						title: 'Ustawienia AI w interfejsie',
						text: 'Dostawca, model i klucz dla każdej przestrzeni roboczej, bez przechodzenia przez zmienne środowiskowe API.',
					},
					mail: {
						title: 'Powiadomienia i zaproszenia e-mailem',
						text: 'Wzmianki, odpowiedzi i wskazania trafiają dziś do basedb, a zaproszenia – jako link do samodzielnego wysłania; będą mogły też wychodzić e-mailem.',
					},
				},
			},
			later: {
				title: 'Później',
				items: {
					formLinks: {
						title: 'Relacje i pliki w formularzach udostępnionych',
						text: 'Ograniczone wyszukiwanie w powiązanej tabeli, ograniczone przesyłanie plików dla anonimowych osób.',
					},
					moreEvents: {
						title: 'Więcej zdarzeń z powiadomieniem',
						text: 'Powiadomienie o odpowiedzi na formularz, propozycji agenta, wyłączonym webhooku.',
					},
					sqlViewsAcross: {
						title: 'Widoki SQL między środowiskami',
						text: 'Kopiowanie widoków SQL razem ze strukturą przy tworzeniu lub porównywaniu środowisk oraz w szablonach baz.',
					},
					loops: {
						title: 'Pełne przepływy w szablonach baz',
						text: 'Przenoszenie przepływów automatyzacji — warunków, wyszukiwań, pętli, oczekiwań, PDF-ów — do szablonów baz, które dziś zachowują z nich tylko proste kroki.',
					},
					textFormulas: {
						title: 'Formuły tekstowe',
						text: 'Wyodrębnianie, zastępowanie lub przycinanie fragmentu tekstu.',
					},
					bulk: {
						title: 'Deklarowane operacje masowe',
						text: 'Zmiany tysięcy wierszy, rejestrowane w historii jako jedna operacja.',
					},
					tombstones: {
						title: 'Czyszczenie znaczników usunięcia',
						text: 'Usuwanie śladów usunięć, które nie są już potrzebne.',
					},
				},
			},
		},
	},
	gallery: {
		label: 'Szablony',
		title: 'Baza gotowa w kilka sekund',
		intro: 'Każdy szablon tworzy powiązane ze sobą tabele, przykładowe wiersze, widoki, pulpit, automatyzacje – i pola, które AI wypełnia sama. W basedb: <strong>Nowa baza</strong>, a potem <strong>Zacznij od szablonu</strong>. Nic nie pasuje? Opisz swoją potrzebę jednym zdaniem: AI zaproponuje bazę szytą na miarę.',
		filter: 'Filtruj według kategorii',
		all: 'Wszystkie',
		otherCategory: 'Inne',
		ai: '✦ AI',
		tables: {
			one: '{n} tabela',
			few: '{n} tabele',
			many: '{n} tabel',
			other: '{n} tabeli',
		},
		rows: {
			one: '{n} wiersz',
			few: '{n} wiersze',
			many: '{n} wierszy',
			other: '{n} wiersza',
		},
		views: {
			one: '{n} widok',
			few: '{n} widoki',
			many: '{n} widoków',
			other: '{n} widoku',
		},
		howtoTitle: 'Pisanie szablonów w JSON',
		howto: 'Szablon to plik JSON: jego tabele, pola, relacje, wiersze, widoki, pulpity, automatyzacje i polecenia jego pól AI. Szablony z tej strony to pliki z folderu <a href="https://github.com/eodia/basedb/tree/main/packages/templates/catalog"><code>packages/templates/catalog</code></a> repozytorium; każda instancja basedb czyta <a href="/modeles/catalogue.json"><code>catalogue.json</code></a> i proponuje je swoim użytkownikom. Administrator może też zaimportować własne szablony do swojej instancji, a każdą bazę można zapisać jako szablon.',
		format: {
			href: '/fonctionnalites/modeles/',
			label: 'Format szablonów →',
		},
		back: '← Wszystkie szablony',
		defaultCategory: 'Szablon',
		sampleRows: {
			one: '{n} przykładowy wiersz',
			few: '{n} przykładowe wiersze',
			many: '{n} przykładowych wierszy',
			other: '{n} przykładowego wiersza',
		},
		aiTitle: 'Co oblicza AI',
		useTitle: 'Użyj tego szablonu',
		useSteps: [
			'W basedb: <strong>Nowa baza</strong>.',
			'<strong>Zacznij od szablonu</strong>, a potem „{label}”.',
		],
		create: '<strong>Utwórz bazę</strong>.',
		createWithAi: '<strong>Utwórz bazę</strong> – zgadzając się, jeśli chcesz, na obliczanie pól AI przez twojego dostawcę AI.',
		download: 'Pobierz JSON',
		downloadNote: 'Aby zaimportować go do swojej instancji albo dostosować przed zgłoszeniem do katalogu.',
		viewMeta: '– {kind}, {table}',
		dashboard: '<strong>Pulpit</strong> „{label}” – {blocks}',
		blocks: {
			one: '{n} karta',
			few: '{n} karty',
			many: '{n} kart',
			other: '{n} karty',
		},
		automation: '<strong>Automatyzacja</strong> „{label}”',
		yes: 'Tak',
		no: 'Nie',
		me: 'Ty',
		kinds: {
			short_text: 'Krótki tekst',
			long_text: 'Długi tekst',
			rich_text: 'Tekst sformatowany',
			number: 'Liczba',
			boolean: 'Pole wyboru',
			date: 'Data',
			datetime: 'Data i godzina',
			select: 'Pojedynczy wybór',
			multi_select: 'Wielokrotny wybór',
			url: 'URL',
			email: 'E-mail',
			user: 'Osoba',
			autonumber: 'Autonumer',
			formula: 'Formuła',
			lookup: 'Odnośnik',
			rollup: 'Agregacja',
			count: 'Zliczanie',
			button: 'Przycisk',
			link: 'Relacja',
			multi_link: 'Relacja wielokrotna',
		},
		viewKinds: {
			grid: 'Siatka',
			kanban: 'Kanban',
			calendar: 'Kalendarz',
			timeline: 'Oś czasu',
			gallery: 'Galeria',
			list: 'Lista',
			form: 'Formularz',
		},
	},
	templates: {
		demo: {
			label: 'Demo: Atelier Lumen',
			summary: 'Mała agencja, jej klienci, projekty, zadania, faktury i opinie: wszystkie oblicza basedb w jednej bazie.',
			description: 'Baza demonstracyjna. Atelier Lumen to fikcyjna agencja projektowa. Jej baza pokazuje relacje między tabelami, odnośniki i agregacje (przychody na klienta, średnia ocena), formuły (kwota brutto, opóźnienie), trzy pola obliczane przez AI na opiniach klientów (wydźwięk, temat, sugerowana odpowiedź), każdy rodzaj widoku – siatkę, kanban, kalendarz, oś czasu z zależnościami, galerię, listę, formularz –, pulpit i dwie automatyzacje.',
			category: 'Demonstracja',
			tags: ['AI', 'Relacje', 'Wszystkie widoki', 'Pulpit'],
		},
		'analyse-avis': {
			label: 'Analiza opinii klientów',
			summary: 'Zbieraj opinie i pozwól AI wydobyć z nich wydźwięk, tematy, pilność i szkic odpowiedzi.',
			description: 'Dla sklepu, restauracji lub marki: opinie napływają z formularza publicznego lub z importu, a AI czyta każdą z nich. Klasyfikuje wydźwięk, rozpoznaje główny temat, oznacza te, które wymagają szybkiej odpowiedzi, wyodrębnia sugestię klienta i przygotowuje odpowiedź do przejrzenia. Produkty agregują swoją średnią ocenę i liczbę opinii; pulpit śledzi zadowolenie klientów.',
			category: 'Relacje z klientami',
			tags: ['AI', 'Formularz', 'Pulpit'],
		},
		'base-connaissances': {
			label: 'Baza wiedzy',
			summary: 'Artykuły pomocy i pytania klientów: AI streszcza, klasyfikuje i proponuje odpowiedź na podstawie artykułów.',
			description: 'Dla działu wsparcia. Artykuły pomocy są uporządkowane według kategorii i śledzone w czasie; pytania klientów napływają przez formularz publiczny. AI streszcza każdy artykuł i ocenia jego poziom, klasyfikuje każde pytanie i przygotowuje szkic odpowiedzi do przejrzenia.',
			category: 'Wsparcie',
			tags: ['AI', 'Formularz', 'Lista'],
		},
		'calendrier-editorial': {
			label: 'Kalendarz redakcyjny',
			summary: 'Artykuły, posty i newslettery zaplanowane w kalendarzu; AI proponuje zajawki i słowa kluczowe.',
			description: 'Dla zespołu marketingu lub redakcji. Każda treść przechodzi od pomysłu do publikacji, ma swoje miejsce w kalendarzu publikacji i należy do kampanii. AI proponuje zajawkę i słowa kluczowe na podstawie briefu, a formularz pozwala całej firmie zgłosić temat.',
			category: 'Marketing',
			tags: ['AI', 'Kalendarz', 'Kanban', 'Formularz'],
		},
		crm: {
			label: 'CRM sprzedażowy',
			summary: 'Firmy, kontakty i szanse sprzedaży: lejek sprzedaży, historia kontaktów i AI, która podpowiada kolejny krok.',
			description: 'Lekki CRM dla zespołu handlowego. Szanse sprzedaży przechodzą przez lejek, mają kwotę ważoną prawdopodobieństwem, a AI ocenia ich ryzyko i na podstawie notatek podpowiada kolejne działanie. Kontakty z klientami są rejestrowane i streszczane, a firmy agregują to, co reprezentują.',
			category: 'Sprzedaż',
			tags: ['AI', 'Lejek sprzedaży', 'Kanban', 'Kalendarz'],
		},
		evenements: {
			label: 'Wydarzenia i zapisy',
			summary: 'Konferencje, warsztaty i webinary: zapisy, wolne miejsca i opinie uczestników czytane przez AI.',
			description: 'Do organizowania cyklicznych wydarzeń. Każde wydarzenie liczy zapisanych uczestników i wolne miejsca; zapisy przechodzą kolejne etapy aż do obecności. Po wydarzeniu uczestnicy zostawiają opinię, którą AI klasyfikuje według wydźwięku i streszcza. Formularz publiczny pozwala dołączyć do listy mailingowej.',
			category: 'Wydarzenia',
			tags: ['AI', 'Kalendarz', 'Formularz', 'Agregacje'],
		},
		'gestion-projet': {
			label: 'Zarządzanie projektami',
			summary: 'Projekty, zadania i kamienie milowe: harmonogram, zależności między zadaniami, kanban i kalendarz.',
			description: 'Do prowadzenia kilku projektów równolegle. Każdy projekt agreguje swoje zadania i godziny; zadania śledzi się na kanbanie i planuje na osi czasu, która rysuje ich zależności, a kamienie milowe widać w kalendarzu. AI przygotowuje dla kierownictwa raport o stanie projektu na podstawie jego opisu i postępu.',
			category: 'Organizacja',
			tags: ['Oś czasu', 'Zależności', 'Kanban', 'AI'],
		},
		inventaire: {
			label: 'Inwentarz i magazyn',
			summary: 'Artykuły, dostawcy i ruchy magazynowe: stan liczy się sam, a braki widać z wyprzedzeniem.',
			description: 'Dla warsztatu, sklepu lub działu administracyjnego. Każde przyjęcie lub wydanie to ruch magazynowy; stan każdego artykułu jest ich sumą, jego wartość – formułą, a artykuły poniżej progu pojawiają się w widoku „À commander” (do zamówienia). AI przygotowuje opis każdego artykułu na podstawie jego nazwy i kategorii.',
			category: 'Operacje',
			tags: ['Agregacje', 'Formuły', 'Galeria', 'AI'],
		},
		recrutement: {
			label: 'Rekrutacja',
			summary: 'Otwarte stanowiska, kandydaci i rozmowy; AI podsumowuje każdą aplikację i podpowiada, co warto zgłębić.',
			description: 'Śledzenie rekrutacji, od aplikacji do zatrudnienia. Kandydaci aplikują przez formularz publiczny, przechodzą kolejne etapy na kanbanie, a rozmowy planuje się w kalendarzu. AI czyta list motywacyjny i notatki: podsumowanie i pytania do zadania podczas rozmowy. Pomaga czytać, nie decyduje.',
			category: 'Zasoby ludzkie',
			tags: ['AI', 'Formularz', 'Kanban', 'Kalendarz'],
		},
		'suivi-tickets': {
			label: 'Obsługa zgłoszeń',
			summary: 'Błędy i prośby sortowane przez AI, śledzone sprint po sprincie aż do rozwiązania, z formularzem zgłoszeniowym.',
			description: 'System zgłoszeń dla zespołu produktowego. Każde zgłoszenie jest przypisane do komponentu i sprintu; AI proponuje kategorię, szacuje wagę i streszcza zgłoszenie. Kanban śledzi postęp, oś czasu pokazuje sprinty, formularz pozwala każdemu zgłosić problem, a automatyzacja zapisuje datę rozwiązania.',
			category: 'Produkt i technologia',
			tags: ['AI', 'Kanban', 'Formularz', 'Sprinty'],
		},
	},
} satisfies DeepPartial<Dict>;
