import { go } from '../../app/router.js';
import { S, emptyState, esc } from '../../core/state.js';
import { firebaseConfig, getDoc, onSnapshot, roomDoc, setDoc, updateDoc, deleteDoc } from '../../core/firebase.js';
import { getImpl, getMode } from '../../app/modes.js';
import { assetsReady, prepareMode, warmMode } from '../../core/loader.js';
import { renderLobbyRounds } from '../../app/rounds.js';

// Online dipakai bersama semua mode: tiap mode mendaftarkan { screen, render, gameOver, deal, leave } lewat registerMode(id, { online }).
// Mode ruangan disimpan di field `mode` (ruangan lama tanpa field = 'classic').
const onlineOf = (mode) => { const i = getImpl(mode || 'classic'); return i && i.online; };
// Batas pemain per mode = jumlah lawan maksimum di modes.js + 1 (Klasik/Flip 10, Flex 8)
const maxPlayersOf = (mode) => { const m = getMode(mode || 'classic'); return m && m.bots ? m.bots.max + 1 : 10; };

// --- MODE ONLINE ---
window.createRoom = async () => {
    if (!S.fbUser) return showToast("Mode online belum aktif. Isi firebaseConfig dulu.");
    S.currentUser = S.fbUser; S.localMode = false;
    const mode = S.mode || 'classic';
    if (!onlineOf(mode)) return showToast("Mode ini belum punya online.");
    warmMode(mode);
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    await setDoc(roomDoc(code), {
        mode, hostId: S.fbUser.uid, status: 'waiting', rounds: 1, round: 1, history: [],
        players: [{ uid: S.fbUser.uid, name: S.myName }], gameState: emptyState()
    });
    joinRoomLogic(code);
};

window.joinRoom = async () => {
    const code = document.getElementById('room-code-input').value.trim().toUpperCase();
    if (code.length !== 5) return showToast("Kode ruangan tidak valid!");
    joinRoomLogic(code);
};

export async function joinRoomLogic(code) {
    if (!S.fbUser) return showToast("Mode online belum aktif. Isi firebaseConfig dulu.");
    S.currentUser = S.fbUser; S.localMode = false;
    const roomRef = roomDoc(code);
    const snapshot = await getDoc(roomRef);
    if (!snapshot.exists()) return showToast("Ruangan tidak ditemukan!");

    const data = snapshot.data();
    const roomMode = data.mode || 'classic';
    if (roomMode !== (S.mode || 'classic')) { const m = getMode(roomMode); return showToast(`Ruangan ini untuk ${m ? m.name : 'mode lain'}. Buka mode itu di beranda lalu gabung.`); }
    const already = data.players.some(p => p.uid === S.fbUser.uid);
    if (data.status !== 'waiting' && !already) return showToast("Permainan sudah dimulai!");
    if (!already) {
        if (data.players.length >= maxPlayersOf(roomMode)) return showToast("Ruangan penuh!");
        await updateDoc(roomRef, { players: [...data.players, { uid: S.fbUser.uid, name: S.myName }] });
    }

    warmMode(roomMode);   // muat gambar selagi menunggu di lobi
    S.currentRoomCode = code;
    S.hasDrawnThisTurn = false; S.selIdx = -1; S.selCard = null; S.winSoundKey = null; S.winShown = null;
    const mm = getMode(roomMode); const lm = document.getElementById('lobby-mode'); if (lm) lm.innerText = mm ? mm.name : '';
    go('lobby-screen');
    document.getElementById('lobby-room-code').innerText = code;
    subscribeToRoom(code);
}

export function subscribeToRoom(code) {
    if (S.roomUnsubscribe) S.roomUnsubscribe();
    let waiting = false;
    const show = () => {
        const o = onlineOf(S.roomData.mode);
        if (S.roomData.status !== 'finished') document.querySelectorAll('.over-modal').forEach(el => el.classList.add('hidden'));   // ronde/permainan baru dimulai host: tutup layar akhir lama
        go(o.screen);
        o.render();
        if (S.roomData.status === 'finished') o.gameOver();
    };
    S.roomUnsubscribe = onSnapshot(roomDoc(code), (docSnap) => {
        if (!docSnap.exists()) { showToast("Ruangan ditutup."); leaveCurrent(); return; }
        S.roomData = docSnap.data();
        if (S.roomData.status === 'waiting') {
            renderLobby();
        } else {
            const mode = S.roomData.mode || 'classic';
            const o = onlineOf(mode);
            if (!o) { showToast("Mode ruangan tidak dikenal."); leaveCurrent(); return; }
            if (!assetsReady(mode)) {   // gambar belum lengkap: tahan dulu dengan layar "Memuat", lalu tampilkan keadaan terbaru
                if (!waiting) { waiting = true; prepareMode(mode).then(() => { waiting = false; if (S.roomData && S.currentRoomCode === code) show(); }); }
                return;
            }
            show();
        }
    }, (error) => console.error("Subscription error", error));
}

export function renderLobby() {
    const listUI = document.getElementById('lobby-players');
    listUI.innerHTML = S.roomData.players.map(p => {
        const isMe = p.uid === S.currentUser.uid ? ' (Kamu)' : '';
        const isHost = p.uid === S.roomData.hostId ? ' 👑' : '';
        return `<li class="border-b border-gray-700 py-2">👤 ${esc(p.name)}${isMe}${isHost}</li>`;
    }).join('');
    document.getElementById('player-count').innerText = S.roomData.players.length;
    const pm = document.getElementById('player-max'); if (pm) pm.innerText = maxPlayersOf(S.roomData.mode);   // batas pemain sesuai mode (Flex 8, No Mercy 6, lainnya 10)
    renderLobbyRounds();   // pilihan jumlah ronde (host bisa ubah, pemain lain hanya melihat)

    const isHost = S.roomData.hostId === S.currentUser.uid;
    const startBtn = document.getElementById('btn-start-game');
    const msg = document.getElementById('waiting-host-msg');
    if (isHost && S.roomData.players.length >= 2) {
        startBtn.classList.remove('hidden'); msg.classList.add('hidden');
    } else {
        startBtn.classList.add('hidden'); msg.classList.remove('hidden');
        msg.innerText = S.roomData.players.length < 2 ? "Menunggu pemain lain bergabung..." : "Menunggu Host memulai permainan...";
    }
}

window.startGame = async () => {
    if (!S.currentUser || S.roomData.hostId !== S.currentUser.uid) return;
    const o = onlineOf(S.roomData.mode);
    if (!o) return;
    await prepareMode(S.roomData.mode || 'classic');   // host: pastikan gambar siap sebelum permainan dimulai
    // JSON: buang field undefined (Firestore menolaknya)
    await updateDoc(roomDoc(S.currentRoomCode), { status: 'playing', round: 1, history: [], gameId: Math.random().toString(36).slice(2, 10), gameState: JSON.parse(JSON.stringify(o.deal(S.roomData.players))) });
};

// Keluar ke beranda lewat fungsi keluar milik mode ruangan saat ini
function leaveCurrent() {
    const o = onlineOf(S.roomData && S.roomData.mode);
    if (o && o.leave) o.leave(); else window.leaveRoom();
}

// Tombol kembali (lobi / menu game): keluar dari ruangan online dan kembali ke beranda.
// Host keluar -> ruangan ditutup; pemain biasa saat lobi -> namanya dihapus dari daftar.
window.leaveLobby = async (fromGame = false) => {
    const code = S.currentRoomCode, data = S.roomData, me = S.currentUser && S.currentUser.uid;
    if (S.roomUnsubscribe) { S.roomUnsubscribe(); S.roomUnsubscribe = null; }   // berhenti mendengar dulu agar tidak memanggil leaveRoom dua kali
    if (code && data && !S.localMode && me) {
        try {
            if (data.hostId === me && data.status === 'waiting') await deleteDoc(roomDoc(code));
            else if (data.status === 'waiting') await updateDoc(roomDoc(code), { players: data.players.filter(p => p.uid !== me) });
        } catch (e) { console.error('keluar ruangan', e); }
    }
    leaveCurrent();
};
