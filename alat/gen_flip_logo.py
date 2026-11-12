# Logo UNO FLIP! untuk menu: img/ui/logo-flip.png (oval ungu + tulisan "FLIP!" putih bergaris tepi hitam tebal TANPA papan, menempel di bawah UNO, menembus tepi oval). Pakai: python3 gen_flip_logo.py [folder_img_ui]
import os, sys
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img', 'ui')
F = "font-family=\"Inter, 'DejaVu Sans', sans-serif\" font-weight=\"900\" font-style=\"italic\""
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="560" height="300" viewBox="0 0 560 300"><defs>
<filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000" flood-opacity=".55"/></filter>
<radialGradient id="r" cx=".38" cy=".3" r=".9"><stop offset="0" stop-color="#a78bfa"/><stop offset=".6" stop-color="#7c3aed"/><stop offset="1" stop-color="#4c1d95"/></radialGradient></defs>
<g filter="url(#sh)"><g transform="rotate(-8 280 125)">
<ellipse cx="280" cy="125" rx="248" ry="118" fill="#111"/><ellipse cx="280" cy="125" rx="238" ry="108" fill="#fff"/><ellipse cx="280" cy="125" rx="224" ry="95" fill="url(#r)"/>
<text x="292" y="171" font-size="150" fill="#000" text-anchor="middle" {F} stroke="#000" stroke-width="30" stroke-linejoin="round">UNO</text>
<text x="280" y="159" font-size="150" fill="#ffd400" text-anchor="middle" {F} stroke="#000" stroke-width="22" paint-order="stroke" stroke-linejoin="round">UNO</text></g>
<g transform="rotate(-4 280 222)">
<text x="287" y="258" font-size="92" fill="#000" text-anchor="middle" {F} stroke="#000" stroke-width="22" stroke-linejoin="round" letter-spacing="2">FLIP!</text>
<text x="280" y="250" font-size="92" fill="#fff" text-anchor="middle" {F} stroke="#000" stroke-width="16" paint-order="stroke" stroke-linejoin="round" letter-spacing="2">FLIP!</text></g></g></svg>'''
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 560, 'height': 300})
    pg.set_content(f'<body style="margin:0;background:transparent">{svg}</body>')
    pg.screenshot(path=os.path.join(OUT, 'logo-flip.png'), omit_background=True, clip={'x': 0, 'y': 0, 'width': 560, 'height': 300})
    b.close()
print('logo-flip.png dibuat')
