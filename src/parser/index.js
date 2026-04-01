'use strict';

const babelParser = require('@babel/parser');

const BABEL_PLUGINS = [
  'asyncGenerators',
  'bigInt',
  'classProperties',
  'classPrivateProperties',
  'classPrivateMethods',
  'classStaticBlock',
  'decorators-legacy',
  'dynamicImport',
  'exportDefaultFrom',
  'exportNamespaceFrom',
  'functionBind',
  'functionSent',
  'importMeta',
  'jsx',
  'logicalAssignment',
  'nullishCoalescingOperator',
  'numericSeparator',
  'objectRestSpread',
  'optionalCatchBinding',
  'optionalChaining',
  'privateIn',
  'throwExpressions',
  'topLevelAwait',
];

/**
 * Parse JavaScript source into a Babel AST.
 * Falls back gracefully between module / script modes.
 *
 * @param {string} source   - raw JS source
 * @param {string} filePath - used to decide module vs script
 * @returns {import('@babel/types').File}
 */
function parse(source, filePath = '<unknown>') {
  const isMjs   = filePath.endsWith('.mjs');
  const isCjs   = filePath.endsWith('.cjs');
  const hasESM  = /\b(import|export)\b/.test(source);
  const sourceType = (isMjs || hasESM) && !isCjs ? 'module' : 'unambiguous';

  const opts = {
    sourceType,
    allowImportExportEverywhere: true,
    allowReturnOutsideFunction:  true,
    allowSuperOutsideMethod:     true,
    strictMode: false,
    plugins: [...BABEL_PLUGINS],
  };

  try {
    return babelParser.parse(source, opts);
  } catch (firstErr) {
    // Retry with script mode
    try {
      return babelParser.parse(source, { ...opts, sourceType: 'script' });
    } catch {
      // Throw the original error with location info
      throw firstErr;
    }
  }
}

module.exports = { parse };
