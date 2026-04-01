'use strict';

const path   = require('path');
const chalk  = require('chalk');
const ora    = require('ora');
const { loadConfig }    = require('../../config');
const { Engine }        = require('../../engine');
const { printSniffing, printResults, printJSON } = require('../output/formatter');
const { resolveConfigCwd } = require('../resolve-config-cwd');

async function handler(target, opts = {}) {
  const cwd    = process.cwd();
  const configCwd = resolveConfigCwd(cwd, target, opts.config);
  const config = await loadConfig(opts.config, configCwd);

  // Merge CLI flags into config
  const mergedConfig = {
    ...config,
    ignore:     [...(config.ignore ?? []), ...(opts.ignore ?? [])],
    severity:   opts.severity   ?? config.severity   ?? 'low',
    confidence: opts.confidence ?? config.confidence ?? 0,
    debug:      opts.debug      ?? config.debug      ?? false,
    fix:        opts.fix        ?? false,
    depth:      parseInt(opts.depth ?? '10', 10),
    include:    opts.include    ?? config.include,
  };

  const targetPath = path.resolve(cwd, target);
  const silentMode = opts.quiet || opts.json;

  if (!silentMode) {
    printSniffing(targetPath);
  }

  const spinner = silentMode
    ? null
    : ora({ text: chalk.gray('Parsing files…'), spinner: 'dots2' }).start();

  let results;
  try {
    const engine = new Engine(mergedConfig);
    results = await engine.analyzeTarget(targetPath);

    if (spinner) spinner.succeed(chalk.gray(`Analysed ${results.length} file${results.length !== 1 ? 's' : ''}`));
  } catch (err) {
    if (spinner) spinner.fail(chalk.red('Analysis failed'));
    console.error(chalk.red('[warndog]'), err.message);
    if (opts.debug) console.error(err.stack);
    process.exit(1);
  }

  if (opts.json) {
    printJSON(results);
  } else {
    printResults(results, mergedConfig);
  }

  // Exit with non-zero if critical/high issues exist
  const hasCritical = results.some(r => r.warnings.some(w => w.severity === 'critical'));
  const hasHigh     = results.some(r => r.warnings.some(w => w.severity === 'high'));
  if (hasCritical) process.exit(2);
  if (hasHigh)     process.exit(1);
}

module.exports = { handler };
