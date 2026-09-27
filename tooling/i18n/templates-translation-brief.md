# Traduire les modèles de base — consigne commune

(Consigne donnée aux traducteurs des modèles officiels, une langue chacun. En anglais pour
qu'elle serve à tous.)

You translate the **official base templates** of **basedb** — a collaborative database whose
every table is a real PostgreSQL table — from French into ONE target language. A template is
a whole ready-made base: its tables and fields, choices, sample rows, views, dashboards,
automations and AI prompts. A person who applies it in your language must get a base that
reads as if it had been written in your language, for your country.

## How it works

A template is written once, in French (`packages/templates/catalog/<key>.json`). Its texts in
your language are a dictionary, `packages/templates/i18n/<code>/<key>.json`: a JSON object
whose keys are the French texts, character for character, and whose values are your
translations. A label is translated once and the code follows it everywhere it is cited
(formulas, filters, views, dashboards, automations): you never see those, you only write the
texts.

## Input

- `tooling/i18n/templates-source.json`: for each template key, every text to translate, in
  reading order, with its `kind` and `where` (the place it first appears). Kinds:
  - `label` — name of a table, a field, a relation, a view, a dashboard, an automation, the
    template or its base (80 characters at most). Short, like a column header.
  - `option` — a choice of a list (80 at most).
  - `tag` — a gallery tag (30 at most).
  - `text` — a description, a summary, a form's title or wording, a dashboard block's text.
  - `value` — a sample value of a short text: often the NAME of a fictitious company, person,
    product, event. `long` — a sample value of a long text. `rich` — the same in HTML.
  - `email`, `url` — sample addresses.
  - `prompt` — what the AI is asked to compute a field. `message` — a notification an
    automation sends, or a value it writes.
  - `button` — a button's label (40 at most).
- `packages/templates/catalog/<key>.json`: the template itself — read it first, whole, to
  understand what each table and row is.
- `packages/templates/i18n/<code>/<key>.json` may already hold some entries: the template's
  gallery card and common words, taken from the app's own translations. They are
  suggestions: keep them when they fit their place in the template, correct them otherwise.
- `tooling/i18n/glossary.json`: the product's terms in your language (`terms[].<code>`) and
  the `register` for your language (form of address, tone, capitalization). Follow both.

## Rules

- **Every text**, every template: the dictionary must end with all the keys of
  `templates-source.json` for that template, and no other.
- **Citations `{{…}}` stay exactly as in French**, with the French label inside:
  `Résume {{Avis}} en une phrase.` → `Summarize {{Avis}} in one sentence.` The code replaces
  `{{Avis}}` with your translation of the label « Avis ». You may move a citation, never
  change, translate or drop it. `{{_maintenant}}` and other `{{_…}}` stay too.
- **Adapt the fictitious world to your language and country** — the user asked for it:
  company names, people's first and last names, cities, streets, school or clinic names,
  becomes what a native would find natural (« Boulangerie Martin, Lyon » → « Martin's Bakery,
  Manchester » in English, « Bäckerei Keller, Leipzig » in German…). Before you write, read
  the whole template and decide the adapted name of each entity; then use it consistently
  in EVERY text where the entity appears — its own row, other rows' descriptions, e-mail
  addresses and web addresses (keep the `.example` domain ending: `contact@martins-bakery.example`,
  `https://martins-bakery.example`), messages. Keep real, international things as they are
  (currencies, product names like PostgreSQL or Slack).
- **Amounts stay in euros** (`€`, EUR): the templates' currency fields are in euros.
- **Labels**: two fields of one table, two choices of one list, two views of one table, two
  tables of a template must never get the same translation (case and accents do not count).
  Keep labels short and without final punctuation.
- **Addresses** keep their scheme: `https://…`, `mailto:…`. A `button` URL such as
  `mailto:{{E-mail}}?subject=Commande` keeps the citation and translates the subject.
- **HTML** (`rich`): keep every tag and attribute; translate the text between them.
- **AI prompts**: translate them so that a model answers in your language; keep their
  constraints (word limits, « réponds par une chaîne vide »…) and their citations.
- **Style**: follow the `register`; sample data should sound real and a little lively, like
  the French; no French typography (« » and spaces before `: ; ? !`) unless your language uses
  it — replace « » with your language's quotation marks.
- **Never** name competing products (in particular Airtable or Metabase).

## Output and checking

Write `packages/templates/i18n/<code>/<key>.json` for each of the 10 templates, with a small
Python script (`json.dump(obj, f, ensure_ascii=False, indent=2)`, keys in the order of
`templates-source.json`) or the Write tool — never a shell heredoc (heredocs on this machine
corrupt backslashes and `\u` escapes). After each template, run from the working directory
you were given:

    node tooling/i18n/templates.mjs check <code>

It prints `<code>  N/1170 texts translated` and, for each template not finished, what is
missing, stale (a key that is not a French text of the template) and every error: a
citation lost, a limit passed, an address without its scheme, and — `localized:` — what the
validator refuses once your texts are applied (two labels that became one, for instance).
Fix every error. At the end it must print `1170/1170` and nothing else below.

Touch nothing else in the repository: other people and agents work in it. No git commands
that change anything, no builds.

## Report

When done, reply with one short paragraph: the final check line, the adapted names you chose
for the main fictitious companies and people of the `demo` template, and anything you were
unsure of.
