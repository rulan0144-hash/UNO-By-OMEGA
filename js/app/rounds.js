// Ronde: pop-up pilihan jumlah ronde (offline), pilihan ronde di lobi (online), tombol "Lanjut ronde" / "Main Lagi" / "Beranda"
// di layar akhir permainan. Dipakai bersama semua mode lewat registerMode() di modes.js.
import { S } from '../core/state.js';
import { ROUND_CHOICES, newSeries } from '../core/series.js';
import { roomDoc, updateDoc } from '../core/firebase.js';
import { getImpl, getMode } from './modes.js';
import { prepareMode } from '../core/loader.js';

const store = {
    get(k, d) { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* abaikan */ }; }
};
const $ = (id) => document.getElementById(id);
const modeOfNow = () => (S.roomData && S.roomData.mode) || S.mode || 'classic';
const newId = () => Math.random().toString(36).slice(2, 10);

// ---------- pop-up "Main berapa ronde?" (offline) ----------
let pendingMode = null, pendingBots = 3, pendingRounds = 1, choosing = false;

export function askRounds(modeId, bots) {
    const m = getMode(modeId); if (!m) return;
    pendingMode = modeId; pendingBots = bots; choosing = false;
    const last = parseInt(store.get('uno_rounds', '1')) || 1;
    pendingRounds = ROUND_CHOICES.includes(last) ? last : 1;
    $('round-sub').textContent = `${m.name} - ${bots} lawan`;
    $('round-grid').innerHTML = ROUND_CHOICES.map(n =>
        `<button class="round-chip ${n === pendingRounds ? 'on' : ''}" data-n="${n}" onclick="chooseRounds(${n})"><b>${n}</b><span>ronde</span></button>`).join('');
    $('round-modal').classList.remove('hidden');
}

window.closeRounds = () => { if (choosing) return; $('round-modal').classList.add('hidden'); pendingMode = null; };

// Ketuk angka = hanya memilih (sorotan pindah). Game baru mulai setelah menekan tombol "Mulai Main".
window.chooseRounds = (n) => {
    if (choosing || !pendingMode) return;
    pendingRounds = n;
    document.querySelectorAll('#round-grid .round-chip').forEach(b => b.classList.toggle('on', Number(b.dataset.n) === n));
};

window.startRounds = async () => {
    if (choosing || !pendingMode) return;
    choosing = true;
    const id = pendingMode, impl = getImpl(id), n = pendingRounds;
    $('round-modal').classList.add('hidden');
    pendingMode = null; choosing = false;
    if (!impl) return;
    store.set('uno_rounds', String(n));
    S.mode = id;
    await prepareMode(id);        // tunggu semua gambar termuat dulu (layar "Memuat isi game")
    S.series = newSeries(n);
    impl.startLocal(pendingBots);
};

// ---------- lobi online: host memilih jumlah ronde ----------
export function renderLobbyRounds() {
    const box = $('lr-chips'); if (!box || !S.roomData) return;
    const cur = S.roomData.rounds || 1;
    const host = S.roomData.hostId === (S.currentUser && S.currentUser.uid);
    box.innerHTML = ROUND_CHOICES.map(n =>
        `<button class="round-chip lr-chip ${n === cur ? 'on' : ''}" ${host ? `onclick="setRounds(${n})"` : 'disabled'}><b>${n}</b></button>`).join('');
    $('lr-note').textContent = host
        ? (cur === 1 ? 'Satu ronde: setelah selesai ada tombol Main Lagi.' : `${cur} ronde: pemenang ditentukan dari total poin.`)
        : `Dipilih host: ${cur} ronde.`;
}

window.setRounds = async (n) => {
    const r = S.roomData;
    if (!r || S.localMode || r.status !== 'waiting' || r.hostId !== S.currentUser.uid) return;
    try { await updateDoc(roomDoc(S.currentRoomCode), { rounds: n }); } catch (e) { console.error('ronde', e); showToast('Gagal mengubah jumlah ronde.'); }
};

// ---------- layar akhir permainan ----------
const startAgainLocal = () => {
    const impl = getImpl(S.mode || 'classic');
    if (impl) impl.startLocal(S.roomData.players.length - 1);
};

let busy = false;
async function hostNext(reset) {
    const room = S.roomData;
    if (busy || !room || room.status !== 'finished' || room.hostId !== S.currentUser.uid) return;
    if (!reset && !S.lastRound) return;
    const o = (getImpl(room.mode || 'classic') || {}).online; if (!o) return;
    busy = true;
    try {
        const history = reset ? [] : [...(room.history || []), S.lastRound];
        await updateDoc(roomDoc(S.currentRoomCode), {
            status: 'playing', round: reset ? 1 : (room.round || 1) + 1, history, gameId: newId(),
            gameState: JSON.parse(JSON.stringify(o.deal(room.players)))   // JSON: buang field undefined (Firestore menolaknya)
        });
    } catch (e) { console.error('ronde berikut', e); showToast('Gagal memulai. Coba lagi.'); }
    busy = false;
}

window.nextRound = () => {
    if (S.localMode) {
        if (!S.series || !S.lastRound) return;
        S.series.history.push(S.lastRound); S.series.round++;
        S.lastRound = null;
        startAgainLocal();
    } else hostNext(false);
};

window.playAgain = () => {
    if (S.localMode) { S.series = newSeries(S.series ? S.series.total : 1); S.lastRound = null; startAgainLocal(); }
    else hostNext(true);
};

window.goHome = () => {
    S.series = null; S.lastRound = null;
    const o = (getImpl(modeOfNow()) || {}).online;
    if (o && o.leave) o.leave(); else window.leaveRoom();
};
