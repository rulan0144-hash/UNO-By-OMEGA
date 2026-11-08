import { getScale } from '../../core/config.js';
import { S } from '../../core/state.js';
import { NAMES, cardSrc, face, imgTag, oppSide } from './deck.js';
import { generateCardHTML, pileRot, renderGame, fanClose, fanOpen } from './ui.js';
import { sfx, sayAsync } from '../../core/sound.js';

// Semua animasi permainan Flip. Dipicu oleh daftar peristiwa (state.fx) yang dicatat di rules.js.
// Peristiwa: deal, play, draw, banner, picker, uno, catch, challenge, flip.

const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise(r => setTimeout(r, reduce ? 0 : ms));
const HEX = { Red: '#ef4444', Yellow: '#eab308', Green: '#22c55e', Blue: '#3b82f6', Pink: '#ec4899', Teal: '#14b8a6', Orange: '#f97316', Purple: '#a855f7' };

let queue = Promise.resolve();
let pending = 0;
export const whenIdle = () => queue;
export const isBusy = () => pending > 0;   // true selama ada animasi berjalan/antre

// ---- Penahan tampilan ----
// transit = kartu yang sedang dalam perjalanan ke pemain (belum boleh terlihat)
// side    = sisi lama yang tetap tampil sampai animasi Flip membalik semuanya
const hold = { transitMe: 0, transit: {}, side: null };
let lastFxId = null, cur = null;
export const viewSide = (state) => hold.side || state.side;

export function shownCount(uid, actual) { return Math.max(0, actual - (hold.transit[uid] || 0)); }

export function applyHold() {
    const hand = $('f-hand');
    if (!hand) return;
    const kids = [...hand.children];
    const hideFrom = kids.length - hold.transitMe;
    kids.forEach((k, i) => { k.style.visibility = i >= hideFrom ? 'hidden' : ''; });
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
        if (S.roomData) renderGame();
    }
}

function finish(c) {
    hold.transitMe = Math.max(0, hold.transitMe - Math.max(0, c.me));
    Object.keys(c.opp).forEach(u => { hold.transit[u] = Math.max(0, (hold.transit[u] || 0) - Math.max(0, c.opp[u])); });
    if (c.flip) hold.side = null;
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
    const d = $('f-discard');
    return rectOf((d && d.firstElementChild) || d);
}

function posOfPlayer(uid) {
    if (uid === S.currentUser?.uid) {
        const h = rectOf($('f-hand'));
        const k = getScale();
        return h && { left: h.left + h.width / 2 - 40 * k, top: h.top + 4, width: 80 * k, height: 116 * k };
    }
    return rectOf($('fstack-' + uid));
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

const cardEl = (card, side) => `<div class="uno-card">${generateCardHTML(card, side)}</div>`;

function flash(color) {
    const f = $('fx-flash');
    if (!f || reduce) return;
    f.style.background = HEX[color] || '#fff';
    f.classList.remove('on');
    void f.offsetWidth;
    f.classList.add('on');
    setTimeout(() => f.classList.remove('on'), 1100);
}

// Gambar besar di tengah layar. Berkas: img/flip/fx/<jenis>-<Warna>.png (UNO! memakai img/effects/uno.png)
const SND = { uno: 'uno', skip: 'skip', skipall: 'skipall', reverse: 'reverse', draw1: 'draw1', draw2: 'draw2', draw5: 'draw5', wdc: 'wdc' };
async function banner(k, uid, ev) {
    sfx(SND[k] || k);
    const el = document.createElement('div');
    el.className = 'fx-img-banner';
    const src = k === 'uno' ? 'img/effects/uno.png' : `img/flip/fx/${k}-${ev && ev.c}.png`;
    el.innerHTML = `<img src="${src}" alt="">`;
    const p = uid && S.roomData?.players.find(x => x.uid === uid);
    if (p) { const s = document.createElement('small'); s.textContent = p.name; el.appendChild(s); }
    document.body.appendChild(el);
    setTimeout(() => el.remove(), reduce ? 0 : 1600);
    await sleep(k === 'uno' ? 1500 : 1300);
}

// Pemilih warna Wild: empat balok berputar, lalu warna pilihan menonjol (gambar sesuai sisi)
async function wildPicker(color, side) {
    const imgOf = (c) => side === 'dark' ? (c ? `img/flip/fx/wild-${c}.png` : 'img/flip/fx/wild-spin-dark.png') : (c ? `img/effects/wild-${c}.png` : 'img/effects/wild-spin.png');
    const el = document.createElement('div');
    el.className = 'fx-picker';
    el.innerHTML = `<img class="fx-picker-img fx-picker-spin" src="${imgOf()}" alt=""><div class="fx-picker-name"></div>`;
    document.body.appendChild(el);
    sfx('spin');
    await sleep(900);
    sfx('c_' + color);
    const img = el.querySelector('img');
    img.classList.remove('fx-picker-spin');
    img.src = imgOf(color);
    img.classList.add('fx-picker-pop');
    const name = el.querySelector('.fx-picker-name');
    name.textContent = NAMES[color] || color;
    name.className = 'fx-picker-name fx-pn-' + color;
    await sleep(1100);
    el.classList.add('fx-picker-out');
    setTimeout(() => el.remove(), reduce ? 0 : 400);
    await sleep(350);
}

async function challengeFx(ev) {
    const el = document.createElement('div');
    el.className = 'fx-banner ' + (ev.ok ? 'fx-ok' : 'fx-fail');
    el.innerHTML = `<span>${ev.ok ? 'BENAR!' : 'SALAH!'}</span>`;
    sfx(ev.ok ? 'challengeRight' : 'challengeWrong');
    const p = S.roomData?.players.find(x => x.uid === ev.by);
    const t = S.roomData?.players.find(x => x.uid === ev.target);
    if (p && t) { const s = document.createElement('small'); s.textContent = `${p.name} menantang ${t.name}`; el.appendChild(s); }
    document.body.appendChild(el);
    setTimeout(() => el.remove(), reduce ? 0 : 1600);
    await sleep(1400);
}

async function hammer(uid) {
    const mine = uid === S.currentUser?.uid;
    const target = mine ? $('f-hand') : $('fprof-' + uid);
    const r = rectOf(target) || { left: window.innerWidth / 2 - 40, top: window.innerHeight / 2, width: 80, height: 80 };
    const cx = r.left + r.width / 2;
    const h = document.createElement('div');
    h.className = 'fx-hammer'; h.innerHTML = '<img src="img/effects/hammer.png" alt="">';
    h.style.left = (cx - 46) + 'px'; h.style.top = (r.top - 80) + 'px';
    const b = document.createElement('div');
    b.className = 'fx-boom'; b.innerHTML = '<img src="img/effects/boom.png" alt="">';
    b.style.left = (cx - 42) + 'px'; b.style.top = (r.top - 8) + 'px';
    document.body.append(h, b);
    sfx('swing');
    sfx('catch', reduce ? 0 : 0.93);
    setTimeout(() => target && target.classList.add('fx-shake'), reduce ? 0 : 930);
    setTimeout(() => { h.remove(); b.remove(); target && target.classList.remove('fx-shake'); }, reduce ? 0 : 1600);
    await sleep(1600);
}

// Kartu dimainkan: terbang ke tumpukan buangan (sisi saat dimainkan)
async function play(ev) {
    const mine = ev.uid === S.currentUser?.uid;
    const from = (mine && S.pendingFrom) || posOfPlayer(ev.uid);
    if (mine) S.pendingFrom = null;
    const top = document.querySelector('#f-discard .pile-top');
    if (top) top.style.visibility = 'hidden';
    const n = S.roomData?.gameState.discardPile.length || 1;
    sfx('card');
    await fly(cardEl(ev.card, ev.side), from, discardRect(), { dur: 700, rot: pileRot(n - 1) });
    sfx('slap');
    if (top) top.style.visibility = '';
    if (face(ev.card, ev.side).color === 'Black') flash(ev.color);
}

// Kartu ditarik: terbang dari dek (menampilkan sisi seberang) ke tangan / profil pemain
async function draw({ uid, n, sides, cards }) {
    const deckL = rectOf($('f-draw-l')), deckR = rectOf($('f-draw-r'));
    const count = Math.min(n, 8);
    const mine = uid === S.currentUser?.uid;
    const kids = mine ? [...$('f-hand').children] : [];
    const jobs = [];
    const other = oppSide(S.roomData.gameState.side);
    if (n >= 6) sfx('draw6');
    for (let i = 0; i < count; i++) {
        sfx('draw', i * 0.22);
        const to = mine ? (clampRect(rectOf(kids[kids.length - n + i])) || posOfPlayer(uid)) : posOfPlayer(uid);
        const deck = (sides && sides[i] === 'R') ? deckR : deckL;
        const html = cards && cards[i] ? cardEl(cards[i], other) : '';
        jobs.push(fly(html, deck, to, { delay: i * 220 }).then(() => land(uid)));
    }
    // kartu sisa (lebih dari 8) langsung dianggap tiba
    for (let i = count; i < n; i++) land(uid);
    await Promise.all(jobs);
}

// Awal ronde: kartu dibagikan satu per satu dari dua dek
async function deal(state) {
    const decks = [rectOf($('f-draw-l')), rectOf($('f-draw-r'))];
    let dk = 0;
    const nextDeck = () => decks[dk++ % 2];
    const me = S.currentUser?.uid;
    const other = oppSide(state.side);
    const pile = $('f-discard');
    if (pile) pile.style.visibility = 'hidden';
    const hand = [...$('f-hand').children];
    hand.forEach(k => { k.style.visibility = 'hidden'; });
    const jobs = [];
    const dealSfx = (i, extra = 0) => sfx('deal', (i * 170 + extra) / 1000 + 0.05);
    hand.forEach((k, i) => dealSfx(i));
    hand.forEach((k, i) => jobs.push(
        fly(cardEl(state.hands[me][i], other), nextDeck(), clampRect(rectOf(k)), { dur: 650, delay: i * 170 }).then(() => { k.style.visibility = ''; })
    ));
    Object.keys(state.hands).filter(u => u !== me).forEach((u, pi) => {
        const to = posOfPlayer(u);
        const n = Math.min(state.hands[u].length, 7);
        for (let i = 0; i < n; i++) dealSfx(i, pi * 70);
        for (let i = 0; i < n; i++) jobs.push(fly(cardEl(state.hands[u][i], other), nextDeck(), to, { dur: 650, delay: i * 170 + pi * 70 }));
    });
    await Promise.all(jobs);
    if (pile) { pile.style.visibility = ''; pile.classList.add('fx-pop-in'); setTimeout(() => pile.classList.remove('fx-pop-in'), 500); }
}

// FLIP: tulisan besar; kartu di tangan menutup lalu membuka dengan sisi baru; dek, buangan, dan kartu lawan membalik
const flipPiles = () => ['f-discard', 'f-draw-l', 'f-draw-r'].map($).filter(Boolean).concat([...document.querySelectorAll('#f-opps .opp-stack')]);
async function flipAnim(ev) {
    const el = document.createElement('div');
    el.className = 'fx-img-banner';
    el.innerHTML = `<img src="img/flip/fx/flip-${ev.to}.png" alt="">`;
    document.body.appendChild(el);
    sfx('flip');
    setTimeout(() => el.remove(), reduce ? 0 : 1600);
    await sleep(1000);
    fanClose();
    flipPiles().forEach(e => { e.classList.remove('flip-x-in'); e.classList.add('flip-x-out'); });
    await sleep(420);
    hold.side = null;                       // ganti ke sisi baru saat semuanya tertutup
    if (S.roomData) renderGame();
    flipPiles().forEach(e => { e.classList.remove('flip-x-out'); void e.offsetWidth; e.classList.add('flip-x-in'); });
    fanOpen();
    await sleep(500);
    flipPiles().forEach(e => e.classList.remove('flip-x-in'));
}

function restore() {
    const pile = $('f-discard');
    if (pile) pile.style.visibility = '';
    const top = document.querySelector('#f-discard .pile-top');
    if (top) top.style.visibility = '';
    flipPiles().forEach(e => e.classList.remove('flip-x-out', 'flip-x-in'));
    if (S.roomData && S.roomData.gameState) renderGame();
}

// Kartu "bayangan" yang diam di posisi asal selama efeknya tampil (kartu belum diletakkan)
function ghostCard(ev) {
    const mine = ev.uid === S.currentUser?.uid;
    const from = (mine && S.pendingFrom) || posOfPlayer(ev.uid);
    if (!from) return null;
    const el = document.createElement('div');
    el.className = 'fly-card';
    el.innerHTML = cardEl(ev.card, mine ? ev.side : oppSide(ev.side));   // kartu lawan baru menghadap depan setelah efek
    const a = center(from);
    el.style.left = (a.x - 40) + 'px';
    el.style.top = (a.y - 58) + 'px';
    el.style.transform = `scale(${from.width / 80})`;
    document.body.appendChild(el);
    return el;
}

// Efek kartu (banner / pemilih warna) tampil dulu, baru kartunya diletakkan.
function effectsFirst(list) {
    const out = [];
    for (let i = 0; i < list.length; i++) {
        const ev = list[i];
        if (ev.t !== 'play') { out.push(ev); continue; }
        let k = i + 1;
        const pre = [], between = [];
        while (k < list.length && list[k].t === 'picker') pre.push(list[k++]);
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
        if (!ghost && (ev.t === 'picker' || ev.t === 'banner')) {
            const pl = ordered.slice(i).find(e => e.t === 'play' && e.preFx);
            const between = ordered.slice(0, i).some(e => e.t === 'play');
            if (pl && !between) {
                const top = document.querySelector('#f-discard .pile-top');
                if (top) top.style.visibility = 'hidden';
                ghost = ghostCard(pl);
            }
        }
        if (ev.t === 'play' && ghost) { ghost.remove(); ghost = null; }
        if (ev.t === 'deal') await deal(state);
        else if (ev.t === 'play') await play(ev);
        else if (ev.t === 'banner') await banner(ev.k, undefined, ev);
        else if (ev.t === 'picker') await wildPicker(ev.color, ev.side);
        else if (ev.t === 'challenge') await challengeFx(ev);
        else if (ev.t === 'uno') await banner('uno', ev.uid);
        else if (ev.t === 'catch') await hammer(ev.uid);
        else if (ev.t === 'draw') await draw(ev);
        else if (ev.t === 'flip') await flipAnim(ev);
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

    const c = { me: 0, opp: {}, flip: false };
    f.list.forEach(ev => {
        if (ev.t === 'draw') {
            if (ev.uid === me) { hold.transitMe += ev.n; c.me += ev.n; }
            else { hold.transit[ev.uid] = (hold.transit[ev.uid] || 0) + ev.n; c.opp[ev.uid] = (c.opp[ev.uid] || 0) + ev.n; }
        } else if (ev.t === 'flip') {
            c.flip = true;
            hold.side = ev.from;          // tampilan tetap di sisi lama sampai animasi Flip
        }
    });

    pending++;
    queue = queue
        .then(() => Promise.race([run(f.list, state, c), new Promise(r => setTimeout(r, 25000))]))   // pengaman anti macet
        .catch(e => console.error('fx', e))
        .then(() => { finish(c); pending--; });
}

// dipanggil saat ronde baru / keluar supaya animasi ronde berikutnya tidak dianggap "lama"
export function resetFx() { lastFxId = null; hold.transitMe = 0; hold.transit = {}; hold.side = null; }
