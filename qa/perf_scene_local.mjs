// 场景本身（后期全关）的开销拆解：临时替换，不改文件
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('/Users/huyifan/Desktop/DeepSeek Harness/tools/voc-crawler/package.json');
const { chromium } = require('playwright');
const [W, H] = (process.argv[2] || '1728x1117').split('x').map(Number); const dpr = parseFloat(process.argv[3] || '2');
const src = fs.readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const rep = (s, a, b) => { if (!s.includes(a)) throw new Error('pattern not found: ' + a); return s.split(a).join(b); };
const base = (s) => rep(rep(rep(s, 'const int N = 18;', 'const int N = 1;'), 'for(int i=0;i<32;i++){', 'for(int i=0;i<1;i++){'), 'type: THREE.HalfFloatType, samples: 4', 'type: THREE.HalfFloatType, samples: 0');
const variants = {
  '基线(后期全关,无抗锯齿)': base,
  '去掉树叶光斑': (s) => rep(base(s), 'float dp = dapple(h*0.16 + vec2(uTime*0.03, sin(uTime*0.4)*0.15));', 'float dp = 1.0;'),
  '窗影整体关掉': (s) => rep(base(s), 'if(uCookieOn < 0.5) return 1.0;', 'return 1.0;'),
  '阴影改普通过滤': (s) => rep(base(s), 'THREE.PCFSoftShadowMap', 'THREE.PCFShadowMap'),
  '阴影关掉': (s) => rep(base(s), 'renderer.shadowMap.enabled = true;', 'renderer.shadowMap.enabled = false;'),
  '2 倍抗锯齿': (s) => rep(base(s), 'samples: 0 }); }', 'samples: 2 }); }'),
  '8 位色缓冲': (s) => rep(base(s), 'type: THREE.HalfFloatType, samples: 0', 'type: THREE.UnsignedByteType, samples: 0'),
};
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ headless: true, executablePath: exe, args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] });
console.log(`视口 ${W}x${H} @${dpr}x`);
for (const [name, fn] of Object.entries(variants)) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
  let body; try { body = fn(src); } catch (e) { console.log(name, 'SKIP', e.message); await page.close(); continue; }
  page.on('pageerror', (e) => console.log('  pageerror', e.message.slice(0, 200)));
  await page.route('**/main.js', (r) => r.fulfill({ contentType: 'text/javascript', body }));
  await page.goto('http://127.0.0.1:8942/index.html?state=open'); await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  const res = await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2'); const px = new Uint8Array(4);
    const run = (mk, n = 30) => { const ts = []; for (let i = 0; i < n; i++) { const t0 = performance.now(); window.__set(mk(i)); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); ts.push(performance.now() - t0); } ts.sort((a, b) => a - b); return +ts[n >> 1].toFixed(1); };
    return { 首屏: run(() => ({ state: 'establish' })), 摊开: run(() => ({ state: 'open' })), 摊开无房间: run(() => ({ state: 'open', noProps: 1 })) };
  });
  console.log(name, JSON.stringify(res));
  await page.close();
}
await browser.close();
