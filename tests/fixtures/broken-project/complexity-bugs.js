/**
 * FIXTURE: complexity-bugs.js
 * Intentionally over-complex code for warndog testing.
 */

'use strict';

// ── Bug 1: Extremely high cyclomatic complexity ─────────────────────────────
function processOrderLegacy(order, user, settings, flags) {
  if (!order) return null;
  if (!user) return null;
  if (order.status === 'pending') {
    if (user.role === 'admin') {
      if (settings.autoApprove) {
        if (order.amount > 0 && order.amount < 1000) {
          if (flags.fastTrack) {
            if (order.priority === 'high') {
              if (user.verified) {
                return { approved: true, fast: true };
              } else {
                return { approved: true, fast: false };
              }
            } else {
              if (order.dueDate && new Date(order.dueDate) < new Date()) {
                return { approved: true, overdue: true };
              }
              return { approved: true };
            }
          } else if (flags.batchMode) {
            if (order.batchId) {
              return { approved: true, batch: true };
            }
            return { queued: true };
          }
        } else if (order.amount >= 1000) {
          if (user.creditLimit && user.creditLimit > order.amount) {
            return { approved: true, credit: true };
          }
          return { approved: false, reason: 'credit_limit' };
        }
      }
    } else if (user.role === 'manager') {
      if (order.amount < 500) {
        return { approved: true };
      }
      return { approved: false, reason: 'needs_admin' };
    }
  } else if (order.status === 'approved') {
    return { alreadyApproved: true };
  } else if (order.status === 'rejected') {
    if (flags.allowResubmit) {
      return { resubmitted: true };
    }
    return { rejected: true };
  }
  return null;
}

// ── Bug 2: Callback hell ────────────────────────────────────────────────────
function syncAllData(callback) {
  db.getUsers((err, users) => {
    if (err) return callback(err);
    db.getOrders((err, orders) => {
      if (err) return callback(err);
      api.fetchPrices((err, prices) => {
        if (err) return callback(err);
        cache.invalidate((err) => {
          if (err) return callback(err);
          notify.sendAll(users, (err) => {
            if (err) return callback(err);
            callback(null, { users, orders, prices });
          });
        });
      });
    });
  });
}

// ── Bug 3: Deep nesting with early-return opportunities ──────────────────────
function validateAndProcess(req) {
  if (req) {
    if (req.body) {
      if (req.body.data) {
        if (Array.isArray(req.body.data)) {
          if (req.body.data.length > 0) {
            if (req.headers.authorization) {
              if (req.headers.authorization.startsWith('Bearer ')) {
                return processValidated(req.body.data);
              }
            }
          }
        }
      }
    }
  }
  return null;
}
