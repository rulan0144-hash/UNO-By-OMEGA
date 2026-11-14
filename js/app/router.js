// Navigasi antar layar. Setiap layar adalah satu <section> di index.html; hanya satu yang tampil.
// Menambah layar baru (mis. layar game mode lain): daftarkan id-nya di SCREENS.
import { startMusic } from '../core/sound.js';

export const SCREENS = ['login-screen', 'home-screen', 'online-screen', 'lobby-screen', 'game-screen', 'flip-screen', 'flex-screen', 'aw-screen', 'nm-screen'];

export function go(id) {
    SCREENS.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.toggle('hidden', s !== id);
    });
    if (id !== 'game-screen' && id !== 'flip-screen' && id !== 'flex-screen' && id !== 'aw-screen' && id !== 'nm-screen') startMusic('menu');   // beranda/online/lobi: lagu menu; lagu game dimulai oleh mode saat permainan berjalan
    const next = document.getElementById(id);
    if (next) next.scrollTop = 0;
}
window.go = go;
