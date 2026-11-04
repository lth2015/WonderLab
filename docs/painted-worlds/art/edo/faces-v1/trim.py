# Keep the portrait (largest opaque blob), drop stray specks, crop square around it, 320² webp.
#   python3 trim.py <indir> <outdir>
import sys
from PIL import Image
import numpy as np
from collections import deque


def largest_blob(m):
    # m: bool mask at 1/4 scale; returns the largest 8-connected blob
    h, w = m.shape
    seen = np.zeros_like(m, bool)
    best = None
    for y0, x0 in zip(*np.nonzero(m)):
        if seen[y0, x0]:
            continue
        q, pts = deque([(y0, x0)]), []
        seen[y0, x0] = True
        while q:
            y, x = q.popleft()
            pts.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and m[yy, xx] and not seen[yy, xx]:
                        seen[yy, xx] = True
                        q.append((yy, xx))
        if best is None or len(pts) > len(best):
            best = pts
    out = np.zeros_like(m, bool)
    for y, x in best:
        out[y, x] = True
    return out

src, out = sys.argv[1], sys.argv[2]
for n in 'sokichi seita okon kisuke kinji oharu omatsu kamekichi ihei inkyo'.split():
    im = Image.open(f'{src}/face-{n}.png').convert('RGBA')
    a = np.array(im)
    small = np.array(Image.fromarray(a[:, :, 3]).resize((256, 256), Image.BOX)) > 24
    keep = np.array(Image.fromarray(largest_blob(small).astype(np.uint8) * 255).resize(im.size, Image.NEAREST)) > 0
    a[:, :, 3] = np.where(keep, a[:, :, 3], 0)
    ys, xs = np.nonzero(a[:, :, 3] > 24)
    cx, side = (xs.min() + xs.max()) // 2, max(xs.max() - xs.min(), ys.max() - ys.min()) + 24
    box = (cx - side // 2, ys.max() + 12 - side, cx + side // 2, ys.max() + 12)
    Image.fromarray(a).crop(box).resize((320, 320), Image.LANCZOS).save(f'{out}/{n}.webp', quality=86, method=6)
    print(n, box)
