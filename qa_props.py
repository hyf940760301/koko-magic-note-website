# 道具与画框检查：阅读/翻页取景里道具必须完全在画框外；首屏里道具要么完整、要么完全不在（不在中段被切）
import sys, json, itertools
from playwright.sync_api import sync_playwright
A=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
def boxes(PP):
  B={}
  K=PP.get('scale',1)
  x,z,y=(PP['plant']+[0])[:3]; B['plant']=(x-7*K,x+7*K,y,y+24.5*K,z-7*K,z+7*K)
  x,z,y=(PP['cup']+[0])[:3]; B['cup']=(x-4*K,x+4*K,y,y+21*K,z-4*K,z+4*K)
  x,z,y=(PP['mug']+[0])[:3]; B['mug']=(x-5.9*K,x+6.6*K,y,y+10.2*K,z-5.9*K,z+5.9*K)
  for i,o in enumerate(PP['oranges']):
    x,z,r,a=o[:4]; y=o[4] if len(o)>4 else 0; r*=K; B['orange%d'%i]=(x-r,x+r,y,y+2*r+1,z-r,z+r)
  B['cactus']=(0.5,7.5,11.5,20,-31,-24); B['lamp']=(102,135,0,32,-27,-6); B['shelf']=(74,138,17,46,-28,-10); B['cork']=(27.3,49.7,16.5,33.5,-28,-26)
  if PP.get('pencil'):
    import math; cx,cz,ang=PP['pencil']; dx,dz=math.cos(ang),math.sin(ang); L=9*K
    B['pencil']=(min(cx-dx*L,cx+dx*L)-.5,max(cx-dx*L,cx+dx*L)+.5,0,.9,min(cz-dz*L,cz+dz*L)-.5,max(cz-dz*L,cz+dz*L)+.5)
  x,z,y=(PP['washi']+[0])[:3]; B['washi']=(x-2.8*K,x+4.6*K,y,y+5.2*K,z-2.7*K,z+3.6*K)
  return B
def rect(pts):
  pts=[p for p in pts if p[2]<1]
  if not pts: return (5,6,5,6)
  xs=[p[0] for p in pts]
  ys=[p[1] for p in pts]
  return min(xs),max(xs),min(ys),max(ys)
def frac(r):
  x0,x1,y0,y1=r; a=(x1-x0)*(y1-y0)
  ix=max(0,min(1,x1)-max(-1,x0)); iy=max(0,min(1,y1)-max(-1,y0)); return ix*iy/a if a>0 else 0
def ov(r,q):
  ix=max(0,min(r[1],q[1])-max(r[0],q[0])); iy=max(0,min(r[3],q[3])-max(r[2],q[2])); return ix*iy
PP=json.loads(sys.argv[1]); views=json.loads(sys.argv[2])
B=boxes(PP); pageBox=(-16.5,16.5,0,3.6,-11.2,11.2)
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=A)
  pages={}
  for (size,name,st,kind) in views:
    if size not in pages:
      W,H=map(int,size.split('x')); c=b.new_page(viewport={'width':W,'height':H}); c.goto('http://127.0.0.1:8942/index.html?'); c.wait_for_function('window.__ready',timeout=240000); pages[size]=c
    c=pages[size]; c.evaluate('(o)=>window.__set(o)',st)
    cor=lambda bx:[[x,y,z] for x in bx[0:2] for y in bx[2:4] for z in bx[4:6]]
    pr=rect(c.evaluate('(p)=>window.__proj(p)',cor(pageBox)))
    out=[]
    for k,bx in B.items():
      r=rect(c.evaluate('(p)=>window.__proj(p)',cor(bx))); f=frac(r)
      if kind=='read':
        bad = f>0.0; o=ov(r,pr)
        if bad: out.append(f'{k}: in-frame {f:.2f} pageOverlap {o:.3f}')
      else:
        if 0.02<f<0.9: out.append(f'{k}: CHOPPED {f:.2f}')
        elif f>=0.9: out.append(f'{k}: ok')
    bk=rect(c.evaluate('(p)=>window.__proj(p)',cor((-0.3,15.5,0,3.2,-10.7,10.7)))); bw=(bk[1]-bk[0])/2 if kind=='est' else (pr[1]-pr[0])/2
    print(size,name,'W%.2f'%bw,'|',' ; '.join(out) or 'clear')
  b.close()
