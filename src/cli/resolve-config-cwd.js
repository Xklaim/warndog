'use strict';

const fs = require('fs');
const path = require('path');

function resolveConfigCwd(cwd, target, explicitConfigPath) {
  if (explicitConfigPath) return cwd;

  const targetPath = path.resolve(cwd, target);
  if (!fs.existsSync(targetPath)) return cwd;

  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) return targetPath;
  if (stat.isFile()) return path.dirname(targetPath);

  return cwd;
}

module.exports = { resolveConfigCwd };
