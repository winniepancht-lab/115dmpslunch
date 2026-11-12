(() => {
const C = window.CONFIG, $ = H.$;
const today = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
$("date").value = $("qd").value = today; $("key").value = localStorage.getItem("dmpa_key") || "";

// ---------- 排班表解析（只取日期＋班級，姓名不外送）----------
//PARSE-START
const SKIP = new Set(["試菜人員", "家長：", "家長:", "家長", "行政代表", "家長代表", "試吃意見", "輪值時間", "人員"]);
function toIso(v) {
  if (typeof v === "number" && v > 40000 && v < 60000) return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10);
  const m = String(v == null ? "" : v).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  return m ? `${m[1]}-${("0" + m[2]).slice(-2)}-${("0" + m[3]).slice(-2)}` : "";
}
function parseSchedule(sheets, roster) {
  const map = {};
  roster.forEach(r => { const c = String(r[2] || "").trim(), n = String(r[3] || "").trim(); if (/^[1-6]\d{2}[A-Za-z]?$/.test(c) && n) (map[n] = map[n] || new Set()).add(c); });
  const seen = new Set(), rows = [], miss = new Set();
  sheets.forEach(sh => { let cur = ""; sh.forEach(r => {
    const d = toIso(r[0]); if (d) cur = d; if (!cur) return;
    for (let i = 2; i < r.length; i++) { const n = String(r[i] == null ? "" : r[i]).trim(); if (!n || SKIP.has(n) || /[：:]$/.test(n)) continue;
      if (map[n]) { const c = [...map[n]].join("/"), k = cur + c; if (!seen.has(k)) { seen.add(k); rows.push([cur, c, "家長"]); } } else miss.add(n); } }); });
  return { rows, missing: [...miss] };
}
//PARSE-END

// ---------- 照片 ----------
function shrink(f) { return new Promise(res => {
  const im = new Image(); im.onerror = () => res(null);
  im.onload = () => { const k = Math.min(1, 1000 / Math.max(im.width, im.height)), c = document.createElement("canvas");
    c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
    const u = c.toDataURL("image/jpeg", .72); res({ u, b64: u.split(",")[1] }); };
  im.src = URL.createObjectURL(f); }); }
const pics = {};
function picker(inp, th, msg) { pics[inp] = []; $(inp).onchange = async e => {
  pics[inp] = []; $(th).innerHTML = "";
  for (const f of e.target.files) { const p = await shrink(f); if (p) pics[inp].push(p); else $(msg).textContent = "有照片格式無法讀取（例如 HEIC），請改選 JPG/PNG"; }
  $(th).innerHTML = pics[inp].map(p => `<img src="${p.u}" alt="">`).join(""); }; }
picker("ph", "th", "m1"); picker("mp", "mth", "m1"); picker("qp", "qth", "m2");
const b64s = k => pics[k].map(p => p.b64), clr = (k, th) => { pics[k] = []; $(k).value = ""; $(th).innerHTML = ""; };

async function post(payload, btn, msg, ok) {
  const key = $("key").value.trim(); if (!key) { msg.className = "msg er"; msg.textContent = "請先填通關密語"; return false; }
  localStorage.setItem("dmpa_key", key); payload.key = key; btn.disabled = true; msg.className = "msg"; msg.textContent = "送出中…（有照片會比較久）";
  try {
    const r = await fetch(C.GAS_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
    const d = await r.json(); if (d.status !== "success") throw new Error(d.message || "失敗");
    msg.className = "msg ok"; msg.textContent = ok; return d;
  } catch (e) { msg.className = "msg er"; msg.textContent = "⚠️ " + (e.message === "Failed to fetch" ? "無法確認是否成功，請先到前台或試算表確認，避免重複送出" : e.message); return false;
  } finally { btn.disabled = false; }
}

// ---------- 今日試菜 ----------
$("tpl").onclick = () => { const t = $("fb"); t.value += (t.value && !t.value.endsWith("\n") ? "\n" : "") + "白飯：\n主菜：\n副菜：\n青菜：\n湯：\n整體："; t.focus(); };
$("b1").onclick = async () => {
  if (!$("fb").value.trim() && !pics.ph.length) return alert("請至少填試菜心得或選照片");
  const ok = await post({ type: "lunch", date: $("date").value, classId: $("cls").value.trim(), menu: $("menu").value.trim(), feedback: $("fb").value.trim(), photos: b64s("ph"), menuPhotos: b64s("mp") }, $("b1"), $("m1"), "✅ 已送出！前台稍後更新");
  if (ok) { $("fb").value = $("menu").value = $("cls").value = ""; clr("ph", "th"); clr("mp", "mth"); showRota(); }
};
// 輪值提示：今天排了哪些班級、誰已回報
let sched = {};
async function showRota() {
  const d = $("date").value, box = $("rota"); if (!d || !$("key").value.trim()) { box.textContent = ""; return; }
  try {
    if (!sched[d]) { const r = await (await fetch(`${C.GAS_URL}?action=schedule&date=${d}&key=${encodeURIComponent($("key").value.trim())}`)).json(); if (r.status !== "success") { box.textContent = ""; return; } sched[d] = r.rows.map(x => x[1]); }
    const done = new Set((await H.fetchCsv(C.DATA_URL, true)).filter(r => H.norm(r["日期"]) == d).map(r => String(r["班級"]).trim()));
    box.innerHTML = sched[d].length ? "📅 今日輪值（點一下自動填班級）：<div class='rota'>" + sched[d].map(c => { const dg = c.match(/\d{3}/)[0]; return `<button type="button" class="g ${done.has(dg) ? "done" : ""}" data-c="${dg}">${done.has(dg) ? "✓ " : ""}${c}</button>`; }).join("") + "</div>" : "";
  } catch (e) { box.textContent = ""; }
}
$("rota").onclick = e => { const b = e.target.closest("button"); if (b) $("cls").value = b.dataset.c; };
$("date").onchange = showRota; $("key").onchange = () => { sched = {}; showRota(); }; showRota();

// ---------- 反映 ----------
$("b2").onclick = async () => {
  if (!$("qt").value.trim()) return alert("請填標題");
  const ok = await post({ type: "qa", date: $("qd").value, title: $("qt").value.trim(), summary: $("qs").value.trim(), reply: $("qr").value.trim(), photos: b64s("qp") }, $("b2"), $("m2"), "✅ 已送出！");
  if (ok) { $("qt").value = $("qs").value = $("qr").value = ""; clr("qp", "qth"); loadPend(); }
};
$("b3").onclick = async () => {
  const v = $("pend").value; if (!v || !$("pr").value.trim()) return alert("請選擇一則並填寫回覆");
  const [date, title] = JSON.parse(v);
  if (await post({ type: "reply", date, title, reply: $("pr").value.trim() }, $("b3"), $("m3"), "✅ 回覆已補上！")) { $("pr").value = ""; setTimeout(loadPend, 1500); }
};
async function loadPend() {
  if (!C.QA_URL) { $("pend").innerHTML = '<option value="">（尚未設定反映分頁網址）</option>'; return; }
  try {
    const rows = (await H.fetchCsv(C.QA_URL, true)).filter(x => { const s = String(x["狀態"] || "").trim(); return s == "追蹤中" || (!s && !String(x["營養師回覆"] || "").trim()); });
    $("pend").innerHTML = rows.length ? rows.map(x => { const d = H.norm(x["日期"]); return `<option value='${JSON.stringify([d, x["標題"]]).replace(/'/g, "&#39;")}'>${d.slice(5)}｜${H.E(x["標題"])}</option>`; }).join("") : '<option value="">目前沒有追蹤中的反映 🎉</option>';
  } catch (e) { $("pend").innerHTML = '<option value="">載入失敗</option>'; }
}
loadPend();

// ---------- 匯入排班表 ----------
function lib() { return window.XLSX ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
const aoa = async f => { const wb = XLSX.read(await f.arrayBuffer(), { type: "array" }); return wb.SheetNames.map(n => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true })); };
$("b4").onclick = async () => {
  const m = $("m4"); if (!$("xs").files[0] || !$("xr").files[0]) { m.className = "msg er"; m.textContent = "請選擇輪值表與名冊兩個檔案"; return; }
  try { m.className = "msg"; m.textContent = "解析中…"; await lib();
    const res = parseSchedule(await aoa($("xs").files[0]), (await aoa($("xr").files[0]))[0]);
    if (!res.rows.length) throw new Error("沒有解析到任何輪值，請確認檔案格式");
    if (!confirm(`解析到 ${new Set(res.rows.map(r => r[0])).size} 天、${res.rows.length} 筆輪值（${res.missing.length} 個名字找不到班級，多為行政代表）。要匯入並取代舊的排班嗎？`)) { m.textContent = ""; return; }
    if (await post({ type: "schedule", rows: res.rows }, $("b4"), m, `✅ 已匯入 ${res.rows.length} 筆輪值`)) sched = {}, showRota();
  } catch (e) { m.className = "msg er"; m.textContent = "⚠️ " + e.message; }
};
})();
