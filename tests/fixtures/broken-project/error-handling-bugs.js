/**
 * FIXTURE: error-handling-bugs.js
 * Intentional error-handling flaws for warndog testing.
 */

'use strict';

// ── Bug 1: Empty catch block ────────────────────────────────────────────────
async function connectToDatabase(url) {
  try {
    await db.connect(url);
    return true;
  } catch (e) {
    // Completely empty — error is silently swallowed
    // The caller gets 'undefined' back with no indication of failure
  }
}

// ── Bug 2: Catch with unused error param ────────────────────────────────────
async function fetchUserFromAPI(id) {
  try {
    const res = await fetch(`/api/users/${id}`);
    return await res.json();
  } catch (err) {
    // err is never used — we lose the stack trace
    console.log('Something went wrong fetching user');
    return null;
  }
}

// ── Bug 3: console.error missing the error object ───────────────────────────
async function processOrder(orderId) {
  try {
    const order = await db.findOrder(orderId);
    await db.processPayment(order);
    return order;
  } catch (error) {
    console.error('Order processing failed'); // ← error object not passed!
    return null;
  }
}

// ── Bug 4: Rethrowing as a new error, losing stack trace ────────────────────
async function validateSchema(data) {
  try {
    return schema.validate(data);
  } catch (originalErr) {
    throw new Error('Validation failed'); // ← original stack trace lost!
  }
}

// ── Bug 5: Promise chain without .catch() ───────────────────────────────────
function loadConfig(path) {
  return fs.promises.readFile(path)
    .then(data => JSON.parse(data))
    .then(config => validateConfig(config));
  // No .catch() — parse errors and validation errors disappear
}

// ── Bug 6: Nested try-catch swallowing errors ───────────────────────────────
async function importData(file) {
  try {
    const data = await readFile(file);
    try {
      await processData(data);
    } catch (innerErr) {
      // swallowed
    }
    return { success: true };
  } catch (outerErr) {
    return { success: false }; // outer error lost too
  }
}
