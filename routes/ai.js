const express = require('express');
const router = express.Router();
const productRoutes = require('./products');

// API คำนวณคำแนะนำการสั่งซื้อด้วย AI (Rule-based Logic)
router.get('/reorder-suggestions', (req, res) => {
  // ดึงรายการสินค้าทั้งหมด
  const products = productRoutes.getProductsList ? productRoutes.getProductsList() : [];
  
  const threshold = 10; // จุดเตือนสต็อกต่ำ
  const targetStock = 50; // จำนวนสต็อกที่แนะนำให้เติมให้เต็ม

  const suggestions = products
    .filter(p => p.current_stock <= threshold)
    .map(p => ({
      product_id: p.id,
      product_name: p.product_name,
      category: p.category,
      size: p.size,
      current_stock: p.current_stock,
      suggested_reorder: targetStock - p.current_stock,
      priority: p.current_stock === 0 ? 'HIGH' : 'MEDIUM',
      reason: p.current_stock === 0 ? 'สินค้าหมดสต็อกแล้ว' : `สต็อกต่ำกว่าเกณฑ์ (${threshold} ชิ้น)`
    }));

  res.json(suggestions);
});

module.exports = router;
