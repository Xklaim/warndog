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
    'Readers of the code will often assume they refer to the same thing.',
  ].join(' '),
  badExample:  'const user = getUser();\nfunction validate() {\n  const user = req.body;\n  return user.id;\n}',
  goodExample: 'const currentUser = getUser();\nfunction validate() {\n  const inputUser = req.body;\n  return inputUser.id;\n}',

  check({ ast }) {
    const warnings = [];

    walk(ast, {
      VariableDeclarator(path) {
        const idNode = path.node.id;
        if (!t.isIdentifier(idNode)) return;

        const name = idNode.name;
        if (isBuiltIn(name)) return;

        let parentScope = path.scope.parent;
        while (parentScope) {
          const outerBinding = parentScope.bindings[name];
          if (outerBinding) {
            if (isDeclaredLater(outerBinding, idNode)) break;

            const outerKind = outerBinding.kind;
            const innerKind = path.parent.kind;
            if (outerKind === 'var' && innerKind === 'var') break;

            warnings.push({
              line:       idNode.loc?.start.line,
              confidence: 76,
              message:    `\`${name}\` shadows a ${outerKind} variable from an outer scope - the outer value is now invisible here`,
              suggestion: `rename the inner variable to something more specific, e.g. \`inner${cap(name)}\` or \`local${cap(name)}\``,
            });
            break;
          }

          parentScope = parentScope.parent;
        }
      },

      Function(path) {
        const params = path.node.params ?? [];
        for (const param of params) {
          if (!t.isIdentifier(param)) continue;
          const name = param.name;
          if (isBuiltIn(name)) continue;

          let parentScope = path.scope.parent;
          while (parentScope) {
            const outerBinding = parentScope.bindings[name];
            if (outerBinding) {
              if (isDeclaredLater(outerBinding, param)) break;

              warnings.push({
                line:       param.loc?.start.line,
                confidence: 65,
                message:    `parameter \`${name}\` shadows an outer-scope variable - the outer variable is inaccessible inside this function`,
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
  'e', 'err', 'error',
  'i', 'j', 'k', 'n', 'x', 'y',
  'cb', 'callback', 'next', 'done', 'resolve', 'reject',
]);

function isBuiltIn(name) {
  return BUILT_INS.has(name);
}

function cap(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function isDeclaredLater(binding, innerNode) {
  const outerNode = binding?.identifier;
  if (!outerNode?.loc?.start || !innerNode?.loc?.start) return false;

  if (outerNode.loc.start.line > innerNode.loc.start.line) return true;
  if (
    outerNode.loc.start.line === innerNode.loc.start.line &&
    outerNode.loc.start.column > innerNode.loc.start.column
  ) {
    return true;
  }

  return false;
}
