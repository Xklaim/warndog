'use strict';
// Fake DB stub used by test fixtures
module.exports = {
  find:        () => Promise.resolve([]),
  findOne:     () => Promise.resolve(null),
  findOrder:   () => Promise.resolve({}),
  save:        () => Promise.resolve(true),
  update:      () => Promise.resolve(true),
  remove:      () => Promise.resolve(true),
  connect:     () => Promise.resolve(true),
  query:       () => Promise.resolve([]),
  processPayment: () => Promise.resolve(true),
};
