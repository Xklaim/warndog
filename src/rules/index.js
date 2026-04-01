'use strict';

// ── Async rules ──────────────────────────────────────────────────────────────
const missingAwait      = require('./async/missing-await');
const silentPromise     = require('./async/silent-promise');
const floatingPromise   = require('./async/floating-promise');

// ── Logic rules ──────────────────────────────────────────────────────────────
const impossibleCond    = require('./logic/impossible-condition');
const accidentalAssign  = require('./logic/accidental-assignment');
const alwaysTruthyFalsy = require('./logic/always-truthy-falsy');
const inconsistentReturn= require('./logic/inconsistent-return');

// ── Variable rules ───────────────────────────────────────────────────────────
const shadowedVariable  = require('./variables/shadowed-variable');
const unusedCritical    = require('./variables/unused-critical');
const constMutation     = require('./variables/const-mutation');

// ── Complexity rules ─────────────────────────────────────────────────────────
const cyclomaticComplex = require('./complexity/cyclomatic');
const deepNesting       = require('./complexity/deep-nesting');
const callbackHell      = require('./complexity/callback-hell');

// ── Pattern rules ────────────────────────────────────────────────────────────
const riskyEquality     = require('./patterns/risky-equality');
const errorHandling     = require('./patterns/error-handling');

const ALL_RULES = [
  // Async
  missingAwait,
  silentPromise,
  floatingPromise,

  // Logic
  impossibleCond,
  accidentalAssign,
  alwaysTruthyFalsy,
  inconsistentReturn,

  // Variables
  shadowedVariable,
  unusedCritical,
  constMutation,

  // Complexity
  cyclomaticComplex,
  deepNesting,
  callbackHell,

  // Patterns
  riskyEquality,
  errorHandling,
];

function getAllRules() {
  return ALL_RULES;
}

module.exports = { getAllRules };
