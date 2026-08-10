"""Diz QUE PECA esta num pixel de um render de shot_park.

    blender -b -P whats_at.py -- --shot=q_south --px=120,340

Existe porque identificar uma construcao "pelo aspecto" falhou tres vezes
seguidas: um render de 1000x600 nao diz o nome de nada, e deduzir o azimute pela
pose do caminhao no print do app deu o lado errado duas vezes. A camera de cada
shot esta declarada em SHOTS; com ela, saber o que esta num pixel e aritmetica,
nao palpite.

Lanca um raio pelo pixel e devolve a peca atingida — e tambem projeta o centro de
cada peca no ecra, para se ver a vizinhanca toda de uma vez.
"""

import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
os.chdir(HERE)

SHOT = "q_south"
PX = None
for a in sys.argv:
    if a.startswith("--shot="):
        SHOT = a.split("=", 1)[1]
    elif a.startswith("--px="):
        PX = tuple(float(v) for v in a.split("=", 1)[1].split(","))

GLB = os.path.normpath(os.path.join(
    HERE, "..", "..", "public", "environments", "distrito-industrial", "set.glb"))

# a mesma tabela de shot_park, lida do ficheiro para nao divergir
import re  # noqa: E402
src = open(os.path.join(HERE, "shot_park.py"), encoding="utf-8").read()
m = re.search(r"^SHOTS = \[(.*?)^\]", src, re.S | re.M)
SHOTS = eval("[" + m.group(1) + "]")  # noqa: S307 — ficheiro do proprio projeto
shot = [s for s in SHOTS if s[0] == SHOT]
if not shot:
    print("[at] shot %s nao existe. ha: %s"
          % (SHOT, ", ".join(s[0] for s in SHOTS)))
    sys.exit(0)
name, tgt, dist, d, fov = shot[0]
W, H = 1000, 600

tgt = Vector(tgt)
d = Vector(d).normalized()
eye = tgt + d * dist
fwd = (tgt - eye).normalized()
up0 = Vector((0.0, 0.0, 1.0))
right = fwd.cross(up0).normalized()
up = right.cross(fwd).normalized()
# Blender: `angle` e o FOV do lado MAIOR do sensor
half_w = math.tan(math.radians(fov) / 2.0)
half_h = half_w * H / float(W)

print("[at] shot %s: olho (%.1f, %.1f, %.1f) -> alvo (%.1f, %.1f, %.1f)"
      % (name, eye.x, eye.y, eye.z, tgt.x, tgt.y, tgt.z))
print("[at] +X no ecra: %s | +Y no ecra: %s"
      % ("direita" if right.x > 0 else "esquerda",
         "direita" if right.y > 0 else "esquerda"))

for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=GLB)
MESHES = [o for o in bpy.data.objects if o.type == "MESH" and o.data.polygons]


def project(p):
    v = Vector(p) - eye
    z = v.dot(fwd)
    if z <= 0.01:
        return None
    x = v.dot(right) / z / half_w
    y = v.dot(up) / z / half_h
    return ((x * 0.5 + 0.5) * W, (0.5 - y * 0.5) * H, z)


if PX:
    # raio pelo pixel
    nx = (PX[0] / W - 0.5) * 2.0 * half_w
    ny = (0.5 - PX[1] / H) * 2.0 * half_h
    dirv = (fwd + right * nx + up * ny).normalized()
    best = None
    for ob in MESHES:
        mi = ob.matrix_world.inverted()
        try:
            ok, loc, _n, _i = ob.ray_cast(mi @ eye,
                                          mi.to_3x3() @ dirv, distance=900.0)
        except Exception:
            continue
        if ok:
            w = ob.matrix_world @ loc
            t = (w - eye).length
            if best is None or t < best[0]:
                best = (t, ob.name, w)
    if best:
        print("\n[at] NO PIXEL (%.0f, %.0f): >>> %s <<<  a %.1f m, mundo "
              "(%.1f, %.1f, %.1f)"
              % (PX[0], PX[1], best[1], best[0], best[2].x, best[2].y, best[2].z))
    else:
        print("\n[at] nada nesse pixel")

print("\n[at] pecas nomeadas, projetadas no ecra (so as visiveis):")
rows = []
for ob in MESHES:
    if ob.name.startswith(("yard", "road", "out_", "outer", "turf", "median",
                           "svc", "kerbs", "gutters", "marking", "grass",
                           "fence", "gates")):
        continue
    c = ob.matrix_world.translation
    if abs(c.x) < 1e-6 and abs(c.y) < 1e-6:
        vs = [ob.matrix_world @ Vector(b) for b in ob.bound_box]
        c = sum(vs, Vector()) / 8.0
    pr = project(c)
    if pr and -200 < pr[0] < W + 200 and -200 < pr[1] < H + 200:
        rows.append((pr[0], pr[1], pr[2], ob.name, c))
rows.sort()
for px, py, z, nm, c in rows:
    print("   ecra (%6.0f, %5.0f)  %6.1f m  %-24s  mundo (%7.1f, %7.1f)"
          % (px, py, z, nm, c.x, c.y))
