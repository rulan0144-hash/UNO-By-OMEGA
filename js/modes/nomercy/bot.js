// Otak bot UNO Show 'Em No Mercy (murni, tanpa DOM, diuji di alat/sim_nomercy.mjs). Dipakai local.js (vs Komputer) dan timeoutTurn.
// decide(st, players, uid) -> SATU keputusan; penerap (UI/sim) menjalankannya lewat rules.js:
//   { type:'roulette', color }  -> resolveRoulette(st, color)
//   { type:'penalty' }          -> takePenalty(st, uid)            (tidak menumpuk Draw)
//   { type:'draw' }             -> drawUntilPlayable(st, uid), lalu decide() lagi (kartu hasil ambil wajib dimainkan)
//   { type:'play', idx, color, target } -> playCardOn(st, uid, idx, { color, target, callUno })
import { COLORS, MERCY_LIMIT, isDrawCard, drawValue, isNumber, needsColor, needsTarget, pointOf } from './deck.js';
import { legalPlays, nextAlive, alivePlayers } from './rules.js';

export const UNO_CALL_CHANCE = 0.9;                                   // peluang bot ingat berteriak UNO
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const idxOf = (players, uid) => players.findIndex(p => p.uid === uid);
const opponents = (st, uid) => alivePlayers(st).filter(p => p.uid !== uid);

// Warna terbanyak di tangan (tidak menghitung kartu yang baru dimainkan); seri -> acak.
export function chooseColor(st, uid, exceptIdx) {
    const cnt = {}; COLORS.forEach(c => { cnt[c] = 0; });
    st.hands[uid].forEach((c, i) => { if (i !== exceptIdx && c.c !== 'Black') cnt[c.c]++; });
    const max = Math.max(...COLORS.map(c => cnt[c]));
    return rnd(COLORS.filter(c => cnt[c] === max));
}

// Korban Roulette memilih warna yang PALING BANYAK tersisa tak terlihat (di buangan atau tangan sendiri) -> paling sedikit kartu terambil.
export function chooseRouletteColor(st, uid) {
    const seen = {}; COLORS.forEach(c => { seen[c] = 0; });
    [...st.discardPile, ...st.hands[uid]].forEach(c => { if (c.c !== 'Black') seen[c.c]++; });
    const best = Math.max(...COLORS.map(c => 36 - seen[c]));
    return rnd(COLORS.filter(c => 36 - seen[c] === best));
}

// Lawan yang paling baik ditukar (7): kartu paling sedikit; seri -> acak.
export function chooseTarget(st, players, uid) {
    const opp = opponents(st, uid);
    const min = Math.min(...opp.map(p => st.hands[p.uid].length));
    return rnd(opp.filter(p => st.hands[p.uid].length === min)).uid;
}

const victimOf = (st, players, uid, card) => {                          // siapa yang kena bila kartu Draw ini dimainkan sekarang
    const i = idxOf(players, uid);
    if (card.v === 'Wild Reverse Draw Four') {
        if (alivePlayers(st).length === 2) return uid;
        return players[nextAlive(st, i, -st.direction)].uid;
    }
    return players[nextAlive(st, i)].uid;
};

function buildPlay(st, players, uid, idx) {
    const card = st.hands[uid][idx];
    const out = { type: 'play', idx };
    if (needsColor(card)) out.color = chooseColor(st, uid, idx);
    if (needsTarget(card)) out.target = chooseTarget(st, players, uid);
    return out;
}

// Ada hukuman Draw berjalan: menumpuk atau mengambil.
function decideStack(st, players, uid) {
    const hand = st.hands[uid], pend = st.pending, legal = legalPlays(st, uid);
    if (!legal.length) return { type: 'penalty' };
    const mustSave = hand.length + pend.n >= MERCY_LIMIT - 4;          // mengambil hukuman nyaris/sudah membuat kita tersingkir
    let best = null, bs = -Infinity;
    legal.forEach(i => {
        const c = hand[i], v = drawValue(c), total = pend.n + v;
        const vic = victimOf(st, players, uid, c);
        const vh = vic === uid ? hand.length - 1 : st.hands[vic].length;
        let s = 50 - v * 2;                                              // hemat kartu besar bila ada pilihan
        if (vic !== uid && vh + total >= MERCY_LIMIT) s += 200;          // menyingkirkan lawan
        else if (vic !== uid) s += Math.min(40, Math.max(0, vh + total - 10) * 3);
        if (vic === uid) s -= 120;                                       // 2 pemain: Wild Reverse menimpa diri sendiri
        if (hand.length === 1) s += 500;                                 // kartu terakhir = menang
        if (s > bs) { bs = s; best = i; }
    });
    const wantStack = mustSave || bs >= 90 || hand.length <= 3 || Math.random() < 0.65;
    if (best !== null && bs > -50 && wantStack) return buildPlay(st, players, uid, best);
    return { type: 'penalty' };
}

// Nilai tiap kartu pada giliran biasa.
function scorePlay(st, players, uid, i) {
    const hand = st.hands[uid], c = hand[i], me = idxOf(players, uid);
    const after = hand.length - 1;
    if (after === 0) return 1000;                                        // kartu terakhir
    const opp = opponents(st, uid), minOpp = Math.min(...opp.map(p => st.hands[p.uid].length));
    const nxt = players[nextAlive(st, me)].uid, nxtH = st.hands[nxt].length;
    const danger = minOpp <= 2, big = hand.length >= 15;
    let s;
    if (isNumber(c) && c.v !== '0' && c.v !== '7') s = 30 + Number(c.v) / 3;
    else switch (c.v) {
        case '0': { const prev = players[nextAlive(st, me, -st.direction)].uid; s = 30 + Math.max(-30, Math.min(40, (after - st.hands[prev].length) * 6)); break; }
        case '7': { const gain = after - minOpp; s = gain > 0 ? 34 + Math.min(40, gain * 7) : -40; break; }
        case 'Skip': case 'Reverse': s = 44 + (nxtH <= 2 ? 24 : 0); break;
        case 'Skip Everyone': s = 52 + (after <= 3 ? 14 : 0); break;
        case 'Discard All': { const drop = hand.filter((x, k) => k !== i && x.c === c.c).length; s = after - drop === 0 ? 900 : 38 + drop * 9 + (big ? 20 : 0); break; }
        case 'Wild Color Roulette': { const v = players[nextAlive(st, me)].uid; s = 38 + (st.hands[v].length + 6 >= MERCY_LIMIT ? 40 : 0) + (danger ? 8 : 0); break; }
        default:
            if (isDrawCard(c)) {
                const vic = victimOf(st, players, uid, c), v = drawValue(c);
                if (vic === uid) { s = -80; break; }
                const vh = st.hands[vic].length;
                s = 40 + v * 1.5 + (vh + v >= MERCY_LIMIT ? 200 : Math.max(0, vh - 10) * 3) + (danger ? 12 : 0);
                if (c.c === 'Black') s -= 6;                              // simpan kartu hitam yang fleksibel
            } else s = 20;
    }
    s += (c.c === 'Black' ? -4 : 0) + pointOf(c) / 25 + Math.random() * 5;
    if (c.c !== 'Black') { const same = hand.filter(x => x.c === c.c).length; s += same * 0.5; }
    return s;
}

export function decide(st, players, uid) {
    const hand = st.hands[uid];
    if (st.pending && st.pending.kind === 'roulette') return { type: 'roulette', color: chooseRouletteColor(st, uid) };
    if (st.forced && st.forced.uid === uid) return buildPlay(st, players, uid, hand.findIndex(c => c.id === st.forced.id));
    if (st.pending && st.pending.kind === 'draw') return decideStack(st, players, uid);
    const legal = legalPlays(st, uid);
    if (!legal.length) return { type: 'draw' };
    let best = legal[0], bs = -Infinity;
    legal.forEach(i => { const s = scorePlay(st, players, uid, i); if (s > bs) { bs = s; best = i; } });
    return buildPlay(st, players, uid, best);
}

// Waktu habis (pemain manusia): main kartu legal bernilai terkecil; hukuman Draw -> ambil; tak ada kartu -> ambil.
export function chooseTimeoutPlay(st, players, uid) {
    const hand = st.hands[uid];
    if (st.pending && st.pending.kind === 'roulette') return { type: 'roulette', color: chooseRouletteColor(st, uid) };
    if (st.forced && st.forced.uid === uid) return buildPlay(st, players, uid, hand.findIndex(c => c.id === st.forced.id));
    if (st.pending && st.pending.kind === 'draw') return { type: 'penalty' };
    const legal = legalPlays(st, uid);
    if (!legal.length) return { type: 'draw' };
    let best = legal[0];
    legal.forEach(i => { if (pointOf(hand[i]) < pointOf(hand[best])) best = i; });
    return buildPlay(st, players, uid, best);
}
