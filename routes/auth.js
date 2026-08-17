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
    SELECT s.*, u.username, u.role, u.user_id FROM sessions s
    JOIN users u ON u.user_id = s.user_id
    WHERE s.token = ?
  `).get(token);
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE token=?').run(token);
    return null;
  }
  return { userId: row.user_id, username: row.username, role: row.role };
}

function destroySession(token) {
  db.prepare('DELETE FROM sessions WHERE token=?').run(token);
}

module.exports = { hashPassword, verifyUser, createSession, getSessionUser, destroySession };



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

{
  "name": "stockuniform-ai",
  "version": "1.0.0",
  "description": "ระบบจัดการสต็อกอัจฉริยะสำหรับร้านขายชุดนักศึกษา",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "seed:demo": "node seed_demo.js"
  },
  "engines": {
    "node": ">=22.5.0"
  },
  "license": "UNLICENSED",
  "private": true
}

# StockUniform AI — ระบบจัดการสต็อกร้านชุดนักศึกษา

ระบบจัดการสต็อก, การขาย, การรับสินค้า, การสั่งซื้อ และคำแนะนำ AI/Smart Reorder
สำหรับร้านขายชุดนักศึกษา พัฒนาต่อยอดจาก Prototype เดิม (คงดีไซน์/สี/ภาษาไทยเดิมไว้)
โดยเปลี่ยนจาก Mock Data ทั้งหมดเป็นฐานข้อมูลจริง

---

## 1. Technology Stack ที่เลือก

| ส่วน | เทคโนโลยี | เหตุผล |
|---|---|---|
| Backend | Node.js `http` module (built-in) | **ไม่ต้อง `npm install` เลย** รันได้ทันทีด้วย Node.js อย่างเดียว ลดความเสี่ยงเรื่อง dependency/version ตอนติดตั้งบนเครื่องใหม่ |
| Database | SQLite ผ่าน `node:sqlite` (built-in ตั้งแต่ Node 22.5+) | ไฟล์เดียว ไม่ต้องตั้ง DB server แยก, backup คือการ copy ไฟล์, เพียงพอสำหรับร้านค้าขนาดเล็ก-กลาง |
| Frontend | Vanilla HTML/CSS/JavaScript | รักษาโครงสร้าง/ดีไซน์จาก Prototype เดิมได้ตรงที่สุด โดยไม่ต้องมี build step |
| Auth | Session-based (cookie + token ในตาราง `sessions`) + `crypto.scrypt` สำหรับ hash รหัสผ่าน | ไม่ต้องพึ่ง library ภายนอก ปลอดภัยเพียงพอสำหรับระบบขนาดนี้ |

**หมายเหตุ:** ทุกอย่างใช้แค่ Node.js built-in ทั้งหมด — เปิดโปรเจกต์แล้ว `node server.js` รันได้ทันที ไม่มีขั้นตอน install ที่อาจพังเพราะ network/version ของ package

---

## 2. โครงสร้าง Project

```
stockuniform/
├── server.js              # HTTP server + route dispatch (Backend/API)
├── db.js                  # Database schema + connection (Database)
├── auth.js                # Password hashing, session management
├── ruleEngine.js           # AI/Smart Reorder — คำนวณ ROP, Safety Stock, คำแนะนำสั่งซื้อ
├── utils.js                # Helper: JSON response, body parsing, error messages ภาษาไทย
├── seed_demo.js            # สคริปต์ข้อมูลตัวอย่าง (ทางเลือก ไม่รันอัตโนมัติ)
├── package.json
├── .env.example
├── routes/
│   ├── auth.js             # login / logout
│   ├── products.js         # CRUD สินค้า, รับสินค้าเข้า, ปรับสต็อก
│   ├── sales.js             # บันทึกการขาย
│   ├── suppliers.js         # CRUD supplier
│   ├── purchaseOrders.js    # ใบสั่งซื้อ + state machine
│   └── ai.js                 # คำแนะนำ AI, dead stock, dashboard
├── public/                  # Frontend (Vanilla JS)
│   ├── login.html
│   ├── index.html
│   ├── app.js
│   └── styles.css
└── data/                     # ไฟล์ฐานข้อมูล SQLite จะถูกสร้างที่นี่ตอนรันครั้งแรก
```

Frontend / Backend / Database แยกกันชัดเจน: `public/` คุย API ผ่าน `fetch()` เท่านั้น,
`routes/*.js` คุยกับ `db.js` เท่านั้น ไม่มีการเข้าถึง DB ตรงจาก frontend

---

## 3. ตาราง Database ทั้งหมด

| ตาราง | หน้าที่ |
|---|---|
| `users` | บัญชีผู้ใช้ (admin/staff) |
| `sessions` | session การ login |
| `suppliers` | ข้อมูล supplier, lead time |
| `products` | สินค้า + ค่า cache ที่ AI คำนวณ (avg_daily_sales, reorder_point, safety_stock) |
| `stock` | จำนวนคงเหลือปัจจุบันต่อสินค้า |
| `stock_transactions` | ประวัติการเคลื่อนไหวสต็อกทุกครั้ง (รับเข้า/ขาย/ปรับยอด/รับตาม PO) |
| `sales` | ประวัติการขายจริง (ใช้คำนวณ AI) |
| `purchase_orders` | หัวใบสั่งซื้อ + สถานะ (draft→ordered→received/cancelled) |
| `purchase_order_items` | รายการสินค้าในแต่ละใบสั่งซื้อ |

ดู schema แบบเต็มได้ที่ `db.js`

---

## 4. Function ที่ทำเสร็จแล้ว (ทดสอบผ่านจริงด้วย headless browser)

- [x] Login / Logout / Session / Protected routes / แบ่งสิทธิ์ admin-staff
- [x] CRUD สินค้า (เพิ่ม/แก้ไข/ลบ [soft-delete]/ค้นหา/กรองหมวดหมู่/กรองสถานะสต็อก)
- [x] ดูประวัติการเคลื่อนไหวสต็อกรายสินค้า
- [x] รับสินค้าเข้าสต็อก (เพิ่ม stock + บันทึก transaction)
- [x] ขายสินค้า/ตัดสต็อก (ป้องกันขายเกินสต็อกจริง)
- [x] AI/Smart Reorder: คำนวณ Avg/Max Daily Sales, Safety Stock, Reorder Point, ปริมาณแนะนำสั่ง จากข้อมูลขายจริง 30 วันล่าสุด
- [x] วิเคราะห์สินค้าค้างสต็อก (30/60/90 วัน) จากวันขายล่าสุดจริง
- [x] Dashboard ดึงข้อมูลจาก database จริงทั้งหมด (ไม่ hardcode)
- [x] ใบสั่งซื้อ: สร้าง, เปลี่ยนสถานะ (draft→ordered→received/cancelled), รับสินค้าอัตโนมัติเพิ่ม stock เมื่อ received
- [x] จัดการ Supplier (CRUD, ป้องกันลบถ้ามีสินค้าผูกอยู่)
- [x] Validation + Error message ภาษาไทย, Loading/Empty state, Confirm ก่อนลบ, กัน SKU ซ้ำ, กันสต็อกติดลบ
- [x] Responsive (Desktop/Tablet/Mobile)

## 5. Function ที่ยังไม่ได้ทำ / ข้อจำกัดที่ควรรู้

- [ ] **ไม่มี URL สาธารณะ** — รันได้เฉพาะ local (`localhost`) ต้อง deploy เองถ้าต้องการให้คนอื่นเข้าถึงจากอินเทอร์เน็ต (ดูข้อ 8)
- [ ] ยังไม่มีหน้า "เปลี่ยนรหัสผ่าน" ในตัวเว็บ (ต้องแก้ผ่าน database โดยตรงในตอนนี้)
- [ ] ยังไม่มี Machine Learning จริง — ใช้ Rule-based/Statistical ตามที่ระบุไว้ตั้งแต่ต้น (โครงสร้างรองรับให้เพิ่มได้ในอนาคต โดยสลับเฉพาะฟังก์ชันใน `ruleEngine.js`)
- [ ] ยังไม่มีระบบ import สินค้าจาก CSV/Excel (เพิ่มได้ทีหลังถ้าต้องการ)
- [ ] `node:sqlite` เป็น experimental API ของ Node.js (อาจมีการเปลี่ยนแปลงในเวอร์ชันอนาคต) — เพียงพอสำหรับใช้งานจริงระดับร้านค้าเดี่ยว แต่ควรติดตามความเปลี่ยนแปลงหาก upgrade Node.js เวอร์ชันใหญ่

---

## 6. วิธี Run Project

**ข้อกำหนด:** Node.js เวอร์ชัน 22.5.0 ขึ้นไป (มี `node:sqlite` built-in) — เช็คด้วย `node -v`

```bash
# 1. แตกไฟล์ที่ดาวน์โหลด แล้วเข้าไปในโฟลเดอร์
cd stockuniform

# 2. (ไม่บังคับ) ใส่ข้อมูลตัวอย่างเพื่อทดสอบระบบ
node seed_demo.js

# 3. รันเซิร์ฟเวอร์
node server.js
```

จะเห็นข้อความ `StockUniform AI server running at http://localhost:3000`
**เปิดเบราว์เซอร์ไปที่ `http://localhost:3000`**

ผู้ใช้เริ่มต้น (สร้างอัตโนมัติตอนรันครั้งแรก):
- **username:** `admin`
- **password:** `admin123`
- ⚠️ กรุณาเปลี่ยนรหัสผ่านทันทีหลังใช้งานครั้งแรก (ดูวิธีในข้อ 9)

---

## 7. วิธีเชื่อม Database

ไม่ต้องตั้งค่าอะไรเพิ่ม — ไฟล์ฐานข้อมูล SQLite จะถูกสร้างอัตโนมัติที่ `data/stockuniform.db`
เมื่อรัน `node server.js` ครั้งแรก (ถ้ายังไม่มีไฟล์)

ถ้าต้องการเปลี่ยนตำแหน่งไฟล์ฐานข้อมูล ตั้งค่า environment variable `DB_PATH` (ดูข้อ 8)

---

## 8. Environment Variables ที่ต้องตั้งค่า

คัดลอก `.env.example` เป็น `.env` (ไม่บังคับ — มีค่า default ให้แล้ว):

| ตัวแปร | ค่า default | คำอธิบาย |
|---|---|---|
| `PORT` | `3000` | พอร์ตที่เว็บเซิร์ฟเวอร์รัน |
| `DB_PATH` | `./data/stockuniform.db` | ตำแหน่งไฟล์ฐานข้อมูล |

**ไม่มี API Key หรือ Secret ใดๆ ที่ต้องตั้งค่า** เพราะระบบนี้ยังไม่ได้เชื่อมกับ LLM API ภายนอก
(ส่วน AI ทั้งหมดเป็น Rule-based คำนวณในเครื่อง ไม่ได้เรียก API ภายนอก)

---

## 9. วิธี Deploy เว็บไซต์ให้เข้าถึงจากอินเทอร์เน็ตได้จริง

โปรเจกต์นี้รันแบบ local เท่านั้นในตอนนี้ ถ้าต้องการ URL สาธารณะ แนะนำ:

1. **Railway / Render** (ง่ายที่สุดสำหรับ Node.js + ไฟล์ SQLite):
   - สร้าง repo Git แล้ว push โค้ดนี้ขึ้น GitHub
   - เชื่อม repo กับ Railway/Render, ตั้งค่า Start Command เป็น `node server.js`
   - ตั้งค่า persistent volume/disk ให้ mount ที่ path เดียวกับ `DB_PATH` (มิฉะนั้นข้อมูลจะหายเมื่อ redeploy)
2. หากต้องการ scale ขึ้นในอนาคต (ผู้ใช้พร้อมกันเยอะ) ควรย้ายจาก SQLite ไป PostgreSQL — โครงสร้าง `db.js`/`routes/*.js` เขียนเป็น SQL ตรงๆ จึงย้ายได้โดยปรับ query ให้เข้ากับ driver ใหม่

## 10. วิธี Backup Database

เนื่องจากเป็น SQLite (ไฟล์เดียว) การ backup ทำได้ง่ายมาก:

```bash
# Backup
cp data/stockuniform.db backups/stockuniform-$(date +%Y%m%d).db

# กู้คืนจาก backup
cp backups/stockuniform-20260815.db data/stockuniform.db
```

แนะนำตั้ง cron job รัน backup อัตโนมัติทุกวัน ถ้านำไปใช้งานจริง

---

## 11. วิธีเปลี่ยนรหัสผ่าน admin (ชั่วคราว — ยังไม่มีหน้าในเว็บ)

```bash
node -e "
const crypto = require('node:crypto');
const { db } = require('./db');
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync('รหัสผ่านใหม่ตรงนี้', salt, 64).toString('hex');
db.prepare('UPDATE users SET password_hash=?, salt=? WHERE username=?').run(hash, salt, 'admin');
console.log('เปลี่ยนรหัสผ่านเรียบร้อย');
"
```

// ============================================================
// AI / Smart Reorder Rule Engine
// สูตรอ้างอิงจาก Prototype เดิม: ROP = (avgDaily * leadTime) + safetyStock
// เป็น Rule-based / Statistical model ที่อธิบายได้ทุกขั้นตอน (ไม่ใช่ Machine Learning)
// ออกแบบเป็น pure function แยกจาก DB/HTTP เพื่อให้ทดสอบและอัปเกรดเป็น ML ในอนาคตได้ง่าย
// ============================================================
const { db } = require('./db');

const SALES_WINDOW_DAYS = 30; // ใช้ยอดขาย 30 วันล่าสุดในการคำนวณค่าเฉลี่ย

/** ดึงสถิติยอดขายจริงของสินค้าจากตาราง sales */
function getSalesStats(productId) {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(quantity), 0) as total_qty,
      COUNT(DISTINCT date(sold_at)) as active_days,
      MAX(sold_at) as last_sale_at
    FROM sales
    WHERE product_id = ? AND sold_at >= datetime('now', ?)
  `).get(productId, `-${SALES_WINDOW_DAYS} days`);

  const dailyRows = db.prepare(`
    SELECT date(sold_at) as d, SUM(quantity) as qty
    FROM sales
    WHERE product_id = ? AND sold_at >= datetime('now', ?)
    GROUP BY date(sold_at)
  `).all(productId, `-${SALES_WINDOW_DAYS} days`);

  const avgDailySales = row.total_qty > 0 ? row.total_qty / SALES_WINDOW_DAYS : 0;
  const maxDailySales = dailyRows.length ? Math.max(...dailyRows.map(r => r.qty)) : 0;

  const lastSaleRow = db.prepare(
    `SELECT MAX(sold_at) as last_sale_at FROM sales WHERE product_id = ?`
  ).get(productId);

  return {
    avgDailySales: Math.round(avgDailySales * 100) / 100,
    maxDailySales,
    lastSaleAt: lastSaleRow.last_sale_at || null,
  };
}

function computeSafetyStock(avgDailySales, maxDailySales, leadTime) {
  return Math.max(1, Math.round((maxDailySales - avgDailySales) * leadTime));
}

function computeReorderPoint(avgDailySales, leadTime, safetyStock) {
  return Math.round(avgDailySales * leadTime + safetyStock);
}

function computeRecommendedQty(avgDailySales, leadTime, safetyStock, currentStock) {
  const demandDuringLeadTime = Math.round(avgDailySales * leadTime);
  const target = demandDuringLeadTime + safetyStock;
  return { demandDuringLeadTime, target, qty: Math.max(0, target - currentStock) };
}

/** คำนวณใหม่ทั้งหมดสำหรับสินค้า 1 รายการ แล้วเก็บ cache ไว้ในตาราง products
 *  (ตัวเลขที่ใช้จริงในการตัดสินใจยังคำนวณสดจาก sales/stock เสมอ อันนี้แค่ cache เพื่อ query เร็ว)
 */
function recalcProduct(productId) {
  const product = db.prepare('SELECT * FROM products WHERE product_id = ?').get(productId);
  if (!product) return null;
  const supplier = product.supplier_id
    ? db.prepare('SELECT * FROM suppliers WHERE supplier_id = ?').get(product.supplier_id)
    : null;
  const leadTime = supplier ? supplier.lead_time : 7;

  const stats = getSalesStats(productId);
  const safetyStock = computeSafetyStock(stats.avgDailySales, stats.maxDailySales, leadTime);
  const reorderPoint = computeReorderPoint(stats.avgDailySales, leadTime, safetyStock);

  db.prepare(`
    UPDATE products SET avg_daily_sales=?, max_daily_sales=?, safety_stock=?, reorder_point=?, updated_at=datetime('now')
    WHERE product_id=?
  `).run(stats.avgDailySales, stats.maxDailySales, safetyStock, reorderPoint, productId);

  return { ...stats, safetyStock, reorderPoint, leadTime };
}

/** สร้างรายการคำแนะนำสั่งซื้อ (คำนวณสดจากข้อมูลปัจจุบันเสมอ ไม่ใช้ค่า cache ล้วนๆ) */
function getPurchaseRecommendations() {
  const products = db.prepare(`
    SELECT p.*, s.quantity as current_stock, sup.supplier_name, sup.lead_time, sup.supplier_id as sup_id
    FROM products p
    LEFT JOIN stock s ON s.product_id = p.product_id
    LEFT JOIN suppliers sup ON sup.supplier_id = p.supplier_id
    WHERE p.is_active = 1
  `).all();

  const recs = [];
  for (const p of products) {
    const leadTime = p.lead_time || 7;
    const stats = getSalesStats(p.product_id);
    const safetyStock = computeSafetyStock(stats.avgDailySales, stats.maxDailySales, leadTime);
    const reorderPoint = computeReorderPoint(stats.avgDailySales, leadTime, safetyStock);
    const currentStock = p.current_stock || 0;
    if (currentStock <= reorderPoint) {
      const rec = computeRecommendedQty(stats.avgDailySales, leadTime, safetyStock, currentStock);
      const daysOfStockLeft = stats.avgDailySales > 0 ? currentStock / stats.avgDailySales : Infinity;
      recs.push({
        product_id: p.product_id,
        sku: p.sku,
        product_name: p.product_name,
        size: p.size,
        color: p.color,
        current_stock: currentStock,
        avg_daily_sales: stats.avgDailySales,
        max_daily_sales: stats.maxDailySales,
        lead_time: leadTime,
        safety_stock: safetyStock,
        reorder_point: reorderPoint,
        recommended_qty: rec.qty,
        demand_during_lead_time: rec.demandDuringLeadTime,
        supplier_id: p.sup_id,
        supplier_name: p.supplier_name || 'ยังไม่ระบุ Supplier',
        urgency: daysOfStockLeft <= leadTime * 0.5 ? 'urgent' : (daysOfStockLeft <= leadTime ? 'medium' : 'low'),
      });
    }
  }
  recs.sort((a, b) => (a.urgency === 'urgent' ? 0 : 1) - (b.urgency === 'urgent' ? 0 : 1) || b.recommended_qty - a.recommended_qty);
  return recs;
}

/** วิเคราะห์สินค้าค้างสต็อก จากวันที่ขายล่าสุดจริง (ถ้าไม่เคยขายเลย ใช้วันที่สร้างสินค้าเป็นฐาน) */
function getDeadStockAnalysis() {
  const products = db.prepare(`
    SELECT p.*, s.quantity as current_stock
    FROM products p LEFT JOIN stock s ON s.product_id = p.product_id
    WHERE p.is_active = 1
  `).all();

  const results = [];
  for (const p of products) {
    const stats = getSalesStats(p.product_id);
    const baseline = stats.lastSaleAt || p.created_at;
    const daysSince = Math.floor((Date.now() - new Date(baseline.replace(' ', 'T') + 'Z').getTime()) / 86400000);
    let level = null, cls = null;
    if (daysSince > 90) { level = 'วิกฤต'; cls = 'crit'; }
    else if (daysSince > 60) { level = 'ค้าง'; cls = 'warn'; }
    else if (daysSince > 30) { level = 'เริ่มค้าง'; cls = 'watch'; }
    if (level && (p.current_stock || 0) > 0) {
      results.push({
        product_id: p.product_id,
        sku: p.sku,
        product_name: p.product_name,
        size: p.size,
        current_stock: p.current_stock || 0,
        last_sale_at: stats.lastSaleAt,
        days_since_last_sale: daysSince,
        cost_price: p.cost_price,
        value_at_risk: Math.round((p.current_stock || 0) * p.cost_price),
        level, cls,
      });
    }
  }
  results.sort((a, b) => b.days_since_last_sale - a.days_since_last_sale);
  return results;
}

module.exports = {
  getSalesStats, computeSafetyStock, computeReorderPoint, computeRecommendedQty,
  recalcProduct, getPurchaseRecommendations, getDeadStockAnalysis, SALES_WINDOW_DAYS,
};

// สคริปต์นี้เป็นทางเลือก (ไม่รันอัตโนมัติ) สำหรับใส่ข้อมูลตัวอย่างเพื่อทดสอบระบบเท่านั้น
// รันด้วยคำสั่ง: node seed_demo.js
// ข้อมูลจริงของร้านให้เพิ่มผ่านหน้าเว็บตามปกติ ไม่ต้องรันไฟล์นี้
const { db } = require('./db');
const { recalcProduct } = require('./ruleEngine');

function seededRandom(seed) {
  let s = seed % 2147483647; if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647, (s - 1) / 2147483646);
}
const rnd = seededRandom(42);

const existing = db.prepare('SELECT COUNT(*) c FROM products').get().c;
if (existing > 0) {
  console.log(`มีสินค้าอยู่แล้ว ${existing} รายการในระบบ — ยกเลิกการ seed เพื่อป้องกันข้อมูลซ้ำ`);
  process.exit(0);
}

const suppliers = [
  { name: 'หจก. สยามยูนิฟอร์ม', lead: 7, contact: '081-234-5678' },
  { name: 'บจก. เอกภัณฑ์การ์เมนต์', lead: 5, contact: '082-345-6789' },
  { name: 'ร้านผ้าตัดเสื้อรุ่งเรือง', lead: 10, contact: '083-456-7890' },
];
const supplierIds = suppliers.map(s =>
  db.prepare('INSERT INTO suppliers (supplier_name, lead_time, contact) VALUES (?,?,?)').run(s.name, s.lead, s.contact).lastInsertRowid
);

const categories = ['เสื้อเชิ้ต', 'กระโปรง', 'กางเกง', 'เข็มขัด', 'รองเท้า', 'ถุงเท้า', 'เนคไท'];
const sizesByCat = {
  'เสื้อเชิ้ต': ['S', 'M', 'L', 'XL'], 'กระโปรง': ['S', 'M', 'L', 'XL'], 'กางเกง': ['28', '30', '32', '34'],
  'เข็มขัด': ['ฟรีไซซ์'], 'รองเท้า': ['39', '40', '41', '42'], 'ถุงเท้า': ['ฟรีไซซ์'], 'เนคไท': ['ฟรีไซซ์'],
};
const baseNames = {
  'เสื้อเชิ้ต': 'เสื้อเชิ้ตนักศึกษา', 'กระโปรง': 'กระโปรงนักศึกษา', 'กางเกง': 'กางเกงนักศึกษา',
  'เข็มขัด': 'เข็มขัดนักศึกษา', 'รองเท้า': 'รองเท้านักศึกษา', 'ถุงเท้า': 'ถุงเท้านักศึกษา', 'เนคไท': 'เนคไทนักศึกษา',
};

let sku = 1;
const products = [];
categories.forEach(cat => {
  const genders = (cat === 'เสื้อเชิ้ต' || cat === 'กางเกง') ? ['ชาย', 'หญิง'] : [''];
  genders.forEach(g => sizesByCat[cat].forEach(sz => {
    const cost = Math.round(80 + rnd() * 220);
    const sell = Math.round(cost * (1.4 + rnd() * 0.5));
    const supplierId = supplierIds[Math.floor(rnd() * supplierIds.length)];
    const info = db.prepare(`
      INSERT INTO products (sku, product_name, category, gender, size, cost_price, selling_price, supplier_id)
      VALUES (?,?,?,?,?,?,?,?)`).run(
      `${cat.slice(0, 2)}-${g ? g[0] : 'F'}-${sz}-${String(sku).padStart(3, '0')}`,
      `${baseNames[cat]}${g ? ' ' + g : ''}`, cat, g, sz, cost, sell, supplierId
    );
    products.push({ id: info.lastInsertRowid, cost });
    sku++;
  }));
});

// สร้างสต็อกตั้งต้น + ยอดขายย้อนหลัง 45 วัน ตาม 5 profile (ขายดี/ปกติ/ขายช้า/ค้างสต็อก/พีค)
products.forEach((p, i) => {
  const profile = i % 5;
  let avg, initStock, sellDays;
  if (profile === 0) { avg = 1.8; initStock = Math.round(avg * 12); sellDays = 45; }
  else if (profile === 1) { avg = 0.7; initStock = Math.round(avg * 25); sellDays = 45; }
  else if (profile === 2) { avg = 0.2; initStock = 20; sellDays = 15; }
  else if (profile === 3) { avg = 0; initStock = 22; sellDays = 0; }
  else { avg = 2.4; initStock = Math.round(avg * 6); sellDays = 45; }

  db.prepare('INSERT INTO stock (product_id, quantity) VALUES (?,?)').run(p.id, initStock);
  const product = db.prepare('SELECT selling_price FROM products WHERE product_id=?').get(p.id);
  for (let d = sellDays; d >= 1; d--) {
    if (rnd() > 0.55) continue;
    const qty = Math.max(1, Math.round(avg * (0.5 + rnd())));
    const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 19).replace('T', ' ');
    db.prepare('INSERT INTO sales (product_id, quantity, selling_price, sold_at) VALUES (?,?,?,?)')
      .run(p.id, qty, product.selling_price, date);
  }
  recalcProduct(p.id);
});

console.log(`สร้างข้อมูลตัวอย่างเรียบร้อย: ${suppliers.length} Supplier, ${products.length} สินค้า`);

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

const { sendJson, parseBody, parseCookies, ApiError, MSG } = require('./utils');
const { getSessionUser } = require('./auth');
const authRoutes = require('./routes/auth');
const products = require('./routes/products');
const sales = require('./routes/sales');
const suppliers = require('./routes/suppliers');
const po = require('./routes/purchaseOrders');
const ai = require('./routes/ai');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };

function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(PUBLIC_DIR, filePath);
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (pathname !== '/' && !pathname.startsWith('/api')) {
        // SPA fallback -> index.html for client-side view routes like /login handled client side
        return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, d2) => {
          if (e2) { res.writeHead(404); return res.end('Not found'); }
          res.writeHead(200, { 'Content-Type': MIME['.html'] });
          res.end(d2);
        });
      }
      res.writeHead(404); return res.end('Not found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const query = parsed.query;

  if (!pathname.startsWith('/api/')) return serveStatic(req, res, pathname);

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const cookies = parseCookies(req);
  const token = cookies.sid;
  const user = getSessionUser(token);

  try {
    // ---- Auth (ไม่ต้อง login) ----
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await parseBody(req);
      const result = await authRoutes.login(body);
      res.setHeader('Set-Cookie', `sid=${result.token}; HttpOnly; Path=/; Max-Age=${7 * 86400}; SameSite=Lax`);
      return sendJson(res, 200, { user: result.user });
    }

    // ---- ทุก endpoint ถัดจากนี้ต้อง login ----
    if (!user) throw new ApiError(401, MSG.UNAUTHORIZED);

    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      await authRoutes.logout(token);
      res.setHeader('Set-Cookie', 'sid=; HttpOnly; Path=/; Max-Age=0');
      return sendJson(res, 200, { ok: true });
    }
    if (pathname === '/api/me' && req.method === 'GET') {
      return sendJson(res, 200, { username: user.username, role: user.role });
    }

    // ---- Dashboard / AI ----
    if (pathname === '/api/dashboard' && req.method === 'GET') return sendJson(res, 200, ai.dashboard());
    if (pathname === '/api/ai/recommendations' && req.method === 'GET') return sendJson(res, 200, ai.recommendations());
    if (pathname === '/api/ai/deadstock' && req.method === 'GET') return sendJson(res, 200, ai.deadStock());

    // ---- Products ----
    let m;
    if (pathname === '/api/products' && req.method === 'GET') return sendJson(res, 200, products.listProducts(query));
    if (pathname === '/api/products' && req.method === 'POST') {
      const body = await parseBody(req);
      return sendJson(res, 201, products.createProduct(body));
    }
    if ((m = pathname.match(/^\/api\/products\/(\d+)$/)) && req.method === 'GET') {
      return sendJson(res, 200, products.getProduct(m[1]));
    }
    if ((m = pathname.match(/^\/api\/products\/(\d+)$/)) && req.method === 'PUT') {
      const body = await parseBody(req);
      return sendJson(res, 200, products.updateProduct(m[1], body));
    }
    if ((m = pathname.match(/^\/api\/products\/(\d+)$/)) && req.method === 'DELETE') {
      if (user.role !== 'admin') throw new ApiError(403, MSG.FORBIDDEN);
      return sendJson(res, 200, products.deleteProduct(m[1]));
    }

    // ---- Stock ----
    if (pathname === '/api/stock/receive' && req.method === 'POST') {
      const body = await parseBody(req);
      return sendJson(res, 200, products.receiveStock(body, user.userId));
    }
    if (pathname === '/api/stock/adjust' && req.method === 'POST') {
      const body = await parseBody(req);
      return sendJson(res, 200, products.adjustStock(body, user.userId));
    }

    // ---- Sales ----
    if (pathname === '/api/sales' && req.method === 'GET') return sendJson(res, 200, sales.listSales(query));
    if (pathname === '/api/sales' && req.method === 'POST') {
      const body = await parseBody(req);
      return sendJson(res, 201, sales.createSale(body, user.userId));
    }

    // ---- Suppliers ----
    if (pathname === '/api/suppliers' && req.method === 'GET') return sendJson(res, 200, suppliers.listSuppliers());
    if (pathname === '/api/suppliers' && req.method === 'POST') {
      const body = await parseBody(req);
      return sendJson(res, 201, suppliers.createSupplier(body));
    }
    if ((m = pathname.match(/^\/api\/suppliers\/(\d+)$/)) && req.method === 'GET') {
      return sendJson(res, 200, suppliers.getSupplier(m[1]));
    }
    if ((m = pathname.match(/^\/api\/suppliers\/(\d+)$/)) && req.method === 'PUT') {
      const body = await parseBody(req);
      return sendJson(res, 200, suppliers.updateSupplier(m[1], body));
    }
    if ((m = pathname.match(/^\/api\/suppliers\/(\d+)$/)) && req.method === 'DELETE') {
      if (user.role !== 'admin') throw new ApiError(403, MSG.FORBIDDEN);
      return sendJson(res, 200, suppliers.deleteSupplier(m[1]));
    }

    // ---- Purchase Orders ----
    if (pathname === '/api/purchase-orders' && req.method === 'GET') return sendJson(res, 200, po.listPurchaseOrders());
    if (pathname === '/api/purchase-orders' && req.method === 'POST') {
      const body = await parseBody(req);
      return sendJson(res, 201, po.createPurchaseOrder(body, user.userId));
    }
    if ((m = pathname.match(/^\/api\/purchase-orders\/(\d+)$/)) && req.method === 'GET') {
      return sendJson(res, 200, po.getPurchaseOrder(m[1]));
    }
    if ((m = pathname.match(/^\/api\/purchase-orders\/(\d+)\/status$/)) && req.method === 'PUT') {
      const body = await parseBody(req);
      return sendJson(res, 200, po.updateStatus(m[1], body, user.userId));
    }

    throw new ApiError(404, 'ไม่พบ endpoint นี้');
  } catch (err) {
    if (err instanceof ApiError) return sendJson(res, err.status, { error: err.message });
    console.error(err);
    return sendJson(res, 500, { error: MSG.SERVER_ERROR });
  }
});

server.listen(PORT, () => {
  console.log(`StockUniform AI server running at http://localhost:${PORT}`);
});

module.exports = { server };

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 2 * 1024 * 1024) { req.destroy(); reject(new Error('Payload too large')); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

// ข้อความ error/validation ภาษาไทย ใช้ร่วมกันทั้งระบบ
const MSG = {
  REQUIRED: (field) => `กรุณากรอก${field}`,
  DUP_SKU: 'รหัส SKU นี้มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น',
  NOT_FOUND: 'ไม่พบข้อมูลที่ต้องการ',
  INSUFFICIENT_STOCK: 'จำนวนสต็อกคงเหลือไม่เพียงพอสำหรับการขายนี้',
  UNAUTHORIZED: 'กรุณาเข้าสู่ระบบก่อนใช้งาน',
  FORBIDDEN: 'คุณไม่มีสิทธิ์ทำรายการนี้',
  INVALID_LOGIN: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
  SERVER_ERROR: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง',
};

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

module.exports = { sendJson, parseBody, parseCookies, MSG, ApiError };


:root{
  --navy:#1E2A44; --navy-2:#2C3B5C; --navy-light:#EEF1F7;
  --gold:#B8933E; --gold-light:#F5EBD3; --gold-dark:#7A611F;
  --cream:#FAF8F3; --paper:#FFFFFF;
  --ink:#22262F; --ink-2:#5B6272; --ink-3:#8A90A0;
  --line:#E4E1D8;
  --red:#B3332B; --red-bg:#FBEAE8;
  --amber:#9A6B12; --amber-bg:#FBF0DC;
  --green:#256B4E; --green-bg:#E7F3EC;
  --radius:10px;
}
*{box-sizing:border-box; margin:0; padding:0;}
body{ font-family:'Noto Sans Thai','Noto Sans',sans-serif; background:var(--cream); color:var(--ink); line-height:1.6; }
.app{display:flex; min-height:100vh;}
.sidebar{ width:220px; background:var(--navy); color:#fff; flex-shrink:0; padding:24px 0; display:flex; flex-direction:column; }
.brand{padding:0 20px 22px; border-bottom:1px solid rgba(255,255,255,.12); margin-bottom:14px;}
.brand-mark{width:34px;height:34px;border-radius:8px;background:var(--gold);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--navy);font-size:15px;margin-bottom:10px;}
.brand-name{font-size:14px; font-weight:600;}
.brand-sub{font-size:11.5px; color:rgba(255,255,255,.55); margin-top:2px;}
nav{display:flex; flex-direction:column; gap:2px; padding:0 10px; flex:1; overflow-y:auto;}
.nav-item{ display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:8px; color:rgba(255,255,255,.72); font-size:13.5px; font-weight:500; cursor:pointer; border:none; background:none; width:100%; font-family:inherit; text-align:right; }
.nav-item:hover{background:rgba(255,255,255,.06); color:#fff;}
.nav-item.active{background:rgba(184,147,62,.18); color:var(--gold); font-weight:600;}
.sidebar-foot{margin-top:auto; padding:14px 20px 4px; font-size:11.5px; color:rgba(255,255,255,.65); border-top:1px solid rgba(255,255,255,.1); padding-top:14px; display:flex; justify-content:space-between; align-items:center; gap:8px;}
.logout-btn{background:none;border:none;color:rgba(255,255,255,.5);font-size:11px;cursor:pointer;text-decoration:underline;font-family:inherit;}
main{flex:1; padding:28px 34px; max-width:1180px; width:100%;}
.topbar{display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:22px; flex-wrap:wrap; gap:10px;}
.topbar h1{font-size:20px; font-weight:700; color:var(--navy);}
.topbar .sub{font-size:12.5px; color:var(--ink-3); margin-top:3px;}
.view{display:none;} .view.active{display:block;}
.kpi-row{display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-bottom:24px;}
.kpi{background:var(--paper); border:1px solid var(--line); border-radius:var(--radius); padding:16px 18px;}
.kpi.warn{background:var(--amber-bg); border-color:transparent;} .kpi.danger{background:var(--red-bg); border-color:transparent;}
.kpi-label{font-size:12px; color:var(--ink-2); margin-bottom:6px;}
.kpi.warn .kpi-label{color:var(--amber);} .kpi.danger .kpi-label{color:var(--red);}
.kpi-value{font-size:23px; font-weight:700; color:var(--navy);}
.kpi.warn .kpi-value{color:var(--amber);} .kpi.danger .kpi-value{color:var(--red);}
section.block{margin-bottom:26px;}
.block-head{display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;}
.block-head h2{font-size:14.5px; font-weight:700; color:var(--navy);}
.block-head .link{font-size:12px; color:var(--gold-dark); cursor:pointer; font-weight:600; background:none; border:none; font-family:inherit;}
.rec-card{ background:var(--paper); border:1px solid var(--line); border-radius:var(--radius); padding:14px 16px; margin-bottom:10px; display:flex; gap:14px; align-items:center; flex-wrap:wrap; }
.rec-card.urgent{border-left:3px solid var(--red);} .rec-card.medium{border-left:3px solid var(--amber);}
.rec-icon{width:38px;height:38px;border-radius:8px;background:var(--navy-light);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;color:var(--navy);font-weight:700;}
.rec-body{flex:1; min-width:200px;}
.rec-title{font-size:13.5px; font-weight:600; margin-bottom:2px;}
.rec-reason{font-size:12px; color:var(--ink-2); margin-bottom:8px;}
.rec-formula{display:flex; flex-wrap:wrap; gap:6px; align-items:center; font-family:'IBM Plex Mono',monospace; font-size:11px;}
.rec-formula .chip{background:var(--navy-light); color:var(--navy-2); padding:3px 8px; border-radius:5px;}
.rec-formula .op{color:var(--ink-3);}
.rec-formula .result{background:var(--gold-light); color:var(--gold-dark); font-weight:600;}
.rec-action{flex-shrink:0; text-align:left;}
.qty-pill{font-size:18px; font-weight:700; color:var(--navy); text-align:center;}
.qty-pill .u{font-size:10.5px; font-weight:500; color:var(--ink-3); display:block;}
.btn{ background:var(--navy); color:#fff; border:none; padding:9px 16px; border-radius:7px; font-size:12.5px; font-weight:600; cursor:pointer; font-family:inherit; }
.btn:hover{background:var(--navy-2);} .btn:disabled{opacity:.5; cursor:not-allowed;}
.btn.ghost{background:transparent; color:var(--navy); border:1px solid var(--line);}
.btn.ghost:hover{background:var(--navy-light);}
.btn.danger{background:var(--red);} .btn.danger:hover{background:#902a23;}
.btn.small{padding:6px 12px; font-size:11.5px;}
.btn.block{width:100%; margin-top:6px;}
table{width:100%; border-collapse:collapse; background:var(--paper); border:1px solid var(--line); border-radius:var(--radius); overflow:hidden;}
th{background:var(--navy-light); color:var(--navy-2); font-size:11.5px; font-weight:600; text-align:right; padding:10px 12px; border-bottom:1px solid var(--line);}
td{font-size:12.5px; padding:10px 12px; border-bottom:1px solid var(--line); text-align:right; vertical-align:middle;}
tr:last-child td{border-bottom:none;} tr:hover td{background:#FBFAF7;}
.tag{font-size:10.5px; font-weight:600; padding:3px 9px; border-radius:20px; display:inline-block;}
.tag.crit{background:var(--red-bg); color:var(--red);} .tag.warn{background:var(--amber-bg); color:var(--amber);}
.tag.watch, .tag.info{background:var(--navy-light); color:var(--navy-2);}
.tag.ok{background:var(--green-bg); color:var(--green);}
.mono{font-family:'IBM Plex Mono',monospace; font-size:11.5px; color:var(--ink-2);}
.filter-row{display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;}
.filter-row select, .filter-row input{ font-family:inherit; font-size:12.5px; padding:8px 10px; border:1px solid var(--line); border-radius:7px; background:var(--paper); color:var(--ink); }
.filter-row input{flex:1; min-width:160px;}
.note{font-size:11.5px; color:var(--ink-3); background:var(--navy-light); padding:9px 12px; border-radius:7px; margin-top:14px;}
.empty{padding:30px; text-align:center; color:var(--ink-3); font-size:13px;}
.actions-cell{display:flex; gap:6px; justify-content:flex-end;}
.icon-btn{background:none; border:1px solid var(--line); border-radius:6px; padding:5px 9px; font-size:11px; cursor:pointer; color:var(--ink-2); font-family:inherit;}
.icon-btn:hover{background:var(--navy-light);} .icon-btn.danger{color:var(--red); border-color:var(--red-bg);}

/* Modal */
.modal-overlay{position:fixed; inset:0; background:rgba(30,42,68,.45); display:none; align-items:center; justify-content:center; z-index:100; padding:20px;}
.modal-overlay.active{display:flex;}
.modal{background:var(--paper); border-radius:12px; width:100%; max-width:480px; max-height:88vh; overflow-y:auto; padding:22px 24px;}
.modal h3{font-size:16px; font-weight:700; color:var(--navy); margin-bottom:16px;}
.field{margin-bottom:12px;}
.field label{display:block; font-size:12px; color:var(--ink-2); margin-bottom:5px; font-weight:500;}
.field input, .field select, .field textarea{ width:100%; padding:9px 10px; border:1px solid var(--line); border-radius:7px; font-family:inherit; font-size:13px; background:var(--paper); }
.field .err{color:var(--red); font-size:11.5px; margin-top:4px; display:none;}
.field.has-error input, .field.has-error select{border-color:var(--red);}
.field.has-error .err{display:block;}
.field-row{display:grid; grid-template-columns:1fr 1fr; gap:10px;}
.modal-actions{display:flex; gap:8px; margin-top:18px; justify-content:flex-end;}
.po-item-row{display:grid; grid-template-columns:2fr 1fr 30px; gap:8px; margin-bottom:8px; align-items:center;}

/* Toast */
#toastHost{position:fixed; top:18px; left:50%; transform:translateX(-50%); z-index:200; display:flex; flex-direction:column; gap:8px; align-items:center;}
.toast{background:var(--navy); color:#fff; padding:10px 18px; border-radius:8px; font-size:12.5px; box-shadow:0 4px 14px rgba(0,0,0,.15);}
.toast.error{background:var(--red);} .toast.success{background:var(--green);}

.spinner{display:inline-block; width:14px; height:14px; border:2px solid rgba(255,255,255,.4); border-top-color:#fff; border-radius:50%; animation:spin .7s linear infinite; vertical-align:-2px;}
@keyframes spin{to{transform:rotate(360deg);}}
.skeleton{background:linear-gradient(90deg,var(--line) 25%,#f0eee6 37%,var(--line) 63%); background-size:400% 100%; animation:shimmer 1.4s ease infinite; border-radius:6px; height:14px;}
@keyframes shimmer{0%{background-position:100% 50%;}100%{background-position:0 50%;}}

/* Login page */
.login-wrap{min-height:100vh; display:flex; align-items:center; justify-content:center; background:var(--navy);}
.login-card{background:var(--paper); border-radius:14px; padding:36px 34px; width:100%; max-width:360px;}
.login-card .brand-mark{margin:0 auto 14px;}
.login-card h1{font-size:17px; text-align:center; color:var(--navy); margin-bottom:2px;}
.login-card .sub{font-size:12px; text-align:center; color:var(--ink-3); margin-bottom:22px;}
.login-err{background:var(--red-bg); color:var(--red); font-size:12px; padding:9px 12px; border-radius:7px; margin-bottom:14px; display:none;}

@media (max-width:820px){
  .app{flex-direction:column;} .sidebar{width:100%; flex-direction:row; overflow-x:auto; padding:12px; align-items:center;}
  .brand{display:none;} nav{flex-direction:row;} .sidebar-foot{display:none;}
  main{padding:18px;}
}

/* ============ CORE: API CLIENT / TOAST / MODAL ============ */
async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) { window.location.href = '/login.html'; throw new Error('unauthorized'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
  return data;
}

function toast(message, type = '') {
  const host = document.getElementById('toastHost');
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

const modalOverlay = document.getElementById('modalOverlay');
const modalBody = document.getElementById('modalBody');
function openModal(html) { modalBody.innerHTML = html; modalOverlay.classList.add('active'); }
function closeModal() { modalOverlay.classList.remove('active'); modalBody.innerHTML = ''; }
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

const fmt = (n) => Number(n || 0).toLocaleString('th-TH');
const fmtBaht = (n) => '฿' + Number(n || 0).toLocaleString('th-TH');

/* ============ VIEW SWITCHING ============ */
const viewLoaders = {
  dashboard: loadDashboard, products: loadProducts, receiving: loadReceivingForm,
  sales: loadSalesView, purchase: loadPurchaseView, purchaseorders: loadPurchaseOrders,
  suppliers: loadSuppliers, deadstock: loadDeadStock,
};
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === name));
  if (viewLoaders[name]) viewLoaders[name]();
}
document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));
document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-goto]');
  if (g) showView(g.dataset.goto);
});

/* ============ DASHBOARD ============ */
function recCardHTML(r) {
  return `
  <div class="rec-card ${r.urgency}">
    <div class="rec-icon">${r.product_name.slice(0, 2)}</div>
    <div class="rec-body">
      <div class="rec-title">${r.product_name} • ไซซ์ ${r.size} <span class="mono">(${r.sku})</span></div>
      <div class="rec-reason">คงเหลือ ${fmt(r.current_stock)} ชิ้น • ขายเฉลี่ย ${r.avg_daily_sales} ชิ้น/วัน • รอสินค้าจาก ${r.supplier_name} ${r.lead_time} วัน</div>
      <div class="rec-formula">
        <span class="chip">ขายเฉลี่ย ${r.avg_daily_sales}×${r.lead_time}วัน</span><span class="op">+</span>
        <span class="chip">Safety ${r.safety_stock}</span><span class="op">−</span>
        <span class="chip">คงเหลือ ${r.current_stock}</span><span class="op">=</span>
        <span class="chip result">แนะนำสั่ง ${r.recommended_qty}</span>
      </div>
    </div>
    <div class="rec-action">
      <div class="qty-pill">${r.recommended_qty}<span class="u">ชิ้น</span></div>
      <button class="btn small block" onclick="quickCreatePO(${r.product_id}, ${r.recommended_qty}, ${r.supplier_id || 'null'})">สร้างใบสั่งซื้อ</button>
    </div>
  </div>`;
}
function deadCardHTML(d) {
  return `
  <div class="rec-card">
    <div class="rec-icon">${d.product_name.slice(0, 2)}</div>
    <div class="rec-body">
      <div class="rec-title">${d.product_name} • ไซซ์ ${d.size}</div>
      <div class="rec-reason">ไม่มีการขายมาแล้ว ${d.days_since_last_sale} วัน • คงเหลือ ${fmt(d.current_stock)} ชิ้น • มูลค่าจม ${fmtBaht(d.value_at_risk)}</div>
    </div>
    <div class="rec-action"><span class="tag ${d.cls}">${d.level}</span></div>
  </div>`;
}
async function loadDashboard() {
  try {
    const d = await api('/dashboard');
    document.getElementById('kpiRow').innerHTML = `
      <div class="kpi"><div class="kpi-label">สินค้าทั้งหมด</div><div class="kpi-value">${fmt(d.total_products)}</div></div>
      <div class="kpi danger"><div class="kpi-label">สินค้าหมด</div><div class="kpi-value">${fmt(d.out_of_stock)}</div></div>
      <div class="kpi warn"><div class="kpi-label">ต้องสั่งด่วน</div><div class="kpi-value">${fmt(d.urgent_reorder)}</div></div>
      <div class="kpi"><div class="kpi-label">มูลค่าสต็อกรวม</div><div class="kpi-value">${fmtBaht(d.stock_value)}</div></div>
      <div class="kpi"><div class="kpi-label">ยอดขาย 30 วัน</div><div class="kpi-value">${fmtBaht(d.sales_last_30_days)}</div></div>
      <div class="kpi warn"><div class="kpi-label">มูลค่าสต็อกค้าง</div><div class="kpi-value">${fmtBaht(d.dead_stock_value)}</div></div>`;
    document.getElementById('dashRecs').innerHTML = d.top_recommendations.length
      ? d.top_recommendations.map(recCardHTML).join('') : `<div class="empty">ไม่มีคำแนะนำสั่งซื้อในขณะนี้</div>`;
    document.getElementById('dashDead').innerHTML = d.critical_dead_stock.length
      ? d.critical_dead_stock.map(deadCardHTML).join('') : `<div class="empty">ไม่มีสินค้าค้างสต็อกระดับวิกฤต</div>`;
  } catch (e) { toast(e.message, 'error'); }
}

/* ============ PRODUCTS ============ */
let productsCache = [];
let suppliersCache = [];
async function ensureSuppliersLoaded() {
  if (!suppliersCache.length) suppliersCache = await api('/suppliers');
  return suppliersCache;
}
function statusTag(p) {
  if (p.current_stock === 0) return `<span class="tag crit">หมด</span>`;
  if (p.current_stock <= p.reorder_point) return `<span class="tag warn">ใกล้หมด</span>`;
  return `<span class="tag ok">ปกติ</span>`;
}
async function loadProducts() {
  try {
    const q = document.getElementById('searchInput').value.trim();
    const category = document.getElementById('categoryFilter').value;
    const status = document.getElementById('statusFilter').value;
    const params = new URLSearchParams();
    if (q) params.set('q', q); if (category) params.set('category', category); if (status) params.set('status', status);
    productsCache = await api('/products?' + params.toString());

    const catSel = document.getElementById('categoryFilter');
    if (!catSel.dataset.filled) {
      const cats = [...new Set(productsCache.map(p => p.category))];
      catSel.innerHTML = `<option value="">ทุกหมวดหมู่</option>` + cats.map(c => `<option value="${c}">${c}</option>`).join('');
      catSel.dataset.filled = '1';
    }
    document.getElementById('productsCount').textContent = `${productsCache.length} รายการ`;
    document.getElementById('productsTableWrap').innerHTML = productsCache.length ? `
      <table><thead><tr><th>SKU</th><th>สินค้า</th><th>ไซซ์</th><th>คงเหลือ</th><th>ROP</th><th>สถานะ</th><th></th></tr></thead>
      <tbody>${productsCache.map(p => `
        <tr>
          <td class="mono">${p.sku}</td>
          <td style="text-align:right;cursor:pointer;color:var(--navy);font-weight:500" onclick="openProductDetail(${p.product_id})">${p.product_name}</td>
          <td>${p.size}</td><td>${fmt(p.current_stock)}</td><td>${fmt(p.reorder_point)}</td><td>${statusTag(p)}</td>
          <td><div class="actions-cell">
            <button class="icon-btn" onclick="openProductForm(${p.product_id})">แก้ไข</button>
            <button class="icon-btn danger" onclick="deleteProduct(${p.product_id})">ลบ</button>
          </div></td>
        </tr>`).join('')}</tbody></table>`
      : `<div class="empty">ไม่พบสินค้าที่ค้นหา</div>`;
  } catch (e) { toast(e.message, 'error'); }
}
document.getElementById('searchInput').addEventListener('input', debounce(loadProducts, 300));
document.getElementById('categoryFilter').addEventListener('change', loadProducts);
document.getElementById('statusFilter').addEventListener('change', loadProducts);
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

async function openProductDetail(id) {
  showView('productdetail');
  document.getElementById('productDetailBody').innerHTML = `<div class="skeleton" style="height:200px"></div>`;
  try {
    const p = await api('/products/' + id);
    document.getElementById('productDetailBody').innerHTML = `
      <div class="topbar"><div><h1>${p.product_name}</h1><div class="sub mono">${p.sku} • ไซซ์ ${p.size}</div></div></div>
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">คงเหลือ</div><div class="kpi-value">${fmt(p.current_stock)}</div></div>
        <div class="kpi"><div class="kpi-label">ราคาทุน</div><div class="kpi-value">${fmtBaht(p.cost_price)}</div></div>
        <div class="kpi"><div class="kpi-label">ราคาขาย</div><div class="kpi-value">${fmtBaht(p.selling_price)}</div></div>
        <div class="kpi"><div class="kpi-label">Reorder Point</div><div class="kpi-value">${fmt(p.reorder_point)}</div></div>
      </div>
      <div class="note">Supplier: ${p.supplier_name || 'ยังไม่ระบุ'}</div>
      <h2 style="font-size:14px;margin:20px 0 10px;color:var(--navy);">ประวัติการเคลื่อนไหวสต็อก</h2>
      ${p.history.length ? `<table><thead><tr><th>วันที่</th><th>ประเภท</th><th>จำนวน</th><th>อ้างอิง</th><th>หมายเหตุ</th></tr></thead>
        <tbody>${p.history.map(h => `<tr><td>${h.created_at}</td><td>${txnLabel(h.transaction_type)}</td>
          <td style="color:${h.quantity < 0 ? 'var(--red)' : 'var(--green)'}">${h.quantity > 0 ? '+' : ''}${h.quantity}</td>
          <td class="mono">${h.reference || '-'}</td><td>${h.note || '-'}</td></tr>`).join('')}</tbody></table>`
        : `<div class="empty">ยังไม่มีประวัติการเคลื่อนไหว</div>`}`;
  } catch (e) { toast(e.message, 'error'); }
}
function txnLabel(t) {
  return { receive: 'รับเข้า', sale: 'ขายออก', adjust: 'ปรับยอด', po_receive: 'รับตาม PO' }[t] || t;
}

async function openProductForm(id) {
  await ensureSuppliersLoaded();
  const p = id ? productsCache.find(x => x.product_id === id) || await api('/products/' + id) : null;
  const supOptions = suppliersCache.map(s => `<option value="${s.supplier_id}" ${p && p.supplier_id === s.supplier_id ? 'selected' : ''}>${s.supplier_name}</option>`).join('');
  openModal(`
    <h3>${id ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h3>
    <form id="productForm">
      <div class="field-row">
        <div class="field"><label>รหัส SKU *</label><input id="f_sku" value="${p ? p.sku : ''}" required></div>
        <div class="field"><label>หมวดหมู่ *</label><input id="f_category" value="${p ? p.category : ''}" required></div>
      </div>
      <div class="field"><label>ชื่อสินค้า *</label><input id="f_name" value="${p ? p.product_name : ''}" required></div>
      <div class="field-row">
        <div class="field"><label>ไซซ์ *</label><input id="f_size" value="${p ? p.size : ''}" required></div>
        <div class="field"><label>สี</label><input id="f_color" value="${p ? p.color : ''}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>ราคาทุน</label><input type="number" step="0.01" id="f_cost" value="${p ? p.cost_price : 0}"></div>
        <div class="field"><label>ราคาขาย</label><input type="number" step="0.01" id="f_sell" value="${p ? p.selling_price : 0}"></div>
      </div>
      ${!id ? `<div class="field"><label>สต็อกตั้งต้น</label><input type="number" id="f_initstock" value="0" min="0"></div>` : ''}
      <div class="field"><label>Supplier</label><select id="f_supplier"><option value="">ไม่ระบุ</option>${supOptions}</select></div>
      <div class="modal-actions">
        <button type="button" class="btn ghost" onclick="closeModal()">ยกเลิก</button>
        <button type="submit" class="btn">${id ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}</button>
      </div>
    </form>`);
  document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      sku: val('f_sku'), category: val('f_category'), product_name: val('f_name'), size: val('f_size'),
      color: val('f_color'), cost_price: val('f_cost'), selling_price: val('f_sell'),
      supplier_id: val('f_supplier') || null,
    };
    if (!id) body.initial_stock = val('f_initstock');
    try {
      await api(id ? '/products/' + id : '/products', { method: id ? 'PUT' : 'POST', body });
      toast(id ? 'บันทึกการแก้ไขเรียบร้อย' : 'เพิ่มสินค้าเรียบร้อย', 'success');
      closeModal(); loadProducts();
    } catch (err) { toast(err.message, 'error'); }
  });
}
function val(id) { return document.getElementById(id).value; }
document.getElementById('addProductBtn').addEventListener('click', () => openProductForm(null));
async function deleteProduct(id) {
  if (!confirm('ยืนยันการลบสินค้านี้? ประวัติการขายจะยังถูกเก็บไว้ในระบบ')) return;
  try { await api('/products/' + id, { method: 'DELETE' }); toast('ลบสินค้าเรียบร้อย', 'success'); loadProducts(); }
  catch (e) { toast(e.message, 'error'); }
}

/* ============ RECEIVING ============ */
async function loadReceivingForm() {
  const products = await api('/products');
  const sel = document.getElementById('rcvProduct');
  sel.innerHTML = products.map(p => `<option value="${p.product_id}">${p.product_name} (${p.sku}) — คงเหลือ ${p.current_stock}</option>`).join('');
}
document.getElementById('receiveForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/stock/receive', {
      method: 'POST',
      body: { product_id: val('rcvProduct'), quantity: val('rcvQty'), reference: val('rcvRef'), note: val('rcvNote') },
    });
    toast('บันทึกการรับสินค้าเรียบร้อย', 'success');
    document.getElementById('receiveForm').reset();
    loadReceivingForm();
  } catch (err) { toast(err.message, 'error'); }
});

/* ============ SALES ============ */
async function loadSalesView() {
  const products = await api('/products');
  const sel = document.getElementById('saleProduct');
  sel.innerHTML = products.map(p => `<option value="${p.product_id}" data-stock="${p.current_stock}" data-price="${p.selling_price}">${p.product_name} (${p.sku})</option>`).join('');
  updateSaleStockLabel();
  const sales = await api('/sales');
  document.getElementById('salesTableWrap').innerHTML = sales.length ? `
    <table><thead><tr><th>วันที่</th><th>สินค้า</th><th>จำนวน</th><th>ราคาขาย</th><th>รวม</th></tr></thead>
    <tbody>${sales.slice(0, 20).map(s => `<tr><td>${s.sold_at}</td><td style="text-align:right">${s.product_name}</td>
      <td>${s.quantity}</td><td>${fmtBaht(s.selling_price)}</td><td>${fmtBaht(s.quantity * s.selling_price)}</td></tr>`).join('')}</tbody></table>`
    : `<div class="empty">ยังไม่มีรายการขาย</div>`;
}
function updateSaleStockLabel() {
  const opt = document.getElementById('saleProduct').selectedOptions[0];
  if (!opt) return;
  document.getElementById('saleStockLabel').textContent = `คงเหลือ: ${opt.dataset.stock} ชิ้น`;
  document.getElementById('salePrice').value = opt.dataset.price;
}
document.getElementById('saleProduct').addEventListener('change', updateSaleStockLabel);
document.getElementById('saleForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/sales', { method: 'POST', body: { product_id: val('saleProduct'), quantity: val('saleQty'), selling_price: val('salePrice') } });
    toast('บันทึกการขายเรียบร้อย', 'success');
    document.getElementById('saleQty').value = '';
    loadSalesView();
  } catch (err) { toast(err.message, 'error'); }
});

/* ============ AI PURCHASE RECOMMENDATIONS ============ */
async function loadPurchaseView() {
  try {
    const recs = await api('/ai/recommendations');
    document.getElementById('purchaseList').innerHTML = recs.length ? recs.map(recCardHTML).join('') : `<div class="empty">ไม่มีคำแนะนำสั่งซื้อในขณะนี้ — สต็อกทุกรายการอยู่ในระดับปลอดภัย</div>`;
  } catch (e) { toast(e.message, 'error'); }
}
async function quickCreatePO(productId, qty, supplierId) {
  if (!supplierId) { toast('สินค้านี้ยังไม่ได้ระบุ Supplier กรุณาระบุก่อนสร้างใบสั่งซื้อ', 'error'); return; }
  try {
    await api('/purchase-orders', { method: 'POST', body: { supplier_id: supplierId, items: [{ product_id: productId, quantity: qty }] } });
    toast('สร้างใบสั่งซื้อ (ฉบับร่าง) เรียบร้อย', 'success');
    showView('purchaseorders');
  } catch (e) { toast(e.message, 'error'); }
}

/* ============ PURCHASE ORDERS ============ */
const PO_STATUS_LABEL = { draft: 'ฉบับร่าง', ordered: 'สั่งซื้อแล้ว', received: 'รับสินค้าแล้ว', cancelled: 'ยกเลิก' };
const PO_STATUS_CLS = { draft: 'watch', ordered: 'warn', received: 'ok', cancelled: 'crit' };
async function loadPurchaseOrders() {
  try {
    const orders = await api('/purchase-orders');
    document.getElementById('poListWrap').innerHTML = orders.length ? orders.map(o => `
      <div class="rec-card" style="align-items:flex-start;">
        <div class="rec-body">
          <div class="rec-title">ใบสั่งซื้อ #${o.purchase_order_id} • ${o.supplier_name}</div>
          <div class="rec-reason">สร้างเมื่อ ${o.created_at} • ${o.items.length} รายการ • รวม ${fmtBaht(o.total)}</div>
          <div style="font-size:12px;color:var(--ink-2)">${o.items.map(it => `${it.product_name} × ${it.quantity}`).join(', ')}</div>
        </div>
        <div class="rec-action">
          <span class="tag ${PO_STATUS_CLS[o.status]}">${PO_STATUS_LABEL[o.status]}</span>
          <div style="margin-top:8px; display:flex; flex-direction:column; gap:6px;">
            ${o.status === 'draft' ? `<button class="btn small" onclick="changePOStatus(${o.purchase_order_id},'ordered')">ยืนยันสั่งซื้อ</button>` : ''}
            ${o.status === 'ordered' ? `<button class="btn small" onclick="changePOStatus(${o.purchase_order_id},'received')">รับสินค้าเข้าสต็อก</button>` : ''}
            ${['draft', 'ordered'].includes(o.status) ? `<button class="btn small ghost" onclick="changePOStatus(${o.purchase_order_id},'cancelled')">ยกเลิก</button>` : ''}
          </div>
        </div>
      </div>`).join('') : `<div class="empty">ยังไม่มีใบสั่งซื้อ</div>`;
  } catch (e) { toast(e.message, 'error'); }
}
async function changePOStatus(id, status) {
  if (status === 'cancelled' && !confirm('ยืนยันยกเลิกใบสั่งซื้อนี้?')) return;
  if (status === 'received' && !confirm('ยืนยันรับสินค้า? ระบบจะเพิ่มจำนวนสต็อกให้อัตโนมัติ')) return;
  try { await api(`/purchase-orders/${id}/status`, { method: 'PUT', body: { status } }); toast('อัปเดตสถานะเรียบร้อย', 'success'); loadPurchaseOrders(); }
  catch (e) { toast(e.message, 'error'); }
}
async function openPOForm() {
  const [products, suppliers] = await Promise.all([api('/products'), ensureSuppliersLoaded()]);
  if (!suppliers.length) { toast('กรุณาเพิ่ม Supplier ก่อนสร้างใบสั่งซื้อ', 'error'); return; }
  openModal(`
    <h3>สร้างใบสั่งซื้อ</h3>
    <form id="poForm">
      <div class="field"><label>Supplier *</label><select id="po_supplier" required>${suppliers.map(s => `<option value="${s.supplier_id}">${s.supplier_name}</option>`).join('')}</select></div>
      <label style="font-size:12px;color:var(--ink-2);font-weight:500;">รายการสินค้า</label>
      <div id="poItems"></div>
      <button type="button" class="btn ghost small" id="addPOItemBtn" style="margin-top:6px;">+ เพิ่มรายการ</button>
      <div class="modal-actions">
        <button type="button" class="btn ghost" onclick="closeModal()">ยกเลิก</button>
        <button type="submit" class="btn">สร้างใบสั่งซื้อ</button>
      </div>
    </form>`);
  const itemsWrap = document.getElementById('poItems');
  function addRow() {
    const row = document.createElement('div');
    row.className = 'po-item-row';
    row.innerHTML = `
      <select class="po-product">${products.map(p => `<option value="${p.product_id}">${p.product_name} (${p.sku})</option>`).join('')}</select>
      <input type="number" class="po-qty" min="1" value="1" placeholder="จำนวน">
      <button type="button" class="icon-btn danger" onclick="this.parentElement.remove()">✕</button>`;
    itemsWrap.appendChild(row);
  }
  addRow();
  document.getElementById('addPOItemBtn').addEventListener('click', addRow);
  document.getElementById('poForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const items = [...itemsWrap.querySelectorAll('.po-item-row')].map(r => ({
      product_id: r.querySelector('.po-product').value, quantity: r.querySelector('.po-qty').value,
    }));
    try {
      await api('/purchase-orders', { method: 'POST', body: { supplier_id: val('po_supplier'), items } });
      toast('สร้างใบสั่งซื้อเรียบร้อย', 'success'); closeModal(); loadPurchaseOrders();
    } catch (err) { toast(err.message, 'error'); }
  });
}
document.getElementById('addPOBtn').addEventListener('click', openPOForm);

/* ============ SUPPLIERS ============ */
async function loadSuppliers() {
  try {
    suppliersCache = await api('/suppliers');
    document.getElementById('suppliersTableWrap').innerHTML = suppliersCache.length ? `
      <table><thead><tr><th>ชื่อ Supplier</th><th>Lead Time</th><th>ติดต่อ</th><th>สินค้า</th><th>ใบสั่งซื้อ</th><th></th></tr></thead>
      <tbody>${suppliersCache.map(s => `<tr>
        <td style="text-align:right;font-weight:500">${s.supplier_name}</td><td>${s.lead_time} วัน</td>
        <td>${s.contact || '-'}</td><td>${s.product_count}</td><td>${s.po_count}</td>
        <td><div class="actions-cell">
          <button class="icon-btn" onclick="openSupplierForm(${s.supplier_id})">แก้ไข</button>
          <button class="icon-btn danger" onclick="deleteSupplier(${s.supplier_id})">ลบ</button>
        </div></td></tr>`).join('')}</tbody></table>`
      : `<div class="empty">ยังไม่มี Supplier — เพิ่ม Supplier ก่อนเพื่อผูกกับสินค้า</div>`;
  } catch (e) { toast(e.message, 'error'); }
}
function openSupplierForm(id) {
  const s = id ? suppliersCache.find(x => x.supplier_id === id) : null;
  openModal(`
    <h3>${id ? 'แก้ไข Supplier' : 'เพิ่ม Supplier'}</h3>
    <form id="supplierForm">
      <div class="field"><label>ชื่อ Supplier *</label><input id="s_name" value="${s ? s.supplier_name : ''}" required></div>
      <div class="field"><label>Lead Time (วัน) *</label><input type="number" id="s_lead" min="1" value="${s ? s.lead_time : 7}" required></div>
      <div class="field"><label>ช่องทางติดต่อ</label><input id="s_contact" value="${s ? s.contact || '' : ''}"></div>
      <div class="modal-actions"><button type="button" class="btn ghost" onclick="closeModal()">ยกเลิก</button>
        <button type="submit" class="btn">${id ? 'บันทึก' : 'เพิ่ม Supplier'}</button></div>
    </form>`);
  document.getElementById('supplierForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api(id ? '/suppliers/' + id : '/suppliers', { method: id ? 'PUT' : 'POST', body: { supplier_name: val('s_name'), lead_time: val('s_lead'), contact: val('s_contact') } });
      toast('บันทึกเรียบร้อย', 'success'); closeModal(); loadSuppliers();
    } catch (err) { toast(err.message, 'error'); }
  });
}
document.getElementById('addSupplierBtn').addEventListener('click', () => openSupplierForm(null));
async function deleteSupplier(id) {
  if (!confirm('ยืนยันการลบ Supplier นี้?')) return;
  try { await api('/suppliers/' + id, { method: 'DELETE' }); toast('ลบเรียบร้อย', 'success'); loadSuppliers(); }
  catch (e) { toast(e.message, 'error'); }
}

/* ============ DEAD STOCK ============ */
async function loadDeadStock() {
  try {
    const list = await api('/ai/deadstock');
    document.getElementById('deadstockTableWrap').innerHTML = list.length ? `
      <table><thead><tr><th>สินค้า</th><th>คงเหลือ</th><th>ขายล่าสุด</th><th>ไม่ขาย (วัน)</th><th>มูลค่าจม</th><th>ระดับ</th></tr></thead>
      <tbody>${list.map(d => `<tr><td style="text-align:right">${d.product_name} (${d.size})</td><td>${fmt(d.current_stock)}</td>
        <td>${d.last_sale_at || 'ไม่เคยขาย'}</td><td>${d.days_since_last_sale}</td><td>${fmtBaht(d.value_at_risk)}</td>
        <td><span class="tag ${d.cls}">${d.level}</span></td></tr>`).join('')}</tbody></table>`
      : `<div class="empty">ไม่มีสินค้าค้างสต็อก</div>`;
  } catch (e) { toast(e.message, 'error'); }
}

/* ============ INIT ============ */
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await api('/auth/logout', { method: 'POST' });
  window.location.href = '/login.html';
});
(async function init() {
  try {
    const me = await api('/me');
    document.getElementById('whoami').textContent = `${me.username} (${me.role === 'admin' ? 'เจ้าของร้าน' : 'พนักงาน'})`;
    loadDashboard();
  } catch (e) { /* redirected to login already */ }
})();

<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>เข้าสู่ระบบ - StockUniform AI</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<div class="login-wrap">
  <form class="login-card" id="loginForm">
    <div class="brand-mark" style="color:#1E2A44;">SU</div>
    <h1>StockUniform AI</h1>
    <div class="sub">ระบบจัดการสต็อกร้านชุดนักศึกษา</div>
    <div class="login-err" id="loginErr"></div>
    <div class="field">
      <label>ชื่อผู้ใช้</label>
      <input type="text" id="username" autocomplete="username" required>
    </div>
    <div class="field">
      <label>รหัสผ่าน</label>
      <input type="password" id="password" autocomplete="current-password" required>
    </div>
    <button class="btn block" type="submit" id="loginBtn">เข้าสู่ระบบ</button>
    <div class="note" style="margin-top:16px;">ผู้ใช้เริ่มต้น: admin / admin123 (กรุณาเปลี่ยนรหัสผ่านหลังใช้งานครั้งแรก)</div>
  </form>
</div>
<script>
document.getElementById('loginForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  const errBox = document.getElementById('loginErr');
  errBox.style.display = 'none';
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> กำลังเข้าสู่ระบบ...';
  try{
    const res = await fetch('/api/auth/login', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ username: document.getElementById('username').value, password: document.getElementById('password').value })
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'เข้าสู่ระบบไม่สำเร็จ');
    window.location.href = '/';
  }catch(err){
    errBox.textContent = err.message;
    errBox.style.display = 'block';
  }finally{
    btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ';
  }
});
</script>
</body>
</html>

<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>StockUniform AI - ระบบจัดการสต็อกร้านชุดนักศึกษา</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<div id="toastHost"></div>

<div class="app">
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-mark">SU</div>
      <div class="brand-name">StockUniform AI</div>
      <div class="brand-sub">ระบบจัดการสต็อกร้านชุดนักศึกษา</div>
    </div>
    <nav id="navList">
      <button class="nav-item active" data-view="dashboard">แดชบอร์ด</button>
      <button class="nav-item" data-view="products">สินค้าและสต็อก</button>
      <button class="nav-item" data-view="receiving">รับสินค้าเข้า</button>
      <button class="nav-item" data-view="sales">ขายสินค้า</button>
      <button class="nav-item" data-view="purchase">คำแนะนำสั่งซื้อ (AI)</button>
      <button class="nav-item" data-view="purchaseorders">ใบสั่งซื้อ</button>
      <button class="nav-item" data-view="suppliers">Supplier</button>
      <button class="nav-item" data-view="deadstock">สินค้าค้างสต็อก</button>
    </nav>
    <div class="sidebar-foot">
      <span id="whoami"></span>
      <button class="logout-btn" id="logoutBtn">ออกจากระบบ</button>
    </div>
  </aside>

  <main>
    <!-- DASHBOARD -->
    <section class="view active" id="view-dashboard">
      <div class="topbar"><div><h1>ภาพรวมร้านค้า</h1><div class="sub">ข้อมูลจากฐานข้อมูลจริงแบบเรียลไทม์</div></div></div>
      <div class="kpi-row" id="kpiRow"><div class="skeleton" style="height:70px"></div></div>
      <section class="block">
        <div class="block-head"><h2>คำแนะนำสั่งซื้อเร่งด่วนจาก AI</h2><button class="link" data-goto="purchase">ดูทั้งหมด →</button></div>
        <div id="dashRecs"></div>
      </section>
      <section class="block">
        <div class="block-head"><h2>สินค้าค้างสต็อกวิกฤต</h2><button class="link" data-goto="deadstock">ดูทั้งหมด →</button></div>
        <div id="dashDead"></div>
      </section>
    </section>

    <!-- PRODUCTS -->
    <section class="view" id="view-products">
      <div class="topbar">
        <div><h1>สินค้าและสต็อก</h1><div class="sub" id="productsCount"></div></div>
        <button class="btn" id="addProductBtn">+ เพิ่มสินค้า</button>
      </div>
      <div class="filter-row">
        <input type="text" id="searchInput" placeholder="ค้นหาชื่อสินค้าหรือรหัส SKU">
        <select id="categoryFilter"><option value="">ทุกหมวดหมู่</option></select>
        <select id="statusFilter">
          <option value="">ทุกสถานะ</option><option value="out">สินค้าหมด</option><option value="low">ใกล้หมด</option><option value="ok">ปกติ</option>
        </select>
      </div>
      <div id="productsTableWrap"><div class="skeleton" style="height:200px"></div></div>
    </section>

    <!-- PRODUCT DETAIL -->
    <section class="view" id="view-productdetail">
      <div class="topbar"><div><button class="link" data-goto="products">← กลับไปรายการสินค้า</button></div></div>
      <div id="productDetailBody"></div>
    </section>

    <!-- RECEIVING -->
    <section class="view" id="view-receiving">
      <div class="topbar"><div><h1>รับสินค้าเข้าสต็อก</h1><div class="sub">บันทึกการรับสินค้าจาก Supplier</div></div></div>
      <form id="receiveForm" style="max-width:460px;">
        <div class="field"><label>สินค้า *</label><select id="rcvProduct" required></select></div>
        <div class="field"><label>จำนวนที่รับเข้า *</label><input type="number" id="rcvQty" min="1" required></div>
        <div class="field"><label>เลขที่เอกสาร</label><input type="text" id="rcvRef" placeholder="เช่น INV-2026-001"></div>
        <div class="field"><label>หมายเหตุ</label><input type="text" id="rcvNote"></div>
        <button class="btn block" type="submit">บันทึกการรับสินค้า</button>
      </form>
    </section>

    <!-- SALES -->
    <section class="view" id="view-sales">
      <div class="topbar"><div><h1>ขายสินค้า / ตัดสต็อก</h1><div class="sub">บันทึกการขายและตัดสต็อกอัตโนมัติ</div></div></div>
      <form id="saleForm" style="max-width:460px;">
        <div class="field"><label>สินค้า *</label><select id="saleProduct" required></select></div>
        <div class="field"><label id="saleStockLabel">คงเหลือ: -</label></div>
        <div class="field"><label>จำนวนที่ขาย *</label><input type="number" id="saleQty" min="1" required></div>
        <div class="field"><label>ราคาขาย (บาท/ชิ้น)</label><input type="number" id="salePrice" step="0.01"></div>
        <button class="btn block" type="submit">บันทึกการขาย</button>
      </form>
      <h2 style="font-size:14px;margin:24px 0 10px;color:var(--navy);">รายการขายล่าสุด</h2>
      <div id="salesTableWrap"></div>
    </section>

    <!-- PURCHASE AI -->
    <section class="view" id="view-purchase">
      <div class="topbar"><div><h1>คำแนะนำสั่งซื้อจาก AI</h1><div class="sub">คำนวณจากยอดขายจริงและสูตร Reorder Point + Safety Stock</div></div></div>
      <div id="purchaseList"><div class="skeleton" style="height:100px"></div></div>
      <div class="note">สูตรคำนวณ: จุดสั่งซื้อ = (ยอดขายเฉลี่ย/วัน × ระยะเวลารอสินค้า) + สต็อกปลอดภัย — คำนวณสดจากประวัติการขายจริง 30 วันล่าสุด</div>
    </section>

    <!-- PURCHASE ORDERS -->
    <section class="view" id="view-purchaseorders">
      <div class="topbar">
        <div><h1>ใบสั่งซื้อ</h1><div class="sub">จัดการใบสั่งซื้อและรับสินค้าเข้าสต็อกอัตโนมัติ</div></div>
        <button class="btn" id="addPOBtn">+ สร้างใบสั่งซื้อ</button>
      </div>
      <div id="poListWrap"><div class="skeleton" style="height:150px"></div></div>
    </section>

    <!-- SUPPLIERS -->
    <section class="view" id="view-suppliers">
      <div class="topbar">
        <div><h1>จัดการ Supplier</h1></div>
        <button class="btn" id="addSupplierBtn">+ เพิ่ม Supplier</button>
      </div>
      <div id="suppliersTableWrap"><div class="skeleton" style="height:150px"></div></div>
    </section>

    <!-- DEAD STOCK -->
    <section class="view" id="view-deadstock">
      <div class="topbar"><div><h1>วิเคราะห์สินค้าค้างสต็อก</h1><div class="sub">คำนวณจากวันที่ขายล่าสุดจริงในระบบ (เกณฑ์ 30/60/90 วัน)</div></div></div>
      <div id="deadstockTableWrap"><div class="skeleton" style="height:150px"></div></div>
    </section>
  </main>
</div>

<!-- MODAL -->
<div class="modal-overlay" id="modalOverlay"><div class="modal" id="modalBody"></div></div>

<script src="/app.js"></script>
</body>
</html>

const { db } = require('../db');
const { MSG, ApiError } = require('../utils');

function listSuppliers() {
  return db.prepare(`
    SELECT sup.*, (SELECT COUNT(*) FROM products WHERE supplier_id = sup.supplier_id AND is_active=1) as product_count,
      (SELECT COUNT(*) FROM purchase_orders WHERE supplier_id = sup.supplier_id) as po_count
    FROM suppliers sup ORDER BY sup.supplier_name
  `).all();
}

function getSupplier(id) {
  const s = db.prepare('SELECT * FROM suppliers WHERE supplier_id=?').get(id);
  if (!s) throw new ApiError(404, MSG.NOT_FOUND);
  const orders = db.prepare(`
    SELECT * FROM purchase_orders WHERE supplier_id=? ORDER BY created_at DESC
  `).all(id);
  return { ...s, orders };
}

function createSupplier(body) {
  if (!body.supplier_name) throw new ApiError(400, MSG.REQUIRED('ชื่อ Supplier'));
  const info = db.prepare('INSERT INTO suppliers (supplier_name, lead_time, contact) VALUES (?,?,?)')
    .run(body.supplier_name, Number(body.lead_time) || 7, body.contact || '');
  return db.prepare('SELECT * FROM suppliers WHERE supplier_id=?').get(info.lastInsertRowid);
}

function updateSupplier(id, body) {
  const existing = db.prepare('SELECT * FROM suppliers WHERE supplier_id=?').get(id);
  if (!existing) throw new ApiError(404, MSG.NOT_FOUND);
  db.prepare('UPDATE suppliers SET supplier_name=?, lead_time=?, contact=? WHERE supplier_id=?')
    .run(body.supplier_name ?? existing.supplier_name, Number(body.lead_time) || existing.lead_time,
      body.contact ?? existing.contact, id);
  return db.prepare('SELECT * FROM suppliers WHERE supplier_id=?').get(id);
}

function deleteSupplier(id) {
  const existing = db.prepare('SELECT * FROM suppliers WHERE supplier_id=?').get(id);
  if (!existing) throw new ApiError(404, MSG.NOT_FOUND);
  const inUse = db.prepare('SELECT COUNT(*) c FROM products WHERE supplier_id=? AND is_active=1').get(id).c;
  if (inUse > 0) throw new ApiError(409, `ไม่สามารถลบได้ เนื่องจากมีสินค้า ${inUse} รายการผูกกับ Supplier นี้อยู่`);
  db.prepare('DELETE FROM suppliers WHERE supplier_id=?').run(id);
  return { ok: true };
}

module.exports = { listSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier };

const { db } = require('../db');
const { recalcProduct } = require('../ruleEngine');
const { MSG, ApiError } = require('../utils');

function requireFields(body, fields) {
  for (const [key, label] of fields) {
    if (body[key] === undefined || body[key] === null || body[key] === '') {
      throw new ApiError(400, MSG.REQUIRED(label));
    }
  }
}

function listProducts(query) {
  let sql = `
    SELECT p.*, s.quantity as current_stock, sup.supplier_name
    FROM products p
    LEFT JOIN stock s ON s.product_id = p.product_id
    LEFT JOIN suppliers sup ON sup.supplier_id = p.supplier_id
    WHERE p.is_active = 1
  `;
  const params = [];
  if (query.q) {
    sql += ` AND (p.product_name LIKE ? OR p.sku LIKE ?)`;
    params.push(`%${query.q}%`, `%${query.q}%`);
  }
  if (query.category) { sql += ` AND p.category = ?`; params.push(query.category); }
  if (query.status) {
    if (query.status === 'out') sql += ` AND COALESCE(s.quantity,0) = 0`;
    else if (query.status === 'low') sql += ` AND COALESCE(s.quantity,0) > 0 AND COALESCE(s.quantity,0) <= p.reorder_point`;
    else if (query.status === 'ok') sql += ` AND COALESCE(s.quantity,0) > p.reorder_point`;
  }
  sql += ` ORDER BY p.updated_at DESC`;
  return db.prepare(sql).all(...params);
}

function getProduct(id) {
  const p = db.prepare(`
    SELECT p.*, s.quantity as current_stock, sup.supplier_name
    FROM products p
    LEFT JOIN stock s ON s.product_id = p.product_id
    LEFT JOIN suppliers sup ON sup.supplier_id = p.supplier_id
    WHERE p.product_id = ?
  `).get(id);
  if (!p) throw new ApiError(404, MSG.NOT_FOUND);
  const history = db.prepare(`
    SELECT * FROM stock_transactions WHERE product_id = ? ORDER BY created_at DESC LIMIT 100
  `).all(id);
  return { ...p, history };
}

function createProduct(body) {
  requireFields(body, [
    ['sku', 'รหัส SKU'], ['product_name', 'ชื่อสินค้า'], ['category', 'หมวดหมู่'], ['size', 'ไซซ์'],
  ]);
  const dup = db.prepare('SELECT product_id FROM products WHERE sku = ?').get(body.sku);
  if (dup) throw new ApiError(409, MSG.DUP_SKU);

  const info = db.prepare(`
    INSERT INTO products (sku, product_name, category, gender, size, color, cost_price, selling_price,
      minimum_stock, supplier_id)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(
    body.sku, body.product_name, body.category, body.gender || '', body.size, body.color || '',
    Number(body.cost_price) || 0, Number(body.selling_price) || 0,
    Number(body.minimum_stock) || 0, body.supplier_id || null
  );
  const productId = info.lastInsertRowid;
  db.prepare('INSERT INTO stock (product_id, quantity) VALUES (?, ?)').run(productId, Number(body.initial_stock) || 0);
  if (Number(body.initial_stock) > 0) {
    db.prepare(`INSERT INTO stock_transactions (product_id, transaction_type, quantity, reference, note) VALUES (?,?,?,?,?)`)
      .run(productId, 'adjust', Number(body.initial_stock), 'INIT', 'สต็อกตั้งต้นตอนสร้างสินค้า');
  }
  recalcProduct(productId);
  return getProduct(productId);
}

function updateProduct(id, body) {
  const existing = db.prepare('SELECT * FROM products WHERE product_id = ?').get(id);
  if (!existing) throw new ApiError(404, MSG.NOT_FOUND);
  if (body.sku && body.sku !== existing.sku) {
    const dup = db.prepare('SELECT product_id FROM products WHERE sku = ? AND product_id != ?').get(body.sku, id);
    if (dup) throw new ApiError(409, MSG.DUP_SKU);
  }
  db.prepare(`
    UPDATE products SET sku=?, product_name=?, category=?, gender=?, size=?, color=?, cost_price=?, selling_price=?,
      minimum_stock=?, supplier_id=?, updated_at=datetime('now')
    WHERE product_id=?
  `).run(
    body.sku ?? existing.sku, body.product_name ?? existing.product_name, body.category ?? existing.category,
    body.gender ?? existing.gender, body.size ?? existing.size, body.color ?? existing.color,
    body.cost_price !== undefined ? Number(body.cost_price) : existing.cost_price,
    body.selling_price !== undefined ? Number(body.selling_price) : existing.selling_price,
    body.minimum_stock !== undefined ? Number(body.minimum_stock) : existing.minimum_stock,
    body.supplier_id ?? existing.supplier_id, id
  );
  recalcProduct(id);
  return getProduct(id);
}

function deleteProduct(id) {
  const existing = db.prepare('SELECT * FROM products WHERE product_id = ?').get(id);
  if (!existing) throw new ApiError(404, MSG.NOT_FOUND);
  // soft delete เพื่อรักษาประวัติ transaction/sales ที่อ้างอิงสินค้านี้ไว้
  db.prepare(`UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE product_id = ?`).run(id);
  return { ok: true };
}

/** รับสินค้าเข้าสต็อก */
function receiveStock(body, userId) {
  requireFields(body, [['product_id', 'สินค้า'], ['quantity', 'จำนวน']]);
  const qty = Number(body.quantity);
  if (!Number.isFinite(qty) || qty <= 0) throw new ApiError(400, 'จำนวนต้องเป็นตัวเลขมากกว่า 0');
  const product = db.prepare('SELECT * FROM products WHERE product_id = ?').get(body.product_id);
  if (!product) throw new ApiError(404, MSG.NOT_FOUND);

  db.prepare(`UPDATE stock SET quantity = quantity + ?, updated_at = datetime('now') WHERE product_id = ?`)
    .run(qty, body.product_id);
  db.prepare(`INSERT INTO stock_transactions (product_id, transaction_type, quantity, reference, note, created_by) VALUES (?,?,?,?,?,?)`)
    .run(body.product_id, 'receive', qty, body.reference || null, body.note || null, userId || null);
  recalcProduct(body.product_id);
  return getProduct(body.product_id);
}

/** ปรับยอดสต็อกด้วยมือ (บวก/ลบ) พร้อมกันสต็อกติดลบ */
function adjustStock(body, userId) {
  requireFields(body, [['product_id', 'สินค้า'], ['quantity', 'จำนวนที่ปรับ']]);
  const qty = Number(body.quantity);
  if (!Number.isFinite(qty) || qty === 0) throw new ApiError(400, 'จำนวนต้องเป็นตัวเลขและไม่เป็นศูนย์');
  const stockRow = db.prepare('SELECT * FROM stock WHERE product_id = ?').get(body.product_id);
  if (!stockRow) throw new ApiError(404, MSG.NOT_FOUND);
  if (stockRow.quantity + qty < 0) throw new ApiError(400, 'ไม่สามารถปรับสต็อกให้ติดลบได้');

  db.prepare(`UPDATE stock SET quantity = quantity + ?, updated_at = datetime('now') WHERE product_id = ?`)
    .run(qty, body.product_id);
  db.prepare(`INSERT INTO stock_transactions (product_id, transaction_type, quantity, reference, note, created_by) VALUES (?,?,?,?,?,?)`)
    .run(body.product_id, 'adjust', qty, body.reference || null, body.note || 'ปรับยอดด้วยมือ', userId || null);
  recalcProduct(body.product_id);
  return getProduct(body.product_id);
}

module.exports = { listProducts, getProduct, createProduct, updateProduct, deleteProduct, receiveStock, adjustStock };

const { db } = require('../db');
const { recalcProduct } = require('../ruleEngine');
const { MSG, ApiError } = require('../utils');

function createSale(body, userId) {
  if (!body.product_id || !body.quantity) throw new ApiError(400, MSG.REQUIRED('สินค้าและจำนวน'));
  const qty = Number(body.quantity);
  if (!Number.isFinite(qty) || qty <= 0) throw new ApiError(400, 'จำนวนต้องเป็นตัวเลขมากกว่า 0');

  const product = db.prepare('SELECT * FROM products WHERE product_id = ?').get(body.product_id);
  if (!product) throw new ApiError(404, MSG.NOT_FOUND);
  const stockRow = db.prepare('SELECT * FROM stock WHERE product_id = ?').get(body.product_id);
  const currentStock = stockRow ? stockRow.quantity : 0;
  if (currentStock < qty) throw new ApiError(400, MSG.INSUFFICIENT_STOCK + ` (คงเหลือ ${currentStock} ชิ้น)`);

  const sellingPrice = body.selling_price !== undefined ? Number(body.selling_price) : product.selling_price;

  db.prepare('INSERT INTO sales (product_id, quantity, selling_price, created_by) VALUES (?,?,?,?)')
    .run(body.product_id, qty, sellingPrice, userId || null);
  db.prepare(`UPDATE stock SET quantity = quantity - ?, updated_at = datetime('now') WHERE product_id = ?`)
    .run(qty, body.product_id);
  db.prepare(`INSERT INTO stock_transactions (product_id, transaction_type, quantity, reference, note, created_by) VALUES (?,?,?,?,?,?)`)
    .run(body.product_id, 'sale', -qty, body.reference || null, body.note || null, userId || null);

  recalcProduct(body.product_id);
  const updated = db.prepare(`
    SELECT p.*, s.quantity as current_stock FROM products p LEFT JOIN stock s ON s.product_id=p.product_id
    WHERE p.product_id = ?`).get(body.product_id);
  return { ok: true, product: updated };
}

function listSales(query) {
  let sql = `
    SELECT sa.*, p.product_name, p.sku FROM sales sa
    JOIN products p ON p.product_id = sa.product_id
  `;
  const params = [];
  if (query.from) { sql += (params.length ? ' AND' : ' WHERE') + ' sa.sold_at >= ?'; params.push(query.from); }
  if (query.to) { sql += (params.length ? ' AND' : ' WHERE') + ' sa.sold_at <= ?'; params.push(query.to); }
  sql += ' ORDER BY sa.sold_at DESC LIMIT 200';
  return db.prepare(sql).all(...params);
}

module.exports = { createSale, listSales };

const { verifyUser, createSession, destroySession } = require('../auth');
const { MSG, ApiError } = require('../utils');

async function login(body) {
  const { username, password } = body;
  if (!username || !password) throw new ApiError(400, MSG.REQUIRED('ชื่อผู้ใช้และรหัสผ่าน'));
  const user = verifyUser(username, password);
  if (!user) throw new ApiError(401, MSG.INVALID_LOGIN);
  const session = createSession(user.user_id);
  return { token: session.token, user: { username: user.username, role: user.role } };
}

async function logout(token) {
  if (token) destroySession(token);
  return { ok: true };
}

module.exports = { login, logout };

const { db } = require('../db');
const { getPurchaseRecommendations, getDeadStockAnalysis } = require('../ruleEngine');

function recommendations() { return getPurchaseRecommendations(); }
function deadStock() { return getDeadStockAnalysis(); }

function dashboard() {
  const totalProducts = db.prepare('SELECT COUNT(*) c FROM products WHERE is_active=1').get().c;
  const outOfStock = db.prepare(`
    SELECT COUNT(*) c FROM products p LEFT JOIN stock s ON s.product_id=p.product_id
    WHERE p.is_active=1 AND COALESCE(s.quantity,0)=0`).get().c;
  const stockValue = db.prepare(`
    SELECT COALESCE(SUM(p.cost_price * COALESCE(s.quantity,0)),0) v
    FROM products p LEFT JOIN stock s ON s.product_id=p.product_id WHERE p.is_active=1`).get().v;
  const salesLast30 = db.prepare(`
    SELECT COALESCE(SUM(quantity*selling_price),0) v FROM sales WHERE sold_at >= datetime('now','-30 days')`).get().v;

  const recs = getPurchaseRecommendations();
  const dead = getDeadStockAnalysis();
  const deadValue = dead.reduce((s, d) => s + d.value_at_risk, 0);

  return {
    total_products: totalProducts,
    out_of_stock: outOfStock,
    need_reorder: recs.length,
    urgent_reorder: recs.filter(r => r.urgency === 'urgent').length,
    stock_value: Math.round(stockValue),
    sales_last_30_days: Math.round(salesLast30),
    dead_stock_count: dead.length,
    dead_stock_value: deadValue,
    top_recommendations: recs.slice(0, 5),
    critical_dead_stock: dead.filter(d => d.cls === 'crit').slice(0, 5),
  };
}

module.exports = { recommendations, deadStock, dashboard };

const { db } = require('../db');
const { recalcProduct } = require('../ruleEngine');
const { MSG, ApiError } = require('../utils');

const VALID_STATUS = ['draft', 'ordered', 'received', 'cancelled'];
const VALID_TRANSITIONS = {
  draft: ['ordered', 'cancelled'],
  ordered: ['received', 'cancelled'],
  received: [],
  cancelled: [],
};

function listPurchaseOrders() {
  const orders = db.prepare(`
    SELECT po.*, sup.supplier_name FROM purchase_orders po
    JOIN suppliers sup ON sup.supplier_id = po.supplier_id
    ORDER BY po.created_at DESC
  `).all();
  const items = db.prepare(`
    SELECT poi.*, p.product_name, p.sku FROM purchase_order_items poi
    JOIN products p ON p.product_id = poi.product_id
    WHERE poi.purchase_order_id = ?
  `);
  return orders.map(o => ({
    ...o,
    items: items.all(o.purchase_order_id),
    total: items.all(o.purchase_order_id).reduce((s, it) => s + it.quantity * it.unit_cost, 0),
  }));
}

function createPurchaseOrder(body, userId) {
  if (!body.supplier_id) throw new ApiError(400, MSG.REQUIRED('Supplier'));
  if (!Array.isArray(body.items) || body.items.length === 0) throw new ApiError(400, 'กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ');
  for (const it of body.items) {
    if (!it.product_id || !it.quantity || Number(it.quantity) <= 0) {
      throw new ApiError(400, 'กรุณาระบุสินค้าและจำนวนให้ครบทุกรายการ');
    }
  }
  const info = db.prepare('INSERT INTO purchase_orders (supplier_id, status, created_by) VALUES (?,?,?)')
    .run(body.supplier_id, 'draft', userId || null);
  const poId = info.lastInsertRowid;
  const insItem = db.prepare('INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, unit_cost) VALUES (?,?,?,?)');
  for (const it of body.items) {
    const product = db.prepare('SELECT cost_price FROM products WHERE product_id=?').get(it.product_id);
    insItem.run(poId, it.product_id, Number(it.quantity), it.unit_cost !== undefined ? Number(it.unit_cost) : (product ? product.cost_price : 0));
  }
  return getPurchaseOrder(poId);
}

function getPurchaseOrder(id) {
  const o = db.prepare(`
    SELECT po.*, sup.supplier_name FROM purchase_orders po JOIN suppliers sup ON sup.supplier_id=po.supplier_id
    WHERE po.purchase_order_id=?`).get(id);
  if (!o) throw new ApiError(404, MSG.NOT_FOUND);
  const items = db.prepare(`
    SELECT poi.*, p.product_name, p.sku FROM purchase_order_items poi
    JOIN products p ON p.product_id=poi.product_id WHERE poi.purchase_order_id=?`).all(id);
  return { ...o, items, total: items.reduce((s, it) => s + it.quantity * it.unit_cost, 0) };
}

function updateStatus(id, body, userId) {
  const order = db.prepare('SELECT * FROM purchase_orders WHERE purchase_order_id=?').get(id);
  if (!order) throw new ApiError(404, MSG.NOT_FOUND);
  const newStatus = body.status;
  if (!VALID_STATUS.includes(newStatus)) throw new ApiError(400, 'สถานะไม่ถูกต้อง');
  if (!VALID_TRANSITIONS[order.status].includes(newStatus)) {
    throw new ApiError(400, `ไม่สามารถเปลี่ยนสถานะจาก "${order.status}" เป็น "${newStatus}" ได้`);
  }

  if (newStatus === 'received') {
    const items = db.prepare('SELECT * FROM purchase_order_items WHERE purchase_order_id=?').all(id);
    for (const it of items) {
      db.prepare(`UPDATE stock SET quantity = quantity + ?, updated_at=datetime('now') WHERE product_id=?`)
        .run(it.quantity, it.product_id);
      db.prepare(`INSERT INTO stock_transactions (product_id, transaction_type, quantity, reference, note, created_by) VALUES (?,?,?,?,?,?)`)
        .run(it.product_id, 'po_receive', it.quantity, `PO-${id}`, 'รับสินค้าตามใบสั่งซื้อ', userId || null);
      recalcProduct(it.product_id);
    }
    db.prepare(`UPDATE purchase_orders SET status=?, received_at=datetime('now') WHERE purchase_order_id=?`).run(newStatus, id);
  } else {
    db.prepare('UPDATE purchase_orders SET status=? WHERE purchase_order_id=?').run(newStatus, id);
  }
  return getPurchaseOrder(id);
}

module.exports = { listPurchaseOrders, createPurchaseOrder, getPurchaseOrder, updateStatus };

# คัดลอกไฟล์นี้เป็น .env แล้วปรับค่าตามต้องการ (ไม่บังคับ — ถ้าไม่ตั้งค่า ระบบจะใช้ค่า default)

# พอร์ตที่เว็บเซิร์ฟเวอร์จะรัน
PORT=3000

# ตำแหน่งไฟล์ฐานข้อมูล SQLite (default: ./data/stockuniform.db)
DB_PATH=./data/stockuniform.db
