'use strict';

const path       = require('path');
const fs         = require('fs');
const { cosmiconfig } = require('cosmiconfig');

const MODULE_NAME = 'warndog';

const DEFAULTS = {
  include:    ['**/*.js', '**/*.mjs', '**/*.cjs', '**/*.jsx'],
  ignore:     [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/*.min.js',
  ],
  severity:   'low',
  confidence: 0,
  debug:      false,
  rules:      {},
  plugins:    [],
  complexity: {
    cyclomaticThreshold: 10,
    nestingThreshold:    4,
    functionLengthMax:   80,
  },
  output: {
    format: 'pretty',
    color:  true,
  },
};

let _cachedConfig = null;
let _cachedPath   = null;

/**
 * Load warndog config from:
 *   1. An explicit path (from --config flag)
 *   2. Auto-discovered via cosmiconfig (warndog.config.js, .warndogrc, etc.)
 *   3. Fall back to defaults
 */
async function loadConfig(explicitPath, cwd = process.cwd()) {
  // Re-use cache only if same explicit path & cwd
  if (_cachedConfig && _cachedPath === (explicitPath ?? cwd)) {
    return _cachedConfig;
  }

  let userConfig = {};

  if (explicitPath) {
    const resolved = path.resolve(cwd, explicitPath);
    if (!fs.existsSync(resolved)) {
      console.warn(`[warndog] Config file not found: ${resolved}`);
    } else {
      try {
        userConfig = require(resolved);
      } catch (e) {
        console.warn(`[warndog] Could not load config: ${e.message}`);
      }
    }
  } else {
    const explorer = cosmiconfig(MODULE_NAME, {
      searchPlaces: [
        'warndog.config.js',
        'warndog.config.cjs',
        '.warndogrc',
        '.warndogrc.json',
        '.warndogrc.js',
        'package.json',
      ],
    });

    try {
      const result = await explorer.search(cwd);
      if (result) userConfig = result.config ?? {};
    } catch (e) {
      if (process.env.WARNDOG_DEBUG) console.warn('[warndog] Config search error:', e.message);
    }
  }

  const merged = deepMerge(DEFAULTS, userConfig);

  _cachedConfig = merged;
  _cachedPath   = explicitPath ?? cwd;

  return merged;
}

function deepMerge(base, override) {
  if (!override || typeof override !== 'object') return base;
  const result = { ...base };
  for (const key of Object.keys(override)) {
    if (
      override[key] !== null &&
      typeof override[key] === 'object' &&
      !Array.isArray(override[key]) &&
      typeof base[key] === 'object' &&
      !Array.isArray(base[key])
    ) {
      result[key] = deepMerge(base[key] ?? {}, override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

module.exports = { loadConfig, DEFAULTS };
