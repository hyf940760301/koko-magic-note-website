// 真实拖拽翻页时的帧间隔（走原型自己的渲染路径，不经过截图接口）：node qa/perf_drag_local.mjs <WxH> <dpr>
import { createRequire } from 'module';
const require = createRequire('/Users/huyifan/Desktop/DeepSeek Harness/tools/voc-crawler/package.json');
const { chromium } = require('playwright');
const [W, H] = (process.argv[2] || '1728x1117').split('x').map(Number); const dpr = parseFloat(process.argv[3] || '2');
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ headless: true, executablePath: exe, args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
await page.goto('http://127.0.0.1:8942/index.html?state=read'); await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
await page.evaluate(() => { window.__set({ state: 'read' }); window.__ft = []; let last = 0; const gl = document.querySelector('canvas').getContext('webgl2'); const px = new Uint8Array(4);
  const tick = (t) => { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); if (last) window.__ft.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
const x0 = W * 0.80, y0 = H * 0.72;
await page.mouse.move(x0, y0); await page.mouse.down();
const t0 = Date.now(); let i = 0;
while (Date.now() - t0 < 4000) { i++; const k = (Math.sin(i / 25) * 0.5 + 0.5); await page.mouse.move(x0 - k * W * 0.55, y0 - k * 40); }
const d = await page.evaluate(() => window.__drag()); await page.mouse.up();
const ft = await page.evaluate(() => window.__ft.slice(5)); ft.sort((a, b) => a - b);
const med = ft[ft.length >> 1], p95 = ft[Math.floor(ft.length * 0.95)];
console.log(`${W}x${H} @${dpr}x 拖拽翻页：${ft.length} 帧，帧间隔中位 ${med.toFixed(1)}ms（约 ${(1000 / med).toFixed(0)} 帧/秒），最慢 5% ${p95.toFixed(1)}ms（约 ${(1000 / p95).toFixed(0)} 帧/秒）；拖拽状态`, JSON.stringify(d));
await browser.close();
