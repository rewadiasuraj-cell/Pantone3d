"""Build the hero's spectrum spool from the real product photo.

Re-shades only the filament pixels of source/spool-yellow.jpg with the site
spectrum, running top to bottom across the winding, so the spool itself is
untouched. Output: assets/img/spool-spectrum(-sm).webp

Run:  python3 tools/build_spectrum.py
"""
import os
import numpy as np
from PIL import Image
from build_assets import SRC, cutout, filament_mask, srgb_to_lin, lin_to_srgb, save

# Site spectrum (assets/css/main.css --spectrum), top of the winding to the bottom.
STOPS = ["#FF2E63", "#FF7A00", "#FFD400", "#00D9C8", "#168BFF", "#635BFF", "#D92BFF", "#FF2E63"]


def spectrum(t):
    cols = np.array([[int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)] for h in STOPS], np.float32)
    x = np.clip(t, 0, 1) * (len(cols) - 1)
    i = np.minimum(x.astype(int), len(cols) - 2)
    u = (x - i)[..., None]
    return cols[i] * (1 - u) + cols[i + 1] * u


def main():
    a, alpha = cutout(Image.open(os.path.join(SRC, "spool-yellow.jpg")))
    fm = filament_mask(a)
    h, w = fm.shape
    ys = np.where(fm.max(1) > 0.5)[0]
    y0, y1 = ys.min(), ys.max()
    t = (np.arange(h, dtype=np.float32) - y0) / max(1, y1 - y0)
    # a slight diagonal follows the spool's perspective
    xs = np.arange(w, dtype=np.float32) / w
    target = srgb_to_lin(spectrum(t[:, None] * 0.92 + xs[None, :] * 0.08))

    lin = srgb_to_lin(a)
    lum = 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]
    k = lum / np.median(lum[fm > 0.9])
    tl = (0.2126 * target[..., 0] + 0.7152 * target[..., 1] + 0.0722 * target[..., 2])
    spec = np.clip(k - 0.9, 0, None) ** 1.5 * 0.3 * (1.2 - tl)
    rec = lin_to_srgb(target * k[..., None] + spec[..., None])
    wgt = fm[..., None]
    print(save(a * (1 - wgt) + rec * wgt, alpha, "spectrum"))


if __name__ == "__main__":
    main()
