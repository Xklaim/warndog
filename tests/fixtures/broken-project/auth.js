/**
 * warndog test fixture: broken-project/auth.js
 * Intentionally broken authentication logic
 */

'use strict';

const jwt    = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db     = require('./db');

const SECRET = process.env.JWT_SECRET || 'dev-secret';

// ─── BUG: missing await on bcrypt.compare ────────────────────────────────────
async function login(email, password) {
  const user = await db.findByEmail(email);
  if (!user) return null;

  bcrypt.compare(password, user.hash); // ← not awaited! always undefined
  // Logic below runs before compare finishes:
  return generateToken(user);
}

// ─── BUG: inconsistent return + unused response ──────────────────────────────
async function refreshToken(token) {
  const decoded = await jwt.verify(token, SECRET); // ← result unused
  if (!decoded) {
    return { error: 'invalid token' };
  }
  if (decoded.exp < Date.now()) {
    return { error: 'expired' };
  }
  // ← implicit return undefined — no new token generated!
}

// ─── BUG: empty catch swallows JWT verification errors ───────────────────────
function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch (e) {
    // ← completely empty — expired/invalid tokens silently return undefined
  }
}

// ─── BUG: always-truthy check ────────────────────────────────────────────────
function hasPermission(user, requiredRoles) {
  if (requiredRoles) { // ← if requiredRoles is [], this is still truthy!
    return requiredRoles.includes(user.role);
  }
  return true;
}

// ─── BUG: risky equality for role check ──────────────────────────────────────
function isAdmin(user) {
  return user.role == 'admin'; // ← use ===
}

// ─── BUG: silent promise on token blacklist ───────────────────────────────────
async function logout(token) {
  db.blacklistToken(token)
    .then(() => console.log('logged out'))
  // ← no .catch — blacklist failure is invisible
}

function generateToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: '7d' });
}

module.exports = { login, refreshToken, verifyToken, hasPermission, isAdmin, logout };
