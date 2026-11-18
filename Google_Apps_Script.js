// ===== 東門國小營養午餐試菜系統 v3（Apps Script）=====
// 貼到「試算表 → 擴充功能 → Apps Script」取代原本程式碼並儲存。
// 部署：部署 → 管理部署作業 → 鉛筆圖示 → 版本選「新版本」→ 部署（網址不變）。KEY 沿用原本的指令碼屬性。
// 試算表「不要」發布到網路，也不要分享給別人；所有資料只由這支程式讀寫。

const VERSION = '3.4';
const TZ = 'Asia/Taipei';
const PHOTO_FOLDER = '東門試菜照片';
const WINDOW_DAYS = 2;   // 家代可在輪值日當天起、往後 2 天內補填
const S_REC = '紀錄', S_ISS = '議題', S_SCH = '班表', S_ROS = '家代名冊', S_MENU = '菜單';
const REC_COLS = ['ID', '日期', '姓名', '班級', '年級', '填報時間', '試菜內容', '照片連結', '狀態', '審核備註', '審核時間', '來源', '菜單圖片', '使用平台照片', '使用平台菜單'];
const ISS_COLS = ['ID', '日期', '標題', '摘要', '回覆', '狀態', '照片連結', '公開', '建立時間', '更新時間'];
const SCH_COLS = ['日期', '姓名', '班級'];
const ROS_COLS = ['姓名', '班級', '年級', 'Token', '啟用', '建立時間'];
const MENU_COLS = ['日期', '菜色', '來源', '更新時間', '平台照片', '顯示照片', '平台菜色', '顯示菜單', '營養', '食材'];

// ---------- 基礎工具 ----------
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function nowDate_() { return new Date(); }
function now_() { return Utilities.formatDate(nowDate_(), TZ, 'yyyy-MM-dd HH:mm:ss'); }
function today_() { return Utilities.formatDate(nowDate_(), TZ, 'yyyy-MM-dd'); }
function id_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 10); }
function token_() { return Utilities.getUuid().replace(/-/g, ''); }
function gradeOf_(c) { const m = String(c || '').match(/[1-6]/); return m ? m[0] : ''; }
function err_(m) { return { status: 'error', message: m }; }
function addDays_(d, n) { return Utilities.formatDate(new Date(new Date(d + 'T12:00:00Z').getTime() + n * 864e5), 'UTC', 'yyyy-MM-dd'); }
function ds_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  const m = String(v).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : String(v).trim();
}
function cell_(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : (v == null ? '' : String(v)); }
function lock_(fn) { const l = LockService.getScriptLock(); l.waitLock(25000); try { return fn(); } finally { l.releaseLock(); } }

// 取得分頁（不存在就建立、缺少的欄位自動補上；以欄位名稱對應，順序不影響）
function tbl_(name, cols) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name, ss.getNumSheets());
  const c = sh.getLastColumn();
  const hs = c ? sh.getRange(1, 1, 1, c).getValues()[0].map(function (x) { return String(x).trim(); }) : [];
  cols.forEach(function (k) { if (hs.indexOf(k) < 0) { sh.getRange(1, hs.length + 1).setValue(k); hs.push(k); } });
  return { sh: sh, hs: hs };
}
function rows_(t) {
  const n = t.sh.getLastRow(); if (n < 2) return [];
  return t.sh.getRange(2, 1, n - 1, t.hs.length).getValues().map(function (r, i) {
    const o = { _r: i + 2 }; t.hs.forEach(function (h, j) { o[h] = cell_(r[j]); }); return o;
  });
}
function add_(t, obj) {
  const row = t.hs.map(function (h) { return obj[h] == null ? '' : obj[h]; });
  const r = t.sh.getLastRow() + 1;
  t.sh.getRange(r, 1, 1, row.length).setNumberFormat('@').setValues([row]);
  return r;
}
function set_(t, r, obj) {
  const rg = t.sh.getRange(r, 1, 1, t.hs.length), row = rg.getValues()[0].map(cell_);
  t.hs.forEach(function (h, j) { if (obj[h] !== undefined) row[j] = obj[h]; });
  rg.setNumberFormat('@').setValues([row]);
}
function clearRows_(t) { const n = t.sh.getLastRow(); if (n > 1) t.sh.getRange(2, 1, n - 1, t.hs.length).clearContent(); }

// 照片存雲端硬碟（知道連結者可看；連結只出現在私有試算表與管理後台，退回／刪除時會丟進垃圾桶）
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
function trashPhotos_(urls) {
  String(urls || '').split(',').forEach(function (u) {
    const m = u.match(/[?&]id=([\w-]+)/); if (!m) return;
    try { DriveApp.getFileById(m[1]).setTrashed(true); } catch (e) {}
  });
}
function checkKey_(k) {
  const key = PropertiesService.getScriptProperties().getProperty('KEY');
  if (!key) return '尚未在指令碼屬性設定 KEY';
  if (k !== key) return '通關密語不符';
  return '';
}

// ---------- 教育局菜單（教育部校園食材登錄平台・公開查詢）----------
// 實際格式（2026/11 確認）：
//   /offered/meal?KitchenId=all&MenuType=1&period=YYYY-MM-DD&SchoolId=353606 → data[]：BatchDataId、KitchenName、營養份量 Type*、Calorie
//   /dish?BatchDataId=… → data[]：DishName、DishType（主食/主菜/副菜/蔬菜/湯品…）、DishId、DishOrder（「調味料」沒有 DishType）
//   /ingredient?BatchDataId=…&DishId=… → data[]：IngredientName、IngredientSourceNameList（產地）、Certification
//   菜色照片：/dish/pic/{DishId}（PicturePath 是平台主機內部路徑，不能當網址用）
const MOE_HOST = 'https://fatraceschool.k12ea.gov.tw', SCHOOL_ID = '353606';
const NUT_KEYS = [['TypeGrains', 'g'], ['TypeMeatBeans', 'm'], ['TypeVegetable', 'v'], ['TypeOil', 'o'], ['TypeMilk', 'k'], ['TypeFruit', 'f'], ['Calorie', 'cal']];
function picUrl_(u) {   // 修正舊版存錯的照片網址（/mnt/hdb/…/28_{DishId}.）
  u = String(u || ''); const m = u.match(/\/mnt\/hdb\/.*_(\d+)\.\w*$/);
  return m ? MOE_HOST + '/dish/pic/' + m[1] : u;
}
function moeGet_(u, log) {
  const r = UrlFetchApp.fetch(u, { muteHttpExceptions: true, headers: { 'Accept': 'application/json, text/plain, */*', 'Referer': MOE_HOST + '/frontend/search.html?school=' + SCHOOL_ID } });
  log.push(r.getResponseCode() + ' ' + u.replace(MOE_HOST, ''));
  return JSON.parse(r.getContentText());
}
function fetchMoe_(date, withIng) {
  const log = [], out = { dishes: [], nut: null, ing: [], log: log, raw: '' };
  try {
    const meal = moeGet_(MOE_HOST + '/offered/meal?KitchenId=all&MenuType=1&period=' + date + '&SchoolId=' + SCHOOL_ID, log);
    const batches = (meal && meal.data) || [];
    if (!batches.length) { out.raw = JSON.stringify(meal).slice(0, 500); return out; }
    const b0 = batches[0], nut = {}; NUT_KEYS.forEach(function (k) { const v = parseFloat(b0[k[0]]); if (!isNaN(v)) nut[k[1]] = v; });
    out.nut = Object.keys(nut).length ? nut : null;
    batches.forEach(function (b) {
      const ds = (moeGet_(MOE_HOST + '/dish?BatchDataId=' + encodeURIComponent(b.BatchDataId), log).data || []);
      ds.filter(function (d) { return d.DishName && d.DishType && d.DishName !== '調味料'; })
        .sort(function (a, c) { return (a.DishOrder || 0) - (c.DishOrder || 0); })
        .forEach(function (d) {
          if (out.dishes.some(function (x) { return x.n === d.DishName; })) return;
          out.dishes.push({ n: String(d.DishName).trim(), t: d.DishType || '', u: d.DishId ? MOE_HOST + '/dish/pic/' + d.DishId : '', id: String(d.DishId || ''), b: String(b.BatchDataId) });
        });
    });
    if (withIng) out.dishes.forEach(function (d) {
      if (!d.id) return;
      try {
        const list = (moeGet_(MOE_HOST + '/ingredient?BatchDataId=' + d.b + '&DishId=' + d.id, log).data || []).map(function (x) {
          const cert = (x.Certification || []).map(function (c) { return c.SourceCertification; }).filter(Boolean).join('/');
          return [String(x.IngredientName || '').trim(), String(x.IngredientSourceNameList || '').trim(), cert];
        }).filter(function (x) { return x[0]; });
        if (list.length) out.ing.push({ n: d.n, i: list });
      } catch (e) { log.push('食材讀取失敗：' + d.n); }
    });
  } catch (e) { log.push('連線或格式錯誤：' + e); }
  return out;
}
function jsonOf_(v, dflt) { try { return v ? JSON.parse(v) : dflt; } catch (e) { return dflt; } }
function picsOf_(row) { return jsonOf_(row && row['平台照片'], []).map(function (p) { return { n: p.n, t: p.t || '', u: picUrl_(p.u) }; }); }
function menuInfo_(ex) {
  return { dishes: ex ? ex['菜色'] : '', source: ex ? ex['來源'] : '', plat: jsonOf_(ex && ex['平台菜色'], []), pics: picsOf_(ex),
    nut: jsonOf_(ex && ex['營養'], null), ing: jsonOf_(ex && ex['食材'], []),
    showMenu: (ex && ex['顯示菜單']) || '自動', showPics: (ex && ex['顯示照片']) || '自動' };
}
// 取得某日菜單：已存的直接用；沒有平台資料才向平台查（失敗 15 分鐘內不重試）。force＝重新查（手動菜色保留）
function menuFor_(date, doFetch, force, withIng) {
  const t = tbl_(S_MENU, MENU_COLS), ex = rows_(t).filter(function (r) { return ds_(r['日期']) === date; })[0], cur = menuInfo_(ex);
  if (cur.plat.length && !force) return cur;
  if (!doFetch) return cur;
  const cache = CacheService.getScriptCache();
  if (!force && cache.get('mf_' + date)) { cur.skipped = true; return cur; }
  const r = fetchMoe_(date, withIng !== false);
  if (!r.dishes.length) { cache.put('mf_' + date, '1', 900); cur.failed = true; cur.log = r.log; cur.raw = r.raw; return cur; }
  menuSet_({ date: date, platform: { dishes: r.dishes, nut: r.nut, ing: r.ing } });
  const now = menuInfo_(rows_(t).filter(function (x) { return ds_(x['日期']) === date; })[0]); now.log = r.log; now.kept = cur.source === '幹部'; return now;
}
function menuGet_(b) {
  const d = ds_(b.date || today_()), r = menuFor_(d, b.fetch !== false, !!b.force, b.ing !== false);
  r.status = 'success'; r.date = d; return r;
}
function authorizeAll() {   // 在編輯器執行一次，授權「連外網」「雲端硬碟」「快取」
  SpreadsheetApp.getActiveSpreadsheet().getName(); DriveApp.getRootFolder();
  UrlFetchApp.fetch(MOE_HOST + '/frontend/', { muteHttpExceptions: true }); CacheService.getScriptCache().put('x', '1', 5);
  Logger.log('授權完成');
}

// ---------- 公開資料（完全去識別化：只有年級，沒有姓名、班級、填報時間）----------
const showOf_ = function (setting, recs, col, has) {   // 自動＝依家代/補登的選擇；沒有人表示意見時，有資料就顯示
  if (setting === '是') return has; if (setting === '否') return false;
  if (recs.some(function (r) { return r[col] === '是'; })) return has;
  if (recs.length && recs.every(function (r) { return r[col] === '否'; })) return false;
  return has;
};
function publicData_() {
  const menu = {}, byDay = {};
  rows_(tbl_(S_MENU, MENU_COLS)).forEach(function (m) { menu[ds_(m['日期'])] = menuInfo_(m); });
  const pub = rows_(tbl_(S_REC, REC_COLS)).filter(function (r) { return r['狀態'] === '已發布'; });
  pub.forEach(function (r) { const d = ds_(r['日期']); (byDay[d] = byDay[d] || []).push(r); });
  const seen = {};
  const l = pub.map(function (r) {
    const d = ds_(r['日期']), first = !seen[d], m = menu[d]; seen[d] = 1;
    const o = { '日期': d, '班級': r['年級'], '午餐菜色': '', '菜單來源': '', '平台菜色': '', '平台照片': '', '營養': '', '食材': '', '家代意見反饋': r['試菜內容'], '照片連結': r['照片連結'], '營養師回應': '', '菜單圖片': r['菜單圖片'] };
    if (first && m) {
      const recs = byDay[d], hasPlat = m.plat.length > 0, sm = showOf_(m.showMenu, recs, '使用平台菜單', hasPlat), sp = showOf_(m.showPics, recs, '使用平台照片', m.pics.length > 0);
      if (sm) { o['平台菜色'] = JSON.stringify(m.plat); o['營養'] = m.nut ? JSON.stringify(m.nut) : ''; o['食材'] = m.ing.length ? JSON.stringify(m.ing) : ''; o['菜單來源'] = '教育局'; o['午餐菜色'] = m.plat.map(function (x) { return x.n; }).join('、'); }
      else if (m.dishes && m.source !== '教育局') { o['午餐菜色'] = m.dishes; o['菜單來源'] = m.source; }
      if (sp) o['平台照片'] = JSON.stringify(m.pics);
    }
    return o;
  });
  const q = rows_(tbl_(S_ISS, ISS_COLS)).filter(function (r) { return r['公開'] !== '否'; }).map(function (r) {
    return { '日期': ds_(r['日期']), '標題': r['標題'], '反映摘要': r['摘要'], '營養師回覆': r['回覆'], '狀態': r['狀態'], '照片連結': r['照片連結'] };
  });
  return { status: 'success', version: VERSION, l: l, q: q };
}

// ---------- 家代（個人連結 token）----------
function repByToken_(tok) {
  if (!tok || String(tok).length < 20) return null;
  const r = rows_(tbl_(S_ROS, ROS_COLS)).filter(function (x) { return x['Token'] === tok && x['啟用'] !== '否'; });
  return r.length ? r[0] : null;
}
function repInfo_(tok) {
  const rep = repByToken_(tok); if (!rep) return err_('連結無效或已停用，請向幹部確認');
  const today = today_(), minD = addDays_(today, -WINDOW_DAYS);
  const sched = rows_(tbl_(S_SCH, SCH_COLS)).filter(function (r) { return r['姓名'] === rep['姓名']; }).map(function (r) { return ds_(r['日期']); }).sort();
  const mine = rows_(tbl_(S_REC, REC_COLS)).filter(function (r) { return r['姓名'] === rep['姓名'] && r['狀態'] !== '隱藏'; });
  const rec = function (d) { return mine.filter(function (r) { return ds_(r['日期']) === d; })[0]; };
  const lockedRec = function (r) { return !!r && (r['狀態'] === '已發布' || r['狀態'] === '僅記錄' || (r['來源'] && r['來源'] !== '家代填報')); };
  let fetched = 0;
  return {
    status: 'success', name: rep['姓名'], cls: rep['班級'], today: today,
    open: sched.filter(function (d) { return d <= today && d >= minD; }).map(function (d) {
      const r = rec(d); let m = { dishes: '' };
      try { m = menuFor_(d, fetched++ < 2, false, true); } catch (e) {}
      return { d: d, s: r ? r['狀態'] : '', locked: lockedRec(r), text: r ? r['試菜內容'] : '', note: r ? r['審核備註'] : '', nph: r && r['照片連結'] ? r['照片連結'].split(',').filter(Boolean).length : 0, menu: m.dishes || '', menuSrc: m.source || '', plat: m.plat || [], pics: m.pics || [], nut: m.nut || null, usePics: !r || r['使用平台照片'] !== '否', useMenu: !r || r['使用平台菜單'] !== '否' };
    }),
    upcoming: sched.filter(function (d) { return d > today; }).slice(0, 5),
    history: mine.sort(function (a, b) { return ds_(a['日期']) < ds_(b['日期']) ? 1 : -1; }).slice(0, 40).map(function (r) {
      return { d: ds_(r['日期']), s: r['狀態'], src: r['來源'] || '', note: r['審核備註'], text: r['試菜內容'], ph: String(r['照片連結'] || '').split(',').filter(Boolean) };
    })
  };
}
function submit_(b) {
  const rep = repByToken_(b.t); if (!rep) return err_('連結無效或已停用，請向幹部確認');
  const date = ds_(b.date), today = today_();
  const mySched = rows_(tbl_(S_SCH, SCH_COLS)).some(function (r) { return r['姓名'] === rep['姓名'] && ds_(r['日期']) === date; });
  if (!mySched) return err_('這一天不是你的輪值日');
  if (date > today || date < addDays_(today, -WINDOW_DAYS)) return err_('只能填寫今天（或輪值後 ' + WINDOW_DAYS + ' 天內補填）的紀錄');
  const text = String(b.text || '').trim().slice(0, 2000), photos = (b.photos || []).slice(0, 6);
  if (!text && !photos.length) return err_('請填寫試菜心得或附照片');
  const t = tbl_(S_REC, REC_COLS);
  const ex = rows_(t).filter(function (r) { return r['姓名'] === rep['姓名'] && ds_(r['日期']) === date && r['狀態'] !== '隱藏'; })[0];
  if (ex && (ex['狀態'] === '已發布' || ex['狀態'] === '僅記錄' || (ex['來源'] && ex['來源'] !== '家代填報'))) return err_('這筆已由幹部登錄或已上線，無法修改；如需更正請聯絡幹部');
  let ph = ex ? ex['照片連結'] : '';
  if (photos.length) { trashPhotos_(ph); ph = savePhotos_(photos, date); }
  const data = { '日期': date, '姓名': rep['姓名'], '班級': rep['班級'], '年級': rep['年級'], '填報時間': now_(), '試菜內容': text, '照片連結': ph, '狀態': '待審', '審核備註': '', '來源': '家代填報', '使用平台照片': b.usePics === false ? '否' : '是', '使用平台菜單': b.useMenu === false ? '否' : '是' };
  // 家代裝置查到的平台菜單（伺服器沒有存到時才採用；照片網址限平台網域）
  try { if (b.menu && b.menu.dishes && b.menu.dishes.length && !menuFor_(date, false, false).plat.length) menuSet_({ date: date, platform: b.menu }); } catch (e) {}
  if (ex) set_(t, ex._r, data); else { data['ID'] = id_(); add_(t, data); }
  return { status: 'success', photos: photos.length };
}

// ---------- 幹部操作（需通關密語）----------
function state_() {
  return {
    status: 'success', version: VERSION, today: today_(),
    roster: rows_(tbl_(S_ROS, ROS_COLS)),
    schedule: rows_(tbl_(S_SCH, SCH_COLS)).map(function (r) { return { d: ds_(r['日期']), n: r['姓名'], c: r['班級'] }; }),
    records: rows_(tbl_(S_REC, REC_COLS)).map(function (r) { r['日期'] = ds_(r['日期']); return r; }),
    issues: rows_(tbl_(S_ISS, ISS_COLS)).map(function (r) { r['日期'] = ds_(r['日期']); return r; }),
    menu: rows_(tbl_(S_MENU, MENU_COLS)).map(function (r) { r['日期'] = ds_(r['日期']); return r; })
  };
}
function recById_(t, id) { return rows_(t).filter(function (r) { return r['ID'] === id; })[0]; }
function approve_(b) {
  const t = tbl_(S_REC, REC_COLS); let n = 0;
  rows_(t).forEach(function (r) {
    if (b.all ? r['狀態'] === '待審' : (b.ids || []).indexOf(r['ID']) >= 0) { set_(t, r._r, { '狀態': '已發布', '審核時間': now_(), '審核備註': '' }); n++; }
  });
  return { status: 'success', count: n };
}
function recStatus_(b) {
  if (['待審', '已發布', '退回', '隱藏', '僅記錄'].indexOf(b.status) < 0) return err_('狀態不正確');
  const t = tbl_(S_REC, REC_COLS), r = recById_(t, b.id); if (!r) return err_('找不到這筆紀錄');
  set_(t, r._r, { '狀態': b.status, '審核時間': now_(), '審核備註': b.note || '' });
  return { status: 'success' };
}
function recUpdate_(b) {
  const t = tbl_(S_REC, REC_COLS), r = recById_(t, b.id); if (!r) return err_('找不到這筆紀錄');
  const o = {};
  if (b.text != null) o['試菜內容'] = String(b.text).slice(0, 2000);
  if (b.date) o['日期'] = ds_(b.date);
  if (b.name != null) o['姓名'] = b.name;
  if (b.cls != null) { o['班級'] = b.cls; o['年級'] = gradeOf_(b.cls); }
  if (b.usePics != null) o['使用平台照片'] = b.usePics ? '是' : '否';
  if (b.useMenu != null) o['使用平台菜單'] = b.useMenu ? '是' : '否';
  let ph = r['照片連結'].split(',').filter(Boolean);
  (b.removePhotos || []).forEach(function (u) { trashPhotos_(u); ph = ph.filter(function (x) { return x !== u; }); });
  const add = savePhotos_(b.addPhotos, ds_(r['日期'])); if (add) ph = ph.concat(add.split(','));
  o['照片連結'] = ph.join(',');
  set_(t, r._r, o); return { status: 'success' };
}
function recDelete_(b) {
  const t = tbl_(S_REC, REC_COLS), r = recById_(t, b.id); if (!r) return err_('找不到這筆紀錄');
  trashPhotos_(r['照片連結']); t.sh.deleteRow(r._r); return { status: 'success' };
}
function recAdd_(b) {   // 補登：可一次多筆，預設直接上線
  const t = tbl_(S_REC, REC_COLS), have = rows_(t); let n = 0; const skipped = [];
  (b.items || []).forEach(function (x) {
    const d = ds_(x.date), name = String(x.name || '').trim();
    if (name && have.some(function (r) { return r['姓名'] === name && ds_(r['日期']) === d && r['狀態'] !== '隱藏'; })) { skipped.push(d + ' ' + name); return; }
    const st = x.status || '已發布', pub = st !== '待審';
    add_(t, { 'ID': id_(), '日期': d, '姓名': name, '班級': x.cls || '', '年級': gradeOf_(x.cls), '填報時間': now_(), '試菜內容': String(x.text || '').slice(0, 2000),
      '照片連結': savePhotos_(x.photos, d), '狀態': st, '審核時間': pub ? now_() : '', '來源': x.source || '幹部補登', '使用平台照片': x.usePics == null ? '' : (x.usePics ? '是' : '否'), '使用平台菜單': x.useMenu == null ? '' : (x.useMenu ? '是' : '否') });
    have.push({ '姓名': name, '日期': d, '狀態': '已發布' });   // 同一批內的重複也要擋下
    n++;
  });
  return { status: 'success', count: n, skipped: skipped };
}
const okPic_ = function (u) { return String(u || '').indexOf(MOE_HOST + '/dish/pic/') === 0; };
const sw_ = function (v) { return v === true ? '是' : v === false ? '否' : (['自動', '是', '否'].indexOf(v) >= 0 ? v : null); };
function menuSet_(b) {
  const t = tbl_(S_MENU, MENU_COLS), d = ds_(b.date), ex = rows_(t).filter(function (r) { return ds_(r['日期']) === d; })[0];
  const o = { '日期': d, '更新時間': now_() };
  if (b.dishes != null) { o['菜色'] = String(b.dishes).slice(0, 300); o['來源'] = b.source || '幹部'; }
  const P = b.platform;
  if (P && P.dishes && P.dishes.length) {   // 平台資料（伺服器或使用者瀏覽器取得）：只接受平台網域的照片
    const ds = P.dishes.slice(0, 15).map(function (x) { return { n: String(x.n || '').slice(0, 40), t: String(x.t || '').slice(0, 10), u: okPic_(x.u) ? String(x.u) : '' }; }).filter(function (x) { return x.n; });
    o['平台菜色'] = JSON.stringify(ds.map(function (x) { return { n: x.n, t: x.t }; }));
    o['平台照片'] = JSON.stringify(ds.filter(function (x) { return x.u; }));
    if (P.nut) { const n = {}; ['g', 'm', 'v', 'o', 'k', 'f', 'cal'].forEach(function (k) { const v = parseFloat(P.nut[k]); if (!isNaN(v)) n[k] = v; }); o['營養'] = JSON.stringify(n); }
    if (P.ing) o['食材'] = JSON.stringify((P.ing || []).slice(0, 15).map(function (x) { return { n: String(x.n || '').slice(0, 40), i: (x.i || []).slice(0, 20).map(function (y) { return [String(y[0] || '').slice(0, 30), String(y[1] || '').slice(0, 30), String(y[2] || '').slice(0, 30)]; }) }; }));
    if (!ex || !ex['菜色'] || ex['來源'] === '教育局') { o['菜色'] = ds.map(function (x) { return x.n; }).join('、'); o['來源'] = '教育局'; }
  }
  if (b.pics != null) o['平台照片'] = JSON.stringify((b.pics || []).filter(function (x) { return x && okPic_(picUrl_(x.u)); }).map(function (x) { return { n: String(x.n || '').slice(0, 40), t: String(x.t || ''), u: picUrl_(x.u) }; }).slice(0, 15));
  const sp = sw_(b.showPics), sm = sw_(b.showMenu);
  if (sp) o['顯示照片'] = sp; if (sm) o['顯示菜單'] = sm;
  if (ex) set_(t, ex._r, o); else add_(t, o);
  return { status: 'success' };
}
function issueSave_(b) {
  const t = tbl_(S_ISS, ISS_COLS), d = ds_(b.date || today_()), photos = savePhotos_(b.photos, d);
  const status = b.status && b.status !== 'auto' ? b.status : (b.reply ? '已回覆' : '追蹤中');
  const o = { '日期': d, '標題': b.title, '摘要': b.summary || '', '回覆': b.reply || '', '狀態': status, '公開': b.public === false ? '否' : '是', '更新時間': now_() };
  if (b.id) {
    const r = recById_(t, b.id); if (!r) return err_('找不到這則議題');
    let ph = r['照片連結'].split(',').filter(Boolean);
    (b.removePhotos || []).forEach(function (u) { trashPhotos_(u); ph = ph.filter(function (x) { return x !== u; }); });
    if (photos) ph = ph.concat(photos.split(','));
    o['照片連結'] = ph.join(','); set_(t, r._r, o);
  } else { o['ID'] = id_(); o['照片連結'] = photos; o['建立時間'] = now_(); add_(t, o); }
  return { status: 'success' };
}
function issueDelete_(b) {
  const t = tbl_(S_ISS, ISS_COLS), r = recById_(t, b.id); if (!r) return err_('找不到這則議題');
  trashPhotos_(r['照片連結']); t.sh.deleteRow(r._r); return { status: 'success' };
}
function rsImport_(b) {   // 匯入家代名冊與班表（姓名只存在私有試算表）
  const rt = tbl_(S_ROS, ROS_COLS), cur = rows_(rt), byName = {}, clsOf = {}, merged = {};
  cur.forEach(function (r) { byName[r['姓名']] = r; clsOf[r['姓名']] = r['班級']; });
  (b.roster || []).forEach(function (x) {
    const n = String(x.name || '').trim(), c = String(x.cls || '').trim(); if (!n || !c) return;
    merged[n] = merged[n] || []; if (merged[n].indexOf(c) < 0) merged[n].push(c);
  });
  let added = 0, updated = 0;
  Object.keys(merged).forEach(function (n) {
    const cls = merged[n].join('/'); clsOf[n] = cls;
    if (byName[n]) { set_(rt, byName[n]._r, { '班級': cls, '年級': gradeOf_(merged[n][0]) }); updated++; }
    else { add_(rt, { '姓名': n, '班級': cls, '年級': gradeOf_(merged[n][0]), 'Token': token_(), '啟用': '是', '建立時間': now_() }); added++; }
  });
  const st = tbl_(S_SCH, SCH_COLS); clearRows_(st);
  const seen = {}, rows = [];
  (b.schedule || []).forEach(function (x) {
    const d = ds_(x.date), n = String(x.name || '').trim(), k = d + '|' + n;
    if (!n || !clsOf[n] || seen[k]) return; seen[k] = 1;
    rows.push(st.hs.map(function (h) { return h === '日期' ? d : h === '姓名' ? n : h === '班級' ? clsOf[n] : ''; }));
  });
  if (rows.length) st.sh.getRange(2, 1, rows.length, st.hs.length).setNumberFormat('@').setValues(rows);
  return { status: 'success', added: added, updated: updated, schedule: rows.length };
}
function repSet_(b) {
  const t = tbl_(S_ROS, ROS_COLS), r = rows_(t).filter(function (x) { return x['姓名'] === b.name; })[0]; if (!r) return err_('找不到這位家代');
  const o = {}; if (b.newToken) o['Token'] = token_(); if (b.enabled != null) o['啟用'] = b.enabled ? '是' : '否';
  set_(t, r._r, o); return { status: 'success' };
}
function repResetAll_(b) {   // 整批重產所有家代的個人連結（舊連結與 QR Code 立即失效）
  const t = tbl_(S_ROS, ROS_COLS); let n = 0;
  rows_(t).forEach(function (r) { if (b.onlyEnabled && r['啟用'] === '否') return; set_(t, r._r, { 'Token': token_() }); n++; });
  return { status: 'success', count: n };
}
function migrateV2_(b) {   // 一次性：把 v2 的「試菜」「反映」分頁資料搬進 v3
  const ss = SpreadsheetApp.getActiveSpreadsheet(), rt = tbl_(S_REC, REC_COLS), it = tbl_(S_ISS, ISS_COLS);
  if ((rows_(rt).length || rows_(it).length) && !b.force) return err_('v3 已有資料；若確定要再匯入，請勾選「強制匯入」');
  const objs = function (sh) {
    if (!sh || sh.getLastRow() < 2) return [];
    const v = sh.getDataRange().getValues(), hs = v[0].map(function (x) { return String(x).trim(); });
    return v.slice(1).map(function (r) { const o = {}; hs.forEach(function (h, j) { o[h] = cell_(r[j]); }); return o; });
  };
  let a = 0, q = 0;
  objs(ss.getSheetByName('試菜')).forEach(function (o) {
    const d = ds_(o['日期']); if (!/^\d{4}-/.test(d) || o['公開'] === '否') return;
    const cls = String(o['班級'] || '').replace(/\D/g, '');
    add_(rt, { 'ID': id_(), '日期': d, '姓名': '', '班級': cls, '年級': gradeOf_(cls), '填報時間': '', '試菜內容': o['家代意見反饋'], '照片連結': o['照片連結'], '狀態': '已發布', '來源': 'v2匯入', '菜單圖片': o['菜單圖片'] || '' });
    if (o['午餐菜色']) menuSet_({ date: d, dishes: o['午餐菜色'], source: 'v2匯入' });
    a++;
  });
  objs(ss.getSheetByName('反映')).forEach(function (o) {
    const d = ds_(o['日期']); if (!/^\d{4}-/.test(d) || !o['標題']) return;
    add_(it, { 'ID': id_(), '日期': d, '標題': o['標題'], '摘要': o['反映摘要'], '回覆': o['營養師回覆'], '狀態': o['狀態'] || (o['營養師回覆'] ? '已回覆' : '追蹤中'), '照片連結': o['照片連結'] || '', '公開': o['公開'] === '否' ? '否' : '是', '建立時間': now_(), '更新時間': now_() });
    q++;
  });
  return { status: 'success', records: a, issues: q };
}
function status_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return { status: 'success', version: VERSION, driveFolder: DriveApp.getFoldersByName(PHOTO_FOLDER).hasNext(),
    sheets: ss.getSheets().map(function (sh) { const c = sh.getLastColumn(); return { name: sh.getName(), rows: sh.getLastRow(), headers: c ? sh.getRange(1, 1, 1, c).getValues()[0] : [] }; }) };
}
const OPS = { state: state_, status: status_, menu_test: menuGet_, menu_get: menuGet_, approve: approve_, rec_status: recStatus_, rec_update: recUpdate_, rec_delete: recDelete_, rec_add: recAdd_,
  menu_set: menuSet_, issue_save: issueSave_, issue_delete: issueDelete_, rs_import: rsImport_, rep_set: repSet_, rep_reset_all: repResetAll_, migrate_v2: migrateV2_ };
const READ_ONLY = { state: 1, status: 1 };

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action === 'public') return out_(publicData_());
    if (p.action === 'repinfo') return out_(repInfo_(p.t));
  } catch (x) { return out_(err_(String(x))); }
  return out_({ ok: true, version: VERSION });
}
function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    if (b.type === 'submit') return out_(lock_(function () { return submit_(b); }));
    const bad = checkKey_(b.key); if (bad) return out_(err_(bad));
    const fn = OPS[b.op]; if (!fn) return out_(err_('未知的操作：' + b.op));
    return out_(READ_ONLY[b.op] ? fn(b) : lock_(function () { return fn(b); }));
  } catch (x) { return out_(err_(String(x))); }
}
