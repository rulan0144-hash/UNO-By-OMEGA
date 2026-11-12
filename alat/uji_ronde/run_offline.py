# Uji ronde + jeda otomatis (offline) untuk 3 mode. Jalankan server dulu:  python3 -m http.server 8765  (di folder proyek)
import asyncio, json, sys
sys.path.insert(0, '../uji_online_flex')
from playwright.async_api import async_playwright
BASE = 'http://localhost:8765/index.html'
results = []
def check(c, m):
    results.append(bool(c)); print(('OK    ' if c else 'GAGAL ') + m, flush=True)

FINISH = """
async (mode) => {
  const { S } = await import('./js/core/state.js');
  const A = await import('./js/modes/' + mode + '/actions.js');
  const s = JSON.parse(JSON.stringify(S.roomData.gameState));
  s.fx = { id: 'x' + Math.random(), list: [] };
  s.winner = 'local-me'; s.hands['local-me'] = [];
  if (mode !== 'classic') { s.roundPts = 40; s.roundDetail = S.roomData.players.filter(p => p.uid !== 'local-me').map(p => ({ uid: p.uid, n: (s.hands[p.uid]||[]).length, pts: 10 })); }
  A.updateRemoteState(s, { status: 'finished' });
}
"""
OV = {'classic': ('game-over-modal', 'over-actions', 'over-series'), 'flip': ('f-over-modal', 'f-over-actions', 'f-over-series'), 'flex': ('x-over-modal', 'x-over-actions', 'x-over-series')}
SCR = {'classic': 'game-screen', 'flip': 'flip-screen', 'flex': 'flex-screen'}
OPEN = {'classic': 'openMenu', 'flip': 'flipOpenMenu', 'flex': 'flexOpenMenu'}
RES = {'classic': 'resumeGame', 'flip': 'flipResume', 'flex': 'flexResume'}
NOTE = {'classic': 'pause-note', 'flip': 'f-pause-note', 'flex': 'x-pause-note'}

async def vis(page, id):
    return await page.evaluate("(id) => { const e = document.getElementById(id); return !!e && !e.classList.contains('hidden'); }", id)

async def wait_over(page, mode):
    await page.wait_for_function("(id) => { const e = document.getElementById(id); return e && !e.classList.contains('hidden'); }", arg=OV[mode][0], timeout=40000)

async def wait_playing(page, mode):
    await page.wait_for_function("(id) => { const e = document.getElementById(id); return e && !e.classList.contains('hidden'); }", arg=SCR[mode], timeout=20000)
    await page.wait_for_function("() => window.__S.roomData && window.__S.roomData.status === 'playing'", timeout=20000)

async def run_mode(browser, mode):
    print('==== MODE', mode, flush=True)
    ctx = await browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True)
    await ctx.add_init_script("window.__uid='local-me'; localStorage.setItem('uno_name','Ana'); localStorage.setItem('uno_tab','offline');")
    from fake_modules import APP_JS, AUTH_JS, FS_JS
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

    # 1. tekan Main -> pop-up ronde
    await page.evaluate("(m) => playMode(m)", mode)
    check(await vis(page, 'round-modal'), 'pop-up pilih ronde muncul setelah menekan Main')
    chips = await page.evaluate("() => [...document.querySelectorAll('#round-grid .round-chip b')].map(b => b.textContent).join(',')")
    check(chips == '1,3,5,7,10', 'pilihan ronde: ' + chips)
    check(await page.evaluate("() => window.__S.roomData == null || window.__S.roomData.status !== 'playing'"), 'permainan belum mulai sebelum memilih ronde')
    await page.evaluate("() => chooseRounds(3)")
    await asyncio.sleep(1.5)
    on = await page.evaluate("() => [...document.querySelectorAll('#round-grid .round-chip.on')].map(b => b.dataset.n).join(',')")
    check(on == '3' and await vis(page, 'round-modal'), 'ketuk 3: sorotan pindah, pop-up TETAP tampil (belum mulai): ' + on)
    check(await page.evaluate("() => !window.__S.roomData || window.__S.roomData.status !== 'playing'"), 'game belum mulai sebelum menekan Mulai Main')
    await page.evaluate("() => startRounds()")
    check(not await vis(page, 'round-modal'), 'pop-up tertutup setelah memilih')
    await wait_playing(page, mode)
    s = await page.evaluate("() => JSON.stringify(window.__S.series)")
    check(json.loads(s) == {'total': 3, 'round': 1, 'history': []}, 'seri tersimpan: ' + s)
    lab = await page.evaluate("() => { const e = document.querySelector('.f-countdown .cd-label'); return e ? e.textContent : '' }")
    check('Ronde 1 dari 3' in lab, 'hitung mundur menampilkan: ' + lab.replace('\n', ' '))

    # 2. buka pengaturan = langsung pause
    await asyncio.sleep(0.5)
    await page.evaluate("(f) => window[f]()", OPEN[mode])
    check(await page.evaluate("() => window.__S.paused === true"), 'membuka pengaturan langsung menjeda permainan')
    note = await page.inner_text('#' + NOTE[mode])
    check('Ronde 1 dari 3' in note and 'dijeda' in note, 'catatan menu: ' + note)
    tg = await page.evaluate("() => !!document.getElementById('pause-toggle') || !!document.getElementById('f-pause-toggle') || !!document.getElementById('x-pause-toggle')")
    check(not tg, 'tombol Jeda manual sudah tidak ada')
    await asyncio.sleep(2.5)
    check(await page.evaluate("() => window.__S.paused === true"), 'tetap terjeda selama menu terbuka')
    await page.evaluate("(f) => window[f]()", RES[mode])
    check(await page.evaluate("() => window.__S.paused === false"), 'Lanjutkan melanjutkan permainan')

    # 3. selesai ronde 1 -> Lanjut ke Ronde 2
    await asyncio.sleep(6)
    await page.evaluate(FINISH, mode)
    await wait_over(page, mode)
    acts = await page.inner_text('#' + OV[mode][1])
    check('Lanjut ke Ronde 2' in acts and 'Beranda' in acts and 'Main Lagi' not in acts, 'akhir ronde 1: tombol = ' + acts.replace('\n', ' | '))
    ser = await page.inner_text('#' + OV[mode][2])
    check('Ronde 1 dari 3 selesai' in ser and 'Ana' in ser, 'papan skor tampil')
    await page.evaluate("() => nextRound()")
    await wait_playing(page, mode)
    check(not await vis(page, OV[mode][0]), 'layar akhir tertutup saat ronde 2 mulai')
    s = json.loads(await page.evaluate("() => JSON.stringify(window.__S.series)"))
    check(s['round'] == 2 and len(s['history']) == 1 and s['history'][0]['w'] == 'local-me', f'ronde 2, riwayat: {s["history"]}')

    # 4. ronde 2 -> 3 -> hasil akhir
    for r in (2, 3):
        await asyncio.sleep(6.5)
        await page.evaluate(FINISH, mode)
        await wait_over(page, mode)
        if r == 2:
            await page.evaluate("() => nextRound()"); await wait_playing(page, mode)
    acts = await page.inner_text('#' + OV[mode][1]); ser = await page.inner_text('#' + OV[mode][2])
    check('Main Lagi' in acts and 'Lanjut ke Ronde' not in acts, 'ronde terakhir: tombol Main Lagi')
    check('Hasil Akhir' in ser and 'Juara: Ana' in ser and '3 menang' in ser, 'hasil akhir: ' + ser.replace('\n', ' | ')[:160])
    await page.evaluate("() => playAgain()")
    await wait_playing(page, mode)
    s = json.loads(await page.evaluate("() => JSON.stringify(window.__S.series)"))
    check(s == {'total': 3, 'round': 1, 'history': []}, 'Main Lagi memulai seri baru: ' + json.dumps(s))

    # 5. Beranda dari layar akhir
    await asyncio.sleep(6.5)
    await page.evaluate(FINISH, mode); await wait_over(page, mode)
    await page.evaluate("() => goHome()")
    await page.wait_for_function("() => !document.getElementById('home-screen').classList.contains('hidden')", timeout=5000)
    check(True, 'tombol Beranda kembali ke beranda')

    # 6. 1 ronde: hanya Main Lagi
    await page.evaluate("(m) => playMode(m)", mode); await page.evaluate("() => { chooseRounds(1); startRounds(); }")
    await wait_playing(page, mode)
    await asyncio.sleep(6.5)
    await page.evaluate(FINISH, mode); await wait_over(page, mode)
    acts = await page.inner_text('#' + OV[mode][1]); ser_vis = await vis(page, OV[mode][2])
    check('Main Lagi' in acts and 'Lanjut' not in acts and not ser_vis, '1 ronde: Main Lagi + Beranda, tanpa papan seri')
    await page.evaluate("() => playAgain()"); await wait_playing(page, mode)
    check(not await vis(page, OV[mode][0]), 'Main Lagi memulai game baru')
    check(not errs, 'tanpa error konsol' + ('' if not errs else ': ' + '; '.join(errs[:3])))
    await ctx.close()

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        for m in (sys.argv[1:] or ['classic', 'flip', 'flex']):
            await run_mode(browser, m)
        await browser.close()
    print(f'\n{sum(results)}/{len(results)} lulus')
asyncio.run(main())
