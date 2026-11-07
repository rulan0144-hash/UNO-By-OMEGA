# Membuat img/ui/sound-on.png dan sound-off.png: tombol bulat bingkai emas dengan ikon pengeras suara
import sys
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else 'img/ui'
DEFS = '''<defs>
<filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000" flood-opacity=".55"/></filter>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6bf"/><stop offset=".5" stop-color="#facc15"/><stop offset="1" stop-color="#a16207"/></linearGradient>
<radialGradient id="f" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="#2b3a4d"/><stop offset="1" stop-color="#0b1220"/></radialGradient>
<linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbe0"/><stop offset="1" stop-color="#f5b81c"/></linearGradient></defs>'''
BASE = '''<g filter="url(#sh)"><circle cx="80" cy="78" r="64" fill="#4a3204"/><circle cx="80" cy="78" r="60" fill="url(#g)"/><circle cx="80" cy="78" r="48" fill="url(#f)" stroke="#4a3204" stroke-width="3"/>
<path d="M50 68h14l18-15v50L64 88H50z" fill="#4a3204" transform="translate(2,2)"/><path d="M50 68h14l18-15v50L64 88H50z" fill="url(#b)"/>'''
ON = '<path d="M92 66q10 12 0 24M100 58q17 20 0 40" fill="none" stroke="url(#b)" stroke-width="7" stroke-linecap="round"/>'
OFF = '<path d="M95 66l22 24M117 66L95 90" fill="none" stroke="#ef4444" stroke-width="8" stroke-linecap="round"/>'
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 160, 'height': 160})
    for name, extra in (('sound-on', ON), ('sound-off', OFF)):
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">{DEFS}{BASE}{extra}</g></svg>'
        pg.set_content(f'<body style="margin:0;background:transparent">{svg}</body>')
        pg.screenshot(path=f'{OUT}/{name}.png', omit_background=True, clip={'x': 0, 'y': 0, 'width': 160, 'height': 160})
    b.close()
