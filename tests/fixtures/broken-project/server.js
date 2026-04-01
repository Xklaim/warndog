/**
 * warndog test fixture: broken-project/server.js
 *
 * This file intentionally contains ALL the patterns warndog detects.
 * Run: warndog scan tests/fixtures/broken-project/
 */

'use strict';

const express = require('express');
const db      = require('./db');
const mailer  = require('./mailer');

const app = express();
app.use(express.json());

// ─── BUG 1: missing-await ────────────────────────────────────────────────────
// The user data is fetched but NOT awaited — res.json runs before db responds
app.get('/user/:id', async (req, res) => {
  db.findOne({ id: req.params.id }); // ← missing await
  res.json({ status: 'ok' });
});

// ─── BUG 2: unused-critical ──────────────────────────────────────────────────
// userData is fetched but completely ignored
app.get('/profile/:id', async (req, res) => {
  const userData = await db.findOne({ id: req.params.id }); // ← fetched, never used
  res.json({ message: 'profile loaded' });
});

// ─── BUG 3: silent-promise (no .catch) ───────────────────────────────────────
app.post('/register', (req, res) => {
  const { email, password } = req.body;

  db.createUser({ email, password })
    .then(user => mailer.sendWelcome(user.email))
    .then(() => res.json({ success: true }));
  // ← no .catch — any DB or mailer failure is silently swallowed
});

// ─── BUG 4: accidental-assignment in condition ───────────────────────────────
app.post('/login', (req, res) => {
  const { role } = req.body;
  if (role = 'admin') {   // ← should be === not =
    res.json({ admin: true });
  }
});

// ─── BUG 5: impossible condition ─────────────────────────────────────────────
app.get('/status', (req, res) => {
  const x = getStatus();
  if (x === x) { // ← always true, pointless comparison
    res.json({ ok: true });
  }
});

// ─── BUG 6: inconsistent return paths ────────────────────────────────────────
function validateToken(token) {
  if (!token) {
    return false;
  }
  if (token.length < 32) {
    return false;
  }
  if (token.startsWith('Bearer ')) {
    return token.slice(7); // returns a string
  }
  // ← implicit return undefined — inconsistent!
}

// ─── BUG 7: empty catch block ────────────────────────────────────────────────
app.delete('/user/:id', async (req, res) => {
  try {
    await db.delete({ id: req.params.id });
    res.json({ deleted: true });
  } catch (e) {
    // ← completely empty — errors here vanish
  }
});

// ─── BUG 8: shadowed variable ────────────────────────────────────────────────
const config = { timeout: 5000, retries: 3 };

function sendRequest(url) {
  const config = { url, method: 'GET' }; // ← shadows outer config!
  return fetch(config.url);
}

// ─── BUG 9: const mutation ───────────────────────────────────────────────────
const MAX_RETRIES = 3;

function retry(fn) {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try { return fn(); }
    catch (e) {
      MAX_RETRIES = MAX_RETRIES - 1; // ← TypeError at runtime!
    }
  }
}

// ─── BUG 10: deep nesting / cyclomatic complexity ────────────────────────────
function processOrder(order) {
  if (order) {
    if (order.items) {
      if (order.items.length > 0) {
        if (order.user) {
          if (order.user.verified) {
            if (order.payment) {
              if (order.payment.valid) {
                if (order.shipping) {
                  return { processed: true };
                }
              }
            }
          }
        }
      }
    }
  }
  return null;
}

// ─── BUG 11: always-truthy condition ─────────────────────────────────────────
app.get('/ping', (req, res) => {
  const tags = [];
  if (tags) { // ← [] is always truthy!
    res.json({ tags });
  } else {
    res.json({ tags: null }); // ← dead code — never runs
  }
});

// ─── BUG 12: callback hell ───────────────────────────────────────────────────
function loadEverything(userId, cb) {
  db.findUser(userId, (err, user) => {
    db.findOrders(user.id, (err, orders) => {
      db.findItems(orders[0].id, (err, items) => {
        mailer.notify(user.email, items, (err, result) => {
          cb(null, result); // ← 4 levels deep
        });
      });
    });
  });
}

// ─── BUG 13: risky equality ──────────────────────────────────────────────────
function checkCount(count) {
  if (count == '0') {  // ← string/number with ==
    return 'empty';
  }
  return 'has items';
}

// ─── BUG 14: floating promise (no await, no .then, no .catch) ────────────────
app.post('/notify', (req, res) => {
  mailer.sendNotification(req.body.email); // ← floating promise
  res.json({ queued: true });
});

// ─── Express BUG: No error middleware ────────────────────────────────────────
// (warndog-plugin-express will catch this)

function getStatus() { return 'ok'; }

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`listening on ${PORT}`));
