// สลับการแสดงผลหน้าต่างๆ (Views)
function switchView(viewName) {
  document.querySelectorAll('.view').forEach(el => el.style.display = 'none');
  const target = document.getElementById(`view-${viewName}`);
  if (target) target.style.display = 'block';

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const activeNav = document.querySelector(`.nav-item[data-view="${viewName}"]`);
  if (activeNav) activeNav.classList.add('active');

  // โหลดข้อมูลตามหน้าที่เลือก
  if (viewName === 'dashboard') loadDashboard();
  if (viewName === 'products') loadProducts();
  if (viewName === 'receive' || viewName === 'sales') loadProductOptions();
  if (viewName === 'forecast') loadForecast();
  if (viewName === 'po') loadPO();
  if (viewName === 'suppliers') loadSuppliers();
  if (viewName === 'deadstock') loadDeadStock();
}

// API Call Wrapper
async function api(url, options = {}) {
  try {
    const res = await fetch(`/api${url}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    if (res.status === 401) {
      window.location.href = '/login.html';
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('API Error:', err);
    return null;
  }
}

// โหลดข้อมูล Dashboard
async function loadDashboard() {
  const forecast = await api('/ai/reorder-recommendations');
  const deadstock = await api('/ai/deadstock');

  const aiWrap = document.getElementById('aiReorderWrap');
  if (aiWrap) {
    if (forecast && forecast.length > 0) {
      aiWrap.innerHTML = `<ul>${forecast.map(item => `<li><strong>${item.product_name}</strong> - แนะนำสั่งซื้อ ${item.recommended_order_qty} ชิ้น</li>`).join('')}</ul>`;
    } else {
      aiWrap.innerHTML = '<p style="color:#888;">ไม่มีรายการเตือนสั่งซื้อเร่งด่วน</p>';
    }
  }

  const dsWrap = document.getElementById('deadstockWrap');
  if (dsWrap) {
    if (deadstock && deadstock.length > 0) {
      dsWrap.innerHTML = `<ul>${deadstock.map(item => `<li><strong>${item.product_name}</strong> - ค้างสต็อก ${item.current_stock} ชิ้น</li>`).join('')}</ul>`;
    } else {
      dsWrap.innerHTML = '<p style="color:#888;">ไม่มีสินค้าระดับวิกฤต</p>';
    }
  }
}

// โหลดรายชื่อสินค้า
async function loadProducts() {
  const products = await api('/products');
  const wrap = document.getElementById('productsTableWrap');
  if (!wrap) return;

  if (products && products.length > 0) {
    wrap.innerHTML = `
      <table style="width:100%; border-collapse:collapse; margin-top:10px;">
        <thead>
          <tr style="border-bottom:2px solid #ccc; text-align:left;">
            <th>ชื่อสินค้า</th><th>หมวดหมู่</th><th>ไซส์</th><th>คงเหลือ</th><th>ราคาทุน</th><th>ราคาขาย</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p => `
            <tr style="border-bottom:1px solid #eee;">
              <td style="padding:8px 0;">${p.product_name}</td>
              <td>${p.category || '-'}</td>
              <td>${p.size || '-'}</td>
              <td>${p.current_stock}</td>
              <td>${p.cost_price} ฿</td>
              <td>${p.selling_price} ฿</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else {
    wrap.innerHTML = '<p style="color:#888; margin-top:10px;">ยังไม่มีรายการสินค้า</p>';
  }
}

// ตัวเลือกสินค้าสำหรับหน้า รับเข้า / ขาย
async function loadProductOptions() {
  const products = await api('/products');
  const options = products && products.length > 0
    ? products.map(p => `<option value="${p.id}">${p.product_name} (${p.size || 'F'}) - คงเหลือ ${p.current_stock}</option>`).join('')
    : '<option value="">ไม่มีสินค้าในระบบ</option>';

  const rSelect = document.getElementById('receiveProductSelect');
  const sSelect = document.getElementById('salesProductSelect');
  if (rSelect) rSelect.innerHTML = options;
  if (sSelect) sSelect.innerHTML = options;
}

// Modal Functions
function openProductForm() { document.getElementById('productModal').style.display = 'flex'; }
function openSupplierForm() { document.getElementById('supplierModal').style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // เมนูนำทาง Sidebar
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.getAttribute('data-view');
      if (view) switchView(view);
    });
  });

  // ปุ่ม Logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await api('/auth/logout', { method: 'POST' });
      window.location.href = '/login.html';
    });
  }

  // เริ่มต้นที่หน้า Dashboard
  switchView('dashboard');
});
}
