/**
 * The Japanese texts of the landing pages, laid over the French ones (`fr.ts`).
 *
 * See `../README.md`.
 */
import type { DeepPartial, Dict } from './index';

export default {
	meta: {
		home: {
			title: 'basedb — すべてのテーブルが本物のPostgreSQLテーブルである共同データベース',
			description: 'グリッドと10種類のビュー、数式、フォームやクイズ、共有ビュー、コメント、オートメーション、ダッシュボード、フィールド単位の権限、完全な履歴、REST APIとMCPサーバー。すべてが、わかりやすい名前の本物のPostgreSQLテーブルの上で動きます。セルフホスト、AGPL-3.0。',
		},
		changelog: {
			title: '更新情報 — basedb',
			description: 'basedbの変更点を、バージョンごとに紹介します。',
		},
		roadmap: {
			title: 'ロードマップ — basedb',
			description: 'basedbがこれから取り組むこと。',
		},
		gallery: {
			title: 'テンプレート — basedb',
			description: 'すぐに使えるデータベース：チケット管理、レビュー分析、CRM、採用… サンプル行、ビュー、ダッシュボード、AIが計算するフィールドまで揃っています。',
		},
		template: {
			title: '{label} — basedbテンプレート',
		},
	},
	eodia: {
		home: 'https://eodia.com/',
		about: 'https://eodia.com/about/',
		contact: 'https://eodia.com/contact/',
	},
	demo: {
		short: 'デモ',
		cta: 'デモを試す',
	},
	nav: {
		aria: 'メインナビゲーション',
		home: 'basedb — ホーム',
		links: [
			{
				href: '/#fonctionnalites',
				label: '機能',
			},
			{
				href: '/modeles/',
				label: 'テンプレート',
			},
			{
				href: '/guides/introduction/',
				label: 'ドキュメント',
			},
			{
				href: '/nouveautes/',
				label: '更新情報',
			},
		],
		developers: '開発者',
		github: 'basedbのGitHubリポジトリ',
		install: 'インストール',
		menu: {
			open: 'メニューを開く',
			close: 'メニューを閉じる',
			features: {
				label: '機能',
				groups: {
					organize: {
						title: '整理する',
						items: {
							tables: {
								href: '/fonctionnalites/tables-et-champs/',
								title: 'テーブルとフィールド',
								text: 'あらゆる用途のフィールド、リレーション、表計算ソフトのような数式。',
							},
							views: {
								href: '/fonctionnalites/vues/',
								title: '10のビュー',
								text: 'グリッド、カンバン、カレンダー、タイムライン、ギャラリー、リスト、地図、フォーム、アンケート、クイズ。',
							},
							forms: {
								href: '/fonctionnalites/formulaires-partages/',
								title: 'フォーム',
								text: '共有するリンク：各回答がそのまま1行になります。',
							},
							files: {
								href: '/fonctionnalites/fichiers/',
								title: 'ファイルと画像',
								text: '見積書、写真、契約書を、その行とともに整理。',
							},
						},
					},
					collaborate: {
						title: 'コラボレーションする',
						items: {
							live: {
								href: '/fonctionnalites/collaboration/',
								title: 'リアルタイムとコメント',
								text: '他の人の作業を見て、行にコメントし、@で同僚をメンション。',
							},
							rights: {
								href: '/fonctionnalites/droits/',
								title: '権限とチーム',
								text: '誰が何を見て、何を変更できるか。列単位まで。',
							},
							history: {
								href: '/fonctionnalites/historique/',
								title: '履歴',
								text: 'すべての変更を記録し、いつでも取り消せます。',
							},
							shared: {
								href: '/fonctionnalites/vues-partagees/',
								title: '共有ビュー',
								text: 'リンクで共有するビュー。自分のサイトにも、カレンダーにも。',
							},
						},
					},
					automate: {
						title: '自動化・分析する',
						items: {
							automations: {
								href: '/fonctionnalites/automatisations/',
								title: 'オートメーション',
								text: '行が変わったら：通知、作成、更新、AIに質問。',
							},
							dashboards: {
								href: '/fonctionnalites/tableaux-de-bord/',
								title: 'ダッシュボード',
								text: '15種類の可視化、共通のフィルター、共有できるリンク。',
							},
							ai: {
								href: '/fonctionnalites/ia/',
								title: 'AIとCopilot',
								text: '1文でデータベースを作成、フィールドは自動で埋まります。',
							},
							templates: {
								href: '/modeles/',
								title: 'テンプレート',
								text: 'すぐに使える10のテンプレートを、自由に調整。',
							},
						},
					},
				},
				feature: {
					tag: '新機能',
					title: 'フローで組むオートメーション',
					text: '探す、判断する、AIに質問する：グラフ型のエディターで組み立て、各実行はステップごとに振り返れます。',
					href: '/nouveautes/',
					cta: 'すべての更新情報',
				},
				all: 'すべての機能',
			},
			solutions: {
				label: 'ソリューション',
				title: 'チームごとに',
				items: {
					crm: {
						team: '営業',
						text: 'パイプライン、連絡先、フォローアップ。',
					},
					recrutement: {
						team: '人事',
						text: '応募、面接、AIによる要約。',
					},
					'calendrier-editorial': {
						team: 'マーケティング',
						text: '記事、投稿、ニュースレターを計画。',
					},
					inventaire: {
						team: '業務',
						text: '自動計算する在庫と、事前にわかる欠品。',
					},
					'gestion-projet': {
						team: 'プロジェクト',
						text: 'マイルストーン、タスク、依存関係。',
					},
					'suivi-tickets': {
						team: 'プロダクト',
						text: 'バグと要望を、AIが仕分け。',
					},
					'base-connaissances': {
						team: 'サポート',
						text: 'ヘルプ記事、質問、AIによる回答案。',
					},
					evenements: {
						team: 'イベント',
						text: '申込み、残席、フィードバック。',
					},
					'analyse-avis': {
						team: 'カスタマーリレーション',
						text: 'AIが読み取り、分類するレビュー。',
					},
				},
				ask: {
					title: 'ほかにお考えのことは？',
					text: 'ご要望を1文で伝えてください。AIがぴったりのデータベースを提案します。',
					href: '/modeles/',
				},
				all: 'すべてのテンプレート',
			},
			developers: {
				label: '開発者',
				groups: {
					build: {
						title: '連携する',
						items: {
							api: {
								href: '/integrations/api-rest/',
								title: 'API REST',
								text: 'インターフェースと同じデータを、OpenAPI 3.1で記述。',
							},
							mcp: {
								href: '/integrations/mcp/',
								title: 'MCPサーバー',
								text: 'AIエージェントのためのツールを、自分の権限の範囲で。',
							},
							webhooks: {
								href: '/integrations/webhooks/',
								title: 'Webhook',
								text: 'すべての書き込みを、署名付きで、順序どおりに、再試行付きで。',
							},
							sql: {
								href: '/integrations/sql/',
								title: '直接SQL',
								text: 'わかりやすい名前の、本物のPostgreSQLテーブル。',
							},
							sync: {
								href: '/integrations/synchronisation/',
								title: '同期',
								text: '外部から最新の状態に保たれるテーブル。',
							},
						},
					},
					host: {
						title: 'ホスティングする',
						items: {
							docker: {
								href: '/hebergement/docker/',
								title: 'Docker Compose',
								text: 'イメージ1つ、PostgreSQLデータベース1つ、ポート1つ。',
							},
							env: {
								href: '/hebergement/variables/',
								title: '環境変数',
								text: 'すべての設定は.envファイルで。',
							},
							https: {
								href: '/hebergement/https/',
								title: 'ドメインとHTTPS',
								text: '自分のプロキシの背後でも、付属のCaddyでも。',
							},
							sso: {
								href: '/hebergement/connexion/',
								title: 'ログインとSSO',
								text: 'Google、Microsoft、任意のOpenID Connectプロバイダー。',
							},
							backup: {
								href: '/hebergement/sauvegardes/',
								title: 'バックアップとアップデート',
								text: 'pg_dumpと、データを失わないアップデート。',
							},
						},
					},
				},
				feature: {
					title: '開発者ページ',
					text: 'すべてのグリッドの裏に、本物のPostgreSQLテーブル。',
					href: '/developpeurs/',
				},
			},
			resources: {
				label: 'リソース',
				groups: {
					learn: {
						title: '学ぶ',
						items: {
							docs: {
								href: '/guides/introduction/',
								title: 'ドキュメント',
								text: 'basedbのすべてを、順を追って。',
							},
							start: {
								href: '/guides/premiers-pas/',
								title: 'はじめに',
								text: '最初のデータベースを、インポートからビューまで。',
							},
							install: {
								href: '/guides/installation/',
								title: 'インストール',
								text: '2つのファイルと1つのコマンドで。',
							},
							principles: {
								href: '/architecture/principes/',
								title: '設計原則',
								text: 'basedbがどう作られていて、なぜそうなのか。',
							},
						},
					},
					follow: {
						title: 'プロジェクトを追う',
						items: {
							news: {
								href: '/nouveautes/',
								title: '更新情報',
								text: 'バージョンごとの変更点。',
							},
							roadmap: {
								href: '/feuille-de-route/',
								title: 'ロードマップ',
								text: 'これから取り組むこと。',
							},
							github: {
								href: 'https://github.com/eodia/basedb',
								title: 'GitHub',
								text: 'コード、Issue、リリース。',
							},
							eodia: {
								href: 'https://eodia.com/',
								title: 'Eodia',
								text: 'basedbを開発するスタジオ。',
							},
						},
					},
				},
			},
		},
	},
	language: {
		label: '言語',
		current: '言語：{name}',
	},
	footer: {
		tagline: 'すべてのテーブルが本物のPostgreSQLテーブルである、共同データベース。',
		madeBy: 'AIネイティブなソフトウェアスタジオ、<a class="eodia" href="https://eodia.com/">Eodia</a>が開発するフリーソフトウェアです。',
		columns: {
			product: {
				title: '製品',
				links: [
					{
						href: '/#fonctionnalites',
						label: '機能',
					},
					{
						href: '/nouveautes/',
						label: '更新情報',
					},
					{
						href: '/feuille-de-route/',
						label: 'ロードマップ',
					},
					{
						href: '/#faq',
						label: 'よくある質問',
					},
				],
			},
			docs: {
				title: 'ドキュメント',
				links: [
					{
						href: '/guides/introduction/',
						label: 'はじめに',
					},
					{
						href: '/guides/installation/',
						label: 'インストール',
					},
					{
						href: '/integrations/api-rest/',
						label: 'REST API',
					},
					{
						href: '/integrations/mcp/',
						label: 'MCPサーバー',
					},
				],
			},
			hosting: {
				title: 'ホスティング',
				links: [
					{
						href: '/hebergement/docker/',
						label: 'Docker Compose',
					},
					{
						href: '/hebergement/variables/',
						label: '環境変数',
					},
					{
						href: '/hebergement/https/',
						label: 'ドメインとHTTPS',
					},
					{
						href: '/hebergement/sauvegardes/',
						label: 'バックアップ',
					},
				],
			},
			project: {
				title: 'プロジェクト',
				links: [
					{
						href: 'https://github.com/eodia/basedb',
						label: 'GitHub',
					},
					{
						href: 'https://github.com/eodia/basedb/tree/main/docs/architecture',
						label: 'アーキテクチャ文書',
					},
					{
						href: 'https://github.com/eodia/basedb/blob/main/LICENSE',
						label: 'AGPL-3.0ライセンス',
					},
					{
						href: 'https://github.com/eodia/basedb/issues',
						label: '問題を報告',
					},
				],
			},
			eodia: {
				title: 'Eodia',
				links: [
					{
						href: 'https://eodia.com/',
						label: 'スタジオ',
					},
					{
						href: 'https://eodia.com/about/',
						label: '会社概要',
					},
					{
						href: 'https://eodia.com/contact/',
						label: 'お問い合わせ',
					},
				],
			},
		},
		copyright: '© {year} <a href="https://eodia.com/">Eodia</a> · AGPL-3.0-or-later',
		builtWith: 'このサイトはAstroとStarlightで構築しています。',
	},
	docsFooter: {
		madeBy: 'basedbは、AIネイティブなソフトウェアスタジオ<a href="https://eodia.com/">Eodia</a>が開発するフリーソフトウェアです。',
	},
	teams: {
		meta: {
			title: 'basedb — チーム全員の共同データベース',
			description: 'すべての仕事をひとつの場所に。チーム全員で同時に編集でき、表でも、カンバンでも、カレンダーでも。フォーム、ダッシュボード、オートメーション、AIも使えます。コード不要、無料のフリーソフトウェアです。',
		},
		hero: {
			eyebrow: 'basedb',
			title: 'すべての仕事を、',
			titleAccent: 'ようやくひとつの場所に。',
			lead: '表、カレンダー、フォーム、ダッシュボード、オートメーション。チーム全員のために。表計算ソフトと同じくらい簡単。コードは一行も書きません。',
			primary: 'テンプレートを見る',
			secondary: 'デモを見る',
			facts: ['コード不要', '無料のフリーソフトウェア', 'データは自分たちの手元に'],
		},
		story: {
			grid: {
				title: 'チーム全員が、同じ表に。',
				text: '誰もが同時に作業し、全員が同じ最新の情報を見ています。',
			},
			copilot: {
				title: '聞くだけ。Copilotが対応します。',
				text: '「今週、誰に連絡すればいいですか？」— 最適なフィルターを提案し、クリック一つで適用できます。',
			},
			kanban: {
				title: 'ドラッグするだけ。もう最新です。',
				text: '各ステップが列になります。カードを動かすと、その行が更新されます。',
			},
			calendar: {
				title: 'すべての日付が、あるべき場所に。',
				text: '予定は自動で表示され、自分のカレンダーでも確認できます。',
			},
			dashboard: {
				title: 'そしてすべてが、一目で。',
				text: '数字は同じデータから、自動で計算されます。',
			},
		},
		stage: {
			aria: 'basedbでのチームの顧客フォロー：表、Copilot、カンバン、カレンダー、ダッシュボード',
			tabs: {
				grid: '表',
				copilot: 'Copilot',
				kanban: 'カンバン',
				calendar: 'カレンダー',
				dashboard: 'ダッシュボード',
			},
			project: 'メインプロジェクト',
			projectMeta: 'プロジェクト · 2つのデータベース',
			filterNav: 'ナビゲーションを絞り込む',
			base: '営業',
			otherBase: 'サポート',
			tables: ['顧客', '連絡先', '見積書'],
			baseSection: 'データベース · 営業',
			screens: ['ダッシュボード', 'オートメーション'],
			user: 'Léa Martin',
			views: { grid: 'すべての行', kanban: 'ステータス別', calendar: '商談' },
			toolbar: {
				filter: 'フィルター',
				columns: '列',
				group: 'グループ化',
				colors: '色分け',
				sort: '並べ替え',
				configure: '設定',
			},
			search: '検索…',
			add: '追加',
			columns: {
				name: '顧客',
				status: 'ステータス',
				owner: '担当',
				amount: '金額',
				next: '次の商談',
			},
			statuses: {
				contact: '未連絡',
				meeting: '商談予定',
				quote: '見積送付済み',
				signed: '成約',
			},
			clients: ['田中ベーカリー', 'みどり台クリニック', '桜丘高等学校', '自転車支援協会', '野田商店', '羽田製鉄', '森田工房'],
			addRow: '行を追加',
			perPage: '1 ページあたりの行数',
			card: '担当：{owner}、商談日：{date}',
			addCard: 'カードを追加',
			today: '今日',
			month: '月',
			week: '週',
			dashboards: 'ダッシュボード',
			questions: '質問',
			dashboard: '営業状況',
			dashboardText: '大事なことが一目でわかります。',
			dashboardTabs: ['概要', 'アクティビティ'],
			period: '期間',
			thisYear: '今年',
			share: '共有',
			edit: '編集',
			explore: 'データを探索',
			chart: '顧客別の金額',
			byStage: 'ステータス別の顧客',
			kpis: {
				signed: '成約',
				pending: '見積待ち',
				rate: '成約率',
			},
			copilot: {
				question: '今週、誰に連絡すればいいですか？',
				thinking: '考えています…',
				answer: '4件の顧客が返信を待っています：見積送付済みが2件、商談予定が2件です。',
				card: '顧客をフィルター',
				filter: 'ステータス：見積送付済みまたは商談予定',
				apply: 'フィルターを適用',
				applied: 'フィルターを適用しました',
				placeholder: 'Copilotに質問…',
				filtered: '{n}行に絞り込み',
			},
		},

		teaser: {
			tabs: { label: '動画を選ぶ', short: '1分で', full: '完全なツアー' },
			titleAccent: '1分で。',
			text: 'テーブル、ビュー、フォーム、自動化、AI — basedbの要点をナレーションと音楽で。',
			duration: '1分',
			inEnglish: 'この動画は英語で、字幕も英語です。',
		},

		video: {
			eyebrow: 'デモ',
			title: 'basedbのすべてを、',
			titleAccent: '7分で。',
			text: 'データベースの作成、入力、共有、自動化、運用まで — 実況コメント付きの完全なツアーです。',
			play: '動画を再生',
			duration: '6分36秒',
			chapters: 'チャプター',
			captions: '英語',
			inEnglish: 'この動画は英語で、字幕も英語です。',
			list: [
				{ time: '0:10', title: 'データベースを作成' },
				{ time: '0:49', title: 'テーブル、フィールド、数式' },
				{ time: '1:31', title: '行の詳細とコラボレーション' },
				{ time: '1:56', title: '同じ行の6つのビュー' },
				{ time: '2:29', title: 'フォームとアンケート' },
				{ time: '3:28', title: 'クイズ' },
				{ time: '4:10', title: 'オートメーション' },
				{ time: '4:39', title: 'ダッシュボード' },
				{ time: '4:59', title: 'みんなのSQL' },
				{ time: '5:30', title: '履歴と権限' },
				{ time: '5:53', title: 'API、MCP、Copilot' },
			],
		},

		together: {
			eyebrow: 'コラボレーション',
			title: '全員で。',
			titleAccent: '同時に。',
			text: '他の人の変更はすぐに反映されます。誰がどの行を見ているかがわかり、その行の上でそのまま話し合えます。@ひとつで同僚に知らせられます。',
			demo: {
				path: '営業 / 見積書',
				here: '3人がこのテーブルを見ています',
				columns: {
					client: '顧客',
					status: 'ステータス',
					amount: '金額',
					due: '期限',
				},
				statuses: {
					draft: '下書き',
					sent: '送付済み',
					signed: '成約',
				},
				rows: ['田中ベーカリー', 'みどり台クリニック', '桜丘高等学校', '自転車支援協会', '野田商店', '羽田製鉄'],
				comment: '@{name} 今夜までにこの見積書を確認してもらえますか？',
				reply: '確認しました！',
				toast: '{name}さんが「{field}」を変更しました',
			},
			points: {
				live: {
					title: 'リアルタイム',
					text: 'すべての変更は、ページを再読み込みせずに、すぐ他の人にも表示されます。',
				},
				comments: {
					title: 'コメントとメンション',
					text: '行にコメントし、@で同僚をメンションすると、ベルで知らせが届きます。',
				},
				undo: {
					title: '安心して取り消せる',
					text: 'Ctrl+Zは自分の最後の変更だけを取り消します。同僚の変更が消えることはありません。',
				},
			},
			link: {
				href: '/fonctionnalites/collaboration/',
				label: 'チームで作業する',
			},
		},
		forms: {
			eyebrow: 'フォームとアンケート',
			title: '聞くだけでいい。',
			titleAccent: '答えは、ひとりでに片づく。',
			text: '1ページの単純なフォームも、1画面に1問ずつ聞くアンケートも、色は自社の配色で。リンクを共有すれば、回答はそのままテーブルの1行になります。回答者には、それ以外は何も見えません。',
			modes: {
				label: '質問の表示方法',
				survey: 'アンケート',
				form: 'フォーム',
			},
			demo: {
				title: '見積もり依頼',
				description: '3つの質問だけ。48時間以内にご連絡いたします。',
				count: '全3問',
				start: '開始',
				ok: 'OK',
				hint: 'またはEnter',
				submit: '依頼を送信',
				org: {
					label: '組織名',
					answer: 'アトリエカフェ',
				},
				need: {
					label: 'ご要望',
					options: ['ウェブサイト', 'ブランディング', 'カタログ'],
				},
				budget: {
					label: '予算',
					help: '税抜き、概算で構いません。',
				},
				sent: '送信しました！',
				thanks: 'ありがとうございます！ 48時間以内にご連絡いたします。',
				poweredBy: 'basedb で作成されたフォーム',
				path: '営業 / 依頼',
				view: 'すべての依頼',
				columns: {
					org: '組織名',
					need: 'ご要望',
					budget: '予算',
					stage: 'ステータス',
				},
				stages: {
					new: '新規',
					called: '架電済み',
					quote: '見積もり送付済み',
				},
				rows: ['田中ベーカリー', 'みどり台クリニック', '自転車支援協会', '羽田製鉄'],
				open: '公開中',
				answers: {
					one: '{n}件の回答',
					other: '{n}件の回答',
				},
				active: 'リンク有効',
			},
			points: {
				survey: {
					title: '1画面に1問',
					text: '全画面表示、操作はキーボードだけ:Enterで次へ、A・B・Cで選択——選ぶと同時に自動で次へ進み、送信は盛大に祝われます。',
				},
				access: {
					title: '公開または限定公開',
					text: 'リンクを知っていれば誰でもアカウントなしで回答できます——または、ログイン済みメンバーだけに限定すれば、回答に名前も記録されます。',
				},
				closed: {
					title: '他の情報は見えません',
					text: '回答者にはテーブルの他の情報は一切表示されません。リンクは指定した日付、または回答数に達すると閉じます。',
				},
			},
			link: {
				href: '/fonctionnalites/formulaires-partages/',
				label: 'フォーム',
			},
		},
		automate: {
			eyebrow: 'オートメーション',
			title: '働きます。',
			titleAccent: 'あなたが眠っている間も。',
			text: '行が届いたとき、変わったとき、決まった時刻、あるいはボタンをクリックしたとき——basedbはステップを次々に実行します。正しい分岐を選び、AIに質問し、必要な人に知らせます。実行はどれも、ステップごとに見返せます。',
			clock: '03:12',
			crumb: '営業 / オートメーション',
			create: '新しいオートメーション',
			list: [
				{
					name: '新規依頼',
					when: '行が作成されたとき',
				},
				{
					name: '見積もり署名済み',
					when: '行が更新されたとき',
				},
				{
					name: '月曜のリマインド',
					when: '毎週月曜日 09:00',
				},
			],
			active: '有効',
			test: '行でテスト',
			save: '保存',
			when: '実行タイミング',
			trigger: '行が作成されたとき',
			table: '依頼 で',
			steps: {
				branch: {
					kind: '条件',
					text: '2つの分岐',
					run: '分岐「大型案件」',
				},
				notify: {
					kind: 'メンバーに通知',
					text: 'Léa Martin',
					run: '1 人に通知',
				},
				create: {
					kind: '行を作成',
					text: '商談を、カレンダーへ',
					run: '完了',
				},
				slack: {
					kind: 'Slackに送信',
					text: '「#営業」チャンネルへ',
					run: '完了',
				},
				ai: {
					kind: 'AIに質問',
					text: '最初の応答を作成',
					run: '{n} 文字の応答',
				},
				update: {
					kind: '行を更新',
					text: '応答、ステータス',
					run: '完了',
				},
			},
			paths: {
				big: '大型案件',
				condition: 'budget gt 5000',
				otherwise: 'それ以外',
			},
			answer: 'こんにちは、この度はお問い合わせいただきありがとうございます！新しいブランディングを担当するLéaより、明日の午前中にお電話いたします。',
			addStep: 'ステップを追加',
			tabs: {
				settings: '設定',
				runs: '実行',
			},
			runsText: '直近 50 件（30 日間保持）。選択すると、その実行がたどった分岐をフロー上に表示します。',
			running: '実行中',
			succeeded: '成功',
			started: '行を作成しました · {when}',
			now: 'たった今',
			earlier: ['昨日 18:40', '昨日 11:02'],
			done: '成功 · 5ステップ · 1.3秒',
			points: {
				when: {
					title: '適切なタイミングで',
					text: '行の作成や変更、決まった時刻、ボタン——そして必要なときだけ動く条件。',
				},
				paths: {
					title: '複数の分岐',
					text: '条件が複数の分岐を開き、それぞれに独自のステップがあります。あるステップが見つけたことを、次のステップが参照できます。',
				},
				copilot: {
					title: '一文で説明するだけ',
					text: '「新しい依頼が届いたら、予算が5,000ユーロを超える場合はLéaに知らせて」。Copilotがフローを組み立て、あなたが確認します。',
				},
			},
			link: {
				href: '/fonctionnalites/automatisations/',
				label: 'オートメーション',
			},
		},
		glance: {
			eyebrow: 'ダッシュボード',
			title: 'すべてが見えます。',
			titleAccent: '一目で。',
			text: '数字、グラフ、目標。ダッシュボードはマウス操作だけでテーブルから作れて、自動的に最新の状態を保ちます。フィルターをかければ、ダッシュボード全体が連動します。',
			demo: {
				title: '営業ダッシュボード',
				filters: ['今年', 'すべての都市'],
				revenue: '売上',
				signed: '成約した見積書',
				rate: '成約率',
				goal: '年間目標',
				byMonth: '月別の売上',
				byStage: 'ステージ別の見積書',
				stages: ['送付済み', '交渉中', '成約'],
				bySector: '業種別の顧客',
				sectors: ['商業', '医療', '教育', '製造業'],
				shared: 'リンクで共有',
			},
			points: {
				viz: {
					title: '15種類の可視化',
					text: '数値、トレンド、目標、折れ線グラフ、円グラフ、ファネル、クロス集計表、地図。',
				},
				filters: {
					title: '共通のフィルター',
					text: '期間、顧客、都市。1つのフィルターで、1枚のカードも、複数のカードも、ダッシュボード全体も操作できます。',
				},
				share: {
					title: 'リンクで共有',
					text: '公開でも、チーム限定でも。他のサイトへの埋め込みもできます。',
				},
			},
			link: {
				href: '/fonctionnalites/tableaux-de-bord/',
				label: 'ダッシュボード',
			},
		},
		ai: {
			eyebrow: 'AI',
			title: '説明するだけ。',
			titleAccent: 'basedbが作ります。',
			text: '1文で、完成したデータベースができます。作成する前に、内容を確認できます。その後もCopilotがフィルター、グラフ、オートメーションを提案し、AIフィールドが要約・分類・文章作成を代わりに行います。',
			prompt: '募集中の3つのポジションへの応募と、面接を管理したい。',
			thinking: 'つながった3つのテーブルができました。確認してください。',
			tables: {
				jobs: {
					name: 'ポジション',
					fields: ['職種', '部門', '募集開始日'],
				},
				people: {
					name: '候補者',
					fields: ['氏名', 'ポジション', '選考段階', '要約'],
				},
				talks: {
					name: '面接',
					fields: ['候補者', '日付', '面接官', '評価'],
				},
			},
			aiField: '要約',
			aiValue: 'プロジェクト管理の経験6年、顧客対応も得意。確認したい点：英語力。',
			create: 'データベースを作成',
			providers: '好きなプロバイダーで — OpenAI、Anthropic、Mistral、または自分の環境で動かすモデル。同意なしに何も送信されません。',
			link: {
				href: '/fonctionnalites/ia/',
				label: 'basedbのAI',
			},
		},
		features: {
			title: '必要なものすべて。',
			titleAccent: 'そしてまだまだ。',
			text: 'すべての機能が、同じテーブルに、同じ権限のもとで書き込み、同じ履歴に残ります。',
			tiles: {
				views: {
					stat: '10',
					title: '通りの方法でデータを見られます',
					text: 'グリッド、カンバン、カレンダー、タイムライン、ギャラリー、リスト、地図、フォーム、アンケート、クイズ。同じ行を、それぞれが自分の見たい形で。',
					href: '/fonctionnalites/vues/',
				},
				history: {
					stat: 'Ctrl+Z',
					title: '何も失われません',
					text: 'すべての変更は、変更前の値とともに記録されます。ミスは取り消せて、削除した行も復元できます。',
					href: '/fonctionnalites/historique/',
				},
				forms: {
					title: 'フォーム',
					text: '公開リンクでも、チーム限定リンクでも。回答はそのままテーブルに届き、他の部分は開かれません。',
					href: '/fonctionnalites/formulaires-partages/',
				},
				viz: {
					stat: '15',
					title: '種類の可視化',
					text: '数値、トレンド、目標、折れ線グラフ、円グラフ、ファネル、クロス集計表、地図。',
					href: '/fonctionnalites/tableaux-de-bord/',
				},
				formulas: {
					code: 'IF([Montant] > 10000, "Grand compte", "")',
					title: 'フランス語でも英語でも書ける数式',
					text: '表計算ソフトと同じように — SI、ARRONDI、JOURS…、またはIF、ROUND、DAYS — でも、チーム全員のために計算されます。',
					href: '/fonctionnalites/tables-et-champs/#数式',
				},
				rights: {
					title: '見るべきものだけが見えます',
					text: '閲覧・編集・管理を、チームごとに。機密性の高い列は非表示にできます。',
					href: '/fonctionnalites/droits/',
				},
				mentions: {
					bubble: '@Camille',
					title: 'コメントとメンション',
					text: '行についての議論は、その行の上で。ベルが知らせてくれます。',
					href: '/fonctionnalites/collaboration/',
				},
				relations: {
					title: 'すべてがつながっています',
					text: '顧客、プロジェクト、請求書。集計もルックアップも、リレーションを越えて機能します。',
					href: '/fonctionnalites/tables-et-champs/',
				},
				templates: {
					stat: '10',
					title: '個のテンプレート',
					text: 'CRM、採用、在庫、イベント… または1文で説明してAIに作らせるデータベース。',
					href: '/modeles/',
				},
				import: {
					title: 'ワンステップでインポート',
					text: 'Excelブックか CSV ファイルをドロップするだけ。列と型を推定し、テーブルを作成します。',
					href: '/guides/premiers-pas/',
				},
				agenda: {
					title: 'カレンダーアプリでも',
					text: 'カレンダービューは、Googleカレンダー、Outlook、Appleカレンダー向けのフィードになります。',
					href: '/fonctionnalites/vues-partagees/',
				},
				files: {
					title: 'ファイルと画像',
					text: '見積書、写真、契約書。画像はカードの表紙にもなります。',
					href: '/fonctionnalites/fichiers/',
				},
				share: {
					title: '共有ビュー',
					text: 'リンクで読み取り専用のビューを公開し、自分のサイトに埋め込めます。',
					href: '/fonctionnalites/vues-partagees/',
				},
				sync: {
					title: '同期テーブル',
					text: 'オンラインのCSV、カレンダー、または別のbasedbから、常に最新の状態に保たれます。',
					href: '/integrations/synchronisation/',
				},
				signin: {
					title: '簡単なログイン',
					text: 'Google、Microsoft、またはパスワードで。同僚はリンクで招待できます。',
					href: '/hebergement/connexion/',
				},
				languages: {
					title: '自分の言語で',
					text: 'インターフェースは、20言語の中から、それぞれが使う言語で表示されます。',
					href: '/fonctionnalites/droits/#個人設定',
				},
			},
		},
		yours: {
			eyebrow: 'フリーソフトウェア・セルフホスト',
			per: '一人あたり。永久に。',
			text: 'basedbはフリーソフトウェアです。自分のサーバーにインストールして、チーム全員を招待できます。サブスクリプションもライセンス数の管理も不要。データは自分たちの手元に残ります。',
			points: {
				home: {
					title: '自分の手元に',
					text: '自分のサーバーでも、ホスティング会社のサーバーでも。ほかのPostgreSQLデータベースと同じようにバックアップできます。',
				},
				free: {
					title: 'フリーソフトウェア',
					text: 'AGPL-3.0ライセンス。コードは公開されていて、これからもそうです。',
				},
				ai: {
					title: '好きなAIを選べます',
					text: '市販のプロバイダーでも、自分の環境で動かすモデルでも — AIを使わないという選択もできます。',
				},
			},
			link: {
				href: '/guides/installation/',
				label: 'basedbをインストール',
			},
		},
		gallery: {
			eyebrow: 'テンプレート',
			title: '1分で使い始められます。',
			text: 'テンプレートから始めましょう。テーブル、ビュー、ダッシュボード、サンプル行がすべて揃っています。あとは自分たちのやり方に合わせて調整するだけです。',
			use: '見る',
			ask: {
				title: 'ぴったりのものがない場合は？',
				text: 'ご要望を1文で伝えてください。AIがぴったりのデータベースを提案します。',
			},
			all: 'すべてのテンプレートを見る',
			previous: '前のテンプレート',
			next: '次のテンプレート',
		},
		developers: {
			title: '技術的な話は？',
			text: 'すべてのテーブルは、本物のPostgreSQLテーブルです。REST API、Webhook、AIエージェント向けのMCPサーバー、そして1つのコマンドでインストールできます。',
			link: '開発者ページ',
		},
		faq: {
			title: 'よくある質問',
			items: [
				{
					q: 'コーディングの知識は必要ですか？',
					a: '不要です。テーブル、ビュー、フォーム、ダッシュボード、オートメーションは、すべてマウス操作で作成できます。数式は表計算ソフトと同じように、フランス語でも英語でも書けます：SIまたはIF、ARRONDIまたはROUND、JOURSまたはDAYS…',
				},
				{
					q: '費用はどれくらいかかりますか？',
					a: '無料です。basedbはフリーソフトウェアで、サブスクリプションも人数に応じた料金もありません。必要なのは、インストールするサーバーだけです。',
				},
				{
					q: 'どうやってインストールしますか？',
					a: 'サーバーに、Dockerで。2つのファイルと1つのコマンドで、情報システムを担当する方なら数分で完了します。インストールガイドが、すべて順を追って説明します。',
				},
				{
					q: '今使っている表計算ファイルは引き継げますか？',
					a: 'はい：Excelのブック、またはCSVファイルを、そのままbasedbにドロップしてください。インポートが各列の型を推定してテーブルを作成し、取り込めなかった内容を1行ごとに知らせてくれます。',
				},
				{
					q: '複数人で同時に作業できますか？',
					a: 'そのために作られています。他の人の変更はリアルタイムで表示され、行にコメントし、@で同僚をメンションすると、ベルが知らせてくれます。',
				},
				{
					q: 'AIは私たちのデータを読むのですか？',
					a: '決めるのはあなたです。AIプロバイダーを設定しない限り、何も送信されません。設定した後も、AIを使うフィールドやオートメーションは、指示が引用する内容だけを、同意のうえで送信します。',
				},
				{
					q: 'どの言語で使えますか？',
					a: 'あなたの言語で使えます。インターフェースは、20言語の中からブラウザーの言語を自動で選び、設定でいつでも変更できます。',
				},
			],
		},
		cta: {
			title: 'あなたのチームに、',
			titleAccent: '共有ファイルよりいいものを。',
			text: 'テンプレートから始めて、同僚を招待し、「FINAL (2)」とはもうお別れです。',
			primary: 'テンプレートを見る',
			secondary: 'basedbをインストール',
		},
	},
	hero: {
		badge: '新機能：フローで組むオートメーション、ダッシュボード、SQLビュー',
		title: ['共同データベース、', 'そのテーブルはすべて', '本物の'],
		titleAccent: 'PostgreSQLテーブル。',
		lead: '共有スプレッドシートの手軽さ（グリッド、ビュー、フォーム、権限）を備えながら、データは<strong>型付きで、わかりやすい名前</strong>のテーブルに保存されます。チームはインターフェースで作業し、スクリプト、BIツール、AIエージェント、そして<code>psql</code>が同じ行を読みます。',
		install: 'Dockerでインストール',
		features: '機能を見る',
		copy: 'コマンドをコピー',
		facts: ['セルフホスト', 'AGPL-3.0', 'REST API & MCPサーバー'],
		demo: {
			url: 'basedb.example.co.jp',
			project: 'メインプロジェクト',
			projectMeta: 'プロジェクト · データベース2件',
			filter: 'データベースとテーブルを絞り込む',
			sales: '営業',
			support: 'サポート',
			environment: '本番',
			clients: '顧客',
			opportunities: '商談',
			quotes: '見積もり',
			baseSection: 'データベース · 営業',
			screens: ['ダッシュボード', 'オートメーション'],
			copilot: '✦ Copilot',
			allRows: '▦ すべての行 ▾',
			tools: ['フィルター', 'グループ化', '色分け'],
			search: '検索…',
			add: '+ 追加',
			columns: {
				name: '名前',
				status: 'ステータス',
				amount: '金額',
				client: '顧客',
			},
			statuses: {
				nouveau: '新規',
				qualifie: '有望',
				proposition: '提案中',
				negociation: '交渉中',
				gagne: '受注',
				perdu: '失注',
			},
			deals: {
				portail: {
					name: 'ポータル刷新',
					client: '北浜市役所',
				},
				erp: {
					name: 'ERP移行',
					client: '三森グループ',
				},
				audit: {
					name: 'セキュリティ監査',
					client: 'さくら台クリニック',
				},
				billetterie: {
					name: 'オンラインチケット販売',
					client: 'みなと座',
				},
				flotte: {
					name: '車両管理',
					client: '北斗運輸',
				},
				mobile: {
					name: 'モバイルアプリ',
					client: '森田工房',
				},
				intranet: {
					name: 'イントラネット刷新',
					client: '',
				},
			},
			toastTitle: 'フォーム「見積もり依頼」',
			toastText: '公開回答 · 「{name}」を作成',
			cursor: '美咲',
			psqlRows: '(2 行)',
		},
	},
	showcase: {
		label: '実際のインターフェース',
		title: 'チームが共有スプレッドシートに求めるものを、すべて。',
		tabs: 'インターフェースのスクリーンショット',
		alt: 'basedb — {labelLower}：{caption}',
		shots: {
			grille: {
				label: 'グリッド',
				caption: '本物のテーブルに書き込むグリッド。そして計算フィールド：数式による期間、ルックアップによる顧客の所在地、カウントによるタスク数。',
			},
			kanban: {
				label: 'カンバン',
				caption: '単一選択の値ごとの列に並べた同じ行：カバー画像と、行を引用する説明。カードをドラッグすると、その行が更新されます。',
			},
			galerie: {
				label: 'ギャラリー',
				caption: '画像付きのカードを、ステータスごとに色分け：ギャラリーは、テーブルを読む8つの方法のひとつです。',
			},
			chronologie: {
				label: 'タイムライン',
				caption: '2つの日付の間に伸びるバーと、依存関係を示す矢印。順序が崩れると赤く表示されます。',
			},
			tableaux: {
				label: 'ダッシュボード',
				caption: 'グリッドやタブに並べたカードを、共通のフィルターで操作します：トレンド、目標、積み上げ系列。どれも各自の権限で読まれます。',
			},
			automatisations: {
				label: 'オートメーション',
				caption: 'タスクが完了したら、プロジェクトに残るタスクを探します。何も残っていなければ、AIが総括コメントを書き、プロジェクトは「納品済み」になります。各実行は、フロー上でステップごとに確認できます。',
			},
			commentaires: {
				label: 'コメント',
				caption: '行についての議論は、その行の上で：コメント、メンション、通知。',
			},
			formulaire: {
				label: 'フォーム',
				caption: 'フォームはリンクで共有します。公開にも、ログイン済みメンバー限定にもできます。',
			},
			historique: {
				label: '履歴',
				caption: '人、オートメーション、直接SQL。どこから来た書き込みも、すべて変更前の値とともに記録します。',
			},
			sql: {
				label: 'SQL',
				caption: '本物の名前で書いたクエリを、テーブルの下に保存してチーム全員で共有。実行は各自の権限で行われます。',
			},
			vuesSql: {
				label: 'SQLビュー',
				caption: '本物のPostgreSQLビューが、色とアイコン付きでテーブルと並んで表示されます。psqlからも読めます。',
			},
		},
	},
	features: {
		postgres: {
			label: 'PostgreSQLを、変換なしで',
			title: 'チームにはグリッドを、{ツールには本物のテーブルを。}',
			lead: '汎用モデルも、何でも詰め込むJSONも、<code>field_1837</code>もありません。データベースはスキーマ、テーブルはテーブル、フィールドはわかりやすい名前の型付きの列です。',
			bullets: [
				'<strong>ネイティブな型</strong>：<code>text</code>、<code>numeric</code>、<code>date</code>、<code>timestamptz</code>、<code>boolean</code>。リレーションには本物の外部キーを使います。',
				'<strong>データベースが守る制約</strong>：単一選択は<code>CHECK</code>で、URLとメールアドレスは検証付きで、リレーションは<code>FOREIGN KEY</code>で。',
				'<strong>PostgreSQLが計算する数式</strong>：<code>JOURS([Fin]; [Début])</code>は生成列になり、<code>psql</code>からも他の列と同じように読めます。',
				'<strong>直接SQLも使えます</strong>。その書き込みさえ、トリガーによって履歴に記録されます。',
				'<strong>クエリとSQLビュー</strong>をインターフェースで：テーブルの下に保存するクエリ（自分用またはチーム用）と、テーブルと並ぶ本物のPostgreSQLビュー。ビューは<code>psql</code>からも読めます。',
				'<strong>名前を変えても壊れません</strong>：クエリを移行するまでの間、旧名は互換エイリアスで引き続き使えます。',
			],
			links: [
				{
					href: '/integrations/sql/',
					label: 'SQLで作業する',
				},
				{
					href: '/fonctionnalites/requetes-et-vues-sql/',
					label: 'クエリとSQLビュー',
				},
				{
					href: '/architecture/principes/',
					label: '設計原則',
				},
			],
		},
		automations: {
			label: '自動化',
			title: 'フローで組むオートメーション、{各ステップにAIを。}',
			lead: '行が変わったとき、決まった時刻に、またはクリックひとつで。グラフエディターがステップをつなぎ、各実行はフロー上で確認できます。',
			bullets: [
				'<strong>読みやすいフロー</strong>：トリガー、そして各ステップをカードで。線上の<strong>+</strong>で、その位置にステップを追加できます。',
				'<strong>探す、判断する、書き込む</strong>：行を検索し、条件に応じて分岐し、更新・作成・通知、Webhookの呼び出し、Slackへの投稿を行います。',
				'ステップで<strong>AIに質問</strong>：行を引用する指示を送り、回答をテキスト、数値、日付、選択肢として受け取って、後続のステップで再利用します。',
				'<strong>Copilot</strong>は、ひとつの文からオートメーション全体を提案し、実行が失敗した理由も説明します。自分で保存するまで、何も保存されません。',
				'<strong>書いた人の権限で</strong>実行され、他の書き込みと同じように履歴に残ります。',
			],
			links: [
				{
					href: '/fonctionnalites/automatisations/',
					label: 'オートメーション',
				},
				{
					href: '/fonctionnalites/automatisations/#copilot',
					label: 'Copilot',
				},
			],
			alt: 'basedb — フローエディターで開いたオートメーション「プロジェクト納品」：タスクが完了したら時刻を記録し、プロジェクトに残るタスクを検索し、「それ以外」の分岐へ進み、AIに総括コメントを依頼して、プロジェクトを納品します。右側には、直近の実行がステップごとに表示されています。',
		},
		dashboards: {
			label: '分析',
			title: 'ダッシュボードを、{テーブルから離れずに。}',
			lead: 'マウス操作やSQLで作る質問、15種類の可視化、共通のフィルター。誰もが自分の権限で閲覧します。',
			bullets: [
				'<strong>質問</strong>：テーブルとその結合、フィルター、日・週・月・年ごとの集計値。または読み取り専用のSQL。',
				'<strong>15種類の可視化</strong>：数値、トレンド、目標、ゲージ、棒グラフ、折れ線グラフ、円グラフ、ファネル、クロス集計表、地図…',
				'<strong>クリックで探索</strong>：点をクリックすると、その行や、より細かい期間が開きます。',
				'<strong>共通のフィルター</strong>で、1枚、複数、またはすべてのカードを操作できます。',
				'<strong>リンクで共有</strong>：公開またはメンバー限定で。他のサイトへの埋め込みもできます。',
			],
			links: [
				{
					href: '/fonctionnalites/tableaux-de-bord/',
					label: 'ダッシュボード',
				},
			],
			alt: 'basedb — ダッシュボード：今月のトレンド、入金目標、月別の売上、レビューの感情を、期間と顧客のフィルターとともに表示。',
		},
		rights: {
			label: 'すべてを開かずに共同作業',
			title: 'フィールド単位までの権限、{抜けのない履歴。}',
			lead: '権限はグループに対して、プロジェクト、データベース、テーブルの単位で付与し、その配下すべてに継承されます。機密性の高い列は、グループごとに非表示にしたり、編集不可にしたりできます。',
			bullets: [
				'<strong>4つのレベル</strong>：アクセス権なし、閲覧、編集、管理。複数のグループの権限は加算されます。',
				'<strong>SQLも権限に従います</strong>：インターフェースでは、クエリから見えるのは自分に開かれたテーブルとフィールドだけ。それを適用するのはPostgreSQL自身です。',
				'<strong>すべての書き込みを、そのトランザクション内で記録</strong>：インターフェース、API、エージェント、公開フォーム、直接SQL。',
				'<strong>変更は元に戻せます</strong>。削除した行も、削除したデータベースも復元できます。',
				'<strong>システム管理には確認が必要です</strong>：権限を変更するには、直近5分以内にパスワードを再入力している必要があります。',
			],
			links: [
				{
					href: '/fonctionnalites/droits/',
					label: '権限とグループ',
				},
				{
					href: '/fonctionnalites/historique/',
					label: '履歴',
				},
			],
		},
		agents: {
			label: 'REST API · MCP · Webhook',
			title: 'AIエージェントに渡すのはデータだけ。{マスターキーは渡しません。}',
			lead: 'MCPサーバーはエージェントに14のツールを、REST APIはプログラムに同じデータを提供します。権限の判定ポイントはひとつ、ログも共通です。',
			bullets: [
				'<strong>データベースごとのトークン</strong>：デフォルトは読み取り専用で、作成した人の権限を超えることはありません。',
				'<strong>エージェントが削除するのは、あなたの同意があるときだけです</strong>。一度に1行で、スキーマも変更しません。変更は提案し、人が承認します。',
				'<strong>自動生成されるドキュメント</strong>：データベースごとに、自分の権限でフィルターされ、OpenAPI 3.1仕様が付属します。',
				'<strong>Webhook</strong>：書き込みのたびに、署名付きで、順序どおりに、再試行付きで送信されます。',
			],
			links: [
				{
					href: '/integrations/mcp/',
					label: 'エージェントを接続する',
				},
				{
					href: '/integrations/api-rest/',
					label: 'REST API',
				},
			],
		},
	},
	sqlVisual: {
		interface: 'インターフェース',
		title: '新しいフィールド · 商談',
		labelField: 'ラベル',
		labelValue: '金額',
		typeField: '型',
		typeValue: '数値',
		descriptionField: '説明',
		descriptionValue: '契約の税抜金額',
		required: '必須',
		ai: 'AI',
		migration: '計画的なマイグレーション、短いロック',
	},
	rightsVisual: {
		groups: ['管理者', '営業チーム', 'サポート'],
		project: 'メインプロジェクト',
		sales: '営業',
		opportunities: '商談',
		clients: '顧客',
		support: 'サポート',
		inherited: '継承',
		levels: {
			none: 'アクセス権なし',
			read: '閲覧',
			edit: '編集',
			manage: '管理',
		},
		field: 'フィールド「利益率」',
		hidden: '非表示',
		sqlChange: '<b>直接SQLセッション</b>が<b>「ERP移行」</b>を更新',
		sqlMeta: '02:46 · ローカル接続 · psql',
		sqlDiff: '金額：<s>125,000</s> → 130,000',
		undo: '↶ 元に戻す',
		formChange: '<b>フォーム「見積もり依頼」</b>が<b>「イントラネット刷新」</b>を作成',
		formMeta: '公開回答 · 美咲が公開',
	},
	agentVisual: {
		agent: 'エージェント',
		via: 'MCPで接続 · トークン「営業」',
		question: '交渉中の商談は何件で、金額はいくら？',
		listArgs: 'opportunites · statut = 交渉中',
		answer: '商談は2件、合計<b>182,000ユーロ</b>です：ERP移行（130,000ユーロ）と車両管理（52,000ユーロ）。',
		request: '「確度」フィールドをパーセントで追加して。',
		proposeArgs: 'opportunites · 確度 · number',
		proposed: '提案しました。basedbで、チームの誰かが承認する必要があります。',
		badge: '提案',
		expires: 'あと23時間で期限切れ',
		what: '<b>商談</b>に<b>「確度」</b>フィールド（数値）を追加',
		by: 'エージェントによる提案 · トークン「営業」',
		refuse: '却下',
		approve: '承認',
	},
	bento: {
		label: 'ほかにも',
		title: 'チームのツールに求めるものを、PostgreSQLを手放さずに。',
		text: 'すべての機能が、同じテーブルに、同じ権限のもとで書き込み、同じ履歴に残ります。',
		more: '詳しく見る →',
		views: {
			title: '同じ行を10のビューで',
			text: 'チーム全員のためのコラボレーションビューも、自分だけの個人ビューも。見方は各自で選べて、データをコピーする必要はありません。',
			chips: ['グリッド', 'カンバン', 'カレンダー', 'タイムライン', 'ギャラリー', 'リスト', '地図', 'フォーム', 'アンケート', 'クイズ'],
		},
		forms: {
			title: '共有フォーム',
			text: '公開リンク、またはログイン済みメンバー限定のリンクで。回答しても、テーブルへの権限は一切与えられません。',
			href: '/fonctionnalites/formulaires-partages/',
		},
		environments: {
			title: '環境',
			text: 'ひとつのデータベースに、複数のバリエーション。スキーマを比較し、環境間で移行し、行を同期できます。',
			chips: ['本番', 'ステージング', '開発'],
			href: '/fonctionnalites/environnements/',
		},
		collaboration: {
			title: 'チームで作業',
			text: '他の人の書き込みはリアルタイムで届き、誰がどの行を見ているかがわかり、その行の上で議論できます：コメント、メンション、通知。Ctrl+Zは最後の書き込みを取り消し、他の人の作業を上書きしそうなときは取り消しを拒否します。',
			chips: ['リアルタイム', 'プレゼンス', 'コメント', 'メンション', 'Ctrl+Z'],
			href: '/fonctionnalites/collaboration/',
		},
		small: {
			ai: {
				title: 'グリッドの中のAI',
				text: '他の列をもとにモデルが埋めるフィールドと、フィルター、クエリ、列を提案してクリックひとつで適用するCopilot。OpenAI、Anthropic、Mistral、または自分のマシンで動かすモデル。',
				code: '{{Notes}}を1文で要約して',
				href: '/fonctionnalites/ia/',
			},
			formulas: {
				title: 'リレーションと数式',
				text: '本物の外部キー、PostgreSQLが計算するフランス語または英語の数式、そしてリレーションをまたぐルックアップ、ロールアップ、カウント。',
				code: 'ROUND([Montant HT] * (1 + [Taux de TVA]), 2)',
				href: '/fonctionnalites/tables-et-champs/#数式',
			},
			richText: {
				title: 'リッチテキストと変数',
				text: '書式付きテキスト用のビジュアルエディター（書き込み時にサニタイズ）。さらに、どの長文テキストでも、{{Ville}}はその行の値として表示されます。',
				code: '{{Date}}に{{Ville}}へお届け',
				href: '/fonctionnalites/tables-et-champs/#リッチテキストと変数',
			},
			languages: {
				title: '自分の言語で',
				text: 'インターフェースは20の言語の中からブラウザーの言語で表示され、各自が設定で変更できます。',
				href: '/fonctionnalites/droits/#個人設定',
			},
			sharedViews: {
				title: '共有ビュー',
				text: 'ビューをリンクで読み取り専用に公開し、他のサイトに埋め込めます。カレンダーは、カレンダーアプリで購読できるフィードになります。',
				href: '/fonctionnalites/vues-partagees/',
			},
			syncedTables: {
				title: '同期テーブル',
				text: 'オンラインのCSV、カレンダー、または別のbasedbの共有ビューから、テーブルを最新の状態に保ちます。',
				href: '/integrations/synchronisation/',
			},
			templates: {
				title: 'データベーステンプレート',
				text: 'すぐに使える10のテンプレート、1文で説明してAIに作らせるデータベース、そして自分のデータベースをテンプレートとして保存。',
				href: '/modeles/',
			},
			files: {
				title: 'ファイルと画像',
				text: 'ホストのディスク、またはS3互換ストレージに保存：AWS、Scaleway、OVH、Cloudflare R2、Garage、MinIO…',
				href: '/fonctionnalites/fichiers/',
			},
			import: {
				title: 'Excel、CSV、JSONのインポート',
				text: 'ファイルをドロップするだけ。型を推定し、テーブルを作成するか既存のテーブルに追加して、拒否された内容を行ごとに示します。',
				href: '/guides/premiers-pas/',
			},
			accounts: {
				title: 'アカウントと招待',
				text: '誰でも自分のアカウントとプロジェクトを作成し、閲覧・編集・管理の権限でリンクから招待できます。ログインはパスワード、Google、Microsoft、または任意のOpenID Connectプロバイダーで。',
				href: '/hebergement/connexion/',
			},
			webhooks: {
				title: 'Webhook',
				text: 'すべての書き込みを、他のシステムに知らせられます：署名付きのペイロードを、順序どおりに、再試行付きで配信。',
				href: '/integrations/webhooks/',
			},
			settings: {
				title: '個人設定',
				text: '言語、テーマ、日付の順序、通知、セッション、トークンを、ひとつの場所で。',
				href: '/fonctionnalites/droits/#個人設定',
			},
		},
	},
	selfHost: {
		label: 'セルフホスト',
		title: 'データは、{自分たちの手元に。}',
		lead: 'basedbはフリーソフトウェア（AGPL-3.0）です。イメージひとつとPostgreSQLデータベースひとつ、それだけ。外部サービスの強制も、テレメトリーもありません。<code>pg_dump</code>でバックアップし、どんなPostgreSQLクライアントからでも読めます。',
		services: {
			db: 'PostgreSQL 16、データ本体',
			basedb: 'インターフェース、REST API、MCPサーバーを1つのポートで',
			proxy: 'Caddy、自動HTTPS（オプション）',
		},
		links: [
			{
				href: '/hebergement/docker/',
				label: 'Docker Composeガイド →',
			},
			{
				href: '/hebergement/variables/',
				label: 'すべての環境変数 →',
			},
		],
		steps: [
			{
				title: 'basedbを取得',
				code: 'git clone https://github.com/eodia/basedb.git\ncd basedb && cp .env.example .env',
			},
			{
				title: '.envに2つのシークレット',
				code: 'POSTGRES_PASSWORD=a-strong-password\n# openssl rand -base64 32\nBASEDB_ENCRYPTION_KEY=…',
			},
			{
				title: '起動',
				code: 'docker compose up -d\n# 次に http://localhost:3000 を開き、アカウントを作成',
			},
		],
	},
	faq: {
		label: 'よくある質問',
		title: 'よくいただくご質問。',
		text: 'ほかにご質問は？ <a href="/guides/introduction/">ドキュメント</a>にきっと答えがあります。',
		items: {
			difference: {
				q: 'basedbは、ほかの共同データベースと何が違うのですか？',
				a: 'データの置き場所です。ほかの製品が行を汎用モデル（番号付きの列、JSONドキュメント）に格納するのに対し、basedbはテーブルごとに本物のPostgreSQLテーブルを、フィールドごとに型付きの本物の列を、読みやすい名前で作成します。データはbasedbがなくても活用できます。',
			},
			sql: {
				q: 'テーブルに直接SQLで書き込めますか？',
				a: 'はい。制約（型、必須、選択肢、外部キー）はPostgreSQL自身が守り、直接SQLによる書き込みも、実行したセッションとともにトリガーが履歴に記録します。インターフェースのSQLコンソールとpsqlは同じテーブルを読みます。インターフェースでは、誰もが自分の権限でSQLを書いてクエリを保存でき、データベースを管理する人はそれを本物のPostgreSQLビューにできます。',
			},
			ai: {
				q: 'AIプロバイダーには何が送られますか？',
				a: 'プロバイダーを設定するまでは、何も送られません。設定後も、スキーマの下書きとCopilotについては、デフォルトで送られるのはスキーマと入力した文だけです。Copilotによるデータの読み取りは、会話ごとにチェックボックスで許可します。AIに依頼するデータベーステンプレートは、入力した文だけを送ります。AIフィールドは、明示的な同意を得たうえで、指示が引用する列を送ります。',
			},
			together: {
				q: '同じテーブルで複数人が同時に作業できますか？',
				a: 'はい。他の人の書き込みは再読み込みなしで表示され、その人が見ているテーブルや行にはアバターが表示されます。行にコメントし、@で誰かをメンションすれば、ベルで通知が届きます。また、Ctrl+Zが取り消すのは自分の書き込みだけです。その後に他の人が変更した内容を上書きしそうなときは、取り消しを拒否します。',
			},
			languages: {
				q: '対応している言語は？',
				a: '20言語です：フランス語、英語、ドイツ語、スペイン語、イタリア語、ポルトガル語（ブラジル）、オランダ語、ポーランド語、チェコ語、スウェーデン語、デンマーク語、ノルウェー語、フィンランド語、ルーマニア語、ハンガリー語、トルコ語、ウクライナ語、日本語、簡体字中国語、韓国語。インターフェースはブラウザーの言語で表示され、各自が設定で変更できます。このサイトとドキュメントも同じ言語で提供しています。',
			},
			agent: {
				q: 'AIエージェントはどうやって接続するのですか？',
				a: 'MCPサーバーを通じて、1つのデータベースに限定された連携トークンで接続します。デフォルトは読み取り専用です。エージェントは権限の範囲で行を読み、作成し、更新します——トークンがそのために作成されていれば、一度に1行、削除もします。スキーマは変更しません：変更は提案し、人が承認します。',
			},
			postgres: {
				q: '必要なPostgreSQLのバージョンは？',
				a: 'PostgreSQL 16以降で、拡張機能pg_trgmとunaccentが必要です（公式イメージに含まれています）。付属のdocker-composeはPostgreSQL 16を起動しますが、DATABASE_URLで既存のサーバーを指定することもできます。',
			},
			production: {
				q: '本番環境で使えますか？',
				a: 'basedbは活発に開発中です。コア、API、MCPサーバー、インターフェースは動作しており、1,000件を超えるテストで検証されていますが、まだ実装されていない機能もあります（ロードマップをご覧ください）。ぜひ試してみてください。そして、ほかのPostgreSQLデータベースと同じようにバックアップを取ってください。',
			},
			license: {
				q: 'ライセンスは？',
				a: 'AGPL-3.0-or-laterです。自由に利用、改変、ホストできます。改変したバージョンをサービスとして提供する場合は、そのソースコードを公開します。',
			},
		},
	},
	cta: {
		title: 'データには、{本物のテーブルを。}',
		text: '数分でbasedbをインストールし、チームを招待して、すべての行を自分たちの手で管理しましょう。',
		install: 'basedbをインストール',
		github: 'GitHubでコードを見る',
	},
	changelog: {
		label: '更新情報',
		title: 'basedbの変更点',
		intro: '変更の詳細は<a href="https://github.com/eodia/basedb/commits/main">リポジトリの履歴</a>にあります。今後の予定は<a href="/feuille-de-route/">ロードマップ</a>をご覧ください。',
		entries: {
			agentDelete: {
				date: '2026-10-02',
				title: '許可すれば削除もするエージェント',
				tag: '新機能',
				items: [
					'<strong>トークンに3段目の権限が追加</strong>、「読み取り、書き込みと削除」：プログラムはREST APIで、エージェントは新しいツール<code>delete_record</code>で削除します——一度に1行、レスポンスにその行が返されます。<a href="/integrations/mcp/#行を削除する">行を削除する</a>',
					'<strong>元に戻す</strong>：<code>restore_record</code>は、削除された行をその識別子のまま元に戻します。連鎖的なリレーションによって他の行にも広がる削除は、引き続きインターフェースだけができます。',
				],
			},
			tokens: {
				date: '2026-10-02',
				title: 'データベースを管理する人のためのトークン',
				tag: '新機能',
				items: [
					'<strong>管理レベルで十分です</strong>：データベース、またはそのプロジェクトに与えられていれば、管理者でなくてもそのデータベースの連携トークンを作成できます。<a href="/integrations/api-rest/#トークン">トークン</a>',
					'<strong>そうでない場合は明確に伝えます</strong>：データベースを管理せずに読み取りや書き込みだけを行う人には、トークンのウィンドウが誰に相談すべきかを伝え、パスワードを持たないアカウントには、まだ作成できない理由を伝えます。',
				],
			},
			advancedFlows: {
				date: '2026-10-02',
				title: '待機し、失敗を立て直し、PDFを送るオートメーション',
				tag: '新機能',
				items: [
					'<strong>トリガーが4つ追加</strong>：行が削除されたとき、行がフィルターに入ったとき——「請求書が遅延になった」——、日付になったとき——支払期限の3日前、9時に——、別のソフトウェアがオートメーションの秘密のアドレスを呼び出したとき。<a href="/fonctionnalites/automatisations/#basedbを呼び出すサービス">basedbを呼び出すサービス</a>',
					'<strong>待機</strong>を3日間、またはフィールドの日付まで置き、行を改めて読み直してから再開します：「まだ承諾されていなければ再送する」。<a href="/fonctionnalites/automatisations/#待機">待機</a>',
					'<strong>PDFを生成して送信</strong>：行のドキュメントをファイルフィールドに保存するか、メールに添付します——リッチテキストで、CCの宛先と返信先アドレスを指定し、宛先ごとに1件、または全員に1件で。<a href="/fonctionnalites/automatisations/#pdfとメール">PDFとメール</a>',
					'<strong>行の削除、集計、別のオートメーションの実行</strong>：条件は値——AIの回答や合計など——も判定でき、何も見つからない検索には専用の経路があります。',
					'<strong>試行</strong>：いくつかのステップと、そのいずれかが失敗した場合の別のステップです。Webhookは自動で再試行し、ループは失敗した行があっても続行します。<a href="/fonctionnalites/automatisations/#試行">試行</a>',
					'<strong>すべてのステップがすぐ手の届くところに</strong>：<strong>+</strong>をクリックすると、カテゴリー別に整理され検索もできるウィンドウが開きます。これまでの、省略されることもあったメニューの代わりです。',
				],
			},
			designer: {
				date: '2026-10-02',
				title: 'お好みの色で作るPDFドキュメント',
				tag: '新機能',
				items: [
					'<strong>5つの起点</strong>——請求書、見積書、シート、証明書、空白のページ——。テーブルの列から作られます：番号、日付、金額、写真、リンクされた行。<a href="/fonctionnalites/documents/#テンプレートを作成">テンプレートを作成</a>',
					'<strong>ロゴと配色をあなた好みに</strong>：ロゴと連絡先を含むヘッダー、法的表記とページ番号を含むフッター、アクセントカラー、明朝体またはゴシック体のフォント、ページを囲む枠。<a href="/fonctionnalites/documents/#ヘッダーとフッター">ヘッダーとフッター</a>',
					'<strong>新しいブロック</strong>：バナー上の見出し、画像、2列または3列、税抜／税込の集計、色付きヘッダーの表、区切り線。ドラッグで並べ替えられ、プレビューは変更のたびに更新されます。<a href="/fonctionnalites/documents/#内容ブロック">ブロック</a>',
				],
			},
			resilience: {
				date: '2026-10-01',
				title: '接続が切れてもbasedbはもう止まりません',
				tag: 'ホスティング',
				items: [
					'<strong>切れた接続でもう止まらない</strong>：PostgreSQLが接続を閉じても——再起動、ネットワーク障害、アイドル状態のまま残ったトランザクションなど——失敗するのはそれを保持していたクエリだけです。basedbは動作を続け、ログにはどの作業がそれを保持していたかが記録されます。',
					'<strong>負荷の高いデータベースでの待ちが減少</strong>：テーブルのページは、関連する行を読み込む間もうトランザクションを開いたままにしません。また、15秒以内に接続を取得できなかったクエリは、無限に待つのではなくエラーを受け取ります。',
					'<strong>書いたとおりに読まれるAIヘッダー</strong>：<code>BASEDB_AI_HEADERS</code>はAnsibleが書き換える形式——<code>{\'api-key\': \'…\'}</code>——や、1行に1つのヘッダーという形式も受け付けます。これらを使えば、<code>openai_compatible</code>はキーなしで済みます。',
				],
			},
			applications: {
				date: '2026-09-30',
				title: 'basedbを基盤にするアプリケーションのために',
				tag: '新機能',
				items: [
					'<strong>1回の呼び出しでテンプレートから作るデータベース</strong>：サーバーがテンプレート全体——テーブル、リレーション、行、ビュー、オートメーション——を適用します。どこかのステップが失敗すれば、何も適用されません。ギャラリーもこの仕組みを使っています——これもインストールされるアプリケーションです。<a href="/integrations/api-rest/#テンプレートからのデータベース作成">テンプレートからのデータベース作成</a>',
					'<strong>トークンの検証</strong>：誰かのトークンを渡されたアプリケーションが、それがまだ有効か、誰のものか——そのアカウント、そのグループ——をbasedbに問い合わせます。<a href="/integrations/api-rest/#トークンの検証">トークンの検証</a>',
					'<strong>社内のサーバーへ</strong>：Webhookやオートメーションが届くのは、HTTPも含めて<code>BASEDB_WEBHOOK_ALLOW</code>に挙げた宛先だけです。プログラムは、連携トークンを使ってテーブルをリアルタイムに追跡することもできます。<a href="/integrations/webhooks/#webhookなしテーブルを追跡する">テーブルを追跡する</a>',
					'<strong>ゲートウェイの配下、パスの下で</strong>：basedbは<code>https://passerelle.example.com/basedb/</code>のようなアドレスで公開できます。ゲートウェイがそのパスを残すか外すかは問いません。<a href="/hebergement/docker/#ゲートウェイの配下パスの下で">ゲートウェイの配下</a>',
					'<strong>1つのWebhookで全テーブルを一括設定</strong>：ワンクリックで、あるイベントを全テーブルに対してオン・オフしたり、あるテーブルの全イベントをオン・オフしたりできます。',
				],
			},
			loopsWebhooks: {
				date: '2026-09-30',
				title: '行を巡回し、APIと話すオートメーション',
				tag: '新機能',
				items: [
					'<strong>行ごとに</strong>：フィルターに一致するテーブルの各行についてステップを繰り返す機能です——毎週月曜、未払いの請求書をすべて督促できます。最初の1件だけではありません。<a href="/fonctionnalites/automatisations/#行ごとに">行ごとに</a>',
					'<strong>どんなAPIとも話せるWebhook</strong>：メソッド、行を引用するアドレス、ヘッダー、そして行の値で組み立てるJSON・フォーム・テキストの本文。<a href="/fonctionnalites/automatisations/#サービスを呼び出す">サービスを呼び出す</a>',
					'<strong>APIキーは秘密のまま</strong>：暗号化され、画面にも、APIにも、Copilotにも二度と表示されず、渡した相手のホストにしか送られません。',
				],
			},
			maps: {
				date: '2026-09-30',
				title: '地図、そして居場所が見つかる住所',
				tag: '新機能',
				items: [
					'<strong>10番目のビュー、地図</strong>:各行を、住所か緯度・経度によって、その場所に配置します。ピンはステータスの色をまとい、クリックで行の詳細を開きます。<a href="/fonctionnalites/vues/#地図">地図</a>',
					'<strong>住所は一度限り特定されます</strong>。OpenStreetMapのサービス、またはお好みのサービスによって——ピンは回答が届くたびに現れ、その後は即座に表示されます。見つからない住所も、黙って除外されることなくカウントされます。',
					'<strong>住所形式</strong>は短文テキスト向けです:クリックで地図が開き、行の詳細では<strong>住所を検索</strong>が該当する完全な住所を提案します。<a href="/fonctionnalites/tables-et-champs/#表示形式">表示形式</a>',
				],
			},
			documents: {
				date: '2026-09-30',
				title: '行から作るPDF',
				tag: '新機能',
				items: [
					'<strong>見積書、請求書、PDFの書類</strong>を行のメニューから:設定なしで印刷できる書式、またはテンプレート——列を引用するテキスト、行のフィールド、合計付きのリンクされた行の表、改ページ。<a href="/fonctionnalites/documents/">ドキュメント</a>',
					'<strong>各自の権限で</strong>:あなたに非表示のフィールドは、あなたのPDFには表示されません。basedbの20言語で書けます——中国語、日本語、韓国語も含めて。APIも同じドキュメントを返します。',
				],
			},
			rows: {
				date: '2026-09-30',
				title: '行単位までの権限、既定値、Excelインポート',
				tag: '新機能',
				items: [
					'<strong>行ごとの権限</strong>:グループは条件に合う行だけを見られます——「担当者は自分」「地域は北」——インターフェース、API、MCPサーバー、そしてSQLでも同様に、PostgreSQLが同じルールを適用します。<a href="/fonctionnalites/droits/#行単位まで">行単位まで</a>',
					'<strong>既定値</strong>:固定値、今日の日付、作成時の時刻、または行を作成する人——画面にあらかじめ入力され、それ以外の場所でも適用されます。<a href="/fonctionnalites/tables-et-champs/#既定値">既定値</a>',
					'<strong>Excelブックをドラッグするだけ</strong>:シートを選べば、日付、金額、チェックボックスはそのまま取り込まれ、数式はその値が使われます。<a href="/guides/premiers-pas/">クイックスタート</a>',
				],
			},
			mail: {
				date: '2026-09-30',
				title: 'メール',
				tag: '新機能',
				items: [
					'<strong>オートメーションに「メールを送信」ステップ</strong>:チームのメンバーへ、フィールドの人へ、取引先のアドレスへ——件名と本文に行の値を引用できます。<a href="/fonctionnalites/automatisations/">オートメーション</a>',
					'<strong>メール通知</strong>は、未読のままだとまとめて届き、設定でひとつずつ選べます。そして<strong>パスワードをお忘れの方</strong>は、リンクで再設定できます。<a href="/fonctionnalites/collaboration/#メール通知">メール通知</a>',
					'インスタンスに、ご利用のメールサービスの送信サーバーを指定するだけです。<a href="/hebergement/variables/#メール">変数</a>',
				],
			},
			integrations: {
				date: '2026-09-30',
				title: 'n8nとTypeScript SDK',
				tag: '新機能',
				items: [
					'<strong>n8nのノード</strong>:ワークフローからテーブルの行を読み書きし、行が作成・変更・削除されるたびにワークフローを起動します——確認または署名付きWebhookで。<a href="/integrations/n8n/">n8n</a>',
					'<strong>TypeScript SDK</strong>、インスタンスから生成されたテーブルの型とともに:存在しないテーブルやフィールドは、実行前の時点でエラーになります。<a href="/integrations/sdk/">SDK</a>',
				],
			},
			quiz: {
				date: '2026-09-29',
				title: 'クイズ:得点を数える質問',
				tag: '新機能',
				items: [
					'<strong>新しいビュー、クイズ</strong>:各質問に正解と配点を設定できるアンケートです——1つの選択、複数の選択、はい・いいえ、数値、日付、または大文字・小文字やアクセント記号を区別しない正解テキスト。<a href="/fonctionnalites/vues/#クイズ">クイズ</a>',
					'<strong>お好みの答え合わせ</strong>:質問ごと——緑色で、または赤色で正解とともに、画面上部のスコアが増えていきます——、最後に、またはなし。合格ラインを設定すると「合格！」または「今回は不合格…」と表示されます。',
					'<strong>最後にスコア</strong>を、満ちていくリングで表示し、続けて各質問の答え合わせを示します。スコアはテーブルの数値フィールドに書き込まれます:グリッドを並べ替えれば、順位表になります。',
					'<strong>リンクで共有、不正なしで</strong>:ページには正解が一切送られず、採点と集計はサーバーが行います。<a href="/fonctionnalites/formulaires-partages/#共有クイズ">共有クイズ</a>',
					'<strong>ビューを作成</strong>は、ビューセレクターの下部で、9種類を2つのグループ——行を表示するものと、回答を集めるもの——に分け、それぞれ色付きのアイコンで示します。',
				],
			},
			forms: {
				date: '2026-09-29',
				title: '入力したくなるフォームへ',
				tag: '新機能',
				items: [
					'<strong>アンケートは画面全体を占めます</strong>:質問が1つずつスライドして表示され、選択肢には大きなカード、評価には星、そしてすべてキーボードで操作できます——<strong>Enter</strong>、文字A、B、C…、Y・N、数字。単一選択なら自動で次に進みます。<a href="/fonctionnalites/vues/#フォームとアンケート">フォームとアンケート</a>',
					'<strong>自分だけの外観</strong>:ライトから夜まで、紙も含めた8つのテーマ、色、フォント、配置——共有リンクのページにも同じ外観が反映されます。',
					'<strong>表示条件を設定…</strong>:直前の回答が求めるときだけ質問が表示されます。非表示の質問は必須にならず、保存もされません。',
					'<strong>最初に設定することは何もありません</strong>:新しいフォームは、あとでチームが入力するステータスではなく、回答者が答える内容を尋ねます。テーブルの色をまとい、各フィールドに回答例を表示します。そして送信すると、紙吹雪でお祝いします。',
				],
			},
			formulaLanguages: {
				date: '2026-09-28',
				title: '数式はフランス語でも英語でも',
				tag: '新機能',
				items: [
					'<strong>フランス語でも英語でも、どの画面でも数式を入力できます</strong>。両方を混ぜても構いません:<code>SI</code>または<code>IF</code>、<code>ARRONDI</code>または<code>ROUND</code>、<code>JOURS</code>または<code>DAYS</code>…引数は<code>;</code>または<code>,</code>で区切ります。<a href="/fonctionnalites/tables-et-champs/#数式">数式</a>',
					'<strong>数式は画面の言語で読み直されます</strong>:フランス語の画面ではフランス語、ほかの19の言語では英語で——既存の数式や「関数」パネルも同じです。APIは、指定された言語で数式を返し、指定がなければ英語で返します。',
					'フランス語以外の言語で提供される公式テンプレートは、数式が英語で書かれた状態で届きます。データベース側では何も変わりません:列もSQLも同じで、マイグレーションも不要です。',
				],
			},
			search: {
				date: '2026-09-27',
				title: 'すべてを見つける:Ctrl+K',
				tag: '新機能',
				items: [
					'<strong>すべてをひとつのフィールドで</strong>——<strong>Ctrl+K</strong>、または上部バー中央のフィールドから:テーブル、ビュー、質問、ダッシュボード、オートメーション、列、そして行そのものまで、自分の権限で読み取ります。大きな画面では、選んだ結果のプレビューも表示されます。<a href="/fonctionnalites/recherche/">検索</a>',
					'<strong>思いつくままに入力</strong>:アクセント記号や大文字・小文字を区別せず、頭文字でも——「新しい顧客」には<code>新顧</code>——、入力ミスも1つまで許容し、<code>顧客 大阪</code>でテーブル「顧客」から「大阪」を検索できます。よく開くものが上位に来ます。',
					'<strong>すべての操作をキーボードで</strong>:作成する、移動する、閉じる、元に戻す、テーマを変更する、ページのリンクをコピーする。<code>&gt;</code>はコマンドだけ、<code>#</code>はオブジェクトだけ、<code>/</code>は行だけを検索します。<strong>Tab</strong>は、テーブルまたはデータベースの中を検索します。',
					'<strong>質問があるときは</strong>、そのまま入力してください:<strong>Copilotに質問</strong>が、開いているデータベースでその質問を送ります。',
				],
			},
			questions: {
				date: '2026-09-27',
				title: '自分の質問、テキスト内の数値',
				tag: '新機能',
				items: [
					'<strong>誰もが自分の質問を保存できます</strong>、管理レベルがなくても:個人用の質問は自分だけが見られます。データベースを管理する人は、クエリと同じように、データベース全体またはグループと共有できます。<a href="/fonctionnalites/tableaux-de-bord/">ダッシュボード</a>',
					'<strong>質問はタブの中に</strong>、テーブルと並んで開きます:<strong>新しい質問</strong>と<strong>新しいSQL質問</strong>が、タブバーの<strong>+</strong>とデータベースのメニューにあります。タブは、そこに残した内容を保持します。<strong>コピーを保存</strong>は、変更できない質問を自分のものにします。',
					'<strong>テキスト内の数値</strong>:書式が使えるようになったダッシュボードのテキストが、カード、質問、フィルターから取り出した値——<code>{{chiffre_affaires}}</code>——を引用します。読む人の権限で計算され、リンクで共有されたダッシュボードでも同じです。<a href="/fonctionnalites/tableaux-de-bord/#テキスト内の数値">テキスト内の数値</a>',
					'クエリ、SQLビュー、質問も、それぞれのメニューから右クリックで削除できます。',
				],
			},
			addresses: {
				date: '2026-09-27',
				title: 'どの画面にもアドレスを',
				tag: '新機能',
				items: [
					'<strong>アドレスが画面に従います</strong>:テーブル、ビュー、行の詳細、ダッシュボード、オートメーション、質問、個人設定——<code>/bases/ventes/tables/opportunites?ligne=…</code>。お気に入りに登録したり、メッセージに貼り付けたりすれば、誰でも自分の権限のまま同じ場所にたどり着きます。<a href="/fonctionnalites/collaboration/#各画面へのリンク">各画面へのリンク</a>',
					'ブラウザーの<strong>戻る</strong>・<strong>進む</strong>ボタンで、いた場所に戻れます。どこにもつながらないアドレスには「このページは存在しません」と表示されます。',
				],
			},
			demo: {
				date: '2026-09-27',
				title: '試せるデモを、ご利用の言語で',
				tag: '新機能',
				items: [
					'<strong>デモ</strong>は<a href="https://demo.basedb.eodia.com">demo.basedb.eodia.com</a>にあります。アカウントには、お使いのブラウザーの言語があらかじめ入力されており、そのデータベースもその言語です。すべて閲覧でき、既存のものは変更できますが、作成、削除、AIは無効になっており、データベースは毎晩最初の状態に戻ります。',
					'<strong>自分だけのデモ</strong>:<code>BASEDB_DEMO=1</code>が、言語ごとにあらかじめ用意された共有アカウントを持つ、誰にでも開かれたインスタンスにします。<a href="/hebergement/variables/#公開デモ">変数</a>',
					'<strong>リンクごとの言語</strong>:basedbのアドレスの末尾に付けた<code>?lang=de</code>は、ログイン画面や共有ページをドイツ語で表示します。こうしてサイトは、そのページの言語でデモへ案内します。<a href="/fonctionnalites/droits/#個人設定">個人設定</a>',
				],
			},
			templateLanguages: {
				date: '2026-09-27',
				title: 'テンプレートを、ご利用の言語で',
				tag: '新機能',
				items: [
					'<strong>公式テンプレートは、画面の言語で作成されます</strong>:テーブル、フィールド、選択肢、ビュー、ダッシュボード、オートメーション、AIへの指示——そして、言語ごとに舞台が変わるサンプル行。Lyonにある「Boulangerie Martin」は、日本語では大阪の「田中ベーカリー」になります。<a href="/fonctionnalites/modeles/#ご利用の言語で">テンプレート</a>',
					'<a href="/modeles/">サイトのギャラリー</a>は、各テンプレートをそのページの言語で表示します。',
					'<strong>ひとつのテンプレート、複数の辞書</strong>:テンプレートはフランス語で一度だけ書かれます。各言語はそのテキストだけを翻訳し、basedb自身が、それが引用されている箇所まで各ラベルを追いかけます。テンプレートを壊してしまう辞書は使われません。<a href="/fonctionnalites/modeles/#すべてのインスタンス向けにテンプレートを公開する">テンプレートを公開する</a>',
				],
			},
			details: {
				date: '2026-09-27',
				title: 'そのほか',
				items: [
					'<strong>サンプル行のないテンプレート</strong>:「サンプルデータを読み込む」のチェックを外すと、空のテーブルが作成され、自分のデータを入れる準備が整います。<a href="/fonctionnalites/modeles/#テンプレートから始める">テンプレートから始める</a>',
					'<strong>各データベースのAPIとMCPのドキュメント</strong>は、画面の言語で書かれます。<a href="/integrations/api-rest/#生成されるドキュメント">生成されるドキュメント</a>',
					'ブラウザーが独自のツールチップを表示していた場所には、アプリのテーマに沿ったツールチップを表示します。メニューの「削除」は赤色で表示されます。コメントの時刻にマウスを合わせると、完全な日付が表示されます。',
				],
			},
			languages: {
				date: '2026-09-27',
				title: 'リッチテキスト、変数、より見やすいカンバン',
				tag: '新機能',
				items: [
					'<strong>リッチテキスト</strong>：ビジュアルエディターで書式を整える新しいフィールド型。見出し、リスト、引用、リンクに対応し、書き込み時にサニタイズされ、直接SQLに対しても制約で守られます。<a href="/fonctionnalites/tables-et-champs/#リッチテキストと変数">リッチテキストと変数</a>',
					'<strong>変数</strong>：長文テキストで同じ行の列を引用すると（<code>{{Ville}}</code>）、グリッド、行の詳細、API、MCPサーバー、共有ビュー、オートメーションなど、どこでもその値で表示されます。列には引用がそのまま保存され、<code>psql</code>はそれを読みます。',
					'<strong>より見やすいカンバン</strong>：ゆとりのあるカード、カバー画像、そして行の値を引用する説明（「{{Date}}に{{Client}}様へ納品」）。<a href="/fonctionnalites/vues/">ビュー</a>',
					'<strong>ワンステップで名前を変更</strong>：データベース、テーブル、フィールドの名前変更をひとつのダイアログで。ラベルは常に変わり、管理者は影響分析を確認しながらデータベース上の名前も変更できます。<a href="/fonctionnalites/tables-et-champs/#スキーマを変更する">スキーマを変更する</a>',
					'<strong>20の言語</strong>：インターフェース、このサイト、ドキュメントを、フランス語、英語、ドイツ語、スペイン語、イタリア語、ポルトガル語（ブラジル）、オランダ語、ポーランド語、チェコ語、スウェーデン語、デンマーク語、ノルウェー語、フィンランド語、ルーマニア語、ハンガリー語、トルコ語、ウクライナ語、日本語、簡体字中国語、韓国語で。basedbはブラウザーの言語で表示され、<strong>設定 › 外観 › 言語</strong>で別の言語に固定できます。この設定はどの端末でも引き継がれます。数値と日付は言語に合わせて表示されます。<a href="/fonctionnalites/droits/#個人設定">個人設定</a>',
				],
			},
			aiProvider: {
				date: '2026-09-27',
				title: '選べるAI、自分のマシンまで',
				tag: '新機能',
				items: [
					'<strong>4つ目のAIプロバイダー</strong>：OpenAIのAPIに対応するサーバーなら何でも——Azure、社内のゲートウェイ、自分のマシンで動かすモデルなど——、<code>.env</code>で指定できます。呼び出しのログには、データの送信先が記録されます。<a href="/fonctionnalites/ia/">basedbのAI</a>',
					'<strong>ログイン画面</strong>には、グリッドとSQLに続いて、フィルターと連動するダッシュボードと、AIのステップも含めて実行されるオートメーションが表示されます。',
				],
			},
			flows: {
				date: '2026-09-27',
				title: 'フローで組むオートメーション',
				tag: '新機能',
				items: [
					'<strong>グラフエディター</strong>：トリガー、そして各ステップをカードで。線上の<strong>+</strong>で、その位置にステップを追加します。単純なオートメーションは、これまでどおりカード2枚で済みます。<a href="/fonctionnalites/automatisations/">オートメーション</a>',
					'<strong>行を検索</strong>（注文の顧客、未払いの最新の請求書など）し、その行を更新したり、引用したり、作成した行にリンクしたりできます。',
					'<strong>複数の分岐を持つ条件</strong>：条件を満たす最初の分岐が選ばれ、どれも満たさない場合は「それ以外」が選ばれます。分岐はその後で合流します。',
					'<strong>データはステップからステップへ</strong>：<code>{{e2.client}}</code>はステップが見つけた・作成したものを、<code>{{e3.reponse.numero}}</code>はWebhookの応答を引用します。各テキストのメニューには、それより前に確実に起きたことだけが表示されます。',
					'<strong>各実行をステップごとに</strong>：フローに重ねて表示すると、通った分岐がたどられ、各ステップが何をしてどれだけ時間がかかったかがわかります。',
					'<strong>オートメーションのCopilot</strong>：データベースに自動でさせたいことを説明するか、実行が失敗した理由を尋ねてください。Copilotがオートメーション全体を提案し、クリックひとつでフローに配置して、確認してから保存できます。自分で保存するまで、何も保存されません。<a href="/fonctionnalites/automatisations/#copilot">Copilot</a>',
					'ステップで<strong>AIに質問</strong>：AIフィールドと同じように、行と前のステップを引用する指示を送り、回答をテキスト、数値、はい/いいえ、日付、リストの選択肢として受け取ります。後続のステップがそれを書き込んだり送信したりします。<a href="/fonctionnalites/automatisations/#aiに質問">AIに質問</a>',
				],
			},
			dashboards: {
				date: '2026-09-27',
				title: 'ダッシュボード：質問、グラフ、フィルター',
				tag: '新機能',
				items: [
					'マウス操作で作る<strong>質問</strong>（テーブルとその結合、フィルター、日・週・月・年ごとの集計値）、または<strong>SQL</strong>で書く質問。読み取り専用で、変数も含めて自分の権限で実行されます。<a href="/fonctionnalites/tableaux-de-bord/">ダッシュボード</a>',
					'<strong>15種類の可視化</strong>：数値、前の期間と比べたトレンド、目標への進捗、ゲージ、縦棒グラフ、横棒グラフ、折れ線グラフ、面グラフ、複合グラフ、円グラフ、ファネル、散布図、表、クロス集計表、フランスまたは世界の地図。',
					'<strong>クリックで探索</strong>：点をクリックすると、その行、より細かい期間、別の内訳が開きます。',
					'<strong>グリッドで組むダッシュボード</strong>：マウスで移動・サイズ変更できるカード、タブ、見出し、テキスト、埋め込みページ。',
					'<strong>共通のフィルター</strong>（期間、カテゴリー、テキスト、数値、日付のグループ化）で、1枚、複数、またはすべてのカードを操作できます。デフォルト値も設定できます。',
					'<strong>思いどおりのグラフ</strong>：系列や項目ごとの色と名前、ドーナツ・半円・鶏頭図、合計付きの積み上げ、なめらかな線や階段状の線、軸、目盛り、対数スケール。表では列名を変更し、値に応じてバーや色を付けられます。',
					'<strong>ダッシュボードのCopilot</strong>：会話の中で、質問、ダッシュボードの変更（元に戻せます）、フィルターの値を提案し、クリックひとつで適用できます。プロバイダーに送られるのはスキーマだけで、結果を読ませるのは許可した場合に限られます。<a href="/fonctionnalites/tableaux-de-bord/#copilot">Copilot</a>',
					'<strong>ダッシュボードを共有</strong>：公開またはメンバー限定（必要ならグループ限定）のリンクで共有し、他のサイトに埋め込めます。カードとフィルターは読み取り専用で、公開した人の権限で読まれます。<a href="/fonctionnalites/tableaux-de-bord/#ダッシュボードを共有する">共有</a>',
					'「インターフェース」は<strong>ダッシュボード</strong>に名称が変わりました。既存のダッシュボードは、新しいグリッドでそのまま開きます。',
				],
			},
			sqlViews: {
				date: '2026-09-27',
				title: '保存済みクエリとSQLビュー',
				tag: '新機能',
				items: [
					'<strong>誰もが使えるSQL</strong>：管理レベルがなくても、SQLタブは読み取り専用で、自分の権限で実行されます。権限はPostgreSQL自身が適用し、閉じられたテーブルは存在しないものとして扱われ、非表示のフィールドは拒否されます。「自分の権限」バッジがそれを示します。<a href="/fonctionnalites/requetes-et-vues-sql/">クエリとSQLビュー</a>',
					'<strong>保存済みクエリ</strong>：テーブルの下の「クエリ」セクションに、個人用、データベース全体用、またはグループ用として保存します。クエリを共有しても共有されるのはその文面だけで、作成者が読める内容ではありません。サイドバーから開くと、すぐに読み取り専用で実行されます。',
					'<strong>SQLビュー</strong>：本物のPostgreSQLビューを、色、アイコン、小さな目のマーク付きでテーブルと並べて表示します。<code>psql</code>や各種ツールからも読めます。誰もが自分の権限で読み、サイドバーには、すべてを読める人にだけ表示されます。',
					'ビューはスキーマの変更に追従します。名前を変えても壊れず、数式を変更すると一時的に外されてから元に戻ります。成り立たなくなったビューは定義を保ったまま残り、修正を待ちます。',
				],
			},
			settings: {
				date: '2026-09-27',
				title: '個人設定',
				tag: '新機能',
				items: [
					'プロフィールメニューの<strong>設定</strong>：名前、メールアドレス、アカウントに連携したIDプロバイダー、パスワード、開いているセッション。<a href="/fonctionnalites/droits/">アカウントとログイン</a>',
					'<strong>外観</strong>：テーマ、日付の順序（<code>25/09/2026</code>または<code>2026-09-25</code>）、カレンダーの週の始まりの曜日。後の2つはどの端末でも引き継がれます。',
					'<strong>通知</strong>：不要な通知を種類ごとにオフにできます。<strong>トークン</strong>：すべてのデータベースで自分が作成したトークンと、その最終使用日時、取り消し。',
				],
			},
			v020: {
				date: '2026-09-26',
				title: 'バージョン0.2.0：自分のアカウント、プロジェクト、招待',
				tag: '新機能',
				items: [
					'<strong>初回ログイン</strong>：新しいインスタンスでは、最初のページで、自分のメールアドレスとパスワードで管理者アカウントを作成します。デフォルトアカウントも、ログから探すパスワードもなくなりました。<a href="/guides/installation/">インストール</a>',
					'<strong>アカウントの作成</strong>：誰でも自分のアカウントを作成し、自分のプロジェクトを作って、その管理者になれます。システム管理側では、アカウント作成を停止したり、特定のドメインに限定したりできます。<a href="/hebergement/connexion/">アカウントとログイン</a>',
					'<strong>プロジェクトやデータベースを共有</strong>：管理レベルを持つ人は、閲覧・編集・管理の権限でリンクから招待し、アクセスできる人を確認して、レベルを変更したりアクセスを取り消したりできます。自分が管理する範囲を超えることはありません。',
					'<strong>プライバシー</strong>：各自に見えるのは、プロジェクトを共有している人だけになりました。また、他の人が使っているプロジェクト名を推測することもできなくなりました。',
					'<strong>Google、Microsoftでログイン</strong>、そして任意のOpenID Connectプロバイダー（Keycloak、GitLabなど）で。<code>.env</code>で設定します。アカウント作成が許可されていれば、初回ログイン時にアカウントが作成されます。<a href="/hebergement/connexion/">設定する</a>',
					'<strong>新しいログイン画面</strong>：アプリのテーマ（ライトまたはダーク）に合わせ、控えめなアニメーション付き。アプリ内の空の画面にはイラストを添えました。',
					'<strong>データを失わないアップデート</strong>：basedbは起動時にカタログを自動で更新します（0.1のインストールも含む）。より新しいバージョンで更新済みのデータベースでは、起動を拒否します。<a href="/hebergement/sauvegardes/">アップデートする</a>',
				],
			},
			dockerImage: {
				date: '2026-09-26',
				title: '1つのDockerイメージ',
				tag: 'ホスティング',
				items: [
					'basedbは<strong>1つのイメージ</strong>に収まりました。Docker Hubの<code>eodia/basedb</code>で、amd64とarm64に対応しています。インターフェース、<code>/api</code>のAPI、<code>/mcp</code>のMCPサーバーを<strong>1つのポート</strong>で提供します。<a href="/guides/installation/">インストール</a>',
					'必要なファイルは<code>docker-compose.yml</code>と<code>.env</code>の2つだけ。リポジトリをクローンすることも、何かをビルドすることもありません。アップデートは<code>docker compose pull</code>で行います。',
					'ドメインの背後に置く場合も、HTTPSプロキシでルーティングする必要はもうありません。すべてポート3000に送るだけです。',
				],
			},
			automations: {
				date: '2026-09-26',
				title: 'オートメーション、インターフェース、数式、コラボレーション',
				tag: '新機能',
				items: [
					'フランス語で書く<strong>数式</strong>（<code>SI</code>、<code>ARRONDI</code>、<code>JOURS</code>…）が、PostgreSQLの生成列になります。リレーションをまたぐ<strong>ルックアップ</strong>、<strong>ロールアップ</strong>、<strong>カウント</strong>も。<a href="/fonctionnalites/tables-et-champs/">フィールド</a>',
					'<strong>新しい型</strong>：複数リレーション、メンバー、メール、自動採番、ボタン。さらに、型と同じように選べる表示形式：通貨、パーセント、期間、星の評価、電話番号、バーコード。',
					'<strong>8つのビュー</strong>：<strong>ギャラリー</strong>と<strong>リスト</strong>が他の6つに加わりました。すべての閲覧者が使える<strong>個人ビュー</strong>、ロックされたビュー、手動の並べ替え、タイムラインの依存関係。<a href="/fonctionnalites/vues/">ビュー</a>',
					'<strong>グリッド</strong>：クイック検索、グループ化、フィルター全体に対する列ごとの集計、ルールによる色分け、行の高さ。',
					'読み取り専用の<strong>共有ビュー</strong>は、他のサイトに埋め込めます。カレンダーは、Googleカレンダー、Outlook、Appleカレンダー向けの<strong>iCalendarフィード</strong>になります。<a href="/fonctionnalites/vues-partagees/">共有</a>',
					'<strong>コラボレーション</strong>：コメントとメンション、通知、他の人の書き込みのリアルタイム反映、テーブルと行のプレゼンス表示。<a href="/fonctionnalites/collaboration/">チームで作業</a>',
					'<strong>Ctrl+Z</strong>で最後の書き込み（セル、移動したカード、インポート全体）を取り消します。その後に他の人が変更した内容を上書きしそうなときは、取り消しを拒否します。',
					'<strong>オートメーション</strong>：行が作成・更新されたとき、決まった時刻、またはボタンのクリックで、更新、作成、通知、Webhookの呼び出し、Slackへの投稿を実行します。<a href="/fonctionnalites/automatisations/">自動化</a>',
					'<strong>インターフェース</strong>：数値、グラフ、リスト、テキストを並べ、各自の権限で読まれるダッシュボード。<a href="/fonctionnalites/tableaux-de-bord/">ダッシュボード</a>',
					'<strong>連携</strong>：Slackチャンネル、そしてオンラインのCSV、カレンダー、別のbasedbのビューから更新される<strong>同期テーブル</strong>。<a href="/integrations/synchronisation/">連携</a>',
					'<strong>データベーステンプレート</strong>：10のテンプレートのギャラリー、1文で説明してAIに作らせるデータベース、そしてどのデータベースもテンプレートとして保存可能に。<a href="/modeles/">ギャラリー</a>',
					'<strong>権限</strong>：管理レベルを持たない人には、スキーマ画面が閲覧専用になります。',
					'<strong>新しいアイデンティティ</strong>：ロゴ、カラーパレット、そして刷新したログイン画面。',
				],
			},
			simpler: {
				date: '2026-09-26',
				title: 'よりシンプルなインターフェース',
				items: [
					'<strong>サイドバー</strong>には、データベースとそのテーブルだけを表示するようになりました。開いているデータベースの画面（スキーマ、履歴、インターフェース、オートメーション）は、プロフィールのすぐ上のブロックにまとめました。',
					'<strong>プロフィールメニュー</strong>には、データ以外のもの（APIとMCPのドキュメント、連携、ユーザー、権限）をまとめました。',
					'<strong>SQLクエリ</strong>は、タブバーの「+」またはデータベースのメニューから開きます。サイドバーとの重複はなくなりました。',
					'<strong>新しいデータベース</strong>のダイアログで、すぐにテンプレートとAIを選べます。デモデータベースも同じギャラリーから作成します。',
					'<strong>拒否される操作は画面に表示しません</strong>：管理レベルがなければスキーマ変更のボタンはなく、削除権限がなければ「削除」もありません。閲覧者はメッセージに阻まれることなく、自分のビューを作成できます。',
					'<strong>システム列</strong>は、すべてのテーブルで提示するのではなく、「システム情報」の下にまとめました。',
					'<strong>行の詳細</strong>に、コメント、メール送信や発信のボタン、クリックひとつで付けられる評価が加わりました。',
					'<strong>ログイン画面</strong>は3Dアニメーションの背景をやめ、「動きを減らす」設定を尊重する軽い画面になりました。',
				],
			},
			environments: {
				date: '2026-09-26',
				title: '環境、共有フォーム、ビュー',
				items: [
					'<strong>環境</strong>：同じデータベースに本番、ステージング、開発。並べての比較、移行計画、行の同期。',
					'<strong>スキーマの履歴</strong>：テーブルとフィールドの作成・変更をすべて、カタログのトリガーで記録。',
					'<strong>共有フォーム</strong>：公開またはメンバー限定のリンク、日付や回答数による受付終了、履歴での回答者の記録。',
					'<strong>6つのビュー</strong>：グリッド、カンバン、カレンダー、タイムライン、フォーム、アンケート。',
					'<strong>データの履歴</strong>：変更の取り消し、削除した行の復元。',
					'<strong>AI</strong>：あらゆるフィールドのAIオプションと、Copilot。',
					'<strong>リレーション</strong>と<strong>URL</strong>：2つの別々の型に。長文テキストはMarkdownで書けます。',
					'署名付きで順序どおりに届く<strong>Webhook</strong>、承認制の<strong>エージェントの提案</strong>。',
					'<strong>Docker</strong>：3つのターゲットを持つDockerfile、完全なdocker-compose、オプションのHTTPSプロキシ。',
				],
			},
			projects: {
				date: '2026-09-25',
				title: 'プロジェクト、権限、MCPサーバー',
				items: [
					'データベースの上位に<strong>プロジェクト</strong>、そして4つのレベル（アクセス権なし、閲覧、編集、管理）による<strong>グループ</strong>単位の権限。',
					'<strong>アカウント</strong>：一時パスワード、初回ログイン時の変更、システム管理のための昇格。',
					'<strong>MCPサーバー</strong>とstdioリレー。REST APIとMCPに共通の<strong>連携トークン</strong>。',
					'データベースごとに<strong>自動生成されるドキュメント</strong>「APIとMCP」。',
				],
			},
			fields: {
				date: '2026-09-20',
				title: 'フィールド、単一選択、インポート',
				items: [
					'フィールドと単一選択の選択肢を編集。',
					'CSVファイルとJSONファイルの<strong>インポート</strong>。',
					'テーブルのメニュー：名前を変更、説明、削除。',
				],
			},
			firstCommit: {
				date: '2026-09-20',
				title: '最初のコミット',
				items: ['モノレポ：命名規則、エラーコードのレジストリ、アーキテクチャ文書から抽出したカタログ、コア、API、インターフェース。'],
			},
		},
	},
	roadmap: {
		label: 'ロードマップ',
		title: 'これからの予定',
		intro: 'basedbは活発に開発中です。このページでは、まだ足りないものを、日付を約束せずに紹介します。アイデアや要望があれば、<a href="https://github.com/eodia/basedb/issues">Issueを作成</a>してください。すでに実現したものは<a href="/nouveautes/">更新情報</a>をご覧ください。',
		columns: {
			next: {
				title: '近日中',
				items: {
					restoreTable: {
						title: 'テーブル単位の復元',
						text: '削除したテーブルは、退避された名前でSQLから読めます。インターフェースから単独で復元する機能は今後追加予定です。',
					},
					aiSettings: {
						title: 'インターフェースでのAI設定',
						text: 'プロバイダー、モデル、APIキーをワークスペースごとに設定。APIの環境変数を経由する必要はありません。',
					},
					mail: {
						title: 'メールによる通知と招待',
						text: 'メンション、返信、担当者の指定は現在basedb内で通知され、招待は自分で送るリンクで行います。今後はメールでも送れるようになります。',
					},
				},
			},
			later: {
				title: '今後',
				items: {
					formLinks: {
						title: '共有フォームでのリレーションとファイル',
						text: 'リンク先テーブルの限定的な検索と、外部の人向けに制限したファイルアップロード。',
					},
					moreEvents: {
						title: '通知するイベントの追加',
						text: 'フォームへの回答、エージェントの提案、Webhookの無効化を通知。',
					},
					sqlViewsAcross: {
						title: '環境をまたぐSQLビュー',
						text: '環境の作成や比較の際に、スキーマとともにSQLビューもコピー。データベーステンプレートにも含めます。',
					},
					loops: {
						title: 'データベーステンプレートに完全なフローを',
						text: '条件、検索、ループ、待機、PDFなど、オートメーションのフローをデータベーステンプレートに持ち込めるようにします。現在は単純なステップしか含められません。',
					},
					textFormulas: {
						title: 'テキストの数式',
						text: 'テキストの一部を抽出、置換、切り詰め。',
					},
					bulk: {
						title: '宣言的な一括操作',
						text: '数千行の変更を、1つの操作として履歴に記録。',
					},
					tombstones: {
						title: 'トゥームストーンの整理',
						text: '不要になった削除の痕跡をクリーンアップ。',
					},
				},
			},
		},
	},
	gallery: {
		label: 'テンプレート',
		title: '数秒で使えるデータベース',
		intro: '各テンプレートは、互いにリンクしたテーブル、サンプル行、ビュー、ダッシュボード、オートメーション、そしてAIが自ら埋めるフィールドを作成します。basedbで<strong>新しいデータベース</strong>、次に<strong>テンプレートから始める</strong>を選びます。ぴったりのものがなければ、必要なことを1文で説明してください。AIがデータベースを提案します。',
		filter: 'カテゴリーで絞り込む',
		all: 'すべて',
		otherCategory: 'その他',
		ai: '✦ AI',
		tables: {
			one: '{n} 個のテーブル',
			other: '{n} 個のテーブル',
		},
		rows: {
			one: '{n} 行',
			other: '{n} 行',
		},
		views: {
			one: '{n} 個のビュー',
			other: '{n} 個のビュー',
		},
		howtoTitle: 'JSONでテンプレートを設定する',
		howto: 'テンプレートはJSONファイルです：テーブル、フィールド、リレーション、行、ビュー、ダッシュボード、オートメーション、そしてAIフィールドの指示。このページのテンプレートは、リポジトリの<a href="https://github.com/eodia/basedb/tree/main/packages/templates/catalog"><code>packages/templates/catalog</code></a>フォルダーにあるファイルです。basedbの各インスタンスは<a href="/modeles/catalogue.json"><code>catalogue.json</code></a>を読み込み、ユーザーに提示します。管理者は独自のテンプレートをインスタンスにインポートすることもでき、どのデータベースもテンプレートとして保存できます。',
		format: {
			href: '/fonctionnalites/modeles/',
			label: 'テンプレートの形式 →',
		},
		back: '← すべてのテンプレート',
		defaultCategory: 'テンプレート',
		sampleRows: {
			one: 'サンプル {n} 行',
			other: 'サンプル {n} 行',
		},
		aiTitle: 'AIが計算する内容',
		useTitle: 'このテンプレートを使う',
		useSteps: [
			'basedbで<strong>新しいデータベース</strong>を選びます。',
			'<strong>テンプレートから始める</strong>で「{label}」を選びます。',
		],
		create: '<strong>データベースを作成</strong>します。',
		createWithAi: '<strong>データベースを作成</strong>します。必要であれば、AIフィールドをAIプロバイダーで計算することに同意します。',
		download: 'JSONをダウンロード',
		downloadNote: '自分のインスタンスにインポートするため、またはカタログに提案する前に調整するために。',
		viewMeta: '— {kind}、{table}',
		dashboard: '<strong>ダッシュボード</strong>「{label}」 — {blocks}',
		blocks: {
			one: '{n} 個のブロック',
			other: '{n} 個のブロック',
		},
		automation: '<strong>オートメーション</strong>「{label}」',
		yes: 'はい',
		no: 'いいえ',
		me: '自分',
		kinds: {
			short_text: '短文テキスト',
			long_text: '長文テキスト',
			rich_text: 'リッチテキスト',
			number: '数値',
			boolean: 'チェックボックス',
			date: '日付',
			datetime: '日時',
			select: '単一選択',
			multi_select: '複数選択',
			url: 'URL',
			email: 'メール',
			user: 'メンバー',
			autonumber: '自動採番',
			formula: '数式',
			lookup: 'ルックアップ',
			rollup: 'ロールアップ',
			count: 'カウント',
			button: 'ボタン',
			link: 'リレーション',
			multi_link: '複数リレーション',
		},
		viewKinds: {
			grid: 'グリッド',
			kanban: 'カンバン',
			calendar: 'カレンダー',
			timeline: 'タイムライン',
			gallery: 'ギャラリー',
			list: 'リスト',
			form: 'フォーム',
		},
	},
	templates: {
		demo: {
			label: 'デモ：アトリエ・ルーメン',
			summary: '小さなデザイン事務所の顧客、プロジェクト、タスク、請求書、レビュー：basedb のすべての機能を 1 つのデータベースで。',
			description: 'デモ用のデータベースです。アトリエ・ルーメンは架空のデザイン事務所です。このデータベースでは、テーブル間のリレーション、ルックアップとロールアップ（顧客別の売上、平均評価）、数式（税込金額、遅延）、顧客レビューに対する 3 つのAI計算フィールド（感情、テーマ、返信案）、すべての種類のビュー（グリッド、カンバン、カレンダー、依存関係付きタイムライン、ギャラリー、リスト、フォーム）、ダッシュボード 1 つ、オートメーション 2 つを紹介しています。',
			category: 'デモ',
			tags: ['AI', 'リレーション', 'すべてのビュー', 'ダッシュボード'],
		},
		'analyse-avis': {
			label: '顧客レビュー分析',
			summary: 'レビューを収集し、AIに感情・テーマ・緊急度の分析と返信の下書きを任せます。',
			description: '小売店、レストラン、ブランド向け：レビューは公開フォームやインポートで集まり、AIが 1 件ずつ読み取ります。感情を分類し、主なテーマを特定し、早急な返信が必要なものを知らせ、顧客の提案を抽出して、確認用の返信案を作成します。商品ごとに平均評価とレビュー数を集計し、ダッシュボードで満足度を追跡します。',
			category: 'カスタマーリレーション',
			tags: ['AI', 'フォーム', 'ダッシュボード'],
		},
		'base-connaissances': {
			label: 'ナレッジベース',
			summary: 'ヘルプ記事と顧客からの質問：AIが要約・分類し、記事をもとに回答案を作成します。',
			description: 'サポート部門向け。ヘルプ記事はカテゴリー別に整理して継続的に管理し、顧客からの質問は公開フォームで受け付けます。AIが各記事を要約してレベルを評価し、質問を分類して確認用の回答案を作成します。',
			category: 'サポート',
			tags: ['AI', 'フォーム', 'リスト'],
		},
		'calendrier-editorial': {
			label: '編集カレンダー',
			summary: '記事・投稿・ニュースレターをカレンダーで計画。AIがキャッチコピーとキーワードを提案します。',
			description: 'マーケティングチームや編集部向け。各コンテンツはアイデアから公開まで進み、公開カレンダー上に配置され、キャンペーンに紐づきます。AIがブリーフからキャッチコピーとキーワードを提案し、フォームから社内の誰でもテーマを提案できます。',
			category: 'マーケティング',
			tags: ['AI', 'カレンダー', 'カンバン', 'フォーム'],
		},
		crm: {
			label: '営業CRM',
			summary: '企業、連絡先、商談：営業パイプライン、やり取りの記録、次のアクションを助言するAI。',
			description: '営業チーム向けの軽量な CRM。商談はパイプライン上を進み、確度で重み付けした金額を持ちます。AIがメモから商談のリスクを評価し、次のアクションを提案します。顧客とのやり取りは記録・要約され、企業ごとに取引規模が集計されます。',
			category: '営業',
			tags: ['AI', 'パイプライン', 'カンバン', 'カレンダー'],
		},
		evenements: {
			label: 'イベントと申込み',
			summary: 'カンファレンス、ワークショップ、ウェビナー：申込み、残席、参加者のフィードバックをAIが読み取ります。',
			description: '定期的なイベントの運営に。各イベントで申込者数と残席数を集計し、申込みは出席まで進捗を管理できます。イベント後は参加者がフィードバックを残し、AIが感情ごとに分類して要約します。公開フォームからメーリングリストに登録できます。',
			category: 'イベント',
			tags: ['AI', 'カレンダー', 'フォーム', 'ロールアップ'],
		},
		'gestion-projet': {
			label: 'プロジェクト管理',
			summary: 'プロジェクト、タスク、マイルストーン：ロードマップ、タスク間の依存関係、カンバン、カレンダー。',
			description: '複数のプロジェクトを並行して管理するために。各プロジェクトでタスクと工数を集計し、タスクはカンバンで追跡、依存関係を描くタイムラインで計画し、マイルストーンはカレンダーで確認できます。AIが説明と進捗をもとに、経営陣向けのプロジェクト状況レポートを作成します。',
			category: '組織運営',
			tags: ['タイムライン', '依存関係', 'カンバン', 'AI'],
		},
		inventaire: {
			label: '在庫管理',
			summary: '商品・仕入先・入出庫：在庫は自動で計算され、欠品も事前に把握できます。',
			description: '工房、店舗、総務部門向け。入庫と出庫はそれぞれ入出庫として記録され、各商品の在庫はその合計、在庫金額は数式で計算されます。しきい値を下回った商品は「À commander」に表示されます。AIが商品名とカテゴリーから各商品の説明を作成します。',
			category: '業務',
			tags: ['ロールアップ', '数式', 'ギャラリー', 'AI'],
		},
		recrutement: {
			label: '採用',
			summary: '募集中のポジション、候補者、面接：AIが各応募を要約し、深掘りすべき点を提案します。',
			description: '応募から採用までの採用管理。候補者は公開フォームから応募し、カンバンで段階的に進み、面接はカレンダーで予定を立てます。AIが志望動機書とメモを読み、要約と面接で聞くべき質問を作成します。AIは読むのを助けるだけで、判断はしません。',
			category: '人事',
			tags: ['AI', 'フォーム', 'カンバン', 'カレンダー'],
		},
		'suivi-tickets': {
			label: 'チケット管理',
			summary: 'AIが仕分けしたバグと要望を、解決までスプリント単位で追跡します。報告用フォーム付き。',
			description: 'プロダクトチーム向けのチケット管理。各チケットはコンポーネントとスプリントに紐づきます。AIがカテゴリーを提案し、重大度を見積もり、報告内容を要約します。カンバンで進捗を追い、タイムラインでスプリントを表示し、フォームから誰でも問題を報告でき、オートメーションが解決日を記録します。',
			category: 'プロダクト・技術',
			tags: ['AI', 'カンバン', 'フォーム', 'スプリント'],
		},
	},
} satisfies DeepPartial<Dict>;
