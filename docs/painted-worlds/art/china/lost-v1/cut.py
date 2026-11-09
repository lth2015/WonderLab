# sheet-lost.png -> five small sprites, left to right.  python3 cut.py <dir-with-sheet> <outdir>
# Sizes in scroll units (a person is about 154 units tall); 2.5 px per unit.
import json, sys
from PIL import Image
import numpy as np
src, out = sys.argv[1], sys.argv[2]
ITEMS = [('brush', 20), ('knot', 18), ('whistle', 26), ('comb', 28), ('seal', 18)]
PX = 2.5
im = Image.open(f'{src}/sheet-lost.png').convert('RGBA')
a = np.array(im)[:, :, 3]
cols = np.where((a > 24).any(axis=0))[0]
# split by empty columns between the things
groups, start = [], cols[0]
for p, c in zip(cols, cols[1:]):
    if c - p > 12:
        groups.append((start, p)); start = c
groups.append((start, cols[-1]))
groups = [g for g in groups if g[1] - g[0] > 20]
assert len(groups) == 5, groups
sizes = {}
for (name, wu), (x0, x1) in zip(ITEMS, groups):
    rows = np.where((a[:, x0:x1 + 1] > 24).any(axis=1))[0]
    crop = im.crop((x0, rows[0], x1 + 1, rows[-1] + 1))
    k = PX * wu / crop.width
    w, h = round(crop.width * k), round(crop.height * k)
    crop.resize((w, h), Image.LANCZOS).save(f'{out}/{name}.webp', 'WEBP', quality=90, method=6)
    sizes[name] = {'w': round(w / PX, 1), 'h': round(h / PX, 1)}
print(json.dumps(sizes))
