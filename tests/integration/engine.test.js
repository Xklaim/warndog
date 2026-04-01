'use strict';

const { describe, it, expect } = require('@jest/globals');
const path   = require('path');
const { Engine } = require('../../src/engine');

const FIXTURE_DIR = path.join(__dirname, '../fixtures/broken-project');

describe('Engine integration', () => {
  it('finds warnings in the broken fixture project', async () => {
    const engine  = new Engine({ debug: false, confidence: 0, severity: 'low' });
    const results = await engine.analyzeTarget(FIXTURE_DIR);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    const allWarnings = results.flatMap(r => r.warnings);
    expect(allWarnings.length).toBeGreaterThan(0);
  });

  it('each result has expected shape', async () => {
    const engine  = new Engine({ debug: false });
    const results = await engine.analyzeTarget(FIXTURE_DIR);
    for (const result of results) {
      expect(result).toHaveProperty('file');
      expect(result).toHaveProperty('warnings');
      expect(Array.isArray(result.warnings)).toBe(true);
      for (const w of result.warnings) {
        expect(w).toHaveProperty('ruleId');
        expect(w).toHaveProperty('severity');
        expect(w).toHaveProperty('confidence');
        expect(w).toHaveProperty('message');
        expect(typeof w.line).toBe('number');
      }
    }
  });

  it('detects missing-await in async.js fixture', async () => {
    const engine  = new Engine({ debug: false, confidence: 0 });
    const results = await engine.analyzeTarget(path.join(FIXTURE_DIR, 'async.js'));
    const warnings = results.flatMap(r => r.warnings);
    const asyncWarnings = warnings.filter(w => w.ruleId === 'missing-await');
    expect(asyncWarnings.length).toBeGreaterThan(0);
  });

  it('detects error-handling issues in errors.js fixture', async () => {
    const engine  = new Engine({ debug: false, confidence: 0 });
    const results = await engine.analyzeTarget(path.join(FIXTURE_DIR, 'errors.js'));
    const warnings = results.flatMap(r => r.warnings);
    const errWarnings = warnings.filter(w => w.ruleId === 'error-handling');
    expect(errWarnings.length).toBeGreaterThan(0);
  });

  it('respects minimum confidence filter', async () => {
    const engine  = new Engine({ debug: false, confidence: 99 });
    const results = await engine.analyzeTarget(FIXTURE_DIR);
    const warnings = results.flatMap(r => r.warnings);
    for (const w of warnings) {
      expect(w.confidence).toBeGreaterThanOrEqual(99);
    }
  });
});
