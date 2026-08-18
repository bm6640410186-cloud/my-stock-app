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

