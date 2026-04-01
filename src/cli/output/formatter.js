'use strict';

const chalk    = require('chalk');
const boxen    = require('boxen');
const figures  = require('figures');
const { version } = require('../../../package.json');

// ──────────────────────────────────────────────
// Severity configuration
// ──────────────────────────────────────────────

const SEVERITY = {
  critical: { color: chalk.bgRed.white.bold,  label: 'CRITICAL', icon: '🔴', order: 4 },
  high:     { color: chalk.red.bold,           label: 'HIGH',     icon: '🟠', order: 3 },
  medium:   { color: chalk.yellow.bold,        label: 'MEDIUM',   icon: '🟡', order: 2 },
  low:      { color: chalk.blue,               label: 'LOW',      icon: '🔵', order: 1 },
};

// ──────────────────────────────────────────────
// Banner
// ──────────────────────────────────────────────

function printBanner() {
  const dog = chalk.yellow(`
  / \\__
 (    @\\___
 /         O
/   (_____/
/_____/   U  `);

  const title = chalk.bold.white('warndog') + chalk.gray(` v${version}`);
  const tagline = chalk.italic.gray('"a brutally honest senior engineer watching your code"');

  console.log('\n' + boxen(`${dog}\n\n  🐶 ${title}\n  ${tagline}`, {
    padding: { top: 0, bottom: 1, left: 2, right: 4 },
    borderStyle: 'round',
    borderColor: 'yellow',
    dimBorder: true,
  }));
  console.log();
}

// ──────────────────────────────────────────────
// Sniffing / progress indicator
// ──────────────────────────────────────────────

function printSniffing(target) {
  console.log(chalk.yellow('🐶 warndog sniffing...') + chalk.gray(` → ${target}\n`));
}

// ──────────────────────────────────────────────
// Individual warning block
// ──────────────────────────────────────────────

function formatWarning(warning) {
  const sev     = SEVERITY[warning.severity] ?? SEVERITY.low;
  const sevTag  = sev.color(`[${sev.label}]`);
  const conf    = formatConfidence(warning.confidence);
  const loc     = chalk.cyan(`${warning.file}:${warning.line}${warning.column != null ? ':' + warning.column : ''}`);
  const ruleId  = chalk.gray(`(${warning.ruleId})`);

  const lines = [
    `  ${sev.icon}  ${sevTag} ${loc}  ${ruleId}`,
    `     ${chalk.white(figures.arrowRight)} ${chalk.white(warning.message)}`,
    `     ${chalk.gray(figures.arrowRight)} confidence: ${conf}`,
  ];

  if (warning.suggestion) {
    lines.push(`     ${chalk.green(figures.arrowRight)} ${chalk.green('fix: ' + warning.suggestion)}`);
  }

  if (warning.code) {
    lines.push('');
    lines.push(formatCodeSnippet(
      warning.code.lines,
      warning.code.startLine,
      warning.highlightLine ?? warning.line
    ));
  }

  lines.push('');
  return lines.join('\n');
}

function formatConfidence(score) {
  if (score >= 90) return chalk.red.bold(`${score}%`);
  if (score >= 70) return chalk.yellow(`${score}%`);
  if (score >= 50) return chalk.blue(`${score}%`);
  return chalk.gray(`${score}%`);
}

function formatCodeSnippet(lines = [], startLine, highlightLine) {
  const pad = String(startLine + lines.length).length;
  return lines.map((line, i) => {
    const lineNo   = String(startLine + i).padStart(pad);
    const isTarget = (startLine + i) === highlightLine;
    const prefix   = isTarget
      ? chalk.red('   ▶ ' + lineNo + ' │ ')
      : chalk.gray('     ' + lineNo + ' │ ');
    const content  = isTarget ? chalk.red(line) : chalk.gray(line);
    return prefix + content;
  }).join('\n');
}

// ──────────────────────────────────────────────
// File group header
// ──────────────────────────────────────────────

function printFileHeader(file, count) {
  const bar  = chalk.yellow('━'.repeat(Math.max(0, 70 - file.length - 8)));
  const cnt  = chalk.gray(`(${count} warning${count !== 1 ? 's' : ''})`);
  console.log(`\n${chalk.bold.white(file)} ${cnt}  ${bar}`);
}

// ──────────────────────────────────────────────
// Summary box
// ──────────────────────────────────────────────

function printSummary(results) {
  const total    = results.reduce((n, r) => n + r.warnings.length, 0);
  const byLevel  = { critical: 0, high: 0, medium: 0, low: 0 };
  const byRule   = {};

  for (const result of results) {
    for (const w of result.warnings) {
      byLevel[w.severity] = (byLevel[w.severity] ?? 0) + 1;
      byRule[w.ruleId]    = (byRule[w.ruleId] ?? 0) + 1;
    }
  }

  const topRules = Object.entries(byRule)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (total === 0) {
    console.log('\n' + boxen(
      `${chalk.green.bold('✅  All clear!')}  ${chalk.gray('warndog found nothing suspicious.')}\n\n` +
      chalk.gray('Your code passed the sniff test. Stay vigilant.'),
      { padding: 1, borderStyle: 'round', borderColor: 'green' }
    ));
    return;
  }

  const severityLine = [
    byLevel.critical ? chalk.bgRed.white(` ${byLevel.critical} CRITICAL `) : '',
    byLevel.high     ? chalk.red(` ${byLevel.high} HIGH`) : '',
    byLevel.medium   ? chalk.yellow(` ${byLevel.medium} MEDIUM`) : '',
    byLevel.low      ? chalk.blue(` ${byLevel.low} LOW`) : '',
  ].filter(Boolean).join(chalk.gray('  •  '));

  const topRuleLines = topRules.length
    ? '\n\n' + chalk.gray('Most frequent:') + '\n' +
      topRules.map(([id, cnt]) =>
        `  ${chalk.gray(figures.pointer)} ${chalk.white(id.padEnd(40))} ${chalk.yellow(cnt + 'x')}`
      ).join('\n')
    : '';

  const emoji = byLevel.critical > 0 ? '🚨' : byLevel.high > 0 ? '⚠️ ' : '🔍';

  console.log('\n' + boxen(
    `${emoji}  ${chalk.bold.white(`${total} suspicious pattern${total !== 1 ? 's' : ''} found`)}` +
    ` ${chalk.gray(`in ${results.length} file${results.length !== 1 ? 's' : ''}`)}\n\n` +
    severityLine +
    topRuleLines,
    {
      padding: 1,
      borderStyle: 'round',
      borderColor: byLevel.critical > 0 ? 'red' : byLevel.high > 0 ? 'yellow' : 'blue',
    }
  ));
}

// ──────────────────────────────────────────────
// Render full result set
// ──────────────────────────────────────────────

function printResults(results, opts = {}) {
  const minSeverityOrder = SEVERITY[opts.severity ?? 'low']?.order ?? 1;
  const minConfidence    = parseInt(opts.confidence ?? '0', 10);

  const filtered = results.map(r => ({
    ...r,
    warnings: r.warnings.filter(w =>
      (SEVERITY[w.severity]?.order ?? 1) >= minSeverityOrder &&
      (w.confidence ?? 0) >= minConfidence
    ),
  })).filter(r => r.warnings.length > 0);

  if (filtered.length === 0) {
    printSummary([]);
    return;
  }

  // Sort: critical first, then by file
  for (const result of filtered) {
    result.warnings.sort((a, b) =>
      (SEVERITY[b.severity]?.order ?? 1) - (SEVERITY[a.severity]?.order ?? 1)
    );
    printFileHeader(result.file, result.warnings.length);
    for (const warning of result.warnings) {
      console.log(formatWarning({ ...warning, file: result.file }));
    }
  }

  printSummary(filtered);
}

// ──────────────────────────────────────────────
// JSON output
// ──────────────────────────────────────────────

function printJSON(results) {
  const out = {
    version,
    timestamp: new Date().toISOString(),
    results,
    summary: {
      total: results.reduce((n, r) => n + r.warnings.length, 0),
      bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
      files: results.length,
    },
  };
  for (const r of results) {
    for (const w of r.warnings) {
      out.summary.bySeverity[w.severity] = (out.summary.bySeverity[w.severity] ?? 0) + 1;
    }
  }
  console.log(JSON.stringify(out, null, 2));
}

// ──────────────────────────────────────────────
// Watch-mode update header
// ──────────────────────────────────────────────

function printWatchUpdate(file) {
  const time = new Date().toLocaleTimeString();
  console.log(chalk.gray(`\n[${time}] `) + chalk.yellow('🐶 re-sniffing ') + chalk.cyan(file));
}

// ──────────────────────────────────────────────
// Rule explanation
// ──────────────────────────────────────────────

function printExplanation(explanation) {
  console.log('\n' + boxen(
    chalk.bold.white(explanation.ruleId) + '\n\n' +
    chalk.white(explanation.summary) + '\n\n' +
    chalk.gray('Why it matters:') + '\n' +
    chalk.white(explanation.whyItMatters) + '\n\n' +
    chalk.gray('Example:') + '\n' +
    chalk.red(explanation.badExample) + '\n\n' +
    (explanation.goodExample
      ? chalk.gray('Better approach:') + '\n' + chalk.green(explanation.goodExample)
      : ''),
    { padding: 1, borderStyle: 'round', borderColor: 'yellow' }
  ));
}

module.exports = {
  printBanner,
  printSniffing,
  printResults,
  printSummary,
  printJSON,
  printWatchUpdate,
  printExplanation,
  formatWarning,
  SEVERITY,
};
