# Efek "Acak Kartu" (Wild Shuffle Hands) -> img/effects/shuffle.png   (512x512 transparan)
# Revisi 10 Nov: gambar efek = lencana bulat pilihan pengguna (alat/shuffle-sumber.png: cincin hitam, oval putih, dua tangan bertukar kartu)
# TANPA gambar wild (dua oval warna bersimbol di pojok dihapus): cincin & oval putih digambar ulang secara geometri (elips hasil pencocokan
# dari gambar sumber), tangan diambil dari gambar sumber (diperbesar + dipertajam). Versi lama (kartu Acak miring) = gen_shuffle_fx_kartu.py
# Pakai: python3 gen_shuffle_fx.py [berkas_tujuan]   (bawaan: ../img/effects/shuffle.png)   Butuh: numpy, opencv-python (cv2), Pillow
import os, sys
import numpy as np, cv2
from PIL import Image, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'img', 'effects', 'shuffle.png')
src = cv2.imread(os.path.join(HERE, 'shuffle-sumber.png'))                 # 300x300 (BGR)
src_rgb = cv2.cvtColor(src, cv2.COLOR_BGR2RGB)
CX, CY = 149.5, 150.0
R_OUT, R_WHITE_OUT, R_WHITE_IN = 142.5, 137.0, 129.0                       # tepi luar hitam tipis, cincin putih, piringan hitam (jari-jari, piksel sumber)
WHITE_ELL = ((149.47, 149.51), (149.10, 229.09), 24.95)                    # oval putih tengah (cv2.fitEllipse: pusat, sumbu penuh, sudut)
OVALS = [((80.33, 80.40), (56.95, 93.13), 25.18), ((218.65, 218.53), (56.91, 93.19), 25.08)]   # dua oval wild yang DIHAPUS

def draw_base(scale, size, ox, oy):
    """Cincin + oval putih pada kanvas size x size (supersampling dilakukan pemanggil), koordinat sumber -> (x*scale+ox, y*scale+oy)."""
    img = np.zeros((size, size, 4), np.uint8)
    c = (int(round(CX * scale + ox)), int(round(CY * scale + oy)))
    S = 8   # presisi sub-piksel cv2 (shift)
    def circ(r, col): cv2.circle(img, (int(round(c[0] * (1 << S))), int(round(c[1] * (1 << S)))), int(round(r * scale * (1 << S))), col, -1, cv2.LINE_AA, S)
    BLK = (13, 13, 13, 255)   # hitam gambar sumber
    circ(R_OUT, BLK); circ(R_WHITE_OUT, (255, 255, 255, 255)); circ(R_WHITE_IN, BLK)
    (ex, ey), (w, h), ang = WHITE_ELL
    cv2.ellipse(img, (int(round(ex * scale + ox)), int(round(ey * scale + oy))), (int(round(w / 2 * scale)), int(round(h / 2 * scale))), ang, 0, 360, (255, 255, 255, 255), -1, cv2.LINE_AA)
    return img

# ---- 1. dasar pada resolusi sumber (untuk menemukan bagian yang BUKAN dasar = tangan) ----
base300 = draw_base(4, 1200, 0, 0)
base300 = cv2.resize(base300, (300, 300), interpolation=cv2.INTER_AREA)
g_src = cv2.cvtColor(src, cv2.COLOR_BGR2GRAY).astype(int)
g_base = cv2.cvtColor(base300[:, :, :3], cv2.COLOR_RGB2GRAY).astype(int)
yy, xx = np.mgrid[:300, :300]
inside = ((xx - CX) ** 2 + (yy - CY) ** 2) < (R_WHITE_IN - 3) ** 2
oval_mask = np.zeros((300, 300), np.uint8)
for (c, (w, h), a) in OVALS:
    cv2.ellipse(oval_mask, (int(round(c[0])), int(round(c[1]))), (int(round(w / 2 + 8)), int(round(h / 2 + 8))), a, 0, 360, 255, -1)
# Daerah tangan = persegi di sekitar kedua tangan (di luar garis tangan, piksel sumber SAMA dengan dasar, jadi aman),
# dikurangi dua oval wild yang dihapus (diperlebar sedikit untuk garis tepi putihnya).
hands = np.zeros((300, 300), np.uint8)
hands[118:208, 50:264] = 1
hands[oval_mask > 0] = 0

# ---- 2. kanvas akhir ----
SS = 1024                       # kerja 1024, hasil 512
K = 440 / (2 * R_OUT) * (SS / 512)   # skala: lencana ~440 px dari 512
OX = SS / 2 - CX * K; OY = SS / 2 - 8 * (SS / 512) - CY * K       # sedikit naik, ruang untuk bayangan
base = draw_base(K, SS, OX, OY)
hand_up = cv2.resize(src_rgb, None, fx=K, fy=K, interpolation=cv2.INTER_LANCZOS4)
hand_up = np.array(Image.fromarray(hand_up).filter(ImageFilter.UnsharpMask(radius=3, percent=170, threshold=2)))
m = cv2.resize(hands.astype(np.float32), None, fx=K, fy=K, interpolation=cv2.INTER_LINEAR)
m = cv2.GaussianBlur(m, (0, 0), 1.2)[:, :, None]
canvas = base.copy()
x0, y0 = int(round(OX)), int(round(OY))
H, W = hand_up.shape[:2]
ys, xs = max(0, y0), max(0, x0)
ye, xe = min(SS, y0 + H), min(SS, x0 + W)
sub = hand_up[ys - y0:ye - y0, xs - x0:xe - x0].astype(np.float32)
mm = m[ys - y0:ye - y0, xs - x0:xe - x0]
canvas[ys:ye, xs:xe, :3] = (canvas[ys:ye, xs:xe, :3] * (1 - mm) + sub * mm).astype(np.uint8)

# ---- 3. bayangan lembut (seperti efek lain) + simpan ----
a = canvas[:, :, 3].astype(np.float32) / 255
sh = cv2.GaussianBlur(np.roll(a, int(10 * SS / 512), axis=0), (0, 0), 9 * SS / 512) * 0.45
out = np.zeros_like(canvas, dtype=np.float32)
out[:, :, :3] = canvas[:, :, :3] * a[:, :, None]
oa = a + sh * (1 - a)
out[:, :, :3] = out[:, :, :3] / np.maximum(oa, 1e-4)[:, :, None]          # bayangan hitam = rgb 0 di luar badge
out[:, :, :3] = np.where(a[:, :, None] > 0.999, canvas[:, :, :3], out[:, :, :3])
out[:, :, 3] = oa * 255
res = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA').resize((512, 512), Image.LANCZOS)
res.save(OUT)
print('ok', os.path.abspath(OUT))
