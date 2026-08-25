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

  if (viewName === 'products') loadProducts();
}

// ควบคุม Modal ฟอร์มสินค้า
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

  // Submit ฟอร์มสินค้า
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
