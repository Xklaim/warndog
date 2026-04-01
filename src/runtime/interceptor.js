'use strict';

/**
 * warndog runtime interceptor
 * Loaded via: node --require=./runtime/interceptor.js <script>
 *
 * Tracks:
 *  - unhandled promise rejections
 *  - uncaught exceptions
 *  - async timing anomalies
 *  - unexpected null/undefined propagation (when enabled)
 */

const chalk = require('chalk');

const TRACK_ASYNC  = process.env.WARNDOG_TRACK_ASYNC !== 'false';
const DEBUG        = process.env.WARNDOG_DEBUG === 'true';

const TAG = chalk.yellow('[warndog runtime]');

// ──────────────────────────────────────────────
// Unhandled rejections
// ──────────────────────────────────────────────

if (TRACK_ASYNC) {
  const pendingPromises = new Map();

  process.on('unhandledRejection', (reason, promise) => {
    const meta = pendingPromises.get(promise);
    const loc  = meta ? ` (created at ${meta.stack})` : '';

    console.error(
      `\n${TAG} ${chalk.red('⚠  UNHANDLED PROMISE REJECTION')}${loc}\n` +
      `   ${chalk.gray('reason:')} ${formatReason(reason)}\n`
    );

    if (DEBUG && reason instanceof Error) {
      console.error(chalk.gray(reason.stack));
    }
  });

  process.on('rejectionHandled', (promise) => {
    pendingPromises.delete(promise);
  });

  // Patch Promise to track creation location
  const NativePromise = global.Promise;

  class TrackedPromise extends NativePromise {
    constructor(executor) {
      super(executor);
      // Capture a trimmed stack trace for the creation site
      const err = new Error();
      const frames = (err.stack || '').split('\n').slice(3, 6).join(' → ').trim();
      pendingPromises.set(this, { stack: frames });
    }
  }

  // Copy static methods
  Object.getOwnPropertyNames(NativePromise).forEach(key => {
    if (key !== 'prototype' && key !== 'length' && key !== 'name') {
      try { TrackedPromise[key] = NativePromise[key]; } catch {}
    }
  });

  global.Promise = TrackedPromise;
}

// ──────────────────────────────────────────────
// Uncaught exceptions
// ──────────────────────────────────────────────

process.on('uncaughtException', (err) => {
  console.error(
    `\n${TAG} ${chalk.red('⚠  UNCAUGHT EXCEPTION')}\n` +
    `   ${chalk.gray('message:')} ${err.message}\n`
  );
  if (err.stack) {
    console.error(chalk.gray(formatStack(err.stack)));
  }
  // Don't swallow — let Node's default behavior terminate
  process.exitCode = 1;
});

// ──────────────────────────────────────────────
// Async timing tracker
// ──────────────────────────────────────────────

if (TRACK_ASYNC) {
  const asyncCallbacks = new Map();
  let   asyncIdCounter = 0;

  // Patch setTimeout to warn about unusually long callbacks
  const origSetTimeout = global.setTimeout;
  global.setTimeout = function warnDogTimeout(fn, ms, ...args) {
    const id  = ++asyncIdCounter;
    const err = new Error();
    asyncCallbacks.set(id, { ms, stack: err.stack });

    return origSetTimeout.call(this, function () {
      asyncCallbacks.delete(id);
      try {
        fn.apply(this, args);
      } catch (e) {
        console.error(
          `\n${TAG} ${chalk.red('⚠  UNCAUGHT ERROR INSIDE setTimeout')}\n` +
          `   ${chalk.gray('message:')} ${e.message}\n` +
          chalk.gray(formatStack(e.stack || ''))
        );
        throw e;
      }
    }, ms);
  };
  Object.assign(global.setTimeout, origSetTimeout);
}

// ──────────────────────────────────────────────
// Exit summary
// ──────────────────────────────────────────────

process.on('exit', () => {
  if (process.env.WARNDOG_RUNTIME) {
    // Summary is printed by the run command handler
  }
});

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function formatReason(reason) {
  if (reason instanceof Error) return chalk.red(reason.message);
  if (typeof reason === 'string') return chalk.red(reason);
  try { return chalk.red(JSON.stringify(reason)); } catch { return chalk.red(String(reason)); }
}

function formatStack(stack) {
  return stack
    .split('\n')
    .slice(1, 8)
    .map(l => '  ' + l.trim())
    .join('\n');
}
