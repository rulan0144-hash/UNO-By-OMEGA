// Menyesuaikan ukuran profil/kartu lawan supaya SEMUA lawan (sampai 9) terlihat tanpa digeser ke kanan.
// - Sampai +-6 lawan: satu baris, ukuran mengecil sesuai lebar layar.
// - Lebih banyak: dua baris (mis. 5+4), ukuran mengecil supaya tinggi area atas tidak memakan meja.
// Hasilnya ditulis ke variabel CSS pada elemen area lawan (--ow lebar tiap profil, --os skala ukuran, --of faktor pengecilan)
// dan ke --top-h (tinggi baris atas) pada <html>, yang dipakai .row-top dan tombol menu.
import { getScale } from './config.js';

const AREAS = ['opponents-area', 'f-opps'];

export function fitOpponents(area) {
    if (!area) return;
    const row = area.closest('.row-top');
    const items = area.querySelectorAll('.opp-profile');
    const n = items.length;
    const s = getScale();
    const root = document.documentElement;
    if (!row || !n) { root.style.removeProperty('--top-h'); return; }
    const cs = getComputedStyle(row);
    const W = Math.max(120, row.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    const base = 62 * s;                                   // lebar satu profil pada ukuran penuh
    const rows = (n === 1 || W / n >= 0.88 * base) ? 1 : 2;
    const cols = Math.ceil(n / rows);
    const ow = Math.floor(W / cols);
    const fW = Math.min(1, ow / base);                     // batas dari lebar
    const fH = Math.min(1, 0.33 * window.innerHeight / (rows * 176 * s + 14 * s));   // batas dari tinggi
    const f = Math.max(0.5, Math.min(fW, fH));
    area.style.setProperty('--ow', ow + 'px');
    area.style.setProperty('--of', f.toFixed(3));
    area.style.setProperty('--os', (s * f).toFixed(3));
    root.style.setProperty('--top-h', Math.round(rows * 176 * s * f + 14 * s) + 'px');
}

const refit = () => AREAS.forEach(id => { const a = document.getElementById(id); if (a && a.offsetParent) fitOpponents(a); });
window.addEventListener('resize', () => requestAnimationFrame(refit));
window.addEventListener('orientationchange', () => setTimeout(refit, 250));
