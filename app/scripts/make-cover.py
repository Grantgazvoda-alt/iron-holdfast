#!/usr/bin/env python3
"""IRON HOLDFAST — procedural cover art (no generation credits needed).

Paints the 16:9 marketplace/OG cover and a square favicon in the game's
painterly style: parchment sky, rolling grass, the azure keep on a hill,
the oxblood enemy camp in the distance, a banner, and the title.
"""
import math
import random
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
random.seed(7)


def lerp(a, b, t):
    return a + (b - a) * t


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def blend(c1, c2, t):
    return tuple(int(lerp(a, b, t)) for a, b in zip(c1, c2))


img = Image.new("RGB", (W, H))
d = ImageDraw.Draw(img)

# ── sky / parchment gradient ────────────────────────────────────────────
SKY_TOP = hexc("#e8d9b8")
SKY_BOT = hexc("#c9ab77")
for y in range(H):
    t = y / H
    d.line([(0, y), (W, y)], fill=blend(SKY_TOP, SKY_BOT, t))

# sun glow
sun = (W * 0.78, H * 0.22)
for r, a in [(260, 18), (190, 30), (130, 45), (80, 70)]:
    d.ellipse(
        [sun[0] - r, sun[1] - r, sun[0] + r, sun[1] + r],
        fill=(255, 236, 190, a) if False else blend((255, 236, 190), SKY_BOT, a / 90),
    )

# clouds
for i in range(6):
    cx = random.uniform(80, W - 80)
    cy = random.uniform(40, 200)
    for k in range(4):
        r = random.uniform(26, 52)
        d.ellipse(
            [cx - r, cy - r * 0.55, cx + r, cy + r * 0.55],
            fill=blend((255, 248, 226), SKY_BOT, 0.25),
        )
        cx += random.uniform(-30, 30)
        cy += random.uniform(-8, 12)

# ── rolling hills ───────────────────────────────────────────────────────
HILL_A = hexc("#7fa35c")
HILL_B = hexc("#6f9e4f")
HILL_C = hexc("#5b8a3e")
for i, (base, col, amp) in enumerate(
    [(H * 0.62, HILL_C, 90), (H * 0.55, HILL_B, 120), (H * 0.47, HILL_A, 150)]
):
    pts = [(0, H)]
    for x in range(0, W + 40, 40):
        y = base + math.sin(x / 240 + i * 2.1) * amp + math.sin(x / 97 + i) * 22
        pts.append((x, y))
    pts.append((W, H))
    d.polygon(pts, fill=col)
    # grass flecks
    for _ in range(140):
        x = random.uniform(0, W)
        y = random.uniform(base - amp - 30, H)
        c = blend(col, (0, 0, 0), random.uniform(0.0, 0.18))
        d.line([(x, y), (x + 2, y - 5)], fill=c, width=2)

# ── distant enemy camp (oxblood) ────────────────────────────────────────
camp_x, camp_y = W * 0.16, H * 0.5
for t in range(3):
    tx = camp_x + (t - 1) * 74
    ty = camp_y + 16
    d.polygon(
        [(tx, ty - 70), (tx + 38, ty), (tx - 38, ty)],
        fill=blend(hexc("#7a231e"), (0, 0, 0), 0.12),
    )
    d.polygon(
        [(tx, ty - 52), (tx + 24, ty - 2), (tx - 24, ty - 2)],
        fill=blend(hexc("#a3342f"), (0, 0, 0), 0.05),
    )
# camp flag
d.line([(camp_x, camp_y - 84), (camp_x, camp_y - 118)], fill=hexc("#3a2a18"), width=5)
d.polygon(
    [(camp_x, camp_y - 118), (camp_x + 30, camp_y - 108), (camp_x, camp_y - 96)],
    fill=hexc("#c84b42"),
)

# smoke
for i in range(5):
    x = camp_x + random.uniform(-20, 20)
    y = camp_y - 120 - i * 22
    r = 12 + i * 7
    d.ellipse([x - r, y - r, x + r, y + r], fill=blend((200, 190, 170), (0, 0, 0), 0.18))

# ── the keep on the hill (azure banner) ─────────────────────────────────
kx, ky = W * 0.52, H * 0.44
stone = hexc("#8f8578")
stone_d = hexc("#6d665c")
# main body
d.rectangle([kx - 130, ky - 90, kx + 130, ky + 150], fill=stone)
d.rectangle([kx - 130, ky - 90, kx + 130, ky + 150], outline=stone_d, width=4)
# keep gate
d.rectangle([kx - 34, ky + 40, kx + 34, ky + 150], fill=hexc("#4a3524"))
d.pieslice([kx - 34, ky - 6, kx + 34, ky + 62], 180, 360, fill=hexc("#4a3524"))
# tower
d.rectangle([kx + 100, ky - 170, kx + 180, ky + 150], fill=stone)
d.rectangle([kx + 100, ky - 170, kx + 180, ky + 150], outline=stone_d, width=4)
d.polygon(
    [(kx + 92, ky - 170), (kx + 188, ky - 170), (kx + 140, ky - 225)],
    fill=stone,
    outline=stone_d,
)
# crenellations on main body
for i in range(7):
    x = kx - 130 + i * 40
    d.rectangle([x, ky - 108, x + 24, ky - 90], fill=stone, outline=stone_d, width=3)
# azure banner on tower
d.line([(kx + 140, ky - 225), (kx + 140, ky - 300)], fill=hexc("#4a3524"), width=6)
d.polygon(
    [(kx + 140, ky - 300), (kx + 215, ky - 275), (kx + 140, ky - 250)],
    fill=hexc("#2f6fd0"),
)
# windows
for i in range(3):
    wx = kx - 90 + i * 70
    d.rectangle([wx, ky - 20, wx + 20, ky + 30], fill=hexc("#3a352c"))
    d.pieslice([wx, ky - 40, wx + 20, ky - 4], 180, 360, fill=hexc("#3a352c"))
# ground shadow
d.ellipse(
    [kx - 170, ky + 120, kx + 210, ky + 175],
    fill=blend(HILL_A, (0, 0, 0), 0.22),
)

# ── title band ──────────────────────────────────────────────────────────
band = Image.new("RGBA", (W, 150), (0, 0, 0, 0))
bd = ImageDraw.Draw(band)
bd.rectangle([0, 0, W, 150], fill=(36, 26, 14, 210))
img.paste(band, (0, H - 150), band)

# small caps subtitle
try:
    sub = ImageFont.truetype(FONT, 34)
    title = ImageFont.truetype(FONT, 96)
    tag = ImageFont.truetype(FONT, 30)
except Exception:
    sub = ImageFont.load_default()
    title = ImageFont.load_default()
    tag = ImageFont.load_default()

def center_text(dr, y, text, font, fill):
    w = dr.textlength(text, font=font)
    dr.text(((W - w) / 2, y), text, font=font, fill=fill)

# gold rule
d.rectangle([W * 0.3, H - 132, W * 0.7, H - 126], fill=hexc("#d9a441"))
center_text(d, H - 118, "IRON  HOLDFAST", title, hexc("#d9a441"))
center_text(d, H - 34, "BUILD THE KEEP  ·  RAISE THE WALLS  ·  BURN THE CAMP", tag, hexc("#e8d9b8"))

# vignette
vig = Image.new("L", (W, H), 0)
vd = ImageDraw.Draw(vig)
for x in range(W):
    for y in range(H):
        dx = (x - W / 2) / (W / 2)
        dy = (y - H / 2) / (H / 2)
        t = min(1.0, (dx * dx + dy * dy) ** 0.5)
        vd.point((x, y), fill=int(120 * max(0, t - 0.55) ** 2))
dark = Image.new("RGB", (W, H), (28, 18, 8))
img = Image.composite(img, Image.blend(img, dark, 0.6), vig)

img.save("/home/user/3536b7e6-db2d-4c9e-9406-0a81a81e5173/iron-empire-9f0476b7-0aec-4146-9bf8-619b59190e77/app/public/cover.png")
print("cover saved", img.size)

# ── favicon (square keep glyph) ─────────────────────────────────────────
fx = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
fd = ImageDraw.Draw(fx)
fd.rectangle([48, 96, 208, 232], fill=(143, 133, 120))
fd.rectangle([96, 32, 176, 232], fill=(143, 133, 120))
fd.polygon([(88, 40), (184, 40), (136, 0)], fill=(143, 133, 120))
fd.rectangle([112, 128, 144, 232], fill=(74, 53, 36))
fd.polygon([(136, 0), (196, 28), (136, 52)], fill=(47, 111, 208))
fd.rectangle([48, 96, 208, 100], fill=(109, 102, 92))
fd.ellipse([76, 176, 180, 250], fill=(111, 158, 79))
fx.save("/home/user/3536b7e6-db2d-4c9e-9406-0a81a81e5173/iron-empire-9f0476b7-0aec-4146-9bf8-619b59190e77/app/public/favicon.png")
print("favicon saved")
