#!/usr/bin/env node

'use strict';

// Ensure we're running a supported Node.js version
const [major] = process.versions.node.split('.').map(Number);
if (major < 16) {
  console.error(
    '\x1b[31m[warndog] Node.js 16+ is required. You are running ' +
    process.version + '\x1b[0m'
  );
  process.exit(1);
}

// Handle uncaught top-level errors gracefully
process.on('uncaughtException', (err) => {
  console.error('\x1b[31m[warndog] Unexpected error:\x1b[0m', err.message);
  if (process.env.WARNDOG_DEBUG) {
    console.error(err.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('\x1b[31m[warndog] Unhandled promise rejection:\x1b[0m', reason);
  if (process.env.WARNDOG_DEBUG) {
    console.error(reason instanceof Error ? reason.stack : reason);
  }
  process.exit(1);
});

require('../src/cli').run();
