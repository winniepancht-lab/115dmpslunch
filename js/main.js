(() => {
const C = window.CONFIG || {};
const wk = ["日","一","二","三","四","五","六"];
const E = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, "0");
const norm = d => { const m = String(d || "").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/); return m ? `${m[1]}-${pad(m[2])}-${pad(m[3])}` : ""; };
const lab = d => { const [y, m, x] = d.split("-"); return `${+m}/${+x}（${wk[new Date(y, m - 1, x).getDay()]}）`; };
const idOf = d => "d-" + d.slice(5, 7) + d.slice(8, 10);
const hidden = r => /^(否|n|no|隱藏|x)$/i.test(String(r["公開"] || "").trim());
const grade = c => { const g = {1:"一",2:"二",3:"三",4:"四",5:"五",6:"六"}[String(c || "").trim().charAt(0)]; return g ? g + "年級代表" : "家長代表"; };
// 照片：完整網址、Google Drive 分享連結、或網站內的相對路徑（img/xxx.jpg）都可以
const photo = u => { const m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([\w-]+)/); return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w800` : u; };
const big = u => u.replace("sz=w800", "sz=w1600");
// 學期自動由日期判斷：8–1月 = 上學期，2–7月 = 下學期
const semInfo = d => { const y = +d.slice(0,4), m = +d.slice(5,7), t = (m >= 8 || m == 1) ? 1 : 2, ay = (m >= 8 ? y : y - 1) - 1911; return { id: ay + "-" + t, name: `${ay}學年度第${t}學期`, t }; };
const ord = (m, t) => (t == 1 && +m < 8) ? +m + 12 : +m;
const DEF = { 1: ["09","10","11","12","01"], 2: ["02","03","04","05","06"] };

let SEMS = [], si = 0, mo = null;
const S = () => SEMS[si];
const mDays = m => S().days.filter(x => x.d.slice(5,7) == m);
const mQa = m => S().qa.filter(x => x.d.slice(5,7) == m);
const has = m => mDays(m).length || mQa(m).length;

const load = url => new Promise((res, rej) => Papa.parse(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now(), {
  download: true, header: true, skipEmptyLines: true, transformHeader: h => h.trim(),
  complete: r => res(r.data), error: rej }));

function build(lunch, qa) {
  const M = {};
  const sem = d => { const i = semInfo(d); return M[i.id] || (M[i.id] = { id: i.id, name: i.name, t: i.t, dm: {}, qa: [] }); };
  lunch.filter(r => !hidden(r)).forEach(r => {
    const d = norm(r["日期"]); if (!d) return;
    const s = sem(d), x = s.dm[d] || (s.dm[d] = { d, menu: "", reps: [], ph: [], n: [] });
    const menu = String(r["午餐菜色"] || "").trim(); if (menu && !x.menu) x.menu = menu;
    String(r["照片連結"] || "").split(/[\s,，]+/).filter(Boolean).forEach(u => x.ph.push(photo(u)));
    const l = String(r["家代意見反饋"] || "").split("\n").map(v => v.trim()).filter(Boolean);
    if (l.length) x.reps.push({ c: grade(r["班級"]), l });
    const a = String(r["營養師回應"] || "").trim(); if (a) x.n.push(a);
  });
  qa.filter(r => !hidden(r)).forEach(r => {
    const d = norm(r["日期"]), t = String(r["標題"] || "").trim(); if (!d || !t) return;
    const a = String(r["營養師回覆"] || "").trim();
    sem(d).qa.push({ d, t, q: String(r["反映摘要"] || "").trim(), a, s: String(r["狀態"] || "").trim() || (a ? "已回覆" : "追蹤中") });
  });
  return Object.values(M).sort((a, b) => a.id < b.id ? -1 : 1).map(s => {
    const days = Object.values(s.dm).sort((a, b) => a.d < b.d ? -1 : 1);
    const set = new Set(DEF[s.t]); days.forEach(x => set.add(x.d.slice(5,7))); s.qa.forEach(x => set.add(x.d.slice(5,7)));
    return { id: s.id, name: s.name, t: s.t, days, qa: s.qa.sort((a, b) => a.d < b.d ? -1 : 1), months: [...set].sort((a, b) => ord(a, s.t) - ord(b, s.t)) };
  });
}

function pick() {
  const h = (location.hash || "").slice(1); let m = null;
  if (/^m-\d\d$/.test(h)) m = h.slice(2); else if (/^d-\d{4}$/.test(h)) m = h.slice(2, 4);
  if (!m || !S().months.includes(m)) { const ms = S().months.filter(has); m = ms.length ? ms[ms.length - 1] : S().months[0]; }
  mo = m; return h;
}

const qaHtml = q => `<details><summary><b>${E(lab(q.d).split("（")[0])}｜${E(q.t)}</b> <span class="tag ${q.s == "追蹤中" ? "w2" : ""}">${E(q.s)}</span></summary>
${q.q ? `<p><b>反映摘要</b>　${E(q.q)}</p>` : ""}${q.a ? `<p><b>營養師／學校回覆</b>　${E(q.a)}</p>` : (q.s == "追蹤中" ? `<p class="mu">已向學校確認，尚待回覆</p>` : "")}</details>`;

function render() {
  const s = S();
  $("sem").style.display = SEMS.length > 1 ? "" : "none";
  $("semsum").textContent = `${SEMS.length > 1 ? "" : s.name + "　"}共 ${s.days.length} 天試菜紀錄、${s.days.reduce((a, x) => a + x.reps.length, 0)} 份代表回報、${s.qa.length} 則反映事項`;
  $("tabs").innerHTML = s.months.map(m => `<button data-m="${m}" class="${m == mo ? "on" : ""} ${has(m) ? "" : "em"}">${+m}月</button>`).join("");
  const D = mDays(mo), Q = mQa(mo);
  let h = "";
  if (!D.length && !Q.length) h = `<div class="empty">${+mo}月尚無紀錄</div>`;
  else {
    h += `<div class="st"><div><b>${D.length}</b>試菜天數</div><div><b>${D.reduce((a, x) => a + x.reps.length, 0)}</b>代表回報</div><div><b>${Q.length}</b>反映與回覆</div></div>`;
    if (D.length) h += `<h2>${+mo}月日曆</h2><div class="cal">` + D.map(x => {
      const qs = Q.filter(q => q.d == x.d), t = [`<span class="tag">${x.reps.length}位回報</span>`];
      if (x.ph.length) t.push('<span class="tag">有照片</span>');
      if (qs.some(q => q.s == "追蹤中")) t.push('<span class="tag w2">追蹤中</span>');
      if (x.n.length || qs.some(q => q.s != "追蹤中")) t.push('<span class="tag">已回覆</span>');
      return `<a href="#${idOf(x.d)}"><b>${lab(x.d)}</b>${t.join("")}</a>`; }).join("") + `</div>`;
    if (Q.length) h += `<h2>家長反映與校方回覆</h2><div class="qa">${[...Q].reverse().map(qaHtml).join("")}</div>`;
    if (D.length) h += `<h2>每日試菜紀錄</h2>` + [...D].reverse().map(x => `<section class="day" id="${idOf(x.d)}"><h3>${lab(x.d)}</h3>
${x.menu ? `<div class="menu"><b>今日菜色</b>　${E(x.menu)}</div>` : ""}
${x.ph.length ? `<div class="ph">${x.ph.map(p => `<a href="${E(big(p))}" target="_blank" rel="noopener"><img src="${E(p)}" alt="試菜餐點照片" loading="lazy" referrerpolicy="no-referrer"></a>`).join("")}</div>` : ""}
${x.reps.map(r => `<div class="rep"><strong>${E(r.c)}</strong><ul>${r.l.map(l => `<li>${E(l)}</li>`).join("")}</ul></div>`).join("")}
${x.n.map(n => `<div class="n ok"><b>校方／營養師回應</b>　${E(n)}</div>`).join("")}</section>`).join("");
  }
  $("view").innerHTML = h;
}

function route() { const h = pick(); render(); if (/^d-/.test(h)) { const el = $(h); if (el) el.scrollIntoView(); } }

function init() {
  si = SEMS.length - 1;
  $("sem").innerHTML = SEMS.map((s, i) => `<option value="${i}">${E(s.name)}</option>`).join("");
  $("sem").value = si;
  $("sem").onchange = e => { si = +e.target.value; location.hash = ""; route(); };
  $("tabs").onclick = e => { const b = e.target.closest("button"); if (b) location.hash = "m-" + b.dataset.m; };
  addEventListener("hashchange", route);
  route();
}

(async () => {
  let lunch, qa, stale = false;
  try {
    [lunch, qa] = await Promise.all([load(C.DATA_URL), C.QA_URL ? load(C.QA_URL) : []]);
    try { localStorage.setItem("dmpa", JSON.stringify({ lunch, qa })); } catch (e) {}
  } catch (e) {
    try { ({ lunch, qa } = JSON.parse(localStorage.getItem("dmpa"))); stale = true; } catch (e2) {}
  }
  if (!lunch) { $("view").innerHTML = '<div class="empty">資料暫時載入失敗，請稍後重新整理。</div>'; return; }
  SEMS = build(lunch, qa || []);
  if (!SEMS.length) { $("view").innerHTML = '<div class="empty">試算表中尚無資料</div>'; return; }
  init();
  if (stale) $("semsum").textContent += "（目前顯示上次載入的資料）";
})();
})();
