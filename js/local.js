import { COLORS, LOCAL_UID } from './config.js';
import { S, cloneState, esc, fx } from './state.js';
import { dealGame, extractCards } from './deck.js';
import { advance, penalize, playCardOn, resolvePending } from './rules.js';
import { updateRemoteState } from './actions.js';
import { renderGame } from './ui.js';
import { whenIdle } from './animations.js';

// --- MODE VS KOMPUTER (lokal, tanpa Firebase) ---
window.startLocal = () => {
    const n = parseInt(document.getElementById('bot-count').value) || 1;
    S.localMode = true;
    S.currentUser = { uid: LOCAL_UID };
    const players = [{ uid: LOCAL_UID, name: S.myName || 'Kamu' }];
    for (let i = 1; i <= n; i++) players.push({ uid: 'bot' + i, name: 'Komputer ' + i, isBot: true });
    S.currentRoomCode = 'LOCAL';
    S.roomData = { hostId: LOCAL_UID, status: 'playing', players, gameState: dealGame(players) };
    S.hasDrawnThisTurn = false;
    S.selectedOpp = null;
    document.getElementById('home-screen').classList.add('hidden');
    document.getElementById('game-over-modal').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    renderGame();
    scheduleBot();
};

export function scheduleBot() {
    clearTimeout(S.botTimer);
    if (!S.localMode || !S.roomData || S.roomData.status !== 'playing') return;
    const cur = S.roomData.players[S.roomData.gameState.turnIndex];
    if (cur.isBot) S.botTimer = setTimeout(() => whenIdle().then(() => botTurn(cur)), 1200);
}

export function botTurn(bot) {
    if (!S.localMode || !S.roomData || S.roomData.status !== 'playing') return;
    const s = cloneState();
    const uid = bot.uid;
    if (S.roomData.players[s.turnIndex].uid !== uid) return;

    // Bot bisa menangkap pemain yang lupa UNO sebelum jalan
    if (s.catchable && s.catchable !== uid && Math.random() < 0.6) penalize(s, s.catchable, uid);
    s.catchable = null;

    // Ada +4 yang harus dijawab: ambil kartu atau tantang
    if (s.pending) {
        resolvePending(s, uid, Math.random() < 0.78 ? 'draw' : 'challenge');   // sekitar 22% menantang
        updateRemoteState(s);
        return;
    }

    const top = s.discardPile[s.discardPile.length - 1];
    const ok = (c) => c.color === 'Black' || c.color === s.currentColor || c.value === top.value;
    const hand = s.hands[uid];
    let idx = hand.findIndex(c => c.color !== 'Black' && ok(c));
    if (idx < 0) idx = hand.findIndex(c => c.color === 'Black');
    if (idx < 0) {
        const d = extractCards(s, 1)[0];
        if (d) {
            hand.push(d);
                    fx(s, { t: 'draw', uid, n: 1 });
            s.logs.push(`<b>${esc(bot.name)}</b> mengambil kartu.`);
            if (ok(d)) idx = hand.length - 1;
        }
    }
    if (idx < 0) { advance(s); updateRemoteState(s); return; }

    const card = hand[idx];
    let color = card.color;
    if (color === 'Black') {
        const cnt = {};
        hand.forEach((c, i) => { if (i !== idx && c.color !== 'Black') cnt[c.color] = (cnt[c.color] || 0) + 1; });
        color = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || COLORS[Math.floor(Math.random() * 4)];
    }
    // Bot kadang "lupa" UNO (30%) -> bisa ditangkap pemain
    const won = playCardOn(s, uid, idx, color, Math.random() < 0.7);
    updateRemoteState(s, won ? { status: 'finished' } : {});
}
