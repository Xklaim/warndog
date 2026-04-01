'use strict';

const { describe, it, expect } = require('@jest/globals');
const { formatWarning } = require('../../../src/cli/output/formatter');

describe('formatter', () => {
  it('formats warnings with code context objects without crashing', () => {
    const warning = {
      file: 'src/server.js',
      ruleId: 'missing-await',
      severity: 'high',
      confidence: 80,
      line: 10,
      column: 2,
      message: 'this async call is not awaited',
      suggestion: 'add await',
      highlightLine: 10,
      code: {
        lines: ['const user = fetchUser();', 'return user;'],
        startLine: 9,
      },
    };

    expect(() => formatWarning(warning)).not.toThrow();
    expect(formatWarning(warning)).toContain('src/server.js:10:2');
  });
});
