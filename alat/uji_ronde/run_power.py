import asyncio, sys, json
sys.path.insert(0, '../uji_online_flex')
from playwright.async_api import async_playwright
from fake_modules import APP_JS, AUTH_JS, FS_JS
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True)
        await ctx.add_init_script("window.__uid='local-me'; localStorage.setItem('uno_name','Ana'); localStorage.setItem('uno_tab','offline');")
        async def route(r):
            u = r.request.url
            if u.startswith('http://localhost'): return await r.continue_()
            if 'firebase-app.js' in u: return await r.fulfill(body=APP_JS, content_type='text/javascript')
            if 'firebase-auth.js' in u: return await r.fulfill(body=AUTH_JS, content_type='text/javascript')
            if 'firebase-firestore.js' in u: return await r.fulfill(body=FS_JS, content_type='text/javascript')
            if 'tailwind' in u: return await r.fulfill(body='var s=document.createElement("style");s.textContent=".hidden{display:none!important}";document.head.appendChild(s);', content_type='text/javascript')
            return await r.fulfill(body='', content_type='text/css')
        await ctx.route('**/*', route)
        p = await ctx.new_page(); errs=[]
        p.on('pageerror', lambda e: errs.append(str(e)))
        await p.goto('http://localhost:8765/index.html')
        await p.wait_for_function("() => !document.getElementById('home-screen').classList.contains('hidden')")
        await p.evaluate("() => playMode('flex')"); await p.evaluate("() => { chooseRounds(1); startRounds(); }")
        await p.wait_for_function("() => document.querySelectorAll('#x-opps .opp-power').length === 3", timeout=30000)
        await asyncio.sleep(8)
        r = await p.evaluate("""async () => {
          const { S } = await import('./js/core/state.js'); const A = await import('./js/modes/flex/actions.js');
          S.paused = true; clearTimeout(S.botTimer);
          const me = 'local-me', opp = S.roomData.players.filter(x => x.uid !== me).map(x => x.uid);
          const s = JSON.parse(JSON.stringify(S.roomData.gameState));
          s.power[opp[0]] = false; s.fx = { id: 'p' + Math.random(), list: [{ t: 'power', cause: 'flip', changes: { [opp[0]]: false } }] };
          A.updateRemoteState(s, {});
          const seen = new Set();
          for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 60)); document.querySelectorAll('#x-opps .opp-power.pw-pop').forEach(e => seen.add(e.closest('[id^=xstack-]').id)); }
          return { changed: 'xstack-' + opp[0], seen: [...seen], srcs: [...document.querySelectorAll('#x-opps .opp-power')].map(e => e.getAttribute('src').split('/').pop()) };
        }""")
        print(json.dumps(r)); print('errors', errs)
        await b.close()
asyncio.run(main())
