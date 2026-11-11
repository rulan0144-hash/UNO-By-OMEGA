// Mesin aturan UNO All Wild (murni, tanpa DOM). Aturan: MEMORI-UNO-BY-OMEGA.md bagian 6ac & 6ak.
// Semua kartu boleh dimainkan kapan saja (tanpa cocok warna/angka); pemain TETAP memilih warna tiap kali main (hanya hiasan, tidak memengaruhi apa pun).
// Tidak ada tantangan +4. Ambil kartu (alih-alih main) boleh kapan saja: kartu yang diambil dimainkan atau giliran lewat.
import { S, fx, nameOf } from '../../core/state.js';
import { drawFrom, needsTarget, pointOf, NAMES } from './deck.js';

export const topCard = (st) => st.discardPile[st.discardPile.length - 1];
const players = () => S.roomData.players;

export const actorUid = (st) => players()[st.turnIndex].uid;
export function isMyTurn() {
    if (!S.roomData || S.roomData.status !== 'playing') return false;
    return players()[S.roomData.gameState.turnIndex].uid === S.currentUser.uid;
}
export const isMyAction = isMyTurn;
const idxOf = (uid) => players().findIndex(p => p.uid === uid);

// Semua kartu selalu boleh dimainkan.
export const isPlayableIn = () => true;
export const playOptions = () => [{}];

export function advance(state) {
    const n = players().length;
    state.turnIndex = (state.turnIndex + state.direction + n) % n;
    state.turnNo = (state.turnNo || 0) + 1;
}

// ---------- UNO & tangkap (sama seperti mode lain) ----------
export function normalizeUno(state, prevHands) {
    Object.keys(state.hands).forEach(u => {
        const n = state.hands[u].length;
        const before = prevHands && prevHands[u] ? prevHands[u].length : n;
        if (n > 2 || n > before) state.unoCalled[u] = false;
    });
    if (state.forgot) Object.keys(state.forgot).forEach(u => { if (!state.hands[u] || state.hands[u].length !== 1 || state.unoCalled[u]) delete state.forgot[u]; });
}
export const isCatchable = (state, uid) => !!(state.forgot && state.forgot[uid]) && !state.unoCalled[uid] && !!state.hands[uid] && state.hands[uid].length === 1;

export function giveCards(state, uid, n, pen = false) {
    const got = drawFrom(state, n);
    state.hands[uid] = state.hands[uid].concat(got.cards);
    if (got.cards.length) fx(state, { t: 'draw', uid, n: got.cards.length, sides: got.sides, cards: got.cards, pen });
    return got.cards.length;
}
export function penalize(state, uid, byUid) {
    fx(state, { t: 'catch', by: byUid, uid });
    giveCards(state, uid, 2);
    state.unoCalled[uid] = false;
    if (state.forgot) delete state.forgot[uid];
    state.logs.push(`<b>${nameOf(byUid)}</b> menangkap <b>${nameOf(uid)}</b> yang lupa UNO! +2 kartu.`);
}

export function canCallUno(state) {
    const uid = S.currentUser.uid;
    const hand = state.hands[uid] || [];
    if (state.unoCalled[uid]) return false;
    return hand.length === 1 || hand.length === 2;               // semua kartu bisa dimainkan -> sisa 2 = akan tersisa 1
}

const BANNER = { Skip: 'skip', Reverse: 'reverse', 'Draw Two': 'draw2', 'Skip Two': 'skip2', 'Draw Four': 'draw4', 'Target Draw Two': 'target2', 'Forced Swap': 'swap' };
const LABEL = { Wild: 'Wild', Skip: 'Wild Skip', Reverse: 'Wild Reverse', 'Draw Two': 'Wild Draw Two', 'Skip Two': 'Wild Skip Two', 'Draw Four': 'Wild Draw Four', 'Target Draw Two': 'Wild Targeted Draw Two', 'Forced Swap': 'Wild Forced Swap' };

// Target kartu "target"/"swap": harus lawan lain. Bila tidak sah -> pemain berikutnya.
function pickTarget(state, pIdx, target) {
    const n = players().length;
    const ok = target && target !== players()[pIdx].uid && idxOf(target) >= 0;
    return ok ? target : players()[(pIdx + state.direction + n) % n].uid;
}

// ---------- memainkan kartu ----------
// opts: { color, target (uid, untuk Targeted Draw Two & Forced Swap), callUno }.  Return true jika ada pemenang.
export function playCardOn(state, uid, cardIdx, opts = {}) {
    const pl = players(), n = pl.length;
    const hand = state.hands[uid];
    const card = hand[cardIdx];
    hand.splice(cardIdx, 1);
    const pIdx = idxOf(uid);
    const color = opts.color || 'Red';
    state.discardPile.push(card);
    fx(state, { t: 'play', uid, card, color });
    fx(state, { t: 'picker', color });
    state.currentColor = color;
    state.turnNo = (state.turnNo || 0) + 1;
    state.logs.push(`<b>${nameOf(uid)}</b> mengeluarkan ${LABEL[card.v]} (${NAMES[color]})`);

    // UNO / kartu terakhir
    const emptied = hand.length === 0;
    if (emptied) state.unoCalled[uid] = false;
    else if (hand.length === 1) {
        if (opts.callUno) { state.unoCalled[uid] = true; fx(state, { t: 'uno', uid }); state.logs.push(`<b>${nameOf(uid)}</b> berteriak UNO!`); }
        if (!state.unoCalled[uid]) { (state.forgot = state.forgot || {})[uid] = true; state.logs.push(`<b>${nameOf(uid)}</b> sisa 1 kartu tapi belum bilang UNO!`); }
    } else state.unoCalled[uid] = false;

    applyEffect(state, card, pIdx, opts.target);

    if (emptied) {
        // Kartu terakhir = Forced Swap: tukar TETAP berjalan (pemain wajib memilih lawan); lawan itu menerima tangan kosong dan MENANG.
        const w = card.v === 'Forced Swap' ? (pl.find(p => state.hands[p.uid].length === 0) || { uid }).uid : uid;
        state.winner = w; return true;
    }
    return false;
}

function applyEffect(state, card, pIdx, target) {
    const pl = players(), n = pl.length, dir = state.direction;
    const idxAfter = (k) => (pIdx + dir * (k + 1) + n * 12) % n;          // pemain ke-(k+1) setelah pemain ini
    const nextUid = pl[idxAfter(0)].uid;
    const me = pl[pIdx].uid;
    const c = state.currentColor;
    state.turnIndex = idxAfter(0);                                      // bawaan: giliran ke pemain berikut
    const fxb = (extra) => fx(state, { t: 'banner', k: BANNER[card.v], c, ...(extra || {}) });

    switch (card.v) {
        case 'Wild': break;                                             // hanya pilih warna
        case 'Skip':
            state.logs.push('Giliran dilewati!'); fxb(); state.turnIndex = idxAfter(1); break;
        case 'Skip Two': {
            // Dua pemain berikut dilewati, berputar apa adanya: 2 pemain -> lawan dilewati lalu kita juga dilewati -> giliran ke lawan; 3 pemain -> kembali ke kita.
            state.logs.push('Dua pemain dilewati!'); fxb(); state.turnIndex = idxAfter(2); break;
        }
        case 'Reverse':
            fxb();
            if (n === 2) { state.logs.push('Putar balik -> lewati!'); state.turnIndex = pIdx; }
            else { state.direction *= -1; state.logs.push('Arah berbalik!'); state.turnIndex = (pIdx + state.direction + n) % n; }
            break;
        case 'Draw Two':
            state.logs.push(`<b>${nameOf(nextUid)}</b> ambil 2 kartu dan dilewati!`); fxb(); giveCards(state, nextUid, 2); state.turnIndex = idxAfter(1); break;
        case 'Draw Four':
            state.logs.push(`<b>${nameOf(nextUid)}</b> ambil 4 kartu dan dilewati!`); fxb(); giveCards(state, nextUid, 4); state.turnIndex = idxAfter(1); break;
        case 'Target Draw Two': {
            const t = pickTarget(state, pIdx, target);
            state.logs.push(`<b>${nameOf(t)}</b> ditunjuk ambil 2 kartu!`); fxb({ target: t });
            giveCards(state, t, 2);                                     // tidak kehilangan giliran
            break;
        }
        case 'Forced Swap': {
            const t = pickTarget(state, pIdx, target);
            const mine = state.hands[me], theirs = state.hands[t];
            state.hands[me] = theirs; state.hands[t] = mine;
            state.logs.push(`<b>${nameOf(me)}</b> menukar tangan dengan <b>${nameOf(t)}</b>!`);
            fxb({ target: t });
            [me, t].forEach(u => {                                       // pemegang 1 kartu setelah tukar harus ingat berteriak UNO
                state.unoCalled[u] = false;
                if (state.hands[u].length === 1) { (state.forgot = state.forgot || {})[u] = true; state.logs.push(`<b>${nameOf(u)}</b> sisa 1 kartu tapi belum bilang UNO!`); }
                else if (state.forgot) delete state.forgot[u];
            });
            break;
        }
    }
}

// ---------- ambil kartu saat giliran ----------
// Ambil 1 kartu (boleh kapan saja). Mengembalikan kartu yang diambil (atau null jika dek habis total).
export function drawOneTurn(state, uid, side) {
    const got = drawFrom(state, 1, side);
    if (!got.cards.length) return null;
    state.hands[uid].push(got.cards[0]);
    fx(state, { t: 'draw', uid, n: 1, sides: got.sides, cards: got.cards });
    state.unoCalled[uid] = false;
    return got.cards[0];
}

// Poin kemenangan: jumlah poin kartu sisa lawan.
export function tallyRound(state) {
    let pts = 0; const detail = [];
    players().forEach(p => {
        if (p.uid === state.winner) return;
        const cards = state.hands[p.uid] || [];
        const sc = cards.reduce((a, c) => a + pointOf(c), 0);
        pts += sc; detail.push({ uid: p.uid, n: cards.length, pts: sc });
    });
    state.roundPts = pts; state.roundDetail = detail;
}
export { needsTarget };
