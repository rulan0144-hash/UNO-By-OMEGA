"""Pembuat PNG kartu UNO (desain mirip kartu asli + simbol color blind).
Jalankan:  python3 gen_cards.py   (butuh Python + Playwright/Chromium)
Hasil: ../img/cards/*.png (240x348) dan pratinjau ../preview-kartu.png
Simbol color blind (sama dengan UNO edisi color blind):
  Merah = lingkaran, Biru = kotak, Kuning = bintang 4 sudut, Hijau = segitiga (menghadap bawah)
"""
import os, math
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get('OUT', os.path.join(HERE, '..', 'img', 'cards'))
PREVIEW = os.environ.get('PREVIEW', os.path.join(HERE, '..', 'preview-kartu.png'))
os.makedirs(OUT, exist_ok=True)

COL = {'Red': '#ef4444', 'Green': '#22c55e', 'Blue': '#3b82f6', 'Yellow': '#eab308'}
FONT = "font-family=\"Inter, 'DejaVu Sans', sans-serif\" font-weight=\"900\""
CX, CY = 120, 174          # pusat kartu
TILT = 25                  # kemiringan oval (derajat)

# ---------- simbol color blind ----------
def sym(color, size=1.0, fill='#fff', stroke='#000', sw=5, op=1):
    """Gambar simbol di titik (0,0). size=1 -> sekitar 26px."""
    s = f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round" paint-order="stroke" opacity="{op}"'
    if color == 'Red':
        shape = f'<circle r="13" {s}/>'
    elif color == 'Blue':
        shape = f'<rect x="-12" y="-12" width="24" height="24" rx="3" {s}/>'
    elif color == 'Yellow':   # bintang 4 sudut (sparkle)
        shape = f'<path d="M0,-17 C2,-6 6,-2 17,0 C6,2 2,6 0,17 C-2,6 -6,2 -17,0 C-6,-2 -2,-6 0,-17 Z" {s}/>'
    else:                     # Green: segitiga menghadap bawah
        shape = f'<path d="M-14,-11 H14 L0,14 Z" {s}/>'
    return f'<g transform="scale({size})">{shape}</g>'

# ---------- kerangka kartu ----------
def frame(bg, body, corner, marks=''):
    """Kartu 240x348: tepi putih, isi berwarna, isi kartu, sudut kiri-atas & kanan-bawah (diputar 180)."""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="240" height="348" viewBox="0 0 240 348">
<rect x="2" y="2" width="236" height="344" rx="26" fill="#fff" stroke="#00000040" stroke-width="2"/>
<rect x="14" y="14" width="212" height="320" rx="16" fill="{bg}"/>
{body}
<g>{corner}</g>
<g transform="rotate(180 {CX} {CY})">{corner}</g>
{marks}
</svg>'''

def oval_ring(color):
    """Oval miring seperti kartu asli: isi sewarna kartu, garis tepi putih."""
    return (f'<ellipse cx="{CX}" cy="{CY}" rx="84" ry="132" fill="{color}" stroke="#fff" stroke-width="9" '
            f'transform="rotate({TILT} {CX} {CY})"/>')

def edge_marks(color):
    """Simbol color blind di tengah-atas dan tengah-bawah kartu (diputar 180 di bawah)."""
    m = f'<g transform="translate({CX} 37)">{sym(color, 1.0, sw=5)}</g>'
    return m + f'<g transform="rotate(180 {CX} {CY})">{m}</g>'

def txt(s, x, y, size, fill='#fff', sw=7, anchor='middle', outline='#000'):
    return (f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" text-anchor="{anchor}" {FONT} '
            f'stroke="{outline}" stroke-width="{sw}" stroke-linejoin="round" paint-order="stroke">{s}</text>')

def txt_shadow(s, x, y, size, sw=9, dx=5, dy=6):
    """Angka putih berbayang hitam (gaya kartu asli)."""
    shadow = f'<text x="{x+dx}" y="{y+dy}" font-size="{size}" fill="#000" text-anchor="middle" {FONT} stroke="#000" stroke-width="{sw}" stroke-linejoin="round">{s}</text>'
    return shadow + txt(s, x, y, size, '#fff', sw)

# ---------- kartu angka ----------
def number_card(color, n):
    c = COL[color]
    body = oval_ring(c) + txt_shadow(n, CX + 2, 230, 150)
    under = ''
    if n in ('6', '9'):   # 6 dan 9 diberi garis bawah supaya tidak tertukar
        under = (f'<rect x="{CX-30}" y="248" width="64" height="11" rx="3" fill="#000" transform="translate(5 6)"/>'
                 f'<rect x="{CX-30}" y="248" width="64" height="11" rx="3" fill="#fff" stroke="#000" stroke-width="3.5"/>')
    corner = txt(n, 42, 56, 40, sw=6)
    if n in ('6', '9'):
        corner += '<rect x="33" y="63" width="19" height="4.5" rx="1.5" fill="#fff" stroke="#000" stroke-width="2"/>'
    return frame(c, body + under, corner, edge_marks(color))

# ---------- ikon aksi (putih + bayangan hitam) ----------
def shadowed(inner, dx=5, dy=6):
    """Gambar 'inner' dua kali: hitam bergeser (bayangan) lalu putih beroutline hitam."""
    return (f'<g transform="translate({dx} {dy})" fill="#000" stroke="#000" stroke-width="9" stroke-linejoin="round" stroke-linecap="round">{inner}</g>'
            f'<g fill="#fff" stroke="#000" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" paint-order="stroke">{inner}</g>')

def icon_skip(k=1.0):
    inner = '<circle r="46" fill="none" stroke-width="22"/><line x1="-32" y1="32" x2="32" y2="-32" stroke-width="22"/>'
    # versi putih: lingkaran & garis tebal
    return (f'<g transform="scale({k})">'
            f'<g transform="translate(5 6)" fill="none" stroke="#000" stroke-width="32" stroke-linecap="round"><circle r="46"/><line x1="-32" y1="32" x2="32" y2="-32"/></g>'
            f'<g fill="none" stroke="#000" stroke-width="32" stroke-linecap="round"><circle r="46"/><line x1="-32" y1="32" x2="32" y2="-32"/></g>'
            f'<g fill="none" stroke="#fff" stroke-width="20" stroke-linecap="round"><circle r="46"/><line x1="-32" y1="32" x2="32" y2="-32"/></g></g>')

ARROW = '-56,-11 6,-11 6,-28 52,0 6,28 6,11 -56,11'
def icon_reverse(k=1.0):
    # dua panah berlawanan arah, miring 45 derajat (kanan-atas & kiri-bawah)
    a = f'<polygon points="{ARROW}" transform="translate(0 -33)"/>'
    b = f'<polygon points="{ARROW}" transform="translate(0 33) rotate(180)"/>'
    return f'<g transform="scale({k}) rotate(-45)">{shadowed(a + b, 4, 6)}</g>'

def icon_draw2(k=1.0):
    c1 = '<rect x="-14" y="-52" width="58" height="84" rx="9" transform="rotate(14)"/>'
    c2 = '<rect x="-44" y="-30" width="58" height="84" rx="9" transform="rotate(-12)"/>'
    return f'<g transform="scale({k})">{shadowed(c1 + c2, 5, 6)}</g>'

def action_card(color, kind):
    c = COL[color]
    if kind == 'Skip':
        body = oval_ring(c) + f'<g transform="translate({CX} {CY})">{icon_skip()}</g>'
        corner = f'<g transform="translate(43 52)">{icon_skip(0.27)}</g>'
    elif kind == 'Reverse':
        body = oval_ring(c) + f'<g transform="translate({CX} {CY})">{icon_reverse(1.15)}</g>'
        corner = f'<g transform="translate(43 52)">{icon_reverse(0.33)}</g>'
    else:
        body = oval_ring(c) + f'<g transform="translate({CX-2} {CY})">{icon_draw2(1.15)}</g>'
        corner = txt('+2', 46, 54, 34, sw=6)
    return frame(c, body, corner, edge_marks(color))

# ---------- kartu hitam (Wild) ----------
WILD_BG = '#141414'
# urutan seperti kartu asli: merah kiri-atas, biru kanan-atas, kuning kiri-bawah, hijau kanan-bawah
QUAD = [('Red', 0, 0), ('Blue', 1, 0), ('Yellow', 0, 1), ('Green', 1, 1)]

def quad_centroids():
    """Titik tengah tiap warna di dalam oval miring (untuk menaruh simbol color blind di tengah kartu)."""
    th = math.radians(TILT); cs, sn = math.cos(th), math.sin(th)
    acc = {q[0]: [0, 0, 0] for q in QUAD}
    for xi in range(0, 240, 3):
        for yi in range(0, 348, 3):
            dx, dy = xi - CX, yi - CY
            u, v = dx * cs + dy * sn, -dx * sn + dy * cs   # koordinat di sumbu oval
            if (u / 84) ** 2 + (v / 132) ** 2 <= 1:
                name = ('Red' if dy < 0 else 'Yellow') if dx < 0 else ('Blue' if dy < 0 else 'Green')
                a = acc[name]; a[0] += xi; a[1] += yi; a[2] += 1
    return {k: (v[0] / v[2], v[1] / v[2]) for k, v in acc.items()}
CEN = quad_centroids()

def four_color_oval(symbols=True, sym_size=1.5, ring=True, spread=1.0):
    clip = f'<clipPath id="o"><ellipse cx="{CX}" cy="{CY}" rx="84" ry="132" transform="rotate({TILT} {CX} {CY})"/></clipPath>'
    rects = ''.join(f'<rect x="{x*CX}" y="{y*CY}" width="{CX}" height="{CY}" fill="{COL[n]}"/>' for n, x, y in QUAD)
    out = f'<defs>{clip}</defs><g clip-path="url(#o)">{rects}</g>'
    if ring:
        out += f'<ellipse cx="{CX}" cy="{CY}" rx="84" ry="132" fill="none" stroke="#fff" stroke-width="9" transform="rotate({TILT} {CX} {CY})"/>'
    if symbols:   # simbol color blind di tengah kartu, di tiap warna
        for n, (x, y) in CEN.items():
            x, y = CX + (x - CX) * spread, CY + (y - CY) * spread   # spread>1: simbol digeser menjauhi pusat
            out += f'<g transform="translate({x:.1f} {y:.1f})">{sym(n, sym_size, sw=4.5)}</g>'
    return out

def mini_oval(k=0.3):
    """Oval kecil 4 warna (pojok kartu Wild) lengkap dengan simbol color blind."""
    clip = f'<clipPath id="m"><ellipse cx="0" cy="0" rx="84" ry="132" transform="rotate({TILT})"/></clipPath>'
    rects = ''.join(f'<rect x="{-CX if x == 0 else 0}" y="{-CY if y == 0 else 0}" width="{CX}" height="{CY}" fill="{COL[n]}"/>' for n, x, y in QUAD)
    syms = ''.join(f'<g transform="translate({x-CX:.1f} {y-CY:.1f})">{sym(n, 1.9, sw=4)}</g>' for n, (x, y) in CEN.items())
    return (f'<g transform="scale({k})"><defs>{clip}</defs><g clip-path="url(#m)">{rects}</g>'
            f'<ellipse rx="84" ry="132" fill="none" stroke="#fff" stroke-width="16" transform="rotate({TILT})"/>{syms}</g>')

def white_oval():
    return f'<ellipse cx="{CX}" cy="{CY}" rx="84" ry="132" fill="#fff" transform="rotate({TILT} {CX} {CY})"/>'

def fan_cards():
    """Empat kartu warna menyebar (seperti kartu +4 asli), masing-masing dengan simbol color blind."""
    cards = [('Green', 68, 232), ('Blue', 106, 156), ('Yellow', 171, 124), ('Red', 136, 190)]   # urutan gambar: yang terakhir paling depan
    out = ''
    for n, x, y in cards:
        out += (f'<g transform="translate({x} {y})">'
                f'<rect x="-27" y="-43" width="54" height="86" rx="7" fill="#000" transform="translate(5 6)"/>'
                f'<rect x="-27" y="-43" width="54" height="86" rx="7" fill="{COL[n]}" stroke="#000" stroke-width="5"/>'
                f'{sym(n, 1.15, sw=0, fill="#fff", op=.85)}</g>')
    return out

def wild_card(kind):
    if kind == 'Wild':
        body = four_color_oval(symbols=True, sym_size=1.7)
        corner = f'<g transform="translate(47 56)">{mini_oval(0.28)}</g>'
    elif kind == 'WildDrawFour':
        body = white_oval() + fan_cards()
        corner = (txt('+4', 46, 54, 34, '#fff', 15, outline='#fff') + txt('+4', 46, 54, 34, '#fff', 8, outline='#000'))
    else:   # acak kartu (seperti aslinya): oval putih bergambar tangan bertukar kartu, pojok = oval 4 warna
        body = white_oval() + f'<g transform="translate({CX} {CY-4}) rotate(-10)">{icon_hands(0.84)}</g>'
        corner = f'<g transform="translate(47 56)">{mini_oval(0.28)}</g>'
    return frame(WILD_BG, body, corner)

# ---------- gambar tangan saling bertukar kartu (kartu Acak asli) ----------
INK = '#3b3b3b'
def tube(d, w, fill='none'):
    """Jari/tangan berupa pipa: garis tepi tipis, isi putih."""
    return (f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="{w+5}" stroke-linecap="round" stroke-linejoin="round"/>',
            f'<path d="{d}" fill="none" stroke="#fff" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>')

def hand_group(parts):
    """Gabungkan beberapa pipa jadi satu siluet (semua garis tepi dulu, baru isi putih)."""
    outs, fills = zip(*[tube(d, w) for d, w in parts])
    return ''.join(outs) + ''.join(fills)

def icon_hands(k=1.0):
    left = hand_group([
        ('M-92,26 L-52,16', 30),            # punggung tangan kiri
        ('M-50,22 C-40,26 -26,26 -14,22', 10),   # jari melengkung di bawah kartu
        ('M-48,12 C-38,14 -28,14 -16,12', 10),
    ])
    card = (f'<g transform="translate(-4 4) rotate(-24)">'
            f'<rect x="-17" y="-23" width="34" height="46" rx="5" fill="#fff" stroke="{INK}" stroke-width="3.2"/>'
            f'<rect x="-11" y="-17" width="22" height="34" rx="3" fill="none" stroke="{INK}" stroke-width="1.6" opacity=".55"/></g>')
    thumb_l = hand_group([('M-52,6 C-42,-6 -30,-10 -14,-4', 11)])   # ibu jari kiri di atas kartu
    right = hand_group([
        ('M96,22 L52,12', 32),              # punggung tangan kanan
        ('M52,6 C38,-2 26,-10 10,-16', 10), # jari telunjuk
        ('M54,18 C40,16 24,8 8,-2', 10),    # ibu jari mencubit sudut kartu
        ('M56,26 C48,32 42,32 34,30', 9),   # jari lain menekuk
        ('M62,31 C54,38 46,38 40,36', 8),
    ])
    knuckles = (f'<path d="M-72,14 C-66,20 -62,22 -58,22" fill="none" stroke="{INK}" stroke-width="2.4" stroke-linecap="round"/>'
                f'<path d="M70,8 C64,14 62,18 62,22" fill="none" stroke="{INK}" stroke-width="2.4" stroke-linecap="round"/>')
    return f'<g transform="scale({k})">{left}{card}{thumb_l}{right}{knuckles}</g>'

# ---------- punggung kartu ----------
def back_card():
    f = "font-family=\"Inter, 'DejaVu Sans', sans-serif\" font-weight=\"900\" font-style=\"italic\""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="240" height="348" viewBox="0 0 240 348">
<rect x="2" y="2" width="236" height="344" rx="26" fill="#fff" stroke="#00000040" stroke-width="2"/>
<rect x="14" y="14" width="212" height="320" rx="16" fill="#111"/>
<ellipse cx="{CX}" cy="{CY}" rx="84" ry="132" fill="#ef4444" transform="rotate({TILT} {CX} {CY})"/>
<g transform="rotate(-25 {CX} 190)">
<text x="126" y="216" font-size="76" fill="#000" text-anchor="middle" {f} stroke="#000" stroke-width="12" stroke-linejoin="round">UNO</text>
<text x="120" y="208" font-size="76" fill="#ffd400" text-anchor="middle" {f} stroke="#000" stroke-width="9" paint-order="stroke" stroke-linejoin="round">UNO</text></g>
</svg>'''

# ---------- susun semua kartu ----------
cards = {'back': back_card()}
for color in COL:
    for n in range(10):
        cards[f'{color}-{n}'] = number_card(color, str(n))
    for kind in ['Skip', 'Reverse', 'DrawTwo']:
        cards[f'{color}-{kind}'] = action_card(color, kind)
for kind in ['Wild', 'WildDrawFour', 'WildShuffleHands']:
    cards[f'Black-{kind}'] = wild_card(kind)

if __name__ == '__main__':
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 240, 'height': 348})
        for name, svg in cards.items():
            pg.set_content(f'<html><body style="margin:0;background:transparent">{svg}</body></html>')
            pg.screenshot(path=f'{OUT}/{name}.png', omit_background=True, clip={'x': 0, 'y': 0, 'width': 240, 'height': 348})
        imgs = ''.join(f'<img src="file://{os.path.abspath(OUT)}/{n}.png" width="120">' for n in cards)
        pg2 = b.new_page(viewport={'width': 1300, 'height': 1000})
        pg2.set_content(f'<body style="background:#1f2937;margin:10px;display:flex;flex-wrap:wrap;gap:8px">{imgs}</body>')
        pg2.wait_for_timeout(500)
        pg2.screenshot(path=PREVIEW, full_page=True)
        b.close()
    print(len(cards), 'kartu')
