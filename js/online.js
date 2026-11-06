import { S, emptyState, esc } from './state.js';
import { firebaseConfig, getDoc, onSnapshot, roomDoc, setDoc, updateDoc } from './firebase.js';
import { dealGame } from './deck.js';
import { handleGameOver, renderGame } from './ui.js';

// --- MODE ONLINE ---
window.createRoom = async () => {
    if (!S.fbUser) return showToast("Mode online belum aktif. Isi firebaseConfig dulu.");
    S.currentUser = S.fbUser; S.localMode = false;
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    await setDoc(roomDoc(code), {
        hostId: S.fbUser.uid, status: 'waiting',
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
    const already = data.players.some(p => p.uid === S.fbUser.uid);
    if (data.status !== 'waiting' && !already) return showToast("Permainan sudah dimulai!");
    if (!already) {
        if (data.players.length >= 10) return showToast("Ruangan penuh!");
        await updateDoc(roomRef, { players: [...data.players, { uid: S.fbUser.uid, name: S.myName }] });
    }

    S.currentRoomCode = code;
    document.getElementById('home-screen').classList.add('hidden');
    document.getElementById('lobby-screen').classList.remove('hidden');
    document.getElementById('lobby-room-code').innerText = code;
    subscribeToRoom(code);
}

export function subscribeToRoom(code) {
    if (S.roomUnsubscribe) S.roomUnsubscribe();
    S.roomUnsubscribe = onSnapshot(roomDoc(code), (docSnap) => {
        if (!docSnap.exists()) { showToast("Ruangan ditutup."); leaveRoom(); return; }
        S.roomData = docSnap.data();
        if (S.roomData.status === 'waiting') {
            renderLobby();
        } else {
            document.getElementById('lobby-screen').classList.add('hidden');
            document.getElementById('game-screen').classList.remove('hidden');
            renderGame();
            if (S.roomData.status === 'finished') handleGameOver();
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
    await updateDoc(roomDoc(S.currentRoomCode), { status: 'playing', gameState: dealGame(S.roomData.players) });
};
