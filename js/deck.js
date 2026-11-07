import { ACTIONS, COLORS } from './config.js';
import { emptyState, fx } from './state.js';

// --- LOGIKA GAME ---
export function buildDeck() {
    let d = [];
    COLORS.forEach(c => {
        d.push({ type: 'number', color: c, value: '0' });
        for (let i = 1; i <= 9; i++) {
            d.push({ type: 'number', color: c, value: i.toString() });
            d.push({ type: 'number', color: c, value: i.toString() });
        }
        ACTIONS.forEach(a => { d.push({ type: 'action', color: c, value: a }); d.push({ type: 'action', color: c, value: a }); });
    });
    for (let i = 0; i < 4; i++) {
        d.push({ type: 'wild', color: 'Black', value: 'Wild' });
        d.push({ type: 'wild', color: 'Black', value: 'Wild Draw Four' });
    }
    for (let i = 0; i < 4; i++) d.push({ type: 'wild', color: 'Black', value: 'Wild Shuffle Hands' });
        return d;
}

export function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

export function dealGame(players) {
    const deck = buildDeck();
    shuffle(deck);
    const hands = {};
    players.forEach(p => { hands[p.uid] = []; });
    for (let i = 0; i < 7; i++) players.forEach(p => hands[p.uid].push(deck.pop()));
    let first = deck.pop();
    while (first.type !== 'number') { deck.unshift(first); first = deck.pop(); }
    const state = { ...emptyState(), discardPile: [first], hands, currentColor: first.color, logs: ["Permainan dimulai!"], fx: { id: 'deal' + Math.random().toString(36).slice(2), list: [{ t: 'deal' }] } };
    splitDeck(state, deck);   // sisa kartu dibagi rata: deck kiri & deck kanan
    return state;
}

// Bagi rata sisa kartu ke dua deck: state.deck = kiri, state.deckR = kanan
export function splitDeck(state, cards) {
    const half = Math.ceil(cards.length / 2);
    state.deck = cards.slice(0, half);
    state.deckR = cards.slice(half);
}

// Ambil kartu dari deck. side: 'L' (kiri) / 'R' (kanan) = pilihan pemain.
// Tanpa side (ambil otomatis: +2, +4, penalti) dipakai deck yang isinya lebih banyak, jadi bergantian.
// Jika deck pilihan kosong, otomatis ambil dari deck satunya.
// Jika dua-duanya kosong: tumpukan buangan (kecuali kartu teratas) dikocok dan dibagi rata lagi.
// Mengembalikan { cards, sides } (sides = asal tiap kartu, dipakai animasi).
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
            state.logs.push("Tumpukan dikocok ulang.");
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

export function extractCards(state, count, side) {
    return drawFrom(state, count, side).cards;
}

// --- SKOR & GAME OVER ---
export function calculatePoint(card) {
    if (card.type === 'number') return parseInt(card.value);
    if (card.type === 'action') return 20;
    if (card.value === 'Wild' || card.value === 'Wild Draw Four') return 50;
    return 40;
}
