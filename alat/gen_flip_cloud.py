# Awan besar sebagai "tempat" meja UNO Flip (menggantikan arena bulat di tengah).
# Pakai: python3 gen_flip_cloud.py [folder_keluar]   (bawaan: ../img/flip/table)
# Hasil: cloud-day.png (awan putih bersih, sisi Terang) dan cloud-night.png (awan badai ungu gelap berpendar, sisi Gelap).
# Bentuk awan = gabungan lingkaran (gumpalan) + bayangan dalam; ukuran 900x640 transparan.
import math, os, random, sys
from playwright.sync_api import sync_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img', 'flip', 'table')
os.makedirs(OUT, exist_ok=True)
W, H = 900, 640

# gumpalan: (cx, cy, r). Dasar rata di bawah, gumpalan bulat di atas dan samping (awan "tempat" yang lebar)
blobs = [
    (150, 400, 105), (270, 440, 120), (450, 455, 130), (630, 440, 120), (750, 400, 105),   # deretan bawah (lebar)
    (110, 330, 95), (790, 330, 95),                                                      # sisi
    (200, 265, 115), (340, 215, 125), (480, 190, 135), (620, 215, 125), (710, 265, 112), # atas
    (270, 340, 130), (450, 330, 150), (630, 340, 130),                                   # isi tengah
]
base = ''.join(f'<circle cx="{x}" cy="{y}" r="{r}"/>' for x, y, r in blobs)

def cloud(c_top, c_mid, c_low, c_shadow, edge, glow, sparkle, pk=1.0):
    rnd = random.Random(5)
    # kilau/gumpalan kecil di permukaan untuk memberi tekstur
    puffs = ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="url(#hi)" opacity="{o * pk:.2f}"/>' for x, y, r, o in [
        (190, 250, 70, .9), (345, 190, 80, .9), (490, 165, 88, .95), (630, 195, 78, .9), (715, 255, 66, .85), (130, 320, 56, .7), (780, 320, 56, .7)])
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><defs>
<filter id="soft" x="-10%" y="-10%" width="120%" height="125%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="glow" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur stdDeviation="22"/></filter>
<filter id="drop" x="-20%" y="-20%" width="140%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>
<linearGradient id="body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{c_top}"/><stop offset=".55" stop-color="{c_mid}"/><stop offset="1" stop-color="{c_low}"/></linearGradient>
<radialGradient id="hi" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="{sparkle}" stop-opacity=".95"/><stop offset="1" stop-color="{sparkle}" stop-opacity="0"/></radialGradient>
<clipPath id="cp">{base}</clipPath></defs>
<g filter="url(#glow)" opacity=".9" fill="{glow}" transform="translate(0 18)">{base}</g>
<g filter="url(#drop)" opacity=".5" fill="{c_shadow}" transform="translate(0 62) scale(1 .5)" style="transform-origin:450px 480px">{base}</g>
<g fill="{edge}" stroke="{edge}" stroke-width="14" stroke-linejoin="round" filter="url(#soft)">{base}</g>
<g fill="url(#body)">{base}</g>
<g clip-path="url(#cp)">{puffs}
<ellipse cx="450" cy="560" rx="470" ry="120" fill="{c_shadow}" opacity=".55" filter="url(#drop)"/></g></svg>'''

day = cloud('#ffffff', '#f3f8ff', '#b5d1ef', '#5f8fc4', '#8fb9e6', '#ffffff', '#ffffff')
night = cloud('#4a2f78', '#33205a', '#1f1038', '#0c0418', '#8b5cf6', '#7c3aed', '#b794ff', 0.38)

with sync_playwright() as p:
    b = p.chromium.launch()
    for name, svg in [('cloud-day.png', day), ('cloud-night.png', night)]:
        pg = b.new_page(viewport={'width': W, 'height': H})
        pg.set_content(f'<html><body style="margin:0;background:transparent">{svg}</body></html>')
        pg.screenshot(path=os.path.join(OUT, name), omit_background=True, clip={'x': 0, 'y': 0, 'width': W, 'height': H})
        pg.close()
    b.close()
for n in ('cloud-day.png', 'cloud-night.png'):
    print(n, os.path.getsize(os.path.join(OUT, n)) // 1024, 'KB')
