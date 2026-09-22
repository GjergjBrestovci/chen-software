import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

/**
 * SPEC.md §4 requires the semantic layer to stay free of UI concerns: the
 * validator, read-back and SVG renderer must be runnable without React. The
 * `no-restricted-imports` block below is what actually enforces that.
 */
const PURE_LAYERS = [
  'src/model/**',
  'src/geometry/**',
  'src/layout/**',
  'src/validation/**',
  'src/readback/**',
];
// `immer` is deliberately absent: it is a pure structural-sharing helper, not a UI dependency.
const UI_PACKAGES = ['react', 'react-dom', '@xyflow/react', 'zustand', 'zundo'];

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      // `layout.positions` and friends are genuine maps, not objects with known keys.
      '@typescript-eslint/dot-notation': ['error', { allowIndexSignaturePropertyAccess: true }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      // Numbers interpolate unambiguously, and SVG geometry is full of them.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },

  {
    files: PURE_LAYERS,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: UI_PACKAGES.map((name) => ({
            name,
            message: 'SPEC.md §4: this layer must stay pure and free of UI dependencies.',
          })),
        },
      ],
    },
  },

  {
    files: ['src/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // This config file itself is plain JS and outside the TS program.
  { files: ['**/*.js'], ...tseslint.configs.disableTypeChecked },

  prettier,
);
