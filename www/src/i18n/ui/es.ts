/**
 * The Spanish texts of the landing pages, laid over the French ones (`fr.ts`).
 *
 * See `../README.md`.
 */
import type { DeepPartial, Dict } from './index';

export default {
	meta: {
		home: {
			title: 'basedb — la base colaborativa en la que cada tabla es una tabla PostgreSQL real',
			description: 'Cuadrículas y diez vistas, fórmulas, formularios, cuestionarios y vistas compartidos, comentarios, automatizaciones, paneles, permisos a nivel de campo, historial completo, API REST y servidor MCP — sobre tablas PostgreSQL reales, con nombres legibles. Autoalojado, AGPL-3.0.',
		},
		changelog: {
			title: 'Novedades — basedb',
			description: 'Lo que ha cambiado en basedb, versión tras versión.',
		},
		roadmap: {
			title: 'Hoja de ruta — basedb',
			description: 'Lo próximo que hará basedb.',
		},
		gallery: {
			title: 'Plantillas — basedb',
			description: 'Bases listas para usar: seguimiento de tickets, análisis de reseñas, CRM, selección de personal… con sus filas de ejemplo, sus vistas, sus paneles y sus campos calculados por la IA.',
		},
		template: {
			title: '{label} — plantillas de basedb',
		},
	},
	eodia: {
		home: 'https://eodia.com/',
		about: 'https://eodia.com/about/',
		contact: 'https://eodia.com/contact/',
	},
	demo: {
		short: 'Demo',
		cta: 'Probar la demo',
	},
	nav: {
		aria: 'Navegación principal',
		home: 'basedb — inicio',
		links: [
			{
				href: '/#fonctionnalites',
				label: 'Funciones',
			},
			{
				href: '/modeles/',
				label: 'Plantillas',
			},
			{
				href: '/guides/introduction/',
				label: 'Documentación',
			},
			{
				href: '/nouveautes/',
				label: 'Novedades',
			},
		],
		developers: 'Desarrolladores',
		github: 'El repositorio de basedb en GitHub',
		install: 'Instalar',
		menu: {
			open: 'Abrir el menú',
			close: 'Cerrar el menú',
			features: {
				label: 'Funciones',
				groups: {
					organize: {
						title: 'Organizar',
						items: {
							tables: {
								href: '/fonctionnalites/tables-et-champs/',
								title: 'Tablas y campos',
								text: 'Campos para todo, relaciones, fórmulas como en una hoja de cálculo.',
							},
							views: {
								href: '/fonctionnalites/vues/',
								title: 'Diez vistas',
								text: 'Cuadrícula, kanban, calendario, cronología, galería, lista, mapa, formulario, encuesta, cuestionario.',
							},
							forms: {
								href: '/fonctionnalites/formulaires-partages/',
								title: 'Formularios',
								text: 'Un enlace para compartir: cada respuesta se convierte en una fila.',
							},
							files: {
								href: '/fonctionnalites/fichiers/',
								title: 'Archivos e imágenes',
								text: 'Presupuestos, fotos, contratos, guardados junto a su fila.',
							},
						},
					},
					collaborate: {
						title: 'Colaborar',
						items: {
							live: {
								href: '/fonctionnalites/collaboration/',
								title: 'Tiempo real y comentarios',
								text: 'Ver a los demás trabajar, comentar una fila, mencionar a un compañero.',
							},
							rights: {
								href: '/fonctionnalites/droits/',
								title: 'Permisos y equipos',
								text: 'Quién ve qué y quién modifica qué, hasta la columna.',
							},
							history: {
								href: '/fonctionnalites/historique/',
								title: 'Historial',
								text: 'Cada cambio guardado, y reversible.',
							},
							shared: {
								href: '/fonctionnalites/vues-partagees/',
								title: 'Vistas compartidas',
								text: 'Una vista por enlace, en tu sitio web o en tu agenda.',
							},
						},
					},
					automate: {
						title: 'Automatizar y analizar',
						items: {
							automations: {
								href: '/fonctionnalites/automatisations/',
								title: 'Automatizaciones',
								text: 'Cuando una fila cambia: avisar, crear, escribir, preguntar a la IA.',
							},
							dashboards: {
								href: '/fonctionnalites/tableaux-de-bord/',
								title: 'Paneles',
								text: 'Quince visualizaciones, filtros comunes, un enlace para compartir.',
							},
							ai: {
								href: '/fonctionnalites/ia/',
								title: 'IA y Copilot',
								text: 'Una base en una frase, campos que se rellenan solos.',
							},
							templates: {
								href: '/modeles/',
								title: 'Plantillas',
								text: 'Diez bases listas para usar, para adaptar.',
							},
						},
					},
				},
				feature: {
					tag: 'Novedad',
					title: 'Las automatizaciones en flujo',
					text: 'Buscar, decidir, preguntar a la IA: un editor en forma de grafo, y cada ejecución se repasa paso a paso.',
					href: '/nouveautes/',
					cta: 'Todas las novedades',
				},
				all: 'Todas las funciones',
			},
			solutions: {
				label: 'Soluciones',
				title: 'Para cada equipo',
				items: {
					crm: {
						team: 'Ventas',
						text: 'Pipeline, contactos, seguimientos.',
					},
					recrutement: {
						team: 'Recursos humanos',
						text: 'Candidaturas, entrevistas, síntesis por la IA.',
					},
					'calendrier-editorial': {
						team: 'Marketing',
						text: 'Artículos, publicaciones y newsletters planificados.',
					},
					inventaire: {
						team: 'Operaciones',
						text: 'Existencias calculadas, roturas de stock vistas con antelación.',
					},
					'gestion-projet': {
						team: 'Proyectos',
						text: 'Hitos, tareas y dependencias.',
					},
					'suivi-tickets': {
						team: 'Producto',
						text: 'Errores y solicitudes clasificados por la IA.',
					},
					'base-connaissances': {
						team: 'Soporte',
						text: 'Artículos de ayuda, preguntas, respuestas propuestas.',
					},
					evenements: {
						team: 'Eventos',
						text: 'Inscripciones, plazas, opiniones.',
					},
					'analyse-avis': {
						team: 'Relación con el cliente',
						text: 'Reseñas leídas y clasificadas por la IA.',
					},
				},
				ask: {
					title: '¿Tienes otra cosa en mente?',
					text: 'Describe lo que necesitas en una frase: la IA te propone una base a medida.',
					href: '/modeles/',
				},
				all: 'Todas las plantillas',
			},
			developers: {
				label: 'Desarrolladores',
				groups: {
					build: {
						title: 'Integrar',
						items: {
							api: {
								href: '/integrations/api-rest/',
								title: 'API REST',
								text: 'Los mismos datos que la interfaz, descritos en OpenAPI 3.1.',
							},
							mcp: {
								href: '/integrations/mcp/',
								title: 'Servidor MCP',
								text: 'Herramientas para tus agentes de IA, bajo tus permisos.',
							},
							webhooks: {
								href: '/integrations/webhooks/',
								title: 'Webhooks',
								text: 'Cada escritura, firmada, ordenada, reintentada.',
							},
							sql: {
								href: '/integrations/sql/',
								title: 'SQL directo',
								text: 'Tablas PostgreSQL reales, con nombres legibles.',
							},
							sync: {
								href: '/integrations/synchronisation/',
								title: 'Sincronización',
								text: 'Tablas mantenidas al día desde otro lugar.',
							},
						},
					},
					host: {
						title: 'Alojar',
						items: {
							docker: {
								href: '/hebergement/docker/',
								title: 'Docker Compose',
								text: 'Una imagen, una base PostgreSQL, un solo puerto.',
							},
							env: {
								href: '/hebergement/variables/',
								title: 'Variables',
								text: 'Todo se configura en el archivo .env.',
							},
							https: {
								href: '/hebergement/https/',
								title: 'Dominio y HTTPS',
								text: 'Detrás de tu proxy, o con el Caddy incluido.',
							},
							sso: {
								href: '/hebergement/connexion/',
								title: 'Inicio de sesión y SSO',
								text: 'Google, Microsoft, cualquier proveedor OpenID Connect.',
							},
							backup: {
								href: '/hebergement/sauvegardes/',
								title: 'Copias de seguridad y actualizaciones',
								text: 'pg_dump, y actualizaciones sin pérdidas.',
							},
						},
					},
				},
				feature: {
					title: 'La página para desarrolladores',
					text: 'Una tabla PostgreSQL real detrás de cada cuadrícula.',
					href: '/developpeurs/',
				},
			},
			resources: {
				label: 'Recursos',
				groups: {
					learn: {
						title: 'Aprender',
						items: {
							docs: {
								href: '/guides/introduction/',
								title: 'Documentación',
								text: 'Todo basedb, paso a paso.',
							},
							start: {
								href: '/guides/premiers-pas/',
								title: 'Primeros pasos',
								text: 'Una primera base, de la importación a la vista.',
							},
							install: {
								href: '/guides/installation/',
								title: 'Instalación',
								text: 'Dos archivos y un comando.',
							},
							principles: {
								href: '/architecture/principes/',
								title: 'Los principios',
								text: 'Cómo está construido basedb, y por qué.',
							},
						},
					},
					follow: {
						title: 'Seguir el proyecto',
						items: {
							news: {
								href: '/nouveautes/',
								title: 'Novedades',
								text: 'Lo que ha cambiado, versión tras versión.',
							},
							roadmap: {
								href: '/feuille-de-route/',
								title: 'Hoja de ruta',
								text: 'Lo que viene después.',
							},
							github: {
								href: 'https://github.com/eodia/basedb',
								title: 'GitHub',
								text: 'El código, los tickets, las versiones.',
							},
							eodia: {
								href: 'https://eodia.com/',
								title: 'Eodia',
								text: 'El estudio que hace basedb.',
							},
						},
					},
				},
			},
		},
	},
	language: {
		label: 'Idioma',
		current: 'Idioma: {name}',
	},
	footer: {
		tagline: 'La base colaborativa en la que cada tabla es una tabla PostgreSQL real.',
		madeBy: 'Software libre de <a class="eodia" href="https://eodia.com/">Eodia</a>, estudio de software nativo de IA.',
		columns: {
			product: {
				title: 'Producto',
				links: [
					{
						href: '/#fonctionnalites',
						label: 'Funciones',
					},
					{
						href: '/nouveautes/',
						label: 'Novedades',
					},
					{
						href: '/feuille-de-route/',
						label: 'Hoja de ruta',
					},
					{
						href: '/#faq',
						label: 'Preguntas frecuentes',
					},
				],
			},
			docs: {
				title: 'Documentación',
				links: [
					{
						href: '/guides/introduction/',
						label: 'Introducción',
					},
					{
						href: '/guides/installation/',
						label: 'Instalación',
					},
					{
						href: '/integrations/api-rest/',
						label: 'API REST',
					},
					{
						href: '/integrations/mcp/',
						label: 'Servidor MCP',
					},
				],
			},
			hosting: {
				title: 'Alojamiento',
				links: [
					{
						href: '/hebergement/docker/',
						label: 'Docker Compose',
					},
					{
						href: '/hebergement/variables/',
						label: 'Variables de entorno',
					},
					{
						href: '/hebergement/https/',
						label: 'Dominio y HTTPS',
					},
					{
						href: '/hebergement/sauvegardes/',
						label: 'Copias de seguridad',
					},
				],
			},
			project: {
				title: 'Proyecto',
				links: [
					{
						href: 'https://github.com/eodia/basedb',
						label: 'GitHub',
					},
					{
						href: 'https://github.com/eodia/basedb/tree/main/docs/architecture',
						label: 'Documento de arquitectura',
					},
					{
						href: 'https://github.com/eodia/basedb/blob/main/LICENSE',
						label: 'Licencia AGPL-3.0',
					},
					{
						href: 'https://github.com/eodia/basedb/issues',
						label: 'Informar de un problema',
					},
				],
			},
			eodia: {
				title: 'Eodia',
				links: [
					{
						href: 'https://eodia.com/',
						label: 'El estudio',
					},
					{
						href: 'https://eodia.com/about/',
						label: 'Quiénes somos',
					},
					{
						href: 'https://eodia.com/contact/',
						label: 'Contacto',
					},
				],
			},
		},
		copyright: '© {year} <a href="https://eodia.com/">Eodia</a> · AGPL-3.0-or-later',
		builtWith: 'Sitio creado con Astro y Starlight.',
	},
	docsFooter: {
		madeBy: 'basedb es software libre de <a href="https://eodia.com/">Eodia</a>, estudio de software nativo de IA.',
	},
	teams: {
		meta: {
			title: 'basedb — la base colaborativa de todo el equipo',
			description: 'Todo tu trabajo en un solo lugar, modificado por todo el equipo a la vez: en tabla, en kanban o en calendario, con formularios, paneles, automatizaciones e IA. Sin código, libre y gratuito.',
		},
		hero: {
			eyebrow: 'basedb',
			title: 'Todo tu trabajo.',
			titleAccent: 'Por fin en un solo lugar.',
			lead: 'Tablas, calendarios, formularios, paneles y automatizaciones, para todo el equipo. Tan sencillo como una hoja de cálculo. Sin una línea de código.',
			primary: 'Descubrir las plantillas',
			secondary: 'Ver la demo',
			facts: ['Sin código', 'Libre y gratuito', 'Tus datos, en tu casa'],
		},
		story: {
			grid: {
				title: 'Todo el equipo, en la misma tabla.',
				text: 'Cada uno trabaja en ella a la vez, y todos ven lo mismo, al día.',
			},
			copilot: {
				title: 'Pregunta. El Copilot se encarga.',
				text: '«¿A quién debo dar seguimiento esta semana?» — te propone el filtro adecuado, y lo aplicas con un clic.',
			},
			kanban: {
				title: 'Arrastra. Ya está al día.',
				text: 'Cada etapa se convierte en una columna; mover una tarjeta es modificar la fila.',
			},
			calendar: {
				title: 'Cada fecha en su sitio.',
				text: 'Las citas se muestran solas, y te siguen hasta en tu agenda.',
			},
			dashboard: {
				title: 'Y todo, de un vistazo.',
				text: 'Los números se calculan solos, a partir de las mismas filas.',
			},
		},
		stage: {
			aria: 'El seguimiento de clientes de un equipo en basedb: tabla, Copilot, kanban, calendario, panel',
			tabs: {
				grid: 'Tabla',
				copilot: 'Copilot',
				kanban: 'Kanban',
				calendar: 'Calendario',
				dashboard: 'Panel',
			},
			project: 'Proyecto principal',
			projectMeta: 'Proyecto · 2 bases',
			filterNav: 'Filtrar la navegación',
			base: 'Ventas',
			otherBase: 'Soporte',
			tables: ['Clientes', 'Contactos', 'Presupuestos'],
			baseSection: 'Base · Ventas',
			screens: ['Paneles', 'Automatizaciones'],
			user: 'Léa Martin',
			views: { grid: 'Todas las filas', kanban: 'Por etapa', calendar: 'Citas' },
			toolbar: {
				filter: 'Filtrar',
				columns: 'Columnas',
				group: 'Agrupar',
				colors: 'Colores',
				sort: 'Ordenar',
				configure: 'Configurar',
			},
			search: 'Buscar…',
			add: 'Añadir',
			columns: {
				name: 'Cliente',
				status: 'Etapa',
				owner: 'A cargo de',
				amount: 'Importe',
				next: 'Próxima cita',
			},
			statuses: {
				contact: 'Por contactar',
				meeting: 'Cita',
				quote: 'Presupuesto enviado',
				signed: 'Firmado',
			},
			clients: [
				'Panadería Martin',
				'Clínica Los Tilos',
				'Instituto Jean Moulin',
				'Bici Solidaria',
				'La Tienda Gourmet',
				'Forjas del Ebro',
				'Taller Moreau',
			],
			addRow: 'Añadir una fila',
			perPage: 'Filas por página',
			card: 'A cargo de {owner}, cita el {date}',
			addCard: 'Añadir una tarjeta',
			today: 'Hoy',
			month: 'Mes',
			week: 'Semana',
			dashboards: 'Paneles',
			questions: 'Preguntas',
			dashboard: 'Seguimiento comercial',
			dashboardText: 'Lo esencial de un vistazo.',
			dashboardTabs: ['Vista general', 'Actividad'],
			period: 'Periodo',
			thisYear: 'Este año',
			share: 'Compartir',
			edit: 'Editar',
			explore: 'Explorar los datos',
			chart: 'Importe por cliente',
			byStage: 'Clientes por etapa',
			kpis: {
				signed: 'Firmado',
				pending: 'Presupuestos pendientes',
				rate: 'Clientes firmados',
			},
			copilot: {
				question: '¿A quién debo dar seguimiento esta semana?',
				thinking: 'Pensando…',
				answer: 'Cuatro clientes esperan una respuesta: dos presupuestos enviados y dos citas por preparar.',
				card: 'Filtrar Clientes',
				filter: 'Etapa: Presupuesto enviado o Cita',
				apply: 'Aplicar el filtro',
				applied: 'Filtro aplicado',
				placeholder: 'Pregúntale al Copilot…',
				filtered: '{n} filas filtradas',
			},
		},
		teaser: {
			tabs: { label: 'Elegir el vídeo', short: 'En un minuto', full: 'El recorrido completo' },
			titleAccent: 'en un minuto.',
			text: 'Tablas, vistas, formularios, automatizaciones e IA: lo esencial de basedb, narrado y con música.',
			duration: '1 min',
			inEnglish: 'El vídeo está en inglés, con subtítulos en inglés.',
		},

		video: {
			eyebrow: 'La demo',
			title: 'Todo basedb,',
			titleAccent: 'en siete minutos.',
			text: 'Crear una base, rellenarla, compartirla, automatizarla, pilotarla: la visita completa, comentada.',
			play: 'Reproducir el vídeo',
			duration: '6 min 36',
			chapters: 'Capítulos',
			captions: 'Inglés',
			inEnglish: 'El vídeo está en inglés, con subtítulos en inglés.',
			list: [
				{ time: '0:10', title: 'Crear una base' },
				{ time: '0:49', title: 'Tablas, campos y fórmulas' },
				{ time: '1:31', title: 'Fichas y colaboración' },
				{ time: '1:56', title: 'Seis vistas sobre las mismas filas' },
				{ time: '2:29', title: 'Formularios y encuestas' },
				{ time: '3:28', title: 'Cuestionarios' },
				{ time: '4:10', title: 'Automatizaciones' },
				{ time: '4:39', title: 'Paneles' },
				{ time: '4:59', title: 'SQL para cada uno' },
				{ time: '5:30', title: 'Historial y permisos' },
				{ time: '5:53', title: 'API, MCP y Copilot' },
			],
		},
		together: {
			eyebrow: 'Colaboración',
			title: 'Todos.',
			titleAccent: 'A la vez.',
			text: 'Los cambios de los demás llegan en directo. Ves quién mira cada fila, lo comentas justo donde está, y una @ basta para avisar a un compañero.',
			demo: {
				path: 'Ventas / Presupuestos',
				here: '3 personas en esta tabla',
				columns: {
					client: 'Cliente',
					status: 'Etapa',
					amount: 'Importe',
					due: 'Vencimiento',
				},
				statuses: {
					draft: 'Borrador',
					sent: 'Enviado',
					signed: 'Firmado',
				},
				rows: [
					'Panadería Martin',
					'Clínica Los Tilos',
					'Instituto Jean Moulin',
					'Bici Solidaria',
					'La Tienda Gourmet',
					'Forjas del Ebro',
				],
				comment: '@{name} ¿puedes validar este presupuesto antes de esta noche?',
				reply: '¡Validado!',
				toast: '{name} ha modificado «{field}»',
			},
			points: {
				live: {
					title: 'En directo',
					text: 'Cada cambio aparece al instante para los demás, sin recargar la página.',
				},
				comments: {
					title: 'Comentarios y menciones',
					text: 'Comentas una fila, mencionas a un compañero con @, y la campana le avisa.',
				},
				undo: {
					title: 'Deshacer sin riesgo',
					text: 'Ctrl+Z deshace tu último cambio — nunca el de un compañero.',
				},
			},
			link: {
				href: '/fonctionnalites/collaboration/',
				label: 'Trabajar en equipo',
			},
		},
		forms: {
			eyebrow: 'Formularios y cuestionarios',
			title: 'Haz tus preguntas.',
			titleAccent: 'Las respuestas se ordenan solas.',
			text: 'Un formulario de una sola página, o un cuestionario que hace una pregunta por pantalla, con tus colores: comparte el enlace, y cada respuesta se convierte en una fila de tu tabla. Quien responde no ve nada más.',
			modes: {
				label: 'Mostrar las preguntas',
				survey: 'Encuesta',
				form: 'Formulario',
			},
			demo: {
				title: 'Solicitud de presupuesto',
				description: 'Tres preguntas, y te respondemos en menos de 48 h.',
				count: '3 preguntas',
				start: 'Empezar',
				ok: 'OK',
				hint: 'o Intro',
				submit: 'Enviar mi solicitud',
				org: {
					label: 'Tu organización',
					answer: 'Café del Arte',
				},
				need: {
					label: 'Tu necesidad',
					options: ['Sitio web', 'Identidad visual', 'Catálogo'],
				},
				budget: {
					label: 'Tu presupuesto',
					help: 'Sin IVA, aunque sea aproximado.',
				},
				sent: '¡Enviado!',
				thanks: '¡Gracias! Te respondemos en menos de 48 h.',
				poweredBy: 'Formulario con tecnología de basedb',
				path: 'Ventas / Solicitudes',
				view: 'Todas las solicitudes',
				columns: {
					org: 'Organización',
					need: 'Necesidad',
					budget: 'Presupuesto',
					stage: 'Etapa',
				},
				stages: {
					new: 'Nueva',
					called: 'Contactada',
					quote: 'Presupuesto enviado',
				},
				rows: ['Panadería Martin', 'Clínica Los Tilos', 'Bici Solidaria', 'Forjas del Ebro'],
				open: 'Abierto',
				answers: {
					one: '{n} respuesta',
					other: '{n} respuestas',
				},
				active: 'Enlace activo',
			},
			points: {
				survey: {
					title: 'Una pregunta por pantalla',
					text: 'A pantalla completa, con el teclado: Intro para continuar, A, B, C para elegir — una elección única pasa sola a la siguiente, y el envío se celebra.',
				},
				access: {
					title: 'Público o reservado',
					text: 'Cualquiera con el enlace responde sin cuenta — o solo los miembros conectados, y la respuesta lleva su nombre.',
				},
				closed: {
					title: 'El resto queda cerrado',
					text: 'Responder no muestra nada más de la tabla. El enlace se cierra en una fecha, o tras un número de respuestas.',
				},
			},
			link: {
				href: '/fonctionnalites/formulaires-partages/',
				label: 'Los formularios',
			},
		},
		automate: {
			eyebrow: 'Automatizaciones',
			title: 'Trabaja',
			titleAccent: 'mientras duermes.',
			text: 'Cuando llega o cambia una fila, a una hora fija o con un clic en un botón, basedb encadena los pasos: elige la rama correcta, pregunta a la IA, avisa a quien haga falta. Y cada ejecución se puede repasar, paso a paso.',
			clock: '03:12',
			crumb: 'Ventas / Automatizaciones',
			create: 'Nueva automatización',
			list: [
				{
					name: 'Nueva solicitud',
					when: 'Se crea una fila',
				},
				{
					name: 'Presupuesto firmado',
					when: 'Se modifica una fila',
				},
				{
					name: 'Seguimientos del lunes',
					when: 'Cada lunes a las 09:00',
				},
			],
			active: 'Activa',
			test: 'Probar con una fila',
			save: 'Guardar',
			when: 'Cuando',
			trigger: 'Se crea una fila',
			table: 'En Solicitudes',
			steps: {
				branch: {
					kind: 'Condición',
					text: '2 ramas',
					run: 'rama «Gran proyecto»',
				},
				notify: {
					kind: 'Avisar a alguien',
					text: 'Léa Martin',
					run: '1 persona avisada',
				},
				create: {
					kind: 'Crear una fila',
					text: 'Una cita, en Agenda',
					run: 'hecho',
				},
				slack: {
					kind: 'Enviar a Slack',
					text: 'En el canal #ventas',
					run: 'hecho',
				},
				ai: {
					kind: 'Preguntar a la IA',
					text: 'Redactar una primera respuesta',
					run: 'respuesta de {n} caracteres',
				},
				update: {
					kind: 'Modificar una fila',
					text: 'Respuesta, Etapa',
					run: 'hecho',
				},
			},
			paths: {
				big: 'Gran proyecto',
				condition: 'budget gt 5000',
				otherwise: 'Si no',
			},
			answer: '¡Hola, y gracias por su solicitud! Léa, que se encargará de su nueva identidad visual, le llama mañana por la mañana.',
			addStep: 'Añadir un paso',
			tabs: {
				settings: 'Ajustes',
				runs: 'Ejecuciones',
			},
			runsText: 'Las 50 últimas, conservadas 30 días. Elige una para ver en el flujo la rama que tomó.',
			running: 'En curso',
			succeeded: 'Correcta',
			started: 'fila creada · {when}',
			now: 'ahora mismo',
			earlier: ['ayer a las 18:40', 'ayer a las 11:02'],
			done: 'Correcta · 5 pasos · 1,3 s',
			points: {
				when: {
					title: 'En el momento justo',
					text: 'Una fila creada o modificada, una hora fija, un botón — y una condición para arrancar solo cuando haga falta.',
				},
				paths: {
					title: 'Varias ramas',
					text: 'Una condición abre ramas, cada una con sus pasos; lo que un paso encuentra, el siguiente puede citarlo.',
				},
				copilot: {
					title: 'Descrita en una frase',
					text: '«Cuando llega una solicitud, avisa a Léa si el presupuesto supera los 5.000 €»: el Copilot construye el flujo, tú lo repasas.',
				},
			},
			link: {
				href: '/fonctionnalites/automatisations/',
				label: 'Las automatizaciones',
			},
		},
		glance: {
			eyebrow: 'Paneles',
			title: 'Ve todo.',
			titleAccent: 'De un vistazo.',
			text: 'Números, gráficas, objetivos: tus paneles se construyen con el ratón a partir de tus tablas, y se mantienen al día solos. Un filtro, y todo el panel lo sigue.',
			demo: {
				title: 'Seguimiento comercial',
				filters: ['Este año', 'Todas las ciudades'],
				revenue: 'Facturación',
				signed: 'Presupuestos firmados',
				rate: 'Tasa de firma',
				goal: 'Objetivo anual',
				byMonth: 'Facturación por mes',
				byStage: 'Presupuestos por etapa',
				stages: ['Enviados', 'En negociación', 'Firmados'],
				bySector: 'Clientes por sector',
				sectors: ['Comercio', 'Salud', 'Educación', 'Industria'],
				shared: 'Compartido por enlace',
			},
			points: {
				viz: {
					title: 'Quince visualizaciones',
					text: 'Números, tendencias, objetivos, gráficas, sectores, embudos, tablas cruzadas, mapas.',
				},
				filters: {
					title: 'Filtros comunes',
					text: 'El periodo, un cliente, una ciudad: un filtro controla una tarjeta, varias, o todo el panel.',
				},
				share: {
					title: 'Compartido con un enlace',
					text: 'Público o reservado al equipo, y se puede insertar en otro sitio web.',
				},
			},
			link: {
				href: '/fonctionnalites/tableaux-de-bord/',
				label: 'Los paneles',
			},
		},
		ai: {
			eyebrow: 'Inteligencia artificial',
			title: 'Describe.',
			titleAccent: 'basedb construye.',
			text: 'Una frase basta para obtener una base completa, que repasas antes de crearla. Después, el Copilot propone filtros, gráficas y automatizaciones, y los campos de IA resumen, clasifican y redactan por ti.',
			prompt: 'Un seguimiento de las candidaturas para nuestros tres puestos abiertos, con las entrevistas.',
			thinking: 'Tres tablas relacionadas, listas para repasar.',
			tables: {
				jobs: {
					name: 'Puestos',
					fields: ['Título', 'Departamento', 'Abierto el'],
				},
				people: {
					name: 'Candidatos',
					fields: ['Nombre', 'Puesto', 'Etapa', 'Síntesis'],
				},
				talks: {
					name: 'Entrevistas',
					fields: ['Candidato', 'Fecha', 'Con', 'Opinión'],
				},
			},
			aiField: 'Síntesis',
			aiValue: 'Seis años en gestión de proyectos, cómodo con los clientes; a profundizar: el inglés.',
			create: 'Crear la base',
			providers: 'Con el proveedor que prefieras — OpenAI, Anthropic, Mistral, o un modelo instalado en tus propios servidores. Nada sale sin tu permiso.',
			link: {
				href: '/fonctionnalites/ia/',
				label: 'La IA en basedb',
			},
		},
		features: {
			title: 'Todo lo que necesitas.',
			titleAccent: 'Y mucho más.',
			text: 'Cada función escribe en las mismas tablas, con los mismos permisos, en el mismo historial.',
			tiles: {
				views: {
					stat: '10',
					title: 'formas de ver tus datos',
					text: 'Cuadrícula, kanban, calendario, cronología, galería, lista, mapa, formulario, encuesta y cuestionario, sobre las mismas filas. Cada uno elige la suya.',
					href: '/fonctionnalites/vues/',
				},
				history: {
					stat: 'Ctrl+Z',
					title: 'Nada se pierde',
					text: 'Cada cambio se guarda con el valor anterior; un error se deshace, una fila eliminada se restaura.',
					href: '/fonctionnalites/historique/',
				},
				forms: {
					title: 'Formularios',
					text: 'Un enlace público o reservado al equipo: cada respuesta llega a la tabla, sin abrir el resto.',
					href: '/fonctionnalites/formulaires-partages/',
				},
				viz: {
					stat: '15',
					title: 'visualizaciones',
					text: 'Números, tendencias, objetivos, gráficas, sectores, embudos, tablas cruzadas y mapas.',
					href: '/fonctionnalites/tableaux-de-bord/',
				},
				formulas: {
					code: 'IF([Montant] > 10000, "Grand compte", "")',
					title: 'Fórmulas en francés o en inglés',
					text: 'Como en una hoja de cálculo — SI, ARRONDI, JOURS… o IF, ROUND, DAYS — pero calculadas para todo el equipo.',
					href: '/fonctionnalites/tables-et-champs/#fórmulas',
				},
				rights: {
					title: 'Cada uno ve lo que debe ver',
					text: 'Lectura, edición, gestión, equipo por equipo; una columna sensible se puede ocultar.',
					href: '/fonctionnalites/droits/',
				},
				mentions: {
					bubble: '@Camille',
					title: 'Comentarios y menciones',
					text: 'Una fila se comenta donde está, y la campana avisa.',
					href: '/fonctionnalites/collaboration/',
				},
				relations: {
					title: 'Todo está relacionado',
					text: 'Clientes, proyectos, facturas: los totales y las búsquedas atraviesan las relaciones.',
					href: '/fonctionnalites/tables-et-champs/',
				},
				templates: {
					stat: '10',
					title: 'plantillas listas',
					text: 'CRM, selección de personal, inventario, eventos… o una base descrita en una frase a la IA.',
					href: '/modeles/',
				},
				import: {
					title: 'Importar en un gesto',
					text: 'Arrastra un libro de Excel o un CSV: columnas y tipos se adivinan, la tabla se crea.',
					href: '/guides/premiers-pas/',
				},
				agenda: {
					title: 'Hasta en tu agenda',
					text: 'Un calendario se convierte en un feed de agenda para Google Calendar, Outlook o Apple Calendar.',
					href: '/fonctionnalites/vues-partagees/',
				},
				files: {
					title: 'Archivos e imágenes',
					text: 'Presupuestos, fotos, contratos; una imagen se convierte en la portada de una tarjeta.',
					href: '/fonctionnalites/fichiers/',
				},
				share: {
					title: 'Vistas compartidas',
					text: 'Una vista de solo lectura mediante un enlace, que se puede insertar en tu sitio web.',
					href: '/fonctionnalites/vues-partagees/',
				},
				sync: {
					title: 'Tablas sincronizadas',
					text: 'Mantenidas al día desde un CSV en línea, una agenda u otro basedb.',
					href: '/integrations/synchronisation/',
				},
				signin: {
					title: 'Inicio de sesión sencillo',
					text: 'Google, Microsoft o contraseña; invitas a tus compañeros con un enlace.',
					href: '/hebergement/connexion/',
				},
				languages: {
					title: 'En tu idioma',
					text: 'La interfaz toma el idioma de cada uno, entre veinte.',
					href: '/fonctionnalites/droits/#tu-configuración',
				},
			},
		},
		yours: {
			eyebrow: 'Libre y autoalojado',
			per: 'por persona. Para siempre.',
			text: 'basedb es un software libre. Instálalo en tu servidor e invita a todo el equipo: sin suscripción, sin licencias que contar, y tus datos se quedan en tu casa.',
			points: {
				home: {
					title: 'En tu casa',
					text: 'En tu servidor o en el de tu proveedor de hosting, respaldado como cualquier base PostgreSQL.',
				},
				free: {
					title: 'Libre',
					text: 'Con licencia AGPL-3.0: el código es abierto, y lo seguirá siendo.',
				},
				ai: {
					title: 'La IA que elijas',
					text: 'Un proveedor del mercado, un modelo instalado en tus propios servidores — o ninguna IA en absoluto.',
				},
			},
			link: {
				href: '/guides/installation/',
				label: 'Instalar basedb',
			},
		},
		gallery: {
			eyebrow: 'Plantillas',
			title: 'Listo en un minuto.',
			text: 'Parte de una plantilla, con sus tablas, sus vistas, su panel y filas de ejemplo, y adáptala a tu forma de trabajar.',
			use: 'Descubrir',
			ask: {
				title: '¿Nada te convence?',
				text: 'Describe lo que necesitas en una frase: la IA te propone una base a medida.',
			},
			all: 'Ver todas las plantillas',
			previous: 'Plantillas anteriores',
			next: 'Plantillas siguientes',
		},
		developers: {
			title: '¿Y del lado técnico?',
			text: 'Cada tabla es una tabla PostgreSQL real. API REST, webhooks, servidor MCP para tus agentes de IA, y una instalación con un solo comando.',
			link: 'La página para desarrolladores',
		},
		faq: {
			title: 'Tus preguntas',
			items: [
				{
					q: '¿Hay que saber programar?',
					a: 'No. Las tablas, las vistas, los formularios, los paneles y las automatizaciones se crean con el ratón. Las fórmulas se escriben como en una hoja de cálculo, en francés o en inglés: SI o IF, ARRONDI o ROUND, JOURS o DAYS…',
				},
				{
					q: '¿Cuánto cuesta?',
					a: 'Nada: basedb es un software libre, sin suscripción ni precio por persona. Solo necesitas un servidor donde instalarlo.',
				},
				{
					q: '¿Cómo se instala?',
					a: 'En un servidor, con Docker: dos archivos y un comando, unos minutos para la persona que se encarga de tu informática. La guía de instalación lo explica todo, paso a paso.',
				},
				{
					q: '¿Se pueden recuperar nuestras hojas de cálculo?',
					a: 'Sí: arrastra tu libro de Excel, o un CSV, a basedb. La importación adivina el tipo de cada columna, crea la tabla, y dice fila por fila lo que no ha podido importar.',
				},
				{
					q: '¿Se puede trabajar varias personas a la vez?',
					a: 'Está pensado para eso. Los cambios de los demás se muestran en directo, comentas una fila, mencionas a un compañero con @, y una campana avisa.',
				},
				{
					q: '¿Y la IA, lee nuestros datos?',
					a: 'Solo si tú lo decides. Sin un proveedor de IA configurado, no sale nada. Después, un campo o una automatización que llama a la IA solo envía lo que su instrucción cita, con tu permiso.',
				},
				{
					q: '¿En qué idioma?',
					a: 'En el tuyo: la interfaz toma el idioma de tu navegador, entre veinte, y cada uno puede cambiarlo en su configuración.',
				},
			],
		},
		cta: {
			title: 'Tu equipo merece algo mejor',
			titleAccent: 'que un archivo compartido.',
			text: 'Parte de una plantilla, invita a tus compañeros, y deja los «FINAL (2)» atrás.',
			primary: 'Descubrir las plantillas',
			secondary: 'Instalar basedb',
		},
	},
	hero: {
		badge: 'Novedad: automatizaciones en flujo, paneles y vistas SQL',
		title: ['La base colaborativa', 'en la que cada tabla', 'es una tabla'],
		titleAccent: 'PostgreSQL real.',
		lead: 'La sencillez de una hoja de cálculo compartida — cuadrículas, vistas, formularios, permisos — y datos que viven en tablas <strong>tipadas y con nombres legibles</strong>. Tu equipo trabaja en la interfaz; tus scripts, tus herramientas de BI, tus agentes de IA y <code>psql</code> leen las mismas filas.',
		install: 'Instalar con Docker',
		features: 'Ver las funciones',
		copy: 'Copiar el comando',
		facts: ['Autoalojado', 'AGPL-3.0', 'API REST y servidor MCP'],
		demo: {
			url: 'basedb.tu-dominio.com',
			project: 'Proyecto principal',
			projectMeta: 'Proyecto · 2 bases',
			filter: 'Filtrar bases y tablas',
			sales: 'Ventas',
			support: 'Soporte',
			environment: 'Producción',
			clients: 'Clientes',
			opportunities: 'Oportunidades',
			quotes: 'Presupuestos',
			baseSection: 'Base · Ventas',
			screens: ['Paneles', 'Automatizaciones'],
			copilot: '✦ Copilot',
			allRows: '▦ Todas las filas ▾',
			tools: ['Filtrar', 'Agrupar', 'Colores'],
			search: 'Buscar…',
			add: '+ Añadir',
			columns: {
				name: 'Nombre',
				status: 'Estado',
				amount: 'Importe',
				client: 'Cliente',
			},
			statuses: {
				nouveau: 'Nuevo',
				qualifie: 'Cualificado',
				proposition: 'Propuesta',
				negociation: 'Negociación',
				gagne: 'Ganado',
				perdu: 'Perdido',
			},
			deals: {
				portail: {
					name: 'Rediseño del portal',
					client: 'Ayuntamiento de Vallehondo',
				},
				erp: {
					name: 'Migración del ERP',
					client: 'Grupo Delorme',
				},
				audit: {
					name: 'Auditoría de seguridad',
					client: 'Clínica San Roque',
				},
				billetterie: {
					name: 'Taquilla en línea',
					client: 'Teatro de la Glorieta',
				},
				flotte: {
					name: 'Seguimiento de flota',
					client: 'Transportes Kerlann',
				},
				mobile: {
					name: 'Aplicación móvil',
					client: 'Taller Moreau',
				},
				intranet: {
					name: 'Rediseño de la intranet',
					client: '',
				},
			},
			toastTitle: 'Formulario «Solicitud de presupuesto»',
			toastText: 'respuesta pública · ha creado «{name}»',
			cursor: 'Camille',
			psqlRows: '(2 filas)',
		},
	},
	showcase: {
		label: 'La interfaz, tal cual',
		title: 'Todo lo que tu equipo espera de una hoja de cálculo compartida.',
		tabs: 'Capturas de la interfaz',
		alt: 'basedb — {labelLower}: {caption}',
		shots: {
			grille: {
				label: 'Cuadrícula',
				caption: 'Una cuadrícula que escribe en una tabla real — y campos calculados: una duración por fórmula, la ciudad del cliente por búsqueda, el número de tareas por recuento.',
			},
			kanban: {
				label: 'Kanban',
				caption: 'Las mismas filas en columnas, según una lista de opciones: una imagen de portada, una descripción que cita la fila. Arrastrar una tarjeta es modificar la fila.',
			},
			galerie: {
				label: 'Galería',
				caption: 'Tarjetas con su imagen, un color por estado: la galería, una de las ocho formas de leer una tabla.',
			},
			chronologie: {
				label: 'Cronología',
				caption: 'Barras entre dos fechas, y las flechas de sus dependencias — en rojo cuando el orden ya no se cumple.',
			},
			tableaux: {
				label: 'Paneles',
				caption: 'Tarjetas en cuadrícula, en pestañas, bajo filtros comunes: una tendencia, un objetivo, series apiladas — leídas con los permisos de cada uno.',
			},
			automatisations: {
				label: 'Automatizaciones',
				caption: 'Cuando una tarea está hecha, buscar lo que queda del proyecto; si no queda nada, la IA redacta la nota de cierre y el proyecto pasa a «Entregado». Cada ejecución se lee sobre el flujo, paso a paso.',
			},
			commentaires: {
				label: 'Comentarios',
				caption: 'Una fila se comenta allí donde está: comentarios, menciones, notificaciones.',
			},
			formulaire: {
				label: 'Formulario',
				caption: 'Un formulario se comparte mediante un enlace, público o reservado a los miembros conectados.',
			},
			historique: {
				label: 'Historial',
				caption: 'Cada escritura, venga de donde venga — una persona, una automatización, el SQL directo — con los valores anteriores.',
			},
			sql: {
				label: 'SQL',
				caption: 'Una consulta sobre los nombres reales, guardada bajo las tablas para todo el equipo — que cada uno ejecuta con sus propios permisos.',
			},
			vuesSql: {
				label: 'Vistas SQL',
				caption: 'Vistas PostgreSQL reales, colocadas entre las tablas con su color y su icono — y legibles desde psql.',
			},
		},
	},
	features: {
		postgres: {
			label: 'PostgreSQL, sin traducción',
			title: 'Una cuadrícula para el equipo, una tabla real {para tus herramientas.}',
			lead: 'Sin modelo genérico, sin JSON cajón de sastre, sin <code>field_1837</code>: una base es un esquema, una tabla es una tabla, un campo es una columna tipada, con un nombre legible.',
			bullets: [
				'<strong>Tipos nativos</strong>: <code>text</code>, <code>numeric</code>, <code>date</code>, <code>timestamptz</code>, <code>boolean</code> — y claves foráneas reales para las relaciones.',
				'<strong>Restricciones garantizadas por la base de datos</strong>: selecciones únicas como <code>CHECK</code>, direcciones web y correos electrónicos verificados, relaciones como <code>FOREIGN KEY</code>.',
				'<strong>Fórmulas calculadas por PostgreSQL</strong>: <code>JOURS([Fin]; [Début])</code> se convierte en una columna generada, que <code>psql</code> lee como las demás.',
				'<strong>El SQL directo sigue permitido</strong> — e incluso él queda registrado en el historial, mediante un disparador.',
				'<strong>Consultas y vistas SQL</strong> en la interfaz: consultas guardadas bajo las tablas, para ti o para el equipo, y vistas PostgreSQL reales colocadas entre ellas, que <code>psql</code> también lee.',
				'<strong>Cambiar un nombre no rompe nada</strong>: el nombre anterior se sigue sirviendo mediante un alias de compatibilidad mientras migras tus consultas.',
			],
			links: [
				{
					href: '/integrations/sql/',
					label: 'Trabajar en SQL',
				},
				{
					href: '/fonctionnalites/requetes-et-vues-sql/',
					label: 'Consultas y vistas SQL',
				},
				{
					href: '/architecture/principes/',
					label: 'Los principios',
				},
			],
		},
		automations: {
			label: 'Automatizar',
			title: 'Automatizaciones en flujo, {la IA en cada paso.}',
			lead: 'Cuando una fila cambia, a una hora fija o con un clic: un editor en grafo encadena los pasos, y cada ejecución se revisa sobre el flujo.',
			bullets: [
				'<strong>Un flujo legible</strong>: el desencadenador y, después, cada paso en una tarjeta; un <strong>+</strong> sobre una línea añade un paso en ese punto.',
				'<strong>Buscar, decidir, escribir</strong>: encontrar una fila, tomar una rama u otra según unas condiciones, modificar, crear, avisar, llamar a un webhook, escribir en Slack.',
				'<strong>Preguntar a la IA</strong> en un paso: una instrucción que cita la fila, una respuesta leída como texto, número, fecha u opción, que los pasos siguientes reutilizan.',
				'<strong>El Copilot</strong> propone una automatización entera a partir de una frase, o explica por qué ha fallado una ejecución — nada se guarda sin ti.',
				'<strong>Con los permisos de quien la escribió</strong>, y en el historial como cualquier otra escritura.',
			],
			links: [
				{
					href: '/fonctionnalites/automatisations/',
					label: 'Las automatizaciones',
				},
				{
					href: '/fonctionnalites/automatisations/#el-copilot',
					label: 'El Copilot',
				},
			],
			alt: 'basedb — la automatización «Proyecto entregado» en el editor de flujo: cuando una tarea está hecha, anotar la hora, buscar lo que queda del proyecto, tomar la rama «Si no», preguntar a la IA la nota de cierre y entregar el proyecto; a la derecha, sus últimas ejecuciones, paso a paso.',
		},
		dashboards: {
			label: 'Analizar',
			title: 'Paneles {sin salir de tus tablas.}',
			lead: 'Preguntas hechas con el ratón o en SQL, quince visualizaciones, filtros comunes — cada uno los lee con sus propios permisos.',
			bullets: [
				'<strong>Preguntas</strong>: una tabla, sus combinaciones, filtros y medidas por día, semana, mes o año — o SQL en solo lectura.',
				'<strong>Quince visualizaciones</strong>: cifra, tendencia, objetivo, medidor, barras, líneas, sectores, embudo, tabla dinámica, mapa…',
				'<strong>Explorar con un clic</strong>: un punto abre sus filas, o un periodo más detallado.',
				'<strong>Filtros comunes</strong> que controlan una, varias o todas las tarjetas.',
				'<strong>Compartir mediante un enlace</strong>, público o reservado a los miembros, e insertar en otro sitio web.',
			],
			links: [
				{
					href: '/fonctionnalites/tableaux-de-bord/',
					label: 'Los paneles',
				},
			],
			alt: 'basedb — un panel: tendencia del mes, objetivo de cobro, facturación por mes, sentimiento de las reseñas, bajo filtros de periodo y de cliente.',
		},
		rights: {
			label: 'Colaborar sin abrirlo todo',
			title: 'Permisos hasta el campo, {un historial sin huecos.}',
			lead: 'Los permisos se conceden a grupos, sobre un proyecto, una base o una tabla, y se heredan en todo lo que está debajo. Una columna sensible puede ocultarse a un grupo, o volverse no modificable para él.',
			bullets: [
				'<strong>Cuatro niveles</strong>: Sin acceso, Lectura, Edición, Gestión — que se suman de un grupo a otro.',
				'<strong>Hasta el SQL respeta tus permisos</strong>: en la interfaz, una consulta solo ve las tablas y los campos que tienes abiertos — y es PostgreSQL quien lo aplica.',
				'<strong>Cada escritura queda registrada</strong> en su transacción: interfaz, API, agente, formulario público o SQL directo.',
				'<strong>Una modificación se deshace</strong>, una fila eliminada se restaura, y una base eliminada también.',
				'<strong>La administración se confirma</strong>: cambiar un permiso exige haber vuelto a escribir la contraseña en los últimos cinco minutos.',
			],
			links: [
				{
					href: '/fonctionnalites/droits/',
					label: 'Permisos y grupos',
				},
				{
					href: '/fonctionnalites/historique/',
					label: 'El historial',
				},
			],
		},
		agents: {
			label: 'API REST · MCP · webhooks',
			title: 'Tus agentes de IA acceden a los datos, {no a las llaves del castillo.}',
			lead: 'El servidor MCP da catorce herramientas a los agentes; la API REST, los mismos datos a tus programas. Un único punto de control de los permisos, los mismos registros.',
			bullets: [
				'<strong>Un token por base</strong>, de solo lectura por defecto, nunca con más permisos que la persona que lo creó.',
				'<strong>Un agente solo elimina con tu permiso</strong>, una fila a la vez, y no cambia la estructura: la propone, una persona la aprueba.',
				'<strong>Una documentación generada</strong> para cada base, filtrada por tus permisos, con su especificación OpenAPI 3.1.',
				'<strong>Webhooks</strong> firmados, ordenados y reintentados en cada escritura.',
			],
			links: [
				{
					href: '/integrations/mcp/',
					label: 'Conectar un agente',
				},
				{
					href: '/integrations/api-rest/',
					label: 'La API REST',
				},
			],
		},
	},
	sqlVisual: {
		interface: 'Interfaz',
		title: 'Nuevo campo · Oportunidades',
		labelField: 'Etiqueta',
		labelValue: 'Importe',
		typeField: 'Tipo',
		typeValue: 'Número',
		descriptionField: 'Descripción',
		descriptionValue: 'Importe del contrato sin IVA',
		required: 'Obligatorio',
		ai: 'IA',
		migration: 'una migración planificada, bloqueos breves',
	},
	rightsVisual: {
		groups: ['Administradores', 'Comerciales', 'Soporte'],
		project: 'Proyecto principal',
		sales: 'Ventas',
		opportunities: 'Oportunidades',
		clients: 'Clientes',
		support: 'Soporte',
		inherited: 'heredado',
		levels: {
			none: 'Sin acceso',
			read: 'Lectura',
			edit: 'Edición',
			manage: 'Gestión',
		},
		field: 'Campo «Margen»',
		hidden: 'Oculto',
		sqlChange: '<b>Sesión SQL directa</b> ha modificado <b>«Migración del ERP»</b>',
		sqlMeta: '02:46 · conexión local · psql',
		sqlDiff: 'Importe: <s>125.000</s> → 130.000',
		undo: '↶ Deshacer',
		formChange: '<b>Formulario «Solicitud de presupuesto»</b> ha creado <b>«Rediseño de la intranet»</b>',
		formMeta: 'respuesta pública · publicado por Camille',
	},
	agentVisual: {
		agent: 'Agente',
		via: 'conectado por MCP · token «Ventas»',
		question: '¿Cuántas oportunidades hay en negociación, y por qué importe?',
		listArgs: 'opportunites · statut = Negociación',
		answer: 'Dos oportunidades, <b>182.000 €</b> en total: Migración del ERP (130.000 €) y Seguimiento de flota (52.000 €).',
		request: 'Añade un campo «Probabilidad» en porcentaje.',
		proposeArgs: 'opportunites · Probabilidad · number',
		proposed: 'Propuesto: una persona del equipo tiene que aprobarlo en basedb.',
		badge: 'Propuesta',
		expires: 'caduca en 23 h',
		what: 'Añadir el campo <b>«Probabilidad»</b> (Número) a <b>Oportunidades</b>',
		by: 'Propuesta del agente · token «Ventas»',
		refuse: 'Rechazar',
		approve: 'Aprobar',
	},
	bento: {
		label: 'Y todo lo demás',
		title: 'Lo que se espera de una herramienta de equipo, sin soltar PostgreSQL.',
		text: 'Cada función escribe en las mismas tablas, con los mismos permisos, en el mismo historial.',
		more: 'Más información →',
		views: {
			title: 'Diez vistas de las mismas filas',
			text: 'Colaborativas para todo el equipo, o personales solo para ti: cada uno elige su forma de leer, y nadie copia los datos.',
			chips: [
				'Cuadrícula',
				'Kanban',
				'Calendario',
				'Cronología',
				'Galería',
				'Lista',
				'Mapa',
				'Formulario',
				'Encuesta',
				'Cuestionario',
			],
		},
		forms: {
			title: 'Formularios compartidos',
			text: 'Un enlace público, o reservado a los miembros conectados. Responder no da ningún permiso sobre la tabla.',
			href: '/fonctionnalites/formulaires-partages/',
		},
		environments: {
			title: 'Entornos',
			text: 'Una base, varias variantes. Compara la estructura, migra de una a otra, sincroniza filas.',
			chips: ['Producción', 'Preproducción', 'Desarrollo'],
			href: '/fonctionnalites/environnements/',
		},
		collaboration: {
			title: 'Trabajar en equipo',
			text: 'Las escrituras de los demás llegan en tiempo real, se ve quién mira cada fila y se comenta allí donde está: comentarios, menciones, notificaciones. Ctrl+Z deshace la última escritura, y se niega antes que sobrescribir el trabajo de otra persona.',
			chips: ['Tiempo real', 'Presencia', 'Comentarios', 'Menciones', 'Ctrl+Z'],
			href: '/fonctionnalites/collaboration/',
		},
		small: {
			ai: {
				title: 'La IA en la cuadrícula',
				text: 'Un campo que rellena un modelo a partir de las demás columnas, y un Copilot que propone filtros, consultas y columnas, que se aplican con un clic. OpenAI, Anthropic, Mistral, o un modelo servido en tu propia máquina.',
				code: 'Resume {{Notes}} en una frase',
				href: '/fonctionnalites/ia/',
			},
			formulas: {
				title: 'Relaciones y fórmulas',
				text: 'Claves foráneas reales, fórmulas en francés o en inglés calculadas por PostgreSQL, y búsquedas, acumulados y recuentos a través de las relaciones.',
				code: 'ROUND([Montant HT] * (1 + [Taux de TVA]), 2)',
				href: '/fonctionnalites/tables-et-champs/#fórmulas',
			},
			richText: {
				title: 'Texto enriquecido y variables',
				text: 'Un editor visual para el texto con formato, saneado al escribirse; y en cualquier texto largo, {{Ville}} se lee con el valor de la fila.',
				code: 'Entrega el {{Date}} en {{Ville}}',
				href: '/fonctionnalites/tables-et-champs/#texto-enriquecido-y-variables',
			},
			languages: {
				title: 'En tu idioma',
				text: 'La interfaz usa el idioma del navegador, entre veinte; cada uno puede cambiarlo en su configuración.',
				href: '/fonctionnalites/droits/#tu-configuración',
			},
			sharedViews: {
				title: 'Vistas compartidas',
				text: 'Una vista de solo lectura mediante un enlace, que se puede insertar en otro sitio web; un calendario se convierte en un feed para tu agenda.',
				href: '/fonctionnalites/vues-partagees/',
			},
			syncedTables: {
				title: 'Tablas sincronizadas',
				text: 'Una tabla que se mantiene al día desde un CSV en línea, una agenda o la vista compartida de otro basedb.',
				href: '/integrations/synchronisation/',
			},
			templates: {
				title: 'Plantillas de base',
				text: 'Diez plantillas listas para usar, una base descrita en una frase a la IA, y la tuya guardada como plantilla.',
				href: '/modeles/',
			},
			files: {
				title: 'Archivos e imágenes',
				text: 'En el disco del servidor o en un almacenamiento compatible con S3: AWS, Scaleway, OVH, Cloudflare R2, Garage, MinIO…',
				href: '/fonctionnalites/fichiers/',
			},
			import: {
				title: 'Importación Excel, CSV y JSON',
				text: 'Arrastra un archivo: la importación deduce los tipos, crea la tabla o completa una existente, e indica fila por fila lo que se ha rechazado.',
				href: '/guides/premiers-pas/',
			},
			accounts: {
				title: 'Cuentas e invitaciones',
				text: 'Cada uno crea su cuenta y sus proyectos, e invita mediante un enlace con Lectura, Edición o Gestión; inicio de sesión con contraseña, Google, Microsoft o cualquier proveedor OpenID Connect.',
				href: '/hebergement/connexion/',
			},
			webhooks: {
				title: 'Webhooks',
				text: 'Cada escritura puede avisar a otro sistema: cargas firmadas, entregadas en orden, reintentadas.',
				href: '/integrations/webhooks/',
			},
			settings: {
				title: 'Configuración personal',
				text: 'Tu idioma, tu tema, el orden de las fechas, tus notificaciones, tus sesiones y tus tokens, en un mismo lugar.',
				href: '/fonctionnalites/droits/#tu-configuración',
			},
		},
	},
	selfHost: {
		label: 'Autoalojado',
		title: 'Tus datos se quedan {en tus servidores.}',
		lead: 'basedb es software libre (AGPL-3.0): una sola imagen, una base de datos PostgreSQL, y nada más — ningún servicio de terceros impuesto, ninguna telemetría. Haz copias de seguridad con <code>pg_dump</code> y lee los datos con cualquier cliente PostgreSQL.',
		services: {
			db: 'PostgreSQL 16, tus datos',
			basedb: 'La interfaz, la API REST y el servidor MCP, en un solo puerto',
			proxy: 'Caddy, HTTPS automático (opcional)',
		},
		links: [
			{
				href: '/hebergement/docker/',
				label: 'Guía de Docker Compose →',
			},
			{
				href: '/hebergement/variables/',
				label: 'Todas las variables →',
			},
		],
		steps: [
			{
				title: 'Obtener basedb',
				code: 'git clone https://github.com/eodia/basedb.git\ncd basedb && cp .env.example .env',
			},
			{
				title: 'Dos secretos en .env',
				code: 'POSTGRES_PASSWORD=una-clave-muy-segura\n# openssl rand -base64 32\nBASEDB_ENCRYPTION_KEY=…',
			},
			{
				title: 'Arrancar',
				code: 'docker compose up -d\n# después, http://localhost:3000: crea tu cuenta',
			},
		],
	},
	faq: {
		label: 'Preguntas frecuentes',
		title: 'Lo que nos preguntan a menudo.',
		text: '¿Otra pregunta? <a href="/guides/introduction/">La documentación</a> seguramente la responde.',
		items: {
			difference: {
				q: '¿En qué se diferencia basedb de otras bases de datos colaborativas?',
				a: 'En el lugar donde viven los datos. Allí donde otros guardan tus filas en un modelo genérico (columnas numeradas, documentos JSON), basedb crea una tabla PostgreSQL real por cada tabla y una columna tipada real por cada campo, con nombres legibles. Tus datos siguen siendo aprovechables sin basedb.',
			},
			sql: {
				q: '¿Puedo escribir directamente en SQL en las tablas?',
				a: 'Sí. Las restricciones (tipos, obligatorio, selecciones únicas, claves foráneas) las garantiza el propio PostgreSQL, y un disparador registra en el historial incluso las escrituras hechas en SQL directo, con la sesión que las hizo. La consola SQL de la interfaz y psql leen las mismas tablas; en la interfaz, cada uno escribe SQL con sus propios permisos, guarda sus consultas y, si gestiona la base, las convierte en vistas PostgreSQL reales.',
			},
			ai: {
				q: '¿Qué se envía a un proveedor de IA?',
				a: 'Nada mientras no hayas configurado un proveedor. Después, para los borradores de estructura y el Copilot, por defecto solo se envían la estructura y tu frase; que el Copilot lea datos es una casilla que se marca en cada conversación. Una plantilla de base pedida a la IA solo envía tu frase. Un campo de IA envía las columnas que cita su instrucción, tras un consentimiento explícito.',
			},
			together: {
				q: '¿Se puede trabajar entre varios en la misma tabla?',
				a: 'Sí. Las escrituras de los demás aparecen sin recargar, con su avatar sobre la tabla o la fila que están mirando. Se comenta una fila, se menciona a alguien con @, y la campana avisa. Y Ctrl+Z solo deshace tus propias escrituras: se niega antes que sobrescribir lo que otra persona haya cambiado desde entonces.',
			},
			languages: {
				q: '¿En qué idiomas?',
				a: 'Veinte: francés, inglés, alemán, español, italiano, portugués de Brasil, neerlandés, polaco, checo, sueco, danés, noruego, finés, rumano, húngaro, turco, ucraniano, japonés, chino simplificado y coreano. La interfaz usa el idioma del navegador, y cada uno lo cambia en su configuración; este sitio y la documentación existen en los mismos idiomas.',
			},
			agent: {
				q: '¿Cómo se conecta un agente de IA?',
				a: 'Mediante el servidor MCP, con un token de integración limitado a una base, de solo lectura por defecto. Un agente lee, crea y modifica filas según sus permisos —y elimina, una a la vez, si su token se ha creado para ello—; no cambia la estructura: la propone, y una persona la aprueba.',
			},
			postgres: {
				q: '¿Qué versión de PostgreSQL hace falta?',
				a: 'PostgreSQL 16 o posterior, con las extensiones pg_trgm y unaccent (disponibles en la imagen oficial). El docker-compose incluido arranca un PostgreSQL 16; también puedes apuntar DATABASE_URL a tu propio servidor.',
			},
			production: {
				q: '¿Está listo para producción?',
				a: 'basedb está en desarrollo activo: el núcleo, la API, el servidor MCP y la interfaz funcionan y los cubren más de mil pruebas, pero algunas funciones aún están por llegar (consulta la hoja de ruta). Pruébalo, y haz copias de seguridad de tu base de datos como de cualquier base PostgreSQL.',
			},
			license: {
				q: '¿Con qué licencia?',
				a: 'AGPL-3.0-or-later. Puedes usarlo, modificarlo y alojarlo libremente; si ofreces una versión modificada como servicio, compartes su código fuente.',
			},
		},
	},
	cta: {
		title: 'Tus datos merecen {tablas de verdad.}',
		text: 'Instala basedb en unos minutos, invita a tu equipo y conserva el control de cada fila.',
		install: 'Instalar basedb',
		github: 'Ver el código en GitHub',
	},
	changelog: {
		label: 'Novedades',
		title: 'Lo que ha cambiado en basedb',
		intro: 'El detalle de cada cambio está en <a href="https://github.com/eodia/basedb/commits/main">el historial del repositorio</a>. Lo que viene después: la <a href="/feuille-de-route/">hoja de ruta</a>.',
		entries: {
			agentDelete: {
				date: '2026-10-02',
				title: 'Agentes que eliminan, si tú lo permites',
				tag: 'Novedad',
				items: [
					'<strong>Un tercer nivel de token</strong>, «Lectura, escritura y eliminación»: un programa elimina mediante la API REST, un agente mediante la nueva herramienta <code>delete_record</code> — una fila a la vez, devuelta en la respuesta. <a href="/integrations/mcp/#eliminar-filas">Eliminar filas</a>',
					'<strong>Volver atrás</strong>: <code>restore_record</code> restaura una fila eliminada bajo su identificador; una eliminación que una relación en cascada extendería a otras filas sigue reservada a la interfaz.',
				],
			},
			tokens: {
				date: '2026-10-02',
				title: 'Tokens para quien gestiona una base',
				tag: 'Novedad',
				items: [
					'<strong>El nivel Gestión basta</strong>: otorgado sobre una base o sobre su proyecto, permite crear los tokens de integración de sus bases, sin ser administrador. <a href="/integrations/api-rest/#un-token">Un token</a>',
					'<strong>Si no, lo dice claramente</strong>: a quien lee o escribe sin gestionar la base, la ventana de tokens le dice a quién dirigirse; a una cuenta sin contraseña, por qué todavía no puede crear uno.',
				],
			},
			advancedFlows: {
				date: '2026-10-02',
				title: 'Automatizaciones que esperan, se recuperan de un error y envían PDF',
				tag: 'Novedad',
				items: [
					'<strong>Cuatro desencadenadores más</strong>: se elimina una fila; una fila entra en un filtro —«una factura pasa a estar atrasada»—; llega una fecha —tres días antes del vencimiento, a las 9:00—; otro programa llama a la dirección secreta de la automatización. <a href="/fonctionnalites/automatisations/#un-servicio-que-llama-a-basedb">Un servicio que llama a basedb</a>',
					'<strong>Esperar</strong> tres días, o hasta la fecha de un campo, y luego continuar releyendo la fila: «si todavía no está aceptado, reclamar». <a href="/fonctionnalites/automatisations/#esperar">Esperar</a>',
					'<strong>Generar un PDF y enviarlo</strong>: el documento de una fila, guardado en un campo Archivo o adjunto a un correo electrónico —en texto enriquecido, con destinatarios en copia y una dirección de respuesta, a cada uno o uno solo para todos. <a href="/fonctionnalites/automatisations/#un-pdf-y-un-correo-electrónico">Un PDF y un correo electrónico</a>',
					'<strong>Eliminar una fila, contar y sumar, lanzar otra automatización</strong>; una condición también puede comprobar un valor —la respuesta de la IA, un total—, y una búsqueda que no encuentra nada tiene su propio camino.',
					'<strong>Intentar</strong>: unos pasos, y otros si alguno falla; un webhook reintenta por sí mismo, un bucle continúa a pesar de una fila en error. <a href="/fonctionnalites/automatisations/#intentar">Intentar</a>',
					'<strong>Todos los pasos a mano</strong>: el <strong>+</strong> abre una ventana ordenada por categoría, con una búsqueda, en lugar de un menú que podía quedar cortado.',
				],
			},
			designer: {
				date: '2026-10-02',
				title: 'Documentos PDF con tus colores',
				tag: 'Novedad',
				items: [
					'<strong>Cinco puntos de partida</strong> —factura, presupuesto, ficha, certificado, página en blanco—, construidos con las columnas de tu tabla: número, fecha, importes, foto, filas vinculadas. <a href="/fonctionnalites/documents/#crear-una-plantilla">Crear una plantilla</a>',
					'<strong>Tu logo y tus colores</strong>: un encabezado con logo y datos de contacto, un pie con menciones legales y números de página, un color de acento, fuentes con o sin serifa, un marco alrededor de la página. <a href="/fonctionnalites/documents/#encabezado-y-pie-de-página">Encabezado y pie de página</a>',
					'<strong>Nuevos bloques</strong>: un título sobre una franja, una imagen, dos o tres columnas, un resumen de importe sin impuestos / total con impuestos, una tabla con encabezado de color, un separador. Se arrastran para reordenarlos, y la vista previa sigue cada modificación. <a href="/fonctionnalites/documents/#el-contenido-bloques">Los bloques</a>',
				],
			},
			resilience: {
				date: '2026-10-01',
				title: 'Una conexión interrumpida ya no detiene basedb',
				tag: 'Alojamiento',
				items: [
					'<strong>Ya no hay parada por una conexión interrumpida</strong>: cuando PostgreSQL cierra una conexión — un reinicio, un corte de red, una transacción que quedó inactiva —, solo falla la consulta que la mantenía; basedb continúa, y su registro dice qué tarea la mantenía.',
					'<strong>Menos espera en una base de datos cargada</strong>: una página de tabla ya no mantiene abierta una transacción mientras lee las filas relacionadas, y una consulta que no obtiene una conexión en 15 segundos recibe un error en lugar de esperar sin fin.',
					'<strong>Encabezados de IA leídos como se escriben</strong>: <code>BASEDB_AI_HEADERS</code> también acepta la forma que reescribe Ansible, <code>{\'api-key\': \'…\'}</code>, y un encabezado por línea; con ellos, <code>openai_compatible</code> puede prescindir de una clave.',
				],
			},
			applications: {
				date: '2026-09-30',
				title: 'Para las aplicaciones que se apoyan en basedb',
				tag: 'Novedad',
				items: [
					'<strong>Una base creada a partir de una plantilla en una sola llamada</strong>: el servidor aplica toda la plantilla — tablas, relaciones, filas, vistas, automatizaciones —, o nada si un paso falla. La galería también recurre a ella, una aplicación que también se instala así. <a href="/integrations/api-rest/#crear-una-base-a-partir-de-una-plantilla">Crear una base a partir de una plantilla</a>',
					'<strong>Verificar un token</strong>: una aplicación a la que se le pasa el token de una persona le pregunta a basedb si aún es válido, y para quién — su cuenta, sus grupos. <a href="/integrations/api-rest/#verificar-un-token">Verificar un token</a>',
					'<strong>Tus servidores internos</strong>: los webhooks y las automatizaciones contactan con los que indiques en <code>BASEDB_WEBHOOK_ALLOW</code>, HTTP incluido; un programa también puede seguir una tabla en tiempo real con un token de integración. <a href="/integrations/webhooks/#sin-webhook-seguir-una-tabla">Seguir una tabla</a>',
					'<strong>Bajo una ruta, detrás de una pasarela</strong>: basedb se publica en una dirección como <code>https://passerelle.example.com/basedb/</code>, ya sea que la pasarela conserve la ruta o la elimine. <a href="/hebergement/docker/#detrás-de-una-pasarela-bajo-una-ruta">Detrás de una pasarela</a>',
					'<strong>Un webhook, todas las tablas a la vez</strong>: marcar o desmarcar un evento para todas las tablas, o todos los eventos de una tabla, con un clic.',
				],
			},
			loopsWebhooks: {
				date: '2026-09-30',
				title: 'Automatizaciones que recorren tus filas y hablan con las API',
				tag: 'Novedad',
				items: [
					'<strong>Para cada fila</strong>: un paso que repite los suyos en cada fila de una tabla que cumple un filtro — cada lunes, reclamar todas las facturas impagadas, no solo la primera. <a href="/fonctionnalites/automatisations/#para-cada-fila">Para cada fila</a>',
					'<strong>Un webhook que habla con cualquier API</strong>: el método, una dirección que cita la fila, encabezados, un cuerpo en JSON, en formulario o en texto, compuesto con los valores de la fila. <a href="/fonctionnalites/automatisations/#llamar-a-un-servicio">Llamar a un servicio</a>',
					'<strong>Una clave de API permanece secreta</strong>: cifrada, no se vuelve a mostrar nunca — ni en la pantalla, ni por la API, ni al Copilot — y solo se envía al host para el que la diste.',
				],
			},
			maps: {
				date: '2026-09-30',
				title: 'El mapa, y direcciones que se encuentran',
				tag: 'Novedad',
				items: [
					'<strong>Una décima vista, el mapa</strong>: cada fila colocada en su lugar, por su dirección o por su latitud y su longitud. Un marcador toma el color de un estado y abre sus detalles de la fila con un clic. <a href="/fonctionnalites/vues/#mapa">El mapa</a>',
					'<strong>Una dirección se sitúa de una vez por todas</strong>, mediante el servicio de OpenStreetMap o el que elijas: los marcadores aparecen a medida que llegan las respuestas, y luego de inmediato. Una dirección no encontrada se cuenta, nunca se descarta en silencio.',
					'<strong>El formato Dirección</strong> para un texto corto: un clic lo abre en el mapa, y en los detalles de la fila, <strong>Buscar dirección</strong> propone las direcciones completas que coinciden. <a href="/fonctionnalites/tables-et-champs/#formatos-de-visualización">Formatos</a>',
				],
			},
			documents: {
				date: '2026-09-30',
				title: 'PDF a partir de tus filas',
				tag: 'Novedad',
				items: [
					'<strong>Un presupuesto, una factura, una ficha en PDF</strong>, desde el menú de una fila: la ficha imprimible sin configurar nada, o una plantilla — textos que citan los campos, los campos de la fila, la tabla de filas vinculadas con su total, saltos de página. <a href="/fonctionnalites/documents/">Los documentos</a>',
					'<strong>Cada uno con sus permisos</strong>: un campo oculto para ti no aparece en tu PDF. Los veinte idiomas se escriben ahí correctamente, chino, japonés y coreano incluidos, y la API entrega el mismo documento.',
				],
			},
			rows: {
				date: '2026-09-30',
				title: 'Permisos hasta la fila, valores predeterminados, la importación de Excel',
				tag: 'Novedad',
				items: [
					'<strong>Cada uno sus filas</strong>: un grupo solo ve las filas de un filtro —«Comercial es yo», «Región es Norte»—, en la interfaz, la API, el servidor MCP como en SQL, donde PostgreSQL aplica la misma regla. <a href="/fonctionnalites/droits/#hasta-la-fila">Hasta la fila</a>',
					'<strong>Valores predeterminados</strong>: un valor fijo, la fecha de hoy, el momento de la creación o la persona que crea la fila, rellenados de antemano en la pantalla y aplicados en todos los demás sitios. <a href="/fonctionnalites/tables-et-champs/#valores-predeterminados">Valores predeterminados</a>',
					'<strong>Arrastra un libro de Excel</strong>: elige la hoja, las fechas, importes y casillas de verificación llegan tal cual, y una fórmula aporta su valor. <a href="/guides/premiers-pas/">Primeros pasos</a>',
				],
			},
			mail: {
				date: '2026-09-30',
				title: 'Correos electrónicos',
				tag: 'Novedad',
				items: [
					'<strong>Un paso «Enviar un correo electrónico»</strong> en las automatizaciones: a un miembro, a la persona de un campo, a la dirección de un cliente, con los valores de la fila en el asunto y el texto. <a href="/fonctionnalites/automatisations/">Las automatizaciones</a>',
					'<strong>Las notificaciones por correo electrónico</strong> cuando no las has leído, agrupadas, para elegir una a una en tu configuración; y la <strong>contraseña olvidada</strong> se restablece mediante un enlace. <a href="/fonctionnalites/collaboration/#por-correo-electrónico">Por correo electrónico</a>',
					'Basta con indicarle a la instancia el servidor de envío de tu correo. <a href="/hebergement/variables/#correos-electrónicos">Las variables</a>',
				],
			},
			integrations: {
				date: '2026-09-30',
				title: 'n8n y un SDK de TypeScript',
				tag: 'Novedad',
				items: [
					'<strong>Nodos de n8n</strong>: leer y escribir las filas de una tabla desde un workflow, y lanzar uno cada vez que se crea, modifica o elimina una fila — por consulta o por un webhook firmado. <a href="/integrations/n8n/">n8n</a>',
					'<strong>Un SDK de TypeScript</strong>, con los tipos de tus tablas generados desde tu instancia: una tabla o un campo que no existe es un error incluso antes de la ejecución. <a href="/integrations/sdk/">El SDK</a>',
				],
			},
			quiz: {
				date: '2026-09-29',
				title: 'El cuestionario: preguntas que cuentan puntos',
				tag: 'Novedad',
				items: [
					'<strong>Una nueva vista, el cuestionario</strong>: una encuesta en la que cada pregunta puede tener su respuesta correcta y sus puntos —una opción, varias, sí o no, un número, una fecha, o los textos aceptados, sin distinguir mayúsculas ni acentos. <a href="/fonctionnalites/vues/#cuestionario">El cuestionario</a>',
					'<strong>Corregido como quieras</strong>: después de cada pregunta —en verde, o en rojo con la respuesta correcta, la puntuación que crece en la parte superior de la pantalla—, al final, o nunca. Un umbral de aprobación hace decir «¡Aprobado!» o «Esta vez no…».',
					'<strong>La puntuación al final</strong>, en un anillo que se va llenando, y después la corrección de cada pregunta. Se escribe en un campo numérico de la tabla: ordena la cuadrícula por él, ahí está la clasificación.',
					'<strong>Compartido por un enlace, sin trampa</strong>: la página no recibe ninguna respuesta correcta, es el servidor quien corrige y quien cuenta. <a href="/fonctionnalites/formulaires-partages/#un-cuestionario-compartido">Un cuestionario compartido</a>',
					'<strong>Crear una vista</strong>, al final del selector de vistas, organiza los nueve tipos en dos familias —las que muestran las filas, las que recopilan respuestas—, cada una con su icono en color.',
				],
			},
			forms: {
				date: '2026-09-29',
				title: 'Formularios que dan ganas de rellenar',
				tag: 'Novedad',
				items: [
					'<strong>La encuesta ocupa toda la pantalla</strong>: una pregunta a la vez, que llega deslizándose, grandes tarjetas para las opciones, estrellas para una valoración, y todo con el teclado — <strong>Intro</strong>, las letras A, B, C…, S o N, los dígitos. Una elección única pasa sola a la siguiente. <a href="/fonctionnalites/vues/#formulario-y-encuesta">Formulario y encuesta</a>',
					'<strong>Una apariencia propia</strong>: ocho temas, de Claro a Noche pasando por Papel, un color, una fuente, una alineación — la página de un enlace compartido también la lleva.',
					'<strong>Preguntar solo si…</strong>: una pregunta solo se hace si una respuesta anterior lo pide; una pregunta oculta no es obligatoria ni se guarda.',
					'<strong>Nada que configurar para empezar</strong>: un formulario nuevo pregunta lo que responde una persona, no el estado que el equipo rellena después, lleva el color de su tabla y muestra un ejemplo en cada campo. Y el envío se celebra, confeti incluido.',
				],
			},
			formulaLanguages: {
				date: '2026-09-28',
				title: 'Fórmulas en francés o en inglés',
				tag: 'Novedad',
				items: [
					'<strong>Escribe una fórmula en francés o en inglés</strong>, en cualquier pantalla, incluso mezclando ambos: <code>SI</code> o <code>IF</code>, <code>ARRONDI</code> o <code>ROUND</code>, <code>JOURS</code> o <code>DAYS</code>… Los argumentos se separan con <code>;</code> o con <code>,</code>. <a href="/fonctionnalites/tables-et-champs/#fórmulas">Las fórmulas</a>',
					'<strong>Se relee en el idioma de la pantalla</strong>: en francés en una pantalla francesa, en inglés en los otros diecinueve idiomas — fórmulas existentes y el panel «Funciones» incluidos. La API devuelve una fórmula en el idioma que se le pida, y en inglés si no se especifica ninguno.',
					'Las plantillas oficiales, servidas en un idioma distinto del francés, llegan con sus fórmulas en inglés. Nada cambia en la base de datos: mismas columnas, mismo SQL, sin migración.',
				],
			},
			search: {
				date: '2026-09-27',
				title: 'Encontrarlo todo: Ctrl+K',
				tag: 'Novedad',
				items: [
					'<strong>Un único campo para todo</strong> — <strong>Ctrl+K</strong>, o el campo en el centro de la barra superior: tablas, vistas, preguntas, paneles, automatizaciones, columnas y las propias filas, leídas con tus permisos; en una pantalla grande, la vista previa del resultado elegido. <a href="/fonctionnalites/recherche/">La búsqueda</a>',
					'<strong>Escribe como piensas</strong>: sin acentos ni mayúsculas, por iniciales — <code>nc</code> para «Nuevo cliente» —, una falta de ortografía perdonada, <code>clients lyon</code> para buscar «lyon» en la tabla de clientes; lo que abres a menudo sube arriba.',
					'<strong>Todos los comandos con el teclado</strong>: crear, ir a, cerrar, deshacer, cambiar de tema, copiar el enlace de la página. <code>&gt;</code> solo busca comandos, <code>#</code> los objetos, <code>/</code> las filas; <strong>Tab</strong> busca dentro de una tabla o una base.',
					'<strong>¿Tienes una pregunta?</strong> Escríbela: <strong>Preguntar al Copilot</strong> se la plantea a él, en la base abierta.',
				],
			},
			questions: {
				date: '2026-09-27',
				title: 'Preguntas propias, cifras en el texto',
				tag: 'Novedad',
				items: [
					'<strong>Cada uno guarda sus propias preguntas</strong>, sin el nivel Gestión: personales, solo tú las ves; quien gestiona la base las comparte con toda la base o con grupos, como las consultas. <a href="/fonctionnalites/tableaux-de-bord/">Los paneles</a>',
					'<strong>Una pregunta en una pestaña</strong>, junto a las tablas: <strong>Nueva pregunta</strong> y <strong>Nueva pregunta SQL</strong>, en el <strong>+</strong> de la barra de pestañas y en el menú de la base; la pestaña conserva lo que has dejado en ella. <strong>Guardar una copia</strong> hace tuya una pregunta que no puedes modificar.',
					'<strong>Cifras en el texto</strong>: un texto de panel, ahora con formato, cita un valor — <code>{{chiffre_affaires}}</code> — extraído de una tarjeta, una pregunta o un filtro, calculado con los permisos de quien lo lee, incluso en un panel compartido por enlace. <a href="/fonctionnalites/tableaux-de-bord/#cifras-en-el-texto">Cifras en el texto</a>',
					'Las consultas, las vistas SQL y las preguntas también se eliminan desde su menú, con un clic derecho.',
				],
			},
			addresses: {
				date: '2026-09-27',
				title: 'Una dirección para cada pantalla',
				tag: 'Novedad',
				items: [
					'<strong>La dirección sigue a la pantalla</strong>: una tabla, una vista, la ficha de una fila, un panel, una automatización, una pregunta, tu configuración — <code>/bases/ventes/tables/opportunites?ligne=…</code>. Guárdala como favorita, pégala en un mensaje: se llega al mismo sitio, con sus propios permisos. <a href="/fonctionnalites/collaboration/#un-enlace-a-cada-pantalla">Un enlace a cada pantalla</a>',
					'Los botones <strong>atrás</strong> y <strong>adelante</strong> del navegador te devuelven a donde estabas; una dirección que no lleva a nada muestra «Esta página no existe».',
				],
			},
			demo: {
				date: '2026-09-27',
				title: 'Una demo para probar, en tu idioma',
				tag: 'Novedad',
				items: [
					'<strong>La demo</strong>, en <a href="https://demo.basedb.eodia.com">demo.basedb.eodia.com</a>: la cuenta viene rellenada en el idioma de tu navegador, con una base en ese idioma. Se puede leer todo y modificar lo que ya existe; las creaciones, las eliminaciones y la IA están desactivadas, y la base vuelve cada noche a su estado inicial.',
					'<strong>Tu propia demo</strong>: <code>BASEDB_DEMO=1</code> abre una instancia a todo el mundo, con una cuenta compartida por idioma, preparada de antemano. <a href="/hebergement/variables/#demo-pública">Las variables</a>',
					'<strong>Un idioma por enlace</strong>: <code>?lang=de</code> al final de una dirección de basedb muestra en alemán la pantalla de inicio de sesión o una página compartida; así el sitio lleva a la demo en el idioma de la página. <a href="/fonctionnalites/droits/#tu-configuración">Tu configuración</a>',
				],
			},
			templateLanguages: {
				date: '2026-09-27',
				title: 'Las plantillas en tu idioma',
				tag: 'Novedad',
				items: [
					'<strong>Las plantillas oficiales se crean en el idioma de la pantalla</strong>: tablas, campos, opciones, vistas, paneles, automatizaciones, instrucciones de la IA — y filas de ejemplo de un mundo adaptado a cada idioma: la «Boulangerie Martin» de Lyon se convierte en «Martin’s Bakery» en Portland. <a href="/fonctionnalites/modeles/#en-tu-idioma">Las plantillas</a>',
					'La <a href="/modeles/">galería del sitio</a> muestra cada plantilla en el idioma de la página.',
					'<strong>Una plantilla, varios diccionarios</strong>: una plantilla se escribe una sola vez, en francés; cada idioma solo traduce sus textos, y basedb sigue por sí mismo cada etiqueta allí donde se cita. Un diccionario que rompiera la plantilla no se sirve. <a href="/fonctionnalites/modeles/#publicar-una-plantilla-para-todas-las-instancias">Publicar una plantilla</a>',
				],
			},
			details: {
				date: '2026-09-27',
				title: 'Y también',
				items: [
					'<strong>Una plantilla sin sus filas de ejemplo</strong>: «Cargar datos de ejemplo», desmarcada, crea tablas vacías, listas para tus datos. <a href="/fonctionnalites/modeles/#partir-de-una-plantilla">Partir de una plantilla</a>',
					'<strong>La documentación de la API y MCP</strong> de cada base se escribe en el idioma de tu pantalla. <a href="/integrations/api-rest/#la-documentación-generada">La documentación generada</a>',
					'La información sobre herramientas sigue ahora el tema de la aplicación, en todos los lugares donde antes el navegador mostraba la suya; los «Eliminar» de los menús, en rojo; la fecha completa al pasar el cursor sobre la hora de un comentario.',
				],
			},
			languages: {
				date: '2026-09-27',
				title: 'Texto enriquecido, variables, un kanban más legible',
				tag: 'Novedad',
				items: [
					'<strong>Texto enriquecido</strong>: un nuevo tipo de campo, con formato en un editor visual — títulos, listas, citas, enlaces —, saneado al escribirse y protegido por una restricción frente al SQL directo. <a href="/fonctionnalites/tables-et-champs/#texto-enriquecido-y-variables">Texto enriquecido y variables</a>',
					'<strong>Variables</strong>: un texto largo cita una columna de su fila — <code>{{Ville}}</code> — y se lee en todas partes con su valor: cuadrícula, detalles de la fila, API, servidor MCP, vistas compartidas, automatizaciones. La columna conserva la cita, que es lo que lee <code>psql</code>.',
					'<strong>Un kanban más legible</strong>: tarjetas más espaciosas, una imagen de portada y una descripción que cita los valores de la fila — «Entrega el {{Date}} para {{Client}}». <a href="/fonctionnalites/vues/">Las vistas</a>',
					'<strong>Cambiar el nombre en un solo gesto</strong>: un único diálogo para una base, una tabla o un campo; la etiqueta cambia siempre, y un administrador también puede cambiar el nombre en la base de datos, con un análisis de impacto como apoyo. <a href="/fonctionnalites/tables-et-champs/#modificar-la-estructura">Modificar la estructura</a>',
					'<strong>Veinte idiomas</strong>: la interfaz, este sitio y la documentación en francés, inglés, alemán, español, italiano, portugués (Brasil), neerlandés, polaco, checo, sueco, danés, noruego, finés, rumano, húngaro, turco, ucraniano, japonés, chino simplificado y coreano. basedb usa el idioma del navegador; <strong>Configuración › Apariencia › Idioma</strong> fija otro, que te acompaña de un equipo a otro. Los números y las fechas siguen el idioma. <a href="/fonctionnalites/droits/#tu-configuración">Tu configuración</a>',
				],
			},
			flows: {
				date: '2026-09-27',
				title: 'Automatizaciones en flujo',
				tag: 'Novedad',
				items: [
					'<strong>Un editor en grafo</strong>: el desencadenador y, después, cada paso en una tarjeta; un <strong>+</strong> sobre una línea añade un paso en ese punto. Una automatización sencilla sigue cabiendo en dos tarjetas. <a href="/fonctionnalites/automatisations/">Las automatizaciones</a>',
					'<strong>Buscar una fila</strong> — el cliente de un pedido, la última factura impagada — y después modificarla, citarla o vincularla a una fila creada.',
					'<strong>Condiciones con varias ramas</strong>: se toma la primera cuya condición se cumple, «Si no» cuando no se cumple ninguna; después, las ramas vuelven a unirse.',
					'<strong>Los datos pasan de un paso a otro</strong>: <code>{{e2.client}}</code> cita lo que un paso ha encontrado o creado, <code>{{e3.reponse.numero}}</code> lo que ha respondido un webhook; el menú de cada texto solo ofrece lo que seguro que ha ocurrido antes.',
					'<strong>Cada ejecución, paso a paso</strong>: colocada sobre el flujo, traza la rama tomada e indica, para cada paso, qué hizo y cuánto tardó.',
					'<strong>El Copilot de las automatizaciones</strong>: describe lo que la base debe hacer por sí sola, o pregunta por qué ha fallado una ejecución; propone una automatización entera, que colocas en el flujo con un clic, revisas y después guardas — nada se guarda sin ti. <a href="/fonctionnalites/automatisations/#el-copilot">El Copilot</a>',
					'<strong>Preguntar a la IA</strong> en un paso, como en un campo de IA: una instrucción que cita la fila y los pasos anteriores, una respuesta leída como texto, número, sí o no, fecha u opción de una lista, que los pasos siguientes escriben o envían. <a href="/fonctionnalites/automatisations/#preguntar-a-la-ia">Preguntar a la IA</a>',
				],
			},
			dashboards: {
				date: '2026-09-27',
				title: 'Paneles: preguntas, gráficos, filtros',
				tag: 'Novedad',
				items: [
					'<strong>Preguntas</strong> hechas con el ratón — una tabla, sus combinaciones, filtros, medidas por día, semana, mes o año — o escritas en <strong>SQL</strong>, en solo lectura y con tus propios permisos, variables incluidas. <a href="/fonctionnalites/tableaux-de-bord/">Los paneles</a>',
					'<strong>Quince visualizaciones</strong>: cifra, tendencia frente al periodo anterior, progreso hacia un objetivo, medidor, histograma, barras, líneas, áreas, combinado, sectores, embudo, dispersión, tabla, tabla dinámica, mapa de Francia o del mundo.',
					'<strong>Explorar con un clic</strong>: un punto abre sus filas, un periodo más detallado, otro desglose.',
					'<strong>Paneles en cuadrícula</strong>: tarjetas que se mueven y se redimensionan con el ratón, pestañas, títulos de sección, textos, páginas insertadas.',
					'<strong>Filtros comunes</strong> — periodo, categoría, texto, número, agrupación de fechas — que controlan una, varias o todas las tarjetas, con un valor predeterminado.',
					'<strong>Gráficos a tu gusto</strong>: color y nombre de cada serie o de cada porción, anillo, semicírculo o rosa, apilamiento con totales, líneas suavizadas o escalonadas, ejes, marcas, escala logarítmica; tablas con columnas renombradas, con barras y colores según el valor.',
					'<strong>El Copilot de los paneles</strong>: una conversación que propone preguntas, cambios en el panel — que se pueden deshacer — y valores para sus filtros, que se aplican con un clic. Solo la estructura se envía al proveedor, salvo que le permitas leer los resultados. <a href="/fonctionnalites/tableaux-de-bord/#el-copilot">El Copilot</a>',
					'<strong>Compartir un panel</strong> mediante un enlace, público o reservado a los miembros — si hace falta, a algunos grupos — e insertarlo en otro sitio web: tarjetas y filtros en solo lectura, leídos con los permisos de quien lo publicó. <a href="/fonctionnalites/tableaux-de-bord/#compartir-un-panel">Compartir</a>',
					'«Interfaces» pasa a llamarse <strong>Paneles</strong>; los paneles existentes se abren tal cual, sobre la nueva cuadrícula.',
				],
			},
			sqlViews: {
				date: '2026-09-27',
				title: 'Consultas guardadas y vistas SQL',
				tag: 'Novedad',
				items: [
					'<strong>SQL para cada uno</strong>: sin el nivel Gestión, una pestaña SQL se ejecuta en solo lectura, con tus propios permisos, que aplica el propio PostgreSQL — una tabla cerrada no existe, un campo oculto se rechaza. La insignia «Tus permisos» lo recuerda. <a href="/fonctionnalites/requetes-et-vues-sql/">Consultas y vistas SQL</a>',
					'<strong>Consultas guardadas</strong>, colocadas bajo las tablas en la sección «Consultas»: personales, para toda la base o para algunos grupos. Compartir una consulta comparte su texto, nunca lo que su autor puede leer; abierta desde la barra lateral, se ejecuta al instante en solo lectura.',
					'<strong>Vistas SQL</strong>: vistas PostgreSQL reales, colocadas entre las tablas con un color, un icono y un pequeño ojo, legibles también desde <code>psql</code> y tus herramientas. Cada uno las lee con sus propios permisos, y la barra lateral solo las muestra a quien puede leer todo su contenido.',
					'Las vistas siguen a la estructura: un cambio de nombre no las rompe, una fórmula modificada las retira un instante y luego las restablece; la que ya no se sostiene queda pendiente de corregir, con su definición conservada.',
				],
			},
			aiProvider: {
				date: '2026-09-27',
				title: 'La IA que elijas, hasta en tu propia máquina',
				tag: 'Novedad',
				items: [
					'<strong>Un cuarto proveedor de IA</strong>: cualquier servidor que hable la API de OpenAI — Azure, una pasarela empresarial, un modelo servido en tu propia máquina —, declarado en el <code>.env</code>. El registro de las llamadas indica a quién se han enviado los datos. <a href="/fonctionnalites/ia/">La IA en basedb</a>',
					'<strong>La pantalla de inicio de sesión</strong> muestra, tras la cuadrícula y el SQL, un panel que sigue un filtro y una automatización que se ejecuta, paso de IA incluido.',
				],
			},
			settings: {
				date: '2026-09-27',
				title: 'Tu configuración',
				tag: 'Novedad',
				items: [
					'<strong>Configuración</strong>, en el menú del perfil: tu nombre, tu dirección y los proveedores de identidad vinculados a tu cuenta; tu contraseña y tus sesiones abiertas. <a href="/fonctionnalites/droits/">Cuentas e inicio de sesión</a>',
					'<strong>Apariencia</strong>: el tema, el orden de las fechas — <code>25/09/2026</code> o <code>2026-09-25</code> — y el primer día de la semana de los calendarios; los dos últimos te acompañan de un equipo a otro.',
					'<strong>Notificaciones</strong>: desactiva las que ya no quieras, un tipo cada vez. <strong>Tokens</strong>: los que has creado, en todas tus bases, su último uso y su revocación.',
				],
			},
			v020: {
				date: '2026-09-26',
				title: 'Versión 0.2.0: cada uno con su cuenta, sus proyectos y sus invitaciones',
				tag: 'Novedad',
				items: [
					'<strong>Primer inicio de sesión</strong>: en una instancia nueva, la primera página crea la cuenta de administrador, con tu dirección y tu contraseña — se acabaron la cuenta por defecto y la contraseña que había que buscar en los registros. <a href="/guides/installation/">La instalación</a>',
					'<strong>Creación de cuentas</strong>: cada uno crea su cuenta y después sus propios proyectos, de los que pasa a ser gestor. La administración puede cerrarla o reservarla a ciertos dominios. <a href="/hebergement/connexion/">Cuentas e inicio de sesión</a>',
					'<strong>Compartir un proyecto o una base</strong>: quien tiene el nivel Gestión invita mediante un enlace, con Lectura, Edición o Gestión; ve quién tiene acceso, cambia un nivel o lo retira. Nunca más de lo que gestiona.',
					'<strong>Privacidad</strong>: cada uno ya solo ve a las personas con las que comparte un proyecto, y un nombre de proyecto que ya usa otra persona deja de poder adivinarse.',
					'<strong>Inicio de sesión con Google, Microsoft</strong> y cualquier proveedor OpenID Connect (Keycloak, GitLab…), declarados en el <code>.env</code>; un primer inicio de sesión crea la cuenta si la creación de cuentas lo permite. <a href="/hebergement/connexion/">Configurar</a>',
					'<strong>Nueva pantalla de inicio de sesión</strong>, con el tema de la aplicación, claro u oscuro, y una animación comedida; pantallas vacías ilustradas en toda la aplicación.',
					'<strong>Actualizaciones sin pérdidas</strong>: basedb actualiza su catálogo por sí solo al arrancar, incluida una instalación 0.1, y se niega a arrancar sobre una base de datos que una versión más reciente ya ha actualizado. <a href="/hebergement/sauvegardes/">Actualizar</a>',
				],
			},
			dockerImage: {
				date: '2026-09-26',
				title: 'Una sola imagen Docker',
				tag: 'Alojamiento',
				items: [
					'basedb cabe en <strong>una sola imagen</strong>, <code>eodia/basedb</code> en Docker Hub, para amd64 y arm64: la interfaz, la API bajo <code>/api</code> y el servidor MCP bajo <code>/mcp</code>, en <strong>un solo puerto</strong>. <a href="/guides/installation/">La instalación</a>',
					'Bastan dos archivos — <code>docker-compose.yml</code> y <code>.env</code> — sin clonar el repositorio ni compilar nada; la actualización se hace con <code>docker compose pull</code>.',
					'Detrás de un dominio, el proxy HTTPS ya no tiene que enrutar nada: todo va al puerto 3000.',
				],
			},
			automations: {
				date: '2026-09-26',
				title: 'Automatizaciones, interfaces, fórmulas, colaboración',
				tag: 'Novedad',
				items: [
					'<strong>Fórmulas</strong> en francés — <code>SI</code>, <code>ARRONDI</code>, <code>JOURS</code>… — convertidas en columnas generadas por PostgreSQL; <strong>búsquedas</strong>, <strong>acumulados</strong> y <strong>recuentos</strong> a través de las relaciones. <a href="/fonctionnalites/tables-et-champs/">Los campos</a>',
					'<strong>Nuevos tipos</strong>: relación múltiple, persona, correo electrónico, número automático, botón; y formatos que se eligen como tipos — moneda, porcentaje, duración, valoración con estrellas, teléfono, código de barras.',
					'<strong>Ocho vistas</strong>: la <strong>galería</strong> y la <strong>lista</strong> se suman a las otras seis; <strong>vistas personales</strong> para cualquier lector, vistas bloqueadas, orden manual, dependencias en la cronología. <a href="/fonctionnalites/vues/">Las vistas</a>',
					'<strong>La cuadrícula</strong>: búsqueda rápida, agrupación, resumen por columna sobre todo el filtro, colores por reglas, altura de las filas.',
					'<strong>Vistas compartidas</strong> en solo lectura, que se pueden insertar en otro sitio web; un calendario se convierte en un <strong>feed iCalendar</strong> para Google Calendar, Outlook o Apple Calendar. <a href="/fonctionnalites/vues-partagees/">El uso compartido</a>',
					'<strong>Colaboración</strong>: comentarios y menciones, notificaciones, escrituras de los demás en tiempo real, presencia en la tabla y en la fila. <a href="/fonctionnalites/collaboration/">Trabajar en equipo</a>',
					'<strong>Ctrl+Z</strong> deshace la última escritura — una celda, una tarjeta movida, una importación entera — y se niega antes que sobrescribir lo que otra persona haya cambiado desde entonces.',
					'<strong>Automatizaciones</strong>: cuando se crea o se modifica una fila, a una hora fija o con un clic en un botón — modificar, crear, avisar, llamar a un webhook, escribir en Slack. <a href="/fonctionnalites/automatisations/">Automatizar</a>',
					'<strong>Interfaces</strong>: paneles — cifras, gráficos, listas, textos — leídos con los permisos de cada uno. <a href="/fonctionnalites/tableaux-de-bord/">Los paneles</a>',
					'<strong>Integraciones</strong>: un canal de Slack y <strong>tablas sincronizadas</strong> desde un CSV en línea, una agenda o la vista de otro basedb. <a href="/integrations/synchronisation/">Las integraciones</a>',
					'<strong>Plantillas de base</strong>: una galería de diez plantillas, una base descrita en una frase a la IA, y cualquier base se puede guardar como plantilla. <a href="/modeles/">La galería</a>',
					'<strong>Permisos</strong>: la pantalla Estructura pasa a ser de solo consulta para quien no tiene el nivel Gestión.',
					'<strong>Nueva identidad</strong>: un logotipo, una paleta y una pantalla de inicio de sesión rediseñada.',
				],
			},
			simpler: {
				date: '2026-09-26',
				title: 'Una interfaz más sencilla',
				items: [
					'<strong>La barra lateral</strong> ya solo muestra las bases y sus tablas; las pantallas de la base abierta — Estructura, Historial, Interfaces, Automatizaciones — se reúnen en un bloque, justo encima del perfil.',
					'<strong>El menú del perfil</strong> acoge lo que no son datos: la documentación de API y MCP, las integraciones, los usuarios y los permisos.',
					'<strong>Una consulta SQL</strong> se abre con el «+» de la barra de pestañas o desde el menú de la base, sin duplicado en la barra lateral.',
					'<strong>Nueva base</strong> ofrece las plantillas y la IA desde el propio diálogo; la base de demostración pasa por la misma galería.',
					'<strong>La pantalla ya no ofrece lo que se rechazaría</strong>: ningún botón de estructura sin Gestión, ningún «Eliminar» sin permiso para eliminar; y un lector crea sus propias vistas en lugar de toparse con un mensaje.',
					'<strong>Las columnas del sistema</strong> se agrupan en «Información del sistema» en lugar de ofrecerse en cada tabla.',
					'<strong>Los detalles de la fila</strong> incorporan sus comentarios, un botón para escribir o llamar y una valoración que se ajusta con un clic.',
					'<strong>El inicio de sesión</strong> abandona su fondo animado en 3D por una pantalla ligera, que respeta la preferencia «reducir movimiento».',
				],
			},
			environments: {
				date: '2026-09-26',
				title: 'Entornos, formularios compartidos, vistas',
				items: [
					'<strong>Entornos</strong>: producción, preproducción y desarrollo para una misma base; comparación lado a lado, plan de migración, sincronización de filas.',
					'<strong>Historial de estructuras</strong>: cada creación o modificación de tabla y de campo, registrada por un disparador sobre el catálogo.',
					'<strong>Formularios compartidos</strong>: un enlace público o reservado a los miembros, cierre por fecha o por número de respuestas, atribución de las respuestas en el historial.',
					'<strong>Seis vistas</strong>: cuadrícula, kanban, calendario, cronología, formulario, encuesta.',
					'<strong>Historial de datos</strong>: deshacer una modificación, restaurar una fila eliminada.',
					'<strong>IA</strong>: la opción de IA en cualquier campo, y el Copilot.',
					'<strong>Relación</strong> y <strong>URL</strong>: dos tipos distintos; el texto largo se escribe en Markdown.',
					'<strong>Webhooks</strong> firmados y ordenados, <strong>propuestas de los agentes</strong> para aprobar.',
					'<strong>Docker</strong>: un Dockerfile con tres objetivos, un docker-compose completo, un proxy HTTPS opcional.',
				],
			},
			projects: {
				date: '2026-09-25',
				title: 'Proyectos, permisos, servidor MCP',
				items: [
					'<strong>Proyectos</strong> por encima de las bases, y permisos por <strong>grupos</strong> en cuatro niveles: Sin acceso, Lectura, Edición, Gestión.',
					'<strong>Cuentas</strong>: contraseña temporal, cambio en el primer inicio de sesión, elevación para la administración.',
					'<strong>Servidor MCP</strong> y relé stdio; <strong>tokens de integración</strong> comunes a la API REST y al MCP.',
					'<strong>Documentación generada</strong> «API y MCP» para cada base.',
				],
			},
			fields: {
				date: '2026-09-20',
				title: 'Campos, selecciones únicas, importación',
				items: [
					'Modificar un campo y las opciones de una selección única.',
					'<strong>Importación</strong> de archivos CSV y JSON.',
					'El menú de una tabla: cambiar el nombre, describir, eliminar.',
				],
			},
			firstCommit: {
				date: '2026-09-20',
				title: 'Primer commit',
				items: [
					'El monorepo: nomenclatura, registro de códigos de error, catálogo extraído del documento de arquitectura, núcleo, API, interfaz.',
				],
			},
		},
	},
	roadmap: {
		label: 'Hoja de ruta',
		title: 'Lo que viene después',
		intro: 'basedb está en desarrollo activo. Esta página cuenta lo que aún falta, sin fechas prometidas. ¿Una idea, una necesidad? <a href="https://github.com/eodia/basedb/issues">Abre una incidencia</a>. Lo que ya está disponible: las <a href="/nouveautes/">novedades</a>.',
		columns: {
			next: {
				title: 'Próximamente',
				items: {
					restoreTable: {
						title: 'Restaurar una sola tabla',
						text: 'Una tabla eliminada sigue siendo legible en SQL con su nombre relegado; recuperarla por sí sola desde la interfaz está por llegar.',
					},
					aiSettings: {
						title: 'Ajustes de la IA en la interfaz',
						text: 'Proveedor, modelo y clave por espacio de trabajo, sin pasar por el entorno de la API.',
					},
					mail: {
						title: 'Notificaciones e invitaciones por correo electrónico',
						text: 'Las menciones, las respuestas y las asignaciones llegan hoy dentro de basedb, y las invitaciones como un enlace que envías tú mismo; también podrán enviarse por correo electrónico.',
					},
				},
			},
			later: {
				title: 'Después',
				items: {
					formLinks: {
						title: 'Relaciones y archivos en los formularios compartidos',
						text: 'Una búsqueda restringida en la tabla vinculada, una subida de archivos limitada para los visitantes anónimos.',
					},
					moreEvents: {
						title: 'Más eventos notificados',
						text: 'Recibir un aviso de una respuesta a un formulario, de una propuesta de un agente, de un webhook desactivado.',
					},
					sqlViewsAcross: {
						title: 'Vistas SQL de un entorno a otro',
						text: 'Copiar las vistas SQL junto con la estructura al crear o comparar entornos, y en las plantillas de base.',
					},
					loops: {
						title: 'Flujos completos en las plantillas de base',
						text: 'Llevar los flujos de automatización —condiciones, búsquedas, bucles, esperas, PDF— a las plantillas de base, que hoy solo conservan los pasos simples.',
					},
					textFormulas: {
						title: 'Fórmulas de texto',
						text: 'Extraer, reemplazar o truncar una parte de un texto.',
					},
					bulk: {
						title: 'Operaciones masivas declaradas',
						text: 'Modificaciones de miles de filas, registradas en el historial como una sola operación.',
					},
					tombstones: {
						title: 'Purga de las lápidas',
						text: 'La limpieza de los rastros de eliminación que ya no sirven.',
					},
				},
			},
		},
	},
	gallery: {
		label: 'Plantillas',
		title: 'Una base lista en unos segundos',
		intro: 'Cada plantilla crea tablas relacionadas entre sí, filas de ejemplo, vistas, un panel, automatizaciones — y campos que la IA rellena por sí misma. En basedb: <strong>Nueva base</strong> y después <strong>Partir de una plantilla</strong>. ¿Nada encaja? Describe lo que necesitas en una frase: la IA te propone una base a medida.',
		filter: 'Filtrar por categoría',
		all: 'Todas',
		otherCategory: 'Otras',
		ai: '✦ IA',
		tables: {
			one: '{n} tabla',
			many: '{n} tablas',
			other: '{n} tablas',
		},
		rows: {
			one: '{n} fila',
			many: '{n} filas',
			other: '{n} filas',
		},
		views: {
			one: '{n} vista',
			many: '{n} vistas',
			other: '{n} vistas',
		},
		howtoTitle: 'Configurar las plantillas en JSON',
		howto: 'Una plantilla es un archivo JSON: sus tablas, sus campos, sus relaciones, sus filas, sus vistas, sus paneles, sus automatizaciones y las instrucciones de sus campos de IA. Las plantillas de esta página son los archivos de la carpeta <a href="https://github.com/eodia/basedb/tree/main/packages/templates/catalog"><code>packages/templates/catalog</code></a> del repositorio; cada instancia de basedb lee <a href="/modeles/catalogue.json"><code>catalogue.json</code></a> y se las ofrece a sus usuarios. Un administrador también puede importar sus propias plantillas en su instancia, y cualquier base se puede guardar como plantilla.',
		format: {
			href: '/fonctionnalites/modeles/',
			label: 'El formato de las plantillas →',
		},
		back: '← Todas las plantillas',
		defaultCategory: 'Plantilla',
		sampleRows: {
			one: '{n} fila de ejemplo',
			many: '{n} filas de ejemplo',
			other: '{n} filas de ejemplo',
		},
		aiTitle: 'Lo que calcula la IA',
		useTitle: 'Usar esta plantilla',
		useSteps: [
			'En basedb, <strong>Nueva base</strong>.',
			'<strong>Partir de una plantilla</strong> y después «{label}».',
		],
		create: '<strong>Crear la base</strong>.',
		createWithAi: '<strong>Crear la base</strong> — aceptando, si quieres, que los campos de IA los calcule tu proveedor de IA.',
		download: 'Descargar el JSON',
		downloadNote: 'Para importarlo en tu instancia, o adaptarlo antes de proponerlo para el catálogo.',
		viewMeta: '— {kind}, {table}',
		dashboard: '<strong>Panel</strong> «{label}» — {blocks}',
		blocks: {
			one: '{n} bloque',
			many: '{n} bloques',
			other: '{n} bloques',
		},
		automation: '<strong>Automatización</strong> «{label}»',
		yes: 'Sí',
		no: 'No',
		me: 'Tú',
		kinds: {
			short_text: 'Texto corto',
			long_text: 'Texto largo',
			rich_text: 'Texto enriquecido',
			number: 'Número',
			boolean: 'Casilla de verificación',
			date: 'Fecha',
			datetime: 'Fecha y hora',
			select: 'Selección única',
			multi_select: 'Selección múltiple',
			url: 'URL',
			email: 'Correo electrónico',
			user: 'Persona',
			autonumber: 'Número automático',
			formula: 'Fórmula',
			lookup: 'Búsqueda',
			rollup: 'Acumulado',
			count: 'Recuento',
			button: 'Botón',
			link: 'Relación',
			multi_link: 'Relación múltiple',
		},
		viewKinds: {
			grid: 'Cuadrícula',
			kanban: 'Kanban',
			calendar: 'Calendario',
			timeline: 'Cronología',
			gallery: 'Galería',
			list: 'Lista',
			form: 'Formulario',
		},
	},
	templates: {
		demo: {
			label: 'Demo: Atelier Lumen',
			summary: 'Una pequeña agencia, sus clientes, proyectos, tareas, facturas y reseñas: todas las facetas de basedb en una sola base.',
			description: 'La base de demostración. Atelier Lumen es una agencia de diseño ficticia. Su base muestra las relaciones entre tablas, las búsquedas y los acumulados (facturación por cliente, valoración media), las fórmulas (importe con IVA, retraso), tres campos calculados por la IA sobre las reseñas de los clientes (sentimiento, tema, respuesta sugerida), cada tipo de vista — cuadrícula, kanban, calendario, cronología con dependencias, galería, lista, formulario —, un panel y dos automatizaciones.',
			category: 'Demostración',
			tags: ['IA', 'Relaciones', 'Todas las vistas', 'Panel'],
		},
		'analyse-avis': {
			label: 'Análisis de reseñas de clientes',
			summary: 'Recoge las reseñas y deja que la IA extraiga el sentimiento, los temas, la urgencia y un borrador de respuesta.',
			description: 'Para un comercio, un restaurante o una marca: las reseñas llegan desde un formulario público o una importación, y la IA lee cada una. Clasifica el sentimiento, detecta el tema principal, señala las que requieren una respuesta rápida, extrae la sugerencia del cliente y redacta una respuesta para revisar. Los productos acumulan su valoración media y su número de reseñas; un panel sigue la satisfacción.',
			category: 'Relación con el cliente',
			tags: ['IA', 'Formulario', 'Panel'],
		},
		'base-connaissances': {
			label: 'Base de conocimientos',
			summary: 'Artículos de ayuda y preguntas de los clientes: la IA resume, clasifica y propone una respuesta a partir de los artículos.',
			description: 'Para un servicio de soporte. Los artículos de ayuda se ordenan por categoría y se siguen en el tiempo; las preguntas de los clientes llegan mediante un formulario público. La IA resume cada artículo y evalúa su nivel, clasifica cada pregunta y redacta un borrador de respuesta para revisar.',
			category: 'Soporte',
			tags: ['IA', 'Formulario', 'Lista'],
		},
		'calendrier-editorial': {
			label: 'Calendario editorial',
			summary: 'Artículos, publicaciones y newsletters planificados en un calendario; la IA propone ganchos y palabras clave.',
			description: 'Para un equipo de marketing o una redacción. Cada contenido avanza de la idea a la publicación, se sitúa en el calendario de publicaciones y pertenece a una campaña. La IA propone un gancho y palabras clave a partir del brief, y un formulario permite a toda la empresa sugerir un tema.',
			category: 'Marketing',
			tags: ['IA', 'Calendario', 'Kanban', 'Formulario'],
		},
		crm: {
			label: 'CRM comercial',
			summary: 'Empresas, contactos y oportunidades: un pipeline de ventas, las interacciones y la IA que aconseja el siguiente paso.',
			description: 'Un CRM ligero para un equipo comercial. Las oportunidades avanzan por un pipeline, llevan un importe ponderado por su probabilidad, y la IA evalúa su riesgo y aconseja la siguiente acción a partir de las notas. Las interacciones con los clientes se registran y se resumen, y las empresas acumulan lo que representan.',
			category: 'Ventas',
			tags: ['IA', 'Pipeline', 'Kanban', 'Calendario'],
		},
		evenements: {
			label: 'Eventos e inscripciones',
			summary: 'Conferencias, talleres y webinars: las inscripciones, las plazas disponibles y las opiniones de los asistentes, leídas por la IA.',
			description: 'Para organizar eventos recurrentes. Cada evento cuenta sus inscritos y sus plazas disponibles; las inscripciones avanzan hasta la asistencia. Después del evento, los asistentes dejan su opinión, que la IA clasifica por sentimiento y resume. Un formulario público permite unirse a la lista de difusión.',
			category: 'Eventos',
			tags: ['IA', 'Calendario', 'Formulario', 'Acumulados'],
		},
		'gestion-projet': {
			label: 'Gestión de proyectos',
			summary: 'Proyectos, tareas e hitos: una hoja de ruta, dependencias entre tareas, un kanban y un calendario.',
			description: 'Para dirigir varios proyectos en paralelo. Cada proyecto acumula sus tareas y sus horas; las tareas se siguen en un kanban y se planifican en una cronología que dibuja sus dependencias, y los hitos se consultan en un calendario. La IA redacta un parte del estado del proyecto para la dirección a partir de su descripción y su avance.',
			category: 'Organización',
			tags: ['Cronología', 'Dependencias', 'Kanban', 'IA'],
		},
		inventaire: {
			label: 'Inventario y existencias',
			summary: 'Artículos, proveedores y movimientos: las existencias se calculan solas y las roturas de stock se ven venir.',
			description: 'Para un taller, una tienda o unos servicios generales. Cada entrada o salida es un movimiento; las existencias de cada artículo son su suma, su valor una fórmula, y los artículos por debajo de su umbral aparecen en la vista «À commander» (por pedir). La IA redacta la descripción de cada artículo a partir de su nombre y su categoría.',
			category: 'Operaciones',
			tags: ['Acumulados', 'Fórmulas', 'Galería', 'IA'],
		},
		recrutement: {
			label: 'Selección de personal',
			summary: 'Puestos abiertos, candidatos y entrevistas; la IA sintetiza cada candidatura y sugiere los puntos que conviene profundizar.',
			description: 'Un seguimiento de las contrataciones, de la candidatura a la incorporación. Los candidatos se postulan mediante un formulario público y avanzan paso a paso en un kanban, y las entrevistas se planifican en un calendario. La IA lee la carta de presentación y las notas: una síntesis y las preguntas que hacer en la entrevista. Ayuda a leer, no decide.',
			category: 'Recursos humanos',
			tags: ['IA', 'Formulario', 'Kanban', 'Calendario'],
		},
		'suivi-tickets': {
			label: 'Seguimiento de tickets',
			summary: 'Errores y solicitudes clasificados por la IA, seguidos sprint a sprint hasta su resolución, con un formulario para notificarlos.',
			description: 'Un gestor de tickets para un equipo de producto. Cada ticket está vinculado a un componente y a un sprint; la IA propone una categoría, estima la gravedad y resume la incidencia. Un kanban sigue el avance, una cronología muestra los sprints, un formulario permite a cualquiera informar de un problema, y una automatización anota la fecha de resolución.',
			category: 'Producto y tecnología',
			tags: ['IA', 'Kanban', 'Formulario', 'Sprints'],
		},
	},
} satisfies DeepPartial<Dict>;
