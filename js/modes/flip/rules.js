import { S, fx, nameOf } from '../../core/state.js';
import { drawFrom, drawUntil, face, oppSide, shuffle, pointOf, NAMES } from './deck.js';

export function isMyTurn() {
    if (!S.roomData || S.roomData.status !== 'playing') return false;
    return S.roomData.players[S.roomData.gameState.turnIndex].uid === S.currentUser.uid;
}

export const topCard = (st) => st.discardPile[st.discardPile.length - 1];

// Kartu cocok jika warna / nilai sama (sesuai sisi yang sedang main); kartu hitam selalu boleh.
export function isPlayableIn(st, card) {
    if (st.pending) return false;                  // ada Wild Draw yang menunggu jawaban
    const f = face(card, st.side);
    if (f.color === 'Black' || st.currentColor === 'Black') return true;
    return f.color === st.currentColor || f.value === face(topCard(st), st.side).value;
}
export const isPlayable = (card) => isPlayableIn(S.roomData.gameState, card);

export function advance(state) {
    const n = S.roomData.players.length;
    state.turnIndex = (state.turnIndex + state.direction + n) % n;
    state.turnNo = (state.turnNo || 0) + 1;
}

// Status "sudah UNO" batal jika kartu > 2 atau jumlah kartu bertambah.
export function normalizeUno(state, prevHands) {
    Object.keys(state.hands).forEach(u => {
        const n = state.hands[u].length;
        const before = prevHands && prevHands[u] ? prevHands[u].length : n;
        if (n > 2 || n > before) state.unoCalled[u] = false;
    });
    // Pemain yang lupa UNO tetap bisa ditangkap SELAMA kartunya masih tepat 1 dan belum bilang UNO (tidak ada batas waktu / tidak hilang saat pemain lain bertindak)
    if (state.forgot) Object.keys(state.forgot).forEach(u => { if (!state.hands[u] || state.hands[u].length !== 1 || state.unoCalled[u]) delete state.forgot[u]; });
}
export const isCatchable = (state, uid) => !!(state.forgot && state.forgot[uid]) && !state.unoCalled[uid] && !!state.hands[uid] && state.hands[uid].length === 1;

// Beri kartu (jumlah tetap) ke pemain + catat animasi
export function giveCards(state, uid, n, pen = false) {   // pen = +2 hukuman tantangan salah (bunyi "Draw two!")
    const got = drawFrom(state, n);
    state.hands[uid] = state.hands[uid].concat(got.cards);
    if (got.cards.length) fx(state, { t: 'draw', uid, n: got.cards.length, sides: got.sides, cards: got.cards, pen });
    return got.cards.length;
}
// Beri kartu sampai dapat warna tertentu
export function giveUntil(state, uid, color) {
    const got = drawUntil(state, color);
    state.hands[uid] = state.hands[uid].concat(got.cards);
    if (got.cards.length) fx(state, { t: 'draw', uid, n: got.cards.length, sides: got.sides, cards: got.cards });
    return got.cards.length;
}

export function penalize(state, uid, byUid) {
    fx(state, { t: 'catch', by: byUid, uid });
    giveCards(state, uid, 2);
    state.unoCalled[uid] = false;
    if (state.forgot) delete state.forgot[uid];
    state.logs.push(`<b>${nameOf(byUid)}</b> menangkap <b>${nameOf(uid)}</b> yang lupa UNO! +2 kartu.`);
}

// Dipakai manusia & bot. Return true jika pemain menang ronde.
export function playCardOn(state, uid, cardIdx, chosenColor, callUno) {
    const players = S.roomData.players;
    const hand = state.hands[uid];
    const card = hand.splice(cardIdx, 1)[0];
    const f = face(card, state.side);
    const prevColor = state.currentColor;          // warna sebelum kartu ini (untuk tantangan Wild Draw)
    state.discardPile.push(card);
    fx(state, { t: 'play', uid, card, side: state.side, color: chosenColor });
    if (f.color === 'Black') fx(state, { t: 'picker', color: chosenColor, side: state.side });
    state.currentColor = f.color === 'Black' ? chosenColor : f.color;
    state.logs.push(`<b>${nameOf(uid)}</b> mengeluarkan ${f.value === 'Wild' ? 'Wild' : (NAMES[f.color] + ' ' + f.value)}`);

    // Kartu terakhir: efek tetap berjalan, menang ditetapkan sesudahnya jika tangan masih kosong.
    const emptied = hand.length === 0;
    if (emptied) {
        state.unoCalled[uid] = false;
    } else if (hand.length === 1) {
        if (callUno) {
            state.unoCalled[uid] = true;
            fx(state, { t: 'uno', uid });
            state.logs.push(`<b>${nameOf(uid)}</b> berteriak UNO!`);
        }
        if (!state.unoCalled[uid]) {
            (state.forgot = state.forgot || {})[uid] = true;   // bisa ditangkap selama kartunya masih 1
            state.logs.push(`<b>${nameOf(uid)}</b> sisa 1 kartu tapi belum bilang UNO!`);
        }
    } else {
        state.unoCalled[uid] = false;
    }
    applyCardEffect(state, card, f, players.findIndex(p => p.uid === uid), prevColor);
    if (emptied) {
        if (state.pending) { state.pendingWinner = uid; return false; }
        if (state.hands[uid].length === 0) { state.winner = uid; return true; }
        state.logs.push(`Kartu <b>${nameOf(uid)}</b> bertambah lagi karena efek kartu terakhir, permainan lanjut!`);
    }
    return false;
}

function checkPendingWin(state) {
    const w = state.pendingWinner;
    state.pendingWinner = null;
    if (w && state.hands[w] && state.hands[w].length === 0) { state.winner = w; return true; }
    return false;
}

export function applyCardEffect(state, card, f, playerIdx, prevColor) {
    const players = S.roomData.players, pCount = players.length;
    const nextIdx = (playerIdx + state.direction + pCount) % pCount;
    const nextNextIdx = (nextIdx + state.direction + pCount) % pCount;
    const nextUid = players[nextIdx].uid, me = players[playerIdx].uid;
    state.turnNo = (state.turnNo || 0) + 1;
    const c = state.currentColor;

    switch (f.value) {
        case 'Skip':
            state.logs.push('Giliran dilewati!');
            fx(state, { t: 'banner', k: 'skip', c, side: state.side });
            state.turnIndex = nextNextIdx;
            break;
        case 'Skip Everyone':
            state.logs.push('Semua pemain dilewati! Giliran kembali ke pemain yang sama.');
            fx(state, { t: 'banner', k: 'skipall', c, side: state.side });
            state.turnIndex = playerIdx;
            break;
        case 'Reverse':
            fx(state, { t: 'banner', k: 'reverse', c, side: state.side });
            if (pCount === 2) {
                state.logs.push('Putar balik -> lewati!');
                state.turnIndex = nextNextIdx;
            } else {
                state.direction *= -1;
                state.logs.push('Arah berbalik!');
                state.turnIndex = (playerIdx + state.direction + pCount) % pCount;
            }
            break;
        case 'Draw One':
            state.logs.push('+1 kartu dan dilewati!');
            fx(state, { t: 'banner', k: 'draw1', c, side: state.side });
            giveCards(state, nextUid, 1);
            state.turnIndex = nextNextIdx;
            break;
        case 'Draw Five':
            state.logs.push('+5 kartu dan dilewati!');
            fx(state, { t: 'banner', k: 'draw5', c, side: state.side });
            giveCards(state, nextUid, 5);
            state.turnIndex = nextNextIdx;
            break;
        case 'Wild Draw Two':
            state.pending = { type: 'wd2', total: 2, by: me, prevColor, color: c };
            state.logs.push(`+2 dimainkan! ${nameOf(nextUid)} boleh menantang atau ambil kartu.`);
            fx(state, { t: 'banner', k: 'draw2', c, side: state.side });
            state.turnIndex = nextIdx;
            break;
        case 'Wild Draw Color':
            state.pending = { type: 'wdc', total: 0, by: me, prevColor, color: c };
            state.logs.push(`Wild Draw Color (${NAMES[c]})! ${nameOf(nextUid)} boleh menantang atau ambil kartu sampai dapat warna itu.`);
            fx(state, { t: 'banner', k: 'wdc', c, side: state.side });
            state.turnIndex = nextIdx;
            break;
        case 'Flip': {
            const to = oppSide(state.side);
            const nf = face(card, to);                    // sisi lain kartu Flip menjadi warna yang berlaku
            fx(state, { t: 'flip', from: state.side, to });
            state.side = to;
            state.currentColor = nf.color;                // Hitam (Wild) = semua kartu boleh dimainkan
            state.logs.push(`FLIP! Sekarang sisi ${to === 'dark' ? 'GELAP' : 'TERANG'}.` + (nf.color === 'Black' ? ' Kartu Flip berbalik jadi Wild: semua kartu boleh dimainkan.' : ''));
            state.turnIndex = nextIdx;
            break;
        }
        default:
            state.turnIndex = nextIdx;
    }
}

export function canCallUno(state) {
    const hand = state.hands[S.currentUser.uid] || [];
    if (state.unoCalled[S.currentUser.uid]) return false;
    return hand.length === 1 || (hand.length === 2 && hand.some(c => isPlayableIn(state, c)));
}

// Jawaban atas Wild Draw Two / Wild Draw Color: 'draw' = ambil kartu, 'challenge' = tantang
export function resolvePending(state, uid, choice) {
    const p = state.pending;
    if (!p) return false;
    state.pending = null;
    const penalty = (who, extra) => (p.type === 'wdc' ? giveUntil(state, who, p.color) : giveCards(state, who, p.total)) + (extra ? giveCards(state, who, extra, true) : 0);
    const label = p.type === 'wdc' ? `sampai dapat warna ${NAMES[p.color]}` : `${p.total} kartu`;
    if (choice === 'challenge') {
        const guilty = p.prevColor !== 'Black' && state.hands[p.by].some(c => face(c, state.side).color === p.prevColor);
        fx(state, { t: 'challenge', by: uid, target: p.by, ok: guilty, color: p.prevColor });
        if (guilty) {
            state.logs.push(`<b>${nameOf(uid)}</b> menantang <b>${nameOf(p.by)}</b> (warna sebelumnya: ${p.prevColor}): BENAR! ${nameOf(p.by)} ambil kartu ${label}.`);
            penalty(p.by, 0);
            state.turnNo = (state.turnNo || 0) + 1;   // penantang main seperti biasa
        } else {
            state.logs.push(`<b>${nameOf(uid)}</b> menantang <b>${nameOf(p.by)}</b> (warna sebelumnya: ${p.prevColor}): SALAH! ${nameOf(uid)} ambil kartu ${label} + 2.`);
            penalty(uid, 2);
            advance(state);
        }
    } else {
        state.logs.push(`<b>${nameOf(uid)}</b> mengambil kartu ${label}.`);
        penalty(uid, 0);
        advance(state);
    }
    return checkPendingWin(state);
}
export { shuffle };

// Poin kemenangan (seperti klasik): jumlah poin kartu sisa lawan pada SISI YANG SEDANG MAIN saat permainan berakhir.
export function tallyRound(state) {
    let pts = 0;
    const detail = [];
    S.roomData.players.forEach(p => {
        if (p.uid === state.winner) return;
        const cards = state.hands[p.uid] || [];
        const sc = cards.reduce((a, c) => a + pointOf(face(c, state.side)), 0);
        pts += sc; detail.push({ uid: p.uid, n: cards.length, pts: sc });
    });
    state.roundPts = pts; state.roundDetail = detail; state.scoreSide = state.side;
}
