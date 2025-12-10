module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true
  },
  extends: ['standard'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  globals: {
    ImageOptimizer: 'readonly',
    StatisticsEngine: 'readonly',
    gtag: 'readonly'
  },
  rules: {
    // Customize rules as needed
    'no-console': 'warn',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'prefer-const': 'error'
  },
  ignorePatterns: ['node_modules/', 'coverage/', 'dist/']
}
