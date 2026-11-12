# Meja UNO Flex bertema DAPUR: talenan kayu penuh bekas sayatan pisau + piring/talenan bulat di tengah.
# Pakai: python3 gen_flex_table.py [folder_keluar]   (bawaan: ../img/flex/table)
# Hasil: board.png (540x960 latar potret), center.png (512x512 talenan bulat tengah meja)
import os, random, sys, math
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img', 'flex', 'table')
os.makedirs(OUT, exist_ok=True)
rnd = random.Random(77)

def cuts(w, h, n, dark, light):
    """Bekas sayatan pisau: garis tipis gelap + tepi terang, sebagian bersilang, ada goresan dalam/pendek."""
    out = ''
    for _ in range(n):
        x, y = rnd.uniform(0, w), rnd.uniform(0, h)
        ang = rnd.choice([rnd.uniform(-.5, .5), rnd.uniform(1.0, 2.1), rnd.uniform(-2.1, -1.0)])
        ln = rnd.choice([rnd.uniform(10, 30), rnd.uniform(14, 44), rnd.uniform(24, 70), rnd.uniform(50, 110)])
        bend = rnd.uniform(-6, 6)
        x2, y2 = x + math.cos(ang) * ln, y + math.sin(ang) * ln
        mx, my = (x + x2) / 2 + bend, (y + y2) / 2 + bend
        sw = rnd.choice([.6, .8, 1, 1.3, 1.8]); op = rnd.uniform(.18, .5)
        d = f'M{x:.0f},{y:.0f} Q{mx:.0f},{my:.0f} {x2:.0f},{y2:.0f}'
        out += (f'<path d="{d}" stroke="{light}" stroke-width="{sw+1.2:.1f}" fill="none" opacity="{op*.5:.2f}" transform="translate(0.8 1)"/>'
                f'<path d="{d}" stroke="{dark}" stroke-width="{sw}" fill="none" stroke-linecap="round" opacity="{op:.2f}"/>')
    return out

def grain(w, h, c1, c2, seed):
    return f'''<filter id="gr" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.004 0.09" numOctaves="4" seed="{seed}"/>
<feColorMatrix type="matrix" values="0 0 0 0 {c1[0]}  0 0 0 0 {c1[1]}  0 0 0 0 {c1[2]}  0 0 0 1.6 -.55"/></filter>'''

# ---------- latar: talenan kayu besar (papan-papan) di atas meja dapur ----------
planks = ''
x = 0
ws = [96, 78, 110, 84, 92, 80]
tones = ['#c98f55', '#b97f47', '#d09a62', '#bf8650', '#c58a50', '#b57a44']
for i, pw in enumerate(ws):
    planks += f'<rect x="{x}" y="0" width="{pw}" height="960" fill="{tones[i]}"/><rect x="{x}" y="0" width="2.5" height="960" fill="#5a3416" opacity=".55"/>'
    x += pw
board = f'''<svg xmlns="http://www.w3.org/2000/svg" width="540" height="960" viewBox="0 0 540 960"><defs>
{grain(540, 960, (.35, .2, .08), None, 5)}
<radialGradient id="v" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#2a1608" stop-opacity=".55"/></radialGradient></defs>
{planks}
<rect width="540" height="960" filter="url(#gr)" opacity=".55"/>
{cuts(540, 960, 900, '#3a1f0c', '#f0c890')}
{cuts(540, 960, 40, '#25130a', '#e9b97a')}
<rect width="540" height="960" fill="url(#v)"/></svg>'''

# ---------- tengah meja: talenan bulat bergagang + sayatan ----------
center = f'''<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs>
{grain(512, 512, (.3, .17, .06), None, 9)}
<clipPath id="c"><circle cx="256" cy="256" r="224"/></clipPath>
<radialGradient id="rg" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#e0aa6f"/><stop offset="1" stop-color="#b9824a"/></radialGradient></defs>
<ellipse cx="262" cy="270" rx="236" ry="232" fill="#000" opacity=".35"/>
<rect x="228" y="6" width="56" height="64" rx="22" fill="#8c5a2e" stroke="#4a2a10" stroke-width="5"/><circle cx="256" cy="30" r="9" fill="#2a1608" opacity=".8"/>
<circle cx="256" cy="256" r="232" fill="#8c5a2e" stroke="#4a2a10" stroke-width="6"/>
<circle cx="256" cy="256" r="224" fill="url(#rg)"/>
<g clip-path="url(#c)"><rect width="512" height="512" filter="url(#gr)" opacity=".5"/>
{cuts(512, 512, 320, '#3a1f0c', '#f6d9ae')}<circle cx="256" cy="256" r="224" fill="none" stroke="#6b4020" stroke-width="10" opacity=".5"/></g></svg>'''

with sync_playwright() as p:
    b = p.chromium.launch()
    for name, svg, w, h in [('board.png', board, 540, 960), ('center.png', center, 512, 512)]:
        pg = b.new_page(viewport={'width': w, 'height': h})
        pg.set_content(f'<body style="margin:0;background:transparent">{svg}</body>'); pg.wait_for_timeout(300)
        pg.screenshot(path=os.path.join(OUT, name), omit_background=True, clip={'x': 0, 'y': 0, 'width': w, 'height': h}); pg.close()
    b.close()
print('meja dapur dibuat di', os.path.abspath(OUT))
