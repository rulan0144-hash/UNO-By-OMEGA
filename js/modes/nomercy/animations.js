import { getScale } from '../../core/config.js';
import { S } from '../../core/state.js';
import { backSrc, MERCY_LIMIT } from './deck.js';
import { generateCardHTML, paintColor, pileRot, renderGame } from './ui.js';
import { sfx } from '../../core/sound.js';
import { runCountdown } from '../../core/countdown.js';

// Animasi UNO Show 'Em No Mercy. Dipicu daftar peristiwa state.fx (dicatat di rules.js):
//   deal, play, draw, banner, uno, catch, pass (kartu 0), swap (kartu 7), mercy (tersingkir), roulette (korban memilih warna; kartunya diambil lewat peristiwa draw satu per satu).
// Animasi khusus: 7 = kartu terbang bolak-balik antara dua pemain, 0 = semua tangan terbang ke pemain di sebelahnya (tanpa banner/logo);
// Discard All = kartu melayang, kartu sewarna menumpuk di belakangnya, lalu semuanya menuju tumpukan; Mercy = pemain menghilang, kartunya terbang kembali ke tumpukan.
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
// hands = tangan LAMA (tukar 7 / oper 0 / Discard All) ditampilkan sampai animasinya selesai (meDone = tangan sendiri sudah berganti ke yang baru);
// mercy = pemain yang akan tersingkir tetap tampil berkartu; cut = jumlah kartu teratas buangan yang belum tampak (Discard All);
// keep = jumlah kartu yang masih dihitung milik lawan (Discard All: kartu belum terbang).
const hold = { transitMe: 0, transit: {}, pile: 0, hands: null, meDone: false, mercy: {}, colorFrom: null, cut: 0, keep: {} };
let lastFxId = null, cur = null;
const inNm = () => !!S.roomData && S.roomData.mode === 'nomercy';

export function shownCount(uid, actual) {
    if (hold.mercy[uid]) return hold.mercy[uid];
    const old = hold.hands && hold.hands[uid];
    return Math.max(0, (old ? old.length : actual + (hold.keep[uid] || 0)) - (hold.transit[uid] || 0));
}
export function shownHand(uid, actual) { return (hold.hands && !hold.meDone && hold.hands[uid]) || actual; }
export const heldColor = () => hold.colorFrom;
export const heldCut = () => hold.cut;
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
    hold.meDone = false; hold.cut = 0; hold.keep = {};
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

// Tumpukan ambil: 'L' kiri, 'R' kanan
const deckRect = (side) => rectOf($(side === 'R' ? 'n-draw-r' : 'n-draw-l'));

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

// Terbang melengkung (busur); dua rombongan berlawanan arah saling berpapasan
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

const cardEl = (card) => `<div class="uno-card">${generateCardHTML(card)}</div>`;
const backEl = () => `<div class="uno-card"><img class="card-img" src="${backSrc()}" alt="" draggable="false"></div>`;

// ---- Banner di tengah layar. Berkas: img/nomercy/fx/<jenis>-<Warna>.png (jenis tanpa warna untuk kartu hitam = cadangan) ----
const FILE = { revdraw4: 'wildrev4' };
// Bunyi tiap banner (dibuat di core/sound.js; Draw 10, Reverse Draw 4, Mercy, Discard All, Roulette punya bunyi & suara sendiri).
const SND = { uno: 'uno', skip: 'skip', reverse: 'reverse', draw2: 'draw2', draw4: 'draw4', revdraw4: 'revdraw4', draw6: 'draw6', draw10: 'draw10',
    skipall: 'skipall', discardall: 'discardall', roulette: 'roulette', mercy: 'mercy' };
const NOCOLOR = ['roulette'];
async function banner(ev) {
    const k = ev.k;
    sfx(SND[k] || k);
    const el = document.createElement('div');
    el.className = 'fx-img-banner';
    let src;
    if (k === 'uno') src = 'img/effects/uno.png';
    else if (k === 'mercy') src = `img/nomercy/fx/${k}.png`;
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
async function draw({ uid, n, pen, sides, cards, roul }) {
    const decks = { L: deckRect('L'), R: deckRect('R') };
    const count = Math.min(n, 8);
    const mine = uid === S.currentUser?.uid;
    const kids = mine ? [...$('n-hand').children] : [];
    const jobs = [];
    // (suara hukuman tidak diputar lagi di sini: bunyi Draw sudah dimainkan banner saat kartunya dikeluarkan)
    const base = kids.length - Math.max(n, cur ? cur.me : n);
    for (let i = 0; i < count; i++) {
        sfx(roul ? 'rtap' : 'draw', i * 0.22);   // Roulette: ketukan tegang, lalu denting naik bila warnanya cocok / nada rendah bila bukan
        const to = mine ? (clampRect(rectOf(kids[base + i])) || posOfPlayer(uid)) : posOfPlayer(uid);
        jobs.push(fly(backEl(), decks[sides && sides[i] === 'R' ? 'R' : 'L'], to, { delay: i * 220 }).then(() => { land(uid); if (roul && cards && cards[i]) sfx(cards[i].c === roul ? 'rhit' : 'rmiss'); }));
    }
    for (let i = count; i < n; i++) land(uid);   // sisa (lebih dari 8) langsung dianggap tiba
    await Promise.all(jobs);
}

// Awal permainan: 7 kartu dibagikan satu per satu dari tumpukan (~5 detik, bersama hitung mundur)
async function deal(state) {
    const decks = [deckRect('L'), deckRect('R')];
    let dk = 0;
    const nextDeck = () => decks[dk++ % 2];
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
            jobs.push(fly(backEl(), nextDeck(), clampRect(rectOf(k)), { dur: DUR, delay }).then(() => { k.style.visibility = ''; }));
        } else if (i < state.hands[u].length) {
            jobs.push(fly(backEl(), nextDeck(), posOfPlayer(u), { dur: DUR, delay }));
        }
    });
    await Promise.all(jobs);
    if (pile) { pile.style.visibility = ''; pile.classList.add('fx-pop-in'); setTimeout(() => pile.classList.remove('fx-pop-in'), 500); }
}

// ---- Kartu 7 (tukar) dan kartu 0 (oper): TANPA banner/logo. Punggung kartu terbang MELENGKUNG antar pemain.
// pairs = [{ from, to }] berjalan bersamaan: 7 = A->B dan B->A (saling berpapasan); 0 = tiap pemain -> pemain di sebelahnya (searah putaran).
// Selama itu tampilan memegang tangan LAMA (hold.hands); tangan sendiri: kartu hilang tepat saat terbang, kartu baru MUNCUL satu per satu saat mendarat.
const ringOf = (uid) => uid === S.currentUser?.uid ? $('n-me-avatar') : $('nprof-' + uid);
async function exchange(pairs, snd = 'swap') {
    const me = S.currentUser?.uid;
    const MAXC = 5, GAP = 130, DUR = 950;
    const uids = [...new Set(pairs.flatMap(p => [p.from, p.to]))];
    const glow = (on) => uids.forEach(u => { const r = ringOf(u); if (r) r.classList.toggle('nm-swap-glow', on); });
    const oldN = (u) => (hold.hands && hold.hands[u] ? hold.hands[u].length : 0);
    sfx(snd);   // 7 = 'swap' ("Swap!"), 0 = 'pass' ("Pass!")
    glow(true);
    const launch = (uid, n, from, to) => {
        const kids = uid === me ? [...$('n-hand').children] : [];
        const k = Math.min(kids.length ? 8 : MAXC, n), out = [];                    // tangan sendiri: tiap kartu terbang satu per satu
        const dist = from && to ? Math.hypot(center(from).x - center(to).x, center(from).y - center(to).y) : 0;
        const bend = Math.min(110, Math.max(40, dist * 0.28));
        for (let i = 0; i < k; i++) {
            const kid = kids.length ? kids[Math.round(i * (kids.length - 1) / Math.max(1, k - 1))] : null;
            const start = kid ? (clampRect(rectOf(kid)) || from) : from;
            const delay = i * (kids.length ? 100 : GAP);
            if (kid) setTimeout(() => { kid.style.visibility = 'hidden'; }, reduce ? 0 : delay);   // kartu meninggalkan tangan saat terbang
            out.push(flyArc(backEl(), start, to, { dur: DUR, delay, bend, rot: (i % 2 ? 1 : -1) * (14 + i * 4) }));
        }
        return out;
    };
    const jobs = [];
    let incomingFrom = null;
    pairs.forEach(({ from, to }) => {
        jobs.push(...launch(from, oldN(from), posOfPlayer(from), posOfPlayer(to)));
        if (to === me && from !== me) incomingFrom = from;
    });
    if (incomingFrom) {
        const nOut = Math.min(oldN(me), 8), pFrom = posOfPlayer(incomingFrom);
        jobs.push((async () => {
            await sleep(Math.max(0, nOut - 1) * 100 + 60);                           // semua kartu lama sudah berangkat
            [...$('n-hand').children].forEach(k => { k.style.visibility = 'hidden'; });
            hold.meDone = true;                                                       // tampilan tangan = tangan baru (semua kartu disembunyikan dulu)
            if (inNm() && S.roomData.gameState) renderGame();
            glow(true);                                                               // renderGame membangun ulang profil lawan
            const nk = [...$('n-hand').children];
            nk.forEach(k => { k.style.visibility = 'hidden'; });
            const k = Math.min(8, nk.length), lands = [];
            for (let i = 0; i < k; i++) {
                const upTo = i === k - 1 ? nk.length - 1 : Math.round(i * (nk.length - 1) / Math.max(1, k - 1));
                const to = clampRect(rectOf(nk[upTo])) || posOfPlayer(me);
                lands.push(flyArc(backEl(), pFrom, to, { dur: 850, delay: i * 110, bend: -50, rot: (i % 2 ? 1 : -1) * 12 }).then(() => {
                    for (let x = (i ? Math.round((i - 1) * (nk.length - 1) / Math.max(1, k - 1)) + 1 : 0); x <= upTo; x++) { nk[x].style.visibility = ''; nk[x].classList.add('nm-card-in'); }
                    sfx('card');
                }));
            }
            await Promise.all(lands);
            nk.forEach(x => { x.style.visibility = ''; });
        })());
    }
    await Promise.all(jobs);
    // selesai: tampilan kembali ke state asli, tumpukan lawan berdenyut
    hold.hands = null; hold.meDone = false;
    if (inNm() && S.roomData.gameState) renderGame();
    glow(true);
    uids.forEach(u => {
        const st = $('nstack-' + u);
        if (st && u !== me) { st.classList.add('nm-stack-bump'); setTimeout(() => st.classList.remove('nm-stack-bump'), 600); }
    });
    sfx('slap');
    await sleep(450);
    glow(false);
}
const swap = (ev) => exchange([{ from: ev.a, to: ev.b }, { from: ev.b, to: ev.a }]);
function pass(ev, state) {
    const pl = S.roomData.players;
    const alive = (ev._alive || pl.map(p => p.uid)).map(u => ({ uid: u }));      // daftar pemain yang ikut dioper (dicatat handleFx)
    const n = alive.length, d = ev.dir || 1;
    return exchange(alive.map((p, i) => ({ from: p.uid, to: alive[((i + d) % n + n) % n].uid })), 'pass');
}

// Discard All: kartu Discard All melayang di atas tumpukan, semua kartu sewarna milik pemain itu terbang menumpuk di BELAKANGNYA,
// lalu seluruh tumpukan menuju tumpukan buangan.
async function dall(ev) {
    const me = S.currentUser?.uid, mine = ev.uid === me;
    const from = (mine && S.pendingFrom) || posOfPlayer(ev.uid);
    if (mine) S.pendingFrom = null;
    const dest = discardRect();
    const drops = ev.cards || [];
    const k = getScale();
    const finalRot = pileRot((S.roomData?.gameState?.discardPile.length || 1) - 1);
    const done = () => {
        hold.cut = 0; hold.keep = {}; hold.hands = null; hold.meDone = false; hold.colorFrom = null;
        paintColor(ev.color);
        if (inNm() && S.roomData.gameState) renderGame();
    };
    if (reduce || !from || !dest) { done(); return; }
    const D = center(dest), F = { x: D.x, y: D.y - dest.height * 0.95 }, sF = (dest.width / 80) * 1.45, sD = dest.width / 80;
    const mk = (html, rect, z) => {
        const el = document.createElement('div');
        el.className = 'fly-card nm-float';
        el.innerHTML = html;
        const a = center(rect);
        el.style.left = (a.x - 40) + 'px'; el.style.top = (a.y - 58) + 'px';
        el.style.transform = `scale(${rect.width / 80})`; el.style.zIndex = z;
        document.body.appendChild(el);
        return { el, a, s: rect.width / 80 };
    };
    const tf = (m, tx, ty, sc, rot) => ({ transform: `translate(${tx}px,${ty}px) scale(${sc}) rotate(${rot}deg)` });
    const go = (m, frames, opts) => m.el.animate(frames, { fill: 'both', easing: 'cubic-bezier(.25,.7,.25,1)', ...opts }).finished.catch(() => {});
    const parts = [];

    // 1) kartu Discard All terbang dan melayang di atas tumpukan
    const top = mk(cardEl(ev.card), from, 302);
    sfx('card');
    await go(top, [tf(top, 0, 0, top.s, 0), tf(top, F.x - top.a.x, F.y - top.a.y, sF, -3)], { duration: 650 });

    // 2) kartu sewarna terbang satu per satu dan menumpuk di belakangnya
    const held = mine && hold.hands && hold.hands[me];
    const kids = mine ? [...$('n-hand').children] : [];
    const gap = Math.min(170, 1500 / Math.max(1, drops.length));
    const jobs = drops.map((card, i) => (async () => {
        await sleep(i * gap);
        const hi = held ? held.findIndex(c => c.id === card.id) : -1;
        const kid = hi >= 0 ? kids[hi] : null;
        const rect = (kid && clampRect(rectOf(kid))) || from;
        if (kid) kid.style.visibility = 'hidden';
        if (!mine) {
            hold.keep[ev.uid] = Math.max(0, (hold.keep[ev.uid] || 0) - 1);
            const b = document.querySelector(`#nstack-${ev.uid} .count-badge`);
            if (b) b.textContent = shownCount(ev.uid, S.roomData.gameState.hands[ev.uid].length);
        }
        const m = mk(cardEl(card), rect, 301);
        parts.push(m);
        const ox = (i % 2 ? 1 : -1) * (5 + (i * 7) % 11) * k, oy = -(2 + (i * 5) % 9) * k, rot = (i % 2 ? 1 : -1) * (4 + (i * 5) % 12);
        m.end = { tx: F.x - m.a.x + ox, ty: F.y - m.a.y + oy, sc: sF * 0.97, rot };
        sfx('card');
        await go(m, [tf(m, 0, 0, m.s, 0), tf(m, m.end.tx, m.end.ty, m.end.sc, rot)], { duration: 520 });
    })());
    await Promise.all(jobs);
    await sleep(280);

    // 3) seluruh tumpukan menuju tumpukan buangan
    parts.forEach((m) => { m.el.classList.remove('nm-float'); });
    const moves = parts.map((m, i) => go(m, [tf(m, m.end.tx, m.end.ty, m.end.sc, m.end.rot), tf(m, D.x - m.a.x, D.y - m.a.y, sD, ((i % 2 ? 1 : -1) * 3) + finalRot)], { duration: 650 }));
    moves.push(go(top, [tf(top, F.x - top.a.x, F.y - top.a.y, sF, -3), tf(top, D.x - top.a.x, D.y - top.a.y, sD, finalRot)], { duration: 650 }));
    await Promise.all(moves);
    sfx('slap');
    done();   // Discard All memakai hold.cut (bukan hold.pile), jadi tidak ada hitungan plays yang dikurangi
    sfx('c_' + ev.color);
    [top, ...parts].forEach(m => m.el.remove());
}

// Pemain tersingkir (25 kartu): banner Mercy, pemain MENGHILANG, lalu semua kartunya terbang kembali ke tumpukan ambil.
async function mercy(ev) {
    const me = S.currentUser?.uid, uid = ev.uid, mine = uid === me;
    await banner({ k: 'mercy', uid });
    const cards = ev.cards || [];
    const n = ev.n || cards.length;
    if (mine && cards.length && $('n-hand').children.length < Math.min(n, 12)) {      // tangan sendiri belum tampak (mis. baru selesai tukar): tampilkan dulu
        hold.hands = { ...(hold.hands || {}), [me]: cards }; hold.meDone = false;
        if (inNm() && S.roomData.gameState) renderGame();
    }
    const prof = mine ? null : $('nprof-' + uid);
    const fading = mine ? [$('n-me-avatar'), $('n-mercy-me')] : (prof ? [prof.querySelector('.opp-avatar'), prof.querySelector('.name-tag')] : []);
    fading.forEach(e => e && e.classList.add('nm-vanish'));
    await sleep(750);
    // kartu terbang kembali ke tumpukan (kiri/kanan bergantian)
    const kids = mine ? [...$('n-hand').children] : [];
    const count = Math.min(n, mine ? 25 : 10), gap = mine ? 70 : 100, jobs = [];
    for (let i = 0; i < count; i++) {
        const kid = kids[i];
        const from = (kid && clampRect(rectOf(kid))) || posOfPlayer(uid);
        const html = mine && cards[i] ? cardEl(cards[i]) : backEl();
        if (kid) setTimeout(() => { kid.style.visibility = 'hidden'; }, reduce ? 0 : i * gap);
        if (i < 6) sfx('draw', i * gap / 1000);
        jobs.push(fly(html, from, deckRect(i % 2 ? 'R' : 'L'), { dur: 650, delay: i * gap, rot: (i % 2 ? 1 : -1) * 20 }));
    }
    await Promise.all(jobs);
    delete hold.mercy[uid];
    hold.hands = null; hold.meDone = false;
    if (inNm() && S.roomData.gameState) renderGame();
    await sleep(250);
}

// Color Roulette: warna pilihan korban tampil. Kartunya diambil korban SATU PER SATU dengan mengetuk tumpukan (peristiwa draw terpisah).
async function roulette(ev) {
    sfx('c_' + ev.color);
    await banner({ k: 'wild', c: ev.color, uid: ev.uid });
    hold.colorFrom = null; paintColor(ev.color);
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
        const da = ev.card.v === 'Discard All' && pre.find(e => e.k === 'discardall' && e.cards && e.cards.length);
        if (da) out.push(...pre, { t: 'dall', uid: ev.uid, card: ev.card, color: ev.color, cards: da.cards, preFx: true }, ...between);   // animasi khusus Discard All
        else out.push(...pre, { ...ev, preFx: pre.length > 0 }, ...between);
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
            const pl = ordered.slice(i).find(e => (e.t === 'play' || e.t === 'dall') && e.preFx);
            const between = ordered.slice(0, i).some(e => e.t === 'play' || e.t === 'dall');
            if (pl && !between) {
                const top = document.querySelector('#n-discard .pile-top');
                if (top) top.style.visibility = 'hidden';
                ghost = ghostCard(pl);
            }
        }
        if ((ev.t === 'play' || ev.t === 'dall') && ghost) { ghost.remove(); ghost = null; }
        if (ev.t === 'deal') {
            const gen = lastFxId;
            sfx('cdGo', 5.2);
            await Promise.all([runCountdown(() => gen !== lastFxId || !S.roomData), deal(state)]);
            if (gen !== lastFxId || !S.roomData) return;
        }
        else if (ev.t === 'play') await play(ev);
        else if (ev.t === 'dall') await dall(ev);
        else if (ev.t === 'banner') await banner(ev);
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
    // Pemain yang tersingkir (Mercy) pada aksi yang sama: tangan SESUDAH aksi = kartu yang tercatat di peristiwa mercy (state-nya sudah kosong)
    const mercyCards = {};
    f.list.forEach(e => { if (e.t === 'mercy') mercyCards[e.uid] = e.cards || []; });
    const after = (u) => mercyCards[u] || state.hands[u] || [];
    f.list.forEach((ev, i) => {
        if (ev.t === 'play') {
            const da = ev.card.v === 'Discard All' ? (f.list.slice(i + 1).find(e => e.t === 'banner' && e.k === 'discardall') || {}).cards : null;
            if (da && da.length) {
                // Discard All: kartu yang dibuang + kartu Discard All belum tampak di tumpukan sampai animasinya tiba; kartu sewarna tetap di tangan sampai terbang
                hold.cut = 1 + da.length;
                if (ev.uid === me && S.pendingHand && [ev.card, ...da].every(x => S.pendingHand.some(h => h.id === x.id))) {
                    hold.hands = { ...(hold.hands || {}), [me]: S.pendingHand.filter(h => h.id !== ev.card.id) }; hold.meDone = false; c.hands = true;
                } else if (ev.uid !== me) hold.keep[ev.uid] = (hold.keep[ev.uid] || 0) + da.length;
            } else { hold.pile++; c.plays++; }
            if (ev.uid === me) S.pendingHand = null;
            const scr = $('nm-screen');
            if (scr && scr.dataset.nmc && scr.dataset.nmc !== ev.color) hold.colorFrom = scr.dataset.nmc;
        }
        else if (ev.t === 'swap') {
            // tangan LAMA pemain A = tangan baru pemain B (dan sebaliknya)
            hold.hands = { ...(hold.hands || {}), [ev.a]: after(ev.b).slice(), [ev.b]: after(ev.a).slice() };
            hold.meDone = false; c.hands = true;
        }
        else if (ev.t === 'pass') {
            // kartu 0: tangan LAMA pemain p = tangan baru pemain berikutnya (searah putaran); pemain yang tersingkir pada aksi ini tetap ikut
            const alive = players.filter(p => !(state.out && state.out[p.uid]) || mercyCards[p.uid]);
            const old = {};
            const d = ev.dir || 1;
            alive.forEach((p, k) => { old[p.uid] = after(alive[((k + d) % alive.length + alive.length) % alive.length].uid).slice(); });
            ev._alive = alive.map(p => p.uid);
            hold.hands = { ...(hold.hands || {}), ...old }; hold.meDone = false; c.hands = true;
        }
        else if (ev.t === 'draw') addTransit(ev.uid, ev.n);
        else if (ev.t === 'roulette') { const scr = $('nm-screen'); if (scr && scr.dataset.nmc && scr.dataset.nmc !== ev.color) hold.colorFrom = scr.dataset.nmc; }   // warna meja berganti saat banner tampil
        else if (ev.t === 'mercy') {
            hold.mercy[ev.uid] = MERCY_LIMIT; c.mercy.push(ev.uid);
            if (ev.uid === me && ev.cards && ev.cards.length && !(hold.hands && hold.hands[me])) { hold.hands = { ...(hold.hands || {}), [me]: ev.cards.slice() }; hold.meDone = false; c.hands = true; }   // tangan sendiri tetap tampak sampai kartu terbang
        }
    });

    pending++;
    queue = queue
        .then(() => Promise.race([run(f.list, state, c), new Promise(r => setTimeout(r, 25000))]))
        .catch(e => console.error('fx', e))
        .then(() => { pending--; finish(c); });   // pending dikurangi DULU supaya renderGame di finish() boleh menampilkan tulisan STACK
}

// dipanggil saat permainan baru / keluar supaya animasi berikutnya tidak dianggap "lama"
export function resetFx() { lastFxId = null; hold.transitMe = 0; hold.transit = {}; hold.pile = 0; hold.hands = null; hold.meDone = false; hold.mercy = {}; hold.colorFrom = null; hold.cut = 0; hold.keep = {}; S.pendingHand = null; }
