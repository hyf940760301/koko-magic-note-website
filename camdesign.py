import numpy as np, math, itertools
def pv(pos,tgt,fov,aspect):
  pos=np.array(pos,float); f=np.array(tgt,float)-pos; f/=np.linalg.norm(f); r=np.cross(f,[0,1,0]); r/=np.linalg.norm(r); u=np.cross(r,f)
  V=np.eye(4); V[0,:3]=r; V[1,:3]=u; V[2,:3]=-f; V[:3,3]=-V[:3,:3]@pos
  t=1/math.tan(math.radians(fov)/2); n,fa=1,1200
  P=np.array([[t/aspect,0,0,0],[0,t,0,0],[0,0,-(fa+n)/(fa-n),-2*fa*n/(fa-n)],[0,0,-1,0]]); return P@V
def pr(M,p): v=M@np.array([*p,1.0]); return v[:3]/v[3]
def rect(M,bx):
  ps=[pr(M,(x,y,z)) for x in bx[0:2] for y in bx[2:4] for z in bx[4:6]]; return min(p[0] for p in ps),max(p[0] for p in ps),min(p[1] for p in ps),max(p[1] for p in ps)
BOOK=(-0.3,15.5,0,3.2,-10.7,10.7)
def cam(yaw,pitch,fov,d,tgt,aspect):
  y,p=math.radians(yaw),math.radians(pitch); dirv=np.array([math.sin(y)*math.cos(p),math.sin(p),math.cos(y)*math.cos(p)])
  pos=np.array(tgt)+dirv*d; return pos, pv(pos,tgt,fov,aspect)
