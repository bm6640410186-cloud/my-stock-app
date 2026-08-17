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
