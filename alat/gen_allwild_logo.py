# Logo UNO ALL WILD! untuk menu: img/ui/logo-allwild.png (560x300).  (REVISI 12 Nov v2: gaya sama dengan Flip/Flex)
# Oval miring: tepi luar hitam, CINCIN (tempat warna putih di logo lain) berwarna WILD (merah kiri-atas, biru kanan-atas,
# kuning kiri-bawah, hijau kanan-bawah), isi oval HITAM. "UNO" kuning bergaris hitam. "ALL WILD!" menempel di bawah UNO
# menembus tepi oval (seperti FLIP!/FLEX!): ALL putih, W merah, I biru, L hijau, D kuning, ! merah; garis tepi hitam + bayangan.
# Pakai: python3 gen_allwild_logo.py [folder_img_ui]
import os, sys
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img', 'ui')
W, H = 560, 300
RED, BLUE, YEL, GRN = '#ef4444', '#3b82f6', '#ffd400', '#22c55e'
F = "font-family=\"Inter, 'DejaVu Sans', sans-serif\" font-weight=\"900\" font-style=\"italic\""
CX, CY = 280, 125
def quad(rx, ry, fill_extra=''):
    """Elips berwarna wild per kuadran (dipotong clipPath)."""
    cols = [('q0', 0, 0, RED), ('q1', CX, 0, BLUE), ('q2', 0, CY, YEL), ('q3', CX, CY, GRN)]
    return ''.join(f'<g clip-path="url(#{i})"><ellipse cx="{CX}" cy="{CY}" rx="{rx}" ry="{ry}" fill="{c}"/></g>' for i, _, _, c in cols)
clips = (f'<clipPath id="q0"><rect x="-50" y="-50" width="{CX+50}" height="{CY+50}"/></clipPath>'
         f'<clipPath id="q1"><rect x="{CX}" y="-50" width="{W}" height="{CY+50}"/></clipPath>'
         f'<clipPath id="q2"><rect x="-50" y="{CY}" width="{CX+50}" height="{H}"/></clipPath>'
         f'<clipPath id="q3"><rect x="{CX}" y="{CY}" width="{W}" height="{H}"/></clipPath>')
txt_cols = ['#ffffff', '#ffffff', '#ffffff', ' ', RED, BLUE, GRN, YEL, RED]   # A L L _ W I L D !
def spans(black=False):
    s = ''
    for ch, c in zip('ALL WILD!', txt_cols):
        s += ' ' if ch == ' ' else f'<tspan fill="{"#000" if black else c}"' + (' dx="16"' if ch == 'W' else '') + f'>{ch}</tspan>'
    return s
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><defs>
<filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000" flood-opacity=".55"/></filter>
<radialGradient id="r" cx=".38" cy=".3" r=".9"><stop offset="0" stop-color="#2a2a2a"/><stop offset=".6" stop-color="#0c0c0c"/><stop offset="1" stop-color="#000"/></radialGradient>{clips}</defs>
<g filter="url(#sh)"><g transform="rotate(-8 {CX} {CY})">
<ellipse cx="{CX}" cy="{CY}" rx="248" ry="118" fill="#111"/>{quad(240,110)}
<ellipse cx="{CX}" cy="{CY}" rx="221" ry="92" fill="url(#r)" stroke="#111" stroke-width="3"/>
<text x="292" y="171" font-size="150" fill="#000" text-anchor="middle" {F} stroke="#000" stroke-width="30" stroke-linejoin="round">UNO</text>
<text x="280" y="159" font-size="150" fill="{YEL}" text-anchor="middle" {F} stroke="#000" stroke-width="22" paint-order="stroke" stroke-linejoin="round">UNO</text></g>
<g transform="rotate(-4 280 222)">
<text x="294" y="258" font-size="78" fill="#000" text-anchor="middle" {F} stroke="#000" stroke-width="22" stroke-linejoin="round" xml:space="preserve">{spans(True)}</text>
<text x="288" y="250" font-size="78" text-anchor="middle" {F} stroke="#000" stroke-width="16" paint-order="stroke" stroke-linejoin="round" xml:space="preserve">{spans()}</text></g></g></svg>'''
if __name__ == '__main__':
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width': W, 'height': H})
        pg.set_content(f'<body style="margin:0;background:transparent">{svg}</body>'); pg.wait_for_timeout(300)
        pg.screenshot(path=os.path.join(OUT, 'logo-allwild.png'), omit_background=True, clip={'x': 0, 'y': 0, 'width': W, 'height': H})
        b.close()
    print('logo-allwild.png dibuat')
