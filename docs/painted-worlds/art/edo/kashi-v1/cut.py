import sys, json
from PIL import Image
import numpy as np
# sheet -> three figures, left to right; heights in scene units for the standing reference
SPEC = {
  'omatsu': (['omatsu-look', 'omatsu-smile', 'omatsu-sit'], 0, 74),     # figure 0 standing = 82 units
  'kamekichi': (['kame-hide', 'kame-shy', 'kame-point'], 1, 50),      # figure 1 standing = 58 units
}
PX_PER_UNIT = 3.0
sizes = {}
for sheet, (names, ref, ref_h) in SPEC.items():
    im = Image.open(f'sheet-{sheet}.png').convert('RGBA')
    a = np.array(im)[:, :, 3]
    cols = (a > 24).sum(axis=0) > 0
    # runs of non-empty columns
    runs, start = [], None
    for x, c in enumerate(cols):
        if c and start is None: start = x
        if not c and start is not None:
            runs.append((start, x)); start = None
    if start is not None: runs.append((start, len(cols)))
    runs = [r for r in runs if r[1] - r[0] > 40]
    assert len(runs) == 3, (sheet, runs)
    boxes = []
    for x0, x1 in runs:
        rows = np.where((a[:, x0:x1] > 24).any(axis=1))[0]
        boxes.append((x0, rows[0], x1, rows[-1] + 1))
    scale = PX_PER_UNIT * ref_h / (boxes[ref][3] - boxes[ref][1])  # sheet px -> sprite px
    for name, (x0, y0, x1, y1) in zip(names, boxes):
        crop = im.crop((x0, y0, x1, y1))
        w, h = round((x1 - x0) * scale), round((y1 - y0) * scale)
        crop = crop.resize((w, h), Image.LANCZOS)
        crop.save(f'{name}.webp', 'WEBP', quality=90, method=6)
        sizes[name] = {'w': round(w / PX_PER_UNIT, 1), 'h': round(h / PX_PER_UNIT, 1)}
print(json.dumps(sizes))
