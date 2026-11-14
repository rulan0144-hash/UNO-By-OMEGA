# Punggung kartu / DECK UNO SHOW 'EM NO MERCY: img/nomercy/back.png (240x348).
# Mengikuti foto punggung asli: tepi HITAM tebal bergores, isi MERAH dengan sinar gelap dari tengah + goresan putih,
# "UNO" kuning bergaris hitam, papan hitam kecil "SHOW 'EM" + papan hitam lebar "NO MERCY" (putih), miring sekitar -10 derajat.
# Pakai: python3 gen_nomercy_back.py [folder_keluar]   (bawaan: ../img/nomercy)
import os, sys, math, random
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img', 'nomercy')
os.makedirs(OUT, exist_ok=True)
rnd = random.Random(11)
F = "font-family=\"Inter, 'DejaVu Sans', sans-serif\" font-weight=\"900\""
FI = F + " font-style=\"italic\""
CX, CY = 120, 174
rays = ''
for i in range(34):
    a = i * 360 / 34 + rnd.uniform(-3, 3); w = rnd.uniform(2.5, 6)
    x1 = CX + 400 * math.cos(math.radians(a)); y1 = CY + 400 * math.sin(math.radians(a))
    x2 = CX + 400 * math.cos(math.radians(a + w)); y2 = CY + 400 * math.sin(math.radians(a + w))
    rays += f'<polygon points="{CX},{CY} {x1:.1f},{y1:.1f} {x2:.1f},{y2:.1f}" fill="#5a0707" opacity=".5"/>'
def scratches(n, x0, y0, x1, y1, op, lmax=22):
    s = ''
    for _ in range(n):
        x = rnd.uniform(x0, x1); y = rnd.uniform(y0, y1); l = rnd.uniform(4, lmax); a = rnd.uniform(-1.2, 1.2)
        s += f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{x + l:.1f}" y2="{y + l * a:.1f}" stroke="#fff" stroke-width="{rnd.uniform(.5, 1.4):.1f}" opacity="{op * rnd.uniform(.35, 1):.2f}"/>'
    return s
sc_card = scratches(110, 16, 16, 224, 332, .55)
sc_edge = scratches(70, 2, 2, 238, 346, .35, 14)
sc_ban = scratches(26, 18, 238, 222, 292, .55, 16)
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="240" height="348" viewBox="0 0 240 348"><defs>
<radialGradient id="r" cx=".5" cy=".5" r=".75"><stop offset="0" stop-color="#e01616"/><stop offset=".6" stop-color="#c20f0f"/><stop offset="1" stop-color="#8a0a0a"/></radialGradient>
<clipPath id="ic"><rect x="14" y="14" width="212" height="320" rx="14"/></clipPath>
<filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#000" flood-opacity=".5"/></filter></defs>
<rect x="1" y="1" width="238" height="346" rx="24" fill="#0c0c0c"/>
<g clip-path="inset(0 round 24px)">{sc_edge}</g>
<rect x="14" y="14" width="212" height="320" rx="14" fill="url(#r)"/>
<g clip-path="url(#ic)">{rays}{sc_card}</g>
<g filter="url(#sh)"><g transform="rotate(-10 {CX} {CY})">
<text x="{CX + 6}" y="{CY - 4}" font-size="78" fill="#000" text-anchor="middle" {FI} stroke="#000" stroke-width="17" stroke-linejoin="round">UNO</text>
<text x="{CX}" y="{CY - 12}" font-size="78" fill="#ffd400" text-anchor="middle" {FI} stroke="#000" stroke-width="12" paint-order="stroke" stroke-linejoin="round">UNO</text>
<rect x="{CX - 40}" y="{CY - 8}" width="80" height="26" rx="3" fill="#111"/>
<text x="{CX}" y="{CY + 10}" font-size="13" fill="#fff" text-anchor="middle" {F} letter-spacing="1.2">SHOW ’EM</text>
<rect x="{CX - 92}" y="{CY + 14}" width="184" height="40" rx="3" fill="#111"/>
<g clip-path="inset({CY + 14}px {CX - 92}px {348 - CY - 54}px {CX - 92}px)">{scratches(24, CX - 92, CY + 14, CX + 92, CY + 54, .55, 16)}</g>
<text x="{CX}" y="{CY + 45}" font-size="31" fill="#fff" text-anchor="middle" {F} letter-spacing=".5">NO MERCY</text></g></g>
</svg>'''
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 240, 'height': 348})
    pg.set_content(f'<html><body style="margin:0;background:transparent">{svg}</body></html>'); pg.wait_for_timeout(300)
    pg.screenshot(path=os.path.join(OUT, 'back.png'), omit_background=True, clip={'x': 0, 'y': 0, 'width': 240, 'height': 348}); b.close()
print('back.png No Mercy dibuat')
