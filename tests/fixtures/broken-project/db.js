// Mock db module for fixture
module.exports = {
  findOne:        (q) => Promise.resolve({ id: 1, name: 'Test' }),
  findByEmail:    (e) => Promise.resolve({ id: 1, email: e, hash: '$2b$10$...' }),
  findUser:       (id, cb) => cb(null, { id, email: 'test@test.com' }),
  findOrders:     (id, cb) => cb(null, [{ id: 99 }]),
  findItems:      (id, cb) => cb(null, [{ name: 'Widget' }]),
  createUser:     (u) => Promise.resolve({ ...u, id: 1 }),
  delete:         (q) => Promise.resolve(true),
  query:          (q) => Promise.resolve([]),
  blacklistToken: (t) => Promise.resolve(true),
  save:           (u) => Promise.resolve(u),
};
