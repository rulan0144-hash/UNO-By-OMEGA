# Logo UNO FLEX! untuk menu: img/ui/logo-flex.png. OVAL hijau (seperti logo UNO/Flip) tetap ada di belakang "UNO" kuning; TANPA papan di bawahnya.
# "FLEX!" putih dengan bayangan hijau tua
# dan sebuah garis miring "/" yang memotong huruf E (efek potong, bagian itu transparan).
# Pakai: python3 gen_flex_logo.py [folder_img_ui]
import os, sys
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img', 'ui')
W, H = 560, 300
DK = '#123a1f'     # hijau tua bayangan
FU = "font-family=\"Inter, 'DejaVu Sans', sans-serif\" font-weight=\"900\" font-style=\"italic\""
FF = "font-family=\"'DejaVu Sans Condensed', 'DejaVu Sans', sans-serif\" font-weight=\"900\" font-style=\"italic\""

def extruded(txt, x, y, size, fam, face, depth, outline=0, edge=None, dkw=7):
    """Teks bertebal: salinan bergeser ke kanan-bawah (bayangan) + garis luar putih + muka depan."""
    offs = [(i * depth / 12, i * depth / 12 * 1.15) for i in range(13)]
    t = lambda dx, dy, extra: f'<text x="{x+dx:.1f}" y="{y+dy:.1f}" font-size="{size}" text-anchor="middle" {fam} stroke-linejoin="round" {extra}>{txt}</text>'
    out = ''
    if outline:
        out += ''.join(t(dx, dy, f'fill="#fff" stroke="#fff" stroke-width="{outline}"') for dx, dy in offs)
    out += ''.join(t(dx, dy, f'fill="{DK}" stroke="{DK}" stroke-width="{dkw}"') for dx, dy in offs)
    out += t(0, 0, f'fill="{face}" ' + (f'stroke="{edge}" stroke-width="3"' if edge else ''))
    return out

def measure():
    """Ukur kotak huruf E pada 'FLEX!' (ukuran & posisi sama dengan yang digambar) supaya garis potong tepat di sudut-sudut E."""
    html = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}"><text id="m" x="280" y="268" font-size="110" text-anchor="middle" {FF}>FLEX!</text></svg>'
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width': W, 'height': H})
        pg.set_content(f'<body style="margin:0">{html}</body>')
        r = pg.evaluate('''() => { const m = document.getElementById('m'); const e = m.getExtentOfChar(2), bb = m.getBBox(); return [e.x, e.width, bb.y, bb.height]; }''')
        b.close()
    return r

ex, ew, ty, th = measure()
# garis potong diagonal: dari sudut KANAN-ATAS huruf E ke sudut KIRI-BAWAH huruf E (huruf miring: sisi atas bergeser ke kanan)
top_y, bot_y = 268 - 80, 268
x_tr, x_bl = ex + ew + 6, ex - 2
mask = (f'<mask id="cut" maskUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}"><rect width="{W}" height="{H}" fill="#fff"/>'
        f'<line x1="{x_tr:.1f}" y1="{top_y-2}" x2="{x_bl:.1f}" y2="{bot_y+3}" stroke="#000" stroke-width="8" stroke-linecap="butt"/></mask>')
# redupkan garis oval (cincin putih/hitam) yang lewat di balik tulisan FLEX!: topeng abu-abu mengikuti bentuk tulisan
dim = (f'<mask id="dim" maskUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}"><rect width="{W}" height="{H}" fill="#fff"/>'
       f'<g transform="rotate(-4 280 222)" filter="url(#bl)"><text x="285" y="272" font-size="110" text-anchor="middle" {FF} fill="#5a5a5a" stroke="#5a5a5a" stroke-width="40" stroke-linejoin="round">FLEX!</text></g></mask>')
oval = ('<radialGradient id="r" cx=".38" cy=".3" r=".9"><stop offset="0" stop-color="#86efac"/><stop offset=".6" stop-color="#22c55e"/><stop offset="1" stop-color="#166534"/></radialGradient>'
        '<g mask="url(#dim)"><g transform="rotate(-8 280 125)">'
        '<ellipse cx="280" cy="125" rx="248" ry="118" fill="#111"/><ellipse cx="280" cy="125" rx="238" ry="108" fill="#fff"/><ellipse cx="280" cy="125" rx="224" ry="95" fill="url(#r)"/>'
        f'<text x="292" y="171" font-size="150" fill="#000" text-anchor="middle" {FU} stroke="#000" stroke-width="30" stroke-linejoin="round">UNO</text>'
        f'<text x="280" y="159" font-size="150" fill="#ffee00" text-anchor="middle" {FU} stroke="#000" stroke-width="22" paint-order="stroke" stroke-linejoin="round">UNO</text></g></g>')
flex = f'<g transform="rotate(-4 280 222)"><g mask="url(#cut)">{extruded("FLEX!", 280, 268, 110, FF, "#ffffff", 10, 0, None, 13)}</g></g>'
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><defs><filter id="bl" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="7"/></filter>{mask}{dim}'
       f'<filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000" flood-opacity=".55"/></filter></defs>'
       f'<g filter="url(#sh)">{oval}{flex}</g></svg>')

if __name__ == '__main__':
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width': W, 'height': H})
        pg.set_content(f'<body style="margin:0;background:transparent">{svg}</body>')
        pg.screenshot(path=os.path.join(OUT, 'logo-flex.png'), omit_background=True, clip={'x': 0, 'y': 0, 'width': W, 'height': H})
        b.close()
    print('logo-flex.png dibuat')
