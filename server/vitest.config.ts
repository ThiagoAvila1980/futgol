import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['api/**/*.ts'],
      exclude: ['api/_db.ts', 'api/admin/**'],
    },
    testTimeout: 10000,
  },
});
