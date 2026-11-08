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
    ['draw2', 'draw4', 'skip', 'reverse', 'shuffle', 'uno', 'wild-spin', 'wild-Red', 'wild-Green', 'wild-Blue', 'wild-Yellow', 'hammer', 'boom']
        .forEach(n => srcs.push(`img/effects/${n}.png`));
    ['draw2', 'draw4', 'skip', 'reverse'].forEach(k => COLORS.forEach(c => srcs.push(`img/effects/${k}-${c}.png`)));
    ['frame-gold', 'frame-silver', 'direction', 'pause', 'logo-uno', 'settings', 'sound-on', 'sound-off'].forEach(n => srcs.push(`img/ui/${n}.png`));
    srcs.forEach(s => { new Image().src = s; });
}

// ---- Skala tampilan: semua ukuran kartu/profil mengikuti ukuran jendela (variabel CSS --s) ----
export function getScale() { return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--s')) || 1; }
export function applyScale() {
    const h = window.innerHeight, w = window.innerWidth;
    const s = Math.max(0.42, Math.min(1.2, (h - 20) / 830, w / 360));
    document.documentElement.style.setProperty('--s', s.toFixed(3));
    document.documentElement.style.setProperty('--app-h', h + 'px');   // 100vh di Chrome HP lebih tinggi dari layar terlihat
    document.documentElement.classList.toggle('compact', s < 0.65);   // jendela sangat kecil: sembunyikan info tambahan
}
