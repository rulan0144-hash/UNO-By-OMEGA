// Mesin aturan UNO Show 'Em No Mercy (murni, tanpa DOM). Aturan: ATURAN-NOMERCY.md.
// state: deck, discardPile, hands, turnIndex, direction, currentColor, out{uid:true} (tersingkir), setAside[], pending, forced, winner.
//   pending = { kind:'draw', n, top, count } -> hukuman Draw bertumpuk; pemain giliran (turnIndex) boleh menumpuk (Draw >= top) atau takePenalty().
//   pending = { kind:'roulette', by, victim } -> korban memilih warna lewat resolveRoulette().
//   forced  = { uid, id } -> kartu hasil ambil yang WAJIB dimainkan.
import { S, fx, nameOf } from '../../core/state.js';
import { drawFrom, drawValue, isDrawCard, isNumber, needsColor, needsTarget, pointOf, NAMES, MERCY_LIMIT, KNOCKOUT_BONUS } from './deck.js';

export const topCard = (st) => st.discardPile[st.discardPile.length - 1];
const players = () => S.roomData.players;
const idxOf = (uid) => players().findIndex(p => p.uid === uid);

export const isOut = (st, uid) => !!(st.out && st.out[uid]);
export const alivePlayers = (st) => players().filter(p => !isOut(st, p.uid));
export const aliveCount = (st) => alivePlayers(st).length;

// Indeks pemain hidup ke-`steps` setelah `from` menurut arah.
export function nextAlive(st, from, dir = st.direction, steps = 1) {
    const n = players().length; let i = from, left = steps, guard = 0;
    while (left > 0 && guard++ < n * (steps + 1)) { i = (i + dir + n) % n; if (!isOut(st, players()[i].uid)) left--; }
    return i;
}

// Siapa yang harus bertindak sekarang (korban Roulette memilih warna; selain itu pemain giliran).
export function actorUid(st) {
    if (st.pending && st.pending.kind === 'roulette') return st.pending.victim;
    return players()[st.turnIndex].uid;
}
export function isMyTurn() {
    if (!S.roomData || S.roomData.status !== 'playing') return false;
    const st = S.roomData.gameState;
    return !st.winner && actorUid(st) === S.currentUser.uid;
}
export const isMyAction = isMyTurn;

// ---------- kecocokan kartu ----------
const matches = (st, card) => card.c === 'Black' || card.c === st.currentColor || card.v === topCard(st).v;
export function isPlayableIn(st, uid, card) {
    if (st.forced && st.forced.uid === uid) return card.id === st.forced.id;
    if (st.pending) return st.pending.kind === 'draw' && isDrawCard(card) && drawValue(card) >= st.pending.top;
    return matches(st, card);
}
export const legalPlays = (st, uid) => st.hands[uid].map((c, i) => (isPlayableIn(st, uid, c) ? i : -1)).filter(i => i >= 0);
export const hasPlayable = (st, uid) => legalPlays(st, uid).length > 0;
export { needsColor, needsTarget };
export const isStackTurn = (st) => !!(st.pending && st.pending.kind === 'draw');

// ---------- UNO & tangkap ----------
export function normalizeUno(state, prevHands) {
    Object.keys(state.hands).forEach(u => {
        const n = state.hands[u].length;
        const before = prevHands && prevHands[u] ? prevHands[u].length : n;
        if (n > 2 || n > before) state.unoCalled[u] = false;
    });
    if (state.forgot) Object.keys(state.forgot).forEach(u => { if (!state.hands[u] || state.hands[u].length !== 1 || state.unoCalled[u]) delete state.forgot[u]; });
}
export const isCatchable = (state, uid) => !!(state.forgot && state.forgot[uid]) && !state.unoCalled[uid] && !!state.hands[uid] && state.hands[uid].length === 1 && !isOut(state, uid);
export function canCallUno(state) {
    const uid = S.currentUser.uid, hand = state.hands[uid] || [];
    if (state.unoCalled[uid] || isOut(state, uid)) return false;
    return hand.length === 1 || (hand.length === 2 && actorUid(state) === uid && hasPlayable(state, uid));
}
function refreshUno(state, uid) {                                  // setelah tangan berganti (tukar/oper/Discard All)
    state.unoCalled[uid] = false;
    if (state.hands[uid].length === 1 && !isOut(state, uid)) { (state.forgot = state.forgot || {})[uid] = true; state.logs.push(`<b>${nameOf(uid)}</b> sisa 1 kartu tapi belum bilang UNO!`); }
    else if (state.forgot) delete state.forgot[uid];
}

// ---------- ambil kartu & Mercy ----------
export function giveCards(state, uid, n, pen = false) {
    const got = drawFrom(state, n);
    state.hands[uid] = state.hands[uid].concat(got.cards);
    state.unoCalled[uid] = false;
    if (state.forgot) delete state.forgot[uid];
    if (got.cards.length) fx(state, { t: 'draw', uid, n: got.cards.length, cards: got.cards, pen });
    return got.cards.length;
}

// Singkirkan pemain bertangan >= 25. Bila tinggal 1 pemain hidup, dia menang. Memperbaiki giliran bila jatuh ke pemain tersingkir.
export function checkMercy(state) {
    const gone = [];
    alivePlayers(state).forEach(p => {
        if (state.hands[p.uid].length >= MERCY_LIMIT) {
            state.out[p.uid] = true; gone.push(p.uid);
            state.setAside = (state.setAside || []).concat(state.hands[p.uid]); state.hands[p.uid] = [];
            state.unoCalled[p.uid] = false; if (state.forgot) delete state.forgot[p.uid];
            state.logs.push(`<b>${nameOf(p.uid)}</b> memegang 25 kartu: TERSINGKIR (Mercy)!`);
            fx(state, { t: 'mercy', uid: p.uid });
        }
    });
    if (gone.length && !state.winner) {
        const alive = alivePlayers(state);
        if (alive.length === 1) { state.winner = alive[0].uid; state.winBy = 'mercy'; state.pending = null; state.forced = null; }
        else if (isOut(state, players()[state.turnIndex].uid)) state.turnIndex = nextAlive(state, state.turnIndex);
        if (state.pending && state.pending.kind === 'roulette' && isOut(state, state.pending.victim)) state.pending = null;
    }
    return gone;
}

export function penalize(state, uid, byUid) {
    fx(state, { t: 'catch', by: byUid, uid });
    giveCards(state, uid, 2);
    state.logs.push(`<b>${nameOf(byUid)}</b> menangkap <b>${nameOf(uid)}</b> yang lupa UNO! +2 kartu.`);
    checkMercy(state);
}

// Tidak punya kartu cocok: ambil satu per satu sampai dapat yang bisa dimainkan -> kartu itu WAJIB dimainkan (state.forced).
// Mengembalikan { drawn, found, eliminated }.
export function drawUntilPlayable(state, uid) {
    const pIdx = idxOf(uid), drawn = []; let found = null;
    for (;;) {
        const got = drawFrom(state, 1);
        if (!got.cards.length) break;
        const c = got.cards[0]; state.hands[uid].push(c); drawn.push(c);
        if (state.hands[uid].length >= MERCY_LIMIT) break;
        if (matches(state, c)) { found = c; break; }
    }
    if (drawn.length) fx(state, { t: 'draw', uid, n: drawn.length, cards: drawn });
    state.unoCalled[uid] = false; if (state.forgot) delete state.forgot[uid];
    state.logs.push(`<b>${nameOf(uid)}</b> mengambil ${drawn.length} kartu.`);
    const gone = checkMercy(state);
    const eliminated = gone.includes(uid);
    if (!state.winner && !eliminated) {
        if (found) state.forced = { uid, id: found.id };
        else { state.turnIndex = nextAlive(state, pIdx); state.turnNo = (state.turnNo || 0) + 1; }
    } else if (eliminated) state.turnNo = (state.turnNo || 0) + 1;
    return { drawn, found: eliminated ? null : found, eliminated };
}

// Korban hukuman Draw yang tidak menumpuk: ambil seluruh hukuman dan kehilangan giliran.
export function takePenalty(state, uid) {
    const p = state.pending, pIdx = idxOf(uid);
    const n = p ? p.n : 0;
    state.pending = null;
    state.logs.push(`<b>${nameOf(uid)}</b> mengambil ${n} kartu hukuman!`);
    giveCards(state, uid, n, true);
    state.turnIndex = nextAlive(state, pIdx); state.turnNo = (state.turnNo || 0) + 1;
    checkMercy(state);
    return n;
}

// Korban Wild Color Roulette memilih warna: buka kartu dari tumpukan sampai muncul warna itu (Wild tidak dihitung); semua masuk tangan; lewat giliran.
export function resolveRoulette(state, color) {
    const p = state.pending, uid = p.victim, pIdx = idxOf(uid), got = [];
    for (;;) {
        const r = drawFrom(state, 1);
        if (!r.cards.length) break;
        got.push(r.cards[0]);
        if (r.cards[0].c === color) break;
    }
    state.pending = null; state.currentColor = color;
    state.hands[uid] = state.hands[uid].concat(got); state.unoCalled[uid] = false; if (state.forgot) delete state.forgot[uid];
    state.logs.push(`<b>${nameOf(uid)}</b> memilih ${NAMES[color]} dan mengambil ${got.length} kartu!`);
    fx(state, { t: 'roulette', uid, color, cards: got });
    state.turnIndex = nextAlive(state, pIdx); state.turnNo = (state.turnNo || 0) + 1;
    checkMercy(state);
    return got.length;
}

const BANNER = { Skip: 'skip', Reverse: 'reverse', 'Draw Two': 'draw2', 'Draw Four': 'draw4', 'Discard All': 'discardall', 'Skip Everyone': 'skipall', 'Wild Reverse Draw Four': 'revdraw4', 'Wild Draw Six': 'draw6', 'Wild Draw Ten': 'draw10', 'Wild Color Roulette': 'roulette', 0: 'pass', 7: 'swap' };

// ---------- memainkan kartu ----------
// opts: { color (kartu hitam selain Roulette), target (uid, kartu 7), callUno }.  Return true jika ada pemenang.
export function playCardOn(state, uid, cardIdx, opts = {}) {
    const hand = state.hands[uid], card = hand[cardIdx], pIdx = idxOf(uid);
    hand.splice(cardIdx, 1);
    state.forced = null;
    state.discardPile.push(card);
    const color = card.c === 'Black' ? (opts.color || 'Red') : card.c;
    if (card.v !== 'Wild Color Roulette') state.currentColor = color;
    state.turnNo = (state.turnNo || 0) + 1;
    fx(state, { t: 'play', uid, card, color });
    state.logs.push(`<b>${nameOf(uid)}</b> mengeluarkan ${card.c === 'Black' ? '' : NAMES[card.c] + ' '}${card.v}${card.c === 'Black' && needsColor(card) ? ' (' + NAMES[color] + ')' : ''}`);

    if (hand.length === 0) {                                      // kartu terakhir: langsung menang, tanpa efek
        state.unoCalled[uid] = false; state.winner = uid; state.winBy = 'empty'; state.pending = null; return true;
    }
    const changed = applyEffect(state, card, pIdx, color, opts);
    // UNO untuk pemain yang main (kecuali tangannya berganti karena oper/tukar)
    if (!changed.includes(uid)) {
        const h = state.hands[uid];
        if (h.length === 0) { state.unoCalled[uid] = false; state.winner = uid; state.winBy = 'empty'; state.pending = null; return true; }   // Discard All menghabiskan tangan
        if (h.length === 1) {
            if (opts.callUno) { state.unoCalled[uid] = true; fx(state, { t: 'uno', uid }); state.logs.push(`<b>${nameOf(uid)}</b> berteriak UNO!`); }
            if (!state.unoCalled[uid]) { (state.forgot = state.forgot || {})[uid] = true; state.logs.push(`<b>${nameOf(uid)}</b> sisa 1 kartu tapi belum bilang UNO!`); }
        } else state.unoCalled[uid] = false;
    }
    changed.forEach(u => refreshUno(state, u));
    checkMercy(state);
    return !!state.winner;
}

function applyEffect(state, card, pIdx, color, opts) {
    const pl = players(), me = pl[pIdx].uid;
    const fxb = (extra) => fx(state, { t: 'banner', k: BANNER[card.v], c: color, ...(extra || {}) });
    const next = () => nextAlive(state, pIdx);
    const changed = [];
    state.turnIndex = next();                                     // bawaan: giliran ke pemain hidup berikut

    if (isDrawCard(card)) {                                       // +2/+4/+6/+10 (menumpuk bila sudah ada hukuman berjalan)
        const pend = (state.pending && state.pending.kind === 'draw') ? state.pending : { kind: 'draw', n: 0, top: 0, count: 0 };
        const val = drawValue(card);
        pend.n += val; pend.top = val; pend.count += 1;
        let victim;
        if (card.v === 'Wild Reverse Draw Four') {
            state.direction *= -1;
            victim = aliveCount(state) === 2 ? pIdx : nextAlive(state, pIdx);   // 2 pemain: pemain itu sendiri yang kena (boleh menumpuk balik)
        } else victim = nextAlive(state, pIdx);
        state.pending = pend; state.turnIndex = victim;
        state.logs.push(`Hukuman ${pend.n} kartu untuk <b>${nameOf(pl[victim].uid)}</b>${pend.count > 1 ? ' (ditumpuk!)' : ''}`);
        fxb({ n: pend.n, stack: pend.count > 1, target: pl[victim].uid });
        return changed;
    }
    switch (card.v) {
        case 'Skip': state.logs.push('Giliran dilewati!'); fxb(); state.turnIndex = nextAlive(state, pIdx, state.direction, 2); break;
        case 'Reverse':
            fxb();
            if (aliveCount(state) === 2) { state.logs.push('Putar balik -> lewati!'); state.turnIndex = pIdx; }
            else { state.direction *= -1; state.logs.push('Arah berbalik!'); state.turnIndex = nextAlive(state, pIdx); }
            break;
        case 'Skip Everyone': state.logs.push('Semua lawan dilewati!'); fxb(); state.turnIndex = pIdx; break;
        case 'Discard All': {
            const keep = [], drop = [];
            state.hands[me].forEach(c => (c.c === card.c ? drop : keep).push(c));
            state.hands[me] = keep;
            const top = state.discardPile.pop(); state.discardPile.push(...drop, top);   // kartu tambahan di BAWAH Discard All
            state.logs.push(`Membuang ${drop.length} kartu ${NAMES[card.c]} lainnya!`); fxb({ n: drop.length });
            break;
        }
        case 'Wild Color Roulette': {
            const victim = nextAlive(state, pIdx);
            state.pending = { kind: 'roulette', by: me, victim: pl[victim].uid }; state.turnIndex = victim;
            state.logs.push(`<b>${nameOf(pl[victim].uid)}</b> harus memilih warna (Color Roulette)!`); fxb({ target: pl[victim].uid });
            break;
        }
        case '0': {                                               // semua oper tangan ke pemain hidup berikut searah putaran
            const alive = alivePlayers(state), nh = {};
            alive.forEach(p => { nh[pl[nextAlive(state, idxOf(p.uid))].uid] = state.hands[p.uid]; });
            alive.forEach(p => { state.hands[p.uid] = nh[p.uid]; changed.push(p.uid); });
            state.logs.push('Semua pemain mengoper tangan!'); fx(state, { t: 'pass', dir: state.direction }); break;
        }
        case '7': {                                               // tukar tangan WAJIB dengan satu pemain hidup lain
            let t = opts.target;
            if (!t || t === me || idxOf(t) < 0 || isOut(state, t)) t = pl[next()].uid;
            const mine = state.hands[me]; state.hands[me] = state.hands[t]; state.hands[t] = mine; changed.push(me, t);
            state.logs.push(`<b>${nameOf(me)}</b> menukar tangan dengan <b>${nameOf(t)}</b>!`); fx(state, { t: 'swap', a: me, b: t, c: color }); break;
        }
        default: break;                                           // kartu angka biasa
    }
    return changed;
}

// Poin kemenangan: jumlah poin kartu sisa lawan yang masih hidup + 250 per pemain tersingkir.
export function tallyRound(state) {
    let pts = 0; const detail = []; let knocked = 0;
    players().forEach(p => {
        if (p.uid === state.winner) return;
        if (isOut(state, p.uid)) { knocked++; detail.push({ uid: p.uid, n: 0, pts: KNOCKOUT_BONUS, out: true }); return; }
        const cards = state.hands[p.uid] || [];
        const sc = cards.reduce((a, c) => a + pointOf(c), 0);
        pts += sc; detail.push({ uid: p.uid, n: cards.length, pts: sc });
    });
    pts += knocked * KNOCKOUT_BONUS;
    state.roundPts = pts; state.roundDetail = detail;
}
