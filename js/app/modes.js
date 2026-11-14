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
        theme: 'red', logo: 'img/ui/logo-uno.png', tag: 'Cocokkan, tantang, teriak UNO!', badge: 'img/ui/badge-players.png',
        art: ['img/cards/Yellow-2.png', 'img/cards/Green-3.png', 'img/cards/Blue-4.png', 'img/cards/Black-Wild.png'],
        bots: { min: 1, max: 9, def: 3 }
    },
    {
        id: 'flip', group: 'other', ready: true,
        name: 'UNO Flip',
        desc: 'Kartu dua sisi: terang dan gelap. Balik dek, ubah permainan!',
        theme: 'purple', logo: 'img/ui/logo-flip.png', tag: 'Balik dek, ubah permainan!', badge: 'img/ui/badge-players-flip.png',
        art: ['img/flip/light/Yellow-2.png', 'img/flip/light/Green-3.png', 'img/flip/light/Blue-4.png', 'img/flip/dark/Orange-DrawFive.png', 'img/flip/dark/Teal-5.png'],
        bots: { min: 1, max: 9, def: 3 }
    },
    {
        id: 'flex', group: 'other', ready: true,
        name: 'UNO Flex',
        desc: 'Kartu bisa "flex": ubah warna dengan Power Card, kartu aksi punya sisi kedua!',
        theme: 'green', logo: 'img/ui/logo-flex.png', tag: 'Fleksibel, gunakan dua sisi!', badge: 'img/ui/badge-players-flex.png',
        art: ['img/flex/cards/Yellow-2-FlexGreen.png', 'img/flex/cards/Blue-1-FlexRed.png', 'img/flex/cards/Red-6-FlexGreen.png', 'img/flex/cards/Green-Reverse-Flex.png', 'img/flex/cards/Black-WildFlexTargetDraw2.png'],
        bots: { min: 1, max: 7, def: 3 }
    },
    {
        id: 'allwild', group: 'other', ready: true,
        name: 'UNO All Wild',
        desc: 'Semua kartu adalah Wild: tidak perlu cocok warna atau angka, pilih warna tiap giliran!',
        theme: 'allwild', logo: 'img/ui/logo-allwild.png', tag: 'Semua kartu adalah Wild!', badge: 'img/ui/badge-players-allwild.png',
        art: ['img/allwild/Black-Wild.png', 'img/allwild/Black-WildSkip.png', 'img/allwild/Black-WildDrawTwo.png', 'img/allwild/Black-WildForcedSwap.png', 'img/allwild/Black-WildDrawFour.png'],
        bots: { min: 1, max: 9, def: 3 }
    },
    {
        id: 'nomercy', group: 'other', ready: false,
        name: "UNO Show 'Em No Mercy",
        desc: 'Brutal dan tanpa ampun: tumpuk Draw sampai +10, buang semua warna, dan tersingkir bila memegang 25 kartu!',
        theme: 'nomercy', logo: 'img/ui/logo-nomercy.png', tag: 'Brutal. Kejam. Tanpa ampun.', badge: 'img/ui/badge-players-nomercy.png',
        art: ['img/nomercy/cards/Yellow-DrawTwo.png', 'img/nomercy/cards/Black-WildReverseDrawFour.png', 'img/nomercy/cards/Blue-SkipEveryone.png', 'img/nomercy/cards/Red-DiscardAll.png', 'img/nomercy/cards/Black-WildDrawTen.png'],
        bots: { min: 1, max: 5, def: 3 }
    }
];

const impl = {};
export const registerMode = (id, fns) => { impl[id] = fns; };
export const getMode = (id) => MODES.find(m => m.id === id);
export const getImpl = (id) => impl[id];
