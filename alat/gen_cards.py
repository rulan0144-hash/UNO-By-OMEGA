import os
from playwright.sync_api import sync_playwright

OUT = '/mnt/user-data/outputs/img/cards'
os.makedirs(OUT, exist_ok=True)
COL = {'Red': '#ef4444', 'Green': '#22c55e', 'Blue': '#3b82f6', 'Yellow': '#eab308'}
FONT = "font-family=\"Inter, 'DejaVu Sans', sans-serif\" font-weight=\"900\""
OUTLINE = 'stroke="#000" stroke-width="7" stroke-linejoin="round" paint-order="stroke"'

def card(bg, body, corner_tl, corner_br_same=True):
    """Kerangka kartu 240x348: tepi putih, isi berwarna, isi kartu, sudut kiri-atas & kanan-bawah."""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="240" height="348" viewBox="0 0 240 348">
<rect x="2" y="2" width="236" height="344" rx="26" fill="#fff" stroke="#00000040" stroke-width="2"/>
<rect x="14" y="14" width="212" height="320" rx="16" fill="{bg}"/>
{body}
<g>{corner_tl}</g>
<g transform="rotate(180 120 174)">{corner_tl}</g>
</svg>'''

OVAL_W = '<ellipse cx="120" cy="174" rx="84" ry="132" fill="#fff" transform="rotate(25 120 174)"/>'

def txt(s, x, y, size, fill, anchor='middle', extra=''):
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" text-anchor="{anchor}" {FONT} {OUTLINE} {extra}>{s}</text>'

def number_card(color, n):
    c = COL[color]
    body = OVAL_W + f'<text x="124" y="232" font-size="150" fill="#000" opacity=".35" text-anchor="middle" {FONT}>{n}</text>' + txt(n, 120, 226, 150, c, extra='stroke-width="4.5"')
    corner = txt(n, 42, 56, 40, '#fff', extra='stroke-width="5"')
    return card(c, body, corner)

def icon_skip(c, k=1.0):
    return f'''<g transform="scale({k})" fill="none" stroke-linecap="round">
<circle r="50" stroke="#000" stroke-width="34"/><line x1="-36" y1="36" x2="36" y2="-36" stroke="#000" stroke-width="34"/>
<circle r="50" stroke="{c}" stroke-width="22"/><line x1="-36" y1="36" x2="36" y2="-36" stroke="{c}" stroke-width="22"/></g>'''

ARROW = '-62,-42 6,-42 6,-64 62,-31 6,2 6,-20 -62,-20'
def icon_reverse(c, k=1.0):
    return f'''<g transform="scale({k})" fill="{c}" stroke="#000" stroke-width="8" stroke-linejoin="round" paint-order="stroke">
<polygon points="{ARROW}"/><polygon points="{ARROW}" transform="rotate(180)"/></g>'''

def icon_shuffle(c, k=1.0):
    p1 = 'M-62,-34 H-30 C-6,-34 -6,34 18,34 H36'
    p2 = 'M-62,34 H-30 C-6,34 -6,-34 18,-34 H36'
    return f'''<g transform="scale({k})" fill="none" stroke-linecap="round" stroke-linejoin="round">
<path d="{p1}" stroke="#000" stroke-width="26"/><path d="{p2}" stroke="#000" stroke-width="26"/>
<path d="{p1}" stroke="{c}" stroke-width="14"/><path d="{p2}" stroke="{c}" stroke-width="14"/>
<g fill="{c}" stroke="#000" stroke-width="8" paint-order="stroke"><polygon points="30,16 64,34 30,52"/><polygon points="30,-52 64,-34 30,-16"/></g></g>'''

def action_card(color, kind):
    c = COL[color]
    if kind == 'Skip':
        body = OVAL_W + f'<g transform="translate(120 174)">{icon_skip(c)}</g>'
        corner = f'<g transform="translate(44 48)">{icon_skip("#fff", .3)}</g>'
    elif kind == 'Reverse':
        body = OVAL_W + f'<g transform="translate(120 174)">{icon_reverse(c)}</g>'
        corner = f'<g transform="translate(44 48)">{icon_reverse("#fff", .3)}</g>'
    else:
        body = OVAL_W + f'<text x="124" y="222" font-size="118" fill="#000" opacity=".35" text-anchor="middle" {FONT}>+2</text>' + txt('+2', 120, 216, 118, c)
        corner = txt('+2', 44, 54, 34, '#fff', extra='stroke-width="5"')
    return card(c, body, corner)

WILD_BG = '#141414'
def four_color_oval():
    return '''<defs><clipPath id="o"><ellipse cx="120" cy="174" rx="84" ry="132" transform="rotate(25 120 174)"/></clipPath></defs>
<g clip-path="url(#o)"><rect x="0" y="0" width="120" height="174" fill="#ef4444"/><rect x="120" y="0" width="120" height="174" fill="#eab308"/>
<rect x="0" y="174" width="120" height="174" fill="#3b82f6"/><rect x="120" y="174" width="120" height="174" fill="#22c55e"/></g>
<ellipse cx="120" cy="174" rx="84" ry="132" fill="none" stroke="#fff" stroke-width="8" transform="rotate(25 120 174)"/>'''

def wild_card(kind):
    if kind == 'Wild':
        body = four_color_oval()
        corner = txt('W', 42, 56, 40, '#fff', extra='stroke-width="5"')
    elif kind == 'WildDrawFour':
        body = four_color_oval() + txt('+4', 120, 214, 104, '#fff', extra='stroke-width="9"')
        corner = txt('+4', 44, 54, 34, '#fff', extra='stroke-width="5"')
    else:
        body = four_color_oval() + f'<g transform="translate(120 174)">{icon_shuffle("#fff", 1.05)}</g>'
        corner = f'<g transform="translate(44 48)">{icon_shuffle("#fff", .3)}</g>'
    return card(WILD_BG, body, corner)

def back_card():
    return '''<svg xmlns="http://www.w3.org/2000/svg" width="240" height="348" viewBox="0 0 240 348">
<rect x="2" y="2" width="236" height="344" rx="26" fill="#fff" stroke="#00000040" stroke-width="2"/>
<rect x="14" y="14" width="212" height="320" rx="16" fill="#111"/>
<ellipse cx="120" cy="174" rx="84" ry="132" fill="#ef4444" transform="rotate(25 120 174)"/>
<g transform="rotate(-25 120 190)">
<text x="124" y="214" font-size="72" fill="#000" opacity=".4" text-anchor="middle" font-family="Inter, 'DejaVu Sans', sans-serif" font-weight="900" font-style="italic">UNO</text>
<text x="120" y="208" font-size="72" fill="#ffd400" text-anchor="middle" font-family="Inter, 'DejaVu Sans', sans-serif" font-weight="900" font-style="italic" stroke="#8b0000" stroke-width="6" paint-order="stroke" stroke-linejoin="round">UNO</text></g>
</svg>'''

cards = {'back': back_card()}
for color in COL:
    for n in range(10): cards[f'{color}-{n}'] = number_card(color, str(n))
    for kind, name in [('Skip', 'Skip'), ('Reverse', 'Reverse'), ('DrawTwo', 'DrawTwo')]:
        cards[f'{color}-{name}'] = action_card(color, 'DrawTwo' if name == 'DrawTwo' else kind)
for kind in ['Wild', 'WildDrawFour', 'WildShuffleHands']:
    cards[f'Black-{kind}'] = wild_card(kind)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 240, 'height': 348})
    for name, svg in cards.items():
        pg.set_content(f'<html><body style="margin:0;background:transparent">{svg}</body></html>')
        pg.screenshot(path=f'{OUT}/{name}.png', omit_background=True, clip={'x': 0, 'y': 0, 'width': 240, 'height': 348})
    # lembar pratinjau
    imgs = ''.join(f'<img src="file://{OUT}/{n}.png" width="120">' for n in cards)
    pg2 = b.new_page(viewport={'width': 1300, 'height': 1000})
    pg2.set_content(f'<body style="background:#1f2937;margin:10px;display:flex;flex-wrap:wrap;gap:8px">{imgs}</body>')
    pg2.wait_for_timeout(500)
    pg2.screenshot(path='/mnt/user-data/outputs/preview-kartu.png', full_page=True)
    b.close()
print(len(cards), 'kartu')
