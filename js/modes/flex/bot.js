// Otak bot UNO Flex (murni, tanpa DOM, diuji di alat/sim_flex.mjs). Dipakai local.js (vs Komputer) dan timeoutTurn.
import { COLORS, isWild, isNum, pointOf } from './deck.js';
import { playOptions, holdsMatching } from './rules.js';

// Warna terbanyak di tangan (kartu berwarna lain), untuk kartu Wild
export function chooseColor(hand, skipIdx) {
    const cnt = {};
    hand.forEach((c, i) => { if (i !== skipIdx && c.c !== 'Black') cnt[c.c] = (cnt[c.c] || 0) + 1; });
    return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || COLORS[Math.floor(Math.random() * COLORS.length)];
}
// Target kartu "target": lawan dengan kartu paling sedikit (paling dekat menang)
export function chooseTarget(st, players, uid) {
    const opp = players.filter(p => p.uid !== uid);
    const min = Math.min(...opp.map(p => st.hands[p.uid].length));
    const pool = opp.filter(p => st.hands[p.uid].length === min);
    return pool[Math.floor(Math.random() * pool.length)].uid;
}
// Jawaban atas Wild Draw 4: tantang sekitar 22%
export const answerPending = () => (Math.random() < 0.22 ? 'challenge' : 'draw');

// Pilih kartu & sisi yang dimainkan. Mengembalikan { idx, flex, color, target } atau null bila tidak ada yang bisa dimainkan.
// Prioritas: kartu berwarna sisi biasa; sisi flex dipakai untuk EFEK (aksi/Wild flex) atau saat tidak ada pilihan lain; Wild disimpan.
export function choosePlay(st, players, uid) {
    const hand = st.hands[uid];
    const moves = [];
    hand.forEach((c, i) => playOptions(st, uid, c).forEach(o => moves.push({ idx: i, flex: o.flex, card: c })));
    if (!moves.length) return null;
    const minOpp = Math.min(...players.filter(p => p.uid !== uid).map(p => st.hands[p.uid].length));
    const danger = minOpp <= 2;                       // ada lawan hampir menang: serang
    const myGreen = !!st.power[uid];
    const hasRegular = (idx) => moves.some(m => m.idx === idx && !m.flex);
    const score = (m) => {
        const c = m.card; let sc = 0;
        if (isWild(c)) {
            sc = 10;
            if (m.flex) sc = danger ? 48 : 22;
            else if (c.v === 'Wild All Flip') sc = myGreen ? 8 : 30;           // butuh membalik Power sendiri jadi hijau
            else if (c.v === 'Wild Draw Four') sc = holdsMatching(st, uid, st.currentColor) && hand.some((x, i) => i !== m.idx && x.c === st.currentColor) ? -40 : 14;   // jangan menggertak kalau ketahuan
        } else if (m.flex) {
            if (isNum(c)) sc = hasRegular(m.idx) ? -100 : 38;                   // flex angka hanya bila tak ada cara lain (ganti warna)
            else sc = danger ? 56 : 28;                                          // efek aksi flex
        } else {
            sc = isNum(c) ? 44 : 50;
            if (danger && !isNum(c)) sc += 8;
            if (c.fl) sc += myGreen ? -10 : 15;                                  // ikon Flip: membalik Power
        }
        sc += pointOf(c) / 20 + Math.random() * 6;                              // buang kartu berpoin besar lebih dulu
        return sc;
    };
    let best = moves[0], bs = -Infinity;
    moves.forEach(m => { const s = score(m); if (s > bs) { bs = s; best = m; } });
    const card = best.card;
    return {
        idx: best.idx, flex: best.flex,
        color: isWild(card) ? chooseColor(hand, best.idx) : card.c,
        target: best.flex && /^Target/.test(card.fv || '') ? chooseTarget(st, players, uid) : undefined
    };
}

// Kartu terkecil untuk main otomatis saat waktu habis (sisi biasa lebih dulu). onlyIdx = hanya kartu itu (kartu yang baru diambil).
export function chooseTimeoutPlay(st, players, uid, onlyIdx) {
    const hand = st.hands[uid]; let best = null;
    hand.forEach((c, i) => {
        if (onlyIdx != null && i !== onlyIdx) return;
        const o = playOptions(st, uid, c);
        if (!o.length) return;
        const flex = o[0].flex;                                  // o[0] = sisi biasa bila ada
        const key = pointOf(c) + (flex ? 100 : 0);
        if (!best || key < best.key) best = { key, idx: i, flex };
    });
    if (!best) return null;
    const card = hand[best.idx];
    return {
        idx: best.idx, flex: best.flex, color: isWild(card) ? chooseColor(hand, best.idx) : card.c,
        target: best.flex && /^Target/.test(card.fv || '') ? chooseTarget(st, players, uid) : undefined
    };
}
