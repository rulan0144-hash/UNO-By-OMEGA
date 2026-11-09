// Pintu masuk mode UNO Flex: mendaftarkan diri ke beranda (vs Komputer). Online menyusul (blok `online` seperti Flip).
import './actions.js';
import './local.js';
import './pause.js';
import { registerMode } from '../../app/modes.js';
import { allCardSrcs } from './deck.js';

// semua gambar Flex: dimuat penuh (layar "Memuat") sebelum permainan Flex pertama dimulai
function flexSrcs() {
    const srcs = allCardSrcs();
    const C = ['Red', 'Yellow', 'Green', 'Blue'];
    ['draw2', 'skip', 'reverse', 'draw4', 'draw1all', 'skipall', 'revskip', 'alldraw2', 'target2', 'target4', 'wild'].forEach(k => C.forEach(c => srcs.push(`img/flex/fx/${k}-${c}.png`)));
    ['flip-GoStop', 'flip-StopGo', 'wild-spin'].forEach(n => srcs.push(`img/flex/fx/${n}.png`));
    ['board', 'center'].forEach(n => srcs.push(`img/flex/table/${n}.png`));
    ['hammer', 'uno', 'boom'].forEach(n => srcs.push(`img/effects/${n}.png`));
    ['frame-gold', 'frame-silver', 'direction', 'pause', 'logo-flex', 'settings', 'sound-on', 'sound-off'].forEach(n => srcs.push(`img/ui/${n}.png`));
    return srcs;
}

registerMode('flex', {
    assets: flexSrcs,
    startLocal(n) {
        document.getElementById('bot-count').value = String(n);
        window.startFlexLocal();
    }
});
