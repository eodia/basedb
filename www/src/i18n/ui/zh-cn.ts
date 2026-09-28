/**
 * The Simplified Chinese texts of the landing pages, laid over the French ones (`fr.ts`).
 *
 * See `../README.md`.
 */
import type { DeepPartial, Dict } from './index';

export default {
	meta: {
		home: {
			title: 'basedb — 协作式数据库，每张数据表都是真正的 PostgreSQL 数据表',
			description: '网格与八种视图、公式、共享表单与共享视图、评论、自动化、仪表盘、细化到字段的权限、完整的历史记录、REST API 与 MCP 服务器——全部建立在名称清晰的真正 PostgreSQL 数据表之上。自托管，AGPL-3.0。',
		},
		changelog: {
			title: '更新日志 — basedb',
			description: 'basedb 历次版本的变化。',
		},
		roadmap: {
			title: '路线图 — basedb',
			description: 'basedb 接下来要做的事。',
		},
		gallery: {
			title: '模板 — basedb',
			description: '开箱即用的数据库：工单跟踪、评价分析、CRM、招聘……附带示例行、视图、仪表盘以及由 AI 计算的字段。',
		},
		template: {
			title: '{label} — basedb 模板',
		},
	},
	eodia: {
		home: 'https://eodia.com/',
		about: 'https://eodia.com/about/',
		contact: 'https://eodia.com/contact/',
	},
	demo: {
		short: '演示',
		cta: '试用演示',
	},
	nav: {
		aria: '主导航',
		home: 'basedb — 首页',
		links: [
			{
				href: '/#fonctionnalites',
				label: '功能',
			},
			{
				href: '/modeles/',
				label: '模板',
			},
			{
				href: '/guides/introduction/',
				label: '文档',
			},
			{
				href: '/nouveautes/',
				label: '更新日志',
			},
		],
		developers: '开发者',
		github: 'basedb 的 GitHub 仓库',
		install: '安装',
		menu: {
			open: '打开菜单',
			close: '关闭菜单',
			features: {
				label: '功能',
				groups: {
					organize: {
						title: '整理',
						items: {
							tables: {
								href: '/fonctionnalites/tables-et-champs/',
								title: '数据表与字段',
								text: '各种类型的字段、关联，以及像电子表格一样的公式。',
							},
							views: {
								href: '/fonctionnalites/vues/',
								title: '八种视图',
								text: '网格、看板、日历、时间线、画廊、列表、表单、问卷。',
							},
							forms: {
								href: '/fonctionnalites/formulaires-partages/',
								title: '表单',
								text: '一个可分享的链接：每份回复都成为一行。',
							},
							files: {
								href: '/fonctionnalites/fichiers/',
								title: '文件与图片',
								text: '报价单、照片、合同，与所在的行一起保存。',
							},
						},
					},
					collaborate: {
						title: '协作',
						items: {
							live: {
								href: '/fonctionnalites/collaboration/',
								title: '实时与评论',
								text: '看到其他人的操作，评论某一行，提及一位同事。',
							},
							rights: {
								href: '/fonctionnalites/droits/',
								title: '权限与团队',
								text: '谁能看什么、谁能改什么，细到每一列。',
							},
							history: {
								href: '/fonctionnalites/historique/',
								title: '历史记录',
								text: '每一次修改都被保留，且可以撤销。',
							},
							shared: {
								href: '/fonctionnalites/vues-partagees/',
								title: '共享视图',
								text: '通过链接分享一个视图，嵌入您的网站，或接入您的日历应用。',
							},
						},
					},
					automate: {
						title: '自动化与分析',
						items: {
							automations: {
								href: '/fonctionnalites/automatisations/',
								title: '自动化',
								text: '当一行发生变化：通知、创建、写入，或询问 AI。',
							},
							dashboards: {
								href: '/fonctionnalites/tableaux-de-bord/',
								title: '仪表盘',
								text: '十五种可视化，共享筛选，一个可分享的链接。',
							},
							ai: {
								href: '/fonctionnalites/ia/',
								title: 'AI 与 Copilot',
								text: '一句话生成一个数据库，字段自动填写。',
							},
							templates: {
								href: '/modeles/',
								title: '模板',
								text: '十个开箱即用的模板，按需调整。',
							},
						},
					},
				},
				feature: {
					tag: '新功能',
					title: '流程式自动化',
					text: '查找、判断、询问 AI：图形编辑器，每次运行都能逐步回看。',
					href: '/nouveautes/',
					cta: '所有更新日志',
				},
				all: '所有功能',
			},
			solutions: {
				label: '解决方案',
				title: '适合每一个团队',
				items: {
					crm: {
						team: '销售',
						text: '销售管道、联系人与跟进提醒。',
					},
					recrutement: {
						team: '人力资源',
						text: '候选人申请与面试，AI 自动生成摘要。',
					},
					'calendrier-editorial': {
						team: '市场营销',
						text: '文章、帖子和电子报，统一排期发布。',
					},
					inventaire: {
						team: '运营',
						text: '自动计算库存，提前看到缺货。',
					},
					'gestion-projet': {
						team: '项目',
						text: '里程碑、任务与依赖关系。',
					},
					'suivi-tickets': {
						team: '产品',
						text: '缺陷和需求，由 AI 自动分类。',
					},
					'base-connaissances': {
						team: '客服',
						text: '帮助文章、问题，以及 AI 建议的回复。',
					},
					evenements: {
						team: '活动策划',
						text: '报名、名额与反馈。',
					},
					'analyse-avis': {
						team: '客户关系',
						text: '评价由 AI 阅读并分类。',
					},
				},
				ask: {
					title: '还有其他想法？',
					text: '用一句话描述您的需求：AI 会为您量身定制一个数据库。',
					href: '/modeles/',
				},
				all: '所有模板',
			},
			developers: {
				label: '开发者',
				groups: {
					build: {
						title: '集成',
						items: {
							api: {
								href: '/integrations/api-rest/',
								title: 'REST API',
								text: '与界面完全相同的数据，用 OpenAPI 3.1 描述。',
							},
							mcp: {
								href: '/integrations/mcp/',
								title: 'MCP 服务器',
								text: '为您的 AI 智能体提供工具，遵循您的权限。',
							},
							webhooks: {
								href: '/integrations/webhooks/',
								title: 'Webhook',
								text: '每一次写入，带签名、按顺序、失败重试。',
							},
							sql: {
								href: '/integrations/sql/',
								title: '直接 SQL',
								text: '真正的 PostgreSQL 数据表，名称清晰可读。',
							},
							sync: {
								href: '/integrations/synchronisation/',
								title: '同步',
								text: '数据表保持与外部来源同步更新。',
							},
						},
					},
					host: {
						title: '部署',
						items: {
							docker: {
								href: '/hebergement/docker/',
								title: 'Docker Compose',
								text: '一个镜像，一个 PostgreSQL 数据库，一个端口。',
							},
							env: {
								href: '/hebergement/variables/',
								title: '环境变量',
								text: '一切都在 .env 文件中设置。',
							},
							https: {
								href: '/hebergement/https/',
								title: '域名与 HTTPS',
								text: '在您自己的代理之后，或使用内置的 Caddy。',
							},
							sso: {
								href: '/hebergement/connexion/',
								title: '登录与 SSO',
								text: 'Google、Microsoft，以及任何 OpenID Connect 身份提供商。',
							},
							backup: {
								href: '/hebergement/sauvegardes/',
								title: '备份与更新',
								text: '用 pg_dump 备份，无损更新。',
							},
						},
					},
				},
				feature: {
					title: '开发者页面',
					text: '每个网格背后都是一张真正的 PostgreSQL 数据表。',
					href: '/developpeurs/',
				},
			},
			resources: {
				label: '资源',
				groups: {
					learn: {
						title: '学习',
						items: {
							docs: {
								href: '/guides/introduction/',
								title: '文档',
								text: 'basedb 的一切，逐步讲解。',
							},
							start: {
								href: '/guides/premiers-pas/',
								title: '快速上手',
								text: '从导入到视图，搭建您的第一个数据库。',
							},
							install: {
								href: '/guides/installation/',
								title: '安装',
								text: '两个文件，一条命令。',
							},
							principles: {
								href: '/architecture/principes/',
								title: '设计原则',
								text: 'basedb 是如何构建的，以及为什么这样构建。',
							},
						},
					},
					follow: {
						title: '关注项目',
						items: {
							news: {
								href: '/nouveautes/',
								title: '更新日志',
								text: '每个版本的变化。',
							},
							roadmap: {
								href: '/feuille-de-route/',
								title: '路线图',
								text: '接下来要做的事。',
							},
							github: {
								href: 'https://github.com/eodia/basedb',
								title: 'GitHub',
								text: '代码、工单与版本。',
							},
							eodia: {
								href: 'https://eodia.com/',
								title: 'Eodia',
								text: '打造 basedb 的工作室。',
							},
						},
					},
				},
			},
		},
	},
	language: {
		label: '语言',
		current: '语言：{name}',
	},
	footer: {
		tagline: '协作式数据库，每张数据表都是真正的 PostgreSQL 数据表。',
		madeBy: '由 AI 原生软件工作室 <a class="eodia" href="https://eodia.com/">Eodia</a> 出品的自由软件。',
		columns: {
			product: {
				title: '产品',
				links: [
					{
						href: '/#fonctionnalites',
						label: '功能',
					},
					{
						href: '/nouveautes/',
						label: '更新日志',
					},
					{
						href: '/feuille-de-route/',
						label: '路线图',
					},
					{
						href: '/#faq',
						label: '常见问题',
					},
				],
			},
			docs: {
				title: '文档',
				links: [
					{
						href: '/guides/introduction/',
						label: '简介',
					},
					{
						href: '/guides/installation/',
						label: '安装',
					},
					{
						href: '/integrations/api-rest/',
						label: 'REST API',
					},
					{
						href: '/integrations/mcp/',
						label: 'MCP 服务器',
					},
				],
			},
			hosting: {
				title: '部署',
				links: [
					{
						href: '/hebergement/docker/',
						label: 'Docker Compose',
					},
					{
						href: '/hebergement/variables/',
						label: '环境变量',
					},
					{
						href: '/hebergement/https/',
						label: '域名与 HTTPS',
					},
					{
						href: '/hebergement/sauvegardes/',
						label: '备份',
					},
				],
			},
			project: {
				title: '项目',
				links: [
					{
						href: 'https://github.com/eodia/basedb',
						label: 'GitHub',
					},
					{
						href: 'https://github.com/eodia/basedb/tree/main/docs/architecture',
						label: '架构文档',
					},
					{
						href: 'https://github.com/eodia/basedb/blob/main/LICENSE',
						label: 'AGPL-3.0 许可证',
					},
					{
						href: 'https://github.com/eodia/basedb/issues',
						label: '报告问题',
					},
				],
			},
			eodia: {
				title: 'Eodia',
				links: [
					{
						href: 'https://eodia.com/',
						label: '工作室',
					},
					{
						href: 'https://eodia.com/about/',
						label: '关于我们',
					},
					{
						href: 'https://eodia.com/contact/',
						label: '联系我们',
					},
				],
			},
		},
		copyright: '© {year} <a href="https://eodia.com/">Eodia</a> · AGPL-3.0-or-later',
		builtWith: '本站使用 Astro 和 Starlight 构建。',
	},
	docsFooter: {
		madeBy: 'basedb 是 AI 原生软件工作室 <a href="https://eodia.com/">Eodia</a> 出品的自由软件。',
	},
	teams: {
		meta: {
			title: 'basedb — 所有工作，汇聚一处',
			description: '客户、项目、库存、招聘：一个数据库，整个团队实时共同编辑，可以用表格、看板或日历查看，配有仪表盘、自动化和 AI。无需代码，自由且免费。',
		},
		hero: {
			eyebrow: 'basedb',
			title: '您的全部工作，',
			titleAccent: '终于汇聚一处。',
			lead: '表格、日历、表单、仪表盘和自动化，为整个团队打造。像电子表格一样简单。不用写一行代码。',
			primary: '浏览模板',
			secondary: '观看演示',
			facts: ['无需代码', '自由且免费', '数据留在您自己的服务器上'],
		},
		story: {
			grid: {
				title: '整个团队，同一张数据表。',
				text: '大家同时在这张表里工作，所有人看到的都是最新的同一份内容。',
			},
			copilot: {
				title: '开口问。Copilot 来处理。',
				text: '“这周我该催谁？”——它会为您推荐合适的筛选条件，点一下即可应用。',
			},
			kanban: {
				title: '拖一下。就更新了。',
				text: '每个阶段变成一栏；移动一张卡片，就是修改这一行。',
			},
			calendar: {
				title: '每个日期都各得其所。',
				text: '预约会自动显示出来，还能同步到您的日历应用中。',
			},
			dashboard: {
				title: '而这一切，一目了然。',
				text: '所有数字都由这些行自动算出。',
			},
		},
		stage: {
			aria: 'basedb 中一个团队的客户跟进：表格、Copilot、看板、日历、仪表盘',
			tabs: {
				grid: '表格',
				copilot: 'Copilot',
				kanban: '看板',
				calendar: '日历',
				dashboard: '仪表盘',
			},
			project: '主项目',
			projectMeta: '项目 · 2 个数据库',
			filterNav: '筛选导航',
			base: '销售',
			otherBase: '客户支持',
			tables: ['客户', '联系人', '报价单'],
			baseSection: '数据库 · 销售',
			screens: ['仪表盘', '自动化'],
			user: 'Léa Martin',
			views: {
				grid: '所有行',
				kanban: '按阶段',
				calendar: '预约',
			},
			toolbar: {
				filter: '筛选',
				columns: '列',
				group: '分组',
				colors: '颜色',
				sort: '排序',
				configure: '配置',
			},
			search: '搜索…',
			add: '添加',
			columns: {
				name: '客户',
				status: '阶段',
				owner: '负责人',
				amount: '金额',
				next: '下次预约',
			},
			statuses: {
				contact: '待联系',
				meeting: '已预约',
				quote: '已发报价',
				signed: '已签约',
			},
			clients: ['马丁面包坊', '梧桐诊所', '让·穆兰中学', '爱心自行车协会', '精品杂货铺', '隆河锻造厂', '莫罗工作室'],
			addRow: '添加一行',
			perPage: '每页行数',
			card: '{owner} 负责跟进，预约时间 {date}',
			addCard: '添加卡片',
			today: '今天',
			month: '月',
			week: '周',
			dashboards: '仪表盘',
			questions: '问题',
			dashboard: '销售跟进',
			dashboardText: '要点一目了然。',
			dashboardTabs: ['总览', '动态'],
			period: '时间段',
			thisYear: '今年',
			share: '共享',
			edit: '编辑',
			explore: '探索数据',
			chart: '各客户的金额',
			byStage: '按阶段的客户',
			kpis: {
				signed: '已签约',
				pending: '待处理报价',
				rate: '客户签约率',
			},
			copilot: {
				question: '这周我该催谁？',
				thinking: '正在思考…',
				answer: '有四位客户在等回复：两份已发报价，两场待准备的预约。',
				card: '筛选客户',
				filter: '阶段：已发报价或已预约',
				apply: '应用筛选',
				applied: '已应用筛选',
				placeholder: '向 Copilot 提问…',
				filtered: '已筛选 {n} 行',
			},
		},
		video: {
			eyebrow: '演示',
			title: '完整的 basedb，',
			titleAccent: '只需四分钟。',
			text: '创建数据库、填充数据、分享出去、设置自动化、全程掌控：完整的讲解导览。',
			play: '播放视频',
			duration: '4 分 35 秒',
			chapters: '章节',
			captions: '法语',
			inFrench: '视频为法语原声，配有法语字幕。',
			list: [
				{ time: '0:08', title: '创建数据库' },
				{ time: '0:35', title: '数据表、字段与公式' },
				{ time: '1:10', title: '行详情与协作' },
				{ time: '1:33', title: '同一批行的八种视图' },
				{ time: '2:01', title: '表单与 AI' },
				{ time: '2:37', title: '自动化' },
				{ time: '2:59', title: '仪表盘' },
				{ time: '3:15', title: '人人可用的 SQL' },
				{ time: '3:43', title: '历史记录与权限' },
				{ time: '4:01', title: 'API、MCP 与 Copilot' },
			],
		},
		together: {
			eyebrow: '协作',
			title: '所有人，',
			titleAccent: '同时协作。',
			text: '别人的修改实时显示出来。您能看到谁在看哪一行，就在原地讨论，一个 @ 就能提醒同事。',
			demo: {
				path: '销售 / 报价单',
				here: '3 人正在这张数据表上',
				columns: {
					client: '客户',
					status: '阶段',
					amount: '金额',
					due: '到期日',
				},
				statuses: {
					draft: '草稿',
					sent: '已发送',
					signed: '已签约',
				},
				rows: ['马丁面包坊', '梧桐诊所', '让·穆兰中学', '爱心自行车协会', '精品杂货铺', '隆河锻造厂'],
				comment: '@{name} 你能在今晚之前确认一下这份报价吗？',
				reply: '已确认！',
				toast: '{name} 修改了“{field}”',
			},
			points: {
				live: {
					title: '实时',
					text: '每一次修改都会立即显示给其他人，无需刷新页面。',
				},
				comments: {
					title: '评论与提及',
					text: '评论一行，用 @ 提及一位同事，铃铛就会发出通知。',
				},
				undo: {
					title: '放心撤销',
					text: 'Ctrl+Z 只撤销您自己的最后一次修改——绝不会动到同事的修改。',
				},
			},
			link: {
				href: '/fonctionnalites/collaboration/',
				label: '多人协作',
			},
		},
		forms: {
			eyebrow: '表单与问卷',
			title: '只管提问。',
			titleAccent: '答案自己归档。',
			text: '单页表单，或是每屏一题的问卷，配色随心定制：分享链接，每一份回答都会自动变成数据表里的一行。填写者看不到表格的其他任何内容。',
			modes: {
				label: '问题展示方式',
				survey: '问卷',
				form: '表单',
			},
			demo: {
				title: '报价申请',
				description: '只需三个问题，我们会在 48 小时内与您联系。',
				count: '3 个问题',
				start: '开始',
				ok: '确定',
				hint: '或 Enter',
				submit: '提交申请',
				org: {
					label: '机构名称',
					answer: '画廊咖啡馆',
				},
				need: {
					label: '需求',
					options: ['网站', '视觉形象', '画册'],
				},
				budget: {
					label: '预算',
					help: '不含税，估算即可。',
				},
				sent: '已发送！',
				thanks: '谢谢！我们会在 48 小时内与您联系。',
				poweredBy: '由 basedb 提供支持的表单',
				path: '销售 / 申请',
				view: '所有申请',
				columns: {
					org: '机构名称',
					need: '需求',
					budget: '预算',
					stage: '阶段',
				},
				stages: {
					new: '新',
					called: '已致电',
					quote: '已发送报价单',
				},
				rows: ['马丁面包坊', '梧桐诊所', '爱心自行车协会', '隆河锻造厂'],
				open: '已开放',
				answers: {
					one: '{n} 份回答',
					other: '{n} 份回答',
				},
				active: '启用链接',
			},
			points: {
				survey: {
					title: '一屏一题',
					text: '全屏展示，全程键盘操作：按 Enter 继续，按 A、B、C 选择——单选题选定后自动跳转下一题，提交时还会有庆祝效果。',
				},
				access: {
					title: '公开或仅限成员',
					text: '拥有链接的任何人都可以在不注册账号的情况下作答——也可以仅限已登录成员填写，答案会显示他们的姓名。',
				},
				closed: {
					title: '其余内容保持隐藏',
					text: '作答时看不到数据表的其他内容。链接会在指定日期，或达到一定回答数量后自动关闭。',
				},
			},
			link: {
				href: '/fonctionnalites/formulaires-partages/',
				label: '表单',
			},
		},
		automate: {
			eyebrow: '自动化',
			title: '它在工作。',
			titleAccent: '趁你睡觉的时候。',
			text: '当一行数据到达或发生变化时，在固定时间，或点击按钮时——basedb 会依次执行各个步骤：选择正确的分支、询问 AI、通知该通知的人。每一次运行都可以逐步回看。',
			clock: '03:12',
			crumb: '销售 / 自动化',
			create: '新建自动化',
			list: [
				{
					name: '新申请',
					when: '行已创建',
				},
				{
					name: '报价单已签署',
					when: '行已更新',
				},
				{
					name: '周一跟进提醒',
					when: '每周一 09:00',
				},
			],
			active: '已启用',
			test: '在一行上测试',
			save: '保存',
			when: '何时',
			trigger: '行已创建',
			table: '在 申请 中',
			steps: {
				branch: {
					kind: '条件',
					text: '2 个分支',
					run: '分支“大项目”',
				},
				notify: {
					kind: '通知某人',
					text: 'Léa Martin',
					run: '已通知 1 人',
				},
				create: {
					kind: '创建行',
					text: '预约，存入“日历”表',
					run: '已完成',
				},
				slack: {
					kind: '发送到 Slack',
					text: '发到 #销售 频道',
					run: '已完成',
				},
				ai: {
					kind: '询问 AI',
					text: '撰写首个回答',
					run: '{n} 个字符的回答',
				},
				update: {
					kind: '更新行',
					text: '回答、阶段',
					run: '已完成',
				},
			},
			paths: {
				big: '大项目',
				condition: 'budget gt 5000',
				otherwise: '否则',
			},
			answer: '您好，感谢您的咨询！负责跟进您全新视觉形象的 Léa，将于明天上午与您通电话。',
			addStep: '添加步骤',
			tabs: {
				settings: '设置',
				runs: '运行记录',
			},
			runsText: '最近 50 次运行，保留 30 天。选择一次运行，可在流程上查看它经过的路径。',
			running: '进行中',
			succeeded: '成功',
			started: '已创建行 · {when}',
			now: '刚刚',
			earlier: ['昨天 18:40', '昨天 11:02'],
			done: '成功 · 5 个步骤 · 1.3 秒',
			points: {
				when: {
					title: '恰到好处的时机',
					text: '行的创建或修改、固定时间、按钮点击——再加一个条件，只在真正需要时启动。',
				},
				paths: {
					title: '多条分支',
					text: '一个条件会打开多条分支，每条分支都有自己的步骤；一个步骤找到的内容，下一步可以直接引用。',
				},
				copilot: {
					title: '一句话描述即可',
					text: '“新申请进来时，如果预算超过 €5,000，就通知 Léa”：Copilot 会搭建好流程，由你来复核。',
				},
			},
			link: {
				href: '/fonctionnalites/automatisations/',
				label: '自动化',
			},
		},
		glance: {
			eyebrow: '仪表盘',
			title: '看清一切，',
			titleAccent: '一目了然。',
			text: '数字、曲线、目标：您的仪表盘直接从数据表用鼠标搭建而成，并且会自动保持最新。一个筛选器，就能带动整个仪表盘。',
			demo: {
				title: '销售总览',
				filters: ['今年', '所有城市'],
				revenue: '营业额',
				signed: '已签约报价',
				rate: '签约率',
				goal: '年度目标',
				byMonth: '按月营业额',
				byStage: '按阶段的报价',
				stages: ['已发送', '洽谈中', '已签约'],
				bySector: '各行业客户',
				sectors: ['商业', '医疗', '教育', '工业'],
				shared: '通过链接共享',
			},
			points: {
				viz: {
					title: '十五种可视化',
					text: '数值、趋势、目标、曲线、分区、漏斗、交叉表、地图。',
				},
				filters: {
					title: '共享筛选',
					text: '时间段、客户、城市：一个筛选器可以控制一张、多张，或全部卡片。',
				},
				share: {
					title: '通过链接共享',
					text: '公开或仅限团队查看，并可嵌入其他网站。',
				},
			},
			link: {
				href: '/fonctionnalites/tableaux-de-bord/',
				label: '仪表盘',
			},
		},
		ai: {
			eyebrow: 'AI',
			title: '您描述，',
			titleAccent: 'basedb 来搭建。',
			text: '一句话就能得到一个完整的数据库，创建前您可以先检查。之后，Copilot 会提议筛选器、图表和自动化，AI 字段则替您完成总结、分类和撰写。',
			prompt: '为我们三个空缺职位做一个候选人跟踪，包含面试环节。',
			thinking: '三张互相关联的数据表，随时可以检查。',
			tables: {
				jobs: {
					name: '职位',
					fields: ['名称', '部门', '开放日期'],
				},
				people: {
					name: '候选人',
					fields: ['姓名', '职位', '阶段', '摘要'],
				},
				talks: {
					name: '面试',
					fields: ['候选人', '日期', '面试官', '评价'],
				},
			},
			aiField: '摘要',
			aiValue: '有六年项目管理经验，擅长与客户沟通；需要进一步了解：英语水平。',
			create: '创建数据库',
			providers: '使用您选择的服务商——OpenAI、Anthropic、Mistral，或运行在您自己机器上的模型。未经您同意，什么都不会发送。',
			link: {
				href: '/fonctionnalites/ia/',
				label: 'basedb 中的 AI',
			},
		},
		features: {
			title: '该有的都有，',
			titleAccent: '而且更多。',
			text: '每个功能都写入同样的数据表，遵循同样的权限，记入同样的历史记录。',
			tiles: {
				views: {
					stat: '8',
					title: '种方式查看您的数据',
					text: '网格、看板、日历、时间线、画廊、列表、表单和问卷，读取同样的行。每个人选择自己喜欢的方式。',
					href: '/fonctionnalites/vues/',
				},
				history: {
					stat: 'Ctrl+Z',
					title: '什么都不会丢失',
					text: '每一次修改都会连同修改前的值一起保留；出错可以撤销，删除的行可以恢复。',
					href: '/fonctionnalites/historique/',
				},
				forms: {
					title: '表单',
					text: '公开链接，或仅限团队：每份回复都会进入数据表，且不会暴露其余内容。',
					href: '/fonctionnalites/formulaires-partages/',
				},
				viz: {
					stat: '15',
					title: '种可视化',
					text: '数值、趋势、目标、曲线、分区、漏斗、交叉表和地图。',
					href: '/fonctionnalites/tableaux-de-bord/',
				},
				formulas: {
					code: 'IF([Montant] > 10000, "Grand compte", "")',
					title: '公式，法语或英语皆可',
					text: '就像在电子表格里——SI、ARRONDI、JOURS……或 IF、ROUND、DAYS——但为整个团队计算。',
					href: '/fonctionnalites/tables-et-champs/#公式',
				},
				rights: {
					title: '每个人只看该看的',
					text: '可查看、可编辑、可管理，按团队区分；敏感的列可以隐藏。',
					href: '/fonctionnalites/droits/',
				},
				mentions: {
					bubble: '@Camille',
					title: '评论与提及',
					text: '就在一行所在的位置讨论它，铃铛会发出提醒。',
					href: '/fonctionnalites/collaboration/',
				},
				relations: {
					title: '一切互相关联',
					text: '客户、项目、发票：汇总和查找都能跨关联进行。',
					href: '/fonctionnalites/tables-et-champs/',
				},
				templates: {
					stat: '10',
					title: '个现成模板',
					text: 'CRM、招聘、库存、活动……或者用一句话向 AI 描述出一个数据库。',
					href: '/modeles/',
				},
				import: {
					title: '一步导入',
					text: '拖入一个 CSV 文件：类型会自动推断，数据表随即创建。',
					href: '/guides/premiers-pas/',
				},
				agenda: {
					title: '直接同步到您的日历应用',
					text: '日历可以变成 Google 日历、Outlook 或 Apple 日历能订阅的源。',
					href: '/fonctionnalites/vues-partagees/',
				},
				files: {
					title: '文件与图片',
					text: '报价单、照片、合同；一张图片就能成为卡片的封面。',
					href: '/fonctionnalites/fichiers/',
				},
				share: {
					title: '共享视图',
					text: '通过链接分享一个只读视图，可嵌入您的网站。',
					href: '/fonctionnalites/vues-partagees/',
				},
				sync: {
					title: '同步数据表',
					text: '数据来自在线 CSV、日历或另一个 basedb，并保持自动更新。',
					href: '/integrations/synchronisation/',
				},
				signin: {
					title: '简单登录',
					text: 'Google、Microsoft 或密码；通过链接邀请您的同事。',
					href: '/hebergement/connexion/',
				},
				languages: {
					title: '您的语言',
					text: '界面会跟随每个人自己的语言，共二十种可选。',
					href: '/fonctionnalites/droits/#您的设置',
				},
			},
		},
		yours: {
			eyebrow: '自由，自托管',
			per: '每人，永久免费。',
			text: 'basedb 是自由软件。把它安装在您自己的服务器上，邀请整个团队：没有订阅费，不必按人数付费，数据留在您自己的服务器上。',
			points: {
				home: {
					title: '在您自己这里',
					text: '安装在您自己的服务器或托管商的服务器上，像任何 PostgreSQL 数据库一样备份。',
				},
				free: {
					title: '自由开源',
					text: '采用 AGPL-3.0 许可证：代码是开放的，并将始终保持开放。',
				},
				ai: {
					title: '由您选择 AI',
					text: '市面上的服务商，安装在您自己这里的模型——或者完全不用 AI。',
				},
			},
			link: {
				href: '/guides/installation/',
				label: '安装 basedb',
			},
		},
		gallery: {
			eyebrow: '模板',
			title: '一分钟内就绪。',
			text: '从一个模板开始：它自带数据表、视图、仪表盘和示例数据，您可以按自己的方式调整。',
			use: '查看',
			ask: {
				title: '没有合适的？',
				text: '用一句话描述您的需求：AI 会为您量身定制一个数据库。',
			},
			all: '查看所有模板',
			previous: '上一组模板',
			next: '下一组模板',
		},
		developers: {
			title: '技术方面呢？',
			text: '每张数据表都是一张真正的 PostgreSQL 数据表。REST API、Webhook、面向 AI 智能体的 MCP 服务器，一条命令即可安装。',
			link: '开发者页面',
		},
		faq: {
			title: '常见问题',
			items: [
				{
					q: '需要懂编程吗？',
					a: '不需要。数据表、视图、表单、仪表盘和自动化，都可以用鼠标创建。公式的写法就像在电子表格里一样，可以用法语或英语：SI 或 IF、ARRONDI 或 ROUND、JOURS 或 DAYS……',
				},
				{
					q: '要花多少钱？',
					a: '不花钱：basedb 是自由软件，没有订阅费，也不按人数收费。您只需要一台服务器来安装它。',
				},
				{
					q: '怎么安装？',
					a: '在服务器上用 Docker 安装：两个文件，一条命令，负责您信息技术的人几分钟就能搞定。安装指南会逐步讲解一切。',
				},
				{
					q: '能导入我们原来的表格吗？',
					a: '可以：把您的表格另存为 CSV，拖进 basedb 就行。导入功能会自动识别每一列的类型，创建数据表，并逐行说明哪些内容没能导入。',
				},
				{
					q: '可以多人同时使用吗？',
					a: '这正是它的设计目的。别人的修改会实时显示，您可以评论一行，用 @ 提及同事，铃铛会发出提醒。',
				},
				{
					q: 'AI 会读取我们的数据吗？',
					a: '只有在您决定的情况下才会。没有配置 AI 服务商时，什么都不会发送。之后，调用 AI 的字段或自动化，只会在您同意后，发送其指令中引用的内容。',
				},
				{
					q: '支持什么语言？',
					a: '您自己的语言：界面会自动使用您浏览器的语言，共二十种可选，每个人都可以在设置中更改。',
				},
			],
		},
		cta: {
			title: '您的团队值得更好的，',
			titleAccent: '而不是一份共享文件。',
			text: '从一个模板开始，邀请您的同事，把“FINAL (2)”这样的文件甩在身后。',
			primary: '浏览模板',
			secondary: '安装 basedb',
		},
	},
	hero: {
		badge: '新功能：流程式自动化、仪表盘与 SQL 视图',
		title: ['协作式数据库，', '每一张数据表', '都是真正的'],
		titleAccent: 'PostgreSQL 数据表。',
		lead: '像共享电子表格一样简单——网格、视图、表单、权限——数据却存放在<strong>类型明确、名称清晰</strong>的数据表中。您的团队在界面中工作；您的脚本、BI 工具、AI 智能体和 <code>psql</code> 读取的是同一批行。',
		install: '使用 Docker 安装',
		features: '查看功能',
		copy: '复制命令',
		facts: ['自托管', 'AGPL-3.0', 'REST API 与 MCP 服务器'],
		demo: {
			url: 'basedb.your-domain.com',
			project: '主项目',
			projectMeta: '项目 · 2 个数据库',
			filter: '筛选数据库和数据表',
			sales: '销售',
			support: '客户支持',
			environment: '生产',
			clients: '客户',
			opportunities: '商机',
			quotes: '报价单',
			baseSection: '数据库 · 销售',
			screens: ['仪表盘', '自动化'],
			copilot: '✦ Copilot',
			allRows: '▦ 所有行 ▾',
			tools: ['筛选', '分组', '颜色'],
			search: '搜索…',
			add: '+ 添加',
			columns: {
				name: '名称',
				status: '状态',
				amount: '金额',
				client: '客户',
			},
			statuses: {
				nouveau: '新建',
				qualifie: '已确认',
				proposition: '提案',
				negociation: '谈判中',
				gagne: '赢单',
				perdu: '丢单',
			},
			deals: {
				portail: {
					name: '门户网站改版',
					client: '青岚市政府',
				},
				erp: {
					name: 'ERP 迁移',
					client: '德洛姆集团',
				},
				audit: {
					name: '安全审计',
					client: '圣罗克诊所',
				},
				billetterie: {
					name: '在线票务',
					client: '圆点剧院',
				},
				flotte: {
					name: '车队跟踪',
					client: '凯尔兰运输',
				},
				mobile: {
					name: '移动应用',
					client: '莫罗工作室',
				},
				intranet: {
					name: '内网改版',
					client: '',
				},
			},
			toastTitle: '表单“报价申请”',
			toastText: '公开回复 · 已创建“{name}”',
			cursor: 'Camille',
			psqlRows: '(2 行记录)',
		},
	},
	showcase: {
		label: '真实的界面',
		title: '团队对共享电子表格的一切期待，这里都有。',
		tabs: '界面截图',
		alt: 'basedb — {labelLower}：{caption}',
		shots: {
			grille: {
				label: '网格',
				caption: '写入真正数据表的网格——还有计算字段：用公式算出的时长、通过查找引用得到的客户所在城市、通过计数得到的任务数量。',
			},
			kanban: {
				label: '看板',
				caption: '同样的行按单选字段分栏显示：封面图片，以及引用行中值的描述。拖动卡片，就是修改这一行。',
			},
			galerie: {
				label: '画廊',
				caption: '带图片的卡片，按状态显示颜色：画廊是读取一张数据表的八种方式之一。',
			},
			chronologie: {
				label: '时间线',
				caption: '两个日期之间的横条，以及表示依赖关系的箭头——顺序不再成立时显示为红色。',
			},
			tableaux: {
				label: '仪表盘',
				caption: '网格排列、分标签页、受共享筛选控制的卡片：趋势、目标、堆叠系列——每个人都按自己的权限查看。',
			},
			automatisations: {
				label: '自动化',
				caption: '任务完成时，查找项目中剩余的任务；如果没有剩余，AI 会撰写总结语，项目状态变为“已交付”。每次运行都可以在流程上逐步查看。',
			},
			commentaires: {
				label: '评论',
				caption: '就在行所在的位置讨论它：评论、提及、通知。',
			},
			formulaire: {
				label: '表单',
				caption: '表单通过链接共享，可以公开，也可以仅限已登录的成员。',
			},
			historique: {
				label: '历史记录',
				caption: '每一次写入，无论来自何处——某个人、某个自动化、直接 SQL——都附带修改前的值。',
			},
			sql: {
				label: 'SQL',
				caption: '使用真实名称的查询，保存在数据表下方供整个团队使用——每个人都以自己的权限执行。',
			},
			vuesSql: {
				label: 'SQL 视图',
				caption: '真正的 PostgreSQL 视图，与数据表并列，带有各自的颜色和图标——并且可以从 psql 读取。',
			},
		},
	},
	features: {
		postgres: {
			label: 'PostgreSQL，无需转译',
			title: '网格给团队，真正的数据表{留给您的工具。}',
			lead: '没有通用数据模型，没有包罗万象的 JSON，也没有 <code>field_1837</code>：数据库就是模式（schema），数据表就是数据表，字段就是类型明确、名称清晰的列。',
			bullets: [
				'<strong>原生类型</strong>：<code>text</code>、<code>numeric</code>、<code>date</code>、<code>timestamptz</code>、<code>boolean</code>——关联使用真正的外键。',
				'<strong>由数据库保证的约束</strong>：单选用 <code>CHECK</code>，网址和电子邮件地址经过校验，关联用 <code>FOREIGN KEY</code>。',
				'<strong>由 PostgreSQL 计算的公式</strong>：<code>JOURS([Fin]; [Début])</code> 成为一个生成列，<code>psql</code> 像读取其他列一样读取它。',
				'<strong>依然允许直接 SQL</strong>——而且连它也会由触发器记入历史记录。',
				'<strong>界面中的 SQL 查询与视图</strong>：保存在数据表下方的查询，供自己或团队使用；与数据表并列的真正 PostgreSQL 视图，<code>psql</code> 同样可以读取。',
				'<strong>重命名不会破坏任何东西</strong>：在您迁移查询期间，旧名称仍由兼容别名继续提供。',
			],
			links: [
				{
					href: '/integrations/sql/',
					label: '直接使用 SQL',
				},
				{
					href: '/fonctionnalites/requetes-et-vues-sql/',
					label: '查询与 SQL 视图',
				},
				{
					href: '/architecture/principes/',
					label: '设计原则',
				},
			],
		},
		automations: {
			label: '自动化',
			title: '流程式自动化，{每一步都有 AI。}',
			lead: '在行发生变化时、定时或点击时触发：图形编辑器将各个步骤串联起来，每次运行都可以在流程上回看。',
			bullets: [
				'<strong>清晰易读的流程</strong>：先是触发器，然后每个步骤一张卡片；连线上的 <strong>+</strong> 可在该位置添加步骤。',
				'<strong>查找、判断、写入</strong>：查找一行，根据条件走不同的分支，修改、创建、通知、调用 Webhook、发送到 Slack。',
				'<strong>询问 AI</strong>：在步骤中发送一条引用该行的指令，回答可解读为文本、数字、日期或选项，供后续步骤复用。',
				'<strong>Copilot</strong> 能根据一句话提议完整的自动化，或解释某次运行失败的原因——未经您确认，不会保存任何内容。',
				'<strong>以编写者的权限执行</strong>，并像其他写入一样记入历史记录。',
			],
			links: [
				{
					href: '/fonctionnalites/automatisations/',
					label: '自动化',
				},
				{
					href: '/fonctionnalites/automatisations/#copilot',
					label: 'Copilot',
				},
			],
			alt: 'basedb — 流程编辑器中的“项目交付”自动化：任务完成时，记录时间，查找项目中剩余的任务，走“否则”分支，让 AI 撰写总结语，然后交付项目；右侧是它最近的运行记录，逐步展示。',
		},
		dashboards: {
			label: '分析',
			title: '仪表盘，{无需离开您的数据表。}',
			lead: '用鼠标或 SQL 提出问题，十五种可视化，共享筛选——每个人都按自己的权限查看。',
			bullets: [
				'<strong>问题</strong>：一张数据表、它的连接、筛选条件，以及按日、周、月或年计算的度量——或只读 SQL。',
				'<strong>十五种可视化</strong>：数值、趋势、进度、仪表、条形图、折线图、饼图、漏斗图、交叉表、地图……',
				'<strong>一键探索</strong>：点击一个数据点，即可打开其背后的行，或更细的时间段。',
				'<strong>共享筛选</strong>，可控制一张、多张或全部卡片。',
				'<strong>通过链接共享</strong>，公开或仅限成员，还可以嵌入其他网站。',
			],
			links: [
				{
					href: '/fonctionnalites/tableaux-de-bord/',
					label: '仪表盘',
				},
			],
			alt: 'basedb — 一个仪表盘：本月趋势、回款目标、按月营业额、评价情感倾向，上方是时间段和客户筛选。',
		},
		rights: {
			label: '协作，而不必全部开放',
			title: '权限细化到字段，{历史记录毫无遗漏。}',
			lead: '权限授予用户组，可设在项目、数据库或数据表上，并向下传递到其下的一切。敏感的列可以对某个用户组隐藏，或对其设为不可修改。',
			bullets: [
				'<strong>四个级别</strong>：无访问权限、可查看、可编辑、可管理——多个用户组的权限可以叠加。',
				'<strong>连 SQL 也遵循您的权限</strong>：在界面中，查询只能看到对您开放的数据表和字段——由 PostgreSQL 本身执行。',
				'<strong>每一次写入都会被捕获</strong>，就在其所属的事务中：界面、API、智能体、公开表单或直接 SQL。',
				'<strong>修改可以撤销</strong>，删除的行可以恢复，删除的数据库也可以。',
				'<strong>管理操作需要确认</strong>：更改权限前，必须在最近五分钟内重新输入过密码。',
			],
			links: [
				{
					href: '/fonctionnalites/droits/',
					label: '权限与用户组',
				},
				{
					href: '/fonctionnalites/historique/',
					label: '历史记录',
				},
			],
		},
		agents: {
			label: 'REST API · MCP · Webhook',
			title: '您的 AI 智能体能访问数据，{却拿不到万能钥匙。}',
			lead: 'MCP 服务器为智能体提供十二种工具；REST API 为您的程序提供同样的数据。唯一的权限检查点，同一套日志。',
			bullets: [
				'<strong>每个数据库一个令牌</strong>，默认只读，权限绝不会超过创建它的人。',
				'<strong>智能体不会删除任何内容</strong>，也不会修改结构：它只提议，由人来批准。',
				'<strong>自动生成的文档</strong>，每个数据库一份，按您的权限过滤，并附带 OpenAPI 3.1 规范。',
				'<strong>Webhook</strong>：每次写入都会触发，带签名、按顺序、失败重试。',
			],
			links: [
				{
					href: '/integrations/mcp/',
					label: '接入智能体',
				},
				{
					href: '/integrations/api-rest/',
					label: 'REST API',
				},
			],
		},
	},
	sqlVisual: {
		interface: '界面',
		title: '新建字段 · 商机',
		labelField: '显示名称',
		labelValue: '金额',
		typeField: '类型',
		typeValue: '数字',
		descriptionField: '描述',
		descriptionValue: '合同不含税金额',
		required: '必填',
		ai: 'AI',
		migration: '计划内迁移，锁定时间短',
	},
	rightsVisual: {
		groups: ['管理员', '销售团队', '客户支持'],
		project: '主项目',
		sales: '销售',
		opportunities: '商机',
		clients: '客户',
		support: '客户支持',
		inherited: '继承',
		levels: {
			none: '无访问权限',
			read: '可查看',
			edit: '可编辑',
			manage: '可管理',
		},
		field: '字段“利润率”',
		hidden: '隐藏',
		sqlChange: '<b>直接 SQL 会话</b>修改了<b>“ERP 迁移”</b>',
		sqlMeta: '02:46 · 本地连接 · psql',
		sqlDiff: '金额：<s>125,000</s> → 130,000',
		undo: '↶ 撤销',
		formChange: '<b>表单“报价申请”</b>创建了<b>“内网改版”</b>',
		formMeta: '公开回复 · 由 Camille 发布',
	},
	agentVisual: {
		agent: '智能体',
		via: '通过 MCP 连接 · 令牌“销售”',
		question: '有多少商机处于谈判阶段，总金额是多少？',
		listArgs: 'opportunites · statut = 谈判中',
		answer: '两个商机，共计 <b>€182,000</b>：ERP 迁移（€130,000）和车队跟踪（€52,000）。',
		request: '添加一个百分比格式的“成交概率”字段。',
		proposeArgs: 'opportunites · 成交概率 · number',
		proposed: '已提议：需要团队中的某位成员在 basedb 中批准。',
		badge: '提议',
		expires: '23 小时后过期',
		what: '向<b>商机</b>添加字段<b>“成交概率”</b>（数字）',
		by: '由智能体提议 · 令牌“销售”',
		refuse: '拒绝',
		approve: '批准',
	},
	bento: {
		label: '以及其他一切',
		title: '团队工具应有的一切，而且不离开 PostgreSQL。',
		text: '每项功能都写入同样的数据表，遵循同样的权限，记入同样的历史记录。',
		more: '了解更多 →',
		views: {
			title: '同一批行，八种视图',
			text: '协作视图供整个团队使用，个人视图只属于自己：每个人选择自己的查看方式，没有人需要复制数据。',
			chips: ['网格', '看板', '日历', '时间线', '画廊', '列表', '表单', '问卷'],
		},
		forms: {
			title: '共享表单',
			text: '公开链接，或仅限已登录的成员。填写表单不会获得数据表的任何权限。',
			href: '/fonctionnalites/formulaires-partages/',
		},
		environments: {
			title: '环境',
			text: '一个数据库，多个环境。比较结构，从一个迁移到另一个，同步行。',
			chips: ['生产', '预发布', '开发'],
			href: '/fonctionnalites/environnements/',
		},
		collaboration: {
			title: '多人协作',
			text: '他人的写入实时呈现，您能看到谁在看哪一行，并就地讨论：评论、提及、通知。Ctrl+Z 撤销最后一次写入，宁可拒绝也不会覆盖他人的工作。',
			chips: ['实时', '在线状态', '评论', '提及', 'Ctrl+Z'],
			href: '/fonctionnalites/collaboration/',
		},
		small: {
			ai: {
				title: '网格中的 AI',
				text: '由模型根据其他列填写的字段，以及能提议筛选、查询和列的 Copilot，一键应用。支持 OpenAI、Anthropic、Mistral，或运行在您自己机器上的模型。',
				code: '用一句话总结 {{Notes}}',
				href: '/fonctionnalites/ia/',
			},
			formulas: {
				title: '关联与公式',
				text: '真正的外键，由 PostgreSQL 计算的法语或英语公式，以及跨关联的查找引用、汇总和计数。',
				code: 'ROUND([Montant HT] * (1 + [Taux de TVA]), 2)',
				href: '/fonctionnalites/tables-et-champs/#公式',
			},
			richText: {
				title: '富文本与变量',
				text: '用于格式化文本的可视化编辑器，写入时自动清理；在任何长文本中，{{Ville}} 都会显示为该行的值。',
				code: '{{Date}} 送达 {{Ville}}',
				href: '/fonctionnalites/tables-et-champs/#富文本与变量',
			},
			languages: {
				title: '您的语言',
				text: '界面会跟随浏览器的语言，共二十种可选；每个人都能在自己的设置中更改。',
				href: '/fonctionnalites/droits/#您的设置',
			},
			sharedViews: {
				title: '共享视图',
				text: '通过链接共享只读视图，可嵌入其他网站；日历还能变成日历应用可订阅的源。',
				href: '/fonctionnalites/vues-partagees/',
			},
			syncedTables: {
				title: '同步数据表',
				text: '一张数据表，从在线 CSV、日历或另一个 basedb 的共享视图保持同步更新。',
				href: '/integrations/synchronisation/',
			},
			templates: {
				title: '数据库模板',
				text: '十个开箱即用的模板，用一句话向 AI 描述即可生成数据库，还能把您自己的数据库保存为模板。',
				href: '/modeles/',
			},
			files: {
				title: '文件与图片',
				text: '存放在主机磁盘上，或兼容 S3 的存储中：AWS、Scaleway、OVH、Cloudflare R2、Garage、MinIO……',
				href: '/fonctionnalites/fichiers/',
			},
			import: {
				title: 'CSV 与 JSON 导入',
				text: '拖入一个文件：导入功能会推断类型，创建数据表或补充现有数据表，并逐行说明哪些内容被拒绝。',
				href: '/guides/premiers-pas/',
			},
			accounts: {
				title: '账户与邀请',
				text: '每个人都可以创建自己的账户和项目，并通过链接邀请他人，授予可查看、可编辑或可管理级别；支持密码、Google、Microsoft 或任何 OpenID Connect 身份提供商登录。',
				href: '/hebergement/connexion/',
			},
			webhooks: {
				title: 'Webhook',
				text: '每次写入都可以通知其他系统：带签名的负载，按顺序投递，失败重试。',
				href: '/integrations/webhooks/',
			},
			settings: {
				title: '个人设置',
				text: '您的语言、主题、日期顺序、通知、会话和令牌，集中在一处。',
				href: '/fonctionnalites/droits/#您的设置',
			},
		},
	},
	selfHost: {
		label: '自托管',
		title: '您的数据{留在您自己的服务器上。}',
		lead: 'basedb 是自由软件（AGPL-3.0）：一个镜像、一个 PostgreSQL 数据库，仅此而已——不强制依赖第三方服务，没有遥测。用 <code>pg_dump</code> 备份，用任何 PostgreSQL 客户端读取。',
		services: {
			db: 'PostgreSQL 16，存放您的数据',
			basedb: '界面、REST API 和 MCP 服务器，共用一个端口',
			proxy: 'Caddy，自动 HTTPS（可选）',
		},
		links: [
			{
				href: '/hebergement/docker/',
				label: 'Docker Compose 指南 →',
			},
			{
				href: '/hebergement/variables/',
				label: '全部环境变量 →',
			},
		],
		steps: [
			{
				title: '获取 basedb',
				code: 'git clone https://github.com/eodia/basedb.git\ncd basedb && cp .env.example .env',
			},
			{
				title: '在 .env 中设置两个密钥',
				code: 'POSTGRES_PASSWORD=your-strong-password\n# openssl rand -base64 32\nBASEDB_ENCRYPTION_KEY=…',
			},
			{
				title: '启动',
				code: 'docker compose up -d\n# 然后打开 http://localhost:3000，创建您的账户',
			},
		],
	},
	faq: {
		label: '常见问题',
		title: '大家常问的问题。',
		text: '还有其他问题？<a href="/guides/introduction/">文档</a>里多半有答案。',
		items: {
			difference: {
				q: 'basedb 与其他协作式数据库有何不同？',
				a: '在于数据存放的位置。其他产品把您的行存放在通用数据模型中（编号的列、JSON 文档），而 basedb 为每张数据表创建一张真正的 PostgreSQL 数据表，为每个字段创建一个类型明确的真正的列，名称清晰可读。即使离开 basedb，您的数据依然可用。',
			},
			sql: {
				q: '我可以直接用 SQL 写入数据表吗？',
				a: '可以。约束（类型、必填、单选、外键）由 PostgreSQL 本身保证，触发器甚至会把直接 SQL 的写入连同执行它的会话一起记入历史记录。界面中的 SQL 控制台和 psql 读取的是同样的数据表；在界面中，每个人都以自己的权限编写 SQL、保存查询，如果管理该数据库，还可以将查询变为真正的 PostgreSQL 视图。',
			},
			ai: {
				q: '哪些内容会发送给 AI 服务商？',
				a: '在您配置服务商之前，什么都不会发送。配置之后，对于结构草稿和 Copilot，默认只发送结构和您输入的那句话；是否允许 Copilot 读取数据，是每次对话中的一个复选框。让 AI 生成数据库模板时，只发送您的那句话。AI 字段会在您明确同意后，发送其指令中引用的列。',
			},
			together: {
				q: '多人可以同时处理同一张数据表吗？',
				a: '可以。他人的写入无需刷新即可显示，他们正在查看的数据表或行上会显示其头像。您可以评论某一行，用 @ 提及某人，铃铛会发出通知。而 Ctrl+Z 只撤销您自己的写入：如果他人在此之后做了修改，它宁可拒绝也不会覆盖。',
			},
			languages: {
				q: '支持哪些语言？',
				a: '二十种：法语、英语、德语、西班牙语、意大利语、葡萄牙语（巴西）、荷兰语、波兰语、捷克语、瑞典语、丹麦语、挪威语、芬兰语、罗马尼亚语、匈牙利语、土耳其语、乌克兰语、日语、简体中文和韩语。界面默认使用浏览器的语言，每个人都可以在设置中更改；本站和文档也提供同样的语言。',
			},
			agent: {
				q: 'AI 智能体如何接入？',
				a: '通过 MCP 服务器，使用仅限于一个数据库的集成令牌，默认只读。智能体按其权限读取、创建和修改行；它不会删除任何内容，也不会修改结构：它只提议，由人来批准。',
			},
			postgres: {
				q: '需要哪个版本的 PostgreSQL？',
				a: 'PostgreSQL 16 或更高版本，并需要 pg_trgm 和 unaccent 扩展（官方镜像中已包含）。随附的 docker-compose 会启动一个 PostgreSQL 16；您也可以将 DATABASE_URL 指向自己的服务器。',
			},
			production: {
				q: '可以用于生产环境吗？',
				a: 'basedb 正处于积极开发阶段：内核、API、MCP 服务器和界面均已可用，并由一千多项测试覆盖，但部分功能仍有待完成（参见路线图）。欢迎试用，并像备份任何 PostgreSQL 数据库一样备份您的数据库。',
			},
			license: {
				q: '采用什么许可证？',
				a: 'AGPL-3.0-or-later。您可以自由使用、修改和托管它；如果您将修改后的版本作为服务提供，则需要公开其源代码。',
			},
		},
	},
	cta: {
		title: '您的数据值得{真正的数据表。}',
		text: '几分钟内装好 basedb，邀请您的团队，牢牢掌控每一行数据。',
		install: '安装 basedb',
		github: '在 GitHub 上查看代码',
	},
	changelog: {
		label: '更新日志',
		title: 'basedb 的变化',
		intro: '每项变更的细节见<a href="https://github.com/eodia/basedb/commits/main">仓库的提交历史</a>。接下来要做的：<a href="/feuille-de-route/">路线图</a>。',
		entries: {
			forms: {
				date: '2026-09-29',
				title: '让人愿意填写的表单',
				tag: '新功能',
				items: [
					'<strong>问卷占据整个屏幕</strong>：每次滑入一个问题，选项是大卡片，评分用星星，并且全部可以用键盘操作——<strong>Enter</strong>、字母 A、B、C……、Y 或 N、数字。单选题会自动跳转到下一题。<a href="/fonctionnalites/vues/#表单与问卷">表单与问卷</a>',
					'<strong>专属外观</strong>：八种主题，从浅色到夜色，还有纸张，一种颜色、一种字体、一种对齐方式——共享链接的页面也会呈现同样的外观。',
					'<strong>添加显示条件…</strong>：只有当之前的某个回答需要时，问题才会被提出；被隐藏的问题既不是必填项，也不会被保存。',
					'<strong>无需任何设置即可开始使用</strong>：新表单只询问填写者要回答的内容，而不是团队随后填写的状态，它会采用所属数据表的颜色，并在每个字段中显示示例。提交时还会有彩带庆祝效果。',
				],
			},
			formulaLanguages: {
				date: '2026-09-28',
				title: '公式支持法语或英语',
				tag: '新功能',
				items: [
					'<strong>在任意屏幕上，都可以用法语或英语输入公式</strong>，甚至可以混用两种语言：<code>SI</code> 或 <code>IF</code>、<code>ARRONDI</code> 或 <code>ROUND</code>、<code>JOURS</code> 或 <code>DAYS</code>……参数之间用 <code>;</code> 或 <code>,</code> 分隔。<a href="/fonctionnalites/tables-et-champs/#公式">公式</a>',
					'<strong>公式会以屏幕所用的语言重新显示</strong>：法语屏幕上显示法语，其余十九种语言中显示英语——已有的公式和「函数」面板也是如此。API 会以请求的语言返回公式，未指定时则用英语。',
					'以非法语语言提供的官方模板，其公式会以英语形式提供。数据库中不会有任何变化：列不变，SQL 不变，也无需迁移。',
				],
			},
			search: {
				date: '2026-09-27',
				title: '一键查找一切：Ctrl+K',
				tag: '新功能',
				items: [
					'<strong>一个输入框查找一切</strong>——<strong>Ctrl+K</strong>，或顶部工具栏中央的输入框：数据表、视图、问题、仪表盘、自动化、列，以及行本身，均按您的权限读取；在大屏幕上还会显示所选结果的预览。<a href="/fonctionnalites/recherche/">搜索</a>',
					'<strong>想到什么就打什么</strong>：不区分重音符号和大小写，输入开头也可以——<code>新客</code>对应「新客户」——容忍一次打字错误，<code>客户 成都</code>可在客户数据表中查找「成都」；您常打开的内容会排到前面。',
					'<strong>所有命令都能用键盘完成</strong>：新建、前往、关闭、撤销、切换主题、复制页面链接。<code>&gt;</code>只查找命令，<code>#</code>只查找对象，<code>/</code>只查找行；<strong>Tab</strong> 在某个数据表或数据库内查找。',
					'<strong>有问题吗？</strong>直接输入：<strong>向 Copilot 提问</strong>会把它交给当前打开的数据库。',
				],
			},
			questions: {
				date: '2026-09-27',
				title: '专属问题，文本中的数字',
				tag: '新功能',
				items: [
					'<strong>每个人都能保存自己的问题</strong>，即使没有可管理级别：个人问题只有自己能看到；管理数据库的人可以像查询一样，把问题共享给整个数据库或指定用户组。<a href="/fonctionnalites/tableaux-de-bord/">仪表盘</a>',
					'<strong>问题在标签页中打开</strong>，与数据表并列：<strong>新建问题</strong>和<strong>新建 SQL 问题</strong>位于标签栏的 <strong>+</strong> 和数据库菜单中；标签页会保留您留在其中的内容。<strong>保存副本</strong>能让您拥有一个自己无法修改的问题。',
					'<strong>文本中的数字</strong>：如今支持排版的仪表盘文本，可以引用取自某张卡片、某个问题或某个筛选条件的值——<code>{{chiffre_affaires}}</code>——按读者的权限计算，即使在通过链接共享的仪表盘中也是如此。<a href="/fonctionnalites/tableaux-de-bord/#文本中的数字">文本中的数字</a>',
					'查询、SQL 视图和问题也可以在各自的菜单中右键删除。',
				],
			},
			addresses: {
				date: '2026-09-27',
				title: '每个屏幕都有自己的地址',
				tag: '新功能',
				items: [
					'<strong>地址跟随屏幕</strong>：一张数据表、一个视图、某一行的详情、一个仪表盘、一个自动化、一个问题、您的设置——<code>/bases/ventes/tables/opportunites?ligne=…</code>。把它加入收藏夹，或粘贴到消息里：任何人都能按自己的权限到达同一个位置。<a href="/fonctionnalites/collaboration/#指向每个屏幕的链接">指向每个屏幕的链接</a>',
					'浏览器的<strong>后退</strong>和<strong>前进</strong>按钮会带您回到之前所在的位置；无法访问的地址会显示「此页面不存在」。',
				],
			},
			demo: {
				date: '2026-09-27',
				title: '可试用的演示，使用您的语言',
				tag: '新功能',
				items: [
					'<strong>演示</strong>位于<a href="https://demo.basedb.eodia.com">demo.basedb.eodia.com</a>：账户会预填您浏览器所用的语言，并配有该语言的数据库。您可以查看一切并修改已有内容；创建、删除和 AI 均已禁用，数据库每晚都会恢复到初始状态。',
					'<strong>您自己的演示</strong>：<code>BASEDB_DEMO=1</code> 会开放一个面向所有人的实例，并为每种语言配好一个预先准备的共享账户。<a href="/hebergement/variables/#公开演示">变量</a>',
					'<strong>按链接指定语言</strong>：在 basedb 地址末尾加上 <code>?lang=de</code>，会以德语显示登录界面或某个共享页面；网站正是这样以页面所用的语言引导到演示。<a href="/fonctionnalites/droits/#您的设置">您的设置</a>',
				],
			},
			templateLanguages: {
				date: '2026-09-27',
				title: '模板，用您的语言',
				tag: '新功能',
				items: [
					'<strong>官方模板会以屏幕所用的语言创建</strong>：数据表、字段、选项、视图、仪表盘、自动化、AI 指令——以及随语言换一个世界的示例行：里昂的「Boulangerie Martin」面包店，到了中文版就变成了成都的「陈记面包坊」。<a href="/fonctionnalites/modeles/#在您的语言中">模板</a>',
					'<a href="/modeles/">网站的模板库</a>会以页面所用的语言展示每个模板。',
					'<strong>一份模板，多份词典</strong>：模板只用法语写一次；每种语言只翻译其中的文本，basedb 会自动追踪每个标签被引用的所有位置。会破坏模板的词典不会被使用。<a href="/fonctionnalites/modeles/#向所有实例发布模板">发布模板</a>',
				],
			},
			details: {
				date: '2026-09-27',
				title: '还有',
				items: [
					'<strong>不带示例行的模板</strong>：取消勾选「加载示例数据」，会创建空的数据表，可直接用于您自己的数据。<a href="/fonctionnalites/modeles/#从模板开始">从模板开始</a>',
					'<strong>每个数据库的 API 与 MCP 文档</strong>都用您屏幕所用的语言编写。<a href="/integrations/api-rest/#自动生成的文档">自动生成的文档</a>',
					'在浏览器原本显示自己提示框的地方，现在改用应用主题的提示框；菜单中的「删除」项显示为红色；将鼠标悬停在评论的时间上，会显示完整日期。',
				],
			},
			languages: {
				date: '2026-09-27',
				title: '富文本、变量、更易读的看板',
				tag: '新功能',
				items: [
					'<strong>富文本</strong>：一种新的字段类型，在可视化编辑器中排版——标题、列表、引用、链接——写入时自动清理，并由约束防范直接 SQL 写入。<a href="/fonctionnalites/tables-et-champs/#富文本与变量">富文本与变量</a>',
					'<strong>变量</strong>：长文本可以引用所在行的某一列——<code>{{Ville}}</code>——并在各处显示为该列的值：网格、行详情、API、MCP 服务器、共享视图、自动化。列中保存的是引用本身，<code>psql</code> 读取的也是它。',
					'<strong>更易读的看板</strong>：更宽松的卡片、封面图片，以及引用行中值的描述——“{{Date}} 交付给 {{Client}}”。<a href="/fonctionnalites/vues/">视图</a>',
					'<strong>一步完成重命名</strong>：数据库、数据表或字段都使用同一个对话框；显示名称总会更改，管理员还可以同时在数据库中重命名，并有影响分析作为依据。<a href="/fonctionnalites/tables-et-champs/#修改结构">修改结构</a>',
					'<strong>二十种语言</strong>：界面、本站和文档提供法语、英语、德语、西班牙语、意大利语、葡萄牙语（巴西）、荷兰语、波兰语、捷克语、瑞典语、丹麦语、挪威语、芬兰语、罗马尼亚语、匈牙利语、土耳其语、乌克兰语、日语、简体中文和韩语版本。basedb 默认使用浏览器的语言；<strong>设置 › 外观 › 语言</strong>可以指定其他语言，并在不同设备间保持一致。数字和日期会跟随语言。<a href="/fonctionnalites/droits/#您的设置">您的设置</a>',
				],
			},
			aiProvider: {
				date: '2026-09-27',
				title: '您选择的 AI，甚至可以运行在自己的机器上',
				tag: '新功能',
				items: [
					'<strong>第四个 AI 服务商</strong>：任何兼容 OpenAI API 的服务器——Azure、企业网关，或运行在您自己机器上的模型——都可以在 <code>.env</code> 中声明。调用日志会记录数据发送给了谁。<a href="/fonctionnalites/ia/">basedb 中的 AI</a>',
					'<strong>登录界面</strong>在网格和 SQL 之后，又展示一个随筛选联动变化的仪表盘，以及一个正在运行的自动化，其中包含 AI 步骤。',
				],
			},
			flows: {
				date: '2026-09-27',
				title: '流程式自动化',
				tag: '新功能',
				items: [
					'<strong>图形编辑器</strong>：先是触发器，然后每个步骤一张卡片；连线上的 <strong>+</strong> 可在该位置添加步骤。简单的自动化仍然只需两张卡片。<a href="/fonctionnalites/automatisations/">自动化</a>',
					'<strong>查找行</strong>——订单的客户、最近一张未付发票——然后修改它、引用它，或将它关联到新创建的行。',
					'<strong>多分支条件</strong>：选择第一个条件满足的分支，都不满足时走“否则”；各分支随后汇合。',
					'<strong>数据在步骤之间传递</strong>：<code>{{e2.client}}</code> 引用某个步骤找到或创建的内容，<code>{{e3.reponse.numero}}</code> 引用 Webhook 的响应；每个文本框的菜单只提供之前必定已经发生的内容。',
					'<strong>每次运行，逐步可查</strong>：叠加显示在流程上，标出所走的分支，并说明每个步骤做了什么、用了多长时间。',
					'<strong>自动化 Copilot</strong>：描述数据库应自动完成的事情，或询问某次运行为何失败；它会提议一个完整的自动化，您一键放到流程中，检查后再保存——未经您确认，不会保存任何内容。<a href="/fonctionnalites/automatisations/#copilot">Copilot</a>',
					'<strong>询问 AI</strong>：在步骤中，像 AI 字段一样发送一条引用该行及前序步骤的指令，回答可解读为文本、数字、是或否、日期或列表中的选项，供后续步骤写入或发送。<a href="/fonctionnalites/automatisations/#询问-ai">询问 AI</a>',
				],
			},
			dashboards: {
				date: '2026-09-27',
				title: '仪表盘：问题、图表、筛选',
				tag: '新功能',
				items: [
					'<strong>问题</strong>：用鼠标构建——一张数据表、它的连接、筛选条件、按日、周、月或年计算的度量——或用 <strong>SQL</strong> 编写，只读，按您自己的权限执行，支持变量。<a href="/fonctionnalites/tableaux-de-bord/">仪表盘</a>',
					'<strong>十五种可视化</strong>：数值、与上一时间段对比的趋势、朝目标的进度、仪表、柱状图、条形图、折线图、面积图、组合图、饼图、漏斗图、散点图、表格、交叉表、法国或世界地图。',
					'<strong>一键探索</strong>：点击一个数据点，即可打开其背后的行、更细的时间段或另一种拆分方式。',
					'<strong>网格布局的仪表盘</strong>：用鼠标移动卡片、调整大小，支持标签页、章节标题、文本和嵌入页面。',
					'<strong>共享筛选</strong>——时间段、类别、文本、数字、日期分组——控制一张、多张或全部卡片，并可设置默认值。',
					'<strong>随心定制图表</strong>：每个系列或每个扇区的颜色和名称，环形图、半圆或玫瑰图，带合计的堆叠，平滑或阶梯折线，坐标轴、刻度、对数刻度；表格可重命名列，并按数值显示条形和颜色。',
					'<strong>仪表盘 Copilot</strong>：在对话中提议问题、对仪表盘的修改（可撤销）以及筛选值，一键应用。只有结构会发送给服务商，除非您允许它读取结果。<a href="/fonctionnalites/tableaux-de-bord/#copilot">Copilot</a>',
					'<strong>共享仪表盘</strong>：通过链接共享，公开或仅限成员——必要时仅限部分用户组——还可以嵌入其他网站：卡片和筛选均为只读，按发布者的权限读取。<a href="/fonctionnalites/tableaux-de-bord/#共享仪表盘">共享</a>',
					'“界面”现已更名为<strong>仪表盘</strong>；现有的仪表盘原样打开，显示在新的网格上。',
				],
			},
			sqlViews: {
				date: '2026-09-27',
				title: '已保存的查询与 SQL 视图',
				tag: '新功能',
				items: [
					'<strong>人人可用的 SQL</strong>：没有可管理级别时，SQL 标签页以只读方式、按您自己的权限执行，由 PostgreSQL 本身应用——未开放的数据表并不存在，隐藏的字段会被拒绝。“您的权限”标签会提醒这一点。<a href="/fonctionnalites/requetes-et-vues-sql/">查询与 SQL 视图</a>',
					'<strong>已保存的查询</strong>，放在数据表下方的“查询”分组中：个人使用、供整个数据库使用或供部分用户组使用。共享查询共享的是其文本，绝不会共享其作者能读取的内容；从侧边栏打开时，它会立即以只读方式执行。',
					'<strong>SQL 视图</strong>：真正的 PostgreSQL 视图，与数据表并列，带有颜色、图标和一个小眼睛图标，<code>psql</code> 和您的工具同样可以读取。每个人都按自己的权限读取，侧边栏只向能读取其全部内容的人显示它们。',
					'视图会跟随结构变化：重命名不会破坏它们，公式变更会使它们暂时移除然后恢复；无法再成立的视图会保留其定义，等待修正。',
				],
			},
			settings: {
				date: '2026-09-27',
				title: '您的设置',
				tag: '新功能',
				items: [
					'<strong>设置</strong>，位于个人资料菜单中：您的姓名、邮箱地址以及与账户关联的身份提供商；您的密码和已打开的会话。<a href="/fonctionnalites/droits/">账户与登录</a>',
					'<strong>外观</strong>：主题、日期顺序——<code>25/09/2026</code> 或 <code>2026-09-25</code>——以及日历中每周的第一天；后两项会在不同设备间保持一致。',
					'<strong>通知</strong>：按类型逐一关闭您不再需要的通知。<strong>令牌</strong>：您在所有数据库上创建的令牌、它们最近一次的使用情况，以及撤销操作。',
				],
			},
			v020: {
				date: '2026-09-26',
				title: '0.2.0 版：各自的账户、项目与邀请',
				tag: '新功能',
				items: [
					'<strong>首次登录</strong>：在全新的实例上，第一个页面会用您的邮箱地址和密码创建管理员账户——不再有默认账户，也无需再到日志里找密码。<a href="/guides/installation/">安装</a>',
					'<strong>创建账户</strong>：每个人都可以创建自己的账户，再创建自己的项目，并成为其管理者。管理后台可以关闭账户创建，或仅限特定域名。<a href="/hebergement/connexion/">账户与登录</a>',
					'<strong>共享项目或数据库</strong>：拥有可管理级别的人可以通过链接邀请他人，授予可查看、可编辑或可管理级别；查看谁有访问权限，更改级别或将其移除。绝不会超出自己所管理的范围。',
					'<strong>隐私</strong>：每个人只能看到与自己共享项目的人，他人已占用的项目名称也无法再被猜到。',
					'<strong>使用 Google、Microsoft 登录</strong>，以及任何 OpenID Connect 身份提供商（Keycloak、GitLab……），在 <code>.env</code> 中声明；如果允许创建账户，首次登录时会自动创建账户。<a href="/hebergement/connexion/">配置</a>',
					'<strong>全新的登录界面</strong>，采用应用的主题，浅色或深色，动画克制；应用中的空状态也配上了插图。',
					'<strong>无损更新</strong>：basedb 在启动时自动更新其目录，0.1 版的安装也不例外；如果数据库已被更新的版本升级过，它会拒绝启动。<a href="/hebergement/sauvegardes/">更新</a>',
				],
			},
			dockerImage: {
				date: '2026-09-26',
				title: '单一 Docker 镜像',
				tag: '部署',
				items: [
					'basedb 只需<strong>一个镜像</strong>：Docker Hub 上的 <code>eodia/basedb</code>，支持 amd64 和 arm64，包含界面、位于 <code>/api</code> 的 API 和位于 <code>/mcp</code> 的 MCP 服务器，共用<strong>一个端口</strong>。<a href="/guides/installation/">安装</a>',
					'两个文件就够了——<code>docker-compose.yml</code> 和 <code>.env</code>——无需克隆仓库，也无需构建任何东西；更新只需 <code>docker compose pull</code>。',
					'在域名后面，HTTPS 代理不再需要做任何路由：所有请求都转发到 3000 端口。',
				],
			},
			automations: {
				date: '2026-09-26',
				title: '自动化、界面、公式、协作',
				tag: '新功能',
				items: [
					'<strong>公式</strong>使用法语函数——<code>SI</code>、<code>ARRONDI</code>、<code>JOURS</code>……——成为由 PostgreSQL 生成的列；跨关联的<strong>查找引用</strong>、<strong>汇总</strong>和<strong>计数</strong>。<a href="/fonctionnalites/tables-et-champs/">字段</a>',
					'<strong>新类型</strong>：多项关联、人员、电子邮件、自动编号、按钮；以及像类型一样选择的格式——货币、百分比、时长、星级评分、电话、条形码。',
					'<strong>八种视图</strong>：<strong>画廊</strong>和<strong>列表</strong>加入另外六种；面向所有读者的<strong>个人视图</strong>、锁定视图、手动排序、时间线中的依赖关系。<a href="/fonctionnalites/vues/">视图</a>',
					'<strong>网格</strong>：快速搜索、分组、基于整个筛选结果的逐列统计、按规则着色、行高。',
					'<strong>共享视图</strong>：只读，可嵌入其他网站；日历可变为 <strong>iCalendar 订阅源</strong>，供 Google 日历、Outlook 或 Apple 日历使用。<a href="/fonctionnalites/vues-partagees/">共享</a>',
					'<strong>协作</strong>：评论与提及、通知、他人写入实时呈现、数据表和行上的在线状态。<a href="/fonctionnalites/collaboration/">多人协作</a>',
					'<strong>Ctrl+Z</strong> 撤销最后一次写入——一个单元格、一张被移动的卡片、一整次导入——如果他人在此之后做了修改，它宁可拒绝也不会覆盖。',
					'<strong>自动化</strong>：在行被创建或修改时、定时或点击按钮时触发——修改、创建、通知、调用 Webhook、发送到 Slack。<a href="/fonctionnalites/automatisations/">自动化</a>',
					'<strong>界面</strong>：仪表盘——数字、图表、列表、文本——每个人按自己的权限查看。<a href="/fonctionnalites/tableaux-de-bord/">仪表盘</a>',
					'<strong>集成</strong>：Slack 频道，以及从在线 CSV、日历或另一个 basedb 的视图同步的<strong>同步数据表</strong>。<a href="/integrations/synchronisation/">集成</a>',
					'<strong>数据库模板</strong>：包含十个模板的模板库，用一句话向 AI 描述即可生成数据库，任何数据库都可以保存为模板。<a href="/modeles/">模板库</a>',
					'<strong>权限</strong>：没有可管理级别的人，结构界面变为只读。',
					'<strong>全新形象</strong>：新的标志、配色，以及重新设计的登录界面。',
				],
			},
			simpler: {
				date: '2026-09-26',
				title: '更简洁的界面',
				items: [
					'<strong>侧边栏</strong>现在只列出数据库及其数据表；当前数据库的各个界面——结构、历史记录、界面、自动化——集中在一个区块中，就在个人资料上方。',
					'<strong>个人资料菜单</strong>收纳了数据以外的内容：API 与 MCP 文档、集成、用户和权限。',
					'<strong>SQL 查询</strong>从标签栏的“+”或数据库菜单中打开，侧边栏中不再重复。',
					'<strong>新建数据库</strong>在对话框中直接提供模板和 AI；演示数据库也通过同一个模板库创建。',
					'<strong>界面不再提供会被拒绝的操作</strong>：没有可管理级别就没有结构按钮，没有删除权限就没有“删除”；读者可以创建自己的视图，而不是碰到一条错误消息。',
					'<strong>系统列</strong>归入“系统信息”，不再在每张数据表上逐一列出。',
					'<strong>行详情</strong>新增评论、用于发邮件或拨打电话的按钮，以及一键设置的评分。',
					'<strong>登录界面</strong>去掉了 3D 动画背景，换成轻量的界面，并遵循“减少动态效果”偏好。',
				],
			},
			environments: {
				date: '2026-09-26',
				title: '环境、共享表单、视图',
				items: [
					'<strong>环境</strong>：同一个数据库的生产、预发布、开发环境；并排比较、迁移计划、行同步。',
					'<strong>结构历史记录</strong>：数据表和字段的每一次创建或修改，都由目录上的触发器捕获。',
					'<strong>共享表单</strong>：公开链接或仅限成员的链接，可按日期或回复数量关闭，回复在历史记录中注明来源。',
					'<strong>六种视图</strong>：网格、看板、日历、时间线、表单、问卷。',
					'<strong>数据历史记录</strong>：撤销修改，恢复已删除的行。',
					'<strong>AI</strong>：任意字段都可启用 AI 选项，以及 Copilot。',
					'<strong>关联</strong>和<strong>链接</strong>：两种不同的类型；长文本使用 Markdown 编写。',
					'<strong>Webhook</strong>：带签名、按顺序；<strong>智能体提议</strong>等待批准。',
					'<strong>Docker</strong>：包含三个构建目标的 Dockerfile、完整的 docker-compose、可选的 HTTPS 代理。',
				],
			},
			projects: {
				date: '2026-09-25',
				title: '项目、权限、MCP 服务器',
				items: [
					'数据库之上的<strong>项目</strong>，以及按<strong>用户组</strong>分配的四级权限：无访问权限、可查看、可编辑、可管理。',
					'<strong>账户</strong>：临时密码，首次登录时更改，管理操作需提升权限。',
					'<strong>MCP 服务器</strong>及 stdio 中继；REST API 与 MCP 共用的<strong>集成令牌</strong>。',
					'为每个数据库<strong>自动生成的“API 与 MCP”文档</strong>。',
				],
			},
			fields: {
				date: '2026-09-20',
				title: '字段、单选、导入',
				items: ['编辑字段以及单选字段的选项。', '<strong>导入</strong> CSV 和 JSON 文件。', '数据表菜单：重命名、添加描述、删除。'],
			},
			firstCommit: {
				date: '2026-09-20',
				title: '首次提交',
				items: ['单体仓库（monorepo）：命名规范、错误代码注册表、从架构文档中提取的目录、内核、API、界面。'],
			},
		},
	},
	roadmap: {
		label: '路线图',
		title: '接下来要做的',
		intro: 'basedb 正处于积极开发阶段。本页列出仍然缺少的功能，不承诺日期。有想法或需求？<a href="https://github.com/eodia/basedb/issues">提交 issue</a>。已经实现的功能：<a href="/nouveautes/">更新日志</a>。',
		columns: {
			next: {
				title: '即将推出',
				items: {
					restoreTable: {
						title: '单独恢复一张数据表',
						text: '已删除的数据表仍可通过 SQL 以其降级后的名称读取；从界面中单独将其恢复的功能即将推出。',
					},
					aiSettings: {
						title: '在界面中配置 AI',
						text: '按租户设置服务商、模型和密钥，无需通过 API 的环境变量。',
					},
					mail: {
						title: '通过电子邮件发送通知和邀请',
						text: '目前，提及、回复和指派会在 basedb 内通知，邀请则是一个需要您自行发送的链接；今后它们也将可以通过电子邮件发出。',
					},
				},
			},
			later: {
				title: '之后',
				items: {
					formLinks: {
						title: '共享表单中的关联与文件',
						text: '在关联数据表中进行受限搜索，为匿名访客提供有限制的文件上传。',
					},
					moreEvents: {
						title: '更多通知事件',
						text: '在收到表单回复、智能体提议或 Webhook 被停用时收到通知。',
					},
					sqlViewsAcross: {
						title: '跨环境的 SQL 视图',
						text: '在创建或比较环境时，以及在数据库模板中，随结构一起复制 SQL 视图。',
					},
					loops: {
						title: '自动化中的循环与等待',
						text: '对找到的每一行重复执行步骤，在下一步之前等待（“三天后”），并将流程带入数据库模板。',
					},
					textFormulas: {
						title: '文本公式',
						text: '提取、替换或截断文本的一部分。',
					},
					bulk: {
						title: '声明式批量操作',
						text: '对数千行的修改，作为单个操作记入历史记录。',
					},
					tombstones: {
						title: '清理墓碑记录',
						text: '清除不再需要的删除痕迹。',
					},
				},
			},
		},
	},
	gallery: {
		label: '模板',
		title: '几秒钟即可就绪的数据库',
		intro: '每个模板都会创建相互关联的数据表、示例行、视图、仪表盘、自动化——以及由 AI 自动填写的字段。在 basedb 中：<strong>新建数据库</strong>，然后选择<strong>从模板开始</strong>。没有合适的？用一句话描述您的需求：AI 会为您量身定制一个数据库。',
		filter: '按类别筛选',
		all: '全部',
		otherCategory: '其他',
		ai: '✦ AI',
		tables: {
			one: '{n} 个数据表',
			other: '{n} 个数据表',
		},
		rows: {
			one: '{n} 行',
			other: '{n} 行',
		},
		views: {
			one: '{n} 个视图',
			other: '{n} 个视图',
		},
		howtoTitle: '用 JSON 编写模板',
		howto: '模板就是一个 JSON 文件：包含它的数据表、字段、关联、行、视图、仪表盘、自动化以及 AI 字段的指令。本页的模板就是仓库中 <a href="https://github.com/eodia/basedb/tree/main/packages/templates/catalog"><code>packages/templates/catalog</code></a> 文件夹里的文件；每个 basedb 实例都会读取 <a href="/modeles/catalogue.json"><code>catalogue.json</code></a>，并将它们提供给用户。管理员也可以将自己的模板导入到实例中，任何数据库都可以保存为模板。',
		format: {
			href: '/fonctionnalites/modeles/',
			label: '模板格式 →',
		},
		back: '← 所有模板',
		defaultCategory: '模板',
		sampleRows: {
			one: '{n} 行示例数据',
			other: '{n} 行示例数据',
		},
		aiTitle: 'AI 计算的内容',
		useTitle: '使用此模板',
		useSteps: ['在 basedb 中，点击<strong>新建数据库</strong>。', '选择<strong>从模板开始</strong>，然后选择“{label}”。'],
		create: '<strong>创建数据库</strong>。',
		createWithAi: '<strong>创建数据库</strong>——如果您愿意，可同意由您的 AI 服务商计算 AI 字段。',
		download: '下载 JSON',
		downloadNote: '可导入您的实例，或先行修改，再提交到模板目录。',
		viewMeta: '— {kind}，{table}',
		dashboard: '<strong>仪表盘</strong>“{label}”— {blocks}',
		blocks: {
			one: '{n} 个区块',
			other: '{n} 个区块',
		},
		automation: '<strong>自动化</strong>“{label}”',
		yes: '是',
		no: '否',
		me: '您',
		kinds: {
			short_text: '短文本',
			long_text: '长文本',
			rich_text: '富文本',
			number: '数字',
			boolean: '复选框',
			date: '日期',
			datetime: '日期和时间',
			select: '单选',
			multi_select: '多选',
			url: '链接',
			email: '电子邮件',
			user: '人员',
			autonumber: '自动编号',
			formula: '公式',
			lookup: '查找引用',
			rollup: '汇总',
			count: '计数',
			button: '按钮',
			link: '关联',
			multi_link: '多项关联',
		},
		viewKinds: {
			grid: '网格',
			kanban: '看板',
			calendar: '日历',
			timeline: '时间线',
			gallery: '画廊',
			list: '列表',
			form: '表单',
		},
	},
	templates: {
		demo: {
			label: '演示：Lumen 工作室',
			summary: '一家小型设计公司，包含客户、项目、任务、发票和评价：在一个数据库中展示 basedb 的方方面面。',
			description: '演示数据库。Lumen 工作室是一家虚构的设计公司。它的数据库展示了数据表之间的关联、查找引用与汇总（按客户统计的营业额、平均评分）、公式（含税金额、延误）、三个基于客户评价由 AI 计算的字段（情感倾向、主题、建议回复）、各类视图——网格、看板、日历、带依赖关系的时间线、画廊、列表、表单——以及一个仪表盘和两个自动化。',
			category: '演示',
			tags: ['AI', '关联', '所有视图', '仪表盘'],
		},
		'analyse-avis': {
			label: '客户评价分析',
			summary: '收集评价，让 AI 从中提取情感倾向、主题、紧急程度，并起草回复。',
			description: '适用于商店、餐厅或品牌：评价来自公开表单或导入，AI 会逐条阅读。它会判断情感倾向、识别主要主题、标记需要尽快回复的评价、提取客户建议，并起草回复供您审阅。产品会汇总平均评分和评价数量；仪表盘用于跟踪满意度。',
			category: '客户关系',
			tags: ['AI', '表单', '仪表盘'],
		},
		'base-connaissances': {
			label: '知识库',
			summary: '帮助文章与客户问题：AI 会总结、分类，并根据文章给出回复建议。',
			description: '适用于客服团队。帮助文章按类别整理并随时间跟踪；客户问题通过公开表单提交。AI 会总结每篇文章并评估其难度级别，对每个问题进行分类，并起草回复供审阅。',
			category: '客户支持',
			tags: ['AI', '表单', '列表'],
		},
		'calendrier-editorial': {
			label: '内容日历',
			summary: '在日历上规划文章、帖子和电子报；AI 提供标题引语和关键词建议。',
			description: '适用于市场团队或编辑部。每条内容从创意推进到发布，排入发布日历并归属于某个营销活动。AI 会根据简报提供标题引语和关键词建议，公司所有人都可以通过表单提交选题建议。',
			category: '市场营销',
			tags: ['AI', '日历', '看板', '表单'],
		},
		crm: {
			label: '销售 CRM',
			summary: '企业、联系人与商机：销售管道、沟通记录，以及由 AI 建议下一步行动。',
			description: '为销售团队打造的轻量级 CRM。商机在销售管道中推进，带有按成交概率加权的金额，AI 会根据备注评估风险并建议下一步行动。与客户的沟通会被记录和总结，企业汇总其商业价值。',
			category: '销售',
			tags: ['AI', '销售管道', '看板', '日历'],
		},
		evenements: {
			label: '活动与报名',
			summary: '会议、工作坊和网络研讨会：报名、剩余名额，以及由 AI 解读的参与者反馈。',
			description: '用于组织周期性活动。每场活动都会统计报名人数和剩余名额；报名状态一直跟进到出席。活动结束后，参与者留下反馈，由 AI 按情感倾向分类并进行总结。公开表单可让人加入邮件列表。',
			category: '活动策划',
			tags: ['AI', '日历', '表单', '汇总'],
		},
		'gestion-projet': {
			label: '项目管理',
			summary: '项目、任务与里程碑：路线图、任务依赖关系、看板和日历。',
			description: '用于并行管理多个项目。每个项目汇总其任务和工时；任务在看板中跟踪，在显示依赖关系的时间线上排期，里程碑则在日历中查看。AI 会根据项目描述和进展，为管理层撰写项目状态简报。',
			category: '组织',
			tags: ['时间线', '依赖关系', '看板', 'AI'],
		},
		inventaire: {
			label: '库存管理',
			summary: '商品、供应商与出入库记录：库存自动计算，缺货提前可见。',
			description: '适用于工坊、商店或后勤部门。每次入库或出库都是一条出入库记录；每件商品的库存是这些记录的总和，其价值由公式计算，低于阈值的商品会出现在“À commander”（待采购）中。AI 会根据商品名称和类别撰写商品说明。',
			category: '运营',
			tags: ['汇总', '公式', '画廊', 'AI'],
		},
		recrutement: {
			label: '招聘',
			summary: '开放职位、候选人与面试；AI 汇总每份申请，并建议需要深入了解的要点。',
			description: '从申请到录用的招聘跟踪。候选人通过公开表单申请，在看板中逐步推进，面试在日历中安排。AI 会阅读求职信和备注，给出摘要以及面试时要问的问题。它只辅助阅读，不做决定。',
			category: '人力资源',
			tags: ['AI', '表单', '看板', '日历'],
		},
		'suivi-tickets': {
			label: '工单跟踪',
			summary: '由 AI 分类的缺陷与需求，按迭代跟踪直至解决，并附带问题反馈表单。',
			description: '为产品团队打造的工单管理工具。每个工单都关联到一个组件和一个迭代；AI 会建议类别、评估严重程度并总结问题报告。看板跟踪进度，时间线展示迭代，表单让任何人都能报告问题，自动化会记录解决日期。',
			category: '产品与技术',
			tags: ['AI', '看板', '表单', '迭代'],
		},
	},
} satisfies DeepPartial<Dict>;
