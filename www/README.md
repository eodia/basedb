# basedb — le site

Le site public de basedb, logiciel libre d’[Eodia](https://eodia.com/fr/) : la page
d’accueil, les nouveautés, la feuille de route et la documentation. Chaque page renvoie au
studio — le pied de page de l’accueil, celui de la documentation, et les métadonnées
(`author`, fiche JSON-LD `SoftwareApplication`). [Astro](https://astro.build) et [Starlight](https://starlight.astro.build),
en vingt langues — le français d’abord (voir `src/i18n/README.md`). Publié sur GitHub Pages sous `https://eodia.github.io/basedb/`.

Ce dossier est un projet à part : il n’appartient pas à l’espace de travail pnpm du dépôt et
s’installe avec npm.

```bash
cd www
npm install
npm run dev       # http://localhost:4321/basedb/
npm run build     # le site statique dans dist/
npm run check     # vérification des types
```

## Où est quoi

| Chemin | Contenu |
|---|---|
| `src/views/` | les pages d’accueil, écrites une fois pour toutes les langues : l’accueil (assemblé à partir de `src/components/landing/`), les nouveautés, la feuille de route, la galerie des modèles |
| `src/pages/` | leurs adresses : le français à la racine, les autres langues sous `[locale]/` |
| `src/i18n/` | les langues : leur liste, les textes des pages d’accueil (`ui/fr.ts`, puis une traduction par langue), la détection de la langue |
| `src/content/docs/` | la documentation (Markdown), une page par fichier ; ses traductions sous `src/content/docs/<langue>/` |
| `src/pages/modeles/` | la galerie des modèles de base, une page par modèle, et `catalogue.json` que les instances lisent |
| `../packages/templates/catalog/` | les modèles eux-mêmes, un fichier JSON par modèle — hors de `www/`, partagés avec l’application |
| `src/assets/screens/<langue>/` | les captures de l’interface, une série par langue (WebP) ; `src/lib/screens.ts` choisit celle de la page |
| `src/styles/landing.css` | les jetons de couleur et de typographie de l’accueil |
| `src/styles/starlight-custom.css` | le thème de la documentation |
| `astro.config.mjs` | l’adresse du site et la barre latérale de la documentation |

## Les captures

Elles viennent de l’interface réelle, dans chacune des vingt langues : une instance vierge
par langue, l’interface réglée dans cette langue, la base de démonstration (le modèle `demo`)
installée depuis l’écran — donc traduite —, puis la même activité partout : une seconde
personne aux droits restreints, des modifications, trois commentaires avec mentions, une
écriture en SQL direct, une automatisation dessinée en graphe et ses exécutions (dont une qui
passe par l’IA), une question, des requêtes et des vues SQL, des partages, un environnement de
test. Les personnes sont fictives, avec des noms courants dans la langue (Léa Martin et
Camille Durand en français). Format : 1440 × 900 en densité ×2, en WebP (qualité 82), dans
`src/assets/screens/<langue>/` sous les mêmes 28 noms ; les adresses des liens de partage
sont remplacées par `https://basedb.example.com`.

Une image manquante dans une langue se replie sur la française (`src/lib/screens.ts` pour
l’accueil ; dans la documentation, chaque page cite l’image de son dossier).

## Publier

Le workflow `.github/workflows/deploy-www.yml` construit et publie le site sur GitHub Pages,
à la main (« Run workflow ») ou en poussant une étiquette `www-v*`.
