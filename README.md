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
