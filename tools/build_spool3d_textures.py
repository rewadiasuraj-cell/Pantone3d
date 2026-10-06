"""Flange textures for the 3D spool (assets/models/spool.glb).

The supplied model (source/spool/Pantone_Spool_200mm.glb) carries a stand-in
wordmark set in DejaVu Sans. This redraws the same moulded-detail texture with
the real "pantone" letters taken from the brand logo (source/pantone3d-logo.png),
keeping the original layout: dark recessed lettering near the top of the flange
and two faint concentric arcs.

Usage (needs `pip install pillow numpy`):
    python3 tools/build_spool3d_textures.py
then:
    node tools/build_spool3d.mjs
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'source' / 'spool'
S = 2048
BG, INK, ARC = (35, 36, 37), (9, 10, 10), (17, 18, 19)

# "pantone" is the first 385 px of the logo; "3D" follows after a gap.
logo = Image.open(ROOT / 'source' / 'pantone3d-logo.png').getchannel('A').crop((0, 0, 388, 119))
w = 720
h = round(logo.height * w / logo.width)
mask = logo.resize((w, h), Image.LANCZOS)
# Moulded lettering reads a little heavier than the thin logo stroke.
mask = mask.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(0.8))
# Same placement as the original wordmark: centred, 18% down the flange.
ox, oy = (S - w) // 2, round(S * 0.182 - h * 0.42)

base = Image.new('RGB', (S, S), BG)
base.paste(Image.new('RGB', (w, h), INK), (ox, oy), mask)
height = Image.new('L', (S, S), 128)
height.paste(Image.new('L', (w, h), 75), (ox, oy), mask)

draw, hd = ImageDraw.Draw(base), ImageDraw.Draw(height)
for start, end in [(110, 250), (-70, 70)]:
    draw.arc((34, 34, S - 34, S - 34), start, end, fill=ARC, width=5)
    hd.arc((34, 34, S - 34, S - 34), start, end, fill=90, width=5)
base.save(OUT / 'flange_base.png')

hf = np.asarray(height.filter(ImageFilter.GaussianBlur(1)), dtype=float) / 255
dy, dx = np.gradient(hf)
n = np.dstack((-dx * 5, dy * 5, np.ones_like(hf)))
n /= np.linalg.norm(n, axis=2)[..., None]
Image.fromarray(np.uint8(np.clip(n * 0.5 + 0.5, 0, 1) * 255)).save(OUT / 'flange_normal.png')
print('wrote', OUT / 'flange_base.png', OUT / 'flange_normal.png')
