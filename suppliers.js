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
