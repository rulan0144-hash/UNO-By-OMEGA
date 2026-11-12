# Uji ronde ONLINE (2 pemain, Firestore palsu bersama). Server dulu:  python3 -m http.server 8765  (di folder proyek)
import asyncio, json, sys
sys.path.insert(0, '../uji_online_flex')
from playwright.async_api import async_playwright
from fake_modules import APP_JS, AUTH_JS, FS_JS
BASE = 'http://localhost:8765/index.html'
store = {}; pages = []; results = []
def check(c, m):
    results.append(bool(c)); print(('OK    ' if c else 'GAGAL ') + m, flush=True)
async def notify(path):
    j = json.dumps(store[path]) if path in store else 'null'
    for p in list(pages):
        try: await p.evaluate("([a,b]) => window.__fsNotify && window.__fsNotify(a,b)", [path, j])
        except Exception: pass
async def fs_op(source, op, path, data):
    d = json.loads(data) if data else None
    if op == 'get': return json.dumps(store[path]) if path in store else None
    if op == 'set': store[path] = d
    elif op == 'update': store[path] = {**store.get(path, {}), **d}
    elif op == 'delete': store.pop(path, None)
    asyncio.create_task(notify(path)); return None
async def new_user(browser, uid, name):
    ctx = await browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True)
    await ctx.expose_binding('__fsOp', lambda src, op, path, data: fs_op(src, op, path, data))
    await ctx.add_init_script(f"window.__uid={json.dumps(uid)}; localStorage.setItem('uno_name', {json.dumps(name)}); localStorage.setItem('uno_tab','online');")
    async def route(r):
        u = r.request.url
        if u.startswith('http://localhost'): return await r.continue_()
        if 'firebase-app.js' in u: return await r.fulfill(body=APP_JS, content_type='text/javascript')
        if 'firebase-auth.js' in u: return await r.fulfill(body=AUTH_JS, content_type='text/javascript')
        if 'firebase-firestore.js' in u: return await r.fulfill(body=FS_JS, content_type='text/javascript')
        if 'tailwind' in u: return await r.fulfill(body='var s=document.createElement("style");s.textContent=".hidden{display:none!important}";document.head.appendChild(s);', content_type='text/javascript')
        return await r.fulfill(body='', content_type='text/css')
    await ctx.route('**/*', route)
    page = await ctx.new_page(); page.errors = []
    page.on('pageerror', lambda e: page.errors.append(str(e)))
    page.on('console', lambda m: page.errors.append('console:' + m.text) if m.type == 'error' and '404' not in m.text else None)
    pages.append(page)
    await page.goto(BASE)
    await page.wait_for_function("() => document.getElementById('home-screen') && !document.getElementById('home-screen').classList.contains('hidden')", timeout=15000)
    await page.evaluate("async () => { window.__S = (await import('./js/core/state.js')).S; }")
    return page
async def vis(page, id):
    return await page.evaluate("(id) => { const e = document.getElementById(id); return !!e && !e.classList.contains('hidden'); }", id)

OV = {'classic': ('game-over-modal', 'over-actions', 'over-series', 'game-screen'), 'flip': ('f-over-modal', 'f-over-actions', 'f-over-series', 'flip-screen'), 'flex': ('x-over-modal', 'x-over-actions', 'x-over-series', 'flex-screen')}
FINISH = """
async (mode) => {
  const { S } = await import('./js/core/state.js');
  const A = await import('./js/modes/' + mode + '/actions.js');
  const me = S.currentUser.uid;
  const s = JSON.parse(JSON.stringify(S.roomData.gameState));
  s.fx = { id: 'x' + Math.random(), list: [] };
  s.winner = me; s.hands[me] = [];
  if (mode !== 'classic') { s.roundPts = 30; s.roundDetail = S.roomData.players.filter(p => p.uid !== me).map(p => ({ uid: p.uid, n: (s.hands[p.uid]||[]).length, pts: 30 })); }
  A.updateRemoteState(s, { status: 'finished' });
}
"""
async def waitv(page, id, shown=True, t=40000):
    await page.wait_for_function("([id, sh]) => { const e = document.getElementById(id); const v = !!e && !e.classList.contains('hidden'); return v === sh; }", arg=[id, shown], timeout=t)

async def run(browser, mode):
    print('==== ONLINE', mode, flush=True)
    store.clear(); pages.clear()
    A = await new_user(browser, 'uidA', 'Ana'); B = await new_user(browser, 'uidB', 'Budi')
    ov, act, ser, scr = OV[mode]
    await A.evaluate("(m) => { setHomeTab('online'); playMode(m); }", mode)
    await A.wait_for_function("() => !document.getElementById('online-screen').classList.contains('hidden')")
    await A.evaluate("() => createRoom()")
    await A.wait_for_function("() => /^[A-Z0-9]{5}$/.test(document.getElementById('lobby-room-code').innerText)")
    code = (await A.inner_text('#lobby-room-code')).strip(); room = [k for k in store if k.endswith('/' + code)][0]
    check(store[room].get('rounds') == 1 and store[room].get('round') == 1 and store[room].get('history') == [], 'ruangan dibuat dengan rounds=1, round=1, history=[]')
    await B.evaluate("(m) => { setHomeTab('online'); playMode(m); }", mode)
    await B.wait_for_function("() => !document.getElementById('online-screen').classList.contains('hidden')")
    await B.evaluate("(c) => { document.getElementById('room-code-input').value = c; joinRoom(); }", code)
    await A.wait_for_function("() => document.getElementById('player-count').innerText === '2'")

    # lobi: host memilih ronde, pemain lain hanya melihat
    chipsA = await A.evaluate("() => [...document.querySelectorAll('#lr-chips button')].map(b => b.textContent + (b.disabled ? 'x' : '') + (b.classList.contains('on') ? '*' : '')).join(',')")
    chipsB = await B.evaluate("() => [...document.querySelectorAll('#lr-chips button')].map(b => b.textContent + (b.disabled ? 'x' : '') + (b.classList.contains('on') ? '*' : '')).join(',')")
    check(chipsA == '1*,3,5,7,10', 'host: pilihan ronde aktif, bawaan 1: ' + chipsA)
    check(chipsB == '1x*,3x,5x,7x,10x', 'pemain lain: pilihan ronde terkunci: ' + chipsB)
    await B.evaluate("() => setRounds(5)"); await asyncio.sleep(0.5)
    check(store[room]['rounds'] == 1, 'pemain biasa tidak bisa mengubah ronde')
    await A.evaluate("() => setRounds(2)" if False else "() => setRounds(3)")
    await B.wait_for_function("() => document.querySelector('#lr-chips .on b').textContent === '3'")
    check(store[room]['rounds'] == 3, 'host mengubah ke 3 ronde, tersinkron ke pemain lain')
    check('3 ronde' in await B.inner_text('#lr-note'), 'catatan pemain lain: ' + await B.inner_text('#lr-note'))

    await A.evaluate("() => startGame()")
    for p in (A, B): await waitv(p, scr, True, 30000)
    await asyncio.sleep(8)
    check(store[room]['status'] == 'playing' and store[room]['round'] == 1 and store[room]['gameId'], 'permainan mulai: round 1, gameId terisi')
    lab = await A.evaluate("() => { const e = document.querySelector('.f-countdown .cd-label'); return e ? e.textContent : 'x' }")
    # ronde 1: A menang
    gid1 = store[room]['gameId']
    await A.evaluate(FINISH, mode)
    for p in (A, B): await waitv(p, ov, True)
    ta = await A.inner_text('#' + act); tb = await B.inner_text('#' + act)
    check('Lanjut ke Ronde 2' in ta, 'host melihat: ' + ta.replace('\n', ' | '))
    check('Menunggu host' in tb and 'Lanjut' not in tb and 'Beranda' in tb, 'pemain lain melihat: ' + tb.replace('\n', ' | '))
    sb = await B.inner_text('#' + ser)
    check('Ronde 1 dari 3 selesai' in sb and 'Ana' in sb, 'papan skor tampil di pemain lain')
    await B.evaluate("() => nextRound()"); await asyncio.sleep(0.6)
    check(store[room]['status'] == 'finished', 'pemain biasa tidak bisa memulai ronde berikut')
    await A.evaluate("() => nextRound()")
    for p in (A, B): await waitv(p, ov, False, 20000)
    r = store[room]
    check(r['status'] == 'playing' and r['round'] == 2 and len(r['history']) == 1 and r['history'][0]['w'] == 'uidA' and r['gameId'] != gid1, f'ronde 2 dimulai host, riwayat={r["history"]}')
    hands = await B.evaluate("() => JSON.stringify(Object.values(window.__S.roomData.gameState.hands).map(h => h.length))")
    check(hands == '[7,7]', 'kartu dibagi ulang di layar pemain lain: ' + hands)
    await asyncio.sleep(8)

    # ronde 2: B menang; ronde 3: A menang -> hasil akhir
    await B.evaluate(FINISH, mode)
    for p in (A, B): await waitv(p, ov, True)
    await A.evaluate("() => nextRound()")
    for p in (A, B): await waitv(p, ov, False, 20000)
    await asyncio.sleep(8)
    await A.evaluate(FINISH, mode)
    for p in (A, B): await waitv(p, ov, True)
    ta = await A.inner_text('#' + act); sa = await A.inner_text('#' + ser); sb = await B.inner_text('#' + ser); tb = await B.inner_text('#' + act)
    check('Main Lagi' in ta and 'Lanjut' not in ta, 'ronde terakhir: host melihat Main Lagi')
    check('Menunggu host memulai permainan baru' in tb, 'ronde terakhir: pemain lain menunggu host')
    check('Hasil Akhir' in sa and 'Juara: Ana' in sa and sa == sb, 'hasil akhir sama di kedua layar: ' + sa.replace('\n', ' | ')[:140])
    await A.evaluate("() => playAgain()")
    for p in (A, B): await waitv(p, ov, False, 20000)
    r = store[room]
    check(r['round'] == 1 and r['history'] == [] and r['rounds'] == 3 and r['status'] == 'playing', 'Main Lagi: seri baru, ronde tetap 3')
    await asyncio.sleep(8)
    # Beranda dari layar akhir (pemain biasa)
    await A.evaluate(FINISH, mode)
    for p in (A, B): await waitv(p, ov, True)
    await B.evaluate("() => goHome()")
    await B.wait_for_function("() => !document.getElementById('home-screen').classList.contains('hidden')", timeout=5000)
    check(True, 'tombol Beranda dari layar akhir online')
    errs = A.errors + B.errors
    check(not errs, 'tanpa error konsol' + ('' if not errs else ': ' + '; '.join(errs[:3])))
    for p in pages: await p.context.close()

async def run_single(browser, mode):
    print('==== ONLINE 1 RONDE', mode, flush=True)
    store.clear(); pages.clear()
    A = await new_user(browser, 'uidA', 'Ana'); B = await new_user(browser, 'uidB', 'Budi')
    ov, act, ser, scr = OV[mode]
    await A.evaluate("(m) => { setHomeTab('online'); playMode(m); }", mode)
    await A.wait_for_function("() => !document.getElementById('online-screen').classList.contains('hidden')")
    await A.evaluate("() => createRoom()")
    await A.wait_for_function("() => /^[A-Z0-9]{5}$/.test(document.getElementById('lobby-room-code').innerText)")
    code = (await A.inner_text('#lobby-room-code')).strip(); room = [k for k in store if k.endswith('/' + code)][0]
    await B.evaluate("(m) => { setHomeTab('online'); playMode(m); }", mode)
    await B.wait_for_function("() => !document.getElementById('online-screen').classList.contains('hidden')")
    await B.evaluate("(c) => { document.getElementById('room-code-input').value = c; joinRoom(); }", code)
    await A.wait_for_function("() => document.getElementById('player-count').innerText === '2'")
    await A.evaluate("() => startGame()")
    for p in (A, B): await waitv(p, scr, True, 30000)
    await asyncio.sleep(8)
    await B.evaluate(FINISH, mode)
    for p in (A, B): await waitv(p, ov, True)
    ta = await A.inner_text('#' + act); tb = await B.inner_text('#' + act)
    check('Main Lagi' in ta and 'Lanjut' not in ta and not await vis(A, ser), '1 ronde: host melihat Main Lagi + Beranda, tanpa papan seri')
    check('Menunggu host' in tb, '1 ronde: pemain lain menunggu host')
    g1 = store[room]['gameId']
    await A.evaluate("() => playAgain()")
    for p in (A, B): await waitv(p, ov, False, 20000)
    check(store[room]['status'] == 'playing' and store[room]['gameId'] != g1, 'Main Lagi memulai game baru untuk semua pemain')
    await asyncio.sleep(8)
    await A.evaluate(FINISH, mode)
    for p in (A, B): await waitv(p, ov, True)
    check(True, 'game ke-2 selesai: layar akhir tampil lagi di kedua pemain (bunyi/kunci tidak macet)')
    errs = A.errors + B.errors
    check(not errs, 'tanpa error konsol' + ('' if not errs else ': ' + '; '.join(errs[:3])))
    for p in pages: await p.context.close()

async def main():
    modes = sys.argv[1:] or ['classic']
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        for m in modes:
            await run(browser, m)
            await run_single(browser, m)
        await browser.close()
    print(f'\n{sum(results)}/{len(results)} lulus')
asyncio.run(main())
