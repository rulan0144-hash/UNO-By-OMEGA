"""Gambar efek mode UNO ALL WILD -> img/allwild/fx/ (512x512 transparan).
Semua kartu All Wild berwarna hitam, jadi efek TIDAK per warna: lencana/ledakan berisi 4 warna (merah kiri-atas, biru kanan-atas,
kuning kiri-bawah, hijau kanan-bawah) seperti oval kartunya.
Berkas: skip, skip2, reverse, draw2, draw4, target2, swap (.png) = versi 4 warna (CADANGAN bila warna tidak ada).
REVISI 12 Nov: pemain tetap memilih warna seperti UNO biasa, jadi tiap efek juga dibuat PER WARNA: <efek>-<Warna>.png
(Red/Yellow/Green/Blue = warna yang dipilih pemain saat memainkan kartu). Plus pemilih warna wild-spin.png + wild-<Warna>.png
(disalin dari img/effects supaya folder mode mandiri).
Ikon SAMA dengan ikon kartu (diambil dari gen_allwild_cards.py dan gen_cards.py, tidak digambar ulang).
Pakai: python3 gen_allwild_effects.py [folder_tujuan]   (bawaan: ../img/allwild/fx)
"""
import os, sys, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gen_effects_color as e
import gen_allwild_cards as a
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'img', 'allwild', 'fx')
P = e.PAL
QUAD = (f'<rect x="0" y="0" width="256" height="256" fill="{P["Red"][1]}"/><rect x="256" y="0" width="256" height="256" fill="{P["Blue"][1]}"/>'
        f'<rect x="0" y="256" width="256" height="256" fill="{P["Yellow"][1]}"/><rect x="256" y="256" width="256" height="256" fill="{P["Green"][1]}"/>')

def shape_fx(points=None, circle=False):
    """Bentuk (ledakan / lencana) berisi 4 warna dengan tepi putih + garis luar hitam."""
    if circle:
        geo = lambda extra: f'<circle cx="256" cy="256" r="226" {extra}/>'
    else:
        geo = lambda extra: f'<polygon points="{points}" stroke-linejoin="round" {extra}/>'
    return (geo('fill="#000" stroke="#000" stroke-width="22"') +
            f'<clipPath id="q">{geo("")}</clipPath><g clip-path="url(#q)">{QUAD}</g>' +
            geo('fill="none" stroke="#fff" stroke-width="12"'))

def burst_pts(n=14, r_out=236, r_in=186, rot=-8):
    import math
    pts = []
    for i in range(n * 2):
        t = math.pi * i / n + math.radians(rot); r = r_out if i % 2 == 0 else r_in
        pts.append(f'{256 + r * math.cos(t):.1f},{256 + r * math.sin(t):.1f}')
    return ' '.join(pts)

BURST, BADGE = shape_fx(burst_pts()), shape_fx(circle=True)
at = lambda inner, x, y, k: f'<g transform="translate({x} {y}) scale({k})">{inner}</g>'
txt_in = lambda t, x, y, size: e.big_text(t, size, y)

COLORS = ['Red', 'Yellow', 'Green', 'Blue']

def grad(c):
    lt, mid, dk = P[c]
    return (f'<defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="{lt}"/>'
            f'<stop offset="1" stop-color="{mid}"/></radialGradient></defs>')

def colored(kind, c):
    """Efek satu warna: ledakan (+2/+4/target) bergradasi warna, lencana (skip/skip2/reverse/swap) warna rata - gaya sama dengan efek klasik."""
    mid = P[c][1]
    if kind in ('draw2', 'draw4'):
        return e.svg(grad(c) + e.burst(256, 256, 236, 186, 14, 'url(#g)', -8) + e.big_text('+2' if kind == 'draw2' else '+4', 210, 326))
    if kind == 'target2':
        return e.svg(grad(c) + e.burst(256, 256, 236, 186, 14, 'url(#g)', -8) + at(a.icon_target(1, '+2'), 256, 256, 2.7))
    if kind == 'skip':    return e.svg(e.badge(mid) + at(a.g.icon_skip(1), 256, 256, 2.5))
    if kind == 'skip2':   return e.svg(e.badge(mid) + at(a.icon_skip2(1), 256, 256, 2.45))
    if kind == 'reverse': return e.svg(e.badge(mid) + at(a.g.icon_reverse(1), 256, 256, 2.55))
    if kind == 'swap':    return e.svg(e.badge(mid) + at(a.icon_swap(1), 256, 244, 2.35))

KINDS = ['skip', 'skip2', 'reverse', 'draw2', 'draw4', 'target2', 'swap']

imgs = {
    'skip':    e.svg(BADGE + at(a.g.icon_skip(1), 256, 256, 2.5)),
    'skip2':   e.svg(BADGE + at(a.icon_skip2(1), 256, 256, 2.45)),
    'reverse': e.svg(BADGE + at(a.g.icon_reverse(1), 256, 256, 2.55)),
    'draw2':   e.svg(BURST + e.big_text('+2', 210, 326)),
    'draw4':   e.svg(BURST + e.big_text('+4', 210, 326)),
    'target2': e.svg(BURST + at(a.icon_target(1, '+2'), 256, 256, 2.7)),
    'swap':    e.svg(BADGE + at(a.icon_swap(1), 256, 244, 2.35)),
}
for _k in KINDS:
    for _c in COLORS:
        imgs[f'{_k}-{_c}'] = colored(_k, _c)

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        for name, s in imgs.items():
            pg = b.new_page(viewport={'width': 512, 'height': 512})
            pg.set_content(f'<html><body style="margin:0;background:transparent">{s}</body></html>')
            pg.screenshot(path=os.path.join(OUT, name + '.png'), omit_background=True, clip={'x': 0, 'y': 0, 'width': 512, 'height': 512})
            pg.close()
        b.close()
    # pemilih warna Wild: sama dengan klasik -> salin agar folder mode mandiri
    EFF = os.path.join(HERE, '..', 'img', 'effects'); n = 0
    for f in ['wild-spin.png'] + [f'wild-{c}.png' for c in COLORS]:
        if os.path.exists(os.path.join(EFF, f)):
            shutil.copy(os.path.join(EFF, f), os.path.join(OUT, f)); n += 1
    from PIL import Image
    cols = ['neutral'] + COLORS
    sheet = Image.new('RGB', (len(cols) * 200 + 10, len(KINDS) * 200 + 10), '#1f2937')
    for r, k in enumerate(KINDS):
        for ci, c in enumerate(cols):
            im = Image.open(os.path.join(OUT, (k if c == 'neutral' else f'{k}-{c}') + '.png')).convert('RGBA').resize((190, 190))
            sheet.paste(im, (ci * 200 + 5, r * 200 + 5), im)
    sheet.save(os.path.join(HERE, '..', 'preview-allwild-fx.png'))
    print(len(imgs), 'gambar efek All Wild +', n, 'pemilih warna dibuat di', os.path.abspath(OUT))
