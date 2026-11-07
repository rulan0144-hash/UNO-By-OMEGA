export const COLORS = ['Red', 'Green', 'Blue', 'Yellow'];

export const COLOR_NAMES = { 'Red': 'Merah', 'Green': 'Hijau', 'Blue': 'Biru', 'Yellow': 'Kuning' };

export const ACTIONS = ['Skip', 'Reverse', 'Draw Two'];

export const LOCAL_UID = 'local-me';

// Gambar kartu (PNG) ada di folder img/cards/, mis. Red-5.png, Red-DrawTwo.png, Black-Wild.png, back.png
export const BACK_SRC = 'img/cards/back.png';
export const cardSrc = (card) => `img/cards/${card.color}-${card.value.replace(/ /g, '')}.png`;
export const imgTag = (src) => `<img class="card-img" src="${src}" alt="" draggable="false">`;

// Muat semua gambar lebih dulu supaya tidak berkedip saat pertama tampil
export function preloadCards() {
    const srcs = [BACK_SRC];
    COLORS.forEach(c => {
        for (let n = 0; n <= 9; n++) srcs.push(`img/cards/${c}-${n}.png`);
        ACTIONS.forEach(a => srcs.push(`img/cards/${c}-${a.replace(/ /g, '')}.png`));
    });
    ['Wild', 'WildDrawFour', 'WildShuffleHands'].forEach(n => srcs.push(`img/cards/Black-${n}.png`));
    srcs.forEach(s => { new Image().src = s; });
}
