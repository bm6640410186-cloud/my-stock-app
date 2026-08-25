let globalProducts = [];

// ฟังก์ชันเรียก API สำหรับเชื่อมต่อ Backend
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

  // ผูก Event ปรับเปลี่ยนฟิลด์ตามหมวดหมู่ใน Form สินค้า
  const categorySelect = document.getElementById('pCategory');
  if (categorySelect) {
    categorySelect.addEventListener('change', toggleCategoryFields);
  }

  // ผูก Event การกด Submit ฟอร์มเพิ่มสินค้า
  const productForm = document.getElementById('productForm');
  if (productForm) {
    productForm.addEventListener('submit', handleProductSubmit);
  }

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
// 1. หน้าสินค้าและสต็อก (Products & Stock)
// ----------------------------------------------------
async function loadProducts() {
  const tableWrap = document.getElementById('productsTableWrap');
  if (!tableWrap) return;

  tableWrap.innerHTML = '<p style="color:#666; margin-top:15px;">กำลังโหลดรายการสินค้า...</p>';

  const products = await api('/products');
  if (products && Array.isArray(products)) {
    globalProducts = products;
  }

  if (!globalProducts || globalProducts.length === 0) {
    tableWrap.innerHTML = '<div style="background:#fff; padding:20px; border-radius:8px; margin-top:15px; text-align:center; color:#888;">ยังไม่มีข้อมูลสินค้าในระบบ</div>';
    return;
  }

  tableWrap.innerHTML = `
    <div style="background:#fff; padding:20px; border-radius:8px; margin-top:15px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:2px solid #eee; text-align:left; color:#555;">
            <th style="padding:10px;">หมวดหมู่</th>
            <th>ชื่อ / รายละเอียดสินค้า</th>
            <th>ไซส์ / ขนาด</th>
            <th>คงเหลือ (ชิ้น)</th>
            <th>ราคาทุน (฿)</th>
            <th>ราคาขาย (฿)</th>
          </tr>
        </thead>
        <tbody>
          ${globalProducts.map(p => {
            const stock = Number(p.current_stock || p.stock || 0);
            const cost = Number(p.cost_price || p.cost || 0);
            const price = Number(p.selling_price || p.price || 0);
            const name = p.product_name || p.name || `${p.category || ''} ${p.skirt_style || p.shirt_gender || ''}`;
            const size = p.size || p.waist || p.shirt_size || '-';

            return `
              <tr style="border-bottom:1px solid #f9f9f9;">
                <td style="padding:10px;">${p.category || '-'}</td>
                <td><strong>${name}</strong></td>
                <td>${size}</td>
                <td><span style="color:${stock > 10 ? '#28a745' : '#dc3545'}; font-weight:bold;">${stock}</span></td>
                <td>${cost.toLocaleString()}</td>
                <td><strong>${price.toLocaleString()}</strong></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ----------------------------------------------------
// 2. หน้าสินค้าค้างสต็อก (Deadstock Analytics)
// ----------------------------------------------------
async function loadDeadstock() {
  const target = document.getElementById('view-deadstock');
  if (!target) return;

  target.innerHTML = `
    <h2>⚠️ สินค้าค้างสต็อก (Deadstock Analytics)</h2>
    <p style="color:#666;">กำลังโหลดข้อมูล...</p>
  `;

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
              const cost = Number(p.cost_price || p.cost || 0);
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

// ----------------------------------------------------
// 3. หน้าแดชบอร์ด (Dashboard)
// ----------------------------------------------------
async function loadDashboard() {
  const target = document.getElementById('view-dashboard');
  if (!target) return;

  const products = await api('/products');
  if (products && Array.isArray(products)) {
    globalProducts = products;
  }

  const totalItems = globalProducts.reduce((sum, p) => sum + Number(p.current_stock || p.stock || 0), 0);
  const totalValue = globalProducts.reduce((sum, p) => sum + (Number(p.current_stock || p.stock || 0) * Number(p.cost_price || p.cost || 0)), 0);

  target.innerHTML = `
    <h2>📊 แดชบอร์ดภาพรวม</h2>
    <p style="color:#666; margin-bottom:20px;">ยินดีต้อนรับสู่ระบบจัดการสต็อกชุดนักศึกษา</p>

    <div style="display:flex; gap:20px; margin-bottom:25px;">
      <div style="flex:1; background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-left:5px solid #d9822b;">
        <span style="color:#888; font-size:14px;">รายการสินค้าทั้งหมด</span>
        <h2 style="margin:10px 0 0 0; color:#333;">${globalProducts.length} <span style="font-size:16px; font-weight:normal;">รายการ</span></h2>
      </div>
      <div style="flex:1; background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-left:5px solid #28a745;">
        <span style="color:#888; font-size:14px;">จำนวนสินค้าคงเหลือรวม</span>
        <h2 style="margin:10px 0 0 0; color:#333;">${totalItems.toLocaleString()} <span style="font-size:16px; font-weight:normal;">ชิ้น</span></h2>
      </div>
      <div style="flex:1; background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-left:5px solid #17a2b8;">
        <span style="color:#888; font-size:14px;">มูลค่าสินค้าในสต็อกรวม</span>
        <h2 style="margin:10px 0 0 0; color:#333;">${totalValue.toLocaleString()} <span style="font-size:16px; font-weight:normal;">บาท</span></h2>
      </div>
    </div>
  `;
}

// ----------------------------------------------------
// ระบบจัดการ Modal และ Form เพิ่มสินค้า
// ----------------------------------------------------
function openProductForm() {
  const modal = document.getElementById('productModal');
  if (modal) {
    modal.style.display = 'flex';
    toggleCategoryFields();
  }
}

function closeProductForm() {
  const modal = document.getElementById('productModal');
  if (modal) modal.style.display = 'none';
}

function toggleCategoryFields() {
  const cat = document.getElementById('pCategory').value;
  const skirt = document.getElementById('skirtFields');
  const shirt = document.getElementById('shirtFields');
  const gName = document.getElementById('generalNameField');
  const gSize = document.getElementById('generalSizeField');

  if (cat === 'กระโปรงนักศึกษา') {
    if (skirt) skirt.style.display = 'block';
    if (shirt) shirt.style.display = 'none';
    if (gName) gName.style.display = 'none';
    if (gSize) gSize.style.display = 'none';
  } else if (cat === 'เสื้อนักศึกษา') {
    if (skirt) skirt.style.display = 'none';
    if (shirt) shirt.style.display = 'block';
    if (gName) gName.style.display = 'none';
    if (gSize) gSize.style.display = 'none';
  } else {
    if (skirt) skirt.style.display = 'none';
    if (shirt) shirt.style.display = 'none';
    if (gName) gName.style.display = 'block';
    if (gSize) gSize.style.display = 'block';
  }
}

async function handleProductSubmit(e) {
  e.preventDefault();
  const cat = document.getElementById('pCategory').value;
  let payload = {
    category: cat,
    current_stock: Number(document.getElementById('pStock').value),
    cost_price: Number(document.getElementById('pCost').value),
    selling_price: Number(document.getElementById('pPrice').value)
  };

  if (cat === 'กระโปรงนักศึกษา') {
    payload.skirt_style = document.getElementById('pSkirtStyle').value;
    payload.waist = document.getElementById('pWaist').value;
    payload.length = document.getElementById('pLength').value;
    payload.product_name = `กระโปรง ${payload.skirt_style}`;
  } else if (cat === 'เสื้อนักศึกษา') {
    payload.shirt_gender = document.getElementById('pShirtGender').value;
    payload.shirt_sleeve = document.getElementById('pShirtSleeve').value;
    payload.shirt_color = document.getElementById('pShirtColor').value;
    payload.shirt_size = document.getElementById('pShirtSize').value;
    payload.product_name = `${payload.shirt_gender} ${payload.shirt_sleeve} (${payload.shirt_color})`;
  } else {
    payload.product_name = document.getElementById('pName').value;
    payload.size = document.getElementById('pSize').value;
  }

  const res = await api('/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res) {
    alert('บันทึกสินค้าเรียบร้อยแล้ว!');
    closeProductForm();
    loadProducts();
  } else {
    alert('บันทึกสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
  }
}
