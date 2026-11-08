import { syncChallenge } from './challenge.js';
import { getScale } from '../../core/config.js';
import { fitOpponents } from '../../core/oppfit.js';
import { syncTimer } from './timer.js';
import { S, esc } from '../../core/state.js';
import { NAMES, HEX, cardSrc, face, imgTag, oppSide } from './deck.js';
import { canCallUno, isMyTurn, isPlayableIn } from './rules.js';
import { applyHold, handleFx, shownCount, viewSide, whenIdle } from './animations.js';
import { sfx, sayAsync, startMusic, stopMusic } from '../../core/sound.js';
import { go } from '../../app/router.js';

window.flipLeave = () => {
    clearTimeout(S.botTimer);
    S.localMode = false;
    S.currentUser = S.fbUser;
    S.currentRoomCode = null;
    S.roomData = null;
    S.hasDrawnThisTurn = false;
    S.paused = false;
    S.winSoundKey = null; S.winShown = null;
    S.selIdx = -1; S.selCard = null;
    stopMusic();
    if (window.stopFlipTimerHook) window.stopFlipTimerHook();
    ['f-pause-modal', 'f-over-modal', 'f-color-modal', 'f-challenge-modal'].forEach(id => document.getElementById(id).classList.add('hidden'));
    go('home-screen');
};

// --- RENDER ---
// Gambar kartu: sisi yang tampil = sisi yang sedang main; dek & kartu lawan menampilkan sisi SEBERANG (tanpa punggung kartu).
const faceHTML = (card, side) => imgTag(cardSrc(card, side));
export const generateCardHTML = faceHTML;

export function renderGame() {
    const state = S.roomData.gameState;
    const me = S.currentUser.uid;
    if (S.roomData.status === 'playing') startMusic(viewSide(state) === 'dark' ? 'flipDark' : 'flipLight');   // lagu beda untuk sisi terang & gelap (aman dipanggil berulang)
    handleFx(state);   // mencatat animasi baru & menahan tampilan
    const side = viewSide(state);
    const other = oppSide(side);

    // Lawan
    const oppArea = document.getElementById('f-opps');
    oppArea.innerHTML = '';
    const myIdx = S.roomData.players.findIndex(p => p.uid === me);
    for (let i = 1; i < S.roomData.players.length; i++) {
        const pIdx = (myIdx + i) % S.roomData.players.length;
        const p = S.roomData.players[pIdx];
        const isTurn = state.turnIndex === pIdx;
        const count = shownCount(p.uid, state.hands[p.uid].length);

        let stackHTML = '';
        for (let c = 0; c < Math.min(count, 5); c++) {
            stackHTML += `<div class="uno-card opponent-card st-${c}">${faceHTML(state.hands[p.uid][c], other)}</div>`;
        }
        const calledBadge = (count === 1 && state.unoCalled[p.uid]) ? `<div class="absolute top-0 -left-4 z-20 bg-green-600 text-[10px] px-1 rounded border border-white">UNO ✓</div>` : '';
        const catchable = state.catchable === p.uid && !state.unoCalled[p.uid] && state.hands[p.uid].length === 1;
        const catchBtn = catchable ? `<img class="catch-hammer" src="img/effects/hammer.png" alt="">` : '';

        oppArea.innerHTML += `
            <div id="fprof-${p.uid}" onclick="flipCatch('${p.uid}')" class="opp-profile ${isTurn ? 'is-turn' : ''}">
                <div id="fstack-${p.uid}" class="opp-stack">
                    ${stackHTML}
                    <div class="count-badge">${count}</div>
                    ${calledBadge}${catchBtn}
                </div>
                <div class="opp-avatar">${avatarHTML(p, isTurn, 'opp')}</div>
                <span class="name-tag ${isTurn ? 'name-turn' : ''} ">${esc(p.name)}</span>
            </div>`;
    }

    fitOpponents(oppArea);   // semua lawan muat tanpa geser kanan

    // Dek kiri & kanan: kartu teratas tampil dengan sisi seberang
    [['f-draw-l', 'f-count-l', state.deck], ['f-draw-r', 'f-count-r', state.deckR || []]].forEach(([id, cid, deck]) => {
        const el = document.getElementById(id);
        el.innerHTML = deck.length ? faceHTML(deck[deck.length - 1], other) : '<div class="deck-void"></div>';
        el.classList.toggle('deck-empty', deck.length === 0);
        el.classList.toggle('deck-ready', isMyTurn() && !state.pending && !S.hasDrawnThisTurn && deck.length > 0 && side === state.side);
        document.getElementById(cid).innerText = deck.length;
    });

    // Tumpukan buangan (sisi yang sedang main)
    const top = state.discardPile[state.discardPile.length - 1];
    if (top) {
        const pile = state.discardPile, n = pile.length;
        let stack = '';
        for (let i = Math.max(0, n - 5); i < n - 1; i++) {
            stack += `<div class="uno-card pile-card" style="--dx:${((i * 29) % 9) - 4}px;--dy:${((i * 17) % 7) - 3}px;--rot:${pileRot(i)}deg">${faceHTML(pile[i], side)}</div>`;
        }
        const tf = face(top, side);
        const glow = tf.color === 'Black' && HEX[state.currentColor] ? ' glow-c' : '';
        stack += `<div class="uno-card pile-card pile-top${glow}" style="--dx:0px;--dy:0px;--rot:${pileRot(n - 1)}deg;--glow:${HEX[state.currentColor] || '#fff'}">${faceHTML(top, side)}</div>`;
        document.getElementById('f-discard').innerHTML = `<div class="pile-wrap">${stack}</div>`;
    }
    const badge = document.getElementById('f-badge');
    badge.className = 'color-badge text-white border-2 border-white';
    badge.style.background = HEX[state.currentColor] || '#374151';
    badge.innerText = `Warna: ${NAMES[state.currentColor] || state.currentColor}`;
    const scr = document.getElementById('flip-screen');   // tema meja: siang (terang) / malam seram (gelap)
    scr.classList.toggle('f-dark', side === 'dark');
    scr.classList.toggle('f-light', side !== 'dark');

    // Tangan
    const handUI = document.getElementById('f-hand');
    handUI.innerHTML = '';
    const myHand = state.hands[me] || [];
    myHand.forEach((card, idx) => {
        let isPlay = isMyTurn() && side === state.side && isPlayableIn(state, card);
        if (S.hasDrawnThisTurn && idx !== myHand.length - 1) isPlay = false;
        const c = document.createElement('div');
        c.className = `uno-card ${isPlay ? 'playable' : 'unplayable'}`;
        c.onclick = () => tapCard(idx);
        c.addEventListener('pointerdown', (e) => startDrag(e, idx, c));
        c.innerHTML = faceHTML(card, side);
        handUI.appendChild(c);
    });
    const sc = S.selCard;
    if (S.selIdx >= 0 && !(sc && myHand[S.selIdx] && sameCard(myHand[S.selIdx], sc))) S.selIdx = -1;
    layoutHand();
    markSelected();

    // Profil saya
    const meP = S.roomData.players.find(p => p.uid === me);
    const meAv = document.getElementById('f-me-avatar');
    if (meAv && meP) {
        const mineCatch = state.catchable === me && !state.unoCalled[me] && (state.hands[me] || []).length === 1;
        meAv.innerHTML = avatarHTML(meP, isMyTurn(), 'me') + (mineCatch ? `<img class="catch-hammer" src="img/effects/hammer.png" alt="" onclick="showToast('Kamu lupa UNO! Tekan tombol UNO sekarang.')">` : '');
    }

    const btnUno = document.getElementById('f-btn-uno');
    btnUno.classList.toggle('animate-pulse', canCallUno(state));
    btnUno.classList.toggle('opacity-50', !!state.unoCalled[me]);

    // Giliran
    const btnPass = document.getElementById('f-btn-pass');
    const ti = document.getElementById('f-turn-ind');
    if (isMyTurn()) {
        ti.innerText = state.pending ? "Jawab tantangan!" : (S.hasDrawnThisTurn ? "Main atau Lewati!" : "Giliran Kamu!");
        ti.className = "text-lg md:text-2xl font-black text-green-400 animate-pulse";
        btnPass.classList.toggle('hidden', !S.hasDrawnThisTurn);
    } else {
        ti.innerText = `Giliran ${S.roomData.players[state.turnIndex].name}`;
        ti.className = "text-lg md:text-2xl font-bold text-yellow-400";
        btnPass.classList.add('hidden');
        S.hasDrawnThisTurn = false;
    }
    const ring = document.getElementById('f-dir-ring');
    if (ring) ring.classList.toggle('ccw', state.direction !== 1);

    applyHold();
    syncTimer(state);
    syncChallenge(state);
}

const sameCard = (a, b) => !!a && !!b && a.l.color === b.l.color && a.l.value === b.l.value && a.d.color === b.d.color && a.d.value === b.d.value;

// ---- Kartu di tangan seperti dipegang (kipas), sama dengan mode klasik ----
export function layoutHand() {
    const h = document.getElementById('f-hand');
    if (!h) return;
    const kids = [...h.children];
    if (!kids.length) return;
    const cs = getComputedStyle(h);
    const W = h.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const w = kids[0].offsetWidth, ch = kids[0].offsetHeight;
    if (!W || !w) return;
    const n = kids.length;
    const R = 1.5 * ch;
    const MAX_TOTAL = 52 * Math.PI / 180;
    let step = 0, dth = 0;
    if (n > 1) {
        step = Math.min(0.5 * w, Math.max(0.1 * w, (W - 1.45 * w) / (n - 1)));
        dth = Math.min(step / (R + ch / 2), MAX_TOTAL / (n - 1));
    }
    h.style.setProperty('--pivot', R + 'px');
    kids.forEach(k => { k.style.transition = 'none'; });
    h.style.justifyContent = 'center';
    kids.forEach((k, i) => {
        const deg = n > 1 ? ((i - (n - 1) / 2) * dth) * 180 / Math.PI : 0;
        k.classList.add('fan-card');
        k.style.setProperty('--rot', deg.toFixed(2) + 'deg');
        k.style.marginLeft = i ? (-w) + 'px' : '0';
    });
    void h.offsetWidth;
    kids.forEach(k => { k.style.transition = ''; });
}

function markSelected() {
    const h = document.getElementById('f-hand');
    if (!h) return;
    [...h.children].forEach((k, i) => k.classList.toggle('selected', i === S.selIdx));
}

// Seret kartu ke atas ke arah tumpukan di tengah meja, lepas = kartu diturunkan.
let drag = null, justDragged = false;

function overPile(e) {
    const pile = document.getElementById('f-discard');
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
    const pile = document.getElementById('f-discard');
    if (pile) pile.classList.remove('drop-ready');
    if (!d.moved) return;
    justDragged = true; setTimeout(() => { justDragged = false; }, 50);
    const drop = !cancel && d.ready;
    if (drop && d.el.isConnected) { S.selIdx = -1; flipPlay(d.idx); }
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
    const pile = document.getElementById('f-discard');
    if (pile) pile.classList.toggle('drop-ready', !!drag.ready);
}, { passive: true });
window.addEventListener('pointerup', (e) => endDrag(e, false));
window.addEventListener('pointercancel', (e) => endDrag(e, true));

function tapCard(idx) {
    if (justDragged) return;
    if (S.selIdx === idx) { S.selIdx = -1; markSelected(); flipPlay(idx); return; }
    const hand = S.roomData && S.roomData.gameState.hands[S.currentUser.uid];
    S.selIdx = idx;
    S.selCard = (hand || [])[idx] || null;
    markSelected();
}

window.addEventListener('resize', () => requestAnimationFrame(layoutHand));
window.addEventListener('orientationchange', () => setTimeout(layoutHand, 200));
document.addEventListener('click', (e) => {
    if (S.selIdx >= 0 && !(e.target.closest && e.target.closest('#f-hand'))) { S.selIdx = -1; markSelected(); }
});

// ---- Akhir permainan (seperti klasik): pemenang + total poin dari kartu sisa lawan ----
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
    document.getElementById('f-winner-text').innerText = (winnerUid === S.currentUser.uid) ? "Kamu Menang!" : `${winnerObj ? winnerObj.name : '?'} Menang!`;
    document.getElementById('f-score-text').innerText = `Total Skor: ${state.roundPts || 0} Poin`;
    document.getElementById('f-score-breakdown').innerHTML = breakdownHTML || '<div class="text-center text-gray-500">Tidak ada sisa poin.</div>';

    // Urutan: animasi kartu terakhir selesai -> terdengar "UNO game!" -> layar poin muncul + nada menang/kalah
    const key = S.currentRoomCode + ':' + (state.turnNo || 0) + ':' + winnerUid;
    if (S.winShown === key) { document.getElementById('f-over-modal').classList.remove('hidden'); return; }
    if (S.winSoundKey === key) return;
    S.winSoundKey = key;
    stopMusic(0.4);
    whenIdle().then(() => sayAsync('Uno game!')).then(() => {
        if (S.winSoundKey !== key || !S.roomData || S.roomData.status !== 'finished') return;
        S.winShown = key;
        document.getElementById('f-over-modal').classList.remove('hidden');
        sfx(winnerUid === S.currentUser.uid ? 'win' : 'lose');
    });
}

export function pileRot(i) { return ((i * 53) % 17) - 8; }

function avatarHTML(p, active, size) {
    const name = String(p.name).trim();
    const initial = p.isBot ? 'K' + ((name.match(/\d+$/) || [''])[0]) : (name.charAt(0).toUpperCase() || '?');
    let h = 0;
    for (const ch of String(p.uid)) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return `<div class="avatar avatar-${size} ${active ? 'avatar-active' : ''}"><div class="avatar-face" style="--h:${h}">${esc(initial)}</div>` +
        `<img class="avatar-frame" src="img/ui/${active ? 'frame-gold' : 'frame-silver'}.png" alt="" draggable="false"></div>`;
}

// Animasi kipas tangan saat FLIP: menutup (semua kartu menumpuk) lalu membuka lagi
export function fanClose() {
    const h = document.getElementById('f-hand');
    if (!h) return;
    [...h.children].forEach(k => { k.dataset.rot = k.style.getPropertyValue('--rot'); k.style.transition = 'transform .4s ease-in'; k.style.setProperty('--rot', '0deg'); });
}
export function fanOpen() {
    const h = document.getElementById('f-hand');
    if (!h) return;
    const kids = [...h.children];
    const rots = kids.map(k => k.style.getPropertyValue('--rot'));
    kids.forEach(k => { k.style.transition = 'none'; k.style.setProperty('--rot', '0deg'); });
    void h.offsetWidth;
    kids.forEach((k, i) => { k.style.transition = 'transform .45s ease-out'; k.style.setProperty('--rot', rots[i]); });
    setTimeout(() => kids.forEach(k => { k.style.transition = ''; }), 500);
}
