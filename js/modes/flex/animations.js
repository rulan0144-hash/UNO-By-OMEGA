import { getScale } from '../../core/config.js';
import { S } from '../../core/state.js';
import { NAMES, HEX, backSrc, isWild } from './deck.js';
import { generateCardHTML, pileRot, renderGame } from './ui.js';
import { sfx } from '../../core/sound.js';
import { runCountdown } from '../../core/countdown.js';

// Semua animasi permainan Flex. Dipicu oleh daftar peristiwa (state.fx) yang dicatat di rules.js.
// Peristiwa: deal, play, draw, banner, picker, uno, catch, challenge, power.

const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise(r => setTimeout(r, reduce ? 0 : ms));

let queue = Promise.resolve();
let pending = 0;
export const whenIdle = () => queue;
export const isBusy = () => pending > 0;   // true selama ada animasi berjalan/antre

// ---- Penahan tampilan ----
// transit = kartu dalam perjalanan ke pemain (belum boleh terlihat); pile = kartu yang akan diletakkan;
// power = status Power Card yang masih ditampilkan lama sampai animasi balik Power berjalan.
const hold = { transitMe: 0, transit: {}, pile: 0, power: {} };
let lastFxId = null, cur = null;
const inFlex = () => !!S.roomData && S.roomData.mode === 'flex';

export function shownCount(uid, actual) { return Math.max(0, actual - (hold.transit[uid] || 0)); }
export function shownPower(uid, actual) { return hold.power[uid] !== undefined ? hold.power[uid] : actual; }

export function applyHold() {
    const hand = $('x-hand');
    if (!hand) return;
    const kids = [...hand.children];
    const hideFrom = kids.length - hold.transitMe;
    kids.forEach((k, i) => { k.style.visibility = i >= hideFrom ? 'hidden' : ''; });
    const pt = document.querySelector('#x-discard .pile-top');
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
        if (inFlex()) renderGame();
    }
}

function finish(c) {
    hold.transitMe = Math.max(0, hold.transitMe - Math.max(0, c.me));
    Object.keys(c.opp).forEach(u => { hold.transit[u] = Math.max(0, (hold.transit[u] || 0) - Math.max(0, c.opp[u])); });
    hold.pile = Math.max(0, hold.pile - Math.max(0, c.plays || 0));
    (c.powerUids || []).forEach(u => { delete hold.power[u]; });
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
    const d = $('x-discard');
    return rectOf((d && d.firstElementChild) || d);
}

function posOfPlayer(uid) {
    if (uid === S.currentUser?.uid) {
        const h = rectOf($('x-hand'));
        const k = getScale();
        return h && { left: h.left + h.width / 2 - 40 * k, top: h.top + 4, width: 80 * k, height: 116 * k };
    }
    return rectOf($('xstack-' + uid));
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

function flash(color) {
    const f = $('fx-flash');
    if (!f || reduce) return;
    f.style.background = HEX[color] || '#fff';
    f.classList.remove('on');
    void f.offsetWidth;
    f.classList.add('on');
    setTimeout(() => f.classList.remove('on'), 1100);
}

// Gambar besar di tengah layar. Berkas: img/flex/fx/<jenis>-<Warna>.png (UNO! memakai img/effects/uno.png)
const SND = { uno: 'uno', skip: 'skip', skipall: 'skipall', reverse: 'reverse', revskip: 'revskip', draw2: 'draw2', draw4: 'draw4', draw1all: 'draw1all', alldraw2: 'alldraw2', target2: 'target2', target4: 'target4' };
async function banner(ev) {
    const k = ev.k;
    if (k === 'allflip') return;   // Wild All Flip: efeknya = animasi Power Card tiap pemain (peristiwa 'power'), tidak ada gambar warna
    sfx(SND[k] || k);
    const el = document.createElement('div');
    el.className = 'fx-img-banner';
    const src = k === 'uno' ? 'img/effects/uno.png' : `img/flex/fx/${k}-${ev.c}.png`;
    el.innerHTML = `<img src="${src}" alt="">`;
    const tUid = ev.target || ev.uid;
    const p = tUid && S.roomData?.players.find(x => x.uid === tUid);
    if (p) { const s = document.createElement('small'); s.textContent = p.name; el.appendChild(s); }
    document.body.appendChild(el);
    setTimeout(() => el.remove(), reduce ? 0 : 1600);
    await sleep(k === 'uno' ? 1500 : 1300);
}

// Pemilih warna Wild: empat balok berputar, lalu warna pilihan menonjol
async function wildPicker(color) {
    const imgOf = (c) => c ? `img/flex/fx/wild-${c}.png` : 'img/flex/fx/wild-spin.png';
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
    if (t && ev.color) { const s2 = document.createElement('small'); s2.textContent = `Warna sebelumnya: ${NAMES[ev.color] || ev.color} — ${t.name} ${ev.ok ? 'masih punya' : 'tidak punya'} kartu warna itu`; el.appendChild(s2); }
    document.body.appendChild(el);
    setTimeout(() => el.remove(), reduce ? 0 : 1600);
    await sleep(1400);
}

// Palu terbang dari tombol UNO kecil (atau dari profil penangkap) ke pemain yang lupa UNO, lalu menghantam
async function hammer(ev) {
    const uid = ev.uid, by = ev.by;
    const mine = uid === S.currentUser?.uid;
    const target = mine ? $('x-hand') : $('xprof-' + uid);
    const r = rectOf(target) || { left: window.innerWidth / 2 - 40, top: window.innerHeight / 2, width: 80, height: 80 };
    const cx = r.left + r.width / 2;
    const byMe = by === S.currentUser?.uid;
    const btn = byMe ? $('x-btn-catch') : null;
    const src = rectOf(btn) || rectOf($('xprof-' + by)) || { left: window.innerWidth - 90, top: window.innerHeight * 0.6, width: 56, height: 56 };
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

// Kartu dimainkan: terbang ke tumpukan buangan (menghadap depan)
async function play(ev) {
    const mine = ev.uid === S.currentUser?.uid;
    const from = (mine && S.pendingFrom) || posOfPlayer(ev.uid);
    if (mine) S.pendingFrom = null;
    const top = document.querySelector('#x-discard .pile-top');
    if (top) top.style.visibility = 'hidden';
    const n = S.roomData?.gameState.discardPile.length || 1;
    sfx('card');
    await fly(cardEl(ev.card), from, discardRect(), { dur: 700, rot: pileRot(n - 1) });
    sfx('slap');
    if (cur) cur.plays = (cur.plays || 0) - 1;
    hold.pile = Math.max(0, hold.pile - 1);
    const t2 = document.querySelector('#x-discard .pile-top');
    if (t2 && hold.pile === 0) t2.style.visibility = '';
    if (isWild(ev.card)) flash(ev.color);
}

// Kartu ditarik: terbang dari dek (punggung kartu) ke tangan / profil pemain
async function draw({ uid, n, sides, pen }) {
    const deckL = rectOf($('x-draw-l')), deckR = rectOf($('x-draw-r'));
    const count = Math.min(n, 8);
    const mine = uid === S.currentUser?.uid;
    const kids = mine ? [...$('x-hand').children] : [];
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
    const decks = [rectOf($('x-draw-l')), rectOf($('x-draw-r'))];
    let dk = 0;
    const nextDeck = () => decks[dk++ % 2];
    const me = S.currentUser?.uid;
    const pile = $('x-discard');
    if (pile) pile.style.visibility = 'hidden';
    const hand = [...$('x-hand').children];
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

// Power Card berbalik: gambar efek besar (GoStop = hijau jadi merah, StopGo = merah jadi hijau) untuk perubahan Power-ku sendiri;
// kartu Power di kanan-bawah dan Power mini lawan berubah setelah efek
// Suara balik Power Card: pakai sisi flex / Wild All Flip = "All flip!", reset = "Reset!"; kartu angka berlogo Flip = "Flip!" saja
const powerSnd = (ev) => ({ flip: 'flip', allflip: 'allflip', reset: 'reset' }[ev.cause] || 'power');
async function powerFx(ev) {
    const me = S.currentUser?.uid;
    const ch = ev.changes || {};
    const mineChanged = ch[me] !== undefined;
    if (mineChanged) {
        const el = document.createElement('div');
        el.className = 'fx-img-banner';
        el.innerHTML = `<img src="img/flex/fx/flip-${ch[me] ? 'StopGo' : 'GoStop'}.png" alt="">`;
        document.body.appendChild(el);
        sfx(powerSnd(ev));
        setTimeout(() => el.remove(), reduce ? 0 : 1600);
        await sleep(950);
    } else sfx(powerSnd(ev));
    Object.keys(ch).forEach(u => { hold.power[u] = ch[u]; });
    if (inFlex()) renderGame();
    const pw = $('x-power');
    if (pw && mineChanged) { pw.classList.remove('pw-flip'); void pw.offsetWidth; pw.classList.add('pw-flip'); setTimeout(() => pw.classList.remove('pw-flip'), 700); }
    // hanya Power Card lawan yang BERUBAH yang menganimasi (dulu semua lawan ikut berputar walau tetap hijau)
    Object.keys(ch).forEach(u => {
        const e = document.getElementById('xstack-' + u)?.querySelector('.opp-power');
        if (e) { e.classList.add('pw-pop'); setTimeout(() => e.classList.remove('pw-pop'), 600); }
    });
    await sleep(mineChanged ? 650 : 450);
    if (ev.cause === 'reset') await sleep(350);
}

function restore() {
    const pile = $('x-discard');
    if (pile) pile.style.visibility = '';
    const top = document.querySelector('#x-discard .pile-top');
    if (top) top.style.visibility = '';
    if (inFlex() && S.roomData.gameState) renderGame();
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

// Urutan suara/efek satu aksi:
//  - Power "flex" (kartu dimainkan dengan Flex power) SELALU PERTAMA, sebelum efek/kartu lain;
//  - Power "flip" (kartu angka/aksi berlogo Flip) SELALU TERAKHIR, sesudah kartu, banner, UNO, dan tarik kartu;
//  - 'reset' (semua merah -> hijau) ikut kelompok Power sebelumnya.
// Sisanya: efek kartu (banner / pemilih warna) tampil dulu, baru kartunya diletakkan.
function effectsFirst(list) {
    const head = [], tail = [], rest = [];
    let lastCause = null;
    for (const ev of list) {
        if (ev.t === 'power') {
            const grp = ev.cause === 'reset' ? lastCause : ev.cause;
            if (ev.cause !== 'reset') lastCause = ev.cause;
            if (grp === 'flex') { head.push(ev); continue; }
            if (grp === 'flip') { tail.push(ev); continue; }
        }
        rest.push(ev);
    }
    const out = [...head];
    let firstPlay = true;
    for (let i = 0; i < rest.length; i++) {
        const ev = rest[i];
        if (ev.t !== 'play') { out.push(ev); continue; }
        let k = i + 1;
        const pre = [], between = [], after = [];
        while (k < rest.length && rest[k].t === 'picker') pre.push(rest[k++]);
        while (k < rest.length && (rest[k].t === 'power' || rest[k].t === 'uno')) { (rest[k].t === 'uno' ? between : after).push(rest[k]); k++; }
        while (k < rest.length && rest[k].t === 'banner') pre.push(rest[k++]);
        // preFx: ada efek yang tampil sebelum kartu mendarat (termasuk Flex power di depan) -> kartu bayangan diam di tempat asal
        out.push(...pre, { ...ev, preFx: pre.length > 0 || (firstPlay && head.length > 0) }, ...between, ...after);
        firstPlay = false;
        i = k - 1;
    }
    return [...out, ...tail];
}

async function run(list, state, c) {
    cur = c;
    let ghost = null;
    const ordered = effectsFirst(list);
    for (let i = 0; i < ordered.length; i++) {
        const ev = ordered[i];
        if (!ghost && (ev.t === 'picker' || ev.t === 'banner' || ev.t === 'power')) {
            const pl = ordered.slice(i).find(e => e.t === 'play' && e.preFx);
            const between = ordered.slice(0, i).some(e => e.t === 'play');
            if (pl && !between) {
                const top = document.querySelector('#x-discard .pile-top');
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
        else if (ev.t === 'picker') await wildPicker(ev.color);
        else if (ev.t === 'challenge') await challengeFx(ev);
        else if (ev.t === 'uno') await banner({ k: 'uno', uid: ev.uid });
        else if (ev.t === 'catch') await hammer(ev);
        else if (ev.t === 'draw') await draw(ev);
        else if (ev.t === 'power') await powerFx(ev);
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

    const c = { me: 0, opp: {}, plays: 0, powerUids: [] };
    f.list.forEach(ev => {
        if (ev.t === 'play') { hold.pile++; c.plays++; }
        else if (ev.t === 'draw') {
            if (ev.uid === me) { hold.transitMe += ev.n; c.me += ev.n; }
            else { hold.transit[ev.uid] = (hold.transit[ev.uid] || 0) + ev.n; c.opp[ev.uid] = (c.opp[ev.uid] || 0) + ev.n; }
        } else if (ev.t === 'power') {
            // tampilan Power tetap di status LAMA sampai animasinya: status lama = kebalikan dari perubahan pertama pemain itu
            Object.keys(ev.changes || {}).forEach(u => {
                if (hold.power[u] === undefined) { hold.power[u] = !ev.changes[u]; c.powerUids.push(u); }
            });
        }
    });

    pending++;
    queue = queue
        .then(() => Promise.race([run(f.list, state, c), new Promise(r => setTimeout(r, 25000))]))   // pengaman anti macet
        .catch(e => console.error('fx', e))
        .then(() => { finish(c); pending--; });
}

// dipanggil saat permainan baru / keluar supaya animasi berikutnya tidak dianggap "lama"
export function resetFx() { lastFxId = null; hold.transitMe = 0; hold.transit = {}; hold.pile = 0; hold.power = {}; }
