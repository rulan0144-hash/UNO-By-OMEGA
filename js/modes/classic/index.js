// Pintu masuk mode UNO Klasik: mendaftarkan diri ke beranda.
import './actions.js';
import './local.js';
import './online.js';
import './pause.js';
import { registerMode } from '../../app/modes.js';
import { classicSrcs } from '../../core/config.js';
import { dealGame } from './deck.js';
import { handleGameOver, renderGame } from './ui.js';

registerMode('classic', {
    // main vs Komputer dengan n lawan
    assets: () => classicSrcs(),   // dimuat penuh sebelum main (core/loader.js)
    startLocal(n) {
        document.getElementById('bot-count').value = String(n);
        window.startLocal();
    }
    // online: createRoom / joinRoom / startGame / leaveLobby (window.*, di online.js) dipakai semua mode lewat data ini
    ,
    online: { screen: 'game-screen', render: renderGame, gameOver: handleGameOver, deal: dealGame, leave: () => window.leaveRoom() }
});
