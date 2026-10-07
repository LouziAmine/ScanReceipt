"""Generates every iOS and Android icon / splash file from the brand PNGs in assets/.

Run from the project root after changing the logo:  python3 scripts/generate-native-assets.py
Each existing file is overwritten at its current pixel size, so the native projects stay valid.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / 'assets'
RES = ROOT / 'android/app/src/main/res'
IOS = ROOT / 'ios/App/App/Assets.xcassets'
NAVY = (11, 43, 58, 255)

icon = Image.open(ASSETS / 'icon-only.png').convert('RGBA')
foreground = Image.open(ASSETS / 'icon-foreground.png').convert('RGBA')
splash = Image.open(ASSETS / 'splash.png').convert('RGB')


def fit(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Center-crop to the target aspect ratio, then resize."""
    w, h = image.size
    tw, th = size
    scale = max(tw / w, th / h)
    resized = image.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    left = (resized.width - tw) // 2
    top = (resized.height - th) // 2
    return resized.crop((left, top, left + tw, top + th))


def round_icon(size: int) -> Image.Image:
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(icon.resize((size, size), Image.LANCZOS), (0, 0), mask)
    return out


def regenerate(path: Path, render) -> None:
    size = Image.open(path).size
    render(size).save(path, optimize=True)
    print(f'{path.relative_to(ROOT)}  {size[0]}x{size[1]}')


for path in sorted(RES.glob('mipmap-*/ic_launcher.png')):
    regenerate(path, lambda s: icon.resize(s, Image.LANCZOS))
for path in sorted(RES.glob('mipmap-*/ic_launcher_round.png')):
    regenerate(path, lambda s: round_icon(s[0]))
for path in sorted(RES.glob('mipmap-*/ic_launcher_foreground.png')):
    regenerate(path, lambda s: foreground.resize(s, Image.LANCZOS))
for path in sorted(RES.glob('drawable*/splash.png')):
    regenerate(path, lambda s: fit(splash, s))

background = RES / 'values/ic_launcher_background.xml'
background.write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
    '    <color name="ic_launcher_background">#0B2B3A</color>\n</resources>\n'
)

for path in sorted(IOS.glob('AppIcon.appiconset/*.png')):
    # The App Store rejects icons with an alpha channel.
    regenerate(path, lambda s: icon.convert('RGB').resize(s, Image.LANCZOS))
for path in sorted(IOS.glob('Splash.imageset/*.png')):
    regenerate(path, lambda s: fit(splash, s))
