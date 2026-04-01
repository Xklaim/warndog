'use strict';

const t = require('@babel/types');
const { walk } = require('../../parser/traversal');

module.exports = {
  id:              'callback-hell',
  description:     'Deeply nested callback chains (pyramid of doom) that should be refactored',
  defaultSeverity: 'medium',
  explanation: [
    'Multiple levels of nested callbacks make code very hard to read and maintain.',
    'Errors get swallowed, logic gets tangled, and refactoring becomes painful.',
    'Use async/await or Promise chaining to flatten the structure.',
  ].join(' '),
  badExample:  'fs.readFile(f, (err, data) => {\n  db.query(q, (err, rows) => {\n    api.post(rows, (err, res) => {\n      // pyramid of doom\n    });\n  });\n});',
  goodExample: 'const data = await fs.promises.readFile(f);\nconst rows = await db.query(q);\nconst res  = await api.post(rows);',

  check({ ast }) {
    const warnings = [];

    walk(ast, {
      CallExpression(path) {
        const callbackDepth = getCallbackNestingDepth(path);
        if (callbackDepth < 3) return;

        const line     = path.node.loc?.start.line;
        const severity = callbackDepth >= 5 ? 'high' : 'medium';

        warnings.push({
          line,
          severity,
          confidence: 80,
          message:    `callback nested ${callbackDepth} levels deep — this is callback hell`,
          suggestion: 'refactor using async/await or Promise chaining to flatten the structure',
        });
      },
    });

    return warnings;
  },
};

function getCallbackNestingDepth(path) {
  let depth   = 0;
  let current = path.parentPath;

  while (current) {
    const node = current.node;
    // A callback pattern: function/arrow passed as argument to a call
    if (
      (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) &&
      current.parentPath &&
      t.isCallExpression(current.parentPath.node)
    ) {
      depth++;
    }
    current = current.parentPath;
  }

  return depth;
}
