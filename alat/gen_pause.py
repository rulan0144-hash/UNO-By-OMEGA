# Membuat img/ui/pause.png: tombol bulat bingkai emas dengan ikon jeda (dua batang)
import sys
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else 'img/ui/pause.png'
svg = '''<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><defs>
<filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000" flood-opacity=".55"/></filter>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6bf"/><stop offset=".5" stop-color="#facc15"/><stop offset="1" stop-color="#a16207"/></linearGradient>
<radialGradient id="f" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="#2b3a4d"/><stop offset="1" stop-color="#0b1220"/></radialGradient>
<linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbe0"/><stop offset="1" stop-color="#f5b81c"/></linearGradient></defs>
<g filter="url(#sh)"><circle cx="80" cy="78" r="64" fill="#4a3204"/><circle cx="80" cy="78" r="60" fill="url(#g)"/><circle cx="80" cy="78" r="48" fill="url(#f)" stroke="#4a3204" stroke-width="3"/>
<rect x="55" y="56" width="19" height="44" rx="6" fill="#4a3204"/><rect x="86" y="56" width="19" height="44" rx="6" fill="#4a3204"/>
<rect x="57" y="54" width="15" height="40" rx="5" fill="url(#b)"/><rect x="88" y="54" width="15" height="40" rx="5" fill="url(#b)"/></g></svg>'''
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 160, 'height': 160})
    pg.set_content(f'<body style="margin:0;background:transparent">{svg}</body>')
    pg.screenshot(path=OUT, omit_background=True, clip={'x': 0, 'y': 0, 'width': 160, 'height': 160})
    b.close()
