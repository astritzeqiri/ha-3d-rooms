"""Render the original 3D Rooms isometric mark; requires Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / 'custom_components/three_d_rooms/brand'
# Coordinates use a 256-square canvas, with open walls and a floating room block.
SHAPES = [
    ('#168EA8', [(28, 171), (128, 113), (228, 171), (128, 229)]),
    ('#36D4C2', [(28, 69), (128, 11), (128, 113), (28, 171)]),
    ('#239CC3', [(128, 11), (228, 69), (228, 171), (128, 113)]),
    ('#A2F4E2', [(28, 69), (128, 11), (140, 18), (40, 76)]),
    ('#69D9F0', [(128, 11), (228, 69), (216, 76), (116, 18)]),
    ('#D7FFF3', [(77, 155), (128, 125), (179, 155), (128, 185)]),
    ('#58D9C8', [(77, 155), (128, 185), (128, 207), (77, 177)]),
    ('#32AEC8', [(128, 185), (179, 155), (179, 177), (128, 207)]),
]
BRAND.mkdir(parents=True, exist_ok=True)
for size, suffix in [(256, ''), (512, '@2x')]:
    scale = size * 4 / 256
    image = Image.new('RGBA', (size * 4, size * 4))
    draw = ImageDraw.Draw(image)
    for color, points in SHAPES:
        draw.polygon([(round(x * scale), round((y + 8) * scale)) for x, y in points], fill=color)
    image = image.resize((size, size), Image.Resampling.LANCZOS)
    for theme in ['', 'dark_']:
        image.save(BRAND / f'{theme}icon{suffix}.png', optimize=True)
