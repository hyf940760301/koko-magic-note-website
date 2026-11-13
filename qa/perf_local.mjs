// 本机实测帧时间：node qa/perf_local.mjs <WxH> <dpr>
// 每个状态连续渲染 N 帧，每帧后 readPixels 强制等显卡画完，取中位数和最慢 5%
import { createRequire } from 'module';
const require = createRequire('/Users/huyifan/Desktop/DeepSeek Harness/tools/voc-crawler/package.json');
const { chromium } = require('playwright');
const [W, H] = (process.argv[2] || '1728x1117').split('x').map(Number); const dpr = parseFloat(process.argv[3] || '2');
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ headless: true, executablePath: exe, args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
const bad = []; page.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
const t = Date.now(); await page.goto('http://127.0.0.1:8942/index.html?state=open'); await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
console.log(`viewport ${W}x${H} @${dpr}x, 加载到可用 ${((Date.now() - t) / 1000).toFixed(1)}s`);
const res = await page.evaluate(() => {
  const gl = document.querySelector('canvas').getContext('webgl2'); const px = new Uint8Array(4);
  const run = (mk, n = 40) => { const ts = []; for (let i = 0; i < n; i++) { const t0 = performance.now(); window.__set(mk(i)); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); ts.push(performance.now() - t0); } ts.sort((a, b) => a - b); return { median: +ts[n >> 1].toFixed(1), p95: +ts[Math.floor(n * 0.95)].toFixed(1) }; };
  return {
    canvas: [gl.drawingBufferWidth, gl.drawingBufferHeight],
    首屏: run(() => ({ state: 'establish' })),
    摊开静止: run(() => ({ state: 'open' })),
    翻页中: run((i) => ({ state: 'curl', p: 0.2 + (i % 20) / 33 })),
    开场: run((i) => ({ state: 'opening', ms: 1500 + i * 60 })),
    bench: window.__bench(),
  };
});
console.log(JSON.stringify(res, null, 1)); console.log('失败的请求:', bad.join(' | ') || '无');
await browser.close();
