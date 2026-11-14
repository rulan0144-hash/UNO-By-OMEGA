import { go } from '../../app/router.js';
import { LOCAL_UID } from '../../core/config.js';
import { S, cloneState } from '../../core/state.js';
import { dealGame, MAX_PLAYERS } from './deck.js';
import { actorUid, isCatchable, penalize } from './rules.js';
import { decide, UNO_CALL_CHANCE } from './bot.js';
import { applyMove, updateRemoteState } from './actions.js';
import { renderGame } from './ui.js';
import { whenIdle } from './animations.js';

// --- MODE VS KOMPUTER (lokal, tanpa Firebase) --- maks. 6 pemain (1-5 lawan)
function beginGame(players) {
    if (window.stopNmTimerHook) window.stopNmTimerHook();   // permainan baru: hitungan 15 detik mulai dari awal
    clearTimeout(S.botTimer);
    S.winSoundKey = null; S.winShown = null;
    S.localMode = true;
    S.currentUser = { uid: LOCAL_UID };
    S.currentRoomCode = 'LOCAL-NOMERCY';
    S.roomData = { mode: 'nomercy', hostId: LOCAL_UID, status: 'playing', players, gameState: dealGame(players) };
    S.hasDrawnThisTurn = false;
    S.selIdx = -1; S.selCard = null;
    document.getElementById('n-over-modal').classList.add('hidden');
    go('nm-screen');
    renderGame();
    scheduleBot();
}

window.startNmLocal = () => {
    const n = Math.min(MAX_PLAYERS - 1, Math.max(1, parseInt(document.getElementById('bot-count').value) || 1));
    const players = [{ uid: LOCAL_UID, name: S.myName || 'Kamu' }];
    for (let i = 1; i <= n; i++) players.push({ uid: 'bot' + i, name: 'Komputer ' + i, isBot: true });
    beginGame(players);
};

// Bot bertindak jika dialah pemegang giliran (atau korban Color Roulette)
export function scheduleBot() {
    clearTimeout(S.botTimer);
    if (!S.localMode || S.paused || !S.roomData || S.roomData.status !== 'playing') return;
    const aUid = actorUid(S.roomData.gameState);
    const cur = S.roomData.players.find(p => p.uid === aUid);
    if (cur && cur.isBot) S.botTimer = setTimeout(() => whenIdle().then(() => botTurn(cur)), 1200);
}

export function botTurn(bot) {
    if (!S.localMode || S.paused || !S.roomData || S.roomData.status !== 'playing') return;
    const s = cloneState();
    const uid = bot.uid;
    if (actorUid(s) !== uid) return;
    const players = S.roomData.players;

    // Bot bisa menangkap pemain yang lupa UNO sebelum jalan
    const victims = Object.keys(s.forgot || {}).filter(u => u !== uid && isCatchable(s, u));
    if (victims.length && Math.random() < 0.4) penalize(s, victims[0], uid);

    if (!s.winner) {
        const pick = (st) => decide(st, players, uid);
        // Bot kadang "lupa" UNO (10%) -> bisa ditangkap pemain
        applyMove(s, uid, pick(s), pick, Math.random() < UNO_CALL_CHANCE);
    }
    updateRemoteState(s);
}
