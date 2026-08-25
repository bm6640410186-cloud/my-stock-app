const express = require('express');
const router = express.Router();
const db = require('../db');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  // รหัสผ่านฉุกเฉินสำหรับ admin
  if (username === 'admin' && password === '1234') {
    req.session.user = { id: 1, username: 'admin', role: 'admin' };
    return res.json({ message: 'เข้าสู่ระบบสำเร็จ', user: req.session.user });
  }

  // ตรวจสอบจากฐานข้อมูล
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return res.status(500).json({ message: 'เกิดข้อผิดพลาดทางเซิร์ฟเวอร์' });
    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
    }

    req.session.user = { id: user.id, username: user.username, role: user.role };
    res.json({ message: 'เข้าสู่ระบบสำเร็จ', user: req.session.user });
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ message: 'ไม่สามารถออกจากระบบได้' });
    res.clearCookie('connect.sid');
    res.json({ message: 'ออกจากระบบเรียบร้อย' });
  });
});

module.exports = router;
