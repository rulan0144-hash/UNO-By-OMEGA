import { isBusy } from './animations.js';
import { S, cloneState, fx, nameOf } from './state.js';
import { roomDoc, updateDoc } from './firebase.js';
import { calculatePoint, extractCards } from './deck.js';
import { advance, canCallUno, isMyTurn, isPlayable, normalizeUno, penalize, playCardOn } from './rules.js';
import { scheduleBot } from './local.js';
import { handleGameOver, renderGame } from './ui.js';

export async function updateRemoteState(newState, extra = {}) {
    if (!S.currentRoomCode) return;
    if (newState.logs.length > 30) newState.logs = newState.logs.slice(-30);
    normalizeUno(newState);
    if (S.localMode) {
        S.roomData = { ...S.roomData, ...extra, gameState: newState };
        renderGame();
        if (S.roomData.status === 'finished') handleGameOver(); else scheduleBot();
        return;
    }
    await updateDoc(roomDoc(S.currentRoomCode), { gameState: newState, ...extra });
}

// --- AKSI PEMAIN ---
window.humanPlayCard = (idx) => {
    if (isBusy()) return showToast("Tunggu animasi selesai...");
    if (!isMyTurn()) return showToast("Bukan giliranmu!");
    const myHand = S.roomData.gameState.hands[S.currentUser.uid];
    const card = myHand[idx];
    if (S.hasDrawnThisTurn && idx !== myHand.length - 1) return showToast("Hanya bisa memainkan kartu baru!");
    if (!isPlayable(card)) return showToast("Kartu tidak cocok!");
            // simpan posisi kartu di tangan untuk animasi terbang ke tumpukan
            S.pendingFrom = (() => { const el = document.getElementById('human-hand-ui').children[idx]; if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; })();
    if (card.color === 'Black') {
        S.pendingWildCardIdx = idx;
        document.getElementById('color-modal').classList.remove('hidden');
        return;
    }
    processPlayCard(idx, card.color);
};

window.pickColor = (color) => {
    document.getElementById('color-modal').classList.add('hidden');
    processPlayCard(S.pendingWildCardIdx, color);
    S.pendingWildCardIdx = -1;
};

export async function processPlayCard(idx, color) {
    const s = cloneState();
    // callUno=false: pemain harus menekan tombol UNO sendiri (boleh sebelum/sesudah main)
    const won = playCardOn(s, S.currentUser.uid, idx, color, false);
    S.hasDrawnThisTurn = false;
    await updateRemoteState(s, won ? { status: 'finished' } : {});
}

window.humanDrawCard = () => {
    if (isBusy()) return showToast("Tunggu animasi selesai...");
    if (!isMyTurn() || S.hasDrawnThisTurn) return;
    const s = cloneState();
    const me = S.currentUser.uid;
    s.catchable = null;
    const drawn = extractCards(s, 1)[0];
    if (!drawn) { advance(s); s.logs.push(`<b>${nameOf(me)}</b> tidak bisa mengambil kartu.`); updateRemoteState(s); return; }

    s.hands[me].push(drawn);
            fx(s, { t: 'draw', uid: me, n: 1 });
    s.logs.push(`<b>${nameOf(me)}</b> mengambil kartu.`);
    if (!isPlayable(drawn)) {
        advance(s);
        S.hasDrawnThisTurn = false;
    } else {
        S.hasDrawnThisTurn = true;
        showToast("Mainkan kartu baru, atau tekan Lewati.");
    }
    updateRemoteState(s);
};

window.humanPass = () => {
    if (isBusy()) return showToast("Tunggu animasi selesai...");
    if (!isMyTurn() || !S.hasDrawnThisTurn) return;
    const s = cloneState();
    s.catchable = null;
    s.logs.push(`<b>${nameOf(S.currentUser.uid)}</b> melewati giliran.`);
    advance(s);
    S.hasDrawnThisTurn = false;
    updateRemoteState(s);
};

window.pressUno = () => {
    if (isBusy()) return showToast("Tunggu animasi selesai...");
    if (!S.roomData || S.roomData.status !== 'playing') return;
    const s = cloneState();
    const me = S.currentUser.uid;
    if (s.unoCalled[me]) return showToast("Kamu sudah aman 👍");
    if (!canCallUno(s)) {
        return showToast(s.hands[me].length === 2 ? "Belum ada kartu yang cocok untuk dimainkan!" : "Belum saatnya bilang UNO!");
    }
    s.unoCalled[me] = true;
            fx(s, { t: 'uno', uid: me });
    if (s.catchable === me) s.catchable = null;
    s.logs.push(`<b class="text-red-500">${nameOf(me)} berteriak UNO!</b>`);
    updateRemoteState(s);
    showToast("Kamu berteriak UNO!");
};

// Ketuk profil lawan -> tombol UNO muncul (jika sisa 1 kartu)
window.toggleOpp = (uid) => {
    S.selectedOpp = S.selectedOpp === uid ? null : uid;
    renderGame();
};

window.catchPlayer = (uid) => {
    if (isBusy()) return showToast("Tunggu animasi selesai...");
    S.selectedOpp = null;
    const s = cloneState();
    if (s.catchable !== uid || s.unoCalled[uid]) {
        renderGame();
        return showToast("Terlambat, atau dia sudah bilang UNO!");
    }
    penalize(s, uid, S.currentUser.uid);
    updateRemoteState(s);
};

// Waktu giliran habis: otomatis mainkan kartu cocok dengan poin terkecil;
// kalau tidak ada yang cocok, ambil 1 kartu dari deck lalu giliran berpindah
export function timeoutTurn(uid) {
    if (!S.roomData || S.roomData.status !== 'playing') return;
    if (S.roomData.players[S.roomData.gameState.turnIndex].uid !== uid) return;
    const s = cloneState();
    const mine = uid === S.currentUser.uid;
    const hand = s.hands[uid];
    const drew = mine && S.hasDrawnThisTurn;

    // pilih kartu yang bisa dimainkan dengan poin terkecil (setelah menarik, hanya kartu barunya)
    let best = -1;
    hand.forEach((c, i) => {
        if (drew && i !== hand.length - 1) return;
        if (!isPlayable(c)) return;
        if (best < 0 || calculatePoint(c) < calculatePoint(hand[best])) best = i;
    });

    if (mine) {
        S.hasDrawnThisTurn = false;
        S.pendingWildCardIdx = -1;
        document.getElementById('color-modal').classList.add('hidden');
    }

    if (best >= 0) {
        const card = hand[best];
        let color = card.color;
        if (color === 'Black') {   // pilih warna yang paling banyak di tangan
            const cnt = {};
            hand.forEach((c, i) => { if (i !== best && c.color !== 'Black') cnt[c.color] = (cnt[c.color] || 0) + 1; });
            color = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || 'Red';
        }
        s.logs.push(`Waktu habis! <b>${nameOf(uid)}</b> otomatis memainkan kartu poin terkecil.`);
        if (mine) showToast("Waktu habis! Kartu terkecil dimainkan otomatis.");
        const won = playCardOn(s, uid, best, color, false);
        updateRemoteState(s, won ? { status: 'finished' } : {});
        return;
    }

    s.catchable = null;
    if (!drew) {
        const got = extractCards(s, 1);
        if (got.length) { s.hands[uid].push(got[0]); fx(s, { t: 'draw', uid, n: 1 }); }
    }
    s.logs.push(`Waktu habis! <b>${nameOf(uid)}</b> tidak punya kartu cocok, ambil dari deck.`);
    if (mine) showToast("Waktu habis! Tidak ada kartu cocok, ambil dari deck.");
    advance(s);
    updateRemoteState(s);
}
