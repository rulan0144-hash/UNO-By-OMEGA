import { S, fx } from './state.js';
import { shuffle } from './deck.js';
import { generateCardHTML, renderGame } from './ui.js';

// Semua animasi permainan. Dipicu oleh daftar peristiwa (state.fx) yang dicatat di rules.js,
// jadi semua pemain online melihat animasi yang sama.

const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise(r => setTimeout(r, reduce ? 0 : ms));
const BACK = '<div class="uno-card card-back"><div class="oval"><span class="val-center">UNO</span></div></div>';

const BANNERS = {
    uno:     { t: 'UNO!',        c: 'fx-uno' },
    skip:    { t: '⊘ SKIP',      c: 'fx-skip' },
    reverse: { t: '🔄 REVERSE',  c: 'fx-reverse' },
    draw2:   { t: '+2',          c: 'fx-draw' },
    draw4:   { t: '+4',          c: 'fx-draw4' },
    wild:    { t: 'WILD',        c: 'fx-wild' },
    custom:  { t: 'KUSTOM',      c: 'fx-wild' },
    shuffle: { t: '🌀 ACAK!',    c: 'fx-wild' }
};

let queue = Promise.resolve();
export const whenIdle = () => queue;

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
function fly(html, from, to, { dur = 450, delay = 0, rot = 0 } = {}) {
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
    ], { duration: dur, delay, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
    return anim.finished.catch(() => {}).then(() => el.remove());
}

function faceHTML(card, color) {
    const bg = card.color === 'Black' ? color : card.color;
    return `<div class="uno-card bg-${bg}">${generateCardHTML(card)}</div>`;
}

// Tulisan besar di tengah layar
async function banner(k, uid) {
    const b = BANNERS[k];
    if (!b) return;
    const el = document.createElement('div');
    el.className = 'fx-banner ' + b.c;
    el.textContent = b.t;
    const p = uid && S.roomData?.players.find(x => x.uid === uid);
    if (p) { const s = document.createElement('small'); s.textContent = p.name; el.appendChild(s); }
    document.body.appendChild(el);
    setTimeout(() => el.remove(), reduce ? 0 : 1000);
    await sleep(k === 'uno' ? 900 : 750);
}

// Palu menghantam profil pemain yang lupa UNO
async function hammer(uid) {
    const mine = uid === S.currentUser?.uid;
    const target = mine ? $('human-hand-ui') : $('prof-' + uid);
    const r = rectOf(target) || { left: window.innerWidth / 2 - 40, top: window.innerHeight / 2, width: 80, height: 80 };
    const cx = r.left + r.width / 2;
    const top = mine ? r.top - 30 : r.top + 10;
    const h = document.createElement('div');
    h.className = 'fx-hammer'; h.textContent = '🔨';
    h.style.left = (cx - 36) + 'px'; h.style.top = (top - 30) + 'px';
    const b = document.createElement('div');
    b.className = 'fx-boom'; b.textContent = '💥';
    b.style.left = (cx - 36) + 'px'; b.style.top = (top + 10) + 'px';
    document.body.append(h, b);
    setTimeout(() => target && target.classList.add('fx-shake'), reduce ? 0 : 560);
    setTimeout(() => { h.remove(); b.remove(); target && target.classList.remove('fx-shake'); }, reduce ? 0 : 1000);
    await sleep(1000);
}

// Kartu dimainkan: terbang dari pemain ke tumpukan buangan
async function play(ev) {
    const mine = ev.uid === S.currentUser?.uid;
    const from = (mine && S.pendingFrom) || posOfPlayer(ev.uid);
    if (mine) S.pendingFrom = null;
    const pile = $('discard-pile-ui');
    if (pile) pile.style.visibility = 'hidden';
    await fly(faceHTML(ev.card, ev.color), from, discardRect(), { dur: 420, rot: Math.random() * 16 - 8 });
    if (pile) pile.style.visibility = '';
}

// Kartu ditarik: terbang dari tumpukan ke tangan / profil pemain
async function draw({ uid, n }) {
    const deck = rectOf($('draw-pile-ui'));
    const count = Math.min(n, 6);
    const jobs = [];
    if (uid === S.currentUser?.uid) {
        const kids = [...$('human-hand-ui').children].slice(-n).slice(0, count);
        kids.forEach(k => { k.style.visibility = 'hidden'; });
        kids.forEach((k, i) => jobs.push(
            fly(BACK, deck, clampRect(rectOf(k)), { delay: i * 130 }).then(() => { k.style.visibility = ''; })
        ));
    } else {
        const to = posOfPlayer(uid);
        for (let i = 0; i < count; i++) jobs.push(fly(BACK, deck, to, { delay: i * 130 }));
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
        fly(BACK, deck, clampRect(rectOf(k)), { dur: 420, delay: i * 110 }).then(() => { k.style.visibility = ''; })
    ));
    Object.keys(state.hands).filter(u => u !== me).forEach((u, pi) => {
        const to = posOfPlayer(u);
        for (let i = 0; i < Math.min(state.hands[u].length, 7); i++) jobs.push(fly(BACK, deck, to, { dur: 420, delay: i * 110 + pi * 45 }));
    });
    await Promise.all(jobs);
    if (pile) { pile.style.visibility = ''; pile.classList.add('fx-pop-in'); setTimeout(() => pile.classList.remove('fx-pop-in'), 400); }
}

function restore() {
    const pile = $('discard-pile-ui');
    if (pile) pile.style.visibility = '';
    const hand = $('human-hand-ui');
    if (hand) [...hand.children].forEach(k => { k.style.visibility = ''; });
}

async function run(list, state) {
    for (const ev of list) {
        if (ev.t === 'deal') await deal(state);
        else if (ev.t === 'play') await play(ev);
        else if (ev.t === 'banner') await banner(ev.k);
        else if (ev.t === 'uno') await banner('uno', ev.uid);
        else if (ev.t === 'catch') await hammer(ev.uid);
        else if (ev.t === 'draw') await draw(ev);
    }
}

// Dipanggil setiap selesai renderGame(); memutar animasi baru satu kali saja
export function handleFx(state) {
    const f = state.fx;
    if (!f || !f.list) return;
    if (S.fxRoom !== S.currentRoomCode) { S.fxRoom = S.currentRoomCode; S.lastFxId = null; }
    if (S.lastFxId === f.id) return;
    const firstRender = S.lastFxId === null;
    S.lastFxId = f.id;
    // Masuk ke game yang sedang berjalan: jangan putar animasi lama
    if (firstRender && !f.list.some(e => e.t === 'deal')) return;
    queue = queue.then(() => run(f.list, state)).catch(e => console.error('fx', e)).then(restore);
}
