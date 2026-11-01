import sys, math, numpy as np
from PIL import Image, ImageFilter
sys.path.insert(0, sys.argv[1]); 
S=sys.argv[1]
exec(open(f'{S}/cmp.py').read().split("css={")[0].split("S=sys.argv[1]")[1])  # reuse helper fns
def load(p, size=(434,145), blur=1.5):
    return np.asarray(Image.open(p).convert('RGB').resize(size).filter(ImageFilter.GaussianBlur(blur)),dtype=np.float64)/255
key=load(f'{S}/../cx/key.png'); H=key.shape[0]; y0=int(H*.16); X=key[y0:].reshape(-1,3)
def apply(p,X):
    sp,sa,hu,b,c=p
    Y=X@sepia(sp).T; Y=Y@sat(sa).T; Y=Y@hue(hu).T; Y=np.clip(Y*b,0,1); Y=np.clip((Y-0.5)*c+0.5,0,1)
    return Y
rng=np.random.default_rng(1)
for t in ['morning','evening']:
    T=load(f'{S}/{t}.png')[y0:].reshape(-1,3)
    best=np.array([0.0,1.0,0.0,1.0,1.0]); be=np.sqrt(((apply(best,X)-T)**2).mean())
    step=np.array([0.1,0.1,8,0.05,0.05])
    for it in range(4000):
        cand=best+rng.normal(0,1,5)*step
        cand[0]=np.clip(cand[0],0,1); cand[1]=np.clip(cand[1],0.5,1.6); cand[2]=np.clip(cand[2],-40,40); cand[3]=np.clip(cand[3],0.7,1.3); cand[4]=np.clip(cand[4],0.7,1.3)
        e=np.sqrt(((apply(cand,X)-T)**2).mean())
        if e<be: best,be=cand,e
        if it%1000==999: step*=0.5
    sp,sa,hu,b,c=best
    print(t, 'rmse', round(be,4), f'filter: sepia({sp:.2f}) saturate({sa:.2f}) hue-rotate({hu:.0f}deg) brightness({b:.2f}) contrast({c:.2f})')
    full=np.asarray(Image.open(f'{S}/../cx/key.png').convert('RGB').resize((1086,362)),dtype=np.float64)/255
    Image.fromarray((apply(best,full.reshape(-1,3)).reshape(full.shape)*255).astype('uint8')).save(f'{S}/cssfit-{t}.png')
