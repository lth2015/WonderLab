# sheet-neko.png -> three sprites, left to right (run in the directory holding the sheet)
import json
from PIL import Image
import numpy as np
NAMES, REF, REF_H = ['neko-sit', 'neko-run', 'neko-loaf'], 0, 26  # sitting cat = 26 scene units (people ~88)
PX_PER_UNIT = 3.0
im = Image.open('sheet-neko.png').convert('RGBA')
a = np.array(im)[:, :, 3]
cols = (a > 24).sum(axis=0) > 0
runs, start = [], None
for x, c in enumerate(cols):
    if c and start is None: start = x
    if not c and start is not None: runs.append((start, x)); start = None
if start is not None: runs.append((start, len(cols)))
runs = [r for r in runs if r[1] - r[0] > 40]
assert len(runs) == 3, runs
boxes = []
for x0, x1 in runs:
    rows = np.where((a[:, x0:x1] > 24).any(axis=1))[0]
    boxes.append((x0, rows[0], x1, rows[-1] + 1))
scale = PX_PER_UNIT * REF_H / (boxes[REF][3] - boxes[REF][1])
sizes = {}
for name, (x0, y0, x1, y1) in zip(NAMES, boxes):
    w, h = round((x1 - x0) * scale), round((y1 - y0) * scale)
    im.crop((x0, y0, x1, y1)).resize((w, h), Image.LANCZOS).save(f'{name}.webp', 'WEBP', quality=90, method=6)
    sizes[name] = {'w': round(w / PX_PER_UNIT, 1), 'h': round(h / PX_PER_UNIT, 1)}
print(json.dumps(sizes))
