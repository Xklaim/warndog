'use strict';

const t = require('@babel/types');
const { walk } = require('../../parser/traversal');

const ALWAYS_TRUTHY_PATTERNS = [
  (node) => t.isUnaryExpression(node) && node.operator === 'typeof',
  (node) => t.isArrayExpression(node),
  (node) => t.isObjectExpression(node),
  (node) => t.isStringLiteral(node) && node.value.length > 0,
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
    'A condition always evaluates to the same boolean value.',
    'Common cases: typeof always returns a string, [] is truthy, and {} is truthy.',
    'This usually means dead code or a condition that does not reflect what you meant.',
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
      WhileStatement(path) {
        checkNode(path.node.test, path.node.test?.loc?.start.line, warnings);
      },
      DoWhileStatement(path) {
        checkNode(path.node.test, path.node.test?.loc?.start.line, warnings);
      },
      ForStatement(path) {
        checkNode(path.node.test, path.node.test?.loc?.start.line, warnings);
      },
    });

    return warnings;
  },
};

function checkNode(node, line, warnings) {
  if (!node) return;

  if (ALWAYS_TRUTHY_PATTERNS.some((pattern) => pattern(node))) {
    const desc = describeNode(node);
    warnings.push({
      line,
      confidence: 80,
      message:    `this condition (\`${desc}\`) is always truthy - the else branch will never run`,
      suggestion: 'did you mean to compare to a specific value instead?',
    });
    return;
  }

  if (ALWAYS_FALSY_PATTERNS.some((pattern) => pattern(node))) {
    const desc = describeNode(node);
    warnings.push({
      line,
      confidence: 85,
      message:    `this condition (\`${desc}\`) is always falsy - the if block will never run`,
      suggestion: 'this looks like dead code - verify your intent',
    });
  }
}

function describeNode(node) {
  if (t.isStringLiteral(node)) return `"${node.value}"`;
  if (t.isNumericLiteral(node)) return String(node.value);
  if (t.isNullLiteral(node)) return 'null';
  if (t.isBooleanLiteral(node)) return String(node.value);
  if (t.isIdentifier(node)) return node.name;
  if (t.isArrayExpression(node)) return '[]';
  if (t.isObjectExpression(node)) return '{}';
  if (t.isUnaryExpression(node) && node.operator === 'typeof') return 'typeof ...';
  return node.type;
}
