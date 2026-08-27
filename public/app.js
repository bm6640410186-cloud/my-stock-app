// ฟังก์ชันสร้าง Matrix Grid View สำหรับ กระโปรง/กางเกง/เสื้อ (ปรับปรุง RegEx ให้ดึงไซส์ได้ยืดหยุ่นขึ้น)
function renderMatrixGrid() {
  if (!globalProducts || globalProducts.length === 0) {
    return `<div style="background:#fff; padding:20px; border-radius:8px; text-align:center; color:#888;">ไม่พบข้อมูลสินค้าสำหรับแสดงผลเมทริกซ์</div>`;
  }

  // จัดกลุ่มสินค้าตามชื่อรุ่น/ทรง
  const groups = {};
  globalProducts.forEach(p => {
    const name = getPName(p);
    
    // ดึงเฉพาะชื่อทรงหลัก (ตัดวงเล็บรายละเอียดออก)
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
    const waists = new Set();
    const lengths = new Set();
    const matrix = {}; // matrix[length][waist] = stock

    items.forEach(item => {
      const name = getPName(item);
      
      // RegEx ยืดหยุ่น: ดึงตัวเลขหลังคำว่า เอว / ยาว / ไซส์ (รองรับทั้ง นิ้ว, ", หรือเว้นวรรค)
      const waistMatch = name.match(/(?:เอว|รอบอก|ไซส์)\s*[:\s]*(\d+|[a-zA-Z]+)/i);
      const lengthMatch = name.match(/(?:ยาว)\s*[:\s]*(\d+)/i);

      let wKey = waistMatch ? waistMatch[1] : null;
      let lKey = lengthMatch ? lengthMatch[1] : 'มาตรฐาน/ฟรีไซส์';

      if (wKey) {
        waists.add(wKey);
        lengths.add(lKey);

        if (!matrix[lKey]) matrix[lKey] = {};
        matrix[lKey][wKey] = (matrix[lKey][wKey] || 0) + getPStock(item);
      }
    });

    // เรียงลำดับตัวเลข
    const sortedWaists = Array.from(waists).sort((a, b) => {
      return (isNaN(a) || isNaN(b)) ? a.localeCompare(b) : Number(a) - Number(b);
    });
    const sortedLengths = Array.from(lengths).sort((a, b) => {
      return (isNaN(a) || isNaN(b)) ? a.localeCompare(b) : Number(a) - Number(b);
    });

    if (sortedWaists.length === 0) continue;

    const isShirtGroup = groupTitle.includes('เสื้อ');

    html += `
      <div class="matrix-group-block" style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05); margin-bottom:20px;">
        <h3 style="margin-top:0; color:#2c3e50;">📌 ${groupTitle}</h3>
        <div style="overflow-x:auto;">
          <table class="matrix-table">
            <thead>
              <tr>
                <th style="background:#eef6ff;">${isShirtGroup ? 'ประเภท' : 'ความยาว \\ เอว'}</th>
                ${sortedWaists.map(w => `<th>${isShirtGroup ? 'ไซส์ ' + w : 'เอว ' + w + '"'}</th>`).join('')}
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
