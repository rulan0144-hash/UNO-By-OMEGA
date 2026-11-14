import { isBusy, whenIdle } from './animations.js';
import { S, cloneState, fx, nameOf } from '../../core/state.js';
import { needsColor, needsTarget, pointOf } from './deck.js';
import { actorUid, canCallUno, drawUntilPlayable, hasPlayable, isCatchable, isMyTurn, isOut, isPlayableIn, normalizeUno, penalize, pickRouletteColor, playCardOn, resolveRoulette, rouletteDraw, takePenalty, tallyRound } from './rules.js';
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
    if (S.localMode) endIfHumanOut(newState);
    if (newState.winner && !extra.status) extra = { ...extra, status: 'finished' };   // menang karena Mercy / kartu terakhir
    if (extra.status === 'finished') tallyRound(newState);
    if (!S.localMode) {
        await updateDoc(roomDoc(S.currentRoomCode), { gameState: JSON.parse(JSON.stringify(newState)), ...extra });   // JSON: buang field undefined (Firestore menolaknya)
        return;
    }
    S.roomData = { ...S.roomData, ...extra, gameState: newState };
    renderGame();
    if (S.roomData.status === 'finished') handleGameOver(); else scheduleBot();
}

// OFFLINE (vs Komputer): begitu PEMAIN tersingkir (Mercy), ronde langsung selesai tanpa menunggu bot saling bermain.
// Pemenang = lawan hidup dengan kartu paling sedikit (seri: poin kartu paling kecil, lalu urutan meja). Menu akhir (Main Lagi /
// Lanjut ke Ronde N / Beranda) muncul setelah animasi Mercy selesai. Poin dihitung seperti biasa (+250 untuk yang tersingkir).
function endIfHumanOut(st) {
    const me = S.currentUser && S.currentUser.uid;
    if (!me || st.winner || !isOut(st, me)) return;
    const alive = S.roomData.players.filter(p => !isOut(st, p.uid));
    if (!alive.length) return;
    const score = (u) => st.hands[u].reduce((a, c) => a + pointOf(c), 0);
    alive.sort((a, b) => st.hands[a.uid].length - st.hands[b.uid].length || score(a.uid) - score(b.uid));
    st.winner = alive[0].uid; st.winBy = 'out'; st.pending = null; st.forced = null;
    st.logs.push(`<b>${nameOf(me)}</b> tersingkir: ronde selesai, <b>${nameOf(st.winner)}</b> menang!`);
}

// Menerapkan SATU keputusan (bot.js: decide / chooseTimeoutPlay) ke state. `again(s)` menghasilkan keputusan berikutnya
// (dipakai setelah mengambil kartu: kartu hasil ambil WAJIB dimainkan).
export function applyMove(s, uid, mv, again, callUno) {
    let m = mv;
    for (let guard = 0; m && guard < 3; guard++) {
        if (m.type === 'roulette') { resolveRoulette(s, m.color); return; }
        if (m.type === 'penalty') { takePenalty(s, uid); return; }
        if (m.type === 'draw') { const r = drawUntilPlayable(s, uid); if (!r.found) return; m = again(s); continue; }
        if (m.type === 'play') { playCardOn(s, uid, m.idx, { color: m.color, target: m.target, callUno }); return; }
        return;
    }
}

// Alasan kartu tidak bisa dimainkan (untuk pesan singkat)
function whyNot(st, uid) {
    if (st.forced && st.forced.uid === uid) return 'Kartu yang baru diambil WAJIB dimainkan.';
    if (st.pending && st.pending.kind === 'draw') return `Tumpuk dengan Draw ≥ +${st.pending.top}, atau ambil ${st.pending.n} kartu.`;
    return 'Kartu tidak cocok (warna/angka beda).';
}

// --- AKSI PEMAIN ---
// Mengetuk kartu (kedua kali) = memainkan. Kartu hitam: pilih warna; kartu 7: pilih lawan yang ditukar.
let busyAsk = false;
window.nmPlay = async (idx) => {
    if (busyAsk) return;
    if (isBusy()) return showToast("Tunggu animasi selesai...");
    const st0 = S.roomData && S.roomData.gameState;
    if (!isMyTurn()) return showToast("Bukan giliranmu!");
    const me = S.currentUser.uid;
    if (isOut(st0, me)) return;
    if (st0.pending && st0.pending.kind === 'roulette') return showToast("Pilih warna Color Roulette dulu.");
    const card = st0.hands[me][idx];
    if (!card) return;
    if (!isPlayableIn(st0, me, card)) { sfx('nope'); return showToast(whyNot(st0, me)); }
    S.pendingFrom = (() => { const el = document.getElementById('n-hand').children[idx]; if (!el) return null; const r = el.getBoundingClientRect(); const w = el.offsetWidth, h = el.offsetHeight; return { left: r.left + r.width / 2 - w / 2, top: r.top + r.height / 2 - h / 2, width: w, height: h }; })();
    busyAsk = true;
    try {
        let target, color;
        if (needsTarget(card) && st0.hands[me].length > 1) { target = await askTarget(st0); if (!target) return; }
        if (needsColor(card)) { color = await askColor('Pilih Warna'); if (!color) return; }
        S.pendingHand = st0.hands[me].slice();   // tangan SEBELUM main: animasi Discard All menjaga kartu sewarna tetap di kipas sampai terbang
        await processPlayCard(idx, { color, target });
    } finally { busyAsk = false; }
};

export async function processPlayCard(idx, opts) {
    const s = cloneState();
    // callUno=false: pemain harus menekan tombol UNO sendiri (boleh sebelum/sesudah main)
    playCardOn(s, S.currentUser.uid, idx, { ...opts, callUno: false });
    await updateRemoteState(s);
}

// Ketuk salah satu tumpukan ambil (side 'L' kiri / 'R' kanan, bebas memilih).
//  - Color Roulette (warna sudah dipilih): SETIAP ketukan membuka satu kartu, terus sampai muncul warna yang dipilih.
//  - Ada hukuman Draw berjalan = ambil hukuman. Tidak ada kartu cocok = ambil sampai dapat kartu yang bisa dimainkan (WAJIB dimainkan).
//  - Ada kartu cocok = tidak boleh mengambil.
window.nmDraw = (side) => {
    if (isBusy()) return showToast("Tunggu animasi selesai...");
    if (!isMyTurn()) return;
    const st = S.roomData.gameState, me = S.currentUser.uid;
    if (isOut(st, me)) return;
    if (st.pending && st.pending.kind === 'roulette') {
        if (!st.pending.color) { showToast("Pilih warna Color Roulette dulu."); return window.nmRouletteCheck && window.nmRouletteCheck(); }
        const s = cloneState();
        rouletteDraw(s, side);
        return updateRemoteState(s);
    }
    if (st.pending && st.pending.kind === 'draw') return window.nmTakePenalty();
    if (st.forced && st.forced.uid === me) { sfx('nope'); return showToast("Kartu yang baru diambil WAJIB dimainkan."); }
    if (hasPlayable(st, me)) { sfx('nope'); return showToast("Kamu punya kartu yang cocok: wajib dimainkan!"); }
    const s = cloneState();
    const r = drawUntilPlayable(s, me, side);
    if (r.found) showToast("Kartu ini cocok: WAJIB dimainkan.");
    else if (r.eliminated) showToast("Kamu memegang 25 kartu: tersingkir!");
    updateRemoteState(s);
};

window.nmTakePenalty = () => {
    if (isBusy()) return showToast("Tunggu animasi selesai...");
    if (!isMyTurn()) return;
    const st = S.roomData.gameState;
    if (!(st.pending && st.pending.kind === 'draw')) return;
    const s = cloneState();
    takePenalty(s, S.currentUser.uid);
    updateRemoteState(s);
};

// Korban Color Roulette (pemain ini): begitu semua animasi selesai ditawari memilih warna. Sesudahnya pemain MENGETUK tumpukan sendiri (nmDraw).
let askingRoulette = false;
window.nmRouletteCheck = () => {
    if (askingRoulette || !S.roomData || S.roomData.status !== 'playing') return;
    const st = S.roomData.gameState;
    if (!(st.pending && st.pending.kind === 'roulette' && !st.pending.color && st.pending.victim === S.currentUser.uid) || isOut(st, S.currentUser.uid)) return;
    askingRoulette = true;
    whenIdle().then(async () => {
        try {
            const st2 = S.roomData && S.roomData.gameState;
            if (!st2 || !(st2.pending && st2.pending.kind === 'roulette' && !st2.pending.color && st2.pending.victim === S.currentUser.uid)) return;
            sfx('spin');
            const color = await askColor('Roulette: pilih warna');
            if (!color) return;   // dibatalkan (waktu habis akan memilihkan)
            const s = cloneState();
            if (!(s.pending && s.pending.kind === 'roulette' && !s.pending.color)) return;
            pickRouletteColor(s, color);
            await updateRemoteState(s);
        } finally { askingRoulette = false; }
    });
};

window.nmUno = () => {
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
window.nmCatch = (uid) => {
    if (isOut(S.roomData.gameState, S.currentUser.uid)) return;   // pemain tersingkir hanya menonton
    const s = cloneState();
    if (!isCatchable(s, uid)) return showToast("Tidak bisa ditangkap (sudah bilang UNO atau kartunya bukan 1 lagi).");
    penalize(s, uid, S.currentUser.uid);
    updateRemoteState(s);
};

// Tombol tangkap di kanan-bawah: tangkap pemain pertama (urut dari pemain setelah kita) yang lupa UNO.
window.nmCatchAny = () => {
    if (!S.roomData || S.roomData.status !== 'playing' || isOut(S.roomData.gameState, S.currentUser.uid)) return;
    const s = cloneState();
    const me = S.currentUser.uid, pl = S.roomData.players;
    const myIdx = pl.findIndex(p => p.uid === me);
    let victim = null;
    for (let i = 1; i < pl.length && !victim; i++) { const u = pl[(myIdx + i) % pl.length].uid; if (isCatchable(s, u)) victim = u; }
    if (!victim) { sfx('nope'); return showToast("Tidak ada yang lupa UNO."); }
    penalize(s, victim, me);
    updateRemoteState(s);
};

// Waktu habis: main kartu bernilai terkecil; hukuman Draw -> diambil; tak ada kartu cocok -> ambil kartu; korban Roulette -> warna dipilihkan.
export function timeoutTurn(uid) {
    if (!S.roomData || S.roomData.status !== 'playing') return;
    if (actorUid(S.roomData.gameState) !== uid) return;
    const mine = uid === S.currentUser.uid;
    if (mine) closeAsks();
    const s = cloneState();
    const players = S.roomData.players;
    const pick = (st) => chooseTimeoutPlay(st, players, uid);
    s.logs.push(`Waktu habis! <b>${nameOf(uid)}</b> dimainkan otomatis.`);
    if (mine) showToast("Waktu habis! Langkah otomatis dijalankan.");
    applyMove(s, uid, pick(s), pick, false);
    updateRemoteState(s);
}
