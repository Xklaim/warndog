// warndog test fixture: intentionally broken async code
// This file should trigger: missing-await, silent-promise, floating-promise

const db = {
  findOne: async (q) => ({ id: 1, name: 'Alice' }),
  save:    async (doc) => doc,
};

// ── BROKEN: fetch not awaited inside async ────────────────────────────────────
async function loadUserProfile(id) {
  fetch(`/api/users/${id}`); // missing-await: result ignored
  return { status: 'loaded' };
}

// ── BROKEN: db call not awaited ───────────────────────────────────────────────
async function updateUserRole(userId, role) {
  const user = await db.findOne({ id: userId });
  user.role = role;
  db.save(user); // missing-await: save is not awaited
  return true;
}

// ── BROKEN: .then() chain with no .catch() ────────────────────────────────────
function fetchConfig() {
  fetch('/config')
    .then(r => r.json())
    .then(cfg => applyConfig(cfg)); // silent-promise: no .catch()
}

// ── BROKEN: floating promise outside async ────────────────────────────────────
function initApp() {
  fetch('/api/init'); // floating-promise: nobody handles this
  console.log('init called');
}

// ── CORRECT: everything awaited properly ─────────────────────────────────────
async function correctLoad(id) {
  const user = await db.findOne({ id });
  await db.save(user);
  return user;
}

module.exports = { loadUserProfile, updateUserRole, fetchConfig, initApp, correctLoad };
