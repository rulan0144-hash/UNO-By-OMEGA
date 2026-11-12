import { go } from '../../app/router.js';
import { LOCAL_UID } from '../../core/config.js';
import { S, cloneState, esc, fx } from '../../core/state.js';
import { dealGame, drawFrom } from './deck.js';
import { actorUid, advance, isCatchable, penalize, playCardOn } from './rules.js';
import { choosePlay, shouldDraw, isStopper, chooseColor, chooseTarget } from './bot.js';
import { updateRemoteState } from './actions.js';
import { renderGame } from './ui.js';
import { whenIdle } from './animations.js';
import { needsTarget } from './deck.js';

// --- MODE VS KOMPUTER (lokal, tanpa Firebase) --- maks. 10 pemain (1-9 lawan)
function beginGame(players) {
    if (window.stopAwTimerHook) window.stopAwTimerHook();   // permainan baru: hitungan 15 detik mulai dari awal
    clearTimeout(S.botTimer);
    S.winSoundKey = null; S.winShown = null;
    S.localMode = true;
    S.currentUser = { uid: LOCAL_UID };
    S.currentRoomCode = 'LOCAL-ALLWILD';
    S.roomData = { mode: 'allwild', hostId: LOCAL_UID, status: 'playing', players, gameState: dealGame(players) };
    S.hasDrawnThisTurn = false;
    S.selIdx = -1; S.selCard = null;
    document.getElementById('w-over-modal').classList.add('hidden');
    go('aw-screen');
    renderGame();
    scheduleBot();
}

window.startAwLocal = () => {
    const n = Math.min(9, Math.max(1, parseInt(document.getElementById('bot-count').value) || 1));
    const players = [{ uid: LOCAL_UID, name: S.myName || 'Kamu' }];
    for (let i = 1; i <= n; i++) players.push({ uid: 'bot' + i, name: 'Komputer ' + i, isBot: true });
    beginGame(players);
};

// Bot bertindak jika dialah pemegang giliran
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

    let mv = null;
    if (shouldDraw(s, players, uid)) {
        // "One more thing": pemain berikut hampir menang -> ambil 1 kartu, mainkan bila penghenti, kalau tidak giliran lewat
        const hand = s.hands[uid];
        const got = drawFrom(s, 1, Math.random() < 0.5 ? 'L' : 'R');
        const d = got.cards[0];
        if (d) {
            hand.push(d);
            fx(s, { t: 'draw', uid, n: 1, sides: got.sides, cards: got.cards });
            s.logs.push(`<b>${esc(bot.name)}</b> mengambil kartu.`);
            if (isStopper(d, players.length)) mv = { idx: hand.length - 1, color: chooseColor(s.currentColor), target: needsTarget(d) ? chooseTarget(s, players, uid) : undefined };
        }
    } else mv = choosePlay(s, players, uid);
    if (!mv) { advance(s); updateRemoteState(s); return; }
    // Bot kadang "lupa" UNO (30%) -> bisa ditangkap pemain
    const won = playCardOn(s, uid, mv.idx, { color: mv.color, target: mv.target, callUno: Math.random() < 0.7 });
    updateRemoteState(s, won ? { status: 'finished' } : {});
}
