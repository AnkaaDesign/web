# Medidor de plate equirretangular (.hdr Radiance RGBE) — sem navegador, sem three.
#
#   python hdri_stats.py sky.hdr sky-night.hdr ...
#   python hdri_stats.py --json *.hdr
#
# POR QUE ESTE ARQUIVO EXISTE. A tabela §1.0 de `public/environments/CREDITS.md`
# afirma três medidas sobre o par de céus do `distrito-industrial` — posição da
# fonte em `u`, luminância média ponderada por sólido e pico — e diz que elas são
# reproduzíveis. Não eram: o leitor que as produziu não está no repositório.
# Escolher um plate de noite pelo NOME ("night" na etiqueta do Poly Haven) é
# exatamente como se chega a um céu de noite com 43 % da luz do de dia, que é o
# defeito que este medidor existe para não repetir.
#
# O QUE ELE MEDE, e por que cada número decide alguma coisa:
#
#   media_solida   luminância média PONDERADA POR sin θ. Um equirect tem linhas
#                  de área muito diferente — a linha do zênite é um ponto e a do
#                  horizonte é o equador —, então a média aritmética de pixels
#                  superestima os polos. É este número, e não o outro, que diz
#                  quanta luz o PMREM vai devolver como irradiância.
#   media_sup      idem, só o hemisfério de CIMA (v < 0,5). Num `_puresky` a
#                  metade de baixo é um degradê sintético que NÃO ilumina nada
#                  na cena (o chão é geometria), então é esta a que se compara.
#   pico / pico_uv o disco da fonte. `_puresky` doma o SOL mas ninguém doma a
#                  LUA: é daí que sai a curva não-linear de `scene/skyblend.ts`.
#   fonte_u        a coluna do centroide de energia acima de 1 % do pico —
#                  robusta a um pixel quente solto, ao contrário do argmax.
#                  É o que decide se um `envRotation` serve aos dois plates.
#   b_sobre_r      balanço de cor ponderado por sólido. Noite lê como noite pelo
#                  CONTEÚDO (azul, lua, estrela) antes de ler pelo nível.
#   plano_inf      desvio-padrão relativo da metade de baixo. Perto de zero =
#                  degradê limpo, ou seja plate `_puresky`, ou seja seguro sobre
#                  um cenário que traz o próprio chão.
#
# O leitor cobre o RGBE de verdade: cabeçalho de texto, `-Y H +X W`, RLE novo
# (contagem > 128 por canal) e o formato plano. `EXPOSURE=` do cabeçalho é
# aplicado, porque ignorá-lo é o erro clássico que faz dois plates da mesma série
# parecerem diferir de meia parada.
import json
import math
import sys

import numpy as np


def read_hdr(path):
    """Radiance .hdr → (H, W, 3) float32 linear. Levanta em formato não suportado."""
    with open(path, "rb") as f:
        data = f.read()

    # ---- cabeçalho de texto, terminado por linha em branco ----
    pos = 0
    exposure = 1.0
    fmt = None
    while True:
        eol = data.index(b"\n", pos)
        line = data[pos:eol].decode("latin-1").strip()
        pos = eol + 1
        if line == "":
            break
        if line.upper().startswith("FORMAT="):
            fmt = line.split("=", 1)[1].strip()
        elif line.upper().startswith("EXPOSURE="):
            # Radiance permite VÁRIAS linhas EXPOSURE; elas MULTIPLICAM.
            exposure *= float(line.split("=", 1)[1])
    if fmt not in (None, "32-bit_rle_rgbe"):
        raise ValueError("formato não suportado: %s" % fmt)

    # ---- resolução. Só a orientação canônica; qualquer outra é erro explícito. ----
    eol = data.index(b"\n", pos)
    res = data[pos:eol].decode("latin-1").strip().split()
    pos = eol + 1
    if len(res) != 4 or res[0] != "-Y" or res[2] != "+X":
        raise ValueError("orientação não suportada: %s" % " ".join(res))
    h, w = int(res[1]), int(res[3])

    rgbe = np.empty((h, w, 4), dtype=np.uint8)
    buf = np.frombuffer(data, dtype=np.uint8)
    for y in range(h):
        if w < 8 or w > 0x7FFF or not (
            buf[pos] == 2 and buf[pos + 1] == 2 and (int(buf[pos + 2]) << 8 | int(buf[pos + 3])) == w
        ):
            # linha PLANA (sem RLE, ou RLE antigo que este acervo não usa)
            rgbe[y] = buf[pos:pos + w * 4].reshape(w, 4)
            pos += w * 4
            continue
        pos += 4
        # RLE NOVO: os quatro canais vêm SEPARADOS, cada um com suas corridas.
        for c in range(4):
            x = 0
            while x < w:
                n = int(buf[pos]); pos += 1
                if n > 128:                       # corrida: um valor repetido n-128 vezes
                    rgbe[y, x:x + n - 128, c] = buf[pos]; pos += 1
                    x += n - 128
                else:                             # literal: n bytes crus
                    rgbe[y, x:x + n, c] = buf[pos:pos + n]; pos += n
                    x += n

    e = rgbe[:, :, 3].astype(np.int32)
    # 2^(e-136) = 2^(e-128) / 256 — a mantissa é 0..255 e o expoente tem viés 128.
    scale = np.where(e > 0, np.ldexp(1.0, e - 136), 0.0).astype(np.float32)
    img = rgbe[:, :, :3].astype(np.float32) * scale[:, :, None]
    if exposure != 1.0:
        img /= exposure
    return img


# Rec.709, que é o primário do sRGB linear em que o three amostra o envmap.
LUM = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)


def stats(path):
    img = read_hdr(path)
    h, w, _ = img.shape
    lum = img @ LUM

    # sin θ com θ medido do zênite, amostrado no CENTRO da linha.
    theta = (np.arange(h, dtype=np.float64) + 0.5) * math.pi / h
    wgt = np.sin(theta)[:, None]
    sup = slice(0, h // 2)                     # v < 0,5 é o hemisfério de CIMA

    def wmean(a, rows=slice(None)):
        return float((a[rows] * wgt[rows]).sum() / (wgt[rows] * np.ones((1, w))).sum())

    iy, ix = np.unravel_index(int(np.argmax(lum)), lum.shape)
    pico = float(lum[iy, ix])

    # Centroide de energia da FONTE: tudo acima de 1 % do pico, em u circular
    # (a costura em u = 0 é real — uma média aritmética a atravessaria errado).
    mask = lum >= pico * 0.01
    if mask.sum() == 0:
        fonte_u = ix / w
    else:
        ang = (np.nonzero(mask)[1] + 0.5) * (2 * math.pi / w)
        en = lum[mask]
        fonte_u = (math.atan2(float((np.sin(ang) * en).sum()),
                              float((np.cos(ang) * en).sum())) / (2 * math.pi)) % 1.0

    inf = lum[h // 2:]
    m_inf = float(inf.mean())
    return {
        "arquivo": path.split("/")[-1],
        "tam": [w, h],
        "media_solida": wmean(lum),
        "media_sup": wmean(lum, sup),
        "pico": pico,
        "pico_uv": [round((ix + 0.5) / w, 4), round((iy + 0.5) / h, 4)],
        "fonte_u": round(fonte_u, 4),
        "b_sobre_r": wmean(img[:, :, 2]) / max(1e-9, wmean(img[:, :, 0])),
        "plano_inf": float(inf.std() / max(1e-9, m_inf)),
    }


def main(argv):
    as_json = "--json" in argv
    files = [a for a in argv if not a.startswith("--")]
    rows = [stats(p) for p in files]
    if as_json:
        print(json.dumps(rows, indent=1))
        return
    hdr = ("arquivo", "tam", "média sólida", "média sup", "pico", "pico uv",
           "fonte u", "B/R", "plano inf")
    print("%-34s %-10s %13s %11s %12s %-15s %8s %6s %10s" % hdr)
    for r in rows:
        print("%-34s %-10s %13.5f %11.5f %12.1f %-15s %8.4f %6.3f %10.4f" % (
            r["arquivo"], "%dx%d" % tuple(r["tam"]), r["media_solida"], r["media_sup"],
            r["pico"], str(r["pico_uv"]), r["fonte_u"], r["b_sobre_r"], r["plano_inf"]))


if __name__ == "__main__":
    main(sys.argv[1:])
