import { S, fx, nameOf } from './state.js';
import { drawFrom, shuffle } from './deck.js';

export function isMyTurn() {
    if (!S.roomData || S.roomData.status !== 'playing') return false;
    return S.roomData.players[S.roomData.gameState.turnIndex].uid === S.currentUser.uid;
}

export function isPlayable(card) {
    const st = S.roomData.gameState;
    if (st.pending) return false;   // ada +4 menunggu jawaban: belum boleh main kartu
    if (card.color === 'Black') return true;
    const topCard = st.discardPile[st.discardPile.length - 1];
    return card.color === st.currentColor || card.value === topCard.value;
}

export function advance(state) {
    const n = S.roomData.players.length;
    state.turnIndex = (state.turnIndex + state.direction + n) % n;
    state.turnNo = (state.turnNo || 0) + 1;
}

// Status "sudah UNO" batal jika kartu > 2, atau jumlah kartu pemain bertambah
// (ambil kartu, kena +2/+4, penalti, Acak). Harus tekan UNO lagi.
export function normalizeUno(state, prevHands) {
    Object.keys(state.hands).forEach(u => {
        const n = state.hands[u].length;
        const before = prevHands && prevHands[u] ? prevHands[u].length : n;
        if (n > 2 || n > before) state.unoCalled[u] = false;
    });
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
    const prevColor = state.currentColor;   // warna sebelum kartu ini (dipakai untuk tantangan +4)
    state.catchable = null;
    state.discardPile.push(card);
    fx(state, { t: 'play', uid, card, color: chosenColor });
    if (card.color === 'Black') fx(state, { t: 'picker', color: chosenColor });
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
    applyCardEffect(state, card, players.findIndex(p => p.uid === uid), prevColor);
    return false;
}

export function applyCardEffect(state, card, playerIdx, prevColor) {
    const pCount = S.roomData.players.length;
    const nextIdx = (playerIdx + state.direction + pCount) % pCount;
    const nextNextIdx = (nextIdx + state.direction + pCount) % pCount;
    const nextUid = S.roomData.players[nextIdx].uid;
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
        case 'Wild Draw Four': {
            // +4 tidak langsung dibagikan: pemain berikutnya memilih menantang atau ambil kartu
            state.pending = { total: 4, by: S.roomData.players[playerIdx].uid, prevColor };
            state.logs.push(`+4 dimainkan! ${nameOf(nextUid)} boleh menantang atau ambil kartu.`);
            fx(state, { t: 'banner', k: 'draw4' });
            state.turnIndex = nextIdx;
            break;
        }
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
    const { cards: got, sides } = drawFrom(state, n);
    state.hands[uid] = state.hands[uid].concat(got);
    if (got.length) fx(state, { t: 'draw', uid, n: got.length, sides });
    return got.length;
}

// Jawaban atas +4: 'draw' = ambil kartu, 'challenge' = tantang pemain yang memainkan +4
export function resolvePending(state, uid, choice) {
    const p = state.pending;
    if (!p) return;
    state.pending = null;
    state.catchable = null;
    if (choice === 'challenge') {
        const guilty = state.hands[p.by].some(c => c.color === p.prevColor);   // masih punya kartu warna sebelumnya?
        fx(state, { t: 'challenge', by: uid, target: p.by, ok: guilty, color: p.prevColor });
        if (guilty) {
            state.logs.push(`<b>${nameOf(uid)}</b> menantang <b>${nameOf(p.by)}</b>: BENAR! ${nameOf(p.by)} ambil ${p.total} kartu.`);
            giveCards(state, p.by, p.total);
            state.turnNo = (state.turnNo || 0) + 1;   // penantang main seperti biasa
        } else {
            state.logs.push(`<b>${nameOf(uid)}</b> menantang <b>${nameOf(p.by)}</b>: SALAH! ${nameOf(uid)} ambil ${p.total + 2} kartu.`);
            giveCards(state, uid, p.total + 2);
            advance(state);
        }
    } else {
        state.logs.push(`<b>${nameOf(uid)}</b> mengambil ${p.total} kartu.`);
        giveCards(state, uid, p.total);
        advance(state);
    }
}
