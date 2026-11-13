(() => {
const { $, E, md, wd } = H;
(async () => {
  const { cache, fresh } = H.load(); let d;
  try { d = await fresh; } catch (e) { d = cache; }
  if (!d) { $("rep").innerHTML = '<div class="empty">資料暫時載入失敗，請稍後重新整理 🙏</div>'; return; }
  const sems = H.build(d.l, d.q), days = sems.flatMap(s => s.days), qa = sems.flatMap(s => s.qa);
  const last = days.length ? days[days.length - 1].d : new Date().toISOString().slice(0, 10);
  const param = new URLSearchParams(location.search).get("w");
  const k = H.monday(H.norm(param) || last), end = H.addDays(k, 4);
  const D = days.filter(x => H.monday(x.d) == k), Q = qa.filter(q => H.monday(q.d) == k), open = qa.filter(q => q.s == "追蹤中");
  const photos = D.flatMap(x => x.ph), kw = H.kw(D);
  document.title = `${md(k)}–${md(end)} 營養午餐週報・東門國小家長會`;
  $("nav").innerHTML = `<a href="?w=${H.addDays(k, -7)}">‹ 上一週</a><a href="?w=${H.monday(last)}">本週／最新</a><a href="?w=${H.addDays(k, 7)}">下一週 ›</a><button onclick="print()">🖨️ 列印／存成 PDF</button><a href="index.html">回首頁</a>`;
  let h = `<h1>📄 營養午餐週報 <small>${md(k)}（一）– ${md(end)}（五）</small></h1><p class="mu">東門國小家長會・由家長代表每天試菜記錄，本頁依試算表資料自動產生。</p>`;
  if (!D.length && !Q.length) { $("rep").innerHTML = h + `<div class="empty">🌱 這一週還沒有紀錄</div>`; return; }
  h += `<div class="st"><div><b>${D.length}/5</b>試菜天數</div><div><b>${D.reduce((a, x) => a + x.reps.length, 0)}</b>✏️ 代表回報</div><div><b>${photos.length}</b>📷 照片</div><div><b>${Q.length}</b>💬 本週反映</div><div><b>${open.length}</b>⏳ 追蹤中（累計）</div></div>`;
  if (kw.total) h += `<h2>本週回饋關鍵字</h2><div class="kw">${kw.bad.length ? kw.bad.map(([n, c]) => `<span>${n} × ${c}</span>`).join("") : `<span class="g">沒有偏鹹、偏乾等負面關鍵字 🎉</span>`}${kw.good ? `<span class="g">好評關鍵字 × ${kw.good}</span>` : ""}</div><p class="mu">依代表文字自動統計，僅供參考；共 ${kw.total} 則評語。</p>`;
  if (Q.length) h += `<h2>本週反映與校方回覆</h2><div class="qa">${Q.map(q => H.qaCard(q, true)).join("")}</div>`;
  const pend = open.filter(q => H.monday(q.d) != k);
  if (pend.length) h += `<h2>仍在追蹤的事項</h2><div class="qa">${pend.map(q => H.qaCard(q)).join("")}</div>`;
  if (D.length) h += `<h2>每日紀錄</h2>` + D.map(H.dayCard).join("");
  $("rep").innerHTML = h;
})();
})();
