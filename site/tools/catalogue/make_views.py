"""Turn one AI model photo + one AI flat-lay photo of a saree into the six gallery views used on its product page.
   usage: python make_views.py <pid> <model.png> <flat.png> <out_dir>      e.g.  python make_views.py p23 raw/p23_model.png raw/p23_flat.png ../../assets/s
   views: 1 full length (3:4)  2 draped upper body (4:5)  3 folded/flat-lay (1:1)  4 border detail  5 pallu detail  6 weave and zari
   The detail crops go to the most richly woven parts of the flat-lay (highest fine-detail energy), so they always show cloth and zari.
"""
import sys, os
import numpy as np
from PIL import Image, ImageFilter

K = 4  # analysis scale

def energy(im):
    g = np.asarray(im.convert('L').resize((im.width // K, im.height // K), Image.BILINEAR), dtype=np.float32)
    gx = np.abs(np.diff(g, axis=1, prepend=g[:, :1])); gy = np.abs(np.diff(g, axis=0, prepend=g[:1, :]))
    return gx + gy

def integral(e):
    return np.pad(e.cumsum(0).cumsum(1), ((1, 0), (1, 0)))

def win_sum(ii, x, y, w, h):
    return ii[y + h, x + w] - ii[y, x + w] - ii[y + h, x] + ii[y, x]

def best_window(e, ii, size, region=None, avoid=(), stride=12):
    """top-left (full-resolution) of the size x size window with the most fine detail inside `region` (x0,y0,x1,y1 in full-res), away from `avoid` boxes."""
    s = size // K; H, W = e.shape; best, pos = -1, None
    x0, y0, x1, y1 = [v // K for v in region] if region else (0, 0, W, H)
    for y in range(max(0, y0), min(H - s, y1 - s) + 1, stride // 2 or 1):
        for x in range(max(0, x0), min(W - s, x1 - s) + 1, stride // 2 or 1):
            if any(not (x + s <= ax0 // K or x >= ax1 // K or y + s <= ay0 // K or y >= ay1 // K) for ax0, ay0, ax1, ay1 in avoid): continue
            v = win_sum(ii, x, y, s, s)
            if v > best: best, pos = v, (x * K, y * K)
    return pos

def model_window(m, width):
    """x-centre for the portrait crop: most detailed band, with a pull toward the middle (the model is asked to stand there)."""
    e = energy(m).sum(axis=0); w = max(1, width // K)
    k = np.convolve(e, np.ones(w), mode='valid')
    centre = (len(k) - 1) / 2; prior = np.exp(-0.5 * ((np.arange(len(k)) - centre) / (len(k) * 0.22)) ** 2)
    return (int(np.argmax(k * prior)) + w // 2) * K

def save(im, box, size, path, q=78):
    im.crop(box).resize(size, Image.LANCZOS).save(path, 'WEBP', quality=q, method=6)

def main(pid, model_p, flat_p, out):
    os.makedirs(out, exist_ok=True)
    m = Image.open(model_p).convert('RGB'); f = Image.open(flat_p).convert('RGB')
    H = m.height; cw = int(H * 3 / 4)
    xc = min(max(model_window(m, cw), cw // 2), m.width - cw // 2)
    save(m, (xc - cw // 2, 0, xc + cw // 2, H), (900, 1200), f'{out}/{pid}-1.webp')
    dw = int(H * 0.66); dh = int(dw * 5 / 4); x0 = min(max(xc - dw // 2, 0), m.width - dw); y0 = int(H * 0.04)
    save(m, (x0, y0, x0 + dw, min(y0 + dh, H)), (800, 1000), f'{out}/{pid}-2.webp')
    s = f.height; fx = (f.width - s) // 2
    save(f, (fx, 0, fx + s, s), (900, 900), f'{out}/{pid}-3.webp')
    e = energy(f); ii = integral(e); W, Hf = f.width, f.height; d = 640
    p4 = best_window(e, ii, d, (0, int(Hf * .35), W, Hf))                                                # border: richest low-frame area
    p5 = best_window(e, ii, d, (int(W * .35), 0, W, Hf), avoid=[(p4[0], p4[1], p4[0] + d, p4[1] + d)])   # pallu: richest area elsewhere
    p6 = best_window(e, ii, 480, None, avoid=[(p4[0], p4[1], p4[0] + d, p4[1] + d), (p5[0], p5[1], p5[0] + d, p5[1] + d)])  # weave macro
    for i, (p, sz) in zip((4, 5, 6), ((p4, d), (p5, d), (p6, 480))):
        save(f, (p[0], p[1], p[0] + sz, p[1] + sz), (800, 800), f'{out}/{pid}-{i}.webp', q=78)
    print(pid, 'ok  model x =', xc, ' details at', p4, p5, p6)

if __name__ == '__main__':
    main(*sys.argv[1:5])

