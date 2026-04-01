'use strict';

const t = require('@babel/types');
const { walk } = require('../../parser/traversal');

module.exports = {
  id:              'error-handling',
  description:     'Detects empty catch blocks, swallowed errors, and inconsistent error handling',
  defaultSeverity: 'medium',
  explanation: [
    'Errors are being caught but not handled — they are being silently swallowed.',
    'Empty catch blocks are one of the most dangerous patterns in JavaScript.',
    'When something goes wrong, you will have no idea why or where.',
    'At minimum, log the error. Ideally, propagate it or recover from it.',
  ].join(' '),
  badExample:  'try {\n  await riskyOperation();\n} catch (e) {\n  // ← nothing here — error silently eaten!\n}',
  goodExample: 'try {\n  await riskyOperation();\n} catch (e) {\n  logger.error("riskyOperation failed:", e);\n  throw e; // re-throw if caller needs to know\n}',

  check({ ast }) {
    const warnings = [];

    walk(ast, {
      CatchClause(path) {
        const body = path.node.body;
        if (!t.isBlockStatement(body)) return;

        // Pattern 1: completely empty catch block
        if (body.body.length === 0) {
          warnings.push({
            line:       path.node.loc?.start.line,
            confidence: 95,
            message:    `empty catch block — errors here are silently swallowed, you'll never know when this breaks`,
            suggestion: `at minimum: \`console.error(err)\` or re-throw with \`throw err\``,
          });
          return;
        }

        // Pattern 2: catch block with only a comment (body has only empty statements)
        const hasRealStatements = body.body.some(stmt =>
          !t.isEmptyStatement(stmt)
        );
        if (!hasRealStatements) {
          warnings.push({
            line:       path.node.loc?.start.line,
            confidence: 90,
            message:    `catch block with no real statements — errors are effectively ignored`,
            suggestion: `log or handle the error, don't just leave a comment`,
          });
          return;
        }

        // Pattern 3: catch param declared but never used
        const param = path.node.param;
        if (param && t.isIdentifier(param)) {
          const binding = path.scope.getBinding(param.name);
          if (binding && binding.referencePaths.length === 0) {
            warnings.push({
              line:       param.loc?.start.line,
              confidence: 75,
              message:    `caught error \`${param.name}\` is never referenced — you're catching but ignoring the error details`,
              suggestion: `use \`${param.name}\` in your catch handler, or rename to \`_\` if intentionally ignored`,
            });
          }
        }
      },

      // Pattern 4: console.error with ONLY the string, not the error object
      CallExpression(path) {
        const node   = path.node;
        const callee = node.callee;

        if (
          !t.isMemberExpression(callee) ||
          !t.isIdentifier(callee.object) ||
          callee.object.name !== 'console'
        ) return;

        const method = callee.property;
        if (!t.isIdentifier(method) || method.name !== 'error') return;

        // Check if we're inside a catch block
        let inCatch = false;
        let catchParam = null;
        let cur = path.parentPath;
        while (cur) {
          if (t.isCatchClause(cur.node)) {
            inCatch     = true;
            catchParam  = cur.node.param;
            break;
          }
          cur = cur.parentPath;
        }
        if (!inCatch || !catchParam || !t.isIdentifier(catchParam)) return;

        // Check if the error object itself is passed to console.error
        const args = node.arguments;
        const errorPassed = args.some(arg =>
          t.isIdentifier(arg) && arg.name === catchParam.name
        );

        if (!errorPassed && args.length > 0) {
          warnings.push({
            line:       node.loc?.start.line,
            confidence: 68,
            message:    `\`console.error()\` in catch block doesn't include the error object \`${catchParam.name}\` — you'll lose the stack trace`,
            suggestion: `add \`${catchParam.name}\` as an argument: \`console.error("message", ${catchParam.name})\``,
          });
        }
      },
    });

    return warnings;
  },
};
