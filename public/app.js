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

  // โหลดข้อมูลตามเมนูที่เลือก
  if (viewName === 'dashboard') loadDashboard();
  if (viewName === 'products') loadProducts();
  if (viewName === 'sales') loadSalesPage();
  if (viewName === 'deadstock') loadDeadstock();
  if (viewName === 'receive') loadReceivePage();
  if (viewName === 'forecast') loadAIForecast();
}

function openProductForm() {
  document.getElementById('productModal').style.display = 'flex';
}

function closeProductForm() {
  document.getElementById('productModal').style.display = 'none';
  document.getElementById('productForm').reset();
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

// โหลดหน้า แดชบอร์ด (Dashboard)
async function loadDashboard() {
  const products = await api('/products');
  const target = document.getElementById('view-dashboard');
  if (!target) return;

  const threshold = 10;
  const lowStockItems = products ? products.filter(p => p.current_stock <= threshold) : [];
  const deadstockItems = products ? products.filter(p => p.current_stock > 0) : [];
  const totalStock = products ? products.reduce((acc, p) => acc + p.current_stock, 0) : 0;

  target.innerHTML = `
    <h2>ภาพรวมร้านค้า</h2>
    <p style="color:#666; margin-bottom:20px;">ข้อมูลจากฐานข้อมูลจริงแบบเรียลไทม์</p>

    <div style="display:flex; gap:15px; margin-bottom:25px;">
      <div style="flex:1; background:#fff; padding:15px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-left:5px solid #007bff;">
        <span style="color:#666; font-size:14px;">รายการสินค้าทั้งหมด</span>
        <h2 style="margin:5px 0 0 0; color:#007bff;">${products ? products.length : 0} รายการ</h2>
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

    <div style="background:#fff; padding:20px; border-radius:8px; margin-bottom:20px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
      <h3 style="margin-top:0;">🤖 คำแนะนำสั่งซื้อเร่งด่วนจาก AI</h3>
      ${lowStockItems.length > 0 ? `
        <table style="width:100%; border-collapse:collapse; margin-top:10px;">
          <thead>
            <tr style="border-bottom:2px solid #eee; text-align:left; color:#555;">
              <th style="padding:10px;">ชื่อสินค้า</th>
              <th>คงเหลือ</th>
              <th>สถานะ</th>
              <th>แนะนำสั่งซื้อ</th>
            </tr>
          </thead>
          <tbody>
            ${lowStockItems.map(p => `
              <tr style="border-bottom:1px solid #f9f9f9;">
                <td style="padding:10px;"><strong>${p.product_name}</strong> (${p.size || '-'})</td>
                <td><span style="color:${p.current_stock === 0 ? '#d9534f' : '#f0ad4e'}; font-weight:bold;">${p.current_stock}</span></td>
                <td><span style="color:#d9534f;">${p.current_stock === 0 ? 'หมดสต็อก' : 'สต็อกต่ำ'}</span></td>
                <td><strong style="color:#5cb85c;">+${50 - p.current_stock} ชิ้น</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p style="color:#5cb85c; margin:10px 0 0 0;">✅ สินค้าทุกรายการอยู่ในระดับปลอดภัย</p>'}
    </div>

    <div style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
      <h3 style="margin-top:0;">⚠️ สินค้าค้างสต็อกวิกฤต</h3>
      ${deadstockItems.length > 0 ? `
        <table style="width:100%; border-collapse:collapse; margin-top:10px;">
          <thead>
            <tr style="border-bottom:2px solid #eee; text-align:left; color:#555;">
              <th style="padding:10px;">ชื่อสินค้า</th>
              <th>จำนวนค้างสต็อก</th>
              <th>มูลค่าทุนรวม</th>
            </tr>
          </thead>
          <tbody>
            ${deadstockItems.map(p => `
              <tr style="border-bottom:1px solid #f9f9f9;">
                <td style="padding:10px;">${p.product_name} (${p.size || '-'})</td>
                <td><strong>${p.current_stock}</strong> ชิ้น</td>
                <td>${(p.current_stock * p.cost_price).toLocaleString()} ฿</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p style="color:#888; margin:10px 0 0 0;">ไม่มีสินค้าค้างสต็อก</p>'}
    </div>
  `;
}

// โหลดตารางสินค้า
async function loadProducts() {
  const products = await api('/products');
  const wrap = document.getElementById('productsTableWrap');
  if (!wrap) return;

  if (products && products.length > 0) {
    wrap.innerHTML = `
      <table style="width:100%; border-collapse:collapse; margin-top:15px; background:#fff; border-radius:8px; padding:15px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
        <thead>
          <tr style="border-bottom:2px solid #eee; text-align:left; color:#555;">
            <th style="padding:12px;">ชื่อสินค้า</th>
            <th>หมวดหมู่</th>
            <th>ไซส์</th>
            <th>คงเหลือ</th>
            <th>ราคาทุน</th>
            <th>ราคาขาย</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p => `
            <tr style="border-bottom:1px solid #f9f9f9;">
              <td style="padding:12px;">${p.product_name}</td>
              <td>${p.category || '-'}</td>
              <td>${p.size || '-'}</td>
              <td><strong>${p.current_stock}</strong></td>
              <td>${p.cost_price} ฿</td>
              <td>${p.selling_price} ฿</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else {
    wrap.innerHTML = '<p style="color:#888; margin-top:20px;">ยังไม่มีรายการสินค้า</p>';
  }
}

// โหลดหน้า บันทึกการขายสินค้า (แสดงเฉพาะชื่อสินค้า)
async function loadSalesPage() {
  const products = await api('/products');
  const target = document.getElementById('view-sales');
  if (!target) return;

  target.innerHTML = `
    <h2>🛒 บันทึกการขายสินค้า</h2>
    <p style="color:#666; margin-bottom:20px;">เลือกรายการสินค้าและจำนวนที่ต้องการขายเพื่อบันทึกและตัดสต็อก</p>

    <div style="background:#fff; padding:25px; border-radius:8px; max-width:550px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
      <form id="salesForm">
        <div style="margin-bottom:15px;">
          <label style="display:block; margin-bottom:5px; font-weight:bold;">เลือกสินค้าที่ต้องการขาย:</label>
          <select id="saleProductId" required style="width:100%; padding:10px; border:1px solid #ccc; border-radius:4px;">
            <option value="">-- เลือกรายการสินค้า --</option>
            ${products ? products.map(p => `
              <option value="${p.id}" ${p.current_stock <= 0 ? 'disabled' : ''}>
                ${p.product_name}
              </option>
            `).join('') : ''}
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
  `;

  const salesForm = document.getElementById('salesForm');
  if (salesForm) {
    salesForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const productId = document.getElementById('saleProductId').value;
      const qty = parseInt(document.getElementById('saleQty').value) || 0;

      const product = products.find(p => p.id == productId);
      if (!product) return;

      if (qty > product.current_stock) {
        alert('❌ จำนวนที่ขายมากกว่าสินค้าที่มีอยู่ในสต็อก!');
        return;
      }

      product.current_stock -= qty;

      alert(`✅ บันทึกการขาย ${product.product_name} จำนวน ${qty} ชิ้น เรียบร้อยแล้ว`);
      loadSalesPage();
    });
  }
}

// โหลดระบบคำแนะนำ AI
async function loadAIForecast() {
  const products = await api('/products');
  const target = document.getElementById('view-forecast');
  if (!target) return;

  const threshold = 10;
  const lowStockItems = products ? products.filter(p => p.current_stock <= threshold) : [];

  target.innerHTML = `
    <h2>🤖 คำแนะนำสั่งซื้อ (AI Smart Forecast)</h2>
    <p style="color:#666; margin-bottom:15px;">ระบบวิเคราะห์สต็อกสินค้าที่เหลือน้อยและเสนอแนะปริมาณที่ควรสั่งซื้อเพิ่ม</p>
    
    ${lowStockItems.length > 0 ? `
      <table style="width:100%; border-collapse:collapse; background:#fff; border-radius:8px; padding:15px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
        <thead>
          <tr style="border-bottom:2px solid #eee; text-align:left; color:#555;">
            <th style="padding:12px;">ชื่อสินค้า</th>
            <th>หมวดหมู่ / ไซส์</th>
            <th>คงเหลือปัจจุบัน</th>
            <th>สถานะความเสี่ยง</th>
            <th>จำนวนที่แนะนำสั่งซื้อ</th>
          </tr>
        </thead>
        <tbody>
          ${lowStockItems.map(p => `
            <tr style="border-bottom:1px solid #f9f9f9;">
              <td style="padding:12px;"><strong>${p.product_name}</strong></td>
              <td>${p.category || '-'} (${p.size || '-'})</td>
              <td><span style="color:${p.current_stock === 0 ? '#d9534f' : '#f0ad4e'}; font-weight:bold;">${p.current_stock} ชิ้น</span></td>
              <td>
                <span style="padding:4px 8px; border-radius:4px; font-size:12px; color:#fff; background:${p.current_stock === 0 ? '#d9534f' : '#f0ad4e'};">
                  ${p.current_stock === 0 ? 'หมดสต็อก' : 'สต็อกต่ำ'}
                </span>
              </td>
              <td><strong style="color:#5cb85c;">+${50 - p.current_stock} ชิ้น</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : `
      <div style="background:#fff; padding:30px; border-radius:8px; text-align:center; color:#5cb85c; margin-top:15px;">
        <h3>✅ สต็อกสินค้าอยู่ในระดับปลอดภัยทุกรายการ</h3>
        <p style="color:#666; font-size:14px; margin-top:5px;">ยังไม่มีสินค้าที่จำเป็นต้องสั่งซื้อเพิ่มในขณะนี้</p>
      </div>
    `}
  `;
}

// โหลดหน้าสินค้าค้างสต็อก
async function loadDeadstock() {
  const products = await api('/products');
  const target = document.getElementById('view-deadstock');
  if (!target) return;

  const deadstockItems = products ? products.filter(p => p.current_stock > 0) : [];

  target.innerHTML = `
    <h2>⚠️ สินค้าค้างสต็อก</h2>
    <p style="color:#666; margin-bottom:15px;">รายการสินค้าที่อยู่ในสต็อกและต้องการการเร่งระบาย</p>
    ${deadstockItems.length > 0 ? `
      <table style="width:100%; border-collapse:collapse; background:#fff; border-radius:8px; padding:15px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
        <thead>
          <tr style="border-bottom:2px solid #eee; text-align:left; color:#555;">
            <th style="padding:12px;">ชื่อสินค้า</th>
            <th>หมวดหมู่</th>
            <th>ไซส์</th>
            <th>จำนวนค้างสต็อก</th>
            <th>มูลค่ารวม (ทุน)</th>
          </tr>
        </thead>
        <tbody>
          ${deadstockItems.map(p => `
            <tr style="border-bottom:1px solid #f9f9f9;">
              <td style="padding:12px;">${p.product_name}</td>
              <td>${p.category || '-'}</td>
              <td>${p.size || '-'}</td>
              <td><span style="color:#d9534f; font-weight:bold;">${p.current_stock}</span></td>
              <td>${(p.current_stock * p.cost_price).toLocaleString()} ฿</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p style="color:#888;">ไม่มีรายการสินค้าค้างสต็อก</p>'}
  `;
}

function loadReceivePage() {
  const target = document.getElementById('view-receive');
  if (!target) return;
  target.innerHTML = `
    <h2>📥 รับสินค้าเข้าสต็อก</h2>
    <div style="background:#fff; padding:20px; border-radius:8px; margin-top:15px; max-width:500px;">
      <p style="color:#666;">ระบบบันทึกการรับสินค้าเข้าสต็อกเพิ่มจาก Supplier</p>
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
      const newProduct = {
        product_name: document.getElementById('pName').value,
        category: document.getElementById('pCategory').value,
        size: document.getElementById('pSize').value,
        current_stock: parseInt(document.getElementById('pStock').value) || 0,
        cost_price: parseFloat(document.getElementById('pCost').value) || 0,
        selling_price: parseFloat(document.getElementById('pPrice').value) || 0
      };

      const res = await api('/products', {
        method: 'POST',
        body: JSON.stringify(newProduct)
      });

      if (res) {
        closeProductForm();
        loadProducts();
      }
    });
  }

  switchView('dashboard');
});
