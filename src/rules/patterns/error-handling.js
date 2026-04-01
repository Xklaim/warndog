'use strict';

const t = require('@babel/types');
const { walk } = require('../../parser/traversal');

module.exports = {
  id:              'error-handling',
  description:     'Detects empty catch blocks, swallowed errors, and inconsistent error handling',
  defaultSeverity: 'medium',
  explanation: [
    'Errors are being caught but not handled - they are being silently swallowed.',
    'Empty catch blocks are one of the most dangerous patterns in JavaScript.',
    'When something goes wrong, you will have no idea why or where.',
    'At minimum, log the error. Ideally, propagate it or recover from it.',
  ].join(' '),
  badExample:  'try {\n  await riskyOperation();\n} catch (e) {\n  // nothing here - error silently eaten!\n}',
  goodExample: 'try {\n  await riskyOperation();\n} catch (e) {\n  logger.error("riskyOperation failed:", e);\n  throw e;\n}',

  check({ ast }) {
    const warnings = [];

    walk(ast, {
      CatchClause(path) {
        const body = path.node.body;
        if (!t.isBlockStatement(body)) return;

        if (body.body.length === 0) {
          if (isBestEffortBrowserTry(path)) return;

          warnings.push({
            line:       path.node.loc?.start.line,
            confidence: 95,
            message:    'empty catch block - errors here are silently swallowed, you will never know when this breaks',
            suggestion: 'at minimum: `console.error(err)` or re-throw with `throw err`',
          });
          return;
        }

        const hasRealStatements = body.body.some(stmt => !t.isEmptyStatement(stmt));
        if (!hasRealStatements) {
          warnings.push({
            line:       path.node.loc?.start.line,
            confidence: 90,
            message:    'catch block with no real statements - errors are effectively ignored',
            suggestion: 'log or handle the error, do not just leave a comment',
          });
          return;
        }

        const param = path.node.param;
        if (param && t.isIdentifier(param)) {
          const binding = path.scope.getBinding(param.name);
          if (binding && binding.referencePaths.length === 0) {
            warnings.push({
              line:       param.loc?.start.line,
              confidence: 75,
              message:    `caught error \`${param.name}\` is never referenced - you are catching but ignoring the error details`,
              suggestion: `use \`${param.name}\` in your catch handler, or rename to \`_\` if intentionally ignored`,
            });
          }
        }
      },

      CallExpression(path) {
        const node = path.node;
        const callee = node.callee;

        if (
          !t.isMemberExpression(callee) ||
          !t.isIdentifier(callee.object) ||
          callee.object.name !== 'console'
        ) return;

        const method = callee.property;
        if (!t.isIdentifier(method) || method.name !== 'error') return;

        let catchParam = null;
        let cur = path.parentPath;
        while (cur) {
          if (t.isCatchClause(cur.node)) {
            catchParam = cur.node.param;
            break;
          }
          cur = cur.parentPath;
        }

        if (!catchParam || !t.isIdentifier(catchParam)) return;

        const errorPassed = node.arguments.some(arg =>
          t.isIdentifier(arg) && arg.name === catchParam.name
        );

        if (!errorPassed && node.arguments.length > 0) {
          warnings.push({
            line:       node.loc?.start.line,
            confidence: 68,
            message:    `\`console.error()\` in catch block does not include the error object \`${catchParam.name}\` - you will lose the stack trace`,
            suggestion: `add \`${catchParam.name}\` as an argument: \`console.error("message", ${catchParam.name})\``,
          });
        }
      },
    });

    return warnings;
  },
};

const BEST_EFFORT_BROWSER_CALLS = new Set([
  'localStorage.setItem',
  'sessionStorage.setItem',
  'navigator.clipboard.writeText',
  'navigator.clipboard.readText',
  'window.localStorage.setItem',
  'window.sessionStorage.setItem',
]);

function isBestEffortBrowserTry(catchPath) {
  const tryPath = catchPath.parentPath;
  const blockPath = tryPath?.get('block');
  if (!blockPath) return false;

  let found = false;
  blockPath.traverse({
    CallExpression(path) {
      const name = getCallName(path.node.callee);
      if (BEST_EFFORT_BROWSER_CALLS.has(name)) {
        found = true;
        path.stop();
      }
    },
  });

  return found;
}

function getCallName(node) {
  if (t.isIdentifier(node)) return node.name;
  if (!t.isMemberExpression(node)) return null;

  const objectName = getCallName(node.object);
  const propertyName = t.isIdentifier(node.property) ? node.property.name : null;

  if (objectName && propertyName) return `${objectName}.${propertyName}`;
  return propertyName;
}
