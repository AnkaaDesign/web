"""Importa o pack `_src_trees` e devolve prototipos de arvore e arbusto.

Substitui os impostores de cartao do `plant()`. Rodar sozinho para o relatorio:

    blender -b -P trees_pack.py

===========================================================================
O QUE O PACK E, MEDIDO — e nao o que o cabecalho dele diz
===========================================================================

Tres OBJ, nenhum `usemtl`, nenhum `.mtl` no disco (os arquivos referenciam
`model_N.mtl` que nao existe). Ou seja: NADA no pack diz quais faces sao casca e
quais sao folha. A hipotese obvia — "os cartoes de folha sao os componentes
planos" — foi medida e e FALSA dentro de cada arquivo:

    model_0   63 895 v   5 764 componentes   s2/s1 mediana 0,93   -> TUBULAR
    model_1   58 027 v   5 204 componentes   s2/s1 mediana 0,92   -> TUBULAR
    model_2   59 028 v  14 566 componentes   s2/s0 mediana 0,004  -> PLANO

(s0>=s1>=s2 sao os valores singulares do componente centrado: um tubo tem os
tres da mesma ordem, um cartao tem o terceiro em zero.)

A separacao existe, mas e POR ARQUIVO e nao por componente. model_2 e o modelo
de folha inteiro — 14 566 cartoes planos — e model_0/model_1 sao a madeira. Isso
tambem explica por que os tres ocupam a MESMA regiao de mundo (x -135..51,
y -10..262): nao sao tres bosques, sao tres materiais do mesmo bosque, exportados
um por arquivo porque o formato nao tinha onde por o material.

Classificar por planaridade continua a ser a resposta certa; o que muda e que ela
se aplica UMA VEZ, ao arquivo, e nao 25 534 vezes aos componentes. Ainda assim e
medida e nao assumida (ver `_woody`), para que trocar o pack por outro nao passe
silenciosamente a pintar tronco de verde.

===========================================================================
O ALFA, que e o que decide se isto vale a pena
===========================================================================

`Grasses&branch.png` (8192²) nao tem canal alfa util: o canal A e 255 em todos os
pixels. Sem derivar alfa, cada cartao de folha vira um retangulo verde opaco —
que e literalmente o defeito que os impostores existiam para evitar.

E ELE NAO E UM ATLAS DE COR, e isto e o que a medicao acrescentou ao enunciado:
R = G = B em todo o pixel e a media e 0,167. E uma MASCARA — silhuetas brancas
sobre fundo preto, 80 colunas de ervas, fetos e ramos. O pack nao traz nenhuma
textura de cor de folha; so a casca (`BarkAtlas-Diffuse`, essa sim colorida) e
esta mascara.

Portanto derivar o alfa e METADE do trabalho: a outra metade e SINTETIZAR a cor,
e a diferenca entre fazer isso bem e mal e a diferenca entre folhagem e uma
decalcomania verde. Um verde chapado dentro da silhueta le como papel recortado,
porque folhagem real nunca e de um tom so — o interior da moita esta sombreado
por ela propria e as pontas apanham luz.

  RECORTAR  alfa = luminancia > limiar. O fundo e preto puro, entao o limiar so
            precisa de estar acima do ruido de compressao.
  ERODIR    o limiar deixa uma orla de pixels de transicao. Com corte duro essa
            orla vira uma franja clara em volta de cada folha; erodir um pixel
            come a orla.
  SOMBREAR  a cor vem de um DESFOQUE da propria mascara, que e uma medida barata
            de "quao fundo na massa este pixel esta": fundo -> verde escuro e
            frio, ponta -> verde-amarelo claro. Sai de graca a partir do que ja
            temos e e o que faz o cartao ter volume.
  MATIZAR   um campo grosseiro por celula do atlas desloca o tom de sprite para
            sprite: sao especies diferentes na mesma folha, e pinta-las todas da
            mesma cor desfaz o motivo de haver 80 delas.
  SANGRAR   a cor para dentro do transparente. O corte e por fragmento, mas o
            mipmap nao: ao reduzir, o que estiver no transparente entra na media
            e a copa ganha auréola a distancia.

===========================================================================
ORCAMENTO
===========================================================================

~450 plantas instanciadas de ~10 malhas, 3-7 k faces por planta. O pack cabe
sem decimar: 137 646 faces divididas por ~130 plantas dao ~1 000 faces cada. Se
algum prototipo passar do teto, decima-se SO A CASCA — um decimador de colapso
transforma cartao de folha em pasta.
"""

import math
import os
import sys

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "_src_trees")
DERIVED = os.path.join(SRC, "_derived")

OBJS = ("model_0.obj", "model_1.obj", "model_2.obj")
LEAF_SRC = "Grasses&branch.png"
BARK_SRC = "BarkAtlas-Diffuse.png"

# O atlas e 8192². Lido inteiro em float32 sao 1,07 GB so para o buffer de
# pixels, antes de qualquer conta. 4096² custa 268 MB e da 512 px por sprite num
# atlas de 8x8 — muito acima do que um cartao de folha a 15 m consegue mostrar.
ALPHA_RES = 4096
ALPHA_CUT = 0.055        # em sRGB cru, ~14/255: acima do ruido do JPEG do fundo
ALPHA_ERODE = 1          # pixels

# Uma "arvore" e um componente lenhoso alto cuja base esta no chao. Estes dois
# numeros sao em unidades do pack (que sao metros: o tronco mais alto tem 17,8).
TRUNK_MIN_H = 3.5
TRUNK_MAX_BASE = 4.0
CLUSTER_R = 7.0          # raio maximo para uma peca pertencer a um tronco

FACE_BUDGET = 7000

TREE_H = (7.5, 13.0)     # altura final dos prototipos de arvore, em metros
BUSH_H = (1.6, 2.6)


def _log(msg):
    print("[trees_pack] %s" % msg)


# ---------------------------------------------------------------------------
# 1. o alfa
# ---------------------------------------------------------------------------
def _box_blur(a, r, passes=3):
    """Desfoque separavel por soma acumulada — O(n) por passagem, e a 4096² a
    diferenca entre isto e uma convolucao ingenua e minutos."""
    out = a.astype(np.float32)
    for _ in range(passes):
        for axis in (0, 1):
            n = out.shape[axis]
            pad = np.concatenate(
                [np.zeros((1,) + out.shape[1:], np.float32)
                 if axis == 0 else np.zeros((out.shape[0], 1), np.float32),
                 out], axis=axis)
            c = np.cumsum(pad, axis=axis)
            idx_hi = np.minimum(np.arange(n) + r + 1, n)
            idx_lo = np.maximum(np.arange(n) - r, 0)
            if axis == 0:
                out = (c[idx_hi] - c[idx_lo]) / (idx_hi - idx_lo)[:, None]
            else:
                out = (c[:, idx_hi] - c[:, idx_lo]) / (idx_hi - idx_lo)[None, :]
    return out


# Fundo da massa -> ponta. Verde escuro e frio na sombra propria da moita,
# verde-amarelo claro onde a folha e uma lamina solta contra o ceu. Sao os dois
# extremos de qualquer folhagem fotografada, e o desfoque da mascara e uma medida
# suficientemente boa de qual dos dois cada pixel e.
LEAF_DEEP = (0.055, 0.105, 0.038)
LEAF_TIP = (0.300, 0.365, 0.128)


def _synth_leaf_rgb(mask, log=_log):
    """Cor de folhagem a partir da mascara, porque o pack nao traz nenhuma."""
    n = mask.shape[0]
    soft = _box_blur(mask, max(2, n // 380))
    # normalizar dentro da propria folha: `soft` vale ~0 no fundo e sobe para
    # ~0,6 no interior de uma massa densa. Sem normalizar, uma erva fina sai toda
    # na cor de ponta e um feto denso sai todo na cor de sombra.
    inside = soft[mask]
    lo = float(np.percentile(inside, 8)) if inside.size else 0.0
    hi = float(np.percentile(inside, 92)) if inside.size else 1.0
    t = np.clip((soft - lo) / max(1e-4, hi - lo), 0.0, 1.0)
    t = t * t * (3.0 - 2.0 * t)
    rgb = np.empty(mask.shape + (3,), dtype=np.float32)
    for c in range(3):
        rgb[:, :, c] = LEAF_TIP[c] + (LEAF_DEEP[c] - LEAF_TIP[c]) * t

    # matiz por celula do atlas: 80 sprites, especies diferentes. Um campo de
    # 16x16 interpolado desloca cada uma sem que a fronteira entre celulas
    # apareca (a mascara e preta entre sprites, entao a fronteira nunca e vista).
    rs = np.random.RandomState(20260810)
    f = rs.rand(16, 16, 3).astype(np.float32)
    idx = (np.arange(n) * 16 // n)
    tint = f[idx][:, idx]
    rgb *= (0.82 + 0.36 * tint)
    np.clip(rgb, 0.0, 1.0, out=rgb)
    log("  cor sintetizada da mascara: fundo %.3f/%.3f/%.3f -> ponta "
        "%.3f/%.3f/%.3f, matiz +-18%%" % (LEAF_DEEP + LEAF_TIP))
    return rgb


def leaf_atlas_rgba(force=False, log=_log):
    """Deriva o alfa do fundo do atlas de folha e devolve o caminho do PNG RGBA.

    Cacheado em disco: e uma conta de 17 M pixels que nao muda entre builds.
    """
    out = os.path.join(DERIVED, "leaf_rgba.png")
    if os.path.exists(out) and not force:
        return out
    src = os.path.join(SRC, LEAF_SRC)
    if not os.path.exists(src):
        return None
    if not os.path.isdir(DERIVED):
        os.makedirs(DERIVED)

    img = bpy.data.images.load(src, check_existing=False)
    # CRU, NAO LINEARIZADO. O limiar e sobre o valor que o autor do atlas viu no
    # editor; deixar o Blender converter sRGB->linear antes empurraria o preto de
    # fundo para 0,0003 e o limiar deixaria de ter unidade nenhuma.
    try:
        img.colorspace_settings.name = "Non-Color"
    except Exception:
        pass
    w0, h0 = img.size
    img.scale(ALPHA_RES, ALPHA_RES)
    n = ALPHA_RES
    px = np.empty(n * n * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(n, n, 4)

    a_in = px[:, :, 3]
    lum = 0.2126 * px[:, :, 0] + 0.7152 * px[:, :, 1] + 0.0722 * px[:, :, 2]
    log("atlas de folha %dx%d -> %d: alfa de origem %.3f..%.3f (%s), "
        "luminancia %.4f..%.4f"
        % (w0, h0, n, float(a_in.min()), float(a_in.max()),
           "INUTIL, tudo opaco" if float(a_in.min()) > 0.99 else "tem alfa",
           float(lum.min()), float(lum.max())))

    grey = float(np.abs(px[:, :, 0] - px[:, :, 1]).mean()
                 + np.abs(px[:, :, 1] - px[:, :, 2]).mean())
    log("  desvio entre canais %.5f -> %s" % (grey,
        "MASCARA (sem cor propria)" if grey < 0.002 else "atlas colorido"))

    m = lum > ALPHA_CUT
    log("  limiar %.3f -> %.1f%% de folha" % (ALPHA_CUT, 100.0 * m.mean()))
    for _ in range(ALPHA_ERODE):
        e = m.copy()
        e[1:, :] &= m[:-1, :]
        e[:-1, :] &= m[1:, :]
        e[:, 1:] &= m[:, :-1]
        e[:, :-1] &= m[:, 1:]
        m = e
    log("  apos erodir %d px -> %.1f%%" % (ALPHA_ERODE, 100.0 * m.mean()))

    rgb = px[:, :, :3]
    if grey < 0.002:
        rgb = _synth_leaf_rgb(m, log=log)

    # sangrar: o transparente leva a cor MEDIA da folha, para que o mipmap nao
    # misture o fundo na copa.
    avg = rgb[m].mean(axis=0) if m.any() else np.array([0.20, 0.27, 0.10])
    rgb = rgb.copy()
    rgb[~m] = avg
    px[:, :, :3] = rgb
    px[:, :, 3] = m.astype(np.float32)
    log("  cor media da folha sangrada no transparente: %.3f %.3f %.3f"
        % tuple(avg))

    dst = bpy.data.images.new("leaf_rgba", n, n, alpha=True)
    dst.colorspace_settings.name = "Non-Color"
    dst.pixels.foreach_set(px.reshape(-1))
    dst.filepath_raw = out
    dst.file_format = "PNG"
    dst.save()
    bpy.data.images.remove(img)
    bpy.data.images.remove(dst)
    log("  gravado %s" % out)
    return out


# ---------------------------------------------------------------------------
# 2. ler o pack
# ---------------------------------------------------------------------------
def _components(me):
    """Rotulo de componente conexo por vertice, por union-find sobre as arestas."""
    nv = len(me.vertices)
    ed = np.empty(len(me.edges) * 2, dtype=np.int32)
    me.edges.foreach_get("vertices", ed)
    ed = ed.reshape(-1, 2)
    parent = np.arange(nv, dtype=np.int32)

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for a, b in ed:
        ra, rb = find(int(a)), find(int(b))
        if ra != rb:
            parent[ra] = rb
    return np.array([find(i) for i in range(nv)], dtype=np.int32)


def _woody(co, lab):
    """O arquivo e madeira ou folha? Medido, nao assumido.

    Um cartao tem o terceiro valor singular em zero; um tubo tem os tres da
    mesma ordem. A mediana sobre todos os componentes separa os dois casos por
    duas ordens de grandeza (0,004 contra 0,93), entao qualquer corte no meio
    serve e 0,05 esta no meio em escala logaritmica.
    """
    ratios = []
    for u in np.unique(lab)[:400]:
        p = co[lab == u]
        if len(p) < 4:
            continue
        s = np.linalg.svd(p - p.mean(axis=0), compute_uv=False)
        if s[0] > 1e-9:
            ratios.append(s[2] / s[0])
    med = float(np.median(ratios)) if ratios else 1.0
    return med > 0.05, med


class Piece(object):
    """Um componente conexo do pack, com o que o agrupador precisa saber."""

    __slots__ = ("src", "vi", "fi", "cx", "cy", "z0", "z1", "woody", "nf")

    def __init__(self, src, vi, fi, co, woody, nf):
        self.src, self.vi, self.fi = src, vi, fi
        p = co[vi]
        self.cx, self.cy = float(p[:, 0].mean()), float(p[:, 1].mean())
        self.z0, self.z1 = float(p[:, 2].min()), float(p[:, 2].max())
        self.woody, self.nf = woody, nf


def read_pack(log=_log):
    """Importa os tres OBJ e devolve (pecas, meshes, arrays por arquivo)."""
    meshes, pieces = [], []
    for si, fn in enumerate(OBJS):
        path = os.path.join(SRC, fn)
        if not os.path.exists(path):
            log("FALTA %s" % path)
            return [], []
        before = set(bpy.data.objects)
        bpy.ops.wm.obj_import(filepath=path)
        news = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
        ob = news[0]
        me = ob.data
        nv = len(me.vertices)
        co = np.empty(nv * 3, dtype=np.float64)
        me.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3)
        lab = _components(me)
        woody, med = _woody(co, lab)
        log("%s: %d v, %d f, %d componentes, s2/s0 mediana %.4f -> %s"
            % (fn, nv, len(me.polygons), len(np.unique(lab)), med,
               "MADEIRA" if woody else "FOLHA"))

        # faces por componente (uma face esta toda no componente do seu 1o vert)
        fverts = [list(p.vertices) for p in me.polygons]
        by_lab_f = {}
        for fi, vs in enumerate(fverts):
            by_lab_f.setdefault(int(lab[vs[0]]), []).append(fi)
        by_lab_v = {}
        for vi, l in enumerate(lab):
            by_lab_v.setdefault(int(l), []).append(vi)

        meshes.append((ob, me, co, fverts))
        for l, vs in by_lab_v.items():
            fs = by_lab_f.get(l, [])
            pieces.append(Piece(si, np.array(vs, dtype=np.int32),
                                np.array(fs, dtype=np.int32), co, woody, len(fs)))
    return pieces, meshes


# ---------------------------------------------------------------------------
# 3. fatiar o bosque em plantas
# ---------------------------------------------------------------------------
def cluster(pieces, log=_log):
    """Agrupa componentes em plantas em torno de troncos.

    NAO E AGRUPAMENTO POR PROXIMIDADE SIMPLES, e a diferenca importa. Ligacao
    simples num bosque de copas encostadas funde o bosque inteiro num aglomerado
    so — as copas TOCAM-SE, e essa e a definicao de bosque. Ligacao com raio
    pequeno faz o contrario: os cartoes de folha de uma mesma arvore estao a
    metros uns dos outros e cada um vira uma planta.

    O que existe de verdade na cena e o TRONCO: um componente lenhoso alto com a
    base no chao. Achados os troncos, cada peca restante vai para o tronco mais
    proximo em XY — uma particao de Voronoi, que e exatamente como duas copas
    encostadas se dividem entre as duas arvores que as sustentam.
    """
    trunks = [p for p in pieces
              if p.woody and (p.z1 - p.z0) >= TRUNK_MIN_H and p.z0 <= TRUNK_MAX_BASE]
    if not trunks:
        return []
    # dois componentes de tronco a menos de 1,5 m sao o mesmo tronco partido
    trunks.sort(key=lambda p: -(p.z1 - p.z0))
    anchors = []
    for t in trunks:
        for a in anchors:
            if (t.cx - a[0]) ** 2 + (t.cy - a[1]) ** 2 < 2.25:
                break
        else:
            anchors.append((t.cx, t.cy))
    log("troncos: %d componentes lenhosos altos -> %d ancoras"
        % (len(trunks), len(anchors)))

    ax = np.array([a[0] for a in anchors])
    ay = np.array([a[1] for a in anchors])
    plants = [[] for _ in anchors]
    loose = []
    for p in pieces:
        d2 = (ax - p.cx) ** 2 + (ay - p.cy) ** 2
        k = int(np.argmin(d2))
        if d2[k] > CLUSTER_R ** 2:
            loose.append(p)
            continue
        plants[k].append(p)
    log("  %d pecas em arvores, %d pecas soltas" % (
        sum(len(g) for g in plants), len(loose)))
    return [g for g in plants if g], loose


def cluster_loose(loose, log=_log):
    """As pecas que nao pertencem a arvore nenhuma sao o SUB-BOSQUE, e sao elas
    que dao os arbustos.

    Antes eram descartadas e os arbustos vinham de esmagar uma arvore de 20 m
    ate 2 m. Isso nao e um arbusto: e uma arvore com as proporcoes erradas —
    tronco grosso demais, copa alta demais, e a escala da casca a gritar. Um
    arbusto de verdade e o que ja esta aqui, e o atlas confirma-o (o pack chama-
    se "Grasses&branch" e sao 80 ervas e ramos, nao 80 copas).

    Aqui a ligacao simples E a leitura certa, ao contrario do que acontece com as
    arvores: uma moita nao tem tronco que a ancore, e o raio que a define e o
    tamanho dela propria. 1,2 m junta os cartoes de uma moita sem alcancar a
    moita do lado.
    """
    if not loose:
        return []
    cell = 2.5
    grid = {}
    for i, p in enumerate(loose):
        grid.setdefault((int(p.cx // cell), int(p.cy // cell)), []).append(i)
    parent = list(range(len(loose)))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for (gx, gy), ids in grid.items():
        near = []
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                near.extend(grid.get((gx + dx, gy + dy), ()))
        for i in ids:
            for j in near:
                if i >= j:
                    continue
                a, b = loose[i], loose[j]
                if (a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2 <= cell * cell:
                    ra, rb = find(i), find(j)
                    if ra != rb:
                        parent[ra] = rb
    groups = {}
    for i in range(len(loose)):
        groups.setdefault(find(i), []).append(loose[i])
    out = [g for g in groups.values() if sum(p.nf for p in g) >= 60]
    log("  sub-bosque: %d moitas com >=60 faces (de %d aglomerados)"
        % (len(out), len(groups)))
    return out


def _stats(group):
    z0 = min(p.z0 for p in group)
    z1 = max(p.z1 for p in group)
    nf = sum(p.nf for p in group)
    nl = sum(p.nf for p in group if not p.woody)
    nw = nf - nl
    return z0, z1, nf, nw, nl


# ---------------------------------------------------------------------------
# 4. montar o prototipo
# ---------------------------------------------------------------------------
def _bark_material(png, name="PLANT_BARK"):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    b.inputs["Roughness"].default_value = 0.92
    b.inputs["Metallic"].default_value = 0.0
    if png and os.path.exists(png):
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = bpy.data.images.load(png, check_existing=True)
        nt.links.new(b.inputs["Base Color"], t.outputs["Color"])
    else:
        b.inputs["Base Color"].default_value = (0.20, 0.16, 0.13, 1.0)
    return m


def build_plant(name, group, meshes, bark_mat, leaf_mat, target_h, crop=None):
    """Um prototipo: base em z=0, centrado na propria pegada, na altura pedida.

    `crop` recorta o grupo a uma FRACAO da altura a contar de baixo, e existe
    para os arbustos. Um arbusto nao e uma arvore reduzida — reduzir uma arvore
    de 20 m para 2 m da um tronco com a grossura errada, uma copa que comeca
    acima da cabeca e uma casca com a escala a gritar. O que um arbusto e, na
    verdade, e a PARTE DE BAIXO de um matagal: massa de folha desde o chao e
    lenho fino. Recortar produz isso a partir do que o pack ja tem.
    """
    if crop is not None:
        z_lo = min(p.z0 for p in group)
        z_hi = max(p.z1 for p in group)
        band = z_lo + crop * (z_hi - z_lo)
        cut = [p for p in group if p.z0 <= band]
        if sum(p.nf for p in cut) >= 150:
            group = cut
    z0, z1, _nf, _nw, _nl = _stats(group)
    h = max(1e-3, z1 - z0)
    s = target_h / h
    # A BASE NAO E O PONTO MAIS BAIXO. Estes modelos trazem a raiz modelada, a
    # espalhar-se por baixo do tronco; assentar o minimo em z=0 poe a raiz INTEIRA
    # a vista, como uma arvore arrancada e pousada. O 3.o percentil da madeira
    # cai onde o tronco ja e tronco, e o resto da raiz fica onde raiz fica.
    wz = np.concatenate([meshes[p.src][2][p.vi][:, 2] for p in group if p.woody]) \
        if any(p.woody for p in group) else None
    if wz is not None and len(wz) > 20:
        z0 = float(np.percentile(wz, 3.0))
    # o centro e a MEDIANA da pegada e nao a media: uma copa assimetrica arrasta
    # a media para fora do tronco, e e o tronco que tem de cair no ponto onde a
    # planta e assente.
    wx = np.median([p.cx for p in group if p.woody] or [p.cx for p in group])
    wy = np.median([p.cy for p in group if p.woody] or [p.cy for p in group])

    me = bpy.data.meshes.new(name)
    verts, faces, uvs, midx = [], [], [], []
    for p in group:
        _ob, src_me, co, fverts = meshes[p.src]
        uvl = src_me.uv_layers.active
        remap = {}
        for vi in p.vi:
            remap[int(vi)] = len(verts)
            x, y, z = co[vi]
            verts.append(((x - wx) * s, (y - wy) * s, (z - z0) * s))
        mi = 0 if p.woody else 1
        for fi in p.fi:
            poly = src_me.polygons[int(fi)]
            vs = list(poly.vertices)
            if any(int(v) not in remap for v in vs):
                continue
            faces.append([remap[int(v)] for v in vs])
            midx.append(mi)
            for li in poly.loop_indices:
                uvs.append(tuple(uvl.data[li].uv))
    me.from_pydata(verts, [], faces)
    me.materials.append(bark_mat)
    me.materials.append(leaf_mat)
    me.polygons.foreach_set("material_index", midx)
    uvl = me.uv_layers.new(name="UVMap")
    for li, uv in enumerate(uvs[:len(me.loops)]):
        uvl.data[li].uv = uv
    # UMA FOLHA NAO TEM VERSO. Os cartoes vem com uma face so; sem two-sided a
    # copa fica meia vazia conforme a camera anda. `use_backface_culling` fica
    # falso (padrao) e o glTF exporta doubleSided, que e o que o motor precisa.
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob


def _decimate_bark(ob, budget=FACE_BUDGET, log=_log):
    """Acima do teto, decima SO a casca — nunca a folha.

    Um decimador de colapso nao sabe que um cartao de folha e uma unidade
    indivisivel: ele funde os quatro vertices e o cartao vira um triangulo, ou
    pasta. A casca e um tubo e colapsa bem.
    """
    n = len(ob.data.polygons)
    if n <= budget:
        return n
    bark = [i for i, p in enumerate(ob.data.polygons) if p.material_index == 0]
    leaf = n - len(bark)
    if not bark or leaf >= budget:
        return n
    keep = (budget - leaf) / float(len(bark))
    # o modificador atua na malha toda; isolar a casca por grupo de vertices
    vg = ob.vertex_groups.new(name="bark")
    vs = set()
    for i in bark:
        vs.update(ob.data.polygons[i].vertices)
    vg.add(list(vs), 1.0, "REPLACE")
    md = ob.modifiers.new("dec", "DECIMATE")
    md.decimate_type = "COLLAPSE"
    md.ratio = max(0.05, min(1.0, keep))
    md.vertex_group = vg.name
    md.use_collapse_triangulate = True
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    ob.data = bpy.data.meshes.new_from_object(ev)
    ob.modifiers.clear()
    log("  %s: %d -> %d faces (casca decimada a %.2f)"
        % (ob.name, n, len(ob.data.polygons), md.ratio))
    return len(ob.data.polygons)


# ---------------------------------------------------------------------------
# 5. a porta de entrada
# ---------------------------------------------------------------------------
def build_prototypes(n_tree=6, n_bush=4, log=_log):
    """Devolve (arvores, arbustos) como objetos Blender, ou ([], []) se faltar
    o pack. Os nomes comecam com `tree_`/`bush_` porque e por esse prefixo que
    group_instances() decide o que instanciar."""
    if not os.path.isdir(SRC):
        # SEM O PACK, A CACHE. Devolver ([], []) aqui nao deixava o distrito
        # careca — deixava-o com os IMPOSTORES DE CARTAO, que e a regressao que
        # 08-arvores-de-perto.png documenta: um cartao cruzado resolve a
        # silhueta a 60 m e nao resolve nada a 10 m. Ver protos_cache.py.
        import importlib.util
        import sys
        p = os.path.join(HERE, "protos_cache.py")
        mod = sys.modules.get("protos_cache")
        if mod is None and os.path.exists(p):
            spec = importlib.util.spec_from_file_location("protos_cache", p)
            mod = importlib.util.module_from_spec(spec)
            sys.modules["protos_cache"] = mod
            spec.loader.exec_module(mod)
        if mod is not None:
            trees, bushes = mod.load_plants(log=log)
            if trees:
                return trees, bushes
        log("sem %s — nada a importar" % SRC)
        return [], []
    leaf_png = leaf_atlas_rgba(log=log)
    if leaf_png is None:
        log("sem atlas de folha — abortado")
        return [], []

    pieces, meshes = read_pack(log=log)
    if not pieces:
        return [], []
    groups, loose = cluster(pieces, log=log)
    if not groups:
        log("nenhum tronco encontrado — abortado")
        return [], []
    shrubs = cluster_loose(loose, log=log)

    def rank(gs):
        rec = []
        for g in gs:
            z0, z1, nf, nw, nl = _stats(g)
            rec.append((z1 - z0, nf, nw, nl, g))
        rec.sort(key=lambda r: -r[1])          # por FACES: a planta mais cheia
        return rec

    rec = rank(groups)
    log("arvores: %d   altura %.1f..%.1f m   faces mediana %d  max %d"
        % (len(rec), min(r[0] for r in rec), max(r[0] for r in rec),
           int(np.median([r[1] for r in rec])), max(r[1] for r in rec)))
    # uma arvore so serve de prototipo se tiver as duas coisas: madeira que a
    # sustente e folha que a vista.
    ok = [r for r in rec if r[2] > 20 and r[3] > 20]
    log("  com casca E folha: %d" % len(ok))
    if not ok:
        return [], []

    # UM ARBUSTO TEM DE SER DENSO E BAIXO. Sem o filtro saiam moitas de 88 faces
    # — tres cartoes soltos, que a 6 m sao tres cartoes soltos — e outras de 12 m
    # de altura, que sao um pedaco de copa que ficou fora do raio de uma arvore e
    # nao um arbusto. 400 faces e o minimo para a silhueta fechar; 8 m e o limite
    # acima do qual a peca e claramente um fragmento de copa.
    # UM ARBUSTO TEM DE SER DENSO. Sem o filtro saiam moitas de 88 faces — tres
    # cartoes soltos, que a 6 m sao tres cartoes soltos. A ALTURA nao entra no
    # filtro: o recorte em build_plant trata dela, e filtrar por altura aqui
    # rejeitava justamente as moitas boas, que sao altas porque incluem um ramo
    # solto por cima da massa.
    sec = [r for r in rank(shrubs) if r[1] >= 250]
    if sec:
        log("arbustos utilizaveis: %d   altura %.1f..%.1f m   faces %d..%d"
            % (len(sec), min(r[0] for r in sec), max(r[0] for r in sec),
               min(r[1] for r in sec), max(r[1] for r in sec)))
    else:
        log("nenhuma moita passou o filtro — arbustos virao das arvores")

    bark_mat = _bark_material(os.path.join(SRC, BARK_SRC))
    # PLANT_ no nome: patch_glb_alpha forca alphaMode MASK por esse prefixo.
    leaf_mat = _leaf_material(leaf_png)

    trees, bushes = [], []
    for i in range(n_tree):
        r = ok[(i * max(1, len(ok) // max(1, n_tree))) % len(ok)]
        h = TREE_H[0] + (TREE_H[1] - TREE_H[0]) * (i / max(1, n_tree - 1.0))
        ob = build_plant("tree_pk_%d" % i, r[4], meshes, bark_mat, leaf_mat, h)
        _decimate_bark(ob, log=log)
        trees.append(ob)
    src_b = sec or ok
    for i in range(n_bush):
        r = src_b[(i * max(1, len(src_b) // max(1, n_bush))) % len(src_b)]
        h = BUSH_H[0] + (BUSH_H[1] - BUSH_H[0]) * (i / max(1, n_bush - 1.0))
        ob = build_plant("bush_pk_%d" % i, r[4], meshes, bark_mat, leaf_mat, h,
                         crop=0.45)
        _decimate_bark(ob, log=log)
        bushes.append(ob)

    for ob, me, _co, _fv in meshes:          # o bosque de origem sai da cena
        bpy.data.objects.remove(ob, do_unlink=True)
    log("prototipos: %d arvores (%s faces), %d arbustos (%s faces)"
        % (len(trees), "/".join(str(len(t.data.polygons)) for t in trees),
           len(bushes), "/".join(str(len(b.data.polygons)) for b in bushes)))
    return trees, bushes


def _leaf_material(png, name="PLANT_LEAF"):
    """Folha com alfa CORTADO — a mesma escolha do impostor, pelo mesmo motivo:
    os cartoes cruzam-se, nao ha ordem de desenho correta, e alfa cortado e
    independente de ordem."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    b.inputs["Roughness"].default_value = 0.88
    b.inputs["Metallic"].default_value = 0.0
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = bpy.data.images.load(png, check_existing=True)
    t.extension = "CLIP"
    # O PNG derivado e gravado como Non-Color (o limiar do alfa foi em sRGB cru).
    # Como COR ele tem de voltar a ser sRGB, senao a folha sai lavada.
    try:
        t.image.colorspace_settings.name = "sRGB"
    except Exception:
        pass
    nt.links.new(b.inputs["Base Color"], t.outputs["Color"])
    nt.links.new(b.inputs["Alpha"], t.outputs["Alpha"])
    for val in ("CLIP", "DITHERED", "HASHED"):
        try:
            m.blend_method = val
            break
        except TypeError:
            continue
    try:
        m.alpha_threshold = 0.4
    except Exception:
        pass
    return m


if __name__ == "__main__":
    for _ob in list(bpy.data.objects):
        bpy.data.objects.remove(_ob, do_unlink=True)
    _t, _b = build_prototypes()
    for i, _o in enumerate(_t + _b):
        _o.location = (i * 14.0, 0.0, 0.0)
    _log("pronto: %d prototipos" % len(_t + _b))
