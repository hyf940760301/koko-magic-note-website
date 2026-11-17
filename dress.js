// 晴窗手账 · 书的“装满感”：夹在书页里探出来的东西、松紧带、封面装饰（布贴名标、烫金、包角、口袋、贴纸、缝线）
import { P, setK, seed, sprite, hand, print, doodle, item, rr } from './collage.js';
const TK = 170; // 外部小物纹理：每厘米 170 像素（封面装饰另用 260）

export function buildDress(ctx) {
  const { THREE, S, col, makeMat, book, frontPivot, yH, brassMat, mergeGeos } = ctx;
  setK(TK);
  // ---------- 通用材质：贴图卡片（受光、杏色影、alpha 剪裁；可选：烫金高光、免光照区域）----------
  function cardMat(map, o = {}) {
    return makeMat(/* glsl */`
uniform sampler2D uMap; uniform vec3 uEdge; uniform float uFoil; uniform vec4 uUnlit; uniform float uRim;
void main(){
  vec3 N = normalize(vWN); if(!gl_FrontFacing) N = -N;
  vec4 t = texture2D(uMap, vUv);
  if(t.a < 0.5) discard;
  float sideF = 1.0 - step(0.5, abs(vLN.y));            // 侧面（厚度）
  vec3 base = mix(t.rgb, uEdge, sideF * 0.85);
  float sm = getShadowMask();
  vec3 c = stylizedLight(base, N, sm);
  vec3 V = normalize(cameraPosition - vWP);
  // 风格化烫金：沿视角掠过的一道柔亮
  float f = pow(max(dot(reflect(-uSunDir, N), V), 0.0), 24.0);
  c += (base * 0.9 + vec3(0.12, 0.08, 0.02)) * f * uFoil * t.a;
  // 剪影处一圈暖可可描边感（插画式），只在亮面
  c *= mix(1.0, 0.86, uRim * (1.0 - smoothstep(0.12, 0.35, abs(dot(N, V)))));
  if(vUv.x > uUnlit.x && vUv.x < uUnlit.z && vUv.y > uUnlit.y && vUv.y < uUnlit.w && sideF < 0.5){
    vec3 shade = mix(vec3(1.0), uShadowTint, uShadowStr); c = base * mix(shade, vec3(1.0), sm); }
  gl_FragColor = vec4(c, outA());
  #include <colorspace_fragment>
}`, { uMap: { value: map }, uEdge: { value: col(o.edge ?? 0xFFF6E6) }, uFoil: { value: o.foil ?? 0 }, uUnlit: { value: new THREE.Vector4(...(o.unlit || [2, 2, 2, 2])) }, uRim: { value: o.rim ?? 0 } },
    { side: THREE.DoubleSide });
  }
  const tex = (sp) => { const t = new THREE.CanvasTexture(sp.cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  // 卡片几何：宽 w（x）× 长 d（z）× 厚 t；uv 由位置生成（画布上方 = -z）
  function cardGeo(w, d, t) {
    const g = new THREE.BoxGeometry(w, t, d, 1, 1, 1); const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, 1 - (p.getZ(i) + d / 2) / d);
    uv.needsUpdate = true; return g;
  }
  function cardMesh(sp, t, o = {}) { const m = new THREE.Mesh(cardGeo(sp.w, sp.h, t), cardMat(tex(sp), o)); m.castShadow = true; m.receiveShadow = true; return m; }

  // ================= 一、夹在书页里的东西 =================
  // 每件：h = 在合上的书芯里的高度（0 = 最底一张，1 = 最上一张），pos = 书本坐标的 (x, z)，rotY（度）
  const tucked = [];
  function tuck(mesh, h, x, z, rotY = 0, axis = 'x') { mesh.userData.t = { h, x, z, r: rotY * Math.PI / 180, axis }; tucked.push(mesh); book.add(mesh); }
  seed(31);
  // 索引标签（系列签名色），书口探出 0.95，竖排系列名
  const tab = (no, name, color, horiz = false) => {
    // 索引签：彩色卡纸 + 奶白插卡纸（字永远是可可墨色，深色签上也清楚）；长度随名字字数变
    const n = [...name].length, FS = 0.31, STEP = 0.35;
    const W = horiz ? 0.78 + n * STEP + 0.22 : 2.15, D = horiz ? 2.15 : 0.82 + n * STEP + 0.22;
    return sprite(W, D, (g, w, d) => {
      g.fillStyle = color; g.beginPath();
      if (!horiz) { g.moveTo(0, 0); g.lineTo(w - 0.35, 0); g.quadraticCurveTo(w, 0, w, 0.35); g.lineTo(w, d - 0.35); g.quadraticCurveTo(w, d, w - 0.35, d); g.lineTo(0, d); }
      else { g.moveTo(0, d); g.lineTo(0, 0.35); g.quadraticCurveTo(0, 0, 0.35, 0); g.lineTo(w - 0.35, 0); g.quadraticCurveTo(w, 0, w, 0.35); g.lineTo(w, d); }
      g.closePath(); g.fill();
      g.save(); g.clip(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.08; for (let i = 0; i < 400; i++) { g.fillStyle = Math.random() > 0.5 ? '#fff' : '#000'; g.fillRect(Math.random() * w, Math.random() * d, 0.02, 0.02); } g.restore();
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.025; if (!horiz) { g.beginPath(); g.moveTo(1.25, 0.08); g.lineTo(w - 0.35, 0.08); g.stroke(); }
      const label = (x, y, lw, lh) => { g.save(); g.shadowColor = 'rgba(160,96,60,0.25)'; g.shadowBlur = 3; g.shadowOffsetY = 1; g.fillStyle = '#FFF8EC'; rr(g, x, y, lw, lh, 0.12); g.fill(); g.restore(); };
      if (!horiz) { // 探出部分：x 1.2..2.15；数字小圆 + 插卡竖排名字
        const cx = 1.2 + 0.95 / 2; g.fillStyle = P.white; g.beginPath(); g.arc(cx, 0.4, 0.22, 0, 7); g.fill(); print(g, String(no), cx, 0.49, 0.24, P.ink, 'NunitoP', 'center');
        label(cx - 0.3, 0.72, 0.6, n * STEP + 0.16);
        [...name].forEach((ch, i) => print(g, ch, cx, 0.72 + 0.08 + FS * 0.86 + i * STEP, FS, P.ink, 'ChillRound', 'center'));
      } else { const cy = 0.95 / 2; g.fillStyle = P.white; g.beginPath(); g.arc(0.4, cy, 0.22, 0, 7); g.fill(); print(g, String(no), 0.4, cy + 0.09, 0.24, P.ink, 'NunitoP', 'center');
        label(0.7, cy - 0.3, n * STEP + 0.16, 0.6); [...name].forEach((ch, i) => print(g, ch, 0.78 + STEP / 2 + i * STEP, cy + FS * 0.36, FS, P.ink, 'ChillRound', 'center')); }
    });
  };
  const PIN = 1.2; // 伸进书页的长度
  for (const [no, name, color, h, z, sid] of [[14, '星光熠熠', '#A9BEF0', 0.86, -8.75, null], [4, '云朵午后', '#86C1EC', 0.64, -4.35, 'cloud'], [17, '雪绒国', '#A8C4E4', 0.31, 6.55, 'snow'], [18, '怼脸', '#E5574A', 0.12, 8.85, null]]) {
    const sp = tab(no, name, color); const m = cardMesh(sp, 0.03, { edge: 0xffffff }); tuck(m, h, S.PW - PIN + sp.w / 2, z, 0); m.userData.fx = { kind: 'tab', sid, out: 0.45 };
  }
  for (const [no, name, color, h, x] of [[1, '柔和的海风', '#8EC5DE', 0.72, 11.4], [2, '青春校园', '#8FCFBF', 0.42, 6.9]]) {
    const sp = tab(no, name, color, true); const m = cardMesh(sp, 0.03, { edge: 0xffffff }); tuck(m, h, x, -S.PH / 2 + PIN - sp.h / 2, 0, 'z'); m.userData.fx = { kind: 'tab', sid: null, out: 0.45 };
  }
  // 天头探出的车票（票根朝外）
  { const t0 = item.ticket(5.0, 2.4, { title: '雪绒国 小火车', sub: '小窗站 → 邮局站', line: '靠窗 · 3 车 7 座', no: 'No.0017', band: P.snowDeep });
    const sp = sprite(2.4, 5.0, (g) => { g.save(); g.translate(2.4, 0); g.rotate(Math.PI / 2); g.drawImage(t0.cv, 0, 0, 5.0, 2.4); g.restore(); });
    const tk = cardMesh(sp, 0.04, { edge: 0xE9DCC6 }); tuck(tk, 0.55, 3.6, -S.PH / 2 + 5.0 / 2 - 2.0, -6, 'z'); tk.userData.fx = { kind: 'ticket', sid: null, out: 0.75 }; }
  // 天头探出的压花叶（银杏，蜂蜜黄）
  { const sp = sprite(3.0, 5.2, (g) => {
      const cx = 1.5; g.fillStyle = '#EDBE5A'; g.beginPath(); g.moveTo(cx, 2.5); g.bezierCurveTo(cx - 1.6, 1.6, cx - 1.5, 0.2, cx - 0.7, 0.1); g.quadraticCurveTo(cx - 0.2, 0.4, cx, 0.2); g.quadraticCurveTo(cx + 0.2, 0.4, cx + 0.7, 0.1); g.bezierCurveTo(cx + 1.5, 0.2, cx + 1.6, 1.6, cx, 2.5); g.fill();
      g.strokeStyle = 'rgba(190,130,50,0.55)'; g.lineWidth = 0.022; for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(cx, 2.45); g.quadraticCurveTo(cx + i * 0.1, 1.5, cx + i * 0.2, 0.25); g.stroke(); }
      g.strokeStyle = '#B98A45'; g.lineWidth = 0.06; g.beginPath(); g.moveTo(cx, 2.45); g.quadraticCurveTo(cx + 0.06, 3.6, cx - 0.05, 5.1); g.stroke();
      g.save(); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.25; const gr = g.createRadialGradient(cx, 0.6, 0.1, cx, 0.8, 1.8); gr.addColorStop(0, '#F6D27A'); gr.addColorStop(1, '#D98E3A'); g.fillStyle = gr; g.fillRect(0, 0, 3, 3); g.restore(); });
    const lf = cardMesh(sp, 0.016, { edge: 0xD9A040 }); tuck(lf, 0.76, 8.9, -S.PH / 2 + 5.2 / 2 - 2.6, 14, 'z'); lf.userData.fx = { kind: 'leaf', sid: null, out: 0.35 }; }
  // 地脚探出的照片（官方海报整张缩小，白边；图像区不受光，保持原样）
  const photo = { mesh: null, img: 'assets/Koko_poster_cloud_afternoon_01_lying_on_cloud_v3.jpg' };
  // 地脚探出的和纸胶带尾巴
  for (const [x, h, c, pat, rot] of [[3.1, 0.21, 'rgba(168,220,200,1)', 'dots', -4], [6.4, 0.66, P.peach, 'stripes', 3]]) {
    const w0 = item.washi(1.15, 2.8, c, pat, 0.9); tuck(cardMesh(w0, 0.01, { edge: 0xffffff }), h, x, S.PH / 2 - 2.8 / 2 + 0.8, rot, 'z'); }
  // ---- 更多探出一小截的小可爱（层次：大件 = 照片/信封，小件 = 角、条、签；每件只露 0.7–1.3cm）----
  const fore = (sp, p, h, z, rot, t = 0.03, edge = 0xffffff) => tuck(cardMesh(sp, t, { edge }), h, S.PW + p - sp.w / 2, z, rot);
  const head = (sp, p, h, x, rot, t = 0.03, edge = 0xffffff) => tuck(cardMesh(sp, t, { edge }), h, x, -S.PH / 2 + sp.h / 2 - p, rot, 'z');
  const foot = (sp, p, h, x, rot, t = 0.03, edge = 0xffffff) => tuck(cardMesh(sp, t, { edge }), h, x, S.PH / 2 - sp.h / 2 + p, rot, 'z');
  // 迷你拍立得一角（书口）：白框 + 下巴厚边朝外，照片是晴天小云
  fore(sprite(3.0, 2.4, (g, w, d) => { g.fillStyle = '#FFFDF8'; rr(g, 0, 0, w, d, 0.08); g.fill();
    const sky = g.createLinearGradient(0, 0.2, 0, d - 0.2); sky.addColorStop(0, '#8EC5EC'); sky.addColorStop(1, '#E4F1F6'); g.fillStyle = sky; g.fillRect(0.18, 0.18, w - 0.78, d - 0.36);
    g.fillStyle = '#FFFDF8'; for (const [x, y, r] of [[1.0, 1.3, 0.28], [1.3, 1.15, 0.36], [1.65, 1.3, 0.26]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    g.fillStyle = '#FFD66B'; g.beginPath(); g.arc(1.95, 0.62, 0.2, 0, 7); g.fill(); g.fillStyle = '#A9D6B6'; g.fillRect(0.18, d - 0.62, w - 0.78, 0.44);
    doodle.heart(g, w - 0.3, d / 2, 0.2, P.coral); }), 1.0, 0.31, -1.55, -4, 0.04, 0xF4EEE4);
  // 小票的锯齿角（书口）
  fore(sprite(2.4, 1.5, (g, w, d) => { g.fillStyle = '#FFFEFA'; g.beginPath(); g.moveTo(0, 0); g.lineTo(w - 0.12, 0); for (let y = 0; y <= d; y += 0.15) g.lineTo(w - (Math.round(y / 0.15) % 2) * 0.12, y); g.lineTo(0, d); g.closePath(); g.fill();
    g.fillStyle = 'rgba(90,59,46,0.55)'; for (const y of [0.35, 0.62, 0.89]) g.fillRect(w - 0.95, y, 0.55, 0.05); g.fillStyle = 'rgba(214,95,75,0.7)'; g.fillRect(w - 0.95, 1.15, 0.4, 0.06); }), 0.75, 0.82, -6.65, 7, 0.02, 0xF2EEE6);
  // 折角的彩格便签（天头）
  head(sprite(1.7, 2.6, (g, w, d) => { g.fillStyle = '#FFF4E4'; g.fillRect(0, 0, w, d); g.fillStyle = 'rgba(168,220,200,0.55)'; for (let x = 0; x < w; x += 0.34) g.fillRect(x, 0, 0.17, d); g.fillStyle = 'rgba(244,140,122,0.28)'; for (let y = 0; y < d; y += 0.34) g.fillRect(0, y, w, 0.17);
    g.fillStyle = '#F7E2CC'; g.beginPath(); g.moveTo(w - 0.55, 0); g.lineTo(w, 0.55); g.lineTo(w - 0.55, 0.55); g.closePath(); g.fill(); g.fillStyle = 'rgba(150,100,70,0.25)'; g.beginPath(); g.moveTo(w - 0.55, 0.55); g.lineTo(w, 0.55); g.lineTo(w, 0.62); g.closePath(); g.fill();
    g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(w - 0.55, 0); g.lineTo(w, 0); g.lineTo(w, 0.55); g.closePath(); g.fill(); }), 1.0, 0.36, 1.7, 5, 0.02, 0xF2E6D6);
  // 一小枝压花小雏菊（地脚）
  foot(sprite(1.5, 3.0, (g, w, d) => { g.strokeStyle = '#9DBB6E'; g.lineWidth = 0.05; g.beginPath(); g.moveTo(w / 2 - 0.1, 0); g.quadraticCurveTo(w / 2 + 0.15, d * 0.5, w / 2, d - 0.55); g.stroke();
    g.fillStyle = '#A9C878'; for (const [y, sx] of [[0.9, -1], [1.5, 1]]) { g.beginPath(); g.ellipse(w / 2 + sx * 0.22, y, 0.22, 0.08, sx * 0.6, 0, 7); g.fill(); }
    const fx = w / 2, fy = d - 0.5; g.fillStyle = '#FFFDF8'; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; g.beginPath(); g.ellipse(fx + Math.cos(a) * 0.26, fy + Math.sin(a) * 0.26, 0.2, 0.08, a, 0, 7); g.fill(); }
    g.fillStyle = '#F6C445'; g.beginPath(); g.arc(fx, fy, 0.13, 0, 7); g.fill(); }), 1.3, 0.44, 1.85, 10, 0.008, 0xE8E4D0);
  // 布贴书签（地脚）：薰衣草紫织带对折，绣一颗小爱心
  foot(sprite(1.0, 2.2, (g, w, d) => { g.fillStyle = '#C9B6E4'; rr(g, 0, 0, w, d, 0.12); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.012; for (let x = 0.05; x < w; x += 0.06) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, d); g.stroke(); }
    g.setLineDash([0.08, 0.05]); g.strokeStyle = '#FFF6E6'; g.lineWidth = 0.025; rr(g, 0.1, 0.1, w - 0.2, d - 0.2, 0.08); g.stroke(); g.setLineDash([]); doodle.heart(g, w / 2, d - 0.45, 0.24, P.coral); }), 0.9, 0.9, 13.9, 4, 0.05, 0xB8A2D6);
  // 书口探出的信封一角（牛皮纸 + 航空边）
  { const sp = sprite(4.0, 3.2, (g, w, d) => { g.fillStyle = P.kraft; g.fillRect(0, 0, w, d);
      g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.12; for (let i = 0; i < 1500; i++) { g.fillStyle = Math.random() > 0.5 ? '#fff' : '#000'; g.fillRect(Math.random() * w, Math.random() * d, 0.025, 0.025); } g.restore();
      for (let z = -0.4; z < d + 0.4; z += 0.5) { g.fillStyle = (Math.round(z / 0.5) % 2) ? P.coral : P.snowDeep; g.beginPath(); g.moveTo(w - 0.28, z); g.lineTo(w, z + 0.25); g.lineTo(w, z + 0.5); g.lineTo(w - 0.28, z + 0.25); g.fill(); }
      print(g, 'AIR MAIL', w - 0.55, d / 2, 0.2, P.inkBlue, 'NunitoP', 'center'); });
    tuck(cardMesh(sp, 0.06, { edge: 0xB98A5A }), 0.47, S.PW - 2.9 + 2.0, 3.35, -5); }
  // 天头的麻绳书签 + 橘子挂饰（落在桌面上）
  const charmGroup = new THREE.Group(); book.add(charmGroup);
  // 双股红白面包师棉绳：两股螺旋拧在一起（股间暗缝 + 每股圆鼓的明暗），粗 0.15cm
  const TW_R = 0.075;
  const twineMat = makeMat(/* glsl */`uniform float uLen; void main(){ vec3 N=normalize(vWN);
    float s = vUv.x * uLen / 0.42 + vUv.y * 2.0;            // 每 0.42cm 拧一圈；绕截面 2 股
    float f = fract(s); float strand = step(0.5, f);
    float k = fract(s * 2.0); float fw = fwidth(s * 2.0);
    float bulge = sin(k * 3.14159);                          // 每股鼓起
    float groove = 1.0 - smoothstep(0.0, 0.16 + fw, min(k, 1.0 - k));
    vec3 red = vec3(0.86, 0.30, 0.24), wht = vec3(1.0, 0.96, 0.89);
    vec3 base = mix(red, wht, strand);
    float fib = 0.5 + 0.5 * sin((vUv.x * uLen) * 260.0 + vUv.y * 40.0);   // 棉纤维细纹
    base *= 1.0 - 0.05 * fib * (1.0 - smoothstep(0.3, 1.0, fwidth(vUv.x * uLen * 260.0)));
    base *= mix(0.80, 1.04, bulge); base *= 1.0 - groove * 0.28;
    vec3 c = stylizedLight(base, N, getShadowMask());
    vec3 V = normalize(cameraPosition - vWP); c += vec3(1.0, 0.95, 0.85) * 0.05 * bulge * max(dot(N, uSunDir), 0.0);
    c *= mix(1.0, 0.88, 1.0 - smoothstep(0.1, 0.45, abs(dot(N, V))));
    gl_FragColor = vec4(c, outA());
    #include <colorspace_fragment>
  }`, { uLen: { value: 10 } });
  // 接触影：贴着桌面的一条杏色柔影带（棉绳躺平的那段）
  const twShMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uC: { value: col(0xB8774E) } },
    vertexShader: 'varying vec2 vUv; varying vec3 vWP; void main(){ vUv = uv; vWP = (modelMatrix*vec4(position,1.0)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vWP,1.0); }',
    fragmentShader: 'uniform vec3 uC; varying vec2 vUv; varying vec3 vWP; void main(){ float d = abs(vUv.y - 0.5) * 2.0; float a = (1.0 - smoothstep(0.15, 1.0, d)) * 0.42 * smoothstep(0.0, 0.04, vUv.x) * smoothstep(0.0, 0.03, 1.0 - vUv.x); gl_FragColor = vec4(uC, a); gl_FragColor.a = a; }' });
  const charmMat = (hex, o = {}) => makeMat(/* glsl */`uniform vec3 uB; uniform float uPeel; uniform float uGloss;
    float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
    float vn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(mix(h3(i), h3(i+vec3(1,0,0)), f.x), mix(h3(i+vec3(0,1,0)), h3(i+vec3(1,1,0)), f.x), f.y),
                 mix(mix(h3(i+vec3(0,0,1)), h3(i+vec3(1,0,1)), f.x), mix(h3(i+vec3(0,1,1)), h3(i+vec3(1,1,1)), f.x), f.y), f.z); }
    void main(){ vec3 N=normalize(vWN);
    // 橘皮：细小油胞凹凸（法线扰动）
    if(uPeel > 0.0){ vec3 q = vLP * 38.0; float e = 0.05; float n0 = vn3(q);
      vec3 g = vec3(vn3(q+vec3(e,0,0)) - n0, vn3(q+vec3(0,e,0)) - n0, vn3(q+vec3(0,0,e)) - n0) / e;
      N = normalize(N - g * 0.035 * uPeel); }
    vec3 base = uB;
    vec3 c = stylizedLight(base, N, getShadowMask()); vec3 V=normalize(cameraPosition-vWP); vec3 H=normalize(uSunDir+V);
    float nh = max(dot(N,H), 0.0);
    c = mix(c, vec3(1.0,0.98,0.93), smoothstep(0.955,0.985,nh)*0.75*uGloss);            // 主高光
    c += vec3(1.0,0.85,0.55) * pow(nh, 12.0) * 0.10 * uGloss;                            // 暖色宽高光
    float fr = 1.0 - abs(dot(N,V)); c += base * vec3(1.0,0.7,0.4) * 0.18 * pow(fr, 2.5) * uPeel; // 透光暖边（橘子）
    c *= mix(1.0, 0.86, 1.0 - smoothstep(0.12, 0.4, abs(dot(N,V))));
    gl_FragColor = vec4(c, outA());
    #include <colorspace_fragment>
  }`, { uB: { value: col(hex) }, uPeel: { value: o.peel ?? 0 }, uGloss: { value: o.gloss ?? 1 } });
  // 橘子挂件：躺在桌上，果蒂朝棉绳（局部 -x），蒂上一片小叶
  const orangeCharm = new THREE.Group();
  { const o = new THREE.Mesh(new THREE.SphereGeometry(0.46, 64, 40), charmMat(0xF59248, { peel: 1 })); o.scale.set(0.92, 0.86, 1); o.position.y = 0.395; o.castShadow = true; orangeCharm.add(o);
    // 果蒂：五角星绿萼 + 短柄
    const cal = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, r = i % 2 ? 0.05 : 0.13; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? cal.lineTo(x, y) : cal.moveTo(x, y); } cal.closePath();
    const cg = new THREE.ExtrudeGeometry(cal, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1 }); cg.rotateY(-Math.PI / 2);
    const calyx = new THREE.Mesh(cg, charmMat(0x7FA35A, { gloss: 0.4 })); calyx.position.set(-0.415, 0.395, 0); orangeCharm.add(calyx);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.16, 16), charmMat(0x8A7A4A, { gloss: 0.2 })); stem.rotation.z = Math.PI / 2; stem.position.set(-0.5, 0.395, 0); orangeCharm.add(stem);
    // 小叶：弯弯的柳叶形（细分平面按弧度弯曲）
    const ls = new THREE.Shape(); ls.moveTo(0, 0); ls.quadraticCurveTo(0.22, 0.17, 0.62, 0); ls.quadraticCurveTo(0.22, -0.17, 0, 0);
    const lg = new THREE.ShapeGeometry(ls, 12); const lp = lg.attributes.position; for (let i = 0; i < lp.count; i++) { const x = lp.getX(i), y = lp.getY(i); lp.setZ(i, 0.35 * x * x - 0.25 * y * y * 4); } lg.computeVertexNormals();
    const leaf = new THREE.Mesh(lg, charmMat(0x93B85E, { gloss: 0.6 })); leaf.material.side = THREE.DoubleSide; leaf.rotation.set(-Math.PI / 2 + 0.35, 0.0, 2.45); leaf.position.set(-0.5, 0.45, 0.02); leaf.castShadow = true; orangeCharm.add(leaf); }
  charmGroup.add(orangeCharm);
  let twine = null, twSh = null, twBase = null;
  // pts: 中心线；最后一段躺在桌上（y≈半径）。橘子挂件接在绳尾：果蒂朝绳子
  function layTwine(pts) { twBase = pts.map((p) => p.clone()); buildTwine(pts); }
  function buildTwine(pts) { if (twine) { charmGroup.remove(twine); twine.geometry.dispose(); } if (twSh) { charmGroup.remove(twSh); twSh.geometry.dispose(); }
    const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal'); twine = new THREE.Mesh(new THREE.TubeGeometry(c, 240, TW_R, 14, false), twineMat); twine.castShadow = true; twine.receiveShadow = true; charmGroup.add(twine);
    twineMat.uniforms.uLen.value = c.getLength();
    // 桌面接触影：只沿贴桌的点
    const sp = c.getSpacedPoints(120).filter((p) => p.y < TW_R * 1.6);
    if (sp.length > 2) { const pos = [], uv = [], idx = []; const W = 0.32;
      sp.forEach((p, i) => { const q = sp[Math.min(i + 1, sp.length - 1)], r = sp[Math.max(i - 1, 0)]; const t = q.clone().sub(r).setY(0).normalize(); const n = new THREE.Vector3(-t.z, 0, t.x);
        for (const s of [-1, 1]) { pos.push(p.x + n.x * W * s + 0.05, 0.012, p.z + n.z * W * s + 0.04); uv.push(i / (sp.length - 1), (s + 1) / 2); } });
      for (let i = 0; i < sp.length - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
      twSh = new THREE.Mesh(g, twShMat); twSh.renderOrder = 1; charmGroup.add(twSh); }
    const pN = pts[pts.length - 1], pM = pts[pts.length - 2]; const d = pN.clone().sub(pM).setY(0).normalize();
    orangeCharm.position.set(pN.x + d.x * 0.56, 0, pN.z + d.z * 0.56); orangeCharm.rotation.set(0, Math.atan2(-d.z, d.x), 0); }

  // ================= 二、松紧带（柔橙罗纹，绷紧）=================
  const EL = { z: -6.6, w: 0.8, t: 0.07 };
  const elMat = makeMat(/* glsl */`uniform vec3 uB; void main(){ vec3 N=normalize(vWN); if(!gl_FrontFacing) N=-N;
    float rib = 0.5 + 0.5*sin(vUv.y*6.2831*9.0);                         // 纵向罗纹 9 条
    float knit = 0.5 + 0.5*sin(vUv.x*6.2831*220.0);                      // 横向织纹（细）
    vec3 base = uB * (1.0 - rib*0.10 - knit*0.03*(1.0-smoothstep(0.5,1.5,fwidth(vUv.x*220.0))));
    float edge = smoothstep(0.42, 0.5, abs(vUv.y-0.5)); base = mix(base, base*1.08, edge);
    vec3 c = stylizedLight(base, N, getShadowMask()); vec3 V=normalize(cameraPosition-vWP);
    c *= mix(1.0, 0.86, 1.0 - smoothstep(0.1, 0.35, abs(dot(N,V))));
    gl_FragColor = vec4(c, outA());
    #include <colorspace_fragment>
  }`, { uB: { value: col(0xF2844E) } }, { side: THREE.DoubleSide });
  const elastic = new THREE.Mesh(new THREE.BufferGeometry(), elMat); elastic.castShadow = true; elastic.receiveShadow = true; book.add(elastic);
  // 截面环线（xy），按弧长参数生成一条带子：外表面 + 两条侧边
  function loopPts(theta, top) {
    const r = top / 2, sx = 0.42 * r + 0.04, pts = [];
    const topF = top + S.CW * Math.sin(theta) + 0.04;
    for (let i = 0; i <= 30; i++) { const t = i / 30; pts.push([t * (S.CW + 0.04), top + 0.04 + (topF - top - 0.04) * t]); }          // 封面上
    for (let i = 1; i <= 24; i++) { const t = i / 24; pts.push([S.CW + 0.04, topF + (-0.04 - topF) * t]); }                               // 书口竖直下
    for (let i = 1; i <= 30; i++) { const t = i / 30; pts.push([S.CW + 0.04 - t * (S.CW + 0.04), -0.04]); }                               // 底下
    for (let i = 1; i <= 24; i++) { const a = -Math.PI / 2 - (i / 24) * Math.PI; pts.push([Math.cos(a) * sx, r + Math.sin(a) * (r + 0.04)]); } // 书脊半圆
    return pts;
  }
  function buildBand(pts3, w, t) { // pts3: 中心线点（Vector3），带宽方向 = bw（Vector3），外法线由相邻点算
    const n = pts3.length, pos = [], uv = [], idx = []; let L = 0; const acc = [0]; for (let i = 1; i < n; i++) { L += pts3[i].p.distanceTo(pts3[i - 1].p); acc.push(L); }
    for (let i = 0; i < n; i++) { const { p, nrm, bw } = pts3[i]; const o = nrm.clone().multiplyScalar(t);
      for (const [s, lift] of [[-0.5, 1], [0.5, 1], [-0.5, 0], [0.5, 0]]) { const v = p.clone().addScaledVector(bw, s * w).addScaledVector(o, lift); pos.push(v.x, v.y, v.z); uv.push(acc[i] / L * (L / 1.0), s + 0.5); } }
    for (let i = 0; i < n - 1; i++) { const a = i * 4, b = (i + 1) * 4;
      idx.push(a, b, a + 1, a + 1, b, b + 1);              // 外表面
      idx.push(a + 2, b + 2, a, a, b + 2, b);              // 侧边 1
      idx.push(a + 1, b + 1, a + 3, a + 3, b + 1, b + 3); } // 侧边 2
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv.map((x, i) => i % 2 ? x : x / L), 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  // 松紧带姿态：slide（向天头滑出的距离）、flop（0..1 向后倒在桌面）、relax（放松后缩短）
  function poseElastic(theta, top, slide = 0, flop = 0) {
    const raw = loopPts(theta, top); const z0 = EL.z - slide; const pts = [];
    const a = flop * Math.PI / 2, zHinge = Math.min(z0, -S.CH / 2 - 0.5);
    const shrink = 1 - 0.12 * flop;
    for (let i = 0; i < raw.length; i++) {
      let [x, y] = raw[i]; x = S.CW / 2 + (x - S.CW / 2) * shrink; y = y * (1 - 0.25 * flop);
      const p = new THREE.Vector3(x, y * Math.cos(a), z0 - y * Math.sin(a));
      pts.push(p);
    }
    const arr = pts.map((p, i) => { const pa = pts[Math.max(i - 1, 0)], pb = pts[Math.min(i + 1, pts.length - 1)]; const tg = pb.clone().sub(pa).normalize();
      const bw = new THREE.Vector3(0, -Math.sin(a), -Math.cos(a)).multiplyScalar(-1); const nrm = new THREE.Vector3().crossVectors(tg, bw).normalize().multiplyScalar(-1); return { p, nrm, bw }; });
    elastic.geometry.dispose(); elastic.geometry = buildBand(arr, EL.w, EL.t);
  }

  // 摊开时：松紧带从封底下面绕出书口，松松地躺在桌面上（扁平的一个 U 形圈）
  function poseElasticOpen() {
    const z0 = EL.z, y = 0.036, X = S.CW, pts = [];
    const ctl = [[X - 2.5, z0 + 0.5], [X - 0.2, z0 + 0.55], [X + 0.7, z0 + 0.6], [X + 1.25, z0 + 0.35], [X + 1.38, z0 - 0.08], [X + 1.15, z0 - 0.5], [X + 0.55, z0 - 0.6], [X - 0.2, z0 - 0.5], [X - 2.5, z0 - 0.45]];
    const c = new THREE.CatmullRomCurve3(ctl.map(([x, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
    const n = 80; const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i <= n; i++) { const t = i / n; const p = c.getPointAt(t); const tg = c.getTangentAt(t);
      // 平躺：带宽沿水平面里垂直于走向的方向；宽度按弯曲略收（松紧带弯曲时收窄）
      const bw = new THREE.Vector3().crossVectors(up, tg).normalize();
      pts.push({ p: p.clone().addScaledVector(up, -0.035), nrm: up.clone(), bw }); }
    elastic.geometry.dispose(); elastic.geometry = buildBand(pts, EL.w * 0.82, EL.t);
  }

  // ================= 三、封面装饰（挂在封面铰链上，跟着封面转）=================
  const coverTop = (2 * S.B + S.T) - yH; // 封面外表面在铰链坐标里的高度
  setK(260); // 封面装饰：近看 / 斜看时烫金、织纹、缝线也清楚
  const onCover = (m, x, z, lift, rotY = 0) => { m.position.set(x, coverTop + lift, z); m.rotation.y = rotY * Math.PI / 180; frontPivot.add(m); return m; };
  // 布贴名标：织纹 + 两端缝线 + 刺绣 Koko
  { const sp = sprite(3.3, 1.05, (g, w, d) => {
      g.fillStyle = '#FFF4E0'; g.fillRect(0, 0, w, d);
      g.strokeStyle = 'rgba(200,160,120,0.22)'; g.lineWidth = 0.012; for (let x = 0; x < w; x += 0.035) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, d); g.stroke(); } for (let y = 0; y < d; y += 0.05) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.fillStyle = '#F2844E'; g.fillRect(0, 0.06, w, 0.07); g.fillRect(0, d - 0.13, w, 0.07);
      g.save(); g.font = '0.52px NunitoP'; g.textAlign = 'center'; g.fillStyle = '#4E7FB0'; g.fillText('Koko', w / 2, d * 0.68);
      g.globalCompositeOperation = 'source-atop'; g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 0.012; for (let x = -1; x < w + 1; x += 0.05) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 0.25, d); g.stroke(); } g.restore();
      doodle.heart(g, w / 2 + 0.95, d * 0.5, 0.16, '#F48C7A');
      g.setLineDash([0.09, 0.06]); g.strokeStyle = '#C9805A'; g.lineWidth = 0.025; for (const x of [0.18, w - 0.18]) { g.beginPath(); g.moveTo(x, 0.12); g.lineTo(x, d - 0.12); g.stroke(); } });
    onCover(cardMesh(sp, 0.035, { edge: 0xF7E6CC }), 11.55, 8.75, 0.018, -2); }
  // 口袋 + 插着的明信片
  { const card = sprite(4.5, 3.3, (g, w, d) => { g.fillStyle = '#EEF4FB'; g.fillRect(0, 0, w, d); g.fillStyle = P.snowPale; g.fillRect(0.2, 0.2, 1.9, 1.3);
      for (let i = 0; i < 5; i++) doodle.snowflake(g, 0.4 + Math.random() * 1.5, 0.4 + Math.random() * 0.9, 0.13, P.snowDeep, 0.025);
      hand(g, '雪绒国 明信片', 2.3, 0.62, 0.3, P.inkBlue); hand(g, '给 Koko', 2.3, 1.15, 0.3, P.ink); g.strokeStyle = 'rgba(78,127,176,0.4)'; g.lineWidth = 0.015; for (let y = 1.8; y < d; y += 0.4) { g.beginPath(); g.moveTo(2.3, y); g.lineTo(w - 0.2, y); g.stroke(); } });
    onCover(cardMesh(card, 0.02, { edge: 0xffffff }), 4.45, 6.65, 0.012, 3);
    const pk = sprite(5.4, 3.7, (g, w, d) => { g.fillStyle = P.kraft; g.beginPath(); g.moveTo(0, 0.25); g.quadraticCurveTo(w / 2, -0.05, w, 0.25); g.lineTo(w, d); g.lineTo(0, d); g.closePath(); g.fill();
      g.save(); g.clip(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.14; for (let i = 0; i < 2500; i++) { g.fillStyle = Math.random() > 0.5 ? '#fff' : '#000'; g.fillRect(Math.random() * w, Math.random() * d, 0.025, 0.025); } g.restore();
      g.setLineDash([0.14, 0.09]); g.strokeStyle = '#FFF1DA'; g.lineWidth = 0.035; g.beginPath(); g.moveTo(0.2, 0.42); g.lineTo(0.2, d - 0.2); g.lineTo(w - 0.2, d - 0.2); g.lineTo(w - 0.2, 0.42); g.stroke();
      g.setLineDash([]); print(g, '收藏夹', 0.45, d - 0.55, 0.32, P.cocoa, 'ChillRound'); doodle.star(g, w - 0.6, d - 0.65, 0.2, '#FFF1DA'); });
    onCover(cardMesh(pk, 0.05, { edge: 0xC79C6B }), 4.4, 7.75, 0.03, 0); }
  // 封面贴纸：晴字圆贴、星星、橘子
  { const sun = sprite(1.9, 1.9, (g) => { g.fillStyle = P.white; g.beginPath(); g.arc(0.95, 0.95, 0.95, 0, 7); g.fill(); g.fillStyle = '#F6C445'; g.beginPath(); g.arc(0.95, 0.95, 0.78, 0, 7); g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.05; g.stroke(); print(g, '晴', 0.95, 1.18, 0.66, P.ink, 'ChillRound', 'center'); });
    onCover(cardMesh(sun, 0.012, { edge: 0xffffff, rim: 0.5 }), 12.2, -8.75, 0.01, 10);
    const star = sprite(1.3, 1.3, (g) => { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const r = i % 2 ? 0.27 : 0.6; pts.push([0.65 + Math.cos(a) * r, 0.68 + Math.sin(a) * r]); }
      g.lineJoin = 'round'; g.fillStyle = P.white; g.strokeStyle = P.white; g.lineWidth = 0.18; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(...p) : g.moveTo(...p)); g.closePath(); g.stroke(); g.fill(); g.fillStyle = '#A9BEF0'; g.lineWidth = 0.04; g.strokeStyle = P.ink; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(...p) : g.moveTo(...p)); g.closePath(); g.fill(); g.stroke(); });
    onCover(cardMesh(star, 0.012, { edge: 0xffffff, foil: 0.6 }), 13.45, -7.95, 0.024, -8);
    const os = item.orangeSticker(0.62); onCover(cardMesh(os, 0.012, { edge: 0xffffff }), 7.1, 9.25, 0.055, -10); }
  // 包角：香槟黄铜，倒角包住纸板三面（上下两片 + 侧壁），每只一颗压花铆钉（上下各一）
  // 外沿对齐封面 boardGeo 的 bevel 延伸（x = CW+bevel，z = ±(CH/2+bevel)，圆角 coverR+bevel），再外扩 0.03 严密包住纸板
  const cornerMat = brassMat(1, 0xD6B070);
  function cornerGeo() {
    const L = 1.95, R = S.coverR + S.bevel + 0.03, s = new THREE.Shape();
    s.moveTo(-L, 0); s.lineTo(-R, 0); s.quadraticCurveTo(0, 0, 0, -R); s.lineTo(0, -L); s.quadraticCurveTo(-L * 0.55, -L * 0.55, -L, 0); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: S.B + 0.04, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 16 });
    g.rotateX(Math.PI / 2); g.translate(0, S.B + 0.02, 0); // 局部 y 覆盖 [-0.05, S.B + 0.05]
    const riv = []; for (const [y, sy] of [[S.B + 0.055, 1], [-0.055, -1]]) { const r = new THREE.SphereGeometry(0.075, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2); r.scale(1, 0.55 * sy, 1); r.translate(-0.56, y, -0.56); riv.push(r);
      const ring = new THREE.TorusGeometry(0.095, 0.014, 8, 32); ring.rotateX(Math.PI / 2); ring.translate(-0.56, y, -0.56); riv.push(ring); }
    return mergeGeos([g, ...riv]); }
  const cg = cornerGeo(); const corners = [];
  for (const [sz, flip] of [[-1, -1], [1, 1]]) {
    const ax = S.CW + S.bevel + 0.03, az = sz * (S.CH / 2 + S.bevel + 0.03);
    const m = new THREE.Mesh(cg, cornerMat); m.castShadow = true; m.scale.set(1, 1, flip); m.position.set(ax, coverTop - S.B, az); frontPivot.add(m); corners.push(m);
    const b = new THREE.Mesh(cg, cornerMat); b.castShadow = true; b.scale.set(1, 1, flip); b.position.set(ax, 0.0, az); book.add(b); corners.push(b);
  }
  // 上下两面分别锚在封面外表面以下 S.B、封底 y=0，局部 y 严密包住纸板
  corners.forEach((m, i) => { m.position.y = i % 2 === 0 ? coverTop - S.B : 0.0; });

  // ================= 四、每帧摆位 =================
  let photoMesh = null;
  async function loadPhoto() { const im = await new Promise((r) => { const x = new Image(); x.onload = () => r(x); x.src = photo.img; });
    const w = 5.0, d = w * im.height / im.width + 0.9; const bw = 0.25;
    const sp = sprite(w, d, (g) => { g.fillStyle = P.white; g.fillRect(0, 0, w, d); g.imageSmoothingQuality = 'high'; g.drawImage(im, bw, bw, w - 2 * bw, (w - 2 * bw) * im.height / im.width); hand(g, '云朵午后', bw + 0.1, d - 0.28, 0.32, P.inkBlue); });
    photoMesh = cardMesh(sp, 0.045, { edge: 0xffffff, unlit: [bw / w, (0.9 - bw) / d, 1 - bw / w, 1 - bw / d] });
    tuck(photoMesh, 0.38, 10.6, S.PH / 2 - d / 2 + 1.75, 5, 'z'); photoMesh.userData.fx = { kind: 'photo', sid: 'cloud', out: 1.4 }; }
  // tR、tL：右/左书芯厚度；bulge(x)：书芯在 x 处的鼓起；closed：合上
  function place(tR, tL, bulge, closed) {
    const flipped = tL / S.T;
    for (const m of tucked) { const { h, x, z, r } = m.userData.t;
      const toLeft = !closed && h > 1 - flipped + 1e-3;
      if (!toLeft) { const y = S.B + h * S.T * (1 + bulge(x) / S.T); m.visible = h * S.T <= tR + 0.01; m.position.set(x, y, z); m.rotation.set(0, r, 0); m.scale.set(1, 1, 1); }
      else { const y = S.B + (1 - h) * S.T; m.visible = (1 - h) * S.T <= tL + 0.01; m.position.set(-x, y, z);
        // 天头/地脚探出的东西：翻到左边后仍朝天头/地脚探出（只镜像 x 位置，不绕 y 转 180°——否则银杏叶会变成叶柄朝外、叶片缩进书里）
        if (m.userData.t.axis === 'z') m.rotation.set(0, -r, 0); else m.rotation.set(0, Math.PI - r, 0); m.scale.set(1, 1, 1); }
      if (m.userData.fx) m.userData.base = { x: m.position.x, y: m.position.y, z: m.position.z, ry: m.rotation.y };
    }
  }
  // ---- Edge widget animation handles (runtime.js drives them; rest pose = exactly what place() set) ----
  const edgeItems = () => tucked.filter((m) => m.userData.fx && m.userData.base);
  // s: slide-out amount 0..1 (x fx.out cm, along the item's own outward axis); w: yaw wiggle (rad)
  function fxPose(m, s, w) { const b = m.userData.base, f = m.userData.fx, t = m.userData.t;
    const lx = t.axis === 'x' ? 1 : 0, lz = t.axis === 'x' ? 0 : Math.sign(t.z), c = Math.cos(b.ry), sn = Math.sin(b.ry), k = s * f.out;
    m.position.set(b.x + (lx * c + lz * sn) * k, b.y, b.z + (-lx * sn + lz * c) * k); m.rotation.set(0, b.ry + w, 0); }
  function fxRest(m) { const b = m.userData.base; if (!b) return; m.position.set(b.x, b.y, b.z); m.rotation.set(0, b.ry, 0); }
  // Orange charm: swing the desk end of the twine around its bend point (a = angle, rad); a = 0 restores the laid line exactly
  const SWING_W = [0, 0, 0, 0, 0, 0, 0, 0.45, 0.8, 1];
  function charmSwing(a) { if (!twBase) return;
    if (a === 0) { buildTwine(twBase); return; }
    const o = twBase[6]; const pts = twBase.map((p, i) => { const q = p.clone(); const wa = a * (SWING_W[i] ?? 1); if (!wa) return q;
      const dx = p.x - o.x, dz = p.z - o.z, c = Math.cos(wa), sn = Math.sin(wa); q.x = o.x + dx * c - dz * sn; q.z = o.z + dx * sn + dz * c; return q; });
    buildTwine(pts); orangeCharm.rotation.y += a * 0.5; }
  const charmPos = (v = new THREE.Vector3()) => orangeCharm.localToWorld(v.set(0, 0.395, 0));

  // 烫金书名贴图（封面版心坐标；封面着色器里按 alpha 烫金 + 压印余韵）
  function makeTitleTex() {
    const C = ctx.COVER, W = 2 * C.phx, H = 2 * C.phz, KK = 340;
    const cv = document.createElement('canvas'); cv.width = Math.round(W * KK); cv.height = Math.round(H * KK);
    const g = cv.getContext('2d'); g.scale(KK, KK); g.fillStyle = '#000'; g.strokeStyle = '#000'; g.lineJoin = 'round'; g.lineCap = 'round';
    g.lineWidth = 0.055; rr(g, 0.32, 0.32, W - 0.64, H - 0.64, 0.42); g.stroke();
    for (const [x, y] of [[0.62, 0.62], [W - 0.62, 0.62], [0.62, H - 0.62], [W - 0.62, H - 0.62]]) { g.beginPath(); g.arc(x, y, 0.07, 0, 7); g.fill(); }
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.font = '800 1.05px NunitoP'; g.fillText('Koko', W / 2, 1.72);
    const t2 = '的魔法手账', fs = 0.74, gap = 0.16; g.font = fs + 'px WenKai'; g.lineWidth = 0.02;
    const tw = t2.length * fs + (t2.length - 1) * gap; let x = W / 2 - tw / 2 + fs / 2;
    for (const ch of t2) { g.fillText(ch, x, 2.72); g.strokeText(ch, x, 2.72); x += fs + gap; }
    g.lineWidth = 0.035; for (const sx of [-1]) { g.beginPath(); g.moveTo(W / 2 - 1.5, 3.18); g.lineTo(W / 2 - 0.32, 3.18); g.moveTo(W / 2 + 0.32, 3.18); g.lineTo(W / 2 + 1.5, 3.18); g.stroke(); }
    doodle.star(g, W / 2, 3.18, 0.14, '#000');
    g.font = '0.44px WenKai'; g.lineWidth = 0.028; const t3 = '晴 窗 手 账 · 二〇二六'; g.fillText(t3, W / 2, H - 0.74); g.strokeText(t3, W / 2, H - 0.74);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t;
  }
  return { makeTitleTex, cardMat, cardMesh, tex, place, poseElastic, poseElasticOpen, layTwine, orangeCharm, charmGroup, elastic, loadPhoto, EL, edgeItems, fxPose, fxRest, charmSwing, charmPos };
}
