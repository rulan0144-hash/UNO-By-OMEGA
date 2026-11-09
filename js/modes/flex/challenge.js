import { S } from '../../core/state.js';
import { NAMES } from './deck.js';
import { whenIdle } from './animations.js';
import { isMyAction } from './rules.js';

// Kotak jawaban saat ada Wild Draw 4 yang menunggu: Ambil 4 Kartu / Tantang. Muncul hanya untuk pemain yang menjawab (pending.answerer:
// pemain berikutnya pada sisi biasa, pemain yang DITUNJUK pada sisi flex).
export function hideChallenge() {
    const m = document.getElementById('x-challenge-modal');
    if (m) m.classList.add('hidden');
}

// Dipanggil setiap renderGame(). Kotak baru muncul setelah semua animasi selesai.
export function syncChallenge(state) {
    const need = !!state.pending && S.roomData.status === 'playing' && isMyAction();
    if (!need) { hideChallenge(); return; }
    whenIdle().then(() => {
        if (!S.roomData || S.roomData.status !== 'playing') return;
        const st = S.roomData.gameState, p = st.pending;
        if (!p || !isMyAction()) return;
        const by = S.roomData.players.find(x => x.uid === p.by);
        document.getElementById('x-ch-name').textContent = by ? by.name : '?';
        const col = document.getElementById('x-ch-color');
        col.textContent = NAMES[p.prevColor] || p.prevColor;
        col.className = 'ch-color ch-' + p.prevColor;
        document.getElementById('x-ch-draw').textContent = `Ambil ${p.total} Kartu`;
        document.getElementById('x-ch-note').textContent = `Benar: kamu +0  |  Salah: kamu +${p.total + 2}` + (p.flex ? '  (kamu ditunjuk)' : '');
        document.getElementById('x-challenge-modal').classList.remove('hidden');
    });
}
