'use strict';

const t = require('@babel/types');
const { walk } = require('../../src/parser/traversal');
const { createPlugin, createRule } = require('../../src/plugins');

// ──────────────────────────────────────────────
// Rule: missing error middleware in Express
// ──────────────────────────────────────────────
const missingErrorMiddleware = createRule({
  id:              'express/missing-error-middleware',
  description:     'Express apps without a 4-argument error handler will swallow errors silently',
  defaultSeverity: 'high',
  explanation: [
    'Express error-handling middleware must have exactly 4 parameters: (err, req, res, next).',
    'Without it, errors thrown inside route handlers are caught by Express but never surfaced.',
    'The client gets a generic 500 with no details, and you get no logs.',
  ].join(' '),
  badExample:  'app.use((req, res, next) => { ... }); // 3 params — not an error handler',
  goodExample: 'app.use((err, req, res, next) => {\n  console.error(err);\n  res.status(500).json({ error: err.message });\n});',

  check({ ast }) {
    const warnings = [];
    let   usesExpress  = false;
    let   hasErrorHandler = false;

    // Detect express usage
    walk(ast, {
      VariableDeclarator(path) {
        const init = path.node.init;
        if (t.isCallExpression(init)) {
          const callee = init.callee;
          if (t.isIdentifier(callee) && callee.name === 'express') {
            usesExpress = true;
          }
          if (t.isCallExpression(callee) && t.isIdentifier(callee.callee) && callee.callee.name === 'require') {
            const args = callee.arguments;
            if (args.length && t.isStringLiteral(args[0]) && args[0].value === 'express') {
              usesExpress = true;
            }
          }
        }
      },

      CallExpression(path) {
        const callee = path.node.callee;
        if (!t.isMemberExpression(callee)) return;
        const prop = callee.property;
        if (!t.isIdentifier(prop) || prop.name !== 'use') return;

        const args = path.node.arguments;
        const handler = args.find(a =>
          t.isFunctionExpression(a) || t.isArrowFunctionExpression(a)
        );
        if (handler && handler.params.length === 4) {
          hasErrorHandler = true;
        }
      },
    });

    if (usesExpress && !hasErrorHandler) {
      warnings.push({
        line:       1,
        confidence: 70,
        message:    'no Express error-handling middleware found — unhandled errors will be silently swallowed',
        suggestion: 'add `app.use((err, req, res, next) => { ... })` as the last middleware',
      });
    }

    return warnings;
  },
});

// ──────────────────────────────────────────────
// Rule: res.json() called after res.send()
// ──────────────────────────────────────────────
const doubleResponse = createRule({
  id:              'express/double-response',
  description:     'Sending a response twice in the same route handler',
  defaultSeverity: 'high',
  explanation: [
    'You are calling res.json() or res.send() more than once in the same request handler.',
    'Only the first response is sent; the second causes a "headers already sent" error.',
    'This crashes your route with an ERR_HTTP_HEADERS_SENT exception.',
  ].join(' '),
  badExample:  'app.get("/", (req, res) => {\n  res.json({ ok: true });\n  res.json({ error: "oops" }); // already sent!\n});',
  goodExample: 'app.get("/", (req, res) => {\n  return res.json({ ok: true }); // use return to stop execution\n});',

  check({ ast }) {
    const warnings = [];

    walk(ast, {
      'FunctionDeclaration|FunctionExpression|ArrowFunctionExpression'(path) {
        const params = path.node.params;
        // Route handlers typically have (req, res) or (req, res, next)
        if (params.length < 2) return;

        const resParam = params[1];
        if (!t.isIdentifier(resParam)) return;
        const resName  = resParam.name;

        const sendCalls = [];
        path.traverse({
          CallExpression(inner) {
            const callee = inner.node.callee;
            if (!t.isMemberExpression(callee)) return;
            if (!t.isIdentifier(callee.object) || callee.object.name !== resName) return;
            const method = callee.property;
            if (t.isIdentifier(method) && ['send', 'json', 'render', 'redirect', 'end'].includes(method.name)) {
              sendCalls.push(inner.node);
            }
          },
        });

        if (sendCalls.length >= 2) {
          warnings.push({
            line:       sendCalls[1].loc?.start.line,
            confidence: 72,
            message:    `\`res.${sendCalls[1].callee.property.name}()\` called when a response may have already been sent — "headers already sent" error incoming`,
            suggestion: 'use `return res.json(...)` to prevent execution from falling through',
          });
        }
      },
    });

    return warnings;
  },
});

module.exports = createPlugin({
  name:  'warndog-plugin-express',
  rules: [missingErrorMiddleware, doubleResponse],
});
