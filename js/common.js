// 共用工具：資料讀取（先顯示快取、背景更新）、日期/週、照片、燈箱、關鍵字統計
(function () {
const C = window.CONFIG || {}, H = window.H = {};
const pad = n => String(n).padStart(2, "0"); H.pad = pad;
H.$ = id => document.getElementById(id);
H.E = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
H.norm = d => { const m = String(d || "").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/); return m ? `${m[1]}-${pad(m[2])}-${pad(m[3])}` : ""; };
const dt = d => new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const iso = t => `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
const WK = ["日", "一", "二", "三", "四", "五", "六"];
H.md = d => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;
H.wd = d => WK[dt(d).getDay()];
H.monday = d => { const t = dt(d); t.setDate(t.getDate() - (t.getDay() + 6) % 7); return iso(t); };
H.addDays = (d, n) => { const t = dt(d); t.setDate(t.getDate() + n); return iso(t); };
H.grade = c => { const g = { 1: "一", 2: "二", 3: "三", 4: "四", 5: "五", 6: "六" }[String(c || "").trim().charAt(0)]; return g ? g + "年級代表" : "家長代表"; };
// 照片：Drive 分享連結 → 縮圖網址；列表用小圖、點開用大圖；網站內相對路徑（img/xx.jpg）照用
H.photo = u => { const m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([\w-]+)/); return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w800` : u; };
H.thumb = u => u.replace(/sz=w\d+/, "sz=w400"); H.big = u => u.replace(/sz=w\d+/, "sz=w1600");
H.urls = s => String(s || "").split(/[\s,，]+/).filter(Boolean).map(H.photo);
H.gal = (list, cls) => `<div class="gal ${cls || ""}">${list.map(p => `<a href="${H.E(H.big(p))}"><img src="${H.E(H.thumb(p))}" alt="照片" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a>`).join("")}</div>`;
H.chip = s => s == "追蹤中" ? `<span class="chip wait">⏳ 追蹤中</span>` : s == "已回覆" ? `<span class="chip ok">✅ 已回覆</span>` : `<span class="chip in">💡 ${H.E(s)}</span>`;
const hidden = r => /^(否|n|no|隱藏|x)$/i.test(String(r["公開"] || "").trim());
H.semInfo = d => { const y = +d.slice(0, 4), m = +d.slice(5, 7), t = (m >= 8 || m == 1) ? 1 : 2, ay = (m >= 8 ? y : y - 1) - 1911; return { id: ay + "-" + t, name: `${ay}學年度第${t}學期`, t }; };
H.ord = (m, t) => (t == 1 && +m < 8) ? +m + 12 : +m;
const DEF = { 1: ["09", "10", "11", "12", "01"], 2: ["02", "03", "04", "05", "06"] };

// ---- CSV 解析（不依賴外部套件，少一個網路請求）----
H.csv = t => {
  t = t.replace(/^\uFEFF/, ""); const rows = []; let f = "", r = [], q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (q) { if (c == '"') { if (t[i + 1] == '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c == '"') q = true; else if (c == ",") { r.push(f); f = ""; }
    else if (c == "\n" || c == "\r") { if (c == "\r" && t[i + 1] == "\n") i++; r.push(f); f = ""; rows.push(r); r = []; }
    else f += c; }
  if (f !== "" || r.length) { r.push(f); rows.push(r); }
  if (!rows.length) return []; const h = rows[0].map(x => x.trim());
  return rows.slice(1).filter(r => r.some(x => x !== "")).map(r => Object.fromEntries(h.map((k, i) => [k, r[i] == null ? "" : r[i]])));
};
H.fetchCsv = async (url, fresh) => {
  const r = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + (fresh ? Date.now() : Math.floor(Date.now() / 3e5)));
  if (!r.ok) throw new Error("http " + r.status); return H.csv(await r.text());
};
// 公開資料由 Apps Script 提供（已去識別化：只有年級）。先回傳快取（立刻可顯示），再由 fresh 取得最新資料
H.load = () => {
  let cache = null; try { cache = JSON.parse(localStorage.getItem("dmpa3")); } catch (e) {}
  const fresh = fetch(C.GAS_URL + "?action=public&t=" + Math.floor(Date.now() / 6e4)).then(r => r.json()).then(d => {
    if (d.status !== "success") throw new Error(d.message || "載入失敗");
    const o = { l: d.l, q: d.q }; try { localStorage.setItem("dmpa3", JSON.stringify(o)); } catch (e) {} return o; });
  return { cache, fresh };
};
// 照片縮小（手機端先壓縮再上傳）
H.shrink = f => new Promise(res => {
  const im = new Image(); im.onerror = () => res(null);
  im.onload = () => { const k = Math.min(1, 1000 / Math.max(im.width, im.height)), c = document.createElement("canvas");
    c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
    const u = c.toDataURL("image/jpeg", .72); res({ u, b64: u.split(",")[1] }); };
  im.src = URL.createObjectURL(f); });

// ---- 資料整理 ----
H.build = (lunch, qa) => {
  const M = {}, sem = d => { const i = H.semInfo(d); return M[i.id] || (M[i.id] = { id: i.id, name: i.name, t: i.t, dm: {}, qa: [] }); };
  lunch.filter(r => !hidden(r)).forEach(r => {
    const d = H.norm(r["日期"]); if (!d) return;
    const s = sem(d), x = s.dm[d] || (s.dm[d] = { d, menu: "", msrc: "", mp: [], plat: [], nut: null, ing: [], mi: [], reps: [], ph: [], n: [] });
    const menu = String(r["午餐菜色"] || "").trim(); if (menu && !x.menu) x.menu = menu;
    if (r["菜單來源"] && !x.msrc) x.msrc = r["菜單來源"];
    const js = (k, d) => { try { return r[k] ? JSON.parse(r[k]) : d; } catch (e) { return d; } };
    if (!x.mp.length) x.mp = js("平台照片", []).map(p => Object.assign({}, p, { u: H.picUrl(p.u) }));
    if (!x.plat.length) x.plat = js("平台菜色", []); if (!x.nut) x.nut = js("營養", null); if (!x.ing.length) x.ing = js("食材", []);
    x.mi.push(...H.urls(r["菜單圖片"])); x.ph.push(...H.urls(r["照片連結"]));
    const l = String(r["家代意見反饋"] || "").split("\n").map(v => v.trim()).filter(Boolean);
    if (l.length) x.reps.push({ c: H.grade(r["班級"]), l });
    const a = String(r["營養師回應"] || "").trim(); if (a) x.n.push(a);
  });
  qa.filter(r => !hidden(r)).forEach(r => {
    const d = H.norm(r["日期"]), t = String(r["標題"] || "").trim(); if (!d || !t) return;
    const a = String(r["營養師回覆"] || "").trim();
    sem(d).qa.push({ d, t, q: String(r["反映摘要"] || "").trim(), a, s: String(r["狀態"] || "").trim() || (a ? "已回覆" : "追蹤中"), ph: H.urls(r["照片連結"]) });
  });
  return Object.values(M).sort((a, b) => a.id < b.id ? -1 : 1).map(s => {
    const days = Object.values(s.dm).sort((a, b) => a.d < b.d ? -1 : 1), set = new Set(DEF[s.t]);
    days.forEach(x => set.add(x.d.slice(5, 7))); s.qa.forEach(x => set.add(x.d.slice(5, 7)));
    return { id: s.id, name: s.name, t: s.t, days, qa: s.qa.sort((a, b) => a.d < b.d ? -1 : 1), months: [...set].sort((a, b) => H.ord(a, s.t) - H.ord(b, s.t)) };
  });
};

// ---- 關鍵字統計（自動、僅供參考）----
const BAD = [["偏鹹", /(?<![不沒])(?:偏|太|稍微|稍|有點|較|很|過)鹹/], ["偏乾／柴", /(?<![不沒])(?:偏|太|稍|有點|較|很|微)(?:乾|柴)|(?<![不沒])柴|咬不動/], ["偏油／油耗", /油耗|油膩|偏油|太油|很油/],
  ["偏苦", /(?<!不|沒有|不會)苦(?!瓜)/], ["腥味", /(?<!不|沒有|不會|無)腥/], ["偏軟爛", /偏軟|過爛|太爛|太軟|軟爛(?!不)/], ["偏涼", /已涼|偏涼|有點涼|是涼的|涼了|冰冷/]];
const GOOD = /好吃|不錯|適中|剛好|入味|鮮甜|好喝|下飯|Q彈|OK|ok|正常/;
H.kw = days => { const bad = {}; let good = 0, total = 0;
  days.forEach(x => x.reps.forEach(r => r.l.forEach(l => { total++; BAD.forEach(([k, re]) => { if (re.test(l)) bad[k] = (bad[k] || 0) + 1; }); if (GOOD.test(l)) good++; })));
  return { bad: Object.entries(bad).sort((a, b) => b[1] - a[1]), good, total }; };

// ---- 燈箱 ----
let lbL = [], lbI = 0, lb;
function show() { lb.querySelector("img").src = lbL[lbI]; lb.querySelector(".p").style.display = lb.querySelector(".n").style.display = lbL.length > 1 ? "" : "none"; }
H.openLb = (list, i) => {
  if (!lb) { lb = document.createElement("div"); lb.id = "lb"; lb.innerHTML = '<img alt=""><button class="x" aria-label="關閉">✕</button><button class="p" aria-label="上一張">‹</button><button class="n" aria-label="下一張">›</button>';
    lb.onclick = e => { const c = e.target.className; if (c == "x" || e.target == lb) lb.classList.remove("on"); else if (c == "p") { lbI = (lbI + lbL.length - 1) % lbL.length; show(); } else if (c == "n") { lbI = (lbI + 1) % lbL.length; show(); } };
    document.body.appendChild(lb); addEventListener("keydown", e => { if (!lb.classList.contains("on")) return; if (e.key == "Escape") lb.classList.remove("on"); if (e.key == "ArrowLeft") lb.querySelector(".p").click(); if (e.key == "ArrowRight") lb.querySelector(".n").click(); }); }
  lbL = list; lbI = i; show(); lb.classList.add("on");
};
document.addEventListener("click", e => { const a = e.target.closest(".gal a"); if (!a) return; e.preventDefault(); const as = [...a.parentNode.querySelectorAll("a")]; H.openLb(as.map(x => x.href), as.indexOf(a)); });

// ---- 教育部校園食材登錄平台（2026/11 依實際回傳格式撰寫；平台允許跨網域讀取）----
H.MOE = "https://fatraceschool.k12ea.gov.tw"; H.SCHOOL_ID = C.SCHOOL_ID || "353606";
H.MOE_PAGE = H.MOE + "/frontend/search.html?school=" + H.SCHOOL_ID;
const SRC_LINK = `<a href="${H.MOE_PAGE}" target="_blank" rel="noopener">教育部校園食材登錄平台</a>`;
H.picUrl = u => { u = String(u || ""); const m = u.match(/\/mnt\/hdb\/.*_(\d+)\.\w*$/); return m ? H.MOE + "/dish/pic/" + m[1] : u; };
// 平台照片載入後檢查：484×476 是平台「無照片」預設圖，壞圖也一併移除
H.moeOk = img => { if (img.naturalWidth == 484 && img.naturalHeight == 476) H.moeErr(img); };
H.moeErr = img => { const a = img.closest("a"), box = img.closest(".moe"); if (a) a.remove(); if (box && !box.querySelector(".gal a")) box.remove(); };
const TYPE_ICON = { "主食": "🍚", "主菜": "🍗", "副菜": "🥚", "蔬菜": "🥬", "湯品": "🍲", "點心": "🍪", "水果": "🍎", "飲品": "🥛" };
// 平台菜色照片（明確標示來源，非家代拍攝）；note=false 時只出圖
H.moeGal = (pics, note) => pics && pics.length ? `<div class="moe">${note === false ? "" : `<div class="sec">🏫 平台菜色照片 <span class="src">取自${SRC_LINK}，非家代現場拍攝</span></div>`}<div class="gal moeg">${pics.map(p => `<a href="${H.E(p.u)}"><img src="${H.E(p.u)}" alt="${H.E(p.n)}（平台照片）" loading="lazy" decoding="async" referrerpolicy="no-referrer" onload="H.moeOk(this)" onerror="H.moeErr(this)"><span class="cap">${p.t ? H.E(p.t) + "・" : ""}${H.E(p.n)}</span></a>`).join("")}</div></div>` : "";
// 菜單：有平台菜色就依類別列出
H.platMenu = plat => `<ul class="dishes">${plat.map(d => `<li><span class="dt">${TYPE_ICON[d.t] || "🍴"} ${H.E(d.t || "菜色")}</span>${H.E(d.n)}</li>`).join("")}</ul>`;
const NUT = [["cal", "熱量", "大卡"], ["g", "全穀雜糧", "份"], ["m", "豆魚蛋肉", "份"], ["v", "蔬菜", "份"], ["o", "油脂", "份"], ["k", "乳品", "份"], ["f", "水果", "份"]];
H.nutHtml = n => n ? `<div class="nut">${NUT.filter(([k]) => n[k] > 0).map(([k, l, u]) => `<span class="${k == "cal" ? "cal" : ""}"><b>${k == "cal" ? Math.round(n[k]) : (+n[k]).toFixed(1).replace(/\.0$/, "")}</b> ${u}<small>${l}</small></span>`).join("")}</div>` : "";
H.ingHtml = ing => ing && ing.length ? `<details class="ing"><summary>🥬 食材與產地 <span class="src">資料來源：${SRC_LINK}</span></summary><ul>${ing.map(d => `<li><b>${H.E(d.n)}</b>：${d.i.map(([a, o, c]) => H.E(a) + (o ? `<small>（${H.E(o)}）</small>` : "") + (c ? `<span class="cert">${H.E(c)}</span>` : "")).join("、")}</li>`).join("")}</ul></details>` : "";
// 由使用者的瀏覽器直接向平台查詢：菜色（含類別、照片）、營養、食材
H.moeFetch = async (date, withIng = true) => { const log = [];
  const get = async u => { const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 9000);
    try { const r = await fetch(H.MOE + u, { headers: { Accept: "application/json" }, signal: ac.signal }); log.push(r.status + " " + u); return await r.json(); }
    catch (e) { throw new Error(e.name == "AbortError" ? "平台回應逾時" : e.message); } finally { clearTimeout(tm); } };
  try {
    const meal = await get(`/offered/meal?KitchenId=all&MenuType=1&period=${date}&SchoolId=${H.SCHOOL_ID}`), bs = (meal && meal.data) || [];
    if (!bs.length) return { dishes: [], nut: null, ing: [], log };
    const nut = {}; [["TypeGrains", "g"], ["TypeMeatBeans", "m"], ["TypeVegetable", "v"], ["TypeOil", "o"], ["TypeMilk", "k"], ["TypeFruit", "f"], ["Calorie", "cal"]].forEach(([a, b]) => { const v = parseFloat(bs[0][a]); if (!isNaN(v)) nut[b] = v; });
    const dishes = [];
    for (const b of bs) { const ds = ((await get(`/dish?BatchDataId=${encodeURIComponent(b.BatchDataId)}`)).data || []).filter(d => d.DishName && d.DishType && d.DishName != "調味料").sort((a, c) => (a.DishOrder || 0) - (c.DishOrder || 0));
      ds.forEach(d => { if (!dishes.some(x => x.n == d.DishName)) dishes.push({ n: String(d.DishName).trim(), t: d.DishType || "", u: d.DishId ? H.MOE + "/dish/pic/" + d.DishId : "", id: String(d.DishId || ""), b: String(b.BatchDataId) }); }); }
    const ing = [];
    if (withIng) await Promise.all(dishes.filter(d => d.id).map(async d => { try {
      const l = ((await get(`/ingredient?BatchDataId=${d.b}&DishId=${d.id}`)).data || []).map(x => [String(x.IngredientName || "").trim(), String(x.IngredientSourceNameList || "").trim(), (x.Certification || []).map(c => c.SourceCertification).filter(Boolean).join("/")]).filter(x => x[0]);
      if (l.length) ing.push({ n: d.n, i: l }); } catch (e) { log.push("食材讀取失敗：" + d.n); } }));
    ing.sort((a, b) => dishes.findIndex(d => d.n == a.n) - dishes.findIndex(d => d.n == b.n));
    return { dishes, nut: Object.keys(nut).length ? nut : null, ing, log };
  } catch (e) { log.push("瀏覽器查詢失敗：" + e.message); return { dishes: [], nut: null, ing: [], log }; } };
// 填寫範本：有平台菜色就依菜名（附類別），否則一般範本
H.dishTpl = menu => { const list = Array.isArray(menu) ? menu.map(d => d.t ? `${d.n}（${d.t}）` : d.n) : String(menu || "").split(/[、，,\n]+/).map(s => s.trim()).filter(Boolean);
  return (list.length ? list : ["白飯", "主菜", "副菜", "青菜", "湯"]).map(x => x + "：").join("\n") + "\n整體："; };
// 「插入範本」：內容是空的或仍是上一次的範本就直接取代；有自己寫的內容才先確認
H.putTpl = (ta, tpl) => { const cur = ta.value.trim(); if (cur && cur != (ta.dataset.tpl || "").trim() && !confirm("要用新的範本取代目前已填寫的內容嗎？")) return false;
  ta.value = tpl; ta.dataset.tpl = tpl; ta.focus(); return true; };
H.isTpl = ta => !ta.value.trim() || ta.value.trim() == (ta.dataset.tpl || "").trim();

// 每日卡 / 反映卡（首頁與週報共用）
H.dayCard = x => `<section class="day" id="d-${x.d.slice(5, 7)}${x.d.slice(8, 10)}"><div class="dh"><div class="badge">${H.md(x.d)}<small>週${H.wd(x.d)}</small></div>${x.nut && x.nut.cal ? `<span class="kcal">🔥 ${Math.round(x.nut.cal)} 大卡</span>` : ""}</div>
${x.plat.length ? `<div class="menu">📋 <b>今日菜色</b><span class="src">資料來源：${SRC_LINK}</span>${H.platMenu(x.plat)}${H.nutHtml(x.nut)}${H.ingHtml(x.ing)}</div>`
  : x.menu ? `<div class="menu">📋 <b>今日菜色</b>　${H.E(x.menu)}${x.msrc == "教育局" ? `<span class="src">資料來源：${SRC_LINK}</span>` : ""}</div>` : ""}${x.mi.length ? H.gal(x.mi, "menus") : ""}
${H.moeGal(x.mp)}${x.ph.length ? `<div class="realbox"><div class="sec">📷 家代現場實拍 <span class="src">由當天試菜的家長代表拍攝（${x.ph.length} 張）</span></div>${H.gal(x.ph, "real")}</div>` : ""}
${x.reps.length ? `<div class="sec">✏️ 代表試菜紀錄</div>` + x.reps.map(r => `<div class="rep"><strong>${H.E(r.c)}</strong><ul>${r.l.map(l => `<li>${H.E(l)}</li>`).join("")}</ul></div>`).join("") : ""}
${x.n.map(n => `<div class="bub"><div class="av">🥗</div><div class="tx"><b>校方／營養師回應</b><br>${H.E(n)}</div></div>`).join("")}</section>`;
H.qaCard = (q, open) => `<details class="qi ${q.s == "追蹤中" ? "wait" : q.s == "已回覆" ? "ok" : ""}"${open ? " open" : ""}><summary>${H.chip(q.s)}<b>${H.E(q.t)}</b><span class="d">${H.md(q.d)}</span></summary>
${q.q ? `<div class="ask">✏️ <b>反映摘要</b>　${H.E(q.q)}</div>` : ""}${q.ph.length ? H.gal(q.ph) : ""}
${q.a ? `<div class="bub"><div class="av">🥗</div><div class="tx"><b>營養師／學校回覆</b><br>${H.E(q.a)}</div></div>` : q.s == "追蹤中" ? `<p class="mu">已向學校確認，尚待回覆 ⏳</p>` : ""}</details>`;
})();
