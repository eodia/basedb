/**
 * The Brazilian Portuguese texts of the landing pages, laid over the French ones (`fr.ts`).
 *
 * See `../README.md`.
 */
import type { DeepPartial, Dict } from './index';

export default {
	meta: {
		home: {
			title: 'basedb — o banco de dados colaborativo em que cada tabela é uma tabela PostgreSQL de verdade',
			description: 'Grades e dez visões, fórmulas, formulários, quiz e visões compartilhados, comentários, automações, painéis, permissões até o nível do campo, histórico completo, API REST e servidor MCP — em tabelas PostgreSQL de verdade, com nomes legíveis. Auto-hospedado, AGPL-3.0.',
		},
		changelog: {
			title: 'Novidades — basedb',
			description: 'O que mudou no basedb, versão após versão.',
		},
		roadmap: {
			title: 'Roteiro — basedb',
			description: 'O que o basedb vai fazer a seguir.',
		},
		gallery: {
			title: 'Modelos — basedb',
			description: 'Bases prontas para usar: acompanhamento de tickets, análise de avaliações, CRM, recrutamento… com suas linhas de exemplo, suas visões, seus painéis e seus campos calculados pela IA.',
		},
		template: {
			title: '{label} — modelos do basedb',
		},
	},
	eodia: {
		home: 'https://eodia.com/',
		about: 'https://eodia.com/about/',
		contact: 'https://eodia.com/contact/',
	},
	demo: {
		short: 'Demo',
		cta: 'Experimentar a demonstração',
	},
	nav: {
		aria: 'Navegação principal',
		home: 'basedb — início',
		links: [
			{
				href: '/#fonctionnalites',
				label: 'Recursos',
			},
			{
				href: '/modeles/',
				label: 'Modelos',
			},
			{
				href: '/guides/introduction/',
				label: 'Documentação',
			},
			{
				href: '/nouveautes/',
				label: 'Novidades',
			},
		],
		developers: 'Desenvolvedores',
		github: 'O repositório do basedb no GitHub',
		install: 'Instalar',
		menu: {
			open: 'Abrir o menu',
			close: 'Fechar o menu',
			features: {
				label: 'Funcionalidades',
				groups: {
					organize: {
						title: 'Organizar',
						items: {
							tables: {
								href: '/fonctionnalites/tables-et-champs/',
								title: 'Tabelas e campos',
								text: 'Campos para tudo, relações, fórmulas como em uma planilha.',
							},
							views: {
								href: '/fonctionnalites/vues/',
								title: 'Dez visões',
								text: 'Grade, kanban, calendário, linha do tempo, galeria, lista, mapa, formulário, questionário, quiz.',
							},
							forms: {
								href: '/fonctionnalites/formulaires-partages/',
								title: 'Formulários',
								text: 'Um link para compartilhar: cada resposta se torna uma linha.',
							},
							files: {
								href: '/fonctionnalites/fichiers/',
								title: 'Arquivos e imagens',
								text: 'Orçamentos, fotos, contratos, guardados junto com a linha.',
							},
						},
					},
					collaborate: {
						title: 'Colaborar',
						items: {
							live: {
								href: '/fonctionnalites/collaboration/',
								title: 'Tempo real e comentários',
								text: 'Ver os outros trabalhando, comentar uma linha, mencionar um colega.',
							},
							rights: {
								href: '/fonctionnalites/droits/',
								title: 'Permissões e equipes',
								text: 'Quem vê o quê e quem modifica o quê, até a coluna.',
							},
							history: {
								href: '/fonctionnalites/historique/',
								title: 'Histórico',
								text: 'Cada alteração guardada, e reversível.',
							},
							shared: {
								href: '/fonctionnalites/vues-partagees/',
								title: 'Visões compartilhadas',
								text: 'Uma visão por um link, no seu site ou na sua agenda.',
							},
						},
					},
					automate: {
						title: 'Automatizar e analisar',
						items: {
							automations: {
								href: '/fonctionnalites/automatisations/',
								title: 'Automações',
								text: 'Quando uma linha muda: avisar, criar, escrever, perguntar à IA.',
							},
							dashboards: {
								href: '/fonctionnalites/tableaux-de-bord/',
								title: 'Painéis',
								text: 'Quinze visualizações, filtros comuns, um link para compartilhar.',
							},
							ai: {
								href: '/fonctionnalites/ia/',
								title: 'IA e Copilot',
								text: 'Uma base em uma frase, campos que se preenchem sozinhos.',
							},
							templates: {
								href: '/modeles/',
								title: 'Modelos',
								text: 'Dez bases prontas para usar, para adaptar.',
							},
						},
					},
				},
				feature: {
					tag: 'Novo',
					title: 'As automações em fluxo',
					text: 'Buscar, decidir, perguntar à IA: um editor em grafo, e cada execução pode ser revista etapa por etapa.',
					href: '/nouveautes/',
					cta: 'Todas as novidades',
				},
				all: 'Todos os recursos',
			},
			solutions: {
				label: 'Soluções',
				title: 'Para cada equipe',
				items: {
					crm: {
						team: 'Vendas',
						text: 'Pipeline, contatos, retomadas.',
					},
					recrutement: {
						team: 'Recursos humanos',
						text: 'Candidaturas, entrevistas, sínteses pela IA.',
					},
					'calendrier-editorial': {
						team: 'Marketing',
						text: 'Artigos, posts e newsletters planejados.',
					},
					inventaire: {
						team: 'Operações',
						text: 'Um estoque calculado, faltas vistas com antecedência.',
					},
					'gestion-projet': {
						team: 'Projetos',
						text: 'Marcos, tarefas e dependências.',
					},
					'suivi-tickets': {
						team: 'Produto',
						text: 'Bugs e solicitações triados pela IA.',
					},
					'base-connaissances': {
						team: 'Suporte',
						text: 'Artigos de ajuda, perguntas, respostas propostas.',
					},
					evenements: {
						team: 'Eventos',
						text: 'Inscrições, vagas, feedback.',
					},
					'analyse-avis': {
						team: 'Relacionamento com o cliente',
						text: 'Avaliações lidas e classificadas pela IA.',
					},
				},
				ask: {
					title: 'Tem outra coisa em mente?',
					text: 'Descreva sua necessidade em uma frase: a IA propõe uma base sob medida.',
					href: '/modeles/',
				},
				all: 'Todos os modelos',
			},
			developers: {
				label: 'Desenvolvedores',
				groups: {
					build: {
						title: 'Integrar',
						items: {
							api: {
								href: '/integrations/api-rest/',
								title: 'API REST',
								text: 'Os mesmos dados da interface, descritos em OpenAPI 3.1.',
							},
							mcp: {
								href: '/integrations/mcp/',
								title: 'Servidor MCP',
								text: 'Ferramentas para seus agentes de IA, com as suas permissões.',
							},
							webhooks: {
								href: '/integrations/webhooks/',
								title: 'Webhooks',
								text: 'Cada escrita, assinada, ordenada, com novas tentativas.',
							},
							sql: {
								href: '/integrations/sql/',
								title: 'SQL direto',
								text: 'Tabelas PostgreSQL de verdade, com nomes legíveis.',
							},
							sync: {
								href: '/integrations/synchronisation/',
								title: 'Sincronização',
								text: 'Tabelas mantidas atualizadas a partir de outro lugar.',
							},
						},
					},
					host: {
						title: 'Hospedar',
						items: {
							docker: {
								href: '/hebergement/docker/',
								title: 'Docker Compose',
								text: 'Uma imagem, um banco PostgreSQL, uma única porta.',
							},
							env: {
								href: '/hebergement/variables/',
								title: 'Variáveis',
								text: 'Tudo se configura no arquivo .env.',
							},
							https: {
								href: '/hebergement/https/',
								title: 'Domínio e HTTPS',
								text: 'Atrás do seu proxy, ou com o Caddy já incluído.',
							},
							sso: {
								href: '/hebergement/connexion/',
								title: 'Login e SSO',
								text: 'Google, Microsoft, qualquer provedor OpenID Connect.',
							},
							backup: {
								href: '/hebergement/sauvegardes/',
								title: 'Backups e atualizações',
								text: 'pg_dump, e atualizações sem perdas.',
							},
						},
					},
				},
				feature: {
					title: 'A página dos desenvolvedores',
					text: 'Uma tabela PostgreSQL de verdade por trás de cada grade.',
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
								title: 'Documentação',
								text: 'Todo o basedb, passo a passo.',
							},
							start: {
								href: '/guides/premiers-pas/',
								title: 'Primeiros passos',
								text: 'Uma primeira base, da importação à visão.',
							},
							install: {
								href: '/guides/installation/',
								title: 'Instalação',
								text: 'Dois arquivos e um comando.',
							},
							principles: {
								href: '/architecture/principes/',
								title: 'Os princípios',
								text: 'Como o basedb é construído, e por quê.',
							},
						},
					},
					follow: {
						title: 'Seguir o projeto',
						items: {
							news: {
								href: '/nouveautes/',
								title: 'Novidades',
								text: 'O que mudou, versão após versão.',
							},
							roadmap: {
								href: '/feuille-de-route/',
								title: 'Roteiro',
								text: 'O que vem a seguir.',
							},
							github: {
								href: 'https://github.com/eodia/basedb',
								title: 'GitHub',
								text: 'O código, os tickets, as versões.',
							},
							eodia: {
								href: 'https://eodia.com/',
								title: 'Eodia',
								text: 'O estúdio que faz o basedb.',
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
		tagline: 'O banco de dados colaborativo em que cada tabela é uma tabela PostgreSQL de verdade.',
		madeBy: 'Um software livre da <a class="eodia" href="https://eodia.com/">Eodia</a>, estúdio de software nativo em IA.',
		columns: {
			product: {
				title: 'Produto',
				links: [
					{
						href: '/#fonctionnalites',
						label: 'Recursos',
					},
					{
						href: '/nouveautes/',
						label: 'Novidades',
					},
					{
						href: '/feuille-de-route/',
						label: 'Roteiro',
					},
					{
						href: '/#faq',
						label: 'Perguntas frequentes',
					},
				],
			},
			docs: {
				title: 'Documentação',
				links: [
					{
						href: '/guides/introduction/',
						label: 'Introdução',
					},
					{
						href: '/guides/installation/',
						label: 'Instalação',
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
				title: 'Hospedagem',
				links: [
					{
						href: '/hebergement/docker/',
						label: 'Docker Compose',
					},
					{
						href: '/hebergement/variables/',
						label: 'Variáveis de ambiente',
					},
					{
						href: '/hebergement/https/',
						label: 'Domínio e HTTPS',
					},
					{
						href: '/hebergement/sauvegardes/',
						label: 'Backups',
					},
				],
			},
			project: {
				title: 'Projeto',
				links: [
					{
						href: 'https://github.com/eodia/basedb',
						label: 'GitHub',
					},
					{
						href: 'https://github.com/eodia/basedb/tree/main/docs/architecture',
						label: 'Documento de arquitetura',
					},
					{
						href: 'https://github.com/eodia/basedb/blob/main/LICENSE',
						label: 'Licença AGPL-3.0',
					},
					{
						href: 'https://github.com/eodia/basedb/issues',
						label: 'Relatar um problema',
					},
				],
			},
			eodia: {
				title: 'Eodia',
				links: [
					{
						href: 'https://eodia.com/',
						label: 'O estúdio',
					},
					{
						href: 'https://eodia.com/about/',
						label: 'Sobre',
					},
					{
						href: 'https://eodia.com/contact/',
						label: 'Fale conosco',
					},
				],
			},
		},
		copyright: '© {year} <a href="https://eodia.com/">Eodia</a> · AGPL-3.0-or-later',
		builtWith: 'Site construído com Astro e Starlight.',
	},
	docsFooter: {
		madeBy: 'O basedb é um software livre da <a href="https://eodia.com/">Eodia</a>, estúdio de software nativo em IA.',
	},
	teams: {
		meta: {
			title: 'basedb — o banco de dados colaborativo de toda a equipe',
			description: 'Todo o seu trabalho no mesmo lugar, editado por toda a equipe ao mesmo tempo: em tabela, em kanban ou em calendário, com formulários, painéis, automações e IA. Sem código, livre e gratuito.',
		},
		hero: {
			eyebrow: 'basedb',
			title: 'Todo o seu trabalho.',
			titleAccent: 'Finalmente em um só lugar.',
			lead: 'Tabelas, calendários, formulários, painéis e automações, para toda a equipe. Tão simples quanto uma planilha. Sem uma linha de código.',
			primary: 'Conhecer os modelos',
			secondary: 'Ver a demonstração',
			facts: ['Sem código', 'Livre e gratuito', 'Seus dados ficam com você'],
		},
		story: {
			grid: {
				title: 'Toda a equipe, na mesma tabela.',
				text: 'Cada um trabalha nela ao mesmo tempo, e todo mundo vê a mesma coisa, atualizada.',
			},
			copilot: {
				title: 'Pergunte. O Copilot cuida disso.',
				text: '“Quem eu preciso retomar contato esta semana?” — o Copilot sugere o filtro certo, e você o aplica com um clique.',
			},
			kanban: {
				title: 'Arraste. Já está atualizado.',
				text: 'Cada etapa se torna uma coluna; mover um cartão é editar a linha.',
			},
			calendar: {
				title: 'Cada data no seu lugar.',
				text: 'Os compromissos aparecem por conta própria, e acompanham você até a sua agenda.',
			},
			dashboard: {
				title: 'E tudo, de uma olhada.',
				text: 'Os números se calculam sozinhos, a partir das mesmas linhas.',
			},
		},
		stage: {
			aria: 'O acompanhamento de clientes de uma equipe no basedb: tabela, Copilot, kanban, calendário, painel',
			tabs: {
				grid: 'Tabela',
				copilot: 'Copilot',
				kanban: 'Kanban',
				calendar: 'Calendário',
				dashboard: 'Painel',
			},
			project: 'Projeto principal',
			projectMeta: 'Projeto · 2 bases',
			filterNav: 'Filtrar a navegação',
			base: 'Vendas',
			otherBase: 'Suporte',
			tables: ['Clientes', 'Contatos', 'Orçamentos'],
			baseSection: 'Base · Vendas',
			screens: ['Painéis', 'Automações'],
			user: 'Léa Martin',
			views: { grid: 'Todas as linhas', kanban: 'Por etapa', calendar: 'Reuniões' },
			toolbar: {
				filter: 'Filtrar',
				columns: 'Colunas',
				group: 'Agrupar',
				colors: 'Cores',
				sort: 'Ordenar',
				configure: 'Configurar',
			},
			search: 'Buscar…',
			add: 'Adicionar',
			columns: {
				name: 'Cliente',
				status: 'Etapa',
				owner: 'Responsável',
				amount: 'Valor',
				next: 'Próxima reunião',
			},
			statuses: {
				contact: 'A contatar',
				meeting: 'Reunião',
				quote: 'Orçamento enviado',
				signed: 'Assinado',
			},
			clients: [
				'Padaria Martins',
				'Clínica Bela Vista',
				'Colégio Santos Dumont',
				'Bicicletaria Solidária',
				'Empório Bom Sabor',
				'Metalúrgica Rio Verde',
				'Ateliê Moreira',
			],
			addRow: 'Adicionar registro',
			perPage: 'Linhas por página',
			card: 'Acompanhado por {owner}, reunião em {date}',
			addCard: 'Adicionar um cartão',
			today: 'Hoje',
			month: 'Mês',
			week: 'Semana',
			dashboards: 'Painéis',
			questions: 'Perguntas',
			dashboard: 'Acompanhamento comercial',
			dashboardText: 'O essencial, de uma olhada.',
			dashboardTabs: ['Visão geral', 'Atividade'],
			period: 'Período',
			thisYear: 'Este ano',
			share: 'Compartilhar',
			edit: 'Editar',
			explore: 'Explorar os dados',
			chart: 'Valor por cliente',
			byStage: 'Clientes por etapa',
			kpis: {
				signed: 'Assinado',
				pending: 'Orçamentos pendentes',
				rate: 'Clientes assinados',
			},
			copilot: {
				question: 'Quem eu preciso retomar contato esta semana?',
				thinking: 'Pensando…',
				answer: 'Quatro clientes aguardam uma resposta: dois orçamentos enviados e duas reuniões a preparar.',
				card: 'Filtrar Clientes',
				filter: 'Etapa: Orçamento enviado ou Reunião',
				apply: 'Aplicar o filtro',
				applied: 'Filtro aplicado',
				placeholder: 'Pergunte ao Copilot…',
				filtered: '{n} linhas filtradas',
			},
		},
		teaser: {
			tabs: { label: 'Escolher o vídeo', short: 'Em 40 segundos', full: 'O tour completo' },
			titleAccent: 'em 40 segundos.',
			text: 'Tabelas, visualizações, formulários, automações e IA: o essencial do basedb, com música.',
			duration: '40 s',
			inEnglish: 'Os textos do vídeo estão em inglês.',
		},

		video: {
			eyebrow: 'A demonstração',
			title: 'Todo o basedb,',
			titleAccent: 'em sete minutos.',
			text: 'Criar uma base, preenchê-la, compartilhá-la, automatizá-la, pilotá-la: a visita completa, comentada.',
			play: 'Reproduzir vídeo',
			duration: '6 min e 36 s',
			chapters: 'Capítulos',
			captions: 'Inglês',
			inEnglish: 'O vídeo está em inglês, com legendas em inglês.',
			list: [
				{ time: '0:10', title: 'Criar uma base' },
				{ time: '0:49', title: 'Tabelas, campos e fórmulas' },
				{ time: '1:31', title: 'Detalhes da linha e colaboração' },
				{ time: '1:56', title: 'Seis visões sobre as mesmas linhas' },
				{ time: '2:29', title: 'Formulários e questionários' },
				{ time: '3:28', title: 'Quiz' },
				{ time: '4:10', title: 'Automações' },
				{ time: '4:39', title: 'Painéis' },
				{ time: '4:59', title: 'SQL para todos' },
				{ time: '5:30', title: 'Histórico e permissões' },
				{ time: '5:53', title: 'API, MCP e Copilot' },
			],
		},
		together: {
			eyebrow: 'Colaboração',
			title: 'Todo mundo.',
			titleAccent: 'Ao mesmo tempo.',
			text: 'As alterações dos outros chegam em tempo real. Você vê quem está olhando qual linha, comenta onde ela está, e um @ basta para avisar um colega.',
			demo: {
				path: 'Vendas / Orçamentos',
				here: '3 pessoas nesta tabela',
				columns: {
					client: 'Cliente',
					status: 'Etapa',
					amount: 'Valor',
					due: 'Vencimento',
				},
				statuses: {
					draft: 'Rascunho',
					sent: 'Enviado',
					signed: 'Assinado',
				},
				rows: [
					'Padaria Martins',
					'Clínica Bela Vista',
					'Colégio Santos Dumont',
					'Bicicletaria Solidária',
					'Empório Bom Sabor',
					'Metalúrgica Rio Verde',
				],
				comment: '@{name} você pode validar este orçamento até hoje à noite?',
				reply: 'Está validado!',
				toast: '{name} alterou “{field}”',
			},
			points: {
				live: {
					title: 'Em tempo real',
					text: 'Cada alteração aparece imediatamente para os outros, sem recarregar a página.',
				},
				comments: {
					title: 'Comentários e menções',
					text: 'Você comenta uma linha, menciona um colega com @, e o sino avisa.',
				},
				undo: {
					title: 'Desfazer sem risco',
					text: 'Ctrl+Z desfaz a sua última alteração — nunca a de um colega.',
				},
			},
			link: {
				href: '/fonctionnalites/collaboration/',
				label: 'Trabalhar em equipe',
			},
		},
		forms: {
			eyebrow: 'Formulários e questionários',
			title: 'Faça suas perguntas.',
			titleAccent: 'As respostas se organizam sozinhas.',
			text: 'Um formulário em uma única página, ou um questionário que faz uma pergunta por tela, com suas cores: compartilhe o link, e cada resposta vira uma linha da sua tabela. Quem responde não vê mais nada.',
			modes: {
				label: 'Mostrar as perguntas',
				survey: 'Questionário',
				form: 'Formulário',
			},
			demo: {
				title: 'Solicitação de orçamento',
				description: 'Três perguntas, e respondemos para você em até 48 h.',
				count: '3 perguntas',
				start: 'Começar',
				ok: 'OK',
				hint: 'ou Enter',
				submit: 'Enviar minha solicitação',
				org: {
					label: 'Sua organização',
					answer: 'Café das Artes',
				},
				need: {
					label: 'Sua necessidade',
					options: ['Site', 'Identidade visual', 'Catálogo'],
				},
				budget: {
					label: 'Seu orçamento',
					help: 'Sem impostos, mesmo que aproximado.',
				},
				sent: 'Enviado!',
				thanks: 'Obrigado! Respondemos para você em até 48 h.',
				poweredBy: 'Formulário com tecnologia basedb',
				path: 'Vendas / Solicitações',
				view: 'Todas as solicitações',
				columns: {
					org: 'Organização',
					need: 'Necessidade',
					budget: 'Orçamento',
					stage: 'Etapa',
				},
				stages: {
					new: 'Nova',
					called: 'Recontatada',
					quote: 'Orçamento enviado',
				},
				rows: ['Padaria Martins', 'Clínica Bela Vista', 'Bicicletaria Solidária', 'Metalúrgica Rio Verde'],
				open: 'Aberto',
				answers: {
					one: '{n} resposta',
					other: '{n} respostas',
				},
				active: 'Link ativo',
			},
			points: {
				survey: {
					title: 'Uma pergunta por tela',
					text: 'Em tela cheia, pelo teclado: Enter para continuar, A, B, C para escolher — uma escolha única passa sozinha para a próxima, e o envio é comemorado.',
				},
				access: {
					title: 'Público ou reservado',
					text: 'Qualquer pessoa com o link responde sem conta — ou só os membros conectados, e a resposta traz o nome deles.',
				},
				closed: {
					title: 'O resto continua fechado',
					text: 'Responder não mostra mais nada da tabela. O link se fecha em uma data, ou após um número de respostas.',
				},
			},
			link: {
				href: '/fonctionnalites/formulaires-partages/',
				label: 'Os formulários',
			},
		},
		automate: {
			eyebrow: 'Automações',
			title: 'Trabalha',
			titleAccent: 'enquanto você dorme.',
			text: 'Quando uma linha chega ou muda, em um horário fixo ou com um clique em um botão, basedb encadeia as etapas: escolhe a ramificação certa, pergunta à IA, avisa quem for preciso. E cada execução pode ser revisada, etapa por etapa.',
			clock: '03:12',
			crumb: 'Vendas / Automações',
			create: 'Nova automação',
			list: [
				{
					name: 'Nova solicitação',
					when: 'Uma linha é criada',
				},
				{
					name: 'Orçamento assinado',
					when: 'Uma linha é alterada',
				},
				{
					name: 'Lembretes de segunda-feira',
					when: 'Toda segunda-feira às 09:00',
				},
			],
			active: 'Ativa',
			test: 'Testar em uma linha',
			save: 'Salvar',
			when: 'Quando',
			trigger: 'Uma linha é criada',
			table: 'Em Solicitações',
			steps: {
				branch: {
					kind: 'Condição',
					text: '2 ramificações',
					run: 'ramificação “Grande projeto”',
				},
				notify: {
					kind: 'Avisar alguém',
					text: 'Léa Martin',
					run: '1 pessoa notificada',
				},
				create: {
					kind: 'Criar uma linha',
					text: 'Um compromisso, em Agenda',
					run: 'concluído',
				},
				slack: {
					kind: 'Enviar no Slack',
					text: 'No canal #vendas',
					run: 'concluído',
				},
				ai: {
					kind: 'Perguntar à IA',
					text: 'Redigir uma primeira resposta',
					run: 'resposta de {n} caracteres',
				},
				update: {
					kind: 'Editar uma linha',
					text: 'Resposta, Etapa',
					run: 'concluído',
				},
			},
			paths: {
				big: 'Grande projeto',
				condition: 'budget gt 5000',
				otherwise: 'Senão',
			},
			answer: 'Olá, e obrigado por sua solicitação! Léa, que vai cuidar da sua nova identidade visual, liga para você amanhã de manhã.',
			addStep: 'Adicionar uma etapa',
			tabs: {
				settings: 'Ajustes',
				runs: 'Execuções',
			},
			runsText: 'As 50 últimas, mantidas por 30 dias. Escolha uma para ver, no fluxo, o caminho que ela seguiu.',
			running: 'Em andamento',
			succeeded: 'Bem-sucedida',
			started: 'linha criada · {when}',
			now: 'agora mesmo',
			earlier: ['ontem às 18:40', 'ontem às 11:02'],
			done: 'Bem-sucedida · 5 etapas · 1,3 s',
			points: {
				when: {
					title: 'Na hora certa',
					text: 'Uma linha criada ou alterada, um horário fixo, um botão — e uma condição para só disparar quando for preciso.',
				},
				paths: {
					title: 'Vários caminhos',
					text: 'Uma condição abre caminhos, cada um com suas etapas; o que uma etapa encontra, a seguinte pode citar.',
				},
				copilot: {
					title: 'Descrita em uma frase',
					text: '“Quando uma solicitação chega, avise a Léa se o orçamento ultrapassar 5.000 €”: o Copilot constrói o fluxo, você revisa.',
				},
			},
			link: {
				href: '/fonctionnalites/automatisations/',
				label: 'As automações',
			},
		},
		glance: {
			eyebrow: 'Painéis',
			title: 'Veja tudo.',
			titleAccent: 'De uma olhada.',
			text: 'Números, curvas, metas: seus painéis se constroem com o mouse a partir das suas tabelas, e ficam atualizados sozinhos. Um filtro, e todo o painel acompanha.',
			demo: {
				title: 'Gestão comercial',
				filters: ['Este ano', 'Todas as cidades'],
				revenue: 'Faturamento',
				signed: 'Orçamentos assinados',
				rate: 'Taxa de assinatura',
				goal: 'Meta anual',
				byMonth: 'Faturamento por mês',
				byStage: 'Orçamentos por etapa',
				stages: ['Enviados', 'Em negociação', 'Assinados'],
				bySector: 'Clientes por setor',
				sectors: ['Comércio', 'Saúde', 'Educação', 'Indústria'],
				shared: 'Compartilhado por link',
			},
			points: {
				viz: {
					title: 'Quinze visualizações',
					text: 'Números, tendências, metas, curvas, setores, funis, tabelas dinâmicas, mapas.',
				},
				filters: {
					title: 'Filtros comuns',
					text: 'O período, um cliente, uma cidade: um filtro comanda um cartão, vários, ou todo o painel.',
				},
				share: {
					title: 'Compartilhado por um link',
					text: 'Público ou reservado à equipe, e pode ser incorporado a outro site.',
				},
			},
			link: {
				href: '/fonctionnalites/tableaux-de-bord/',
				label: 'Os painéis',
			},
		},
		ai: {
			eyebrow: 'Inteligência artificial',
			title: 'Descreva.',
			titleAccent: 'basedb constrói.',
			text: 'Uma frase basta para obter uma base completa, que você revisa antes de criá-la. Depois, o Copilot propõe filtros, gráficos e automações, e os campos de IA resumem, classificam e redigem no seu lugar.',
			prompt: 'Um acompanhamento das candidaturas para nossas três vagas abertas, com as entrevistas.',
			thinking: 'Três tabelas relacionadas, prontas para revisar.',
			tables: {
				jobs: {
					name: 'Vagas',
					fields: ['Título', 'Departamento', 'Aberta em'],
				},
				people: {
					name: 'Candidatos',
					fields: ['Nome', 'Vaga', 'Etapa', 'Síntese'],
				},
				talks: {
					name: 'Entrevistas',
					fields: ['Candidato', 'Data', 'Com', 'Avaliação'],
				},
			},
			aiField: 'Síntese',
			aiValue: 'Seis anos em gestão de projetos, à vontade com os clientes; a explorar: o inglês.',
			create: 'Criar a base',
			providers: 'Com o fornecedor da sua escolha — OpenAI, Anthropic, Mistral, ou um modelo instalado na sua própria infraestrutura. Nada é enviado sem o seu consentimento.',
			link: {
				href: '/fonctionnalites/ia/',
				label: 'A IA no basedb',
			},
		},
		features: {
			title: 'Tudo que você precisa.',
			titleAccent: 'E muito mais.',
			text: 'Cada função escreve nas mesmas tabelas, com as mesmas permissões, no mesmo histórico.',
			tiles: {
				views: {
					stat: '10',
					title: 'formas de ver seus dados',
					text: 'Grade, kanban, calendário, linha do tempo, galeria, lista, mapa, formulário, questionário e quiz, nas mesmas linhas. Cada pessoa escolhe a sua.',
					href: '/fonctionnalites/vues/',
				},
				history: {
					stat: 'Ctrl+Z',
					title: 'Nada se perde',
					text: 'Cada alteração é guardada com o valor anterior; um erro se desfaz, uma linha excluída se restaura.',
					href: '/fonctionnalites/historique/',
				},
				forms: {
					title: 'Formulários',
					text: 'Um link público ou reservado à equipe: cada resposta chega na tabela, sem abrir o resto.',
					href: '/fonctionnalites/formulaires-partages/',
				},
				viz: {
					stat: '15',
					title: 'visualizações',
					text: 'Números, tendências, metas, curvas, setores, funis, tabelas dinâmicas e mapas.',
					href: '/fonctionnalites/tableaux-de-bord/',
				},
				formulas: {
					code: 'IF([Montant] > 10000, "Grand compte", "")',
					title: 'Fórmulas em francês ou em inglês',
					text: 'Como em uma planilha — SI, ARRONDI, JOURS… ou IF, ROUND, DAYS — mas calculadas para toda a equipe.',
					href: '/fonctionnalites/tables-et-champs/#fórmulas',
				},
				rights: {
					title: 'Cada pessoa vê o que deve ver',
					text: 'Leitura, edição, gerenciamento, equipe por equipe; uma coluna sensível pode ser ocultada.',
					href: '/fonctionnalites/droits/',
				},
				mentions: {
					bubble: '@Camille',
					title: 'Comentários e menções',
					text: 'Você discute uma linha onde ela está, e o sino avisa.',
					href: '/fonctionnalites/collaboration/',
				},
				relations: {
					title: 'Tudo está relacionado',
					text: 'Clientes, projetos, faturas: os totais e as pesquisas atravessam as relações.',
					href: '/fonctionnalites/tables-et-champs/',
				},
				templates: {
					stat: '10',
					title: 'modelos prontos',
					text: 'CRM, recrutamento, estoque, eventos… ou uma base descrita em uma frase para a IA.',
					href: '/modeles/',
				},
				import: {
					title: 'Importar em um gesto',
					text: 'Arraste uma pasta de trabalho Excel ou um CSV: colunas e tipos são identificados, a tabela é criada.',
					href: '/guides/premiers-pas/',
				},
				agenda: {
					title: 'Até na sua agenda',
					text: 'Um calendário se torna um feed para Google Agenda, Outlook ou Apple Calendar.',
					href: '/fonctionnalites/vues-partagees/',
				},
				files: {
					title: 'Arquivos e imagens',
					text: 'Orçamentos, fotos, contratos; uma imagem se torna a capa de um cartão.',
					href: '/fonctionnalites/fichiers/',
				},
				share: {
					title: 'Visões compartilhadas',
					text: 'Uma visão somente leitura por um link, que pode ser incorporada ao seu site.',
					href: '/fonctionnalites/vues-partagees/',
				},
				sync: {
					title: 'Tabelas sincronizadas',
					text: 'Mantidas atualizadas a partir de um CSV on-line, uma agenda ou outro basedb.',
					href: '/integrations/synchronisation/',
				},
				signin: {
					title: 'Login simples',
					text: 'Google, Microsoft ou senha; você convida seus colegas por um link.',
					href: '/hebergement/connexion/',
				},
				languages: {
					title: 'No seu idioma',
					text: 'A interface usa o idioma de cada pessoa, entre vinte.',
					href: '/fonctionnalites/droits/#suas-configurações',
				},
			},
		},
		yours: {
			eyebrow: 'Livre e auto-hospedado',
			per: 'por pessoa. Para sempre.',
			text: 'O basedb é um software livre. Instale-o no seu servidor e convide toda a equipe: sem assinatura, sem licença para contar, e seus dados ficam com você.',
			points: {
				home: {
					title: 'Com você',
					text: 'No seu servidor ou no do seu provedor de hospedagem, com backup como qualquer banco PostgreSQL.',
				},
				free: {
					title: 'Livre',
					text: 'Sob licença AGPL-3.0: o código é aberto, e vai continuar sendo.',
				},
				ai: {
					title: 'A IA da sua escolha',
					text: 'Um fornecedor do mercado, um modelo instalado na sua própria infraestrutura — ou nenhuma IA.',
				},
			},
			link: {
				href: '/guides/installation/',
				label: 'Instalar o basedb',
			},
		},
		gallery: {
			eyebrow: 'Modelos',
			title: 'Pronto em um minuto.',
			text: 'Comece a partir de um modelo, com suas tabelas, suas visões, seu painel e linhas de exemplo, e depois adapte-o à sua forma de trabalhar.',
			use: 'Conhecer',
			ask: {
				title: 'Nada combina?',
				text: 'Descreva sua necessidade em uma frase: a IA propõe uma base sob medida.',
			},
			all: 'Ver todos os modelos',
			previous: 'Modelos anteriores',
			next: 'Próximos modelos',
		},
		developers: {
			title: 'E do lado técnico?',
			text: 'Cada tabela é uma tabela PostgreSQL de verdade. API REST, webhooks, servidor MCP para os agentes de IA, e uma instalação em um único comando.',
			link: 'A página dos desenvolvedores',
		},
		faq: {
			title: 'Suas perguntas',
			items: [
				{
					q: 'Preciso saber programar?',
					a: 'Não. Você cria suas tabelas, visões, formulários, painéis e automações com o mouse. As fórmulas são escritas como em uma planilha, em francês ou em inglês: SI ou IF, ARRONDI ou ROUND, JOURS ou DAYS…',
				},
				{
					q: 'Quanto custa?',
					a: 'Nada: o basedb é um software livre, sem assinatura nem preço por pessoa. Você só precisa de um servidor para instalá-lo.',
				},
				{
					q: 'Como se instala?',
					a: 'Em um servidor, com Docker: dois arquivos e um comando, alguns minutos para quem cuida da sua área de TI. O guia de instalação explica tudo, passo a passo.',
				},
				{
					q: 'Podemos aproveitar nossas planilhas?',
					a: 'Sim: arraste sua pasta de trabalho Excel, ou um CSV, para o basedb. A importação adivinha o tipo de cada coluna, cria a tabela, e diz linha por linha o que não conseguiu aproveitar.',
				},
				{
					q: 'Várias pessoas podem trabalhar juntas, ao mesmo tempo?',
					a: 'É para isso que o basedb serve. As alterações dos outros aparecem em tempo real, você comenta uma linha, menciona um colega com @, e o sino avisa.',
				},
				{
					q: 'E a IA, ela lê nossos dados?',
					a: 'Só se você decidir. Sem um provedor de IA configurado, nada é enviado. Depois, um campo ou uma automação que usa IA só envia o que a sua instrução cita, e sempre com o seu consentimento.',
				},
				{
					q: 'Em qual idioma?',
					a: 'No seu: a interface usa o idioma do seu navegador, entre vinte disponíveis, e cada pessoa pode mudá-lo nas configurações.',
				},
			],
		},
		cta: {
			title: 'Sua equipe merece melhor',
			titleAccent: 'do que um arquivo compartilhado.',
			text: 'Comece a partir de um modelo, convide seus colegas, e deixe os “FINAL (2)” no passado.',
			primary: 'Conhecer os modelos',
			secondary: 'Instalar o basedb',
		},
	},
	hero: {
		badge: 'Novo: automações em fluxo, painéis e visões SQL',
		title: ['O banco de dados', 'colaborativo em que', 'cada tabela é uma tabela'],
		titleAccent: 'PostgreSQL de verdade.',
		lead: 'A simplicidade de uma planilha compartilhada — grades, visões, formulários, permissões — e dados que vivem em tabelas <strong>tipadas e com nomes legíveis</strong>. Sua equipe trabalha na interface; seus scripts, suas ferramentas de BI, seus agentes de IA e o <code>psql</code> leem as mesmas linhas.',
		install: 'Instalar com Docker',
		features: 'Ver os recursos',
		copy: 'Copiar o comando',
		facts: ['Auto-hospedado', 'AGPL-3.0', 'API REST e servidor MCP'],
		demo: {
			url: 'basedb.seu-dominio.com.br',
			project: 'Projeto principal',
			projectMeta: 'Projeto · 2 bases',
			filter: 'Filtrar bases e tabelas',
			sales: 'Vendas',
			support: 'Suporte',
			environment: 'Produção',
			clients: 'Clientes',
			opportunities: 'Oportunidades',
			quotes: 'Orçamentos',
			baseSection: 'Base · Vendas',
			screens: ['Painéis', 'Automações'],
			copilot: '✦ Copilot',
			allRows: '▦ Todas as linhas ▾',
			tools: ['Filtrar', 'Agrupar', 'Cores'],
			search: 'Buscar…',
			add: '+ Adicionar',
			columns: {
				name: 'Nome',
				status: 'Status',
				amount: 'Valor',
				client: 'Cliente',
			},
			statuses: {
				nouveau: 'Novo',
				qualifie: 'Qualificado',
				proposition: 'Proposta',
				negociation: 'Negociação',
				gagne: 'Ganho',
				perdu: 'Perdido',
			},
			deals: {
				portail: {
					name: 'Reformulação do portal',
					client: 'Prefeitura de Serra Clara',
				},
				erp: {
					name: 'Migração de ERP',
					client: 'Grupo Delorme',
				},
				audit: {
					name: 'Auditoria de segurança',
					client: 'Clínica São Roque',
				},
				billetterie: {
					name: 'Bilheteria on-line',
					client: 'Teatro Lua Nova',
				},
				flotte: {
					name: 'Rastreamento de frota',
					client: 'Transportes Kerlann',
				},
				mobile: {
					name: 'Aplicativo móvel',
					client: 'Ateliê Moreau',
				},
				intranet: {
					name: 'Reformulação da intranet',
					client: '',
				},
			},
			toastTitle: 'Formulário “Pedido de orçamento”',
			toastText: 'resposta pública · criou “{name}”',
			cursor: 'Camille',
			psqlRows: '(2 registros)',
		},
	},
	showcase: {
		label: 'A interface, de verdade',
		title: 'Tudo o que sua equipe espera de uma planilha compartilhada.',
		tabs: 'Capturas de tela da interface',
		alt: 'basedb — {labelLower}: {caption}',
		shots: {
			grille: {
				label: 'Grade',
				caption: 'Uma grade que escreve em uma tabela de verdade — e campos calculados: uma duração por fórmula, a cidade do cliente por pesquisa, o número de tarefas por contagem.',
			},
			kanban: {
				label: 'Kanban',
				caption: 'As mesmas linhas em colunas, de acordo com uma seleção única: uma imagem de capa, uma descrição que cita a linha. Arrastar um cartão é editar a linha.',
			},
			galerie: {
				label: 'Galeria',
				caption: 'Cartões com sua imagem, uma cor por status: a galeria, uma das oito formas de ler uma tabela.',
			},
			chronologie: {
				label: 'Linha do tempo',
				caption: 'Barras entre duas datas, e as setas de suas dependências — em vermelho quando a ordem não se sustenta mais.',
			},
			tableaux: {
				label: 'Painéis',
				caption: 'Cartões em grade, em abas, sob filtros comuns: uma tendência, uma meta, séries empilhadas — lidos com as permissões de cada pessoa.',
			},
			automatisations: {
				label: 'Automações',
				caption: 'Quando uma tarefa é marcada como feita, buscar o que resta do projeto; se não restar nada, a IA redige a mensagem de encerramento e o projeto passa para “Entregue”. Cada execução se lê no fluxo, etapa por etapa.',
			},
			commentaires: {
				label: 'Comentários',
				caption: 'A conversa sobre uma linha acontece onde ela está: comentários, menções, notificações.',
			},
			formulaire: {
				label: 'Formulário',
				caption: 'Um formulário é compartilhado por um link, público ou restrito aos membros conectados.',
			},
			historique: {
				label: 'Histórico',
				caption: 'Cada escrita, venha de onde vier — uma pessoa, uma automação, o SQL direto — com os valores anteriores.',
			},
			sql: {
				label: 'SQL',
				caption: 'Uma consulta sobre os nomes verdadeiros, salva abaixo das tabelas para toda a equipe — que cada pessoa executa com as próprias permissões.',
			},
			vuesSql: {
				label: 'Visões SQL',
				caption: 'Visões PostgreSQL de verdade, organizadas entre as tabelas com sua cor e seu ícone — e legíveis pelo psql.',
			},
		},
	},
	features: {
		postgres: {
			label: 'PostgreSQL, sem tradução',
			title: 'Uma grade para a equipe, uma tabela de verdade {para suas ferramentas.}',
			lead: 'Nada de modelo genérico, nada de JSON para tudo, nada de <code>field_1837</code>: uma base é um schema, uma tabela é uma tabela, um campo é uma coluna tipada, com um nome legível.',
			bullets: [
				'<strong>Tipos nativos</strong>: <code>text</code>, <code>numeric</code>, <code>date</code>, <code>timestamptz</code>, <code>boolean</code> — e chaves estrangeiras de verdade para as relações.',
				'<strong>Restrições garantidas pelo banco</strong>: seleções únicas como <code>CHECK</code>, endereços web e e-mails verificados, relações como <code>FOREIGN KEY</code>.',
				'<strong>Fórmulas calculadas pelo PostgreSQL</strong>: <code>JOURS([Fin]; [Début])</code> se torna uma coluna gerada, que o <code>psql</code> lê como as outras.',
				'<strong>O SQL direto continua permitido</strong> — e até ele entra no histórico, por um trigger.',
				'<strong>Consultas e visões SQL</strong> na interface: consultas salvas abaixo das tabelas, para você ou para a equipe, e visões PostgreSQL de verdade organizadas entre elas, que o <code>psql</code> também lê.',
				'<strong>Renomear não é quebrar</strong>: o nome antigo continua sendo servido por um alias de compatibilidade enquanto você migra suas consultas.',
			],
			links: [
				{
					href: '/integrations/sql/',
					label: 'Trabalhar em SQL',
				},
				{
					href: '/fonctionnalites/requetes-et-vues-sql/',
					label: 'Consultas e visões SQL',
				},
				{
					href: '/architecture/principes/',
					label: 'Os princípios',
				},
			],
		},
		automations: {
			label: 'Automatizar',
			title: 'Automações em fluxo, {a IA em cada etapa.}',
			lead: 'Quando uma linha muda, em horário fixo ou com um clique: um editor em grafo encadeia as etapas, e cada execução pode ser revista no fluxo.',
			bullets: [
				'<strong>Um fluxo legível</strong>: o gatilho e depois cada etapa como um cartão; um <strong>+</strong> sobre uma linha adiciona uma etapa naquele ponto.',
				'<strong>Buscar, decidir, escrever</strong>: encontrar uma linha, seguir uma ramificação ou outra conforme condições, editar, criar, notificar, chamar um webhook, escrever no Slack.',
				'<strong>Perguntar à IA</strong> em uma etapa: uma instrução que cita a linha, uma resposta lida como texto, número, data ou opção, que as etapas seguintes reutilizam.',
				'<strong>O Copilot</strong> propõe uma automação inteira a partir de uma frase, ou explica por que uma execução falhou — nada é salvo sem você.',
				'<strong>Com as permissões de quem a escreveu</strong>, e no histórico como qualquer outra escrita.',
			],
			links: [
				{
					href: '/fonctionnalites/automatisations/',
					label: 'As automações',
				},
				{
					href: '/fonctionnalites/automatisations/#o-copilot',
					label: 'O Copilot',
				},
			],
			alt: 'basedb — a automação “Projeto entregue” no editor de fluxo: quando uma tarefa é feita, registrar o horário, buscar o que resta do projeto, seguir a ramificação “Senão”, perguntar à IA a mensagem de encerramento, e então entregar o projeto; à direita, suas últimas execuções, etapa por etapa.',
		},
		dashboards: {
			label: 'Analisar',
			title: 'Painéis {sem sair das suas tabelas.}',
			lead: 'Perguntas feitas com o mouse ou em SQL, quinze visualizações, filtros comuns — cada pessoa os lê com as próprias permissões.',
			bullets: [
				'<strong>Perguntas</strong>: uma tabela, suas junções, filtros e medidas por dia, semana, mês ou ano — ou SQL somente para leitura.',
				'<strong>Quinze visualizações</strong>: número, tendência, progresso, medidor, barras, curvas, pizza, funil, tabela dinâmica, mapa…',
				'<strong>Explorar com um clique</strong>: um ponto abre suas linhas, ou um período mais fino.',
				'<strong>Filtros comuns</strong> que controlam um, vários ou todos os cartões.',
				'<strong>Compartilhar por um link</strong>, público ou restrito aos membros, e incorporar em outro site.',
			],
			links: [
				{
					href: '/fonctionnalites/tableaux-de-bord/',
					label: 'Os painéis',
				},
			],
			alt: 'basedb — um painel: tendência do mês, meta de recebimentos, faturamento por mês, sentimento das avaliações, sob filtros de período e de cliente.',
		},
		rights: {
			label: 'Colaborar sem abrir tudo',
			title: 'Permissões até o campo, {um histórico sem lacunas.}',
			lead: 'As permissões são concedidas a grupos, em um projeto, uma base ou uma tabela, e descem para tudo o que está abaixo. Uma coluna sensível pode ser ocultada de um grupo, ou tornada não editável para ele.',
			bullets: [
				'<strong>Quatro níveis</strong>: Sem acesso, Leitura, Edição, Gerenciamento — que se somam de um grupo para outro.',
				'<strong>Até o SQL segue suas permissões</strong>: na interface, uma consulta só vê as tabelas e os campos abertos para você — e quem aplica isso é o próprio PostgreSQL.',
				'<strong>Cada escrita é capturada</strong> na sua transação: interface, API, agente, formulário público ou SQL direto.',
				'<strong>Uma alteração pode ser desfeita</strong>, uma linha excluída pode ser restaurada, e uma base excluída também.',
				'<strong>A administração pede confirmação</strong>: mudar uma permissão exige ter digitado a senha de novo nos últimos cinco minutos.',
			],
			links: [
				{
					href: '/fonctionnalites/droits/',
					label: 'Permissões e grupos',
				},
				{
					href: '/fonctionnalites/historique/',
					label: 'O histórico',
				},
			],
		},
		agents: {
			label: 'API REST · MCP · webhooks',
			title: 'Seus agentes de IA acessam os dados, {não a chave do cofre.}',
			lead: 'O servidor MCP dá doze ferramentas aos agentes; a API REST, os mesmos dados aos seus programas. Um único ponto de controle das permissões, os mesmos logs.',
			bullets: [
				'<strong>Um token por base</strong>, somente leitura por padrão, nunca com mais permissões do que a pessoa que o criou.',
				'<strong>Um agente não exclui nada</strong> e não muda a estrutura: ele a propõe, uma pessoa aprova.',
				'<strong>Uma documentação gerada</strong> para cada base, filtrada pelas suas permissões, com sua especificação OpenAPI 3.1.',
				'<strong>Webhooks</strong> a cada escrita: assinados, ordenados e com novas tentativas.',
			],
			links: [
				{
					href: '/integrations/mcp/',
					label: 'Conectar um agente',
				},
				{
					href: '/integrations/api-rest/',
					label: 'A API REST',
				},
			],
		},
	},
	sqlVisual: {
		interface: 'Interface',
		title: 'Novo campo · Oportunidades',
		labelField: 'Rótulo',
		labelValue: 'Valor',
		typeField: 'Tipo',
		typeValue: 'Número',
		descriptionField: 'Descrição',
		descriptionValue: 'Valor do contrato sem impostos',
		required: 'Obrigatório',
		ai: 'IA',
		migration: 'uma migração planejada, bloqueios curtos',
	},
	rightsVisual: {
		groups: ['Administradores', 'Comercial', 'Suporte'],
		project: 'Projeto principal',
		sales: 'Vendas',
		opportunities: 'Oportunidades',
		clients: 'Clientes',
		support: 'Suporte',
		inherited: 'herdado',
		levels: {
			none: 'Sem acesso',
			read: 'Leitura',
			edit: 'Edição',
			manage: 'Gerenciamento',
		},
		field: 'Campo “Margem”',
		hidden: 'Oculto',
		sqlChange: '<b>Sessão SQL direta</b> alterou <b>“Migração de ERP”</b>',
		sqlMeta: '02:46 · conexão local · psql',
		sqlDiff: 'Valor: <s>125.000</s> → 130.000',
		undo: '↶ Desfazer',
		formChange: '<b>Formulário “Pedido de orçamento”</b> criou <b>“Reformulação da intranet”</b>',
		formMeta: 'resposta pública · publicado por Camille',
	},
	agentVisual: {
		agent: 'Agente',
		via: 'conectado por MCP · token “Vendas”',
		question: 'Quantas oportunidades estão em negociação, e qual o valor total?',
		listArgs: 'opportunites · statut = Negociação',
		answer: 'Duas oportunidades, <b>R$ 182.000</b> no total: Migração de ERP (R$ 130.000) e Rastreamento de frota (R$ 52.000).',
		request: 'Adicione um campo “Probabilidade” em porcentagem.',
		proposeArgs: 'opportunites · Probabilidade · number',
		proposed: 'Proposta enviada: alguém da equipe precisa aprová-la no basedb.',
		badge: 'Proposta',
		expires: 'expira em 23 h',
		what: 'Adicionar o campo <b>“Probabilidade”</b> (Número) a <b>Oportunidades</b>',
		by: 'Proposta pelo agente · token “Vendas”',
		refuse: 'Recusar',
		approve: 'Aprovar',
	},
	bento: {
		label: 'E todo o resto',
		title: 'O que se espera de uma ferramenta de equipe, sem largar o PostgreSQL.',
		text: 'Cada recurso escreve nas mesmas tabelas, sob as mesmas permissões, no mesmo histórico.',
		more: 'Saiba mais →',
		views: {
			title: 'Dez visões das mesmas linhas',
			text: 'Colaborativas para toda a equipe, ou pessoais só para você: cada pessoa escolhe sua forma de ler, ninguém copia os dados.',
			chips: [
				'Grade',
				'Kanban',
				'Calendário',
				'Linha do tempo',
				'Galeria',
				'Lista',
				'Mapa',
				'Formulário',
				'Questionário',
				'Quiz',
			],
		},
		forms: {
			title: 'Formulários compartilhados',
			text: 'Um link público, ou restrito aos membros conectados. Responder não dá nenhuma permissão sobre a tabela.',
			href: '/fonctionnalites/formulaires-partages/',
		},
		environments: {
			title: 'Ambientes',
			text: 'Uma base, várias variantes. Compare a estrutura, migre de uma para outra, sincronize linhas.',
			chips: ['Produção', 'Homologação', 'Desenvolvimento'],
			href: '/fonctionnalites/environnements/',
		},
		collaboration: {
			title: 'Trabalhar em equipe',
			text: 'As escritas dos outros chegam em tempo real, você vê quem está olhando qual linha, e a conversa acontece onde ela está: comentários, menções, notificações. Ctrl+Z desfaz a última escrita, e recusa em vez de sobrescrever o trabalho de outra pessoa.',
			chips: ['Tempo real', 'Presença', 'Comentários', 'Menções', 'Ctrl+Z'],
			href: '/fonctionnalites/collaboration/',
		},
		small: {
			ai: {
				title: 'IA na grade',
				text: 'Um campo preenchido por um modelo a partir das outras colunas, e um Copilot que sugere filtros, consultas e colunas, aplicados com um clique. OpenAI, Anthropic, Mistral, ou um modelo executado na sua própria máquina.',
				code: 'Resuma {{Notes}} em uma frase',
				href: '/fonctionnalites/ia/',
			},
			formulas: {
				title: 'Relações e fórmulas',
				text: 'Chaves estrangeiras de verdade, fórmulas em francês ou em inglês calculadas pelo PostgreSQL, e pesquisas, agregações e contagens através das relações.',
				code: 'ROUND([Montant HT] * (1 + [Taux de TVA]), 2)',
				href: '/fonctionnalites/tables-et-champs/#fórmulas',
			},
			richText: {
				title: 'Texto formatado e variáveis',
				text: 'Um editor visual para o texto formatado, sanitizado na escrita; e em qualquer texto longo, {{Ville}} é lido com o valor da linha.',
				code: 'Entrega no dia {{Date}} em {{Ville}}',
				href: '/fonctionnalites/tables-et-champs/#texto-formatado-e-variáveis',
			},
			languages: {
				title: 'No seu idioma',
				text: 'A interface usa o idioma do navegador, entre vinte opções; qualquer pessoa pode trocá-lo nas configurações.',
				href: '/fonctionnalites/droits/#suas-configurações',
			},
			sharedViews: {
				title: 'Visões compartilhadas',
				text: 'Uma visão somente leitura por um link, que pode ser incorporada em outro site; um calendário vira um feed para a sua agenda.',
				href: '/fonctionnalites/vues-partagees/',
			},
			syncedTables: {
				title: 'Tabelas sincronizadas',
				text: 'Uma tabela mantida em dia a partir de um CSV on-line, de uma agenda ou da visão compartilhada de outro basedb.',
				href: '/integrations/synchronisation/',
			},
			templates: {
				title: 'Modelos de base',
				text: 'Dez modelos prontos para usar, uma base descrita à IA em uma frase, e a sua salva como modelo.',
				href: '/modeles/',
			},
			files: {
				title: 'Arquivos e imagens',
				text: 'No disco do servidor ou em um armazenamento compatível com S3: AWS, Scaleway, OVH, Cloudflare R2, Garage, MinIO…',
				href: '/fonctionnalites/fichiers/',
			},
			import: {
				title: 'Importação Excel, CSV e JSON',
				text: 'Arraste um arquivo: a importação adivinha os tipos, cria a tabela ou completa uma tabela existente, e informa linha por linha o que foi recusado.',
				href: '/guides/premiers-pas/',
			},
			accounts: {
				title: 'Contas e convites',
				text: 'Cada pessoa cria sua conta e seus projetos, e convida por um link com Leitura, Edição ou Gerenciamento; login por senha, Google, Microsoft ou qualquer provedor OpenID Connect.',
				href: '/hebergement/connexion/',
			},
			webhooks: {
				title: 'Webhooks',
				text: 'Cada escrita pode avisar outro sistema: payloads assinados, entregues em ordem, com novas tentativas.',
				href: '/integrations/webhooks/',
			},
			settings: {
				title: 'Configurações pessoais',
				text: 'Seu idioma, seu tema, a ordem das datas, suas notificações, suas sessões e seus tokens, no mesmo lugar.',
				href: '/fonctionnalites/droits/#suas-configurações',
			},
		},
	},
	selfHost: {
		label: 'Auto-hospedado',
		title: 'Seus dados ficam {com você.}',
		lead: 'O basedb é um software livre (AGPL-3.0): uma única imagem, um banco PostgreSQL, e só — nenhum serviço de terceiros imposto, nenhuma telemetria. Faça backup com <code>pg_dump</code>, leia com qualquer cliente PostgreSQL.',
		services: {
			db: 'PostgreSQL 16, seus dados',
			basedb: 'A interface, a API REST e o servidor MCP, em uma única porta',
			proxy: 'Caddy, HTTPS automático (opcional)',
		},
		links: [
			{
				href: '/hebergement/docker/',
				label: 'Guia do Docker Compose →',
			},
			{
				href: '/hebergement/variables/',
				label: 'Todas as variáveis →',
			},
		],
		steps: [
			{
				title: 'Baixar o basedb',
				code: 'git clone https://github.com/eodia/basedb.git\ncd basedb && cp .env.example .env',
			},
			{
				title: 'Dois segredos no .env',
				code: 'POSTGRES_PASSWORD=uma-senha-forte\n# openssl rand -base64 32\nBASEDB_ENCRYPTION_KEY=…',
			},
			{
				title: 'Iniciar',
				code: 'docker compose up -d\n# depois http://localhost:3000: crie sua conta',
			},
		],
	},
	faq: {
		label: 'Perguntas frequentes',
		title: 'O que mais nos perguntam.',
		text: 'Outra pergunta? <a href="/guides/introduction/">A documentação</a> certamente responde.',
		items: {
			difference: {
				q: 'Em que o basedb difere dos outros bancos de dados colaborativos?',
				a: 'No lugar onde os dados vivem. Onde outros guardam suas linhas em um modelo genérico (colunas numeradas, documentos JSON), o basedb cria uma tabela PostgreSQL de verdade para cada tabela, uma coluna tipada de verdade para cada campo, com nomes legíveis. Seus dados continuam utilizáveis sem o basedb.',
			},
			sql: {
				q: 'Posso escrever diretamente nas tabelas em SQL?',
				a: 'Sim. As restrições (tipos, obrigatoriedade, seleções únicas, chaves estrangeiras) são garantidas pelo próprio PostgreSQL, e um trigger registra no histórico até as escritas feitas em SQL direto, com a sessão que as fez. O console SQL da interface e o psql leem as mesmas tabelas; na interface, cada pessoa escreve SQL com as próprias permissões, salva suas consultas e, se gerencia a base, as transforma em visões PostgreSQL de verdade.',
			},
			ai: {
				q: 'O que é enviado a um provedor de IA?',
				a: 'Nada enquanto você não configurar um provedor. Depois, para os rascunhos de estrutura e o Copilot, só a estrutura e a sua frase são enviadas por padrão; a leitura de dados pelo Copilot é uma caixa de seleção, por conversa. Um modelo de base pedido à IA só envia a sua frase. Um campo de IA envia as colunas que sua instrução cita, após um consentimento explícito.',
			},
			together: {
				q: 'Várias pessoas podem trabalhar na mesma tabela?',
				a: 'Sim. As escritas dos outros aparecem sem recarregar, com o rosto de cada um na tabela ou na linha que está olhando. Você comenta uma linha, menciona alguém com @, e o sino avisa. E o Ctrl+Z só desfaz as suas próprias escritas: ele recusa em vez de sobrescrever o que outra pessoa mudou desde então.',
			},
			languages: {
				q: 'Em quais idiomas?',
				a: 'Vinte: francês, inglês, alemão, espanhol, italiano, português do Brasil, neerlandês, polonês, tcheco, sueco, dinamarquês, norueguês, finlandês, romeno, húngaro, turco, ucraniano, japonês, chinês simplificado e coreano. A interface usa o idioma do navegador, e cada pessoa pode mudá-lo nas configurações; este site e a documentação existem nos mesmos idiomas.',
			},
			agent: {
				q: 'Como um agente de IA se conecta?',
				a: 'Pelo servidor MCP, com um token de integração limitado a uma base, somente leitura por padrão. Um agente lê, cria e edita linhas conforme suas permissões; ele não exclui nada e não muda a estrutura: ele a propõe, e uma pessoa aprova.',
			},
			postgres: {
				q: 'Qual versão do PostgreSQL é necessária?',
				a: 'PostgreSQL 16 ou mais recente, com as extensões pg_trgm e unaccent (disponíveis na imagem oficial). O docker-compose fornecido inicia um PostgreSQL 16; você também pode apontar DATABASE_URL para o seu próprio servidor.',
			},
			production: {
				q: 'Está pronto para produção?',
				a: 'O basedb está em desenvolvimento ativo: o núcleo, a API, o servidor MCP e a interface funcionam e são cobertos por mais de mil testes, mas alguns recursos ainda estão por vir (veja o roteiro). Experimente, e faça backup do seu banco como de qualquer banco PostgreSQL.',
			},
			license: {
				q: 'Sob qual licença?',
				a: 'AGPL-3.0-or-later. Você pode usá-lo, modificá-lo e hospedá-lo livremente; se oferecer uma versão modificada como serviço, compartilha o código-fonte dela.',
			},
		},
	},
	cta: {
		title: 'Seus dados merecem {tabelas de verdade.}',
		text: 'Instale o basedb em poucos minutos, convide sua equipe e mantenha o controle de cada linha.',
		install: 'Instalar o basedb',
		github: 'Ver o código no GitHub',
	},
	changelog: {
		label: 'Novidades',
		title: 'O que mudou no basedb',
		intro: 'Os detalhes de cada mudança estão <a href="https://github.com/eodia/basedb/commits/main">no histórico do repositório</a>. O que vem a seguir: o <a href="/feuille-de-route/">roteiro</a>.',
		entries: {
			applications: {
				date: '2026-09-30',
				title: 'Para os aplicativos que se apoiam no basedb',
				tag: 'Novo',
				items: [
					'<strong>Uma base criada a partir de um modelo em uma única chamada</strong>: o servidor aplica todo o modelo — tabelas, relações, linhas, visões, automações —, ou nada se uma etapa falhar. A galeria também recorre a ela, um aplicativo que também se instala assim. <a href="/integrations/api-rest/#criar-uma-base-a-partir-de-um-modelo">Criar uma base a partir de um modelo</a>',
					'<strong>Verificar um token</strong>: um aplicativo ao qual se passa o token de uma pessoa pergunta ao basedb se ele ainda é válido, e para quem — sua conta, seus grupos. <a href="/integrations/api-rest/#verificar-um-token">Verificar um token</a>',
					'<strong>Seus servidores internos</strong>: webhooks e automações contatam os que você indicar em <code>BASEDB_WEBHOOK_ALLOW</code>, HTTP incluído; um programa também pode acompanhar uma tabela em tempo real com um token de integração. <a href="/integrations/webhooks/#sem-webhook-acompanhar-uma-tabela">Acompanhar uma tabela</a>',
					'<strong>Sob um caminho, atrás de um gateway</strong>: o basedb é publicado em um endereço como <code>https://passerelle.example.com/basedb/</code>, quer o gateway mantenha o caminho, quer o remova. <a href="/hebergement/docker/#atrás-de-um-gateway-sob-um-caminho">Atrás de um gateway</a>',
					'<strong>Um webhook, todas as tabelas de uma vez</strong>: marcar ou desmarcar um evento para todas as tabelas, ou todos os eventos de uma tabela, com um clique.',
				],
			},
			loopsWebhooks: {
				date: '2026-09-30',
				title: 'Automações que percorrem suas linhas e falam com APIs',
				tag: 'Novo',
				items: [
					'<strong>Para cada linha</strong>: uma etapa que repete as suas em cada linha de uma tabela que atende a um filtro — toda segunda-feira, cobrar todas as faturas em aberto, não só a primeira. <a href="/fonctionnalites/automatisations/#para-cada-linha">Para cada linha</a>',
					'<strong>Um webhook que fala com qualquer API</strong>: o método, um endereço que cita a linha, cabeçalhos, um corpo em JSON, em formulário ou em texto, composto com os valores da linha. <a href="/fonctionnalites/automatisations/#chamar-um-serviço">Chamar um serviço</a>',
					'<strong>Uma chave de API permanece secreta</strong>: criptografada, ela nunca mais é exibida — nem na tela, nem pela API, nem para o Copilot — e só é enviada ao host para o qual você a forneceu.',
				],
			},
			maps: {
				date: '2026-09-30',
				title: 'O mapa, e endereços que se encontram',
				tag: 'Novo',
				items: [
					'<strong>Uma décima visão, o mapa</strong>: cada linha em seu lugar, por seu endereço ou por sua latitude e longitude. Um alfinete assume a cor de um status e abre a ficha com um clique. <a href="/fonctionnalites/vues/#mapa">O mapa</a>',
					'<strong>Um endereço é localizado de uma vez por todas</strong>, pelo serviço do OpenStreetMap ou pelo que você escolher: os alfinetes aparecem à medida das respostas, e depois imediatamente. Um endereço não encontrado é contado, nunca descartado em silêncio.',
					'<strong>O formato Endereço</strong> para um texto curto: um clique o abre no mapa, e na ficha, <strong>Localizar endereço</strong> propõe os endereços completos correspondentes. <a href="/fonctionnalites/tables-et-champs/#formatos-de-exibição">Os formatos</a>',
				],
			},
			documents: {
				date: '2026-09-30',
				title: 'Documentos PDF a partir das suas linhas',
				tag: 'Novo',
				items: [
					'<strong>Um orçamento, uma fatura, uma ficha em PDF</strong>, a partir do menu de uma linha: a ficha para impressão sem configurar nada, ou um modelo — textos que citam os campos, os campos da linha, a tabela das linhas vinculadas com seu total, quebras de página. <a href="/fonctionnalites/documents/">Os documentos</a>',
					'<strong>Cada um com suas permissões</strong>: um campo oculto para você não aparece no seu PDF. Os vinte idiomas são escritos nele, chinês, japonês e coreano incluídos, e a API retorna o mesmo documento.',
				],
			},
			rows: {
				date: '2026-09-30',
				title: 'Permissões até a linha, valores padrão, importação do Excel',
				tag: 'Novo',
				items: [
					'<strong>Cada um, suas linhas</strong>: um grupo só vê as linhas de um filtro — “Vendedor” sou eu, “Região” é Norte —, na interface, na API, no servidor MCP como em SQL, onde o PostgreSQL aplica a mesma regra. <a href="/fonctionnalites/droits/#até-a-linha">Até a linha</a>',
					'<strong>Valores padrão</strong>: um valor fixo, a data de hoje, o momento da criação ou a pessoa que cria a linha, preenchidos na tela e aplicados em todo o resto. <a href="/fonctionnalites/tables-et-champs/#valores-padrão">Valores padrão</a>',
					'<strong>Arraste uma pasta de trabalho Excel</strong>: escolha a folha, as datas, os valores e as caixas de seleção chegam tal como são, e uma fórmula fornece seu valor. <a href="/guides/premiers-pas/">Primeiros passos</a>',
				],
			},
			mail: {
				date: '2026-09-30',
				title: 'E-mails',
				tag: 'Novo',
				items: [
					'<strong>Uma etapa “Enviar um e-mail”</strong> nas automações: para um membro, para a pessoa de um campo, para o endereço de um cliente, com os valores da linha no assunto e no texto. <a href="/fonctionnalites/automatisations/">As automações</a>',
					'<strong>As notificações por e-mail</strong> quando você não as leu, agrupadas, a escolher uma a uma nas suas configurações; e <strong>Senha esquecida</strong> é redefinida por um link. <a href="/fonctionnalites/collaboration/#por-e-mail">Por e-mail</a>',
					'Basta indicar à instância o servidor de envio do seu e-mail. <a href="/hebergement/variables/#e-mails">As variáveis</a>',
				],
			},
			integrations: {
				date: '2026-09-30',
				title: 'n8n e um SDK TypeScript',
				tag: 'Novo',
				items: [
					'<strong>Nós para o n8n</strong>: ler e escrever as linhas de uma tabela a partir de um workflow, e disparar um a cada linha criada, alterada ou excluída — por verificação ou por webhook assinado. <a href="/integrations/n8n/">n8n</a>',
					'<strong>Um SDK TypeScript</strong>, com os tipos das suas tabelas gerados a partir da sua instância: uma tabela ou um campo que não existe é um erro antes mesmo de o programa ser executado. <a href="/integrations/sdk/">O SDK</a>',
				],
			},
			quiz: {
				date: '2026-09-29',
				title: 'O quiz: perguntas que contam pontos',
				tag: 'Novo',
				items: [
					'<strong>Uma nova visão, o quiz</strong>: um questionário em que cada pergunta pode ter sua resposta correta e seus pontos — uma opção, várias, sim ou não, um número, uma data, ou os textos aceitos, sem diferenciar maiúsculas nem acentos. <a href="/fonctionnalites/vues/#quiz">O quiz</a>',
					'<strong>Corrigido como você quiser</strong>: depois de cada pergunta — em verde, ou em vermelho com a resposta correta, a pontuação que cresce no topo da tela —, no final, ou nunca. Um limite de aprovação faz a tela dizer “Aprovado!” ou “Dessa vez não…”.',
					'<strong>A pontuação no final</strong>, em um anel que se preenche, e depois a correção de cada pergunta. Ela é escrita em um campo número da tabela: ordene a grade por ele, eis a classificação.',
					'<strong>Compartilhado por um link, sem trapaça</strong>: a página não recebe nenhuma resposta correta, é o servidor que corrige e que conta. <a href="/fonctionnalites/formulaires-partages/#um-quiz-compartilhado">Um quiz compartilhado</a>',
					'<strong>Criar uma visão</strong>, na parte de baixo do seletor de visões, organiza os nove tipos em duas famílias — as que mostram as linhas, as que coletam respostas —, cada uma com seu ícone colorido.',
				],
			},
			forms: {
				date: '2026-09-29',
				title: 'Formulários que dá vontade de preencher',
				tag: 'Novo',
				items: [
					'<strong>O questionário ocupa a tela inteira</strong>: uma pergunta de cada vez, que chega deslizando, cartões grandes para as escolhas, estrelas para uma avaliação, e tudo pelo teclado — <strong>Enter</strong>, as letras A, B, C…, S ou N, os números. Uma escolha única passa sozinha para a próxima. <a href="/fonctionnalites/vues/#formulário-e-questionário">Formulário e questionário</a>',
					'<strong>Uma aparência só sua</strong>: oito temas, de Claro a Noite passando por Papel, uma cor, uma fonte, um alinhamento — a página de um link compartilhado também a usa.',
					'<strong>Perguntar somente se…</strong>: uma pergunta só é feita se uma resposta anterior exigir isso; uma pergunta oculta não é obrigatória nem é salva.',
					'<strong>Nada para configurar no início</strong>: um formulário novo pergunta o que uma pessoa responde, não o status que a equipe preenche depois, usa a cor da sua tabela e mostra um exemplo em cada campo. E o envio é comemorado, confetes inclusos.',
				],
			},
			formulaLanguages: {
				date: '2026-09-28',
				title: 'Fórmulas em francês ou em inglês',
				tag: 'Novo',
				items: [
					'<strong>Digite uma fórmula em francês ou em inglês</strong>, em qualquer tela, até misturando os dois: <code>SI</code> ou <code>IF</code>, <code>ARRONDI</code> ou <code>ROUND</code>, <code>JOURS</code> ou <code>DAYS</code>… Os argumentos são separados por <code>;</code> ou por <code>,</code>. <a href="/fonctionnalites/tables-et-champs/#fórmulas">As fórmulas</a>',
					'<strong>Ela é lida de volta no idioma da tela</strong>: em francês em uma tela em francês, em inglês nos outros dezenove idiomas — fórmulas existentes e o painel “Funções” incluídos. A API devolve uma fórmula no idioma pedido, e em inglês quando nenhum é pedido.',
					'Os modelos oficiais, servidos em um idioma diferente do francês, chegam com as fórmulas deles em inglês. Nada muda na base: mesmas colunas, mesmo SQL, sem migração.',
				],
			},
			search: {
				date: '2026-09-27',
				title: 'Encontrar tudo: Ctrl+K',
				tag: 'Novo',
				items: [
					'<strong>Um único campo para tudo</strong> — <strong>Ctrl+K</strong>, ou o campo no centro da barra superior: tabelas, visões, perguntas, painéis, automações, colunas e as próprias linhas, lidas com suas permissões; em uma tela grande, a pré-visualização do resultado escolhido. <a href="/fonctionnalites/recherche/">A busca</a>',
					'<strong>Digite como você pensa</strong>: sem acentos nem maiúsculas, por iniciais — <code>nc</code> para “Novo cliente” —, um erro de digitação perdoado, <code>clients lyon</code> para buscar “lyon” na tabela de clientes; o que você abre com frequência sobe para o topo.',
					'<strong>Todos os comandos pelo teclado</strong>: criar, ir para, fechar, desfazer, mudar o tema, copiar o link da página. <code>&gt;</code> busca apenas os comandos, <code>#</code> os objetos, <code>/</code> as linhas; <strong>Tab</strong> busca em uma tabela ou uma base.',
					'<strong>Tem uma pergunta?</strong> Digite-a: <strong>Perguntar ao Copilot</strong> a coloca para ele, na base aberta.',
				],
			},
			questions: {
				date: '2026-09-27',
				title: 'Perguntas próprias, números no texto',
				tag: 'Novo',
				items: [
					'<strong>Cada pessoa salva as suas perguntas</strong>, sem o nível Gerenciamento: pessoais, só você as vê; quem gerencia a base as compartilha com toda a base ou com grupos, como as consultas. <a href="/fonctionnalites/tableaux-de-bord/">Os painéis</a>',
					'<strong>Uma pergunta em uma aba</strong>, ao lado das tabelas: <strong>Nova pergunta</strong> e <strong>Nova pergunta SQL</strong>, no <strong>+</strong> da barra de abas e no menu da base; a aba guarda o que você deixou nela. <strong>Salvar uma cópia</strong> torna sua uma pergunta que você não pode modificar.',
					'<strong>Números no texto</strong>: um texto de painel, agora formatado, cita um valor — <code>{{chiffre_affaires}}</code> — retirado de um cartão, uma pergunta ou um filtro, calculado com as permissões de quem lê, até em um painel compartilhado por link. <a href="/fonctionnalites/tableaux-de-bord/#números-no-texto">Números no texto</a>',
					'Consultas, visões SQL e perguntas também podem ser excluídas pelo menu delas, com um clique com o botão direito.',
				],
			},
			addresses: {
				date: '2026-09-27',
				title: 'Um endereço para cada tela',
				tag: 'Novo',
				items: [
					'<strong>O endereço acompanha a tela</strong>: uma tabela, uma visão, os detalhes de uma linha, um painel, uma automação, uma pergunta, suas configurações — <code>/bases/ventes/tables/opportunites?ligne=…</code>. Salve como favorito, cole em uma mensagem: você chega ao mesmo lugar, com as próprias permissões. <a href="/fonctionnalites/collaboration/#um-link-para-cada-tela">Um link para cada tela</a>',
					'Os botões <strong>voltar</strong> e <strong>avançar</strong> do navegador levam você de volta a onde estava; um endereço que não leva a nada mostra “Esta página não existe”.',
				],
			},
			demo: {
				date: '2026-09-27',
				title: 'Uma demo para experimentar, no seu idioma',
				tag: 'Novo',
				items: [
					'<strong>A demo</strong>, em <a href="https://demo.basedb.eodia.com">demo.basedb.eodia.com</a>: a conta já vem preenchida no idioma do seu navegador, com uma base nesse idioma. Você lê tudo e edita o que já existe; criações, exclusões e IA ficam desativadas ali, e a base volta ao estado inicial todas as noites.',
					'<strong>A sua própria demo</strong>: <code>BASEDB_DEMO=1</code> abre uma instância para todos, com uma conta compartilhada por idioma, preparada com antecedência. <a href="/hebergement/variables/#demonstração-pública">As variáveis</a>',
					'<strong>Um idioma por link</strong>: <code>?lang=de</code> no final de um endereço do basedb mostra em alemão a tela de login ou uma página compartilhada; assim, o site leva à demo no idioma da página. <a href="/fonctionnalites/droits/#suas-configurações">Suas configurações</a>',
				],
			},
			templateLanguages: {
				date: '2026-09-27',
				title: 'Os modelos no seu idioma',
				tag: 'Novo',
				items: [
					'<strong>Os modelos oficiais são criados no idioma da tela</strong>: tabelas, campos, opções, visões, painéis, automações, instruções da IA — e linhas de exemplo de um mundo adaptado a cada idioma: a “Boulangerie Martin” de Lyon se torna “Martin’s Bakery” em Portland. <a href="/fonctionnalites/modeles/#no-seu-idioma">Os modelos</a>',
					'A <a href="/modeles/">galeria do site</a> mostra cada modelo no idioma da página.',
					'<strong>Um modelo, vários dicionários</strong>: um modelo é escrito uma vez, em francês; cada idioma só traduz os textos dele, e o basedb acompanha, por si só, cada rótulo onde ele é citado. Um dicionário que quebrasse o modelo não é servido. <a href="/fonctionnalites/modeles/#publicar-um-modelo-para-todas-as-instâncias">Publicar um modelo</a>',
				],
			},
			details: {
				date: '2026-09-27',
				title: 'E também',
				items: [
					'<strong>Um modelo sem as linhas de exemplo</strong>: “Carregar dados de exemplo”, desmarcada, cria tabelas vazias, prontas para os seus dados. <a href="/fonctionnalites/modeles/#começar-de-um-modelo">Começar de um modelo</a>',
					'<strong>A documentação de API e MCP</strong> de cada base é escrita no idioma da sua tela. <a href="/integrations/api-rest/#a-documentação-gerada">A documentação gerada</a>',
					'As dicas agora seguem o tema do aplicativo, em todo lugar onde antes o navegador mostrava as suas; os itens “Excluir” dos menus, em vermelho; a data completa ao passar o mouse sobre o horário de um comentário.',
				],
			},
			languages: {
				date: '2026-09-27',
				title: 'Texto formatado, variáveis, um kanban mais legível',
				tag: 'Novo',
				items: [
					'<strong>Texto formatado</strong>: um novo tipo de campo, formatado em um editor visual — títulos, listas, citações, links —, sanitizado na escrita e protegido por uma restrição contra o SQL direto. <a href="/fonctionnalites/tables-et-champs/#texto-formatado-e-variáveis">Texto formatado e variáveis</a>',
					'<strong>Variáveis</strong>: um texto longo cita uma coluna da sua linha — <code>{{Ville}}</code> — e é lido em todo lugar com o valor dela: grade, detalhes da linha, API, servidor MCP, visões compartilhadas, automações. A coluna guarda a citação, que é o que o <code>psql</code> lê.',
					'<strong>Um kanban mais legível</strong>: cartões mais arejados, uma imagem de capa e uma descrição que cita os valores da linha — “Entrega no dia {{Date}} para {{Client}}”. <a href="/fonctionnalites/vues/">As visões</a>',
					'<strong>Renomear em um só gesto</strong>: uma única caixa de diálogo para uma base, uma tabela ou um campo; o rótulo sempre muda, e um administrador também pode renomear no banco de dados, com a análise de impacto em mãos. <a href="/fonctionnalites/tables-et-champs/#alterar-a-estrutura">Alterar a estrutura</a>',
					'<strong>Vinte idiomas</strong>: a interface, este site e a documentação em francês, inglês, alemão, espanhol, italiano, português (Brasil), neerlandês, polonês, tcheco, sueco, dinamarquês, norueguês, finlandês, romeno, húngaro, turco, ucraniano, japonês, chinês simplificado e coreano. O basedb usa o idioma do navegador; <strong>Configurações › Aparência › Idioma</strong> define outro, que acompanha você de um computador para outro. Os números e as datas seguem o idioma. <a href="/fonctionnalites/droits/#suas-configurações">Suas configurações</a>',
				],
			},
			aiProvider: {
				date: '2026-09-27',
				title: 'A IA da sua escolha, até na sua própria máquina',
				tag: 'Novo',
				items: [
					'<strong>Um quarto provedor de IA</strong>: qualquer servidor que fale a API da OpenAI — Azure, um gateway corporativo, um modelo executado na sua própria máquina —, declarado no <code>.env</code>. O registro das chamadas diz para quem os dados foram enviados. <a href="/fonctionnalites/ia/">A IA no basedb</a>',
					'<strong>A tela de login</strong> mostra, depois da grade e do SQL, um painel que segue um filtro e uma automação em execução, etapa de IA incluída.',
				],
			},
			flows: {
				date: '2026-09-27',
				title: 'Automações em fluxo',
				tag: 'Novo',
				items: [
					'<strong>Um editor em grafo</strong>: o gatilho e depois cada etapa como um cartão; um <strong>+</strong> sobre uma linha adiciona uma etapa naquele ponto. Uma automação simples continua cabendo em dois cartões. <a href="/fonctionnalites/automatisations/">As automações</a>',
					'<strong>Buscar uma linha</strong> — o cliente de um pedido, a última fatura não paga — e depois editá-la, citá-la, vinculá-la a uma linha criada.',
					'<strong>Condições com várias ramificações</strong>: a primeira cuja condição é atendida é seguida, “Senão” quando nenhuma é; as ramificações se juntam depois.',
					'<strong>Os dados passam de uma etapa para outra</strong>: <code>{{e2.client}}</code> cita o que uma etapa encontrou ou criou, <code>{{e3.reponse.numero}}</code> o que um webhook respondeu; o menu de cada texto só oferece o que com certeza aconteceu antes.',
					'<strong>Cada execução, etapa por etapa</strong>: sobreposta ao fluxo, ela traça a ramificação seguida e diz, para cada etapa, o que fez e em quanto tempo.',
					'<strong>O Copilot das automações</strong>: descreva o que a base deve fazer sozinha, ou pergunte por que uma execução falhou; ele propõe uma automação inteira, que você aplica ao fluxo com um clique, revisa e depois salva — nada é salvo sem você. <a href="/fonctionnalites/automatisations/#o-copilot">O Copilot</a>',
					'<strong>Perguntar à IA</strong> em uma etapa, como em um campo de IA: uma instrução que cita a linha e as etapas anteriores, uma resposta lida como texto, número, sim ou não, data ou opção de uma lista, que as etapas seguintes escrevem ou enviam. <a href="/fonctionnalites/automatisations/#perguntar-à-ia">Perguntar à IA</a>',
				],
			},
			dashboards: {
				date: '2026-09-27',
				title: 'Painéis: perguntas, gráficos, filtros',
				tag: 'Novo',
				items: [
					'<strong>Perguntas</strong> feitas com o mouse — uma tabela, suas junções, filtros, medidas por dia, semana, mês ou ano — ou escritas em <strong>SQL</strong>, somente para leitura e com as suas próprias permissões, variáveis incluídas. <a href="/fonctionnalites/tableaux-de-bord/">Os painéis</a>',
					'<strong>Quinze visualizações</strong>: número, tendência em relação ao período anterior, progresso em direção a uma meta, medidor, histograma, barras, curva, áreas, combinado, pizza, funil, dispersão, tabela, tabela dinâmica, mapa da França ou do mundo.',
					'<strong>Explorar com um clique</strong>: um ponto abre suas linhas, um período mais fino, outra divisão.',
					'<strong>Painéis em grade</strong>: cartões movidos e redimensionados com o mouse, abas, títulos de seção, textos, páginas incorporadas.',
					'<strong>Filtros comuns</strong> — período, categoria, texto, número, agrupamento de data — que controlam um, vários ou todos os cartões, com um valor padrão.',
					'<strong>Gráficos do seu jeito</strong>: cor e nome de cada série ou de cada fatia, rosca, semicírculo ou rosa, empilhamento com totais, curvas suavizadas ou em degraus, eixos, graduações, escala logarítmica; tabelas com colunas renomeadas, com barras e cores conforme o valor.',
					'<strong>O Copilot dos painéis</strong>: uma conversa que propõe perguntas, alterações no painel — reversíveis — e valores para seus filtros, aplicados com um clique. Só a estrutura vai para o provedor, a menos que você o autorize a ler os resultados. <a href="/fonctionnalites/tableaux-de-bord/#o-copilot">O Copilot</a>',
					'<strong>Compartilhar um painel</strong> por um link, público ou restrito aos membros — se necessário, a certos grupos — e incorporá-lo em outro site: cartões e filtros somente para leitura, lidos com as permissões de quem o publicou. <a href="/fonctionnalites/tableaux-de-bord/#compartilhar-um-painel">Compartilhar</a>',
					'“Interfaces” agora se chama <strong>Painéis</strong>; os painéis existentes abrem como estavam, na nova grade.',
				],
			},
			sqlViews: {
				date: '2026-09-27',
				title: 'Consultas salvas e visões SQL',
				tag: 'Novo',
				items: [
					'<strong>SQL para todos</strong>: sem o nível Gerenciamento, uma aba SQL é executada somente para leitura, com as suas próprias permissões, aplicadas pelo próprio PostgreSQL — uma tabela fechada não existe, um campo oculto é recusado. A etiqueta “Suas permissões” lembra isso. <a href="/fonctionnalites/requetes-et-vues-sql/">Consultas e visões SQL</a>',
					'<strong>Consultas salvas</strong>, organizadas abaixo das tabelas na seção “Consultas”: pessoais, para toda a base ou para grupos. Compartilhar uma consulta compartilha o texto dela, nunca o que o autor pode ler; aberta pela barra lateral, ela é executada na hora, somente para leitura.',
					'<strong>Visões SQL</strong>: visões PostgreSQL de verdade, organizadas entre as tabelas com uma cor, um ícone e um pequeno olho, legíveis também pelo <code>psql</code> e pelas suas ferramentas. Cada pessoa as lê com as próprias permissões, e a barra lateral só as mostra a quem pode ler tudo o que elas contêm.',
					'As visões acompanham a estrutura: uma renomeação não as quebra, uma fórmula alterada as remove por um instante e depois as recoloca; a que não se sustenta mais fica a corrigir, com a definição preservada.',
				],
			},
			settings: {
				date: '2026-09-27',
				title: 'Suas configurações',
				tag: 'Novo',
				items: [
					'<strong>Configurações</strong>, no menu do perfil: seu nome, seu endereço e os provedores de identidade vinculados à sua conta; sua senha e suas sessões abertas. <a href="/fonctionnalites/droits/">Contas e login</a>',
					'<strong>Aparência</strong>: o tema, a ordem das datas — <code>25/09/2026</code> ou <code>2026-09-25</code> — e o primeiro dia da semana dos calendários; os dois últimos acompanham você de um computador para outro.',
					'<strong>Notificações</strong>: recuse as que você não quer mais, um tipo de cada vez. <strong>Tokens</strong>: os que você criou, em todas as suas bases, seu último uso e sua revogação.',
				],
			},
			v020: {
				date: '2026-09-26',
				title: 'Versão 0.2.0: cada um com sua conta, seus projetos, seus convites',
				tag: 'Novo',
				items: [
					'<strong>Primeiro login</strong>: em uma instância nova, a primeira página cria a conta de administrador, com seu endereço e sua senha — sem conta padrão nem senha para procurar nos logs. <a href="/guides/installation/">A instalação</a>',
					'<strong>Criação de contas</strong>: cada pessoa cria sua conta e depois seus próprios projetos, dos quais se torna gestora. A administração pode fechá-la ou reservá-la a certos domínios. <a href="/hebergement/connexion/">Contas e login</a>',
					'<strong>Compartilhar um projeto ou uma base</strong>: quem tem o nível Gerenciamento convida por um link, com Leitura, Edição ou Gerenciamento; vê quem tem acesso, muda um nível, remove o acesso. Nunca mais do que aquilo que gerencia.',
					'<strong>Privacidade</strong>: cada pessoa passa a ver apenas as pessoas com quem compartilha um projeto, e um nome de projeto já usado por outra pessoa não pode mais ser adivinhado.',
					'<strong>Login com Google, Microsoft</strong> e qualquer provedor OpenID Connect (Keycloak, GitLab…), declarados no <code>.env</code>; um primeiro login cria a conta se a criação de contas permitir. <a href="/hebergement/connexion/">Configurar</a>',
					'<strong>Nova tela de login</strong>, no tema do aplicativo, claro ou escuro, com uma animação discreta; telas vazias ilustradas no aplicativo.',
					'<strong>Atualizações sem perdas</strong>: o basedb atualiza o próprio catálogo na inicialização, inclusive uma instalação 0.1, e se recusa a iniciar em um banco que uma versão mais recente já atualizou. <a href="/hebergement/sauvegardes/">Atualizar</a>',
				],
			},
			dockerImage: {
				date: '2026-09-26',
				title: 'Uma única imagem Docker',
				tag: 'Hospedagem',
				items: [
					'O basedb cabe em <strong>uma única imagem</strong>, <code>eodia/basedb</code> no Docker Hub, para amd64 e arm64: a interface, a API em <code>/api</code> e o servidor MCP em <code>/mcp</code>, em <strong>uma única porta</strong>. <a href="/guides/installation/">A instalação</a>',
					'Dois arquivos bastam — <code>docker-compose.yml</code> e <code>.env</code> — sem clonar o repositório nem compilar nada; a atualização é feita com <code>docker compose pull</code>.',
					'Atrás de um domínio, o proxy HTTPS não precisa mais fazer roteamento: tudo vai para a porta 3000.',
				],
			},
			automations: {
				date: '2026-09-26',
				title: 'Automações, interfaces, fórmulas, colaboração',
				tag: 'Novo',
				items: [
					'<strong>Fórmulas</strong> em francês — <code>SI</code>, <code>ARRONDI</code>, <code>JOURS</code>… — que se tornam colunas geradas pelo PostgreSQL; <strong>pesquisas</strong>, <strong>agregações</strong> e <strong>contagens</strong> através das relações. <a href="/fonctionnalites/tables-et-champs/">Os campos</a>',
					'<strong>Novos tipos</strong>: relação múltipla, pessoa, e-mail, numeração automática, botão; e formatos escolhidos como tipos — moeda, porcentagem, duração, avaliação em estrelas, telefone, código de barras.',
					'<strong>Oito visões</strong>: a <strong>galeria</strong> e a <strong>lista</strong> se juntam às outras seis; <strong>visões pessoais</strong> para qualquer leitor, visões bloqueadas, ordem manual, dependências na linha do tempo. <a href="/fonctionnalites/vues/">As visões</a>',
					'<strong>A grade</strong>: busca rápida, agrupamento, resumo por coluna sobre todo o filtro, cores por regras, altura das linhas.',
					'<strong>Visões compartilhadas</strong> somente para leitura, que podem ser incorporadas em outro site; um calendário vira um <strong>feed iCalendar</strong> para Google Agenda, Outlook ou o Calendário da Apple. <a href="/fonctionnalites/vues-partagees/">O compartilhamento</a>',
					'<strong>Colaboração</strong>: comentários e menções, notificações, escritas dos outros em tempo real, presença na tabela e na linha. <a href="/fonctionnalites/collaboration/">Trabalhar em equipe</a>',
					'<strong>Ctrl+Z</strong> desfaz a última escrita — uma célula, um cartão movido, uma importação inteira — e recusa em vez de sobrescrever o que outra pessoa mudou desde então.',
					'<strong>Automações</strong>: quando uma linha é criada ou alterada, em horário fixo ou com um clique em um botão — editar, criar, notificar, chamar um webhook, escrever no Slack. <a href="/fonctionnalites/automatisations/">Automatizar</a>',
					'<strong>Interfaces</strong>: painéis — números, gráficos, listas, textos — lidos com as permissões de cada pessoa. <a href="/fonctionnalites/tableaux-de-bord/">Os painéis</a>',
					'<strong>Integrações</strong>: um canal do Slack e <strong>tabelas sincronizadas</strong> a partir de um CSV on-line, de uma agenda ou da visão de outro basedb. <a href="/integrations/synchronisation/">As integrações</a>',
					'<strong>Modelos de base</strong>: uma galeria de dez modelos, uma base descrita à IA em uma frase, e qualquer base pode ser salva como modelo. <a href="/modeles/">A galeria</a>',
					'<strong>Permissões</strong>: a tela Estrutura passa a ser somente para consulta para quem não tem o nível Gerenciamento.',
					'<strong>Nova identidade</strong>: um logotipo, uma paleta e uma tela de login refeita.',
				],
			},
			simpler: {
				date: '2026-09-26',
				title: 'Uma interface mais simples',
				items: [
					'<strong>A barra lateral</strong> passa a listar apenas as bases e suas tabelas; as telas da base aberta — Estrutura, Histórico, Interfaces, Automações — ficam reunidas em um bloco, logo acima do perfil.',
					'<strong>O menu do perfil</strong> reúne o que não é dado: a documentação de API e MCP, as integrações, os usuários e as permissões.',
					'<strong>Uma consulta SQL</strong> se abre pelo “+” da barra de abas ou pelo menu da base, sem duplicata na barra lateral.',
					'<strong>Nova base</strong> oferece os modelos e a IA já na caixa de diálogo; a base de demonstração passa pela mesma galeria.',
					'<strong>A tela não oferece mais o que seria recusado</strong>: nenhum botão de estrutura sem Gerenciamento, nenhum “Excluir” sem permissão para excluir; e um leitor cria as próprias visões em vez de esbarrar em uma mensagem.',
					'<strong>As colunas de sistema</strong> ficam agrupadas em “Informações do sistema” em vez de serem oferecidas em cada tabela.',
					'<strong>Os detalhes da linha</strong> ganham seus comentários, um botão para enviar e-mail ou ligar, e uma avaliação definida com um clique.',
					'<strong>O login</strong> abandona o fundo animado em 3D por uma tela leve, que respeita a preferência “reduzir movimento”.',
				],
			},
			environments: {
				date: '2026-09-26',
				title: 'Ambientes, formulários compartilhados, visões',
				items: [
					'<strong>Ambientes</strong>: produção, homologação e desenvolvimento para uma mesma base; comparação lado a lado, plano de migração, sincronização das linhas.',
					'<strong>Histórico das estruturas</strong>: cada criação ou alteração de tabela e de campo, capturada por um trigger no catálogo.',
					'<strong>Formulários compartilhados</strong>: um link público ou restrito aos membros, encerramento por data ou por número de respostas, atribuição das respostas no histórico.',
					'<strong>Seis visões</strong>: grade, kanban, calendário, linha do tempo, formulário, questionário.',
					'<strong>Histórico dos dados</strong>: desfazer uma alteração, restaurar uma linha excluída.',
					'<strong>IA</strong>: a opção de IA em qualquer campo, e o Copilot.',
					'<strong>Relação</strong> e <strong>URL</strong>: dois tipos distintos; o texto longo é escrito em Markdown.',
					'<strong>Webhooks</strong> assinados e ordenados, <strong>propostas dos agentes</strong> a aprovar.',
					'<strong>Docker</strong>: um Dockerfile com três alvos, um docker-compose completo, um proxy HTTPS opcional.',
				],
			},
			projects: {
				date: '2026-09-25',
				title: 'Projetos, permissões, servidor MCP',
				items: [
					'<strong>Projetos</strong> acima das bases, e permissões por <strong>grupos</strong> em quatro níveis: Sem acesso, Leitura, Edição, Gerenciamento.',
					'<strong>Contas</strong>: senha temporária, troca no primeiro login, elevação para a administração.',
					'<strong>Servidor MCP</strong> e relay stdio; <strong>tokens de integração</strong> comuns à API REST e ao MCP.',
					'<strong>Documentação gerada</strong> “API e MCP” para cada base.',
				],
			},
			fields: {
				date: '2026-09-20',
				title: 'Campos, seleções únicas, importação',
				items: [
					'Editar um campo e as opções de uma seleção única.',
					'<strong>Importação</strong> de arquivos CSV e JSON.',
					'O menu de uma tabela: renomear, descrever, excluir.',
				],
			},
			firstCommit: {
				date: '2026-09-20',
				title: 'Primeiro commit',
				items: [
					'O monorepo: nomenclatura, registro dos códigos de erro, catálogo extraído do documento de arquitetura, núcleo, API, interface.',
				],
			},
		},
	},
	roadmap: {
		label: 'Roteiro',
		title: 'O que vem a seguir',
		intro: 'O basedb está em desenvolvimento ativo. Esta página diz o que ainda falta, sem data prometida. Uma ideia, uma necessidade? <a href="https://github.com/eodia/basedb/issues">Abra uma issue</a>. O que já existe: as <a href="/nouveautes/">novidades</a>.',
		columns: {
			next: {
				title: 'Em breve',
				items: {
					restoreTable: {
						title: 'Restaurar uma tabela sozinha',
						text: 'Uma tabela excluída continua legível em SQL sob seu nome rebaixado; trazê-la de volta sozinha pela interface ainda está por vir.',
					},
					aiSettings: {
						title: 'Ajustes da IA na interface',
						text: 'Provedor, modelo e chave por espaço de trabalho, sem passar pelo ambiente da API.',
					},
					mail: {
						title: 'Notificações e convites por e-mail',
						text: 'As menções, as respostas e as designações chegam hoje no basedb, e os convites como um link que você mesmo envia; eles também poderão ser enviados por e-mail.',
					},
				},
			},
			later: {
				title: 'Depois',
				items: {
					formLinks: {
						title: 'Relações e arquivos nos formulários compartilhados',
						text: 'Uma busca restrita na tabela vinculada, um envio de arquivos limitado para visitantes anônimos.',
					},
					moreEvents: {
						title: 'Mais eventos notificados',
						text: 'Ser avisado de uma resposta a um formulário, de uma proposta de agente, de um webhook desativado.',
					},
					sqlViewsAcross: {
						title: 'Visões SQL de um ambiente para outro',
						text: 'Copiar as visões SQL com a estrutura ao criar ou comparar ambientes, e nos modelos de base.',
					},
					loops: {
						title: 'Esperas nas automações',
						text: 'Esperar antes da etapa seguinte (“três dias depois”) e levar os fluxos — condições, buscas, loops — para os modelos de base.',
					},
					textFormulas: {
						title: 'Fórmulas de texto',
						text: 'Extrair, substituir ou truncar uma parte de um texto.',
					},
					bulk: {
						title: 'Operações em massa declaradas',
						text: 'Alterações em milhares de linhas, registradas no histórico como uma única operação.',
					},
					tombstones: {
						title: 'Limpeza das lápides',
						text: 'A remoção dos rastros de exclusão que não servem mais.',
					},
				},
			},
		},
	},
	gallery: {
		label: 'Modelos',
		title: 'Uma base pronta em segundos',
		intro: 'Cada modelo cria tabelas vinculadas entre si, linhas de exemplo, visões, um painel, automações — e campos que a própria IA preenche. No basedb: <strong>Nova base</strong> e depois <strong>Começar de um modelo</strong>. Nada serve? Descreva sua necessidade em uma frase: a IA propõe uma base sob medida.',
		filter: 'Filtrar por categoria',
		all: 'Todos',
		otherCategory: 'Outros',
		ai: '✦ IA',
		tables: {
			one: '{n} tabela',
			many: '{n} tabelas',
			other: '{n} tabelas',
		},
		rows: {
			one: '{n} linha',
			many: '{n} linhas',
			other: '{n} linhas',
		},
		views: {
			one: '{n} visão',
			many: '{n} visões',
			other: '{n} visões',
		},
		howtoTitle: 'Configurar os modelos em JSON',
		howto: 'Um modelo é um arquivo JSON: suas tabelas, seus campos, suas relações, suas linhas, suas visões, seus painéis, suas automações e as instruções dos seus campos de IA. Os modelos desta página são os arquivos da pasta <a href="https://github.com/eodia/basedb/tree/main/packages/templates/catalog"><code>packages/templates/catalog</code></a> do repositório; cada instância do basedb lê <a href="/modeles/catalogue.json"><code>catalogue.json</code></a> e os oferece aos seus usuários. Um administrador também pode importar os próprios modelos na sua instância, e qualquer base pode ser salva como modelo.',
		format: {
			href: '/fonctionnalites/modeles/',
			label: 'O formato dos modelos →',
		},
		back: '← Todos os modelos',
		defaultCategory: 'Modelo',
		sampleRows: {
			one: '{n} linha de exemplo',
			many: '{n} linhas de exemplo',
			other: '{n} linhas de exemplo',
		},
		aiTitle: 'O que a IA calcula',
		useTitle: 'Usar este modelo',
		useSteps: [
			'No basedb, <strong>Nova base</strong>.',
			'<strong>Começar de um modelo</strong> e depois “{label}”.',
		],
		create: '<strong>Criar a base</strong>.',
		createWithAi: '<strong>Criar a base</strong> — aceitando, se quiser, que os campos de IA sejam calculados pelo seu provedor de IA.',
		download: 'Baixar o JSON',
		downloadNote: 'Para importá-lo na sua instância, ou adaptá-lo antes de propô-lo ao catálogo.',
		viewMeta: '— {kind}, {table}',
		dashboard: '<strong>Painel</strong> “{label}” — {blocks}',
		blocks: {
			one: '{n} bloco',
			many: '{n} blocos',
			other: '{n} blocos',
		},
		automation: '<strong>Automação</strong> “{label}”',
		yes: 'Sim',
		no: 'Não',
		me: 'Você',
		kinds: {
			short_text: 'Texto curto',
			long_text: 'Texto longo',
			rich_text: 'Texto formatado',
			number: 'Número',
			boolean: 'Caixa de seleção',
			date: 'Data',
			datetime: 'Data e hora',
			select: 'Seleção única',
			multi_select: 'Seleção múltipla',
			url: 'URL',
			email: 'E-mail',
			user: 'Pessoa',
			autonumber: 'Numeração automática',
			formula: 'Fórmula',
			lookup: 'Pesquisa',
			rollup: 'Agregação',
			count: 'Contagem',
			button: 'Botão',
			link: 'Relação',
			multi_link: 'Relação múltipla',
		},
		viewKinds: {
			grid: 'Grade',
			kanban: 'Kanban',
			calendar: 'Calendário',
			timeline: 'Linha do tempo',
			gallery: 'Galeria',
			list: 'Lista',
			form: 'Formulário',
		},
	},
	templates: {
		demo: {
			label: 'Demonstração: Atelier Lumen',
			summary: 'Uma pequena agência, seus clientes, projetos, tarefas, faturas e avaliações: todas as facetas do basedb em uma única base.',
			description: 'A base de demonstração. O Atelier Lumen é uma agência de design fictícia. Sua base mostra as relações entre tabelas, as pesquisas e agregações (faturamento por cliente, nota média), as fórmulas (valor com impostos, atraso), três campos calculados pela IA sobre as avaliações dos clientes (sentimento, tema, resposta sugerida), cada tipo de visão — grade, kanban, calendário, linha do tempo com dependências, galeria, lista, formulário —, um painel e duas automações.',
			category: 'Demonstração',
			tags: ['IA', 'Relações', 'Todas as visões', 'Painel'],
		},
		'analyse-avis': {
			label: 'Análise de avaliações de clientes',
			summary: 'Colete as avaliações e deixe a IA extrair o sentimento, os temas, a urgência e um rascunho de resposta.',
			description: 'Para uma loja, um restaurante ou uma marca: as avaliações chegam de um formulário público ou de uma importação, e a IA lê cada uma delas. Ela classifica o sentimento, identifica o tema principal, sinaliza as que pedem uma resposta rápida, extrai a sugestão do cliente e redige uma resposta para revisar. Os produtos agregam sua nota média e seu número de avaliações; um painel acompanha a satisfação.',
			category: 'Relacionamento com o cliente',
			tags: ['IA', 'Formulário', 'Painel'],
		},
		'base-connaissances': {
			label: 'Base de conhecimento',
			summary: 'Artigos de ajuda e perguntas dos clientes: a IA resume, classifica e propõe uma resposta a partir dos artigos.',
			description: 'Para uma equipe de suporte. Os artigos de ajuda são organizados por categoria e acompanhados ao longo do tempo; as perguntas dos clientes chegam por um formulário público. A IA resume cada artigo e avalia seu nível, classifica cada pergunta e redige um rascunho de resposta para revisar.',
			category: 'Suporte',
			tags: ['IA', 'Formulário', 'Lista'],
		},
		'calendrier-editorial': {
			label: 'Calendário editorial',
			summary: 'Artigos, posts e newsletters planejados em um calendário; a IA sugere chamadas e palavras-chave.',
			description: 'Para uma equipe de marketing ou uma redação. Cada conteúdo avança da ideia à publicação, ocupa seu lugar no calendário de publicações e pertence a uma campanha. A IA sugere uma chamada e palavras-chave a partir do briefing, e um formulário permite que toda a empresa sugira um tema.',
			category: 'Marketing',
			tags: ['IA', 'Calendário', 'Kanban', 'Formulário'],
		},
		crm: {
			label: 'CRM comercial',
			summary: 'Empresas, contatos e oportunidades: um pipeline de vendas, as interações e a IA que aconselha o próximo passo.',
			description: 'Um CRM leve para uma equipe comercial. As oportunidades avançam em um pipeline, têm um valor ponderado pela probabilidade, e a IA avalia o risco delas e aconselha a próxima ação a partir das notas. As interações com os clientes são registradas e resumidas, e as empresas agregam o que representam.',
			category: 'Vendas',
			tags: ['IA', 'Pipeline', 'Kanban', 'Calendário'],
		},
		evenements: {
			label: 'Eventos e inscrições',
			summary: 'Conferências, workshops e webinars: as inscrições, as vagas restantes e o feedback dos participantes lido pela IA.',
			description: 'Para organizar eventos recorrentes. Cada evento conta seus inscritos e suas vagas restantes; as inscrições avançam até a presença. Depois do evento, os participantes deixam um feedback que a IA classifica por sentimento e resume. Um formulário público permite entrar na lista de e-mails.',
			category: 'Eventos',
			tags: ['IA', 'Calendário', 'Formulário', 'Agregações'],
		},
		'gestion-projet': {
			label: 'Gestão de projetos',
			summary: 'Projetos, tarefas e marcos: um roteiro, dependências entre tarefas, um kanban e um calendário.',
			description: 'Para conduzir vários projetos em paralelo. Cada projeto agrega suas tarefas e suas horas; as tarefas são acompanhadas em kanban, planejadas em uma linha do tempo que desenha suas dependências, e os marcos aparecem em um calendário. A IA redige um boletim do projeto para a diretoria a partir da descrição e do andamento.',
			category: 'Organização',
			tags: ['Linha do tempo', 'Dependências', 'Kanban', 'IA'],
		},
		inventaire: {
			label: 'Inventário e estoque',
			summary: 'Itens, fornecedores e movimentações: o estoque se calcula sozinho, as faltas aparecem com antecedência.',
			description: 'Para uma oficina, uma loja ou um setor de serviços gerais. Cada entrada ou saída é uma movimentação; o estoque de cada item é a soma delas, seu valor uma fórmula, e os itens abaixo do limite aparecem na visão “À commander” (a encomendar). A IA redige a descrição de cada item a partir do nome e da categoria.',
			category: 'Operações',
			tags: ['Agregações', 'Fórmulas', 'Galeria', 'IA'],
		},
		recrutement: {
			label: 'Recrutamento',
			summary: 'Vagas abertas, candidatos e entrevistas; a IA sintetiza cada candidatura e sugere os pontos a aprofundar.',
			description: 'Um acompanhamento dos recrutamentos, da candidatura à contratação. Os candidatos se inscrevem por um formulário público, avançam etapa por etapa em um kanban, e as entrevistas são agendadas em um calendário. A IA lê a carta de apresentação e as notas: uma síntese e as perguntas a fazer na entrevista. Ela ajuda a ler, não decide.',
			category: 'Recursos humanos',
			tags: ['IA', 'Formulário', 'Kanban', 'Calendário'],
		},
		'suivi-tickets': {
			label: 'Acompanhamento de tickets',
			summary: 'Bugs e solicitações triados pela IA, acompanhados por sprint até a resolução, com um formulário de relato.',
			description: 'Um gerenciador de tickets para uma equipe de produto. Cada ticket está vinculado a um componente e a um sprint; a IA propõe uma categoria, estima a gravidade e resume o relato. Um kanban acompanha o andamento, uma linha do tempo mostra os sprints, um formulário permite que qualquer pessoa relate um problema, e uma automação registra a data de resolução.',
			category: 'Produto e tecnologia',
			tags: ['IA', 'Kanban', 'Formulário', 'Sprints'],
		},
	},
} satisfies DeepPartial<Dict>;
