'use strict';

const { Command } = require('commander');
const chalk = require('chalk');
const { version } = require('../../package.json');
const { printBanner } = require('./output/formatter');

const scanCommand    = require('./commands/scan');
const watchCommand   = require('./commands/watch');
const runCommand     = require('./commands/run');
const explainCommand = require('./commands/explain');
const reportCommand  = require('./commands/report');
const initCommand    = require('./commands/init');

function run() {
  const program = new Command();

  program
    .name('warndog')
    .description(
      chalk.bold('🐶 warndog') +
      ' — a brutally honest senior engineer watching your code in real time'
    )
    .version(version, '-v, --version', 'output the current version')
    .option('-d, --debug',            'enable debug output')
    .option('--no-color',             'disable colored output')
    .option('--json',                 'output results as JSON')
    .option('--quiet',                'suppress all output except warnings')
    .option('--config <path>',        'path to warndog config file')
    .option('--ignore <patterns...>', 'glob patterns to ignore')
    .option('--severity <level>',     'minimum severity to report (low|medium|high|critical)', 'low')
    .option('--confidence <number>',  'minimum confidence % to report (0-100)', '0');

  // Default command: full scan
  program
    .argument('[target]', 'file, directory, or glob to scan', '.')
    .action(async (target, options, cmd) => {
      const globalOpts = cmd.parent?.opts() ?? cmd.opts();
      if (!globalOpts.quiet) printBanner();
      await scanCommand.handler(target, mergeOpts(cmd));
    });

  program.addCommand(buildScanCmd());
  program.addCommand(buildWatchCmd());
  program.addCommand(buildRunCmd());
  program.addCommand(buildExplainCmd());
  program.addCommand(buildReportCmd());
  program.addCommand(buildInitCmd());

  program.parseAsync(process.argv).catch((err) => {
    console.error(chalk.red('[warndog] CLI error:'), err.message);
    if (process.env.WARNDOG_DEBUG) console.error(err.stack);
    process.exit(1);
  });
}

// ──────────────────────────────────────────────
// Sub-command builders
// ──────────────────────────────────────────────

function buildScanCmd() {
  const cmd = new Command('scan');
  cmd
    .description('Run a full static-analysis scan on a project or file')
    .argument('[target]', 'file, directory, or glob to scan', '.')
    .option('--depth <n>',            'max directory traversal depth', '10')
    .option('--include <patterns...>', 'only analyse matching glob patterns')
    .option('--fix',                  'apply auto-fixable suggestions (experimental)')
    .action(async (target, opts) => {
      await scanCommand.handler(target, mergeOpts(cmd, opts));
    });
  return cmd;
}

function buildWatchCmd() {
  const cmd = new Command('watch');
  cmd
    .description('Watch files for changes and re-analyse on every save')
    .argument('[target]', 'directory to watch', '.')
    .option('--debounce <ms>', 'debounce delay in milliseconds', '300')
    .action(async (target, opts) => {
      await watchCommand.handler(target, mergeOpts(cmd, opts));
    });
  return cmd;
}

function buildRunCmd() {
  const cmd = new Command('run');
  cmd
    .description('Run a Node.js script with runtime instrumentation attached')
    .argument('<script>', 'path to the script to run')
    .argument('[args...]', 'arguments forwarded to the script')
    .option('--track-async',   'track async flows and unhandled rejections (default: true)', true)
    .option('--track-nulls',   'track unexpected null/undefined propagation', false)
    .option('--timeout <ms>',  'max run duration before warndog kills the process', '30000')
    .allowUnknownOption()
    .action(async (script, args, opts) => {
      await runCommand.handler(script, args, mergeOpts(cmd, opts));
    });
  return cmd;
}

function buildExplainCmd() {
  const cmd = new Command('explain');
  cmd
    .description('Get a detailed human explanation of a warning at a specific location')
    .argument('<location>', 'file:line to explain, e.g. server.js:42')
    .option('--rule <id>', 'explain a specific rule by ID instead of a location')
    .action(async (location, opts) => {
      await explainCommand.handler(location, mergeOpts(cmd, opts));
    });
  return cmd;
}

function buildReportCmd() {
  const cmd = new Command('report');
  cmd
    .description('Generate a full analysis report and write it to disk')
    .argument('[target]', 'directory to scan for the report', '.')
    .option('--output <file>',  'output file path', 'warndog-report.json')
    .option('--format <type>',  'report format: json | html | markdown', 'json')
    .action(async (target, opts) => {
      await reportCommand.handler(target, mergeOpts(cmd, opts));
    });
  return cmd;
}

function buildInitCmd() {
  const cmd = new Command('init');
  cmd
    .description('Create a warndog.config.js in the current directory')
    .option('--force', 'overwrite existing config', false)
    .action(async (opts) => {
      await initCommand.handler(mergeOpts(cmd, opts));
    });
  return cmd;
}

// Merge parent-level global options with sub-command options
function mergeOpts(cmd, localOpts = {}) {
  const parent = cmd.parent?.opts() ?? {};
  return { ...parent, ...localOpts };
}

module.exports = { run };
