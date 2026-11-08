import { isBusy } from './animations.js';
import { S, cloneState, fx, nameOf } from '../../core/state.js';
import { drawFrom, face, pointOf } from './deck.js';
import { advance, canCallUno, isMyTurn, isPlayable, isPlayableIn, normalizeUno, penalize, playCardOn, resolvePending, tallyRound } from './rules.js';
import { hideChallenge } from './challenge.js';
import { bestColor, scheduleBot } from './local.js';
import { handleGameOver, renderGame } from './ui.js';
import { sfx } from '../../core/sound.js';
import { roomDoc, updateDoc } from '../../core/firebase.js';

// Semua perubahan state lewat sini. Offline: langsung ke S.roomData. Online: ditulis ke Firestore, semua pemain (termasuk kita) menerimanya lewat onSnapshot.
export async function updateRemoteState(newState, extra = {}) {
    if (!S.currentRoomCode) return;
    if (newState.logs.length > 30) newState.logs = newState.logs.slice(-30);
    normalizeUno(newState, S.roomData && S.roomData.gameState && S.roomData.gameState.hands);
    if (extra.status === 'finished') tallyRound(newState);
    if (!S.localMode) {
        // JSON: buang field undefined (Firestore menolaknya)
        await updateDoc(roomDoc(S.currentRoomCode), { gameState: JSON.parse(JSON.stringify(newState)), ...extra });
        return;
    }
    S.roomData = { ...S.roomData, ...extra, gameState: newState };
    renderGame();
    if (S.roomData.status === 'finished') handleGameOver(); else scheduleBot();
}

// --- AKSI PEMAIN ---
window.flipPlay = (idx) => {
    if (isBusy()) return showToast("Tunggu animasi selesai...");
    if (!isMyTurn()) return showToast("Bukan giliranmu!");
    const st = S.roomData.gameState;
    const myHand = st.hands[S.currentUser.uid];
    const card = myHand[idx];
    if (S.hasDrawnThisTurn && idx !== myHand.length - 1) return showToast("Hanya bisa memainkan kartu baru!");
    if (!isPlayable(card)) { sfx('nope'); return showToast("Kartu tidak cocok!"); }
    // simpan posisi kartu di tangan untuk animasi terbang ke tumpukan
    S.pendingFrom = (() => { const el = document.getElementById('f-hand').children[idx]; if (!el) return null; const r = el.getBoundingClientRect(); const w = el.offsetWidth, h = el.offsetHeight; return { left: r.left + r.width / 2 - w / 2, top: r.top + r.height / 2 - h / 2, width: w, height: h }; })();
    const f = face(card, st.side);
    if (f.color === 'Black') {
        S.pendingWildCardIdx = idx;
        openPicker(st.side);
        return;
    }
    processPlayCard(idx, f.color);
};

// Pemilih warna Wild: empat zona (atas, kanan, bawah, kiri) dengan warna sesuai sisi yang sedang main
const SLOTS = { light: { Green: 'Green', Yellow: 'Yellow', Red: 'Red', Blue: 'Blue' }, dark: { Green: 'Teal', Yellow: 'Orange', Red: 'Pink', Blue: 'Purple' } };
const pickerImg = (side, color) => side === 'dark' ? (color ? `img/flip/fx/wild-${color}.png` : 'img/flip/fx/wild-spin-dark.png') : (color ? `img/effects/wild-${color}.png` : 'img/effects/wild-spin.png');
let pickerSide = 'light';
function openPicker(side) {
    pickerSide = side;
    document.querySelectorAll('#f-color-modal .cp-zone').forEach(z => { z.dataset.c = SLOTS[side][[...z.classList].find(c => c.startsWith('cp-') && c !== 'cp-zone').slice(3)]; });
    document.getElementById('f-cp-img').src = pickerImg(side);
    document.getElementById('f-color-modal').classList.remove('hidden');
}
document.querySelectorAll('#f-color-modal .cp-zone').forEach(z => {
    const img = document.getElementById('f-cp-img');
    const on = () => { img.src = pickerImg(pickerSide, z.dataset.c); };
    const off = () => { img.src = pickerImg(pickerSide); };
    z.addEventListener('pointerenter', on);
    z.addEventListener('pointerdown', on);
    z.addEventListener('pointerleave', off);
});

window.flipPick = (color) => {
    document.getElementById('f-color-modal').classList.add('hidden');
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

// side: 'L' = deck kiri, 'R' = deck kanan (pemain bebas memilih)
window.flipDraw = (side) => {
    if (S.roomData && S.roomData.gameState.pending) return showToast("Jawab dulu: ambil kartu atau tantang.");
    if (isBusy()) return showToast("Tunggu animasi selesai...");
    if (!isMyTurn() || S.hasDrawnThisTurn) return;
    const s = cloneState();
    const me = S.currentUser.uid;
    s.catchable = null;
    const got = drawFrom(s, 1, side);
    const drawn = got.cards[0];
    if (!drawn) { advance(s); s.logs.push(`<b>${nameOf(me)}</b> tidak bisa mengambil kartu.`); updateRemoteState(s); return; }

    s.hands[me].push(drawn);
    fx(s, { t: 'draw', uid: me, n: 1, sides: got.sides, cards: got.cards });
    s.logs.push(`<b>${nameOf(me)}</b> mengambil kartu.`);
    if (!isPlayableIn(s, drawn)) {
        advance(s);
        S.hasDrawnThisTurn = false;
    } else {
        S.hasDrawnThisTurn = true;
        showToast("Mainkan kartu baru, atau tekan Lewati.");
    }
    updateRemoteState(s);
};

window.flipPass = () => {
    if (S.roomData && S.roomData.gameState.pending) return showToast("Jawab dulu: ambil kartu atau tantang.");
    if (isBusy()) return showToast("Tunggu animasi selesai...");
    if (!isMyTurn() || !S.hasDrawnThisTurn) return;
    const s = cloneState();
    s.catchable = null;
    s.logs.push(`<b>${nameOf(S.currentUser.uid)}</b> melewati giliran.`);
    advance(s);
    S.hasDrawnThisTurn = false;
    updateRemoteState(s);
};

window.flipUno = () => {
    if (!S.roomData || S.roomData.status !== 'playing') return;
    const s = cloneState();
    const me = S.currentUser.uid;
    if (s.unoCalled[me]) return showToast("Kamu sudah aman");
    if (!canCallUno(s)) {
        return showToast(s.hands[me].length === 2 ? "Belum ada kartu yang cocok untuk dimainkan!" : "Belum saatnya bilang UNO!");
    }
    s.unoCalled[me] = true;
    fx(s, { t: 'uno', uid: me });
    if (s.catchable === me) s.catchable = null;
    s.logs.push(`<b>${nameOf(me)}</b> berteriak UNO!`);
    updateRemoteState(s);
    showToast("Kamu berteriak UNO!");
};

// Ketuk profil lawan yang bertanda palu -> langsung tertangkap
window.flipCatch = (uid) => {
    const s = cloneState();
    if (s.catchable !== uid || s.unoCalled[uid]) {
        return showToast("Tidak bisa ditangkap (sudah UNO atau terlambat).");
    }
    penalize(s, uid, S.currentUser.uid);
    updateRemoteState(s);
};

// Waktu giliran habis: otomatis mainkan kartu cocok dengan poin terkecil;
// kalau tidak ada yang cocok, ambil 1 kartu dari deck lalu giliran berpindah
export function timeoutTurn(uid) {
    if (!S.roomData || S.roomData.status !== 'playing') return;
    if (S.roomData.players[S.roomData.gameState.turnIndex].uid !== uid) return;
    if (S.roomData.gameState.pending) {   // waktu habis saat harus menjawab Wild Draw: ambil kartu
        const sp = cloneState();
        const wonP = resolvePending(sp, uid, 'draw');
        if (uid === S.currentUser.uid) { hideChallenge(); showToast("Waktu habis! Kamu mengambil kartu."); }
        updateRemoteState(sp, wonP ? { status: 'finished' } : {});
        return;
    }
    const s = cloneState();
    const mine = uid === S.currentUser.uid;
    const hand = s.hands[uid];
    const drew = mine && S.hasDrawnThisTurn;
    const pts = (c) => pointOf(face(c, s.side));

    let best = -1;
    hand.forEach((c, i) => {
        if (drew && i !== hand.length - 1) return;
        if (!isPlayableIn(s, c)) return;
        if (best < 0 || pts(c) < pts(hand[best])) best = i;
    });

    if (mine) {
        S.hasDrawnThisTurn = false;
        S.pendingWildCardIdx = -1;
        document.getElementById('f-color-modal').classList.add('hidden');
    }

    if (best >= 0) {
        const f = face(hand[best], s.side);
        const color = f.color === 'Black' ? bestColor(hand, best, s.side) : f.color;
        s.logs.push(`Waktu habis! <b>${nameOf(uid)}</b> otomatis memainkan kartu poin terkecil.`);
        if (mine) showToast("Waktu habis! Kartu terkecil dimainkan otomatis.");
        const won = playCardOn(s, uid, best, color, false);
        updateRemoteState(s, won ? { status: 'finished' } : {});
        return;
    }

    s.catchable = null;
    if (!drew) {
        const got = drawFrom(s, 1);
        if (got.cards.length) { s.hands[uid].push(got.cards[0]); fx(s, { t: 'draw', uid, n: 1, sides: got.sides, cards: got.cards }); }
    }
    s.logs.push(`Waktu habis! <b>${nameOf(uid)}</b> tidak punya kartu cocok, ambil dari deck.`);
    if (mine) showToast("Waktu habis! Tidak ada kartu cocok, ambil dari deck.");
    advance(s);
    updateRemoteState(s);
}

// Jawaban atas Wild Draw: 'draw' (ambil kartu) atau 'challenge' (tantang)
window.flipChallenge = (choice) => {
    if (isBusy()) return showToast("Tunggu animasi selesai...");
    if (!isMyTurn() || !S.roomData.gameState.pending) return;
    hideChallenge();
    const s = cloneState();
    const won = resolvePending(s, S.currentUser.uid, choice);
    updateRemoteState(s, won ? { status: 'finished' } : {});
};
