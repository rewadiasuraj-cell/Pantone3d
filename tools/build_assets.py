"""Build web assets from the supplied Pantone3D source photography.

- Cuts the spool out of its white studio background (flood fill from the border).
- Produces colour variants by re-shading ONLY the filament pixels of the real photo,
  so spool geometry is never altered.
- Produces light/dark logo variants.

Run:  python3 tools/build_assets.py
"""
import colorsys, json, os
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "source")
OUT = os.path.join(ROOT, "assets", "img")
os.makedirs(OUT, exist_ok=True)

# Filament colours used on the site. [VERIFY] against Pantone3D's real colour range.
COLOURS = {
    "yellow":  None,           # original photography, untouched
    "black":   (28, 28, 30),
    "white":   (238, 236, 229),
    "grey":    (128, 131, 134),
    "red":     (196, 30, 40),
    "orange":  (236, 104, 26),
    "green":   (24, 132, 72),
    "blue":    (28, 76, 184),
    "natural": (226, 216, 190),
    "carbon":  (46, 47, 50),
}
MATTE = {"white", "grey", "carbon"}


def cutout(img):
    a = np.asarray(img.convert("RGB")).astype(np.float32) / 255
    h, w, _ = a.shape
    mx, mn = a.max(2), a.min(2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    light = (mx > 0.50) & (sat < 0.10)
    bg = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if light[y, x] and not bg[y, x]:
                bg[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if light[y, x] and not bg[y, x]:
                bg[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and light[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True; q.append((ny, nx))
    # the grey floor shadow under the spool: grow the background into darker,
    # still neutral pixels, but only across the bottom of the frame
    floor = (mx > 0.23) & (sat < 0.12)
    floor[: int(h * 0.82)] = False
    q = deque(zip(*np.nonzero(bg & np.pad(np.ones((h - int(h * 0.82), w), bool), ((int(h * 0.82), 0), (0, 0))))))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and floor[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True; q.append((ny, nx))
    # enclosed studio-white seen through the spool windows
    bg |= (mx > 0.82) & (sat < 0.08)
    m = Image.fromarray(((~bg) * 255).astype(np.uint8))
    m = m.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.1))
    return a, np.asarray(m).astype(np.float32) / 255


def filament_mask(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(2), a.min(2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    # hue for yellow/orange: r high, b low
    warm = (r > b + 0.12) & (r >= g * 0.95)
    s = np.clip((sat - 0.25) / 0.25, 0, 1)
    v = np.clip((mx - 0.12) / 0.15, 0, 1)
    return np.where(warm, s * v, 0)


def srgb_to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def recolour(a, fm, target, matte=False):
    lin = srgb_to_lin(a)
    lum = 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]
    ref = np.median(lum[fm > 0.9])
    k = lum / ref
    if matte:
        k = 0.55 + 0.45 * k
    t = srgb_to_lin(np.array(target, np.float32) / 255)
    out = t[None, None, :] * k[..., None]
    # keep groove/specular definition visible on dark filaments
    tl = 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2]
    spec = np.clip(k - 0.9, 0, None) ** 1.5 * (0.10 if matte else 0.35) * (1.2 - tl)
    out = out + spec[..., None]
    rec = lin_to_srgb(out)
    w = fm[..., None]
    return a * (1 - w) + rec * w


def save(rgb, alpha, name):
    arr = np.dstack([rgb, alpha[..., None]])
    img = Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8), "RGBA")
    bbox = img.getbbox()
    img = img.crop(bbox)
    for width, suffix in ((1000, ""), (560, "-sm")):
        im = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
        im.save(os.path.join(OUT, f"spool-{name}{suffix}.webp"), "WEBP", quality=86, method=6)
    return img.size


def main():
    src = Image.open(os.path.join(SRC, "spool-yellow.jpg"))
    a, alpha = cutout(src)
    fm = filament_mask(a)
    sample = a[fm > 0.95]
    brand = tuple(int(x) for x in (np.median(sample, 0) * 255))
    size = None
    for name, col in COLOURS.items():
        rgb = a if col is None else recolour(a, fm, col, name in MATTE)
        size = save(rgb, alpha, name)
    logo = Image.open(os.path.join(SRC, "pantone3d-logo.png")).convert("RGBA")
    logo = logo.crop(logo.getbbox())
    la = np.asarray(logo).astype(np.float32)
    for name, c in (("light", (245, 244, 240)), ("dark", (16, 16, 16))):
        o = la.copy(); o[..., :3] = c
        Image.fromarray(o.astype(np.uint8), "RGBA").save(os.path.join(OUT, f"logo-{name}.png"), optimize=True)
    print(json.dumps({"brand_yellow": "#%02X%02X%02X" % brand, "spool_size": size, "logo": logo.size}))


if __name__ == "__main__":
    main()
