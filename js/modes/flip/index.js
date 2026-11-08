// Pintu masuk mode UNO Flip: mendaftarkan diri ke beranda (vs Komputer dan online).
import './actions.js';
import './local.js';
import './pause.js';
import { registerMode } from '../../app/modes.js';
import { allCardSrcs, dealGame } from './deck.js';
import { handleGameOver, renderGame } from './ui.js';

// semua gambar Flip: dimuat penuh (layar "Memuat") sebelum permainan Flip pertama dimulai, supaya beranda tetap ringan
function flipSrcs() {
    const srcs = allCardSrcs();
    const L = ['Red', 'Yellow', 'Green', 'Blue'], D = ['Pink', 'Teal', 'Orange', 'Purple'];
    L.concat(D).forEach(c => ['skip', 'reverse'].forEach(k => srcs.push(`img/flip/fx/${k}-${c}.png`)));
    L.forEach(c => ['draw1', 'draw2'].forEach(k => srcs.push(`img/flip/fx/${k}-${c}.png`)));
    D.forEach(c => ['draw5', 'wdc', 'skipall'].forEach(k => srcs.push(`img/flip/fx/${k}-${c}.png`)));
    D.forEach(c => srcs.push(`img/flip/fx/wild-${c}.png`));
    srcs.push('img/flip/fx/flip-light.png', 'img/flip/fx/flip-dark.png', 'img/flip/fx/wild-spin-dark.png');
    ['aura', 'cloud-day', 'cloud-night', 'clouds', 'eyes', 'fog', 'night', 'sky-day'].forEach(n => srcs.push(`img/flip/table/${n}.png`));
    ['wild-spin', 'wild-Red', 'wild-Green', 'wild-Blue', 'wild-Yellow', 'hammer', 'uno', 'boom'].forEach(n => srcs.push(`img/effects/${n}.png`));
    ['frame-gold', 'frame-silver', 'direction', 'pause', 'logo-flip', 'settings', 'sound-on', 'sound-off'].forEach(n => srcs.push(`img/ui/${n}.png`));
    return srcs;
}

registerMode('flip', {
    assets: flipSrcs,
    startLocal(n) {
        document.getElementById('bot-count').value = String(n);
        window.startFlipLocal();
    },
    // online: memakai lobi & Firestore bersama dari classic/online.js (ruangan bermode 'flip')
    online: {
        screen: 'flip-screen', render: renderGame, gameOver: handleGameOver, deal: dealGame,
        leave: () => window.flipLeave()
    }
});
