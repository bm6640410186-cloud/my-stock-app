const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'stockuniform.db');
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
fs.mkdirSync(dbDir, { recursive: true });
}
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff', -- admin | staff
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suppliers (
  supplier_id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_name TEXT NOT NULL,
  lead_time INTEGER NOT NULL DEFAULT 7,
  contact TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  product_id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE NOT NULL,
  product_name TEXT NOT NULL,
  category TEXT NOT NULL,
  gender TEXT DEFAULT '',
  size TEXT NOT NULL,
  color TEXT DEFAULT '',
  cost_price REAL NOT NULL DEFAULT 0,
  selling_price REAL NOT NULL DEFAULT 0,
  minimum_stock INTEGER NOT NULL DEFAULT 0,
  reorder_point INTEGER NOT NULL DEFAULT 0,
  safety_stock INTEGER NOT NULL DEFAULT 0,
  avg_daily_sales REAL NOT NULL DEFAULT 0,
  max_daily_sales REAL NOT NULL DEFAULT 0,
  supplier_id INTEGER REFERENCES suppliers(supplier_id) ON DELETE SET NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock (
  stock_id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER UNIQUE NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock_transactions (
  transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL, -- receive | sale | adjust | return | po_receive
  quantity INTEGER NOT NULL, -- signed: + เข้า, - ออก
  reference TEXT,
  note TEXT,
  created_by INTEGER REFERENCES users(user_id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales (
  sale_id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  selling_price REAL NOT NULL,
  sold_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  purchase_order_id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(supplier_id),
  status TEXT NOT NULL DEFAULT 'draft', -- draft | ordered | received | cancelled
  created_by INTEGER REFERENCES users(user_id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  received_at TEXT
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(purchase_order_id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(product_id),
  quantity INTEGER NOT NULL,
  unit_cost REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_product ON sales(product_id, sold_at);
CREATE INDEX IF NOT EXISTS idx_txn_product ON stock_transactions(product_id, created_at);
`);

// Bootstrap: create one admin user if no users exist yet (not "mock data" — just so the system is loginable on first run)
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
if (userCount === 0) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync('admin123', salt, 64).toString('hex');
  db.prepare('INSERT INTO users (username, password_hash, salt, role) VALUES (?,?,?,?)')
    .run('admin', hash, salt, 'admin');
  console.log('[bootstrap] สร้างผู้ใช้เริ่มต้น username=admin password=admin123 (กรุณาเปลี่ยนรหัสผ่านทันทีหลังเข้าใช้งานครั้งแรก)');
}

module.exports = { db };
