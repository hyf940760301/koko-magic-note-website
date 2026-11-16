// 晴窗手账 · 书本本体原型（three.js r160，程序化几何 + 手写着色器）
// 单位：1 = 1 厘米。Y 向上，书平放在桌面 y=0；屏幕上方 = -Z。
import * as THREE from './vendor/three/three.module.js';
import { buildRoom } from './room.js';
import { buildPages } from './pages.js';
import { buildDress } from './dress.js';
import { createPatchSystem } from './pagePatches.js';
import { createPost } from './post.js';
import { startRuntime } from './runtime.js';

// ---------------- 规格常量 ----------------
const S = {
  PW: 14.8, PH: 20.72,          // 内页 5:7
  OV: 0.30,                     // 封面三边飞边
  B: 0.30,                      // 纸板厚（厚布面软封面）
  T: 2.8,                       // 书芯总厚（约 200 张 120g 纸 + 夹满照片贴纸票根）
  coverR: 0.85,                 // 书口侧圆角（更圆润软萌）
  spineR: 0.10,                 // 书脊侧圆角
  bevel: 0.085,                 // 封面边缘圆滚（厚布面包边）
  dip: 0.52, dipW: 3.0,         // 订口下沉
  roll: 0.07, rollW: 1.2,       // 书口微塌
  ribbonW: 0.42,
  strapW: 2.4, strapT: 0.09, flapL: 3.6, btnR: 0.85, btnH: 0.24,
  turnCols: 96, turnRows: 24, lead: 0.55, cone: 0.72,
  bulge: 0.95,                  // 塞满东西后，合上时书口比书脊高出 0.95（封面微微上翘张开）
  bow: 0.24,                    // 合上时书口在平面上向外鼓成弧（中间比两端多出 0.24）
};
S.CW = S.PW + S.OV; S.CH = S.PH + 2 * S.OV;
const hashf = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// 夹层：离封底的高度（厘米）、厚度、颜色索引、探出量 —— 书口上看得见的彩色卡纸层
// 夹在书里的彩色卡纸：[高度, 厚, 颜色, 探出, 沿书口中心 z, 半长, 斜率]——长短、间距、探出、倾斜都不一样（不是等距彩条）
const INSERTS = [[0.24, 0.07, 0, 0.10, -1.2, 8.0, 0.004], [0.64, 0.04, 1, 0.035, 3.6, 4.6, -0.006], [0.88, 0.063, 3, 0.07, -4.6, 4.2, 0.003],
  [1.44, 0.09, 2, 0.13, 0.6, 9.2, -0.0025], [1.90, 0.048, 4, 0.06, -6.0, 3.4, 0.008], [2.09, 0.04, 0, 0.03, 5.2, 3.6, 0.0], [2.58, 0.07, 1, 0.09, -0.8, 6.4, -0.004]];


const C = { // 颜色系统（sRGB hex）
  paper: 0xFFF6E6, edge: 0xFBE9CC, dot: 0xF0DDBE, sticker: 0xFFFDF8,
  cover: 0xE8845C, spine: 0xFFF1DA, clasp: 0xF6C445, ribbon: 0xF2844E,
  shadow: 0xC9805A, ink: 0x5A3B2E, inkBlue: 0x4E7FB0, desk: 0xF7E4BF, honey: 0xEDBE7A,
  sun: 0xFFF4E2, amb: 0xFFE9D2,
};
const col = (h) => new THREE.Color(h); // ColorManagement：hex 视为 sRGB，转线性

const Q = new URLSearchParams(location.search);
const LIVE = !Q.get('state') && !Q.get('ui');   // 不带调试参数 = 正式运行（连续渲染、可交互）；带 state= 仍是原来的定格截图接口
const DPR = Math.min(window.devicePixelRatio || 1, 2);
// 画面调校值。网址加 ?t=shadow:0.7,form:0.8 可以临时改着看（只为调画面，不是给玩家的开关）
const TUNE = { shadow: 0.62,        // 影子的深浅（0 = 没有影子，1 = 影子完全染成影色）
  form: 0.80,                       // 纸面背光一侧最暗压到多少（1 = 不压）
  mottle: 0.03,                     // 纸面云状不匀的幅度
  ao: 0.5, aoW: 2.6,                // 书压在桌上的大范围软影：强度、宽度（厘米）
  winX: 2.5, mullX: 21,             // 阅读时窗影挪开的距离：整扇窗、窗棂（让窗棂的影子落在桌上，不横穿书页）
  desk: 0xF2D9AE,                   // 桌面颜色
};
for (const kv of (Q.get('t') || '').split(',')) { const [k, v] = kv.split(':'); if (k in TUNE) TUNE[k] = k === 'desk' ? parseInt(v, 16) : parseFloat(v); }

// ---------------- 渲染器 ----------------
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !LIVE });
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;   // 不做色调映射：海报颜色保真
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(col(C.desk));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, innerWidth / innerHeight, 1, 1200);

// 太阳：左上方（-X, +Y, -Z）
const SUN_DIR = new THREE.Vector3(-0.36, 0.70, -0.62).normalize();
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.position.copy(SUN_DIR).multiplyScalar(90);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -56; sun.shadow.camera.right = 80;   // 覆盖台灯、笔筒、绿植的投影（全景需要）
sun.shadow.camera.top = 52; sun.shadow.camera.bottom = -52;
sun.shadow.camera.near = 10; sun.shadow.camera.far = 160;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025;
scene.add(sun); scene.add(sun.target);

// ---------------- 房间与窗户（几何数值同时驱动光斑）----------------
export const WIN = {
  wallZ: -28, glassZ: -34,           // 墙面与玻璃面（窗洞进深 6）
  cx: -14, cy: 62, hw: 32, hh: 46,   // 玻璃区：x -46..18，y 16..108（离桌面）；窗台压低到桌面上 11.5，书前近景也看得到窗和窗外
  frame: 4.5, mull: 2.4, transomY: 1000, curtainX: -49,
};
// ---------------- 共享着色片段 ----------------
const sigUniform = { value: 0 }, sigTexU = { value: null };   // 扉页签名：书写进度、笔顺贴图
const shared = {
  uSunDir: { value: SUN_DIR }, uSunCol: { value: col(C.sun) }, uAmb: { value: col(C.amb) },
  uShadowTint: { value: col(C.shadow) }, uShadowStr: { value: TUNE.shadow }, uForm: { value: TUNE.form },
  uTime: { value: 0 }, uCookieOff: { value: new THREE.Vector2(0, 0) }, uCookieOn: { value: 1 },
  // 真实窗户：玻璃面 z、窗洞中心与半宽高、窗棂半宽、横档高度、纱帘右缘
  uWin: { value: new THREE.Vector4(WIN.cx, WIN.cy, WIN.hw, WIN.hh) },
  uWinP: { value: new THREE.Vector4(WIN.glassZ, WIN.mull / 2, WIN.transomY - WIN.cy, WIN.curtainX) },
};
const GLSL_COMMON = /* glsl */`
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uAmb; uniform vec3 uShadowTint; uniform float uShadowStr;
uniform float uTime; uniform vec2 uCookieOff; uniform float uCookieOn;
varying vec3 vWP; varying vec3 vWN;
float sdRoundBox(vec2 p, vec2 b, float r){ vec2 q=abs(p)-b+r; return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r; }
float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float lodBias(vec2 uv){ vec2 dx=dFdx(uv), dy=dFdy(uv); float ax=length(dx), ay=length(dy); float an=max(ax,ay)/max(min(ax,ay),1e-5); return an>4.0 ? 0.0 : -0.35; }
float pnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash12(i),hash12(i+vec2(1.0,0.0)),f.x), mix(hash12(i+vec2(0.0,1.0)),hash12(i+vec2(1.0,1.0)),f.x), f.y); }
uniform float uForm;
// 纸面随朝向的连续明暗：风格化受光只有两阶，平缓的弧面（订口、翘角、翻起的纸）上看不出起伏，这里补一层
float formShade(vec3 N){ return mix(uForm, 1.0, smoothstep(-0.25, 0.70, dot(normalize(N), uSunDir))); }
uniform vec4 uWin; uniform vec4 uWinP;
float dapple(vec2 p){ vec2 g=floor(p), f=fract(p); float m=0.0;
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 o=vec2(float(i),float(j)); vec2 r=o+vec2(hash12(g+o),hash12(g+o+7.13))*0.8-f; m=max(m, 1.0-smoothstep(0.18,0.46,length(r))); }
  return m; }
// 窗格光斑（几何真实）：从该点朝太阳方向打到玻璃面，查询窗洞、十字窗棂、纱帘和窗外树叶
float windowCookie(vec3 wp){
  if(uCookieOn < 0.5) return 1.0;
  float t = (uWinP.x - wp.z) / uSunDir.z;
  if(t < 0.0) return 0.0;
  vec2 h = wp.xy + uSunDir.xy * t;
  float soft = 0.25 + t*0.012;                    // 离窗越远半影越宽（桌面上约 1.8）
  vec2 q = h - uWin.xy; q.x -= uCookieOff.x;      // 阅读时整扇窗的影子挪一点
  float outer = sdRoundBox(q, uWin.zw, 1.5);
  float lit = 1.0 - smoothstep(-soft, soft, outer);
  lit *= smoothstep(-soft, soft, abs(q.x - uCookieOff.y) - uWinP.y);   // 窗棂（阅读时另外挪开）
  lit *= smoothstep(-soft, soft, abs(q.y - uWinP.z) - uWinP.y);
  // 纱帘：盖住窗左侧，透 60%，随褶皱起伏，缓慢飘
  float cur = 1.0 - smoothstep(uWinP.w - soft*2.0, uWinP.w + soft*2.0, h.x);
  float folds = 0.5 + 0.5*sin(h.x*0.95 + sin(h.y*0.06 + uTime*0.5)*1.4);
  lit *= mix(1.0, 0.5 + 0.2*folds, cur);
  // 窗外树叶的光斑：只在窗的上半部，缓慢摇动
  float tree = smoothstep(uWin.y - 5.0, uWin.y + 30.0, h.y);
  if(lit > 0.0005 && tree > 0.0){
    float dp = dapple(h*0.16 + vec2(uTime*0.03, sin(uTime*0.4)*0.15));
    lit *= mix(1.0, 0.62 + 0.38*dp, tree*0.8);
  }
  return lit;
}
float outA(){ return distance(vWP, cameraPosition); }   // 写进 alpha：到相机的距离（景深与光束用）
// 风格化受光：包裹漫反射 → 两阶柔和明暗；阴影统一染杏色
vec3 stylizedLight(vec3 base, vec3 N, float shadowMask){
  float d = dot(normalize(N), uSunDir);
  float w = (d + 0.35) / 1.35;
  float ramp = smoothstep(0.18, 0.62, w);
  float ck = windowCookie(vWP);
  float lit = ramp * mix(0.26 * mix(0.8, 1.0, shadowMask), shadowMask, ck);   // 光斑外 = 屋内漫射 34%（物体只留极淡的影）；光斑内 = 直射 + 实影
  vec3 shade = mix(vec3(1.0), uShadowTint, uShadowStr);
  vec3 c = base * mix(shade * uAmb, uSunCol, lit);
  c += base * vec3(1.0,0.86,0.62) * 0.05 * ck * ramp * shadowMask; // 光斑里一点暖光
  return c;
}
`;
const VERT = /* glsl */`
#include <common>
#include <shadowmap_pars_vertex>
varying vec3 vWP; varying vec3 vWN; varying vec2 vUv; varying vec3 vLP; varying vec3 vLN;
void main(){
  vUv = uv; vLP = position; vLN = normal;
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <project_vertex>
  #include <worldpos_vertex>
  #include <shadowmap_vertex>
  vWP = (modelMatrix*vec4(position,1.0)).xyz;
  vWN = normalize(mat3(modelMatrix)*normal);
}`;
const FRAG_HEAD = /* glsl */`
#include <common>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
varying vec2 vUv; varying vec3 vLP; varying vec3 vLN;
` + GLSL_COMMON;

function makeMat(fragBody, extra = {}, opts = {}) {
  return new THREE.ShaderMaterial({
    lights: true,
    uniforms: Object.assign(THREE.UniformsUtils.merge([THREE.UniformsLib.lights]), shared, extra),
    vertexShader: VERT, fragmentShader: FRAG_HEAD + fragBody, ...opts,
  });
}
// ---------------- 材质 ----------------
// 封面版式（封面局部坐标 x: 0 书脊 → CW 书口，z: 负 = 天头）
const COVER = { px: 7.55, pz: -1.2, phx: 3.6, phz: 4.6, pr: 0.7, sunX: 7.55, sunZ: 0.15, sunK: 0.78 };
const uCover = { uBase: { value: col(C.cover) }, uEnd: { value: col(C.spine) }, uInk: { value: col(C.ink) },
  uTitle: { value: new THREE.DataTexture(new Uint8Array(4), 1, 1) },
  uTR: { value: new THREE.Vector4(COVER.px - COVER.phx, COVER.pz - COVER.phz, 2 * COVER.phx, 2 * COVER.phz) } };
const coverMat = makeMat(/* glsl */`
uniform vec3 uBase; uniform vec3 uEnd; uniform vec3 uInk;
uniform float uIsFront; uniform sampler2D uTitle; uniform vec4 uTR;
float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash2(i), hash2(i+vec2(1,0)), f.x), mix(hash2(i+vec2(0,1)), hash2(i+vec2(1,1)), f.x), f.y); }
float weave(vec2 p, float per){ // 平纹布：经纬两向细线，像素足迹过大时淡出（防摩尔纹）
  vec2 k = p / per; vec2 fw = fwidth(k);
  vec2 s = abs(fract(k) - 0.5) * 2.0;
  float a = 1.0 - smoothstep(0.3, 0.7, max(fw.x, fw.y));
  float cell = mod(floor(k.x) + floor(k.y), 2.0);           // 经纬交替上浮
  float th = mix(s.y, s.x, cell);
  return (th - 0.5) * a;
}
float sunSDF(vec2 p){ // 封面压印：小太阳 + 十道光芒
  float d = length(p) - 1.25;
  for(int i=0;i<10;i++){ float a = float(i)*0.6283185 + 0.314159; vec2 dir=vec2(cos(a),sin(a));
    vec2 q = p - dir*2.05; float along = dot(q,dir); vec2 qq = q - dir*clamp(along,-0.3,0.3);
    d = min(d, length(qq)-0.15); }
  return d;
}
float sunD(vec2 p){ return sunSDF(p / SUNK) * SUNK; }
float boxSDF(vec2 p, vec2 h, float r){ vec2 q = abs(p) - h + r; return length(max(q,0.0)) + min(max(q.x,q.y),0.0) - r; }
// 风格化金箔：暗金 → 金 → 香槟高光；一道斜向光带随视角滑过
vec3 foilCol(vec3 N, vec3 V, vec2 p){
  float s = max(dot(reflect(-uSunDir, N), V), 0.0);
  float band = 0.5 + 0.5*sin(p.x*0.42 - p.y*0.30 + dot(V, vec3(7.0, 2.0, 5.0)));
  float t = clamp(0.30 + 0.30*pow(s, 6.0) + 0.50*smoothstep(0.80, 0.985, band), 0.0, 1.0);
  // 线性空间取值（封面改成更深的珊瑚蜜桃后，金要比布面亮一档才读得出）：暗金 sRGB(173,124,56) · 亮金 sRGB(231,188,100) · 香槟 sRGB(255,238,196)
  vec3 c = mix(vec3(0.42, 0.20, 0.04), vec3(0.80, 0.50, 0.13), smoothstep(0.0, 0.45, t));
  return mix(c, vec3(1.0, 0.86, 0.56), smoothstep(0.60, 1.0, t));
}
void main(){
  vec3 N = normalize(vWN);
  float up = vLN.y;
  bool isOut = up < -0.5;
  bool isIn  = up > 0.5;
  vec3 base = uBase;
  vec2 p = vLP.xz;
  float goldM = 0.0; vec3 lipLight = vec3(0.0);
  vec3 V0 = normalize(cameraPosition - vWP);
  vec2 Ld = normalize(vec2(-1.0, -1.0));   // 封面上的来光方向（左上）
  if(isIn){
    base = uEnd;
    vec2 g = fract(p/0.9) - 0.5; float dd = length(g) - 0.06; float fw = fwidth(dd);
    base = mix(base, base*vec3(0.95,0.89,0.80), (1.0-smoothstep(-fw,fw,dd))*0.8);
  } else {
    // 布面：低频色斑 + 粗细不匀的纬纱（竹节）+ 平纹
    base *= 1.0 + (vnoise(p*0.55) - 0.5)*0.06 + (vnoise(p*2.3) - 0.5)*0.025;
    float slub = vnoise(vec2(p.x*1.4, p.y*9.0)); float fwS = fwidth(p.y*9.0);
    base *= 1.0 + (slub - 0.5)*0.022*(1.0 - smoothstep(0.4, 0.9, fwS));
    base *= 1.0 + weave(p, 0.075)*0.05;
    base = mix(base, base*vec3(1.03, 0.97, 0.93), smoothstep(0.35, 0.9, vnoise(p*0.18 + 3.0))*0.5);
    if(isOut){
      // 订口压槽
      // 法式压槽（真几何，x 0.72–1.12）：槽底布面被压实，略深一点、纹理更密
      float gIn = 1.0 - smoothstep(0.0, 0.06, abs(p.x - 0.92) - 0.16);
      base *= 1.0 - gIn*0.05*(1.0 - abs(vLN.x)*2.0);
      if(uIsFront > 0.5){
      vec2 pf = vec2(p.x, -p.y);   // 封面局部 z 与书本相反：pf.y 负 = 天头
      // 压印版心：圆角矩形，下沉；左上内壁背光、右下内壁迎光 + 细亮边
      vec2 pc = pf - vec2(${COVER.px.toFixed(3)}, ${COVER.pz.toFixed(3)});
      float dP = boxSDF(pc, vec2(${COVER.phx.toFixed(3)}, ${COVER.phz.toFixed(3)}), ${COVER.pr.toFixed(3)});
      vec2 e = vec2(0.01, 0.0);
      vec2 gP = normalize(vec2(boxSDF(pc+e.xy, vec2(${COVER.phx.toFixed(3)}, ${COVER.phz.toFixed(3)}), ${COVER.pr.toFixed(3)}) - boxSDF(pc-e.xy, vec2(${COVER.phx.toFixed(3)}, ${COVER.phz.toFixed(3)}), ${COVER.pr.toFixed(3)}),
                            boxSDF(pc+e.yx, vec2(${COVER.phx.toFixed(3)}, ${COVER.phz.toFixed(3)}), ${COVER.pr.toFixed(3)}) - boxSDF(pc-e.yx, vec2(${COVER.phx.toFixed(3)}, ${COVER.phz.toFixed(3)}), ${COVER.pr.toFixed(3)})) + 1e-5);
      float fP = dot(gP, Ld);
      float fwP = fwidth(dP);
      float wall = smoothstep(-0.16 - fwP, -0.16 + fwP, dP) * (1.0 - smoothstep(-fwP, fwP, dP));
      float floorP = 1.0 - smoothstep(-0.16 - fwP, -0.16 + fwP, dP);
      base *= 1.0 - floorP*0.04;
      base *= 1.0 - wall*max(fP, 0.0)*0.30;                       // 背光内壁：暖可可
      base = mix(base, base*vec3(0.92, 0.80, 0.72), wall*max(fP, 0.0)*0.5);
      lipLight += vec3(1.0, 0.93, 0.82)*wall*max(-fP, 0.0)*0.16;   // 迎光内壁
      float occ = floorP * (1.0 - smoothstep(0.0, 0.35, -dP - 0.16)) * max(fP, 0.0);
      base *= 1.0 - occ*0.10;                                     // 内壁投到底面的窄影
      float lip = smoothstep(-fwP, fwP, dP) * (1.0 - smoothstep(0.0, 0.07, dP));
      lipLight += vec3(1.0, 0.95, 0.86)*lip*max(fP, 0.0)*0.12;    // 外沿受光棱
      // 压印小太阳：更深的凹槽 + 内壁明暗
      vec2 sp = pf - vec2(${COVER.sunX.toFixed(3)}, ${COVER.sunZ.toFixed(3)});
      float d = sunD(sp); float fw2 = fwidth(d);
      float inside = 1.0 - smoothstep(-fw2, fw2, d);
      vec2 gr = normalize(vec2(sunD(sp+e.xy)-sunD(sp-e.xy), sunD(sp+e.yx)-sunD(sp-e.yx)) + 1e-5);
      float facing = dot(gr, Ld);
      float sw = smoothstep(-0.09 - fw2, -0.09 + fw2, d) * inside;
      base *= 1.0 - inside*0.07;
      base *= 1.0 - sw*max(facing, 0.0)*0.28;
      lipLight += vec3(1.0, 0.93, 0.82)*sw*max(-facing, 0.0)*0.15;
      float slip = (1.0 - inside) * (1.0 - smoothstep(0.0, 0.06, d));
      lipLight += vec3(1.0, 0.95, 0.86)*slip*max(facing, 0.0)*0.10;
      // 烫金：太阳圆心 + 版心里的书名与细框（贴图）
      float core = length(sp) - 1.0*SUNK; float fwc = fwidth(core);
      goldM = 1.0 - smoothstep(-fwc, fwc, core);
      vec2 tuv = (pf - uTR.xy) / uTR.zw;
      if(tuv.x > 0.0 && tuv.x < 1.0 && tuv.y > 0.0 && tuv.y < 1.0){
        float ta = texture2D(uTitle, vec2(tuv.x, 1.0 - tuv.y)).a;
        float tb = texture2D(uTitle, vec2(tuv.x, 1.0 - tuv.y) + vec2(-0.004, 0.003), 2.0).a;  // 压印余韵：字左上一圈暗
        base *= 1.0 - max(tb - ta, 0.0)*0.34;
        goldM = max(goldM, ta);
      }
      }
      // 缝线：距外缘一圈奶白棉线
      vec2 hc = vec2(${(S.CW / 2 + 0.41).toFixed(3)}, 0.0), hs = vec2(${(S.CW / 2 - 0.83).toFixed(3)}, ${(S.CH / 2 - 0.42).toFixed(3)});
      vec2 q = abs(p - hc) - hs; float rd = length(max(q,0.0)) + min(max(q.x,q.y),0.0);
      float alongS = (abs(q.x) < abs(q.y)) ? p.y : p.x;
      float dash = step(fract(alongS / 0.48), 0.66);
      float fws = fwidth(rd);
      float th = 1.0 - smoothstep(0.024 - fws, 0.024 + fws, abs(rd));
      float holeSh = 1.0 - smoothstep(0.0, 0.06, abs(rd + 0.03));
      base *= 1.0 - holeSh*0.06;
      base = mix(base, vec3(1.0, 0.95, 0.86), th*dash);
      base *= 1.0 - th*(1.0-dash)*0.12;
      // 外缘磨白：离封面边越近越浅一点
      vec2 qe = abs(p - vec2(${(S.CW / 2).toFixed(3)}, 0.0)) - vec2(${(S.CW / 2).toFixed(3)}, ${(S.CH / 2).toFixed(3)});
      float de = -max(qe.x, qe.y);
      base = mix(base, base*vec3(1.05, 1.02, 0.98), (1.0 - smoothstep(0.0, 0.35, de))*0.6);
    }
  }
  float sm = getShadowMask();
  vec3 c = stylizedLight(base, N, sm) + lipLight*mix(0.35, 1.0, sm);
  if(goldM > 0.001){
    vec3 fc = foilCol(N, V0, vec2(p.x, -p.y)) * mix(0.78, 1.0, sm);
    // 太阳圆心：放射细纹（雕刻感）+ 圆周一道暗压线
    vec2 sq = vec2(p.x, -p.y) - vec2(${COVER.sunX.toFixed(3)}, ${COVER.sunZ.toFixed(3)}); float rr0 = length(sq);
    if(rr0 < SUNK*1.02){ float ang = atan(sq.y, sq.x);
      float rays = 0.5 + 0.5*sin(ang*36.0 + dot(V0, vec3(3.0,0.0,2.0))); float fr = fwidth(ang*36.0);
      fc *= 1.0 + (rays - 0.5)*0.22*(1.0 - smoothstep(0.5, 1.5, fr))*smoothstep(0.12, 0.35, rr0);
      fc *= 1.0 - 0.28*(1.0 - smoothstep(0.0, 0.05, SUNK - rr0)); }
    c = mix(c, fc, goldM);
  }
  float rim = smoothstep(0.15, 0.6, 1.0 - abs(vLN.y)) * step(0.01, length(vLN.xz));
  c += vec3(1.0,0.96,0.9)*0.06*rim*max(dot(N,uSunDir),0.0);
  gl_FragColor = vec4(c,outA());
  #include <colorspace_fragment>
}`.replaceAll('SUNK', COVER.sunK.toFixed(3)), Object.assign({ uIsFront: { value: 0 } }, uCover));

// 书芯侧面（书口/天头/地脚）：页边奶杏 + 细页线
const blockMat = makeMat(/* glsl */`
uniform vec3 uEdge; uniform vec3 uIns[5];
void main(){
  vec3 N = normalize(vWN);
  float along = abs(N.x) > 0.5 ? vWP.z : vWP.x;                     // 沿书口方向
  float y = vWP.y - ${S.B.toFixed(3)} + 0.012*sin(along*1.3 + vWP.y*31.0) + 0.006*sin(along*4.1);  // 纸线微微起伏
  float k = y / 0.09; float fw = fwidth(k);
  float l = abs(fract(k)-0.5)*2.0;
  float a = 1.0 - smoothstep(0.3, 0.7, fw);
  vec3 base = uEdge * (1.0 - (1.0-smoothstep(0.0,0.35,l))*0.035*a);
  // 一页一页的纸：0.0105cm 一张（≈190 张），每张随机明暗 ±3%，张与张之间一丝微影；像素足迹太大时淡出成均匀纸色
  float kf = y / 0.0105; float fwf = fwidth(kf); float lf = abs(fract(kf) - 0.5) * 2.0;
  float af = 1.0 - smoothstep(0.35, 0.8, fwf); float af2 = 1.0 - smoothstep(0.8, 2.5, fwf);
  float hl = fract(sin(floor(kf) * 12.9898 + floor(along * 0.35) * 3.7) * 43758.5453);
  base *= 1.0 + (hl - 0.5) * 0.06 * af2;
  base *= 1.0 - (1.0 - smoothstep(0.0, 0.4, lf)) * 0.09 * af;
  // 每 16 张一帖：帖与帖之间稍深的一道缝
  float ks = y / 0.168; float fws = fwidth(ks); float ls = abs(fract(ks) - 0.5) * 2.0;
  base *= 1.0 - (1.0 - smoothstep(0.0, 0.12, ls)) * 0.06 * (1.0 - smoothstep(0.3, 0.8, fws));
  // 夹在书里的彩色卡纸
  ${INSERTS.map(([iy, it, ci, , zc, zh, sl]) => `{ float yy = y - ${iy.toFixed(3)} - ${sl.toFixed(4)}*(along - ${zc.toFixed(2)}); float d = abs(yy) - ${(it/2).toFixed(3)};
    float inR = abs(N.x) > 0.5 ? 1.0 - smoothstep(${(zh - 0.04).toFixed(2)}, ${(zh + 0.04).toFixed(2)}, abs(along - ${zc.toFixed(2)})) : 1.0;
    float f = (1.0 - smoothstep(-0.004, 0.004, d))*inR; base = mix(base, uIns[${ci}], f); base *= 1.0 - 0.12*(1.0 - smoothstep(0.0, 0.010, abs(d)))*f;
    base *= 1.0 + 0.08*f*(1.0 - smoothstep(0.0, 0.008, ${(it/2).toFixed(3)} - yy));                                        // 卡纸上沿受光
    float un = clamp((-yy - ${(it/2).toFixed(3)}) / 0.035, 0.0, 1.0); base *= 1.0 - 0.22*inR*step(0.0001, -yy - ${(it/2).toFixed(3)})*(1.0 - un)*(1.0 - un); }   // 卡纸压出的接触影`).join('\n  ')}
  // 每一叠纸之间偶尔一道暗缝（厚卡页）
  float gap = step(0.86, fract(sin(floor(y/0.06)*91.7)*43758.5)); base *= 1.0 - gap*0.07*(1.0-smoothstep(0.0,0.4,l))*a;
  float sm = getShadowMask();
  gl_FragColor = vec4(stylizedLight(base, N, sm),outA());
  #include <colorspace_fragment>
}`, { uEdge: { value: col(C.edge) }, uIns: { value: [col(0xD9B48A), col(0xA8DCC8), col(0xFFC2A8), col(0xA8C4E4), col(0xC9B6E4)] } }, { side: THREE.DoubleSide });

// 内页：纸 + 内容 RT（预乘）+ 海报不受光遮罩 + 订口杏色影
function pageMat(params) {
  return makeMat(/* glsl */`
uniform vec3 uPaper; uniform vec3 uEdgeTint; uniform vec3 uDot;
uniform sampler2D uFront; uniform sampler2D uBack; uniform sampler2D uMaskF; uniform sampler2D uMaskB;
uniform float uHasFront; uniform float uHasBack; uniform vec2 uSize; uniform float uSpineAtU0; uniform float uLift;
uniform sampler2D uSig; uniform float uSigOn; uniform float uSigP; uniform vec3 uSigInk; uniform float uMottle;
vec3 paper(vec2 uv){
  vec2 cm = uv*uSize;
  vec3 c = uPaper;
  // 细颗粒：0.035cm 一格，±2.5%，按屏幕足迹淡出
  vec2 g = cm/0.035; float fw = fwidth(g.x);
  float n = hash12(floor(g)) - 0.5;
  c *= 1.0 + n*0.05*(1.0-smoothstep(0.6,1.4,fw));
  // 纸纤维只用一层固定颗粒（上面 n），避免在每个像素算多层噪声拖慢翻页
  // 5mm 点阵
  vec2 q = fract(cm/0.5) - 0.5; float dd = length(q*0.5) - 0.018; float fw2 = fwidth(dd);
  float em = min(min(cm.x, uSize.x-cm.x), min(cm.y, uSize.y-cm.y));
  c = mix(c, uDot, (1.0-smoothstep(-fw2,fw2,dd))*0.7*smoothstep(0.55,0.75,em)); // 点阵离纸边 ≥0.6cm
  // 边缘 0.25cm 染页边色
  float e = min(min(cm.x, uSize.x-cm.x), min(cm.y, uSize.y-cm.y));
  c = mix(uEdgeTint, c, smoothstep(0.0, 0.25, e));
  return c;
}
void main(){
  bool front = gl_FrontFacing;
  vec2 uv = vUv;
  vec2 cuv = front ? uv : vec2(1.0-uv.x, uv.y);
  vec3 c = paper(cuv);
  vec4 ct = front ? texture2D(uFront, cuv, lodBias(cuv)) : texture2D(uBack, cuv, lodBias(cuv));   // 平放时保持小字锐利；纸卷成急弯、斜着看时改回正常采样，避免海报碎成格子
  float has = front ? uHasFront : uHasBack;
  ct *= has;
  float pm = (front ? texture2D(uMaskF, cuv).r : texture2D(uMaskB, cuv).r) * has;
  c = c*(1.0-ct.a) + ct.rgb;
  if(front && uSigOn > 0.5 && uSigP > 0.001){   // 签名：8×4 厘米，横向居中，上沿离页面中线 3 厘米；按笔顺进度显现
    vec2 su = vec2((cuv.x*uSize.x - (uSize.x*0.5 - 4.0)) / 8.0, (1.0 - uSize.y*0.5 + cuv.y*uSize.y) / 4.0);
    if(su.x > 0.0 && su.x < 1.0 && su.y > 0.0 && su.y < 1.0){
      vec4 sg = texture2D(uSig, su); float tip = 1.0 - smoothstep(uSigP - 0.008, uSigP + 0.002, sg.r);
      c = mix(c, uSigInk, sg.a * tip * 0.95);
    }
  }
  vec3 N = normalize(vWN); if(!front) N = -N;
  float sm = getShadowMask();
  vec3 lit = stylizedLight(c, N, sm) * formShade(N);
  // 薄纸透光：背光面透出暖光，避免翻起的纸背发闷发暗
  float bd = dot(N, uSunDir);
  lit += c * vec3(1.0,0.88,0.70) * 0.30 * smoothstep(0.0, -0.6, bd) * (1.0 - pm);
  // 订口杏色影（离书脊 1.8cm 内）
  float ds = (uSpineAtU0 > 0.5 ? uv.x : 1.0-uv.x) * uSize.x;
  float gutter = (1.0 - smoothstep(0.0, 2.3, ds)) * (1.0-uLift);
  vec3 shade = mix(vec3(1.0), uShadowTint, uShadowStr);
  lit *= mix(vec3(1.0), shade, gutter*gutter*0.85);
  lit *= 1.0 - 0.16*(1.0 - smoothstep(0.0, 0.5, ds))*(1.0-uLift);                      // 订口最深处的窄暗缝（环境光遮蔽）
  float crest = smoothstep(0.7, 1.5, ds) * (1.0 - smoothstep(1.5, 3.0, ds)) * (1.0-uLift);
  lit *= 1.0 + 0.035*crest*mix(0.6, 1.0, sm);                                           // 纸从订口拱起的一道柔亮（纸面弧度）
  // 海报：不受光照与窗格光斑，只接受投影（翻页时）
  vec3 posterC = ct.rgb * mix(shade, vec3(1.0), sm);
  c = mix(lit, posterC, pm);
  gl_FragColor = vec4(c, pm > 0.5 ? -outA() : outA());   // 负距离 = 海报像素：后期不加光束、不加雾
  #include <colorspace_fragment>
}`, Object.assign({
    uPaper: { value: col(C.paper) }, uEdgeTint: { value: col(C.edge) }, uDot: { value: col(C.dot) },
    uFront: { value: null }, uBack: { value: null }, uMaskF: { value: null }, uMaskB: { value: null },
    uHasFront: { value: 0 }, uHasBack: { value: 0 }, uSize: { value: new THREE.Vector2(S.PW, S.PH) },
    uSpineAtU0: { value: 1 }, uLift: { value: 0 },
    uSig: sigTexU, uSigOn: { value: 0 }, uSigP: sigUniform, uSigInk: { value: col(C.ink) }, uMottle: { value: TUNE.mottle },
  }, params), { side: THREE.DoubleSide });
}

const deskMat = makeMat(/* glsl */`
uniform vec3 uDesk; uniform vec4 uBookRect; uniform float uBookR; uniform vec2 uAo2;
void main(){
  vec3 base = uDesk;
  // 极淡的平涂桌面颗粒（无木纹）
  base *= 1.0 + (hash12(floor(vWP.xz/0.05))-0.5)*0.02;
  vec3 N = normalize(vWN);
  float top = step(0.9, N.y);
  // 低对比桦木拼板：沿 x 方向的长板（宽 16cm、错缝），每块色调 ±1.2%，极淡顺纹，板缝一线浅杏色
  { float pz = vWP.z/16.0; float row = floor(pz); float fz = fract(pz);
    float off = hash12(vec2(row, 3.1))*90.0; float px = (vWP.x + off)/88.0; float col_ = floor(px);
    float tone = (hash12(vec2(row, col_)) - 0.5)*0.024;
    float grain = sin(vWP.z*7.0 + sin(vWP.x*0.21 + row*4.0)*2.2 + hash12(vec2(row,col_))*20.0)*0.5+0.5;
    grain = pow(grain, 6.0)*0.018;
    float seamZ = 1.0 - smoothstep(0.0, 0.07, min(fz, 1.0-fz)*16.0);
    float seamX = 1.0 - smoothstep(0.0, 0.07, min(fract(px), 1.0-fract(px))*88.0);
    base *= 1.0 + (tone - grain)*top;
    base = mix(base, base*vec3(0.95,0.92,0.89), max(seamZ, seamX)*0.55*top); }
  float sm = getShadowMask();
  base *= mix(0.97, 1.0, top);
  vec3 c = stylizedLight(base, N, sm);
  // 桌沿：顶面外缘 0.6cm 一道奶油亮边（倒角受光的图形化表达）
  // 接触影：书本圆角矩形 SDF，紧贴 0.5cm 衰减，杏色
  float d = sdRoundBox(vWP.xz - uBookRect.xy, uBookRect.zw, uBookR);
  float ao = exp(-max(d,0.0)/0.45) * step(-0.01, d) * top;
  vec3 shade = mix(vec3(1.0), uShadowTint, uShadowStr);
  c *= mix(vec3(1.0), shade, ao*0.85);
  // 书压在桌上的大范围软影：往背光一侧（右、前）偏一点，书才像是放在桌上、有分量
  float d2 = sdRoundBox(vWP.xz - uBookRect.xy - vec2(0.5, 0.7), uBookRect.zw, uBookR);
  c *= mix(vec3(1.0), shade, exp(-max(d2,0.0)/uAo2.y) * uAo2.x * top);
  gl_FragColor = vec4(c,outA());
  #include <colorspace_fragment>
}`, { uDesk: { value: col(TUNE.desk) }, uAo2: { value: new THREE.Vector2(TUNE.ao, TUNE.aoW) }, uBookRect: { value: new THREE.Vector4(0, 0, 15, 10.6) }, uBookR: { value: 0.5 } });

const enamelMat = makeMat(/* glsl */`
uniform vec3 uBase; uniform vec3 uInk;
void main(){
  vec3 N = normalize(vWN);
  float sm = getShadowMask();
  vec3 c = stylizedLight(uBase, N, sm);
  // 风格化高光点：固定在左上方的一个柔和椭圆
  vec3 V = normalize(cameraPosition - vWP);
  vec3 H = normalize(uSunDir + V);
  // 高光珐琅：圆顶上一颗锐利的窗形高光 + 一圈宽柔光 + 掠射处的暖色反射（像上了一层透明釉）
  float nh = max(dot(N,H), 0.0);
  c = mix(c, vec3(1.0,0.995,0.97), smoothstep(0.986, 0.996, nh)*0.95);
  c += vec3(1.0,0.92,0.75) * pow(nh, 30.0) * 0.12;
  float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  c = mix(c, vec3(1.0,0.95,0.86), fr*0.35);
  c *= 1.0 + 0.05*(N.y - 0.7);
  gl_FragColor = vec4(c,outA());
  #include <colorspace_fragment>
}`, { uBase: { value: col(C.clasp) }, uInk: { value: col(C.ink) } });

const flatMat = (hex, str) => makeMat(/* glsl */`
uniform vec3 uBase;
void main(){ vec3 N = normalize(vWN); float sm = getShadowMask(); gl_FragColor = vec4(stylizedLight(uBase, N, sm),outA());
  #include <colorspace_fragment>
}`, { uBase: { value: col(hex) } }, { side: THREE.DoubleSide });

// 香槟金拉丝金属：uMode 0 = 同心圆拉丝（扣座），1 = 沿 x 直拉丝（包角）
const brassMat = (mode = 0, hex = 0xD9B77A) => makeMat(/* glsl */`
uniform vec3 uBase; uniform float uMode;
void main(){
  vec3 N = normalize(vWN); vec3 V = normalize(cameraPosition - vWP); vec3 H = normalize(uSunDir + V);
  float coord = uMode < 0.5 ? length(vLP.xz) * 260.0 : (vLP.z * 0.6 + vLP.y) * 300.0;
  float fwb = fwidth(coord); float br = fract(sin(floor(coord) * 91.7) * 43758.5);
  vec3 base = uBase * (1.0 + (br - 0.5) * 0.10 * (1.0 - smoothstep(0.5, 1.5, fwb)));
  float sm = getShadowMask();
  vec3 c = stylizedLight(base, N, sm) * 0.92;
  float nh = max(dot(N, H), 0.0);
  c += vec3(1.0, 0.93, 0.78) * (smoothstep(0.93, 0.99, nh) * 0.55 + pow(nh, 8.0) * 0.12) * mix(0.4, 1.0, sm);
  float fr = pow(1.0 - max(dot(N, V), 0.0), 2.0);
  c = mix(c, vec3(1.0, 0.94, 0.80) * 0.95, fr * 0.30);                    // 掠射时映出暖白的屋子
  c = mix(c, c * vec3(0.78, 0.62, 0.45), (1.0 - smoothstep(0.05, 0.3, dot(N, V))) * 0.5);
  gl_FragColor = vec4(c, outA());
  #include <colorspace_fragment>
}`, { uBase: { value: col(hex) }, uMode: { value: mode } });
function mergeGeos(list) { // 非索引合并（position/normal/uv）
  const gs = list.map((g) => { const n = g.index ? g.toNonIndexed() : g; if (!n.attributes.normal) n.computeVertexNormals(); if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); return n; });
  const out = new THREE.BufferGeometry();
  for (const [k, sz] of [['position', 3], ['normal', 3], ['uv', 2]]) { let L = 0; for (const g of gs) L += g.attributes[k].array.length; const a = new Float32Array(L); let o = 0; for (const g of gs) { a.set(g.attributes[k].array, o); o += g.attributes[k].array.length; } out.setAttribute(k, new THREE.BufferAttribute(a, sz)); }
  return out;
}
const ribbonMat = makeMat(/* glsl */`
uniform vec3 uBase; uniform float uLen;
void main(){
  vec3 N = normalize(vWN); if(!gl_FrontFacing) N=-N;
  float v = vUv.y; float u = vUv.x; float s = (1.0 - v) * uLen;     // s = 离丝带末端的距离（厘米）
  // 燕尾剪口：V 形，深 0.55cm
  if(s < 0.55 * (1.0 - abs(u - 0.5) * 2.0)) discard;
  float sm = getShadowMask();
  // 罗纹缎带：横向细罗纹（0.05cm）+ 两侧织边
  float rib = 0.5 + 0.5 * sin(v * uLen * 125.66); float fr = fwidth(v * uLen * 20.0);
  vec3 base = uBase * (1.0 - rib * 0.07 * (1.0 - smoothstep(0.4, 1.0, fr)));
  float edge = smoothstep(0.40, 0.47, abs(u - 0.5));
  base = mix(base, base * vec3(1.06, 1.02, 0.98), edge);
  base *= 1.0 - 0.10 * (1.0 - smoothstep(0.0, 0.03, 0.5 - abs(u - 0.5)));
  vec3 c = stylizedLight(base, N, sm);
  // 缎面：沿带子方向的一道柔亮带（随视角滑动）
  vec3 V = normalize(cameraPosition - vWP);
  float sheen = pow(max(dot(reflect(-uSunDir,N),V),0.0), 5.0);
  c += vec3(1.0,0.9,0.75) * (0.10 + 0.06 * rib) * sheen * mix(0.4, 1.0, sm);
  gl_FragColor = vec4(c,outA());
  #include <colorspace_fragment>
}`, { uBase: { value: col(C.ribbon) }, uLen: { value: 20 } }, { side: THREE.DoubleSide });

// ---------------- 几何 ----------------
function roundedRectShape(w, h, rTL, rTR, rBR, rBL) { // 从 (0,-h/2) 到 (w,h/2)
  const s = new THREE.Shape();
  const x0 = 0, y0 = -h / 2, x1 = w, y1 = h / 2;
  s.moveTo(x0 + rBL, y0);
  s.lineTo(x1 - rBR, y0); s.quadraticCurveTo(x1, y0, x1, y0 + rBR);
  s.lineTo(x1, y1 - rTR); s.quadraticCurveTo(x1, y1, x1 - rTR, y1);
  s.lineTo(x0 + rTL, y1); s.quadraticCurveTo(x0, y1, x0, y1 - rTL);
  s.lineTo(x0, y0 + rBL); s.quadraticCurveTo(x0, y0, x0 + rBL, y0);
  return s;
}
// 封面纸板：书脊条 + 法式压槽（真几何，外表面向内压 0.09，宽 0.4）+ 主板；局部 y=0 为外表面
const GROOVE = { x0: 0.78, x1: 1.22, d: 0.11 };
function boardGeo() {
  const ext = (sh) => { const g = new THREE.ExtrudeGeometry(sh, { depth: S.B - 2 * S.bevel, bevelEnabled: true, bevelThickness: S.bevel, bevelSize: S.bevel, bevelSegments: 6, curveSegments: 28 });
    g.rotateX(Math.PI / 2); g.translate(0, S.B - S.bevel, 0); g.computeVertexNormals(); return g; };
  const a = ext(roundedRectShape(GROOVE.x0 - S.bevel, S.CH, S.spineR, 0.001, 0.001, S.spineR));
  const c = ext(roundedRectShape(S.CW - GROOVE.x1 - S.bevel, S.CH, 0.001, S.coverR, S.coverR, 0.001)); c.translate(GROOVE.x1 + S.bevel, 0, 0);
  // 压槽：外表面 y(x) = d·sin(π·t)（圆底槽），内表面平；两端封口
  const n = 24, z0 = -S.CH / 2 - S.bevel, z1 = S.CH / 2 + S.bevel, w = GROOVE.x1 - GROOVE.x0; const pos = [], nor = [], uv = [];
  const yo = (t) => GROOVE.d * Math.sin(Math.PI * t), dy = (t) => GROOVE.d * Math.PI * Math.cos(Math.PI * t) / w;
  const quad = (A, B, C, D, NA, NB, NC, ND) => { for (const [p, q] of [[A, NA], [C, NC], [B, NB], [A, NA], [D, ND], [C, NC]]) { pos.push(...p); nor.push(...q); uv.push(0, 0); } };
  for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, xa = GROOVE.x0 + t0 * w, xb = GROOVE.x0 + t1 * w;
    const na = new THREE.Vector3(dy(t0), -1, 0).normalize().toArray(), nb = new THREE.Vector3(dy(t1), -1, 0).normalize().toArray();
    quad([xa, yo(t0), z0], [xa, yo(t0), z1], [xb, yo(t1), z1], [xb, yo(t1), z0], na, na, nb, nb);                 // 外表面（朝 -y）
    quad([xa, S.B, z1], [xa, S.B, z0], [xb, S.B, z0], [xb, S.B, z1], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0]); // 内表面
    for (const [z, nz] of [[z0, -1], [z1, 1]]) quad([xa, yo(t0), z], [xb, yo(t1), z], [xb, S.B, z], [xa, S.B, z], [0, 0, nz], [0, 0, nz], [0, 0, nz], [0, 0, nz]); }
  const b = new THREE.BufferGeometry(); b.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); b.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); b.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return mergeGeos([a, b, c]);
}
// 书芯顶面轮廓：订口下沉 + 书口微塌（x 为距书脊距离）
function prof(x) {
  const a = Math.min(Math.abs(x) / S.dipW, 1); const dip = -S.dip * Math.pow(1 - a, 2.2);
  const b = Math.min(Math.max((S.PW - Math.abs(x)) / S.rollW, 0), 1); const roll = -S.roll * Math.pow(1 - b, 2);
  return dip + roll;
}
function pageSurfaceGeo() { // x 0..PW（距书脊），z -PH/2..PH/2
  const g = new THREE.PlaneGeometry(S.PW, S.PH, 96, 1);
  g.rotateX(-Math.PI / 2); g.translate(S.PW / 2, 0, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, prof(p.getX(i)));
  g.computeVertexNormals(); return g;
}
function blockGeo(top, bulge = 0) { // 天头、地脚两个剖面 + 书口面（细分、按纸层错落）
  const bf = (x) => bulge * Math.pow(Math.min(Math.max(x / S.PW, 0), 1), 1.6);
  const sh = new THREE.Shape();
  sh.moveTo(0, S.B); const N = 72;
  for (let i = 0; i <= N; i++) { const x = (i / N) * S.PW; sh.lineTo(x, top + prof(x) + bf(x) - 0.06); }
  sh.lineTo(S.PW, S.B); sh.lineTo(0, S.B);
  const head = new THREE.ShapeGeometry(sh); head.translate(0, 0, -S.PH / 2);
  const tail = new THREE.ShapeGeometry(sh); tail.translate(0, 0, S.PH / 2);
  const fh = top + prof(S.PW) + bf(S.PW) - S.B - 0.06;
  const rows = Math.max(8, Math.round(fh / 0.03)), cols = 72;
  const fore = new THREE.PlaneGeometry(S.PH, fh, cols, rows); fore.rotateY(Math.PI / 2); fore.translate(S.PW, S.B + fh / 2, 0);
  const p = fore.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) - S.B, z = p.getZ(i);
    const band = Math.floor(y / 0.06); let off = 0.045 * hashf(band) * (0.6 + 0.4 * Math.sin(z * 0.7 + band));
    for (const [iy, it, , pr, zc, zh, sl] of INSERTS) { const dz = Math.abs(z - zc); if (Math.abs(y - iy - sl * (z - zc)) < it && dz < zh) off = Math.max(off, pr * (0.8 + 0.2 * Math.sin(z * 0.5 + iy * 9.0)) * Math.min(1, (zh - dz) / 0.25)); }
    off *= Math.min(1, (S.PH / 2 - Math.abs(z)) / 0.35);
    if (bulge > 0) off += S.bow * (bulge / S.bulge) * (1 - Math.pow(2 * z / S.PH, 2)) * Math.min(1, 0.35 + y / fh); /* 塞满后书口向外鼓成弧 */ off -= 0.05 * Math.min(1, Math.max(0, 1 - Math.abs(y - fh) / 0.12)) * 0; p.setX(i, S.PW + off); }
  fore.computeVertexNormals();
  return [head, tail, fore];
}
const bulgeFn = (on) => (x) => (+on) * S.bulge * Math.pow(Math.min(Math.max(x / S.PW, 0), 1), 1.6);

// ---------------- 页面内容：每页一个渲染目标 ----------------
// R82：页面底图 4096 高（桌面 / SwiftShader：2926×4096 ≈ 198 px/cm），文字放大看也锐利；贴片另用 260–320 px/cm 的独立图集
const PAGE_RT_H = Math.min(4096, renderer.capabilities.maxTextureSize), PAGE_RT_W = Math.round(PAGE_RT_H * S.PW / S.PH);
const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();
const MASK_W = 512, MASK_H = Math.round(512 * S.PH / S.PW);
const rtScene = new THREE.Scene();
const rtCam = new THREE.OrthographicCamera(0, S.PW, S.PH, 0, -10, 10); // 页面厘米坐标，y 向上
function makePageRT() {
  const rt = new THREE.WebGLRenderTarget(PAGE_RT_W, PAGE_RT_H, { colorSpace: THREE.SRGBColorSpace, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, samples: 0 }); // 底图是 1:1 整页拷贝，不需要多重采样（省 4× 显存）
  rt.texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const mask = new THREE.WebGLRenderTarget(MASK_W, MASK_H, { generateMipmaps: false });
  return { rt, mask };
}
const texLoader = new THREE.TextureLoader();
function loadTex(url) { return new Promise((res) => texLoader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MAX_ANISO; res(t); })); }

// Canvas2D 层：文字、贴纸、相角、胶带（手写=文楷，印刷=全圆，西文=Nunito）
function canvasLayer(draw) {
  const cv = document.createElement('canvas'); cv.width = PAGE_RT_W; cv.height = PAGE_RT_H;
  const g = cv.getContext('2d'); const k = PAGE_RT_W / S.PW; // 像素/厘米
  g.scale(k, k); draw(g, k);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
const hex = (h) => '#' + h.toString(16).padStart(6, '0');
function roundRectPath(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

function renderPage(target, layers) { // layers: [{tex, rect:[x,y,w,h] (cm, y 自上而下), rot, poster}]
  const objs = [];
  for (const L of layers) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(L.rect[2], L.rect[3]), new THREE.MeshBasicMaterial({ map: L.tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
    m.renderOrder = L.z || 0;
    m.position.set(L.rect[0] + L.rect[2] / 2, S.PH - (L.rect[1] + L.rect[3] / 2), L.z || 0);
    m.rotation.z = -(L.rot || 0) * Math.PI / 180;
    m.userData.poster = !!L.poster; rtScene.add(m); objs.push(m);
  }
  renderer.setRenderTarget(target.rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(rtScene, rtCam);
  // 海报遮罩
  // 海报 = 白；海报之上的层（相角、贴纸等）用自身 alpha 盖成黑，避免压在海报上的部分被当成“不受光”
  const pz = Math.max(-1, ...layers.filter((L) => L.poster).map((L) => L.z || 0));
  for (const o of objs) {
    const above = !o.userData.poster && o.renderOrder > pz;
    o.visible = o.userData.poster || above;
    if (o.userData.poster) { const map = o.material.map; o.material = new THREE.ShaderMaterial({ uniforms: { uMap: { value: map } }, transparent: true, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform sampler2D uMap; varying vec2 vUv; void main(){ gl_FragColor = vec4(1.0, 1.0, 1.0, texture2D(uMap, vUv).a); }' }); } // 遮罩 = 海报/原图自身的 alpha（模切贴纸只有人物区域）
    else if (above) o.material = new THREE.MeshBasicMaterial({ color: 0x000000, map: o.material.map, transparent: true, depthTest: false, depthWrite: false });
  }
  renderer.setRenderTarget(target.mask); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(rtScene, rtCam);
  renderer.setRenderTarget(null); renderer.setClearColor(col(C.desk), 1);
  for (const o of objs) { rtScene.remove(o); o.geometry.dispose(); }
}

// ---------------- 组装书本 ----------------
const book = new THREE.Group(); scene.add(book);
const DESK = { x0: -104, x1: 104, z0: WIN.wallZ, z1: 34, t: 4.5, r: 3.0, bev: 1.5 };
const deskGeo = (() => { const w = DESK.x1 - DESK.x0, h = DESK.z1 - DESK.z0; const sh = roundedRectShape(w, h, DESK.r, DESK.r, DESK.r, DESK.r);
  const g = new THREE.ExtrudeGeometry(sh, { depth: DESK.t - 2 * DESK.bev, bevelEnabled: true, bevelThickness: DESK.bev, bevelSize: DESK.bev, bevelSegments: 10, curveSegments: 32 });
  g.rotateX(Math.PI / 2); g.translate(DESK.x0, -DESK.bev, (DESK.z0 + DESK.z1) / 2); g.computeVertexNormals(); return g; })();
const desk = new THREE.Mesh(deskGeo, deskMat); desk.receiveShadow = true; scene.add(desk);

const bGeo = boardGeo();
// 封底（右侧，内表面朝上）
const backCover = new THREE.Mesh(bGeo, coverMat.clone()); backCover.material.uniforms.uIsFront.value = 0;
Object.assign(backCover.material.uniforms, shared, uCover); backCover.material.uniforms.uIsFront = { value: 0 };
backCover.castShadow = backCover.receiveShadow = true; book.add(backCover);
// 封面（铰链在书脊中线高度 yH）
const frontPivot = new THREE.Group(); book.add(frontPivot);
const frontCover = new THREE.Mesh(bGeo, coverMat.clone());
Object.assign(frontCover.material.uniforms, shared, uCover); frontCover.material.uniforms.uIsFront = { value: 1 };
frontCover.castShadow = frontCover.receiveShadow = true; frontPivot.add(frontCover);

// 书芯
const rightBlock = new THREE.Group(), leftBlock = new THREE.Group(); book.add(rightBlock);
// 左叠挂在一个绕书脊转的轴上：开场时它跟着封面一起整叠翻开（书从中间打开），平时角度为 0
const leftPivot = new THREE.Group(); book.add(leftPivot); leftPivot.add(leftBlock);
const rightPageMat = pageMat({}), leftPageMat = pageMat({});
rightPageMat.uniforms.uSpineAtU0.value = 1; leftPageMat.uniforms.uSpineAtU0.value = 0;
const rightPage = new THREE.Mesh(pageSurfaceGeo(), rightPageMat); rightPage.receiveShadow = true; rightPage.castShadow = true;
const leftGeo = pageSurfaceGeo(); leftGeo.scale(-1, 1, 1); leftGeo.computeVertexNormals();
// 左页 uv：u=0 在左边缘，u=1 在书脊 → 镜像后需翻转 u
{ const uv = leftGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); }
// 镜像翻转了三角形绕序，修正
leftGeo.index && (() => { const ix = leftGeo.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 2]; ix[i + 2] = t; } })();
leftGeo.computeVertexNormals();
const leftPage = new THREE.Mesh(leftGeo, leftPageMat); leftPage.receiveShadow = true;
let rBlockMeshes = [], lBlockMeshes = [];
let DR = null;
const bKey = { v: '' };
function rebuildBlocks(tR, tL, closed = false) {
  if (DR) DR.place(tR, tL, bulgeFn(closed), closed);
  const key = tR.toFixed(4) + '|' + tL.toFixed(4) + '|' + (+closed).toFixed(3); if (key === bKey.v) return; bKey.v = key;
  for (const m of rBlockMeshes) { rightBlock.remove(m); m.geometry.dispose(); } for (const m of lBlockMeshes) { leftBlock.remove(m); m.geometry.dispose(); }
  rBlockMeshes = blockGeo(S.B + tR, (+closed) * S.bulge).map((g) => { const m = new THREE.Mesh(g, blockMat); m.castShadow = m.receiveShadow = true; rightBlock.add(m); return m; });
  lBlockMeshes = blockGeo(S.B + tL).map((g) => { g.scale(-1, 1, 1); const m = new THREE.Mesh(g, blockMat); m.receiveShadow = true; leftBlock.add(m); return m; });
  rightPage.position.y = S.B + tR; leftPage.position.y = S.B + tL;
  rightBlock.add(rightPage); leftBlock.add(leftPage);
  leftBlock.visible = tL > 0.02;
}

// 翻页网格：CPU 逐帧积分（列方向弧长守恒），64×16
const turnGeo = new THREE.PlaneGeometry(S.PW, S.PH, S.turnCols, S.turnRows);
turnGeo.rotateX(-Math.PI / 2); turnGeo.translate(S.PW / 2, 0, 0);
const turnMat = pageMat({}); turnMat.uniforms.uSpineAtU0.value = 1; turnMat.polygonOffset = true; turnMat.polygonOffsetFactor = -2; turnMat.polygonOffsetUnits = -2;
const turnPage = new THREE.Mesh(turnGeo, turnMat); turnPage.castShadow = turnPage.receiveShadow = true; book.add(turnPage);
const flutter = []; // 开场翻飞页（空白纸）
for (let i = 0; i < 9; i++) { const g = turnGeo.clone(); const m = new THREE.Mesh(g, pageMat({})); m.material.uniforms.uSpineAtU0.value = 1; m.castShadow = true; m.receiveShadow = true; m.visible = false; book.add(m); flutter.push(m); }

let lastStretch = 0; let turnVer = 0;
function curlPage(mesh, p, yR, yL, opts = {}) {
  const lead = opts.lead ?? S.lead, cone = opts.cone ?? S.cone, corner = opts.corner ?? 1; // corner=1 从右下角拖
  const pos = mesh.geometry.attributes.position; const cols = S.turnCols + 1, rows = S.turnRows + 1; const du = S.PW / S.turnCols;
  const sp = p * p * (3 - 2 * p);
  const pivotY = yR + (yL - yR) * sp;
  // 短卷：半径 3.2 厘米，最高只拱起一个直径（6.4）。纸贴着桌面翻过去，不会竖起来冲向镜头。
  const R = 3.2, travel = S.PW + Math.PI * R, pp = Math.min(Math.max(p, 0), 1);
  let maxStretch = 0; const prevRow = [];
  for (let j = 0; j < rows; j++) {
    const v = j / (rows - 1); // 0 = 天头(-z)，1 = 地脚(+z)
    const vz = corner > 0 ? v : 1 - v;
    const s0 = S.PW - pp * travel - (vz - 0.5) * lead * S.PW * cone * Math.sin(Math.PI * pp);
    let x = 0, y = 0; const row = [];
    for (let i = 0; i < cols; i++) {
      if (i > 0) { const th = Math.min(Math.PI, Math.max(0, ((i - 0.5) * du - s0) / R)); x += Math.cos(th) * du; y += Math.sin(th) * du; }
      const th = Math.min(Math.PI, Math.max(0, (i * du - s0) / R));
      const flat = Math.pow(Math.abs(Math.cos(th)), 6);
      // 纸是单独的一张：可以卷起，但不能低于它正下方那叠纸的表面。0.06 厘米是这一页自己的厚度。
      const ax = Math.min(Math.abs(x), S.PW);
      const under = (x >= 0 ? yR : yL) + prof(ax);
      const wy = Math.max(pivotY + y + prof(x) * flat + (opts.lift || 0), under + 0.06);
      const idx = j * cols + i; pos.setXYZ(idx, x, wy, -S.PH / 2 + v * S.PH); row.push([x, wy]);
    }
    if (j > 0) for (let i = 0; i < cols; i++) { const dx = row[i][0] - prevRow[i][0], dy = row[i][1] - prevRow[i][1]; const dz = S.PH / (rows - 1); const len = Math.sqrt(dx * dx + dy * dy + dz * dz); maxStretch = Math.max(maxStretch, Math.abs(len / dz - 1)); }
    prevRow.splice(0, prevRow.length, ...row);
  }
  pos.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere();
  if (mesh === turnPage) turnVer++;
  lastStretch = maxStretch; return maxStretch;
}

// 书脊（合上时可见）：压扁的半圆筒（布面 + 两道起脊 + 香槟金小太阳烫印）+ 堵头布（整齐的布卷，嵌在书芯与书脊之间）
const spineGroup = new THREE.Group(); book.add(spineGroup);
const spineMat = makeMat(/* glsl */`
uniform vec3 uBase;
float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec3 N = normalize(vWN); vec3 V = normalize(cameraPosition - vWP);
  vec2 p = vec2(vUv.x * 2.6, vUv.y * ${(S.CH).toFixed(2)});                // 厘米：横向弧长 × 纵向
  vec3 base = uBase;
  vec2 k = p / 0.07; vec2 fw = fwidth(k); float a = 1.0 - smoothstep(0.3, 0.7, max(fw.x, fw.y));
  vec2 sq = abs(fract(k) - 0.5) * 2.0; float cell = mod(floor(k.x) + floor(k.y), 2.0);
  base *= 1.0 + (mix(sq.y, sq.x, cell) - 0.5) * 0.06 * a;                    // 平纹布
  base *= 1.0 + (hs(floor(p * vec2(3.0, 0.8))) - 0.5) * 0.025;
  // 两道起脊：离两端 2.2cm，宽 0.32cm；上沿迎光、下沿背光
  float lit = 0.0;
  for(int i = 0; i < 2; i++){ float zc = i == 0 ? 2.2 : ${(S.CH - 2.2).toFixed(2)}; float d = (p.y - zc) / 0.16;
    float fwd = fwidth(d); float band = 1.0 - smoothstep(1.0 - fwd, 1.0 + fwd, abs(d));
    lit += band * (-d) * 0.5; base *= 1.0 - (1.0 - smoothstep(0.0, 0.15, abs(abs(d) - 1.0))) * 0.10; }
  float sm = getShadowMask();
  vec3 c = stylizedLight(base, N, sm) * (1.0 + lit * 0.14);
  // 书脊中央：香槟金小太阳烫印（圆 + 8 道光芒）
  vec2 q = p - vec2(1.3, ${(S.CH / 2).toFixed(2)}); float r = length(q); float ang = atan(q.y, q.x);
  float ray = step(0.5, fract(ang / 6.2831853 * 8.0 + 0.25)) * step(0.22, r) * (1.0 - step(0.36, r));
  float disc = 1.0 - smoothstep(0.15, 0.165, r);
  float gold = max(disc, ray * (1.0 - smoothstep(0.0, 0.02, abs(fract(ang / 6.2831853 * 8.0) - 0.5) - 0.18)));
  if(gold > 0.01){ vec3 H = normalize(uSunDir + V); float spec = pow(max(dot(reflect(-uSunDir, N), V), 0.0), 6.0);
    vec3 gc = mix(vec3(0.62, 0.42, 0.16), vec3(1.0, 0.86, 0.56), clamp(0.35 + spec * 0.8 + 0.2 * N.y, 0.0, 1.0)) * mix(0.75, 1.0, sm);
    c = mix(c, gc, gold * 0.95); }
  c *= mix(1.0, 0.9, 1.0 - smoothstep(0.1, 0.4, abs(dot(N, V))));
  gl_FragColor = vec4(c, outA());
  #include <colorspace_fragment>
}`, { uBase: { value: col(C.spine) } });
const headbandMat = makeMat(/* glsl */`
uniform vec3 uA; uniform vec3 uB;
void main(){ vec3 N = normalize(vWN);
  float k = vUv.x * 30.0 + vUv.y * 1.0; float fw = fwidth(k); float f = fract(k);
  float s = smoothstep(0.5 - fw, 0.5 + fw, f) - smoothstep(1.0 - fw, 1.0, f);   // 奶油 / 柔橙交替的丝线
  float bump = sin(f * 6.2831853 * 2.0) * 0.5 + 0.5;
  vec3 base = mix(uA, uB, s) * mix(0.9, 1.04, bump);
  vec3 c = stylizedLight(base, N, getShadowMask());
  vec3 V = normalize(cameraPosition - vWP); c += vec3(1.0, 0.95, 0.85) * 0.08 * pow(max(dot(reflect(-uSunDir, N), V), 0.0), 4.0) * bump;
  gl_FragColor = vec4(c, outA());
  #include <colorspace_fragment>
}`, { uA: { value: col(C.spine) }, uB: { value: col(C.ribbon) } });
{
  const r = (S.T + 2 * S.B) / 2;
  const g = new THREE.CylinderGeometry(r, r, S.CH - 0.02, 96, 1, true, Math.PI, Math.PI); // 左半圆
  g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, spineMat); m.scale.set(0.5, 1, 1); m.position.set(0.02, r, 0); m.castShadow = m.receiveShadow = true; spineGroup.add(m);
  // 堵头布：沿书脊内弧的一条圆布卷（直径 0.17），两端收进书芯
  for (const z of [-S.PH / 2 - 0.03, S.PH / 2 + 0.03]) {
    const pts = []; for (let i = 0; i <= 40; i++) { const a = -Math.PI / 2 + (i / 40) * Math.PI; pts.push(new THREE.Vector3(0.10 - Math.cos(a) * (S.T / 2) * 0.36, S.B + S.T / 2 + Math.sin(a) * (S.T / 2 - 0.03), z)); }
    const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 72, 0.085, 16, false);
    const tm = new THREE.Mesh(tg, headbandMat); tm.castShadow = false; tm.receiveShadow = true; spineGroup.add(tm);
  }
}

// 搭扣：竖带（贴书口）+ 圆弧折弯（真厚度）+ 翻盖（可弹开）+ 香槟金拉丝扣座 + 高光珐琅圆扣；奶油布带两侧细密明线
const STRAP_RO = 0.22;   // 折弯外半径
const strapMat = makeMat(/* glsl */`
uniform vec3 uBase; uniform float uKind; uniform float uRo;
void main(){
  vec3 N = normalize(vWN); if(!gl_FrontFacing) N = -N; vec3 V = normalize(cameraPosition - vWP);
  vec3 base = uBase;
  float g = fract(sin(dot(floor(vWP.xz * 40.0 + vWP.y * 13.0), vec2(12.9898, 78.233))) * 43758.5453);
  base *= 1.0 + (g - 0.5) * 0.025;
  // 明线：离带边 0.16cm，一针 0.16cm（针脚 + 针孔微影）
  float dEdge; float along; float face;
  if(uKind < 0.5){ dEdge = ${(S.strapW / 2).toFixed(3)} - abs(vLP.z); along = vWP.x + vWP.y; face = 1.0 - step(0.5, abs(vLN.z)); }
  else { float cx = -(${S.flapL.toFixed(3)} - ${(S.strapW / 2).toFixed(3)}) - uRo; vec2 q = vLP.xz;
    float dS = q.x > cx ? ${(S.strapW / 2).toFixed(3)} - abs(q.y) : ${(S.strapW / 2).toFixed(3)} - length(q - vec2(cx, 0.0));
    dEdge = dS; along = q.x > cx ? q.x : atan(q.y, q.x - cx) * ${(S.strapW / 2 - 0.16).toFixed(3)}; face = step(0.5, abs(vLN.y)); }
  float k = along / 0.16; float fwk = fwidth(k); float dash = smoothstep(0.08, 0.08 + fwk, fract(k)) * (1.0 - smoothstep(0.66, 0.66 + fwk, fract(k)));
  float fwd = fwidth(dEdge); float line = 1.0 - smoothstep(0.018 - fwd, 0.018 + fwd, abs(dEdge - 0.16));
  base *= 1.0 - face * (1.0 - smoothstep(0.0, 0.05, abs(dEdge - 0.16))) * 0.06;          // 明线压出的浅沟
  base = mix(base, vec3(0.80, 0.52, 0.36), face * line * dash * 0.9);                       // 杏可可色线
  base *= 1.0 - face * line * (1.0 - dash) * 0.12;
  base *= 1.0 - (1.0 - face) * 0.06;                                                        // 侧边（厚度）略深
  float sm = getShadowMask();
  vec3 c = stylizedLight(base, N, sm);
  c *= mix(1.0, 0.88, 1.0 - smoothstep(0.1, 0.4, abs(dot(N, V))));
  gl_FragColor = vec4(c, outA());
  #include <colorspace_fragment>
}`, { uBase: { value: col(C.spine) }, uKind: { value: 0 }, uRo: { value: STRAP_RO } }, { side: THREE.DoubleSide });
const flapMat = strapMat.clone(); flapMat.uniforms.uKind = { value: 1 }; flapMat.uniforms.uRo = { value: STRAP_RO }; flapMat.uniforms.uBase = { value: col(C.spine) };
Object.assign(flapMat.uniforms, shared);
const strap = new THREE.Group(); book.add(strap);
const strapV = new THREE.Mesh(new THREE.BoxGeometry(S.strapT, 1, S.strapW), strapMat); strapV.castShadow = true; strap.add(strapV);
const flapPivot = new THREE.Group(); strap.add(flapPivot);
// 折弯：四分之一圆环截面（外半径 0.22，厚 = 带厚），沿带宽挤出
const bendGeo = (() => { const Ro = STRAP_RO, Ri = Ro - S.strapT, sh = new THREE.Shape(); sh.moveTo(Ro, 0); sh.absarc(0, 0, Ro, 0, Math.PI / 2, false); sh.lineTo(0, Ri); sh.absarc(0, 0, Ri, Math.PI / 2, 0, true); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: S.strapW, bevelEnabled: false, curveSegments: 32 }); g.translate(0, 0, -S.strapW / 2); return g; })();
const fold = new THREE.Mesh(bendGeo, strapMat); fold.castShadow = true; strap.add(fold);
const flapShape = (() => { const sh = new THREE.Shape(); const L = S.flapL, W = S.strapW, r = W / 2; sh.moveTo(0, -W / 2); sh.lineTo(L - r, -W / 2); sh.absarc(L - r, 0, r, -Math.PI / 2, Math.PI / 2, false); sh.lineTo(0, W / 2); sh.lineTo(0, -W / 2); return sh; })();
const flapGeo = new THREE.ExtrudeGeometry(flapShape, { depth: S.strapT, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 4, curveSegments: 56 });
flapGeo.rotateX(Math.PI / 2); flapGeo.translate(0, S.strapT + 0.02, 0); flapGeo.rotateY(Math.PI); flapGeo.translate(-STRAP_RO, 0, 0); flapGeo.computeVertexNormals();
const flap = new THREE.Mesh(flapGeo, flapMat); flap.castShadow = flap.receiveShadow = true; flapPivot.add(flap);
const btn = new THREE.Group(); flapPivot.add(btn);
{
  const R = S.btnR, H = 0.30;
  // 珐琅圆顶：边缘直立一小段再圆滑隆起
  const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(R - 0.06, 0), new THREE.Vector2(R - 0.06, 0.06)];
  for (let i = 1; i <= 24; i++) { const t = i / 24; pts.push(new THREE.Vector2((R - 0.06) * Math.cos(t * Math.PI / 2), 0.06 + (H - 0.06) * Math.sin(t * Math.PI / 2))); }
  const g = new THREE.LatheGeometry(pts, 96); g.computeVertexNormals();
  // 扣座：香槟金拉丝金属圈（外沿圆滚、内沿压住珐琅边）
  const bz = []; const Rb = R + 0.1;
  bz.push(new THREE.Vector2(R - 0.1, 0.0)); bz.push(new THREE.Vector2(Rb, 0.0));
  for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI; bz.push(new THREE.Vector2(Rb - 0.07 + Math.cos(a) * 0.07, 0.07 + Math.sin(a) * 0.07)); }
  bz.push(new THREE.Vector2(R - 0.12, 0.16)); bz.push(new THREE.Vector2(R - 0.13, 0.11));
  const bg = new THREE.LatheGeometry(bz, 96); bg.computeVertexNormals();
  const bezel = new THREE.Mesh(bg, brassMat(0)); bezel.castShadow = true; btn.add(bezel);
  const b = new THREE.Mesh(g, enamelMat); b.position.y = 0.03; b.castShadow = true; btn.add(b);
}
btn.position.set(-(S.flapL - S.strapW / 2) - STRAP_RO, S.strapT + 0.03, 0);

// 丝带：60 段条带（静态路径 + 待机轻摆；生产版改为 Verlet）
const RIB_N = 180;
const ribbonGeo = new THREE.PlaneGeometry(S.ribbonW, 1, 1, RIB_N);
const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat); ribbon.castShadow = true; ribbon.receiveShadow = true; book.add(ribbon);
let ribKey = '';
function layRibbon(ctrl, key = '') { // ctrl: 控制点 → 向心 Catmull-Rom 平滑，带面朝上；key 相同 = 姿态没变，跳过
  if (key && key === ribKey) return; ribKey = key;
  const pts = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal').getSpacedPoints(240);
  const pos = ribbonGeo.attributes.position; const uv = ribbonGeo.attributes.uv;
  // 按弧长重采样
  const seg = []; let L = 0; for (let i = 1; i < pts.length; i++) { const d = pts[i].distanceTo(pts[i - 1]); seg.push(d); L += d; }
  const sample = (s) => { let acc = 0; for (let i = 0; i < seg.length; i++) { if (acc + seg[i] >= s) { const t = (s - acc) / seg[i]; return pts[i].clone().lerp(pts[i + 1], t); } acc += seg[i]; } return pts[pts.length - 1].clone(); };
  for (let j = 0; j <= RIB_N; j++) {
    const s = (j / RIB_N) * L; const c = sample(s); const c2 = sample(Math.min(s + 0.05, L)); const c1 = sample(Math.max(s - 0.05, 0));
    const t = c2.clone().sub(c1).normalize(); let side = new THREE.Vector3(0, 1, 0).cross(t); if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize().multiplyScalar(S.ribbonW / 2);
    // PlaneGeometry 顶点顺序：每行 2 个（左右），行从上到下
    c.y = Math.max(c.y, 0.0);
    const row = j; pos.setXYZ(row * 2, c.x - side.x, c.y + 0.03, c.z - side.z); pos.setXYZ(row * 2 + 1, c.x + side.x, c.y + 0.03, c.z + side.z);
    uv.setXY(row * 2, 0, j / RIB_N); uv.setXY(row * 2 + 1, 1, j / RIB_N);
  }
  pos.needsUpdate = true; uv.needsUpdate = true; ribbonGeo.computeVertexNormals(); ribbonGeo.computeBoundingSphere();
  ribbonMat.uniforms.uLen.value = L;
}

// 光点（开场光从纸缝溢出）
const MOTES = 28;
const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(MOTES * 3), 3)); moteGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(Float32Array.from({ length: MOTES }, () => Math.random()), 1));
const moteMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uO: { value: 0 }, uPx: { value: DPR } },
  vertexShader: `attribute float aSeed; uniform float uPx; varying float vS; void main(){ vS=aSeed; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = (6.0+aSeed*8.0)*uPx*(60.0/-mv.z); }`,
  fragmentShader: `uniform float uO; varying float vS; void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.15,d); gl_FragColor = vec4(1.0,0.93,0.74, a*uO*(0.5+vS*0.5));
#include <colorspace_fragment>
}` });
const motes = new THREE.Points(moteGeo, moteMat); motes.frustumCulled = false; book.add(motes);
// 阳光里的浮尘：沿窗口射入的光柱分布（只在首屏全景与开场里可见；混合时保留 alpha 里的景深距离）
const DUST = 260;
const dustGeo = (() => { const g = new THREE.BufferGeometry(); const p = new Float32Array(DUST * 3), sd = new Float32Array(DUST); let i = 0, s = 7;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  while (i < DUST) { const gx = WIN.cx - WIN.hw + r() * WIN.hw * 2, gy = WIN.cy - WIN.hh + r() * WIN.hh * 2, t = 8 + r() * 90;
    const x = gx - SUN_DIR.x * t, y = gy - SUN_DIR.y * t, z = WIN.glassZ - SUN_DIR.z * t;
    if (y < 12.0 || y > 70 || z > 18 || z < WIN.wallZ + 2) continue; p.set([x, y, z], i * 3); sd[i] = r(); i++; }
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('aSeed', new THREE.Float32BufferAttribute(sd, 1)); return g; })();
const dustMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  uniforms: { uO: { value: 0 }, uPx: { value: DPR }, uTime: shared.uTime },
  vertexShader: `attribute float aSeed; uniform float uPx, uTime; varying float vS; void main(){ vS=aSeed; vec3 p = position + vec3(sin(uTime*0.3+aSeed*40.0), sin(uTime*0.22+aSeed*17.0)*1.4, cos(uTime*0.27+aSeed*23.0))*0.8;
    vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = clamp((0.7+aSeed*0.9)*uPx*(1200.0/-mv.z), 4.0, 18.0); }`,
  fragmentShader: `uniform float uO; varying float vS; void main(){ float d = length(gl_PointCoord-0.5); float a = pow(smoothstep(0.5, 0.0, d), 1.8); gl_FragColor = vec4(1.0,0.95,0.82, a*uO*(0.08+vS*0.13));
#include <colorspace_fragment>
}` });
const dust = new THREE.Points(dustGeo, dustMat); dust.frustumCulled = false; dust.renderOrder = 8; scene.add(dust);
const glowMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uO: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform float uO; varying vec2 vUv; void main(){ vec2 q=vUv-0.5; float a = exp(-dot(q*vec2(2.2,1.0),q*vec2(2.2,1.0))*9.0); gl_FragColor = vec4(1.0,0.92,0.72,a*uO);
#include <colorspace_fragment>
}` });
const glow = new THREE.Mesh(new THREE.PlaneGeometry(S.PW * 1.3, S.PH * 1.1), glowMat); glow.rotation.x = -Math.PI / 2; book.add(glow);

// ---------------- 状态与姿态 ----------------
const F0 = S.T * 0.5;                  // 开场翻飞把书翻到正中：左右两叠等高（每个跨页都是左右对称的样子，订口没有台阶）
const yH = (2 * S.B + S.T) / 2;
frontPivot.position.set(0, yH, 0); frontCover.position.set(0, -yH, 0); leftPivot.position.set(0, yH, 0); leftBlock.position.set(0, -yH, 0);
const THC = Math.atan2(S.bulge, S.PW); // 鼓起的书芯把封面书口一侧顶高
function setCoverAngle(theta) { // 0 = 合上（盖在右侧书芯上，内面朝下），π = 平摊在左侧
  frontPivot.rotation.z = Math.max(theta, THC * (1 - Math.min(theta / 0.3, 1)) + theta * Math.min(theta / 0.3, 1));
  leftPivot.rotation.z = frontPivot.rotation.z - Math.PI;
}
// 合上时封面网格需位于 y = B+T..2B+T，内面朝下：几何内面在 y=0 处 → 合上姿态需绕 x 翻转
frontCover.rotation.x = Math.PI; frontCover.position.set(0, (S.B + S.T + S.B) - yH, 0);
// 注：rotation.x=π 使 z 也翻转，封面左右对称无影响

function strapClosed() {
  strap.visible = true; const top = 2 * S.B + S.T + S.bulge + 0.02;
  const cy = top + 0.02 + S.strapT - STRAP_RO, cx = S.CW + S.strapT - STRAP_RO;
  strapV.rotation.set(0, 0, 0); strapV.scale.y = cy; strapV.position.set(S.CW + S.strapT / 2, cy / 2, 0);
  flapPivot.position.set(S.CW + S.strapT, top, 0); flapPivot.rotation.set(0, 0, THC);
  fold.visible = true; fold.position.set(cx, cy, 0); fold.rotation.set(0, 0, 0);
}
function strapPop(a) { strapClosed(); flapPivot.rotation.z = THC - a; }
function strapOpen() { // 竖带绕底边向外倒下，整条平躺在桌面右侧，珐琅扣朝上
  strap.visible = true; const H = 2 * S.B + S.T;
  strapV.scale.y = H + STRAP_RO; strapV.rotation.z = -Math.PI / 2; strapV.position.set(S.CW + (H + STRAP_RO) / 2, S.strapT / 2, 0);
  flapPivot.position.set(S.CW + H, 0.0, 0); flapPivot.rotation.set(0, Math.PI, 0); fold.visible = false;
}

// 相机取景：按画面比例把目标框完整放进视口（留 7% 边距），俯角 64°
const CAMS = { elev: 85 * Math.PI / 180, margin: 0.07 };
// 摊开取景宽：两侧对称包含平躺的扣带（伸出封面 2B+T+flapL）再留 0.6cm
const OPEN_W = () => 2 * (S.CW + 2 * S.B + S.T + S.flapL + 0.6);
function frameBox(cx, cz, w, h, extraElev = 0) {
  const aspect = innerWidth / innerHeight; camera.aspect = aspect;
  const vfov = camera.fov * Math.PI / 180; const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  const el = CAMS.elev + extraElev;
  const hEff = h * Math.sin(el) + 2.0 * Math.cos(el); // 倾斜后竖向投影
  const dV = (hEff / 2) / Math.tan(vfov / 2) / (1 - 2 * CAMS.margin);
  const dH = (w / 2) / Math.tan(hfov / 2) / (1 - 2 * CAMS.margin);
  const d = Math.max(dV, dH);
  camera.position.set(cx, Math.sin(el) * d, cz + Math.cos(el) * d);
  camera.lookAt(cx, 0.8, cz); camera.updateProjectionMatrix();
  return d;
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(x) { return Math.min(Math.max(x, 0), 1); }
function ease(t) { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function easeOutBack(t, s = 1.2) { t = clamp01(t); const c3 = s + 1; return 1 + c3 * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); }
// 阻尼弹簧解析解（质量 1）：返回 x(t) 从 0 到 1
function springStep(t, k, c) { const w0 = Math.sqrt(k), z = c / (2 * w0); if (z < 1) { const wd = w0 * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t)); } return 1 - Math.exp(-w0 * t) * (1 + w0 * t); }

let pageRTs = {}; let PATCH = null;
// 内页 3D 贴片：按当前各页面槽位的内容与曲面，逐顶点贴合（静态书芯 / 翻页正反面）
function syncPatches() {
  if (!PATCH) return;
  const leftVis = leftBlock.visible && leftPage.visible;
  PATCH.sync({ right: rightPage.visible ? slotC.right : null, left: leftVis ? slotC.left : null,
    turnFront: turnPage.visible ? slotC.turnFront : null, turnBack: turnPage.visible ? slotC.turnBack : null,
    rightY: rightPage.position.y, leftY: leftPage.position.y, turnArr: turnGeo.attributes.position.array, turnVer, turnLift: turnMat.uniforms.uLift.value });
}
const info = {};
function setBookRect(cx, cz, hw, hh) { deskMat.uniforms.uBookRect.value.set(cx, cz, hw, hh); }

function poseClosed() {
  setCoverAngle(0); frontPivot.visible = true; spineGroup.visible = true; strapClosed();
  rebuildBlocks(S.T, 0, true); dressClosed(0, 0); turnPage.visible = false; flutter.forEach((f) => f.visible = false);
  rightPage.visible = false; // 被封面盖住
  setBookRect(S.CW / 2, 0, S.CW / 2 + 0.25, S.CH / 2); deskMat.uniforms.uBookR.value = S.coverR;
  // 丝带：从书芯地脚露出，落在桌面上
  const z0 = S.CH / 2;
  poseRibbonClosed();
  glowMat.uniforms.uO.value = 0; moteMat.uniforms.uO.value = 0;
}
function poseOpen(f = 0.5, rightContent = 'snowR', leftContent = 'snowL', tRo = null) {
  setCoverAngle(Math.PI); spineGroup.visible = false; strapOpen();
  const tL = S.T * f, tR = tRo ?? S.T * (1 - f);
  rebuildBlocks(tR, tL); rightPage.visible = true;
  // 封面平摊时位于 y 0..B（铰链在书本中线）；左书芯在其上
  turnPage.visible = false; flutter.forEach((x) => x.visible = false);
  setContent(rightPageMat, rightContent, 'F'); setContent(leftPageMat, leftContent, 'F');
  setBookRect(0, 0, S.CW + 0.25, S.CH / 2); deskMat.uniforms.uBookR.value = S.coverR;
  ribbonGutter(S.B + tR); dressOpen(tR, tL);
  glowMat.uniforms.uO.value = 0; moteMat.uniforms.uO.value = 0;
}
// ---- 书的外部装扮：松紧带、绳子与橘子挂件 ----
function dressClosed(slide, flop) {
  if (!DR) return;
  DR.elastic.visible = false; // 闭合系统只保留珐琅扣搭带（松紧带去掉，避免两套扣合交叉）
  layTwineFrom(S.B + S.T * 0.72);
}
// 红白双股棉绳：夹在书芯天头，探出后贴着天头切口垂下、搭过封底飞边，平躺在桌面上弯一道，末端系着小橘子（果蒂朝绳）
let twineKey = '';
function layTwineFrom(y0) {
  const tk = y0.toFixed(4); if (tk === twineKey) { DR.orangeCharm.visible = true; return; } twineKey = tk;
  const hz = -S.PH / 2, r = 0.075, ez = -S.CH / 2;
  DR.layTwine([new THREE.Vector3(9.2, y0 - 0.02, hz + 1.6), new THREE.Vector3(9.28, y0 + 0.02, hz + 0.25), new THREE.Vector3(9.34, y0 - 0.1, hz - 0.07), new THREE.Vector3(9.38, Math.max(y0 * 0.5, S.B + r + 0.05), hz - 0.1),
    new THREE.Vector3(9.42, S.B + r + 0.01, ez + 0.05), new THREE.Vector3(9.5, r + 0.08, ez - 0.32), new THREE.Vector3(9.75, r, ez - 0.9),
    new THREE.Vector3(10.5, r, ez - 1.55), new THREE.Vector3(11.5, r, ez - 1.8), new THREE.Vector3(12.25, r, ez - 1.6)]);
  DR.orangeCharm.visible = true;
}
function dressOpen(tR, tL) {
  if (!DR) return;
  DR.elastic.visible = false;
  layTwineFrom(S.B + tR * 0.9);
}
const slotC = { right: null, left: null, turnFront: null, turnBack: null };
function setContent(mat, key, side) {
  const e = pageRTs[key];
  { const k2 = key === 'snowR2' ? 'snowR' : key; if (mat === rightPageMat) slotC.right = k2; else if (mat === leftPageMat) slotC.left = k2; else if (mat === turnMat) slotC[side === 'F' ? 'turnFront' : 'turnBack'] = k2; }
  if (side === 'F' && mat.uniforms.uSigOn) mat.uniforms.uSigOn.value = key === 'title' ? 1 : 0;
  if (side === 'F') { mat.uniforms.uFront.value = e ? e.rt.texture : null; mat.uniforms.uMaskF.value = e ? e.mask.texture : null; mat.uniforms.uHasFront.value = e ? 1 : 0; }
  else { mat.uniforms.uBack.value = e ? e.rt.texture : null; mat.uniforms.uMaskB.value = e ? e.mask.texture : null; mat.uniforms.uHasBack.value = e ? 1 : 0; }
  if (!mat.uniforms.uFront.value) { mat.uniforms.uFront.value = blankTex; mat.uniforms.uMaskF.value = blankTex; }
  if (!mat.uniforms.uBack.value) { mat.uniforms.uBack.value = blankTex; mat.uniforms.uMaskB.value = blankTex; }
}
const blankTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); blankTex.needsUpdate = true;

function poseCurl(p, corner = 1) {
  poseOpen(0.5, 'snowR2', 'snowL');
  // 翻起的是右页（前=雪绒国右页，背=下一页左），下面露出下一页
  turnPage.visible = true;
  setContent(turnMat, 'snowR', 'F'); setContent(turnMat, 'nextL', 'B');
  setContent(rightPageMat, 'nextR', 'F');
  const tR = S.T * 0.5, tL = S.T * 0.5;
  curlPage(turnPage, p, S.B + tR, S.B + tL, { corner });
  turnMat.uniforms.uLift.value = Math.sin(Math.PI * clamp01(p * 1.6));
  info.stretch = lastStretch;
}

// 开场时间线（毫秒）
const TL = { camStart: 1200, camEnd: 3800, popStart: 900, popEnd: 1500, strapDrop: 1700, coverStart: 1500, coverEnd: 2900, flutStart: 2700, flutN: 9, flutDur: 560, flutGap: 210, sigStart: 3300, sigEnd: 5100, end: 6000 };
function poseOpening(ms) {
  // 扣子弹开 → 封面带着前半本一起翻开（书从中间打开，直接露出扉页）→ 签名
  const coverT = ease((ms - TL.coverStart) / (TL.coverEnd - TL.coverStart));
  const theta = Math.PI * coverT, split = coverT > 0;
  const closedNow = Math.floor((1 - clamp01(theta / 0.6)) * 16) / 16;   // 书芯鼓起分 16 档压平
  if (split) rebuildBlocks(S.T - F0, F0, closedNow); else rebuildBlocks(S.T, 0, closedNow);
  setCoverAngle(theta);
  if (DR) { if (split) DR.place(S.T - F0, theta > 2.9 ? F0 : 0, bulgeFn(closedNow), closedNow); DR.elastic.visible = false; layTwineFrom(S.B + Math.round(lerp(S.T * 0.72, (S.T - F0) * 0.9, coverT) / 0.02) * 0.02); }
  spineGroup.visible = theta < 1.2; frontPivot.visible = true;
  rightPage.visible = split; setContent(rightPageMat, 'title', 'F');
  leftBlock.visible = split; leftPage.visible = split; setContent(leftPageMat, 'blank', 'F');
  if (ms < TL.popStart) strapClosed();
  else if (ms < TL.strapDrop) { const t = (ms - TL.popStart) / 1000; strapPop((115 * Math.PI / 180) * springStep(t, 300, 20)); }
  else { const t = clamp01((ms - TL.strapDrop) / 450); if (t < 1) strapPop(lerp(115, 180, ease(t)) * Math.PI / 180); else strapOpen(); }
  turnPage.visible = false; flutter.forEach((m) => { m.visible = false; });
  glowMat.uniforms.uO.value = 0; moteMat.uniforms.uO.value = 0;
  sigUniform.value = clamp01((ms - TL.sigStart) / (TL.sigEnd - TL.sigStart)) * 1.03;   // 1.03：写完后最后一笔也完全不透明
  setBookRect(lerp(S.CW / 2, 0, coverT), 0, lerp(S.CW / 2 + 0.25, S.CW + 0.25, coverT), S.CH / 2);
  if (theta < 0.5) poseRibbonClosed(); else poseRibbonTitle(S.B + S.T - F0);
}
function ribbonGutter(yTop) { // 摊开时丝带躺在订口里：从天头沿订口直下，从地脚垂出落到桌面
  const yg = (x) => yTop + prof(x) + 0.035;
  layRibbon([new THREE.Vector3(0.14, yg(0.14), -S.PH / 2 + 0.15), new THREE.Vector3(0.16, yg(0.16), -S.PH / 4), new THREE.Vector3(0.17, yg(0.17), S.PH / 6), new THREE.Vector3(0.18, yg(0.18), S.PH / 2 - 0.3),
    new THREE.Vector3(0.2, yTop - 0.15, S.PH / 2 + 0.12), new THREE.Vector3(0.25, yTop * 0.5, S.CH / 2 + 0.12), new THREE.Vector3(0.35, S.B * 0.5, S.CH / 2 + 0.25), new THREE.Vector3(0.7, 0.0, S.CH / 2 + 1.0),
    new THREE.Vector3(1.5, 0.0, S.CH / 2 + 2.1), new THREE.Vector3(2.4, 0.0, S.CH / 2 + 2.9), new THREE.Vector3(2.2, 0.0, S.CH / 2 + 3.8)], 'g' + yTop.toFixed(4));
}
// 合上时：丝带从地脚探出，垂到桌面后向书口一侧弯成一道 S，燕尾整段留在书前（首屏推近也完整入画）
function poseRibbonClosed() { const z0 = S.CH / 2; layRibbon([new THREE.Vector3(4.2, S.B + S.T * 0.55, S.PH / 2 - 0.3), new THREE.Vector3(4.3, S.B + S.T * 0.5, z0 + 0.05), new THREE.Vector3(4.4, 0.3, z0 + 0.42), new THREE.Vector3(4.7, 0.0, z0 + 1.1),
  new THREE.Vector3(5.6, 0.0, z0 + 1.9), new THREE.Vector3(7.0, 0.0, z0 + 2.2), new THREE.Vector3(8.4, 0.0, z0 + 1.85), new THREE.Vector3(9.6, 0.0, z0 + 1.95)], 'closed'); }
function poseRibbonTitle(yTop = S.B + S.T) { ribbonGutter(yTop); }


function loadProgress(p) {
  const bar = document.querySelector('#loading em');
  if (bar) bar.style.width = Math.min(100, Math.round(p * 100)) + '%';
}
const yieldFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
// ---------------- 页面内容 ----------------
async function buildContent() {
  loadProgress(0.04);
  await document.fonts.load('40px WenKai', '雪'); await document.fonts.load('40px ChillRound', '雪'); await document.fonts.load('40px NunitoP', 'Koko');
  loadProgress(0.1); await yieldFrame();
  globalThis.__patchKScale = (matchMedia('(pointer: coarse)').matches || Q.get('patchK') === 'low') ? 0.72 : 1;
  PATCH = createPatchSystem({ THREE, S, makeMat, col, prof, book, maxAniso: MAX_ANISO });
  const pageMark = { snowL: 0.22, snowR: 0.32, nextL: 0.4, nextR: 0.48, cloudL: 0.55, cloudR: 0.6, seaL: 0.66, seaR: 0.7, starryL: 0.76, starryR: 0.8, creamL: 0.86, creamR: 0.9, title: 0.93 };
  pageRTs = await buildPages({ S, THREE, PAGE_RT_W, canvasLayer, makePageRT, renderPage, loadTex, loadImg, info, Q, PATCH, maxAniso: MAX_ANISO, onPage: async (key) => { loadProgress(pageMark[key] || 0.8); await yieldFrame(); } });
  info.patches = Object.assign({}, PATCH.stats);
  DR = buildDress({ THREE, S, col, makeMat, book, frontPivot, yH, COVER, brassMat, mergeGeos }); await DR.loadPhoto();
  loadProgress(0.92); await yieldFrame();
  uCover.uTitle.value = DR.makeTitleTex();
  sigTex = makeSignatureTex(); sigTexU.value = sigTex;
}
function loadImg(url) { return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = url; }); }
let sigTex = null;
function makeSignatureTex() { // 真实笔顺：手工设计的连笔 “Koko” + 下划弧；R = 沿笔画累计弧长进度（按书写顺序），A = 覆盖
  const W = 1024, H = 512;
  const strokes = [
    [[205, 118], [199, 190], [190, 280], [178, 378]],                                                                 // K 竖
    [[322, 138], [268, 186], [200, 250], [252, 284], [290, 338], [318, 372], [356, 362], [392, 300], [405, 276],         // K 臂 → 连到 o
     [358, 322], [392, 280], [434, 294], [442, 336], [404, 366], [364, 350], [398, 370], [440, 352],                   // o（顺时针一圈，底边带出）
     [480, 262], [522, 160], [512, 108], [486, 128], [474, 240], [464, 372],                                           // k 的圈与竖
     [482, 324], [528, 296], [544, 322], [506, 342], [494, 348], [538, 372], [574, 362],                                     // k 的弯
     [578, 322], [612, 280], [654, 294], [662, 336], [624, 366], [584, 350], [618, 370], [664, 352], [700, 318],     // o
     [740, 330], [762, 386], [680, 428], [470, 432], [300, 418], [226, 398]],                                         // 下划的一道长弧
  ];
  // Catmull-Rom 细分
  const sampleStroke = (pts) => { const out = []; for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
    for (let k = 0; k < 16; k++) { const t = k / 16, t2 = t * t, t3 = t2 * t;
      out.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
                0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]); } }
    out.push(pts[pts.length - 1]); return out; };
  const S2 = strokes.map(sampleStroke);
  let total = 0; const lens = S2.map((s) => { let L = 0; for (let i = 1; i < s.length; i++) L += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]); total += L; return L; });
  const gap = total * 0.04; total += gap * (S2.length - 1);   // 提笔停顿
  const pc = document.createElement('canvas'); pc.width = W; pc.height = H; const gp = pc.getContext('2d'); gp.fillStyle = '#fff'; gp.fillRect(0, 0, W, H); gp.globalCompositeOperation = 'darken';
  const cc = document.createElement('canvas'); cc.width = W; cc.height = H; const gc = cc.getContext('2d');
  for (const g of [gp, gc]) { g.lineCap = 'round'; g.lineJoin = 'round'; }
  let acc = 0;
  S2.forEach((s, si) => { const L = lens[si]; let a2 = 0;
    for (let i = 1; i < s.length; i++) { const d = Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]); a2 += d;
      const t = a2 / L; const press = Math.min(1, t / 0.06) * Math.min(1, (1 - t) / 0.12 + 0.35);  // 起笔渐粗、收笔渐细
      const w = (si === 2 ? 6 : 6 + 7 * press) * (1 - 0.25 * Math.min(1, d / 14));
      const p = Math.min(1, (acc + a2) / total); const v = Math.round(p * 255);
      gp.strokeStyle = `rgb(${v},${v},${v})`; gp.lineWidth = w + 3; gp.beginPath(); gp.moveTo(...s[i - 1]); gp.lineTo(...s[i]); gp.stroke();
      gc.strokeStyle = '#fff'; gc.lineWidth = w; gc.beginPath(); gc.moveTo(...s[i - 1]); gc.lineTo(...s[i]); gc.stroke(); }
    acc += L + gap; });
  const P2 = gp.getImageData(0, 0, W, H).data, C2 = gc.getImageData(0, 0, W, H);
  for (let i = 0; i < C2.data.length; i += 4) { C2.data[i] = P2[i]; C2.data[i + 1] = 0; C2.data[i + 2] = 0; }
  // 直接上传原始像素（不经过画布 → 不被预乘 alpha 吃掉笔画边缘的进度值，避免未写部分提前露出淡影）；手动上下翻转
  const D = new Uint8Array(W * H * 4); for (let y = 0; y < H; y++) D.set(C2.data.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
  const t = new THREE.DataTexture(D, W, H); t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
}
// ---------------- 后期：景深 + 窗光光束 + 远处暖雾（实现在 post.js）----------------
const POST = { focusR: 20, k: 0.034, maxR: 0.011, shaft: 0.0011, haze: 0.05 };
const post = createPost({ THREE, renderer, GLSL_COMMON, shared, col, POST });
// 超过 600 万像素的视网膜全屏从 80% 内部分辨率起步（仍约 500 万像素），换稳定 60 帧；普通屏保持原生分辨率
post.cfg.scale = LIVE && renderer.domElement.width * renderer.domElement.height > 6e6 ? 0.75 : 1;
// 抗锯齿档位：像素少（普通屏）用 4 倍多重采样；像素多（视网膜屏全屏约 770 万像素）改用合成时的轮廓抗锯齿——多重采样在这个像素量上一帧要多花 8 毫秒
function pickAA() {
  const q = Q.get('aa'); const px = renderer.domElement.width * renderer.domElement.height;
  const mode = q || (!LIVE ? 'msaa4' : px > 4.2e6 ? 'fxaa' : 'msaa4');
  post.cfg.samples = mode === 'msaa4' ? 4 : mode === 'msaa2' ? 2 : 0; post.cfg.fxaa = mode === 'fxaa';
}
let focusPoint = new THREE.Vector3(0, 2, 0);
const deskClear = col(C.desk);
function renderFrame() {
  syncPatches(); pickAA();
  return post.render(scene, camera, focusPoint, deskClear);
}

// ---------------- 首屏取景（空间全景）----------------
// 首屏：书是唯一主角——书本占画面宽度约一半，落在最亮的光斑里；书口（索引签、夹物、松紧带）朝向镜头右侧
// fit = 书本外包围点（含夹物探出）在画面中允许占到的 NDC 半宽/半高
const EST = { yaw: 17 * Math.PI / 180, pitch: 13 * Math.PI / 180, fov: 32, target: new THREE.Vector3(7.5, 2.5, 0.5), fitX: 0.97, fitY: 0.96, shiftY: 0, bookY: -0.5,
  room: [[-44, 30, -27], [0, 36, -34], [50, 34, -27.5]] };
// 竖屏：俯一点，书占画面宽度约 80%
const EST_P = { yaw: 6 * Math.PI / 180, pitch: 30 * Math.PI / 180, fov: 50, target: new THREE.Vector3(7.5, 2, 0.5), fitX: 0.97, fitY: 0.95, shiftY: 0,
  room: [[-20, 36, -34], [0, 40, -34], [23, 28, -27]] };
// 超宽屏（21:9）：横向本来就够宽，只要求窗台和软木板下沿入画，书更大
const EST_W = Object.assign({}, EST, { fov: 26, yaw: 14 * Math.PI / 180, pitch: 7 * Math.PI / 180, bookY: -0.42, room: [[-43.5, 31.5, -27], [-44, 11, -21], [0, 25, -34], [40, 27, -27.5]] });
let ROOM = null;
// 首屏待机推镜：0 = 空间全景（窗、窗台、软木板、桌上小物都完整），1 = 推到书前（书占画面约 40%）。
// 进入首屏后 600ms 开始，9s 缓入缓出推完，停住；用户点击时从当前推镜位置飞入阅读取景。
// 推镜终点：只按书本包围点取景——横屏书宽约画面 36%、落在下方；窗台压低后，书后面仍是护墙板 + 窗台 + 一截窗与窗外 + 软木板一角
const EST_CLOSE = { yaw: 18 * Math.PI / 180, pitch: 9 * Math.PI / 180, fov: 40, target: new THREE.Vector3(7.5, 2, 0), fitX: 0.46, fitY: 0.40, shiftY: -0.47, bookY: null, room: [] };
const EST_CLOSE_P = { yaw: 10 * Math.PI / 180, pitch: 20 * Math.PI / 180, fov: 46, target: new THREE.Vector3(7.5, 2, 0), fitX: 0.76, fitY: 0.30, shiftY: -0.52, bookY: null, room: [] };
function estPose(o = {}) {
  const k = o.dolly || 0; if (k <= 0) return estPose1(o);
  const aspect = innerWidth / innerHeight; const close = Object.assign({}, o.est || {}, aspect < 1 ? EST_CLOSE_P : EST_CLOSE);
  return lerpPose(estPose1(o), estPose1(Object.assign({}, o, { est: close })), k * k * (3 - 2 * k));
}
function estPose1(o = {}) {
  const aspect = innerWidth / innerHeight, E0 = aspect < 1 ? EST_P : aspect > 2.0 ? EST_W : EST, E = Object.assign({}, E0, o.est || {});
  if (o.est && o.est.target) E.target = new THREE.Vector3(...o.est.target);
  if (o.est && o.est.yawDeg != null) E.yaw = o.est.yawDeg * Math.PI / 180;
  if (o.est && o.est.pitchDeg != null) E.pitch = o.est.pitchDeg * Math.PI / 180;
  const yaw = E.yaw + (o.yaw || 0), pitch = E.pitch + (o.pitch || 0);
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const tgt = E.target.clone();
  // 书本包围点：封面四角 + 书口探出的索引签/信封 + 天头车票
  const X1 = S.CW + 1.4, Z1 = S.CH / 2 + 1.0, Y1 = 4.6;
  const kp = []; for (const x of [-0.3, X1]) for (const z of [-Z1, Z1]) for (const y of [0, Y1]) kp.push([x, y, z]);
  // 合上时垂到桌上的丝带燕尾 + 麻绳尾端的小橘子也要完整入画
  kp.push([7.2, 0, S.CH / 2 + 2.6], [10.0, 0, S.CH / 2 + 2.4]);
  // 房间模式：窗台两端 + 窗下半 + 软木板也必须入画（书是主角，房间在书后面清楚可读）
  if (E.room) for (const q of E.room) kp.push(q);
  const cam = new THREE.PerspectiveCamera(E.fov, aspect, 1, 1200);
  const place = (d, off) => { cam.position.copy(tgt).addScaledVector(dir, d).add(off); cam.lookAt(tgt.clone().add(off)); cam.updateMatrixWorld(); cam.updateProjectionMatrix(); };
  const bbox = (list = kp) => { let x0 = 9, x1 = -9, y0 = 9, y1 = -9; for (const q of list) { const v = new THREE.Vector3(...q).project(cam); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); } return { x0, x1, y0, y1 }; };
  let off = new THREE.Vector3(), d = 10;
  for (let it = 0; it < 8; it++) {
    // bookY 模式：书本身水平居中、竖直中心落在 bookY；房间关键点只要求都在画框内（不再按整体包围盒居中，书不会被挤到一角）
    const fits = (b) => E.bookY != null ? (Math.max(-b.x0, b.x1) < E.fitX && Math.max(-b.y0, b.y1) < E.fitY) : ((b.x1 - b.x0) / 2 < E.fitX && (b.y1 - b.y0) / 2 < E.fitY);
    for (d = 10; d < 700; d += 0.25) { place(d, off); if (fits(bbox())) break; }
    const b = E.bookY != null ? bbox(kp.slice(0, 8)) : bbox(); const h = 2 * d * Math.tan(E.fov * Math.PI / 360), w = h * aspect;
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), upv = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    off.addScaledVector(right, (b.x0 + b.x1) / 2 * w / 2).addScaledVector(upv, ((b.y0 + b.y1) / 2 - (E.bookY != null ? E.bookY : E.shiftY)) * h / 2);
  }
  place(d, off); info.estBox = bbox(); info.estD = d;
  return { pos: cam.position.clone(), target: tgt.clone().add(off), fov: E.fov };
}
function readPose(cx, cz, w, h) { const fov0 = camera.fov; camera.fov = 28; frameBox(cx, cz, w, h); const r = { pos: camera.position.clone(), target: new THREE.Vector3(cx, 0.8, cz), fov: 28 }; camera.fov = fov0; return r; }
// 正式运行的阅读取景：书尽量大。左到索引签、右到摊平的搭扣、上到探出天头的票根、下到书签，都留在画面里
function readFit() {
  const x0 = -(S.CW + 1.5), x1 = S.CW + 2 * S.B + S.T + S.flapL + 0.5;
  const m0 = CAMS.margin; CAMS.margin = 0.035; const r = readPose((x0 + x1) / 2, 0.9, (x1 - x0) * 1.23, S.CH + 5.6); CAMS.margin = m0; return r;
}
function setPose(p) { camera.fov = p.fov; camera.up.set(0, 1, 0); camera.position.copy(p.pos); camera.lookAt(p.target); camera.updateProjectionMatrix(); }
// 飞入：目标点线性、视线方向球面插值、距离按对数插值（远处不嫌慢、近处不嫌冲）
function lerpPose(a, b, t) {
  const tg = a.target.clone().lerp(b.target, t);
  const va = a.pos.clone().sub(a.target), vb = b.pos.clone().sub(b.target);
  const da = va.length(), db = vb.length();
  const qa = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), va.normalize());
  const qb = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), vb.normalize());
  const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(qa.slerp(qb, t));
  return { pos: tg.clone().addScaledVector(dir, da * Math.pow(db / da, t)), target: tg, fov: lerp(a.fov, b.fov, t) };
}

// ---------------- 场景切换（截图接口） ----------------
function applyState(st) {
  const state = st.state || 'open'; DRAG.on = state === 'read';
  shared.uCookieOff.value.set(st.cookie ? st.cookie[0] : 0, st.cookie ? st.cookie[1] : 0);
  shared.uCookieOn.value = st.noCookie ? 0 : 1;
  camera.fov = 28; camera.up.set(0, 1, 0); focusPoint.set(0, 2, 0);
  if (state === 'establish') { poseClosed(); setPose(estPose(st)); focusPoint.set(S.CW / 2, 2.5, 0); }
  else if (state === 'closed') { poseClosed(); frameBox(S.CW / 2, 0, S.CW + 3, S.CH + 2); focusPoint.set(S.CW / 2, 2.5, 0); }
  else if (state === 'opening') { poseClosed(); poseOpening(st.ms || 0);
    // 相机：首屏空间全景 → 摊开阅读取景（1200–3800ms）
    const t = ease(((st.ms || 0) - TL.camStart) / (TL.camEnd - TL.camStart));
    setPose(lerpPose(estPose({ dolly: st.dolly || 0 }), readPose(0, 0, OPEN_W(), S.CH + 2), t)); focusPoint.set(lerp(S.CW / 2, 0, t), 2.5, 0); }
  else if (state === 'curl') { poseCurl(st.p ?? 0.5, st.corner ?? 1); frameBox(0, -1.5, OPEN_W(), S.CH + 9); focusPoint.set(-1, 6, 0); }
  else if (state === 'open') { poseOpen(0.5); frameBox(0, 0, OPEN_W(), S.CH + 2); }
  else if (state === 'read') { DRAG.on = true; drawDrag(); frameBox(0, 0, OPEN_W(), S.CH + 2); }
  else if (state === 'mobile') { poseOpen(0.5); frameBox(S.PW / 2 - 0.4, 1.6, S.CW + 1.2, S.CH + 1.0); }
  else if (state === 'fidelity') { poseOpen(0.5); camera.fov = 20; frameTop(); }
  if (st.macro) { // 微距：对准某点放大
    const [x, z, d] = st.macro; camera.position.set(x - 0.0, d * Math.sin(CAMS.elev), z + d * Math.cos(CAMS.elev)); camera.lookAt(x, 1.2, z); camera.updateProjectionMatrix();
  }
  if (ROOM) ROOM.room.visible = !st.noProps;
  dustMat.uniforms.uO.value = st.noDust ? 0 : state === 'establish' ? 1 : state === 'opening' ? 1 - ease(((st.ms || 0) - TL.camStart) / (TL.camEnd - TL.camStart)) : 0; dust.visible = dustMat.uniforms.uO.value > 0.01;
  if (st.camOverride) { const c = st.camOverride; if (c[6]) camera.fov = c[6]; camera.position.set(c[0], c[1], c[2]); camera.lookAt(c[3], c[4], c[5]); camera.updateProjectionMatrix(); }
  renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  shared.uTime.value = st.time ?? 12.0;
  post.cfg.dof = st.noDof ? 0 : 1; post.cfg.shaft = st.noShaft ? 0 : POST.shaft;
  const rf = renderFrame();
  info.calls = rf.calls; info.tris = rf.tris; info.textures = renderer.info.memory.textures; info.geometries = renderer.info.memory.geometries;
  info.cam = camera.position.toArray().map((v) => +v.toFixed(2)); info.fov = camera.fov;
  if (state === 'fidelity') info.posterScreen = posterScreenCorners();
}
function frameTop() { // 正俯视，用于色准测试
  camera.position.set(-S.PW / 2, 60, 0.001); camera.lookAt(-S.PW / 2, 0, 0); camera.up.set(0, 0, -1); camera.lookAt(-S.PW / 2, 0, 0);
  const vfov = camera.fov * Math.PI / 180; const d = (S.PH * 1.05 / 2) / Math.tan(vfov / 2); camera.position.y = d + S.B + S.T * 0.5; camera.updateProjectionMatrix();
}
function posterScreenCorners() { // 海报贴片真实四角（照片卡 zBase + 厚度 + 微拱 + 0.0015）投到屏幕
  const r = info.posterRect; const pts = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const v = PATCH.pointWorld('snowL', 'poster', sx * r.w / 2, sz * r.h / 2).project(camera);
    pts.push([(v.x * 0.5 + 0.5) * innerWidth, (1 - (v.y * 0.5 + 0.5)) * innerHeight]);
  }
  return pts;
}

// 交互：滑块/拖拽驱动翻页（调试）
const ui = document.getElementById('ui'); const sl = document.getElementById('sl');
if (Q.get('ui')) { ui.style.display = 'block'; sl.oninput = () => applyState({ state: 'curl', p: sl.value / 1000 }); }

// ---------------- 正式运行用的接口（runtime.js 调用）：这里只管「摆姿态」和「画一帧」，流程与输入都在 runtime.js ----------------
const LEAF = 0;                        // 每翻一张左右两叠的厚度变化：先固定为 0（两叠始终等高）。要做「越往后翻左边越厚」时改这里，并让翻页纸的转轴高度按左右分开算
// 书里的纸，按顺序：f = 正面（在右叠时朝上的那面），b = 背面。只保留已做好的跨页，末尾不接白页
const LEAVES = [
  { f: 'title', b: 'snowL' },
  { f: 'snowR', b: 'nextL' },
  { f: 'nextR', b: 'cloudL' },
  { f: 'cloudR', b: 'seaL' },
  { f: 'seaR', b: 'starryL' },
  { f: 'starryR', b: 'creamL' },
  { f: 'creamR', b: null },
];
const tLof = (s) => F0 + s * LEAF, tRof = (s) => S.T - tLof(s);
const leftOf = (s) => (s === 0 ? 'blank' : LEAVES[s - 1].b), rightOf = (s) => (LEAVES[s] ? LEAVES[s].f : 'blank');
// 系列收纳口：页上露出封面，点开后可左右切换；idx 是当前封面下标
const SERIES = {
  snow: { name: '雪绒国', images: ['assets/poster_snow03.jpg', 'assets/Koko_snow_pastel_03_window_orange_title.jpg'], page: 'snowL', patch: 'poster', idx: 0 },
  cloud: { name: '云朵午后', images: ['assets/Koko_poster_cloud_afternoon_01_lying_on_cloud_v3.jpg'], page: 'cloudR', patch: 'poster', idx: 0 },
  sea: { name: '海上来信', images: ['assets/Koko_poster_sea_letter_01_window_gull_v3.jpg'], page: 'seaR', patch: 'poster', idx: 0 },
  starry: { name: '星夜彩铅', images: ['assets/Koko_starry_01_round_collection.jpg'], page: 'starryR', patch: 'poster', idx: 0 },
  cream: { name: '奶油素描', images: ['assets/Koko_cream_01_round_pegs.jpg'], page: 'creamR', patch: 'poster', idx: 0 },
};
const FLY_ONE = { kokoArt: 'assets/koko_cut_full.png' };   // 单张飞出（非系列收纳口）
const seriesTexCache = {};
async function ensureSeriesTex(url) {
  if (seriesTexCache[url]) return seriesTexCache[url];
  const t = await loadTex(url); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; seriesTexCache[url] = t; return t;
}
function pocketOf(P) {
  const sid = P && P.series; if (!sid || !SERIES[sid]) return null;
  const S0 = SERIES[sid]; return { id: sid, name: S0.name, images: S0.images, idx: S0.idx, page: S0.page, patch: S0.patch };
}
const hitRay = new THREE.Raycaster(), hitNdc = new THREE.Vector2();
const closedBox = new THREE.Box3(new THREE.Vector3(-0.8, 0, -S.CH / 2 - 0.6), new THREE.Vector3(S.CW + 2.4, 2 * S.B + S.T + S.bulge + 0.6, S.CH / 2 + 0.6));
function setHitRay(cx, cy) { const r = renderer.domElement.getBoundingClientRect(); hitNdc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); hitRay.setFromCamera(hitNdc, camera); }
let camCache = null;
const engine = {
  S, TL, canvas: renderer.domElement, lerpPose, ease, clamp01,
  spreads: LEAVES.length,
  canTurn: (i) => i >= 0 && i < LEAVES.length && !!LEAVES[i].b,   // 第 i 张纸后面还有内容，才能真的翻过去
  pageY: (s) => ({ r: S.B + tRof(s), l: S.B + tLof(s) }),
  // —— 姿态 ——
  poseCover() { poseClosed(); sigUniform.value = 0; btn.scale.setScalar(1); },
  claspLift(a) { strapPop(a); },                                   // 合上时搭扣舌片抬起的角度（待机时轻轻动一下）
  claspBtn(scale, press) { btn.scale.setScalar(scale); btn.position.y = S.strapT + 0.03 - press; },
  poseOpening(ms) { poseOpening(ms); },
  poseSpread(s) { poseOpen(tLof(s) / S.T, rightOf(s), leftOf(s)); leftBlock.visible = true; leftPage.visible = true; sigUniform.value = 1.03; },
  // 第 i 张纸离开右叠：右边露出下一张（右叠少一张的厚度），左边还是原来那一面；纸落到左边后再由 poseSpread(i+1) 接手
  beginTurn(i) {
    poseOpen(tLof(i) / S.T, rightOf(i + 1), leftOf(i), tRof(i + 1)); leftBlock.visible = true; leftPage.visible = true; sigUniform.value = 1.03;
    turnPage.visible = true; setContent(turnMat, LEAVES[i].f, 'F'); setContent(turnMat, LEAVES[i].b || 'blank', 'B');
  },
  updateTurn(i, p, corner = 1, lift = 0) {
    curlPage(turnPage, p, S.B + tRof(i), S.B + tLof(i + 1), { corner, lift: 0.012 + lift });
    turnMat.uniforms.uLift.value = Math.sin(Math.PI * clamp01(p * 1.6));
  },
  // —— 相机 ——
  camPoses() { // 首屏全景 / 推近 / 阅读 / 翻页时略抬的取景；只在窗口尺寸变化时重算（首屏取景要迭代求解，不能每帧算）
    const k = innerWidth + 'x' + innerHeight; if (camCache && camCache.k === k) return camCache;
    const aspect = innerWidth / innerHeight;
    camCache = { k, est0: estPose1({}), est1: estPose1({ est: aspect < 1 ? EST_CLOSE_P : EST_CLOSE }), read: readFit() };
    // 翻页取景：同一个俯角，退后并上移到「竖起来的那张纸的上沿」和「书的下沿」都留在画面里
    { const R = camCache.read, cam = new THREE.PerspectiveCamera(R.fov, aspect, 1, 1200), dir = R.pos.clone().sub(R.target).normalize();
      const top = new THREE.Vector3(0, S.B + S.T * 0.5 + S.PW * 0.97, -S.PH / 2), bot = new THREE.Vector3(0, 0, S.CH / 2 + 0.6);
      let d = R.pos.distanceTo(R.target); const tg = R.target.clone();
      for (let it = 0; it < 80; it++) {
        cam.position.copy(tg).addScaledVector(dir, d); cam.lookAt(tg); cam.updateMatrixWorld();
        const a = top.clone().project(cam).y, b = bot.clone().project(cam).y, half = (a - b) / 2, mid = (a + b) / 2;
        if (half > 0.9) d *= 1.012;
        tg.addScaledVector(new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1), mid * d * Math.tan(R.fov * Math.PI / 360) * 0.6);
      }
      camCache.turn = { pos: tg.clone().addScaledVector(dir, d), target: tg, fov: R.fov }; }
    return camCache;
  },
  setCam(pose, focus) { setPose(pose); focusPoint.copy(focus); },
  setRead(k) { shared.uCookieOff.value.set(TUNE.winX * k, TUNE.mullX * k); },   // 0 = 首屏（窗影在原位），1 = 阅读（窗影让开书页）
  camNow() { const t = new THREE.Vector3(); camera.getWorldDirection(t); return { pos: camera.position.clone(), dir: t, fov: camera.fov }; },
  // —— 指针 ——
  hitPlane(cx, cy, y) { setHitRay(cx, cy); const t = (y - hitRay.ray.origin.y) / hitRay.ray.direction.y; return t > 0 ? hitRay.ray.origin.clone().addScaledVector(hitRay.ray.direction, t) : null; },
  hitBook(cx, cy) { setHitRay(cx, cy); return hitRay.ray.intersectsBox(closedBox); },
  // —— 页面上的东西 ——
  // 指针下面是哪一页的哪件东西；pocket：系列收纳口；fly：单张飞出
  pick(cx, cy, s) {
    for (const side of [1, -1]) { const key = side > 0 ? rightOf(s) : leftOf(s); if (!PATCH.pages[key]) continue;
      const h = this.hitPlane(cx, cy, S.B + (side > 0 ? tRof(s) : tLof(s)) + 0.1); if (!h) continue;
      const x = side > 0 ? h.x : h.x + S.PW, y = h.z + S.PH / 2; if (x < 0 || x > S.PW || y < 0 || y > S.PH) continue;
      const P = PATCH.pick(key, x, y); if (!P) continue;
      const pocket = pocketOf(P);
      const fly = pocket ? pocket.images[pocket.idx] : (FLY_ONE[P.id] || null);
      return { key, P, fly, pocket }; }
    return null;
  },
  pop(key, P, v, tilt) { PATCH.setPop(key, P, v, tilt); },
  prop(key, id) { return PATCH.pages[key] && PATCH.pages[key].byId[id]; },
  series: SERIES,
  async setSeriesCover(sid, idx) {
    const S0 = SERIES[sid]; if (!S0) return false;
    const i = ((idx % S0.images.length) + S0.images.length) % S0.images.length;
    S0.idx = i; const tex = await ensureSeriesTex(S0.images[i]);
    return PATCH.setPosterMap(S0.page, S0.patch, tex);
  },
  screenQuad(key, P) { const r = renderer.domElement.getBoundingClientRect();
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => { const v = PATCH.pointWorld(key, P, sx * P.hw, sy * P.hh).project(camera); return [r.left + (v.x * 0.5 + 0.5) * r.width, r.top + (1 - (v.y * 0.5 + 0.5)) * r.height]; }); },
  // —— 画一帧 ——
  resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); },
  render(time, o = {}) {
    shared.uTime.value = time;
    dustMat.uniforms.uO.value = o.dust || 0; dust.visible = dustMat.uniforms.uO.value > 0.01;
    renderer.shadowMap.needsUpdate = !!o.shadows;                 // 影子图只在东西动的时候重画
    return renderFrame();
  },
  quality: post.cfg, renderSize: () => post.size(), gl: () => renderer.getContext(),
};

(async function init() {
  await buildContent();   // 签名不再是浮在纸上的一块透明片，改由内页材质直接画（见 pageMat）
  ROOM = buildRoom({ THREE, scene, VERT, FRAG_HEAD, shared, col, WIN, DESK, roundedRectShape });
  loadProgress(0.96); await yieldFrame();
  // 预编译所有着色器（首帧不卡）
  poseOpen(0.5); renderer.compile(scene, camera);
  const st = { state: Q.get('state') || 'open', p: Q.get('p') ? parseFloat(Q.get('p')) : 0.5, ms: Q.get('ms') ? parseFloat(Q.get('ms')) : 0 };
  if (LIVE) {
    // 预热：把开场翻飞、每一张纸翻到一半的样子各画一帧——着色器编译、贴图和贴片上传显卡都在加载阶段做完，玩的时候第一次翻页不卡
    renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; frameBox(0, 0, OPEN_W(), S.CH + 2);
    poseClosed(); for (const ms of [1560, 2200, 3600]) { poseOpening(ms); renderer.shadowMap.needsUpdate = true; renderFrame(); }
    loadProgress(0.98); await yieldFrame();
    for (let i = 0; i < LEAVES.length; i++) { engine.beginTurn(i); engine.updateTurn(i, 0.5); renderFrame(); }
    poseClosed(); renderFrame();
    loadProgress(1);
    renderer.shadowMap.autoUpdate = false; window.__app = startRuntime(engine);
    // 画面稳定跑了几帧之后再把加载页淡出去
    { let n = 0; const go = () => { if (++n < 8) return requestAnimationFrame(go); const el = document.getElementById('loading'); if (el) { el.classList.add('gone'); setTimeout(() => el.remove(), 700); } }; requestAnimationFrame(go); }
  }
  else { applyState(st); const el = document.getElementById('loading'); if (el) el.remove(); }
  window.__eng = { screenQuad: (k, P) => engine.screenQuad(k, P), patch: (k, id) => PATCH.pages[k].byId[id], turnBox: () => { const p = turnGeo.attributes.position; let y0=9,y1=-9; for(let i=0;i<p.count;i++){ const v=new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i)).project(camera); y0=Math.min(y0,v.y); y1=Math.max(y1,v.y); } return [y0,y1]; }, turnPeak: () => { const p = turnGeo.attributes.position; let m = 0; for (let i = 0; i < p.count; i++) m = Math.max(m, p.getY(i)); return m - (S.B + S.T * 0.5); } };   // 自测用
  window.__set = (o) => { applyState(o); return info; };
  window.__info = () => info;
  window.__sceneTris = () => { let t = 0; scene.traverse((o) => { if (o.isMesh && o.geometry.attributes.position) { const g = o.geometry; t += Math.round((g.index ? g.index.count : g.attributes.position.count) / 3); } }); return t; };
  window.__pv = () => camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse).elements;
  window.__proj = (pts) => pts.map((p) => { const v = new THREE.Vector3(...p).project(camera); return [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)]; });
  window.__bench = () => { // 只测 CPU 侧：翻页网格积分 + 法线重算；GPU 侧需 Mac 实测
    const t0 = performance.now(); for (let i = 0; i < 300; i++) curlPage(turnPage, (i % 100) / 100, S.B + S.T * 0.5, S.B + S.T * 0.5, {}); const t1 = performance.now();
    const t2 = performance.now(); for (let i = 0; i < 300; i++) poseRibbonTitle(); const t3 = performance.now();
    const t4 = performance.now(); const e = makePageRT(); renderPage(e, [{ tex: blankTex, rect: [0, 0, S.PW, S.PH] }]); renderer.getContext().finish(); const t5 = performance.now();
    poseCurl(0.5); syncPatches(); const patchTurnMs = PATCH.benchTurn(60);
    const t6 = performance.now(); for (let i = 0; i < 60; i++) { curlPage(turnPage, 0.3 + (i % 30) / 60, S.B + S.T * 0.5, S.B + S.T * 0.5, {}); syncPatches(); } const t7 = performance.now();
    return { curlMs: (t1 - t0) / 300, ribbonMs: (t3 - t2) / 300, pageRTMsSwiftshader: t5 - t4, cols: S.turnCols, rows: S.turnRows, patchTurnMs, curlPlusPatchSyncMs: (t7 - t6) / 60, patches: PATCH.stats, pageRT: [PAGE_RT_W, PAGE_RT_H], maxAniso: MAX_ANISO, maxTex: renderer.capabilities.maxTextureSize, build: info.patchBuild };
  };
  window.__ready = true;
})();
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); });

// ---------------- 拖拽翻页（阅读态）：按住右页书口一侧拖向左，松手后弹簧落到最近的一侧 ----------------
// p：0 = 平放在右边，1 = 翻到左边；拖动时 p 跟手（由指针在页面高度平面上的 x 决定），松手后 p'' = -k(p - 目标) - c·p'
const DRAG = { on: false, p: 0, v: 0, target: 0, held: false, corner: 1, spread: 0, lastX: 0, lastT: 0, vx: 0, raf: 0 };
const SPREADS = [['snowL', 'snowR', 'nextL', 'nextR']]; // [左, 右(翻页正面), 翻页背面, 下面露出的]
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pagePlaneHit(ev) {
  const r = renderer.domElement.getBoundingClientRect(); ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera); const y = S.B + S.T * 0.5 + 0.3; const t = (y - ray.ray.origin.y) / ray.ray.direction.y; if (t < 0) return null;
  return ray.ray.origin.clone().addScaledVector(ray.ray.direction, t);
}
function drawDrag() {
  const [L, R, B, U] = SPREADS[0];
  if (DRAG.p <= 0.001 && !DRAG.held) { poseOpen(0.5, R, L); }
  else if (DRAG.p >= 0.999 && !DRAG.held) { poseOpen(0.5, U, B); }
  else {
    poseOpen(0.5, U, L); turnPage.visible = true;
    setContent(turnMat, R, 'F'); setContent(turnMat, B, 'B');
    curlPage(turnPage, DRAG.p, S.B + S.T * 0.5, S.B + S.T * 0.5, { corner: DRAG.corner });
    turnMat.uniforms.uLift.value = Math.sin(Math.PI * clamp01(DRAG.p * 1.6));
  }
  info.dragP = +DRAG.p.toFixed(3);
}
function dragLoop(t) {
  DRAG.raf = 0; if (!DRAG.on) return;
  const dt = Math.min(0.033, (t - (DRAG.lastT || t)) / 1000) || 0.016; DRAG.lastT = t;
  if (!DRAG.held) { // 弹簧：k=170, c=24（略欠阻尼，落下时轻轻一弹）
    const a = -170 * (DRAG.p - DRAG.target) - 24 * DRAG.v; DRAG.v += a * dt; DRAG.p += DRAG.v * dt;
    if (DRAG.p < 0) { DRAG.p = 0; DRAG.v = -DRAG.v * 0.2; } if (DRAG.p > 1) { DRAG.p = 1; DRAG.v = -DRAG.v * 0.2; }
    if (Math.abs(DRAG.p - DRAG.target) < 0.002 && Math.abs(DRAG.v) < 0.01) { DRAG.p = DRAG.target; DRAG.v = 0; drawDrag(); renderFrame(); return; }
  }
  drawDrag(); renderFrame(); DRAG.raf = requestAnimationFrame(dragLoop);
}
const kick = () => { if (!DRAG.raf) { DRAG.lastT = 0; DRAG.raf = requestAnimationFrame(dragLoop); } };
renderer.domElement.addEventListener('pointerdown', (ev) => {
  if (!DRAG.on) return; const h = pagePlaneHit(ev); if (!h) return;
  const onRight = h.x > S.PW * 0.45 && h.x < S.PW + 1.5 && Math.abs(h.z) < S.PH / 2 + 1;
  const onLeft = DRAG.p > 0.5 && h.x < -S.PW * 0.45 && h.x > -S.PW - 1.5 && Math.abs(h.z) < S.PH / 2 + 1;
  if (!onRight && !onLeft) return;
  DRAG.held = true; DRAG.corner = h.z > 0 ? 1 : -1; DRAG.lastX = h.x; DRAG.vx = 0; renderer.domElement.setPointerCapture(ev.pointerId); kick();
});
renderer.domElement.addEventListener('pointermove', (ev) => {
  if (!DRAG.held) return; const h = pagePlaneHit(ev); if (!h) return;
  DRAG.vx = 0.7 * DRAG.vx + 0.3 * (h.x - DRAG.lastX); DRAG.lastX = h.x;
  DRAG.p = clamp01((S.PW - h.x) / (2 * S.PW)); DRAG.v = 0; kick();
});
const release = () => { if (!DRAG.held) return; DRAG.held = false;
  DRAG.target = (DRAG.p > 0.5 || DRAG.vx < -0.35) && !(DRAG.vx > 0.35) ? 1 : 0; kick(); };
renderer.domElement.addEventListener('pointerup', release); renderer.domElement.addEventListener('pointercancel', release);
window.__drag = () => ({ p: DRAG.p, v: DRAG.v, held: DRAG.held, target: DRAG.target });
