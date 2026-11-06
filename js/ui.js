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
    let innerClass = `bg-${card.color}`;
    let shortVal = card.value, displayVal = card.value;
    let valClass = 'val-center text-shadow-sm';

    if (card.value === 'Skip') { shortVal = '⊘'; displayVal = '⊘'; }
    else if (card.value === 'Reverse') { shortVal = '⇄'; displayVal = '⇄'; }
    else if (card.value === 'Draw Two') { shortVal = '+2'; displayVal = '+2'; }
    else if (card.value === 'Wild') { shortVal = 'W'; displayVal = 'BEBAS'; valClass += ' val-W'; }
    else if (card.value === 'Wild Draw Four') { shortVal = 'W4'; displayVal = 'W+4'; valClass += ' val-W'; }
    else if (card.value === 'Wild Shuffle Hands') { shortVal = 'WS'; displayVal = 'ACAK'; valClass += ' val-W'; }
    

    if (card.color === 'Black') innerClass = 'bg-gray-800';

    return `
        <div class="oval flex items-center justify-center"><div class="inner-oval ${innerClass}"></div></div>
        <span class="${valClass}">${displayVal}</span>
        <span class="val-sm-tl text-shadow-sm">${shortVal}</span>
        <span class="val-sm-br text-shadow-sm">${shortVal}</span>
    `;
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
            stackHTML += `<div class="uno-card opponent-card card-back absolute left-0" style="margin-left: ${c * 5}px; z-index: ${c};"><div class="oval"></div></div>`;
        }
        const calledBadge = (count === 1 && state.unoCalled[p.uid]) ? `<div class="absolute top-0 -left-4 z-20 bg-green-600 text-[10px] px-1 rounded border border-white">UNO ✓</div>` : '';
        const catchBtn = (S.selectedOpp === p.uid && count === 1)
            ? `<button onclick="event.stopPropagation(); catchPlayer('${p.uid}')" class="absolute top-0 -right-7 z-20 bg-red-600 border-2 border-white rounded-full text-xs font-black px-2 py-1 animate-bounce shadow-lg">UNO!</button>` : '';

        oppArea.innerHTML += `
            <div id="prof-${p.uid}" onclick="toggleOpp('${p.uid}')" class="flex flex-col items-center transition-all px-1 cursor-pointer ${isTurn ? 'scale-110' : 'opacity-70'}">
                <div id="stack-${p.uid}" class="relative mb-2 w-14 md:w-16 h-20 flex justify-center">
                    ${stackHTML}
                    <div class="absolute -bottom-3 z-10 bg-black text-white px-2 py-0.5 rounded-full text-xs font-bold border border-gray-500">${count}</div>
                    ${calledBadge}${catchBtn}
                </div>
                <span class="mt-4 font-bold text-xs whitespace-nowrap bg-gray-900/80 px-2 py-1 rounded ${isTurn ? 'text-green-400 border border-green-500' : 'text-gray-300'} ${S.selectedOpp === p.uid ? 'ring-2 ring-red-400' : ''}">${esc(p.name)}</span>
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
            const c = pile[i];
            stack += `<div class="uno-card bg-${c.color}" style="position:absolute;left:0;top:0;transform:translate(${((i * 29) % 9) - 4}px,${((i * 17) % 7) - 3}px) rotate(${pileRot(i)}deg)">${generateCardHTML(c)}</div>`;
        }
        const topBg = topCard.color === 'Black' ? state.currentColor : topCard.color;
        stack += `<div class="uno-card pile-top bg-${topBg}" style="position:absolute;left:0;top:0;transform:rotate(${pileRot(n - 1)}deg)">${generateCardHTML(topCard)}</div>`;
        document.getElementById('discard-pile-ui').innerHTML = `<div style="position:relative;width:80px;height:116px">${stack}</div>`;
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
        c.className = `uno-card bg-${card.color} ${isPlay ? 'playable' : 'unplayable'}`;
        c.onclick = () => humanPlayCard(idx);
        c.innerHTML = generateCardHTML(card);
        handUI.appendChild(c);
    });

    // Tombol UNO: berdenyut saat sudah boleh ditekan
    const btnUno = document.getElementById('btn-uno');
    btnUno.classList.toggle('animate-pulse', canCallUno(state));
    btnUno.classList.toggle('opacity-50', !!state.unoCalled[me]);

    // Giliran
    const btnPass = document.getElementById('btn-pass');
    const ti = document.getElementById('turn-indicator');
    if (isMyTurn()) {
        ti.innerText = S.hasDrawnThisTurn ? "Main atau Lewati!" : "Giliran Kamu!";
        ti.className = "text-lg md:text-2xl font-black text-green-400 animate-pulse";
        btnPass.classList.toggle('hidden', !S.hasDrawnThisTurn);
    } else {
        ti.innerText = `Giliran ${S.roomData.players[state.turnIndex].name}`;
        ti.className = "text-lg md:text-2xl font-bold text-yellow-400";
        btnPass.classList.add('hidden');
        S.hasDrawnThisTurn = false;
    }
    document.getElementById('direction-indicator').innerText = state.direction === 1 ? 'Arah: ▶ Kanan' : 'Arah: ◀ Kiri';

    const logsUI = document.getElementById('logs-container');
    logsUI.innerHTML = state.logs.map(l => `<div class="border-b border-gray-700 pb-1">${l}</div>`).join('');
    logsUI.scrollTop = logsUI.scrollHeight;

    applyHold();
    syncTimer(state);
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
