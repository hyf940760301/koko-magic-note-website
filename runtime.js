// 晴窗手账 · 正式运行：流程（合上 → 开场 → 阅读）、输入（鼠标 / 触屏 / 键盘 / 滚轮）、每帧循环
// main.js 负责「书摆成什么样、画一帧」；这里负责「现在该是什么样、下一帧往哪动」。
// 所有弹簧质量为 1，参数取自方案「动效语言」表。
import * as THREE from './vendor/three/three.module.js';

const SPRING = {
  turn: { k: 24, c: 7.8 },        // 翻页落位（松手、点击、键盘）：一页大约一秒，像手翻一张纸
  turnFast: { k: 90, c: 16 },     // 连续快翻时，上一页加速落位
  hover: { k: 300, c: 18 },       // 悬停微反馈（扣子放大、书角翘起）
};
const TURN = { edge: 3.5, corner: 3.2, flick: 1.2, kick: 0.45, peek: 0.12, limit: 0.17, clickMs: 250, clickPx: 6 };
const UP = new THREE.Vector3(0, 1, 0);

export function startRuntime(E) {
  const { S, TL, canvas } = E;
  const OPEN_FROM = 550;                 // 点下去后从时间线的这一刻起播：先看到扣子被按下再弹开，不干等
  const OPEN_END = TL.sigEnd + 300;      // 签名写完稍停就可以翻页（纸偶站起来的那一秒留给后面做）
  let mode = 'cover', modeT = 0, time = 0, last = performance.now(), timeScale = 1;
  let spread = 0, turn = null, queue = [], turnedOnce = false, idleT = 0, hints = 0;
  const ptr = { x: 0, y: 0, cx: -1, cy: -1, inside: false };   // x、y：-1..1；cx、cy：屏幕坐标
  const par = { x: 0, y: 0 };                                  // 首屏指针视差（慢半拍）
  const clasp = { s: 1, sv: 0, lift: 0, lv: 0, nextWiggle: 4.5, hover: false };
  const open = { ms: 0, speed: 1, from: null };
  const stat = { dt: 16.7, slow: 0, frames: 0, cpu: 0, cpuMax: 0 };
  let shadowHold = 3;                    // 进入新状态后的头几帧一定重画影子图

  // ---------- 小工具 ----------
  const smooth = (t) => { t = E.clamp01(t); return t * t * (3 - 2 * t); };
  function stepSpring(o, key, vkey, target, sp, dt) { // 固定步长积分，帧率高低手感一致
    let n = Math.max(1, Math.ceil(dt / (1 / 240))); const h = dt / n;
    while (n--) { const a = -sp.k * (o[key] - target) - sp.c * o[vkey]; o[vkey] += a * h; o[key] += o[vkey] * h; }
  }
  // 首屏待机时镜头极轻微地呼吸（俯仰 ±0.12°、9 秒一周）；不跟鼠标，阅读时镜头完全不动
  function sway(pose) {
    const dir = pose.target.clone().sub(pose.pos); const d = dir.length(); dir.normalize();
    const right = new THREE.Vector3().crossVectors(dir, UP).normalize(), up = new THREE.Vector3().crossVectors(right, dir);
    return { pos: pose.pos.clone().addScaledVector(up, d * (0.12 * Math.PI / 180) * Math.sin(time * 2 * Math.PI / 9)), target: pose.target, fov: pose.fov };
  }
  const setCursor = (c) => { if (canvas.style.cursor !== c) canvas.style.cursor = c; };

  // ---------- 合上（首屏） ----------
  function enterCover() { clearPops(); mode = 'cover'; modeT = 0; turn = null; queue = []; E.poseCover(); shadowHold = 3; }
  function coverPose() { const C = E.camPoses(); return E.lerpPose(C.est0, C.est1, smooth((modeT - 0.6) / 9)); }
  function frameCover(dt) {
    clasp.hover = ptr.inside && E.hitBook(ptr.cx, ptr.cy); setCursor(clasp.hover ? 'pointer' : 'default');
    stepSpring(clasp, 's', 'sv', clasp.hover ? 1.04 : 1, SPRING.hover, dt);
    // 每隔几秒搭扣自己轻轻翘一下，提示可以点
    if (modeT > clasp.nextWiggle) { clasp.lv = 2.4; clasp.nextWiggle = modeT + 5.5; }
    stepSpring(clasp, 'lift', 'lv', 0, { k: 300, c: 20 }, dt); if (clasp.lift < 0) { clasp.lift = 0; clasp.lv = Math.abs(clasp.lv) * 0.3; }
    const moving = Math.abs(clasp.lift) > 1e-4 || Math.abs(clasp.lv) > 1e-3;
    E.claspLift(clasp.lift); E.claspBtn(clasp.s, 0); E.setRead(0);
    E.setCam(sway(coverPose()), new THREE.Vector3(S.CW / 2, 2.5, 0));
    return { dust: 1, shadows: moving };
  }
  function startOpening() {
    if (mode !== 'cover') return;
    open.from = sway(coverPose()); open.ms = OPEN_FROM; open.speed = 1; mode = 'opening'; modeT = 0; setCursor('default');
  }
  function skipOpening() { if (mode === 'opening' && open.speed === 1) open.speed = Math.max(1, (OPEN_END - open.ms) / 300); }
  function frameOpening(dt) {
    open.ms = Math.min(OPEN_END, open.ms + dt * 1000 * open.speed);
    E.poseOpening(open.ms);
    const u = E.clamp01((open.ms - OPEN_FROM) / (TL.popStart - OPEN_FROM)); E.claspBtn(1 + (clasp.s - 1) * (1 - u), 0.03 * Math.sin(Math.PI * u));
    const t = E.ease((open.ms - TL.camStart) / (TL.camEnd - TL.camStart)); const C = E.camPoses();
    E.setCam(E.lerpPose(open.from, C.read, t), new THREE.Vector3(S.CW / 2 * (1 - t), 2.5 - 0.5 * t, 0));
    E.setRead(t);
    if (open.ms >= OPEN_END) enterRead(0);
    return { dust: 1 - t, shadows: true };
  }

  // ---------- 阅读与翻页 ----------
  function enterRead(s) { E.setRead(1); mode = 'read'; modeT = 0; spread = s; turn = null; queue = []; idleT = 0; E.poseSpread(s); shadowHold = 3; }
  // 翻页区：页面外侧 3.5 厘米的整条，或书口两角半径 4.5 的四分之一圆；返回 { side: 1 右页 / -1 左页, corner, x }
  function zoneAt(cx, cy) {
    const Y = E.pageY(spread);
    for (const side of [1, -1]) {
      const h = E.hitPlane(cx, cy, side > 0 ? Y.r : Y.l); if (!h) continue;
      const x = h.x * side, z = h.z;                           // x：离书脊的距离
      if (x < 0 || x > S.PW + 1.0 || Math.abs(z) > S.PH / 2 + 0.8) continue;
      const dc = Math.hypot(S.PW - x, S.PH / 2 - Math.abs(z));
      const inCorner = dc < TURN.corner, inEdge = x > S.PW - TURN.edge;
      if (inCorner || inEdge) return { side, corner: z > 0 ? 1 : -1, x, inCorner };
    }
    return null;
  }
  const leafFor = (side) => (side > 0 ? spread : spread - 1);
  const canGrab = (side) => (side > 0 ? spread < E.spreads : spread > 0);
  function beginTurn(leaf, p0, corner = 1) {
    clearPops(); E.beginTurn(leaf);
    turn = { leaf, p: p0, v: 0, target: p0, corner, held: false, peek: false, fast: false, g: S.PW, pT: p0, vp: 0, lift: 0, bounce: null,
      limit: E.canTurn(leaf) ? 1 : TURN.limit };            // 最后一张后面还没内容：只能掀起一点，松手落回
    idleT = 0;
  }
  function commitTurn() {
    const s = turn.target >= 0.5 ? turn.leaf + 1 : turn.leaf; if (s !== spread) turnedOnce = true;
    spread = s; turn = null; E.poseSpread(s); shadowHold = 3;
    if (queue.length) { const d = queue.shift(); requestTurn(d); }
  }
  // 键盘 / 滚轮 / 轻点：自动翻一页（dir：1 往后，-1 往前）
  function requestTurn(dir) {
    if (mode !== 'read') return;
    if (turn && !turn.peek) { if (queue.length < 2 && !turn.held) { queue.push(dir); turn.fast = true; } return; }
    const leaf = dir > 0 ? spread : spread - 1; if (leaf < 0) return;
    if (turn && turn.leaf !== leaf) { turn.target = turn.p < 0.5 ? 0 : 1; commitTurn(); }
    if (!turn) beginTurn(leaf, dir > 0 ? 0 : 1);
    turn.peek = false; turn.held = false; turn.auto = null;
    if (turn.limit < 1) { turn.target = 0; turn.v = 1.6; }                 // 到头了：掀一下落回
    else { turn.target = dir > 0 ? 1 : 0; turn.v = dir * TURN.kick; }
  }
  function pointerP(cx, cy) { // 指针 → 翻页进度：被捏住的那一点跟着手指走（离书脊 g 的点绕书脊转过去）
    const Y = E.pageY(turn.leaf); const h = E.hitPlane(cx, cy, (Y.r + Y.l) / 2 + 0.4); if (!h) return turn.pT;
    return Math.acos(Math.min(1, Math.max(-1, h.x / turn.g))) / Math.PI;
  }
  function frameRead(dt) {
    let shadows = false; idleT += dt;
    // 没翻过页之前，隔一会儿右下角自己翘一下，提示这里可以翻
    if (!turn && !turnedOnce && hints < 2 && idleT > 3 && !down.active && !hoverP && !fly) { hints++; beginTurn(spread, 0, 1); turn.peek = true; turn.auto = 0.9; turn.target = TURN.peek; }
    if (turn) {
      const T = turn; shadows = true;
      if (T.auto != null) { T.auto -= dt; if (T.auto <= 0) { T.auto = null; T.target = 0; idleT = -3.5; } }
      if (T.held) {
        const p0 = T.p; T.p += (Math.min(T.pT, T.limit + 0.02) - T.p) * (1 - Math.exp(-dt * 40));
        T.vp = 0.6 * T.vp + 0.4 * ((T.p - p0) / Math.max(dt, 1e-3)); T.v = 0;
      } else {
        const sp = T.peek ? SPRING.hover : T.fast ? SPRING.turnFast : SPRING.turn;
        let n = Math.max(1, Math.ceil(dt / (1 / 240))); const h = dt / n;
        while (n--) {
          const a = -sp.k * (T.p - T.target) - sp.c * T.v; T.v += a * h; T.p += T.v * h;
          // 过冲不让纸穿进另一叠：转成纸面上一下 0.15 厘米以内的轻弹
          if (T.p < 0 || T.p > 1) { const hit = Math.abs(T.v); T.p = T.p < 0 ? 0 : 1; T.v = 0; if (hit > 0.25 && !T.bounce) T.bounce = { t: 0, amp: Math.min(0.15, 0.045 * hit) }; }
        }
        if (T.bounce) { T.bounce.t += dt; const u = T.bounce.t / 0.2; T.lift = u < 1 ? T.bounce.amp * Math.sin(Math.PI * u) : 0; if (u >= 1) T.bounce.done = true; }
        const settled = Math.abs(T.p - T.target) < 0.0015 && Math.abs(T.v) < 0.02 && (!T.bounce || T.bounce.done);
        if (settled && (T.target === 0 || T.target === 1)) { commitTurn(); return { dust: 0, shadows: true }; }
      }
      E.updateTurn(T.leaf, T.p, T.corner, T.lift);
    }
    if (stepPops(dt)) shadows = true;
    E.setCam(dbgCam || E.camPoses().read, new THREE.Vector3(0, 2, 0));
    return { dust: 0, shadows };
  }
  let dbgCam = null;

  // ---------- 页面上的小东西：指到会微微抬起，点一下弹一下；海报和 Koko 贴纸点了飞出来放大看 ----------
  const pops = new Map(); let hoverP = null;      // 贴片 → { key, v, vel, target, tilt, tv }
  function popOf(pk) { let o = pops.get(pk.P); if (!o) { o = { key: pk.key, P: pk.P, v: 0, vel: 0, target: 0, tilt: 0, tv: 0 }; pops.set(pk.P, o); } return o; }
  function setHover(pk) {
    const P = pk ? (pk.P.on || pk.P) : null; if (P === hoverP) return;
    if (hoverP && pops.get(hoverP)) pops.get(hoverP).target = 0;
    hoverP = P; if (pk) popOf({ key: pk.key, P }).target = 0.07;
  }
  function pokeItem(pk) { const o = popOf({ key: pk.key, P: pk.P.on || pk.P }); o.vel += 3.2; o.tv += (Math.random() < 0.5 ? -1 : 1) * 5; }
  function stepPops(dt) {
    let any = false;
    for (const o of pops.values()) {
      const v0 = o.v, t0 = o.tilt;
      stepSpring(o, 'v', 'vel', o.target, { k: 210, c: 15 }, dt); if (o.v < 0) { o.v = 0; o.vel = Math.abs(o.vel) * 0.25; }
      stepSpring(o, 'tilt', 'tv', 0, { k: 160, c: 9 }, dt);
      if (Math.abs(o.v - v0) > 1e-5 || Math.abs(o.tilt - t0) > 1e-4) { E.pop(o.key, o.P, o.v, o.tilt); any = true; }
      else if (o.target === 0 && o.v < 1e-4 && Math.abs(o.vel) < 1e-3) { E.pop(o.key, o.P, 0, 0); pops.delete(o.P); any = true; }
    }
    return any;
  }
  function clearPops() { for (const o of pops.values()) E.pop(o.key, o.P, 0, 0); pops.clear(); hoverP = null; }
  // 放大看：一张普通图片从它在书页上的位置飞到屏幕中间，再点一下飞回去
  let fly = null;
  function openFly(pk) {
    if (fly) return; const q = E.screenQuad(pk.key, pk.P);
    const w = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]), h = Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1]);
    const cx = (q[0][0] + q[2][0]) / 2, cy = (q[0][1] + q[2][1]) / 2, ang = Math.atan2(q[1][1] - q[0][1], q[1][0] - q[0][0]);
    const veil = document.createElement('div'); veil.id = 'veil'; const img = new Image(); img.id = 'fly'; img.src = pk.fly; img.draggable = false;
    img.style.width = w + 'px'; img.style.height = h + 'px';
    const from = `translate(${cx - w / 2}px, ${cy - h / 2}px) rotate(${ang}rad) scale(1)`;
    const k = Math.min(innerHeight * 0.86 / h, innerWidth * 0.9 / w);
    const to = `translate(${innerWidth / 2 - w / 2}px, ${innerHeight / 2 - h / 2}px) rotate(0rad) scale(${k})`;
    img.style.transform = from; document.body.append(veil, img); setHover(null); setCursor('default');
    fly = { veil, img, from, closing: false };
    const start = () => requestAnimationFrame(() => requestAnimationFrame(() => { veil.classList.add('on'); img.style.transform = to; }));
    if (img.complete) start(); else img.onload = start;
    veil.addEventListener('pointerdown', closeFly); img.addEventListener('pointerdown', closeFly);
  }
  function closeFly() {
    if (!fly || fly.closing) return; const f = fly; f.closing = true; f.veil.classList.remove('on'); f.img.style.transform = f.from;
    setTimeout(() => { f.veil.remove(); f.img.remove(); if (fly === f) fly = null; }, 620);
  }

  // ---------- 输入 ----------
  const down = { active: false, id: -1, x: 0, y: 0, t: 0, moved: 0 };
  function setPtr(ev) { const r = canvas.getBoundingClientRect(); ptr.cx = ev.clientX; ptr.cy = ev.clientY; ptr.x = ((ev.clientX - r.left) / r.width) * 2 - 1; ptr.y = -(((ev.clientY - r.top) / r.height) * 2 - 1); ptr.inside = true; }
  canvas.addEventListener('pointerdown', (ev) => {
    setPtr(ev);
    if (mode === 'cover') { if (E.hitBook(ev.clientX, ev.clientY)) startOpening(); return; }
    if (mode === 'opening') { skipOpening(); return; }
    if (turn && !turn.peek) return;                               // 上一页还在落：不接新的拖拽（键盘和滚轮会排队）
    const z = zoneAt(ev.clientX, ev.clientY);
    if (!z || !canGrab(z.side)) { const pk = E.pick(ev.clientX, ev.clientY, spread); if (pk) { idleT = 0; if (pk.fly) openFly(pk); else pokeItem(pk); } return; }
    const leaf = leafFor(z.side);
    if (turn && turn.leaf !== leaf) { turn.target = turn.p < 0.5 ? 0 : 1; commitTurn(); }
    if (!turn) beginTurn(leaf, z.side > 0 ? 0 : 1, z.corner);
    turn.peek = false; turn.auto = null; turn.held = true; turn.corner = z.corner; turn.side = z.side;
    // 捏住的点离书脊的距离：按当前翘起的程度反推，按下的一瞬间纸不跳
    const Y = E.pageY(leaf); const h = E.hitPlane(ev.clientX, ev.clientY, (Y.r + Y.l) / 2 + 0.4);
    const c = Math.cos(Math.PI * turn.p); turn.g = Math.min(S.PW + 1, Math.max(S.PW * 0.5, h && Math.abs(c) > 0.3 ? h.x / c : S.PW));
    turn.pT = turn.p; turn.vp = 0;
    down.active = true; down.id = ev.pointerId; down.x = ev.clientX; down.y = ev.clientY; down.t = performance.now(); down.moved = 0;
    canvas.setPointerCapture(ev.pointerId); setCursor('grabbing'); ev.preventDefault();
  });
  canvas.addEventListener('pointermove', (ev) => {
    setPtr(ev);
    if (mode !== 'read') return;
    if (down.active && turn && turn.held) {
      down.moved = Math.max(down.moved, Math.hypot(ev.clientX - down.x, ev.clientY - down.y));
      turn.pT = pointerP(ev.clientX, ev.clientY); return;
    }
    if (ev.pointerType === 'touch') return;
    // 悬停：指到书角，书角轻轻翘起
    const z = zoneAt(ev.clientX, ev.clientY); const ok = z && canGrab(z.side);
    if (turn && !turn.peek) { setCursor('default'); return; }
    const pk = ok ? null : E.pick(ev.clientX, ev.clientY, spread);
    if (!turn) setHover(pk);
    setCursor(ok ? 'grab' : pk ? (pk.fly ? 'zoom-in' : 'pointer') : 'default');
    if (ok && z.inCorner) {
      const leaf = leafFor(z.side);
      if (turn && turn.leaf !== leaf) { turn.target = turn.p < 0.5 ? 0 : 1; commitTurn(); }
      if (!turn) { beginTurn(leaf, z.side > 0 ? 0 : 1, z.corner); turn.peek = true; }
      turn.auto = null; turn.corner = z.corner; turn.target = z.side > 0 ? Math.min(TURN.peek, turn.limit) : 1 - TURN.peek;
    } else if (turn && turn.peek && turn.auto == null) turn.target = turn.p < 0.5 ? 0 : 1;
  });
  function release(ev) {
    if (!down.active || ev.pointerId !== down.id) return; down.active = false;
    if (!turn || !turn.held) return; const T = turn; T.held = false;
    const click = performance.now() - down.t < TURN.clickMs && down.moved < TURN.clickPx;
    if (T.limit < 1) { T.target = 0; T.v = click ? 1.6 : T.vp; }
    else if (click) { T.target = T.side > 0 ? 1 : 0; T.v = T.side * TURN.kick; }
    else { T.target = T.vp > TURN.flick ? 1 : T.vp < -TURN.flick ? 0 : T.p > 0.5 ? 1 : 0; T.v = Math.max(-6, Math.min(6, T.vp)); }   // 带着松手速度落位
    setCursor('default');
  }
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', () => { ptr.inside = false; setHover(null); if (turn && turn.peek && turn.auto == null) turn.target = turn.p < 0.5 ? 0 : 1; });
  addEventListener('keydown', (ev) => {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const k = ev.key;
    if (fly) { closeFly(); ev.preventDefault(); return; }
    if (mode === 'cover') { if (k === 'Enter' || k === ' ') { startOpening(); ev.preventDefault(); } return; }
    if (mode === 'opening') { skipOpening(); return; }
    if (k === 'ArrowRight' || k === ' ' || k === 'PageDown') { requestTurn(1); ev.preventDefault(); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { requestTurn(-1); ev.preventDefault(); }
  });
  // 滚轮 / 触控板：一次滑动翻一页（滑动停下 180 毫秒后才算下一次）
  const wheel = { acc: 0, fired: false, timer: 0 };
  addEventListener('wheel', (ev) => {
    if (mode !== 'read' || fly) return; ev.preventDefault();
    const d = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY; wheel.acc += d;
    if (!wheel.fired && Math.abs(wheel.acc) > 40) { wheel.fired = true; requestTurn(wheel.acc > 0 ? 1 : -1); }
    clearTimeout(wheel.timer); wheel.timer = setTimeout(() => { wheel.acc = 0; wheel.fired = false; }, 180);
  }, { passive: false });
  addEventListener('resize', () => { E.resize(); shadowHold = 3; if (fly) { fly.veil.remove(); fly.img.remove(); fly = null; } });

  // ---------- 每帧 ----------
  function frame(now) {
    requestAnimationFrame(frame);
    const raw = (now - last) / 1000; last = now; const dt = Math.min(0.05, Math.max(0.001, raw)) * timeScale; time += dt; modeT += dt;
    const c0 = performance.now();
    const r = mode === 'cover' ? frameCover(dt) : mode === 'opening' ? frameOpening(dt) : frameRead(dt);
    const sh = r.shadows || shadowHold > 0; if (shadowHold > 0) shadowHold--;
    E.render(12 + time, { dust: r.dust, shadows: sh });
    const cpu = performance.now() - c0; stat.cpu = 0.9 * stat.cpu + 0.1 * cpu; if (cpu > stat.cpuMax) stat.cpuMax = cpu;
    // 自动降档：连续掉帧（平均一帧超过 20 毫秒）就把渲染分辨率降一档，最低 60%；不自动升回去，避免来回跳
    stat.frames++; if (raw < 0.25) stat.dt = 0.93 * stat.dt + 0.07 * raw * 1000;
    if (stat.frames > 90 && stat.dt > 20) { stat.slow++; if (stat.slow > 45 && E.quality.scale > 0.6) { E.quality.scale = Math.max(0.6, E.quality.scale - 0.1); stat.slow = 0; stat.frames = 30; } } else stat.slow = 0;
  }
  E.resize(); enterCover(); requestAnimationFrame((t) => { last = t; frame(t); });

  // 调试 / 自测接口
  return {
    get mode() { return mode; }, get spread() { return spread; }, get turn() { return turn ? { leaf: turn.leaf, p: +turn.p.toFixed(3), target: turn.target, held: turn.held, peek: turn.peek } : null; },
    open: startOpening, skip: skipOpening, turnPage: requestTurn,
    goto(s) { enterRead(Math.max(0, Math.min(E.spreads - 1, s))); turnedOnce = true; },
    close: enterCover,
    stats: () => { const r = { frameMs: +stat.dt.toFixed(1), cpuMs: +stat.cpu.toFixed(2), cpuMaxMs: +stat.cpuMax.toFixed(1), scale: E.quality.scale, size: E.renderSize(), mode, spread, openMs: Math.round(open.ms) }; stat.cpuMax = 0; return r; },
    // 自测：把某一张纸停在翻到 p 的位置（leaf 传 null 放下）；cam 传 [位置, 目标, 视角] 临时换机位（传 null 还原）
    hold(leaf, p = 0.5, corner = 1) { if (mode !== 'read') return; if (turn) { turn.target = turn.p < 0.5 ? 0 : 1; commitTurn(); } if (leaf == null) return; beginTurn(leaf, p, corner); turn.held = true; turn.pT = p; turnedOnce = true; },
    cam(c) { dbgCam = c ? { pos: new THREE.Vector3(...c[0]), target: new THREE.Vector3(...c[1]), fov: c[2] || 28 } : null; },
    get fly() { return !!fly; }, get pops() { return pops.size; },
    slow(k) { timeScale = k; },                                   // 慢放（自测截图用）
    bench(n = 40) { // 当前画面连画 n 帧、每帧等显卡画完：得到「一帧真实要花多久」（含重画影子图，最坏情况）
      const gl = E.gl(), px = new Uint8Array(4), ts = [];
      for (let i = 0; i < n; i++) { const t0 = performance.now(); E.render(12 + time + i * 0.016, { dust: mode === 'cover' ? 1 : 0, shadows: true }); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); ts.push(performance.now() - t0); }
      ts.sort((a, b) => a - b); return { median: +ts[n >> 1].toFixed(1), p90: +ts[Math.floor(n * 0.9)].toFixed(1) };
    },
  };
}
