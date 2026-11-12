# Efek "Acak Kartu" (Wild Shuffle Hands) -> img/effects/shuffle.png
# Gambar efek = kartu Acak yang SAMA dengan kartunya (diambil dari gen_cards.py: wild_card('WildShuffleHands')), sedikit miring.
# Pakai: python3 gen_shuffle_fx.py [berkas_tujuan]   (bawaan: ../img/effects/shuffle.png)
import os, sys, math, re
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'img', 'effects', 'shuffle.png')
from playwright.sync_api import sync_playwright
_src = open(os.path.join(HERE, 'gen_cards.py'), encoding='utf-8').read()
_seg = _src[_src.index('# ---------- simbol color blind'):_src.index('# ---------- susun semua kartu')]
_ns = {'math': math, 'COL': {'Red': '#ef4444', 'Green': '#22c55e', 'Blue': '#3b82f6', 'Yellow': '#eab308'},
       'FONT': "font-family=\"Inter, 'DejaVu Sans', sans-serif\" font-weight=\"900\"", 'CX': 120, 'CY': 174, 'TILT': 25}
exec(_seg, _ns)
card = _ns['wild_card']('WildShuffleHands')
inner = re.sub(r'^<svg[^>]*>', '', card.strip()); inner = re.sub(r'</svg>\s*$', '', inner)
k = 1.25
svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs>'
       '<filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="9" flood-color="#000" flood-opacity=".45"/></filter></defs>'
       f'<g filter="url(#sh)"><g transform="translate(256 256) rotate(-7) scale({k}) translate(-120 -174)">{inner}</g></g></svg>')
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 512, 'height': 512})
    pg.set_content(f'<html><body style="margin:0;background:transparent">{svg}</body></html>')
    pg.screenshot(path=OUT, omit_background=True, clip={'x': 0, 'y': 0, 'width': 512, 'height': 512})
    b.close()
print('ok', os.path.abspath(OUT))
