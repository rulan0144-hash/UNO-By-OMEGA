import os, math, numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
OUT='/mnt/user-data/outputs/img'
os.makedirs(f'{OUT}/ui',exist_ok=True); os.makedirs(f'{OUT}/table',exist_ok=True)
SH='<filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#000" flood-opacity=".5"/></filter>'

def frame(c1,c2,c3,edge):
    studs=''.join(f'<circle cx="{80+66*math.cos(math.radians(a)):.1f}" cy="{80+66*math.sin(math.radians(a)):.1f}" r="4.5" fill="{c1}" stroke="{edge}" stroke-width="2"/>' for a in range(0,360,45))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><defs>{SH}
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c1}"/><stop offset=".5" stop-color="{c2}"/><stop offset="1" stop-color="{c3}"/></linearGradient></defs>
<g filter="url(#sh)"><circle cx="80" cy="80" r="66" fill="none" stroke="{edge}" stroke-width="26"/>
<circle cx="80" cy="80" r="66" fill="none" stroke="url(#g)" stroke-width="20"/>
<circle cx="80" cy="80" r="74.5" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2.5"/>
<circle cx="80" cy="80" r="57.5" fill="none" stroke="{edge}" stroke-opacity=".7" stroke-width="2.5"/>{studs}</g></svg>'''

def arrow(t0,t1,r=196):
    p=lambda t:(256+r*math.cos(math.radians(t)),256+r*math.sin(math.radians(t)))
    (x0,y0),(x1,y1)=p(t0),p(t1)
    path=f'M{x0:.1f},{y0:.1f} A{r},{r} 0 0 1 {x1:.1f},{y1:.1f}'
    tx,ty=-math.sin(math.radians(t1)),math.cos(math.radians(t1)); nx,ny=math.cos(math.radians(t1)),math.sin(math.radians(t1))
    pts=' '.join(f'{a:.1f},{b:.1f}' for a,b in [(x1+tx*58,y1+ty*58),(x1-tx*6+nx*46,y1-ty*6+ny*46),(x1-tx*6-nx*46,y1-ty*6-ny*46)])
    return (f'<path d="{path}" fill="none" stroke="#000" stroke-width="46" stroke-linecap="round"/><path d="{path}" fill="none" stroke="#f59e0b" stroke-width="32" stroke-linecap="round"/>'
            f'<path d="{path}" fill="none" stroke="#fde68a" stroke-width="9" stroke-linecap="round" transform="translate(0 -6)" opacity=".8"/>'
            f'<polygon points="{pts}" fill="#f59e0b" stroke="#000" stroke-width="14" stroke-linejoin="round" paint-order="stroke"/>')
ring=f'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs>{SH}</defs><g filter="url(#sh)">{arrow(205,335)}{arrow(25,155)}</g></svg>'

items={'ui/frame-gold':(frame('#fff6bf','#facc15','#a16207','#4a3204'),160),'ui/frame-silver':(frame('#f1f5f9','#94a3b8','#475569','#1e293b'),160),'ui/direction':(ring,512)}
with sync_playwright() as p:
    b=p.chromium.launch()
    for n,(s,sz) in items.items():
        pg=b.new_page(viewport={'width':sz,'height':sz}); pg.set_content(f'<body style="margin:0;background:transparent">{s}</body>')
        pg.screenshot(path=f'{OUT}/{n}.png',omit_background=True,clip={'x':0,'y':0,'width':sz,'height':sz}); pg.close()
    b.close()
# tekstur kain meja (bisa diulang tanpa sambungan terlihat)
rng=np.random.default_rng(7); base=np.array([6,88,48],float)
n=rng.normal(0,5.5,(256,256,1)); fib=rng.normal(0,2.5,(256,256,1))
img=np.clip(base+n+fib*np.array([0.6,1.0,0.6]),0,255).astype('uint8')
Image.fromarray(img,'RGB').save(f'{OUT}/table/felt.png',optimize=True)
print('ok')
