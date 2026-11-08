import { S } from '../../core/state.js';
import { COLOR_NAMES } from '../../core/config.js';
import { whenIdle } from './animations.js';
import { isMyTurn } from './rules.js';

// Kotak jawaban saat ada kartu +4 yang menunggu: Ambil Kartu / Tantang

export function hideChallenge() {
    const m = document.getElementById('challenge-modal');
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
        document.getElementById('ch-name').textContent = by ? by.name : '?';
        const col = document.getElementById('ch-color');
        col.textContent = COLOR_NAMES[p.prevColor] || p.prevColor;
        col.className = 'ch-color ch-' + p.prevColor;
        document.getElementById('ch-draw').textContent = `Ambil ${p.total} Kartu`;
        document.getElementById('ch-note').textContent = `Benar: kamu +0  |  Salah: kamu +${p.total + 2}`;
        document.getElementById('challenge-modal').classList.remove('hidden');
    });
}
