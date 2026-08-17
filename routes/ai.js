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
