'use strict';

const t = require('@babel/types');
const { walk, isLikelyAsync, getCalleeName } = require('../../parser/traversal');

/** @type {import('../index').Rule} */
module.exports = {
  id:              'silent-promise',
  description:     'Detects Promise chains that silently swallow errors (no .catch())',
  defaultSeverity: 'medium',
  explanation: [
    'You have a .then() chain without a .catch().',
    'If the promise rejects, the error will be silently swallowed.',
    'This causes invisible failures that are incredibly hard to debug.',
    'Node.js will emit an UnhandledPromiseRejection, which may crash your process.',
  ].join(' '),
  badExample:  'fetch("/api/data")\n  .then(res => res.json())\n  .then(data => use(data)); // ← what if it rejects?',
  goodExample: 'fetch("/api/data")\n  .then(res => res.json())\n  .then(data => use(data))\n  .catch(err => console.error("fetch failed:", err));',

  check({ ast }) {
    const warnings = [];

    walk(ast, {
      ExpressionStatement(path) {
        const expr = path.node.expression;

        // Look for call chains: x.then(...) at the statement level
        if (!isThenChain(expr)) return;

        // Walk the chain to see if .catch() appears anywhere
        if (chainHasCatch(expr)) return;

        // Walk the chain to see if .finally() appears (sometimes used as catch)
        if (chainHasFinally(expr)) return;

        // Find the root of the chain to report on
        const root = chainRoot(expr);
        const rootName = root ? getCalleeName(root) : null;

        // Filter: only report if the root looks like an async call
        if (root && !isLikelyAsync(root) && !isPromiseCall(root)) return;

        const line = expr.loc?.start.line;
        warnings.push({
          line,
          confidence: 82,
          message:    `this promise chain has no \`.catch()\`… errors here will disappear silently`,
          suggestion: `add \`.catch(err => { /* handle error */ })\` at the end of this chain`,
        });
      },
    });

    return warnings;
  },
};

function isThenChain(node) {
  if (!t.isCallExpression(node)) return false;
  const callee = node.callee;
  if (!t.isMemberExpression(callee)) return false;
  const prop = callee.property;
  return t.isIdentifier(prop) && prop.name === 'then';
}

function chainHasCatch(node) {
  if (!t.isCallExpression(node)) return false;
  const callee = node.callee;
  if (!t.isMemberExpression(callee)) return false;
  const prop = callee.property;
  if (t.isIdentifier(prop) && prop.name === 'catch') return true;
  return chainHasCatch(callee.object);
}

function chainHasFinally(node) {
  if (!t.isCallExpression(node)) return false;
  const callee = node.callee;
  if (!t.isMemberExpression(callee)) return false;
  const prop = callee.property;
  if (t.isIdentifier(prop) && prop.name === 'finally') return true;
  return chainHasFinally(callee.object);
}

function chainRoot(node) {
  if (!t.isCallExpression(node)) return null;
  const callee = node.callee;
  if (!t.isMemberExpression(callee)) return node;
  const prop = callee.property;
  if (t.isIdentifier(prop) && ['then', 'catch', 'finally'].includes(prop.name)) {
    return chainRoot(callee.object);
  }
  return node;
}

function isPromiseCall(node) {
  if (!t.isCallExpression(node)) return false;
  const callee = node.callee;
  if (t.isMemberExpression(callee)) {
    const obj  = callee.object;
    const prop = callee.property;
    if (t.isIdentifier(obj) && obj.name === 'Promise') return true;
  }
  return false;
}
