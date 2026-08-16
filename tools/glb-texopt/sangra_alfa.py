#!/usr/bin/env python3
"""Tira o HALO BRANCO dos decalques de um .glb, sem mexer em mais nada.

O DEFEITO, MEDIDO
---------------------------------------------------------------------------
Relato de 2026-08-16, com print: *"os adesivos do Thermo King — as bordas ficam
brancas, fica estranho"*. Medido em `thermoking.glb`, imagem 3 (`tk_logo`,
1024x1024, RGBA):

    alfa == 0   em 67,4% dos texels   ·   RGB medio ali = (254,4  254,5  254,4)
    alfa == 255 em 29,2%              ·   RGB medio ali = ( 26,4   62,8   69,4)

Ou seja: DOIS TERCOS da imagem sao brancos e invisiveis. Isso e correto no
arquivo e catastrofico na GPU, por uma razao que nao tem nada a ver com o
formato: **a filtragem bilinear e o mipmap fazem a media de RGB e de ALFA
SEPARADAMENTE**. Um texel de mip 3 e a media de 8x8 texels do original; num
recorte de letra, essa media mistura o preto do glifo (a=255) com o branco do
vazio (a=0) e devolve RGB ~200 com alfa ~80. O material do decalque resolve o
recorte por `alphaTest = 0.5` (ver `auditTransparency()` em
`engine/vehicle/models.ts`), entao o que sobrevive ao corte e justamente a orla
onde o alfa ainda passa de 0,5 — e ela carrega o branco do vazio.

Nenhum ajuste de filtro, anisotropia ou `alphaTest` conserta isso: o dado esta
errado antes de chegar ao amostrador. A cor de um texel INVISIVEL nunca deveria
ter sido branca; ela deveria ser a cor do texel VISIVEL mais proximo, para que
qualquer media entre os dois continue dando a cor do desenho.

O CONSERTO — sangria de alfa (alpha bleed / dilate), e ele e classico
---------------------------------------------------------------------------
O canal ALFA nao e tocado: o recorte continua exatamente o mesmo, bit a bit.
O que muda e o RGB dos texels transparentes, que passa a ser o do vizinho opaco
mais proximo, propagado ate a imagem inteira ficar coberta. Depois disso a media
de mip entre glifo e vazio da a cor do GLIFO, e a orla some.

E o alfa nao ser tocado e o que torna esta ferramenta segura de rodar duas
vezes: a segunda passada encontra a mesma mascara e chega ao mesmo resultado.

A DOUTRINA DO CONTEINER e a mesma de `texopt.py`, e pelos mesmos motivos
---------------------------------------------------------------------------
Nada de `gltf-transform`: `trailer.glb` e Draco e a §6 do ARCHITECTURE.md
proibe o round-trip. Aqui tambem nao se abre malha nenhuma. Le-se o chunk JSON e
o BIN, decodifica-se SO as imagens escolhidas, os bytes novos sao APENSADOS no
fim do BIN e `images[i].bufferView` e repontado. Nenhum `byteOffset` existente
muda, entao todo acessor, todo buffer Draco e toda imagem nao listada saem byte
a byte identicos — e isso e CONFERIDO no fim, nao prometido.

QUAIS IMAGENS, e por que nao "todas as que tem alfa"
---------------------------------------------------------------------------
So as texturas de COR BASE de materiais cujo `alphaMode` nao e `OPAQUE`. Um
normal map, um ORM ou um mapa de rugosidade tambem podem ter quatro canais, e
neles o quarto canal NAO e cobertura — sangrar os tres primeiros ali seria
corromper dado geometrico para consertar um problema que aquela textura nao tem.
`--todas` existe para o caso raro em que a cobertura mora em outro lugar, e
avisa por extenso o que esta fazendo.

USO
    python3 tools/glb-texopt/sangra_alfa.py public/models/vehicles/thermoking.glb --report
    python3 tools/glb-texopt/sangra_alfa.py public/models/vehicles/thermoking.glb
    python3 tools/glb-texopt/sangra_alfa.py ARQUIVO.glb --image 3 --image 2

`--report` nao escreve nada: lista cada candidata com a fracao transparente e a
cor media do vazio, que e o numero com o qual se decide se ha halo.
"""
from __future__ import annotations

import argparse
import io
import json
import os
import shutil
import struct
import sys
from datetime import datetime

try:
    from PIL import Image
except ImportError:
    sys.exit('precisa do Pillow:  pip install --user Pillow')
try:
    import numpy as np
except ImportError:
    sys.exit('precisa do numpy:  pip install --user numpy')

JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942


def read_glb(path: str):
    raw = open(path, 'rb').read()
    if raw[:4] != b'glTF':
        sys.exit(f'{path}: nao e um .glb')
    off, js, bin_off, bin_len = 12, None, None, None
    while off + 8 <= len(raw):
        ln, ty = struct.unpack_from('<II', raw, off)
        body = off + 8
        if ty == JSON_CHUNK:
            js = json.loads(raw[body:body + ln])
        elif ty == BIN_CHUNK:
            bin_off, bin_len = body, ln
        off = body + ln + ((4 - ln % 4) % 4 if ln % 4 else 0)
    if js is None or bin_off is None:
        sys.exit(f'{path}: falta o chunk JSON ou o BIN')
    return raw, js, bin_off, bin_len


def image_bytes(raw, js, bin_off, index):
    im = js['images'][index]
    if 'bufferView' not in im:
        return None
    bv = js['bufferViews'][im['bufferView']]
    a = bin_off + bv.get('byteOffset', 0)
    return raw[a:a + bv['byteLength']]


def candidatas(js) -> dict[int, str]:
    """Imagem -> por que ela e candidata. So cor base de material recortado."""
    out: dict[int, str] = {}
    texturas = js.get('textures', [])
    for m in js.get('materials', []):
        modo = m.get('alphaMode', 'OPAQUE')
        if modo == 'OPAQUE':
            continue
        t = (m.get('pbrMetallicRoughness') or {}).get('baseColorTexture')
        if not t:
            continue
        src = texturas[t['index']].get('source')
        if src is None:
            continue
        out[src] = f"{m.get('name', '(sem nome)')} · alphaMode {modo}"
    return out


def censo(px: np.ndarray) -> dict:
    a = px[..., 3]
    vazio = a == 0
    cheio = a == 255
    d = {
        'transparente': float(vazio.mean()),
        'parcial': float(((a > 0) & (a < 255)).mean()),
    }
    d['rgb_vazio'] = [round(float(v), 1) for v in px[vazio][:, :3].mean(0)] if vazio.any() else None
    d['rgb_cheio'] = [round(float(v), 1) for v in px[cheio][:, :3].mean(0)] if cheio.any() else None
    return d


def sangrar(px: np.ndarray, limiar: int = 250) -> tuple[np.ndarray, int]:
    """Propaga o RGB dos texels validos sobre os invalidos. O ALFA nao e tocado.

    `valido` comeca em `alfa >= limiar`. A cada passada, todo texel invalido com
    ao menos um vizinho valido (vizinhanca de 8) recebe a cor de UM deles e passa
    a ser valido. Repete ate cobrir a imagem: o resultado e um mosaico de Voronoi
    sobre o vazio, cada regiao com a cor do texel visivel mais proximo.

    ⚠️ O VIZINHO MAIS PROXIMO, E NAO A MEDIA DOS VIZINHOS — e a razao e o
    TAMANHO DO ARQUIVO, medida nas duas versoes:

        media dos vizinhos   tk_logo   74 KB → 184 KB    decals  67 KB →  41 KB
        vizinho mais proximo tk_logo   74 KB →  83 KB    decals  67 KB →  36 KB

    As duas dao exatamente a mesma media de cor no vazio (69,5 / 83,5 / 77,7), ou
    seja consertam o halo igual. A media, porem, escreve um DEGRADE suave por
    todo o vazio, e degrade e a coisa que o PNG comprime pior — cem kilobytes de
    entropia em texels que nenhum mip raso amostra. O mosaico e constante por
    regiao e comprime como o branco chapado que ele substituiu: o arquivo inteiro
    sai MENOR do que entrou (141 KB de imagem → 119 KB).

    O contra da escolha do vizinho e uma direcao preferida na quina de um glifo.
    Ela existe, e vive inteira DENTRO da regiao invisivel: o que o amostrador ve
    e a media entre um texel visivel e o vazio ao lado dele, e esse vazio carrega
    a cor do proprio visivel nos dois metodos.

    ⚠️ O LIMIAR E 250, E NAO 0 — E ESTA E A OUTRA METADE DO CONSERTO, a que nao e
    obvia.
    Com `limiar = 0` todo texel PARCIAL vira semente, e no `tk_logo` a semente
    fica errada. Medido na linha 512, atravessando a borda do emblema:

        x 165   RGBA (255, 251, 255,   7)   ← vazio: branco
        x 211   RGBA (205, 236, 249, 128)   ← meia cobertura
        x 220   RGBA ( 33, 162, 222, 252)   ← cheio: o ciano do logo

    O texel de meia cobertura NAO carrega o ciano com metade de alfa: ele carrega
    uma cor JA MISTURADA com o branco do vazio (o bake foi reamostrado sobre
    fundo branco). Semear a partir dele espalharia esse branco para dentro do
    vazio — a media do vazio caiu so de 254 para 211 na primeira tentativa, e o
    halo continuaria lá.

    Semeando so no que e opaco de verdade, a orla ANTIALIASADA tambem e
    reescrita: ela passa a ter a cor do desenho com a cobertura que ja tinha,
    que e o que uma textura de recorte nao premultiplicada deveria ter guardado
    desde o inicio. **A FORMA NAO MUDA** — o canal alfa sai bit a bit igual, e a
    trava em `aplicar()` recusa a gravacao se nao sair.
    """
    rgb = px[..., :3].copy()
    valido = px[..., 3] >= limiar
    if not valido.any() or valido.all():
        return px, 0
    passadas = 0
    # Os ortogonais ANTES dos diagonais: assim uma frente que avanca reto ganha
    # de uma que avanca na diagonal, que e a ordem certa para "mais proximo".
    VIZ = ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1))
    while not valido.all():
        novo = valido.copy()
        mudou = False
        for dy, dx in VIZ:
            v = np.roll(np.roll(valido, dy, 0), dx, 1)
            c = np.roll(np.roll(rgb, dy, 0), dx, 1)
            # As bordas NAO envolvem: um texel da linha 0 nao herda da linha
            # final. A textura pode ser `RepeatWrapping`, mas a sangria e sobre
            # proximidade no DESENHO, e `np.roll` e circular.
            if dy == 1:
                v[0, :] = False
            elif dy == -1:
                v[-1, :] = False
            if dx == 1:
                v[:, 0] = False
            elif dx == -1:
                v[:, -1] = False
            alvo = (~novo) & v
            if alvo.any():
                rgb[alvo] = c[alvo]
                novo |= alvo
                mudou = True
        if not mudou:
            break                      # regiao isolada: nada mais a propagar
        valido = novo
        passadas += 1
        if passadas > 4096:
            break
    fora = px.copy()
    fora[..., :3] = rgb
    return fora, passadas


def report(path: str):
    raw, js, bin_off, _ = read_glb(path)
    alvos = candidatas(js)
    print(f'{os.path.basename(path)} · {len(js.get("images", []))} imagens ·'
          f' {len(alvos)} candidata(s)\n')
    for idx in sorted(alvos):
        blob = image_bytes(raw, js, bin_off, idx)
        if blob is None:
            print(f'  [{idx}] imagem por URI — pulada')
            continue
        im = Image.open(io.BytesIO(blob)).convert('RGBA')
        px = np.array(im)
        c = censo(px)
        nome = js['images'][idx].get('name', '?')
        print(f'  [{idx}] {nome} {im.size[0]}x{im.size[1]} — {alvos[idx]}')
        print(f'        transparente {c["transparente"] * 100:5.1f}%'
              f' · parcial {c["parcial"] * 100:4.1f}%'
              f' · RGB do vazio {c["rgb_vazio"]} · RGB do cheio {c["rgb_cheio"]}')
        if c['rgb_vazio'] and c['rgb_cheio']:
            d = sum(abs(a - b) for a, b in zip(c['rgb_vazio'], c['rgb_cheio']))
            print(f'        distancia vazio-cheio {d:.0f}/765'
                  f'  {"⇒ HALO" if d > 150 else "(sem halo relevante)"}')


def aplicar(path: str, alvos: list[int], limiar: int = 250, dry: bool = False):
    raw, js, bin_off, bin_len = read_glb(path)
    bin_data = bytearray(raw[bin_off:bin_off + bin_len])
    antigos = {i: image_bytes(raw, js, bin_off, i) for i in range(len(js.get('images', [])))}
    tocadas: set[int] = set()

    for idx in alvos:
        blob = antigos.get(idx)
        if blob is None:
            print(f'  [{idx}] sem bufferView (imagem por URI) — pulada')
            continue
        im = Image.open(io.BytesIO(blob))
        if im.mode != 'RGBA':
            print(f'  [{idx}] sem canal alfa ({im.mode}) — pulada')
            continue
        px = np.array(im)
        antes = censo(px)
        novo_px, passadas = sangrar(px, limiar)
        # ⚠️ A TRAVA: o alfa TEM de sair identico. E ele que define o recorte, e
        # esta ferramenta so promete mexer em cor.
        if not np.array_equal(px[..., 3], novo_px[..., 3]):
            sys.exit(f'  [{idx}] ABORTADO — o alfa mudou, o que esta ferramenta nao faz')
        buf = io.BytesIO()
        Image.fromarray(novo_px, 'RGBA').save(buf, format='PNG', optimize=True)
        novo = buf.getvalue()
        depois = censo(novo_px)
        nome = js['images'][idx].get('name', '?')
        print(f'  [{idx}] {nome} {im.size[0]}x{im.size[1]} · {passadas} passadas ·'
              f' RGB do vazio {antes["rgb_vazio"]} → {depois["rgb_vazio"]}'
              f' · {len(blob) / 1024:.0f} → {len(novo) / 1024:.0f} KB')
        if dry:
            continue
        # APENSA e alinha a 4 — a spec exige o alinhamento do bufferView, e
        # `byteOffset` e relativo ao inicio do BIN, que nao se move.
        while len(bin_data) % 4:
            bin_data.append(0)
        offset = len(bin_data)
        bin_data.extend(novo)
        js['bufferViews'].append(
            {'buffer': 0, 'byteOffset': offset, 'byteLength': len(novo)})
        js['images'][idx]['bufferView'] = len(js['bufferViews']) - 1
        js['images'][idx]['mimeType'] = 'image/png'
        tocadas.add(idx)

    if dry or not tocadas:
        if not tocadas and not dry:
            print('  nada a fazer')
        return

    while len(bin_data) % 4:
        bin_data.append(0)
    js['buffers'][0]['byteLength'] = len(bin_data)
    js_bytes = json.dumps(js, separators=(',', ':')).encode()
    while len(js_bytes) % 4:
        js_bytes += b' '

    out = bytearray(b'glTF')
    total = 12 + 8 + len(js_bytes) + 8 + len(bin_data)
    out += struct.pack('<II', 2, total)
    out += struct.pack('<II', len(js_bytes), JSON_CHUNK) + js_bytes
    out += struct.pack('<II', len(bin_data), BIN_CHUNK) + bytes(bin_data)

    bak = f'{path}.bak-sangra-{datetime.now():%Y-%m-%d}'
    if not os.path.exists(bak):
        shutil.copy2(path, bak)
        print(f'  copia em {os.path.basename(bak)}')
    open(path, 'wb').write(bytes(out))
    print(f'  gravado · {os.path.getsize(path) / 1048576:.2f} MB')
    conferir(path, antigos, tocadas)


def conferir(path: str, antigos: dict[int, bytes], tocadas: set[int]):
    """TODA imagem nao tocada tem de sair byte a byte identica."""
    raw, js, bin_off, _ = read_glb(path)
    ruim = 0
    for i, velho in antigos.items():
        if i in tocadas or velho is None:
            continue
        if image_bytes(raw, js, bin_off, i) != velho:
            print(f'  ⚠️ imagem {i} MUDOU e nao deveria')
            ruim += 1
    print('  verificacao:', 'ok' if not ruim else f'{ruim} divergencia(s)')


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('glb')
    ap.add_argument('--report', action='store_true')
    ap.add_argument('--image', action='append', type=int, default=[],
                    help='indice de imagem; repetivel. Sem isto, todas as candidatas.')
    ap.add_argument('--todas', action='store_true',
                    help='TODA imagem RGBA, e nao so a cor base de material recortado')
    ap.add_argument('--limiar', type=int, default=250,
                    help='alfa a partir do qual o texel e SEMENTE (padrao 250) — ver sangrar()')
    ap.add_argument('--dry', action='store_true')
    a = ap.parse_args()

    if a.report:
        report(a.glb)
        return

    raw, js, bin_off, _ = read_glb(a.glb)
    if a.image:
        alvos = sorted(set(a.image))
    elif a.todas:
        print('⚠️ --todas: sangrando TODA imagem RGBA, inclusive normal/ORM.'
              ' O quarto canal deles nao e cobertura.')
        alvos = list(range(len(js.get('images', []))))
    else:
        alvos = sorted(candidatas(js))
    if not alvos:
        print('nenhuma candidata — nada a fazer')
        return
    print(f'{os.path.basename(a.glb)} · sangrando {len(alvos)} imagem(ns)')
    aplicar(a.glb, alvos, limiar=a.limiar, dry=a.dry)


if __name__ == '__main__':
    main()
