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

  it('counts nullish coalescing without crashing Babel traversal', () => {
    const code = `
      function chooseValue(input, fallback, backup) {
        return input ?? fallback ?? backup;
      }
    `;
    const warnings = analyse(cyclomatic, code, { complexity: { cyclomaticThreshold: 2 } });
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0].message).toMatch(/cyclomatic complexity/i);
  });

  it('does NOT warn on React components at the default threshold', () => {
    const code = `
      function App({ a, b, c, d, e, f, g, h, i, j }) {
        if (a) return <div>A</div>;
        if (b) return <div>B</div>;
        if (c) return <div>C</div>;
        if (d) return <div>D</div>;
        if (e) return <div>E</div>;
        if (f) return <div>F</div>;
        if (g) return <div>G</div>;
        if (h) return <div>H</div>;
        if (i) return <div>I</div>;
        if (j) return <div>J</div>;
        return <div>Z</div>;
      }
    `;
    const warnings = analyse(cyclomatic, code, { complexity: { cyclomaticThreshold: 10 } });
    expect(warnings.length).toBe(0);
  });

  it('does NOT warn on useCallback handlers in hooks at the default threshold', () => {
    const code = `
      function useRunCode(input) {
        const runCode = useCallback(() => {
          if (input.a) return 1;
          if (input.b) return 2;
          if (input.c) return 3;
          if (input.d) return 4;
          if (input.e) return 5;
          if (input.f) return 6;
          if (input.g) return 7;
          if (input.h) return 8;
          if (input.i) return 9;
          if (input.j) return 10;
          return 11;
        }, [input]);
        return runCode;
      }
    `;
    const warnings = analyse(cyclomatic, code, { complexity: { cyclomaticThreshold: 10 } });
    expect(warnings.length).toBe(0);
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
