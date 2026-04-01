'use strict';

const t = require('@babel/types');
const { walk } = require('../../parser/traversal');

// Combinations of types where == behaves unexpectedly
const RISKY_PAIRS = [
  // null == undefined is true, but so is null == false — dangerous
  { left: isNullOrUndefined, right: isFalsyLiteral,    msg: 'null/undefined compared with == to a falsy literal — null == false is false, null == 0 is false, null == "" is false — use === for clarity' },
  // comparing number string with ==
  { left: isStringLiteral,   right: isNumericLiteral,  msg: 'string compared with == to a number — type coercion may give unexpected results: "0" == false is true' },
  // comparing boolean with ==
  { left: isBooleanLiteral,  right: isStringOrNumber,  msg: 'boolean compared with == to a string/number — this is almost never what you want; use === instead' },
];

module.exports = {
  id:              'risky-equality',
  description:     'Loose equality (==) used in ways where type coercion produces surprising results',
  defaultSeverity: 'low',
  explanation: [
    'JavaScript\'s == operator performs type coercion, which has notoriously surprising rules.',
    'For example: null == undefined → true, but null == false → false,',
    '"0" == false → true, but "0" == null → false.',
    'When in doubt, always use === for explicit intent.',
  ].join(' '),
  badExample:  'if (value == null) { ... } // is this checking null OR undefined?\nif (count == "0") { ... }  // coercion — risky',
  goodExample: 'if (value === null || value === undefined) { ... }\n// OR the intentional null-check idiom:\nif (value == null) { ... } // acceptable ONLY for null|undefined check',

  check({ ast }) {
    const warnings = [];

    walk(ast, {
      BinaryExpression(path) {
        const { operator, left, right } = path.node;
        if (operator !== '==' && operator !== '!=') return;

        // Special case: x == null / x != null is an accepted idiom for null|undefined
        if (isNullOrUndefined(left) || isNullOrUndefined(right)) {
          // Only warn if the OTHER side is not an identifier (direct variable check is fine)
          const other = isNullOrUndefined(left) ? right : left;
          if (t.isIdentifier(other) || t.isMemberExpression(other)) return; // acceptable idiom
        }

        for (const pair of RISKY_PAIRS) {
          if (
            (pair.left(left) && pair.right(right)) ||
            (pair.left(right) && pair.right(left))
          ) {
            warnings.push({
              line:       path.node.loc?.start.line,
              confidence: 65,
              message:    `risky \`${operator}\` comparison: ${pair.msg}`,
              suggestion: `use \`${operator === '==' ? '===' : '!=='}\` unless type coercion is explicitly intended`,
            });
            return;
          }
        }

        // General: using == on complex expressions
        if (
          (t.isCallExpression(left) || t.isCallExpression(right)) &&
          !t.isNullLiteral(left) && !t.isNullLiteral(right)
        ) {
          warnings.push({
            line:       path.node.loc?.start.line,
            confidence: 55,
            message:    `loose \`${operator}\` used with a function call result — type coercion may hide bugs`,
            suggestion: `use \`${operator === '==' ? '===' : '!=='}\` for explicit type-safe comparison`,
          });
        }
      },
    });

    return warnings;
  },
};

function isNullOrUndefined(node) {
  return t.isNullLiteral(node) || (t.isIdentifier(node) && node.name === 'undefined');
}
function isFalsyLiteral(node) {
  return (t.isNumericLiteral(node) && node.value === 0) ||
         (t.isStringLiteral(node) && node.value === '') ||
         (t.isBooleanLiteral(node) && node.value === false);
}
function isStringLiteral(node)  { return t.isStringLiteral(node); }
function isNumericLiteral(node) { return t.isNumericLiteral(node); }
function isBooleanLiteral(node) { return t.isBooleanLiteral(node); }
function isStringOrNumber(node) { return t.isStringLiteral(node) || t.isNumericLiteral(node); }
