// Mesin aturan UNO Flex (murni, tanpa DOM). Aturan: lihat MEMORI-UNO-BY-OMEGA.md bagian 6n.
import { S, fx, nameOf } from '../../core/state.js';
import { drawFrom, isWild, isNum, hasFlex, pointOf, NAMES } from './deck.js';

export const topCard = (st) => st.discardPile[st.discardPile.length - 1];
const players = () => S.roomData.players;

// Siapa yang harus bertindak sekarang: jika ada Wild Draw 4 menunggu = pemain yang menjawab (bisa BUKAN pemegang giliran, pada sisi flex target), kalau tidak = pemegang giliran.
export const actorUid = (st) => st.pending ? st.pending.answerer : players()[st.turnIndex].uid;
export function isMyTurn() {
    if (!S.roomData || S.roomData.status !== 'playing') return false;
    return players()[S.roomData.gameState.turnIndex].uid === S.currentUser.uid;
}
export function isMyAction() {
    if (!S.roomData || S.roomData.status !== 'playing') return false;
    return actorUid(S.roomData.gameState) === S.currentUser.uid;
}
const idxOf = (uid) => players().findIndex(p => p.uid === uid);

// ---------- kecocokan & pilihan main ----------
// Kartu cocok pada sisi biasa: warna oval = warna berlaku, atau nilai/simbol sama; kartu hitam selalu boleh.
export function matchesRegular(st, card) {
    return isWild(card) || card.c === st.currentColor || card.v === topCard(st).v;
}
// Sisi flex (hanya jika Power hijau): kartu angka dimainkan sebagai warna flex-nya; kartu aksi tetap berwarna sama; Wild flex selalu boleh.
export function matchesFlex(st, card) {
    if (!hasFlex(card)) return false;
    if (isWild(card)) return true;
    return card.fc === st.currentColor || card.v === topCard(st).v;
}
export const powerGreen = (st, uid) => !!(st.power && st.power[uid]);
// Daftar cara memainkan kartu ini: [{flex:false},{flex:true}] (kosong = tidak bisa dimainkan)
export function playOptions(st, uid, card) {
    if (st.pending) return [];
    const out = [];
    if (matchesRegular(st, card)) out.push({ flex: false });
    if (powerGreen(st, uid) && matchesFlex(st, card)) out.push({ flex: true });
    return out;
}
export const isPlayableIn = (st, uid, card) => playOptions(st, uid, card).length > 0;

export function advance(state) {
    const n = players().length;
    state.turnIndex = (state.turnIndex + state.direction + n) % n;
    state.turnNo = (state.turnNo || 0) + 1;
}

// ---------- UNO & tangkap (sama seperti klasik/Flip) ----------
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

// ---------- Power Card ----------
// cause: 'flex' (dipakai), 'flip' (ikon Flip), 'allflip' (Wild All Flip). Setelah berubah: jika SEMUA merah -> semua kembali hijau.
function setPower(state, changes, cause) {
    Object.keys(changes).forEach(u => { state.power[u] = changes[u]; });
    fx(state, { t: 'power', cause, changes: { ...changes } });
    const all = players().map(p => p.uid);
    if (all.every(u => !state.power[u])) {
        const reset = {};
        all.forEach(u => { state.power[u] = true; reset[u] = true; });
        fx(state, { t: 'power', cause: 'reset', changes: reset });
        state.logs.push('Semua Power Card merah: semuanya kembali hijau!');
    }
}

// ---------- memainkan kartu ----------
// opts: { flex, color (untuk kartu hitam), target (uid, untuk Wild target), callUno }.  Return true jika ada pemenang.
export function playCardOn(state, uid, cardIdx, opts = {}) {
    const pl = players(), pCount = pl.length;
    const hand = state.hands[uid];
    const card = hand[cardIdx];
    const flex = !!opts.flex && hasFlex(card);
    hand.splice(cardIdx, 1);
    const prevColor = state.currentColor;
    const pIdx = idxOf(uid);
    const color = isWild(card) ? (opts.color || 'Red') : card.c;       // warna yang diteruskan = warna sisi biasa
    state.discardPile.push(card);
    state.topFlex = flex;
    fx(state, { t: 'play', uid, card, flex, color: isWild(card) ? color : undefined });
    if (isWild(card)) fx(state, { t: 'picker', color });
    state.currentColor = color;
    state.turnNo = (state.turnNo || 0) + 1;
    state.logs.push(`<b>${nameOf(uid)}</b> mengeluarkan ${isWild(card) ? 'Wild' : NAMES[card.c] + ' ' + card.v}${flex ? ' (sisi flex)' : ''}`);

    // Power: sisi flex dipakai -> merah; ikon Flip -> membalik
    if (flex) setPower(state, { [uid]: false }, 'flex');
    if (card.fl) { const to = !state.power[uid]; setPower(state, { [uid]: to }, 'flip'); }

    // UNO / kartu terakhir (efek tetap berjalan dulu)
    const emptied = hand.length === 0;
    if (emptied) state.unoCalled[uid] = false;
    else if (hand.length === 1) {
        if (opts.callUno) { state.unoCalled[uid] = true; fx(state, { t: 'uno', uid }); state.logs.push(`<b>${nameOf(uid)}</b> berteriak UNO!`); }
        if (!state.unoCalled[uid]) { (state.forgot = state.forgot || {})[uid] = true; state.logs.push(`<b>${nameOf(uid)}</b> sisa 1 kartu tapi belum bilang UNO!`); }
    } else state.unoCalled[uid] = false;

    applyEffect(state, card, flex, pIdx, prevColor, opts.target);

    if (emptied) {
        if (state.pending) { state.pendingWinner = uid; return false; }
        if (state.hands[uid].length === 0) { state.winner = uid; return true; }
        state.logs.push(`Kartu <b>${nameOf(uid)}</b> bertambah lagi karena efek kartu terakhir, permainan lanjut!`);
    }
    return false;
}

const orderFrom = (pIdx, dir, n) => Array.from({ length: n - 1 }, (_, i) => (pIdx + dir * (i + 1) + n * 2) % n);   // semua lawan, mulai dari pemain berikut

function pickTarget(state, pIdx, target) {
    const n = players().length;
    const ok = target && target !== players()[pIdx].uid && idxOf(target) >= 0;
    return ok ? target : players()[(pIdx + state.direction + n) % n].uid;
}

function applyEffect(state, card, flex, pIdx, prevColor, target) {
    const n = players().length, dir = state.direction;
    const nextIdx = (pIdx + dir + n) % n, nextNextIdx = (nextIdx + dir + n) % n;
    const me = players()[pIdx].uid, nextUid = players()[nextIdx].uid;
    const c = state.currentColor;
    state.turnIndex = nextIdx;                                       // bawaan: giliran ke pemain berikut
    const fxb = (k) => fx(state, { t: 'banner', k, c, flex });

    if (isNum(card)) return;
    switch (card.v) {
        case 'Skip':
            if (!flex) { state.logs.push('Giliran dilewati!'); fxb('skip'); state.turnIndex = nextNextIdx; }
            else { state.logs.push('Semua pemain dilewati! Giliran kembali ke pemain yang sama.'); fxb('skipall'); state.turnIndex = pIdx; }
            break;
        case 'Reverse':
            if (!flex) {
                fxb('reverse');
                if (n === 2) { state.logs.push('Putar balik -> lewati!'); state.turnIndex = nextNextIdx; }
                else { state.direction *= -1; state.logs.push('Arah berbalik!'); state.turnIndex = (pIdx + state.direction + n) % n; }
            } else {
                fxb('revskip');                                         // balik arah lalu lewati pemain pertama di arah baru
                state.direction *= -1;
                state.turnIndex = (pIdx + 2 * state.direction + n * 2) % n;
                state.logs.push('Arah berbalik dan pemain pertama dilewati!');
            }
            break;
        case 'Draw Two':
            if (!flex) { state.logs.push('+2 kartu dan dilewati!'); fxb('draw2'); giveCards(state, nextUid, 2); state.turnIndex = nextNextIdx; }
            else {
                state.logs.push('Semua lawan ambil 1 kartu!'); fxb('draw1all');
                orderFrom(pIdx, dir, n).forEach(i => giveCards(state, players()[i].uid, 1));   // pemain berikut TIDAK dilewati
            }
            break;
        case 'Wild All Flip': {
            fxb('allflip');
            state.logs.push('Semua pemain membalik Power Card!');
            const ch = {}; players().forEach(p => { ch[p.uid] = !state.power[p.uid]; });
            setPower(state, ch, 'allflip');
            break;
        }
        case 'Wild':
            if (!flex) break;                                           // Wild biasa: hanya pilih warna
            if (card.fv === 'All Draw Two') {
                state.logs.push('Semua lawan ambil 2 kartu!'); fxb('alldraw2');
                orderFrom(pIdx, dir, n).forEach(i => giveCards(state, players()[i].uid, 2));
            } else {                                                    // Target Draw Two
                const t = pickTarget(state, pIdx, target);
                state.logs.push(`<b>${nameOf(t)}</b> ditunjuk ambil 2 kartu!`); fx(state, { t: 'banner', k: 'target2', c, flex, target: t });
                giveCards(state, t, 2);                                 // tidak ada yang dilewati
            }
            break;
        case 'Wild Draw Four': {
            const t = flex ? pickTarget(state, pIdx, target) : nextUid;
            state.pending = { type: 'wd4', total: 4, by: me, prevColor, color: c, flex, answerer: t };
            state.logs.push(flex
                ? `<b>${nameOf(t)}</b> ditunjuk ambil 4 kartu! Boleh menantang atau ambil kartu.`
                : `+4 dimainkan! ${nameOf(t)} boleh menantang atau ambil kartu.`);
            fx(state, { t: 'banner', k: flex ? 'target4' : 'draw4', c, flex, target: t });
            break;                                                      // giliran tetap ke pemain berikut; menunggu jawaban
        }
    }
}

export function canCallUno(state) {
    const uid = S.currentUser.uid;
    const hand = state.hands[uid] || [];
    if (state.unoCalled[uid]) return false;
    return hand.length === 1 || (hand.length === 2 && hand.some(c => isPlayableIn(state, uid, c)));
}

// ---------- ambil kartu saat giliran ----------
// Ambil 1 kartu (boleh meski punya kartu cocok). Mengembalikan kartu yang diambil (atau null jika dek habis total).
export function drawOneTurn(state, uid, side) {
    const got = drawFrom(state, 1, side);
    if (!got.cards.length) return null;
    state.hands[uid].push(got.cards[0]);
    fx(state, { t: 'draw', uid, n: 1, sides: got.sides, cards: got.cards });
    state.unoCalled[uid] = false;
    return got.cards[0];
}

// ---------- tantangan Wild Draw Four (sisi biasa DAN sisi flex) ----------
// Benar (bersalah) jika pemain Wild masih punya kartu yang cocok dengan warna SEBELUM Wild: warna sisi biasa (oval tengah) atau kartu hitam. Sisi flex tidak dihitung.
export function holdsMatching(state, uid, color) {
    return state.hands[uid].some(c => isWild(c) || c.c === color);
}
// uid HARUS pending.answerer. choice: 'draw' | 'challenge'. Return true jika permainan selesai (pemenang ditetapkan).
export function resolvePending(state, uid, choice) {
    const p = state.pending;
    if (!p) return false;
    state.pending = null;
    const n = players().length;
    const pIdx = idxOf(p.by);
    const after = () => {                                               // sesudah jawaban: sisi biasa -> penjawab dilewati; sisi flex -> lanjut ke pemain berikut
        if (!p.flex) advance(state);
        else state.turnIndex = (pIdx + state.direction + n) % n;
    };
    if (choice === 'challenge') {
        const guilty = holdsMatching(state, p.by, p.prevColor);
        fx(state, { t: 'challenge', by: uid, target: p.by, ok: guilty, color: p.prevColor });
        if (guilty) {
            state.logs.push(`<b>${nameOf(uid)}</b> menantang <b>${nameOf(p.by)}</b> (warna sebelumnya: ${NAMES[p.prevColor] || p.prevColor}): BENAR! ${nameOf(p.by)} ambil 4 kartu.`);
            giveCards(state, p.by, 4);
            if (!p.flex) state.turnNo = (state.turnNo || 0) + 1;       // penantang main seperti biasa
            else state.turnIndex = (pIdx + state.direction + n) % n;
        } else {
            state.logs.push(`<b>${nameOf(uid)}</b> menantang <b>${nameOf(p.by)}</b> (warna sebelumnya: ${NAMES[p.prevColor] || p.prevColor}): SALAH! ${nameOf(uid)} ambil 4 + 2 kartu.`);
            giveCards(state, uid, 4); giveCards(state, uid, 2, true);
            after();
        }
    } else {
        state.logs.push(`<b>${nameOf(uid)}</b> mengambil 4 kartu.`);
        giveCards(state, uid, 4);
        after();
    }
    const w = state.pendingWinner; state.pendingWinner = null;
    if (w && state.hands[w] && state.hands[w].length === 0) { state.winner = w; return true; }
    return false;
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
