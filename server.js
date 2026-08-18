const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

const { sendJson, parseBody, parseCookies, ApiError, MSG } = require('./utils');
const { getSessionUser } = require('./routes/auth');
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
      const result = await authRoutes.login(body.username, body.password);
      
      if (!result) {
        return sendJson(res, 401, { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
      }

      // ปรับแต่ง Cookie ให้รองรับทั้ง HTTP/HTTPS และบันทึก Session ได้แน่นหนา
      res.setHeader('Set-Cookie', `sid=${result.token}; Path=/; Max-Age=${7 * 86400}; SameSite=Lax`);
      return sendJson(res, 200, { user: result.user, token: result.token });
    }

    if (pathname === '/api/auth/me' && req.method === 'GET') {
      return sendJson(res, 200, { user: user || null });
    }

    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      if (token) authRoutes.destroySession(token);
      res.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0; SameSite=Lax');
      return sendJson(res, 200, { success: true });
    }

    // Protection middleware
    if (!user) throw new ApiError(MSG.UNAUTHORIZED, 401);

    // ---- Products ----
    if (pathname === '/api/products' && req.method === 'GET') {
      return sendJson(res, 200, products.listProducts(query));
    }
    if (pathname === '/api/products' && req.method === 'POST') {
      const body = await parseBody(req);
      return sendJson(res, 201, products.createProduct(body, user));
    }
    if (pathname.startsWith('/api/products/') && req.method === 'PUT') {
      const id = parseInt(pathname.split('/')[3], 10);
      const body = await parseBody(req);
      return sendJson(res, 200, products.updateProduct(id, body, user));
    }
    if (pathname.startsWith('/api/products/') && req.method === 'DELETE') {
      const id = parseInt(pathname.split('/')[3], 10);
      return sendJson(res, 200, products.deleteProduct(id, user));
    }

    // ---- Sales ----
    if (pathname === '/api/sales' && req.method === 'GET') {
      return sendJson(res, 200, sales.listSales(query));
    }
    if (pathname === '/api/sales' && req.method === 'POST') {
      const body = await parseBody(req);
      return sendJson(res, 201, sales.createSale(body, user));
    }

    // ---- Suppliers ----
    if (pathname === '/api/suppliers' && req.method === 'GET') {
      return sendJson(res, 200, suppliers.listSuppliers());
    }
    if (pathname === '/api/suppliers' && req.method === 'POST') {
      const body = await parseBody(req);
      return sendJson(res, 201, suppliers.createSupplier(body));
    }

    // ---- Purchase Orders ----
    if (pathname === '/api/purchase-orders' && req.method === 'GET') {
      return sendJson(res, 200, po.listPOs());
    }
    if (pathname === '/api/purchase-orders' && req.method === 'POST') {
      const body = await parseBody(req);
      return sendJson(res, 201, po.createPO(body, user));
    }
    if (pathname.startsWith('/api/purchase-orders/') && pathname.endsWith('/receive') && req.method === 'POST') {
      const id = parseInt(pathname.split('/')[3], 10);
      return sendJson(res, 200, po.receivePO(id, user));
    }

    // ---- AI ----
    if (pathname === '/api/ai/forecast' && req.method === 'GET') {
      return sendJson(res, 200, await ai.getForecast());
    }
    if (pathname === '/api/ai/reorder-suggestions' && req.method === 'GET') {
      return sendJson(res, 200, await ai.getReorderSuggestions());
    }

    throw new ApiError('Not Found', 404);
  } catch (err) {
    if (err instanceof ApiError) {
      return sendJson(res, err.statusCode, { error: err.message });
    }
    console.error(err);
    return sendJson(res, 500, { error: MSG.SERVER_ERROR || 'Internal Server Error' });
  }
});

server.listen(PORT, () => {
  console.log(`StockUniform AI server running on http://localhost:${PORT}`);
});
