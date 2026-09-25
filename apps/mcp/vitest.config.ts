import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Un conteneur PostgreSQL met plusieurs secondes à démarrer.
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
})
