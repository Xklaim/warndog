'use strict';

const { walk } = require('../../parser/traversal');

const NESTING_NODES = new Set([
  'IfStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement',
  'WhileStatement', 'DoWhileStatement', 'TryStatement', 'SwitchStatement',
  'WithStatement',
]);

module.exports = {
  id:              'deep-nesting',
  description:     'Code nested deeper than the configured threshold is difficult to read and test',
  defaultSeverity: 'medium',
  explanation: [
    'This code is deeply nested (many levels of indentation).',
    'Deep nesting is hard to read, hard to test, and easy to introduce bugs in.',
    'Use early returns ("guard clauses") to invert conditions and reduce nesting.',
  ].join(' '),
  badExample:  'function process(x) {\n  if (x) {\n    if (x.valid) {\n      if (x.active) {\n        if (x.role === "admin") {\n          // 5 levels deep\n        }\n      }\n    }\n  }\n}',
  goodExample: 'function process(x) {\n  if (!x) return;\n  if (!x.valid) return;\n  if (!x.active) return;\n  if (x.role !== "admin") return;\n  // 1 level — clean!\n}',

  check({ ast, config }) {
    const warnings  = [];
    const threshold = config?.complexity?.nestingThreshold ?? 4;
    const reported  = new Set(); // avoid duplicate line reports

    walk(ast, {
      enter(path) {
        if (!NESTING_NODES.has(path.node.type)) return;

        const depth = getNestingDepth(path);
        if (depth < threshold) return;

        const line = path.node.loc?.start.line;
        if (reported.has(line)) return;
        reported.add(line);

        const severity = depth >= threshold + 3 ? 'high' : 'medium';
        warnings.push({
          line,
          severity,
          confidence: 85,
          message:    `nesting depth of ${depth} reached — deeply nested code is a maintenance hazard`,
          suggestion: 'use early returns (guard clauses), extract inner logic into helper functions',
        });
      },
    });

    return warnings;
  },
};

function getNestingDepth(path) {
  let depth   = 0;
  let current = path.parentPath;
  while (current) {
    if (NESTING_NODES.has(current.node.type)) depth++;
    current = current.parentPath;
  }
  return depth;
}
