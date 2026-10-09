import type { Catalog } from './catalog.js'

/** The API and MCP documentation in Norwegian Bokmål: the French sentence of `documentation.ts` → its translation. */
export const nb: Catalog = {
  'Prise en main': 'Kom i gang',
  'API REST': 'REST-API',
  'Agents (MCP)': 'Agenter (MCP)',
  Tables: 'Tabeller',
  Référence: 'Referanse',
  texte: 'tekst',
  'texte long': 'lang tekst',
  'nombre (chaîne décimale)': 'tall (desimalstreng)',
  booléen: 'boolsk',
  'date (`2026-09-18`)': 'dato (`2026-09-18`)',
  'date-heure UTC (`2026-09-18T14:03:00.000Z`)':
    'dato og klokkeslett UTC (`2026-09-18T14:03:00.000Z`)',
  'liste de choix': 'valgliste',
  'choix multiple (liste de valeurs)': 'flervalg (liste med verdier)',
  'relation (`_id` de la ligne liée)': 'relasjon (`_id` for den koblede raden)',
  'relation multiple (liste des `_id` des lignes liées, dans leur ordre)':
    'flerrelasjon (liste over `_id` for de koblede radene, i rekkefølge)',
  'lien URL (`https://…` ou `mailto:…`)': 'URL-lenke (`https://…` eller `mailto:…`)',
  'adresse e-mail': 'e-postadresse',
  'numéro automatique (lecture seule)': 'autonummer (skrivebeskyttet)',
  'personne (`id` d’un membre de l’espace)': 'person (`id` for et medlem av arbeidsområdet)',
  formule: 'formel',
  'documents (liste de fichiers)': 'dokumenter (liste over filer)',
  'images (liste de fichiers)': 'bilder (liste over filer)',
  'colonne système': 'systemkolonne',
  'Un texte plus long.': 'En lengre tekst.',
  valeur: 'verdi',
  Exemple: 'Eksempel',
  résultat: 'resultat',
  'photo.jpg': 'bilde.jpg',
  'devis.pdf': 'tilbud.pdf',
  Exemples: 'Eksempler',
  'Lister les lignes': 'Liste rader',
  Réponse: 'Svar',
  'Créer une ligne': 'Opprette en rad',
  'Déposer un fichier': 'Laste opp en fil',
  'Le corps est le fichier lui-même. La réponse donne un `id`, à écrire ensuite dans {field} : {write}.':
    'Kroppen er selve filen. Svaret gir en `id`, som deretter skrives inn i {field}: {write}.',
  'L’identité du jeton : qui l’a créé, sa base, ses droits effectifs et ses budgets.':
    'Tokenets identitet: hvem som opprettet det, databasen det tilhører, de faktiske tillatelsene og budsjettene.',
  'Les bases que le jeton peut lire.': 'Databasene tokenet kan lese.',
  'Les tables d’une base et le graphe de leurs relations.':
    'Tabellene i en database og grafen over relasjonene deres.',
  'Les champs d’une table : type, obligation, options, relations, et lesquels sont modifiables.':
    'Feltene i en tabell: type, obligatorisk, alternativer, relasjoner, og hvilke som kan endres.',
  'Lire des lignes : filtre, tri, pagination par curseur.':
    'Lese rader: filter, sortering, markørbasert paginering.',
  'Lire une ligne par son `_id`, les textes longs en entier si on le demande.':
    'Lese en rad ut fra `_id`, med lange tekster i sin helhet hvis det blir bedt om det.',
  'Trouver le `_id` d’une ligne par sa valeur d’affichage, avant d’écrire une relation.':
    'Finne `_id`-en til en rad ut fra visningsverdien, før en relasjon skrives.',
  'Créer une ligne.': 'Opprette en rad.',
  'Modifier les champs nommés d’une ligne.': 'Endre navngitte felt i en rad.',
  'Supprimer une ligne, avec un jeton créé pour supprimer — la réponse la rend.':
    'Slette en rad, med et token opprettet for å slette – svaret gir den tilbake.',
  'Ramener une ligne supprimée, sous son `_id`, depuis l’historique.':
    'Gjenopprette en slettet rad, ut fra `_id`-en sin, fra historikken.',
  'Proposer une table et ses premiers champs — une personne décide.':
    'Foreslå en tabell og de første feltene – en person avgjør.',
  'Proposer un champ, une liste de choix ou une relation — une personne décide.':
    'Foreslå et felt, en valgliste eller en relasjon – en person avgjør.',
  'Proposer la couleur et le pictogramme d’une table et des choix de ses listes — une personne décide.':
    'Foreslå farge og ikon for en tabell og for valgene i listene den har – en person avgjør.',
  'Relire une proposition du jeton et savoir ce qu’il en est advenu.':
    'Se på nytt et forslag fra tokenet, og få vite hva som ble av det.',
  'dépôt basedb': 'basedb-depotet',
  recette: 'test',
  'Depuis un agent (MCP)': 'Fra en agent (MCP)',
  'Cette base n’est pas ouverte aux agents : aucun outil MCP ne voit cette table, quel que soit le jeton.':
    'Denne databasen er ikke åpen for agenter: ingen MCP-verktøy ser denne tabellen, uansett hvilket token som brukes.',
  'Connaître ses champs, et lesquels sont modifiables': 'Kjenne feltene, og hvilke som kan endres',
  'Lire ses lignes — filtre, tri, pagination': 'Lese radene – filter, sortering, paginering',
  'Lire une ligne par son `_id`': 'Lese en rad ut fra `_id`',
  'Trouver une ligne par sa valeur d’affichage, {field}':
    'Finne en rad ut fra visningsverdien, {field}',
  'Modifier une ligne': 'Endre en rad',
  'Supprimer une ligne — avec un jeton créé pour supprimer':
    'Slette en rad – med et token opprettet for å slette',
  'Ramener une ligne supprimée': 'Gjenopprette en slettet rad',
  'Aucun outil ne vous est ouvert sur cette table.':
    'Ingen verktøy er tilgjengelige for deg på denne tabellen.',
  'Un jeton que vous créez n’a jamais plus de droits que vous : ces outils sont un maximum.':
    'Et token du oppretter, har aldri flere tillatelser enn deg: disse verktøyene er et maksimum.',
  Outil: 'Verktøy',
  Pour: 'Formål',
  'Un agent ne supprime qu’avec un jeton créé « Lecture, écriture et suppression », une ligne à la fois ; la ligne supprimée revient par `restore_record` ou depuis l’historique.':
    'En agent sletter bare med et token opprettet med «Lesing, skriving og sletting», én rad om gangen; den slettede raden kommer tilbake via `restore_record` eller fra historikken.',
  '**Invisibles pour un agent :** {fields}. Pour lui, ces colonnes n’existent pas : il ne peut ni les lire, ni les filtrer, ni les écrire.':
    '**Usynlige for en agent:** {fields}. For agenten finnes ikke disse kolonnene: den kan verken lese, filtrere eller skrive dem.',
  'Arguments d’un appel': 'Argumenter for et kall',
  'Créer un jeton pour cette base demande le niveau **Gestion**, que vous n’avez pas. Demandez-en un à la personne qui la gère.':
    'Å opprette et token for denne databasen krever nivået **Administrere**, som du ikke har. Be personen som administrerer den, om å opprette et.',
  '<jeton>': '<token>',
  'Connecter un agent': 'Koble til en agent',
  'Le **serveur MCP** de basedb ouvre cette base à un agent IA — Claude ou tout client MCP : il la découvre, la lit et, si vous le décidez, y crée, modifie et supprime des lignes. Il passe par les mêmes permissions que l’API REST.':
    '**MCP-serveren** til basedb åpner denne databasen for en KI-agent – Claude eller en hvilken som helst MCP-klient: den oppdager den, leser den, og hvis du bestemmer det, oppretter, endrer og sletter rader i den. Den bruker de samme tillatelsene som REST-API-et.',
  '**Cette base n’est pas ouverte aux agents.** Tant qu’elle ne l’est pas, aucun outil ne la voit, quel que soit le jeton présenté.':
    '**Denne databasen er ikke åpen for agenter.** Så lenge den ikke er det, ser ingen verktøy den, uansett hvilket token som blir vist frem.',
  'Créer un jeton': 'Opprette et token',
  'Dans l’interface, menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **MCP** coché. Le jeton ouvre **toute la base, tous ses environnements** — production, recette… — ou un seul, si vous le limitez. Il est en **lecture seule** par défaut : l’écriture, et la suppression, se choisissent explicitement. Il n’est affiché qu’une fois, et se révoque depuis le même écran. Coché aussi pour l’**API REST**, le même jeton sert à un programme (voir « Authentification »).':
    'I grensesnittet, menyen «⋯» til databasen → **API og agenter** → **API- og MCP-tokener…**, med **MCP**-tilgang avkrysset. Tokenet åpner **hele databasen, alle miljøene dens** – produksjon, test … – eller bare ett, hvis du begrenser det. Det er **skrivebeskyttet** som standard: skrivetilgang, og sletting, velges eksplisitt. Det vises bare én gang, og kan tilbakekalles fra samme skjerm. Med **REST-API**-tilgang også avkrysset, brukes det samme tokenet av et program (se «Autentisering»).',
  'Garder le jeton hors de la configuration': 'Holde tokenet utenfor konfigurasjonen',
  'Le jeton se place dans la variable d’environnement `BASEDB_TOKEN`, jamais dans le fichier de configuration du client : celui-ci est versionné, synchronisé, et lisible par tous les programmes de la session.':
    'Tokenet legges i miljøvariabelen `BASEDB_TOKEN`, aldri i klientens konfigurasjonsfil: den er versjonert, synkronisert, og lesbar for alle programmene i økten.',
  'Déclarer le serveur dans le client': 'Registrere serveren i klienten',
  'Un client qui parle MCP en HTTP — Claude Code, entre autres — vise directement l’adresse du serveur, `…/mcp`, avec l’en-tête {header}. Dans le fichier `.mcp.json` d’un projet, `${BASEDB_TOKEN}` est lu dans l’environnement : le jeton ne s’écrit pas dans le fichier. Le même jeton peut déclarer un serveur par environnement.':
    'En klient som snakker MCP over HTTP – blant andre Claude Code – går direkte til serverens adresse, `…/mcp`, med headeren {header}. I filen `.mcp.json` i et prosjekt blir `${BASEDB_TOKEN}` lest fra miljøet: tokenet skrives ikke inn i filen. Det samme tokenet kan registrere én server per miljø.',
  'Client sans HTTP : le relais': 'Klient uten HTTP: reléet',
  'Un client qui ne lance que des programmes locaux (stdio) passe par le **relais** `relay.js`, qui transporte ses messages jusqu’au serveur. Il lit le jeton dans la variable que nomme `--token-env` — `BASEDB_MCP_TOKEN` si rien n’est dit —, l’adresse du serveur dans `--url` (ou `BASEDB_MCP_URL`), et l’environnement dans `--environment` (ou `BASEDB_MCP_ENVIRONMENT`).':
    'En klient som bare starter lokale programmer (stdio), går via **reléet** `relay.js`, som fører meldingene sine til serveren. Det leser tokenet fra variabelen angitt av `--token-env` – `BASEDB_MCP_TOKEN` hvis ingenting er oppgitt –, serverens adresse fra `--url` (eller `BASEDB_MCP_URL`), og miljøet fra `--environment` (eller `BASEDB_MCP_ENVIRONMENT`).',
  'Autre client MCP': 'Annen MCP-klient',
  'votre-instance': 'din-instans',
  'Un jeton n’est accepté que sur les accès cochés à sa création : un jeton « MCP » seul est refusé par l’API REST, et inversement.':
    'Et token godtas bare for tilgangene som ble avkrysset da det ble opprettet: et token med bare «MCP»-tilgang blir avvist av REST-API-et, og omvendt.',
  'Choisir l’environnement': 'Velge miljø',
  'Une base peut avoir plusieurs environnements — production, recette, développement —, chacun avec ses tables et ses lignes. Un jeton de toute la base les ouvre tous ; l’environnement se choisit à l’appel, du plus large au plus précis :':
    'En database kan ha flere miljøer – produksjon, test, utvikling –, hver med sine egne tabeller og rader. Et token for hele databasen åpner dem alle; miljøet velges ved kallet, fra det bredeste til det mest presise:',
  '**Le nom de la base**, sans rien d’autre : {base} est la production, et chaque environnement garde aussi son propre nom.':
    '**Databasenavnet**, uten noe annet: {base} er produksjon, og hvert miljø beholder også sitt eget navn.',
  '**L’adresse du serveur** : {address} — un serveur déclaré par environnement.':
    '**Serveradressen**: {address} – én registrert server per miljø.',
  '**L’argument `environment`** de chaque outil qui nomme une base, pour un seul appel : {example}.':
    '**Argumentet `environment`** i hvert verktøy som navngir en database, for ett enkelt kall: {example}.',
  'Un environnement se nomme par son badge, sans tenir compte des majuscules ni des accents, ou `production`. Un environnement que la base n’a pas répond `RESOURCE_NOT_FOUND`.':
    'Et miljø navngis med merket sitt, uten hensyn til store og små bokstaver eller aksenter, eller med `production`. Et miljø som databasen ikke har, svarer `RESOURCE_NOT_FOUND`.',
  Vérifier: 'Sjekke',
  'Demandez à l’agent d’appeler `whoami` : il rend la personne qui a créé le jeton, la base de sa portée, les environnements qu’il ouvre (`scope.available`) et ses droits effectifs.':
    'Be agenten om å kalle `whoami`: den gir tilbake personen som opprettet tokenet, databasen det gjelder for, miljøene det åpner (`scope.available`) og de faktiske tillatelsene.',
  Outils: 'Verktøy',
  '{count} outils, toujours les mêmes : leur nom et leur description ne dépendent jamais de vos données. Le schéma se découvre en les appelant.':
    '{count} verktøy, alltid de samme: navnet og beskrivelsen deres avhenger aldri av dataene dine. Skjemaet oppdages ved å kalle dem.',
  Rôle: 'Rolle',
  Écrit: 'Skriver?',
  oui: 'ja',
  propose: 'foreslår',
  non: 'nei',
  'Enchaînement type': 'Typisk forløp',
  '`list_bases`, puis `describe_base` : ce qui existe.':
    '`list_bases`, deretter `describe_base`: det som finnes.',
  '`describe_table` avant toute lecture ou écriture : les champs, leurs types, et ceux que le jeton peut écrire (`access: "write"`).':
    '`describe_table` før all lesing eller skriving: feltene, typene deres, og de tokenet kan skrive til (`access: "write"`).',
  '`list_records` avec `filter`, `sort` et `limit` ; poursuivre avec `cursor` tant que `has_more` vaut `true`.':
    '`list_records` med `filter`, `sort` og `limit`; fortsett med `cursor` så lenge `has_more` er `true`.',
  'Pour écrire une relation : `lookup_records` sur la table cible, puis `create_record` ou `update_record` avec le `_id` trouvé.':
    'For å skrive en relasjon: `lookup_records` på måltabellen, deretter `create_record` eller `update_record` med den funnede `_id`-en.',
  'Pour faire évoluer la structure : `propose_create_table` ou `propose_add_field`, puis `get_proposal` pour suivre la décision.':
    'For å endre strukturen: `propose_create_table` eller `propose_add_field`, deretter `get_proposal` for å følge avgjørelsen.',
  'Pour supprimer : `get_record` d’abord, pour être sûr de la ligne, puis `delete_record` — qui la rend dans sa réponse ; `restore_record` la ramène.':
    'For å slette: `get_record` først, for å være sikker på raden, deretter `delete_record` – som gir den tilbake i svaret sitt; `restore_record` gjenoppretter den.',
  'Propositions de structure': 'Forslag til struktur',
  'Un agent ne modifie jamais la structure lui-même : il **propose**. La proposition attend dans la file « Propositions » de la base, où une personne qui peut modifier la structure l’approuve ou la refuse ; sans décision, elle expire au bout de 24 heures. Approuvée, elle est appliquée au nom de la personne qui a créé le jeton — si cette personne a toujours le droit de le faire — et apparaît dans l’historique comme n’importe quelle modification.':
    'En agent endrer aldri strukturen selv: den **foreslår**. Forslaget venter i køen «Forslag» til databasen, der en person som kan endre strukturen, godkjenner eller avviser det; uten en avgjørelse utløper det etter 24 timer. Godkjent blir det utført i navnet til personen som opprettet tokenet – hvis denne personen fortsatt har rett til det – og vises i historikken som enhver annen endring.',
  'Au plus 5 propositions en attente par jeton ; une nouvelle proposition sur le même objet remplace la précédente (`superseded`).':
    'Høyst 5 ventende forslag per token; et nytt forslag om det samme objektet erstatter det forrige (`superseded`).',
  'Pas de suppression, pas de renommage, pas de relation en cascade (`MCP_CASCADE_FORBIDDEN`).':
    'Ingen sletting, ingen omdøping, ingen relasjon i kaskade (`MCP_CASCADE_FORBIDDEN`).',
  'Pour l’apparence : `color` et `icon` dans `propose_create_table` et dans les choix de `propose_add_field`, ou `propose_update_look` pour une table qui existe.':
    'For utseendet: `color` og `icon` i `propose_create_table` og i valgene til `propose_add_field`, eller `propose_update_look` for en tabell som finnes.',
  'Couleurs et pictogrammes': 'Farger og ikoner',
  'Une table et chaque choix d’une liste ont une couleur et un pictogramme, comme dans l’application. `color` est une couleur `#rrggbb` ; `icon` est le nom d’un pictogramme parmi ceux que l’application dessine — le schéma de l’outil les énumère. Une clé omise garde ce qui est en place, `null` l’efface. `describe_base` et `describe_table` rendent l’apparence actuelle.':
    'En tabell og hvert valg i en liste har en farge og et ikon, som i applikasjonen. `color` er en farge `#rrggbb`; `icon` er navnet på et ikon blant dem applikasjonen tegner – verktøyets skjema lister dem opp. En utelatt nøkkel beholder det som er satt, `null` fjerner det. `describe_base` og `describe_table` gir tilbake det nåværende utseendet.',
  'Ce qui n’existe pas': 'Det som ikke finnes',
  'Aucun outil ne supprime plusieurs lignes à la fois, une table ou un champ, n’exécute de SQL ni ne gère les droits ou les jetons. Un agent qui appelle un tel nom — `delete_records`, `run_sql`… — reçoit `MCP_OPERATION_EXCLUDED`, quelle que soit la base visée.':
    'Ingen verktøy sletter flere rader samtidig, en tabell eller et felt, kjører SQL eller håndterer tillatelser eller tokener. En agent som kaller et slikt navn – `delete_records`, `run_sql`… – mottar `MCP_OPERATION_EXCLUDED`, uansett hvilken database det gjelder.',
  Bornes: 'Begrensninger',
  '`limit` : 25 lignes par défaut, 100 au plus.': '`limit`: 25 rader som standard, høyst 100.',
  'Un filtre compte au plus 10 prédicats, combinés par ET ; un tri, au plus 3 champs.':
    'Et filter har høyst 10 predikater, kombinert med OG; en sortering, høyst 3 felt.',
  'Dans une liste, un texte de plus de 500 caractères est tronqué et nommé dans `_truncated_fields` ; `get_record` avec `full_fields` le rend entier.':
    'I en liste blir en tekst på mer enn 500 tegn forkortet og nevnt i `_truncated_fields`; `get_record` med `full_fields` gir den i sin helhet.',
  'Une écriture accepte une `idempotency_key` : la rejouer ne crée pas de doublon.':
    'En skriving godtar en `idempotency_key`: å gjenta den oppretter ikke en duplikat.',
  'Ce que voit un agent': 'Det en agent ser',
  'Un agent ne voit jamais plus que la personne qui a créé son jeton — et souvent moins.':
    'En agent ser aldri mer enn personen som opprettet tokenet dens – og ofte mindre.',
  '**Droits** : ceux du jeton, recoupés à chaque appel avec ceux de son créateur. Si les droits de cette personne baissent, ceux du jeton baissent avec eux ; si son compte est désactivé, le jeton cesse de répondre.':
    '**Tillatelser**: tokenets egne, sammenlignet ved hvert kall med skaperens. Hvis denne personens tillatelser reduseres, reduseres tokenets med dem; hvis kontoen deaktiveres, slutter tokenet å svare.',
  '**Lire, créer, modifier** — et supprimer, une ligne à la fois, seulement avec un jeton créé pour cela. Un jeton en lecture seule refuse toute écriture (`TOKEN_READ_ONLY`).':
    '**Lese, opprette, endre** – og slette, én rad om gangen, bare med et token opprettet for det. Et skrivebeskyttet token avviser all skriving (`TOKEN_READ_ONLY`).',
  '**Cette base** : ouverte aux agents.': '**Denne databasen**: åpen for agenter.',
  '**Cette base** : **fermée aux agents** — aucun outil ne la voit.':
    '**Denne databasen**: **stengt for agenter** – ingen verktøy ser den.',
  '**Colonnes réservées aux humains** : aucune dans ce que vous voyez de cette base.':
    '**Kolonner forbeholdt mennesker**: ingen i det du ser av denne databasen.',
  '**Colonnes réservées aux humains** : {columns}. Pour un agent, elles n’existent pas.':
    '**Kolonner forbeholdt mennesker**: {columns}. For en agent finnes de ikke.',
  '**Des données, pas des consignes** : descriptions et contenus sont rendus comme des données saisies par des utilisateurs, et les outils le disent à l’agent.':
    '**Data, ikke instruksjoner**: beskrivelser og innhold blir gjengitt som data skrevet inn av brukere, og verktøyene sier dette til agenten.',
  '**Journal** : chaque appel est journalisé par la forme de ses paramètres, jamais par leurs valeurs.':
    '**Logg**: hvert kall logges etter formen på parameterne, aldri etter verdiene deres.',
  obligatoire: 'obligatorisk',
  'calculé par l’IA': 'beregnet av KI',
  'lecture seule': 'skrivebeskyttet',
  'HTML riche — **à assainir à l’affichage**': 'Rik HTML – **må renses ved visning**',
  'invisible pour les agents': 'usynlig for agenter',
  'relation → {table}': 'relasjon → {table}',
  'Valeurs : {values}.': 'Verdier: {values}.',
  'cible non visible pour vous : la cellule vaut toujours {cell}':
    'målet er ikke synlig for deg: cellen har alltid verdien {cell}',
  'pointe vers {table} (aucune colonne d’affichage désignée : la cellule montre l’identifiant)':
    'peker mot {table} (ingen visningskolonne er angitt: cellen viser identifikatoren)',
  'pointe vers {table}, affiché par {field}': 'peker mot {table}, vist med {field}',
  'à la suppression : supprimer la ligne cible est refusé tant qu’elle est référencée':
    'ved sletting: å slette målraden avvises så lenge den er referert',
  'à la suppression : supprimer la ligne cible vide cette cellule':
    'ved sletting: å slette målraden tømmer denne cellen',
  'à la suppression : supprimer la ligne cible supprime aussi cette ligne':
    'ved sletting: å slette målraden sletter også denne raden',
  'en écriture, acceptez un `uuid` nu, `null`, ou `{"id": "…"}` ; en lecture, toujours `{"id": …, "display": …}`':
    'ved skriving godtas en ren `uuid`, `null`, eller `{"id": "…"}`; ved lesing, alltid `{"id": …, "display": …}`',
  'Lister les lignes — filtre, tri, pagination par curseur':
    'Liste rader – filter, sortering, markørbasert paginering',
  'Lire une ligne': 'Lese en rad',
  'Supprimer une ligne': 'Slette en rad',
  'Lister les lignes qui pointent vers celle-ci': 'Liste rader som peker mot denne',
  Méthode: 'Metode',
  Chemin: 'Sti',
  lire: 'lese',
  créer: 'opprette',
  modifier: 'endre',
  supprimer: 'slette',
  '**En SQL :** {sql}': '**I SQL:** {sql}',
  'Vous pouvez {verbs}. Les verbes absents de cette liste ne vous sont pas ouverts, et les chemins correspondants ne sont pas décrits.':
    'Du kan {verbs}. Verbene som ikke er med i denne listen, er ikke tilgjengelige for deg, og de tilsvarende stiene er ikke beskrevet.',
  'Points d’accès': 'Endepunkter',
  Colonnes: 'Kolonner',
  Colonne: 'Kolonne',
  Libellé: 'Etikett',
  Type: 'Type',
  Description: 'Beskrivelse',
  'Champs relation': 'Relasjonsfelt',
  'Colonnes système': 'Systemkolonner',
  'Toujours lisibles, jamais inscriptibles. Elles portent la pagination par curseur et la reprise incrémentale, et aucun réglage ne les masque.':
    'Alltid lesbare, aldri skrivbare. De bærer markørbasert paginering og trinnvis gjenopptak, og ingen innstilling skjuler dem.',
  Expansion: 'Utvidelse',
  '{expand} — profondeur 1 sans exception. Les objets liés arrivent dans `included`, indexés par nom de table puis par identifiant, et non imbriqués dans la ligne : 100 lignes pointant 3 cibles transportent 3 objets.':
    '{expand} – dybde 1 uten unntak. De koblede objektene kommer i `included`, indeksert etter tabellnavn og deretter identifikator, og er ikke nestet i raden: 100 rader som peker mot 3 mål, transporterer 3 objekter.',
  'Lignes référençantes': 'Refererende rader',
  '{route} liste les lignes qui pointent vers une ligne donnée. Un bloc dont la table source ne vous est pas visible n’y figure pas du tout — ni bloc, ni compteur, ni mention.':
    '{route} lister radene som peker mot en gitt rad. En blokk der kildetabellen ikke er synlig for deg, vises ikke i det hele tatt – verken blokk, teller eller omtale.',
  'une table que vous ne voyez pas': 'en tabell du ikke ser',
  'Vue d’ensemble': 'Oversikt',
  'Cette base s’appelle {name} — c’est le nom du **schéma PostgreSQL**, et celui que vous écrivez dans vos URL comme dans les appels d’outils. Les tables et les colonnes portent les mêmes noms ici et en SQL : il n’y a pas de table de correspondance à consulter.':
    'Denne databasen heter {name} – det er navnet på **PostgreSQL-skjemaet**, og det du skriver i URL-ene dine så vel som i verktøykallene. Tabellene og kolonnene har de samme navnene her og i SQL: det finnes ingen korrespondansetabell å slå opp i.',
  'Deux accès, les mêmes permissions : l’**API REST** pour vos programmes, le **serveur MCP** pour les agents IA. Chaque page de table dit comment l’atteindre par l’un et par l’autre.':
    'To innganger, de samme tillatelsene: **REST-API-et** for programmene dine, **MCP-serveren** for KI-agentene. Hver tabellside sier hvordan den nås via begge deler.',
  Élément: 'Element',
  Valeur: 'Verdi',
  'Schéma PostgreSQL': 'PostgreSQL-skjema',
  'Préfixe des routes REST': 'Prefiks for REST-rutene',
  'ouverte — voir « Connecter un agent »': 'åpen – se «Koble til en agent»',
  '**fermée aux agents**': '**stengt for agenter**',
  'Tables visibles': 'Synlige tabeller',
  Format: 'Format',
  'JSON, dans une enveloppe {envelope}': 'JSON, i en konvolutt {envelope}',
  '**Cette documentation décrit ce que VOUS pouvez voir.** Deux lecteurs en obtiennent deux versions différentes, et c’est la règle, pas un effet de bord. Ne la publiez pas telle quelle.':
    '**Denne dokumentasjonen beskriver det DU kan se.** To lesere får to forskjellige versjoner av den, og det er regelen, ikke en bivirkning. Ikke publiser den slik den er.',
  Authentification: 'Autentisering',
  'Toutes les routes de données demandent un **jeton**, dans l’en-tête `Authorization`. Le cookie de session n’est jamais accepté ici : un navigateur l’envoie sur chaque requête, y compris celles qu’une page étrangère provoque.':
    'Alle dataruter krever et **token**, i headeren `Authorization`. Øktinformasjonskapselen godtas aldri her: en nettleser sender den med hver forespørsel, inkludert dem en fremmed side utløser.',
  'Jeton d’intégration': 'Integrasjonstoken',
  'Un programme — script, synchronisation, autre application — présente un **jeton d’intégration**, qui commence par `bdb_`. Il ne vaut que pour cette base — tous ses environnements, ou un seul ; il lit, crée et modifie s’il a été créé en écriture, et **ne supprime que s’il a été créé pour cela** ; il n’a jamais plus de droits que la personne qui l’a créé, recoupés à chaque appel. L’administration, la console SQL et l’IA lui restent fermées.':
    'Et program – skript, synkronisering, en annen applikasjon – presenterer et **integrasjonstoken**, som begynner med `bdb_`. Det gjelder bare for denne databasen – alle miljøene dens, eller bare ett; det leser, oppretter og endrer hvis det ble opprettet med skrivetilgang, og **sletter bare hvis det ble opprettet for det**; og det har aldri flere tillatelser enn personen som opprettet det, sammenlignet ved hvert kall. Administrasjon, SQL-konsollen og KI-en forblir stengt for det.',
  'Pour en créer un : menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **API REST** coché. Il n’est affiché qu’une fois.':
    'For å opprette ett: menyen «⋯» til databasen → **API og agenter** → **API- og MCP-tokener…**, med **REST-API**-tilgang avkrysset. Det vises bare én gang.',
  Environnement: 'Miljø',
  'Un jeton créé pour toute la base ouvre tous ses environnements. Le chemin nomme la base — {base} est la production — et l’en-tête {header} choisit l’environnement ; `?environment=` fait de même pour un client qui ne pose pas d’en-tête. Sans l’un ni l’autre, c’est l’environnement que nomme la base.':
    'Et token opprettet for hele databasen åpner alle miljøene dens. Stien navngir databasen – {base} er produksjon – og headeren {header} velger miljøet; `?environment=` gjør det samme for en klient som ikke setter header. Uten noen av delene brukes miljøet som databasenavnet angir.',
  Appel: 'Kall',
  'Une authentification absente répond `401`, jamais `404` : vous devez pouvoir vous reconnecter.':
    'En manglende autentisering svarer `401`, aldri `404`: du må kunne logge inn på nytt.',
  Conventions: 'Konvensjoner',
  Enveloppe: 'Konvolutt',
  'Toutes les réponses ont la même forme : {envelope}. Une erreur remplace `data` par le code, les détails et l’identifiant de requête.':
    'Alle svar har samme form: {envelope}. En feil erstatter `data` med koden, detaljene og forespørselsidentifikatoren.',
  Nombres: 'Tall',
  '**Les nombres sont des chaînes décimales**, sans exception : {example}. Un flottant arrondirait silencieusement un montant.':
    '**Tallene er desimalstrenger**, uten unntak: {example}. Et flyttall ville stille og rolig avrundet et beløp.',
  montant: 'belop',
  'Ressource invisible': 'Usynlig ressurs',
  '**Une ressource invisible et une ressource inexistante répondent la même chose**, octet pour octet. Un `404` ne vous dit jamais si l’objet existe.':
    '**En usynlig ressurs og en ikke-eksisterende ressurs svarer det samme**, byte for byte. En `404` forteller deg aldri om objektet finnes.',
  Pagination: 'Paginering',
  '**Pagination par curseur** : suivez `meta.has_next_page` et passez `after`. Il n’existe aucune route d’export.':
    '**Markørbasert paginering**: følg `meta.has_next_page` og send med `after`. Det finnes ingen eksportrute.',
  'Identifiants seuls': 'Kun identifikatorer',
  'Pour une intégration qui ne veut que des identifiants, `?links=id` supprime la résolution des libellés — et autant d’allers-retours SQL.':
    'For en integrasjon som bare vil ha identifikatorer, fjerner `?links=id` oppløsningen av etikettene – og like mange SQL-turer.',
  Relations: 'Relasjoner',
  'Aucune relation visible dans cette base.': 'Ingen synlig relasjon i denne databasen.',
  'Les relations sont de **vraies clés étrangères PostgreSQL**. Elles sont vérifiées par la base, pas par l’application : un `INSERT` en SQL direct est soumis aux mêmes règles.':
    'Relasjonene er **ekte PostgreSQL-fremmednøkler**. De kontrolleres av databasen, ikke av applikasjonen: en `INSERT` i direkte SQL følger de samme reglene.',
  'Codes de réponse': 'Svarkoder',
  Statut: 'Status',
  Signification: 'Betydning',
  'Succès.': 'Vellykket.',
  'Ligne créée.': 'Rad opprettet.',
  'Suppression réussie, sans contenu.': 'Sletting vellykket, uten innhold.',
  'Authentification absente ou refusée.': 'Manglende eller avvist autentisering.',
  'Ressource inexistante **ou** invisible — les deux réponses sont identiques.':
    'Ressurs som ikke finnes, **eller** er usynlig – de to svarene er identiske.',
  'Suppression refusée : la ligne est encore référencée.':
    'Sletting avvist: raden er fortsatt referert.',
  'Valeur refusée par la validation.': 'Verdi avvist av valideringen.',
  'Une erreur a toujours cette forme, et `request_id` est ce qu’il faut citer au support :':
    'En feil har alltid denne formen, og `request_id` er det som skal oppgis til support:',
  'La liste complète des codes est servie par {route}.':
    'Den fullstendige listen over koder leveres av {route}.',
  'Côté MCP': 'På MCP-siden',
  'Un refus arrive comme un résultat d’outil marqué `isError`, dont le texte est un objet JSON stable : le même `code` que l’API, une phrase fixe, et un `hint` qui dit comment corriger l’appel. `retryable` dit s’il vaut la peine de réessayer tel quel.':
    'Et avslag kommer som et verktøyresultat merket `isError`, der teksten er et stabilt JSON-objekt: samme `code` som API-et, en fast setning, og et `hint` som sier hvordan kallet kan rettes. `retryable` sier om det er verdt å prøve på nytt uendret.',
  'Écrire en SQL direct': 'Skrive i direkte SQL',
  'Ouvrez `psql` : ça marche, c’est le but du produit.':
    'Åpne `psql`: det fungerer, det er selve poenget med produktet.',
  'Ce qui vous attend :': 'Det som venter deg:',
  'Les contraintes s’appliquent — obligatoire, longueur, clé étrangère. Une ligne référencée ne se supprime pas.':
    'Begrensningene gjelder – obligatorisk, lengde, fremmednøkkel. En referert rad kan ikke slettes.',
  'Les colonnes système ne se remplissent pas toutes seules dans un `INSERT` manuel : `_id`, `_created_at` et `_updated_at` ont des valeurs par défaut, `_created_by` et `_updated_by` attendent un identifiant d’utilisateur.':
    'Systemkolonnene fylles ikke ut av seg selv i en manuell `INSERT`: `_id`, `_created_at` og `_updated_at` har standardverdier, `_created_by` og `_updated_by` venter en brukeridentifikator.',
  '**Les permissions de basedb ne s’appliquent pas en SQL direct.** Elles gouvernent les surfaces du produit — API, interface, MCP. Une connexion PostgreSQL voit tout ce que son rôle voit. C’est dit ici parce que promettre le contraire serait pire que de ne rien promettre.':
    '**basedbs tillatelser gjelder ikke i direkte SQL.** De styrer produktets flater – API, grensesnitt, MCP. En PostgreSQL-tilkobling ser alt rollen dens ser. Dette sies her fordi det ville vært verre å love det motsatte enn å ikke love noe.',
  '{base} — documentation API et MCP': '{base} – API- og MCP-dokumentasjon',
}
