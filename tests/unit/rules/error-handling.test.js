'use strict';

const { describe, it, expect } = require('@jest/globals');
const { parse }       = require('../../../src/parser');
const errorHandling   = require('../../../src/rules/patterns/error-handling');

function analyse(code) {
  const ast = parse(code, 'test.js');
  return errorHandling.check({ ast, source: code, sourceLines: code.split('\n'), filePath: 'test.js', config: {} });
}

describe('error-handling rule', () => {
  it('warns on completely empty catch block', () => {
    const code = `
      try {
        doSomething();
      } catch (e) {}
    `;
    const warnings = analyse(code);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0].message).toMatch(/empty catch/i);
    expect(warnings[0].confidence).toBeGreaterThanOrEqual(90);
  });

  it('does NOT warn when catch block logs error', () => {
    const code = `
      try {
        doSomething();
      } catch (e) {
        console.error('failed', e);
      }
    `;
    const warnings = analyse(code);
    expect(warnings.length).toBe(0);
  });

  it('warns when catch param is never used', () => {
    const code = `
      try {
        doSomething();
      } catch (err) {
        console.log('something went wrong');
      }
    `;
    const warnings = analyse(code);
    const unusedParamWarning = warnings.find(w => w.message.includes('never referenced'));
    expect(unusedParamWarning).toBeDefined();
  });

  it('warns when console.error is called without the error object', () => {
    const code = `
      try {
        doSomething();
      } catch (err) {
        console.error('something broke');
      }
    `;
    const warnings = analyse(code);
    const noStackTrace = warnings.find(w => w.message.includes('stack trace'));
    expect(noStackTrace).toBeDefined();
  });
});
