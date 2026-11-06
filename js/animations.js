import { S } from './state.js';
import { generateCardHTML, pileRot, renderGame } from './ui.js';

// Semua animasi permainan. Dipicu oleh daftar peristiwa (state.fx) yang dicatat di rules.js,
// jadi semua pemain online melihat animasi yang sama.

const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise(r => setTimeout(r, reduce ? 0 : ms));
const rnd = (a) => (Math.random() * 2 - 1) * a;
const BACK = '<div class="uno-card card-back"><div class="oval"><span class="val-center">UNO</span></div></div>';
const HEX = { Red: '#ef4444', Green: '#22c55e', Blue: '#3b82f6', Yellow: '#eab308' };

// Gambar buatan sendiri (SVG), bukan emoji
const ICONS = {
    skip: '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round"><circle cx="50" cy="50" r="38"/><line x1="23" y1="77" x2="77" y2="23"/></svg>',
    reverse: '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"><path d="M10 34H70"/><path d="M62 16L90 34L62 52" fill="currentColor"/><path d="M90 68H30"/><path d="M38 50L10 68L38 86" fill="currentColor"/></svg>',
    shuffle: '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 30H28C48 30 52 70 72 70H80"/><path d="M8 70H28C48 70 52 30 72 30H80"/><path d="M78 16L96 30L78 44" fill="currentColor"/><path d="M78 56L96 70L78 84" fill="currentColor"/></svg>'
};
const HAMMER_SVG = '<svg viewBox="0 0 100 100"><rect x="44" y="30" width="12" height="66" rx="5" fill="#c68a4b" stroke="#5b3a1a" stroke-width="3"/><path d="M47 40V90M52 36V92" stroke="#a36d33" stroke-width="1.5"/><rect x="10" y="6" width="80" height="36" rx="9" fill="#a8652a" stroke="#4a2a10" stroke-width="3"/><rect x="20" y="6" width="9" height="36" fill="#6e3f17"/><rect x="71" y="6" width="9" height="36" fill="#6e3f17"/><path d="M34 14H66M34 22H66M34 30H66" stroke="#c98a4a" stroke-width="2" stroke-linecap="round"/></svg>';
const BOOM_SVG = '<svg viewBox="0 0 100 100"><polygon points="50,2 61,32 92,20 72,46 98,60 66,66 70,98 50,76 30,98 34,66 2,60 28,46 8,20 39,32" fill="#facc15" stroke="#f97316" stroke-width="4" stroke-linejoin="round"/><circle cx="50" cy="52" r="12" fill="#fff"/></svg>';

const BANNERS = {
    uno:     { t: 'UNO!',    c: 'fx-uno' },
    skip:    { t: 'SKIP',    c: 'fx-skip', i: 'skip' },
    reverse: { t: 'REVERSE', c: 'fx-reverse', i: 'reverse' },
    draw2:   { t: '+2',      c: 'fx-draw' },
    draw4:   { t: '+4',      c: 'fx-draw4' },
    wild:    { t: 'WILD',    c: 'fx-wild' },
    shuffle: { t: 'ACAK',    c: 'fx-acak', i: 'shuffle' }
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
        return h && { left: h.left + h.width / 2 - 40, top: h.top + 4, width: 80, height: 116 };
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

function faceHTML(card, color) {
    const bg = card.color === 'Black' ? color : card.color;
    return `<div class="uno-card bg-${bg}">${generateCardHTML(card)}</div>`;
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

// Tulisan besar di tengah layar
async function banner(k, uid) {
    const b = BANNERS[k];
    if (!b) return;
    const el = document.createElement('div');
    el.className = 'fx-banner ' + b.c;
    el.innerHTML = (b.i ? ICONS[b.i] : '') + '<span>' + b.t + '</span>';
    const p = uid && S.roomData?.players.find(x => x.uid === uid);
    if (p) { const s = document.createElement('small'); s.textContent = p.name; el.appendChild(s); }
    document.body.appendChild(el);
    setTimeout(() => el.remove(), reduce ? 0 : 1600);
    await sleep(k === 'uno' ? 1500 : 1300);
}

// Palu kayu menghantam profil pemain yang lupa UNO
async function hammer(uid) {
    const mine = uid === S.currentUser?.uid;
    const target = mine ? $('human-hand-ui') : $('prof-' + uid);
    const r = rectOf(target) || { left: window.innerWidth / 2 - 40, top: window.innerHeight / 2, width: 80, height: 80 };
    const cx = r.left + r.width / 2;
    const h = document.createElement('div');
    h.className = 'fx-hammer'; h.innerHTML = HAMMER_SVG;
    h.style.left = (cx - 46) + 'px'; h.style.top = (r.top - 80) + 'px';
    const b = document.createElement('div');
    b.className = 'fx-boom'; b.innerHTML = BOOM_SVG;
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
    await fly(faceHTML(ev.card, ev.color), from, discardRect(), { dur: 700, rot: pileRot(n - 1) });
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

async function run(list, state, c) {
    cur = c;
    for (const ev of list) {
        if (ev.t === 'deal') await deal(state);
        else if (ev.t === 'play') await play(ev);
        else if (ev.t === 'banner') await banner(ev.k);
        else if (ev.t === 'shuffle') await shuffleAnim(state);
        else if (ev.t === 'uno') await banner('uno', ev.uid);
        else if (ev.t === 'catch') await hammer(ev.uid);
        else if (ev.t === 'draw') await draw(ev);
        await sleep(150);   // jeda singkat antar animasi
    }
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
