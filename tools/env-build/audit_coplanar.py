"""Procura faces SOBREPOSTAS no set.glb exportado — as que cintilam no app.

    blender -b -P audit_coplanar.py -- [--all] [--prefix=MC_,DL_]

POR QUE NO .GLB E NAO NA CENA DO BUILD. `separate_coplanar()` corre no import e
relata o que APANHOU (1 306 pares no DL_cabinet, 425 no MC_00). O que interessa a
quem ve a peca a piscar e o que ele DEIXOU PASSAR, e isso so existe do outro lado
do export — depois do afastamento de 10 mm, depois de o exportador ter aplicado
as transformacoes, e na malha que o motor realmente desenha.

O TESTE E DE PEGADA IDENTICA, NAO DE PROXIMIDADE, e a primeira versao deste
ficheiro errou exatamente ai. Testar "mesmo plano + centros proximos" da como
duplicada CADA PAR DE FACES VIZINHAS de qualquer superficie plana subdividida —
o patio dava 3 900 m2 de falsos positivos e o `outer` dava 167 000. Duas faces
vizinhas de uma grelha sao coplanares, tem a mesma normal e os centros a uma
aresta de distancia; nao se sobrepoem em nada.

O que uma face duplicada tem, e uma vizinha nao tem, e a MESMA PEGADA: os mesmos
vertices projetados no plano comum. Entao a chave e

    (normal canonizada, coordenadas 2D dos vertices no plano, ordenadas)

e duas faces com a mesma chave ocupam literalmente o mesmo lugar. Zero falsos
positivos por construcao, e o `d` de cada uma diz a que distancia ficaram.

O limiar de 12 mm e o mesmo que `separate_coplanar` usa para detetar: o que
aparecer aqui e, por definicao, algo que o detetor devia ter apanhado.
"""

import math
import os
import sys

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
GLB = os.path.join(HERE, "..", "..", "public", "environments",
                   "distrito-industrial", "set.glb")

D_MAX = 0.012          # 12 mm, o mesmo de separate_coplanar
D_SAFE = 0.004         # abaixo disto o buffer de profundidade nao separa
GRID = 0.001           # 1 mm de arredondamento na pegada
MIN_AREA = 0.05        # m2 — abaixo disto nao ha o que ver
PREFIX = ("MC_", "mc_")


def basis(n):
    """Base 2D deterministica para um plano de normal `n`.

    Deterministica E a palavra: duas faces duplicadas so caem na mesma chave se
    a base for derivada da normal e de mais nada.
    """
    a = np.array([0.0, 0.0, 1.0])
    if abs(n[2]) > 0.9:
        a = np.array([1.0, 0.0, 0.0])
    u = np.cross(n, a)
    u /= max(1e-12, np.linalg.norm(u))
    v = np.cross(n, u)
    return u, v


def main():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    path = os.path.normpath(GLB)
    print("[audit] %s (%.1f MB)" % (path, os.path.getsize(path) / 1e6))
    bpy.ops.import_scene.gltf(filepath=path)

    pref = PREFIX
    for a in sys.argv:
        if a == "--all":
            pref = None
        elif a.startswith("--prefix="):
            pref = tuple(a.split("=", 1)[1].split(","))
    obs = [o for o in bpy.data.objects
           if o.type == "MESH"
           and (pref is None or any(k in o.name for k in pref))]
    print("[audit] %d malhas (%s)"
          % (len(obs), "todas" if pref is None else "/".join(pref)))

    report = []
    for ob in obs:
        me = ob.data
        if not me.polygons:
            continue
        mw = ob.matrix_world
        nf = len(me.polygons)
        co = np.empty(len(me.vertices) * 3)
        me.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3)
        M = np.array(mw)
        co = co @ M[:3, :3].T + M[:3, 3]
        ns = np.empty(nf * 3)
        ar = np.empty(nf)
        me.polygons.foreach_get("normal", ns)
        me.polygons.foreach_get("area", ar)
        ns = (ns.reshape(-1, 3) @ np.array(mw.to_3x3().normalized()).T)

        groups = {}
        for i in range(nf):
            n = ns[i]
            ln = np.linalg.norm(n)
            if ln < 1e-9:
                continue
            n = n / ln
            # FRENTE E VERSO NO MESMO GRUPO: uma casca duplicada e virada tem de
            # cair aqui, senao o par mais obvio de todos escapa.
            flip = tuple(n) < tuple(-n)
            if flip:
                n = -n
            u, v = basis(n)
            vs = [co[k] for k in me.polygons[i].vertices]
            d = float(np.dot(n, vs[0]))
            foot = tuple(sorted((round(float(np.dot(p, u)) / GRID),
                                 round(float(np.dot(p, v)) / GRID))
                                for p in vs))
            key = (tuple(np.round(n, 3)), foot)
            groups.setdefault(key, []).append((d, i, flip))

        pairs = []
        for key, items in groups.items():
            if len(items) < 2:
                continue
            items.sort()
            for a in range(len(items) - 1):
                d0, i0, f0 = items[a]
                d1, i1, f1 = items[a + 1]
                gap = abs(d1 - d0)
                if gap > D_MAX or ar[i0] < MIN_AREA:
                    continue
                pairs.append((ar[i0], gap, f0 == f1))

        # ---- e o PAINEL SOBRE A PAREDE, que a pegada identica nao ve --------
        #
        # Uma porta aplicada numa fachada nao tem a pegada da fachada: e uma
        # face PEQUENA contida numa GRANDE. O teste de pegada identica e cego a
        # ela por construcao, e era exatamente essa a peca que continuava a
        # piscar depois de o resto estar limpo.
        #
        # O criterio e containment: o centro da face pequena cai dentro do
        # poligono da grande, projetados no plano comum. Nao ha falso positivo
        # possivel com faces vizinhas — o centro de uma vizinha cai fora.
        cent = np.array([np.array(mw @ me.polygons[i].center) for i in range(nf)])
        by_n = {}
        for i in range(nf):
            n = ns[i]
            ln = np.linalg.norm(n)
            if ln < 1e-9:
                continue
            n = n / ln
            if tuple(n) < tuple(-n):
                n = -n
            by_n.setdefault(tuple(np.round(n, 1)), []).append(i)
        for k, ids in by_n.items():
            if len(ids) < 2:
                continue
            ids.sort(key=lambda i: ar[i], reverse=True)
            big = [i for i in ids if ar[i] >= MIN_AREA][:60]
            for i0 in big:
                n0 = ns[i0] / max(1e-9, np.linalg.norm(ns[i0]))
                u, v = basis(n0)
                poly = np.array([[np.dot(co[k2], u), np.dot(co[k2], v)]
                                 for k2 in me.polygons[i0].vertices])
                for i1 in ids:
                    if i1 == i0 or ar[i1] > ar[i0] * 0.9 or ar[i1] < MIN_AREA:
                        continue
                    n1 = ns[i1] / max(1e-9, np.linalg.norm(ns[i1]))
                    if abs(float(np.dot(n0, n1))) < 0.9995:
                        continue
                    gap = abs(float(np.dot(n0, cent[i1] - cent[i0])))
                    if gap > D_MAX:
                        continue
                    q = np.array([np.dot(cent[i1], u), np.dot(cent[i1], v)])
                    inside, m = False, len(poly)
                    for e in range(m):
                        a2, b2 = poly[e], poly[(e + 1) % m]
                        if (a2[1] > q[1]) != (b2[1] > q[1]):
                            xx = a2[0] + (q[1] - a2[1]) * (b2[0] - a2[0]) \
                                / max(1e-12, (b2[1] - a2[1]))
                            if q[0] < xx:
                                inside = not inside
                    if inside:
                        pairs.append((ar[i1], gap, True))
        if pairs:
            pairs.sort(reverse=True)
            hard = [p for p in pairs if p[1] < D_SAFE]
            c = mw.translation
            report.append((sum(p[0] for p in hard), sum(p[0] for p in pairs),
                           ob.name, len(pairs), len(hard), pairs[0],
                           (c.x, c.y, c.z)))

    report.sort(reverse=True)
    print("\n[audit] === faces com PEGADA IDENTICA a menos de %d mm ==="
          % (D_MAX * 1000))
    print("[audit] 'grave' = folga < %d mm, onde o buffer nao separa e cintila"
          % (D_SAFE * 1000))
    if not report:
        print("  nada acima de %.0f cm2" % (MIN_AREA * 1e4))
    for grave, tot, name, n, nh, w, c in report[:30]:
        print("  %-26s GRAVE %8.2f m2 (%3d pares) | total %8.2f m2 (%4d) "
              "| pior %.2f m2 a %5.2f mm | mundo (%.1f, %.1f, %.1f)"
              % (name[:26], grave, nh, tot, n, w[0], w[1] * 1000.0,
                 c[0], c[1], c[2]))
    print("[audit] fim")


main()
