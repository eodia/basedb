import type { Catalog } from './catalog.js'

/** The API and MCP documentation in Turkish: the French sentence of `documentation.ts` → its translation. */
export const tr: Catalog = {
  'Prise en main': 'Başlarken',
  'API REST': 'REST API',
  'Agents (MCP)': 'Ajanlar (MCP)',
  Tables: 'Tablolar',
  Référence: 'Referans',
  texte: 'metin',
  'texte long': 'uzun metin',
  'nombre (chaîne décimale)': 'sayı (ondalık dize)',
  booléen: 'mantıksal değer',
  'date (`2026-09-18`)': 'tarih (`2026-09-18`)',
  'date-heure UTC (`2026-09-18T14:03:00.000Z`)': 'UTC tarih-saat (`2026-09-18T14:03:00.000Z`)',
  'liste de choix': 'seçim listesi',
  'choix multiple (liste de valeurs)': 'çoklu seçim (değer listesi)',
  'relation (`_id` de la ligne liée)': 'ilişki (bağlı satırın `_id` değeri)',
  'relation multiple (liste des `_id` des lignes liées, dans leur ordre)':
    'çoklu ilişki (bağlı satırların `_id` listesi, sırasıyla)',
  'lien URL (`https://…` ou `mailto:…`)': 'URL bağlantısı (`https://…` veya `mailto:…`)',
  'adresse e-mail': 'e-posta adresi',
  'numéro automatique (lecture seule)': 'otomatik numara (salt okunur)',
  'personne (`id` d’un membre de l’espace)': 'kişi (çalışma alanı üyesinin `id` değeri)',
  formule: 'formül',
  'documents (liste de fichiers)': 'belgeler (dosya listesi)',
  'images (liste de fichiers)': 'görseller (dosya listesi)',
  'colonne système': 'sistem sütunu',
  'Un texte plus long.': 'Daha uzun bir metin.',
  valeur: 'değer',
  Exemple: 'Örnek',
  résultat: 'sonuç',
  'photo.jpg': 'foto.jpg',
  'devis.pdf': 'teklif.pdf',
  Exemples: 'Örnekler',
  'Lister les lignes': 'Satırları listele',
  Réponse: 'Yanıt',
  'Créer une ligne': 'Satır oluştur',
  'Déposer un fichier': 'Dosya yükle',
  'Le corps est le fichier lui-même. La réponse donne un `id`, à écrire ensuite dans {field} : {write}.':
    'Gövde, dosyanın kendisidir. Yanıt bir `id` verir; bunu daha sonra {field} alanına şu şekilde yazın: {write}.',
  'L’identité du jeton : qui l’a créé, sa base, ses droits effectifs et ses budgets.':
    'Token’ın kimliği: onu kimin oluşturduğu, hangi veritabanına ait olduğu, geçerli hakları ve bütçeleri.',
  'Les bases que le jeton peut lire.': 'Token’ın okuyabildiği veritabanları.',
  'Les tables d’une base et le graphe de leurs relations.':
    'Bir veritabanının tabloları ve ilişkilerinin grafiği.',
  'Les champs d’une table : type, obligation, options, relations, et lesquels sont modifiables.':
    'Bir tablonun alanları: tür, zorunluluk, seçenekler, ilişkiler ve hangilerinin değiştirilebilir olduğu.',
  'Lire des lignes : filtre, tri, pagination par curseur.':
    'Satırları okur: filtre, sıralama, imleçle sayfalama.',
  'Lire une ligne par son `_id`, les textes longs en entier si on le demande.':
    'Bir satırı `_id` değeriyle okur; istenirse uzun metinleri eksiksiz döndürür.',
  'Trouver le `_id` d’une ligne par sa valeur d’affichage, avant d’écrire une relation.':
    'Bir ilişki yazmadan önce, bir satırın `_id` değerini görüntüleme değerinden bulur.',
  'Créer une ligne.': 'Bir satır oluşturur.',
  'Modifier les champs nommés d’une ligne.': 'Bir satırın adlandırılan alanlarını değiştirir.',
  'Supprimer une ligne, avec un jeton créé pour supprimer — la réponse la rend.':
    'Bir satırı siler, silmek için oluşturulmuş bir token’la — yanıt onu döndürür.',
  'Ramener une ligne supprimée, sous son `_id`, depuis l’historique.':
    'Silinen bir satırı, `_id` değeriyle, geçmişinden geri yükler.',
  'Proposer une table et ses premiers champs — une personne décide.':
    'Bir tablo ve ilk alanlarını önerir — kararı bir kişi verir.',
  'Proposer un champ, une liste de choix ou une relation — une personne décide.':
    'Bir alan, bir seçim listesi ya da bir ilişki önerir — kararı bir kişi verir.',
  'Relire une proposition du jeton et savoir ce qu’il en est advenu.':
    'Token’ın bir önerisini yeniden okur ve ne olduğunu öğrenir.',
  'dépôt basedb': 'basedb deposu',
  'Depuis un agent (MCP)': 'Ajan üzerinden (MCP)',
  'Cette base n’est pas ouverte aux agents : aucun outil MCP ne voit cette table, quel que soit le jeton.':
    'Bu veritabanı ajanlara açık değil: token ne olursa olsun, hiçbir MCP aracı bu tabloyu görmez.',
  'Connaître ses champs, et lesquels sont modifiables':
    'Alanlarını ve hangilerinin değiştirilebilir olduğunu öğrenir',
  'Lire ses lignes — filtre, tri, pagination': 'Satırlarını okur — filtre, sıralama, sayfalama',
  'Lire une ligne par son `_id`': 'Bir satırı `_id` değeriyle okur',
  'Trouver une ligne par sa valeur d’affichage, {field}':
    'Bir satırı görüntüleme değerine göre bulur, {field}',
  'Modifier une ligne': 'Satırı düzenle',
  'Supprimer une ligne — avec un jeton créé pour supprimer':
    'Satırı sil — silmek için oluşturulmuş bir token’la',
  'Ramener une ligne supprimée': 'Silinen satırı geri yükle',
  'Aucun outil ne vous est ouvert sur cette table.': 'Bu tabloda size açık hiçbir araç yok.',
  'Un jeton que vous créez n’a jamais plus de droits que vous : ces outils sont un maximum.':
    'Oluşturduğunuz bir token, sizden asla daha fazla hakka sahip olmaz: bu araçlar bir üst sınırdır.',
  Outil: 'Araç',
  Pour: 'Amaç',
  'Un agent ne supprime qu’avec un jeton créé « Lecture, écriture et suppression », une ligne à la fois ; la ligne supprimée revient par `restore_record` ou depuis l’historique.':
    'Bir ajan yalnızca “Okuma, yazma ve silme” olarak oluşturulmuş bir token’la siler, bir kerede bir satır; silinen satır `restore_record` ile ya da geçmişinden geri gelir.',
  '**Invisibles pour un agent :** {fields}. Pour lui, ces colonnes n’existent pas : il ne peut ni les lire, ni les filtrer, ni les écrire.':
    '**Bir ajan için görünmez:** {fields}. Onun için bu sütunlar yoktur: ne okuyabilir, ne filtreleyebilir, ne de yazabilir.',
  'Arguments d’un appel': 'Çağrı argümanları',
  'Créer un jeton pour cette base demande le niveau **Gestion**, que vous n’avez pas. Demandez-en un à la personne qui la gère.':
    'Bu veritabanı için bir token oluşturmak **Yönetim** düzeyini gerektirir; bu düzeye sahip değilsiniz. Bunu veritabanını yöneten kişiden isteyin.',
  '<jeton>': '<token>',
  'Connecter un agent': 'Bir ajan bağlama',
  'Le **serveur MCP** de basedb ouvre cette base à un agent IA — Claude ou tout client MCP : il la découvre, la lit et, si vous le décidez, y crée, modifie et supprime des lignes. Il passe par les mêmes permissions que l’API REST.':
    'basedb’nin **MCP sunucusu**, bu veritabanını bir yapay zeka ajanına — Claude’a ya da herhangi bir MCP istemcisine — açar: ajan veritabanını keşfeder, okur ve siz izin verirseniz satırlar oluşturur, değiştirir ve siler. Bu işlem, REST API ile aynı izinlerden geçer.',
  '**Cette base n’est pas ouverte aux agents.** Tant qu’elle ne l’est pas, aucun outil ne la voit, quel que soit le jeton présenté.':
    '**Bu veritabanı ajanlara açık değil.** Açılana kadar, sunulan token ne olursa olsun hiçbir araç onu göremez.',
  'Créer un jeton': 'Token oluşturma',
  'Dans l’interface, menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **MCP** coché. Le jeton est limité à cette base, en **lecture seule** par défaut : l’écriture, et la suppression, se choisissent explicitement. Il n’est affiché qu’une fois, et se révoque depuis le même écran. Coché aussi pour l’**API REST**, le même jeton sert à un programme (voir « Authentification »).':
    'Arayüzde, veritabanının “⋯” menüsü → **API ve ajanlar** → **API ve MCP token’ları…**, **MCP** erişimi işaretli. Token bu veritabanıyla sınırlıdır ve varsayılan olarak **salt okunur**dur: yazma izni ve silme izni açıkça seçilir. Yalnızca bir kez gösterilir ve aynı ekrandan iptal edilir. **REST API** için de işaretlenirse, aynı token bir program tarafından da kullanılır (bkz. “Kimlik doğrulama”).',
  'Garder le jeton hors de la configuration': 'Token’ı yapılandırmanın dışında tutma',
  'Le jeton se place dans la variable d’environnement `BASEDB_TOKEN`, jamais dans le fichier de configuration du client : celui-ci est versionné, synchronisé, et lisible par tous les programmes de la session.':
    'Token, `BASEDB_TOKEN` ortam değişkenine yerleştirilir; istemcinin yapılandırma dosyasına asla konmaz: bu dosya sürüm kontrolüne alınır, senkronize edilir ve oturumdaki tüm programlar tarafından okunabilir.',
  'Déclarer le serveur dans le client': 'Sunucuyu istemcide tanımlama',
  'Le client lance le **relais** `relay.js`, qui transporte ses messages jusqu’au serveur. Il lit le jeton dans la variable que nomme `--token-env` — `BASEDB_MCP_TOKEN` si rien n’est dit — et l’adresse du serveur dans `--url` (ou `BASEDB_MCP_URL`).':
    'İstemci, mesajlarını sunucuya taşıyan **aktarıcıyı** (`relay.js`) başlatır. Token’ı `--token-env` ile adlandırılan değişkenden okur — hiçbir şey belirtilmezse `BASEDB_MCP_TOKEN` — ve sunucunun adresini `--url` içinden (ya da `BASEDB_MCP_URL`) alır.',
  'Autre client MCP': 'Diğer MCP istemcisi',
  'votre-instance': 'kurulumunuz',
  'Sans relais': 'Aktarıcı olmadan',
  'Un client qui parle MCP en HTTP vise directement l’adresse du serveur, `…/mcp`, avec l’en-tête {header}. Un jeton n’est accepté que sur les accès cochés à sa création : un jeton « MCP » seul est refusé par l’API REST, et inversement.':
    'MCP’yi HTTP üzerinden konuşan bir istemci, doğrudan sunucunun adresini, `…/mcp`, {header} başlığıyla hedefler. Bir token yalnızca oluşturulurken işaretlenen erişimlerde kabul edilir: yalnızca “MCP” işaretli bir token REST API tarafından reddedilir, ve bunun tersi de geçerlidir.',
  Vérifier: 'Doğrulama',
  'Demandez à l’agent d’appeler `whoami` : il rend la personne qui a créé le jeton, la base de sa portée et ses droits effectifs.':
    'Ajandan `whoami` çağrısını yapmasını isteyin: bu çağrı, token’ı oluşturan kişiyi, kapsamındaki veritabanını ve geçerli haklarını verir.',
  Outils: 'Araçlar',
  '{count} outils, toujours les mêmes : leur nom et leur description ne dépendent jamais de vos données. Le schéma se découvre en les appelant.':
    '{count} araç, her zaman aynı araçlar: adları ve açıklamaları asla verilerinize bağlı değildir. Şema, bu araçlar çağrılarak keşfedilir.',
  Rôle: 'Rol',
  Écrit: 'Yazar mı?',
  oui: 'evet',
  propose: 'önerir',
  non: 'hayır',
  'Enchaînement type': 'Tipik akış',
  '`list_bases`, puis `describe_base` : ce qui existe.':
    '`list_bases`, ardından `describe_base`: nelerin var olduğu.',
  '`describe_table` avant toute lecture ou écriture : les champs, leurs types, et ceux que le jeton peut écrire (`access: "write"`).':
    'Her okuma ya da yazmadan önce `describe_table`: alanlar, türleri ve token’ın yazabildiği alanlar (`access: "write"`).',
  '`list_records` avec `filter`, `sort` et `limit` ; poursuivre avec `cursor` tant que `has_more` vaut `true`.':
    '`filter`, `sort` ve `limit` ile `list_records`; `has_more` değeri `true` olduğu sürece `cursor` ile devam edin.',
  'Pour écrire une relation : `lookup_records` sur la table cible, puis `create_record` ou `update_record` avec le `_id` trouvé.':
    'Bir ilişki yazmak için: hedef tabloda `lookup_records`, ardından bulunan `_id` ile `create_record` ya da `update_record`.',
  'Pour faire évoluer la structure : `propose_create_table` ou `propose_add_field`, puis `get_proposal` pour suivre la décision.':
    'Yapıyı geliştirmek için: `propose_create_table` ya da `propose_add_field`, ardından kararı izlemek için `get_proposal`.',
  'Pour supprimer : `get_record` d’abord, pour être sûr de la ligne, puis `delete_record` — qui la rend dans sa réponse ; `restore_record` la ramène.':
    'Silmek için: önce satırdan emin olmak için `get_record`, ardından yanıtında onu döndüren `delete_record`; `restore_record` onu geri yükler.',
  'Propositions de structure': 'Yapı önerileri',
  'Un agent ne modifie jamais la structure lui-même : il **propose**. La proposition attend dans la file « Propositions » de la base, où une personne qui peut modifier la structure l’approuve ou la refuse ; sans décision, elle expire au bout de 24 heures. Approuvée, elle est appliquée au nom de la personne qui a créé le jeton — si cette personne a toujours le droit de le faire — et apparaît dans l’historique comme n’importe quelle modification.':
    'Bir ajan yapıyı asla kendisi değiştirmez: yalnızca **önerir**. Öneri, veritabanının “Ajan önerileri” kuyruğunda bekler; orada yapıyı değiştirebilen bir kişi onu onaylar ya da reddeder; karar verilmezse 24 saat sonra süresi dolar. Onaylanırsa, token’ı oluşturan kişinin adına uygulanır — bu kişinin hâlâ bu işlemi yapma hakkı varsa — ve geçmişte diğer her değişiklik gibi görünür.',
  'Au plus 5 propositions en attente par jeton ; une nouvelle proposition sur le même objet remplace la précédente (`superseded`).':
    'Token başına en fazla 5 bekleyen öneri; aynı nesne üzerindeki yeni bir öneri bir öncekinin yerini alır (`superseded`).',
  'Pas de suppression, pas de renommage, pas de relation en cascade (`MCP_CASCADE_FORBIDDEN`).':
    'Silme yok, yeniden adlandırma yok, kademeli (cascade) ilişki yok (`MCP_CASCADE_FORBIDDEN`).',
  'Ce qui n’existe pas': 'Var olmayanlar',
  'Aucun outil ne supprime plusieurs lignes à la fois, une table ou un champ, n’exécute de SQL ni ne gère les droits ou les jetons. Un agent qui appelle un tel nom — `delete_records`, `run_sql`… — reçoit `MCP_OPERATION_EXCLUDED`, quelle que soit la base visée.':
    'Hiçbir araç birden fazla satırı aynı anda, bir tabloyu ya da bir alanı silmez, SQL çalıştırmaz ya da hakları veya token’ları yönetmez. Böyle bir adı çağıran bir ajan — `delete_records`, `run_sql`… — hedeflenen veritabanı ne olursa olsun `MCP_OPERATION_EXCLUDED` alır.',
  Bornes: 'Sınırlar',
  '`limit` : 25 lignes par défaut, 100 au plus.':
    '`limit`: varsayılan olarak 25 satır, en fazla 100.',
  'Un filtre compte au plus 10 prédicats, combinés par ET ; un tri, au plus 3 champs.':
    'Bir filtre en fazla 10 koşul içerir ve bunlar VE ile birleştirilir; bir sıralama en fazla 3 alan içerir.',
  'Dans une liste, un texte de plus de 500 caractères est tronqué et nommé dans `_truncated_fields` ; `get_record` avec `full_fields` le rend entier.':
    'Bir listede, 500 karakterden uzun bir metin kısaltılır ve `_truncated_fields` içinde adlandırılır; `full_fields` ile `get_record` onu eksiksiz döndürür.',
  'Une écriture accepte une `idempotency_key` : la rejouer ne crée pas de doublon.':
    'Bir yazma işlemi bir `idempotency_key` kabul eder: aynı isteği tekrarlamak bir kopya oluşturmaz.',
  'Ce que voit un agent': 'Bir ajanın gördükleri',
  'Un agent ne voit jamais plus que la personne qui a créé son jeton — et souvent moins.':
    'Bir ajan, token’ını oluşturan kişiden asla daha fazlasını göremez — çoğu zaman daha azını görür.',
  '**Droits** : ceux du jeton, recoupés à chaque appel avec ceux de son créateur. Si les droits de cette personne baissent, ceux du jeton baissent avec eux ; si son compte est désactivé, le jeton cesse de répondre.':
    '**Haklar**: token’ın hakları, her çağrıda onu oluşturan kişinin haklarıyla kesiştirilir. Bu kişinin hakları azalırsa, token’ın hakları da onlarla birlikte azalır; hesabı devre dışı bırakılırsa, token yanıt vermeyi durdurur.',
  '**Lire, créer, modifier** — et supprimer, une ligne à la fois, seulement avec un jeton créé pour cela. Un jeton en lecture seule refuse toute écriture (`TOKEN_READ_ONLY`).':
    '**Okuma, oluşturma, değiştirme** — ve silme, bir kerede bir satır, yalnızca bunun için oluşturulmuş bir token’la. Salt okunur bir token her türlü yazmayı reddeder (`TOKEN_READ_ONLY`).',
  '**Cette base** : ouverte aux agents.': '**Bu veritabanı**: ajanlara açık.',
  '**Cette base** : **fermée aux agents** — aucun outil ne la voit.':
    '**Bu veritabanı**: **ajanlara kapalı** — hiçbir araç onu görmez.',
  '**Colonnes réservées aux humains** : aucune dans ce que vous voyez de cette base.':
    '**Yalnızca insanlara ayrılmış sütunlar**: bu veritabanında gördükleriniz arasında yok.',
  '**Colonnes réservées aux humains** : {columns}. Pour un agent, elles n’existent pas.':
    '**Yalnızca insanlara ayrılmış sütunlar**: {columns}. Bir ajan için bunlar yoktur.',
  '**Des données, pas des consignes** : descriptions et contenus sont rendus comme des données saisies par des utilisateurs, et les outils le disent à l’agent.':
    '**Talimat değil, veri**: açıklamalar ve içerikler kullanıcılar tarafından girilmiş veriler olarak sunulur ve araçlar bunu ajana bildirir.',
  '**Journal** : chaque appel est journalisé par la forme de ses paramètres, jamais par leurs valeurs.':
    '**Günlük**: her çağrı, parametrelerinin değerleriyle değil, yalnızca biçimleriyle günlüğe kaydedilir.',
  obligatoire: 'zorunlu',
  'calculé par l’IA': 'yapay zeka tarafından hesaplanan',
  'lecture seule': 'salt okunur',
  'HTML riche — **à assainir à l’affichage**': 'Zengin HTML — **görüntülenirken temizlenmeli**',
  'invisible pour les agents': 'ajanlar için görünmez',
  'relation → {table}': 'ilişki → {table}',
  'Valeurs : {values}.': 'Değerler: {values}.',
  'cible non visible pour vous : la cellule vaut toujours {cell}':
    'hedef sizin için görünür değil: hücre her zaman {cell} değerini alır',
  'pointe vers {table} (aucune colonne d’affichage désignée : la cellule montre l’identifiant)':
    '{table} tablosuna işaret eder (görüntüleme için belirlenmiş bir sütun yok: hücre kimliği gösterir)',
  'pointe vers {table}, affiché par {field}':
    '{table} tablosuna işaret eder, {field} ile görüntülenir',
  'à la suppression : supprimer la ligne cible est refusé tant qu’elle est référencée':
    'silindiğinde: hedef satır, kendisine başvurulduğu sürece silinemez',
  'à la suppression : supprimer la ligne cible vide cette cellule':
    'silindiğinde: hedef satırın silinmesi bu hücreyi boşaltır',
  'à la suppression : supprimer la ligne cible supprime aussi cette ligne':
    'silindiğinde: hedef satırın silinmesi bu satırı da siler',
  'en écriture, acceptez un `uuid` nu, `null`, ou `{"id": "…"}` ; en lecture, toujours `{"id": …, "display": …}`':
    'yazarken çıplak bir `uuid`, `null` ya da `{"id": "…"}` kabul edilir; okurken her zaman `{"id": …, "display": …}` döner',
  'Lister les lignes — filtre, tri, pagination par curseur':
    'Satırları listele — filtre, sıralama, imleçle sayfalama',
  'Lire une ligne': 'Satır oku',
  'Supprimer une ligne': 'Satır sil',
  'Lister les lignes qui pointent vers celle-ci': 'Buna işaret eden satırları listele',
  Méthode: 'Yöntem',
  Chemin: 'Yol',
  lire: 'okuma',
  créer: 'oluşturma',
  modifier: 'değiştirme',
  supprimer: 'silme',
  '**En SQL :** {sql}': '**SQL’de:** {sql}',
  'Vous pouvez {verbs}. Les verbes absents de cette liste ne vous sont pas ouverts, et les chemins correspondants ne sont pas décrits.':
    'Şunları yapabilirsiniz: {verbs}. Bu listede yer almayan fiiller size açık değildir ve bunlara karşılık gelen yollar açıklanmaz.',
  'Points d’accès': 'Uç noktalar',
  Colonnes: 'Sütunlar',
  Colonne: 'Sütun',
  Libellé: 'Etiket',
  Type: 'Tür',
  Description: 'Açıklama',
  'Champs relation': 'İlişki alanları',
  'Colonnes système': 'Sistem sütunları',
  'Toujours lisibles, jamais inscriptibles. Elles portent la pagination par curseur et la reprise incrémentale, et aucun réglage ne les masque.':
    'Her zaman okunabilir, asla yazılamaz. İmleçle sayfalamayı ve artımlı devam etmeyi bunlar taşır; hiçbir ayar onları gizleyemez.',
  Expansion: 'Genişletme',
  '{expand} — profondeur 1 sans exception. Les objets liés arrivent dans `included`, indexés par nom de table puis par identifiant, et non imbriqués dans la ligne : 100 lignes pointant 3 cibles transportent 3 objets.':
    '{expand} — istisnasız 1 derinlik. Bağlı nesneler satırın içine yerleştirilmez; tablo adına, ardından kimliğe göre indekslenmiş olarak `included` içinde gelir: 3 hedefe işaret eden 100 satır, 3 nesne taşır.',
  'Lignes référençantes': 'Başvuran satırlar',
  '{route} liste les lignes qui pointent vers une ligne donnée. Un bloc dont la table source ne vous est pas visible n’y figure pas du tout — ni bloc, ni compteur, ni mention.':
    '{route}, belirli bir satıra işaret eden satırları listeler. Kaynak tablosu sizin için görünür olmayan bir blok burada hiç yer almaz — ne blok, ne sayaç, ne de bir ibare.',
  'une table que vous ne voyez pas': 'sizin göremediğiniz bir tablo',
  'Vue d’ensemble': 'Genel bakış',
  'Cette base s’appelle {name} — c’est le nom du **schéma PostgreSQL**, et celui que vous écrivez dans vos URL comme dans les appels d’outils. Les tables et les colonnes portent les mêmes noms ici et en SQL : il n’y a pas de table de correspondance à consulter.':
    'Bu veritabanının adı {name} — bu, **PostgreSQL şemasının** adıdır ve URL’lerinizde de araç çağrılarında da yazdığınız addır. Tablolar ve sütunlar burada da SQL’de de aynı adları taşır: başvurulacak bir eşleştirme tablosu yoktur.',
  'Deux accès, les mêmes permissions : l’**API REST** pour vos programmes, le **serveur MCP** pour les agents IA. Chaque page de table dit comment l’atteindre par l’un et par l’autre.':
    'İki erişim, aynı izinler: programlarınız için **REST API**, yapay zeka ajanları için **MCP sunucusu**. Her tablo sayfası, ona her ikisiyle nasıl ulaşılacağını söyler.',
  Élément: 'Öğe',
  Valeur: 'Değer',
  'Schéma PostgreSQL': 'PostgreSQL şeması',
  'Préfixe des routes REST': 'REST yollarının öneki',
  'ouverte — voir « Connecter un agent »': 'açık — bkz. “Bir ajan bağlama”',
  '**fermée aux agents**': '**ajanlara kapalı**',
  'Tables visibles': 'Görünür tablolar',
  Format: 'Biçim',
  'JSON, dans une enveloppe {envelope}': 'JSON, {envelope} zarfı içinde',
  '**Cette documentation décrit ce que VOUS pouvez voir.** Deux lecteurs en obtiennent deux versions différentes, et c’est la règle, pas un effet de bord. Ne la publiez pas telle quelle.':
    '**Bu belgeler SİZİN görebildiklerinizi açıklar.** İki okuyucu bundan iki farklı sürüm elde eder ve bu bir kuraldır, yan etki değil. Bunu olduğu gibi yayımlamayın.',
  Authentification: 'Kimlik doğrulama',
  'Toutes les routes de données demandent un **jeton**, dans l’en-tête `Authorization`. Le cookie de session n’est jamais accepté ici : un navigateur l’envoie sur chaque requête, y compris celles qu’une page étrangère provoque.':
    'Tüm veri yolları, `Authorization` başlığında bir **token** ister. Oturum çerezi burada asla kabul edilmez: bir tarayıcı bunu, yabancı bir sayfanın tetiklediği istekler dahil, her istekte gönderir.',
  'Jeton d’intégration': 'Entegrasyon token’ı',
  'Un programme — script, synchronisation, autre application — présente un **jeton d’intégration**, qui commence par `bdb_`. Il ne vaut que pour cette base ; il lit, crée et modifie s’il a été créé en écriture, et **ne supprime que s’il a été créé pour cela** ; il n’a jamais plus de droits que la personne qui l’a créé, recoupés à chaque appel. L’administration, la console SQL et l’IA lui restent fermées.':
    'Bir program — betik, senkronizasyon, başka bir uygulama — `bdb_` ile başlayan bir **entegrasyon token’ı** sunar. Bu token yalnızca bu veritabanı için geçerlidir; okur, yazma izniyle oluşturulduysa oluşturur ve değiştirir; yalnızca bunun için oluşturulduysa siler; ve onu oluşturan kişiden, her çağrıda kesiştirilerek, asla daha fazla hakka sahip olmaz. Yönetim paneli, SQL konsolu ve yapay zeka ona kapalı kalır.',
  'Pour en créer un : menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **API REST** coché. Il n’est affiché qu’une fois.':
    'Bir tane oluşturmak için: veritabanının “⋯” menüsü → **API ve ajanlar** → **API ve MCP token’ları…**, **REST API** erişimi işaretli. Yalnızca bir kez gösterilir.',
  Appel: 'Çağrı',
  'Une authentification absente répond `401`, jamais `404` : vous devez pouvoir vous reconnecter.':
    'Eksik bir kimlik doğrulama `401` yanıtı verir, asla `404` değil: yeniden bağlanabilmeniz gerekir.',
  Conventions: 'Kurallar',
  Enveloppe: 'Zarf',
  'Toutes les réponses ont la même forme : {envelope}. Une erreur remplace `data` par le code, les détails et l’identifiant de requête.':
    'Tüm yanıtlar aynı biçimdedir: {envelope}. Bir hata, `data` alanının yerine kodu, ayrıntıları ve istek kimliğini koyar.',
  Nombres: 'Sayılar',
  '**Les nombres sont des chaînes décimales**, sans exception : {example}. Un flottant arrondirait silencieusement un montant.':
    '**Sayılar ondalık dizelerdir**, istisnasız: {example}. Bir kayan noktalı sayı bir tutarı sessizce yuvarlardı.',
  montant: 'tutar',
  'Ressource invisible': 'Görünmez kaynak',
  '**Une ressource invisible et une ressource inexistante répondent la même chose**, octet pour octet. Un `404` ne vous dit jamais si l’objet existe.':
    '**Görünmez bir kaynak ile var olmayan bir kaynak aynı şeyi yanıtlar**, bayt bayt. Bir `404`, nesnenin var olup olmadığını size asla söylemez.',
  Pagination: 'Sayfalama',
  '**Pagination par curseur** : suivez `meta.has_next_page` et passez `after`. Il n’existe aucune route d’export.':
    '**İmleçle sayfalama**: `meta.has_next_page` alanını izleyin ve `after` parametresini geçin. Herhangi bir dışa aktarma yolu yoktur.',
  'Identifiants seuls': 'Yalnızca kimlikler',
  'Pour une intégration qui ne veut que des identifiants, `?links=id` supprime la résolution des libellés — et autant d’allers-retours SQL.':
    'Yalnızca kimlik isteyen bir entegrasyon için, `?links=id` etiket çözümlemesini — ve buna karşılık gelen SQL gidiş dönüşlerini — ortadan kaldırır.',
  Relations: 'İlişkiler',
  'Aucune relation visible dans cette base.': 'Bu veritabanında görünür hiçbir ilişki yok.',
  'Les relations sont de **vraies clés étrangères PostgreSQL**. Elles sont vérifiées par la base, pas par l’application : un `INSERT` en SQL direct est soumis aux mêmes règles.':
    'İlişkiler **gerçek PostgreSQL yabancı anahtarlarıdır**. Uygulama tarafından değil, veritabanı tarafından denetlenirler: doğrudan SQL ile yapılan bir `INSERT` de aynı kurallara tabidir.',
  'Codes de réponse': 'Yanıt kodları',
  Statut: 'Durum',
  Signification: 'Anlamı',
  'Succès.': 'Başarılı.',
  'Ligne créée.': 'Satır oluşturuldu.',
  'Suppression réussie, sans contenu.': 'Silme başarılı, içerik yok.',
  'Authentification absente ou refusée.': 'Kimlik doğrulama eksik ya da reddedildi.',
  'Ressource inexistante **ou** invisible — les deux réponses sont identiques.':
    'Var olmayan **ya da** görünmez kaynak — iki yanıt da birbirinin aynısıdır.',
  'Suppression refusée : la ligne est encore référencée.':
    'Silme reddedildi: satıra hâlâ başvuruluyor.',
  'Valeur refusée par la validation.': 'Değer, doğrulama tarafından reddedildi.',
  'Une erreur a toujours cette forme, et `request_id` est ce qu’il faut citer au support :':
    'Bir hata her zaman bu biçimdedir ve destek ekibine bildirilmesi gereken şey `request_id`’dir:',
  'La liste complète des codes est servie par {route}.':
    'Kodların tam listesi {route} tarafından sunulur.',
  'Côté MCP': 'MCP tarafında',
  'Un refus arrive comme un résultat d’outil marqué `isError`, dont le texte est un objet JSON stable : le même `code` que l’API, une phrase fixe, et un `hint` qui dit comment corriger l’appel. `retryable` dit s’il vaut la peine de réessayer tel quel.':
    'Bir ret, `isError` olarak işaretlenmiş bir araç sonucu şeklinde gelir; metni sabit bir JSON nesnesidir: API ile aynı `code`, sabit bir cümle ve çağrıyı nasıl düzelteceğinizi söyleyen bir `hint`. `retryable`, çağrıyı olduğu gibi yeniden denemeye değip değmeyeceğini belirtir.',
  'Écrire en SQL direct': 'Doğrudan SQL ile yazma',
  'Ouvrez `psql` : ça marche, c’est le but du produit.':
    '`psql`’i açın: çalışır, ürünün amacı da budur.',
  'Ce qui vous attend :': 'Sizi bekleyenler:',
  'Les contraintes s’appliquent — obligatoire, longueur, clé étrangère. Une ligne référencée ne se supprime pas.':
    'Kısıtlamalar geçerlidir — zorunluluk, uzunluk, yabancı anahtar. Başvurulan bir satır silinemez.',
  'Les colonnes système ne se remplissent pas toutes seules dans un `INSERT` manuel : `_id`, `_created_at` et `_updated_at` ont des valeurs par défaut, `_created_by` et `_updated_by` attendent un identifiant d’utilisateur.':
    'Sistem sütunları, elle yapılan bir `INSERT` içinde kendiliğinden dolmaz: `_id`, `_created_at` ve `_updated_at` varsayılan değerlere sahiptir; `_created_by` ve `_updated_by` ise bir kullanıcı kimliği bekler.',
  '**Les permissions de basedb ne s’appliquent pas en SQL direct.** Elles gouvernent les surfaces du produit — API, interface, MCP. Une connexion PostgreSQL voit tout ce que son rôle voit. C’est dit ici parce que promettre le contraire serait pire que de ne rien promettre.':
    '**basedb’nin izinleri doğrudan SQL’de geçerli değildir.** Bunlar ürünün yüzeylerini yönetir — API, arayüz, MCP. Bir PostgreSQL bağlantısı, kendi rolünün gördüğü her şeyi görür. Bu, aksini vaat etmek hiçbir şey vaat etmemekten daha kötü olacağı için burada belirtiliyor.',
  '{base} — documentation API et MCP': '{base} — API ve MCP belgeleri',
}
