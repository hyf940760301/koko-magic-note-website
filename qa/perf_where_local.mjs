// 找出每帧时间花在哪：不改文件，只在浏览器加载 main.js 时临时替换几处，逐项关掉后期效果再测
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('/Users/huyifan/Desktop/DeepSeek Harness/tools/voc-crawler/package.json');
const { chromium } = require('playwright');
const [W, H] = (process.argv[2] || '1728x1117').split('x').map(Number); const dpr = parseFloat(process.argv[3] || '2');
const src = fs.readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const rep = (s, a, b) => { if (!s.includes(a)) throw new Error('pattern not found: ' + a); return s.split(a).join(b); };
const variants = {
  '原样': (s) => s,
  '关光束': (s) => rep(s, 'const int N = 18;', 'const int N = 1;'),
  '关景深': (s) => rep(s, 'for(int i=0;i<32;i++){', 'for(int i=0;i<1;i++){'),
  '光束和景深都关': (s) => rep(rep(s, 'const int N = 18;', 'const int N = 1;'), 'for(int i=0;i<32;i++){', 'for(int i=0;i<1;i++){'),
  '都关 + 关 4 倍抗锯齿': (s) => rep(rep(rep(s, 'const int N = 18;', 'const int N = 1;'), 'for(int i=0;i<32;i++){', 'for(int i=0;i<1;i++){'), 'type: THREE.HalfFloatType, samples: 4', 'type: THREE.HalfFloatType, samples: 0'),
  '都关 + 阴影图 1024': (s) => rep(rep(rep(s, 'const int N = 18;', 'const int N = 1;'), 'for(int i=0;i<32;i++){', 'for(int i=0;i<1;i++){'), 'sun.shadow.mapSize.set(2048, 2048)', 'sun.shadow.mapSize.set(1024, 1024)'),
};
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ headless: true, executablePath: exe, args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] });
console.log(`视口 ${W}x${H} @${dpr}x（每帧毫秒，中位数；16.7 以内才是 60 帧）`);
for (const [name, fn] of Object.entries(variants)) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
  const body = fn(src);
  await page.route('**/main.js', (r) => r.fulfill({ contentType: 'text/javascript', body }));
  await page.goto('http://127.0.0.1:8942/index.html?state=open'); await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  const res = await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2'); const px = new Uint8Array(4);
    const run = (mk, n = 30) => { const ts = []; for (let i = 0; i < n; i++) { const t0 = performance.now(); window.__set(mk(i)); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); ts.push(performance.now() - t0); } ts.sort((a, b) => a - b); return +ts[n >> 1].toFixed(1); };
    return { 首屏: run(() => ({ state: 'establish' })), 摊开: run(() => ({ state: 'open' })), 翻页: run((i) => ({ state: 'curl', p: 0.2 + (i % 20) / 33 })) };
  });
  console.log(name.padEnd(14, '　'), JSON.stringify(res));
  await page.close();
}
await browser.close();
