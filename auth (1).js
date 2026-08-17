const { verifyUser, createSession, destroySession } = require('../auth');
const { MSG, ApiError } = require('../utils');

async function login(body) {
  const { username, password } = body;
  if (!username || !password) throw new ApiError(400, MSG.REQUIRED('ชื่อผู้ใช้และรหัสผ่าน'));
  const user = verifyUser(username, password);
  if (!user) throw new ApiError(401, MSG.INVALID_LOGIN);
  const session = createSession(user.user_id);
  return { token: session.token, user: { username: user.username, role: user.role } };
}

async function logout(token) {
  if (token) destroySession(token);
  return { ok: true };
}

module.exports = { login, logout };
