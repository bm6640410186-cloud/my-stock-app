const express = require('express');
const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === '1234') {
    req.session.user = { username: 'admin', role: 'admin' };
    return res.json({ message: 'เข้าสู่ระบบสำเร็จ' });
  }
  res.status(401).json({ message: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'ออกจากระบบสำเร็จ' });
});

module.exports = router;
