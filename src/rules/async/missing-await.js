'use strict';

const t = require('@babel/types');
const { walk, isInsideAsync, isAwaited, isResultUsed, isLikelyAsync, getCalleeName } = require('../../parser/traversal');

/** @type {import('../index').Rule} */
module.exports = {
  id:              'missing-await',
  description:     'Detects async calls that are not awaited inside async functions',
  defaultSeverity: 'high',
  explanation: [
    'You are calling a function that returns a Promise, but you are not awaiting it.',
    'This means code after the call will execute before the async operation finishes.',
    'This causes race conditions, wrong data, and bugs that only appear in production.',
  ].join(' '),
  badExample:  'async function loadUser() {\n  db.findOne({ id }); // ← not awaited!\n  return res.json(user); // user is undefined\n}',
  goodExample: 'async function loadUser() {\n  const user = await db.findOne({ id });\n  return res.json(user);\n}',

  check({ ast, sourceLines }) {
    const warnings = [];

    walk(ast, {
      CallExpression(path) {
        const node = path.node;

        // Only care about calls inside async functions
        if (!isInsideAsync(path)) return;

        // Skip if already awaited
        if (isAwaited(path)) return;

        // Skip if the result is used (assigned/returned/passed)
        // — user may be doing something with the promise intentionally
        if (isResultUsed(path)) return;

        // Skip .then / .catch / .finally chains — handled by silent-promise
        const callee = node.callee;
        if (t.isMemberExpression(callee)) {
          const prop = callee.property;
          if (t.isIdentifier(prop) && ['then', 'catch', 'finally'].includes(prop.name)) return;
        }

        if (!isLikelyAsync(node)) return;

        const name = getCalleeName(node) ?? 'unknown';
        const line = node.loc?.start.line;

        warnings.push({
          line,
          column:     node.loc?.start.column,
          confidence: computeConfidence(name, path),
          message:    `this async call to \`${name}()\` is not awaited… execution may be out of order`,
          suggestion: `add \`await\` before \`${name}()\`, or assign the result if intentional`,
        });
      },
    });

    return warnings;
  },
};

function computeConfidence(name, path) {
  // Boost confidence for well-known async APIs
  const highConf = new Set(['fetch', 'axios', 'axios.get', 'axios.post', 'db.query', 'fs.readFile', 'fs.writeFile']);
  if (highConf.has(name)) return 92;

  // Medium confidence for likely async patterns
  if (/\b(find|save|create|update|delete|query|connect)\b/i.test(name)) return 78;
  if (/\b(send|request|get|post|put|patch)\b/i.test(name)) return 72;

  return 60;
}
