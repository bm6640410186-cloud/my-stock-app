function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 2 * 1024 * 1024) { req.destroy(); reject(new Error('Payload too large')); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

// ข้อความ error/validation ภาษาไทย ใช้ร่วมกันทั้งระบบ
const MSG = {
  REQUIRED: (field) => `กรุณากรอก${field}`,
  DUP_SKU: 'รหัส SKU นี้มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น',
  NOT_FOUND: 'ไม่พบข้อมูลที่ต้องการ',
  INSUFFICIENT_STOCK: 'จำนวนสต็อกคงเหลือไม่เพียงพอสำหรับการขายนี้',
  UNAUTHORIZED: 'กรุณาเข้าสู่ระบบก่อนใช้งาน',
  FORBIDDEN: 'คุณไม่มีสิทธิ์ทำรายการนี้',
  INVALID_LOGIN: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
  SERVER_ERROR: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง',
};

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

module.exports = { sendJson, parseBody, parseCookies, MSG, ApiError };
