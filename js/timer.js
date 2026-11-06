import { S } from './state.js';
import { whenIdle } from './animations.js';
import { isMyTurn } from './rules.js';
import { timeoutTurn } from './actions.js';

// Batas waktu 15 detik per giliran. Hitungan baru mulai setelah animasi selesai.
export const TURN_SECONDS = 15;
let tick = null, deadline = 0, key = '', firedKey = '';

function setBar(frac, secs) {
    const bar = document.getElementById('turn-bar');
    const num = document.getElementById('turn-time');
    if (bar) {
        bar.style.width = Math.round(frac * 100) + '%';
        bar.className = 'h-full ' + (frac > 0.5 ? 'bg-green-500' : frac > 0.25 ? 'bg-yellow-500' : 'bg-red-500');
    }
    if (num) num.innerText = secs;
}

export function stopTimer() {
    clearInterval(tick);
    tick = null; key = '';
    setBar(1, TURN_SECONDS);
}

export function syncTimer(state) {
    if (!S.roomData || S.roomData.status !== 'playing') { stopTimer(); return; }
    const k = S.currentRoomCode + ':' + (state.turnNo || 0) + ':' + state.turnIndex;
    if (k === key) return;
    clearInterval(tick);
    key = k; deadline = 0;
    setBar(1, TURN_SECONDS);
    whenIdle().then(() => {
        if (key !== k) return;
        deadline = Date.now() + TURN_SECONDS * 1000;
        tick = setInterval(() => onTick(k), 200);
        onTick(k);
    });
}

function onTick(k) {
    if (key !== k || !S.roomData || S.roomData.status !== 'playing') { stopTimer(); return; }
    const left = deadline - Date.now();
    setBar(Math.max(0, left) / (TURN_SECONDS * 1000), Math.ceil(Math.max(0, left) / 1000));
    if (left > 0 || firedKey === k) return;
    const cur = S.roomData.players[S.roomData.gameState.turnIndex];
    if (cur.isBot) return;                                   // bot jalan sendiri
    if (isMyTurn()) { firedKey = k; timeoutTurn(cur.uid); }  // giliranku habis
    else if (!S.localMode && S.roomData.hostId === S.currentUser.uid && left <= -4000) {
        firedKey = k; timeoutTurn(cur.uid);                  // host menggantikan pemain yang diam/terputus
    }
}
