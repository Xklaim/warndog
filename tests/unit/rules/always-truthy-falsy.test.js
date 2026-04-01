'use strict';

const { describe, it, expect } = require('@jest/globals');
const { parse } = require('../../../src/parser');
const rule = require('../../../src/rules/logic/always-truthy-falsy');

function analyse(code, filePath = 'test.js') {
  const ast = parse(code, filePath);
  return rule.check({ ast, source: code, sourceLines: code.split('\n'), filePath, config: {} });
}

describe('always-truthy-falsy rule', () => {
  it('warns on obviously truthy conditions', () => {
    const warnings = analyse('if ([]) { run(); }');
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });

  it('does not warn on nullish fallback expressions outside conditions', () => {
    const warnings = analyse('const compile = data.compile ?? {};');
    expect(warnings.length).toBe(0);
  });

  it('does not warn on logical-or defaults outside conditions', () => {
    const warnings = analyse(`const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';`);
    expect(warnings.length).toBe(0);
  });
});
