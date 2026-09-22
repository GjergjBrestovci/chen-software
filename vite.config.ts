import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Vite and Vitest share one config so the app and the tests resolve modules
 * identically. `coverage.include` is deliberately narrow: SPEC.md §10 requires
 * >=90% coverage of the *pure* logic only, and each milestone widens this list.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Pure logic runs in node; component tests opt in with a
    // `// @vitest-environment jsdom` docblock from milestone 3 onwards.
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/model/**/*.ts',
        'src/geometry/**/*.ts',
        'src/layout/**/*.ts',
        'src/persistence/**/*.ts',
        'src/canvas/scene.ts',
        'src/canvas/nodeChanges.ts',
        'src/canvas/connections.ts',
        'src/canvas/nodes/componentStyle.ts',
      ],
      // Type-only modules have no runtime statements to cover.
      exclude: ['**/index.ts', '**/types.ts', '**/*.test.ts', '**/__tests__/**'],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
