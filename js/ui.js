import { syncChallenge } from './challenge.js';
import { BACK_SRC, cardSrc, imgTag } from './config.js';
import { syncTimer } from './timer.js';
import { COLOR_NAMES } from './config.js';
import { S, esc } from './state.js';
import { firebaseConfig } from './firebase.js';
import { calculatePoint } from './deck.js';
import { canCallUno, isMyTurn, isPlayable } from './rules.js';
import { applyHold, frozenHand, handleFx, shownCount } from './animations.js';

export function updateOnlineStatus() {
    const el = document.getElementById('online-status');
    if (!el) return;
    el.innerText = S.fbUser ? "🟢 Mode online siap" : "🔴 Mode online tidak aktif (cek firebaseConfig). Mode vs Komputer tetap bisa dimainkan.";
}

// --- NAVIGASI ---
window.saveName = () => {
    const nameInput = document.getElementById('player-name').value.trim();
    if (nameInput.length < 2) return showToast("Nama minimal 2 huruf!");
    S.myName = nameInput;
    localStorage.setItem('uno_name', S.myName);
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('btn-cancel-name').classList.add('hidden');
    document.getElementById('home-screen').classList.remove('hidden');
    updateHomeName();
    updateOnlineStatus();
};

window.changeName = () => {
    document.getElementById('player-name').value = S.myName;
    document.getElementById('btn-cancel-name').classList.remove('hidden');
    document.getElementById('home-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
};

window.cancelName = () => {
    document.getElementById('btn-cancel-name').classList.add('hidden');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('home-screen').classList.remove('hidden');
};

export function updateHomeName() {
    const el = document.getElementById('home-name');
    if (el) el.innerText = S.myName;
}

window.leaveRoom = () => {
    if (S.roomUnsubscribe) { S.roomUnsubscribe(); S.roomUnsubscribe = null; }
    clearTimeout(S.botTimer);
    S.localMode = false;
    S.currentUser = S.fbUser;
    S.currentRoomCode = null;
    S.roomData = null;
    S.selectedOpp = null;
    S.hasDrawnThisTurn = false;
    ['game-over-modal', 'game-screen', 'lobby-screen', 'color-modal'].forEach(id => document.getElementById(id).classList.add('hidden'));
    document.getElementById('home-screen').classList.remove('hidden');
};

// --- RENDER ---
export function generateCardHTML(card) {
    return imgTag(cardSrc(card));
}

export function renderGame() {
    const state = S.roomData.gameState;
    const me = S.currentUser.uid;
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
        const catchBtn = (S.selectedOpp === p.uid && count === 1)
            ? `<button onclick="event.stopPropagation(); catchPlayer('${p.uid}')" class="absolute top-0 -right-7 z-20 bg-red-600 border-2 border-white rounded-full text-xs font-black px-2 py-1 animate-bounce shadow-lg">UNO!</button>` : '';

        oppArea.innerHTML += `
            <div id="prof-${p.uid}" onclick="toggleOpp('${p.uid}')" class="opp-profile ${isTurn ? 'is-turn' : ''}">
                <div id="stack-${p.uid}" class="opp-stack">
                    ${stackHTML}
                    <div class="count-badge">${count}</div>
                    ${calledBadge}${catchBtn}
                </div>
                <div class="opp-avatar">${avatarHTML(p, isTurn, 'opp')}</div>
                <span class="name-tag ${isTurn ? 'name-turn' : ''} ${S.selectedOpp === p.uid ? 'ring-2 ring-red-400' : ''}">${esc(p.name)}</span>
            </div>`;
    }

    // Tumpukan
    document.getElementById('deck-count').innerText = state.deck.length;
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
    badge.className = `mt-2 px-4 py-1 rounded-full text-xs md:text-sm font-bold shadow-md text-white border-2 border-white ${bgC}`;
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
        c.onclick = () => humanPlayCard(idx);
        c.innerHTML = generateCardHTML(card);
        handUI.appendChild(c);
    });

    // Profil saya (avatar + bingkai)
    const meP = S.roomData.players.find(p => p.uid === me);
    const meAv = document.getElementById('me-avatar');
    if (meAv && meP) meAv.innerHTML = avatarHTML(meP, isMyTurn(), 'me');

    // Tombol UNO: berdenyut saat sudah boleh ditekan
    const btnUno = document.getElementById('btn-uno');
    btnUno.classList.toggle('animate-pulse', canCallUno(state));
    btnUno.classList.toggle('opacity-50', !!state.unoCalled[me]);

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
    document.getElementById('direction-indicator').innerText = state.direction === 1 ? 'Searah jarum jam' : 'Berlawanan jarum jam';
    const ring = document.getElementById('dir-ring');
    if (ring) ring.classList.toggle('ccw', state.direction !== 1);

    const logsUI = document.getElementById('logs-container');
    logsUI.innerHTML = state.logs.map(l => `<div class="border-b border-gray-700 pb-1">${l}</div>`).join('');
    logsUI.scrollTop = logsUI.scrollHeight;

    applyHold();
    syncTimer(state);
    syncChallenge(state);
}

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
    document.getElementById('game-over-modal').classList.remove('hidden');
}

let toastTimeout;

window.showToast = (msg) => {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.classList.remove('toast-enter');
    toast.classList.add('toast-show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('toast-show');
        toast.classList.add('toast-enter');
    }, 3000);
};

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
