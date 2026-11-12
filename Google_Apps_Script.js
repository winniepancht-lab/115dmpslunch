// === Google Apps Script 程式碼 ===
// 請將這段程式碼貼到 Google 試算表的 Apps Script 編輯器中

function doPost(e) {
  try {
    // 取得第一張工作表
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    
    // 寫入新的一列資料 (對應表單傳來的 parameter)
    sheet.appendRow([
      e.parameter.date, 
      e.parameter.classId, 
      e.parameter.menu, 
      e.parameter.feedback, 
      e.parameter.photoUrl, 
      e.parameter.reply
    ]);
    
    // 回傳成功 JSON
    return ContentService.createTextOutput(JSON.stringify({"status": "success", "message": "新增成功"}))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch(error) {
    // 回傳錯誤 JSON
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": error.toString()}))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}
