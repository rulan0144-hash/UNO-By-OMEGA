import { S } from '../../core/state.js';
import { whenIdle } from './animations.js';
import { actorUid, isMyAction } from './rules.js';
import { timeoutTurn } from './actions.js';
import { sfx } from '../../core/sound.js';

// Batas waktu 15 detik per giliran. Hitungan baru mulai setelah animasi selesai.
export const TURN_SECONDS = 15;
let tick = null, deadline = 0, key = '', firedKey = '', leftAtPause = null, startAfterResume = null, lastTickSec = -1;

// Tampilan hitung mundur gaya stopwatch: 15.00 -> 0.00
function setBar(frac, secs) {
    const box = document.getElementById('n-timer');
    const num = document.getElementById('n-time');
    if (box) box.className = 'turn-timer ' + (frac > 0.5 ? 'tt-ok' : frac > 0.25 ? 'tt-warn' : 'tt-low');
    if (num) num.innerText = secs;
}
const fmt = (ms) => (Math.max(0, ms) / 1000).toFixed(2).padStart(5, '0');

export function stopTimer() {
    clearInterval(tick);
    tick = null; key = ''; leftAtPause = null; startAfterResume = null;
    setBar(1, fmt(TURN_SECONDS * 1000));
}

export function syncTimer(state) {
    if (!S.roomData || S.roomData.status !== 'playing') { stopTimer(); return; }
    const k = S.currentRoomCode + ':' + (state.turnNo || 0) + ':' + state.turnIndex;
    if (k === key) return;
    clearInterval(tick);
    key = k; deadline = 0;
    setBar(1, fmt(TURN_SECONDS * 1000));
    whenIdle().then(() => {
        if (key !== k) return;
        const begin = () => {
            deadline = Date.now() + TURN_SECONDS * 1000;
            lastTickSec = -1;
            if (isMyAction() && !S.paused) sfx('turn');   // "ting-ting": giliranmu
            tick = setInterval(() => onTick(k), 50);
            onTick(k);
        };
        if (S.paused) startAfterResume = begin; else begin();   // sedang dijeda: mulai setelah dilanjutkan
    });
}

// Jeda: hentikan hitungan dan simpan sisa waktu
export function pauseTimer() {
    if (tick) { leftAtPause = Math.max(0, deadline - Date.now()); clearInterval(tick); tick = null; }
}
export function resumeTimer() {
    if (startAfterResume) { const f = startAfterResume; startAfterResume = null; f(); return; }
    if (leftAtPause !== null && key) {
        const k = key;
        deadline = Date.now() + leftAtPause; leftAtPause = null;
        tick = setInterval(() => onTick(k), 50);
    }
}

function onTick(k) {
    if (key !== k || !S.roomData || S.roomData.status !== 'playing') { stopTimer(); return; }
    const left = deadline - Date.now();
    const sec = Math.ceil(Math.max(0, left) / 1000);
    setBar(Math.max(0, left) / (TURN_SECONDS * 1000), fmt(left));
    if (isMyAction() && !S.paused && sec <= 5 && sec >= 1 && sec !== lastTickSec) { lastTickSec = sec; sfx('tick', 0, sec === 1 ? 1 : 0); }   // hitungan 5 detik terakhir
    if (left > 0 || firedKey === k) return;
    const aUid = actorUid(S.roomData.gameState);
    const cur = S.roomData.players.find(p => p.uid === aUid);
    if (!cur || cur.isBot) return;                           // bot jalan sendiri
    if (isMyAction()) { firedKey = k; timeoutTurn(cur.uid); }   // giliranku (atau jawabanku) habis
    else if (!S.localMode && S.roomData.hostId === S.currentUser.uid && left <= -4000) {
        firedKey = k; timeoutTurn(cur.uid);                  // host menggantikan pemain yang diam/terputus
    }
}
