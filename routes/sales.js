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
