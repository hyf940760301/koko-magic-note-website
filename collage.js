// 晴窗手账 · 拼贴页面绘制库（Canvas2D，单位 = 厘米）
// 每个物件先画成独立的“精灵”画布（物件本地坐标），再贴到页面上：
// 贴的时候按物件的 alpha 生成两层杏色投影（贴纸面的紧贴影 + 抬起的柔影），半透明物件的影子按透明度自动变淡。
export const P = {
  ink: '#5A3B2E', inkBlue: '#4E7FB0', paper: '#FFF6E6', white: '#FFFDF8', honey: '#EDBE7A', honeyDeep: '#D9A04E',
  kraft: '#DDB98E', kraftDeep: '#C79C6B', snow: '#A8C4E4', snowDeep: '#7FA3CF', snowPale: '#E4EEF8', peach: '#FFC2A8',
  mint: '#A8DCC8', mintDeep: '#7FC2AA', coral: '#F48C7A', orange: '#F59248', stampRed: '#D65F4B', cocoa: '#7A4E3A',
  cream: '#FFF1DA', lilac: '#C9B6E4', sky: '#9CCBEB', sun: '#F6C445',
};
let K = 98.85; // 像素/厘米（由页面纹理决定）
export function setK(k) { K = k; }
export function getK() { return K; }
export function withK(k, fn) { const o = K; K = k; try { return fn(); } finally { K = o; } }
let REAL3D = false; // 3D 贴片模式：纸卡不再画假的厚度边（真侧壁由几何体提供）
export function setReal3D(b) { REAL3D = !!b; }
const rnd = (() => { let s = 7; return (seed) => { if (seed !== undefined) s = seed; s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
export function seed(n) { rnd(n * 7919 + 13); }

// ---------- 精灵 ----------
export function sprite(w, h, draw, pad = 0.0) {
  const cv = document.createElement('canvas'); cv.width = Math.ceil((w + 2 * pad) * K); cv.height = Math.ceil((h + 2 * pad) * K);
  const g = cv.getContext('2d'); g.scale(K, K); g.translate(pad, pad); g.lineJoin = 'round'; g.lineCap = 'round';
  draw(g, w, h); return { cv, w: w + 2 * pad, h: h + 2 * pad };
}
// 贴到页面：中心 (cx, cy)，旋转 rot（度）；lift = 抬起程度（0.3 贴平的胶带 … 1 普通卡片 … 1.8 翘起的贴纸）
export function place(g, sp, cx, cy, rot = 0, o = {}) {
  const lift = o.lift ?? 1, a = (rot * Math.PI) / 180, W = sp.w * K, H = sp.h * K, SH = 40000;
  const m = g.getTransform(); // 页面画布的变换（缩放 K）
  const X = m.a * cx + m.e, Y = m.d * cy + m.f;
  const layers = o.noShadow ? [] : [
    [`rgba(138,76,42,${0.34 * (o.dark ?? 1)})`, 0.045, 0.018, 0.03],               // 紧贴影：边缘一圈暖可可
    [`rgba(201,128,90,${0.26 * (o.dark ?? 1)})`, 0.30 * lift, 0.09 * lift, 0.16 * lift], // 柔影：杏色，随抬起变大
  ];
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  for (const [c, b, ox, oy] of layers) {
    g.save(); g.translate(X - SH, Y); g.rotate(a); g.shadowColor = c; g.shadowBlur = b * K; g.shadowOffsetX = SH + ox * K; g.shadowOffsetY = oy * K;
    g.drawImage(sp.cv, -W / 2, -H / 2, W, H); g.restore();
  }
  g.translate(X, Y); g.rotate(a); g.globalAlpha = o.alpha ?? 1; g.drawImage(sp.cv, -W / 2, -H / 2, W, H); g.restore();
}

// ---------- 小工具 ----------
export function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
let grainPat = null;
function grain(g, w, h, amt = 0.05, dark = false) {
  if (!grainPat) { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const d = x.createImageData(128, 128);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); grainPat = c; }
  const p = g.createPattern(grainPat, 'repeat'); p.setTransform(new DOMMatrix().scale(1 / K * 1.2));
  g.save(); g.globalCompositeOperation = dark ? 'multiply' : 'overlay'; g.globalAlpha = amt; g.fillStyle = p; g.fillRect(0, 0, w, h); g.restore();
}
// 纸卡：带 0.02 厚度的侧边（右下暗一圈）+ 左上细亮边
function card(g, w, h, color, r = 0.08, o = {}) {
  if (REAL3D) { g.fillStyle = color; rr(g, 0, 0, w, h, r); g.fill(); g.save(); rr(g, 0, 0, w, h, r); g.clip(); grain(g, w, h, o.grain ?? 0.06);
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 0.025; g.beginPath(); g.moveTo(0.05, h - 0.08); g.lineTo(0.05, 0.05); g.lineTo(w - 0.08, 0.05); g.stroke(); g.restore(); return; }
  g.save(); g.fillStyle = o.side || 'rgba(170,110,70,0.55)'; rr(g, 0.015, 0.03, w - 0.015, h - 0.03, r); g.fill(); g.restore();
  g.fillStyle = color; rr(g, 0, 0, w - 0.02, h - 0.03, r); g.fill();
  g.save(); rr(g, 0, 0, w - 0.02, h - 0.03, r); g.clip(); grain(g, w, h, o.grain ?? 0.06);
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.03; g.beginPath(); g.moveTo(0.06, h - 0.1); g.lineTo(0.06, 0.06); g.lineTo(w - 0.1, 0.06); g.stroke(); g.restore();
}
export function hand(g, text, x, y, size, color = P.ink, o = {}) { // 手写：逐字轻微抖动的基线与角度
  g.save(); g.fillStyle = color; g.font = `${size}px WenKai`; g.textBaseline = 'alphabetic'; let cx = x; const j = o.jitter ?? 1;
  for (const ch of text) { const w = g.measureText(ch).width; g.save(); g.translate(cx + w / 2, y + (rnd() - 0.5) * size * 0.06 * j); g.rotate((rnd() - 0.5) * 0.07 * j + (o.slant || 0)); g.fillText(ch, -w / 2, 0); g.restore(); cx += w * (o.track ?? 1.0); }
  g.restore(); return cx;
}
export function print(g, text, x, y, size, color = P.ink, font = 'ChillRound', align = 'left') { g.save(); g.fillStyle = color; g.font = `${size}px ${font}`; g.textAlign = align; g.fillText(text, x, y); g.restore(); }
function inkStroke(g, pts, w, color = P.ink, o = {}) { // 手绘线：两端收尖、中间略粗
  g.save(); g.strokeStyle = color; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let i = 1; i < pts.length; i++) { const t = i / (pts.length - 1); g.lineWidth = w * (o.taper === false ? 1 : 0.55 + 0.45 * Math.sin(Math.PI * t)); g.beginPath(); g.moveTo(...pts[i - 1]); g.lineTo(...pts[i]); g.stroke(); }
  g.restore();
}
function bez(p0, p1, p2, p3, n = 24) { const r = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; r.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); } return r; }

// ---------- 涂鸦（直接画在纸上的墨线）----------
export const doodle = {
  snowflake(g, x, y, r, color = P.inkBlue, w = 0.045) { for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.2; const ex = x + Math.cos(a) * r, ey = y + Math.sin(a) * r; inkStroke(g, [[x, y], [ex, ey]], w, color, { taper: false });
      for (const f of [0.55]) { const bx = x + Math.cos(a) * r * f, by = y + Math.sin(a) * r * f; for (const s of [-1, 1]) inkStroke(g, [[bx, by], [bx + Math.cos(a + s * 0.8) * r * 0.32, by + Math.sin(a + s * 0.8) * r * 0.32]], w * 0.9, color, { taper: false }); } } },
  star(g, x, y, r, color = P.honeyDeep, w = 0.045) { const pts = []; for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr2 = i % 2 ? r * 0.45 : r; pts.push([x + Math.cos(a) * rr2, y + Math.sin(a) * rr2]); } inkStroke(g, pts, w, color, { taper: false }); },
  arrow(g, p0, p1, p2, p3, color = P.ink, w = 0.045) { const pts = bez(p0, p1, p2, p3); inkStroke(g, pts, w, color); const n = pts.length, e = pts[n - 1], d = [e[0] - pts[n - 4][0], e[1] - pts[n - 4][1]]; const L = Math.hypot(...d); const ux = d[0] / L, uy = d[1] / L; const s = 0.28;
    inkStroke(g, [[e[0] - ux * s - uy * s * 0.6, e[1] - uy * s + ux * s * 0.6], e, [e[0] - ux * s + uy * s * 0.6, e[1] - uy * s - ux * s * 0.6]], w, color, { taper: false }); },
  dotted(g, p0, p1, p2, p3, color = P.inkBlue, w = 0.05) { const pts = bez(p0, p1, p2, p3, 80); g.save(); g.fillStyle = color; let acc = 0; for (let i = 1; i < pts.length; i++) { acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (acc > 0.22) { acc = 0; g.beginPath(); g.arc(pts[i][0], pts[i][1], w, 0, 7); g.fill(); } } g.restore(); },
  steam(g, x, y, color = P.ink) { for (let i = 0; i < 3; i++) { const sx = x + (i - 1) * 0.28; inkStroke(g, bez([sx, y], [sx - 0.15, y - 0.25], [sx + 0.15, y - 0.4], [sx, y - 0.65]), 0.035, color); } },
  heart(g, x, y, s, color = P.coral) { g.save(); g.fillStyle = color; g.beginPath(); g.moveTo(x, y + s * 0.35); g.bezierCurveTo(x - s * 0.9, y - s * 0.25, x - s * 0.35, y - s * 0.85, x, y - s * 0.35); g.bezierCurveTo(x + s * 0.35, y - s * 0.85, x + s * 0.9, y - s * 0.25, x, y + s * 0.35); g.fill(); g.restore(); },
  underline(g, x0, x1, y, color = P.coral, w = 0.05) { const pts = []; for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push([x0 + (x1 - x0) * t, y + Math.sin(t * 9) * 0.035]); } inkStroke(g, pts, w, color); },
  circle(g, x, y, rx, ry, rot, color = '#E0664F', w = 0.05) { const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40 * Math.PI * 2.12 - 0.3; const k2 = 1 + 0.05 * Math.sin(t * 3); pts.push([x + Math.cos(t) * rx * k2 * Math.cos(rot) - Math.sin(t) * ry * Math.sin(rot), y + Math.cos(t) * rx * k2 * Math.sin(rot) + Math.sin(t) * ry * Math.cos(rot)]); } inkStroke(g, pts, w, color, { taper: false }); },
  orange(g, x, y, r) { g.save(); g.fillStyle = 'rgba(245,146,72,0.85)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.restore(); inkStroke(g, Array.from({ length: 33 }, (_, i) => [x + Math.cos(i / 32 * 6.4) * r, y + Math.sin(i / 32 * 6.4) * r]), 0.04, P.ink, { taper: false }); g.save(); g.fillStyle = '#A8B26A'; g.beginPath(); g.ellipse(x + r * 0.3, y - r - 0.06, r * 0.32, r * 0.14, -0.5, 0, 7); g.fill(); g.restore(); },
};

// ---------- 物件 ----------
export const item = {
  // 和纸胶带：半透明、两端撕口、图案
  washi(w, h, color, pattern = 'dots', alpha = 0.8) { return sprite(w, h, (g) => {
    g.save(); g.globalAlpha = alpha; g.beginPath(); const n = Math.max(6, Math.round(h / 0.12)); g.moveTo(0.08, 0);
    for (let i = 0; i <= n; i++) g.lineTo(w - 0.08 + (i % 2 ? 0.07 : -0.02) + (rnd() - 0.5) * 0.04, (i / n) * h);
    for (let i = n; i >= 0; i--) g.lineTo(0.08 + (i % 2 ? -0.07 : 0.02) + (rnd() - 0.5) * 0.04, (i / n) * h); g.closePath(); g.fillStyle = color; g.fill(); g.clip();
    g.globalAlpha = 1; g.fillStyle = 'rgba(255,253,248,0.55)'; g.strokeStyle = 'rgba(255,253,248,0.6)';
    if (pattern === 'dots') for (let x = 0.25; x < w; x += 0.45) for (let y = 0.22; y < h; y += 0.45) { g.beginPath(); g.arc(x + ((y / 0.45) % 2) * 0.22, y, 0.06, 0, 7); g.fill(); }
    if (pattern === 'stripes') { g.lineWidth = 0.12; for (let x = -h; x < w + h; x += 0.38) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h, h); g.stroke(); } }
    if (pattern === 'grid') { g.lineWidth = 0.025; for (let x = 0.2; x < w; x += 0.3) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0.2; y < h; y += 0.3) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } }
    if (pattern === 'snow') for (let x = 0.35; x < w; x += 0.7) doodle.snowflake(g, x, h / 2 + ((x / 0.7) % 2 - 0.5) * h * 0.3, 0.16, 'rgba(255,253,248,0.85)', 0.03);
    g.restore(); grain(g, w, h, 0.05);
  }); },
  // 车票：票根打孔线、半圆缺口、印刷字
  ticket(w, h, o) { return sprite(w, h, (g) => {
    g.save(); g.beginPath(); rr(g, 0, 0, w, h, 0.12); g.clip(); card(g, w, h, o.color || P.cream, 0.12); const sx = w * 0.72;
    g.fillStyle = o.band || P.snow; g.fillRect(0, 0, w, h * 0.26); grain(g, w, h * 0.26, 0.06);
    g.restore();
    g.save(); g.globalCompositeOperation = 'destination-out'; for (const y of [0, h - 0.03]) { g.beginPath(); g.arc(sx, y, 0.22, 0, 7); g.fill(); } g.restore();
    g.save(); g.setLineDash([0.08, 0.09]); g.strokeStyle = 'rgba(90,59,46,0.45)'; g.lineWidth = 0.03; g.beginPath(); g.moveTo(sx, 0.3); g.lineTo(sx, h - 0.33); g.stroke(); g.restore();
    print(g, o.title, 0.3, h * 0.2, h * 0.15, P.white, 'ChillRound');
    print(g, o.sub, 0.3, h * 0.5, h * 0.12, P.ink, 'ChillRound');
    print(g, o.line || '', 0.3, h * 0.72, h * 0.095, 'rgba(90,59,46,0.95)', 'WenKai');
    print(g, o.no, 0.3, h * 0.9, h * 0.08, P.inkBlue, 'NunitoP');
    print(g, o.stub || '往返', sx + (w - sx) / 2, h * 0.55, h * 0.13, P.ink, 'ChillRound', 'center');
    print(g, o.price || '¥ 8', sx + (w - sx) / 2, h * 0.8, h * 0.09, P.inkBlue, 'NunitoP', 'center');
  }); },
  // 邮票：齿孔边 + 小插画 + 面值
  stamp(w, h, art = 'house', value = '8分') { return sprite(w, h, (g) => {
    g.fillStyle = P.white; g.fillRect(0, 0, w, h);
    g.save(); g.globalCompositeOperation = 'destination-out'; const s = 0.17; for (let x = s / 2; x < w; x += s) for (const y of [0, h]) { g.beginPath(); g.arc(x, y, 0.05, 0, 7); g.fill(); } for (let y = s / 2; y < h; y += s) for (const x of [0, w]) { g.beginPath(); g.arc(x, y, 0.05, 0, 7); g.fill(); } g.restore();
    const ix = 0.16, iy = 0.16, iw = w - 0.32, ih = h - 0.32;
    g.save(); rr(g, ix, iy, iw, ih, 0.04); g.clip();
    if (art === 'house') { const sky = g.createLinearGradient(0, iy, 0, iy + ih); sky.addColorStop(0, '#9DBBE0'); sky.addColorStop(1, '#DCE8F5'); g.fillStyle = sky; g.fillRect(ix, iy, iw, ih);
      g.fillStyle = P.white; g.beginPath(); g.ellipse(ix + iw / 2, iy + ih * 1.02, iw * 0.8, ih * 0.32, 0, 0, 7); g.fill();
      g.fillStyle = P.coral; g.beginPath(); g.moveTo(ix + iw * 0.25, iy + ih * 0.55); g.lineTo(ix + iw * 0.5, iy + ih * 0.32); g.lineTo(ix + iw * 0.75, iy + ih * 0.55); g.fill();
      g.fillStyle = P.cream; g.fillRect(ix + iw * 0.3, iy + ih * 0.55, iw * 0.4, ih * 0.22); g.fillStyle = P.sun; g.fillRect(ix + iw * 0.45, iy + ih * 0.6, iw * 0.1, ih * 0.08);
      g.fillStyle = P.white; for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(ix + rnd() * iw, iy + rnd() * ih * 0.5, 0.025, 0, 7); g.fill(); } }
    if (art === 'orange') { g.fillStyle = '#FBE3C4'; g.fillRect(ix, iy, iw, ih); g.fillStyle = P.orange; g.beginPath(); g.arc(ix + iw / 2, iy + ih * 0.55, iw * 0.3, 0, 7); g.fill(); g.fillStyle = '#A8B26A'; g.beginPath(); g.ellipse(ix + iw * 0.58, iy + ih * 0.27, iw * 0.12, iw * 0.05, -0.5, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,253,248,0.9)'; g.lineWidth = 0.03; g.beginPath(); g.arc(ix + iw / 2, iy + ih * 0.55, iw * 0.22, 3.5, 4.3); g.stroke(); }
    if (art === 'tree') { g.fillStyle = '#E3F0E2'; g.fillRect(ix, iy, iw, ih); g.fillStyle = P.mintDeep; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(ix + iw / 2, iy + ih * (0.15 + i * 0.18)); g.lineTo(ix + iw * (0.2 - i * 0.04), iy + ih * (0.45 + i * 0.16)); g.lineTo(ix + iw * (0.8 + i * 0.04), iy + ih * (0.45 + i * 0.16)); g.fill(); } g.fillStyle = P.kraftDeep; g.fillRect(ix + iw * 0.45, iy + ih * 0.82, iw * 0.1, ih * 0.12); }
    grain(g, w, h, 0.07); g.restore();
    print(g, value, ix + 0.08, iy + 0.3, 0.22, P.ink, 'ChillRound');
  }); },
  // 圆邮戳（墨色不均）：画在已有物件上
  postmark(g, x, y, r, text = '雪绒国', date = '12.07', color = 'rgba(78,127,176,0.78)') {
    const S2 = 7 * r; const sp = sprite(S2, S2, (q) => { q.translate(2 * r, S2 / 2); q.rotate(-0.25); q.strokeStyle = color; q.fillStyle = color; q.lineWidth = 0.04;
      q.beginPath(); q.arc(0, 0, r, 0, 7); q.stroke(); q.beginPath(); q.arc(0, 0, r * 0.78, 0, 7); q.stroke();
      q.font = `${r * 0.36}px ChillRound`; q.textAlign = 'center'; q.fillText(text, 0, -r * 0.1); q.font = `${r * 0.3}px NunitoP`; q.fillText(date, 0, r * 0.42);
      for (let i = 0; i < 4; i++) { q.beginPath(); for (let t = 0; t <= 1; t += 0.05) { const xx = r * 1.1 + t * r * 2.4, yy = -r * 0.5 + i * r * 0.33 + Math.sin(t * 12) * 0.05; t ? q.lineTo(xx, yy) : q.moveTo(xx, yy); } q.stroke(); }
      // 墨不匀：随机擦掉一些（只擦邮戳自己这一层）
      q.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 90; i++) { q.beginPath(); q.arc((rnd() - 0.3) * r * 4, (rnd() - 0.5) * r * 2.4, 0.02 + rnd() * 0.05, 0, 7); q.fill(); } });
    g.drawImage(sp.cv, x - 2 * r, y - S2 / 2, S2, S2);
  },
  // 信封：背片 + 打开的翻盖（雪花衬里）+ 探出的卡片 + 前袋 + 邮票邮戳 + 邮编格
  envelope(w, h, o = {}) { const fl = h * 0.42, peek = o.peek ?? 1.9; return sprite(w, h + fl + 0.2, (g) => {
    const y0 = fl + 0.2; // 信封主体顶边
    // 翻盖（打开，朝上）
    g.save(); g.beginPath(); g.moveTo(0.02, y0 + 0.02); g.lineTo(w * 0.5, y0 - fl); g.lineTo(w - 0.02, y0 + 0.02); g.closePath(); g.fillStyle = o.color || P.cream; g.fill(); g.clip();
    g.fillStyle = P.snowPale; g.beginPath(); g.moveTo(0.25, y0); g.lineTo(w * 0.5, y0 - fl + 0.3); g.lineTo(w - 0.25, y0); g.closePath(); g.fill();
    for (let i = 0; i < 16; i++) doodle.snowflake(g, 0.4 + rnd() * (w - 0.8), y0 - rnd() * (fl - 0.3), 0.1, 'rgba(127,163,207,0.7)', 0.02); grain(g, w, y0, 0.05); g.restore();
    g.fillStyle = 'rgba(160,110,70,0.35)'; g.fillRect(0.02, y0 - 0.02, w - 0.04, 0.05); // 折线
    // 背片
    g.fillStyle = o.color || P.cream; g.fillRect(0, y0, w, h);
    // 探出的卡片
    const cw = w * 0.84, cx = (w - cw) / 2 + 0.1; g.save(); g.translate(cx, y0 - peek); g.rotate(-0.02);
    card(g, cw, h * 0.95, P.white, 0.06); g.fillStyle = P.snowPale; g.fillRect(0.25, 0.25, cw * 0.42, 1.25);
    for (let i = 0; i < 5; i++) doodle.snowflake(g, 0.45 + rnd() * cw * 0.36, 0.45 + rnd() * 0.9, 0.12, P.snowDeep, 0.025);
    hand(g, '下雪啦！', cw * 0.52, 0.75, 0.42, P.inkBlue); hand(g, '寄给 Koko', cw * 0.52, 1.35, 0.32, P.ink);
    g.restore();
    // 前袋（两侧斜折 + 底部三角）
    g.save(); g.beginPath(); g.moveTo(0, y0 + h * 0.1); g.lineTo(w * 0.5, y0 + h * 0.62); g.lineTo(w, y0 + h * 0.1); g.lineTo(w, y0 + h); g.lineTo(0, y0 + h); g.closePath();
    g.fillStyle = o.color || P.cream; g.shadowColor = 'rgba(150,90,50,0.25)'; g.shadowBlur = 0.12 * K; g.shadowOffsetY = -0.03 * K; g.fill(); g.restore();
    g.save(); g.strokeStyle = 'rgba(170,120,80,0.35)'; g.lineWidth = 0.025; g.beginPath(); g.moveTo(0, y0 + h); g.lineTo(w * 0.5, y0 + h * 0.62); g.lineTo(w, y0 + h); g.stroke(); g.restore();
    // 航空边
    g.save(); g.beginPath(); g.rect(0, y0, w, h); g.clip(); for (let x = -1; x < w + 1; x += 0.6) { g.fillStyle = (Math.round(x / 0.6) % 2) ? P.coral : P.snowDeep; for (const yy of [y0 + h - 0.22]) { g.beginPath(); g.moveTo(x, yy + 0.22); g.lineTo(x + 0.3, yy); g.lineTo(x + 0.6, yy); g.lineTo(x + 0.3, yy + 0.22); g.fill(); } } g.restore();
    grain(g, w, h + y0, 0.045);
    // 邮编格
    g.save(); g.strokeStyle = P.stampRed; g.lineWidth = 0.03; for (let i = 0; i < 4; i++) g.strokeRect(0.35 + i * 0.42, y0 + h - 1.0, 0.32, 0.38); g.restore();
    hand(g, '1', 0.43, y0 + h - 0.7, 0.3, P.inkBlue); hand(g, '2', 0.85, y0 + h - 0.7, 0.3, P.inkBlue); hand(g, '0', 1.27, y0 + h - 0.7, 0.3, P.inkBlue); hand(g, '7', 1.69, y0 + h - 0.7, 0.3, P.inkBlue);
    const st = item.stamp(1.25, 1.5, 'house', '8分'); g.drawImage(st.cv, w - 1.6, y0 + h * 0.36, 1.25, 1.5);
    item.postmark(g, w - 1.7, y0 + h * 0.55, 0.52);
    hand(g, '雪绒国 邮政', w * 0.18, y0 + h * 0.86, 0.3, P.ink);
  }); },
  // 信封拆成三层真 3D 贴片：背片（含打开的翻盖）/ 探出的信卡（夹在中间）/ 前袋（最上，带航空边、邮票、邮戳）
  // 返回各层精灵 + 相对信封中心的偏移（厘米）与附加旋转
  envelopeParts(w, h, o = {}) { const fl = h * 0.42, peek = o.peek ?? 1.9, y0 = fl + 0.2, Ht = h + fl + 0.2, colr = o.color || P.cream;
    const back = sprite(w, y0 + h, (g) => {
      g.save(); g.beginPath(); g.moveTo(0.02, y0 + 0.02); g.lineTo(w * 0.5, y0 - fl); g.lineTo(w - 0.02, y0 + 0.02); g.closePath(); g.fillStyle = colr; g.fill(); g.clip();
      g.fillStyle = P.snowPale; g.beginPath(); g.moveTo(0.25, y0); g.lineTo(w * 0.5, y0 - fl + 0.3); g.lineTo(w - 0.25, y0); g.closePath(); g.fill();
      for (let i = 0; i < 16; i++) doodle.snowflake(g, 0.4 + rnd() * (w - 0.8), y0 - rnd() * (fl - 0.3), 0.1, 'rgba(127,163,207,0.7)', 0.02); grain(g, w, y0, 0.05); g.restore();
      g.fillStyle = colr; g.fillRect(0, y0, w, h);
      // 信封内侧：背片内面偏暗一点（从前袋开口看进去是有深度的）
      const gr = g.createLinearGradient(0, y0, 0, y0 + h * 0.7); gr.addColorStop(0, 'rgba(150,100,60,0.22)'); gr.addColorStop(1, 'rgba(150,100,60,0.0)'); g.fillStyle = gr; g.fillRect(0.05, y0, w - 0.1, h * 0.7);
      g.fillStyle = 'rgba(160,110,70,0.35)'; g.fillRect(0.02, y0 - 0.02, w - 0.04, 0.05); grain(g, w, y0 + h, 0.04);
    });
    const cw = w * 0.84, ch = h * 0.95, cx = (w - cw) / 2 + 0.1, cr = -0.02;
    const card2 = sprite(cw, ch, (g) => { card(g, cw, ch, P.white, 0.06); g.fillStyle = P.snowPale; g.fillRect(0.25, 0.25, cw * 0.42, 1.25);
      for (let i = 0; i < 5; i++) doodle.snowflake(g, 0.45 + rnd() * cw * 0.36, 0.45 + rnd() * 0.9, 0.12, P.snowDeep, 0.025);
      hand(g, '下雪啦！', cw * 0.52, 0.75, 0.42, P.inkBlue); hand(g, '寄给 Koko', cw * 0.52, 1.35, 0.32, P.ink); });
    const fy = y0 + h * 0.1, fh = h * 0.9;
    const front = sprite(w, fh, (g) => { g.translate(0, -fy);
      g.save(); g.beginPath(); g.moveTo(0, y0 + h * 0.1); g.lineTo(w * 0.5, y0 + h * 0.62); g.lineTo(w, y0 + h * 0.1); g.lineTo(w, y0 + h); g.lineTo(0, y0 + h); g.closePath(); g.fillStyle = colr; g.fill(); g.clip();
      g.strokeStyle = 'rgba(170,120,80,0.35)'; g.lineWidth = 0.025; g.beginPath(); g.moveTo(0, y0 + h); g.lineTo(w * 0.5, y0 + h * 0.62); g.lineTo(w, y0 + h); g.stroke();
      for (let x = -1; x < w + 1; x += 0.6) { g.fillStyle = (Math.round(x / 0.6) % 2) ? P.coral : P.snowDeep; const yy = y0 + h - 0.22; g.beginPath(); g.moveTo(x, yy + 0.22); g.lineTo(x + 0.3, yy); g.lineTo(x + 0.6, yy); g.lineTo(x + 0.3, yy + 0.22); g.fill(); }
      grain(g, w, h + y0, 0.045);
      g.save(); g.strokeStyle = P.stampRed; g.lineWidth = 0.03; for (let i = 0; i < 4; i++) g.strokeRect(0.35 + i * 0.42, y0 + h - 1.0, 0.32, 0.38); g.restore();
      hand(g, '1', 0.43, y0 + h - 0.7, 0.3, P.inkBlue); hand(g, '2', 0.85, y0 + h - 0.7, 0.3, P.inkBlue); hand(g, '0', 1.27, y0 + h - 0.7, 0.3, P.inkBlue); hand(g, '7', 1.69, y0 + h - 0.7, 0.3, P.inkBlue);
      const st = item.stamp(1.25, 1.5, 'house', '8分'); g.drawImage(st.cv, w - 1.6, y0 + h * 0.36, 1.25, 1.5);
      item.postmark(g, w - 1.7, y0 + h * 0.55, 0.52);
      hand(g, '雪绒国 邮政', w * 0.18, y0 + h * 0.86, 0.3, P.ink); g.restore();
      // 前袋上沿的折痕高光
      g.strokeStyle = 'rgba(255,253,246,0.8)'; g.lineWidth = 0.03; g.beginPath(); g.moveTo(0.04, y0 + h * 0.1 + 0.03); g.lineTo(w * 0.5, y0 + h * 0.62 - 0.02); g.lineTo(w - 0.04, y0 + h * 0.1 + 0.03); g.stroke(); });
    const ccx = cx + Math.cos(cr) * cw / 2 - Math.sin(cr) * ch / 2, ccy = (y0 - peek) + Math.sin(cr) * cw / 2 + Math.cos(cr) * ch / 2;
    return { w, h: Ht, back: { sp: back, ox: 0, oy: (y0 + h) / 2 - Ht / 2, rot: 0 }, card: { sp: card2, ox: ccx - w / 2, oy: ccy - Ht / 2, rot: cr * 180 / Math.PI },
      front: { sp: front, ox: 0, oy: fy + fh / 2 - Ht / 2, rot: 0 } }; },
  // 口袋里面：深一点的牛皮纸内衬（从张开的袋口看进去）
  pocketInner(w, h) { return sprite(w, h, (g) => { g.fillStyle = P.kraftDeep; rr(g, 0, 0, w, h, 0.05); g.fill(); const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(90,55,30,0.55)'); gr.addColorStop(0.5, 'rgba(90,55,30,0.15)'); gr.addColorStop(1, 'rgba(90,55,30,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); grain(g, w, h, 0.1); }); },
  // 硫酸纸（半透明描图纸）：压在下面的东西隐约透出来
  vellum(w, h, lines) { return sprite(w, h, (g) => {
    g.fillStyle = 'rgba(255,253,248,0.62)'; rr(g, 0, 0, w, h, 0.04); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 0.03; rr(g, 0.015, 0.015, w - 0.03, h - 0.03, 0.04); g.stroke();
    lines.forEach((s, i) => hand(g, s, 0.4, 0.9 + i * 0.72, 0.4, P.inkBlue));
  }); },
  // 吊牌：牛皮纸、打孔加固圈
  tag(w, h, lines) { return sprite(w, h, (g) => {
    g.save(); g.beginPath(); g.moveTo(0.5, 0); g.lineTo(w - 0.5, 0); g.lineTo(w, 0.5); g.lineTo(w, h); g.lineTo(0, h); g.lineTo(0, 0.5); g.closePath(); g.clip(); card(g, w, h, P.kraft, 0, { grain: 0.1 }); g.restore();
    g.fillStyle = P.white; g.beginPath(); g.arc(w / 2, 0.55, 0.26, 0, 7); g.fill(); g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(w / 2, 0.55, 0.13, 0, 7); g.fill(); g.restore();
    lines.forEach((s, i) => hand(g, s, 0.3, 1.5 + i * 0.6, 0.38, P.ink));
  }); },
  // 回形针：蜂蜜色金属线 + 高光
  paperclip(len = 3.0) { const w = 0.85; return sprite(w, len, (g) => {
    const path = () => { g.beginPath(); g.moveTo(0.2, len - 0.9); g.lineTo(0.2, 0.4); g.arc(0.425, 0.4, 0.225, Math.PI, 0); g.lineTo(0.65, len - 0.35); g.arc(0.38, len - 0.35, 0.27, 0, Math.PI); g.lineTo(0.11, 0.62); };
    g.strokeStyle = '#C08A3E'; g.lineWidth = 0.075; path(); g.stroke(); g.strokeStyle = '#EDBE7A'; g.lineWidth = 0.045; path(); g.stroke(); g.strokeStyle = 'rgba(255,248,225,0.95)'; g.lineWidth = 0.015; g.translate(-0.012, -0.012); path(); g.stroke();
  }, 0.08); },
  // 雪花打孔纸片
  punch(size, color = P.white) { return sprite(size, size, (g) => { const c = size / 2; g.fillStyle = color; g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.save(); g.translate(c, c); g.rotate(a); g.rect(-size * 0.07, -size * 0.5, size * 0.14, size * 0.5); g.restore(); } g.fill();
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; for (const s of [-1, 1]) { g.save(); g.translate(c + Math.sin(a) * size * 0.28, c - Math.cos(a) * size * 0.28); g.rotate(a + s * 0.9); g.fillRect(-size * 0.05, -size * 0.17, size * 0.1, size * 0.17); g.restore(); } }
    g.beginPath(); g.arc(c, c, size * 0.14, 0, 7); g.fill(); }); },
  // 圆贴纸「小橘子」
  orangeSticker(R) { const wb = R * 0.17; return sprite(2 * (R + wb), 2 * (R + wb) + 0.3, (g) => { const cx = R + wb, cy = R + wb + 0.3;
    g.fillStyle = P.white; g.beginPath(); g.arc(cx, cy, R + wb, 0, 7); g.fill();
    g.fillStyle = P.orange; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,253,248,0.9)'; g.lineWidth = 0.06; g.beginPath(); g.arc(cx, cy, R - 0.22, Math.PI * 1.05, Math.PI * 1.55); g.stroke();
    g.strokeStyle = 'rgba(150,84,48,0.75)'; g.lineWidth = Math.min(0.035, R * 0.035); g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();   // 细的暖可可描边（不再是粗黑锯齿圈）
    g.fillStyle = '#A8B26A'; g.beginPath(); g.ellipse(cx + 0.3 * R / 1.15, cy - R - 0.04, 0.45 * R / 1.15, 0.2 * R / 1.15, -0.5, 0, 7); g.fill(); g.strokeStyle = 'rgba(110,120,60,0.7)'; g.stroke();
    g.fillStyle = P.ink; g.beginPath(); g.arc(cx - 0.45, cy - 0.08, 0.12, 0, 7); g.arc(cx + 0.45, cy - 0.08, 0.12, 0, 7); g.fill();
    g.fillStyle = 'rgba(244,140,122,0.55)'; g.beginPath(); g.ellipse(cx - 0.75, cy + 0.25, 0.22, 0.12, 0, 0, 7); g.ellipse(cx + 0.75, cy + 0.25, 0.22, 0.12, 0, 0, 7); g.fill();
    g.strokeStyle = P.ink; g.beginPath(); g.lineWidth = 0.055; g.arc(cx, cy + 0.12, 0.28, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); }); },
  // 官方海报模切贴纸（像素不改，只加白边）
  imageSticker(img, w) { const h = w * img.height / img.width; return sprite(w, h, (g) => { g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, w, h); }); },
  // 红色日期章
  dateStamp(text = '12·07') { return sprite(2.0, 2.0, (g) => { const c = 1.0, col = 'rgba(214,95,75,0.85)'; g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 0.06; g.beginPath(); g.arc(c, c, 0.9, 0, 7); g.stroke(); g.lineWidth = 0.025; g.beginPath(); g.arc(c, c, 0.76, 0, 7); g.stroke();
    g.font = '0.42px NunitoP'; g.textAlign = 'center'; g.fillText(text, c, c + 0.15); g.font = '0.22px ChillRound'; g.fillText('晴转小雪', c, c - 0.35); g.fillText('KOKO', c, c + 0.55);
    g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 160; i++) { g.beginPath(); g.arc(rnd() * 2, rnd() * 2, 0.012 + rnd() * 0.035, 0, 7); g.fill(); } }); },
  // 写字的纸胶带标签
  tapeLabel(w, h, text, color = P.lilac) { return sprite(w, h, (g) => { const t = item.washi(w, h, color, 'none', 0.85); g.drawImage(t.cv, 0, 0, w, h); hand(g, text, 0.35, h * 0.68, h * 0.5, P.ink); }); },
  // 牛皮纸口袋（粘在页上），里面插着票据
  pocket(w, h) { return sprite(w, h, (g) => { g.save(); g.beginPath(); g.moveTo(0, 0.35); g.quadraticCurveTo(w / 2, -0.15, w, 0.35); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.clip(); card(g, w, h, P.kraft, 0, { grain: 0.12 }); g.restore();
    g.save(); g.setLineDash([0.16, 0.1]); g.strokeStyle = P.cream; g.lineWidth = 0.035; g.beginPath(); g.moveTo(0.18, 0.5); g.lineTo(0.18, h - 0.18); g.lineTo(w - 0.18, h - 0.18); g.lineTo(w - 0.18, 0.5); g.stroke(); g.restore();
    hand(g, '车票都收在这里', 0.45, h * 0.62, 0.38, P.ink); doodle.star(g, w - 0.8, h * 0.58, 0.22, P.white); }); },
  // 小地图（手绘路线）
  // 撕边纸：四边（或指定边）撕开的毛边 + 白色纸芯露边 + 可选花纹（格子/方格/条纹）
  torn(w, h, color, o = {}) { const pat = o.pattern || 'none', edges = o.edges || 'tblr'; return sprite(w, h, (g) => {
    const pts = []; const J = 0.09; const step = 0.12;
    const edge = (x0, y0, x1, y1, torn) => { const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(L / step)); const nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
      for (let i = 0; i < n; i++) { const t = i / n; const d = torn ? (rnd() - 0.2) * J + Math.sin(t * 13 + x0) * 0.03 : 0; pts.push([x0 + (x1 - x0) * t + nx * d, y0 + (y1 - y0) * t + ny * d]); } };
    const m = 0.12; edge(m, m, w - m, m, edges.includes('t')); edge(w - m, m, w - m, h - m, edges.includes('r')); edge(w - m, h - m, m, h - m, edges.includes('b')); edge(m, h - m, m, m, edges.includes('l'));
    const path = (o2) => { g.beginPath(); pts.forEach(([x, y], i) => { const cx = w / 2, cy = h / 2; const k2 = o2; const X = x + (x - cx) / Math.hypot(x - cx, y - cy) * k2, Y = y + (y - cy) / Math.hypot(x - cx, y - cy) * k2; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath(); };
    g.fillStyle = '#FFFBF2'; path(0.05); g.fill();                          // 撕口露出的白纸芯
    g.save(); path(-0.0); g.clip(); g.fillStyle = color; g.fillRect(0, 0, w, h);
    if (pat === 'gingham') { g.globalAlpha = 0.28; g.fillStyle = o.ink || P.snowDeep; for (let x = 0; x < w; x += 0.6) g.fillRect(x, 0, 0.3, h); for (let y = 0; y < h; y += 0.6) g.fillRect(0, y, w, 0.3); g.globalAlpha = 1; }
    if (pat === 'grid') { g.strokeStyle = o.ink || 'rgba(127,163,207,0.35)'; g.lineWidth = 0.012; for (let x = 0.25; x < w; x += 0.5) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0.25; y < h; y += 0.5) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } }
    if (pat === 'lines') { g.strokeStyle = o.ink || 'rgba(127,163,207,0.4)'; g.lineWidth = 0.014; for (let y = o.y0 || 0.9; y < h - 0.2; y += o.gap || 0.95) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } if (o.margin) { g.strokeStyle = 'rgba(244,140,122,0.5)'; g.beginPath(); g.moveTo(o.margin, 0); g.lineTo(o.margin, h); g.stroke(); } }
    if (pat === 'dots') { g.fillStyle = o.ink || 'rgba(255,255,255,0.7)'; for (let y = 0.3; y < h; y += 0.55) for (let x = 0.3 + ((y / 0.55) % 2) * 0.27; x < w; x += 0.55) { g.beginPath(); g.arc(x, y, 0.07, 0, 7); g.fill(); } }
    grain(g, w, h, 0.07); g.restore();
    // 纤维：撕口处几根细毛
    g.strokeStyle = 'rgba(255,251,242,0.9)'; g.lineWidth = 0.008; for (let i = 0; i < pts.length; i += 3) { const [x, y] = pts[i]; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 0.08, y + (rnd() - 0.5) * 0.08); g.stroke(); }
  }); },
  // 小票：锯齿上下边、等宽字、虚线分隔
  receipt(w, h, lines, total) { return sprite(w, h, (g) => {
    g.beginPath(); g.moveTo(0, 0.12); for (let x = 0; x <= w; x += 0.2) g.lineTo(x, (Math.round(x / 0.2) % 2) * 0.12); g.lineTo(w, h - 0.12); for (let x = w; x >= 0; x -= 0.2) g.lineTo(x, h - (Math.round(x / 0.2) % 2) * 0.12); g.closePath();
    g.fillStyle = '#FFFEFA'; g.fill(); g.save(); g.clip(); grain(g, w, h, 0.05); g.restore();
    print(g, lines[0], w / 2, 0.75, 0.34, P.ink, 'ChillRound', 'center');
    g.setLineDash([0.08, 0.06]); g.strokeStyle = 'rgba(90,59,46,0.45)'; g.lineWidth = 0.015; for (const y of [1.0, h - 1.15]) { g.beginPath(); g.moveTo(0.2, y); g.lineTo(w - 0.2, y); g.stroke(); } g.setLineDash([]);
    lines.slice(1).forEach(([a, b], i) => { print(g, a, 0.25, 1.45 + i * 0.42, 0.26, 'rgba(90,59,46,0.95)', 'ChillRound'); print(g, b, w - 0.25, 1.45 + i * 0.42, 0.26, 'rgba(90,59,46,0.95)', 'NunitoP', 'right'); });
    print(g, total[0], 0.25, h - 0.7, 0.28, P.ink, 'ChillRound'); print(g, total[1], w - 0.25, h - 0.7, 0.28, P.ink, 'NunitoP', 'right');
    g.fillStyle = 'rgba(90,59,46,0.7)'; for (let x = 0.3; x < w - 0.3; x += 0.07) if (rnd() > 0.35) g.fillRect(x, h - 0.48, 0.035, 0.22);   // 条形码
  }); },
  // 蕾丝纸垫：扇形外缘 + 镂空小孔 + 内圈压纹
  doily(r, color = P.white) { return sprite(2 * r, 2 * r, (g) => { const c = r; g.fillStyle = color; g.beginPath();
    const n = 28; for (let i = 0; i <= n * 8; i++) { const a = i / (n * 8) * Math.PI * 2; const rr2 = r * (0.93 + 0.07 * Math.abs(Math.sin(a * n / 2))); i ? g.lineTo(c + Math.cos(a) * rr2, c + Math.sin(a) * rr2) : g.moveTo(c + Math.cos(a) * rr2, c + Math.sin(a) * rr2); } g.fill();
    g.save(); g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * Math.PI * 2; g.beginPath(); g.arc(c + Math.cos(a) * r * 0.86, c + Math.sin(a) * r * 0.86, r * 0.035, 0, 7); g.fill(); }
    for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * Math.PI * 2; g.beginPath(); g.ellipse(c + Math.cos(a) * r * 0.74, c + Math.sin(a) * r * 0.74, r * 0.045, r * 0.018, a, 0, 7); g.fill(); }
    g.restore();
    g.strokeStyle = 'rgba(201,128,90,0.22)'; g.lineWidth = 0.015; for (const k2 of [0.66, 0.62]) { g.beginPath(); g.arc(c, c, r * k2, 0, 7); g.stroke(); }
    g.save(); g.beginPath(); g.arc(c, c, r * 0.95, 0, 7); g.clip(); grain(g, 2 * r, 2 * r, 0.05); g.restore();
  }); },
  // 小清单卡（方格纸，Koko 的待办）
  checklist(w, h, title, rows) { return sprite(w, h, (g) => { card(g, w, h, '#FFFDF6', 0.05);
    g.strokeStyle = 'rgba(127,163,207,0.28)'; g.lineWidth = 0.01; for (let x = 0.2; x < w; x += 0.4) { g.beginPath(); g.moveTo(x, 0.05); g.lineTo(x, h - 0.08); g.stroke(); } for (let y = 0.2; y < h; y += 0.4) { g.beginPath(); g.moveTo(0.05, y); g.lineTo(w - 0.05, y); g.stroke(); }
    g.fillStyle = P.coral; g.fillRect(0, 0, w - 0.02, 0.18);
    hand(g, title, 0.3, 0.78, 0.4, P.ink);
    rows.forEach(([t, done], i) => { const y = 1.45 + i * 0.66; g.strokeStyle = P.ink; g.lineWidth = 0.03; g.strokeRect(0.32, y - 0.32, 0.32, 0.32);
      if (done) inkStroke(g, [[0.36, y - 0.18], [0.47, y - 0.04], [0.74, y - 0.5]], 0.045, '#E0664F', { taper: false });
      hand(g, t, 0.85, y - 0.02, 0.36, done ? 'rgba(90,59,46,0.65)' : P.ink); if (done) doodle.underline(g, 0.82, 0.85 + t.length * 0.37, y - 0.14, 'rgba(224,102,79,0.7)', 0.025); });
  }); },
  map(w, h) { return sprite(w, h, (g) => { card(g, w, h, '#FBF3E4', 0.06); g.save(); g.globalAlpha = 0.9; g.fillStyle = P.snowPale; g.beginPath(); g.ellipse(w * 0.3, h * 0.35, w * 0.25, h * 0.2, 0.3, 0, 7); g.fill(); g.fillStyle = '#E3F0E2'; g.beginPath(); g.ellipse(w * 0.72, h * 0.68, w * 0.22, h * 0.18, -0.2, 0, 7); g.fill(); g.restore();
    doodle.dotted(g, [w * 0.15, h * 0.2], [w * 0.6, h * 0.1], [w * 0.2, h * 0.75], [w * 0.82, h * 0.8], P.coral, 0.04);
    for (const [x, y] of [[w * 0.15, h * 0.2], [w * 0.82, h * 0.8]]) { g.fillStyle = P.coral; g.beginPath(); g.arc(x, y, 0.13, 0, 7); g.fill(); }
    // 小河、松树、小房子（地图更耐看）
    g.strokeStyle = '#9CC3E6'; g.lineWidth = 0.16; g.beginPath(); g.moveTo(w * 0.02, h * 0.55); g.bezierCurveTo(w * 0.3, h * 0.45, w * 0.45, h * 0.7, w * 0.98, h * 0.42); g.stroke();
    g.strokeStyle = '#FFFFFF'; g.lineWidth = 0.04; g.setLineDash([0.12, 0.14]); g.stroke(); g.setLineDash([]);
    for (const [x, y, k] of [[0.48, 0.22, 1], [0.55, 0.28, 0.8], [0.9, 0.2, 0.9], [0.1, 0.85, 0.9], [0.38, 0.88, 1]]) { const X = w * x, Y = h * y, s = 0.32 * k; g.fillStyle = '#8FCFAF'; g.beginPath(); g.moveTo(X, Y - s); g.lineTo(X + s * 0.6, Y + s * 0.4); g.lineTo(X - s * 0.6, Y + s * 0.4); g.closePath(); g.fill(); g.fillStyle = '#FFFFFF'; g.beginPath(); g.moveTo(X, Y - s); g.lineTo(X + s * 0.22, Y - s * 0.6); g.lineTo(X - s * 0.22, Y - s * 0.6); g.closePath(); g.fill(); }
    { const X = w * 0.2, Y = h * 0.3; g.fillStyle = '#F6C7A8'; g.fillRect(X - 0.25, Y - 0.1, 0.5, 0.4); g.fillStyle = '#E0664F'; g.beginPath(); g.moveTo(X - 0.34, Y - 0.08); g.lineTo(X, Y - 0.4); g.lineTo(X + 0.34, Y - 0.08); g.closePath(); g.fill(); g.fillStyle = '#FFE7A8'; g.fillRect(X - 0.08, Y + 0.02, 0.16, 0.14); }
    doodle.snowflake(g, w * 0.36, h * 0.18, 0.2, P.snowDeep, 0.035); doodle.orange(g, w * 0.78, h * 0.62, 0.22);
    hand(g, '小窗', w * 0.06, h * 0.12, 0.3, P.ink); hand(g, '邮局', w * 0.66, h * 0.95, 0.3, P.ink); }); },
};
