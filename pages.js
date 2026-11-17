// 晴窗手账 · 原型里的五个页面：雪绒国跨页（左/右）、翻页背面（第 3 页）、翻页露出的第 4 页、扉页
// R82：页面底图只保留手写/印刷文字、涂鸦、邮戳、页码 + 贴片在纸面上的软投影；
//      便签、车票、信封、口袋、邮票、贴纸、相片……全部成为真 3D 贴片（pagePatches.js），用 260–320 px/cm 的独立高清图集。
import { P, setK, withK, setReal3D, seed, sprite, place, hand, print, doodle, item, rr, crayon, pen, charcoal, pencil } from './collage.js';
import { L } from './pagePatches.js';

const pk = (k, f) => withK(Math.round(k * (globalThis.__patchKScale || 1)), f);   // 触屏设备整体降到 0.72 以控显存       // 在指定像素密度（px/cm）下画精灵
const D2R = Math.PI / 180;
// 子部件：相对父物件中心 (ox, oy)（父物件局部坐标）→ 页面坐标
const childAt = (cx, cy, rot, ox, oy) => { const a = rot * D2R; return [cx + Math.cos(a) * ox - Math.sin(a) * oy, cy + Math.sin(a) * ox + Math.cos(a) * oy]; };
const SIDE = { paper: 0xFFF9EE, white: 0xFFFFFF, kraft: 0xCDA676, honey: 0xD9A04E, cream: 0xF4E2C2, lilac: 0xD8CBEA, mint: 0x9FD3BE };
function punches(list, z = 0.040) { // 雪花打孔纸片：厚 0.022，各自轻微倾斜/微翘
  return list.map(([x, y, s, c, r], i) => ({ sp: pk(260, () => item.punch(s, c)), cx: x, cy: y, rot: r, z: z + (i % 3) * 0.0, t: 0.022,
    lifts: [L.tilt(0.018 + 0.012 * ((i * 7) % 3), 0.012 * ((i * 5) % 2))], side: SIDE.white, mres: 140, ospace: 0.025, osmooth: 1, cell: 0.12 }));
}
const washi = (w, h, color, pat, a, cx, cy, rot, extra = {}) => Object.assign({ g: 'soft', sp: pk(220, () => item.washi(w, h, color, pat, a)), cx, cy, rot, z: 0.3, floor: 0.006, cell: 0.12, shadowA: 0.32 }, extra);
function envelope3D(E, cx, cy, rot, z, pillow, id) { // 信封三层：背片 → 信卡（低一层，插在袋里）→ 前袋（枕形鼓起）
  const out = [];
  for (const [name, dz, t, side, lifts] of [['back', 0, 0.016, SIDE.cream, []], ['card', 0.019, 0.012, SIDE.white, [L.tilt(0, -0.02)]], ['front', 0.035, 0.022, SIDE.cream, [L.pocket(pillow)]]]) {
    const part = E[name]; const [x, y] = childAt(cx, cy, rot, part.ox, part.oy);
    out.push({ id: id + '_' + name, sp: part.sp, cx: x, cy: y, rot: rot + part.rot, z: z + dz, t, lifts, side, mres: 50, cell: 0.25 });
  }
  return out;
}

export async function buildPages(ctx) {
  const { S, THREE, PAGE_RT_W, canvasLayer, makePageRT, renderPage, loadTex, loadImg, info, Q, PATCH } = ctx;
  const kPage = PAGE_RT_W / S.PW; setK(kPage); setReal3D(true);
  const RT = {};
  const poster = await loadTex('assets/poster_snow03.jpg'); poster.generateMipmaps = true; poster.minFilter = THREE.LinearMipmapLinearFilter; poster.anisotropy = ctx.maxAniso;
  info.posterSize = [poster.image.width, poster.image.height];
  const kokoArt = await loadTex('assets/koko_cut_full.png'); kokoArt.premultiplyAlpha = true; kokoArt.anisotropy = ctx.maxAniso; kokoArt.generateMipmaps = true; kokoArt.minFilter = THREE.LinearMipmapLinearFilter;
  const cream = await loadTex('assets/Koko_cream_01_round_pegs.jpg'); cream.generateMipmaps = true; cream.minFilter = THREE.LinearMipmapLinearFilter; cream.anisotropy = ctx.maxAniso;
  const kokoCut = await loadImg('assets/koko_diecut.png');
  const t0 = performance.now(); info.patchBuild = {};
  const finish = async (key, rec, layer) => { RT[key] = makePageRT(); renderPage(RT[key], [{ tex: layer, rect: [0, 0, S.PW, S.PH] }]); rec && rec.free(); layer.dispose(); layer.image.width = 1; layer.image.height = 1; if (ctx.onPage) await ctx.onPage(key); };
  const ink = (bb, draw) => ({ bb, draw });

  // ================= 左页（第 1 页）：主照片 =================
  const ph = 12.8, pw = ph * 864 / 1152, bx = 2.4, by = 3.2, border = pw * 0.025;
  const posterRot = Q.get('rot') !== null ? parseFloat(Q.get('rot')) : -2;
  info.posterRect = { x: bx, y: by, w: pw, h: ph, rot: posterRot }; info.posterKey = ['snowL', 'poster'];
  seed(17);
  {
    const pcx = bx + pw / 2, pcy = by + ph / 2;
    const ps = [
      { id: 'gingham', sp: pk(200, () => item.torn(9.6, 13.2, '#EEF4FB', { pattern: 'gingham' })), cx: 7.6, cy: 9.4, rot: 5, z: 0.018, t: 0.018, lifts: [L.corner(1, -1, 0.07, 2.4)], side: SIDE.paper, mres: 30, ospace: 0.06 },
      { id: 'doily', g: 'soft', sp: pk(160, () => item.doily(2.3)), cx: 12.2, cy: 2.6, rot: 0, z: 0.022, floor: 0.022, cell: 0.2, shadowA: 0.3 },
      washi(0.9, 4.2, P.peach, 'stripes', 0.8, 0.85, 16.6, 4),
      { id: 'ticket', sp: pk(320, () => item.ticket(4.8, 2.3, { title: '雪绒国 小火车', sub: '小窗站 → 邮局站', line: '靠窗 · 3 车 7 座', no: 'No.0017', band: P.snowDeep })), cx: 12.15, cy: 3.55, rot: 8, z: 0.22, t: 0.032, side: SIDE.paper, mres: 60 },
      // 两张雪景：页上露出封面，后面错开一条纸边，提示是一叠收纳口
      { id: 'stack1', sp: pk(120, () => sprite(pw + 2 * border + 0.2, ph + 2 * border + 0.2, (q, w, h) => { q.fillStyle = '#F4E6D0'; rr(q, 0, 0, w, h, 0.1); q.fill(); })),
        cx: pcx + 0.22, cy: pcy + 0.16, rot: posterRot + 1.5, z: 0.055, t: 0.03, side: SIDE.paper, mres: 14, cell: 0.55, noCast: true, noPick: true },
      { id: 'photo', sp: pk(160, () => sprite(pw + 2 * border, ph + 2 * border, (q, w, h) => { q.fillStyle = P.white; rr(q, 0, 0, w, h, 0.08); q.fill(); })), cx: pcx, cy: pcy, rot: posterRot, z: 0.080, t: 0.040, lifts: [L.arch(0.035)], side: SIDE.white, mres: 24, cell: 0.35 },
      { id: 'poster', g: 'poster', on: 'photo', w: pw, h: ph, cx: pcx, cy: pcy, rot: posterRot, tex: poster, z: 0.2, cell: 0.35, series: 'snow' },
      { id: 'dateTape', sp: pk(320, () => item.tapeLabel(6.6, 1.05, '十二月七日 · 晴转小雪', P.lilac)), cx: 4.9, cy: 1.55, rot: -1.5, z: 0.032, t: 0.015, side: SIDE.lilac, mres: 50, ospace: 0.05 },
      ...punches([[1.15, 5.4, 0.72, P.white, 10], [1.55, 9.6, 0.5, P.snowPale, 30], [0.95, 13.3, 0.62, P.white, 5], [13.55, 8.7, 0.56, P.white, 18], [13.25, 12.6, 0.44, P.snowPale, 40], [3.2, 16.5, 0.5, P.white, 22]]),
      { id: 'tag', sp: pk(320, () => item.tag(2.3, 3.3, ['给', '小橘子'])), cx: 12.15, cy: 16.9, rot: 8, z: 0.16, t: 0.038, lifts: [L.edge('b', 0.05, 1.2)], side: SIDE.kraft, mres: 60 },
    ];
    // 四只蜂蜜色三角相角：真挤出的 3D 压角，高出相纸面
    const cs = 1.1, o = 0.12;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const x = sx * (pw / 2 + border), y = sy * (ph / 2 + border);
      const A = [x + o * sx, y + o * sy], B = [x - cs * sx, y + o * sy], Cc = [x + o * sx, y - cs * sy];
      const x0 = Math.min(A[0], B[0], Cc[0]) - 0.08, x1 = Math.max(A[0], B[0], Cc[0]) + 0.08, y0 = Math.min(A[1], B[1], Cc[1]) - 0.08, y1 = Math.max(A[1], B[1], Cc[1]) + 0.08;
      const sp = pk(220, () => sprite(x1 - x0, y1 - y0, (g) => { g.translate(-x0, -y0);
        g.fillStyle = P.honey; g.lineJoin = 'round'; g.lineWidth = 0.12; g.strokeStyle = P.honey; g.beginPath(); g.moveTo(...A); g.lineTo(...B); g.lineTo(...Cc); g.closePath(); g.fill(); g.stroke();
        const tt = 0.09; g.strokeStyle = 'rgba(255,240,205,0.85)'; g.lineWidth = 0.045; g.lineCap = 'round';
        g.beginPath(); g.moveTo(B[0] + tt * sx * 0.3, B[1] - tt * sy); g.lineTo(Cc[0] - tt * sx, Cc[1] + tt * sy * 0.3); g.stroke(); }));
      const [cx, cy] = childAt(pcx, pcy, posterRot, (x0 + x1) / 2, (y0 + y1) / 2);
      ps.push({ id: 'corner' + sx + sy, sp, cx, cy, rot: posterRot, z: 0.145, t: 0.045, side: SIDE.honey, mres: 90, ospace: 0.04, cell: 0.15, press: true });
    }
    // 吊牌棉绳：从订口探出 → 绕到吊牌圆孔 → 穿孔到吊牌背面 → 绕过顶边回到正面打个结
    const twine = { type: 'twine', kind: 1, r: 0.036, radial: 10, pts: (topAt, byId) => {
      const T = byId.tag; const a = T.rot * D2R; const loc = (lx, ly) => [T.cx + Math.cos(a) * lx - Math.sin(a) * ly, T.cy + Math.sin(a) * lx + Math.cos(a) * ly];
      const top = (lx, ly) => { const [x, y] = loc(lx, ly); return topAt(T, x, y); }; const hy = -T.hh + 0.55, tH = top(0, hy);
      return [[15.05, 14.3, 0.015], [14.55, 14.55, 0.045], [13.9, 14.9, 0.05], [13.95, 15.75, 0.05], [13.6, 16.45, 0.055],
        [...loc(0.42, hy - 0.5), tH + 0.10], [...loc(0.14, hy - 0.12), tH + 0.07], [...loc(0, hy), T.z + T.t * 0.5], [...loc(-0.05, hy + 0.12), T.z - 0.05],
        [...loc(-0.1, -T.hh + 0.22), T.z - 0.045], [...loc(-0.13, -T.hh - 0.1), T.z * 0.62], [...loc(-0.16, -T.hh - 0.17), tH + 0.035],
        [...loc(-0.24, -T.hh + 0.16), tH + 0.046], [...loc(-0.42, hy + 0.05), tH + 0.04], [...loc(-0.62, hy + 0.42), tH + 0.038]]; } };
    const inks = [ink([6.6, 17.7, 9.3, 20.4], (g) => place(g, item.dateStamp('12·07'), 7.9, 19.05, -12, { noShadow: true, alpha: 0.9 }))];
    const rec = PATCH.buildPage('snowL', { patches: ps, wires: [twine], inks, withK });
    const L0 = canvasLayer((g, k) => {
      hand(g, '小窗里的我，和一颗烤橘子。', 2.4, 17.6, 0.5, P.ink);
      doodle.arrow(g, [5.2, 17.0], [5.0, 16.6], [5.6, 16.3], [6.2, 16.15], P.ink, 0.04);
      doodle.star(g, 9.2, 17.35, 0.18); doodle.star(g, 9.75, 16.95, 0.12);
      doodle.snowflake(g, 13.5, 10.6, 0.3); doodle.snowflake(g, 1.4, 11.4, 0.22);
      g.strokeStyle = P.ink; g.lineWidth = 0.05; g.beginPath(); g.arc(1.5, 19.7, 0.42, 0, 7); g.stroke(); print(g, '1', 1.5, 19.85, 0.42, P.ink, 'NunitoP', 'center');
      rec.paintBase(g, k);
    });
    await finish('snowL', rec, L0);
  }

  // ================= 右页（第 2 页）：信封与模切贴纸 =================
  seed(18);
  {
    const KS = 6.4, kRot = 4, kx = 10.35, ky = 13.0; const inset = KS * 40 / 520;  // 模切贴纸 520 像素里，原图占中间 440
    const E = pk(260, () => item.envelopeParts(6.0, 3.6, { peek: 1.45 }));
    const ps = [
      { id: 'grid', sp: pk(300, () => item.torn(8.4, 5.2, '#FFFCF4', { pattern: 'grid', edges: 'tb' })), cx: 5.35, cy: 7.05, rot: -1.2, z: 0.018, t: 0.018, lifts: [L.corner(1, 1, 0.05, 1.5)], side: SIDE.paper, mres: 40 },
      { id: 'doily', g: 'soft', sp: pk(160, () => item.doily(3.35, '#EEF4FB')), cx: 10.3, cy: 13.1, rot: 0, z: 0.022, floor: 0.022, cell: 0.22, shadowA: 0.3 },
      { id: 'receipt', sp: pk(320, () => item.receipt(2.9, 4.3, ['雪人小馆', ['烤橘子', '×1'], ['热可可', '×1'], ['棉花糖', '×2']], ['合计', '¥ 5'])), cx: 2.95, cy: 13.2, rot: 4, z: 0.045, t: 0.018, lifts: [L.edge('b', 0.11, 1.6, 0.55, 1.5)], side: SIDE.paper, mres: 80, ospace: 0.035, osmooth: 1, cell: 0.2 },
      ...envelope3D(E, 10.95, 4.3, 4, 0.085, 0.12, 'env'),
      washi(2.2, 0.75, P.kraft, 'grid', 0.82, 7.85, 2.05, -38),
      { id: 'vellum', g: 'soft', sp: pk(280, () => item.vellum(4.7, 2.7, ['雪落下来的时候，', '是沙沙的。'])), cx: 11.15, cy: 8.55, rot: -4, z: 0.16, floor: 0.16, cell: 0.14, shadowA: 0.28, bridgeR: 0.3 },
      { id: 'orangeS', sp: pk(300, () => item.orangeSticker(0.95)), cx: 2.5, cy: 10.1, rot: -6, z: 0.100, t: 0.048, lifts: [L.edge('r', 0.06, 0.9)], side: SIDE.white, mres: 70, ospace: 0.05, cell: 0.15 },
      { id: 'todo', sp: pk(320, () => item.checklist(4.4, 3.2, '今天要做的事', [['看雪', true], ['烤橘子', true], ['去寄信', false]])), cx: 3.35, cy: 17.85, rot: -3, z: 0.062, t: 0.032, lifts: [L.corner(1, 1, 0.12, 1.9)], side: SIDE.paper, mres: 50 },
      { id: 'stamp', sp: pk(320, () => item.stamp(1.6, 1.95, 'orange', '8分')), cx: 4.35, cy: 17.35, rot: 7, z: 0.2, t: 0.025, side: SIDE.white, mres: 100, ospace: 0.03, osmooth: 1, cell: 0.15 },
      washi(2.3, 0.7, 'rgba(168,220,200,1)', 'dots', 0.78, 5.8, 14.98, 9),
      { id: 'koko', sp: pk(260, () => sprite(KS, KS, (q) => { q.imageSmoothingEnabled = true; q.imageSmoothingQuality = 'high'; q.drawImage(kokoCut, 0, 0, KS, KS); })), cx: kx, cy: ky, rot: kRot, z: 0.120, t: 0.065,
        lifts: [L.dome(0.028, KS * 0.46), L.corner(1, 1, 0.06, 2.4)], side: 0xFFFDF6, mres: 40, outlineN: 64, osmooth: 3, cell: 0.25 },
      { id: 'kokoArt', g: 'poster', on: 'koko', w: KS - 2 * inset, h: KS - 2 * inset, cx: kx, cy: ky, rot: kRot, tex: kokoArt, premul: true, z: 0.3, cell: 0.25 },
      ...punches([[6.6, 2.35, 0.55, P.white, 8], [1.35, 9.95, 0.42, P.snowPale, 20], [6.2, 15.9, 0.5, P.white, 33], [14.0, 9.9, 0.38, P.white, 2], [6.3, 10.0, 0.34, P.snowPale, 14]]),
    ];
    const clip = { type: 'clip', target: 'vellum', cx: 12.55, cy: 8.15, rot: -8, len: 2.6, r: 0.034, kind: 0, radial: 10 };
    const inks = [ink([1.5, 4.6, 9.4, 9.3], (g) => { // 日记（Koko 的口吻）写在撕下来的方格纸上
      ['今天的雪软软的，', '我在小窗里烤了一个橘子。', '橘子皮的香味，圆圆的。', '等雪停了，要去寄信。'].forEach((s, i) => hand(g, s, 1.8, 5.75 + i * 0.95, 0.52, P.ink));
      doodle.circle(g, 5.55, 7.47, 1.05, 0.42, -0.05); doodle.underline(g, 4.45, 7.0, 8.82);
      doodle.arrow(g, [7.25, 8.35], [7.9, 8.0], [7.7, 7.0], [8.25, 6.7], P.inkBlue, 0.04); })];
    const rec = PATCH.buildPage('snowR', { patches: ps, wires: [clip], inks, withK });
    const R0 = canvasLayer((g, k) => {
      print(g, '雪绒国', 1.8, 3.05, 1.15, P.ink, 'ChillRound');
      print(g, 'No.17 · 雪绒国的冬天', 1.85, 3.95, 0.38, P.inkBlue, 'NunitoP');
      doodle.snowflake(g, 5.75, 1.95, 0.3); doodle.snowflake(g, 6.45, 2.75, 0.17);
      hand(g, '橘子贴纸 +1', 3.8, 10.45, 0.38, P.inkBlue);
      hand(g, '这是我！', 6.6, 17.75, 0.48, P.ink);
      doodle.arrow(g, [8.3, 17.4], [8.9, 17.3], [9.0, 16.8], [9.2, 16.35], P.ink, 0.04);
      doodle.heart(g, 6.15, 17.55, 0.24);
      doodle.star(g, 5.6, 13.0, 0.16); doodle.snowflake(g, 13.6, 17.3, 0.24);
      g.strokeStyle = P.ink; g.lineWidth = 0.05; g.beginPath(); g.arc(S.PW - 1.5, 19.7, 0.42, 0, 7); g.stroke(); print(g, '2', S.PW - 1.5, 19.85, 0.42, P.ink, 'NunitoP', 'center');
      rec.paintBase(g, k);
    });
    await finish('snowR', rec, R0);
  }

  // ================= 第 3 页（翻页的背面）：雪绒国 · 续 =================
  seed(19);
  {
    const ps = [
      { id: 'grid', sp: pk(200, () => item.torn(7.4, 6.0, '#FFF9EE', { pattern: 'grid' })), cx: 10.1, cy: 6.7, rot: -3, z: 0.018, t: 0.018, lifts: [L.corner(-1, 1, 0.05, 1.5)], side: SIDE.paper, mres: 36 },
      { id: 'receipt', sp: pk(320, () => item.receipt(2.7, 4.4, ['雪人小馆', ['热可可', '×2'], ['烤橘子', '×1'], ['棉花糖', '×3']], ['合计', '¥ 7'])), cx: 12.75, cy: 10.15, rot: 7, z: 0.040, t: 0.018, lifts: [L.edge('b', 0.10, 1.5, 0.55, 1.5)], side: SIDE.paper, mres: 80, ospace: 0.035, osmooth: 1, cell: 0.2 },
      { id: 'map', sp: pk(260, () => item.map(6.0, 4.6)), cx: 9.9, cy: 6.3, rot: 4, z: 0.072, t: 0.032, lifts: [L.arch(0.04)], side: SIDE.paper, mres: 40 },
      { id: 'vellum', g: 'soft', sp: pk(280, () => item.vellum(3.4, 1.7, ['雪绒国', '小火车路线'])), cx: 8.15, cy: 8.55, rot: -6, z: 0.112, floor: 0.112, cell: 0.14, shadowA: 0.28 },
      washi(1.9, 0.7, P.peach, 'stripes', 0.8, 7.45, 4.15, -30), washi(1.9, 0.7, P.peach, 'stripes', 0.8, 12.6, 4.5, 28),
      { id: 'ticketA', sp: pk(320, () => item.ticket(5.0, 2.3, { title: '雪绒国 小火车', sub: '邮局站 → 小窗站', line: '靠窗 · 2 车 4 座', no: 'No.0018', band: P.snowDeep })), cx: 4.7, cy: 12.0, rot: -8, z: 0.068, t: 0.030, side: SIDE.paper, mres: 60 },
      { id: 'ticketB', sp: pk(320, () => item.ticket(4.6, 2.1, { title: '热可可', sub: '雪人小馆', line: '加一颗棉花糖', no: 'No.0203', band: P.coral, stub: '一杯', price: '¥ 3' })), cx: 6.4, cy: 11.6, rot: 6, z: 0.088, t: 0.030, side: SIDE.paper, mres: 60 },
      { id: 'pocketIn', sp: pk(160, () => item.pocketInner(6.1, 3.3)), cx: 5.4, cy: 14.35, rot: -2, z: 0.026, t: 0.008, side: SIDE.kraft, mres: 24, noCast: true, cell: 0.4 },
      { id: 'pocket', sp: pk(260, () => item.pocket(6.6, 4.3)), cx: 5.4, cy: 14.75, rot: -2, z: 0.130, t: 0.048, lifts: [L.pocket(0.15)], side: SIDE.kraft, mres: 40, cell: 0.22 },
      { id: 'doily', g: 'soft', sp: pk(160, () => item.doily(1.75, '#EEF4FB')), cx: 12.5, cy: 14.55, rot: 0, z: 0.022, floor: 0.022, cell: 0.16, shadowA: 0.3 },
      { id: 'stamp1', sp: pk(320, () => item.stamp(1.6, 1.95, 'tree', '4分')), cx: 12.2, cy: 13.2, rot: 8, z: 0.095, t: 0.025, side: SIDE.white, mres: 100, ospace: 0.03, osmooth: 1, cell: 0.15 },
      { id: 'stamp2', sp: pk(320, () => item.stamp(1.6, 1.95, 'house', '8分')), cx: 12.9, cy: 15.7, rot: -5, z: 0.095, t: 0.025, side: SIDE.white, mres: 100, ospace: 0.03, osmooth: 1, cell: 0.15 },
      ...punches([[9.4, 10.6, 0.5, P.white, 5], [10.4, 17.0, 0.4, P.white, 40], [1.2, 17.1, 0.42, P.white, 12]]),
      { id: 'mintTag', sp: pk(320, () => item.tapeLabel(3.6, 0.9, '票都在这里', P.mint)), cx: 11.9, cy: 18.15, rot: 3, z: 0.030, t: 0.015, side: SIDE.mint, mres: 50, ospace: 0.05 },
    ];
    const clip = { type: 'clip', target: 'ticketA', cx: 2.55, cy: 11.2, rot: -12, len: 2.4, r: 0.032, kind: 0, radial: 10 };
    const inks = [ink([10.8, 13.8, 14.8, 16.0], (g) => item.postmark(g, 11.9, 14.9, 0.55, '雪绒国', '12.08')),
      ink([1.0, 7.4, 3.7, 10.1], (g) => place(g, item.dateStamp('12·08'), 2.35, 8.75, 10, { noShadow: true, alpha: 0.88 })),
      ink([4.6, 5.0, 7.2, 6.4], (g) => doodle.arrow(g, [5.0, 5.75], [5.7, 5.35], [6.2, 5.6], [6.75, 5.95], P.inkBlue, 0.04))];
    const rec = PATCH.buildPage('nextL', { patches: ps, wires: [clip], inks, withK });
    const B19 = canvasLayer((g, k) => {
      print(g, '雪绒国 · 续', 1.6, 2.7, 0.9, P.ink, 'ChillRound');
      ['回来的路上，', '雪更大了。', '票都收好，', '下次还要去。'].forEach((s, i) => hand(g, s, 1.6, 4.4 + i * 0.85, 0.5, P.ink));
      doodle.snowflake(g, 4.6, 8.4, 0.24); doodle.snowflake(g, 5.3, 9.05, 0.15);
      hand(g, '下一站：一起看星星。', 1.6, 18.9, 0.45, P.inkBlue); doodle.star(g, 7.6, 18.65, 0.2); doodle.star(g, 8.2, 18.2, 0.12);
      g.strokeStyle = P.ink; g.lineWidth = 0.05; g.beginPath(); g.arc(1.5, 19.95, 0.38, 0, 7); g.stroke(); print(g, '3', 1.5, 20.09, 0.38, P.ink, 'NunitoP', 'center');
      rec.paintBase(g, k);
    });
    await finish('nextL', rec, B19);
  }

  // ================= 第 4 页（翻页时露出）：给自己的信 =================
  seed(20);
  {
    const letter = pk(280, () => sprite(10.8, 12.6, (q, w, h) => {
      q.fillStyle = '#FFFBF2'; rr(q, 0, 0, w, h, 0.05); q.fill();
      q.strokeStyle = 'rgba(127,163,207,0.5)'; q.lineWidth = 0.02; for (let y = 2.2; y < h - 0.6; y += 0.9) { q.beginPath(); q.moveTo(0.6, y); q.lineTo(w - 0.6, y); q.stroke(); }
      q.strokeStyle = 'rgba(244,140,122,0.55)'; q.beginPath(); q.moveTo(1.2, 0.4); q.lineTo(1.2, h - 0.4); q.stroke();
      ['亲爱的 Koko：', '今天的雪，像在小声说话。', '橘子烤好的时候，', '整个小窗都是甜的。', '明天也要是晴天。'].forEach((s, i) => hand(q, s, 1.5, 2.05 + i * 1.8, 0.56, i ? P.ink : P.inkBlue));
      hand(q, 'Koko', w - 3.0, h - 1.1, 0.7, P.inkBlue); doodle.circle(q, w - 1.2, h - 1.35, 0.18, 0.18, 0, P.inkBlue, 0.04);
    }));
    const E = pk(260, () => item.envelopeParts(4.4, 2.7, { peek: 1.2 }));
    const ps = [
      { id: 'gingham', sp: pk(200, () => item.torn(11.0, 12.8, '#EEF4FB', { pattern: 'gingham' })), cx: 8.3, cy: 10.1, rot: 3, z: 0.020, t: 0.018, side: SIDE.paper, mres: 30, ospace: 0.06 },
      { id: 'letter', sp: letter, cx: 7.6, cy: 9.6, rot: -1.5, z: 0.062, t: 0.028, lifts: [L.corner(1, -1, 0.15, 3.0), L.corner(-1, 1, 0.15, 3.0)], side: SIDE.paper, mres: 30, cell: 0.28 },
      washi(2.4, 0.75, P.snow, 'snow', 0.8, 3.0, 3.55, -20), washi(2.4, 0.75, P.snow, 'snow', 0.8, 12.3, 3.35, 22),
      { id: 'stamp', sp: pk(320, () => item.stamp(1.5, 1.8, 'house', '8分')), cx: 12.6, cy: 3.9, rot: 7, z: 0.095, t: 0.025, side: SIDE.white, mres: 100, ospace: 0.03, osmooth: 1, cell: 0.12 },
      { id: 'tag', sp: pk(320, () => item.tag(2.0, 2.9, ['回信', '寄小窗'])), cx: 1.75, cy: 16.9, rot: -8, z: 0.065, t: 0.038, lifts: [L.corner(-1, 1, 0.12, 1.6)], side: SIDE.kraft, mres: 60 },
      { id: 'ticket', sp: pk(320, () => item.ticket(4.2, 1.9, { title: '小窗站', sub: '一日票', line: '可以坐好多次', no: 'No.0001', band: P.snow })), cx: 5.4, cy: 17.5, rot: -6, z: 0.085, t: 0.030, lifts: [L.corner(1, -1, 0.10, 1.4)], side: SIDE.paper, mres: 60 },
      ...envelope3D(E, 10.75, 17.75, 5, 0.095, 0.11, 'env'),
      // 橘子贴纸落在信纸空白处，不压信封；靠 baseAt 承托，不用 conform
      { id: 'orangeS', sp: pk(300, () => item.orangeSticker(0.7)), cx: 3.4, cy: 14.2, rot: 8, z: 0.22, t: 0.048, side: SIDE.white, mres: 80, ospace: 0.04, cell: 0.12, restOn: ['letter'] },
      ...punches([[13.7, 10.6, 0.45, P.snowPale, 4], [1.25, 11.6, 0.45, P.snowPale, 22], [8.6, 18.9, 0.42, P.snowPale, 9]]),
    ];
    const clip = { type: 'clip', target: 'letter', cx: 12.5, cy: 7.4, rot: 92, len: 2.6, r: 0.034, kind: 0, radial: 10 };
    const inks = [ink([12.2, 14.4, 14.8, 18.2], (g) => item.postmark(g, 12.9, 16.3, 0.5, '小窗站', '12.09')), ink([13.0, 12.8, 14.2, 13.9], (g) => doodle.heart(g, 13.6, 13.4, 0.35))];
    const rec = PATCH.buildPage('nextR', { patches: ps, wires: [clip], inks, withK });
    const B20 = canvasLayer((g, k) => {
      print(g, '给自己的信', 1.7, 2.4, 0.8, P.ink, 'ChillRound');
      doodle.snowflake(g, 1.3, 7.2, 0.26); doodle.star(g, 6.9, 2.1, 0.18);
      hand(g, '读完要笑一下哦', 3.4, 19.75, 0.4, P.inkBlue);
      g.strokeStyle = P.ink; g.lineWidth = 0.05; g.beginPath(); g.arc(S.PW - 1.5, 19.95, 0.38, 0, 7); g.stroke(); print(g, '4', S.PW - 1.5, 20.09, 0.38, P.ink, 'NunitoP', 'center');
      rec.paintBase(g, k);
    });
    await finish('nextR', rec, B20);
  }
  RT.snowR2 = RT.snowR;

  // 简单跨页：左日记 + 右主照片收纳口（物件互不重叠）
  async function seriesSpread(opts) {
    const { keyL, keyR, no, title, lines, note, tex, pageNoL, pageNoR, ticketTitle, ticketSub, washiColor, accent } = opts;
    seed(no);
    {
      const rec = PATCH.buildPage(keyL, { patches: [
        washi(3.4, 0.72, washiColor || P.peach, 'dots', 0.82, 7.4, 2.9, -2, { floor: 0.004 }),
        { id: 'ticket', sp: pk(300, () => item.ticket(4.6, 2.1, { title: ticketTitle || title, sub: ticketSub || '今天', line: '收好这一页', no: 'No.00' + String(no).padStart(2, '0'), band: accent || P.coral })), cx: 4.2, cy: 16.6, rot: -5, z: 0.08, t: 0.03, side: SIDE.paper, mres: 55 },
        { id: 'stamp', sp: pk(300, () => item.stamp(1.5, 1.8, 'orange', '8分')), cx: 12.4, cy: 16.8, rot: 6, z: 0.1, t: 0.025, side: SIDE.white, mres: 90, ospace: 0.03, cell: 0.14 },
      ], withK });
      const Lpg = canvasLayer((g, k) => {
        print(g, title, 1.8, 5.0, 1.05, P.ink, 'ChillRound');
        print(g, 'No.' + no, 1.85, 5.9, 0.36, P.inkBlue, 'NunitoP');
        lines.forEach((s, i) => hand(g, s, 1.9, 7.4 + i * 0.95, 0.5, P.ink));
        if (note) hand(g, note, 1.9, 18.6, 0.42, P.inkBlue);
        g.strokeStyle = P.ink; g.lineWidth = 0.05; g.beginPath(); g.arc(1.5, 19.7, 0.42, 0, 7); g.stroke();
        print(g, String(pageNoL), 1.5, 19.85, 0.42, P.ink, 'NunitoP', 'center');
        rec.paintBase(g, k);
      });
      await finish(keyL, rec, Lpg);
    }
    seed(no + 100);
    {
      const img = tex.image || tex; const iw = img.width || 1, ih = img.height || 1;
      const ph = 13.2, pw = Math.min(11.4, ph * iw / ih), border = pw * 0.025;
      const cx = S.PW / 2, cy = 9.4, rot = -1.5;
      const ps = [];
      // 多张时露出后面错开的纸边，提示这是一叠收纳口
      if ((opts.stack || 0) > 1) {
        for (let i = (opts.stack || 1) - 1; i >= 1; i--) {
          const ox = 0.18 * i, oy = 0.14 * i;
          ps.push({ id: 'stack' + i, sp: pk(120, () => sprite(pw + 2 * border + 0.15, ph + 2 * border + 0.15, (q, w, h) => { q.fillStyle = i % 2 ? '#FFF8EE' : '#F4E6D0'; rr(q, 0, 0, w, h, 0.1); q.fill(); })),
            cx: cx + ox, cy: cy + oy, rot: rot + i * 1.2, z: 0.04 + i * 0.012, t: 0.03, side: SIDE.paper, mres: 14, cell: 0.55, noCast: true, noPick: true });
        }
      }
      ps.push(
        { id: 'photo', sp: pk(140, () => sprite(pw + 2 * border, ph + 2 * border, (q, w, h) => { q.fillStyle = '#FFFDF8'; rr(q, 0, 0, w, h, 0.1); q.fill(); })), cx, cy, rot, z: 0.08, t: 0.04, lifts: [L.arch(0.03)], side: SIDE.white, mres: 18, cell: 0.4 },
        { id: 'poster', g: 'poster', on: 'photo', w: pw, h: ph, cx, cy, rot, tex, z: 0.2, cell: 0.4, series: opts.series },
      );
      const cs = 1.0, o = 0.1;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const x = sx * (pw / 2 + border), y = sy * (ph / 2 + border);
        const A = [x + o * sx, y + o * sy], B = [x - cs * sx, y + o * sy], Cc = [x + o * sx, y - cs * sy];
        const x0 = Math.min(A[0], B[0], Cc[0]) - 0.08, x1 = Math.max(A[0], B[0], Cc[0]) + 0.08, y0 = Math.min(A[1], B[1], Cc[1]) - 0.08, y1 = Math.max(A[1], B[1], Cc[1]) + 0.08;
        const sp = pk(200, () => sprite(x1 - x0, y1 - y0, (g) => { g.translate(-x0, -y0); g.fillStyle = P.honey; g.beginPath(); g.moveTo(...A); g.lineTo(...B); g.lineTo(...Cc); g.closePath(); g.fill(); }));
        const [px, py] = childAt(cx, cy, rot, (x0 + x1) / 2, (y0 + y1) / 2);
        ps.push({ id: 'corner' + sx + sy, sp, cx: px, cy: py, rot, z: 0.145, t: 0.045, side: SIDE.honey, mres: 80, ospace: 0.04, cell: 0.15, press: true });
      }
      const rec = PATCH.buildPage(keyR, { patches: ps, withK });
      const Rpg = canvasLayer((g, k) => {
        hand(g, '点开看这一组。', 1.7, 18.5, 0.45, P.inkBlue);
        g.strokeStyle = P.ink; g.lineWidth = 0.05; g.beginPath(); g.arc(S.PW - 1.5, 19.7, 0.42, 0, 7); g.stroke();
        print(g, String(pageNoR), S.PW - 1.5, 19.85, 0.42, P.ink, 'NunitoP', 'center');
        rec.paintBase(g, k);
      });
      await finish(keyR, rec, Rpg);
    }
  }

  const cloud = await loadTex('assets/Koko_poster_cloud_afternoon_01_lying_on_cloud_v3.jpg'); cloud.generateMipmaps = true; cloud.minFilter = THREE.LinearMipmapLinearFilter; cloud.anisotropy = ctx.maxAniso;
  const sea = await loadTex('assets/Koko_poster_sea_letter_01_window_gull_v3.jpg'); sea.generateMipmaps = true; sea.minFilter = THREE.LinearMipmapLinearFilter; sea.anisotropy = ctx.maxAniso;
  const starry = await loadTex('assets/Koko_starry_01_round_collection.jpg'); starry.generateMipmaps = true; starry.minFilter = THREE.LinearMipmapLinearFilter; starry.anisotropy = ctx.maxAniso;
  // cream 已在上面加载
  // ================= Cloud spread (pages 5 / 6): sky-watch diary, per the approved series art spec =================
  // insert paper = pale-blue grid sheet; main stroke = crayon; handwriting ink #11488C; page numbers keep the book ink
  {
    const hex = (c) => parseInt(c.slice(1), 16);
    const CL = { sky: '#67B0E2', cream: '#E7DBCA', grass: '#A7B647', sun: '#D86724', brick: '#C8582A', cobalt: '#549AD9', ink: '#11488C', paper: '#E6F1FA', grid: '#9CCBEB', skyLight: '#87BBDF' };
    const cloudFill = (q, w, h) => { q.beginPath();   // 云朵轮廓：四个圆 + 圆角底（rr 会另起路径，所以分两次填）
      for (const [x, y, r] of [[0.25, 0.62, 0.3], [0.45, 0.42, 0.38], [0.68, 0.5, 0.32], [0.82, 0.66, 0.24]]) { q.moveTo(w * x + h * r, h * y); q.arc(w * x, h * y, h * r, 0, Math.PI * 2); }
      q.fill(); rr(q, w * 0.2, h * 0.5, w * 0.64, h * 0.4, h * 0.2); q.fill(); };
    const cloudPunch = (s, c) => sprite(s, s * 0.66, (q, w, h) => { q.fillStyle = c; cloudFill(q, w, h);
      q.fillStyle = 'rgba(255,255,255,0.45)'; q.beginPath(); q.ellipse(w * 0.43, h * 0.3, w * 0.13, h * 0.07, -0.2, 0, 7); q.fill(); });
    // tap = existing pick/pop (random ±5° tilt) — reads as a puff of wind; no new runtime code
    const cloudPunches = (list, pre, z = 0.040) => list.map(([x, y, s, c, r], i) => ({ id: pre + i, sp: pk(260, () => cloudPunch(s, c)), cx: x, cy: y, rot: r, z, t: 0.022,
      lifts: [L.tilt(0.018 + 0.012 * ((i * 7) % 3), 0.012 * ((i * 5) % 2))], side: c === P.white ? SIDE.white : hex(c), mres: 140, ospace: 0.025, osmooth: 1, cell: 0.12 }));
    const sunSticker = (R) => { const wb = R * 0.2; return sprite(2 * (R + wb) + 0.5, 2 * (R + wb) + 0.5, (q, w, h) => { const c = w / 2;  // 模切太阳贴纸：白边 + 光芒 + 笑脸
      const rays = (r0, r1, hw) => { q.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; q.moveTo(c + Math.cos(a - hw) * r0, c + Math.sin(a - hw) * r0); q.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); q.lineTo(c + Math.cos(a + hw) * r0, c + Math.sin(a + hw) * r0); q.closePath(); } };
      q.fillStyle = P.white; q.lineJoin = 'round'; q.strokeStyle = P.white; q.lineWidth = wb * 1.6; rays(R * 0.8, R * 1.32, 0.2); q.fill(); q.stroke(); q.beginPath(); q.arc(c, c, R * 0.8 + wb, 0, 7); q.fill();
      q.fillStyle = P.orange; rays(R * 0.78, R * 1.28, 0.16); q.fill();
      q.fillStyle = P.sun; q.beginPath(); q.arc(c, c, R * 0.78, 0, 7); q.fill();
      q.fillStyle = 'rgba(255,253,248,0.5)'; q.beginPath(); q.ellipse(c - R * 0.28, c - R * 0.32, R * 0.22, R * 0.11, -0.6, 0, 7); q.fill();
      q.fillStyle = P.ink; for (const s of [-1, 1]) { q.beginPath(); q.arc(c + s * R * 0.26, c - R * 0.06, R * 0.07, 0, 7); q.fill(); }
      q.fillStyle = 'rgba(244,140,122,0.6)'; for (const s of [-1, 1]) { q.beginPath(); q.ellipse(c + s * R * 0.45, c + R * 0.14, R * 0.12, R * 0.07, 0, 0, 7); q.fill(); }
      q.strokeStyle = P.ink; q.lineWidth = R * 0.06; q.lineCap = 'round'; q.beginPath(); q.arc(c, c + R * 0.06, R * 0.2, 0.25, Math.PI - 0.25); q.stroke(); }); };
    const corners = (ps, pcx, pcy, rot, pw, ph, border, color) => { const cs = 1.05, o = 0.11; // four photo corners (press the photo), sky blue for this series
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const x = sx * (pw / 2 + border), y = sy * (ph / 2 + border);
        const A = [x + o * sx, y + o * sy], B = [x - cs * sx, y + o * sy], Cc = [x + o * sx, y - cs * sy];
        const x0 = Math.min(A[0], B[0], Cc[0]) - 0.08, x1 = Math.max(A[0], B[0], Cc[0]) + 0.08, y0 = Math.min(A[1], B[1], Cc[1]) - 0.08, y1 = Math.max(A[1], B[1], Cc[1]) + 0.08;
        const sp = pk(220, () => sprite(x1 - x0, y1 - y0, (g) => { g.translate(-x0, -y0);
          g.fillStyle = color; g.lineJoin = 'round'; g.lineWidth = 0.12; g.strokeStyle = color; g.beginPath(); g.moveTo(...A); g.lineTo(...B); g.lineTo(...Cc); g.closePath(); g.fill(); g.stroke();
          const tt = 0.09; g.strokeStyle = 'rgba(235,246,253,0.85)'; g.lineWidth = 0.045; g.lineCap = 'round';
          g.beginPath(); g.moveTo(B[0] + tt * sx * 0.3, B[1] - tt * sy); g.lineTo(Cc[0] - tt * sx, Cc[1] + tt * sy * 0.3); g.stroke(); }));
        const [cx, cy] = childAt(pcx, pcy, rot, (x0 + x1) / 2, (y0 + y1) / 2);
        ps.push({ id: 'corner' + sx + sy, sp, cx, cy, rot, z: 0.145, t: 0.045, side: hex(color), mres: 90, ospace: 0.04, cell: 0.15, press: true });
      } };
    // draw in the rotated frame of the insert sheet: (ox, oy) = sheet centre, rot = sheet angle
    const onPaper = (g, ox, oy, rot, f) => { g.save(); g.translate(ox, oy); g.rotate(rot * D2R); g.translate(-ox, -oy); f(); g.restore(); };
    const pageNo = (g, n, x) => { g.strokeStyle = P.ink; g.lineWidth = 0.05; g.beginPath(); g.arc(x, 19.7, 0.42, 0, 7); g.stroke(); print(g, String(n), x, 19.85, 0.42, P.ink, 'NunitoP', 'center'); };

    // ---------- left page 5: sky-watch diary ----------
    seed(21);
    {
      const OX = 6.8, OY = 9.9, OR = -1.5; // insert sheet 10.4 x 7.4 cm, top-left (1.6, 6.2)
      const kite = { cx: 11.9, cy: 3.1, rot: 12, w: 2.6, h: 3.2 };
      const ps = [
        { id: 'dateTape', sp: pk(320, () => item.inkTape(6.4, 1.0, '六月三日 · 晴，有风', CL.sky, CL.ink)), cx: 4.7, cy: 1.4, rot: -1.2, z: 0.032, t: 0.015, side: hex(CL.sky), mres: 50, ospace: 0.05 },
        { id: 'kite', sp: pk(300, () => item.kite(kite.w, kite.h, [CL.sky, CL.cream, CL.skyLight, CL.sun])), cx: kite.cx, cy: kite.cy, rot: kite.rot, z: 0.05, t: 0.03, lifts: [L.corner(1, -1, 0.06, 1.2)], side: SIDE.white, mres: 70, ospace: 0.04, cell: 0.15 },
        { id: 'obs', sp: pk(260, () => item.obsPaper(10.4, 7.4, { color: CL.paper, line: CL.grid, header: '天空观察 · No.4', headerColor: CL.cobalt })), cx: OX, cy: OY, rot: OR, z: 0.018, t: 0.018, lifts: [L.corner(1, 1, 0.05, 1.8)], side: hex(CL.paper), mres: 40 },
        washi(2.1, 0.7, CL.grass, 'stripes', 0.82, 11.85, 6.4, 36),
        washi(2.1, 0.7, CL.grass, 'stripes', 0.82, 1.85, 13.45, 34),
        { id: 'obsCard', sp: pk(320, () => item.checklist(4.6, 4.0, '天空观察卡', [['今日云量：七朵', false], ['风向：东南风', false], ['来访：一只小鸟', false]])), cx: 11.2, cy: 15.8, rot: 4, z: 0.04, t: 0.03, lifts: [L.corner(1, 1, 0.1, 1.8)], side: SIDE.paper, mres: 50 },
        { id: 'crayonA', sp: pk(320, () => item.crayon(1.55, 0.42, CL.sky)), cx: 2.25, cy: 15.35, rot: -8, z: 0.06, t: 0.06, side: hex(CL.sky), mres: 60, ospace: 0.03, cell: 0.1 },
        { id: 'crayonB', sp: pk(320, () => item.crayon(1.3, 0.42, CL.sun, { torn: 0.3 })), cx: 3.55, cy: 15.85, rot: 16, z: 0.06, t: 0.06, side: hex(CL.sun), mres: 60, ospace: 0.03, cell: 0.1 },
        { id: 'feather', sp: pk(300, () => item.feather(3.0, CL.cobalt)), cx: 6.15, cy: 15.7, rot: 20, z: 0.05, t: 0.014, lifts: [L.tilt(0.02, 0.03)], side: hex(CL.cobalt), mres: 90, ospace: 0.025, osmooth: 1, cell: 0.1 },
        { id: 'ticket', sp: pk(320, () => item.ticket(4.6, 2.1, { title: '云朵观测站', sub: '入场券', line: '躺着看云也可以', no: 'No.0021', band: CL.sky, stub: '一位', price: '¥ 0' })), cx: 5.3, cy: 18.25, rot: -4, z: 0.08, t: 0.03, lifts: [L.corner(1, -1, 0.08, 1.3)], side: SIDE.paper, mres: 60 },
        ...cloudPunches([[13.2, 7.0, 1.2, P.white, 8], [13.4, 10.55, 1.0, CL.paper, -10], [9.3, 2.35, 0.85, CL.skyLight, -6], [13.3, 13.0, 0.9, P.white, 12]], 'cpL'),
      ];
      // kite string: drops from the kite's lower tip, two soft bends, rests on the sheet's top-right
      const kTip = childAt(kite.cx, kite.cy, kite.rot, 0, kite.h / 2 - 0.16);
      const kiteLine = { type: 'twine', kind: 1, r: 0.026, radial: 8, pts: (topAt, byId, stackAt) => {
        const xy = [kTip, [kTip[0] - 0.2, kTip[1] + 0.35], [kTip[0] - 0.12, kTip[1] + 0.75], [kTip[0] - 0.42, kTip[1] + 1.1], [kTip[0] - 0.85, kTip[1] + 1.35], [kTip[0] - 1.15, kTip[1] + 1.7], [kTip[0] - 1.25, kTip[1] + 2.15]];
        return xy.map(([x, y], i) => [x, y, stackAt(x, y) + (i === 0 ? 0.035 : 0.03)]); } };
      const inks = [
        ink([1.8, 6.6, 12.0, 13.4], (g) => onPaper(g, OX, OY, OR, () => { // diary in Koko's voice, baselines on the 0.5 cm grid
          const Y = (i) => 8.2 + i * 1.0, sz = 0.5, X0 = 2.5;
          let x = hand(g, '今天的云，像一张', X0, Y(0), sz, CL.ink); const a0 = x; x = hand(g, '软床', x, Y(0), sz, CL.ink); const a1 = x; hand(g, '。', x, Y(0), sz, CL.ink);
          hand(g, '小鸟落在我头上，不走了。', X0, Y(1), sz, CL.ink);
          x = hand(g, '风来了，我们', X0, Y(2), sz, CL.ink); const b0 = x; x = hand(g, '一起飘一会儿', x, Y(2), sz, CL.ink); const b1 = x; hand(g, '。', x, Y(2), sz, CL.ink);
          crayon.circle(g, (a0 + a1) / 2, Y(0) - 0.17, (a1 - a0) / 2 + 0.16, 0.37, -0.04, CL.brick, 0.065); // brick-red circle
          crayon.underline(g, b0 - 0.02, b1 + 0.02, Y(2) + 0.15, CL.sun, 0.07); // sun-orange underline
          hand(g, '—— 天空观察员 Koko', 5.9, 11.7, 0.38, CL.ink);
          crayon.cloud(g, 10.25, 8.55, 0.75, CL.sky, 0.075); crayon.wind(g, 8.9, 12.45, 1.0, CL.sky, 0.06); crayon.wind(g, 3.1, 12.6, 0.8, CL.sky, 0.06);
        })),
        ink([8.6, 13.4, 13.8, 18.2], (g) => { g.save(); g.translate(11.2, 15.8); g.rotate(4 * D2R); g.translate(-2.3, -2.0);   // crayon ticks on the sky-watch card
          for (const i of [0, 1, 2]) { const y = 1.45 + i * 0.66; crayon.line(g, [[0.34, y - 0.2], [0.47, y - 0.05], [0.8, y - 0.52]], 0.06, CL.brick); }
          g.restore(); }),
      ];
      const rec = PATCH.buildPage('cloudL', { patches: ps, wires: [kiteLine], inks, withK });
      const Lpg = canvasLayer((g, k) => {
        print(g, '云朵午后', 1.8, 4.95, 1.05, CL.ink, 'ChillRound');
        print(g, 'No.4 · 天空观察员', 1.85, 5.62, 0.36, CL.cobalt, 'NunitoP');
        crayon.cloud(g, 7.3, 4.45, 0.62, CL.sky, 0.075);
        crayon.wind(g, 9.2, 4.6, 0.9, CL.sky, 0.06); crayon.wind(g, 9.6, 5.15, 0.6, CL.sky, 0.055);
        crayon.bow(g, 10.75, 5.0, 0.16, CL.brick, 0.05);
        pageNo(g, 5, 1.5);
        rec.paintBase(g, k);
      });
      await finish('cloudL', rec, Lpg);
    }

    // ---------- right page 6: poster pocket as a photo in the watch book ----------
    seed(22);
    {
      const img = cloud.image || cloud; const iw = img.width || 1, ih = img.height || 1;
      const ph = 13.2, pw = Math.min(11.4, ph * iw / ih), border = pw * 0.025;
      const cx = S.PW / 2, cy = 9.4, rot = -1.5;
      const ps = [
        { id: 'photo', sp: pk(140, () => sprite(pw + 2 * border, ph + 2 * border, (q, w, h) => { q.fillStyle = '#FFFDF8'; rr(q, 0, 0, w, h, 0.1); q.fill(); })), cx, cy, rot, z: 0.08, t: 0.04, lifts: [L.arch(0.03)], side: SIDE.white, mres: 18, cell: 0.4 },
        { id: 'poster', g: 'poster', on: 'photo', w: pw, h: ph, cx, cy, rot, tex: cloud, z: 0.2, cell: 0.4, series: 'cloud' },
        { id: 'vellum', g: 'soft', sp: pk(280, () => item.vellum(2.8, 3.8, ['云朵是', '软软的', '棉花糖。'])), cx: 1.75, cy: 5.5, rot: 6, z: 0.03, floor: 0.03, cell: 0.14, shadowA: 0.28, bridgeR: 0.3 },
        { id: 'sunS', sp: pk(300, () => sunSticker(0.7)), cx: 12.7, cy: 2.15, rot: 10, z: 0.06, t: 0.048, lifts: [L.edge('l', 0.05, 0.8)], side: SIDE.white, mres: 70, ospace: 0.05, cell: 0.15 },
        { id: 'receipt', sp: pk(320, () => item.receipt(2.6, 4.4, ['今天的云', ['大朵', '×2'], ['小朵', '×4'], ['棉花糖朵', '×1']], ['一共', '×7'])), cx: 13.1, cy: 6.65, rot: 6, z: 0.045, t: 0.018, lifts: [L.edge('b', 0.10, 1.4, 0.55, 1.5)], side: SIDE.paper, mres: 80, ospace: 0.035, osmooth: 1, cell: 0.2 },
        washi(1.6, 0.6, CL.grass, 'stripes', 0.82, 13.15, 4.3, -8),
        { id: 'stamp', sp: pk(320, () => item.cloudStamp(1.7, 2.1, '8分')), cx: 12.65, cy: 11.05, rot: -6, z: 0.06, t: 0.025, side: SIDE.white, mres: 100, ospace: 0.03, osmooth: 1, cell: 0.15 },
        { id: 'obsTape', sp: pk(320, () => item.inkTape(4.4, 0.8, '观察 No.4', CL.sky, CL.ink, 'dots', 1.2)), cx: 6.4, cy: 16.85, rot: -1.5, z: 0.032, t: 0.015, side: hex(CL.sky), mres: 50, ospace: 0.05 },
        ...cloudPunches([[1.7, 10.3, 1.1, P.white, -8], [2.05, 12.95, 0.85, CL.skyLight, 10]], 'cpR'),
      ];
      corners(ps, cx, cy, rot, pw, ph, border, CL.sky);
      const clip = { type: 'clip', target: 'vellum', cx: 2.7, cy: 3.8, rot: 6, len: 2.4, r: 0.032, kind: 0, radial: 10 };
      const inks = [ink([10.4, 16.6, 13.0, 19.2], (g) => item.postmark(g, 11.7, 17.9, 0.52, '云上站', '06.03', 'rgba(17,72,140,0.72)'))];
      const rec = PATCH.buildPage('cloudR', { patches: ps, wires: [clip], inks, withK });
      const Rpg = canvasLayer((g, k) => {
        hand(g, '我和云，还有一只小鸟。', 1.5, 18.35, 0.5, CL.ink);
        crayon.underline(g, 5.0, 6.95, 18.52, CL.sun, 0.065);
        crayon.cloud(g, 1.8, 2.1, 0.6, CL.sky, 0.075); crayon.wind(g, 0.9, 2.95, 0.8, CL.sky, 0.055);
        crayon.wind(g, 11.75, 0.75, 0.7, CL.sky, 0.055);
        crayon.sun(g, 1.2, 15.4, 0.22, CL.sun, 0.06);
        pageNo(g, 6, S.PW - 1.5);
        rec.paintBase(g, k);
      });
      await finish('cloudR', rec, Rpg);
    }
  }
  // ================= Sea / starry / cream spreads: dedicated layouts per the approved series art spec =================
  {
    const hex = (c) => parseInt(c.slice(1), 16);
    // draw in the rotated frame of a sheet: (ox, oy) = sheet centre, rot = sheet angle
    const onPaper = (g, ox, oy, rot, f) => { g.save(); g.translate(ox, oy); g.rotate(rot * D2R); g.translate(-ox, -oy); f(); g.restore(); };
    const pageNo = (g, n, x) => { g.strokeStyle = P.ink; g.lineWidth = 0.05; g.beginPath(); g.arc(x, 19.7, 0.42, 0, 7); g.stroke(); print(g, String(n), x, 19.85, 0.42, P.ink, 'NunitoP', 'center'); };
    const softTape = (id, sp, cx, cy, rot, extra = {}) => Object.assign({ id, g: 'soft', sp, cx, cy, rot, z: 0.3, floor: 0.006, cell: 0.12, shadowA: 0.3 }, extra);
    // white-border photo + poster (the series pocket); returns its size
    const pocket = (ps, tex, series, cx, cy, rot, o = {}) => { const img = tex.image || tex; const iw = img.width || 1, ih = img.height || 1;
      const ph = 13.2, pw = Math.min(11.4, ph * iw / ih), border = pw * (o.border ?? 0.025);
      ps.push({ id: 'photo', sp: pk(140, () => sprite(pw + 2 * border, ph + 2 * border, (q, w, h) => { q.fillStyle = '#FFFDF8'; rr(q, 0, 0, w, h, 0.1); q.fill(); })), cx, cy, rot, z: 0.08, t: 0.04, lifts: [L.arch(0.03)], side: SIDE.white, mres: 18, cell: 0.4 },
        { id: 'poster', g: 'poster', on: 'photo', w: pw, h: ph, cx, cy, rot, tex, z: 0.2, cell: 0.4, series });
      return { pw, ph, border }; };
    const corners = (ps, pcx, pcy, rot, pw, ph, border, color, hl) => { const cs = 1.05, o = 0.11; // four photo corners that press the photo
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const x = sx * (pw / 2 + border), y = sy * (ph / 2 + border);
        const A = [x + o * sx, y + o * sy], B = [x - cs * sx, y + o * sy], Cc = [x + o * sx, y - cs * sy];
        const x0 = Math.min(A[0], B[0], Cc[0]) - 0.08, x1 = Math.max(A[0], B[0], Cc[0]) + 0.08, y0 = Math.min(A[1], B[1], Cc[1]) - 0.08, y1 = Math.max(A[1], B[1], Cc[1]) + 0.08;
        const sp = pk(220, () => sprite(x1 - x0, y1 - y0, (g) => { g.translate(-x0, -y0);
          g.fillStyle = color; g.lineJoin = 'round'; g.lineWidth = 0.12; g.strokeStyle = color; g.beginPath(); g.moveTo(...A); g.lineTo(...B); g.lineTo(...Cc); g.closePath(); g.fill(); g.stroke();
          const tt = 0.09; g.strokeStyle = hl; g.lineWidth = 0.045; g.lineCap = 'round';
          g.beginPath(); g.moveTo(B[0] + tt * sx * 0.3, B[1] - tt * sy); g.lineTo(Cc[0] - tt * sx, Cc[1] + tt * sy * 0.3); g.stroke(); }));
        const [cx, cy] = childAt(pcx, pcy, rot, (x0 + x1) / 2, (y0 + y1) / 2);
        ps.push({ id: 'corner' + sx + sy, sp, cx, cy, rot, z: 0.145, t: 0.045, side: hex(color), mres: 90, ospace: 0.04, cell: 0.15, press: true });
      } };

    // ---------- Sea spread (pages 7 / 8): a letter written by the cabin window at sunset ----------
    // insert paper = airmail sheet; main stroke = fine pen + round postmarks; handwriting ink walnut #4B3221; postmark ink = book blue
    {
      const SE = { gold: '#E9CBAB', curtain: '#DFBD9E', wheat: '#A97448', red: '#A0371B', cocoa: '#40241B', ink: '#4B3221', paper: '#F7EBDC', post: 'rgba(78,127,176,0.78)' };
      const gullFeather = (len) => item.featherTone(len, ['#B8B1A7', '#E6E1D9', '#FBF9F5'], { shaft: '#F6F2EA' });

      // ---------- left page 7: the letter ----------
      seed(23);
      {
        const OX = 7.25, OY = 10.0, OR = -1.5; // letter 11.9 x 16.4 cm, top-left (1.3, 1.8); writing lines every 1.0 cm from y 4.3
        const CX = 9.5, CY = 14.1, CR = 6;     // sea-chart scrap 6.2 x 4.2
        const ps = [
          { id: 'sheet2', sp: pk(130, () => item.airmailPaper(11.6, 16.0, { lines: false })), cx: 7.85, cy: 10.5, rot: 1.4, z: 0.012, t: 0.014, side: hex(SE.paper), mres: 24, cell: 0.4, noPick: true },
          { id: 'letter', sp: pk(200, () => item.airmailPaper(11.9, 16.4, { y0: 2.5, gap: 1.0 })), cx: OX, cy: OY, rot: OR, z: 0.02, t: 0.016, lifts: [L.corner(1, 1, 0.05, 2.0)], side: hex(SE.paper), mres: 30, ospace: 0.06 },
          { id: 'ticket', sp: pk(320, () => item.ticket(4.8, 2.2, { title: '海鸥号 船票', sub: '港口 → 远方', line: '靠窗 · 傍晚开', no: 'No.0023', band: SE.red, stub: '一位', price: '¥ 6' })), cx: 11.2, cy: 1.6, rot: 8, z: 0.08, t: 0.03, lifts: [L.corner(1, -1, 0.07, 1.3)], side: SIDE.paper, mres: 60 },
          softTape('gauze', pk(220, () => item.gauzeTape(4.6, 1.0, SE.curtain, 0.6)), 0.78, 11.1, 94),
          softTape('redTape', pk(220, () => item.washi(2.1, 0.62, SE.red, 'stripes', 0.62)), 1.35, 2.2, -42),
          { id: 'chart', sp: pk(240, () => item.torn(6.2, 4.2, SE.gold, { pattern: 'grid', ink: 'rgba(169,116,72,0.32)' })), cx: CX, cy: CY, rot: CR, z: 0.05, t: 0.016, lifts: [L.corner(-1, 1, 0.06, 1.4)], side: hex(SE.gold), mres: 40 },
          softTape('chartTape', pk(220, () => item.washi(1.8, 0.6, SE.wheat, 'stripes', 0.7)), 6.75, 11.85, -32),
          { id: 'stampL', sp: pk(320, () => item.seaStamp(1.7, 2.1, 'gull', '8分')), cx: 11.95, cy: 7.25, rot: 5, z: 0.06, t: 0.025, side: SIDE.white, mres: 100, ospace: 0.03, osmooth: 1, cell: 0.15 },
          // tap = existing pick/pop: the seal hops up and lands again
          { id: 'wax', sp: pk(320, () => item.waxSeal(0.82, SE.red)), cx: 12.0, cy: 16.85, rot: 12, z: 0.1, t: 0.05, lifts: [L.dome(0.02, 0.8)], side: hex(SE.red), mres: 120, ospace: 0.03, osmooth: 2, cell: 0.08 },
        ];
        const clip = { type: 'clip', target: 'ticket', cx: 9.8, cy: 2.35, rot: 8, len: 2.4, r: 0.032, kind: 0, radial: 10 };
        const inks = [
          ink([1.6, 3.2, 13.0, 6.2], (g) => onPaper(g, OX, OY, OR, () => { // letter head + title, written on the sheet
            hand(g, '寄给 家里的大家', 2.4, 4.2, 0.46, SE.ink); hand(g, '11.16 · 傍晚', 9.7, 4.2, 0.4, SE.ink);
            print(g, '海上来信', 2.4, 5.2, 1.05, SE.ink, 'ChillRound'); print(g, 'No.6 · 船舱窗边', 7.05, 5.15, 0.36, SE.ink, 'NunitoP');
          })),
          ink([1.6, 6.3, 13.9, 11.7], (g) => { onPaper(g, OX, OY, OR, () => { // the letter body, Koko's voice
            const Y = (i) => 7.2 + i * 1.0, sz = 0.48, X0 = 2.4;
            hand(g, '大家好：', X0, Y(0), sz, SE.ink);
            let x = hand(g, '船开得很慢，海是', X0, Y(1), sz, SE.ink); const a0 = x; x = hand(g, '金色', x, Y(1), sz, SE.ink); const a1 = x; hand(g, '的。', x, Y(1), sz, SE.ink);
            x = hand(g, '海鸥飞过窗口，我', X0, Y(2), sz, SE.ink); const b0 = x; x = hand(g, '挥了挥手', x, Y(2), sz, SE.ink); const b1 = x; hand(g, '。', x, Y(2), sz, SE.ink);
            hand(g, '这封信，等靠岸再寄。', X0, Y(3), sz, SE.ink);
            hand(g, '我很好，不用担心。', X0, Y(4), sz, SE.ink);
            doodle.circle(g, (a0 + a1) / 2, Y(1) - 0.17, (a1 - a0) / 2 + 0.16, 0.36, -0.04, SE.red, 0.03);
            doodle.underline(g, b0, b1, Y(2) + 0.13, SE.wheat, 0.032);
            // little sunset sketch beside the text
            pen.sunset(g, 11.0, 10.65, 0.42, SE.wheat, 0.03); pen.waves(g, 9.7, 11.0, 2.6, SE.ink, 0.026, 0.06, 5);
            pen.gull(g, 10.2, 9.45, 0.24, SE.ink, 0.028); pen.gull(g, 11.55, 9.15, 0.18, SE.ink, 0.026);
          }); item.postmark(g, 11.6, 7.85, 0.55, '海上', '11.16', SE.post); }),
          ink([1.6, 11.6, 8.4, 17.7], (g) => onPaper(g, OX, OY, OR, () => { // P.S. + sign-off
            hand(g, 'P.S.', 2.4, 12.2, 0.46, SE.ink); hand(g, '草帽被风吹歪了，', 2.4, 13.2, 0.46, SE.ink); hand(g, '我用手按住啦。', 2.4, 14.2, 0.46, SE.ink);
            pen.boat(g, 3.6, 15.75, 0.42, SE.ink, SE.gold, 0.028); pen.waves(g, 2.3, 16.05, 3.6, SE.ink, 0.026, 0.06, 6); pen.gull(g, 5.2, 15.0, 0.2, SE.ink, 0.026);
            hand(g, '—— 在海鸥号上的 Koko', 2.4, 17.2, 0.42, SE.ink);
          })),
          ink([6.0, 11.4, 13.0, 16.6], (g) => onPaper(g, CX, CY, CR, () => { // sea chart: coast, island, dotted route, compass
            pen.line(g, [[6.55, 12.3], [6.95, 12.9], [6.8, 13.6], [7.25, 14.2], [7.05, 14.9], [7.4, 15.6], [7.3, 16.1]], 0.03, SE.wheat);
            pen.line(g, [[9.6, 12.65], [10.05, 12.45], [10.5, 12.7], [10.35, 13.1], [9.85, 13.2], [9.6, 12.65]], 0.028, SE.wheat);
            doodle.dotted(g, [7.5, 15.2], [8.6, 14.9], [9.2, 13.3], [11.6, 12.85], SE.red, 0.035);
            g.fillStyle = SE.red; g.beginPath(); g.arc(7.5, 15.2, 0.09, 0, 7); g.fill();
            pen.boat(g, 9.45, 13.95, 0.32, SE.ink, SE.gold, 0.024);
            hand(g, '港口', 7.55, 15.75, 0.32, SE.ink); hand(g, '远方', 11.2, 12.55, 0.32, SE.ink);
            pen.compass(g, 11.35, 14.85, 0.5, SE.ink, SE.red, 0.024); print(g, 'N', 11.35, 14.22, 0.22, SE.ink, 'NunitoP', 'center');
          })),
        ];
        const rec = PATCH.buildPage('seaL', { patches: ps, wires: [clip], inks, withK });
        const Lpg = canvasLayer((g, k) => {
          item.glow(g, S.PW, 0, 6);
          pen.gull(g, 3.2, 1.0, 0.26, SE.ink, 0.03); pen.gull(g, 4.15, 0.7, 0.18, SE.ink, 0.028); pen.gull(g, 5.3, 1.15, 0.22, SE.ink, 0.028);
          pageNo(g, 7, 1.5);
          rec.paintBase(g, k);
        });
        await finish('seaL', rec, Lpg);
      }

      // ---------- right page 8: the poster slides out of an opened airmail envelope ----------
      seed(24);
      {
        const cx = S.PW / 2, cy = 9.4, rot = 3;
        const ps = [];
        const [ex, ey] = childAt(7.4, 11.1, -6, 0, -7.0 * 0.45 / 2); // envelope body centre (7.4, 11.1); sprite also holds the open flap above
        ps.push({ id: 'envelope', sp: pk(150, () => item.seaEnvelope(10.8, 7.0)), cx: ex, cy: ey, rot: -6, z: 0.03, t: 0.02, side: hex(SE.curtain), mres: 30, cell: 0.35, noPick: true });
        const { pw, ph, border } = pocket(ps, sea, 'sea', cx, cy, rot);
        corners(ps, cx, cy, rot, pw, ph, border, SE.wheat, 'rgba(255,236,205,0.85)');
        const bottle = { cx: 1.9, cy: 15.65, rot: -20, w: 2.6, h: 1.2 };
        ps.push(
          { id: 'airLabel', sp: pk(320, () => item.airLabel(2.8, 1.0)), cx: 1.9, cy: 1.7, rot: -6, z: 0.05, t: 0.02, side: hex(SE.red), mres: 60, ospace: 0.04 },
          { id: 'chartR', sp: pk(240, () => item.torn(2.7, 3.4, SE.gold, { pattern: 'grid', ink: 'rgba(169,116,72,0.32)' })), cx: 1.6, cy: 5.35, rot: -8, z: 0.03, t: 0.016, lifts: [L.corner(1, 1, 0.05, 1.0)], side: hex(SE.gold), mres: 50 },
          softTape('chartRTape', pk(220, () => item.gauzeTape(1.7, 0.55, SE.curtain, 0.62)), 1.45, 3.75, 6),
          { id: 'stampGull', sp: pk(320, () => item.seaStamp(1.8, 2.2, 'gull', '10分')), cx: 13.0, cy: 2.2, rot: 6, z: 0.06, t: 0.025, side: SIDE.white, mres: 100, ospace: 0.03, osmooth: 1, cell: 0.15 },
          { id: 'stampBoat', sp: pk(320, () => item.seaStamp(1.8, 2.2, 'boat', '20分')), cx: 12.95, cy: 4.9, rot: -4, z: 0.065, t: 0.025, side: SIDE.white, mres: 100, ospace: 0.03, osmooth: 1, cell: 0.15 },
          softTape('envTapeL', pk(220, () => item.gauzeTape(1.9, 0.6, SE.curtain, 0.62)), 1.75, 8.45, -48),
          softTape('envTape', pk(220, () => item.gauzeTape(2.0, 0.62, SE.curtain, 0.62)), 12.65, 7.35, 40),
          { id: 'feather', sp: pk(300, () => gullFeather(3.4)), cx: 12.95, cy: 11.3, rot: -15, z: 0.05, t: 0.014, lifts: [L.tilt(0.02, 0.03)], side: 0xE6E1D9, mres: 90, ospace: 0.025, osmooth: 1, cell: 0.1 },
          { id: 'feather2', sp: pk(300, () => gullFeather(2.4)), cx: 1.2, cy: 11.4, rot: 14, z: 0.05, t: 0.012, lifts: [L.tilt(-0.015, 0.025)], side: 0xE6E1D9, mres: 90, ospace: 0.025, osmooth: 1, cell: 0.1 },
          { id: 'stub', sp: pk(320, () => item.ticket(3.0, 1.5, { title: '海鸥号 回程', sub: '远方 → 家', line: '靠岸那天', no: 'No.0024', band: SE.red, stub: '一位', price: '¥ 6' })), cx: 13.1, cy: 15.35, rot: -9, z: 0.06, t: 0.03, lifts: [L.corner(-1, 1, 0.06, 1.0)], side: SIDE.paper, mres: 70 },
          { id: 'bottle', sp: pk(320, () => item.bottleNote(bottle.w, bottle.h)), cx: bottle.cx, cy: bottle.cy, rot: bottle.rot, z: 0.07, t: 0.05, lifts: [L.edge('t', 0.02, 0.5)], side: hex(SE.paper), mres: 80, ospace: 0.03, osmooth: 1, cell: 0.1 },
        );
        // twine tail from the scroll's band, loose loop on the page
        const bandAt = (lx, ly) => childAt(bottle.cx, bottle.cy, bottle.rot, lx, ly);
        const twine = { type: 'twine', kind: 1, r: 0.026, radial: 8, pts: (topAt, byId, stackAt) => {
          const xy = [bandAt(0.2, -0.38), bandAt(0.3, -0.75), bandAt(0.65, -1.05), bandAt(1.1, -0.95), bandAt(1.45, -1.25), bandAt(1.7, -1.6)];
          return xy.map(([x, y], i) => [x, y, stackAt(x, y) + (i === 0 ? 0.02 : 0.03)]); } };
        const inks = [
          ink([11.6, 2.4, 14.8, 5.2], (g) => item.postmark(g, 12.35, 3.75, 0.6, '海上', '11.16', SE.post)),
          ink([0.2, 3.4, 3.4, 7.3], (g) => onPaper(g, 1.6, 5.35, -8, () => {
            pen.line(g, [[0.5, 4.0], [0.85, 4.5], [0.7, 5.1], [1.05, 5.6], [0.9, 6.3]], 0.028, SE.wheat);
            doodle.dotted(g, [1.25, 6.45], [2.2, 6.1], [1.6, 4.9], [2.55, 4.3], SE.red, 0.032); pen.compass(g, 2.35, 6.3, 0.32, SE.ink, SE.red, 0.02);
          })),
          ink([3.4, 0.15, 11.5, 2.3], (g) => { // route across the top margin: from the window to home
            doodle.dotted(g, [3.9, 1.75], [5.6, 0.6], [8.4, 2.0], [10.9, 0.75], SE.red, 0.035);
            pen.gull(g, 6.0, 1.45, 0.24, SE.ink, 0.03); pen.gull(g, 6.75, 1.15, 0.17, SE.ink, 0.028); pen.gull(g, 9.6, 1.75, 0.2, SE.ink, 0.028);
            hand(g, '家', 10.95, 1.55, 0.36, SE.ink); }),
          ink([10.6, 16.4, 14.8, 18.6], (g) => item.postmark(g, 11.8, 17.5, 0.6, '海鸥号', '11.16', SE.post)),
        ];
        const rec = PATCH.buildPage('seaR', { patches: ps, wires: [twine], inks, withK });
        const Rpg = canvasLayer((g, k) => {
          item.glow(g, S.PW, 0, 6);
          let x = hand(g, '海鸥会替我把信送', 3.6, 18.3, 0.5, SE.ink); const u0 = x; x = hand(g, '回家', x, 18.3, 0.5, SE.ink); hand(g, '。', x, 18.3, 0.5, SE.ink);
          doodle.underline(g, u0 - 0.02, x + 0.02, 18.45, SE.red, 0.032);
          pen.waves(g, 0.5, 17.1, 2.9, SE.ink, 0.026, 0.06, 5); pen.waves(g, 0.9, 17.45, 2.2, SE.wheat, 0.026, 0.05, 4);
          pageNo(g, 8, S.PW - 1.5);
          rec.paintBase(g, k);
        });
        await finish('seaR', rec, Rpg);
      }
    }

    // ---------- Starry spread (pages 9 / 10): round things collected by day, drawn as stars before bed (still a warm page) ----------
    // insert paper = fine-tooth pencil paper #FBEBD2 + specimen card #FCE7BF; main stroke = coloured pencil 45 deg hatching; handwriting ink #7B4C2D
    {
      const ST = { paper: '#FBEBD2', card: '#FCE7BF', grid: '#E4A068', lid: '#F8DCB4', orange: '#EC711C', blue: '#3E7DB1', purple: '#AA7AA9', red: '#DC5538', yellow: '#FACA55', green: '#6B8C54', ink: '#7B4C2D' };
      // tap = existing pick/pop: a loose button hops like a marble
      const btn = (id, r, color, cx, cy, rot, z, o = {}) => ({ id, sp: pk(320, () => item.button(r, color, o)), cx, cy, rot, z, t: 0.03, lifts: [L.dome(0.012, r)], side: hex(color), mres: 100, ospace: 0.025, osmooth: 2, cell: 0.1 });
      const marble = (id, r, color, cx, cy, z) => ({ id, sp: pk(320, () => item.marble(r, color)), cx, cy, rot: 0, z, t: 0.025, side: SIDE.white, mres: 70, ospace: 0.03, osmooth: 1, cell: 0.12 });
      const starS = (id, r, c1, c2, cx, cy, rot, z) => ({ id, sp: pk(320, () => item.starSticker(r, c1, c2)), cx, cy, rot, z, t: 0.025, lifts: [L.edge('t', 0.04, 0.6)], side: SIDE.white, mres: 70, ospace: 0.03, osmooth: 1, cell: 0.12 });
      const shav = (id, w, h, paint, cx, cy, rot) => ({ id, g: 'soft', sp: pk(260, () => item.shavings(w, h, paint)), cx, cy, rot, z: 0.2, floor: 0.02, cell: 0.08, shadowA: 0.35 });

      // ---------- left page 9: pencil sheet with the diary, specimen card, receipt ----------
      seed(25);
      {
        const SX = 5.9, SY = 6.0, SR = -1.2;      // pencil sheet 9.6 x 6.2
        const KX = 5.8, KY = 12.8, KR = -2;       // specimen card 7.6 x 7.6, grid from local (-3.3, -2.8), cells 2.2 x 2.067
        const cell = (i, j, dy = 0.12) => childAt(KX, KY, KR, -2.2 + 2.2 * i, -1.767 + 2.067 * j + dy);
        const ps = [
          { id: 'sheet', sp: pk(200, () => item.pencilPaper(9.6, 6.2, ST.paper, { grain: 0.12 })), cx: SX, cy: SY, rot: SR, z: 0.02, t: 0.016, lifts: [L.corner(1, 1, 0.05, 1.6)], side: hex(ST.paper), mres: 36 },
          softTape('tapeA', pk(220, () => item.washi(1.9, 0.6, ST.orange, 'stripes', 0.55)), 1.35, 3.05, -38),
          softTape('tapeB', pk(220, () => item.washi(1.7, 0.6, ST.blue, 'dots', 0.45)), 10.45, 3.2, 34),
          { id: 'card', sp: pk(200, () => item.specimenCard(7.6, 7.6, { color: ST.card, line: ST.grid, ink: ST.ink, title: '圆圆收藏', note: '7 颗', grid: [0.5, 1.0, 6.6, 6.2] })), cx: KX, cy: KY, rot: KR, z: 0.03, t: 0.018, lifts: [L.corner(-1, 1, 0.05, 1.2)], side: hex(ST.card), mres: 36 },
          btn('kBlue', 0.55, ST.blue, ...cell(0, 0), 8, 0.08, { thread: '#FCE7BF' }),
          marble('kGreen', 0.52, ST.green, ...cell(1, 0), 0.08),
          btn('kRed', 0.55, ST.red, ...cell(2, 0), -12, 0.08, { holes: 2, thread: '#FCE7BF' }),
          { id: 'kOrange', sp: pk(300, () => item.orangeSticker(0.45)), ...(([x, y]) => ({ cx: x, cy: y }))(cell(0, 1, 0.0)), rot: -6, z: 0.08, t: 0.03, side: SIDE.white, mres: 100, ospace: 0.03, cell: 0.08 },
          btn('kYellow', 0.55, ST.yellow, ...cell(2, 1), 20, 0.08, { thread: '#FCE7BF' }),
          marble('kBlueM', 0.52, ST.blue, ...cell(0, 2), 0.08),
          starS('starL1', 0.62, ST.yellow, ST.orange, 1.3, 1.6, -8, 0.06),
          starS('starL2', 0.5, ST.blue, ST.purple, 13.85, 7.6, 12, 0.06),
          btn('btnPurple', 0.6, ST.purple, 12.0, 2.4, 10, 0.06),
          btn('btnYellow', 0.5, ST.yellow, 13.3, 4.5, -20, 0.06, { holes: 2 }),
          btn('btnRed', 0.55, ST.red, 11.75, 16.95, 15, 0.06),
          { id: 'receipt', sp: pk(300, () => item.receipt(3.2, 4.8, ['今天捡到', ['纽扣', '×3'], ['弹珠', '×2'], ['硬币', '×1'], ['小橘子', '×1']], ['合计', '7 颗'])), cx: 12.2, cy: 10.8, rot: 5, z: 0.05, t: 0.02, lifts: [L.corner(1, 1, 0.05, 1.2)], side: SIDE.white, mres: 60 },
          softTape('tapeSea', pk(240, () => item.inkTape(3.0, 0.72, '蓝的是海', '#CFE0EE', ST.ink)), 12.0, 14.55, -6),
          softTape('tapeSun', pk(240, () => item.inkTape(3.4, 0.72, '橘的是太阳', '#F7CDA6', ST.ink)), 11.85, 15.5, 3),
          shav('shavA', 1.5, 1.0, ST.orange, 6.3, 17.95, 10), shav('shavB', 1.2, 0.8, ST.blue, 7.75, 18.4, -25),
          { id: 'pencil2', sp: pk(320, () => item.pencilStub(4.0, 0.34, ST.orange, { label: 'KOKO' })), cx: 0.95, cy: 12.7, rot: 84, z: 0.06, t: 0.034, side: hex(ST.orange), mres: 80, ospace: 0.03, cell: 0.08 },
          { id: 'pencil', sp: pk(320, () => item.pencilStub(4.2, 0.36, ST.blue, { label: 'KOKO' })), cx: 3.0, cy: 18.35, rot: -6, z: 0.06, t: 0.036, side: hex(ST.blue), mres: 80, ospace: 0.03, cell: 0.08 },
        ];
        const clip = { type: 'clip', target: 'receipt', cx: 11.0, cy: 8.3, rot: 5, len: 2.4, r: 0.032, kind: 0, radial: 10 };
        const inks = [
          ink([0.9, 2.6, 10.9, 9.4], (g) => onPaper(g, SX, SY, SR, () => { // title + diary written on the pencil sheet, a little colour test on the right
            print(g, '星夜彩铅', 1.8, 4.75, 1.05, ST.ink, 'ChillRound');
            print(g, 'No.9 · 睡前的圆圆收藏', 1.85, 5.42, 0.36, ST.ink, 'NunitoP');
            const Y = (i) => 6.4 + i * 0.86, sz = 0.48, X0 = 1.8;
            let x = hand(g, '今天捡到', X0, Y(0), sz, ST.ink); const c0 = x; x = hand(g, '七颗', x, Y(0), sz, ST.ink); const c1 = x; hand(g, '圆圆的东西。', x, Y(0), sz, ST.ink);
            pencil.round(g, (c0 + c1) / 2, Y(0) - 0.17, (c1 - c0) / 2 + 0.03, ST.orange, [], { w: 0.03, ry: 0.36 });
            x = hand(g, '蓝的是海', X0, Y(1), sz, ST.ink); const s1 = x; x = hand(g, '，', x, Y(1), sz, ST.ink); const o0 = x; x = hand(g, '橘的是太阳', x, Y(1), sz, ST.ink); const o1 = x; hand(g, '。', x, Y(1), sz, ST.ink);
            pencil.curve(g, [X0, Y(1) + 0.14], [X0 + 0.6, Y(1) + 0.2], [s1 - 0.6, Y(1) + 0.08], [s1, Y(1) + 0.15], 0.03, ST.blue);
            pencil.curve(g, [o0, Y(1) + 0.14], [o0 + 0.6, Y(1) + 0.2], [o1 - 0.6, Y(1) + 0.08], [o1, Y(1) + 0.15], 0.03, ST.orange);
            x = hand(g, '睡前把它们画成星星。', X0, Y(2), sz, ST.ink); pencil.star(g, x + 0.35, Y(2) - 0.2, 0.22, ST.ink, [ST.yellow]);
            pencil.round(g, 8.15, 4.35, 0.45, ST.ink, [ST.blue, ST.purple]);
            pencil.curve(g, [8.75, 4.3], [9.0, 4.05], [9.15, 4.05], [9.3, 4.3], 0.026, ST.ink); pencil.line(g, [[9.18, 4.18], [9.3, 4.3], [9.14, 4.36]], 0.026, ST.ink);
            pencil.star(g, 9.95, 4.4, 0.58, ST.ink, [ST.yellow, ST.orange]);
            print(g, '试色', 7.7, 6.95, 0.3, ST.ink, 'NunitoP');
            [ST.blue, ST.purple, ST.red, ST.yellow, ST.green].forEach((c, i) => { const x0 = 7.7 + i * 0.52; pencil.hatch(g, (q) => { q.beginPath(); q.rect(x0, 7.25, 0.42, 0.42); }, [x0, 7.25, 0.42, 0.42], c, { gap: 0.04, alpha: 1 }); });
          })),
          ink([1.6, 8.6, 10.1, 17.0], (g) => onPaper(g, KX, KY, KR, () => { // pencil things in the empty cells: a big star, the coin rubbing, two small stars
            const [ax, ay] = [KX, KY + 0.3], [bx, by] = [KX, KY + 2.37], [cx2, cy2] = [KX + 2.2, KY + 2.37];
            pencil.star(g, ax, ay + 0.1, 0.72, ST.ink, [ST.yellow, ST.orange]);
            doodle.rubbing(g, bx, by + 0.1, 0.6, ST.ink);
            pencil.star(g, cx2 - 0.3, cy2 + 0.25, 0.42, ST.ink, [ST.blue, ST.purple], { rot: 0.2 }); pencil.star(g, cx2 + 0.45, cy2 - 0.25, 0.26, ST.ink, [ST.red]);
          })),
        ];
        const rec = PATCH.buildPage('starryL', { patches: ps, wires: [clip], inks, withK });
        const Lpg = canvasLayer((g, k) => {
          // dotted constellation linking the loose buttons and pencil stars
          pencil.dots(g, [[8.8, 1.0], [12.0, 2.4]], ST.ink, { trim: 0.25 }); pencil.dots(g, [[12.0, 2.4], [13.3, 4.5]], ST.ink, { trim: 0.62 });
          pencil.dots(g, [[13.3, 4.5], [12.4, 6.5]], ST.ink, { trim: 0.5 }); pencil.dots(g, [[12.4, 6.5], [13.85, 7.6]], ST.ink, { trim: 0.3 });
          pencil.star(g, 8.8, 1.0, 0.24, ST.ink, [ST.yellow]); pencil.star(g, 12.4, 6.5, 0.28, ST.ink, [ST.orange, ST.yellow]);
          pencil.dots(g, [[9.7, 18.5], [11.75, 16.95], [13.45, 18.25]], ST.ink, { trim: 0.0, step: 0.2 });
          pencil.star(g, 9.7, 18.5, 0.26, ST.ink, [ST.purple]); pencil.star(g, 13.45, 18.25, 0.3, ST.ink, [ST.yellow, ST.orange]);
          for (const [x, y, s] of [[3.6, 1.1, 0.14], [5.6, 0.75, 0.1], [6.9, 1.6, 0.12], [0.6, 8.0, 0.12], [0.75, 15.8, 0.13], [10.6, 7.6, 0.1], [13.9, 13.0, 0.12]]) pencil.twinkle(g, x, y, s, ST.ink, 0.022);
          pageNo(g, 9, 1.5);
          rec.paintBase(g, k);
        });
        await finish('starryL', rec, Lpg);
      }

      // ---------- right page 10: the poster sits in a shallow box lid, orange photo corners ----------
      seed(26);
      {
        const cx = S.PW / 2, cy = 9.35, rot = -1.5;
        const tag = { cx: 11.8, cy: 18.0, rot: 8 };
        const ps = [{ id: 'lid', sp: pk(130, () => item.boxLid(11.4, 14.6, ST.lid)), cx, cy: 9.4, rot: 0, z: 0.02, t: 0.1, side: 0xE6C291, mres: 24, cell: 0.4, noPick: true }];
        const { pw, ph, border } = pocket(ps, starry, 'starry', cx, cy, rot);
        corners(ps, cx, cy, rot, pw, ph, border, ST.orange, 'rgba(255,214,170,0.85)');
        ps.push(
          { id: 'orangeS', sp: pk(300, () => item.orangeSticker(0.6)), cx: 1.05, cy: 2.25, rot: -8, z: 0.08, t: 0.045, lifts: [L.edge('l', 0.05, 0.7)], side: SIDE.white, mres: 80, ospace: 0.04, cell: 0.12 },
          starS('starR1', 0.62, ST.red, ST.yellow, 13.75, 1.55, 10, 0.06),
          starS('starR2', 0.5, ST.orange, ST.yellow, 0.95, 19.25, -12, 0.06),
          marble('mGreen', 0.6, ST.green, 13.85, 7.65, 0.06),
          marble('mBlue', 0.6, ST.blue, 0.85, 13.25, 0.06),
          btn('btnBlue', 0.55, ST.blue, 0.9, 9.6, -10, 0.06),
          shav('shavC', 1.3, 0.9, ST.purple, 0.95, 16.6, 30),
          { id: 'tag', sp: pk(300, () => item.tag(2.0, 2.9, ['第七颗', '小橘子'])), cx: tag.cx, cy: tag.cy, rot: tag.rot, z: 0.06, t: 0.03, lifts: [L.edge('b', 0.04, 1.0)], side: SIDE.kraft, mres: 60 },
        );
        // cotton string tail from the tag hole, lying loose on the page
        const twine = { type: 'twine', kind: 1, r: 0.024, radial: 8, pts: (topAt, byId, stackAt) => {
          const T = byId.tag; const [hx, hy] = childAt(T.cx, T.cy, T.rot, 0, -T.hh + 0.55);
          const xy = [[hx, hy], [hx + 0.5, hy - 0.35], [hx + 1.3, hy - 0.2], [hx + 1.9, hy + 0.35], [hx + 2.15, hy + 1.1]];
          return xy.map(([x, y], i) => [x, y, i === 0 ? T.z + T.t * 0.5 : stackAt(x, y) + 0.03]); } };
        const rec = PATCH.buildPage('starryR', { patches: ps, wires: [twine], withK, inks: [] });
        const Rpg = canvasLayer((g, k) => {
          let x = hand(g, '睡前，把', 1.6, 18.4, 0.5, ST.ink); const u0 = x; x = hand(g, '七颗星星', x, 18.4, 0.5, ST.ink); const u1 = x; hand(g, '收进盒子里。', x, 18.4, 0.5, ST.ink);
          pencil.curve(g, [u0, 18.56], [u0 + 0.5, 18.62], [u1 - 0.5, 18.5], [u1 + 0.05, 18.57], 0.03, ST.orange);
          // constellation across the top margin: orange sticker to the star sticker
          pencil.dots(g, [[1.05, 2.25], [3.4, 1.0], [6.2, 1.5], [9.3, 0.8], [13.75, 1.55]], ST.ink, { trim: 0.0 });
          for (const [px, py, r, f] of [[3.4, 1.0, 0.26, [ST.yellow]], [6.2, 1.5, 0.2, [ST.blue]], [9.3, 0.8, 0.28, [ST.orange, ST.yellow]]]) pencil.star(g, px, py, r, ST.ink, f);
          for (const [px, py, s] of [[0.7, 5.0, 0.13], [0.9, 7.1, 0.1], [14.05, 11.2, 0.13], [13.9, 13.4, 0.1], [14.1, 4.4, 0.11], [11.2, 19.6, 0.1]]) pencil.twinkle(g, px, py, s, ST.ink, 0.022);
          pageNo(g, 10, S.PW - 1.5);
          rec.paintBase(g, k);
        });
        await finish('starryR', rec, Rpg);
      }
    }
    // ---------- Cream spread (pages 11 / 12): a page from the studio sketchbook ----------
    // insert paper = coarse sketch paper + a kraft drawing board; main stroke = charcoal; handwriting ink #2F2A28
    {
      const CR = { cream: '#F4E4C1', wood: '#DBA773', orange: '#EA7824', moss: '#807B4B', red: '#DC6833', ink: '#2F2A28', paper: '#F6EAD0' };
      const btn = (id, r, color, cx, cy, rot, z, o = {}) => ({ id, sp: pk(320, () => item.button(r, color, o)), cx, cy, rot, z, t: 0.03, lifts: [L.dome(0.012, r)], side: hex(color), mres: 140, ospace: 0.025, osmooth: 2, cell: 0.08 });
      const crumbs = (id, w, h, cx, cy, rot, n) => ({ id, g: 'soft', sp: pk(260, () => item.crumbs(w, h, n)), cx, cy, rot, z: 0.2, floor: 0.02, cell: 0.08, shadowA: 0.3 });

      // ---------- left page 11: peg rail, sketch sheet, tools ----------
      seed(27);
      {
        const SX = 6.1, SY = 10.8, SR = -1.5;          // sketch sheet 9.4 x 7.2, top-left (1.4, 7.2)
        const pegs = [7.85, 10.25, 12.65], railY = 1.65;
        const cards = [{ cx: 7.85, cy: 3.9, rot: -4 }, { cx: 10.25, cy: 4.2, rot: 3 }, { cx: 12.65, cy: 3.9, rot: -2 }];
        const ps = [
          { id: 'rail', sp: pk(300, () => item.pegRail(7.6, 0.9, pegs.map((x) => x - 10.2 + 3.8))), cx: 10.2, cy: railY, rot: 0, z: 0.03, t: 0.04, side: hex(CR.wood), mres: 50, ospace: 0.04, noPick: true },
          // tap = existing pick/pop with its ±5° tilt: the hanging card sways a little
          ...cards.map((c, i) => ({ id: 'card' + i, sp: pk(300, () => item.tag(1.9, 2.6, [])), cx: c.cx, cy: c.cy, rot: c.rot, z: 0.05 + i * 0.001, t: 0.03, lifts: [L.edge('b', 0.04, 1.0)], side: SIDE.kraft, mres: 60 })),
          btn('btn0', 0.55, CR.moss, ...childAt(cards[0].cx, cards[0].cy, cards[0].rot, 0, 0.35), -4, 0.09, { thread: '#F4E4C1' }),
          { id: 'orange1', sp: pk(300, () => item.orangeSticker(0.48)), ...(([x, y]) => ({ cx: x, cy: y }))(childAt(cards[1].cx, cards[1].cy, cards[1].rot, 0, 0.3)), rot: 6, z: 0.09, t: 0.04, side: SIDE.white, mres: 90, ospace: 0.04, cell: 0.1 },
          btn('btn2', 0.55, CR.red, ...childAt(cards[2].cx, cards[2].cy, cards[2].rot, 0, 0.35), 10, 0.09, { holes: 2, thread: '#F4E4C1' }),
          { id: 'sketch', sp: pk(220, () => item.roughSheet(9.4, 7.2, CR.paper, { grain: 0.14 })), cx: SX, cy: SY, rot: SR, z: 0.02, t: 0.018, lifts: [L.corner(1, 1, 0.05, 1.6)], side: hex(CR.paper), mres: 36 },
          { id: 'thumb', sp: pk(260, () => item.roughSheet(3.0, 2.3, CR.paper, { grain: 0.14 })), cx: 12.35, cy: 6.75, rot: 6, z: 0.025, t: 0.016, lifts: [L.corner(1, -1, 0.04, 0.9)], side: hex(CR.paper), mres: 60 },
          softTape('tapeA', pk(220, () => item.washi(2.1, 0.66, CR.cream, 'grid', 0.92)), 1.75, 7.45, -36),
          softTape('tapeB', pk(220, () => item.washi(2.1, 0.66, CR.cream, 'grid', 0.92)), 10.45, 7.1, 32),
          softTape('tapeC', pk(220, () => item.washi(1.6, 0.6, CR.cream, 'grid', 0.92)), 12.2, 5.65, -6),
          { id: 'swatch', sp: pk(320, () => item.swatchStrip(1.4, 6.6, [CR.cream, CR.wood, CR.orange, CR.moss, CR.red])), cx: 12.7, cy: 11.3, rot: 3, z: 0.04, t: 0.025, lifts: [L.corner(1, 1, 0.05, 1.0)], side: SIDE.paper, mres: 60 },
          { id: 'eraser', sp: pk(320, () => item.eraser(2.4, 1.2)), cx: 11.8, cy: 16.35, rot: -12, z: 0.06, t: 0.06, side: 0xF6F2EA, mres: 70, ospace: 0.03, cell: 0.1 },
          crumbs('crumbA', 1.6, 0.8, 10.25, 17.9, 0, 7), crumbs('crumbB', 1.0, 0.6, 8.4, 15.15, 20, 4), crumbs('crumbC', 0.9, 0.5, 3.4, 14.55, -10, 3),
          { id: 'charcoal', sp: pk(320, () => item.charcoalStick(2.5, 0.55)), cx: 12.1, cy: 18.45, rot: 8, z: 0.06, t: 0.055, side: 0x2B2725, mres: 80, ospace: 0.03, cell: 0.08 },
          btn('btnLoose', 0.42, CR.orange, 0.85, 13.6, 18, 0.06, { holes: 2 }),
        ];
        // hanging twine: from each peg down to the card's punched hole
        const hang = (i) => ({ type: 'twine', kind: 1, r: 0.024, radial: 8, pts: (topAt, byId, stackAt) => {
          const C = byId['card' + i]; const [hx, hy] = childAt(C.cx, C.cy, C.rot, 0, -C.hh + 0.55); const px = pegs[i], top = topAt(C, hx, hy);
          return [[px, railY + 0.05, 0.1], [px + (hx - px) * 0.3, railY + 0.45, 0.085], [px + (hx - px) * 0.7, hy - 0.45, top + 0.05], [hx, hy - 0.08, top + 0.03], [hx, hy, C.z + C.t * 0.5]]; } });
        const inks = [
          ink([1.4, 6.9, 11.0, 14.7], (g) => onPaper(g, SX, SY, SR, () => { // pencil lay-in, charcoal outline, eraser rubs
            const lp = { alpha: 0.35 };
            charcoal.line(g, [[2.2, 8.3], [9.8, 8.15]], 0.025, CR.ink, lp); charcoal.line(g, [[2.4, 8.05], [2.4, 8.55]], 0.02, CR.ink, lp);
            charcoal.line(g, [[2.1, 8.4], [9.9, 8.4]], 0.07, CR.ink); for (const x of [3.6, 6.1, 8.6]) charcoal.ring(g, x, 8.4, 0.16, 0.16, 0.05, CR.ink);
            charcoal.line(g, [[3.6, 8.55], [3.65, 9.5]], 0.03, CR.ink); charcoal.ring(g, 3.65, 10.4, 0.85, 0.85, 0.06, CR.ink); charcoal.ring(g, 3.65, 10.4, 0.62, 0.62, 0.035, CR.ink, { alpha: 0.6 });
            for (const [dx, dy] of [[-0.2, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.2, 0.2]]) charcoal.ring(g, 3.65 + dx, 10.4 + dy, 0.07, 0.07, 0.04, CR.ink);
            charcoal.line(g, [[6.1, 8.55], [6.05, 10.0]], 0.03, CR.ink); charcoal.ring(g, 6.05, 10.75, 0.72, 0.68, 0.06, CR.ink);
            charcoal.curve(g, [6.15, 10.05], [6.5, 9.6], [6.95, 9.85], [6.6, 10.15], 0.04, CR.ink); for (let i = 0; i < 4; i++) charcoal.ring(g, 6.05, 10.75, 0.6 - i * 0.09, 0.56 - i * 0.09, 0.022, CR.ink, { start: 0.15, turn: 0.42, alpha: 0.5 });
            charcoal.line(g, [[8.6, 8.55], [8.62, 9.3]], 0.03, CR.ink); charcoal.ring(g, 8.62, 10.05, 0.7, 0.7, 0.06, CR.ink);
            for (const dx of [-0.18, 0.18]) charcoal.ring(g, 8.62 + dx, 10.05, 0.08, 0.08, 0.04, CR.ink);
            charcoal.ring(g, 5.0, 12.6, 0.55, 0.55, 0.03, CR.ink, { alpha: 0.35 }); charcoal.erase(g, 4.3, 12.25, 1.5, 0.7);
            charcoal.ring(g, 8.2, 12.4, 0.5, 0.48, 0.028, CR.ink, { alpha: 0.32 }); charcoal.erase(g, 7.6, 12.0, 1.3, 0.75);
            charcoal.cloud(g, 2.9, 12.85, 0.85, CR.ink, 0.035); charcoal.swirl(g, 9.6, 13.3, 0.32, CR.ink, 0.035);
            print(g, 'no.10 · 纽扣三颗 + 小橘子', 5.2, 13.75, 0.3, CR.ink, 'NunitoP');
          })),
          ink([10.7, 5.4, 14.0, 8.1], (g) => onPaper(g, 12.35, 6.75, 6, () => { charcoal.ring(g, 12.0, 6.9, 0.55, 0.52, 0.045, CR.ink); charcoal.curve(g, [12.1, 6.35], [12.35, 6.0], [12.7, 6.15], [12.45, 6.4], 0.035, CR.ink); for (let i = 0; i < 3; i++) charcoal.ring(g, 12.0, 6.9, 0.45 - i * 0.08, 0.42 - i * 0.08, 0.02, CR.ink, { start: 0.15, turn: 0.42, alpha: 0.5 }); hand(g, '小橘子', 12.75, 7.55, 0.3, CR.ink); })),
          ink([3.6, 17.6, 7.6, 20.2], (g) => place(g, item.inkStamp('速写', 'No.10'), 5.6, 18.9, -10, { noShadow: true, alpha: 0.9 })),
        ];
        const rec = PATCH.buildPage('creamL', { patches: ps, wires: [hang(0), hang(1), hang(2)], inks, withK });
        const Lpg = canvasLayer((g, k) => {
          print(g, '奶油素描', 1.2, 4.95, 1.05, CR.ink, 'ChillRound');
          print(g, '速写 No.10 · 画室', 1.25, 5.62, 0.36, CR.ink, 'NunitoP');
          charcoal.cloud(g, 2.6, 1.7, 0.95, CR.ink, 0.04); charcoal.swirl(g, 4.75, 2.45, 0.3, CR.ink, 0.035); charcoal.cloud(g, 5.6, 3.6, 0.55, CR.ink, 0.035);
          charcoal.swirl(g, 0.9, 6.3, 0.22, CR.ink, 0.03);
          const Y = (i) => 15.75 + i * 0.9, sz = 0.48, X0 = 1.6;
          hand(g, '纽扣挂好了，一颗一颗。', X0, Y(0), sz, CR.ink);
          let x = hand(g, '用铅笔先画，', X0, Y(1), sz, CR.ink); const a0 = x; x = hand(g, '不怕', x, Y(1), sz, CR.ink); const a1 = x; hand(g, '画错。', x, Y(1), sz, CR.ink);
          x = hand(g, '奶油色的下午，', X0, Y(2), sz, CR.ink); const b0 = x; x = hand(g, '慢慢的', x, Y(2), sz, CR.ink); const b1 = x; hand(g, '。', x, Y(2), sz, CR.ink);
          charcoal.ring(g, (a0 + a1) / 2, Y(1) - 0.17, (a1 - a0) / 2 + 0.06, 0.34, 0.04, CR.red, { alpha: 0.8 });
          charcoal.curve(g, [b0, Y(2) + 0.14], [b0 + 0.5, Y(2) + 0.2], [b1 - 0.5, Y(2) + 0.08], [b1 + 0.05, Y(2) + 0.15], 0.045, CR.orange, { alpha: 0.85 });
          pageNo(g, 11, 1.5);
          rec.paintBase(g, k);
        });
        await finish('creamL', rec, Lpg);
      }

      // ---------- right page 12: poster clipped to a kraft drawing board (no photo corners on this page) ----------
      seed(28);
      {
        const cx = S.PW / 2, cy = 9.4, rot = -0.5;
        const ps = [{ id: 'board', sp: pk(130, () => item.board(11.4, 15.6, CR.wood, { hole: [5.7, 0.47] })), cx, cy, rot: 0, z: 0.02, t: 0.06, side: hex(CR.wood), mres: 24, cell: 0.4, noPick: true }];
        pocket(ps, cream, 'cream', cx, cy, rot);
        ps.push(
          { id: 'clipA', sp: pk(320, () => item.binderClip(1.5, 1.5)), cx: 4.4, cy: 1.62, rot: -2, z: 0.12, t: 0.05, side: 0x2C2C30, mres: 90, ospace: 0.03, cell: 0.08 },
          { id: 'clipB', sp: pk(320, () => item.binderClip(1.5, 1.5)), cx: 10.4, cy: 1.62, rot: 2, z: 0.12, t: 0.05, side: 0x2C2C30, mres: 90, ospace: 0.03, cell: 0.08 },
          { id: 'orangeS', sp: pk(300, () => item.orangeSticker(0.62)), cx: 13.45, cy: 14.2, rot: -8, z: 0.08, t: 0.045, lifts: [L.edge('r', 0.05, 0.7)], side: SIDE.white, mres: 80, ospace: 0.04, cell: 0.12 },
          softTape('tapeL', pk(220, () => item.washi(2.0, 0.66, CR.cream, 'grid', 0.92)), 1.95, 16.95, 42),
          softTape('tapeR', pk(220, () => item.washi(2.0, 0.66, CR.cream, 'grid', 0.92)), 12.85, 16.95, -42),
          crumbs('crumbD', 1.6, 0.8, 1.35, 15.4, 0, 6), crumbs('crumbE', 1.1, 0.6, 13.7, 16.2, 30, 4),
          btn('btnR1', 0.48, CR.moss, 0.85, 4.6, -12, 0.06, { thread: '#F4E4C1' }),
          btn('btnR2', 0.42, CR.red, 13.95, 8.9, 20, 0.06, { holes: 2 }),
          { id: 'charcoalR', sp: pk(320, () => item.charcoalStick(1.6, 0.5)), cx: 12.1, cy: 18.2, rot: -16, z: 0.06, t: 0.05, side: 0x2B2725, mres: 80, ospace: 0.03, cell: 0.08 },
        );
        const rec = PATCH.buildPage('creamR', { patches: ps, inks: [], withK });
        const Rpg = canvasLayer((g, k) => {
          let x = hand(g, '今天的模特：纽扣和', 1.6, 18.4, 0.5, CR.ink); const u0 = x; x = hand(g, '小橘子', x, 18.4, 0.5, CR.ink); hand(g, '。', x, 18.4, 0.5, CR.ink);
          charcoal.curve(g, [u0, 18.56], [u0 + 0.4, 18.62], [x - 0.4, 18.5], [x + 0.05, 18.57], 0.045, CR.orange, { alpha: 0.85 });
          charcoal.cloud(g, 1.0, 1.1, 0.6, CR.ink, 0.035); charcoal.swirl(g, 13.9, 1.2, 0.26, CR.ink, 0.032); charcoal.cloud(g, 13.95, 11.6, 0.5, CR.ink, 0.032);
          charcoal.swirl(g, 0.8, 9.8, 0.24, CR.ink, 0.032); charcoal.cloud(g, 10.4, 19.2, 0.5, CR.ink, 0.032);
          pageNo(g, 12, S.PW - 1.5);
          rec.paintBase(g, k);
        });
        await finish('creamR', rec, Rpg);
      }
    }
  }

  // ================= 尾页（第 13 / 14 页）：Koko 的贴纸收藏 =================
  const stickImgs = {
    snow: await loadImg('assets/poster_snow03.jpg'),
    cloud: await loadImg('assets/Koko_poster_cloud_afternoon_01_lying_on_cloud_v3.jpg'),
    sea: await loadImg('assets/Koko_poster_sea_letter_01_window_gull_v3.jpg'),
    starry: await loadImg('assets/Koko_starry_01_round_collection.jpg'),
    cream: await loadImg('assets/Koko_cream_01_round_pegs.jpg'),
  };
  const coverCrop = (g, img, x, y, w, h, bias = 0.38) => {
    const iw = img.width || 1, ih = img.height || 1, s = Math.max(w / iw, h / ih);
    const dw = iw * s, dh = ih * s;
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(img, x + (w - dw) / 2, y + (h - dh) * bias, dw, dh);
  };
  const roundSticker = (img, size, ring = 0.26) => sprite(size, size, (g) => {
    const c = size / 2, r = size / 2 - 0.02, inner = Math.max(0.4, r - ring);
    g.fillStyle = '#FFFDF8'; g.beginPath(); g.arc(c, c, r, 0, 7); g.fill();
    g.strokeStyle = 'rgba(90,59,46,0.14)'; g.lineWidth = 0.035; g.beginPath(); g.arc(c, c, r - 0.02, 0, 7); g.stroke();
    g.save(); g.beginPath(); g.arc(c, c, inner, 0, 7); g.clip();
    coverCrop(g, img, c - inner, c - inner, inner * 2, inner * 2);
    g.restore();
    g.strokeStyle = 'rgba(255,253,248,0.55)'; g.lineWidth = 0.05; g.beginPath(); g.arc(c, c, inner + 0.015, 0, 7); g.stroke();
  });
  const polaroid = (img, w, ph, foot = 0.64, bd = 0.18) => {
    const h = bd + ph + foot;
    return { sp: sprite(w, h, (g) => {
      g.fillStyle = '#FFFDF8'; rr(g, 0, 0, w, h, 0.1); g.fill();
      g.save(); rr(g, bd, bd, w - 2 * bd, ph, 0.04); g.clip();
      coverCrop(g, img, bd, bd, w - 2 * bd, ph);
      g.restore();
    }), w, h };
  };
  const tickName = (g, name, x, y) => {
    g.strokeStyle = '#E0664F'; g.lineWidth = 0.05; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(x, y - 0.02); g.lineTo(x + 0.13, y + 0.14); g.lineTo(x + 0.36, y - 0.18); g.stroke();
    hand(g, name, x + 0.48, y + 0.06, 0.36, P.ink);
  };

  seed(29);
  {
    const slotS = 3.62;
    const ps = [
      washi(5.4, 0.78, P.peach, 'dots', 0.82, 5.15, 1.55, -3),
      washi(2.15, 0.7, 'rgba(168,220,200,1)', 'stripes', 0.8, 12.55, 8.15, 72),
      { id: 'doilyL', g: 'soft', sp: pk(160, () => item.doily(2.15, '#EEF4FB')), cx: 3.55, cy: 4.95, rot: 0, z: 0.022, floor: 0.022, cell: 0.2, shadowA: 0.28 },
      { id: 'snowStk', sp: pk(280, () => roundSticker(stickImgs.snow, 3.95)), cx: 3.55, cy: 4.95, rot: -8, z: 0.10, t: 0.046, lifts: [L.dome(0.03, 1.85), L.corner(1, 1, 0.05, 1.6)], side: SIDE.white, mres: 70, outlineN: 64, osmooth: 3, cell: 0.18 },
      { id: 'cloudStk', sp: pk(280, () => polaroid(stickImgs.cloud, 3.55, 4.12).sp), cx: 10.7, cy: 5.18, rot: 6, z: 0.11, t: 0.042, lifts: [L.arch(0.028), L.corner(-1, 1, 0.05, 1.6)], side: SIDE.white, mres: 60, ospace: 0.04, cell: 0.2 },
      { id: 'clipCloud', sp: pk(320, () => item.paperclip(2.4)), cx: 12.15, cy: 3.15, rot: 18, z: 0.16, t: 0.03, side: 0xC8C4BE, mres: 90, ospace: 0.03, cell: 0.08 },
      { id: 'seaStk', sp: pk(280, () => polaroid(stickImgs.sea, 3.55, 4.12).sp), cx: 3.7, cy: 10.9, rot: -4, z: 0.11, t: 0.042, lifts: [L.arch(0.028), L.corner(1, -1, 0.05, 1.6)], side: SIDE.white, mres: 60, ospace: 0.04, cell: 0.2 },
      { id: 'endSlot', holdThenFly: true, sp: pk(260, () => sprite(slotS, slotS, (g) => {
        const m = 0.06, rad = 0.28;
        g.fillStyle = 'rgba(255,249,238,0.72)'; rr(g, m, m, slotS - 2 * m, slotS - 2 * m, rad); g.fill();
        g.save(); g.setLineDash([0.15, 0.1]); g.strokeStyle = 'rgba(90,59,46,0.58)'; g.lineWidth = 0.045;
        rr(g, m + 0.14, m + 0.14, slotS - 2 * m - 0.28, slotS - 2 * m - 0.28, 0.2); g.stroke(); g.restore();
        const c = slotS / 2, cr = 0.22, inset = 0.38;
        g.strokeStyle = 'rgba(90,59,46,0.45)'; g.lineWidth = 0.055; g.lineCap = 'round';
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          const x = c + sx * (c - inset), y = c + sy * (c - inset);
          g.beginPath(); g.moveTo(x, y - sy * cr); g.lineTo(x, y); g.lineTo(x - sx * cr, y); g.stroke();
        }
        const label = '贴在这里'; const tw = 0.36 * label.length;
        hand(g, label, c - tw / 2, c + 0.12, 0.36, P.inkBlue);
      })), cx: 10.75, cy: 10.78, rot: -3, z: 0.09, t: 0.032, lifts: [L.arch(0.03), L.corner(1, 1, 0.05, 1.4)], side: SIDE.paper, mres: 60, ospace: 0.04, cell: 0.2 },
      { id: 'doilyS', g: 'soft', sp: pk(160, () => item.doily(2.0, '#F4EEE8')), cx: 3.85, cy: 16.15, rot: 8, z: 0.022, floor: 0.022, cell: 0.2, shadowA: 0.28 },
      { id: 'starStk', sp: pk(280, () => roundSticker(stickImgs.starry, 3.7, 0.24)), cx: 3.85, cy: 16.15, rot: 7, z: 0.10, t: 0.046, lifts: [L.dome(0.03, 1.7), L.corner(-1, 1, 0.05, 1.5)], side: SIDE.white, mres: 70, outlineN: 64, osmooth: 3, cell: 0.18 },
      { id: 'creamStk', sp: pk(280, () => roundSticker(stickImgs.cream, 3.7, 0.24)), cx: 10.55, cy: 16.05, rot: -6, z: 0.10, t: 0.046, lifts: [L.dome(0.03, 1.7), L.corner(1, -1, 0.05, 1.5)], side: SIDE.white, mres: 70, outlineN: 64, osmooth: 3, cell: 0.18 },
      { id: 'dateSt', sp: pk(300, () => item.dateStamp('12·07')), cx: 13.15, cy: 3.05, rot: 16, z: 0.14, t: 0.02, side: SIDE.white, mres: 100, ospace: 0.03, cell: 0.12 },
      { id: 'orangeE', sp: pk(280, () => item.orangeSticker(0.55)), cx: 13.35, cy: 13.55, rot: -14, z: 0.12, t: 0.04, lifts: [L.edge('r', 0.05, 0.6)], side: SIDE.white, mres: 80, ospace: 0.04, cell: 0.12 },
      washi(2.3, 0.68, P.lilac, 'dots', 0.78, 7.15, 18.05, -8),
      ...punches([[1.15, 8.35, 0.46, P.white, 12], [13.45, 7.2, 0.4, P.snowPale, 28], [1.25, 13.7, 0.42, P.white, 6], [13.55, 18.35, 0.38, P.snowPale, 20], [7.35, 3.15, 0.34, P.white, 33]]),
    ];
    const rec = PATCH.buildPage('endL', { patches: ps, withK });
    const Lpg = canvasLayer((g, k) => {
      place(g, item.torn(12.2, 16.5, '#FFFCF4', { pattern: 'grid', edges: 'tblr' }), 7.4, 10.15, -1.1, { noShadow: true });
      hand(g, '一张一张慢慢看', 6.15, 2.62, 0.44, P.inkBlue);
      doodle.star(g, 10.85, 2.15, 0.16); doodle.heart(g, 13.55, 8.55, 0.2);
      tickName(g, '雪绒国', 2.15, 7.22);
      tickName(g, '云朵午后', 8.55, 8.22);
      tickName(g, '海上来信', 2.15, 13.62);
      tickName(g, '星夜彩铅', 2.25, 18.32);
      tickName(g, '奶油素描', 8.85, 18.22);
      doodle.star(g, 7.55, 16.35, 0.14);
      g.strokeStyle = P.ink; g.lineWidth = 0.05; g.beginPath(); g.arc(1.5, 19.7, 0.42, 0, 7); g.stroke(); print(g, '13', 1.5, 19.85, 0.42, P.ink, 'NunitoP', 'center');
      rec.paintBase(g, k);
    });
    await finish('endL', rec, Lpg);
  }

  seed(30);
  {
    const KS = 5.2, kRot = 5, kx = 10.55, ky = 11.4; const inset = KS * 40 / 520;
    const ps = [
      washi(3.6, 0.78, P.peach, 'dots', 0.84, 10.7, 1.85, 8),
      washi(4.8, 0.72, 'rgba(168,220,200,1)', 'stripes', 0.8, 3.3, 1.7, -5),
      washi(2.2, 0.7, P.lilac, 'dots', 0.78, 7.9, 9.55, -18),
      { id: 'list', sp: pk(320, () => item.checklist(5.35, 5.95, '贴纸收藏', [['雪绒国', true], ['云朵午后', true], ['海上来信', true], ['星夜彩铅', true], ['奶油素描', true], ['贴在这里', false]])), cx: 3.95, cy: 5.55, rot: -2.5, z: 0.07, t: 0.032, lifts: [L.corner(1, 1, 0.1, 1.8)], side: SIDE.paper, mres: 50 },
      { id: 'clipList', sp: pk(320, () => item.paperclip(2.55)), cx: 6.05, cy: 2.95, rot: 18, z: 0.14, t: 0.03, side: 0xC8C4BE, mres: 90, ospace: 0.03, cell: 0.08 },
      { id: 'ticket', sp: pk(320, () => item.ticket(4.7, 2.2, { title: '贴纸收藏', sub: '空位 ×1', line: '留给以后', no: 'No.0030', band: P.coral, stub: '收藏', price: '¥ 0' })), cx: 10.85, cy: 4.15, rot: 8, z: 0.12, t: 0.032, side: SIDE.paper, mres: 60 },
      { id: 'doilyK', g: 'soft', sp: pk(160, () => item.doily(3.0, '#EEF4FB')), cx: kx, cy: ky, rot: 0, z: 0.022, floor: 0.022, cell: 0.22, shadowA: 0.3 },
      { id: 'koko', sp: pk(260, () => sprite(KS, KS, (q) => { q.imageSmoothingEnabled = true; q.imageSmoothingQuality = 'high'; q.drawImage(kokoCut, 0, 0, KS, KS); })), cx: kx, cy: ky, rot: kRot, z: 0.120, t: 0.065,
        lifts: [L.dome(0.028, KS * 0.46), L.corner(1, 1, 0.06, 2.2)], side: 0xFFFDF6, mres: 40, outlineN: 64, osmooth: 3, cell: 0.25 },
      { id: 'kokoArt', g: 'poster', on: 'koko', w: KS - 2 * inset, h: KS - 2 * inset, cx: kx, cy: ky, rot: kRot, tex: kokoArt, premul: true, z: 0.3, cell: 0.25 },
      { id: 'endPocket', sp: pk(280, () => sprite(5.5, 4.05, (g) => {
        const w = 5.5, h = 4.05;
        g.save(); g.beginPath(); g.moveTo(0, 0.35); g.quadraticCurveTo(w / 2, -0.15, w, 0.35); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.clip();
        g.fillStyle = P.kraft; rr(g, 0, 0, w, h, 0); g.fill();
        g.restore();
        g.save(); g.setLineDash([0.16, 0.1]); g.strokeStyle = P.cream; g.lineWidth = 0.035;
        g.beginPath(); g.moveTo(0.18, 0.5); g.lineTo(0.18, h - 0.18); g.lineTo(w - 0.18, h - 0.18); g.lineTo(w - 0.18, 0.5); g.stroke(); g.restore();
        hand(g, '收在口袋里', 0.5, h * 0.62, 0.4, P.ink); doodle.star(g, w - 0.85, h * 0.58, 0.22, P.white);
      })), cx: 4.15, cy: 14.85, rot: -3, z: 0.08, t: 0.05, lifts: [L.pocket(0.14)], side: SIDE.kraft, mres: 50, cell: 0.25 },
      { id: 'stub', sp: pk(300, () => item.ticket(3.4, 1.7, { title: '空位', sub: '以后再贴', line: '', no: 'No.0030', band: P.peach, stub: '收藏', price: '×1' })), cx: 5.55, cy: 13.05, rot: 7, z: 0.13, t: 0.028, side: SIDE.paper, mres: 60, restOn: ['endPocket'] },
      { id: 'tag', sp: pk(300, () => item.tag(2.15, 3.05, ['留给', '以后'])), cx: 13.05, cy: 16.85, rot: 11, z: 0.14, t: 0.035, lifts: [L.edge('b', 0.05, 1.1)], side: SIDE.kraft, mres: 60 },
      { id: 'stampE', sp: pk(320, () => item.stamp(1.45, 1.75, 'orange', '8分')), cx: 1.55, cy: 10.55, rot: -8, z: 0.16, t: 0.022, side: SIDE.white, mres: 100, ospace: 0.03, cell: 0.14 },
      washi(2.05, 0.66, P.peach, 'stripes', 0.8, 7.35, 17.85, 12),
      ...punches([[13.4, 8.15, 0.42, P.white, 16], [1.2, 18.55, 0.4, P.snowPale, 24], [8.35, 19.05, 0.36, P.white, 8], [13.55, 13.7, 0.34, P.snowPale, 30]]),
    ];
    const rec = PATCH.buildPage('endR', { patches: ps, withK });
    const Rpg = canvasLayer((g, k) => {
      place(g, item.torn(11.6, 8.4, '#FFFCF4', { pattern: 'grid', edges: 'tb' }), 6.4, 5.7, -1.4, { noShadow: true });
      hand(g, '今天贴完了这些', 1.45, 2.28, 0.4, P.ink);
      doodle.star(g, 8.35, 1.35, 0.16); doodle.heart(g, 7.55, 10.15, 0.2, P.coral);
      hand(g, '还给自己留了空位', 1.55, 18.55, 0.4, P.inkBlue);
      doodle.arrow(g, [8.35, 18.15], [8.95, 17.85], [9.35, 16.9], [10.15, 15.55], P.inkBlue, 0.035);
      g.strokeStyle = P.ink; g.lineWidth = 0.05; g.beginPath(); g.arc(S.PW - 1.5, 19.7, 0.42, 0, 7); g.stroke(); print(g, '14', S.PW - 1.5, 19.85, 0.42, P.ink, 'NunitoP', 'center');
      rec.paintBase(g, k);
    });
    await finish('endR', rec, Rpg);
  }

  // ================= 扉页 =================
  seed(1);
  {
    const rec = PATCH.buildPage('title', { patches: [washi(3.2, 0.8, P.peach, 'dots', 0.8, S.PW / 2, 3.6, -3, { floor: 0.004 })], withK });
    const title = canvasLayer((g, k) => {
      print(g, 'Koko 的魔法手账', S.PW / 2, 6.0, 0.9, P.ink, 'ChillRound', 'center');
      hand(g, '这本是我的。', S.PW / 2 - 1.55, 15.6, 0.5, P.inkBlue);
      doodle.star(g, 3.0, 5.4, 0.22); doodle.star(g, 11.9, 6.3, 0.16); doodle.snowflake(g, 11.6, 16.8, 0.26);
      rec.paintBase(g, k);
    });
    await finish('title', rec, title);
  }
  setK(kPage);
  info.patchBuild.ms = Math.round(performance.now() - t0);
  return RT;
}
