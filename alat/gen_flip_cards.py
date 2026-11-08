"""Pembuat PNG kartu UNO FLIP (dua sisi: terang & gelap) bergaya sama dengan kartu klasik aplikasi.
Jalankan:  python3 gen_flip_cards.py   (butuh Python + Playwright/Chromium)
Hasil (240x348 px):
  ../img/flip/light/<Warna>-<nilai>.png   Red/Yellow/Green/Blue: 1-9, DrawOne, Reverse, Skip, Flip  + Black-Wild, Black-WildDrawTwo
  ../img/flip/dark/<Warna>-<nilai>.png    Pink/Teal/Orange/Purple: 1-9, DrawFive, Reverse, SkipEveryone, Flip + Black-Wild, Black-WildDrawColor
  (Tidak ada gambar punggung kartu: tumpukan deck langsung menampilkan sisi seberang kartu teratas, sesuai pasangan di UNO_Flip.xlsx)
  ../preview-flip-light.png, ../preview-flip-dark.png  (pratinjau)
Simbol color blind (sama pada kartu asli): lingkaran = Merah/Pink, kotak = Biru/Ungu,
  bintang 4 sudut = Kuning/Oranye, segitiga = Hijau/Teal.
"""
import os, math
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get('OUT', os.path.join(HERE, '..', 'img', 'flip'))
PREVIEW_DIR = os.environ.get('PREVIEW_DIR', os.path.join(HERE, '..'))
for d in ('light', 'dark'):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)

FONT = "font-family=\"Inter, 'DejaVu Sans', sans-serif\" font-weight=\"900\""
CX, CY, TILT = 120, 174, 25

# ---------- palet ----------
LIGHT = {'Red': '#ef4444', 'Yellow': '#eab308', 'Green': '#22c55e', 'Blue': '#3b82f6'}
DARK = {'Pink': ('#ff3fa4', '#b0126a'), 'Teal': ('#1bc0cf', '#08717e'),
        'Orange': ('#ffbb33', '#e8730e'), 'Purple': ('#a244e0', '#54208e')}      # (tengah terang, tepi gelap)
DARK_FLAT = {'Pink': '#e5208f', 'Teal': '#12a8b8', 'Orange': '#f59a1b', 'Purple': '#7a2cc0'}
SHAPE = {'Red': 'circle', 'Blue': 'square', 'Yellow': 'star', 'Green': 'tri',
         'Pink': 'circle', 'Purple': 'square', 'Orange': 'star', 'Teal': 'tri'}
# oval kartu Wild: kiri-atas, kanan-atas, kiri-bawah, kanan-bawah
QUAD_LIGHT = [('Red', 0, 0), ('Blue', 1, 0), ('Yellow', 0, 1), ('Green', 1, 1)]
QUAD_DARK = [('Teal', 0, 0), ('Orange', 1, 0), ('Pink', 0, 1), ('Purple', 1, 1)]
FLAT = {**LIGHT, **DARK_FLAT}

# ---------- simbol color blind ----------
def sym(kind, size=1.0, fill='#fff', stroke='#000', sw=5):
    s = f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round" paint-order="stroke"'
    if kind == 'circle':
        shape = f'<circle r="13" {s}/>'
    elif kind == 'square':
        shape = f'<rect x="-12" y="-12" width="24" height="24" rx="3" {s}/>'
    elif kind == 'star':
        shape = f'<path d="M0,-17 C2,-6 6,-2 17,0 C6,2 2,6 0,17 C-2,6 -6,2 -17,0 C-6,-2 -2,-6 0,-17 Z" {s}/>'
    else:
        shape = f'<path d="M-14,-11 H14 L0,14 Z" {s}/>'
    return f'<g transform="scale({size})">{shape}</g>'

def edge_marks(color):
    """Simbol di tengah-atas dan tengah-bawah kartu (bawah = diputar 180 derajat)."""
    m = f'<g transform="translate(108 37)">{sym(SHAPE[color], 1.0)}</g>'
    return m + f'<g transform="rotate(180 {CX} {CY})">{m}</g>'

# ---------- teks ----------
def txt(s, x, y, size, fill='#fff', sw=7, anchor='middle', outline='#000', extra=''):
    return (f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" text-anchor="{anchor}" {FONT} {extra} '
            f'stroke="{outline}" stroke-width="{sw}" stroke-linejoin="round" paint-order="stroke">{s}</text>')

def txt_shadow(s, x, y, size, sw=9, dx=5, dy=6):
    """Sisi terang: putih berbayang hitam (gaya kartu asli)."""
    shadow = (f'<text x="{x+dx}" y="{y+dy}" font-size="{size}" fill="#000" text-anchor="middle" {FONT} '
              f'stroke="#000" stroke-width="{sw}" stroke-linejoin="round">{s}</text>')
    return shadow + txt(s, x, y, size, '#fff', sw)

def num_text(side, s, x, y, size, corner=False):
    if side == 'light':
        return txt(s, x, y, size, '#fff', 6) if corner else txt_shadow(s, x, y, size)
    return txt(s, x, y, size, '#000', 6 if corner else 11, outline='#fff')    # sisi gelap: hitam berbingkai putih

# ---------- logo UNO FLIP! (pojok kanan atas) ----------
def logo(halo):
    """Tulisan UNO FLIP! dengan garis tepi tipis berwarna tepi kartu (halo) di sekelilingnya, tanpa kotak latar."""
    h = f'stroke="{halo}" stroke-linejoin="round" stroke-linecap="round" fill="{halo}"'
    return (f'<g {FONT}>'
            f'<text x="190" y="45" font-size="30" text-anchor="middle" {h} stroke-width="13" transform="translate(2 3)">UNO</text>'
            f'<text x="190" y="64" font-size="16" text-anchor="middle" {h} stroke-width="11" letter-spacing="1.5">FLIP!</text></g>'
            f'<text x="190" y="45" font-size="30" fill="#000" text-anchor="middle" {FONT} stroke="#000" stroke-width="7" stroke-linejoin="round" transform="translate(2 3)">UNO</text>'
            f'<text x="190" y="45" font-size="30" fill="#ffd400" text-anchor="middle" {FONT} stroke="#000" stroke-width="5" stroke-linejoin="round" paint-order="stroke">UNO</text>'
            f'<text x="190" y="64" font-size="16" fill="#fff" text-anchor="middle" {FONT} stroke="#000" stroke-width="4" stroke-linejoin="round" paint-order="stroke" letter-spacing="1.5">FLIP!</text>')

# ---------- kerangka kartu ----------
def card(side, face, body, corner, marks='', defs=''):
    border = '#ffffff' if side == 'light' else '#0d0d0d'
    edge = '#00000040' if side == 'light' else '#8a8f98'
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="240" height="348" viewBox="0 0 240 348">
<defs>{defs}</defs>
<rect x="2" y="2" width="236" height="344" rx="26" fill="{border}" stroke="{edge}" stroke-width="2"/>
<rect x="14" y="14" width="212" height="320" rx="16" fill="{face}"/>
{body}
{logo(border)}
<g>{corner}</g>
<g transform="rotate(180 {CX} {CY})">{corner}</g>
{marks}
</svg>'''

def dark_defs(name):
    c0, c1 = DARK[name]
    return f'<radialGradient id="fg" cx="50%" cy="45%" r="78%"><stop offset="0" stop-color="{c0}"/><stop offset="1" stop-color="{c1}"/></radialGradient>'

def oval_light(color):
    return (f'<ellipse cx="{CX}" cy="{CY}" rx="84" ry="132" fill="{color}" stroke="#fff" stroke-width="9" '
            f'transform="rotate({TILT} {CX} {CY})"/>')

def oval_dark():
    return (f'<ellipse cx="{CX}" cy="{CY}" rx="84" ry="132" fill="url(#fg)" stroke="#000" stroke-width="8" '
            f'transform="rotate({TILT} {CX} {CY})"/>')

# ---------- melukis ikon ----------
def style_of(mode):
    """mode: light = putih + bayangan hitam | dark = hitam berbingkai putih | darkwhite = putih berbingkai hitam."""
    return {'light': ('#fff', '#000', True), 'dark': ('#000', '#fff', False), 'darkwhite': ('#fff', '#000', False)}[mode]

def paint_poly(points, mode, transform=''):
    fill, line, shadow = style_of(mode)
    out = ''
    if shadow:
        out += f'<polygon points="{points}" transform="{transform} translate(4 6)" fill="#000" stroke="#000" stroke-width="9" stroke-linejoin="round"/>'
    out += f'<polygon points="{points}" transform="{transform}" fill="{fill}" stroke="{line}" stroke-width="8" stroke-linejoin="round" paint-order="stroke"/>'
    return out

def paint_strokes(geo, width, mode):
    """Gambar bentuk bergaris (tanpa isi): lapis luar (bingkai/bayangan) lalu lapis dalam."""
    fill, line, shadow = style_of(mode)
    out = '<g fill="none" stroke-linecap="round" stroke-linejoin="round">'
    if shadow:
        out += f'<g transform="translate(5 6)" stroke="#000" stroke-width="{width+12}">{geo}</g>'
    out += f'<g stroke="{line}" stroke-width="{width+12}">{geo}</g><g stroke="{fill}" stroke-width="{width}">{geo}</g></g>'
    return out

def icon_skip(mode, k=1.0):
    geo = '<circle r="46"/><line x1="-32" y1="32" x2="32" y2="-32"/>'
    return f'<g transform="scale({k})">{paint_strokes(geo, 20, mode)}</g>'

ARROW = '-56,-11 6,-11 6,-28 52,0 6,28 6,11 -56,11'
def icon_reverse(mode, k=1.0):
    a = paint_poly(ARROW, mode, 'translate(0 -33)')
    b = paint_poly(ARROW, mode, 'translate(0 33) rotate(180)')
    return f'<g transform="scale({k}) rotate(-45)">{a}{b}</g>'

SKIP_EVERYONE_GEO = '<circle r="34"/><line x1="-24" y1="24" x2="24" y2="-24"/>'
def icon_skip_everyone(mode, k=1.0):
    """Tanda dilarang + panah melingkar (semua pemain dilewati, giliran kembali ke pemain)."""
    ring = '<path d="M-60,20 A64,64 0 1 1 52,38"/>'
    head = '40,18 70,52 28,56'
    return (f'<g transform="scale({k})">{paint_strokes(SKIP_EVERYONE_GEO, 14, mode)}'
            f'{paint_strokes(ring, 9, mode)}{paint_poly(head, mode)}</g>')

def icon_flip(mode, k=1.0):
    """Kartu dengan panah yang membalik (ikon kartu Flip)."""
    card_geo = '<rect x="-16" y="-46" width="62" height="88" rx="10"/>'
    shaft = '<path d="M-52,-8 C-74,14 -46,38 -14,28 L16,20"/>'
    head = '12,0 52,22 14,46'
    return f'<g transform="scale({k}) translate(-6 -2)">{paint_strokes(card_geo, 10, mode)}{paint_strokes(shaft, 13, mode)}{paint_poly(head, mode)}</g>'

def icon_stack(mode, k=1.0):
    """Tumpukan kartu dengan satu kartu terangkat + panah ke atas (Wild Draw Color)."""
    dia = lambda dy: f'M0,{dy-16} L52,{dy+4} L0,{dy+24} L-52,{dy+4} Z'
    fill, line, shadow = style_of(mode)
    out = ''
    for i in range(5, -1, -1):     # lapisan tumpukan dari bawah ke atas
        dy = 30 + i * 11
        out += f'<path d="{dia(dy)}" fill="{fill if i == 0 else "#000" if mode == "light" else fill}" stroke="{line}" stroke-width="5" stroke-linejoin="round"/>'
    top = f'<path d="{dia(-30)}" fill="{fill}" stroke="{line}" stroke-width="6" stroke-linejoin="round"/>'
    arrow = paint_poly('-9,-16 -9,-4 -22,-4 0,-26 22,-4 9,-4 9,-16', 'darkwhite' if mode == 'light' else 'dark', 'translate(0 -22)')
    return f'<g transform="scale({k}) translate(0 -8)">{out}{top}{arrow}</g>'

def corner_icon(fn, mode, k=0.3):
    return f'<g transform="translate(43 52)">{fn(mode, k)}</g>'

# ---------- oval 4 warna (Wild) ----------
def quad_oval(quad, outline, oid, ring_w=9, symbols=False):
    clip = f'<clipPath id="{oid}"><ellipse cx="{CX}" cy="{CY}" rx="84" ry="132" transform="rotate({TILT} {CX} {CY})"/></clipPath>'
    rects = ''.join(f'<rect x="{x*CX}" y="{y*CY}" width="{CX}" height="{CY}" fill="{FLAT[n]}"/>' for n, x, y in quad)
    out = f'<defs>{clip}</defs><g clip-path="url(#{oid})">{rects}</g>'
    out += (f'<ellipse cx="{CX}" cy="{CY}" rx="84" ry="132" fill="none" stroke="{outline}" stroke-width="{ring_w}" '
            f'transform="rotate({TILT} {CX} {CY})"/>')
    if symbols:
        th = math.radians(TILT); cs, sn = math.cos(th), math.sin(th)
        acc = {q[0]: [0, 0, 0] for q in quad}
        for xi in range(0, 240, 3):
            for yi in range(0, 348, 3):
                dx, dy = xi - CX, yi - CY
                u, v = dx * cs + dy * sn, -dx * sn + dy * cs
                if (u / 84) ** 2 + (v / 132) ** 2 <= 1:
                    name = quad[(0 if dy < 0 else 2) + (0 if dx < 0 else 1)][0]
                    a = acc[name]; a[0] += xi; a[1] += yi; a[2] += 1
        for n, a in acc.items():
            x, y = a[0] / a[2], a[1] / a[2]
            out += f'<g transform="translate({x:.1f} {y:.1f})">{sym(SHAPE[n], 1.5, sw=6)}</g>'
    return out

def mini_oval(quad, outline, oid, cx=44, cy=54, flip=False):
    """Oval 4 warna kecil di pojok kartu Wild (kiri-atas & kanan-bawah)."""
    rx, ry = 17, 26
    clip = f'<clipPath id="{oid}"><ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" transform="rotate({TILT} {cx} {cy})"/></clipPath>'
    rects = ''.join(f'<rect x="{cx-rx-6+x*(rx+6)}" y="{cy-ry-6+y*(ry+6)}" width="{rx+6}" height="{ry+6}" fill="{FLAT[n]}"/>' for n, x, y in quad)
    return (f'<defs>{clip}</defs><g clip-path="url(#{oid})">{rects}</g>'
            f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="none" stroke="{outline}" stroke-width="4" transform="rotate({TILT} {cx} {cy})"/>')

# ================= SISI TERANG =================
def light_number(color, n):
    c = LIGHT[color]
    body = oval_light(c) + num_text('light', n, CX + 2, 230, 150)
    if n in ('6', '9'):
        body += (f'<rect x="{CX-30}" y="248" width="64" height="11" rx="3" fill="#000" transform="translate(5 6)"/>'
                 f'<rect x="{CX-30}" y="248" width="64" height="11" rx="3" fill="#fff" stroke="#000" stroke-width="3.5"/>')
    corner = num_text('light', n, 42, 56, 40, True)
    if n in ('6', '9'):
        corner += '<rect x="33" y="63" width="19" height="4.5" rx="1.5" fill="#fff" stroke="#000" stroke-width="2"/>'
    return card('light', c, body, corner, edge_marks(color))

def light_action(color, kind):
    c = LIGHT[color]
    if kind == 'Skip':
        body, corner = icon_skip('light'), corner_icon(icon_skip, 'light', .27)
    elif kind == 'Reverse':
        body, corner = icon_reverse('light', 1.15), corner_icon(icon_reverse, 'light', .33)
    elif kind == 'Flip':
        body, corner = icon_flip('light', 1.0), corner_icon(icon_flip, 'light', .36)
    else:   # DrawOne
        body = txt_shadow('+1', CX, 222, 120)
        corner = txt('+1', 44, 54, 34, '#fff', 6)
    if kind in ('Skip', 'Reverse', 'Flip'):
        body = f'<g transform="translate({CX} {CY})">{body}</g>'
    return card('light', c, oval_light(c) + body, corner, edge_marks(color))

def light_wild(kind):
    body = quad_oval(QUAD_LIGHT, '#fff', 'ow', symbols=(kind == 'Wild'))
    if kind == 'WildDrawTwo':
        body += txt_shadow('+2', CX - 4, 226, 118)
    if kind == 'WildDrawTwo':
        corner = txt('+2', 46, 54, 34, '#fff', 6)     # kartu asli: "+2" putih di pojok hitam
    else:
        corner = mini_oval(QUAD_LIGHT, '#fff', 'cm')
    return card('light', '#141414', body, corner)

# ================= SISI GELAP =================
def dark_number(color, n):
    body = oval_dark() + num_text('dark', n, CX + 2, 230, 150)
    if n in ('6', '9'):
        body += (f'<rect x="{CX-30}" y="248" width="64" height="11" rx="3" fill="#fff" transform="translate(0 0)" stroke="#fff" stroke-width="7"/>'
                 f'<rect x="{CX-30}" y="248" width="64" height="11" rx="3" fill="#000"/>')
    corner = num_text('dark', n, 42, 56, 40, True)
    if n in ('6', '9'):
        corner += '<rect x="33" y="63" width="19" height="4.5" rx="1.5" fill="#000" stroke="#fff" stroke-width="2"/>'
    return card('dark', 'url(#fg)', body, corner, edge_marks(color), dark_defs(color))

def dark_action(color, kind):
    if kind == 'Reverse':
        body, corner = icon_reverse('dark', 1.15), corner_icon(icon_reverse, 'dark', .33)
    elif kind == 'SkipEveryone':
        body, corner = icon_skip_everyone('dark', 0.95), corner_icon(icon_skip_everyone, 'dark', .27)
    elif kind == 'Flip':
        body, corner = icon_flip('dark', 1.0), corner_icon(icon_flip, 'dark', .36)
    else:   # DrawFive
        body = txt('+5', CX, 222, 120, '#000', 11, outline='#fff')
        corner = txt('+5', 44, 54, 34, '#000', 6, outline='#fff')
    if kind != 'DrawFive':
        body = f'<g transform="translate({CX} {CY})">{body}</g>'
    return card('dark', 'url(#fg)', oval_dark() + body, corner, edge_marks(color), dark_defs(color))

def dark_wild(kind):
    defs = '<linearGradient id="sg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f5f7"/><stop offset="1" stop-color="#b3b9c4"/></linearGradient>'
    body = quad_oval(QUAD_DARK, '#000', 'ow', ring_w=8, symbols=(kind == 'Wild'))
    corner = mini_oval(QUAD_DARK, '#000', 'cm')
    if kind == 'WildDrawColor':
        body += f'<g transform="translate({CX-4} {CY})">{icon_stack("dark", 1.0)}</g>'
        corner = f'<g transform="translate(44 56)">{icon_stack("dark", .27)}</g>'
    return card('dark', 'url(#sg)', body, corner, '', defs)

# ================= DAFTAR KARTU =================
cards = {}
NUMS = [str(i) for i in range(1, 10)]
for color in LIGHT:
    for n in NUMS: cards[f'light/{color}-{n}'] = light_number(color, n)
    for kind in ('DrawOne', 'Reverse', 'Skip', 'Flip'): cards[f'light/{color}-{kind}'] = light_action(color, kind)
for kind in ('Wild', 'WildDrawTwo'): cards[f'light/Black-{kind}'] = light_wild(kind)
for color in DARK:
    for n in NUMS: cards[f'dark/{color}-{n}'] = dark_number(color, n)
    for kind in ('DrawFive', 'Reverse', 'SkipEveryone', 'Flip'): cards[f'dark/{color}-{kind}'] = dark_action(color, kind)
for kind in ('Wild', 'WildDrawColor'): cards[f'dark/Black-{kind}'] = dark_wild(kind)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 240, 'height': 348})
    for name, svg in cards.items():
        pg.set_content(f'<html><body style="margin:0;background:transparent">{svg}</body></html>')
        pg.screenshot(path=os.path.join(OUT, name + '.png'), omit_background=True, clip={'x': 0, 'y': 0, 'width': 240, 'height': 348})
    # pratinjau tiap sisi
    for side in ('light', 'dark'):
        names = [n for n in cards if n.startswith(side + '/')]
        imgs = ''.join(f'<img src="file://{os.path.abspath(os.path.join(OUT, n))}.png" width="108">' for n in names)
        html = os.path.join(PREVIEW_DIR, f'_sheet_{side}.html')
        open(html, 'w').write(f'<body style="background:#0f3d24;margin:10px;display:flex;flex-wrap:wrap;gap:8px;width:1320px">{imgs}</body>')
        pg2 = b.new_page(viewport={'width': 1340, 'height': 800})
        pg2.goto('file://' + os.path.abspath(html)); pg2.wait_for_timeout(500)
        pg2.screenshot(path=os.path.join(PREVIEW_DIR, f'preview-flip-{side}.png'), full_page=True)
        pg2.close(); os.remove(html)
    b.close()
print(len(cards), 'gambar kartu Flip dibuat di', os.path.abspath(OUT))
