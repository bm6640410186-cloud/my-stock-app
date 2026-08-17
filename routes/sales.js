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



