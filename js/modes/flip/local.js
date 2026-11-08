import { go } from '../../app/router.js';
import { LOCAL_UID } from '../../core/config.js';
import { S, cloneState, esc, fx } from '../../core/state.js';
import { COLORS_OF, dealGame, drawFrom, face } from './deck.js';
import { advance, isPlayableIn, penalize, playCardOn, resolvePending } from './rules.js';
import { updateRemoteState } from './actions.js';
import { renderGame } from './ui.js';
import { whenIdle } from './animations.js';

// --- MODE VS KOMPUTER (lokal, tanpa Firebase) ---
// Pertandingan = beberapa ronde; pemain pertama yang mencapai 500 poin menang.
function beginRound(players, scores, round) {
    if (window.stopFlipTimerHook) window.stopFlipTimerHook();   // ronde baru: hitungan 15 detik mulai dari awal
    clearTimeout(S.botTimer);
    S.winSoundKey = null; S.winShown = null;
    S.localMode = true;
    S.currentUser = { uid: LOCAL_UID };
    S.currentRoomCode = 'LOCAL-FLIP';
    S.roomData = { mode: 'flip', hostId: LOCAL_UID, status: 'playing', players, gameState: dealGame(players, scores, round) };
    S.hasDrawnThisTurn = false;
    S.selIdx = -1; S.selCard = null;
    document.getElementById('f-over-modal').classList.add('hidden');
    go('flip-screen');
    renderGame();
    scheduleBot();
}

window.startFlipLocal = () => {
    const n = parseInt(document.getElementById('bot-count').value) || 1;
    const players = [{ uid: LOCAL_UID, name: S.myName || 'Kamu' }];
    for (let i = 1; i <= n; i++) players.push({ uid: 'bot' + i, name: 'Komputer ' + i, isBot: true });
    beginRound(players, {}, 1);
};

// Ronde berikutnya: poin dibawa dari ronde sebelumnya
window.flipNextRound = () => {
    if (!S.roomData || S.roomData.status !== 'finished') return;
    const st = S.roomData.gameState;
    beginRound(S.roomData.players, st.scores, (st.round || 1) + 1);
};

export function scheduleBot() {
    clearTimeout(S.botTimer);
    if (!S.localMode || S.paused || !S.roomData || S.roomData.status !== 'playing') return;
    const cur = S.roomData.players[S.roomData.gameState.turnIndex];
    if (cur.isBot) S.botTimer = setTimeout(() => whenIdle().then(() => botTurn(cur)), 1200);
}

// Warna terbanyak di tangan (sisi yang sedang main), untuk kartu Wild
export function bestColor(hand, skipIdx, side) {
    const cnt = {};
    hand.forEach((c, i) => { const f = face(c, side); if (i !== skipIdx && f.color !== 'Black') cnt[f.color] = (cnt[f.color] || 0) + 1; });
    const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    return top || COLORS_OF(side)[Math.floor(Math.random() * 4)];
}

export function botTurn(bot) {
    if (!S.localMode || S.paused || !S.roomData || S.roomData.status !== 'playing') return;
    const s = cloneState();
    const uid = bot.uid;
    if (S.roomData.players[s.turnIndex].uid !== uid) return;

    // Bot bisa menangkap pemain yang lupa UNO sebelum jalan
    if (s.catchable && s.catchable !== uid && Math.random() < 0.6) penalize(s, s.catchable, uid);
    s.catchable = null;

    // Ada Wild Draw yang harus dijawab: ambil kartu atau tantang (sekitar 22%)
    if (s.pending) {
        const wonP = resolvePending(s, uid, Math.random() < 0.78 ? 'draw' : 'challenge');
        updateRemoteState(s, wonP ? { status: 'finished' } : {});
        return;
    }

    const ok = (c) => isPlayableIn(s, c);
    const hand = s.hands[uid];
    let idx = hand.findIndex(c => face(c, s.side).color !== 'Black' && ok(c));
    if (idx < 0) idx = hand.findIndex(c => face(c, s.side).color === 'Black');
    if (idx < 0) {
        const got = drawFrom(s, 1, Math.random() < 0.5 ? 'L' : 'R');
        const d = got.cards[0];
        if (d) {
            hand.push(d);
            fx(s, { t: 'draw', uid, n: 1, sides: got.sides, cards: got.cards });
            s.logs.push(`<b>${esc(bot.name)}</b> mengambil kartu.`);
            if (ok(d)) idx = hand.length - 1;
        }
    }
    if (idx < 0) { advance(s); updateRemoteState(s); return; }

    const f = face(hand[idx], s.side);
    const color = f.color === 'Black' ? bestColor(hand, idx, s.side) : f.color;
    // Bot kadang "lupa" UNO (30%) -> bisa ditangkap pemain
    const won = playCardOn(s, uid, idx, color, Math.random() < 0.7);
    updateRemoteState(s, won ? { status: 'finished' } : {});
}
