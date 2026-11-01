import sys, json, math, numpy as np
from PIL import Image, ImageFilter
S=sys.argv[1]
def load(p, size=(434,145), blur=1.5):
    return np.asarray(Image.open(p).convert('RGB').resize(size).filter(ImageFilter.GaussianBlur(blur)),dtype=np.float64)/255
def sat(s): return np.array([[.213+.787*s,.715-.715*s,.072-.072*s],[.213-.213*s,.715+.285*s,.072-.072*s],[.213-.213*s,.715-.715*s,.072+.928*s]])
def sepia(a): b=1-a; return np.array([[.393+.607*b,.769-.769*b,.189-.189*b],[.349-.349*b,.686+.314*b,.168-.168*b],[.272-.272*b,.534-.534*b,.131+.869*b]])
def hue(d):
    c,s=math.cos(math.radians(d)),math.sin(math.radians(d))
    return np.array([[.213+c*.787-s*.213,.715-c*.715-s*.715,.072-c*.072+s*.928],[.213-c*.213+s*.143,.715+c*.285+s*.140,.072-c*.072-s*.283],[.213-c*.213-s*.787,.715-c*.715+s*.715,.072+c*.928+s*.072]])
def br(b): return np.eye(3)*b
def contrast(c): return np.eye(3)*c, (0.5-0.5*c)
css={'morning':br(1.03)@sat(.95), 'evening':hue(-8)@br(.93)@sat(1.1)@sepia(.28)}
key=load(f'{S}/../cx/key.png'); H=key.shape[0]; y0=int(H*.16)
I=np.vstack([np.eye(3),np.zeros((1,3))])
fits={}
for t in ['morning','evening']:
    tgt=load(f'{S}/{t}.png'); X=key[y0:].reshape(-1,3); Y=tgt[y0:].reshape(-1,3); A=np.hstack([X,np.ones((len(X),1))])
    M=np.linalg.solve(A.T@A+200*np.eye(4), A.T@Y+200*I); fits[t]=M
    cssY=np.clip(X@css[t].T,0,1)
    print(t,'rmse none',round(np.sqrt(((X-Y)**2).mean()),4),'| current CSS',round(np.sqrt(((cssY-Y)**2).mean()),4),'| fitted',round(np.sqrt(((np.clip(A@M,0,1)-Y)**2).mean()),4))
    # feColorMatrix row form: R' = a R + b G + c B + 0 A + e
    m=M.T; rows=[f"{m[i,0]:.3f} {m[i,1]:.3f} {m[i,2]:.3f} 0 {m[i,3]:.3f}" for i in range(3)]+['0 0 0 1 0']
    print('  feColorMatrix:', '  '.join(rows))
    # full-res preview for eyes
    full=np.asarray(Image.open(f'{S}/../cx/key.png').convert('RGB').resize((1086,362)),dtype=np.float64)/255
    F=np.hstack([full.reshape(-1,3),np.ones((full.shape[0]*full.shape[1],1))])
    Image.fromarray((np.clip(F@M,0,1).reshape(full.shape)*255).astype('uint8')).save(f'{S}/fit-{t}.png')
    Image.fromarray((np.clip(full.reshape(-1,3)@css[t].T,0,1).reshape(full.shape)*255).astype('uint8')).save(f'{S}/css-{t}.png')
    Image.open(f'{S}/{t}.png').convert('RGB').resize((1086,362)).save(f'{S}/tgt-{t}.png')
