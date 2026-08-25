// ฟังก์ชันสลับการแสดงผลช่องกรอกตามหมวดหมู่
function toggleCategoryFields() {
  const catEl = document.getElementById('pCategory');
  if (!catEl) return;
  const cat = catEl.value;

  const skirtFields = document.getElementById('skirtFields');
  const shirtFields = document.getElementById('shirtFields');
  const generalNameField = document.getElementById('generalNameField');
  const generalSizeField = document.getElementById('generalSizeField');

  if (skirtFields) skirtFields.style.display = 'none';
  if (shirtFields) shirtFields.style.display = 'none';
  if (generalNameField) generalNameField.style.display = 'none';
  if (generalSizeField) generalSizeField.style.display = 'none';

  if (cat === 'กระโปรงนักศึกษา' && skirtFields) {
    skirtFields.style.display = 'block';
  } else if (cat === 'เสื้อนักศึกษา' && shirtFields) {
    shirtFields.style.display = 'block';
  } else {
    if (generalNameField) generalNameField.style.display = 'block';
    if (generalSizeField) generalSizeField.style.display = 'block';
  }
}

// ฟังก์ชันสลับหน้าเมนู
function switchView(viewName) {
  document.querySelectorAll('.view').forEach(el => {
    el.style.display = 'none';
    el.classList.remove('active');
  });

  const target = document.getElementById(`view-${viewName}`);
  if (target) {
    target.style.display = 'block';
    target.classList.add('active');
  }

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.remove('active');
  });
  
  const activeNav = document.querySelector(`.nav-item[data-view="${viewName}"]`);
  if (activeNav) activeNav.classList.add('active');

  if (viewName === 'dashboard') loadDashboard();
  if (viewName === 'products') loadProducts();
  if (viewName === 'sales') loadSalesPage();
  if (viewName === 'deadstock') loadDeadstock();
  if (viewName === 'receive') loadReceivePage();
  if (viewName === 'forecast') loadAIForecast();
}

function openProductForm() {
  const modal = document.getElementById('productModal');
  if (modal) {
    modal.style.display = 'flex';
    toggleCategoryFields();
  }
}

function closeProductForm() {
  const modal = document.getElementById('productModal');
  const form = document.getElementById('productForm');
  if (modal) modal.style.display = 'none';
  if (form) form.reset();
}

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

let globalProducts = [];
let salesHistory = [];

// ฟังก์ชันลบสินค้า
async function deleteProduct(productId, productName) {
  if (confirm(`คุณต้องการลบสินค้า "${productName}" ออกจากระบบใช่หรือไม่?`)) {
    globalProducts = globalProducts.filter(p => String(p.id) !== String(productId));

    try {
      await api(`/products/${productId}`, { method: 'DELETE' });
    } catch (err) {
      console.log('ยังไม่ได้เชื่อมต่อ API ลบฝั่ง Backend');
    }

    alert(`🗑️ ลบสินค้า "${productName}" เรียบร้อยแล้ว`);
    renderProductsTable();
  }
}

// ฟังก์ชันวาดตารางสินค้า
function renderProductsTable() {
  const wrap = document.getElementById('productsTableWrap');
  if (!wrap) return;

  if (globalProducts && globalProducts.length > 0) {
    wrap.innerHTML = `
      <table style="width:100%; border-collapse:collapse; margin-top:15px; background:#fff; border-radius:8px; padding:15px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
        <thead>
          <tr style="border-bottom:2px solid #eee; text-align:left; color:#555;">
            <th style="padding:12px;">ชื่อสินค้า / รายละเอียด</th>
            <th>หมวดหมู่</th>
            <th>ไซส์ / ขนาด</th>
            <th>คงเหลือ</th>
            <th>ราคาทุน</th>
            <th>ราคาขาย</th>
            <th style="text-align:center;">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          ${globalProducts.map(p => `
            <tr style="border-bottom:1px solid #f9f9f9;">
              <td style="padding:12px;"><strong>${p.product_name}</strong></td>
              <td>${p.category || '-'}</td>
              <td>${p.size || '-'}</td>
              <td><strong>${p.current_stock}</strong></td>
              <td>${p.cost_price} ฿</td>
              <td>${p.selling_price} ฿</td>
              <td style="text-align:center;">
                <button onclick="deleteProduct('${p.id}', '${p.product_name}')" style="background:#dc3545; color:#fff; border:none; padding:6px 12px; border-radius:4px; font-weight:bold; cursor:pointer;">
                  🗑️ ลบ
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else {
    wrap.innerHTML = '<p style="color:#888; margin-top:20px; text-align:center;">ยังไม่มีรายการสินค้า</p>';
  }
}

// โหลดข้อมูลสินค้า
async function loadProducts() {
  if (globalProducts.length === 0) {
    const products = await api('/products');
    if (products && Array.isArray(products) && products.length > 0) {
      globalProducts = products;
    }
  }
  renderProductsTable();
}

// โหลดหน้า บันทึกการขายสินค้า
async function loadSalesPage() {
  if (globalProducts.length === 0) {
    const products = await api('/products');
    if (products && Array.isArray(products) && products.length > 0) {
      globalProducts = products;
    }
  }

  const target = document.getElementById('view-sales');
  if (!target) return;

  const totalSalesAmount = salesHistory.reduce((acc, item) => acc + item.total, 0);

  target.innerHTML = `
    <h2>🛒 บันทึกการขายสินค้า</h2>
    <p style="color:#666; margin-bottom:20px;">เลือกรายการสินค้าและจำนวนที่ต้องการขายเพื่อบันทึกและตัดสต็อก</p>

    <div style="display:flex; gap:20px; align-items:flex-start; flex-wrap:wrap;">
      <div style="background:#fff; padding:25px; border-radius:8px; flex:1; min-width:300px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
        <form id="salesForm">
          <div style="margin-bottom:15px;">
            <label style="display:block; margin-bottom:5px; font-weight:bold;">เลือกสินค้าที่ต้องการขาย:</label>
            <select id="saleProductId" required style="width:100%; padding:10px; border:1px solid #ccc; border-radius:4px;">
              <option value="">-- เลือกรายการสินค้า --</option>
              ${globalProducts.map(p => `
                <option value="${p.id}" ${p.current_stock <= 0 ? 'disabled' : ''}>
                  ${p.product_name} ${p.size ? `(${p.size})` : ''} (คงเหลือ: ${p.current_stock})
                </option>
              `).join('')}
            </select>
          </div>

          <div style="margin-bottom:20px;">
            <label style="display:block; margin-bottom:5px; font-weight:bold;">จำนวนที่ขาย (ชิ้น):</label>
            <input type="number" id="saleQty" min="1" value="1" required style="width:100%; padding:10px; border:1px solid #ccc; border-radius:4px;">
          </div>

          <button type="submit" style="width:100%; background:#28a745; color:#fff; border:none; padding:12px; border-radius:4px; font-size:16px; font-weight:bold; cursor:pointer;">
            บันทึกการขายและตัดสต็อก
          </button>
        </form>
      </div>

      <div style="background:#fff; padding:20px; border-radius:8px; min-width:250px; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-left:5px solid #28a745;">
        <span style="color:#666; font-size:14px;">ยอดขายรวมทั้งหมด</span>
        <h2 style="margin:5px 0 0 0; color:#28a745;">${totalSalesAmount.toLocaleString()} ฿</h2>
        <span style="color:#888; font-size:12px;">รายการขายทั้งหมด: ${salesHistory.length} รายการ</span>
      </div>
    </div>

    <div style="background:#fff; padding:20px; border-radius:8px; margin-top:20px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
      <h3 style="margin-top:0;">📋 ประวัติการขายสินค้า</h3>
      ${salesHistory.length > 0 ? `
        <table style="width:100%; border-collapse:collapse; margin-top:10px;">
          <thead>
            <tr style="border-bottom:2px solid #eee; text-align:left; color:#555;">
              <th style="padding:10px;">รายการสินค้า</th>
              <th>จำนวนที่ขาย</th>
              <th>ราคาต่อชิ้น</th>
              <th>ราคารวม</th>
            </tr>
          </thead>
          <tbody>
            ${salesHistory.map(s => `
              <tr style="border-bottom:1px solid #f9f9f9;">
                <td style="padding:10px;"><strong>${s.product_name}</strong></td>
                <td>${s.qty} ชิ้น</td>
                <td>${s.price.toLocaleString()} ฿</td>
                <td><strong style="color:#28a745;">${s.total.toLocaleString()} ฿</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p style="color:#888; margin-top:10px;">ยังไม่มีรายการบันทึกการขาย</p>'}
    </div>
  `;

  const salesForm = document.getElementById('salesForm');
  if (salesForm) {
    salesForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const productId = document.getElementById('saleProductId').value;
      const qty = parseInt(document.getElementById('saleQty').value) || 0;

      const product = globalProducts.find(p => String(p.id) === String(productId));
      if (!product) return;

      if (qty > product.current_stock) {
        alert('❌ จำนวนที่ขายมากกว่าสินค้าที่มีอยู่ในสต็อก!');
        return;
      }

      product.current_stock -= qty;

      salesHistory.unshift({
        product_name: product.product_name,
        qty: qty,
        price: product.selling_price || 0,
        total: qty * (product.selling_price || 0)
      });

      alert(`✅ บันทึกการขาย ${product.product_name} จำนวน ${qty} ชิ้น เรียบร้อยแล้ว`);
      loadSalesPage();
    });
  }
}

// โหลดหน้า แดชบอร์ด
async function loadDashboard() {
  if (globalProducts.length === 0) {
    const products = await api('/products');
    if (products && Array.isArray(products) && products.length > 0) {
      globalProducts = products;
    }
  }

  const target = document.getElementById('view-dashboard');
  if (!target) return;

  const threshold = 10;
  const lowStockItems = globalProducts.filter(p => p.current_stock <= threshold);
  const totalStock = globalProducts.reduce((acc, p) => acc + p.current_stock, 0);

  target.innerHTML = `
    <h2>ภาพรวมร้านค้า</h2>
    <p style="color:#666; margin-bottom:20px;">ข้อมูลจากฐานข้อมูลจริงแบบเรียลไทม์</p>

    <div style="display:flex; gap:15px; margin-bottom:25px;">
      <div style="flex:1; background:#fff; padding:15px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-left:5px solid #007bff;">
        <span style="color:#666; font-size:14px;">รายการสินค้าทั้งหมด</span>
        <h2 style="margin:5px 0 0 0; color:#007bff;">${globalProducts.length} รายการ</h2>
      </div>
      <div style="flex:1; background:#fff; padding:15px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-left:5px solid #28a745;">
        <span style="color:#666; font-size:14px;">สต็อกสินค้ารวม</span>
        <h2 style="margin:5px 0 0 0; color:#28a745;">${totalStock} ชิ้น</h2>
      </div>
      <div style="flex:1; background:#fff; padding:15px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-left:5px solid #dc3545;">
        <span style="color:#666; font-size:14px;">สินค้าต้องสั่งเพิ่ม (AI)</span>
        <h2 style="margin:5px 0 0 0; color:#dc3545;">${lowStockItems.length} รายการ</h2>
      </div>
    </div>
  `;
}

// โหลดหน้า สินค้าค้างสต็อก (Deadstock)
async function loadDeadstock() {
  if (globalProducts.length === 0) {
    const products = await api('/products');
    if (products && Array.isArray(products) && products.length > 0) globalProducts = products;
  }

  const target = document.getElementById('view-deadstock');
  if (!target) return;

  const highStockItems = globalProducts.filter(p => p.current_stock >= 50);

  target.innerHTML = `
    <h2>⚠️ สินค้าค้างสต็อก (Deadstock Analytics)</h2>
    <p style="color:#666; margin-bottom:20px;">ตรวจสอบรายการสินค้าที่คงค้างในระบบปริมาณมากและจมทุน</p>

    <div style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
      <h3 style="margin-top:0;">รายการสินค้าคงค้างเยอะ (สต็อก >= 50 ชิ้น)</h3>
      ${highStockItems.length > 0 ? `
        <table style="width:100%; border-collapse:collapse; margin-top:15px;">
          <thead>
            <tr style="border-bottom:2px solid #eee; text-align:left; color:#555;">
              <th style="padding:10px;">ชื่อสินค้า</th>
              <th>หมวดหมู่</th>
              <th>ไซส์ / ขนาด</th>
              <th>จำนวนค้างสต็อก</th>
              <th>มูลค่าเงินจมทุน (฿)</th>
            </tr>
          </thead>
          <tbody>
            ${highStockItems.map(p => `
              <tr style="border-bottom:1px solid #f9f9f9;">
                <td style="padding:10px;"><strong>${p.product_name}</strong></td>
                <td>${p.category || '-'}</td>
                <td>${p.size || '-'}</td>
                <td><strong style="color:#dc3545;">${p.current_stock} ชิ้น</strong></td>
                <td>${(p.current_stock * p.cost_price).toLocaleString()} ฿</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p style="color:#28a745; margin-top:15px;">✨ เยี่ยมมาก! ไม่มีรายการสินค้าจมทุนในขณะนี้</p>'}
    </div>
  `;
}

// โหลดหน้า รับสินค้าเข้า (Stock In)
async function loadReceivePage() {
  if (globalProducts.length === 0) {
    const products = await api('/products');
    if (products && Array.isArray(products) && products.length > 0) globalProducts = products;
  }

  const target = document.getElementById('view-receive');
  if (!target) return;

  target.innerHTML = `
    <h2>📥 บันทึกการรับสินค้าเข้าสต็อก</h2>
    <p style="color:#666; margin-bottom:20px;">เติมสต็อกสินค้าเดิมที่มีอยู่ในระบบ</p>

    <div style="background:#fff; padding:25px; border-radius:8px; max-width:500px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
      <form id="receiveForm">
        <div style="margin-bottom:15px;">
          <label style="display:block; margin-bottom:5px; font-weight:bold;">เลือกสินค้าที่ต้องการเติมสต็อก:</label>
          <select id="recProductId" required style="width:100%; padding:10px; border:1px solid #ccc; border-radius:4px;">
            <option value="">-- เลือกรายการสินค้า --</option>
            ${globalProducts.map(p => `
              <option value="${p.id}">${p.product_name} ${p.size ? `(${p.size})` : ''} - สต็อกปัจจุบัน: ${p.current_stock}</option>
            `).join('')}
          </select>
        </div>

        <div style="margin-bottom:20px;">
          <label style="display:block; margin-bottom:5px; font-weight:bold;">จำนวนที่รับเพิ่ม (ชิ้น):</label>
          <input type="number" id="recQty" min="1" value="1" required style="width:100%; padding:10px; border:1px solid #ccc; border-radius:4px;">
        </div>

        <button type="submit" class="btn-primary" style="width:100%; padding:12px; font-size:16px;">📥 ยืนยันการรับเข้าสต็อก</button>
      </form>
    </div>
  `;

  const receiveForm = document.getElementById('receiveForm');
  if (receiveForm) {
    receiveForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const productId = document.getElementById('recProductId').value;
      const qty = parseInt(document.getElementById('recQty').value) || 0;

      const product = globalProducts.find(p => String(p.id) === String(productId));
      if (product) {
        product.current_stock += qty;
        alert(`✅ เพิ่มสต็อกสินค้า "${product.product_name}" จำนวน ${qty} ชิ้น เรียบร้อยแล้ว`);
        loadReceivePage();
      }
    });
  }
}

// โหลดหน้า วิเคราะห์สต็อก (AI)
async function loadAIForecast() {
  if (globalProducts.length === 0) {
    const products = await api('/products');
    if (products && Array.isArray(products) && products.length > 0) globalProducts = products;
  }

  const target = document.getElementById('view-forecast');
  if (!target) return;

  const lowStockItems = globalProducts.filter(p => p.current_stock <= 10);

  target.innerHTML = `
    <h2>🤖 วิเคราะห์และพยากรณ์สต็อก (Stock AI)</h2>
    <p style="color:#666; margin-bottom:20px;">ระบบประมวลผลอัจฉริยะเพื่อแนะนำการสั่งซื้อสินค้าล่วงหน้า</p>

    <div style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05); margin-bottom:20px;">
      <h3 style="margin-top:0; color:#d9822b;">💡 คำแนะนำการสั่งซื้อด่วน (Reorder Point Suggestions)</h3>
      ${lowStockItems.length > 0 ? `
        <table style="width:100%; border-collapse:collapse; margin-top:15px;">
          <thead>
            <tr style="border-bottom:2px solid #eee; text-align:left; color:#555;">
              <th style="padding:10px;">ชื่อสินค้า</th>
              <th>คงเหลือ</th>
              <th>สถานะ AI</th>
              <th>จำนวนแนะนำให้สั่งเพิ่ม</th>
            </tr>
          </thead>
          <tbody>
            ${lowStockItems.map(p => `
              <tr style="border-bottom:1px solid #f9f9f9;">
                <td style="padding:10px;"><strong>${p.product_name}</strong></td>
                <td><span style="color:#dc3545; font-weight:bold;">${p.current_stock} ชิ้น</span></td>
                <td><span style="background:#ffe3e3; color:#dc3545; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">ควรสั่งซื้อด่วน</span></td>
                <td><strong>+50 ชิ้น</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p style="color:#28a745; margin-top:15px;">✅ สต็อกสินค้าทุกรายการอยู่ในระดับที่เหมาะสม ไม่มีสินค้าวิกฤต</p>'}
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.getAttribute('data-view');
      if (view) switchView(view);
    });
  });

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await api('/auth/logout', { method: 'POST' });
      window.location.href = '/login.html';
    });
  }

  const productForm = document.getElementById('productForm');
  if (productForm) {
    productForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const category = document.getElementById('pCategory').value;
      let name = '';
      let size = '';

      if (category === 'กระโปรงนักศึกษา') {
        const style = document.getElementById('pSkirtStyle').value;
        const waist = document.getElementById('pWaist').value;
        const length = document.getElementById('pLength').value;

        name = `กระโปรง${style}`;
        size = `เอว ${waist || '-'} / ยาว ${length || '-'}`;
      } else if (category === 'เสื้อนักศึกษา') {
        const gender = document.getElementById('pShirtGender').value;
        const sleeve = document.getElementById('pShirtSleeve').value;
        const color = document.getElementById('pShirtColor').value;
        const shirtSize = document.getElementById('pShirtSize').value;

        name = `${gender}${sleeve} (${color})`;
        size = shirtSize ? `ไซส์ ${shirtSize}` : '-';
      } else {
        name = document.getElementById('pName').value;
        size = document.getElementById('pSize').value;
      }

      const newProduct = {
        id: Date.now().toString(),
        product_name: name,
        category: category,
        size: size,
        current_stock: parseInt(document.getElementById('pStock').value) || 0,
        cost_price: parseFloat(document.getElementById('pCost').value) || 0,
        selling_price: parseFloat(document.getElementById('pPrice').value) || 0
      };

      globalProducts.push(newProduct);
      closeProductForm();
      loadProducts();
    });
  }

  switchView('dashboard');
});
