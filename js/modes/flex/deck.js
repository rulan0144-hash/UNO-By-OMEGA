// Dek UNO Flex: 104 kartu main (+ 1 Power Card per pemain, dibuat di dealGame). Maks. 8 pemain.
// Kartu = { id, c: warna biasa (oval tengah), v: nilai biasa, fc: warna flex | null, fv: nilai/efek flex | null, fl: 1 jika ikon Flip, img }
import { CARDS } from './data.js';
import { emptyState, esc } from '../../core/state.js';

export const COLORS = ['Red', 'Yellow', 'Green', 'Blue'];
export const NAMES = { Red: 'Merah', Yellow: 'Kuning', Green: 'Hijau', Blue: 'Biru', Black: 'Bebas' };
export const HEX = { Red: '#ef4444', Yellow: '#eab308', Green: '#22c55e', Blue: '#3b82f6' };

export const isNum = (card) => /^\d$/.test(card.v);
export const isWild = (card) => card.c === 'Black';
export const hasFlex = (card) => card.fv != null;
// gambar kartu: img/flex/cards/<nama>.png ; Power: Power-Go (hijau, boleh flex) / Power-Stop (merah)
export const cardSrc = (card) => `img/flex/cards/${card.img}.png`;
export const powerSrc = (go) => `img/flex/cards/${go ? 'Power-Go' : 'Power-Stop'}.png`;
export const backSrc = () => 'img/flex/cards/back.png';
export function allCardSrcs() { return [...new Set(CARDS.map(c => `img/flex/cards/${c[5]}.png`)), powerSrc(true), powerSrc(false), backSrc()]; }

// Poin kartu sisa (layar akhir 'Total Skor'): angka = nilai, aksi 20, Wild 50. Power Card tidak dihitung.
export function pointOf(card) {
    if (isNum(card)) return parseInt(card.v);
    if (isWild(card)) return 50;
    return 20;
}

export function buildDeck() {
    return CARDS.map((r, i) => ({ id: i, c: r[0], v: r[1], fc: r[2], fv: r[3], fl: r[4], img: r[5] }));
}

export function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
}

// Bagi 7 kartu + 1 Power Card (mulai hijau). Kartu pertama harus kartu angka (aksi/Wild dikembalikan ke dasar dek).
export function dealGame(players) {
    const starter = Math.floor(Math.random() * players.length);   // pemain pertama DIACAK (bukan selalu pemain 1/host)
    const deck = buildDeck();
    shuffle(deck);
    const hands = {}, power = {};
    players.forEach(p => { hands[p.uid] = []; power[p.uid] = true; });
    for (let i = 0; i < 7; i++) players.forEach(p => hands[p.uid].push(deck.pop()));
    let first = deck.pop();
    while (!isNum(first)) { deck.unshift(first); first = deck.pop(); }
    const state = {
        ...emptyState(), turnIndex: starter, discardPile: [first], hands, power, currentColor: first.c, topFlex: false,
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
