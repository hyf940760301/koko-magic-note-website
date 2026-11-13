import json
from playwright.sync_api import sync_playwright
A=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
views=json.load(open('/tmp/views.json')); out={}
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=A); pages={}
  for size,name,st,kind in views:
    if size not in pages:
      W,H=map(int,size.split('x')); c=b.new_page(viewport={'width':W,'height':H}); c.goto('http://127.0.0.1:8942/index.html?'); c.wait_for_function('window.__ready',timeout=240000); pages[size]=c
    c=pages[size]; c.evaluate('(o)=>window.__set(o)',st); out[name]={'kind':kind,'pv':c.evaluate('window.__pv()')}
json.dump(out,open('/tmp/cams.json','w'))
