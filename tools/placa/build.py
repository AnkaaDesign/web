#!/usr/bin/env python3
"""A ARTE DA PLACA, PREPARADA PARA VIRAR SUPERFÍCIE.

===============================================================================
O QUE ENTRA E O QUE SAI

    entra : tools/placa/fonte.png              (a arte como o Kennedy a entregou)
    sai   : public/models/vehicles/placa_mercosul_ankaa.webp        1024 x 333
            public/models/vehicles/placa_mercosul_ankaa_nor.webp     512 x 167

    python3 tools/placa/build.py

===============================================================================
POR QUE A ARTE NÃO PODE IR CRUA PARA O MATERIAL — três coisas, medidas

1. **ELA NÃO É A PLACA: ELA É A PLACA MAIS UMA SOMBRA.** O PNG tem 2172 x 724,
   e o corpo da placa (alfa > 240) ocupa só `x 64…2107 · y 51…649`. O resto é
   um halo de sombra em alfa parcial. Mapeado cru numa geometria retangular, o
   halo entra como uma moldura cinza translúcida em volta de uma placa que
   ficaria 6 % menor do que deveria.

2. **OS CANTOS SÃO REDONDOS NO ALFA, E A GEOMETRIA JÁ OS ARREDONDA.** O raio
   medido é de 57 px em 599 de altura (ajuste de círculo em oito linhas:
   r=15 -> 18,5 px previsto contra 18 medido). Duas arredondadas — a do alfa e
   a da malha — não coincidem no pixel, e o que sobra é uma franja. Aqui o alfa
   é DESCARTADO e os cantos são preenchidos com a cor da borda mais próxima na
   mesma linha (azul em cima, branco embaixo), para que o corte da malha caia
   sobre a cor certa em vez de sobre transparência.

3. **AS LETRAS SÃO ESTAMPADAS, NÃO IMPRESSAS.** Numa placa Mercosul brasileira
   o alumínio é embutido: os caracteres têm relevo de cerca de 1 mm e é ele que
   pega a luz rasante. Um mapa de cor sozinho devolve um ADESIVO. O normal map
   abaixo é derivado da própria arte — mas só do que é de fato estampado.

===============================================================================
O QUE ENTRA NO RELEVO, E O QUE NÃO ENTRA

Derivar o relevo de "pixel escuro" pegaria junto a tarja azul inteira, a
bandeira e o logotipo do Mercosul — todos IMPRESSOS, todos lisos na placa real.
O corte é geométrico e não cromático: só entra o que for escuro **e** estiver
abaixo da tarja azul. Isso seleciona exatamente `ANKAA` e o `BR` do canto, que
são os dois blocos estampados.

A altura vira normal por diferença central sobre o borrão gaussiano da máscara:
o borrão é o que dá o CHANFRO da borda estampada (uma máscara dura daria uma
parede vertical, que em normal map é uma linha preta de um texel).
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

AQUI = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(os.path.dirname(AQUI))
FONTE = os.path.join(AQUI, 'fonte.png')
DESTINO = os.path.join(WEB, 'public', 'models', 'vehicles')

# A placa Mercosul brasileira de automóvel/caminhão: 400 x 130 mm.
LARGURA_MM, ALTURA_MM = 400.0, 130.0
COR_W = 1024
COR_H = int(round(COR_W * ALTURA_MM / LARGURA_MM))     # 333
NOR_W = COR_W // 2
NOR_H = COR_H // 2

# Quanto do relevo, em fração da altura da placa. 1,0 mm em 130 mm.
RELEVO_MM = 1.0


def recorta(im: Image.Image) -> Image.Image:
    """O corpo da placa, sem o halo de sombra do PNG."""
    a = np.array(im)
    solido = a[..., 3] > 240
    ys, xs = np.nonzero(solido)
    if not len(xs):
        raise SystemExit('a arte não tem corpo opaco — fonte errada?')
    return im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def preenche_cantos(im: Image.Image) -> Image.Image:
    """Joga fora o alfa, estendendo a cor da borda para dentro dos cantos.

    Por linha, e não por vizinho mais próximo em 2D: os cantos são a ÚNICA
    região translúcida do recorte, e em cada linha deles a cor certa é
    literalmente a do primeiro pixel opaco daquela linha — azul nas de cima,
    branco nas de baixo. Uma linha inteira transparente não existe (o corte é
    pelo alfa sólido), então não há caso a tratar.
    """
    a = np.array(im).astype(np.int16)
    rgb, alfa = a[..., :3], a[..., 3]
    opaco = alfa > 200
    for y in range(rgb.shape[0]):
        idx = np.nonzero(opaco[y])[0]
        if not len(idx):
            continue
        lo, hi = int(idx[0]), int(idx[-1])
        rgb[y, :lo] = rgb[y, lo]
        rgb[y, hi + 1:] = rgb[y, hi]
    return Image.fromarray(rgb.astype(np.uint8), 'RGB')


def mascara_estampada(cor: Image.Image) -> np.ndarray:
    """Onde há relevo: escuro E abaixo da tarja azul. Ver o cabeçalho."""
    a = np.array(cor).astype(np.float32) / 255.0
    lum = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    azul = (a[..., 2] > 0.35) & (a[..., 2] > a[..., 0] + 0.15) & (a[..., 2] > a[..., 1] + 0.15)
    # A tarja é a faixa contínua de azul que encosta no topo: sua base é a
    # última linha em que mais de 30 % da largura é azul.
    frac = azul.mean(axis=1)
    linhas = np.nonzero(frac > 0.30)[0]
    base = int(linhas.max()) + 1 if len(linhas) else 0
    m = np.zeros(lum.shape, dtype=np.float32)
    m[base:] = (lum[base:] < 0.28).astype(np.float32)
    return m, base


def normal_de_altura(altura: np.ndarray, escala: float) -> Image.Image:
    """Normal tangencial por diferença central. +Y para cima (OpenGL/three)."""
    dx = np.zeros_like(altura)
    dy = np.zeros_like(altura)
    dx[:, 1:-1] = (altura[:, 2:] - altura[:, :-2]) * 0.5
    dy[1:-1, :] = (altura[2:, :] - altura[:-2, :]) * 0.5
    # n = normalize(-dh/dx, +dh/dy, 1); o +dy é porque a linha 0 é o TOPO.
    nx = -dx * escala
    ny = dy * escala
    nz = np.ones_like(altura)
    L = np.sqrt(nx * nx + ny * ny + nz * nz)
    out = np.stack([nx / L, ny / L, nz / L], axis=-1)
    return Image.fromarray(((out * 0.5 + 0.5) * 255.0).round().astype(np.uint8), 'RGB')


def main() -> int:
    if not os.path.exists(FONTE):
        raise SystemExit('falta ' + FONTE)
    im = Image.open(FONTE).convert('RGBA')
    corpo = recorta(im)
    print('recorte  %d x %d  (proporção %.3f; a placa real é %.3f)'
          % (corpo.width, corpo.height, corpo.width / corpo.height, LARGURA_MM / ALTURA_MM))
    chapa = preenche_cantos(corpo)
    cor = chapa.resize((COR_W, COR_H), Image.LANCZOS)

    mascara, base = mascara_estampada(cor)
    print('tarja azul termina na linha %d de %d; %.1f%% da chapa é estampada'
          % (base, COR_H, 100.0 * mascara.mean()))

    # O borrão dá o chanfro. 0,9 % da altura ≈ 1,2 mm de rampa — a mesma ordem
    # do relevo, que é o que uma estampagem de chapa faz.
    suave = Image.fromarray((mascara * 255).astype(np.uint8), 'L') \
        .filter(ImageFilter.GaussianBlur(radius=max(1.0, COR_H * 0.009)))
    altura = np.array(suave).astype(np.float32) / 255.0
    altura = np.array(Image.fromarray((altura * 255).astype(np.uint8), 'L')
                      .resize((NOR_W, NOR_H), Image.LANCZOS)).astype(np.float32) / 255.0
    # Escala: 1 texel de normal vale ALTURA_MM/NOR_H mm, e o relevo é RELEVO_MM.
    mm_por_texel = ALTURA_MM / NOR_H
    nor = normal_de_altura(altura, RELEVO_MM / mm_por_texel)

    os.makedirs(DESTINO, exist_ok=True)
    p_cor = os.path.join(DESTINO, 'placa_mercosul_ankaa.webp')
    p_nor = os.path.join(DESTINO, 'placa_mercosul_ankaa_nor.webp')
    cor.save(p_cor, 'WEBP', lossless=True, quality=100, method=6)
    nor.save(p_nor, 'WEBP', lossless=True, quality=100, method=6)
    for p in (p_cor, p_nor):
        print('%-58s %7.1f kB' % (os.path.relpath(p, WEB), os.path.getsize(p) / 1024))
    return 0


if __name__ == '__main__':
    sys.exit(main())
