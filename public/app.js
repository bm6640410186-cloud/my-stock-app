let mockProducts = [
  { id: "1", name: "กระโปรงพลีทกลีบเล็ก (เอว 25\" ยาว 18\")", category: "กระโปรงนักศึกษา", stock: 55, cost: 150, price: 200 },
  { id: "2", name: "เสื้อนักศึกษาชาย แขนสั้น [ไม่มีสาบหลัง] (ขาวสว่าง) ไซส์ M", category: "เสื้อนักศึกษา", stock: 12, cost: 160, price: 220 },
  { id: "3", name: "กระโปรงทรงเอ (เอว 26\" ยาว 16\")", category: "กระโปรงนักศึกษา", stock: 8, cost: 140, price: 190 }
];

let globalProducts = [];

// ฟังก์ชันเรียก API
async function api(endpoint, options = {}) {
  try {
    const res = await fetch(endpoint, options);
    if (!res.ok) {
      return handleLocalFallback(endpoint, options);
    }
    return await res.json();
  } catch (err) {
    return handleLocalFallback(endpoint, options);
  }
}

function handleLocalFallback(endpoint, options) {
  const method = options.method || 'GET';
  if (endpoint.startsWith('/products')) {
    if (method === 'GET') {
      return mockProducts;
    } else if (method === 'POST') {
      const body = JSON.parse(options.body || '{}');
      const newProduct = {
        id: String(Date.now()),
        name: body.name || 'สินค้าใหม่',
        category: body.category || 'อื่นๆ',
        stock: Number(body.stock || 0),
        cost: Number(body.cost || 0),
        price: Number(body.price || 0)
      };
      mockProducts.unshift(newProduct);
      return newProduct;
    }
  }
  return [];
}

// ----------------------------------------------------
// Navigation Router
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

  if (viewName === 'dashboard') loadDashboard();
  else if (viewName === 'products') loadProducts();
  else if (viewName === 'deadstock') loadDeadstock();
  else if (viewName === 'ai-analytics') loadAIAnalyticsPage();
}

function getPName(p) { return p.name || p.product_name || `${p.category || ''}`; }
function getPStock(p) { return Number(p.stock ?? p.current_stock ?? 0); }
function getPCost(p) { return Number(p.cost ?? p.cost_price ?? 0); }
function getPPrice(p) { return Number(p.price ?? p.selling_price ?? 0); }

// 1. หน้าแดชบอร์ด
async function loadDashboard() {
  const target = document.getElementById('view-dashboard');
  if (!target) return;

  const products = await api('/products');
  if (products && Array.isArray(products)) {
    globalProducts = products;
  }

  const totalItems = globalProducts.reduce((sum, p) => sum + getPStock(p), 0);
  const totalValue = globalProducts.reduce((sum, p) => sum + (getPStock(p) * getPCost(p)), 0);
  const lowStockItems = globalProducts.filter(p => getPStock(p) <= 10);
  const deadstockItems = globalProducts.filter(p => getPStock(p) >= 50);

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

    <div style="display:flex; gap:20px;">
      <div style="flex:1; background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
        <h3 style="margin-top:0; color:#dc3545;">⚠️ แจ้งเตือนสินค้าใกล้หมด (≤ 10 ชิ้น)</h3>
        ${lowStockItems.length > 0 ? `
          <ul style="padding-left:20px; margin:0;">
            ${lowStockItems.slice(0, 5).map(p => `
              <li style="margin-bottom:8px;">
                <strong>${getPName(p)}</strong> - เหลือ <span style="color:#dc3545; font-weight:bold;">${getPStock(p)}</span> ชิ้น
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

// 2. หน้าสินค้าและสต็อก
async function loadProducts() {
  const tableWrap = document.getElementById('productsTableWrap');
  if (!tableWrap) return;

  const products = await api('/products');
  if (products && Array.isArray(products)) {
    globalProducts = products;
  }

  tableWrap.innerHTML = `
    <div style="background:#fff; padding:20px; border-radius:8px; margin-top:15px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:2px solid #eee; text-align:left; color:#555;">
            <th style="padding:10px;">หมวดหมู่</th>
            <th>ชื่อ / รายละเอียดสินค้า</th>
            <th>คงเหลือ (ชิ้น)</th>
            <th>ราคาทุน (฿)</th>
            <th>ราคาขาย (฿)</th>
          </tr>
        </thead>
        <tbody>
          ${globalProducts.map(p => `
            <tr style="border-bottom:1px solid #f9f9f9;">
              <td style="padding:10px;">${p.category || '-'}</td>
              <td><strong>${getPName(p)}</strong></td>
              <td><span style="color:${getPStock(p) > 10 ? '#28a745' : '#dc3545'}; font-weight:bold;">${getPStock(p)}</span></td>
              <td>${getPCost(p).toLocaleString()}</td>
              <td><strong>${getPPrice(p).toLocaleString()}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// 3. หน้าสินค้าค้างสต็อก
async function loadDeadstock() {
  const target = document.getElementById('view-deadstock');
  if (!target) return;

  const products = await api('/products');
  if (products && Array.isArray(products)) {
    globalProducts = products;
  }

  const highStockItems = globalProducts.filter(p => getPStock(p) >= 50);
  const totalDeadstockCapital = highStockItems.reduce((sum, p) => sum + (getPStock(p) * getPCost(p)), 0);

  target.innerHTML = `
    <h2>⚠️ สินค้าค้างสต็อก & วิเคราะห์ทุนจม</h2>
    <p style="color:#666; margin-bottom:20px;">สรุปรายการสินค้าคงเหลือสูงและระดับความวิกฤตทางการเงิน</p>

    <div style="border-left:5px solid #dc3545; background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05); margin-bottom:25px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <span style="color:#666; font-size:14px;">รวมมูลค่าเงินจมทุนสินค้าค้างสต็อก (≥ 50 ชิ้น)</span>
        <h2 style="margin:5px 0 0 0; color:#dc3545; font-size:28px;">${totalDeadstockCapital.toLocaleString()} บาท</h2>
      </div>
      <div>
        <span style="background:#f8d7da; color:#721c24; padding:8px 16px; border-radius:20px; font-weight:bold; font-size:14px;">
          ค้างสต็อกรวม ${highStockItems.length} รายการ
        </span>
      </div>
    </div>

    <div style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
      <h3 style="margin-top:0; color:#333;">📦 รายการสินค้าและระดับความวิกฤต</h3>
      ${highStockItems.length > 0 ? `
        <table style="width:100%; border-collapse:collapse; margin-top:15px;">
          <thead>
            <tr style="border-bottom:2px solid #eee; text-align:left; color:#555;">
              <th style="padding:10px;">ชื่อสินค้า</th>
              <th>หมวดหมู่</th>
              <th>จำนวนค้าง (ชิ้น)</th>
              <th>ทุนจม (บาท)</th>
              <th>ระดับความวิกฤต</th>
            </tr>
          </thead>
          <tbody>
            ${highStockItems.map(p => {
              const stock = getPStock(p);
              const capital = stock * getPCost(p);
              let badge = '<span style="background:#fff3cd; color:#856404; padding:4px 10px; border-radius:12px; font-size:13px; font-weight:bold;">🟡 วิกฤตปานกลาง</span>';
              if (stock >= 100) badge = '<span style="background:#f8d7da; color:#721c24; padding:4px 10px; border-radius:12px; font-size:13px; font-weight:bold;">🔴 วิกฤตสูง</span>';

              return `
                <tr style="border-bottom:1px solid #f9f9f9;">
                  <td style="padding:10px;"><strong>${getPName(p)}</strong></td>
                  <td>${p.category || '-'}</td>
                  <td><strong style="color:#d9822b;">${stock}</strong></td>
                  <td><strong style="color:#dc3545;">${capital.toLocaleString()} ฿</strong></td>
                  <td>${badge}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      ` : '<p style="color:#888;">ไม่พบรายการสินค้าค้างสต็อกเกิน 50 ชิ้น</p>'}
    </div>
  `;
}

// 4. หน้าวิเคราะห์ AI
async function loadAIAnalyticsPage() {
  const target = document.getElementById('view-ai-analytics');
  if (!target) return;

  target.innerHTML = `
    <h2>🤖 ระบบวิเคราะห์สต็อกด้วย AI (AI Stock Analytics)</h2>
    <p style="color:#666; margin-bottom:20px;">วิเคราะห์แนวโน้มการขายและคำนวณการสั่งซื้ออัตโนมัติ</p>

    <div style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
      <h3>💡 คำแนะนำจาก AI สำหรับสต็อกสัปดาห์นี้</h3>
      <ul style="line-height:1.8; color:#444;">
        <li>ควรเตรียมสำรอง <strong>เสื้อนักศึกษาแขนสั้น (มีสาบหลัง)</strong> เพิ่มขึ้น 20% สำหรับช่วงเปิดเทอม</li>
        <li>กระโปรงพลีทกลีบเล็ก ไซส์ 24-26 มีอัตราหมุนเวียนเร็วที่สุด</li>
        <li>ควรจัดโปรโมชันลดราคาสำหรับสินค้าที่มีสต็อกเกิน 50 ชิ้น เพื่อลดภาระการจมทุน</li>
      </ul>
    </div>
  `;
}

// ระบบฟอร์มเพิ่มสินค้า
function openProductForm() {
  const modal = document.getElementById('productModal');
  if (modal) { modal.style.display = 'block'; toggleCategoryFields(); }
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
  const stockVal = Number(document.getElementById('pStock').value);
  const costVal = Number(document.getElementById('pCost').value);
  const priceVal = Number(document.getElementById('pPrice').value);

  let pName = '';
  if (cat === 'กระโปรงนักศึกษา') {
    const style = document.getElementById('pSkirtStyle').value;
    const waist = document.getElementById('pWaist').value;
    const length = document.getElementById('pLength').value;
    pName = `กระโปรง${style} (เอว ${waist}" ยาว ${length}")`;
  } else if (cat === 'เสื้อนักศึกษา') {
    const gender = document.getElementById('pShirtGender').value;
    const sleeve = document.getElementById('pShirtSleeve').value;
    const back = document.getElementById('pShirtBack').value;
    const color = document.getElementById('pShirtColor').value;
    const size = document.getElementById('pShirtSize').value;
    pName = `${gender} ${sleeve} [${back}] (${color}) ไซส์ ${size}`;
  } else {
    pName = document.getElementById('pName').value || 'สินค้าทั่วไป';
  }

  await api('/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: pName,
      category: cat,
      stock: stockVal,
      cost: costVal,
      price: priceVal
    })
  });

  alert('บันทึกสินค้าเรียบร้อยแล้ว!');
  closeProductForm();
  loadProducts();
}
