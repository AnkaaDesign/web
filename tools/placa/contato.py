#!/usr/bin/env python3
"""FOLHA DE CONTATO da placa nos 49 cavalos.

    node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-placa-frota-0816.mjs
    python3 tools/placa/contato.py

Lê `tools/studio-bench/shots/frota-*.png`, ACHA a placa em cada retrato pela
tarja azul do Mercosul (ver `acha_placa()` — o centro do quadro não serve), e
monta uma folha única com o nome do modelo debaixo de cada quadro.

POR QUE UMA FOLHA, E NÃO 49 IMAGENS. A pergunta que ela responde é comparativa —
*"tem alguma fora do lugar?"* —, e essa pergunta se responde varrendo a página,
não abrindo 49 arquivos. Uma placa torta, alta demais ou flutuando salta aos
olhos ao lado de 48 certas; sozinha na tela, não salta.
"""
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw

AQUI = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(os.path.dirname(AQUI))
SHOTS = os.path.join(WEB, 'tools', 'studio-bench', 'shots')
SAIDA = os.path.join(SHOTS, 'placa-folha-de-contato.png')

COLUNAS = 7
QUADRO_W, QUADRO_H = 300, 200        # o recorte, já reduzido
RODAPE = 22
MARGEM = 6
FUNDO = (24, 26, 30)
TEXTO = (208, 212, 220)


def acha_placa(a: np.ndarray):
    """Onde a placa está no retrato, EM PIXEL — pela tarja azul do Mercosul.

    ⚠️ NÃO SE PODE ASSUMIR O CENTRO DO QUADRO. A câmera do check MIRA a placa,
    mas o estúdio tem expulsão de corpo e `minDistance` (uma esfera de ~1 raio
    do rig em volta da mira, ver `scene.ts`): pedir 1,15 m da placa devolve uma
    câmera a ~4 m, e o alvo pedido sai do centro. Medido, a placa caía a 98 % da
    altura do quadro — fora de qualquer recorte central. A primeira folha de
    contato saiu com doze fotos de GRADE.

    A tarja é o único azul saturado da cena: o caminhão é branco, a sala é
    cinza e a iluminação é neutra. `b > r + 40` sobrevive a qualquer exposição
    porque é uma diferença entre canais, não um limiar absoluto.

    Devolve `(cx, cy, largura_da_tarja)` ou `None`.
    """
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    azul = (b > 60) & (b > r + 40) & (b > g + 25)
    # 40 e não 200: quando o enquadramento do check corta a placa na borda de
    # baixo sobram poucas dezenas de texels de tarja, e é justamente aí que ver
    # o recorte importa. Quarenta pixels de azul saturado não acontecem por
    # acaso numa cena branca e cinza.
    if azul.sum() < 40:
        return None
    # ⚠️ O AZUL DA CENA NÃO É SÓ O DA PLACA. O emblema do grifo da Scania tem
    # campo azul, e no `scania_s_2024e_4x2` o centróide de "todo pixel azul"
    # pousou nele — a folha saiu com um brasão no lugar da placa. O que separa
    # os dois é a FORMA: a tarja do Mercosul é uma tira larga e baixa; o brasão
    # é quase quadrado. Então a linha com MAIS azul manda, e só as vizinhas
    # dela entram na conta.
    por_linha = azul.sum(axis=1)
    # A MAIS BAIXA das linhas fortes, não a mais forte. O brasão da Scania tem
    # 200 px de azul e passa qualquer teste de largura; o que ele nunca é, num
    # retrato da dianteira, é a coisa azul mais BAIXA do quadro. A placa é.
    fortes = np.nonzero(por_linha >= 0.5 * por_linha.max())[0]
    linha = int(fortes.max())
    faixa = np.zeros_like(azul)
    lo, hi = max(0, linha - 12), min(azul.shape[0], linha + 13)
    faixa[lo:hi] = azul[lo:hi]
    ys, xs = np.nonzero(faixa)
    largura = int(xs.max() - xs.min() + 1)
    altura = int(ys.max() - ys.min() + 1)
    if largura < 2.5 * altura:          # quase quadrado: é emblema, não tarja
        return None
    return int((xs.min() + xs.max()) / 2), int(ys.mean()), largura


def recorta(caminho: str) -> Image.Image:
    """A placa e o que está em volta dela, na proporção do quadro."""
    im = Image.open(caminho).convert('RGB')
    a = np.array(im)
    achou = acha_placa(a)
    alvo = QUADRO_W / QUADRO_H
    if achou:
        cx, cy, largura = achou
        # 3,2 × a largura da tarja mostra a placa e o para-choque em volta dela.
        w = max(int(largura * 3.2), 240)
        # E DESCE: a tarja é o topo da placa, não o meio dela. O centro da placa
        # fica ~0,37 altura abaixo do centro da tarja, e a placa mede
        # largura/3,08 de altura — sem isto a placa encosta na borda de baixo do
        # recorte em todos os quadros.
        cy += int(largura * 0.12)
    else:
        print('  ⚠ sem tarja azul em ' + os.path.basename(caminho) + ' — recorte central')
        cx, cy = im.width // 2, im.height // 2
        w = int(im.width * 0.42)
    h = int(w / alvo)
    if h > im.height:
        h, w = im.height, int(im.height * alvo)
    # Traz a janela para dentro do retrato sem mudar o tamanho dela.
    x0 = min(max(cx - w // 2, 0), im.width - w)
    y0 = min(max(cy - h // 2, 0), im.height - h)
    return im.crop((x0, y0, x0 + w, y0 + h)).resize((QUADRO_W, QUADRO_H), Image.LANCZOS)


def main() -> int:
    # Ordena pelo NOME DO MODELO, não pelo arquivo: a numeração reinicia a cada
    # lote (`--marca`), então ordenar pelo arquivo intercalaria os fabricantes.
    # Pelo modelo, o prefixo (`daf_`, `scania_`, …) já agrupa sozinho.
    arquivos = sorted(
        (f for f in os.listdir(SHOTS) if re.match(r'^frota-\d+-.*\.png$', f)),
        key=lambda f: re.sub(r'^frota-\d+-', '', f),
    )
    if not arquivos:
        raise SystemExit('nenhum frota-*.png em ' + SHOTS + ' — rode o check da frota antes')

    linhas = (len(arquivos) + COLUNAS - 1) // COLUNAS
    W = COLUNAS * (QUADRO_W + MARGEM) + MARGEM
    H = linhas * (QUADRO_H + RODAPE + MARGEM) + MARGEM
    folha = Image.new('RGB', (W, H), FUNDO)
    d = ImageDraw.Draw(folha)

    for i, f in enumerate(arquivos):
        c, l = i % COLUNAS, i // COLUNAS
        x = MARGEM + c * (QUADRO_W + MARGEM)
        y = MARGEM + l * (QUADRO_H + RODAPE + MARGEM)
        folha.paste(recorta(os.path.join(SHOTS, f)), (x, y))
        rotulo = re.sub(r'^frota-\d+-', '', f[:-4])
        d.text((x + 2, y + QUADRO_H + 5), rotulo[:44], fill=TEXTO)

    folha.save(SAIDA)
    print('%s — %d quadros, %d x %d' % (os.path.relpath(SAIDA, WEB), len(arquivos), W, H))
    return 0


if __name__ == '__main__':
    sys.exit(main())
