# sheet-lost.png -> six small sprites, left to right (run in the directory holding the sheet)
import json
from PIL import Image
import numpy as np
# name, width in scene units (people are about 88 units tall)
ITEMS = [('lost-netsuke', 12), ('lost-kiseru', 22), ('lost-kanzashi', 19), ('lost-sensu', 14), ('lost-koma', 10), ('lost-suzu', 10)]
PX = 3.0
im = Image.open('sheet-lost.png').convert('RGBA')
a = np.array(im)[:, :, 3]
# the things touch in columns (the pipe lies slanted), so split by connected regions of the alpha
mask = a > 24
small = mask[::4, ::4]  # label on a quarter grid, then grow back
lab = np.zeros(small.shape, int); n = 0
for y0 in range(small.shape[0]):
    for x0 in range(small.shape[1]):
        if small[y0, x0] and not lab[y0, x0]:
            n += 1; stack = [(y0, x0)]; lab[y0, x0] = n
            while stack:
                y, x = stack.pop()
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        yy, xx = y + dy, x + dx
                        if 0 <= yy < small.shape[0] and 0 <= xx < small.shape[1] and small[yy, xx] and not lab[yy, xx]:
                            lab[yy, xx] = n; stack.append((yy, xx))
boxes = []
for i in range(1, n + 1):
    ys, xs = np.where(lab == i)
    if len(ys) < 30: continue  # specks
    boxes.append((xs.min() * 4, ys.min() * 4, xs.max() * 4 + 4, ys.max() * 4 + 4, i))
boxes.sort()
assert len(boxes) == 6, [b[:4] for b in boxes]
sizes = {}
for (name, wu), (x0, y0, x1, y1, i) in zip(ITEMS, boxes):
    # keep only this thing's pixels inside its box (a neighbour may reach in)
    crop = np.array(im.crop((x0, y0, x1, y1)))
    own = np.kron(lab == i, np.ones((4, 4), bool))[y0:y1, x0:x1]
    # grow the quarter-grid region by one cell so its own soft edges are kept
    grown = own.copy()
    for dy in (-4, 0, 4):
        for dx in (-4, 0, 4):
            grown |= np.roll(np.roll(own, dy, 0), dx, 1)
    crop[~grown, 3] = 0
    crop = Image.fromarray(crop)
    k = PX * wu / (x1 - x0)
    w, h = round((x1 - x0) * k), round((y1 - y0) * k)
    crop.resize((w, h), Image.LANCZOS).save(f'{name}.webp', 'WEBP', quality=90, method=6)
    sizes[name] = {'w': round(w / PX, 1), 'h': round(h / PX, 1)}
print(json.dumps(sizes))
