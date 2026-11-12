import asyncio, sys
sys.path.insert(0, '../uji_online_flex')
from playwright.async_api import async_playwright
from fake_modules import APP_JS, AUTH_JS, FS_JS
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        ctx = await b.new_context(viewport={'width': 360, 'height': 640}, has_touch=True)
        await ctx.add_init_script("window.__uid='local-me'; localStorage.setItem('uno_name','Ana'); localStorage.setItem('uno_tab','offline'); localStorage.setItem('uno_bots_classic','6');")
        async def route(r):
            u = r.request.url
            if u.startswith('http://localhost'): return await r.continue_()
            if 'firebase-app.js' in u: return await r.fulfill(body=APP_JS, content_type='text/javascript')
            if 'firebase-auth.js' in u: return await r.fulfill(body=AUTH_JS, content_type='text/javascript')
            if 'firebase-firestore.js' in u: return await r.fulfill(body=FS_JS, content_type='text/javascript')
            if 'tailwind' in u: return await r.fulfill(body='var s=document.createElement("style");s.textContent=".hidden{display:none!important}";document.head.appendChild(s);', content_type='text/javascript')
            return await r.fulfill(body='', content_type='text/css')
        await ctx.route('**/*', route)
        p = await ctx.new_page(); await p.goto('http://localhost:8765/index.html')
        await p.wait_for_function("() => !document.getElementById('home-screen').classList.contains('hidden')")
        await p.evaluate("async () => { window.__S = (await import('./js/core/state.js')).S; }")
        await p.evaluate("() => playMode('classic')"); await asyncio.sleep(0.4)
        await p.screenshot(path='/tmp/s1_round.png')
        await p.evaluate("() => { chooseRounds(5); startRounds(); }")
        await p.wait_for_function("() => window.__S.roomData && window.__S.roomData.status === 'playing'"); await asyncio.sleep(7)
        await p.evaluate("() => { const S = window.__S; S.series.round = 5; S.series.history = [{w:'local-me',p:80},{w:'bot1',p:55},{w:'bot2',p:40},{w:'local-me',p:61}]; }")
        await p.evaluate("""async () => { const { S } = await import('./js/core/state.js'); const A = await import('./js/modes/classic/actions.js');
          const s = JSON.parse(JSON.stringify(S.roomData.gameState)); s.fx = {id:'z'+Math.random(), list:[]}; s.winner = 'bot3'; s.hands['bot3'] = []; A.updateRemoteState(s, {status:'finished'}); }""")
        await p.wait_for_function("() => !document.getElementById('game-over-modal').classList.contains('hidden')", timeout=40000)
        await p.screenshot(path='/tmp/s2_over.png')
        r = await p.evaluate("() => { const b=[...document.querySelectorAll('#over-actions button')].map(x=>{const r=x.getBoundingClientRect(); return [x.textContent, Math.round(r.top), Math.round(r.bottom)]}); const box=document.querySelector('#game-over-modal > div'); return JSON.stringify({b, scrollH: box.scrollHeight, clientH: box.clientHeight, vh: innerHeight}); }")
        print(r)
        await b.close()
asyncio.run(main())
