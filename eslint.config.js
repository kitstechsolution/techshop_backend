import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**/*',
      'migrations/**/*',
      'scripts/**/*',
      '**/*.config.js',
      '**/*.config.cjs',
      'jest.setup.ts',
      'node_modules/**/*',
      '**/*.js' // Ignore all JS files
    ]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json'
      }
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_', 'caughtErrorsIgnorePattern': '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'warn'
    }
  },
  {
    files: ['**/logger.ts'],
    rules: {
      'no-console': 'off'
    }
  }
);
