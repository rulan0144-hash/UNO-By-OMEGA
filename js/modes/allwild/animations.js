import { getScale } from '../../core/config.js';
import { S } from '../../core/state.js';
import { backSrc } from './deck.js';
import { generateCardHTML, paintColor, pileRot, renderGame } from './ui.js';
import { sfx } from '../../core/sound.js';
import { runCountdown } from '../../core/countdown.js';

// Semua animasi permainan All Wild. Dipicu oleh daftar peristiwa (state.fx) yang dicatat di rules.js.
// Peristiwa: deal, play, draw, banner, swap, uno, catch. (Tidak ada lagi efek ganti warna Wild di tengah layar: meja berwarna yang menunjukkan warna.)

const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise(r => setTimeout(r, reduce ? 0 : ms));

let queue = Promise.resolve();
let pending = 0;
export const whenIdle = () => queue;
export const isBusy = () => pending > 0;   // true selama ada animasi berjalan/antre

// ---- Penahan tampilan ----
// transit = kartu dalam perjalanan ke pemain (belum boleh terlihat); pile = kartu yang akan diletakkan.
// swap = animasi Forced Swap: tangan LAMA kedua pemain ditampilkan sampai kartu selesai bertukar; colorFrom = warna meja lama sampai kartu mendarat.
const hold = { transitMe: 0, transit: {}, pile: 0, swap: null, colorFrom: null };
let lastFxId = null, cur = null;
const inAw = () => !!S.roomData && S.roomData.mode === 'allwild';

export function shownCount(uid, actual) {
    const sw = hold.swap && hold.swap.hands[uid];
    return Math.max(0, (sw ? sw.length : actual) - (hold.transit[uid] || 0));
}
export function shownHand(uid, actual) { return (hold.swap && !hold.swap.meDone && hold.swap.hands[uid]) || actual; }
export const heldColor = () => hold.colorFrom;

export function applyHold() {
    const hand = $('w-hand');
    if (!hand) return;
    const kids = [...hand.children];
    const hideFrom = kids.length - hold.transitMe;
    kids.forEach((k, i) => { k.style.visibility = i >= hideFrom ? 'hidden' : ''; });
    const pt = document.querySelector('#w-discard .pile-top');
    if (pt && hold.pile > 0) pt.style.visibility = 'hidden';
}

function land(uid) {
    if (!cur) return;
    if (uid === S.currentUser?.uid) {
        if (hold.transitMe > 0) hold.transitMe--;
        cur.me--;
        applyHold();
    } else {
        hold.transit[uid] = Math.max(0, (hold.transit[uid] || 0) - 1);
        cur.opp[uid] = (cur.opp[uid] || 0) - 1;
        if (inAw()) renderGame();
    }
}

function finish(c) {
    hold.transitMe = Math.max(0, hold.transitMe - Math.max(0, c.me));
    Object.keys(c.opp).forEach(u => { hold.transit[u] = Math.max(0, (hold.transit[u] || 0) - Math.max(0, c.opp[u])); });
    hold.pile = Math.max(0, hold.pile - Math.max(0, c.plays || 0));
    if (c.swap) hold.swap = null;
    hold.colorFrom = null;
    restore();
}

function rectOf(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (el.classList && el.classList.contains('fan-card')) {   // kartu di tangan (diputar): pakai ukuran asli
        const w = el.offsetWidth, h = el.offsetHeight;
        return { left: r.left + r.width / 2 - w / 2, top: r.top + r.height / 2 - h / 2, width: w, height: h };
    }
    return { left: r.left, top: r.top, width: r.width, height: r.height };
}
const center = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
const clampRect = (r) => r && { ...r, left: Math.max(0, Math.min(r.left, window.innerWidth - r.width)) };

function discardRect() {
    const d = $('w-discard');
    return rectOf((d && d.firstElementChild) || d);
}

function posOfPlayer(uid) {
    if (uid === S.currentUser?.uid) {
        const h = rectOf($('w-hand'));
        const k = getScale();
        return h && { left: h.left + h.width / 2 - 40 * k, top: h.top + 4, width: 80 * k, height: 116 * k };
    }
    return rectOf($('wstack-' + uid));
}

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

const cardEl = (card) => `<div class="uno-card">${generateCardHTML(card)}</div>`;
const backEl = () => `<div class="uno-card"><img class="card-img" src="${backSrc()}" alt="" draggable="false"></div>`;

// Gambar besar di tengah layar. Berkas: img/allwild/fx/<jenis>-<Warna>.png (UNO! memakai img/effects/uno.png)
const SND = { uno: 'uno', skip: 'skip', skip2: 'skip2', reverse: 'reverse', draw2: 'draw2', draw4: 'draw4', target2: 'awtarget2', swap: 'swap' };
async function banner(ev) {
    const k = ev.k;
    sfx(SND[k] || k);
    const el = document.createElement('div');
    el.className = 'fx-img-banner';
    const src = k === 'uno' ? 'img/effects/uno.png' : `img/allwild/fx/${k}-${ev.c}.png`;
    el.innerHTML = `<img src="${src}" alt="">`;
    const tUid = ev.target || ev.uid;
    const p = tUid && S.roomData?.players.find(x => x.uid === tUid);
    if (p) { const s = document.createElement('small'); s.textContent = p.name; el.appendChild(s); }
    document.body.appendChild(el);
    setTimeout(() => el.remove(), reduce ? 0 : 1600);
    await sleep(k === 'uno' ? 1500 : 1300);
}

// Palu terbang dari tombol UNO kecil (atau dari profil penangkap) ke pemain yang lupa UNO, lalu menghantam
async function hammer(ev) {
    const uid = ev.uid, by = ev.by;
    const mine = uid === S.currentUser?.uid;
    const target = mine ? $('w-hand') : $('wprof-' + uid);
    const r = rectOf(target) || { left: window.innerWidth / 2 - 40, top: window.innerHeight / 2, width: 80, height: 80 };
    const cx = r.left + r.width / 2;
    const byMe = by === S.currentUser?.uid;
    const btn = byMe ? $('w-btn-catch') : null;
    const src = rectOf(btn) || rectOf($('wprof-' + by)) || { left: window.innerWidth - 90, top: window.innerHeight * 0.6, width: 56, height: 56 };
    const sx = src.left + src.width / 2, sy = src.top + src.height / 2;
    const hx = cx, hy = Math.max(r.top - 34, 46);   // pusat palu saat siap mengayun (tetap terlihat walau lawan di baris atas)
    const dx = hx - sx, dy = hy - sy;
    const h = document.createElement('div');
    h.className = 'fx-hammer fx-hammer-fly'; h.innerHTML = '<img src="img/effects/hammer.png" alt="">';
    h.style.left = (sx - 46) + 'px'; h.style.top = (sy - 46) + 'px';
    const b = document.createElement('div');
    b.className = 'fx-boom'; b.innerHTML = '<img src="img/effects/boom.png" alt="">';
    b.style.left = (cx - 42) + 'px'; b.style.top = (r.top - 8) + 'px';
    b.style.animation = 'none';
    document.body.append(h, b);
    if (btn) { btn.classList.add('catch-press'); setTimeout(() => btn.classList.remove('catch-press'), reduce ? 0 : 500); }
    const TOTAL = reduce ? 10 : 2000, HIT = reduce ? 0 : 880;
    const kf = (o, tx, ty, rot, sc, op) => ({ offset: o, transform: `translate(${tx}px,${ty}px) rotate(${rot}deg) scale(${sc})`, opacity: op });
    sfx('swing');
    h.animate([
        kf(0, 0, 0, -20, .5, 0), kf(.06, dx * .1, dy * .1, -25, .65, 1), kf(.30, dx, dy, -45, 1.05, 1), kf(.38, dx, dy - 8, -56, 1.05, 1),
        kf(.44, dx, dy + 48, 14, 1.05, 1), kf(.75, dx, dy + 48, 14, 1, 1), kf(1, dx, dy + 48, 14, 1, 0)
    ], { duration: TOTAL, easing: 'ease-in-out', fill: 'both' });
    sfx('catch', reduce ? 0 : HIT / 1000);
    setTimeout(() => { b.style.animation = 'fx-boom .7s ease-out forwards'; target && target.classList.add('fx-shake'); }, HIT);
    setTimeout(() => { h.remove(); b.remove(); target && target.classList.remove('fx-shake'); }, TOTAL);
    await sleep(TOTAL);
}

// Terbang melengkung (busur) dari satu titik ke titik lain; dua rombongan dengan arah berlawanan saling berpapasan
function flyArc(html, from, to, { dur = 900, delay = 0, bend = 60, rot = 0 } = {}) {
    if (reduce || !from || !to) return Promise.resolve();
    const el = document.createElement('div');
    el.className = 'fly-card';
    el.innerHTML = html;
    const a = center(from), b = center(to);
    el.style.left = (a.x - 40) + 'px';
    el.style.top = (a.y - 58) + 'px';
    document.body.appendChild(el);
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    const mx = dx / 2 + (-dy / d) * bend, my = dy / 2 + (dx / d) * bend;       // titik tengah digeser tegak lurus -> busur
    const s0 = from.width / 80, s1 = to.width / 80, sm = Math.max(.8, (s0 + s1) / 2);
    const anim = el.animate([
        { transform: `translate(0px,0px) scale(${s0}) rotate(0deg)`, offset: 0 },
        { transform: `translate(${mx}px,${my}px) scale(${sm}) rotate(${rot / 2}deg)`, offset: .5 },
        { transform: `translate(${dx}px,${dy}px) scale(${s1}) rotate(${rot}deg)`, offset: 1 }
    ], { duration: dur, delay, easing: 'ease-in-out', fill: 'both' });
    return anim.finished.catch(() => {}).then(() => el.remove());
}

// Forced Swap: dua pemain saling bertukar tangan. Punggung kartu terbang melengkung dari tangan A ke B dan dari B ke A (saling berpapasan);
// kedua pemain menyala, ikon tukar berputar di antara mereka. Selama itu tampilan memegang tangan LAMA (hold.swap), baru berganti di akhir.
async function swap(ev) {
    const sw = hold.swap;
    const A = ev.a, B = ev.b, me = S.currentUser?.uid;
    sfx('swap');
    const ring = (uid) => uid === me ? $('w-me-avatar') : $('wprof-' + uid);
    const pA = posOfPlayer(A), pB = posOfPlayer(B);
    const nA = sw ? sw.hands[A].length : 0, nB = sw ? sw.hands[B].length : 0;
    const MAXC = 5, GAP = 130, DUR = 950;
    const kidsOf = (uid) => uid === me ? [...$('w-hand').children] : [];
    const launch = (uid, n, from, to, bendSign) => {
        const kids = kidsOf(uid), k = Math.min(kids.length ? 8 : MAXC, n), out = [];   // tangan sendiri: tiap kartu terbang satu per satu
        const dist = from && to ? Math.hypot(center(from).x - center(to).x, center(from).y - center(to).y) : 0;
        const bend = bendSign * Math.min(110, Math.max(40, dist * 0.28));
        for (let i = 0; i < k; i++) {
            const kid = kids.length ? kids[Math.round(i * (kids.length - 1) / Math.max(1, k - 1))] : null;
            const start = kid ? (clampRect(rectOf(kid)) || from) : from;
            const delay = i * (kids.length ? 100 : GAP);
            if (kid) setTimeout(() => { kid.style.visibility = 'hidden'; }, reduce ? 0 : delay);   // kartu meninggalkan tangan saat terbang
            out.push(flyArc(backEl(), start, to, { dur: DUR, delay, bend, rot: (i % 2 ? 1 : -1) * (14 + i * 4) * bendSign }));
        }
        return out;
    };
    // badge ikon tukar di tengah antara dua pemain
    let badge = null;
    if (!reduce && pA && pB) {
        const a = center(pA), b = center(pB);
        badge = document.createElement('div');
        badge.className = 'aw-swap-badge';
        badge.style.left = ((a.x + b.x) / 2 - 42) + 'px';
        badge.style.top = ((a.y + b.y) / 2 - 42) + 'px';
        badge.innerHTML = `<img src="img/allwild/fx/swap-${ev.c || 'Blue'}.png" alt="">`;
        document.body.appendChild(badge);
    }
    [A, B].forEach(u => { const r = ring(u); if (r) r.classList.add('aw-swap-glow'); });
    const meIn = A === me || B === me, other = A === me ? B : A;
    let jobs;
    if (!meIn) jobs = [...launch(A, nA, pA, pB, 1), ...launch(B, nB, pB, pA, 1)];
    else {
        // Tangan sendiri: kartu hilang dari tangan tepat saat terbang ke tengah; kartu baru MUNCUL di tangan tepat saat kartunya mendarat.
        const pO = posOfPlayer(other), nOut = sw ? sw.hands[me].length : 0, nIn = sw ? sw.hands[other].length : 0;
        const out = launch(me, nOut, posOfPlayer(me), pO, 1);
        const incoming = (async () => {
            await sleep(Math.max(0, Math.min(nOut, 8) - 1) * 100 + 60);          // semua kartu lama sudah berangkat
            [...$('w-hand').children].forEach(k => { k.style.visibility = 'hidden'; });
            hold.swap.meDone = true;                                              // tampilan tangan = tangan baru (semua kartu disembunyikan dulu)
            if (inAw() && S.roomData.gameState) renderGame();
            [A, B].forEach(u => { const r = ring(u); if (r) r.classList.add('aw-swap-glow'); });   // renderGame membangun ulang profil lawan
            const nk = [...$('w-hand').children];
            nk.forEach(k => { k.style.visibility = 'hidden'; });
            const k = Math.min(8, nk.length), land = [];
            for (let i = 0; i < k; i++) {
                const upTo = i === k - 1 ? nk.length - 1 : Math.round(i * (nk.length - 1) / Math.max(1, k - 1));
                const to = clampRect(rectOf(nk[upTo])) || posOfPlayer(me);
                land.push(flyArc(backEl(), pO, to, { dur: 850, delay: i * 110, bend: -50, rot: (i % 2 ? 1 : -1) * 12 }).then(() => {
                    for (let x = (i ? Math.round((i - 1) * (nk.length - 1) / Math.max(1, k - 1)) + 1 : 0); x <= upTo; x++) { nk[x].style.visibility = ''; nk[x].classList.add('aw-card-in'); }
                    sfx('card');
                }));
            }
            if (!k) land.push(Promise.resolve());
            await Promise.all(land);
            nk.forEach(x => { x.style.visibility = ''; });
        })();
        jobs = [...out, incoming];
    }
    await Promise.all(jobs);
    // selesai: tampilan kembali ke state asli, tumpukan lawan berdenyut
    hold.swap = null;
    if (badge) badge.remove();
    if (inAw() && S.roomData.gameState) renderGame();
    [A, B].forEach(u => {
        const st = $('wstack-' + u);
        if (st && u !== me) { st.classList.add('aw-stack-bump'); setTimeout(() => st.classList.remove('aw-stack-bump'), 600); }
    });
    sfx('slap');
    await sleep(450);
    [A, B].forEach(u => { const r = ring(u); if (r) r.classList.remove('aw-swap-glow'); });
}

// Kartu dimainkan: terbang ke tumpukan buangan (menghadap depan)
async function play(ev) {
    const mine = ev.uid === S.currentUser?.uid;
    const from = (mine && S.pendingFrom) || posOfPlayer(ev.uid);
    if (mine) S.pendingFrom = null;
    const top = document.querySelector('#w-discard .pile-top');
    if (top) top.style.visibility = 'hidden';
    const n = S.roomData?.gameState.discardPile.length || 1;
    sfx('card');
    await fly(cardEl(ev.card), from, discardRect(), { dur: 700, rot: pileRot(n - 1) });
    sfx('slap');
    if (cur) cur.plays = (cur.plays || 0) - 1;
    hold.pile = Math.max(0, hold.pile - 1);
    const t2 = document.querySelector('#w-discard .pile-top');
    if (t2 && hold.pile === 0) t2.style.visibility = '';
    hold.colorFrom = null; paintColor(ev.color);   // meja berganti warna begitu kartu mendarat (tanpa efek di tengah layar)
    sfx('c_' + ev.color);
}

// Kartu ditarik: terbang dari dek (punggung kartu) ke tangan / profil pemain
async function draw({ uid, n, sides, pen }) {
    const deckL = rectOf($('w-draw-l')), deckR = rectOf($('w-draw-r'));
    const count = Math.min(n, 8);
    const mine = uid === S.currentUser?.uid;
    const kids = mine ? [...$('w-hand').children] : [];
    const jobs = [];
    if (pen) sfx('draw2');   // hukuman tantangan salah: +2 tambahan berbunyi "Draw two!"
    const base = kids.length - Math.max(n, cur ? cur.me : n);
    for (let i = 0; i < count; i++) {
        sfx('draw', i * 0.22);
        const to = mine ? (clampRect(rectOf(kids[base + i])) || posOfPlayer(uid)) : posOfPlayer(uid);
        const deck = (sides && sides[i] === 'R') ? deckR : deckL;
        jobs.push(fly(backEl(), deck, to, { delay: i * 220 }).then(() => land(uid)));
    }
    for (let i = count; i < n; i++) land(uid);   // kartu sisa (lebih dari 8) langsung dianggap tiba
    await Promise.all(jobs);
}

// Awal permainan: kartu dibagikan satu per satu dari dua dek (~5 detik, bersama hitung mundur)
async function deal(state) {
    const decks = [rectOf($('w-draw-l')), rectOf($('w-draw-r'))];
    let dk = 0;
    const nextDeck = () => decks[dk++ % 2];
    const me = S.currentUser?.uid;
    const pile = $('w-discard');
    if (pile) pile.style.visibility = 'hidden';
    const hand = [...$('w-hand').children];
    hand.forEach(k => { k.style.visibility = 'hidden'; });
    const order = [me, ...Object.keys(state.hands).filter(u => u !== me)];
    const P = order.length, DUR = 900, TOTAL = reduce ? 0 : 5000;
    const GAP = Math.max(60, (TOTAL - DUR) / (7 * P - 1));
    const jobs = [];
    for (let i = 0; i < 7; i++) order.forEach((u, pi) => {
        const delay = (i * P + pi) * GAP;
        sfx('deal', delay / 1000 + 0.05);
        if (u === me) {
            const k = hand[i];
            if (!k) return;
            jobs.push(fly(backEl(), nextDeck(), clampRect(rectOf(k)), { dur: DUR, delay }).then(() => { k.style.visibility = ''; }));
        } else if (i < state.hands[u].length) {
            jobs.push(fly(backEl(), nextDeck(), posOfPlayer(u), { dur: DUR, delay }));
        }
    });
    await Promise.all(jobs);
    if (pile) { pile.style.visibility = ''; pile.classList.add('fx-pop-in'); setTimeout(() => pile.classList.remove('fx-pop-in'), 500); }
}

function restore() {
    const pile = $('w-discard');
    if (pile) pile.style.visibility = '';
    const top = document.querySelector('#w-discard .pile-top');
    if (top) top.style.visibility = '';
    if (inAw() && S.roomData.gameState) renderGame();
}

// Kartu "bayangan" yang diam di posisi asal selama efeknya tampil (kartu belum diletakkan)
function ghostCard(ev) {
    const mine = ev.uid === S.currentUser?.uid;
    const from = (mine && S.pendingFrom) || posOfPlayer(ev.uid);
    if (!from) return null;
    const el = document.createElement('div');
    el.className = 'fly-card';
    el.innerHTML = mine ? cardEl(ev.card) : backEl();   // kartu lawan baru menghadap depan setelah efek
    const a = center(from);
    el.style.left = (a.x - 40) + 'px';
    el.style.top = (a.y - 58) + 'px';
    el.style.transform = `scale(${from.width / 80})`;
    document.body.appendChild(el);
    return el;
}

// Urutan efek satu aksi: efek kartu (pemilih warna / banner) tampil dulu, baru kartunya diletakkan; teriak UNO sesudah kartu.
function effectsFirst(list) {
    const out = [];
    for (let i = 0; i < list.length; i++) {
        const ev = list[i];
        if (ev.t !== 'play') { out.push(ev); continue; }
        let k = i + 1;
        const pre = [], between = [];
        while (k < list.length && list[k].t === 'uno') between.push(list[k++]);
        while (k < list.length && list[k].t === 'banner') pre.push(list[k++]);
        // preFx: ada efek yang tampil sebelum kartu mendarat -> kartu bayangan diam di tempat asal
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
        if (!ghost && ev.t === 'banner') {
            const pl = ordered.slice(i).find(e => e.t === 'play' && e.preFx);
            const between = ordered.slice(0, i).some(e => e.t === 'play');
            if (pl && !between) {
                const top = document.querySelector('#w-discard .pile-top');
                if (top) top.style.visibility = 'hidden';
                ghost = ghostCard(pl);
            }
        }
        if (ev.t === 'play' && ghost) { ghost.remove(); ghost = null; }
        if (ev.t === 'deal') {
            const gen = lastFxId;
            sfx('cdGo', 5.2);
            await Promise.all([runCountdown(() => gen !== lastFxId || !S.roomData), deal(state)]);
            if (gen !== lastFxId || !S.roomData) return;
        }
        else if (ev.t === 'play') await play(ev);
        else if (ev.t === 'banner') await banner(ev);
        else if (ev.t === 'swap') await swap(ev);
        else if (ev.t === 'uno') await banner({ k: 'uno', uid: ev.uid });
        else if (ev.t === 'catch') await hammer(ev);
        else if (ev.t === 'draw') await draw(ev);
        await sleep(150);
    }
    if (ghost) ghost.remove();
}

// Dipanggil di awal renderGame(); memutar animasi baru satu kali saja
export function handleFx(state) {
    const me = S.currentUser?.uid;
    const f = state.fx;
    if (!f || !f.list) return;
    if (lastFxId === f.id) return;
    const firstRender = lastFxId === null;
    lastFxId = f.id;
    if (firstRender && !f.list.some(e => e.t === 'deal')) return;

    const c = { me: 0, opp: {}, plays: 0, swap: false };
    f.list.forEach(ev => {
        if (ev.t === 'play') {
            hold.pile++; c.plays++;
            const scr = $('aw-screen');
            if (scr && scr.dataset.awc && scr.dataset.awc !== ev.color) hold.colorFrom = scr.dataset.awc;   // meja berganti warna saat kartu mendarat
        }
        else if (ev.t === 'swap') {
            // state sudah memuat hasil tukar: tangan LAMA pemain A = tangan baru pemain B (dan sebaliknya)
            hold.swap = { a: ev.a, b: ev.b, hands: { [ev.a]: (state.hands[ev.b] || []).slice(), [ev.b]: (state.hands[ev.a] || []).slice() } };
            c.swap = true;
        }
        else if (ev.t === 'draw') {
            if (ev.uid === me) { hold.transitMe += ev.n; c.me += ev.n; }
            else { hold.transit[ev.uid] = (hold.transit[ev.uid] || 0) + ev.n; c.opp[ev.uid] = (c.opp[ev.uid] || 0) + ev.n; }
        }
    });

    pending++;
    queue = queue
        .then(() => Promise.race([run(f.list, state, c), new Promise(r => setTimeout(r, 25000))]))   // pengaman anti macet
        .catch(e => console.error('fx', e))
        .then(() => { finish(c); pending--; });
}

// dipanggil saat permainan baru / keluar supaya animasi berikutnya tidak dianggap "lama"
export function resetFx() { lastFxId = null; hold.transitMe = 0; hold.transit = {}; hold.pile = 0; hold.swap = null; hold.colorFrom = null; }
