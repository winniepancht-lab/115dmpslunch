(() => {
const C = window.CONFIG, { $, E, md, wd } = H, p2 = n => String(n).padStart(2, "0");
let KEY = localStorage.getItem("dmpa_key") || "", S = null, tab = "pend", edit = null, batch = [], dn = [];
const rf = { q: "", s: "", n: 60 }, sts = { q: "", sort: "cls", dir: 1, grade: "", f: "all", per: "all" }, dly = { pre: "week", miss: false }, lk = { q: "", f: "all", grade: "", sort: "cls" };

//PARSE-START
const SKIP = new Set(["試菜人員", "家長：", "家長:", "家長", "行政代表", "家長代表", "試吃意見", "輪值時間", "人員"]);
const CL = /(?<!\d)([1-6](?:0\d|1[01]))(?!\d)/, clean = l => l.replace(/^[\s*•·\-–—＊]+/, "").trim();
function fromText(txt, d) { const blocks = []; let cur = null;
  for (const raw of txt.replace(/\r/g, "").split("\n")) { const l = raw.trim();
    if (/試[菜吃]/.test(l) && (CL.test(l) || /\d{1,2}[\/／]\d{1,2}/.test(l)) && l.length < 40) { cur = { h: l, l: [] }; blocks.push(cur); }
    else if (l) { if (!cur) { cur = { h: "", l: [] }; blocks.push(cur); } cur.l.push(clean(l)); } }
  return blocks.filter(b => b.l.length).map(b => ({ d, c: (b.h.match(CL) || [])[1] || "", l: b.l })); }
function fromLine(txt) { const out = []; let date = null, cur = null;
  const push = () => { if (cur) { const t = cur.t.join("\n").replace(/^"|"$/g, "").trim(); if (/試[菜吃]/.test(t) && t.split("\n").length >= 2) out.push(...fromText(t, cur.d)); cur = null; } };
  for (const raw of txt.replace(/\r/g, "").split("\n")) { const m = raw.match(/^(\d{4})\/(\d\d)\/(\d\d)（/); if (m) { push(); date = `${m[1]}-${m[2]}-${m[3]}`; continue; }
    const t = raw.match(/^\d\d:\d\d\t[^\t]*\t?(.*)$/); if (t) { push(); cur = { d: date, t: [t[1]] }; } else if (cur) cur.t.push(raw); }
  push(); return out; }
function toIso(v) { if (typeof v == "number" && v > 40000 && v < 60000) return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10);
  const m = String(v == null ? "" : v).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/); return m ? `${m[1]}-${("0" + m[2]).slice(-2)}-${("0" + m[3]).slice(-2)}` : ""; }
function parseRS(sheets, rosterAoa) {
  const roster = []; rosterAoa.forEach(r => { const c = String(r[2] || "").trim(), n = String(r[3] || "").trim(); if (/^[1-6]\d{2}[A-Za-z]?$/.test(c) && n) roster.push({ name: n, cls: c }); });
  const names = new Set(roster.map(x => x.name)), schedule = [], seen = new Set(), miss = new Set();
  sheets.forEach(sh => { let cur = ""; sh.forEach(r => { const d = toIso(r[0]); if (d) cur = d; if (!cur) return;
    for (let i = 2; i < r.length; i++) { const n = String(r[i] == null ? "" : r[i]).trim(); if (!n || SKIP.has(n) || /[：:]$/.test(n)) continue;
      if (names.has(n)) { const k = cur + n; if (!seen.has(k)) { seen.add(k); schedule.push({ date: cur, name: n }); } } else miss.add(n); } }); });
  return { roster, schedule, missing: [...miss] }; }
// 已完成名單：每行含日期＋姓名（或班級），回傳 [{d,name,c,raw}]
function parseDone(text, roster, schedule, today) {
  const names = [...new Set(roster.map(r => r["姓名"]))].sort((a, b) => b.length - a.length), out = [], q2 = n => String(n).padStart(2, "0");
  const dateIn = s => { let m = s.match(/(\d{4})\s*[\/\-.年]\s*(\d{1,2})\s*[\/\-.月]\s*(\d{1,2})/); if (m) return `${m[1]}-${q2(m[2])}-${q2(m[3])}`;
    m = s.match(/(?<!\d)(\d{1,2})\s*[\/\-.月]\s*(\d{1,2})\s*日?/); if (!m) return ""; const y = +today.slice(0, 4); let d = `${y}-${q2(m[1])}-${q2(m[2])}`;
    if (d > new Date(new Date(today + "T12:00:00Z").getTime() + 7 * 864e5).toISOString().slice(0, 10)) d = `${y - 1}-${q2(m[1])}-${q2(m[2])}`; return d; };
  text.split("\n").forEach(line => { line = line.trim(); if (!line) return; const d = dateIn(line); if (!d) { out.push({ d: "", name: "", c: "", raw: line }); return; }
    let rest = line; const found = []; names.forEach(n => { if (rest.includes(n)) { found.push(n); rest = rest.split(n).join(" "); } });
    if (found.length) found.forEach(n => out.push({ d, name: n, c: "", raw: line }));
    else { const cm = line.match(CL), m = cm ? schedule.filter(s => s.d == d && String(s.c).split("/").some(k => k.startsWith(cm[1]))) : []; if (m.length) m.forEach(x => out.push({ d, name: x.n, c: "", raw: line })); else out.push({ d, name: "", c: cm ? cm[1] : "", raw: line }); } });
  return out; }
//PARSE-END

// ---------- 基礎 ----------
const api = async (op, p = {}) => {
  const r = await (await fetch(C.GAS_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(Object.assign({ key: KEY, op }, p)) })).json();
  if (r.status !== "success") throw new Error(r.message || "失敗"); return r; };
let tt; const toast = (t, er) => { const e = $("toast"); e.textContent = t; e.className = er ? "er" : ""; e.style.display = "block"; clearTimeout(tt); tt = setTimeout(() => e.style.display = "none", 3800); };
const run = async (fn, ok, btn) => { if (btn) btn.disabled = true; try { const r = await fn(); if (ok) toast(typeof ok == "function" ? ok(r) : ok); return r === undefined ? true : r; }
  catch (e) { toast("⚠️ " + (e.message == "Failed to fetch" ? "連線失敗，請先確認是否已送出，避免重複" : e.message), 1); return null; } finally { if (btn) btn.disabled = false; } };
const FRONT = "3.2", verWarn = () => S.version == FRONT ? "" : `<div class="warn">⚠️ 後端 Apps Script 是 ${E(S.version)} 版，網頁是 ${FRONT} 版，部分功能會異常。請貼上最新的 Google_Apps_Script.js 並部署為「新版本」。</div>`;
const reload = async () => { S = await api("state"); if (!S.records) throw new Error("Apps Script 還不是 v3 版：請貼上新的 Google_Apps_Script.js 並部署為「新版本」"); render(); };
const gradeOf = c => (String(c || "").match(/[1-6]/) || [""])[0], GN = { 1: "一", 2: "二", 3: "三", 4: "四", 5: "五", 6: "六" };
const ck = c => { const m = String(c || "").split("/")[0].match(/(\d)(\d{2})([A-Za-z]?)/); return m ? [+m[1], +m[2], m[3]] : [9, 99, ""]; };
const cmpCls = (a, b) => { const x = ck(a), y = ck(b); return x[0] - y[0] || x[1] - y[1] || x[2].localeCompare(y[2]); };
const DONE = new Set(["待審", "已發布", "僅記錄"]), EMO = { ok: "✅", wait: "⏳", in: "↩", hide: "🔽", rec: "📝", miss: "❌", today: "🕓", later: "🕓" };
const stOf = (n, d) => { const r = S.records.find(x => x["姓名"] == n && x["日期"] == d && x["狀態"] != "隱藏") || S.records.find(x => x["姓名"] == n && x["日期"] == d);
  if (!r) return d < S.today ? "miss" : d == S.today ? "today" : "later"; return { "待審": "wait", "已發布": "ok", "退回": "in", "隱藏": "hide", "僅記錄": "rec" }[r["狀態"]]; };
const cx = (n, d, extra) => `<span class="cx ${stOf(n, d)}" ${n ? `data-go="${E(n)}"` : ""}>${EMO[stOf(n, d)]} ${E(n)}${extra || ""}</span>`;
const pend = () => S.records.filter(r => r["狀態"] == "待審");
const reps = () => S.roster.filter(r => r["啟用"] != "否");
const repOpts = sel => `<option value="">（不在名單／不指定）</option>` + [...reps()].sort((a, b) => cmpCls(a["班級"], b["班級"])).map(r => `<option value="${E(r["姓名"])}" ${r["姓名"] == sel ? "selected" : ""}>${E(r["班級"])} ${E(r["姓名"])}</option>`).join("");
const chipOf = s => `<span class="chip ${s == "待審" ? "wait" : s == "已發布" || s == "僅記錄" ? "ok" : "in"}">${{ "待審": "⏳ 待審", "已發布": "✅ 已上線", "退回": "↩ 已退回", "隱藏": "🔽 已下架", "僅記錄": "📝 僅記錄" }[s] || s}</span>`;
const nm = n => E(n || "（未指定）");
const dl = (name, txt) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + txt], { type: "text/csv" })); a.download = name; a.click(); };
const csv = rows => rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
const seg = (id, val, opts) => `<div class="seg" data-seg="${id}">${opts.map(([k, v]) => `<button class="${k == val ? "on" : ""}" data-v="${k}">${v}</button>`).join("")}</div>`;

// ---------- 登入與版面 ----------
async function login() { KEY = $("key").value.trim(); $("lm").textContent = "登入中…";
  try { await reload(); localStorage.setItem("dmpa_key", KEY); $("login").style.display = "none"; $("main").style.display = ""; } catch (e) { $("lm").textContent = "⚠️ " + e.message; } }
$("lg").onclick = login; $("key").onkeydown = e => { if (e.key == "Enter") login(); };
if (KEY) { $("key").value = KEY; login(); }
$("rl").onclick = () => run(reload, "已更新為最新資料", $("rl"));
const TABS = [["pend", "⏳ 待審核"], ["add", "✏️ 補登"], ["iss", "💬 議題"], ["rec", "🔍 紀錄"], ["stat", "📊 統計"], ["day", "📅 輪值對照"], ["set", "⚙️ 家代與設定"]];
const PANES = () => ({ pend: pPend, add: pAdd, iss: pIss, rec: pRec, stat: pStat, day: pDay, set: pSet });
function render() {
  const y = scrollY; $("tabs").innerHTML = TABS.map(([k, v]) => `<button class="${k == tab ? "on" : ""}" data-t="${k}">${v}${k == "pend" && pend().length ? `<span class="badge2">${pend().length}</span>` : ""}</button>`).join("");
  $("pane").innerHTML = verWarn() + PANES()[tab](); ({ add: bindAdd, iss: bindIss, set: bindSet }[tab] || (() => {}))(); scrollTo(0, y);
}
const go = t => { tab = t; render(); scrollTo(0, 0); };
$("tabs").onclick = e => { const b = e.target.closest("button"); if (b) go(b.dataset.t); };

// ---------- 紀錄卡 ----------
const recCard = r => {
  const ph = H.urls(r["照片連結"]), s = r["狀態"];
  const acts = (s == "待審" ? `<button data-a="ok">✅ 核可上線</button><button class="g" data-a="no">↩ 退回</button>` : s == "已發布" ? `<button class="g" data-a="hide">🔽 下架</button>` : `<button data-a="ok">✅ 上線</button>`) + `<button class="g" data-a="save">💾 存修改</button><button class="g r" data-a="del">🗑 刪除</button>`;
  return `<div class="rv" data-id="${r.ID}"><div class="dh"><div class="badge">${md(r["日期"])}<small>週${wd(r["日期"])}</small></div>
<div><b>${nm(r["姓名"])}</b> <span class="mu">${E(r["班級"])}</span><br><span class="mini">${r["填報時間"] ? "填報 " + E(r["填報時間"]) : "無填報時間"}・${E(r["來源"] || "")}${r["審核時間"] ? "・審核 " + E(r["審核時間"]) : ""}</span></div>${chipOf(s)}</div>
${r["審核備註"] ? `<p class="mini">備註：${E(r["審核備註"])}</p>` : ""}
${ph.length ? `<div class="pks">${ph.map(u => `<div class="pk"><a href="${E(H.big(u))}" target="_blank" rel="noopener"><img src="${E(H.thumb(u))}" loading="lazy" referrerpolicy="no-referrer" alt=""></a><label><input type="checkbox" data-rm="${E(u)}"> 移除</label></div>`).join("")}</div>` : ""}
<textarea data-k="text">${E(r["試菜內容"])}</textarea>
<div class="mini">追加照片：<input type="file" data-k="add" accept="image/*" multiple></div>
<div><input data-k="note" placeholder="退回原因（家代看得到）" style="margin-top:6px">${acts}</div></div>`; };
async function recAct(b) {
  const card = b.closest(".rv"), id = card.dataset.id, a = b.dataset.a, q = k => card.querySelector(`[data-k=${k}]`);
  const text = q("text").value, note = q("note").value, rm = [...card.querySelectorAll("[data-rm]:checked")].map(x => x.dataset.rm), add = [];
  for (const f of q("add").files) { const p = await H.shrink(f); if (p) add.push(p.b64); }
  const orig = S.records.find(r => r.ID == id), changed = text != orig["試菜內容"] || rm.length || add.length;
  if (a == "del" && !confirm("確定刪除這筆紀錄與照片？無法復原。")) return;
  run(async () => { if (a != "del" && (changed || a == "save")) await api("rec_update", { id, text, removePhotos: rm, addPhotos: add });
    if (a == "ok") await api("rec_status", { id, status: "已發布" }); if (a == "no") await api("rec_status", { id, status: "退回", note }); if (a == "hide") await api("rec_status", { id, status: "隱藏" });
    if (a == "del") await api("rec_delete", { id }); await reload(); }, { ok: "✅ 已核可上線", no: "已退回", hide: "已下架", save: "已儲存", del: "已刪除" }[a], b); }

// ---------- 待審核＋總覽 ----------
function pPend() {
  const p = pend().sort((a, b) => a["日期"] < b["日期"] ? 1 : -1), today = S.schedule.filter(x => x.d == S.today), wk = H.monday(S.today);
  const missWk = stats().reduce((a, x) => a + x.sdAll.filter(d => d >= wk && d < S.today && !S.records.some(r => r["姓名"] == x.n && r["日期"] == d)).length, 0), trk = S.issues.filter(i => i["狀態"] == "追蹤中").length;
  return `<div class="st"><div><b>${p.length}</b>⏳ 待審核</div><div><b>${today.filter(x => stOf(x.n, S.today) != "today").length}/${today.length}</b>📅 今日已填</div><div><b>${missWk}</b>❌ 本週缺填</div><div><b>${trk}</b>💬 追蹤中議題</div></div>
${today.length ? `<section class="f"><h2>今日輪值（${md(S.today)}）</h2><div class="cxs">${today.map(x => cx(x.n, S.today, ` <span class="mini">${E(x.c)}</span>`)).join("")}</div></section>` : ""}
<section class="f"><h2>待審核（${p.length}）</h2>${p.length ? `<button data-act="all">✅ 全部核可上線（${p.length}）</button><span class="mini">逐筆檢查文字與照片後，也可一次上線</span>` : '<div class="empty">🎉 沒有待審核的紀錄</div>'}</section>${p.map(recCard).join("")}`; }

// ---------- 補登 ----------
let aPics = [], aMenu = null;
const pAdd = () => `<section class="f"><h2>補登單筆紀錄</h2>
<div class="row"><div><label>日期</label><input type="date" id="a-d" value="${S.today}"></div><div><label>家代</label><select id="a-r">${repOpts()}</select></div></div>
<div class="row" id="a-o" style="display:none"><div><label>姓名</label><input id="a-n"></div><div><label>班級</label><input id="a-c" placeholder="例如 206"></div></div>
<div id="a-menu"></div><label>當日菜色（選填；可按上方「帶入菜色欄」或自行填寫）</label><input id="a-m"><label>試菜心得</label><button type="button" class="g" id="a-tpl">插入範本（依菜色欄；空白則用一般範本）</button><textarea id="a-t"></textarea>
<label>照片</label><input type="file" id="a-p" accept="image/*" multiple><div class="th" id="a-th"></div>
<label style="font-weight:400"><input type="checkbox" id="a-pub" checked> 直接上線（取消勾選則放入待審）</label><button id="a-go">送出補登</button></section>
<section class="f"><h2>匯入已完成名單（內容暫填「試菜完成」）</h2><p class="mini">貼上「日期＋姓名」清單（每行一筆，一行可有多位姓名；也可寫「日期＋班級」，系統依班表找人），或選擇 Excel／CSV 檔案。</p>
<textarea id="d-t" placeholder="11/9 李俞佑 黃鳳盈&#10;2026/11/10 王小明&#10;11/12 206"></textarea><div class="mini">或選檔案：<input type="file" id="d-f" accept=".xlsx,.xls,.csv"></div>
<button class="g" id="d-parse">解析</button><div id="d-out"></div></section>
<section class="f"><h2>批次補登（貼上 LINE 文字，一次上線）</h2><p class="mini">可貼單日文字，或整份 LINE 匯出（會依日期自動分開）。系統依班表自動對應家代，確認後一次上線；照片請之後在「紀錄」追加。</p>
<textarea id="b-t" placeholder="貼上 LINE 試菜文字…"></textarea><div class="row"><div><label>無日期時使用</label><input type="date" id="b-d" value="${S.today}"></div></div><button class="g" id="b-parse">解析</button><div id="b-out"></div></section>`;
const dishTpl = m => (String(m || "").split(/[、，,\n]+/).map(s => s.trim()).filter(Boolean).length ? String(m).split(/[、，,\n]+/).map(s => s.trim()).filter(Boolean) : ["白飯", "主菜", "副菜", "青菜", "湯"]).map(d => d + "：").join("\n") + "\n整體：";
async function getMenu(date, force) { let r = await api("menu_get", { date, force: !!force });
  if (r.failed || r.skipped) { const c = await H.moeFetch(date);
    if (c.dishes.length) { const manual = !!r.dishes && r.source == "幹部";
      await api("menu_set", Object.assign({ date, pics: c.dishes.filter(d => d.u) }, manual ? {} : { dishes: c.dishes.map(d => d.n).join("、"), source: "教育局" }));
      r = await api("menu_get", { date, fetch: false }); r.via = 1; r.kept = manual; r.date = date; }
    else { r.failed = true; r.clog = c.log; } }
  return r; }
async function syncMenus(dates, force) { let ok = 0, fail = 0; for (let i = 0; i < dates.length; i++) { toast(`同步教育局菜單 ${i + 1}/${dates.length}…`); try { const r = await getMenu(dates[i], force); r.dishes ? ok++ : fail++; } catch (e) { fail++; } } return { ok, fail }; }
function bindAdd() {
  const fillMenu = async () => { const d = $("a-d").value, box = $("a-menu"); if (!d) return; box.innerHTML = '<p class="mini">正在查詢教育部平台菜單…</p>';
    try { aMenu = await getMenu(d); } catch (e) { aMenu = null; box.innerHTML = ""; return; } if (!$("a-d") || $("a-d").value != d) return;
    box.innerHTML = aMenu.dishes ? `<div class="mbox">📋 <b>${aMenu.source == "幹部" ? "已登錄菜單" : "教育部平台菜單"}</b>　${E(aMenu.dishes)}<br><button type="button" class="g" id="a-use">帶入菜色欄</button>${aMenu.pics.length ? `${H.moeGal(aMenu.pics, false)}<label style="font-weight:400"><input type="checkbox" id="a-sp" ${aMenu.showPics ? "checked" : ""}> 這天沒有家代照片時，前台顯示平台菜色照片（會標示來源）</label>` : ""}</div>` : '<p class="mini">（教育部平台尚無這天菜單，可手動填寫菜色）</p>';
    if ($("a-use")) $("a-use").onclick = () => { $("a-m").value = aMenu.dishes; }; };
  $("a-d").onchange = () => { $("a-m").value = ""; fillMenu(); }; fillMenu();
  $("a-r").onchange = () => $("a-o").style.display = $("a-r").value ? "none" : ""; $("a-r").dispatchEvent(new Event("change"));
  $("a-tpl").onclick = () => { const t = $("a-t"); t.value += (t.value && !t.value.endsWith("\n") ? "\n" : "") + H.dishTpl($("a-m").value); t.focus(); };
  $("a-p").onchange = async e => { aPics = []; for (const f of e.target.files) { const p = await H.shrink(f); if (p) aPics.push(p); } $("a-th").innerHTML = aPics.map(p => `<img src="${p.u}" alt="">`).join(""); };
  $("a-go").onclick = () => { const rp = S.roster.find(r => r["姓名"] == $("a-r").value), t = $("a-t").value.trim(); if (!t && !aPics.length) return toast("請填寫心得或選照片", 1);
    run(async () => { const r = await api("rec_add", { items: [{ date: $("a-d").value, name: rp ? rp["姓名"] : $("a-n").value.trim(), cls: rp ? rp["班級"] : $("a-c").value.trim(), text: t, photos: aPics.map(p => p.b64), status: $("a-pub").checked ? "已發布" : "待審" }] });
      const mv = $("a-m").value.trim(), sp = $("a-sp"); if (mv && (!aMenu || mv != aMenu.dishes)) await api("menu_set", { date: $("a-d").value, dishes: mv, source: "幹部" }); if (sp && aMenu && sp.checked != aMenu.showPics) await api("menu_set", { date: $("a-d").value, showPics: sp.checked }); aPics = []; await reload(); return r; }, r => r.skipped.length ? "這位家代這天已有紀錄，已略過" : "✅ 已補登", $("a-go")); };
  // 已完成名單
  const lib = () => window.XLSX ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  $("d-f").onchange = e => run(async () => { const f = e.target.files[0]; if (!f) return; await lib(); const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
    $("d-t").value = wb.SheetNames.flatMap(n => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true }).map(r => r.map(c => { const i = toIso(c); return typeof c == "number" && i ? i : c; }).filter(c => c !== "" && c != null).join(" "))).filter(Boolean).join("\n"); });
  $("d-parse").onclick = () => { dn = parseDone($("d-t").value, S.roster, S.schedule, S.today); drawDone(); };
  $("b-parse").onclick = () => { const t = $("b-t").value; batch = (/^\d\d:\d\d\t/m.test(t) ? fromLine(t) : fromText(t, $("b-d").value)).map(x => {
    const m = S.schedule.filter(s => s.d == x.d && x.c && String(s.c).split("/").some(k => k.startsWith(x.c)))[0]; return { d: x.d || $("b-d").value, c: x.c, name: m ? m.n : "", text: x.l.join("\n") }; }); drawBatch(); }; }
function drawDone() { const o = $("d-out"); if (!dn.length) { o.innerHTML = '<p class="mu">沒有解析到內容</p>'; return; }
  const ok = dn.filter(x => x.d && x.name).length;
  o.innerHTML = `<p class="mini">共 ${dn.length} 筆，可匯入 ${ok} 筆；${dn.length - ok} 筆需要補日期或選擇家代（或刪除）</p>` + dn.map((x, i) => `<div class="card2 ${x.d && x.name ? "" : "bad"}" data-i="${i}"><div class="row"><div><input type="date" data-d="d" value="${x.d}"></div><div><select data-d="name">${repOpts(x.name)}</select></div><button class="g r" data-dx="${i}">刪除</button></div>${x.d && x.name ? "" : `<p class="mini er">⚠️ ${E(x.raw)}</p>`}</div>`).join("") +
    `<div class="row"><div><label>內容</label><input id="d-text" value="試菜完成"></div><div><label>狀態</label><select id="d-st"><option value="僅記錄">僅記錄（不公開，只計入統計）</option><option value="已發布">已上線（前台顯示內容）</option><option value="待審">待審</option></select></div></div>
<label style="font-weight:400"><input type="checkbox" id="d-sync" checked> 匯入後同步這些日期的教育局菜單</label><button data-act="dgo">✅ 匯入 ${ok} 筆</button>`; }
function drawBatch() { const o = $("b-out"); if (!batch.length) { o.innerHTML = '<p class="mu">沒有解析到試菜內容</p>'; return; }
  o.innerHTML = batch.map((x, i) => `<div class="card2" data-i="${i}"><div class="row"><div><input type="date" data-b="d" value="${x.d}"></div><div><select data-b="name">${repOpts(x.name)}</select></div><div><input data-b="c" value="${E(x.c)}" placeholder="班級"></div><button class="g r" data-bx="${i}">刪除</button></div><textarea data-b="text">${E(x.text)}</textarea>${x.name ? "" : '<p class="mini er">⚠️ 找不到對應家代（可手動選擇，或留空以未指定姓名上線）</p>'}</div>`).join("") + `<button data-act="bgo">✅ 全部一次上線（${batch.length}）</button>`; }

// ---------- 議題 ----------
const pIss = () => { const e = edit && S.issues.find(i => i.ID == edit) || {};
  return `<section class="f"><h2>${e.ID ? "編輯議題" : "新增議題"}</h2><div class="row"><div><label>日期</label><input type="date" id="i-d" value="${e["日期"] || S.today}"></div><div><label>標題</label><input id="i-t" value="${E(e["標題"] || "")}" placeholder="例如：螞蟻上樹有油耗味"></div></div>
<label>反映摘要（不要寫姓名）</label><textarea id="i-s">${E(e["摘要"] || "")}</textarea><label>營養師／學校回覆（未回覆請留空）</label><textarea id="i-r">${E(e["回覆"] || "")}</textarea>
<div class="row"><div><label>狀態</label><select id="i-st">${["auto", "追蹤中", "已回覆", "已說明"].map(v => `<option value="${v}" ${(e["狀態"] || "auto") == v ? "selected" : ""}>${v == "auto" ? "自動（有回覆＝已回覆）" : v}</option>`).join("")}</select></div><div><label>前台</label><label style="font-weight:400"><input type="checkbox" id="i-pub" ${e["公開"] == "否" ? "" : "checked"}> 公開顯示</label></div></div>
${e.ID && H.urls(e["照片連結"]).length ? `<label>已有照片（勾選「移除」後按儲存）</label><div class="pks">${H.urls(e["照片連結"]).map(u => `<div class="pk"><a href="${E(H.big(u))}" target="_blank" rel="noopener"><img src="${E(H.thumb(u))}" loading="lazy" referrerpolicy="no-referrer" alt=""></a><label><input type="checkbox" data-irm="${E(u)}"> 移除</label></div>`).join("")}</div>` : ""}<label>追加照片</label><input type="file" id="i-p" accept="image/*" multiple><div class="th" id="i-th"></div><button id="i-go">💾 儲存</button>${e.ID ? '<button class="g" id="i-new">取消編輯</button>' : ""}</section>
<h2>全部議題（${S.issues.length}）</h2>${[...S.issues].sort((a, b) => a["日期"] < b["日期"] ? 1 : -1).map(i => `<div class="card2"><div class="dh">${H.chip(i["狀態"])}<b>${E(i["標題"])}</b><span class="mu">${md(i["日期"])}</span>${i["公開"] == "否" ? '<span class="chip in">不公開</span>' : ""}</div><p class="mini">${E(i["摘要"]).slice(0, 80)}</p>${H.urls(i["照片連結"]).length ? `<div class="pks">${H.urls(i["照片連結"]).map(u => `<div class="pk"><a href="${E(H.big(u))}" target="_blank" rel="noopener"><img src="${E(H.thumb(u))}" loading="lazy" referrerpolicy="no-referrer" alt=""></a></div>`).join("")}</div>` : ""}<button class="g" data-ie="${i.ID}">編輯／管理照片</button><button class="g r" data-id2="${i.ID}">刪除</button></div>`).join("")}`; };
function bindIss() {
  $("i-go").onclick = () => { const t = $("i-t").value.trim(); if (!t) return toast("請填標題", 1);
    run(async () => { const photos = []; for (const f of $("i-p").files) { const p = await H.shrink(f); if (p) photos.push(p.b64); }
      await api("issue_save", { id: edit || undefined, date: $("i-d").value, title: t, summary: $("i-s").value.trim(), reply: $("i-r").value.trim(), status: $("i-st").value, public: $("i-pub").checked, photos, removePhotos: [...document.querySelectorAll("[data-irm]:checked")].map(x => x.dataset.irm) }); edit = null; await reload(); }, "✅ 已儲存", $("i-go")); };
  $("i-p").onchange = async e => { const o = []; for (const f of e.target.files) { const p = await H.shrink(f); if (p) o.push(p.u); } $("i-th").innerHTML = o.map(u => `<img src="${u}" alt="">`).join(""); };
  if ($("i-new")) $("i-new").onclick = () => { edit = null; render(); }; }

// ---------- 紀錄查詢 ----------
const pRec = () => { const q = rf.q.trim(); const rs = S.records.filter(r => (!rf.s || r["狀態"] == rf.s) && (!q || (r["姓名"] + r["班級"] + r["試菜內容"] + r["日期"]).includes(q))).sort((a, b) => a["日期"] < b["日期"] ? 1 : -1);
  return `<section class="f"><h2>紀錄查詢</h2><div class="row"><div><input id="r-q" placeholder="姓名／班級／日期／內容" value="${E(rf.q)}"></div><div><select id="r-s"><option value="">全部狀態</option>${["待審", "已發布", "僅記錄", "退回", "隱藏"].map(s => `<option ${rf.s == s ? "selected" : ""}>${s}</option>`).join("")}</select></div></div><div class="mini">共 ${rs.length} 筆（顯示前 ${Math.min(rf.n, rs.length)} 筆）</div></section>${rs.slice(0, rf.n).map(recCard).join("")}${rs.length > rf.n ? '<button class="g" data-act="more">顯示更多</button>' : ""}`; };

// ---------- 家代統計 ----------
function stats() { const today = S.today, wk = H.monday(today), mon = today.slice(0, 8);
  const inP = d => sts.per == "all" || (sts.per == "week" && d >= wk && d <= H.addDays(wk, 6)) || (sts.per == "month" && d.startsWith(mon.slice(0, 7))) || (sts.per == "d30" && d >= H.addDays(today, -30) && d <= today) || (sts.per == "d7" && d >= H.addDays(today, -7) && d <= today);
  return reps().map(r => { const n = r["姓名"], sdAll = S.schedule.filter(x => x.n == n).map(x => x.d).sort(), rec = S.records.filter(x => x["姓名"] == n), have = new Set(rec.map(x => x["日期"])),
      doneAll = rec.filter(x => DONE.has(x["狀態"])).map(x => x["日期"]).sort(), done = doneAll.filter(inP), sd = sdAll.filter(inP);
    return { n, c: r["班級"], g: gradeOf(r["班級"]), sdAll, sd, done, doneAll, miss: sd.filter(d => d < today && !have.has(d)), next: sdAll.find(d => d >= today) || "", last: doneAll[doneAll.length - 1] || "" }; }); }
const SORTS = [["cls", "班級"], ["name", "姓名"], ["done", "已試菜次數"], ["last", "最近試菜日"], ["miss", "缺填次數"], ["sched", "排班次數"], ["next", "下次輪值日"]];
function statRows() { const q = sts.q.trim(), today = S.today, soon = H.addDays(today, 7);
  const rows = stats().filter(x => (!sts.grade || x.g == sts.grade) && (!q || (x.n + x.c).includes(q)) && ({ all: 1, zero: !x.doneAll.length, some: x.doneAll.length > 0, miss: x.miss.length > 0, nosch: !x.sdAll.length, soon: x.next && x.next <= soon }[sts.f]));
  const key = { cls: (a, b) => cmpCls(a.c, b.c), name: (a, b) => a.n.localeCompare(b.n, "zh-Hant"), done: (a, b) => a.done.length - b.done.length, last: (a, b) => (a.last || "").localeCompare(b.last || ""), miss: (a, b) => a.miss.length - b.miss.length, sched: (a, b) => a.sd.length - b.sd.length, next: (a, b) => (a.next || "9999").localeCompare(b.next || "9999") }[sts.sort];
  return rows.sort((a, b) => sts.dir * key(a, b) || cmpCls(a.c, b.c)); }
const TH = [["cls", "班級"], ["name", "姓名"], ["done", "已試菜"], ["sched", "排班"], ["miss", "缺填"], ["last", "最近試菜"], ["next", "下次輪值"]];
const mdd = d => d.slice(5, 7) + "/" + d.slice(8, 10);
function pStat() { const all = stats(), rows = statRows(), none = all.filter(x => !x.doneAll.length).length;
  return `<section class="f"><h2>家代試菜統計</h2><div class="st"><div><b>${all.length}</b>家代</div><div><b>${all.length - none}</b>已試菜</div><div><b>${none}</b>還沒試菜</div><div><b>${all.filter(x => x.miss.length).length}</b>有缺填</div></div>
<div class="row"><div><input id="s-q" placeholder="搜尋姓名／班級" value="${E(sts.q)}"></div><div><select id="s-grade"><option value="">全部年級</option>${[1, 2, 3, 4, 5, 6].map(g => `<option value="${g}" ${sts.grade == g ? "selected" : ""}>${GN[g]}年級</option>`).join("")}</select></div></div>
<label>顯示</label>${seg("sf", sts.f, [["all", "全部"], ["zero", "還沒試菜"], ["some", "已試菜"], ["miss", "有缺填"], ["soon", "7天內輪值"], ["nosch", "未排班"]])}
<label>統計期間</label>${seg("sper", sts.per, [["all", "全部"], ["week", "本週"], ["d7", "近7天"], ["month", "本月"], ["d30", "近30天"]])}
<label>排序 <span class="mini">（也可以直接點表格的欄位標題；再點一次反向）</span></label>${seg("ssort", sts.sort, SORTS)}<button class="g" data-act="dir">${sts.dir > 0 ? "▲ 由小到大" : "▼ 由大到小"}</button>
<p class="mini">顯示 ${rows.length} / ${all.length} 位（次數依「統計期間」計算；「還沒試菜」看全部期間）。點一列可查看該家代的紀錄。</p>
<div class="tb-w"><table class="tb"><tr>${TH.map(([k, v]) => `<th data-sort="${k}" class="${sts.sort == k ? "on" : ""}">${v} ${sts.sort == k ? (sts.dir > 0 ? "▲" : "▼") : "↕"}</th>`).join("")}<th>已試菜日期</th></tr>${rows.map(x => `<tr class="${x.doneAll.length ? "" : "zero"}" data-go="${E(x.n)}"><td>${E(x.c)}</td><td>${E(x.n)}</td><td><b>${x.done.length}</b></td><td>${x.sd.length}</td><td>${x.miss.length ? `<span style="color:var(--rd)">${x.miss.length}（${x.miss.map(md).join("、")}）</span>` : "0"}</td><td>${x.last ? md(x.last) : "—"}</td><td>${x.next ? md(x.next) : "—"}</td><td>${x.done.map(md).join("、")}</td></tr>`).join("")}</table></div>
<button class="g" data-act="csv">⬇️ 統計表 CSV（一人一列）</button><button class="g" data-act="csv2">⬇️ 逐筆清單 CSV（依日期排序）</button><p class="mini">兩個檔案都依目前的篩選結果匯出，內含姓名，請妥善保管。</p></section>`; }
function dateRows() { const names = new Set(statRows().map(x => x.n)), SL = { ok: "已上線", wait: "待審", in: "退回", hide: "已下架", rec: "已完成（僅記錄）", miss: "缺填", today: "今日尚未填", later: "尚未輪到" }, seen = new Set(), rows = [];
  S.schedule.forEach(x => { if (names.has(x.n) && !seen.has(x.d + "|" + x.n)) { seen.add(x.d + "|" + x.n); rows.push({ d: x.d, n: x.n, c: x.c, sch: "是" }); } });
  S.records.forEach(r => { const n = r["姓名"], k = r["日期"] + "|" + n; if (!n || !names.has(n) || seen.has(k)) return; seen.add(k); rows.push({ d: r["日期"], n, c: r["班級"], sch: "否" }); });
  rows.sort((a, b) => a.d.localeCompare(b.d) || cmpCls(a.c, b.c));
  return [["日期", "星期", "班級", "姓名", "狀態", "是否排班", "來源", "填報時間", "審核時間"], ...rows.map(x => { const r = S.records.find(y => y["姓名"] == x.n && y["日期"] == x.d && y["狀態"] != "隱藏") || S.records.find(y => y["姓名"] == x.n && y["日期"] == x.d) || {};
    return [x.d.replace(/-/g, "/"), wd(x.d), x.c, x.n, SL[stOf(x.n, x.d)], x.sch, r["來源"] || "", r["填報時間"] || "", r["審核時間"] || ""]; })]; }

// ---------- 每日輪值對照 ----------
function pDay() { const today = S.today, wk = H.monday(today); let from, to;
  ({ week: () => [from, to] = [wk, H.addDays(wk, 4)], prev: () => [from, to] = [H.addDays(wk, -7), H.addDays(wk, -3)], next: () => [from, to] = [H.addDays(wk, 7), H.addDays(wk, 11)], d30: () => [from, to] = [H.addDays(today, -30), H.addDays(today, 7)], all: () => [from, to] = ["0000", "9999"] }[dly.pre])();
  const dates = [...new Set([...S.schedule.map(x => x.d), ...S.records.map(x => x["日期"])])].filter(d => d >= from && d <= to).sort().reverse();
  const rows = dates.map(d => { const ns = [...new Set(S.schedule.filter(x => x.d == d).map(x => x.n))], ex = [...new Set(S.records.filter(x => x["日期"] == d && x["姓名"] && !ns.includes(x["姓名"])).map(x => x["姓名"]))], c = { ok: 0, wait: 0, miss: 0 };
    ns.forEach(n => { const s = stOf(n, d); if (s == "miss") c.miss++; else if (s == "wait") c.wait++; else if (s != "today" && s != "later") c.ok++; }); return { d, ns, ex, c }; }).filter(r => !dly.miss || r.c.miss);
  return `<section class="f"><h2>每日輪值對照</h2>${seg("pre", dly.pre, [["week", "本週"], ["prev", "上週"], ["next", "下週"], ["d30", "近30天"], ["all", "全部"]])}
<label style="font-weight:400;margin-top:8px"><input type="checkbox" id="y-miss" ${dly.miss ? "checked" : ""}> 只看有缺填的日子</label><p class="mini">✅已上線／已完成　⏳待審　↩退回　🔽下架　📝僅記錄　❌缺填　🕓尚未輪到　（點姓名看該家代紀錄）</p>
${rows.length ? `<div class="tb-w"><table class="tb"><tr><th>日期</th><th>統計</th><th>輪值家代</th></tr>${rows.map(r => `<tr class="${r.c.miss ? "zero" : ""}"><td style="white-space:nowrap"><b>${md(r.d)}</b>（${wd(r.d)}）</td><td style="white-space:nowrap">應 ${r.ns.length}<br>${r.c.ok ? `✅${r.c.ok} ` : ""}${r.c.wait ? `⏳${r.c.wait} ` : ""}${r.c.miss ? `<span style="color:var(--rd)">❌${r.c.miss}</span>` : ""}</td><td><div class="cxs">${r.ns.map(n => cx(n, r.d, ` <span class="mini">${E((S.schedule.find(x => x.d == r.d && x.n == n) || {}).c || "")}</span>`)).join("")}${r.ex.map(n => cx(n, r.d, "（補登）")).join("")}${!r.ns.length && !r.ex.length ? "—" : ""}</div></td></tr>`).join("")}</table></div>` : '<div class="empty">這段期間沒有資料</div>'}</section>`; }

// ---------- 家代與設定 ----------
const link = r => new URL("rep.html?t=" + r["Token"], location.href).href;
function linkRows() { const q = lk.q.trim(), sc = n => S.schedule.filter(x => x.n == n).length, dn_ = n => S.records.filter(r => r["姓名"] == n && DONE.has(r["狀態"])).length;
  return S.roster.filter(r => (!lk.grade || r["年級"] == lk.grade) && (!q || (r["姓名"] + r["班級"]).includes(q)) && ({ all: 1, off: r["啟用"] == "否", sched: sc(r["姓名"]) > 0, nosch: !sc(r["姓名"]) }[lk.f]))
    .sort((a, b) => lk.sort == "name" ? a["姓名"].localeCompare(b["姓名"], "zh-Hant") : cmpCls(a["班級"], b["班級"])).map(r => ({ r, sc: sc(r["姓名"]), dn: dn_(r["姓名"]) })); }
function pSet() { const lr = linkRows(), menus = [...S.menu].sort((a, b) => a["日期"] < b["日期"] ? 1 : -1).slice(0, 14);
  return `<section class="f"><h2>家代個人填寫連結（${S.roster.length} 位）</h2><p class="mini">每位家代用自己的連結填寫，只看得到自己的輪值日。連結外流時按「重產」即可作廢舊連結。</p>
<div class="row"><div><input id="l-q" placeholder="搜尋姓名／班級" value="${E(lk.q)}"></div><div><select id="l-grade"><option value="">全部年級</option>${[1, 2, 3, 4, 5, 6].map(g => `<option value="${g}" ${lk.grade == g ? "selected" : ""}>${GN[g]}年級</option>`).join("")}</select></div>
<div><select id="l-f">${[["all", "全部"], ["sched", "有排班"], ["nosch", "尚未排班"], ["off", "已停用"]].map(([k, v]) => `<option value="${k}" ${lk.f == k ? "selected" : ""}>${v}</option>`).join("")}</select></div><div><select id="l-sort"><option value="cls">依班級</option><option value="name" ${lk.sort == "name" ? "selected" : ""}>依姓名</option></select></div></div>
<p class="mini">顯示 ${lr.length} / ${S.roster.length} 位</p><div class="tb-w"><table class="tb"><tr><th>班級</th><th>姓名</th><th>排班／已試</th><th>連結</th></tr>${lr.map(({ r, sc, dn }) => `<tr><td>${E(r["班級"])}</td><td>${E(r["姓名"])}${r["啟用"] == "否" ? " <span class='chip in'>停用</span>" : ""}</td><td>${sc}／${dn}</td><td><button class="g" data-cp="${E(r["姓名"])}">複製連結</button><button class="g" data-cm="${E(r["姓名"])}">複製邀請訊息</button><button class="g" data-nt="${E(r["姓名"])}">重產</button><button class="g" data-en="${E(r["姓名"])}" data-v="${r["啟用"] == "否" ? 1 : 0}">${r["啟用"] == "否" ? "啟用" : "停用"}</button></td></tr>`).join("")}</table></div><button class="g" data-act="lcsv">⬇️ 下載目前列表連結 CSV</button></section>
<section class="f"><h2>教育部平台菜單與菜色照片</h2><p class="mini">系統會向「教育部校園食材登錄平台」查詢東門國小的每日菜單與菜色照片，存起來後自動用在：家代填寫頁、補登、前台（前台會標示資料來源；平台照片只在那天沒有家代照片時顯示）。家代頁與補登選日期時會自動查詢，這裡用來手動補查、修改菜色或關閉某天的平台照片。</p>
<div class="row"><div><label>日期</label><input type="date" id="m-d" value="${S.today}"></div></div><button id="m-one">同步這一天</button><button class="g" id="m-14">同步最近 14 天（平日）</button><div id="m-o"></div>
<div class="tb-w" style="margin-top:8px"><table class="tb"><tr><th>日期</th><th>菜色</th><th>來源</th><th>平台照片</th><th></th></tr>${menus.map(m => { let n = 0; try { n = JSON.parse(m["平台照片"] || "[]").length; } catch (e) {} const on = m["顯示照片"] != "否";
  return `<tr><td style="white-space:nowrap">${md(m["日期"])}</td><td>${E(m["菜色"])}</td><td>${E(m["來源"])}</td><td style="white-space:nowrap">${n ? n + " 張・" + (on ? "顯示" : "不顯示") : "—"}</td><td style="white-space:nowrap"><button class="g" data-me="${m["日期"]}">✏️ 改菜色</button>${n ? `<button class="g" data-mp="${m["日期"]}" data-v="${on ? 0 : 1}">${on ? "隱藏照片" : "顯示照片"}</button>` : ""}</td></tr>`; }).join("") || '<tr><td colspan="5" class="mu">尚無菜單</td></tr>'}</table></div></section>
<section class="f"><h2>匯入輪值班表與家代名冊</h2><p class="mini">選擇「輪值表.xlsx」與「家長代表名冊.xlsx」。檔案只在你的裝置解析，姓名只會存進私有試算表，不會出現在前台。重新匯入會保留每位家代原本的個人連結。</p>
<label>輪值表</label><input type="file" id="xs" accept=".xlsx,.xls"><label>家長代表名冊</label><input type="file" id="xr" accept=".xlsx,.xls"><button id="xgo">解析並匯入</button></section>
<section class="f"><h2>匯入 v2 舊資料</h2><p class="mini">把 v2 的「試菜」「反映」分頁搬進 v3（全部以已上線匯入）。</p><label style="font-weight:400"><input type="checkbox" id="mg-f"> 強制匯入（v3 已有資料時）</label><button id="mg">匯入舊資料</button></section>
<section class="f"><h2>系統狀態</h2><button class="g" id="sy">檢查</button><pre id="sy-o" style="display:none"></pre><p class="mini">後端版本：${E(S.version)}</p></section>`; }
function bindSet() {
  const lib = () => window.XLSX ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  const aoa = async f => { const wb = XLSX.read(await f.arrayBuffer(), { type: "array" }); return wb.SheetNames.map(n => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true })); };
  $("xgo").onclick = () => run(async () => { if (!$("xs").files[0] || !$("xr").files[0]) throw new Error("請選擇輪值表與名冊兩個檔案"); await lib();
    const res = parseRS(await aoa($("xs").files[0]), (await aoa($("xr").files[0]))[0]); if (!res.schedule.length) throw new Error("沒有解析到任何輪值，請確認檔案格式");
    if (!confirm(`解析到家代 ${new Set(res.roster.map(x => x.name)).size} 位、${new Set(res.schedule.map(x => x.date)).size} 天共 ${res.schedule.length} 筆輪值（${res.missing.length} 個名字不在名冊，多為行政代表，會略過）。\n要匯入並取代舊班表嗎？`)) return null;
    const r = await api("rs_import", { roster: res.roster, schedule: res.schedule }); await reload(); return r; }, r => r ? `✅ 新增 ${r.added} 位、更新 ${r.updated} 位，班表 ${r.schedule} 筆` : "", $("xgo"));
  $("mg").onclick = () => run(async () => { const r = await api("migrate_v2", { force: $("mg-f").checked }); await reload(); return r; }, r => `✅ 已匯入紀錄 ${r.records} 筆、議題 ${r.issues} 則`, $("mg"));
  const showM = (r, o) => { o.innerHTML = r.dishes && !r.failed ? `<p class="msg ok">✅ ${md(r.date)}：${E(r.dishes)}（${E(r.source)}${r.via ? "，由這台裝置的瀏覽器取得" : ""}${r.kept ? "，保留手動菜色" : ""}；平台照片 ${r.pics.length} 張）</p>${H.moeGal(r.pics, false)}`
    : `<p class="msg er">⚠️ 沒有取得 ${md(r.date)} 的菜單（假日，或平台尚未登錄這天）。</p><details><summary class="mini">技術細節（平日也失敗時，請把這段貼給開發者）</summary><pre>${E([...(r.log || []), ...(r.clog || [])].join("\n"))}\n\n${E(r.raw || "")}</pre></details>`; };
  $("m-one").onclick = () => run(async () => { const d = $("m-d").value, r = await getMenu(d, true); r.date = d; await reload(); $("m-d").value = d; showM(r, $("m-o")); }, null, $("m-one"));
  $("m-14").onclick = () => run(async () => { const ds = []; for (let i = 13; i >= 0; i--) { const d = H.addDays(S.today, -i), w = new Date(d + "T12:00:00Z").getUTCDay(); if (w > 0 && w < 6) ds.push(d); }
    const r = await syncMenus(ds, false); await reload(); $("m-o").innerHTML = `<p class="msg ${r.ok ? "ok" : "er"}">已有菜單 ${r.ok} 天，${r.fail} 天沒有取得</p>`; }, null, $("m-14"));
  $("sy").onclick = () => run(async () => { const r = await api("status"); const o = $("sy-o"); o.style.display = ""; o.textContent = JSON.stringify(r, null, 1); }); }

// ---------- 事件（集中處理）----------
const pane = $("pane"), cp = s => navigator.clipboard.writeText(s).then(() => toast("已複製"), () => toast("複製失敗，請手動複製", 1)), repOf = n => S.roster.find(x => x["姓名"] == n);
pane.addEventListener("click", async e => { const t = e.target;
  if (t.closest("[data-a]") && t.closest(".rv")) return recAct(t.closest("[data-a]"));
  const sg = t.closest(".seg button"); if (sg) { const k = sg.parentNode.dataset.seg, v = sg.dataset.v; if (k == "pre") dly.pre = v; if (k == "sf") sts.f = v; if (k == "sper") sts.per = v; if (k == "ssort") sts.sort = v; return render(); }
  const th = t.closest("th[data-sort]"); if (th) { const k = th.dataset.sort; if (sts.sort == k) sts.dir *= -1; else { sts.sort = k; sts.dir = /done|miss|sched|last/.test(k) ? -1 : 1; } return render(); }
  if (t.dataset.me) { const m = S.menu.find(x => x["日期"] == t.dataset.me), v = prompt(`修改 ${md(t.dataset.me)} 的菜色（用「、」分隔）`, m ? m["菜色"] : ""); if (v != null && v.trim()) run(async () => { await api("menu_set", { date: t.dataset.me, dishes: v.trim(), source: "幹部" }); await reload(); }, "已更新菜色"); return; }
  if (t.dataset.mp) return run(async () => { await api("menu_set", { date: t.dataset.mp, showPics: t.dataset.v == "1" }); await reload(); }, "已更新");
  const g = t.closest("[data-go]"); if (g && !t.closest("button")) { rf.q = g.dataset.go; rf.s = ""; return go("rec"); }
  const act = t.dataset.act;
  if (act == "all" && confirm(`確定將 ${pend().length} 筆全部上線？`)) run(async () => { await api("approve", { all: true }); await reload(); }, r => `✅ 已上線 ${r.count} 筆`, t);
  if (act == "more") { rf.n += 60; render(); }
  if (act == "dir") { sts.dir *= -1; render(); }
  if (act == "csv") dl("家代試菜統計.csv", csv([["班級", "姓名", "已試菜次數", "排班次數", "缺填次數", "最近試菜", "下次輪值", "已試菜日期", "缺填日期"], ...statRows().map(x => [x.c, x.n, x.done.length, x.sd.length, x.miss.length, x.last ? mdd(x.last) : "", x.next ? mdd(x.next) : "", x.done.map(mdd).join(","), x.miss.map(mdd).join(",")])]));
  if (act == "csv2") dl("試菜逐筆清單.csv", csv(dateRows()));
  if (act == "lcsv") dl("家代連結.csv", csv([["班級", "姓名", "連結"], ...linkRows().map(({ r }) => [r["班級"], r["姓名"], link(r)])]));
  if (act == "bgo") run(async () => { const items = batch.map(x => { const rp = repOf(x.name); return { date: x.d, name: x.name, cls: rp ? rp["班級"] : x.c, text: x.text, status: "已發布" }; });
    const r = await api("rec_add", { items }), ds = [...new Set(items.map(x => x.date))]; batch = []; const m = await syncMenus(ds, false); await reload(); return { r, m }; }, ({ r, m }) => `✅ 已上線 ${r.count} 筆${r.skipped.length ? "，略過重複 " + r.skipped.length + " 筆" : ""}；菜單 ${m.ok} 天`, t);
  if (act == "dgo") { const rows = dn.filter(x => x.d && x.name); if (!rows.length) return toast("沒有可匯入的資料", 1); if (!confirm(`匯入 ${rows.length} 筆？`)) return;
    run(async () => { const items = rows.map(x => ({ date: x.d, name: x.name, cls: (repOf(x.name) || {})["班級"] || "", text: $("d-text").value.trim() || "試菜完成", status: $("d-st").value, source: "幹部匯入" }));
      const sync = $("d-sync").checked, r = await api("rec_add", { items }); dn = []; let m = { ok: 0 }; if (sync) m = await syncMenus([...new Set(items.map(x => x.date))], false); await reload(); return { r, m, sync }; },
      ({ r, m, sync }) => `✅ 已匯入 ${r.count} 筆${r.skipped.length ? "，略過重複 " + r.skipped.length + " 筆" : ""}${sync ? "；菜單 " + m.ok + " 天" : ""}`, t); }
  if (t.dataset.bx != null) { batch.splice(+t.dataset.bx, 1); drawBatch(); }
  if (t.dataset.dx != null) { dn.splice(+t.dataset.dx, 1); drawDone(); }
  if (t.dataset.ie) { edit = t.dataset.ie; render(); scrollTo(0, 0); }
  if (t.dataset.id2 && confirm("確定刪除這則議題？")) run(async () => { await api("issue_delete", { id: t.dataset.id2 }); await reload(); }, "已刪除");
  if (t.dataset.cp) cp(link(repOf(t.dataset.cp)));
  if (t.dataset.cm) cp(`${t.dataset.cm} 家長代表您好，這是您的試菜填寫專屬連結（請勿轉傳）：\n${link(repOf(t.dataset.cm))}\n輪值當天用手機開啟，填寫試菜心得並上傳餐點照片即可，送出後由幹部審核。謝謝！`);
  if (t.dataset.nt && confirm(`重產 ${t.dataset.nt} 的連結？舊連結立刻失效。`)) run(async () => { await api("rep_set", { name: t.dataset.nt, newToken: true }); await reload(); }, "✅ 已重產");
  if (t.dataset.en) run(async () => { await api("rep_set", { name: t.dataset.en, enabled: t.dataset.v == "1" }); await reload(); }, "已更新"); });
let dbt; const later = fn => { clearTimeout(dbt); dbt = setTimeout(fn, 350); }, keep = id => { render(); const i = $(id); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } };
pane.addEventListener("input", e => { const t = e.target, i = t.closest(".card2")?.dataset.i;
  if (t.id == "r-q") { rf.q = t.value; later(() => keep("r-q")); } if (t.id == "s-q") { sts.q = t.value; later(() => keep("s-q")); } if (t.id == "l-q") { lk.q = t.value; later(() => keep("l-q")); }
  if (t.dataset.b && i != null) batch[i][t.dataset.b] = t.value; if (t.dataset.d && i != null) { dn[i][t.dataset.d] = t.value; } });
pane.addEventListener("change", e => { const t = e.target, i = t.closest(".card2")?.dataset.i;
  if (t.dataset.d && i != null) { dn[i][t.dataset.d] = t.value; drawDone(); }
  ({ "r-s": () => { rf.s = t.value; render(); }, "s-sort": () => { sts.sort = t.value; render(); }, "s-grade": () => { sts.grade = t.value; render(); }, "s-f": () => { sts.f = t.value; render(); }, "s-per": () => { sts.per = t.value; render(); },
    "l-grade": () => { lk.grade = t.value; render(); }, "l-f": () => { lk.f = t.value; render(); }, "l-sort": () => { lk.sort = t.value; render(); }, "y-miss": () => { dly.miss = t.checked; render(); } }[t.id] || (() => {}))(); });
})();
