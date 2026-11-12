#!/usr/bin/env python3
"""Pengemas PERUBAHAN proyek UNO by OMEGA (pengganti 'kirim uno-app.zip lengkap').

Masalah: zip proyek lengkap +-30 MB (95% gambar PNG) terlalu besar untuk dikirim AI ke percakapan.
Solusi : kirim HANYA berkas yang baru/berubah, dengan struktur folder yang benar (js/modes/flex/ui.js, img/nomercy/Red-7.png, ...),
         plus DAFTAR-UBAH.txt (daftar BARU / UBAH / HAPUS). Ekstrak zip di folder repo, lalu unggah ke GitHub.

Alur kerja AI (di awal & akhir tiap sesi):
  1. Awal sesi (proyek sudah diekstrak dari unggahan pengguna / zip repo GitHub):
        python3 alat/pack_changes.py snapshot          # catat keadaan awal (.baseline.json, TIDAK ikut zip)
  2. Kerjakan perubahan seperti biasa (jalankan alat/bump_version.py bila JS/CSS berubah).
  3. Akhir sesi / tiap serah-terima:
        python3 alat/pack_changes.py                   # = delta: buat zip perubahan + DAFTAR-UBAH.txt
     lalu kirim isi folder 'pengiriman/' (SendUserFile) -- BUKAN seluruh proyek.

Perintah lain:
  status                  tampilkan apa yang berubah tanpa membuat zip
  kode                    zip semua berkas NON-gambar (index.html, css, js, alat, memori) -> uno-kode.zip (kecil, +-1 MB)
  img <folder> [...]      zip gambar satu/lebih folder (mis. img/nomercy) -> otomatis dipecah bagian
Opsi:
  --max-mb N   ukuran maks satu bagian zip (bawaan 8). Lebih besar -> dipecah: *-1dari3.zip, *-2dari3.zip ... (ekstrak semuanya ke folder yang sama)
  --out DIR    folder keluaran (bawaan: ../pengiriman, di luar proyek)
  --nama TEXT  label nama zip (bawaan: tanggal-jam)
  --no-advance delta: jangan majukan snapshot (bawaan: snapshot dimajukan sehingga delta berikutnya hanya memuat perubahan BARU)
"""
import argparse, hashlib, json, os, sys, time, zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
BASELINE = os.path.join(ROOT, '.baseline.json')
SKIP_DIRS = {'.git', 'node_modules', '__pycache__', '.github_tmp', 'pengiriman'}
SKIP_NAMES = {'.baseline.json', '.DS_Store', 'Thumbs.db', 'uno-app.zip'}


def skipped(rel):
    parts = rel.split('/')
    name = parts[-1]
    if any(p in SKIP_DIRS for p in parts[:-1]):
        return True
    if name in SKIP_NAMES or name.startswith('preview-') or name.endswith(('.pyc', '.zip', '.tmp')):
        return True
    return False


def scan():
    """{path_relatif: (sha1, ukuran)} untuk semua berkas proyek."""
    out = {}
    for dp, dns, fns in os.walk(ROOT):
        dns[:] = sorted(d for d in dns if d not in SKIP_DIRS)
        for fn in sorted(fns):
            full = os.path.join(dp, fn)
            rel = os.path.relpath(full, ROOT).replace(os.sep, '/')
            if skipped(rel):
                continue
            h = hashlib.sha1()
            with open(full, 'rb') as f:
                for chunk in iter(lambda: f.read(1 << 20), b''):
                    h.update(chunk)
            out[rel] = (h.hexdigest(), os.path.getsize(full))
    return out


def load_baseline():
    if not os.path.exists(BASELINE):
        sys.exit('BELUM ADA snapshot. Jalankan dulu di AWAL sesi (sebelum mengubah apa pun):\n'
                 '    python3 alat/pack_changes.py snapshot\n'
                 'Jika terlanjur mengubah berkas: ekstrak ulang proyek asli dari pengguna, snapshot, lalu terapkan ulang perubahan.')
    return json.load(open(BASELINE, encoding='utf-8'))['files']


def save_baseline(files):
    json.dump({'dibuat': time.strftime('%Y-%m-%d %H:%M:%S'),
               'files': {k: list(v) for k, v in files.items()}},
              open(BASELINE, 'w', encoding='utf-8'))


def diff(old, new):
    baru = sorted(p for p in new if p not in old)
    ubah = sorted(p for p in new if p in old and old[p][0] != new[p][0])
    hapus = sorted(p for p in old if p not in new)
    return baru, ubah, hapus


def human(n):
    return f'{n/1048576:.1f} MB' if n >= 1048576 else f'{n/1024:.0f} KB'


def make_list(baru, ubah, hapus, sizes, judul):
    L = [judul, '=' * len(judul), '',
         'CARA PAKAI: ekstrak SEMUA bagian zip ke satu folder (struktur folder sudah benar), lalu',
         'unggah/ganti berkas di GitHub sesuai jalur di bawah. Berkas HAPUS dihapus manual di GitHub.',
         'Jalur persis (huruf besar/kecil) harus sama.', '']

    def blok(nama, items):
        if not items:
            return
        L.append(f'{nama} ({len(items)})')
        cur = None
        for p in items:
            d = os.path.dirname(p) or '(akar repo)'
            if d != cur:
                L.append(f'  [{d}/]' if d != '(akar repo)' else '  [akar repo]')
                cur = d
            sz = f'  {human(sizes[p])}' if p in sizes else ''
            L.append(f'    {os.path.basename(p)}{sz}')
        L.append('')
    blok('BARU', baru)
    blok('UBAH', ubah)
    blok('HAPUS (hapus manual di GitHub)', hapus)
    if not (baru or ubah or hapus):
        L.append('(tidak ada perubahan)')
    return '\n'.join(L) + '\n'


def split_parts(paths, sizes, max_bytes):
    parts, cur, cur_sz = [], [], 0
    for p in paths:
        s = sizes[p]
        if cur and cur_sz + s > max_bytes:
            parts.append(cur)
            cur, cur_sz = [], 0
        cur.append(p)
        cur_sz += s
    if cur:
        parts.append(cur)
    return parts


def write_zips(paths, sizes, out_dir, label, max_mb, listing):
    os.makedirs(out_dir, exist_ok=True)
    if listing:  # kiriman delta baru: buang kiriman delta lama
        for f in os.listdir(out_dir):
            if f.startswith('perubahan-') or f == 'DAFTAR-UBAH.txt':
                os.remove(os.path.join(out_dir, f))
    parts = split_parts(paths, sizes, int(max_mb * 1048576)) or [[]]
    n = len(parts)
    made = []
    for i, items in enumerate(parts, 1):
        name = f'{label}.zip' if n == 1 else f'{label}-{i}dari{n}.zip'
        zp = os.path.join(out_dir, name)
        with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            if i == 1 and listing:
                z.writestr('DAFTAR-UBAH.txt', listing)
            for p in items:
                z.write(os.path.join(ROOT, p), p)
        made.append(zp)
    if listing:
        open(os.path.join(out_dir, 'DAFTAR-UBAH.txt'), 'w', encoding='utf-8').write(listing)
    return made


def cmd_snapshot(a):
    files = scan()
    save_baseline(files)
    print(f'snapshot: {len(files)} berkas dicatat ({human(sum(s for _, s in files.values()))}). Kerjakan perubahan, lalu jalankan: python3 alat/pack_changes.py')


def cmd_status(a):
    old, new = load_baseline(), scan()
    baru, ubah, hapus = diff(old, new)
    sizes = {p: new[p][1] for p in new}
    print(make_list(baru, ubah, hapus, sizes, 'STATUS PERUBAHAN'))


def cmd_delta(a):
    old, new = load_baseline(), scan()
    baru, ubah, hapus = diff(old, new)
    if not (baru or ubah or hapus):
        print('Tidak ada perubahan sejak snapshot terakhir. Tidak ada yang perlu dikirim.')
        return
    sizes = {p: new[p][1] for p in new}
    label = f'perubahan-{a.nama or time.strftime("%Y%m%d-%H%M")}'
    # index.html & memori dikirim paling depan agar selalu ada di bagian 1
    paths = baru + ubah
    paths.sort(key=lambda p: (p not in ('index.html', 'MEMORI-UNO-BY-OMEGA.md'), p))
    listing = make_list(baru, ubah, hapus, sizes, f'DAFTAR PERUBAHAN {label}')
    made = write_zips(paths, sizes, a.out, label, a.max_mb, listing)
    print(listing)
    for m in made:
        print(f'-> {m}  ({human(os.path.getsize(m))})')
    print('Kirim ke pengguna: semua berkas .zip di atas + DAFTAR-UBAH.txt (bukan seluruh proyek).')
    if not a.no_advance:
        save_baseline(new)
        print('(snapshot dimajukan: delta berikutnya hanya memuat perubahan setelah ini)')


def cmd_kode(a):
    new = scan()
    paths = sorted(p for p in new if not p.startswith('img/'))
    sizes = {p: new[p][1] for p in new}
    made = write_zips(paths, sizes, a.out, 'uno-kode', a.max_mb, None)
    for m in made:
        print(f'-> {m}  ({human(os.path.getsize(m))})  [{len(paths)} berkas non-gambar]')


def cmd_img(a):
    new = scan()
    pref = tuple(f.strip('/').replace(os.sep, '/') + '/' for f in a.folders)
    paths = sorted(p for p in new if p.startswith(pref))
    if not paths:
        sys.exit('Tidak ada berkas di folder itu: ' + ', '.join(a.folders))
    sizes = {p: new[p][1] for p in new}
    label = 'gambar-' + '-'.join(os.path.basename(f.strip('/')) for f in a.folders)
    made = write_zips(paths, sizes, a.out, label, a.max_mb, None)
    for m in made:
        print(f'-> {m}  ({human(os.path.getsize(m))})')


def main():
    ap = argparse.ArgumentParser(description='Pengemas perubahan proyek UNO by OMEGA')
    ap.add_argument('cmd', nargs='?', default='delta', choices=['snapshot', 'status', 'delta', 'kode', 'img'])
    ap.add_argument('folders', nargs='*', help='untuk perintah img: folder gambar')
    ap.add_argument('--max-mb', type=float, default=8)
    ap.add_argument('--out', default=os.path.join(ROOT, '..', 'pengiriman'))
    ap.add_argument('--nama', default='')
    ap.add_argument('--no-advance', action='store_true')
    a = ap.parse_args()
    a.out = os.path.abspath(a.out)
    {'snapshot': cmd_snapshot, 'status': cmd_status, 'delta': cmd_delta, 'kode': cmd_kode, 'img': cmd_img}[a.cmd](a)


if __name__ == '__main__':
    main()
