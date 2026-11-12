// Uji mesin UNO All Wild (Node, tanpa DOM): uji unit tiap aturan + simulasi ratusan permainan 2-10 pemain.
// Jalankan: bash alat/sim_allwild.sh
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const root = process.argv[2];
const { S } = await import(root + '/js/core/state.js');
const D = await import(root + '/js/modes/allwild/deck.js');
const R = await import(root + '/js/modes/allwild/rules.js');
const B = await import(root + '/js/modes/allwild/bot.js');

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('GAGAL:', msg); } };
const mkPlayers = (n) => Array.from({ length: n }, (_, i) => ({ uid: 'p' + i, name: 'P' + i }));
const proto = D.buildDeck();
const card = (img) => { const c = proto.find(x => x.img === img); if (!c) throw new Error('kartu tak ada: ' + img); return JSON.parse(JSON.stringify(c)); };
const total = (st) => st.deck.length + st.deckR.length + st.discardPile.length + Object.values(st.hands).reduce((a, h) => a + h.length, 0);

// ----- komposisi dek -----
{
    const d = D.buildDeck(); const cnt = (v) => d.filter(c => c.v === v).length;
    ok(d.length === 112, 'dek 112 kartu');
    ok(d.every(c => c.c === 'Black'), 'semua kartu hitam');
    ok(new Set(d.map(c => c.id)).size === 112, 'id unik');
    ok(cnt('Wild') === 54 && cnt('Skip') === 14 && cnt('Reverse') === 14 && cnt('Draw Two') === 10 && cnt('Skip Two') === 6 && cnt('Draw Four') === 6 && cnt('Target Draw Two') === 4 && cnt('Forced Swap') === 4, 'komposisi dek sesuai 54/14/14/10/6/6/4/4');
    ok(D.pointOf(card('Black-Wild')) === 20 && D.pointOf(card('Black-WildSkip')) === 50 && D.pointOf(card('Black-WildForcedSwap')) === 50, 'poin: Wild 20, aksi 50');
}

// ----- skenario manual -----
function setup(n, hands, topImg) {
    S.roomData = { players: mkPlayers(n), status: 'playing', gameState: null };
    S.currentUser = { uid: 'p0' };
    const st = D.dealGame(S.roomData.players);
    st.fx = { id: 'x', list: [] };
    const all = [...st.deck, ...st.deckR, ...Object.values(st.hands).flat(), ...st.discardPile];
    S.roomData.players.forEach((p, i) => { st.hands[p.uid] = (hands[i] && hands[i].length ? hands[i] : ['Black-Wild', 'Black-Wild', 'Black-Wild']).map(card); });
    st.discardPile = [card(topImg || 'Black-Wild')];
    st.turnIndex = 0; st.direction = 1;
    const used = new Set([...Object.values(st.hands).flat(), ...st.discardPile].map(c => c.id));
    const rest = all.filter(c => !used.has(c.id)); D.shuffle(rest); D.splitDeck(st, rest);
    S.roomData.gameState = st;
    return st;
}
const idxOfCard = (st, uid, img) => st.hands[uid].findIndex(c => c.img === img);
const play = (st, uid, img, opts) => R.playCardOn(st, uid, idxOfCard(st, uid, img), opts);

// Pembagian awal
{
    const players = mkPlayers(10); S.roomData = { players, status: 'playing' };
    const st = D.dealGame(players);
    ok(players.every(p => st.hands[p.uid].length === 7), 'bagi 7 kartu (10 pemain)');
    ok(total(st) === 112 && st.discardPile.length === 1 && D.COLORS.includes(st.currentColor), 'kartu pertama dibuka + warna awal');
    ok(R.isPlayableIn(st, 'p0', st.hands.p0[0]) === true, 'semua kartu boleh dimainkan');
}
// Wild biasa: hanya pilih warna
{
    const st = setup(3, [['Black-Wild', 'Black-Wild']], 'Black-WildDrawFour');
    const t = total(st); play(st, 'p0', 'Black-Wild', { color: 'Blue' });
    ok(st.currentColor === 'Blue' && st.turnIndex === 1 && st.hands.p0.length === 1 && total(st) === t, 'Wild: warna dipilih, giliran lanjut');
    ok(st.forgot.p0 === true, 'sisa 1 kartu tanpa UNO -> bisa ditangkap');
    ok(R.isCatchable(st, 'p0') === true, 'isCatchable');
    R.penalize(st, 'p0', 'p1'); ok(st.hands.p0.length === 3 && !R.isCatchable(st, 'p0'), 'tangkap lupa UNO: +2');
    const s2 = setup(3, [['Black-Wild', 'Black-Wild']]); play(s2, 'p0', 'Black-Wild', { color: 'Red', callUno: true });
    ok(s2.unoCalled.p0 === true && !s2.forgot.p0, 'callUno: tidak bisa ditangkap');
}
// Reverse
{
    const s1 = setup(4, [['Black-WildReverse', 'Black-Wild']]); play(s1, 'p0', 'Black-WildReverse', { color: 'Red' });
    ok(s1.direction === -1 && s1.turnIndex === 3, 'Reverse 4 pemain: arah berbalik, giliran ke pemain sebelumnya');
    const s2 = setup(2, [['Black-WildReverse', 'Black-Wild']]); play(s2, 'p0', 'Black-WildReverse', { color: 'Red' });
    ok(s2.turnIndex === 0 && s2.direction === 1, 'Reverse 2 pemain: main lagi (seperti Skip)');
}
// Skip & Skip Two
{
    const s1 = setup(4, [['Black-WildSkip', 'Black-Wild']]); play(s1, 'p0', 'Black-WildSkip', { color: 'Red' });
    ok(s1.turnIndex === 2, 'Skip: pemain berikut dilewati');
    const s2 = setup(4, [['Black-WildSkipTwo', 'Black-Wild']]); play(s2, 'p0', 'Black-WildSkipTwo', { color: 'Red' });
    ok(s2.turnIndex === 3, 'Skip Two (4 pemain): dua pemain dilewati');
    const s3 = setup(3, [['Black-WildSkipTwo', 'Black-Wild']]); play(s3, 'p0', 'Black-WildSkipTwo', { color: 'Red' });
    ok(s3.turnIndex === 0, 'Skip Two (3 pemain): kembali ke kita');
    const s4 = setup(2, [['Black-WildSkipTwo', 'Black-Wild']]); play(s4, 'p0', 'Black-WildSkipTwo', { color: 'Red' });
    ok(s4.turnIndex === 1, 'Skip Two (2 pemain): lawan dilewati, kita juga dilewati -> giliran ke lawan');
    const s6 = setup(2, [['Black-WildSkip', 'Black-Wild']]); play(s6, 'p0', 'Black-WildSkip', { color: 'Red' });
    ok(s6.turnIndex === 0, 'Skip (2 pemain): kembali ke kita');
    const s5 = setup(4, [['Black-WildSkip', 'Black-Wild']]); s5.direction = -1; play(s5, 'p0', 'Black-WildSkip', { color: 'Red' });
    ok(s5.turnIndex === 2, 'Skip arah berlawanan (p0 -> p3 dilewati -> p2)');
}
// Draw Two & Four (tanpa tantangan)
{
    const s1 = setup(3, [['Black-WildDrawTwo', 'Black-Wild']]); const t = total(s1); play(s1, 'p0', 'Black-WildDrawTwo', { color: 'Red' });
    ok(s1.hands.p1.length === 5 && s1.turnIndex === 2 && total(s1) === t, 'Draw Two: pemain berikut +2 dan dilewati');
    const s2 = setup(3, [['Black-WildDrawFour', 'Black-Wild']]); play(s2, 'p0', 'Black-WildDrawFour', { color: 'Red' });
    ok(s2.hands.p1.length === 7 && s2.turnIndex === 2 && !s2.pending, 'Draw Four: +4, dilewati, tanpa tantangan');
    const s3 = setup(2, [['Black-WildDrawFour', 'Black-Wild']]); play(s3, 'p0', 'Black-WildDrawFour', { color: 'Red' });
    ok(s3.hands.p1.length === 7 && s3.turnIndex === 0, 'Draw Four (2 pemain): lawan +4, main lagi');
}
// Targeted Draw Two
{
    const s1 = setup(4, [['Black-WildTargetDrawTwo', 'Black-Wild']]); const t = total(s1);
    play(s1, 'p0', 'Black-WildTargetDrawTwo', { color: 'Green', target: 'p3' });
    ok(s1.hands.p3.length === 5 && s1.hands.p1.length === 3 && s1.turnIndex === 1 && total(s1) === t, 'Target +2: hanya target +2, tidak ada yang dilewati');
    const s2 = setup(4, [['Black-WildTargetDrawTwo', 'Black-Wild']]); play(s2, 'p0', 'Black-WildTargetDrawTwo', { color: 'Green', target: 'p0' });
    ok(s2.hands.p1.length === 5 && s2.hands.p0.length === 1, 'target tidak sah (diri sendiri) -> pemain berikut');
    const s3 = setup(4, [['Black-WildTargetDrawTwo', 'Black-Wild']]); s3.direction = -1; play(s3, 'p0', 'Black-WildTargetDrawTwo', { color: 'Green', target: 'zzz' });
    ok(s3.hands.p3.length === 5, 'target tak dikenal -> pemain berikut (arah mundur = p3)');
}
// Forced Swap
{
    const s1 = setup(3, [['Black-WildForcedSwap', 'Black-Wild', 'Black-Wild', 'Black-Wild'], ['Black-Skip' in {} ? '' : 'Black-WildSkip', 'Black-WildSkip'], []]);
    play(s1, 'p0', 'Black-WildForcedSwap', { color: 'Blue', target: 'p1' });
    ok(s1.hands.p0.length === 2 && s1.hands.p0[0].v === 'Skip' && s1.hands.p1.length === 3 && s1.turnIndex === 1, 'Forced Swap: tangan tertukar, giliran lanjut');
    ok(!s1.forgot.p0 && !s1.forgot.p1, 'tidak ada yang sisa 1 -> tidak perlu UNO');
    const s2 = setup(3, [['Black-WildForcedSwap', 'Black-Wild', 'Black-Wild'], ['Black-WildSkip'], []]);
    play(s2, 'p0', 'Black-WildForcedSwap', { color: 'Blue', target: 'p1' });
    ok(s2.hands.p0.length === 1 && s2.forgot.p0 === true && s2.hands.p1.length === 2, 'setelah tukar: pemegang 1 kartu harus UNO (bisa ditangkap)');
    const s3 = setup(3, [['Black-WildForcedSwap', 'Black-Wild'], ['Black-WildSkip', 'Black-Wild', 'Black-Wild'], []]);
    play(s3, 'p0', 'Black-WildForcedSwap', { color: 'Blue', target: 'p2' }); ok(s3.forgot.p2 === true || s3.hands.p2.length !== 1, 'target tangan 1 kartu setelah tukar -> bendera UNO');
    const s4 = setup(3, [['Black-WildForcedSwap'], ['Black-Wild', 'Black-Wild'], []]);
    const w = play(s4, 'p0', 'Black-WildForcedSwap', { color: 'Blue', target: 'p1' });
    ok(w === true && s4.winner === 'p1' && s4.hands.p1.length === 0 && s4.hands.p0.length === 2, 'Forced Swap sebagai kartu terakhir: tukar jalan, lawan yang dipilih MENANG');
    const s6 = setup(3, [['Black-WildForcedSwap'], [], ['Black-Wild']]); s6.hands.p1 = [card('Black-Wild'), card('Black-Wild')];
    ok(play(s6, 'p0', 'Black-WildForcedSwap', { color: 'Blue', target: 'p2' }) === true && s6.winner === 'p2', 'Forced Swap terakhir: target p2 menang');
    const s5 = setup(3, [['Black-WildForcedSwap', 'Black-Wild', 'Black-Wild'], ['Black-Wild', 'Black-Wild', 'Black-Wild', 'Black-Wild'], []]); s5.hands.p2 = [card('Black-WildSkip')];
    play(s5, 'p0', 'Black-WildForcedSwap', { color: 'Blue', target: 'zzz' }); ok(s5.hands.p0.length === 4 && s5.hands.p1.length === 2, 'target tak sah -> pemain berikut');
}
// Menang dengan kartu aksi terakhir
{
    const s1 = setup(3, [['Black-WildDrawTwo'], [], []]); const w = play(s1, 'p0', 'Black-WildDrawTwo', { color: 'Red' });
    ok(w === true && s1.winner === 'p0' && s1.hands.p1.length === 5, 'kartu terakhir +2: efek jalan lalu menang');
    const s2 = setup(3, [['Black-Wild'], [], []]); ok(play(s2, 'p0', 'Black-Wild', { color: 'Red' }) === true && !s2.forgot.p0, 'Wild terakhir: menang, tanpa bendera UNO');
}
// Ambil kartu
{
    const st = setup(3, [['Black-Wild', 'Black-Wild']]); const t = total(st);
    const c = R.drawOneTurn(st, 'p0'); ok(c && st.hands.p0.length === 3 && total(st) === t, 'ambil 1 kartu');
    const before = st.turnIndex; R.advance(st); ok(st.turnIndex === (before + 1) % 3, 'lewat giliran');
    st.deck = []; st.deckR = []; st.discardPile = [card('Black-Wild'), card('Black-WildSkip'), card('Black-WildDrawFour')];
    const c2 = R.drawOneTurn(st, 'p0'); ok(c2 && st.discardPile.length === 1, 'dek habis: buangan dikocok ulang, kartu teratas tetap');
}
// Skor ronde
{
    const st = setup(3, [[], ['Black-Wild', 'Black-WildSkip'], ['Black-WildDrawFour']]); st.winner = 'p0'; R.tallyRound(st);
    ok(st.roundPts === 20 + 50 + 50, 'skor: Wild 20 + aksi 50 + aksi 50');
}
// Bot: ambil-kartu (ONE MORE THING) & pilih kartu
{
    const st = setup(3, [['Black-Wild', 'Black-Wild', 'Black-Wild'], ['Black-Wild'], []]);
    ok(B.shouldDraw(st, S.roomData.players, 'p0') === true, 'bot ambil kartu: pemain berikut sisa 1, tak ada penghenti');
    st.hands.p0.push(card('Black-WildSkip')); ok(B.shouldDraw(st, S.roomData.players, 'p0') === false, 'bot main: punya penghenti (Skip)');
    const s2 = setup(3, [['Black-WildForcedSwap', 'Black-Wild'], [], []]); s2.hands.p1 = [card('Black-Wild'), card('Black-Wild'), card('Black-Wild')]; s2.hands.p2 = [card('Black-Wild'), card('Black-Wild'), card('Black-Wild')];
    const p = B.choosePlay(s2, S.roomData.players, 'p0'); ok(s2.hands.p0[p.idx].v === 'Wild', 'bot tidak memainkan Forced Swap saat tangannya sudah kecil');
    const sx = setup(3, [['Black-WildForcedSwap'], [], []]); ok(B.shouldDraw(sx, S.roomData.players, 'p0') === true, 'bot tidak memainkan Forced Swap sebagai kartu terakhir (ambil kartu)');
    const s3 = setup(3, [['Black-WildSkip'], [], []]); const q = B.choosePlay(s3, S.roomData.players, 'p0'); ok(q.idx === 0, 'bot memainkan kartu terakhir');
}

// ----- simulasi ratusan permainan -----
let brainMoves = 0, draws = 0;
function bot(st, players) {
    const uid = players[st.turnIndex].uid, hand = st.hands[uid];
    if (Math.random() < 0.9 && B.shouldDraw(st, players, uid) || Math.random() < 0.05) {
        draws++;
        const c = R.drawOneTurn(st, uid);
        if (c && Math.random() < 0.8) return R.playCardOn(st, uid, hand.length - 1, { ...B.chooseTimeoutPlay(st, players, uid, hand.length - 1), callUno: Math.random() < 0.85 });
        R.advance(st); return false;
    }
    brainMoves++;
    const m = BRAIN ? B.choosePlay(st, players, uid) : { idx: Math.floor(Math.random() * hand.length), color: D.COLORS[Math.floor(Math.random() * 4)], target: players.filter(p => p.uid !== uid)[0].uid };
    if (!BRAIN && hand[m.idx].v !== 'Forced Swap' && hand[m.idx].v !== 'Target Draw Two') m.target = undefined;
    return R.playCardOn(st, uid, m.idx, { ...m, callUno: Math.random() < 0.85 });
}
function invariants(st, players, tag) {
    ok(total(st) === 112, `${tag}: total kartu ${total(st)} != 112`);
    ok(st.turnIndex >= 0 && st.turnIndex < players.length, `${tag}: turnIndex di luar rentang`);
    ok(st.direction === 1 || st.direction === -1, `${tag}: arah`);
    ok(JSON.stringify(st) !== undefined, `${tag}: state tak bisa di-JSON`);
}
let BRAIN = false;
const stats = { games: 0, steps: 0, stuck: 0 };
for (let n = 2; n <= 10; n++) {
    for (let g = 0; g < 60; g++) {
        BRAIN = g >= 30;   // 30 permainan kebijakan acak + 30 dengan otak bot.js
        const players = mkPlayers(n); S.roomData = { players, status: 'playing', gameState: null }; S.currentUser = { uid: 'p0' };
        const st = D.dealGame(players); S.roomData.gameState = st;
        let finished = false;
        for (let step = 0; step < 6000 && !finished; step++) {
            st.fx = { id: 'x', list: [] };
            finished = bot(st, players);
            stats.steps++;
            if (step % 7 === 0 || finished) invariants(st, players, `n=${n} g=${g} step=${step}`);
        }
        if (!finished) { stats.stuck++; console.log('GAGAL: permainan tidak selesai n=' + n); fails++; }
        else { ok(st.hands[st.winner].length === 0, 'pemenang tangan kosong'); R.tallyRound(st); }
        stats.games++;
    }
}
console.log(`Simulasi: ${stats.games} permainan (2-10 pemain), ${stats.steps} langkah, ${brainMoves} kartu dimainkan, ${draws} ambil-kartu, macet ${stats.stuck}`);
console.log(fails === 0 ? 'SEMUA UJI LULUS' : `GAGAL: ${fails} pemeriksaan`);
process.exit(fails ? 1 : 0);
