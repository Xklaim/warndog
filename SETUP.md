# 🐶 warndog — Setup, Local Dev & Publishing Guide

---

## 1. Prerequisites

- **Node.js 16+** (check with `node -v`)
- **npm 8+** (check with `npm -v`)
- An npm account if publishing (create one free at [npmjs.com](https://www.npmjs.com))

---

## 2. Install Dependencies

```bash
cd warndog
npm install
```

This installs:
- `@babel/parser` + `@babel/traverse` + `@babel/types` — AST engine
- `commander` — CLI parsing
- `chokidar` — file watcher
- `chalk`, `boxen`, `figures`, `ora` — terminal UI
- `glob`, `cosmiconfig`, `micromatch` — file resolution + config loading
- `jest` — test runner (dev)

---

## 3. Run the Tests

```bash
npm test                  # all tests
npm run test:unit         # unit tests only
npm run test:integration  # integration tests only
npm run test:coverage     # coverage report
```

All tests should pass before proceeding.

---

## 4. Link Locally (use `warndog` command on your machine)

```bash
# From inside the warndog directory:
npm link

# Now test it on any project:
cd /path/to/your-project
warndog
warndog watch
warndog init
```

To unlink later:
```bash
npm unlink -g warndog
```

---

## 5. Test on the Built-in Broken Project

```bash
# From the warndog directory:
node bin/warndog.js tests/fixtures/broken-project/

# Or after linking:
warndog tests/fixtures/broken-project/
```

You should see a batch of intentional warnings across async, logic, complexity, and error-handling categories.

---

## 6. Test Watch Mode

```bash
warndog watch tests/fixtures/broken-project/
# Then edit any .js file in that folder — warndog re-scans instantly
```

---

## 7. Test Runtime Mode

```bash
# Create a quick test script
echo "async function go() { fetch('/x') }; go();" > /tmp/test-runtime.js
warndog run /tmp/test-runtime.js
```

---

## 8. Verify the Binary Shebang

```bash
head -1 bin/warndog.js
# Should output: #!/usr/bin/env node
```

Make sure the file is executable:
```bash
chmod +x bin/warndog.js
```

---

## 9. Publish to npm

### 9a. Claim the package name

Check if `warndog` is available:
```bash
npm view warndog
# If it returns "404 Not Found" — the name is free
```

If taken, update the `"name"` field in `package.json` to something available,
e.g. `"@yourscope/warndog"` (scoped package) or `"warndog-cli"`.

### 9b. Log in to npm

```bash
npm login
# Enter your username, password, and OTP if 2FA is enabled
```

### 9c. Dry run (recommended first)

```bash
npm publish --dry-run
```

This shows exactly what files will be included without actually publishing.
Verify the list looks correct — it should NOT include `node_modules/`, `coverage/`, or test files.

### 9d. Publish

```bash
# First publish:
npm publish --access public

# Future releases — bump version first:
npm version patch   # 1.0.0 → 1.0.1  (bug fixes)
npm version minor   # 1.0.0 → 1.1.0  (new rules/features)
npm version major   # 1.0.0 → 2.0.0  (breaking changes)
npm publish
```

### 9e. Verify the publish

```bash
npm view warndog
npx warndog --version
```

---

## 10. Scoped Package (if `warndog` name is taken)

If publishing as `@yourname/warndog`:

```json
// package.json
{
  "name": "@yourname/warndog",
  "bin": {
    "warndog": "./bin/warndog.js"
  }
}
```

```bash
npm publish --access public
# Users install with:
npm install -g @yourname/warndog
```

---

## 11. Setting Up GitHub Actions (optional CI)

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [16, 18, 20]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test
```

---

## 12. Directory Overview

```
warndog/
├── bin/
│   └── warndog.js              ← CLI entry point (chmod +x this)
├── src/
│   ├── index.js                ← Public API exports
│   ├── cli/
│   │   ├── index.js            ← Commander setup + all commands
│   │   ├── commands/
│   │   │   ├── scan.js
│   │   │   ├── watch.js
│   │   │   ├── run.js
│   │   │   ├── explain.js
│   │   │   ├── report.js
│   │   │   └── init.js
│   │   └── output/
│   │       └── formatter.js    ← All terminal display logic
│   ├── engine/
│   │   ├── index.js            ← File collection + orchestration
│   │   └── rule-engine.js      ← Rule loading, filtering, execution
│   ├── parser/
│   │   ├── index.js            ← Babel parser wrapper
│   │   └── traversal.js        ← AST helpers used by all rules
│   ├── rules/
│   │   ├── index.js            ← Rule registry
│   │   ├── async/
│   │   │   ├── missing-await.js
│   │   │   ├── silent-promise.js
│   │   │   └── floating-promise.js
│   │   ├── logic/
│   │   │   ├── impossible-condition.js
│   │   │   ├── accidental-assignment.js
│   │   │   ├── always-truthy-falsy.js
│   │   │   └── inconsistent-return.js
│   │   ├── variables/
│   │   │   ├── shadowed-variable.js
│   │   │   ├── unused-critical.js
│   │   │   └── const-mutation.js
│   │   ├── complexity/
│   │   │   ├── cyclomatic.js
│   │   │   ├── deep-nesting.js
│   │   │   └── callback-hell.js
│   │   └── patterns/
│   │       ├── risky-equality.js
│   │       └── error-handling.js
│   ├── runtime/
│   │   └── interceptor.js      ← --require hook for `warndog run`
│   ├── plugins/
│   │   └── index.js            ← Plugin loader + createPlugin/createRule API
│   └── config/
│       └── index.js            ← Config loading via cosmiconfig
├── plugins/
│   ├── express/index.js        ← Express-specific rules
│   └── react/index.js          ← React-specific rules
├── tests/
│   ├── unit/rules/             ← Per-rule unit tests
│   ├── integration/            ← Full engine integration tests
│   └── fixtures/broken-project/← Intentionally broken JS for testing
├── warndog.config.js           ← Example config (generated by `warndog init`)
├── package.json
├── README.md
├── SETUP.md                    ← This file
├── CONTRIBUTING.md
└── LICENSE
```

---

## 13. Troubleshooting

**`warndog: command not found` after `npm link`**
→ Make sure `$(npm root -g)/../bin` is in your `PATH`.
→ Or use `node bin/warndog.js` directly.

**`Cannot find module '@babel/traverse'`**
→ Run `npm install` from the warndog directory.

**`Error: EACCES: permission denied` on npm link**
→ Use `sudo npm link` or fix your npm permissions:
  `npm config set prefix ~/.npm-global` then add to PATH.

**Tests fail with `Cannot find module '../../src/engine'`**
→ Run tests from the `warndog/` root: `cd warndog && npm test`

**Parse errors on valid JS**
→ The Babel parser supports all modern JS. If a file fails, check for
  truly invalid syntax or open an issue with a minimal repro.
