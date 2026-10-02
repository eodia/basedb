import type { Catalog } from './catalog.js'

/** The API and MCP documentation in Polish: the French sentence of `documentation.ts` → its translation. */
export const pl: Catalog = {
  'Prise en main': 'Pierwsze kroki',
  'API REST': 'API REST',
  'Agents (MCP)': 'Agenci (MCP)',
  Tables: 'Tabele',
  Référence: 'Referencje',
  texte: 'tekst',
  'texte long': 'długi tekst',
  'nombre (chaîne décimale)': 'liczba (ciąg dziesiętny)',
  booléen: 'wartość logiczna',
  'date (`2026-09-18`)': 'data (`2026-09-18`)',
  'date-heure UTC (`2026-09-18T14:03:00.000Z`)': 'data i godzina UTC (`2026-09-18T14:03:00.000Z`)',
  'liste de choix': 'pojedynczy wybór',
  'choix multiple (liste de valeurs)': 'wielokrotny wybór (lista wartości)',
  'relation (`_id` de la ligne liée)': 'relacja (`_id` powiązanego wiersza)',
  'relation multiple (liste des `_id` des lignes liées, dans leur ordre)':
    'relacja wielokrotna (lista `_id` powiązanych wierszy, w ich kolejności)',
  'lien URL (`https://…` ou `mailto:…`)': 'URL (`https://…` lub `mailto:…`)',
  'adresse e-mail': 'adres e-mail',
  'numéro automatique (lecture seule)': 'autonumer (tylko do odczytu)',
  'personne (`id` d’un membre de l’espace)': 'osoba (`id` członka przestrzeni roboczej)',
  formule: 'formuła',
  'documents (liste de fichiers)': 'dokumenty (lista plików)',
  'images (liste de fichiers)': 'obrazy (lista plików)',
  'colonne système': 'kolumna systemowa',
  'Un texte plus long.': 'Dłuższy tekst.',
  valeur: 'wartość',
  Exemple: 'Przykład',
  résultat: 'wynik',
  'photo.jpg': 'photo.jpg',
  'devis.pdf': 'wycena.pdf',
  Exemples: 'Przykłady',
  'Lister les lignes': 'Listowanie wierszy',
  Réponse: 'Odpowiedź',
  'Créer une ligne': 'Tworzenie wiersza',
  'Déposer un fichier': 'Przesyłanie pliku',
  'Le corps est le fichier lui-même. La réponse donne un `id`, à écrire ensuite dans {field} : {write}.':
    'Treścią żądania jest sam plik. Odpowiedź zwraca `id`, które należy potem zapisać w {field}: {write}.',
  'L’identité du jeton : qui l’a créé, sa base, ses droits effectifs et ses budgets.':
    'Tożsamość tokena: kto go utworzył, jego baza, jego rzeczywiste uprawnienia i budżety.',
  'Les bases que le jeton peut lire.': 'Bazy, które token może odczytywać.',
  'Les tables d’une base et le graphe de leurs relations.': 'Tabele bazy i graf ich relacji.',
  'Les champs d’une table : type, obligation, options, relations, et lesquels sont modifiables.':
    'Pola tabeli: typ, czy są obowiązkowe, opcje, relacje oraz które można modyfikować.',
  'Lire des lignes : filtre, tri, pagination par curseur.':
    'Odczyt wierszy: filtr, sortowanie, stronicowanie kursorem.',
  'Lire une ligne par son `_id`, les textes longs en entier si on le demande.':
    'Odczyt wiersza po jego `_id`, z długimi tekstami w całości, jeśli zostanie to zażądane.',
  'Trouver le `_id` d’une ligne par sa valeur d’affichage, avant d’écrire une relation.':
    'Znalezienie `_id` wiersza na podstawie jego wartości wyświetlanej, przed zapisaniem relacji.',
  'Créer une ligne.': 'Tworzenie wiersza.',
  'Modifier les champs nommés d’une ligne.': 'Modyfikowanie podanych pól wiersza.',
  'Supprimer une ligne, avec un jeton créé pour supprimer — la réponse la rend.':
    'Usuwanie wiersza, tokenem utworzonym do usuwania — odpowiedź go zwraca.',
  'Ramener une ligne supprimée, sous son `_id`, depuis l’historique.':
    'Przywrócenie usuniętego wiersza, pod jego `_id`, z historii.',
  'Proposer une table et ses premiers champs — une personne décide.':
    'Zaproponowanie tabeli i jej pierwszych pól — decyzję podejmuje osoba.',
  'Proposer un champ, une liste de choix ou une relation — une personne décide.':
    'Zaproponowanie pola, listy wyboru lub relacji — decyzję podejmuje osoba.',
  'Relire une proposition du jeton et savoir ce qu’il en est advenu.':
    'Ponowne odczytanie propozycji tokena i sprawdzenie, co się z nią stało.',
  'dépôt basedb': 'repozytorium basedb',
  'Depuis un agent (MCP)': 'Z poziomu agenta (MCP)',
  'Cette base n’est pas ouverte aux agents : aucun outil MCP ne voit cette table, quel que soit le jeton.':
    'Ta baza nie jest otwarta dla agentów: żadne narzędzie MCP nie widzi tej tabeli, niezależnie od użytego tokena.',
  'Connaître ses champs, et lesquels sont modifiables':
    'Poznanie jej pól i tego, które z nich można modyfikować',
  'Lire ses lignes — filtre, tri, pagination':
    'Odczyt jej wierszy — filtr, sortowanie, stronicowanie',
  'Lire une ligne par son `_id`': 'Odczyt wiersza po jego `_id`',
  'Trouver une ligne par sa valeur d’affichage, {field}':
    'Znalezienie wiersza po jego wartości wyświetlanej, {field}',
  'Modifier une ligne': 'Edycja wiersza',
  'Supprimer une ligne — avec un jeton créé pour supprimer':
    'Usuwanie wiersza — tokenem utworzonym do usuwania',
  'Ramener une ligne supprimée': 'Przywrócenie usuniętego wiersza',
  'Aucun outil ne vous est ouvert sur cette table.':
    'Żadne narzędzie nie jest dla ciebie dostępne w tej tabeli.',
  'Un jeton que vous créez n’a jamais plus de droits que vous : ces outils sont un maximum.':
    'Token, który tworzysz, nigdy nie ma więcej uprawnień niż ty: te narzędzia to maksimum.',
  Outil: 'Narzędzie',
  Pour: 'Zastosowanie',
  'Un agent ne supprime qu’avec un jeton créé « Lecture, écriture et suppression », une ligne à la fois ; la ligne supprimée revient par `restore_record` ou depuis l’historique.':
    'Agent usuwa tylko za pomocą tokena utworzonego jako „Odczyt, zapis i usuwanie”, po jednym wierszu na raz; usunięty wiersz wraca przez `restore_record` albo z historii.',
  '**Invisibles pour un agent :** {fields}. Pour lui, ces colonnes n’existent pas : il ne peut ni les lire, ni les filtrer, ni les écrire.':
    '**Niewidoczne dla agenta:** {fields}. Dla niego te kolumny nie istnieją: nie może ich ani odczytać, ani filtrować, ani zapisać.',
  'Arguments d’un appel': 'Argumenty wywołania',
  'Créer un jeton pour cette base demande le niveau **Gestion**, que vous n’avez pas. Demandez-en un à la personne qui la gère.':
    'Utworzenie tokena dla tej bazy wymaga poziomu **Zarządzanie**, którego nie masz. Poproś o niego osobę zarządzającą tą bazą.',
  '<jeton>': '<token>',
  'Connecter un agent': 'Podłączanie agenta',
  'Le **serveur MCP** de basedb ouvre cette base à un agent IA — Claude ou tout client MCP : il la découvre, la lit et, si vous le décidez, y crée, modifie et supprime des lignes. Il passe par les mêmes permissions que l’API REST.':
    '**Serwer MCP** basedb otwiera tę bazę agentowi AI — Claude lub dowolnemu klientowi MCP: agent ją odkrywa, odczytuje, a jeśli tak zdecydujesz, także tworzy, modyfikuje i usuwa w niej wiersze. Korzysta z tych samych uprawnień co API REST.',
  '**Cette base n’est pas ouverte aux agents.** Tant qu’elle ne l’est pas, aucun outil ne la voit, quel que soit le jeton présenté.':
    '**Ta baza nie jest otwarta dla agentów.** Dopóki nie zostanie otwarta, żadne narzędzie jej nie widzi, niezależnie od przedstawionego tokena.',
  'Créer un jeton': 'Tworzenie tokena',
  'Dans l’interface, menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **MCP** coché. Le jeton est limité à cette base, en **lecture seule** par défaut : l’écriture, et la suppression, se choisissent explicitement. Il n’est affiché qu’une fois, et se révoque depuis le même écran. Coché aussi pour l’**API REST**, le même jeton sert à un programme (voir « Authentification »).':
    'W interfejsie, menu „⋯” bazy → **API i agenci** → **Tokeny API i MCP…**, z zaznaczonym dostępem **MCP**. Token jest ograniczony do tej bazy, domyślnie **tylko do odczytu**: zapis, a także usuwanie, wybiera się jawnie. Jest wyświetlany tylko raz i można go odwołać z tego samego ekranu. Zaznaczony także dla **API REST**, ten sam token służy programowi (zobacz „Uwierzytelnianie”).',
  'Garder le jeton hors de la configuration': 'Przechowywanie tokena poza konfiguracją',
  'Le jeton se place dans la variable d’environnement `BASEDB_TOKEN`, jamais dans le fichier de configuration du client : celui-ci est versionné, synchronisé, et lisible par tous les programmes de la session.':
    'Token umieszcza się w zmiennej środowiskowej `BASEDB_TOKEN`, nigdy w pliku konfiguracyjnym klienta: ten plik bywa wersjonowany, synchronizowany i czytelny dla wszystkich programów w sesji.',
  'Déclarer le serveur dans le client': 'Deklarowanie serwera w kliencie',
  'Le client lance le **relais** `relay.js`, qui transporte ses messages jusqu’au serveur. Il lit le jeton dans la variable que nomme `--token-env` — `BASEDB_MCP_TOKEN` si rien n’est dit — et l’adresse du serveur dans `--url` (ou `BASEDB_MCP_URL`).':
    'Klient uruchamia **przekaźnik** `relay.js`, który przesyła jego komunikaty do serwera. Odczytuje token ze zmiennej wskazanej przez `--token-env` — domyślnie `BASEDB_MCP_TOKEN`, jeśli nic nie podano — oraz adres serwera z `--url` (lub `BASEDB_MCP_URL`).',
  'Autre client MCP': 'Inny klient MCP',
  'votre-instance': 'twoja-instancja',
  'Sans relais': 'Bez przekaźnika',
  'Un client qui parle MCP en HTTP vise directement l’adresse du serveur, `…/mcp`, avec l’en-tête {header}. Un jeton n’est accepté que sur les accès cochés à sa création : un jeton « MCP » seul est refusé par l’API REST, et inversement.':
    'Klient, który mówi MCP przez HTTP, kieruje się bezpośrednio pod adres serwera, `…/mcp`, z nagłówkiem {header}. Token jest akceptowany tylko na dostępach zaznaczonych przy jego tworzeniu: sam token „MCP” zostanie odrzucony przez API REST, i odwrotnie.',
  Vérifier: 'Weryfikacja',
  'Demandez à l’agent d’appeler `whoami` : il rend la personne qui a créé le jeton, la base de sa portée et ses droits effectifs.':
    'Poproś agenta o wywołanie `whoami`: zwraca on osobę, która utworzyła token, bazę objętą jego zasięgiem oraz jego rzeczywiste uprawnienia.',
  Outils: 'Narzędzia',
  '{count} outils, toujours les mêmes : leur nom et leur description ne dépendent jamais de vos données. Le schéma se découvre en les appelant.':
    '{count} narzędzi, zawsze tych samych: ich nazwa i opis nigdy nie zależą od twoich danych. Schemat poznaje się, wywołując je.',
  Rôle: 'Rola',
  Écrit: 'Zapisuje?',
  oui: 'tak',
  propose: 'proponuje',
  non: 'nie',
  'Enchaînement type': 'Typowy przebieg wywołań',
  '`list_bases`, puis `describe_base` : ce qui existe.':
    '`list_bases`, a potem `describe_base`: co istnieje.',
  '`describe_table` avant toute lecture ou écriture : les champs, leurs types, et ceux que le jeton peut écrire (`access: "write"`).':
    '`describe_table` przed każdym odczytem lub zapisem: pola, ich typy oraz te, które token może zapisywać (`access: "write"`).',
  '`list_records` avec `filter`, `sort` et `limit` ; poursuivre avec `cursor` tant que `has_more` vaut `true`.':
    '`list_records` z `filter`, `sort` i `limit`; kontynuuj za pomocą `cursor`, dopóki `has_more` ma wartość `true`.',
  'Pour écrire une relation : `lookup_records` sur la table cible, puis `create_record` ou `update_record` avec le `_id` trouvé.':
    'Aby zapisać relację: `lookup_records` na tabeli docelowej, a potem `create_record` lub `update_record` ze znalezionym `_id`.',
  'Pour faire évoluer la structure : `propose_create_table` ou `propose_add_field`, puis `get_proposal` pour suivre la décision.':
    'Aby zmienić strukturę: `propose_create_table` lub `propose_add_field`, a potem `get_proposal`, aby śledzić decyzję.',
  'Pour supprimer : `get_record` d’abord, pour être sûr de la ligne, puis `delete_record` — qui la rend dans sa réponse ; `restore_record` la ramène.':
    'Aby usunąć: najpierw `get_record`, żeby się upewnić, o który wiersz chodzi, a potem `delete_record` — który zwraca go w swojej odpowiedzi; `restore_record` go przywraca.',
  'Propositions de structure': 'Propozycje zmian struktury',
  'Un agent ne modifie jamais la structure lui-même : il **propose**. La proposition attend dans la file « Propositions » de la base, où une personne qui peut modifier la structure l’approuve ou la refuse ; sans décision, elle expire au bout de 24 heures. Approuvée, elle est appliquée au nom de la personne qui a créé le jeton — si cette personne a toujours le droit de le faire — et apparaît dans l’historique comme n’importe quelle modification.':
    'Agent nigdy sam nie zmienia struktury: on **proponuje**. Propozycja czeka w kolejce „Propozycje” danej bazy, gdzie osoba mogąca zmieniać strukturę zatwierdza ją lub odrzuca; bez decyzji wygasa po 24 godzinach. Zatwierdzona, jest wprowadzana w imieniu osoby, która utworzyła token — jeśli nadal ma ona do tego prawo — i pojawia się w historii jak każda inna zmiana.',
  'Au plus 5 propositions en attente par jeton ; une nouvelle proposition sur le même objet remplace la précédente (`superseded`).':
    'Maksymalnie 5 oczekujących propozycji na token; nowa propozycja dotycząca tego samego obiektu zastępuje poprzednią (`superseded`).',
  'Pas de suppression, pas de renommage, pas de relation en cascade (`MCP_CASCADE_FORBIDDEN`).':
    'Bez usuwania, bez zmiany nazwy, bez relacji kaskadowych (`MCP_CASCADE_FORBIDDEN`).',
  'Ce qui n’existe pas': 'Czego nie ma',
  'Aucun outil ne supprime plusieurs lignes à la fois, une table ou un champ, n’exécute de SQL ni ne gère les droits ou les jetons. Un agent qui appelle un tel nom — `delete_records`, `run_sql`… — reçoit `MCP_OPERATION_EXCLUDED`, quelle que soit la base visée.':
    'Żadne narzędzie nie usuwa wielu wierszy naraz, tabeli ani pola, nie wykonuje SQL ani nie zarządza uprawnieniami czy tokenami. Agent, który wywoła taką nazwę — `delete_records`, `run_sql`… — otrzymuje `MCP_OPERATION_EXCLUDED`, niezależnie od docelowej bazy.',
  Bornes: 'Ograniczenia',
  '`limit` : 25 lignes par défaut, 100 au plus.': '`limit`: domyślnie 25 wierszy, maksymalnie 100.',
  'Un filtre compte au plus 10 prédicats, combinés par ET ; un tri, au plus 3 champs.':
    'Filtr liczy najwyżej 10 predykatów, łączonych operatorem AND; sortowanie — najwyżej 3 pola.',
  'Dans une liste, un texte de plus de 500 caractères est tronqué et nommé dans `_truncated_fields` ; `get_record` avec `full_fields` le rend entier.':
    'Na liście tekst dłuższy niż 500 znaków jest skracany i wymieniany w `_truncated_fields`; `get_record` z `full_fields` zwraca go w całości.',
  'Une écriture accepte une `idempotency_key` : la rejouer ne crée pas de doublon.':
    'Zapis akceptuje `idempotency_key`: powtórzenie go nie tworzy duplikatu.',
  'Ce que voit un agent': 'Co widzi agent',
  'Un agent ne voit jamais plus que la personne qui a créé son jeton — et souvent moins.':
    'Agent nigdy nie widzi więcej niż osoba, która utworzyła jego token — a często mniej.',
  '**Droits** : ceux du jeton, recoupés à chaque appel avec ceux de son créateur. Si les droits de cette personne baissent, ceux du jeton baissent avec eux ; si son compte est désactivé, le jeton cesse de répondre.':
    '**Uprawnienia**: te, które ma token, przy każdym wywołaniu zestawiane z uprawnieniami jego twórcy. Jeśli uprawnienia tej osoby maleją, uprawnienia tokena maleją razem z nimi; jeśli jej konto zostanie wyłączone, token przestaje odpowiadać.',
  '**Lire, créer, modifier** — et supprimer, une ligne à la fois, seulement avec un jeton créé pour cela. Un jeton en lecture seule refuse toute écriture (`TOKEN_READ_ONLY`).':
    '**Odczyt, tworzenie, modyfikowanie** — i usuwanie, po jednym wierszu na raz, tylko za pomocą tokena utworzonego do tego. Token tylko do odczytu odrzuca każdy zapis (`TOKEN_READ_ONLY`).',
  '**Cette base** : ouverte aux agents.': '**Ta baza**: otwarta dla agentów.',
  '**Cette base** : **fermée aux agents** — aucun outil ne la voit.':
    '**Ta baza**: **zamknięta dla agentów** — żadne narzędzie jej nie widzi.',
  '**Colonnes réservées aux humains** : aucune dans ce que vous voyez de cette base.':
    '**Kolumny zastrzeżone dla ludzi**: żadnej w tym, co widzisz w tej bazie.',
  '**Colonnes réservées aux humains** : {columns}. Pour un agent, elles n’existent pas.':
    '**Kolumny zastrzeżone dla ludzi**: {columns}. Dla agenta one nie istnieją.',
  '**Des données, pas des consignes** : descriptions et contenus sont rendus comme des données saisies par des utilisateurs, et les outils le disent à l’agent.':
    '**Dane, a nie instrukcje**: opisy i treści są przekazywane jako dane wprowadzone przez użytkowników, a narzędzia mówią o tym agentowi.',
  '**Journal** : chaque appel est journalisé par la forme de ses paramètres, jamais par leurs valeurs.':
    '**Dziennik**: każde wywołanie jest rejestrowane według kształtu jego parametrów, nigdy według ich wartości.',
  obligatoire: 'wymagane',
  'calculé par l’IA': 'obliczane przez AI',
  'lecture seule': 'tylko do odczytu',
  'HTML riche — **à assainir à l’affichage**':
    'bogaty HTML — **do oczyszczenia przy wyświetlaniu**',
  'invisible pour les agents': 'niewidoczne dla agentów',
  'relation → {table}': 'relacja → {table}',
  'Valeurs : {values}.': 'Wartości: {values}.',
  'cible non visible pour vous : la cellule vaut toujours {cell}':
    'cel niewidoczny dla ciebie: komórka zawsze ma wartość {cell}',
  'pointe vers {table} (aucune colonne d’affichage désignée : la cellule montre l’identifiant)':
    'wskazuje na {table} (nie wyznaczono kolumny wyświetlanej: komórka pokazuje identyfikator)',
  'pointe vers {table}, affiché par {field}': 'wskazuje na {table}, wyświetlany przez {field}',
  'à la suppression : supprimer la ligne cible est refusé tant qu’elle est référencée':
    'przy usuwaniu: usunięcie wiersza docelowego jest odrzucane, dopóki jest on referencjonowany',
  'à la suppression : supprimer la ligne cible vide cette cellule':
    'przy usuwaniu: usunięcie wiersza docelowego opróżnia tę komórkę',
  'à la suppression : supprimer la ligne cible supprime aussi cette ligne':
    'przy usuwaniu: usunięcie wiersza docelowego usuwa też ten wiersz',
  'en écriture, acceptez un `uuid` nu, `null`, ou `{"id": "…"}` ; en lecture, toujours `{"id": …, "display": …}`':
    'przy zapisie akceptowany jest zwykły `uuid`, `null` lub `{"id": "…"}`; przy odczycie zawsze `{"id": …, "display": …}`',
  'Lister les lignes — filtre, tri, pagination par curseur':
    'Listowanie wierszy — filtr, sortowanie, stronicowanie kursorem',
  'Lire une ligne': 'Odczyt wiersza',
  'Supprimer une ligne': 'Usuwanie wiersza',
  'Lister les lignes qui pointent vers celle-ci': 'Listowanie wierszy wskazujących na ten wiersz',
  Méthode: 'Metoda',
  Chemin: 'Ścieżka',
  lire: 'czytać',
  créer: 'tworzyć',
  modifier: 'modyfikować',
  supprimer: 'usuwać',
  '**En SQL :** {sql}': '**W SQL:** {sql}',
  'Vous pouvez {verbs}. Les verbes absents de cette liste ne vous sont pas ouverts, et les chemins correspondants ne sont pas décrits.':
    'Możesz {verbs}. Czasowniki nieobecne na tej liście nie są dla ciebie dostępne, a odpowiadające im ścieżki nie są opisane.',
  'Points d’accès': 'Punkty dostępowe',
  Colonnes: 'Kolumny',
  Colonne: 'Kolumna',
  Libellé: 'Etykieta',
  Type: 'Typ',
  Description: 'Opis',
  'Champs relation': 'Pola relacji',
  'Colonnes système': 'Kolumny systemowe',
  'Toujours lisibles, jamais inscriptibles. Elles portent la pagination par curseur et la reprise incrémentale, et aucun réglage ne les masque.':
    'Zawsze do odczytu, nigdy do zapisu. Obsługują stronicowanie kursorem i wznawianie przyrostowe, i żadne ustawienie ich nie ukrywa.',
  Expansion: 'Rozwijanie',
  '{expand} — profondeur 1 sans exception. Les objets liés arrivent dans `included`, indexés par nom de table puis par identifiant, et non imbriqués dans la ligne : 100 lignes pointant 3 cibles transportent 3 objets.':
    '{expand} — głębokość 1 bez wyjątków. Powiązane obiekty trafiają do `included`, indeksowanego według nazwy tabeli, a potem identyfikatora, a nie są zagnieżdżone w wierszu: 100 wierszy wskazujących na 3 cele przenosi 3 obiekty.',
  'Lignes référençantes': 'Wiersze wskazujące',
  '{route} liste les lignes qui pointent vers une ligne donnée. Un bloc dont la table source ne vous est pas visible n’y figure pas du tout — ni bloc, ni compteur, ni mention.':
    '{route} zwraca listę wierszy, które wskazują na dany wiersz. Blok, którego tabela źródłowa nie jest dla ciebie widoczna, w ogóle się tam nie pojawia — ani blok, ani licznik, ani wzmianka.',
  'une table que vous ne voyez pas': 'tabela, której nie widzisz',
  'Vue d’ensemble': 'Przegląd',
  'Cette base s’appelle {name} — c’est le nom du **schéma PostgreSQL**, et celui que vous écrivez dans vos URL comme dans les appels d’outils. Les tables et les colonnes portent les mêmes noms ici et en SQL : il n’y a pas de table de correspondance à consulter.':
    'Ta baza nazywa się {name} — to nazwa **schematu PostgreSQL**, tej samej, którą wpisujesz w swoich adresach URL i w wywołaniach narzędzi. Tabele i kolumny noszą te same nazwy tutaj i w SQL: nie ma żadnej tabeli odpowiedników do sprawdzania.',
  'Deux accès, les mêmes permissions : l’**API REST** pour vos programmes, le **serveur MCP** pour les agents IA. Chaque page de table dit comment l’atteindre par l’un et par l’autre.':
    'Dwa dostępy, te same uprawnienia: **API REST** dla twoich programów, **serwer MCP** dla agentów AI. Każda strona tabeli mówi, jak dotrzeć do niej jednym i drugim sposobem.',
  Élément: 'Element',
  Valeur: 'Wartość',
  'Schéma PostgreSQL': 'Schemat PostgreSQL',
  'Préfixe des routes REST': 'Prefiks ścieżek REST',
  'ouverte — voir « Connecter un agent »': 'otwarta — zobacz „Podłączanie agenta”',
  '**fermée aux agents**': '**zamknięta dla agentów**',
  'Tables visibles': 'Widoczne tabele',
  Format: 'Format',
  'JSON, dans une enveloppe {envelope}': 'JSON, w kopercie {envelope}',
  '**Cette documentation décrit ce que VOUS pouvez voir.** Deux lecteurs en obtiennent deux versions différentes, et c’est la règle, pas un effet de bord. Ne la publiez pas telle quelle.':
    '**Ta dokumentacja opisuje to, co TY możesz zobaczyć.** Dwie osoby czytające otrzymują dwie różne wersje, i to jest reguła, a nie efekt uboczny. Nie publikuj jej w tej postaci.',
  Authentification: 'Uwierzytelnianie',
  'Toutes les routes de données demandent un **jeton**, dans l’en-tête `Authorization`. Le cookie de session n’est jamais accepté ici : un navigateur l’envoie sur chaque requête, y compris celles qu’une page étrangère provoque.':
    'Wszystkie trasy danych wymagają **tokena**, w nagłówku `Authorization`. Ciasteczko sesji nigdy nie jest tu akceptowane: przeglądarka wysyła je przy każdym żądaniu, także tych wywołanych przez obcą stronę.',
  'Jeton d’intégration': 'Token integracyjny',
  'Un programme — script, synchronisation, autre application — présente un **jeton d’intégration**, qui commence par `bdb_`. Il ne vaut que pour cette base ; il lit, crée et modifie s’il a été créé en écriture, et **ne supprime que s’il a été créé pour cela** ; il n’a jamais plus de droits que la personne qui l’a créé, recoupés à chaque appel. L’administration, la console SQL et l’IA lui restent fermées.':
    'Program — skrypt, synchronizacja, inna aplikacja — przedstawia **token integracyjny**, który zaczyna się od `bdb_`. Jest ważny tylko dla tej bazy; odczytuje, a jeśli został utworzony z prawem zapisu, także tworzy i modyfikuje, i **usuwa tylko wtedy, gdy został do tego utworzony**; nigdy nie ma więcej uprawnień niż osoba, która go utworzyła, zestawianych przy każdym wywołaniu. Administracja, konsola SQL i AI pozostają dla niego zamknięte.',
  'Pour en créer un : menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **API REST** coché. Il n’est affiché qu’une fois.':
    'Aby go utworzyć: menu „⋯” bazy → **API i agenci** → **Tokeny API i MCP…**, z zaznaczonym dostępem **API REST**. Jest wyświetlany tylko raz.',
  Appel: 'Wywołanie',
  'Une authentification absente répond `401`, jamais `404` : vous devez pouvoir vous reconnecter.':
    'Brak uwierzytelnienia odpowiada `401`, nigdy `404`: musisz mieć możliwość ponownego zalogowania się.',
  Conventions: 'Konwencje',
  Enveloppe: 'Koperta',
  'Toutes les réponses ont la même forme : {envelope}. Une erreur remplace `data` par le code, les détails et l’identifiant de requête.':
    'Wszystkie odpowiedzi mają tę samą postać: {envelope}. Błąd zastępuje `data` kodem, szczegółami i identyfikatorem żądania.',
  Nombres: 'Liczby',
  '**Les nombres sont des chaînes décimales**, sans exception : {example}. Un flottant arrondirait silencieusement un montant.':
    '**Liczby są ciągami dziesiętnymi**, bez wyjątku: {example}. Liczba zmiennoprzecinkowa po cichu zaokrągliłaby kwotę.',
  montant: 'kwota',
  'Ressource invisible': 'Niewidoczny zasób',
  '**Une ressource invisible et une ressource inexistante répondent la même chose**, octet pour octet. Un `404` ne vous dit jamais si l’objet existe.':
    '**Niewidoczny zasób i nieistniejący zasób dają dokładnie tę samą odpowiedź**, bajt po bajcie. `404` nigdy nie mówi, czy obiekt istnieje.',
  Pagination: 'Stronicowanie',
  '**Pagination par curseur** : suivez `meta.has_next_page` et passez `after`. Il n’existe aucune route d’export.':
    '**Stronicowanie kursorem**: śledź `meta.has_next_page` i przekazuj `after`. Nie istnieje żadna trasa eksportu.',
  'Identifiants seuls': 'Same identyfikatory',
  'Pour une intégration qui ne veut que des identifiants, `?links=id` supprime la résolution des libellés — et autant d’allers-retours SQL.':
    'Dla integracji, która potrzebuje tylko identyfikatorów, `?links=id` usuwa rozwiązywanie etykiet — a wraz z nim tyle samo dodatkowych zapytań SQL.',
  Relations: 'Relacje',
  'Aucune relation visible dans cette base.': 'Brak widocznych relacji w tej bazie.',
  'Les relations sont de **vraies clés étrangères PostgreSQL**. Elles sont vérifiées par la base, pas par l’application : un `INSERT` en SQL direct est soumis aux mêmes règles.':
    'Relacje to **prawdziwe klucze obce PostgreSQL**. Są sprawdzane przez bazę, a nie przez aplikację: `INSERT` wykonany bezpośrednio w SQL podlega tym samym regułom.',
  'Codes de réponse': 'Kody odpowiedzi',
  Statut: 'Status',
  Signification: 'Znaczenie',
  'Succès.': 'Sukces.',
  'Ligne créée.': 'Wiersz utworzony.',
  'Suppression réussie, sans contenu.': 'Usunięcie zakończone powodzeniem, bez treści.',
  'Authentification absente ou refusée.': 'Uwierzytelnienie nieobecne lub odrzucone.',
  'Ressource inexistante **ou** invisible — les deux réponses sont identiques.':
    'Zasób nieistniejący **lub** niewidoczny — obie odpowiedzi są identyczne.',
  'Suppression refusée : la ligne est encore référencée.':
    'Odmowa usunięcia: wiersz jest nadal referencjonowany.',
  'Valeur refusée par la validation.': 'Wartość odrzucona przez walidację.',
  'Une erreur a toujours cette forme, et `request_id` est ce qu’il faut citer au support :':
    'Błąd zawsze ma taką postać, a `request_id` to identyfikator, który należy podać wsparciu technicznemu:',
  'La liste complète des codes est servie par {route}.':
    'Pełna lista kodów jest dostępna pod adresem {route}.',
  'Côté MCP': 'Po stronie MCP',
  'Un refus arrive comme un résultat d’outil marqué `isError`, dont le texte est un objet JSON stable : le même `code` que l’API, une phrase fixe, et un `hint` qui dit comment corriger l’appel. `retryable` dit s’il vaut la peine de réessayer tel quel.':
    'Odmowa przychodzi jako wynik narzędzia oznaczony `isError`, którego treść jest stabilnym obiektem JSON: taki sam `code` jak w API, stały komunikat oraz `hint`, który mówi, jak poprawić wywołanie. `retryable` mówi, czy warto ponowić je bez zmian.',
  'Écrire en SQL direct': 'Pisanie bezpośrednio w SQL',
  'Ouvrez `psql` : ça marche, c’est le but du produit.':
    'Otwórz `psql`: to działa, taki jest cel tego produktu.',
  'Ce qui vous attend :': 'Co cię czeka:',
  'Les contraintes s’appliquent — obligatoire, longueur, clé étrangère. Une ligne référencée ne se supprime pas.':
    'Ograniczenia obowiązują — pole wymagane, długość, klucz obcy. Referencjonowanego wiersza nie da się usunąć.',
  'Les colonnes système ne se remplissent pas toutes seules dans un `INSERT` manuel : `_id`, `_created_at` et `_updated_at` ont des valeurs par défaut, `_created_by` et `_updated_by` attendent un identifiant d’utilisateur.':
    'Kolumny systemowe nie wypełniają się same przy ręcznym `INSERT`: `_id`, `_created_at` i `_updated_at` mają wartości domyślne, a `_created_by` i `_updated_by` oczekują identyfikatora użytkownika.',
  '**Les permissions de basedb ne s’appliquent pas en SQL direct.** Elles gouvernent les surfaces du produit — API, interface, MCP. Une connexion PostgreSQL voit tout ce que son rôle voit. C’est dit ici parce que promettre le contraire serait pire que de ne rien promettre.':
    '**Uprawnienia basedb nie obowiązują w bezpośrednim SQL.** Rządzą one powierzchniami produktu — API, interfejsem, MCP. Połączenie PostgreSQL widzi wszystko, co widzi jego rola. Mówimy o tym tutaj, ponieważ obiecywanie czegoś przeciwnego byłoby gorsze niż nieobiecywanie niczego.',
  '{base} — documentation API et MCP': '{base} — dokumentacja API i MCP',
}
