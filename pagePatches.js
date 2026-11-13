// 晴窗手账 · 内页真 3D 贴片系统
// 页面上的便签、车票、信封、口袋、邮票、贴纸……不再画进页面底图，而是各自成为有厚度、会翘角的 3D 贴片：
//   顶面细分网格（高清图集贴图）+ 沿真实轮廓的侧壁（Side Skirt）；按材质合批（实心 / 半透明软层 / 不受光海报 / 金属丝与棉绳）。
//   所有贴片顶点用页面坐标（cmX 从页面左缘、cmY 从天头、h 离纸面高度）描述，逐帧映射到所在页面槽位的真实曲面：
//   right / left（静态书芯，含 prof(x) 订口下沉）与 turnFront / turnBack（翻页网格，逐顶点双线性插值）。
// 单位：厘米。
export const SUN_OFF = [0.51, 0.89];   // 太阳 (-0.36, 0.70, -0.62) 在纸面上的投影偏移：每 1cm 高度 → (+x 0.51, +y 0.89)
const SH = 40000;

// ---------- 高度函数构件（局部坐标：以贴片中心为原点，lx 向右，ly 向下；hw/hh 半宽高） ----------
export const L = {
  corner: (sx, sy, amt, r) => (lx, ly, hw, hh) => { const d = Math.hypot(lx - sx * hw, ly - sy * hh); const f = Math.max(0, 1 - d / r); return amt * f * f; },
  edge: (side, amt, r, wave = 0, waves = 2) => (lx, ly, hw, hh) => {
    const d = side === 'b' ? hh - ly : side === 't' ? ly + hh : side === 'r' ? hw - lx : lx + hw; const f = Math.max(0, 1 - d / r);
    const along = side === 'b' || side === 't' ? (lx + hw) / (2 * hw) : (ly + hh) / (2 * hh);
    return amt * f * f * (1 - wave + wave * (0.5 + 0.5 * Math.sin(along * Math.PI * 2 * waves + 0.7))); },
  pillow: (amt) => (lx, ly, hw, hh) => amt * Math.max(0, 1 - (lx / hw) ** 2) * Math.max(0, 1 - (ly / hh) ** 2),
  arch: (amt) => (lx, ly, hw, hh) => amt * Math.max(0, 1 - (lx / hw) ** 2) ** 0.7 * Math.max(0, 1 - (ly / hh) ** 2) ** 0.7,
  dome: (amt, R) => (lx, ly) => amt * Math.max(0, 1 - (lx * lx + ly * ly) / (R * R)),
  // 口袋：左右与底边贴死，上沿口张开（中部最鼓）
  pocket: (amt) => (lx, ly, hw, hh) => amt * Math.pow(Math.max(0, 1 - (lx / hw) ** 2), 0.42) * Math.pow(Math.max(0, (hh - ly) / (2 * hh)), 1.6),
  tilt: (ax, ay) => (lx, ly, hw, hh) => Math.max(0, ax * lx / hw + ay * ly / hh),
};

export function createPatchSystem(ctx) {
  const { THREE, S, makeMat, col, prof, book, VERT_HEAD } = ctx;
  const PW = S.PW, PH = S.PH;
  const pages = {};
  const stats = { verts: 0, tris: 0, atlasPx: 0, atlases: 0, updateMs: 0 };

  // ---------------- 材质 ----------------
  const PATCH_VERT = /* glsl */`
#include <common>
#include <shadowmap_pars_vertex>
attribute vec4 aSide; attribute vec3 aPg;
varying vec3 vWP; varying vec3 vWN; varying vec2 vUv; varying vec3 vLP; varying vec3 vLN; varying vec4 vSide; varying vec3 vPg;
void main(){
  vUv = uv; vLP = position; vLN = normal; vSide = aSide; vPg = aPg;
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <project_vertex>
  #include <worldpos_vertex>
  #include <shadowmap_vertex>
  vWP = (modelMatrix*vec4(position,1.0)).xyz;
  vWN = normalize(mat3(modelMatrix)*normal);
}`;
  const GUTTER = /* glsl */`
// 预乘 alpha 的 sRGB 贴图：硬件先按 sRGB 解码（c·a 已在 sRGB 空间相乘），这里还原成线性直通色
vec3 unpremul(vec4 t){ return pow(pow(max(t.rgb, vec3(0.0)), vec3(1.0/2.2)) / max(t.a, 0.004), vec3(2.2)); }
uniform float uSpine; uniform float uLiftP;
varying vec4 vSide; varying vec3 vPg;
vec3 gutterShade(vec3 lit){
  float ds = abs(vPg.x - uSpine);
  float gutter = (1.0 - smoothstep(0.0, 2.3, ds)) * (1.0 - uLiftP);
  vec3 shade = mix(vec3(1.0), uShadowTint, uShadowStr);
  return lit * mix(vec3(1.0), shade, gutter * gutter * 0.85);
}`;
  const solidFrag = GUTTER + /* glsl */`
uniform sampler2D uAtlas;
void main(){
  vec4 t = texture2D(uAtlas, vUv, -0.35);
  float side = step(0.5, vSide.a);
  if(side < 0.5 && t.a < 0.5) discard;
  vec3 tex = unpremul(t);
  float dark = clamp(vSide.a - 1.0, 0.0, 1.0);
  vec3 base = side > 0.5 ? mix(tex, vSide.rgb, 0.72) * (1.0 - 0.38 * dark) : tex;
  vec3 N = normalize(vWN);
  float sm = getShadowMask();
  vec3 c = stylizedLight(base, N, sm) * mix(formShade(N), 1.0, side);
  c += side * base * vec3(1.0, 0.86, 0.66) * 0.10 * max(dot(N, uSunDir), 0.0) * (1.0 - dark); // 切口侧壁迎光一道暖亮
  c = gutterShade(c);
  gl_FragColor = vec4(c, outA());
  #include <colorspace_fragment>
}`;
  const softFrag = GUTTER + /* glsl */`
uniform sampler2D uAtlas;
void main(){
  vec4 t = texture2D(uAtlas, vUv, -0.35);
  if(t.a < 0.012) discard;
  vec3 tex = unpremul(t);
  vec3 N = normalize(vWN); if(!gl_FrontFacing) N = N;
  float sm = getShadowMask();
  vec3 c = stylizedLight(tex, N, sm) * formShade(N);
  // 硫酸纸 / 和纸的微磨砂：受光处一层极淡的乳白散射
  c += vec3(1.0, 0.97, 0.92) * 0.035 * sm;
  c = gutterShade(c);
  gl_FragColor = vec4(c, t.a);
  #include <colorspace_fragment>
}`;
  const posterFrag = /* glsl */`
uniform sampler2D uMap; uniform float uPremul;
vec3 unpremul(vec4 t){ return pow(pow(max(t.rgb, vec3(0.0)), vec3(1.0/2.2)) / max(t.a, 0.004), vec3(2.2)); }
varying vec4 vSide; varying vec3 vPg;
void main(){
  vec4 t = texture2D(uMap, vUv, -0.35);
  if(t.a < 0.5) discard;
  vec3 rgb = uPremul > 0.5 ? unpremul(t) : t.rgb;
  float sm = getShadowMask();
  vec3 shade = mix(vec3(1.0), uShadowTint, uShadowStr);
  gl_FragColor = vec4(rgb * mix(shade, vec3(1.0), sm), -outA());   // 负距离：后期不加光束/雾/景深（海报与 Koko 原图保真）
  #include <colorspace_fragment>
}`;
  const wireFrag = GUTTER + /* glsl */`
uniform vec3 uMetal; uniform vec3 uRed; uniform vec3 uWhite;
void main(){
  vec3 N = normalize(vWN); vec3 V = normalize(cameraPosition - vWP);
  float sm = getShadowMask();
  vec3 c;
  if(vPg.z < 0.5){ // 蜂蜜金弯丝：亮面 + 高光 + 掠射边暖光
    vec3 base = uMetal;
    c = stylizedLight(base, N, sm);
    vec3 H = normalize(uSunDir + V); float nh = max(dot(N, H), 0.0);
    c += vec3(1.0, 0.95, 0.82) * (pow(nh, 60.0) * 0.9 + pow(nh, 8.0) * 0.12) * mix(0.35, 1.0, sm);
    float fr = 1.0 - abs(dot(N, V)); c += base * 0.25 * pow(fr, 2.0);
    c *= 0.92 + 0.08 * N.y;
  } else { // 红白双股棉绳
    float s = vUv.x / 0.36 + vUv.y * 2.0; float f = fract(s); float strand = step(0.5, f);
    float k = fract(s * 2.0); float bulge = sin(k * 3.14159); float groove = 1.0 - smoothstep(0.0, 0.16 + fwidth(s * 2.0), min(k, 1.0 - k));
    vec3 base = mix(uRed, uWhite, strand);
    base *= mix(0.80, 1.04, bulge); base *= 1.0 - groove * 0.26;
    c = stylizedLight(base, N, sm);
    c *= mix(1.0, 0.88, 1.0 - smoothstep(0.1, 0.45, abs(dot(N, V))));
  }
  c = gutterShade(c);
  gl_FragColor = vec4(c, outA());
  #include <colorspace_fragment>
}`;
  const gutterU = () => ({ uSpine: { value: 0 }, uLiftP: { value: 0 } });
  const keepAlpha = (m) => { m.blending = THREE.CustomBlending; m.blendEquation = THREE.AddEquation; m.blendSrc = THREE.SrcAlphaFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor;
    m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor; m.transparent = true; m.depthWrite = false; return m; };
  const mkSolid = (tex) => makeMat(solidFrag, Object.assign({ uAtlas: { value: tex } }, gutterU()), { vertexShader: PATCH_VERT, side: THREE.DoubleSide });
  const mkSoft = (tex) => keepAlpha(makeMat(softFrag, Object.assign({ uAtlas: { value: tex } }, gutterU()), { vertexShader: PATCH_VERT, side: THREE.DoubleSide }));
  const mkPoster = (tex, premul) => makeMat(posterFrag, { uMap: { value: tex }, uPremul: { value: premul ? 1 : 0 } }, { vertexShader: PATCH_VERT, side: THREE.DoubleSide });
  const mkWire = () => makeMat(wireFrag, Object.assign({ uMetal: { value: col(0xE3AE5C) }, uRed: { value: col(0xE0664F) }, uWhite: { value: col(0xFFF6E6) } }, gutterU()), { vertexShader: PATCH_VERT });

  // ---------------- 轮廓：alpha 掩码 → 最大连通块 → Moore 边界追踪 → 弧长重采样 + 平滑 ----------------
  function alphaMask(cv, wcm, hcm, res) {
    const W = Math.max(6, Math.round(wcm * res)), H = Math.max(6, Math.round(hcm * res));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(cv, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data; const m = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) m[i] = d[i * 4 + 3] > 127 ? 1 : 0;
    // 最大连通块（4 邻接）
    const lab = new Int32Array(W * H).fill(-1); let best = -1, bestN = 0; const st = [];
    for (let i = 0; i < W * H; i++) { if (!m[i] || lab[i] >= 0) continue; let n = 0; st.push(i); lab[i] = i;
      while (st.length) { const q = st.pop(); n++; const x = q % W, y = (q / W) | 0;
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) { if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const r = ny * W + nx; if (m[r] && lab[r] < 0) { lab[r] = i; st.push(r); } } }
      if (n > bestN) { bestN = n; best = i; } }
    const main = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) main[i] = lab[i] === best ? 1 : 0;
    // 膨胀一格（压住/覆盖判定用，保守）
    const dil = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; for (let dy = -1; dy <= 1 && !v; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && m[yy * W + xx]) { v = 1; break; } } dil[y * W + x] = v; }
    return { m, main, dil, W, H, rx: W / wcm, ry: H / hcm };
  }
  function traceContour(mk) {
    const { main: m, W, H } = mk; let s = -1; for (let i = 0; i < W * H; i++) if (m[i]) { s = i; break; } if (s < 0) return [];
    const fg = (x, y) => x >= 0 && y >= 0 && x < W && y < H && m[y * W + x] === 1;
    const D = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]];
    const sx = s % W, sy = (s / W) | 0; let cx = sx, cy = sy, bx = sx - 1, by = sy; const b0x = bx, b0y = by;
    const pts = [[cx, cy]]; let visits = 0;
    for (let it = 0; it < 8 * (W + H) * 8; it++) {
      let db = 0; for (let k = 0; k < 8; k++) if (D[k][0] === bx - cx && D[k][1] === by - cy) { db = k; break; }
      let found = false;
      for (let k = 1; k <= 8; k++) { const d = (db + k) % 8, nx = cx + D[d][0], ny = cy + D[d][1];
        if (fg(nx, ny)) { const pd = (db + k - 1) % 8; bx = cx + D[pd][0]; by = cy + D[pd][1]; cx = nx; cy = ny; found = true; break; } }
      if (!found) break;
      if (cx === sx && cy === sy) { if ((bx === b0x && by === b0y) || ++visits > 2) break; }
      pts.push([cx, cy]);
    }
    return pts;
  }
  function resample(pts, N, smoothIt = 2) {
    const n = pts.length; if (n < 3) return pts; const cum = [0];
    for (let i = 1; i <= n; i++) { const a = pts[i - 1], b = pts[i % n]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    const Ltot = cum[n]; const out = []; let j = 0;
    for (let k = 0; k < N; k++) { const t = (k / N) * Ltot; while (cum[j + 1] < t) j++; const a = pts[j], b = pts[(j + 1) % n]; const f = (t - cum[j]) / Math.max(1e-9, cum[j + 1] - cum[j]); out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); }
    let o = out; for (let it = 0; it < smoothIt; it++) o = o.map((p, i) => { const a = o[(i - 1 + N) % N], b = o[(i + 1) % N]; return [0.25 * a[0] + 0.5 * p[0] + 0.25 * b[0], 0.25 * a[1] + 0.5 * p[1] + 0.25 * b[1]]; });
    return { pts: o, len: Ltot };
  }

  // ---------------- 贴片记录 ----------------
  function makeRec(o, idx) {
    const P = Object.assign({ z: 0.02, t: 0.02, g: 'solid', lifts: [], k: 260 }, o); P.idx = idx;
    P.w = o.sp ? o.sp.w : o.w; P.h = o.sp ? o.sp.h : o.h; P.hw = P.w / 2; P.hh = P.h / 2;
    const a = (P.rot || 0) * Math.PI / 180; P.c = Math.cos(a); P.s = Math.sin(a);
    const ex = Math.abs(P.c) * P.hw + Math.abs(P.s) * P.hh, ey = Math.abs(P.s) * P.hw + Math.abs(P.c) * P.hh;
    P.bb = [P.cx - ex, P.cy - ey, P.cx + ex, P.cy + ey];
    P.H = (lx, ly) => { let v = 0; for (const f of P.lifts) v += f(lx, ly, P.hw, P.hh); return v; };
    P.bumps = []; P.floor = o.floor ?? P.z;
    return P;
  }
  const toLocal = (P, x, y) => { const dx = x - P.cx, dy = y - P.cy; return [P.c * dx + P.s * dy, -P.s * dx + P.c * dy]; };
  const toPage = (P, lx, ly) => [P.cx + P.c * lx - P.s * ly, P.cy + P.s * lx + P.c * ly];
  const bbOv = (a, b, m = 0) => a[0] - m < b[2] && b[0] - m < a[2] && a[1] - m < b[3] && b[1] - m < a[3];
  function inside(Q, x, y, dil = false) {
    if (x < Q.bb[0] || x > Q.bb[2] || y < Q.bb[1] || y > Q.bb[3]) return false;
    const [lx, ly] = toLocal(Q, x, y); const mk = Q.mask; const px = Math.floor((lx + Q.hw) * mk.rx), py = Math.floor((ly + Q.hh) * mk.ry);
    if (px < 0 || py < 0 || px >= mk.W || py >= mk.H) return false; return (dil ? mk.dil : mk.m)[py * mk.W + px] === 1;
  }
  function bumpAt(P, x, y) { let b = 0; for (const B of P.bumps) for (const [bx, by] of B.pts) { const d = Math.hypot(x - bx, y - by); if (d < B.r) { const f = 1 - d / B.r; b = Math.max(b, B.amt * f * f * (3 - 2 * f)); } } return b; }
  function softAt(P, x, y) {
    if (!P.grid) return P.floor; const [lx, ly] = toLocal(P, x, y); const G = P.grid;
    const fx = Math.min(Math.max((lx + P.hw) / P.w, 0), 1) * G.nx, fy = Math.min(Math.max((ly + P.hh) / P.h, 0), 1) * G.ny;
    const i = Math.min(Math.floor(fx), G.nx - 1), j = Math.min(Math.floor(fy), G.ny - 1), a = fx - i, b = fy - j, W = G.nx + 1;
    return (G.hs[j * W + i] * (1 - a) + G.hs[j * W + i + 1] * a) * (1 - b) + (G.hs[(j + 1) * W + i] * (1 - a) + G.hs[(j + 1) * W + i + 1] * a) * b;
  }
  function baseAt(P, x, y) {
    if (!P.conform) return P.z;
    let m = 0; for (const Q of P.below) if (Q.g === 'solid' && inside(Q, x, y)) m = Math.max(m, topAt(Q, x, y));
    return Math.max(P.z, m + 0.006);
  }
  function topAt(P, x, y) {
    if (P.g === 'soft') return softAt(P, x, y);
    if (P.on) return topAt(P.on, x, y) + 0.0015;
    const [lx, ly] = toLocal(P, x, y); const base = baseAt(P, x, y);
    let top = base + P.t + P.H(lx, ly) + bumpAt(P, x, y);
    for (const Q of P.cappers) if (inside(Q, x, y, true)) top = Math.min(top, Q.z - 0.008);
    return Math.max(top, base + P.t);
  }
  function stackBelow(P, x, y, skip) { // P 之下（z 更低）的贴片最高顶面
    let m = 0; for (const Q of P.below) if (Q !== skip && inside(Q, x, y)) m = Math.max(m, topAt(Q, x, y)); return m;
  }

  // ---------------- 图集 ----------------
  function packAtlases(list, maxW = 4096, maxH = 4096, pad = 10) {
    if (!list.length) return [];
    const items = list.slice().sort((a, b) => b.sp.cv.height - a.sp.cv.height);
    const atlases = []; let A = null, x = 0, y = 0, rowH = 0;
    const newA = () => { A = { items: [], w: maxW, h: 0 }; atlases.push(A); x = pad; y = pad; rowH = 0; };
    newA();
    for (const it of items) {
      const w = it.sp.cv.width, h = it.sp.cv.height;
      if (x + w + pad > maxW) { x = pad; y += rowH + pad; rowH = 0; }
      if (y + h + pad > maxH) { newA(); }
      it.ax = x; it.ay = y; it.atlas = A; A.items.push(it); x += w + pad; rowH = Math.max(rowH, h); A.h = Math.max(A.h, y + h + pad);
    }
    for (const At of atlases) {
      At.w = Math.min(maxW, Math.max(...At.items.map((i) => i.ax + i.sp.cv.width + pad))); At.h = Math.ceil(At.h / 4) * 4; At.w = Math.ceil(At.w / 4) * 4;
      const cv = document.createElement('canvas'); cv.width = At.w; cv.height = At.h; const g = cv.getContext('2d');
      for (const it of At.items) g.drawImage(it.sp.cv, it.ax, it.ay);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.premultiplyAlpha = true; tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = ctx.maxAniso;
      At.tex = tex; At.cv = cv; stats.atlasPx += At.w * At.h; stats.atlases++;
    }
    return atlases;
  }
  const uvOf = (P, lx, ly) => { const it = P; const kx = it.sp.cv.width / P.w, ky = it.sp.cv.height / P.h; const px = it.ax + (lx + P.hw) * kx, py = it.ay + (ly + P.hh) * ky; return [px / it.atlas.w, 1 - py / it.atlas.h]; };

  // ---------------- 网格构建器 ----------------
  function Builder() { return { pos: [], nor: [], uv: [], side: [], pg: [], idx: [], n: 0 }; }
  function addV(B, x, y, h, nx, ny, nh, u, v, sd, kind = 0) { B.pos.push(x, y, h); B.nor.push(nx, ny, nh); B.uv.push(u, v); B.side.push(sd[0], sd[1], sd[2], sd[3]); B.pg.push(x, y, kind); return B.n++; }
  const NOSIDE = [0, 0, 0, 0];
  function gridDims(P, cell) { return [Math.min(64, Math.max(6, Math.ceil(P.w / cell))), Math.min(64, Math.max(6, Math.ceil(P.h / cell)))]; }
  function topGrid(B, P, hfun, uvf, cell) {
    const [nx, ny] = gridDims(P, cell); const W = nx + 1; const hs = new Float32Array(W * (ny + 1)); const pp = [];
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const lx = -P.hw + (i / nx) * P.w, ly = -P.hh + (j / ny) * P.h; const [x, y] = toPage(P, lx, ly); hs[j * W + i] = hfun(x, y, lx, ly); pp.push([x, y, lx, ly]); }
    const base = B.n; const dx = P.w / nx, dy = P.h / ny;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const h = hs[j * W + i]; const hx = (hs[j * W + Math.min(i + 1, nx)] - hs[j * W + Math.max(i - 1, 0)]) / (dx * (Math.min(i + 1, nx) - Math.max(i - 1, 0)));
      const hy = (hs[Math.min(j + 1, ny) * W + i] - hs[Math.max(j - 1, 0) * W + i]) / (dy * (Math.min(j + 1, ny) - Math.max(j - 1, 0)));
      const lnx = -hx, lny = -hy; const nX = P.c * lnx - P.s * lny, nY = P.s * lnx + P.c * lny; const L2 = Math.hypot(nX, nY, 1);
      const [x, y, lx, ly] = pp[j * W + i]; const [u, v] = uvf(lx, ly);
      addV(B, x, y, h, nX / L2, nY / L2, 1 / L2, u, v, NOSIDE);
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = base + j * W + i, b = a + 1, c = a + W + 1, d = a + W; B.idx.push(a, b, c, a, c, d); }
    return { nx, ny, hs };
  }
  function skirt(B, P, outline, sideRGB) {
    const N = outline.length; if (N < 3) return; let area = 0; for (let i = 0; i < N; i++) { const a = outline[i], b = outline[(i + 1) % N]; area += a[0] * b[1] - b[0] * a[1]; }
    const sg = area > 0 ? 1 : -1; const base = B.n; const kx = P.sp.cv.width / P.w;
    for (let i = 0; i < N; i++) {
      const p = outline[i], a = outline[(i - 1 + N) % N], b = outline[(i + 1) % N]; let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const onx = sg * ty, ony = -sg * tx; // 局部外法线
      const [x, y] = toPage(P, p[0], p[1]); const top = topAt(P, x, y); const base0 = baseAt(P, x, y);
      const lift = top - base0 - P.t; const f = 1 - smooth(0.0, 0.03, lift); const flo = P.conform ? Math.max(0.004, base0 - 0.004) : 0.004;
      const mid = top - P.t, bot = Math.min(mid, mid * (1 - f) + flo * f);
      const [u, v] = uvOf(P, p[0] - onx * 2.0 / kx, p[1] - ony * 2.0 / kx);
      const nX = P.c * onx - P.s * ony, nY = P.s * onx + P.c * ony;
      addV(B, x, y, top, nX, nY, 0, u, v, [sideRGB[0], sideRGB[1], sideRGB[2], 1]);
      addV(B, x, y, mid, nX, nY, 0, u, v, [sideRGB[0], sideRGB[1], sideRGB[2], 1]);
      addV(B, x, y, bot, nX, nY, 0, u, v, [sideRGB[0], sideRGB[1], sideRGB[2], 2]);
    }
    for (let i = 0; i < N; i++) { const a = base + i * 3, b = base + ((i + 1) % N) * 3; B.idx.push(a, b, b + 1, a, b + 1, a + 1, a + 1, b + 1, b + 2, a + 1, b + 2, a + 2); }
  }
  const smooth = (e0, e1, x) => { const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1); return t * t * (3 - 2 * t); };

  // 阴影深度：按图集 alpha 裁形（不再投方形影）；并沿光线方向把投影体推远 SHADOW_PUSH cm，
  // 贴片之间的近距离遮挡交给手绘视差阴影（避免 shadow acne 条纹）；翻页抬起时（>0.45cm）才产生实时投影。
  const SHADOW_PUSH = 0.45, SUNV = new THREE.Vector3(-0.36, 0.70, -0.62).normalize();
  const depthMats = new Map();
  function depthMatFor(tex) {
    const key = tex ? tex.uuid : 'none'; if (depthMats.has(key)) return depthMats.get(key);
    const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
    if (tex) { dm.map = tex; dm.alphaTest = 0.5; }
    dm.onBeforeCompile = (sh) => {
      sh.uniforms.uPushV = { value: SUNV.clone().multiplyScalar(SHADOW_PUSH) };
      sh.vertexShader = 'uniform vec3 uPushV;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed -= uPushV;');
    };
    depthMats.set(key, dm); return dm;
  }
  function finishGeo(B, mat, opts = {}) {
    const n = B.n; const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(B.uv), 2));
    g.setAttribute('aSide', new THREE.BufferAttribute(new Float32Array(B.side), 4));
    g.setAttribute('aPg', new THREE.BufferAttribute(new Float32Array(B.pg), 3));
    g.setIndex(new THREE.BufferAttribute(n > 65535 ? new Uint32Array(B.idx) : new Uint16Array(B.idx), 1));
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false;
    if (opts.cast !== false) m.customDepthMaterial = depthMatFor(mat.uniforms && mat.uniforms.uAtlas ? mat.uniforms.uAtlas.value : null); m.castShadow = opts.cast !== false; m.receiveShadow = true; m.visible = false; m.renderOrder = opts.order || 0;
    m.userData.loc = new Float32Array(B.pos); m.userData.lnor = new Float32Array(B.nor);
    stats.verts += n; stats.tris += B.idx.length / 3; book.add(m); return m;
  }

  // ---------------- 页面槽位曲面 ----------------
  function staticFrame(left, y0) {
    const cols = 148, rows = 2; const P = new Float32Array(cols * rows * 3), DU = new Float32Array(cols * rows * 3), DV = new Float32Array(cols * rows * 3);
    const du = PW / (cols - 1);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const cmX = i * du, k = (j * cols + i) * 3; const xs = left ? PW - cmX : cmX; // 距书脊
      const e = 0.01; const yv = y0 + prof(xs); const dy = (prof(left ? xs - e : xs + e) - prof(left ? xs + e : xs - e)) / (2 * e);
      P[k] = left ? cmX - PW : cmX; P[k + 1] = yv; P[k + 2] = -PH / 2 + j * PH;
      DU[k] = 1; DU[k + 1] = dy; DU[k + 2] = 0; DV[k] = 0; DV[k + 1] = 0; DV[k + 2] = 1;
    }
    return { cols, rows, P, DU, DV, back: false };
  }
  function turnFrame(arr, back) {
    const cols = S.turnCols + 1, rows = S.turnRows + 1; const P = new Float32Array(arr); const DU = new Float32Array(P.length), DV = new Float32Array(P.length);
    const du = PW / (cols - 1), dv = PH / (rows - 1);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const k = (j * cols + i) * 3; const i0 = Math.max(i - 1, 0), i1 = Math.min(i + 1, cols - 1), j0 = Math.max(j - 1, 0), j1 = Math.min(j + 1, rows - 1);
      const a = (j * cols + i0) * 3, b = (j * cols + i1) * 3, c = (j0 * cols + i) * 3, d = (j1 * cols + i) * 3;
      for (let q = 0; q < 3; q++) { DU[k + q] = (P[b + q] - P[a + q]) / ((i1 - i0) * du); DV[k + q] = (P[d + q] - P[c + q]) / ((j1 - j0) * dv); }
    }
    return { cols, rows, P, DU, DV, back };
  }
  // 翻页纸在每条横行上方的最低高度（压住下面贴片用）
  function ceilingMap(arr) {
    const cols = S.turnCols + 1, rows = S.turnRows + 1, NB = 340, x0 = -PW - 1.5, bw = (2 * PW + 3) / NB; const M = new Float32Array(rows * NB).fill(1e9);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols - 1; i++) { const a = (j * cols + i) * 3, b = a + 3; const xa = arr[a], xb = arr[b], ya = arr[a + 1], yb = arr[b + 1];
      const lo = Math.max(0, Math.floor((Math.min(xa, xb) - x0) / bw)), hi = Math.min(NB - 1, Math.floor((Math.max(xa, xb) - x0) / bw)); const ym = Math.min(ya, yb);
      for (let q = lo; q <= hi; q++) if (ym < M[j * NB + q]) M[j * NB + q] = ym; }
    return { M, rows, NB, x0, bw };
  }
  function ceilAt(C, x, z) { const fj = Math.min(Math.max((z + PH / 2) / PH, 0), 1) * (C.rows - 1); const j = Math.min(Math.floor(fj), C.rows - 2), b = fj - j;
    const q = Math.floor((x - C.x0) / C.bw); if (q < 0 || q >= C.NB) return 1e9; const a0 = C.M[j * C.NB + q], a1 = C.M[(j + 1) * C.NB + q]; if (a0 > 1e8 || a1 > 1e8) return Math.min(a0, a1); return a0 * (1 - b) + a1 * b; }

  function deform(rec, F, opt) {
    const t0 = performance.now();
    const cols = F.cols, rows = F.rows, P = F.P, DU = F.DU, DV = F.DV; const sgn = F.back ? -1 : 1; const C = opt.ceil;
    for (const m of rec.meshes) {
      const loc = m.userData.loc, ln = m.userData.lnor, lf = m.userData.lift; const pos = m.geometry.attributes.position.array, nor = m.geometry.attributes.normal.array; const n = loc.length / 3;
      for (let k = 0; k < n; k++) {
        const cmX = loc[k * 3], cmY = loc[k * 3 + 1]; let h = loc[k * 3 + 2]; if (lf) h += lf[k];
        let u = F.back ? 1 - cmX / PW : cmX / PW; const uc = Math.min(Math.max(u, 0), 1); const v = cmY / PH, vc = Math.min(Math.max(v, 0), 1);
        const fi = uc * (cols - 1), fj = vc * (rows - 1); const i = Math.min(Math.floor(fi), cols - 2), j = Math.min(Math.floor(fj), rows - 2); const a = fi - i, b = fj - j;
        const i00 = (j * cols + i) * 3, i10 = i00 + 3, i01 = i00 + cols * 3, i11 = i01 + 3;
        const w00 = (1 - a) * (1 - b), w10 = a * (1 - b), w01 = (1 - a) * b, w11 = a * b;
        let px = P[i00] * w00 + P[i10] * w10 + P[i01] * w01 + P[i11] * w11, py = P[i00 + 1] * w00 + P[i10 + 1] * w10 + P[i01 + 1] * w01 + P[i11 + 1] * w11, pz = P[i00 + 2] * w00 + P[i10 + 2] * w10 + P[i01 + 2] * w01 + P[i11 + 2] * w11;
        let tx = sgn * (DU[i00] * w00 + DU[i10] * w10 + DU[i01] * w01 + DU[i11] * w11), ty = sgn * (DU[i00 + 1] * w00 + DU[i10 + 1] * w10 + DU[i01 + 1] * w01 + DU[i11 + 1] * w11), tz = sgn * (DU[i00 + 2] * w00 + DU[i10 + 2] * w10 + DU[i01 + 2] * w01 + DU[i11 + 2] * w11);
        let bx = DV[i00] * w00 + DV[i10] * w10 + DV[i01] * w01 + DV[i11] * w11, by = DV[i00 + 1] * w00 + DV[i10 + 1] * w10 + DV[i01 + 1] * w01 + DV[i11 + 1] * w11, bz = DV[i00 + 2] * w00 + DV[i10 + 2] * w10 + DV[i01 + 2] * w01 + DV[i11 + 2] * w11;
        // 超出页面范围的部分（订口里的棉绳）沿切向外推
        const ex = (u - uc) * PW * (F.back ? -1 : 1), ey = (v - vc) * PH; if (ex || ey) { px += tx * ex + bx * ey; py += ty * ex + by * ey; pz += tz * ex + bz * ey; }
        let nx = by * tz - bz * ty, ny = bz * tx - bx * tz, nz = bx * ty - by * tx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
        const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl; const bl = Math.hypot(bx, by, bz) || 1; bx /= bl; by /= bl; bz /= bl;
        if (C) { const gap = ceilAt(C, px, pz) - py; if (gap < 0.5) h *= Math.min(Math.max((gap - 0.006) / 0.44, 0), 1); }
        pos[k * 3] = px + nx * h; pos[k * 3 + 1] = py + ny * h; pos[k * 3 + 2] = pz + nz * h;
        const lx = ln[k * 3], ly = ln[k * 3 + 1], lh = ln[k * 3 + 2];
        let qx = tx * lx + bx * ly + nx * lh, qy = ty * lx + by * ly + ny * lh, qz = tz * lx + bz * ly + nz * lh; const ql = Math.hypot(qx, qy, qz) || 1;
        nor[k * 3] = qx / ql; nor[k * 3 + 1] = qy / ql; nor[k * 3 + 2] = qz / ql;
      }
      m.geometry.attributes.position.needsUpdate = true; m.geometry.attributes.normal.needsUpdate = true;
      for (const mt of [m.material]) if (mt.uniforms && mt.uniforms.uSpine) { mt.uniforms.uSpine.value = opt.spine; mt.uniforms.uLiftP.value = opt.lift || 0; }
    }
    stats.updateMs = performance.now() - t0;
  }

  // ---------------- 绘制：阴影 / 墨迹 ----------------
  function shadowDraw(g, img, M, w, h, color, blurPx, ox, oy) {
    g.save(); g.setTransform(1, 0, 0, 1, -SH, 0); g.transform(M.a, M.b, M.c, M.d, M.e, M.f);
    g.shadowColor = color; g.shadowBlur = blurPx; g.shadowOffsetX = SH + ox; g.shadowOffsetY = oy; g.drawImage(img, -w / 2, -h / 2, w, h); g.restore();
  }
  const patchM = (P) => { const kx = P.sp.cv.width / P.w, ky = P.sp.cv.height / P.h; return new DOMMatrix().scale(kx, ky).translate(P.hw, P.hh).rotate(-(P.rot || 0)).translate(-P.cx, -P.cy); };
  const vecDev = (M, x, y) => [M.a * x + M.c * y, M.b * x + M.d * y];
  function liftMaskCanvas(P, res) {
    const G = P.topG; if (!G || !(P.maxLift > 0.012)) return null;
    const W = G.nx + 1, Hh = G.ny + 1; const sm = document.createElement('canvas'); sm.width = W; sm.height = Hh; const sg = sm.getContext('2d'); const id = sg.createImageData(W, Hh);
    for (let i = 0; i < W * Hh; i++) { const v = Math.min(1, Math.max(0, P.liftArr[i] / P.maxLift)); id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = 255; id.data[i * 4 + 3] = Math.round(255 * v); }
    sg.putImageData(id, 0, 0);
    const c = document.createElement('canvas'); c.width = Math.max(4, Math.round(P.w * res)); c.height = Math.max(4, Math.round(P.h * res)); const g = c.getContext('2d');
    g.drawImage(P.sp.cv, 0, 0, c.width, c.height); g.globalCompositeOperation = 'destination-in'; g.imageSmoothingEnabled = true; g.drawImage(sm, 0, 0, c.width, c.height); return c;
  }

  // ================= 构建一页 =================
  // spec: { patches: [...], wires: [...], inks: [...], posterTex: {...} }
  // 返回 paintBase(g, k)：在页面底图上画墨迹 + 软投影
  function buildPage(key, spec) {
    const tb0 = performance.now(); const tm = {};
    const recs = spec.patches.map((o, i) => makeRec(o, i)); const byId = {}; for (const P of recs) if (P.id) byId[P.id] = P;
    for (const P of recs) if (typeof P.on === 'string') P.on = byId[P.on];
    // 掩码 + 轮廓
    for (const P of recs) {
      if (P.g === 'poster') continue;
      P.mask = alphaMask(P.sp.cv, P.w, P.h, P.mres || 40);
      if (P.g === 'solid') { const raw = traceContour(P.mask); const per = raw.length / P.mask.rx; const N = P.outlineN || Math.min(420, Math.max(24, Math.round(per / (P.ospace || 0.07))));
        const rs = resample(raw, N, P.osmooth ?? 2); P.outline = rs.pts.map(([px, py]) => [(px + 0.5) / P.mask.rx - P.hw, (py + 0.5) / P.mask.ry - P.hh]); }
    }
    tm.mask = performance.now() - tb0;
    // 上下关系
    const solids = recs.filter((P) => P.g === 'solid'), softs = recs.filter((P) => P.g === 'soft');
    for (const P of recs) {
      P.below = recs.filter((Q) => Q !== P && (Q.g === 'solid' || Q.g === 'soft') && Q.z < P.z && bbOv(P.bb, Q.bb));
      P.cappers = solids.filter((Q) => Q !== P && Q.z > P.z && !Q.conform && !Q.on && bbOv(P.bb, Q.bb, 0.05));
    }
    // 回形针后脚：给被夹的纸片加一道鼓包
    const wires = (spec.wires || []).map((w) => Object.assign({}, w));
    for (const W of wires) if (W.type === 'clip') { W.target = byId[W.target]; W.path2 = clipPath(W); if (W.target) W.target.bumps.push({ pts: W.path2.filter((p) => p.back).map((p) => [p.x, p.y]), r: 0.24, amt: 2 * W.r + 0.012 }); }
    // 半透明软层：垂覆在下面贴片上（拱桥）
    for (const P of softs.sort((a, b) => a.z - b.z)) {
      const cell = P.cell || 0.16; const [nx, ny] = gridDims(P, cell); const W = nx + 1; const raw = new Float32Array(W * (ny + 1));
      for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const lx = -P.hw + (i / nx) * P.w, ly = -P.hh + (j / ny) * P.h; const [x, y] = toPage(P, lx, ly);
        raw[j * W + i] = Math.max(P.floor, stackBelow(P, x, y) + (P.clear ?? 0.005), bumpAt(P, x, y) + P.floor); }
      // 拱桥：max(原始, 模糊) —— 跨过台阶处离开下层、悬成一道弧
      const R = Math.max(1, Math.round((P.bridgeR || 0.28) / cell)); let bl = raw.slice();
      for (let pass = 0; pass < 2; pass++) { const tmp = new Float32Array(bl.length);
        for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { let s = 0, c = 0; for (let d = -R; d <= R; d++) { const ii = Math.min(Math.max(i + d, 0), nx); s += bl[j * W + ii]; c++; } tmp[j * W + i] = s / c; }
        const tmp2 = new Float32Array(bl.length);
        for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { let s = 0, c = 0; for (let d = -R; d <= R; d++) { const jj = Math.min(Math.max(j + d, 0), ny); s += tmp[jj * W + i]; c++; } tmp2[j * W + i] = s / c; }
        bl = tmp2; }
      const hs = new Float32Array(bl.length); for (let i = 0; i < hs.length; i++) hs[i] = Math.max(raw[i], bl[i]);
      P.grid = { nx, ny, hs };
    }
    // 实心贴片高度网格（用于底图翘角投影、平均高度）
    for (const P of recs) {
      if (P.g === 'soft') { P.avgTop = P.grid.hs.reduce((a, b) => a + b, 0) / P.grid.hs.length; continue; }
      const [nx, ny] = gridDims(P, P.cell || 0.3); const W = nx + 1; const lift = new Float32Array(W * (ny + 1)); let sum = 0, mx = 0;
      for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const lx = -P.hw + (i / nx) * P.w, ly = -P.hh + (j / ny) * P.h; const [x, y] = toPage(P, lx, ly);
        const top = topAt(P, x, y); const b = baseAt(P, x, y); const l = Math.max(0, top - b - P.t); lift[j * W + i] = l; mx = Math.max(mx, l); sum += top; }
      P.topG = { nx, ny }; P.liftArr = lift; P.maxLift = mx; P.avgTop = sum / (W * (ny + 1));
    }
    tm.heights = performance.now() - tb0;
    // 墨迹（邮戳、日记字迹……）：渲染一次，盖到底图与其下所有贴片的顶面
    const inks = (spec.inks || []).map((I) => { const k = 300; const [x0, y0, x1, y1] = I.bb; const c = document.createElement('canvas'); c.width = Math.ceil((x1 - x0) * k); c.height = Math.ceil((y1 - y0) * k);
      const g = c.getContext('2d'); g.scale(k, k); g.translate(-x0, -y0); g.lineJoin = 'round'; g.lineCap = 'round'; (spec.withK || ((kk, f) => f()))(k, () => I.draw(g)); return { cv: c, bb: I.bb }; });
    for (const P of recs) if (P.g !== 'poster' && !P.noInk) for (const I of inks) if (bbOv(P.bb, I.bb)) {
      const g = P.sp.cv.getContext('2d'); g.save(); g.setTransform(patchM(P)); g.globalCompositeOperation = 'source-atop'; g.imageSmoothingQuality = 'high';
      g.drawImage(I.cv, I.bb[0], I.bb[1], I.bb[2] - I.bb[0], I.bb[3] - I.bb[1]); g.restore(); }
    // 贴片之间的投影：上层贴片在下层贴片顶面上的软影（随高差偏移、变柔）
    for (const P of recs) { if (P.g === 'poster' || P.noRecv) continue; const g = P.sp.cv.getContext('2d'); const M0 = patchM(P); const kP = P.sp.cv.width / P.w;
      for (const Q of recs) { if (Q === P || Q.g === 'poster' || Q.on === P || Q.noCast || !(Q.z > P.z) || !bbOv(P.bb, Q.bb, 0.6)) continue;
        const dh = Math.max(0.012, Q.avgTop - P.avgTop); const M = M0.translate(Q.cx, Q.cy).rotate(Q.rot || 0); const a = Q.g === 'soft' ? 0.45 : 1;
        g.save(); g.globalCompositeOperation = 'source-atop';
        let [ox, oy] = vecDev(M0, SUN_OFF[0] * dh * 0.9 + 0.01, SUN_OFF[1] * dh * 0.9 + 0.015); shadowDraw(g, Q.sp.cv, M, Q.w, Q.h, `rgba(150,88,52,${0.30 * a})`, Math.max(2, (0.05 + 1.1 * dh) * kP), ox, oy);
        [ox, oy] = vecDev(M0, 0.012, 0.02); shadowDraw(g, Q.sp.cv, M, Q.w, Q.h, `rgba(120,70,40,${0.22 * a})`, Math.max(1.5, 0.025 * kP), ox, oy);
        g.restore(); } }
    tm.paint = performance.now() - tb0;
    // 图集 + 网格
    const solidAt = packAtlases(solids), softAt2 = softs.length ? packAtlases(softs, 4096, 4096, 10) : [];
    const meshes = [];
    for (const At of solidAt) { const B = Builder();
      for (const P of At.items) { P.mi = meshes.length; P.v0 = B.n; const side = new THREE.Color(P.side || 0xFFF8EE); const G = topGrid(B, P, (x, y) => topAt(P, x, y), (lx, ly) => uvOf(P, lx, ly), P.cell || 0.3); P.topG = G;
        skirt(B, P, P.outline, [side.r, side.g, side.b]); P.v1 = B.n; }
      meshes.push(finishGeo(B, mkSolid(At.tex))); }
    for (const At of softAt2) { const B = Builder();
      for (const P of At.items.slice().sort((a, b) => a.z - b.z)) topGrid(B, P, (x, y) => softAt(P, x, y), (lx, ly) => uvOf(P, lx, ly), P.cell || 0.16);
      meshes.push(finishGeo(B, mkSoft(At.tex), { cast: false, order: 1 })); }
    for (const P of recs.filter((Q) => Q.g === 'poster')) { const B = Builder();
      topGrid(B, P, (x, y) => topAt(P, x, y), (lx, ly) => [(lx + P.hw) / P.w, 1 - (ly + P.hh) / P.h], P.cell || 0.3);
      P.mi = meshes.length; P.v0 = 0; P.v1 = B.n; const m = finishGeo(B, mkPoster(P.tex, P.premul), { cast: false }); m.userData.poster = P; meshes.push(m); }
    // 金属丝 / 棉绳
    if (wires.length) { const B = Builder();
      for (const W of wires) { const pts3 = W.type === 'clip' ? clip3D(W) : W.pts(topAt, byId, stackAt);
        const curve = new THREE.CatmullRomCurve3(pts3.map((p) => new THREE.Vector3(p[0], p[1], p[2])), !!W.closed, 'centripetal');
        const L0 = curve.getLength(); const tube = new THREE.TubeGeometry(curve, Math.max(40, Math.round(L0 / 0.035)), W.r, W.radial || 10, !!W.closed);
        const p = tube.attributes.position, nrm = tube.attributes.normal, uv = tube.attributes.uv; const base = B.n;
        for (let i = 0; i < p.count; i++) addV(B, p.getX(i), p.getY(i), p.getZ(i), nrm.getX(i), nrm.getY(i), nrm.getZ(i), uv.getX(i) * L0, uv.getY(i), NOSIDE, W.kind || 0);
        const ix = tube.index.array; for (let i = 0; i < ix.length; i++) B.idx.push(base + ix[i]);
        // 两端封口小球
        if (!W.closed) for (const t of [0, 1]) { const c = curve.getPoint(t); const sp = new THREE.SphereGeometry(W.r * 0.98, 10, 8); const sb = B.n;
          for (let i = 0; i < sp.attributes.position.count; i++) { const x = sp.attributes.position.getX(i), y = sp.attributes.position.getY(i), z = sp.attributes.position.getZ(i); addV(B, c.x + x, c.y + y, c.z + z, x / W.r, y / W.r, z / W.r, 0, 0, NOSIDE, W.kind || 0); }
          const si = sp.index.array; for (let i = 0; i < si.length; i++) B.idx.push(sb + si[i]); }
        W.path3 = pts3; }
      meshes.push(finishGeo(B, mkWire())); }
    function stackAt(x, y) { let m = 0; for (const Q of recs) if ((Q.g === 'solid' || Q.g === 'soft') && inside(Q, x, y)) m = Math.max(m, topAt(Q, x, y)); return m; }
    function clipPath(W) { // 回形针 2D 路径（页面坐标）：前脚 = 外圈大环（压在纸上），后脚 = 内侧短脚（纸背后），过渡在小弧
      const len = W.len, w = 0.85, pts = []; const push = (px, py, seg) => { const lx = px - w / 2, ly = py - len / 2; const a = W.rot * Math.PI / 180; pts.push({ x: W.cx + Math.cos(a) * lx - Math.sin(a) * ly, y: W.cy + Math.sin(a) * lx + Math.cos(a) * ly, seg }); };
      for (let i = 0; i <= 14; i++) push(0.2, (len - 0.9) + (0.4 - (len - 0.9)) * i / 14, 0);
      for (let i = 1; i <= 12; i++) { const t = Math.PI + Math.PI * i / 12; push(0.425 + 0.225 * Math.cos(t), 0.4 + 0.225 * Math.sin(t), 1); }
      for (let i = 1; i <= 18; i++) push(0.65, 0.4 + (len - 0.35 - 0.4) * i / 18, 2);
      for (let i = 1; i <= 14; i++) { const t = Math.PI * i / 14; push(0.38 + 0.27 * Math.cos(t), (len - 0.35) + 0.27 * Math.sin(t), 2); }
      for (let i = 1; i <= 16; i++) push(0.11, (len - 0.35) + (0.62 - (len - 0.35)) * i / 16, 2);
      for (const p of pts) p.back = p.seg === 0; return pts;
    }
    function clip3D(W) {
      const T = W.target, r = W.r; const hs = W.path2.map((p) => { const under = T ? stackBelow(T, p.x, p.y) : 0; const tt = T && inside(T, p.x, p.y, true) ? topAt(T, p.x, p.y) : 0;
        const front = Math.max(stackAt(p.x, p.y), tt) + r + 0.003, back = under + r + 0.002; return { front, back }; });
      // 段 0 = 后脚，段 1 = 过渡小弧（后→前），段 2 = 前环
      const n1 = W.path2.filter((p) => p.seg === 1).length; let k1 = 0;
      let h = W.path2.map((p, i) => p.seg === 0 ? hs[i].back : p.seg === 2 ? hs[i].front : (() => { const f = (++k1) / (n1 + 1); const s = f * f * (3 - 2 * f); return hs[i].back * (1 - s) + hs[i].front * s; })());
      for (let it = 0; it < 3; it++) h = h.map((v, i) => i === 0 || i === h.length - 1 ? v : 0.25 * h[i - 1] + 0.5 * v + 0.25 * h[i + 1]);
      h = h.map((v, i) => W.path2[i].seg === 2 ? Math.max(v, hs[i].front) : v);
      return W.path2.map((p, i) => [p.x, p.y, h[i]]);
    }
    tm.geo = performance.now() - tb0; stats['build_' + key] = Object.fromEntries(Object.entries(tm).map(([a, b]) => [a, Math.round(b)]));
    const rec = { key, recs, meshes, byId, slot: null, cacheKey: '' };
    pages[key] = rec;
    // 底图绘制：墨迹 + 每个贴片在纸面上的软投影（接触影 + 随高度偏移的柔影 + 翘角处更远更柔的影）
    rec.paintBase = (g, k) => { const tp = performance.now();
      for (const I of inks) g.drawImage(I.cv, I.bb[0], I.bb[1], I.bb[2] - I.bb[0], I.bb[3] - I.bb[1]);
      const ks = 48; const lc = document.createElement('canvas'); lc.width = Math.ceil(PW * ks); lc.height = Math.ceil(PH * ks); const lg = lc.getContext('2d');
      const order = recs.filter((P) => P.g !== 'poster' && !P.noCast).sort((a, b) => a.z - b.z);
      for (const P of order) { const Hm = Math.max(0.02, P.avgTop); const a = P.g === 'soft' ? (P.shadowA ?? 0.4) : 1; const M = new DOMMatrix().scale(ks).translate(P.cx, P.cy).rotate(P.rot || 0);
        shadowDraw(lg, P.sp.cv, M, P.w, P.h, `rgba(201,128,90,${0.30 * a})`, (0.10 + 1.5 * Hm) * ks, SUN_OFF[0] * Hm * ks, SUN_OFF[1] * Hm * ks);
        const lm = liftMaskCanvas(P, 24); if (lm) { const Hl = Hm + P.maxLift; shadowDraw(lg, lm, M, P.w, P.h, `rgba(190,118,80,0.34)`, (0.12 + 1.8 * Hl) * ks, SUN_OFF[0] * Hl * ks, SUN_OFF[1] * Hl * ks); } }
      g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(lc, 0, 0, PW, PH); g.restore();
      for (const P of order) { if (P.g === 'soft' && !P.contact) continue; const M = new DOMMatrix().scale(k).translate(P.cx, P.cy).rotate(P.rot || 0);
        shadowDraw(g, P.sp.cv, M, P.w, P.h, 'rgba(138,76,42,0.30)', 0.035 * k, 0.012 * k, 0.022 * k); }
      stats['build_' + key].base = Math.round(performance.now() - tp);
    };
    rec.free = () => { for (const P of recs) if (P.sp && P.sp.cv && P.g !== 'poster') { P.sp.cv.width = 1; P.sp.cv.height = 1; } };
    return rec;
  }

  // ================= 槽位绑定与逐帧变形 =================
  const frames = { right: null, left: null, rightY: NaN, leftY: NaN, turnVer: -1, tf: null, tb: null, ceil: null };
  function sync(st) {
    // st: { right, left, turnFront, turnBack (内容 key 或 null), rightY, leftY, turnArr, turnVer, turnLift }
    const want = {}; for (const s of ['turnFront', 'turnBack', 'right', 'left']) { const k = st[s]; if (k && pages[k] && !want[k]) want[k] = s; }
    if (st.turnVer !== frames.turnVer && st.turnArr && (st.turnFront || st.turnBack)) { frames.turnVer = st.turnVer; frames.tf = turnFrame(st.turnArr, false); frames.tb = turnFrame(st.turnArr, true); frames.ceil = ceilingMap(st.turnArr); }
    if (st.rightY !== frames.rightY) { frames.rightY = st.rightY; frames.right = staticFrame(false, st.rightY); }
    if (st.leftY !== frames.leftY) { frames.leftY = st.leftY; frames.left = staticFrame(true, st.leftY); }
    const turnOn = !!(st.turnFront || st.turnBack); let ms = 0;
    for (const key in pages) { const rec = pages[key]; const slot = want[key] || null;
      for (const m of rec.meshes) m.visible = !!slot; if (!slot) { rec.cacheKey = ''; continue; }
      const isTurn = slot === 'turnFront' || slot === 'turnBack';
      const ck = slot + '|' + (isTurn || turnOn ? frames.turnVer : 'x') + '|' + (slot === 'right' ? st.rightY : slot === 'left' ? st.leftY : '') + '|' + (st.turnLift || 0).toFixed(3);
      if (ck === rec.cacheKey) continue; rec.cacheKey = ck;
      const F = slot === 'right' ? frames.right : slot === 'left' ? frames.left : slot === 'turnFront' ? frames.tf : frames.tb;
      deform(rec, F, { spine: slot === 'left' || slot === 'turnBack' ? PW : 0, lift: isTurn ? st.turnLift : 0, ceil: !isTurn && turnOn ? frames.ceil : null }); ms += stats.updateMs;
    }
    stats.lastSyncMs = ms;
  }
  // 某页某贴片局部点 → 世界坐标（按当前绑定槽位）
  function pointWorld(key, id, lx, ly, dh = 0) {
    const rec = pages[key]; const P = typeof id === 'object' ? id : rec.byId[id]; const [x, y] = toPage(P, lx, ly); const h = topAt(P, x, y) + dh;
    const m = rec.meshes.find((q) => q.userData.poster === P) || rec.meshes[0]; const slot = rec.cacheKey.split('|')[0] || 'left';
    const F = slot === 'right' ? frames.right : slot === 'left' ? frames.left : slot === 'turnFront' ? frames.tf : frames.tb;
    // 复用 deform 的数学：临时网格
    const tmp = { meshes: [{ userData: { loc: new Float32Array([x, y, h]), lnor: new Float32Array([0, 0, 1]) }, geometry: { attributes: { position: { array: new Float32Array(3) }, normal: { array: new Float32Array(3) } } }, material: {} }] };
    deform(tmp, F, { spine: 0 }); const a = tmp.meshes[0].geometry.attributes.position.array; void m;
    return new THREE.Vector3(a[0], a[1], a[2]).applyMatrix4(book.matrixWorld);
  }
  function benchTurn(n = 60) { // 翻页时两面贴片的逐帧变形耗时
    const keys = Object.keys(pages); const recF = pages.snowR, recB = pages.nextL; if (!recF || !recB || !frames.tf) return null;
    const t0 = performance.now(); for (let i = 0; i < n; i++) { deform(recF, frames.tf, { spine: 0 }); deform(recB, frames.tb, { spine: PW }); } const t1 = performance.now();
    recF.cacheKey = ''; recB.cacheKey = ''; void keys; return (t1 - t0) / n;
  }
  // 页面上某一点（厘米）最上面的那件东西：实心贴片或海报（软的胶带、蕾丝垫不算）
  function pick(key, x, y) {
    const rec = pages[key]; if (!rec) return null; let best = null;
    for (const P of rec.recs) { if (P.v1 == null) continue; let hit;
      if (P.g === 'poster') { const [lx, ly] = toLocal(P, x, y); hit = Math.abs(lx) < P.hw && Math.abs(ly) < P.hh; } else hit = inside(P, x, y);
      if (hit && (!best || P.z > best.z)) best = P; }
    return best;
  }
  // 把一件东西（连同贴在它上面的、它贴着的）整体抬高 v 厘米，tilt：一边高一边低
  function setPop(key, P, v, tilt = 0) {
    const rec = pages[key]; if (!rec) return; const root = P.on || P;
    for (const T of rec.recs) { if (T !== root && T.on !== root) continue; if (T.v1 == null) continue; const m = rec.meshes[T.mi]; const loc = m.userData.loc;
      const lf = m.userData.lift || (m.userData.lift = new Float32Array(loc.length / 3));
      for (let k = T.v0; k < T.v1; k++) lf[k] = v * (1 + tilt * (loc[k * 3] - root.cx) / Math.max(root.hw, 0.5)); }
    rec.cacheKey = '';
  }
  return { L, buildPage, sync, pointWorld, stats, pages, benchTurn, pick, setPop };
}
