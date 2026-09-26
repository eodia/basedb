import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * The unit tests of the interface: pure modules, read as the application reads them —
 * `@/…` is `src/…`, as in `tsconfig.json`.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['test/unit/**/*.test.ts'],
  },
})
