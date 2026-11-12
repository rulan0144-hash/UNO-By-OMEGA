"""Pembuat PNG kartu UNO ALL WILD (semua kartu hitam/wild, gaya aplikasi + simbol color blind).
Jalankan:  python3 gen_allwild_cards.py   (butuh Python + Playwright/Chromium)
Hasil: ../img/allwild/*.png (240x348) dan pratinjau ../preview-allwild.png
Memakai ulang fungsi dari gen_cards.py (palet, simbol, oval 4 warna, ikon Skip/Reverse/+2, tangan, kartu +4).
Komposisi dek (112) divalidasi di bawah; skrip berhenti bila jumlah tidak sama.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
os.environ.setdefault('OUT', os.path.join(HERE, '..', 'img', 'cards'))   # supaya gen_cards tidak membuat folder aneh
import gen_cards as g
from playwright.sync_api import sync_playwright

OUT = os.path.join(HERE, '..', 'img', 'allwild')
PREVIEW = os.path.join(HERE, '..', 'preview-allwild.png')
os.makedirs(OUT, exist_ok=True)

# ---------- komposisi dek (permintaan pengguna) ----------
DECK = {'Wild': 54, 'WildSkip': 14, 'WildReverse': 14, 'WildDrawTwo': 10, 'WildSkipTwo': 6,
        'WildDrawFour': 6, 'WildTargetDrawTwo': 4, 'WildForcedSwap': 4}
assert sum(DECK.values()) == 112, f'jumlah kartu {sum(DECK.values())} != 112'

CX, CY = g.CX, g.CY
strokes = lambda geo, w: (f'<g fill="none" stroke-linecap="round" stroke-linejoin="round">'
    f'<g transform="translate(5 6)" stroke="#000" stroke-width="{w+12}">{geo}</g>'
    f'<g stroke="#000" stroke-width="{w+12}">{geo}</g><g stroke="#fff" stroke-width="{w}">{geo}</g></g>')

# ---------- ikon baru ----------
def icon_skip2(k=1.0):
    """Double Skip: dua tanda larangan bertumpuk miring."""
    return (f'<g transform="scale({k})"><g transform="translate(19 -19) scale(.8)">{g.icon_skip()}</g>'
            f'<g transform="translate(-19 19) scale(.8)">{g.icon_skip()}</g></g>')

def icon_target(k=1.0, text='+2'):
    """Bidikan dengan angka di dalamnya (+2 target)."""
    geo = '<circle r="30"/><path d="M0,-48 V-24 M0,48 V24 M-48,0 H-24 M48,0 H24"/>'
    t = g.txt(text, 0, 12, 34, '#fff', 6)
    return f'<g transform="scale({k})">{strokes(geo, 9)}{t}</g>'

def icon_swap(k=1.0):
    """Forced Swap: kipas kartu di atas + panah melengkung dua arah di bawahnya (tukar tangan)."""
    cards = ''
    for rot in (-27, -9, 9, 27):
        cards += (f'<g transform="translate(0 30) rotate({rot}) translate(0 -46)">'
                  f'<rect x="-15" y="-24" width="30" height="46" rx="5"/></g>')
    fan = g.shadowed(cards, 4, 5)
    arc = '<path d="M-56,50 Q0,-8 56,50"/>'
    arrows = ('<polygon points="-72,40 -40,40 -56,68"/>'          # kepala panah kiri (menunjuk ke bawah)
              '<polygon points="72,40 40,40 56,68"/>')            # kepala panah kanan (menunjuk ke bawah)
    arrow = (strokes(arc, 10) +
             f'<g fill="#fff" stroke="#000" stroke-width="7" stroke-linejoin="round">{arrows}</g>')
    return f'<g transform="scale({k})"><g transform="translate(0 -12)">{fan}</g><g transform="translate(0 -6)">{arrow}</g></g>'

# ---------- badan kartu: oval 4 warna + simbol color blind di sisi luar + ikon tengah ----------
def body_icon(icon, spread=1.32, sym_size=1.0):
    oval = g.four_color_oval(symbols=True, sym_size=sym_size, spread=spread)
    return oval + f'<g transform="translate({CX} {CY})">{icon}</g>'

def card(kind):
    if kind in ('Wild', 'WildDrawFour'):
        return g.wild_card(kind)            # persis desain klasik (kartu +4 = oval putih + 4 kartu bersimbol)
    if kind == 'WildSkip':
        body = body_icon(g.icon_skip(0.7));      corner = f'<g transform="translate(46 55)">{g.icon_skip(0.40)}</g>'
    elif kind == 'WildReverse':
        body = body_icon(g.icon_reverse(0.82));  corner = f'<g transform="translate(46 55)">{g.icon_reverse(0.48)}</g>'
    elif kind == 'WildDrawTwo':
        body = body_icon(g.icon_draw2(0.82));     corner = g.txt('+2', 48, 60, 46, sw=8)
    elif kind == 'WildSkipTwo':
        body = body_icon(icon_skip2(0.66));       corner = f'<g transform="translate(46 55)">{icon_skip2(0.44)}</g>'
    elif kind == 'WildTargetDrawTwo':
        body = body_icon(icon_target(0.92));     corner = f'<g transform="translate(46 55)">{icon_target(0.52, "+2")}</g>'
    elif kind == 'WildForcedSwap':
        body = body_icon(icon_swap(0.8));       corner = f'<g transform="translate(46 55)">{icon_swap(0.46)}</g>'
    else:
        raise KeyError(kind)
    return g.frame(g.WILD_BG, body, corner)

cards = {f'Black-{k}': card(k) for k in DECK}

if __name__ == '__main__':
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 240, 'height': 348})
        for name, svg in cards.items():
            pg.set_content(f'<html><body style="margin:0;background:transparent">{svg}</body></html>')
            pg.screenshot(path=f'{OUT}/{name}.png', omit_background=True, clip={'x': 0, 'y': 0, 'width': 240, 'height': 348})
        b.close()
    # lembar kontak (PIL, supaya tidak bergantung file:// di Chromium)
    from PIL import Image, ImageDraw
    names = list(cards); cols = 4; cw, ch = 250, 400
    sheet = Image.new('RGB', (cols * cw, ((len(names) + cols - 1) // cols) * ch), '#1f2937')
    d = ImageDraw.Draw(sheet)
    for i, n in enumerate(names):
        im = Image.open(f'{OUT}/{n}.png').convert('RGBA')
        x, y = (i % cols) * cw + 5, (i // cols) * ch + 5
        sheet.paste(im, (x, y), im)
        d.text((x + 8, y + 352), f'{n[6:]} x{DECK[n[6:]]}', fill='#fff')
    sheet.save(PREVIEW)
    print(len(cards), 'desain kartu,', sum(DECK.values()), 'kartu di dek')
