// Dek UNO All Wild: 112 kartu, SEMUA kartu hitam (Wild). Maks. 10 pemain. Aturan: MEMORI-UNO-BY-OMEGA.md bagian 6ac & 6ak.
// Kartu = { id, c: 'Black', v: nilai/efek, img }.  v: Wild | Skip | Reverse | Draw Two | Skip Two | Draw Four | Target Draw Two | Forced Swap
import { emptyState, esc } from '../../core/state.js';

export const COLORS = ['Red', 'Yellow', 'Green', 'Blue'];
export const NAMES = { Red: 'Merah', Yellow: 'Kuning', Green: 'Hijau', Blue: 'Biru', Black: 'Bebas' };
export const HEX = { Red: '#ef4444', Yellow: '#eab308', Green: '#22c55e', Blue: '#3b82f6' };

// [nilai, nama gambar, jumlah]  (komposisi ditetapkan pengguna 11 Nov, total 112)
export const DECK = [
    ['Wild', 'Black-Wild', 54], ['Skip', 'Black-WildSkip', 14], ['Reverse', 'Black-WildReverse', 14], ['Draw Two', 'Black-WildDrawTwo', 10],
    ['Skip Two', 'Black-WildSkipTwo', 6], ['Draw Four', 'Black-WildDrawFour', 6], ['Target Draw Two', 'Black-WildTargetDrawTwo', 4], ['Forced Swap', 'Black-WildForcedSwap', 4]
];
export const DECK_SIZE = 112;
export const MAX_PLAYERS = 10;

export const isWild = () => true;                                 // semua kartu hitam
export const isAction = (card) => card.v !== 'Wild';
export const needsTarget = (card) => card.v === 'Target Draw Two' || card.v === 'Forced Swap';
export const cardSrc = (card) => `img/allwild/${card.img}.png`;
export const backSrc = () => 'img/allwild/back.png';
export function allCardSrcs() { return [...DECK.map(d => `img/allwild/${d[1]}.png`), backSrc()]; }

// Poin kartu sisa (layar 'Total Skor'; sama dengan aturan opsional resmi): Wild biasa 20, kartu aksi 50.
export const pointOf = (card) => (card.v === 'Wild' ? 20 : 50);

export function buildDeck() {
    const out = [];
    DECK.forEach(([v, img, n]) => { for (let i = 0; i < n; i++) out.push({ id: out.length, c: 'Black', v, img }); });
    return out;
}

export function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
}

// Bagi 7 kartu. Kartu pertama dibuka apa adanya; bila kartu aksi, efeknya DIABAIKAN (aturan resmi). Warna awal acak.
export function dealGame(players) {
    const starter = Math.floor(Math.random() * players.length);   // pemain pertama DIACAK (bukan selalu pemain 1/host)
    const deck = buildDeck();
    shuffle(deck);
    const hands = {};
    players.forEach(p => { hands[p.uid] = []; });
    for (let i = 0; i < 7; i++) players.forEach(p => hands[p.uid].push(deck.pop()));
    const first = deck.pop();
    const state = {
        ...emptyState(), turnIndex: starter, discardPile: [first], hands, currentColor: COLORS[Math.floor(Math.random() * COLORS.length)],
        logs: [`Permainan dimulai! Giliran pertama: <b>${esc(players[starter].name)}</b> (diacak).`],
        fx: { id: 'deal' + Math.random().toString(36).slice(2), list: [{ t: 'deal' }] }
    };
    splitDeck(state, deck);
    return state;
}

export function splitDeck(state, cards) {
    const half = Math.ceil(cards.length / 2);
    state.deck = cards.slice(0, half);
    state.deckR = cards.slice(half);
}

// Ambil kartu. side 'L'/'R' = pilihan pemain; tanpa side = deck yang lebih banyak. Mengembalikan { cards, sides }.
// Jika dua deck kosong, tumpukan buangan (kecuali kartu teratas) dikocok dan dibagi lagi.
export function drawFrom(state, count, side) {
    if (!state.deckR) state.deckR = [];
    const cards = [], sides = [];
    for (let i = 0; i < count; i++) {
        if (state.deck.length === 0 && state.deckR.length === 0) {
            if (state.discardPile.length <= 1) break;
            const top = state.discardPile.pop();
            const rest = state.discardPile;
            shuffle(rest);
            state.discardPile = [top];
            splitDeck(state, rest);
            state.logs.push('Tumpukan dikocok ulang.');
        }
        let s = side;
        if (s !== 'L' && s !== 'R') s = state.deck.length >= state.deckR.length ? 'L' : 'R';
        if (s === 'L' && state.deck.length === 0) s = 'R';
        if (s === 'R' && state.deckR.length === 0) s = 'L';
        cards.push(s === 'L' ? state.deck.pop() : state.deckR.pop());
        sides.push(s);
    }
    return { cards, sides };
}
