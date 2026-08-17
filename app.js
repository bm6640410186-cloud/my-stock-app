/* ============ CORE: API CLIENT / TOAST / MODAL ============ */
async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) { window.location.href = '/login.html'; throw new Error('unauthorized'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
  return data;
}

function toast(message, type = '') {
  const host = document.getElementById('toastHost');
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

const modalOverlay = document.getElementById('modalOverlay');
const modalBody = document.getElementById('modalBody');
function openModal(html) { modalBody.innerHTML = html; modalOverlay.classList.add('active'); }
function closeModal() { modalOverlay.classList.remove('active'); modalBody.innerHTML = ''; }
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

const fmt = (n) => Number(n || 0).toLocaleString('th-TH');
const fmtBaht = (n) => '฿' + Number(n || 0).toLocaleString('th-TH');

/* ============ VIEW SWITCHING ============ */
const viewLoaders = {
  dashboard: loadDashboard, products: loadProducts, receiving: loadReceivingForm,
  sales: loadSalesView, purchase: loadPurchaseView, purchaseorders: loadPurchaseOrders,
  suppliers: loadSuppliers, deadstock: loadDeadStock,
};
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === name));
  if (viewLoaders[name]) viewLoaders[name]();
}
document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));
document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-goto]');
  if (g) showView(g.dataset.goto);
});

/* ============ DASHBOARD ============ */
function recCardHTML(r) {
  return `
  <div class="rec-card ${r.urgency}">
    <div class="rec-icon">${r.product_name.slice(0, 2)}</div>
    <div class="rec-body">
      <div class="rec-title">${r.product_name} • ไซซ์ ${r.size} <span class="mono">(${r.sku})</span></div>
      <div class="rec-reason">คงเหลือ ${fmt(r.current_stock)} ชิ้น • ขายเฉลี่ย ${r.avg_daily_sales} ชิ้น/วัน • รอสินค้าจาก ${r.supplier_name} ${r.lead_time} วัน</div>
      <div class="rec-formula">
        <span class="chip">ขายเฉลี่ย ${r.avg_daily_sales}×${r.lead_time}วัน</span><span class="op">+</span>
        <span class="chip">Safety ${r.safety_stock}</span><span class="op">−</span>
        <span class="chip">คงเหลือ ${r.current_stock}</span><span class="op">=</span>
        <span class="chip result">แนะนำสั่ง ${r.recommended_qty}</span>
      </div>
    </div>
    <div class="rec-action">
      <div class="qty-pill">${r.recommended_qty}<span class="u">ชิ้น</span></div>
      <button class="btn small block" onclick="quickCreatePO(${r.product_id}, ${r.recommended_qty}, ${r.supplier_id || 'null'})">สร้างใบสั่งซื้อ</button>
    </div>
  </div>`;
}
function deadCardHTML(d) {
  return `
  <div class="rec-card">
    <div class="rec-icon">${d.product_name.slice(0, 2)}</div>
    <div class="rec-body">
      <div class="rec-title">${d.product_name} • ไซซ์ ${d.size}</div>
      <div class="rec-reason">ไม่มีการขายมาแล้ว ${d.days_since_last_sale} วัน • คงเหลือ ${fmt(d.current_stock)} ชิ้น • มูลค่าจม ${fmtBaht(d.value_at_risk)}</div>
    </div>
    <div class="rec-action"><span class="tag ${d.cls}">${d.level}</span></div>
  </div>`;
}
async function loadDashboard() {
  try {
    const d = await api('/dashboard');
    document.getElementById('kpiRow').innerHTML = `
      <div class="kpi"><div class="kpi-label">สินค้าทั้งหมด</div><div class="kpi-value">${fmt(d.total_products)}</div></div>
      <div class="kpi danger"><div class="kpi-label">สินค้าหมด</div><div class="kpi-value">${fmt(d.out_of_stock)}</div></div>
      <div class="kpi warn"><div class="kpi-label">ต้องสั่งด่วน</div><div class="kpi-value">${fmt(d.urgent_reorder)}</div></div>
      <div class="kpi"><div class="kpi-label">มูลค่าสต็อกรวม</div><div class="kpi-value">${fmtBaht(d.stock_value)}</div></div>
      <div class="kpi"><div class="kpi-label">ยอดขาย 30 วัน</div><div class="kpi-value">${fmtBaht(d.sales_last_30_days)}</div></div>
      <div class="kpi warn"><div class="kpi-label">มูลค่าสต็อกค้าง</div><div class="kpi-value">${fmtBaht(d.dead_stock_value)}</div></div>`;
    document.getElementById('dashRecs').innerHTML = d.top_recommendations.length
      ? d.top_recommendations.map(recCardHTML).join('') : `<div class="empty">ไม่มีคำแนะนำสั่งซื้อในขณะนี้</div>`;
    document.getElementById('dashDead').innerHTML = d.critical_dead_stock.length
      ? d.critical_dead_stock.map(deadCardHTML).join('') : `<div class="empty">ไม่มีสินค้าค้างสต็อกระดับวิกฤต</div>`;
  } catch (e) { toast(e.message, 'error'); }
}

/* ============ PRODUCTS ============ */
let productsCache = [];
let suppliersCache = [];
async function ensureSuppliersLoaded() {
  if (!suppliersCache.length) suppliersCache = await api('/suppliers');
  return suppliersCache;
}
function statusTag(p) {
  if (p.current_stock === 0) return `<span class="tag crit">หมด</span>`;
  if (p.current_stock <= p.reorder_point) return `<span class="tag warn">ใกล้หมด</span>`;
  return `<span class="tag ok">ปกติ</span>`;
}
async function loadProducts() {
  try {
    const q = document.getElementById('searchInput').value.trim();
    const category = document.getElementById('categoryFilter').value;
    const status = document.getElementById('statusFilter').value;
    const params = new URLSearchParams();
    if (q) params.set('q', q); if (category) params.set('category', category); if (status) params.set('status', status);
    productsCache = await api('/products?' + params.toString());

    const catSel = document.getElementById('categoryFilter');
    if (!catSel.dataset.filled) {
      const cats = [...new Set(productsCache.map(p => p.category))];
      catSel.innerHTML = `<option value="">ทุกหมวดหมู่</option>` + cats.map(c => `<option value="${c}">${c}</option>`).join('');
      catSel.dataset.filled = '1';
    }
    document.getElementById('productsCount').textContent = `${productsCache.length} รายการ`;
    document.getElementById('productsTableWrap').innerHTML = productsCache.length ? `
      <table><thead><tr><th>SKU</th><th>สินค้า</th><th>ไซซ์</th><th>คงเหลือ</th><th>ROP</th><th>สถานะ</th><th></th></tr></thead>
      <tbody>${productsCache.map(p => `
        <tr>
          <td class="mono">${p.sku}</td>
          <td style="text-align:right;cursor:pointer;color:var(--navy);font-weight:500" onclick="openProductDetail(${p.product_id})">${p.product_name}</td>
          <td>${p.size}</td><td>${fmt(p.current_stock)}</td><td>${fmt(p.reorder_point)}</td><td>${statusTag(p)}</td>
          <td><div class="actions-cell">
            <button class="icon-btn" onclick="openProductForm(${p.product_id})">แก้ไข</button>
            <button class="icon-btn danger" onclick="deleteProduct(${p.product_id})">ลบ</button>
          </div></td>
        </tr>`).join('')}</tbody></table>`
      : `<div class="empty">ไม่พบสินค้าที่ค้นหา</div>`;
  } catch (e) { toast(e.message, 'error'); }
}
document.getElementById('searchInput').addEventListener('input', debounce(loadProducts, 300));
document.getElementById('categoryFilter').addEventListener('change', loadProducts);
document.getElementById('statusFilter').addEventListener('change', loadProducts);
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

async function openProductDetail(id) {
  showView('productdetail');
  document.getElementById('productDetailBody').innerHTML = `<div class="skeleton" style="height:200px"></div>`;
  try {
    const p = await api('/products/' + id);
    document.getElementById('productDetailBody').innerHTML = `
      <div class="topbar"><div><h1>${p.product_name}</h1><div class="sub mono">${p.sku} • ไซซ์ ${p.size}</div></div></div>
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">คงเหลือ</div><div class="kpi-value">${fmt(p.current_stock)}</div></div>
        <div class="kpi"><div class="kpi-label">ราคาทุน</div><div class="kpi-value">${fmtBaht(p.cost_price)}</div></div>
        <div class="kpi"><div class="kpi-label">ราคาขาย</div><div class="kpi-value">${fmtBaht(p.selling_price)}</div></div>
        <div class="kpi"><div class="kpi-label">Reorder Point</div><div class="kpi-value">${fmt(p.reorder_point)}</div></div>
      </div>
      <div class="note">Supplier: ${p.supplier_name || 'ยังไม่ระบุ'}</div>
      <h2 style="font-size:14px;margin:20px 0 10px;color:var(--navy);">ประวัติการเคลื่อนไหวสต็อก</h2>
      ${p.history.length ? `<table><thead><tr><th>วันที่</th><th>ประเภท</th><th>จำนวน</th><th>อ้างอิง</th><th>หมายเหตุ</th></tr></thead>
        <tbody>${p.history.map(h => `<tr><td>${h.created_at}</td><td>${txnLabel(h.transaction_type)}</td>
          <td style="color:${h.quantity < 0 ? 'var(--red)' : 'var(--green)'}">${h.quantity > 0 ? '+' : ''}${h.quantity}</td>
          <td class="mono">${h.reference || '-'}</td><td>${h.note || '-'}</td></tr>`).join('')}</tbody></table>`
        : `<div class="empty">ยังไม่มีประวัติการเคลื่อนไหว</div>`}`;
  } catch (e) { toast(e.message, 'error'); }
}
function txnLabel(t) {
  return { receive: 'รับเข้า', sale: 'ขายออก', adjust: 'ปรับยอด', po_receive: 'รับตาม PO' }[t] || t;
}

async function openProductForm(id) {
  await ensureSuppliersLoaded();
  const p = id ? productsCache.find(x => x.product_id === id) || await api('/products/' + id) : null;
  const supOptions = suppliersCache.map(s => `<option value="${s.supplier_id}" ${p && p.supplier_id === s.supplier_id ? 'selected' : ''}>${s.supplier_name}</option>`).join('');
  openModal(`
    <h3>${id ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h3>
    <form id="productForm">
      <div class="field-row">
        <div class="field"><label>รหัส SKU *</label><input id="f_sku" value="${p ? p.sku : ''}" required></div>
        <div class="field"><label>หมวดหมู่ *</label><input id="f_category" value="${p ? p.category : ''}" required></div>
      </div>
      <div class="field"><label>ชื่อสินค้า *</label><input id="f_name" value="${p ? p.product_name : ''}" required></div>
      <div class="field-row">
        <div class="field"><label>ไซซ์ *</label><input id="f_size" value="${p ? p.size : ''}" required></div>
        <div class="field"><label>สี</label><input id="f_color" value="${p ? p.color : ''}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>ราคาทุน</label><input type="number" step="0.01" id="f_cost" value="${p ? p.cost_price : 0}"></div>
        <div class="field"><label>ราคาขาย</label><input type="number" step="0.01" id="f_sell" value="${p ? p.selling_price : 0}"></div>
      </div>
      ${!id ? `<div class="field"><label>สต็อกตั้งต้น</label><input type="number" id="f_initstock" value="0" min="0"></div>` : ''}
      <div class="field"><label>Supplier</label><select id="f_supplier"><option value="">ไม่ระบุ</option>${supOptions}</select></div>
      <div class="modal-actions">
        <button type="button" class="btn ghost" onclick="closeModal()">ยกเลิก</button>
        <button type="submit" class="btn">${id ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}</button>
      </div>
    </form>`);
  document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      sku: val('f_sku'), category: val('f_category'), product_name: val('f_name'), size: val('f_size'),
      color: val('f_color'), cost_price: val('f_cost'), selling_price: val('f_sell'),
      supplier_id: val('f_supplier') || null,
    };
    if (!id) body.initial_stock = val('f_initstock');
    try {
      await api(id ? '/products/' + id : '/products', { method: id ? 'PUT' : 'POST', body });
      toast(id ? 'บันทึกการแก้ไขเรียบร้อย' : 'เพิ่มสินค้าเรียบร้อย', 'success');
      closeModal(); loadProducts();
    } catch (err) { toast(err.message, 'error'); }
  });
}
function val(id) { return document.getElementById(id).value; }
document.getElementById('addProductBtn').addEventListener('click', () => openProductForm(null));
async function deleteProduct(id) {
  if (!confirm('ยืนยันการลบสินค้านี้? ประวัติการขายจะยังถูกเก็บไว้ในระบบ')) return;
  try { await api('/products/' + id, { method: 'DELETE' }); toast('ลบสินค้าเรียบร้อย', 'success'); loadProducts(); }
  catch (e) { toast(e.message, 'error'); }
}

/* ============ RECEIVING ============ */
async function loadReceivingForm() {
  const products = await api('/products');
  const sel = document.getElementById('rcvProduct');
  sel.innerHTML = products.map(p => `<option value="${p.product_id}">${p.product_name} (${p.sku}) — คงเหลือ ${p.current_stock}</option>`).join('');
}
document.getElementById('receiveForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/stock/receive', {
      method: 'POST',
      body: { product_id: val('rcvProduct'), quantity: val('rcvQty'), reference: val('rcvRef'), note: val('rcvNote') },
    });
    toast('บันทึกการรับสินค้าเรียบร้อย', 'success');
    document.getElementById('receiveForm').reset();
    loadReceivingForm();
  } catch (err) { toast(err.message, 'error'); }
});

/* ============ SALES ============ */
async function loadSalesView() {
  const products = await api('/products');
  const sel = document.getElementById('saleProduct');
  sel.innerHTML = products.map(p => `<option value="${p.product_id}" data-stock="${p.current_stock}" data-price="${p.selling_price}">${p.product_name} (${p.sku})</option>`).join('');
  updateSaleStockLabel();
  const sales = await api('/sales');
  document.getElementById('salesTableWrap').innerHTML = sales.length ? `
    <table><thead><tr><th>วันที่</th><th>สินค้า</th><th>จำนวน</th><th>ราคาขาย</th><th>รวม</th></tr></thead>
    <tbody>${sales.slice(0, 20).map(s => `<tr><td>${s.sold_at}</td><td style="text-align:right">${s.product_name}</td>
      <td>${s.quantity}</td><td>${fmtBaht(s.selling_price)}</td><td>${fmtBaht(s.quantity * s.selling_price)}</td></tr>`).join('')}</tbody></table>`
    : `<div class="empty">ยังไม่มีรายการขาย</div>`;
}
function updateSaleStockLabel() {
  const opt = document.getElementById('saleProduct').selectedOptions[0];
  if (!opt) return;
  document.getElementById('saleStockLabel').textContent = `คงเหลือ: ${opt.dataset.stock} ชิ้น`;
  document.getElementById('salePrice').value = opt.dataset.price;
}
document.getElementById('saleProduct').addEventListener('change', updateSaleStockLabel);
document.getElementById('saleForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/sales', { method: 'POST', body: { product_id: val('saleProduct'), quantity: val('saleQty'), selling_price: val('salePrice') } });
    toast('บันทึกการขายเรียบร้อย', 'success');
    document.getElementById('saleQty').value = '';
    loadSalesView();
  } catch (err) { toast(err.message, 'error'); }
});

/* ============ AI PURCHASE RECOMMENDATIONS ============ */
async function loadPurchaseView() {
  try {
    const recs = await api('/ai/recommendations');
    document.getElementById('purchaseList').innerHTML = recs.length ? recs.map(recCardHTML).join('') : `<div class="empty">ไม่มีคำแนะนำสั่งซื้อในขณะนี้ — สต็อกทุกรายการอยู่ในระดับปลอดภัย</div>`;
  } catch (e) { toast(e.message, 'error'); }
}
async function quickCreatePO(productId, qty, supplierId) {
  if (!supplierId) { toast('สินค้านี้ยังไม่ได้ระบุ Supplier กรุณาระบุก่อนสร้างใบสั่งซื้อ', 'error'); return; }
  try {
    await api('/purchase-orders', { method: 'POST', body: { supplier_id: supplierId, items: [{ product_id: productId, quantity: qty }] } });
    toast('สร้างใบสั่งซื้อ (ฉบับร่าง) เรียบร้อย', 'success');
    showView('purchaseorders');
  } catch (e) { toast(e.message, 'error'); }
}

/* ============ PURCHASE ORDERS ============ */
const PO_STATUS_LABEL = { draft: 'ฉบับร่าง', ordered: 'สั่งซื้อแล้ว', received: 'รับสินค้าแล้ว', cancelled: 'ยกเลิก' };
const PO_STATUS_CLS = { draft: 'watch', ordered: 'warn', received: 'ok', cancelled: 'crit' };
async function loadPurchaseOrders() {
  try {
    const orders = await api('/purchase-orders');
    document.getElementById('poListWrap').innerHTML = orders.length ? orders.map(o => `
      <div class="rec-card" style="align-items:flex-start;">
        <div class="rec-body">
          <div class="rec-title">ใบสั่งซื้อ #${o.purchase_order_id} • ${o.supplier_name}</div>
          <div class="rec-reason">สร้างเมื่อ ${o.created_at} • ${o.items.length} รายการ • รวม ${fmtBaht(o.total)}</div>
          <div style="font-size:12px;color:var(--ink-2)">${o.items.map(it => `${it.product_name} × ${it.quantity}`).join(', ')}</div>
        </div>
        <div class="rec-action">
          <span class="tag ${PO_STATUS_CLS[o.status]}">${PO_STATUS_LABEL[o.status]}</span>
          <div style="margin-top:8px; display:flex; flex-direction:column; gap:6px;">
            ${o.status === 'draft' ? `<button class="btn small" onclick="changePOStatus(${o.purchase_order_id},'ordered')">ยืนยันสั่งซื้อ</button>` : ''}
            ${o.status === 'ordered' ? `<button class="btn small" onclick="changePOStatus(${o.purchase_order_id},'received')">รับสินค้าเข้าสต็อก</button>` : ''}
            ${['draft', 'ordered'].includes(o.status) ? `<button class="btn small ghost" onclick="changePOStatus(${o.purchase_order_id},'cancelled')">ยกเลิก</button>` : ''}
          </div>
        </div>
      </div>`).join('') : `<div class="empty">ยังไม่มีใบสั่งซื้อ</div>`;
  } catch (e) { toast(e.message, 'error'); }
}
async function changePOStatus(id, status) {
  if (status === 'cancelled' && !confirm('ยืนยันยกเลิกใบสั่งซื้อนี้?')) return;
  if (status === 'received' && !confirm('ยืนยันรับสินค้า? ระบบจะเพิ่มจำนวนสต็อกให้อัตโนมัติ')) return;
  try { await api(`/purchase-orders/${id}/status`, { method: 'PUT', body: { status } }); toast('อัปเดตสถานะเรียบร้อย', 'success'); loadPurchaseOrders(); }
  catch (e) { toast(e.message, 'error'); }
}
async function openPOForm() {
  const [products, suppliers] = await Promise.all([api('/products'), ensureSuppliersLoaded()]);
  if (!suppliers.length) { toast('กรุณาเพิ่ม Supplier ก่อนสร้างใบสั่งซื้อ', 'error'); return; }
  openModal(`
    <h3>สร้างใบสั่งซื้อ</h3>
    <form id="poForm">
      <div class="field"><label>Supplier *</label><select id="po_supplier" required>${suppliers.map(s => `<option value="${s.supplier_id}">${s.supplier_name}</option>`).join('')}</select></div>
      <label style="font-size:12px;color:var(--ink-2);font-weight:500;">รายการสินค้า</label>
      <div id="poItems"></div>
      <button type="button" class="btn ghost small" id="addPOItemBtn" style="margin-top:6px;">+ เพิ่มรายการ</button>
      <div class="modal-actions">
        <button type="button" class="btn ghost" onclick="closeModal()">ยกเลิก</button>
        <button type="submit" class="btn">สร้างใบสั่งซื้อ</button>
      </div>
    </form>`);
  const itemsWrap = document.getElementById('poItems');
  function addRow() {
    const row = document.createElement('div');
    row.className = 'po-item-row';
    row.innerHTML = `
      <select class="po-product">${products.map(p => `<option value="${p.product_id}">${p.product_name} (${p.sku})</option>`).join('')}</select>
      <input type="number" class="po-qty" min="1" value="1" placeholder="จำนวน">
      <button type="button" class="icon-btn danger" onclick="this.parentElement.remove()">✕</button>`;
    itemsWrap.appendChild(row);
  }
  addRow();
  document.getElementById('addPOItemBtn').addEventListener('click', addRow);
  document.getElementById('poForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const items = [...itemsWrap.querySelectorAll('.po-item-row')].map(r => ({
      product_id: r.querySelector('.po-product').value, quantity: r.querySelector('.po-qty').value,
    }));
    try {
      await api('/purchase-orders', { method: 'POST', body: { supplier_id: val('po_supplier'), items } });
      toast('สร้างใบสั่งซื้อเรียบร้อย', 'success'); closeModal(); loadPurchaseOrders();
    } catch (err) { toast(err.message, 'error'); }
  });
}
document.getElementById('addPOBtn').addEventListener('click', openPOForm);

/* ============ SUPPLIERS ============ */
async function loadSuppliers() {
  try {
    suppliersCache = await api('/suppliers');
    document.getElementById('suppliersTableWrap').innerHTML = suppliersCache.length ? `
      <table><thead><tr><th>ชื่อ Supplier</th><th>Lead Time</th><th>ติดต่อ</th><th>สินค้า</th><th>ใบสั่งซื้อ</th><th></th></tr></thead>
      <tbody>${suppliersCache.map(s => `<tr>
        <td style="text-align:right;font-weight:500">${s.supplier_name}</td><td>${s.lead_time} วัน</td>
        <td>${s.contact || '-'}</td><td>${s.product_count}</td><td>${s.po_count}</td>
        <td><div class="actions-cell">
          <button class="icon-btn" onclick="openSupplierForm(${s.supplier_id})">แก้ไข</button>
          <button class="icon-btn danger" onclick="deleteSupplier(${s.supplier_id})">ลบ</button>
        </div></td></tr>`).join('')}</tbody></table>`
      : `<div class="empty">ยังไม่มี Supplier — เพิ่ม Supplier ก่อนเพื่อผูกกับสินค้า</div>`;
  } catch (e) { toast(e.message, 'error'); }
}
function openSupplierForm(id) {
  const s = id ? suppliersCache.find(x => x.supplier_id === id) : null;
  openModal(`
    <h3>${id ? 'แก้ไข Supplier' : 'เพิ่ม Supplier'}</h3>
    <form id="supplierForm">
      <div class="field"><label>ชื่อ Supplier *</label><input id="s_name" value="${s ? s.supplier_name : ''}" required></div>
      <div class="field"><label>Lead Time (วัน) *</label><input type="number" id="s_lead" min="1" value="${s ? s.lead_time : 7}" required></div>
      <div class="field"><label>ช่องทางติดต่อ</label><input id="s_contact" value="${s ? s.contact || '' : ''}"></div>
      <div class="modal-actions"><button type="button" class="btn ghost" onclick="closeModal()">ยกเลิก</button>
        <button type="submit" class="btn">${id ? 'บันทึก' : 'เพิ่ม Supplier'}</button></div>
    </form>`);
  document.getElementById('supplierForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api(id ? '/suppliers/' + id : '/suppliers', { method: id ? 'PUT' : 'POST', body: { supplier_name: val('s_name'), lead_time: val('s_lead'), contact: val('s_contact') } });
      toast('บันทึกเรียบร้อย', 'success'); closeModal(); loadSuppliers();
    } catch (err) { toast(err.message, 'error'); }
  });
}
document.getElementById('addSupplierBtn').addEventListener('click', () => openSupplierForm(null));
async function deleteSupplier(id) {
  if (!confirm('ยืนยันการลบ Supplier นี้?')) return;
  try { await api('/suppliers/' + id, { method: 'DELETE' }); toast('ลบเรียบร้อย', 'success'); loadSuppliers(); }
  catch (e) { toast(e.message, 'error'); }
}

/* ============ DEAD STOCK ============ */
async function loadDeadStock() {
  try {
    const list = await api('/ai/deadstock');
    document.getElementById('deadstockTableWrap').innerHTML = list.length ? `
      <table><thead><tr><th>สินค้า</th><th>คงเหลือ</th><th>ขายล่าสุด</th><th>ไม่ขาย (วัน)</th><th>มูลค่าจม</th><th>ระดับ</th></tr></thead>
      <tbody>${list.map(d => `<tr><td style="text-align:right">${d.product_name} (${d.size})</td><td>${fmt(d.current_stock)}</td>
        <td>${d.last_sale_at || 'ไม่เคยขาย'}</td><td>${d.days_since_last_sale}</td><td>${fmtBaht(d.value_at_risk)}</td>
        <td><span class="tag ${d.cls}">${d.level}</span></td></tr>`).join('')}</tbody></table>`
      : `<div class="empty">ไม่มีสินค้าค้างสต็อก</div>`;
  } catch (e) { toast(e.message, 'error'); }
}

/* ============ INIT ============ */
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await api('/auth/logout', { method: 'POST' });
  window.location.href = '/login.html';
});
(async function init() {
  try {
    const me = await api('/me');
    document.getElementById('whoami').textContent = `${me.username} (${me.role === 'admin' ? 'เจ้าของร้าน' : 'พนักงาน'})`;
    loadDashboard();
  } catch (e) { /* redirected to login already */ }
})();
