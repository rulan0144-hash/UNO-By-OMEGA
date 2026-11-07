import { BACK_SRC, COLOR_NAMES, imgTag, getScale } from './config.js';
import { S } from './state.js';
import { generateCardHTML, pileRot, renderGame } from './ui.js';

// Semua animasi permainan. Dipicu oleh daftar peristiwa (state.fx) yang dicatat di rules.js,
// jadi semua pemain online melihat animasi yang sama.

const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise(r => setTimeout(r, reduce ? 0 : ms));
const rnd = (a) => (Math.random() * 2 - 1) * a;
const BACK = `<div class="uno-card">${imgTag(BACK_SRC)}</div>`;
const HEX = { Red: '#ef4444', Green: '#22c55e', Blue: '#3b82f6', Yellow: '#eab308' };

// Gambar efek (PNG) ada di img/effects/
const BANNERS = {
    uno:     { img: 'uno' },
    skip:    { img: 'skip' },
    reverse: { img: 'reverse' },
    draw2:   { img: 'draw2' },
    draw4:   { img: 'draw4' },
    shuffle: { img: 'shuffle' }
};

let queue = Promise.resolve();
let pending = 0;
export const whenIdle = () => queue;
export const isBusy = () => pending > 0;   // true selama ada animasi berjalan/antre

// ---- Penahan tampilan: kartu baru baru "muncul" setelah animasinya berjalan ----
// transit = kartu yang sedang dalam perjalanan ke pemain (belum boleh terlihat)
// frozenHand / shuffleCounts = kartu lama yang tetap ditampilkan sampai animasi Acak mengumpulkannya
const hold = { transitMe: 0, transit: {}, frozenHand: null, shuffleCounts: null };
let seenHand = null, seenCounts = {}, cur = null;
export const frozenHand = () => hold.frozenHand;

export function shownCount(uid, actual) {
    if (hold.shuffleCounts && hold.shuffleCounts[uid] !== undefined) return hold.shuffleCounts[uid];
    return Math.max(0, actual - (hold.transit[uid] || 0));
}

// Sembunyikan kartu di tangan yang belum "tiba"
export function applyHold() {
    const hand = $('human-hand-ui');
    if (!hand) return;
    const kids = [...hand.children];
    const hideFrom = hold.frozenHand ? kids.length : kids.length - hold.transitMe;
    kids.forEach((k, i) => { k.style.visibility = i >= hideFrom ? 'hidden' : ''; });
}

// Satu kartu sudah tiba di tujuan
function land(uid) {
    if (!cur) return;
    if (uid === S.currentUser?.uid) {
        if (hold.transitMe > 0) hold.transitMe--;
        cur.me--;
        applyHold();
    } else {
        hold.transit[uid] = Math.max(0, (hold.transit[uid] || 0) - 1);
        cur.opp[uid] = (cur.opp[uid] || 0) - 1;
        if (S.roomData) renderGame();
    }
}

// Daftar animasi selesai: lepas semua penahan yang tersisa
function finish(c) {
    hold.transitMe = Math.max(0, hold.transitMe - Math.max(0, c.me));
    Object.keys(c.opp).forEach(u => { hold.transit[u] = Math.max(0, (hold.transit[u] || 0) - Math.max(0, c.opp[u])); });
    if (c.shuffle) { hold.frozenHand = null; hold.shuffleCounts = null; }
    restore();
}

function rectOf(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
}
const center = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
const clampRect = (r) => r && { ...r, left: Math.max(0, Math.min(r.left, window.innerWidth - r.width)) };

function discardRect() {
    const d = $('discard-pile-ui');
    return rectOf((d && d.firstElementChild) || d);
}

function posOfPlayer(uid) {
    if (uid === S.currentUser?.uid) {
        const h = rectOf($('human-hand-ui'));
        const k = getScale();
        return h && { left: h.left + h.width / 2 - 40 * k, top: h.top + 4, width: 80 * k, height: 116 * k };
    }
    return rectOf($('stack-' + uid));
}

// Kartu terbang dari rect "from" ke rect "to"
function fly(html, from, to, { dur = 700, delay = 0, rot = 0 } = {}) {
    if (reduce || !from || !to) return Promise.resolve();
    const el = document.createElement('div');
    el.className = 'fly-card';
    el.innerHTML = html;
    const a = center(from), b = center(to);
    el.style.left = (a.x - 40) + 'px';
    el.style.top = (a.y - 58) + 'px';
    document.body.appendChild(el);
    const anim = el.animate([
        { transform: `translate(0px,0px) scale(${from.width / 80}) rotate(0deg)` },
        { transform: `translate(${b.x - a.x}px,${b.y - a.y}px) scale(${to.width / 80}) rotate(${rot}deg)` }
    ], { duration: dur, delay, easing: 'cubic-bezier(.25,.7,.25,1)', fill: 'both' });
    return anim.finished.catch(() => {}).then(() => el.remove());
}

function faceHTML(card) {
    return `<div class="uno-card">${generateCardHTML(card)}</div>`;
}

// Layar berkedip dengan warna yang dipilih
function flash(color) {
    const f = $('fx-flash');
    if (!f || reduce) return;
    f.style.background = HEX[color] || '#fff';
    f.classList.remove('on');
    void f.offsetWidth;
    f.classList.add('on');
    setTimeout(() => f.classList.remove('on'), 1100);
}

// Gambar besar di tengah layar (UNO!, Skip, Reverse, +2, +4, Acak)
async function banner(k, uid, ev) {
    const b = BANNERS[k];
    if (!b) return;
    const el = document.createElement('div');
    el.className = 'fx-img-banner';
    el.innerHTML = `<img src="img/effects/${b.img}.png" alt="">`;
    const p = uid && S.roomData?.players.find(x => x.uid === uid);
    if (p) { const s = document.createElement('small'); s.textContent = p.name; el.appendChild(s); }
    document.body.appendChild(el);
    setTimeout(() => el.remove(), reduce ? 0 : 1600);
    await sleep(k === 'uno' ? 1500 : 1300);
}

// Pemilih warna Wild: empat balok berputar, lalu warna pilihan menonjol
async function wildPicker(color) {
    const el = document.createElement('div');
    el.className = 'fx-picker';
    el.innerHTML = '<img class="fx-picker-img fx-picker-spin" src="img/effects/wild-spin.png" alt=""><div class="fx-picker-name"></div>';
    document.body.appendChild(el);
    await sleep(900);
    const img = el.querySelector('img');
    img.classList.remove('fx-picker-spin');
    img.src = `img/effects/wild-${color}.png`;
    img.classList.add('fx-picker-pop');
    const name = el.querySelector('.fx-picker-name');
    name.textContent = COLOR_NAMES[color] || color;
    name.className = 'fx-picker-name fx-pn-' + color;
    await sleep(1100);
    el.classList.add('fx-picker-out');
    setTimeout(() => el.remove(), reduce ? 0 : 400);
    await sleep(350);
}

// Hasil tantangan +4: BENAR / SALAH
async function challengeFx(ev) {
    const el = document.createElement('div');
    el.className = 'fx-banner ' + (ev.ok ? 'fx-ok' : 'fx-fail');
    el.innerHTML = `<span>${ev.ok ? 'BENAR!' : 'SALAH!'}</span>`;
    const p = S.roomData?.players.find(x => x.uid === ev.by);
    const t = S.roomData?.players.find(x => x.uid === ev.target);
    if (p && t) { const s = document.createElement('small'); s.textContent = `${p.name} menantang ${t.name}`; el.appendChild(s); }
    document.body.appendChild(el);
    setTimeout(() => el.remove(), reduce ? 0 : 1600);
    await sleep(1400);
}

// Palu kayu menghantam profil pemain yang lupa UNO
async function hammer(uid) {
    const mine = uid === S.currentUser?.uid;
    const target = mine ? $('human-hand-ui') : $('prof-' + uid);
    const r = rectOf(target) || { left: window.innerWidth / 2 - 40, top: window.innerHeight / 2, width: 80, height: 80 };
    const cx = r.left + r.width / 2;
    const h = document.createElement('div');
    h.className = 'fx-hammer'; h.innerHTML = '<img src="img/effects/hammer.png" alt="">';
    h.style.left = (cx - 46) + 'px'; h.style.top = (r.top - 80) + 'px';
    const b = document.createElement('div');
    b.className = 'fx-boom'; b.innerHTML = '<img src="img/effects/boom.png" alt="">';
    b.style.left = (cx - 42) + 'px'; b.style.top = (r.top - 8) + 'px';
    document.body.append(h, b);
    setTimeout(() => target && target.classList.add('fx-shake'), reduce ? 0 : 930);
    setTimeout(() => { h.remove(); b.remove(); target && target.classList.remove('fx-shake'); }, reduce ? 0 : 1600);
    await sleep(1600);
}

// Kartu dimainkan: terbang ke tumpukan buangan (kartu di bawahnya tetap terlihat)
async function play(ev) {
    const mine = ev.uid === S.currentUser?.uid;
    const from = (mine && S.pendingFrom) || posOfPlayer(ev.uid);
    if (mine) S.pendingFrom = null;
    const top = document.querySelector('.pile-top');
    if (top) top.style.visibility = 'hidden';
    const n = S.roomData?.gameState.discardPile.length || 1;
    await fly(faceHTML(ev.card), from, discardRect(), { dur: 700, rot: pileRot(n - 1) });
    if (top) top.style.visibility = '';
    if (ev.card.color === 'Black') flash(ev.color);
}

// Kartu ditarik: terbang dari tumpukan ke tangan / profil pemain, kartu baru muncul saat tiba
async function draw({ uid, n }) {
    const deck = rectOf($('draw-pile-ui'));
    const count = Math.min(n, 6);
    const mine = uid === S.currentUser?.uid;
    const kids = mine ? [...$('human-hand-ui').children] : [];
    const jobs = [];
    for (let i = 0; i < count; i++) {
        const to = mine ? (clampRect(rectOf(kids[kids.length - n + i])) || posOfPlayer(uid)) : posOfPlayer(uid);
        jobs.push(fly(BACK, deck, to, { delay: i * 220 }).then(() => land(uid)));
    }
    await Promise.all(jobs);
}

// Awal permainan: kartu dibagikan satu per satu
async function deal(state) {
    const deck = rectOf($('draw-pile-ui'));
    const me = S.currentUser?.uid;
    const pile = $('discard-pile-ui');
    if (pile) pile.style.visibility = 'hidden';
    const hand = [...$('human-hand-ui').children];
    hand.forEach(k => { k.style.visibility = 'hidden'; });
    const jobs = [];
    hand.forEach((k, i) => jobs.push(
        fly(BACK, deck, clampRect(rectOf(k)), { dur: 650, delay: i * 170 }).then(() => { k.style.visibility = ''; })
    ));
    Object.keys(state.hands).filter(u => u !== me).forEach((u, pi) => {
        const to = posOfPlayer(u);
        for (let i = 0; i < Math.min(state.hands[u].length, 7); i++) jobs.push(fly(BACK, deck, to, { dur: 650, delay: i * 170 + pi * 70 }));
    });
    await Promise.all(jobs);
    if (pile) { pile.style.visibility = ''; pile.classList.add('fx-pop-in'); setTimeout(() => pile.classList.remove('fx-pop-in'), 500); }
}

// Kartu Acak: tangan lama dikumpulkan ke tengah, dikocok, lalu kartu baru dibagikan satu per satu
async function shuffleAnim(state) {
    const me = S.currentUser?.uid;
    const dk = rectOf($('draw-pile-ui'));
    if (!dk) return;
    const d = center(dk), p = center(discardRect() || dk);
    const mid = { left: (d.x + p.x) / 2 - 40, top: (d.y + p.y) / 2 - 58, width: 80, height: 116 };
    const jitter = () => ({ ...mid, left: mid.left + rnd(16), top: mid.top + rnd(12) });

    // daftar kartu yang sedang terlihat di layar, lalu disembunyikan (digantikan kartu terbang)
    const collect = () => {
        const items = [];
        const kids = [...$('human-hand-ui').children];
        kids.slice(0, 10).forEach(k => items.push({ rect: clampRect(rectOf(k)), el: k, mine: true }));
        kids.forEach(k => { k.style.visibility = 'hidden'; });
        Object.keys(state.hands).filter(u => u !== me).forEach(u => {
            const st = $('stack-' + u);
            if (!st) return;
            const r = rectOf(st);
            const n = Math.min(shownCount(u, state.hands[u].length), 4);
            for (let i = 0; i < n; i++) items.push({ rect: r, el: st });
            st.style.visibility = 'hidden';
        });
        return items;
    };

    // 1. kumpulkan kartu lama ke tengah
    const out = collect();
    await Promise.all(out.map((it, i) => fly(BACK, it.rect, jitter(), { dur: 800, delay: (i % 12) * 80, rot: rnd(24) })));

    // 2. kocok
    const g = document.createElement('div');
    g.className = 'fx-riffle-group';
    g.style.left = (mid.left + 40) + 'px';
    g.style.top = (mid.top + 58) + 'px';
    for (let i = 0; i < 6; i++) {
        const c = document.createElement('div');
        c.className = 'fx-riffle-card';
        c.style.animationDelay = (i * 90) + 'ms';
        c.innerHTML = BACK;
        g.appendChild(c);
    }
    document.body.appendChild(g);
    await sleep(2000);
    g.remove();

    // 3. tampilkan tangan baru (tersembunyi), lalu bagikan: kartu muncul saat tiba
    hold.frozenHand = null;
    hold.shuffleCounts = null;
    if (S.roomData) renderGame();
    const back = collect();
    await Promise.all(back.map((it, i) => fly(BACK, jitter(), it.rect, { dur: 800, delay: (i % 12) * 80, rot: rnd(24) })
        .then(() => { if (it.mine) it.el.style.visibility = ''; })));
}

function restore() {
    const pile = $('discard-pile-ui');
    if (pile) pile.style.visibility = '';
    const top = document.querySelector('.pile-top');
    if (top) top.style.visibility = '';
    if (S.roomData && S.roomData.gameState) renderGame();   // tampilan akhir sesuai state sebenarnya
}

// Kartu "bayangan" yang diam di posisi asal selama efeknya tampil (kartu belum diletakkan)
function ghostCard(ev) {
    const mine = ev.uid === S.currentUser?.uid;
    const from = (mine && S.pendingFrom) || posOfPlayer(ev.uid);
    if (!from) return null;
    const el = document.createElement('div');
    el.className = 'fly-card';
    el.innerHTML = mine ? faceHTML(ev.card) : BACK;   // kartu lawan baru menghadap depan setelah efek
    const a = center(from);
    el.style.left = (a.x - 40) + 'px';
    el.style.top = (a.y - 58) + 'px';
    el.style.transform = `scale(${from.width / 80})`;
    document.body.appendChild(el);
    return el;
}

// Urutan tampil: efek kartu (banner / pemilih warna) dulu, baru kartunya diletakkan.
// Mengembalikan daftar baru; peristiwa 'play' yang didahului efek diberi tanda preFx.
function effectsFirst(list) {
    const out = [];
    for (let i = 0; i < list.length; i++) {
        const ev = list[i];
        if (ev.t !== 'play') { out.push(ev); continue; }
        let k = i + 1;
        const pre = [], between = [];
        while (k < list.length && list[k].t === 'picker') pre.push(list[k++]);
        while (k < list.length && list[k].t === 'uno') between.push(list[k++]);   // UNO bisa terselip
        while (k < list.length && list[k].t === 'banner') pre.push(list[k++]);
        out.push(...pre, { ...ev, preFx: pre.length > 0 }, ...between);
        i = k - 1;
    }
    return out;
}

async function run(list, state, c) {
    cur = c;
    let ghost = null;
    const ordered = effectsFirst(list);
    for (let i = 0; i < ordered.length; i++) {
        const ev = ordered[i];
        // Efek tampil lebih dulu: kartu belum diletakkan, jadi tahan kartu bayangan di posisi asal
        if (!ghost && (ev.t === 'picker' || ev.t === 'banner')) {
            const pl = ordered.slice(i).find(e => e.t === 'play' && e.preFx);
            const between = ordered.slice(0, i).some(e => e.t === 'play');   // efek sesudah kartu (mis. banner tanpa pre)
            if (pl && !between) {
                const top = document.querySelector('.pile-top');
                if (top) top.style.visibility = 'hidden';
                ghost = ghostCard(pl);
            }
        }
        if (ev.t === 'play' && ghost) { ghost.remove(); ghost = null; }
        if (ev.t === 'deal') await deal(state);
        else if (ev.t === 'play') await play(ev);
        else if (ev.t === 'banner') await banner(ev.k, undefined, ev);
        else if (ev.t === 'shuffle') await shuffleAnim(state);
        else if (ev.t === 'picker') await wildPicker(ev.color);
        else if (ev.t === 'challenge') await challengeFx(ev);
        else if (ev.t === 'uno') await banner('uno', ev.uid);
        else if (ev.t === 'catch') await hammer(ev.uid);
        else if (ev.t === 'draw') await draw(ev);
        await sleep(150);   // jeda singkat antar animasi
    }
    if (ghost) ghost.remove();
}

// Dipanggil di awal renderGame(); memutar animasi baru satu kali saja
export function handleFx(state) {
    const me = S.currentUser?.uid;
    const prevHand = seenHand, prevCounts = seenCounts;
    seenHand = (state.hands[me] || []).slice();
    seenCounts = {};
    Object.keys(state.hands).forEach(u => { seenCounts[u] = state.hands[u].length; });

    const f = state.fx;
    if (!f || !f.list) return;
    if (S.fxRoom !== S.currentRoomCode) { S.fxRoom = S.currentRoomCode; S.lastFxId = null; }
    if (S.lastFxId === f.id) return;
    const firstRender = S.lastFxId === null;
    S.lastFxId = f.id;
    // Masuk ke game yang sedang berjalan: jangan putar animasi lama
    if (firstRender && !f.list.some(e => e.t === 'deal')) return;

    // Tahan tampilan kartu yang akan datang sampai animasinya berjalan
    const c = { me: 0, opp: {}, shuffle: false };
    f.list.forEach(ev => {
        if (ev.t === 'draw') {
            if (ev.uid === me) { hold.transitMe += ev.n; c.me += ev.n; }
            else { hold.transit[ev.uid] = (hold.transit[ev.uid] || 0) + ev.n; c.opp[ev.uid] = (c.opp[ev.uid] || 0) + ev.n; }
        } else if (ev.t === 'shuffle') {
            c.shuffle = true;
            hold.frozenHand = prevHand;
            hold.shuffleCounts = { ...prevCounts };
        }
    });

    pending++;
    queue = queue
        .then(() => Promise.race([run(f.list, state, c), new Promise(r => setTimeout(r, 25000))]))  // pengaman anti macet
        .catch(e => console.error('fx', e))
        .then(() => { finish(c); pending--; });
}
