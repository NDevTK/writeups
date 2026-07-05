#!/usr/bin/env python3
"""Mean/max abs diff of two PPMs + per-band breakdown, PIL only."""
import sys
from PIL import Image, ImageChops
a = Image.open(sys.argv[1]).convert('RGB')
b = Image.open(sys.argv[2]).convert('RGB')
assert a.size == b.size, (a.size, b.size)
d = ImageChops.difference(a, b)
h = d.histogram()  # 256*3
n = a.size[0] * a.size[1]
tot = mx = 0
big = 0
for c in range(3):
    for v in range(256):
        cnt = h[c * 256 + v]
        tot += cnt * v
        if cnt and v > mx: mx = v
        if v > 8: big += cnt
print('mean %.4f  max %d  frac>8 %.5f' % (tot / (n * 3), mx, big / (n * 3)))
# horizontal band breakdown (8 bands)
W, H = a.size
for i in range(8):
    box = (0, H * i // 8, W, H * (i + 1) // 8)
    hh = ImageChops.difference(a.crop(box), b.crop(box)).histogram()
    nn = W * (box[3] - box[1]) * 3
    t = sum(cnt * v for c in range(3) for v, cnt in enumerate(hh[c*256:(c+1)*256]))
    print('  band %d rows %4d-%4d  mean %.3f' % (i, box[1], box[3], t / nn))
if len(sys.argv) > 3:
    d.save(sys.argv[3])
