'use strict';

const t = require('@babel/types');
const { walk } = require('../../parser/traversal');

module.exports = {
  id:              'inconsistent-return',
  description:     'Functions that sometimes return a value and sometimes return nothing',
  defaultSeverity: 'medium',
  explanation: [
    'This function has return paths that return a value AND paths that return nothing (undefined).',
    'Callers cannot know if they will receive a value or undefined.',
    'This is a frequent source of "cannot read property of undefined" errors.',
  ].join(' '),
  badExample:  'function getUser(id) {\n  if (id > 0) return db.find(id); // returns something\n  // ← implicit return undefined\n}',
  goodExample: 'function getUser(id) {\n  if (id > 0) return db.find(id);\n  return null; // explicit — caller knows\n}',

  check({ ast }) {
    const warnings = [];

    walk(ast, {
      'FunctionDeclaration|FunctionExpression|ArrowFunctionExpression': checkFunction,
    });

    function checkFunction(path) {
      const node = path.node;

      // Arrow functions with expression body always return
      if (t.isArrowFunctionExpression(node) && !t.isBlockStatement(node.body)) return;
      if (!node.body || !t.isBlockStatement(node.body)) return;

      // Skip constructor, setters, generators
      if (node.kind === 'constructor' || node.kind === 'set' || node.generator) return;
      if (isReactEffectCallback(path)) return;

      const returns = collectDirectReturns(path);
      if (returns.length === 0) return;

      const withValue    = returns.filter(r => r.argument != null);
      const withoutValue = returns.filter(r => r.argument == null);

      // If there are both kinds AND there's no explicit exhaustive coverage
      if (withValue.length > 0 && withoutValue.length > 0) {
        const funcName = getFunctionName(path);
        const line     = node.loc?.start.line;

        warnings.push({
          line,
          confidence: 72,
          message:    `\`${funcName}\` has inconsistent return paths — sometimes returns a value, sometimes returns nothing (undefined)`,
          suggestion: 'make all code paths explicitly return a value, or return `null` where no value is intended',
        });
      }

      // Also detect: function body with statements but NO return at all
      // when function is named like a getter (getX, fetchX, loadX, findX)
      const name = getFunctionName(path);
      if (
        returns.length === 0 &&
        /^(get|fetch|load|find|retrieve|read|compute|calculate|build|create|make)/i.test(name)
      ) {
        warnings.push({
          line:       node.loc?.start.line,
          confidence: 55,
          message:    `\`${name}\` looks like it should return a value but has no return statement`,
          suggestion: 'if this function computes something, make sure to return it',
        });
      }
    }

    return warnings;
  },
};

function collectDirectReturns(funcPath) {
  const returns = [];
  funcPath.traverse({
    ReturnStatement(innerPath) {
      // Only collect returns that are directly inside this function
      // (not inside nested functions)
      if (getEnclosingFunctionPath(innerPath) === funcPath) {
        returns.push(innerPath.node);
      }
    },
  });
  return returns;
}

function getEnclosingFunctionPath(path) {
  let cur = path.parentPath;
  while (cur) {
    if (
      t.isFunctionDeclaration(cur.node) ||
      t.isFunctionExpression(cur.node) ||
      t.isArrowFunctionExpression(cur.node)
    ) return cur;
    cur = cur.parentPath;
  }
  return null;
}

function getFunctionName(path) {
  const node = path.node;
  if (t.isFunctionDeclaration(node) && node.id) return node.id.name;
  const parent = path.parent;
  if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) return parent.id.name;
  if (t.isObjectProperty(parent) && t.isIdentifier(parent.key)) return parent.key.name;
  if (t.isAssignmentExpression(parent) && t.isIdentifier(parent.left)) return parent.left.name;
  return '(anonymous)';
}

function isReactEffectCallback(path) {
  const parent = path.parentPath;
  if (!parent?.isCallExpression()) return false;
  if (parent.node.arguments[0] !== path.node) return false;

  const callee = parent.node.callee;
  if (t.isIdentifier(callee)) {
    return ['useEffect', 'useLayoutEffect', 'useInsertionEffect'].includes(callee.name);
  }

  if (
    t.isMemberExpression(callee) &&
    t.isIdentifier(callee.property)
  ) {
    return ['useEffect', 'useLayoutEffect', 'useInsertionEffect'].includes(callee.property.name);
  }

  return false;
}
