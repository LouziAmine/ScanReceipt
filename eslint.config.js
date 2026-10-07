// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const prettier = require('eslint-config-prettier');

/**
 * Clean Architecture boundaries: each layer may only depend on the layers below it.
 *   presentation -> application -> domain
 *   infrastructure -> application (ports) -> domain
 */
const layerBoundary = (forbidden, message) => ({
  'no-restricted-imports': [
    'error',
    { patterns: forbidden.map((group) => ({ group: [group], message })) },
  ],
});

module.exports = defineConfig([
  { ignores: ['www/**', 'dist/**', 'android/**', 'ios/**', '.angular/**', 'coverage/**'] },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      angular.configs.tsRecommended,
      prettier,
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: __dirname },
    },
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      '@angular-eslint/prefer-signals': 'error',
      '@angular-eslint/no-async-lifecycle-method': 'error',
      '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'no-public' }],
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-floating-promises': 'error',
      // Angular's static validators (Validators.required…) are safe to pass unbound.
      '@typescript-eslint/unbound-method': 'off',
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['src/app/domain/**/*.ts'],
    rules: layerBoundary(
      [
        '@angular/*',
        '@ionic/*',
        '@capacitor/*',
        '@capacitor-*/*',
        '@capgo/*',
        '@capawesome/*',
        '@application/*',
        '@infrastructure/*',
        '@presentation/*',
      ],
      'The domain layer is pure TypeScript: no framework, no platform, no outer layer.',
    ),
  },
  {
    files: ['src/app/application/**/*.ts'],
    rules: layerBoundary(
      [
        '@ionic/*',
        '@capacitor/*',
        '@capacitor-*/*',
        '@capgo/*',
        '@capawesome/*',
        '@infrastructure/*',
        '@presentation/*',
      ],
      'The application layer depends on domain ports only, never on adapters or UI.',
    ),
  },
  {
    files: ['src/app/infrastructure/**/*.ts'],
    rules: layerBoundary(['@presentation/*'], 'Infrastructure adapters must not depend on the UI.'),
  },
  {
    files: ['src/app/presentation/**/*.ts'],
    rules: layerBoundary(
      ['@infrastructure/*'],
      'The UI talks to use cases and stores, never to adapters directly.',
    ),
  },
  {
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {
      '@angular-eslint/template/prefer-control-flow': 'error',
      '@angular-eslint/template/prefer-self-closing-tags': 'error',
    },
  },
]);
