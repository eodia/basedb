import type { Catalog } from './catalog.js'

/** The API and MCP documentation in Italian: the French sentence of `documentation.ts` → its translation. */
export const it: Catalog = {
  'Prise en main': 'Primi passi',
  'API REST': 'API REST',
  'Agents (MCP)': 'Agenti (MCP)',
  Tables: 'Tabelle',
  Référence: 'Riferimento',
  texte: 'testo',
  'texte long': 'testo lungo',
  'nombre (chaîne décimale)': 'numero (stringa decimale)',
  booléen: 'booleano',
  'date (`2026-09-18`)': 'data (`2026-09-18`)',
  'date-heure UTC (`2026-09-18T14:03:00.000Z`)': 'data e ora UTC (`2026-09-18T14:03:00.000Z`)',
  'liste de choix': 'selezione singola',
  'choix multiple (liste de valeurs)': 'selezione multipla (elenco di valori)',
  'relation (`_id` de la ligne liée)': 'relazione (`_id` della riga collegata)',
  'relation multiple (liste des `_id` des lignes liées, dans leur ordre)':
    'relazione multipla (elenco degli `_id` delle righe collegate, nel loro ordine)',
  'lien URL (`https://…` ou `mailto:…`)': 'link URL (`https://…` o `mailto:…`)',
  'adresse e-mail': 'indirizzo email',
  'numéro automatique (lecture seule)': 'numero automatico (sola lettura)',
  'personne (`id` d’un membre de l’espace)': 'persona (`id` di un membro dello spazio di lavoro)',
  formule: 'formula',
  'documents (liste de fichiers)': 'documenti (elenco di file)',
  'images (liste de fichiers)': 'immagini (elenco di file)',
  'colonne système': 'colonna di sistema',
  'Un texte plus long.': 'Un testo più lungo.',
  valeur: 'valore',
  Exemple: 'Esempio',
  résultat: 'risultato',
  'photo.jpg': 'foto.jpg',
  'devis.pdf': 'preventivo.pdf',
  Exemples: 'Esempi',
  'Lister les lignes': 'Elencare le righe',
  Réponse: 'Risposta',
  'Créer une ligne': 'Creare una riga',
  'Déposer un fichier': 'Caricare un file',
  'Le corps est le fichier lui-même. La réponse donne un `id`, à écrire ensuite dans {field} : {write}.':
    'Il corpo è il file stesso. La risposta restituisce un `id`, da scrivere poi in {field}: {write}.',
  'L’identité du jeton : qui l’a créé, sa base, ses droits effectifs et ses budgets.':
    'L’identità del token: chi lo ha creato, il suo database, i suoi permessi effettivi e i suoi budget.',
  'Les bases que le jeton peut lire.': 'I database che il token può leggere.',
  'Les tables d’une base et le graphe de leurs relations.':
    'Le tabelle di un database e il grafo delle loro relazioni.',
  'Les champs d’une table : type, obligation, options, relations, et lesquels sont modifiables.':
    'I campi di una tabella: tipo, obbligatorietà, opzioni, relazioni, e quali sono modificabili.',
  'Lire des lignes : filtre, tri, pagination par curseur.':
    'Leggere righe: filtro, ordinamento, paginazione tramite cursore.',
  'Lire une ligne par son `_id`, les textes longs en entier si on le demande.':
    'Leggere una riga tramite il suo `_id`, i testi lunghi per intero se richiesto.',
  'Trouver le `_id` d’une ligne par sa valeur d’affichage, avant d’écrire une relation.':
    'Trovare l’`_id` di una riga tramite il suo valore visualizzato, prima di scrivere una relazione.',
  'Créer une ligne.': 'Creare una riga.',
  'Modifier les champs nommés d’une ligne.': 'Modificare i campi indicati di una riga.',
  'Supprimer une ligne, avec un jeton créé pour supprimer — la réponse la rend.':
    'Eliminare una riga, con un token creato per eliminare — la risposta la restituisce.',
  'Ramener une ligne supprimée, sous son `_id`, depuis l’historique.':
    'Ripristinare una riga eliminata, con il proprio `_id`, dalla cronologia.',
  'Proposer une table et ses premiers champs — une personne décide.':
    'Proporre una tabella e i suoi primi campi — decide una persona.',
  'Proposer un champ, une liste de choix ou une relation — une personne décide.':
    'Proporre un campo, una selezione singola o una relazione — decide una persona.',
  'Proposer la couleur et le pictogramme d’une table et des choix de ses listes — une personne décide.':
    'Proporre il colore e l’icona di una tabella e delle opzioni dei suoi campi di selezione — decide una persona.',
  'Relire une proposition du jeton et savoir ce qu’il en est advenu.':
    'Rileggere una proposta del token e sapere cosa ne è stato.',
  'dépôt basedb': 'repository basedb',
  'Depuis un agent (MCP)': 'Da un agente (MCP)',
  'Cette base n’est pas ouverte aux agents : aucun outil MCP ne voit cette table, quel que soit le jeton.':
    'Questo database non è aperto agli agenti: nessuno strumento MCP vede questa tabella, qualunque sia il token.',
  'Connaître ses champs, et lesquels sont modifiables':
    'Conoscere i suoi campi, e quali sono modificabili',
  'Lire ses lignes — filtre, tri, pagination':
    'Leggere le sue righe — filtro, ordinamento, paginazione',
  'Lire une ligne par son `_id`': 'Leggere una riga tramite il suo `_id`',
  'Trouver une ligne par sa valeur d’affichage, {field}':
    'Trovare una riga tramite il suo valore visualizzato, {field}',
  'Modifier une ligne': 'Modificare una riga',
  'Supprimer une ligne — avec un jeton créé pour supprimer':
    'Eliminare una riga — con un token creato per eliminare',
  'Ramener une ligne supprimée': 'Ripristinare una riga eliminata',
  'Aucun outil ne vous est ouvert sur cette table.':
    'Nessuno strumento è aperto per te su questa tabella.',
  'Un jeton que vous créez n’a jamais plus de droits que vous : ces outils sont un maximum.':
    'Un token che crei non ha mai più permessi di te: questi strumenti sono un massimo.',
  Outil: 'Strumento',
  Pour: 'Per',
  'Un agent ne supprime qu’avec un jeton créé « Lecture, écriture et suppression », une ligne à la fois ; la ligne supprimée revient par `restore_record` ou depuis l’historique.':
    'Un agente elimina solo con un token creato con «Lettura, scrittura ed eliminazione», una riga alla volta; la riga eliminata ritorna con `restore_record` o dalla cronologia.',
  '**Invisibles pour un agent :** {fields}. Pour lui, ces colonnes n’existent pas : il ne peut ni les lire, ni les filtrer, ni les écrire.':
    '**Invisibili per un agente:** {fields}. Per lui, queste colonne non esistono: non può né leggerle, né filtrarle, né scriverle.',
  'Arguments d’un appel': 'Argomenti di una chiamata',
  'Créer un jeton pour cette base demande le niveau **Gestion**, que vous n’avez pas. Demandez-en un à la personne qui la gère.':
    'Creare un token per questo database richiede il livello **Gestione**, che non hai. Chiedine uno alla persona che lo gestisce.',
  '<jeton>': '<token>',
  'Connecter un agent': 'Collegare un agente',
  'Le **serveur MCP** de basedb ouvre cette base à un agent IA — Claude ou tout client MCP : il la découvre, la lit et, si vous le décidez, y crée, modifie et supprime des lignes. Il passe par les mêmes permissions que l’API REST.':
    'Il **server MCP** di basedb apre questo database a un agente IA — Claude o qualsiasi client MCP: lo scopre, lo legge e, se lo decidi, vi crea, modifica ed elimina righe. Passa dagli stessi permessi dell’API REST.',
  '**Cette base n’est pas ouverte aux agents.** Tant qu’elle ne l’est pas, aucun outil ne la voit, quel que soit le jeton présenté.':
    '**Questo database non è aperto agli agenti.** Finché non lo è, nessuno strumento lo vede, qualunque sia il token presentato.',
  'Créer un jeton': 'Creare un token',
  'Dans l’interface, menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **MCP** coché. Le jeton ouvre **toute la base, tous ses environnements** — production, recette… — ou un seul, si vous le limitez. Il est en **lecture seule** par défaut : l’écriture, et la suppression, se choisissent explicitement. Il n’est affiché qu’une fois, et se révoque depuis le même écran. Coché aussi pour l’**API REST**, le même jeton sert à un programme (voir « Authentification »).':
    'Nell’interfaccia, menu «⋯» del database → **API e agenti** → **Token API e MCP…**, con l’accesso **MCP** spuntato. Il token apre **tutto il database, tutti i suoi ambienti** — produzione, collaudo… — oppure uno solo, se lo limiti. È in **sola lettura** per impostazione predefinita: la scrittura, e l’eliminazione, si scelgono esplicitamente. Viene mostrato una sola volta, e si revoca dalla stessa schermata. Spuntato anche per l’**API REST**, lo stesso token serve per un programma (vedi «Autenticazione»).',
  'Garder le jeton hors de la configuration': 'Tenere il token fuori dalla configurazione',
  'Le jeton se place dans la variable d’environnement `BASEDB_TOKEN`, jamais dans le fichier de configuration du client : celui-ci est versionné, synchronisé, et lisible par tous les programmes de la session.':
    'Il token va inserito nella variabile d’ambiente `BASEDB_TOKEN`, mai nel file di configurazione del client: quest’ultimo è versionato, sincronizzato, e leggibile da tutti i programmi della sessione.',
  'Déclarer le serveur dans le client': 'Dichiarare il server nel client',
  'Un client qui parle MCP en HTTP — Claude Code, entre autres — vise directement l’adresse du serveur, `…/mcp`, avec l’en-tête {header}. Dans le fichier `.mcp.json` d’un projet, `${BASEDB_TOKEN}` est lu dans l’environnement : le jeton ne s’écrit pas dans le fichier. Le même jeton peut déclarer un serveur par environnement.':
    'Un client che parla MCP in HTTP — Claude Code, tra gli altri — punta direttamente all’indirizzo del server, `…/mcp`, con l’intestazione {header}. Nel file `.mcp.json` di un progetto, `${BASEDB_TOKEN}` viene letto dall’ambiente: il token non si scrive nel file. Con lo stesso token si può dichiarare un server per ogni ambiente.',
  'Autre client MCP': 'Altro client MCP',
  'votre-instance': 'tua-istanza',
  recette: 'collaudo',
  'Client sans HTTP : le relais': 'Client senza HTTP: il relay',
  'Un client qui ne lance que des programmes locaux (stdio) passe par le **relais** `relay.js`, qui transporte ses messages jusqu’au serveur. Il lit le jeton dans la variable que nomme `--token-env` — `BASEDB_MCP_TOKEN` si rien n’est dit —, l’adresse du serveur dans `--url` (ou `BASEDB_MCP_URL`), et l’environnement dans `--environment` (ou `BASEDB_MCP_ENVIRONMENT`).':
    'Un client che avvia solo programmi locali (stdio) passa dal **relay** `relay.js`, che trasporta i suoi messaggi fino al server. Legge il token dalla variabile indicata da `--token-env` — `BASEDB_MCP_TOKEN` se non è specificato nulla —, l’indirizzo del server da `--url` (o `BASEDB_MCP_URL`), e l’ambiente da `--environment` (o `BASEDB_MCP_ENVIRONMENT`).',
  'Un jeton n’est accepté que sur les accès cochés à sa création : un jeton « MCP » seul est refusé par l’API REST, et inversement.':
    'Un token è accettato solo sugli accessi spuntati alla sua creazione: un token «MCP» da solo viene rifiutato dall’API REST, e viceversa.',
  'Choisir l’environnement': 'Scegliere l’ambiente',
  'Une base peut avoir plusieurs environnements — production, recette, développement —, chacun avec ses tables et ses lignes. Un jeton de toute la base les ouvre tous ; l’environnement se choisit à l’appel, du plus large au plus précis :':
    'Un database può avere più ambienti — produzione, collaudo, sviluppo —, ciascuno con le proprie tabelle e le proprie righe. Un token di tutto il database li apre tutti; l’ambiente si sceglie alla chiamata, dal più ampio al più preciso:',
  '**Le nom de la base**, sans rien d’autre : {base} est la production, et chaque environnement garde aussi son propre nom.':
    '**Il nome del database**, senza altro: {base} è la produzione, e ogni ambiente conserva anche il proprio nome.',
  '**L’adresse du serveur** : {address} — un serveur déclaré par environnement.':
    '**L’indirizzo del server**: {address} — un server dichiarato per ambiente.',
  '**L’argument `environment`** de chaque outil qui nomme une base, pour un seul appel : {example}.':
    '**L’argomento `environment`** di ogni strumento che nomina un database, per una sola chiamata: {example}.',
  'Un environnement se nomme par son badge, sans tenir compte des majuscules ni des accents, ou `production`. Un environnement que la base n’a pas répond `RESOURCE_NOT_FOUND`.':
    'Un ambiente si indica con il suo badge, senza tenere conto di maiuscole e accenti, oppure con `production`. Un ambiente che il database non ha risponde `RESOURCE_NOT_FOUND`.',
  Vérifier: 'Verificare',
  'Demandez à l’agent d’appeler `whoami` : il rend la personne qui a créé le jeton, la base de sa portée, les environnements qu’il ouvre (`scope.available`) et ses droits effectifs.':
    'Chiedi all’agente di chiamare `whoami`: restituisce la persona che ha creato il token, il database del suo ambito, gli ambienti che apre (`scope.available`) e i suoi permessi effettivi.',
  Outils: 'Strumenti',
  '{count} outils, toujours les mêmes : leur nom et leur description ne dépendent jamais de vos données. Le schéma se découvre en les appelant.':
    '{count} strumenti, sempre gli stessi: il loro nome e la loro descrizione non dipendono mai dai tuoi dati. Lo schema si scopre chiamandoli.',
  Rôle: 'Ruolo',
  Écrit: 'Scrive?',
  oui: 'sì',
  propose: 'propone',
  non: 'no',
  'Enchaînement type': 'Sequenza tipica',
  '`list_bases`, puis `describe_base` : ce qui existe.':
    '`list_bases`, poi `describe_base`: cosa esiste.',
  '`describe_table` avant toute lecture ou écriture : les champs, leurs types, et ceux que le jeton peut écrire (`access: "write"`).':
    '`describe_table` prima di ogni lettura o scrittura: i campi, i loro tipi, e quelli che il token può scrivere (`access: "write"`).',
  '`list_records` avec `filter`, `sort` et `limit` ; poursuivre avec `cursor` tant que `has_more` vaut `true`.':
    '`list_records` con `filter`, `sort` e `limit`; continuare con `cursor` finché `has_more` vale `true`.',
  'Pour écrire une relation : `lookup_records` sur la table cible, puis `create_record` ou `update_record` avec le `_id` trouvé.':
    'Per scrivere una relazione: `lookup_records` sulla tabella di destinazione, poi `create_record` o `update_record` con l’`_id` trovato.',
  'Pour faire évoluer la structure : `propose_create_table` ou `propose_add_field`, puis `get_proposal` pour suivre la décision.':
    'Per far evolvere la struttura: `propose_create_table` o `propose_add_field`, poi `get_proposal` per seguire la decisione.',
  'Pour l’apparence : `color` et `icon` dans `propose_create_table` et dans les choix de `propose_add_field`, ou `propose_update_look` pour une table qui existe.':
    'Per l’aspetto: `color` e `icon` in `propose_create_table` e nelle opzioni di `propose_add_field`, oppure `propose_update_look` per una tabella che esiste già.',
  'Pour supprimer : `get_record` d’abord, pour être sûr de la ligne, puis `delete_record` — qui la rend dans sa réponse ; `restore_record` la ramène.':
    'Per eliminare: prima `get_record`, per essere sicuri della riga, poi `delete_record` — che la restituisce nella sua risposta; `restore_record` la ripristina.',
  'Propositions de structure': 'Proposte di struttura',
  'Un agent ne modifie jamais la structure lui-même : il **propose**. La proposition attend dans la file « Propositions » de la base, où une personne qui peut modifier la structure l’approuve ou la refuse ; sans décision, elle expire au bout de 24 heures. Approuvée, elle est appliquée au nom de la personne qui a créé le jeton — si cette personne a toujours le droit de le faire — et apparaît dans l’historique comme n’importe quelle modification.':
    'Un agente non modifica mai la struttura da solo: **propone**. La proposta attende nella coda «Proposte» del database, dove una persona che può modificare la struttura la approva o la rifiuta; senza decisione, scade dopo 24 ore. Approvata, viene applicata a nome della persona che ha creato il token — se questa persona ha ancora il diritto di farlo — e appare nella cronologia come qualsiasi altra modifica.',
  'Au plus 5 propositions en attente par jeton ; une nouvelle proposition sur le même objet remplace la précédente (`superseded`).':
    'Al massimo 5 proposte in attesa per token; una nuova proposta sullo stesso oggetto sostituisce la precedente (`superseded`).',
  'Pas de suppression, pas de renommage, pas de relation en cascade (`MCP_CASCADE_FORBIDDEN`).':
    'Nessuna eliminazione, nessuna rinomina, nessuna relazione a cascata (`MCP_CASCADE_FORBIDDEN`).',
  'Couleurs et pictogrammes': 'Colori e icone',
  'Une table et chaque choix d’une liste ont une couleur et un pictogramme, comme dans l’application. `color` est une couleur `#rrggbb` ; `icon` est le nom d’un pictogramme parmi ceux que l’application dessine — le schéma de l’outil les énumère. Une clé omise garde ce qui est en place, `null` l’efface. `describe_base` et `describe_table` rendent l’apparence actuelle.':
    'Una tabella e ogni opzione di un campo di selezione hanno un colore e un’icona, come nell’applicazione. `color` è un colore `#rrggbb`; `icon` è il nome di un’icona tra quelle che l’applicazione disegna — lo schema dello strumento le elenca. Una chiave omessa mantiene ciò che c’è, `null` lo cancella. `describe_base` e `describe_table` restituiscono l’aspetto attuale.',
  'Ce qui n’existe pas': 'Ciò che non esiste',
  'Aucun outil ne supprime plusieurs lignes à la fois, une table ou un champ, n’exécute de SQL ni ne gère les droits ou les jetons. Un agent qui appelle un tel nom — `delete_records`, `run_sql`… — reçoit `MCP_OPERATION_EXCLUDED`, quelle que soit la base visée.':
    'Nessuno strumento elimina più righe alla volta, una tabella o un campo, esegue SQL o gestisce i permessi o i token. Un agente che chiama un nome simile — `delete_records`, `run_sql`… — riceve `MCP_OPERATION_EXCLUDED`, qualunque sia il database interessato.',
  Bornes: 'Limiti',
  '`limit` : 25 lignes par défaut, 100 au plus.':
    '`limit`: 25 righe per impostazione predefinita, 100 al massimo.',
  'Un filtre compte au plus 10 prédicats, combinés par ET ; un tri, au plus 3 champs.':
    'Un filtro conta al massimo 10 predicati, combinati con AND; un ordinamento, al massimo 3 campi.',
  'Dans une liste, un texte de plus de 500 caractères est tronqué et nommé dans `_truncated_fields` ; `get_record` avec `full_fields` le rend entier.':
    'In un elenco, un testo di più di 500 caratteri viene troncato e indicato in `_truncated_fields`; `get_record` con `full_fields` lo restituisce per intero.',
  'Une écriture accepte une `idempotency_key` : la rejouer ne crée pas de doublon.':
    'Una scrittura accetta una `idempotency_key`: ripeterla non crea un duplicato.',
  'Ce que voit un agent': 'Cosa vede un agente',
  'Un agent ne voit jamais plus que la personne qui a créé son jeton — et souvent moins.':
    'Un agente non vede mai più di quanto veda la persona che ha creato il suo token — e spesso meno.',
  '**Droits** : ceux du jeton, recoupés à chaque appel avec ceux de son créateur. Si les droits de cette personne baissent, ceux du jeton baissent avec eux ; si son compte est désactivé, le jeton cesse de répondre.':
    '**Permessi**: quelli del token, incrociati a ogni chiamata con quelli di chi lo ha creato. Se i permessi di questa persona diminuiscono, quelli del token diminuiscono con loro; se il suo account viene disattivato, il token smette di rispondere.',
  '**Lire, créer, modifier** — et supprimer, une ligne à la fois, seulement avec un jeton créé pour cela. Un jeton en lecture seule refuse toute écriture (`TOKEN_READ_ONLY`).':
    '**Leggere, creare, modificare** — ed eliminare, una riga alla volta, solo con un token creato per questo. Un token in sola lettura rifiuta ogni scrittura (`TOKEN_READ_ONLY`).',
  '**Cette base** : ouverte aux agents.': '**Questo database**: aperto agli agenti.',
  '**Cette base** : **fermée aux agents** — aucun outil ne la voit.':
    '**Questo database**: **chiuso agli agenti** — nessuno strumento lo vede.',
  '**Colonnes réservées aux humains** : aucune dans ce que vous voyez de cette base.':
    '**Colonne riservate agli esseri umani**: nessuna in ciò che vedi di questo database.',
  '**Colonnes réservées aux humains** : {columns}. Pour un agent, elles n’existent pas.':
    '**Colonne riservate agli esseri umani**: {columns}. Per un agente, non esistono.',
  '**Des données, pas des consignes** : descriptions et contenus sont rendus comme des données saisies par des utilisateurs, et les outils le disent à l’agent.':
    '**Dati, non istruzioni**: descrizioni e contenuti sono restituiti come dati inseriti dagli utenti, e gli strumenti lo dicono all’agente.',
  '**Journal** : chaque appel est journalisé par la forme de ses paramètres, jamais par leurs valeurs.':
    '**Registro**: ogni chiamata viene registrata in base alla forma dei suoi parametri, mai ai loro valori.',
  obligatoire: 'obbligatorio',
  'calculé par l’IA': 'calcolato dall’IA',
  'lecture seule': 'sola lettura',
  'HTML riche — **à assainir à l’affichage**':
    'HTML formattato — **da sanificare in visualizzazione**',
  'invisible pour les agents': 'invisibile per gli agenti',
  'relation → {table}': 'relazione → {table}',
  'Valeurs : {values}.': 'Valori: {values}.',
  'cible non visible pour vous : la cellule vaut toujours {cell}':
    'destinazione non visibile per te: la cella vale sempre {cell}',
  'pointe vers {table} (aucune colonne d’affichage désignée : la cellule montre l’identifiant)':
    'punta a {table} (nessuna colonna di visualizzazione designata: la cella mostra l’identificativo)',
  'pointe vers {table}, affiché par {field}': 'punta a {table}, visualizzato tramite {field}',
  'à la suppression : supprimer la ligne cible est refusé tant qu’elle est référencée':
    'all’eliminazione: eliminare la riga di destinazione è rifiutato finché è referenziata',
  'à la suppression : supprimer la ligne cible vide cette cellule':
    'all’eliminazione: eliminare la riga di destinazione svuota questa cella',
  'à la suppression : supprimer la ligne cible supprime aussi cette ligne':
    'all’eliminazione: eliminare la riga di destinazione elimina anche questa riga',
  'en écriture, acceptez un `uuid` nu, `null`, ou `{"id": "…"}` ; en lecture, toujours `{"id": …, "display": …}`':
    'in scrittura, accetta un `uuid` nudo, `null`, oppure `{"id": "…"}`; in lettura, sempre `{"id": …, "display": …}`',
  'Lister les lignes — filtre, tri, pagination par curseur':
    'Elencare le righe — filtro, ordinamento, paginazione tramite cursore',
  'Lire une ligne': 'Leggere una riga',
  'Supprimer une ligne': 'Eliminare una riga',
  'Lister les lignes qui pointent vers celle-ci': 'Elencare le righe che puntano a questa',
  Méthode: 'Metodo',
  Chemin: 'Percorso',
  lire: 'leggere',
  créer: 'creare',
  modifier: 'modificare',
  supprimer: 'eliminare',
  '**En SQL :** {sql}': '**In SQL:** {sql}',
  'Vous pouvez {verbs}. Les verbes absents de cette liste ne vous sont pas ouverts, et les chemins correspondants ne sont pas décrits.':
    'Puoi {verbs}. I verbi assenti da questo elenco non ti sono aperti, e i percorsi corrispondenti non sono descritti.',
  'Points d’accès': 'Punti di accesso',
  Colonnes: 'Colonne',
  Colonne: 'Colonna',
  Libellé: 'Etichetta',
  Type: 'Tipo',
  Description: 'Descrizione',
  'Champs relation': 'Campi relazione',
  'Colonnes système': 'Colonne di sistema',
  'Toujours lisibles, jamais inscriptibles. Elles portent la pagination par curseur et la reprise incrémentale, et aucun réglage ne les masque.':
    'Sempre leggibili, mai scrivibili. Portano la paginazione tramite cursore e la ripresa incrementale, e nessuna impostazione le nasconde.',
  Expansion: 'Espansione',
  '{expand} — profondeur 1 sans exception. Les objets liés arrivent dans `included`, indexés par nom de table puis par identifiant, et non imbriqués dans la ligne : 100 lignes pointant 3 cibles transportent 3 objets.':
    '{expand} — profondità 1 senza eccezioni. Gli oggetti collegati arrivano in `included`, indicizzati per nome di tabella e poi per identificativo, e non annidati nella riga: 100 righe che puntano a 3 destinazioni trasportano 3 oggetti.',
  'Lignes référençantes': 'Righe referenzianti',
  '{route} liste les lignes qui pointent vers une ligne donnée. Un bloc dont la table source ne vous est pas visible n’y figure pas du tout — ni bloc, ni compteur, ni mention.':
    '{route} elenca le righe che puntano a una riga data. Un blocco la cui tabella di origine non ti è visibile non vi figura affatto — né blocco, né contatore, né menzione.',
  'une table que vous ne voyez pas': 'una tabella che non vedi',
  'Vue d’ensemble': 'Panoramica',
  'Cette base s’appelle {name} — c’est le nom du **schéma PostgreSQL**, et celui que vous écrivez dans vos URL comme dans les appels d’outils. Les tables et les colonnes portent les mêmes noms ici et en SQL : il n’y a pas de table de correspondance à consulter.':
    'Questo database si chiama {name} — è il nome dello **schema PostgreSQL**, ed è quello che scrivi nei tuoi URL come nelle chiamate degli strumenti. Le tabelle e le colonne portano gli stessi nomi qui e in SQL: non c’è nessuna tabella di corrispondenza da consultare.',
  'Deux accès, les mêmes permissions : l’**API REST** pour vos programmes, le **serveur MCP** pour les agents IA. Chaque page de table dit comment l’atteindre par l’un et par l’autre.':
    'Due accessi, gli stessi permessi: l’**API REST** per i tuoi programmi, il **server MCP** per gli agenti IA. Ogni pagina di tabella dice come raggiungerla con l’uno e con l’altro.',
  Élément: 'Elemento',
  Valeur: 'Valore',
  'Schéma PostgreSQL': 'Schema PostgreSQL',
  'Préfixe des routes REST': 'Prefisso delle route REST',
  'ouverte — voir « Connecter un agent »': 'aperto — vedi «Collegare un agente»',
  '**fermée aux agents**': '**chiuso agli agenti**',
  'Tables visibles': 'Tabelle visibili',
  Format: 'Formato',
  'JSON, dans une enveloppe {envelope}': 'JSON, in una busta {envelope}',
  '**Cette documentation décrit ce que VOUS pouvez voir.** Deux lecteurs en obtiennent deux versions différentes, et c’est la règle, pas un effet de bord. Ne la publiez pas telle quelle.':
    '**Questa documentazione descrive ciò che TU puoi vedere.** Due lettori ne ottengono due versioni diverse, ed è la regola, non un effetto collaterale. Non pubblicarla così com’è.',
  Authentification: 'Autenticazione',
  'Toutes les routes de données demandent un **jeton**, dans l’en-tête `Authorization`. Le cookie de session n’est jamais accepté ici : un navigateur l’envoie sur chaque requête, y compris celles qu’une page étrangère provoque.':
    'Tutte le route sui dati richiedono un **token**, nell’intestazione `Authorization`. Il cookie di sessione non è mai accettato qui: un browser lo invia a ogni richiesta, comprese quelle provocate da una pagina esterna.',
  'Jeton d’intégration': 'Token di integrazione',
  'Un programme — script, synchronisation, autre application — présente un **jeton d’intégration**, qui commence par `bdb_`. Il ne vaut que pour cette base — tous ses environnements, ou un seul ; il lit, crée et modifie s’il a été créé en écriture, et **ne supprime que s’il a été créé pour cela** ; il n’a jamais plus de droits que la personne qui l’a créé, recoupés à chaque appel. L’administration, la console SQL et l’IA lui restent fermées.':
    'Un programma — script, sincronizzazione, altra applicazione — presenta un **token di integrazione**, che inizia con `bdb_`. Vale solo per questo database — tutti i suoi ambienti, oppure uno solo; legge, crea e modifica se è stato creato in scrittura, ed **elimina solo se è stato creato per questo**; non ha mai più permessi della persona che lo ha creato, incrociati a ogni chiamata. L’amministrazione, la console SQL e l’IA gli restano chiuse.',
  Environnement: 'Ambiente',
  'Un jeton créé pour toute la base ouvre tous ses environnements. Le chemin nomme la base — {base} est la production — et l’en-tête {header} choisit l’environnement ; `?environment=` fait de même pour un client qui ne pose pas d’en-tête. Sans l’un ni l’autre, c’est l’environnement que nomme la base.':
    'Un token creato per tutto il database apre tutti i suoi ambienti. Il percorso nomina il database — {base} è la produzione — e l’intestazione {header} sceglie l’ambiente; `?environment=` fa lo stesso per un client che non imposta intestazioni. Senza nessuno dei due, vale l’ambiente indicato dal nome del database.',
  'Pour en créer un : menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **API REST** coché. Il n’est affiché qu’une fois.':
    'Per crearne uno: menu «⋯» del database → **API e agenti** → **Token API e MCP…**, con l’accesso **API REST** spuntato. Viene mostrato una sola volta.',
  Appel: 'Chiamata',
  'Une authentification absente répond `401`, jamais `404` : vous devez pouvoir vous reconnecter.':
    'Un’autenticazione assente risponde `401`, mai `404`: devi poter riconnetterti.',
  Conventions: 'Convenzioni',
  Enveloppe: 'Busta',
  'Toutes les réponses ont la même forme : {envelope}. Une erreur remplace `data` par le code, les détails et l’identifiant de requête.':
    'Tutte le risposte hanno la stessa forma: {envelope}. Un errore sostituisce `data` con il codice, i dettagli e l’identificativo della richiesta.',
  Nombres: 'Numeri',
  '**Les nombres sont des chaînes décimales**, sans exception : {example}. Un flottant arrondirait silencieusement un montant.':
    '**I numeri sono stringhe decimali**, senza eccezioni: {example}. Un numero in virgola mobile arrotonderebbe silenziosamente un importo.',
  montant: 'importo',
  'Ressource invisible': 'Risorsa invisibile',
  '**Une ressource invisible et une ressource inexistante répondent la même chose**, octet pour octet. Un `404` ne vous dit jamais si l’objet existe.':
    '**Una risorsa invisibile e una risorsa inesistente rispondono la stessa cosa**, byte per byte. Un `404` non ti dice mai se l’oggetto esiste.',
  Pagination: 'Paginazione',
  '**Pagination par curseur** : suivez `meta.has_next_page` et passez `after`. Il n’existe aucune route d’export.':
    '**Paginazione tramite cursore**: segui `meta.has_next_page` e passa `after`. Non esiste alcuna route di esportazione.',
  'Identifiants seuls': 'Solo identificativi',
  'Pour une intégration qui ne veut que des identifiants, `?links=id` supprime la résolution des libellés — et autant d’allers-retours SQL.':
    'Per un’integrazione che vuole solo identificativi, `?links=id` elimina la risoluzione delle etichette — e altrettanti andirivieni SQL.',
  Relations: 'Relazioni',
  'Aucune relation visible dans cette base.': 'Nessuna relazione visibile in questo database.',
  'Les relations sont de **vraies clés étrangères PostgreSQL**. Elles sont vérifiées par la base, pas par l’application : un `INSERT` en SQL direct est soumis aux mêmes règles.':
    'Le relazioni sono **vere chiavi esterne PostgreSQL**. Sono verificate dal database, non dall’applicazione: un `INSERT` in SQL diretto è soggetto alle stesse regole.',
  'Codes de réponse': 'Codici di risposta',
  Statut: 'Stato',
  Signification: 'Significato',
  'Succès.': 'Successo.',
  'Ligne créée.': 'Riga creata.',
  'Suppression réussie, sans contenu.': 'Eliminazione riuscita, senza contenuto.',
  'Authentification absente ou refusée.': 'Autenticazione assente o rifiutata.',
  'Ressource inexistante **ou** invisible — les deux réponses sont identiques.':
    'Risorsa inesistente **o** invisibile — le due risposte sono identiche.',
  'Suppression refusée : la ligne est encore référencée.':
    'Eliminazione rifiutata: la riga è ancora referenziata.',
  'Valeur refusée par la validation.': 'Valore rifiutato dalla validazione.',
  'Une erreur a toujours cette forme, et `request_id` est ce qu’il faut citer au support :':
    'Un errore ha sempre questa forma, e `request_id` è ciò che occorre citare al supporto:',
  'La liste complète des codes est servie par {route}.':
    'L’elenco completo dei codici è fornito da {route}.',
  'Côté MCP': 'Lato MCP',
  'Un refus arrive comme un résultat d’outil marqué `isError`, dont le texte est un objet JSON stable : le même `code` que l’API, une phrase fixe, et un `hint` qui dit comment corriger l’appel. `retryable` dit s’il vaut la peine de réessayer tel quel.':
    'Un rifiuto arriva come un risultato di strumento contrassegnato `isError`, il cui testo è un oggetto JSON stabile: lo stesso `code` dell’API, una frase fissa, e un `hint` che dice come correggere la chiamata. `retryable` dice se vale la pena riprovare così com’è.',
  'Écrire en SQL direct': 'Scrivere in SQL diretto',
  'Ouvrez `psql` : ça marche, c’est le but du produit.':
    'Apri `psql`: funziona, è lo scopo del prodotto.',
  'Ce qui vous attend :': 'Cosa ti aspetta:',
  'Les contraintes s’appliquent — obligatoire, longueur, clé étrangère. Une ligne référencée ne se supprime pas.':
    'I vincoli si applicano — obbligatorietà, lunghezza, chiave esterna. Una riga referenziata non si elimina.',
  'Les colonnes système ne se remplissent pas toutes seules dans un `INSERT` manuel : `_id`, `_created_at` et `_updated_at` ont des valeurs par défaut, `_created_by` et `_updated_by` attendent un identifiant d’utilisateur.':
    'Le colonne di sistema non si riempiono da sole in un `INSERT` manuale: `_id`, `_created_at` e `_updated_at` hanno valori predefiniti, `_created_by` e `_updated_by` attendono un identificativo utente.',
  '**Les permissions de basedb ne s’appliquent pas en SQL direct.** Elles gouvernent les surfaces du produit — API, interface, MCP. Une connexion PostgreSQL voit tout ce que son rôle voit. C’est dit ici parce que promettre le contraire serait pire que de ne rien promettre.':
    '**I permessi di basedb non si applicano in SQL diretto.** Governano le superfici del prodotto — API, interfaccia, MCP. Una connessione PostgreSQL vede tutto ciò che il suo ruolo vede. Lo diciamo qui perché promettere il contrario sarebbe peggio che non promettere nulla.',
  '{base} — documentation API et MCP': '{base} — documentazione API e MCP',
}
