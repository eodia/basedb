import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Les tests d'intégration démarrent un conteneur PostgreSQL (chapitre 10 §7.1) ;
    // ils sont sélectionnés par le motif `*.int.test.ts` dans les scripts du paquet.
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
})
