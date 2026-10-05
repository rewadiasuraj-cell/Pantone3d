"""Build close-up detail images from the supplied product photography.

- tex-<colour>.webp: the wound filament, cropped from each spool image and
  turned on its side, used as material texture strips (range cards, consistency).
- detail-*.webp: crops of the original photo for the About page.

Nothing is generated or painted in: every pixel comes from the real photo
(or the recoloured spool images made by build_assets.py).

Run after build_assets.py:  python3 tools/build_details.py
"""
import os
from PIL import Image, ImageFilter, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "assets", "img")
SRC = os.path.join(ROOT, "source")

COLOURS = ["yellow", "black", "white", "grey", "red", "orange", "green", "blue", "natural", "carbon"]
WIND = (772, 400, 902, 880)   # filament-only region of the 1000px spool cut-out


def sharpen(im):
    return im.filter(ImageFilter.UnsharpMask(radius=1.6, percent=60, threshold=2))


def textures():
    for c in COLOURS:
        im = Image.open(os.path.join(IMG, f"spool-{c}.webp")).convert("RGB").crop(WIND)
        im = im.rotate(90, expand=True)            # strands run across the strip
        im = sharpen(im.resize((im.width * 2, im.height * 2), Image.LANCZOS))
        im.save(os.path.join(IMG, f"tex-{c}.webp"), "WEBP", quality=84, method=6)


def details():
    src = Image.open(os.path.join(SRC, "spool-yellow.jpg")).convert("RGB")
    crops = {
        "detail-winding": (780, 230, 1050, 830),    # wound filament, portrait
        "detail-window": (560, 520, 1000, 800),     # filament seen through the flange window
        "detail-flange": (330, 200, 730, 480),      # embossed flange texture and wordmark
    }
    for name, box in crops.items():
        im = src.crop(box)
        for width, suffix in ((im.width * 2, ""), (im.width, "-sm")):
            out = sharpen(im.resize((width, round(im.height * width / im.width)), Image.LANCZOS))
            out.save(os.path.join(IMG, f"{name}{suffix}.webp"), "WEBP", quality=84, method=6)


if __name__ == "__main__":
    textures()
    details()
    print("ok")
