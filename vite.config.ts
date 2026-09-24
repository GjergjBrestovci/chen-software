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
    // Node resolves svg2pdf.js through `main`, its UMD build, which expects a
    // global jsPDF. The browser build already takes the ES build through
    // `module`; the tests are pointed at the same one.
    alias: [{ find: /^svg2pdf\.js$/, replacement: 'svg2pdf.js/dist/svg2pdf.es.min.js' }],
    server: { deps: { inline: ['svg2pdf.js'] } },
    coverage: {
      provider: 'v8',
      include: [
        'src/model/**/*.ts',
        'src/geometry/**/*.ts',
        'src/layout/**/*.ts',
        'src/persistence/**/*.ts',
        'src/export/**/*.ts',
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
