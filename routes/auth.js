const crypto = require('node:crypto');
const { db } = require('../db');
const SESSION_DAYS = 7;

function hashPassword(password, salt) {
  try {
    return crypto.scryptSync(password, salt, 64).toString('hex');
  } catch (err) {
    return '';
  }
}

function verifyUser(username, password) {
  try {
    const safeUsername = String(username || '');
    if (!safeUsername) return null;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(safeUsername);
    if (!user) return null;
    const hash = hashPassword(String(password || ''), user.salt);
    if (!hash || !user.password_hash) return null;
    const ok = crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.password_hash, 'hex'));
    return ok ? user : null;
  } catch (err) {
    console.error('verifyUser error:', err);
    return null;
  }
}

function createSession(userId) {
  try {
    const safeUserId = Number(userId) || 1;
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, safeUserId, expires);
    return { token, expires };
  } catch (err) {
    console.error('createSession error:', err);
    return null;
  }
}

function getSessionUser(token) {
  try {
    if (!token) return null;
    const safeToken = String(token || '');
    const row = db.prepare(`
      SELECT s.*, u.username, u.role, u.id as u_id FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ?
    `).get(safeToken);
    if (!row) return null;
    if (new Date(row.expires_at) < new Date()) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(safeToken);
      return null;
    }
    return { userId: row.u_id || row.user_id, username: row.username, role: row.role };
  } catch (err) {
    console.error('getSessionUser error:', err);
    return null;
  }
}

function destroySession(token) {
  try {
    const safeToken = String(token || '');
    db.prepare('DELETE FROM sessions WHERE token = ?').run(safeToken);
  } catch (err) {
    console.error('destroySession error:', err);
  }
}

function login(username, password) {
  try {
    const user = verifyUser(username, password);
    if (!user) return null;
    const userId = user.id || user.user_id || 1;
    const session = createSession(userId);
    if (!session) return null;
    return { token: session.token, user: { id: userId, username: user.username, role: user.role } };
  } catch (err) {
    console.error('login error:', err);
    return null;
  }
}

module.exports = { hashPassword, verifyUser, createSession, getSessionUser, destroySession, login };
