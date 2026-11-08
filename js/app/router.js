// Navigasi antar layar. Setiap layar adalah satu <section> di index.html; hanya satu yang tampil.
// Menambah layar baru (mis. layar game mode lain): daftarkan id-nya di SCREENS.
export const SCREENS = ['login-screen', 'home-screen', 'online-screen', 'lobby-screen', 'game-screen'];

export function go(id) {
    SCREENS.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.toggle('hidden', s !== id);
    });
    const next = document.getElementById(id);
    if (next) next.scrollTop = 0;
}
window.go = go;
