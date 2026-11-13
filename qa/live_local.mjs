// 正式运行模式自测：真实鼠标/键盘事件 + 截图 + 帧间隔统计
// 用法：node qa/live_local.mjs <WxH> <dpr> <脚本名>   脚本见下方 SCRIPTS
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('/Users/huyifan/Desktop/DeepSeek Harness/tools/voc-crawler/package.json');
const { chromium } = require('playwright');
const [W, H] = (process.argv[2] || '1728x1117').split('x').map(Number); const dpr = parseFloat(process.argv[3] || '2'); const which = process.argv[4] || 'smoke'; const query = process.argv[5] || '';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ headless: true, executablePath: exe, args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
const errs = [];
page.on('pageerror', (e) => { errs.push('pageerror ' + e.message); });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text().slice(0, 300)); });
page.on('response', (r) => { if (r.status() >= 400) errs.push('HTTP ' + r.status() + ' ' + r.url()); });
const t0 = Date.now();
await page.goto('http://127.0.0.1:8942/index.html' + (query ? '?' + query : '')); await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
console.log('ready in', Date.now() - t0, 'ms');
fs.mkdirSync('shots', { recursive: true });
const shot = async (name) => { await page.screenshot({ path: `shots/${name}.png` }); };
const wait = (ms) => page.waitForTimeout(ms);
const st = () => page.evaluate(() => ({ ...window.__app.stats(), turn: window.__app.turn }));
// 帧间隔采样：在页面里挂一个 rAF 记录器
const startRec = () => page.evaluate(() => { window.__rec = []; let l = performance.now(); const f = (t) => { if (!window.__rec) return; window.__rec.push(t - l); l = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
const stopRec = (label) => page.evaluate((label) => { const a = window.__rec.slice(2).sort((x, y) => x - y); window.__rec = null; const q = (p) => a[Math.min(a.length - 1, Math.floor(a.length * p))]; return { label, frames: a.length, median: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), worst: +a[a.length - 1].toFixed(1), fps: +(1000 / (a.reduce((s, v) => s + v, 0) / a.length)).toFixed(1) }; }, label);
// 把书页上的厘米坐标换成屏幕坐标（用引擎当前相机）
const scr = (x, y, z) => page.evaluate(([x, y, z]) => { const p = window.__proj([[x, y, z]])[0]; return [(p[0] * 0.5 + 0.5) * innerWidth, (1 - (p[1] * 0.5 + 0.5)) * innerHeight]; }, [x, y, z]);

const bench = (label) => page.evaluate((label) => ({ label, ...window.__app.bench(40) }), label);
const SCRIPTS = {
  async turnshots() { // 慢放截图：自动翻页的几个瞬间 + 悬停翘角 + 拖到一半停住 + 反向拖回
    await page.evaluate(() => window.__app.goto(1)); await wait(500);
    const c = await scr(13.9, 2.2, 9.3); await page.mouse.move(c[0], c[1]); await wait(700); await shot('T_hover_corner'); console.log('hover', await st());
    await page.mouse.move(W / 2, H * 0.05); await wait(600);
    await page.evaluate(() => { window.__app.slow(0.04); window.__app.turnPage(1); });
    for (let i = 0; i < 6; i++) { await wait(1300); await shot('T_auto_' + i); console.log((await st()).turn); }
    await page.evaluate(() => window.__app.slow(1)); await wait(1500); console.log('after auto', await st());
    // 拖拽：从左页外侧往右拖（往回翻），停在半空
    const a = await scr(-13.5, 1.5, 7), b = await scr(9, 1.5, 4);
    await page.mouse.move(a[0], a[1]); await wait(100); await page.mouse.down();
    for (let i = 1; i <= 30; i++) { await page.mouse.move(a[0] + (b[0] - a[0]) * i / 60, a[1] + (b[1] - a[1]) * i / 60); await wait(16); }
    await wait(300); await shot('T_drag_half'); console.log('drag half', (await st()).turn);
    for (let i = 31; i <= 50; i++) { await page.mouse.move(a[0] + (b[0] - a[0]) * i / 60, a[1] + (b[1] - a[1]) * i / 60); await wait(16); }
    await wait(300); await shot('T_drag_far'); console.log('drag far', (await st()).turn);
    await page.mouse.up(); await wait(1200); await shot('T_drag_done'); console.log('released', await st());
  },
  async bench() { // 每个画面一帧真实要花多久（不受 60 帧上限遮挡）
    await wait(800); console.log(await bench('首屏全景'));
    await page.evaluate(() => window.__app.goto(1)); await wait(400); console.log(await bench('雪绒国跨页静止'));
    await page.evaluate(() => { window.__app.slow(0.02); window.__app.turnPage(1); }); await wait(1500); console.log(await bench('翻页到一半（画面）'), await st());
  },
  async smoke() {
    await wait(1500); await shot('L_cover_1'); console.log(await st());
    await wait(4000); await shot('L_cover_2');
    const [bx, by] = await scr(7.5, 3, 0); await page.mouse.move(bx, by); await wait(400); await shot('L_cover_hover');
    await page.mouse.click(bx, by);
    for (const ms of [500, 1300, 2200, 3200, 4600, 6200]) { await wait(ms === 500 ? 500 : 0); }
    await wait(600); await shot('L_open_a'); await wait(900); await shot('L_open_b'); await wait(1000); await shot('L_open_c'); await wait(1500); await shot('L_open_d'); await wait(1500); await shot('L_open_e');
    await wait(2500); await shot('L_title'); console.log(await st());
    await page.keyboard.press('ArrowRight'); await wait(250); await shot('L_turn1_mid'); await wait(1200); await shot('L_spread1'); console.log(await st());
    await page.keyboard.press('ArrowRight'); await wait(300); await shot('L_turn2_mid'); await wait(1200); await shot('L_spread2'); console.log(await st());
    await page.keyboard.press('ArrowRight'); await wait(200); await shot('L_end_bump'); await wait(900); console.log(await st());
    await page.keyboard.press('ArrowLeft'); await wait(1300); await page.keyboard.press('ArrowLeft'); await wait(1300); await shot('L_back_title'); console.log(await st());
  },
  async fps() {
    const cm = async () => { const x = await st(); return 'CPU 平均 ' + x.cpuMs + ' / 最大 ' + x.cpuMaxMs + ' 毫秒，渲染 ' + x.size.join('×') + '（档位 ' + x.scale + '）'; };
    await wait(1200); await st(); await startRec(); await wait(4000); console.log(await stopRec('首屏待机'), await cm());
    const [bx, by] = await scr(7.5, 3, 0); await page.mouse.move(bx, by); await wait(300); await page.mouse.click(bx, by);
    await startRec(); await wait(5200); console.log(await stopRec('开场'), await cm());
    await wait(400); await startRec(); await wait(4000); console.log(await stopRec('扉页静止（含书角自动翘起提示）'), await cm());
    await startRec(); for (let i = 0; i < 2; i++) { await page.keyboard.press('ArrowRight'); await wait(1900); } for (let i = 0; i < 2; i++) { await page.keyboard.press('ArrowLeft'); await wait(1900); } console.log(await stopRec('键盘翻页 ×4'), await cm());
    await page.evaluate(() => window.__app.goto(1)); await wait(600); await st();
    const a = await scr(13.6, 1.8, 8.5), b = await scr(-12, 1.8, 6);
    await startRec(); await page.mouse.move(a[0], a[1]); await page.mouse.down();
    for (let i = 1; i <= 60; i++) { await page.mouse.move(a[0] + (b[0] - a[0]) * i / 60, a[1] + (b[1] - a[1]) * i / 60); await wait(16); }
    await page.mouse.up(); await wait(900); console.log(await stopRec('拖拽翻页'), await cm(), (await st()).spread);
  },
};
await SCRIPTS[which]();
console.log(errs.length ? 'ERRORS:\n' + [...new Set(errs)].join('\n') : 'no errors');
await browser.close();
