let globalProducts = [];

// ฟังก์ชันเรียก API
async function api(endpoint, options = {}) {
  try {
    const res = await fetch(endpoint, options);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('API Fetch Error:', err);
    return null;
  }
}

// ----------------------------------------------------
// ระบบจัดการการเปลี่ยนหน้า (Navigation Router)
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // ผูก Event ให้กับเมนู Sidebar ทุกตัว
  const navItems = document.querySelectorAll('.sidebar .nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const viewName = item.getAttribute('data-view');
      switchView(viewName);
    });
  });

  // โหลดหน้าแรก (Dashboard) เป็นค่าเริ่มต้น
  switchView('dashboard');
});

function switchView(viewName) {
  // 1. ไฮไลต์เมนู Sidebar
  document.querySelectorAll('.sidebar .nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('data-view') === viewName) {
      item.classList.add('active');
    }
  });

  // 2. ซ่อนทุกหน้า
  document.querySelectorAll('.main-content .view').forEach(view => {
    view.style.display = 'none';
  });

  // 3. แสดงหน้าที่เลือก
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) {
    targetView.style.display = 'block';
  }

  // 4. เรียกฟังก์ชันโหลดข้อมูลตามหน้า
  if (viewName === 'deadstock') {
    loadDeadstock();
  } else if (viewName === 'dashboard') {
    loadDashboard();
  } else if (viewName === 'products') {
    loadProducts();
  }
}

// ----------------------------------------------------
// โหลดหน้า สินค้าค้างสต็อก (Deadstock Analytics)
// ----------------------------------------------------
async function loadDeadstock() {
  const target = document.getElementById('view-deadstock');
  if (!target) return;

  // ขึ้นข้อความ Loading ระหว่างรอข้อมูล
  target.innerHTML = `
    <h2>⚠️ สินค้าค้างสต็อก (Deadstock Analytics)</h2>
    <p style="color:#666;">กำลังโหลดข้อมูล...</p>
  `;

  // ดึงข้อมูลสินค้าล่าสุดจาก Server
  const products = await api('/products');
  if (products && Array.isArray(products)) {
    globalProducts = products;
  }

  const deadstockThreshold = 50; // เกณฑ์สต็อกคงค้าง (>= 50 ชิ้น)
  const highStockItems = (globalProducts || []).filter(p => Number(p.current_stock || p.stock || 0) >= deadstockThreshold);

  target.innerHTML = `
    <h2>⚠️ สินค้าค้างสต็อก (Deadstock Analytics)</h2>
    <p style="color:#666; margin-bottom:20px;">ตรวจสอบรายการสินค้าที่คงค้างในระบบปริมาณมากและจมทุน</p>

    <div style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
      <h3 style="margin-top:0;">รายการสินค้าคงค้างเยอะ (สต็อก >= ${deadstockThreshold} ชิ้น)</h3>
      ${highStockItems.length > 0 ? `
        <table style="width:100%; border-collapse:collapse; margin-top:15px;">
          <thead>
            <tr style="border-bottom:2px solid #eee; text-align:left; color:#555;">
              <th style="padding:10px;">ชื่อสินค้า</th>
              <th>หมวดหมู่</th>
              <th>ไซส์ / รายละเอียด</th>
              <th>จำนวนค้างสต็อก</th>
              <th>มูลค่าเงินจมทุน (฿)</th>
            </tr>
          </thead>
          <tbody>
            ${highStockItems.map(p => {
              const stock = Number(p.current_stock || p.stock || 0);
              const cost = Number(p.cost_price || p.price || 0);
              const name = p.product_name || p.name || `${p.category || ''} ${p.skirt_style || p.shirt_gender || ''}`;
              const size = p.size || p.waist || p.shirt_size || '-';

              return `
                <tr style="border-bottom:1px solid #f9f9f9;">
                  <td style="padding:10px;"><strong>${name}</strong></td>
                  <td>${p.category || '-'}</td>
                  <td>${size}</td>
                  <td><strong style="color:#dc3545;">${stock} ชิ้น</strong></td>
                  <td><strong>${(stock * cost).toLocaleString()} ฿</strong></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      ` : `
        <div style="text-align:center; padding:30px; color:#888;">
          <p style="font-size:16px; margin:0;">ไม่พบรายการสินค้าค้างสต็อก (ที่มีสต็อกตั้งแต่ ${deadstockThreshold} ชิ้นขึ้นไป)</p>
        </div>
      `}
    </div>
  `;
}

// ฟังก์ชันจำลองสำหรับหน้าอื่นๆ (เพื่อไม่ให้เกิด Error เวลาสลับหน้า)
function loadDashboard() {
  const target = document.getElementById('view-dashboard');
  if (target) target.innerHTML = '<h2>📊 แดชบอร์ด</h2><p>ยินดีต้อนรับสู่ระบบจัดการสต็อก</p>';
}

function loadProducts() {
  // ใส่ฟังก์ชันโหลดตารางสินค้าของคุณที่นี่
}
