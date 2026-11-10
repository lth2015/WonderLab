# sheet -> three passer-by sprites (left to right), at the street's scale (2.9 px per unit).
#   python3 cut.py <sheet.png> <art-dir> <sizes.json>
import json, sys
from PIL import Image
import numpy as np
sheet, out, sizes_path = sys.argv[1:4]
NAMES = [('crowd3-hikyaku', 84), ('crowd3-daiku', 86), ('crowd3-ameuri', 84)]  # height in units
PX = 2.9
im = Image.open(sheet).convert('RGBA')
a = np.array(im)[:, :, 3]
cols = np.where((a > 24).any(axis=0))[0]
groups, start = [], cols[0]
for p, c in zip(cols, cols[1:]):
    if c - p > 14:
        groups.append((start, p)); start = c
groups.append((start, cols[-1]))
groups = [g for g in groups if g[1] - g[0] > 40]
# two figures may touch (a pole reaching over): split a wide group at its emptiest column
while len(groups) < 3:
    g = max(groups, key=lambda g: g[1] - g[0])
    lo, hi = g[0] + (g[1] - g[0]) // 3, g[0] + 2 * (g[1] - g[0]) // 3
    cut = lo + int(np.argmin((a[:, lo:hi] > 24).sum(axis=0)))
    i = groups.index(g)
    groups[i:i + 1] = [(g[0], cut), (cut + 1, g[1])]
assert len(groups) == 3, groups
sizes = json.load(open(sizes_path))
for (name, hu), (x0, x1) in zip(NAMES, groups):
    rows = np.where((a[:, x0:x1 + 1] > 24).any(axis=1))[0]
    crop = im.crop((x0, rows[0], x1 + 1, rows[-1] + 1))
    k = PX * hu / crop.height
    w, h = round(crop.width * k), round(crop.height * k)
    crop.resize((w, h), Image.LANCZOS).save(f'{out}/{name}.webp', 'WEBP', quality=90, method=6)
    sizes[name] = {'w': round(w / PX, 1), 'h': round(h / PX, 1)}
    print(name, sizes[name])
json.dump(sizes, open(sizes_path, 'w'), ensure_ascii=False, indent=1)
