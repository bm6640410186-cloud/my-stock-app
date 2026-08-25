// โหลดหน้า บันทึกการขายสินค้า
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

  // ผูก Event ให้ฟอร์มขายสินค้า
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

      // ตัดสต็อกในสินค้าเดิม
      product.current_stock -= qty;

      alert(`✅ บันทึกการขาย ${product.product_name} จำนวน ${qty} ชิ้น เรียบร้อยแล้ว`);
      loadSalesPage();
    });
  }
}
