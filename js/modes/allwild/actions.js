import { isBusy } from './animations.js';
import { S, cloneState, fx, nameOf } from '../../core/state.js';
import { drawFrom, needsTarget } from './deck.js';
import { advance, canCallUno, isMyTurn, actorUid, normalizeUno, isCatchable, penalize, playCardOn, tallyRound } from './rules.js';
import { chooseTimeoutPlay } from './bot.js';
import { askColor, askTarget, closeAsks, handleGameOver, renderGame } from './ui.js';
import { scheduleBot } from './local.js';
import { sfx } from '../../core/sound.js';
import { roomDoc, updateDoc } from '../../core/firebase.js';

// Semua perubahan state lewat sini. Offline: langsung ke S.roomData. Online: ditulis ke Firestore, semua pemain (termasuk kita) menerimanya lewat onSnapshot.
export async function updateRemoteState(newState, extra = {}) {
    if (!S.currentRoomCode) return;
    if (newState.logs.length > 30) newState.logs = newState.logs.slice(-30);
    normalizeUno(newState, S.roomData && S.roomData.gameState && S.roomData.gameState.hands);
    if (extra.status === 'finished') tallyRound(newState);
    if (!S.localMode) {
        await updateDoc(roomDoc(S.currentRoomCode), { gameState: JSON.parse(JSON.stringify(newState)), ...extra });   // JSON: buang field undefined (Firestore menolaknya)
        return;
    }
    S.roomData = { ...S.roomData, ...extra, gameState: newState };
    renderGame();
    if (S.roomData.status === 'finished') handleGameOver(); else scheduleBot();
}

// --- AKSI PEMAIN ---
// Mengetuk kartu (kedua kali) = memainkan. Semua kartu hitam: SELALU pilih warna; kartu target/tukar: pilih pemain.
let busyAsk = false;
window.awPlay = async (idx) => {
    if (busyAsk) return;
    if (isBusy()) return showToast("Tunggu animasi selesai...");
    const st0 = S.roomData && S.roomData.gameState;
    if (!isMyTurn()) return showToast("Bukan giliranmu!");
    const me = S.currentUser.uid;
    const myHand = st0.hands[me];
    const card = myHand[idx];
    if (S.hasDrawnThisTurn && idx !== myHand.length - 1) return showToast("Hanya bisa memainkan kartu baru!");
    // posisi kartu di tangan untuk animasi terbang ke tumpukan
    S.pendingFrom = (() => { const el = document.getElementById('w-hand').children[idx]; if (!el) return null; const r = el.getBoundingClientRect(); const w = el.offsetWidth, h = el.offsetHeight; return { left: r.left + r.width / 2 - w / 2, top: r.top + r.height / 2 - h / 2, width: w, height: h }; })();
    busyAsk = true;
    try {
        let target;
        if (needsTarget(card)) { target = await askTarget(st0, card); if (!target) return; }
        const color = await askColor(st0); if (!color) return;
        await processPlayCard(idx, { color, target });
    } finally { busyAsk = false; }
};

export async function processPlayCard(idx, opts) {
    const s = cloneState();
    // callUno=false: pemain harus menekan tombol UNO sendiri (boleh sebelum/sesudah main)
    const won = playCardOn(s, S.currentUser.uid, idx, { ...opts, callUno: false });
    S.hasDrawnThisTurn = false;
    await updateRemoteState(s, won ? { status: 'finished' } : {});
}

// side: 'L' = deck kiri, 'R' = deck kanan (pemain bebas memilih). Ambil kartu boleh kapan saja saat giliran ("One more thing").
window.awDraw = (side) => {
    if (isBusy()) return showToast("Tunggu animasi selesai...");
    if (!isMyTurn() || S.hasDrawnThisTurn) return;
    const s = cloneState();
    const me = S.currentUser.uid;
    const got = drawFrom(s, 1, side);
    const drawn = got.cards[0];
    if (!drawn) { advance(s); s.logs.push(`<b>${nameOf(me)}</b> tidak bisa mengambil kartu.`); updateRemoteState(s); return; }
    s.hands[me].push(drawn);
    fx(s, { t: 'draw', uid: me, n: 1, sides: got.sides, cards: got.cards });
    s.logs.push(`<b>${nameOf(me)}</b> mengambil kartu.`);
    S.hasDrawnThisTurn = true;                                  // semua kartu boleh dimainkan: main kartu baru atau Lewati
    showToast("Mainkan kartu baru, atau tekan Lewati.");
    updateRemoteState(s);
};

window.awPass = () => {
    if (isBusy()) return showToast("Tunggu animasi selesai...");
    if (!isMyTurn() || !S.hasDrawnThisTurn) return;
    const s = cloneState();
    s.logs.push(`<b>${nameOf(S.currentUser.uid)}</b> melewati giliran.`);
    advance(s);
    S.hasDrawnThisTurn = false;
    updateRemoteState(s);
};

window.awUno = () => {
    if (!S.roomData || S.roomData.status !== 'playing') return;
    const s = cloneState();
    const me = S.currentUser.uid;
    if (s.unoCalled[me]) return showToast("Kamu sudah aman");
    if (!canCallUno(s)) return showToast("Belum saatnya bilang UNO!");
    s.unoCalled[me] = true;
    fx(s, { t: 'uno', uid: me });
    if (s.forgot) delete s.forgot[me];
    s.logs.push(`<b>${nameOf(me)}</b> berteriak UNO!`);
    updateRemoteState(s);
    showToast("Kamu berteriak UNO!");
};

// Ketuk profil lawan yang bertanda palu -> langsung tertangkap
window.awCatch = (uid) => {
    const s = cloneState();
    if (!isCatchable(s, uid)) return showToast("Tidak bisa ditangkap (sudah bilang UNO atau kartunya bukan 1 lagi).");
    penalize(s, uid, S.currentUser.uid);
    updateRemoteState(s);
};

// Tombol UNO kecil di kanan-bawah: tangkap pemain pertama (urut dari pemain setelah kita) yang lupa UNO.
window.awCatchAny = () => {
    if (!S.roomData || S.roomData.status !== 'playing') return;
    const s = cloneState();
    const me = S.currentUser.uid, pl = S.roomData.players;
    const myIdx = pl.findIndex(p => p.uid === me);
    let victim = null;
    for (let i = 1; i < pl.length && !victim; i++) { const u = pl[(myIdx + i) % pl.length].uid; if (isCatchable(s, u)) victim = u; }
    if (!victim) { sfx('nope'); return showToast("Tidak ada yang lupa UNO."); }
    penalize(s, victim, me);
    updateRemoteState(s);
};

// Waktu habis: mainkan kartu berpoin terkecil (Wild biasa dulu). Bila sudah mengambil kartu: kartu baru itu yang dimainkan.
export function timeoutTurn(uid) {
    if (!S.roomData || S.roomData.status !== 'playing') return;
    if (actorUid(S.roomData.gameState) !== uid) return;
    const mine = uid === S.currentUser.uid;
    if (mine) closeAsks();
    const s = cloneState();
    const hand = s.hands[uid];
    const drew = mine && S.hasDrawnThisTurn;
    const mv = chooseTimeoutPlay(s, S.roomData.players, uid, drew ? hand.length - 1 : null);
    if (mine) S.hasDrawnThisTurn = false;
    if (mv) {
        s.logs.push(`Waktu habis! <b>${nameOf(uid)}</b> otomatis memainkan kartu poin terkecil.`);
        if (mine) showToast("Waktu habis! Kartu terkecil dimainkan otomatis.");
        const won = playCardOn(s, uid, mv.idx, { color: mv.color, target: mv.target, callUno: false });
        updateRemoteState(s, won ? { status: 'finished' } : {});
        return;
    }
    advance(s);
    updateRemoteState(s);
}
