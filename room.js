// 晴窗手账 · 首屏空间：窗边书桌一角（程序化几何 + 手写着色器）
// 单位厘米；桌面 y=0；墙在 z=WIN.wallZ。静态物件按材质合并成 1 次绘制。
// 桌上小物的位置（x, z）：首屏框住书，阅读 / 翻页取景时全部在画框外（qa_props.py 检查）
// 所有桌上小物都放到压低的窗台上（桌面只留书）（台面 y 11.5）：首屏推近时在书后面框景，阅读取景时被抬高、自然在画框上方之外
export const PP = { plant: [-36.5, -27, 11.5], cup: [19, -26.5, 11.5], mug: [-12, -26.5, 11.5], oranges: [[-29, -25.8, 3.0, 0.3, 11.5], [-24.6, -24.8, 2.7, 1.9, 11.5]], pencil: null, washi: [11, -25.5, 11.5], scale: 0.8 };
export function buildRoom(ctx) {
  const { THREE, scene, VERT, FRAG_HEAD, shared, col, WIN, DESK, roundedRectShape } = ctx;
  const P = { // 房间调色（全部取自颜色系统）
    wall: 0xFBE6C8, trim: 0xFFF8EC, floor: 0xE9C7A0, cork: 0xEFCB94,
    apricot: 0xF7B98A, mint: 0xA8DCC8, mintDeep: 0x86C4AE, honey: 0xF2B65A, lilac: 0xC9B6E4, peach: 0xFFC2A8,
    cream: 0xFFF1D6, sky: 0x9CCBEB, coral: 0xF48C7A, sun: 0xFFD66B, orange: 0xF5A04A, soil: 0xA8714E, wood: 0xF6D7AE, cocoa: 0x5A3B2E,
  };
  const keepAlpha = (m, additive = false) => { m.blending = THREE.CustomBlending; m.blendEquation = THREE.AddEquation;
    m.blendSrc = THREE.SrcAlphaFactor; m.blendDst = additive ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor;
    m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor; m.transparent = true; m.depthWrite = false; return m; };

  // ---------- 合并器：几何 + 颜色 + 变换 → 一个网格 ----------
  const parts = [], sillParts = []; let SILL = false; // 窗台上的小物：不投影（否则 30 单位长的影子会横穿摊开的书页），只在台面上画一圈接触影
  // 桌上小物统一缩放（绕各自底面中心）：书相对显得更大、更厚实（接近 A4 的大手账）
  // 接触影：三层同心椭圆由浅到深叠在台面上（插画式柔边），颜色是杏色影调
  const contactShadow = (x, z, r) => { [[1.0, 0xF6DCC4], [0.86, 0xEFCDB0], [0.7, 0xE6BC9A]].forEach(([k, c], i) => add(new THREE.CircleGeometry(r * k, 40), c, [x, 0.04 + i * 0.02, z], [-Math.PI / 2, 0, 0], [1, 0.8, 1])); };
  let PIV = null; const pivot = (x, z, y = 0, k = PP.scale) => { PIV = new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeScale(k, k, k)).multiply(new THREE.Matrix4().makeTranslation(-x, 0, -z)); };
  function add(geo, hex, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
    // hex：颜色；或 (局部顶点) => Color 的逐顶点着色函数；或 'vc' = 用 geo.userData.cols
    let src = geo;
    if (hex === 'vc' || typeof hex === 'function') { src = geo.clone(); const p = src.attributes.position; const ca = new Float32Array(p.count * 3); const v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) { if (hex === 'vc') { ca[i * 3] = geo.userData.cols[i * 3]; ca[i * 3 + 1] = geo.userData.cols[i * 3 + 1]; ca[i * 3 + 2] = geo.userData.cols[i * 3 + 2]; }
        else { const c = hex(v.set(p.getX(i), p.getY(i), p.getZ(i)), i); ca[i * 3] = c.r; ca[i * 3 + 1] = c.g; ca[i * 3 + 2] = c.b; } }
      src.setAttribute('color', new THREE.BufferAttribute(ca, 3)); }
    const g = src.index ? src.toNonIndexed() : src.clone();
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scl));
    g.applyMatrix4(m); if (PIV) g.applyMatrix4(PIV); if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count; let ca;
    if (g.attributes.color) ca = g.attributes.color.array; else { const c = col(hex); ca = new Float32Array(n * 3); for (let i = 0; i < n; i++) { ca[i * 3] = c.r; ca[i * 3 + 1] = c.g; ca[i * 3 + 2] = c.b; } }
    (SILL ? sillParts : parts).push({ p: g.attributes.position.array, n: g.attributes.normal.array, c: ca });
  }
  function merged() {
    let len = 0; for (const q of parts) len += q.p.length;
    const P3 = new Float32Array(len), N3 = new Float32Array(len), C3 = new Float32Array(len); let o = 0;
    for (const q of parts) { P3.set(q.p, o); N3.set(q.n, o); C3.set(q.c, o); o += q.p.length; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P3, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N3, 3)); g.setAttribute('color', new THREE.BufferAttribute(C3, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(len / 3 * 2), 2)); return g;
  }
  // 圆角块：w×h 截面（xy），深 d（z），中心在原点
  function rbox(w, h, d, r = 0.4, bev = 0.25) {
    const sh = roundedRectShape(w, h, r, r, r, r);
    const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(d - 2 * bev, 0.01), bevelEnabled: true, bevelThickness: bev, bevelSize: Math.min(bev, r * 0.8), bevelSegments: 2, curveSegments: 4 });
    g.translate(-w / 2, 0, -(d - 2 * bev) / 2); return g;
  }
  const SS = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
  const lathe = (pts, seg = 32) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

  // ---------- 墙、窗洞、窗框、窗台 ----------
  const ox0 = WIN.cx - WIN.hw - WIN.frame, ox1 = WIN.cx + WIN.hw + WIN.frame, oy0 = WIN.cy - WIN.hh - WIN.frame, oy1 = WIN.cy + WIN.hh + WIN.frame;
  const wallShape = new THREE.Shape(); wallShape.moveTo(-260, -90); wallShape.lineTo(260, -90); wallShape.lineTo(260, 240); wallShape.lineTo(-260, 240); wallShape.lineTo(-260, -90);
  const hole = new THREE.Path(); hole.moveTo(ox0, oy0); hole.lineTo(ox0, oy1); hole.lineTo(ox1, oy1); hole.lineTo(ox1, oy0); hole.lineTo(ox0, oy0); wallShape.holes.push(hole);
  const wallGeo = new THREE.ShapeGeometry(wallShape); wallGeo.translate(0, 0, WIN.wallZ);
  const rd = WIN.wallZ - WIN.glassZ; // 窗洞进深
  // 窗洞四壁（受阳光：下壁、右壁）
  add(new THREE.PlaneGeometry(ox1 - ox0, rd), P.wall, [(ox0 + ox1) / 2, oy0, (WIN.wallZ + WIN.glassZ) / 2], [-Math.PI / 2, 0, 0]);
  add(new THREE.PlaneGeometry(ox1 - ox0, rd), P.wall, [(ox0 + ox1) / 2, oy1, (WIN.wallZ + WIN.glassZ) / 2], [Math.PI / 2, 0, 0]);
  add(new THREE.PlaneGeometry(rd, oy1 - oy0), P.wall, [ox0, (oy0 + oy1) / 2, (WIN.wallZ + WIN.glassZ) / 2], [0, Math.PI / 2, 0]);
  add(new THREE.PlaneGeometry(rd, oy1 - oy0), P.wall, [ox1, (oy0 + oy1) / 2, (WIN.wallZ + WIN.glassZ) / 2], [0, -Math.PI / 2, 0]);
  // 窗框：外框 4.5、十字窗棂 2.4、横档在 y=125；奶油白漆，圆角 0.6
  const fz = WIN.glassZ, F = WIN.frame, M = WIN.mull;
  add(rbox(F, oy1 - oy0, 4, 0.6), P.trim, [ox0 + F / 2, (oy0 + oy1) / 2, fz]);
  add(rbox(F, oy1 - oy0, 4, 0.6), P.trim, [ox1 - F / 2, (oy0 + oy1) / 2, fz]);
  add(rbox(ox1 - ox0, F, 4, 0.6), P.trim, [(ox0 + ox1) / 2, oy1 - F / 2, fz]);
  add(rbox(ox1 - ox0, F, 4, 0.6), P.trim, [(ox0 + ox1) / 2, oy0 + F / 2, fz]);
  add(rbox(M, WIN.hh * 2, 3, 0.5), P.trim, [WIN.cx, WIN.cy, fz]);
  if (WIN.transomY < WIN.cy + WIN.hh) add(rbox(WIN.hw * 2, M, 3, 0.5), P.trim, [WIN.cx, WIN.transomY, fz]);
  // 两扇窗各一道细窗芯（0.9）：上 1/3 处，图形化的小格
  for (const sx of [-1, 1]) add(rbox(WIN.hw - M / 2, 0.9, 2, 0.3), P.trim, [WIN.cx + sx * (WIN.hw / 2 + M / 4), WIN.cy + WIN.hh * 0.42, fz]);
  // 内侧斜面线脚：贴着玻璃一圈 1.1 宽的倒角木条（让窗框有层次，不再是一块平板）
  { const iw = WIN.hw, ih = WIN.hh, zi = fz + 2.0, t = 1.1;
    add(rbox(iw * 2 + t * 2, t, 1.2, 0.35, 0.3), 0xFFF3E2, [WIN.cx, WIN.cy + ih + t / 2 - 0.2, zi]); add(rbox(iw * 2 + t * 2, t, 1.2, 0.35, 0.3), 0xFFF3E2, [WIN.cx, WIN.cy - ih - t / 2 + 0.2, zi]);
    add(rbox(t, ih * 2, 1.2, 0.35, 0.3), 0xFFF3E2, [WIN.cx - iw - t / 2 + 0.2, WIN.cy, zi]); add(rbox(t, ih * 2, 1.2, 0.35, 0.3), 0xFFF3E2, [WIN.cx + iw + t / 2 - 0.2, WIN.cy, zi]);
    // 窗棂两侧的细线脚
    for (const sx of [-1, 1]) add(rbox(0.5, ih * 2, 0.8, 0.2, 0.15), 0xFFF3E2, [WIN.cx + sx * (M / 2 + 0.25), WIN.cy, fz + 1.7]); }
  // 窗棂上的小黄铜窗扣：底座 + 旋钮 + 弯把手
  { const lx = WIN.cx, ly = WIN.cy - 6, lz = fz + 1.7;
    add(rbox(1.4, 3.0, 0.4, 0.4, 0.15), 0xD6B070, [lx, ly, lz]);
    add(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 32), 0xE2C07C, [lx, ly + 0.6, lz + 0.4], [Math.PI / 2, 0, 0]);
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1.0, -0.2, 0.25), new THREE.Vector3(2.1, -0.15, 0.35), new THREE.Vector3(2.6, 0.2, 0.3)]), 24, 0.2, 12, false), 0xD6B070, [lx, ly + 0.6, lz + 0.6]);
    add(new THREE.SphereGeometry(0.3, 20, 14), 0xE2C07C, [lx + 2.6, ly + 0.8, lz + 0.9]); }
  // 窗台：伸进屋里 7，厚 2.6，两端各出 4
  const sillD = rd + 9; add(rbox(ox1 - ox0 + 8, 2.6, sillD, 0.8, 0.5), P.trim, [(ox0 + ox1) / 2, oy0 - 1.3 + 0.01, WIN.glassZ - 2 + sillD / 2]);
  // 窗帘杆
  const rodY = oy1 + 6, rodZ = WIN.wallZ + 4.5;
  add(new THREE.CylinderGeometry(0.8, 0.8, ox1 - ox0 + 22, 16), P.honey, [(ox0 + ox1) / 2 - 4, rodY, rodZ], [0, 0, Math.PI / 2]);
  for (const x of [ox0 - 16, ox1 + 8]) add(new THREE.SphereGeometry(1.6, 16, 12), P.honey, [x, rodY, rodZ]);
  for (const x of [ox0 - 6, ox1 - 2]) add(rbox(1.2, 6, 4.5, 0.4), P.honey, [x, rodY + 1, WIN.wallZ + 2.2]);
  // 窗台上的小多肉（拟石莲花）：外翻口沿小陶盆（手绘白点 + 细条纹）+ 深暖棕小石子铺面 + 三层饱满水滴叶莲座，叶尖粉橘晕
  { const x = ox0 + 54.5, y = oy0 + 0.05, z = WIN.wallZ + 0.5;
    const L = (pts, seg = 72) => { const g = new THREE.LatheGeometry(pts.map(([r, yy]) => new THREE.Vector2(r, yy)), seg); g.computeVertexNormals(); return g; };
    add(L([[0, 0], [2.3, 0], [2.48, 0.06], [2.58, 0.25], [2.95, 3.5], [3.3, 3.7], [3.55, 3.95], [3.6, 4.35], [3.5, 4.7], [3.28, 4.8], [3.08, 4.62], [2.98, 4.2], [0, 4.2]]), P.peach, [x, y, z]);
    add(new THREE.TorusGeometry(2.86, 0.045, 8, 96), 0xFFF6E6, [x, y + 2.6, z], [Math.PI / 2, 0, 0], [1, 1, 1]);
    add(new THREE.TorusGeometry(2.72, 0.045, 8, 96), 0xFFF6E6, [x, y + 1.5, z], [Math.PI / 2, 0, 0], [1, 1, 1]);
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2 + (i % 2) * 0.2, yy = i % 2 ? 2.05 : 3.1, R = (i % 2 ? 2.8 : 2.92) + 0.02; add(new THREE.SphereGeometry(0.14, 14, 8), 0xFFF6E6, [x + Math.cos(a) * R, y + yy, z + Math.sin(a) * R], [0, -a, 0], [0.25, 1, 1]); }
    for (let i = 0; i < 26; i++) { const a = i * 2.39996, r = 0.3 + Math.sqrt(i / 26) * 2.55; add(new THREE.SphereGeometry(0.22 + (i % 3) * 0.06, 12, 8), [0x6E4A36, 0x8A5E44, 0x5A3B2E][i % 3], [x + Math.cos(a) * r, y + 4.28, z + Math.sin(a) * r], [i, i * 0.7, 0], [1, 0.7, 0.85]); }
    const leaf = L([[0, 0], [0.32, 0.18], [0.52, 0.6], [0.62, 1.15], [0.56, 1.65], [0.38, 2.05], [0.16, 2.32], [0, 2.42]], 28);
    const blush = (p) => col(0xA9D1B6).lerp(col(0xF2A38A), SS(1.55, 2.42, p.y) * 0.85);
    const blushIn = (p) => col(0xC6E4C9).lerp(col(0xF5B49A), SS(1.7, 2.42, p.y) * 0.6);
    for (const [n, tilt, k, off, rot0, fn] of [[11, 1.18, 1.0, 0.55, 0, blush], [8, 0.78, 0.85, 0.35, 0.3, blush], [6, 0.4, 0.66, 0.18, 0.1, blushIn]])
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + rot0; const g = leaf.clone(); g.scale(k, k, k * 0.62); g.rotateX(tilt); g.rotateY(Math.PI / 2 - a);
        add(g, fn, [x + Math.cos(a) * off, y + 4.45 + (1.18 - tilt) * 0.35, z + Math.sin(a) * off]); }
    add(new THREE.SphereGeometry(0.42, 24, 16), 0xC6E4C9, [x, y + 5.35, z], [0, 0, 0], [1, 1.25, 1]); }

  // 纱帘绑带：在帘子 1/3 高处把帘子束向墙边（帘子顶点着色器里同步收窄），蜂蜜色布带 + 墙上小挂钩
  { const cwT = WIN.curtainX + 5 - (ox0 - 7), chT = (oy0 + WIN.hh * 2 + WIN.frame * 2 + 6) - (oy0 - 3); const yT = oy0 - 3 + chT * 0.36, wT = cwT * 0.42;
    const ax = wT / 2 + 0.9, ez = 3.2; const ring = new THREE.CatmullRomCurve3(Array.from({ length: 48 }, (_, i) => { const a = i / 48 * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * ax, Math.sin(a * 2) * 0.25, Math.sin(a) * ez); }), true);
    const band = new THREE.TubeGeometry(ring, 160, 0.42, 14, true); band.scale(1, 1.9, 1);
    add(band, 0xF2B65A, [ox0 - 7 + wT / 2 + 0.3, yT, WIN.wallZ + 3.6]);
    add(new THREE.SphereGeometry(0.7, 20, 14), 0xD6B070, [ox0 - 8.4, yT + 0.4, WIN.wallZ + 1.2]); }
  // ---------- 书桌下部：抽屉横档、桌腿（只在全景里露出）----------
  { const t = DESK.t, w = DESK.x1 - DESK.x0, zf = DESK.z1;
    add(rbox(w - 14, 7, 2.2, 0.6, 0.3), 0xF0CDA0, [(DESK.x0 + DESK.x1) / 2, -t - 3.5, zf - 4]);
    add(rbox(44, 5.4, 1.0, 0.8, 0.3), P.wood, [0, -t - 3.5, zf - 2.6]);
    add(new THREE.SphereGeometry(0.9, 16, 12), P.honey, [0, -t - 3.5, zf - 1.8]);
    for (const [x, z] of [[DESK.x0 + 6, zf - 6], [DESK.x1 - 6, zf - 6], [DESK.x0 + 6, DESK.z0 + 6], [DESK.x1 - 6, DESK.z0 + 6]])
      add(new THREE.CylinderGeometry(2.2, 1.6, 72, 20), 0xF0CDA0, [x, -t - 36, z]); }
  const archGeoParts = parts.splice(0, parts.length);
  // ---------- 墙上的木架与杂物（右侧）----------
  const shY = 20, shX0 = 74, shX1 = 138, shZ = WIN.wallZ + 9;
  add(rbox(shX1 - shX0, 2.4, 18, 0.6, 0.4), P.trim, [(shX0 + shX1) / 2, shY, shZ]);
  for (const x of [shX0 + 8, shX1 - 8]) add(rbox(1.6, 8, 12, 0.5), 0x8A5A40, [x, shY - 5, WIN.wallZ + 6]);
  { let x = shX0 + 3; const books = [[3.2, 21, P.apricot], [2.6, 18, P.mint], [3.6, 23, P.honey], [2.4, 16.5, P.lilac], [3.0, 19, P.peach]];
    for (const [w, h, c] of books) { add(rbox(w, h, 13, 0.35, 0.2), c, [x + w / 2, shY + 1.2 + h / 2, shZ - 1]); add(rbox(w + 0.02, 1.0, 13.05, 0.2, 0.1), P.cream, [x + w / 2, shY + 1.2 + h * 0.78, shZ - 1]); x += w + 0.25; }
    add(rbox(2.8, 19, 13, 0.35, 0.2), P.coral, [x + 4.2, shY + 1.2 + 9.2, shZ - 1], [0, 0, -0.32]); // 斜靠的一本
    // 玻璃罐里两个小橘子（橘子 = Koko 世界里雪绒国的小橘子）
    const jx = shX0 + 33; add(lathe([[0, 0], [4.2, 0], [4.6, 1], [4.6, 10], [3.6, 11], [3.6, 12], [0, 12]], 32), P.cream, [jx, shY + 1.2, shZ], [0, 0, 0], [1, 1, 1]);
    add(new THREE.SphereGeometry(2.6, 20, 14), P.orange, [jx - 1.2, shY + 13.6, shZ + 0.5], [0, 0, 0], [1, 0.9, 1]);
    add(new THREE.SphereGeometry(2.3, 20, 14), P.orange, [jx + 1.6, shY + 13.2, shZ - 1.2], [0, 0, 0], [1, 0.9, 1]);
    // 横放的两本 + 小闹钟
    add(rbox(14, 2.6, 11, 0.4, 0.2), P.sky, [shX1 - 11, shY + 2.5, shZ]); add(rbox(13, 2.2, 10, 0.4, 0.2), P.cream, [shX1 - 11, shY + 4.9, shZ]);
    add(new THREE.CylinderGeometry(3.4, 3.4, 2.2, 32), P.sun, [shX1 - 11, shY + 9.6, shZ], [Math.PI / 2, 0, 0]);
    add(new THREE.CylinderGeometry(2.7, 2.7, 0.3, 32), P.cream, [shX1 - 11, shY + 9.6, shZ + 1.2], [Math.PI / 2, 0, 0]);
  }

  // ---------- 桌上的小物 ----------
  // ======== 窗台小物（高细分：回转体 72–96 段、管道 48–64 段、倒角与平滑法线；全部并进合并网格）========
  const lath = (pts, seg = 72) => { const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg); g.computeVertexNormals(); return g; };
  const tube = (pts, r, seg = 48, rad = 20) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), seg, r, rad, false);
  const flatN = (g) => { const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); return n; };
  const ss = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
  const vcol = (a, b) => (p, t) => col(a).lerp(col(b), t);   // 逐顶点渐变色：add(geo, (p) => Color)
  // 一个贴在回转体表面的扁圆点（手绘釉点）
  const dotOn = (x, y0, z, a, R, s, hex) => add(new THREE.SphereGeometry(s, 16, 10), hex, [x + Math.cos(a) * R, y0, z + Math.sin(a) * R], [0, -a, 0], [0.22, 1, 1]);

  // ---- 绿植：厚口外翻陶盆 + 带唇托盘 + 微隆颗粒土 + 12 片多节弯曲、带中脉折痕的长叶 ----
  { const [x, z, y0 = 0] = PP.plant; pivot(x, z, y0); SILL = y0 > 0; if (SILL) contactShadow(x + 0.8, z + 0.5, 7.4);
    add(lath([[0, 0], [5.2, 0], [5.6, 0.1], [5.9, 0.45], [6.1, 1.25], [6.05, 1.5], [5.85, 1.55], [5.65, 1.1], [5.35, 0.66], [0, 0.6]]), 0xE08E62, [x, 0, z]);
    add(lath([[0, 0.6], [4.15, 0.6], [4.35, 0.68], [4.48, 0.9], [5.35, 8.6], [5.55, 8.75], [6.25, 8.85], [6.55, 9.1], [6.62, 9.6], [6.58, 10.45], [6.42, 10.78], [6.15, 10.88], [5.92, 10.75], [5.8, 10.4], [5.62, 10.25], [0, 10.25]]), P.apricot, [x, 0, z]);
    add(new THREE.TorusGeometry(6.6, 0.07, 8, 96), 0xFFE2C8, [x, 9.85, z], [Math.PI / 2, 0, 0]);
    add(lath([[0, 10.78], [2.0, 10.72], [4.0, 10.56], [5.4, 10.36], [5.85, 10.22]]), 0x6E4A36, [x, 0, z]);
    for (let i = 0; i < 34; i++) { const a = i * 2.39996, r = 0.6 + Math.sqrt(i / 34) * 4.9; add(new THREE.SphereGeometry(0.18 + (i % 3) * 0.06, 10, 7), i % 4 ? 0x5A3B2A : 0x8A644A, [x + Math.cos(a) * r, 10.74 - r * r * 0.016, z + Math.sin(a) * r], [0, 0, 0], [1, 0.6, 1]); }
    const blade = (L, W, bend, tilt) => { const N = 20, pos = [], idx = [];
      for (let i = 0; i <= N; i++) { const t = i / N, th = bend * t, py = Math.sin(th) / bend * L, pz = (1 - Math.cos(th)) / bend * L, ny = -Math.sin(th), nz = Math.cos(th);
        const w = W * Math.pow(Math.sin(Math.PI * Math.min(0.04 + t * 1.0, 1)), 0.7) * (1 - 0.25 * t);
        for (const [u, fold] of [[-1, 1], [-0.45, 0.35], [0, 0], [0.45, 0.35], [1, 1]]) { const f = fold * w * 0.22; pos.push(u * w, py + f * ny, pz + f * nz); } }
      for (let i = 0; i < N; i++) for (let j = 0; j < 4; j++) { const a = i * 5 + j, b = a + 5; idx.push(a, b, a + 1, a + 1, b, b + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.rotateX(tilt); g.computeVertexNormals(); return g; };
    for (let i = 0; i < 12; i++) { const a = i * 2.39996 + 0.4, L = 7.2 + ((i * 7) % 5) * 1.2, tilt = 0.10 + (i % 4) * 0.12;
      add(blade(L, 0.95 + (i % 3) * 0.16, 0.7 + (i % 5) * 0.2, tilt), (p) => col((i % 3) ? 0x7FBF9C : 0x5FA484).lerp(col(0xB8DDA0), ss(L * 0.55, L * 1.0, p.y) * 0.45), [x + Math.cos(a) * 0.8, 10.6, z + Math.sin(a) * 0.8], [0, Math.PI / 2 - a, 0]); } }

  // ---- 笔筒：竖棱陶瓷杯（16 道圆棱）+ 厚圆口沿 + 可见内壁；六棱彩铅（削出木锥 + 彩色铅芯，两支带金属箍和橡皮）+ 圆柄小剪刀 + 木尺 + 一支画笔 ----
  { const [x, z, y0 = 0] = PP.cup; pivot(x, z, y0); SILL = y0 > 0; if (SILL) contactShadow(x + 0.6, z + 0.4, 4.8);
    const fl = new THREE.CylinderGeometry(1, 1, 8.7, 128, 6, true); { const p = fl.attributes.position; for (let i = 0; i < p.count; i++) { const px = p.getX(i), pz = p.getZ(i), a = Math.atan2(pz, px); const r = 3.45 + 0.16 * Math.pow(0.5 + 0.5 * Math.cos(a * 16), 0.6); p.setXYZ(i, Math.cos(a) * r, p.getY(i), Math.sin(a) * r); } fl.computeVertexNormals(); }
    add(fl, P.peach, [x, 0.75 + 4.35, z]);
    add(lath([[0, 0], [3.25, 0], [3.5, 0.08], [3.62, 0.3], [3.62, 0.8], [3.45, 0.8]]), 0xF2A88A, [x, 0, z]);                         // 杯脚倒角
    add(new THREE.TorusGeometry(3.42, 0.3, 18, 128), 0xFFF1D6, [x, 9.45, z], [Math.PI / 2, 0, 0]);                                     // 厚圆口沿（奶白釉）
    add(lath([[3.15, 9.45], [3.1, 2.0], [2.9, 1.0], [0, 0.95]]), 0xFFE9D2, [x, 0, z]);                                                  // 内壁
    add(new THREE.CylinderGeometry(3.66, 3.66, 0.5, 128, 1, true), 0xFFF1D6, [x, 3.0, z]);                                             // 一道奶白釉带
    const pencil = (bx, bz, L, lean, yaw, c, eraser) => { const r = 0.36, dir = new THREE.Vector3(Math.sin(lean) * Math.cos(yaw), Math.cos(lean), Math.sin(lean) * Math.sin(yaw));
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); const e = new THREE.Euler().setFromQuaternion(q); const R = [e.x, e.y, e.z];
      const at = (s) => [bx + dir.x * s, 1.0 + dir.y * s, bz + dir.z * s];
      if (!eraser) { add(flatN(new THREE.CylinderGeometry(r, r, L, 6)), c, at(L / 2), R);
        add(new THREE.CylinderGeometry(0.04, r * 0.98, 1.5, 36), (p) => col(0xF3D3A6).lerp(col(c), ss(0.35, 0.75, p.y) * 0.9), at(L + 0.75), R);   // 削出的木锥 + 彩色铅芯
      } else { add(flatN(new THREE.CylinderGeometry(r, r, L, 6)), c, at(L / 2), R);
        add(new THREE.CylinderGeometry(r * 1.05, r * 1.05, 0.9, 40, 3), (p) => col(0xD8CDB8).multiplyScalar(Math.abs(p.y) < 0.12 || Math.abs(Math.abs(p.y) - 0.3) < 0.05 ? 0.82 : 1.0), at(L + 0.45), R);   // 金属箍（两道压纹）
        add(new THREE.CapsuleGeometry(r * 0.98, 0.7, 10, 32), 0xF6A5A0, at(L + 1.2), R); } };                                         // 粉橡皮
    pencil(x - 1.4, z - 0.9, 13.2, 0.12, 3.6, P.sun, false); pencil(x + 0.9, z - 1.5, 14.6, 0.10, 5.2, P.sky, false); pencil(x + 1.8, z + 0.3, 12.4, 0.16, 0.2, P.coral, false);
    pencil(x - 0.4, z + 1.6, 12.8, 0.07, 2.0, P.lilac, true); pencil(x - 1.9, z + 0.6, 11.6, 0.14, 2.8, P.mint, true);
    // 圆柄小剪刀（刀尖朝下插在杯里，两只奶油珊瑚圆柄露在杯口上）
    { const sx = x + 1.2, sz = z + 1.4; add(new THREE.CylinderGeometry(0.16, 0.16, 6.5, 24), 0xD9D2C4, [sx, 6.2, sz], [0, 0, 0.05]);
      for (const k of [-1, 1]) add(new THREE.TorusGeometry(0.8, 0.22, 16, 64), 0xF48C7A, [sx + k * 0.62, 10.2 + k * 0.25, sz + k * 0.55], [0.25, 1.15, k * 0.35]);
      add(new THREE.SphereGeometry(0.28, 20, 14), 0xD9D2C4, [sx, 9.5, sz]); }
    // 木尺（斜插，露出一截刻度）
    { const rx = x - 2.3, rz = z - 0.2; add(new THREE.BoxGeometry(1.5, 15.5, 0.22, 1, 1, 1), 0xEBC48E, [rx, 7.6, rz], [0, 0.5, 0.16]);
      for (let i = 0; i < 9; i++) add(new THREE.BoxGeometry(i % 2 ? 0.35 : 0.6, 0.06, 0.24), 0x8A5A40, [rx - 0.6 + (i % 2 ? 0.12 : 0.25) + 0.16 * (9.8 + i * 0.75 - 7.6), 9.8 + i * 0.75, rz], [0, 0.5, 0.16]); }
    // 画笔：木柄（细长渐收）+ 金属箍 + 珊瑚笔头
    { const bx = x + 0.2, bz = z - 0.4; add(new THREE.CylinderGeometry(0.16, 0.32, 13, 32), 0xC98B5E, [bx, 7.4, bz], [0.08, 0, -0.05]);
      add(new THREE.CylinderGeometry(0.33, 0.3, 1.2, 32), 0xD8CDB8, [bx - 0.02, 14.4, bz + 0.56], [0.08, 0, -0.05]);
      add(new THREE.SphereGeometry(0.34, 24, 16), 0xF48C7A, [bx - 0.05, 15.4, bz + 0.64], [0.08, 0, -0.05], [1, 2.0, 1]); } }

  // ---- 马克杯：外翻圆唇（有厚度）+ 杯脚圈 + 圆管弯柄 + 奶茶液面（奶泡点 + 一小片橙）+ 手绘釉：小太阳、条纹、高光；斜边木杯垫（年轮） ----
  { const [x, z, y0 = 0] = PP.mug; pivot(x, z, y0); SILL = y0 > 0; if (SILL) contactShadow(x + 0.8, z + 0.5, 6.4);
    add(lath([[0, 0], [5.3, 0], [5.62, 0.06], [5.84, 0.24], [5.86, 0.4], [5.7, 0.58], [5.35, 0.66], [0, 0.66]], 96), 0xC08A5E, [x, 0, z]);   // 斜边木杯垫
    for (const r of [1.4, 2.6, 3.7, 4.6]) add(new THREE.TorusGeometry(r, 0.035, 6, 96), 0xA8724A, [x, 0.665, z], [Math.PI / 2, 0, 0], [1, 1, 0.3]);
    const yb = 0.66;
    add(lath([[0, 0.45], [2.75, 0.42], [2.85, 0.05], [3.1, 0], [3.45, 0.04], [3.58, 0.25], [3.62, 0.55], [3.82, 0.85], [3.9, 2.0], [3.94, 6.0], [3.98, 8.2], [4.08, 8.9], [4.16, 9.15], [4.12, 9.32], [4.0, 9.4]], 96), P.sky, [x, yb, z]);   // 外壁（杯脚圈 → 外翻唇外侧）
    add(lath([[4.0, 9.4], [3.84, 9.38], [3.68, 9.2], [3.6, 8.9], [3.52, 6.0], [3.45, 2.0], [3.2, 1.15], [2.4, 1.0], [0, 0.98]], 96), 0xFFF6E6, [x, yb, z]);   // 圆唇顶 + 内壁（奶白釉）
    add(new THREE.CylinderGeometry(3.555, 3.555, 0.12, 96), 0xC99363, [x, yb + 8.15, z]);                                                                 // 奶茶液面（低于杯口 1.2）
    for (let i = 0; i < 9; i++) { const a = i * 2.39996, r = 0.5 + Math.sqrt(i / 9) * 2.4; add(new THREE.SphereGeometry(0.16 + (i % 3) * 0.07, 14, 8), 0xF3E2C8, [x + Math.cos(a) * r - 0.4, yb + 8.22, z + Math.sin(a) * r], [0, 0, 0], [1, 0.35, 1]); }
    add(new THREE.CylinderGeometry(1.0, 1.0, 0.14, 64), 0xF59248, [x + 1.4, yb + 8.28, z + 0.9], [0.05, 0, 0.08]);                                     // 一小片橙：皮
    add(new THREE.CylinderGeometry(0.86, 0.86, 0.16, 64), 0xFFC98A, [x + 1.4, yb + 8.29, z + 0.9], [0.05, 0, 0.08]);                                  // 果肉
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; add(new THREE.BoxGeometry(0.75, 0.02, 0.05), 0xFFF0D6, [x + 1.4 + Math.cos(a) * 0.4, yb + 8.38, z + 0.9 + Math.sin(a) * 0.4], [0, -a, 0]); }
    add(new THREE.CylinderGeometry(3.99, 3.97, 0.55, 96, 1, true), 0xFFF1D6, [x, yb + 6.95, z]);                                                        // 奶白条纹 ×2（手绘釉）
    add(new THREE.CylinderGeometry(3.965, 3.955, 0.22, 96, 1, true), 0xFFD66B, [x, yb + 6.35, z]);
    // 正面手绘小太阳（朝屋里 +z 偏右）
    { const a = Math.PI / 2 - 0.35, R = 3.98, cx = x + Math.cos(a) * R, cz = z + Math.sin(a) * R, cy = yb + 4.0;
      add(new THREE.SphereGeometry(0.62, 32, 16), 0xFFD66B, [cx, cy, cz], [0, -a, 0], [0.12, 1, 1]);
      for (let i = 0; i < 8; i++) { const t = i / 8 * Math.PI * 2; const ox = Math.cos(t) * 1.05; add(new THREE.CapsuleGeometry(0.09, 0.35, 4, 10), 0xFFD66B, [cx - Math.sin(a) * ox, cy + Math.sin(t) * 1.05, cz + Math.cos(a) * ox], [0, -a, Math.PI / 2 - t], [1, 1, 0.5]); } }
    // 釉面高光：左上一道竖向柔亮
    add(new THREE.SphereGeometry(1, 24, 16), 0xFFFBF2, [x + Math.cos(2.35) * 3.99, yb + 5.2, z + Math.sin(2.35) * 3.99], [0, -2.35, 0], [0.04, 2.3, 0.2]);
    // 弯柄：圆管（截面 0.55），平滑 C 形，两端埋进杯身
    add(tube([[3.6, 7.6, 0], [4.9, 7.75, 0], [6.0, 7.1, 0], [6.25, 5.4, 0], [5.8, 3.9, 0], [4.7, 3.15, 0], [3.6, 3.0, 0]], 0.55, 64, 24), P.sky, [x, yb, z]); }

  // ---- 两颗小橘子：细腻果皮凹凸 + 蒂窝 + 五角绿萼 + 一片弯叶 ----
  for (const [x, z, r, a, y0 = 0] of PP.oranges) { pivot(x, z, y0); SILL = y0 > 0; if (SILL) contactShadow(x + 0.5, z + 0.3, r * 1.25);
    const sg = new THREE.SphereGeometry(r, 72, 54); { const p = sg.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).normalize();
      const n = Math.sin(v.x * 31 + v.y * 7) * Math.sin(v.y * 29 + v.z * 11) * Math.sin(v.z * 27 + v.x * 13); const dimple = -0.09 * r * Math.pow(Math.max(v.y - 0.86, 0) / 0.14, 1.5);
      const k = r * (1 + 0.006 * n) + dimple; p.setXYZ(i, v.x * k, v.y * k * 0.88, v.z * k); } sg.computeVertexNormals(); }
    add(sg, P.orange, [x, r * 0.88, z], [0, a, 0]);
    const st = new THREE.Shape(); for (let i = 0; i < 10; i++) { const t = i / 10 * Math.PI * 2, rr2 = i % 2 ? 0.16 : 0.42; i ? st.lineTo(Math.cos(t) * rr2, Math.sin(t) * rr2) : st.moveTo(Math.cos(t) * rr2, Math.sin(t) * rr2); } st.closePath();
    add(new THREE.ExtrudeGeometry(st, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 6 }), 0x7FA35A, [x, r * 1.76 - 0.12, z], [-Math.PI / 2, 0, a]);
    add(new THREE.CylinderGeometry(0.1, 0.16, 0.45, 20), 0x8A6A3E, [x, r * 1.76 + 0.08, z]);
    const lf = new THREE.Shape(); lf.moveTo(0, 0); lf.quadraticCurveTo(0.95, 1.0, 0, 2.6); lf.quadraticCurveTo(-0.95, 1.0, 0, 0);
    const lg = new THREE.ShapeGeometry(lf, 16); { const p = lg.attributes.position; for (let i = 0; i < p.count; i++) { const yy = p.getY(i), xx = p.getX(i); p.setZ(i, 0.09 * yy * yy - 0.25 * xx * xx); } lg.computeVertexNormals(); }
    add(lg, 0x86B85E, [x + 0.15, r * 1.76 + 0.22, z], [-1.1, a, 0.25]); }

  // ---- 和纸胶带：宽卷立着（斜格纹）+ 窄薄荷卷斜靠着它；牛皮纸芯中空、内壁细楞；宽卷撕下的一截尾巴贴在台面上，末端微微翘起 ----
  { const [x, z, y0 = 0] = PP.washi; pivot(x, z, y0); SILL = y0 > 0; if (SILL) contactShadow(x + 0.6, z + 0.8, 3.8);
    const roll = (Ro, Ri, W, colA, colB, pattern) => { // 轴 = y；外壁（印花）+ 两个侧面（一圈圈叠层）+ 牛皮纸芯
      const pr = [[Ri, 0]]; for (let i = 1; i <= 8; i++) pr.push([Ri + (Ro - 0.06 - Ri) * i / 8, 0]); pr.push([Ro - 0.02, 0.02], [Ro, 0.07]);
      for (let i = 1; i < 14; i++) pr.push([Ro, 0.07 + (W - 0.14) * i / 14]); pr.push([Ro, W - 0.07], [Ro - 0.02, W - 0.02]); for (let i = 8; i >= 0; i--) pr.push([Ri + (Ro - 0.06 - Ri) * i / 8, W]);
      const g = lath(pr, 96); const p = g.attributes.position, cA = col(colA), cB = col(colB), cs = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { const px = p.getX(i), py = p.getY(i), pz = p.getZ(i), r = Math.hypot(px, pz), an = Math.atan2(pz, px); let t;
        if (r > Ro - 0.03) { const s = an * Ro; t = pattern === 'check' ? ((Math.floor((s + py) / 0.55) + Math.floor((s - py) / 0.55)) & 1) * 0.85 : (0.5 + 0.5 * Math.cos(s * 9.0)) * 0.25; }
        else t = (Math.floor((r - Ri) / 0.11) & 1) * 0.12; const c = cA.clone().lerp(cB, t); cs.set([c.r, c.g, c.b], i * 3); }
      g.userData.cols = cs; return g; };
    const core = (Ri, W) => { const g = lath([[Ri - 0.28, -0.02], [Ri, -0.02], [Ri, W + 0.02], [Ri - 0.28, W + 0.02], [Ri - 0.28, -0.02]], 96); return g; };
    // 宽卷：立着，轴沿 x 偏 25°
    const yawA = 0.45, Ro = 2.55, Ri = 1.62, W = 1.55;
    add(roll(Ro, Ri, W, 0xFFE3CF, 0xF48C7A, 'check'), 'vc', [x - W / 2 * Math.cos(yawA), Ro, z + W / 2 * Math.sin(yawA)], [0, yawA, -Math.PI / 2]);
    add(core(Ri, W), (p) => col(0xD9B48A).multiplyScalar(Math.hypot(p.x, p.z) < Ri - 0.1 ? (Math.floor((Math.atan2(p.z, p.x) + 3.2) * 18) % 2 ? 0.93 : 1.0) : 1.0), [x - W / 2 * Math.cos(yawA), Ro, z + W / 2 * Math.sin(yawA)], [0, yawA, -Math.PI / 2]);
    // 窄卷：薄荷细条纹，斜靠在宽卷侧面
    const Ro2 = 1.9, Ri2 = 1.25, W2 = 0.85, sx = x + 1.15, sz = z + 0.75;
    add(roll(Ro2, Ri2, W2, 0xBFE6D6, 0x8FD0B8, 'stripe'), 'vc', [sx + 1.45, 0.58, sz - 0.2], [0.0, 0, -0.3]);   // 平放、一边斜搭在宽卷上
    add(core(Ri2, W2), 0xE4C9A0, [sx + 1.45, 0.58, sz - 0.2], [0.0, 0, -0.3]);
    // 撕下的尾巴：从宽卷底部切线方向贴着台面伸出 3.2，末端 0.6 翘起，齿状撕口
    { const N = 40, pos = [], idx = [], cs = []; const ax = new THREE.Vector3(Math.cos(yawA), 0, -Math.sin(yawA)), fw = new THREE.Vector3(Math.sin(yawA), 0, Math.cos(yawA));
      const c0 = new THREE.Vector3(x, 0, z); const cA = col(0xFFE3CF), cB = col(0xF48C7A);
      for (let i = 0; i <= N; i++) { const t = i / N; let p, th;
        if (t < 0.25) { th = -Math.PI / 2 + (1 - t / 0.25) * 0.55; p = c0.clone().addScaledVector(fw, Math.cos(th) * (Ro + 0.012)).setY(Ro + Math.sin(th) * (Ro + 0.012)); }
        else { const s = (t - 0.25) / 0.75 * 3.2; p = c0.clone().addScaledVector(fw, s).setY(0.12 + Math.max(0, s - 2.6) * Math.max(0, s - 2.6) * 0.8); }
        const tear = i === N ? 1 : 0;
        for (const k of [-1, 1]) { const q = p.clone().addScaledVector(ax, k * W / 2 + (tear ? 0 : 0)); if (tear) q.addScaledVector(fw, (k > 0 ? 0.08 : -0.05)); pos.push(q.x, q.y, q.z);
          const s2 = (i / N) * 4 * 1.0, ch = ((Math.floor((s2 + k * 0.4) / 0.55) + Math.floor((s2 - k * 0.4) / 0.55)) & 1) * 0.85; const c = cA.clone().lerp(cB, ch); cs.push(c.r, c.g, c.b); } }
      for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); g.userData.cols = new Float32Array(cs);
      add(g, 'vc'); } }
  PIV = null; SILL = false;

  // 台灯（右后，白天不开）——不投影（避免长影横穿画面）
  PIV = null; SILL = false; const lampStart = parts.length;
  { const x = 128, z = -20;
    add(lathe([[0, 0], [6.4, 0], [6.6, 0.6], [6.2, 1.6], [0, 1.6]], 40), P.cream, [x, 0, z]);
    add(new THREE.CylinderGeometry(0.6, 0.6, 26, 16), P.cream, [x - 2.2, 14, z + 0.6], [0.05, 0, 0.17]);
    add(new THREE.SphereGeometry(1.1, 16, 12), P.honey, [x - 4.4, 27, z + 1.2]);
    add(new THREE.CylinderGeometry(0.55, 0.55, 15, 16), P.cream, [x - 10.5, 25.5, z + 4], [0.35, 0, 1.25]);
    const shade = lathe([[2.0, 0], [2.2, 0.4], [6.8, -7.6], [7.0, -8.0]], 40);
    add(shade, 0xFFE7B8, [x - 17.5, 24.5, z + 6.5], [0.35, 0, 0.55]); }
  const lampParts = parts.splice(lampStart, parts.length - lampStart);
  // （马克杯、橘子、和纸胶带见上方高细分小物）
  // ---------- 合并网格：一次绘制 ----------
  const roomMat = new THREE.ShaderMaterial({
    lights: true, vertexColors: true, side: THREE.DoubleSide,
    uniforms: Object.assign(THREE.UniformsUtils.merge([THREE.UniformsLib.lights]), shared),
    vertexShader: VERT.replace('void main(){', 'varying vec3 vCol;\nvoid main(){ vCol = color;'),
    fragmentShader: FRAG_HEAD + /* glsl */`
varying vec3 vCol;
void main(){
  vec3 N = normalize(vWN); if(!gl_FrontFacing) N = -N;
  float sm = getShadowMask();
  vec3 c = stylizedLight(vCol, N, sm);
  c = mix(c, vCol*uAmb, 0.08);   // 屋里的暗面略透气（保留明暗结构）
  // 插画式剪影：轮廓处收一圈暖可可暗边；受光的上沿一道细亮边
  vec3 V = normalize(cameraPosition - vWP); float nv = abs(dot(N, V));
  float rim = 1.0 - smoothstep(0.12, 0.42, nv);
  c = mix(c, c * vec3(0.66, 0.47, 0.38), rim * 0.55);
  c += vec3(1.0, 0.93, 0.8) * 0.10 * (1.0 - smoothstep(0.0, 0.25, nv)) * max(dot(N, uSunDir), 0.0) * windowCookie(vWP);
  // 来自被晒亮的桌面的暖色反光：朝下、朝屋里的面略提亮
  c += vCol * vec3(1.0,0.86,0.66) * 0.10 * clamp(-N.y*0.6 + N.z*0.4 + 0.3, 0.0, 1.0);
  gl_FragColor = vec4(c, outA());
  #include <colorspace_fragment>
}` });
  const room = new THREE.Mesh(merged(), roomMat); room.castShadow = true; room.receiveShadow = true; scene.add(room);
  parts.length = 0; parts.push(...archGeoParts, ...lampParts, ...sillParts);
  const arch = new THREE.Mesh(merged(), roomMat); arch.receiveShadow = true; scene.add(arch); // 窗框等不投影：窗格影由光斑函数负责

  // ---------- 墙：奶油灰泥，背光；越靠近被晒亮的桌面越暖越亮 ----------
  const wallMat = new THREE.ShaderMaterial({
    lights: true, uniforms: Object.assign(THREE.UniformsUtils.merge([THREE.UniformsLib.lights]), shared, { uBase: { value: col(0xFCEBD3) }, uLow: { value: col(0xCFE6D3) }, uTrim: { value: col(P.trim) } }),
    vertexShader: VERT, fragmentShader: FRAG_HEAD + /* glsl */`
uniform vec3 uBase; uniform vec3 uLow; uniform vec3 uTrim;
void main(){
  // 护墙板分色：桌面以上 0–26 是柔蜜桃，上方奶油；分界一条 1.2 奶油白线脚
  float y = vWP.y;
  vec3 base = mix(uLow, uBase, smoothstep(9.6, 10.0, y));
  base = mix(base, uTrim, (1.0 - smoothstep(0.0, 0.08, abs(y - 10.6) - 0.6)));
  base *= 1.0 + (hash12(floor(vWP.xy/0.6))-0.5)*0.012;            // 极淡灰泥颗粒
  // 护墙板：竖向企口板，每 6.5 一道细槽（左暗右亮）
  if (y < 9.6) { float u = fract(vWP.x / 6.5); float fw = fwidth(vWP.x / 6.5);
    base *= 1.0 - 0.10 * (1.0 - smoothstep(0.0, 0.035 + fw, u)); base *= 1.0 + 0.05 * (1.0 - smoothstep(0.0, 0.03 + fw, abs(u - 0.06))); }
  vec3 c = base * mix(uAmb, vec3(1.0), 0.15) * mix(vec3(1.0), uShadowTint, uShadowStr*0.35);   // 背光的墙：亮、暖、不灰
  float bounce = 0.55*exp(-max(y,0.0)/60.0) * exp(-abs(vWP.x+6.0)/80.0);                  // 被晒亮的桌面反上来的暖光
  c = mix(c, base*vec3(1.02,0.97,0.88), bounce);
  float nearWin = 1.0 - smoothstep(0.0, 30.0, sdRoundBox(vWP.xy - uWin.xy, uWin.zw + 4.5, 2.0));
  c = mix(c, base*vec3(1.02,0.99,0.93), nearWin*0.35);              // 窗洞周围被天光照亮
  gl_FragColor = vec4(c, outA());
  #include <colorspace_fragment>
}` });
  const wall = new THREE.Mesh(wallGeo, wallMat); wall.receiveShadow = true; scene.add(wall);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(800, 600), new THREE.ShaderMaterial({ uniforms: { uC: { value: col(P.floor) } },
    vertexShader: `varying vec3 vWP; void main(){ vWP=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vWP,1.0); }`,
    fragmentShader: `uniform vec3 uC; varying vec3 vWP; void main(){ gl_FragColor = vec4(uC*0.92, distance(vWP,cameraPosition));
#include <colorspace_fragment>
}` }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -76; scene.add(floor);

  // 高分辨率手绘绘本风窗景（3200×2400，不再整体模糊；只靠景深与空气感柔化）：层叠棉花糖云、薄荷渐变山丘、暖橘屋顶、圆冠树剪影
  const cv = document.createElement('canvas'); cv.width = 3200; cv.height = 2400; const g = cv.getContext('2d'); g.scale(2, 2);
  const sky = g.createLinearGradient(0, 0, 0, 1200); sky.addColorStop(0, '#6DB4E6'); sky.addColorStop(0.45, '#9CCDEF'); sky.addColorStop(0.72, '#DDEFF0'); sky.addColorStop(1, '#FBE9CC');
  g.fillStyle = sky; g.fillRect(0, 0, 1600, 1200);
  const sunG = g.createRadialGradient(260, 140, 10, 260, 140, 700); sunG.addColorStop(0, 'rgba(255,250,232,0.95)'); sunG.addColorStop(1, 'rgba(255,250,232,0)'); g.fillStyle = sunG; g.fillRect(0, 0, 1600, 1200);
  const blob = (cx, cy, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); };
  // 棉花糖云：底层暖粉影 → 中层奶油 → 顶层白 + 受光边
  const puffs = [[0, 0, 60], [70, -28, 76], [150, -4, 64], [215, 16, 46], [-62, 18, 44], [92, 26, 62], [30, 30, 50], [175, 30, 44]];
  const cloud = (x, y, s) => { for (const [dx, dy, r] of puffs) blob(x + dx * s + 6 * s, y + dy * s + 16 * s, r * s, 'rgba(246,196,186,0.55)');
    for (const [dx, dy, r] of puffs) blob(x + dx * s + 2 * s, y + dy * s + 6 * s, r * s * 0.98, '#FFF1E2');
    for (const [dx, dy, r] of puffs) blob(x + dx * s - 3 * s, y + dy * s - 2 * s, r * s * 0.9, '#FFFEFA');
    g.save(); g.globalAlpha = 0.5; g.fillStyle = '#F7D9D0'; g.beginPath(); g.ellipse(x + 75 * s, y + 52 * s, 170 * s, 14 * s, 0, 0, 7); g.fill(); g.restore(); };
  cloud(700, 290, 1.1); cloud(1190, 420, 0.82); cloud(390, 520, 0.6); cloud(1420, 230, 0.5);
  // 远山（淡蓝紫）→ 两层薄荷山丘（上亮下深的渐变）
  g.fillStyle = '#BCD2EA'; g.beginPath(); g.moveTo(0, 900); for (let x = 0; x <= 1600; x += 10) g.lineTo(x, 860 - 60 * Math.sin(x / 260) - 30 * Math.sin(x / 90)); g.lineTo(1600, 1200); g.lineTo(0, 1200); g.fill();
  const hill = (y0, amp, f, ph, cTop, cBot) => { const gr = g.createLinearGradient(0, y0 - amp, 0, 1200); gr.addColorStop(0, cTop); gr.addColorStop(1, cBot); g.fillStyle = gr; g.beginPath(); g.moveTo(0, 1200);
    for (let x = 0; x <= 1600; x += 8) g.lineTo(x, y0 - amp * Math.sin(x / f + ph)); g.lineTo(1600, 1200); g.fill(); };
  hill(930, 40, 200, 1, '#BFE5C8', '#8FCBA8');
  // 圆冠小树剪影（远处一排）
  for (const [x, r, c] of [[620, 34, '#86C4A0'], [690, 26, '#7BBB98'], [1300, 30, '#86C4A0'], [1360, 40, '#79B996'], [1440, 24, '#8ACBA5']]) { g.fillStyle = '#B48E6E'; g.fillRect(x - 3, 930 - r * 0.3, 6, r * 1.2); blob(x, 930 - r * 1.1, r, c); blob(x - r * 0.35, 930 - r * 1.3, r * 0.6, 'rgba(214,240,190,0.55)'); }
  // 小屋：奶白墙 + 暖橘屋顶 + 小窗
  for (const [x, w, c] of [[820, 70, '#F49A5E'], [920, 54, '#FFB58E'], [1010, 80, '#F2A24A'], [1120, 60, '#F07E62']]) { g.fillStyle = '#FFF6E6'; g.fillRect(x, 950, w, 60); g.fillStyle = 'rgba(214,170,140,0.35)'; g.fillRect(x + w * 0.6, 950, w * 0.4, 60);
    g.fillStyle = c; g.beginPath(); g.moveTo(x - 9, 953); g.lineTo(x + w / 2, 906); g.lineTo(x + w + 9, 953); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(x - 9, 953); g.lineTo(x + w / 2, 906); g.lineTo(x + w / 2 - 4, 912); g.lineTo(x - 2, 950); g.fill();
    g.fillStyle = '#9CCBEB'; g.fillRect(x + w * 0.3, 968, w * 0.22, 16); g.fillStyle = '#E8A87C'; g.fillRect(x + w * 0.62, 978, w * 0.16, 32); }
  hill(1010, 26, 150, 2.4, '#A8DDB8', '#7FC09C');
  // 近处圆冠树（左上）：背光薄荷 + 受光暖黄绿，边缘干净
  g.fillStyle = '#B48E6E'; g.fillRect(150, 520, 40, 700); g.fillStyle = '#9C7656'; g.fillRect(172, 520, 18, 700);
  for (let i = 0; i < 46; i++) { const a = i * 2.39996, rr = 40 + (i % 7) * 24; blob(170 + Math.cos(a) * rr * 2.2, 330 + Math.sin(a) * rr * 1.4, 80 - (i % 5) * 8, i % 3 ? '#7CC2A2' : '#62B08F'); }
  for (let i = 0; i < 30; i++) { const a = i * 2.39996, rr = 30 + (i % 6) * 22; blob(230 + Math.cos(a) * rr * 2.0, 300 + Math.sin(a) * rr * 1.2, 52 - (i % 4) * 8, i % 2 ? '#C3E39E' : '#DCE59A'); }
  const viewTex = new THREE.CanvasTexture(cv); viewTex.colorSpace = THREE.SRGBColorSpace; viewTex.anisotropy = 8;
  const view = new THREE.Mesh(new THREE.PlaneGeometry(320, 240), new THREE.ShaderMaterial({ uniforms: { uMap: { value: viewTex }, uTime: shared.uTime },
    vertexShader: `varying vec2 vUv; varying vec3 vWP; void main(){ vUv=uv; vWP=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vWP,1.0); }`,
    fragmentShader: `uniform sampler2D uMap; varying vec2 vUv; varying vec3 vWP; void main(){ gl_FragColor = vec4(texture2D(uMap, vUv).rgb, min(distance(vWP,cameraPosition), 210.0)); // 窗外景按 ≤210 记距：只柔焦，不叠远景暖雾
#include <colorspace_fragment>
}` }));
  view.position.set(WIN.cx + 30, WIN.cy + 22, WIN.glassZ - 95); scene.add(view);

  // ---------- 纱帘：左侧一幅，透光；褶皱和轻摆在顶点着色器里 ----------
  const cw = WIN.curtainX + 5 - (ox0 - 7), chh = rodY - (oy0 - 3);
  const curGeo = new THREE.PlaneGeometry(cw, chh, 96, 48);
  const curMat = keepAlpha(new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: { uTime: shared.uTime, uWin: shared.uWin, uC: { value: col(P.cream) }, uShade: { value: col(0xF3D9BC) }, uCW: { value: cw }, uCH: { value: chh } },
    vertexShader: `uniform float uTime; varying vec3 vWP; varying float vF; varying vec2 vUv;
      uniform float uCW; uniform float uCH;
      void main(){ vUv = uv; vec3 p = position; float sway = sin(uTime*0.6 + p.y*0.03)*0.9*(1.0-uv.y);
        // 绑带处收窄（束向墙边），上下逐渐放开；越靠近绑带褶皱越密越深
        float yT = -uCH*0.5 + uCH*0.36; float k = exp(-pow((p.y - yT)/(uCH*0.20), 2.0)); float kb = p.y < yT ? 0.55 + 0.45*exp(-pow((p.y - yT)/(uCH*0.12), 2.0)) : k;
        float sq = 0.58*kb; p.x = -uCW*0.5 + (p.x + uCW*0.5)*(1.0 - sq);
        float fr = 0.85 * (1.0 + 1.3*kb);
        float f = sin(position.x*fr + sway*0.6); p.z += f*(1.4 + 1.2*kb) + sway*(1.0 - kb); vF = cos(position.x*fr + sway*0.6);
        vWP = (modelMatrix*vec4(p,1.0)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vWP,1.0); }`,
    fragmentShader: `uniform vec4 uWin; uniform vec3 uC; uniform vec3 uShade; varying vec3 vWP; varying float vF; varying vec2 vUv;
      float sdB(vec2 p, vec2 b){ vec2 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,q.y),0.0); }
      void main(){
        float back = 1.0 - smoothstep(-3.0, 3.0, sdB(vWP.xy - uWin.xy, uWin.zw));     // 背后是窗：被天光透亮
        vec3 c = mix(uShade, uC, 0.55 + 0.45*vF);
        c = mix(c, vec3(1.0,0.985,0.95), back*0.75);
        float a = mix(0.82, 0.5, back) * (0.92 + 0.08*vF);
        float hem = smoothstep(0.0, 0.006, vUv.y);
        float hemBand = 1.0 - smoothstep(0.022, 0.026, vUv.y);                        // 下摆双层折边：更不透、略深，一道细缝线
        c = mix(c, c*vec3(0.96,0.93,0.9), hemBand*0.6); a = mix(a, min(a + 0.18, 0.95), hemBand);
        c *= 1.0 - 0.08*(1.0 - smoothstep(0.0, 0.002, abs(vUv.y - 0.019)));
        gl_FragColor = vec4(c, a*hem);
        #include <colorspace_fragment>
      }` }));
  const curtain = new THREE.Mesh(curGeo, curMat); curtain.position.set(ox0 - 7 + cw / 2, (rodY + oy0 - 3) / 2, WIN.wallZ + 3.2); curtain.renderOrder = 5; scene.add(curtain);

  // ---------- 软木板（窗右侧墙上）：暖色软木颗粒 + 斜角拼接木框；便签纸角微翘带影、彩色图钉高光、小票与拍立得 ----------
  const pb = { x: 38.5, y: 25, w: 20, h: 14.6 }; // 画面内容按 26×19 的版面画，再缩到 20×14.6 的小板
  const cvp = document.createElement('canvas'); cvp.width = 2600; cvp.height = 1900; const gp = cvp.getContext('2d'); const K = 2600 / 26;
  gp.fillStyle = '#E9BE86'; gp.fillRect(0, 0, cvp.width, cvp.height);
  { const rnd = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    for (let i = 0; i < 26000; i++) { const x = rnd() * cvp.width, y = rnd() * cvp.height, r = 1.2 + rnd() * 4.5, t = rnd();
      gp.fillStyle = t < 0.35 ? 'rgba(176,112,66,0.16)' : t < 0.7 ? 'rgba(255,236,204,0.20)' : 'rgba(214,150,92,0.18)'; gp.beginPath(); gp.ellipse(x, y, r, r * (0.6 + rnd() * 0.5), rnd() * 3, 0, 7); gp.fill(); }
    for (let i = 0; i < 900; i++) { gp.fillStyle = 'rgba(140,86,50,0.22)'; gp.beginPath(); gp.arc(rnd() * cvp.width, rnd() * cvp.height, 0.8 + rnd() * 1.6, 0, 7); gp.fill(); } }
  // 纸卡：投影（右下）+ 一个角微微翘起（角上受光的渐变 + 角下更深的影）
  const card = (x, y, w, h, r, fill, draw, curl = 1) => { gp.save(); gp.translate(x * K, y * K); gp.rotate(r);
    gp.shadowColor = 'rgba(160,96,58,0.38)'; gp.shadowBlur = 0.35 * K; gp.shadowOffsetX = 0.08 * K; gp.shadowOffsetY = 0.18 * K; gp.fillStyle = fill;
    gp.beginPath(); gp.moveTo(-w / 2 * K, -h / 2 * K); gp.lineTo(w / 2 * K, -h / 2 * K); gp.lineTo(w / 2 * K, (h / 2 - 1.1 * curl) * K); gp.quadraticCurveTo(w / 2 * K, h / 2 * K, (w / 2 - 1.1 * curl) * K, h / 2 * K); gp.lineTo(-w / 2 * K, h / 2 * K); gp.closePath(); gp.fill();
    gp.shadowColor = 'transparent'; if (draw) draw(gp, w * K, h * K);
    if (curl) { const gr = gp.createLinearGradient((w / 2 - 1.6) * K, (h / 2 - 1.6) * K, w / 2 * K, h / 2 * K); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, 'rgba(255,250,240,0.55)'); gr.addColorStop(1, 'rgba(170,110,70,0.25)');
      gp.fillStyle = gr; gp.beginPath(); gp.moveTo((w / 2 - 1.6) * K, h / 2 * K); gp.lineTo(w / 2 * K, (h / 2 - 1.6) * K); gp.lineTo(w / 2 * K, (h / 2 - 1.1) * K); gp.quadraticCurveTo(w / 2 * K, h / 2 * K, (w / 2 - 1.1) * K, h / 2 * K); gp.closePath(); gp.fill(); }
    gp.restore(); };
  const pin = (x, y, c) => { gp.fillStyle = 'rgba(150,90,52,0.42)'; gp.beginPath(); gp.ellipse(x * K + 0.22 * K, y * K + 0.3 * K, 0.55 * K, 0.42 * K, 0.3, 0, 7); gp.fill();
    const gr = gp.createRadialGradient(x * K - 0.18 * K, y * K - 0.2 * K, 0.05 * K, x * K, y * K, 0.6 * K); gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(0.25, c); gr.addColorStop(1, c); gp.fillStyle = gr; gp.beginPath(); gp.arc(x * K, y * K, 0.55 * K, 0, 7); gp.fill();
    gp.strokeStyle = 'rgba(90,59,46,0.25)'; gp.lineWidth = 0.04 * K; gp.stroke(); };
  card(8.5, 9.5, 10, 12, -0.06, '#FFFDF8', (c, w, h) => { // 小太阳涂鸦 + “今天也是晴天”
    c.strokeStyle = '#F2B65A'; c.lineWidth = 0.25 * K; c.lineCap = 'round'; c.beginPath(); c.arc(0, -h * 0.12, 1.6 * K, 0, 7); c.stroke();
    for (let i = 0; i < 10; i++) { const a = i / 10 * 7; c.beginPath(); c.moveTo(Math.cos(a) * 2.3 * K, -h * 0.12 + Math.sin(a) * 2.3 * K); c.lineTo(Math.cos(a) * 3.0 * K, -h * 0.12 + Math.sin(a) * 3.0 * K); c.stroke(); }
    c.fillStyle = '#5A3B2E'; c.font = `${1.6 * K}px WenKai`; c.textAlign = 'center'; c.fillText('今天也是晴天', 0, h * 0.36); });
  card(21, 8.5, 9, 6.5, 0.07, '#FFF1D6', (c, w, h) => { const cs = ['#FFF6E6', '#FFD66B', '#F7B98A', '#F48C7A', '#A8DCC8']; cs.forEach((cc, i) => { c.fillStyle = cc; c.beginPath(); c.arc((-3.2 + i * 1.6) * K, -0.4 * K, 0.65 * K, 0, 7); c.fill(); }); c.fillStyle = '#5A3B2E'; c.font = `${0.9 * K}px WenKai`; c.textAlign = 'center'; c.fillText('晴窗手账', 0, 2.3 * K); }, 0.7);
  // 小票（锯齿下沿）
  card(15.2, 4.6, 3.6, 6.2, 0.1, '#FFFEFA', (c, w, h) => { c.fillStyle = 'rgba(90,59,46,0.55)'; for (let i = 0; i < 6; i++) c.fillRect(-w * 0.35, (-h * 0.35 + i * 0.75 * K), (i % 2 ? 0.5 : 0.7) * w, 0.12 * K); c.fillStyle = '#E9BE86'; for (let x = -w / 2; x < w / 2; x += 0.4 * K) { c.beginPath(); c.moveTo(x, h / 2 + 1); c.lineTo(x + 0.2 * K, h / 2 - 0.2 * K); c.lineTo(x + 0.4 * K, h / 2 + 1); c.fill(); } }, 0);
  // 拍立得（晴天小云）
  card(23, 17, 7.2, 8.2, -0.08, '#FFFDF8', (c, w, h) => { const gr = c.createLinearGradient(0, -h * 0.4, 0, h * 0.2); gr.addColorStop(0, '#8EC5EC'); gr.addColorStop(1, '#E4F1F6'); c.fillStyle = gr; c.fillRect(-w * 0.42, -h * 0.42, w * 0.84, h * 0.66);
    c.fillStyle = '#FFFDF8'; for (const [x, y, r] of [[-0.8, -0.6, 0.7], [0, -0.9, 0.95], [0.9, -0.6, 0.65]]) { c.beginPath(); c.arc(x * K, y * K, r * K, 0, 7); c.fill(); } c.fillStyle = '#A9D6B6'; c.fillRect(-w * 0.42, h * 0.08, w * 0.84, h * 0.16);
    c.fillStyle = '#5A3B2E'; c.font = `${0.75 * K}px WenKai`; c.textAlign = 'center'; c.fillText('记得收贴纸', 0, h * 0.4); });
  card(9.5, 18.6, 7, 2.6, 0.04, 'rgba(168,220,200,0.92)', null, 0); // 一段薄荷和纸胶带
  gp.save(); gp.translate(16.2 * K, 15.6 * K); gp.shadowColor = 'rgba(160,96,58,0.35)'; gp.shadowBlur = 0.25 * K; gp.shadowOffsetY = 0.12 * K; gp.fillStyle = '#FFFDF8'; gp.beginPath(); gp.arc(0, 0, 2.3 * K, 0, 7); gp.fill(); gp.shadowColor = 'transparent';
  gp.fillStyle = '#F5A04A'; gp.beginPath(); gp.arc(0, 0.1 * K, 1.8 * K, 0, 7); gp.fill(); gp.strokeStyle = 'rgba(150,84,48,0.7)'; gp.lineWidth = 0.06 * K; gp.stroke(); gp.fillStyle = '#86C4AE'; gp.beginPath(); gp.ellipse(0.5 * K, -1.8 * K, 0.7 * K, 0.35 * K, -0.4, 0, 7); gp.fill(); gp.restore();
  pin(8.5, 4.2, '#F48C7A'); pin(21, 6, '#FFD66B'); pin(23, 13.6, '#9CCBEB'); pin(15.2, 2.2, '#C9B6E4');
  const pbTex = new THREE.CanvasTexture(cvp); pbTex.colorSpace = THREE.SRGBColorSpace; pbTex.anisotropy = 8;
  const pbMat = new THREE.ShaderMaterial({ lights: true, uniforms: Object.assign(THREE.UniformsUtils.merge([THREE.UniformsLib.lights]), shared, { uMap: { value: pbTex } }),
    vertexShader: VERT, fragmentShader: FRAG_HEAD + `uniform sampler2D uMap; void main(){ vec3 b = texture2D(uMap, vUv).rgb; vec3 c = stylizedLight(b, vec3(0.0,0.0,1.0), getShadowMask()); c = mix(c, b*vec3(1.0,0.96,0.88), 0.25); gl_FragColor = vec4(c, outA());
#include <colorspace_fragment>
}` });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(pb.w, pb.h), pbMat); board.position.set(pb.x, pb.y, WIN.wallZ + 1.25); scene.add(board);
  // 软木板外框单独加进一个小合并网格（同房间材质）
  parts.length = 0;
  { // 单块带圆角镂空的连续木框（避免四条 45° 斜接框条在倒角处向外尖出形成角刺）
    const fw = 1.25, fd = 1.2, rad = 0.3; const W2 = pb.w / 2, H2 = pb.h / 2;
    const rrPath = (path, x0, y0, x1, y1, r, cw = false) => {
      if (!cw) {
        path.moveTo(x0 + r, y0);
        path.lineTo(x1 - r, y0); path.quadraticCurveTo(x1, y0, x1, y0 + r);
        path.lineTo(x1, y1 - r); path.quadraticCurveTo(x1, y1, x1 - r, y1);
        path.lineTo(x0 + r, y1); path.quadraticCurveTo(x0, y1, x0, y1 - r);
        path.lineTo(x0, y0 + r); path.quadraticCurveTo(x0, y0, x0 + r, y0);
      } else {
        path.moveTo(x0 + r, y0);
        path.quadraticCurveTo(x0, y0, x0, y0 + r);
        path.lineTo(x0, y1 - r); path.quadraticCurveTo(x0, y1, x0 + r, y1);
        path.lineTo(x1 - r, y1); path.quadraticCurveTo(x1, y1, x1, y1 - r);
        path.lineTo(x1, y0 + r); path.quadraticCurveTo(x1, y0, x1 - r, y0);
        path.lineTo(x0 + r, y0);
      }
      path.closePath();
    };
    const sh = new THREE.Shape(); rrPath(sh, -W2 - fw, -H2 - fw, W2 + fw, H2 + fw, rad);
    const hole = new THREE.Path(); rrPath(hole, -W2, -H2, W2, H2, 0.001, true); sh.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(sh, { depth: fd, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.12, bevelSegments: 4, curveSegments: 8 });
    add(g, (p) => col(0x9A6A4C).multiplyScalar(1 + 0.05 * Math.sin(p.x * 3.1 + p.y * 2.2 + Math.sin(p.x * 0.7 + p.y * 0.5) * 2)), [pb.x, pb.y, WIN.wallZ + 0.7]); }
  const pbFrame = new THREE.Mesh(merged(), roomMat); scene.add(pbFrame);

  // ---------- 窗口天光的柔光晕（假泛光，叠加）----------
  const glow = new THREE.Mesh(new THREE.PlaneGeometry((WIN.hw + 26) * 2, (WIN.hh + 26) * 2), keepAlpha(new THREE.ShaderMaterial({ uniforms: { uO: { value: 0.10 }, uR: { value: new THREE.Vector2(WIN.hw, WIN.hh) } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uO; uniform vec2 uR; varying vec2 vP; void main(){ vec2 q = abs(vP)-uR; float d = length(max(q,0.0)); float a = exp(-d/9.0)*uO; gl_FragColor = vec4(1.0,0.96,0.86, a);
#include <colorspace_fragment>
}` }), true));
  glow.position.set(WIN.cx, WIN.cy, WIN.wallZ + 3.6); glow.renderOrder = 6; scene.add(glow);

  return { PP, room, wall, curtain, view, board, glow, keyPoints: {
    window: [[ox0 - 10, oy0 - 3, WIN.wallZ], [ox1, oy0 - 3, WIN.wallZ]],
    plant: [-20, 22, -19], lamp: [54, 28, -18], shelf: [shX1, shY + 20, shZ], mug: [33, 9, 6], orange: [-16, 6, 8], pencil: [21, 18, -19],
  } };
}
