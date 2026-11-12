// Uji mesin UNO Flex (Node, tanpa DOM): uji unit tiap aturan + simulasi ratusan permainan 2-8 pemain.
// Jalankan: bash alat/sim_flex.sh
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const root = process.argv[2];
const { S } = await import(root + '/js/core/state.js');
const D = await import(root + '/js/modes/flex/deck.js');
const R = await import(root + '/js/modes/flex/rules.js');
const B = await import(root + '/js/modes/flex/bot.js');

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('GAGAL:', msg); } };
const mkPlayers = (n) => Array.from({ length: n }, (_, i) => ({ uid: 'p' + i, name: 'P' + i }));
const proto = D.buildDeck();
const card = (img) => { const c = proto.find(x => x.img === img); if (!c) throw new Error('kartu tak ada: ' + img); return JSON.parse(JSON.stringify(c)); };
const total = (st) => st.deck.length + st.deckR.length + st.discardPile.length + Object.values(st.hands).reduce((a, h) => a + h.length, 0);

// ----- komposisi dek -----
{
    const d = D.buildDeck();
    ok(d.length === 104, 'dek 104 kartu');
    ok(d.filter(c => c.fl).length === 16, '16 ikon Flip');
    ok(d.filter(c => c.c === 'Black').length === 16, '16 Wild');
    ok(d.filter(c => c.fv && c.c !== 'Black').length === 44, '44 kartu flex berwarna');
    ok(new Set(d.map(c => c.id)).size === 104, 'id unik');
}

// ----- skenario manual -----
function setup(n, hands, top, color) {
    S.roomData = { players: mkPlayers(n), status: 'playing', gameState: null };
    const st = D.dealGame(S.roomData.players);
    st.fx = { id: 'x', list: [] };
    const all = [...st.deck, ...st.deckR, ...Object.values(st.hands).flat(), ...st.discardPile];
    S.roomData.players.forEach((p, i) => { st.hands[p.uid] = (hands[i] && hands[i].length ? hands[i] : ['Red-1', 'Red-2', 'Red-3']).map(card); });
    st.discardPile = [card(top)]; st.currentColor = color || st.discardPile[0].c;
    st.turnIndex = 0; st.direction = 1;
    const used = new Set([...Object.values(st.hands).flat(), ...st.discardPile].map(c => c.id));
    const rest = all.filter(c => !used.has(c.id)); D.shuffle(rest); D.splitDeck(st, rest);
    S.roomData.gameState = st;
    return st;
}
const idxOfCard = (st, uid, img) => st.hands[uid].findIndex(c => c.img === img);
const play = (st, uid, img, opts) => R.playCardOn(st, uid, idxOfCard(st, uid, img), opts);

// Aturan kecocokan & sisi flex
{
    const st = setup(3, [['Blue-1-FlexRed', 'Red-1', 'Green-5']], 'Red-7');
    const bf = st.hands.p0[0];
    { const o = R.playOptions(st, 'p0', bf); ok(o.length === 1 && o[0].flex === true, 'Biru(flex Merah) pada Merah: hanya via sisi flex'); }
    st.power.p0 = false;
    ok(R.playOptions(st, 'p0', bf).length === 0, 'Power merah: sisi flex tidak boleh');
    st.power.p0 = true;
    play(st, 'p0', 'Blue-1-FlexRed', { flex: true });
    ok(st.currentColor === 'Blue', 'warna diteruskan = warna sisi biasa (Biru)');
    ok(st.power.p0 === false && st.power.p1 === true, 'Power pemain turun jadi merah setelah flex');
    ok(st.turnIndex === 1, 'giliran ke pemain berikut');
}
// Butir 6: kartu biasa cocok dengan WARNA FLEX kartu teratas, tetapi HARUS memakai Power
{
    const st = setup(3, [['Blue-4', 'Green-5', 'Blue-Skip']], 'Red-1-FlexBlue');   // teratas: oval Merah, flex Biru; warna berlaku Merah
    const b = st.hands.p0[0], g = st.hands.p0[1], sk = st.hands.p0[2];
    { const o = R.playOptions(st, 'p0', b); ok(o.length === 1 && o[0].flex === true && o[0].top === true, 'Biru(biasa) pada Merah-flexBiru: HANYA lewat Power (opsi flex+top)'); }
    ok(R.playOptions(st, 'p0', g).length === 0, 'Hijau tidak cocok');
    ok(R.playOptions(st, 'p0', sk).some(o => o.top), 'kartu aksi Biru juga bisa via Power');
    st.power.p0 = false;
    ok(R.playOptions(st, 'p0', b).length === 0, 'Power merah: tidak bisa');
    st.power.p0 = true;
    play(st, 'p0', 'Blue-4', { flex: true });
    ok(st.currentColor === 'Blue' && st.power.p0 === false && st.topFlex === false, 'dimainkan sisi biasa, warna Biru, Power jadi merah');
    ok(st.turnIndex === 1, 'giliran lanjut');
    const st2 = setup(3, [['Blue-4']], 'Black-WildAllFlip'); st2.currentColor = 'Red';
    ok(R.playOptions(st2, 'p0', st2.hands.p0[0]).length === 0, 'teratas Wild: tidak berlaku');
    const st3 = setup(3, [['Blue-4-FlexYellow']], 'Red-1-FlexBlue');             // kartu punya sisi flex sendiri, tapi cocok hanya via sisi flex teratas
    play(st3, 'p0', 'Blue-4-FlexYellow', { flex: true });
    ok(st3.currentColor === 'Blue' && st3.topFlex === false && st3.power.p0 === false, 'kartu berflex dimainkan sisi biasa lewat Power (bukan sisi flexnya)');
}
// Ikon Flip & reset otomatis
{
    const st = setup(2, [['Red-2', 'Red-1', 'Green-5'], ['Red-3', 'Red-4']], 'Red-7');
    play(st, 'p0', 'Red-2');                                    // ikon Flip: hijau -> merah
    ok(st.power.p0 === false && st.power.p1 === true, 'ikon Flip membalik Power sendiri');
    st.turnIndex = 0; st.power.p1 = false;                       // p1 merah, p0 merah -> belum direset karena set manual; sekarang balik p0 lewat ikon Flip lagi
    const st2 = setup(2, [['Red-2', 'Red-1'], ['Red-3']], 'Red-7');
    st2.power.p0 = false; st2.power.p1 = false;                  // semua merah (keadaan tak lazim) lalu ikon Flip -> p0 hijau, tidak semua merah
    play(st2, 'p0', 'Red-2'); ok(st2.power.p0 === true && st2.power.p1 === false, 'merah -> hijau lewat ikon Flip');
    const st3 = setup(2, [['Blue-1-FlexRed', 'Red-1'], ['Red-3']], 'Red-7'); st3.power.p1 = false;
    play(st3, 'p0', 'Blue-1-FlexRed', { flex: true });           // p0 merah + p1 merah -> reset semua hijau
    ok(st3.power.p0 === true && st3.power.p1 === true, 'reset otomatis saat semua merah');
}
// Wild All Flip
{
    const st = setup(3, [['Black-WildAllFlip', 'Red-1'], ['Red-1'], ['Red-1']], 'Red-7'); st.power.p1 = false;
    play(st, 'p0', 'Black-WildAllFlip', { color: 'Green' });
    ok(st.power.p0 === false && st.power.p1 === true && st.power.p2 === false, 'Wild All Flip membalik semua Power');
    ok(st.currentColor === 'Green', 'Wild All Flip: warna dipilih');
}
// Efek flex: Draw Two, Skip, Reverse
{
    const st = setup(4, [['Red-DrawTwo-Flex', 'Red-1'], [], [], []], 'Red-7'); const t = total(st);
    play(st, 'p0', 'Red-DrawTwo-Flex', { flex: true });
    ok(['p1', 'p2', 'p3'].every(u => st.hands[u].length === 4) && st.turnIndex === 1 && total(st) === t, 'Flex Draw Two: semua lawan +1, pemain berikut tidak dilewati');
    const s2 = setup(4, [['Red-DrawTwo', 'Red-1']], 'Red-7'); play(s2, 'p0', 'Red-DrawTwo'); ok(s2.hands.p1.length === 5 && s2.turnIndex === 2, 'Draw Two biasa +2 & lewati');
    const s3 = setup(4, [['Red-Skip-Flex', 'Red-1']], 'Red-7'); play(s3, 'p0', 'Red-Skip-Flex', { flex: true }); ok(s3.turnIndex === 0, 'Flex Skip: giliran kembali ke pemain');
    const s4 = setup(4, [['Red-Reverse-Flex', 'Red-1']], 'Red-7'); play(s4, 'p0', 'Red-Reverse-Flex', { flex: true }); ok(s4.direction === -1 && s4.turnIndex === 2, 'Flex Reverse (4 pemain): arah berbalik, p3 dilewati, giliran p2');
    const s5 = setup(2, [['Red-Reverse-Flex', 'Red-1']], 'Red-7'); play(s5, 'p0', 'Red-Reverse-Flex', { flex: true }); ok(s5.turnIndex === 0, 'Flex Reverse (2 pemain): giliran kembali');
    const s6 = setup(3, [['Red-Reverse', 'Red-1']], 'Red-7'); play(s6, 'p0', 'Red-Reverse'); ok(s6.direction === -1 && s6.turnIndex === 2, 'Reverse biasa');
}
// Wild flex
{
    const st = setup(4, [['Black-WildFlexAllDraw2', 'Red-1'], [], [], []], 'Red-7'); const t = total(st);
    play(st, 'p0', 'Black-WildFlexAllDraw2', { flex: true, color: 'Blue' });
    ok(['p1', 'p2', 'p3'].every(u => st.hands[u].length === 5) && st.turnIndex === 1 && st.currentColor === 'Blue' && total(st) === t, 'Wild All Draw 2');
    const s2 = setup(4, [['Black-WildFlexTargetDraw2', 'Red-1'], [], [], []], 'Red-7');
    play(s2, 'p0', 'Black-WildFlexTargetDraw2', { flex: true, color: 'Green', target: 'p3' });
    ok(s2.hands.p3.length === 5 && s2.hands.p1.length === 3 && s2.turnIndex === 1, 'Wild Target Draw 2: hanya target +2, tidak ada yang dilewati');
    const s3 = setup(4, [['Black-WildFlexTargetDraw2', 'Red-1'], [], [], []], 'Red-7');
    play(s3, 'p0', 'Black-WildFlexTargetDraw2', { flex: false, color: 'Green' });
    ok(s3.hands.p1.length === 3 && s3.hands.p3.length === 3 && s3.power.p0 === true, 'Wild Target sisi biasa = Wild biasa, Power tetap');
}
// Wild Draw 4: sisi biasa
{
    let st = setup(3, [['Black-WildDrawFourFlexTarget4', 'Red-1', 'Green-5'], [], []], 'Red-7');   // p0 masih punya Red-1 -> bersalah
    play(st, 'p0', 'Black-WildDrawFourFlexTarget4', { color: 'Blue' });
    ok(st.pending && st.pending.answerer === 'p1' && st.turnIndex === 1, 'Draw 4 biasa: p1 menjawab');
    ok(R.playOptions(st, 'p1', st.hands.p1[0]).length === 0, 'kartu lain tidak bisa dimainkan saat pending');
    const n0 = st.hands.p0.length; R.resolvePending(st, 'p1', 'challenge');
    ok(st.hands.p0.length === n0 + 4 && st.hands.p1.length === 3 && st.turnIndex === 1, 'tantangan BENAR: pemain Wild +4, penantang main');
    st = setup(3, [['Black-WildDrawFourFlexTarget4', 'Green-5', 'Green-6'], [], []], 'Red-7');   // tidak punya Merah -> tidak bersalah
    play(st, 'p0', 'Black-WildDrawFourFlexTarget4', { color: 'Blue' });
    R.resolvePending(st, 'p1', 'challenge');
    ok(st.hands.p1.length === 3 + 6 && st.turnIndex === 2, 'tantangan SALAH: penantang +6 dan dilewati');
    st = setup(3, [['Black-WildDrawFourFlexTarget4', 'Black-WildAllFlip'], [], []], 'Red-7');   // kartu hitam di tangan dihitung cocok
    play(st, 'p0', 'Black-WildDrawFourFlexTarget4', { color: 'Blue' }); const w = st.hands.p0.length;
    R.resolvePending(st, 'p1', 'challenge'); ok(st.hands.p0.length === w + 4, 'Wild di tangan dihitung cocok (bersalah)');
    st = setup(3, [['Black-WildDrawFourFlexTarget4', 'Blue-2-FlexRed'], [], []], 'Red-7');   // Biru(flex Merah): sisi flex TIDAK dihitung -> tidak bersalah
    play(st, 'p0', 'Black-WildDrawFourFlexTarget4', { color: 'Green' });
    R.resolvePending(st, 'p1', 'challenge'); ok(st.hands.p1.length === 9, 'sisi flex tidak dihitung sebagai kartu cocok');
    st = setup(3, [['Black-WildDrawFourFlexTarget4', 'Green-5'], [], []], 'Red-7');
    play(st, 'p0', 'Black-WildDrawFourFlexTarget4', { color: 'Green' }); R.resolvePending(st, 'p1', 'draw');
    ok(st.hands.p1.length === 7 && st.turnIndex === 2, 'ambil 4 lalu dilewati');
}
// Wild Draw 4: sisi flex (target, bisa ditantang)
{
    let st = setup(4, [['Black-WildDrawFourFlexTarget4', 'Red-1'], [], [], []], 'Red-7');
    play(st, 'p0', 'Black-WildDrawFourFlexTarget4', { flex: true, color: 'Blue', target: 'p3' });
    ok(st.pending.answerer === 'p3' && st.power.p0 === false, 'target4: p3 menjawab, Power p0 merah');
    R.resolvePending(st, 'p3', 'draw'); ok(st.hands.p3.length === 7 && st.hands.p1.length === 3 && st.turnIndex === 1, 'target4 ambil: giliran lanjut ke pemain berikut (p1), tidak ada yang dilewati');
    st = setup(4, [['Black-WildDrawFourFlexTarget4', 'Red-1'], [], [], []], 'Red-7');
    play(st, 'p0', 'Black-WildDrawFourFlexTarget4', { flex: true, color: 'Blue', target: 'p2' });
    const n = st.hands.p0.length; R.resolvePending(st, 'p2', 'challenge');
    ok(st.hands.p0.length === n + 4 && st.hands.p2.length === 3 && st.turnIndex === 1, 'target4 tantangan BENAR');
    st = setup(4, [['Black-WildDrawFourFlexTarget4', 'Green-5'], [], [], []], 'Red-7');
    play(st, 'p0', 'Black-WildDrawFourFlexTarget4', { flex: true, color: 'Blue', target: 'p2' });
    R.resolvePending(st, 'p2', 'challenge'); ok(st.hands.p2.length === 9 && st.turnIndex === 1, 'target4 tantangan SALAH: target +6, giliran ke p1');
}
// Kartu terakhir
{
    let st = setup(3, [['Black-WildDrawFourFlexTarget4'], ['Red-1'], ['Red-1']], 'Red-7');
    const won = play(st, 'p0', 'Black-WildDrawFourFlexTarget4', { color: 'Blue' });
    ok(!won && st.pendingWinner === 'p0', 'kartu terakhir Wild Draw 4: tunggu jawaban');
    ok(R.resolvePending(st, 'p1', 'challenge') && st.winner === 'p0', 'tantangan pasti SALAH, lalu menang');
    st = setup(3, [['Red-5'], ['Red-1'], ['Red-1']], 'Red-7'); ok(play(st, 'p0', 'Red-5') && st.winner === 'p0', 'kartu terakhir angka: langsung menang');
    st = setup(3, [['Red-DrawTwo'], ['Red-1'], ['Red-1']], 'Red-7'); ok(play(st, 'p0', 'Red-DrawTwo') && st.hands.p1.length === 3, 'kartu terakhir +2: efek jalan lalu menang');
    R.tallyRound(st); ok(st.roundPts === ['p1', 'p2'].reduce((a, u) => a + st.hands[u].reduce((b, c) => b + D.pointOf(c), 0), 0) && st.roundDetail.length === 2, 'Total Skor = poin kartu sisa semua lawan');
}
// Poin
ok(D.pointOf(card('Red-7')) === 7 && D.pointOf(card('Red-Skip')) === 20 && D.pointOf(card('Red-DrawTwo-Flex')) === 20 && D.pointOf(card('Black-WildAllFlip')) === 50, 'poin kartu');

// ----- simulasi -----
let brainMoves = 0, timeoutMoves = 0;
function brain(st, players) {                      // kebijakan bot sungguhan (bot.js) + uji legalitas langkah
    if (st.pending) { ok(R.actorUid(st) === st.pending.answerer, 'actorUid = answerer saat pending'); return R.resolvePending(st, st.pending.answerer, B.answerPending()); }
    const uid = players[st.turnIndex].uid;
    ok(R.actorUid(st) === uid, 'actorUid = pemegang giliran');
    let mv = Math.random() < 0.1 ? B.chooseTimeoutPlay(st, players, uid) : B.choosePlay(st, players, uid);   // 10%: main otomatis saat waktu habis
    if (mv) {
        const c = st.hands[uid][mv.idx];
        ok(R.playOptions(st, uid, c).some(o => o.flex === mv.flex), 'langkah bot legal (kartu & sisi)');
        ok(mv.flex === false || R.powerGreen(st, uid), 'sisi flex hanya saat Power hijau');
        if (c.c === 'Black') ok(D.COLORS.includes(mv.color), 'warna Wild valid');
        if (mv.flex && /^Target/.test(c.fv || '')) ok(mv.target && mv.target !== uid, 'target valid');
        brainMoves++;
        return R.playCardOn(st, uid, mv.idx, { flex: mv.flex, color: mv.color, target: mv.target, callUno: Math.random() < 0.8 });
    }
    const c = R.drawOneTurn(st, uid);
    if (c) {
        const t = B.chooseTimeoutPlay(st, players, uid, st.hands[uid].length - 1); if (t) { timeoutMoves++; return R.playCardOn(st, uid, t.idx, { flex: t.flex, color: t.color, target: t.target, callUno: true }); }
    }
    R.advance(st); return false;
}
function bot(st, players) {
    const n = players.length;
    if (BRAIN) return brain(st, players);
    if (st.pending) {
        const a = st.pending.answerer;
        return R.resolvePending(st, a, Math.random() < 0.3 ? 'challenge' : 'draw');
    }
    const uid = players[st.turnIndex].uid, hand = st.hands[uid];
    const choose = (card, opt) => {
        const cnt = {}; hand.forEach(c => { if (c !== card && c.c !== 'Black') cnt[c.c] = (cnt[c.c] || 0) + 1; });
        const color = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || D.COLORS[Math.floor(Math.random() * 4)];
        const others = players.filter(p => p.uid !== uid);
        const target = others.sort((a, b) => st.hands[a.uid].length - st.hands[b.uid].length)[0].uid;
        return { flex: opt.flex, color, target, callUno: Math.random() < 0.85 };
    };
    const moves = [];
    hand.forEach((c, i) => R.playOptions(st, uid, c).forEach(o => moves.push([i, o])));
    if (moves.length) {
        const reg = moves.filter(m => !m[1].flex); const pool = reg.length && Math.random() < 0.7 ? reg : moves;
        const [i, o] = pool[Math.floor(Math.random() * pool.length)];
        return R.playCardOn(st, uid, i, choose(hand[i], o));
    }
    const c = R.drawOneTurn(st, uid);
    if (c) {
        const opts = R.playOptions(st, uid, c);
        if (opts.length && Math.random() < 0.8) return R.playCardOn(st, uid, hand.length - 1, choose(c, opts[0]));
    }
    R.advance(st); return false;
}
function invariants(st, players, tag) {
    ok(total(st) === 104, `${tag}: total kartu ${total(st)} != 104`);
    ok(st.turnIndex >= 0 && st.turnIndex < players.length, `${tag}: turnIndex di luar rentang`);
    ok(!players.every(p => !st.power[p.uid]), `${tag}: semua Power merah bertahan`);
    ok(players.every(p => typeof st.power[p.uid] === 'boolean'), `${tag}: Power tak lengkap`);
    ok(JSON.stringify(st) !== undefined, `${tag}: state tak bisa di-JSON`);
}
let BRAIN = false;
const stats = { games: 0, steps: 0, flex: 0, challenges: 0, stuck: 0, byN: {} };
for (let n = 2; n <= 8; n++) {
    for (let g = 0; g < 60; g++) {
        BRAIN = g >= 30;   // 30 permainan kebijakan acak + 30 dengan otak bot.js
        const players = mkPlayers(n); S.roomData = { players, status: 'playing', gameState: null };
        let st = D.dealGame(players); S.roomData.gameState = st;
        ok(players.every(p => st.hands[p.uid].length === 7) && D.isNum(R.topCard(st)), 'bagi 7 & kartu pertama angka');
        let finished = false;
        for (let step = 0; step < 4000 && !finished; step++) {
            st.fx = { id: 'x', list: [] };
            finished = bot(st, players);
            stats.steps++;
            if (step % 7 === 0 || finished) invariants(st, players, `n=${n} g=${g} step=${step}`);
            stats.flex += st.fx.list.filter(e => e.t === 'play' && e.flex).length;
            stats.challenges += st.fx.list.filter(e => e.t === 'challenge').length;
        }
        if (!finished) { stats.stuck++; console.log('GAGAL: permainan tidak selesai n=' + n); fails++; }
        else { ok(st.hands[st.winner].length === 0, 'pemenang tangan kosong'); R.tallyRound(st); }
        stats.games++;
    }
}
console.log(`Bot.js: ${brainMoves} langkah bot, ${timeoutMoves} main-otomatis setelah ambil kartu`);
console.log(`Simulasi: ${stats.games} permainan (2-8 pemain), ${stats.steps} langkah, ${stats.flex} kartu sisi flex, ${stats.challenges} tantangan, macet ${stats.stuck}`);
console.log(fails === 0 ? 'SEMUA UJI LULUS' : `GAGAL: ${fails} pemeriksaan`);
process.exit(fails ? 1 : 0);
