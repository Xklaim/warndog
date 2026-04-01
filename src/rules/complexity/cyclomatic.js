'use strict';

const t = require('@babel/types');
const { walk } = require('../../parser/traversal');

// Decision points that increase cyclomatic complexity
const DECISION_NODES = new Set([
  'IfStatement',
  'ConditionalExpression',
  'WhileStatement',
  'DoWhileStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'CatchClause',
  'SwitchCase',
  'LogicalExpression', // && and || add branching
]);

module.exports = {
  id:              'cyclomatic-complexity',
  description:     'Functions with cyclomatic complexity above threshold are hard to test and reason about',
  defaultSeverity: 'medium',
  explanation: [
    'Cyclomatic complexity counts the number of independent paths through a function.',
    'High complexity means: more bugs, harder testing, more cognitive load for readers.',
    'Functions above 10 are considered risky; above 20 are considered unmaintainable.',
    'Break complex functions into smaller, single-purpose helpers.',
  ].join(' '),
  badExample:  '// A function with 15 if/else branches, loops, and ternaries\nfunction processOrder(order) {\n  if (order.type === "a") { if (order.status...) { ... } }\n  // 14 more branches...\n}',
  goodExample: '// Split into focused helpers:\nfunction validateOrder(order) { ... }\nfunction applyDiscount(order) { ... }\nfunction notifyUser(order) { ... }',

  check({ ast, config }) {
    const warnings  = [];
    const threshold = config?.complexity?.cyclomaticThreshold ?? 10;

    walk(ast, {
      'FunctionDeclaration|FunctionExpression|ArrowFunctionExpression'(path) {
        const node = path.node;
        if (!node.body || !t.isBlockStatement(node.body)) return;

        const complexity = calculateComplexity(path);
        if (complexity <= threshold) return;

        const name = getFunctionName(path);
        const line = node.loc?.start.line;

        const severity = complexity > 20 ? 'high' : 'medium';
        warnings.push({
          line,
          severity,
          confidence: 90,
          message:    `\`${name}\` has cyclomatic complexity of ${complexity} (threshold: ${threshold}) — this function is doing too much`,
          suggestion: `break \`${name}\` into smaller focused functions; aim for complexity ≤ ${threshold}`,
        });
      },
    });

    return warnings;
  },
};

function calculateComplexity(funcPath) {
  let complexity = 1; // baseline

  funcPath.traverse({
    IfStatement()          { complexity++; },
    ConditionalExpression(){ complexity++; },
    WhileStatement()       { complexity++; },
    DoWhileStatement()     { complexity++; },
    ForStatement()         { complexity++; },
    ForInStatement()       { complexity++; },
    ForOfStatement()       { complexity++; },
    CatchClause()          { complexity++; },
    SwitchCase(path)       {
      // Only count non-default cases
      if (path.node.test !== null) complexity++;
    },
    LogicalExpression(path) {
      if (path.node.operator === '&&' || path.node.operator === '||') complexity++;
    },
    NullishCoalescingOperator() { complexity++; },
  });

  return complexity;
}

function getFunctionName(path) {
  const node = path.node;
  if (t.isFunctionDeclaration(node) && node.id) return node.id.name + '()';
  const parent = path.parent;
  if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) return parent.id.name + '()';
  if (t.isObjectProperty(parent) && t.isIdentifier(parent.key)) return parent.key.name + '()';
  if (t.isAssignmentExpression(parent) && t.isIdentifier(parent.left)) return parent.left.name + '()';
  if (t.isClassMethod(parent) && t.isIdentifier(parent.key)) return parent.key.name + '()';
  return '(anonymous function)';
}
