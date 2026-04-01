'use strict';

const t = require('@babel/types');
const { walk } = require('../../parser/traversal');

module.exports = {
  id:              'impossible-condition',
  description:     'Detects conditions that can never be true or always evaluate the same way',
  defaultSeverity: 'high',
  explanation: [
    'This condition looks like it can never be true (or never be false).',
    'Common causes: checking typeof after already confirming existence,',
    'comparing a value to itself, or using the wrong variable name.',
    'Dead code blocks waste CPU and mislead future readers.',
  ].join(' '),
  badExample:  'if (typeof user !== "undefined" && typeof user === "undefined") {\n  // this block NEVER runs\n}',
  goodExample: 'if (user != null) {\n  // clear intent\n}',

  check({ ast }) {
    const warnings = [];

    walk(ast, {
      // Pattern 1: typeof x === 'undefined' && x.something
      LogicalExpression(path) {
        const node = path.node;
        if (node.operator !== '&&') return;

        const left  = node.left;
        const right = node.right;

        // left: typeof x !== 'undefined' or typeof x === 'string' etc.
        // right: typeof x === 'undefined' — contradiction
        if (
          t.isBinaryExpression(left) &&
          t.isBinaryExpression(right) &&
          t.isUnaryExpression(left.operand) &&
          left.operand?.operator === 'typeof' &&
          t.isUnaryExpression(right.operand) &&
          right.operand?.operator === 'typeof'
        ) {
          const leftArg  = left.operand?.argument;
          const rightArg = right.operand?.argument;
          if (
            leftArg && rightArg &&
            t.isIdentifier(leftArg) && t.isIdentifier(rightArg) &&
            leftArg.name === rightArg.name
          ) {
            const leftVal  = left.right?.value;
            const rightVal = right.right?.value;
            if (
              leftVal !== undefined && rightVal !== undefined &&
              leftVal !== rightVal &&
              left.operator  === '!==' &&
              right.operator === '==='
            ) {
              warnings.push({
                line:       node.loc?.start.line,
                confidence: 88,
                message:    `this condition looks impossible… it checks typeof as both defined and undefined simultaneously`,
                suggestion: `remove one of the redundant typeof checks`,
              });
            }
          }
        }
      },

      // Pattern 2: x === x (comparing identifier to itself)
      BinaryExpression(path) {
        const node = path.node;
        if (!['===', '==', '!==', '!='].includes(node.operator)) return;

        if (
          t.isIdentifier(node.left) &&
          t.isIdentifier(node.right) &&
          node.left.name === node.right.name
        ) {
          const op   = node.operator;
          const kind = (op === '===' || op === '==') ? 'always true' : 'always false';
          warnings.push({
            line:       node.loc?.start.line,
            confidence: 95,
            message:    `\`${node.left.name} ${op} ${node.right.name}\` is ${kind} — you're comparing a variable to itself`,
            suggestion: `did you mean to compare to a different variable or value?`,
          });
        }
      },

      // Pattern 3: if (true) / if (false) / if (1) / if (0) literal conditions
      IfStatement(path) {
        const test = path.node.test;

        if (t.isBooleanLiteral(test)) {
          const kind = test.value ? 'always runs' : 'never runs';
          warnings.push({
            line:       test.loc?.start.line,
            confidence: 99,
            message:    `\`if (${test.value})\` is a literal — this block ${kind}`,
            suggestion: test.value
              ? `remove the if() wrapper and keep the body`
              : `this dead code block can be deleted entirely`,
          });
        }

        if (t.isNumericLiteral(test)) {
          const kind = test.value !== 0 ? 'always runs' : 'never runs';
          warnings.push({
            line:       test.loc?.start.line,
            confidence: 97,
            message:    `\`if (${test.value})\` is a numeric literal — this block ${kind}`,
            suggestion: `replace with an explicit boolean condition`,
          });
        }
      },

      // Pattern 4: Contradictory null check — if (x && x === null)
      // (x is truthy on left, then checked for null on right — impossible)
      MemberExpression(path) {
        // Walk up to find if we're in: x && (x === null)
        const parent = path.parentPath;
        if (!parent || !t.isLogicalExpression(parent.node)) return;
        if (parent.node.operator !== '&&') return;

        const logical = parent.node;
        // left side: identifier  right side: identifier === null
        if (
          t.isIdentifier(logical.left) &&
          t.isBinaryExpression(logical.right) &&
          t.isIdentifier(logical.right.left) &&
          logical.left.name === logical.right.left.name &&
          t.isNullLiteral(logical.right.right) &&
          logical.right.operator === '==='
        ) {
          warnings.push({
            line:       logical.loc?.start.line,
            confidence: 85,
            message:    `\`${logical.left.name} && ${logical.left.name} === null\` — if the left side is truthy, the right can never be null`,
            suggestion: `the null check is unreachable; check your logic`,
          });
        }
      },
    });

    return warnings;
  },
};
