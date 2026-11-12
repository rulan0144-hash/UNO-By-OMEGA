# Meja UNO SHOW 'EM NO MERCY bertema ARENA BERTARUNG (konsep 12 Nov): lantai beton gelap penuh retakan & noda darah kering,
# lampu sorot dari atas, penonton bersiluet di atas & bawah (pagar belang kuning-hitam), pagar kawat di kiri-kanan, dan di tengah
# "KANDANG OKTAGON": cincin pagar kawat bertiang 8 (4 tiang sudut bergambar tengkorak, 4 tiang lain berwarna), matras 4 warna
# (merah kiri-atas, biru kanan-atas, kuning kiri-bawah, hijau kanan-bawah) dengan cakar di tiap warna.
# Warna AKTIF menyala terang + bersinar, tiga lainnya redup. Pusat gelap (oktagon) = tempat tumpukan buangan.
# Pakai: python3 gen_nomercy_table.py [folder_keluar]   (bawaan: ../img/nomercy/table)
# Hasil: board.png (540x960 latar potret), center.png (512x512, 4 warna menyala sedang = belum ada warna),
#        center-<Warna>.png (Red/Yellow/Green/Blue: warna itu menyala terang, lainnya redup). Pola nama sama dengan meja All Wild.
import os, random, sys, math
from playwright.sync_api import sync_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img', 'nomercy', 'table')
os.makedirs(OUT, exist_ok=True)
rnd = random.Random(1113)
COL = {'Red': '#ef4444', 'Blue': '#3b82f6', 'Yellow': '#facc15', 'Green': '#22c55e'}
LT = {'Red': '#fca5a5', 'Blue': '#93c5fd', 'Yellow': '#fef08a', 'Green': '#86efac'}
names = list(COL)


# ======================= PAPAN (latar 540x960) =======================
def crack(x, y, ang, ln, depth=0):
    pts = [(x, y)]
    a = ang
    n = 7 if depth == 0 else 4
    seg = ln / n
    out = ''
    for _ in range(n):
        a += rnd.uniform(-.55, .55)
        x += math.cos(a) * seg * rnd.uniform(.6, 1.3)
        y += math.sin(a) * seg * rnd.uniform(.6, 1.3)
        pts.append((x, y))
        if depth < 2 and rnd.random() < .3:
            out += crack(x, y, a + rnd.choice([-1, 1]) * rnd.uniform(.5, 1.1), ln * .45, depth + 1)
    d = 'M' + ' L'.join(f'{px:.1f},{py:.1f}' for px, py in pts)
    out += (f'<path d="{d}" stroke="#000" stroke-width="{2.6 - depth * .7:.1f}" fill="none" opacity=".8" stroke-linejoin="round"/>'
            f'<path d="{d}" transform="translate(1 1.3)" stroke="#9a817a" stroke-width=".7" fill="none" opacity=".28"/>')
    return out


def splat(cx, cy, s, rot):
    out = f'<ellipse cx="{cx}" cy="{cy}" rx="{s * 1.25:.0f}" ry="{s:.0f}" fill="#33060b" opacity=".7" transform="rotate({rot} {cx} {cy})"/>'
    out += f'<ellipse cx="{cx}" cy="{cy}" rx="{s * .6:.0f}" ry="{s * .45:.0f}" fill="#4a0a12" opacity=".55" transform="rotate({rot} {cx} {cy})"/>'
    for _ in range(int(s / 2) + 5):
        a = rnd.uniform(0, math.tau)
        dd = s * rnd.uniform(1.2, 3.2)
        out += f'<circle cx="{cx + math.cos(a) * dd:.0f}" cy="{cy + math.sin(a) * dd:.0f}" r="{rnd.uniform(.8, max(1.6, s * .17)):.1f}" fill="#4a0a12" opacity=".6"/>'
    return out


def person(x, base, r, fill, ext):
    cy = base - r * 2.2
    out = f'<rect x="{x - r * 1.6:.1f}" y="{cy + r * 1.3:.1f}" width="{r * 3.2:.1f}" height="{base - cy - r * 1.3 + ext:.1f}" rx="{r:.1f}" fill="{fill}"/>'
    out += f'<ellipse cx="{x:.1f}" cy="{cy + r * 1.5:.1f}" rx="{r * 1.9:.1f}" ry="{r * 1.2:.1f}" fill="{fill}"/>'
    out += f'<circle cx="{x:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{fill}"/>'
    if rnd.random() < .32:                                  # tangan terangkat mengepal
        s = rnd.choice([-1, 1])
        ex, ey = x + s * r * rnd.uniform(1.8, 3), cy - r * rnd.uniform(1.4, 2.6)
        out += f'<line x1="{x + s * r * 1.5:.1f}" y1="{cy + r * 1.6:.1f}" x2="{ex:.1f}" y2="{ey:.1f}" stroke="{fill}" stroke-width="{r * .75:.1f}" stroke-linecap="round"/>'
        out += f'<circle cx="{ex:.1f}" cy="{ey:.1f}" r="{r * .55:.1f}" fill="{fill}"/>'
    return out


def crowd(base, ext):
    out = ''
    x = -8
    while x < 560:                                           # baris belakang (lebih terang & kecil)
        out += person(x, base - 13, rnd.uniform(7, 9), '#1f1014', ext)
        x += rnd.uniform(15, 22)
    x = -14
    while x < 560:                                           # baris depan
        out += person(x, base, rnd.uniform(9, 12.5), '#07030a', ext)
        x += rnd.uniform(20, 29)
    return out


stripes_defs = ('<pattern id="haz" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
                '<rect width="26" height="26" fill="#111"/><rect width="13" height="26" fill="#eab308"/></pattern>'
                '<pattern id="mesh" width="14" height="14" patternUnits="userSpaceOnUse">'
                '<path d="M0,7 L7,0 L14,7 L7,14 Z" fill="none" stroke="#9ca3af" stroke-width="1.3"/></pattern>')

cracks = ''
for _ in range(11):
    cracks += crack(rnd.uniform(30, 510), rnd.uniform(130, 830), rnd.uniform(0, math.tau), rnd.uniform(70, 170))

blood = ''
for cx, cy, s, rot in [(92, 318, 26, 20), (452, 640, 30, -35), (380, 210, 18, 60), (150, 760, 22, 10), (470, 380, 14, 0), (60, 560, 16, 40)]:
    blood += splat(cx, cy, s, rot)
for cx, cy, w, h, rot in [(300, 300, 120, 7, 28), (210, 690, 100, 6, -20), (430, 520, 80, 5, 70)]:       # bekas seretan
    blood += f'<ellipse cx="{cx}" cy="{cy}" rx="{w}" ry="{h}" fill="#2a050a" opacity=".42" transform="rotate({rot} {cx} {cy})" filter="url(#soft)"/>'

fence = ''
for side in (0, 1):                                          # pagar kawat kiri & kanan
    x0 = 0 if side == 0 else 506
    fence += f'<rect x="{x0}" y="70" width="34" height="820" fill="#000" opacity=".4"/><rect x="{x0}" y="70" width="34" height="820" fill="url(#mesh)" opacity=".42"/>'
    for y in range(70, 891, 164):
        fence += f'<rect x="{x0 + 14}" y="{y - 4}" width="9" height="12" rx="3" fill="#4b5563" stroke="#111" stroke-width="1.5"/>'
        fence += f'<rect x="{x0 + 16}" y="{y}" width="5" height="164" fill="#374151" opacity=".9"/>'
    fence += f'<line x1="{x0 + (34 if side == 0 else 0)}" y1="70" x2="{x0 + (34 if side == 0 else 0)}" y2="890" stroke="#6b7280" stroke-width="3" opacity=".8"/>'

cone = lambda xs: f'<polygon points="{xs[0]},0 {xs[1]},0 {xs[2]},780 {xs[3]},780" fill="url(#cone)"/>'
lights = ''
for lx in (112, 428):
    lights += (f'<rect x="{lx - 20}" y="0" width="40" height="11" rx="3" fill="#111"/><circle cx="{lx}" cy="11" r="38" fill="#f59e0b" opacity=".3"/>'
               f'<circle cx="{lx}" cy="11" r="21" fill="#fde68a" opacity=".5"/><circle cx="{lx}" cy="11" r="9" fill="#fffbeb"/>')

board = f'''<svg xmlns="http://www.w3.org/2000/svg" width="540" height="960" viewBox="0 0 540 960"><defs>{stripes_defs}
<radialGradient id="floor" cx=".5" cy=".5" r=".75"><stop offset="0" stop-color="#2b1b1d"/><stop offset=".6" stop-color="#150b0d"/><stop offset="1" stop-color="#070304"/></radialGradient>
<radialGradient id="pool" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fbbf24" stop-opacity=".2"/><stop offset=".45" stop-color="#991b1b" stop-opacity=".14"/><stop offset="1" stop-color="#7f1d1d" stop-opacity="0"/></radialGradient>
<linearGradient id="cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4" stop-opacity=".30"/><stop offset=".7" stop-color="#fbbf24" stop-opacity=".07"/><stop offset="1" stop-color="#fbbf24" stop-opacity="0"/></linearGradient>
<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9531e" stop-opacity=".38"/><stop offset="1" stop-color="#d9531e" stop-opacity="0"/></linearGradient>
<linearGradient id="hazeB" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#d9531e" stop-opacity=".34"/><stop offset="1" stop-color="#d9531e" stop-opacity="0"/></linearGradient>
<radialGradient id="vg" cx=".5" cy=".5" r=".75"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".72"/></radialGradient>
<filter id="soft" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="blur" ><feGaussianBlur stdDeviation="26"/></filter>
<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7"/>
<feColorMatrix type="matrix" values="0 0 0 0 .8  0 0 0 0 .72  0 0 0 0 .66  1.4 0 0 0 -.55"/></filter>
<filter id="blotch" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".007 .01" numOctaves="4" seed="21"/>
<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.6 0 0 0 -.45"/></filter></defs>
<rect width="540" height="960" fill="url(#floor)"/>
<rect width="540" height="960" filter="url(#blotch)" opacity=".55"/>
<rect width="540" height="960" filter="url(#grain)" opacity=".16"/>
<g filter="url(#blur)" opacity=".9"><ellipse cx="270" cy="480" rx="300" ry="280" fill="url(#pool)"/></g>
{blood}{cracks}
{cone((100, 124, 372, -60))}{cone((416, 440, 600, 168))}
<rect width="540" height="150" fill="url(#haze)"/><rect y="810" width="540" height="150" fill="url(#hazeB)"/>
{crowd(66, 0)}{crowd(962, 60)}
<rect y="64" width="540" height="12" fill="url(#haz)"/><rect y="64" width="540" height="12" fill="#000" opacity=".25"/>
<rect y="884" width="540" height="12" fill="url(#haz)"/><rect y="884" width="540" height="12" fill="#000" opacity=".25"/>
<line x1="0" y1="64" x2="540" y2="64" stroke="#000" stroke-width="2"/><line x1="0" y1="76" x2="540" y2="76" stroke="#000" stroke-width="2"/>
<line x1="0" y1="884" x2="540" y2="884" stroke="#000" stroke-width="2"/><line x1="0" y1="896" x2="540" y2="896" stroke="#000" stroke-width="2"/>
{fence}{lights}
<rect width="540" height="960" fill="url(#vg)"/></svg>'''


# ======================= KANDANG OKTAGON (tengah 512x512) =======================
C = 256


def octo(r, rot=0):
    return ' '.join(f'{C + r * math.cos(math.radians(rot + 45 * k)):.1f},{C + r * math.sin(math.radians(rot + 45 * k)):.1f}' for k in range(8))


def pt(r, a):
    return C + r * math.cos(math.radians(a)), C + r * math.sin(math.radians(a))


def quad_poly(a0, a1, rin, rout):
    out = [pt(rout, a) for a in (a0, a0 + 45, a1)] + [pt(rin, a) for a in (a1, a0 + 45, a0)]
    return ' '.join(f'{x:.1f},{y:.1f}' for x, y in out)


SKULL = ('<g transform="translate({x:.1f} {y:.1f}) scale(1.15)"><path d="M-7,-1 A7,7 0 1 1 7,-1 L7,3 L4,3 L4,7.5 L-4,7.5 L-4,3 L-7,3 Z" fill="#f3f4f6" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/>'
         '<ellipse cx="-3" cy="-0.8" rx="2.1" ry="2.5" fill="#000"/><ellipse cx="3" cy="-0.8" rx="2.1" ry="2.5" fill="#000"/>'
         '<path d="M0,2 L-1.2,4 L1.2,4 Z" fill="#000"/><path d="M-1.6,5.2 V7.4 M0,5.2 V7.4 M1.6,5.2 V7.4" stroke="#000" stroke-width=".9"/></g>')


def center(active=None):
    quad = {'Red': (180, 270), 'Blue': (270, 360), 'Green': (0, 90), 'Yellow': (90, 180)}
    defs, glows, mats, claws, pads = '', '', '', '', ''
    for n, (a0, a1) in quad.items():
        on = active == n
        op = 1 if on else (.92 if active is None else .26)
        poly = quad_poly(a0, a1, 108, 206)
        defs += (f'<linearGradient id="g{n}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{LT[n]}"/><stop offset=".55" stop-color="{COL[n]}"/>'
                 f'<stop offset="1" stop-color="{COL[n]}" stop-opacity=".72"/></linearGradient>')
        if on:
            glows += f'<polygon points="{poly}" fill="{COL[n]}" opacity=".95" filter="url(#gl)"/>'
        mats += (f'<polygon points="{poly}" fill="url(#g{n})" opacity="{op}" stroke="#fff" stroke-width="{5 if on else 3}" '
                 f'stroke-opacity="{1 if on else .55}" stroke-linejoin="round"/>')
        am = (a0 + a1) / 2
        sx, sy = pt(160, am)
        cl = ''.join(f'<path d="M{dx - 5},-17 Q{dx + 3},0 {dx - 5},17" fill="none" stroke="#fff" stroke-width="{4.2 if on else 3.2}" stroke-linecap="round"/>'
                     f'<path d="M{dx - 5},-17 Q{dx + 3},0 {dx - 5},17" fill="none" stroke="#000" stroke-width="1.2" stroke-linecap="round" opacity=".35" transform="translate(1.6 1.2)"/>'
                     for dx in (-10, 0, 10))
        claws += f'<g transform="translate({sx:.1f} {sy:.1f}) rotate({am + 20:.0f}) scale({1.15 if on else 1})" opacity="{1 if on else (.55 if active is None else .3)}">{cl}</g>'
        # tiang diagonal berwarna di tengah kuadran
        px, py = pt(226, am)
        pads += ((f'<circle cx="{px:.1f}" cy="{py:.1f}" r="26" fill="{COL[n]}" opacity=".9" filter="url(#gl)"/>' if on else '')
                 + f'<circle cx="{px:.1f}" cy="{py:.1f}" r="15" fill="url(#g{n})" opacity="{1 if (on or active is None) else .45}" stroke="#fff" stroke-width="3"/>'
                 f'<circle cx="{px - 4:.1f}" cy="{py - 4:.1f}" r="4" fill="#fff" opacity=".45"/>')
    for a in (0, 90, 180, 270):                              # tiang sudut bergambar tengkorak
        px, py = pt(226, a)
        pads += f'<circle cx="{px:.1f}" cy="{py:.1f}" r="17" fill="#0c0709" stroke="#fff" stroke-width="3"/>' + SKULL.format(x=px, y=py)
    mesh = f'<polygon points="{octo(240)}" fill="url(#mesh)" opacity=".55"/>'
    stitch = ''.join(f'<polygon points="{octo(r)}" fill="none" stroke="#fff" stroke-opacity=".13" stroke-width="2" stroke-dasharray="9 7"/>' for r in (150, 182))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs>{defs}{stripes_defs}
<radialGradient id="hub" cx=".5" cy=".5" r=".5"><stop offset=".7" stop-color="#0b0508"/><stop offset="1" stop-color="#2a0c12"/></radialGradient>
<filter id="gl" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter></defs>
<polygon points="{octo(246).replace(',', ' ')}" transform="translate(7 14)" fill="#000" opacity=".42" stroke="none" style="display:none"/>
<polygon points="{octo(246)}" transform="translate(7 14)" fill="#000" opacity=".42"/>
<polygon points="{octo(244)}" fill="#150b0e" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>
{mesh}
<polygon points="{octo(224)}" fill="none" stroke="#9ca3af" stroke-width="4" stroke-linejoin="round"/>
<polygon points="{octo(224)}" fill="none" stroke="#000" stroke-width="1.3" stroke-opacity=".5" stroke-linejoin="round" transform="translate(1.5 2)"/>
<polygon points="{octo(206)}" fill="#0a0508" stroke="#fff" stroke-width="3" stroke-opacity=".7" stroke-linejoin="round"/>
{glows}{mats}{stitch}{claws}
<polygon points="{octo(108)}" fill="#05030a" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>
<polygon points="{octo(97)}" fill="url(#hub)"/>
<polygon points="{octo(97)}" fill="none" stroke="#7f1d1d" stroke-width="3" stroke-opacity=".75" stroke-linejoin="round"/>
{pads}</svg>'''


jobs = [('board.png', board, 540, 960), ('center.png', center(None), 512, 512)] + [(f'center-{n}.png', center(n), 512, 512) for n in names]
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, svg, w, h in jobs:
        pg = b.new_page(viewport={'width': w, 'height': h})
        pg.set_content(f'<body style="margin:0;background:transparent">{svg}</body>')
        pg.wait_for_timeout(400)
        pg.screenshot(path=os.path.join(OUT, name), omit_background=True, clip={'x': 0, 'y': 0, 'width': w, 'height': h})
        pg.close()
    b.close()

# pratinjau (preview-*.png di akar proyek: jangan ikut zip, sudah dikecualikan pack_changes)
from PIL import Image
ROOT = os.path.join(os.path.dirname(OUT), '..', '..')
bd = Image.open(os.path.join(OUT, 'board.png')).convert('RGBA')
ct = Image.open(os.path.join(OUT, 'center-Blue.png')).convert('RGBA').resize((330, 330))
bd.paste(ct, (105, 315), ct)
bd.save(os.path.join(ROOT, 'preview-nomercy-table.png'))
sh = Image.new('RGBA', (5 * 210, 210), '#1f2937')
for i, n in enumerate(['center'] + [f'center-{c}' for c in names]):
    if i < 5:
        im = Image.open(os.path.join(OUT, n + '.png')).convert('RGBA').resize((200, 200))
        sh.paste(im, (i * 210 + 5, 5), im)
sh.save(os.path.join(ROOT, 'preview-nomercy-center.png'))
print('meja No Mercy (arena bertarung) dibuat di', os.path.abspath(OUT))
