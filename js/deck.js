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
    return { ...emptyState(), deck, discardPile: [first], hands, currentColor: first.color, logs: ["Permainan dimulai!"], fx: { id: 'deal' + Math.random().toString(36).slice(2), list: [{ t: 'deal' }] } };
}

export function extractCards(state, count) {
    let drawn = [];
    for (let i = 0; i < count; i++) {
        if (state.deck.length === 0) {
            if (state.discardPile.length <= 1) break;
            const top = state.discardPile.pop();
            state.deck = state.discardPile;
            shuffle(state.deck);
            state.discardPile = [top];
            state.logs.push("Tumpukan dikocok ulang.");
        }
        drawn.push(state.deck.pop());
    }
    return drawn;
}

// --- SKOR & GAME OVER ---
export function calculatePoint(card) {
    if (card.type === 'number') return parseInt(card.value);
    if (card.type === 'action') return 20;
    if (card.value === 'Wild' || card.value === 'Wild Draw Four') return 50;
    return 40;
}
