// Daftar mode permainan. Menambah mode baru = tambah satu baris di MODES + daftarkan fungsi
// startLocal (vs Komputer) lewat registerMode() dari folder mode-nya (js/modes/<id>/index.js).
//   group: 'classic' = bagian "Klasik" di beranda, 'other' = bagian "Mode Lain"
//   ready: false -> kartu tampil redup dengan label "Segera hadir"
export const GROUPS = [
    { id: 'classic', title: 'Klasik' },
    { id: 'other', title: 'Mode Lain' }
];

export const MODES = [
    {
        id: 'classic', group: 'classic', ready: true,
        name: 'UNO Klasik',
        desc: 'Aturan klasik: cocokkan warna/angka, +2, +4, tantangan, dan UNO!',
        art: ['img/cards/Blue-4.png', 'img/cards/Black-Wild.png', 'img/cards/Red-DrawTwo.png'],
        bots: { min: 1, max: 5, def: 3 }
    },
    {
        id: 'flip', group: 'other', ready: true, online: false,
        name: 'UNO Flip',
        desc: 'Kartu dua sisi: terang dan gelap. Balik dek, ubah permainan! Pemenang = 500 poin.',
        art: ['img/flip/light/Blue-4.png', 'img/flip/dark/Black-Wild.png', 'img/flip/light/Red-Flip.png'],
        bots: { min: 1, max: 5, def: 3 }
    }
];

const impl = {};
export const registerMode = (id, fns) => { impl[id] = fns; };
export const getMode = (id) => MODES.find(m => m.id === id);
export const getImpl = (id) => impl[id];
