# Efek 'Mercy' UNO SHOW 'EM NO MERCY (pemain tersingkir saat >=25 kartu): img/nomercy/fx/mercy.png (512x512 transparan).
# Ledakan merah bergaris putih-hitam (gaya efek lain) + TENGKORAK putih + papan hitam "MERCY!" (putih).
# Pakai: python3 gen_nomercy_mercy_fx.py [folder_fx]   (bawaan: ../img/nomercy/fx)
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_effects_color as g
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img', 'nomercy', 'fx')
os.makedirs(OUT, exist_ok=True)
F = g.FONT
grad = ('<defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#ff5a4d"/><stop offset=".6" stop-color="#d11414"/>'
        '<stop offset="1" stop-color="#8a0a0a"/></radialGradient></defs>')
def skull(cx, cy):
    s = 1.0
    t = f'<g transform="translate({cx} {cy})">'
    shape = ('<path d="M-78 18 C-96 -62 -52 -104 0 -104 C52 -104 96 -62 78 18 C74 36 60 44 52 50 L52 84 Q52 96 40 96 L-40 96 Q-52 96 -52 84 L-52 50 C-60 44 -74 36 -78 18 Z"')
    t += shape + ' fill="#000" stroke="#000" stroke-width="22" stroke-linejoin="round"/>'
    t += shape + ' fill="#fff" stroke="#000" stroke-width="8" stroke-linejoin="round"/>'
    t += '<ellipse cx="-34" cy="-6" rx="25" ry="29" fill="#111"/><ellipse cx="34" cy="-6" rx="25" ry="29" fill="#111"/>'
    t += '<path d="M0 22 L-13 52 L13 52 Z" fill="#111"/>'
    t += ''.join(f'<line x1="{x}" y1="64" x2="{x}" y2="94" stroke="#111" stroke-width="6" stroke-linecap="round"/>' for x in (-26, -9, 9, 26))
    t += '<line x1="-46" y1="64" x2="46" y2="64" stroke="#111" stroke-width="6" stroke-linecap="round"/>'
    return t + '</g>'
board = ('<rect x="86" y="338" width="340" height="96" rx="8" fill="#111" stroke="#fff" stroke-width="0" transform="rotate(-4 256 386)"/>'
         f'<text x="256" y="411" font-size="74" fill="#fff" text-anchor="middle" {F} letter-spacing="2" transform="rotate(-4 256 386)">MERCY!</text>')
body = grad + g.burst(256, 256, 240, 190, 16, 'url(#g)', -6) + skull(256, 214) + board
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 512, 'height': 512})
    pg.set_content(f'<html><body style="margin:0;background:transparent">{g.svg(body)}</body></html>')
    pg.screenshot(path=os.path.join(OUT, 'mercy.png'), omit_background=True, clip={'x': 0, 'y': 0, 'width': 512, 'height': 512}); b.close()
print('mercy.png dibuat')
