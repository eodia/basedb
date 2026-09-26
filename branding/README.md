# basedb — identité

Le « b » modulaire associe une colonne, une cellule ouverte et un module détaché :
des données structurées, avec de la place pour construire la suite.

- `mark.svg` : icône principale, vert forêt et citron vert doux.
- `mark-light.svg` : variante pour les fonds sombres.
- `symbol.svg` : symbole monochrome, sans fond, colorable avec `currentColor`.
- `logo.svg` et `logo-light.svg` : signatures horizontales SVG, texte éditable.
- `favicon.ico` : versions 16, 32 et 48 pixels.
- `apple-touch-icon.png` : 180 pixels ; `icon-512.png` : 512 pixels.

Palette : forêt `#143D2B`, clair `#D9F5B5`, accent `#72CA89`.
Le nom reste en minuscules, sans point. La signature dans les interfaces hérite de
leur police ; les SVG autonomes utilisent la police système.

Source : `mark.svg`. Après une modification, exécuter `node scripts/generate-brand.mjs`
depuis la racine (les dépendances de `www` doivent être installées). Le script génère
les variantes et les copie dans l’application, le site et la documentation. Les
exports sont versionnés : aucune génération n’est nécessaire au déploiement.
