'use strict';

const { describe, it, expect } = require('@jest/globals');
const { parse }          = require('../../../src/parser');
const impossibleCond     = require('../../../src/rules/logic/impossible-condition');
const accidentalAssign   = require('../../../src/rules/logic/accidental-assignment');

function analyse(rule, code) {
  const ast = parse(code, 'test.js');
  return rule.check({ ast, source: code, sourceLines: code.split('\n'), filePath: 'test.js', config: {} });
}

describe('impossible-condition rule', () => {
  it('detects self-comparison (always true)', () => {
    const code = `if (x === x) { doSomething(); }`;
    const warnings = analyse(impossibleCond, code);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0].message).toMatch(/always true/);
    expect(warnings[0].confidence).toBeGreaterThanOrEqual(90);
  });

  it('detects self-comparison (always false)', () => {
    const code = `if (x !== x) { doSomething(); }`;
    const warnings = analyse(impossibleCond, code);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0].message).toMatch(/always false/);
  });

  it('detects literal true condition', () => {
    const code = `if (true) { doSomething(); }`;
    const warnings = analyse(impossibleCond, code);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0].confidence).toBe(99);
  });

  it('detects literal false condition', () => {
    const code = `if (false) { doSomething(); }`;
    const warnings = analyse(impossibleCond, code);
    expect(warnings.some(w => w.message.includes('never runs'))).toBe(true);
  });

  it('does NOT warn on normal conditions', () => {
    const code = `if (user.role === 'admin') { doSomething(); }`;
    const warnings = analyse(impossibleCond, code);
    expect(warnings.length).toBe(0);
  });
});

describe('accidental-assignment rule', () => {
  it('detects assignment in if condition', () => {
    const code = `if (user.role = "admin") { doSomething(); }`;
    const warnings = analyse(accidentalAssign, code);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0].message).toMatch(/assignment/i);
    expect(warnings[0].confidence).toBeGreaterThanOrEqual(80);
  });

  it('detects assignment in while condition', () => {
    const code = `while (x = getNext()) { process(x); }`;
    const warnings = analyse(accidentalAssign, code);
    // This is a known intentional pattern sometimes, but we still warn
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT warn on regular comparison', () => {
    const code = `if (user.role === "admin") { doSomething(); }`;
    const warnings = analyse(accidentalAssign, code);
    expect(warnings.length).toBe(0);
  });
});
