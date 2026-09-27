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
  physiques, le langage des formules, le code montré en exemple.

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

## Le site (`www/`)

Les textes des pages d'accueil sont dans `www/src/i18n/ui/fr.ts`, traduits dans
`ui/<code>.ts` (voir `www/src/i18n/README.md`) ; `node tooling/i18n/check-site.mjs <code>`
les vérifie. La documentation est traduite dans `www/src/content/docs/<code>/`, sous les
mêmes chemins.
