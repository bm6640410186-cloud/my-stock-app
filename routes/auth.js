const crypto = require('node:crypto');
const { db } = require('../db')
const SESSION_DAYS = 7;

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyUser(username, password) {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return null;
  const hash = hashPassword(password, user.salt);
  const ok = crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.password_hash, 'hex'));
  return ok ? user : null;
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)').run(token, userId, expires);
  return { token, expires };
}

function getSessionUser(token) {
  if (!token) return null;
  const row = db.prepare(`
 SELECT s.*, u.username, u.role, u.id FROM sessions s
   JOIN users u ON u.id = s.user_id

    WHERE s.token = ?
  `).get(token);
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE token=?').run(token);
    return null;
return { userId: row.id || row.user_id, username: row.username, role: row.role };
  return { userId: row.user_id, username: row.username, role: row.role };
}

function destroySession(token) {
  db.prepare('DELETE FROM sessions WHERE token=?').run(token);
}

module.exports = { hashPassword, verifyUser, createSession, getSessionUser, destroySession };
