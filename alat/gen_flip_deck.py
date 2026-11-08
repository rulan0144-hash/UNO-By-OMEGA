"""Membaca UNO_Flip.xlsx (tiap baris = satu kartu fisik: sisi terang + sisi gelap) lalu menulis js/modes/flip/data.js.
Jalankan:  python3 gen_flip_deck.py [UNO_Flip.xlsx]      (butuh: pip install openpyxl)
Daftar di Excel dibaca per blok 4 kolom: (B,C) (E,F) (H,I) (K,L), mulai baris 2 sampai baris "Jumlah Card".
Mengecek juga komposisi resmi (112 kartu per sisi); jika ada yang tidak cocok, skrip berhenti dan menampilkan selisihnya."""
import collections, os, re, sys
import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'UNO_Flip.xlsx')
OUT = os.path.join(HERE, '..', 'js', 'modes', 'flip', 'data.js')

ws = openpyxl.load_workbook(SRC, data_only=True).active
last = ws.max_row
for r in range(2, ws.max_row + 1):                    # berhenti di tabel "Jumlah Card"
    if isinstance(ws.cell(r, 2).value, str) and ws.cell(r, 2).value.strip().lower().startswith('jumlah'):
        last = r - 1; break

def parse(text):
    s = ' '.join(str(text).split())
    if re.fullmatch(r'(?i)wild card (light|dark) side', s): return ('Black', 'Wild')
    if re.fullmatch(r'(?i)wild draw 2', s): return ('Black', 'Wild Draw Two')
    if re.fullmatch(r'(?i)wild draw color', s): return ('Black', 'Wild Draw Color')
    col, val = s.split(' ', 1)
    val = {'Draw 1': 'Draw One', 'Draw 5': 'Draw Five'}.get(val, val)
    return (col, val)

pairs = []
for r in range(2, last + 1):
    for c in (2, 5, 8, 11):
        a, b = ws.cell(r, c).value, ws.cell(r, c + 1).value
        if a is None and b is None: continue
        pairs.append(parse(a) + parse(b))

def expected(colors, specials):
    e = {}
    for col in colors:
        for n in range(1, 10): e[(col, str(n))] = 2
        for v in specials: e[(col, v)] = 2
    return e
EL = expected(['Red', 'Yellow', 'Green', 'Blue'], ['Draw One', 'Reverse', 'Skip', 'Flip']); EL[('Black', 'Wild')] = 4; EL[('Black', 'Wild Draw Two')] = 4
ED = expected(['Pink', 'Teal', 'Orange', 'Purple'], ['Draw Five', 'Reverse', 'Skip Everyone', 'Flip']); ED[('Black', 'Wild')] = 4; ED[('Black', 'Wild Draw Color')] = 4
L = collections.Counter((p[0], p[1]) for p in pairs); D = collections.Counter((p[2], p[3]) for p in pairs)
errs = []
for name, cnt, exp in (('TERANG', L, EL), ('GELAP', D, ED)):
    for k in sorted(set(cnt) | set(exp)):
        if cnt.get(k, 0) != exp.get(k, 0): errs.append(f'sisi {name}: {k} ada {cnt.get(k, 0)} di Excel, seharusnya {exp.get(k, 0)}')
if len(pairs) != 112: errs.append(f'jumlah kartu {len(pairs)}, seharusnya 112')
if errs:
    print('\n'.join(errs)); sys.exit(1)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
lines = ',\n'.join('    ' + str(list(p)).replace('"', "'") for p in pairs)
open(OUT, 'w', encoding='utf-8').write(
    "// DIBUAT OTOMATIS oleh alat/gen_flip_deck.py dari UNO_Flip.xlsx. Jangan diedit manual.\n"
    "// Tiap baris = satu kartu fisik: [warna sisi terang, nilai terang, warna sisi gelap, nilai gelap]\n"
    f"export const PAIRS = [\n{lines}\n];\n")
print(len(pairs), 'kartu ditulis ke', os.path.abspath(OUT))
