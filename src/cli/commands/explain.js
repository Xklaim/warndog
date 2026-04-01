'use strict';

const path    = require('path');
const fs      = require('fs');
const chalk   = require('chalk');
const { loadConfig }        = require('../../config');
const { Engine }            = require('../../engine');
const { printExplanation }  = require('../output/formatter');
const { getAllRules }        = require('../../rules');
const { resolveConfigCwd }  = require('../resolve-config-cwd');

async function handler(location, opts = {}) {
  // Mode 1: explain a rule by ID
  if (opts.rule) {
    return explainRule(opts.rule);
  }

  // Mode 2: explain warnings at a file:line location
  const [file, lineStr] = location.split(':');
  const line = parseInt(lineStr, 10);

  if (!file || isNaN(line)) {
    console.error(chalk.red('[warndog] location must be in format file:line, e.g. server.js:42'));
    process.exit(1);
  }

  const cwd        = process.cwd();
  const configCwd  = resolveConfigCwd(cwd, file, opts.config);
  const config     = await loadConfig(opts.config, configCwd);
  const targetPath = path.resolve(cwd, file);

  if (!fs.existsSync(targetPath)) {
    console.error(chalk.red(`[warndog] file not found: ${targetPath}`));
    process.exit(1);
  }

  const engine  = new Engine({ ...config, debug: opts.debug });
  const results = await engine.analyzeTarget(targetPath);
  const relFile = path.relative(cwd, targetPath);

  const fileResult = results.find(r =>
    r.file === relFile || r.file === targetPath || path.resolve(cwd, r.file) === targetPath
  );

  if (!fileResult || fileResult.warnings.length === 0) {
    console.log(chalk.green(`✅  No warnings found in ${file}`));
    return;
  }

  // Find warnings near the requested line (±3 lines tolerance)
  const nearby = fileResult.warnings.filter(w => Math.abs(w.line - line) <= 3);

  if (nearby.length === 0) {
    console.log(chalk.yellow(`No warnings found near ${file}:${line}`));
    console.log(chalk.gray('Warnings in this file are on lines:'),
      fileResult.warnings.map(w => w.line).join(', '));
    return;
  }

  console.log(chalk.yellow(`\n🐶 Explaining ${nearby.length} warning(s) near ${file}:${line}\n`));

  for (const w of nearby) {
    const rule = getAllRules().find(r => r.id === w.ruleId);
    printExplanation({
      ruleId:       w.ruleId,
      summary:      w.message,
      whyItMatters: rule?.explanation ?? 'This pattern can lead to subtle runtime bugs that are difficult to trace.',
      badExample:   rule?.badExample  ?? '// (no example available)',
      goodExample:  rule?.goodExample,
    });
  }
}

function explainRule(ruleId) {
  const rule = getAllRules().find(r => r.id === ruleId);
  if (!rule) {
    console.error(chalk.red(`[warndog] Unknown rule: ${ruleId}`));
    console.log(chalk.gray('Available rules:\n') +
      getAllRules().map(r => `  ${r.id}`).join('\n'));
    process.exit(1);
  }
  printExplanation({
    ruleId:       rule.id,
    summary:      rule.description,
    whyItMatters: rule.explanation,
    badExample:   rule.badExample  ?? '// no example',
    goodExample:  rule.goodExample,
  });
}

module.exports = { handler };
