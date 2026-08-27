function getStoredProducts() {
  const saved = localStorage.getItem('stock_app_products');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Error parsing local products", e);
    }
  }
  return [
    { id: "1", name: "พลีทจีบเล็ก (เอว 25\" ยาว 18\")", category: "กระโปรงนักศึกษา", stock: 50, cost: 150, price: 200 },
    { id: "2", name: "เอผ่าหลัง (เอว 26\" ยาว 16\")", category: "กระโปรงนักศึกษา", stock: 15, cost: 160, price: 210 },
    { id: "3", name: "เสื้อนักศึกษาชาย แขนสั้น [ไม่มีสาบหลัง] (ขาวโอโม่) ไซส์ M", category: "เสื้อนักศึกษา", stock: 12, cost: 160, price: 220 },
    { id: "4", name: "กางเกงนักศึกษา (เอว 30\" ยาว 40\")", category: "กางเกงนักศึกษา", stock: 20, cost: 220, price: 320 },
    { id: "5", name: "พลีทจีบเล็ก (เอว 24\" ยาว 16\")", category: "กระโปรงนักศึกษา", stock: 8, cost: 150, price: 200 },
    { id: "6", name: "พลีทจีบเล็ก (เอว 26\" ยาว 18\")", category: "กระโปรงนักศึกษา", stock: 0, cost: 150, price: 200 }
  ];
}

function saveProductsToStorage(products) {
  localStorage.setItem('stock_app_products', JSON.stringify(products));
}

let mockProducts = getStoredProducts();
let globalProducts = [];
let deadstockViewMode = 'deadstock'; // 'deadstock' | 'all_cost'
let deadstockCategoryFilter = 'all';  // 'all' | 'เสื้อนักศึกษาชาย' | 'เสื้อนักศึกษาหญิง' | 'กระโปรงนักศึกษา' | 'กางเกงนักศึกษา'
let productDisplayMode = 'normal';
let pieChartInstance = null;

async function api(endpoint, options = {}) {
  try {
    const res = await fetch(endpoint, options);
    if (!res.ok) return handleLocalFallback(endpoint, options);
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
      saveProductsToStorage(mockProducts);
      return newProduct;
    } else if (method === 'PUT' || method === 'PATCH') {
      const body = JSON.parse(options.body || '{}');
      const prod = mockProducts.find(p => String(p.id) === String(prodId));
      if (prod) {
        if (body.stock !== undefined) prod.stock = Number(body.stock);
        if (body.cost !== undefined) prod.cost = Number(body.cost);
        if (body.price !== undefined) prod.price = Number(body.price);
        saveProductsToStorage(mockProducts);
        return prod;
      }
    } else if (method === 'DELETE') {
      mockProducts = mockProducts.filter(p => String(p.id) !== String(prodId));
      saveProductsToStorage(mockProducts);
      return { success: true };
    }
  }
  return [];
}

document.addEventListener('DOMContentLoaded', () => {
  const navItems = document.querySelectorAll('.sidebar .nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const viewName = item.getAttribute('data-view');
      switchView(viewName);
    });
  });

  const categorySelect = document.getElementById('pCategory');
  if (categorySelect) categorySelect.addEventListener('change', toggleCategoryFields);

  const productForm = document.getElementById('productForm');
  if (productForm) productForm.addEventListener('submit', handleProductSubmit);

  switchView('dashboard');
});

function switchView(viewName) {
  document.querySelectorAll('.sidebar .nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('data-view') === viewName) item.classList.add('active');
  });

  document.querySelectorAll('.main-content .view').forEach(view => {
    view.style.display = 'none';
  });

  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) targetView.style.display = 'block';

  if (viewName === 'dashboard') loadDashboard();
  else if (viewName === 'products') loadProducts();
  else if (viewName === 'deadstock') loadDeadstock();
  else if (viewName === 'ai-analytics') loadAIAnalyticsPage();
}

function getPName(p) { return p.name || p.product_name || `${p.category || ''}`; }
function getPStock(p) { return Number(p.stock ?? p.current_stock ?? 0); }
function getPCost(p) { return Number(p.cost ?? p.cost_price ?? 0); }
function getPPrice(p) { return Number(p.price ?? p.selling_price ?? 0); }

function filterProducts() {
  const input = document.getElementById('searchInput');
  if (!input) return;
  const keyword = input.value.toLowerCase().trim();

  if (productDisplayMode === 'normal') {
    const rows = document.querySelectorAll('#productsTableWrap table tbody tr');
    rows.forEach(row => {
      const text = row.innerText.toLowerCase();
      row.style.display = text.includes(keyword) ? '' : 'none';
    });
  } else {
    const blocks = document.querySelectorAll('#productsTableWrap .matrix-group-block');
    blocks.forEach(block => {
      const text = block.innerText.toLowerCase();
      block.style.display = text.includes(keyword) ? '' : 'none';
    });
  }
}

// 1. หน้าแดชบอร์ด
async function loadDashboard() {
  const target = document.getElementById('view-dashboard');
  if (!target) return;

  const products = await api('/products');
  if (products && Array.isArray(products)) globalProducts = products;

  const totalItems = globalProducts.reduce((sum, p) => sum + getPStock(p), 0);
  const totalValue = globalProducts.reduce((sum, p) => sum + (getPStock(p) * getPCost(p)), 0);
  const lowStockItems = globalProducts.filter(p => getPStock(p) <= 10);
  const deadstockItems = globalProducts.filter(p => getPStock(p) >= 50);

  const categoryCapital = {};
  globalProducts.forEach(p => {
    let groupKey = p.category || 'อื่นๆ';
    const name = getPName(p);
    
    if (p.category === 'กระโปรงนักศึกษา') {
      if (name.includes('กระโปรงเอวขอบ')) groupKey = 'กระโปรงเอวขอบ';
      else if (name.includes('พลีทจีบรอบ')) groupKey = 'พลีทจีบรอบ';
      else if (name.includes('พลีทจีบเล็ก')) groupKey = 'พลีทจีบเล็ก';
      else if (name.includes('เอผ่าหน้า')) groupKey = 'กระโปรงเอผ่าหน้า';
      else if (name.includes('เอผ่าหลัง')) groupKey = 'กระโปรงเอผ่าหลัง';
      else if (name.includes('เอไม่ผ่า')) groupKey = 'กระโปรงเอไม่ผ่า';
    }

    const cap = getPStock(p) * getPCost(p);
    categoryCapital[groupKey] = (categoryCapital[groupKey] || 0) + cap;
  });

  const chartLabels = Object.keys(categoryCapital);
  const chartData = Object.values(categoryCapital);

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
        <span style="color:#888; font-size:14px;">มูลค่าต้นทุนสินค้าในสต็อกรวม</span>
        <h2 style="margin:10px 0 0 0; color:#333;">${totalValue.toLocaleString()} <span style="font-size:16px; font-weight:normal;">บาท</span></h2>
      </div>
    </div>

    <div style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05); margin-bottom:25px;">
      <h3 style="margin-top:0; color:#2c3e50;">🥧 สัดส่วนเงินจมในสต็อก แยกตามหมวดหมู่ (Capital Allocation Pie Chart)</h3>
      <div style="display:flex; align-items:center; justify-content:center; max-height:300px;">
        <canvas id="capitalPieChart" style="max-height: 280px;"></canvas>
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
              <strong style="color:#856404;">🔥 ควรรีบเคลียร์สต็อก:</strong><br>
              ${deadstockItems.slice(0, 2).map(p => `• ${getPName(p)} (ค้างสต็อก <strong>${getPStock(p)}</strong> ตัว - ควรรีบเคลียร์ <strong>${getPStock(p) - 30}</strong> ตัว)`).join('<br>')}
            </div>
          ` : ''}

          ${lowStockItems.length === 0 && deadstockItems.length === 0 ? '<p style="color:#28a745;">✅ สต็อกอยู่ในระดับสมดุล สมบูรณ์ดี</p>' : ''}
        </div>
        <button onclick="switchView('ai-analytics')" style="background:#6f42c1; color:#fff; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; margin-top:15px;">ดูรายงาน AI แบบรายละเอียด</button>
      </div>
    </div>
  `;

  setTimeout(() => {
    const ctx = document.getElementById('capitalPieChart');
    if (ctx && typeof Chart !== 'undefined') {
      if (pieChartInstance) pieChartInstance.destroy();
      pieChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: chartLabels,
          datasets: [{
            data: chartData,
            backgroundColor: [
              '#ff6384', '#36a2eb', '#cc65fe', '#ffce56', 
              '#4bc0c0', '#9966ff', '#ff9f40', '#e74c3c'
            ]
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const val = context.raw || 0;
                  const percent = totalValue > 0 ? ((val / totalValue) * 100).toFixed(1) : 0;
                  return ` ${context.label}: ${val.toLocaleString()} บาท (${percent}%)`;
                }
              }
            }
          }
        }
      });
    }
  }, 100);
}

function switchProductView(mode) {
  productDisplayMode = mode;
  document.getElementById('btnViewNormal').style.background = mode === 'normal' ? '#3498db' : '#e0e0e0';
  document.getElementById('btnViewNormal').style.color = mode === 'normal' ? 'white' : '#333';
  document.getElementById('btnViewMatrix').style.background = mode === 'matrix' ? '#3498db' : '#e0e0e0';
  document.getElementById('btnViewMatrix').style.color = mode === 'matrix' ? 'white' : '#333';
  loadProducts();
}

// 2. หน้าสินค้าและสต็อก
async function loadProducts() {
  const tableWrap = document.getElementById('productsTableWrap');
  if (!tableWrap) return;

  const products = await api('/products');
  if (products && Array.isArray(products)) globalProducts = products;

  const totalStockCost = globalProducts.reduce((sum, p) => sum + (getPStock(p) * getPCost(p)), 0);

  let contentHtml = `
    <div style="background:#eef6ff; border-left:5px solid #007bff; padding:15px 20px; border-radius:8px; margin-top:15px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <span style="color:#555; font-size:14px; font-weight:bold;">💰 รวมราคาทุนสินค้าทั้งหมดในสต็อก (Total Capital Value):</span>
      </div>
      <div>
        <span style="color:#007bff; font-size:24px; font-weight:bold;">${totalStockCost.toLocaleString()} ฿</span>
      </div>
    </div>
  `;

  if (productDisplayMode === 'normal') {
    contentHtml += `
      <div style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:2px solid #eee; text-align:left; color:#555;">
              <th style="padding:10px;">หมวดหมู่</th>
              <th>ชื่อ / รายละเอียดสินค้า</th>
              <th>คงเหลือ (ชิ้น)</th>
              <th>ราคาทุน (฿)</th>
              <th>ราคาขาย (฿)</th>
              <th>ราคาทุนรวม (฿)</th>
              <th style="text-align:center;">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${globalProducts.map(p => {
              const pId = String(p.id || p._id);
              const stock = getPStock(p);
              const cost = getPCost(p);
              const price = getPPrice(p);
              const totalCost = stock * cost;
              const safeName = getPName(p).replace(/'/g, "\\'").replace(/"/g, '&quot;');
              return `
                <tr style="border-bottom:1px solid #f9f9f9;">
                  <td style="padding:10px;">${p.category || '-'}</td>
                  <td><strong>${getPName(p)}</strong></td>
                  <td><span style="color:${stock > 10 ? '#28a745' : '#dc3545'}; font-weight:bold;">${stock}</span></td>
                  <td>${cost.toLocaleString()}</td>
                  <td><strong>${price.toLocaleString()}</strong></td>
                  <td style="color:#666;">${totalCost.toLocaleString()}</td>
                  <td style="text-align:center;">
                    <button onclick="editProductDetails('${pId}', ${stock}, ${cost}, ${price})" title="แก้ไขสินค้า" style="background:#ffc107; border:none; color:#333; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:13px; font-weight:bold; margin-right:5px;">✏️ แก้ไข</button>
                    <button onclick="removeProductItem('${pId}', '${safeName}')" title="ลบสินค้า" style="background:#dc3545; border:none; color:#fff; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:13px; font-weight:bold;">🗑️ ลบ</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else {
    contentHtml += renderMatrixGrid();
  }

  tableWrap.innerHTML = contentHtml;
  filterProducts();
}

// 3. ฟังก์ชัน Matrix Grid
function renderMatrixGrid() {
  if (!globalProducts || globalProducts.length === 0) {
    return `<div style="background:#fff; padding:20px; border-radius:8px; text-align:center; color:#888;">ไม่พบข้อมูลสินค้าสำหรับแสดงผลเมทริกซ์</div>`;
  }

  const groups = {};
  globalProducts.forEach(p => {
    const name = getPName(p);
    let styleName = p.category || 'อื่นๆ';

    if (name.includes('(')) {
      styleName = name.split('(')[0].trim();
    } else if (name.includes('[')) {
      styleName = name.split('[')[0].trim();
    }

    if (!groups[styleName]) groups[styleName] = [];
    groups[styleName].push(p);
  });

  let html = '';

  for (const [groupTitle, items] of Object.entries(groups)) {
    const isShirtGroup = groupTitle.includes('เสื้อ');

    if (isShirtGroup) {
      const shirtSizes = {};
      items.forEach(p => {
        const name = getPName(p);
        const match = name.match(/(?:ไซส์|ขนาด|รอบอก)\s*[:\s]*([a-zA-Z0-9]+)/i);
        const sizeKey = match ? match[1].toUpperCase() : 'FREE';
        shirtSizes[sizeKey] = (shirtSizes[sizeKey] || 0) + getPStock(p);
      });

      const sortedSizes = Object.keys(shirtSizes).sort((a, b) => {
        const order = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
        const idxA = order.indexOf(a);
        const idxB = order.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        return a.localeCompare(b);
      });

      html += `
        <div class="matrix-group-block" style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05); margin-bottom:20px;">
          <h3 style="margin-top:0; color:#2c3e50;">📌 ${groupTitle}</h3>
          <div style="overflow-x:auto;">
            <table class="matrix-table" style="width:100%; text-align:center;">
              <thead>
                <tr>
                  ${sortedSizes.map(size => `<th style="background:#eef6ff; font-weight:bold; padding:10px;">ไซส์ ${size}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                <tr>
                  ${sortedSizes.map(size => {
                    const stock = shirtSizes[size];
                    const colorStyle = stock === 0 
                      ? 'background:#ffebee; color:#c62828;' 
                      : (stock <= 5 ? 'background:#fff8e1; color:#f57f17;' : 'background:#e8f5e9; color:#2e7d32;');
                    return `
                      <td style="padding:10px;">
                        <div class="matrix-cell-stock" style="${colorStyle} padding:8px; border-radius:6px; font-weight:bold;">
                          ${stock} ชิ้น
                        </div>
                      </td>
                    `;
                  }).join('')}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
      continue;
    }

    const waists = new Set();
    const lengths = new Set();
    const matrix = {};

    items.forEach(p => {
      const name = getPName(p);
      const waistMatch = name.match(/(?:เอว)\s*[:\s]*(\d+)/i);
      const lengthMatch = name.match(/(?:ยาว)\s*[:\s]*(\d+)/i);

      let wKey = waistMatch ? waistMatch[1] : null;
      let lKey = lengthMatch ? lengthMatch[1] : 'มาตรฐาน/ฟรีไซส์';

      if (wKey) {
        waists.add(wKey);
        lengths.add(lKey);

        if (!matrix[lKey]) matrix[lKey] = {};
        matrix[lKey][wKey] = (matrix[lKey][wKey] || 0) + getPStock(p);
      }
    });

    const sortedWaists = Array.from(waists).sort((a, b) => Number(a) - Number(b));
    const sortedLengths = Array.from(lengths).sort((a, b) => Number(a) - Number(b));

    if (sortedWaists.length === 0) continue;

    html += `
      <div class="matrix-group-block" style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05); margin-bottom:20px;">
        <h3 style="margin-top:0; color:#2c3e50;">📌 ${groupTitle}</h3>
        <div style="overflow-x:auto;">
          <table class="matrix-table">
            <thead>
              <tr>
                <th style="background:#eef6ff;">ความยาว \\ เอว</th>
                ${sortedWaists.map(w => `<th>เอว ${w}"</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${sortedLengths.map(l => `
                <tr>
                  <td style="font-weight:bold; background:#f8f9fa;">${l === 'มาตรฐาน/ฟรีไซส์' ? l : 'ยาว ' + l + '"'}</td>
                  ${sortedWaists.map(w => {
                    const stock = matrix[l] && matrix[l][w] !== undefined ? matrix[l][w] : null;
                    if (stock === null) return `<td class="matrix-cell-empty">-</td>`;
                    const colorStyle = stock === 0 
                      ? 'background:#ffebee; color:#c62828;' 
                      : (stock <= 5 ? 'background:#fff8e1; color:#f57f17;' : 'background:#e8f5e9; color:#2e7d32;');
                    return `
                      <td>
                        <div class="matrix-cell-stock" style="${colorStyle}">
                          ${stock} ชิ้น
                        </div>
                      </td>
                    `;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  return html || `<div style="background:#fff; padding:20px; border-radius:8px; text-align:center; color:#888;">ไม่พบข้อมูลไซส์ที่สามารถนำมาแสดงในเมทริกซ์ได้</div>`;
}

async function editProductDetails(id, currentStock, currentCost, currentPrice) {
  const newStockStr = prompt(`1. ระบุจำนวนสต็อกคงเหลือใหม่:`, currentStock);
  if (newStockStr === null) return;

  const newCostStr = prompt(`2. ระบุราคาทุน (บาท) ใหม่:`, currentCost);
  if (newCostStr === null) return;

  const newPriceStr = prompt(`3. ระบุราคาขาย (บาท) ใหม่:`, currentPrice);
  if (newPriceStr === null) return;

  const newStock = Number(newStockStr);
  const newCost = Number(newCostStr);
  const newPrice = Number(newPriceStr);

  if (isNaN(newStock) || newStock < 0 || isNaN(newCost) || newCost < 0 || isNaN(newPrice) || newPrice < 0) {
    alert('กรุณากรอกข้อมูลตัวเลขให้ถูกต้อง');
    return;
  }

  await api(`/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stock: newStock, cost: newCost, price: newPrice })
  });

  const itemIndex = mockProducts.findIndex(p => String(p.id) === String(id));
  if (itemIndex !== -1) {
    mockProducts[itemIndex].stock = newStock;
    mockProducts[itemIndex].cost = newCost;
    mockProducts[itemIndex].price = newPrice;
    saveProductsToStorage(mockProducts);
  }

  alert('อัปเดตข้อมูลสินค้าเรียบร้อยแล้ว!');
  loadProducts();
}

async function removeProductItem(id, name) {
  if (confirm(`คุณต้องการลบสินค้า "${name}" ออกจากระบบใช่หรือไม่?`)) {
    await api(`/products/${id}`, { method: 'DELETE' });
    mockProducts = mockProducts.filter(p => String(p.id) !== String(id));
    globalProducts = globalProducts.filter(p => String(p.id || p._id) !== String(id));
    saveProductsToStorage(mockProducts);
    alert('ลบสินค้าเรียบร้อยแล้ว!');
    loadProducts();
  }
}

// 4. หน้าวิเคราะห์ต้นทุนสินค้า & สินค้าค้างสต็อก (เพิ่ม Filter คลิกหมวดหมู่ประเภทสินค้า)
async function loadDeadstock() {
  const target = document.getElementById('view-deadstock');
  if (!target) return;

  const products = await api('/products');
  if (products && Array.isArray(products)) globalProducts = products;

  // ฟังก์ชันตัวกรองหมวดหมู่สินค้า
  const filterByCategory = (pList) => {
    if (deadstockCategoryFilter === 'all') return pList;
    return pList.filter(p => {
      const name = getPName(p);
      const cat = p.category || '';
      
      if (deadstockCategoryFilter === 'เสื้อนักศึกษาชาย') {
        return cat === 'เสื้อนักศึกษา' && (name.includes('ชาย') || name.includes('เสื้อชาย'));
      }
      if (deadstockCategoryFilter === 'เสื้อนักศึกษาหญิง') {
        return cat === 'เสื้อนักศึกษา' && (name.includes('หญิง') || name.includes('เสื้อหญิง'));
      }
      if (deadstockCategoryFilter === 'กระโปรงนักศึกษา') {
        return cat === 'กระโปรงนักศึกษา';
      }
      if (deadstockCategoryFilter === 'กางเกงนักศึกษา') {
        return cat === 'กางเกงนักศึกษา';
      }
      return true;
    });
  };

  const filteredBaseProducts = filterByCategory(globalProducts);
  const highStockItems = filteredBaseProducts.filter(p => getPStock(p) >= 50);

  const deadstockCapital = highStockItems.reduce((sum, p) => sum + (getPStock(p) * getPCost(p)), 0);
  const totalAllCapital = filteredBaseProducts.reduce((sum, p) => sum + (getPStock(p) * getPCost(p)), 0);

  const displayList = deadstockViewMode === 'deadstock' ? highStockItems : filteredBaseProducts;

  const categoriesTab = [
    { id: 'all', label: 'ทั้งหมด' },
    { id: 'เสื้อนักศึกษาชาย', label: '👔 เสื้อนักศึกษาชาย' },
    { id: 'เสื้อนักศึกษาหญิง', label: '👚 เสื้อนักศึกษาหญิง' },
    { id: 'กระโปรงนักศึกษา', label: '👗 กระโปรงนักศึกษา' },
    { id: 'กางเกงนักศึกษา', label: '👖 กางเกงนักศึกษา' }
  ];

  target.innerHTML = `
    <h2>⚠️ วิเคราะห์ต้นทุนสินค้า & สินค้าค้างสต็อก</h2>
    <p style="color:#666; margin-bottom:20px;">ตรวจสอบต้นทุนจมและมูลค่าเงินทุนสินค้าคงเหลือทั้งหมด</p>

    <!-- ปุ่มแท็บกรองประเภทสินค้า -->
    <div style="display:flex; gap:10px; margin-bottom:15px; flex-wrap:wrap;">
      ${categoriesTab.map(tab => {
        const isActive = deadstockCategoryFilter === tab.id;
        return `
          <button onclick="switchDeadstockCategoryFilter('${tab.id}')" style="padding:8px 16px; border-radius:20px; border:1px solid ${isActive ? '#007bff' : '#ccc'}; cursor:pointer; font-weight:bold; font-size:14px; transition:all 0.2s; ${isActive ? 'background:#007bff; color:#fff; box-shadow:0 2px 5px rgba(0,123,255,0.3);' : 'background:#fff; color:#555;'}">
            ${tab.label}
          </button>
        `;
      }).join('')}
    </div>

    <!-- ปุ่มสลับดูเฉพาะ Deadstock หรือ ทุนทั้งหมด -->
    <div style="display:flex; gap:10px; margin-bottom:20px;">
      <button onclick="switchDeadstockMode('deadstock')" style="padding:10px 20px; border-radius:6px; border:none; cursor:pointer; font-weight:bold; ${deadstockViewMode === 'deadstock' ? 'background:#dc3545; color:#fff;' : 'background:#e0e0e0; color:#333;'}">
        🔥 ดูเฉพาะสินค้าค้างสต็อก (≥ 50 ชิ้น)
      </button>
      <button onclick="switchDeadstockMode('all_cost')" style="padding:10px 20px; border-radius:6px; border:none; cursor:pointer; font-weight:bold; ${deadstockViewMode === 'all_cost' ? 'background:#007bff; color:#fff;' : 'background:#e0e0e0; color:#333;'}">
        💼 ดูต้นทุนสินค้าทั้งหมดในระบบ
      </button>
    </div>

    <div style="display:flex; gap:20px; margin-bottom:25px;">
      <div style="flex:1; border-left:5px solid #dc3545; background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
        <span style="color:#666; font-size:14px;">เงินจมสินค้าค้างสต็อก (≥ 50 ชิ้น)</span>
        <h2 style="margin:5px 0 0 0; color:#dc3545; font-size:24px;">${deadstockCapital.toLocaleString()} บาท</h2>
        <small style="color:#888;">จำนวน ${highStockItems.length} รายการ</small>
      </div>
      <div style="flex:1; border-left:5px solid #007bff; background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
        <span style="color:#666; font-size:14px;">รวมเงินต้นทุนสินค้าทั้งหมดในระบบ</span>
        <h2 style="margin:5px 0 0 0; color:#007bff; font-size:24px;">${totalAllCapital.toLocaleString()} บาท</h2>
        <small style="color:#888;">จำนวน ${filteredBaseProducts.length} รายการ</small>
      </div>
    </div>

    <div style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
      <h3 style="margin-top:0; color:#333;">
        ${deadstockViewMode === 'deadstock' ? '📦 รายการสินค้าค้างสต็อกเกินกำหนด' : '📋 รายการและมูลค่าต้นทุนสินค้าทั้งหมด'}
        ${deadstockCategoryFilter !== 'all' ? `<span style="font-size:14px; color:#007bff; font-weight:normal;"> (${deadstockCategoryFilter})</span>` : ''}
      </h3>
      ${displayList.length > 0 ? `
        <table style="width:100%; border-collapse:collapse; margin-top:15px;">
          <thead>
            <tr style="border-bottom:2px solid #eee; text-align:left; color:#555;">
              <th style="padding:10px;">ชื่อสินค้า</th>
              <th>หมวดหมู่</th>
              <th>จำนวนคงเหลือ (ชิ้น)</th>
              <th>ทุน/หน่วย (บาท)</th>
              <th>รวมต้นทุน (บาท)</th>
              <th>สถานะสต็อก</th>
            </tr>
          </thead>
          <tbody>
            ${displayList.map(p => {
              const stock = getPStock(p);
              const cost = getPCost(p);
              const totalCost = stock * cost;
              let badge = '<span style="background:#d4edda; color:#155724; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:bold;">🟢 สต็อกปกติ</span>';
              if (stock <= 10) badge = '<span style="background:#f8d7da; color:#721c24; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:bold;">🔴 สต็อกเหลือน้อย</span>';
              else if (stock >= 50) badge = '<span style="background:#fff3cd; color:#856404; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:bold;">🟡 ค้างสต็อก</span>';

              return `
                <tr style="border-bottom:1px solid #f9f9f9;">
                  <td style="padding:10px;"><strong>${getPName(p)}</strong></td>
                  <td>${p.category || '-'}</td>
                  <td><strong>${stock}</strong></td>
                  <td>${cost.toLocaleString()} ฿</td>
                  <td><strong style="color:#dc3545;">${totalCost.toLocaleString()} ฿</strong></td>
                  <td>${badge}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      ` : '<p style="color:#888;">ไม่พบรายการสินค้าในประเภทที่เลือก</p>'}
    </div>
  `;
}

function switchDeadstockCategoryFilter(catId) {
  deadstockCategoryFilter = catId;
  loadDeadstock();
}

function switchDeadstockMode(mode) {
  deadstockViewMode = mode;
  loadDeadstock();
}

// 5. หน้า AI Analytics
async function loadAIAnalyticsPage() {
  const target = document.getElementById('view-ai-analytics');
  if (!target) return;

  const products = await api('/products');
  if (products && Array.isArray(products)) globalProducts = products;

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
  const pants = document.getElementById('pantsFields');
  const shirt = document.getElementById('shirtFields');
  const gName = document.getElementById('generalNameField');
  const gSize = document.getElementById('generalSizeField');

  if (cat === 'กระโปรงนักศึกษา') {
    if (skirt) skirt.style.display = 'block';
    if (pants) pants.style.display = 'none';
    if (shirt) shirt.style.display = 'none';
    if (gName) gName.style.display = 'none';
    if (gSize) gSize.style.display = 'none';
  } else if (cat === 'กางเกงนักศึกษา') {
    if (skirt) skirt.style.display = 'none';
    if (pants) pants.style.display = 'block';
    if (shirt) shirt.style.display = 'none';
    if (gName) gName.style.display = 'none';
    if (gSize) gSize.style.display = 'none';
  } else if (cat === 'เสื้อนักศึกษา') {
    if (skirt) skirt.style.display = 'none';
    if (pants) pants.style.display = 'none';
    if (shirt) shirt.style.display = 'block';
    if (gName) gName.style.display = 'none';
    if (gSize) gSize.style.display = 'none';
  } else {
    if (skirt) skirt.style.display = 'none';
    if (pants) pants.style.display = 'none';
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
    pName = `${style} (เอว ${waist}" ยาว ${length}")`;
  } else if (cat === 'กางเกงนักศึกษา') {
    const waist = document.getElementById('pPantsWaist').value;
    const length = document.getElementById('pPantsLength').value;
    pName = `กางเกงนักศึกษา (เอว ${waist}" ยาว ${length}")`;
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
