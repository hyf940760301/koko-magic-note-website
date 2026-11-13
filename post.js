// 晴窗手账 · 后期（景深 + 窗光光束 + 远处暖雾 + 边缘抗锯齿）
// 画面与原先的单张全屏片元一致，但把贵的两项挪到小画布上算：
//   光束：四分之一分辨率（原先每个像素沿视线走 18 步，占一帧六成时间）
//   景深：二分之一分辨率，只在失焦的地方混进来
// 场景缓冲的 alpha 仍然存「到相机的距离」，负值 = 海报像素（永远清晰、不加光束和雾）。
export function createPost({ THREE, renderer, GLSL_COMMON, shared, col, POST }) {
  const VS = `varying vec2 vUv; varying vec3 vWP; varying vec3 vWN; void main(){ vUv = uv; vWP = vec3(0.0); vWN = vec3(0.0,1.0,0.0); gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null); quad.frustumCulled = false;
  const sc = new THREE.Scene(); sc.add(quad);
  const COC = /* glsl */`float coc(float d){ d = max(abs(d), 1.0); return uDof * clamp(uK * max(abs(d - uFocus) - uRange, 0.0) / d, 0.0, uMaxR); }`;
  const U = { // 三个通道共用
    tC: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uFocus: { value: 60 }, uRange: { value: POST.focusR }, uK: { value: 30 }, uMaxR: { value: 12 }, uDof: { value: 1 },
    uInvProj: { value: new THREE.Matrix4() }, uCamW: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() },
  };

  // ---- 光束：沿视线走 18 步，查窗格光斑；小画布上算，合成时再放大 ----
  const shaftMat = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, vertexShader: VS,
    uniforms: Object.assign({}, U, shared),
    fragmentShader: GLSL_COMMON + /* glsl */`
uniform sampler2D tC; uniform mat4 uInvProj, uCamW; uniform vec3 uCamPos; varying vec2 vUv;
void main(){
  float ad = abs(texture2D(tC, vUv).a);
  vec2 ndc = vUv*2.0 - 1.0; vec4 v = uInvProj * vec4(ndc, 1.0, 1.0); v /= v.w;
  vec3 dir = normalize((uCamW * vec4(v.xyz, 0.0)).xyz);
  float L = min(ad, 700.0);
  float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  const int N = 18; float st = L / float(N); float acc = 0.0;
  for(int i=0;i<N;i++){
    vec3 p = uCamPos + dir * (st * (float(i) + n));
    if(p.z < uWinP.x) break;
    float dens = smoothstep(14.0, 48.0, p.y) * (1.0 - smoothstep(150.0, 175.0, p.y));
    if(dens > 0.0) acc += windowCookie(p) * dens * st;
  }
  gl_FragColor = vec4(acc, 0.0, 0.0, 1.0);
}` });

  // ---- 景深：半分辨率，32 次螺旋采样（与原先同一套权重：清晰的前景不会被晕开）----
  const dofMat = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    uniforms: U,
    fragmentShader: /* glsl */`
uniform sampler2D tC; uniform vec2 uRes; uniform float uFocus, uRange, uK, uMaxR, uDof; varying vec2 vUv;
${COC}
void main(){
  vec4 c0 = texture2D(tC, vUv); vec2 px = 1.0/uRes;
  float r = c0.a < 0.0 ? 0.0 : coc(c0.a);
  vec3 acc = c0.rgb; float ws = 1.0;
  if(r > 0.5){
    for(int i=0;i<32;i++){
      float fi = float(i) + 0.5; float rr = sqrt(fi/32.0) * r; float a = fi * 2.39996;
      vec4 sm = texture2D(tC, vUv + vec2(cos(a), sin(a)) * rr * px);
      float sr = sm.a < 0.0 ? 0.0 : coc(sm.a);
      float w = smoothstep(rr - 1.5, rr + 0.5, sr);
      acc += sm.rgb * w; ws += w;
    }
  }
  gl_FragColor = vec4(acc / ws, 1.0);
}` });

  // ---- 合成：抗锯齿 → 混入景深 → 加光束和暖雾 → 输出 ----
  const outMat = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    uniforms: Object.assign({}, U, { tD: { value: null }, tS: { value: null }, uResS: { value: new THREE.Vector2(1, 1) }, uFxaa: { value: 0 },
      uShaft: { value: POST.shaft }, uShaftC: { value: col(0xFFF0D2) }, uHaze: { value: POST.haze }, uHazeC: { value: col(0xFFEEDB) } }),
    fragmentShader: /* glsl */`
uniform sampler2D tC, tD, tS; uniform vec2 uRes, uResS; uniform float uFocus, uRange, uK, uMaxR, uDof, uShaft, uHaze, uFxaa;
uniform vec3 uShaftC, uHazeC; varying vec2 vUv;
${COC}
float luma(vec3 c){ return sqrt(dot(c, vec3(0.299, 0.587, 0.114))); }
void main(){
  vec4 c0 = texture2D(tC, vUv);
  vec2 px = 1.0/uRes;
  vec4 cN = texture2D(tC, vUv+vec2(0.0,px.y)), cS = texture2D(tC, vUv-vec2(0.0,px.y)), cE = texture2D(tC, vUv+vec2(px.x,0.0)), cW = texture2D(tC, vUv-vec2(px.x,0.0));
  // 海报像素（alpha 为负）及其 1 像素邻域：永远清晰、不加光束和雾，保证色准
  bool poster = c0.a < 0.0 || min(min(cN.a, cS.a), min(cE.a, cW.a)) < 0.0;
  float ad = abs(c0.a);
  vec3 col = c0.rgb;
  if(uFxaa > 0.5 && !poster){
    // 修轮廓锯齿：沿着边的方向取样混合（越接近水平/竖直的边取得越远）；对比不够的地方（纸面、色块内部）原样通过
    float lM = luma(c0.rgb), lN = luma(cN.rgb), lS = luma(cS.rgb), lE = luma(cE.rgb), lW = luma(cW.rgb);
    float lMin = min(lM, min(min(lN, lS), min(lE, lW))), lMax = max(lM, max(max(lN, lS), max(lE, lW)));
    if(lMax - lMin > max(0.03, lMax * 0.10)){
      vec2 dir = vec2(-(lN - lS), lE - lW);               // 垂直于亮度梯度 = 沿着边
      float red = max((lN + lS + lE + lW) * 0.03125, 0.0078125);
      dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + red), -4.0, 4.0) * px;
      vec3 a = 0.5 * (texture2D(tC, vUv + dir * (1.0/3.0 - 0.5)).rgb + texture2D(tC, vUv + dir * (2.0/3.0 - 0.5)).rgb);
      vec3 b = 0.5 * a + 0.25 * (texture2D(tC, vUv - dir * 0.5).rgb + texture2D(tC, vUv + dir * 0.5).rgb);
      float lb = luma(b);
      col = (lb < lMin || lb > lMax) ? a : b;
    }
  }
  float r = poster ? 0.0 : coc(ad);
  if(r > 0.5) col = mix(col, texture2D(tD, vUv).rgb, smoothstep(0.5, 2.5, r));
  if(!poster){
    vec2 ps = 1.0/uResS;
    float sh = texture2D(tS, vUv).r * 0.4 + 0.15 * (texture2D(tS, vUv + vec2(ps.x, 0.0)).r + texture2D(tS, vUv - vec2(ps.x, 0.0)).r + texture2D(tS, vUv + vec2(0.0, ps.y)).r + texture2D(tS, vUv - vec2(0.0, ps.y)).r);
    col += uShaftC * sh * uShaft;
    col = mix(col, uHazeC, smoothstep(160.0, 480.0, ad) * uHaze);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}` });

  let sceneRT = null, dofRT = null, shaftRT = null, key = '';
  const cfg = { samples: 4, fxaa: false, scale: 1, dof: 1, shaft: POST.shaft };
  function ensure() {
    const cw = renderer.domElement.width, ch = renderer.domElement.height;
    const w = Math.max(2, Math.round(cw * cfg.scale)), h = Math.max(2, Math.round(ch * cfg.scale));
    const k = w + 'x' + h + 's' + cfg.samples; if (k === key) return; key = k;
    for (const rt of [sceneRT, dofRT, shaftRT]) if (rt) rt.dispose();
    sceneRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: cfg.samples });
    dofRT = new THREE.WebGLRenderTarget(Math.ceil(w / 2), Math.ceil(h / 2), { type: THREE.HalfFloatType, depthBuffer: false });
    shaftRT = new THREE.WebGLRenderTarget(Math.ceil(w / 4), Math.ceil(h / 4), { type: THREE.HalfFloatType, depthBuffer: false });
  }
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(sc, cam); };
  function render(scene, camera, focusPoint, clear) {
    ensure();
    const w = sceneRT.width, h = sceneRT.height;
    camera.updateMatrixWorld();
    renderer.setRenderTarget(sceneRT); renderer.setClearColor(clear, 1); renderer.clear(); renderer.render(scene, camera);
    const tris = renderer.info.render.triangles, calls = renderer.info.render.calls;
    U.tC.value = sceneRT.texture; U.uRes.value.set(w, h);
    U.uFocus.value = camera.position.distanceTo(focusPoint); U.uK.value = POST.k * h; U.uMaxR.value = POST.maxR * h; U.uDof.value = cfg.dof;
    U.uInvProj.value.copy(camera.projectionMatrixInverse); U.uCamW.value.copy(camera.matrixWorld); U.uCamPos.value.copy(camera.position);
    const o = outMat.uniforms;
    if (cfg.shaft > 0) pass(shaftMat, shaftRT);
    if (cfg.dof > 0) pass(dofMat, dofRT);
    o.tD.value = dofRT.texture; o.tS.value = shaftRT.texture; o.uResS.value.set(shaftRT.width, shaftRT.height);
    o.uShaft.value = cfg.shaft; o.uFxaa.value = cfg.fxaa ? 1 : 0;
    pass(outMat, null);
    return { tris, calls };
  }
  return { render, cfg, size: () => (sceneRT ? [sceneRT.width, sceneRT.height] : [0, 0]) };
}
