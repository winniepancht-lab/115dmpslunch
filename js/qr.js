// 輕量 QR Code 產生器（位元組模式、糾錯等級 M、版本 1–40）。
// 依 ISO/IEC 18004 的公開演算法撰寫，不依賴外部套件。
// 用法：const q = QR.make("https://..."); q.size; q.get(x, y) → true 代表黑點
(function (root) {
  const ECC_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
  const BLK_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];
  const rawModules = v => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };
  const dataCodewords = v => Math.floor(rawModules(v) / 8) - ECC_M[v] * BLK_M[v];
  const gmul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 0xFF; };
  const rsDivisor = n => { const r = new Array(n).fill(0); r[n - 1] = 1; let root = 1;
    for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) { r[j] = gmul(r[j], root); if (j + 1 < n) r[j] ^= r[j + 1]; } root = gmul(root, 2); } return r; };
  const rsRemainder = (data, div) => { const r = div.map(() => 0);
    for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= gmul(c, f); }); } return r; };
  const utf8 = s => Array.from(new TextEncoder().encode(s));

  function make(text) {
    const bytes = utf8(text);
    let ver = 1;
    for (; ver <= 40; ver++) { const cc = ver < 10 ? 8 : 16; if (4 + cc + bytes.length * 8 <= dataCodewords(ver) * 8) break; }
    if (ver > 40) throw new Error("內容太長，無法產生 QR Code");
    // 資料位元
    const bits = []; const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); bytes.forEach(b => put(b, 8));
    const cap = dataCodewords(ver) * 8;
    put(0, Math.min(4, cap - bits.length)); put(0, (8 - bits.length % 8) % 8);
    for (let p = 0xEC; bits.length < cap; p ^= 0xEC ^ 0x11) put(p, 8);
    const data = []; for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
    // 糾錯碼與交錯
    const nb = BLK_M[ver], ecl = ECC_M[ver], raw = Math.floor(rawModules(ver) / 8), nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), div = rsDivisor(ecl), blocks = [];
    for (let i = 0, k = 0; i < nb; i++) { const d = data.slice(k, k + shortLen - ecl + (i < nShort ? 0 : 1)); k += d.length; const e = rsRemainder(d, div); if (i < nShort) d.push(0); blocks.push(d.concat(e)); }
    const cw = []; for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i != shortLen - ecl || j >= nShort) cw.push(b[i]); });
    // 畫功能圖形
    const size = ver * 4 + 17, m = [], fn = [];
    for (let y = 0; y < size; y++) { m.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    const setF = (x, y, d) => { m[y][x] = d; fn[y][x] = true; };
    for (let i = 0; i < size; i++) { setF(6, i, i % 2 == 0); setF(i, 6, i % 2 == 0); }
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(([cx, cy]) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy)); if (x >= 0 && x < size && y >= 0 && y < size) setF(x, y, d != 2 && d != 4); } });
    if (ver > 1) { const n = Math.floor(ver / 7) + 2, step = ver == 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2, pos = [6];
      for (let p = size - 7; pos.length < n; p -= step) pos.splice(1, 0, p);
      pos.forEach((a, i) => pos.forEach((b, j) => { if ((i == 0 && j == 0) || (i == 0 && j == n - 1) || (i == n - 1 && j == 0)) return;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(a + dx, b + dy, Math.max(Math.abs(dx), Math.abs(dy)) != 1); })); }
    const drawFormat = mask => { const d = (0 << 3) | mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537); const f = ((d << 10) | r) ^ 0x5412, bit = i => ((f >>> i) & 1) == 1;
      for (let i = 0; i <= 5; i++) setF(8, i, bit(i)); setF(8, 7, bit(6)); setF(8, 8, bit(7)); setF(7, 8, bit(8)); for (let i = 9; i < 15; i++) setF(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, bit(i)); for (let i = 8; i < 15; i++) setF(8, size - 15 + i, bit(i)); setF(8, size - 8, true); };
    drawFormat(0);
    if (ver >= 7) { let r = ver; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25); const v = (ver << 12) | r;
      for (let i = 0; i < 18; i++) { const b = ((v >>> i) & 1) == 1, a = size - 11 + i % 3, c = Math.floor(i / 3); setF(a, c, b); setF(c, a, b); } }
    // 放入資料
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) { if (right == 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) { const x = right - j, up = ((right + 1) & 2) == 0, y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && i < cw.length * 8) { m[y][x] = ((cw[i >>> 3] >>> (7 - (i & 7))) & 1) == 1; i++; } } }
    // 遮罩：挑懲罰分數最低者
    const cond = [(x, y) => (x + y) % 2 == 0, (x, y) => y % 2 == 0, x => x % 3 == 0, (x, y) => (x + y) % 3 == 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 == 0,
      (x, y) => x * y % 2 + x * y % 3 == 0, (x, y) => (x * y % 2 + x * y % 3) % 2 == 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 == 0];
    const apply = k => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && cond[k](x, y)) m[y][x] = !m[y][x]; };
    const penalty = () => { let p = 0, dark = 0;
      for (let a = 0; a < 2; a++) for (let u = 0; u < size; u++) { let run = 1; for (let v = 1; v <= size; v++) { const cur = v < size ? (a ? m[v][u] : m[u][v]) : null, prev = a ? m[v - 1][u] : m[u][v - 1];
        if (cur === prev) run++; else { if (run >= 5) p += 3 + run - 5; run = 1; } } }
      for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = m[y][x]; if (c == m[y][x + 1] && c == m[y + 1][x] && c == m[y + 1][x + 1]) p += 3; }
      m.forEach(r => r.forEach(c => { if (c) dark++; })); const t = size * size; p += Math.floor(Math.abs(dark * 20 - t * 10) / t) * 10; return p; };
    let best = 0, bestP = Infinity;
    for (let k = 0; k < 8; k++) { apply(k); drawFormat(k); const p = penalty(); if (p < bestP) { bestP = p; best = k; } apply(k); }
    apply(best); drawFormat(best);
    return { size, version: ver, get: (x, y) => x >= 0 && y >= 0 && x < size && y < size && m[y][x] };
  }

  // 畫到 canvas：scale＝每格像素，回傳畫好的 QR 區域大小
  function draw(ctx, q, x0, y0, px) { ctx.fillStyle = "#fff"; ctx.fillRect(x0, y0, (q.size + 8) * px, (q.size + 8) * px); ctx.fillStyle = "#000";
    for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.get(x, y)) ctx.fillRect(x0 + (x + 4) * px, y0 + (y + 4) * px, px, px);
    return (q.size + 8) * px; }

  root.QR = { make, draw };
  if (typeof module != "undefined") module.exports = root.QR;
})(typeof window != "undefined" ? window : globalThis);
