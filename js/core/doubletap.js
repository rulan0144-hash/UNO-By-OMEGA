// Ketuk 2x cepat pada kartu di tangan = langsung dimainkan (selain seret ke tumpukan dan ketuk-angkat-ketuk).
// Kartu yang terangkat bergeser, jadi ketukan kedua bisa mengenai kartu tetangganya; karena itu yang dipakai adalah
// KARTU PADA KETUKAN PERTAMA bila ketukan kedua datang cepat dan di dekat titik yang sama.
const WINDOW_MS = 380, NEAR_PX = 30;
let last = null;

// Catat ketukan ini. Mengembalikan indeks kartu pada ketukan pertama bila ini ketukan kedua yang cepat, selain itu -1.
export function doubleTapTarget(idx, e) {
    const now = performance.now();
    const x = e && typeof e.clientX === 'number' ? e.clientX : 0;
    const y = e && typeof e.clientY === 'number' ? e.clientY : 0;
    const prev = last;
    if (prev && now - prev.t < WINDOW_MS && Math.hypot(x - prev.x, y - prev.y) < NEAR_PX) { last = null; return prev.idx; }
    last = { t: now, x, y, idx };
    return -1;
}
export const resetDoubleTap = () => { last = null; };
