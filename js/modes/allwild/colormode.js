// Pengaturan UNO All Wild: cara mengganti warna saat memainkan kartu Wild.
//   Otomatis = sistem memilih warna acak (selalu beda dari warna meja sekarang)
//   Manual   = pemain memilih sendiri lewat kotak "Pilih Warna"
// Disimpan per perangkat di localStorage['uno_aw_color_mode']. Aturan permainan & data Firestore tidak berubah:
// warna tetap dikirim sebagai bagian dari kartu yang dimainkan, jadi semua pemain online melihat hal yang sama.
import { COLORS } from './deck.js';

const KEY = 'uno_aw_color_mode';
const NOTE = {
    auto: 'Sistem memilih warna acak, meja langsung berganti warna.',
    manual: 'Kamu memilih warna sendiri setiap memainkan kartu.'
};

export function awColorMode() {
    try { return localStorage.getItem(KEY) === 'manual' ? 'manual' : 'auto'; } catch (e) { return 'auto'; }
}

// Warna acak yang berbeda dari warna meja sekarang (supaya perubahan terlihat)
export function autoColor(current) {
    const pool = COLORS.filter(c => c !== current);
    return pool[Math.floor(Math.random() * pool.length)];
}

// Menandai tombol yang aktif di semua panel pengaturan (beranda + menu dalam game)
export function paintColorMode() {
    const m = awColorMode();
    document.querySelectorAll('.aw-cm-btn').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    document.querySelectorAll('.aw-cm-note').forEach(n => { n.textContent = NOTE[m]; });
}

window.awSetColorMode = (m) => {
    try { localStorage.setItem(KEY, m === 'manual' ? 'manual' : 'auto'); } catch (e) { /* penyimpanan diblokir: pilihan hanya berlaku sampai halaman dimuat ulang */ }
    paintColorMode();
};

paintColorMode();
