// โหลดหน้า สินค้าค้างสต็อก (Deadstock Analytics) - ปรับปรุงแก้ไขให้รองรับทั้ง API และข้อมูลในเครื่อง
async function loadDeadstock() {
  const target = document.getElementById('view-deadstock');
  if (!target) return;

  // 1. ดึงข้อมูลจาก API เสมอ เพื่อให้ได้ข้อมูลล่าสุดจริงจากฐานข้อมูล
  try {
    const products = await api('/products');
    if (products && Array.isArray(products) && products.length > 0) {
      globalProducts = products;
    }
  } catch (err) {
    console.error('ไม่สามารถดึงข้อมูลสินค้าจาก API ได้ ใช้ข้อมูล local แทน:', err);
  }

  // 2. กรองสินค้าค้างสต็อก (แปลงค่า current_stock เป็น Number เพื่อป้องกันปัญหาข้อมูลเป็น Text)
  const deadstockThreshold = 50; // กำหนดเกณฑ์สินค้าค้างเยอะ (>= 50 ชิ้น)
  const highStockItems = globalProducts.filter(p => Number(p.current_stock || 0) >= deadstockThreshold);

  // 3. แสดงผลตารางสินค้าค้างสต็อก
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
              <th>ไซส์ / ขนาด / รายละเอียด</th>
              <th>จำนวนค้างสต็อก</th>
              <th>มูลค่าเงินจมทุน (฿)</th>
            </tr>
          </thead>
          <tbody>
            ${highStockItems.map(p => {
              const stock = Number(p.current_stock || 0);
              const cost = Number(p.cost_price || p.price || 0);
              const totalCapital = stock * cost;

              return `
                <tr style="border-bottom:1px solid #f9f9f9;">
                  <td style="padding:10px;"><strong>${p.product_name || p.name || '-'}</strong></td>
                  <td>${p.category || '-'}</td>
                  <td>${p.size || p.detail || '-'}</td>
                  <td><strong style="color:#dc3545;">${stock} ชิ้น</strong></td>
                  <td><strong>${totalCapital.toLocaleString()} ฿</strong></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      ` : `
        <div style="text-align:center; padding:30px; color:#888;">
          <p style="font-size:16px; margin:0;">ไม่พบรายการสินค้าค้างสต็อก (ที่มีสต็อกตั้งแต่ ${deadstockThreshold} ชิ้นขึ้นไป)</p>
          <small>หากมีสินค้าสต็อกเยอะแต่ไม่แสดงผล กรุณาตรวจสอบว่าจำนวนสต็อกในระบบมีถึง ${deadstockThreshold} ชิ้นหรือไม่</small>
        </div>
      `}
    </div>
  `;
}
