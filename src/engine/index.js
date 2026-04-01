'use strict';

const path       = require('path');
const fs         = require('fs');
const glob       = require('glob');
const { parse }  = require('../parser');
const RuleEngine = require('./rule-engine');
const { loadPlugins } = require('../plugins');

const JS_EXTENSIONS = ['.js', '.mjs', '.cjs', '.jsx'];

class Engine {
  constructor(config = {}) {
    this.config     = config;
    this.ruleEngine = null; // lazy-initialized
  }

  async init() {
    if (this.ruleEngine) return;
    const plugins    = await loadPlugins(this.config.plugins ?? [], this.config);
    this.ruleEngine  = new RuleEngine(this.config, plugins);
  }

  // ──────────────────────────────────────────────
  // Main entry: accepts file path or directory
  // ──────────────────────────────────────────────
  async analyzeTarget(targetPath) {
    await this.init();

    const stat = fs.existsSync(targetPath) ? fs.statSync(targetPath) : null;

    if (!stat) {
      // Treat as glob pattern
      const files = await resolveGlob(targetPath, this.config);
      return this.analyzeFiles(files);
    }

    if (stat.isFile()) {
      if (!isJsFile(targetPath)) return [];
      return this.analyzeFiles([targetPath]);
    }

    if (stat.isDirectory()) {
      const files = await collectJsFiles(targetPath, this.config);
      return this.analyzeFiles(files);
    }

    return [];
  }

  // ──────────────────────────────────────────────
  // Analyse a list of file paths
  // ──────────────────────────────────────────────
  async analyzeFiles(files) {
    const results = [];
    for (const file of files) {
      const result = await this.analyzeFile(file);
      if (result) results.push(result);
    }
    // Cross-file behavioural analysis
    await this.ruleEngine.runCrossFileRules(results);
    return results;
  }

  // ──────────────────────────────────────────────
  // Analyse a single file
  // ──────────────────────────────────────────────
  async analyzeFile(filePath) {
    let source;
    try {
      source = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      if (this.config.debug) console.error(`[engine] Cannot read ${filePath}:`, err.message);
      return null;
    }

    let ast;
    try {
      ast = parse(source, filePath);
    } catch (err) {
      if (this.config.debug) console.error(`[engine] Parse error in ${filePath}:`, err.message);
      // Return a parse-error pseudo-warning
      return {
        file:     path.relative(process.cwd(), filePath),
        filePath,
        warnings: [{
          ruleId:     'parse-error',
          severity:   'low',
          confidence: 100,
          line:       err.loc?.line ?? 1,
          column:     err.loc?.column,
          message:    `could not parse file — ${err.message}`,
          suggestion: 'Check for syntax errors or unsupported language features.',
        }],
      };
    }

    const warnings = await this.ruleEngine.run(ast, source, filePath);

    return {
      file:     path.relative(process.cwd(), filePath),
      filePath,
      warnings,
    };
  }
}

// ──────────────────────────────────────────────
// File collection helpers
// ──────────────────────────────────────────────

async function collectJsFiles(dir, config) {
  const { ignore = [], include, depth = 10 } = config;

  const baseIgnore = [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/*.min.js',
    ...ignore,
  ];

  const patterns = include ?? ['**/*.js', '**/*.mjs', '**/*.cjs', '**/*.jsx'];

  const files = [];
  for (const pattern of patterns) {
    const found = await glob.glob(pattern, {
      cwd:    dir,
      ignore: baseIgnore,
      absolute: true,
      maxDepth: depth,
    });
    files.push(...found);
  }

  // Deduplicate
  return [...new Set(files)].filter(isJsFile);
}

async function resolveGlob(pattern, config) {
  const cwd    = process.cwd();
  const ignore = ['**/node_modules/**', '**/.git/**', ...(config.ignore ?? [])];
  const files  = await glob.glob(pattern, { cwd, ignore, absolute: true });
  return files.filter(isJsFile);
}

function isJsFile(filePath) {
  return JS_EXTENSIONS.includes(path.extname(filePath).toLowerCase());
}

module.exports = { Engine };
