import { sfx } from './sound.js';

// Hitung mundur 5 detik di awal permainan. Berjalan BERSAMA animasi pembagian kartu (keduanya ~5 detik).
// cancelled() mengembalikan true jika permainan diulang / ditinggalkan, supaya hitungan berhenti.
export async function runCountdown(cancelled) {
    const el = document.createElement('div');
    el.className = 'f-countdown';
    el.innerHTML = '<div class="cd-label">Permainan dimulai dalam</div><div class="cd-num"></div>';
    document.body.appendChild(el);
    const num = el.querySelector('.cd-num');
    for (let n = 5; n >= 1; n--) {
        if (cancelled()) break;
        num.textContent = n;
        num.style.animation = 'none'; void num.offsetWidth; num.style.animation = '';
        sfx(n === 1 ? 'cdLast' : 'cdTick');
        await new Promise(r => setTimeout(r, 1000));
    }
    el.remove();
}
