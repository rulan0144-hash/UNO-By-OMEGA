# Logo UNO SHOW 'EM NO MERCY untuk menu: img/ui/logo-nomercy.png (560x300).
# Oval MERAH (tema kotak asli) + UNO kuning bergaris hitam + dua papan hitam terpisah (SHOW 'EM kecil, NO MERCY lebar) putih menempel di bawah UNO.
# Pakai: python3 gen_nomercy_logo.py [folder_img_ui]
import os, sys, random
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img', 'ui')
F = "font-family=\"Inter, 'DejaVu Sans', sans-serif\" font-weight=\"900\""
FI = F + " font-style=\"italic\""
rnd = random.Random(7)
# sinar gelap di dalam oval
rays = ''
import math
for i in range(26):
    a = i * 360 / 26 + rnd.uniform(-3, 3); w = rnd.uniform(2, 5)
    x2 = 280 + 330 * math.cos(math.radians(a)); y2 = 125 + 330 * math.sin(math.radians(a))
    rays += f'<polygon points="280,125 {x2:.1f},{y2:.1f} {280 + 330 * math.cos(math.radians(a + w)):.1f},{125 + 330 * math.sin(math.radians(a + w)):.1f}" fill="#5a0707" opacity=".45"/>'
# goresan putih halus di papan & oval
def scratches(n, x0, y0, x1, y1, op):
    s = ''
    for _ in range(n):
        x = rnd.uniform(x0, x1); y = rnd.uniform(y0, y1); l = rnd.uniform(6, 26); a = rnd.uniform(-1, 1)
        s += f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{x + l:.1f}" y2="{y + l * a:.1f}" stroke="#fff" stroke-width="{rnd.uniform(.6, 1.6):.1f}" opacity="{op * rnd.uniform(.4, 1):.2f}"/>'
    return s
sc_oval = scratches(40, 70, 40, 490, 210, .5)
sc_ban = scratches(55, 36, 188, 524, 292, .55)
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="560" height="300" viewBox="0 0 560 300"><defs>
<filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000" flood-opacity=".55"/></filter>
<radialGradient id="r" cx=".38" cy=".3" r=".9"><stop offset="0" stop-color="#ff4b3e"/><stop offset=".55" stop-color="#d11414"/><stop offset="1" stop-color="#7d0a0a"/></radialGradient>
<clipPath id="oc"><ellipse cx="280" cy="125" rx="224" ry="95"/></clipPath></defs>
<g filter="url(#sh)"><g transform="rotate(-8 280 125)">
<ellipse cx="280" cy="125" rx="248" ry="118" fill="#111"/><ellipse cx="280" cy="125" rx="238" ry="108" fill="#fff"/><ellipse cx="280" cy="125" rx="224" ry="95" fill="url(#r)"/>
<g clip-path="url(#oc)">{rays}{sc_oval}</g>
<text x="292" y="171" font-size="150" fill="#000" text-anchor="middle" {FI} stroke="#000" stroke-width="30" stroke-linejoin="round">UNO</text>
<text x="280" y="159" font-size="150" fill="#ffd400" text-anchor="middle" {FI} stroke="#000" stroke-width="22" paint-order="stroke" stroke-linejoin="round">UNO</text></g>
<g transform="rotate(-3 280 240)">
<rect x="206" y="184" width="148" height="42" rx="4" fill="#111"/>
<rect x="80" y="220" width="400" height="72" rx="4" fill="#111"/>
<g clip-path="inset(220px 80px 8px 80px)">{sc_ban}</g>
<text x="280" y="213" font-size="24" fill="#fff" text-anchor="middle" {F} letter-spacing="2">SHOW ’EM</text>
<text x="280" y="277" font-size="64" fill="#fff" text-anchor="middle" {F} letter-spacing="1">NO MERCY</text></g></g></svg>'''
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 560, 'height': 300})
    pg.set_content(f'<body style="margin:0;background:transparent">{svg}</body>')
    pg.screenshot(path=os.path.join(OUT, 'logo-nomercy.png'), omit_background=True, clip={'x': 0, 'y': 0, 'width': 560, 'height': 300})
    b.close()
print('logo-nomercy.png dibuat')
