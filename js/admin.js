(() => {
const C = window.CONFIG, $ = id => document.getElementById(id);
const today = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
$("date").value = $("qd").value = today;
$("key").value = localStorage.getItem("dmpa_key") || "";
let files = [];

function shrink(f) { return new Promise(res => {
  const u = URL.createObjectURL(f), im = new Image();
  im.onerror = () => res(null);
  im.onload = () => { const k = Math.min(1, 1000 / Math.max(im.width, im.height)), c = document.createElement("canvas");
    c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
    const url = c.toDataURL("image/jpeg", .72); res({ u: url, b64: url.split(",")[1] }); };
  im.src = u; }); }
$("ph").onchange = async e => {
  files = []; $("th").innerHTML = "";
  for (const f of e.target.files) { const p = await shrink(f); if (p) files.push(p); else $("m1").textContent = "有照片格式無法讀取（例如 HEIC），請改選 JPG/PNG"; }
  $("th").innerHTML = files.map(p => `<img src="${p.u}" alt="">`).join("");
};

async function post(payload, btn, msg, ok) {
  const key = $("key").value.trim(); if (!key) { msg.className = "msg er"; msg.textContent = "請先填通關密語"; return false; }
  localStorage.setItem("dmpa_key", key); payload.key = key;
  btn.disabled = true; msg.className = "msg"; msg.textContent = "送出中…（有照片會比較久）";
  try {
    const r = await fetch(C.GAS_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
    const d = await r.json();
    if (d.status !== "success") throw new Error(d.message || "失敗");
    msg.className = "msg ok"; msg.textContent = ok; return true;
  } catch (e) {
    msg.className = "msg er"; msg.textContent = "⚠️ " + (e.message === "Failed to fetch" ? "無法確認是否成功，請先到前台或試算表確認，避免重複送出" : e.message); return false;
  } finally { btn.disabled = false; }
}

$("b1").onclick = async () => {
  if (!$("fb").value.trim() && !files.length) return alert("請至少填試菜心得或選照片");
  const ok = await post({ type: "lunch", date: $("date").value, classId: $("cls").value.trim(), menu: $("menu").value.trim(), feedback: $("fb").value.trim(), photos: files.map(p => p.b64) }, $("b1"), $("m1"), "✅ 已送出！前台稍後更新");
  if (ok) { $("fb").value = $("menu").value = $("ph").value = ""; $("th").innerHTML = ""; files = []; }
};
$("b2").onclick = async () => {
  if (!$("qt").value.trim()) return alert("請填標題");
  const ok = await post({ type: "qa", date: $("qd").value, title: $("qt").value.trim(), summary: $("qs").value.trim(), reply: $("qr").value.trim() }, $("b2"), $("m2"), "✅ 已送出！");
  if (ok) { $("qt").value = $("qs").value = $("qr").value = ""; loadPend(); }
};
$("b3").onclick = async () => {
  const v = $("pend").value; if (!v || !$("pr").value.trim()) return alert("請選擇一則並填寫回覆");
  const [date, title] = JSON.parse(v);
  const ok = await post({ type: "reply", date, title, reply: $("pr").value.trim() }, $("b3"), $("m3"), "✅ 回覆已補上！");
  if (ok) { $("pr").value = ""; setTimeout(loadPend, 1500); }
};

function loadPend() {
  if (!C.QA_URL) { $("pend").innerHTML = '<option value="">（尚未設定反映分頁網址）</option>'; return; }
  Papa.parse(C.QA_URL + (C.QA_URL.includes("?") ? "&" : "?") + "t=" + Date.now(), { download: true, header: true, skipEmptyLines: true, transformHeader: h => h.trim(), complete: r => {
    const rows = r.data.filter(x => String(x["狀態"] || "").trim() == "追蹤中" || (!String(x["狀態"] || "").trim() && !String(x["營養師回覆"] || "").trim()));
    $("pend").innerHTML = rows.length ? rows.map(x => { const m = String(x["日期"]).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/), d = m ? `${m[1]}-${("0" + m[2]).slice(-2)}-${("0" + m[3]).slice(-2)}` : x["日期"];
      return `<option value='${JSON.stringify([d, x["標題"]]).replace(/'/g, "&#39;")}'>${d.slice(5)}｜${String(x["標題"]).replace(/</g, "&lt;")}</option>`; }).join("") : '<option value="">目前沒有追蹤中的反映 🎉</option>';
  }, error: () => { $("pend").innerHTML = '<option value="">載入失敗</option>'; } });
}
loadPend();
})();
