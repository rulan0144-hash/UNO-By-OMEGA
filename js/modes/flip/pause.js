import { S } from '../../core/state.js';
import { pauseTimer, resumeTimer, stopTimer } from './timer.js';
import { scheduleBot } from './local.js';

window.stopFlipTimerHook = stopTimer;   // dipakai ui.js / local.js tanpa impor melingkar

// Menu jeda (vs Komputer): permainan benar-benar berhenti (bot & batas 15 detik).
const $ = (id) => document.getElementById(id);

const setPauseLabel = () => { $('f-pause-toggle').textContent = S.paused ? '▶ Lanjutkan Permainan' : '⏸ Jeda Permainan'; };

// Menu Pengaturan: suara, Jeda, Mulai Ulang, Keluar. Membuka menu TIDAK menjeda; jeda hanya lewat tombol "Jeda Permainan" (khusus vs Komputer).
window.flipOpenMenu = () => {
    if (!S.roomData) return;
    $('f-pause-title').textContent = 'Pengaturan';
    $('f-pause-note').textContent = S.localMode ? '' : 'Permainan online tidak bisa dijeda; pemain lain tetap bermain.';
    $('f-btn-restart').classList.toggle('hidden', !S.localMode);
    $('f-pause-toggle').classList.toggle('hidden', !S.localMode);
    setPauseLabel();
    $('f-pause-modal').classList.remove('hidden');
};

window.flipTogglePause = () => {
    if (!S.localMode || !S.roomData) return;
    if (!S.paused) { S.paused = true; clearTimeout(S.botTimer); pauseTimer(); }
    else { S.paused = false; resumeTimer(); scheduleBot(); }
    setPauseLabel();
};

// Tutup menu (kalau sedang dijeda, permainan dilanjutkan)
window.flipResume = () => {
    $('f-pause-modal').classList.add('hidden');
    if (S.localMode && S.paused) { S.paused = false; resumeTimer(); scheduleBot(); }
    S.paused = false;
};

window.flipExit = () => {
    $('f-pause-modal').classList.add('hidden');
    S.paused = false;
    window.flipLeave();
};

// Mulai ulang = pertandingan baru dari 0 poin dengan jumlah lawan yang sama
window.flipRestart = () => {
    if (!S.localMode || !S.roomData) return;
    const n = S.roomData.players.length - 1;
    $('f-pause-modal').classList.add('hidden');
    S.paused = false;
    clearTimeout(S.botTimer);
    document.getElementById('bot-count').value = String(n);
    window.startFlipLocal();
};
