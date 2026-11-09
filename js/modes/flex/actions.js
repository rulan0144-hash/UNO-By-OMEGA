import { isBusy } from './animations.js';
import { S, cloneState, fx, nameOf } from '../../core/state.js';
import { drawFrom, isWild } from './deck.js';
import { advance, canCallUno, isMyTurn, isMyAction, actorUid, isPlayableIn, playOptions, normalizeUno, isCatchable, penalize, playCardOn, resolvePending, tallyRound } from './rules.js';
import { chooseTimeoutPlay } from './bot.js';
import { hideChallenge } from './challenge.js';
import { scheduleBot } from './local.js';
import { askSide, askColor, askTarget, closeAsks, handleGameOver, renderGame } from './ui.js';
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
// Mengetuk kartu (kedua kali) = memainkan. Jika kartu punya DUA cara (sisi biasa & flex) -> tanya sisi; Wild -> tanya warna; kartu target (sisi flex) -> tanya pemain.
let busyAsk = false;
window.flexPlay = async (idx) => {
    if (busyAsk) return;
    if (isBusy()) return showToast("Tunggu animasi selesai...");
    const st0 = S.roomData && S.roomData.gameState;
    if (st0 && st0.pending) return showToast("Jawab dulu: ambil kartu atau tantang.");
    if (!isMyTurn()) return showToast("Bukan giliranmu!");
    const me = S.currentUser.uid;
    const myHand = st0.hands[me];
    const card = myHand[idx];
    if (S.hasDrawnThisTurn && idx !== myHand.length - 1) return showToast("Hanya bisa memainkan kartu baru!");
    const opts = playOptions(st0, me, card);
    const armed = !!S.flexArmed;
    const pick0 = opts.find(o => o.flex === armed);
    if (!pick0) {
        sfx('nope');
        if (armed) return showToast("Power Card aktif: kartu ini tidak cocok lewat sisi flex. Pilih kartu yang bercahaya atau ketuk Power Card untuk batal.");
        const needFlex = opts.some(o => o.flex);
        return showToast(needFlex ? "Kartu ini cocok lewat sisi flex: ketuk Power Card (hijau → merah) dulu." : card.fv != null && !st0.power[me] && (isWild(card) || card.fc === st0.currentColor) ? "Power Card-mu merah: sisi flex belum bisa dipakai." : "Kartu tidak cocok!");
    }
    // posisi kartu di tangan untuk animasi terbang ke tumpukan
    S.pendingFrom = (() => { const el = document.getElementById('x-hand').children[idx]; if (!el) return null; const r = el.getBoundingClientRect(); const w = el.offsetWidth, h = el.offsetHeight; return { left: r.left + r.width / 2 - w / 2, top: r.top + r.height / 2 - h / 2, width: w, height: h }; })();
    busyAsk = true;
    try {
        const flex = armed;
        let color = card.c, target;
        if (isWild(card)) { color = await askColor(st0); if (!color) return; }
        if (flex && /^Target/.test(card.fv || '')) { target = await askTarget(st0, card); if (!target) return; }
        S.flexArmed = false;
        await processPlayCard(idx, { flex, color, target });
    } finally { busyAsk = false; }
};

export async function processPlayCard(idx, opts) {
    const s = cloneState();
    // callUno=false: pemain harus menekan tombol UNO sendiri (boleh sebelum/sesudah main)
    const won = playCardOn(s, S.currentUser.uid, idx, { ...opts, callUno: false });
    S.hasDrawnThisTurn = false;
    await updateRemoteState(s, won ? { status: 'finished' } : {});
}

// side: 'L' = deck kiri, 'R' = deck kanan (pemain bebas memilih)
window.flexDraw = (side) => {
    if (S.roomData && S.roomData.gameState.pending) return showToast("Jawab dulu: ambil kartu atau tantang.");
    if (isBusy()) return showToast("Tunggu animasi selesai...");
    if (!isMyTurn() || S.hasDrawnThisTurn) return;
    S.flexArmed = false;
    const s = cloneState();
    const me = S.currentUser.uid;
    const got = drawFrom(s, 1, side);
    const drawn = got.cards[0];
    if (!drawn) { advance(s); s.logs.push(`<b>${nameOf(me)}</b> tidak bisa mengambil kartu.`); updateRemoteState(s); return; }
    s.hands[me].push(drawn);
    fx(s, { t: 'draw', uid: me, n: 1, sides: got.sides, cards: got.cards });
    s.logs.push(`<b>${nameOf(me)}</b> mengambil kartu.`);
    if (!isPlayableIn(s, me, drawn)) { advance(s); S.hasDrawnThisTurn = false; }
    else { S.hasDrawnThisTurn = true; showToast("Mainkan kartu baru, atau tekan Lewati."); }
    updateRemoteState(s);
};

window.flexPass = () => {
    if (S.roomData && S.roomData.gameState.pending) return showToast("Jawab dulu: ambil kartu atau tantang.");
    if (isBusy()) return showToast("Tunggu animasi selesai...");
    if (!isMyTurn() || !S.hasDrawnThisTurn) return;
    const s = cloneState();
    s.logs.push(`<b>${nameOf(S.currentUser.uid)}</b> melewati giliran.`);
    advance(s);
    S.hasDrawnThisTurn = false;
    updateRemoteState(s);
};

window.flexUno = () => {
    if (!S.roomData || S.roomData.status !== 'playing') return;
    const s = cloneState();
    const me = S.currentUser.uid;
    if (s.unoCalled[me]) return showToast("Kamu sudah aman");
    if (!canCallUno(s)) return showToast(s.hands[me].length === 2 ? "Belum ada kartu yang cocok untuk dimainkan!" : "Belum saatnya bilang UNO!");
    s.unoCalled[me] = true;
    fx(s, { t: 'uno', uid: me });
    if (s.forgot) delete s.forgot[me];
    s.logs.push(`<b>${nameOf(me)}</b> berteriak UNO!`);
    updateRemoteState(s);
    showToast("Kamu berteriak UNO!");
};

// Ketuk profil lawan yang bertanda palu -> langsung tertangkap
window.flexCatch = (uid) => {
    const s = cloneState();
    if (!isCatchable(s, uid)) return showToast("Tidak bisa ditangkap (sudah bilang UNO atau kartunya bukan 1 lagi).");
    penalize(s, uid, S.currentUser.uid);
    updateRemoteState(s);
};

// Tombol UNO kecil di kanan-bawah: tangkap pemain pertama (urut dari pemain setelah kita) yang lupa UNO. Palu terbang dari tombol ini.
window.flexCatchAny = () => {
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

// Waktu habis: jika harus menjawab Wild Draw 4 -> ambil kartu; selain itu mainkan kartu cocok berpoin terkecil (sisi biasa lebih dulu),
// kalau tidak ada yang cocok ambil 1 kartu lalu giliran pindah. `uid` = pelaku (actorUid), bukan selalu pemegang giliran.
export function timeoutTurn(uid) {
    if (!S.roomData || S.roomData.status !== 'playing') return;
    if (actorUid(S.roomData.gameState) !== uid) return;
    const mine = uid === S.currentUser.uid;
    if (mine) { closeAsks(); }
    if (S.roomData.gameState.pending) {
        const sp = cloneState();
        const wonP = resolvePending(sp, uid, 'draw');
        if (mine) { hideChallenge(); showToast("Waktu habis! Kamu mengambil kartu."); }
        updateRemoteState(sp, wonP ? { status: 'finished' } : {});
        return;
    }
    const s = cloneState();
    const hand = s.hands[uid];
    const drew = mine && S.hasDrawnThisTurn;
    const mv = chooseTimeoutPlay(s, S.roomData.players, uid, drew ? hand.length - 1 : null);
    if (mine) S.hasDrawnThisTurn = false;
    if (mv) {
        s.logs.push(`Waktu habis! <b>${nameOf(uid)}</b> otomatis memainkan kartu poin terkecil.`);
        if (mine) showToast("Waktu habis! Kartu terkecil dimainkan otomatis.");
        const won = playCardOn(s, uid, mv.idx, { flex: mv.flex, color: mv.color, target: mv.target, callUno: false });
        updateRemoteState(s, won ? { status: 'finished' } : {});
        return;
    }
    if (!drew) {
        const got = drawFrom(s, 1);
        if (got.cards.length) { s.hands[uid].push(got.cards[0]); fx(s, { t: 'draw', uid, n: 1, sides: got.sides, cards: got.cards }); }
    }
    s.logs.push(`Waktu habis! <b>${nameOf(uid)}</b> tidak punya kartu cocok, ambil dari deck.`);
    if (mine) showToast("Waktu habis! Tidak ada kartu cocok, ambil dari deck.");
    advance(s);
    updateRemoteState(s);
}

// Jawaban atas Wild Draw 4: 'draw' (ambil 4) atau 'challenge' (tantang). Hanya pemain yang ditunjuk/berikutnya (pending.answerer).
window.flexChallenge = (choice) => {
    if (isBusy()) return showToast("Tunggu animasi selesai...");
    if (!isMyAction() || !S.roomData.gameState.pending) return;
    hideChallenge();
    const s = cloneState();
    const won = resolvePending(s, S.currentUser.uid, choice);
    updateRemoteState(s, won ? { status: 'finished' } : {});
};
