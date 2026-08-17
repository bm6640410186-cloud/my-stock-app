const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

const { sendJson, parseBody, parseCookies, ApiError, MSG } = require('./utils');
const { getSessionUser } = require('./auth');
const authRoutes = require('./routes/auth');
const products = require('./routes/products');
const sales = require('./routes/sales');
const suppliers = require('./routes/suppliers');
const po = require('./routes/purchaseOrders');
const ai = require('./routes/ai');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };

function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(PUBLIC_DIR, filePath);
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (pathname !== '/' && !pathname.startsWith('/api')) {
        // SPA fallback -> index.html for client-side view routes like /login handled client side
        return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, d2) => {
          if (e2) { res.writeHead(404); return res.end('Not found'); }
          res.writeHead(200, { 'Content-Type': MIME['.html'] });
          res.end(d2);
        });
      }
      res.writeHead(404); return res.end('Not found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const query = parsed.query;

  if (!pathname.startsWith('/api/')) return serveStatic(req, res, pathname);

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const cookies = parseCookies(req);
  const token = cookies.sid;
  const user = getSessionUser(token);

  try {
    // ---- Auth (ไม่ต้อง login) ----
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await parseBody(req);
      const result = await authRoutes.login(body);
      res.setHeader('Set-Cookie', `sid=${result.token}; HttpOnly; Path=/; Max-Age=${7 * 86400}; SameSite=Lax`);
      return sendJson(res, 200, { user: result.user });
    }

    // ---- ทุก endpoint ถัดจากนี้ต้อง login ----
    if (!user) throw new ApiError(401, MSG.UNAUTHORIZED);

    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      await authRoutes.logout(token);
      res.setHeader('Set-Cookie', 'sid=; HttpOnly; Path=/; Max-Age=0');
      return sendJson(res, 200, { ok: true });
    }
    if (pathname === '/api/me' && req.method === 'GET') {
      return sendJson(res, 200, { username: user.username, role: user.role });
    }

    // ---- Dashboard / AI ----
    if (pathname === '/api/dashboard' && req.method === 'GET') return sendJson(res, 200, ai.dashboard());
    if (pathname === '/api/ai/recommendations' && req.method === 'GET') return sendJson(res, 200, ai.recommendations());
    if (pathname === '/api/ai/deadstock' && req.method === 'GET') return sendJson(res, 200, ai.deadStock());

    // ---- Products ----
    let m;
    if (pathname === '/api/products' && req.method === 'GET') return sendJson(res, 200, products.listProducts(query));
    if (pathname === '/api/products' && req.method === 'POST') {
      const body = await parseBody(req);
      return sendJson(res, 201, products.createProduct(body));
    }
    if ((m = pathname.match(/^\/api\/products\/(\d+)$/)) && req.method === 'GET') {
      return sendJson(res, 200, products.getProduct(m[1]));
    }
    if ((m = pathname.match(/^\/api\/products\/(\d+)$/)) && req.method === 'PUT') {
      const body = await parseBody(req);
      return sendJson(res, 200, products.updateProduct(m[1], body));
    }
    if ((m = pathname.match(/^\/api\/products\/(\d+)$/)) && req.method === 'DELETE') {
      if (user.role !== 'admin') throw new ApiError(403, MSG.FORBIDDEN);
      return sendJson(res, 200, products.deleteProduct(m[1]));
    }

    // ---- Stock ----
    if (pathname === '/api/stock/receive' && req.method === 'POST') {
      const body = await parseBody(req);
      return sendJson(res, 200, products.receiveStock(body, user.userId));
    }
    if (pathname === '/api/stock/adjust' && req.method === 'POST') {
      const body = await parseBody(req);
      return sendJson(res, 200, products.adjustStock(body, user.userId));
    }

    // ---- Sales ----
    if (pathname === '/api/sales' && req.method === 'GET') return sendJson(res, 200, sales.listSales(query));
    if (pathname === '/api/sales' && req.method === 'POST') {
      const body = await parseBody(req);
      return sendJson(res, 201, sales.createSale(body, user.userId));
    }

    // ---- Suppliers ----
    if (pathname === '/api/suppliers' && req.method === 'GET') return sendJson(res, 200, suppliers.listSuppliers());
    if (pathname === '/api/suppliers' && req.method === 'POST') {
      const body = await parseBody(req);
      return sendJson(res, 201, suppliers.createSupplier(body));
    }
    if ((m = pathname.match(/^\/api\/suppliers\/(\d+)$/)) && req.method === 'GET') {
      return sendJson(res, 200, suppliers.getSupplier(m[1]));
    }
    if ((m = pathname.match(/^\/api\/suppliers\/(\d+)$/)) && req.method === 'PUT') {
      const body = await parseBody(req);
      return sendJson(res, 200, suppliers.updateSupplier(m[1], body));
    }
    if ((m = pathname.match(/^\/api\/suppliers\/(\d+)$/)) && req.method === 'DELETE') {
      if (user.role !== 'admin') throw new ApiError(403, MSG.FORBIDDEN);
      return sendJson(res, 200, suppliers.deleteSupplier(m[1]));
    }

    // ---- Purchase Orders ----
    if (pathname === '/api/purchase-orders' && req.method === 'GET') return sendJson(res, 200, po.listPurchaseOrders());
    if (pathname === '/api/purchase-orders' && req.method === 'POST') {
      const body = await parseBody(req);
      return sendJson(res, 201, po.createPurchaseOrder(body, user.userId));
    }
    if ((m = pathname.match(/^\/api\/purchase-orders\/(\d+)$/)) && req.method === 'GET') {
      return sendJson(res, 200, po.getPurchaseOrder(m[1]));
    }
    if ((m = pathname.match(/^\/api\/purchase-orders\/(\d+)\/status$/)) && req.method === 'PUT') {
      const body = await parseBody(req);
      return sendJson(res, 200, po.updateStatus(m[1], body, user.userId));
    }

    throw new ApiError(404, 'ไม่พบ endpoint นี้');
  } catch (err) {
    if (err instanceof ApiError) return sendJson(res, err.status, { error: err.message });
    console.error(err);
    return sendJson(res, 500, { error: MSG.SERVER_ERROR });
  }
});

server.listen(PORT, () => {
  console.log(`StockUniform AI server running at http://localhost:${PORT}`);
});

module.exports = { server };
