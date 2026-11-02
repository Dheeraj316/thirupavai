"""Download the generated photos listed in raw/manifest.txt and cut the six views for every saree that has both photos.
   manifest line:  <pid> <model|flat> <figma-asset-id> <ext>        e.g.  p4 model daebdd00-60a3-4440-922b-7803db506fdc png
   usage: python fetch_views.py            (skips photos already downloaded and sarees whose six views already exist)
"""
import os, sys, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); RAW = os.path.join(HERE, 'raw'); OUT = os.path.join(HERE, '..', '..', 'assets', 's')
sys.path.insert(0, HERE)
import make_views

have = {}
for line in open(os.path.join(RAW, 'manifest.txt'), encoding='utf-8'):
    p = line.split()
    if len(p) != 4 or p[0].startswith('#'): continue
    pid, kind, aid, ext = p
    dest = os.path.join(RAW, f'{pid}_{kind}.{ext}')
    if not os.path.exists(dest) or os.path.getsize(dest) < 10000:
        r = subprocess.run(['curl', '-sf', '-L', '-o', dest, f'https://www.figma.com/api/mcp/asset/{aid}.{ext}'])   # curl follows the asset redirect; urllib returned empty files
        if r.returncode != 0 or not os.path.exists(dest) or os.path.getsize(dest) < 10000:
            print('FAILED', pid, kind, '(expired or not ready?)'); continue
        print('downloaded', os.path.basename(dest))
    have.setdefault(pid, {})[kind] = dest
built = []
for pid, d in sorted(have.items(), key=lambda kv: int(kv[0][1:])):
    if 'model' in d and 'flat' in d and not all(os.path.exists(os.path.join(OUT, f'{pid}-{i}.webp')) for i in range(1, 7)):
        make_views.main(pid, d['model'], d['flat'], OUT); built.append(pid)
print('built:', ' '.join(built) or 'none')
