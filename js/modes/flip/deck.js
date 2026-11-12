// Dek UNO Flip: 112 kartu fisik, tiap kartu punya sisi terang (l) dan sisi gelap (d).
import { PAIRS } from './data.js';
import { emptyState, esc } from '../../core/state.js';

export const LIGHT = ['Red', 'Yellow', 'Green', 'Blue'];
export const DARK = ['Pink', 'Teal', 'Orange', 'Purple'];
export const COLORS_OF = (side) => side === 'dark' ? DARK : LIGHT;
export const NAMES = { Red: 'Merah', Yellow: 'Kuning', Green: 'Hijau', Blue: 'Biru', Pink: 'Merah Muda', Teal: 'Hijau Tosca', Orange: 'Oranye', Purple: 'Ungu', Black: 'Bebas' };
export const HEX = { Red: '#ef4444', Yellow: '#eab308', Green: '#22c55e', Blue: '#3b82f6', Pink: '#ec4899', Teal: '#14b8a6', Orange: '#f97316', Purple: '#a855f7' };

export const oppSide = (s) => s === 'dark' ? 'light' : 'dark';
export const face = (card, side) => side === 'dark' ? card.d : card.l;
export const isNum = (f) => /^\d$/.test(f.value);
// gambar kartu: img/flip/<terang|gelap>/<Warna>-<nilai tanpa spasi>.png
export const cardSrc = (card, side) => { const f = face(card, side); return `img/flip/${side}/${f.color}-${f.value.replace(/ /g, '')}.png`; };
export const imgTag = (src) => `<img class="card-img" src="${src}" alt="" draggable="false">`;
// semua gambar kartu (untuk preload)
export function allCardSrcs() {
    const out = [];
    PAIRS.forEach(p => { const c = { l: { color: p[0], value: p[1] }, d: { color: p[2], value: p[3] } }; out.push(cardSrc(c, 'light'), cardSrc(c, 'dark')); });
    return [...new Set(out)];
}

export function pointOf(f) {
    if (isNum(f)) return parseInt(f.value);
    return { 'Draw One': 10, 'Draw Five': 20, 'Reverse': 20, 'Skip': 20, 'Skip Everyone': 30, 'Flip': 20, 'Wild': 40, 'Wild Draw Two': 50, 'Wild Draw Color': 60 }[f.value] || 0;
}

export function buildDeck() { return PAIRS.map(p => ({ l: { color: p[0], value: p[1] }, d: { color: p[2], value: p[3] } })); }

export function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
}

// Bagi 7 kartu per pemain. Kartu pertama (sisi terang) harus angka. Permainan mulai di sisi terang.
export function dealGame(players) {
    const starter = Math.floor(Math.random() * players.length);   // pemain pertama DIACAK (bukan selalu pemain 1/host)
    const deck = buildDeck();
    shuffle(deck);
    const hands = {};
    players.forEach(p => { hands[p.uid] = []; });
    for (let i = 0; i < 7; i++) players.forEach(p => hands[p.uid].push(deck.pop()));
    let first = deck.pop();
    while (!isNum(first.l)) { deck.unshift(first); first = deck.pop(); }
    const state = {
        ...emptyState(), turnIndex: starter, side: 'light', discardPile: [first], hands, currentColor: first.l.color,
        logs: [`Permainan dimulai di sisi terang! Giliran pertama: <b>${esc(players[starter].name)}</b> (diacak).`],
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

// Ambil kartu terus sampai dapat kartu berwarna `color` (di sisi yang sedang main), maks. sampai dek habis.
export function drawUntil(state, color) {
    const cards = [], sides = [];
    for (let guard = 0; guard < 150; guard++) {
        const got = drawFrom(state, 1);
        if (!got.cards.length) break;
        cards.push(got.cards[0]); sides.push(got.sides[0]);
        if (face(got.cards[0], state.side).color === color) break;
    }
    return { cards, sides };
}
