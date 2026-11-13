// 本机截图（Mac，真实显卡）：node qa/shoot_local.mjs <WxH> <dpr> <url-query> '<shots-json>' [port]
//   shots-json: [[name, stateObj], ...]，stateObj 原样传给 window.__set
// 与 grok 的 shoot.py 参数一致，只是换成本机 Chromium + Metal，输出到 ./shots/
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire('/Users/huyifan/Desktop/DeepSeek Harness/tools/voc-crawler/package.json');
const { chromium } = require('playwright');

const [W, H] = (process.argv[2] || '1600x900').split('x').map(Number);
const dpr = parseFloat(process.argv[3] || '1');
const query = process.argv[4] || 'state=open';
const shots = JSON.parse(process.argv[5] || '[["open",{"state":"open"}]]');
const port = process.argv[6] || '8942';
const out = path.join(here, '..', 'shots');
fs.mkdirSync(out, { recursive: true });

const exe = process.env.CHROME || `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ headless: true, executablePath: exe, args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text().slice(0, 1500)}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => logs.push(`[requestfailed] ${r.url()}`));
page.on('response', (r) => { if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`); });

const t = Date.now();
await page.goto(`http://127.0.0.1:${port}/index.html?${query}`);
try { await page.waitForFunction('window.__ready === true', null, { timeout: 120000 }); }
catch (e) { console.log('NOT READY', e.message); console.log(logs.join('\n')); await browser.close(); process.exit(1); }
console.log('ready', ((Date.now() - t) / 1000).toFixed(1) + 's');
console.log('renderer:', await page.evaluate(`(() => { const c = document.createElement('canvas').getContext('webgl2'); const e = c && c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'n/a'; })()`));
for (const [name, st] of shots) {
  const t0 = Date.now();
  const inf = await page.evaluate((o) => { const i = window.__set(o); return { calls: i.calls, tris: i.tris, cam: i.cam, fov: i.fov }; }, st);
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  console.log(name, `${Date.now() - t0}ms`, JSON.stringify(inf));
}
console.log(logs.length ? logs.slice(0, 30).join('\n') : 'NO ERRORS');
await browser.close();
