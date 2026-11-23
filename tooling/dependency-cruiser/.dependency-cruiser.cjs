/**
 * Les interdits du graphe de dépendances — chapitre 10 §1.3.
 *
 * Le serveur est en Rust (`rust-server/`, dont les crates ont leur propre graphe) : ne
 * restent ici que les paquets TypeScript — l'interface et ce qu'elle partage ou publie.
 *
 * Chacun casse la CI. L'isolation pnpm (`node-linker=isolated`) empêche l'import NON
 * DÉCLARÉ ; ces règles empêchent la DÉCLARATION. Les deux sont nécessaires : le
 * premier filtre n'est pas une garantie suffisante (§2.4).
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'pas-de-pilote-postgres',
      comment:
        'Interdit 1. Seul le serveur (Rust) parle à PostgreSQL. Aucun paquet TypeScript ne ' +
        'déclare de pilote de base ni de client SQL : le front parle HTTP, point. Sans cette ' +
        'règle, une action serveur Next.js finirait par ouvrir une connexion PostgreSQL et ' +
        'contourner la couche de permissions.',
      severity: 'error',
      from: { path: '^(apps|packages)/' },
      to: {
        dependencyTypes: ['npm'],
        path: '^(pg|postgres|pg-pool|pg-native|drizzle-orm/node-postgres)$',
      },
    },
    {
      name: 'naming-ne-depend-de-rien',
      comment:
        'Interdit 2. `@basedb/naming` ne dépend de rien : fonctions pures, aucune ' +
        "entrée-sortie. C'est ce qui rend ses tests de propriétés instantanés et " +
        "l'exécution sous locale forcée triviale (§7.4).",
      severity: 'error',
      from: { path: '^packages/naming/src' },
      to: {
        dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer'],
        pathNot: '^node:',
      },
    },
    {
      name: 'pas-d-import-profond',
      comment:
        "Interdit 3. La carte `exports` de chaque paquet n'expose que sa racine. " +
        "`@basedb/contracts/src/…` n'est pas atteignable, même en connaissant le chemin.",
      severity: 'error',
      // Un paquet reste libre de sa structure interne : seul l'import profond VENU DE
      // L'EXTÉRIEUR est interdit, d'où l'exclusion du paquet vers lui-même.
      from: { path: '^(packages|apps)/([^/]+)/' },
      to: { path: '^packages/[^/]+/(src|dist)/.+', pathNot: '^(packages|apps)/$2/' },
    },
    {
      name: 'pas-de-donnees-simulees-dans-web',
      comment:
        "Interdit 4. `apps/web` n'importe aucun module dont le chemin contient " +
        '`fixtures`, `mocks` ou `msw` hors fichiers de test — « aucune donnée mockée ou en ' +
        'dur », exigence du cadrage rendue exécutable.',
      severity: 'error',
      from: { path: '^apps/web/src', pathNot: '\\.(test|spec)\\.[tj]sx?$' },
      to: { path: '(fixtures|mocks|msw)' },
    },
    {
      name: 'pas-de-cycle',
      comment: 'Un cycle de dépendances rend le graphe du §1.3 ininterprétable.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(node_modules|dist|\\.turbo)' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node'],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
}
