"""Normal map (glTF/OpenGL: R = -dh/dx, G = +dh/dy) derivado da textura de cor.

A convenção foi conferida contra o normal map original do atlas mid-century
(correlação +0,35 no R e +0,42 no G). Junta escura = funda; o claro é comprimido
para sujeira clara não virar calombo. A força é calibrada para um alvo de
desvio das componentes xy DENTRO das ilhas de UV, e não fixa: o gradiente por
pixel dobra quando a resolução cai pela metade.

uso: normal_de_cor.py COR.png SAIDA.png LARGURA [--mascara UV.png] [--rug RUG.png] [--alvo 0.15]
"""
import sys
import numpy as np
from PIL import Image

cor_p, out_p, W = sys.argv[1], sys.argv[2], int(sys.argv[3])
arg = lambda n, d=None: sys.argv[sys.argv.index(n) + 1] if n in sys.argv else d
alvo = float(arg('--alvo', 0.15))

im = Image.open(cor_p).convert('RGB')
H = int(round(W * im.size[1] / im.size[0]))
a = np.asarray(im.resize((W, H), Image.LANCZOS)).astype(np.float64) / 255
lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
L = (0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]) ** (1 / 2.2)


def box(x, k):
    p = k // 2
    xp = np.pad(x, p, mode='reflect')
    c = np.pad(xp.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)


blur = lambda x, k: box(box(x, k), k)
f = W / 2048  # as faixas de frequência acompanham a resolução
k1, k2, k3 = [max(3, int(round(v * f)) | 1) for v in (5, 17, 61)]
h = 0.55 * (L - blur(L, k1)) + 0.35 * (L - blur(L, k2)) + 0.10 * (L - blur(L, k3))
h = np.where(h > 0, h * 0.6, h)

k = np.ones_like(L)
if arg('--rug'):
    R = np.asarray(Image.open(arg('--rug')).convert('RGB').resize((W, H), Image.LANCZOS)).astype(float) / 255
    k *= np.clip((R[..., 1] - 0.45) / 0.3, 0.15, 1.0)  # vidro (rugosidade baixa) fica liso
mx, mn = a.max(-1), a.min(-1)
sat = np.where(mx > 0.05, (mx - mn) / np.maximum(mx, 1e-6), 0)
k *= 1.0 - 0.7 * np.clip((blur(sat, max(3, int(9 * f) | 1)) - 0.35) / 0.2, 0, 1)  # placas pintadas
k = blur(k, max(3, int(9 * f) | 1))

dx = np.zeros_like(h)
dy = np.zeros_like(h)
dx[:, 1:-1] = (h[:, 2:] - h[:, :-2]) / 2
dy[1:-1] = (h[2:] - h[:-2]) / 2
dx[:, 0], dx[:, -1] = dx[:, 1], dx[:, -2]
dy[0], dy[-1] = dy[1], dy[-2]

sel = np.ones_like(L, bool)
if arg('--mascara'):
    sel = np.asarray(Image.open(arg('--mascara')).convert('L').resize((W, H), Image.NEAREST)) > 127


def gera(s):
    n = np.stack([-s * dx * k, s * dy * k, np.ones_like(dx)], -1)
    return n / np.linalg.norm(n, axis=-1, keepdims=True)


lo, hi = 0.1, 200.0
for _ in range(30):  # bissecção até o alvo de desvio
    s = (lo * hi) ** 0.5
    d = gera(s)[sel][:, :2].std()
    lo, hi = (s, hi) if d < alvo else (lo, s)
n = gera(s)
Image.fromarray(((n * 0.5 + 0.5) * 255 + 0.5).clip(0, 255).astype(np.uint8)).save(out_p)
print(f'{out_p.split("/")[-1]}: {W}x{H} força {s:.2f} desvio_xy {n[sel][:, :2].std():.3f}')
