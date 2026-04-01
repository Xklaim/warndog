'use strict';

const { describe, it, expect } = require('@jest/globals');
const { parse }        = require('../../../src/parser');
const cyclomatic       = require('../../../src/rules/complexity/cyclomatic');
const deepNesting      = require('../../../src/rules/complexity/deep-nesting');
const callbackHell     = require('../../../src/rules/complexity/callback-hell');

function analyse(rule, code, config = {}) {
  const ast = parse(code, 'test.js');
  return rule.check({ ast, source: code, sourceLines: code.split('\n'), filePath: 'test.js', config });
}

describe('cyclomatic-complexity rule', () => {
  it('warns on highly complex function', () => {
    const code = `
      function complexFn(a, b, c, d, e) {
        if (a) { if (b) { if (c) { if (d) { if (e) {
          return 1;
        } else { return 2; }
        } else { return 3; }
        } else { return 4; }
        } else { return 5; }
        } else { return 6; }
        while (a && b) { if (c || d) { for (let i = 0; i < 10; i++) {} } }
        return 0;
      }
    `;
    const warnings = analyse(cyclomatic, code, { complexity: { cyclomaticThreshold: 5 } });
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0].message).toMatch(/cyclomatic complexity/i);
  });

  it('does NOT warn on simple function', () => {
    const code = `
      function simple(x) {
        return x * 2;
      }
    `;
    const warnings = analyse(cyclomatic, code, { complexity: { cyclomaticThreshold: 10 } });
    expect(warnings.length).toBe(0);
  });

  it('uses config threshold', () => {
    const code = `
      function mildFn(x) {
        if (x > 0) return x;
        if (x < 0) return -x;
        return 0;
      }
    `;
    // Should warn with threshold of 2
    const strictWarnings = analyse(cyclomatic, code, { complexity: { cyclomaticThreshold: 2 } });
    expect(strictWarnings.length).toBeGreaterThanOrEqual(1);

    // Should NOT warn with threshold of 10
    const lenientWarnings = analyse(cyclomatic, code, { complexity: { cyclomaticThreshold: 10 } });
    expect(lenientWarnings.length).toBe(0);
  });
});

describe('deep-nesting rule', () => {
  it('warns on deeply nested code', () => {
    const code = `
      function go() {
        if (a) {
          if (b) {
            if (c) {
              if (d) {
                if (e) { doSomething(); }
              }
            }
          }
        }
      }
    `;
    const warnings = analyse(deepNesting, code, { complexity: { nestingThreshold: 3 } });
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0].message).toMatch(/nesting depth/);
  });

  it('does NOT warn on shallow nesting', () => {
    const code = `
      function go() {
        if (a) {
          doSomething();
        }
      }
    `;
    const warnings = analyse(deepNesting, code, { complexity: { nestingThreshold: 4 } });
    expect(warnings.length).toBe(0);
  });
});

describe('callback-hell rule', () => {
  it('warns on deeply nested callbacks', () => {
    const code = `
      fs.readFile('a', (err, data) => {
        db.query(data, (err, rows) => {
          api.post(rows, (err, res) => {
            notify(res, (err) => {
              done();
            });
          });
        });
      });
    `;
    const warnings = analyse(callbackHell, code);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0].message).toMatch(/callback hell|nested/i);
  });

  it('does NOT warn on a single callback', () => {
    const code = `
      fs.readFile('a', (err, data) => {
        process(data);
      });
    `;
    const warnings = analyse(callbackHell, code);
    expect(warnings.length).toBe(0);
  });
});
