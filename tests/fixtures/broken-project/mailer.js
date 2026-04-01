// Mock mailer module for fixture
module.exports = {
  sendWelcome:      (email)       => Promise.resolve(true),
  sendNotification: (email)       => Promise.resolve(true),
  notify:           (email, items, cb) => cb(null, { sent: true }),
};
