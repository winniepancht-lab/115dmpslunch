// 這是部署在 Google Apps Script (GAS) 上的後端程式碼參考
function doPost(e) {
  // 處理跨域與資料寫入試算表的邏輯
  return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  // 處理排班表讀取等 GET 請求
  return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
    .setMimeType(ContentService.MimeType.JSON);
}
