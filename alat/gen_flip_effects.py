# Gambar efek mode UNO Flip -> img/flip/fx/
#   draw1-<Terang>, draw2-<Terang> (Wild Draw Two), draw5-<Gelap>, wdc-<Gelap> (Wild Draw Color),
#   skip-<8 warna>, reverse-<8 warna>, skipall-<Gelap>, flip-light, flip-dark,
#   wild-spin-dark, wild-<Pink|Teal|Orange|Purple> (pemilih warna sisi gelap; sisi terang memakai img/effects/wild-*.png)
# Pakai: python3 gen_flip_effects.py [folder_tujuan]   (bawaan: ../img/flip/fx)
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gen_effects_color as g
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'img', 'flip', 'fx')
LIGHT = ['Red', 'Yellow', 'Green', 'Blue']
DARK = ['Pink', 'Teal', 'Orange', 'Purple']
g.PAL.update({'Pink': ('#f9a8d4', '#ec4899', '#be185d'), 'Teal': ('#5eead4', '#14b8a6', '#0f766e'),
              'Orange': ('#fdba74', '#f97316', '#c2410c'), 'Purple': ('#d8b4fe', '#a855f7', '#7e22ce')})
FONT, svg, burst, big_text, badge = g.FONT, g.svg, g.burst, g.big_text, g.badge
# ikon yang SAMA dengan yang dipakai di kartu (diambil dari gen_flip_cards.py: icon_skip_everyone, icon_flip, icon_stack)
_src = open(os.path.join(HERE, 'gen_flip_cards.py'), encoding='utf-8').read()
_seg = _src[_src.index('# ---------- melukis ikon'):_src.index('def corner_icon')]
_ns = {}
exec(_seg, _ns)
icon_skip_everyone, icon_flip, icon_stack = _ns['icon_skip_everyone'], _ns['icon_flip'], _ns['icon_stack']

def grad(color):
    lt, mid, dk = g.PAL[color]
    return f'<defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="{lt}"/><stop offset="1" stop-color="{mid}"/></radialGradient></defs>'

def draw_n(txt, color):
    return svg(grad(color) + burst(256, 256, 236, 186, 14, 'url(#g)', -8) + big_text(txt, 210, 326))

def wdc(color):   # Wild Draw Color: ikon tumpukan kartu seperti di kartu
    return svg(grad(color) + burst(256, 256, 236, 186, 14, 'url(#g)', -8) + f'<g transform="translate(256 250) scale(1.95)">{icon_stack("darkwhite", 1)}</g>')

def skipall(color):   # Skip Everyone: ikon sama dengan kartu
    return svg(badge(g.PAL[color][1]) + f'<g transform="translate(256 256) scale(2.3)">{icon_skip_everyone("darkwhite", 1)}</g>')

def flip(dark):   # Flip: ikon kartu berbalik sama dengan kartu
    return svg(badge('#5b21b6' if dark else '#f59e0b') + f'<g transform="translate(256 256) scale(2.7)">{icon_flip("darkwhite", 1)}</g>')

DCOLS = {'Pink': ('#ec4899', '#be185d'), 'Teal': ('#14b8a6', '#0f766e'), 'Orange': ('#f97316', '#c2410c'), 'Purple': ('#a855f7', '#7e22ce')}
DCELL = {'Teal': (-1, -1), 'Orange': (1, -1), 'Pink': (1, 1), 'Purple': (-1, 1)}   # posisi sama dengan Green/Yellow/Red/Blue
def wild(sel=None):
    s, d, parts = 120, 64, ['<ellipse cx="256" cy="420" rx="170" ry="34" fill="#000" opacity=".25"/>']
    for name, (sx, sy) in DCELL.items():
        face, side = DCOLS[name]
        pop = 34 if name == sel else 0
        cx, cy = sx * d + sx * pop, sy * d + sy * pop
        dim = ' opacity=".55"' if sel and name != sel else ''
        glow = ' style="filter:drop-shadow(0 0 22px #fff)"' if name == sel else ''
        k = (20 if name == sel else 14) * 0.7071
        parts.append(f'<g transform="translate(256 236) rotate(45)"{dim}{glow}>'
                     f'<rect x="{cx - s/2 + k:.1f}" y="{cy - s/2 + k:.1f}" width="{s}" height="{s}" rx="24" fill="{side}" stroke="#000" stroke-width="10"/>'
                     f'<rect x="{cx - s/2:.1f}" y="{cy - s/2:.1f}" width="{s}" height="{s}" rx="24" fill="{face}" stroke="#000" stroke-width="10"/>'
                     f'<rect x="{cx - s/2 + 12:.1f}" y="{cy - s/2 + 12:.1f}" width="{s - 24}" height="26" rx="12" fill="#fff" opacity=".28"/></g>')
    return svg(''.join(parts))

imgs = {}
for c in LIGHT:
    imgs[f'draw1-{c}'] = draw_n('+1', c)
    imgs[f'draw2-{c}'] = g.make('draw2', c)
for c in DARK:
    imgs[f'draw5-{c}'] = draw_n('+5', c)
    imgs[f'wdc-{c}'] = wdc(c)
    imgs[f'skipall-{c}'] = skipall(c)
for c in LIGHT + DARK:
    imgs[f'skip-{c}'] = g.make('skip', c)
    imgs[f'reverse-{c}'] = g.make('reverse', c)
imgs['flip-light'] = flip(False)
imgs['flip-dark'] = flip(True)
imgs['wild-spin-dark'] = wild()
for c in DARK: imgs[f'wild-{c}'] = wild(c)

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
    print(len(imgs), 'gambar efek Flip dibuat di', os.path.abspath(OUT))
