from camdesign import *
import math
CW,CH=15.1,21.32
KP=[(x,y,z) for x in (-0.3,CW+1.4) for z in (-CH/2-1,CH/2+1) for y in (0,3.4)]
def est(yaw,pitch,fov,tgt,fitX,fitY,shiftY,asp):
  y,p=math.radians(yaw),math.radians(pitch); dirv=np.array([math.sin(y)*math.cos(p),math.sin(p),math.cos(y)*math.cos(p)])
  off=np.zeros(3); tgt=np.array(tgt,float)
  for it in range(8):
    for d in np.arange(10,700,0.25):
      M=pv(tgt+dirv*d+off,tgt+off,fov,asp); ps=[pr(M,k) for k in KP]
      x0,x1=min(q[0] for q in ps),max(q[0] for q in ps); y0,y1=min(q[1] for q in ps),max(q[1] for q in ps)
      if (x1-x0)/2<fitX and (y1-y0)/2<fitY: break
    h=2*d*math.tan(math.radians(fov)/2); w=h*asp
    f=(tgt+off)-(tgt+dirv*d+off); f/=np.linalg.norm(f); r=np.cross(f,[0,1,0]); r/=np.linalg.norm(r); u=np.cross(r,f)
    off=off+r*((x0+x1)/2*w/2)+u*(((y0+y1)/2-shiftY)*h/2)
  return pv(tgt+dirv*d+off,tgt+off,fov,asp)
