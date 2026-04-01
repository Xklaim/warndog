'use strict';

const path  = require('path');
const fs    = require('fs');
const chalk = require('chalk');
const ora   = require('ora');
const { loadConfig } = require('../../config');
const { Engine }     = require('../../engine');
const { version }    = require('../../../package.json');

async function handler(target, opts = {}) {
  const cwd        = process.cwd();
  const config     = await loadConfig(opts.config, cwd);
  const targetPath = path.resolve(cwd, target);
  const outputFile = path.resolve(cwd, opts.output ?? 'warndog-report.json');
  const format     = opts.format ?? 'json';

  const spinner = ora({ text: chalk.gray('Analysing…'), spinner: 'dots2' }).start();

  let results;
  try {
    const engine = new Engine({ ...config, debug: opts.debug });
    results = await engine.analyzeTarget(targetPath);
    spinner.succeed(chalk.gray(`Analysed ${results.length} file${results.length !== 1 ? 's' : ''}`));
  } catch (err) {
    spinner.fail('Analysis failed');
    console.error(chalk.red('[warndog]'), err.message);
    if (opts.debug) console.error(err.stack);
    process.exit(1);
  }

  let content;
  switch (format) {
    case 'html':
      content = generateHtmlReport(results);
      break;
    case 'markdown':
    case 'md':
      content = generateMarkdownReport(results);
      break;
    default:
      content = JSON.stringify(buildJsonReport(results), null, 2);
  }

  fs.writeFileSync(outputFile, content, 'utf8');
  console.log(chalk.green(`\n✅  Report written to ${path.relative(cwd, outputFile)}`));
}

function buildJsonReport(results) {
  const total   = results.reduce((n, r) => n + r.warnings.length, 0);
  const bySev   = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const r of results) for (const w of r.warnings) bySev[w.severity] = (bySev[w.severity] ?? 0) + 1;

  return { version, timestamp: new Date().toISOString(), summary: { total, bySeverity: bySev, files: results.length }, results };
}

function generateMarkdownReport(results) {
  const json  = buildJsonReport(results);
  const lines = [
    '# 🐶 Warndog Report',
    '',
    `Generated: ${json.timestamp}  |  warndog v${json.version}`,
    '',
    '## Summary',
    '',
    '| Severity | Count |',
    '|----------|-------|',
    ...Object.entries(json.summary.bySeverity).map(([s, c]) => `| ${s} | ${c} |`),
    `| **Total** | **${json.summary.total}** |`,
    '',
    '## Findings',
    '',
  ];

  for (const result of results) {
    if (!result.warnings.length) continue;
    lines.push(`### \`${result.file}\``);
    lines.push('');
    for (const w of result.warnings) {
      lines.push(`**[${w.severity.toUpperCase()}]** Line ${w.line} · \`${w.ruleId}\` · confidence ${w.confidence}%`);
      lines.push('');
      lines.push(`> ${w.message}`);
      if (w.suggestion) lines.push(`> 💡 ${w.suggestion}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

function generateHtmlReport(results) {
  const json = buildJsonReport(results);

  const warningCards = results.flatMap(r =>
    r.warnings.map(w => `
      <div class="warning ${w.severity}">
        <div class="warning-header">
          <span class="badge ${w.severity}">${w.severity.toUpperCase()}</span>
          <code class="location">${r.file}:${w.line}</code>
          <span class="rule-id">${w.ruleId}</span>
          <span class="confidence">conf: ${w.confidence}%</span>
        </div>
        <p class="message">${escapeHtml(w.message)}</p>
        ${w.suggestion ? `<p class="suggestion">💡 ${escapeHtml(w.suggestion)}</p>` : ''}
      </div>
    `)
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>🐶 Warndog Report</title>
<style>
  :root { --bg: #0f1117; --surface: #1a1d27; --border: #2d3147; --text: #e2e8f0; --muted: #64748b; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 2rem; }
  h1 { font-size: 2rem; margin-bottom: 0.5rem; }
  .subtitle { color: var(--muted); margin-bottom: 2rem; }
  .summary { display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap; }
  .stat { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1rem 1.5rem; min-width: 120px; }
  .stat-value { font-size: 2rem; font-weight: bold; }
  .stat-label { color: var(--muted); font-size: 0.875rem; }
  .warning { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 0.75rem; border-left: 4px solid var(--border); }
  .warning.critical { border-left-color: #ef4444; }
  .warning.high     { border-left-color: #f97316; }
  .warning.medium   { border-left-color: #eab308; }
  .warning.low      { border-left-color: #3b82f6; }
  .warning-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
  .badge { font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; }
  .badge.critical { background: #ef444420; color: #ef4444; }
  .badge.high     { background: #f9731620; color: #f97316; }
  .badge.medium   { background: #eab30820; color: #eab308; }
  .badge.low      { background: #3b82f620; color: #3b82f6; }
  .location { background: #ffffff10; padding: 2px 8px; border-radius: 4px; font-size: 0.875rem; }
  .rule-id { color: var(--muted); font-size: 0.8rem; }
  .confidence { color: var(--muted); font-size: 0.8rem; margin-left: auto; }
  .message { color: var(--text); font-size: 0.9rem; }
  .suggestion { color: #4ade80; font-size: 0.85rem; margin-top: 0.35rem; }
</style>
</head>
<body>
<h1>🐶 Warndog Report</h1>
<p class="subtitle">Generated ${json.timestamp} · warndog v${json.version}</p>

<div class="summary">
  <div class="stat"><div class="stat-value">${json.summary.total}</div><div class="stat-label">Total Warnings</div></div>
  <div class="stat"><div class="stat-value" style="color:#ef4444">${json.summary.bySeverity.critical}</div><div class="stat-label">Critical</div></div>
  <div class="stat"><div class="stat-value" style="color:#f97316">${json.summary.bySeverity.high}</div><div class="stat-label">High</div></div>
  <div class="stat"><div class="stat-value" style="color:#eab308">${json.summary.bySeverity.medium}</div><div class="stat-label">Medium</div></div>
  <div class="stat"><div class="stat-value" style="color:#3b82f6">${json.summary.bySeverity.low}</div><div class="stat-label">Low</div></div>
</div>

${warningCards}

</body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { handler };
