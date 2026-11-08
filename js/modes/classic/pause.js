import { S } from '../../core/state.js';
import { pauseTimer, resumeTimer, stopTimer } from './timer.js';

window.stopTimerHook = stopTimer;   // dipakai ui.js / local.js tanpa impor melingkar
import { scheduleBot } from './local.js';

// Menu jeda. Offline (vs Komputer): permainan benar-benar berhenti (bot & batas 15 detik).
// Online: permainan tidak bisa dijeda (pemain lain tetap main), menu hanya untuk keluar.
const $ = (id) => document.getElementById(id);

const setPauseLabel = () => { $('pause-toggle').textContent = S.paused ? '▶ Lanjutkan Permainan' : '⏸ Jeda Permainan'; };

// Menu Pengaturan: suara, Jeda, Mulai Ulang, Keluar. Membuka menu TIDAK menjeda; jeda hanya lewat tombol "Jeda Permainan" (khusus vs Komputer).
window.openMenu = () => {
    if (!S.roomData) return;
    $('pause-title').textContent = 'Pengaturan';
    $('pause-note').textContent = S.localMode ? '' : 'Permainan online tidak bisa dijeda; pemain lain tetap bermain.';
    $('btn-restart').classList.toggle('hidden', !S.localMode);
    $('pause-toggle').classList.toggle('hidden', !S.localMode);
    setPauseLabel();
    $('pause-modal').classList.remove('hidden');
};

window.togglePause = () => {
    if (!S.localMode || !S.roomData) return;
    if (!S.paused) { S.paused = true; clearTimeout(S.botTimer); pauseTimer(); }
    else { S.paused = false; resumeTimer(); scheduleBot(); }
    setPauseLabel();
};

// Tutup menu (kalau sedang dijeda, permainan dilanjutkan)
window.resumeGame = () => {
    $('pause-modal').classList.add('hidden');
    if (S.localMode && S.paused) { S.paused = false; resumeTimer(); scheduleBot(); }
    S.paused = false;
};

window.exitGame = async () => {
    $('pause-modal').classList.add('hidden');
    S.paused = false;
    await window.leaveLobby(true);
};

window.restartLocal = () => {
    if (!S.localMode || !S.roomData) return;
    const n = S.roomData.players.length - 1;
    $('pause-modal').classList.add('hidden');
    S.paused = false;
    clearTimeout(S.botTimer);
    $('bot-count').value = String(n);
    window.startLocal();
};
