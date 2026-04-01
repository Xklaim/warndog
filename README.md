# warndog

`warndog` is a JavaScript and Node.js code scanner with a CLI-first workflow for catching bug-prone async, logic, complexity, and error-handling patterns.

It supports:

- Project scans for `.js`, `.mjs`, `.cjs`, and `.jsx`
- Live watch mode for re-analysis on save
- Runtime instrumentation for catching async failures while a script runs
- JSON, Markdown, and HTML reports
- Config discovery via `cosmiconfig`
- A small plugin API for custom rules

## Install

Use it globally as a CLI:

```bash
npm install -g warndog
warndog --help
```

Or keep it local to a project:

```bash
npm install --save-dev warndog
npx warndog .
```

Node.js `16+` is required.

## Quick Start

Create a starter config:

```bash
npx warndog init
```

Scan the current project:

```bash
npx warndog .
```

Watch a directory and re-scan changed files:

```bash
npx warndog watch src
```

Generate a report:

```bash
npx warndog report . --format markdown --output warndog-report.md
```

Explain warnings near a line:

```bash
npx warndog explain src/server.js:42
```

Run a script with runtime instrumentation:

```bash
npx warndog run ./scripts/job.js -- --arg-one value
```

## CLI

### Default scan

```bash
warndog [target]
```

Scans a file, directory, or glob. If omitted, the default target is `.`.

Common flags:

- `--config <path>`: use a specific config file
- `--ignore <patterns...>`: append ignore globs
- `--severity <level>`: minimum severity to report
- `--confidence <number>`: minimum confidence to report
- `--json`: print JSON instead of the pretty formatter
- `--debug`: print extra debugging detail
- `--quiet`: suppress non-essential output
- `--no-color`: disable ANSI colors

Exit codes:

- `0`: no high-severity findings
- `1`: at least one `high` finding
- `2`: at least one `critical` finding

### Subcommands

`warndog scan [target]`

- Full scan with optional `--depth`, `--include`, and experimental `--fix`

`warndog watch [target]`

- Watches files and re-runs analysis on save
- Supports `--debounce <ms>`

`warndog run <script> [args...]`

- Runs a Node.js script with the runtime interceptor preloaded
- Supports `--track-async`, `--track-nulls`, and `--timeout <ms>`

`warndog explain <file:line>`

- Explains warnings near a file location
- Use `--rule <id>` to explain a rule directly

`warndog report [target]`

- Writes a full report to disk
- Supports `--format json|html|markdown` and `--output <file>`

`warndog init`

- Writes a starter `warndog.config.js`
- Supports `--force`

## Configuration

`warndog` searches for config with `cosmiconfig` in:

- `warndog.config.js`
- `warndog.config.cjs`
- `.warndogrc`
- `.warndogrc.json`
- `.warndogrc.js`
- `package.json`

Example:

```js
/** @type {import('warndog').WarnDogConfig} */
module.exports = {
  include: ['src/**/*.js', '*.js'],
  ignore: [
    'node_modules/**',
    'dist/**',
    'coverage/**',
    '**/*.test.js',
  ],
  severity: 'low',
  confidence: 50,
  complexity: {
    cyclomaticThreshold: 10,
    nestingThreshold: 4,
    functionLengthMax: 80,
  },
  rules: {
    'missing-await': 'high',
    'floating-promise': 'high',
    'cyclomatic-complexity': 'medium',
  },
  plugins: [
    'warndog/plugins/react',
    './warndog.custom-plugin.js',
  ],
  output: {
    format: 'pretty',
    color: true,
  },
  debug: false,
};
```

### Config Reference

- `include?: string[]`: include globs to analyze
- `ignore?: string[]`: ignore globs
- `severity?: 'low' | 'medium' | 'high' | 'critical'`: minimum severity
- `confidence?: number`: minimum confidence percentage
- `rules?: Record<string, string | boolean | { severity: string }>`: enable, disable, or override a rule severity
- `plugins?: (string | Plugin)[]`: plugin module names, deep imports, local paths, or inline plugin objects
- `complexity?: { cyclomaticThreshold?: number; nestingThreshold?: number; functionLengthMax?: number }`
- `output?: { format?: 'pretty' | 'json'; color?: boolean }`
- `debug?: boolean`

## Built-In Rules

Async:

- `missing-await`
- `silent-promise`
- `floating-promise`

Logic:

- `impossible-condition`
- `accidental-assignment`
- `always-truthy-falsy`
- `inconsistent-return`

Variables:

- `shadowed-variable`
- `unused-critical`
- `const-mutation`

Complexity:

- `cyclomatic-complexity`
- `deep-nesting`
- `callback-hell`

Patterns:

- `risky-equality`
- `error-handling`

## Built-In Plugins

Two plugin modules ship with the package and can be referenced from config:

```js
module.exports = {
  plugins: [
    'warndog/plugins/express',
    'warndog/plugins/react',
  ],
};
```

`warndog/plugins/express` adds:

- `express/missing-error-middleware`
- `express/double-response`

`warndog/plugins/react` adds:

- `react/setstate-in-render`
- `react/useeffect-missing-deps`

## Programmatic API

```js
const { Engine, loadConfig, getAllRules } = require('warndog');

async function main() {
  const config = await loadConfig();
  const engine = new Engine(config);
  const results = await engine.analyzeTarget('src');

  console.log('rules:', getAllRules().length);
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

Main exports:

- `Engine`
- `loadConfig`
- `loadPlugins`
- `createPlugin`
- `createRule`
- `getAllRules`

## Writing Plugins

Local plugins can be module paths or inline objects.

```js
const { createPlugin, createRule } = require('warndog');

const noConsoleRule = createRule({
  id: 'custom/no-console',
  description: 'Detect console.log in application code',
  defaultSeverity: 'low',
  check({ ast }) {
    const warnings = [];
    const traverse = require('@babel/traverse').default;
    const t = require('@babel/types');

    traverse(ast, {
      CallExpression(path) {
        const callee = path.node.callee;
        if (!t.isMemberExpression(callee)) return;
        if (!t.isIdentifier(callee.object, { name: 'console' })) return;
        if (!t.isIdentifier(callee.property, { name: 'log' })) return;

        warnings.push({
          line: path.node.loc?.start.line,
          confidence: 95,
          message: 'console.log left in application code',
          suggestion: 'remove the call or route it through your logger',
        });
      },
    });

    return warnings;
  },
});

module.exports = createPlugin({
  name: 'custom-plugin',
  rules: [noConsoleRule],
});
```

Then reference it from `warndog.config.js`:

```js
module.exports = {
  plugins: ['./warndog.custom-plugin.js'],
};
```

Plugin contract:

- `name: string`
- `rules?: Rule[]`
- `setup?: (config) => void | Promise<void>`

Rule contract:

- `id: string`
- `description: string`
- `defaultSeverity: string`
- `check(ctx)` for per-file analysis
- `checkAll(results, config)` for cross-file analysis

## Reports

`warndog report` supports three output formats:

- `json`: machine-readable result payload
- `markdown`: shareable text report
- `html`: styled browser report

The JSON report includes:

- `version`
- `timestamp`
- `summary.total`
- `summary.bySeverity`
- `summary.files`
- `results`

## Development

Install dependencies:

```bash
npm install
```

Useful scripts:

```bash
npm run lint
npm test
npm run test:unit
npm run test:integration
npm run test:coverage
npm run pack:check
```

`npm run pack:check` performs a dry-run package build and prints the exact files that would be published.

## Publish Checklist

Before publishing a new version:

1. Update `version` in `package.json` or run `npm version patch|minor|major`.
2. Run `npm run lint`.
3. Run `npm test`.
4. Run `npm run pack:check`.
5. Review the generated file list and package size.
6. Publish with `npm publish` or `npm publish --access public` for a scoped public package.

The package includes a `prepublishOnly` safeguard that runs lint and tests during publish.

## Package Contents

The published package intentionally includes only:

- `bin/`
- `src/`
- `plugins/`
- `index.d.ts`
- npm-standard metadata files such as `package.json`, `README.md`, and `LICENSE`

Tests, local setup notes, and development-only files are excluded from the npm tarball.

## License

MIT. See [LICENSE](./LICENSE).
