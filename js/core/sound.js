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
let wantMusic = false;

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
    if (wantMusic) startMusic();
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

// getaran singkat di HP (Android) untuk momen besar
const VIBE = { catch: [60, 40, 120], draw4: [80, 40, 80], draw6: [100, 50, 100, 50, 200], win: [80, 60, 80, 60, 240], challengeWrong: [150] };

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
    c_Green: ['Green', 1.1, 1.0, 0]
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

function pump() {
    if (!ctx || !musicOn) return;
    if (ctx.state !== 'running') { nextT = ctx.currentTime + 0.1; return; }
    while (nextT < ctx.currentTime + 0.3) {
        playStep(stepNo, nextT);
        nextT += STEP;
        stepNo = (stepNo + 1) % TOTAL;
    }
}

export function startMusic() {
    wantMusic = true;
    if (!ensure() || musicOn) return;
    musicOn = true;
    stepNo = 0; nextT = ctx.currentTime + 0.15;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(0, ctx.currentTime);
    musicBus.gain.linearRampToValueAtTime(cfg.mute ? 0 : cfg.music * 0.5, ctx.currentTime + 1.2);
    musicTimer = setInterval(pump, 60);
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