// Uji suara di Node dengan AudioContext palsu: setiap efek baru harus menjadwalkan nada/derau, tanpa nilai NaN, dan lagu nomercy harus berjalan.
let bad = 0, starts = 0, noiseStarts = 0;
const chk = (...a) => a.forEach(v => { if (typeof v === 'number' && !Number.isFinite(v)) bad++; });
const param = () => ({ value: 0, setValueAtTime: chk, linearRampToValueAtTime: chk, exponentialRampToValueAtTime: chk, setTargetAtTime: chk, cancelScheduledValues: chk });
const node = (extra = {}) => ({ connect() { return this; }, disconnect() {}, ...extra });
class AC {
  constructor() { this.t0 = Date.now(); this.sampleRate = 8000; this.state = 'running'; this.destination = node(); }
  get currentTime() { return (Date.now() - this.t0) / 1000; }
  createDynamicsCompressor() { return node(); }
  createGain() { return node({ gain: param() }); }
  createOscillator() { return node({ frequency: param(), type: '', setPeriodicWave() {}, start(t) { chk(t); starts++; }, stop(t) { chk(t); } }); }
  createBiquadFilter() { return node({ frequency: param(), Q: param(), type: '' }); }
  createBufferSource() { return node({ buffer: null, loop: false, start(t, o) { chk(t, o); noiseStarts++; }, stop(t) { chk(t); } }); }
  createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; }
  createPeriodicWave() { return {}; }
  resume() { return Promise.resolve(); } suspend() {}
}
globalThis.speechSynthesis = { getVoices: () => [], speak() {}, cancel() {}, onvoiceschanged: null, addEventListener() {} };
globalThis.SpeechSynthesisUtterance = class { };
globalThis.window = { AudioContext: AC, addEventListener() {}, speechSynthesis: globalThis.speechSynthesis };
globalThis.document = { addEventListener() {}, hidden: false, getElementById: () => null, querySelectorAll: () => [] };
globalThis.localStorage = { getItem: () => null, setItem() {} };
const M = await import(process.argv[2]);
const names = ['draw10', 'revdraw4', 'pass', 'mercy', 'discardall', 'roulette', 'rtap', 'rmiss', 'rhit', 'stackup', 'swap', 'draw6', 'draw4'];
M.sfx('click');   // membuat konteks
let ok = true;
for (const n of names) {
  const a = starts + noiseStarts; M.sfx(n, 0, 3); const d = starts + noiseStarts - a;
  console.log((d > 0 ? 'OK    ' : 'GAGAL ') + 'efek ' + n + ': ' + d + ' bunyi dijadwalkan'); if (d <= 0) ok = false;
}
console.log((bad === 0 ? 'OK    ' : 'GAGAL ') + 'tidak ada nilai NaN/Infinity (' + bad + ')'); if (bad) ok = false;
M.startMusic('nomercy');
await new Promise(r => setTimeout(r, 400));
console.log('status musik', JSON.stringify(M.musicStatus()));
const before = starts + noiseStarts;
// majukan jam palsu supaya pump menjadwalkan banyak langkah
const ctxs = []; 
for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 70)); }
console.log((M.musicStatus().track === 'nomercy' && M.musicStatus().on ? 'OK    ' : 'GAGAL ') + 'lagu nomercy aktif');
console.log((starts + noiseStarts > before ? 'OK    ' : 'GAGAL ') + 'lagu menjadwalkan nada (' + (starts + noiseStarts - before) + ')'); 
console.log((bad === 0 ? 'OK    ' : 'GAGAL ') + 'lagu tanpa NaN (' + bad + ')');
M.stopMusic(0.1); process.exit(ok && bad === 0 ? 0 : 1);
