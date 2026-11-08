"""Menulis nomor versi ke index.html supaya browser SELALU memuat file JS/CSS terbaru (anti file lama yang tersimpan di cache).
Jalankan setiap kali ada file yang berubah:   python3 bump_version.py [nomor_versi]   (bawaan: tanggal-jam sekarang)
Yang diubah di index.html:
  1. peta impor (<script type="importmap">) berisi SEMUA file js/**/*.js -> versi ber-?v=nomor
  2. <script type="module" src="js/main.js?v=nomor"> dan <link href="css/*.css?v=nomor">
Pengguna cukup mengunggah file yang berubah + index.html."""
import glob, json, os, re, sys, time

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
os.chdir(ROOT)
ver = sys.argv[1] if len(sys.argv) > 1 else time.strftime('%Y%m%d-%H%M')

files = sorted(f.replace(os.sep, '/') for f in glob.glob('js/**/*.js', recursive=True))
imports = {f'./{f}': f'./{f}?v={ver}' for f in files}
block = ('<!-- IMPORTMAP:START (dibuat alat/bump_version.py, jangan diedit manual) -->\n'
         '    <script type="importmap">\n' + json.dumps({'imports': imports}, indent=2) + '\n    </script>\n'
         '    <!-- IMPORTMAP:END -->')

html = open('index.html', encoding='utf-8').read()
if '<!-- IMPORTMAP:START' in html:
    html = re.sub(r'<!-- IMPORTMAP:START.*?<!-- IMPORTMAP:END -->', lambda m: block, html, flags=re.S)
else:
    html = html.replace('</head>', '    ' + block + '\n</head>', 1)
html = re.sub(r'(src="js/main\.js)(\?v=[^"]*)?"', lambda m: f'{m.group(1)}?v={ver}"', html)
html = re.sub(r'(href="css/[A-Za-z0-9_.-]+\.css)(\?v=[^"]*)?"', lambda m: f'{m.group(1)}?v={ver}"', html)
open('index.html', 'w', encoding='utf-8').write(html)
print(f'versi {ver}: {len(files)} file JS didaftarkan di index.html')
