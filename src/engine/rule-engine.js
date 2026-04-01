'use strict';

const { getAllRules } = require('../rules');

class RuleEngine {
  constructor(config = {}, plugins = []) {
    this.config   = config;
    this.rules    = this._loadRules(plugins);
    this.minSev   = SEVERITY_ORDER[config.severity ?? 'low'] ?? 1;
    this.minConf  = parseInt(String(config.confidence ?? 0), 10);
  }

  // ──────────────────────────────────────────────
  // Load built-in rules + plugin rules
  // ──────────────────────────────────────────────
  _loadRules(plugins) {
    const builtIn = getAllRules();
    const pluginRules = plugins.flatMap(p => p.rules ?? []);
    const all     = [...builtIn, ...pluginRules];
    const configRules = this.config.rules ?? {};

    return all
      .map(rule => {
        const ruleConfig = configRules[rule.id];
        if (ruleConfig === false || ruleConfig === 'off') return null;

        // Allow per-rule severity override and extra options
        let severity = rule.defaultSeverity;
        let extra    = {};

        if (typeof ruleConfig === 'string') {
          severity = ruleConfig;
        } else if (ruleConfig && typeof ruleConfig === 'object') {
          severity = ruleConfig.severity ?? severity;
          extra    = ruleConfig;
        }

        return { ...rule, defaultSeverity: severity, extraConfig: extra };
      })
      .filter(Boolean);
  }

  // ──────────────────────────────────────────────
  // Run all per-file rules
  // ──────────────────────────────────────────────
  async run(ast, source, filePath) {
    const sourceLines = source.split('\n');
    const warnings    = [];
    const ctx         = { ast, source, sourceLines, filePath, config: this.config };

    for (const rule of this.rules) {
      if (!rule.type || rule.type === 'file') {
        try {
          const ruleWarnings = await rule.check(ctx);
          if (!ruleWarnings || !ruleWarnings.length) continue;

          for (const w of ruleWarnings) {
            const severity = w.severity ?? rule.defaultSeverity;
            if (SEVERITY_ORDER[severity] < this.minSev) continue;
            if ((w.confidence ?? 50) < this.minConf) continue;

            warnings.push({
              ...w,
              ruleId:   rule.id,
              severity,
              code:     extractCodeContext(sourceLines, w.line, 2),
              highlightLine: w.line,
            });
          }
        } catch (err) {
          if (this.config.debug) {
            console.error(`[rule:${rule.id}] error in ${filePath}:`, err.message);
          }
        }
      }
    }

    return warnings.sort((a, b) =>
      (SEVERITY_ORDER[b.severity] ?? 1) - (SEVERITY_ORDER[a.severity] ?? 1)
    );
  }

  // ──────────────────────────────────────────────
  // Cross-file rules (run after all files analysed)
  // ──────────────────────────────────────────────
  async runCrossFileRules(results) {
    const crossFileRules = this.rules.filter(r => r.type === 'cross-file');
    if (!crossFileRules.length) return;

    for (const rule of crossFileRules) {
      try {
        const warnings = await rule.checkAll(results, this.config);
        if (!warnings || !warnings.length) continue;

        for (const w of warnings) {
          const targetResult = results.find(r =>
            r.file === w.file || r.filePath === w.file
          );
          if (targetResult) {
            targetResult.warnings.push({
              ...w,
              ruleId: rule.id,
              severity: w.severity ?? rule.defaultSeverity,
            });
          }
        }
      } catch (err) {
        if (this.config.debug) {
          console.error(`[rule:${rule.id}] cross-file error:`, err.message);
        }
      }
    }
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const SEVERITY_ORDER = { critical: 4, high: 3, medium: 2, low: 1 };

function extractCodeContext(lines, targetLine, radius = 2) {
  const start = Math.max(0, targetLine - 1 - radius);
  const end   = Math.min(lines.length - 1, targetLine - 1 + radius);
  const slice = lines.slice(start, end + 1);

  // Return both the lines and the 1-based start line number
  return { lines: slice, startLine: start + 1 };
}

module.exports = RuleEngine;
module.exports.SEVERITY_ORDER = SEVERITY_ORDER;
