'use strict';

const { describe, it, expect } = require('@jest/globals');
const { parse } = require('../../../src/parser');
const rule = require('../../../src/rules/logic/inconsistent-return');

function analyse(code) {
  const ast = parse(code, 'test.jsx');
  return rule.check({ ast, source: code, sourceLines: code.split('\n'), filePath: 'test.jsx', config: {} });
}

describe('inconsistent-return rule', () => {
  it('warns on mixed value and bare returns in normal functions', () => {
    const code = `
      function maybe(flag) {
        if (flag) return 1;
        return;
      }
    `;
    const warnings = analyse(code);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT warn on React effect cleanup callbacks', () => {
    const code = `
      function App() {
        useEffect(() => {
          if (!window.ResizeObserver) return;
          const observer = new ResizeObserver(() => {});
          observer.observe(document.body);
          return () => observer.disconnect();
        }, []);
      }
    `;
    const warnings = analyse(code);
    expect(warnings.length).toBe(0);
  });
});
