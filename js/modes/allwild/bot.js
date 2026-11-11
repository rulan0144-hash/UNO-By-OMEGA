// Otak bot UNO All Wild (murni, tanpa DOM, diuji di alat/sim_allwild.mjs). Dipakai local.js (vs Komputer) dan timeoutTurn.
import { COLORS, pointOf, needsTarget } from './deck.js';

// Warna hanya hiasan: pilih warna terbanyak di antara pilihan acak
export const chooseColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

const others = (st, players, uid) => players.filter(p => p.uid !== uid);
const nextOf = (st, players, uid) => { const i = players.findIndex(p => p.uid === uid); return players[(i + st.direction + players.length * 2) % players.length]; };

// Target: lawan dengan kartu paling sedikit (paling dekat menang); seri -> acak
export function chooseTarget(st, players, uid) {
    const opp = others(st, players, uid);
    const min = Math.min(...opp.map(p => st.hands[p.uid].length));
    const pool = opp.filter(p => st.hands[p.uid].length === min);
    return pool[Math.floor(Math.random() * pool.length)].uid;
}

// Kartu yang bisa menghentikan pemain berikut yang hampir menang
const isStopper = (c, n) => c.v === 'Skip' || c.v === 'Skip Two' || c.v === 'Draw Two' || c.v === 'Draw Four' || (c.v === 'Reverse' && n > 2);

// Ambil kartu alih-alih main: bila pemain berikut sisa 1 kartu dan tidak ada kartu penghenti di tangan (aturan "ONE MORE THING").
export function shouldDraw(st, players, uid) {
    const hand = st.hands[uid];
    if (hand.length === 1) return hand[0].v === 'Forced Swap';      // Forced Swap terakhir = lawan pilihan yang menang -> ambil kartu dulu
    if (hand.length === 0) return false;
    const nx = nextOf(st, players, uid);
    if (st.hands[nx.uid].length !== 1) return false;
    return !hand.some(c => isStopper(c, players.length));
}

// Pilih kartu yang dimainkan. Mengembalikan { idx, color, target } (selalu ada: semua kartu boleh dimainkan).
export function choosePlay(st, players, uid) {
    const hand = st.hands[uid];
    const opp = others(st, players, uid);
    const minOpp = Math.min(...opp.map(p => st.hands[p.uid].length));
    const danger = minOpp <= 2;
    const nextHand = st.hands[nextOf(st, players, uid).uid].length;
    const score = (c, i) => {
        if (hand.length === 1) return c.v === 'Forced Swap' ? -50 : 1000;   // kartu terakhir: menang (kecuali Forced Swap: lawan yang menang)
        let sc;
        switch (c.v) {
            case 'Wild': sc = 30; break;
            case 'Skip': case 'Reverse': sc = 44 + (nextHand <= 2 ? 22 : 0); break;
            case 'Skip Two': sc = 46 + (nextHand <= 2 ? 22 : 0); break;
            case 'Draw Two': sc = 46 + (danger ? 14 : 0); break;
            case 'Draw Four': sc = 50 + (danger ? 14 : 0); break;
            case 'Target Draw Two': sc = 42 + (danger ? 16 : 0); break;
            case 'Forced Swap': sc = hand.length >= minOpp + 3 ? 60 : -30; break;   // tukar hanya bila tangan sendiri jauh lebih banyak
        }
        return sc + pointOf(c) / 20 + Math.random() * 6;
    };
    let best = 0, bs = -Infinity;
    hand.forEach((c, i) => { const s = score(c, i); if (s > bs) { bs = s; best = i; } });
    const card = hand[best];
    let target;
    if (needsTarget(card)) {
        if (card.v === 'Forced Swap') {                                       // tukar dengan lawan berkartu paling sedikit
            target = chooseTarget(st, players, uid);
        } else target = chooseTarget(st, players, uid);
    }
    return { idx: best, color: chooseColor(), target };
}

// Kartu terkecil untuk main otomatis saat waktu habis. onlyIdx = hanya kartu itu (kartu yang baru diambil).
export function chooseTimeoutPlay(st, players, uid, onlyIdx) {
    const hand = st.hands[uid]; let best = null;
    hand.forEach((c, i) => {
        if (onlyIdx != null && i !== onlyIdx) return;
        const key = pointOf(c) + (c.v === 'Forced Swap' ? 100 : 0);
        if (!best || key < best.key) best = { key, idx: i };
    });
    if (!best) return null;
    const card = hand[best.idx];
    return { idx: best.idx, color: chooseColor(), target: needsTarget(card) ? chooseTarget(st, players, uid) : undefined };
}
