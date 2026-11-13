(() => {
const { $, E, md, wd } = H;
let SEMS = [], si = 0, mo = null, WKS = {};
const S = () => SEMS[si];
const mDays = m => S().days.filter(x => x.d.slice(5, 7) == m);
const mQa = m => S().qa.filter(x => x.d.slice(5, 7) == m);
const has = m => mDays(m).length || mQa(m).length;

function pick() {
  const h = (location.hash || "").slice(1); let m = null;
  if (/^m-\d\d$/.test(h)) m = h.slice(2); else if (/^d-\d{4}$/.test(h)) m = h.slice(2, 4);
  if (!m || !S().months.includes(m)) { const ms = S().months.filter(has); m = ms.length ? ms[ms.length - 1] : S().months[0]; }
  mo = m; return h;
}

function weekBlock(k, days, Q, open) {
  WKS[k] = days;
  const track = Q.filter(q => q.s == "追蹤中" && H.monday(q.d) == k).length;
  const dots = [1, 2, 3, 4, 5].map(n => { const d = H.addDays(k, n - 1); return `<i class="${Q.some(q => q.d == d && q.s == "追蹤中") ? "t" : days.some(x => x.d == d) ? "y" : ""}" title="${md(d)}"></i>`; }).join("");
  return `<details class="wk" data-w="${k}"${open ? " open" : ""}><summary><span class="wt">📅 ${md(k)} – ${md(H.addDays(k, 4))}</span>
<span class="sm">${days.length}天　✏️${days.reduce((a, x) => a + x.reps.length, 0)}　📷${days.reduce((a, x) => a + x.ph.length, 0)}</span>${track ? `<span class="chip wait">⏳ 追蹤 ${track}</span>` : ""}<span class="dots">${dots}</span></summary>
<div class="body">${open ? bodyHtml(k) : ""}</div></details>`;
}
const bodyHtml = k => `<a class="wlink" href="week.html?w=${k}">📄 查看本週週報（可列印）</a>` + [...WKS[k]].reverse().map(H.dayCard).join("");

function render() {
  const s = S(); WKS = {};
  $("sem").style.display = SEMS.length > 1 ? "" : "none";
  $("semsum").textContent = `${SEMS.length > 1 ? "" : s.name + "　"}共 ${s.days.length} 天試菜紀錄、${s.days.reduce((a, x) => a + x.reps.length, 0)} 份代表回報、${s.qa.length} 則反映事項`;
  $("tabs").innerHTML = s.months.map(m => `<button data-m="${m}" class="${m == mo ? "on" : ""} ${has(m) ? "" : "em"}">${+m}月</button>`).join("");
  const D = mDays(mo), Q = mQa(mo), all = S().qa;
  if (!D.length && !Q.length) { $("view").innerHTML = `<div class="empty">🌱 ${+mo}月還沒有紀錄</div>`; return; }
  const photos = D.reduce((a, x) => a + x.ph.length, 0), track = Q.filter(q => q.s == "追蹤中").length;
  let h = `<div class="st"><div><b>${D.length}</b>試菜天數</div><div><b>${D.reduce((a, x) => a + x.reps.length, 0)}</b>✏️ 代表回報</div><div><b>${photos}</b>📷 照片</div><div><b>${Q.length}</b>💬 反映事項</div>${track ? `<div><b>${track}</b>⏳ 追蹤中</div>` : ""}</div>`;
  if (Q.length) h += `<h2>家長反映與校方回覆</h2><div class="qa">${[...Q].reverse().map(q => H.qaCard(q)).join("")}</div>`;
  if (D.length) {
    const wm = {}; D.forEach(x => (wm[H.monday(x.d)] = wm[H.monday(x.d)] || []).push(x));
    const ks = Object.keys(wm).sort().reverse();
    h += `<h2>每週試菜紀錄<span class="mu">（點週次展開）</span></h2>` + ks.map((k, i) => weekBlock(k, wm[k], all, i == 0)).join("");
  }
  $("view").innerHTML = h;
}

function route() {
  const h = pick(); render();
  if (/^d-\d{4}$/.test(h)) { const k = Object.keys(WKS).find(k => WKS[k].some(x => "d-" + x.d.slice(5, 7) + x.d.slice(8, 10) == h));
    if (k) { const el = document.querySelector(`.wk[data-w="${k}"]`); el.open = true; fill(el); const t = $(h); if (t) t.scrollIntoView(); } }
}
function fill(el) { const b = el.querySelector(".body"); if (!b.innerHTML) b.innerHTML = bodyHtml(el.dataset.w); }

function init() {
  si = SEMS.length - 1;
  $("sem").innerHTML = SEMS.map((s, i) => `<option value="${i}">${E(s.name)}</option>`).join(""); $("sem").value = si;
  $("sem").onchange = e => { si = +e.target.value; location.hash = ""; route(); };
  $("tabs").onclick = e => { const b = e.target.closest("button"); if (b) location.hash = "m-" + b.dataset.m; };
  $("view").addEventListener("toggle", e => { if (e.target.classList.contains("wk") && e.target.open) fill(e.target); }, true);
  addEventListener("hashchange", route);
}

(async () => {
  const { cache, fresh } = H.load(); let started = false, shown = "";
  const apply = d => {
    const next = H.build(d.l, d.q);
    if (!next.length) { $("view").innerHTML = '<div class="empty">🌱 試算表中尚無資料</div>'; return; }
    const keep = S() && S().id; SEMS = next; if (!started) { init(); started = true; } else { const i = SEMS.findIndex(s => s.id == keep); si = i >= 0 ? i : SEMS.length - 1; $("sem").innerHTML = SEMS.map((s, i) => `<option value="${i}">${E(s.name)}</option>`).join(""); $("sem").value = si; }
    const sig = JSON.stringify(d); if (sig !== shown) { shown = sig; route(); }
  };
  if (cache) apply(cache);          // 先秒開上次的資料
  try { apply(await fresh); } catch (e) { if (!cache) $("view").innerHTML = '<div class="empty">資料暫時載入失敗，請稍後重新整理 🙏</div>'; else $("semsum").textContent += "（目前顯示上次載入的資料）"; }
})();
})();
