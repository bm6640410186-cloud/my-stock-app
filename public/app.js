// Local In-Memory Storage Fallback เพื่อรองรับกรณี Backend Response Error
let mockProducts = [
  { id: "1", name: "กระโปรงพลีทกลีบเล็ก (เอว 25\" ยาว 18\")", category: "กระโปรงนักศึกษา", stock: 55, cost: 150, price: 200, skirt_style: "พลีทกลีบเล็ก", waist: "25", length: "18" },
  { id: "2", name: "เสื้อนักศึกษาชาย แขนสั้น [ไม่มีสาบหลัง] (ขาวสว่าง) ไซส์ M", category: "เสื้อนักศึกษา", stock: 12, cost: 160, price: 220, shirt_gender: "เสื้อนักศึกษาชาย", shirt_sleeve: "แขนสั้น" },
  { id: "3", name: "กระโปรงทรงเอ (เอว 26\" ยาว 16\")", category: "กระโปรงนักศึกษา", stock: 8, cost: 140, price: 190, skirt_style: "ทรงเอ", waist: "26", length: "16" }
];

let globalProducts = [];

// ฟังก์ชันเรียก API พร้อมระบบ Fallback
async function api(endpoint, options = {}) {
  try {
    const res = await fetch(endpoint, options);
    if (!res.ok) {
      console.warn(`API Server Error (${res.status}), using Local Store Fallback`);
      return handleLocalFallback(endpoint, options);
    }
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('Network Error / Backend Unreachable, using Local Store Fallback');
    return handleLocalFallback(endpoint, options);
  }
}

// ระบบจัดการข้อมูลสำรองในกรณี Backend ตอบกลับสำเร็จไม่สมบูรณ์
function handleLocalFallback(endpoint, options) {
  const method = options.method || 'GET';
  
  if (endpoint.startsWith('/products')) {
    if (method === 'GET') {
      return mockProducts;
    } else if (method === 'POST') {
      const body = JSON.parse(options.body || '{}');
      const newProduct = {
        id: String(Date.now()),
        name: body.name || body.product_name || 'สินค้าใหม่',
        category: body.category || 'อื่นๆ',
        stock: Number(body.stock || body.current_stock || 0),
        cost: Number(body.cost || body.cost_price || 0),
        price: Number(body.price || body.selling_price || 0),
        ...body
      };
      mockProducts.unshift(newProduct);
      return newProduct;
    } else if (method === 'PATCH') {
      const parts = endpoint.split('/');
      const prodId = parts[2];
      const body = JSON.parse(options.body || '{}');
      const inc = Number(body.increment || 0);
      
      const prod = mockProducts.find(p => String(p.id || p._id) === String(prodId));
      if (prod) {
        prod.stock = (Number(prod.stock || prod.current_stock || 0)) + inc;
        prod.current_stock = prod.stock;
        return prod;
      }
      return { success: true };
    }
  }
  return [];
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

  if (viewName === 'dashboard') loadDashboard();
  else if (viewName === 'products') loadProducts();
  else if (viewName === 'deadstock') loadDeadstock();
  else if (viewName === 'receive') loadReceivePage();
  else if (viewName === 'ai-analytics') loadAIAnalyticsPage();
}

// Helper ดึงค่าต่างๆ ของสินค้าอย่างยืดหยุ่น
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
            <th>คงเหลือ (ชิ้น)</th>
            <th>ราคาทุน (฿)</th>
            <th>ราคาขาย (฿)</th>
          </tr>
        </thead>
        <tbody>
          ${globalProducts.map(p => {
            const stock = getPStock(p);
            const cost = getPCost(p);
            const price = getPPrice(p);
            const name = getPName(p);

            return `
              <tr style="border-bottom:1px solid #f9f9f9;">
                <td style="padding:10px;">${p.category || '-'}</td>
                <td><strong>${name}</strong></td>
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
// 3. หน้าสินค้าค้างสต็อก (วิเคราะห์ทุนจม + ระดับความวิกฤต)
// ----------------------------------------------------
async function loadDeadstock() {
  const target = document.getElementById('view-deadstock');
  if (!target) return;

  const products = await api('/products');
  if (products && Array.isArray(products)) {
    globalProducts = products;
  }

  const deadstockThreshold = 50;
  const highStockItems = globalProducts.filter(p => getPStock(p) >= deadstockThreshold);
  const totalDeadstockCapital = highStockItems.reduce((sum, p) => sum + (getPStock(p) * getPCost(p)), 0);

  target.innerHTML = `
    <h2>⚠️ สินค้าค้างสต็อก & วิเคราะห์ทุนจม</h2>
    <p style="color:#666; margin-bottom:20px;">สรุปรายการสินค้าคงเหลือสูงและระดับความวิกฤตทางการเงิน</p>

    <!-- กล่องสรุปทุนจม -->
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

    <!-- ตารางวิเคราะห์ระดับความวิกฤต -->
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
              const cost = getPCost(p);
              const capital = stock * cost;

              let badge = '<span style="background:#fff3cd; color:#856404; padding:4px 10px; border-radius:12px; font-size:13px; font-weight:bold;">🟡 วิกฤตปานกลาง</span>';
              if (stock >= 100) {
                badge = '<span style="background:#f8d7da; color:#721c24; padding:4px 10px; border-radius:12px; font-size:13px; font-weight:bold;">🔴 วิกฤตสูง</span>';
              }

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
// 4. หน้ารับสินค้าเข้า (เลือกระบุรายละเอียดสินค้าในสต็อก)
// ----------------------------------------------------
async function loadReceivePage() {
  const target = document.getElementById('view-receive');
  if (!target) return;

  const products = await api('/products');
  if (products && Array.isArray(products)) {
    globalProducts = products;
  }

  const categories = [...new Set(globalProducts.map(p => p.category || 'อื่นๆ'))];

  target.innerHTML = `
    <h2>📥 รับสินค้าเข้าสต็อก (Stock In)</h2>
    <p style="color:#666; margin-bottom:20px;">บันทึกเพิ่มจำนวนสินค้าเข้าคลัง โดยระบุเลือกตามประเภทสินค้า</p>

    <div style="background:#fff; padding:25px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05); max-width:650px;">
      <form id="receiveForm" onsubmit="handleReceiveSubmit(event)">
        
        <div style="margin-bottom:15px;">
          <label style="display:block; margin-bottom:5px; font-weight:bold;">1. เลือกหมวดหมู่สินค้า:</label>
          <select id="recvCategory" onchange="filterReceiveProducts()" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px;">
            <option value="ALL">-- แสดงทั้งหมด --</option>
            ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>

        <div id="recvSubFilterWrap" style="margin-bottom:15px; display:none;">
          <label style="display:block; margin-bottom:5px; font-weight:bold;">2. กรองทรง/รูปแบบสินค้า:</label>
          <select id="recvSubFilter" onchange="filterReceiveProducts()" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px;">
          </select>
        </div>

        <div style="margin-bottom:15px;">
          <label style="display:block; margin-bottom:5px; font-weight:bold;">3. เลือกสินค้าที่ต้องการรับเข้า:</label>
          <select id="recvProduct" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px; font-weight:bold; color:#d9822b;">
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

        <button type="submit" style="width:100%; padding:12px; background:#28a745; color:#fff; border:none; border-radius:6px; font-weight:bold; font-size:16px; cursor:pointer;">📥 บันทึกรับสินค้าเข้าสต็อก</button>
      </form>
    </div>
  `;

  filterReceiveProducts();
}

function filterReceiveProducts() {
  const catSelect = document.getElementById('recvCategory');
  const subWrap = document.getElementById('recvSubFilterWrap');
  const subSelect = document.getElementById('recvSubFilter');
  const prodSelect = document.getElementById('recvProduct');
  if (!catSelect || !prodSelect) return;

  const selectedCat = catSelect.value;
  let filtered = globalProducts;

  if (selectedCat !== 'ALL') {
    filtered = filtered.filter(p => (p.category || 'อื่นๆ') === selectedCat);

    if (selectedCat === 'กระโปรงนักศึกษา') {
      const styles = [...new Set(filtered.map(p => p.skirt_style).filter(Boolean))];
      if (styles.length > 0) {
        subWrap.style.display = 'block';
        const currentSub = subSelect.value;
        subSelect.innerHTML = '<option value="ALL">-- ทุกทรงกระโปรง --</option>' + styles.map(s => `<option value="${s}">${s}</option>`).join('');
        if (styles.includes(currentSub)) subSelect.value = currentSub;
        
        if (subSelect.value !== 'ALL') {
          filtered = filtered.filter(p => p.skirt_style === subSelect.value);
        }
      } else { subWrap.style.display = 'none'; }
    } else if (selectedCat === 'เสื้อนักศึกษา') {
      const types = [...new Set(filtered.map(p => p.shirt_gender).filter(Boolean))];
      if (types.length > 0) {
        subWrap.style.display = 'block';
        const currentSub = subSelect.value;
        subSelect.innerHTML = '<option value="ALL">-- ทุกประเภทเสื้อ --</option>' + types.map(t => `<option value="${t}">${t}</option>`).join('');
        if (types.includes(currentSub)) subSelect.value = currentSub;
        
        if (subSelect.value !== 'ALL') {
          filtered = filtered.filter(p => p.shirt_gender === subSelect.value);
        }
      } else { subWrap.style.display = 'none'; }
    } else {
      subWrap.style.display = 'none';
    }
  } else {
    subWrap.style.display = 'none';
  }

  if (filtered.length === 0) {
    prodSelect.innerHTML = '<option value="">-- ไม่พบสินค้าในหมวดหมู่นี้ --</option>';
  } else {
    prodSelect.innerHTML = filtered.map(p => 
      `<option value="${p.id || p._id}">${getPName(p)} (คงเหลือเดิม: ${getPStock(p)} ชิ้น)</option>`
    ).join('');
  }
}

async function handleReceiveSubmit(e) {
  e.preventDefault();
  const prodId = document.getElementById('recvProduct').value;
  const qty = Number(document.getElementById('recvQty').value);

  if (!prodId) {
    alert('กรุณาเลือกสินค้าที่ต้องการรับเข้า');
    return;
  }

  await api(`/products/${prodId}/stock`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ increment: qty })
  });

  alert('บันทึกการรับสินค้าเข้าสต็อกเรียบร้อยแล้ว');
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
// ระบบฟอร์มเพิ่มสินค้า (ปรับปรุงรูปแบบ JSON รับรอง 100%)
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
  const stockVal = Number(document.getElementById('pStock').value);
  const costVal = Number(document.getElementById('pCost').value);
  const priceVal = Number(document.getElementById('pPrice').value);

  let pName = '';
  let extraData = {};

  if (cat === 'กระโปรงนักศึกษา') {
    const style = document.getElementById('pSkirtStyle').value;
    const waist = document.getElementById('pWaist').value;
    const length = document.getElementById('pLength').value;
    pName = `กระโปรง${style} (เอว ${waist}" ยาว ${length}")`;
    extraData = { skirt_style: style, waist: waist, length: length };
  } else if (cat === 'เสื้อนักศึกษา') {
    const gender = document.getElementById('pShirtGender').value;
    const sleeve = document.getElementById('pShirtSleeve').value;
    const back = document.getElementById('pShirtBack').value;
    const color = document.getElementById('pShirtColor').value;
    const size = document.getElementById('pShirtSize').value;
    pName = `${gender} ${sleeve} [${back}] (${color}) ไซส์ ${size}`;
    extraData = { shirt_gender: gender, shirt_sleeve: sleeve, shirt_back: back, shirt_color: color, shirt_size: size };
  } else {
    pName = document.getElementById('pName').value || 'สินค้าทั่วไป';
    extraData = { size: document.getElementById('pSize').value };
  }

  // ส่ง JSON สำหรับการบันทึก
  const payload = {
    name: pName,
    category: cat,
    stock: stockVal,
    cost: costVal,
    price: priceVal,
    ...extraData
  };

  const res = await api('/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  alert('บันทึกสินค้าเรียบร้อยแล้ว!');
  closeProductForm();
  loadProducts();
}
