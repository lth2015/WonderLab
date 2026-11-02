# Joins street-13 (as it is in the app) and the three rightward extensions along
# least-difference seams in each 512 px overlap, matches colour, then cuts the
# new sections at the app's scale (1400 x 980 per 1000 units).
import numpy as np
from PIL import Image
SRC = '/home/user/wonderlab/apps/qingming-edo/src/assets/art/street-13.webp'
H, KEEP, FEATHER = 1024, 512, 6

def seam(a, b):
    """Least-difference top-to-bottom path through two equal overlaps (DP, ±1 px per row)."""
    d = np.abs(a.astype(np.float32) - b.astype(np.float32)).sum(axis=2)
    # blur a little so the path follows regions, not single pixels
    from PIL import ImageFilter
    d = np.array(Image.fromarray(np.clip(d, 0, 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(3)), dtype=np.float32)
    h, w = d.shape
    cost = d.copy()
    for y in range(1, h):
        prev = cost[y - 1]
        left = np.r_[np.inf, prev[:-1]]
        right = np.r_[prev[1:], np.inf]
        cost[y] += np.minimum(np.minimum(left, prev), right)
    path = np.zeros(h, dtype=int)
    path[-1] = int(np.argmin(cost[-1][KEEP // 8 : -KEEP // 8])) + KEEP // 8
    for y in range(h - 2, -1, -1):
        x = path[y + 1]
        lo, hi = max(0, x - 1), min(w, x + 2)
        path[y] = lo + int(np.argmin(cost[y, lo:hi]))
    return path

def join(left, right):
    """`right`'s first KEEP columns repaint `left`'s last KEEP columns."""
    ov_l = left[:, -KEEP:, :3]
    ov_r = right[:, :KEEP, :3]
    # colour: per-channel gain so the new picture matches in the overlap
    gain = ov_l.reshape(-1, 3).mean(0) / np.maximum(ov_r.reshape(-1, 3).mean(0), 1)
    right = right.astype(np.float32)
    right[:, :, :3] = np.clip(right[:, :, :3] * gain, 0, 255)
    p = seam(ov_l, right[:, :KEEP, :3])
    out = np.concatenate([left.astype(np.float32), right[:, KEEP:]], axis=1)
    x0 = left.shape[1] - KEEP
    for y in range(H):
        s = x0 + p[y]
        # right of the seam: the new picture; feathered over a few px
        for dx in range(-FEATHER, KEEP - p[y]):
            x = s + dx
            if x < x0 or x >= left.shape[1]:
                continue
            t = min(1.0, max(0.0, (dx + FEATHER) / (2 * FEATHER)))
            out[y, x, :3] = (1 - t) * left[y, x, :3] + t * right[y, x - x0, :3]
    print('gain', np.round(gain, 3), 'seam x', int(p.min()), '-', int(p.max()))
    return out, int(p.min())

base = np.array(Image.open(SRC).convert('RGB').resize((round(1400 * H / 980), H), Image.LANCZOS)).astype(np.float32)
strip = base
first_seam = None
for k in ['K1', 'K2', 'K3']:
    nxt = np.array(Image.open(f'kashi-{k}.png').convert('RGB')).astype(np.float32)
    strip, sx = join(strip, nxt)
    if first_seam is None: first_seam = sx
img = Image.fromarray(np.clip(strip, 0, 255).astype(np.uint8))
full = img.resize((round(img.width * 980 / H), 980), Image.LANCZOS)
print('joined', img.size, '->', full.size, '| street-13 changes right of x =', round((base.shape[1] - KEEP + first_seam) * 980 / H))
full.save('kashi-joined.png')
full.crop((0, 0, 1400, 980)).save('street-13-new.png')
for i, k in enumerate([14, 15]):
    full.crop((1400 * (i + 1), 0, 1400 * (i + 2), 980)).save(f'street-{k}.png')
full.resize((full.width // 4, 245)).save('joined-small.png')
