// Local In-Memory Storage Fallback
let mockProducts = [
  { id: "1", name: "กระโปรงพลีทกลีบเล็ก (เอว 25\" ยาว 18\")", category: "กระโปรงนักศึกษา", stock: 50, cost: 150, price: 200 },
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
  const method = (options.method || 'GET').toUpperCase();
  if (endpoint.startsWith('/products')) {
    const parts = endpoint.split('/');
    const prodId = parts[2];

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
    } else if (method === 'PUT' || method === 'PATCH') {
      const body = JSON.parse(options.body || '{}');
      const prod = mockProducts.find(p => String(p.id) === String(prodId));
      if (prod) {
        if (body.stock !== undefined) prod.stock = Number(body.stock);
        return prod;
      }
    } else if (method === 'DELETE') {
      mockProducts = mockProducts.filter(p => String(p.id) !== String(prodId));
      return { success: true };
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
        <h3 style="margin-top:0; color:#6f42c1;">🤖 AI Stock Insights Summary</h3>
        <div style="font-size:14px; color:#444; line-height:1.6;">
          ${lowStockItems.length > 0 ? `
            <div style="margin-bottom:10px; background:#e8f4fd; padding:10px; border-radius:6px; border-left:4px solid #17a2b8;">
              <strong style="color:#0c5460;">🛒 แนะนำสั่งเพิ่มด่วน:</strong><br>
              ${lowStockItems.slice(0, 2).map(p => `• ${getPName(p)} (ควรสั่งเพิ่มอีก <strong>${30 - getPStock(p)}</strong> ตัว)`).join('<br>')}
            </div>
          ` : ''}

          ${deadstockItems.length > 0 ? `
            <div style="background:#fff3cd; padding:10px; border-radius:6px; border-left:4px solid #ffc107;">
              <strong style="color:#856404;">🔥 ควรกระตุ้นขาย/ระบายสต็อก:</strong><br>
              ${deadstockItems.slice(0, 2).map(p => `• ${getPName(p)} (ค้างสต็อก <strong>${getPStock(p)}</strong> ตัว - ควรรีบเคลียร์ <strong>${getPStock(p) - 30}</strong> ตัว)`).join('<br>')}
            </div>
          ` : ''}

          ${lowStockItems.length === 0 && deadstockItems.length === 0 ? '<p style="color:#28a745;">✅ สต็อกอยู่ในระดับสมดุล สมบูรณ์ดี</p>' : ''}
        </div>
        <button onclick="switchView('ai-analytics')" style="background:#6f42c1; color:#fff; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; margin-top:15px;">ดูรายงาน AI แบบละเอียด</button>
      </div>
    </div>
  `;
}

// ----------------------------------------------------
// 2. หน้าสินค้าและสต็อก (ฟังก์ชันแก้ไขและลบสินค้า)
// ----------------------------------------------------
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
            <th style="text-align:center;">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          ${globalProducts.map(p => {
            const pId = String(p.id || p._id);
            const stock = getPStock(p);
            const safeName = getPName(p).replace(/'/g, "\\'").replace(/"/g, '&quot;');
            return `
              <tr style="border-bottom:1px solid #f9f9f9;">
                <td style="padding:10px;">${p.category || '-'}</td>
                <td><strong>${getPName(p)}</strong></td>
                <td><span style="color:${stock > 10 ? '#28a745' : '#dc3545'}; font-weight:bold;">${stock}</span></td>
                <td>${getPCost(p).toLocaleString()}</td>
                <td><strong>${getPPrice(p).toLocaleString()}</strong></td>
                <td style="text-align:center;">
                  <button onclick="editStock('${pId}', ${stock})" title="แก้ไขจำนวนสต็อก" style="background:#ffc107; border:none; color:#333; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:13px; font-weight:bold; margin-right:5px;">✏️ แก้ไขสต็อก</button>
                  <button onclick="removeProductItem('${pId}', '${safeName}')" title="ลบสินค้า" style="background:#dc3545; border:none; color:#fff; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:13px; font-weight:bold;">🗑️ ลบ</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ฟังก์ชันแก้ไขจำนวนสต็อก
async function editStock(id, currentStock) {
  const newStockStr = prompt(`กรุณาระบุจำนวนสินค้าคงเหลือใหม่:`, currentStock);
  if (newStockStr === null) return;

  const newStock = Number(newStockStr);
  if (isNaN(newStock) || newStock < 0) {
    alert('กรุณากรอกตัวเลขจำนวนสินค้าให้ถูกต้อง');
    return;
  }

  // อัปเดตผ่าน API หรือ Local Mock
  await api(`/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stock: newStock })
  });

  // อัปเดตตัวแปรในหน่วยความจำทันทีเพื่อความรวดเร็ว
  const itemIndex = mockProducts.findIndex(p => String(p.id) === String(id));
  if (itemIndex !== -1) mockProducts[itemIndex].stock = newStock;

  alert('อัปเดตจำนวนสต็อกเรียบร้อยแล้ว!');
  loadProducts();
}

// ฟังก์ชันลบสินค้า (แก้ไขชื่อฟังก์ชันป้องกันการชนกับระบบอื่น)
async function removeProductItem(id, name) {
  if (confirm(`คุณต้องการลบสินค้า "${name}" ออกจากระบบใช่หรือไม่?`)) {
    await api(`/products/${id}`, {
      method: 'DELETE'
    });

    // ลบออกจาก Mock Array ในหน้าเว็บทันที
    mockProducts = mockProducts.filter(p => String(p.id) !== String(id));
    globalProducts = globalProducts.filter(p => String(p.id || p._id) !== String(id));

    alert('ลบสินค้าเรียบร้อยแล้ว!');
    loadProducts();
  }
}

// ----------------------------------------------------
// 3. หน้าสินค้าค้างสต็อก (Deadstock)
// ----------------------------------------------------
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

// ----------------------------------------------------
// 4. หน้าวิเคราะห์สต็อก AI (AI Analytics)
// ----------------------------------------------------
async function loadAIAnalyticsPage() {
  const target = document.getElementById('view-ai-analytics');
  if (!target) return;

  const products = await api('/products');
  if (products && Array.isArray(products)) {
    globalProducts = products;
  }

  const reorderList = globalProducts.filter(p => getPStock(p) <= 10).map(p => ({
    ...p,
    suggestedAdd: 30 - getPStock(p)
  }));

  const clearList = globalProducts.filter(p => getPStock(p) >= 50).map(p => ({
    ...p,
    overStock: getPStock(p) - 30
  }));

  target.innerHTML = `
    <h2>🤖 ระบบวิเคราะห์สต็อกด้วย AI (AI Stock Analytics)</h2>
    <p style="color:#666; margin-bottom:20px;">ประมวลผลคำนวณจำนวนการเติมสต็อกและการระบายสินค้าอัตโนมัติ</p>

    <div style="display:flex; gap:20px; flex-wrap:wrap;">
      <div style="flex:1; min-width:320px; background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-top:4px solid #17a2b8;">
        <h3 style="margin-top:0; color:#17a2b8;">🛒 รายการที่ควรสั่งซื้อเพิ่ม (Stock Reorder Target)</h3>
        ${reorderList.length > 0 ? `
          <table style="width:100%; border-collapse:collapse; margin-top:10px;">
            <thead>
              <tr style="border-bottom:2px solid #eee; text-align:left; font-size:13px; color:#666;">
                <th style="padding:8px 0;">ชื่อสินค้า</th>
                <th>เหลือ</th>
                <th style="color:#28a745; text-align:right;">ควรสั่งเพิ่ม</th>
              </tr>
            </thead>
            <tbody>
              ${reorderList.map(p => `
                <tr style="border-bottom:1px solid #f8f8f8;">
                  <td style="padding:8px 0; font-size:14px;"><strong>${getPName(p)}</strong></td>
                  <td style="color:#dc3545; font-weight:bold;">${getPStock(p)}</td>
                  <td style="text-align:right;"><span style="background:#d4edda; color:#155724; padding:3px 8px; border-radius:12px; font-weight:bold;">+ ${p.suggestedAdd} ตัว</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p style="color:#888;">ไม่มีสินค้าที่จำเป็นต้องสั่งเพิ่มในขณะนี้</p>'}
      </div>

      <div style="flex:1; min-width:320px; background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-top:4px solid #dc3545;">
        <h3 style="margin-top:0; color:#dc3545;">🔥 สินค้าที่ควรรีบเคลียร์สต็อก (Overstock Clearance)</h3>
        ${clearList.length > 0 ? `
          <table style="width:100%; border-collapse:collapse; margin-top:10px;">
            <thead>
              <tr style="border-bottom:2px solid #eee; text-align:left; font-size:13px; color:#666;">
                <th style="padding:8px 0;">ชื่อสินค้า</th>
                <th>คงเหลือ</th>
                <th style="color:#dc3545; text-align:right;">ควรรีบเคลียร์</th>
              </tr>
            </thead>
            <tbody>
              ${clearList.map(p => `
                <tr style="border-bottom:1px solid #f8f8f8;">
                  <td style="padding:8px 0; font-size:14px;"><strong>${getPName(p)}</strong></td>
                  <td style="color:#d9822b; font-weight:bold;">${getPStock(p)}</td>
                  <td style="text-align:right;"><span style="background:#f8d7da; color:#721c24; padding:3px 8px; border-radius:12px; font-weight:bold;">${p.overStock} ตัว</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p style="color:#888;">ไม่พบสินค้าที่ค้างสต็อกเกินกำหนด</p>'}
      </div>
    </div>
  `;
}

// ----------------------------------------------------
// ระบบฟอร์มเพิ่มสินค้า
// ----------------------------------------------------
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
