# Uji layar UNO All Wild di browser (offline vs Komputer). Jalankan server dulu:  python3 -m http.server 8765  (di folder proyek)
import asyncio, sys
sys.path.insert(0, '../uji_online_flex')
from playwright.async_api import async_playwright
from fake_modules import APP_JS, AUTH_JS, FS_JS
BASE = 'http://localhost:8765/index.html'
results = []
def check(c, m):
    results.append(bool(c)); print(('OK    ' if c else 'GAGAL ') + m, flush=True)

async def vis(page, id):
    return await page.evaluate("(id) => { const e = document.getElementById(id); return !!e && !e.classList.contains('hidden'); }", id)

async def main(bots, turns):
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True)
        await ctx.add_init_script("window.__uid='local-me'; localStorage.setItem('uno_name','Ana'); localStorage.setItem('uno_tab','offline'); localStorage.setItem('uno_bots_allwild','%d');" % bots)
        async def route(r):
            u = r.request.url
            if u.startswith('http://localhost'): return await r.continue_()
            if 'firebase-app.js' in u: return await r.fulfill(body=APP_JS, content_type='text/javascript')
            if 'firebase-auth.js' in u: return await r.fulfill(body=AUTH_JS, content_type='text/javascript')
            if 'firebase-firestore.js' in u: return await r.fulfill(body=FS_JS, content_type='text/javascript')
            if 'tailwind' in u: return await r.fulfill(body='var s=document.createElement("style");s.textContent=".hidden{display:none!important}";document.head.appendChild(s);', content_type='text/javascript')
            return await r.fulfill(body='', content_type='text/css')
        await ctx.route('**/*', route)
        page = await ctx.new_page(); errs = []
        page.on('pageerror', lambda e: errs.append(str(e)))
        page.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' and '404' not in m.text else None)
        await page.goto(BASE)
        await page.wait_for_function("() => document.getElementById('home-screen') && !document.getElementById('home-screen').classList.contains('hidden')", timeout=15000)
        await page.evaluate("async () => { window.__S = (await import('./js/core/state.js')).S; }")
        cards = await page.evaluate("() => document.querySelectorAll('.mode-card').length")
        check(cards >= 4, 'beranda menampilkan %d kartu mode' % cards)
        off = await page.evaluate("() => [...document.querySelectorAll('.mode-card')].some(c => c.getAttribute('aria-label') === 'UNO All Wild' && !c.classList.contains('mc-off'))")
        check(off, 'kartu UNO All Wild aktif (tidak redup)')
        await page.evaluate("() => playMode('allwild')"); await asyncio.sleep(0.3)
        await page.evaluate("() => { chooseRounds(1); startRounds(); }")
        await page.wait_for_function("() => window.__S.roomData && window.__S.roomData.status === 'playing'", timeout=20000)
        check(await vis(page, 'aw-screen'), 'layar All Wild tampil')
        await asyncio.sleep(9)   # hitung mundur + pembagian kartu
        await page.screenshot(path='/tmp/aw_start.png')
        st = await page.evaluate("() => { const g = window.__S.roomData.gameState; return { hand: g.hands['local-me'].length, players: window.__S.roomData.players.length, mode: window.__S.roomData.mode }; }")
        check(st['hand'] == 7 and st['players'] == bots + 1 and st['mode'] == 'allwild', 'bagi 7 kartu, %d pemain, mode allwild' % st['players'])
        shot = False
        for i in range(turns):
            await asyncio.sleep(0.8)
            over = await vis(page, 'w-over-modal')
            if over: break
            info = await page.evaluate("() => { const S = window.__S, g = S.roomData.gameState; return { mine: S.roomData.players[g.turnIndex].uid === 'local-me', fin: S.roomData.status === 'finished', n: g.hands['local-me'].length }; }")
            if info['fin']: break
            if not info['mine']: continue
            busy = await page.evaluate("async () => { const A = await import('./js/modes/allwild/animations.js'); return A.isBusy(); }")
            if busy: continue
            # mainkan kartu pertama (kadang ambil kartu dulu)
            if i % 9 == 4:
                await page.evaluate("() => awDraw('L')"); await asyncio.sleep(2.5)
                await page.evaluate("() => awPass()"); continue
            await page.evaluate("() => awPlay(0)")
            await asyncio.sleep(0.5)
            if await vis(page, 'w-target-modal'):
                if not shot: await page.screenshot(path='/tmp/aw_target.png')
                await page.evaluate("() => { const b = document.querySelector('#w-target-list button'); awPickTarget(b.dataset.u); }"); await asyncio.sleep(0.5)
            if await vis(page, 'w-color-modal'):
                if not shot: await page.screenshot(path='/tmp/aw_color.png'); shot = True
                await page.evaluate("() => awPickColor('Blue')")
        await page.screenshot(path='/tmp/aw_mid.png')
        # paksa menang untuk memeriksa layar akhir
        await page.evaluate("""async () => { const { S } = await import('./js/core/state.js'); const A = await import('./js/modes/allwild/actions.js');
          const s = JSON.parse(JSON.stringify(S.roomData.gameState)); s.fx = { id: 'z' + Math.random(), list: [] }; s.winner = 'local-me'; s.hands['local-me'] = [];
          A.updateRemoteState(s, { status: 'finished' }); }""")
        await page.wait_for_function("() => !document.getElementById('w-over-modal').classList.contains('hidden')", timeout=40000)
        check(True, 'layar akhir tampil')
        await page.screenshot(path='/tmp/aw_over.png')
        btns = await page.evaluate("() => [...document.querySelectorAll('#w-over-actions button')].map(b => b.innerText)")
        check(len(btns) == 2 and any('Beranda' in t for t in btns), 'layar akhir punya tombol Main Lagi/Lanjut Ronde + Kembali ke Beranda: %s' % btns)
        t = await page.evaluate("() => document.getElementById('w-winner-text').innerText")
        check('Menang' in t, 'teks pemenang: ' + t)
        check(not errs, 'tanpa galat JS: ' + '; '.join(errs[:5]))
        await b.close()
bots = int(sys.argv[1]) if len(sys.argv) > 1 else 3
asyncio.run(main(bots, int(sys.argv[2]) if len(sys.argv) > 2 else 30))
print('SEMUA LULUS' if all(results) else 'ADA YANG GAGAL')
