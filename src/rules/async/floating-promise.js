'use strict';

const t = require('@babel/types');
const { walk, isLikelyAsync } = require('../../parser/traversal');

/** @type {import('../index').Rule} */
module.exports = {
  id:              'floating-promise',
  description:     'Detects Promise-returning calls that are neither awaited nor handled',
  defaultSeverity: 'high',
  explanation: [
    'A function that returns a Promise is being called, but the result is completely ignored.',
    'Neither awaited, assigned, nor chained with .then().',
    'The async operation runs in the background with no error handling.',
    'If it fails, you will never know.',
  ].join(' '),
  badExample:  '// Outside an async context:\nsendWelcomeEmail(user); // ← promise is floating!',
  goodExample: '// Option 1 — await it:\nawait sendWelcomeEmail(user);\n\n// Option 2 — chain it:\nsendWelcomeEmail(user).catch(err => logger.error(err));',

  check({ ast }) {
    const warnings = [];

    walk(ast, {
      ExpressionStatement(path) {
        const expr = path.node.expression;
        if (!t.isCallExpression(expr)) return;

        // Skip already-awaited
        if (t.isAwaitExpression(path.parent)) return;

        // Skip if it's a .then/.catch/.finally — those are chains
        const callee = expr.callee;
        if (t.isMemberExpression(callee)) {
          const prop = callee.property;
          if (t.isIdentifier(prop) && ['then', 'catch', 'finally'].includes(prop.name)) return;
        }

        if (!isLikelyAsync(expr)) return;

        // If inside an async function without await → handled by missing-await
        // Here we focus on fire-and-forget at the top level or in synchronous context

        const line = expr.loc?.start.line;
        warnings.push({
          line,
          confidence: 70,
          message:    'this call returns a Promise that is completely ignored — if it fails, you won\'t know',
          suggestion: 'either `await` it, assign the result, or attach a `.catch()`',
        });
      },
    });

    return warnings;
  },
};
