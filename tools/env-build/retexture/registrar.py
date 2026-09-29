"""Encaixa uma textura regenerada no layout do atlas original.

Ajuste geral (afim, ECC sobre o gradiente) e depois refinamento POR ILHA de UV:
cada ilha grande procura o seu próprio afim a partir do geral e só fica com ele se a
correlação dentro da ilha subir. A saída está no quadro do ORIGINAL.

uso: registrar.py NOVO ORIGINAL MASCARA_UV SAIDA LARGURA_SAIDA [--relatorio PNG]
"""
import sys
import cv2
import numpy as np

novo_p, orig_p, mask_p, out_p, out_w = sys.argv[1:6]
out_w = int(out_w)
rel = sys.argv[sys.argv.index('--relatorio') + 1] if '--relatorio' in sys.argv else None

orig = cv2.imread(orig_p, cv2.IMREAD_COLOR)
novo = cv2.imread(novo_p, cv2.IMREAD_UNCHANGED)
if novo.ndim == 2:
    novo = cv2.cvtColor(novo, cv2.COLOR_GRAY2BGR)
mask_full = cv2.imread(mask_p, cv2.IMREAD_GRAYSCALE)

# quadro de trabalho: 1024 no lado maior
oh, ow = orig.shape[:2]
FW = 1024
FH = int(round(FW * oh / ow))


def feat(img, w, h):
    g = cv2.cvtColor(cv2.resize(img[..., :3], (w, h), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY).astype(np.float32)
    g = cv2.GaussianBlur(g, (0, 0), 1.2)
    gx = cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3)
    m = cv2.magnitude(gx, gy)
    m = np.log1p(m)
    return cv2.GaussianBlur(m, (0, 0), 1.5)


fo = feat(orig, FW, FH)
fn = feat(novo, FW, FH)  # o novo esticado ao quadro do original = ponto de partida
mask = cv2.resize(mask_full, (FW, FH), interpolation=cv2.INTER_NEAREST)
mask = (mask > 127).astype(np.uint8)


def ncc(a, b, m):
    a = a[m > 0]
    b = b[m > 0]
    if a.size < 50:
        return -1.0
    a = (a - a.mean()) / (a.std() + 1e-6)
    b = (b - b.mean()) / (b.std() + 1e-6)
    return float((a * b).mean())


def warp_feat(W):
    return cv2.warpAffine(fn, W, (FW, FH), flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REFLECT)


def ecc(W0, m, iters=200):
    W = W0.astype(np.float32).copy()
    try:
        _, W = cv2.findTransformECC(fo, fn, W, cv2.MOTION_AFFINE,
                                    (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, iters, 1e-6),
                                    m.astype(np.uint8), 5)
    except cv2.error:
        return None
    return W


def sano(W, ref):
    A = W[:, :2]
    s = np.linalg.svd(A, compute_uv=False)
    if s.max() > 1.25 or s.min() < 0.8:
        return False
    if abs(A[0, 1]) > 0.06 or abs(A[1, 0]) > 0.06:
        return False
    return np.abs(W[:, 2] - ref[:, 2]).max() < 70


I = np.eye(2, 3, dtype=np.float32)
dil = cv2.dilate(mask, np.ones((5, 5), np.uint8))
c_id = ncc(fo, fn, dil)
# geral: tenta a partir da identidade; se piorar, fica a identidade
Wg = ecc(I, dil)
c_g = ncc(fo, warp_feat(Wg), dil) if Wg is not None else -1
if Wg is None or not sano(Wg, I) or c_g < c_id + 0.005:
    Wg, c_g = I, c_id
linhas = [f'geral: ncc {c_id:.3f} -> {c_g:.3f}  A={np.round(Wg, 3).tolist()}']

# ilhas: componentes da máscara dilatada (junta ilhas vizinhas pequenas)
grp = cv2.dilate(mask, np.ones((13, 13), np.uint8))
n, lab, stats, _ = cv2.connectedComponentsWithStats(grp, 8)
ilhas = []
for k in range(1, n):
    area = stats[k, cv2.CC_STAT_AREA]
    mk = ((lab == k) & (dil > 0)).astype(np.uint8)
    if area < 2500:
        ilhas.append((k, Wg, None))
        continue
    base = ncc(fo, warp_feat(Wg), mk)
    Wk = ecc(Wg, mk, 150)
    if Wk is not None and sano(Wk, Wg):
        ck = ncc(fo, warp_feat(Wk), mk)
        if ck > base + 0.02:
            ilhas.append((k, Wk, (base, ck, area)))
            continue
    ilhas.append((k, Wg, (base, base, area)))

# composição na resolução de saída
OW = out_w
OH = int(round(OW * oh / ow))
sc = OW / FW
nh, nw = novo.shape[:2]
# o afim mapeia quadro(1024) -> novo esticado a (FW,FH); na saída: saída -> novo em pixels nativos
S_out = np.array([[1 / sc, 0, 0], [0, 1 / sc, 0], [0, 0, 1]])
S_novo = np.array([[nw / FW, 0, 0], [0, nh / FH, 0], [0, 0, 1]])


def para_saida(W):
    M = np.vstack([W, [0, 0, 1]])
    return (S_novo @ M @ S_out)[:2].astype(np.float32)


def render(W):
    return cv2.warpAffine(novo, para_saida(W), (OW, OH), flags=cv2.INTER_LANCZOS4 + cv2.WARP_INVERSE_MAP,
                          borderMode=cv2.BORDER_REFLECT)


out = render(Wg)
lab_o = cv2.resize(lab.astype(np.int32).astype(np.float32), (OW, OH), interpolation=cv2.INTER_NEAREST).astype(np.int32)
refinadas = 0
for k, Wk, info in ilhas:
    if Wk is Wg:
        continue
    refinadas += 1
    r = render(Wk)
    m = lab_o == k
    out[m] = r[m]
    b, c, a = info
    linhas.append(f'  ilha {k:3d} área {a:6d}: ncc {b:.3f} -> {c:.3f}')
avaliadas = sum(1 for _, _, i in ilhas if i is not None)
linhas.append(f'ilhas: {n - 1}, avaliadas {avaliadas}, refinadas {refinadas}')

# correlação final dentro das ilhas (no quadro de trabalho)
ff = feat(out, FW, FH)
linhas.append(f'final: ncc {ncc(fo, ff, dil):.3f} (sem ajuste {c_id:.3f})')
cv2.imwrite(out_p, out)
print('\n'.join(linhas))

if rel:
    # bordas do original (magenta) sobre o resultado, só nas ilhas
    e = cv2.Canny(cv2.cvtColor(cv2.resize(orig, (OW, OH)), cv2.COLOR_BGR2GRAY), 60, 160)
    m_o = cv2.resize(dil, (OW, OH), interpolation=cv2.INTER_NEAREST) > 0
    v = (out[..., :3].astype(np.float32) * np.where(m_o[..., None], 0.85, 0.3)).astype(np.uint8)
    v[(e > 0) & m_o] = (255, 0, 255)
    cv2.imwrite(rel, v)
