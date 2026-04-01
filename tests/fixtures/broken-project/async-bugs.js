/**
 * FIXTURE: async-bugs.js
 * This file contains intentional async bugs for warndog testing.
 * DO NOT use this code in production.
 */

'use strict';

const db    = require('./fake-db');
const fetch = require('node-fetch');

// ── Bug 1: Missing await inside async function ─────────────────────────────
async function loadUserProfile(userId) {
  // warndog should flag: fetch is not awaited
  fetch(`/api/users/${userId}`);
  return { status: 'loading' };
}

// ── Bug 2: Promise chain without .catch() ──────────────────────────────────
function getUserData(id) {
  return fetch(`/api/users/${id}`)
    .then(res => res.json())
    .then(data => processData(data));
  // No .catch() — errors vanish silently
}

// ── Bug 3: Floating promise (neither awaited nor chained) ──────────────────
function deleteUser(id) {
  db.remove({ id });  // Returns a Promise, but it's completely ignored
  return { success: true }; // This returns BEFORE the DB operation completes
}

// ── Bug 4: Unawaited save in loop ──────────────────────────────────────────
async function saveAllUsers(users) {
  for (const user of users) {
    db.save(user); // Should be: await db.save(user)
  }
  return 'saved';
}

// ── Bug 5: Multiple unawaited calls ───────────────────────────────────────
async function syncData() {
  db.find({ active: true });
  db.update({ synced: false }, { synced: true });
  return 'done'; // Both DB calls are fire-and-forget
}

function processData(data) {
  return data;
}
