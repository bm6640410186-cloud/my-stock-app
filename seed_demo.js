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
