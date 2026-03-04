import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts', 'packages/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/migrate/**/*.ts'],
      exclude: [
        'src/migrate/__tests__/**',
        'src/migrate/testing/**',
        'src/migrate/index.ts', // Re-exports only
        'src/migrate/types.ts', // Type definitions only
      ],
    },
    testTimeout: 30000,
  },
});
