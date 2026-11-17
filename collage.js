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

// ---------- Cloud series additions: new functions only; nothing above is changed ----------
// crayon stroke: 0.06-0.09 cm wide, broken grainy dabs over a faint base line
export const crayon = {
  line(g, pts, w = 0.075, color = '#67B0E2', o = {}) { const a0 = o.alpha ?? 0.92;
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = color; g.globalAlpha = a0 * 0.32; g.lineWidth = w * 0.7;
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    g.fillStyle = color;
    for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; const L = Math.hypot(x1 - x0, y1 - y0) || 1e-6; const n = Math.max(1, Math.ceil(L / 0.013)); const nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
      for (let j = 0; j < n; j++) { const t = j / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        for (let q = 0; q < 3; q++) { if (rnd() < 0.2) continue; const off = (rnd() - 0.5) * w * 0.8, r = w * (0.14 + rnd() * 0.2);
          g.globalAlpha = a0 * (0.4 + rnd() * 0.6); g.beginPath(); g.arc(x + nx * off, y + ny * off, r, 0, 7); g.fill(); } } }
    g.restore(); },
  cloud(g, x, y, s, color = '#67B0E2', w = 0.07) { const pts = []; // one-stroke little cloud
    const bumps = [[-0.55, 0.05, 0.3, Math.PI * 0.5, Math.PI * 1.5], [-0.18, -0.22, 0.4, Math.PI * 1.05, Math.PI * 1.85], [0.32, -0.14, 0.34, Math.PI * 1.25, Math.PI * 1.95], [0.62, 0.08, 0.24, Math.PI * 1.4, Math.PI * 2.5]];
    for (const [bx, by, br, a0, a1] of bumps) for (let i = 0; i <= 14; i++) { const a = a0 + (a1 - a0) * i / 14; pts.push([x + (bx + Math.cos(a) * br) * s, y + (by + Math.sin(a) * br) * s]); }
    pts.push([x - 0.55 * s, y + 0.35 * s]); crayon.line(g, pts, w, color); },
  underline(g, x0, x1, y, color = '#D86724', w = 0.075) { const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push([x0 + (x1 - x0) * t, y + Math.sin(t * 7 + 0.5) * 0.03 + t * 0.03]); } crayon.line(g, pts, w, color); },
  circle(g, x, y, rx, ry, rot = 0, color = '#C8582A', w = 0.07) { const pts = []; for (let i = 0; i <= 44; i++) { const t = i / 44 * Math.PI * 2.15 - 0.4, k2 = 1 + 0.06 * Math.sin(t * 3);
      pts.push([x + Math.cos(t) * rx * k2 * Math.cos(rot) - Math.sin(t) * ry * Math.sin(rot), y + Math.cos(t) * rx * k2 * Math.sin(rot) + Math.sin(t) * ry * Math.cos(rot)]); } crayon.line(g, pts, w, color); },
  wind(g, x, y, len, color = '#67B0E2', w = 0.065) { const pts = []; for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push([x + len * t, y + Math.sin(t * Math.PI * 1.2) * 0.12]); } // wind: a soft curve with a curl at the end
    const e = pts[pts.length - 1]; for (let i = 1; i <= 16; i++) { const a = i / 16 * Math.PI * 1.6; pts.push([e[0] + Math.sin(a) * 0.15, e[1] - 0.15 + Math.cos(a) * 0.15]); }
    crayon.line(g, pts, w, color); },
  bow(g, x, y, s, color = '#C8582A', w = 0.06) { crayon.line(g, [[x, y], [x - s, y - s * 0.55], [x - s, y + s * 0.55], [x, y], [x + s, y - s * 0.55], [x + s, y + s * 0.55], [x, y]], w, color); },
  sun(g, x, y, r, color = '#D86724', w = 0.07) { const pts = []; for (let i = 0; i <= 30; i++) { const a = i / 30 * Math.PI * 2.1; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); } crayon.line(g, pts, w, color);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + 0.3; crayon.line(g, [[x + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 1.35], [x + Math.cos(a) * r * 1.75, y + Math.sin(a) * r * 1.75]], w * 0.9, color); } },
};

Object.assign(item, {
  // grid sheet: straight-cut, 0.5 cm grid, punched hole at top-left (painted, not cut out, so outline detection is untouched)
  obsPaper(w, h, o = {}) { const col = o.color || '#E6F1FA', line = o.line || '#9CCBEB'; return sprite(w, h, (g) => {
    card(g, w, h, col, 0.04, { grain: 0.05 });
    g.save(); rr(g, 0, 0, w, h, 0.04); g.clip(); g.globalAlpha = o.lineAlpha ?? 0.5; g.strokeStyle = line; g.lineWidth = 0.014;
    for (let x = 0.5; x < w - 0.01; x += 0.5) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0.5; y < h - 0.01; y += 0.5) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.globalAlpha = 1; g.restore();
    if (o.header) { g.save(); g.strokeStyle = o.headerColor || '#549AD9'; g.globalAlpha = 0.55; g.lineWidth = 0.03; g.beginPath(); g.moveTo(1.2, 1.0); g.lineTo(w - 0.4, 1.0); g.stroke(); g.restore();
      print(g, o.header, w - 0.45, 0.82, 0.3, o.headerColor || '#549AD9', 'ChillRound', 'right'); }
    const hx = o.holeX ?? 0.6, hy = o.holeY ?? 0.6, hr = o.holeR ?? 0.2;
    g.fillStyle = o.under || P.paper; g.beginPath(); g.arc(hx, hy, hr, 0, 7); g.fill();
    g.strokeStyle = 'rgba(90,59,46,0.28)'; g.lineWidth = 0.03; g.beginPath(); g.arc(hx, hy, hr - 0.015, Math.PI * 0.95, Math.PI * 2.05); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 0.02; g.beginPath(); g.arc(hx, hy, hr + 0.012, Math.PI * 0.05, Math.PI * 0.95); g.stroke();
  }); },
  // diamond paper kite sticker: white die-cut border, four colour panels, spars, crayon hatching
  kite(w, h, cols = ['#67B0E2', '#E7DBCA', '#87BBDF', '#D86724']) { return sprite(w, h, (g) => {
    const cy = h * 0.37, T = [w / 2, 0.14], R = [w - 0.14, cy], B = [w / 2, h - 0.14], Lf = [0.14, cy], C = [w / 2, cy];
    const dia = (k) => { const p = (q) => [C[0] + (q[0] - C[0]) * k, C[1] + (q[1] - C[1]) * k]; g.beginPath(); g.moveTo(...p(T)); g.lineTo(...p(R)); g.lineTo(...p(B)); g.lineTo(...p(Lf)); g.closePath(); };
    g.fillStyle = P.white; g.strokeStyle = P.white; g.lineJoin = 'round'; g.lineWidth = 0.2; dia(1); g.fill(); g.stroke();
    const k = 0.9, p = (q) => [C[0] + (q[0] - C[0]) * k, C[1] + (q[1] - C[1]) * k];
    [[T, R], [R, B], [B, Lf], [Lf, T]].forEach(([a, b], i) => { g.save(); g.beginPath(); g.moveTo(...C); g.lineTo(...p(a)); g.lineTo(...p(b)); g.closePath(); g.fillStyle = cols[i]; g.fill(); g.clip();
      g.strokeStyle = 'rgba(255,253,248,0.32)'; g.lineWidth = 0.035; for (let x = -h; x < w + h; x += 0.16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h * 0.6, h); g.stroke(); }
      grain(g, w, h, 0.08); g.restore(); });
    { const X = w * 0.36, Y = cy * 0.62, s = 0.32; g.fillStyle = 'rgba(255,253,248,0.95)'; g.beginPath(); g.arc(X - s * 0.5, Y, s * 0.32, 0, 7); g.arc(X, Y - s * 0.2, s * 0.45, 0, 7); g.arc(X + s * 0.5, Y, s * 0.3, 0, 7); g.fill(); g.fillRect(X - s * 0.6, Y - 0.02, s * 1.2, s * 0.3); }
    g.strokeStyle = '#9A6A43'; g.lineWidth = 0.045; g.beginPath(); g.moveTo(...p(T)); g.lineTo(...p(B)); g.moveTo(...p(Lf)); g.lineTo(...p(R)); g.stroke();
    g.strokeStyle = 'rgba(255,236,205,0.75)'; g.lineWidth = 0.014; g.beginPath(); g.moveTo(p(T)[0] - 0.012, p(T)[1]); g.lineTo(p(B)[0] - 0.012, p(B)[1]); g.stroke();
    g.fillStyle = '#9A6A43'; g.beginPath(); g.arc(C[0], C[1], 0.07, 0, 7); g.fill();
  }); },
  // feather: curved shaft, barbs, two small splits, downy base
  feather(len, color = '#549AD9') { const w = len * 0.36; return sprite(w, len, (g) => {
    const top = 0.08, bot = len - 0.06, cx = w * 0.5;
    const S = (t) => [cx + Math.sin(t * Math.PI) * w * 0.07 - (t - 0.5) * w * 0.06, top + t * (bot - top)];
    const half = (t) => t > 0.8 ? 0 : w * 0.44 * Math.pow(Math.sin(Math.PI * Math.min(1, (t + 0.02) / 0.86)), 0.75);
    const edge = (t, s) => { const [x, y] = S(t); return [x + s * half(t), y - half(t) * 0.35]; };
    g.save(); g.beginPath(); g.moveTo(...S(0)); for (let i = 0; i <= 40; i++) g.lineTo(...edge(i / 40 * 0.8, 1)); for (let i = 40; i >= 0; i--) g.lineTo(...edge(i / 40 * 0.8, -1)); g.closePath();
    const gr = g.createLinearGradient(0, top, 0, bot); gr.addColorStop(0, '#2F6FB8'); gr.addColorStop(0.45, color); gr.addColorStop(0.85, '#A9CDEE'); g.fillStyle = gr; g.fill(); g.clip();
    for (let i = 0; i <= 70; i++) { const t = i / 70 * 0.8; const [x, y] = S(t); for (const s of [-1, 1]) { const [ex, ey] = edge(t, s);
      g.strokeStyle = i % 2 ? 'rgba(255,255,255,0.28)' : 'rgba(17,72,140,0.22)'; g.lineWidth = 0.01; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + ex) / 2, (y + ey) / 2 - 0.05, ex, ey); g.stroke(); } }
    grain(g, w, len, 0.06); g.restore();
    g.save(); g.globalCompositeOperation = 'destination-out'; for (const [t, s] of [[0.32, 1], [0.55, -1]]) { const [ex, ey] = edge(t, s); const [x, y] = S(t + 0.03); g.beginPath(); g.moveTo(ex + s * 0.03, ey - 0.02); g.lineTo(x + s * (ex - x) * 0.45, y - 0.02); g.lineTo(ex + s * 0.03, ey + 0.08); g.closePath(); g.fill(); } g.restore();
    g.strokeStyle = 'rgba(214,232,248,0.9)'; g.lineWidth = 0.008; for (let i = 0; i < 26; i++) { const t = 0.7 + rnd() * 0.12; const [x, y] = S(t); const s = rnd() < 0.5 ? -1 : 1; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + s * w * 0.12, y - 0.04, x + s * w * (0.16 + rnd() * 0.12), y + 0.02 + rnd() * 0.1); g.stroke(); }
    g.lineCap = 'round'; for (let i = 1; i <= 30; i++) { const t0 = (i - 1) / 30, t1 = i / 30; g.strokeStyle = '#F3EFE6'; g.lineWidth = 0.012 + 0.03 * t1; g.beginPath(); g.moveTo(...S(t0)); g.lineTo(...S(t1)); g.stroke(); }
  }); },
  // short crayon stub: worn tip + paper wrapper with stripes and a torn edge
  crayon(len, dia, color, o = {}) { return sprite(len, dia, (g) => { const r = dia / 2, tip = dia * 0.95, end = len - 0.04;
    g.save(); g.beginPath(); g.moveTo(0.05, r - r * 0.32); g.quadraticCurveTo(0.02, r, 0.05, r + r * 0.32); g.lineTo(tip, dia - 0.03); g.lineTo(end - r * 0.3, dia - 0.03); g.quadraticCurveTo(end, dia - 0.03, end, r); g.quadraticCurveTo(end, 0.03, end - r * 0.3, 0.03); g.lineTo(tip, 0.03); g.closePath();
    g.fillStyle = color; g.fill(); g.clip();
    const sh = g.createLinearGradient(0, 0, 0, dia); sh.addColorStop(0, 'rgba(255,255,255,0.38)'); sh.addColorStop(0.35, 'rgba(255,255,255,0.05)'); sh.addColorStop(1, 'rgba(60,40,30,0.22)'); g.fillStyle = sh; g.fillRect(0, 0, len, dia);
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 0.01; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(0.06, r + (i - 2.5) * 0.04); g.lineTo(tip * 0.9, r + (i - 2.5) * 0.065); g.stroke(); }
    const w0 = tip + 0.18, w1 = end - (o.torn ?? 0.22);
    g.beginPath(); g.moveTo(w0, 0); for (let i = 0; i <= 8; i++) g.lineTo(w0 + (i % 2 ? 0.04 : -0.02), dia * i / 8); g.lineTo(w1, dia); for (let i = 8; i >= 0; i--) g.lineTo(w1 + (i % 2 ? 0.05 : -0.03) + (rnd() - 0.5) * 0.03, dia * i / 8); g.closePath();
    g.fillStyle = o.wrap || '#FFFBF2'; g.fill();
    g.save(); g.clip(); g.fillStyle = color; g.globalAlpha = 0.85; g.fillRect(w0, 0, len, dia * 0.16); g.fillRect(w0, dia * 0.84, len, dia * 0.16); g.globalAlpha = 1;
    g.strokeStyle = color; g.lineWidth = 0.02; g.beginPath(); for (let x = w0 + 0.1; x < w1 - 0.05; x += 0.02) g.lineTo(x, r + Math.sin(x * 22) * dia * 0.12); g.stroke();
    g.fillStyle = sh; g.fillRect(0, 0, len, dia); grain(g, len, dia, 0.06); g.restore();
    g.restore();
  }); },
  // 云朵邮票：齿孔边 + 天空、白云、小鸟、草地
  cloudStamp(w, h, value = '8分') { return sprite(w, h, (g) => {
    g.fillStyle = P.white; g.fillRect(0, 0, w, h);
    g.save(); g.globalCompositeOperation = 'destination-out'; const s = 0.17; for (let x = s / 2; x < w; x += s) for (const y of [0, h]) { g.beginPath(); g.arc(x, y, 0.05, 0, 7); g.fill(); } for (let y = s / 2; y < h; y += s) for (const x of [0, w]) { g.beginPath(); g.arc(x, y, 0.05, 0, 7); g.fill(); } g.restore();
    const ix = 0.16, iy = 0.16, iw = w - 0.32, ih = h - 0.32;
    g.save(); rr(g, ix, iy, iw, ih, 0.04); g.clip();
    const sky = g.createLinearGradient(0, iy, 0, iy + ih); sky.addColorStop(0, '#67B0E2'); sky.addColorStop(1, '#C9E3F6'); g.fillStyle = sky; g.fillRect(ix, iy, iw, ih);
    g.strokeStyle = 'rgba(255,253,248,0.22)'; g.lineWidth = 0.02; for (let x = ix - ih; x < ix + iw; x += 0.08) { g.beginPath(); g.moveTo(x, iy); g.lineTo(x + ih * 0.5, iy + ih); g.stroke(); }
    g.fillStyle = '#FFFDF8'; const cX = ix + iw * 0.5, cY = iy + ih * 0.56, cs = iw * 0.5; g.beginPath(); g.arc(cX - cs * 0.45, cY, cs * 0.3, 0, 7); g.arc(cX, cY - cs * 0.22, cs * 0.42, 0, 7); g.arc(cX + cs * 0.48, cY, cs * 0.28, 0, 7); g.fill(); g.fillRect(cX - cs * 0.6, cY - 0.02, cs * 1.15, cs * 0.3);
    g.fillStyle = '#549AD9'; g.beginPath(); g.ellipse(ix + iw * 0.74, iy + ih * 0.3, 0.12, 0.08, -0.2, 0, 7); g.fill(); g.beginPath(); g.moveTo(ix + iw * 0.7, iy + ih * 0.29); g.lineTo(ix + iw * 0.6, iy + ih * 0.22); g.lineTo(ix + iw * 0.72, iy + ih * 0.33); g.fill();
    g.fillStyle = '#D86724'; g.beginPath(); g.moveTo(ix + iw * 0.84, iy + ih * 0.29); g.lineTo(ix + iw * 0.9, iy + ih * 0.31); g.lineTo(ix + iw * 0.84, iy + ih * 0.32); g.fill();
    g.fillStyle = '#A7B647'; g.beginPath(); g.moveTo(ix, iy + ih * 0.86); g.quadraticCurveTo(ix + iw * 0.5, iy + ih * 0.78, ix + iw, iy + ih * 0.88); g.lineTo(ix + iw, iy + ih); g.lineTo(ix, iy + ih); g.fill();
    grain(g, w, h, 0.07); g.restore();
    print(g, value, ix + 0.08, iy + 0.3, 0.22, '#11488C', 'ChillRound');
  }); },
  // 写字的纸胶带：可指定墨色与花纹
  inkTape(w, h, text, color, ink = P.ink, pattern = 'none', x0 = 0.35) { return sprite(w, h, (g) => { const t = item.washi(w, h, color, pattern, 0.85); g.drawImage(t.cv, 0, 0, w, h); hand(g, text, x0, h * 0.68, h * 0.5, ink); }); },
});

// ---------- Sea series additions (pages 23 / 24): new functions only; nothing above is changed ----------
// fine pen: even 0.03 cm line with a tiny wobble (the sea series' one main stroke)
export const pen = {
  line(g, pts, w = 0.03, color = '#4B3221', o = {}) { g.save(); g.strokeStyle = color; g.globalAlpha = o.alpha ?? 0.95; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x + (rnd() - 0.5) * w * 0.25, y + (rnd() - 0.5) * w * 0.25) : g.moveTo(x, y))); g.stroke(); g.restore(); },
  waves(g, x, y, len, color, w = 0.03, amp = 0.07, n = 4) { const pts = []; for (let i = 0; i <= 48; i++) { const t = i / 48; pts.push([x + len * t, y - Math.abs(Math.sin(t * Math.PI * n)) * amp]); } pen.line(g, pts, w, color); },
  gull(g, x, y, s, color, w = 0.03) { g.save(); g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - s, y - s * 0.1);
    g.quadraticCurveTo(x - s * 0.5, y - s * 0.62, x, y); g.quadraticCurveTo(x + s * 0.5, y - s * 0.62, x + s, y - s * 0.1); g.stroke(); g.restore(); },
  boat(g, x, y, s, color, sail, w = 0.03) { // tiny sailboat: hull + mast + two sails
    if (sail) { g.save(); g.fillStyle = sail; g.globalAlpha = 0.85; g.beginPath(); g.moveTo(x + s * 0.05, y - s * 1.1); g.lineTo(x + s * 0.62, y - s * 0.28); g.lineTo(x + s * 0.05, y - s * 0.28); g.closePath(); g.fill(); g.restore(); }
    pen.line(g, [[x - s * 0.7, y - s * 0.2], [x + s * 0.75, y - s * 0.2], [x + s * 0.5, y + s * 0.12], [x - s * 0.5, y + s * 0.12], [x - s * 0.7, y - s * 0.2]], w, color);
    pen.line(g, [[x, y - s * 0.2], [x, y - s * 1.2]], w, color); pen.line(g, [[x + s * 0.05, y - s * 1.1], [x + s * 0.62, y - s * 0.28], [x + s * 0.05, y - s * 0.28]], w, color);
    pen.line(g, [[x - s * 0.06, y - s * 0.95], [x - s * 0.5, y - s * 0.3], [x - s * 0.06, y - s * 0.3]], w, color); },
  sunset(g, x, y, r, color, w = 0.03) { const pts = []; for (let i = 0; i <= 24; i++) { const a = Math.PI + i / 24 * Math.PI; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); } pen.line(g, pts, w, color);
    for (let i = 0; i < 7; i++) { const a = Math.PI + (i + 0.5) / 7 * Math.PI; pen.line(g, [[x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3], [x + Math.cos(a) * r * 1.65, y + Math.sin(a) * r * 1.65]], w, color); }
    pen.line(g, [[x - r * 2.2, y], [x + r * 2.2, y]], w, color); },
  compass(g, x, y, r, color, accent, w = 0.025) { g.save(); g.fillStyle = accent; g.globalAlpha = 0.8; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * 0.22, y); g.lineTo(x - r * 0.22, y); g.closePath(); g.fill(); g.restore();
    pen.line(g, [[x, y - r], [x + r * 0.22, y], [x, y + r], [x - r * 0.22, y], [x, y - r]], w, color); pen.line(g, [[x - r, y], [x, y - r * 0.22], [x + r, y], [x, y + r * 0.22], [x - r, y]], w, color);
    const pts = []; for (let i = 0; i <= 32; i++) { const a = i / 32 * Math.PI * 2; pts.push([x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62]); } pen.line(g, pts, w * 0.8, color, { alpha: 0.7 }); },
};

Object.assign(item, {
  // airmail letter sheet: straight-cut thin paper, 0.35 cm diagonal stripe border (red / gold), faint writing lines
  airmailPaper(w, h, o = {}) { const col = o.color || '#F7EBDC', A = o.red || '#A0371B', B = o.gold || '#E9CBAB', bw = o.band ?? 0.35; return sprite(w, h, (g) => {
    card(g, w, h, col, 0.03, { grain: 0.05 });
    g.save(); g.beginPath(); g.rect(0, 0, w, h); g.rect(bw, bw, w - 2 * bw, h - 2 * bw); g.clip('evenodd');
    const st = 0.3; let i = 0; for (let x = -h; x < w + h; x += st, i++) { const c = i % 4; if (c === 1 || c === 3) continue; g.fillStyle = c === 0 ? A : B;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + st, 0); g.lineTo(x + st - h, h); g.lineTo(x - h, h); g.closePath(); g.fill(); }
    grain(g, w, h, 0.06); g.restore();
    g.strokeStyle = 'rgba(160,55,27,0.35)'; g.lineWidth = 0.012; g.strokeRect(bw + 0.06, bw + 0.06, w - 2 * bw - 0.12, h - 2 * bw - 0.12);
    if (o.lines !== false) { g.save(); g.strokeStyle = o.line || '#DFBD9E'; g.globalAlpha = 0.75; g.lineWidth = 0.014; const y0 = o.y0 ?? 1.5, gap = o.gap ?? 1.0, x0 = bw + (o.mx ?? 0.45);
      for (let y = y0; y < h - bw - 0.45; y += gap) { g.beginPath(); g.moveTo(x0, y); g.lineTo(w - bw - 0.45, y); g.stroke(); } g.restore(); }
  }); },
  // translucent curtain-gauze tape: fine woven threads, frayed short ends
  gauzeTape(w, h, color = '#DFBD9E', alpha = 0.6) { return sprite(w, h, (g) => {
    g.save(); g.globalAlpha = alpha; g.beginPath(); const n = Math.max(6, Math.round(w / 0.12)); g.moveTo(0, 0.06);
    for (let i = 0; i <= n; i++) g.lineTo((i / n) * w, (i % 2 ? 0.0 : 0.07) + (rnd() - 0.5) * 0.03);
    for (let i = n; i >= 0; i--) g.lineTo((i / n) * w, h - (i % 2 ? 0.0 : 0.07) + (rnd() - 0.5) * 0.03); g.closePath(); g.fillStyle = color; g.fill(); g.clip();
    g.globalAlpha = 1; g.strokeStyle = 'rgba(255,250,240,0.45)'; g.lineWidth = 0.012; for (let y = 0.05; y < h; y += 0.07) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.strokeStyle = 'rgba(150,105,70,0.16)'; for (let x = 0.04; x < w; x += 0.09) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.restore(); grain(g, w, h, 0.05);
  }); },
  // opened airmail envelope (flat, sits under the poster): open flap with gold lining, chevron border on the body
  seaEnvelope(w, h, o = {}) { const fl = h * 0.45, col = o.color || '#DFBD9E', A = o.red || '#A0371B', B = o.gold || '#E9CBAB'; return sprite(w, h + fl, (g) => {
    const y0 = fl;
    g.save(); g.beginPath(); g.moveTo(0.02, y0 + 0.02); g.lineTo(w * 0.5, 0.05); g.lineTo(w - 0.02, y0 + 0.02); g.closePath(); g.fillStyle = col; g.fill(); g.clip();
    g.fillStyle = B; g.beginPath(); g.moveTo(0.3, y0); g.lineTo(w * 0.5, 0.4); g.lineTo(w - 0.3, y0); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(169,116,72,0.35)'; g.lineWidth = 0.012; for (let x = -fl; x < w + fl; x += 0.16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + fl * 0.6, y0); g.stroke(); }
    grain(g, w, y0, 0.05); g.restore();
    g.fillStyle = col; g.fillRect(0, y0, w, h);
    const gr = g.createLinearGradient(0, y0, 0, y0 + 0.5); gr.addColorStop(0, 'rgba(120,70,40,0.25)'); gr.addColorStop(1, 'rgba(120,70,40,0)'); g.fillStyle = gr; g.fillRect(0, y0, w, 0.5);
    g.save(); g.beginPath(); g.rect(0, y0, w, h); g.rect(0.34, y0 + 0.34, w - 0.68, h - 0.68); g.clip('evenodd');
    const st = 0.3; let i = 0; for (let x = -h; x < w + h; x += st, i++) { const c = i % 4; if (c === 1 || c === 3) continue; g.fillStyle = c === 0 ? A : B;
      g.beginPath(); g.moveTo(x, y0); g.lineTo(x + st, y0); g.lineTo(x + st - h, y0 + h); g.lineTo(x - h, y0 + h); g.closePath(); g.fill(); } g.restore();
    g.strokeStyle = 'rgba(120,70,40,0.3)'; g.lineWidth = 0.02; g.beginPath(); g.moveTo(0.4, y0 + h - 0.4); g.lineTo(w * 0.5, y0 + h * 0.52); g.lineTo(w - 0.4, y0 + h - 0.4); g.stroke();
    grain(g, w, h + fl, 0.045);
  }); },
  // perforated stamp, sunset palette: 'gull' (sun, sea, gull) or 'boat' (sailboat)
  seaStamp(w, h, art = 'gull', value = '8分', o = {}) { const ink = o.ink || '#4B3221'; return sprite(w, h, (g) => {
    g.fillStyle = P.white; g.fillRect(0, 0, w, h);
    g.save(); g.globalCompositeOperation = 'destination-out'; const s = 0.17; for (let x = s / 2; x < w; x += s) for (const y of [0, h]) { g.beginPath(); g.arc(x, y, 0.05, 0, 7); g.fill(); } for (let y = s / 2; y < h; y += s) for (const x of [0, w]) { g.beginPath(); g.arc(x, y, 0.05, 0, 7); g.fill(); } g.restore();
    const ix = 0.16, iy = 0.16, iw = w - 0.32, ih = h - 0.32;
    g.save(); rr(g, ix, iy, iw, ih, 0.04); g.clip();
    const sky = g.createLinearGradient(0, iy, 0, iy + ih); sky.addColorStop(0, '#F3D9B8'); sky.addColorStop(0.55, '#E9CBAB'); sky.addColorStop(1, '#C99A6E'); g.fillStyle = sky; g.fillRect(ix, iy, iw, ih);
    const hz = iy + ih * 0.62;
    g.fillStyle = 'rgba(214,79,26,0.75)'; g.beginPath(); g.arc(ix + iw * (art === 'gull' ? 0.32 : 0.7), hz, iw * 0.2, Math.PI, 0); g.fill();
    g.fillStyle = '#A97448'; g.fillRect(ix, hz, iw, ih); g.strokeStyle = 'rgba(255,240,215,0.7)'; g.lineWidth = 0.02;
    for (let k = 0; k < 4; k++) { const y = hz + 0.1 + k * 0.12; g.beginPath(); g.moveTo(ix + 0.1 + k * 0.07, y); g.lineTo(ix + iw * (0.45 + k * 0.08), y); g.stroke(); }
    if (art === 'gull') { g.strokeStyle = '#40241B'; g.lineWidth = 0.045; g.lineCap = 'round'; const X = ix + iw * 0.62, Y = iy + ih * 0.3, S = iw * 0.24;
      g.beginPath(); g.moveTo(X - S, Y); g.quadraticCurveTo(X - S * 0.45, Y - S * 0.6, X, Y + S * 0.08); g.quadraticCurveTo(X + S * 0.45, Y - S * 0.6, X + S, Y); g.stroke();
      g.lineWidth = 0.03; g.beginPath(); g.moveTo(X - S * 1.6, Y + S * 0.9); g.quadraticCurveTo(X - S * 1.35, Y + S * 0.6, X - S * 1.1, Y + S * 0.92); g.quadraticCurveTo(X - S * 0.85, Y + S * 0.6, X - S * 0.6, Y + S * 0.9); g.stroke(); }
    if (art === 'boat') { const X = ix + iw * 0.42, Y = hz + 0.02, S = iw * 0.5;
      g.fillStyle = '#FFF8EE'; g.beginPath(); g.moveTo(X + S * 0.04, Y - S * 1.05); g.lineTo(X + S * 0.55, Y - S * 0.12); g.lineTo(X + S * 0.04, Y - S * 0.12); g.closePath(); g.fill();
      g.fillStyle = '#A0371B'; g.beginPath(); g.moveTo(X - S * 0.04, Y - S * 0.92); g.lineTo(X - S * 0.42, Y - S * 0.12); g.lineTo(X - S * 0.04, Y - S * 0.12); g.closePath(); g.fill();
      g.fillStyle = '#40241B'; g.beginPath(); g.moveTo(X - S * 0.6, Y - S * 0.06); g.lineTo(X + S * 0.66, Y - S * 0.06); g.lineTo(X + S * 0.45, Y + S * 0.16); g.lineTo(X - S * 0.42, Y + S * 0.16); g.closePath(); g.fill();
      g.fillRect(X - 0.012, Y - S * 1.1, 0.024, S * 1.05); }
    grain(g, w, h, 0.07); g.restore();
    print(g, value, ix + 0.08, iy + 0.3, 0.22, ink, 'ChillRound');
  }); },
  // warm-red sealing wax: irregular blob, pressed ring, embossed gull, glossy highlight
  waxSeal(r, color = '#A0371B') { const S2 = 2 * r * 1.18; return sprite(S2, S2, (g) => { const c = S2 / 2;
    g.beginPath(); for (let i = 0; i <= 72; i++) { const a = i / 72 * Math.PI * 2; const k = 1 + 0.07 * Math.sin(a * 5 + 0.4) + 0.05 * Math.sin(a * 9 + 1.3) + (i % 72 ? (rnd() - 0.5) * 0.03 : 0); const x = c + Math.cos(a) * r * k, y = c + Math.sin(a) * r * k; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath();
    const gr = g.createRadialGradient(c - r * 0.3, c - r * 0.35, r * 0.1, c, c, r * 1.15); gr.addColorStop(0, '#C9583A'); gr.addColorStop(0.55, color); gr.addColorStop(1, '#6E2412'); g.fillStyle = gr; g.fill();
    g.save(); g.clip(); grain(g, S2, S2, 0.05); g.restore();
    g.strokeStyle = 'rgba(70,20,8,0.55)'; g.lineWidth = r * 0.07; g.beginPath(); g.arc(c, c, r * 0.66, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(255,190,160,0.45)'; g.lineWidth = r * 0.035; g.beginPath(); g.arc(c - r * 0.015, c - r * 0.02, r * 0.7, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
    g.fillStyle = 'rgba(80,22,10,0.45)'; g.beginPath(); g.arc(c, c, r * 0.6, 0, 7); g.fill();
    const S = r * 0.34; g.strokeStyle = 'rgba(255,200,170,0.55)'; g.lineWidth = r * 0.07; g.lineCap = 'round'; g.beginPath(); g.moveTo(c - S, c - S * 0.05);
    g.quadraticCurveTo(c - S * 0.45, c - S * 0.65, c, c + S * 0.08); g.quadraticCurveTo(c + S * 0.45, c - S * 0.65, c + S, c - S * 0.05); g.stroke();
    g.strokeStyle = 'rgba(255,200,170,0.4)'; g.lineWidth = r * 0.045; g.beginPath(); for (let i = 0; i <= 20; i++) { const t = i / 20; const x = c - S * 1.05 + t * S * 2.1, y = c + S * 0.62 - Math.abs(Math.sin(t * Math.PI * 3)) * S * 0.18; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    g.fillStyle = 'rgba(255,235,220,0.55)'; g.beginPath(); g.ellipse(c - r * 0.42, c - r * 0.5, r * 0.18, r * 0.07, -0.6, 0, 7); g.fill();
  }); },
  // message-in-a-bottle scroll: rolled paper tube with a spiral end and a twine band
  bottleNote(w, h, o = {}) { const col = o.color || '#F7EBDC', band = o.band || '#A97448'; return sprite(w, h, (g) => { const r = h * 0.42, cy = h / 2;
    g.beginPath(); g.moveTo(r * 0.6, cy - r); g.lineTo(w - r * 0.5, cy - r); g.quadraticCurveTo(w, cy, w - r * 0.5, cy + r); g.lineTo(r * 0.6, cy + r); g.closePath(); g.fillStyle = col; g.fill();
    g.save(); g.clip(); const sh = g.createLinearGradient(0, cy - r, 0, cy + r); sh.addColorStop(0, 'rgba(255,255,255,0.5)'); sh.addColorStop(0.3, 'rgba(255,255,255,0)'); sh.addColorStop(0.75, 'rgba(120,80,50,0.12)'); sh.addColorStop(1, 'rgba(120,80,50,0.32)');
    g.fillStyle = sh; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(169,116,72,0.4)'; g.lineWidth = 0.012; for (let x = r + 0.3; x < w - 0.3; x += 0.32) { g.beginPath(); g.moveTo(x, cy - r); g.lineTo(x + 0.05, cy + r); g.stroke(); }
    grain(g, w, h, 0.06); g.restore();
    g.fillStyle = '#EFE0CB'; g.beginPath(); g.ellipse(r * 0.6, cy, r * 0.45, r, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(120,80,50,0.55)'; g.lineWidth = 0.014;
    g.beginPath(); for (let i = 0; i <= 60; i++) { const t = i / 60, a = t * Math.PI * 5.2, k = 0.08 + 0.92 * t; const x = r * 0.6 + Math.cos(a) * r * 0.42 * k, y = cy + Math.sin(a) * r * 0.95 * k; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    const bx = w * 0.56; g.fillStyle = band; g.fillRect(bx, cy - r - 0.01, 0.16, 2 * r + 0.02); g.strokeStyle = 'rgba(64,36,27,0.45)'; g.lineWidth = 0.01; for (let y = cy - r; y < cy + r; y += 0.05) { g.beginPath(); g.moveTo(bx, y); g.lineTo(bx + 0.16, y + 0.04); g.stroke(); }
  }); },
  // "airmail" label: warm-red rounded label, white keyline, printed text
  airLabel(w, h, text = '航空', sub = 'BY AIR MAIL', o = {}) { const col = o.color || '#A0371B'; return sprite(w, h, (g) => {
    card(g, w, h, col, 0.1, { grain: 0.06 }); g.strokeStyle = 'rgba(255,248,236,0.85)'; g.lineWidth = 0.025; rr(g, 0.1, 0.1, w - 0.2, h - 0.2, 0.07); g.stroke();
    print(g, text, 0.3, h * 0.68, h * 0.46, '#FFF8EC', 'ChillRound'); print(g, sub, w - 0.25, h * 0.64, h * 0.2, '#FFF8EC', 'NunitoP', 'right');
  }); },
  // feather with a configurable palette (same drawing as item.feather; used for the white-grey gull feather)
  featherTone(len, cols = ['#B9B4AC', '#E9E6E0', '#FBFAF7'], o = {}) { const w = len * 0.36, barbA = o.barbA || 'rgba(255,255,255,0.35)', barbB = o.barbB || 'rgba(64,36,27,0.14)', down = o.down || 'rgba(250,248,244,0.95)'; return sprite(w, len, (g) => {
    const top = 0.08, bot = len - 0.06, cx = w * 0.5;
    const S = (t) => [cx + Math.sin(t * Math.PI) * w * 0.07 - (t - 0.5) * w * 0.06, top + t * (bot - top)];
    const half = (t) => t > 0.8 ? 0 : w * 0.44 * Math.pow(Math.sin(Math.PI * Math.min(1, (t + 0.02) / 0.86)), 0.75);
    const edge = (t, s) => { const [x, y] = S(t); return [x + s * half(t), y - half(t) * 0.35]; };
    g.save(); g.beginPath(); g.moveTo(...S(0)); for (let i = 0; i <= 40; i++) g.lineTo(...edge(i / 40 * 0.8, 1)); for (let i = 40; i >= 0; i--) g.lineTo(...edge(i / 40 * 0.8, -1)); g.closePath();
    const gr = g.createLinearGradient(0, top, 0, bot); gr.addColorStop(0, cols[0]); gr.addColorStop(0.45, cols[1]); gr.addColorStop(0.85, cols[2]); g.fillStyle = gr; g.fill(); g.clip();
    for (let i = 0; i <= 70; i++) { const t = i / 70 * 0.8; const [x, y] = S(t); for (const s of [-1, 1]) { const [ex, ey] = edge(t, s);
      g.strokeStyle = i % 2 ? barbA : barbB; g.lineWidth = 0.01; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + ex) / 2, (y + ey) / 2 - 0.05, ex, ey); g.stroke(); } }
    grain(g, w, len, 0.06); g.restore();
    g.save(); g.globalCompositeOperation = 'destination-out'; for (const [t, s] of [[0.32, 1], [0.55, -1]]) { const [ex, ey] = edge(t, s); const [x, y] = S(t + 0.03); g.beginPath(); g.moveTo(ex + s * 0.03, ey - 0.02); g.lineTo(x + s * (ex - x) * 0.45, y - 0.02); g.lineTo(ex + s * 0.03, ey + 0.08); g.closePath(); g.fill(); } g.restore();
    g.strokeStyle = down; g.lineWidth = 0.008; for (let i = 0; i < 26; i++) { const t = 0.7 + rnd() * 0.12; const [x, y] = S(t); const s = rnd() < 0.5 ? -1 : 1; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + s * w * 0.12, y - 0.04, x + s * w * (0.16 + rnd() * 0.12), y + 0.02 + rnd() * 0.1); g.stroke(); }
    g.lineCap = 'round'; for (let i = 1; i <= 30; i++) { const t0 = (i - 1) / 30, t1 = i / 30; g.strokeStyle = o.shaft || '#F3EFE6'; g.lineWidth = 0.012 + 0.03 * t1; g.beginPath(); g.moveTo(...S(t0)); g.lineTo(...S(t1)); g.stroke(); }
  }); },
  // sunset glow on the page base: radial gold wash
  glow(g, x, y, r, color = '233,203,171', a = 0.12) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${color},${a})`); gr.addColorStop(1, `rgba(${color},0)`); g.save(); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); g.restore(); },
});

// ---------- Cream series additions (pages 27 / 28): new functions only; nothing above is changed ----------
const rgbaOf = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
// charcoal: 0.03-0.08 cm, uneven width, alpha 0.85, softly smudged ends (the cream series' one main stroke)
export const charcoal = {
  line(g, pts, w = 0.05, color = '#2F2A28', o = {}) { const a0 = o.alpha ?? 0.85, ph = rnd() * 6;
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    for (const p of [pts[0], pts[pts.length - 1]]) { const r = w * 2.4; const gr = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], r); gr.addColorStop(0, rgbaOf(color, 0.14 * a0)); gr.addColorStop(1, rgbaOf(color, 0)); g.fillStyle = gr; g.fillRect(p[0] - r, p[1] - r, 2 * r, 2 * r); }
    g.strokeStyle = color; let acc = 0;
    for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; const L = Math.hypot(x1 - x0, y1 - y0); acc += L;
      const k = 0.62 + 0.38 * Math.sin(acc * 3.1 + ph) * Math.sin(acc * 1.3 + ph * 0.5) + (rnd() - 0.5) * 0.12;
      g.globalAlpha = a0 * 0.78; g.lineWidth = w * (0.55 + 0.9 * Math.max(0, Math.min(1.1, k))); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
    g.fillStyle = color;
    for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; const L = Math.hypot(x1 - x0, y1 - y0) || 1e-6; const n = Math.max(1, Math.ceil(L / 0.014)); const nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
      for (let j = 0; j < n; j++) { if (rnd() < 0.45) continue; const t = j / n, off = (rnd() - 0.5) * w * 1.1, r = w * (0.08 + rnd() * 0.2);
        g.globalAlpha = a0 * (0.25 + rnd() * 0.5); g.beginPath(); g.arc(x0 + (x1 - x0) * t + nx * off, y0 + (y1 - y0) * t + ny * off, r, 0, 7); g.fill(); } }
    g.restore(); },
  curve(g, p0, p1, p2, p3, w, color, o) { charcoal.line(g, bez(p0, p1, p2, p3, 40), w, color, o); },
  ring(g, x, y, rx, ry, w, color, o = {}) { const pts = [], a0 = o.start ?? -0.3, turn = o.turn ?? 2.1; for (let i = 0; i <= 48; i++) { const t = a0 + i / 48 * Math.PI * turn, k = 1 + 0.05 * Math.sin(t * 3 + 1); pts.push([x + Math.cos(t) * rx * k, y + Math.sin(t) * ry * k]); } charcoal.line(g, pts, w, color, o); },
  cloud(g, x, y, s, color = '#2F2A28', w = 0.04) { const pts = []; const bumps = [[-0.62, 0.12, 0.26, 0.55, 1.6], [-0.3, -0.18, 0.34, 1.05, 1.95], [0.15, -0.26, 0.36, 1.15, 1.95], [0.55, -0.02, 0.28, 1.35, 2.45], [0.2, 0.28, 0.24, 0.1, 0.95], [-0.25, 0.3, 0.24, 0.1, 0.95]];
    for (const [bx, by, br, a0, a1] of bumps) for (let i = 0; i <= 12; i++) { const a = Math.PI * (a0 + (a1 - a0) * i / 12); pts.push([x + (bx + Math.cos(a) * br) * s, y + (by + Math.sin(a) * br) * s]); }
    pts.push(pts[0]); charcoal.line(g, pts, w, color); },
  swirl(g, x, y, r, color = '#2F2A28', w = 0.04) { const pts = []; for (let i = 0; i <= 50; i++) { const t = i / 50, a = t * Math.PI * 3.2; pts.push([x + Math.cos(a) * r * t, y + Math.sin(a) * r * t]); } const e = pts[pts.length - 1]; pts.push([e[0] + r * 0.5, e[1] + r * 0.35]); charcoal.line(g, pts, w, color); },
  hatch(g, x, y, w, h, color = '#2F2A28', lw = 0.025, gap = 0.09, o = {}) { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); for (let s = -h; s < w; s += gap) charcoal.line(g, [[x + s, y + h], [x + s + h * 0.8, y]], lw * (0.7 + rnd() * 0.6), color, { alpha: o.alpha ?? 0.45 }); g.restore(); },
  // eraser marks: soft cream horizontal rubs, alpha 0.25
  erase(g, x, y, w, h, color = '#FFF8EA') { g.save(); g.strokeStyle = color; g.lineCap = 'round'; for (let i = 0; i < 4; i++) { g.globalAlpha = 0.25; g.lineWidth = h * (0.3 + rnd() * 0.25); const yy = y + h * (0.2 + i * 0.2) + (rnd() - 0.5) * h * 0.1;
    g.beginPath(); g.moveTo(x + rnd() * w * 0.15, yy); g.quadraticCurveTo(x + w * 0.5, yy + (rnd() - 0.5) * h * 0.3, x + w * (0.85 + rnd() * 0.15), yy + (rnd() - 0.5) * h * 0.2); g.stroke(); } g.restore(); },
};

Object.assign(item, {
  // sewing button: domed disc, rim groove, 2 or 4 holes, optional thread cross
  button(r, color, o = {}) { const holes = o.holes ?? 4, pad = 0.03; return sprite(2 * r + 2 * pad, 2 * r + 2 * pad, (g) => { const c = r + pad;
    g.fillStyle = color; g.beginPath(); g.arc(c, c, r, 0, 7); g.fill();
    g.save(); g.beginPath(); g.arc(c, c, r, 0, 7); g.clip();
    const gr = g.createRadialGradient(c - r * 0.35, c - r * 0.4, r * 0.05, c, c, r * 1.05); gr.addColorStop(0, 'rgba(255,255,255,0.32)'); gr.addColorStop(0.55, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(40,25,15,0.28)'); g.fillStyle = gr; g.fillRect(0, 0, 2 * c, 2 * c);
    g.fillStyle = 'rgba(40,25,15,0.1)'; g.beginPath(); g.arc(c, c, r * 0.7, 0, 7); g.fill();
    g.strokeStyle = 'rgba(40,25,15,0.32)'; g.lineWidth = r * 0.07; g.beginPath(); g.arc(c, c, r * 0.73, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = r * 0.045; g.beginPath(); g.arc(c - r * 0.02, c - r * 0.02, r * 0.79, Math.PI * 0.95, Math.PI * 1.6); g.stroke();
    grain(g, 2 * c, 2 * c, 0.06); g.restore();
    const d = r * 0.21, hp = holes === 2 ? [[-d, 0], [d, 0]] : [[-d, -d], [d, -d], [d, d], [-d, d]];
    if (o.thread) { g.strokeStyle = o.thread; g.lineWidth = r * 0.09; g.lineCap = 'round'; g.beginPath(); if (holes === 2) { g.moveTo(c - d, c); g.lineTo(c + d, c); } else { g.moveTo(c - d, c - d); g.lineTo(c + d, c + d); g.moveTo(c + d, c - d); g.lineTo(c - d, c + d); } g.stroke(); }
    for (const [hx, hy] of hp) { g.fillStyle = 'rgba(35,22,14,0.72)'; g.beginPath(); g.arc(c + hx, c + hy, r * 0.105, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = r * 0.03; g.beginPath(); g.arc(c + hx, c + hy, r * 0.12, Math.PI * 0.1, Math.PI * 0.9); g.stroke(); }
    if (o.thread) { g.strokeStyle = o.thread; g.lineWidth = r * 0.09; g.globalAlpha = 0.9; g.beginPath(); if (holes === 2) { g.moveTo(c - d * 0.6, c); g.lineTo(c + d * 0.6, c); } else { g.moveTo(c - d * 0.55, c - d * 0.55); g.lineTo(c + d * 0.55, c + d * 0.55); g.moveTo(c + d * 0.55, c - d * 0.55); g.lineTo(c - d * 0.55, c + d * 0.55); } g.stroke(); g.globalAlpha = 1; }
  }); },
  // thin wooden peg rail: wood strip with grain, end screws, round pegs
  pegRail(w, h, pegs = [], color = '#DBA773') { return sprite(w, h, (g) => {
    g.fillStyle = color; rr(g, 0, 0, w, h, h * 0.22); g.fill(); g.save(); rr(g, 0, 0, w, h, h * 0.22); g.clip();
    g.strokeStyle = 'rgba(140,90,50,0.32)'; g.lineWidth = 0.014; for (let i = 0; i < 6; i++) { const y0 = h * (0.12 + i * 0.15); g.beginPath(); for (let x = 0; x <= w; x += 0.1) g.lineTo(x, y0 + Math.sin(x * 1.3 + i * 1.7) * 0.03 + Math.sin(x * 4.1 + i) * 0.01); g.stroke(); }
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,245,225,0.35)'); gr.addColorStop(0.4, 'rgba(255,245,225,0)'); gr.addColorStop(1, 'rgba(110,70,35,0.25)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    grain(g, w, h, 0.08); g.restore();
    for (const sx of [0.32, w - 0.32]) { g.fillStyle = '#8F8A84'; g.beginPath(); g.arc(sx, h / 2, 0.09, 0, 7); g.fill(); g.strokeStyle = 'rgba(40,35,30,0.7)'; g.lineWidth = 0.02; g.beginPath(); g.moveTo(sx - 0.06, h / 2 - 0.03); g.lineTo(sx + 0.06, h / 2 + 0.03); g.stroke(); }
    for (const px of pegs) { const pr = h * 0.33;
      g.fillStyle = 'rgba(80,50,25,0.3)'; g.beginPath(); g.ellipse(px + pr * 0.18, h / 2 + pr * 0.22, pr * 1.02, pr * 0.98, 0, 0, 7); g.fill();
      const pg = g.createRadialGradient(px - pr * 0.35, h / 2 - pr * 0.4, pr * 0.1, px, h / 2, pr); pg.addColorStop(0, '#EDC392'); pg.addColorStop(1, '#B9814D'); g.fillStyle = pg; g.beginPath(); g.arc(px, h / 2, pr, 0, 7); g.fill();
      g.strokeStyle = 'rgba(110,70,35,0.35)'; g.lineWidth = 0.012; g.beginPath(); g.arc(px, h / 2, pr * 0.55, 0, 7); g.stroke(); }
  }); },
  // coarse sketch paper: torn sheet with extra tooth grain
  roughSheet(w, h, color = '#F6EAD0', o = {}) { const t = item.torn(w, h, color, { edges: o.edges || 'tblr' }); return sprite(w, h, (g) => {
    g.drawImage(t.cv, 0, 0, w, h);
    const lay = sprite(w, h, (q) => { grain(q, w, h, 1); q.globalCompositeOperation = 'destination-in'; q.drawImage(t.cv, 0, 0, w, h); });
    g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = Math.max(0, (o.grain ?? 0.14) - 0.07); g.drawImage(lay.cv, 0, 0, w, h); g.restore();
  }); },
  // colour swatch strip: cream card with brushy paint chips and numbers
  swatchStrip(w, h, cols, o = {}) { const ink = o.ink || '#2F2A28'; return sprite(w, h, (g) => {
    card(g, w, h, '#FFFBF2', 0.05, { grain: 0.06 }); const n = cols.length, top = 0.55, ch = (h - top - 0.2) / n;
    print(g, o.title || '色卡', w / 2, 0.4, 0.26, ink, 'ChillRound', 'center');
    cols.forEach((c, i) => { const y = top + i * ch + 0.06, x = 0.18, sw = w - 0.62, sh = ch - 0.14;
      g.fillStyle = c; g.beginPath(); g.moveTo(x, y + 0.03); for (let k = 0; k <= 8; k++) g.lineTo(x + sw * k / 8, y + (rnd() - 0.5) * 0.04); for (let k = 0; k <= 6; k++) g.lineTo(x + sw + (rnd() - 0.3) * 0.05, y + sh * k / 6); for (let k = 8; k >= 0; k--) g.lineTo(x + sw * k / 8, y + sh + (rnd() - 0.5) * 0.04); g.closePath(); g.fill();
      g.save(); g.clip(); g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 0.03; for (let k = 0; k < 5; k++) { const yy = y + rnd() * sh; g.beginPath(); g.moveTo(x, yy); g.lineTo(x + sw, yy + (rnd() - 0.5) * 0.06); g.stroke(); } grain(g, w, h, 0.08); g.restore();
      print(g, String(i + 1), w - 0.2, y + sh * 0.68, 0.24, ink, 'NunitoP', 'right'); });
  }); },
  // white eraser with a printed paper sleeve and a worn, smudged end
  eraser(w, h, o = {}) { const sleeve = o.sleeve || '#EA7824'; return sprite(w, h, (g) => {
    g.fillStyle = '#F6F2EA'; g.beginPath(); g.moveTo(0.28, 0); g.lineTo(w - 0.1, 0); g.quadraticCurveTo(w, 0, w, 0.1); g.lineTo(w, h - 0.1); g.quadraticCurveTo(w, h, w - 0.1, h); g.lineTo(0.28, h); g.quadraticCurveTo(0, h, 0.02, h * 0.5); g.quadraticCurveTo(0, 0, 0.28, 0); g.closePath(); g.fill();
    g.save(); g.clip(); const sm = g.createLinearGradient(0, 0, 0.7, 0); sm.addColorStop(0, 'rgba(70,62,58,0.3)'); sm.addColorStop(1, 'rgba(70,62,58,0)'); g.fillStyle = sm; g.fillRect(0, 0, 0.7, h);
    const sh = g.createLinearGradient(0, 0, 0, h); sh.addColorStop(0, 'rgba(255,255,255,0.4)'); sh.addColorStop(1, 'rgba(90,80,70,0.18)'); g.fillStyle = sh; g.fillRect(0, 0, w, h); grain(g, w, h, 0.05);
    const s0 = w * 0.36; g.fillStyle = sleeve; g.fillRect(s0, 0, w - s0 - 0.06, h); g.fillStyle = '#F4E4C1'; g.fillRect(s0, h * 0.62, w - s0 - 0.06, h * 0.14);
    g.strokeStyle = 'rgba(90,40,10,0.35)'; g.lineWidth = 0.015; g.beginPath(); g.moveTo(s0, 0); g.lineTo(s0, h); g.stroke(); grain(g, w, h, 0.06); g.restore();
    print(g, 'KOKO', s0 + 0.18, h * 0.48, h * 0.26, '#FFF8EC', 'NunitoP'); print(g, 'soft', w - 0.2, h * 0.92, h * 0.14, 'rgba(47,42,40,0.8)', 'NunitoP', 'right');
  }); },
  // eraser crumbs: a few rolled grey-white bits (soft patch)
  crumbs(w, h, n = 7) { return sprite(w, h, (g) => { for (let i = 0; i < n; i++) { const x = 0.15 + rnd() * (w - 0.3), y = 0.1 + rnd() * (h - 0.2), L = 0.1 + rnd() * 0.2, T = 0.045 + rnd() * 0.04, a = rnd() * Math.PI;
    g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = '#EEE7DA'; g.beginPath(); g.ellipse(0, 0, L / 2, T / 2, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(70,62,58,0.4)'; g.lineWidth = 0.012; g.beginPath(); g.moveTo(-L * 0.35, T * 0.1); g.quadraticCurveTo(0, -T * 0.3, L * 0.35, T * 0.12); g.stroke(); g.restore(); } }); },
  // charcoal stick: matte black, broken ends, faint sheen
  charcoalStick(len, dia) { return sprite(len, dia, (g) => { const pts = [];
    for (let i = 0; i <= 10; i++) pts.push([0.08 + (len - 0.16) * i / 10, 0.04 + (rnd() - 0.5) * 0.03]); pts.push([len - 0.03, dia * 0.35]); pts.push([len - 0.1, dia * 0.7]); pts.push([len - 0.05, dia - 0.04]);
    for (let i = 10; i >= 0; i--) pts.push([0.08 + (len - 0.16) * i / 10, dia - 0.04 + (rnd() - 0.5) * 0.03]); pts.push([0.0, dia * 0.6]); pts.push([0.06, dia * 0.3]);
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = '#2B2725'; g.fill(); g.save(); g.clip();
    const sh = g.createLinearGradient(0, 0, 0, dia); sh.addColorStop(0, 'rgba(255,255,255,0.05)'); sh.addColorStop(0.3, 'rgba(255,255,255,0.16)'); sh.addColorStop(0.55, 'rgba(255,255,255,0.02)'); sh.addColorStop(1, 'rgba(0,0,0,0.25)'); g.fillStyle = sh; g.fillRect(0, 0, len, dia);
    grain(g, len, dia, 0.18); g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 0.01; for (let i = 0; i < 5; i++) { const y = dia * (0.2 + rnd() * 0.6); g.beginPath(); g.moveTo(0.1, y); g.lineTo(len - 0.1, y + (rnd() - 0.5) * 0.05); g.stroke(); } g.restore(); }); },
  // binder clip (front view): black body + two silver wire handles
  binderClip(w, h) { return sprite(w, h, (g) => { const bt = h * 0.46;
    for (const [inset, col, lw] of [[0.3, '#9EA3A8', 0.075], [0.3, '#D5D9DD', 0.04], [0.42, '#9EA3A8', 0.06], [0.42, '#DDE1E4', 0.03]]) { g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); g.moveTo(inset, bt + 0.1); g.lineTo(inset, 0.3); g.quadraticCurveTo(inset, 0.06, inset + 0.24, 0.06); g.lineTo(w - inset - 0.24, 0.06); g.quadraticCurveTo(w - inset, 0.06, w - inset, 0.3); g.lineTo(w - inset, bt + 0.1); g.stroke(); }
    g.fillStyle = '#2C2C30'; g.beginPath(); g.moveTo(0.14, bt + 0.12); g.lineTo(w - 0.14, bt + 0.12); g.lineTo(w - 0.04, h - 0.04); g.lineTo(0.04, h - 0.04); g.closePath(); g.fill();
    g.save(); g.clip(); const gr = g.createLinearGradient(0, bt, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.28)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.04)'); gr.addColorStop(1, 'rgba(0,0,0,0.2)'); g.fillStyle = gr; g.fillRect(0, bt, w, h - bt); grain(g, w, h, 0.05); g.restore();
    g.fillStyle = '#9EA3A8'; for (const x of [0.3, w - 0.3]) { g.beginPath(); g.arc(x, bt + 0.2, 0.06, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.02; g.beginPath(); g.moveTo(0.18, bt + 0.16); g.lineTo(w - 0.18, bt + 0.16); g.stroke(); }); },
  // round rubber stamp with configurable words and colour
  inkStamp(top, main, bottom = 'KOKO', color = 'rgba(220,104,51,0.85)') { return sprite(2.0, 2.0, (g) => { const c = 1.0; g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 0.06; g.beginPath(); g.arc(c, c, 0.9, 0, 7); g.stroke(); g.lineWidth = 0.025; g.beginPath(); g.arc(c, c, 0.76, 0, 7); g.stroke();
    g.font = '0.4px NunitoP'; g.textAlign = 'center'; g.fillText(main, c, c + 0.15); g.font = '0.24px ChillRound'; g.fillText(top, c, c - 0.35); g.font = '0.22px NunitoP'; g.fillText(bottom, c, c + 0.55);
    g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 160; i++) { g.beginPath(); g.arc(rnd() * 2, rnd() * 2, 0.012 + rnd() * 0.035, 0, 7); g.fill(); } }); },
  // wooden / kraft drawing board: rounded corners, long fibres, bevel and a painted hang hole
  board(w, h, color = '#DBA773', o = {}) { return sprite(w, h, (g) => {
    card(g, w, h, color, 0.22, { grain: 0.12 }); g.save(); rr(g, 0, 0, w, h, 0.22); g.clip();
    g.strokeStyle = 'rgba(140,90,50,0.16)'; g.lineWidth = 0.02; for (let i = 0; i < 28; i++) { const x0 = rnd() * w; g.beginPath(); for (let y = 0; y <= h; y += 0.2) g.lineTo(x0 + Math.sin(y * 0.7 + i) * 0.12, y); g.stroke(); }
    g.strokeStyle = 'rgba(110,70,35,0.35)'; g.lineWidth = 0.035; rr(g, 0.08, 0.08, w - 0.16, h - 0.16, 0.16); g.stroke(); g.restore();
    if (o.hole) { const [hx, hy] = o.hole; g.fillStyle = 'rgba(70,45,25,0.55)'; rr(g, hx - 0.45, hy - 0.12, 0.9, 0.24, 0.12); g.fill(); g.strokeStyle = 'rgba(255,240,215,0.4)'; g.lineWidth = 0.015; g.beginPath(); g.moveTo(hx - 0.4, hy + 0.13); g.lineTo(hx + 0.4, hy + 0.13); g.stroke(); }
  }); },
});

// ---------- Starry spread: fine coloured pencil (45 deg hatching, 0.02-0.03 cm, two colours may overlap) ----------
const starPts = (x, y, r, rot = 0, k = 0.45) => { const pts = []; for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + rot + i * Math.PI / 5, rr2 = i % 2 ? r * k : r; pts.push([x + Math.cos(a) * rr2, y + Math.sin(a) * rr2]); } return pts; };
const polyPath = (g, pts) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
export const pencil = {
  // grainy pencil line: thin core plus broken tooth specks
  line(g, pts, w = 0.025, color = '#7B4C2D', o = {}) { const a0 = o.alpha ?? 0.85; g.save(); g.strokeStyle = color; g.fillStyle = color; g.lineCap = 'round'; g.lineJoin = 'round';
    g.globalAlpha = a0 * 0.8; g.lineWidth = w * 0.8; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
    const bk = [new Path2D(), new Path2D(), new Path2D()]; // specks batched in three alpha buckets
    for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; const L = Math.hypot(x1 - x0, y1 - y0) || 1e-6, n = Math.max(1, Math.ceil(L / (o.step ?? 0.014)));
      for (let j = 0; j < n; j++) { if (rnd() < 0.45) continue; const t = j / n, p = bk[Math.floor(rnd() * 3)], sx = x0 + (x1 - x0) * t + (rnd() - 0.5) * w * 0.7, sy = y0 + (y1 - y0) * t + (rnd() - 0.5) * w * 0.7, sr = w * (0.16 + rnd() * 0.2); p.moveTo(sx + sr, sy); p.arc(sx, sy, sr, 0, 7); } }
    bk.forEach((p, k) => { g.globalAlpha = a0 * (0.3 + k * 0.2); g.fill(p); });
    g.restore(); },
  curve(g, p0, p1, p2, p3, w, color, o) { pencil.line(g, bez(p0, p1, p2, p3, 40), w, color, o); },
  // 45 deg hatching inside clip(g); box = [x, y, w, h] covering the shape
  hatch(g, clip, box, color, o = {}) { const [x, y, w, h] = box, gap = o.gap ?? 0.07, lw = o.w ?? 0.022, a = (o.angle ?? 45) * Math.PI / 180;
    g.save(); clip(g); g.clip(); const d = Math.hypot(w, h), cx = x + w / 2, cy = y + h / 2, ux = Math.cos(a), uy = -Math.sin(a), vx = -uy, vy = ux;
    for (let s = -d / 2 + (o.offset ?? 0); s <= d / 2; s += gap) { const px = cx + vx * s, py = cy + vy * s, ax = px - ux * d / 2, ay = py - uy * d / 2, dx = ux * d, dy = uy * d;
      let t0 = 0, t1 = 1; for (const [p, q] of [[-dx, ax - x], [dx, x + w - ax], [-dy, ay - y], [dy, y + h - ay]]) { if (Math.abs(p) < 1e-9) { if (q < 0) t1 = -1; continue; } const r = q / p; if (p < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r); }
      if (t1 <= t0) continue; pencil.line(g, [[ax + dx * t0, ay + dy * t0], [ax + dx * t1, ay + dy * t1]], lw * (0.8 + rnd() * 0.4), color, { alpha: o.alpha ?? 0.8, step: o.step ?? 0.03 }); }
    g.restore(); },
  // five-point star: outline plus up to two hatch colours
  star(g, x, y, r, color = '#7B4C2D', fills = [], o = {}) { const pts = starPts(x, y, r, o.rot ?? 0), box = [x - r, y - r, 2 * r, 2 * r];
    fills.forEach((c, i) => pencil.hatch(g, (q) => polyPath(q, pts), box, c, { gap: i ? 0.08 : 0.055, offset: i * 0.03, alpha: i ? 0.75 : 0.95 }));
    pencil.line(g, pts, o.w ?? 0.028, color, { alpha: o.alpha ?? 0.85 }); },
  // wobbly round outline plus hatch fills
  round(g, x, y, r, color = '#7B4C2D', fills = [], o = {}) { const pts = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2.08 - 0.3, k = 1 + 0.04 * Math.sin(a * 3 + 1); pts.push([x + Math.cos(a) * r * k, y + Math.sin(a) * (o.ry ?? r) * k]); }
    fills.forEach((c, i) => pencil.hatch(g, (q) => { q.beginPath(); q.ellipse(x, y, r, o.ry ?? r, 0, 0, 7); }, [x - r, y - r, 2 * r, 2 * r], c, { gap: i ? 0.08 : 0.055, offset: i * 0.03, alpha: i ? 0.75 : 0.95 }));
    pencil.line(g, pts, o.w ?? 0.028, color, { alpha: o.alpha ?? 0.85 }); },
  // dotted constellation line through pts; trim keeps a gap at both ends
  dots(g, pts, color = '#7B4C2D', o = {}) { const step = o.step ?? 0.2, r = o.r ?? 0.026, trim = o.trim ?? 0.0; g.save(); g.fillStyle = color;
    for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; const L = Math.hypot(x1 - x0, y1 - y0), n = Math.floor((L - 2 * trim) / step);
      for (let j = 0; j <= n; j++) { const t = (trim + j * step) / L; g.globalAlpha = (o.alpha ?? 0.8) * (0.7 + rnd() * 0.3); g.beginPath(); g.arc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r * (0.8 + rnd() * 0.4), 0, 7); g.fill(); } }
    g.restore(); },
  // tiny four-ray sparkle
  twinkle(g, x, y, s, color = '#7B4C2D', w = 0.024) { pencil.line(g, [[x - s, y], [x + s, y]], w, color); pencil.line(g, [[x, y - s], [x, y + s]], w, color); },
};

Object.assign(doodle, {
  // coin rubbing: light 45 deg pencil over the disc; the rim, beads, numeral and leaves pick up darker
  rubbing(g, x, y, r, color = '#7B4C2D') { const box = [x - r, y - r, 2 * r, 2 * r];
    pencil.hatch(g, (q) => { q.beginPath(); q.arc(x, y, r, 0, 7); }, box, color, { gap: 0.045, w: 0.02, alpha: 0.3 });
    pencil.hatch(g, (q) => { q.beginPath(); q.arc(x, y, r, 0, 7); q.arc(x, y, r * 0.85, 0, 7, true); }, box, color, { gap: 0.028, w: 0.022, alpha: 0.75 });
    g.save(); g.fillStyle = color; for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2; g.globalAlpha = 0.45 + rnd() * 0.3; g.beginPath(); g.arc(x + Math.cos(a) * r * 0.76, y + Math.sin(a) * r * 0.76, r * 0.03, 0, 7); g.fill(); } g.restore();
    const s = r * 0.5; const one = [[x - s * 0.35, y - s * 0.55], [x + s * 0.1, y - s * 0.95], [x + s * 0.3, y - s * 0.95], [x + s * 0.3, y + s * 0.55], [x + s * 0.55, y + s * 0.55], [x + s * 0.55, y + s * 0.8], [x - s * 0.45, y + s * 0.8], [x - s * 0.45, y + s * 0.55], [x - s * 0.15, y + s * 0.55], [x - s * 0.15, y - s * 0.45]];
    pencil.hatch(g, (q) => polyPath(q, one), box, color, { gap: 0.026, w: 0.022, alpha: 0.8 });
    for (const sx of [-1, 1]) pencil.hatch(g, (q) => { q.beginPath(); q.ellipse(x + sx * r * 0.5, y + r * 0.42, r * 0.17, r * 0.08, sx * 0.7, 0, 7); }, box, color, { gap: 0.026, w: 0.02, alpha: 0.7 }); },
});

Object.assign(item, {
  // fine-tooth coloured-pencil paper: stronger grain plus little light tooth specks
  pencilPaper(w, h, color = '#FBEBD2', o = {}) { return sprite(w, h, (g) => { card(g, w, h, color, 0.03, { grain: o.grain ?? 0.12 });
    g.save(); rr(g, 0, 0, w - 0.02, h - 0.03, 0.03); g.clip(); g.fillStyle = 'rgba(255,255,255,0.5)'; const n = Math.round(w * h * 120), bk = [new Path2D(), new Path2D()];
    for (let i = 0; i < n; i++) bk[i & 1].rect(rnd() * w, rnd() * h, 0.012, 0.008); bk.forEach((p, k) => { g.globalAlpha = 0.3 + k * 0.3; g.fill(p); }); g.restore(); }); },
  // specimen card: torn base, 3x3 grid, numbered cells, title on top
  specimenCard(w, h, o = {}) { const t = item.torn(w, h, o.color || '#FCE7BF', { edges: 'tblr' }); return sprite(w, h, (g) => { g.drawImage(t.cv, 0, 0, w, h);
    const [gx, gy, gw, gh] = o.grid || [0.5, 0.9, w - 1.0, h - 1.4], line = o.line || '#E4A068', ink = o.ink || '#7B4C2D';
    g.strokeStyle = line; g.lineWidth = 0.026; g.lineCap = 'round';
    for (let i = 0; i <= 3; i++) { const x = gx + gw * i / 3, y = gy + gh * i / 3; g.beginPath(); g.moveTo(x, gy); g.lineTo(x + 0.01, gy + gh); g.stroke(); g.beginPath(); g.moveTo(gx, y); g.lineTo(gx + gw, y + 0.01); g.stroke(); }
    for (let i = 0; i < 9; i++) print(g, String(i + 1), gx + gw * (i % 3) / 3 + 0.14, gy + gh * Math.floor(i / 3) / 3 + 0.34, 0.24, ink, 'NunitoP');
    if (o.title) hand(g, o.title, gx, gy - 0.25, 0.42, ink);
    if (o.note) print(g, o.note, gx + gw, gy - 0.25, 0.28, ink, 'NunitoP', 'right'); }); },
  // marble sticker: flat die-cut circle, glassy gradient, swirl ribbon and highlight (not a 3D ball)
  marble(r, color, o = {}) { const b = 0.09, s = r + b; return sprite(2 * s, 2 * s, (g) => { const c = s;
    g.fillStyle = '#FFFDF6'; g.beginPath(); g.arc(c, c, s, 0, 7); g.fill(); g.strokeStyle = 'rgba(150,100,60,0.25)'; g.lineWidth = 0.015; g.stroke();
    g.save(); g.beginPath(); g.arc(c, c, r, 0, 7); g.clip(); g.fillStyle = color; g.fillRect(0, 0, 2 * s, 2 * s);
    g.lineCap = 'round'; for (const [col, lw, ph] of [[o.swirl || 'rgba(255,250,235,0.55)', r * 0.22, 0], [o.deep || 'rgba(25,35,25,0.28)', r * 0.12, 1.3]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
      for (let i = 0; i <= 30; i++) { const t = i / 30, a = ph + t * Math.PI * 1.3; const x = c - r * 0.9 + t * r * 1.8, y = c + Math.sin(a * 1.6) * r * 0.42; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
    const gr = g.createRadialGradient(c - r * 0.35, c - r * 0.4, r * 0.05, c, c, r * 1.02); gr.addColorStop(0, 'rgba(255,255,255,0.42)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(20,25,20,0.3)'); g.fillStyle = gr; g.fillRect(0, 0, 2 * s, 2 * s);
    pencil.hatch(g, (q) => { q.beginPath(); q.arc(c, c, r, 0, 7); }, [c - r, c - r, 2 * r, 2 * r], 'rgba(255,255,255,0.9)', { gap: 0.08, w: 0.02, alpha: 0.16 });
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.ellipse(c - r * 0.38, c - r * 0.42, r * 0.22, r * 0.11, -0.6, 0, 7); g.fill(); g.beginPath(); g.arc(c - r * 0.1, c - r * 0.6, r * 0.05, 0, 7); g.fill();
    g.restore(); g.strokeStyle = 'rgba(60,40,25,0.35)'; g.lineWidth = 0.018; g.beginPath(); g.arc(c, c, r, 0, 7); g.stroke(); }); },
  // coloured-pencil star sticker: white die-cut border, two hatch colours, pencil outline
  starSticker(r, c1, c2, o = {}) { const s = r + 0.16; return sprite(2 * s, 2 * s, (g) => { const pts = starPts(s, s + 0.03, r, o.rot ?? 0, 0.48);
    g.lineJoin = 'round'; g.strokeStyle = '#FFFDF6'; g.lineWidth = 0.26; polyPath(g, pts); g.stroke(); g.fillStyle = '#FFFDF6'; g.fill();
    g.strokeStyle = 'rgba(150,100,60,0.22)'; g.lineWidth = 0.27; g.globalCompositeOperation = 'destination-over'; polyPath(g, pts); g.stroke(); g.globalCompositeOperation = 'source-over';
    g.fillStyle = o.base || '#FFF2D8'; polyPath(g, pts); g.fill();
    pencil.hatch(g, (q) => polyPath(q, pts), [0, 0, 2 * s, 2 * s], c1, { gap: 0.06, alpha: 0.75 }); pencil.hatch(g, (q) => polyPath(q, pts), [0, 0, 2 * s, 2 * s], c2, { gap: 0.09, offset: 0.03, alpha: 0.55 });
    pencil.line(g, pts, 0.026, o.line || '#7B4C2D', { alpha: 0.8 }); }); },
  // pencil shavings (soft): ruffled wavy fan, wood inside, paint band on the rim, a coloured tip
  shavings(w, h, paint, o = {}) { return sprite(w, h, (g) => { const cx = w / 2, cy = h * 0.55, R = Math.min(w / 2, h) * 0.92, sy = Math.min(1, h / w * 1.6);
    g.save(); g.translate(cx, cy); g.scale(1, sy); const a0 = 0.35, a1 = Math.PI * 2 - 0.35, n = 90, outer = [], inner = [];
    for (let i = 0; i <= n; i++) { const t = i / n, a = a0 + (a1 - a0) * t, ro = R * (0.7 + 0.3 * t) * (1 + 0.07 * Math.sin(a * 13)), ri = R * 0.22; outer.push([Math.cos(a) * ro, Math.sin(a) * ro]); inner.push([Math.cos(a) * ri, Math.sin(a) * ri]); }
    const ring = () => { g.beginPath(); outer.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); for (let i = inner.length - 1; i >= 0; i--) g.lineTo(...inner[i]); g.closePath(); };
    g.fillStyle = o.wood || '#EBC79B'; ring(); g.fill(); g.save(); ring(); g.clip();
    g.strokeStyle = 'rgba(150,95,50,0.3)'; g.lineWidth = 0.014; for (let i = 0; i < 26; i++) { const a = a0 + (a1 - a0) * i / 26; g.beginPath(); g.moveTo(Math.cos(a) * R * 0.25, Math.sin(a) * R * 0.25); g.lineTo(Math.cos(a) * R, Math.sin(a) * R); g.stroke(); }
    g.restore(); g.strokeStyle = paint; g.lineWidth = R * 0.12; g.beginPath(); outer.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = R * 0.03; g.stroke();
    g.fillStyle = paint; g.beginPath(); g.arc(0, 0, R * 0.2, 0, 7); g.fill(); g.restore(); }); },
  // coloured pencil seen from above: three facets, sharpened wood cone, coloured tip
  pencilStub(len, d, color, o = {}) { return sprite(len, d, (g) => { const cone = d * 1.7, body = len - cone;
    g.fillStyle = color; rr(g, 0, 0, body + 0.05, d, 0.04); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(0.02, d * 0.08, body, d * 0.22); g.fillStyle = 'rgba(40,20,10,0.22)'; g.fillRect(0.02, d * 0.68, body, d * 0.26);
    g.strokeStyle = 'rgba(40,20,10,0.18)'; g.lineWidth = 0.012; for (const y of [d * 0.33, d * 0.66]) { g.beginPath(); g.moveTo(0.03, y); g.lineTo(body, y); g.stroke(); }
    g.fillStyle = o.endCap || '#F3D7AE'; g.beginPath(); g.ellipse(0.04, d / 2, 0.035, d * 0.46, 0, 0, 7); g.fill();
    g.fillStyle = '#EBC79B'; g.beginPath(); g.moveTo(body, 0.01); for (let i = 0; i <= 6; i++) g.lineTo(body + 0.06 * Math.sin(i * 1.1), d * i / 6); g.lineTo(len - 0.02, d * 0.52); g.closePath(); g.fill();
    g.fillStyle = color; g.beginPath(); g.moveTo(len - cone * 0.32, d * 0.36); g.lineTo(len - 0.02, d * 0.52); g.lineTo(len - cone * 0.32, d * 0.68); g.closePath(); g.fill();
    if (o.label) print(g, o.label, body * 0.45, d * 0.62, d * 0.42, o.labelColor || '#F7E3B4', 'NunitoP', 'center'); }); },
  // shallow box lid under the poster: warm card face, darker side band for thickness, inner rim line
  boxLid(w, h, color = '#F8DCB4', o = {}) { const sb = o.side ?? 0.3; return sprite(w, h, (g) => {
    g.fillStyle = color; rr(g, 0, 0, w, h, 0.12); g.fill(); g.save(); rr(g, 0, 0, w, h, 0.12); g.clip(); grain(g, w, h, 0.08);
    g.fillStyle = 'rgba(150,95,50,0.26)'; g.fillRect(0, h - sb, w, sb); g.fillRect(w - sb * 0.7, 0, sb * 0.7, h);
    g.strokeStyle = 'rgba(255,246,228,0.7)'; g.lineWidth = 0.03; g.beginPath(); g.moveTo(0.1, h - sb); g.lineTo(w - sb * 0.7, h - sb); g.lineTo(w - sb * 0.7, 0.1); g.stroke();
    g.strokeStyle = 'rgba(150,95,50,0.28)'; g.lineWidth = 0.025; rr(g, 0.32, 0.32, w - sb * 0.7 - 0.62, h - sb - 0.62, 0.08); g.stroke();
    const gr = g.createLinearGradient(0, 0, 0, 0.6); gr.addColorStop(0, 'rgba(255,250,238,0.45)'); gr.addColorStop(1, 'rgba(255,250,238,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, 0.6); g.restore(); }); },
});
