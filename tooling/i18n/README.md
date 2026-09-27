# Les langues de basedb

basedb parle vingt langues (`LOCALES` de `@basedb/contracts`). Le français est la source :
chaque texte s'écrit en français, et les dix-neuf autres langues le traduisent. La
conception est au chapitre 11 §10.1 de l'architecture.

## Écrire un texte de l'interface (`apps/web`)

```tsx
import { $t, $tp } from '@/lib/i18n'

$t('Enregistrer')
$t('Nouveau champ dans {table}', { table: table.label })
$tp(count, '{count} ligne', '{count} lignes')        // jamais `ligne{n > 1 ? 's' : ''}`
$t('Moyenne||hauteur de ligne')                      // un mot, deux sens : le sens après ||
msg('Actif')                                         // traduit à l'affichage : $t(statut)
```

- La phrase française **est** la clé ; une phrase non traduite s'affiche en français.
- Une phrase entière par appel, valeurs en `{nom}` : jamais de morceaux concaténés, jamais
  d'accord calculé (`précédent{e}s`).
- Les dates et les nombres passent par `Intl` dans la langue de la page : `intlLocale()`,
  `monthNames()`, `weekdayNames()`, `dayLabel()`, `formatCount()`.
- Les noms des groupes système se lisent par `groupName(label)`.
- Restent en français, parce que ce ne sont pas des textes d'interface : les noms
  physiques, le code montré en exemple.
- Le langage des formules ne passe pas par `$t` : il a deux orthographes, française et
  anglaise (`formulaDialect` du noyau), et un écran qui n'est pas en français écrit l'anglaise.

`node tooling/i18n/codemod.mjs --write <fichier>` enveloppe les textes français d'un
fichier ; il laisse de côté ce qu'il ne sait pas trancher (pluriels, code) et le dit dans
`codemod-report.txt`.

## Traduire

```sh
pnpm i18n                       # extrait le catalogue source et vérifie les 19 langues
node tooling/i18n/check.mjs de  # une langue : manquantes, {valeurs} perdues, pluriels
```

- `extract.mjs` dresse `app-source.json` : chaque phrase, ses formes de pluriel, et où elle
  sert.
- Les catalogues sont `apps/web/src/locales/<code>.json` : la phrase française → sa
  traduction, ou, pour un pluriel, ses formes CLDR (`one`, `few`, `many`, `other`…).
- `batches.mjs split` découpe la source en lots, `batches.mjs merge <code> <dossier>` fusionne
  les lots traduits et vérifie le résultat.
- `glossary.json` fixe les termes du produit et le ton de chaque langue ; `terms/<code>.md`
  garde les libellés choisis par le traducteur de la documentation.
- Consignes données aux traducteurs : `app-translation-brief.md`, `docs-translation-brief.md`,
  `site-translation-brief.md`.

## Les modèles de base (`packages/templates`)

Un modèle officiel s'écrit en français (`packages/templates/catalog/<clé>.json`) ; ses
textes dans une langue sont un dictionnaire, `packages/templates/i18n/<code>/<clé>.json` —
le texte français → sa traduction —, que l'instance et le site appliquent par
`localizeTemplate` (`@basedb/contracts`, chapitre 20 §3.4). Les citations (`[Libellé]` des
formules et des filtres, `{{Libellé}}` des consignes) restent en français dans les
traductions : le code les réécrit.

```sh
npx tsc -b packages/templates
node tooling/i18n/templates.mjs extract          # templates-source.json : chaque texte, sa sorte, sa place
node tooling/i18n/templates.mjs check de         # manquants, citations perdues, modèle traduit encore valide
node tooling/i18n/templates.mjs prefill de       # part des cartes de la galerie déjà traduites dans l'app
```

Consigne donnée aux traducteurs : `templates-translation-brief.md`.

## La documentation API et MCP d'une base

Le noyau l'écrit lui-même (`packages/core/src/catalog/documentation.ts`), dans la langue de
l'écran que l'interface envoie (`x-basedb-locale`). Même convention qu'avec `$t` : chaque
paragraphe passe par `t('phrase française', { nom })`, et un libellé rangé dans une table par
`phrase('…')`. Les traductions sont dans `packages/core/src/catalog/documentation-texts/<code>.ts`
(phrase française → traduction). Une phrase ajoutée ou reformulée en français fait échouer
`packages/core/test/unit/documentation-texts.test.ts` dans chaque langue qui ne l'a pas ;
d'ici là, elle s'affiche en français. Ce qui n'est pas de la prose reste tel quel : noms, chemins,
codes, et les messages du serveur cités en exemple.

## Le site (`www/`)

Les textes des pages d'accueil sont dans `www/src/i18n/ui/fr.ts`, traduits dans
`ui/<code>.ts` (voir `www/src/i18n/README.md`) ; `node tooling/i18n/check-site.mjs <code>`
les vérifie. La documentation est traduite dans `www/src/content/docs/<code>/`, sous les
mêmes chemins.
