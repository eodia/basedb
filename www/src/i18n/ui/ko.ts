/**
 * The Korean texts of the landing pages, laid over the French ones (`fr.ts`).
 *
 * See `../README.md`.
 */
import type { DeepPartial, Dict } from './index';

export default {
	meta: {
		home: {
			title: 'basedb — 모든 테이블이 실제 PostgreSQL 테이블인 협업 데이터베이스',
			description: '그리드와 여덟 가지 보기, 수식, 공유 양식과 공유 보기, 댓글, 자동화, 대시보드, 필드 단위 권한, 빠짐없는 기록, REST API와 MCP 서버 — 모두 알아보기 쉬운 이름의 실제 PostgreSQL 테이블 위에서 동작합니다. 자체 호스팅, AGPL-3.0.',
		},
		changelog: {
			title: '새 소식 — basedb',
			description: '버전마다 basedb에서 바뀐 내용입니다.',
		},
		roadmap: {
			title: '로드맵 — basedb',
			description: 'basedb의 다음 계획입니다.',
		},
		gallery: {
			title: '템플릿 — basedb',
			description: '바로 쓸 수 있는 데이터베이스: 티켓 관리, 리뷰 분석, CRM, 채용… 예시 행, 보기, 대시보드, AI가 계산하는 필드까지 갖추었습니다.',
		},
		template: {
			title: '{label} — basedb 템플릿',
		},
	},
	eodia: {
		home: 'https://eodia.com/',
		about: 'https://eodia.com/about/',
		contact: 'https://eodia.com/contact/',
	},
	nav: {
		aria: '주 메뉴',
		home: 'basedb — 홈',
		links: [
			{
				href: '/#fonctionnalites',
				label: '기능',
			},
			{
				href: '/modeles/',
				label: '템플릿',
			},
			{
				href: '/guides/introduction/',
				label: '문서',
			},
			{
				href: '/nouveautes/',
				label: '새 소식',
			},
		],
		developers: '개발자',
		github: 'basedb GitHub 저장소',
		install: '설치',
		menu: {
			open: '메뉴 열기',
			close: '메뉴 닫기',
			features: {
				label: '기능',
				groups: {
					organize: {
						title: '정리',
						items: {
							tables: {
								href: '/fonctionnalites/tables-et-champs/',
								title: '테이블과 필드',
								text: '모든 것을 위한 필드, 관계, 프랑스어 수식.',
							},
							views: {
								href: '/fonctionnalites/vues/',
								title: '여덟 가지 보기',
								text: '그리드, 칸반, 캘린더, 타임라인, 갤러리, 목록, 양식, 설문.',
							},
							forms: {
								href: '/fonctionnalites/formulaires-partages/',
								title: '양식',
								text: '공유할 링크 하나: 응답마다 하나의 행이 됩니다.',
							},
							files: {
								href: '/fonctionnalites/fichiers/',
								title: '파일과 이미지',
								text: '견적서, 사진, 계약서를 해당 행과 함께 보관합니다.',
							},
						},
					},
					collaborate: {
						title: '협업',
						items: {
							live: {
								href: '/fonctionnalites/collaboration/',
								title: '실시간과 댓글',
								text: '다른 사람의 작업을 실시간으로 보고, 행에 댓글을 달고, 동료를 멘션합니다.',
							},
							rights: {
								href: '/fonctionnalites/droits/',
								title: '권한과 팀',
								text: '누가 무엇을 보고 무엇을 수정할지, 열 단위까지 정합니다.',
							},
							history: {
								href: '/fonctionnalites/historique/',
								title: '기록',
								text: '모든 수정을 남기고, 되돌릴 수 있습니다.',
							},
							shared: {
								href: '/fonctionnalites/vues-partagees/',
								title: '공유 보기',
								text: '링크 하나로 여는 보기, 내 사이트나 일정 앱에서.',
							},
						},
					},
					automate: {
						title: '자동화와 분석',
						items: {
							automations: {
								href: '/fonctionnalites/automatisations/',
								title: '자동화',
								text: '행이 바뀌면: 알리고, 만들고, 쓰고, AI에게 물어봅니다.',
							},
							dashboards: {
								href: '/fonctionnalites/tableaux-de-bord/',
								title: '대시보드',
								text: '열다섯 가지 시각화, 공통 필터, 공유할 링크.',
							},
							ai: {
								href: '/fonctionnalites/ia/',
								title: 'AI와 Copilot',
								text: '한 문장으로 만드는 데이터베이스, 스스로 채워지는 필드.',
							},
							templates: {
								href: '/modeles/',
								title: '템플릿',
								text: '바로 쓸 수 있는 템플릿 열 개, 필요에 맞게 수정할 수 있습니다.',
							},
						},
					},
				},
				feature: {
					tag: '신규',
					title: '흐름으로 그리는 자동화',
					text: '찾고, 판단하고, AI에게 묻습니다: 그래프 편집기, 그리고 단계별로 다시 확인하는 모든 실행.',
					href: '/nouveautes/',
					cta: '모든 새 소식',
				},
				all: '모든 기능',
			},
			solutions: {
				label: '솔루션',
				title: '모든 팀을 위해',
				items: {
					crm: {
						team: '영업',
						text: '파이프라인, 연락처, 후속 조치.',
					},
					recrutement: {
						team: '인사',
						text: '지원, 면접, AI가 작성한 요약.',
					},
					'calendrier-editorial': {
						team: '마케팅',
						text: '예약된 기사, 게시물, 뉴스레터.',
					},
					inventaire: {
						team: '운영',
						text: '자동으로 계산되는 재고, 미리 알 수 있는 품절.',
					},
					'gestion-projet': {
						team: '프로젝트',
						text: '마일스톤, 작업, 의존 관계.',
					},
					'suivi-tickets': {
						team: '제품',
						text: 'AI가 분류한 버그와 요청.',
					},
					'base-connaissances': {
						team: '고객 지원',
						text: '도움말 문서, 질문, 제안된 답변.',
					},
					evenements: {
						team: '이벤트',
						text: '등록, 남은 자리, 피드백.',
					},
					'analyse-avis': {
						team: '고객 관리',
						text: 'AI가 읽고 분류한 리뷰.',
					},
				},
				ask: {
					title: '다른 게 필요하신가요?',
					text: '필요한 것을 한 문장으로 설명하세요: AI가 맞춤 데이터베이스를 제안합니다.',
					href: '/modeles/',
				},
				all: '모든 템플릿',
			},
			developers: {
				label: '개발자',
				groups: {
					build: {
						title: '연동',
						items: {
							api: {
								href: '/integrations/api-rest/',
								title: 'REST API',
								text: '인터페이스와 같은 데이터를, OpenAPI 3.1로 기술합니다.',
							},
							mcp: {
								href: '/integrations/mcp/',
								title: 'MCP 서버',
								text: 'AI 에이전트를 위한 도구를, 내 권한 안에서 제공합니다.',
							},
							webhooks: {
								href: '/integrations/webhooks/',
								title: '웹훅',
								text: '모든 쓰기를 서명하고, 순서대로 보내고, 실패하면 재시도합니다.',
							},
							sql: {
								href: '/integrations/sql/',
								title: 'SQL 직접 쓰기',
								text: '알아보기 쉬운 이름의 실제 PostgreSQL 테이블.',
							},
							sync: {
								href: '/integrations/synchronisation/',
								title: '동기화',
								text: '다른 곳의 내용을 따라 항상 최신 상태로 유지되는 테이블.',
							},
						},
					},
					host: {
						title: '호스팅',
						items: {
							docker: {
								href: '/hebergement/docker/',
								title: 'Docker Compose',
								text: '이미지 하나, PostgreSQL 데이터베이스 하나, 포트 하나.',
							},
							env: {
								href: '/hebergement/variables/',
								title: '환경 변수',
								text: '모든 설정은 .env 파일 하나에 있습니다.',
							},
							https: {
								href: '/hebergement/https/',
								title: '도메인과 HTTPS',
								text: '직접 두는 프록시 뒤에, 또는 기본 제공되는 Caddy로.',
							},
							sso: {
								href: '/hebergement/connexion/',
								title: '로그인과 SSO',
								text: 'Google, Microsoft, 모든 OpenID Connect 공급자.',
							},
							backup: {
								href: '/hebergement/sauvegardes/',
								title: '백업과 업데이트',
								text: 'pg_dump, 그리고 손실 없는 업데이트.',
							},
						},
					},
				},
				feature: {
					title: '개발자 페이지',
					text: '그리드마다 그 뒤에 진짜 PostgreSQL 테이블이 있습니다.',
					href: '/developpeurs/',
				},
			},
			resources: {
				label: '리소스',
				groups: {
					learn: {
						title: '학습',
						items: {
							docs: {
								href: '/guides/introduction/',
								title: '문서',
								text: 'basedb 전체를, 단계별로.',
							},
							start: {
								href: '/guides/premiers-pas/',
								title: '시작하기',
								text: '첫 데이터베이스, 가져오기부터 보기까지.',
							},
							install: {
								href: '/guides/installation/',
								title: '설치',
								text: '파일 두 개, 명령 하나.',
							},
							principles: {
								href: '/architecture/principes/',
								title: '원칙',
								text: 'basedb가 어떻게, 왜 이렇게 만들어졌는지.',
							},
						},
					},
					follow: {
						title: '프로젝트 소식',
						items: {
							news: {
								href: '/nouveautes/',
								title: '새 소식',
								text: '버전마다 바뀐 내용.',
							},
							roadmap: {
								href: '/feuille-de-route/',
								title: '로드맵',
								text: '다음에 올 것.',
							},
							github: {
								href: 'https://github.com/eodia/basedb',
								title: 'GitHub',
								text: '코드, 이슈, 버전.',
							},
							eodia: {
								href: 'https://eodia.com/',
								title: 'Eodia',
								text: 'basedb를 만든 스튜디오입니다.',
							},
						},
					},
				},
			},
		},
	},
	language: {
		label: '언어',
		current: '언어: {name}',
	},
	footer: {
		tagline: '모든 테이블이 실제 PostgreSQL 테이블인 협업 데이터베이스.',
		madeBy: 'AI 네이티브 소프트웨어 스튜디오 <a class="eodia" href="https://eodia.com/">Eodia</a>가 만든 자유 소프트웨어입니다.',
		columns: {
			product: {
				title: '제품',
				links: [
					{
						href: '/#fonctionnalites',
						label: '기능',
					},
					{
						href: '/nouveautes/',
						label: '새 소식',
					},
					{
						href: '/feuille-de-route/',
						label: '로드맵',
					},
					{
						href: '/#faq',
						label: '자주 묻는 질문',
					},
				],
			},
			docs: {
				title: '문서',
				links: [
					{
						href: '/guides/introduction/',
						label: '소개',
					},
					{
						href: '/guides/installation/',
						label: '설치',
					},
					{
						href: '/integrations/api-rest/',
						label: 'REST API',
					},
					{
						href: '/integrations/mcp/',
						label: 'MCP 서버',
					},
				],
			},
			hosting: {
				title: '호스팅',
				links: [
					{
						href: '/hebergement/docker/',
						label: 'Docker Compose',
					},
					{
						href: '/hebergement/variables/',
						label: '환경 변수',
					},
					{
						href: '/hebergement/https/',
						label: '도메인과 HTTPS',
					},
					{
						href: '/hebergement/sauvegardes/',
						label: '백업',
					},
				],
			},
			project: {
				title: '프로젝트',
				links: [
					{
						href: 'https://github.com/eodia/basedb',
						label: 'GitHub',
					},
					{
						href: 'https://github.com/eodia/basedb/tree/main/docs/architecture',
						label: '아키텍처 문서',
					},
					{
						href: 'https://github.com/eodia/basedb/blob/main/LICENSE',
						label: 'AGPL-3.0 라이선스',
					},
					{
						href: 'https://github.com/eodia/basedb/issues',
						label: '문제 신고',
					},
				],
			},
			eodia: {
				title: 'Eodia',
				links: [
					{
						href: 'https://eodia.com/',
						label: '스튜디오',
					},
					{
						href: 'https://eodia.com/about/',
						label: '회사 소개',
					},
					{
						href: 'https://eodia.com/contact/',
						label: '문의하기',
					},
				],
			},
		},
		copyright: '© {year} <a href="https://eodia.com/">Eodia</a> · AGPL-3.0-or-later',
		builtWith: 'Astro와 Starlight로 만든 사이트입니다.',
	},
	docsFooter: {
		madeBy: 'basedb는 AI 네이티브 소프트웨어 스튜디오 <a href="https://eodia.com/">Eodia</a>가 만든 자유 소프트웨어입니다.',
	},
	teams: {
		meta: {
			title: 'basedb — 모든 업무가 한곳에',
			description: '고객, 프로젝트, 재고, 지원자: 팀 전체가 표, 칸반, 캘린더로 동시에 수정하는 데이터베이스입니다. 대시보드, 자동화, AI까지 갖췄습니다. 코드 없이, 무료 자유 소프트웨어입니다.',
		},
		hero: {
			eyebrow: 'basedb',
			title: '모든 업무.',
			titleAccent: '드디어 한곳에.',
			lead: '표, 캘린더, 양식, 대시보드, 자동화까지 팀 전체가 함께 씁니다. 스프레드시트만큼 쉽고, 코드는 한 줄도 필요 없습니다.',
			primary: '템플릿 둘러보기',
			secondary: '데모 보기',
			facts: ['코드 없이', '무료 자유 소프트웨어', '데이터는 내 서버에'],
		},
		story: {
			grid: {
				title: '팀 전체가 하나의 표에서.',
				text: '누구나 동시에 작업하고, 모두가 항상 최신 상태로 똑같이 봅니다.',
			},
			copilot: {
				title: '물어보세요. Copilot이 처리합니다.',
				text: '“이번 주에 누구에게 다시 연락해야 할까요?” — 알맞은 필터를 제안하고, 클릭 한 번으로 적용합니다.',
			},
			kanban: {
				title: '옮기세요. 바로 반영됩니다.',
				text: '각 단계가 열이 되고, 카드를 옮기면 그 행이 수정됩니다.',
			},
			calendar: {
				title: '모든 날짜가 제자리에.',
				text: '약속은 저절로 표시되고, 내 일정 앱까지 그대로 이어집니다.',
			},
			dashboard: {
				title: '그리고 모든 것을 한눈에.',
				text: '숫자는 같은 행을 바탕으로 스스로 계산됩니다.',
			},
		},
		stage: {
			aria: 'basedb 안에서 본 한 팀의 고객 관리: 표, Copilot, 칸반, 캘린더, 대시보드',
			tabs: {
				grid: '표',
				copilot: 'Copilot',
				kanban: '칸반',
				calendar: '캘린더',
				dashboard: '대시보드',
			},
			project: '메인 프로젝트',
			projectMeta: '프로젝트 · 데이터베이스 2개',
			filterNav: '탐색 메뉴 필터링',
			base: '영업',
			otherBase: '고객 지원',
			tables: ['고객', '연락처', '견적'],
			baseSection: '데이터베이스 · 영업',
			screens: ['대시보드', '자동화'],
			user: 'Léa Martin',
			views: {
				grid: '모든 행',
				kanban: '단계별',
				calendar: '미팅',
			},
			toolbar: {
				filter: '필터',
				columns: '열',
				group: '그룹화',
				colors: '색상',
				sort: '정렬',
				configure: '구성',
			},
			search: '검색…',
			add: '추가',
			columns: {
				name: '고객',
				status: '단계',
				owner: '담당자',
				amount: '금액',
				next: '다음 미팅',
			},
			statuses: {
				contact: '연락 예정',
				meeting: '미팅',
				quote: '견적 발송',
				signed: '계약 완료',
			},
			clients: ['마루 베이커리', '보리수 의원', '한울고등학교', '나눔자전거', '고운 식료품점', '강변 단조', '모루 공방'],
			addRow: '행 추가',
			perPage: '페이지당 행 수',
			card: '{owner} 담당, {date} 미팅',
			addCard: '카드 추가',
			today: '오늘',
			month: '월',
			week: '주',
			dashboards: '대시보드',
			questions: '질문',
			dashboard: '영업 관리',
			dashboardText: '핵심을 한눈에.',
			dashboardTabs: ['개요', '활동'],
			period: '기간',
			thisYear: '올해',
			share: '공유',
			edit: '편집',
			explore: '데이터 탐색',
			chart: '고객별 금액',
			byStage: '단계별 고객',
			kpis: {
				signed: '계약 완료',
				pending: '대기 중인 견적',
				rate: '계약 고객',
			},
			copilot: {
				question: '이번 주에 누구에게 다시 연락해야 할까요?',
				thinking: '생각 중…',
				answer: '답변을 기다리는 고객이 네 명 있습니다: 견적 발송 두 건, 준비할 미팅 두 건.',
				card: '고객 필터링',
				filter: '단계: 견적 발송 또는 미팅',
				apply: '필터 적용',
				applied: '필터 적용됨',
				placeholder: 'Copilot에게 물어보세요…',
				filtered: '{n}개 행 필터링됨',
			},
		},
		video: {
			eyebrow: '데모',
			title: 'basedb의 모든 것,',
			titleAccent: '4분 만에.',
			text: '데이터베이스 만들기, 채우기, 공유, 자동화, 운영까지: 전체 과정을 해설과 함께 보여 드립니다.',
			play: '영상 재생',
			duration: '4분 35초',
			chapters: '챕터',
			captions: '프랑스어',
			inFrench: '이 영상은 프랑스어로 되어 있으며, 프랑스어 자막이 제공됩니다.',
			list: [
				{ time: '0:08', title: '데이터베이스 만들기' },
				{ time: '0:35', title: '테이블, 필드, 수식' },
				{ time: '1:10', title: '행 세부 정보와 협업' },
				{ time: '1:33', title: '같은 행을 보는 여덟 가지 보기' },
				{ time: '2:01', title: '양식과 AI' },
				{ time: '2:37', title: '자동화' },
				{ time: '2:59', title: '대시보드' },
				{ time: '3:15', title: '모두를 위한 SQL' },
				{ time: '3:43', title: '기록과 권한' },
				{ time: '4:01', title: 'API, MCP, Copilot' },
			],
		},
		together: {
			eyebrow: '협업',
			title: '모두가.',
			titleAccent: '동시에.',
			text: '다른 사람의 수정 내용이 실시간으로 반영됩니다. 누가 어느 행을 보고 있는지 보이고, 그 행에서 바로 이야기를 나누며, @ 하나로 동료에게 알릴 수 있습니다.',
			demo: {
				path: '영업 / 견적',
				here: '이 테이블에 3명 접속 중',
				columns: {
					client: '고객',
					status: '단계',
					amount: '금액',
					due: '마감일',
				},
				statuses: {
					draft: '초안',
					sent: '발송',
					signed: '계약 완료',
				},
				rows: ['마루 베이커리', '보리수 의원', '한울고등학교', '나눔자전거', '고운 식료품점', '강변 단조'],
				comment: '@{name} 오늘 저녁 전까지 이 견적 확인해 줄 수 있어요?',
				reply: '확인했어요!',
				toast: '{name} 님이 “{field}”을 수정했습니다',
			},
			points: {
				live: {
					title: '실시간',
					text: '모든 수정이 페이지를 새로 고치지 않아도 다른 사람에게 바로 나타납니다.',
				},
				comments: {
					title: '댓글과 멘션',
					text: '행에 댓글을 달고 @로 동료를 멘션하면, 종 아이콘이 알려 줍니다.',
				},
				undo: {
					title: '안전하게 실행 취소',
					text: 'Ctrl+Z는 내 마지막 수정만 취소하며, 동료의 수정은 절대 건드리지 않습니다.',
				},
			},
			link: {
				href: '/fonctionnalites/collaboration/',
				label: '함께 작업하기',
			},
		},
		automate: {
			eyebrow: '자동화',
			title: '자동화가 일합니다',
			titleAccent: '당신이 잠든 사이에도.',
			text: '한 번만 설명하면 됩니다. 행이 바뀔 때, 매일 정해진 시각에, 또는 버튼 클릭 한 번으로, basedb가 단계를 이어서 진행합니다 — 그리고 모든 실행은 단계별로 다시 확인할 수 있습니다.',
			clock: '03:12',
			when: '언제',
			trigger: '견적이 “계약 완료”로 바뀌면',
			steps: {
				find: {
					kind: '행 찾기',
					text: '견적의 고객',
				},
				ai: {
					kind: 'AI에게 질문',
					text: '감사 메시지 작성',
				},
				create: {
					kind: '행 생성',
					text: '청구서, “청구서” 테이블에',
				},
				notify: {
					kind: '알림 보내기',
					text: '회계팀',
				},
				slack: {
					kind: 'Slack으로 보내기',
					text: '#영업 채널로',
				},
			},
			answer: '믿고 맡겨 주셔서 감사합니다! 월요일부터 바로 프로젝트를 시작하며, 청구서는 이메일로 보내드립니다.',
			done: '성공 · 5단계 · 1.2초',
			copilot: {
				prompt: '견적이 “계약 완료”가 되면 회계팀에 알리고 청구서를 만들어 주세요.',
				text: 'Copilot에게 한 문장만 건네면 자동화가 만들어집니다: 남은 일은 검토뿐입니다.',
			},
			link: {
				href: '/fonctionnalites/automatisations/',
				label: '자동화',
			},
		},
		glance: {
			eyebrow: '대시보드',
			title: '모두 보세요.',
			titleAccent: '한눈에.',
			text: '숫자, 그래프, 목표: 대시보드는 마우스로 테이블에서 바로 만들고, 스스로 최신 상태를 유지합니다. 필터 하나면 전체 대시보드가 함께 움직입니다.',
			demo: {
				title: '영업 현황',
				filters: ['올해', '모든 도시'],
				revenue: '매출',
				signed: '계약 완료된 견적',
				rate: '계약 성사율',
				goal: '연간 목표',
				byMonth: '월별 매출',
				byStage: '단계별 견적',
				stages: ['발송', '협상 중', '계약 완료'],
				bySector: '업종별 고객',
				sectors: ['유통', '의료', '교육', '제조업'],
				shared: '링크로 공유',
			},
			points: {
				viz: {
					title: '열다섯 가지 시각화',
					text: '숫자, 추세, 진행률, 선, 원형, 깔때기, 피벗 테이블, 지도.',
				},
				filters: {
					title: '공통 필터',
					text: '기간, 고객, 도시: 필터 하나로 카드 하나, 여러 개, 또는 전체 대시보드를 제어합니다.',
				},
				share: {
					title: '링크로 공유',
					text: '공개하거나 팀에게만 열 수 있고, 다른 사이트에 삽입할 수 있습니다.',
				},
			},
			link: {
				href: '/fonctionnalites/tableaux-de-bord/',
				label: '대시보드',
			},
		},
		ai: {
			eyebrow: 'AI',
			title: '설명하세요.',
			titleAccent: 'basedb가 만듭니다.',
			text: '한 문장이면 완전한 데이터베이스를 만들 수 있고, 만들기 전에 미리 검토합니다. 그다음 Copilot이 필터, 그래프, 자동화를 제안하고, AI 필드가 대신 요약하고 분류하고 작성합니다.',
			prompt: '현재 채용 중인 세 자리의 지원자 관리, 면접까지 포함.',
			thinking: '연결된 테이블 세 개, 검토 준비 완료.',
			tables: {
				jobs: {
					name: '채용 공고',
					fields: ['공고명', '부서', '공개일'],
				},
				people: {
					name: '지원자',
					fields: ['이름', '지원 공고', '단계', '요약'],
				},
				talks: {
					name: '면접',
					fields: ['지원자', '날짜', '면접관', '평가'],
				},
			},
			aiField: '요약',
			aiValue: '프로젝트 관리 경력 6년, 고객 대응에 능숙함; 확인이 필요한 부분: 영어 실력.',
			create: '데이터베이스 만들기',
			providers: 'OpenAI, Anthropic, Mistral, 또는 직접 운영하는 서버의 모델 중에서 원하는 공급자를 선택하세요. 동의 없이는 아무것도 전송되지 않습니다.',
			link: {
				href: '/fonctionnalites/ia/',
				label: 'basedb 안의 AI',
			},
		},
		features: {
			title: '필요한 모든 것.',
			titleAccent: '그리고 그 이상.',
			text: '모든 기능은 같은 테이블에, 같은 권한으로, 같은 기록에 씁니다.',
			tiles: {
				views: {
					stat: '8',
					title: '가지 방법으로 보는 데이터',
					text: '그리드, 칸반, 캘린더, 타임라인, 갤러리, 목록, 양식, 설문, 모두 같은 행 위에서. 각자 자신에게 맞는 것을 고릅니다.',
					href: '/fonctionnalites/vues/',
				},
				history: {
					stat: 'Ctrl+Z',
					title: '아무것도 사라지지 않습니다',
					text: '모든 수정은 이전 값과 함께 남습니다. 실수는 취소할 수 있고, 삭제한 행은 복원할 수 있습니다.',
					href: '/fonctionnalites/historique/',
				},
				forms: {
					title: '양식',
					text: '공개 링크 또는 팀 전용 링크: 응답은 테이블로 들어오고, 나머지는 열리지 않습니다.',
					href: '/fonctionnalites/formulaires-partages/',
				},
				viz: {
					stat: '15',
					title: '가지 시각화',
					text: '숫자, 추세, 목표, 그래프, 업종별 비율, 깔때기, 피벗 테이블, 지도.',
					href: '/fonctionnalites/tableaux-de-bord/',
				},
				formulas: {
					code: 'SI([Montant] > 10000; "Grand compte"; "")',
					title: '프랑스어 수식',
					text: '스프레드시트처럼 — SI, ARRONDI, JOURS… — 그러나 팀 전체를 위해 계산됩니다.',
					href: '/fonctionnalites/tables-et-champs/#수식',
				},
				rights: {
					title: '각자 자신이 봐야 할 것만 봅니다',
					text: '읽기, 편집, 관리를 팀마다 설정하고, 민감한 열은 숨길 수 있습니다.',
					href: '/fonctionnalites/droits/',
				},
				mentions: {
					bubble: '@Camille',
					title: '댓글과 멘션',
					text: '행에 대한 이야기는 그 행에서 나누고, 종 아이콘이 알려 줍니다.',
					href: '/fonctionnalites/collaboration/',
				},
				relations: {
					title: '모든 것이 연결되어 있습니다',
					text: '고객, 프로젝트, 청구서: 합계와 조회가 관계를 따라 이어집니다.',
					href: '/fonctionnalites/tables-et-champs/',
				},
				templates: {
					stat: '10',
					title: '개 준비된 템플릿',
					text: 'CRM, 채용, 재고, 이벤트… 또는 AI에게 한 문장으로 설명해 만드는 데이터베이스.',
					href: '/modeles/',
				},
				import: {
					title: '한 번에 가져오기',
					text: 'CSV 파일을 끌어다 놓으세요: 열과 타입을 추측해 테이블이 만들어집니다.',
					href: '/guides/premiers-pas/',
				},
				agenda: {
					title: '내 일정 앱에서도',
					text: '캘린더가 Google 캘린더, Outlook, Apple Calendar용 피드가 됩니다.',
					href: '/fonctionnalites/vues-partagees/',
				},
				files: {
					title: '파일과 이미지',
					text: '견적서, 사진, 계약서; 이미지는 카드의 표지가 됩니다.',
					href: '/fonctionnalites/fichiers/',
				},
				share: {
					title: '공유 보기',
					text: '링크로 여는 읽기 전용 보기, 내 사이트에 삽입할 수 있습니다.',
					href: '/fonctionnalites/vues-partagees/',
				},
				sync: {
					title: '동기화된 테이블',
					text: '온라인 CSV, 일정, 또는 다른 basedb를 따라 항상 최신 상태로 유지됩니다.',
					href: '/integrations/synchronisation/',
				},
				signin: {
					title: '간단한 로그인',
					text: 'Google, Microsoft 또는 비밀번호로 로그인하고, 동료를 링크로 초대합니다.',
					href: '/hebergement/connexion/',
				},
				languages: {
					title: '내 언어로',
					text: '인터페이스는 20개 언어 중 각자의 언어를 따릅니다.',
					href: '/fonctionnalites/droits/#내-설정',
				},
			},
		},
		yours: {
			eyebrow: '자유, 자체 호스팅',
			per: '1인당. 영원히.',
			text: 'basedb는 자유 소프트웨어입니다. 내 서버에 설치하고 팀 전체를 초대하세요: 구독료도 없고 인원수를 셀 필요도 없으며, 데이터는 내 서버에 그대로 남습니다.',
			points: {
				home: {
					title: '내 서버에',
					text: '내 서버 또는 호스팅 업체의 서버에서, 다른 PostgreSQL 데이터베이스처럼 백업합니다.',
				},
				free: {
					title: '자유',
					text: 'AGPL-3.0 라이선스: 코드는 공개되어 있으며, 앞으로도 그럴 것입니다.',
				},
				ai: {
					title: '원하는 AI',
					text: '시중의 공급자, 직접 설치한 모델 — 또는 AI를 전혀 쓰지 않는 선택.',
				},
			},
			link: {
				href: '/guides/installation/',
				label: 'basedb 설치',
			},
		},
		gallery: {
			eyebrow: '템플릿',
			title: '1분이면 준비됩니다.',
			text: '테이블, 보기, 대시보드, 예시 행까지 갖춘 템플릿으로 시작해서, 내 방식에 맞게 바꿔 보세요.',
			use: '둘러보기',
			ask: {
				title: '맞는 게 없나요?',
				text: '필요한 것을 한 문장으로 설명하세요: AI가 맞춤 데이터베이스를 제안합니다.',
			},
			all: '모든 템플릿 보기',
			previous: '이전 템플릿',
			next: '다음 템플릿',
		},
		developers: {
			title: '기술적인 부분은요?',
			text: '모든 테이블은 실제 PostgreSQL 테이블입니다. REST API, 웹훅, AI 에이전트를 위한 MCP 서버, 그리고 명령 하나로 끝나는 설치까지 갖췄습니다.',
			link: '개발자 페이지',
		},
		faq: {
			title: '자주 묻는 질문',
			items: [
				{
					q: '코딩을 할 줄 알아야 하나요?',
					a: '아니요. 테이블, 보기, 양식, 대시보드, 자동화를 모두 마우스로 만듭니다. 수식은 스프레드시트처럼 작성하며, 함수 이름은 프랑스어입니다: SI, ARRONDI, JOURS…',
				},
				{
					q: '비용은 얼마인가요?',
					a: '무료입니다. basedb는 자유 소프트웨어로, 구독료도 사용자당 요금도 없습니다. 설치할 서버만 있으면 됩니다.',
				},
				{
					q: '어떻게 설치하나요?',
					a: '서버에 Docker로 설치합니다. 파일 두 개와 명령 하나면 되며, IT를 담당하는 사람이라면 몇 분이면 끝납니다. 설치 가이드가 모든 과정을 단계별로 설명합니다.',
				},
				{
					q: '지금 쓰는 스프레드시트를 가져올 수 있나요?',
					a: '네. 시트를 CSV로 저장해 basedb로 끌어다 놓으세요. 가져오기가 각 열의 타입을 추측하고, 테이블을 만들고, 가져오지 못한 내용을 행마다 알려 줍니다.',
				},
				{
					q: '여러 명이 동시에 작업할 수 있나요?',
					a: '바로 그걸 위해 만들었습니다. 다른 사람의 수정 내용이 실시간으로 표시되고, 행에 댓글을 달고, @로 동료를 멘션하면 종 아이콘이 알려 줍니다.',
				},
				{
					q: 'AI가 우리 데이터를 읽나요?',
					a: '직접 결정한 경우에만 읽습니다. AI 공급자를 설정하지 않으면 아무것도 전송되지 않습니다. 설정한 뒤에도 AI를 쓰는 필드나 자동화는 동의를 받은 뒤, 지시문이 인용하는 내용만 보냅니다.',
				},
				{
					q: '어떤 언어로 쓸 수 있나요?',
					a: '여러분의 언어로 쓸 수 있습니다. 인터페이스는 20개 언어 중 브라우저 언어를 따르며, 각자 설정에서 바꿀 수 있습니다.',
				},
			],
		},
		cta: {
			title: '당신의 팀에게는',
			titleAccent: '공유 파일보다 나은 방법이 필요합니다.',
			text: '템플릿으로 시작해서 동료를 초대하고, “최종 (2)”는 이제 뒤에 남겨 두세요.',
			primary: '템플릿 둘러보기',
			secondary: 'basedb 설치',
		},
	},
	hero: {
		badge: '신규: 흐름형 자동화, 대시보드, SQL 뷰',
		title: ['협업 데이터베이스,', '모든 테이블이', '실제'],
		titleAccent: 'PostgreSQL 테이블.',
		lead: '공유 스프레드시트처럼 간단하게 — 그리드, 보기, 양식, 권한 — 그러면서 데이터는 <strong>타입이 지정되고 알아보기 쉬운 이름의</strong> 테이블에 저장됩니다. 팀은 인터페이스에서 일하고, 스크립트, BI 도구, AI 에이전트, <code>psql</code>은 같은 행을 읽습니다.',
		install: 'Docker로 설치',
		features: '기능 보기',
		copy: '명령 복사',
		facts: ['자체 호스팅', 'AGPL-3.0', 'REST API & MCP 서버'],
		demo: {
			url: 'basedb.your-domain.kr',
			project: '메인 프로젝트',
			projectMeta: '프로젝트 · 데이터베이스 2개',
			filter: '데이터베이스 및 테이블 필터링',
			sales: '영업',
			support: '고객 지원',
			environment: '운영',
			clients: '고객',
			opportunities: '영업 기회',
			quotes: '견적',
			baseSection: '데이터베이스 · 영업',
			screens: ['대시보드', '자동화'],
			copilot: '✦ Copilot',
			allRows: '▦ 모든 행 ▾',
			tools: ['필터', '그룹화', '색상'],
			search: '검색…',
			add: '+ 추가',
			columns: {
				name: '이름',
				status: '상태',
				amount: '금액',
				client: '고객',
			},
			statuses: {
				nouveau: '신규',
				qualifie: '적격',
				proposition: '제안',
				negociation: '협상',
				gagne: '수주',
				perdu: '실주',
			},
			deals: {
				portail: {
					name: '포털 개편',
					client: '가람시청',
				},
				erp: {
					name: 'ERP 마이그레이션',
					client: '도담 그룹',
				},
				audit: {
					name: '보안 감사',
					client: '새봄 의원',
				},
				billetterie: {
					name: '온라인 예매',
					client: '둥근마당 극장',
				},
				flotte: {
					name: '차량 관제',
					client: '한결 운수',
				},
				mobile: {
					name: '모바일 앱',
					client: '모루 공방',
				},
				intranet: {
					name: '인트라넷 개편',
					client: '',
				},
			},
			toastTitle: '양식 “견적 요청”',
			toastText: '공개 응답 · “{name}” 생성됨',
			cursor: '서연',
			psqlRows: '(2개 행)',
		},
	},
	showcase: {
		label: '실제 인터페이스',
		title: '팀이 공유 스프레드시트에 기대하는 모든 것.',
		tabs: '인터페이스 스크린샷',
		alt: 'basedb — {labelLower}: {caption}',
		shots: {
			grille: {
				label: '그리드',
				caption: '실제 테이블에 쓰는 그리드와 계산 필드: 수식으로 구한 기간, 조회로 가져온 고객의 도시, 개수로 센 작업 수.',
			},
			kanban: {
				label: '칸반',
				caption: '같은 행을 단일 선택 값에 따라 열로 나눕니다: 커버 이미지와 행을 인용하는 설명. 카드를 옮기면 행이 수정됩니다.',
			},
			galerie: {
				label: '갤러리',
				caption: '이미지가 있는 카드, 상태별 색상: 갤러리는 테이블을 읽는 여덟 가지 방법 중 하나입니다.',
			},
			chronologie: {
				label: '타임라인',
				caption: '두 날짜 사이의 막대와 의존 관계를 잇는 화살표 — 순서가 어긋나면 빨간색으로 바뀝니다.',
			},
			tableaux: {
				label: '대시보드',
				caption: '공통 필터 아래 그리드와 탭으로 배치한 카드: 추세, 목표, 누적 계열 — 모두 각자의 권한으로 읽습니다.',
			},
			automatisations: {
				label: '자동화',
				caption: '작업이 완료되면 프로젝트에 남은 작업을 찾고, 남은 것이 없으면 AI가 마무리 메시지를 작성하고 프로젝트가 “Livré”로 바뀝니다. 모든 실행은 흐름 위에서 단계별로 확인할 수 있습니다.',
			},
			commentaires: {
				label: '댓글',
				caption: '행에 대한 이야기는 그 행에서 나눕니다: 댓글, 멘션, 알림.',
			},
			formulaire: {
				label: '양식',
				caption: '양식은 링크로 공유합니다. 공개하거나 로그인한 멤버에게만 열 수 있습니다.',
			},
			historique: {
				label: '기록',
				caption: '사람, 자동화, SQL 직접 쓰기 등 출처와 관계없이 모든 쓰기를 이전 값과 함께 남깁니다.',
			},
			sql: {
				label: 'SQL',
				caption: '실제 이름으로 작성해 테이블 아래에 팀 전체를 위해 저장한 쿼리 — 각자 자신의 권한으로 실행합니다.',
			},
			vuesSql: {
				label: 'SQL 뷰',
				caption: '색상과 아이콘을 달고 테이블 사이에 놓인 실제 PostgreSQL 뷰 — psql에서도 읽을 수 있습니다.',
			},
		},
	},
	features: {
		postgres: {
			label: '번역 없는 PostgreSQL',
			title: '팀에는 그리드를, {도구에는 실제 테이블을.}',
			lead: '범용 모델도, 무엇이든 담아 두는 JSON도, <code>field_1837</code>도 없습니다. 데이터베이스는 스키마이고, 테이블은 테이블이며, 필드는 알아보기 쉬운 이름이 붙은 타입 있는 열입니다.',
			bullets: [
				'<strong>네이티브 타입</strong>: <code>text</code>, <code>numeric</code>, <code>date</code>, <code>timestamptz</code>, <code>boolean</code> — 그리고 관계에는 실제 외래 키.',
				'<strong>데이터베이스가 지키는 제약 조건</strong>: 단일 선택은 <code>CHECK</code>로, 웹 주소와 이메일은 검증을 거쳐, 관계는 <code>FOREIGN KEY</code>로.',
				'<strong>PostgreSQL이 계산하는 수식</strong>: <code>JOURS([Fin]; [Début])</code>는 생성 열이 되고, <code>psql</code>은 이를 다른 열처럼 읽습니다.',
				'<strong>SQL 직접 쓰기도 허용됩니다</strong> — 그마저도 트리거가 기록에 남깁니다.',
				'<strong>인터페이스 안의 SQL 쿼리와 뷰</strong>: 나만 또는 팀을 위해 테이블 아래에 저장하는 쿼리, 그리고 테이블 사이에 놓이는 실제 PostgreSQL 뷰. <code>psql</code>에서도 읽을 수 있습니다.',
				'<strong>이름을 바꿔도 깨지지 않습니다</strong>: 쿼리를 옮기는 동안 호환성 별칭이 이전 이름을 계속 제공합니다.',
			],
			links: [
				{
					href: '/integrations/sql/',
					label: 'SQL로 작업하기',
				},
				{
					href: '/fonctionnalites/requetes-et-vues-sql/',
					label: 'SQL 쿼리와 뷰',
				},
				{
					href: '/architecture/principes/',
					label: '원칙',
				},
			],
		},
		automations: {
			label: '자동화',
			title: '흐름으로 그리는 자동화, {모든 단계에 AI를.}',
			lead: '행이 바뀔 때, 정해진 시각에, 또는 클릭 한 번으로. 그래프 편집기가 단계를 이어 주고, 모든 실행은 흐름 위에서 다시 확인할 수 있습니다.',
			bullets: [
				'<strong>한눈에 읽히는 흐름</strong>: 트리거, 그리고 카드로 표시되는 각 단계. 선 위의 <strong>+</strong>를 누르면 그 위치에 단계가 추가됩니다.',
				'<strong>찾고, 판단하고, 씁니다</strong>: 행을 찾고, 조건에 따라 이 분기나 저 분기로 가고, 수정하고, 만들고, 알리고, 웹훅을 호출하고, Slack에 글을 올립니다.',
				'단계 안에서 <strong>AI에게 질문</strong>: 행을 인용하는 지시문을 보내고, 응답을 텍스트, 숫자, 날짜 또는 선택 값으로 읽어 다음 단계에서 다시 사용합니다.',
				'<strong>Copilot</strong>은 문장 하나로 자동화 전체를 제안하거나, 실행이 실패한 이유를 설명합니다 — 직접 저장하기 전에는 아무것도 저장되지 않습니다.',
				'<strong>작성한 사람의 권한으로</strong> 동작하며, 다른 모든 쓰기처럼 기록에 남습니다.',
			],
			links: [
				{
					href: '/fonctionnalites/automatisations/',
					label: '자동화',
				},
				{
					href: '/fonctionnalites/automatisations/#copilot',
					label: 'Copilot',
				},
			],
			alt: 'basedb — 흐름 편집기에 열린 “Projet livré” 자동화: 작업이 완료되면 시각을 기록하고, 프로젝트에 남은 작업을 찾은 뒤 “그 외” 분기로 가서 AI에게 마무리 메시지를 요청하고 프로젝트를 전달합니다. 오른쪽에는 최근 실행이 단계별로 표시됩니다.',
		},
		dashboards: {
			label: '분석',
			title: '{테이블을 벗어나지 않는} 대시보드.',
			lead: '마우스나 SQL로 만드는 질문, 열다섯 가지 시각화, 공통 필터 — 모두 각자 자신의 권한으로 읽습니다.',
			bullets: [
				'<strong>질문</strong>: 테이블과 그 조인, 필터, 그리고 일, 주, 월, 연도별 측정값 — 또는 읽기 전용 SQL.',
				'<strong>열다섯 가지 시각화</strong>: 숫자, 추세, 진행률, 게이지, 막대, 선, 원형, 깔때기, 피벗 테이블, 지도…',
				'<strong>클릭 한 번으로 탐색</strong>: 지점을 누르면 그 행이나 더 세밀한 기간이 열립니다.',
				'<strong>공통 필터</strong>로 카드 하나, 여러 개, 또는 전체를 제어합니다.',
				'<strong>링크로 공유</strong>: 공개하거나 멤버에게만 열고, 다른 사이트에 삽입할 수 있습니다.',
			],
			links: [
				{
					href: '/fonctionnalites/tableaux-de-bord/',
					label: '대시보드',
				},
			],
			alt: 'basedb — 대시보드: 이달의 추세, 수금 목표, 월별 매출, 리뷰 감정. 위쪽에 기간 필터와 고객 필터가 있습니다.',
		},
		rights: {
			label: '모두에게 열지 않고 협업하기',
			title: '필드 단위의 권한, {빈틈없는 기록.}',
			lead: '권한은 프로젝트, 데이터베이스, 테이블에 대해 그룹에 부여하며, 그 아래의 모든 항목에 적용됩니다. 민감한 열은 특정 그룹에 숨기거나, 그 그룹이 수정할 수 없게 할 수 있습니다.',
			bullets: [
				'<strong>네 가지 수준</strong>: 액세스 권한 없음, 읽기, 편집, 관리 — 그룹 간에 합산됩니다.',
				'<strong>SQL도 권한을 따릅니다</strong>: 인터페이스에서 쿼리는 내게 열린 테이블과 필드만 봅니다 — 이를 적용하는 것은 PostgreSQL입니다.',
				'<strong>모든 쓰기를 같은 트랜잭션 안에서 기록합니다</strong>: 인터페이스, API, 에이전트, 공개 양식, SQL 직접 쓰기 모두.',
				'<strong>수정은 되돌릴 수 있고</strong>, 삭제한 행도, 삭제한 데이터베이스도 복원할 수 있습니다.',
				'<strong>관리 작업은 재확인을 거칩니다</strong>: 권한을 바꾸려면 최근 5분 이내에 비밀번호를 다시 입력해야 합니다.',
			],
			links: [
				{
					href: '/fonctionnalites/droits/',
					label: '권한과 그룹',
				},
				{
					href: '/fonctionnalites/historique/',
					label: '기록',
				},
			],
		},
		agents: {
			label: 'REST API · MCP · 웹훅',
			title: 'AI 에이전트에게 데이터는 열어 주되, {마스터키는 주지 않습니다.}',
			lead: 'MCP 서버는 에이전트에게 열두 가지 도구를, REST API는 프로그램에 같은 데이터를 제공합니다. 권한을 확인하는 지점은 하나, 로그도 같습니다.',
			bullets: [
				'<strong>데이터베이스마다 토큰 하나</strong>: 기본은 읽기 전용이며, 만든 사람보다 더 많은 권한을 갖지 않습니다.',
				'<strong>에이전트는 아무것도 삭제하지 않고</strong> 스키마도 바꾸지 않습니다. 변경을 제안하면 사람이 승인합니다.',
				'<strong>자동 생성 문서</strong>: 데이터베이스마다 내 권한으로 걸러지며, OpenAPI 3.1 명세가 함께 제공됩니다.',
				'<strong>웹훅</strong>: 모든 쓰기마다 서명하고, 순서대로 보내고, 실패하면 재시도합니다.',
			],
			links: [
				{
					href: '/integrations/mcp/',
					label: '에이전트 연결하기',
				},
				{
					href: '/integrations/api-rest/',
					label: 'REST API',
				},
			],
		},
	},
	sqlVisual: {
		interface: '인터페이스',
		title: '새 필드 · 영업 기회',
		labelField: '레이블',
		labelValue: '금액',
		typeField: '유형',
		typeValue: '숫자',
		descriptionField: '설명',
		descriptionValue: '계약 금액(부가세 별도)',
		required: '필수',
		ai: 'AI',
		migration: '계획된 마이그레이션, 짧은 잠금',
	},
	rightsVisual: {
		groups: ['관리자', '영업팀', '지원팀'],
		project: '메인 프로젝트',
		sales: '영업',
		opportunities: '영업 기회',
		clients: '고객',
		support: '고객 지원',
		inherited: '상속됨',
		levels: {
			none: '액세스 권한 없음',
			read: '읽기',
			edit: '편집',
			manage: '관리',
		},
		field: '“마진” 필드',
		hidden: '숨김',
		sqlChange: '<b>직접 SQL 세션</b>이 <b>“ERP 마이그레이션”</b>을 수정했습니다',
		sqlMeta: '02:46 · 로컬 연결 · psql',
		sqlDiff: '금액: <s>125,000</s> → 130,000',
		undo: '↶ 실행 취소',
		formChange: '<b>양식 “견적 요청”</b>이 <b>“인트라넷 개편”</b>을 만들었습니다',
		formMeta: '공개 응답 · 서연 님이 게시',
	},
	agentVisual: {
		agent: '에이전트',
		via: 'MCP로 연결 · “영업” 토큰',
		question: '협상 중인 영업 기회는 몇 건이고, 금액은 얼마인가요?',
		listArgs: 'opportunites · statut = 협상',
		answer: '2건, 총 <b>182,000유로</b>입니다: ERP 마이그레이션(130,000유로)과 차량 관제(52,000유로).',
		request: '“확률” 필드를 백분율로 추가해 줘.',
		proposeArgs: 'opportunites · 확률 · number',
		proposed: '제안했습니다. 팀원이 basedb에서 승인해야 적용됩니다.',
		badge: '제안',
		expires: '23시간 후 만료',
		what: '<b>영업 기회</b>에 <b>“확률”</b> 필드(숫자) 추가',
		by: '에이전트가 제안 · “영업” 토큰',
		refuse: '거부',
		approve: '승인',
	},
	bento: {
		label: '그 밖의 모든 것',
		title: '팀 도구에 기대하는 기능은 모두, PostgreSQL은 그대로.',
		text: '모든 기능은 같은 권한 아래 같은 테이블에 쓰고, 같은 기록에 남깁니다.',
		more: '자세히 보기 →',
		views: {
			title: '같은 행을 여덟 가지 보기로',
			text: '팀 전체를 위한 협업 보기, 나만을 위한 개인 보기: 각자 읽는 방식을 고르고, 데이터는 아무도 복사하지 않습니다.',
			chips: ['그리드', '칸반', '캘린더', '타임라인', '갤러리', '목록', '양식', '설문'],
		},
		forms: {
			title: '공유 양식',
			text: '공개 링크, 또는 로그인한 멤버 전용 링크. 응답한다고 해서 테이블에 대한 권한이 생기지는 않습니다.',
			href: '/fonctionnalites/formulaires-partages/',
		},
		environments: {
			title: '환경',
			text: '하나의 데이터베이스, 여러 버전. 스키마를 비교하고, 환경 간에 마이그레이션하고, 행을 동기화합니다.',
			chips: ['운영', '스테이징', '개발'],
			href: '/fonctionnalites/environnements/',
		},
		collaboration: {
			title: '함께 작업하기',
			text: '다른 사람의 쓰기가 실시간으로 반영되고, 누가 어느 행을 보고 있는지 보이며, 행에 대한 이야기는 그 행에서 나눕니다: 댓글, 멘션, 알림. Ctrl+Z는 마지막 쓰기를 실행 취소하며, 다른 사람의 작업을 덮어쓰느니 거부합니다.',
			chips: ['실시간', '접속 현황', '댓글', '멘션', 'Ctrl+Z'],
			href: '/fonctionnalites/collaboration/',
		},
		small: {
			ai: {
				title: '그리드 안의 AI',
				text: '다른 열을 바탕으로 모델이 채우는 필드, 그리고 필터, 쿼리, 열을 제안해 클릭 한 번으로 적용하는 Copilot. OpenAI, Anthropic, Mistral, 또는 직접 운영하는 서버의 모델을 사용합니다.',
				code: '{{Notes}} 내용을 한 문장으로 요약하세요',
				href: '/fonctionnalites/ia/',
			},
			formulas: {
				title: '관계와 수식',
				text: '실제 외래 키, PostgreSQL이 계산하는 프랑스어 수식, 그리고 관계를 거치는 조회, 롤업, 개수.',
				code: 'ARRONDI([Montant HT] * (1 + [Taux de TVA]); 2)',
				href: '/fonctionnalites/tables-et-champs/#수식',
			},
			richText: {
				title: '서식 있는 텍스트와 변수',
				text: '서식 있는 텍스트를 위한 비주얼 편집기는 쓸 때 내용을 정제합니다. 그리고 모든 긴 텍스트에서 {{Ville}}은 그 행의 값으로 읽힙니다.',
				code: '{{Ville}} 배송 예정일: {{Date}}',
				href: '/fonctionnalites/tables-et-champs/#서식-있는-텍스트와-변수',
			},
			languages: {
				title: '내 언어로',
				text: '인터페이스는 브라우저 언어를 따르며, 20개 언어 중에서 각자 설정에서 바꿀 수 있습니다.',
				href: '/fonctionnalites/droits/#내-설정',
			},
			sharedViews: {
				title: '공유 보기',
				text: '링크로 여는 읽기 전용 보기는 다른 사이트에 삽입할 수 있습니다. 캘린더는 일정 앱에서 구독하는 피드가 됩니다.',
				href: '/fonctionnalites/vues-partagees/',
			},
			syncedTables: {
				title: '동기화된 테이블',
				text: '온라인 CSV, 일정, 또는 다른 basedb의 공유 보기를 따라 항상 최신 상태로 유지되는 테이블.',
				href: '/integrations/synchronisation/',
			},
			templates: {
				title: '데이터베이스 템플릿',
				text: '바로 쓸 수 있는 템플릿 10개, 한 문장으로 AI에게 설명해 만드는 데이터베이스, 그리고 템플릿으로 저장하는 내 데이터베이스.',
				href: '/modeles/',
			},
			files: {
				title: '파일과 이미지',
				text: '호스트의 디스크 또는 S3 호환 스토리지: AWS, Scaleway, OVH, Cloudflare R2, Garage, MinIO…',
				href: '/fonctionnalites/fichiers/',
			},
			import: {
				title: 'CSV·JSON 가져오기',
				text: '파일을 끌어다 놓으세요. 가져오기가 타입을 추측하고, 테이블을 만들거나 기존 테이블에 추가하며, 거부된 내용을 행마다 알려 줍니다.',
				href: '/guides/premiers-pas/',
			},
			accounts: {
				title: '계정과 초대',
				text: '각자 계정과 프로젝트를 만들고, 읽기, 편집, 관리 권한으로 링크를 보내 초대합니다. 비밀번호, Google, Microsoft 또는 모든 OpenID Connect 공급자로 로그인합니다.',
				href: '/hebergement/connexion/',
			},
			webhooks: {
				title: '웹훅',
				text: '모든 쓰기를 다른 시스템에 알릴 수 있습니다: 서명된 페이로드를 순서대로 전달하고, 실패하면 재시도합니다.',
				href: '/integrations/webhooks/',
			},
			settings: {
				title: '개인 설정',
				text: '언어, 테마, 날짜 순서, 알림, 세션, 토큰을 한곳에서 관리합니다.',
				href: '/fonctionnalites/droits/#내-설정',
			},
		},
	},
	selfHost: {
		label: '자체 호스팅',
		title: '데이터는 {내 서버에} 그대로 남습니다.',
		lead: 'basedb는 자유 소프트웨어(AGPL-3.0)입니다. 이미지 하나와 PostgreSQL 데이터베이스 하나면 끝입니다 — 강제되는 외부 서비스도, 텔레메트리도 없습니다. <code>pg_dump</code>로 백업하고, 어떤 PostgreSQL 클라이언트로든 읽을 수 있습니다.',
		services: {
			db: 'PostgreSQL 16, 데이터가 저장되는 곳',
			basedb: '인터페이스, REST API, MCP 서버를 포트 하나로',
			proxy: 'Caddy, 자동 HTTPS(선택 사항)',
		},
		links: [
			{
				href: '/hebergement/docker/',
				label: 'Docker Compose 가이드 →',
			},
			{
				href: '/hebergement/variables/',
				label: '모든 환경 변수 →',
			},
		],
		steps: [
			{
				title: 'basedb 받기',
				code: 'git clone https://github.com/eodia/basedb.git\ncd basedb && cp .env.example .env',
			},
			{
				title: '.env에 비밀 값 두 개',
				code: 'POSTGRES_PASSWORD=강력한-비밀번호\n# openssl rand -base64 32\nBASEDB_ENCRYPTION_KEY=…',
			},
			{
				title: '시작하기',
				code: 'docker compose up -d\n# 그다음 http://localhost:3000 에서 계정 만들기',
			},
		],
	},
	faq: {
		label: '자주 묻는 질문',
		title: '자주 받는 질문.',
		text: '다른 질문이 있나요? <a href="/guides/introduction/">문서</a>에서 답을 찾을 수 있을 겁니다.',
		items: {
			difference: {
				q: 'basedb는 다른 협업 데이터베이스와 무엇이 다른가요?',
				a: '데이터가 저장되는 곳이 다릅니다. 다른 제품이 행을 범용 모델(번호가 매겨진 열, JSON 문서)에 담는 반면, basedb는 테이블마다 실제 PostgreSQL 테이블을, 필드마다 타입이 지정된 실제 열을 알아보기 쉬운 이름으로 만듭니다. 데이터는 basedb 없이도 그대로 활용할 수 있습니다.',
			},
			sql: {
				q: 'SQL로 테이블에 직접 쓸 수 있나요?',
				a: '네. 제약 조건(타입, 필수, 단일 선택, 외래 키)은 PostgreSQL 자체가 지키며, SQL 직접 쓰기도 트리거가 쓰기를 수행한 세션과 함께 기록에 남깁니다. 인터페이스의 SQL 콘솔과 psql은 같은 테이블을 읽습니다. 인터페이스에서는 각자 자신의 권한으로 SQL을 작성하고 쿼리를 저장하며, 데이터베이스를 관리하는 사람은 이를 실제 PostgreSQL 뷰로 만들 수 있습니다.',
			},
			ai: {
				q: 'AI 공급자에게는 무엇이 전송되나요?',
				a: '공급자를 설정하기 전에는 아무것도 전송되지 않습니다. 설정한 뒤에도 스키마 초안과 Copilot에는 기본적으로 스키마와 입력한 문장만 전송되며, Copilot의 데이터 읽기는 대화마다 선택하는 확인란입니다. AI에게 요청하는 데이터베이스 템플릿은 입력한 문장만 보냅니다. AI 필드는 명시적으로 동의한 뒤에 지시문이 인용하는 열을 보냅니다.',
			},
			together: {
				q: '여러 사람이 같은 테이블에서 함께 작업할 수 있나요?',
				a: '네. 다른 사람의 쓰기가 새로 고침 없이 표시되고, 그 사람이 보고 있는 테이블이나 행에 얼굴이 나타납니다. 행에 댓글을 달고 @로 누군가를 멘션하면 종 아이콘이 알려 줍니다. 그리고 Ctrl+Z는 내 쓰기만 실행 취소하며, 그 뒤에 다른 사람이 바꾼 내용을 덮어쓰느니 거부합니다.',
			},
			languages: {
				q: '어떤 언어를 지원하나요?',
				a: '20개 언어입니다: 프랑스어, 영어, 독일어, 스페인어, 이탈리아어, 포르투갈어(브라질), 네덜란드어, 폴란드어, 체코어, 스웨덴어, 덴마크어, 노르웨이어, 핀란드어, 루마니아어, 헝가리어, 튀르키예어, 우크라이나어, 일본어, 중국어(간체), 한국어. 인터페이스는 브라우저 언어를 따르며, 각자 설정에서 바꿀 수 있습니다. 이 사이트와 문서도 같은 언어로 제공됩니다.',
			},
			agent: {
				q: 'AI 에이전트는 어떻게 연결하나요?',
				a: 'MCP 서버를 통해, 데이터베이스 하나로 범위가 제한되고 기본적으로 읽기 전용인 연동 토큰으로 연결합니다. 에이전트는 권한에 따라 행을 읽고, 만들고, 수정합니다. 아무것도 삭제하지 않고 스키마도 바꾸지 않습니다. 변경을 제안하면 사람이 승인합니다.',
			},
			postgres: {
				q: '어떤 PostgreSQL 버전이 필요한가요?',
				a: 'PostgreSQL 16 이상과 pg_trgm, unaccent 확장(공식 이미지에 포함)이 필요합니다. 함께 제공되는 docker-compose는 PostgreSQL 16을 실행하며, DATABASE_URL로 기존 서버를 지정할 수도 있습니다.',
			},
			production: {
				q: '운영 환경에서 쓸 수 있나요?',
				a: 'basedb는 활발히 개발되고 있습니다. 코어, API, MCP 서버, 인터페이스가 동작하며 천 개가 넘는 테스트로 검증되지만, 일부 기능은 아직 개발 중입니다(로드맵 참고). 사용해 보시고, 여느 PostgreSQL 데이터베이스처럼 백업하세요.',
			},
			license: {
				q: '라이선스는 무엇인가요?',
				a: 'AGPL-3.0-or-later입니다. 자유롭게 사용, 수정, 호스팅할 수 있으며, 수정한 버전을 서비스로 제공한다면 그 소스를 공유해야 합니다.',
			},
		},
	},
	cta: {
		title: '데이터에는 {실제 테이블이} 걸맞습니다.',
		text: '몇 분 만에 basedb를 설치하고, 팀을 초대하고, 모든 행을 직접 관리하세요.',
		install: 'basedb 설치',
		github: 'GitHub에서 코드 보기',
	},
	changelog: {
		label: '새 소식',
		title: 'basedb에서 바뀐 내용',
		intro: '각 변경의 자세한 내용은 <a href="https://github.com/eodia/basedb/commits/main">저장소 기록</a>에 있습니다. 앞으로의 계획은 <a href="/feuille-de-route/">로드맵</a>에서 확인하세요.',
		entries: {
			languages: {
				date: '2026-09-27',
				title: '서식 있는 텍스트, 변수, 더 읽기 쉬운 칸반',
				tag: '신규',
				items: [
					'<strong>서식 있는 텍스트</strong>: 비주얼 편집기에서 제목, 목록, 인용, 링크로 서식을 지정하는 새 필드 타입입니다. 쓸 때 정제되고, SQL 직접 쓰기에 대비해 제약 조건으로 보호됩니다. <a href="/fonctionnalites/tables-et-champs/#서식-있는-텍스트와-변수">서식 있는 텍스트와 변수</a>',
					'<strong>변수</strong>: 긴 텍스트가 같은 행의 열을 인용하면(<code>{{Ville}}</code>) 그리드, 행 세부 정보, API, MCP 서버, 공유 보기, 자동화 어디에서나 그 값으로 읽힙니다. 열에는 인용 자체가 저장되고, <code>psql</code>은 그것을 읽습니다.',
					'<strong>더 읽기 쉬운 칸반</strong>: 여유 있는 카드, 커버 이미지, 그리고 행의 값을 인용하는 설명 — “{{Client}} 배송 예정일: {{Date}}”. <a href="/fonctionnalites/vues/">보기</a>',
					'<strong>한 번에 이름 바꾸기</strong>: 데이터베이스, 테이블, 필드 모두 대화 상자 하나로 이름을 바꿉니다. 레이블은 항상 바뀌며, 관리자는 영향 분석을 확인하고 데이터베이스에서도 이름을 바꿀 수 있습니다. <a href="/fonctionnalites/tables-et-champs/#스키마-변경">스키마 변경</a>',
					'<strong>20개 언어</strong>: 인터페이스, 이 사이트, 문서를 프랑스어, 영어, 독일어, 스페인어, 이탈리아어, 포르투갈어(브라질), 네덜란드어, 폴란드어, 체코어, 스웨덴어, 덴마크어, 노르웨이어, 핀란드어, 루마니아어, 헝가리어, 튀르키예어, 우크라이나어, 일본어, 중국어(간체), 한국어로 제공합니다. basedb는 브라우저 언어를 따르며, <strong>설정 › 모양 › 언어</strong>에서 다른 언어를 지정하면 어느 기기에서든 그대로 적용됩니다. 숫자와 날짜는 언어를 따릅니다. <a href="/fonctionnalites/droits/#내-설정">내 설정</a>',
				],
			},
			aiProvider: {
				date: '2026-09-27',
				title: '원하는 AI, 내 서버에서까지',
				tag: '신규',
				items: [
					'<strong>네 번째 AI 공급자</strong>: OpenAI API를 지원하는 모든 서버 — Azure, 사내 게이트웨이, 직접 운영하는 서버에서 실행하는 모델 —를 <code>.env</code>에 선언합니다. 호출 기록에는 데이터가 어디로 전달되었는지 남습니다. <a href="/fonctionnalites/ia/">basedb의 AI</a>',
					'<strong>로그인 화면</strong>은 그리드와 SQL 화면에 이어, 필터를 따르는 대시보드와 AI 단계까지 포함해 실행되는 자동화를 보여 줍니다.',
				],
			},
			flows: {
				date: '2026-09-27',
				title: '흐름으로 그리는 자동화',
				tag: '신규',
				items: [
					'<strong>그래프 편집기</strong>: 트리거, 그리고 카드로 표시되는 각 단계. 선 위의 <strong>+</strong>를 누르면 그 위치에 단계가 추가됩니다. 간단한 자동화는 여전히 카드 두 장이면 됩니다. <a href="/fonctionnalites/automatisations/">자동화</a>',
					'<strong>행 찾기</strong> — 주문의 고객, 마지막 미결제 청구서 — 그리고 그 행을 수정하거나, 인용하거나, 새로 만든 행과 연결합니다.',
					'<strong>여러 분기가 있는 조건</strong>: 조건을 충족하는 첫 번째 분기로 가고, 아무것도 충족하지 않으면 “그 외”로 갑니다. 분기는 그 뒤에 다시 합쳐집니다.',
					'<strong>단계 사이로 데이터가 전달됩니다</strong>: <code>{{e2.client}}</code>는 단계가 찾거나 만든 것을, <code>{{e3.reponse.numero}}</code>는 웹훅의 응답을 인용합니다. 각 텍스트의 메뉴는 앞에서 확실히 일어난 것만 제안합니다.',
					'<strong>모든 실행을 단계별로</strong>: 실행을 흐름 위에 표시하면 거쳐 간 경로가 그려지고, 각 단계가 무엇을 했고 얼마나 걸렸는지 알려 줍니다.',
					'<strong>자동화 Copilot</strong>: 데이터베이스가 스스로 해야 할 일을 설명하거나, 실행이 실패한 이유를 물어보세요. Copilot이 자동화 전체를 제안하면 클릭 한 번으로 흐름에 적용하고, 검토한 뒤 저장합니다 — 직접 저장하기 전에는 아무것도 저장되지 않습니다. <a href="/fonctionnalites/automatisations/#copilot">Copilot</a>',
					'단계 안에서 <strong>AI에게 질문</strong>: AI 필드처럼 행과 이전 단계를 인용하는 지시문을 보내고, 응답을 텍스트, 숫자, 예/아니요, 날짜, 목록 중 선택 값으로 읽어 다음 단계에서 쓰거나 보냅니다. <a href="/fonctionnalites/automatisations/#ai에게-질문">AI에게 질문</a>',
				],
			},
			dashboards: {
				date: '2026-09-27',
				title: '대시보드: 질문, 차트, 필터',
				tag: '신규',
				items: [
					'마우스로 만드는 <strong>질문</strong> — 테이블과 그 조인, 필터, 일·주·월·연도별 측정값 — 또는 <strong>SQL</strong>로 작성하는 질문. 읽기 전용이며, 변수를 포함해 내 권한으로 실행됩니다. <a href="/fonctionnalites/tableaux-de-bord/">대시보드</a>',
					'<strong>열다섯 가지 시각화</strong>: 숫자, 이전 기간 대비 추세, 목표 대비 진행률, 게이지, 세로 막대, 가로 막대, 선, 영역, 콤보, 원형, 깔때기, 분산형, 표, 피벗 테이블, 프랑스 지도 또는 세계 지도.',
					'<strong>클릭 한 번으로 탐색</strong>: 지점을 누르면 그 행, 더 세밀한 기간, 또는 다른 기준의 분포가 열립니다.',
					'<strong>그리드형 대시보드</strong>: 마우스로 옮기고 크기를 바꾸는 카드, 탭, 섹션 제목, 텍스트, 삽입 페이지.',
					'<strong>공통 필터</strong> — 기간, 카테고리, 텍스트, 숫자, 날짜 그룹화 — 로 카드 하나, 여러 개, 또는 전체를 제어하며, 기본값도 지정할 수 있습니다.',
					'<strong>원하는 대로 꾸미는 차트</strong>: 계열이나 조각마다 색상과 이름, 도넛·반원·로즈 차트, 합계를 표시하는 누적, 부드러운 선이나 계단형 선, 축, 눈금, 로그 눈금. 표는 열 이름을 바꾸고, 값에 따라 막대와 색상을 표시합니다.',
					'<strong>대시보드 Copilot</strong>: 질문, 되돌릴 수 있는 대시보드 수정, 필터 값을 제안하고 클릭 한 번으로 적용하는 대화입니다. 결과 읽기를 허용하지 않는 한 공급자에게는 스키마만 전송됩니다. <a href="/fonctionnalites/tableaux-de-bord/#copilot">Copilot</a>',
					'<strong>대시보드 공유</strong>: 공개 링크 또는 멤버 전용 링크(필요하면 특정 그룹으로 제한)로 공유하고, 다른 사이트에 삽입합니다. 카드와 필터는 읽기 전용이며, 게시한 사람의 권한으로 읽습니다. <a href="/fonctionnalites/tableaux-de-bord/#대시보드-공유">공유</a>',
					'“인터페이스”는 이제 <strong>대시보드</strong>라는 이름으로 바뀌었습니다. 기존 대시보드는 새 그리드에서 그대로 열립니다.',
				],
			},
			sqlViews: {
				date: '2026-09-27',
				title: '저장된 쿼리와 SQL 뷰',
				tag: '신규',
				items: [
					'<strong>모두를 위한 SQL</strong>: 관리 권한이 없으면 SQL 탭은 읽기 전용으로, 내 권한으로 실행되며, 권한은 PostgreSQL 자체가 적용합니다 — 접근할 수 없는 테이블은 존재하지 않고, 숨겨진 필드는 거부됩니다. “내 권한” 배지가 이를 알려 줍니다. <a href="/fonctionnalites/requetes-et-vues-sql/">SQL 쿼리와 뷰</a>',
					'<strong>저장된 쿼리</strong>: 테이블 아래 “쿼리” 항목에 보관되며, 나만, 데이터베이스 전체, 또는 특정 그룹용으로 저장합니다. 쿼리를 공유하면 텍스트만 공유되며, 작성자가 읽을 수 있는 내용은 절대 공유되지 않습니다. 사이드바에서 열면 곧바로 읽기 전용으로 실행됩니다.',
					'<strong>SQL 뷰</strong>: 색상, 아이콘, 작은 눈 표시와 함께 테이블 사이에 놓이는 실제 PostgreSQL 뷰로, <code>psql</code>과 사용 중인 도구에서도 읽을 수 있습니다. 각자 자신의 권한으로 읽으며, 사이드바에는 뷰 전체를 읽을 수 있는 사람에게만 표시됩니다.',
					'뷰는 스키마 변경을 따라갑니다. 이름을 바꿔도 깨지지 않고, 수식이 바뀌면 잠시 제거되었다가 다시 만들어집니다. 더 이상 맞지 않는 뷰는 정의가 보존된 채 수정을 기다립니다.',
				],
			},
			settings: {
				date: '2026-09-27',
				title: '내 설정',
				tag: '신규',
				items: [
					'프로필 메뉴의 <strong>설정</strong>: 이름, 이메일 주소, 계정에 연결된 ID 공급자, 비밀번호와 열려 있는 세션. <a href="/fonctionnalites/droits/">계정과 로그인</a>',
					'<strong>모양</strong>: 테마, 날짜 순서(<code>25/09/2026</code> 또는 <code>2026-09-25</code>), 캘린더의 주 시작 요일. 뒤의 두 가지는 어느 기기에서든 그대로 적용됩니다.',
					'<strong>알림</strong>: 더 이상 받고 싶지 않은 알림을 종류별로 끕니다. <strong>토큰</strong>: 모든 데이터베이스에서 내가 만든 토큰, 마지막 사용 시각, 폐기.',
				],
			},
			v020: {
				date: '2026-09-26',
				title: '버전 0.2.0: 각자의 계정, 프로젝트, 초대',
				tag: '신규',
				items: [
					'<strong>첫 로그인</strong>: 새 인스턴스에서는 첫 페이지에서 이메일 주소와 비밀번호로 관리자 계정을 만듭니다. 기본 계정도, 로그에서 찾아야 하는 비밀번호도 더 이상 없습니다. <a href="/guides/installation/">설치</a>',
					'<strong>계정 생성</strong>: 누구나 계정을 만들고, 자신의 프로젝트를 만들어 그 관리자가 됩니다. 시스템 관리에서 계정 생성을 막거나 특정 도메인으로 제한할 수 있습니다. <a href="/hebergement/connexion/">계정과 로그인</a>',
					'<strong>프로젝트나 데이터베이스 공유</strong>: 관리 권한이 있는 사람은 읽기, 편집, 관리 수준으로 링크를 보내 초대하고, 누가 접근할 수 있는지 확인하고, 수준을 바꾸거나 액세스를 제거합니다. 자신이 관리하는 범위를 넘을 수는 없습니다.',
					'<strong>개인 정보 보호</strong>: 이제 각자 프로젝트를 함께 쓰는 사람만 볼 수 있으며, 다른 사람이 이미 쓰는 프로젝트 이름도 더는 짐작할 수 없습니다.',
					'<strong>Google, Microsoft 로그인</strong>과 모든 OpenID Connect 공급자(Keycloak, GitLab…)를 <code>.env</code>에 선언합니다. 계정 생성이 허용되면 첫 로그인 때 계정이 만들어집니다. <a href="/hebergement/connexion/">설정 방법</a>',
					'<strong>새 로그인 화면</strong>: 애플리케이션 테마(라이트 또는 다크)를 따르고, 절제된 애니메이션을 씁니다. 애플리케이션의 빈 화면에는 일러스트가 들어갑니다.',
					'<strong>손실 없는 업데이트</strong>: basedb는 시작할 때 카탈로그를 스스로 업데이트하며(0.1 설치 포함), 더 최신 버전이 이미 업데이트한 데이터베이스에서는 시작을 거부합니다. <a href="/hebergement/sauvegardes/">업데이트</a>',
				],
			},
			dockerImage: {
				date: '2026-09-26',
				title: 'Docker 이미지 하나로',
				tag: '호스팅',
				items: [
					'basedb는 amd64와 arm64를 지원하는 <strong>이미지 하나</strong>, Docker Hub의 <code>eodia/basedb</code>에 모두 들어 있습니다. 인터페이스, <code>/api</code> 아래의 API, <code>/mcp</code> 아래의 MCP 서버를 <strong>포트 하나</strong>로 제공합니다. <a href="/guides/installation/">설치</a>',
					'파일 두 개면 충분합니다 — <code>docker-compose.yml</code>과 <code>.env</code> — 저장소를 클론하거나 빌드할 필요가 없습니다. 업데이트는 <code>docker compose pull</code>로 합니다.',
					'도메인 뒤에서도 HTTPS 프록시가 따로 라우팅할 필요가 없습니다. 모든 요청이 포트 3000으로 갑니다.',
				],
			},
			automations: {
				date: '2026-09-26',
				title: '자동화, 인터페이스, 수식, 협업',
				tag: '신규',
				items: [
					'<strong>수식</strong>: 프랑스어 함수(<code>SI</code>, <code>ARRONDI</code>, <code>JOURS</code>…)로 작성하며 PostgreSQL 생성 열이 됩니다. 관계를 거치는 <strong>조회</strong>, <strong>롤업</strong>, <strong>개수</strong>도 추가되었습니다. <a href="/fonctionnalites/tables-et-champs/">필드</a>',
					'<strong>새 타입</strong>: 다중 관계, 사람, 이메일, 자동 번호, 버튼. 그리고 타입처럼 고르는 형식: 통화, 백분율, 기간, 별점, 전화번호, 바코드.',
					'<strong>여덟 가지 보기</strong>: <strong>갤러리</strong>와 <strong>목록</strong>이 나머지 여섯 가지에 합류했습니다. 모든 읽기 사용자를 위한 <strong>개인 보기</strong>, 잠긴 보기, 수동 정렬, 타임라인의 의존 관계. <a href="/fonctionnalites/vues/">보기</a>',
					'<strong>그리드</strong>: 빠른 검색, 그룹화, 필터 전체에 대한 열별 요약, 규칙에 따른 색상, 행 높이.',
					'읽기 전용 <strong>공유 보기</strong>는 다른 사이트에 삽입할 수 있습니다. 캘린더는 Google 캘린더, Outlook, Apple 캘린더에서 구독하는 <strong>iCalendar 피드</strong>가 됩니다. <a href="/fonctionnalites/vues-partagees/">공유</a>',
					'<strong>협업</strong>: 댓글과 멘션, 알림, 다른 사람의 쓰기 실시간 반영, 테이블과 행의 접속 현황. <a href="/fonctionnalites/collaboration/">함께 작업하기</a>',
					'<strong>Ctrl+Z</strong>는 마지막 쓰기(셀 하나, 옮긴 카드 하나, 가져오기 전체)를 실행 취소하며, 그 뒤에 다른 사람이 바꾼 내용을 덮어쓰느니 거부합니다.',
					'<strong>자동화</strong>: 행이 생성되거나 수정될 때, 정해진 시각에, 또는 버튼 클릭 한 번으로 — 수정, 생성, 알림, 웹훅 호출, Slack 메시지. <a href="/fonctionnalites/automatisations/">자동화</a>',
					'<strong>인터페이스</strong>: 숫자, 차트, 목록, 텍스트로 구성하고 각자의 권한으로 읽는 대시보드. <a href="/fonctionnalites/tableaux-de-bord/">대시보드</a>',
					'<strong>연동</strong>: Slack 채널, 그리고 온라인 CSV, 일정, 다른 basedb의 보기를 따르는 <strong>동기화된 테이블</strong>. <a href="/integrations/synchronisation/">연동</a>',
					'<strong>데이터베이스 템플릿</strong>: 템플릿 10개가 담긴 갤러리, 한 문장으로 AI에게 설명해 만드는 데이터베이스, 그리고 어떤 데이터베이스든 템플릿으로 저장하기. <a href="/modeles/">갤러리</a>',
					'<strong>권한</strong>: 관리 권한이 없으면 스키마 화면은 보기 전용이 됩니다.',
					'<strong>새로운 아이덴티티</strong>: 로고, 색상 팔레트, 새로 만든 로그인 화면.',
				],
			},
			simpler: {
				date: '2026-09-26',
				title: '더 단순해진 인터페이스',
				items: [
					'<strong>사이드바</strong>에는 이제 데이터베이스와 그 테이블만 나열됩니다. 열린 데이터베이스의 화면(스키마, 기록, 인터페이스, 자동화)은 프로필 바로 위 블록 하나에 모였습니다.',
					'<strong>프로필 메뉴</strong>에는 데이터가 아닌 것들이 모였습니다: API 및 MCP 문서, 연동, 사용자와 권한.',
					'<strong>SQL 쿼리</strong>는 탭 바의 “+” 또는 데이터베이스 메뉴에서 열며, 사이드바에 중복되지 않습니다.',
					'<strong>새 데이터베이스</strong> 대화 상자에서 바로 템플릿과 AI를 제안합니다. 데모 데이터베이스도 같은 갤러리를 거칩니다.',
					'<strong>화면은 거부될 기능을 더 이상 제공하지 않습니다</strong>: 관리 권한이 없으면 스키마 버튼이 없고, 삭제 권한이 없으면 “삭제”가 없습니다. 읽기 사용자는 메시지에 막히는 대신 자신의 보기를 만듭니다.',
					'<strong>시스템 열</strong>은 모든 테이블에서 제안되는 대신 “시스템 정보” 아래에 모였습니다.',
					'<strong>행 세부 정보</strong>에 댓글, 이메일을 쓰거나 전화를 거는 버튼, 클릭 한 번으로 매기는 평점이 추가되었습니다.',
					'<strong>로그인 화면</strong>은 3D 애니메이션 배경을 버리고, “동작 줄이기” 설정을 존중하는 가벼운 화면이 되었습니다.',
				],
			},
			environments: {
				date: '2026-09-26',
				title: '환경, 공유 양식, 보기',
				items: [
					'<strong>환경</strong>: 한 데이터베이스의 운영, 스테이징, 개발 환경. 나란히 비교하고, 마이그레이션 계획을 세우고, 행을 동기화합니다.',
					'<strong>스키마 기록</strong>: 테이블과 필드의 생성과 수정을 카탈로그의 트리거가 모두 기록합니다.',
					'<strong>공유 양식</strong>: 공개 링크 또는 멤버 전용 링크, 날짜나 응답 수에 따른 마감, 기록에 남는 응답 출처.',
					'<strong>여섯 가지 보기</strong>: 그리드, 칸반, 캘린더, 타임라인, 양식, 설문.',
					'<strong>데이터 기록</strong>: 수정 되돌리기, 삭제된 행 복원.',
					'<strong>AI</strong>: 모든 필드에 쓸 수 있는 AI 옵션, 그리고 Copilot.',
					'<strong>관계</strong>와 <strong>URL</strong>: 서로 다른 두 타입. 긴 텍스트는 Markdown으로 작성합니다.',
					'서명되고 순서가 보장되는 <strong>웹훅</strong>, 승인을 기다리는 <strong>에이전트 제안</strong>.',
					'<strong>Docker</strong>: 세 가지 타깃의 Dockerfile, 완전한 docker-compose, 선택 사항인 HTTPS 프록시.',
				],
			},
			projects: {
				date: '2026-09-25',
				title: '프로젝트, 권한, MCP 서버',
				items: [
					'데이터베이스 위의 <strong>프로젝트</strong>, 그리고 네 가지 수준의 <strong>그룹</strong>별 권한: 액세스 권한 없음, 읽기, 편집, 관리.',
					'<strong>계정</strong>: 임시 비밀번호, 첫 로그인 때 변경, 시스템 관리를 위한 권한 상승.',
					'<strong>MCP 서버</strong>와 stdio 릴레이. REST API와 MCP가 함께 쓰는 <strong>연동 토큰</strong>.',
					'데이터베이스마다 “API 및 MCP” <strong>자동 생성 문서</strong>.',
				],
			},
			fields: {
				date: '2026-09-20',
				title: '필드, 단일 선택, 가져오기',
				items: ['필드와 단일 선택 옵션 수정.', 'CSV, JSON 파일 <strong>가져오기</strong>.', '테이블 메뉴: 이름 바꾸기, 설명, 삭제.'],
			},
			firstCommit: {
				date: '2026-09-20',
				title: '첫 커밋',
				items: ['모노레포: 명명 규칙, 오류 코드 레지스트리, 아키텍처 문서에서 추출한 카탈로그, 코어, API, 인터페이스.'],
			},
		},
	},
	roadmap: {
		label: '로드맵',
		title: '다음 계획',
		intro: 'basedb는 활발히 개발되고 있습니다. 이 페이지는 아직 없는 기능을 약속된 날짜 없이 알려 드립니다. 아이디어나 필요한 기능이 있나요? <a href="https://github.com/eodia/basedb/issues">이슈를 열어 주세요</a>. 이미 제공되는 기능은 <a href="/nouveautes/">새 소식</a>에서 확인하세요.',
		columns: {
			next: {
				title: '곧 제공',
				items: {
					restoreTable: {
						title: '테이블 하나만 복원하기',
						text: '삭제된 테이블은 보관용 이름으로 SQL에서 계속 읽을 수 있습니다. 인터페이스에서 테이블 하나만 되살리는 기능이 추가될 예정입니다.',
					},
					aiSettings: {
						title: '인터페이스에서 AI 설정',
						text: '공급자, 모델, 키를 워크스페이스별로, API 환경 변수를 거치지 않고 설정합니다.',
					},
					mail: {
						title: '이메일 알림과 초대',
						text: '멘션, 답글, 지정 알림은 지금은 basedb 안에서만 받고, 초대는 직접 보내는 링크로 이루어집니다. 앞으로는 이메일로도 보낼 수 있게 됩니다.',
					},
				},
			},
			later: {
				title: '그다음',
				items: {
					formLinks: {
						title: '공유 양식의 관계와 파일',
						text: '연결된 테이블에서의 제한된 검색, 외부 사용자를 위한 제한된 파일 업로드.',
					},
					moreEvents: {
						title: '더 많은 알림 이벤트',
						text: '양식 응답, 에이전트 제안, 비활성화된 웹훅을 알림으로 받습니다.',
					},
					sqlViewsAcross: {
						title: '환경 간 SQL 뷰',
						text: '환경을 만들거나 비교할 때, 그리고 데이터베이스 템플릿에서 SQL 뷰를 스키마와 함께 복사합니다.',
					},
					loops: {
						title: '자동화의 반복과 대기',
						text: '찾은 행마다 단계를 반복하고, 다음 단계 전에 기다리고(“3일 후”), 흐름을 데이터베이스 템플릿에 담습니다.',
					},
					textFormulas: {
						title: '텍스트 수식',
						text: '텍스트의 일부를 추출하거나, 바꾸거나, 자릅니다.',
					},
					bulk: {
						title: '선언형 대량 작업',
						text: '수천 행에 대한 수정을 하나의 작업으로 기록합니다.',
					},
					tombstones: {
						title: '툼스톤 정리',
						text: '더 이상 필요 없는 삭제 흔적을 정리합니다.',
					},
				},
			},
		},
	},
	gallery: {
		label: '템플릿',
		title: '몇 초 만에 준비되는 데이터베이스',
		intro: '각 템플릿은 서로 연결된 테이블, 예시 행, 보기, 대시보드, 자동화 — 그리고 AI가 스스로 채우는 필드를 만듭니다. basedb에서 <strong>새 데이터베이스</strong>, 그다음 <strong>템플릿으로 시작</strong>을 누르세요. 맞는 템플릿이 없나요? 필요한 것을 한 문장으로 설명하면 AI가 맞춤 데이터베이스를 제안합니다.',
		filter: '카테고리별 필터',
		all: '전체',
		otherCategory: '기타',
		ai: '✦ AI',
		tables: {
			one: '테이블 {n}개',
			other: '테이블 {n}개',
		},
		rows: {
			one: '행 {n}개',
			other: '행 {n}개',
		},
		views: {
			one: '보기 {n}개',
			other: '보기 {n}개',
		},
		howtoTitle: 'JSON으로 템플릿 구성하기',
		howto: '템플릿은 JSON 파일입니다. 테이블, 필드, 관계, 행, 보기, 대시보드, 자동화, AI 필드의 지시문이 담깁니다. 이 페이지의 템플릿은 저장소의 <a href="https://github.com/eodia/basedb/tree/main/packages/templates/catalog"><code>packages/templates/catalog</code></a> 폴더에 있는 파일입니다. 모든 basedb 인스턴스는 <a href="/modeles/catalogue.json"><code>catalogue.json</code></a>을 읽어 사용자에게 템플릿을 제공합니다. 관리자는 자신의 템플릿을 인스턴스로 가져올 수도 있으며, 어떤 데이터베이스든 템플릿으로 저장할 수 있습니다.',
		format: {
			href: '/fonctionnalites/modeles/',
			label: '템플릿 형식 →',
		},
		back: '← 모든 템플릿',
		defaultCategory: '템플릿',
		sampleRows: {
			one: '예시 행 {n}개',
			other: '예시 행 {n}개',
		},
		aiTitle: 'AI가 계산하는 내용',
		useTitle: '이 템플릿 사용하기',
		useSteps: [
			'basedb에서 <strong>새 데이터베이스</strong>를 누릅니다.',
			'<strong>템플릿으로 시작</strong>을 누르고 “{label}” 템플릿을 선택합니다.',
		],
		create: '<strong>데이터베이스 만들기</strong>를 누릅니다.',
		createWithAi: '<strong>데이터베이스 만들기</strong>를 누릅니다. 원하면 AI 필드를 AI 공급자가 계산하도록 동의할 수 있습니다.',
		download: 'JSON 다운로드',
		downloadNote: '인스턴스로 가져오거나, 카탈로그에 제안하기 전에 수정할 때 사용하세요.',
		viewMeta: '— {kind}, {table}',
		dashboard: '<strong>대시보드</strong> “{label}” — {blocks}',
		blocks: {
			one: '블록 {n}개',
			other: '블록 {n}개',
		},
		automation: '<strong>자동화</strong> “{label}”',
		yes: '예',
		no: '아니요',
		me: '나',
		kinds: {
			short_text: '짧은 텍스트',
			long_text: '긴 텍스트',
			rich_text: '서식 있는 텍스트',
			number: '숫자',
			boolean: '체크박스',
			date: '날짜',
			datetime: '날짜 및 시간',
			select: '단일 선택',
			multi_select: '다중 선택',
			url: 'URL',
			email: '이메일',
			user: '사람',
			autonumber: '자동 번호',
			formula: '수식',
			lookup: '조회',
			rollup: '롤업',
			count: '개수',
			button: '버튼',
			link: '관계',
			multi_link: '다중 관계',
		},
		viewKinds: {
			grid: '그리드',
			kanban: '칸반',
			calendar: '캘린더',
			timeline: '타임라인',
			gallery: '갤러리',
			list: '목록',
			form: '양식',
		},
	},
	templates: {
		demo: {
			label: '데모: 루멘 공방',
			summary: '작은 에이전시의 고객, 프로젝트, 작업, 청구서, 리뷰: basedb의 모든 면을 하나의 데이터베이스에 담았습니다.',
			description: '데모 데이터베이스입니다. 루멘 공방은 가상의 디자인 에이전시입니다. 이 데이터베이스는 테이블 간 관계, 조회와 롤업(고객별 매출, 평균 평점), 수식(부가세 포함 금액, 지연), 고객 리뷰에 대한 AI 계산 필드 3개(감정, 주제, 추천 답변), 모든 종류의 보기(그리드, 칸반, 캘린더, 의존 관계가 있는 타임라인, 갤러리, 목록, 양식), 대시보드 하나와 자동화 두 개를 보여 줍니다.',
			category: '데모',
			tags: ['AI', '관계', '모든 보기', '대시보드'],
		},
		'analyse-avis': {
			label: '고객 리뷰 분석',
			summary: '리뷰를 수집하면 AI가 감정, 주제, 긴급도를 파악하고 답변 초안을 작성합니다.',
			description: '매장, 식당 또는 브랜드를 위한 템플릿입니다. 리뷰는 공개 양식이나 가져오기로 들어오며 AI가 하나하나 읽습니다. 감정을 분류하고, 주요 주제를 찾고, 빠른 답변이 필요한 리뷰를 표시하고, 고객의 제안을 추출하며, 검토할 답변 초안을 작성합니다. 제품별 평균 평점과 리뷰 수가 집계되고, 대시보드로 만족도를 추적합니다.',
			category: '고객 관리',
			tags: ['AI', '양식', '대시보드'],
		},
		'base-connaissances': {
			label: '지식 베이스',
			summary: '도움말 문서와 고객 질문: AI가 문서를 바탕으로 요약하고 분류하며 답변을 제안합니다.',
			description: '고객 지원 부서를 위한 템플릿입니다. 도움말 문서는 카테고리별로 정리되어 시간에 따라 관리되며, 고객 질문은 공개 양식으로 접수됩니다. AI가 각 문서를 요약하고 수준을 평가하며, 각 질문을 분류하고 검토할 답변 초안을 작성합니다.',
			category: '고객 지원',
			tags: ['AI', '양식', '목록'],
		},
		'calendrier-editorial': {
			label: '콘텐츠 캘린더',
			summary: '캘린더에 예약된 기사, 게시물, 뉴스레터. AI가 헤드라인과 키워드를 제안합니다.',
			description: '마케팅 팀이나 편집부를 위한 템플릿입니다. 각 콘텐츠는 아이디어부터 게시까지 진행되며, 게시 캘린더에 배치되고 캠페인에 속합니다. AI가 브리프를 바탕으로 헤드라인과 키워드를 제안하며, 회사 전체가 양식으로 주제를 제안할 수 있습니다.',
			category: '마케팅',
			tags: ['AI', '캘린더', '칸반', '양식'],
		},
		crm: {
			label: '영업 CRM',
			summary: '회사, 연락처, 영업 기회: 영업 파이프라인과 커뮤니케이션을 관리하고 AI가 다음 단계를 조언합니다.',
			description: '영업 팀을 위한 가벼운 CRM입니다. 영업 기회는 파이프라인을 따라 진행되며 확률로 가중한 금액을 가지고, AI가 메모를 바탕으로 위험도를 평가하고 다음 행동을 조언합니다. 고객과의 커뮤니케이션은 기록되고 요약되며, 회사별로 거래 규모가 집계됩니다.',
			category: '영업',
			tags: ['AI', '파이프라인', '칸반', '캘린더'],
		},
		evenements: {
			label: '이벤트 및 등록',
			summary: '컨퍼런스, 워크숍, 웨비나: 등록, 남은 자리, AI가 분석한 참가자 피드백을 관리합니다.',
			description: '반복 이벤트를 운영하기 위한 템플릿입니다. 각 이벤트는 등록자 수와 남은 자리를 집계하며, 등록 상태는 참석까지 진행됩니다. 이벤트가 끝나면 참가자가 피드백을 남기고, AI가 이를 감정별로 분류하고 요약합니다. 공개 양식으로 메일링 리스트에 가입할 수 있습니다.',
			category: '이벤트',
			tags: ['AI', '캘린더', '양식', '롤업'],
		},
		'gestion-projet': {
			label: '프로젝트 관리',
			summary: '프로젝트, 작업, 마일스톤: 로드맵, 작업 간 의존 관계, 칸반과 캘린더.',
			description: '여러 프로젝트를 동시에 관리하기 위한 템플릿입니다. 각 프로젝트는 작업과 시간을 집계하며, 작업은 칸반으로 추적하고 의존 관계를 보여 주는 타임라인에서 일정을 잡으며, 마일스톤은 캘린더에서 확인합니다. AI가 프로젝트 설명과 진행 상황을 바탕으로 경영진을 위한 프로젝트 현황 요약을 작성합니다.',
			category: '조직',
			tags: ['타임라인', '의존 관계', '칸반', 'AI'],
		},
		inventaire: {
			label: '재고 관리',
			summary: '품목, 공급업체, 입출고: 재고가 자동으로 계산되고 품절을 미리 알 수 있습니다.',
			description: '작업장, 매장 또는 총무 부서를 위한 템플릿입니다. 모든 입고와 출고는 입출고 내역이 되고, 각 품목의 재고는 그 합계로, 재고 가치는 수식으로 계산되며, 기준 수량 미만인 품목은 “주문 필요”에 표시됩니다. AI가 품목 이름과 카테고리를 바탕으로 품목 설명을 작성합니다.',
			category: '운영',
			tags: ['롤업', '수식', '갤러리', 'AI'],
		},
		recrutement: {
			label: '채용',
			summary: '채용 공고, 지원자, 면접: AI가 각 지원서를 요약하고 확인할 점을 제안합니다.',
			description: '지원부터 채용까지 관리하는 채용 관리 템플릿입니다. 지원자는 공개 양식으로 지원하고 칸반에서 단계별로 진행되며, 면접 일정은 캘린더에서 잡습니다. AI가 자기소개서와 메모를 읽고 요약과 면접 질문을 제공합니다. AI는 읽는 것을 도울 뿐, 결정하지 않습니다.',
			category: '인사',
			tags: ['AI', '양식', '칸반', '캘린더'],
		},
		'suivi-tickets': {
			label: '티켓 관리',
			summary: 'AI가 분류한 버그와 요청을 스프린트별로 해결될 때까지 추적하며, 신고 양식도 제공합니다.',
			description: '제품 팀을 위한 티켓 관리 도구입니다. 각 티켓은 구성 요소와 스프린트에 연결되며, AI가 카테고리를 제안하고 심각도를 추정하며 신고 내용을 요약합니다. 칸반으로 진행 상황을 추적하고, 타임라인으로 스프린트를 보여 주며, 누구나 양식으로 문제를 신고할 수 있고, 자동화가 해결 날짜를 기록합니다.',
			category: '제품 및 기술',
			tags: ['AI', '칸반', '양식', '스프린트'],
		},
	},
} satisfies DeepPartial<Dict>;
