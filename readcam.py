from camdesign import *
import math
CW,CH=15.1,21.32; OW=2*(CW+0.52+2+3.6+0.6)
def frame(cx,cz,w,h,elev,asp,fov=28,margin=0.07):
  vf=math.radians(fov); hf=2*math.atan(math.tan(vf/2)*asp); el=math.radians(elev)
  hE=h*math.sin(el)+2*math.cos(el); d=max((hE/2)/math.tan(vf/2)/(1-2*margin),(w/2)/math.tan(hf/2)/(1-2*margin))
  pos=(cx,math.sin(el)*d,cz+math.cos(el)*d); return pv(pos,(cx,0.8,cz),fov,asp)
def views(elev,curlH):
  return {'open':frame(0,0,OW,CH+2,elev,16/9),'curl':frame(0,-1.5,OW,CH+curlH,elev,16/9),'open1610':frame(0,0,OW,CH+2,elev,1.6),'open43':frame(0,0,OW,CH+2,elev,4/3)}
