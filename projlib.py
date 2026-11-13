import json, math
C=json.load(open('/tmp/cams.json'))
def proj(pv,p):
  x,y,z=p; e=pv
  X=e[0]*x+e[4]*y+e[8]*z+e[12]; Y=e[1]*x+e[5]*y+e[9]*z+e[13]; W=e[3]*x+e[7]*y+e[11]*z+e[15]
  return (X/W,Y/W,W)
def rect(pv,bx):
  pts=[proj(pv,(x,y,z)) for x in bx[0:2] for y in bx[2:4] for z in bx[4:6]]
  return min(p[0] for p in pts),max(p[0] for p in pts),min(p[1] for p in pts),max(p[1] for p in pts)
def frac(r):
  x0,x1,y0,y1=r; a=(x1-x0)*(y1-y0); ix=max(0,min(1,x1)-max(-1,x0)); iy=max(0,min(1,y1)-max(-1,y0)); return ix*iy/a
BOOK=(-0.3,15.5,0,3.2,-10.7,10.7)
