// Uji mesin UNO Show 'Em No Mercy (Node, tanpa DOM): uji unit tiap aturan + simulasi ribuan permainan 2-6 pemain.
// Jalankan: bash alat/sim_nomercy.sh
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const root = process.argv[2];
const { S } = await import(root + '/js/core/state.js');
const D = await import(root + '/js/modes/nomercy/deck.js');
const R = await import(root + '/js/modes/nomercy/rules.js');
const B = await import(root + '/js/modes/nomercy/bot.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('GAGAL:', msg); } };
const mkPlayers = (n) => Array.from({ length: n }, (_, i) => ({ uid: 'p' + i, name: 'P' + i }));
const proto = D.buildDeck();
const card = (img) => { const c = proto.find(x => x.img === img); if (!c) throw new Error('kartu tak ada: ' + img); return JSON.parse(JSON.stringify(c)); };
const total = (st) => st.deck.length + st.discardPile.length + st.setAside.length + Object.values(st.hands).reduce((a, h) => a + h.length, 0);

// ----- komposisi dek -----
{
    const d = D.buildDeck(); const cnt = (f) => d.filter(f).length;
    ok(d.length === 168 && D.DECK_SIZE === 168, 'dek 168 kartu');
    ok(new Set(d.map(c => c.id)).size === 168, 'id unik');
    ok(D.COLORS.every(c => cnt(x => x.c === c) === 36), 'tiap warna 36 kartu');
    ok(cnt(x => x.c === 'Black') === 24, 'hitam 24 kartu');
    ok(cnt(x => x.v === 'Wild Reverse Draw Four') === 8 && cnt(x => x.v === 'Wild Draw Six') === 4 && cnt(x => x.v === 'Wild Draw Ten') === 4 && cnt(x => x.v === 'Wild Color Roulette') === 8, 'komposisi hitam 8/4/4/8');
    ok(D.COLORS.every(c => ['Skip', 'Reverse', 'Draw Two'].every(v => cnt(x => x.c === c && x.v === v) === 3) && cnt(x => x.c === c && x.v === 'Draw Four') === 2 && cnt(x => x.c === c && x.v === 'Discard All') === 3 && cnt(x => x.c === c && x.v === 'Skip Everyone') === 2), 'komposisi aksi berwarna per warna');
    ok(D.COLORS.every(c => '0123456789'.split('').every(n => cnt(x => x.c === c && x.v === n) === 2)), 'angka 0-9 x2 per warna');
    ok(D.pointOf(card('Red-7')) === 7 && D.pointOf(card('Red-Skip')) === 20 && D.pointOf(card('Blue-DiscardAll')) === 20 && D.pointOf(card('Black-WildDrawTen')) === 50 && D.pointOf(card('Black-WildColorRoulette')) === 50, 'poin kartu');
}

function setup(n, hands, topImg, color) {
    S.roomData = { players: mkPlayers(n), status: 'playing', gameState: null };
    S.currentUser = { uid: 'p0' };
    const st = D.dealGame(S.roomData.players);
    st.fx = { id: 'x', list: [] };
    const all = [...st.deck, ...Object.values(st.hands).flat(), ...st.discardPile];
    S.roomData.players.forEach((p, i) => { st.hands[p.uid] = (hands[i] && hands[i].length ? hands[i] : ['Red-1', 'Red-2', 'Red-3']).map(card); });
    st.discardPile = [card(topImg || 'Red-5')]; st.currentColor = color || st.discardPile[0].c;
    st.turnIndex = 0; st.direction = 1;
    const used = new Set([...Object.values(st.hands).flat(), ...st.discardPile].map(c => c.id));
    const rest = all.filter(c => !used.has(c.id)); D.shuffle(rest); st.deck = rest;
    S.roomData.gameState = st;
    return st;
}
const idxOfCard = (st, uid, img) => st.hands[uid].findIndex(c => c.img === img);
const play = (st, uid, img, opts) => R.playCardOn(st, uid, idxOfCard(st, uid, img), opts);
const putTop = (st, imgs) => { imgs.slice().reverse().forEach(img => { const i = st.deck.findIndex(c => c.img === img); if (i < 0) throw new Error('tak ada di dek: ' + img); const [c] = st.deck.splice(i, 1); st.deck.push(c); }); };   // imgs[0] diambil pertama

// Pembagian awal
for (let k = 0; k < 50; k++) {
    const players = mkPlayers(2 + (k % 5)); S.roomData = { players, status: 'playing' };
    const st = D.dealGame(players);
    ok(players.every(p => st.hands[p.uid].length === 7), 'bagi 7 kartu');
    ok(total(st) === 168 && st.discardPile.length === 1, 'total 168 + 1 kartu buangan');
    ok(/^[0-9]$/.test(st.discardPile[0].v) && D.COLORS.includes(st.currentColor), 'kartu pembuka berupa angka dengan warna');
}
// Kecocokan
{
    const st = setup(3, [['Red-1', 'Blue-5', 'Blue-1', 'Green-9', 'Black-WildDrawSix']], 'Red-5');
    const p = (img) => R.isPlayableIn(st, 'p0', st.hands.p0[idxOfCard(st, 'p0', img)]);
    ok(p('Red-1') && p('Blue-5') && !p('Blue-1') === true && !p('Green-9') && p('Black-WildDrawSix'), 'cocok: warna / angka / Wild; tak cocok ditolak');
}
// Angka biasa
{
    const st = setup(3, [['Red-1', 'Red-2']]); const t = total(st); play(st, 'p0', 'Red-1');
    ok(st.turnIndex === 1 && st.currentColor === 'Red' && total(st) === t, 'angka: giliran lanjut'); ok(st.forgot.p0 === true && R.isCatchable(st, 'p0'), 'sisa 1 tanpa UNO bisa ditangkap');
    R.penalize(st, 'p0', 'p1'); ok(st.hands.p0.length === 3 && !R.isCatchable(st, 'p0'), 'tangkap +2');
    const s2 = setup(3, [['Red-1', 'Red-2']]); play(s2, 'p0', 'Red-1', { callUno: true }); ok(s2.unoCalled.p0 && !s2.forgot.p0, 'callUno aman');
}
// Skip / Reverse / Skip Everyone
{
    const s1 = setup(4, [['Red-Skip', 'Red-1']]); play(s1, 'p0', 'Red-Skip'); ok(s1.turnIndex === 2, 'Skip');
    const s2 = setup(4, [['Red-Reverse', 'Red-1']]); play(s2, 'p0', 'Red-Reverse'); ok(s2.direction === -1 && s2.turnIndex === 3, 'Reverse 4 pemain');
    const s3 = setup(2, [['Red-Reverse', 'Red-1']]); play(s3, 'p0', 'Red-Reverse'); ok(s3.turnIndex === 0, 'Reverse 2 pemain = main lagi');
    const s4 = setup(5, [['Red-SkipEveryone', 'Red-1']]); play(s4, 'p0', 'Red-SkipEveryone'); ok(s4.turnIndex === 0, 'Skip Everyone: giliran lagi');
}
// Draw Two / Four tanpa balasan
{
    const st = setup(3, [['Red-DrawTwo', 'Red-1']]); const t = total(st); play(st, 'p0', 'Red-DrawTwo');
    ok(st.pending && st.pending.n === 2 && st.turnIndex === 1, 'Draw Two: hukuman 2 untuk pemain berikut'); ok(!R.hasPlayable(st, 'p1'), 'tanpa kartu Draw, tak ada yang bisa dimainkan');
    R.takePenalty(st, 'p1'); ok(st.hands.p1.length === 5 && st.turnIndex === 2 && !st.pending && total(st) === t, 'ambil 2 dan kehilangan giliran');
}
// Tumpukan
{
    const st = setup(4, [['Red-DrawFour', 'Red-1'], ['Blue-DrawTwo', 'Green-DrawFour', 'Black-WildDrawSix'], ['Black-WildDrawTen', 'Red-3'], ['Red-4', 'Red-6']]);
    play(st, 'p0', 'Red-DrawFour'); ok(st.pending.n === 4 && st.pending.top === 4, 'tumpuk: +4');
    ok(!R.isPlayableIn(st, 'p1', st.hands.p1[idxOfCard(st, 'p1', 'Blue-DrawTwo')]), '+2 TIDAK boleh menumpuk +4'); ok(R.isPlayableIn(st, 'p1', st.hands.p1[idxOfCard(st, 'p1', 'Green-DrawFour')]), '+4 (warna bebas) boleh menumpuk +4'); ok(R.isPlayableIn(st, 'p1', st.hands.p1[idxOfCard(st, 'p1', 'Black-WildDrawSix')]), '+6 boleh menumpuk +4');
    play(st, 'p1', 'Black-WildDrawSix', { color: 'Blue' }); ok(st.pending.n === 10 && st.turnIndex === 2 && st.currentColor === 'Blue', 'tumpuk +4 lalu +6 = 10');
    play(st, 'p2', 'Black-WildDrawTen', { color: 'Green' }); ok(st.pending.n === 20 && st.pending.count === 3 && st.turnIndex === 3, '+10 menumpuk: 20');
    const h = st.hands.p3.length; R.takePenalty(st, 'p3'); ok(st.hands.p3.length === h + 20 && st.turnIndex === 0 && !st.pending, 'korban ambil 20, giliran lanjut ke p0');
}
// Color Roulette
{
    const st = setup(3, [['Black-WildColorRoulette', 'Red-1']]); play(st, 'p0', 'Black-WildColorRoulette');
    ok(st.pending.kind === 'roulette' && R.actorUid(st) === 'p1', 'Roulette: korban memilih warna'); ok(R.legalPlays(st, 'p1').length === 0, 'Roulette tidak bisa ditumpuk');
    putTop(st, ['Black-WildDrawSix', 'Red-2', 'Blue-3', 'Blue-4']); const h = st.hands.p1.length; const t = total(st);
    R.resolveRoulette(st, 'Blue'); ok(st.hands.p1.length === h + 3 && st.currentColor === 'Blue' && st.turnIndex === 2 && !st.pending && total(st) === t, 'Roulette: ambil sampai Biru (Wild tidak dihitung): 3 kartu; lewat giliran');
}
// Wild Reverse Draw 4
{
    const s1 = setup(4, [['Black-WildReverseDrawFour', 'Red-1']]); play(s1, 'p0', 'Black-WildReverseDrawFour', { color: 'Green' });
    ok(s1.direction === -1 && s1.pending.n === 4 && s1.turnIndex === 3, 'Wild Reverse +4 (4 pemain): arah balik, p3 kena'); R.takePenalty(s1, 'p3'); ok(s1.turnIndex === 2, 'lalu giliran lanjut ke arah baru');
    const s2 = setup(2, [['Black-WildReverseDrawFour', 'Red-1']]); play(s2, 'p0', 'Black-WildReverseDrawFour', { color: 'Green' });
    ok(s2.pending.n === 4 && s2.turnIndex === 0 && R.actorUid(s2) === 'p0', '2 pemain: PEMAIN ITU SENDIRI kena +4');
    const s3 = setup(2, [['Black-WildReverseDrawFour', 'Blue-DrawFour', 'Red-1']]); play(s3, 'p0', 'Black-WildReverseDrawFour', { color: 'Green' }); play(s3, 'p0', 'Blue-DrawFour');
    ok(s3.pending.n === 8 && s3.turnIndex === 1, '2 pemain: menumpuk balik mengirim 8 ke lawan');
}
// Discard All
{
    const st = setup(3, [['Red-DiscardAll', 'Red-1', 'Red-9', 'Blue-2', 'Black-WildDrawSix']]); play(st, 'p0', 'Red-DiscardAll');
    ok(st.hands.p0.length === 2 && st.hands.p0.every(c => c.c !== 'Red'), 'Discard All membuang semua kartu merah'); ok(R.topCard(st).v === 'Discard All' && st.discardPile.length === 4, 'kartu tambahan di BAWAH, teratas tetap Discard All'); ok(st.turnIndex === 1, 'giliran lanjut');
    const s2 = setup(3, [['Red-DiscardAll', 'Red-1', 'Red-9']]); const w = play(s2, 'p0', 'Red-DiscardAll'); ok(w && s2.winner === 'p0', 'Discard All yang menghabiskan tangan = menang');
}
// 0 dan 7
{
    const st = setup(4, [['Red-0', 'Red-1'], ['Blue-1'], ['Green-1', 'Green-2'], ['Yellow-1', 'Yellow-2', 'Yellow-3']]); play(st, 'p0', 'Red-0');
    ok(st.hands.p0.length === 3 && st.hands.p1.length === 1 && st.hands.p2.length === 1 && st.hands.p3.length === 2, '0: semua oper tangan ke pemain berikut'); ok(st.turnIndex === 1, '0: giliran lanjut');
    const s2 = setup(4, [['Red-7', 'Red-1'], ['Blue-1'], ['Green-1', 'Green-2'], ['Yellow-1', 'Yellow-2', 'Yellow-3']]); play(s2, 'p0', 'Red-7', { target: 'p2' });
    ok(s2.hands.p0.length === 2 && s2.hands.p2.length === 1 && s2.turnIndex === 1, '7: tukar tangan dengan target, giliran lanjut'); ok(s2.hands.p0[0].img === 'Green-1', 'isi tangan benar');
    const s3 = setup(3, [['Red-7', 'Red-1']]); play(s3, 'p0', 'Red-7'); ok(s3.hands.p1.length === 1, '7 tanpa target sah: otomatis pemain berikut');
    const s4 = setup(3, [['Red-7']]); const w = play(s4, 'p0', 'Red-7', { target: 'p1' }); ok(w && s4.winner === 'p0' && s4.hands.p1.length === 3, 'kartu terakhir 7: langsung menang tanpa tukar');
    const s5 = setup(3, [['Red-0']]); const w5 = play(s5, 'p0', 'Red-0'); ok(w5 && s5.winner === 'p0', 'kartu terakhir 0: langsung menang');
}
// Ambil sampai bisa dimainkan + wajib main
{
    const st = setup(3, [['Blue-1', 'Blue-2'], [], []], 'Red-5'); putTop(st, ['Green-1', 'Yellow-2', 'Red-8', 'Blue-9']);
    const r = R.drawUntilPlayable(st, 'p0'); ok(r.drawn.length === 3 && r.found.img === 'Red-8' && st.hands.p0.length === 5, 'ambil 3 kartu sampai ketemu Red-8');
    ok(st.forced && st.forced.id === r.found.id && R.legalPlays(st, 'p0').length === 1 && R.legalPlays(st, 'p0')[0] === idxOfCard(st, 'p0', 'Red-8'), 'kartu hasil ambil WAJIB dimainkan'); play(st, 'p0', 'Red-8'); ok(!st.forced && st.turnIndex === 1, 'setelah dimainkan: forced bersih, giliran lanjut');
}
// Mercy
{
    const big = Array.from({ length: 24 }, (_, i) => ['Blue-1', 'Blue-2', 'Blue-3', 'Blue-4', 'Blue-5', 'Blue-6', 'Blue-7', 'Blue-8', 'Blue-9', 'Green-1', 'Green-2', 'Green-3', 'Green-4', 'Green-5', 'Green-6', 'Green-7', 'Green-8', 'Green-9', 'Yellow-1', 'Yellow-2', 'Yellow-3', 'Yellow-4', 'Yellow-5', 'Yellow-6'][i]);
    const st = setup(3, [['Red-DrawTwo', 'Red-1'], big, ['Red-3', 'Red-4']]); const t = total(st);
    play(st, 'p0', 'Red-DrawTwo'); R.takePenalty(st, 'p1');
    ok(R.isOut(st, 'p1') && st.hands.p1.length === 0 && st.setAside.length === 26 && total(st) === t, 'Mercy: 26 kartu -> tersingkir, tangan disisihkan'); ok(!st.winner && R.aliveCount(st) === 2 && st.turnIndex === 2, 'tersisa 2, giliran ke p2');
    // giliran melewati pemain tersingkir
    play(st, 'p2', 'Red-3'); ok(st.turnIndex === 0, 'giliran melewati pemain tersingkir');
    // pemain terakhir menang karena semua tersingkir
    const s2 = setup(2, [['Red-DrawTwo', 'Red-1'], big]); play(s2, 'p0', 'Red-DrawTwo'); R.takePenalty(s2, 'p1');
    ok(s2.winner === 'p0' && s2.winBy === 'mercy', 'semua lawan tersingkir = menang'); R.tallyRound(s2); ok(s2.roundPts === 250, 'skor: 250 per tersingkir');
    // tepat 24 kartu masih aman
    const b24 = big.slice(0, 22); const s3 = setup(3, [['Red-DrawTwo', 'Red-1'], b24]); play(s3, 'p0', 'Red-DrawTwo'); R.takePenalty(s3, 'p1'); ok(!R.isOut(s3, 'p1') && s3.hands.p1.length === 24, '24 kartu: belum tersingkir');
    // 0 membuat pemain menerima >= 25
    const s4 = setup(3, [['Red-0', 'Red-1'], big.concat(['Blue-1', 'Blue-2']).slice(0, 25), ['Red-3']]); play(s4, 'p0', 'Red-0'); ok(R.isOut(s4, 'p0') || R.isOut(s4, 'p2'), '0: penerima 25 kartu langsung tersingkir');
    // pemain yang menerima 25 dari 0 TIDAK menyisakan giliran ke pemain tersingkir
    ok(!R.isOut(s4, S.roomData.players[s4.turnIndex].uid), 'giliran tidak jatuh ke pemain tersingkir');
}
// Dek habis: kocok ulang termasuk kartu disisihkan
{
    const st = setup(3, [['Red-1', 'Red-2'], ['Blue-3'], ['Green-3']]); st.setAside = st.deck.splice(0, 20); st.discardPile.unshift(...st.deck.splice(0, 50)); const t = total(st);
    const want = st.deck.length + 5; const got = D.drawFrom(st, want); ok(got.cards.length === want, 'kocok ulang saat dek habis: tetap bisa mengambil'); ok(st.setAside.length === 0 && total(st) + got.cards.length === t, 'tangan disisihkan ikut dikocok; total tetap');
}
// Skor
{
    const st = setup(3, [['Red-1'], ['Blue-7', 'Red-Skip', 'Black-WildDrawTen'], ['Green-9']]); play(st, 'p0', 'Red-1'); R.tallyRound(st); ok(st.roundPts === 7 + 20 + 50 + 9, 'skor: 7+20+50+9 = 86');
}

// ===== simulasi acak =====
function botAct(st) {
    const uid = R.actorUid(st), hand = st.hands[uid];
    if (st.pending && st.pending.kind === 'roulette') { R.resolveRoulette(st, D.COLORS[Math.floor(Math.random() * 4)]); return; }
    const legal = R.legalPlays(st, uid);
    if (st.pending && st.pending.kind === 'draw') {
        if (legal.length && Math.random() < 0.8) playIdx(st, uid, legal[Math.floor(Math.random() * legal.length)]); else R.takePenalty(st, uid);
        return;
    }
    if (legal.length) { playIdx(st, uid, legal[Math.floor(Math.random() * legal.length)]); return; }
    const r = R.drawUntilPlayable(st, uid);
    if (r.found && !st.winner) { const i = st.hands[uid].findIndex(c => c.id === r.found.id); playIdx(st, uid, i); }
}
function playIdx(st, uid, i) {
    const c = st.hands[uid][i], opts = { callUno: Math.random() < 0.85 };
    if (D.needsColor(c)) { const cnt = {}; st.hands[uid].forEach(x => { if (x.c !== 'Black') cnt[x.c] = (cnt[x.c] || 0) + 1; }); opts.color = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || 'Red'; }
    if (D.needsTarget(c)) { const o = R.alivePlayers(st).filter(p => p.uid !== uid); opts.target = o[Math.floor(Math.random() * o.length)].uid; }
    R.playCardOn(st, uid, i, opts);
}
const stats = { games: 0, unfinished: 0, byEmpty: 0, byMercy: 0, mercy: 0, maxStack: 0, turns: 0, byN: {} };
for (let n = 2; n <= 6; n++) for (let g = 0; g < 500; g++) {
    S.roomData = { players: mkPlayers(n), status: 'playing' }; S.currentUser = { uid: 'p0' };
    const st = D.dealGame(S.roomData.players); S.roomData.gameState = st; let steps = 0, bad = false;
    while (!st.winner && steps++ < 4000) {
        botAct(st);
        if (total(st) !== 168) { ok(false, `kartu tidak 168 (n=${n}, langkah ${steps}): ${total(st)}`); bad = true; break; }
        const alive = R.alivePlayers(st);
        if (!st.winner) {
            if (R.isOut(st, S.roomData.players[st.turnIndex].uid)) { ok(false, 'giliran jatuh ke pemain tersingkir'); bad = true; break; }
            if (alive.some(p => st.hands[p.uid].length >= 25)) { ok(false, 'pemain hidup bertangan >= 25'); bad = true; break; }
            if (st.pending && st.pending.kind === 'draw') stats.maxStack = Math.max(stats.maxStack, st.pending.n);
        }
    }
    stats.games++; stats.turns += steps;
    if (bad) continue;
    if (!st.winner) { stats.unfinished++; continue; }
    stats.mercy += Object.keys(st.out).length; st.winBy === 'mercy' ? stats.byMercy++ : stats.byEmpty++;
    ok(st.winBy === 'mercy' ? R.aliveCount(st) === 1 : st.hands[st.winner].length === 0, 'kondisi menang sah');
    ok(!R.isOut(st, st.winner), 'pemenang tidak tersingkir');
    R.tallyRound(st); ok(st.roundPts >= 250 * Object.keys(st.out).length, 'skor memuat bonus tersingkir');
}
console.log(`Simulasi: ${stats.games} permainan, rata-rata ${(stats.turns / stats.games).toFixed(0)} langkah; menang kartu habis ${stats.byEmpty}, menang Mercy ${stats.byMercy}, total pemain tersingkir ${stats.mercy}, tumpukan terbesar ${stats.maxStack}, tak selesai ${stats.unfinished}`);
ok(stats.unfinished <= stats.games * 0.01, 'hampir semua permainan selesai (<=1% macet)');

// ===== bot pintar (bot.js) =====
function applyDecision(st, uid, d) {
    if (d.type === 'roulette') R.resolveRoulette(st, d.color);
    else if (d.type === 'penalty') R.takePenalty(st, uid);
    else if (d.type === 'draw') { R.drawUntilPlayable(st, uid); }
    else if (d.type === 'play') { ok(R.isPlayableIn(st, uid, st.hands[uid][d.idx]), 'bot memilih kartu legal'); R.playCardOn(st, uid, d.idx, { color: d.color, target: d.target, callUno: Math.random() < B.UNO_CALL_CHANCE }); }
    else ok(false, 'keputusan bot tak dikenal');
}
function runGames(n, count, smartSet) {                                   // smartSet: uid yang memakai bot pintar; lainnya acak
    const res = { games: 0, unfinished: 0, wins: {}, mercyGames: 0, tot: 0 };
    for (let g = 0; g < count; g++) {
        S.roomData = { players: mkPlayers(n), status: 'playing' }; S.currentUser = { uid: 'p0' };
        const pl = S.roomData.players, st = D.dealGame(pl); S.roomData.gameState = st; let steps = 0, bad = false;
        while (!st.winner && steps++ < 4000) {
            const uid = R.actorUid(st);
            if (smartSet.has(uid)) applyDecision(st, uid, B.decide(st, pl, uid)); else botAct(st);
            if (total(st) !== 168) { ok(false, 'bot: total kartu bukan 168'); bad = true; break; }
        }
        res.games++; res.tot += steps;
        if (bad || !st.winner) { res.unfinished++; continue; }
        res.wins[st.winner] = (res.wins[st.winner] || 0) + 1; if (st.winBy === 'mercy') res.mercyGames++;
    }
    return res;
}
for (let n = 2; n <= 6; n++) {
    const all = new Set(mkPlayers(n).map(p => p.uid)); const r = runGames(n, 300, all);
    ok(r.unfinished === 0, `bot pintar vs bot pintar (${n} pemain): semua permainan selesai`);
    console.log(`Bot pintar x${n}: ${r.games} permainan, rata-rata ${(r.tot / r.games).toFixed(0)} langkah, menang Mercy ${(100 * r.mercyGames / r.games).toFixed(0)}%, tak selesai ${r.unfinished}`);
}
for (const n of [2, 3, 4]) {
    const r = runGames(n, 600, new Set(['p0'])); const rate = (r.wins.p0 || 0) / (r.games - r.unfinished);
    console.log(`1 bot pintar vs ${n - 1} bot acak: menang ${(100 * rate).toFixed(0)}% (acak murni = ${(100 / n).toFixed(0)}%)`);
    ok(rate > 1.2 / n, `bot pintar menang jauh lebih sering dari acak (${n} pemain)`);
}
console.log(fails ? `${fails} GAGAL dari ${checks} cek` : `SEMUA LULUS (${checks} cek)`);
process.exit(fails ? 1 : 0);
