'use strict';

const t = require('@babel/types');
const { walk } = require('../../parser/traversal');

module.exports = {
  id:              'accidental-assignment',
  description:     'Detects assignments used as conditions (likely meant to be comparisons)',
  defaultSeverity: 'high',
  explanation: [
    'You used = (assignment) where you probably meant === (comparison).',
    'This is a classic typo that evaluates to the assigned value,',
    'which is almost always truthy or always falsy.',
    'The condition will behave unexpectedly every time.',
  ].join(' '),
  badExample:  'if (user.role = "admin") {\n  // always true! you assigned, not compared\n}',
  goodExample: 'if (user.role === "admin") {\n  // comparison — correct\n}',

  check({ ast }) {
    const warnings = [];

    // Nodes that legally accept assignments in their test
    const CONDITION_PARENTS = [
      'IfStatement',
      'WhileStatement',
      'DoWhileStatement',
      'ForStatement',
      'ConditionalExpression',
    ];

    walk(ast, {
      AssignmentExpression(path) {
        const parentType = path.parent?.type;
        if (!CONDITION_PARENTS.includes(parentType)) return;

        // Intentional pattern: ((x = getValue())) — double parens signals intent
        if (path.node.extra?.parenthesized) return;

        const node  = path.node;
        const left  = node.left;

        // Build a human-readable description of the assignment
        let desc = 'a value';
        if (t.isIdentifier(left)) desc = `\`${left.name}\``;
        else if (t.isMemberExpression(left) && t.isIdentifier(left.property)) desc = `\`${left.property.name}\``;

        warnings.push({
          line:       node.loc?.start.line,
          column:     node.loc?.start.column,
          confidence: 88,
          message:    `assignment to ${desc} used as a condition — did you mean \`===\` instead of \`=\`?`,
          suggestion: 'change `=` to `===` if this is a comparison, or wrap in extra parens `(( ))` if assignment is intentional',
        });
      },
    });

    return warnings;
  },
};
