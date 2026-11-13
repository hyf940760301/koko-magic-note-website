from projlib import *
import math, sys
K=0.8
def box(kind,x,z):
  if kind=='plant': r=7*K; return (x-r,x+r,0,22*K,z-r,z+r)
  if kind=='cup': r=4*K; return (x-r,x+r,0,18*K,z-r,z+r)
  if kind=='mug': return (x-5.9*K,x+6.6*K,0,9.6*K,z-5.9*K,z+5.9*K)
  if kind=='orange': r=3*K; return (x-r,x+r,0,(2*r+1),z-r,z+r)
  if kind=='washi': return (x-3.2*K,x+3.2*K,0,1.8*K,z-1,z+1)
  if kind=='pencil':
    a=-0.2; dx,dz=math.cos(a)*8.5*K,math.sin(a)*8.5*K; return (x-abs(dx)-.5,x+abs(dx)+.5,0,.8,z-abs(dz)-.5,z+abs(dz)+.5)
def status(kind,x,z):
  bx=box(kind,x,z); res={}
  for n,c in C.items():
    f=frac(rect(c['pv'],bx)); res[n]=f
  return res
def ok(res, need_in):
  for n,f in res.items():
    if C[n]['kind']=='read' and f>0: return False
    if C[n]['kind']=='est' and 0.0<f<0.97: return False
  return all(res[n]>=0.97 for n in need_in)
if __name__=='__main__':
  kind=sys.argv[1]; need=sys.argv[2].split(',') if len(sys.argv)>2 and sys.argv[2] else []
  xs=range(-40,48,1); zs=range(-26,30,1)
  for z in zs:
    row=''
    for x in xs:
      if -1<=x<=17 and -12<=z<=12: row+='B'; continue
      res=status(kind,x,z); row+= ('#' if ok(res,need) else ('.' if ok(res,[]) else ' '))
    print('%4d '%z+row)
