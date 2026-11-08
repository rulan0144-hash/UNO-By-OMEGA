// Pintu masuk mode UNO Flip: mendaftarkan diri ke beranda. Saat ini hanya vs Komputer (offline).
import './actions.js';
import './local.js';
import './pause.js';
import { registerMode } from '../../app/modes.js';
import { allCardSrcs } from './deck.js';

// muat semua gambar Flip sekali saat pertama dimainkan (supaya beranda tetap ringan)
let preloaded = false;
function preloadFlip() {
    if (preloaded) return;
    preloaded = true;
    const srcs = allCardSrcs();
    const L = ['Red', 'Yellow', 'Green', 'Blue'], D = ['Pink', 'Teal', 'Orange', 'Purple'];
    L.concat(D).forEach(c => ['skip', 'reverse'].forEach(k => srcs.push(`img/flip/fx/${k}-${c}.png`)));
    L.forEach(c => ['draw1', 'draw2'].forEach(k => srcs.push(`img/flip/fx/${k}-${c}.png`)));
    D.forEach(c => ['draw5', 'wdc', 'skipall'].forEach(k => srcs.push(`img/flip/fx/${k}-${c}.png`)));
    D.forEach(c => srcs.push(`img/flip/fx/wild-${c}.png`));
    srcs.push('img/flip/fx/flip-light.png', 'img/flip/fx/flip-dark.png', 'img/flip/fx/wild-spin-dark.png');
    srcs.forEach(s => { new Image().src = s; });
}

registerMode('flip', {
    startLocal(n) {
        preloadFlip();
        document.getElementById('bot-count').value = String(n);
        window.startFlipLocal();
    }
});
