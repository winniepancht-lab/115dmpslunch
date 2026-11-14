(() => {
const C = window.CONFIG, { $, E, md, wd } = H;
let KEY = localStorage.getItem("dmpa_key") || "", S = null, tab = "pend", edit = null, batch = [], rf = { q: "", s: "", n: 60 }, sf = "all", sq = "";
const SKIP = new Set(["試菜人員", "家長：", "家長:", "家長", "行政代表", "家長代表", "試吃意見", "輪值時間", "人員"]);
const api = async (op, p = {}) => {
  const r = await (await fetch(C.GAS_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(Object.assign({ key: KEY, op }, p)) })).json();
  if (r.status !== "success") throw new Error(r.message || "失敗"); return r; };
let tt; const toast = (t, er) => { const e = $("toast"); e.textContent = t; e.className = er ? "er" : ""; e.style.display = "block"; clearTimeout(tt); tt = setTimeout(() => e.style.display = "none", 3500); };
const run = async (fn, ok) => { try { const r = await fn(); if (ok) toast(typeof ok == "function" ? ok(r) : ok); return r; } catch (e) { toast("⚠️ " + (e.message == "Failed to fetch" ? "連線失敗，請確認是否已送出，避免重複" : e.message), 1); } };
const reload = async () => { S = await api("state"); render(); };
const pend = () => S.records.filter(r => r["狀態"] == "待審");
const chipOf = s => `<span class="chip ${s == "待審" ? "wait" : s == "已發布" ? "ok" : "in"}">${{ "待審": "⏳ 待審", "已發布": "✅ 已上線", "退回": "↩ 已退回", "隱藏": "🔽 已下架" }[s] || s}</span>`;
const nm = n => E(n || "（未指定）");

// ---------- 登入 ----------
async function login() { KEY = $("key").value.trim(); $("lm").textContent = "登入中…";
  try { await reload(); localStorage.setItem("dmpa_key", KEY); $("login").style.display = "none"; $("main").style.display = ""; }
  catch (e) { $("lm").textContent = "⚠️ " + e.message; } }
$("lg").onclick = login; $("key").onkeydown = e => { if (e.key == "Enter") login(); };
if (KEY) { $("key").value = KEY; login(); }

// ---------- 版面 ----------
const TABS = [["pend", "⏳ 待審核"], ["add", "✏️ 補登"], ["iss", "💬 議題"], ["rec", "🔍 紀錄查詢"], ["stat", "📊 家代統計"], ["set", "⚙️ 班表與設定"]];
function render() {
  $("tabs").innerHTML = TABS.map(([k, v]) => `<button class="${k == tab ? "on" : ""}" data-t="${k}">${v}${k == "pend" && pend().length ? `<span class="badge2">${pend().length}</span>` : ""}</button>`).join("");
  $("pane").innerHTML = { pend: pPend, add: pAdd, iss: pIss, rec: pRec, stat: pStat, set: pSet }[tab]();
  ({ add: bindAdd, iss: bindIss, set: bindSet, stat: () => {} }[tab] || (() => {}))();
}
$("tabs").onclick = e => { const b = e.target.closest("button"); if (b) { tab = b.dataset.t; render(); } };

// ---------- 紀錄卡（審核與查詢共用）----------
const recCard = r => {
  const ph = H.urls(r["照片連結"]), s = r["狀態"];
  const acts = (s == "待審" ? `<button data-a="ok">✅ 核可上線</button><button class="g" data-a="no">↩ 退回</button>` : s == "已發布" ? `<button class="g" data-a="hide">🔽 下架</button>` : `<button data-a="ok">✅ 上線</button>`) + `<button class="g" data-a="save">💾 存修改</button><button class="g" data-a="del">🗑 刪除</button>`;
  return `<div class="rv" data-id="${r.ID}"><div class="dh"><div class="badge">${md(r["日期"])}<small>週${wd(r["日期"])}</small></div>
<div><b>${nm(r["姓名"])}</b> <span class="mu">${E(r["班級"])}</span><br><span class="mini">${r["填報時間"] ? "填報 " + E(r["填報時間"]) : "無填報時間"}・${E(r["來源"] || "")}${r["審核時間"] ? "・審核 " + E(r["審核時間"]) : ""}</span></div>${chipOf(s)}</div>
${r["審核備註"] ? `<p class="mini">備註：${E(r["審核備註"])}</p>` : ""}
${ph.length ? `<div class="pks">${ph.map(u => `<div class="pk"><a href="${E(H.big(u))}" target="_blank" rel="noopener"><img src="${E(H.thumb(u))}" loading="lazy" referrerpolicy="no-referrer" alt=""></a><label><input type="checkbox" data-rm="${E(u)}"> 移除</label></div>`).join("")}</div>` : ""}
<textarea data-k="text">${E(r["試菜內容"])}</textarea>
<div class="mini">追加照片：<input type="file" data-k="add" accept="image/*" multiple></div>
<div><input data-k="note" placeholder="退回原因（家代看得到）" style="margin-top:6px">${acts}</div></div>`; };
async function recAct(e) {
  const b = e.target.closest("button[data-a]"); if (!b) return; const card = b.closest(".rv"), id = card.dataset.id, a = b.dataset.a;
  const text = card.querySelector('[data-k=text]').value, note = card.querySelector('[data-k=note]').value, rm = [...card.querySelectorAll("[data-rm]:checked")].map(x => x.dataset.rm);
  const files = [...card.querySelector('[data-k=add]').files], add = []; for (const f of files) { const p = await H.shrink(f); if (p) add.push(p.b64); }
  const orig = S.records.find(r => r.ID == id), changed = text != orig["試菜內容"] || rm.length || add.length;
  if (a == "del" && !confirm("確定刪除這筆紀錄與照片？無法復原。")) return;
  b.disabled = true;
  const ok = await run(async () => {
    if (a != "del" && (changed || a == "save")) await api("rec_update", { id, text, removePhotos: rm, addPhotos: add });
    if (a == "ok") await api("rec_status", { id, status: "已發布" }); if (a == "no") await api("rec_status", { id, status: "退回", note }); if (a == "hide") await api("rec_status", { id, status: "隱藏" });
    if (a == "del") await api("rec_delete", { id }); await reload(); }, { ok: "✅ 已核可上線", no: "已退回", hide: "已下架", save: "已儲存", del: "已刪除" }[a]);
  if (!ok) b.disabled = false; }
$("pane").addEventListener("click", recAct);

// ---------- 待審核 ----------
const pPend = () => { const p = pend().sort((a, b) => a["日期"] < b["日期"] ? 1 : -1);
  return `<section class="f"><h2>待審核（${p.length}）</h2>${p.length ? `<button id="all">✅ 全部核可上線（${p.length}）</button><span class="mini">逐筆檢查文字與照片後，也可一次上線</span>` : '<div class="empty">🎉 沒有待審核的紀錄</div>'}</section>${p.map(recCard).join("")}`; };
$("pane").addEventListener("click", e => { if (e.target.id == "all" && confirm(`確定將 ${pend().length} 筆全部上線？`)) run(async () => { await api("approve", { all: true }); await reload(); }, r => `✅ 已上線 ${r.count} 筆`); });

// ---------- 補登 ----------
//PARSE-START
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
//PARSE-END
const reps = () => S.roster.filter(r => r["啟用"] != "否");
const repOpts = sel => `<option value="">（不在名單／不指定）</option>` + reps().map(r => `<option value="${E(r["姓名"])}" ${r["姓名"] == sel ? "selected" : ""}>${E(r["姓名"])}（${E(r["班級"])}）</option>`).join("");
const pAdd = () => `<section class="f"><h2>補登單筆紀錄</h2>
<div class="row"><div><label>日期</label><input type="date" id="a-d" value="${S.today}"></div><div><label>家代</label><select id="a-r">${repOpts()}</select></div></div>
<div class="row" id="a-o" style="display:none"><div><label>姓名</label><input id="a-n"></div><div><label>班級</label><input id="a-c" placeholder="例如 206"></div></div>
<label>當日菜色（選填，會顯示在前台）</label><input id="a-m"><label>試菜心得</label><textarea id="a-t"></textarea>
<label>照片</label><input type="file" id="a-p" accept="image/*" multiple><div class="th" id="a-th"></div>
<label><input type="checkbox" id="a-pub" checked> 直接上線（取消勾選則放入待審）</label><button id="a-go">送出補登</button></section>
<section class="f"><h2>批次補登（貼上 LINE 文字，一次上線）</h2><p class="mini">可貼單日文字，或整份 LINE 匯出（會依日期自動分開）。系統會依班表自動對應家代，請在下方確認後再一次上線。照片請之後在「紀錄查詢」追加。</p>
<textarea id="b-t" placeholder="貼上 LINE 試菜文字…"></textarea><div class="row"><div><label>無日期時使用</label><input type="date" id="b-d" value="${S.today}"></div></div><button id="b-parse" class="g">解析</button><div id="b-out"></div></section>`;
let aPics = [];
function bindAdd() {
  $("a-r").onchange = () => $("a-o").style.display = $("a-r").value ? "none" : "";
  $("a-r").dispatchEvent(new Event("change"));
  $("a-p").onchange = async e => { aPics = []; for (const f of e.target.files) { const p = await H.shrink(f); if (p) aPics.push(p); } $("a-th").innerHTML = aPics.map(p => `<img src="${p.u}" alt="">`).join(""); };
  $("a-go").onclick = () => { const rp = S.roster.find(r => r["姓名"] == $("a-r").value), t = $("a-t").value.trim();
    if (!t && !aPics.length) return toast("請填寫心得或選照片", 1);
    run(async () => { const r = await api("rec_add", { items: [{ date: $("a-d").value, name: rp ? rp["姓名"] : $("a-n").value.trim(), cls: rp ? rp["班級"] : $("a-c").value.trim(), text: t, photos: aPics.map(p => p.b64), status: $("a-pub").checked ? "已發布" : "待審" }] });
      if ($("a-m").value.trim()) await api("menu_set", { date: $("a-d").value, dishes: $("a-m").value.trim() }); aPics = []; await reload(); return r; }, r => r.skipped.length ? "這位家代這天已有紀錄，已略過" : "✅ 已補登"); };
  $("b-parse").onclick = () => { const t = $("b-t").value; batch = (/^\d\d:\d\d\t/m.test(t) ? fromLine(t) : fromText(t, $("b-d").value)).map(x => {
      const m = S.schedule.filter(s => s.d == x.d && x.c && String(s.c).split("/").some(k => k.startsWith(x.c)))[0]; return { d: x.d || $("b-d").value, c: x.c, name: m ? m.n : "", text: x.l.join("\n") }; });
    drawBatch(); }; }
function drawBatch() { const o = $("b-out"); if (!batch.length) { o.innerHTML = '<p class="mu">沒有解析到試菜內容</p>'; return; }
  o.innerHTML = batch.map((x, i) => `<div class="card2" data-i="${i}"><div class="row"><div><input type="date" data-b="d" value="${x.d}"></div><div><select data-b="name">${repOpts(x.name)}</select></div><div><input data-b="c" value="${E(x.c)}" placeholder="班級"></div><button class="g r" data-bx="${i}">刪除</button></div><textarea data-b="text">${E(x.text)}</textarea>${x.name ? "" : '<p class="mini er">⚠️ 找不到對應家代（可手動選擇，或留空以未指定姓名上線）</p>'}</div>`).join("") + `<button id="b-go">✅ 全部一次上線（${batch.length}）</button>`;
  o.oninput = e => { const i = e.target.closest(".card2").dataset.i, k = e.target.dataset.b; if (k) batch[i][k == "name" ? "name" : k] = e.target.value; };
  o.onclick = e => { if (e.target.dataset.bx != null) { batch.splice(+e.target.dataset.bx, 1); drawBatch(); } if (e.target.id == "b-go") run(async () => {
    const items = batch.map(x => { const rp = S.roster.find(r => r["姓名"] == x.name); return { date: x.d, name: x.name, cls: rp ? rp["班級"] : x.c, text: x.text, status: "已發布" }; });
    const r = await api("rec_add", { items }); batch = []; await reload(); return r; }, r => `✅ 已上線 ${r.count} 筆${r.skipped.length ? "，略過重複 " + r.skipped.length + " 筆" : ""}`); }; }

// ---------- 議題 ----------
const pIss = () => { const e = edit && S.issues.find(i => i.ID == edit) || {};
  return `<section class="f"><h2>${e.ID ? "編輯議題" : "新增議題"}</h2><div class="row"><div><label>日期</label><input type="date" id="i-d" value="${e["日期"] || S.today}"></div><div><label>標題</label><input id="i-t" value="${E(e["標題"] || "")}" placeholder="例如：螞蟻上樹有油耗味"></div></div>
<label>反映摘要（不要寫姓名）</label><textarea id="i-s">${E(e["摘要"] || "")}</textarea><label>營養師／學校回覆（未回覆請留空）</label><textarea id="i-r">${E(e["回覆"] || "")}</textarea>
<div class="row"><div><label>狀態</label><select id="i-st">${["auto", "追蹤中", "已回覆", "已說明"].map(v => `<option value="${v}" ${(e["狀態"] || "auto") == v ? "selected" : ""}>${v == "auto" ? "自動（有回覆＝已回覆）" : v}</option>`).join("")}</select></div><div><label>前台</label><label style="font-weight:400"><input type="checkbox" id="i-pub" ${e["公開"] == "否" ? "" : "checked"}> 公開顯示</label></div></div>
<label>追加照片</label><input type="file" id="i-p" accept="image/*" multiple><button id="i-go">💾 儲存</button>${e.ID ? '<button class="g" id="i-new">取消編輯</button>' : ""}</section>
<h2>全部議題（${S.issues.length}）</h2>${[...S.issues].sort((a, b) => a["日期"] < b["日期"] ? 1 : -1).map(i => `<div class="card2"><div class="dh">${H.chip(i["狀態"])}<b>${E(i["標題"])}</b><span class="mu">${md(i["日期"])}</span>${i["公開"] == "否" ? '<span class="chip in">不公開</span>' : ""}</div><p class="mini">${E(i["摘要"]).slice(0, 80)}</p><button class="g" data-ie="${i.ID}">編輯</button><button class="g r" data-id2="${i.ID}">刪除</button></div>`).join("")}`; };
function bindIss() {
  $("i-go").onclick = () => { const t = $("i-t").value.trim(); if (!t) return toast("請填標題", 1);
    run(async () => { const photos = []; for (const f of $("i-p").files) { const p = await H.shrink(f); if (p) photos.push(p.b64); }
      await api("issue_save", { id: edit || undefined, date: $("i-d").value, title: t, summary: $("i-s").value.trim(), reply: $("i-r").value.trim(), status: $("i-st").value, public: $("i-pub").checked, photos }); edit = null; await reload(); }, "✅ 已儲存"); };
  if ($("i-new")) $("i-new").onclick = () => { edit = null; render(); }; }
$("pane").addEventListener("click", e => { const t = e.target;
  if (t.dataset.ie) { edit = t.dataset.ie; render(); scrollTo(0, 0); }
  if (t.dataset.id2 && confirm("確定刪除這則議題？")) run(async () => { await api("issue_delete", { id: t.dataset.id2 }); await reload(); }, "已刪除"); });

// ---------- 紀錄查詢 ----------
const pRec = () => { const q = rf.q.trim(); let rs = S.records.filter(r => (!rf.s || r["狀態"] == rf.s) && (!q || (r["姓名"] + r["班級"] + r["試菜內容"] + r["日期"]).includes(q))).sort((a, b) => a["日期"] < b["日期"] ? 1 : -1);
  return `<section class="f"><h2>紀錄查詢</h2><div class="row"><div><input id="r-q" placeholder="姓名／班級／日期／內容" value="${E(rf.q)}"></div><div><select id="r-s"><option value="">全部狀態</option>${["待審", "已發布", "退回", "隱藏"].map(s => `<option ${rf.s == s ? "selected" : ""}>${s}</option>`).join("")}</select></div></div><div class="mini">共 ${rs.length} 筆（顯示前 ${Math.min(rf.n, rs.length)} 筆）</div></section>${rs.slice(0, rf.n).map(recCard).join("")}${rs.length > rf.n ? '<button class="g" id="r-more">顯示更多</button>' : ""}`; };
$("pane").addEventListener("input", e => { if (e.target.id == "r-q") { rf.q = e.target.value; clearTimeout(rf.t); rf.t = setTimeout(() => { render(); const i = $("r-q"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 400); } });
$("pane").addEventListener("change", e => { if (e.target.id == "r-s") { rf.s = e.target.value; render(); } });
$("pane").addEventListener("click", e => { if (e.target.id == "r-more") { rf.n += 60; render(); } });

// ---------- 家代統計 ----------
function stats() { const today = S.today;
  return reps().map(r => { const n = r["姓名"], sd = S.schedule.filter(x => x.n == n).map(x => x.d).sort(), rec = S.records.filter(x => x["姓名"] == n), have = new Set(rec.map(x => x["日期"])),
      done = rec.filter(x => x["狀態"] == "待審" || x["狀態"] == "已發布").map(x => x["日期"]).sort(), miss = sd.filter(d => d < today && !have.has(d));
    return { n, c: r["班級"], sd, done, miss, pub: rec.filter(x => x["狀態"] == "已發布").length }; }); }
const pStat = () => { const st = stats(), none = st.filter(x => !x.done.length), q = sq.trim();
  let rows = st.filter(x => (sf == "all" || (sf == "zero" && !x.done.length) || (sf == "miss" && x.miss.length) || (sf == "nosch" && !x.sd.length)) && (!q || (x.n + x.c).includes(q))).sort((a, b) => a.done.length - b.done.length || a.n.localeCompare(b.n));
  const dates = [...new Set([...S.schedule.map(x => x.d), ...S.records.map(x => x["日期"])])].filter(d => d <= S.today).sort().reverse().slice(0, 25);
  const mark = (n, d) => { const r = S.records.find(x => x["姓名"] == n && x["日期"] == d); return r ? { "待審": "⏳", "已發布": "✅", "退回": "↩", "隱藏": "🔽" }[r["狀態"]] : (d < S.today ? "❌" : "🕓"); };
  return `<section class="f"><h2>家代試菜統計</h2><p>家代 ${st.length} 位｜已試菜 ${st.length - none.length} 位｜<b style="color:var(--rd)">還沒試菜 ${none.length} 位</b></p>
<div class="row"><div><input id="s-q" placeholder="搜尋姓名／班級" value="${E(sq)}"></div><div><select id="s-f">${[["all", "全部"], ["zero", "還沒試菜"], ["miss", "有缺填"], ["nosch", "尚未排班"]].map(([k, v]) => `<option value="${k}" ${sf == k ? "selected" : ""}>${v}</option>`).join("")}</select></div></div>
<div class="tb-w"><table class="tb"><tr><th>姓名</th><th>班級</th><th>已試菜</th><th>排班</th><th>缺填</th><th>已試菜日期</th></tr>${rows.map(x => `<tr class="${x.done.length ? "" : "zero"}"><td>${E(x.n)}</td><td>${E(x.c)}</td><td><b>${x.done.length}</b></td><td>${x.sd.length}</td><td>${x.miss.length ? `<span style="color:var(--rd)">${x.miss.length}（${x.miss.map(md).join("、")}）</span>` : "0"}</td><td>${x.done.map(md).join("、")}</td></tr>`).join("")}</table></div><button class="g" id="s-csv">⬇️ 匯出 CSV（含姓名，請妥善保管）</button></section>
<section class="f"><h2>每日輪值對照</h2><p class="mini">✅已上線 ⏳待審 ↩退回 🔽下架 ❌缺填 🕓尚未輪到</p><div class="tb-w"><table class="tb">${dates.map(d => { const ns = S.schedule.filter(x => x.d == d).map(x => x.n), extra = S.records.filter(x => x["日期"] == d && x["姓名"] && !ns.includes(x["姓名"])).map(x => x["姓名"]);
    return `<tr><td>${md(d)}（${wd(d)}）</td><td>${[...new Set([...ns, ...extra])].map(n => `${mark(n, d)} ${E(n)}${ns.includes(n) ? "" : "（補登）"}`).join("　") || "—"}</td></tr>`; }).join("")}</table></div></section>`; };
$("pane").addEventListener("input", e => { if (e.target.id == "s-q") { sq = e.target.value; clearTimeout(rf.t2); rf.t2 = setTimeout(() => { render(); const i = $("s-q"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 400); } });
$("pane").addEventListener("change", e => { if (e.target.id == "s-f") { sf = e.target.value; render(); } });
const dl = (name, txt) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + txt], { type: "text/csv" })); a.download = name; a.click(); };
const csv = rows => rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
$("pane").addEventListener("click", e => { if (e.target.id == "s-csv") dl("家代試菜統計.csv", csv([["姓名", "班級", "已試菜次數", "排班次數", "缺填次數", "已試菜日期", "缺填日期"], ...stats().map(x => [x.n, x.c, x.done.length, x.sd.length, x.miss.length, x.done.join(" "), x.miss.join(" ")])])); });

// ---------- 班表與設定 ----------
const link = r => new URL("rep.html?t=" + r["Token"], location.href).href;
const pSet = () => `<section class="f"><h2>匯入輪值班表與家代名冊</h2><p class="mini">選擇「輪值表.xlsx」與「家長代表名冊.xlsx」。檔案只在你的裝置解析，姓名只會存進你的私有試算表，不會出現在前台。重新匯入會保留每位家代原本的個人連結。</p>
<label>輪值表</label><input type="file" id="xs" accept=".xlsx,.xls"><label>家長代表名冊</label><input type="file" id="xr" accept=".xlsx,.xls"><button id="xgo">解析並匯入</button></section>
<section class="f"><h2>家代個人填寫連結（${S.roster.length} 位）</h2><p class="mini">每位家代用自己的連結填寫，只看得到自己的輪值日。連結外流時按「重產」即可作廢舊連結。</p>
<div class="tb-w"><table class="tb"><tr><th>姓名</th><th>班級</th><th>連結</th></tr>${S.roster.map(r => `<tr><td>${E(r["姓名"])}${r["啟用"] == "否" ? " <span class='chip in'>停用</span>" : ""}</td><td>${E(r["班級"])}</td><td><button class="g" data-cp="${E(r["姓名"])}">複製連結</button><button class="g" data-cm="${E(r["姓名"])}">複製邀請訊息</button><button class="g" data-nt="${E(r["姓名"])}">重產</button><button class="g" data-en="${E(r["姓名"])}" data-v="${r["啟用"] == "否" ? 1 : 0}">${r["啟用"] == "否" ? "啟用" : "停用"}</button></td></tr>`).join("")}</table></div><button class="g" id="lk-csv">⬇️ 下載全部連結 CSV</button></section>
<section class="f"><h2>匯入 v2 舊資料</h2><p class="mini">把 v2 的「試菜」「反映」分頁搬進 v3（全部以已上線匯入）。</p><label style="font-weight:400"><input type="checkbox" id="mg-f"> 強制匯入（v3 已有資料時）</label><button id="mg">匯入舊資料</button></section>
<section class="f"><h2>教育局菜單 API 測試</h2><p class="mini">測試由 Apps Script 連教育部食登平台公開查詢網址，結果貼給開發者即可完成菜單串接。</p><div class="row"><div><label>日期</label><input type="date" id="mt-d" value="${S.today}"></div><div><label>SchoolId（預設 353606）</label><input id="mt-s" value="353606"></div></div><button id="mt">測試連線</button><pre id="mt-o" style="display:none"></pre></section>
<section class="f"><h2>系統狀態</h2><button class="g" id="sy">檢查</button><pre id="sy-o" style="display:none"></pre><p class="mini">版本：${E(S.version)}</p></section>`;
let rs = null;
function bindSet() {
  const lib = () => window.XLSX ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  const aoa = async f => { const wb = XLSX.read(await f.arrayBuffer(), { type: "array" }); return wb.SheetNames.map(n => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true })); };
  $("xgo").onclick = () => run(async () => { if (!$("xs").files[0] || !$("xr").files[0]) throw new Error("請選擇輪值表與名冊兩個檔案"); await lib();
    const res = parseRS(await aoa($("xs").files[0]), (await aoa($("xr").files[0]))[0]); if (!res.schedule.length) throw new Error("沒有解析到任何輪值，請確認檔案格式");
    if (!confirm(`解析到家代 ${new Set(res.roster.map(x => x.name)).size} 位、${new Set(res.schedule.map(x => x.date)).size} 天共 ${res.schedule.length} 筆輪值（${res.missing.length} 個名字不在名冊，多為行政代表，會略過）。\n要匯入並取代舊班表嗎？`)) return null;
    const r = await api("rs_import", { roster: res.roster, schedule: res.schedule }); await reload(); return r; }, r => r ? `✅ 新增 ${r.added} 位、更新 ${r.updated} 位，班表 ${r.schedule} 筆` : "");
  $("pane").onclick2 = null;
  $("mg").onclick = () => run(async () => { const r = await api("migrate_v2", { force: $("mg-f").checked }); await reload(); return r; }, r => `✅ 已匯入紀錄 ${r.records} 筆、議題 ${r.issues} 則`);
  $("mt").onclick = () => run(async () => { const r = await api("menu_test", { date: $("mt-d").value, schoolId: $("mt-s").value.trim() }); const o = $("mt-o"); o.style.display = ""; o.textContent = `${r.url}\nHTTP ${r.http}\n\n${r.body}`; });
  $("sy").onclick = () => run(async () => { const r = await api("status"); const o = $("sy-o"); o.style.display = ""; o.textContent = JSON.stringify(r, null, 1); });
  $("lk-csv").onclick = () => dl("家代連結.csv", csv([["姓名", "班級", "連結"], ...S.roster.map(r => [r["姓名"], r["班級"], link(r)])])); }
$("pane").addEventListener("click", e => { const t = e.target, copy = s => navigator.clipboard.writeText(s).then(() => toast("已複製"), () => toast("複製失敗，請手動複製", 1)), r = n => S.roster.find(x => x["姓名"] == n);
  if (t.dataset.cp) copy(link(r(t.dataset.cp)));
  if (t.dataset.cm) copy(`${t.dataset.cm} 家長代表您好，這是您的試菜填寫專屬連結（請勿轉傳）：\n${link(r(t.dataset.cm))}\n輪值當天用手機開啟，填寫試菜心得並上傳餐點照片即可，送出後由幹部審核。謝謝！`);
  if (t.dataset.nt && confirm(`重產 ${t.dataset.nt} 的連結？舊連結立刻失效。`)) run(async () => { await api("rep_set", { name: t.dataset.nt, newToken: true }); await reload(); }, "✅ 已重產");
  if (t.dataset.en) run(async () => { await api("rep_set", { name: t.dataset.en, enabled: t.dataset.v == "1" }); await reload(); }, "已更新"); });
})();
