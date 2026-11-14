import { getScale } from '../../core/config.js';
import { S } from '../../core/state.js';
import { backSrc, MERCY_LIMIT } from './deck.js';
import { generateCardHTML, paintColor, pileRot, renderGame } from './ui.js';
import { sfx } from '../../core/sound.js';
import { runCountdown } from '../../core/countdown.js';

// Animasi UNO Show 'Em No Mercy. Dipicu daftar peristiwa state.fx (dicatat di rules.js):
//   deal, play, draw, banner, uno, catch, pass (kartu 0), swap (kartu 7), mercy (tersingkir), roulette (korban mengambil kartu).
// Satu antrean; isBusy() memblokir aksi pemain; pengaman 25 detik anti macet.

const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise(r => setTimeout(r, reduce ? 0 : ms));

let queue = Promise.resolve();
let pending = 0;
export const whenIdle = () => queue;
export const isBusy = () => pending > 0;

// ---- Penahan tampilan ----
// transit = kartu dalam perjalanan ke pemain (belum boleh terlihat); pile = kartu yang akan diletakkan;
// hands = tangan LAMA (tukar 7 / oper 0) ditampilkan sampai animasinya selesai; mercy = pemain yang akan tersingkir tetap tampil berkartu.
const hold = { transitMe: 0, transit: {}, pile: 0, hands: null, mercy: {}, colorFrom: null };
let lastFxId = null, cur = null;
const inNm = () => !!S.roomData && S.roomData.mode === 'nomercy';

export function shownCount(uid, actual) {
    if (hold.mercy[uid]) return hold.mercy[uid];
    const old = hold.hands && hold.hands[uid];
    return Math.max(0, (old ? old.length : actual) - (hold.transit[uid] || 0));
}
export function shownHand(uid, actual) { return (hold.hands && hold.hands[uid]) || actual; }
export const heldColor = () => hold.colorFrom;
export const heldMercy = (uid) => !!hold.mercy[uid];   // pemain yang akan tersingkir: tampil berkartu sampai banner Mercy selesai

export function applyHold() {
    const hand = $('n-hand');
    if (!hand) return;
    const kids = [...hand.children];
    const hideFrom = kids.length - hold.transitMe;
    kids.forEach((k, i) => { k.style.visibility = i >= hideFrom ? 'hidden' : ''; });
    const pt = document.querySelector('#n-discard .pile-top');
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
        if (inNm()) renderGame();
    }
}

function finish(c) {
    hold.transitMe = Math.max(0, hold.transitMe - Math.max(0, c.me));
    Object.keys(c.opp).forEach(u => { hold.transit[u] = Math.max(0, (hold.transit[u] || 0) - Math.max(0, c.opp[u])); });
    hold.pile = Math.max(0, hold.pile - Math.max(0, c.plays || 0));
    if (c.hands) hold.hands = null;
    c.mercy.forEach(u => { delete hold.mercy[u]; });
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
    const d = $('n-discard');
    return rectOf((d && d.firstElementChild) || d);
}

function posOfPlayer(uid) {
    if (uid === S.currentUser?.uid) {
        const h = rectOf($('n-hand'));
        const k = getScale();
        return h && { left: h.left + h.width / 2 - 40 * k, top: h.top + 4, width: 80 * k, height: 116 * k };
    }
    return rectOf($('nstack-' + uid));
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

// ---- Banner di tengah layar. Berkas: img/nomercy/fx/<jenis>-<Warna>.png (jenis tanpa warna untuk kartu hitam = cadangan) ----
const FILE = { revdraw4: 'wildrev4', pass: 'pass0', swap: 'swap7' };
// Bunyi sementara memakai efek yang sudah ada (bunyi khusus No Mercy menyusul di tahap suara).
const SND = { uno: 'uno', skip: 'skip', reverse: 'reverse', draw2: 'draw2', draw4: 'draw4', revdraw4: 'draw4', draw6: 'draw6', draw10: 'draw6',
    skipall: 'skipall', discardall: 'reset', roulette: 'power', pass: 'swap', swap: 'swap', mercy: 'catch', stack: 'power' };
const NOCOLOR = ['roulette'];
async function banner(ev) {
    const k = ev.k;
    sfx(SND[k] || k);
    const el = document.createElement('div');
    el.className = 'fx-img-banner';
    let src;
    if (k === 'uno') src = 'img/effects/uno.png';
    else if (k === 'mercy' || k === 'stack') src = `img/nomercy/fx/${k}.png`;
    else if (NOCOLOR.includes(k) || !ev.c) src = `img/nomercy/fx/${FILE[k] || k}.png`;
    else src = `img/nomercy/fx/${FILE[k] || k}-${ev.c}.png`;
    el.innerHTML = `<img src="${src}" alt="" onerror="this.onerror=null;this.src='img/nomercy/fx/${FILE[k] || k}.png'">`;
    const tUid = ev.target || ev.uid;
    const p = tUid && S.roomData?.players.find(x => x.uid === tUid);
    const label = ev.n && /^draw|^revdraw/.test(k) ? `+${ev.n}${p ? ' untuk ' + p.name : ''}` : (ev.n && k === 'discardall' ? `${ev.n} kartu dibuang` : (p ? p.name : ''));
    if (label) { const s = document.createElement('small'); s.textContent = label; el.appendChild(s); }
    document.body.appendChild(el);
    setTimeout(() => el.remove(), reduce ? 0 : 1600);
    await sleep(k === 'uno' ? 1500 : 1300);
}

// Palu terbang dari tombol tangkap (atau profil penangkap) ke pemain yang lupa UNO, lalu menghantam
async function hammer(ev) {
    const uid = ev.uid, by = ev.by;
    const mine = uid === S.currentUser?.uid;
    const target = mine ? $('n-hand') : $('nprof-' + uid);
    const r = rectOf(target) || { left: window.innerWidth / 2 - 40, top: window.innerHeight / 2, width: 80, height: 80 };
    const cx = r.left + r.width / 2;
    const byMe = by === S.currentUser?.uid;
    const btn = byMe ? $('n-btn-catch') : null;
    const src = rectOf(btn) || rectOf($('nprof-' + by)) || { left: window.innerWidth - 90, top: window.innerHeight * 0.6, width: 56, height: 56 };
    const sx = src.left + src.width / 2, sy = src.top + src.height / 2;
    const hx = cx, hy = Math.max(r.top - 34, 46);
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

// Kartu dimainkan: terbang ke tumpukan buangan (menghadap depan)
async function play(ev) {
    const mine = ev.uid === S.currentUser?.uid;
    const from = (mine && S.pendingFrom) || posOfPlayer(ev.uid);
    if (mine) S.pendingFrom = null;
    const top = document.querySelector('#n-discard .pile-top');
    if (top) top.style.visibility = 'hidden';
    const n = S.roomData?.gameState.discardPile.length || 1;
    sfx('card');
    await fly(cardEl(ev.card), from, discardRect(), { dur: 700, rot: pileRot(n - 1) });
    sfx('slap');
    if (cur) cur.plays = (cur.plays || 0) - 1;
    hold.pile = Math.max(0, hold.pile - 1);
    const t2 = document.querySelector('#n-discard .pile-top');
    if (t2 && hold.pile === 0) t2.style.visibility = '';
    hold.colorFrom = null; paintColor(ev.color);
    if (ev.card.v !== 'Wild Color Roulette') sfx('c_' + ev.color);
}

// Kartu ditarik: terbang dari tumpukan (punggung kartu) ke tangan / profil pemain
async function draw({ uid, n, pen }) {
    const deck = rectOf($('n-draw'));
    const count = Math.min(n, 8);
    const mine = uid === S.currentUser?.uid;
    const kids = mine ? [...$('n-hand').children] : [];
    const jobs = [];
    if (pen) sfx('draw2');
    const base = kids.length - Math.max(n, cur ? cur.me : n);
    for (let i = 0; i < count; i++) {
        sfx('draw', i * 0.22);
        const to = mine ? (clampRect(rectOf(kids[base + i])) || posOfPlayer(uid)) : posOfPlayer(uid);
        jobs.push(fly(backEl(), deck, to, { delay: i * 220 }).then(() => land(uid)));
    }
    for (let i = count; i < n; i++) land(uid);   // sisa (lebih dari 8) langsung dianggap tiba
    await Promise.all(jobs);
}

// Awal permainan: 7 kartu dibagikan satu per satu dari tumpukan (~5 detik, bersama hitung mundur)
async function deal(state) {
    const deck = rectOf($('n-draw'));
    const me = S.currentUser?.uid;
    const pile = $('n-discard');
    if (pile) pile.style.visibility = 'hidden';
    const hand = [...$('n-hand').children];
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
            jobs.push(fly(backEl(), deck, clampRect(rectOf(k)), { dur: DUR, delay }).then(() => { k.style.visibility = ''; }));
        } else if (i < state.hands[u].length) {
            jobs.push(fly(backEl(), deck, posOfPlayer(u), { dur: DUR, delay }));
        }
    });
    await Promise.all(jobs);
    if (pile) { pile.style.visibility = ''; pile.classList.add('fx-pop-in'); setTimeout(() => pile.classList.remove('fx-pop-in'), 500); }
}

// Kartu 7 (tukar) dan kartu 0 (oper): banner, pemain terkait menyala, lalu tampilan berganti ke tangan baru.
const ringOf = (uid) => uid === S.currentUser?.uid ? $('n-me-avatar') : $('nprof-' + uid);
async function glowAndSwitch(uids, ev, bannerEv) {
    uids.forEach(u => { const r = ringOf(u); if (r) r.classList.add('nm-swap-glow'); });
    await banner(bannerEv);
    hold.hands = null;
    if (inNm() && S.roomData.gameState) renderGame();
    uids.forEach(u => {
        const st = $('nstack-' + u);
        if (st && u !== S.currentUser?.uid) { st.classList.add('nm-stack-bump'); setTimeout(() => st.classList.remove('nm-stack-bump'), 600); }
    });
    sfx('slap');
    await sleep(500);
    uids.forEach(u => { const r = ringOf(u); if (r) r.classList.remove('nm-swap-glow'); });
}
const swap = (ev) => glowAndSwitch([ev.a, ev.b], ev, { k: 'swap', c: ev.c, target: ev.b });
const pass = (ev, state) => glowAndSwitch(S.roomData.players.filter(p => !(state.out && state.out[p.uid])).map(p => p.uid), ev, { k: 'pass', c: state.currentColor });

// Pemain tersingkir (25 kartu): banner Mercy, lalu tampilan berganti ke keadaan "tersingkir"
async function mercy(ev) {
    await banner({ k: 'mercy', uid: ev.uid });
    delete hold.mercy[ev.uid];
    if (inNm() && S.roomData.gameState) renderGame();
    await sleep(200);
}

// Color Roulette: warna pilihan korban tampil, lalu kartu yang terbuka terbang ke tangan korban
async function roulette(ev) {
    sfx('c_' + ev.color);
    await banner({ k: 'wild', c: ev.color, uid: ev.uid });
    await draw({ uid: ev.uid, n: ev.cards.length });
}

function restore() {
    const pile = $('n-discard');
    if (pile) pile.style.visibility = '';
    const top = document.querySelector('#n-discard .pile-top');
    if (top) top.style.visibility = '';
    if (inNm() && S.roomData.gameState) renderGame();
}

// Kartu "bayangan" yang diam di posisi asal selama efeknya tampil (kartu belum diletakkan)
function ghostCard(ev) {
    const mine = ev.uid === S.currentUser?.uid;
    const from = (mine && S.pendingFrom) || posOfPlayer(ev.uid);
    if (!from) return null;
    const el = document.createElement('div');
    el.className = 'fly-card';
    el.innerHTML = mine ? cardEl(ev.card) : backEl();
    const a = center(from);
    el.style.left = (a.x - 40) + 'px';
    el.style.top = (a.y - 58) + 'px';
    el.style.transform = `scale(${from.width / 80})`;
    document.body.appendChild(el);
    return el;
}

// Urutan efek satu aksi: banner kartu tampil dulu, baru kartunya diletakkan; teriak UNO sesudah kartu.
function effectsFirst(list) {
    const out = [];
    for (let i = 0; i < list.length; i++) {
        const ev = list[i];
        if (ev.t !== 'play') { out.push(ev); continue; }
        let k = i + 1;
        const pre = [], between = [];
        while (k < list.length && list[k].t === 'uno') between.push(list[k++]);
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
        if (!ghost && ev.t === 'banner') {
            const pl = ordered.slice(i).find(e => e.t === 'play' && e.preFx);
            const between = ordered.slice(0, i).some(e => e.t === 'play');
            if (pl && !between) {
                const top = document.querySelector('#n-discard .pile-top');
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
        else if (ev.t === 'banner') {
            if (ev.stack) await banner({ k: 'stack' });          // Draw ditumpuk: tanda STACK! dulu
            await banner(ev);
        }
        else if (ev.t === 'swap') await swap(ev);
        else if (ev.t === 'pass') await pass(ev, state);
        else if (ev.t === 'mercy') await mercy(ev);
        else if (ev.t === 'roulette') await roulette(ev);
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

    const c = { me: 0, opp: {}, plays: 0, hands: false, mercy: [] };
    const players = S.roomData.players;
    const addTransit = (uid, n) => {
        if (uid === me) { hold.transitMe += n; c.me += n; }
        else { hold.transit[uid] = (hold.transit[uid] || 0) + n; c.opp[uid] = (c.opp[uid] || 0) + n; }
    };
    f.list.forEach(ev => {
        if (ev.t === 'play') {
            hold.pile++; c.plays++;
            const scr = $('nm-screen');
            if (scr && scr.dataset.nmc && scr.dataset.nmc !== ev.color) hold.colorFrom = scr.dataset.nmc;
        }
        else if (ev.t === 'swap') {
            // state sudah memuat hasil tukar: tangan LAMA pemain A = tangan baru pemain B (dan sebaliknya)
            hold.hands = { ...(hold.hands || {}), [ev.a]: (state.hands[ev.b] || []).slice(), [ev.b]: (state.hands[ev.a] || []).slice() };
            c.hands = true;
        }
        else if (ev.t === 'pass') {
            // kartu 0: tangan LAMA pemain p = tangan baru pemain berikutnya (searah putaran)
            const alive = players.filter(p => !(state.out && state.out[p.uid]));
            const old = {};
            alive.forEach((p, i) => { old[p.uid] = (state.hands[alive[((i + (ev.dir || 1)) % alive.length + alive.length) % alive.length].uid] || []).slice(); });
            hold.hands = { ...(hold.hands || {}), ...old };
            c.hands = true;
        }
        else if (ev.t === 'draw') addTransit(ev.uid, ev.n);
        else if (ev.t === 'roulette') addTransit(ev.uid, ev.cards.length);
        else if (ev.t === 'mercy') { hold.mercy[ev.uid] = MERCY_LIMIT; c.mercy.push(ev.uid); }
    });

    pending++;
    queue = queue
        .then(() => Promise.race([run(f.list, state, c), new Promise(r => setTimeout(r, 25000))]))
        .catch(e => console.error('fx', e))
        .then(() => { finish(c); pending--; });
}

// dipanggil saat permainan baru / keluar supaya animasi berikutnya tidak dianggap "lama"
export function resetFx() { lastFxId = null; hold.transitMe = 0; hold.transit = {}; hold.pile = 0; hold.hands = null; hold.mercy = {}; hold.colorFrom = null; }
