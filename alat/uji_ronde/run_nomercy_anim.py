# Uji ANIMASI UNO Show 'Em No Mercy di browser: 7 tukar, 0 oper, Mercy, tulisan STACK, Color Roulette manual (dua deck), Discard All.
# Jalankan server dulu di folder proyek:  python3 -m http.server 8765   lalu:  python3 alat/uji_ronde/run_nomercy_anim.py [folder_gambar_hasil]
# Tiap skenario: keadaan dibuat langsung (tanpa menunggu bot), lalu aksi dilakukan seperti pemain (nmPlay/nmDraw) sambil MEREKAM posisi kartu terbang tiap 60 ms.
# Hasil: pemeriksaan OK/GAGAL + lembar kontak /tmp/nm_anim_<skenario>.png (urutan gambar dari kiri ke kanan) untuk dilihat mata.
import asyncio, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'uji_online_flex'))
from playwright.async_api import async_playwright
from fake_modules import APP_JS, AUTH_JS, FS_JS
BASE = 'http://localhost:8765/index.html'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
results = []
def check(c, m):
    results.append(bool(c)); print(('OK    ' if c else 'GAGAL ') + m, flush=True)

JS = """
window.__setup = async (cfg) => {
  const stm = await import('./js/core/state.js'), A = await import('./js/modes/nomercy/actions.js'), D = await import('./js/modes/nomercy/deck.js'), AN = await import('./js/modes/nomercy/animations.js');
  const { S, cloneState } = stm; window.__S = S; window.__A = AN; window.__AC = A; window.__D = D;
  S.paused = true;                                   // bot & timer diam: hanya aksi yang kita lakukan sendiri
  const s = cloneState();
  s.fx = { id: 'setup' + Math.random(), list: [] };
  const all = D.buildDeck(), used = new Set();
  const take = (img) => { const c = all.find(x => x.img === img && !used.has(x.id)); if (!c) throw new Error('kartu habis: ' + img); used.add(c.id); return JSON.parse(JSON.stringify(c)); };
  const pl = S.roomData.players;
  const filler = all.filter(c => /^[1-6]$/.test(c.v)).map(c => c.img);
  pl.forEach(p => { const h = cfg.hands[p.uid]; s.hands[p.uid] = Array.isArray(h) ? h.map(take) : []; });
  s.discardPile = [take(cfg.top || 'Red-5')];
  const topCards = (cfg.deckTop || []).map(take);
  pl.forEach(p => { const h = cfg.hands[p.uid]; if (typeof h === 'number') { for (let i = 0; i < h; i++) { const img = filler.find(f => all.some(x => x.img === f && !used.has(x.id))); s.hands[p.uid].push(take(img)); } } });
  s.currentColor = cfg.color || s.discardPile[0].c;
  const top = topCards;
  const rest = all.filter(c => !used.has(c.id)).map(c => JSON.parse(JSON.stringify(c))); D.shuffle(rest);
  s.deck = rest.slice(0, Math.ceil(rest.length / 2)); s.deckR = rest.slice(Math.ceil(rest.length / 2));
  top.reverse().forEach(c => s.deck.push(c));        // deckTop[0] diambil pertama dari tumpukan KIRI
  s.out = {}; s.setAside = []; s.pending = null; s.forced = null; s.winner = null; s.direction = 1; s.unoCalled = {}; s.forgot = {};
  s.turnIndex = pl.findIndex(p => p.uid === (cfg.turn || 'local-me')); s.turnNo = (s.turnNo || 0) + 1;
  await A.updateRemoteState(s);
  await window.__idle();
};
window.__idle = () => new Promise(r => { const t = setInterval(() => { if (!window.__A.isBusy()) { clearInterval(t); r(); } }, 80); });
window.__idx = (img) => window.__S.roomData.gameState.hands['local-me'].findIndex(c => c.img === img);
window.__imgs = (uid) => window.__S.roomData.gameState.hands[uid].map(c => c.img);
window.__apply = async (fn) => {                     // fn(s, rules) mengubah salinan state lalu ditulis (seperti aksi bot)
  const R = await import('./js/modes/nomercy/rules.js'), { cloneState } = await import('./js/core/state.js');
  const s = cloneState(); fn(s, R); await window.__AC.updateRemoteState(s);
};
window.__startRec = () => {
  const rec = { t0: performance.now(), s: [] }; window.__rec = rec;
  const q = (id) => { const e = document.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) }; };
  window.__recT = setInterval(() => {
    const flies = [...document.querySelectorAll('.fly-card')].map(e => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width), z: e.style.zIndex || '' }; });
    const st = document.getElementById('n-stack-txt');
    rec.s.push({ t: Math.round(performance.now() - rec.t0), flies, banner: !!document.querySelector('.fx-img-banner'), bannerSrc: ((document.querySelector('.fx-img-banner img') || {}).src || '').split('/').pop(),
      vanish: document.querySelectorAll('.nm-vanish').length, stackTxt: st && !st.classList.contains('hidden') ? st.innerText.replace(/\\s+/g, ' ') : '', pileTop: ((document.querySelector('#n-discard .pile-top img') || {}).src || '').split('/').pop(),
      handN: document.getElementById('n-hand').children.length, handVis: [...document.getElementById('n-hand').children].filter(k => k.style.visibility !== 'hidden').length, busy: window.__A.isBusy(),
      dl: q('n-draw-l'), dr: q('n-draw-r'), pile: q('n-discard'), hand: q('n-hand'), b1: q('nstack-bot1') });
  }, 60);
};
window.__stopRec = () => { clearInterval(window.__recT); return window.__rec.s; };
"""

async def sheet(page, name, shots_at):
    """Ambil beberapa tangkapan layar pada waktu tertentu (detik sejak aksi) lalu gabungkan jadi lembar kontak."""
    from PIL import Image
    files = []; t0 = asyncio.get_event_loop().time()
    for i, t in enumerate(shots_at):
        wait = t - (asyncio.get_event_loop().time() - t0)
        if wait > 0: await asyncio.sleep(wait)
        f = f'{OUT}/_nm_{name}_{i}.png'; await page.screenshot(path=f); files.append(f)
    ims = [Image.open(f) for f in files]; w, h = ims[0].size; k = 0.5
    sh = Image.new('RGB', (int(w * k) * len(ims), int(h * k)), 'black')
    for i, im in enumerate(ims): sh.paste(im.resize((int(w * k), int(h * k))), (int(w * k) * i, 0))
    sh.save(f'{OUT}/nm_anim_{name}.png')
    for f in files: os.remove(f)

def dist(a, b): return ((a['x'] - b['x']) ** 2 + (a['y'] - b['y']) ** 2) ** .5

async def new_page(pw, bots):
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
    await page.evaluate("() => playMode('nomercy')"); await asyncio.sleep(0.3)
    await page.evaluate("() => { chooseRounds(1); startRounds(); }")
    await page.wait_for_function("() => window.__S.roomData && window.__S.roomData.status === 'playing'", timeout=30000)
    await asyncio.sleep(9)                              # hitung mundur + pembagian kartu
    await page.evaluate("() => {" + JS + "}")
    return b, page, errs

async def scenario(page, name, cfg, action, shots_at, settle=7):
    await page.evaluate("(c) => window.__setup(c)", cfg)
    await page.evaluate("() => window.__startRec()")
    shots = asyncio.create_task(sheet(page, name, shots_at))
    await page.evaluate(action)
    await asyncio.sleep(settle)
    await shots
    return await page.evaluate("() => window.__stopRec()")

async def main():
    async with async_playwright() as pw:
        # ===== bagian A: 4 pemain (aku + 3 bot) =====
        b, page, errs = await new_page(pw, 3)
        # --- 1. kartu 7: tukar tangan dengan bot1; kartu terbang bolak-balik, TANPA banner/logo ---
        cfg = {'hands': {'local-me': ['Blue-7', 'Red-1', 'Red-2', 'Green-3', 'Blue-4'], 'bot1': ['Green-1', 'Yellow-2', 'Yellow-3', 'Blue-9'], 'bot2': 5, 'bot3': 5}, 'top': 'Blue-5', 'color': 'Blue'}
        old_me = cfg['hands']['local-me'][1:]; old_b1 = cfg['hands']['bot1']
        s = await scenario(page, 'tukar7', cfg, "async () => { const i = window.__idx('Blue-7'); nmPlay(i); await new Promise(r => setTimeout(r, 500)); const b = document.querySelector('#n-target-list button[data-u=bot1]'); nmPickTarget(b.dataset.u); }", [0.9, 1.6, 2.3, 3.0, 3.7, 4.6])
        check(not any(x['banner'] for x in s), '7: TIDAK ada banner/logo tukar')
        mx = max(len(x['flies']) for x in s)
        check(mx >= 5, '7: banyak kartu terbang bersamaan (%d)' % mx)
        mid = [f for x in s for f in x['flies'] if x['hand'] and x['b1'] and dist(f, x['hand']) > 90 and dist(f, x['b1']) > 70]
        check(len(mid) >= 6, '7: kartu terbang melintasi meja di antara dua pemain (%d sampel)' % len(mid))
        check(sorted(await page.evaluate("() => window.__imgs('local-me')")) == sorted(old_b1), '7: tangan saya = tangan lama bot1')
        check(sorted(await page.evaluate("() => window.__imgs('bot1')")) == sorted(old_me), '7: tangan bot1 = tangan lama saya (tanpa kartu 7)')
        check(await page.evaluate("() => document.getElementById('n-hand').children.length") == len(old_b1), '7: tampilan tangan saya sudah berganti (%d kartu)' % len(old_b1))
        check(await page.evaluate("() => document.querySelectorAll('.fly-card').length") == 0, '7: tidak ada kartu terbang tersisa')
        # --- 2. kartu 0: semua tangan berpindah ke pemain di sebelahnya, bersamaan ---
        cfg = {'hands': {'local-me': ['Blue-0', 'Red-1', 'Red-2'], 'bot1': ['Green-1', 'Yellow-2', 'Yellow-3', 'Blue-9'], 'bot2': ['Green-5', 'Green-6'], 'bot3': ['Yellow-5', 'Yellow-6', 'Yellow-4', 'Green-9', 'Green-8']}, 'top': 'Blue-5', 'color': 'Blue'}
        hs = {u: list(h) for u, h in cfg['hands'].items()}; hs['local-me'] = hs['local-me'][1:]
        s = await scenario(page, 'oper0', cfg, "() => nmPlay(window.__idx('Blue-0'))", [0.9, 1.6, 2.3, 3.0, 3.7, 4.6])
        check(not any(x['banner'] for x in s), '0: TIDAK ada banner/logo oper')
        mx = max(len(x['flies']) for x in s)
        check(mx >= 8, '0: semua pemain mengirim kartu bersamaan (%d kartu terbang sekaligus)' % mx)
        order = ['local-me', 'bot1', 'bot2', 'bot3']           # searah putaran: tangan pemain i -> pemain i+1
        for i, u in enumerate(order):
            src = order[(i - 1) % 4]
            got = sorted(await page.evaluate("(u) => window.__imgs(u)", u))
            check(got == sorted(hs[src]), '0: tangan %s = tangan lama %s' % (u, src))
        # --- 3. Stack: hanya tulisan di tengah, tanpa widget samping ---
        cfg = {'hands': {'local-me': ['Blue-DrawTwo', 'Red-1', 'Red-2'], 'bot1': ['Green-DrawFour', 'Yellow-2', 'Yellow-3'], 'bot2': 5, 'bot3': 5}, 'top': 'Blue-5', 'color': 'Blue'}
        s = await scenario(page, 'stack', cfg, "() => nmPlay(window.__idx('Blue-DrawTwo'))", [0.8, 2.0, 3.2], settle=4)
        txt = [x['stackTxt'] for x in s if x['stackTxt']]
        check(txt and '+2' in txt[-1], 'stack: tulisan di tengah menunjukkan +2 (%s)' % (txt[-1] if txt else '-'))
        first_txt = next((x['t'] for x in s if x['stackTxt']), 99999); last_busy = max((x['t'] for x in s if x['busy']), default=0)
        check(first_txt >= last_busy - 100, 'stack: tulisan baru muncul setelah animasi selesai')
        check(not any('stack' in x['bannerSrc'] for x in s), 'stack: TIDAK ada gambar/banner stack')
        check(await page.evaluate("() => !document.getElementById('n-stack') && !document.querySelector('img[src*=\"stack\"]')"), 'stack: widget samping sudah tidak ada')
        await page.evaluate("() => window.__startRec()")
        await page.evaluate("() => window.__apply((s, R) => { R.playCardOn(s, 'bot1', s.hands['bot1'].findIndex(c => c.img === 'Green-DrawFour')); })")
        await asyncio.sleep(5); s = await page.evaluate("() => window.__stopRec()")
        txt = [x['stackTxt'] for x in s if x['stackTxt']]
        check(txt and '+6' in txt[-1] and '2x' in txt[-1], 'stack: ditumpuk +4 -> tulisan +6 dan "ditumpuk 2x" (%s)' % (txt[-1] if txt else '-'))
        await page.screenshot(path=f'{OUT}/nm_anim_stack_text.png')
        # --- 4. Mercy: pemain menghilang, kartunya terbang kembali ke tumpukan ---
        cfg = {'hands': {'local-me': ['Red-1', 'Red-2'], 'bot1': 24, 'bot2': 5, 'bot3': 5}, 'top': 'Blue-5', 'color': 'Blue'}
        await page.evaluate("(c) => window.__setup(c)", cfg)
        await page.evaluate("() => window.__startRec()")
        shots = asyncio.create_task(sheet(page, 'mercy', [0.5, 1.6, 2.4, 3.0, 3.8, 5.0]))
        await page.evaluate("() => window.__apply((s, R) => { R.giveCards(s, 'bot1', 2); R.checkMercy(s); })")
        await asyncio.sleep(7); await shots
        s = await page.evaluate("() => window.__stopRec()")
        t_ban = next((x['t'] for x in s if x['banner'] and 'mercy' in x['bannerSrc']), None)
        t_van = next((x['t'] for x in s if x['vanish'] > 0), None)
        fl = [x for x in s if len(x['flies']) >= 3 and t_van is not None and x['t'] > t_van]
        check(t_ban is not None, 'Mercy: banner tampil')
        check(t_van is not None and (t_ban is None or t_van >= t_ban), 'Mercy: pemain menghilang setelah banner')
        mflies = [x for x in s if x['t'] > (t_van or 0) and x['flies'] and not x['banner']]
        # kartu yang terbang ke tumpukan: posisi akhir (sampel terakhir tiap kartu) dekat salah satu tumpukan
        near = 0
        for x in mflies:
            for f in x['flies']:
                if x['dl'] and x['dr'] and (dist(f, x['dl']) < 70 or dist(f, x['dr']) < 70): near += 1
        check(len(mflies) >= 5 and near >= 3, 'Mercy: kartu terbang kembali ke tumpukan ambil (%d sampel, %d dekat tumpukan)' % (len(mflies), near))
        check(await page.evaluate("() => { const e = document.getElementById('nprof-bot1'); return !!e && e.classList.contains('opp-out'); }"), 'Mercy: bot1 akhirnya tampil TERSINGKIR')
        check(await page.evaluate("() => document.querySelectorAll('.fly-card').length") == 0, 'Mercy: tidak ada kartu terbang tersisa')
        # --- 5. Discard All ---
        cfg = {'hands': {'local-me': ['Red-DiscardAll', 'Red-1', 'Red-2', 'Red-3', 'Blue-4', 'Green-5'], 'bot1': 4, 'bot2': 5, 'bot3': 5}, 'top': 'Red-5', 'color': 'Red'}
        await page.evaluate("() => { const e = document.getElementById('nprof-bot1'); }")
        await page.evaluate("(c) => window.__setup(c)", cfg)
        await page.evaluate("() => window.__startRec()")
        shots = asyncio.create_task(sheet(page, 'discardall', [0.3, 1.0, 1.7, 2.3, 2.9, 3.5, 4.2, 5.0]))
        await page.evaluate("() => nmPlay(window.__idx('Red-DiscardAll'))")
        await asyncio.sleep(7); await shots
        s = await page.evaluate("() => window.__stopRec()")
        fl = [x for x in s if x['flies']]
        peak = max(len(x['flies']) for x in s)
        check(peak >= 4, 'Discard All: kartu Discard All + 3 kartu merah terbang (puncak %d kartu)' % peak)
        # tahap kumpul: ada sampel dengan >= 4 kartu yang semuanya berdekatan (menumpuk) di atas tumpukan buangan
        gather = [x for x in s if len(x['flies']) >= 4 and x['pile'] and all(dist(f, {'x': x['pile']['x'], 'y': x['pile']['y'] - 55}) < 70 for f in x['flies'])]
        check(len(gather) >= 2, 'Discard All: kartu sewarna menumpuk di belakang kartu yang melayang (%d sampel)' % len(gather))
        if gather:
            z = sorted(f['z'] for f in gather[-1]['flies']); check(z[-1] == '302' and z.count('301') >= 3, 'Discard All: kartu Discard All berada DI DEPAN tumpukan (z=%s)' % z)
        check(any(x['pileTop'].startswith('Red-5') for x in s), 'Discard All: tumpukan buangan masih menampilkan kartu lama selama animasi')
        check(s[-1]['pileTop'].startswith('Red-DiscardAll'), 'Discard All: akhirnya kartu Discard All di puncak tumpukan (%s)' % s[-1]['pileTop'])
        hv = [x['handVis'] for x in s]
        check(max(x['handN'] for x in s) >= 5 and s[-1]['handN'] == 2, 'Discard All: kartu sewarna tetap di tangan sampai terbang; akhirnya 2 kartu (Biru-4, Hijau-5)')
        check(await page.evaluate("() => document.querySelectorAll('.fly-card').length") == 0, 'Discard All: tidak ada kartu terbang tersisa')
        # Discard All oleh BOT (kartu sewarna terbang dari tumpukan lawan)
        cfg = {'hands': {'local-me': 5, 'bot1': ['Red-DiscardAll', 'Red-1', 'Red-2', 'Blue-4', 'Green-5'], 'bot2': 5, 'bot3': 5}, 'top': 'Red-5', 'color': 'Red', 'turn': 'bot1'}
        await page.evaluate("(c) => window.__setup(c)", cfg)
        await page.evaluate("() => window.__startRec()")
        await page.evaluate("() => window.__apply((s, R) => { R.playCardOn(s, 'bot1', s.hands['bot1'].findIndex(c => c.img === 'Red-DiscardAll')); })")
        await asyncio.sleep(7); s = await page.evaluate("() => window.__stopRec()")
        check(max(len(x['flies']) for x in s) >= 3, 'Discard All (bot): 3 kartu terbang dari lawan (puncak %d)' % max(len(x['flies']) for x in s))
        check(s[-1]['pileTop'].startswith('Red-DiscardAll'), 'Discard All (bot): berakhir di puncak tumpukan')
        check(not errs, 'bagian A tanpa galat JS: ' + '; '.join(errs[:4]))
        await b.close()

        # ===== bagian B: 2 pemain: Color Roulette manual (aku korban) =====
        b, page, errs = await new_page(pw, 1)
        cfg = {'hands': {'local-me': ['Red-1', 'Blue-2', 'Green-3'], 'bot1': ['Black-WildColorRoulette', 'Yellow-2']}, 'top': 'Blue-5', 'color': 'Blue', 'turn': 'bot1',
               'deckTop': ['Red-4', 'Black-WildDrawSix', 'Yellow-7', 'Green-8', 'Red-9']}
        await page.evaluate("(c) => window.__setup(c)", cfg)
        await page.evaluate("() => window.__apply((s, R) => { R.playCardOn(s, 'bot1', s.hands['bot1'].findIndex(c => c.img === 'Black-WildColorRoulette')); })")
        await page.wait_for_function("() => !document.getElementById('n-color-modal').classList.contains('hidden')", timeout=20000)
        check(True, 'Roulette: aku korban -> pemilih warna muncul')
        await page.screenshot(path=f'{OUT}/nm_anim_roulette_pick.png')
        await page.evaluate("() => nmPickColor('Green')")
        await page.wait_for_function("() => window.__S.roomData.gameState.pending && window.__S.roomData.gameState.pending.color === 'Green'", timeout=10000)
        await page.evaluate("() => window.__idle()")
        st = await page.evaluate("() => { const g = window.__S.roomData.gameState; return { color: g.pending.color, cur: g.currentColor, hand: g.hands['local-me'].length, turn: g.players ? 0 : g.turnIndex }; }")
        check(st['color'] == 'Green' and st['cur'] == 'Green', 'Roulette: warna Hijau dipilih; belum ada kartu diambil otomatis (tangan %d)' % st['hand'])
        check(st['hand'] == 3, 'Roulette: kartu TIDAK diambil otomatis setelah memilih warna')
        rdy = await page.evaluate("() => [document.getElementById('n-draw-l').classList.contains('deck-ready'), document.getElementById('n-draw-r').classList.contains('deck-ready')]")
        check(all(rdy), 'Roulette: kedua tumpukan berdenyut (siap diketuk)')
        msg = await page.evaluate("() => document.getElementById('n-turn-ind').innerText")
        check('Hijau' in msg, 'Roulette: petunjuk "%s"' % msg)
        await page.screenshot(path=f'{OUT}/nm_anim_roulette_ready.png')
        # ketuk tumpukan KIRI satu per satu: urutan kartu: Red-4, Wild+6, Yellow-7, Green-8 (berhenti)
        counts = [3]; flying = []
        for i in range(8):
            before = await page.evaluate("() => window.__S.roomData.gameState.hands['local-me'].length")
            if not await page.evaluate("() => !!window.__S.roomData.gameState.pending"): break
            await page.evaluate("() => window.__startRec()")
            await page.evaluate("() => nmDraw('L')")
            await asyncio.sleep(1.6)
            s = await page.evaluate("() => window.__stopRec()")
            after = await page.evaluate("() => window.__S.roomData.gameState.hands['local-me'].length")
            counts.append(after); flying.append(max(len(x['flies']) for x in s))
            await page.evaluate("() => window.__idle()")
        check(counts == [3, 4, 5, 6, 7], 'Roulette: tiap ketukan = TEPAT 1 kartu (jumlah tangan %s)' % counts)
        check(all(f == 1 for f in flying), 'Roulette: tiap ketukan menerbangkan 1 kartu dari tumpukan (%s)' % flying)
        last = await page.evaluate("() => { const g = window.__S.roomData.gameState; const h = g.hands['local-me']; return { last: h[h.length - 1].img, pend: !!g.pending, turn: g.turnIndex }; }")
        check(last['last'] == 'Green-8' and not last['pend'], 'Roulette: berhenti saat Hijau muncul (Green-8), pending selesai')
        check(last['turn'] == 1, 'Roulette: giliran korban dilewati -> bot1')
        check(await page.evaluate("() => !document.getElementById('n-draw-l').classList.contains('deck-ready')"), 'Roulette: tumpukan berhenti berdenyut')
        check(not errs, 'bagian B tanpa galat JS: ' + '; '.join(errs[:4]))
        await b.close()
    print('LULUS' if all(results) else 'ADA YANG GAGAL', sum(results), '/', len(results))

asyncio.run(main())
