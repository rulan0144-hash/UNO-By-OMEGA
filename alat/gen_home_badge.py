# Lencana jumlah pemain + umur untuk poster beranda: img/ui/badge-players.png (gelap, Klasik) dan badge-players-flip.png (emas, Flip).
# Isi: ikon orang banyak + "2-10" | ikon satu orang + "7+".   Pakai: python3 gen_home_badge.py [folder_img_ui]
import os, sys
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img', 'ui')
W, H = 238, 64
F = "font-family=\"'DejaVu Sans', Arial, sans-serif\" font-weight=\"800\""

def person(x, y, s, col):   # kepala + bahu, titik (x, y) = pusat kepala
    return (f'<circle cx="{x}" cy="{y}" r="{7*s}" fill="{col}"/>'
            f'<path d="M{x-12*s} {y+24*s} Q{x-12*s} {y+11*s} {x} {y+11*s} Q{x+12*s} {y+11*s} {x+12*s} {y+24*s} Z" fill="{col}"/>')

def badge(bg1, bg2, edge, fg):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><defs>
<linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{bg1}"/><stop offset="1" stop-color="{bg2}"/></linearGradient></defs>
<rect x="3" y="3" width="{W-6}" height="{H-6}" rx="{(H-6)/2}" fill="url(#b)" stroke="{edge}" stroke-width="3"/>
{person(30, 22, .85, fg)}{person(50, 20, 1.0, fg)}{person(70, 22, .85, fg)}
<text x="124" y="41" font-size="25" fill="{fg}" text-anchor="middle" {F}>2-10</text>
<rect x="160" y="14" width="2.5" height="36" rx="1" fill="{fg}" opacity=".45"/>
{person(180, 21, .8, fg)}
<text x="194" y="41" font-size="20" fill="{fg}" text-anchor="start" {F}>7+</text></svg>'''

jobs = [('badge-players.png', badge('#2b2b2b', '#0d0d0d', '#ffffff', '#ffffff')),
        ('badge-players-flip.png', badge('#ffe98a', '#f2b81c', '#3b1d00', '#2a1600'))]
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, svg in jobs:
        pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2)
        pg.set_content(f'<html><body style="margin:0;background:transparent">{svg}</body></html>')
        pg.screenshot(path=os.path.join(OUT, name), omit_background=True, clip={'x': 0, 'y': 0, 'width': W, 'height': H})
        pg.close()
    b.close()
print('badge dibuat')
