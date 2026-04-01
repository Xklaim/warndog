'use strict';

/**
 * Lightweight AST traversal helpers so rules don't need to import @babel/traverse directly.
 * Provides a visitor pattern with scope tracking.
 */

const traverse = require('@babel/traverse').default;
const t        = require('@babel/types');

/**
 * Walk the AST with a standard visitor object.
 * Wraps @babel/traverse for convenience.
 */
function walk(ast, visitors) {
  traverse(ast, visitors);
}

/**
 * Collect all nodes of a given type in the AST.
 * @param {object} ast
 * @param {string|string[]} types
 * @returns {object[]} nodes
 */
function collect(ast, types) {
  const typeSet = new Set(Array.isArray(types) ? types : [types]);
  const found   = [];
  traverse(ast, {
    enter(path) {
      if (typeSet.has(path.node.type)) found.push(path);
    },
  });
  return found;
}

/**
 * Returns true if a node is inside an async function.
 */
function isInsideAsync(path) {
  let current = path.parentPath;
  while (current) {
    const node = current.node;
    if (
      (t.isFunction(node) || t.isArrowFunctionExpression(node)) &&
      node.async
    ) return true;
    if (t.isFunction(node) || t.isArrowFunctionExpression(node)) return false;
    current = current.parentPath;
  }
  return false;
}

/**
 * Returns true if an expression is inside an await expression.
 */
function isAwaited(path) {
  return (
    t.isAwaitExpression(path.parent) ||
    (path.parentPath && t.isAwaitExpression(path.parentPath.parent))
  );
}

/**
 * Returns true if the expression's result is used (assigned, returned, etc).
 */
function isResultUsed(path) {
  const parent = path.parent;
  return (
    t.isVariableDeclarator(parent) ||
    t.isAssignmentExpression(parent) ||
    t.isReturnStatement(parent)      ||
    t.isCallExpression(parent)       ||
    t.isAwaitExpression(parent)      ||
    t.isConditionalExpression(parent)||
    t.isLogicalExpression(parent)    ||
    t.isArrayExpression(parent)      ||
    t.isObjectProperty(parent)       ||
    t.isTemplateLiteral(parent)      ||
    t.isJSXExpressionContainer(parent)
  );
}

/**
 * Walk up the path chain looking for the first ancestor matching a type.
 */
function findAncestor(path, type) {
  let current = path.parentPath;
  while (current) {
    if (current.node.type === type) return current;
    current = current.parentPath;
  }
  return null;
}

/**
 * Get all identifiers in scope at a given path.
 */
function getScopeBindings(path) {
  return path.scope?.bindings ?? {};
}

/**
 * Returns the function node that immediately contains this path (or null).
 */
function getEnclosingFunction(path) {
  let current = path.parentPath;
  while (current) {
    if (t.isFunction(current.node) || t.isArrowFunctionExpression(current.node)) {
      return current;
    }
    current = current.parentPath;
  }
  return null;
}

/**
 * Count the nesting depth of a node (number of block-level ancestors).
 */
function nestingDepth(path) {
  let depth = 0;
  let current = path.parentPath;
  while (current) {
    if (
      t.isBlockStatement(current.node) ||
      t.isIfStatement(current.node)    ||
      t.isForStatement(current.node)   ||
      t.isWhileStatement(current.node) ||
      t.isTryStatement(current.node)   ||
      t.isSwitchStatement(current.node)
    ) depth++;
    current = current.parentPath;
  }
  return depth;
}

/**
 * Extract the callee name from a CallExpression.
 * Returns null for complex callees.
 */
function getCalleeName(node) {
  if (!t.isCallExpression(node)) return null;
  const callee = node.callee;
  if (t.isIdentifier(callee))     return callee.name;
  if (t.isMemberExpression(callee)) {
    const obj  = callee.object;
    const prop = callee.property;
    const objName  = t.isIdentifier(obj)  ? obj.name  : null;
    const propName = t.isIdentifier(prop) ? prop.name : null;
    if (objName && propName) return `${objName}.${propName}`;
  }
  return null;
}

/**
 * Heuristic: is this call expression likely to return a Promise?
 */
const KNOWN_ASYNC_NAMES = new Set([
  'fetch', 'axios', 'axios.get', 'axios.post', 'axios.put', 'axios.delete', 'axios.patch',
  'readFile', 'writeFile', 'readdir',
  'fs.readFile', 'fs.writeFile', 'fs.readdir', 'fs.unlink', 'fs.stat',
  'connect', 'query', 'find', 'findOne', 'findById', 'save', 'create', 'update', 'delete',
  'sendEmail', 'sendMail',
  'mongoose.connect', 'db.query',
  'redis.get', 'redis.set',
  'bcrypt.hash', 'bcrypt.compare',
  'jwt.verify', 'jwt.sign',
  'crypto.subtle.digest',
]);

const COMMON_SYNC_NAMES = new Set([
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'queueMicrotask',
]);

const COMMON_SYNC_MEMBER_NAMES = new Set([
  'get',
  'set',
  'delete',
  'has',
  'add',
  'clear',
  'post',
  'put',
  'patch',
  'use',
  'listen',
  'all',
  'route',
  'on',
  'off',
  'emit',
]);

function isLikelyAsync(callNode) {
  const name = getCalleeName(callNode);
  if (!name) return false;
  // Exact match
  if (KNOWN_ASYNC_NAMES.has(name)) return true;
  if (COMMON_SYNC_NAMES.has(name)) return false;
  if (
    t.isMemberExpression(callNode.callee) &&
    t.isIdentifier(callNode.callee.property) &&
    COMMON_SYNC_MEMBER_NAMES.has(callNode.callee.property.name)
  ) {
    return false;
  }
  // Heuristic suffix match
  return /\b(fetch|load|save|create|update|remove|send|connect|query|find|read|write|upload|download|request|sign|verify|hash|compare|publish|subscribe)\b/i.test(name);
}

module.exports = {
  walk,
  collect,
  isInsideAsync,
  isAwaited,
  isResultUsed,
  findAncestor,
  getScopeBindings,
  getEnclosingFunction,
  nestingDepth,
  getCalleeName,
  isLikelyAsync,
};
