# Membuat gambar beranda: img/ui/logo-uno.png (logo) dan img/ui/settings.png (tombol pengaturan)
# Pakai: python3 gen_home.py [folder_img_ui]   (bawaan: ../img/ui)
import math, os, sys
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img', 'ui')
F = "font-family=\"Inter, 'DejaVu Sans', sans-serif\" font-weight=\"900\" font-style=\"italic\""

logo = f'''<svg xmlns="http://www.w3.org/2000/svg" width="560" height="320" viewBox="0 0 560 320"><defs>
<filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000" flood-opacity=".55"/></filter>
<radialGradient id="r" cx=".38" cy=".3" r=".9"><stop offset="0" stop-color="#ff6b6b"/><stop offset=".6" stop-color="#ef4444"/><stop offset="1" stop-color="#b91c1c"/></radialGradient></defs>
<g filter="url(#sh)" transform="rotate(-8 280 150)">
<ellipse cx="280" cy="150" rx="248" ry="118" fill="#111"/>
<ellipse cx="280" cy="150" rx="238" ry="108" fill="#fff"/>
<ellipse cx="280" cy="150" rx="224" ry="95" fill="url(#r)"/>
<text x="292" y="196" font-size="150" fill="#000" text-anchor="middle" {F} stroke="#000" stroke-width="30" stroke-linejoin="round">UNO</text>
<text x="280" y="184" font-size="150" fill="#ffd400" text-anchor="middle" {F} stroke="#000" stroke-width="22" paint-order="stroke" stroke-linejoin="round">UNO</text></g></svg>'''

def gear(cx, cy, ro, ri, teeth=8):
    pts = []
    for i in range(teeth):
        a = 2 * math.pi * i / teeth
        w, w2 = math.pi / teeth * 0.42, math.pi / teeth * 0.3
        for ang, r in [(a - w, ri), (a - w2, ro), (a + w2, ro), (a + w, ri)]:
            pts.append(f'{cx + r * math.cos(ang):.1f},{cy + r * math.sin(ang):.1f}')
    return ' '.join(pts)

settings = f'''<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><defs>
<filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000" flood-opacity=".55"/></filter>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6bf"/><stop offset=".5" stop-color="#facc15"/><stop offset="1" stop-color="#a16207"/></linearGradient>
<radialGradient id="f" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="#2b3a4d"/><stop offset="1" stop-color="#0b1220"/></radialGradient>
<linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbe0"/><stop offset="1" stop-color="#f5b81c"/></linearGradient></defs>
<g filter="url(#sh)"><circle cx="80" cy="78" r="64" fill="#4a3204"/><circle cx="80" cy="78" r="60" fill="url(#g)"/><circle cx="80" cy="78" r="48" fill="url(#f)" stroke="#4a3204" stroke-width="3"/>
<polygon points="{gear(80, 78, 34, 25)}" fill="#4a3204" stroke="#4a3204" stroke-width="6" stroke-linejoin="round"/>
<polygon points="{gear(80, 78, 32, 23)}" fill="url(#b)"/>
<circle cx="80" cy="78" r="11" fill="#0b1220" stroke="#4a3204" stroke-width="3"/></g></svg>'''

with sync_playwright() as p:
    b = p.chromium.launch()
    for name, svg, w, h in [('logo-uno.png', logo, 560, 320), ('settings.png', settings, 160, 160)]:
        pg = b.new_page(viewport={'width': w, 'height': h})
        pg.set_content(f'<body style="margin:0;background:transparent">{svg}</body>')
        pg.screenshot(path=os.path.join(OUT, name), omit_background=True, clip={'x': 0, 'y': 0, 'width': w, 'height': h})
        pg.close()
    b.close()
