'use strict';

const path         = require('path');
const chalk        = require('chalk');
const { spawn }    = require('child_process');
const { loadConfig } = require('../../config');

async function handler(script, scriptArgs, opts = {}) {
  const cwd      = process.cwd();
  const config   = await loadConfig(opts.config, cwd);
  const scriptPath = path.resolve(cwd, script);
  const timeout  = parseInt(opts.timeout ?? '30000', 10);

  console.log(chalk.yellow('🐶 warndog running with runtime instrumentation'));
  console.log(chalk.gray(`   → ${scriptPath}\n`));

  const interceptorPath = path.join(__dirname, '../../runtime/interceptor.js');

  const nodeArgs = [
    `--require=${interceptorPath}`,
    scriptPath,
    ...(scriptArgs ?? []),
  ];

  const env = {
    ...process.env,
    WARNDOG_RUNTIME:      '1',
    WARNDOG_TRACK_ASYNC:  String(opts.trackAsync  !== false),
    WARNDOG_TRACK_NULLS:  String(opts.trackNulls  === true),
    WARNDOG_DEBUG:        String(opts.debug        === true),
  };

  let killed = false;
  const child = spawn(process.execPath, nodeArgs, {
    cwd,
    env,
    stdio: ['inherit', 'inherit', 'inherit'],
  });

  // Kill after timeout
  const timer = setTimeout(() => {
    killed = true;
    child.kill('SIGTERM');
    console.error(chalk.red(`\n[warndog] process exceeded ${timeout}ms timeout — killed`));
  }, timeout);

  child.on('close', (code, signal) => {
    clearTimeout(timer);
    if (!killed) {
      const status = code === 0
        ? chalk.green(`✅  exited cleanly (code 0)`)
        : chalk.red(`❌  exited with code ${code ?? signal}`);
      console.log('\n' + chalk.yellow('🐶 warndog runtime summary:') + '  ' + status);
    }
  });

  child.on('error', (err) => {
    clearTimeout(timer);
    console.error(chalk.red('[warndog] failed to spawn process:'), err.message);
    process.exit(1);
  });
}

module.exports = { handler };
