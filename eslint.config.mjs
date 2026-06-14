import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  eslint.configs.recommended,
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/*.js', '**/*.mjs'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: ['./tsconfig.base.json', './apps/*/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        // Express 全局命名空间由 @types/multer 提供（用于 Express.Multer.File 类型），
        // 运行时不存在该变量，仅为 TS 类型；声明为 readonly 避免 no-undef 误报。
        Express: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
  {
    files: ['apps/admin/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ['apps/miniapp/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
        uni: 'readonly',
      },
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
];
