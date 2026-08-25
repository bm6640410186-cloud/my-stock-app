// สลับหน้าจอ (View Navigation)
function switchView(viewName) {
  // ซ่อนทุก view
  document.querySelectorAll('.view').forEach(el => {
    el.style.display = 'none';
    el.classList.remove('active');
  });

  // แสดง view ที่เลือก
  const target = document.getElementById(`view-${viewName}`);
  if (target) {
    target.style.display = 'block';
    target.classList.add('active');
  }

  // อัปเดตสถานะ Active บน Sidebar
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.remove('active');
  });
  
  const activeNav = document.querySelector(`.nav-item[data-view="${viewName}"]`);
  if (activeNav) {
    activeNav.classList.add('active');
  }

  // โหลดข้อมูลเฉพาะหน้า
  if (viewName === 'dashboard') loadDashboard();
  if (viewName === 'products') loadProducts();
}

// เรียก API
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
    aiWrap.innerHTML = forecast && forecast.length > 0 
      ? forecast.map(i => `<p>• <strong>${i.product_name}</strong> แนะนำสั่งเพิ่ม ${i.recommended_order_qty} ชิ้น</p>`).join('')
      : '<p style="color:var(--ink-3);">ไม่มีรายการเตือนสั่งซื้อเร่งด่วน</p>';
  }

  const dsWrap = document.getElementById('deadstockWrap');
  if (dsWrap) {
    dsWrap.innerHTML = deadstock && deadstock.length > 0 
      ? deadstock.map(i => `<p>• <strong>${i.product_name}</strong> สินค้าค้างสต็อก ${i.current_stock} ชิ้น</p>`).join('')
      : '<p style="color:var(--ink-3);">สต็อกอยู่ในเกณฑ์ปกติ</p>';
  }
}

// โหลดรายการสินค้า
async function loadProducts() {
  const products = await api('/products');
  const wrap = document.getElementById('productsTableWrap');
  if (!wrap) return;

  if (products && products.length > 0) {
    wrap.innerHTML = `
      <table style="width:100%; border-collapse:collapse; margin-top:15px; background:#fff; border-radius:8px; padding:15px;">
        <thead>
          <tr style="border-bottom:2px solid var(--paper); text-align:left; color:var(--ink-2);">
            <th style="padding:10px;">ชื่อสินค้า</th>
            <th>หมวดหมู่</th>
            <th>ไซส์</th>
            <th>คงเหลือ</th>
            <th>ราคาทุน</th>
            <th>ราคาขาย</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p => `
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:10px;">${p.product_name}</td>
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
    wrap.innerHTML = '<p style="color:var(--ink-3); margin-top:15px;">ยังไม่มีรายการสินค้า</p>';
  }
}

// ผูกระบบคลิกเมนูและปุ่มออกจากระบบ
document.addEventListener('DOMContentLoaded', () => {
  // คลิกเมนู Sidebar
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.getAttribute('data-view');
      if (view) switchView(view);
    });
  });

  // ปุ่มออกจากระบบ
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await api('/auth/logout', { method: 'POST' });
      window.location.href = '/login.html';
    });
  }

  // เริ่มต้นหน้า Dashboard
  switchView('dashboard');
});
