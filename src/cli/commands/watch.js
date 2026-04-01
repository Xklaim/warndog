'use strict';

const path      = require('path');
const chalk     = require('chalk');
const chokidar  = require('chokidar');
const { loadConfig }    = require('../../config');
const { Engine }        = require('../../engine');
const { printBanner, printWatchUpdate, printResults } = require('../output/formatter');

async function handler(target, opts = {}) {
  const cwd    = process.cwd();
  const config = await loadConfig(opts.config, cwd);

  const mergedConfig = {
    ...config,
    ignore:     [...(config.ignore ?? []), ...(opts.ignore ?? [])],
    severity:   opts.severity   ?? config.severity   ?? 'low',
    confidence: opts.confidence ?? config.confidence ?? 0,
    debug:      opts.debug      ?? false,
  };

  const targetPath  = path.resolve(cwd, target);
  const debounceMs  = parseInt(opts.debounce ?? '300', 10);
  const engine      = new Engine(mergedConfig);

  console.log(chalk.yellow('🐶 warndog watching') + chalk.gray(` → ${targetPath}`));
  console.log(chalk.gray(`   (debounce: ${debounceMs}ms  •  press Ctrl+C to stop)\n`));

  // Initial scan
  await runScan(engine, targetPath, mergedConfig, null);

  // Map of pending timers per-file
  const timers = new Map();

  const watcher = chokidar.watch(targetPath, {
    ignored:    [/node_modules/, /\.git/, /warndog-report/],
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
  });

  async function scheduleReScan(filePath) {
    if (timers.has(filePath)) clearTimeout(timers.get(filePath));
    timers.set(filePath, setTimeout(async () => {
      timers.delete(filePath);
      printWatchUpdate(path.relative(cwd, filePath));
      // Only re-scan the changed file for speed
      await runScan(engine, filePath, mergedConfig, filePath);
    }, debounceMs));
  }

  watcher
    .on('change', scheduleReScan)
    .on('add',    scheduleReScan)
    .on('unlink', (filePath) => {
      console.log(chalk.gray(`  🗑  removed: ${path.relative(cwd, filePath)}`));
    })
    .on('error',  (err) => {
      console.error(chalk.red('[warndog watcher]'), err.message);
    });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n🐶 warndog stopping. Bye!\n'));
    watcher.close();
    process.exit(0);
  });
}

async function runScan(engine, targetPath, config, changedFile) {
  try {
    const results = await engine.analyzeTarget(targetPath);
    printResults(results, config);
  } catch (err) {
    console.error(chalk.red('[warndog] scan error:'), err.message);
    if (config.debug) console.error(err.stack);
  }
}

module.exports = { handler };
