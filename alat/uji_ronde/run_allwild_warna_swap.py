# Uji All Wild: (1) pilihan ganti warna Otomatis/Manual, (2) tidak ada efek ganti Wild di tengah layar, (3) animasi Forced Swap antar dua pemain.
# Jalankan server dulu:  python3 -m http.server 8765  (di folder proyek), lalu:  cd alat/uji_ronde && python3 run_allwild_warna_swap.py
import asyncio, sys, os
sys.path.insert(0, '../uji_online_flex')
from playwright.async_api import async_playwright
from fake_modules import APP_JS, AUTH_JS, FS_JS
BASE = 'http://localhost:8765/index.html'
OUT = os.environ.get('SHOT_DIR', '/tmp')
results = []
def check(c, m):
    results.append(bool(c)); print(('OK    ' if c else 'GAGAL ') + m, flush=True)

SETUP = """async ({ meHand, hands, turn }) => {
  const { S } = await import('./js/core/state.js');
  const A = await import('./js/modes/allwild/actions.js');
  const mk = (v, i) => ({ id: 900 + i, c: 'Black', v, img: { 'Wild': 'Black-Wild', 'Forced Swap': 'Black-WildForcedSwap', 'Skip': 'Black-WildSkip', 'Draw Two': 'Black-WildDrawTwo' }[v] });
  const s = JSON.parse(JSON.stringify(S.roomData.gameState));
  s.fx = { id: 'setup' + Math.random(), list: [] };
  let n = 0;
  s.hands['local-me'] = meHand.map(v => mk(v, n++));
  Object.keys(hands).forEach(u => { s.hands[u] = hands[u].map(v => mk(v, n++)); });
  s.turnIndex = turn; s.currentColor = 'Red'; s.forgot = {}; s.unoCalled = {};
  S.paused = true;                                   // bot tidak bertindak sendiri
  S.roomData = { ...S.roomData, gameState: s };
  (await import('./js/modes/allwild/ui.js')).renderGame();
}"""

async def vis(page, id):
    return await page.evaluate("(id) => { const e = document.getElementById(id); return !!e && !e.classList.contains('hidden'); }", id)

async def count(page, sel):
    return await page.evaluate("(s) => document.querySelectorAll(s).length", sel)

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True)
        await ctx.add_init_script("window.__uid='local-me'; localStorage.setItem('uno_name','Ana'); localStorage.setItem('uno_tab','offline'); localStorage.setItem('uno_bots_allwild','3');")
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

        # ---- Pengaturan: bawaan Otomatis, tombol menyorot pilihan, tersimpan di localStorage
        await page.evaluate("() => openSettings()")  # beranda tanpa panel
        on = await page.evaluate("() => [...document.querySelectorAll('#settings-modal .aw-cm-btn.on')].map(b => b.dataset.m)")
        check(on == [], 'beranda tidak punya panel warna')
        await page.evaluate("() => awSetColorMode('manual')")
        on = await page.evaluate("() => [...document.querySelectorAll('#w-pause-modal .aw-cm-btn.on')].map(b => b.dataset.m)")
        saved = await page.evaluate("() => localStorage.getItem('uno_aw_color_mode')")
        check(on == ['manual'] and saved == 'manual', 'pilih Manual: tombol menyorot + tersimpan (%s)' % saved)
        await page.evaluate("() => { awSetColorMode('auto'); closeSettings(); }")

        await page.evaluate("() => playMode('allwild')"); await asyncio.sleep(0.3)
        await page.evaluate("() => { chooseRounds(1); startRounds(); }")
        await page.wait_for_function("() => window.__S.roomData && window.__S.roomData.status === 'playing'", timeout=20000)
        await asyncio.sleep(9)   # hitung mundur + pembagian kartu

        # ---- Menu dalam game punya pilihan yang sama
        await page.evaluate("() => awOpenMenu()")
        check(await count(page, '#w-pause-modal .aw-cm-btn') == 2 and await vis(page, 'w-pause-modal'), 'menu dalam game memuat pilihan Otomatis/Manual')
        await page.screenshot(path=OUT + '/aw_menu.png')
        await page.evaluate("() => awResume()")

        # ---- OTOMATIS: kartu Wild biasa -> tanpa kotak pilih warna, tanpa efek di tengah, meja berganti warna
        await page.evaluate(SETUP, {'meHand': ['Wild', 'Wild', 'Skip'], 'hands': {'bot1': ['Wild'] * 5, 'bot2': ['Wild'] * 4, 'bot3': ['Wild'] * 6}, 'turn': 0})
        await asyncio.sleep(0.3)
        await page.evaluate("() => { awPlay(0); }")
        await asyncio.sleep(0.25)
        check(not await vis(page, 'w-color-modal'), 'Otomatis: kotak "Pilih Warna" TIDAK muncul')
        seen_picker = False
        for _ in range(14):
            await asyncio.sleep(0.15)
            if await count(page, '.fx-picker, .fx-img-banner, .fx-flash.on'): seen_picker = True
        check(not seen_picker, 'Otomatis: tidak ada efek ganti Wild di tengah (picker/banner/kilat)')
        col = await page.evaluate("() => ({ st: window.__S.roomData.gameState.currentColor, cls: document.getElementById('aw-screen').className, badge: document.getElementById('w-badge').innerText })")
        check(col['st'] != 'Red' and ('aw-c-' + col['st']) in col['cls'], 'Otomatis: warna berganti ke %s (beda dari Merah), meja ikut berganti' % col['st'])
        await asyncio.sleep(1.5)

        # ---- MANUAL: kotak pilih warna muncul, warna sesuai pilihan
        await page.evaluate("() => awSetColorMode('manual')")
        await page.evaluate(SETUP, {'meHand': ['Wild', 'Wild', 'Skip'], 'hands': {'bot1': ['Wild'] * 5, 'bot2': ['Wild'] * 4, 'bot3': ['Wild'] * 6}, 'turn': 0})
        await asyncio.sleep(0.3)
        await page.evaluate("() => { awPlay(0); }")
        await asyncio.sleep(0.4)
        check(await vis(page, 'w-color-modal'), 'Manual: kotak "Pilih Warna" muncul')
        await page.screenshot(path=OUT + '/aw_manual_picker.png')
        await page.evaluate("() => awPickColor('Green')")
        seen_picker = False
        for _ in range(14):
            await asyncio.sleep(0.15)
            if await count(page, '.fx-picker, .fx-flash.on'): seen_picker = True
        col = await page.evaluate("() => window.__S.roomData.gameState.currentColor")
        check(col == 'Green', 'Manual: warna meja = Hijau (pilihan pemain)')
        check(not seen_picker, 'Manual: setelah memilih, tidak ada efek putar/kilat Wild di tengah')
        await asyncio.sleep(1.5)

        # ---- Kartu aksi tetap menampilkan banner efeknya (Skip) - hanya efek ganti Wild yang dihapus
        await page.evaluate("() => awSetColorMode('auto')")
        await page.evaluate(SETUP, {'meHand': ['Skip', 'Wild', 'Wild'], 'hands': {'bot1': ['Wild'] * 5, 'bot2': ['Wild'] * 4, 'bot3': ['Wild'] * 6}, 'turn': 0})
        await asyncio.sleep(0.3)
        await page.evaluate("() => { awPlay(0); }")
        got_banner = False
        for _ in range(12):
            await asyncio.sleep(0.15)
            if await count(page, '.fx-img-banner'): got_banner = True
        check(got_banner, 'kartu Skip tetap menampilkan banner Skip (hanya efek Wild yang dihapus)')
        await asyncio.sleep(2)

        # ---- FORCED SWAP: saya (3 kartu) menukar dengan bot1 (6 kartu)
        await page.evaluate(SETUP, {'meHand': ['Forced Swap', 'Wild', 'Wild'], 'hands': {'bot1': ['Wild'] * 6, 'bot2': ['Wild'] * 4, 'bot3': ['Wild'] * 5}, 'turn': 0})
        await asyncio.sleep(0.3)
        await page.evaluate("() => { awPlay(0); }")
        await asyncio.sleep(0.4)
        check(await vis(page, 'w-target-modal'), 'Forced Swap: kotak pilih pemain muncul')
        await page.evaluate("() => awPickTarget('bot1')")
        await asyncio.sleep(1.0)
        check(not await vis(page, 'w-color-modal'), 'Forced Swap (Otomatis): tidak ada kotak warna')
        series = []; max_fly = 0; badge = False; cnt_mid = None; hand_mid = None; glow = False
        shot = False
        for _ in range(30):
            await asyncio.sleep(0.1)
            f = await count(page, '.fly-card'); max_fly = max(max_fly, f)
            series.append(await page.evaluate("() => [...document.getElementById('w-hand').children].filter(k => k.style.visibility !== 'hidden').length"))
            if await count(page, '.aw-swap-badge'):
                badge = True
                if cnt_mid is None:
                    cnt_mid = await page.evaluate("() => document.querySelector('#wstack-bot1 .count-badge').innerText")
                    hand_mid = await page.evaluate("() => document.getElementById('w-hand').children.length")
                    glow = await count(page, '.aw-swap-glow') >= 2
                if not shot and f >= 3:
                    await page.screenshot(path=OUT + '/aw_swap_me.png'); shot = True
        check(max_fly >= 4, 'kartu terbang bolak-balik saat tukar (maks %d kartu terbang bersamaan)' % max_fly)
        check(badge, 'ikon tukar tampil di antara dua pemain')
        check(cnt_mid == '6', 'selama animasi: bot1 masih tampil 6 kartu (%s)' % cnt_mid)
        mn = series.index(min(series)); 
        check(min(series) == 0, 'kartu tanganku HILANG saat terbang (terlihat: %s)' % series[:12])
        check(any(0 < v < 6 for v in series[mn:]) and series[-1] == 6, 'kartu baru MUNCUL bertahap saat mendarat, akhirnya 6 (%s)' % series)
        check(glow, 'kedua pemain menyala selama tukar')
        await asyncio.sleep(2.5)
        end = await page.evaluate("() => ({ bot1: document.querySelector('#wstack-bot1 .count-badge').innerText, hand: document.getElementById('w-hand').children.length, fly: document.querySelectorAll('.fly-card, .aw-swap-badge').length, glow: document.querySelectorAll('.aw-swap-glow').length, vis: [...document.getElementById('w-hand').children].every(k => k.style.visibility !== 'hidden') })")
        check(end['bot1'] == '2' and end['hand'] == 6, 'setelah animasi: bot1 2 kartu, tanganku 6 kartu (tukar jadi)')
        check(end['fly'] == 0 and end['glow'] == 0 and end['vis'], 'sisa elemen animasi bersih, semua kartu tangan terlihat')

        # ---- FORCED SWAP antara dua bot (bot1 <-> bot3), saya hanya menonton
        await page.evaluate(SETUP, {'meHand': ['Wild'] * 4, 'hands': {'bot1': ['Forced Swap', 'Wild', 'Wild'], 'bot2': ['Wild'] * 4, 'bot3': ['Wild'] * 5}, 'turn': 1})
        await asyncio.sleep(0.3)
        await page.evaluate("""async () => { const { S, cloneState } = await import('./js/core/state.js'); const R = await import('./js/modes/allwild/rules.js'); const A = await import('./js/modes/allwild/actions.js');
          const s = cloneState(); R.playCardOn(s, 'bot1', 0, { color: 'Blue', target: 'bot3', callUno: false }); await A.updateRemoteState(s); }""")
        await asyncio.sleep(1.5)
        shot = False; seen = 0
        for _ in range(30):
            await asyncio.sleep(0.1)
            f = await count(page, '.fly-card'); seen = max(seen, f)
            if not shot and await count(page, '.aw-swap-badge') and f >= 3:
                await page.screenshot(path=OUT + '/aw_swap_bots.png'); shot = True
        check(seen >= 4, 'antar dua bot: kartu terbang saling bertukar (maks %d)' % seen)
        await asyncio.sleep(2.5)
        end = await page.evaluate("() => ({ b1: document.querySelector('#wstack-bot1 .count-badge').innerText, b3: document.querySelector('#wstack-bot3 .count-badge').innerText, left: document.querySelectorAll('.fly-card, .aw-swap-badge').length })")
        check(end['b1'] == '5' and end['b3'] == '2' and end['left'] == 0, 'antar dua bot: bot1=5, bot3=2 setelah tukar (%s,%s)' % (end['b1'], end['b3']))

        # ---- Forced Swap sebagai kartu terakhir saya: lawan menerima tangan kosong dan menang
        await page.evaluate(SETUP, {'meHand': ['Forced Swap'], 'hands': {'bot1': ['Wild'] * 3, 'bot2': ['Wild'] * 4, 'bot3': ['Wild'] * 5}, 'turn': 0})
        await asyncio.sleep(0.3)
        await page.evaluate("() => { awPlay(0); }")
        await asyncio.sleep(0.4)
        await page.evaluate("() => awPickTarget('bot2')")
        await page.wait_for_function("() => !document.getElementById('w-over-modal').classList.contains('hidden')", timeout=40000)
        t = await page.evaluate("() => document.getElementById('w-winner-text').innerText")
        check('Komputer 2' in t, 'kartu terakhir Forced Swap: pemenang tetap benar setelah animasi (%s)' % t)

        check(not errs, 'tanpa galat JS: ' + '; '.join(errs[:5]))
        await b.close()
asyncio.run(main())
print('SEMUA LULUS' if all(results) else 'ADA YANG GAGAL')
