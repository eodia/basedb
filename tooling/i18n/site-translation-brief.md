# Traduire les pages du site — consigne commune

(Consigne donnée aux traducteurs de `www/src/i18n/ui/`, une langue chacun. En anglais pour
qu'elle serve à tous.)

You translate the landing pages of the **basedb** website (home, what's new, roadmap,
template gallery) from French into ONE target language. basedb is a self-hosted
collaborative database whose every table is a real PostgreSQL table.

## Input

- `www/src/i18n/README.md` (in French): how the dictionary works — read the « Traduire » and
  « Les liens » sections carefully.
- `www/src/i18n/ui/fr.ts`: the French dictionary, the source (about 8,000 words). Its type is
  `Dict`; your file must satisfy `DeepPartial<Dict>`.
- `tooling/i18n/glossary.json`: the product's terms in your language (`terms[].<code>`) and
  the `register` sentence for your language. Follow both.
- `tooling/i18n/terms/<glossary code>.md` if it exists: the UI labels chosen by the
  translator of the documentation in your language — reuse them.
- `www/src/content/docs/<dir>/…`: the documentation already translated into your language.
  Links to the docs with an anchor (`/fonctionnalites/droits/#vos-paramètres`) must point to
  the slug of the TRANSLATED heading in your version of that page (github-slugger: lowercase,
  spaces → `-`, punctuation removed except `-` and `_`, letters of any alphabet kept). Open
  the target page and check each anchor.

## Output

`www/src/i18n/ui/<dir>.ts` (e.g. `en.ts`, `pt-br.ts`, `zh-cn.ts`), shaped like the README's
example: `import type { DeepPartial, Dict } from './index'` and
`export default { … } satisfies DeepPartial<Dict>`. Translate **everything** — every key of
`fr.ts`, including meta titles and descriptions, aria-labels and alt texts, the mock-up
texts (column headers, statuses…), the FAQ, the bento cards, the what's-new entries and the
roadmap, the gallery labels and every template card. Keep:
- the structure and key names of `fr.ts` (records keyed by name stay keyed by the same
  names; lists are translated whole, same number of items);
- HTML tags (`<strong>`, `<code>`, `<a href="…">`) and site paths exactly as in French (paths
  are French slugs from the root, without `/basedb`: the page localizes them) — only the
  `#anchors` change, to your docs' headings;
- `{placeholders}` exactly; in a title, the part between `{…}` braces is the accent part:
  keep one braced part, placed where it reads naturally; `{{Ville}}`-style tokens stay;
- plural objects with the categories of your language (given in your task);
- product names, code, SQL, formula function names (the formula language is French), the
  PostgreSQL physical names in the mock-ups (`clients`, `montant`…);
- the changelog dates as they are (ISO days — the page formats them).
Make the marketing copy read as if it had been written in your language: natural, concise,
same tone (confident, precise, no hype). Keep the length of titles and card texts close to
the French so the layout holds.

Write the file with the Write tool (not a shell heredoc: heredocs on this machine corrupt
backslashes and `\u` escapes). Then run, from the repository root,
`node tooling/i18n/check-site.mjs <dir>` and fix everything until it prints
`0 missing, 0 errors` (warnings about tags deserve a look). Touch nothing else in the
repository: other people and agents are working in it; no git commands that change
anything; do not build the site. Never name competing products (in particular Airtable or
Metabase).

Reply with one short paragraph: the checker's last line and anything you had to decide.
