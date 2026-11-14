# Efek 'Tumpukan' UNO SHOW 'EM NO MERCY (pemain menumpuk kartu Draw +2/+4/+6/+10): img/nomercy/fx/stack.png (512x512 transparan).
# Ledakan kuning-oranye bergaris putih-hitam + empat kartu berwarna bertumpuk miring + papan hitam "STACK!" (putih).
# Pakai: python3 gen_nomercy_stack_fx.py [folder_fx]   (bawaan: ../img/nomercy/fx)
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_effects_color as g
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img', 'nomercy', 'fx')
os.makedirs(OUT, exist_ok=True)
F = g.FONT
grad = ('<defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#ffe066"/><stop offset=".6" stop-color="#ff9f0a"/>'
        '<stop offset="1" stop-color="#d9480f"/></radialGradient></defs>')
def card(x, y, rot, fill):
    r = '<rect x="-48" y="-68" width="96" height="136" rx="12"'
    return (f'<g transform="translate({x} {y}) rotate({rot})">{r} fill="#000" stroke="#000" stroke-width="12" stroke-linejoin="round"/>'
            f'{r} fill="#fff" stroke="#000" stroke-width="4"/><rect x="-39" y="-59" width="78" height="118" rx="7" fill="{fill}"/>'
            f'<ellipse cx="0" cy="0" rx="22" ry="38" fill="#fff" fill-opacity=".9" transform="rotate(25)"/></g>')
cards = card(176, 214, -24, '#3b82f6') + card(222, 202, -8, '#22c55e') + card(270, 202, 8, '#ffd400') + card(318, 214, 24, '#ef4444')
board = ('<rect x="96" y="338" width="320" height="96" rx="8" fill="#111" transform="rotate(-4 256 386)"/>'
         f'<text x="256" y="411" font-size="74" fill="#fff" text-anchor="middle" {F} letter-spacing="2" transform="rotate(-4 256 386)">STACK!</text>')
body = grad + g.burst(256, 256, 240, 190, 16, 'url(#g)', 6) + cards + board
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 512, 'height': 512})
    pg.set_content(f'<html><body style="margin:0;background:transparent">{g.svg(body)}</body></html>')
    pg.screenshot(path=os.path.join(OUT, 'stack.png'), omit_background=True, clip={'x': 0, 'y': 0, 'width': 512, 'height': 512}); b.close()
print('stack.png dibuat')
