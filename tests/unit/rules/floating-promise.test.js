'use strict';

const { describe, it, expect } = require('@jest/globals');
const { parse } = require('../../../src/parser');
const rule = require('../../../src/rules/async/floating-promise');

function analyse(code) {
  const ast = parse(code, 'test.js');
  return rule.check({ ast, source: code, sourceLines: code.split('\n'), filePath: 'test.js', config: {} });
}

describe('floating-promise rule', () => {
  it('warns on ignored async-looking calls', () => {
    const warnings = analyse('sendEmail(user);');
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });

  it('does not warn on express route registration', () => {
    const warnings = analyse(`app.get('/health', (_, res) => res.json({ ok: true }));`);
    expect(warnings.length).toBe(0);
  });

  it('does not warn on map deletion', () => {
    const warnings = analyse('timers.delete(filePath);');
    expect(warnings.length).toBe(0);
  });
});
