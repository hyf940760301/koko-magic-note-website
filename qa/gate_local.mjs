// 交付前必跑的检查（工程 + 画面）。用法：bash qa/gate.sh   结果：qa/gate_report.json + shots/G_*.png
// 每一项都是「通过 / 不通过」，不通过就不交付；测不了的项写明「未覆盖」，不算通过。
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('/Users/huyifan/Desktop/DeepSeek Harness/tools/voc-crawler/package.json');
const { chromium } = require('playwright');
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const URL = 'http://127.0.0.1:8942/index.html';
const results = []; const shots = [];
const check = (group, name, ok, detail = '') => { results.push({ group, name, ok: !!ok, detail: String(detail) }); console.log((ok ? '  通过  ' : '  不通过 ') + group + ' · ' + name + (detail ? '  — ' + detail : '')); };
const launch = () => chromium.launch({ headless: true, executablePath: exe, args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] });
let browser = await launch();
setTimeout(() => { console.log('超时，强制结束');
  fs.writeFileSync('qa/gate_report.json', JSON.stringify({ results, shots, timeout: true }, null, 1)); process.exit(2); }, 420000);

async function session(tag, W, H, dpr, fn, touch = false) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr, hasTouch: touch });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push('脚本报错 ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text().slice(0, 200)); });
  page.on('response', (r) => { if (r.status() >= 400) errs.push('HTTP ' + r.status() + ' ' + r.url()); });
  const T = {
    page, W, H, tag, errs,
    wait: (ms) => page.waitForTimeout(ms),
    app: (fn, ...a) => page.evaluate(([fn, a]) => window.__app[fn](...a), [fn, a]),
    get: (k) => page.evaluate((k) => window.__app[k], k),
    shot: async (n, group = 'flow') => { const f = `shots/G_${tag}_${n}.png`; await page.screenshot({ path: f }); shots.push({ f, group, tag, n }); },
    scr: (x, y, z) => page.evaluate(([x, y, z]) => { const p = window.__proj([[x, y, z]])[0]; return [(p[0] * 0.5 + 0.5) * innerWidth, (1 - (p[1] * 0.5 + 0.5)) * innerHeight]; }, [x, y, z]),
    ndc: (pts) => page.evaluate((pts) => window.__proj(pts), pts),
    pv: () => page.evaluate(() => window.__pv().map((v) => +v.toFixed(4)).join(',')),
    quad: (k, id) => page.evaluate(([k, id]) => { const q = window.__eng.screenQuad(k, window.__eng.patch(k, id)); return [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2]; }, [k, id]),
    rec: () => page.evaluate(() => { window.__rec = []; let l = performance.now(); const f = (t) => { if (!window.__rec) return; window.__rec.push(t - l); l = t; requestAnimationFrame(f); }; requestAnimationFrame(f); }),
    stop: () => page.evaluate(() => { const a = window.__rec.slice(2); window.__rec = null; const s = a.slice().sort((x, y) => x - y); return { fps: +(1000 / (a.reduce((u, v) => u + v, 0) / a.length)).toFixed(1), worst: +s[s.length - 1].toFixed(0), over34: a.filter((v) => v > 34).length, n: a.length }; }),
    waitTurn: async (max = 5000) => { const t = Date.now(); while (Date.now() - t < max) { await page.waitForTimeout(50); if (!(await page.evaluate(() => window.__app.turn))) return Date.now() - t; } return -1; },
  };
  const t0 = Date.now(); await page.goto(URL); await page.waitForFunction('window.__ready === true', null, { timeout: 120000 }); T.loadMs = Date.now() - t0;
  try { await fn(T); } catch (e) { check(tag, '脚本跑完', false, e.message.slice(0, 200)); }
  check(tag, '全程没有报错、警告、加载失败', errs.length === 0, errs.length ? [...new Set(errs)].slice(0, 3).join(' | ') + `（共 ${errs.length} 条）` : '');
  await ctx.close();
}
const toRead = async (T, s = 0) => { await T.app('open'); await T.wait(200); await T.app('skip'); await T.wait(700); if (s) { await T.app('goto', s); await T.wait(500); } await T.page.mouse.move(T.W / 2, 4); };

if (!process.env.GATE_PART || process.env.GATE_PART === 'perf') {
// ============ B. 流畅度（这台 Mac 全屏） ============
await session('perf', 1728, 1117, 2, async (T) => {
  const G = 'B 流畅度'; const ok = (r) => r.fps >= 57 && r.over34 <= 2 && r.worst <= 70; const d = (r) => `${r.fps} 帧，最慢一帧 ${r.worst} 毫秒，掉帧 ${r.over34} 次 / ${r.n} 帧`;
  await T.wait(1200); await T.rec(); await T.wait(3000); let r = await T.stop(); check(G, '首屏', ok(r), d(r));
  const [bx, by] = await T.scr(7.5, 3, 0); await T.page.mouse.click(bx, by); await T.rec(); await T.wait(5000); r = await T.stop(); check(G, '开场', ok(r), d(r));
  await T.page.mouse.move(T.W / 2, 4); await T.wait(600); await T.rec(); for (const k of ['ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowLeft']) { await T.page.keyboard.press(k); await T.wait(1800); } r = await T.stop(); check(G, '键盘翻页 4 次', ok(r), d(r));
  await T.app('goto', 1); await T.wait(600); const a = await T.scr(13.6, 1.8, 8.5), b = await T.scr(-12, 1.8, 6);
  await T.rec(); await T.page.mouse.move(a[0], a[1]); await T.page.mouse.down(); for (let i = 1; i <= 60; i++) { await T.page.mouse.move(a[0] + (b[0] - a[0]) * i / 60, a[1] + (b[1] - a[1]) * i / 60); await T.wait(16); } await T.page.mouse.up(); await T.wait(1500); r = await T.stop(); check(G, '拖拽翻页', ok(r), d(r));
  await T.app('goto', 1); await T.wait(500); await T.rec(); for (let i = 0; i < 80; i++) { await T.page.mouse.move(300 + (i * 37) % (T.W - 600), 250 + (i * 53) % (T.H - 500)); await T.wait(25); } r = await T.stop(); check(G, '鼠标在页面上扫动（贴片抬起落下）', ok(r), d(r));
  const st = await T.app('stats'); check(G, '全程没有被迫继续降低清晰度', st.scale >= 0.75, '档位 ' + st.scale + '，渲染 ' + st.size.join('×'));
});

await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 4000))]); browser = await launch();   // 流畅度独占一个干净的浏览器，测完换新的

}
if (!process.env.GATE_PART || process.env.GATE_PART === 'main') {
// ============ A. 主流程（笔记本常见窗口，视网膜） ============
await session('main', 1440, 900, 2, async (T) => {
  const G = 'A 主流程';
  check(G, '加载在 6 秒内完成', T.loadMs < 6000, T.loadMs + ' 毫秒');
  await T.wait(900); check(G, '加载页已经撤掉', await T.page.evaluate(() => !document.getElementById('loading') || getComputedStyle(document.getElementById('loading')).opacity === '0'));
  await T.shot('cover'); check(G, '首屏是合上的书', (await T.get('mode')) === 'cover');
  // 首屏：鼠标乱动，镜头不该跟着跑（只允许待机的轻微呼吸）
  // 点书以外的地方不该开场
  await T.page.mouse.click(30, 30); await T.wait(200); check(G, '点书以外的地方不会开场', (await T.get('mode')) === 'cover');
  const [bx, by] = await T.scr(7.5, 3, 0); await T.page.mouse.click(bx, by);
  for (let i = 0; i < 14; i++) { await T.wait(360); await T.shot('open' + String(i).padStart(2, '0'), 'opening'); }
  await T.wait(600); check(G, '开场播完停在扉页', (await T.get('mode')) === 'read' && (await T.get('spread')) === 0);
  await T.shot('title', 'read');
  // 镜头稳定
  const p0 = await T.pv(); for (let i = 0; i < 25; i++) { await T.page.mouse.move(60 + Math.random() * (T.W - 120), 60 + Math.random() * (T.H - 120)); await T.wait(40); } await T.wait(1200);
  check(G, '阅读时移动鼠标镜头不动', p0 === (await T.pv()));
  await T.page.mouse.move(T.W / 2, 4); await T.wait(900);
  // 键盘翻页：只翻一页、用时合理、中途镜头不动
  const tk = Date.now(); await T.page.keyboard.press('ArrowRight'); await T.wait(450); const pm = await T.pv(); await T.waitTurn(); const ms = Date.now() - tk;
  await T.page.keyboard.press('ArrowLeft'); await T.waitTurn(); await T.page.keyboard.press('ArrowRight'); await T.wait(500); await T.shot('turnmid', 'turn'); await T.waitTurn();
  check(G, '按一次右键只翻一页', (await T.get('spread')) === 1, '到了第 ' + (await T.get('spread')) + ' 个跨页');
  check(G, '翻一页用时在 0.8–2 秒之间', ms > 800 && ms < 2000, ms + ' 毫秒');
  check(G, '翻页过程中镜头不动', pm === p0);
  await T.shot('spread1', 'read');
  await T.page.keyboard.press('ArrowLeft'); await T.waitTurn(); check(G, '左键翻回上一页', (await T.get('spread')) === 0);
  await T.page.keyboard.press('ArrowLeft'); await T.wait(600); check(G, '第一页再往前翻：不动、不报错', (await T.get('spread')) === 0);
  // 点页边翻页
  const e1 = await T.scr(13.8, 1.8, 0); await T.page.mouse.click(e1[0], e1[1]); await T.waitTurn(); check(G, '点右页外侧翻到下一页', (await T.get('spread')) === 1);
  const e2 = await T.scr(-13.8, 1.8, 0); await T.page.mouse.click(e2[0], e2[1]); await T.waitTurn(); check(G, '点左页外侧翻回上一页', (await T.get('spread')) === 0);
  // 拖拽：没过半松手落回；过半翻过去
  const drag = async (to, steps = 24) => { const a = await T.scr(13.6, 1.8, 8.5), b = await T.scr(to, 1.8, 6); await T.page.mouse.move(a[0], a[1]); await T.page.mouse.down(); for (let i = 1; i <= steps; i++) { await T.page.mouse.move(a[0] + (b[0] - a[0]) * i / steps, a[1] + (b[1] - a[1]) * i / steps); await T.wait(25); } await T.wait(350); };
  await drag(9); const held = await T.get('turn'); await T.shot('draghold', 'turn'); await T.page.mouse.up(); await T.waitTurn();
  check(G, '拖着时纸跟手', held && held.held && held.p > 0.05 && held.p < 0.5, held ? 'p=' + held.p : '没抓住');
  check(G, '拖不到一半松手：落回原页', (await T.get('spread')) === 0);
  await drag(-11); await T.page.mouse.up(); await T.waitTurn(); check(G, '拖过一半松手：翻到下一页', (await T.get('spread')) === 1);
  // 滚轮
  await T.page.mouse.move(T.W / 2, T.H / 2); await T.page.mouse.wheel(0, 120); await T.waitTurn(); check(G, '滚轮一下翻一页', (await T.get('spread')) === 2);
  await T.shot('spread2', 'read');
  // 最后一页
  await T.page.keyboard.press('ArrowRight'); await T.wait(1500); check(G, '最后一页再往后翻：弹回、停在原页', (await T.get('spread')) === 2 && !(await T.get('turn')));
  // 连按：不乱、不卡死
  for (let i = 0; i < 8; i++) { await T.page.keyboard.press('ArrowLeft'); await T.wait(60); } await T.wait(5000);
  check(G, '连按 8 次左键后状态正常', (await T.get('spread')) === 0 && !(await T.get('turn')), '停在第 ' + (await T.get('spread')) + ' 个跨页');
  // 互动
  await T.app('goto', 1); await T.wait(500);
  const tag = await T.quad('snowL', 'tag'); await T.page.mouse.move(tag[0], tag[1]); await T.wait(400);
  check(G, '鼠标指到吊牌：吊牌抬起、光标变手指', (await T.get('pops')) >= 1 && (await T.page.evaluate(() => document.querySelector('canvas').style.cursor)) === 'pointer');
  await T.page.mouse.click(tag[0], tag[1]); await T.wait(120); await T.shot('poke', 'interact'); await T.page.mouse.move(T.W / 2, 4); await T.wait(1200);
  check(G, '鼠标移开后小东西落回', (await T.get('pops')) === 0);
  for (const [k, id, nm] of [['snowL', 'poster', '海报'], ['snowR', 'kokoArt', 'Koko 贴纸']]) {
    const q = await T.quad(k, id); await T.page.mouse.click(q[0], q[1]); await T.wait(900); const on = await T.get('fly'); await T.shot('fly_' + id, 'interact');
    const box = await T.page.evaluate(() => { const r = document.getElementById('fly').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom, innerWidth, innerHeight]; });
    check(G, `点${nm}：飞出放大，完整留在屏幕内`, on && box[0] >= 0 && box[1] >= 0 && box[2] <= box[4] && box[3] <= box[5] && (box[3] - box[1]) > box[5] * 0.6, box.map((v) => Math.round(v)).join(','));
    await T.page.keyboard.press('ArrowRight'); await T.wait(900); check(G, `${nm}放大时按键：只收回、不翻页`, !(await T.get('fly')) && (await T.get('spread')) === 1);
  }
  const q = await T.quad('snowL', 'poster'); await T.page.mouse.click(q[0], q[1]); await T.wait(800); await T.page.mouse.click(40, 40); await T.wait(900); check(G, '放大后点空白处收回', !(await T.get('fly')));
  // 改窗口大小
  await T.page.setViewportSize({ width: 1100, height: 700 }); await T.wait(600); await T.shot('resized', 'read'); await T.page.setViewportSize({ width: 1440, height: 900 }); await T.wait(400);
  // 取景：书的关键点都在画面里
  const kp = await T.ndc([[-15.1, 1.7, -10.6], [-15.1, 1.7, 10.6], [15.1, 1.7, -10.6], [15.1, 1.7, 10.6], [21.5, 0.1, 0], [-16.3, 1, 0]]);
  check('C 画面', '阅读时整本书、搭扣、索引签都在画面内', kp.every((p) => Math.abs(p[0]) < 1 && Math.abs(p[1]) < 1), kp.map((p) => p[0].toFixed(2) + '/' + p[1].toFixed(2)).join(' '));
  const a = await T.scr(2, 1.7, 0), b = await T.scr(2, 1.7, 0.52); check('C 画面', '日记正文一个字不小于 14 像素高', Math.abs(b[1] - a[1]) >= 14, Math.abs(b[1] - a[1]).toFixed(1) + ' 像素');
  await T.app('hold', 1, 0.5); await T.wait(1500); const top = await T.page.evaluate(() => window.__eng.turnBox()); await T.shot('turn50', 'turn'); await T.app('hold', null); await T.wait(900);
  check('C 画面', '翻页时竖起的纸完整留在画面内', top[0] > -1 && top[1] < 1, '纸的画面范围 ' + top.map((v) => v.toFixed(2)).join(' / ') + '（应在 -1 到 1）');
  // 合上再开：开场中途乱点乱按
  await T.app('close'); await T.wait(400); const [cx, cy] = await T.scr(7.5, 3, 0); await T.page.mouse.click(cx, cy); await T.wait(700);
  const t = Date.now(); await T.page.mouse.click(cx, cy); await T.page.keyboard.press('a'); await T.page.mouse.click(200, 200);
  while ((await T.get('mode')) !== 'read' && Date.now() - t < 3000) await T.wait(40);
  check(G, '开场中点一下：半秒内跳到扉页', Date.now() - t < 650 && (await T.get('spread')) === 0, (Date.now() - t) + ' 毫秒');
  await T.wait(1500); check(G, '跳过开场后不会自己多翻页', (await T.get('spread')) === 0);
});

}
if (!process.env.GATE_PART || process.env.GATE_PART === 'sizes') {
// ============ D. 其它窗口尺寸（只查不报错、流程通、取景） ============
for (const [tag, W, H, dpr, touch, nm] of [['small', 1280, 720, 1, false, '小窗口 1280×720'], ['wide', 2560, 1080, 1, false, '超宽屏 2560×1080'], ['phone', 390, 844, 3, true, '手机竖屏 390×844']]) {
  await session(tag, W, H, dpr, async (T) => {
    const G = 'D ' + nm; await T.wait(1200); await T.shot('cover', 'sizes'); await toRead(T, 1); await T.shot('spread1', 'sizes');
    check(G, '能开场并进入阅读', (await T.get('mode')) === 'read');
    await T.app('turnPage', 1); await T.wait(450); await T.shot('turnmid', 'sizes'); await T.waitTurn(); check(G, '能翻页', (await T.get('spread')) === 2);
    const kp = await T.ndc([[-15.1, 1.7, -10.6], [-15.1, 1.7, 10.6], [15.1, 1.7, -10.6], [15.1, 1.7, 10.6]]); check(G, '整本书在画面内', kp.every((p) => Math.abs(p[0]) < 1 && Math.abs(p[1]) < 1));
    const a = await T.scr(2, 1.7, 0), b = await T.scr(2, 1.7, 0.52); check(G, '日记正文一个字不小于 12 像素高', Math.abs(b[1] - a[1]) >= 12, Math.abs(b[1] - a[1]).toFixed(1) + ' 像素');
  }, touch);
}
}
fs.writeFileSync('qa/gate_report.json', JSON.stringify({ results, shots }, null, 1));
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 4000))]);
process.exit(0);
