# Traduire la documentation du site — consigne commune

(Consigne donnée aux traducteurs de `www/src/content/docs`, une langue chacun. En anglais pour
qu'elle serve à tous.)

You translate the user documentation of **basedb** — a self-hosted collaborative database
whose every table is a real PostgreSQL table — from French into ONE target language.

## Input and output

- Source: the 28 French pages `www/src/content/docs/{guides,fonctionnalites,integrations,hebergement,architecture}/*.md`
  (only those five folders; ignore any other folder — they are other languages).
- Output: the same relative path under `www/src/content/docs/<dir>/` — e.g.
  `www/src/content/docs/de/fonctionnalites/vues.md`. File names and folders stay French
  (they are the URL slugs, shared by every language).
- Glossary: `tooling/i18n/glossary.json`. Use its term for your language every time the
  French text uses a glossary term (UI labels in **bold** above all), and follow the
  `register` sentence for your language (form of address, tone, capitalization).

## What to translate, what to keep

- Translate: the frontmatter `title` and `description` (keep every other frontmatter key
  as is), all prose, headings, table cells, list items, blockquotes, image alt texts, link
  texts, and comments inside code blocks when they are human sentences.
- Keep exactly: code blocks and inline code (SQL, JSON, shell, file names, environment
  variables, physical names like `clients`, `echeance`, API paths, `{{Ville}}` tokens,
  formula function names like `ARRONDI`, `JOURS`, `SI` — they are the product's real
  syntax), URLs outside the site, product names (basedb, PostgreSQL, Docker, Slack, MCP,
  OpenAI, Anthropic, Mistral, Google, Microsoft, Keycloak…), and the Markdown structure
  (same headings, same tables, same order, same images).
- French UI labels quoted in the text (« Texte riche (HTML) », **Paramètres**, **Structure**…):
  use the glossary term; when a label is not in the glossary, translate it the way a UI in
  your language would say it, consistently everywhere.
- Examples of data in French (« Échéance », « Lyon », a client named « Atelier Moreau »): keep
  them unless the sentence is about the label itself being French (the slugification
  example `Échéance` → `echeance` must stay French — it shows how French labels become
  names).
- Typography of your language (quotes, spaces before punctuation, etc.); no French « »
  unless your language uses them.

## Links

- Images use relative paths and exist in every language: add one `../` because your file is
  one folder deeper, and take your folder's picture — `](../../../assets/screens/fr/x.webp)`
  becomes `](../../../../assets/screens/<dir>/x.webp)`.
- Internal links are absolute and start with `/basedb/`: insert your folder —
  `](/basedb/fonctionnalites/vues/)` becomes `](/basedb/<dir>/fonctionnalites/vues/)`, and
  `](/basedb/modeles/)` becomes `](/basedb/<dir>/modeles/)` (the landing pages exist in every
  language too). Do not touch links to other sites.
- Anchors: a link to a heading (`…/droits/#vos-paramètres`, `#formules`) must use the slug of
  the TRANSLATED heading in your version of the target page. The slug is what Starlight
  (github-slugger) makes of the heading text: lowercase, spaces become `-`, punctuation
  removed except `-` and `_`, letters of any alphabet kept (`## Vos paramètres` →
  `vos-paramètres`; a Japanese heading keeps its characters). Translate the target page's
  headings first, then write the anchors from them. An anchor with no matching heading is
  a broken link: check every one before you finish.

## How to work

- One file at a time: read the French page, write the translated page with the Write tool
  (UTF-8), move on. Don't re-read what you wrote unless you need to fix something.
- Write files with the Write tool, not with shell heredocs (they corrupt backslashes and
  unicode escapes on this machine).
- Touch nothing else in the repository: other people and agents are working in it. Don't
  run git commands that change anything, don't build the site.
- Never name the product's competitors (in particular Airtable or Metabase), even when a
  sentence would be clearer with a comparison.

## Before you finish

- 28 files exist under your folder, each with a translated `title` and `description`.
- `grep` your folder for `](/basedb/` links that lack your folder, for `](../../../assets` with
  only three `../`, and for leftover French sentences.
- Every `#anchor` in your files matches a heading of the page it points to.
- Reply with one short paragraph: the number of files, anything you left in French on
  purpose, and any term you had to decide that is not in the glossary.
