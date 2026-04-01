/**
 * FIXTURE: logic-bugs.js
 * Intentional logic flaws for warndog testing.
 */

'use strict';

// ── Bug 1: Accidental assignment in condition ──────────────────────────────
function checkAdminAccess(user) {
  if (user.role = 'admin') {   // Should be ===
    return true;
  }
  return false;
}

// ── Bug 2: Self-comparison (always true) ──────────────────────────────────
function isValidToken(token) {
  if (token === token) {       // Always true — likely meant something else
    return true;
  }
  return false;
}

// ── Bug 3: Array literal always truthy ─────────────────────────────────────
function hasPermissions(user) {
  const perms = [];
  if (perms) {                 // [] is ALWAYS truthy — empty array is truthy!
    return true;
  }
  return false;
}

// ── Bug 4: Inconsistent return paths ──────────────────────────────────────
function getOrderTotal(order) {
  if (order.items && order.items.length > 0) {
    const total = order.items.reduce((sum, item) => sum + item.price, 0);
    return total;
  }
  // Falls off the end — returns undefined
  // Callers doing: const total = getOrderTotal(order); total.toFixed(2)  → BOOM
}

// ── Bug 5: Dead if (false) block ───────────────────────────────────────────
function processPayment(amount) {
  if (false) {
    // This block is unreachable
    console.log('This will never run');
  }
  return amount * 1.0;
}

// ── Bug 6: Impossible typeof contradiction ──────────────────────────────────
function validateInput(value) {
  if (typeof value !== 'undefined' && typeof value === 'undefined') {
    // This condition is impossible — can never be both defined and undefined
    throw new Error('Invalid state');
  }
  return value;
}

// ── Bug 7: Constant self-comparison ──────────────────────────────────────
function isNaN_wrong(value) {
  // NaN !== NaN is the correct check, but this is comparing wrong variable
  if (value !== value) {  // only works for NaN — but may be confusing
    return true;
  }
  return false;
}
