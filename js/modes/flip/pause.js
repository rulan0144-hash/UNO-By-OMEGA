import { S } from '../../core/state.js';
import { pauseTimer, resumeTimer, stopTimer } from './timer.js';
import { scheduleBot } from './local.js';
import { newSeries, roundText } from '../../core/series.js';

window.stopFlipTimerHook = stopTimer;   // dipakai ui.js / local.js tanpa impor melingkar

// Menu Pengaturan. Offline (vs Komputer): MEMBUKA menu langsung menjeda permainan (bot & batas 15 detik berhenti);
// permainan lanjut lagi saat menekan "Lanjutkan". Online: permainan tidak bisa dijeda (pemain lain tetap main).
const $ = (id) => document.getElementById(id);

window.flipOpenMenu = () => {
    if (!S.roomData) return;
    // offline + sedang main: langsung pause
    if (S.localMode && S.roomData.status === 'playing' && !S.paused) { S.paused = true; clearTimeout(S.botTimer); pauseTimer(); }
    const rt = roundText();
    $('f-pause-title').textContent = 'Pengaturan';
    $('f-pause-note').textContent = S.localMode
        ? (rt ? rt + ' - permainan dijeda' : 'Permainan dijeda')
        : (rt ? rt + '. ' : '') + 'Permainan online tidak bisa dijeda; pemain lain tetap bermain.';
    $('f-btn-restart').classList.toggle('hidden', !S.localMode);
    $('flipResume-btn').textContent = S.localMode ? '▶ Lanjutkan' : '✕ Tutup';
    $('f-pause-modal').classList.remove('hidden');
};

// Tutup menu (offline: permainan dilanjutkan)
window.flipResume = () => {
    $('f-pause-modal').classList.add('hidden');
    if (S.localMode && S.paused) { S.paused = false; resumeTimer(); scheduleBot(); }
    S.paused = false;
};

window.flipExit = () => {
    $('f-pause-modal').classList.add('hidden');
    S.paused = false;
    S.series = null; S.lastRound = null;
    window.flipLeave();
};

// Mulai ulang = seri baru dari ronde 1 dengan jumlah ronde & lawan yang sama
window.flipRestart = () => {
    if (!S.localMode || !S.roomData) return;
    const n = S.roomData.players.length - 1;
    $('f-pause-modal').classList.add('hidden');
    S.paused = false;
    clearTimeout(S.botTimer);
    if (S.series) S.series = newSeries(S.series.total);
    S.lastRound = null;
    document.getElementById('bot-count').value = String(n);
    window.startFlipLocal();
};
