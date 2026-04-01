'use strict';

const path  = require('path');
const fs    = require('fs');
const chalk = require('chalk');

const CONFIG_TEMPLATE = `// warndog.config.js
// Full documentation: https://github.com/warndog/warndog#configuration

/** @type {import('warndog').WarnDogConfig} */
module.exports = {
  // ── Target ──────────────────────────────────────────────────────────
  // Directories or globs to include in analysis.
  include: ['src/**/*.js', '*.js'],

  // Patterns to ignore. Supports micromatch globs.
  ignore: [
    'node_modules/**',
    'dist/**',
    'build/**',
    'coverage/**',
    '**/*.min.js',
    '**/*.test.js',
    '**/*.spec.js',
  ],

  // ── Severity & Confidence ────────────────────────────────────────────
  // Only report warnings at or above this severity: low | medium | high | critical
  severity: 'low',

  // Only report warnings at or above this confidence score (0–100).
  confidence: 50,

  // ── Rules ────────────────────────────────────────────────────────────
  rules: {
    // Async
    'missing-await':         'high',
    'silent-promise':        'medium',
    'floating-promise':      'high',

    // Logic
    'impossible-condition':  'high',
    'accidental-assignment': 'high',
    'always-truthy-falsy':   'medium',
    'inconsistent-return':   'medium',

    // Variables
    'shadowed-variable':     'medium',
    'unused-critical':       'medium',
    'const-mutation':        'high',

    // Complexity
    'cyclomatic-complexity': 'medium',
    'deep-nesting':          'medium',
    'callback-hell':         'medium',

    // Patterns
    'risky-equality':        'low',
    'error-handling':        'medium',
  },

  // ── Complexity Thresholds ────────────────────────────────────────────
  complexity: {
    cyclomaticThreshold: 10,   // warn above this
    nestingThreshold:    4,    // warn above this depth
    functionLengthMax:   80,   // warn if function exceeds N lines
  },

  // ── Plugins ──────────────────────────────────────────────────────────
  plugins: [
    // 'warndog-plugin-express',
    // 'warndog-plugin-react',
    // './my-custom-rules.js',
  ],

  // ── Output ───────────────────────────────────────────────────────────
  output: {
    format: 'pretty',   // pretty | json
    color:  true,
  },

  // ── Debug ────────────────────────────────────────────────────────────
  debug: false,
};
`;

async function handler(opts = {}) {
  const cwd        = process.cwd();
  const configPath = path.join(cwd, 'warndog.config.js');

  if (fs.existsSync(configPath) && !opts.force) {
    console.log(chalk.yellow('⚠️  warndog.config.js already exists.'));
    console.log(chalk.gray('   Use --force to overwrite it.'));
    return;
  }

  fs.writeFileSync(configPath, CONFIG_TEMPLATE, 'utf8');

  console.log(chalk.green('✅  Created warndog.config.js'));
  console.log(chalk.gray('\nNext steps:'));
  console.log(chalk.gray('  1. Review and customise the config'));
  console.log(chalk.gray(`  2. Run ${chalk.white('warndog')} to analyse your project`));
  console.log(chalk.gray(`  3. Run ${chalk.white('warndog watch')} for live feedback\n`));
}

module.exports = { handler };
