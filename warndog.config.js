// warndog.config.js — project-level config for warndog itself (dogfooding 🐶)

/** @type {import('./index.d.ts').WarnDogConfig} */
module.exports = {
  include: ['src/**/*.js', 'plugins/**/*.js', 'bin/**/*.js'],
  ignore: [
    'node_modules/**',
    'tests/fixtures/**',
    'coverage/**',
    '**/*.min.js',
  ],

  severity:   'low',
  confidence: 50,

  rules: {
    // We intentionally use some patterns in test fixtures — disable for src only
    'missing-await':         'high',
    'silent-promise':        'medium',
    'floating-promise':      'high',
    'impossible-condition':  'high',
    'accidental-assignment': 'high',
    'always-truthy-falsy':   'medium',
    'inconsistent-return':   'medium',
    'shadowed-variable':     'medium',
    'unused-critical':       'medium',
    'const-mutation':        'high',
    'cyclomatic-complexity': { severity: 'medium', threshold: 12 },
    'deep-nesting':          { severity: 'medium', threshold: 4 },
    'callback-hell':         'medium',
    'risky-equality':        'low',
    'error-handling':        'medium',
  },

  complexity: {
    cyclomaticThreshold: 12,
    nestingThreshold:    4,
    functionLengthMax:   100,
  },

  output: {
    format: 'pretty',
    color:  true,
  },

  debug: false,
};
