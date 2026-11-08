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
        theme: 'red', logo: 'img/ui/logo-uno.png',
        art: ['img/cards/Yellow-2.png', 'img/cards/Green-3.png', 'img/cards/Blue-4.png', 'img/cards/Black-Wild.png'],
        bots: { min: 1, max: 5, def: 3 }
    },
    {
        id: 'flip', group: 'other', ready: true, online: false,
        name: 'UNO Flip',
        desc: 'Kartu dua sisi: terang dan gelap. Balik dek, ubah permainan!',
        theme: 'purple', logo: 'img/ui/logo-flip.png',
        art: ['img/flip/light/Yellow-2.png', 'img/flip/light/Green-3.png', 'img/flip/light/Blue-4.png', 'img/flip/dark/Orange-DrawFive.png', 'img/flip/dark/Teal-5.png'],
        bots: { min: 1, max: 5, def: 3 }
    }
];

const impl = {};
export const registerMode = (id, fns) => { impl[id] = fns; };
export const getMode = (id) => MODES.find(m => m.id === id);
export const getImpl = (id) => impl[id];
