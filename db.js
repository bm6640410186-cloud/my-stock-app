const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// จำลองการจัดเก็บข้อมูลผ่าน JSON / Memory เพื่อป้องกัน Module Not Found
const dbPath = path.join(__dirname, 'data.json');

function loadData() {
  if (!fs.existsSync(dbPath)) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync('admin123', salt, 64).toString('hex');
    const initialData = {
      users: [
        { id: 1, username: 'admin', password_hash: hash, salt: salt, role: 'admin' }
      ],
      sessions: []
    };
    fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  try {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch (e) {
    return { users: [], sessions: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

const db = {
  prepare: (sql) => {
    return {
      get: (...params) => {
        const data = loadData();
        if (sql.includes('FROM users WHERE username =')) {
          return data.users.find(u => u.username === params[0]) || null;
        }
        if (sql.includes('FROM sessions s')) {
          const session = data.sessions.find(s => s.token === params[0]);
          if (!session) return null;
          const user = data.users.find(u => u.id === session.user_id);
          if (!user) return null;
          return { ...session, username: user.username, role: user.role };
        }
        return null;
      },
      run: (...params) => {
        const data = loadData();
        if (sql.includes('INSERT INTO sessions')) {
          data.sessions.push({ token: params[0], user_id: params[1], expires_at: params[2] });
          saveData(data);
        }
        if (sql.includes('DELETE FROM sessions WHERE token =')) {
          data.sessions = data.sessions.filter(s => s.token !== params[0]);
          saveData(data);
        }
        return { changes: 1 };
      }
    };
  }
};

module.exports = { db };
