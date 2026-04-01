'use strict';

const path = require('path');

/**
 * Plugin API shape:
 * {
 *   name:  string,
 *   rules: Rule[],        // optional extra rules
 *   setup?: (config) => void,  // optional init hook
 * }
 */

async function loadPlugins(pluginList = [], config = {}) {
  const loaded = [];

  for (const entry of pluginList) {
    let plugin;

    try {
      if (typeof entry === 'string') {
        // Try resolving as a node module or relative path
        const resolved = resolvePlugin(entry);
        plugin = require(resolved);
      } else if (typeof entry === 'object' && entry.rules) {
        // Inline plugin object
        plugin = entry;
      } else {
        console.warn(`[warndog] Skipping invalid plugin entry: ${JSON.stringify(entry)}`);
        continue;
      }
    } catch (err) {
      console.warn(`[warndog] Could not load plugin "${entry}": ${err.message}`);
      continue;
    }

    // Validate plugin shape
    if (!plugin || typeof plugin !== 'object') {
      console.warn(`[warndog] Plugin "${entry}" did not export a valid object`);
      continue;
    }

    // Call optional setup hook
    if (typeof plugin.setup === 'function') {
      try { await plugin.setup(config); } catch (e) {
        console.warn(`[warndog] Plugin "${plugin.name}" setup error:`, e.message);
      }
    }

    loaded.push(plugin);
  }

  return loaded;
}

function resolvePlugin(name) {
  const cwd = process.cwd();

  // Relative path — resolve from cwd
  if (name.startsWith('.') || name.startsWith('/')) {
    return path.resolve(cwd, name);
  }

  // Node module — try from cwd first, then global
  try {
    return require.resolve(name, { paths: [cwd] });
  } catch {
    return require.resolve(name);
  }
}

/**
 * createPlugin — helper for plugin authors to create typed plugins.
 *
 * Usage:
 *   module.exports = createPlugin({
 *     name: 'my-plugin',
 *     rules: [ myRule1, myRule2 ],
 *   });
 */
function createPlugin({ name, rules = [], setup }) {
  if (!name) throw new Error('[warndog] createPlugin: "name" is required');
  for (const rule of rules) {
    validateRule(rule);
  }
  return { name, rules, setup };
}

/**
 * createRule — helper for plugin authors to create typed rules.
 *
 * Usage:
 *   module.exports = createRule({
 *     id: 'my-rule',
 *     description: '...',
 *     defaultSeverity: 'medium',
 *     check({ ast, source }) {
 *       return [{ line: 1, confidence: 80, message: '...' }];
 *     },
 *   });
 */
function createRule(ruleDef) {
  validateRule(ruleDef);
  return ruleDef;
}

function validateRule(rule) {
  if (!rule.id)              throw new Error('[warndog] Rule missing "id"');
  if (!rule.description)     throw new Error(`[warndog] Rule "${rule.id}" missing "description"`);
  if (!rule.defaultSeverity) throw new Error(`[warndog] Rule "${rule.id}" missing "defaultSeverity"`);
  if (typeof rule.check !== 'function' && typeof rule.checkAll !== 'function') {
    throw new Error(`[warndog] Rule "${rule.id}" must implement check() or checkAll()`);
  }
}

module.exports = { loadPlugins, createPlugin, createRule };
