// 第 2 步（画面与书纸质感）改前改后对照：同一套机位各拍一张
// 用法：node qa/step2_local.mjs <前缀> [WxH] [dpr] [只拍哪些,逗号分隔]
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('/Users/huyifan/Desktop/DeepSeek Harness/tools/voc-crawler/package.json');
const { chromium } = require('playwright');
const pre = process.argv[2] || 'P'; const [W, H] = (process.argv[3] || '1440x900').split('x').map(Number); const dpr = parseFloat(process.argv[4] || '2');
const only = process.argv[5] ? process.argv[5].split(',') : null; const want = (n) => !only || only.includes(n);
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ headless: true, executablePath: exe, args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text().slice(0, 400)); });
page.on('response', (r) => { if (r.status() >= 400) errs.push('HTTP ' + r.status() + ' ' + r.url()); });
await page.goto('http://127.0.0.1:8942/index.html' + (process.argv[6] ? '?' + process.argv[6] : '')); await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
const shot = async (n) => { await page.screenshot({ path: `shots/${pre}_${n}.png` }); };
const wait = (ms) => page.waitForTimeout(ms);
const app = (fn, ...a) => page.evaluate(([fn, a]) => window.__app[fn](...a), [fn, a]);
if (want('cover')) { await wait(1300); await shot('cover_far'); await wait(9600); await shot('cover_near'); }
await app('open'); await wait(300); await app('skip'); await wait(900);
if (want('opening')) { await app('close'); await wait(300); await app('open'); await wait(2500); await shot('opening_a'); await wait(1200); await shot('opening_b'); await app('skip'); await wait(900); }
await page.mouse.move(W / 2, 8);
if (want('title')) { await app('goto', 0); await wait(700); await shot('title'); }
if (want('spread1')) { await app('goto', 1); await wait(700); await shot('spread1'); }
if (want('spread2')) { await app('goto', 2); await wait(700); await shot('spread2'); }
if (want('turn')) { await app('goto', 1);
  for (const p of [0.12, 0.3, 0.5, 0.7]) { await app('hold', 1, p); await wait(1600); await shot('turn_' + Math.round(p * 100)); }
  await app('cam', [[0, 7, 52], [0, 5, 0], 28]); await wait(300);
  for (const p of [0.12, 0.3, 0.5, 0.7]) { await app('hold', 1, p); await wait(900); await shot('side_' + Math.round(p * 100)); }
  await app('cam', null); await app('hold', null); }
console.log(errs.length ? [...new Set(errs)].slice(0, 6).join('\n') + '\n共 ' + errs.length + ' 条' : 'no errors');
await browser.close();
