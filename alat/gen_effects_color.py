# Membuat efek +2, Skip, Reverse, +4 dalam 4 warna: img/effects/<efek>-<Warna>.png
# (draw2-Red.png, skip-Blue.png, reverse-Green.png, draw4-Yellow.png, dst). Warna efek = warna kartu yang dimainkan.
# Pakai: python3 gen_effects_color.py [folder_img_effects]   (bawaan: ../img/effects)
import math, os, sys
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img', 'effects')
FONT = "font-family=\"Inter, 'DejaVu Sans', sans-serif\" font-weight=\"900\""
SHADOW = '<filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="9" flood-color="#000" flood-opacity=".45"/></filter>'
# warna: (terang, utama, gelap) - selaras dengan palet kartu
PAL = {'Red': ('#fca5a5', '#ef4444', '#b91c1c'), 'Green': ('#86efac', '#22c55e', '#15803d'),
       'Blue': ('#93c5fd', '#3b82f6', '#1d4ed8'), 'Yellow': ('#fde68a', '#eab308', '#a16207')}

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

def big_text(s, size, y):
    return (f'<text x="256" y="{y}" font-size="{size}" fill="#fff" text-anchor="middle" {FONT} stroke="#000" '
            f'stroke-width="{max(10, size // 12)}" stroke-linejoin="round" paint-order="stroke">{s}</text>')

def badge(fill):
    return (f'<circle cx="256" cy="256" r="226" fill="#000" stroke="#000" stroke-width="20"/>'
            f'<circle cx="256" cy="256" r="226" fill="{fill}" stroke="#fff" stroke-width="14"/>')

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

def make(kind, color):
    lt, mid, dk = PAL[color]
    grad = f'<defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="{lt}"/><stop offset="1" stop-color="{mid}"/></radialGradient></defs>'
    if kind in ('draw2', 'draw4'):
        return svg(grad + burst(256, 256, 236, 186, 14, 'url(#g)', -8) + big_text('+2' if kind == 'draw2' else '+4', 210, 326))
    if kind == 'skip':
        return svg(badge(mid) +
            '<g fill="none" stroke-linecap="round"><circle cx="256" cy="256" r="104" stroke="#000" stroke-width="72"/><line x1="182" y1="330" x2="330" y2="182" stroke="#000" stroke-width="72"/>'
            '<circle cx="256" cy="256" r="104" stroke="#fff" stroke-width="48"/><line x1="182" y1="330" x2="330" y2="182" stroke="#fff" stroke-width="48"/></g>')
    return svg(badge(mid) + arc_arrow(200, 330) + arc_arrow(20, 150))   # reverse

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        for kind in ('draw2', 'draw4', 'skip', 'reverse'):
            for color in PAL:
                pg = b.new_page(viewport={'width': 512, 'height': 512})
                pg.set_content(f'<html><body style="margin:0;background:transparent">{make(kind, color)}</body></html>')
                pg.screenshot(path=os.path.join(OUT, f'{kind}-{color}.png'), omit_background=True, clip={'x': 0, 'y': 0, 'width': 512, 'height': 512})
                pg.close()
        b.close()
    print('16 gambar efek berwarna dibuat di', OUT)
