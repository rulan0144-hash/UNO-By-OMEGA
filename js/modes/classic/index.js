// Pintu masuk mode UNO Klasik: mendaftarkan diri ke beranda.
import './actions.js';
import './local.js';
import './online.js';
import './pause.js';
import { registerMode } from '../../app/modes.js';

registerMode('classic', {
    // main vs Komputer dengan n lawan
    startLocal(n) {
        document.getElementById('bot-count').value = String(n);
        window.startLocal();
    }
    // online: createRoom / joinRoom (window.*) dipanggil dari halaman online
});
