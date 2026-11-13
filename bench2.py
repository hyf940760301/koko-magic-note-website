# 用法：python3 bench2.py [port]  —— 各状态的 draw calls / 三角面数（1920×1080）+ 翻页 CPU 基准
import sys, json
from playwright.sync_api import sync_playwright
A=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
port=sys.argv[1] if len(sys.argv)>1 else '8942'
S=[('est',{'state':'establish'}),('est_d',{'state':'establish','dolly':1}),('closed',{'state':'closed'}),('open',{'state':'open'}),('curl65',{'state':'curl','p':0.65})]
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=A); c=b.new_page(viewport={'width':1920,'height':1080})
  c.goto('http://127.0.0.1:%s/index.html?state=open'%port); c.wait_for_function('window.__ready',timeout=240000)
  out={}
  for n,st in S:
    i=c.evaluate('(o)=>window.__set(o)',st); out[n]=(i['calls'],i['tris'])
  # 场景总三角面（所有网格，不论是否在视野内）
  out['sceneTris']=c.evaluate('window.__sceneTris ? window.__sceneTris() : -1')
  out['bench']=c.evaluate('window.__bench()')
  print(json.dumps(out,ensure_ascii=False)); b.close()
