// === 貼到「試算表 → 擴充功能 → Apps Script」，取代原本的程式碼並儲存 ===
// 更新後：部署 → 管理部署作業 → 鉛筆圖示 → 版本選「新版本」→ 部署（網址與 config.js 都不用改）
// KEY（通關密語）已在「專案設定 → 指令碼屬性」設定過，不用重設。
// 新增的「排班」分頁只放日期與班級（沒有姓名），請不要把它發布到網路。

const SHEET_LUNCH = '試菜', SHEET_QA = '反映', SHEET_SCHED = '排班';
const PHOTO_FOLDER = '東門試菜照片';
const LUNCH_COLS = ['日期', '班級', '午餐菜色', '家代意見反饋', '照片連結', '營養師回應', '公開', '菜單圖片'];
const QA_COLS = ['日期', '標題', '反映摘要', '營養師回覆', '狀態', '公開', '照片連結'];

function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// 取得分頁；缺少的欄位會自動補在最後面（用欄位名稱對應，欄位順序不影響）
function sheet_(name, cols) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh && name === SHEET_LUNCH) sh = ss.getSheets()[0];
  if (!sh) sh = ss.insertSheet(name);
  const hs = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (s) { return String(s).trim(); }) : [];
  cols.forEach(function (c) { if (hs.indexOf(c) < 0) { sh.getRange(1, hs.length + 1).setValue(c); hs.push(c); } });
  return { sh: sh, hs: hs };
}

function appendObj_(s, obj) {
  const row = s.hs.map(function (h) { return obj[h] == null ? '' : obj[h]; });
  const r = s.sh.getLastRow() + 1;
  s.sh.getRange(r, 1, 1, row.length).setNumberFormat('@').setValues([row]); // 以文字存入，避免日期被轉格式
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

function checkKey_(k) {
  const key = PropertiesService.getScriptProperties().getProperty('KEY');
  if (!key) return '尚未在指令碼屬性設定 KEY';
  if (k !== key) return '密語不符（長度：你輸入 ' + String(k || '').length + '、系統 ' + key.length + '）';
  return '';
}

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    const bad = checkKey_(b.key);
    if (bad) return out_({ status: 'error', message: bad });

    if (b.type === 'qa') {
      appendObj_(sheet_(SHEET_QA, QA_COLS), {
        '日期': b.date, '標題': b.title, '反映摘要': b.summary || '', '營養師回覆': b.reply || '',
        '狀態': b.reply ? '已回覆' : '追蹤中', '照片連結': savePhotos_(b.photos, b.date)
      });
      return out_({ status: 'success' });
    }
    if (b.type === 'reply') {            // 幫「追蹤中」的反映補上營養師回覆（可附照片）
      const s = sheet_(SHEET_QA, QA_COLS), v = s.sh.getDataRange().getValues();
      const ci = function (n) { return s.hs.indexOf(n); };
      for (let i = 1; i < v.length; i++) {
        if (ds_(v[i][ci('日期')]) === ds_(b.date) && String(v[i][ci('標題')]).trim() === String(b.title).trim()) {
          s.sh.getRange(i + 1, ci('營養師回覆') + 1).setValue(b.reply);
          s.sh.getRange(i + 1, ci('狀態') + 1).setValue('已回覆');
          return out_({ status: 'success' });
        }
      }
      return out_({ status: 'error', message: '找不到這則反映' });
    }
    if (b.type === 'schedule') {         // 匯入排班（只有日期與班級）：整份取代
      const s = sheet_(SHEET_SCHED, ['日期', '班級', '身分']);
      if (s.sh.getLastRow() > 1) s.sh.getRange(2, 1, s.sh.getLastRow() - 1, s.sh.getLastColumn()).clearContent();
      if (b.rows && b.rows.length) s.sh.getRange(2, 1, b.rows.length, 3).setNumberFormat('@').setValues(b.rows);
      return out_({ status: 'success', count: (b.rows || []).length });
    }
    // 預設：每日試菜（照片、菜單圖片會自動存到雲端硬碟）
    appendObj_(sheet_(SHEET_LUNCH, LUNCH_COLS), {
      '日期': b.date, '班級': b.classId || '', '午餐菜色': b.menu || '', '家代意見反饋': b.feedback || '',
      '照片連結': savePhotos_(b.photos, b.date), '營養師回應': b.reply || '', '菜單圖片': savePhotos_(b.menuPhotos, b.date + '-menu')
    });
    return out_({ status: 'success' });
  } catch (err) {
    return out_({ status: 'error', message: String(err) });
  }
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'schedule') {         // 查某一天誰輪值（需密語；只回傳班級）
    const bad = checkKey_(p.key);
    if (bad) return out_({ status: 'error', message: bad });
    const ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(SHEET_SCHED);
    const rows = sh && sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues() : [];
    return out_({ status: 'success', rows: rows.filter(function (r) { return !p.date || ds_(r[0]) === p.date; }).map(function (r) { return [ds_(r[0]), String(r[1]), String(r[2])]; }) });
  }
  return out_({ ok: true, keySet: !!PropertiesService.getScriptProperties().getProperty('KEY'), spreadsheet: SpreadsheetApp.getActiveSpreadsheet().getName() });
}
