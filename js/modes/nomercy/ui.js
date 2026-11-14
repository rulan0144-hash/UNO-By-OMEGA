// Tampilan UNO Show 'Em No Mercy (layar #nm-screen, id berawalan n-). Kontrak dengan actions.js: renderGame, handleGameOver, askColor, askTarget, closeAsks.
import { doubleTapTarget } from '../../core/doubletap.js';
import { getScale } from '../../core/config.js';
import { fitOpponents } from '../../core/oppfit.js';
import { syncTimer } from './timer.js';
import { S, esc } from '../../core/state.js';
import { NAMES, HEX, MERCY_LIMIT, cardSrc, backSrc } from './deck.js';
import { actorUid, canCallUno, hasPlayable, isCatchable, isMyTurn, isOut, isPlayableIn } from './rules.js';
import { applyHold, handleFx, heldColor, heldCut, heldMercy, isBusy, resetFx, shownCount, shownHand, whenIdle } from './animations.js';
import { sfx, sayAsync, startMusic, stopMusic } from '../../core/sound.js';
import { go } from '../../app/router.js';
import { fillOver } from '../../core/series.js';

const $ = (id) => document.getElementById(id);
const imgTag = (src) => `<img class="card-img" src="${src}" alt="" draggable="false">`;
export const generateCardHTML = (card) => imgTag(cardSrc(card));
const backHTML = () => imgTag(backSrc());
export function pileRot(i) { return ((i * 53) % 17) - 8; }
const mercyClass = (n) => (n >= MERCY_LIMIT - 2 ? 'mercy-danger' : n >= MERCY_LIMIT - 7 ? 'mercy-warn' : '');   // 23-24 bahaya, 18-22 waspada

window.nmLeave = () => {
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
    if (window.stopNmTimerHook) window.stopNmTimerHook();
    ['n-pause-modal', 'n-over-modal', 'n-color-modal', 'n-target-modal'].forEach(id => $(id).classList.add('hidden'));
    go('home-screen');
};

// Warna meja & lencana. Meja berganti warna mengikuti kartu yang berlaku; bila berubah, cincin tengah berdenyut sebentar.
export function paintColor(color) {
    const badge = $('n-badge');
    if (badge) {
        badge.className = 'color-badge text-white border-2 border-white';
        badge.style.background = HEX[color] || '#374151';
        badge.innerText = `Warna: ${NAMES[color] || color}`;
    }
    const scr = $('nm-screen');
    if (!scr) return;
    const prev = scr.dataset.nmc;
    ['Red', 'Yellow', 'Green', 'Blue'].forEach(c => scr.classList.toggle('nm-c-' + c, c === color));
    scr.dataset.nmc = color || '';
    if (prev && color && prev !== color) {
        scr.classList.remove('ring-pop'); void scr.offsetWidth; scr.classList.add('ring-pop');
        setTimeout(() => scr.classList.remove('ring-pop'), 800);
    }
}

// ---------- RENDER ----------
export function renderGame() {
    const state = S.roomData.gameState;
    const me = S.currentUser.uid;
    if (S.roomData.status === 'playing') startMusic('nomercy');   // aman dipanggil berulang
    handleFx(state);   // mencatat animasi baru & menahan tampilan
    const players = S.roomData.players;
    const aUid = actorUid(state);
    const pend = state.pending;
    const meOut = isOut(state, me) && !heldMercy(me);
    const myTurn = isMyTurn() && !meOut;

    // Lawan: tumpukan punggung kartu, hitungan (meter Mercy), penanda tersingkir
    const oppArea = $('n-opps');
    oppArea.innerHTML = '';
    const myIdx = players.findIndex(p => p.uid === me);
    for (let i = 1; i < players.length; i++) {
        const p = players[(myIdx + i) % players.length];
        const out = isOut(state, p.uid) && !heldMercy(p.uid);
        const isTurn = !out && (players[state.turnIndex].uid === p.uid || aUid === p.uid);
        const count = out ? 0 : shownCount(p.uid, state.hands[p.uid].length);
        let stackHTML = '';
        for (let c = 0; c < Math.min(count, 5); c++) stackHTML += `<div class="uno-card opponent-card st-${c}">${backHTML()}</div>`;
        const calledBadge = (count === 1 && state.unoCalled[p.uid]) ? `<div class="absolute top-0 -left-4 z-20 bg-green-600 text-[10px] px-1 rounded border border-white">UNO ✓</div>` : '';
        const catchBtn = isCatchable(state, p.uid) ? `<img class="catch-hammer" src="img/effects/hammer.png" alt="">` : '';
        oppArea.innerHTML += `
            <div id="nprof-${p.uid}" onclick="nmCatch('${p.uid}')" class="opp-profile ${isTurn ? 'is-turn' : ''} ${out ? 'opp-out' : ''}">
                <div id="nstack-${p.uid}" class="opp-stack">
                    ${stackHTML}
                    ${out ? '<div class="out-tag">TERSINGKIR</div>' : `<div class="count-badge ${mercyClass(count)}">${count}</div>`}
                    ${calledBadge}${catchBtn}
                </div>
                <div class="opp-avatar">${avatarHTML(p, isTurn, 'opp')}</div>
                <span class="name-tag ${isTurn ? 'name-turn' : ''} ">${esc(p.name)}</span>
            </div>`;
    }
    fitOpponents(oppArea);

    // Dua tumpukan ambil (kiri 'L' / kanan 'R', seperti mode lain). Color Roulette: setelah warna dipilih, korban mengetuk tumpukan sampai dapat warna itu.
    const rouletteDrawing = !!(pend && pend.kind === 'roulette' && pend.color);
    const canTap = myTurn && !state.forced && (rouletteDrawing || (!pend && !hasPlayable(state, me)) || (pend && pend.kind === 'draw'));
    [['n-draw-l', 'n-count-l', state.deck], ['n-draw-r', 'n-count-r', state.deckR || []]].forEach(([id, cid, deck]) => {
        const el = $(id);
        el.innerHTML = deck.length ? backHTML() : '<div class="deck-void"></div>';
        el.classList.toggle('deck-empty', deck.length === 0);
        el.classList.toggle('deck-ready', canTap && deck.length > 0);
        $(cid).innerText = deck.length;
    });
    // Tulisan STACK di tengah meja (menggantikan gambar tumpukan di samping): jumlah hukuman Draw yang sedang menumpuk. Muncul setelah animasi selesai.
    const stk = $('n-stack-txt');
    if (pend && pend.kind === 'draw' && !isBusy()) {
        const label = '+' + pend.n;
        if (stk.classList.contains('hidden') || $('n-stack-n').innerText !== label) { stk.classList.remove('hidden'); stk.classList.remove('stack-pop'); void stk.offsetWidth; stk.classList.add('stack-pop'); }
        $('n-stack-n').innerText = label;
        $('n-stack-note').innerText = pend.count > 1 ? `ditumpuk ${pend.count}x` : '';
    } else stk.classList.add('hidden');

    // Tumpukan buangan (kartu teratas bercahaya sesuai warna yang berlaku)
    const cut = heldCut();   // Discard All sedang beranimasi: kartu yang dibuang + kartu Discard All belum tampak di tumpukan
    const pile = cut ? state.discardPile.slice(0, Math.max(1, state.discardPile.length - cut)) : state.discardPile, n = pile.length, top = pile[n - 1];
    if (top) {
        let stack = '';
        for (let i = Math.max(0, n - 5); i < n - 1; i++) {
            stack += `<div class="uno-card pile-card" style="--dx:${((i * 29) % 9) - 4}px;--dy:${((i * 17) % 7) - 3}px;--rot:${pileRot(i)}deg">${generateCardHTML(pile[i])}</div>`;
        }
        const glowC = heldColor() || state.currentColor;
        const glow = glowC && HEX[glowC] ? ' glow-c' : '';
        stack += `<div class="uno-card pile-card pile-top${glow}" style="--dx:0px;--dy:0px;--rot:${pileRot(n - 1)}deg;--glow:${HEX[glowC] || '#fff'}">${generateCardHTML(top)}</div>`;
        $('n-discard').innerHTML = `<div class="pile-wrap">${stack}</div>`;
    }
    paintColor(heldColor() || state.currentColor);

    // Tangan
    const handUI = $('n-hand');
    handUI.innerHTML = '';
    const myHand = meOut ? [] : shownHand(me, state.hands[me] || []);   // saat animasi tukar/oper: tampilkan tangan lama dulu
    const live = shownHand(me, null) === null;                          // tanda 'bisa dimainkan' hanya untuk tangan asli (bukan tangan lama saat animasi)
    myHand.forEach((card, idx) => {
        const isPlay = myTurn && live && isPlayableIn(state, me, card);
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

    // Profil saya + meter Mercy
    const meP = players.find(p => p.uid === me);
    const meAv = $('n-me-avatar');
    if (meAv && meP) {
        const mineCatch = isCatchable(state, me);
        meAv.innerHTML = avatarHTML(meP, aUid === me && !meOut, 'me') + (mineCatch ? `<img class="catch-hammer" src="img/effects/hammer.png" alt="" onclick="showToast('Kamu lupa UNO! Tekan tombol UNO sekarang.')">` : '');
        meAv.style.filter = meOut ? 'grayscale(1) brightness(.7)' : '';
    }
    const mm = $('n-mercy-me');
    if (meOut) mm.classList.add('hidden');
    else {
        const cnt = shownHand(me, state.hands[me] || []).length;
        mm.classList.remove('hidden', 'mercy-warn', 'mercy-danger');
        if (mercyClass(cnt)) mm.classList.add(mercyClass(cnt));
        mm.innerText = `${cnt}/${MERCY_LIMIT}`;
    }

    // Tombol tangkap & UNO
    const anyCatch = players.some(p => p.uid !== me && isCatchable(state, p.uid));
    $('n-btn-catch').classList.toggle('catch-ready', anyCatch);
    const btnUno = $('n-btn-uno');
    btnUno.classList.toggle('animate-pulse', canCallUno(state));
    btnUno.classList.toggle('opacity-50', !!state.unoCalled[me]);
    btnUno.classList.toggle('uno-ready', canCallUno(state) && !state.unoCalled[me]);
    btnUno.classList.toggle('uno-done', !!state.unoCalled[me]);

    // Giliran + tombol ambil hukuman
    const btnPen = $('n-btn-pen');
    const ti = $('n-turn-ind');
    const aName = (players.find(p => p.uid === aUid) || {}).name || '?';
    btnPen.classList.add('hidden');
    if (meOut) {
        ti.innerText = 'Kamu tersingkir!';
        ti.className = 'text-lg md:text-2xl font-black text-red-400';
    } else if (aUid === me) {
        let msg = 'Giliran Kamu!';
        if (pend && pend.kind === 'roulette') msg = pend.color ? `Ketuk tumpukan sampai dapat ${NAMES[pend.color]}! (${pend.got || 0})` : 'Pilih warna!';
        else if (pend && pend.kind === 'draw') { msg = `Tumpuk Draw ≥ +${pend.top} atau ambil ${pend.n}!`; btnPen.textContent = `Ambil ${pend.n} kartu`; btnPen.classList.remove('hidden'); }
        else if (state.forced && state.forced.uid === me) msg = 'Kartu baru wajib dimainkan!';
        else if (!hasPlayable(state, me)) msg = 'Tidak ada yang cocok: ketuk tumpukan!';
        ti.innerText = msg;
        ti.className = 'text-lg md:text-2xl font-black text-green-400 animate-pulse';
    } else {
        ti.innerText = `Giliran ${aName}`;
        ti.className = 'text-lg md:text-2xl font-bold text-yellow-400';
    }
    const ring = $('n-dir-ring');
    if (ring) ring.classList.toggle('ccw', state.direction !== 1);

    applyHold();
    syncTimer(state);
    if (window.nmRouletteCheck) window.nmRouletteCheck();   // korban Color Roulette (kamu) diminta memilih warna
}

// ---------- tangan seperti dipegang (kipas), sama dengan mode lain ----------
export function layoutHand() {
    const h = $('n-hand');
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
    const h = $('n-hand');
    if (!h) return;
    [...h.children].forEach((k, i) => k.classList.toggle('selected', i === S.selIdx));
}

// Seret kartu ke atas ke arah tumpukan di tengah meja, lepas = dimainkan.
let drag = null, justDragged = false;
function overPile(e) {
    const pile = $('n-discard');
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
    const pile = $('n-discard');
    if (pile) pile.classList.remove('drop-ready');
    if (!d.moved) return;
    justDragged = true; setTimeout(() => { justDragged = false; }, 50);
    const drop = !cancel && d.ready;
    if (drop && d.el.isConnected) { S.selIdx = -1; window.nmPlay(d.idx); }
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
    const pile = $('n-discard');
    if (pile) pile.classList.toggle('drop-ready', !!drag.ready);
}, { passive: true });
window.addEventListener('pointerup', (e) => endDrag(e, false));
window.addEventListener('pointercancel', (e) => endDrag(e, true));

// Ketuk 2x cepat = langsung dimainkan; ketuk sekali = terangkat, ketuk lagi = dimainkan
function tapCard(idx, ev) {
    if (justDragged) return;
    const first = doubleTapTarget(idx, ev);
    if (first >= 0) { S.selIdx = -1; markSelected(); window.nmPlay(first); return; }
    if (S.selIdx === idx) { S.selIdx = -1; markSelected(); window.nmPlay(idx); return; }
    const hand = S.roomData && S.roomData.gameState.hands[S.currentUser.uid];
    S.selIdx = idx;
    S.selCard = (hand || [])[idx] || null;
    markSelected();
}
window.addEventListener('resize', () => requestAnimationFrame(layoutHand));
window.addEventListener('orientationchange', () => setTimeout(layoutHand, 200));
document.addEventListener('click', (e) => {
    const scr = $('nm-screen');
    if (!scr || scr.classList.contains('hidden')) return;
    if (S.selIdx >= 0 && !(e.target.closest && e.target.closest('#n-hand'))) { S.selIdx = -1; markSelected(); }
});

// ---------- pilihan pemain (Promise): warna dan pemain target ----------
let askResolve = null;
const ASKS = ['n-color-modal', 'n-target-modal'];
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
window.nmPickColor = (c) => settle(c);
window.nmPickTarget = (uid) => settle(uid);
window.nmCancelAsk = () => settle(null);

// warna yang dipilih atau null (title: tulisan di atas pemilih)
export function askColor(title = 'Pilih Warna') {
    $('n-cp-title').textContent = title;
    $('n-cp-img').src = 'img/nomercy/fx/wild-spin.png';
    return ask('n-color-modal');
}
// uid lawan (yang masih hidup) yang dipilih atau null (kartu 7: tukar tangan)
export function askTarget(state) {
    const me = S.currentUser.uid;
    $('n-target-title').textContent = 'Tukar tangan dengan siapa?';
    $('n-target-list').innerHTML = S.roomData.players.filter(p => p.uid !== me && !isOut(state, p.uid)).map(p =>
        `<button class="n-target-btn" data-u="${esc(p.uid)}" onclick="nmPickTarget(this.dataset.u)">${esc(p.name)}<small>${(state.hands[p.uid] || []).length} kartu</small></button>`).join('');
    return ask('n-target-modal');
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
                <span><b class="text-white">${esc(p.name)}</b> ${d.out ? '<span class="text-red-400">(Tersingkir)</span>' : `(${d.n} Kartu)`}</span>
                <span class="text-red-400 font-bold">+${d.pts} pts</span>
            </div>`;
    });
    $('n-winner-text').innerText = (winnerUid === S.currentUser.uid) ? 'Kamu Menang!' : `${winnerObj ? winnerObj.name : '?'} Menang!`;
    $('n-win-by').innerText = state.winBy === 'mercy' ? 'Semua lawan tersingkir (Mercy)!' : '';
    $('n-score-text').innerText = `Total Skor: ${state.roundPts || 0} Poin`;
    $('n-score-breakdown').innerHTML = breakdownHTML || '<div class="text-center text-gray-500">Tidak ada sisa poin.</div>';
    fillOver('n-', winnerUid, state.roundPts || 0);   // papan skor ronde + tombol Lanjut ronde / Main Lagi / Beranda

    // Urutan: animasi kartu terakhir selesai -> "UNO game!" -> layar poin + nada menang/kalah
    const key = S.currentRoomCode + ':' + (S.roomData.gameId || '') + ':' + (state.turnNo || 0) + ':' + winnerUid;
    if (S.winShown === key) { $('n-over-modal').classList.remove('hidden'); return; }
    if (S.winSoundKey === key) return;
    S.winSoundKey = key;
    stopMusic(0.4);
    whenIdle().then(() => sayAsync('Uno game!')).then(() => {
        if (S.winSoundKey !== key || !S.roomData || S.roomData.status !== 'finished') return;
        S.winShown = key;
        $('n-over-modal').classList.remove('hidden');
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
