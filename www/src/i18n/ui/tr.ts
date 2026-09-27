/**
 * The Turkish texts of the landing pages, laid over the French ones (`fr.ts`).
 *
 * See `../README.md`.
 */
import type { DeepPartial, Dict } from './index';

export default {
	meta: {
		home: {
			title: 'basedb — her tablosu gerçek bir PostgreSQL tablosu olan ortak veritabanı',
			description: 'Izgaralar ve sekiz görünüm, formüller, paylaşılan formlar ve görünümler, yorumlar, otomasyonlar, panolar, alan düzeyinde izinler, eksiksiz geçmiş, REST API ve MCP sunucusu — açıkça adlandırılmış gerçek PostgreSQL tablolarında. Kendi sunucunuzda barındırılır, AGPL-3.0.',
		},
		changelog: {
			title: 'Yenilikler — basedb',
			description: 'basedb’de sürümden sürüme neler değişti.',
		},
		roadmap: {
			title: 'Yol haritası — basedb',
			description: 'basedb’nin sıradaki adımları.',
		},
		gallery: {
			title: 'Şablonlar — basedb',
			description: 'Kullanıma hazır veritabanları: talep takibi, yorum analizi, CRM, işe alım… örnek satırları, görünümleri, panoları ve yapay zekanın hesapladığı alanlarıyla.',
		},
		template: {
			title: '{label} — basedb şablonları',
		},
	},
	eodia: {
		home: 'https://eodia.com/',
		about: 'https://eodia.com/about/',
		contact: 'https://eodia.com/contact/',
	},
	demo: {
		short: 'Demo',
		cta: 'Demoyu dene',
	},
	nav: {
		aria: 'Ana gezinme',
		home: 'basedb — ana sayfa',
		links: [
			{
				href: '/#fonctionnalites',
				label: 'Özellikler',
			},
			{
				href: '/modeles/',
				label: 'Şablonlar',
			},
			{
				href: '/guides/introduction/',
				label: 'Belgeler',
			},
			{
				href: '/nouveautes/',
				label: 'Yenilikler',
			},
		],
		developers: 'Geliştiriciler',
		github: 'basedb’nin GitHub deposu',
		install: 'Kur',
		menu: {
			open: 'Menüyü aç',
			close: 'Menüyü kapat',
			features: {
				label: 'Özellikler',
				groups: {
					organize: {
						title: 'Organize etmek',
						items: {
							tables: {
								href: '/fonctionnalites/tables-et-champs/',
								title: 'Tablolar ve alanlar',
								text: 'Her şey için alanlar, ilişkiler, Fransızca formüller.',
							},
							views: {
								href: '/fonctionnalites/vues/',
								title: 'Sekiz görünüm',
								text: 'Izgara, kanban, takvim, zaman çizelgesi, galeri, liste, form, anket.',
							},
							forms: {
								href: '/fonctionnalites/formulaires-partages/',
								title: 'Formlar',
								text: 'Paylaşılacak bir bağlantı: her yanıt bir satır olur.',
							},
							files: {
								href: '/fonctionnalites/fichiers/',
								title: 'Dosyalar ve görseller',
								text: 'Teklifler, fotoğraflar, sözleşmeler; satırlarıyla birlikte saklanır.',
							},
						},
					},
					collaborate: {
						title: 'Birlikte çalışmak',
						items: {
							live: {
								href: '/fonctionnalites/collaboration/',
								title: 'Gerçek zamanlı ve yorumlar',
								text: 'Başkalarının çalıştığını görün, bir satırı yorumlayın, bir meslektaşınızdan bahsedin.',
							},
							rights: {
								href: '/fonctionnalites/droits/',
								title: 'İzinler ve ekipler',
								text: 'Kimin neyi gördüğü ve kimin neyi değiştirdiği, sütuna kadar.',
							},
							history: {
								href: '/fonctionnalites/historique/',
								title: 'Geçmiş',
								text: 'Her değişiklik saklanır ve geri alınabilir.',
							},
							shared: {
								href: '/fonctionnalites/vues-partagees/',
								title: 'Paylaşılan görünümler',
								text: 'Bir bağlantıyla bir görünüm, sitenizde ya da ajandanızda.',
							},
						},
					},
					automate: {
						title: 'Otomatikleştirmek ve analiz etmek',
						items: {
							automations: {
								href: '/fonctionnalites/automatisations/',
								title: 'Otomasyonlar',
								text: 'Bir satır değiştiğinde: haber ver, oluştur, yaz, yapay zekaya sor.',
							},
							dashboards: {
								href: '/fonctionnalites/tableaux-de-bord/',
								title: 'Panolar',
								text: 'On beş görselleştirme, ortak filtreler, paylaşılacak bir bağlantı.',
							},
							ai: {
								href: '/fonctionnalites/ia/',
								title: 'Yapay zeka ve Copilot',
								text: 'Bir cümleyle bir veritabanı, kendi kendine dolan alanlar.',
							},
							templates: {
								href: '/modeles/',
								title: 'Şablonlar',
								text: 'Kullanıma hazır, uyarlanabilir on veritabanı.',
							},
						},
					},
				},
				feature: {
					tag: 'Yeni',
					title: 'Akış hâlinde otomasyonlar',
					text: 'Arayın, karar verin, yapay zekaya sorun: grafik tabanlı bir düzenleyici ve her çalıştırma adım adım yeniden okunur.',
					href: '/nouveautes/',
					cta: 'Tüm yenilikler',
				},
				all: 'Tüm özellikler',
			},
			solutions: {
				label: 'Çözümler',
				title: 'Her ekip için',
				items: {
					crm: {
						team: 'Satış',
						text: 'Satış hattı, kişiler, hatırlatmalar.',
					},
					recrutement: {
						team: 'İnsan kaynakları',
						text: 'Başvurular, mülakatlar, yapay zeka özetleri.',
					},
					'calendrier-editorial': {
						team: 'Pazarlama',
						text: 'Planlanmış makaleler, gönderiler ve bültenler.',
					},
					inventaire: {
						team: 'İşlemler',
						text: 'Kendiliğinden hesaplanan bir stok, önceden görülen tükenmeler.',
					},
					'gestion-projet': {
						team: 'Projeler',
						text: 'Kilometre taşları, görevler ve bağımlılıklar.',
					},
					'suivi-tickets': {
						team: 'Ürün',
						text: 'Yapay zekanın sınıflandırdığı hatalar ve talepler.',
					},
					'base-connaissances': {
						team: 'Destek',
						text: 'Yardım makaleleri, sorular, önerilen yanıtlar.',
					},
					evenements: {
						team: 'Etkinlik yönetimi',
						text: 'Kayıtlar, yerler, geri bildirimler.',
					},
					'analyse-avis': {
						team: 'Müşteri ilişkileri',
						text: 'Yapay zeka tarafından okunan ve sınıflandırılan yorumlar.',
					},
				},
				ask: {
					title: 'Başka bir şey mi düşünüyorsunuz?',
					text: 'İhtiyacınızı bir cümleyle anlatın: yapay zeka size özel bir veritabanı önerir.',
					href: '/modeles/',
				},
				all: 'Tüm şablonlar',
			},
			developers: {
				label: 'Geliştiriciler',
				groups: {
					build: {
						title: 'Entegre etmek',
						items: {
							api: {
								href: '/integrations/api-rest/',
								title: 'REST API',
								text: 'Arayüzle aynı veriler, OpenAPI 3.1 ile tanımlanmış.',
							},
							mcp: {
								href: '/integrations/mcp/',
								title: 'MCP sunucusu',
								text: 'Yapay zeka ajanlarınız için araçlar, kendi izinleriniz altında.',
							},
							webhooks: {
								href: '/integrations/webhooks/',
								title: 'Webhook’lar',
								text: 'Her yazma; imzalı, sıralı, yeniden denenen.',
							},
							sql: {
								href: '/integrations/sql/',
								title: 'Doğrudan SQL',
								text: 'Açıkça adlandırılmış, gerçek PostgreSQL tabloları.',
							},
							sync: {
								href: '/integrations/synchronisation/',
								title: 'Senkronizasyon',
								text: 'Başka bir yerden güncel tutulan tablolar.',
							},
						},
					},
					host: {
						title: 'Barındırmak',
						items: {
							docker: {
								href: '/hebergement/docker/',
								title: 'Docker Compose',
								text: 'Bir imaj, bir PostgreSQL veritabanı, tek bir port.',
							},
							env: {
								href: '/hebergement/variables/',
								title: 'Değişkenler',
								text: '.env dosyasında her şey ayarlanır.',
							},
							https: {
								href: '/hebergement/https/',
								title: 'Alan adı ve HTTPS',
								text: 'Kendi proxy’nizin arkasında ya da sağlanan Caddy ile.',
							},
							sso: {
								href: '/hebergement/connexion/',
								title: 'Giriş ve SSO',
								text: 'Google, Microsoft, her OpenID Connect sağlayıcısı.',
							},
							backup: {
								href: '/hebergement/sauvegardes/',
								title: 'Yedeklemeler ve güncellemeler',
								text: 'pg_dump ve kayıpsız güncellemeler.',
							},
						},
					},
				},
				feature: {
					title: 'Geliştiriciler sayfası',
					text: 'Her ızgaranın ardında gerçek bir PostgreSQL tablosu.',
					href: '/developpeurs/',
				},
			},
			resources: {
				label: 'Kaynaklar',
				groups: {
					learn: {
						title: 'Öğrenmek',
						items: {
							docs: {
								href: '/guides/introduction/',
								title: 'Belgeler',
								text: 'basedb’nin tamamı, adım adım.',
							},
							start: {
								href: '/guides/premiers-pas/',
								title: 'İlk adımlar',
								text: 'İlk veritabanınız, içe aktarmadan görünüme kadar.',
							},
							install: {
								href: '/guides/installation/',
								title: 'Kurulum',
								text: 'İki dosya ve bir komut.',
							},
							principles: {
								href: '/architecture/principes/',
								title: 'İlkeler',
								text: 'basedb nasıl ve neden bu şekilde kuruldu.',
							},
						},
					},
					follow: {
						title: 'Projeyi takip etmek',
						items: {
							news: {
								href: '/nouveautes/',
								title: 'Yenilikler',
								text: 'Sürümden sürüme neler değişti.',
							},
							roadmap: {
								href: '/feuille-de-route/',
								title: 'Yol haritası',
								text: 'Sıradaki adımlar.',
							},
							github: {
								href: 'https://github.com/eodia/basedb',
								title: 'GitHub',
								text: 'Kod, sorunlar, sürümler.',
							},
							eodia: {
								href: 'https://eodia.com/',
								title: 'Eodia',
								text: 'basedb’yi yapan stüdyo.',
							},
						},
					},
				},
			},
		},
	},
	language: {
		label: 'Dil',
		current: 'Dil: {name}',
	},
	footer: {
		tagline: 'Her tablosu gerçek bir PostgreSQL tablosu olan ortak veritabanı.',
		madeBy: 'Yapay zeka odaklı yazılım stüdyosu <a class="eodia" href="https://eodia.com/">Eodia</a> tarafından geliştirilen özgür yazılım.',
		columns: {
			product: {
				title: 'Ürün',
				links: [
					{
						href: '/#fonctionnalites',
						label: 'Özellikler',
					},
					{
						href: '/nouveautes/',
						label: 'Yenilikler',
					},
					{
						href: '/feuille-de-route/',
						label: 'Yol haritası',
					},
					{
						href: '/#faq',
						label: 'Sık sorulan sorular',
					},
				],
			},
			docs: {
				title: 'Belgeler',
				links: [
					{
						href: '/guides/introduction/',
						label: 'Giriş',
					},
					{
						href: '/guides/installation/',
						label: 'Kurulum',
					},
					{
						href: '/integrations/api-rest/',
						label: 'REST API',
					},
					{
						href: '/integrations/mcp/',
						label: 'MCP sunucusu',
					},
				],
			},
			hosting: {
				title: 'Barındırma',
				links: [
					{
						href: '/hebergement/docker/',
						label: 'Docker Compose',
					},
					{
						href: '/hebergement/variables/',
						label: 'Ortam değişkenleri',
					},
					{
						href: '/hebergement/https/',
						label: 'Alan adı ve HTTPS',
					},
					{
						href: '/hebergement/sauvegardes/',
						label: 'Yedeklemeler',
					},
				],
			},
			project: {
				title: 'Proje',
				links: [
					{
						href: 'https://github.com/eodia/basedb',
						label: 'GitHub',
					},
					{
						href: 'https://github.com/eodia/basedb/tree/main/docs/architecture',
						label: 'Mimari belgesi',
					},
					{
						href: 'https://github.com/eodia/basedb/blob/main/LICENSE',
						label: 'AGPL-3.0 lisansı',
					},
					{
						href: 'https://github.com/eodia/basedb/issues',
						label: 'Sorun bildir',
					},
				],
			},
			eodia: {
				title: 'Eodia',
				links: [
					{
						href: 'https://eodia.com/',
						label: 'Stüdyo',
					},
					{
						href: 'https://eodia.com/about/',
						label: 'Hakkımızda',
					},
					{
						href: 'https://eodia.com/contact/',
						label: 'Bize ulaşın',
					},
				],
			},
		},
		copyright: '© {year} <a href="https://eodia.com/">Eodia</a> · AGPL-3.0-or-later',
		builtWith: 'Site Astro ve Starlight ile oluşturuldu.',
	},
	docsFooter: {
		madeBy: 'basedb, yapay zeka odaklı yazılım stüdyosu <a href="https://eodia.com/">Eodia</a> tarafından geliştirilen özgür bir yazılımdır.',
	},
	teams: {
		meta: {
			title: 'basedb — tüm işiniz, aynı yerde',
			description: 'Müşteriler, projeler, stoklar, başvurular: tüm ekibin aynı anda düzenlediği bir veritabanı, tablo, kanban ya da takvim olarak, panolar, otomasyonlar ve yapay zekayla. Kod yazmadan, özgür ve ücretsiz.',
		},
		hero: {
			eyebrow: 'basedb',
			title: 'Tüm işiniz.',
			titleAccent: 'Sonunda aynı yerde.',
			lead: 'Tüm ekip için tablolar, takvimler, formlar, panolar ve otomasyonlar. Bir elektronik tablo kadar basit. Tek satır kod yazmadan.',
			primary: 'Şablonları keşfet',
			secondary: 'Demoyu izle',
			facts: ['Kod yazmadan', 'Özgür ve ücretsiz', 'Verileriniz sizde kalır'],
		},
		story: {
			grid: {
				title: 'Tüm ekip, aynı tabloda.',
				text: 'Herkes aynı anda orada çalışır ve herkes aynı, güncel bilgiyi görür.',
			},
			copilot: {
				title: 'Sorun. Copilot halleder.',
				text: '“Bu hafta kime geri dönmeliyim?” — size doğru filtreyi önerir, siz de tek tıkla uygularsınız.',
			},
			kanban: {
				title: 'Sürükleyin. Güncellendi.',
				text: 'Her aşama bir sütun olur; bir kartı taşımak, satırı değiştirmektir.',
			},
			calendar: {
				title: 'Her tarih yerinde.',
				text: 'Randevular kendiliğinden görünür ve ajandanıza kadar takip edilir.',
			},
			dashboard: {
				title: 'Ve her şey, bir bakışta.',
				text: 'Sayılar aynı satırlardan kendiliğinden hesaplanır.',
			},
		},
		stage: {
			aria: 'basedb’de bir ekibin müşteri takibi: tablo, Copilot, kanban, takvim, pano',
			tabs: {
				grid: 'Tablo',
				copilot: 'Copilot',
				kanban: 'Kanban',
				calendar: 'Takvim',
				dashboard: 'Pano',
			},
			project: 'Ana proje',
			projectMeta: 'Proje · 2 veritabanı',
			filterNav: 'Gezinmeyi filtrele',
			base: 'Satış',
			otherBase: 'Destek',
			tables: ['Müşteriler', 'Kişiler', 'Teklifler'],
			baseSection: 'Veritabanı · Satış',
			screens: ['Panolar', 'Otomasyonlar'],
			user: 'Léa Martin',
			views: {
				grid: 'Tüm satırlar',
				kanban: 'Aşamaya göre',
				calendar: 'Randevular',
			},
			toolbar: {
				filter: 'Filtrele',
				columns: 'Sütunlar',
				group: 'Grupla',
				colors: 'Renkler',
				sort: 'Sırala',
				configure: 'Yapılandır',
			},
			search: 'Ara…',
			add: 'Ekle',
			columns: {
				name: 'Müşteri',
				status: 'Aşama',
				owner: 'Takip eden',
				amount: 'Tutar',
				next: 'Sonraki randevu',
			},
			statuses: {
				contact: 'İletişime geçilecek',
				meeting: 'Randevu',
				quote: 'Teklif gönderildi',
				signed: 'İmzalandı',
			},
			clients: [
				'Yılmaz Fırını',
				'Ihlamur Kliniği',
				'Atatürk Lisesi',
				'Dayanışma Bisiklet',
				'Nadide Şarküteri',
				'Anadolu Döküm',
				'Tuna Atölyesi',
			],
			addRow: 'Satır ekle',
			perPage: 'Sayfa başına satır',
			card: '{owner} takip ediyor, {date} tarihinde randevu',
			addCard: 'Kart ekle',
			today: 'Bugün',
			month: 'Ay',
			week: 'Hafta',
			dashboards: 'Panolar',
			questions: 'Sorular',
			dashboard: 'Satış takibi',
			dashboardText: 'Özet, bir bakışta.',
			dashboardTabs: ['Genel bakış', 'Etkinlik'],
			period: 'Dönem',
			thisYear: 'Bu yıl',
			share: 'Paylaş',
			edit: 'Düzenle',
			explore: 'Verileri keşfet',
			chart: 'Müşteriye göre tutar',
			byStage: 'Aşamaya göre müşteriler',
			kpis: {
				signed: 'İmzalandı',
				pending: 'Bekleyen teklifler',
				rate: 'İmzalanan müşteriler',
			},
			copilot: {
				question: 'Bu hafta kime geri dönmeliyim?',
				thinking: 'Düşünüyor…',
				answer: 'Dört müşteri yanıt bekliyor: iki teklif gönderildi ve iki randevu hazırlanacak.',
				card: 'Müşterileri filtrele',
				filter: 'Aşama: Teklif gönderildi ya da Randevu',
				apply: 'Filtreyi uygula',
				applied: 'Filtre uygulandı',
				placeholder: 'Copilot’a sorun…',
				filtered: '{n} satır filtrelendi',
			},
		},
		video: {
			eyebrow: 'Demo',
			title: 'Tüm basedb,',
			titleAccent: 'dört dakikada.',
			text: 'Bir veritabanı oluşturmak, doldurmak, paylaşmak, otomatikleştirmek, yönetmek: eksiksiz ve sesli anlatımlı tur.',
			play: 'Videoyu oynat',
			duration: '4 dk 35 sn',
			chapters: 'Bölümler',
			captions: 'Fransızca',
			inFrench: 'Video Fransızca dilindedir, alt yazıları da Fransızcadır.',
			list: [
				{ time: '0:08', title: 'Veritabanı oluşturma' },
				{ time: '0:35', title: 'Tablolar, alanlar ve formüller' },
				{ time: '1:10', title: 'Satırlar ve işbirliği' },
				{ time: '1:33', title: 'Aynı satırlarda sekiz görünüm' },
				{ time: '2:01', title: 'Formlar ve yapay zeka' },
				{ time: '2:37', title: 'Otomasyonlar' },
				{ time: '2:59', title: 'Panolar' },
				{ time: '3:15', title: 'Herkes için SQL' },
				{ time: '3:43', title: 'Geçmiş ve izinler' },
				{ time: '4:01', title: 'API, MCP ve Copilot' },
			],
		},
		together: {
			eyebrow: 'İşbirliği',
			title: 'Herkes.',
			titleAccent: 'Aynı anda.',
			text: 'Başkalarının değişiklikleri anlık olarak gelir. Kimin hangi satıra baktığını görürsünüz, orada tartışırsınız ve bir meslektaşınızı haberdar etmek için bir @ yeterlidir.',
			demo: {
				path: 'Satış / Teklifler',
				here: '3 kişi bu tabloda',
				columns: {
					client: 'Müşteri',
					status: 'Aşama',
					amount: 'Tutar',
					due: 'Son tarih',
				},
				statuses: {
					draft: 'Taslak',
					sent: 'Gönderildi',
					signed: 'İmzalandı',
				},
				rows: [
					'Yılmaz Fırını',
					'Ihlamur Kliniği',
					'Atatürk Lisesi',
					'Dayanışma Bisiklet',
					'Nadide Şarküteri',
					'Anadolu Döküm',
				],
				comment: '@{name} bu teklifi bu akşama kadar onaylayabilir misin?',
				reply: 'Onaylandı!',
				toast: '{name} “{field}” alanını değiştirdi',
			},
			points: {
				live: {
					title: 'Gerçek zamanlı',
					text: 'Her değişiklik, sayfa yeniden yüklenmeden diğerlerinde hemen görünür.',
				},
				comments: {
					title: 'Yorumlar ve bahsetmeler',
					text: 'Bir satır yorumlanır, @ ile bir meslektaş bahsedilir ve zil onu haberdar eder.',
				},
				undo: {
					title: 'Risksiz geri alma',
					text: 'Ctrl+Z son değişikliğinizi geri alır — asla bir meslektaşınızınkini değil.',
				},
			},
			link: {
				href: '/fonctionnalites/collaboration/',
				label: 'Birlikte çalışmak',
			},
		},
		automate: {
			eyebrow: 'Otomasyonlar',
			title: 'Siz uyurken',
			titleAccent: 'çalışır.',
			text: 'Ne olması gerektiğini bir kez tanımlayın. Bir satır değiştiğinde, her sabah belirli bir saatte ya da bir düğmeye tıklandığında, basedb adımları art arda çalıştırır — ve her çalıştırma adım adım yeniden okunur.',
			clock: '03:12',
			when: 'Ne zaman',
			trigger: 'bir teklif “İmzalandı” durumuna geçer',
			steps: {
				find: {
					kind: 'Satır ara',
					text: 'Teklifin müşterisi',
				},
				ai: {
					kind: 'Yapay zekaya sor',
					text: 'Bir teşekkür notu yaz',
				},
				create: {
					kind: 'Satır oluştur',
					text: 'Fatura, Faturalar tablosunda',
				},
				notify: {
					kind: 'Birine haber ver',
					text: 'Muhasebe',
				},
				slack: {
					kind: 'Slack’e gönder',
					text: '#satış kanalında',
				},
			},
			answer: 'Güveniniz için teşekkürler! Projenizi pazartesiden itibaren başlatıyoruz ve faturanız e-posta ile geliyor.',
			done: 'Başarılı · 5 adım · 1,2 sn',
			copilot: {
				prompt: 'Bir teklif imzalandığında muhasebeye haber ver ve faturayı oluştur.',
				text: 'Copilot’a bir cümle yeter, otomasyon hazırdır: geriye sadece gözden geçirmek kalır.',
			},
			link: {
				href: '/fonctionnalites/automatisations/',
				label: 'Otomasyonlar',
			},
		},
		glance: {
			eyebrow: 'Panolar',
			title: 'Her şeyi görün.',
			titleAccent: 'Bir bakışta.',
			text: 'Sayılar, eğriler, hedefler: panolarınız tablolarınızdan fareyle oluşturulur ve kendiliğinden güncel kalır. Bir filtre, tüm pano onu takip eder.',
			demo: {
				title: 'Satış performansı',
				filters: ['Bu yıl', 'Tüm şehirler'],
				revenue: 'Ciro',
				signed: 'İmzalanan teklifler',
				rate: 'İmzalanma oranı',
				goal: 'Yıllık hedef',
				byMonth: 'Aylık ciro',
				byStage: 'Aşamaya göre teklifler',
				stages: ['Gönderildi', 'Görüşülüyor', 'İmzalandı'],
				bySector: 'Sektöre göre müşteriler',
				sectors: ['Ticaret', 'Sağlık', 'Eğitim', 'Sanayi'],
				shared: 'Bağlantıyla paylaşıldı',
			},
			points: {
				viz: {
					title: 'On beş görselleştirme',
					text: 'Sayılar, eğilimler, hedefler, eğriler, sektörler, huniler, pivot tablolar, haritalar.',
				},
				filters: {
					title: 'Ortak filtreler',
					text: 'Dönem, bir müşteri, bir şehir: bir filtre bir kartı, birkaçını ya da tüm panoyu yönetir.',
				},
				share: {
					title: 'Bir bağlantıyla paylaşılır',
					text: 'Herkese açık ya da ekibe özel, ve başka bir siteye yerleştirilebilir.',
				},
			},
			link: {
				href: '/fonctionnalites/tableaux-de-bord/',
				label: 'Panolar',
			},
		},
		ai: {
			eyebrow: 'Yapay zeka',
			title: 'Anlatın.',
			titleAccent: 'basedb oluşturur.',
			text: 'Eksiksiz bir veritabanı elde etmek için bir cümle yeterlidir; oluşturmadan önce onu gözden geçirirsiniz. Ardından Copilot filtreler, grafikler ve otomasyonlar önerir; yapay zeka alanları sizin yerinize özetler, sınıflandırır ve yazar.',
			prompt: 'Açık üç pozisyonumuz için, mülakatlarla birlikte bir başvuru takibi.',
			thinking: 'Birbirine bağlı üç tablo, gözden geçirilmeye hazır.',
			tables: {
				jobs: {
					name: 'Pozisyonlar',
					fields: ['Unvan', 'Departman', 'Açılış tarihi'],
				},
				people: {
					name: 'Adaylar',
					fields: ['Ad', 'Pozisyon', 'Aşama', 'Özet'],
				},
				talks: {
					name: 'Mülakatlar',
					fields: ['Aday', 'Tarih', 'Görüşmeci', 'Değerlendirme'],
				},
			},
			aiField: 'Özet',
			aiValue: 'Proje yönetiminde altı yıl, müşterilerle rahat iletişim; incelenecek: İngilizce.',
			create: 'Veritabanını oluştur',
			providers: 'Seçtiğiniz sağlayıcıyla — OpenAI, Anthropic, Mistral ya da kendi sunucunuzda kurulu bir model. Onayınız olmadan hiçbir şey gönderilmez.',
			link: {
				href: '/fonctionnalites/ia/',
				label: 'basedb’de yapay zeka',
			},
		},
		features: {
			title: 'Gereken her şey.',
			titleAccent: 'Ve çok daha fazlası.',
			text: 'Her işlev aynı tablolara, aynı izinlerle, aynı geçmişe yazar.',
			tiles: {
				views: {
					stat: '8',
					title: 'veri görüntüleme yöntemi',
					text: 'Aynı satırlar üzerinde ızgara, kanban, takvim, zaman çizelgesi, galeri, liste, form ve anket. Herkes kendi görünümünü seçer.',
					href: '/fonctionnalites/vues/',
				},
				history: {
					stat: 'Ctrl+Z',
					title: 'Hiçbir şey kaybolmaz',
					text: 'Her değişiklik önceki değeriyle saklanır; bir hata geri alınır, silinen bir satır geri yüklenir.',
					href: '/fonctionnalites/historique/',
				},
				forms: {
					title: 'Formlar',
					text: 'Herkese açık ya da ekibe özel bir bağlantı: her yanıt tabloya gelir, gerisini açmadan.',
					href: '/fonctionnalites/formulaires-partages/',
				},
				viz: {
					stat: '15',
					title: 'görselleştirme',
					text: 'Sayılar, eğilimler, hedefler, eğriler, sektörler, huniler, pivot tablolar ve haritalar.',
					href: '/fonctionnalites/tableaux-de-bord/',
				},
				formulas: {
					code: 'SI([Montant] > 10000; "Grand compte"; "")',
					title: 'Fransızca formüller',
					text: 'Bir tablo programındaki gibi — SI, ARRONDI, JOURS… — ama tüm ekip için hesaplanır.',
					href: '/fonctionnalites/tables-et-champs/#formüller',
				},
				rights: {
					title: 'Herkes görmesi gerekeni görür',
					text: 'Okuma, düzenleme, yönetim, ekip ekip; hassas bir sütun gizlenebilir.',
					href: '/fonctionnalites/droits/',
				},
				mentions: {
					bubble: '@Camille',
					title: 'Yorumlar ve bahsetmeler',
					text: 'Bir satır bulunduğu yerde tartışılır ve zil haber verir.',
					href: '/fonctionnalites/collaboration/',
				},
				relations: {
					title: 'Her şey birbirine bağlı',
					text: 'Müşteriler, projeler, faturalar: toplamlar ve aramalar ilişkiler arasında geçer.',
					href: '/fonctionnalites/tables-et-champs/',
				},
				templates: {
					stat: '10',
					title: 'hazır şablon',
					text: 'CRM, işe alım, stok, etkinlikler… ya da yapay zekaya tek cümleyle anlatılan bir veritabanı.',
					href: '/modeles/',
				},
				import: {
					title: 'Tek hareketle içe aktarma',
					text: 'Bir CSV dosyasını sürükleyin: sütunlar ve türler tahmin edilir, tablo oluşturulur.',
					href: '/guides/premiers-pas/',
				},
				agenda: {
					title: 'Ajandanıza kadar',
					text: 'Bir takvim, Google Takvim, Outlook ya da Apple Takvim için bir akışa dönüşür.',
					href: '/fonctionnalites/vues-partagees/',
				},
				files: {
					title: 'Dosyalar ve görseller',
					text: 'Teklifler, fotoğraflar, sözleşmeler; bir görsel bir kartın kapağı olur.',
					href: '/fonctionnalites/fichiers/',
				},
				share: {
					title: 'Paylaşılan görünümler',
					text: 'Bir bağlantıyla salt okunur bir görünüm, sitenize yerleştirilebilir.',
					href: '/fonctionnalites/vues-partagees/',
				},
				sync: {
					title: 'Senkronize tablolar',
					text: 'Çevrim içi bir CSV’den, bir ajandadan ya da başka bir basedb’den güncel tutulur.',
					href: '/integrations/synchronisation/',
				},
				signin: {
					title: 'Basit giriş',
					text: 'Google, Microsoft ya da şifre; meslektaşlarınızı bir bağlantıyla davet edersiniz.',
					href: '/hebergement/connexion/',
				},
				languages: {
					title: 'Kendi dilinizde',
					text: 'Arayüz, yirmi dil arasından herkesin kendi dilini kullanır.',
					href: '/fonctionnalites/droits/#ayarlarınız',
				},
			},
		},
		yours: {
			eyebrow: 'Özgür ve kendi sunucunuzda',
			per: 'kişi başı. Sonsuza dek.',
			text: 'basedb özgür bir yazılımdır. Kendi sunucunuza kurun ve tüm ekibi davet edin: abonelik yok, sayılacak bir lisans yok ve verileriniz sizde kalır.',
			points: {
				home: {
					title: 'Sizde',
					text: 'Kendi sunucunuzda ya da hosting sağlayıcınızınkinde, her PostgreSQL veritabanı gibi yedeklenir.',
				},
				free: {
					title: 'Özgür',
					text: 'AGPL-3.0 lisansı altında: kod açıktır ve açık kalacaktır.',
				},
				ai: {
					title: 'Seçtiğiniz yapay zeka',
					text: 'Piyasadaki bir sağlayıcı, kendi sunucunuzda kurulu bir model — ya da hiç yapay zeka olmadan.',
				},
			},
			link: {
				href: '/guides/installation/',
				label: 'basedb’yi kur',
			},
		},
		gallery: {
			eyebrow: 'Şablonlar',
			title: 'Bir dakikada hazır.',
			text: 'Tablolarıyla, görünümleriyle, panosuyla ve örnek satırlarıyla bir şablondan başlayın, ardından kendi çalışma tarzınıza uyarlayın.',
			use: 'Keşfet',
			ask: {
				title: 'Hiçbiri uymuyor mu?',
				text: 'İhtiyacınızı bir cümleyle anlatın: yapay zeka size özel bir veritabanı önerir.',
			},
			all: 'Tüm şablonları gör',
			previous: 'Önceki şablonlar',
			next: 'Sonraki şablonlar',
		},
		developers: {
			title: 'Peki, teknik taraf?',
			text: 'Her tablo gerçek bir PostgreSQL tablosudur. REST API, webhook’lar, yapay zeka ajanları için MCP sunucusu ve tek komutla kurulum.',
			link: 'Geliştiriciler sayfası',
		},
		faq: {
			title: 'Sorularınız',
			items: [
				{
					q: 'Kod yazmayı bilmek gerekir mi?',
					a: 'Hayır. Tablolarınızı, görünümlerinizi, formlarınızı, panolarınızı ve otomasyonlarınızı fareyle oluşturursunuz. Formüller bir tablo programındaki gibi Fransızca yazılır: SI, ARRONDI, JOURS…',
				},
				{
					q: 'Ne kadara mal olur?',
					a: 'Hiçbir şeye: basedb özgür bir yazılımdır, abonelik ya da kişi başı ücret yoktur. Yalnızca kurabileceğiniz bir sunucuya ihtiyacınız var.',
				},
				{
					q: 'Nasıl kurulur?',
					a: 'Bir sunucuya, Docker ile: iki dosya ve bir komut, bilgisayar işlerinize bakan kişi için birkaç dakika. Kurulum kılavuzu her şeyi adım adım anlatır.',
				},
				{
					q: 'Mevcut e-tablolarımızı aktarabilir miyiz?',
					a: 'Evet: sayfanızı CSV olarak kaydedin ve basedb’ye sürükleyin. İçe aktarma her sütunun türünü tahmin eder, tabloyu oluşturur ve neyi aktaramadığını satır satır belirtir.',
				},
				{
					q: 'Aynı anda birden fazla kişi çalışabilir mi?',
					a: 'Zaten bunun için yapıldı. Başkalarının değişiklikleri anlık olarak görünür, bir satıra yorum yazabilir, @ ile bir meslektaşınızdan bahsedebilirsiniz ve bir zil sizi haberdar eder.',
				},
				{
					q: 'Yapay zeka verilerimizi okuyor mu?',
					a: 'Sadece siz isterseniz. Bir yapay zeka sağlayıcısı yapılandırılmadığı sürece hiçbir şey gitmez. Ardından, yapay zekayı kullanan bir alan ya da otomasyon, onayınızdan sonra yalnızca talimatının andığı verileri gönderir.',
				},
				{
					q: 'Hangi dilde?',
					a: 'Kendi dilinizde: arayüz, yirmi dil arasından tarayıcınızın dilini kullanır ve herkes bunu kendi ayarlarından değiştirebilir.',
				},
			],
		},
		cta: {
			title: 'Ekibiniz paylaşılan bir dosyadan',
			titleAccent: 'daha iyisini hak ediyor.',
			text: 'Bir şablondan başlayın, meslektaşlarınızı davet edin ve “SON (2)”leri geride bırakın.',
			primary: 'Şablonları keşfet',
			secondary: 'basedb’yi kur',
		},
	},
	hero: {
		badge: 'Yeni: akış hâlinde otomasyonlar, panolar ve SQL görünümleri',
		title: ['Ortak bir veritabanı,', 'her tablosu', 'gerçek bir'],
		titleAccent: 'PostgreSQL tablosu.',
		lead: 'Paylaşılan bir elektronik tablonun sadeliği — ızgaralar, görünümler, formlar, izinler — ve <strong>tipli, açıkça adlandırılmış</strong> tablolarda yaşayan veriler. Ekibiniz arayüzde çalışır; betikleriniz, BI araçlarınız, yapay zeka ajanlarınız ve <code>psql</code> aynı satırları okur.',
		install: 'Docker ile kur',
		features: 'Özellikleri gör',
		copy: 'Komutu kopyala',
		facts: ['Kendi sunucunuzda', 'AGPL-3.0', 'REST API ve MCP sunucusu'],
		demo: {
			url: 'basedb.alan-adiniz.com',
			project: 'Ana proje',
			projectMeta: 'Proje · 2 veritabanı',
			filter: 'Veritabanlarını ve tabloları filtrele',
			sales: 'Satış',
			support: 'Destek',
			environment: 'Canlı',
			clients: 'Müşteriler',
			opportunities: 'Fırsatlar',
			quotes: 'Teklifler',
			baseSection: 'Veritabanı · Satış',
			screens: ['Panolar', 'Otomasyonlar'],
			copilot: '✦ Copilot',
			allRows: '▦ Tüm satırlar ▾',
			tools: ['Filtrele', 'Grupla', 'Renkler'],
			search: 'Ara…',
			add: '+ Ekle',
			columns: {
				name: 'Ad',
				status: 'Durum',
				amount: 'Tutar',
				client: 'Müşteri',
			},
			statuses: {
				nouveau: 'Yeni',
				qualifie: 'Nitelikli',
				proposition: 'Teklif',
				negociation: 'Müzakere',
				gagne: 'Kazanıldı',
				perdu: 'Kaybedildi',
			},
			deals: {
				portail: {
					name: 'Portal yenileme',
					client: 'Deniztepe Belediyesi',
				},
				erp: {
					name: 'ERP geçişi',
					client: 'Aksoy Grubu',
				},
				audit: {
					name: 'Güvenlik denetimi',
					client: 'Şifa Kliniği',
				},
				billetterie: {
					name: 'Çevrim içi biletleme',
					client: 'Meydan Tiyatrosu',
				},
				flotte: {
					name: 'Filo takibi',
					client: 'Karahan Taşımacılık',
				},
				mobile: {
					name: 'Mobil uygulama',
					client: 'Tuna Atölyesi',
				},
				intranet: {
					name: 'İntranet yenileme',
					client: '',
				},
			},
			toastTitle: '“Teklif talebi” formu',
			toastText: 'herkese açık yanıt · “{name}” oluşturdu',
			cursor: 'Deniz',
			psqlRows: '(2 satır)',
		},
	},
	showcase: {
		label: 'Arayüz, olduğu gibi',
		title: 'Ekibinizin paylaşılan bir elektronik tablodan beklediği her şey.',
		tabs: 'Arayüz ekran görüntüleri',
		alt: 'basedb — {labelLower}: {caption}',
		shots: {
			grille: {
				label: 'Izgara',
				caption: 'Gerçek bir tabloya yazan bir ızgara — ve hesaplanan alanlar: formülle bir süre, aramayla müşterinin şehri, sayımla görev sayısı.',
			},
			kanban: {
				label: 'Kanban',
				caption: 'Aynı satırlar, bir seçim listesine göre sütunlarda: bir kapak görseli, satıra atıf yapan bir açıklama. Bir kartı sürüklemek, satırı değiştirmektir.',
			},
			galerie: {
				label: 'Galeri',
				caption: 'Kendi görseliyle kartlar, duruma göre bir renk: galeri, bir tabloyu okumanın sekiz yolundan biri.',
			},
			chronologie: {
				label: 'Zaman çizelgesi',
				caption: 'İki tarih arasında çubuklar ve bağımlılıklarının okları — sıra artık tutmadığında kırmızı.',
			},
			tableaux: {
				label: 'Panolar',
				caption: 'Izgarada, sekmelerde, ortak filtreler altında kartlar: bir eğilim, bir hedef, yığılmış seriler — herkesin kendi izinleriyle okunur.',
			},
			automatisations: {
				label: 'Otomasyonlar',
				caption: 'Bir görev tamamlandığında projeden geriye ne kaldığını ara; hiçbir şey kalmadıysa yapay zeka bilanço notunu yazar ve proje “Teslim edildi” durumuna geçer. Her çalıştırma, akışın üzerinde adım adım okunur.',
			},
			commentaires: {
				label: 'Yorumlar',
				caption: 'Bir satır, bulunduğu yerde tartışılır: yorumlar, bahsetmeler, bildirimler.',
			},
			formulaire: {
				label: 'Form',
				caption: 'Bir form, herkese açık ya da oturum açmış üyelere ayrılmış bir bağlantıyla paylaşılır.',
			},
			historique: {
				label: 'Geçmiş',
				caption: 'Nereden gelirse gelsin her yazma — bir kişi, bir otomasyon, doğrudan SQL — önceki değerleriyle birlikte.',
			},
			sql: {
				label: 'SQL',
				caption: 'Gerçek adlar üzerinde, tüm ekip için tabloların altına kaydedilmiş bir sorgu — herkes onu kendi izinleriyle çalıştırır.',
			},
			vuesSql: {
				label: 'SQL görünümleri',
				caption: 'Tabloların arasında renkleri ve simgeleriyle yer alan gerçek PostgreSQL görünümleri — psql’den de okunabilir.',
			},
		},
	},
	features: {
		postgres: {
			label: 'PostgreSQL, çeviri katmanı olmadan',
			title: 'Ekibe bir ızgara, {araçlarınıza gerçek bir tablo.}',
			lead: 'Genel amaçlı bir model yok, her şeyin içine atıldığı bir JSON yok, <code>field_1837</code> yok: bir veritabanı bir şemadır, bir tablo bir tablodur, bir alan açıkça adlandırılmış, tipli bir sütundur.',
			bullets: [
				'<strong>Yerel türler</strong>: <code>text</code>, <code>numeric</code>, <code>date</code>, <code>timestamptz</code>, <code>boolean</code> — ve ilişkiler için gerçek yabancı anahtarlar.',
				'<strong>Veritabanının koruduğu kısıtlamalar</strong>: <code>CHECK</code> olarak tekli seçimler, doğrulanan web ve e-posta adresleri, <code>FOREIGN KEY</code> olarak ilişkiler.',
				'<strong>PostgreSQL’in hesapladığı formüller</strong>: <code>JOURS([Fin]; [Début])</code> üretilmiş bir sütuna dönüşür ve <code>psql</code> onu diğerleri gibi okur.',
				'<strong>Doğrudan SQL’e hâlâ izin verilir</strong> — ve o bile bir tetikleyiciyle geçmişe kaydedilir.',
				'<strong>Arayüzde sorgular ve SQL görünümleri</strong>: kendiniz ya da ekip için tabloların altına kaydedilen sorgular ve bunların arasında yer alan, <code>psql</code>’in de okuduğu gerçek PostgreSQL görünümleri.',
				'<strong>Yeniden adlandırmak bozmak değildir</strong>: sorgularınızı taşıyana kadar eski ad bir uyumluluk takma adıyla sunulmaya devam eder.',
			],
			links: [
				{
					href: '/integrations/sql/',
					label: 'SQL ile çalışmak',
				},
				{
					href: '/fonctionnalites/requetes-et-vues-sql/',
					label: 'Sorgular ve SQL görünümleri',
				},
				{
					href: '/architecture/principes/',
					label: 'İlkeler',
				},
			],
		},
		automations: {
			label: 'Otomatikleştir',
			title: 'Akış hâlinde otomasyonlar, {her adımda yapay zeka.}',
			lead: 'Bir satır değiştiğinde, belirli bir saatte ya da bir tıklamayla: grafik tabanlı bir düzenleyici adımları birbirine bağlar ve her çalıştırma akışın üzerinde yeniden okunur.',
			bullets: [
				'<strong>Okunaklı bir akış</strong>: tetikleyici, ardından kart olarak her adım; bir çizgi üzerindeki <strong>+</strong> o noktaya bir adım ekler.',
				'<strong>Ara, karar ver, yaz</strong>: bir satır bul, koşullara göre bir dala ya da diğerine gir, düzenle, oluştur, haber ver, bir webhook çağır, Slack’e yaz.',
				'Bir adımda <strong>yapay zekaya sorun</strong>: satıra atıf yapan bir talimat; metin, sayı, tarih ya da seçim olarak okunan ve sonraki adımların yeniden kullandığı bir yanıt.',
				'<strong>Copilot</strong> tek bir cümleden eksiksiz bir otomasyon önerir ya da bir çalıştırmanın neden başarısız olduğunu açıklar — siz onaylamadan hiçbir şey kaydedilmez.',
				'<strong>Onu yazanın izinleriyle</strong> çalışır ve diğer her yazma gibi geçmişe geçer.',
			],
			links: [
				{
					href: '/fonctionnalites/automatisations/',
					label: 'Otomasyonlar',
				},
				{
					href: '/fonctionnalites/automatisations/#copilot',
					label: 'Copilot',
				},
			],
			alt: 'basedb — akış düzenleyicisinde “Proje teslim edildi” otomasyonu: bir görev tamamlandığında saati not et, projeden geriye ne kaldığını ara, “Aksi halde” dalına gir, yapay zekadan bilanço notunu iste, ardından projeyi teslim et; sağda, son çalıştırmaları adım adım.',
		},
		dashboards: {
			label: 'Analiz et',
			title: 'Panolar, {tablolarınızdan hiç çıkmadan.}',
			lead: 'Fareyle ya da SQL ile sorulan sorular, on beş görselleştirme, ortak filtreler — herkes onları kendi izinleriyle okur.',
			bullets: [
				'<strong>Sorular</strong>: bir tablo, birleştirmeleri, filtreler ve güne, haftaya, aya ya da yıla göre ölçüler — ya da salt okunur SQL.',
				'<strong>On beş görselleştirme</strong>: sayı, eğilim, hedef, gösterge, çubuklar, çizgiler, pasta, huni, pivot tablo, harita…',
				'<strong>Tek tıkla keşfedin</strong>: bir nokta kendi satırlarını ya da daha ince bir dönemi açar.',
				'Bir, birkaç ya da tüm kartları yöneten <strong>ortak filtreler</strong>.',
				'<strong>Bir bağlantıyla paylaşın</strong>, herkese açık ya da üyelere özel; başka bir siteye de yerleştirin.',
			],
			links: [
				{
					href: '/fonctionnalites/tableaux-de-bord/',
					label: 'Panolar',
				},
			],
			alt: 'basedb — bir pano: ayın eğilimi, tahsilat hedefi, aylara göre ciro, yorumların duygu durumu; dönem ve müşteri filtreleri altında.',
		},
		rights: {
			label: 'Her şeyi açmadan işbirliği',
			title: 'Alan düzeyine kadar izinler, {eksiksiz bir geçmiş.}',
			lead: 'İzinler gruplara; bir proje, bir veritabanı ya da bir tablo üzerinde verilir ve altındaki her şeye iner. Hassas bir sütun bir gruptan gizlenebilir ya da o grup için değiştirilemez hâle getirilebilir.',
			bullets: [
				'<strong>Dört düzey</strong>: Erişim yok, Okuma, Düzenleme, Yönetim — bir gruptan diğerine toplanır.',
				'<strong>SQL bile izinlerinize uyar</strong>: arayüzde bir sorgu yalnızca size açık tabloları ve alanları görür — bunu uygulayan PostgreSQL’in kendisidir.',
				'<strong>Her yazma kaydedilir</strong>, kendi işlemi içinde: arayüz, API, ajan, herkese açık form ya da doğrudan SQL.',
				'<strong>Bir değişiklik geri alınır</strong>, silinen bir satır geri yüklenir, silinen bir veritabanı da.',
				'<strong>Yönetim onay ister</strong>: bir izni değiştirmek için son beş dakika içinde şifrenizi yeniden girmiş olmanız gerekir.',
			],
			links: [
				{
					href: '/fonctionnalites/droits/',
					label: 'İzinler ve gruplar',
				},
				{
					href: '/fonctionnalites/historique/',
					label: 'Geçmiş',
				},
			],
		},
		agents: {
			label: 'REST API · MCP · webhook’lar',
			title: 'Yapay zeka ajanlarınız verilere erişir, {kasanın anahtarlarına değil.}',
			lead: 'MCP sunucusu ajanlara on iki araç verir; REST API ise aynı verileri programlarınıza. Tek bir izin denetim noktası, aynı günlükler.',
			bullets: [
				'<strong>Veritabanı başına bir token</strong>: varsayılan olarak salt okunur, onu oluşturan kişiden asla daha fazla izne sahip değil.',
				'<strong>Bir ajan hiçbir şey silmez</strong> ve yapıyı değiştirmez: değişikliği önerir, bir kişi onaylar.',
				'Her veritabanı için <strong>otomatik oluşturulan belgeler</strong>: izinlerinize göre filtrelenmiş, OpenAPI 3.1 belirtimiyle birlikte.',
				'Her yazmada imzalı, sıralı ve yeniden denenen <strong>webhook’lar</strong>.',
			],
			links: [
				{
					href: '/integrations/mcp/',
					label: 'Bir ajan bağlayın',
				},
				{
					href: '/integrations/api-rest/',
					label: 'REST API',
				},
			],
		},
	},
	sqlVisual: {
		interface: 'Arayüz',
		title: 'Yeni alan · Fırsatlar',
		labelField: 'Etiket',
		labelValue: 'Tutar',
		typeField: 'Tür',
		typeValue: 'Sayı',
		descriptionField: 'Açıklama',
		descriptionValue: 'Sözleşmenin KDV hariç tutarı',
		required: 'Zorunlu',
		ai: 'Yapay zeka',
		migration: 'planlanmış bir geçiş, kısa kilitler',
	},
	rightsVisual: {
		groups: ['Yöneticiler', 'Satış ekibi', 'Destek'],
		project: 'Ana proje',
		sales: 'Satış',
		opportunities: 'Fırsatlar',
		clients: 'Müşteriler',
		support: 'Destek',
		inherited: 'devralındı',
		levels: {
			none: 'Erişim yok',
			read: 'Okuma',
			edit: 'Düzenleme',
			manage: 'Yönetim',
		},
		field: '“Marj” alanı',
		hidden: 'Gizli',
		sqlChange: '<b>Doğrudan SQL oturumu</b>, <b>“ERP geçişi”</b> satırını değiştirdi',
		sqlMeta: '02:46 · yerel bağlantı · psql',
		sqlDiff: 'Tutar: <s>125.000</s> → 130.000',
		undo: '↶ Geri al',
		formChange: '<b>“Teklif talebi” formu</b>, <b>“İntranet yenileme”</b> satırını oluşturdu',
		formMeta: 'herkese açık yanıt · Deniz tarafından yayımlandı',
	},
	agentVisual: {
		agent: 'Ajan',
		via: 'MCP ile bağlı · “Satış” token’ı',
		question: 'Müzakere aşamasında kaç fırsat var ve toplam tutarları ne?',
		listArgs: 'opportunites · statut = Müzakere',
		answer: 'İki fırsat, toplam <b>182.000 €</b>: ERP geçişi (130.000 €) ve Filo takibi (52.000 €).',
		request: 'Yüzde olarak bir “Olasılık” alanı ekle.',
		proposeArgs: 'opportunites · Olasılık · number',
		proposed: 'Önerildi: ekipten birinin bunu basedb’de onaylaması gerekiyor.',
		badge: 'Öneri',
		expires: '23 saat içinde sona eriyor',
		what: '<b>Fırsatlar</b> tablosuna <b>“Olasılık”</b> alanını (Sayı) ekle',
		by: 'Ajan tarafından önerildi · “Satış” token’ı',
		refuse: 'Reddet',
		approve: 'Onayla',
	},
	bento: {
		label: 'Ve geri kalan her şey',
		title: 'Bir ekip aracından beklenen her şey, PostgreSQL’den vazgeçmeden.',
		text: 'Her işlev aynı tablolara, aynı izinler altında, aynı geçmişe yazar.',
		more: 'Daha fazla bilgi →',
		views: {
			title: 'Aynı satırlar üzerinde sekiz görünüm',
			text: 'Tüm ekip için ortak ya da yalnızca kendiniz için kişisel: herkes kendi okuma biçimini seçer, kimse verileri kopyalamaz.',
			chips: ['Izgara', 'Kanban', 'Takvim', 'Zaman çizelgesi', 'Galeri', 'Liste', 'Form', 'Anket'],
		},
		forms: {
			title: 'Paylaşılan formlar',
			text: 'Herkese açık ya da oturum açmış üyelere ayrılmış bir bağlantı. Yanıt vermek, tablo üzerinde hiçbir izin vermez.',
			href: '/fonctionnalites/formulaires-partages/',
		},
		environments: {
			title: 'Ortamlar',
			text: 'Tek veritabanı, birden çok varyant. Yapıyı karşılaştırın, birinden diğerine taşıyın, satırları senkronize edin.',
			chips: ['Canlı', 'Test', 'Geliştirme'],
			href: '/fonctionnalites/environnements/',
		},
		collaboration: {
			title: 'Birlikte çalışmak',
			text: 'Başkalarının yazdıkları gerçek zamanlı gelir, kimin hangi satıra baktığını görürsünüz ve satırı bulunduğu yerde tartışırsınız: yorumlar, bahsetmeler, bildirimler. Ctrl+Z son yazmayı geri alır ve başkasının işinin üzerine yazmak yerine reddeder.',
			chips: ['Gerçek zamanlı', 'Çevrimiçi durum', 'Yorumlar', 'Bahsetmeler', 'Ctrl+Z'],
			href: '/fonctionnalites/collaboration/',
		},
		small: {
			ai: {
				title: 'Izgarada yapay zeka',
				text: 'Diğer sütunlardan yola çıkarak bir modelin doldurduğu bir alan ve filtreler, sorgular ve sütunlar önerip bunları tek tıkla uygulayan bir Copilot. OpenAI, Anthropic, Mistral ya da kendi makinenizde servis edilen bir model.',
				code: '{{Notes}} alanını tek cümleyle özetle',
				href: '/fonctionnalites/ia/',
			},
			formulas: {
				title: 'İlişkiler ve formüller',
				text: 'Gerçek yabancı anahtarlar, Fransızca yazılıp PostgreSQL’in hesapladığı formüller ve ilişkiler üzerinden aramalar, toplamalar ve sayımlar.',
				code: 'ARRONDI([Montant HT] * (1 + [Taux de TVA]); 2)',
				href: '/fonctionnalites/tables-et-champs/#formüller',
			},
			richText: {
				title: 'Zengin metin ve değişkenler',
				text: 'Biçimlendirilmiş metin için yazılırken temizlenen görsel bir düzenleyici; ve her uzun metinde {{Ville}}, satırın değeriyle okunur.',
				code: '{{Date}} tarihinde {{Ville}} teslimatı',
				href: '/fonctionnalites/tables-et-champs/#zengin-metin-ve-değişkenler',
			},
			languages: {
				title: 'Kendi dilinizde',
				text: 'Arayüz, yirmi dil arasından tarayıcının dilini kullanır; herkes bunu kendi ayarlarından değiştirebilir.',
				href: '/fonctionnalites/droits/#ayarlarınız',
			},
			sharedViews: {
				title: 'Paylaşılan görünümler',
				text: 'Bir bağlantıyla salt okunur bir görünüm, başka bir siteye yerleştirilebilir; bir takvim, ajandanız için bir akışa dönüşür.',
				href: '/fonctionnalites/vues-partagees/',
			},
			syncedTables: {
				title: 'Senkronize tablolar',
				text: 'Çevrim içi bir CSV’den, bir ajandadan ya da başka bir basedb’nin paylaşılan görünümünden güncel tutulan bir tablo.',
				href: '/integrations/synchronisation/',
			},
			templates: {
				title: 'Veritabanı şablonları',
				text: 'Kullanıma hazır on şablon, yapay zekaya tek cümleyle anlatılan bir veritabanı ve şablon olarak kaydedilen kendi veritabanınız.',
				href: '/modeles/',
			},
			files: {
				title: 'Dosyalar ve görseller',
				text: 'Sunucunun diskinde ya da S3 uyumlu bir depolamada: AWS, Scaleway, OVH, Cloudflare R2, Garage, MinIO…',
				href: '/fonctionnalites/fichiers/',
			},
			import: {
				title: 'CSV ve JSON içe aktarma',
				text: 'Bir dosya sürükleyin: içe aktarma türleri tahmin eder, tabloyu oluşturur ya da var olan bir tabloyu tamamlar ve neyin reddedildiğini satır satır söyler.',
				href: '/guides/premiers-pas/',
			},
			accounts: {
				title: 'Hesaplar ve davetler',
				text: 'Herkes kendi hesabını ve projelerini oluşturur, bir bağlantıyla Okuma, Düzenleme ya da Yönetim düzeyinde davet eder; şifreyle, Google, Microsoft ya da herhangi bir OpenID Connect sağlayıcısıyla giriş.',
				href: '/hebergement/connexion/',
			},
			webhooks: {
				title: 'Webhook’lar',
				text: 'Her yazma başka bir sisteme haber verebilir: imzalı, sırayla teslim edilen, yeniden denenen yükler.',
				href: '/integrations/webhooks/',
			},
			settings: {
				title: 'Kişisel ayarlar',
				text: 'Diliniz, temanız, tarih sırası, bildirimleriniz, oturumlarınız ve token’larınız tek bir yerde.',
				href: '/fonctionnalites/droits/#ayarlarınız',
			},
		},
	},
	selfHost: {
		label: 'Kendi sunucunuzda',
		title: 'Verileriniz {sizde kalır.}',
		lead: 'basedb özgür bir yazılımdır (AGPL-3.0): tek bir imaj, bir PostgreSQL veritabanı, o kadar — dayatılan üçüncü taraf hizmeti yok, telemetri yok. <code>pg_dump</code> ile yedekleyin, herhangi bir PostgreSQL istemcisiyle okuyun.',
		services: {
			db: 'PostgreSQL 16, verileriniz',
			basedb: 'Arayüz, REST API ve MCP sunucusu, tek bir portta',
			proxy: 'Caddy, otomatik HTTPS (isteğe bağlı)',
		},
		links: [
			{
				href: '/hebergement/docker/',
				label: 'Docker Compose kılavuzu →',
			},
			{
				href: '/hebergement/variables/',
				label: 'Tüm değişkenler →',
			},
		],
		steps: [
			{
				title: 'basedb’yi indirin',
				code: 'git clone https://github.com/eodia/basedb.git\ncd basedb && cp .env.example .env',
			},
			{
				title: '.env içinde iki gizli anahtar',
				code: 'POSTGRES_PASSWORD=guclu-bir-sifre\n# openssl rand -base64 32\nBASEDB_ENCRYPTION_KEY=…',
			},
			{
				title: 'Başlatın',
				code: 'docker compose up -d\n# ardından http://localhost:3000: hesabınızı oluşturun',
			},
		],
	},
	faq: {
		label: 'Sık sorulan sorular',
		title: 'Bize sık sorulanlar.',
		text: 'Başka bir sorunuz mu var? <a href="/guides/introduction/">Belgeler</a> büyük olasılıkla yanıtlıyor.',
		items: {
			difference: {
				q: 'basedb diğer ortak veritabanlarından nasıl ayrılır?',
				a: 'Verilerin yaşadığı yerle. Başkaları satırlarınızı genel amaçlı bir modelde (numaralı sütunlar, JSON belgeleri) saklarken basedb her tablo için gerçek bir PostgreSQL tablosu, her alan için gerçek, tipli bir sütun oluşturur; adlar da okunaklıdır. Verileriniz basedb olmadan da kullanılabilir kalır.',
			},
			sql: {
				q: 'Tablolara doğrudan SQL ile yazabilir miyim?',
				a: 'Evet. Kısıtlamaları (türler, zorunlu alanlar, tekli seçimler, yabancı anahtarlar) PostgreSQL’in kendisi korur ve bir tetikleyici, doğrudan SQL ile yapılan yazmaları bile onları yapan oturumla birlikte geçmişe kaydeder. Arayüzün SQL konsolu ve psql aynı tabloları okur; arayüzde herkes kendi izinleriyle SQL yazar, sorgularını kaydeder ve veritabanını yönetiyorsa onlardan gerçek PostgreSQL görünümleri yapar.',
			},
			ai: {
				q: 'Bir yapay zeka sağlayıcısına ne gider?',
				a: 'Bir sağlayıcı yapılandırmadığınız sürece hiçbir şey. Sonrasında, yapı taslakları ve Copilot için varsayılan olarak yalnızca yapı ve cümleniz gider; Copilot’un verileri okuması, konuşma başına işaretlenen bir onay kutusudur. Yapay zekadan istenen bir veritabanı şablonu yalnızca cümlenizi gönderir. Bir yapay zeka alanı, açık bir onaydan sonra talimatının andığı sütunları gönderir.',
			},
			together: {
				q: 'Aynı tablo üzerinde birkaç kişi çalışabilir mi?',
				a: 'Evet. Başkalarının yazdıkları sayfayı yenilemeden görünür; baktıkları tablonun ya da satırın üzerinde yüzleri belirir. Bir satıra yorum yazar, @ ile birinden bahsedersiniz; zil haber verir. Ctrl+Z ise yalnızca sizin yazdıklarınızı geri alır: o zamandan beri başkasının değiştirdiğinin üzerine yazmak yerine reddeder.',
			},
			languages: {
				q: 'Hangi dillerde?',
				a: 'Yirmi dilde: Fransızca, İngilizce, Almanca, İspanyolca, İtalyanca, Brezilya Portekizcesi, Felemenkçe, Lehçe, Çekçe, İsveççe, Danca, Norveççe, Fince, Rumence, Macarca, Türkçe, Ukraynaca, Japonca, Basitleştirilmiş Çince ve Korece. Arayüz tarayıcının dilini kullanır ve herkes bunu ayarlarından değiştirebilir; bu site ve belgeler de aynı dillerde mevcuttur.',
			},
			agent: {
				q: 'Bir yapay zeka ajanı nasıl bağlanır?',
				a: 'MCP sunucusu üzerinden, tek bir veritabanıyla sınırlı ve varsayılan olarak salt okunur bir entegrasyon token’ıyla. Bir ajan, izinlerine göre satırları okur, oluşturur ve düzenler; hiçbir şey silmez ve yapıyı değiştirmez: değişikliği önerir, bir kişi onaylar.',
			},
			postgres: {
				q: 'Hangi PostgreSQL sürümü gerekiyor?',
				a: 'PostgreSQL 16 ya da daha yenisi; pg_trgm ve unaccent uzantılarıyla (resmî imajda mevcuttur). Birlikte gelen docker-compose bir PostgreSQL 16 başlatır; DATABASE_URL değişkenini kendi sunucunuza da yönlendirebilirsiniz.',
			},
			production: {
				q: 'Canlı kullanıma hazır mı?',
				a: 'basedb aktif olarak geliştiriliyor: çekirdek, API, MCP sunucusu ve arayüz çalışıyor ve binden fazla testle güvence altında, ancak bazı işlevler henüz gelecek (yol haritasına bakın). Deneyin ve veritabanınızı her PostgreSQL veritabanı gibi yedekleyin.',
			},
			license: {
				q: 'Hangi lisansla?',
				a: 'AGPL-3.0-or-later. Onu özgürce kullanabilir, değiştirebilir ve barındırabilirsiniz; değiştirilmiş bir sürümü hizmet olarak sunarsanız kaynak kodunu paylaşırsınız.',
			},
		},
	},
	cta: {
		title: 'Verileriniz {gerçek tabloları hak ediyor.}',
		text: 'basedb’yi birkaç dakikada kurun, ekibinizi davet edin ve her satırın kontrolünü elinizde tutun.',
		install: 'basedb’yi kur',
		github: 'Kodu GitHub’da gör',
	},
	changelog: {
		label: 'Yenilikler',
		title: 'basedb’de neler değişti',
		intro: 'Her değişikliğin ayrıntısı <a href="https://github.com/eodia/basedb/commits/main">deponun geçmişinde</a>. Sırada ne var: <a href="/feuille-de-route/">yol haritası</a>.',
		entries: {
			languages: {
				date: '2026-09-27',
				title: 'Zengin metin, değişkenler, daha okunaklı bir kanban',
				tag: 'Yeni',
				items: [
					'<strong>Zengin metin</strong>: görsel bir düzenleyicide biçimlendirilen yeni bir alan türü — başlıklar, listeler, alıntılar, bağlantılar —; yazılırken temizlenir ve doğrudan SQL’e karşı bir kısıtlamayla korunur. <a href="/fonctionnalites/tables-et-champs/#zengin-metin-ve-değişkenler">Zengin metin ve değişkenler</a>',
					'<strong>Değişkenler</strong>: uzun bir metin kendi satırının bir sütununa atıf yapar — <code>{{Ville}}</code> — ve her yerde onun değeriyle okunur: ızgara, satır ayrıntıları, API, MCP sunucusu, paylaşılan görünümler, otomasyonlar. Sütun, <code>psql</code>’in okuduğu atfı saklar.',
					'<strong>Daha okunaklı bir kanban</strong>: daha ferah kartlar, bir kapak görseli ve satırın değerlerine atıf yapan bir açıklama — “{{Client}} için {{Date}} tarihinde teslimat”. <a href="/fonctionnalites/vues/">Görünümler</a>',
					'<strong>Tek hamlede yeniden adlandırma</strong>: bir veritabanı, bir tablo ya da bir alan için tek bir iletişim kutusu; etiket her zaman değişir ve bir yönetici, etki analizine dayanarak veritabanında da yeniden adlandırabilir. <a href="/fonctionnalites/tables-et-champs/#yapıyı-değiştirme">Yapıyı değiştirme</a>',
					'<strong>Yirmi dil</strong>: arayüz, bu site ve belgeler Fransızca, İngilizce, Almanca, İspanyolca, İtalyanca, Portekizce (Brezilya), Felemenkçe, Lehçe, Çekçe, İsveççe, Danca, Norveççe, Fince, Rumence, Macarca, Türkçe, Ukraynaca, Japonca, Basitleştirilmiş Çince ve Korece. basedb tarayıcının dilini kullanır; <strong>Ayarlar › Görünüş › Dil</strong> başka bir dil belirler ve bu seçim sizi bir bilgisayardan diğerine izler. Sayılar ve tarihler dili izler. <a href="/fonctionnalites/droits/#ayarlarınız">Ayarlarınız</a>',
				],
			},
			aiProvider: {
				date: '2026-09-27',
				title: 'Seçtiğiniz yapay zeka, kendi sunucunuzda bile',
				tag: 'Yeni',
				items: [
					'<strong>Dördüncü bir yapay zeka sağlayıcısı</strong>: OpenAI’nin API’sini konuşan her sunucu — Azure, bir kurumsal geçit, kendi makinenizde servis edilen bir model —, <code>.env</code> içinde tanımlanır. Çağrı günlüğü, verilerin kime gittiğini söyler. <a href="/fonctionnalites/ia/">basedb’de yapay zeka</a>',
					'<strong>Giriş ekranı</strong>, ızgara ve SQL’den sonra, bir filtreyi takip eden bir pano ve yapay zeka adımı dahil çalışan bir otomasyonu gösterir.',
				],
			},
			flows: {
				date: '2026-09-27',
				title: 'Akış hâlinde otomasyonlar',
				tag: 'Yeni',
				items: [
					'<strong>Grafik tabanlı bir düzenleyici</strong>: tetikleyici, ardından kart olarak her adım; bir çizgi üzerindeki <strong>+</strong> o noktaya bir adım ekler. Basit bir otomasyon hâlâ iki karta sığar. <a href="/fonctionnalites/automatisations/">Otomasyonlar</a>',
					'<strong>Bir satır arayın</strong> — bir siparişin müşterisi, ödenmemiş son fatura — ardından onu düzenleyin, ona atıf yapın, oluşturulan bir satıra bağlayın.',
					'<strong>Birkaç dallı koşullar</strong>: koşulu sağlanan ilk dal izlenir, hiçbiri sağlanmadığında “Aksi halde”; dallar ardından yeniden birleşir.',
					'<strong>Veriler adımdan adıma geçer</strong>: <code>{{e2.client}}</code> bir adımın bulduğuna ya da oluşturduğuna, <code>{{e3.reponse.numero}}</code> bir webhook’un yanıtına atıf yapar; her metnin menüsü yalnızca daha önce kesinlikle gerçekleşmiş olanı önerir.',
					'<strong>Her çalıştırma, adım adım</strong>: akışın üzerine yerleştirilir, izlenen yolu çizer ve her adım için ne yaptığını ve ne kadar sürdüğünü söyler.',
					'<strong>Otomasyonların Copilot’u</strong>: veritabanının kendiliğinden ne yapması gerektiğini anlatın ya da bir çalıştırmanın neden başarısız olduğunu sorun; eksiksiz bir otomasyon önerir, siz onu tek tıkla akışa yerleştirir, gözden geçirir, ardından kaydedersiniz — siz onaylamadan hiçbir şey kaydedilmez. <a href="/fonctionnalites/automatisations/#copilot">Copilot</a>',
					'Bir adımda, tıpkı bir yapay zeka alanında olduğu gibi <strong>yapay zekaya sorun</strong>: satıra ve önceki adımlara atıf yapan bir talimat; metin, sayı, evet ya da hayır, tarih ya da bir listeden seçim olarak okunan ve sonraki adımların yazdığı ya da gönderdiği bir yanıt. <a href="/fonctionnalites/automatisations/#yapay-zekaya-sor">Yapay zekaya sor</a>',
				],
			},
			dashboards: {
				date: '2026-09-27',
				title: 'Panolar: sorular, grafikler, filtreler',
				tag: 'Yeni',
				items: [
					'Fareyle sorulan — bir tablo, birleştirmeleri, filtreler, güne, haftaya, aya ya da yıla göre ölçüler — ya da salt okunur olarak ve değişkenler dahil kendi izinlerinizle <strong>SQL</strong> ile yazılan <strong>sorular</strong>. <a href="/fonctionnalites/tableaux-de-bord/">Panolar</a>',
					'<strong>On beş görselleştirme</strong>: sayı, önceki döneme göre eğilim, bir hedefe doğru ilerleme, gösterge, histogram, çubuklar, çizgi, alan, birleşik, pasta, huni, dağılım grafiği, tablo, pivot tablo, Fransa ya da dünya haritası.',
					'<strong>Tek tıkla keşfedin</strong>: bir nokta kendi satırlarını, daha ince bir dönemi, başka bir dağılımı açar.',
					'<strong>Izgara düzeninde panolar</strong>: fareyle taşınan ve yeniden boyutlandırılan kartlar, sekmeler, bölüm başlıkları, metinler, yerleştirilmiş sayfalar.',
					'<strong>Ortak filtreler</strong> — dönem, kategori, metin, sayı, tarih gruplaması — bir, birkaç ya da tüm kartları varsayılan bir değerle yönetir.',
					'<strong>Size göre grafikler</strong>: her serinin ya da her dilimin rengi ve adı; halka, yarım daire ya da gül; toplamlarla yığma, yumuşatılmış ya da basamaklı çizgiler, eksenler, ölçek çizgileri, logaritmik ölçek; sütunları yeniden adlandırılmış, değere göre çubuklu ve renkli tablolar.',
					'<strong>Panoların Copilot’u</strong>: sorular, panoda — geri alınabilir — değişiklikler ve filtreleri için değerler öneren, tek tıkla uygulanan bir konuşma. Sonuçları okumasına izin vermediğiniz sürece sağlayıcıya yalnızca yapı gider. <a href="/fonctionnalites/tableaux-de-bord/#copilot">Copilot</a>',
					'<strong>Bir panoyu paylaşın</strong>: herkese açık ya da üyelere — gerekirse belirli gruplara — ayrılmış bir bağlantıyla; başka bir siteye de yerleştirin: kartlar ve filtreler salt okunurdur, onu yayımlayanın izinleriyle okunur. <a href="/fonctionnalites/tableaux-de-bord/#bir-panoyu-paylaşma">Paylaşma</a>',
					'“Arayüzler” artık <strong>Panolar</strong> adını taşıyor; mevcut panolar olduğu gibi, yeni ızgara üzerinde açılır.',
				],
			},
			sqlViews: {
				date: '2026-09-27',
				title: 'Kayıtlı sorgular ve SQL görünümleri',
				tag: 'Yeni',
				items: [
					'<strong>Herkes için SQL</strong>: Yönetim düzeyi olmadan bir SQL sekmesi salt okunur olarak, PostgreSQL’in kendisinin uyguladığı kendi izinlerinizle çalışır — kapalı bir tablo yoktur, gizli bir alan reddedilir. “İzinleriniz” rozeti bunu hatırlatır. <a href="/fonctionnalites/requetes-et-vues-sql/">Sorgular ve SQL görünümleri</a>',
					'<strong>Kayıtlı sorgular</strong>, tabloların altında “Sorgular” bölümünde: kişisel, tüm veritabanı için ya da gruplar için. Bir sorguyu paylaşmak onun metnini paylaşır, asla yazarının okuyabildiklerini değil; kenar çubuğundan açıldığında hemen salt okunur olarak çalışır.',
					'<strong>SQL görünümleri</strong>: tabloların arasında bir renk, bir simge ve küçük bir gözle yer alan, <code>psql</code>’den ve araçlarınızdan da okunabilen gerçek PostgreSQL görünümleri. Herkes onları kendi izinleriyle okur ve kenar çubuğu onları yalnızca içeriklerinin tamamını okuyabilenlere gösterir.',
					'Görünümler yapıyı izler: bir yeniden adlandırma onları bozmaz, değişen bir formül onları bir an kaldırıp yeniden koyar; artık tutmayan görünüm, tanımı saklanarak düzeltilmeyi bekler.',
				],
			},
			settings: {
				date: '2026-09-27',
				title: 'Ayarlarınız',
				tag: 'Yeni',
				items: [
					'Profil menüsünde <strong>Ayarlar</strong>: adınız, adresiniz ve hesabınıza bağlı kimlik sağlayıcıları; şifreniz ve açık oturumlarınız. <a href="/fonctionnalites/droits/">Hesaplar ve giriş</a>',
					'<strong>Görünüş</strong>: tema, tarihlerin sırası — <code>25/09/2026</code> ya da <code>2026-09-25</code> — ve takvimlerde haftanın ilk günü; son ikisi sizi bir bilgisayardan diğerine izler.',
					'<strong>Bildirimler</strong>: artık istemediklerinizi, türüne göre tek tek kapatın. <strong>Token’lar</strong>: tüm veritabanlarınızda oluşturduklarınız, son kullanımları ve iptalleri.',
				],
			},
			v020: {
				date: '2026-09-26',
				title: 'Sürüm 0.2.0: herkese kendi hesabı, projeleri, davetleri',
				tag: 'Yeni',
				items: [
					'<strong>İlk giriş</strong>: yeni bir kurulumda ilk sayfa, adresiniz ve şifrenizle yönetici hesabını oluşturur — artık varsayılan hesap yok, günlüklerde aranacak şifre yok. <a href="/guides/installation/">Kurulum</a>',
					'<strong>Hesap oluşturma</strong>: herkes kendi hesabını, ardından yöneticisi olacağı kendi projelerini oluşturur. Yönetim paneli bunu kapatabilir ya da belirli alan adlarına ayırabilir. <a href="/hebergement/connexion/">Hesaplar ve giriş</a>',
					'<strong>Bir projeyi ya da veritabanını paylaşma</strong>: Yönetim düzeyine sahip olan kişi, bir bağlantıyla Okuma, Düzenleme ya da Yönetim düzeyinde davet eder; kimin erişimi olduğunu görür, bir düzeyi değiştirir, kaldırır. Asla yönettiğinden fazlasını veremez.',
					'<strong>Gizlilik</strong>: herkes artık yalnızca bir projeyi paylaştığı kişileri görür ve başkasının aldığı bir proje adı artık tahmin edilemez.',
					'<strong>Google ve Microsoft ile giriş</strong>, ayrıca <code>.env</code> içinde tanımlanan herhangi bir OpenID Connect sağlayıcısıyla (Keycloak, GitLab…); hesap oluşturma izin veriyorsa ilk giriş hesabı oluşturur. <a href="/hebergement/connexion/">Yapılandırma</a>',
					'<strong>Yeni giriş ekranı</strong>: uygulamanın temasında, açık ya da koyu, ölçülü bir animasyonla; uygulamanın içinde resimli boş ekranlar.',
					'<strong>Kayıpsız güncellemeler</strong>: basedb, 0.1 kurulumları dahil, başlangıçta kataloğunu kendiliğinden günceller ve daha yeni bir sürümün zaten güncellediği bir veritabanında başlamayı reddeder. <a href="/hebergement/sauvegardes/">Güncelleme</a>',
				],
			},
			dockerImage: {
				date: '2026-09-26',
				title: 'Tek bir Docker imajı',
				tag: 'Barındırma',
				items: [
					'basedb <strong>tek bir imaja</strong> sığar: Docker Hub’daki <code>eodia/basedb</code>, amd64 ve arm64 için; arayüz, <code>/api</code> altında API ve <code>/mcp</code> altında MCP sunucusu, <strong>tek bir portta</strong>. <a href="/guides/installation/">Kurulum</a>',
					'İki dosya yeterli — <code>docker-compose.yml</code> ve <code>.env</code> — depoyu klonlamadan ya da hiçbir şey derlemeden; güncelleme <code>docker compose pull</code> ile yapılır.',
					'Bir alan adının arkasında HTTPS proxy’sinin artık yapacağı bir yönlendirme yok: her şey 3000 portuna gider.',
				],
			},
			automations: {
				date: '2026-09-26',
				title: 'Otomasyonlar, arayüzler, formüller, işbirliği',
				tag: 'Yeni',
				items: [
					'Fransızca <strong>formüller</strong> — <code>SI</code>, <code>ARRONDI</code>, <code>JOURS</code>… — PostgreSQL’in ürettiği sütunlara dönüştü; ilişkiler üzerinden <strong>aramalar</strong>, <strong>toplamalar</strong> ve <strong>sayımlar</strong>. <a href="/fonctionnalites/tables-et-champs/">Alanlar</a>',
					'<strong>Yeni türler</strong>: çoklu ilişki, kişi, e-posta, otomatik numara, düğme; ve tür gibi seçilen biçimler — para birimi, yüzde, süre, yıldızlı derecelendirme, telefon, barkod.',
					'<strong>Sekiz görünüm</strong>: <strong>galeri</strong> ve <strong>liste</strong> diğer altısına katılıyor; her okuyucu için <strong>kişisel görünümler</strong>, kilitli görünümler, elle sıralama, zaman çizelgesinde bağımlılıklar. <a href="/fonctionnalites/vues/">Görünümler</a>',
					'<strong>Izgara</strong>: hızlı arama, gruplama, tüm filtre üzerinde sütun başına özet, kurallara göre renkler, satır yüksekliği.',
					'Salt okunur, başka bir siteye yerleştirilebilen <strong>paylaşılan görünümler</strong>; bir takvim, Google Takvim, Outlook ya da Apple Takvim için bir <strong>iCalendar akışına</strong> dönüşür. <a href="/fonctionnalites/vues-partagees/">Paylaşım</a>',
					'<strong>İşbirliği</strong>: yorumlar ve bahsetmeler, bildirimler, başkalarının gerçek zamanlı yazdıkları, tablo ve satır üzerinde çevrimiçi durum. <a href="/fonctionnalites/collaboration/">Birlikte çalışmak</a>',
					'<strong>Ctrl+Z</strong> son yazmayı geri alır — bir hücre, taşınan bir kart, koca bir içe aktarma — ve o zamandan beri başkasının değiştirdiğinin üzerine yazmak yerine reddeder.',
					'<strong>Otomasyonlar</strong>: bir satır oluşturulduğunda ya da değiştirildiğinde, belirli bir saatte ya da bir düğmeye tıklandığında — düzenle, oluştur, haber ver, bir webhook çağır, Slack’e yaz. <a href="/fonctionnalites/automatisations/">Otomatikleştirme</a>',
					'<strong>Arayüzler</strong>: herkesin kendi izinleriyle okunan panolar — sayılar, grafikler, listeler, metinler. <a href="/fonctionnalites/tableaux-de-bord/">Panolar</a>',
					'<strong>Entegrasyonlar</strong>: bir Slack kanalı ve çevrim içi bir CSV’den, bir ajandadan ya da başka bir basedb’nin görünümünden <strong>senkronize tablolar</strong>. <a href="/integrations/synchronisation/">Entegrasyonlar</a>',
					'<strong>Veritabanı şablonları</strong>: on şablonluk bir galeri, yapay zekaya tek cümleyle anlatılan bir veritabanı ve şablon olarak kaydedilebilen her veritabanı. <a href="/modeles/">Galeri</a>',
					'<strong>İzinler</strong>: Yönetim düzeyi olmayanlar için Yapı ekranı salt görüntüleme moduna geçer.',
					'<strong>Yeni kimlik</strong>: bir logo, bir renk paleti ve yeniden tasarlanan bir giriş ekranı.',
				],
			},
			simpler: {
				date: '2026-09-26',
				title: 'Daha sade bir arayüz',
				items: [
					'<strong>Kenar çubuğu</strong> artık yalnızca veritabanlarını ve tablolarını listeliyor; açık veritabanının ekranları — Yapı, Geçmiş, Arayüzler, Otomasyonlar — profilin hemen üstünde tek bir blokta toplanıyor.',
					'<strong>Profil menüsü</strong> veri olmayanları barındırır: API ve MCP belgeleri, entegrasyonlar, kullanıcılar ve izinler.',
					'<strong>Bir SQL sorgusu</strong>, sekme çubuğundaki “+” ile ya da veritabanının menüsünden açılır; kenar çubuğunda tekrar yok.',
					'<strong>Yeni veritabanı</strong>, daha iletişim kutusunda şablonları ve yapay zekayı sunar; demo veritabanı da aynı galeriden geçer.',
					'<strong>Ekran artık reddedilecek olanı önermiyor</strong>: Yönetim olmadan yapı düğmesi yok, silme izni olmadan “Sil” yok; ve bir okuyucu bir hata mesajına takılmak yerine kendi görünümlerini oluşturur.',
					'<strong>Sistem sütunları</strong> her tabloda önerilmek yerine “Sistem bilgileri” altında toplanır.',
					'<strong>Satır ayrıntıları</strong>; yorumlarını, e-posta yazmak ya da aramak için bir düğmeyi ve tek tıkla ayarlanan bir derecelendirmeyi kazanıyor.',
					'<strong>Giriş ekranı</strong>, 3B animasyonlu arka planını “hareketi azalt” tercihine uyan hafif bir ekranla değiştiriyor.',
				],
			},
			environments: {
				date: '2026-09-26',
				title: 'Ortamlar, paylaşılan formlar, görünümler',
				items: [
					'<strong>Ortamlar</strong>: aynı veritabanı için canlı, test, geliştirme; yan yana karşılaştırma, geçiş planı, satır senkronizasyonu.',
					'<strong>Yapı geçmişi</strong>: tablo ve alanların her oluşturulması ya da değiştirilmesi, katalog üzerindeki bir tetikleyiciyle kaydedilir.',
					'<strong>Paylaşılan formlar</strong>: herkese açık ya da üyelere ayrılmış bir bağlantı, tarihe ya da yanıt sayısına göre kapanma, yanıtların geçmişte kime ait olduğu.',
					'<strong>Altı görünüm</strong>: ızgara, kanban, takvim, zaman çizelgesi, form, anket.',
					'<strong>Veri geçmişi</strong>: bir değişikliği geri almak, silinen bir satırı geri yüklemek.',
					'<strong>Yapay zeka</strong>: herhangi bir alanda yapay zeka seçeneği ve Copilot.',
					'<strong>İlişki</strong> ve <strong>URL</strong>: iki ayrı tür; uzun metin Markdown ile yazılır.',
					'İmzalı ve sıralı <strong>webhook’lar</strong>, onaylanacak <strong>ajan önerileri</strong>.',
					'<strong>Docker</strong>: üç hedefli bir Dockerfile, eksiksiz bir docker-compose, isteğe bağlı bir HTTPS proxy’si.',
				],
			},
			projects: {
				date: '2026-09-25',
				title: 'Projeler, izinler, MCP sunucusu',
				items: [
					'Veritabanlarının üstünde <strong>projeler</strong> ve dört düzeyde <strong>gruplara</strong> göre izinler: Erişim yok, Okuma, Düzenleme, Yönetim.',
					'<strong>Hesaplar</strong>: geçici şifre, ilk girişte değiştirme, yönetim için yükseltme.',
					'<strong>MCP sunucusu</strong> ve stdio aktarıcısı; REST API ile MCP’nin ortak kullandığı <strong>entegrasyon token’ları</strong>.',
					'Her veritabanı için <strong>otomatik oluşturulan “API ve MCP” belgeleri</strong>.',
				],
			},
			fields: {
				date: '2026-09-20',
				title: 'Alanlar, tekli seçimler, içe aktarma',
				items: [
					'Bir alanı ve bir tekli seçimin seçeneklerini düzenleme.',
					'CSV ve JSON dosyalarını <strong>içe aktarma</strong>.',
					'Tablo menüsü: yeniden adlandırma, açıklama ekleme, silme.',
				],
			},
			firstCommit: {
				date: '2026-09-20',
				title: 'İlk commit',
				items: [
					'Monorepo: adlandırma, hata kodları kaydı, mimari belgesinden çıkarılan katalog, çekirdek, API, arayüz.',
				],
			},
		},
	},
	roadmap: {
		label: 'Yol haritası',
		title: 'Sırada ne var',
		intro: 'basedb aktif olarak geliştiriliyor. Bu sayfa, söz verilmiş bir tarih olmadan, henüz neyin eksik olduğunu anlatır. Bir fikriniz, bir ihtiyacınız mı var? <a href="https://github.com/eodia/basedb/issues">Bir talep açın</a>. Zaten var olanlar: <a href="/nouveautes/">yenilikler</a>.',
		columns: {
			next: {
				title: 'Yakında',
				items: {
					restoreTable: {
						title: 'Tek bir tabloyu geri yükleme',
						text: 'Silinen bir tablo, kenara alınmış adıyla SQL’de okunabilir kalır; onu arayüzden tek başına geri getirmek yakında geliyor.',
					},
					aiSettings: {
						title: 'Arayüzde yapay zeka ayarları',
						text: 'Çalışma alanı başına sağlayıcı, model ve anahtar; API’nin ortamından geçmeden.',
					},
					mail: {
						title: 'E-postayla bildirimler ve davetler',
						text: 'Bahsetmeler, yanıtlar ve atamalar bugün basedb’ye, davetler ise sizin göndereceğiniz bir bağlantı olarak gelir; bunlar e-postayla da gönderilebilecek.',
					},
				},
			},
			later: {
				title: 'Daha sonra',
				items: {
					formLinks: {
						title: 'Paylaşılan formlarda ilişkiler ve dosyalar',
						text: 'Bağlı tabloda kısıtlı bir arama, tanınmayan ziyaretçiler için sınırlandırılmış bir dosya yükleme.',
					},
					moreEvents: {
						title: 'Bildirilen daha fazla olay',
						text: 'Bir form yanıtından, bir ajan önerisinden, devre dışı kalan bir webhook’tan haberdar olmak.',
					},
					sqlViewsAcross: {
						title: 'Ortamdan ortama SQL görünümleri',
						text: 'Ortamlar oluşturulurken ya da karşılaştırılırken ve veritabanı şablonlarında SQL görünümlerini yapıyla birlikte kopyalamak.',
					},
					loops: {
						title: 'Otomasyonlarda döngüler ve beklemeler',
						text: 'Bulunan her satır için adımları tekrarlamak, bir sonrakinden önce beklemek (“üç gün sonra”) ve akışları veritabanı şablonlarına taşımak.',
					},
					textFormulas: {
						title: 'Metin formülleri',
						text: 'Bir metnin bir bölümünü çıkarmak, değiştirmek ya da kısaltmak.',
					},
					bulk: {
						title: 'Tanımlı toplu işlemler',
						text: 'Binlerce satırda, geçmişe tek bir işlem olarak kaydedilen değişiklikler.',
					},
					tombstones: {
						title: 'Mezar taşı kayıtlarının temizlenmesi',
						text: 'Artık gereksiz hâle gelen silme izlerinin temizlenmesi.',
					},
				},
			},
		},
	},
	gallery: {
		label: 'Şablonlar',
		title: 'Saniyeler içinde hazır bir veritabanı',
		intro: 'Her şablon birbirine bağlı tablolar, örnek satırlar, görünümler, bir pano, otomasyonlar — ve yapay zekanın kendisinin doldurduğu alanlar oluşturur. basedb’de: <strong>Yeni veritabanı</strong>, ardından <strong>Bir şablondan başla</strong>. Uygun bir şey yok mu? İhtiyacınızı tek cümleyle anlatın: yapay zeka size özel bir veritabanı önersin.',
		filter: 'Kategoriye göre filtrele',
		all: 'Tümü',
		otherCategory: 'Diğer',
		ai: '✦ Yapay zeka',
		tables: {
			one: '{n} tablo',
			other: '{n} tablo',
		},
		rows: {
			one: '{n} satır',
			other: '{n} satır',
		},
		views: {
			one: '{n} görünüm',
			other: '{n} görünüm',
		},
		howtoTitle: 'Şablonları JSON ile ayarlama',
		howto: 'Bir şablon bir JSON dosyasıdır: tabloları, alanları, ilişkileri, satırları, görünümleri, panoları, otomasyonları ve yapay zeka alanlarının talimatları. Bu sayfadaki şablonlar, deponun <a href="https://github.com/eodia/basedb/tree/main/packages/templates/catalog"><code>packages/templates/catalog</code></a> klasöründeki dosyalardır; her basedb kurulumu <a href="/modeles/catalogue.json"><code>catalogue.json</code></a> dosyasını okur ve bunları kullanıcılarına sunar. Bir yönetici kendi şablonlarını da kurulumuna aktarabilir ve her veritabanı şablon olarak kaydedilebilir.',
		format: {
			href: '/fonctionnalites/modeles/',
			label: 'Şablon biçimi →',
		},
		back: '← Tüm şablonlar',
		defaultCategory: 'Şablon',
		sampleRows: {
			one: '{n} örnek satır',
			other: '{n} örnek satır',
		},
		aiTitle: 'Yapay zekanın hesapladıkları',
		useTitle: 'Bu şablonu kullanın',
		useSteps: [
			'basedb’de <strong>Yeni veritabanı</strong>.',
			'<strong>Bir şablondan başla</strong>, ardından “{label}”.',
		],
		create: '<strong>Veritabanını oluştur</strong>.',
		createWithAi: '<strong>Veritabanını oluştur</strong> — isterseniz yapay zeka alanlarının yapay zeka sağlayıcınız tarafından hesaplanmasını kabul ederek.',
		download: 'JSON’u indir',
		downloadNote: 'Kendi kurulumunuza aktarmak ya da kataloğa önermeden önce uyarlamak için.',
		viewMeta: '— {kind}, {table}',
		dashboard: '<strong>Pano</strong> “{label}” — {blocks}',
		blocks: {
			one: '{n} blok',
			other: '{n} blok',
		},
		automation: '<strong>Otomasyon</strong> “{label}”',
		yes: 'Evet',
		no: 'Hayır',
		me: 'Siz',
		kinds: {
			short_text: 'Kısa metin',
			long_text: 'Uzun metin',
			rich_text: 'Zengin metin',
			number: 'Sayı',
			boolean: 'Onay kutusu',
			date: 'Tarih',
			datetime: 'Tarih ve saat',
			select: 'Tekli seçim',
			multi_select: 'Çoklu seçim',
			url: 'URL',
			email: 'E-posta',
			user: 'Kişi',
			autonumber: 'Otomatik numara',
			formula: 'Formül',
			lookup: 'Arama',
			rollup: 'Toplama',
			count: 'Sayım',
			button: 'Düğme',
			link: 'İlişki',
			multi_link: 'Çoklu ilişki',
		},
		viewKinds: {
			grid: 'Izgara',
			kanban: 'Kanban',
			calendar: 'Takvim',
			timeline: 'Zaman çizelgesi',
			gallery: 'Galeri',
			list: 'Liste',
			form: 'Form',
		},
	},
	templates: {
		demo: {
			label: 'Demo: Lumen Atölyesi',
			summary: 'Küçük bir ajans; müşterileri, projeleri, görevleri, faturaları ve yorumları: basedb’nin tüm yönleri tek bir veritabanında.',
			description: 'Demo veritabanı. Lumen Atölyesi hayali bir tasarım ajansıdır. Veritabanı; tablolar arasındaki ilişkileri, aramaları ve toplamaları (müşteri başına ciro, ortalama puan), formülleri (KDV dahil tutar, gecikme), müşteri yorumları üzerinde yapay zekanın hesapladığı üç alanı (duygu, konu, önerilen yanıt), her görünüm türünü — ızgara, kanban, takvim, bağımlılıklı zaman çizelgesi, galeri, liste, form —, bir pano ve iki otomasyonu gösterir.',
			category: 'Demo',
			tags: ['Yapay zeka', 'İlişkiler', 'Tüm görünümler', 'Pano'],
		},
		'analyse-avis': {
			label: 'Müşteri yorumu analizi',
			summary: 'Yorumları toplayın; yapay zeka duyguyu, konuları, aciliyeti ve bir yanıt taslağını çıkarsın.',
			description: 'Bir mağaza, bir restoran ya da bir marka için: yorumlar herkese açık bir formdan ya da içe aktarmadan gelir ve yapay zeka her birini okur. Duyguyu sınıflandırır, ana konuyu belirler, hızlı yanıt gerektirenleri işaretler, müşterinin önerisini çıkarır ve gözden geçirilecek bir yanıt yazar. Ürünler ortalama puanlarını ve yorum sayılarını toplar; bir pano memnuniyeti izler.',
			category: 'Müşteri ilişkileri',
			tags: ['Yapay zeka', 'Form', 'Pano'],
		},
		'base-connaissances': {
			label: 'Bilgi bankası',
			summary: 'Yardım makaleleri ve müşteri soruları: yapay zeka makalelere dayanarak özetler, sınıflandırır ve bir yanıt önerir.',
			description: 'Bir destek ekibi için. Yardım makaleleri kategoriye göre düzenlenir ve zaman içinde izlenir; müşteri soruları herkese açık bir formdan gelir. Yapay zeka her makaleyi özetler ve düzeyini değerlendirir, her soruyu sınıflandırır ve gözden geçirilecek bir yanıt taslağı yazar.',
			category: 'Destek',
			tags: ['Yapay zeka', 'Form', 'Liste'],
		},
		'calendrier-editorial': {
			label: 'Yayın takvimi',
			summary: 'Bir takvimde planlanan makaleler, gönderiler ve bültenler; yapay zeka dikkat çekici girişler ve anahtar kelimeler önerir.',
			description: 'Bir pazarlama ekibi ya da yayın kurulu için. Her içerik fikirden yayına ilerler, yayın takvimine yerleşir ve bir kampanyaya aittir. Yapay zeka brief’ten yola çıkarak dikkat çekici bir giriş ve anahtar kelimeler önerir; bir form da tüm şirketin konu önermesini sağlar.',
			category: 'Pazarlama',
			tags: ['Yapay zeka', 'Takvim', 'Kanban', 'Form'],
		},
		crm: {
			label: 'Satış CRM’i',
			summary: 'Şirketler, kişiler ve fırsatlar: bir satış hattı, görüşmeler ve bir sonraki adımı öneren yapay zeka.',
			description: 'Bir satış ekibi için hafif bir CRM. Fırsatlar bir satış hattında ilerler ve olasılıklarına göre ağırlıklandırılmış bir tutar taşır; yapay zeka notlardan yola çıkarak risklerini değerlendirir ve bir sonraki eylemi önerir. Müşterilerle yapılan görüşmeler kaydedilir ve özetlenir; şirketler temsil ettikleri değeri toplar.',
			category: 'Satış',
			tags: ['Yapay zeka', 'Satış hattı', 'Kanban', 'Takvim'],
		},
		evenements: {
			label: 'Etkinlikler ve kayıtlar',
			summary: 'Konferanslar, atölyeler ve web seminerleri: kayıtlar, kalan yerler ve yapay zekanın okuduğu katılımcı geri bildirimleri.',
			description: 'Düzenli etkinlikler düzenlemek için. Her etkinlik kayıtlılarını ve kalan yerlerini sayar; kayıtlar katılıma kadar ilerler. Etkinlikten sonra katılımcılar bir geri bildirim bırakır; yapay zeka bunları duyguya göre sınıflandırır ve özetler. Herkese açık bir form, e-posta listesine katılmayı sağlar.',
			category: 'Etkinlik yönetimi',
			tags: ['Yapay zeka', 'Takvim', 'Form', 'Toplamalar'],
		},
		'gestion-projet': {
			label: 'Proje yönetimi',
			summary: 'Projeler, görevler ve kilometre taşları: bir yol haritası, görevler arası bağımlılıklar, bir kanban ve bir takvim.',
			description: 'Birden çok projeyi paralel yürütmek için. Her proje görevlerini ve saatlerini toplar; görevler kanbanda izlenir, bağımlılıklarını çizen bir zaman çizelgesinde planlanır ve kilometre taşları bir takvimde okunur. Yapay zeka, açıklamasından ve ilerlemesinden yola çıkarak yönetim için bir proje durum özeti yazar.',
			category: 'Organizasyon',
			tags: ['Zaman çizelgesi', 'Bağımlılıklar', 'Kanban', 'Yapay zeka'],
		},
		inventaire: {
			label: 'Envanter ve stok',
			summary: 'Ürünler, tedarikçiler ve stok hareketleri: stok kendiliğinden hesaplanır, tükenmeler önceden görülür.',
			description: 'Bir atölye, bir mağaza ya da genel hizmetler için. Her giriş ya da çıkış bir harekettir; her ürünün stoku bunların toplamıdır, değeri bir formüldür ve eşiğinin altındaki ürünler “À commander” görünümünde yer alır. Yapay zeka, her ürünün tanıtım metnini adından ve kategorisinden yola çıkarak yazar.',
			category: 'İşlemler',
			tags: ['Toplamalar', 'Formüller', 'Galeri', 'Yapay zeka'],
		},
		recrutement: {
			label: 'İşe alım',
			summary: 'Açık pozisyonlar, adaylar ve mülakatlar; yapay zeka her başvuruyu özetler ve üzerinde durulacak noktaları önerir.',
			description: 'Başvurudan işe alıma kadar bir işe alım takibi. Adaylar herkese açık bir formla başvurur, bir kanbanda adım adım ilerler; mülakatlar bir takvimde planlanır. Yapay zeka ön yazıyı ve notları okur: bir özet ve mülakatta sorulacak sorular. Okumaya yardım eder, karar vermez.',
			category: 'İnsan kaynakları',
			tags: ['Yapay zeka', 'Form', 'Kanban', 'Takvim'],
		},
		'suivi-tickets': {
			label: 'Talep takibi',
			summary: 'Yapay zekanın sınıflandırdığı hatalar ve talepler, çözülene kadar sprint sprint takip edilir; bir bildirim formu da vardır.',
			description: 'Bir ürün ekibi için bir talep yöneticisi. Her talep bir bileşene ve bir sprinte bağlıdır; yapay zeka bir kategori önerir, önem derecesini tahmin eder ve bildirimi özetler. Bir kanban ilerlemeyi izler, bir zaman çizelgesi sprintleri gösterir, bir form herkesin bir sorun bildirmesini sağlar ve bir otomasyon çözüm tarihini not eder.',
			category: 'Ürün ve teknik',
			tags: ['Yapay zeka', 'Kanban', 'Form', 'Sprint’ler'],
		},
	},
} satisfies DeepPartial<Dict>;
