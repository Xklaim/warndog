'use strict';

const t = require('@babel/types');
const { walk } = require('../../parser/traversal');

module.exports = {
  id:              'shadowed-variable',
  description:     'Variables declared in inner scopes that shadow outer scope variables',
  defaultSeverity: 'medium',
  explanation: [
    'A variable in an inner scope has the same name as one in an outer scope.',
    'Inside the inner scope, you can no longer access the outer variable.',
    'This is a silent bug: both variables exist, but the inner one wins.',
    'Readers of the code will assume they refer to the same thing — they do not.',
  ].join(' '),
  badExample:  'const user = getUser();\nfunction validate() {\n  const user = req.body; // shadows outer user!\n  if (user.id !== user.id) ... // which user??\n}',
  goodExample: 'const currentUser = getUser();\nfunction validate() {\n  const inputUser = req.body;\n}',

  check({ ast }) {
    const warnings = [];

    walk(ast, {
      // Check every variable declaration
      VariableDeclarator(path) {
        const idNode = path.node.id;
        if (!t.isIdentifier(idNode)) return; // skip destructuring for now

        const name  = idNode.name;
        const scope = path.scope;

        // Walk up through parent scopes looking for the same binding
        let parentScope = scope.parent;
        while (parentScope) {
          if (parentScope.bindings[name]) {
            const outerBinding = parentScope.bindings[name];
            const outerKind    = outerBinding.kind; // 'var', 'let', 'const', 'param'

            // Skip if outer is a global / built-in
            if (isBuiltIn(name)) break;

            // Skip var-var shadowing in same function (legal but not interesting)
            const innerKind = path.parent.kind;
            if (outerKind === 'var' && innerKind === 'var') break;

            warnings.push({
              line:       idNode.loc?.start.line,
              confidence: 76,
              message:    `\`${name}\` shadows a ${outerKind} variable from an outer scope — the outer value is now invisible here`,
              suggestion: `rename the inner variable to something more specific, e.g. \`inner${cap(name)}\` or \`local${cap(name)}\``,
            });
            break;
          }
          parentScope = parentScope.parent;
        }
      },

      // Also check function parameters
      Function(path) {
        const params = path.node.params ?? [];
        for (const param of params) {
          if (!t.isIdentifier(param)) continue;
          const name = param.name;
          if (isBuiltIn(name)) continue;

          let parentScope = path.scope.parent;
          while (parentScope) {
            if (parentScope.bindings[name]) {
              warnings.push({
                line:       param.loc?.start.line,
                confidence: 65,
                message:    `parameter \`${name}\` shadows an outer-scope variable — the outer variable is inaccessible inside this function`,
                suggestion: 'rename the parameter to avoid the conflict',
              });
              break;
            }
            parentScope = parentScope.parent;
          }
        }
      },
    });

    return warnings;
  },
};

const BUILT_INS = new Set([
  'undefined', 'null', 'true', 'false', 'NaN', 'Infinity',
  'Object', 'Array', 'String', 'Number', 'Boolean', 'Symbol',
  'Promise', 'Error', 'Map', 'Set', 'Date', 'RegExp', 'Function',
  'console', 'process', 'require', 'module', 'exports', '__dirname', '__filename',
  'e', 'err', 'error', // very common, low signal
  'i', 'j', 'k', 'n', 'x', 'y', // loop vars
  'cb', 'callback', 'next', 'done', 'resolve', 'reject',
]);

function isBuiltIn(name) {
  return BUILT_INS.has(name);
}

function cap(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
