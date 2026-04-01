'use strict';

const t = require('@babel/types');
const { walk } = require('../../parser/traversal');

module.exports = {
  id:              'const-mutation',
  description:     'Attempts to reassign variables declared with const',
  defaultSeverity: 'high',
  explanation: [
    'A variable declared with `const` is being reassigned.',
    'While JavaScript will throw a TypeError at runtime,',
    'this is often a sign that the developer misunderstood the original intent,',
    'or that the variable should have been declared with `let`.',
    'Note: const only prevents reassignment, NOT mutation of object properties.',
  ].join(' '),
  badExample:  'const MAX = 100;\nMAX = 200; // TypeError at runtime!',
  goodExample: 'let MAX = 100;\nMAX = 200; // fine\n\n// or if it should not change:\nconst MAX = 100; // and never reassign',

  check({ ast }) {
    const warnings = [];

    walk(ast, {
      AssignmentExpression(path) {
        const left = path.node.left;
        if (!t.isIdentifier(left)) return;

        const binding = path.scope.getBinding(left.name);
        if (!binding) return;
        if (binding.kind !== 'const') return;

        // Skip the initialisation itself (VariableDeclarator)
        if (t.isVariableDeclarator(path.parent)) return;

        warnings.push({
          line:       path.node.loc?.start.line,
          confidence: 95,
          message:    `\`${left.name}\` is declared as \`const\` but you're reassigning it — this will throw a TypeError at runtime`,
          suggestion: `change the declaration to \`let ${left.name}\` if you need to reassign it`,
        });
      },

      UpdateExpression(path) {
        const arg = path.node.argument;
        if (!t.isIdentifier(arg)) return;

        const binding = path.scope.getBinding(arg.name);
        if (!binding || binding.kind !== 'const') return;

        warnings.push({
          line:       path.node.loc?.start.line,
          confidence: 95,
          message:    `\`${path.node.operator}\` on \`${arg.name}\` — but \`${arg.name}\` is a \`const\`, this will throw at runtime`,
          suggestion: `declare \`${arg.name}\` with \`let\` instead if you need to mutate it`,
        });
      },
    });

    return warnings;
  },
};
