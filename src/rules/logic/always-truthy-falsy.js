'use strict';

const t = require('@babel/types');
const { walk } = require('../../parser/traversal');

const ALWAYS_TRUTHY_PATTERNS = [
  // typeof always returns a string — never null/undefined/false
  (node) => t.isUnaryExpression(node) && node.operator === 'typeof',
  // Array literals are always truthy
  (node) => t.isArrayExpression(node),
  // Object literals are always truthy
  (node) => t.isObjectExpression(node),
  // Non-empty string literals
  (node) => t.isStringLiteral(node) && node.value.length > 0,
  // Non-zero numeric literals
  (node) => t.isNumericLiteral(node) && node.value !== 0,
];

const ALWAYS_FALSY_PATTERNS = [
  (node) => t.isNullLiteral(node),
  (node) => t.isNumericLiteral(node) && node.value === 0,
  (node) => t.isStringLiteral(node) && node.value === '',
  (node) => t.isBooleanLiteral(node) && node.value === false,
  (node) => t.isIdentifier(node) && node.name === 'undefined',
  (node) => t.isIdentifier(node) && node.name === 'NaN',
];

module.exports = {
  id:              'always-truthy-falsy',
  description:     'Detects conditions that always evaluate truthy or always falsy',
  defaultSeverity: 'medium',
  explanation: [
    'One side of this condition always has the same boolean value.',
    'Common cases: typeof always returns a string (truthy),',
    'array literals [] are always truthy even when "empty",',
    'and comparing to NaN with == never works as expected.',
  ].join(' '),
  badExample:  '// Array literal is ALWAYS truthy:\nif ([]) { /* always runs */ }\n\n// typeof is ALWAYS a string:\nif (typeof x) { /* always runs */ }',
  goodExample: 'if (Array.isArray(x) && x.length > 0) { ... }\nif (typeof x !== "undefined") { ... }',

  check({ ast }) {
    const warnings = [];

    walk(ast, {
      IfStatement(path) {
        checkNode(path.node.test, path.node.test?.loc?.start.line, warnings);
      },
      ConditionalExpression(path) {
        checkNode(path.node.test, path.node.test?.loc?.start.line, warnings);
      },
      LogicalExpression(path) {
        // Don't double-report child nodes already reported by IfStatement visitor
        const { left, right, operator } = path.node;

        for (const side of [left, right]) {
          if (ALWAYS_TRUTHY_PATTERNS.some(p => p(side))) {
            const desc = describeNode(side);
            warnings.push({
              line:       side.loc?.start.line,
              confidence: 75,
              message:    `\`${desc}\` in a logical \`${operator}\` expression is always truthy — this may not do what you expect`,
              suggestion: `check whether you meant to compare the value rather than use it as a boolean`,
            });
          }
        }
      },
    });

    return warnings;
  },
};

function checkNode(node, line, warnings) {
  if (!node) return;

  if (ALWAYS_TRUTHY_PATTERNS.some(p => p(node))) {
    const desc = describeNode(node);
    warnings.push({
      line,
      confidence: 80,
      message:    `this condition (\`${desc}\`) is always truthy — the else branch will never run`,
      suggestion: `did you mean to compare to a specific value instead?`,
    });
    return;
  }

  if (ALWAYS_FALSY_PATTERNS.some(p => p(node))) {
    const desc = describeNode(node);
    warnings.push({
      line,
      confidence: 85,
      message:    `this condition (\`${desc}\`) is always falsy — the if block will never run`,
      suggestion: `this looks like dead code — verify your intent`,
    });
  }
}

function describeNode(node) {
  if (t.isStringLiteral(node))  return `"${node.value}"`;
  if (t.isNumericLiteral(node)) return String(node.value);
  if (t.isNullLiteral(node))    return 'null';
  if (t.isBooleanLiteral(node)) return String(node.value);
  if (t.isIdentifier(node))     return node.name;
  if (t.isArrayExpression(node))  return `[]`;
  if (t.isObjectExpression(node)) return `{}`;
  if (t.isUnaryExpression(node) && node.operator === 'typeof') return 'typeof ...';
  return node.type;
}
