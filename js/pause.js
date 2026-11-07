import { S } from './state.js';
import { pauseTimer, resumeTimer, stopTimer } from './timer.js';

window.stopTimerHook = stopTimer;   // dipakai ui.js / local.js tanpa impor melingkar
import { scheduleBot } from './local.js';

// Menu jeda. Offline (vs Komputer): permainan benar-benar berhenti (bot & batas 15 detik).
// Online: permainan tidak bisa dijeda (pemain lain tetap main), menu hanya untuk keluar.
const $ = (id) => document.getElementById(id);

window.openMenu = () => {
    if (!S.roomData) return;
    S.paused = !!S.localMode;
    $('pause-title').textContent = S.localMode ? 'Jeda' : 'Menu';
    $('pause-note').textContent = S.localMode ? '' : 'Permainan online tidak bisa dijeda; pemain lain tetap bermain.';
    $('btn-restart').classList.toggle('hidden', !S.localMode);
    $('pause-modal').classList.remove('hidden');
    if (S.localMode) { clearTimeout(S.botTimer); pauseTimer(); }
};

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
