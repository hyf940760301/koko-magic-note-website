# 色准：fidelity 状态（正俯视、rot=0）截图里海报区域 vs 原图，CIEDE2000
import json, subprocess, sys, numpy as np, cv2
from skimage.color import rgb2lab, deltaE_ciede2000
from playwright.sync_api import sync_playwright
A=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
res={}
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=A)
  for rot,cookie in [(0,True),(0,False),(-2,True)]:
    c=b.new_page(viewport={'width':1920,'height':1080},device_scale_factor=2)
    c.goto(f'http://127.0.0.1:8942/index.html?state=fidelity&rot={rot}'); c.wait_for_function('window.__ready',timeout=240000)
    inf=c.evaluate('(o)=>window.__set(o)',{'state':'fidelity','noCookie':not cookie})
    fn=f'/workspace/journal-proto/shots/fidelity_rot{rot}_{"cookie" if cookie else "nocookie"}.png'; c.screenshot(path=fn); c.close()
    shot=cv2.cvtColor(cv2.imread(fn),cv2.COLOR_BGR2RGB); pts=np.float32(inf['posterScreen'])*2
    org=cv2.cvtColor(cv2.imread('/workspace/journal-proto/assets/poster_snow03.jpg'),cv2.COLOR_BGR2RGB)
    W,H=432,576
    M=cv2.getPerspectiveTransform(pts,np.float32([[0,0],[W,0],[W,H],[0,H]]))
    warp=cv2.warpPerspective(shot,M,(W,H),flags=cv2.INTER_AREA)
    ref=cv2.resize(org,(W,H),interpolation=cv2.INTER_AREA)
    m=8; warp=warp[m:-m,m:-m]; ref=ref[m:-m,m:-m]
    # 去掉相角遮挡区域（四角 1.4cm ≈ 海报宽的 15%）
    hh,ww=ref.shape[:2]; mask=np.ones((hh,ww),bool); k=int(ww*0.16)
    for (y0,x0) in [(0,0),(0,ww-k),(hh-k,0),(hh-k,ww-k)]: mask[y0:y0+k,x0:x0+k]=False
    # 轻度模糊两者以排除重采样差异，只看色彩
    wb=cv2.GaussianBlur(warp,(0,0),2); rb=cv2.GaussianBlur(ref,(0,0),2)
    dE=deltaE_ciede2000(rgb2lab(wb/255.0),rgb2lab(rb/255.0))[mask]
    meanrgb=(wb[mask].mean(0)-rb[mask].mean(0)).round(2).tolist()
    key=f'rot{rot}_{"cookie" if cookie else "nocookie"}'
    res[key]={'dE_mean':round(float(dE.mean()),2),'dE_p95':round(float(np.percentile(dE,95)),2),'dE_max':round(float(dE.max()),2),'mean_rgb_diff':meanrgb}
    cv2.imwrite(f'/workspace/journal-proto/qa/warp_{key}.png',cv2.cvtColor(np.hstack([warp,ref]),cv2.COLOR_RGB2BGR))
  b.close()
print(json.dumps(res,indent=1,ensure_ascii=False)); json.dump(res,open('/workspace/journal-proto/qa/color_result.json','w'),indent=1)
