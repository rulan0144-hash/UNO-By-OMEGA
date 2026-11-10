// Seri RONDE: dipakai bersama semua mode (Klasik, Flip, Flex) dan offline maupun online.
//  - Offline : seri disimpan di S.series = { total, round, history: [{w, p}] }
//  - Online  : disimpan di dokumen ruangan: rounds (total, dipilih host di lobi), round (ronde berjalan), history
//  w = uid pemenang ronde, p = poin ronde itu (jumlah poin kartu sisa lawan).
// Papan skor = riwayat + hasil ronde yang baru selesai (dihitung ulang tiap kali, jadi aman dipanggil berulang).
import { S, esc } from './state.js';

export const ROUND_CHOICES = [1, 3, 5, 7, 10];
export const newSeries = (total) => ({ total: Math.max(1, Math.min(10, parseInt(total) || 1)), round: 1, history: [] });

export function seriesInfo() {
    if (S.localMode) return S.series || newSeries(1);
    const r = S.roomData || {};
    return { total: r.rounds || 1, round: r.round || 1, history: r.history || [] };
}

// "Ronde 2 dari 5" (kosong bila hanya 1 ronde)
export function roundText() {
    const i = seriesInfo();
    return i.total > 1 ? `Ronde ${i.round} dari ${i.total}` : '';
}

export function standings(info, last) {
    const rows = {};
    S.roomData.players.forEach(p => { rows[p.uid] = { uid: p.uid, name: p.name, wins: 0, pts: 0 }; });
    const add = (r) => { if (r && rows[r.w]) { rows[r.w].wins++; rows[r.w].pts += r.p || 0; } };
    info.history.forEach(add);
    add(last);
    return Object.values(rows).sort((a, b) => b.pts - a.pts || b.wins - a.wins);
}

// Mengisi bagian "seri ronde" + tombol di layar akhir permainan.
// prefix = '' (Klasik), 'f-' (Flip), 'x-' (Flex): id elemen `${prefix}over-series` dan `${prefix}over-actions`.
export function fillOver(prefix, winnerUid, pts) {
    const info = seriesInfo();
    const last = { w: winnerUid, p: pts || 0 };
    S.lastRound = last;
    const final = info.round >= info.total;
    const box = document.getElementById(prefix + 'over-series');
    const act = document.getElementById(prefix + 'over-actions');
    if (!box || !act) return;

    if (info.total > 1) {
        const rows = standings(info, last);
        const best = rows[0];
        const champs = final ? rows.filter(r => r.pts === best.pts && r.wins === best.wins) : [];
        box.innerHTML =
            `<div class="ov-round">${final ? `Ronde ${info.round} dari ${info.total} selesai - Hasil Akhir` : `Ronde ${info.round} dari ${info.total} selesai`}</div>` +
            (final ? `<div class="ov-champ">Juara: ${champs.map(c => esc(c.name)).join(' & ')}</div>` : '') +
            `<div class="ov-board">` + rows.map((r, i) =>
                `<div class="ov-row ${final && champs.includes(r) ? 'ov-top' : ''}"><span class="ov-rank">${i + 1}</span><span class="ov-name">${esc(r.name)}</span><span class="ov-win">${r.wins} menang</span><span class="ov-pts">${r.pts} poin</span></div>`).join('') + `</div>`;
        box.classList.remove('hidden');
    } else {
        box.innerHTML = '';
        box.classList.add('hidden');
    }

    const isHost = S.localMode || (S.roomData.hostId === (S.currentUser && S.currentUser.uid));
    let h = '';
    if (isHost) {
        h += final
            ? `<button class="over-btn" onclick="playAgain()">Main Lagi</button>`
            : `<button class="over-btn" onclick="nextRound()">Lanjut ke Ronde ${info.round + 1}</button>`;
    } else {
        h += `<p class="ov-wait">${final ? 'Menunggu host memulai permainan baru...' : 'Menunggu host memulai ronde berikutnya...'}</p>`;
    }
    h += `<button class="over-btn over-btn-alt" onclick="goHome()">Kembali ke Beranda</button>`;
    act.innerHTML = h;
}
