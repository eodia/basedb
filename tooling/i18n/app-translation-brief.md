# Traduire l'interface — consigne commune

(Consigne donnée aux traducteurs de `apps/web`, une langue chacun. En anglais pour qu'elle
serve à tous.)

You translate the user interface of **basedb** — a self-hosted collaborative database whose
every table is a real PostgreSQL table (grid, views, forms, automations, dashboards, AI
copilot, REST API, MCP server) — from French into ONE target language.

## How the interface is translated

Every text of the web app is written in French in the code and wrapped: `$t('Enregistrer')`,
`$t('Nouveau champ dans {table}', { table: label })`, `$tp(n, '{count} ligne', '{count} lignes')`.
The French sentence is the key. Your job is the catalog that maps each French sentence to
your language.

## Input

- `tooling/i18n/batches/app-01.json` … `app-12.json`: about 250 sentences each. Each entry is
  keyed by the French sentence and holds either `{ "fr": "…", "where": [...] }` or, for a
  sentence that depends on a number, `{ "one": "…", "other": "…", "where": [...] }` (the
  French singular and plural; the key is the plural). `where` gives the file and line in
  `apps/web/src` (or `packages/…`) where it is used: open it when a short label is ambiguous
  (« Note » can be a star rating; « Recherche » a lookup field; « Carte » a card or a map).
- `tooling/i18n/glossary.json`: the product's terms in your language (`terms[].<code>`) and
  the `register` sentence for your language (form of address, tone, capitalization). Follow
  both everywhere.
- `tooling/i18n/terms/<code>.md` if it exists: the UI labels the translator of the
  documentation chose for your language. Use the same wording for the same labels, so that
  the docs and the app agree.

## Output

For each batch `app-NN.json`, write `app-NN.json` in your work folder (given in your task),
a JSON object with **exactly the same keys** as the batch (copy each key character for
character — some contain non-breaking spaces, typographic apostrophes ’, « », …) and as
value:
- for a sentence: the translation, a string;
- for a sentence with `one`/`other`: an object with exactly the plural categories of your
  language (given in your task), each a full translation — e.g. Polish
  `{ "one": "{count} wiersz", "few": "{count} wiersze", "many": "{count} wierszy", "other": "{count} wiersza" }`;
  Japanese `{ "other": "{count} 行" }`.

Write each part with a small Python script (`json.dump(obj, f, ensure_ascii=False, indent=2)`)
or the Write tool — not with a shell heredoc (heredocs on this machine corrupt backslashes
and `\u` escapes). After each part, run
`node tooling/i18n/batches.mjs merge <code> <work folder>` from the repository root: it
merges every part written so far into `apps/web/src/locales/<code>.json` and prints what is
still missing and any error. Fix every error before moving on. At the end, the command must
print `2960/2960 translated, 0 missing, 0 errors` (the numbers may differ slightly if the
source grew; what matters is 0 missing and 0 errors).

## Rules

- **Placeholders**: keep every `{name}` exactly as written — same names, never translated —;
  you may move them. In plurals, `{count}` is the number. `{{Ville}}`-style double braces are
  basedb variables: keep them as they are.
- **Keep untranslated**: product names (basedb, PostgreSQL, Copilot, MCP, SQL, OpenAPI,
  Slack, Google, OpenAI…), formula function names (SI, ARRONDI, JOURS, AUJOURDHUI, ET, OU…
  — the code shows them in English on any screen that is not French), SQL keywords and operators (`eq`, `contains`,
  `is_null`…), code, identifiers like `_id`, units like `ms`, file extensions, `UUID v7`.
- **Meaning after `||`**: a key such as `Moyenne||hauteur de ligne` is the French word before
  `||`, and its meaning after it (here a medium row height, not an average). Translate the
  word only, in that meaning — the part after `||` never appears in your translation.
- **Fragments**: some keys are pieces of one sentence split around a link, a bold word or a
  value (they often start with ` · `, ` — `, a space, or end with a space). Keep the same
  leading/trailing spaces and punctuation, and translate them so the pieces read naturally
  in order — open `where` to see the sentence they form.
- **Style**: follow the `register`; short labels stay short; buttons as your language's UI
  writes buttons; no French typography (« » and spaces before `:` `;` `?` `!`) unless your
  language uses it; keep `…` for « in progress » and « more options ».
- **Template cards** (`where` in `packages/templates/catalog/…`): translate the name,
  summary, description, category and tags of each official template.
- **Never** name competing products (in particular Airtable or Metabase).
- Touch nothing else in the repository: other people and agents are working in it. No git
  commands that change anything, no builds.

## Report

When done, reply with one short paragraph: the final merge line, and any sentence you were
unsure about (key + your choice).
