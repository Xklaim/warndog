// warndog test fixture: broken error handling
// Triggers: error-handling, impossible-condition, accidental-assignment

// ── BROKEN: empty catch ───────────────────────────────────────────────────────
async function readConfig(path) {
  try {
    const fs = require('fs');
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (e) {
    // error silently swallowed — warndog should catch this
  }
}

// ── BROKEN: catch with no error object in console.error ─────────────────────
async function saveToDatabase(data) {
  try {
    await db.insert(data);
  } catch (err) {
    console.error('Database insert failed'); // err not included — lost stack trace
  }
}

// ── BROKEN: catch param never used ───────────────────────────────────────────
function parseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (parseError) {
    console.log('could not parse'); // parseError never referenced
    return null;
  }
}

// ── BROKEN: accidental assignment in condition ────────────────────────────────
function checkAdmin(user) {
  if (user.role = 'admin') { // meant ===, used =
    return true;
  }
  return false;
}

// ── BROKEN: impossible self-comparison ───────────────────────────────────────
function isReady(status) {
  if (status === status) { // always true — meaningless
    return true;
  }
}

// ── BROKEN: literal condition ─────────────────────────────────────────────────
function featureFlag() {
  if (false) {
    // dead code — never executes
    enableNewFeature();
  }
  return legacyBehaviour();
}

// ── CORRECT: proper error handling ───────────────────────────────────────────
async function correctSave(data) {
  try {
    await db.insert(data);
  } catch (err) {
    console.error('Database insert failed:', err);
    throw err;
  }
}

module.exports = { readConfig, saveToDatabase, parseJSON, checkAdmin, isReady, featureFlag, correctSave };
