// Pintu masuk mode UNO Show 'Em No Mercy: mendaftarkan diri ke beranda (vs Komputer dan online 2-6 pemain).
import './actions.js';
import './local.js';
import './pause.js';
import { registerMode } from '../../app/modes.js';
import { allCardSrcs, dealGame } from './deck.js';
import { handleGameOver, renderGame } from './ui.js';

// semua gambar No Mercy: dimuat penuh (layar "Memuat") sebelum permainan No Mercy pertama dimulai
function nmSrcs() {
    const srcs = allCardSrcs();                         // kartu, punggung, mercy.png, stack.png
    const C = ['Red', 'Yellow', 'Green', 'Blue'];
    ['skip', 'reverse', 'draw2', 'draw4', 'skipall', 'discardall', 'pass0', 'swap7', 'wildrev4', 'draw6', 'draw10', 'roulette'].forEach(k => C.forEach(c => srcs.push(`img/nomercy/fx/${k}-${c}.png`)));
    ['wildrev4', 'draw6', 'draw10', 'roulette'].forEach(k => srcs.push(`img/nomercy/fx/${k}.png`));   // cadangan kartu hitam
    srcs.push('img/nomercy/fx/wild-spin.png');
    C.forEach(c => srcs.push(`img/nomercy/fx/wild-${c}.png`));
    ['board', 'center', 'center-Red', 'center-Yellow', 'center-Green', 'center-Blue'].forEach(n => srcs.push(`img/nomercy/table/${n}.png`));
    ['hammer', 'uno', 'boom'].forEach(n => srcs.push(`img/effects/${n}.png`));
    ['frame-gold', 'frame-silver', 'direction', 'pause', 'logo-nomercy', 'settings', 'sound-on', 'sound-off'].forEach(n => srcs.push(`img/ui/${n}.png`));
    return srcs;
}

registerMode('nomercy', {
    assets: nmSrcs,
    startLocal(n) {
        document.getElementById('bot-count').value = String(n);
        window.startNmLocal();
    },
    // online: lobi + sinkron Firestore dipakai bersama lewat classic/online.js; blok ini memberi tahu layar, render, layar akhir, bagi kartu, dan keluar
    online: {
        screen: 'nm-screen', render: renderGame, gameOver: handleGameOver, deal: dealGame,
        leave: () => window.nmLeave()
    }
});
