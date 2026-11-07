// Titik masuk aplikasi: memuat semua modul lalu menyambung ke server.
import './actions.js';
import './local.js';
import './online.js';
import { preloadCards } from './config.js';

preloadCards();   // muat semua gambar kartu lebih dulu
import { S } from './state.js';
import { auth, hasFirebase, initialAuthToken, signInAnonymously, signInWithCustomToken } from './firebase.js';
import { updateHomeName, updateOnlineStatus } from './ui.js';

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
    document.getElementById(S.myName ? 'home-screen' : 'login-screen').classList.remove('hidden');
    updateHomeName();
    updateOnlineStatus();
}
initAuth();
