'use strict';

const { describe, it, expect } = require('@jest/globals');
const { parse } = require('../../../src/parser');
const rule = require('../../../src/rules/variables/shadowed-variable');

function analyse(code) {
  const ast = parse(code, 'test.js');
  return rule.check({ ast, source: code, sourceLines: code.split('\n'), filePath: 'test.js', config: {} });
}

describe('shadowed-variable rule', () => {
  it('warns when an inner variable shadows an earlier outer binding', () => {
    const code = `
      const langConfig = {};
      function run() {
        if (true) {
          const langConfig = {};
          return langConfig;
        }
      }
    `;
    const warnings = analyse(code);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT warn when the outer binding is declared later in the same function scope', () => {
    const code = `
      function App(language) {
        const handleRun = () => {
          const langConfig = language;
          return langConfig;
        };

        const langConfig = language;
        return handleRun() || langConfig;
      }
    `;
    const warnings = analyse(code);
    expect(warnings.length).toBe(0);
  });
});
