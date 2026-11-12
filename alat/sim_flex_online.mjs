// Uji "online" mesin UNO Flex tanpa browser: tiap langkah state dikirim ke "Firestore palsu" (JSON + aturan Firestore),
// lalu pemain berikutnya melanjutkan dari salinan itu. Memeriksa: tidak ada array bersarang, ukuran < 1 MB,
// total kartu tetap 104, tiap permainan 2-8 pemain selesai, dan state hasil terima SAMA dengan yang dikirim.
// Jalankan: bash alat/sim_flex_online.sh
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const root = process.argv[2];
const { S, cloneState } = await import(root + '/js/core/state.js');
const D = await import(root + '/js/modes/flex/deck.js');
const R = await import(root + '/js/modes/flex/rules.js');
const B = await import(root + '/js/modes/flex/bot.js');

let fails = 0;
const bad = (msg) => { if (fails++ < 15) console.log('GAGAL:', msg); };

// aturan Firestore: array tidak boleh berisi array langsung; nilai undefined/fungsi ditolak; dokumen < 1 MiB
function firestoreCheck(v, path = '') {
    if (v === undefined || typeof v === 'function') bad('nilai tak valid di ' + path);
    if (Array.isArray(v)) v.forEach((x, i) => { if (Array.isArray(x)) bad('array bersarang di ' + path + '[' + i + ']'); firestoreCheck(x, path + '[' + i + ']'); });
    else if (v && typeof v === 'object') for (const k of Object.keys(v)) firestoreCheck(v[k], path + '.' + k);
}
// "Firestore": menolak undefined sebelum membersihkan (seperti SDK asli), lalu menyimpan salinan JSON
const cloud = { doc: null };
function write(state) {
    firestoreCheck(JSON.parse(JSON.stringify(state)));
    const raw = JSON.stringify(state);
    if (raw.length > 900000) bad('state terlalu besar: ' + raw.length);
    cloud.doc = JSON.parse(raw);
}
const total = (st) => st.deck.length + st.deckR.length + st.discardPile.length + Object.values(st.hands).reduce((a, h) => a + h.length, 0);

let games = 0, steps = 0, maxBytes = 0, finished = 0;
for (let n = 2; n <= 8; n++) {
    for (let g = 0; g < 25; g++) {
        const players = Array.from({ length: n }, (_, i) => ({ uid: 'u' + i, name: 'P' + i }));
        S.roomData = { mode: 'flex', hostId: 'u0', status: 'playing', players, gameState: null };
        write(D.dealGame(players));                       // host menekan Mulai
        let won = false, guard = 0;
        while (!won && guard++ < 4000) {
            S.roomData.gameState = cloud.doc;             // semua pemain menerima snapshot yang sama
            const st = cloneState();                      // pemain yang bertindak menyalin & mengubahnya
            const uid = R.actorUid(st);
            if (!players.some(p => p.uid === uid)) { bad('pelaku bukan pemain: ' + uid); break; }
            if (st.pending) { won = R.resolvePending(st, uid, B.answerPending()); }
            else {
                let mv = B.choosePlay(st, players, uid);
                if (!mv) {
                    const c = R.drawOneTurn(st, uid);
                    if (c && R.isPlayableIn(st, uid, c)) { const t = B.chooseTimeoutPlay(st, players, uid, st.hands[uid].length - 1); if (t) mv = t; }
                }
                if (mv) won = R.playCardOn(st, uid, mv.idx, { flex: mv.flex, color: mv.color, target: mv.target, callUno: Math.random() < 0.8 });
            }
            steps++;
            if (total(st) !== 104) bad('total kartu ' + total(st));
            maxBytes = Math.max(maxBytes, JSON.stringify(st).length);
            if (won) R.tallyRound(st);
            write(st);
            if (JSON.stringify(cloud.doc) !== JSON.stringify(JSON.parse(JSON.stringify(st)))) bad('state beda setelah dikirim');
        }
        games++; if (won) finished++; else bad(`permainan ${n} pemain tidak selesai`);
    }
}
console.log(`online-sim: ${games} permainan, ${steps} langkah, ${finished} selesai, state terbesar ${maxBytes} byte, gagal ${fails}`);
process.exit(fails ? 1 : 0);
