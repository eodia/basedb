# Les langues du site

Le site parle les vingt langues de basedb. Le français est la source et vit à la racine
(`/basedb/…`) ; chaque autre langue a son dossier, sous les mêmes chemins : `/basedb/en/…`,
`/basedb/pt-br/…`, `/basedb/zh-cn/…`. La liste, avec le nom de chaque langue dans la
sienne, est dans `locales.ts` — la même que celle de l’application
(`packages/contracts/src/locales.ts`).

## Les pages d’accueil

Tous les textes de l’accueil, des nouveautés, de la feuille de route et de la galerie des
modèles sont dans **`ui/fr.ts`** : titres et descriptions des pages, navigation, pied de
page, blocs, cartes, questions, textes des maquettes, textes alternatifs des images,
entrées des nouveautés et de la feuille de route, et ce que la galerie montre de chaque
modèle (`templates` : nom, résumé, description, catégorie, étiquettes). Le contenu des
modèles — tables, champs, lignes, vues — se traduit dans les dictionnaires des modèles,
`packages/templates/i18n/<langue>/<clé>.json` (voir `tooling/i18n/README.md`) : la page d’un
modèle le montre dans la langue de la page, et le site publie ces dictionnaires pour les
instances (`/modeles/i18n/<langue>.json`).

Les pages sont écrites une fois, dans `src/views/`, et reçoivent la langue :
`src/pages/index.astro` (français) et `src/pages/[locale]/index.astro` (les dix-neuf autres)
affichent la même vue. Les fichiers JSON des modèles (`/modeles/catalogue.json`,
`/modeles/<clé>.json`) n’existent qu’à la racine.

### Traduire

Une langue se traduit dans **`ui/<code>.ts`** — `ui/en.ts`, `ui/pt-br.ts`, `ui/zh-cn.ts` —,
repris tout seul par `ui/index.ts` :

```ts
import type { DeepPartial, Dict } from './index';

export default {
	hero: {
		badge: 'New: twenty languages, rich text and variables',
	},
	faq: {
		items: {
			languages: { q: 'In which languages?', a: '…' },
		},
	},
} satisfies DeepPartial<Dict>;
```

- Ce qui manque reste en français : on peut traduire par morceaux.
- Les enregistrements nommés (`faq.items`, `bento.small`, `changelog.entries`,
  `roadmap.columns.*.items`, `templates`…) se traduisent clé par clé et gardent l’ordre du
  français. Une liste (les puces d’un bloc, les éléments d’une entrée, les lignes du titre)
  se traduit entière.
- Les chaînes HTML le restent : gardez `<strong>`, `<code>`, `<a>`.
- `{n}`, `{label}`, `{name}`, `{year}`… sont remplis par la page ; dans un titre, la partie
  entre accolades `{…}` s’écrit à la main (la police d’accent). `{{Ville}}` est une variable
  de basedb, montrée telle quelle.
- Un texte qui dépend d’un nombre a ses formes (`one`, `other`, et `few`, `many`… quand la
  langue en a) : `{ one: '{n} tabela', few: '{n} tabele', many: '{n} tabel', other: '{n} tabeli' }` en polonais.
- Les dates des nouveautés sont des jours (`2026-09-27`) : chaque langue les écrit à sa
  façon, sans rien traduire.

### Les liens

Un lien vers le site s’écrit **comme sur le site français, depuis la racine et sans
`/basedb`** : `/fonctionnalites/vues/`, `href="/nouveautes/"`. La page le donne dans la
langue du lecteur (`localizedPath` pour un champ `href`, `localizeHtml` pour les `href="/…"`
d’un texte HTML) : un lecteur anglais reste en anglais. Les adresses externes
(`https://…`) ne changent pas ; les fichiers (`/modeles/catalogue.json`) restent à la racine.

Une ancre (`#vos-paramètres`) désigne un titre de la documentation française : si la
traduction de la page change ce titre, remplacez l’ancre par celle du titre traduit.

### L’image d’un lien partagé

Un lien vers le site, collé dans une messagerie ou un réseau, s’affiche avec une image dans
la langue de la page : `public/og/<code>.jpg` (1200 × 630), qui reprend le titre de
l’accueil (`teams.hero`), ses trois points forts et le tableau de la fenêtre (`teams.stage`).
Les pages d’accueil et la documentation la déclarent toutes. Ces images sont faites une
fois et gardées dans le dépôt : après un changement de ces textes, dans une langue ou en
français, refaites-les avec Google Chrome installé :

```sh
npm run og            # les vingt langues
npm run og -- fr en   # quelques-unes
```

## La documentation

Starlight déclare les vingt langues (`astro.config.mjs`). Une page traduite se place sous
`src/content/docs/<code>/`, au même chemin que la française :
`src/content/docs/en/guides/introduction.md` pour `guides/introduction.md`. Tant qu’elle
manque, Starlight sert la page française sous l’adresse de la langue, avec un avertissement.

Dans une page traduite :

- les liens internes prennent la langue : `/basedb/en/fonctionnalites/vues/` au lieu de
  `/basedb/fonctionnalites/vues/` ;
- les images, un dossier plus bas : `../../../../assets/screens/grille.png` ;
- le titre de la page (`title`) est celui de la barre latérale ; les groupes de la barre
  sont traduits dans `astro.config.mjs` (`translations`).

Le pied de page de la documentation (`src/components/DocsFooter.astro`) prend son texte
dans `docsFooter` du dictionnaire.

## Le choix de la langue

**Le sélecteur** (`src/components/landing/LanguagePicker.astro`, dans la barre de navigation
et le pied de page) liste les vingt langues, chacune vers la même page dans sa langue. Il
s’ouvre sans JavaScript (`<details>`). Un clic garde le choix dans le navigateur :
`localStorage['basedb-lang']`. Le sélecteur de langue de Starlight le garde aussi.

**La détection** (`detect.ts`) est un petit script en tête de chaque page — celles de
l’accueil (`src/layouts/Landing.astro`) comme celles de Starlight (option `head`) :

1. rien pour les robots, ni quand `localStorage` est inaccessible ;
2. un choix gardé l’emporte : une page dans une autre langue est remplacée par la même page
   dans la langue choisie (requête et ancre gardées) ;
3. sans choix, seule une page française (à la racine) change : vers la première langue du
   navigateur que le site parle — la balise exacte, puis la langue seule (`pt`/`pt-PT` →
   `pt-br`, tout chinois → `zh-cn`, `no`/`nn`/`nb` → `nb`) ; aucune → anglais. Une page
   demandée dans une langue (`/basedb/en/…`) ne bouge jamais sans choix.

La page d’arrivée est dans la langue voulue : le script ne boucle pas.

Chaque page d’accueil annonce ses vingt versions (`<link rel="alternate" hreflang>`, et
`x-default` vers le français) ; Starlight fait de même pour la documentation.
