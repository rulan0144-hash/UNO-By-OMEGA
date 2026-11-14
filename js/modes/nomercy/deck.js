// Dek UNO Show 'Em No Mercy: 168 kartu, DUA tumpukan ambil (kiri 'L' & kanan 'R', seperti mode lain), 2-6 pemain. Aturan: ATURAN-NOMERCY.md (bagian 6be-6bf MEMORI-UNO-BY-OMEGA.md).
// Kartu = { id, c: 'Red'|'Yellow'|'Green'|'Blue'|'Black', v, img }.
// v: '0'..'9' | Skip | Reverse | Draw Two | Draw Four | Discard All | Skip Everyone | Wild Reverse Draw Four | Wild Draw Six | Wild Draw Ten | Wild Color Roulette
import { emptyState, esc } from '../../core/state.js';

export const COLORS = ['Red', 'Yellow', 'Green', 'Blue'];
export const NAMES = { Red: 'Merah', Yellow: 'Kuning', Green: 'Hijau', Blue: 'Biru', Black: 'Bebas' };
export const HEX = { Red: '#ef4444', Yellow: '#eab308', Green: '#22c55e', Blue: '#3b82f6' };
export const MAX_PLAYERS = 6;
export const MERCY_LIMIT = 25;           // pegang 25 kartu atau lebih = tersingkir
export const KNOCKOUT_BONUS = 250;       // poin bonus per pemain tersingkir (skor opsional resmi)
export const DECK_SIZE = 168;

// [nilai, nama gambar, jumlah] per WARNA (36 kartu x 4 warna = 144)
const NUMS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
export const COLOR_DECK = [
    ...NUMS.map(n => [n, n, 2]),
    ['Skip', 'Skip', 3], ['Reverse', 'Reverse', 3], ['Draw Two', 'DrawTwo', 3], ['Draw Four', 'DrawFour', 2],
    ['Discard All', 'DiscardAll', 3], ['Skip Everyone', 'SkipEveryone', 2]
];
// Kartu hitam (24)
export const BLACK_DECK = [
    ['Wild Reverse Draw Four', 'WildReverseDrawFour', 8], ['Wild Draw Six', 'WildDrawSix', 4],
    ['Wild Draw Ten', 'WildDrawTen', 4], ['Wild Color Roulette', 'WildColorRoulette', 8]
];

export const DRAW_VALUE = { 'Draw Two': 2, 'Draw Four': 4, 'Wild Reverse Draw Four': 4, 'Wild Draw Six': 6, 'Wild Draw Ten': 10 };
export const isDrawCard = (card) => card.v in DRAW_VALUE;
export const drawValue = (card) => DRAW_VALUE[card.v] || 0;
export const isNumber = (card) => /^[0-9]$/.test(card.v);
export const isWild = (card) => card.c === 'Black';
export const needsColor = (card) => card.c === 'Black' && card.v !== 'Wild Color Roulette';   // pemain memilih warna (Roulette: korban yang memilih)
export const needsTarget = (card) => card.v === '7';
export const cardSrc = (card) => `img/nomercy/cards/${card.img}.png`;
export const backSrc = () => 'img/nomercy/back.png';
export function allCardSrcs() {
    const imgs = [];
    COLORS.forEach(c => COLOR_DECK.forEach(d => imgs.push(`img/nomercy/cards/${c}-${d[1]}.png`)));
    BLACK_DECK.forEach(d => imgs.push(`img/nomercy/cards/Black-${d[1]}.png`));
    return [...imgs, backSrc(), 'img/nomercy/fx/mercy.png'];
}

// Poin kartu sisa (skor opsional resmi): angka = nilai muka, aksi berwarna 20, aksi hitam 50.
export const pointOf = (card) => (isNumber(card) ? Number(card.v) : (card.c === 'Black' ? 50 : 20));

export function buildDeck() {
    const out = [];
    COLORS.forEach(c => COLOR_DECK.forEach(([v, name, n]) => { for (let i = 0; i < n; i++) out.push({ id: out.length, c, v, img: `${c}-${name}` }); }));
    BLACK_DECK.forEach(([v, name, n]) => { for (let i = 0; i < n; i++) out.push({ id: out.length, c: 'Black', v, img: `Black-${name}` }); });
    return out;
}

export function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
}

// Bagi 7 kartu. Kartu pembuka: bila kartu aksi/Wild, DIABAIKAN dan buka berikutnya (dikembalikan ke dasar dek). 0 dan 7 sebagai pembuka tanpa efek.
export function dealGame(players) {
    const starter = Math.floor(Math.random() * players.length);
    const deck = buildDeck();
    shuffle(deck);
    const hands = {};
    players.forEach(p => { hands[p.uid] = []; });
    for (let i = 0; i < 7; i++) players.forEach(p => hands[p.uid].push(deck.pop()));
    let first = deck.pop();
    while (!isNumber(first)) { deck.unshift(first); first = deck.pop(); }
    const state = {
        ...emptyState(), turnIndex: starter, deck: [], deckR: [], discardPile: [first], hands, currentColor: first.c,
        out: {}, setAside: [], pending: null, forced: null, winner: null,
        logs: [`Permainan dimulai! Giliran pertama: <b>${esc(players[starter].name)}</b> (diacak).`],
        fx: { id: 'deal' + Math.random().toString(36).slice(2), list: [{ t: 'deal' }] }
    };
    splitDeck(state, deck);
    return state;
}

// Bagi sisa kartu rata ke dua tumpukan ambil: kiri (state.deck) dan kanan (state.deckR).
export function splitDeck(state, cards) {
    const half = Math.ceil(cards.length / 2);
    state.deck = cards.slice(0, half);
    state.deckR = cards.slice(half);
}

// Ambil kartu. side 'L'/'R' = pilihan pemain; tanpa side = tumpukan yang isinya lebih banyak (jadi bergantian). Tumpukan pilihan kosong -> ambil dari yang lain.
// Bila KEDUA tumpukan habis: kocok buangan (kecuali kartu teratas) + tangan pemain tersingkir yang disisihkan, lalu bagi rata lagi.
// Mengembalikan { cards, sides } (sides[i] = 'L'|'R' tumpukan asal kartu ke-i, untuk animasi).
export function drawFrom(state, count, side) {
    if (!state.deckR) state.deckR = [];
    const cards = [], sides = [];
    for (let i = 0; i < count; i++) {
        if (state.deck.length === 0 && state.deckR.length === 0) {
            const rest = state.discardPile.length > 1 ? state.discardPile.splice(0, state.discardPile.length - 1) : [];
            const pool = rest.concat(state.setAside || []);
            state.setAside = [];
            if (!pool.length) break;
            shuffle(pool);
            splitDeck(state, pool);
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
