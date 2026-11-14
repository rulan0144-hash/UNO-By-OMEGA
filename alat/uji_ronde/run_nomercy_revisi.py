# Uji ANIMASI UNO Show 'Em No Mercy di browser: 7 tukar, 0 oper, Mercy, tulisan STACK, Color Roulette manual (dua deck), Discard All.
# Jalankan server dulu di folder proyek:  python3 -m http.server 8765   lalu:  python3 alat/uji_ronde/run_nomercy_anim.py [folder_gambar_hasil]
# Tiap skenario: keadaan dibuat langsung (tanpa menunggu bot), lalu aksi dilakukan seperti pemain (nmPlay/nmDraw) sambil MEREKAM posisi kartu terbang tiap 60 ms.
# Hasil: pemeriksaan OK/GAGAL + lembar kontak /tmp/nm_anim_<skenario>.png (urutan gambar dari kiri ke kanan) untuk dilihat mata.
import asyncio, sys, os
sys.path.insert(0, os.path.join(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'uji_online_flex')))
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
        # A) Roulette (jalan pintas bot) berujung tersingkir: kartu diambil DULU, banner Mercy sesudahnya
        b, page, errs = await new_page(pw, 3)
        cfg = {'hands': {'local-me': ['Red-1', 'Red-2'], 'bot1': 23, 'bot2': 5, 'bot3': 5}, 'top': 'Blue-5', 'color': 'Blue', 'deckTop': ['Green-0', 'Yellow-0'], 'turn': 'bot1'}
        await page.evaluate("(c) => window.__setup(c)", cfg)
        await page.evaluate("() => window.__startRec()")
        await page.evaluate("() => window.__apply((s, R) => { s.pending = { kind: 'roulette', by: 'local-me', victim: 'bot1', color: null, got: 0 }; s.turnIndex = 1; R.resolveRoulette(s, 'Red'); })")
        await asyncio.sleep(9); s = await page.evaluate("() => window.__stopRec()")
        t_fly = next((x['t'] for x in s if x['flies']), None)
        t_mer = next((x['t'] for x in s if x['banner'] and 'mercy' in x['bannerSrc']), None)
        check(t_mer is not None, 'A: banner Mercy tampil')
        check(t_fly is not None and t_mer is not None and t_fly < t_mer, 'A: kartu Roulette terbang DULU (%s ms) sebelum banner Mercy (%s ms)' % (t_fly, t_mer))
        check(await page.evaluate("() => window.__S.roomData.gameState.out.bot1 === true"), 'A: bot1 tersingkir')
        check(await page.evaluate("() => window.__S.roomData.status === 'playing'"), 'A: bot tersingkir -> permainan lanjut (hanya pemain yang menghentikan ronde)')
        check(await page.evaluate("() => document.querySelectorAll('.fly-card').length") == 0, 'A: tidak ada kartu terbang tersisa')
        # B) PEMAIN tersingkir (offline): ronde langsung selesai, menu akhir muncul setelah animasi Mercy
        cfg = {'hands': {'local-me': 24, 'bot1': 6, 'bot2': 3, 'bot3': 5}, 'top': 'Blue-5', 'color': 'Blue', 'turn': 'local-me'}
        await page.evaluate("(c) => window.__setup(c)", cfg)
        await page.evaluate("() => window.__startRec()")
        await page.evaluate("() => window.__apply((s, R) => { R.giveCards(s, 'local-me', 2, true); R.checkMercy(s); })")
        await asyncio.sleep(1.0)
        check(await page.evaluate("() => document.getElementById('n-over-modal').classList.contains('hidden')"), 'B: menu akhir BELUM muncul selagi animasi Mercy berjalan')
        await asyncio.sleep(10); s = await page.evaluate("() => window.__stopRec()")
        st = await page.evaluate("() => { const r = window.__S.roomData, g = r.gameState; return { status: r.status, winner: g.winner, by: g.winBy, out: g.out, pts: g.roundPts }; }")
        check(st['status'] == 'finished' and st['winner'] == 'bot2' and st['by'] == 'out', 'B: ronde selesai, pemenang = lawan berkartu paling sedikit (%s)' % st)
        check(st['pts'] == 250 + 6 + 5 + 0 or st['pts'] >= 250, 'B: poin menghitung +250 untuk pemain tersingkir (%s)' % st['pts'])
        check(await page.evaluate("() => !document.getElementById('n-over-modal').classList.contains('hidden')"), 'B: menu akhir tampil setelah animasi')
        t_mer = next((x['t'] for x in s if x['banner'] and 'mercy' in x['bannerSrc']), None)
        check(t_mer is not None, 'B: banner Mercy tetap tampil sebelum menu akhir')
        txt = await page.evaluate("() => [document.getElementById('n-winner-text').innerText, document.getElementById('n-win-by').innerText]")
        check(txt[1] == 'Kamu tersingkir (Mercy)!', 'B: teks menu akhir: %s' % txt)
        btns = await page.evaluate("() => [...document.querySelectorAll('#n-over-actions button')].map(b => b.innerText)")
        check(len(btns) >= 2, 'B: tombol menu akhir: %s' % btns)
        # tidak ada bot yang terus jalan
        await asyncio.sleep(3)
        check(await page.evaluate("() => window.__S.roomData.status === 'finished'"), 'B: tetap selesai (bot tidak lanjut bermain)')
        check(not errs, 'tanpa galat JS: ' + '; '.join(errs[:4]))
        await b.close()
    print('LULUS' if all(results) else 'ADA YANG GAGAL', sum(results), '/', len(results))

asyncio.run(main())
