(() => {
const C = window.CONFIG, { $, E, md, wd } = H, tok = new URLSearchParams(location.search).get("t") || "";
let info = null, pics = [];
const post = async p => { const r = await fetch(C.GAS_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(p) }); return r.json(); };
const ST = { "待審": '<span class="chip wait">⏳ 待幹部審核</span>', "已發布": '<span class="chip ok">✅ 已上線</span>', "退回": '<span class="chip in">↩ 請修改後再送出</span>' };
async function load() {
  if (!tok) return $("app").innerHTML = '<div class="empty">請使用幹部提供的個人連結開啟這個頁面。</div>';
  try { info = await (await fetch(`${C.GAS_URL}?action=repinfo&t=${encodeURIComponent(tok)}`)).json(); } catch (e) { return $("app").innerHTML = '<div class="empty">連線失敗，請稍後再試。</div>'; }
  if (info.status !== "success") return $("app").innerHTML = `<div class="empty">${E(info.message)}</div>`;
  draw();
}
function draw() {
  const open = info.open, ed = open.filter(o => o.s != "已發布");
  $("app").innerHTML = `<p class="mu">${E(info.name)} 家長代表，您好 👋　今天是 ${md(info.today)}（${wd(info.today)}）</p>
${ed.length ? `<section class="f"><h2>填寫試菜紀錄</h2>
<label>輪值日期</label><select id="d">${ed.map(o => `<option value="${o.d}">${md(o.d)}（${wd(o.d)}）${o.s ? "｜" + o.s : ""}</option>`).join("")}</select>
<div id="note"></div>
<label>試菜心得</label><button type="button" class="g" id="tpl">插入白飯／主菜／副菜／青菜／湯範本</button>
<textarea id="tx" placeholder="白飯：軟硬適中&#10;主菜：…"></textarea>
<label>餐點照片（可多選，只拍餐點，不要拍到人）</label><input type="file" id="ph" accept="image/*" multiple><div class="th" id="th"></div>
<button id="go">送出給幹部審核</button><div class="msg" id="m"></div>
<p class="mu">送出後由幹部審核才會公開；審核前可再次送出覆蓋。</p></section>`
   : `<div class="empty">🌱 目前沒有需要填寫的輪值日${info.upcoming.length ? `<br>下一次輪值：${info.upcoming.map(d => md(d) + "（" + wd(d) + "）").join("、")}` : ""}</div>`}
${open.filter(o => o.s == "已發布").length ? `<section class="f"><h2>已完成</h2><ul class="hi">${open.filter(o => o.s == "已發布").map(o => `<li>${md(o.d)}　${ST[o.s]}</li>`).join("")}</ul></section>` : ""}
${info.history.length ? `<section class="f"><h2>我的紀錄</h2><ul class="hi">${info.history.map(h => `<li>${md(h.d)}　${ST[h.s] || E(h.s)}${h.note ? `　<span class="mu">幹部備註：${E(h.note)}</span>` : ""}</li>`).join("")}</ul></section>` : ""}`;
  if (!ed.length) return;
  const sync = () => { const o = ed.find(x => x.d == $("d").value); $("tx").value = o.text || ""; $("note").innerHTML = o.note ? `<p class="msg er">幹部備註：${E(o.note)}</p>` : (o.nph ? `<p class="mu">已上傳 ${o.nph} 張照片；若要換照片請重新選擇，沒選則保留原照片。</p>` : ""); };
  $("d").onchange = sync; sync();
  $("tpl").onclick = () => { const t = $("tx"); t.value += (t.value && !t.value.endsWith("\n") ? "\n" : "") + "白飯：\n主菜：\n副菜：\n青菜：\n湯：\n整體："; t.focus(); };
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
