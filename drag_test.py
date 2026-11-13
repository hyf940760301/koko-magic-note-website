# 拖拽翻页测试：真实鼠标事件 → 拖到一半截图 → 松手后等弹簧落定截图
import sys, json, time
from playwright.sync_api import sync_playwright
A=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
O='/workspace/journal-proto/shots/'
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=A); errs=[]
  c=b.new_page(viewport={'width':1600,'height':1000}); c.on('pageerror',lambda e:errs.append(str(e)))
  c.goto('http://127.0.0.1:8942/index.html?state=read'); c.wait_for_function('window.__ready',timeout=240000)
  c.evaluate('()=>window.__set({state:"read"})')
  # 右页书口靠下（屏幕坐标：从截图量得的大致位置）
  x0,y0=1290,700
  c.mouse.move(x0,y0); c.mouse.down()
  for i in range(1,13): c.mouse.move(x0-i*45,y0-i*8); time.sleep(0.05)
  time.sleep(0.4); c.screenshot(path=O+'drag_mid.png'); print('mid',c.evaluate('()=>window.__drag()'))
  c.mouse.move(x0-12*45-60,y0-110); time.sleep(0.2); c.mouse.up()
  for k in range(30):
    time.sleep(0.3); d=c.evaluate('()=>window.__drag()')
    if k==1: c.screenshot(path=O+'drag_release.png'); print('rel',d)
    if not d['held'] and abs(d['p']-d['target'])<1e-3 and abs(d['v'])<1e-3: break
  print('settled',d); c.screenshot(path=O+'drag_done.png')
  print('\n'.join(errs) or 'NO ERRORS'); b.close()
