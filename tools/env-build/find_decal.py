"""Acha a DECALCOMANIA que cintila numa construcao, pelo nome ou pela posicao.

    blender -b -P find_decal.py -- --near=40,-20 [--r=40]
    blender -b -P find_decal.py -- --name=MC_03

NAO E UM VARRIMENTO GENERICO. O relato e especifico — "um adesivo vermelho que
esta piscando" — e um adesivo tem uma assinatura que uma parede nao tem:

  * area pequena (uma placa tem 0,05 a 2 m2, uma parede tem dezenas)
  * a UV cai numa zona VERMELHA do atlas
  * esta coplanar com uma face muito maior, a menos de 12 mm

As tres juntas nao acontecem por acaso. O que este script imprime e a peca, a
face, a folga e — o que decide como corrigir — se a decalcomania partilha
vertices com a parede (soldada) ou nao (casca propria).
"""

import os
import sys

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
GLB = os.path.normpath(os.path.join(
    HERE, "..", "..", "public", "environments", "distrito-industrial", "set.glb"))

NEAR = None
NAME = None
RAD = 40.0
for a in sys.argv:
    if a.startswith("--near="):
        NEAR = tuple(float(v) for v in a.split("=", 1)[1].split(","))
    elif a.startswith("--name="):
        NAME = a.split("=", 1)[1]
    elif a.startswith("--r="):
        RAD = float(a.split("=", 1)[1])

for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=GLB)

MESHES = [o for o in bpy.data.objects if o.type == "MESH" and o.data.polygons]


def pick():
    if NAME:
        return [o for o in MESHES if NAME in o.name]
    if NEAR is None:
        return []
    out = []
    for o in MESHES:
        c = o.matrix_world.translation
        if (c.x - NEAR[0]) ** 2 + (c.y - NEAR[1]) ** 2 <= RAD * RAD:
            out.append(o)
    return out


tgt = pick()
print("\n[decal] candidatas perto de %s (r=%.0f):" % (NEAR, RAD))
for o in sorted(tgt, key=lambda o: o.matrix_world.translation.length):
    c = o.matrix_world.translation
    n = len(o.data.polygons)
    print("   %-24s %5d faces  em (%7.1f, %7.1f, %5.1f)"
          % (o.name, n, c.x, c.y, c.z))

# ---- imagem do material, para amostrar a cor da UV ------------------------
CACHE = {}


def atlas_of(ob):
    key = ob.data.materials[0].name if ob.data.materials else None
    if key in CACHE:
        return CACHE[key]
    img = None
    for m in ob.data.materials:
        if not m or not m.use_nodes:
            continue
        for nd in m.node_tree.nodes:
            if nd.type == "TEX_IMAGE" and nd.image:
                img = nd.image
                break
        if img:
            break
    arr = None
    if img:
        w = min(512, img.size[0])
        cp = img.copy()
        cp.scale(w, w)
        px = np.empty(w * w * 4, dtype=np.float32)
        cp.pixels.foreach_get(px)
        arr = px.reshape(w, w, 4)
        bpy.data.images.remove(cp)
    CACHE[key] = arr
    return arr


def basis(n):
    a = np.array([0.0, 0.0, 1.0])
    if abs(n[2]) > 0.9:
        a = np.array([1.0, 0.0, 0.0])
    u = np.cross(n, a)
    u /= max(1e-12, np.linalg.norm(u))
    return u, np.cross(n, u)


for ob in tgt:
    me = ob.data
    nf = len(me.polygons)
    atlas = atlas_of(ob)
    if atlas is None:
        continue
    W = atlas.shape[0]
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    M = np.array(ob.matrix_world)
    cow = co @ M[:3, :3].T + M[:3, 3]
    ns = np.empty(nf * 3)
    ar = np.empty(nf)
    me.polygons.foreach_get("normal", ns)
    me.polygons.foreach_get("area", ar)
    ns = (ns.reshape(-1, 3) @ np.array(ob.matrix_world.to_3x3().normalized()).T)
    cent = np.array([np.array(ob.matrix_world @ p.center) for p in me.polygons])
    uvl = me.uv_layers.active
    if uvl is None:
        continue

    # cor media de cada face, lida no atlas
    reds = []
    for i, p in enumerate(me.polygons):
        if ar[i] > 3.0 or ar[i] < 0.01:
            continue
        us = [uvl.data[li].uv for li in p.loop_indices]
        cu = sum(u[0] for u in us) / len(us)
        cv = sum(u[1] for u in us) / len(us)
        px = atlas[int(np.clip(cv % 1.0 * W, 0, W - 1)),
                   int(np.clip(cu % 1.0 * W, 0, W - 1))]
        r, g, b = float(px[0]), float(px[1]), float(px[2])
        if r > 0.16 and r > g * 1.7 and r > b * 1.7:
            reds.append((r - 0.5 * (g + b), i, r, g, b))
    if not reds:
        continue
    reds.sort(reverse=True)
    print("\n[decal] === %s : %d faces vermelhas pequenas ==="
          % (ob.name, len(reds)))

    # cascas
    ed = np.empty(len(me.edges) * 2, dtype=np.int32)
    me.edges.foreach_get("vertices", ed)
    ed = ed.reshape(-1, 2)
    parent = np.arange(len(me.vertices))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for a, b in ed:
        ra, rb = find(int(a)), find(int(b))
        if ra != rb:
            parent[ra] = rb
    shell = np.array([find(i) for i in range(len(me.vertices))])

    shown = 0
    for _score, i, r, g, b in reds:
        n0 = ns[i] / max(1e-9, np.linalg.norm(ns[i]))
        u, v = basis(n0)
        # SEM EXIGIR QUE A PARCEIRA SEJA MAIOR e sem exigir containment: um
        # adesivo pode estar sobre um painel do MESMO tamanho (um letreiro sobre
        # a sua propria chapa), e ai as duas condicoes anteriores rejeitavam-no.
        # Basta serem paralelas, estarem a menos de 12 mm e as pegadas
        # sobreporem-se — que e a definicao de disputa de profundidade.
        bi = np.array([[np.dot(cow[k], u), np.dot(cow[k], v)]
                       for k in me.polygons[i].vertices])
        bi0, bi1 = bi.min(axis=0), bi.max(axis=0)
        best = None
        for j in range(nf):
            if j == i:
                continue
            n1 = ns[j] / max(1e-9, np.linalg.norm(ns[j]))
            if abs(float(np.dot(n0, n1))) < 0.999:
                continue
            gap = abs(float(np.dot(n0, cent[i] - cent[j])))
            if gap > 0.012:
                continue
            bj = np.array([[np.dot(cow[k], u), np.dot(cow[k], v)]
                           for k in me.polygons[j].vertices])
            bj0, bj1 = bj.min(axis=0), bj.max(axis=0)
            ou = min(bi1[0], bj1[0]) - max(bi0[0], bj0[0])
            ov = min(bi1[1], bj1[1]) - max(bi0[1], bj0[1])
            if ou <= 0.0 or ov <= 0.0:
                continue
            if ou * ov < 0.35 * (bi1[0] - bi0[0]) * (bi1[1] - bi0[1]):
                continue
            if best is None or gap < best[0]:
                best = (gap, j)
        if best is None:
            continue
        gap, j = best
        vi = set(me.polygons[i].vertices)
        vj = set(me.polygons[j].vertices)
        print("   adesivo f%-6d  %.3f m2  rgb %.2f/%.2f/%.2f  em mundo "
              "(%7.2f, %7.2f, %5.2f)" % (i, ar[i], r, g, b, *cent[i]))
        print("      contra f%-6d %8.3f m2 | FOLGA %6.3f mm | casca %s | "
              "vertices partilhados %d | normal %s"
              % (j, ar[j], gap * 1000,
                 "MESMA" if shell[me.polygons[i].vertices[0]]
                 == shell[me.polygons[j].vertices[0]] else "distinta",
                 len(vi & vj), np.round(n0, 3)))
        shown += 1
        if shown >= 12:
            break
print("\n[decal] fim")
