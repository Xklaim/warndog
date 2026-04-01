'use strict';

const t = require('@babel/types');
const { walk } = require('../../src/parser/traversal');
const { createPlugin, createRule } = require('../../src/plugins');

// ──────────────────────────────────────────────
// Rule: setState inside render / infinite loops
// ──────────────────────────────────────────────
const setStateInRender = createRule({
  id:              'react/setstate-in-render',
  description:     'Calling setState during render causes an infinite re-render loop',
  defaultSeverity: 'critical',
  explanation: [
    'Calling setState (or a state setter from useState) directly inside the render body',
    'causes an infinite loop: render → setState → re-render → setState → ...',
    'React will quickly hit the maximum update depth and crash with an error.',
  ].join(' '),
  badExample:  'function MyComponent() {\n  const [count, setCount] = useState(0);\n  setCount(1); // ← directly in render body!\n  return <div>{count}</div>;\n}',
  goodExample: 'function MyComponent() {\n  const [count, setCount] = useState(0);\n  useEffect(() => { setCount(1); }, []); // inside an effect\n  return <div>{count}</div>;\n}',

  check({ ast }) {
    const warnings = [];

    walk(ast, {
      'FunctionDeclaration|FunctionExpression|ArrowFunctionExpression'(path) {
        // Heuristic: component name starts with uppercase
        const name = getComponentName(path);
        if (!name || !/^[A-Z]/.test(name)) return;

        // Check if it returns JSX
        let returnsJSX = false;
        path.traverse({
          ReturnStatement(ret) {
            if (
              t.isJSXElement(ret.node.argument) ||
              t.isJSXFragment(ret.node.argument)
            ) returnsJSX = true;
          },
        });
        if (!returnsJSX) return;

        // Find state setters from useState destructuring
        const setters = new Set();
        path.traverse({
          VariableDeclarator(vd) {
            const init = vd.node.init;
            if (!t.isCallExpression(init)) return;
            const callee = init.callee;
            if (!t.isIdentifier(callee) || callee.name !== 'useState') return;
            const id = vd.node.id;
            if (t.isArrayPattern(id) && id.elements[1] && t.isIdentifier(id.elements[1])) {
              setters.add(id.elements[1].name);
            }
          },
        });

        if (setters.size === 0) return;

        // Find direct calls to setters not inside useEffect/useCallback/event handlers
        path.traverse({
          CallExpression(callPath) {
            const callee = callPath.node.callee;
            if (!t.isIdentifier(callee) || !setters.has(callee.name)) return;

            // Allow if inside useEffect, useCallback, useMemo, event handler
            if (isInsideSafeContext(callPath)) return;

            warnings.push({
              line:       callPath.node.loc?.start.line,
              confidence: 85,
              message:    `\`${callee.name}()\` called directly in render body — this will cause an infinite re-render loop`,
              suggestion: 'move this inside a `useEffect(() => { ... }, [])` or an event handler',
            });
          },
        });
      },
    });

    return warnings;
  },
});

// ──────────────────────────────────────────────
// Rule: useEffect missing dependencies
// ──────────────────────────────────────────────
const useEffectMissingDeps = createRule({
  id:              'react/useeffect-missing-deps',
  description:     'useEffect with no dependency array runs on every render',
  defaultSeverity: 'medium',
  explanation: [
    'A useEffect without a second argument (the dependency array) runs after EVERY render.',
    'This is almost never intentional and causes performance issues.',
    'Pass an empty array [] to run only once, or list the values it depends on.',
  ].join(' '),
  badExample:  'useEffect(() => {\n  fetchData(); // runs on every render!\n});',
  goodExample: 'useEffect(() => {\n  fetchData();\n}, []); // runs only once on mount',

  check({ ast }) {
    const warnings = [];

    walk(ast, {
      CallExpression(path) {
        const callee = path.node.callee;
        if (!t.isIdentifier(callee) || callee.name !== 'useEffect') return;

        const args = path.node.arguments;
        if (args.length === 0) return;

        // If only 1 arg (the callback), no deps array provided
        if (args.length === 1) {
          warnings.push({
            line:       path.node.loc?.start.line,
            confidence: 80,
            message:    '`useEffect` has no dependency array — it will re-run on every single render',
            suggestion: 'add `[]` as the second argument to run once, or list specific dependencies',
          });
        }
      },
    });

    return warnings;
  },
});

module.exports = createPlugin({
  name:  'warndog-plugin-react',
  rules: [setStateInRender, useEffectMissingDeps],
});

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function getComponentName(path) {
  const node = path.node;
  if (t.isFunctionDeclaration(node) && node.id) return node.id.name;
  const parent = path.parent;
  if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) return parent.id.name;
  return null;
}

const SAFE_HOOKS = new Set(['useEffect', 'useCallback', 'useMemo', 'useLayoutEffect']);

function isInsideSafeContext(path) {
  let cur = path.parentPath;
  while (cur) {
    const node = cur.node;
    // Inside useEffect, useCallback, etc.
    if (t.isCallExpression(node)) {
      const callee = node.callee;
      if (t.isIdentifier(callee) && SAFE_HOOKS.has(callee.name)) return true;
    }
    // Inside an event handler (function/arrow passed as prop)
    if (
      (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) &&
      cur.parentPath && t.isJSXExpressionContainer(cur.parentPath.node)
    ) return true;

    cur = cur.parentPath;
  }
  return false;
}
