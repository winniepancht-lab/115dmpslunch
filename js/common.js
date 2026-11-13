// 共用函式庫
window.H = {
  // DOM 選擇器縮寫
  $: id => document.getElementById(id),

  // 安全地轉義 HTML 字串 (防 XSS)
  E: str => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // 標準化日期格式 (YYYY-MM-DD)
  norm: dateStr => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString().slice(0, 10);
  },

  // 從 Google Sheets 發布為 CSV 的網址中獲取資料並解析
  fetchCsv: async (url, hasHeader = true) => {
    if (!url) return [];
    try {
      const response = await fetch(url);
      const text = await response.text();
      return H.parseCsv(text, hasHeader);
    } catch (e) {
      console.error("CSV Fetch Error:", e);
      return [];
    }
  },

  // 簡易 CSV 解析器
  parseCsv: (text, hasHeader) => {
    const rows = [];
    const lines = text.split('\n');
    let headers = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // 簡單的 CSV 分隔，未處理欄位內含逗號的複雜情況 (如需請引入 Papaparse)
      const cols = line.split(','); 
      
      if (i === 0 && hasHeader) {
        headers = cols.map(c => c.trim().replace(/^"|"$/g, ''));
      } else {
        const rowData = {};
        cols.forEach((c, idx) => {
          const val = c.trim().replace(/^"|"$/g, '');
          if (hasHeader) {
            rowData[headers[idx] || `col${idx}`] = val;
          } else {
            rowData[idx] = val;
          }
        });
        rows.push(rowData);
      }
    }
    return rows;
  }
};
