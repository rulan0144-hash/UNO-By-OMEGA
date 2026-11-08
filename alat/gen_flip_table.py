# Membuat gambar meja UNO Flip: siang (awan) untuk sisi Terang, malam seram untuk sisi Gelap.
# Pakai: python3 gen_flip_table.py [folder_keluar]   (bawaan: ../img/flip/table)
# Hasil: sky-day.png, clouds.png (ubin mendatar mulus), night.png, fog.png (ubin mulus), aura.png, eyes.png
import os, random, sys
from playwright.sync_api import sync_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img', 'flip', 'table')
os.makedirs(OUT, exist_ok=True)
rnd = random.Random(44)

# ---------- siang: langit biru + matahari ----------
sky = '''<svg xmlns="http://www.w3.org/2000/svg" width="540" height="960" viewBox="0 0 540 960"><defs>
<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f80d8"/><stop offset=".45" stop-color="#6bb8f2"/><stop offset=".8" stop-color="#b9e3fb"/><stop offset="1" stop-color="#e6f6ff"/></linearGradient>
<radialGradient id="s" cx=".82" cy=".1" r=".55"><stop offset="0" stop-color="#fff9d6" stop-opacity=".95"/><stop offset=".25" stop-color="#fff3a8" stop-opacity=".5"/><stop offset="1" stop-color="#fff3a8" stop-opacity="0"/></radialGradient></defs>
<rect width="540" height="960" fill="url(#g)"/><rect width="540" height="960" fill="url(#s)"/>
<circle cx="445" cy="96" r="34" fill="#fffbe0"/></svg>'''

# ---------- awan: ubin mendatar mulus (feTurbulence stitch), putih berbayang biru lembut ----------
def turb_tile(w, h, fx, fy, octv, seed, mask_stops, rgb, k, off, blur=0):
    stops = ''.join(f'<stop offset="{o}" stop-color="#fff" stop-opacity="{a}"/>' for o, a in mask_stops)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><defs>
<filter id="t" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="{fx} {fy}" numOctaves="{octv}" seed="{seed}" stitchTiles="stitch" result="n"/>
<feColorMatrix in="n" type="matrix" values="0 0 0 0 {rgb[0]}  0 0 0 0 {rgb[1]}  0 0 0 0 {rgb[2]}  {k} 0 0 0 {off}"/>
{f'<feGaussianBlur stdDeviation="{blur}"/>' if blur else ''}</filter>
<linearGradient id="m" x1="0" y1="0" x2="0" y2="1">{stops}</linearGradient>
<mask id="mk"><rect width="{w}" height="{h}" fill="url(#m)"/></mask></defs>
<g mask="url(#mk)"><rect width="{w}" height="{h}" filter="url(#t)"/></g></svg>'''

clouds = turb_tile(1024, 460, 0.0042, 0.011, 4, 7,
                   [(0, 0), (.3, 1), (.7, 1), (1, 0)], (1, 1, 1), 5.2, -2.75, 3)
fog = turb_tile(1024, 520, 0.004, 0.008, 4, 21,
                [(0, 0), (.35, .55), (.65, .55), (1, 0)], (.55, .42, .72), 3.6, -1.5, 6)

# ---------- malam: langit gelap, bulan merah, bintang, pohon mati, kelelawar ----------
stars = ''.join(
    f'<circle cx="{rnd.uniform(0,540):.0f}" cy="{rnd.uniform(0,640):.0f}" r="{rnd.choice([.7,.9,1.1,1.5]):.1f}" fill="#fff" opacity="{rnd.uniform(.35,.95):.2f}"/>'
    for _ in range(110))

def tree(x, base, h, mirror=1, seed=1):
    r = random.Random(seed)
    parts = []
    def branch(x0, y0, ang, ln, w, d):
        import math
        x1 = x0 + math.cos(ang) * ln * mirror
        y1 = y0 - math.sin(ang) * ln
        parts.append(f'<line x1="{x0:.0f}" y1="{y0:.0f}" x2="{x1:.0f}" y2="{y1:.0f}" stroke="#05030a" stroke-width="{w:.1f}" stroke-linecap="round"/>')
        if d <= 0 or ln < 12: return
        for _ in range(r.choice([2, 2, 3])):
            branch(x1, y1, ang + r.uniform(-.85, .85), ln * r.uniform(.6, .78), max(1.2, w * .68), d - 1)
    branch(x, base, 1.45, h * .34, 14, 6)
    return ''.join(parts)

night = f'''<svg xmlns="http://www.w3.org/2000/svg" width="540" height="960" viewBox="0 0 540 960"><defs>
<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05030f"/><stop offset=".45" stop-color="#150a2e"/><stop offset=".8" stop-color="#2a0d33"/><stop offset="1" stop-color="#3b0f2c"/></linearGradient>
<radialGradient id="mg" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff5a4a" stop-opacity=".55"/><stop offset=".45" stop-color="#b3122c" stop-opacity=".25"/><stop offset="1" stop-color="#b3122c" stop-opacity="0"/></radialGradient>
<radialGradient id="mb" cx=".38" cy=".35" r=".8"><stop offset="0" stop-color="#ffd9c7"/><stop offset=".6" stop-color="#e8806a"/><stop offset="1" stop-color="#a8283a"/></radialGradient></defs>
<rect width="540" height="960" fill="url(#g)"/>{stars}
<circle cx="150" cy="150" r="170" fill="url(#mg)"/>
<circle cx="150" cy="150" r="58" fill="url(#mb)"/>
<g fill="#8a1d33" opacity=".45"><circle cx="132" cy="136" r="11"/><circle cx="170" cy="166" r="8"/><circle cx="148" cy="178" r="5"/><circle cx="168" cy="124" r="6"/></g>
<g fill="#05030a"><path d="M300 110 q14 -14 26 0 q-8 -4 -13 4 q-5 -8 -13 -4z"/><path d="M345 150 q18 -18 34 0 q-10 -5 -17 5 q-7 -10 -17 -5z"/><path d="M262 178 q10 -10 18 0 q-6 -3 -9 3 q-3 -6 -9 -3z"/></g>
<path d="M0 820 Q90 770 180 805 T360 790 T540 815 L540 960 L0 960z" fill="#0b0615"/>
<path d="M0 880 Q120 840 250 872 T540 868 L540 960 L0 960z" fill="#05030a"/>
<g>{tree(52, 900, 520, 1, 3)}{tree(496, 905, 560, -1, 9)}</g>
</svg>'''

# ---------- aura: pinggir gelap merah-ungu (berdenyut lewat CSS) ----------
aura = '''<svg xmlns="http://www.w3.org/2000/svg" width="540" height="960" viewBox="0 0 540 960"><defs>
<radialGradient id="a" cx=".5" cy=".5" r=".72"><stop offset=".42" stop-color="#000" stop-opacity="0"/><stop offset=".7" stop-color="#5b0a3a" stop-opacity=".35"/><stop offset="1" stop-color="#1a0010" stop-opacity=".88"/></radialGradient>
<radialGradient id="b" cx=".5" cy=".5" r=".5"><stop offset=".55" stop-color="#b0102a" stop-opacity="0"/><stop offset="1" stop-color="#b0102a" stop-opacity=".28"/></radialGradient></defs>
<rect width="540" height="960" fill="url(#a)"/><ellipse cx="270" cy="480" rx="300" ry="520" fill="url(#b)"/></svg>'''

# ---------- mata menyala ----------
eyes = '''<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80"><defs>
<filter id="gl" x="-40%" y="-80%" width="180%" height="260%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<radialGradient id="e"><stop offset="0" stop-color="#fff6a8"/><stop offset=".5" stop-color="#ff3b3b"/><stop offset="1" stop-color="#b00020"/></radialGradient></defs>
<g filter="url(#gl)"><path d="M26 44 Q52 18 80 34 Q58 56 26 44z" fill="url(#e)"/><path d="M174 44 Q148 18 120 34 Q142 56 174 44z" fill="url(#e)"/></g>
<ellipse cx="58" cy="38" rx="4" ry="9" fill="#150000" transform="rotate(-24 58 38)"/><ellipse cx="142" cy="38" rx="4" ry="9" fill="#150000" transform="rotate(24 142 38)"/></svg>'''

jobs = [('sky-day.png', sky, 540, 960, False), ('clouds.png', clouds, 1024, 460, True), ('night.png', night, 540, 960, False),
        ('fog.png', fog, 1024, 520, True), ('aura.png', aura, 540, 960, True), ('eyes.png', eyes, 200, 80, True)]
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, svg, w, h, alpha in jobs:
        pg = b.new_page(viewport={'width': w, 'height': h})
        pg.set_content(f'<html><body style="margin:0;background:transparent">{svg}</body></html>')
        pg.screenshot(path=os.path.join(OUT, name), omit_background=alpha, clip={'x': 0, 'y': 0, 'width': w, 'height': h})
        pg.close()
    b.close()
for n in os.listdir(OUT):
    print(n, os.path.getsize(os.path.join(OUT, n)) // 1024, 'KB')
