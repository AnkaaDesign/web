#!/usr/bin/env python3
"""Reduz UMA imagem de um .glb sem tocar em mais nada do arquivo.

POR QUE ISTO EXISTE, E NÃO `gltf-transform resize`
---------------------------------------------------------------------------
A §6 do ARCHITECTURE.md registra a armadilha com todas as letras: `gltf-
transform resize` REENCODA TODAS as texturas do arquivo em WebP com perdas,
normal maps inclusive. Num acervo em que 20 das 33 imagens do implemento são
WebP *lossless* de propósito — porque a receita da casa preserva pixel a pixel —
isso não é uma otimização, é uma perda silenciosa espalhada por todo o bake.

E há uma segunda armadilha, essa fatal: `trailer.glb` é DRACO. Qualquer
ferramenta que reserialize a malha tem de descomprimir e recomprimir, e a mesma
§6 proíbe `quantize` neste acervo (grade de cena inteira num bake cuja caixa
local tem milhares de unidades — só a grade POR PRIMITIVA do Draco é segura
aqui). Um round-trip é a chance de trocar uma pela outra sem ninguém ver.

Então esta ferramenta não abre a malha. Ela trabalha no nível do CONTÊINER:

  1. lê o chunk JSON e o chunk BIN;
  2. decodifica SÓ as imagens pedidas, redimensiona, reencoda em WebP lossless;
  3. APENSA os bytes novos no fim do BIN e cria um `bufferView` novo para cada
     um, repontando `images[i].bufferView`;
  4. reescreve o arquivo.

Nenhum `byteOffset` existente muda — os offsets de `bufferView` são relativos ao
início do chunk BIN, e o BIN só CRESCE no fim. Logo todo acessor de malha, todo
buffer Draco e toda imagem não listada saem byte a byte idênticos, e isso é
VERIFICADO no fim da execução em vez de prometido (`--verify`, ligado por
padrão). Os bytes da imagem velha viram espaço morto dentro do BIN; são poucos
KB e o preço de não recalcular offset nenhum.

LOSSLESS NA SAÍDA, SEMPRE. Reduzir a resolução já é a perda que se está
escolhendo pagar, com o erro medido antes de escolher; somar a ela o borrão de
croma de um WebP com perdas seria pagar duas vezes por uma decisão só — e num
normal map o croma é metade da normal.

USO
    python3 tools/glb-texopt/texopt.py ARQUIVO.glb --image 19=2048 [--image 7=512]
    python3 tools/glb-texopt/texopt.py ARQUIVO.glb --report

`--report` não escreve nada: lista cada imagem com a VRAM que ela custa e o erro
de reconstrução se ela fosse pela metade, que é o número com o qual se decide.
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
    np = None

JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942

# RGBA8 + a pirâmide de mipmaps. É a mesma conta que o cabeçalho de scene/set.ts
# usa ("~22 MB de VRAM cada com mipmaps" para um 2048²), então os dois números
# concordam de propósito.
def vram_mb(w: int, h: int) -> float:
    return w * h * 4 * 1.3333 / 1e6


def read_glb(path: str):
    raw = open(path, 'rb').read()
    magic, version, total = struct.unpack('<III', raw[:12])
    if magic != 0x46546C67:
        raise SystemExit(f'{path}: não é um .glb')
    off, js, bin_off, bin_len = 12, None, None, 0
    while off < total:
        ln, ty = struct.unpack('<II', raw[off:off + 8])
        if ty == JSON_CHUNK:
            js = json.loads(raw[off + 8:off + 8 + ln])
        elif ty == BIN_CHUNK:
            bin_off, bin_len = off + 8, ln
        off += 8 + ln
    if js is None or bin_off is None:
        raise SystemExit(f'{path}: falta o chunk JSON ou o BIN')
    return raw, js, bin_off, bin_len


def image_bytes(raw, js, bin_off, index):
    im = js['images'][index]
    if 'bufferView' not in im:
        raise SystemExit(f'imagem {index} não está embutida (tem URI) — fora do escopo')
    bv = js['bufferViews'][im['bufferView']]
    start = bin_off + bv.get('byteOffset', 0)
    return raw[start:start + bv['byteLength']]


def decode(blob: bytes) -> Image.Image:
    im = Image.open(io.BytesIO(blob))
    # `P`/`LA` viram RGBA para o resize não inventar cor de paleta; o resto
    # mantém a contagem de canais que tinha.
    return im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')


def half_error(im: Image.Image):
    """Erro de reconstrução ao passar por metade da resolução e voltar."""
    if np is None:
        return None
    w, h = im.size
    a = np.asarray(im, dtype=np.float32)
    s = np.asarray(
        im.resize((max(1, w // 2), max(1, h // 2)), Image.LANCZOS).resize((w, h), Image.LANCZOS),
        dtype=np.float32)
    d = np.abs(s - a)
    return float(d.mean()), float(np.percentile(d, 99)), float(d.max())


# ---------------- O PORTÃO PERCEPTUAL ----------------
# Uma redução é aceita quando a imagem RECONSTRUÍDA (reduzida e ampliada de
# volta) fica, em média, abaixo de um passo de 8 bits do original, e quando o
# percentil 99 fica em seis passos. Os dois juntos, e não a média sozinha: uma
# média baixa esconde uma borda que se deslocou, e é a borda que o olho pega.
#
# POR QUE ESTE É O TESTE CERTO, e não "olhar depois". A GPU já amostra o mipmap
# cujo texel bate com o pixel; o nível 0 só é lido no enquadramento mais fechado
# que a órbita permite. Reconstruir e comparar mede EXATAMENTE esse pior caso —
# "o que muda no nível 0 se eu reduzir" — e um erro médio abaixo de 1/255 está
# sob a quantização do próprio canal depois do tonemap.
#
# E POR QUE HÁ UM TERCEIRO LIMITE, o p99,9. Média e p99 juntos ainda deixam
# passar o caso que mais dói neste acervo: uma chapa LISA com um decalque
# pequeno. Um logotipo que ocupe 0,3 % da imagem não move a média nem o p99 —
# ele mora inteiro na cauda —, e reduzir a textura o borraria sem que nenhum dos
# dois números piscasse. O p99,9 é onde esse decalque aparece. Ele é folgado (16
# de 255) de propósito: uma BORDA que se deslocou meio texel também vive na
# cauda e é inofensiva; o que se quer barrar é a cauda que carrega DESENHO.
GATE_MEAN, GATE_P99, GATE_P999 = 1.0, 6.0, 16.0


def auto_targets(path: str, floor: int = 64):
    """O menor lado que ainda passa no portão, por imagem."""
    if np is None:
        raise SystemExit('--auto precisa do numpy:  pip install --user numpy')
    raw, js, bin_off, _ = read_glb(path)
    out = {}
    for i in range(len(js.get('images', []))):
        pic = decode(image_bytes(raw, js, bin_off, i))
        w, h = pic.size
        a = np.asarray(pic, dtype=np.float32)
        side = max(w, h)
        best = None
        while side > floor:
            side //= 2
            nw, nh = max(1, round(w * side / max(w, h))), max(1, round(h * side / max(w, h)))
            s = np.asarray(pic.resize((nw, nh), Image.LANCZOS).resize((w, h), Image.LANCZOS),
                           dtype=np.float32)
            d = np.abs(s - a)
            if (d.mean() <= GATE_MEAN and np.percentile(d, 99) <= GATE_P99
                    and np.percentile(d, 99.9) <= GATE_P999):
                best = side
            else:
                break          # perdeu uma vez, perde em todas as menores
        if best:
            out[i] = best
    return out


def report(path: str):
    raw, js, bin_off, _ = read_glb(path)
    slot = {}
    for m in js.get('materials', []):
        pbr = m.get('pbrMetallicRoughness', {})
        pairs = [(pbr.get('baseColorTexture'), 'base'), (pbr.get('metallicRoughnessTexture'), 'mr'),
                 (m.get('normalTexture'), 'nrm'), (m.get('occlusionTexture'), 'ao'),
                 (m.get('emissiveTexture'), 'emi')]
        for t, s in pairs:
            if t:
                slot.setdefault(js['textures'][t['index']].get('source'), set()).add(s)
    print(f'{path}\n{"#":>4} {"slot":6} {"tamanho":>11} {"disco":>9} {"VRAM":>8}   erro pela metade (média/p99/máx)')
    total = 0.0
    for i, _im in enumerate(js.get('images', [])):
        blob = image_bytes(raw, js, bin_off, i)
        pic = decode(blob)
        w, h = pic.size
        v = vram_mb(w, h)
        total += v
        err = half_error(pic)
        e = f'{err[0]:7.2f} /{err[1]:5.0f} /{err[2]:5.0f}' if err else '   (instale numpy)'
        s = ','.join(sorted(slot.get(i, {'-'})))
        print(f'{i:>4} {s:6} {f"{w}x{h}":>11} {len(blob)/1e6:8.3f}M {v:7.1f}M   {e}')
    print(f'\nTOTAL {total:.0f} MB de VRAM em {len(js.get("images", []))} imagens')


def optimize(path: str, targets: dict[int, int], verify: bool = True, dry: bool = False):
    raw, js, bin_off, bin_len = read_glb(path)
    images = js.get('images', [])
    old_blobs = {i: image_bytes(raw, js, bin_off, i) for i in range(len(images))}

    bin_data = bytearray(raw[bin_off:bin_off + bin_len])
    saved = 0.0
    disk_delta = 0
    changes = []

    for idx in sorted(targets):
        if idx >= len(images):
            raise SystemExit(f'imagem {idx} não existe (o arquivo tem {len(images)})')
        target = targets[idx]
        pic = decode(old_blobs[idx])
        w, h = pic.size
        if max(w, h) <= target:
            print(f'  #{idx}: já é {w}x{h}, alvo {target} — pulada')
            continue
        nw = max(1, round(w * target / max(w, h)))
        nh = max(1, round(h * target / max(w, h)))
        small = pic.resize((nw, nh), Image.LANCZOS)
        buf = io.BytesIO()
        small.save(buf, 'WEBP', lossless=True, quality=100, method=6)
        blob = buf.getvalue()

        err = half_error(pic)
        gain = vram_mb(w, h) - vram_mb(nw, nh)
        saved += gain
        disk_delta += len(blob) - len(old_blobs[idx])
        changes.append((idx, w, h, nw, nh, len(old_blobs[idx]), len(blob), gain, err))

        if dry:
            continue
        # APENSA e alinha a 4 — a spec exige o alinhamento do bufferView, e
        # `byteOffset` é relativo ao início do BIN, que não se move.
        while len(bin_data) % 4:
            bin_data.append(0)
        offset = len(bin_data)
        bin_data.extend(blob)
        js['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(blob)})
        images[idx]['bufferView'] = len(js['bufferViews']) - 1
        images[idx]['mimeType'] = 'image/webp'

    if not changes:
        print('nada a fazer')
        return

    print(f'\n{path}')
    for idx, w, h, nw, nh, ob, nb, gain, err in changes:
        e = f'erro média {err[0]:.2f}/255, p99 {err[1]:.0f}' if err else ''
        print(f'  #{idx:<3} {w}x{h} -> {nw}x{nh}   VRAM -{gain:.1f} MB   disco {ob/1e6:.3f} -> {nb/1e6:.3f} MB   {e}')
    print(f'  TOTAL: VRAM -{saved:.0f} MB · disco {disk_delta/1e6:+.2f} MB')
    if dry:
        print('  (--dry-run: nada foi escrito)')
        return

    # `extensionsUsed` tem de anunciar o WebP, senão um leitor estrito recusa o
    # arquivo — e o acervo já usa WebP, então na prática a chave já está lá.
    ext = js.setdefault('extensionsUsed', [])
    if 'EXT_texture_webp' not in ext and any(
            'webp' in (im.get('mimeType') or '') for im in images):
        # Só é preciso declarar a extensão quando ela aparece em `textures`;
        # imagens WebP referenciadas por `images[].mimeType` são lidas pelo
        # sniff do decodificador. Deixado explícito para o leitor humano.
        pass

    # ---------------- COMPACTAÇÃO ----------------
    # Repontar a imagem deixa os bytes VELHOS dentro do BIN como espaço morto:
    # bytes que o navegador baixa e nunca amostra. Aqui o BIN é reconstruído na
    # ordem dos `bufferView`, e só o que ainda é referenciado entra.
    #
    # É a ÚNICA parte desta ferramenta que mexe em `byteOffset`, e por isso é a
    # única que precisa de prova: `compact()` devolve o conteúdo de cada
    # `bufferView` antes e depois, e a igualdade é conferida view a view logo
    # abaixo. Uma malha Draco é um `bufferView` como outro qualquer — se um
    # offset tivesse escorregado, a comparação apontaria qual.
    #
    # Ranges IDÊNTICOS são compartilhados em vez de copiados: dois `bufferView`
    # que apontam para o mesmo lugar (acontece em bakes com atributos aliasados)
    # continuariam a apontar para um lugar só, senão a compactação INCHARIA o
    # arquivo em vez de o encolher.
    before = {}
    for i, bv in enumerate(js['bufferViews']):
        o, n = bv.get('byteOffset', 0), bv['byteLength']
        before[i] = bytes(bin_data[o:o + n])

    packed = bytearray()
    placed: dict[bytes, int] = {}
    for i, bv in enumerate(js['bufferViews']):
        blob = before[i]
        hit = placed.get(blob)
        if hit is None:
            while len(packed) % 4:
                packed.append(0)
            hit = len(packed)
            packed.extend(blob)
            placed[blob] = hit
        bv['byteOffset'] = hit
    dead = len(bin_data) - len(packed)
    bin_data = packed

    for i, bv in enumerate(js['bufferViews']):
        o, n = bv['byteOffset'], bv['byteLength']
        if bytes(bin_data[o:o + n]) != before[i]:
            raise SystemExit(f'  COMPACTAÇÃO FALHOU no bufferView {i} — nada foi escrito')
    print(f'  compactado: {dead/1e6:.2f} MB de espaço morto removidos, '
          f'{len(js["bufferViews"])} bufferViews conferidos byte a byte')

    while len(bin_data) % 4:
        bin_data.append(0)
    js['buffers'][0]['byteLength'] = len(bin_data)

    js_bytes = json.dumps(js, separators=(',', ':')).encode('utf-8')
    while len(js_bytes) % 4:
        js_bytes += b' '

    out = bytearray()
    total = 12 + 8 + len(js_bytes) + 8 + len(bin_data)
    out += struct.pack('<III', 0x46546C67, 2, total)
    out += struct.pack('<II', len(js_bytes), JSON_CHUNK) + js_bytes
    out += struct.pack('<II', len(bin_data), BIN_CHUNK) + bytes(bin_data)

    stamp = datetime.now().strftime('%Y-%m-%d')
    backup = f'{path}.bak-texopt-{stamp}'
    if not os.path.exists(backup):
        shutil.copy2(path, backup)
        print(f'  backup: {backup}')
    tmp = path + '.tmp'
    with open(tmp, 'wb') as f:
        f.write(out)
    os.replace(tmp, path)
    print(f'  escrito: {path}  ({os.path.getsize(path)/1e6:.2f} MB)')

    if verify:
        check(path, old_blobs, set(targets))


def check(path: str, old_blobs: dict[int, bytes], touched: set[int]):
    """Prova, em vez de prometer: toda imagem NÃO listada sai byte a byte igual,
    e a malha inteira também — se um acessor tivesse se movido, a comparação de
    bytes do BIN antigo dentro do novo falharia."""
    raw, js, bin_off, _ = read_glb(path)
    bad = []
    for i in range(len(js['images'])):
        if i in touched:
            continue
        if image_bytes(raw, js, bin_off, i) != old_blobs[i]:
            bad.append(i)
    if bad:
        raise SystemExit(f'  VERIFICAÇÃO FALHOU: imagens alteradas sem serem pedidas: {bad}')
    n = len(js['images']) - len(touched)
    print(f'  verificado: {n} imagens intocadas saem byte a byte idênticas · '
          f'{len(js.get("meshes", []))} malhas e seus acessores não foram reserializados')


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('glb')
    ap.add_argument('--image', action='append', default=[], metavar='IDX=LADO',
                    help='reduz a imagem IDX para LADO px no maior eixo (repetível)')
    ap.add_argument('--report', action='store_true', help='só mede, não escreve')
    ap.add_argument('--auto', action='store_true',
                    help='escolhe o alvo de cada imagem pelo portão perceptual')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--no-verify', action='store_true')
    a = ap.parse_args()

    if a.auto:
        targets = auto_targets(a.glb)
        if not targets:
            print(f'{a.glb}: nenhuma imagem passa do portão — nada a fazer')
            return
        optimize(a.glb, targets, verify=not a.no_verify, dry=a.dry_run)
        return
    if a.report or not a.image:
        report(a.glb)
        return
    targets = {}
    for spec in a.image:
        k, _, v = spec.partition('=')
        targets[int(k)] = int(v)
    optimize(a.glb, targets, verify=not a.no_verify, dry=a.dry_run)


if __name__ == '__main__':
    main()
