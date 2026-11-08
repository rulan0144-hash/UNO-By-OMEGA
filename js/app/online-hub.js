// Halaman Online: buat ruangan baru atau gabung dengan kode. Dipakai semua mode (S.mode = mode terpilih).
import { S } from '../core/state.js';
import { getMode } from './modes.js';
import { go } from './router.js';
import { updateOnlineStatus } from './profile.js';

window.openOnlineHub = (id) => {
    const m = getMode(id || S.mode);
    S.mode = m ? m.id : 'classic';
    document.getElementById('hub-mode').innerText = m ? m.name : '';
    document.getElementById('room-code-input').value = '';
    updateOnlineStatus();
    go('online-screen');
};

window.closeOnlineHub = () => go('home-screen');
