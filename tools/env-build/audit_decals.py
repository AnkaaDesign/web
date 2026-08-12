"""Acha a peca PEQUENA assente no plano de uma GRANDE — a que cintila.

    blender -b -P audit_decals.py -- [--prefix=MC_] [--fix]

POR QUE audit_coplanar.py NAO ENCONTRA ESTAS. Aquele ficheiro procura faces com
PEGADA IDENTICA, e a nota dele explica bem porque: era a unica chave que nao dava
falsos positivos numa grelha subdividida. So que a chave tambem exclui, por
construcao, exatamente o caso relatado — porta, quadro eletrico, adesivo,
caixilho: um retangulo de 1 m2 pousado numa parede de 40 m2. As pegadas sao
diferentes, os centros estao longe, e no entanto as duas superficies disputam o
mesmo z em toda a area da pequena.

Correu-se `audit_coplanar --all` no set.glb desta build: ZERO pares. E o utilizador
continua a ver tres pecas a cintilar. Logo o que cintila nao e o que aquele
ficheiro mede.

A CHAVE AQUI E A CONTENCAO, nao a igualdade:

    mesmo plano (normal a menos de 3 graus, |dd| < 12 mm)
    +  area_pequena <= 0.30 * area_grande
    +  a pegada 2D da pequena esta DENTRO da caixa 2D da grande
    -> disputa de profundidade em toda a area da pequena

O passo de contencao e o que separa isto de "duas faces vizinhas da mesma
grelha": vizinhas nao se contem, encostam.

QUANTO CHEGA PARA SEPARAR. A camera do engine e `PerspectiveCamera(fov, 1, 0.1,
600)`. Com near a 0,1 m e buffer de 24 bits, a resolucao de profundidade a uma
distancia z e ~ z^2 / (near * 2^24): a 40 m da camera (que e a distancia tipica
destas construcoes na orbita) dao-se ~1,0 mm, e a 80 m ~3,8 mm. Um afastamento
de 12 mm cobre os dois com folga e continua abaixo do que se ve num render.

--fix reescreve o set.glb EMPURRANDO SO ESSAS FACES ao longo da normal. Nao
mexe em mais nada, que e o pedido: "ache a construcao em especifico e corrija
nela apenas". Cada peca tratada e impressa com nome, posicao e folga antes/depois.
"""
import math
import os
import sys

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
GLB = os.path.normpath(os.path.join(
    HERE, "..", "..", "public", "environments", "distrito-industrial", "set.glb"))

D_MAX = 0.050          # ver CLEAR: e a janela de deteccao, e vale o mesmo
COS_MAX = math.cos(math.radians(3.0))
AREA_RATIO = 0.30      # a "pequena" tem de ser mesmo pequena face a "grande"
MIN_AREA = 0.02        # m2 — abaixo disto nao ha o que ver
# 50 mm DE FOLGA-ALVO, e o numero e observacao e nao teoria.
#
# A teoria dizia 12 mm: o buffer resolve z^2*(far-near)/(near*far*2^24), o que
# com o `near` adaptativo do engine (>= 0,08 m, e 0,5 m na orbita larga) da cerca
# de 1 mm aos 90 m a que estas construcoes sao vistas. Por essa conta 12 mm sao
# dez degraus e nada devia cintilar.
#
# A observacao diz outra coisa, e ela vem de duas medidas na mesma peca:
#
#   a placa do MC_03, que estava a 0,0 mm, PAROU de cintilar afastada 20 mm;
#   a porta do 2o andar do MC_02, que ficou a 18,4 mm, CONTINUOU a cintilar.
#
# Entao o limiar real esta acima de 18 mm e a conta esta otimista por uma ordem
# de grandeza — o que nao surpreende: ela supoe buffer de 24 bits, e o
# framebuffer que o navegador entrega nao e uma escolha do app. 50 mm ficam
# quase tres vezes acima da maior folga que ainda falhou, e continuam a ser a
# espessura de uma porta no seu rebaixo, ou seja invisiveis de perto.
#
# E O AFASTAMENTO E ATE A FOLGA, NAO SOMADO A ELA. Empurrar 50 mm toda a face
# detectada levaria uma que ja estava a 45 mm para 95 mm, e ai sim a placa
# flutua. O que se aplica e `CLEAR - folga`, entao a folga final e 50 mm para
# todas — a face que ja estava quase boa anda quase nada.
CLEAR = 0.050          # folga final que --fix garante
PUSH_MIN = 0.005       # nunca mover menos que isto, ou a face fica onde estava

PREFIX = None
FIX = False
for a in sys.argv:
    if a.startswith("--prefix="):
        PREFIX = tuple(p for p in a.split("=", 1)[1].split(",") if p)
    elif a == "--fix":
        FIX = True


def log(m):
    print("[decals] %s" % m, flush=True)


def _pass(meshes, log, fix):
    # Uma malha e partilhada por todas as duplicatas do layout, entao tratar a
    # MALHA trata todas as copias — e contar por objeto contaria a mesma peca
    # varias vezes.
    seen = set()
    total = 0
    fixed = 0
    for ob in sorted(meshes, key=lambda o: o.name):
        me = ob.data
        if me.name in seen:
            continue
        seen.add(me.name)
        nf = len(me.polygons)
        if nf < 2:
            continue

        co = np.empty(len(me.vertices) * 3)
        me.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3)
        nrm = np.empty(nf * 3)
        me.polygons.foreach_get("normal", nrm)
        nrm = nrm.reshape(-1, 3)
        area = np.empty(nf)
        me.polygons.foreach_get("area", area)
        cent = np.empty(nf * 3)
        me.polygons.foreach_get("center", cent)
        cent = cent.reshape(-1, 3)
        d = np.einsum("ij,ij->i", nrm, cent)

        # baldes por normal ARREDONDADA, so para nao comparar tudo com tudo;
        # o teste fino de angulo e feito dentro do balde.
        #
        # CADA FACE ENTRA EM TRES BALDES, e nao num. O balde de cota tem 5 cm e o
        # que interessa sao pares a menos de 12 mm: um par que caia em cima da
        # fronteira do balde ia parar a baldes diferentes e nunca era comparado.
        # O comentario antigo dizia "um balde vizinho tambem serve" — dizia, mas
        # o codigo nunca olhava para ele.
        buckets = {}
        for i in range(nf):
            if area[i] < MIN_AREA:
                continue
            n = nrm[i]
            base = int(round(d[i] / 0.05))
            for off in (-1, 0, 1):
                buckets.setdefault((round(n[0], 1), round(n[1], 1),
                                    round(n[2], 1), base + off), []).append(i)

        # A PEQUENA E COMPARADA COM TODAS AS MAIORES, E NAO SO COM A MAIOR DE
        # TODAS — e este era o defeito que deixava passar tudo o que foi
        # relatado como "piscando".
        #
        # `big` era `idx[0]`, a face de maior area do balde, e so ela. Uma parede
        # real chega ao balde partida em varias faces grandes, e basta que UMA
        # delas ja tenha sido afastada para a maior ficar longe da placa: a placa
        # media 10 mm contra essa e passava no teste, enquanto continuava a
        # DISPUTAR ZERO com a face que estava mesmo por tras dela.
        #
        # Medido no set.glb desta build, com a comparacao contra todas: MC_00 tem
        # 204 faces em disputa, MC_03 90 e MC_02 63 — a maioria com folga de
        # 0,0 mm. Com a comparacao antiga: zero, nas cinco pecas.
        #
        # Guarda-se a MENOR folga por face, porque e a face mais proxima que
        # decide se cintila.
        best = {}
        for key, idx in buckets.items():
            if len(idx) < 2:
                continue
            idx = sorted(set(idx), key=lambda i: -area[i])
            for bi, big in enumerate(idx):
                nb, ab = nrm[big], area[big]
                u = np.array([0.0, 0.0, 1.0])
                if abs(nb[2]) > 0.9:
                    u = np.array([1.0, 0.0, 0.0])
                e1 = np.cross(nb, u)
                e1 /= max(1e-12, np.linalg.norm(e1))
                e2 = np.cross(nb, e1)

                def proj(i, _e1=e1, _e2=e2):
                    vs = np.array([co[v] for v in me.polygons[i].vertices])
                    return np.stack([vs @ _e1, vs @ _e2], axis=1)

                pb = proj(big)
                bx0, by0 = pb.min(axis=0)
                bx1, by1 = pb.max(axis=0)
                # `idx` esta por area decrescente, entao tudo a frente de `bi` ja
                # foi (ou sera) `big` por sua vez: so as menores sao candidatas.
                for i in idx[bi + 1:]:
                    if area[i] > AREA_RATIO * ab:
                        continue
                    if float(np.dot(nrm[i], nb)) < COS_MAX:
                        continue
                    gap = abs(float(d[i] - d[big]))
                    if gap > D_MAX:
                        continue
                    ps = proj(i)
                    sx0, sy0 = ps.min(axis=0)
                    sx1, sy1 = ps.max(axis=0)
                    # CONTENCAO, e nao proximidade: a pequena tem de estar DENTRO
                    # da caixa da grande, com 1 cm de tolerancia. Duas faces
                    # vizinhas de uma grelha falham aqui, que e o ponto.
                    if not (sx0 > bx0 - 0.01 and sx1 < bx1 + 0.01
                            and sy0 > by0 - 0.01 and sy1 < by1 + 0.01):
                        continue
                    if i not in best or gap < best[i][1]:
                        best[i] = (big, gap, float(area[i]), float(ab))
        hits = [(i, b, g, ai, ab) for i, (b, g, ai, ab) in best.items()]

        if not hits:
            continue
        wc = ob.matrix_world.translation
        log("%-16s (malha %-18s) em (%7.1f, %7.1f) — %d faces em disputa"
            % (ob.name, me.name, wc.x, wc.y, len(hits)))
        for i, big, gap, ai, ab in sorted(hits, key=lambda h: h[2])[:6]:
            c = ob.matrix_world @ me.polygons[i].center
            log("    face %-6d %6.2f m2 sobre %7.2f m2  folga %5.1f mm  em (%6.1f, %6.1f, %5.1f)"
                % (i, ai, ab, gap * 1000.0, c.x, c.y, c.z))
        if len(hits) > 6:
            log("    ... e mais %d" % (len(hits) - 6))
        total += len(hits)

        if fix:
            # EMPURRA SO A FACE PEQUENA, e move os VERTICES DELA. Se um vertice
            # for partilhado com a parede (peca soldada), mover partiria a
            # parede — entao os vertices sao DUPLICADOS primeiro e a face passa
            # a usar as copias.
            #
            # O SENTIDO VEM DA PAREDE, NAO DA PLACA. Era `f.normal` da propria
            # face pequena, e nestes ripes o enrolamento dela e arbitrario:
            # metade das vezes a normal aponta para DENTRO e o empurrao enterra a
            # placa em vez de a destacar — o defeito deixa de ser "cintila" e
            # passa a ser "desapareceu", que e pior porque nao se ve.
            #
            # Quem sabe onde e fora e a face GRANDE em disputa, orientada contra
            # o centro da peca: para uma parede de fachada esse vetor aponta
            # sempre para fora do edificio. E a mesma regra de `_outward` em
            # dl_packs.py, aplicada ao par em vez de a face isolada.
            ctr = co.mean(axis=0)
            push = {}
            for i, big, gap, _ai, _ab in hits:
                nb = nrm[big]
                if float(np.dot(nb, cent[big] - ctr)) < 0.0:
                    nb = -nb
                push[i] = nb * max(PUSH_MIN, CLEAR - gap)
            me.calc_loop_triangles()
            import bmesh
            from mathutils import Vector as _V
            bm = bmesh.new()
            bm.from_mesh(me)
            bm.faces.ensure_lookup_table()
            tgt = [(bm.faces[i], push[i]) for i in sorted(push)
                   if i < len(bm.faces)]
            if tgt:
                bmesh.ops.split_edges(
                    bm, edges=list({e for f, _n in tgt for e in f.edges}))
                for f, n in tgt:
                    dv = _V((float(n[0]), float(n[1]), float(n[2])))
                    for v in f.verts:
                        v.co += dv
                bm.to_mesh(me)
                me.update()
                fixed += len(tgt)
            bm.free()

    return total


def sweep(meshes, log=log, rounds=4, fix=True):
    """Detecta e (opcionalmente) afasta, sobre uma lista de objetos ja em cena.

    CHAMADO PELA BUILD, e nao so a mao. Corrigir isto num passo separado sobre o
    .glb funcionava, mas so ate a build seguinte reescrever o ficheiro: o defeito
    voltava sem ninguem mexer em nada, que e a pior especie de regressao. Aqui
    ele corre ANTES do export, sobre a mesma cena que vai ser exportada.

    ITERA ATE ESTABILIZAR, e isso e medido e nao precaucao: afastar uma porta 12
    mm descobre o que estava por baixo dela. Medido nesta cena, 200 -> 98 -> 38
    -> 1 -> 0 em quatro passagens.
    """
    total = 0
    for r in range(rounds):
        n = _pass(meshes, log, fix)
        total += n
        if n == 0:
            break
        log("  passagem %d: %d faces afastadas" % (r + 1, n))
    return total


def main():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    log("%s (%.1f MB)" % (GLB, os.path.getsize(GLB) / 1048576.0))
    bpy.ops.import_scene.gltf(filepath=GLB)

    meshes = [o for o in bpy.data.objects
              if o.type == "MESH" and o.data.polygons
              and (PREFIX is None or o.name.startswith(PREFIX))]
    log("%d malhas" % len(meshes))
    total = _pass(meshes, log, FIX)
    log("TOTAL: %d faces em disputa" % total)
    if FIX and total:
        kw = dict(filepath=GLB, export_format="GLB", export_apply=False,
                  export_yup=True, export_cameras=False, export_lights=False,
                  export_draco_mesh_compression_enable=False,
                  export_vertex_color="ACTIVE")
        try:
            bpy.ops.export_scene.gltf(export_image_format="WEBP",
                                      export_image_quality=88, **kw)
        except TypeError:
            bpy.ops.export_scene.gltf(**kw)
        log("--fix: %d faces levadas a %.0f mm de folga, set.glb reescrito"
            % (total, CLEAR * 1000))


# SO CORRE SOZINHO QUANDO E O SCRIPT. A build importa este ficheiro por
# importlib (`_load("audit_decals")`) para chamar `sweep()` sobre a cena que ja
# tem em memoria; sem esta guarda, importar significaria apagar essa cena, ler o
# set.glb da build ANTERIOR do disco e exportar por cima — que e um jeito
# barroco de a build nao ter efeito nenhum.
if __name__ == "__main__":
    main()
