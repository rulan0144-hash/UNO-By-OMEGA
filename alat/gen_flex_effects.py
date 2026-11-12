# Gambar efek mode UNO Flex -> img/flex/fx/   (512x512 transparan, gaya sama dengan efek klasik/Flip)
#   Sisi biasa (4 warna): draw2-<W>, skip-<W>, reverse-<W>, draw4-<W>
#   Sisi flex  (4 warna): draw1all-<W> (Flex Draw Two: semua lawan +1), skipall-<W> (Flex Skip: lewati semua),
#                         revskip-<W> (Flex Reverse: balik arah + lewati), alldraw2-<W> (Wild Flex All Draw 2: semua lawan +2),
#                         target2-<W> (Wild Flex Target Draw 2: pemain pilihan +2), target4-<W> (Wild Draw 4 sisi flex: pemain pilihan +4)
#   Wild All Flip / balik Power Card: flip-GoStop.png (hijau -> merah) dan flip-StopGo.png (merah -> hijau);
#       tiap pemain memutar efek sesuai posisi Power Card-nya sendiri (jadi tiap pemain bisa melihat yang berbeda)
#   Pemilih warna Wild: wild-spin.png + wild-<Warna>.png (salinan dari img/effects, empat warna sama dengan klasik)
# Ikon pada efek SAMA dengan ikon pada kartunya (diambil dari gen_flex_cards.py, bukan digambar ulang).
# Pakai: python3 gen_flex_effects.py [folder_tujuan]   (bawaan: ../img/flex/fx)
import os, sys, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gen_effects_color as g
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'img', 'flex', 'fx')
COLORS = ['Red', 'Yellow', 'Green', 'Blue']
FONT, svg, burst, big_text, badge = g.FONT, g.svg, g.burst, g.big_text, g.badge

# ---- ikon dari skrip kartu Flex (potongan "simbol" s.d. sebelum half_num) ----
_src = open(os.path.join(HERE, 'gen_flex_cards.py'), encoding='utf-8').read()
_seg = _src[_src.index('# ---------- simbol'):_src.index('def half_num')]
_ns = {'FONT': FONT, 'COL': {}}
exec(_seg, _ns)
icon_skip, icon_reverse, icon_loop = _ns['icon_skip'], _ns['icon_reverse'], _ns['icon_loop']
icon_group, icon_target, icon_flipsym = _ns['icon_group'], _ns['icon_target'], _ns['icon_flipsym']
# Skip Everyone: ikon SAMA dengan Skip Everyone di UNO Flip (tanda dilarang + panah melingkar, dari gen_flip_cards.py)
_fsrc = open(os.path.join(HERE, 'gen_flip_cards.py'), encoding='utf-8').read()
_fns = {}
exec(_fsrc[_fsrc.index('# ---------- melukis ikon'):_fsrc.index('def corner_icon')], _fns)
icon_skip_everyone = _fns['icon_skip_everyone']

def grad(color):
    lt, mid, dk = g.PAL[color]
    return (f'<defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="{lt}"/>'
            f'<stop offset="1" stop-color="{mid}"/></radialGradient></defs>')

def at(inner, x, y, k):
    return f'<g transform="translate({x} {y}) scale({k})">{inner}</g>'

def ledakan(color, inner):
    return svg(grad(color) + burst(256, 256, 236, 186, 14, 'url(#g)', -8) + inner)

def num_lbl(t, x, y, size):   # angka putih bergaris hitam (gaya kartu: +N kecil)
    return (f'<text x="{x}" y="{y}" font-size="{size}" fill="#fff" text-anchor="middle" {FONT} stroke="#000" '
            f'stroke-width="{max(8, size // 7)}" stroke-linejoin="round" paint-order="stroke">{t}</text>')

def group_n(c, n):          # semua lawan +N: logo orang (sama dengan kartu) + "+N" kecil MENEMPEL di bawahnya
    return ledakan(c, at(icon_group(1), 256, 186, 3.1) + num_lbl(n, 256, 438, 100))

def target_n(c, n):         # pemain pilihan +N: logo bidikan (sama dengan kartu) dengan "+N" DI DALAM lingkarannya
    return ledakan(c, at(icon_target(1), 256, 256, 4.4) + num_lbl(n, 256, 284, 74))

def draw1all(c):    return group_n(c, '+1')    # Flex Draw Two: semua lawan +1
def alldraw2(c):    return group_n(c, '+2')    # Wild Flex All Draw 2: semua lawan +2
def target2(c):     return target_n(c, '+2')   # Wild Flex Target Draw 2
def target4(c):     return target_n(c, '+4')   # Wild Draw 4 sisi flex

def skipall(c):     # Flex Skip: ikon Skip Everyone gaya UNO Flip (sama dengan kartu Flex Skip)
    return svg(badge(g.PAL[c][1]) + at(icon_skip_everyone('darkwhite', 1), 256, 256, 2.3))

def revskip(c):     # Flex Reverse: Reverse + Skip, proporsi 50/50 (Reverse kiri-atas, Skip kanan-bawah, sama besar)
    return svg(badge(g.PAL[c][1]) + at(icon_reverse(1), 190, 190, 1.7) + at(icon_skip(1), 334, 334, 1.45))

POW = {'go': ('#22c55e', '#15803d'), 'stop': ('#ef4444', '#b91c1c')}   # warna Power Card: hijau "9" / merah "8"
def pow_card(kind, cx, cy, k, rot, dim=False):
    """Kartu Power kecil: hijau + centang (boleh flex) atau merah + silang (tidak boleh flex)."""
    fill, edge = POW[kind]
    mark = ('<path d="M-30,2 L-9,24 L32,-24" fill="none" stroke="#000" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>'
            '<path d="M-30,2 L-9,24 L32,-24" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>') if kind == 'go' else \
           ('<path d="M-26,-26 L26,26 M26,-26 L-26,26" fill="none" stroke="#000" stroke-width="26" stroke-linecap="round"/>'
            '<path d="M-26,-26 L26,26 M26,-26 L-26,26" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round"/>')
    op = ' opacity=".6"' if dim else ''
    return (f'<g transform="translate({cx} {cy}) rotate({rot}) scale({k})"{op}>'
            f'<rect x="-88" y="-124" width="176" height="248" rx="22" fill="#fff" stroke="#000" stroke-width="8"/>'
            f'<rect x="-76" y="-112" width="152" height="224" rx="14" fill="{fill}"/>'
            f'<circle r="58" fill="none" stroke="#fff" stroke-width="10"/>'
            f'<circle r="58" fill="{edge}" opacity=".35"/>{mark}</g>')

def flip_power(src, dst):   # kartu asal (redup, belakang-kiri) -> kartu tujuan (depan-kanan), panah melengkung di antaranya
    arrow = ('<path d="M196,84 Q300,34 380,120" fill="none" stroke="#000" stroke-width="40" stroke-linecap="round"/>'
             '<path d="M196,84 Q300,34 380,120" fill="none" stroke="#fff" stroke-width="22" stroke-linecap="round"/>'
             '<polygon points="402,150 340,128 392,92" fill="#fff" stroke="#000" stroke-width="10" stroke-linejoin="round"/>')
    return svg(pow_card(src, 170, 300, 1.02, -10, True) + pow_card(dst, 346, 308, 1.18, 8) + arrow)

imgs = {}
for c in COLORS:
    for k in ('draw2', 'skip', 'reverse', 'draw4'):
        imgs[f'{k}-{c}'] = g.make(k, c)
    imgs[f'draw1all-{c}'] = draw1all(c)
    imgs[f'skipall-{c}'] = skipall(c)
    imgs[f'revskip-{c}'] = revskip(c)
    imgs[f'alldraw2-{c}'] = alldraw2(c)
    imgs[f'target2-{c}'] = target2(c)
    imgs[f'target4-{c}'] = target4(c)
imgs['flip-GoStop'] = flip_power('go', 'stop')
imgs['flip-StopGo'] = flip_power('stop', 'go')

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
    # pemilih warna Wild: empat warna sama dengan klasik -> salin agar folder mode mandiri
    EFF = os.path.join(HERE, '..', 'img', 'effects')
    n = 0
    for f in ['wild-spin.png'] + [f'wild-{c}.png' for c in COLORS]:
        if os.path.exists(os.path.join(EFF, f)):
            shutil.copy(os.path.join(EFF, f), os.path.join(OUT, f)); n += 1
    print(len(imgs), 'gambar efek Flex +', n, 'pemilih warna dibuat di', os.path.abspath(OUT))
