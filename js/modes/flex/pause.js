import { S } from '../../core/state.js';
import { pauseTimer, resumeTimer, stopTimer } from './timer.js';
import { scheduleBot } from './local.js';

window.stopFlexTimerHook = stopTimer;   // dipakai ui.js / local.js tanpa impor melingkar

// Menu jeda (vs Komputer): permainan benar-benar berhenti (bot & batas 15 detik).
const $ = (id) => document.getElementById(id);
const setPauseLabel = () => { $('x-pause-toggle').textContent = S.paused ? '▶ Lanjutkan Permainan' : '⏸ Jeda Permainan'; };

// Menu Pengaturan: suara, Jeda, Mulai Ulang, Keluar. Membuka menu TIDAK menjeda; jeda hanya lewat tombol "Jeda Permainan" (khusus vs Komputer).
window.flexOpenMenu = () => {
    if (!S.roomData) return;
    $('x-pause-title').textContent = 'Pengaturan';
    $('x-pause-note').textContent = S.localMode ? '' : 'Permainan online tidak bisa dijeda; pemain lain tetap bermain.';
    $('x-btn-restart').classList.toggle('hidden', !S.localMode);
    $('x-pause-toggle').classList.toggle('hidden', !S.localMode);
    setPauseLabel();
    $('x-pause-modal').classList.remove('hidden');
};

window.flexTogglePause = () => {
    if (!S.localMode || !S.roomData) return;
    if (!S.paused) { S.paused = true; clearTimeout(S.botTimer); pauseTimer(); }
    else { S.paused = false; resumeTimer(); scheduleBot(); }
    setPauseLabel();
};

// Tutup menu (kalau sedang dijeda, permainan dilanjutkan)
window.flexResume = () => {
    $('x-pause-modal').classList.add('hidden');
    if (S.localMode && S.paused) { S.paused = false; resumeTimer(); scheduleBot(); }
    S.paused = false;
};

window.flexExit = () => {
    $('x-pause-modal').classList.add('hidden');
    S.paused = false;
    window.flexLeave();
};

// Mulai ulang = permainan baru dengan jumlah lawan yang sama
window.flexRestart = () => {
    if (!S.localMode || !S.roomData) return;
    const n = S.roomData.players.length - 1;
    $('x-pause-modal').classList.add('hidden');
    S.paused = false;
    clearTimeout(S.botTimer);
    document.getElementById('bot-count').value = String(n);
    window.startFlexLocal();
};
