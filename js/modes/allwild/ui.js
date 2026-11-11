// Tampilan UNO All Wild (layar #aw-screen, id berawalan w-). Kontrak dengan actions.js: renderGame, handleGameOver, askColor, askTarget, closeAsks.
import { doubleTapTarget } from '../../core/doubletap.js';
import { getScale } from '../../core/config.js';
import { fitOpponents } from '../../core/oppfit.js';
import { syncTimer } from './timer.js';
import { S, esc } from '../../core/state.js';
import { NAMES, HEX, cardSrc, backSrc } from './deck.js';
import { actorUid, canCallUno, isCatchable, isMyTurn } from './rules.js';
import { applyHold, handleFx, resetFx, shownCount, whenIdle } from './animations.js';
import { sfx, sayAsync, startMusic, stopMusic } from '../../core/sound.js';
import { go } from '../../app/router.js';
import { fillOver } from '../../core/series.js';

const $ = (id) => document.getElementById(id);
const imgTag = (src) => `<img class="card-img" src="${src}" alt="" draggable="false">`;
export const generateCardHTML = (card) => imgTag(cardSrc(card));
const backHTML = () => imgTag(backSrc());
export function pileRot(i) { return ((i * 53) % 17) - 8; }

window.awLeave = () => {
    if (S.roomUnsubscribe) { S.roomUnsubscribe(); S.roomUnsubscribe = null; }
    clearTimeout(S.botTimer);
    S.localMode = false;
    S.currentUser = S.fbUser;
    S.currentRoomCode = null;
    S.roomData = null;
    S.hasDrawnThisTurn = false;
    S.paused = false;
    S.winSoundKey = null; S.winShown = null;
    S.selIdx = -1; S.selCard = null;
    closeAsks();
    stopMusic();
    resetFx();
    if (window.stopAwTimerHook) window.stopAwTimerHook();
    ['w-pause-modal', 'w-over-modal', 'w-color-modal', 'w-target-modal'].forEach(id => $(id).classList.add('hidden'));
    go('home-screen');
};

// ---------- RENDER ----------
export function renderGame() {
    const state = S.roomData.gameState;
    const me = S.currentUser.uid;
    if (S.roomData.status === 'playing') startMusic('allwild');   // aman dipanggil berulang
    handleFx(state);   // mencatat animasi baru & menahan tampilan
    const players = S.roomData.players;
    const aUid = actorUid(state);

    // Lawan: tumpukan kartu menghadap belakang + Power Card mini
    const oppArea = $('w-opps');
    oppArea.innerHTML = '';
    const myIdx = players.findIndex(p => p.uid === me);
    for (let i = 1; i < players.length; i++) {
        const p = players[(myIdx + i) % players.length];
        const isTurn = players[state.turnIndex].uid === p.uid || aUid === p.uid;
        const count = shownCount(p.uid, state.hands[p.uid].length);
        let stackHTML = '';
        for (let c = 0; c < Math.min(count, 5); c++) stackHTML += `<div class="uno-card opponent-card st-${c}">${backHTML()}</div>`;
        const calledBadge = (count === 1 && state.unoCalled[p.uid]) ? `<div class="absolute top-0 -left-4 z-20 bg-green-600 text-[10px] px-1 rounded border border-white">UNO ✓</div>` : '';
        const catchBtn = isCatchable(state, p.uid) ? `<img class="catch-hammer" src="img/effects/hammer.png" alt="">` : '';
        oppArea.innerHTML += `
            <div id="wprof-${p.uid}" onclick="awCatch('${p.uid}')" class="opp-profile ${isTurn ? 'is-turn' : ''}">
                <div id="wstack-${p.uid}" class="opp-stack">
                    ${stackHTML}
                    <div class="count-badge">${count}</div>
                    ${calledBadge}${catchBtn}
                </div>
                <div class="opp-avatar">${avatarHTML(p, isTurn, 'opp')}</div>
                <span class="name-tag ${isTurn ? 'name-turn' : ''} ">${esc(p.name)}</span>
            </div>`;
    }
    fitOpponents(oppArea);

    // Dek kiri & kanan (kartu Flex satu sisi: tampil punggung)
    [['w-draw-l', 'w-count-l', state.deck], ['w-draw-r', 'w-count-r', state.deckR || []]].forEach(([id, cid, deck]) => {
        const el = $(id);
        el.innerHTML = deck.length ? backHTML() : '<div class="deck-void"></div>';
        el.classList.toggle('deck-empty', deck.length === 0);
        el.classList.toggle('deck-ready', isMyTurn() && !S.hasDrawnThisTurn && deck.length > 0);
        $(cid).innerText = deck.length;
    });

    // Tumpukan buangan (kartu teratas bercahaya: warna pilihan untuk Wild, warna flex bila dimainkan di sisi flex)
    const pile = state.discardPile, n = pile.length, top = pile[n - 1];
    if (top) {
        let stack = '';
        for (let i = Math.max(0, n - 5); i < n - 1; i++) {
            stack += `<div class="uno-card pile-card" style="--dx:${((i * 29) % 9) - 4}px;--dy:${((i * 17) % 7) - 3}px;--rot:${pileRot(i)}deg">${generateCardHTML(pile[i])}</div>`;
        }
        const glowC = state.currentColor;
        const glow = glowC && HEX[glowC] ? ' glow-c' : '';
        stack += `<div class="uno-card pile-card pile-top${glow}" style="--dx:0px;--dy:0px;--rot:${pileRot(n - 1)}deg;--glow:${HEX[glowC] || '#fff'}">${generateCardHTML(top)}</div>`;
        $('w-discard').innerHTML = `<div class="pile-wrap">${stack}</div>`;
    }
    const badge = $('w-badge');
    badge.className = 'color-badge text-white border-2 border-white';
    badge.style.background = HEX[state.currentColor] || '#374151';
    badge.innerText = `Warna: ${NAMES[state.currentColor] || state.currentColor}`;
    const scr = $('aw-screen');
    if (scr) { ['Red', 'Yellow', 'Green', 'Blue'].forEach(c => scr.classList.toggle('aw-c-' + c, c === state.currentColor)); }   // meja berganti warna mengikuti warna terpilih

    // Tangan
    const handUI = $('w-hand');
    handUI.innerHTML = '';
    const myHand = state.hands[me] || [];
    myHand.forEach((card, idx) => {
        let isPlay = isMyTurn();                                   // semua kartu boleh dimainkan
        if (S.hasDrawnThisTurn && idx !== myHand.length - 1) isPlay = false;
        const c = document.createElement('div');
        c.className = `uno-card ${isPlay ? 'playable' : 'unplayable'}`;
        c.onclick = (e) => tapCard(idx, e);
        c.addEventListener('pointerdown', (e) => startDrag(e, idx, c));
        c.innerHTML = generateCardHTML(card);
        handUI.appendChild(c);
    });
    const sc = S.selCard;
    if (S.selIdx >= 0 && !(sc && myHand[S.selIdx] && myHand[S.selIdx].id === sc.id)) S.selIdx = -1;
    layoutHand();
    markSelected();

    // Profil saya
    const meP = players.find(p => p.uid === me);
    const meAv = $('w-me-avatar');
    if (meAv && meP) {
        const mineCatch = isCatchable(state, me);
        meAv.innerHTML = avatarHTML(meP, aUid === me, 'me') + (mineCatch ? `<img class="catch-hammer" src="img/effects/hammer.png" alt="" onclick="showToast('Kamu lupa UNO! Tekan tombol UNO sekarang.')">` : '');
    }

    // Tombol UNO kecil (tangkap): menyala bila ada lawan yang lupa UNO
    const anyCatch = players.some(p => p.uid !== me && isCatchable(state, p.uid));
    $('w-btn-catch').classList.toggle('catch-ready', anyCatch);

    const btnUno = $('w-btn-uno');
    btnUno.classList.toggle('animate-pulse', canCallUno(state));
    btnUno.classList.toggle('opacity-50', !!state.unoCalled[me]);
    btnUno.classList.toggle('uno-ready', canCallUno(state) && !state.unoCalled[me]);
    btnUno.classList.toggle('uno-done', !!state.unoCalled[me]);

    // Giliran (di bawah timer). Pelaku bisa BUKAN pemegang giliran saat pemain ditunjuk menjawab Wild Draw 4.
    const btnPass = $('w-btn-pass');
    const ti = $('w-turn-ind');
    const aName = (players.find(p => p.uid === aUid) || {}).name || '?';
    if (aUid === me) {
        ti.innerText = S.hasDrawnThisTurn ? 'Main atau Lewati!' : 'Giliran Kamu!';
        ti.className = 'text-lg md:text-2xl font-black text-green-400 animate-pulse';
        btnPass.classList.toggle('hidden', !S.hasDrawnThisTurn);
    } else {
        ti.innerText = `Giliran ${aName}`;
        ti.className = 'text-lg md:text-2xl font-bold text-yellow-400';
        btnPass.classList.add('hidden');
        S.hasDrawnThisTurn = false;
    }
    const ring = $('w-dir-ring');
    if (ring) ring.classList.toggle('ccw', state.direction !== 1);

    applyHold();
    syncTimer(state);
}

// ---------- tangan seperti dipegang (kipas), sama dengan mode lain ----------
export function layoutHand() {
    const h = $('w-hand');
    if (!h) return;
    const kids = [...h.children];
    if (!kids.length) return;
    const cs = getComputedStyle(h);
    const W = h.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const w = kids[0].offsetWidth, ch = kids[0].offsetHeight;
    if (!W || !w) return;
    const k = kids.length;
    const R = 1.5 * ch;
    const MAX_TOTAL = 52 * Math.PI / 180;
    let step = 0, dth = 0;
    if (k > 1) {
        step = Math.min(0.5 * w, Math.max(0.1 * w, (W - 1.45 * w) / (k - 1)));
        dth = Math.min(step / (R + ch / 2), MAX_TOTAL / (k - 1));
    }
    h.style.setProperty('--pivot', R + 'px');
    kids.forEach(e => { e.style.transition = 'none'; });
    h.style.justifyContent = 'center';
    kids.forEach((e, i) => {
        const deg = k > 1 ? ((i - (k - 1) / 2) * dth) * 180 / Math.PI : 0;
        e.classList.add('fan-card');
        e.style.setProperty('--rot', deg.toFixed(2) + 'deg');
        e.style.marginLeft = i ? (-w) + 'px' : '0';
    });
    void h.offsetWidth;
    kids.forEach(e => { e.style.transition = ''; });
}

function markSelected() {
    const h = $('w-hand');
    if (!h) return;
    [...h.children].forEach((k, i) => k.classList.toggle('selected', i === S.selIdx));
}

// Seret kartu ke atas ke arah tumpukan di tengah meja, lepas = dimainkan.
let drag = null, justDragged = false;
function overPile(e) {
    const pile = $('w-discard');
    const r = pile && pile.getBoundingClientRect();
    const near = r && e.clientX > r.left - 40 && e.clientX < r.right + 40 && e.clientY > r.top - 40 && e.clientY < r.bottom + 40;
    return !!near || (drag && drag.dy < -70 * getScale());
}
function startDrag(e, idx, el) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag = { idx, el, x0: e.clientX, y0: e.clientY, dy: 0, moved: false, id: e.pointerId };
}
function endDrag(e, cancel) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const d = drag; drag = null;
    const pile = $('w-discard');
    if (pile) pile.classList.remove('drop-ready');
    if (!d.moved) return;
    justDragged = true; setTimeout(() => { justDragged = false; }, 50);
    const drop = !cancel && d.ready;
    if (drop && d.el.isConnected) { S.selIdx = -1; window.awPlay(d.idx); }
    d.el.classList.remove('dragging');
    d.el.style.transform = '';
    markSelected();
}
window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.el.isConnected) { drag = null; return; }
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved) {
        if (Math.hypot(dx, dy) < 12) return;
        if (Math.abs(dx) > Math.abs(dy) * 1.5) { drag = null; return; }
        drag.moved = true;
        S.selIdx = -1; markSelected();
        drag.el.classList.add('dragging');
    }
    drag.dy = dy;
    drag.el.style.transform = `translate(${dx}px, ${dy}px) rotate(var(--rot, 0deg))`;
    drag.ready = overPile(e);
    const pile = $('w-discard');
    if (pile) pile.classList.toggle('drop-ready', !!drag.ready);
}, { passive: true });
window.addEventListener('pointerup', (e) => endDrag(e, false));
window.addEventListener('pointercancel', (e) => endDrag(e, true));

// Ketuk 2x cepat = langsung dimainkan; ketuk sekali = terangkat, ketuk lagi = dimainkan
function tapCard(idx, ev) {
    if (justDragged) return;
    const first = doubleTapTarget(idx, ev);
    if (first >= 0) { S.selIdx = -1; markSelected(); window.awPlay(first); return; }
    if (S.selIdx === idx) { S.selIdx = -1; markSelected(); window.awPlay(idx); return; }
    const hand = S.roomData && S.roomData.gameState.hands[S.currentUser.uid];
    S.selIdx = idx;
    S.selCard = (hand || [])[idx] || null;
    markSelected();
}
window.addEventListener('resize', () => requestAnimationFrame(layoutHand));
window.addEventListener('orientationchange', () => setTimeout(layoutHand, 200));
document.addEventListener('click', (e) => {
    const scr = $('aw-screen');
    if (!scr || scr.classList.contains('hidden')) return;
    if (S.selIdx >= 0 && !(e.target.closest && e.target.closest('#w-hand'))) { S.selIdx = -1; markSelected(); }
});

// ---------- pilihan pemain (Promise): sisi kartu, warna Wild, pemain target ----------
let askResolve = null;
const ASKS = ['w-color-modal', 'w-target-modal'];
function hideAsks() { ASKS.forEach(id => { const m = $(id); if (m) m.classList.add('hidden'); }); }
function settle(v) { const r = askResolve; askResolve = null; hideAsks(); if (r) r(v); }
function ask(modalId) {
    return new Promise((res) => {
        if (askResolve) askResolve(null);
        askResolve = res;
        hideAsks();
        $(modalId).classList.remove('hidden');
    });
}
export function closeAsks() { settle(null); }
window.awPickColor = (c) => settle(c);
window.awPickTarget = (uid) => settle(uid);
window.awCancelAsk = () => settle(null);

// warna yang dipilih atau null
export function askColor() {
    $('w-cp-img').src = 'img/allwild/fx/wild-spin.png';
    return ask('w-color-modal');
}
// uid lawan yang dipilih atau null (Targeted Draw Two / Forced Swap)
export function askTarget(state, card) {
    const me = S.currentUser.uid;
    $('w-target-title').textContent = card && card.v === 'Forced Swap' ? 'Tukar tangan dengan siapa?' : 'Siapa yang ambil 2 kartu?';
    $('w-target-list').innerHTML = S.roomData.players.filter(p => p.uid !== me).map(p =>
        `<button class="w-target-btn" data-u="${esc(p.uid)}" onclick="awPickTarget(this.dataset.u)">${esc(p.name)}<small>${(state.hands[p.uid] || []).length} kartu</small></button>`).join('');
    return ask('w-target-modal');
}

// ---------- akhir permainan ----------
export function handleGameOver() {
    const state = S.roomData.gameState;
    const winnerUid = state.winner;
    const winnerObj = S.roomData.players.find(p => p.uid === winnerUid);
    let breakdownHTML = '';
    S.roomData.players.forEach(p => {
        if (p.uid === winnerUid) return;
        const d = (state.roundDetail || []).find(x => x.uid === p.uid) || { n: 0, pts: 0 };
        breakdownHTML += `
            <div class="flex justify-between bg-gray-800 p-2 rounded">
                <span><b class="text-white">${esc(p.name)}</b> (${d.n} Kartu)</span>
                <span class="text-red-400 font-bold">+${d.pts} pts</span>
            </div>`;
    });
    $('w-winner-text').innerText = (winnerUid === S.currentUser.uid) ? 'Kamu Menang!' : `${winnerObj ? winnerObj.name : '?'} Menang!`;
    $('w-score-text').innerText = `Total Skor: ${state.roundPts || 0} Poin`;
    $('w-score-breakdown').innerHTML = breakdownHTML || '<div class="text-center text-gray-500">Tidak ada sisa poin.</div>';
    fillOver('x-', winnerUid, state.roundPts || 0);   // papan skor ronde + tombol Lanjut ronde / Main Lagi / Beranda

    // Urutan: animasi kartu terakhir selesai -> "UNO game!" -> layar poin + nada menang/kalah
    const key = S.currentRoomCode + ':' + (S.roomData.gameId || '') + ':' + (state.turnNo || 0) + ':' + winnerUid;
    if (S.winShown === key) { $('w-over-modal').classList.remove('hidden'); return; }
    if (S.winSoundKey === key) return;
    S.winSoundKey = key;
    stopMusic(0.4);
    whenIdle().then(() => sayAsync('Uno game!')).then(() => {
        if (S.winSoundKey !== key || !S.roomData || S.roomData.status !== 'finished') return;
        S.winShown = key;
        $('w-over-modal').classList.remove('hidden');
        sfx(winnerUid === S.currentUser.uid ? 'win' : 'lose');
    });
}

function avatarHTML(p, active, size) {
    const name = String(p.name).trim();
    const initial = p.isBot ? 'K' + ((name.match(/\d+$/) || [''])[0]) : (name.charAt(0).toUpperCase() || '?');
    let h = 0;
    for (const ch of String(p.uid)) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return `<div class="avatar avatar-${size} ${active ? 'avatar-active' : ''}"><div class="avatar-face" style="--h:${h}">${esc(initial)}</div>` +
        `<img class="avatar-frame" src="img/ui/${active ? 'frame-gold' : 'frame-silver'}.png" alt="" draggable="false"></div>`;
}
