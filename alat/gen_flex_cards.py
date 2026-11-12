"""Pembuat PNG kartu UNO FLEX (240x348) gaya aplikasi + simbol color blind SESUAI FOTO (bukan PDF aturan).
Jalankan: python3 gen_flex_cards.py   (butuh Python + Playwright/Chromium + openpyxl)
Membaca UNO_Flex.xlsx, memvalidasi komposisi (112 kartu), lalu menulis ../img/flex/cards/*.png
Nama: <Warna>-<nilai>[-Flex<WarnaFlex>].png  mis. Blue-1-FlexRed, Red-Reverse-Flex, Black-WildAllFlip
Aturan simbol (foto): takik putih di tengah-atas = warna biasa, takik di tengah-bawah = warna flex.
  Merah = lingkaran, Biru = kotak, Kuning = bintang 4 sudut, Hijau = segitiga.
"""
import os, re, sys, collections
import openpyxl
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get('OUT', os.path.join(HERE, '..', 'img', 'flex', 'cards'))
PREVIEW = os.environ.get('PREVIEW', os.path.join(HERE, '..', 'preview-flex.png'))
SRC = os.path.join(HERE, 'UNO_Flex.xlsx')
os.makedirs(OUT, exist_ok=True)
COL = {'Red': '#ef4444', 'Green': '#22c55e', 'Blue': '#3b82f6', 'Yellow': '#eab308'}
FONT = "font-family=\"Inter, 'DejaVu Sans', sans-serif\" font-weight=\"900\""
CX, CY, TILT = 120, 174, 25

# ---------- baca & validasi Excel ----------
ws = openpyxl.load_workbook(SRC, data_only=False).active
cells = {}
for row in ws.iter_rows():
    for c in row:
        if isinstance(c.value, str) and not c.value.startswith('='): cells[c.coordinate] = c.value.strip()
def num(coord): return ws[coord].value
classic, flex, wild = [], [], collections.Counter()
for r in range(3, 14):
    for cc in 'ADGJ':
        classic.append((cells[f'{cc}{r}'], r))
for r in range(17, 28):
    for cc in 'ADGJ':
        flex.append(cells[f'{cc}{r}'])
# kartu Flip-icon = sel yang dirujuk kolom Q (=A4, =D3, ...)
FLIPICON = {ws.cell(r, 17).value[1:] for r in range(3, 20) if isinstance(ws.cell(r, 17).value, str) and ws.cell(r, 17).value.startswith('=')}
FLIPICON = {cells[c] for c in FLIPICON if c in cells}
WILDS = {'Wild All Flip': ('WildAllFlip', 6), 'Wild Flex All Draw 2': ('WildFlexAllDraw2', 4),
         'Wild Flex Target Draw 2': ('WildFlexTargetDraw2', 4), 'Wild Draw 4 Flex Wild Target Draw  4': ('WildDrawFourFlexTarget4', 2)}
wild_rows = {}
for r in range(3, 8):
    n = cells.get(f'M{r}')
    if n:
        key = ' '.join(n.split()); key2 = n
        wild_rows[n] = int(ws[f'N{r}'].value)
assert len(classic) == 44 and len(flex) == 44, (len(classic), len(flex))
assert len(FLIPICON) == 16, FLIPICON
wild_counts = {}
for n, q in wild_rows.items():
    k = next((v for kk, v in WILDS.items() if ' '.join(kk.split()) == ' '.join(n.split())), None)
    if k is None and ' '.join(n.split()) == 'Power': continue
    if k is not None: assert q == k[1], (n, q)
    if k is not None: wild_counts[k[0]] = q
assert sum(wild_counts.values()) == 16, wild_counts
power_total = wild_rows.get('Power', 8)
total = 44 + 44 + sum(wild_counts.values()) + power_total
assert total == 112, total
print('Komposisi OK:', total, 'kartu (klasik 44, flex 44, wild 16, power', power_total, ') flip-icon:', len(FLIPICON))

# Skip Everyone: ikon SAMA dengan UNO Flip (tanda dilarang + panah melingkar), diambil dari gen_flip_cards.py
_fsrc = open(os.path.join(HERE, 'gen_flip_cards.py'), encoding='utf-8').read()
_fns = {}
exec(_fsrc[_fsrc.index('# ---------- melukis ikon'):_fsrc.index('def corner_icon')], _fns)
icon_skip_everyone = _fns['icon_skip_everyone']
# ---------- simbol ----------
def sym(color, size=1.0, fill='#fff', stroke='#000', sw=5, op=1):
    s = f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round" paint-order="stroke" opacity="{op}"'
    shape = {'Red': f'<circle r="13" {s}/>', 'Blue': f'<rect x="-12" y="-12" width="24" height="24" rx="3" {s}/>',
             'Yellow': f'<path d="M0,-17 C2,-6 6,-2 17,0 C6,2 2,6 0,17 C-2,6 -6,2 -17,0 C-6,-2 -2,-6 0,-17 Z" {s}/>'}.get(color, f'<path d="M-14,-11 H14 L0,14 Z" {s}/>')
    return f'<g transform="scale({size})">{shape}</g>'
def notch(color, x, y):   # simbol color blind SAMA dengan kartu Klasik & Flip: ukuran 1.0, isi putih, tepi hitam tebal 5
    return f'<g transform="translate({x} {y})">{sym(color, 1.0, "#fff", "#000", 5)}</g>'

def txt(s, x, y, size, fill='#fff', sw=7, anchor='middle', outline='#000'):
    return (f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" text-anchor="{anchor}" {FONT} stroke="{outline}" '
            f'stroke-width="{sw}" stroke-linejoin="round" paint-order="stroke">{s}</text>')
def txt_shadow(s, x, y, size, sw=9, dx=5, dy=6):
    return (f'<text x="{x+dx}" y="{y+dy}" font-size="{size}" fill="#000" text-anchor="middle" {FONT} stroke="#000" stroke-width="{sw}" stroke-linejoin="round">{s}</text>'
            + txt(s, x, y, size, '#fff', sw))
def shadowed(inner, dx=5, dy=6):
    return (f'<g transform="translate({dx} {dy})" fill="#000" stroke="#000" stroke-width="9" stroke-linejoin="round" stroke-linecap="round">{inner}</g>'
            f'<g fill="#fff" stroke="#000" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" paint-order="stroke">{inner}</g>')
def strokes(geo, w):
    return (f'<g fill="none" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(5 6)" stroke="#000" stroke-width="{w+12}">{geo}</g>'
            f'<g stroke="#000" stroke-width="{w+12}">{geo}</g><g stroke="#fff" stroke-width="{w}">{geo}</g></g>')

# ---------- ikon (putih + bayangan) ----------
def icon_skip(k=1.0): return f'<g transform="scale({k})">{strokes("<circle r=\"46\"/><line x1=\"-32\" y1=\"32\" x2=\"32\" y2=\"-32\"/>", 20)}</g>'
ARROW = '-56,-11 6,-11 6,-28 52,0 6,28 6,11 -56,11'
def icon_reverse(k=1.0):
    a = f'<polygon points="{ARROW}" transform="translate(0 -33)"/>'; b = f'<polygon points="{ARROW}" transform="translate(0 33) rotate(180)"/>'
    return f'<g transform="scale({k}) rotate(-45)">{shadowed(a + b, 4, 6)}</g>'
def icon_draw2(k=1.0):
    c1 = '<rect x="-14" y="-52" width="58" height="84" rx="9" transform="rotate(14)"/>'
    c2 = '<rect x="-44" y="-30" width="58" height="84" rx="9" transform="rotate(-12)"/>'
    return f'<g transform="scale({k})">{shadowed(c1 + c2, 5, 6)}</g>'
def icon_loop(k=1.0):      # Skip Everyone: panah melingkar kembali ke pemain
    return (f'<g transform="scale({k})">{strokes("<path d=\"M-52,-22 A58,58 0 1 0 38,-40\"/>", 11)}'
            f'<polygon points="22,-70 66,-30 20,-24" fill="#fff" stroke="#000" stroke-width="7" stroke-linejoin="round"/></g>')
def icon_group(k=1.0, fill='#fff', ln='#000'):   # tiga orang (semua pemain)
    p = lambda x, y, r: f'<circle cx="{x}" cy="{y}" r="{r}"/><path d="M{x-r*1.1},{y+r*2.4} q{r*1.1},-{r*1.6} {r*2.2},0 v{r*.9} h-{r*2.2} z"/>'
    inner = p(-24, 0, 14) + p(24, 0, 14) + p(0, -14, 16)
    return f'<g transform="scale({k})"><g fill="{fill}" stroke="{ln}" stroke-width="6" stroke-linejoin="round" paint-order="stroke">{inner}</g></g>'
def icon_target(k=1.0):   # bidikan = pemain target
    return (f'<g transform="scale({k})"><g fill="none" stroke="#000" stroke-width="13" stroke-linecap="round"><circle r="22"/><path d="M0,-34 V-14 M0,34 V14 M-34,0 H-14 M34,0 H14"/></g>'
            f'<g fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"><circle r="22"/><path d="M0,-34 V-14 M0,34 V14 M-34,0 H-14 M34,0 H14"/></g></g>')
def badge(inner, r=17, bg='#fff', fg='#000'):
    return f'<circle r="{r}" fill="{bg}" stroke="#000" stroke-width="3"/><g transform="scale({r/20})">{inner}</g>'
def icon_flipsym(k=1.0):   # ikon Flip (foto): kotak bersudut bulat + panah balik di dalamnya
    g = '<rect x="-17" y="-17" width="34" height="34" rx="8"/><path d="M9,11 V-3 H-5"/><path d="M-4,-11 L-12,-3 L-4,5"/>'
    return (f'<g transform="scale({k})" fill="none" stroke-linecap="round" stroke-linejoin="round">'
            f'<g stroke="#000" stroke-width="11">{g}</g><g stroke="#fff" stroke-width="5">{g}</g></g>')

def half_num(n, x, y, size, low, uid, sw=6):
    """Angka sudut setengah berwarna: separuh atas putih, separuh bawah berwarna (batas bergerigi), seperti kartu asli."""
    mid = y - size * 0.34
    zz = ''.join(f' L{x-30+i*6+3},{mid + (3 if i % 2 == 0 else -3)} L{x-30+(i+1)*6},{mid}' for i in range(11))
    clip = f'<clipPath id="{uid}"><path d="M{x-30},{mid}{zz} L{x+36},{y+14} L{x-30},{y+14} Z"/></clipPath>'
    return (f'<defs>{clip}</defs>' + txt(n, x, y, size, '#fff', sw) +
            f'<g clip-path="url(#{uid})">' + txt(n, x, y, size, low, sw) + '</g>')

# ---------- kerangka ----------
def frame(bg, body, corner, marks='', under='', rot=True):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="240" height="348" viewBox="0 0 240 348"><defs>
<pattern id="st" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="STRIPEBG"/><rect width="4.5" height="9" fill="#fff"/></pattern>
<pattern id="stk" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="#161616"/><rect width="4.5" height="9" fill="#8d8590"/></pattern>
<clipPath id="face"><rect x="14" y="14" width="212" height="320" rx="16"/></clipPath></defs>
<rect x="2" y="2" width="236" height="344" rx="26" fill="#fff" stroke="#00000040" stroke-width="2"/>
<rect x="14" y="14" width="212" height="320" rx="16" fill="{bg}"/>
{under}{body}
<g>{corner}</g>{('<g transform="rotate(180 %d %d)">%s</g>' % (CX, CY, corner)) if rot else ''}
{marks}</svg>'''.replace('STRIPEBG', bg)

def oval(fill, ring='#fff', w=9, dash=''):
    return (f'<ellipse cx="{CX}" cy="{CY}" rx="84" ry="132" fill="{fill}" stroke="{ring}" stroke-width="{w}" {dash} '
            f'transform="rotate({TILT} {CX} {CY})"/>')

# ---------- kartu klasik (bernotch atas & bawah sewarna) ----------
def marks_plain(color):
    return notch(color, CX, 37) + f'<g transform="rotate(180 {CX} {CY})">{notch(color, CX, 37)}</g>'
def flipmark(n, flipicon):
    return f'<g transform="translate(66 52)">{icon_flipsym(.5)}</g>' if flipicon else ''
def classic_number(color, n, flipicon):
    c = COL[color]
    body = oval(c) + txt_shadow(n, CX + 2, 230, 150)
    if n in '69': body += f'<rect x="{CX-30}" y="248" width="64" height="11" rx="3" fill="#fff" stroke="#000" stroke-width="3.5"/>'
    corner = txt(n, 42, 56, 40, sw=6) + flipmark(n, flipicon)
    return frame(c, body, corner, marks_plain(color))
def classic_action(color, kind):
    c = COL[color]
    ic = {'Skip': icon_skip(1), 'Reverse': icon_reverse(1.15), 'DrawTwo': icon_draw2(1.15)}[kind]
    cn = {'Skip': icon_skip(.27), 'Reverse': icon_reverse(.33)}.get(kind) or txt('+2', 46, 54, 34, sw=6)
    corner = f'<g transform="translate(43 52)">{cn}</g>' if kind != 'DrawTwo' else cn
    return frame(c, oval(c) + f'<g transform="translate({CX} {CY})">{ic}</g>', corner, marks_plain(color))

# ---------- kartu flex angka: badan warna biasa, pita bawah warna flex, garis oval warna flex ----------
def band(fc):
    """Separuh flex: kanan-bawah, dibatasi garis miring (kiri-atas = warna biasa), seperti permintaan pengguna."""
    return f'<g clip-path="url(#face)"><path d="M14,246 L226,108 L226,340 L14,340 Z" fill="{fc}"/></g>'
def flex_number(color, flexc, n, flipicon=False):
    c, f = COL[color], COL[flexc]
    under = band(f)
    body = (f'<ellipse cx="{CX}" cy="{CY}" rx="84" ry="132" fill="{c}" stroke="#fff" stroke-width="9" transform="rotate({TILT} {CX} {CY})"/>'
            f'<clipPath id="fxh"><path d="M14,246 L226,108 L226,14 L14,14 Z"/></clipPath>'
            f'<g clip-path="url(#fxh)"><ellipse cx="{CX}" cy="{CY}" rx="84" ry="132" fill="none" stroke="{f}" stroke-width="6" transform="rotate({TILT} {CX} {CY})"/></g>'
            + txt_shadow(n, CX + 2, 218, 140))
    if n in '69': body += f'<rect x="{CX-30}" y="236" width="64" height="10" rx="3" fill="#fff" stroke="#000" stroke-width="3.5"/>'
    top = half_num(n, 41, 60, 50, f, 'hc1', 7)
    bot = f'<g transform="rotate(180 {CX} {CY})">{half_num(n, 41, 60, 50, c, "hc2", 7)}</g>'   # di atas pita flex: separuh warna biasa
    if n in '69':
        top += '<rect x="30" y="68" width="22" height="5" rx="1.5" fill="#fff" stroke="#000" stroke-width="2"/>'
        bot += f'<g transform="rotate(180 {CX} {CY})"><rect x="30" y="68" width="22" height="5" rx="1.5" fill="#fff" stroke="#000" stroke-width="2"/></g>'
    top += flipmark(n, flipicon)
    marks = notch(color, CX, 37) + notch(flexc, CX, 311)
    return frame(c, body, top + bot, marks, under, False)

# ---------- kartu flex aksi: garis putus-putus oval + pita belang diagonal + ikon flex ----------
def stripe_band(color_bg):
    return '<g clip-path="url(#face)"><path d="M14,246 L226,108 L226,340 L14,340 Z" fill="url(#st)"/></g>'
def flex_action(color, kind):
    c = COL[color]
    if kind == 'Reverse':   # biasa: Reverse; flex: Reverse + Skip
        main = icon_reverse(1.15); cmain = icon_reverse(.33)
        fl = f'<g transform="translate(160 314)">{badge(icon_skip(.4), 19)}</g><g transform="translate(200 310)">{icon_reverse(.3)}</g>'
    elif kind == 'Skip':    # biasa: Skip; flex: Skip semua (kembali ke diri)
        main = icon_skip(1); cmain = icon_skip(.27)
        fl = f'<g transform="translate(188 302)">{icon_skip_everyone("darkwhite", .5)}</g>'
    else:                   # +2 biasa; flex: semua lawan +1
        main = icon_draw2(1.15); cmain = None
        fl = f'<g transform="translate(192 306)"><circle r="27" fill="#111" stroke="#fff" stroke-width="4"/>{icon_group(.6)}<g transform="translate(16 -22)"><circle r="12" fill="#fff" stroke="#000" stroke-width="2"/><text y="5" font-size="13" fill="#000" text-anchor="middle" {FONT}>+1</text></g></g>'
    if kind == 'Draw2':
        corner = txt('+2', 40, 54, 34, sw=6) + f'<g transform="translate(88 40)" opacity=".8">{icon_group(.32)}<text y="14" x="9" font-size="11" fill="#fff" text-anchor="middle" {FONT} stroke="#000" stroke-width="2.5" paint-order="stroke">+1</text></g>'
    elif kind == 'Reverse':
        corner = f'<g transform="translate(43 52)">{cmain}</g><g transform="translate(76 40)" opacity=".8">{icon_reverse(.17)}</g><g transform="translate(92 42)" opacity=".8">{icon_skip(.14)}</g>'
    else:
        corner = f'<g transform="translate(43 52)">{cmain}</g><g transform="translate(80 42)" opacity=".8">{icon_skip_everyone("darkwhite", .2)}</g>'
    body = (f'<ellipse cx="{CX}" cy="{CY}" rx="84" ry="132" fill="{c}" stroke="#fff" stroke-width="9" transform="rotate({TILT} {CX} {CY})"/>'
            f'<ellipse cx="{CX}" cy="{CY}" rx="97" ry="144" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="6 6" transform="rotate({TILT} {CX} {CY})" opacity=".0"/>'
            f'<g transform="translate({CX} {CY-10})">{main}</g>' + fl)
    ring = (f'<ellipse cx="{CX}" cy="{CY}" rx="95" ry="143" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="5 6" transform="rotate({TILT} {CX} {CY})"/>')
    return frame(c, ring + body.replace('<g transform="translate(%d %d)">' % (CX, CY - 10), '<g transform="translate(%d %d)">' % (CX, CY - 14)), corner, notch(color, CX, 37) + notch(color, CX, 311), stripe_band(c), False)

# ---------- kartu hitam ----------
QUAD = [('Red', 0, 0), ('Blue', 1, 0), ('Yellow', 0, 1), ('Green', 1, 1)]
def quad_oval(cx=CX, cy=CY, ring='#fff', syms=False, rot=TILT):
    clip = f'<clipPath id="o"><ellipse cx="{cx}" cy="{cy}" rx="84" ry="132" transform="rotate({rot} {cx} {cy})"/></clipPath>'
    rects = ''.join(f'<rect x="{x*cx}" y="{y*cy}" width="{cx}" height="{cy}" fill="{COL[n]}"/>' for n, x, y in QUAD)
    out = f'<defs>{clip}</defs><g clip-path="url(#o)">{rects}</g><ellipse cx="{cx}" cy="{cy}" rx="84" ry="132" fill="none" stroke="{ring}" stroke-width="9" transform="rotate({rot} {cx} {cy})"/>'
    if syms:
        for n, (x, y) in {'Red': (86, 126), 'Blue': (158, 112), 'Yellow': (84, 232), 'Green': (156, 224)}.items():
            out += f'<g transform="translate({x} {y})">{sym(n, 1.5, sw=5)}</g>'
    return out
def mini_oval(cx=44, cy=52, k=.32):
    return f'<g transform="translate({cx} {cy}) scale({k}) translate({-CX} {-CY})">{quad_oval(syms=True, ring="#fff").replace(chr(34)+"o"+chr(34), chr(34)+"mo"+chr(34)).replace("#o", "#mo")}</g>'
def stripe_black():
    ring = f'<ellipse cx="{CX}" cy="{CY}" rx="96" ry="144" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="5 6" transform="rotate({TILT} {CX} {CY})"/>'
    return '<g clip-path="url(#face)"><path d="M14,246 L226,108 L226,340 L14,340 Z" fill="url(#stk)"/></g>' + ring
def white_oval(): return oval('#fff', '#fff', 0)
def wild_card(kind):
    under = stripe_black()
    if kind == 'WildAllFlip':   # semua pemain membalik Power Card
        body = quad_oval(syms=False) + f'<g transform="translate({CX} {CY})"><circle r="56" fill="#fff" stroke="#000" stroke-width="5"/><g transform="translate(0 -8)">{icon_group(1.0, "#fff", "#000")}</g></g><g transform="translate({CX+34} {CY+40})"><circle r="21" fill="#111" stroke="#fff" stroke-width="4"/>{icon_flipsym(.85)}</g>'
        corner = f'<g transform="translate(47 52)">{icon_group(.5)}</g><g transform="translate(66 66)">{icon_flipsym(.45)}</g>'
        return frame('#141414', body, corner, '', '')
    # Wild flex: kiri-atas = aksi biasa (Wild / +4) + logo kecil aksi flex; kanan-bawah = HANYA aksi flex (tanpa salinan putar)
    def lbl(t, y=6, size=15): return f'<text y="{y}" font-size="{size}" fill="#fff" text-anchor="middle" {FONT} stroke="#000" stroke-width="3.5" paint-order="stroke">{t}</text>'
    def bottom_flex(inner): return f'<g transform="translate(190 304) rotate(180)"><circle r="29" fill="#111" stroke="#fff" stroke-width="4"/>{inner}</g>'
    if kind == 'WildFlexAllDraw2':
        body = quad_oval(syms=True)
        corner = (f'<g transform="translate(48 62)">{mini_oval(0,0,.27)}</g>'
                  f'<g transform="translate(88 46)" opacity=".9">{icon_group(.3)}<g transform="translate(9 11)">{lbl("+2", 4, 10)}</g></g>')
        flex = bottom_flex(f'<g transform="translate(0 -9)">{icon_group(.5)}</g><g transform="translate(0 17)">{lbl("+2", 4, 14)}</g>')
        return frame('#141414', body, corner, flex, under, False)
    if kind == 'WildFlexTargetDraw2':
        body = quad_oval(syms=True)
        corner = (f'<g transform="translate(48 62)">{mini_oval(0,0,.27)}</g>'
                  f'<g transform="translate(88 46)" opacity=".9">{icon_target(.34)}{lbl("+2", 4, 11)}</g>')
        flex = bottom_flex(f'{icon_target(.78)}{lbl("+2", 6, 17)}')
        return frame('#141414', body, corner, flex, under, False)
    body = white_oval()
    cards = [('Green', 68, 232), ('Blue', 106, 156), ('Yellow', 171, 124), ('Red', 136, 190)]
    for n, x, y in cards:
        body += (f'<g transform="translate({x} {y})"><rect x="-27" y="-43" width="54" height="86" rx="7" fill="#000" transform="translate(5 6)"/>'
                 f'<rect x="-27" y="-43" width="54" height="86" rx="7" fill="{COL[n]}" stroke="#000" stroke-width="5"/>{sym(n, 1.15, sw=0, fill="#fff", op=.85)}</g>')
    corner = (txt('+4', 40, 54, 32, '#fff', 14, outline='#fff') + txt('+4', 40, 54, 32, '#fff', 7) +
              f'<g transform="translate(88 42)" opacity=".9">{icon_target(.34)}{lbl("+4", 4, 11)}</g>')
    flex = bottom_flex(f'{icon_target(.78)}{lbl("+4", 6, 17)}')
    return frame('#141414', body, corner, flex, under, False)

# ---------- Power Card & punggung ----------
def power(ok):
    bg, fg = ('#58b82a', '#3d9120') if ok else ('#e23b3b', '#b32020')
    g = ''.join(f'<text x="{14+c*46+(23 if r%2 else 0)}" y="{36+r*46}" font-size="38" fill="{fg}" opacity=".55" {FONT} text-anchor="middle">{"✓" if ok else "✕"}</text>'
                for r in range(9) for c in range(-1, 6))
    mark = ('<path d="M-30,2 L-10,24 L32,-24" fill="none" stroke="#000" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>'
            '<path d="M-30,2 L-10,24 L32,-24" fill="none" stroke="#fff" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>') if ok else \
           ('<path d="M-26,-26 L26,26 M26,-26 L-26,26" stroke="#000" stroke-width="30" stroke-linecap="round"/><path d="M-26,-26 L26,26 M26,-26 L-26,26" stroke="#fff" stroke-width="18" stroke-linecap="round"/>')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="240" height="348" viewBox="0 0 240 348"><defs><clipPath id="face"><rect x="14" y="14" width="212" height="320" rx="16"/></clipPath>
<linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{bg}"/><stop offset="1" stop-color="{fg}"/></linearGradient></defs>
<rect x="2" y="2" width="236" height="344" rx="26" fill="{bg}" stroke="#00000030" stroke-width="2"/>
<g clip-path="url(#face)">{g}</g><rect x="14" y="14" width="212" height="320" rx="16" fill="none" stroke="#ffffff55" stroke-width="3"/>
<g transform="translate({CX} {CY})"><circle r="68" fill="#fff" stroke="#000" stroke-width="6"/><circle r="52" fill="{bg}" stroke="#000" stroke-width="3"/>{mark}</g></svg>'''
def back_card():
    f = "font-family=\"Inter, 'DejaVu Sans', sans-serif\" font-weight=\"900\" font-style=\"italic\""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="240" height="348" viewBox="0 0 240 348">
<rect x="2" y="2" width="236" height="344" rx="26" fill="#fff" stroke="#00000040" stroke-width="2"/><rect x="14" y="14" width="212" height="320" rx="16" fill="#111"/>
<ellipse cx="{CX}" cy="{CY}" rx="84" ry="132" fill="#22a447" stroke="#fff" stroke-width="0" transform="rotate({TILT} {CX} {CY})"/>
<g transform="rotate(-25 {CX} 190)"><text x="126" y="196" font-size="64" fill="#000" text-anchor="middle" {f} stroke="#000" stroke-width="12" stroke-linejoin="round">UNO</text>
<text x="120" y="188" font-size="64" fill="#ffd400" text-anchor="middle" {f} stroke="#000" stroke-width="9" paint-order="stroke" stroke-linejoin="round">UNO</text>
<text x="132" y="240" font-size="46" fill="#fff" text-anchor="middle" {f} stroke="#000" stroke-width="9" paint-order="stroke" stroke-linejoin="round">FLEX!</text></g></svg>'''

# ---------- susun semua kartu ----------
cards = {'back': back_card(), 'Power-Go': power(True), 'Power-Stop': power(False)}
for nm, rr in classic:
    col, val = nm.split(' ', 1)
    if val.isdigit(): cards[f'{col}-{val}'] = classic_number(col, val, nm in FLIPICON)
    else: cards[f'{col}-' + {'Reverse': 'Reverse', 'Skip': 'Skip', 'Draw 2': 'DrawTwo'}[val]] = classic_action(col, {'Reverse': 'Reverse', 'Skip': 'Skip', 'Draw 2': 'DrawTwo'}[val])
for nm in flex:
    m = re.fullmatch(r'(\w+) Flex (\w+) (\d)', nm)
    if m: cards[f'{m[1]}-{m[3]}-Flex{m[2]}'] = flex_number(m[1], m[2], m[3]); continue
    col = nm.split(' ')[0]
    if 'Reverse' in nm: cards[f'{col}-Reverse-Flex'] = flex_action(col, 'Reverse')
    elif 'Skip' in nm: cards[f'{col}-Skip-Flex'] = flex_action(col, 'Skip')
    elif 'Draw 2' in nm: cards[f'{col}-DrawTwo-Flex'] = flex_action(col, 'Draw2')
    else: raise SystemExit('kartu flex tak dikenal: ' + nm)
for k in wild_counts: cards[f'Black-{k}'] = wild_card(k)
assert len([k for k in cards if k not in ('back', 'Power-Go', 'Power-Stop')]) == 44 + 44 + 4, len(cards)

if __name__ == '__main__':
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width': 240, 'height': 348})
        for name, svg in cards.items():
            pg.set_content(f'<html><body style="margin:0;background:transparent">{svg}</body></html>')
            pg.screenshot(path=f'{OUT}/{name}.png', omit_background=True, clip={'x': 0, 'y': 0, 'width': 240, 'height': 348})
        imgs = ''.join(f'<img src="file://{os.path.abspath(OUT)}/{n}.png" width="120">' for n in cards)
        p2 = b.new_page(viewport={'width': 1300, 'height': 900})
        p2.set_content(f'<body style="background:#3a2a1c;margin:10px;display:flex;flex-wrap:wrap;gap:8px">{imgs}</body>'); p2.wait_for_timeout(600)
        p2.screenshot(path=PREVIEW, full_page=True); b.close()
    print(len(cards), 'gambar kartu Flex dibuat di', os.path.abspath(OUT))
