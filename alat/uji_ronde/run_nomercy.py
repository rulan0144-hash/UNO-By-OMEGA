# Uji layar UNO Show 'Em No Mercy di browser (offline vs Komputer). Jalankan server dulu:  python3 -m http.server 8765  (di folder proyek)
# Pakai:  python3 run_nomercy.py [jumlah_bot] [jumlah_langkah]
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
        await ctx.add_init_script("window.__uid='local-me'; localStorage.setItem('uno_name','Ana'); localStorage.setItem('uno_tab','offline'); localStorage.setItem('uno_bots_nomercy','%d');" % bots)
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
        on = await page.evaluate("() => [...document.querySelectorAll('.mode-card')].some(c => (c.getAttribute('aria-label') || '').includes('No Mercy') && !c.classList.contains('mc-off'))")
        check(on, "kartu No Mercy aktif (tidak redup)")
        await page.evaluate("() => playMode('nomercy')"); await asyncio.sleep(0.3)
        await page.evaluate("() => { chooseRounds(1); startRounds(); }")
        await page.wait_for_function("() => window.__S.roomData && window.__S.roomData.status === 'playing'", timeout=30000)
        check(await vis(page, 'nm-screen'), 'layar No Mercy tampil')
        await asyncio.sleep(9)   # hitung mundur + pembagian kartu
        await page.screenshot(path='/tmp/nm_start.png')
        st = await page.evaluate("() => { const g = window.__S.roomData.gameState; return { hand: g.hands['local-me'].length, players: window.__S.roomData.players.length, mode: window.__S.roomData.mode, total: Object.values(g.hands).reduce((a, h) => a + h.length, 0) + g.deck.length + g.deckR.length + g.discardPile.length, two: g.deck.length > 0 && g.deckR.length > 0 }; }")
        check(st['hand'] == 7 and st['players'] == bots + 1 and st['mode'] == 'nomercy', 'bagi 7 kartu, %d pemain, mode nomercy' % st['players'])
        check(st['total'] == 168, 'total kartu 168 (%d)' % st['total'])
        check(st['two'], 'DUA tumpukan ambil terisi')
        check(await page.evaluate("() => !!document.getElementById('n-draw-l') && !!document.getElementById('n-draw-r') && !document.getElementById('n-stack')"), 'dua deck di meja, tanpa widget stack samping')
        seen = set(); shots = set()
        await page.evaluate("async () => { window.__A = await import('./js/modes/nomercy/animations.js'); window.__R = await import('./js/modes/nomercy/rules.js'); }")
        for i in range(turns):
            try:   # tunggu sampai animasi selesai dan giliranku (atau permainan selesai / aku tersingkir)
                await page.wait_for_function("() => { const S = window.__S, g = S.roomData && S.roomData.gameState; if (!g) return true; return S.roomData.status === 'finished' || !!(g.out && g.out['local-me']) || (!window.__A.isBusy() && window.__R.actorUid(g) === 'local-me'); }", timeout=40000, polling=250)
            except Exception:
                print('timeout menunggu giliran'); break
            if await vis(page, 'n-over-modal'): break
            info = await page.evaluate("""async () => { const S = window.__S, g = S.roomData.gameState, R = await import('./js/modes/nomercy/rules.js'), A = await import('./js/modes/nomercy/animations.js');
              const me = 'local-me'; return { fin: S.roomData.status === 'finished', busy: A.isBusy(), act: R.actorUid(g), out: !!(g.out && g.out[me]), pend: g.pending ? g.pending.kind : null,
                forced: !!(g.forced && g.forced.uid === me), legal: R.legalPlays(g, me), n: g.hands[me].length }; }""")
            if i % 5 == 0: print('langkah', i, {k: info[k] for k in ('act', 'busy', 'pend', 'n', 'out', 'fin')}, flush=True)
            if info['fin'] or info['out']: break
            if info['busy'] or info['act'] != 'local-me': continue
            await asyncio.sleep(0.3)
            if info['pend'] == 'roulette':
                await asyncio.sleep(1.2)
                if await vis(page, 'n-color-modal'):
                    if 'roul' not in shots: await page.screenshot(path='/tmp/nm_roulette.png'); shots.add('roul')
                    await page.evaluate("() => nmPickColor('Green')"); seen.add('roulette')
                else:   # warna sudah dipilih: korban MENGETUK tumpukan satu per satu sampai dapat warnanya
                    await page.evaluate("() => nmDraw(Math.random() < 0.5 ? 'L' : 'R')"); seen.add('roulette-tap')
                continue
            if info['legal']:
                await page.evaluate("(i) => nmPlay(i)", info['legal'][0]); await asyncio.sleep(0.5)
                if await vis(page, 'n-target-modal'):
                    if 'tgt' not in shots: await page.screenshot(path='/tmp/nm_target.png'); shots.add('tgt')
                    await page.evaluate("() => { const b = document.querySelector('#n-target-list button'); nmPickTarget(b.dataset.u); }"); seen.add('swap7'); await asyncio.sleep(0.4)
                if await vis(page, 'n-color-modal'):
                    if 'col' not in shots: await page.screenshot(path='/tmp/nm_color.png'); shots.add('col')
                    await page.evaluate("() => nmPickColor('Blue')"); seen.add('wild')
            elif info['pend'] == 'draw':
                await page.evaluate("() => nmTakePenalty()"); seen.add('penalty')
            else:
                await page.evaluate("() => nmDraw(Math.random() < 0.5 ? 'L' : 'R')"); seen.add('draw'); await asyncio.sleep(2.5)
            if 'mid' not in shots and i > 10: await page.screenshot(path='/tmp/nm_mid.png'); shots.add('mid')
        print('terlihat:', sorted(seen))
        # kartu tidak cocok tidak boleh ambil bila ada kartu cocok (kebijakan resmi) dan sebaliknya: dicek lewat mesin di simulasi
        # paksa Mercy: bot 1 mendapat 24 kartu lalu 1 hukuman -> tersingkir
        ok = await page.evaluate("""async () => { const S = window.__S; if (S.roomData.status !== 'playing') return 'skip';
          const R = await import('./js/modes/nomercy/rules.js'), A = await import('./js/modes/nomercy/actions.js'), st = await import('./js/core/state.js');
          const s = st.cloneState(); const u = 'bot1'; if (s.out[u]) return 'skip';
          while (s.hands[u].length < 24) s.hands[u].push((s.deck.length ? s.deck.pop() : s.deckR.pop()));
          R.giveCards(s, u, 2); R.checkMercy(s); await A.updateRemoteState(s); return s.out[u] ? 'out' : 'fail'; }""")
        if ok != 'skip': check(ok == 'out', 'Mercy: bot 1 tersingkir saat 25 kartu')
        await asyncio.sleep(4); await page.screenshot(path='/tmp/nm_mercy.png')
        # paksa menang untuk memeriksa layar akhir
        await page.evaluate("""async () => { const { S } = await import('./js/core/state.js'); const A = await import('./js/modes/nomercy/actions.js');
          const s = JSON.parse(JSON.stringify(S.roomData.gameState)); s.fx = { id: 'z' + Math.random(), list: [] }; s.winner = 'local-me'; s.hands['local-me'] = [];
          A.updateRemoteState(s, { status: 'finished' }); }""")
        await page.wait_for_function("() => !document.getElementById('n-over-modal').classList.contains('hidden')", timeout=40000)
        check(True, 'layar akhir tampil')
        await page.screenshot(path='/tmp/nm_over.png')
        btns = await page.evaluate("() => [...document.querySelectorAll('#n-over-actions button')].map(b => b.innerText)")
        check(len(btns) == 2 and any('Beranda' in t for t in btns), 'layar akhir punya tombol Main Lagi + Kembali ke Beranda: %s' % btns)
        t = await page.evaluate("() => document.getElementById('n-winner-text').innerText")
        check('Menang' in t, 'teks pemenang: ' + t)
        await page.evaluate("() => goHome()"); await asyncio.sleep(0.5)
        check(await vis(page, 'home-screen'), 'tombol Kembali ke Beranda berfungsi')
        check(not errs, 'tanpa galat JS: ' + '; '.join(errs[:5]))
        await b.close()
    print('LULUS' if all(results) else 'ADA YANG GAGAL', sum(results), '/', len(results))

asyncio.run(main(int(sys.argv[1]) if len(sys.argv) > 1 else 3, int(sys.argv[2]) if len(sys.argv) > 2 else 60))
