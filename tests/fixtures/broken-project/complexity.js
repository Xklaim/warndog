// warndog test fixture: complexity, nesting, variable patterns
// Triggers: cyclomatic-complexity, deep-nesting, shadowed-variable,
//           unused-critical, const-mutation, risky-equality

// ── BROKEN: extremely high cyclomatic complexity ──────────────────────────────
function processOrder(order, user, config) {
  if (!order) return null;
  if (!user) return null;
  if (order.status === 'pending') {
    if (order.type === 'digital') {
      if (user.verified) {
        if (config.allowDigital) {
          if (order.amount > 0) {
            if (order.amount < 10000) {
              if (user.balance >= order.amount) {
                return { approved: true };
              } else {
                return { approved: false, reason: 'insufficient_funds' };
              }
            } else if (order.amount >= 10000 && order.amount < 50000) {
              if (user.tier === 'premium') {
                return { approved: true, requiresReview: true };
              } else {
                return { approved: false, reason: 'tier_required' };
              }
            } else {
              return { approved: false, reason: 'exceeds_limit' };
            }
          }
        }
      }
    } else if (order.type === 'physical') {
      if (order.address && order.address.zip) {
        if (config.shippingZones.includes(order.address.zip)) {
          return { approved: true, shipping: true };
        }
      }
    }
  }
  return { approved: false, reason: 'unknown' };
}

// ── BROKEN: const reassignment ───────────────────────────────────────────────
function computeTotal(items) {
  const TAX_RATE = 0.08;
  let total = 0;
  for (const item of items) {
    total += item.price;
  }
  TAX_RATE = 0.10; // ← reassigning a const — TypeError at runtime!
  return total * (1 + TAX_RATE);
}

// ── BROKEN: shadowed variable ─────────────────────────────────────────────────
const config = { debug: false, version: '1.0' };

function loadConfig(path) {
  const config = require(path); // shadows outer config!
  return config;
}

// ── BROKEN: unused critical variable (API response ignored) ──────────────────
async function syncUsers() {
  const response = await fetch('/api/users'); // fetched but never used!
  return { synced: true };
}

// ── BROKEN: risky equality with type coercion ─────────────────────────────────
function isZero(val) {
  if (val == false) { // "0" == false is true; 0 == false is true; "false" == false is false
    return true;
  }
  return false;
}

// ── BROKEN: callback hell ─────────────────────────────────────────────────────
function oldStyleCode(userId) {
  getUser(userId, function(err, user) {
    getPermissions(user.id, function(err, perms) {
      getResources(perms, function(err, resources) {
        filterResources(resources, function(err, filtered) {
          // 4 levels of callback hell
          return filtered;
        });
      });
    });
  });
}

module.exports = { processOrder, computeTotal, loadConfig, syncUsers, isZero, oldStyleCode };
