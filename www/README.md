# basedb — le site

Le site public de basedb, logiciel libre d’[Eodia](https://eodia.com/fr/) : la page
d’accueil, les nouveautés, la feuille de route et la documentation. Chaque page renvoie au
studio — le pied de page de l’accueil, celui de la documentation, et les métadonnées
(`author`, fiche JSON-LD `SoftwareApplication`). [Astro](https://astro.build) et [Starlight](https://starlight.astro.build),
en français. Publié sur GitHub Pages sous `https://eodia.github.io/basedb/`.

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
| `src/pages/index.astro` | la page d’accueil, assemblée à partir de `src/components/landing/` |
| `src/pages/nouveautes.astro`, `feuille-de-route.astro` | les pages annexes |
| `src/content/docs/` | la documentation (Markdown), une page par fichier |
| `src/pages/modeles/` | la galerie des modèles de base, une page par modèle, et `catalogue.json` que les instances lisent |
| `../packages/templates/catalog/` | les modèles eux-mêmes, un fichier JSON par modèle — hors de `www/`, partagés avec l’application |
| `src/assets/screens/` | les captures de l’interface, optimisées en WebP à la construction |
| `src/styles/landing.css` | les jetons de couleur et de typographie de l’accueil |
| `src/styles/starlight-custom.css` | le thème de la documentation |
| `astro.config.mjs` | l’adresse du site et la barre latérale de la documentation |

## Les captures

Elles viennent de l’interface réelle, sur la base de démonstration « Démo : Atelier Lumen »
(le modèle `demo`), à 1440 × 900 et en densité ×2, avec des personnes fictives (Léa Martin,
Camille Durand). Pour les refaire, démarrez la pile (`docker compose up -d`), ouvrez la base
de démonstration depuis un projet vide, donnez-lui un peu d’activité — quelques modifications,
un commentaire avec mention, une écriture en SQL direct, un environnement « Recette » — puis
remplacez les fichiers de `src/assets/screens/` en gardant leurs noms. Masquez le badge du
serveur de développement de Next (`nextjs-portal`) s’il est visible, et remplacez l’adresse
`localhost` des liens de partage par une adresse neutre.

## Publier

Le workflow `.github/workflows/deploy-www.yml` construit et publie le site sur GitHub Pages,
à la main (« Run workflow ») ou en poussant une étiquette `www-v*`.
