// Titik masuk aplikasi: memuat modul, menyambung ke server, lalu menampilkan beranda.
import './core/sound.js';
import './app/profile.js';
import './app/settings.js';
import './app/online-hub.js';
import './modes/classic/index.js';
import './modes/flip/index.js';       // tiap mode baru: tambahkan import './modes/<id>/index.js' di sini
import { sfx } from './core/sound.js';
import { preloadCards, applyScale } from './core/config.js';
import { S } from './core/state.js';
import { auth, hasFirebase, initialAuthToken, signInAnonymously, signInWithCustomToken } from './core/firebase.js';
import { updateHomeName, updateOnlineStatus } from './app/profile.js';
import { renderHome } from './app/home.js';
import { go } from './app/router.js';

preloadCards();   // muat semua gambar lebih dulu
// bunyi "klik" untuk semua tombol (kecuali tombol suara, yang punya bunyi sendiri)
document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('button'); if (b && !b.dataset.nosfx) sfx('click'); });
applyScale();
window.addEventListener('resize', applyScale);
window.addEventListener('orientationchange', applyScale);

// --- AUTH (tidak lagi macet jika Firebase belum dikonfigurasi) ---
async function initAuth() {
    if (hasFirebase) {
        try {
            const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000));
            const login = initialAuthToken ? signInWithCustomToken(auth, initialAuthToken) : signInAnonymously(auth);
            await Promise.race([login, timeout]);
            S.fbUser = auth.currentUser;
        } catch (err) { console.error("Firebase gagal:", err); }
    }
    document.getElementById('loading-screen').classList.add('hidden');
    renderHome();
    updateHomeName();
    updateOnlineStatus();
    go(S.myName ? 'home-screen' : 'login-screen');
}
initAuth();
