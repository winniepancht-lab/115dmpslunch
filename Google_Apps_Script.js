// === 貼到「試算表 → 擴充功能 → Apps Script」，取代原本的程式碼 ===
// 第一次使用：專案設定 → 指令碼屬性 → 新增 KEY = 你們幹部共用的通關密語
// 部署：部署 → 新增部署作業 → 網頁應用程式（執行身分：我；存取：所有人）
// 之後改程式：部署 → 管理部署作業 → 編輯 → 版本選「新版本」（網址不會變）

const SHEET_LUNCH = '試菜';        // 找不到時使用第一個分頁
const SHEET_QA = '反映';           // 找不到會自動建立
const PHOTO_FOLDER = '東門試菜照片'; // 照片會存在你的雲端硬碟這個資料夾

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh && name === SHEET_LUNCH) return ss.getSheets()[0];
  if (!sh && name === SHEET_QA) {
    sh = ss.insertSheet(SHEET_QA);
    sh.appendRow(['日期', '標題', '反映摘要', '營養師回覆', '狀態', '公開']);
  }
  return sh;
}

function appendText_(sh, row) {
  const r = sh.getLastRow() + 1;
  sh.getRange(r, 1, 1, row.length).setNumberFormat('@').setValues([row]); // 以文字存入，避免日期被轉格式
}

function savePhotos_(photos, date) {
  if (!photos || !photos.length) return '';
  const it = DriveApp.getFoldersByName(PHOTO_FOLDER);
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER);
  return photos.map(function (b64, i) {
    const blob = Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', date + '-' + Date.now() + '-' + (i + 1) + '.jpg');
    const f = folder.createFile(blob);
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return 'https://drive.google.com/thumbnail?id=' + f.getId() + '&sz=w800';
  }).join(',');
}

function ds_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const m = String(v).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : String(v).trim();
}

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    const key = PropertiesService.getScriptProperties().getProperty('KEY');
    if (!key) return out_({ status: 'error', message: '尚未在指令碼屬性設定 KEY' });
    if (b.key !== key) return out_({ status: 'error', message: '密語不符（長度：你輸入 ' + String(b.key || '').length + '、系統 ' + key.length + '）' });

    if (b.type === 'qa') {
      appendText_(sheet_(SHEET_QA), [b.date, b.title, b.summary || '', b.reply || '', b.reply ? '已回覆' : '追蹤中', '']);
      return out_({ status: 'success' });
    }
    if (b.type === 'reply') {            // 幫「追蹤中」的反映補上營養師回覆
      const sh = sheet_(SHEET_QA), v = sh.getDataRange().getValues();
      for (let i = 1; i < v.length; i++) {
        if (ds_(v[i][0]) === ds_(b.date) && String(v[i][1]).trim() === String(b.title).trim()) {
          sh.getRange(i + 1, 4).setValue(b.reply);
          sh.getRange(i + 1, 5).setValue('已回覆');
          return out_({ status: 'success' });
        }
      }
      return out_({ status: 'error', message: '找不到這則反映' });
    }
    // 預設：每日試菜（照片會自動存到雲端硬碟）
    const photoUrls = savePhotos_(b.photos, b.date);
    appendText_(sheet_(SHEET_LUNCH), [b.date, b.classId || '', b.menu || '', b.feedback || '', photoUrls, b.reply || '', '']);
    return out_({ status: 'success', photos: photoUrls });
  } catch (err) {
    return out_({ status: 'error', message: String(err) });
  }
}
function doGet() {
  return out_({
    ok: true,
    keySet: !!PropertiesService.getScriptProperties().getProperty('KEY'),
    spreadsheet: SpreadsheetApp.getActiveSpreadsheet().getName(),
    sheets: SpreadsheetApp.getActiveSpreadsheet().getSheets().map(function (s) { return s.getName(); })
  });
}
function authorize2() {
  const it = DriveApp.getFoldersByName(PHOTO_FOLDER);
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER);
  const f = folder.createFile('test.txt', 'ok');
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  f.setTrashed(true);
  Logger.log('授權完成，資料夾：' + folder.getName());
}
