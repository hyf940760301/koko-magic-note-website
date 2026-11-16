// 晴窗手账 · 原型里的五个页面：雪绒国跨页（左/右）、翻页背面（第 19 页）、翻页露出的第 20 页、扉页
// R82：页面底图只保留手写/印刷文字、涂鸦、邮戳、页码 + 贴片在纸面上的软投影；
//      便签、车票、信封、口袋、邮票、贴纸、相片……全部成为真 3D 贴片（pagePatches.js），用 260–320 px/cm 的独立高清图集。
import { P, setK, withK, setReal3D, seed, sprite, place, hand, print, doodle, item, rr } from './collage.js';
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

  // ================= 左页（第 17 页）：主照片 =================
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
      g.strokeStyle = P.ink; g.lineWidth = 0.05; g.beginPath(); g.arc(1.5, 19.7, 0.42, 0, 7); g.stroke(); print(g, '17', 1.5, 19.85, 0.42, P.ink, 'NunitoP', 'center');
      rec.paintBase(g, k);
    });
    await finish('snowL', rec, L0);
  }

  // ================= 右页（第 18 页）：信封与模切贴纸 =================
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
      g.strokeStyle = P.ink; g.lineWidth = 0.05; g.beginPath(); g.arc(S.PW - 1.5, 19.7, 0.42, 0, 7); g.stroke(); print(g, '18', S.PW - 1.5, 19.85, 0.42, P.ink, 'NunitoP', 'center');
      rec.paintBase(g, k);
    });
    await finish('snowR', rec, R0);
  }

  // ================= 第 19 页（翻页的背面）：雪绒国 · 续 =================
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
      g.strokeStyle = P.ink; g.lineWidth = 0.05; g.beginPath(); g.arc(1.5, 19.95, 0.38, 0, 7); g.stroke(); print(g, '19', 1.5, 20.09, 0.38, P.ink, 'NunitoP', 'center');
      rec.paintBase(g, k);
    });
    await finish('nextL', rec, B19);
  }

  // ================= 第 20 页（翻页时露出）：给自己的信 =================
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
      g.strokeStyle = P.ink; g.lineWidth = 0.05; g.beginPath(); g.arc(S.PW - 1.5, 19.95, 0.38, 0, 7); g.stroke(); print(g, '20', S.PW - 1.5, 20.09, 0.38, P.ink, 'NunitoP', 'center');
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
  await seriesSpread({ keyL: 'cloudL', keyR: 'cloudR', no: 4, title: '云朵午后', lines: ['云好软软的。', '我躺在上面。', '风轻轻的。'], note: '想再躺一会儿。', tex: cloud, pageNoL: 21, pageNoR: 22, ticketTitle: '云朵午后', ticketSub: '躺一躺', washiColor: P.peach, accent: P.coral, series: 'cloud', stack: 1 });
  await seriesSpread({ keyL: 'seaL', keyR: 'seaR', no: 6, title: '海上来信', lines: ['窗开着。', '海风进来了。', '信还在桌上。'], note: '等海鸥回来。', tex: sea, pageNoL: 23, pageNoR: 24, ticketTitle: '海上来信', ticketSub: '窗边', washiColor: P.snow, accent: P.snowDeep, series: 'sea', stack: 1 });
  await seriesSpread({ keyL: 'starryL', keyR: 'starryR', no: 9, title: '星夜彩铅', lines: ['星都画下来。', '一颗一颗的。', '今晚好亮。'], note: '收进这一页。', tex: starry, pageNoL: 25, pageNoR: 26, ticketTitle: '星夜彩铅', ticketSub: '彩铅', washiColor: P.lilac, accent: P.lilac, series: 'starry', stack: 1 });
  await seriesSpread({ keyL: 'creamL', keyR: 'creamR', no: 10, title: '奶油素描', lines: ['挂钩挂好了。', '奶油色的。', '摸起来软。'], note: '喜欢这一页。', tex: cream, pageNoL: 27, pageNoR: 28, ticketTitle: '奶油素描', ticketSub: '挂钩', washiColor: P.peach, accent: P.coral, series: 'cream', stack: 1 });

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
