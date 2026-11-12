import asyncio, json, sys, re
from playwright.async_api import async_playwright
from fake_modules import APP_JS, AUTH_JS, FS_JS

BASE = 'http://localhost:8765/index.html'
store = {}          # path -> dict
pages = []
results = []
def check(cond, msg):
    results.append((bool(cond), msg)); print(('OK    ' if cond else 'GAGAL ') + msg, flush=True)

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
    asyncio.create_task(notify(path))
    return None

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
    page = await ctx.new_page()
    page.errors = []
    page.on('pageerror', lambda e: page.errors.append(str(e)))
    page.on('console', lambda m: page.errors.append('console:' + m.text) if m.type == 'error' and '404' not in m.text else None)
    pages.append(page)
    await page.goto(BASE)
    await page.wait_for_function("() => document.getElementById('home-screen') && !document.getElementById('home-screen').classList.contains('hidden')", timeout=15000)
    await page.evaluate("() => { const o = window.showToast; window.__toasts = []; window.showToast = (m) => { window.__toasts.push(m); return o(m); }; }")
    return page

async def visible(page, id):
    return await page.evaluate("(id) => { const e = document.getElementById(id); return !!e && !e.classList.contains('hidden'); }", id)

async def open_hub(page, mode='flex'):
    await page.evaluate("(m) => { setHomeTab('online'); playMode(m); }", mode)
    await page.wait_for_function("() => !document.getElementById('online-screen').classList.contains('hidden')")

async def join(page, code):
    await page.evaluate("(c) => { document.getElementById('room-code-input').value = c; joinRoom(); }", code)

DRIVER = """
async () => {
  const R = await import('./js/modes/flex/rules.js'), B = await import('./js/modes/flex/bot.js');
  const A = await import('./js/modes/flex/actions.js'), N = await import('./js/modes/flex/animations.js');
  const { S } = await import('./js/core/state.js');
  if (!S.roomData || S.roomData.status !== 'playing') return 'stop';
  if (N.isBusy()) return 'busy';
  const st = S.roomData.gameState, me = S.currentUser.uid;
  if (R.actorUid(st) !== me) return 'wait';
  if (st.pending) { window.flexChallenge(B.answerPending()); return 'answer'; }
  if (S.hasDrawnThisTurn) { window.flexPass(); return 'pass'; }
  const mv = B.choosePlay(st, S.roomData.players, me);
  if (mv) { await A.processPlayCard(mv.idx, { flex: mv.flex, color: mv.color, target: mv.target }); return 'play' + (mv.flex ? '-flex' : ''); }
  window.flexDraw('L'); return 'draw';
}
"""
SNAP = """
() => { const g = window.__S.roomData.gameState; return JSON.stringify({ top: g.discardPile[g.discardPile.length-1].img, color: g.currentColor, turn: g.turnIndex, dir: g.direction,
   hands: Object.fromEntries(Object.entries(g.hands).map(([k,v]) => [k, v.length])), power: g.power, deck: g.deck.length + g.deckR.length, status: window.__S.roomData.status }); }
"""

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        A = await new_user(browser, 'uidA', 'Ana'); B = await new_user(browser, 'uidB', 'Budi'); C = await new_user(browser, 'uidC', 'Citra')
        for p in pages: await p.evaluate("async () => { window.__S = (await import('./js/core/state.js')).S; }")

        # kartu Flex di beranda tab Online: tombol Buat/Gabung, bukan "segera hadir"
        await A.evaluate("() => setHomeTab('online')")
        txt = await A.inner_text('#home-sections')
        check('Online segera hadir' not in txt and 'Buat / Gabung' in txt, 'beranda tab Online: UNO Flex punya tombol Buat / Gabung')

        # buat ruangan
        await open_hub(A); await A.evaluate("() => createRoom()")
        await A.wait_for_function("() => !document.getElementById('lobby-screen').classList.contains('hidden') && /^[A-Z0-9]{5}$/.test(document.getElementById('lobby-room-code').innerText)")
        code = (await A.inner_text('#lobby-room-code')).strip()
        room = [k for k in store if k.endswith('/' + code)][0]
        check(store[room]['mode'] == 'flex', f'ruangan {code} tersimpan dengan mode flex')
        check('Flex' in await A.inner_text('#lobby-mode'), 'lobi menampilkan nama mode UNO Flex')

        # Klasik tidak boleh masuk ruangan Flex
        D = await new_user(browser, 'uidD', 'Dodi')
        await open_hub(D, 'classic'); await join(D, code); await asyncio.sleep(0.6)
        check(any('UNO Flex' in t for t in await D.evaluate('() => window.__toasts')), 'pemain dari hub Klasik ditolak masuk ruangan Flex')
        check(len(store[room]['players']) == 1, 'daftar pemain tidak bertambah setelah ditolak')

        # B dan C bergabung
        for p in (B, C):
            await open_hub(p); await join(p, code)
        await A.wait_for_function("() => document.getElementById('player-count').innerText === '3'")
        check(await visible(A, 'btn-start-game'), 'host melihat tombol Mulai dengan 3 pemain')
        check(not await visible(B, 'btn-start-game'), 'pemain biasa tidak melihat tombol Mulai')

        # mulai permainan
        await A.evaluate("() => startGame()")
        for p in (A, B, C):
            await p.wait_for_function("() => !document.getElementById('flex-screen').classList.contains('hidden')", timeout=30000)
        await asyncio.sleep(9)   # hitung mundur + bagi kartu
        s = json.loads(await A.evaluate(SNAP))
        check(all(v == 7 for v in s['hands'].values()) and len(s['hands']) == 3, 'bagi 7 kartu ke 3 pemain: ' + str(s['hands']))
        check(set(s['power'].values()) == {True}, 'semua Power Card mulai hijau')
        check(store[room]['status'] == 'playing', 'status ruangan = playing')

        # FASE 1: main bergantian lewat fungsi game asli (flexPlay/flexDraw/flexChallenge ditulis ke Firestore), sambil memeriksa sinkron
        counts = {}; synced = 0; checks = 0; acts = 0; next_check = 8
        async def drive():
            n = 0
            for p in pages[:3]:
                r = await p.evaluate(DRIVER); counts[r] = counts.get(r, 0) + 1
                if r.startswith(('play', 'draw', 'pass', 'answer')): n += 1
            return n
        for _ in range(900):
            acts += await drive()
            if acts >= next_check:
                next_check += 8
                await asyncio.sleep(4)   # biarkan animasi selesai di semua layar
                snaps = [await p.evaluate(SNAP) for p in pages[:3]]
                checks += 1; synced += len(set(snaps)) == 1
            if acts >= 26: break
            await asyncio.sleep(0.35)
        print('aksi fase 1:', counts)
        check(counts.get('play', 0) + counts.get('play-flex', 0) >= 10, 'banyak kartu dimainkan lewat jalur online')
        check(counts.get('play-flex', 0) >= 1, 'sisi flex + Power Card ikut tersinkron lewat online')
        check(checks >= 2 and synced == checks, f'state sama di 3 layar pada {synced}/{checks} pemeriksaan')
        await asyncio.sleep(4)
        check(store[room]['status'] == 'playing', 'permainan masih berjalan sebelum uji muat ulang')

        # B memuat ulang halaman lalu bergabung lagi ke ruangan yang sama
        before = json.loads(await A.evaluate(SNAP))['hands']['uidB']
        await B.reload(); await B.wait_for_function("() => !document.getElementById('home-screen').classList.contains('hidden')")
        await B.evaluate("() => { const o = window.showToast; window.__toasts = []; window.showToast = (m) => { window.__toasts.push(m); return o(m); }; }")
        await B.evaluate("async () => { window.__S = (await import('./js/core/state.js')).S; }")
        await open_hub(B); await join(B, code)
        await B.wait_for_function("() => !document.getElementById('flex-screen').classList.contains('hidden')", timeout=30000)
        await asyncio.sleep(3)
        after = json.loads(await B.evaluate(SNAP))['hands']['uidB']
        check(await visible(B, 'flex-screen'), 'pemain yang memuat ulang bisa gabung lagi dan kembali ke meja')
        check(after == before and after >= 1, f'tangan pemain terhubung kembali utuh ({before} -> {after} kartu)')
        check(len(store[room]['players']) == 3, 'gabung ulang tidak menggandakan pemain')

        # FASE 2: mainkan sampai pemenang muncul secara alami
        for _ in range(1500):
            for p in pages[:3]: await p.evaluate(DRIVER)
            if store[room]['status'] == 'finished': break
            await asyncio.sleep(0.35)
        check(store[room]['status'] == 'finished', 'permainan selesai secara alami, status ruangan = finished')
        for name, p in (('Ana', A), ('Budi', B), ('Citra', C)):
            try:
                await p.wait_for_function("() => !document.getElementById('x-over-modal').classList.contains('hidden')", timeout=40000); ok = True
            except Exception: ok = False
            check(ok, f'layar akhir (Total Skor) tampil di layar {name}')
        g = store[room]['gameState']
        check(g.get('winner') in ('uidA', 'uidB', 'uidC'), 'pemenang tercatat: ' + str(g.get('winner')))

        # keluar ke beranda lewat flexLeave
        for p in (A, B, C): await p.evaluate("() => flexLeave()")
        check(all([await visible(p, 'home-screen') for p in (A, B, C)]), 'semua pemain kembali ke beranda')

        # ruangan penuh = 8 pemain untuk Flex
        await open_hub(A); await A.evaluate("() => createRoom()")
        await A.wait_for_function("() => /^[A-Z0-9]{5}$/.test(document.getElementById('lobby-room-code').innerText)")
        code2 = (await A.inner_text('#lobby-room-code')).strip(); room2 = [k for k in store if k.endswith('/' + code2)][0]
        store[room2]['players'] += [{'uid': f'x{i}', 'name': f'X{i}'} for i in range(6)]   # 1 + 6 = 7 pemain
        await open_hub(B); await join(B, code2); await asyncio.sleep(0.8)
        check(len(store[room2]['players']) == 8, 'pemain ke-8 masih boleh masuk (Flex maks 8)')
        await open_hub(C); await join(C, code2); await asyncio.sleep(0.8)
        check(len(store[room2]['players']) == 8 and 'Ruangan penuh!' in await C.evaluate('() => window.__toasts'), 'pemain ke-9 ditolak: Ruangan penuh!')

        # host keluar lobi -> ruangan dihapus
        await A.evaluate("() => leaveLobby()"); await asyncio.sleep(0.8)
        check(room2 not in store, 'host keluar lobi: ruangan dihapus')

        errs = [e for p in pages for e in p.errors]
        check(not errs, 'tidak ada error konsol/halaman' + ('' if not errs else ': ' + ' | '.join(errs[:4])))
        await browser.close()
    bad = [m for ok, m in results if not ok]
    print(f'\nTotal {len(results)} pemeriksaan, gagal {len(bad)}'); sys.exit(1 if bad else 0)

asyncio.run(main())
