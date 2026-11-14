// Suara permainan: semua dibuat langsung di browser (Web Audio), jadi TIDAK perlu file audio.
// - Musik latar ceria (chiptune 30 detik, berulang)
// - Efek: kartu, UNO, tertangkap, +2/+4/+6, skip, reverse, ganti warna (4 bunyi), tantangan benar/salah,
//   acak, giliranmu, hitungan 5 detik terakhir, menang/kalah, dll.
// - Suara perkataan (Skip, Reverse, Draw two/four/six, nama warna, UNO, Caught, UNO Game) lewat speechSynthesis bawaan browser
// - Volume Musik & Efek (geser di menu jeda) + tombol bisu. Pengaturan tersimpan di perangkat.

const KEY = 'uno_sound';
const cfg = Object.assign({ music: 0.6, sfx: 0.9, mute: false }, (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })());
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* abaikan */ } };

let ctx = null, master = null, musicBus = null, duckBus = null, sfxBus = null, noiseBuf = null, pulse = null;
let wantMusic = false;   // false | 'game' | 'menu' (lagu yang diinginkan)
let curTrack = 'game';

// ---------------------------------------------------------------- dasar
function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
        ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        master = ctx.createGain();
        master.connect(comp); comp.connect(ctx.destination);
        duckBus = ctx.createGain(); duckBus.connect(master);
        musicBus = ctx.createGain(); musicBus.connect(duckBus);
        sfxBus = ctx.createGain(); sfxBus.connect(master);
        // gelombang kotak 25% (suara game klasik)
        const n = 32, re = new Float32Array(n), im = new Float32Array(n);
        for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25) * 2;
        pulse = ctx.createPeriodicWave(re, im);
        // derau untuk hentakan/desis
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        applyVolume();
    } catch (e) { ctx = null; }
    return ctx;
}

function applyVolume() {
    if (!ctx) return;
    const t = ctx.currentTime;
    musicBus.gain.setTargetAtTime(cfg.mute ? 0 : cfg.music * 0.5, t, 0.05);
    sfxBus.gain.setTargetAtTime(cfg.mute ? 0 : cfg.sfx, t, 0.05);
}

// Browser memblokir suara sebelum ada sentuhan pertama: aktifkan saat pemain menyentuh layar
function unlock() {
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    if (wantMusic) startMusic(wantMusic);
}
['pointerdown', 'touchstart', 'keydown'].forEach(e => window.addEventListener(e, unlock, { passive: true }));
document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
});

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Satu nada dengan selubung volume. f2 = geser frekuensi ke nada lain.
function tone({ f = 440, f2 = null, type = 'square', t = 0, dur = 0.2, vol = 0.3, atk = 0.005, bus = null, filter = null, wave = null, vib = 0 }) {
    const c = ctx, at = c.currentTime + t;
    const o = c.createOscillator(), g = c.createGain();
    if (wave === 'pulse' && pulse) o.setPeriodicWave(pulse); else o.type = type;
    o.frequency.setValueAtTime(f, at);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vol, at + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    let node = o;
    if (filter) {
        const fl = c.createBiquadFilter();
        fl.type = filter.type || 'lowpass'; fl.frequency.value = filter.f; fl.Q.value = filter.q || 0.7;
        o.connect(fl); node = fl;
    }
    node.connect(g); g.connect(bus || sfxBus);
    if (vib) {   // getaran nada (vibrato)
        const lfo = c.createOscillator(), lg = c.createGain();
        lfo.frequency.value = 6; lg.gain.value = vib;
        lfo.connect(lg); lg.connect(o.frequency);
        lfo.start(at); lfo.stop(at + dur + 0.05);
    }
    o.start(at); o.stop(at + dur + 0.05);
}

// Desis/hentakan dari derau
function noise({ t = 0, dur = 0.1, vol = 0.3, type = 'bandpass', f = 2000, f2 = null, q = 1, bus = null }) {
    const c = ctx, at = c.currentTime + t;
    const s = c.createBufferSource(); s.buffer = noiseBuf;
    s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, at);
    if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(20, f2), at + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vol, at + Math.min(0.01, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(fl); fl.connect(g); g.connect(bus || sfxBus);
    s.start(at, Math.random()); s.stop(at + dur + 0.05);
}

// Musik mengecil sebentar saat ada efek penting
function duck(sec = 0.8, to = 0.35) {
    if (!ctx) return;
    const t = ctx.currentTime;
    duckBus.gain.cancelScheduledValues(t);
    duckBus.gain.setTargetAtTime(to, t, 0.03);
    duckBus.gain.setTargetAtTime(1, t + sec, 0.25);
}

// ---------------------------------------------------------------- efek suara
const note = (m) => mtof(m);
const SFX = {
    click() { tone({ f: 900, f2: 700, type: 'square', dur: 0.05, vol: 0.12 }); },

    // kartu
    card() { noise({ dur: 0.16, vol: 0.22, f: 2600, f2: 700, q: 0.8 }); },
    slap() { noise({ dur: 0.07, vol: 0.3, type: 'lowpass', f: 3000 }); tone({ f: 200, f2: 80, type: 'sine', dur: 0.1, vol: 0.35 }); },
    draw() { noise({ dur: 0.12, vol: 0.16, type: 'highpass', f: 3500, f2: 1500 }); tone({ f: 1400, f2: 900, type: 'triangle', dur: 0.05, vol: 0.06 }); },
    deal() { noise({ dur: 0.045, vol: 0.2, f: 3800, q: 1.2 }); },
    nope() { tone({ f: 170, type: 'sawtooth', dur: 0.16, vol: 0.14, filter: { f: 700 } }); tone({ f: 140, type: 'sawtooth', t: 0.1, dur: 0.18, vol: 0.14, filter: { f: 600 } }); },
    turn() { tone({ f: note(76), type: 'triangle', dur: 0.18, vol: 0.22 }); tone({ f: note(81), type: 'triangle', t: 0.1, dur: 0.3, vol: 0.22 }); tone({ f: note(88), type: 'sine', t: 0.1, dur: 0.3, vol: 0.06 }); },
    tick(n = 0) { tone({ f: n ? 1500 : 1000, type: 'square', dur: 0.05, vol: 0.12 }); },

    // UNO!
    uno() {   // kilau kecil, lalu terdengar kata "Uno!"
        duck(1.4);
        [[79, 0], [84, 0.07]].forEach(([m, t]) => tone({ f: note(m), type: 'square', t, dur: 0.1, vol: 0.12, filter: { f: 3500 } }));
        noise({ t: 0.1, dur: 0.3, vol: 0.1, type: 'highpass', f: 6000 });
    },

    // palu: terayun (desis naik), lalu "bonk" kayu + dentuman saat menghantam; setelah itu terdengar kata "Caught!"
    swing() {
        noise({ dur: 0.85, vol: 0.14, f: 400, f2: 2800, q: 1.5 });
        tone({ f: 260, f2: 900, type: 'triangle', dur: 0.8, vol: 0.05 });
    },
    catch() {
        duck(1.6);
        tone({ f: 900, f2: 320, type: 'square', dur: 0.07, vol: 0.35, filter: { f: 2200 } });
        tone({ f: 1500, f2: 500, type: 'triangle', dur: 0.06, vol: 0.25 });
        tone({ f: 140, f2: 45, type: 'sine', dur: 0.3, vol: 0.7 });
        noise({ dur: 0.12, vol: 0.55, type: 'lowpass', f: 2200 });
    },

    // kartu aksi
    draw2() {
        duck(1);
        [[72, 0], [79, 0.12]].forEach(([m, t]) => { tone({ f: note(m), f2: note(m + 5), type: 'sine', t, dur: 0.14, vol: 0.35 }); tone({ f: note(m + 12), type: 'triangle', t, dur: 0.1, vol: 0.1 }); });
        noise({ t: 0.22, dur: 0.1, vol: 0.12, f: 4000 });
    },
    draw4() {
        duck(1.4);
        [55, 59, 62, 67, 71].forEach((m, i) => { tone({ f: note(m), type: 'sawtooth', t: i * 0.1, dur: 0.16, vol: 0.2, filter: { f: 1600 } }); });
        tone({ f: note(79), wave: 'pulse', t: 0.5, dur: 0.6, vol: 0.18, vib: 8 });
        tone({ f: note(43), type: 'sine', t: 0.5, dur: 0.6, vol: 0.5 });
        noise({ t: 0.5, dur: 0.5, vol: 0.28, type: 'lowpass', f: 2500, f2: 300 });
    },
    // +6 karena tantangan salah: sirene naik + ledakan
    draw6() {
        duck(2);
        for (let i = 0; i < 6; i++) tone({ f: note(60 + i * 2), type: 'square', t: i * 0.08, dur: 0.1, vol: 0.17, filter: { f: 3000 } });
        tone({ f: 500, f2: 1400, type: 'sawtooth', t: 0.5, dur: 0.35, vol: 0.14, filter: { f: 2500 } });
        tone({ f: note(36), f2: note(24), type: 'sine', t: 0.85, dur: 0.7, vol: 0.7 });
        noise({ t: 0.85, dur: 0.8, vol: 0.4, type: 'lowpass', f: 3500, f2: 200 });
    },
    skip() {
        duck(0.8);
        tone({ f: 900, f2: 180, type: 'square', dur: 0.28, vol: 0.2, filter: { f: 2500 } });
        tone({ f: 120, type: 'sine', t: 0.28, dur: 0.14, vol: 0.5 });
        noise({ t: 0.28, dur: 0.08, vol: 0.2, type: 'lowpass', f: 1500 });
    },
    reverse() {
        duck(0.9);
        noise({ dur: 0.5, vol: 0.2, f: 500, f2: 4000, q: 1.2 });
        noise({ t: 0.5, dur: 0.5, vol: 0.2, f: 4000, f2: 500, q: 1.2 });
        tone({ f: 330, f2: 1320, type: 'triangle', dur: 0.45, vol: 0.18 });
        tone({ f: 1320, f2: 330, type: 'triangle', t: 0.45, dur: 0.45, vol: 0.18 });
    },
    shuffle() {
        duck(5.5, 0.4);
        for (let i = 0; i < 7; i++) noise({ t: i * 0.24, dur: 0.22, vol: 0.14, f: 900 + i * 300, f2: 3000, q: 0.9 });   // dikumpulkan
        for (let i = 0; i < 34; i++) noise({ t: 1.7 + i * 0.058 + Math.random() * 0.02, dur: 0.04, vol: 0.18, f: 2500 + Math.random() * 3000, q: 1.5 });   // dikocok
        tone({ f: 220, f2: 880, type: 'triangle', t: 1.7, dur: 2, vol: 0.05 });
        for (let i = 0; i < 7; i++) noise({ t: 3.75 + i * 0.24, dur: 0.22, vol: 0.14, f: 3000, f2: 900 + i * 200, q: 0.9 });          // dibagikan
        tone({ f: note(84), type: 'sine', t: 5.3, dur: 0.4, vol: 0.12 });
    },

    // pilih warna Wild: roda berputar lalu warna terpilih
    spin() {
        let t = 0, gap = 0.04;
        for (let i = 0; i < 18; i++) { tone({ f: 1100 + (i % 4) * 90, type: 'square', t, dur: 0.03, vol: 0.1 }); t += gap; gap *= 1.09; }
    },
    // warna Wild: hanya diucapkan ("Red", "Yellow", "Blue", "Green"), musik mengecil sebentar
    c_Red() { duck(0.9); },
    c_Yellow() { duck(0.9); },
    c_Blue() { duck(0.9); },
    c_Green() { duck(0.9); },
    // ---- UNO Flip ----
    c_Pink() { duck(0.9); }, c_Teal() { duck(0.9); }, c_Orange() { duck(0.9); }, c_Purple() { duck(0.9); },
    draw1() { duck(0.8); tone({ f: note(76), f2: note(81), type: 'sine', dur: 0.14, vol: 0.3 }); noise({ t: 0.12, dur: 0.08, vol: 0.1, f: 4000 }); },
    // +5 (sisi gelap): lima dentuman rendah menaik, bergema seram
    draw5() {
        duck(1.5);
        [43, 44, 46, 47, 49].forEach((m, i) => { tone({ f: note(m), f2: note(m - 7), type: 'sine', t: i * 0.11, dur: 0.22, vol: 0.5 }); noise({ t: i * 0.11, dur: 0.07, vol: 0.2, type: 'lowpass', f: 1400 }); });
        tone({ f: note(55), type: 'sawtooth', t: 0.1, dur: 0.6, vol: 0.12, filter: { f: 700, q: 3 }, vib: 6 });
        tone({ f: note(31), f2: note(24), type: 'sine', t: 0.6, dur: 0.8, vol: 0.7 });
        noise({ t: 0.6, dur: 0.7, vol: 0.3, type: 'lowpass', f: 2500, f2: 150 });
    },
    // Skip Everyone: rantai "wuuss" turun beruntun (semua dilewati) lalu gong
    skipall() {
        duck(1.5);
        for (let i = 0; i < 4; i++) {
            tone({ f: 1100 - i * 120, f2: 140, type: 'square', t: i * 0.17, dur: 0.2, vol: 0.14, filter: { f: 2200 } });
            noise({ t: i * 0.17, dur: 0.18, vol: 0.12, f: 3500, f2: 500, q: 1.1 });
        }
        tone({ f: 110, type: 'sine', t: 0.72, dur: 0.9, vol: 0.55 });
        tone({ f: 165, type: 'triangle', t: 0.72, dur: 0.8, vol: 0.2, vib: 5 });
        noise({ t: 0.72, dur: 0.35, vol: 0.2, type: 'lowpass', f: 1800 });
    },
    // hitung mundur awal permainan
    cdTick() { tone({ f: 660, type: 'square', dur: 0.12, vol: 0.14, filter: { f: 2500 } }); },
    cdLast() { tone({ f: 880, type: 'square', dur: 0.16, vol: 0.18, filter: { f: 3000 } }); },
    cdGo() { duck(1); [72, 76, 79, 84].forEach((m, i) => tone({ f: note(m), type: 'square', t: i * 0.06, dur: 0.22, vol: 0.14, filter: { f: 3500 } })); noise({ dur: 0.2, vol: 0.12, type: 'highpass', f: 6000 }); },
    // Wild Draw Color: pusaran 4 warna (arpeggio bergemerlap menaik, minor) lalu hentakan berat
    wdc() {
        duck(1.8);
        [57, 60, 63, 67, 69, 72, 75, 79].forEach((m, i) => { tone({ f: note(m), type: 'triangle', t: i * 0.07, dur: 0.18, vol: 0.2 }); tone({ f: note(m + 12), type: 'sine', t: i * 0.07, dur: 0.12, vol: 0.07 }); });
        noise({ dur: 0.6, vol: 0.14, f: 500, f2: 5000, q: 1.3 });
        tone({ f: note(45), type: 'sawtooth', t: 0.6, dur: 0.5, vol: 0.2, filter: { f: 900 } });
        tone({ f: note(33), f2: note(26), type: 'sine', t: 0.6, dur: 0.7, vol: 0.65 });
        noise({ t: 0.6, dur: 0.5, vol: 0.3, type: 'lowpass', f: 2800, f2: 200 });
    },
    flip() { duck(1.1); noise({ dur: 0.45, vol: 0.2, f: 600, f2: 5000, q: 0.7 }); tone({ f: 300, f2: 900, type: 'triangle', dur: 0.3, vol: 0.18 }); tone({ f: 900, f2: 300, type: 'triangle', t: 0.32, dur: 0.3, vol: 0.14 }); },

    // tantangan +4
    challengeRight() {   // penantang benar: "ta-da!"
        duck(1.6);
        [[72, 0], [76, 0.09], [79, 0.18], [84, 0.27]].forEach(([m, t]) => tone({ f: note(m), type: 'square', t, dur: 0.12, vol: 0.18, filter: { f: 3500 } }));
        [72, 76, 79, 84].forEach(m => tone({ f: note(m), wave: 'pulse', t: 0.4, dur: 0.8, vol: 0.13, vib: 4 }));
        noise({ t: 0.4, dur: 0.5, vol: 0.12, type: 'highpass', f: 7000 });
    },
    challengeWrong() {   // penantang salah: "wah wah waaah" sedih
        duck(1.8);
        [[196, 0], [185, 0.28], [175, 0.56], [165, 0.84]].forEach(([f, t], i) =>
            tone({ f, f2: i === 3 ? f * 0.85 : null, type: 'sawtooth', t, dur: i === 3 ? 0.8 : 0.27, vol: 0.2, filter: { f: 1100, q: 1.5 }, vib: i === 3 ? 14 : 0 }));
    },

    // akhir permainan
    win() {   // fanfare "UNO! Game!"
        duck(4, 0.15);
        const ft = (m, t, d, v = 0.2) => { tone({ f: note(m), type: 'square', t, dur: d, vol: v, filter: { f: 3500 } }); tone({ f: note(m - 12), type: 'sawtooth', t, dur: d, vol: v * 0.5, filter: { f: 1200 } }); };
        ft(67, 0, 0.14); ft(67, 0.16, 0.14); ft(67, 0.32, 0.14); ft(72, 0.48, 0.4);
        ft(70, 0.92, 0.14); ft(72, 1.08, 0.14); ft(74, 1.24, 0.14); ft(79, 1.4, 0.7, 0.24);
        [79, 84, 88, 91].forEach(m => tone({ f: note(m), wave: 'pulse', t: 2.2, dur: 1.4, vol: 0.14, vib: 5 }));
        tone({ f: note(48), type: 'sine', t: 2.2, dur: 1.3, vol: 0.5 });
        noise({ t: 2.2, dur: 1.2, vol: 0.2, type: 'highpass', f: 5000 });
        for (let i = 0; i < 10; i++) tone({ f: note(84 + (i * 7) % 12), type: 'sine', t: 2.4 + i * 0.1, dur: 0.3, vol: 0.07 });   // kilau
    },
    lose() {
        duck(2.5, 0.2);
        [[67, 0], [64, 0.25], [60, 0.5], [55, 0.8]].forEach(([m, t], i) =>
            tone({ f: note(m), type: 'triangle', t, dur: i === 3 ? 0.9 : 0.24, vol: 0.28, vib: i === 3 ? 6 : 0 }));
    }
};

// ---- UNO Flex: bunyi kartu flex (memakai ulang bunyi serupa bila artinya mirip, ditambah perkataan sendiri) ----
SFX.draw1all = SFX.draw1;          // semua lawan +1
SFX.alldraw2 = SFX.draw2;          // semua lawan +2
SFX.target2 = SFX.draw2;           // pemain ditunjuk +2
SFX.target4 = SFX.draw4;           // pemain ditunjuk +4
SFX.revskip = SFX.reverse;         // balik arah + lewati
// ---- Efek khusus All Wild ----
// Wild Skip Two: dua "wuss" turun beruntun + dentuman ganda (dua pemain dilewati)
SFX.skip2 = function () {
    duck(1.4);
    [0, 0.27].forEach((t, i) => {
        tone({ f: 1000 - i * 150, f2: 170, type: 'square', t, dur: 0.22, vol: 0.17, filter: { f: 2400 } });
        noise({ t, dur: 0.16, vol: 0.12, f: 3500, f2: 600, q: 1.1 });
        tone({ f: 130 - i * 15, type: 'sine', t: t + 0.2, dur: 0.13, vol: 0.5 });
    });
    tone({ f: 98, type: 'sine', t: 0.62, dur: 0.6, vol: 0.5 });
    noise({ t: 0.62, dur: 0.25, vol: 0.16, type: 'lowpass', f: 1600 });
};
// Wild Forced Swap: kipasan kartu, dua nada saling bersilang naik-turun, lalu "ting" tanda tukar selesai
SFX.swap = function () {
    duck(1.2);
    for (let i = 0; i < 5; i++) noise({ t: i * 0.06, dur: 0.05, vol: 0.16, f: 3400 + i * 220, q: 1.2 });
    tone({ f: note(64), f2: note(88), type: 'triangle', dur: 0.4, vol: 0.16 });
    tone({ f: note(88), f2: note(64), type: 'triangle', t: 0.05, dur: 0.4, vol: 0.16 });
    for (let i = 0; i < 5; i++) noise({ t: 0.32 + i * 0.06, dur: 0.05, vol: 0.16, f: 4400 - i * 220, q: 1.2 });
    tone({ f: note(84), type: 'sine', t: 0.66, dur: 0.3, vol: 0.3 });
    tone({ f: note(91), type: 'sine', t: 0.72, dur: 0.38, vol: 0.22 });
};
// Wild Targeted Draw Two: bidikan (bip makin cepat) -> kunci -> hantaman -> dua nada ambil kartu
SFX.awtarget2 = function () {
    duck(1.4);
    [0, 0.14, 0.26, 0.36].forEach((t, i) => tone({ f: 1300 + i * 180, type: 'square', t, dur: 0.07, vol: 0.13, filter: { f: 3500 } }));
    tone({ f: note(96), type: 'sine', t: 0.46, dur: 0.22, vol: 0.22, vib: 6 });
    tone({ f: 110, f2: 45, type: 'sine', t: 0.5, dur: 0.18, vol: 0.55 });
    noise({ t: 0.5, dur: 0.1, vol: 0.2, f: 2600, q: 0.8 });
    [[72, 0.7], [79, 0.82]].forEach(([m, t]) => { tone({ f: note(m), f2: note(m + 5), type: 'sine', t, dur: 0.14, vol: 0.35 }); tone({ f: note(m + 12), type: 'triangle', t, dur: 0.1, vol: 0.1 }); });
};
// Power Card berbalik: dua "tik" kartu lalu denting naik (hijau) / turun (merah)
SFX.power = function () {
    duck(0.9);
    noise({ dur: 0.1, vol: 0.18, f: 3000, f2: 900, q: 0.8 });
    tone({ f: note(79), f2: note(91), type: 'triangle', t: 0.08, dur: 0.16, vol: 0.2 });
    tone({ f: note(91), f2: note(79), type: 'triangle', t: 0.26, dur: 0.18, vol: 0.16 });
};

SFX.allflip = SFX.power;           // Wild All Flip: nada Power + kata "All flip!"
SFX.reset = SFX.power;             // semua Power merah -> kembali hijau: nada Power + kata "Reset!"

// ---- Efek khusus UNO Show 'Em No Mercy (nuansa lebih gelap & berat) ----
// +10: delapan nada gergaji menanjak, sirene naik, lalu ledakan sangat dalam
SFX.draw10 = function () {
    duck(2.4, 0.25);
    for (let i = 0; i < 8; i++) tone({ f: note(52 + i * 2), type: 'sawtooth', t: i * 0.07, dur: 0.14, vol: 0.17, filter: { f: 2800 } });
    tone({ f: 380, f2: 1900, type: 'sawtooth', t: 0.5, dur: 0.5, vol: 0.15, filter: { f: 3000 } });
    tone({ f: note(31), f2: note(19), type: 'sine', t: 0.95, dur: 1.1, vol: 0.8 });
    tone({ f: note(43), type: 'sawtooth', t: 0.95, dur: 0.8, vol: 0.15, filter: { f: 600 }, vib: 7 });
    noise({ t: 0.95, dur: 1.1, vol: 0.5, type: 'lowpass', f: 4000, f2: 120 });
};
// Wild Reverse Draw 4: desis balik arah (naik lalu turun), lalu hantaman +4
SFX.revdraw4 = function () {
    duck(1.8);
    noise({ dur: 0.32, vol: 0.2, f: 500, f2: 4000, q: 1.2 });
    noise({ t: 0.32, dur: 0.32, vol: 0.2, f: 4000, f2: 500, q: 1.2 });
    [55, 59, 62, 67].forEach((m, i) => tone({ f: note(m), type: 'sawtooth', t: 0.6 + i * 0.08, dur: 0.15, vol: 0.18, filter: { f: 1600 } }));
    tone({ f: note(43), f2: note(31), type: 'sine', t: 0.95, dur: 0.6, vol: 0.55 });
    noise({ t: 0.95, dur: 0.4, vol: 0.25, type: 'lowpass', f: 2500, f2: 250 });
};
// Kartu 0 (oper): putaran desis berurutan searah jarum jam, lalu "tuk"
SFX.pass = function () {
    duck(1.4);
    for (let i = 0; i < 4; i++) {
        noise({ t: i * 0.13, dur: 0.2, vol: 0.15, f: 700 + i * 500, f2: 1600 + i * 600, q: 1.2 });
        tone({ f: note(60 + i * 3), f2: note(66 + i * 3), type: 'triangle', t: i * 0.13, dur: 0.16, vol: 0.13 });
    }
    tone({ f: note(84), type: 'sine', t: 0.62, dur: 0.3, vol: 0.22 });
    noise({ t: 0.62, dur: 0.06, vol: 0.15, f: 3000, q: 1 });
};
// MERCY: lonceng kematian (nada dasar + sisa nada sumbang) dan dentuman rendah menurun
SFX.mercy = function () {
    duck(2.6, 0.2);
    tone({ f: note(45), type: 'sine', dur: 1.8, vol: 0.5, vib: 3 });
    tone({ f: note(45) * 2.76, type: 'sine', dur: 1.2, vol: 0.14 });
    tone({ f: note(45) * 5.4, type: 'sine', dur: 0.7, vol: 0.07 });
    [57, 53, 48, 43].forEach((m, i) => tone({ f: note(m), type: 'sawtooth', t: 0.35 + i * 0.22, dur: 0.3, vol: 0.14, filter: { f: 900 } }));
    tone({ f: 90, f2: 28, type: 'sine', t: 1.1, dur: 1.2, vol: 0.8 });
    noise({ t: 1.1, dur: 1, vol: 0.4, type: 'lowpass', f: 2000, f2: 100 });
};
// Discard All: desis mengumpulkan, tik kartu menurun, lalu "gedebuk" saat semuanya jatuh ke tumpukan
SFX.discardall = function () {
    duck(1.9);
    noise({ dur: 0.9, vol: 0.16, f: 400, f2: 3800, q: 1.3 });
    for (let i = 0; i < 5; i++) noise({ t: 0.15 + i * 0.12, dur: 0.05, vol: 0.18, f: 3600 - i * 350, q: 1.2 });
    tone({ f: note(55), f2: note(43), type: 'sawtooth', t: 0.95, dur: 0.4, vol: 0.14, filter: { f: 900 } });
};
// Color Roulette: roda berputar (klik makin lambat) lalu "ting"
SFX.roulette = function () {
    duck(1.8);
    let t = 0, gap = 0.035;
    for (let i = 0; i < 22; i++) { tone({ f: 900 + (i % 5) * 110, type: 'square', t, dur: 0.03, vol: 0.11 }); t += gap; gap *= 1.1; }
    tone({ f: note(88), type: 'sine', t: t + 0.05, dur: 0.35, vol: 0.2 });
};
SFX.rtap = function () {      // ketukan tumpukan saat Roulette: kartu dibuka (tegang)
    noise({ dur: 0.07, vol: 0.14, type: 'highpass', f: 3000 });
    tone({ f: 500, f2: 900, type: 'triangle', dur: 0.08, vol: 0.1 });
};
SFX.rmiss = function () { tone({ f: 220, f2: 150, type: 'sawtooth', dur: 0.14, vol: 0.12, filter: { f: 800 } }); };   // bukan warnanya
SFX.rhit = function () {      // dapat warna yang dicari: denting naik
    duck(0.7);
    [[84, 0], [91, 0.08], [96, 0.16]].forEach(([m, t]) => tone({ f: note(m), type: 'sine', t, dur: 0.22, vol: 0.26 }));
    noise({ t: 0.16, dur: 0.2, vol: 0.08, type: 'highpass', f: 6500 });
};
// Stack bertambah: dentuman + dua nada yang makin tinggi makin banyak yang ditumpuk (arg = jumlah kartu yang ditumpuk)
SFX.stackup = function (n = 1) {
    const m = 58 + Math.min(10, Math.max(1, n)) * 2;
    tone({ f: 110, f2: 55, type: 'sine', dur: 0.16, vol: 0.45 });
    tone({ f: note(m), type: 'square', dur: 0.11, vol: 0.16, filter: { f: 2600 } });
    tone({ f: note(m + 7), type: 'square', t: 0.07, dur: 0.14, vol: 0.14, filter: { f: 2600 } });
};

// getaran singkat di HP (Android) untuk momen besar
const VIBE = { catch: [60, 40, 120], draw4: [80, 40, 80], draw6: [100, 50, 100, 50, 200], draw10: [100, 40, 100, 40, 100, 40, 300], mercy: [100, 50, 250], discardall: [40, 30, 40, 30, 140], win: [80, 60, 80, 60, 240], challengeWrong: [150] };

// ---------------------------------------------------------------- suara perkataan
// Memakai suara bawaan perangkat (speechSynthesis), jadi tidak perlu file audio.
// Bentuk: [teks, tinggi nada, kecepatan, tunda (detik)]
const VOICE = {
    skip: ['Skip!', 1.2, 1.0, 0.05],
    reverse: ['Reverse!', 1.2, 1.0, 0.05],
    draw2: ['Draw two!', 1.2, 1.0, 0.05],
    draw4: ['Draw four!', 1.1, 1.0, 0.05],
    draw6: ['Draw six!', 1.0, 0.95, 0.05],
    uno: ['Uno!', 1.3, 1.0, 0.1],
    catch: ['Caught!', 1.1, 1.05, 0.5],
    c_Red: ['Red', 1.1, 1.0, 0],
    c_Yellow: ['Yellow', 1.1, 1.0, 0],
    c_Blue: ['Blue', 1.1, 1.0, 0],
    c_Green: ['Green', 1.1, 1.0, 0],
    c_Pink: ['Pink', 1.1, 1.0, 0],
    c_Teal: ['Teal', 1.1, 1.0, 0],
    c_Orange: ['Orange', 1.1, 1.0, 0],
    c_Purple: ['Purple', 1.1, 1.0, 0],
    draw1: ['Draw one!', 1.2, 1.0, 0.05],
    draw5: ['Draw five!', 1.1, 1.0, 0.05],
    skipall: ['Skip everyone!', 1.1, 1.0, 0.05],
    wdc: ['Draw color!', 1.1, 1.0, 0.05],
    flip: ['Flip!', 1.2, 1.0, 0.1],
    draw1all: ['Everyone draw one!', 1.2, 1.0, 0.05],
    alldraw2: ['Everyone draw two!', 1.1, 1.0, 0.05],
    target2: ['Draw two!', 1.2, 1.0, 0.05],
    target4: ['Draw four!', 1.1, 1.0, 0.05],
    revskip: ['Reverse skip!', 1.2, 1.0, 0.05],
    skip2: ['Skip two!', 1.1, 1.0, 0.05],
    swap: ['Swap!', 1.2, 1.0, 0.05],
    awtarget2: ['Draw two!', 1.2, 1.0, 0.5],
    power: ['Flex power!', 1.2, 1.0, 0.25],
    allflip: ['All flip!', 1.2, 1.0, 0.25],
    reset: ['Reset!', 1.2, 1.0, 0.25],
    draw10: ['Draw ten!', 0.9, 0.95, 0.05],
    revdraw4: ['Reverse draw four!', 1.1, 1.0, 0.05],
    pass: ['Pass!', 1.2, 1.0, 0.05],
    mercy: ['No mercy!', 0.7, 0.85, 0.35],
    discardall: ['Discard all!', 1.1, 1.0, 0.05],
    roulette: ['Color roulette!', 1.1, 1.0, 0.05]
};
let voiceObj = null;
function pickVoice() {
    if (!('speechSynthesis' in window)) return null;
    const list = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
    voiceObj = list.find(v => /US/i.test(v.lang) && /google|samantha|aria|jenny|female/i.test(v.name)) || list.find(v => /US/i.test(v.lang)) || list[0] || null;
    return voiceObj;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', pickVoice); }

function speak(text, pitch = 1.1, rate = 1, delay = 0, onend = null) {
    let done = false;
    const end = () => { if (!done) { done = true; if (onend) onend(); } };
    try {
        if (cfg.mute || cfg.sfx <= 0 || !('speechSynthesis' in window)) { setTimeout(end, 0); return; }
        const go = () => {
            try {
                speechSynthesis.cancel();   // kata lama dihentikan agar tidak menumpuk
                const u = new SpeechSynthesisUtterance(text);
                const v = voiceObj || pickVoice();
                if (v) u.voice = v;
                u.lang = (v && v.lang) || 'en-US';
                u.pitch = pitch; u.rate = rate; u.volume = Math.min(1, cfg.sfx);
                u.onend = end; u.onerror = end;
                speechSynthesis.speak(u);
            } catch (e) { end(); }
            setTimeout(end, 3000);   // pengaman: jangan menunggu selamanya
        };
        if (delay > 0) setTimeout(go, delay * 1000); else go();
    } catch (e) { end(); }
}

// Kata "UNO game!" lalu selesai (dipakai sebelum layar poin muncul)
export function sayAsync(text = 'Uno game!') {
    return new Promise(res => speak(text, 1.2, 0.95, 0, res));
}

export function sfx(name, delay = 0, arg) {
    try {
        if (VOICE[name]) { const [t, p, r, d] = VOICE[name]; speak(t, p, r, d + delay); }
        if (cfg.mute || cfg.sfx <= 0 || !ensure() || !SFX[name]) return;
        const play = () => {
            if (delay > 0) setTimeout(() => { try { SFX[name](arg); } catch (e) { /* abaikan */ } }, delay * 1000);
            else SFX[name](arg);
            if (VIBE[name] && navigator.vibrate) setTimeout(() => { try { navigator.vibrate(VIBE[name]); } catch (e) { /* abaikan */ } }, delay * 1000);
        };
        if (ctx.state === 'running') play();
        else if (ctx.state === 'suspended') ctx.resume().then(() => { if (ctx.state === 'running') play(); }).catch(() => {});   // belum aktif: aktifkan dulu lalu bunyikan
    } catch (e) { /* suara tidak boleh merusak permainan */ }
}

export const soundStatus = () => ({ ctx: ctx ? ctx.state : 'belum dibuat', speech: 'speechSynthesis' in window, voices: ('speechSynthesis' in window) ? speechSynthesis.getVoices().length : 0, mute: cfg.mute, sfx: cfg.sfx });

// ---------------------------------------------------------------- musik latar
// Tempo 126 bpm, 16 birama (30 detik), nada dasar C mayor: I - vi - IV - V ...
const BPM = 126, STEP = 60 / BPM / 2;   // 1 langkah = not 1/8
const CHORDS = [   // [akar bass, nada akor]
    [36, [60, 64, 67]], [33, [57, 60, 64]], [41, [57, 60, 65]], [43, [59, 62, 67]],
    [36, [60, 64, 67]], [33, [57, 60, 64]], [41, [57, 60, 65]], [43, [59, 62, 67]],
    [41, [57, 60, 65]], [43, [59, 62, 67]], [40, [59, 64, 67]], [33, [57, 60, 64]],
    [41, [57, 60, 65]], [43, [59, 62, 67]], [36, [60, 64, 67]], [43, [59, 62, 67]]
];
const MELODY = [   // 8 not per birama; 0 = diam, -1 = tahan nada sebelumnya
    [76, -1, 79, 76, 72, -1, 76, 79], [81, -1, 79, 76, 72, 76, -1, -1], [77, -1, 81, 77, 72, -1, 77, 81], [79, -1, 77, 74, 71, 74, 79, -1],
    [76, -1, 79, 76, 84, -1, 79, 76], [81, -1, 84, 81, 79, -1, 76, 72], [77, -1, 81, 84, 81, -1, 77, 72], [74, 76, 77, 79, 81, 79, 77, 74],
    [77, -1, 77, 81, 77, -1, 72, 77], [79, -1, 79, 83, 79, -1, 74, 79], [76, -1, 79, 83, 79, -1, 76, 71], [81, -1, 76, 72, 76, 81, -1, -1],
    [77, -1, 81, 77, 84, -1, 81, 77], [79, -1, 83, 79, 86, -1, 83, 79], [84, -1, 79, 76, 72, 76, 79, 84], [83, -1, 79, 74, 71, 74, 79, -1]
];
const TOTAL = CHORDS.length * 8;
let musicTimer = null, nextT = 0, stepNo = 0, musicOn = false;

function playStep(n, at) {
    const bar = Math.floor(n / 8), s = n % 8, off = at - ctx.currentTime;
    const [root, ch] = CHORDS[bar];
    // bass (segitiga): akar - kuinta bergantian
    if (s % 2 === 0) tone({ f: mtof(s === 2 || s === 6 ? root + 7 : root), type: 'triangle', t: off, dur: STEP * 1.7, vol: 0.5, bus: musicBus });
    // arpeggio akor (kotak 25%)
    const a = ch[[0, 1, 2, 1, 0, 1, 2, 1][s]] + 12;
    tone({ f: mtof(a), wave: 'pulse', t: off, dur: STEP * 0.8, vol: 0.09, bus: musicBus });
    // melodi (kotak)
    const m = MELODY[bar][s];
    if (m > 0) {
        let len = 1;
        while (s + len < 8 && MELODY[bar][s + len] === -1) len++;
        tone({ f: mtof(m), type: 'square', t: off, dur: STEP * len * 0.92, vol: 0.12, bus: musicBus, filter: { f: 2600 }, vib: len > 1 ? 3 : 0 });
    }
    // drum
    if (s === 0 || s === 4) { tone({ f: 150, f2: 45, type: 'sine', t: off, dur: 0.16, vol: 0.7, bus: musicBus }); }
    if (s === 2 || s === 6) noise({ t: off, dur: 0.12, vol: 0.28, f: 1800, q: 0.6, bus: musicBus });
    if (s % 2 === 1) noise({ t: off, dur: 0.04, vol: 0.12, type: 'highpass', f: 7000, bus: musicBus });
    if (n === TOTAL - 1) noise({ t: off, dur: 0.12, vol: 0.28, f: 1800, q: 0.6, bus: musicBus });   // gebrakan penutup putaran
}


// ---- Lagu beranda/lobi: lebih pelan dan lembut (92 bpm, G mayor, 16 birama ~42 detik), beda dari lagu game ----
const MSTEP = 60 / 92 / 2;
const MCH = { G: [43, [55, 59, 62]], Em: [40, [52, 55, 59]], C: [36, [48, 52, 55]], D: [38, [50, 54, 57]], Bm: [35, [47, 50, 54]] };
const MCHORDS = ['G', 'Em', 'C', 'D', 'G', 'Bm', 'C', 'D', 'G', 'Em', 'C', 'D', 'G', 'Bm', 'C', 'D'].map(k => MCH[k]);
const MMELODY = [
    [74, -1, -1, 71, 67, -1, 71, 74], [76, -1, -1, 74, 71, -1, 67, -1], [72, -1, 76, -1, 79, -1, 76, 72], [74, -1, -1, 69, 74, -1, 78, -1],
    [79, -1, -1, 74, 71, -1, 74, 79], [78, -1, -1, 74, 71, -1, 74, 78], [76, -1, 72, -1, 67, -1, 72, 76], [74, -1, -1, -1, 69, -1, 74, -1],
    [79, -1, 74, 79, 83, -1, 79, 74], [76, -1, 79, 76, 71, -1, 76, 79], [84, -1, 79, 76, 72, -1, 76, 79], [78, -1, 74, 78, 81, -1, 78, 74],
    [79, -1, 83, 79, 74, -1, 71, 74], [78, -1, 81, 78, 74, -1, 71, 74], [76, -1, 79, 76, 72, -1, 67, 72], [74, -1, -1, 69, 74, -1, -1, -1]
];
const MTOTAL = MCHORDS.length * 8;

function playMenuStep(n, at) {
    const bar = Math.floor(n / 8), s = n % 8, off = at - ctx.currentTime;
    const [root, ch] = MCHORDS[bar];
    if (s === 0 || s === 4) tone({ f: mtof(root), type: 'triangle', t: off, dur: MSTEP * 3.4, vol: 0.5, bus: musicBus });
    // arpeggio lembut (sinus, seperti lonceng kecil)
    tone({ f: mtof(ch[[0, 1, 2, 1, 2, 1, 2, 1][s]] + 12), type: 'sine', t: off, dur: MSTEP * 1.7, vol: 0.16, bus: musicBus });
    // melodi (segitiga, seperti seruling)
    const m = MMELODY[bar][s];
    if (m > 0) {
        let len = 1;
        while (s + len < 8 && MMELODY[bar][s + len] === -1) len++;
        tone({ f: mtof(m), type: 'triangle', t: off, dur: MSTEP * len * 0.95, vol: 0.2, bus: musicBus, filter: { f: 3200 }, vib: len > 1 ? 4 : 0 });
    }
    if (s === 0) tone({ f: 110, f2: 45, type: 'sine', t: off, dur: 0.18, vol: 0.4, bus: musicBus });                 // kick pelan
    if (s === 4) noise({ t: off, dur: 0.09, vol: 0.12, f: 1600, q: 0.6, bus: musicBus });                           // snare lembut
    if (s % 2 === 1) noise({ t: off, dur: 0.03, vol: 0.05, type: 'highpass', f: 8000, bus: musicBus });             // hi-hat tipis
}


// ---- Lagu UNO Flip: dua lagu berbeda dari klasik, satu untuk sisi terang dan satu untuk sisi gelap ----
// Terang: 138 bpm, D mayor, riang & berkilau. Gelap: 100 bpm, A minor, berat & misterius.
const LSTEP = 60 / 138 / 2;
const LCH = { D: [38, [62, 66, 69]], Bm: [35, [59, 62, 66]], G: [43, [55, 59, 62]], A: [45, [57, 61, 64]], F: [42, [61, 64, 66]] };
const LCHORDS = ['D', 'Bm', 'G', 'A', 'D', 'Bm', 'G', 'A', 'G', 'A', 'Bm', 'F', 'G', 'A', 'D', 'A'].map(k => LCH[k]);
const LMELODY = [
    [78, -1, 81, 78, 74, -1, 78, 81], [83, -1, 81, 78, 74, -1, 78, -1], [79, -1, 83, 79, 74, -1, 79, 83], [81, -1, 85, 81, 76, -1, 81, 85],
    [86, -1, 85, 81, 78, -1, 81, 85], [83, -1, 86, 83, 78, -1, 83, 86], [83, -1, 79, 74, 79, -1, 83, -1], [85, -1, 81, 76, 81, 85, -1, -1],
    [79, -1, 83, 86, 83, -1, 79, -1], [81, -1, 85, 88, 85, -1, 81, -1], [83, -1, 78, 83, 86, -1, 83, 78], [85, -1, 81, 78, 81, -1, 85, -1],
    [86, -1, 83, 79, 83, 86, -1, -1], [85, -1, 81, 85, 88, -1, 85, 81], [86, -1, 81, 78, 74, 78, 81, 86], [85, -1, 81, 76, 73, 76, 81, -1]
];
const LTOTAL = LCHORDS.length * 8;
function playFlipLightStep(n, at) {
    const bar = Math.floor(n / 8), s = n % 8, off = at - ctx.currentTime;
    const [root, ch] = LCHORDS[bar];
    tone({ f: mtof(s % 2 ? root + 12 : root), type: 'triangle', t: off, dur: LSTEP * 0.9, vol: 0.42, bus: musicBus });          // bass memantul (oktaf)
    tone({ f: mtof(ch[[0, 1, 2, 1, 2, 1, 0, 2][s]] + 24), type: 'sine', t: off, dur: LSTEP * 0.7, vol: 0.13, bus: musicBus });   // arpeggio lonceng tinggi
    const m = LMELODY[bar][s];
    if (m > 0) {
        let len = 1;
        while (s + len < 8 && LMELODY[bar][s + len] === -1) len++;
        tone({ f: mtof(m), wave: 'pulse', t: off, dur: LSTEP * len * 0.9, vol: 0.13, bus: musicBus, filter: { f: 3400 }, vib: len > 1 ? 4 : 0 });
    }
    if (s === 0 || s === 4) tone({ f: 140, f2: 45, type: 'sine', t: off, dur: 0.15, vol: 0.65, bus: musicBus });
    if (s === 2 || s === 6) noise({ t: off, dur: 0.07, vol: 0.2, f: 3000, q: 0.8, bus: musicBus });                              // tepukan
    if (s % 2 === 1) noise({ t: off, dur: 0.03, vol: 0.1, type: 'highpass', f: 8500, bus: musicBus });
}

const DSTEP = 60 / 100 / 2;
const DCH = { Am: [33, [57, 60, 64]], F: [29, [53, 57, 60]], C: [36, [55, 60, 64]], E: [40, [56, 59, 64]], Dm: [38, [53, 57, 62]], G: [31, [55, 59, 62]] };
const DCHORDS = ['Am', 'F', 'C', 'E', 'Am', 'F', 'Dm', 'E', 'Am', 'F', 'C', 'G', 'F', 'Dm', 'E', 'Am'].map(k => DCH[k]);
const DMELODY = [
    [76, -1, -1, 72, 69, -1, -1, -1], [77, -1, -1, 72, 69, -1, 72, -1], [76, -1, 72, -1, 67, -1, 72, -1], [71, -1, -1, 76, 80, -1, -1, -1],
    [81, -1, -1, 76, 72, -1, -1, -1], [77, -1, -1, 81, 77, -1, 72, -1], [74, -1, 77, -1, 81, -1, 77, 74], [76, -1, 80, -1, 83, -1, 80, -1],
    [81, -1, 76, -1, 72, -1, 76, -1], [77, -1, -1, 72, 77, -1, 81, -1], [79, -1, 76, -1, 72, -1, 67, -1], [74, -1, 79, -1, 83, -1, 79, -1],
    [77, -1, 81, -1, 84, -1, 81, 77], [74, -1, 77, -1, 81, -1, 77, -1], [76, -1, 80, -1, 83, -1, -1, -1], [81, -1, -1, -1, 69, -1, -1, -1]
];
const DTOTAL = DCHORDS.length * 8;
function playFlipDarkStep(n, at) {
    const bar = Math.floor(n / 8), s = n % 8, off = at - ctx.currentTime;
    const [root, ch] = DCHORDS[bar];
    if (s === 0) ch.forEach(c => tone({ f: mtof(c), type: 'sine', t: off, dur: DSTEP * 7.5, vol: 0.07, bus: musicBus }));         // pad panjang
    if (s % 2 === 0) tone({ f: mtof(root), type: 'sawtooth', t: off, dur: DSTEP * 1.8, vol: s === 0 ? 0.3 : 0.17, bus: musicBus, filter: { f: 420 } });
    const m = DMELODY[bar][s];
    if (m > 0) {
        let len = 1;
        while (s + len < 8 && DMELODY[bar][s + len] === -1) len++;
        tone({ f: mtof(m), type: 'sine', t: off, dur: DSTEP * len * 0.95, vol: 0.22, bus: musicBus, vib: len > 1 ? 5 : 0 });
        tone({ f: mtof(m + 12), type: 'sine', t: off, dur: DSTEP * len * 0.6, vol: 0.05, bus: musicBus });
    }
    if (s === 0 && bar % 4 === 0) tone({ f: mtof(93), type: 'sine', t: off, dur: 1.2, vol: 0.05, bus: musicBus });                   // denting tinggi misterius
    if (s === 0 || s === 4) tone({ f: 100, f2: 38, type: 'sine', t: off, dur: 0.24, vol: 0.75, bus: musicBus });                    // kick dalam
    if (s === 6) tone({ f: 190, f2: 90, type: 'sine', t: off, dur: 0.16, vol: 0.35, bus: musicBus });                               // tom
    if (s === 2) noise({ t: off, dur: 0.1, vol: 0.12, f: 900, q: 0.5, bus: musicBus });
}

// ---- Lagu UNO Flex: groove dapur yang santai-funky (112 bpm, F mayor, 16 birama), beda dari semua lagu lain ----
const XSTEP = 60 / 112 / 2;
const XCH = { F: [41, [57, 60, 65]], Dm: [38, [57, 62, 65]], Bb: [34, [58, 62, 65]], C: [36, [55, 60, 64]], Gm: [43, [58, 62, 67]] };
const XCHORDS = ['F', 'Dm', 'Bb', 'C', 'F', 'Dm', 'Bb', 'C', 'Gm', 'C', 'F', 'Dm', 'Bb', 'C', 'F', 'C'].map(k => XCH[k]);
const XMELODY = [
    [72, -1, 69, 72, 77, -1, 72, 69], [69, -1, 74, 69, 65, -1, 69, 74], [70, -1, 74, 77, 74, -1, 70, 74], [72, -1, 76, 72, 67, -1, 72, 76],
    [77, -1, 76, 72, 69, -1, 72, 77], [74, -1, 77, 74, 69, -1, 65, 69], [74, -1, 77, 81, 77, -1, 74, 70], [72, -1, -1, 67, 72, -1, 76, -1],
    [74, -1, 70, 74, 79, -1, 74, 70], [76, -1, 72, 76, 79, -1, 76, 72], [77, -1, 81, 77, 72, -1, 77, 81], [74, -1, 77, 81, 77, -1, 74, 69],
    [70, -1, 74, 77, 82, -1, 77, 74], [72, -1, 76, 79, 76, -1, 72, 67], [77, -1, 72, 69, 72, -1, 77, -1], [79, -1, 76, 72, 67, -1, 72, -1]
];
const XTOTAL = XCHORDS.length * 8;
function playFlexStep(n, at) {
    const bar = Math.floor(n / 8), s = n % 8, off = at - ctx.currentTime;
    const [root, ch] = XCHORDS[bar];
    // bass funky (segitiga memantul)
    if (s === 0 || s === 3 || s === 6) tone({ f: mtof(s === 3 ? root + 12 : root), type: 'triangle', t: off, dur: XSTEP * 1.5, vol: 0.5, bus: musicBus });
    if (s === 5) tone({ f: mtof(root + 7), type: 'triangle', t: off, dur: XSTEP * 0.9, vol: 0.32, bus: musicBus });
    // sentakan akor di ketukan lemah
    if (s === 2 || s === 5 || s === 7) ch.forEach(c => tone({ f: mtof(c), type: 'square', t: off, dur: XSTEP * 0.5, vol: 0.045, bus: musicBus, filter: { f: 1800 } }));
    const m = XMELODY[bar][s];
    if (m > 0) {
        let len = 1;
        while (s + len < 8 && XMELODY[bar][s + len] === -1) len++;
        tone({ f: mtof(m), wave: 'pulse', t: off, dur: XSTEP * len * 0.88, vol: 0.12, bus: musicBus, filter: { f: 3000 }, vib: len > 1 ? 4 : 0 });
        tone({ f: mtof(m + 12), type: 'sine', t: off, dur: XSTEP * 0.5, vol: 0.04, bus: musicBus });
    }
    if (s === 0 || s === 3) tone({ f: 130, f2: 42, type: 'sine', t: off, dur: 0.15, vol: 0.62, bus: musicBus });                       // kick
    if (s === 4) noise({ t: off, dur: 0.1, vol: 0.24, f: 2200, q: 0.7, bus: musicBus });                                               // snare
    if (s % 2 === 1) noise({ t: off, dur: 0.03, vol: 0.1, type: 'highpass', f: 8000, bus: musicBus });                                // hi-hat
    if (s === 7 && bar % 2 === 1) noise({ t: off + XSTEP * 0.5, dur: 0.06, vol: 0.12, type: 'highpass', f: 6500, bus: musicBus });     // hi-hat buka
}

// ---- Lagu UNO All Wild: petualangan luar angkasa (118 bpm, E minor, 16 birama): pad lebar, bass gergaji, kilau bintang, melodi terang ----
const WSTEP = 60 / 118 / 2;
const WCH = { Em: [40, [64, 67, 71]], C: [36, [60, 64, 67]], G: [43, [59, 62, 67]], D: [38, [62, 66, 69]], Am: [45, [60, 64, 69]], B7: [35, [63, 66, 69]] };
const WCHORDS = ['Em', 'C', 'G', 'D', 'Em', 'C', 'G', 'B7', 'Am', 'Em', 'C', 'D', 'Em', 'C', 'D', 'B7'].map(k => WCH[k]);
const WMELODY = [
    [76, -1, 83, -1, 81, 79, 76, -1], [84, -1, 79, -1, 76, 79, 84, -1], [83, -1, 79, -1, 74, 79, 83, -1], [78, -1, 81, -1, 86, -1, 81, 78],
    [76, 79, 83, -1, 88, -1, 83, 79], [84, -1, 88, -1, 84, 79, 76, -1], [79, 83, 86, -1, 83, -1, 79, 74], [78, -1, 81, -1, 87, -1, 83, -1],
    [81, -1, 84, -1, 88, -1, 84, 81], [83, -1, 79, 76, 79, -1, 83, -1], [84, -1, 88, -1, 91, -1, 88, 84], [86, -1, 81, 78, 81, -1, 86, -1],
    [88, -1, 83, -1, 79, 83, 88, -1], [84, -1, 79, -1, 76, -1, 79, 84], [86, -1, 90, -1, 86, 81, 78, -1], [83, -1, 87, -1, 83, 81, 78, 0]
];
const WTOTAL = WCHORDS.length * 8;
function playAllWildStep(n, at) {
    const bar = Math.floor(n / 8), s = n % 8, off = at - ctx.currentTime;
    const [root, ch] = WCHORDS[bar];
    if (s === 0) ch.forEach(c => tone({ f: mtof(c), type: 'sine', t: off, dur: WSTEP * 7.6, vol: 0.05, atk: 0.25, bus: musicBus }));        // pad panjang
    // bass gergaji tersaring: akar panjang, lalu sentakan oktaf dan kuinta
    if (s === 0) tone({ f: mtof(root), type: 'sawtooth', t: off, dur: WSTEP * 2.6, vol: 0.2, bus: musicBus, filter: { f: 520 } });
    if (s === 3) tone({ f: mtof(root + 12), type: 'sawtooth', t: off, dur: WSTEP * 0.9, vol: 0.12, bus: musicBus, filter: { f: 700 } });
    if (s === 4) tone({ f: mtof(root), type: 'sawtooth', t: off, dur: WSTEP * 1.8, vol: 0.17, bus: musicBus, filter: { f: 520 } });
    if (s === 7) tone({ f: mtof(root + 7), type: 'sawtooth', t: off, dur: WSTEP * 0.9, vol: 0.1, bus: musicBus, filter: { f: 650 } });
    // kilau bintang: arpeggio sinus tinggi di ketukan lemah
    if (s % 2 === 1) tone({ f: mtof(ch[(s >> 1) % 3] + 24), type: 'sine', t: off, dur: WSTEP * 0.8, vol: 0.06, bus: musicBus });
    const m = WMELODY[bar][s];
    if (m > 0) {
        let len = 1;
        while (s + len < 8 && WMELODY[bar][s + len] === -1) len++;
        tone({ f: mtof(m), type: 'triangle', t: off, dur: WSTEP * len * 0.92, vol: 0.2, bus: musicBus, filter: { f: 3600 }, vib: len > 1 ? 5 : 0 });
        tone({ f: mtof(m + 12), type: 'sine', t: off, dur: WSTEP * Math.min(len, 2) * 0.6, vol: 0.05, bus: musicBus });
    }
    if (s === 0 || s === 4) tone({ f: 120, f2: 42, type: 'sine', t: off, dur: 0.17, vol: 0.6, bus: musicBus });                              // kick
    if (s === 2 || s === 6) noise({ t: off, dur: 0.2, vol: 0.16, f: 1500, q: 0.5, bus: musicBus });                                           // tepukan berekor
    if (s % 2 === 1) noise({ t: off, dur: 0.03, vol: 0.07, type: 'highpass', f: 8500, bus: musicBus });                                       // hi-hat tipis
    if (s === 7 && bar % 4 === 3) noise({ t: off + WSTEP * 0.5, dur: 0.14, vol: 0.14, f: 2200, q: 0.6, bus: musicBus });                      // gebrakan tiap 4 birama
}

// ---- Lagu UNO Show 'Em No Mercy: gelap & agresif (136 bpm, D minor, 16 birama): bass gergaji berdenyut, kick 4 ketukan, sirene tipis, melodi pulse tajam ----
const NSTEP = 60 / 136 / 2;
const NCH = { Dm: [38, [62, 65, 69]], Bb: [34, [58, 62, 65]], Gm: [43, [58, 62, 67]], A: [45, [61, 64, 69]], C: [36, [60, 64, 67]] };
const NCHORDS = ['Dm', 'Dm', 'Bb', 'A', 'Dm', 'Dm', 'Gm', 'A', 'Dm', 'Bb', 'C', 'A', 'Gm', 'Bb', 'A', 'A'].map(k => NCH[k]);
const NMELODY = [
    [74, -1, 77, -1, 81, -1, 77, 74], [76, -1, 77, -1, 74, -1, 69, -1], [77, -1, 74, -1, 70, -1, 74, 77], [73, -1, 76, -1, 81, -1, 76, 73],
    [74, -1, 77, 81, 86, -1, 81, 77], [84, -1, 81, -1, 77, -1, 74, -1], [79, -1, 77, -1, 74, -1, 70, 74], [73, 76, 81, -1, 85, -1, 81, 76],
    [86, -1, -1, 81, 77, -1, 81, -1], [82, -1, -1, 77, 74, -1, 77, -1], [84, -1, 79, -1, 76, -1, 79, 84], [85, -1, 81, -1, 76, -1, 73, -1],
    [79, -1, 82, -1, 86, -1, 82, 79], [77, -1, 82, -1, 86, -1, 82, 77], [73, -1, 76, 81, 85, -1, 88, -1], [85, -1, 81, -1, 76, -1, 73, 0]
];
const NTOTAL = NCHORDS.length * 8;
function playNoMercyStep(n, at) {
    const bar = Math.floor(n / 8), s = n % 8, off = at - ctx.currentTime;
    const [root, ch] = NCHORDS[bar];
    if (s === 0) ch.forEach(c => tone({ f: mtof(c), type: 'sawtooth', t: off, dur: NSTEP * 7.5, vol: 0.035, atk: 0.2, bus: musicBus, filter: { f: 900 } }));   // pad gelap
    tone({ f: mtof(root), type: 'sawtooth', t: off, dur: NSTEP * 0.85, vol: s === 0 ? 0.3 : (s % 2 ? 0.1 : 0.17), bus: musicBus, filter: { f: s === 0 ? 650 : 480 } });   // bass berdenyut tiap not 1/8
    const m = NMELODY[bar][s];
    if (m > 0) {
        let len = 1;
        while (s + len < 8 && NMELODY[bar][s + len] === -1) len++;
        tone({ f: mtof(m), wave: 'pulse', t: off, dur: NSTEP * len * 0.88, vol: 0.12, bus: musicBus, filter: { f: 3200 }, vib: len > 1 ? 5 : 0 });
        tone({ f: mtof(m - 12), type: 'sawtooth', t: off, dur: NSTEP * len * 0.7, vol: 0.04, bus: musicBus, filter: { f: 1400 } });
    }
    if (s % 2 === 0) tone({ f: 125, f2: 40, type: 'sine', t: off, dur: 0.17, vol: 0.68, bus: musicBus });                                    // kick 4 ketukan
    if (s === 2 || s === 6) noise({ t: off, dur: 0.12, vol: 0.2, f: 2000, q: 0.6, bus: musicBus });                                           // snare
    if (s % 2 === 1) noise({ t: off, dur: 0.03, vol: 0.08, type: 'highpass', f: 8500, bus: musicBus });                                       // hi-hat
    if (s === 7 && bar % 4 === 3) { noise({ t: off + NSTEP * 0.5, dur: 0.3, vol: 0.16, f: 700, f2: 4000, q: 1.2, bus: musicBus }); }       // desis naik tiap 4 birama
    if (s === 0 && bar % 8 === 0) tone({ f: mtof(86), f2: mtof(74), type: 'sine', t: off, dur: 1.4, vol: 0.05, bus: musicBus, vib: 5 });      // sirene tipis
}

const TRACKS = {
    nomercy: { step: NSTEP, total: NTOTAL, play: playNoMercyStep },
    flex: { step: XSTEP, total: XTOTAL, play: playFlexStep },
    allwild: { step: WSTEP, total: WTOTAL, play: playAllWildStep },
    menu: { step: MSTEP, total: MTOTAL, play: playMenuStep },
    flipLight: { step: LSTEP, total: LTOTAL, play: playFlipLightStep },
    flipDark: { step: DSTEP, total: DTOTAL, play: playFlipDarkStep }
};
const trackOf = () => TRACKS[curTrack] || { step: STEP, total: TOTAL, play: playStep };
const stepOf = () => trackOf().step;
const totalOf = () => trackOf().total;

function pump() {
    if (!ctx || !musicOn) return;
    if (ctx.state !== 'running') { nextT = ctx.currentTime + 0.1; return; }
    while (nextT < ctx.currentTime + 0.3) {
        trackOf().play(stepNo, nextT);
        nextT += stepOf();
        stepNo = (stepNo + 1) % totalOf();
    }
}

function beginTrack(which) {
    curTrack = which;
    musicOn = true;
    stepNo = 0; nextT = ctx.currentTime + 0.15;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(0, ctx.currentTime);
    musicBus.gain.linearRampToValueAtTime(cfg.mute ? 0 : cfg.music * 0.5, ctx.currentTime + 1.2);
    musicTimer = setInterval(pump, 60);
}

// startMusic('game') = lagu di dalam permainan, startMusic('menu') = lagu beranda/lobi. Ganti lagu = memudar lalu lagu baru masuk.
export function startMusic(which = 'game') {
    wantMusic = which;
    if (!ensure()) return;
    if (musicOn) {
        if (curTrack === which) return;
        musicOn = false;
        clearInterval(musicTimer); musicTimer = null;
        const t = ctx.currentTime;
        musicBus.gain.cancelScheduledValues(t);
        musicBus.gain.setValueAtTime(musicBus.gain.value, t);
        musicBus.gain.linearRampToValueAtTime(0, t + 0.35);
        setTimeout(() => { if (wantMusic === which && !musicOn) beginTrack(which); }, 380);
        return;
    }
    beginTrack(which);
}

export function stopMusic(fade = 0.6) {
    wantMusic = false;
    if (!ctx || !musicOn) return;
    musicOn = false;
    clearInterval(musicTimer); musicTimer = null;
    const t = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setValueAtTime(musicBus.gain.value, t);
    musicBus.gain.linearRampToValueAtTime(0, t + fade);
}
export const musicStatus = () => ({ on: musicOn, track: curTrack, want: wantMusic });

// ---------------------------------------------------------------- pengaturan (tombol bisu & penggeser volume)
function refreshUI() {
    document.querySelectorAll('.snd-img').forEach(img => { img.src = cfg.mute ? 'img/ui/sound-off.png' : 'img/ui/sound-on.png'; });
    document.querySelectorAll('.vol-music').forEach(m => { m.value = Math.round(cfg.music * 100); });
    document.querySelectorAll('.vol-sfx').forEach(e => { e.value = Math.round(cfg.sfx * 100); });
}

window.toggleSound = () => {
    cfg.mute = !cfg.mute; save(); ensure(); applyVolume(); refreshUI();
    if (!cfg.mute) sfx('click');
};
window.setVolume = (kind, v) => {
    cfg[kind] = Math.max(0, Math.min(1, v / 100)); save(); applyVolume();
    if (kind === 'sfx') sfx('card');
};
refreshUI();