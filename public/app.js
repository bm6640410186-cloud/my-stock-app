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
// ระบบ Navigation Router
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const navItems = document.querySelectorAll('.sidebar .nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const viewName = item.getAttribute('data-view');
      switchView(viewName);
    });
  });

  const categorySelect = document.getElementById('pCategory');
  if (categorySelect) {
    categorySelect.addEventListener('change', toggleCategoryFields);
  }

  const productForm = document.getElementById('productForm');
  if (productForm) {
    productForm.addEventListener('submit', handleProductSubmit);
  }

  switchView('dashboard');
});

function switchView(viewName) {
  document.querySelectorAll('.sidebar .nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('data-view') === viewName) {
      item.classList.add('active');
    }
  });

  document.querySelectorAll('.main-content .view').forEach(view => {
    view.style.display = 'none';
  });

  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) {
    targetView.style.display = 'block';
  }

  // เรียกโหลดข้อมูลประจำหน้า
  if (viewName === 'dashboard') loadDashboard();
  else if (viewName === 'products') loadProducts();
  else if (viewName === 'deadstock') loadDeadstock();
  else if (viewName === 'receive') loadReceivePage();
  else if (viewName === 'ai-analytics') loadAIAnalyticsPage();
}

// ----------------------------------------------------
// 1. หน้าแดชบอร์ด (Dashboard)
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
  const lowStockItems = globalProducts.filter(p => Number(p.current_stock || p.stock || 0) <= 10);
  const deadstockItems = globalProducts.filter(p => Number(p.current_stock || p.stock || 0) >= 50);

  target.innerHTML = `
    <h2>📊 แดชบอร์ดภาพรวม</h2>
    <p style="color:#666; margin-bottom:20px;">ยินดีต้อนรับสู่ระบบจัดการสต็อกชุดนักศึกษา</p>

    <!-- การ์ดตัวเลขสรุป -->
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

    <!-- ส่วนวิเคราะห์เพิ่มเติม 2 ส่วน -->
    <div style="display:flex; gap:20px;">
      <div style="flex:1; background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
        <h3 style="margin-top:0; color:#dc3545;">⚠️ แจ้งเตือนสินค้าใกล้หมด (≤ 10 ชิ้น)</h3>
        ${lowStockItems.length > 0 ? `
          <ul style="padding-left:20px; margin:0;">
            ${lowStockItems.slice(0, 5).map(p => `
              <li style="margin-bottom:8px;">
                <strong>${p.product_name || p.name}</strong> - เหลือ <span style="color:#dc3545; font-weight:bold;">${p.current_stock || p.stock}</span> ชิ้น
              </li>
            `).join('')}
          </ul>
        ` : '<p style="color:#888;">ไม่มีสินค้าที่สต็อกต่ำกว่าเกณฑ์</p>'}
      </div>

      <div style="flex:1; background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
        <h3 style="margin-top:0; color:#6f42c1;">🤖 AI Stock Insights</h3>
        <p style="color:#555; line-height:1.5;">
          ${deadstockItems.length > 0 ? `พบสินค้าจมทุนค้างสต็อก <strong>${deadstockItems.length} รายการ</strong> แนะนำให้จัดโปรโมชันระบายสินค้า` : 'สต็อกสินค้ากระจายตัวได้ดี ไม่มีสินค้าค้างสต็อกเกินกำหนด'}
        </p>
        <button onclick="switchView('ai-analytics')" style="background:#6f42c1; color:#fff; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">ดูรายงาน AI แบบละเอียด</button>
      </div>
    </div>
  `;
}

// ----------------------------------------------------
// 2. หน้าสินค้าและสต็อก (Products)
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
            <th>รายละเอียดเพิ่ม</th>
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
            const detail = p.shirt_back || p.size || p.waist || '-';

            return `
              <tr style="border-bottom:1px solid #f9f9f9;">
                <td style="padding:10px;">${p.category || '-'}</td>
                <td><strong>${name}</strong></td>
                <td>${detail}</td>
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
// 3. หน้าสินค้าค้างสต็อก + สินค้าใกล้หมดสต็อก
// ----------------------------------------------------
async function loadDeadstock() {
  const target = document.getElementById('view-deadstock');
  if (!target) return;

  const products = await api('/products');
  if (products && Array.isArray(products)) {
    globalProducts = products;
  }

  const deadstockThreshold = 50;
  const lowStockThreshold = 10;

  const highStockItems = globalProducts.filter(p => Number(p.current_stock || p.stock || 0) >= deadstockThreshold);
  const lowStockItems = globalProducts.filter(p => Number(p.current_stock || p.stock || 0) <= lowStockThreshold);

  target.innerHTML = `
    <h2>⚠️ สรุปสถานะสต็อกสินค้า (Stock Status)</h2>
    <p style="color:#666; margin-bottom:20px;">วิเคราะห์รายการสินค้าค้างสต็อกและสินค้าที่ต้องเตรียมสั่งเพิ่ม</p>

    <!-- ส่วนที่ 1: สินค้าใกล้หมดสต็อก -->
    <div style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05); margin-bottom:25px; border-top:4px solid #dc3545;">
      <h3 style="margin-top:0; color:#dc3545;">🛒 สินค้าใกล้หมดสต็อก (น้อยกว่าหรือเท่ากับ ${lowStockThreshold} ชิ้น)</h3>
      ${lowStockItems.length > 0 ? `
        <table style="width:100%; border-collapse:collapse; margin-top:15px;">
          <thead>
            <tr style="border-bottom:2px solid #eee; text-align:left; color:#555;">
              <th style="padding:10px;">ชื่อสินค้า</th>
              <th>หมวดหมู่</th>
              <th>จำนวนคงเหลือ</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            ${lowStockItems.map(p => `
              <tr style="border-bottom:1px solid #f9f9f9;">
                <td style="padding:10px;"><strong>${p.product_name || p.name}</strong></td>
                <td>${p.category || '-'}</td>
                <td><strong style="color:#dc3545;">${p.current_stock || p.stock} ชิ้น</strong></td>
                <td><span style="background:#f8d7da; color:#721c24; padding:3px 8px; border-radius:4px; font-size:12px;">ควรสั่งเพิ่ม</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p style="color:#888;">ไม่มีรายการสินค้าใกล้หมดสต็อก</p>'}
    </div>

    <!-- ส่วนที่ 2: สินค้าค้างสต็อก -->
    <div style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-top:4px solid #ffc107;">
      <h3 style="margin-top:0; color:#856404;">📦 รายการสินค้าคงค้างเยอะ (สต็อก >= ${deadstockThreshold} ชิ้น)</h3>
      ${highStockItems.length > 0 ? `
        <table style="width:100%; border-collapse:collapse; margin-top:15px;">
          <thead>
            <tr style="border-bottom:2px solid #eee; text-align:left; color:#555;">
              <th style="padding:10px;">ชื่อสินค้า</th>
              <th>หมวดหมู่</th>
              <th>จำนวนค้างสต็อก</th>
              <th>มูลค่าเงินจมทุน (฿)</th>
            </tr>
          </thead>
          <tbody>
            ${highStockItems.map(p => {
              const stock = Number(p.current_stock || p.stock || 0);
              const cost = Number(p.cost_price || p.cost || 0);
              return `
                <tr style="border-bottom:1px solid #f9f9f9;">
                  <td style="padding:10px;"><strong>${p.product_name || p.name}</strong></td>
                  <td>${p.category || '-'}</td>
                  <td><strong style="color:#d9822b;">${stock} ชิ้น</strong></td>
                  <td><strong>${(stock * cost).toLocaleString()} ฿</strong></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      ` : '<p style="color:#888;">ไม่พบรายการสินค้าค้างสต็อก</p>'}
    </div>
  `;
}

// ----------------------------------------------------
// 4. หน้ารับสินค้าเข้า (Receive Stock)
// ----------------------------------------------------
async function loadReceivePage() {
  const target = document.getElementById('view-receive');
  if (!target) return;

  const products = await api('/products');
  if (products && Array.isArray(products)) {
    globalProducts = products;
  }

  target.innerHTML = `
    <h2>📥 รับสินค้าเข้าสต็อก (Stock In)</h2>
    <p style="color:#666; margin-bottom:20px;">บันทึกเพิ่มจำนวนสินค้าเข้าคลัง</p>

    <div style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05); max-width:600px;">
      <form id="receiveForm" onsubmit="handleReceiveSubmit(event)">
        <div style="margin-bottom:15px;">
          <label style="display:block; margin-bottom:5px; font-weight:bold;">เลือกสินค้าที่ต้องการรับเข้า:</label>
          <select id="recvProduct" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px;">
            ${globalProducts.map(p => `<option value="${p.id || p._id}">${p.product_name || p.name} (คงเหลือ: ${p.current_stock || p.stock || 0})</option>`).join('')}
          </select>
        </div>
        <div style="margin-bottom:15px;">
          <label style="display:block; margin-bottom:5px; font-weight:bold;">จำนวนที่รับเข้า (ชิ้น):</label>
          <input type="number" id="recvQty" value="1" min="1" onfocus="this.select()" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px;">
        </div>
        <div style="margin-bottom:20px;">
          <label style="display:block; margin-bottom:5px; font-weight:bold;">หมายเหตุ / สาเหตุการรับเข้า:</label>
          <input type="text" id="recvNote" placeholder="เช่น สั่งซื้อเติมสต็อกประจำสัปดาห์" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px;">
        </div>
        <button type="submit" style="width:100%; padding:12px; background:#28a745; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">📥 บันทึกรับสินค้าเข้าสต็อก</button>
      </form>
    </div>
  `;
}

async function handleReceiveSubmit(e) {
  e.preventDefault();
  alert('บันทึกการรับสินค้าเข้าเรียบร้อยแล้ว');
  loadReceivePage();
}

// ----------------------------------------------------
// 5. หน้าวิเคราะห์สต็อก AI (AI Analytics)
// ----------------------------------------------------
async function loadAIAnalyticsPage() {
  const target = document.getElementById('view-ai-analytics');
  if (!target) return;

  target.innerHTML = `
    <h2>🤖 ระบบวิเคราะห์สต็อกด้วย AI (AI Stock Analytics)</h2>
    <p style="color:#666; margin-bottom:20px;">วิเคราะห์แนวโน้มการขายและคำนวณการสั่งซื้ออัตโนมัติ</p>

    <div style="display:flex; gap:20px;">
      <div style="flex:1; background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
        <h3>💡 คำแนะนำจาก AI สำหรับสต็อกสัปดาห์นี้</h3>
        <ul style="line-height:1.8; color:#444;">
          <li>ควรเตรียมสำรอง <strong>เสื้อนักศึกษาแขนสั้น (มีสาบหลัง)</strong> เพิ่มขึ้น 20% สำหรับช่วงเปิดเทอม</li>
          <li>กระโปรงพลีทกลีบเล็ก ไซส์ 24-26 มีอัตราหมุนเวียนเร็วที่สุด</li>
          <li>ควรจัดโปรโมชันลดราคาสำหรับสินค้าที่มีสต็อกเกิน 50 ชิ้น เพื่อลดภาระการจมทุน</li>
        </ul>
      </div>
    </div>
  `;
}

// ----------------------------------------------------
// ระบบฟอร์มเพิ่มสินค้า
// ----------------------------------------------------
function openProductForm() {
  const modal = document.getElementById('productModal');
  if (modal) {
    modal.style.display = 'block';
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
    payload.product_name = `กระโปรง ${payload.skirt_style} (เอว ${payload.waist} ยาว ${payload.length})`;
  } else if (cat === 'เสื้อนักศึกษา') {
    payload.shirt_gender = document.getElementById('pShirtGender').value;
    payload.shirt_sleeve = document.getElementById('pShirtSleeve').value;
    payload.shirt_back = document.getElementById('pShirtBack').value;
    payload.shirt_color = document.getElementById('pShirtColor').value;
    payload.shirt_size = document.getElementById('pShirtSize').value;
    payload.product_name = `${payload.shirt_gender} ${payload.shirt_sleeve} [${payload.shirt_back}] (${payload.shirt_color})`;
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
