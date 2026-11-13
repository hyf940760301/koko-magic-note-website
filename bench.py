from playwright.sync_api import sync_playwright
A=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=A); c=b.new_page(viewport={'width':1920,'height':1080})
  c.goto('http://127.0.0.1:8942/index.html?state=open'); c.wait_for_function('window.__ready',timeout=240000)
  print(c.evaluate('window.__bench()')); b.close()
