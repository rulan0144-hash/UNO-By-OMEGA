import { S } from '../../core/state.js';
import { NAMES } from './deck.js';
import { whenIdle } from './animations.js';
import { isMyTurn } from './rules.js';

// Kotak jawaban saat ada Wild Draw Two / Wild Draw Color yang menunggu: Ambil Kartu / Tantang

export function hideChallenge() {
    const m = document.getElementById('f-challenge-modal');
    if (m) m.classList.add('hidden');
}

// Dipanggil setiap renderGame(). Kotak baru muncul setelah semua animasi selesai.
export function syncChallenge(state) {
    const need = !!state.pending && S.roomData.status === 'playing' && isMyTurn();
    if (!need) { hideChallenge(); return; }
    whenIdle().then(() => {
        if (!S.roomData || S.roomData.status !== 'playing') return;
        const st = S.roomData.gameState, p = st.pending;
        if (!p || !isMyTurn()) return;
        const by = S.roomData.players.find(x => x.uid === p.by);
        document.getElementById('f-ch-name').textContent = by ? by.name : '?';
        const col = document.getElementById('f-ch-color');
        col.textContent = NAMES[p.prevColor] || p.prevColor;
        col.className = 'ch-color ch-' + p.prevColor;
        const wdc = p.type === 'wdc';
        document.getElementById('f-ch-draw').textContent = wdc ? `Ambil sampai ${NAMES[p.color]}` : `Ambil ${p.total} Kartu`;
        document.getElementById('f-ch-note').textContent = wdc
            ? `Benar: kamu +0  |  Salah: kamu ambil sampai ${NAMES[p.color]} + 2`
            : `Benar: kamu +0  |  Salah: kamu +${p.total + 2}`;
        document.getElementById('f-challenge-modal').classList.remove('hidden');
    });
}
