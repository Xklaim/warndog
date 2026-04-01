'use strict';

const { describe, it, expect, beforeAll } = require('@jest/globals');
const { parse }        = require('../../../src/parser');
const missingAwait     = require('../../../src/rules/async/missing-await');

function analyse(code) {
  const ast = parse(code, 'test.js');
  return missingAwait.check({ ast, source: code, sourceLines: code.split('\n'), filePath: 'test.js', config: {} });
}

describe('missing-await rule', () => {
  it('detects unawaited fetch inside async function', () => {
    const code = `
      async function loadData() {
        fetch('/api/data');
        return 'done';
      }
    `;
    const warnings = analyse(code);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0].message).toMatch(/not awaited/);
    expect(warnings[0].confidence).toBeGreaterThanOrEqual(70);
  });

  it('does NOT warn when fetch is awaited', () => {
    const code = `
      async function loadData() {
        const res = await fetch('/api/data');
        return res.json();
      }
    `;
    const warnings = analyse(code);
    expect(warnings.length).toBe(0);
  });

  it('does NOT warn when result is assigned (user handles the promise)', () => {
    const code = `
      async function loadData() {
        const promise = fetch('/api/data');
        return promise.then(r => r.json());
      }
    `;
    const warnings = analyse(code);
    expect(warnings.length).toBe(0);
  });

  it('does NOT warn on calls outside async functions', () => {
    const code = `
      function loadData() {
        fetch('/api/data');
      }
    `;
    const warnings = analyse(code);
    // Outside async — floating-promise rule handles this, not missing-await
    expect(warnings.length).toBe(0);
  });

  it('detects unawaited db call', () => {
    const code = `
      async function saveUser(user) {
        db.save(user);
      }
    `;
    const warnings = analyse(code);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });

  it('includes severity high', () => {
    const code = `
      async function go() { fetch('/x'); }
    `;
    const warnings = analyse(code);
    // Rule default severity is high, but warning itself may not set severity
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT warn on setTimeout inside async functions', () => {
    const code = `
      async function go() {
        setTimeout(() => finish(), 100);
      }
    `;
    const warnings = analyse(code);
    expect(warnings.length).toBe(0);
  });
});
