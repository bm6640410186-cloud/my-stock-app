const express = require('express');
const router = express.Router();

// ตัวแปรเก็บข้อมูลสินค้าจำลอง
let products = [
  { id: 1, product_name: 'เสื้อเชิ้ตแขนยาว', category: 'เสื้อนักศึกษา', size: 'M', current_stock: 50, cost_price: 150, selling_price: 250 },
  { id: 2, product_name: 'กระโปรงพลีท', category: 'กระโปรง', size: 'Free Size', current_stock: 30, cost_price: 180, selling_price: 300 }
];

// ดึงรายการสินค้าทั้งหมด
router.get('/', (req, res) => {
  res.json(products);
});

// เพิ่มสินค้าใหม่
router.post('/', (req, res) => {
  const { product_name, category, size, current_stock, cost_price, selling_price } = req.body;
  
  const newProduct = {
    id: products.length + 1,
    product_name,
    category,
    size,
    current_stock: Number(current_stock) || 0,
    cost_price: Number(cost_price) || 0,
    selling_price: Number(selling_price) || 0
  };

  products.push(newProduct);
  res.status(201).json({ message: 'บันทึกสินค้าสำเร็จ', product: newProduct });
});

module.exports = router;
