// Pintu masuk mode UNO All Wild: mendaftarkan diri ke beranda (vs Komputer dan online).
import './actions.js';
import './local.js';
import './pause.js';
import { registerMode } from '../../app/modes.js';
import { allCardSrcs, dealGame } from './deck.js';
import { handleGameOver, renderGame } from './ui.js';

// semua gambar All Wild: dimuat penuh (layar "Memuat") sebelum permainan All Wild pertama dimulai
function awSrcs() {
    const srcs = allCardSrcs();
    const C = ['Red', 'Yellow', 'Green', 'Blue'];
    ['draw2', 'draw4', 'skip', 'skip2', 'reverse', 'swap', 'target2', 'wild'].forEach(k => C.forEach(c => srcs.push(`img/allwild/fx/${k}-${c}.png`)));
    srcs.push('img/allwild/fx/wild-spin.png');
    ['board', 'center', 'center-Red', 'center-Yellow', 'center-Green', 'center-Blue'].forEach(n => srcs.push(`img/allwild/table/${n}.png`));
    ['hammer', 'uno', 'boom'].forEach(n => srcs.push(`img/effects/${n}.png`));
    ['frame-gold', 'frame-silver', 'direction', 'pause', 'logo-allwild', 'settings', 'sound-on', 'sound-off'].forEach(n => srcs.push(`img/ui/${n}.png`));
    return srcs;
}

registerMode('allwild', {
    assets: awSrcs,
    startLocal(n) {
        document.getElementById('bot-count').value = String(n);
        window.startAwLocal();
    },
    // online: memakai lobi & Firestore bersama dari classic/online.js (ruangan bermode 'allwild', maks. 10 pemain)
    online: {
        screen: 'aw-screen', render: renderGame, gameOver: handleGameOver, deal: dealGame,
        leave: () => window.awLeave()
    }
});
