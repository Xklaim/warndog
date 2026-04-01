'use strict';

const t = require('@babel/types');
const { walk } = require('../../parser/traversal');

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
    const warnings   = [];
    const threshold  = config?.complexity?.cyclomaticThreshold ?? 10;
    const reactBonus = config?.complexity?.reactCyclomaticBonus ?? 20;

    walk(ast, {
      'FunctionDeclaration|FunctionExpression|ArrowFunctionExpression'(path) {
        const node = path.node;
        if (!node.body || !t.isBlockStatement(node.body)) return;

        const complexity = calculateComplexity(path);
        const name = getFunctionName(path);
        const effectiveThreshold = isReactishFunction(path, name)
          ? threshold + reactBonus
          : threshold;

        if (complexity <= effectiveThreshold) return;

        const severity = complexity > effectiveThreshold + 10 ? 'high' : 'medium';
        warnings.push({
          line:       node.loc?.start.line,
          severity,
          confidence: 90,
          message:    `\`${name}\` has cyclomatic complexity of ${complexity} (threshold: ${effectiveThreshold}) - this function is doing too much`,
          suggestion: `break \`${name}\` into smaller focused functions; aim for complexity <= ${effectiveThreshold}`,
        });
      },
    });

    return warnings;
  },
};

function calculateComplexity(funcPath) {
  let complexity = 1;

  funcPath.traverse({
    IfStatement()           { complexity++; },
    ConditionalExpression() { complexity++; },
    WhileStatement()        { complexity++; },
    DoWhileStatement()      { complexity++; },
    ForStatement()          { complexity++; },
    ForInStatement()        { complexity++; },
    ForOfStatement()        { complexity++; },
    CatchClause()           { complexity++; },
    SwitchCase(path) {
      if (path.node.test !== null) complexity++;
    },
    LogicalExpression(path) {
      if (['&&', '||', '??'].includes(path.node.operator)) complexity++;
    },
  });

  return complexity;
}

function getFunctionName(path) {
  const node = path.node;
  if (t.isFunctionDeclaration(node) && node.id) return `${node.id.name}()`;
  const parent = path.parent;
  if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) return `${parent.id.name}()`;
  if (t.isObjectProperty(parent) && t.isIdentifier(parent.key)) return `${parent.key.name}()`;
  if (t.isAssignmentExpression(parent) && t.isIdentifier(parent.left)) return `${parent.left.name}()`;
  if (t.isClassMethod(parent) && t.isIdentifier(parent.key)) return `${parent.key.name}()`;
  return '(anonymous function)';
}

function isReactishFunction(path, name) {
  const bareName = name.replace(/\(\)$/, '');

  if (/^use[A-Z0-9]/.test(bareName)) return true;
  if (/^[A-Z]/.test(bareName)) return true;
  if (containsJsx(path)) return true;

  const parent = path.parentPath;
  if (!parent?.isCallExpression()) return false;
  if (parent.node.arguments[0] !== path.node) return false;

  const callee = parent.node.callee;
  if (t.isIdentifier(callee)) {
    return ['useCallback', 'useMemo', 'useEffect', 'useLayoutEffect', 'useInsertionEffect'].includes(callee.name);
  }

  if (
    t.isMemberExpression(callee) &&
    t.isIdentifier(callee.property)
  ) {
    return ['useCallback', 'useMemo', 'useEffect', 'useLayoutEffect', 'useInsertionEffect'].includes(callee.property.name);
  }

  return false;
}

function containsJsx(funcPath) {
  let found = false;

  funcPath.traverse({
    JSXElement(path) {
      found = true;
      path.stop();
    },
    JSXFragment(path) {
      found = true;
      path.stop();
    },
  });

  return found;
}
