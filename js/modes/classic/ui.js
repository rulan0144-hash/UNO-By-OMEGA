import { syncChallenge } from './challenge.js';
import { BACK_SRC, cardSrc, imgTag, getScale } from '../../core/config.js';
import { fitOpponents } from '../../core/oppfit.js';
import { syncTimer } from './timer.js';
import { COLOR_NAMES } from '../../core/config.js';
import { S, esc } from '../../core/state.js';
import { calculatePoint } from './deck.js';
import { canCallUno, isCatchable, isMyTurn, isPlayable } from './rules.js';
import { applyHold, frozenHand, handleFx, shownCount, whenIdle } from './animations.js';
import { sfx, sayAsync, startMusic, stopMusic } from '../../core/sound.js';
import { go } from '../../app/router.js';

window.leaveRoom = () => {
    if (S.roomUnsubscribe) { S.roomUnsubscribe(); S.roomUnsubscribe = null; }
    clearTimeout(S.botTimer);
    S.localMode = false;
    S.currentUser = S.fbUser;
    S.currentRoomCode = null;
    S.roomData = null;
    S.selectedOpp = null;
    S.hasDrawnThisTurn = false;
    S.paused = false;
    S.winSoundKey = null; S.winShown = null;
    stopMusic();
    if (window.stopTimerHook) window.stopTimerHook();
    ['pause-modal', 'game-over-modal', 'color-modal'].forEach(id => document.getElementById(id).classList.add('hidden'));
    go('home-screen');
};

// --- RENDER ---
export function generateCardHTML(card) {
    return imgTag(cardSrc(card));
}

export function renderGame() {
    const state = S.roomData.gameState;
    const me = S.currentUser.uid;
    if (S.roomData.status === 'playing') startMusic();   // musik latar (aman dipanggil berulang)
    handleFx(state);   // mencatat animasi baru & menahan tampilan kartu yang akan datang
    document.getElementById('room-code-display').innerText = S.localMode ? '[vs Komputer]' : `[${S.currentRoomCode}]`;

    // Lawan
    const oppArea = document.getElementById('opponents-area');
    oppArea.innerHTML = '';
    const myIdx = S.roomData.players.findIndex(p => p.uid === me);
    for (let i = 1; i < S.roomData.players.length; i++) {
        const pIdx = (myIdx + i) % S.roomData.players.length;
        const p = S.roomData.players[pIdx];
        const isTurn = state.turnIndex === pIdx;
        const count = shownCount(p.uid, state.hands[p.uid].length);

        let stackHTML = '';
        for (let c = 0; c < Math.min(count, 5); c++) {
        stackHTML += `<div class="uno-card opponent-card st-${c}">${imgTag(BACK_SRC)}</div>`;
        }
        const calledBadge = (count === 1 && state.unoCalled[p.uid]) ? `<div class="absolute top-0 -left-4 z-20 bg-green-600 text-[10px] px-1 rounded border border-white">UNO ✓</div>` : '';
        // Lupa UNO: ikon palu muncul di profil; ketuk profil = langsung tertangkap
        const catchable = isCatchable(state, p.uid);
        const catchBtn = catchable ? `<img class="catch-hammer" src="img/effects/hammer.png" alt="">` : '';

        oppArea.innerHTML += `
            <div id="prof-${p.uid}" onclick="catchPlayer('${p.uid}')" class="opp-profile ${isTurn ? 'is-turn' : ''}">
                <div id="stack-${p.uid}" class="opp-stack">
                    ${stackHTML}
                    <div class="count-badge">${count}</div>
                    ${calledBadge}${catchBtn}
                </div>
                <div class="opp-avatar">${avatarHTML(p, isTurn, 'opp')}</div>
                <span class="name-tag ${isTurn ? 'name-turn' : ''} ">${esc(p.name)}</span>
            </div>`;
    }

    fitOpponents(oppArea);   // semua lawan muat tanpa geser kanan

    // Tumpukan
    const nL = state.deck.length, nR = (state.deckR || []).length;
    document.getElementById('deck-count').innerText = nL;
    document.getElementById('deck-count-r').innerText = nR;
    document.getElementById('draw-pile-ui').classList.toggle('deck-empty', nL === 0);
    document.getElementById('draw-pile-r').classList.toggle('deck-empty', nR === 0);
    // kedua deck berdenyut lembut saat giliran kamu & boleh menarik kartu
    const canDraw = isMyTurn() && !state.pending && !S.hasDrawnThisTurn;
    document.getElementById('draw-pile-ui').classList.toggle('deck-ready', canDraw && nL > 0);
    document.getElementById('draw-pile-r').classList.toggle('deck-ready', canDraw && nR > 0);
    const topCard = state.discardPile[state.discardPile.length - 1];
    if (topCard) {
        const pile = state.discardPile, n = pile.length;
        let stack = '';
        // kartu di bawahnya tetap terlihat (maks. 4 kartu sebelumnya)
        for (let i = Math.max(0, n - 5); i < n - 1; i++) {
            stack += `<div class="uno-card pile-card" style="--dx:${((i * 29) % 9) - 4}px;--dy:${((i * 17) % 7) - 3}px;--rot:${pileRot(i)}deg">${generateCardHTML(pile[i])}</div>`;
        }
        // kartu hitam (Wild): warna yang dipilih ditandai dengan cahaya di sekelilingnya
        const glow = topCard.color === 'Black' ? ' glow-' + state.currentColor : '';
        stack += `<div class="uno-card pile-card pile-top${glow}" style="--dx:0px;--dy:0px;--rot:${pileRot(n - 1)}deg">${generateCardHTML(topCard)}</div>`;
        document.getElementById('discard-pile-ui').innerHTML = `<div class="pile-wrap">${stack}</div>`;
    }
    const badge = document.getElementById('current-color-badge');
    const bgC = { 'Red': 'bg-red-500', 'Blue': 'bg-blue-500', 'Green': 'bg-green-500', 'Yellow': 'bg-yellow-500' }[state.currentColor] || 'bg-gray-700';
    badge.className = `color-badge text-white border-2 border-white ${bgC}`;
    badge.innerText = `Warna: ${COLOR_NAMES[state.currentColor] || state.currentColor}`;

    // Tangan
    const handUI = document.getElementById('human-hand-ui');
    handUI.innerHTML = '';
    const myHand = frozenHand() || state.hands[me] || [];
    myHand.forEach((card, idx) => {
        let isPlay = isMyTurn() && isPlayable(card);
        if (S.hasDrawnThisTurn && idx !== myHand.length - 1) isPlay = false;
        const c = document.createElement('div');
        c.className = `uno-card ${isPlay ? 'playable' : 'unplayable'}`;
        c.onclick = () => tapCard(idx);
        c.addEventListener('pointerdown', (e) => startDrag(e, idx, c));
        c.innerHTML = generateCardHTML(card);
        handUI.appendChild(c);
    });
    // pilihan kartu yang masih berlaku (kartunya sama) tetap terangkat; kalau tidak, dibatalkan
    const sc = S.selCard;
    if (S.selIdx >= 0 && !(sc && myHand[S.selIdx] && myHand[S.selIdx].color === sc.color && myHand[S.selIdx].value === sc.value)) S.selIdx = -1;
    layoutHand();
    markSelected();

    // Profil saya (avatar + bingkai)
    const meP = S.roomData.players.find(p => p.uid === me);
    const meAv = document.getElementById('me-avatar');
    if (meAv && meP) {
        const mineCatch = isCatchable(state, me);
        meAv.innerHTML = avatarHTML(meP, isMyTurn(), 'me') + (mineCatch ? `<img class="catch-hammer" src="img/effects/hammer.png" alt="" onclick="showToast('Kamu lupa UNO! Tekan tombol UNO sekarang.')">` : '');
    }

    // Tombol UNO: berdenyut saat sudah boleh ditekan
    const btnUno = document.getElementById('btn-uno');
    btnUno.classList.toggle('animate-pulse', canCallUno(state));
    btnUno.classList.toggle('opacity-50', !!state.unoCalled[me]);
    btnUno.classList.toggle('uno-ready', canCallUno(state) && !state.unoCalled[me]);   // kelas sendiri (tanpa Tailwind)
    btnUno.classList.toggle('uno-done', !!state.unoCalled[me]);

    // Giliran
    const btnPass = document.getElementById('btn-pass');
    const ti = document.getElementById('turn-indicator');
    if (isMyTurn()) {
        ti.innerText = state.pending ? "Jawab tantangan +4!" : (S.hasDrawnThisTurn ? "Main atau Lewati!" : "Giliran Kamu!");
        ti.className = "text-lg md:text-2xl font-black text-green-400 animate-pulse";
        btnPass.classList.toggle('hidden', !S.hasDrawnThisTurn);
    } else {
        ti.innerText = `Giliran ${S.roomData.players[state.turnIndex].name}`;
        ti.className = "text-lg md:text-2xl font-bold text-yellow-400";
        btnPass.classList.add('hidden');
        S.hasDrawnThisTurn = false;
    }
    const ring = document.getElementById('dir-ring');
    if (ring) ring.classList.toggle('ccw', state.direction !== 1);

    const logsUI = document.getElementById('logs-container');
    logsUI.innerHTML = state.logs.map(l => `<div class="border-b border-gray-700 pb-1">${l}</div>`).join('');
    logsUI.scrollTop = logsUI.scrollHeight;

    applyHold();
    syncTimer(state);
    syncChallenge(state);
}

// ---- Kartu di tangan seperti dipegang di dunia nyata (kipas) ----
// Semua kartu bertumpu pada satu titik putar di bawah tangan lalu diputar bergantian membentuk kipas;
// kartu berikutnya menutupi kartu sebelumnya sehingga yang terlihat pojok kiri-atas (angka/aksi).
// Ketuk sekali = kartu terangkat; ketuk kartu yang terangkat = dimainkan.
export function layoutHand() {
    const h = document.getElementById('human-hand-ui');
    if (!h) return;
    const kids = [...h.children];
    if (!kids.length) return;
    const cs = getComputedStyle(h);
    const W = h.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const r0 = kids[0].getBoundingClientRect();
    const w = kids[0].offsetWidth, ch = kids[0].offsetHeight;
    if (!W || !w) return;
    const n = kids.length;
    const R = 1.5 * ch;                                   // jarak titik putar di bawah kartu
    const MAX_TOTAL = 52 * Math.PI / 180;                 // sudut kipas terlebar
    let step = 0;                                         // jarak antar kartu (px, setinggi tengah kartu)
    if (n > 1) {
        step = Math.min(0.5 * w, Math.max(0.1 * w, (W - 1.45 * w) / (n - 1)));
        // sudut per kartu: jarak tengah kartu ~ (R + ch/2) * sudut
        var dth = Math.min(step / (R + ch / 2), MAX_TOTAL / (n - 1));
    }
    h.style.setProperty('--pivot', R + 'px');
    kids.forEach(k => { k.style.transition = 'none'; });   // jangan animasikan kipas membuka/menutup tiap render
    h.style.justifyContent = 'center';
    kids.forEach((k, i) => {
        const deg = n > 1 ? ((i - (n - 1) / 2) * dth) * 180 / Math.PI : 0;
        k.classList.add('fan-card');
        k.style.setProperty('--rot', deg.toFixed(2) + 'deg');
        k.style.marginLeft = i ? (-w) + 'px' : '0';       // semua kartu bertumpuk di satu titik, lalu diputar
    });
    void h.offsetWidth;                                   // terapkan posisi tanpa transisi
    kids.forEach(k => { k.style.transition = ''; });      // transisi hanya untuk angkat/turun kartu
}

function markSelected() {
    const h = document.getElementById('human-hand-ui');
    if (!h) return;
    [...h.children].forEach((k, i) => k.classList.toggle('selected', i === S.selIdx));
}

// Seret kartu ke atas ke arah tumpukan di tengah meja, lepas = kartu diturunkan.
// Seret pendek lalu lepas = kartu kembali ke tangan.
let drag = null, justDragged = false;

function overPile(e) {
    const pile = document.getElementById('discard-pile-ui');
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
    const pile = document.getElementById('discard-pile-ui');
    if (pile) pile.classList.remove('drop-ready');
    if (!d.moved) return;
    justDragged = true; setTimeout(() => { justDragged = false; }, 50);
    const drop = !cancel && d.ready;
    if (drop && d.el.isConnected) { S.selIdx = -1; humanPlayCard(d.idx); }   // posisi kartu dibaca dulu untuk animasi terbang
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
        if (Math.abs(dx) > Math.abs(dy) * 1.5) { drag = null; return; }   // geser mendatar bukan menurunkan kartu
        drag.moved = true;
        S.selIdx = -1; markSelected();
        drag.el.classList.add('dragging');
    }
    drag.dy = dy;
    drag.el.style.transform = `translate(${dx}px, ${dy}px) rotate(var(--rot, 0deg))`;
    drag.ready = overPile(e);
    const pile = document.getElementById('discard-pile-ui');
    if (pile) pile.classList.toggle('drop-ready', !!drag.ready);
}, { passive: true });
window.addEventListener('pointerup', (e) => endDrag(e, false));
window.addEventListener('pointercancel', (e) => endDrag(e, true));

function tapCard(idx) {
    if (justDragged) return;
    if (S.selIdx === idx) { S.selIdx = -1; markSelected(); humanPlayCard(idx); return; }
    const hand = S.roomData && S.roomData.gameState.hands[S.currentUser.uid];
    const frozen = frozenHand();
    S.selIdx = idx;
    S.selCard = (frozen || hand || [])[idx] || null;
    markSelected();
}

window.addEventListener('resize', () => requestAnimationFrame(layoutHand));
window.addEventListener('orientationchange', () => setTimeout(layoutHand, 200));
document.addEventListener('click', (e) => {
    if (S.selIdx >= 0 && !(e.target.closest && e.target.closest('#human-hand-ui'))) { S.selIdx = -1; markSelected(); }
});

export function handleGameOver() {
    const state = S.roomData.gameState;
    const winnerUid = state.winner;
    const winnerObj = S.roomData.players.find(p => p.uid === winnerUid);
    let totalScore = 0, breakdownHTML = '';

    S.roomData.players.forEach(p => {
        if (p.uid !== winnerUid) {
            const pScore = state.hands[p.uid].reduce((a, c) => a + calculatePoint(c), 0);
            totalScore += pScore;
            breakdownHTML += `
                <div class="flex justify-between bg-gray-800 p-2 rounded">
                    <span><b class="text-white">${esc(p.name)}</b> (${state.hands[p.uid].length} Kartu)</span>
                    <span class="text-red-400 font-bold">+${pScore} pts</span>
                </div>`;
        }
    });

    document.getElementById('winner-text').innerText = (winnerUid === S.currentUser.uid) ? "Kamu Menang!" : `${winnerObj ? winnerObj.name : '?'} Menang!`;
    document.getElementById('score-text').innerText = `Total Skor: ${totalScore} Poin`;
    document.getElementById('score-breakdown').innerHTML = breakdownHTML || '<div class="text-center text-gray-500">Tidak ada sisa poin.</div>';

    // Urutan: animasi kartu terakhir selesai -> terdengar "UNO game!" -> layar poin muncul + nada menang/kalah
    const key = S.currentRoomCode + ':' + (state.turnNo || 0) + ':' + winnerUid;
    if (S.winShown === key) { document.getElementById('game-over-modal').classList.remove('hidden'); return; }
    if (S.winSoundKey === key) return;
    S.winSoundKey = key;
    stopMusic(0.4);
    whenIdle().then(() => sayAsync('Uno game!')).then(() => {
        if (S.winSoundKey !== key || !S.roomData || S.roomData.status !== 'finished') return;   // pemain sudah keluar
        S.winShown = key;
        document.getElementById('game-over-modal').classList.remove('hidden');
        sfx(winnerUid === S.currentUser.uid ? 'win' : 'lose');
    });
}

// Kemiringan tetap tiap kartu di tumpukan buangan
export function pileRot(i) { return ((i * 53) % 17) - 8; }

// Avatar huruf + bingkai (emas bercahaya untuk pemain yang sedang jalan)
function avatarHTML(p, active, size) {
    const name = String(p.name).trim();
    const initial = p.isBot ? 'K' + ((name.match(/\d+$/) || [''])[0]) : (name.charAt(0).toUpperCase() || '?');
    let h = 0;
    for (const ch of String(p.uid)) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return `<div class="avatar avatar-${size} ${active ? 'avatar-active' : ''}"><div class="avatar-face" style="--h:${h}">${esc(initial)}</div>` +
        `<img class="avatar-frame" src="img/ui/${active ? 'frame-gold' : 'frame-silver'}.png" alt="" draggable="false"></div>`;
}
