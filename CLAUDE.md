# basedb

## Le catalogue `_basedb` change par migrations numérotées

- **Ne modifiez jamais une migration publiée** (`packages/catalog-schema/migrations/`, celles de `sealed.json`) : chaque installation a enregistré sa somme de contrôle dans `_basedb.catalog_migration` et refuserait de démarrer (`CATALOG_CHECKSUM_MISMATCH`). `0001_catalogue.sql` est publiée depuis 0.1.0.
- **Tout changement du catalogue va dans une nouvelle migration** : `pnpm catalog new <nom>` crée `NNNN_<nom>.sql`. Écrivez-la rejouable (`IF NOT EXISTS`, `DROP … IF EXISTS`), sans transaction explicite ni `CREATE INDEX CONCURRENTLY` : elle s'exécute déjà dans la sienne.
- Une base locale existante se met à jour seule au démarrage suivant de l'API (`BASEDB_MIGRATE=1`) : inutile de la recréer.
- `pnpm catalog status` montre l'état, `pnpm catalog check` vérifie (aussi lancé par `pnpm lint`). **À la publication d'une version** : `pnpm catalog seal X.Y.Z`, et `APPLICATION_VERSION` (`packages/core/src/catalog/cache.ts`) à `X.Y.Z` — le workflow `docker-publish.yml` refuse sinon.
- La garantie « une installation mise à jour = une installation neuve » est testée par `packages/core/test/int/catalog-migrations.test.ts`, pour chaque version publiée.

## L'interface et le site parlent vingt langues

- **Tout texte de l'interface s'écrit en français dans `$t('…')`** (`@/lib/i18n`), valeurs en `{nom}` ; un texte qui dépend d'un nombre dans `$tp(n, '{count} ligne', '{count} lignes')` — jamais `ligne{n > 1 ? 's' : ''}` ni une phrase en morceaux. Dates et nombres par `intlLocale()` et `Intl`, jamais `'fr-FR'`. Mode d'emploi : `tooling/i18n/README.md`.
- Une phrase nouvelle s'affiche en français tant qu'elle n'est pas traduite : `pnpm i18n` la liste. Ne modifiez pas à la main les catalogues `apps/web/src/locales/*.json`.
- Le site : les textes des pages d'accueil vont dans `www/src/i18n/ui/fr.ts` (jamais en dur dans les composants) ; ajouter une clé ne casse rien, renommer une clé existante perd ses traductions.

