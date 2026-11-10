import { sfx } from './sound.js';
import { roundText } from './series.js';

// Hitung mundur 5 detik di awal permainan: piringan emas TEPAT di tengah layar (angka di dalam piringan, cincin waktu
// menyusut tiap detik, tulisan "Mulai!" di akhir). Berjalan BERSAMA animasi pembagian kartu (keduanya ~5 detik).
// cancelled() mengembalikan true jika permainan diulang / ditinggalkan, supaya hitungan berhenti.
export async function runCountdown(cancelled) {
    const el = document.createElement('div');
    el.className = 'f-countdown';
    el.innerHTML = '<div class="cd-disc"><div class="cd-ring"></div><div class="cd-num"></div></div><div class="cd-label">' + (roundText() ? '<div class="cd-round">' + roundText() + '</div>' : '') + 'Permainan dimulai dalam</div>';
    document.body.appendChild(el);
    const disc = el.querySelector('.cd-disc'), num = el.querySelector('.cd-num'), ring = el.querySelector('.cd-ring');
    const restart = (node) => { node.style.animation = 'none'; void node.offsetWidth; node.style.animation = ''; };
    for (let n = 5; n >= 1; n--) {
        if (cancelled()) break;
        num.textContent = n;
        disc.classList.toggle('cd-last', n === 1);
        restart(num); restart(ring);
        sfx(n === 1 ? 'cdLast' : 'cdTick');
        await new Promise(r => setTimeout(r, 1000));
    }
    if (!cancelled()) {
        el.classList.add('cd-end');
        num.textContent = 'Mulai!';
        disc.classList.add('cd-go');
        restart(num);
        await new Promise(r => setTimeout(r, 650));
    }
    el.remove();
}
