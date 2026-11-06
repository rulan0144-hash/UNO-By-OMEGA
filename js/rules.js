import { S, fx, nameOf } from './state.js';
import { extractCards, shuffle } from './deck.js';

export function isMyTurn() {
    if (!S.roomData || S.roomData.status !== 'playing') return false;
    return S.roomData.players[S.roomData.gameState.turnIndex].uid === S.currentUser.uid;
}

export function isPlayable(card) {
    if (card.color === 'Black') return true;
    const st = S.roomData.gameState;
    const topCard = st.discardPile[st.discardPile.length - 1];
    return card.color === st.currentColor || card.value === topCard.value;
}

export function advance(state) {
    const n = S.roomData.players.length;
    state.turnIndex = (state.turnIndex + state.direction + n) % n;
    state.turnNo = (state.turnNo || 0) + 1;
}

// Kartu > 2 membatalkan status "sudah UNO"
export function normalizeUno(state) {
    Object.keys(state.hands).forEach(u => { if (state.hands[u].length > 2) state.unoCalled[u] = false; });
}

export function penalize(state, uid, byUid) {
    fx(state, { t: 'catch', by: byUid, uid });
    giveCards(state, uid, 2);
    state.unoCalled[uid] = false;
    state.catchable = null;
    state.logs.push(`🚨 <b>${nameOf(byUid)}</b> menangkap <b>${nameOf(uid)}</b> yang lupa UNO! +2 kartu.`);
}

// Dipakai manusia & bot. Return true jika pemain menang.
export function playCardOn(state, uid, cardIdx, chosenColor, callUno) {
    const players = S.roomData.players;
    const hand = state.hands[uid];
    const card = hand.splice(cardIdx, 1)[0];
    state.catchable = null;
    state.discardPile.push(card);
    fx(state, { t: 'play', uid, card, color: chosenColor });
    state.currentColor = chosenColor;

    const colorStr = card.color !== 'Black' ? card.color : chosenColor;
    const displayVal = card.value === 'Wild Shuffle Hands' ? 'Acak Kartu' : card.value;
    state.logs.push(`<b>${nameOf(uid)}</b> mengeluarkan <span class="text-${colorStr.toLowerCase()}-400 font-bold">${displayVal}</span>`);

    if (hand.length === 0) { state.winner = uid; return true; }

    if (hand.length === 1) {
        if (callUno) {
            state.unoCalled[uid] = true;
            fx(state, { t: 'uno', uid });
            state.logs.push(`<b class="text-red-500">${nameOf(uid)} berteriak UNO!</b>`);
        }
        if (!state.unoCalled[uid]) {
            state.catchable = uid; // bisa ditangkap sampai ada pemain lain bertindak
            state.logs.push(`⚠️ <b>${nameOf(uid)}</b> sisa 1 kartu tapi belum bilang UNO!`);
        }
    } else {
        state.unoCalled[uid] = false;
    }
    applyCardEffect(state, card, players.findIndex(p => p.uid === uid));
    return false;
}

export function applyCardEffect(state, card, playerIdx) {
    const pCount = S.roomData.players.length;
    const nextIdx = (playerIdx + state.direction + pCount) % pCount;
    const nextNextIdx = (nextIdx + state.direction + pCount) % pCount;
    const nextUid = S.roomData.players[nextIdx].uid;
    if (card.value === 'Wild') fx(state, { t: 'banner', k: 'wild' });
    state.turnNo = (state.turnNo || 0) + 1;

    switch (card.value) {
        case 'Skip':
            state.logs.push(`⏩ Giliran dilewati!`);
                    fx(state, { t: 'banner', k: 'skip' });
            state.turnIndex = nextNextIdx;
            break;
        case 'Reverse':
            if (pCount === 2) {
                state.logs.push(`🔄 Putar Balik -> Lewati!`);
                    fx(state, { t: 'banner', k: 'reverse' });
                state.turnIndex = nextNextIdx;
            } else {
                state.direction *= -1;
                state.logs.push(`🔄 Arah berbalik!`);
                    fx(state, { t: 'banner', k: 'reverse' });
                state.turnIndex = (playerIdx + state.direction + pCount) % pCount;
            }
            break;
        case 'Draw Two':
            state.logs.push(`💥 +2 Kartu dan dilewati!`);
                    fx(state, { t: 'banner', k: 'draw2' });
            giveCards(state, nextUid, 2);
            state.turnIndex = nextNextIdx;
            break;
        case 'Wild Draw Four':
            state.logs.push(`💥 +4 Kartu dan dilewati!`);
                    fx(state, { t: 'banner', k: 'draw4' });
            giveCards(state, nextUid, 4);
            state.turnIndex = nextNextIdx;
            break;
        case 'Wild Shuffle Hands': {
            state.logs.push(`🌀 SEMUA KARTU DIACAK!`);
                    fx(state, { t: 'banner', k: 'shuffle' });
                    fx(state, { t: 'shuffle' });
            let all = [];
            S.roomData.players.forEach(p => { all = all.concat(state.hands[p.uid]); state.hands[p.uid] = []; });
            shuffle(all);
            let dealIdx = nextIdx;
            while (all.length > 0) {
                state.hands[S.roomData.players[dealIdx].uid].push(all.pop());
                dealIdx = (dealIdx + state.direction + pCount) % pCount;
            }
            state.turnIndex = nextIdx;
            break;
        }
        default:
            state.turnIndex = nextIdx;
    }
}

// UNO aman: sisa 2 kartu & ada yang cocok, atau sisa 1 kartu
export function canCallUno(state) {
    const hand = state.hands[S.currentUser.uid] || [];
    if (state.unoCalled[S.currentUser.uid]) return false;
    return hand.length === 1 || (hand.length === 2 && hand.some(isPlayable));
}

// Beri kartu ke pemain + catat animasi tarik kartu
export function giveCards(state, uid, n) {
    const got = extractCards(state, n);
    state.hands[uid] = state.hands[uid].concat(got);
    if (got.length) fx(state, { t: 'draw', uid, n: got.length });
    return got.length;
}
