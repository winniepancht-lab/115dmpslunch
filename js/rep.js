(() => {
const C = window.CONFIG, { $, E, md, wd } = H, tok = new URLSearchParams(location.search).get("t") || "";
let info = null, pics = [];
const post = async p => { const r = await fetch(C.GAS_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(p) }); return r.json(); };
const ST = { "待審": '<span class="chip wait">⏳ 待幹部審核</span>', "已發布": '<span class="chip ok">✅ 已上線</span>', "退回": '<span class="chip in">↩ 請修改後再送出</span>', "僅記錄": '<span class="chip ok">✅ 已完成</span>' };
const SRC = s => s && s != "家代填報" ? `<span class="mini">（${E(s)}）</span>` : "";
async function load() {
  if (!tok) return $("app").innerHTML = '<div class="empty">請使用幹部提供的個人連結開啟這個頁面。</div>';
  try { info = await (await fetch(`${C.GAS_URL}?action=repinfo&t=${encodeURIComponent(tok)}`)).json(); } catch (e) { return $("app").innerHTML = '<div class="empty">連線失敗，請稍後再試。</div>'; }
  if (info.status !== "success") return $("app").innerHTML = `<div class="empty">${E(info.message)}</div>`;
  draw();
}
function draw() {
  const ed = info.open.filter(o => !o.locked), done = info.open.filter(o => o.locked);
  $("app").innerHTML = `<p class="mu">${E(info.name)} 家長代表，您好 👋　今天是 ${md(info.today)}（${wd(info.today)}）</p>
${ed.length ? `<section class="f"><h2>填寫試菜紀錄</h2>
<label>輪值日期</label><select id="d">${ed.map(o => `<option value="${o.d}">${md(o.d)}（${wd(o.d)}）${o.s ? "｜" + o.s : ""}</option>`).join("")}</select>
<div id="menu"></div><div id="note"></div>
<label>試菜心得</label><div id="tpls"></div>
<textarea id="tx" placeholder="白飯：軟硬適中&#10;主菜：…"></textarea>
<label>餐點照片（可多選，只拍餐點，不要拍到人）</label><input type="file" id="ph" accept="image/*" multiple><div class="th" id="th"></div>
<button id="go">送出給幹部審核</button><div class="msg" id="m"></div>
<p class="mu">送出後由幹部審核才會公開；審核前可再次送出覆蓋。</p></section>`
   : `<div class="empty">🌱 目前沒有需要填寫的輪值日${info.upcoming.length ? `<br>下一次輪值：${info.upcoming.map(d => md(d) + "（" + wd(d) + "）").join("、")}` : ""}</div>`}
${done.length ? `<section class="f"><h2>已完成</h2><ul class="hi">${done.map(o => `<li>${md(o.d)}　${ST[o.s] || E(o.s)}</li>`).join("")}</ul></section>` : ""}
${info.history.length ? `<section class="f"><h2>我的歷史紀錄 <small class="mu">（僅供查看）</small></h2>${info.history.map(h => `<details class="hd"><summary>${md(h.d)}（${wd(h.d)}）　${ST[h.s] || E(h.s)}${SRC(h.src)}</summary>
${h.note ? `<p class="mini">幹部備註：${E(h.note)}</p>` : ""}<div class="ht">${E(h.text || "（無文字內容）").replace(/\n/g, "<br>")}</div>${h.ph.length ? H.gal(h.ph) : ""}</details>`).join("")}</section>` : ""}`;
  if (!ed.length) return;
  const cur = () => ed.find(x => x.d == $("d").value);
  const showMenu = o => {
    $("menu").innerHTML = o.menu ? `<div class="mbox">📋 <b>當日菜單</b>　${E(o.menu)}<span class="src">${o.menuSrc == "幹部" ? "家長會登錄" : "資料來源：教育部校園食材登錄平台"}</span>${H.moeGal(o.pics, false)}${o.pics && o.pics.length ? '<div class="mini">↑ 平台提供的菜色照片，僅供對照；請另外拍攝實際餐點。</div>' : ""}</div>`
      : `<p class="mini">${o.menuTried ? "（這天的菜單尚未登錄在教育部平台，可使用一般範本）" : "正在查詢教育部平台菜單…"}</p>`;
    $("tpls").innerHTML = (o.menu ? '<button type="button" class="g" data-tpl="menu">插入範本（依當日菜單）</button> ' : "") + '<button type="button" class="g" data-tpl="std">插入一般範本</button>'; };
  const sync = async () => { const o = cur(); $("tx").value = o.text || ""; showMenu(o);
    $("note").innerHTML = o.note ? `<p class="msg er">幹部備註：${E(o.note)}</p>` : (o.nph ? `<p class="mu">已上傳 ${o.nph} 張照片；若要換照片請重新選擇，沒選則保留原照片。</p>` : "");
    if (!o.menu && !o.menuTried) { const r = await H.moeFetch(o.d); o.menuTried = true; if (r.dishes.length) { o.menu = r.dishes.map(x => x.n).join("、"); o.menuSrc = "教育局"; o.pics = r.dishes.filter(x => x.u); } if (cur() == o) showMenu(o); } };
  $("d").onchange = sync; sync();
  $("tpls").onclick = e => { const k = e.target.dataset.tpl; if (!k) return; const t = $("tx"); t.value += (t.value && !t.value.endsWith("\n") ? "\n" : "") + H.dishTpl(k == "menu" ? cur().menu : ""); t.focus(); };
  $("ph").onchange = async e => { pics = []; $("th").innerHTML = ""; for (const f of e.target.files) { const p = await H.shrink(f); if (p) pics.push(p); else $("m").textContent = "有照片格式無法讀取（例如 HEIC），請改選 JPG/PNG"; } $("th").innerHTML = pics.map(p => `<img src="${p.u}" alt="">`).join(""); };
  $("go").onclick = async () => {
    const m = $("m"), b = $("go"); if (!$("tx").value.trim() && !pics.length) { m.className = "msg er"; m.textContent = "請填寫試菜心得或選照片"; return; }
    b.disabled = true; m.className = "msg"; m.textContent = "送出中…（有照片會比較久）";
    try { const r = await post({ type: "submit", t: tok, date: $("d").value, text: $("tx").value.trim(), photos: pics.map(p => p.b64) });
      if (r.status !== "success") throw new Error(r.message); pics = []; await load(); $("app").insertAdjacentHTML("afterbegin", '<div class="msg ok">✅ 已送出，等待幹部審核。謝謝您！</div>');
    } catch (e) { m.className = "msg er"; m.textContent = "⚠️ " + (e.message === "Failed to fetch" ? "無法確認是否成功，請稍後重新整理確認，避免重複送出" : e.message); b.disabled = false; }
  };
}
load();
})();
