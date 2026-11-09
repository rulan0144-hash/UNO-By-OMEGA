import { go } from '../../app/router.js';
import { LOCAL_UID } from '../../core/config.js';
import { S, cloneState, esc, fx } from '../../core/state.js';
import { dealGame, drawFrom } from './deck.js';
import { actorUid, advance, isPlayableIn, isCatchable, penalize, playCardOn, resolvePending } from './rules.js';
import { answerPending, choosePlay } from './bot.js';
import { updateRemoteState } from './actions.js';
import { renderGame } from './ui.js';
import { whenIdle } from './animations.js';

// --- MODE VS KOMPUTER (lokal, tanpa Firebase) --- maks. 8 pemain (1-7 lawan)
function beginGame(players) {
    if (window.stopFlexTimerHook) window.stopFlexTimerHook();   // permainan baru: hitungan 15 detik mulai dari awal
    clearTimeout(S.botTimer);
    S.winSoundKey = null; S.winShown = null;
    S.localMode = true;
    S.currentUser = { uid: LOCAL_UID };
    S.currentRoomCode = 'LOCAL-FLEX';
    S.roomData = { mode: 'flex', hostId: LOCAL_UID, status: 'playing', players, gameState: dealGame(players) };
    S.hasDrawnThisTurn = false;
    S.selIdx = -1; S.selCard = null;
    document.getElementById('x-over-modal').classList.add('hidden');
    go('flex-screen');
    renderGame();
    scheduleBot();
}

window.startFlexLocal = () => {
    const n = Math.min(7, Math.max(1, parseInt(document.getElementById('bot-count').value) || 1));
    const players = [{ uid: LOCAL_UID, name: S.myName || 'Kamu' }];
    for (let i = 1; i <= n; i++) players.push({ uid: 'bot' + i, name: 'Komputer ' + i, isBot: true });
    beginGame(players);
};

// Bot bertindak jika dialah pelaku sekarang (pemegang giliran, atau pemain yang ditunjuk pada Wild Draw 4 sisi flex)
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

    // Ada Wild Draw 4 yang harus dijawab: ambil kartu atau tantang (sekitar 22%)
    if (s.pending) {
        const wonP = resolvePending(s, uid, answerPending());
        updateRemoteState(s, wonP ? { status: 'finished' } : {});
        return;
    }

    let mv = choosePlay(s, players, uid);
    if (!mv) {
        const hand = s.hands[uid];
        const got = drawFrom(s, 1, Math.random() < 0.5 ? 'L' : 'R');
        const d = got.cards[0];
        if (d) {
            hand.push(d);
            fx(s, { t: 'draw', uid, n: 1, sides: got.sides, cards: got.cards });
            s.logs.push(`<b>${esc(bot.name)}</b> mengambil kartu.`);
            if (isPlayableIn(s, uid, d)) mv = choosePlay({ ...s, hands: { ...s.hands, [uid]: [d] } }, players, uid);   // hanya kartu baru yang boleh dimainkan
            if (mv) mv.idx = hand.length - 1;
        }
    }
    if (!mv) { advance(s); updateRemoteState(s); return; }
    // Bot kadang "lupa" UNO (30%) -> bisa ditangkap pemain
    const won = playCardOn(s, uid, mv.idx, { flex: mv.flex, color: mv.color, target: mv.target, callUno: Math.random() < 0.7 });
    updateRemoteState(s, won ? { status: 'finished' } : {});
}
