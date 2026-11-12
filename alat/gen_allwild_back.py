# Punggung kartu / DECK UNO ALL WILD: img/allwild/back.png (240x348).  (REVISI 12 Nov v2: gaya sama dengan punggung Klasik/Flex)
# Kartu hitam bertepi putih; oval miring 25 derajat; CINCIN oval berwarna WILD (merah kiri-atas, biru kanan-atas, kuning kiri-bawah,
# hijau kanan-bawah) dengan isi HITAM (sama dengan logo); "UNO" kuning + "ALL WILD!" (ALL putih, W merah, I biru, L hijau, D kuning, ! merah).
# Pakai: python3 gen_allwild_back.py [folder_keluar]   (bawaan: ../img/allwild)
import os, sys
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img', 'allwild')
os.makedirs(OUT, exist_ok=True)
RED, BLUE, YEL, GRN = '#ef4444', '#3b82f6', '#ffd400', '#22c55e'
CX, CY, TILT = 120, 174, 25
F = "font-family=\"Inter, 'DejaVu Sans', sans-serif\" font-weight=\"900\" font-style=\"italic\""
cols = ['#ffffff', '#ffffff', '#ffffff', ' ', RED, BLUE, GRN, YEL, RED]
mk = lambda blk: ''.join(' ' if ch == ' ' else f'<tspan fill="{"#000" if blk else c}"' + (' dx="7"' if ch == 'W' else '') + f'>{ch}</tspan>' for ch, c in zip('ALL WILD!', cols))
sp = mk(False)
clips = (f'<clipPath id="q0"><rect x="-50" y="-50" width="{CX+50}" height="{CY+50}"/></clipPath><clipPath id="q1"><rect x="{CX}" y="-50" width="300" height="{CY+50}"/></clipPath>'
         f'<clipPath id="q2"><rect x="-50" y="{CY}" width="{CX+50}" height="300"/></clipPath><clipPath id="q3"><rect x="{CX}" y="{CY}" width="300" height="300"/></clipPath>')
ring = ''.join(f'<g clip-path="url(#{i})"><ellipse cx="{CX}" cy="{CY}" rx="88" ry="136" fill="{c}"/></g>' for i, c in [('q0', RED), ('q1', BLUE), ('q2', YEL), ('q3', GRN)])
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="240" height="348" viewBox="0 0 240 348"><defs>{clips}</defs>
<rect x="2" y="2" width="236" height="344" rx="26" fill="#fff" stroke="#00000040" stroke-width="2"/><rect x="14" y="14" width="212" height="320" rx="16" fill="#111"/>
<g transform="rotate({TILT} {CX} {CY})">{ring}<ellipse cx="{CX}" cy="{CY}" rx="76" ry="124" fill="#050505" stroke="#111" stroke-width="2"/></g>
<g transform="rotate(-25 {CX} 190)">
<text x="126" y="196" font-size="64" fill="#000" text-anchor="middle" {F} stroke="#000" stroke-width="12" stroke-linejoin="round">UNO</text>
<text x="120" y="188" font-size="64" fill="{YEL}" text-anchor="middle" {F} stroke="#000" stroke-width="9" paint-order="stroke" stroke-linejoin="round">UNO</text>
<text x="125" y="236" font-size="30" fill="#000" text-anchor="middle" {F} stroke="#000" stroke-width="9" stroke-linejoin="round" xml:space="preserve">{mk(True)}</text>
<text x="120" y="230" font-size="30" text-anchor="middle" {F} stroke="#000" stroke-width="7" paint-order="stroke" stroke-linejoin="round" xml:space="preserve">{sp}</text></g></svg>'''
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 240, 'height': 348})
    pg.set_content(f'<html><body style="margin:0;background:transparent">{svg}</body></html>'); pg.wait_for_timeout(300)
    pg.screenshot(path=os.path.join(OUT, 'back.png'), omit_background=True, clip={'x': 0, 'y': 0, 'width': 240, 'height': 348}); b.close()
print('back.png All Wild dibuat')
