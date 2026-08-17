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
