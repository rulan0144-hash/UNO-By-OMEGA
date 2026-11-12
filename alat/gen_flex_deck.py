"""Membaca UNO_Flex.xlsx lalu menulis js/modes/flex/data.js (104 kartu main; 8 Power Card dibuat di kode).
Jalankan:  python3 gen_flex_deck.py        (butuh: pip install openpyxl)
Tiap kartu = [warna biasa, nilai biasa, warna flex, nilai/efek flex, ikon-flip(0/1), nama gambar tanpa .png].
Komposisi divalidasi (klasik 44, flex 44, wild 16, ikon-flip 16); jika ada selisih skrip berhenti.
Nama gambar mengikuti gen_flex_cards.py (img/flex/cards/<nama>.png)."""
import os, re, sys, collections
import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'UNO_Flex.xlsx')
OUT = os.path.join(HERE, '..', 'js', 'modes', 'flex', 'data.js')

ws = openpyxl.load_workbook(SRC, data_only=False).active
cells = {}
for row in ws.iter_rows():
    for c in row:
        if isinstance(c.value, str) and not c.value.startswith('='): cells[c.coordinate] = c.value.strip()
classic = [cells[f'{cc}{r}'] for r in range(3, 14) for cc in 'ADGJ']
flex = [cells[f'{cc}{r}'] for r in range(17, 28) for cc in 'ADGJ']
fl_refs = {ws.cell(r, 17).value[1:] for r in range(3, 20) if isinstance(ws.cell(r, 17).value, str) and ws.cell(r, 17).value.startswith('=')}
FLIPICON = {cells[c] for c in fl_refs if c in cells}
WILD = {'Wild All Flip': (6, 'Wild All Flip', None, 'Black-WildAllFlip'),
        'Wild Flex All Draw 2': (4, 'Wild', 'All Draw Two', 'Black-WildFlexAllDraw2'),
        'Wild Flex Target Draw 2': (4, 'Wild', 'Target Draw Two', 'Black-WildFlexTargetDraw2'),
        'Wild Draw 4 Flex Wild Target Draw 4': (2, 'Wild Draw Four', 'Target Draw Four', 'Black-WildDrawFourFlexTarget4')}
norm = lambda s: ' '.join(s.split())
wild_counts = {}
for r in range(3, 8):
    n = cells.get(f'M{r}')
    if n and norm(n) in map(norm, WILD): wild_counts[next(k for k in WILD if norm(k) == norm(n))] = int(ws[f'N{r}'].value)

cards, errs = [], []
ACT = {'Reverse': 'Reverse', 'Skip': 'Skip', 'Draw 2': 'Draw Two'}
FLEXACT = {'Reverse': 'Reverse Skip', 'Skip': 'Skip Everyone', 'Draw 2': 'All Draw One'}
for nm in classic:
    col, val = nm.split(' ', 1)
    v = ACT.get(val, val)
    cards.append([col, v, None, None, 1 if nm in FLIPICON else 0, f'{col}-{v.replace(" ", "")}'])
for nm in flex:
    m = re.fullmatch(r'(\w+) Flex (\w+) (\d)', nm)
    if m: cards.append([m[1], m[3], m[2], m[3], 0, f'{m[1]}-{m[3]}-Flex{m[2]}']); continue
    col = nm.split(' ')[0]
    key = 'Reverse' if 'Reverse' in nm else 'Skip' if 'Skip' in nm else 'Draw 2' if 'Draw 2' in nm else None
    if key is None: errs.append('kartu flex tak dikenal: ' + nm); continue
    cards.append([col, ACT[key], col, FLEXACT[key], 0, f'{col}-{ACT[key].replace(" ", "")}-Flex'])
for k, q in wild_counts.items():
    n, v, fv, img = WILD[k]
    if q != n: errs.append(f'{k}: Excel {q}, seharusnya {n}')
    for _ in range(q): cards.append(['Black', v, 'Black' if fv else None, fv, 0, img])

C = collections.Counter(c[5] for c in cards)
if len(classic) != 44 or len(flex) != 44: errs.append(f'klasik {len(classic)} / flex {len(flex)} (harus 44/44)')
if sum(wild_counts.values()) != 16: errs.append(f'wild {sum(wild_counts.values())} (harus 16)')
if len(FLIPICON) != 16: errs.append(f'ikon-flip {len(FLIPICON)} (harus 16)')
if len(cards) != 104: errs.append(f'total kartu main {len(cards)} (harus 104 = 112 - 8 Power)')
for img, q in C.items():
    exp = {'Black-WildAllFlip': 6, 'Black-WildFlexAllDraw2': 4, 'Black-WildFlexTargetDraw2': 4, 'Black-WildDrawFourFlexTarget4': 2}.get(img, 1)
    if q != exp: errs.append(f'gambar {img}: {q} kartu, seharusnya {exp}')
if errs: print('\n'.join(errs)); sys.exit(1)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
lines = ',\n'.join('    ' + str(c).replace('None', 'null').replace('"', "'") for c in cards)
open(OUT, 'w', encoding='utf-8').write(
    "// DIBUAT OTOMATIS oleh alat/gen_flex_deck.py dari UNO_Flex.xlsx. Jangan diedit manual.\n"
    "// Tiap baris = satu kartu main: [warna biasa, nilai biasa, warna flex, nilai/efek flex, ikon-flip, nama gambar]\n"
    f"export const CARDS = [\n{lines}\n];\n")
print(len(cards), 'kartu main ditulis ke', os.path.abspath(OUT), '(+8 Power Card = 112)')
