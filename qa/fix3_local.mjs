// 用户反馈六项的回归：加载页、开场逐帧（查白屏）、翻页用时、镜头是否移动、点贴片、海报飞出
import { createRequire } from 'module';
const require = createRequire('/Users/huyifan/Desktop/DeepSeek Harness/tools/voc-crawler/package.json');
const { chromium } = require('playwright');
const [W, H] = (process.argv[2] || '1440x900').split('x').map(Number); const dpr = parseFloat(process.argv[3] || '2');
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ headless: true, executablePath: exe, args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text().slice(0, 400)); });
const shot = (n) => page.screenshot({ path: `shots/F_${n}.png` }); const wait = (ms) => page.waitForTimeout(ms);
const app = (fn, ...a) => page.evaluate(([fn, a]) => window.__app[fn](...a), [fn, a]);
const scr = (x, y, z) => page.evaluate(([x, y, z]) => { const p = window.__proj([[x, y, z]])[0]; return [(p[0] * 0.5 + 0.5) * innerWidth, (1 - (p[1] * 0.5 + 0.5)) * innerHeight]; }, [x, y, z]);
const pv = () => page.evaluate(() => window.__pv().map((v) => +v.toFixed(4)).join(','));
const t0 = Date.now(); page.goto('http://127.0.0.1:8942/index.html'); await wait(350); await shot('loading');
await page.waitForFunction('window.__ready === true', null, { timeout: 120000 }); console.log('加载用时', Date.now() - t0, 'ms');
await wait(1500); await shot('cover');
// 开场：刚出场景就点
const [bx, by] = await scr(7.5, 3, 0); await page.mouse.click(bx, by);
for (let i = 0; i < 12; i++) { await wait(430); await shot('open_' + String(i).padStart(2, '0')); }
await wait(1500); console.log('开场后', await app('stats'));
// 镜头：静止、鼠标乱动、翻页中，投影矩阵是否变化
const a0 = await pv(); for (let i = 0; i < 20; i++) { await page.mouse.move(100 + Math.random() * (W - 200), 80 + Math.random() * (H - 160)); await wait(60); } const a1 = await pv();
// 翻页用时
await page.mouse.move(W / 2, 6); const tt = Date.now(); await page.keyboard.press('ArrowRight'); let mid = null;
for (;;) { await wait(40); const s = await page.evaluate(() => ({ s: window.__app.spread, t: window.__app.turn })); if (!mid && s.t && s.t.p > 0.45) { mid = await pv(); await shot('turn_mid'); } if (s.s === 1 && !s.t) break; if (Date.now() - tt > 6000) break; }
console.log('翻一页用时', Date.now() - tt, 'ms；镜头：鼠标移动后', a0 === a1 ? '没动' : '动了', '，翻页中', a0 === mid ? '没动' : '动了');
await wait(500); await shot('spread1');
// 小东西：指到吊牌、点一下
const tag = await page.evaluate(() => { const q = window.__eng.screenQuad('snowL', window.__eng.patch('snowL', 'tag')); return [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2]; });
await page.mouse.move(tag[0], tag[1]); await wait(500); console.log('指到吊牌：抬起中的东西', await page.evaluate(() => window.__app.pops), '光标', await page.evaluate(() => document.querySelector('canvas').style.cursor));
await page.mouse.click(tag[0], tag[1]); await wait(90); await shot('poke');
// 海报飞出
const po = await page.evaluate(() => { const q = window.__eng.screenQuad('snowL', window.__eng.patch('snowL', 'poster')); return [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2]; });
await page.mouse.move(po[0], po[1]); await wait(300); await page.mouse.click(po[0], po[1]); await wait(250); await shot('fly_a'); await wait(700); await shot('fly_b'); console.log('海报飞出', await page.evaluate(() => window.__app.fly));
await page.mouse.click(W / 2, H / 2); await wait(800); console.log('再点收回', !(await page.evaluate(() => window.__app.fly)));
const kk = await page.evaluate(() => { const q = window.__eng.screenQuad('snowR', window.__eng.patch('snowR', 'kokoArt')); return [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2]; });
await page.mouse.click(kk[0], kk[1]); await wait(950); await shot('fly_koko'); await page.keyboard.press('Escape'); await wait(800);
console.log(errs.length ? [...new Set(errs)].slice(0, 6).join('\n') + '\n共 ' + errs.length : 'no errors');
await browser.close();
