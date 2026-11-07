import os, math
from playwright.sync_api import sync_playwright

OUT = '/mnt/user-data/outputs/img/effects'
os.makedirs(OUT, exist_ok=True)
FONT = "font-family=\"Inter, 'DejaVu Sans', sans-serif\" font-weight=\"900\""
SHADOW = '<filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="9" flood-color="#000" flood-opacity=".45"/></filter>'

def svg(body, size=512):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}"><defs>{SHADOW}</defs><g filter="url(#sh)">{body}</g></svg>'

def burst(cx, cy, r_out, r_in, n, fill, rot=0):
    pts = []
    for i in range(n * 2):
        a = math.pi * i / n + math.radians(rot)
        r = r_out if i % 2 == 0 else r_in
        pts.append(f'{cx + r * math.cos(a):.1f},{cy + r * math.sin(a):.1f}')
    p = ' '.join(pts)
    return (f'<polygon points="{p}" fill="#000" stroke="#000" stroke-width="22" stroke-linejoin="round"/>'
            f'<polygon points="{p}" fill="{fill}" stroke="#fff" stroke-width="10" stroke-linejoin="round"/>')

def big_text(s, size, y=0, fill='#fff', x=256, extra=''):
    return (f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" text-anchor="middle" {FONT} stroke="#000" '
            f'stroke-width="{max(10, size // 12)}" stroke-linejoin="round" paint-order="stroke" {extra}>{s}</text>')

def grad(id_, a, b):
    return f'<radialGradient id="{id_}" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></radialGradient>'

fx = {}

# ---- +2 dan +4 : ledakan dengan angka ----
fx['draw2'] = svg(f'<defs>{grad("g", "#fde047", "#f59e0b")}</defs>' + burst(256, 256, 236, 186, 14, 'url(#g)', -8) + big_text('+2', 210, 326))
fx['draw4'] = svg(f'<defs>{grad("g", "#d8b4fe", "#7e22ce")}</defs>' + burst(256, 256, 236, 186, 14, 'url(#g)', -8) + big_text('+4', 210, 326))


# ---- Skip: lencana biru dengan tanda dilarang ----
def badge(fill):
    return (f'<circle cx="256" cy="256" r="226" fill="#000" stroke="#000" stroke-width="20"/>'
            f'<circle cx="256" cy="256" r="226" fill="{fill}" stroke="#fff" stroke-width="14"/>')
fx['skip'] = svg(badge('#3b82f6') +
    '<g fill="none" stroke-linecap="round"><circle cx="256" cy="256" r="104" stroke="#000" stroke-width="72"/><line x1="182" y1="330" x2="330" y2="182" stroke="#000" stroke-width="72"/>'
    '<circle cx="256" cy="256" r="104" stroke="#fff" stroke-width="48"/><line x1="182" y1="330" x2="330" y2="182" stroke="#fff" stroke-width="48"/></g>')

# ---- Reverse: lencana hijau dengan dua panah melingkar ----
def arc_arrow(t0, t1, r=108, cx=256, cy=256):
    p = lambda t, rr=r: (cx + rr * math.cos(math.radians(t)), cy + rr * math.sin(math.radians(t)))
    (x0, y0), (x1, y1) = p(t0), p(t1)
    path = f'M{x0:.1f},{y0:.1f} A{r},{r} 0 0 1 {x1:.1f},{y1:.1f}'
    tx, ty = -math.sin(math.radians(t1)), math.cos(math.radians(t1))
    nx, ny = math.cos(math.radians(t1)), math.sin(math.radians(t1))
    tip = (x1 + tx * 52, y1 + ty * 52); b1 = (x1 - tx * 8 + nx * 50, y1 - ty * 8 + ny * 50); b2 = (x1 - tx * 8 - nx * 50, y1 - ty * 8 - ny * 50)
    head = ' '.join(f'{a:.1f},{b:.1f}' for a, b in (tip, b1, b2))
    return (f'<path d="{path}" fill="none" stroke="#000" stroke-width="64" stroke-linecap="round"/>'
            f'<path d="{path}" fill="none" stroke="#fff" stroke-width="40" stroke-linecap="round"/>'
            f'<polygon points="{head}" fill="#fff" stroke="#000" stroke-width="12" stroke-linejoin="round" paint-order="stroke"/>')
fx['reverse'] = svg(badge('#22c55e') + arc_arrow(200, 330) + arc_arrow(20, 150))

# ---- Acak: lencana oranye dengan panah menyilang ----
P1 = 'M-62,-34 H-30 C-6,-34 -6,34 18,34 H36'; P2 = 'M-62,34 H-30 C-6,34 -6,-34 18,-34 H36'
fx['shuffle'] = svg(badge('#fb923c') + f'''<g transform="translate(256 256) scale(2.5)" fill="none" stroke-linecap="round" stroke-linejoin="round">
<path d="{P1}" stroke="#000" stroke-width="26"/><path d="{P2}" stroke="#000" stroke-width="26"/>
<path d="{P1}" stroke="#fff" stroke-width="14"/><path d="{P2}" stroke="#fff" stroke-width="14"/>
<g fill="#fff" stroke="#000" stroke-width="8" paint-order="stroke"><polygon points="30,16 64,34 30,52"/><polygon points="30,-52 64,-34 30,-16"/></g></g>''')

# ---- UNO! ----
fx['uno'] = svg(f'<defs>{grad("g", "#fef08a", "#f59e0b")}</defs>' + burst(256, 256, 244, 196, 16, 'url(#g)', 5) +
    '<ellipse cx="256" cy="256" rx="165" ry="205" fill="#000" stroke="#000" stroke-width="22" transform="rotate(25 256 256)"/>'
    '<ellipse cx="256" cy="256" rx="165" ry="205" fill="#ef4444" stroke="#fff" stroke-width="12" transform="rotate(25 256 256)"/>'
    f'<g transform="rotate(-25 256 270)"><text x="262" y="316" font-size="132" fill="#000" opacity=".4" text-anchor="middle" {FONT} font-style="italic">UNO!</text>'
    f'<text x="256" y="306" font-size="132" fill="#ffd400" text-anchor="middle" {FONT} font-style="italic" stroke="#8b0000" stroke-width="12" stroke-linejoin="round" paint-order="stroke">UNO!</text></g>')

# ---- Pemilih warna Wild: empat balok membentuk berlian ----
COLS = {'Red': ('#ef4444', '#b91c1c'), 'Green': ('#22c55e', '#15803d'), 'Blue': ('#3b82f6', '#1d4ed8'), 'Yellow': ('#eab308', '#a16207')}
CELL = {'Green': (-1, -1), 'Yellow': (1, -1), 'Red': (1, 1), 'Blue': (-1, 1)}   # atas, kanan, bawah, kiri setelah diputar 45 derajat
def wild(sel=None):
    s, d, parts = 120, 64, ['<ellipse cx="256" cy="420" rx="170" ry="34" fill="#000" opacity=".25"/>']
    for name, (sx, sy) in CELL.items():
        face, side = COLS[name]
        pop = 34 if name == sel else 0
        cx, cy = sx * d + sx * pop, sy * d + sy * pop
        dim = ' opacity=".55"' if sel and name != sel else ''
        glow = ' style="filter:drop-shadow(0 0 22px #fff)"' if name == sel else ''
        lift = 20 if name == sel else 14
        k = lift * 0.7071   # arah "bawah layar" setelah putaran 45 derajat
        parts.append(f'<g transform="translate(256 236) rotate(45)"{dim}{glow}>'
                     f'<rect x="{cx - s/2 + k:.1f}" y="{cy - s/2 + k:.1f}" width="{s}" height="{s}" rx="24" fill="{side}" stroke="#000" stroke-width="10"/>'
                     f'<rect x="{cx - s/2:.1f}" y="{cy - s/2:.1f}" width="{s}" height="{s}" rx="24" fill="{face}" stroke="#000" stroke-width="10"/>'
                     f'<rect x="{cx - s/2 + 12:.1f}" y="{cy - s/2 + 12:.1f}" width="{s - 24}" height="26" rx="12" fill="#fff" opacity=".28"/></g>')
    return svg(''.join(parts))
fx['wild-spin'] = wild()
for c in COLS: fx[f'wild-{c}'] = wild(c)

# ---- Palu kayu & benturan (efek tangkap pemain yang lupa UNO) ----
HAMMER = ('<rect x="44" y="30" width="12" height="66" rx="5" fill="#c68a4b" stroke="#5b3a1a" stroke-width="3"/><path d="M47 40V90M52 36V92" stroke="#a36d33" stroke-width="1.5"/>'
          '<rect x="10" y="6" width="80" height="36" rx="9" fill="#a8652a" stroke="#4a2a10" stroke-width="3"/><rect x="20" y="6" width="9" height="36" fill="#6e3f17"/><rect x="71" y="6" width="9" height="36" fill="#6e3f17"/>'
          '<path d="M34 14H66M34 22H66M34 30H66" stroke="#c98a4a" stroke-width="2" stroke-linecap="round"/>')
fx['hammer'] = f'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="-6 -2 112 106"><defs>{SHADOW}</defs><g filter="url(#sh)">{HAMMER}</g></svg>'
fx['boom'] = svg(burst(256, 256, 244, 130, 11, '#facc15', 8) + '<circle cx="256" cy="256" r="70" fill="#fff" stroke="#000" stroke-width="10"/>')

with sync_playwright() as p:
    b = p.chromium.launch()
    for name, s in fx.items():
        size = 256 if name == 'hammer' else 512
        pg = b.new_page(viewport={'width': size, 'height': size})
        pg.set_content(f'<html><body style="margin:0;background:transparent">{s}</body></html>')
        pg.screenshot(path=f'{OUT}/{name}.png', omit_background=True, clip={'x': 0, 'y': 0, 'width': size, 'height': size})
        pg.close()
    names = list(fx)
    cells = ''.join(f'<div style="text-align:center"><img src="file://{OUT}/{n}.png" width="190"><div style="color:#cbd5e1;font:14px sans-serif">{n}.png</div></div>' for n in names)
    open('/home/claude/fxsheet.html', 'w').write(f'<body style="background:#1e3a5f;margin:12px;display:flex;flex-wrap:wrap;gap:10px;width:1000px">{cells}</body>')
    pg = b.new_page(viewport={'width': 1030, 'height': 700}); pg.goto('file:///home/claude/fxsheet.html'); pg.wait_for_timeout(400)
    pg.screenshot(path='/mnt/user-data/outputs/preview-efek.png', full_page=True); b.close()
print(len(fx), 'efek:', ', '.join(fx))
