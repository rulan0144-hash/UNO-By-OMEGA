// Pemuat gambar: semua gambar sebuah mode dimuat DULU (dengan layar "Memuat isi game") sebelum permainan dimulai,
// supaya hitung mundur / pembagian kartu tidak berjalan saat kartu belum terunduh.
// Pemakaian: await prepareMode('flip')  -> menampilkan #load-overlay hanya jika ada yang belum termuat.
// warmMode('flip') = memuat diam-diam di latar (dipakai saat menunggu di lobi online).
import { getImpl, getMode } from '../app/modes.js';

const held = new Map();      // src -> <img> (disimpan supaya tidak dibuang dari memori peramban)
const done = {};             // id mode -> true bila semua gambarnya sudah termuat
const jobs = {};             // id mode -> Promise yang sedang berjalan
const $ = (id) => document.getElementById(id);

function loadOne(src) {
    return new Promise((res) => {
        const old = held.get(src);
        if (old && old.complete && old.naturalWidth) { res(true); return; }
        const img = new Image();
        held.set(src, img);
        const fin = (ok) => { if (!ok) held.delete(src); res(ok); };
        img.onload = () => { (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => fin(true)); };
        img.onerror = () => fin(false);
        img.src = src;
    });
}

// Muat semua gambar; onProgress(selesai, total). Tidak pernah gagal total: gambar yang error dilewati.
export function loadImages(srcs, onProgress) {
    const list = [...new Set(srcs)];
    let n = 0;
    if (onProgress) onProgress(0, list.length);
    return Promise.all(list.map(s => loadOne(s).then(ok => { n++; if (onProgress) onProgress(n, list.length); return ok; })))
        .then(r => ({ total: list.length, failed: list.filter((s, i) => !r[i]) }));
}

export const assetsReady = (id) => !!done[id];

function setUI(n, total, text) {
    const bar = $('load-bar'), pct = $('load-pct'), txt = $('load-text');
    const p = total ? Math.round(n * 100 / total) : 100;
    if (bar) bar.style.width = p + '%';
    if (pct) pct.textContent = p + '%';
    if (txt && text) txt.textContent = text;
}

function job(id) {
    if (done[id]) return Promise.resolve();
    if (jobs[id]) return jobs[id];
    const impl = getImpl(id);
    const srcs = impl && impl.assets ? impl.assets() : [];
    jobs[id] = loadImages(srcs, (n, t) => setUI(n, t)).then(r => {
        if (r.failed.length) console.warn('gambar gagal dimuat:', r.failed);
        done[id] = true; delete jobs[id];
    });
    return jobs[id];
}

export function warmMode(id) { job(id); }

export function prepareMode(id) {
    if (done[id]) return Promise.resolve();
    const m = getMode(id);
    const ov = $('load-overlay'), skip = $('load-skip');
    setUI(0, 1, 'Memuat isi game' + (m ? ' ' + m.name : '') + '...');
    if (ov) ov.classList.remove('hidden');
    if (skip) skip.classList.add('hidden');
    const showSkip = setTimeout(() => { if (skip) skip.classList.remove('hidden'); }, 12000);   // koneksi lambat: boleh lanjut tanpa menunggu
    return new Promise((resolve) => {
        const fin = () => { clearTimeout(showSkip); if (ov) ov.classList.add('hidden'); resolve(); };
        window.__loadSkip = fin;
        job(id).then(fin);
        setTimeout(fin, 60000);   // pengaman terakhir
    });
}
