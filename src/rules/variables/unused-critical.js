'use strict';

const t = require('@babel/types');
const { walk, isLikelyAsync, getCalleeName } = require('../../parser/traversal');

module.exports = {
  id:              'unused-critical',
  description:     'Critical variables (e.g. API responses, DB results) that are declared but never used',
  defaultSeverity: 'medium',
  explanation: [
    'You fetched or computed data and assigned it to a variable, but never used that variable.',
    'This usually means either: (1) you forgot to use the data,',
    '(2) you used the wrong variable name later, or',
    '(3) the fetch is unnecessary and can be removed.',
  ].join(' '),
  badExample:  'const userData = await fetchUser(id); // ← fetched but ignored!\nreturn res.json({ status: "ok" });',
  goodExample: 'const userData = await fetchUser(id);\nreturn res.json(userData);',

  check({ ast }) {
    const warnings = [];

    walk(ast, {
      VariableDeclaration(path) {
        for (const declarator of path.node.declarations) {
          if (!t.isIdentifier(declarator.id)) continue;

          const init = declarator.init;
          if (!init) continue;

          // Only interested if the RHS is an async call (await or likely-async call)
          const isAwaitedCall =
            t.isAwaitExpression(init) && t.isCallExpression(init.argument) && isLikelyAsync(init.argument);

          const isDirectAsyncCall =
            t.isCallExpression(init) && isLikelyAsync(init);

          if (!isAwaitedCall && !isDirectAsyncCall) continue;

          const name    = declarator.id.name;
          const binding = path.scope.getBinding(name);

          if (!binding) continue;

          // Count real references (excluding the declaration itself)
          const refs = binding.referencePaths ?? [];

          if (refs.length === 0) {
            const callNode = t.isAwaitExpression(init) ? init.argument : init;
            const callName = getCalleeName(callNode) ?? 'unknown';

            warnings.push({
              line:       declarator.loc?.start.line,
              confidence: 78,
              message:    `you fetched data via \`${callName}()\` into \`${name}\`, but never used it… intentional?`,
              suggestion: `either use \`${name}\` somewhere, or remove the fetch if it's unnecessary`,
            });
          }
        }
      },
    });

    return warnings;
  },
};
