# Meja UNO ALL WILD bertema LUAR ANGKASA (konsep 12 Nov, menggantikan hutan rimba): langit malam ungu-biru tua, awan nebula
# 4 warna (merah/biru/kuning/hijau) yang samar, ratusan bintang (titik + kilau 4 sudut), planet bercincin, bintang jatuh,
# dan di tengah "CAKRA ORBIT": cincin gelap bergaris putih dengan 4 busur warna (merah kiri-atas, biru kanan-atas,
# kuning kiri-bawah, hijau kanan-bawah) - busur warna AKTIF menyala terang, lainnya redup. Pusat gelap = tempat tumpukan buangan.
# Pakai: python3 gen_allwild_table.py [folder_keluar]   (bawaan: ../img/allwild/table)
# Hasil: board.png (540x960 latar potret), center.png (512x512, 4 busur menyala sedang = belum ada warna),
#        center-<Warna>.png (Red/Yellow/Green/Blue: busur itu menyala terang, lainnya redup). Nama berkas SAMA dengan versi hutan.
import os, random, sys, math
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img', 'allwild', 'table')
os.makedirs(OUT, exist_ok=True)
rnd = random.Random(1112)
COL = {'Red': '#ef4444', 'Blue': '#3b82f6', 'Yellow': '#facc15', 'Green': '#22c55e'}
LT = {'Red': '#fca5a5', 'Blue': '#93c5fd', 'Yellow': '#fef08a', 'Green': '#86efac'}
names = list(COL)

def sparkle(x, y, r, c='#fff', op=1):
    return (f'<path transform="translate({x:.0f} {y:.0f})" d="M0,{-r:.1f} C{r*.12:.1f},{-r*.25:.1f} {r*.25:.1f},{-r*.12:.1f} {r:.1f},0 '
            f'C{r*.25:.1f},{r*.12:.1f} {r*.12:.1f},{r*.25:.1f} 0,{r:.1f} C{-r*.12:.1f},{r*.25:.1f} {-r*.25:.1f},{r*.12:.1f} {-r:.1f},0 '
            f'C{-r*.25:.1f},{-r*.12:.1f} {-r*.12:.1f},{-r*.25:.1f} 0,{-r:.1f} Z" fill="{c}" opacity="{op}"/>')

# ---------------- papan ----------------
stars = ''
for _ in range(420):                       # bintang kecil
    x, y = rnd.uniform(0, 540), rnd.uniform(0, 960)
    r = rnd.choice([.6, .8, 1, 1.2, 1.6]); tint = rnd.choice(['#ffffff', '#ffffff', '#dbeafe', '#fef9c3', '#fecaca'])
    stars += f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r}" fill="{tint}" opacity="{rnd.uniform(.45, 1):.2f}"/>'
for _ in range(34):                        # bintang kilau 4 sudut (berwarna 4 warna UNO)
    x, y = rnd.uniform(14, 526), rnd.uniform(14, 946); n = rnd.choice(names + ['W', 'W'])
    c = '#fff' if n == 'W' else LT[n]; r = rnd.uniform(6, 15)
    stars += f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r*1.25:.0f}" fill="{c}" opacity=".07"/>' + sparkle(x, y, r, c, .95)

def nebula(cx, cy, rx, ry, col, op, rot):
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{col}" opacity="{op}" transform="rotate({rot} {cx} {cy})"/>'
neb = (nebula(90, 130, 220, 110, COL['Red'], .50, -28) + nebula(470, 220, 230, 100, COL['Blue'], .55, 24)
       + nebula(80, 820, 230, 110, COL['Yellow'], .30, 25) + nebula(470, 840, 230, 120, COL['Green'], .38, -22)
       + nebula(270, 480, 190, 90, '#7c3aed', .35, 70) + nebula(270, 60, 260, 70, '#6d28d9', .35, 0))

# planet bercincin (kiri-atas samar) + planet kecil + bulan
planet = f'''<g transform="translate(436 118)">
<ellipse cx="0" cy="0" rx="92" ry="26" fill="none" stroke="#fde68a" stroke-width="9" opacity=".5" transform="rotate(-22)"/>
<circle r="46" fill="url(#pl1)"/>
<path d="M-92,0 A92,26 0 0 0 92,0" fill="none" stroke="#fde68a" stroke-width="9" opacity=".8" transform="rotate(-22)"/>
</g>'''
planet2 = '<g transform="translate(70 770)"><circle r="40" fill="url(#pl2)"/><ellipse rx="40" ry="9" cy="6" fill="#000" opacity=".12"/><circle r="40" fill="url(#shade)"/></g>'
moon = '<g transform="translate(120 255)"><circle r="17" fill="#e5e7eb"/><circle cx="-5" cy="-3" r="4" fill="#cbd5e1"/><circle cx="6" cy="6" r="3" fill="#cbd5e1"/><circle r="17" fill="url(#shade)"/></g>'
comet = (f'<g transform="rotate(-20 470 700)"><path d="M470,700 L310,700" stroke="url(#tail)" stroke-width="5" stroke-linecap="round"/></g>'
         '<circle cx="470" cy="700" r="5" fill="#fff"/><circle cx="470" cy="700" r="14" fill="#fff" opacity=".25"/>')

board = f'''<svg xmlns="http://www.w3.org/2000/svg" width="540" height="960" viewBox="0 0 540 960"><defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0b2e"/><stop offset=".5" stop-color="#090a22"/><stop offset="1" stop-color="#04040f"/></linearGradient>
<radialGradient id="vg" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient>
<radialGradient id="pl1" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#fde68a"/><stop offset=".6" stop-color="#f59e0b"/><stop offset="1" stop-color="#7c2d12"/></radialGradient>
<radialGradient id="pl2" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#86efac"/><stop offset=".6" stop-color="#16a34a"/><stop offset="1" stop-color="#052e16"/></radialGradient>
<radialGradient id="shade" cx=".3" cy=".3" r=".95"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
<linearGradient id="tail" gradientUnits="userSpaceOnUse" x1="470" y1="0" x2="310" y2="0"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<clipPath id="front"><rect x="-120" y="0" width="240" height="60"/></clipPath>
<filter id="blur"><feGaussianBlur stdDeviation="38"/></filter></defs>
<rect width="540" height="960" fill="url(#sky)"/>
<g filter="url(#blur)">{neb}</g>
{stars}{planet}{planet2}{moon}{comet}
<rect width="540" height="960" fill="url(#vg)"/></svg>'''

# ---------------- cakra orbit ----------------
def wedge(rin, rout, a0, a1):
    """Potongan cincin (derajat, 0 = kanan, searah jarum jam)."""
    p = lambda r, a: (256 + r * math.cos(math.radians(a)), 256 + r * math.sin(math.radians(a)))
    x0, y0 = p(rout, a0); x1, y1 = p(rout, a1); x2, y2 = p(rin, a1); x3, y3 = p(rin, a0)
    return f'M{x0:.1f},{y0:.1f} A{rout},{rout} 0 0 1 {x1:.1f},{y1:.1f} L{x2:.1f},{y2:.1f} A{rin},{rin} 0 0 0 {x3:.1f},{y3:.1f} Z'

def center(active=None):
    # kuadran (sudut layar, searah jarum jam): Blue kanan-atas 270-360, Green kanan-bawah 0-90, Yellow kiri-bawah 90-180, Red kiri-atas 180-270
    quad = {'Red': (180, 270), 'Blue': (270, 360), 'Green': (0, 90), 'Yellow': (90, 180)}
    segs, glows, defs = '', '', ''
    for n, (a0, a1) in quad.items():
        on = active == n; dim = active is not None and not on
        op = 1 if on else (.9 if active is None else .28)
        d = wedge(116, 218, a0 + 3, a1 - 3)
        defs += f'<linearGradient id="g{n}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{LT[n]}"/><stop offset=".55" stop-color="{COL[n]}"/><stop offset="1" stop-color="{COL[n]}" stop-opacity=".7"/></linearGradient>'
        if on:
            glows += f'<path d="{d}" fill="{COL[n]}" opacity=".95" filter="url(#gl)"/>'
        segs += (f'<path d="{d}" fill="url(#g{n})" opacity="{op}" stroke="#fff" stroke-width="{5 if on else 3}" stroke-opacity="{1 if on else .55}" stroke-linejoin="round"/>')
        am = math.radians((a0 + a1) / 2); sx, sy = 256 + 167 * math.cos(am), 256 + 167 * math.sin(am)
        segs += sparkle(sx, sy, 22 if on else 16, '#fff', 1 if on else .5)
    ticks = ''.join(f'<circle cx="{256 + 238*math.cos(math.radians(a)):.1f}" cy="{256 + 238*math.sin(math.radians(a)):.1f}" r="2.6" fill="#fff" opacity=".8"/>' for a in range(0, 360, 10))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs>{defs}
<radialGradient id="hub" cx=".5" cy=".5" r=".5"><stop offset=".75" stop-color="#0a0a1c"/><stop offset="1" stop-color="#15153a"/></radialGradient>
<filter id="gl" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter></defs>
<circle cx="262" cy="270" r="240" fill="#000" opacity=".4"/>
<circle cx="256" cy="256" r="238" fill="#07071a" stroke="#fff" stroke-width="5"/>
<circle cx="256" cy="256" r="226" fill="none" stroke="#fff" stroke-width="2" opacity=".35"/>
{ticks}
{glows}{segs}
<circle cx="256" cy="256" r="116" fill="#05050f" stroke="#fff" stroke-width="5"/>
<circle cx="256" cy="256" r="104" fill="url(#hub)"/></svg>'''

jobs = [('board.png', board, 540, 960), ('center.png', center(None), 512, 512)] + [(f'center-{n}.png', center(n), 512, 512) for n in names]
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, svg, w, h in jobs:
        pg = b.new_page(viewport={'width': w, 'height': h})
        pg.set_content(f'<body style="margin:0;background:transparent">{svg}</body>'); pg.wait_for_timeout(300)
        pg.screenshot(path=os.path.join(OUT, name), omit_background=True, clip={'x': 0, 'y': 0, 'width': w, 'height': h}); pg.close()
    b.close()
from PIL import Image
ROOT = os.path.join(os.path.dirname(OUT), '..', '..')
bd = Image.open(os.path.join(OUT, 'board.png')).convert('RGBA')
ct = Image.open(os.path.join(OUT, 'center-Blue.png')).convert('RGBA').resize((330, 330))
bd.paste(ct, (105, 315), ct); bd.save(os.path.join(ROOT, 'preview-allwild-table.png'))
sh = Image.new('RGBA', (5 * 210, 210), '#1f2937')
for i, n in enumerate(['center'] + [f'center-{c}' for c in names]):
    if i < 5:
        im = Image.open(os.path.join(OUT, n + '.png')).convert('RGBA').resize((200, 200)); sh.paste(im, (i * 210 + 5, 5), im)
sh.save(os.path.join(ROOT, 'preview-allwild-center.png'))
print('meja All Wild (luar angkasa) dibuat di', os.path.abspath(OUT))
