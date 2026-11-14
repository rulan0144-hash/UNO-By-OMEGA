import { S } from '../../core/state.js';
import { pauseTimer, resumeTimer, stopTimer } from './timer.js';
import { scheduleBot } from './local.js';
import { newSeries, roundText } from '../../core/series.js';

window.stopNmTimerHook = stopTimer;   // dipakai ui.js / local.js tanpa impor melingkar

// Menu Pengaturan. Offline (vs Komputer): MEMBUKA menu langsung menjeda permainan (bot & batas 15 detik berhenti);
// permainan lanjut lagi saat menekan "Lanjutkan". Online: permainan tidak bisa dijeda (pemain lain tetap main).
const $ = (id) => document.getElementById(id);

window.nmOpenMenu = () => {
    if (!S.roomData) return;
    // offline + sedang main: langsung pause
    if (S.localMode && S.roomData.status === 'playing' && !S.paused) { S.paused = true; clearTimeout(S.botTimer); pauseTimer(); }
    const rt = roundText();
    $('n-pause-title').textContent = 'Pengaturan';
    $('n-pause-note').textContent = S.localMode
        ? (rt ? rt + ' - permainan dijeda' : 'Permainan dijeda')
        : (rt ? rt + '. ' : '') + 'Permainan online tidak bisa dijeda; pemain lain tetap bermain.';
    $('n-btn-restart').classList.toggle('hidden', !S.localMode);
    $('nmResume-btn').textContent = S.localMode ? '▶ Lanjutkan' : '✕ Tutup';
    $('n-pause-modal').classList.remove('hidden');
};

// Tutup menu (offline: permainan dilanjutkan)
window.nmResume = () => {
    $('n-pause-modal').classList.add('hidden');
    if (S.localMode && S.paused) { S.paused = false; resumeTimer(); scheduleBot(); }
    S.paused = false;
};

window.nmExit = () => {
    $('n-pause-modal').classList.add('hidden');
    S.paused = false;
    S.series = null; S.lastRound = null;
    window.nmLeave();
};

// Mulai ulang = seri baru dari ronde 1 dengan jumlah ronde & lawan yang sama
window.nmRestart = () => {
    if (!S.localMode || !S.roomData) return;
    const n = S.roomData.players.length - 1;
    $('n-pause-modal').classList.add('hidden');
    S.paused = false;
    clearTimeout(S.botTimer);
    if (S.series) S.series = newSeries(S.series.total);
    S.lastRound = null;
    document.getElementById('bot-count').value = String(n);
    window.startNmLocal();
};
