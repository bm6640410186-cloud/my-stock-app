const Database = require('better-sqlite3');
const path = require('node:path');
const crypto = require('node:crypto');

const dbPath = process.env.DATABASE_URL || path.join(__dirname, 'stock.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

// สร้างตารางให้รองรับ ID ทุกรูปแบบ
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff'
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL
  );
`);

// เช็กและสร้าง admin เริ่มต้น
function initAdmin() {
  const existing = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
  if (!existing) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync('admin123', salt, 64).toString('hex');
    db.prepare('INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?)').run('admin', hash, salt, 'admin');
    console.log('[bootstrap] สร้างผู้ใช้เริ่มต้น username=admin password=admin123');
  }
}

initAdmin();

module.exports = { db };
