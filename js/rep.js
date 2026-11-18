(() => {
const C = window.CONFIG, { $, E, md, wd } = H, tok = new URLSearchParams(location.search).get("t") || "";
const MAXPH = 6;
let info = null, pics = [];
const post = async p => { const r = await fetch(C.GAS_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(p) }); return r.json(); };
const ST = { "待審": '<span class="chip wait">⏳ 待幹部審核</span>', "已發布": '<span class="chip ok">✅ 已上線</span>', "退回": '<span class="chip in">↩ 請修改後再送出</span>', "僅記錄": '<span class="chip ok">✅ 已完成</span>' };
const SRC = s => s && s != "家代填報" ? `<span class="mini">（${E(s)}）</span>` : "";
async function load() {
  if (!tok) return $("app").innerHTML = '<div class="empty">請使用幹部提供的個人連結（或掃描 QR Code）開啟這個頁面。</div>';
  try { info = await (await fetch(`${C.GAS_URL}?action=repinfo&t=${encodeURIComponent(tok)}`)).json(); } catch (e) { return $("app").innerHTML = '<div class="empty">連線失敗，請稍後再試。</div>'; }
  if (info.status !== "success") return $("app").innerHTML = `<div class="empty">${E(info.message)}<br><span class="mini">若是剛換新的 QR Code，請改用最新的那一張。</span></div>`;
  draw();
}
function draw() {
  const ed = info.open.filter(o => !o.locked), done = info.open.filter(o => o.locked);
  $("app").innerHTML = `<p class="hello">${E(info.name)} 家長代表，您好 👋<br><span class="mu">今天是 ${md(info.today)}（${wd(info.today)}）</span></p>
${ed.length ? `<section class="f"><h2>填寫試菜紀錄</h2>
${ed.length > 1 ? `<label>輪值日期</label><select id="d">${ed.map(o => `<option value="${o.d}">${md(o.d)}（${wd(o.d)}）${o.s ? "｜" + o.s : ""}</option>`).join("")}</select>` : `<input type="hidden" id="d" value="${ed[0].d}"><p class="duty">📅 輪值日：<b>${md(ed[0].d)}（${wd(ed[0].d)}）</b>${ed[0].s ? "　" + (ST[ed[0].s] || "") : ""}</p>`}
<div id="note"></div><div id="menu"></div>
<label>試菜心得</label><button type="button" class="g" id="tpl">✏️ 插入填寫範本</button><span class="mini" id="tplh"></span>
<textarea id="tx" placeholder="依序寫下每道菜的味道、口感、溫度…"></textarea>
<label>📷 現場餐點照片（最多 ${MAXPH} 張，只拍餐點、不要拍到人）</label><input type="file" id="ph" accept="image/*" multiple><div class="th" id="th"></div>
<button id="go">送出給幹部審核</button><div class="msg" id="m"></div>
<p class="mu">送出後由幹部審核才會公開；審核前可再次送出覆蓋。</p></section>`
   : `<div class="empty">🌱 目前沒有需要填寫的輪值日${info.upcoming.length ? `<br>下一次輪值：<b>${info.upcoming.map(d => md(d) + "（" + wd(d) + "）").join("、")}</b>` : ""}</div>`}
${done.length ? `<section class="f"><h2>已完成</h2><ul class="hi">${done.map(o => `<li>${md(o.d)}　${ST[o.s] || E(o.s)}</li>`).join("")}</ul></section>` : ""}
${ed.length && info.upcoming.length ? `<p class="mini" style="text-align:center">下一次輪值：${info.upcoming.slice(0, 3).map(d => md(d) + "（" + wd(d) + "）").join("、")}</p>` : ""}
${info.history.length ? `<section class="f"><h2>我的歷史紀錄 <small class="mu">（僅供查看）</small></h2>${info.history.map(h => `<details class="hd"><summary>${md(h.d)}（${wd(h.d)}）　${ST[h.s] || E(h.s)}${SRC(h.src)}</summary>
${h.note ? `<p class="mini">幹部備註：${E(h.note)}</p>` : ""}<div class="ht">${E(h.text || "（無文字內容）").replace(/\n/g, "<br>")}</div>${h.ph.length ? H.gal(h.ph, "real") : ""}</details>`).join("")}</section>` : ""}`;
  if (!ed.length) return;
  const cur = () => ed.find(x => x.d == $("d").value), ta = $("tx");
  const useMenu = () => !!$("um") && $("um").checked && cur().plat && cur().plat.length;
  const tplHint = () => { $("tplh").textContent = useMenu() ? "（依當日平台菜單）" : "（一般範本）"; };
  const showMenu = o => {
    const has = o.plat && o.plat.length;
    $("menu").innerHTML = has ? `<div class="mbox"><b>📋 當日菜單</b><span class="src">資料來源：教育部校園食材登錄平台</span>${H.platMenu(o.plat)}${H.nutHtml(o.nut)}
${o.pics && o.pics.length ? `<details class="pv"><summary class="mini">看平台菜色照片（${o.pics.length} 張，僅供對照）</summary>${H.moeGal(o.pics, false)}</details>` : ""}
<div class="opts"><label><input type="checkbox" id="um" ${o.useMenu === false ? "" : "checked"}> 帶入平台菜單（前台顯示菜單、營養與食材資訊）</label>
${o.pics && o.pics.length ? `<label><input type="checkbox" id="up" ${o.usePics === false ? "" : "checked"}> 帶入平台菜色照片（會和你拍的照片分開標示）</label>` : ""}</div></div>`
      : `<p class="mini">${o.menuTried ? "（這天的菜單還沒登錄在教育部平台，可以用一般範本）" : "正在查詢教育部平台菜單…"}</p>`;
    tplHint(); if ($("um")) $("um").onchange = () => { tplHint(); if (H.isTpl(ta) && ta.value.trim()) H.putTpl(ta, H.dishTpl(useMenu() ? cur().plat : "")); }; };
  const sync = async () => { const o = cur(); ta.value = o.text || ""; ta.dataset.tpl = ""; showMenu(o);
    $("note").innerHTML = o.note ? `<p class="msg er">幹部備註：${E(o.note)}</p>` : (o.nph ? `<p class="mu">已上傳 ${o.nph} 張照片；要換照片請重新選擇，沒選就保留原照片。</p>` : "");
    if (!(o.plat && o.plat.length) && !o.menuTried) { const r = await H.moeFetch(o.d, true); o.menuTried = true;
      if (r.dishes.length) { o.plat = r.dishes.map(d => ({ n: d.n, t: d.t })); o.pics = r.dishes.filter(d => d.u).map(d => ({ n: d.n, t: d.t, u: d.u })); o.nut = r.nut; o.ing = r.ing; o.local = { dishes: r.dishes.map(d => ({ n: d.n, t: d.t, u: d.u })), nut: r.nut, ing: r.ing }; }
      if (cur() == o) showMenu(o); } };
  if ($("d").tagName == "SELECT") $("d").onchange = sync; sync();
  $("tpl").onclick = () => H.putTpl(ta, H.dishTpl(useMenu() ? cur().plat : ""));
  $("ph").onchange = async e => { pics = []; $("th").innerHTML = ""; const fs = [...e.target.files];
    if (fs.length > MAXPH) $("m").textContent = `最多 ${MAXPH} 張，只會上傳前 ${MAXPH} 張`;
    for (const f of fs.slice(0, MAXPH)) { const p = await H.shrink(f); if (p) pics.push(p); else $("m").textContent = "有照片格式無法讀取（例如 HEIC），請改選 JPG/PNG"; }
    $("th").innerHTML = pics.map(p => `<img src="${p.u}" alt="">`).join(""); };
  $("go").onclick = async () => {
    const m = $("m"), b = $("go"); if (H.isTpl(ta) && ta.value.trim() && !pics.length) { m.className = "msg er"; m.textContent = "範本還沒填寫內容喔"; return; }
    if (!ta.value.trim() && !pics.length) { m.className = "msg er"; m.textContent = "請填寫試菜心得或選照片"; return; }
    b.disabled = true; m.className = "msg"; m.textContent = "送出中…（有照片會比較久）";
    try { const o = cur(), r = await post({ type: "submit", t: tok, date: o.d, text: ta.value.trim(), photos: pics.map(p => p.b64), useMenu: $("um") ? $("um").checked : true, usePics: $("up") ? $("up").checked : true, menu: o.local });
      if (r.status !== "success") throw new Error(r.message); pics = []; await load(); $("app").insertAdjacentHTML("afterbegin", '<div class="msg ok">✅ 已送出，等待幹部審核。謝謝您！</div>');
    } catch (e) { m.className = "msg er"; m.textContent = "⚠️ " + (e.message === "Failed to fetch" ? "無法確認是否成功，請稍後重新整理確認，避免重複送出" : e.message); b.disabled = false; }
  };
}
load();
})();
