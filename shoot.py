import sys, json, time
from playwright.sync_api import sync_playwright
A=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
O='/workspace/journal-proto/shots/'
# argv: WxH dpr url-query shots-json   shots: [[name, stateobj], ...]
W,H=[int(x) for x in sys.argv[1].split('x')]; dpr=float(sys.argv[2]); q=sys.argv[3]; shots=json.loads(sys.argv[4])
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=A); errs=[]
  c=b.new_page(viewport={'width':W,'height':H},device_scale_factor=dpr)
  c.on('console',lambda m:m.type in('error','warning') and errs.append(m.type+': '+m.text[:2500]))
  c.on('pageerror',lambda e:errs.append('pageerror '+str(e)))
  t=time.time(); c.goto('http://127.0.0.1:8942/index.html?'+q)
  try: c.wait_for_function('window.__ready',timeout=90000)
  except Exception as e: print('NOT READY', e); print('\n'.join(errs)); sys.exit(1)
  print('ready',round(time.time()-t,1))
  for name,st in shots:
    t0=time.time(); inf=c.evaluate('(o)=>window.__set(o)',st); c.screenshot(path=O+name+'.png'); print(name,round(time.time()-t0,1),json.dumps(inf))
  print('\n'.join(errs) or 'NO ERRORS')
  b.close()
