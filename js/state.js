// State bersama + helper kecil.
export const S = {
    fbUser: null,          // user Firebase (mode online)
    currentUser: null,     // online = fbUser, vs komputer = {uid:'local-me'}
    myName: localStorage.getItem('uno_name') || "",
    currentRoomCode: null,
    roomUnsubscribe: null,
    roomData: null,
    localMode: false,
    botTimer: null,
    selectedOpp: null,
    pendingWildCardIdx: -1,
    hasDrawnThisTurn: false,
    pendingFrom: null,     // posisi kartu yang baru dimainkan (untuk animasi)
    lastFxId: null,        // id animasi terakhir yang sudah diputar
    fxRoom: null
};

export const clone = (o) => JSON.parse(JSON.stringify(o));

export const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const nameOf = (uid) => esc(S.roomData.players.find(p => p.uid === uid)?.name || '?');

export const emptyState = () => ({ deck: [], discardPile: [], hands: {}, turnIndex: 0, direction: 1, currentColor: '', logs: [], unoCalled: {}, catchable: null, turnNo: 0, pending: null });

// Salin gameState + buka daftar animasi baru
export function cloneState() {
    const s = clone(S.roomData.gameState);
    s.fx = { id: Math.random().toString(36).slice(2), list: [] };
    return s;
}

// Catat peristiwa animasi di state (ikut tersinkron ke semua pemain online)
export function fx(state, ev) {
    if (!state.fx) state.fx = { id: Math.random().toString(36).slice(2), list: [] };
    state.fx.list.push(ev);
}
