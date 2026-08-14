# Mede o cenario `serra` COMO ELE ESTA, no 05_veg.blend (coordenadas do Blender:
# a rodovia corre em +Y, e o exportador manda (x,y,z) -> (x, z, -y) do three, ou
# seja a FRENTE do caminhao — three +Z — e o -Y daqui).
#
#   blender -b -P audit_serra.py -- [--file=05_veg.blend]
#
# Responde as perguntas do relato, uma seccao por pergunta, e nao opina.
import bpy
import json
import math
import os
import sys

import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(HERE, "_work_serra")

CURVE_R, CURVE_T0 = 1400.0, 55.0
HALF_LEN = 175.0


def road_x(t):
    a = max(0.0, abs(t) - CURVE_T0)
    return (a * a) / (2.0 * CURVE_R)


def mat_of(o):
    return o.data.materials[0].name if o.data.materials and o.data.materials[0] else "?"


def sec(t):
    print("\n" + "=" * 78)
    print(t)
    print("=" * 78, flush=True)


argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
fn = "05_veg.blend"
for a in argv:
    if a.startswith('--file='):
        fn = a.split('=', 1)[1]
bpy.ops.wm.open_mainfile(filepath=os.path.join(WORK, fn))

objs = [o for o in bpy.data.objects if o.type == 'MESH' and len(o.data.polygons)]

sec("1 · INVENTARIO — objeto, material, poligonos, caixa (Blender)")
rows = []
for o in objs:
    vs = [o.matrix_world @ v.co for v in o.data.vertices]
    xs = [v.x for v in vs]; ys = [v.y for v in vs]; zs = [v.z for v in vs]
    rows.append((o.name, mat_of(o), len(o.data.polygons),
                 min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)))
rows.sort(key=lambda r: -r[2])
print(f"{'objeto':<28}{'material':<26}{'pol':>8}  "
      f"{'x':>16} {'y':>16} {'z':>14}")
for r in rows:
    print(f"{r[0]:<28}{r[1]:<26}{r[2]:>8}  "
          f"{r[3]:>7.0f}..{r[4]:<8.0f} {r[5]:>7.0f}..{r[6]:<8.0f} {r[7]:>6.0f}..{r[8]:<7.0f}")
print(f"TOTAL {sum(r[2] for r in rows)} poligonos em {len(rows)} objetos")

# ---------------------------------------------------------------------------
sec("2 · ESTRADAS DE CHAO — onde cada faixa de terra passa, em u (offset ao eixo)")
for nm in ('Dirt_Road', 'Dirt_Road_Bare', 'Dirt_Road_Trails', 'Cobblestone',
           'Road_Edge_Gravel_Dusty', 'Wood_Fence', 'Metal_Fence', 'Wood_Log',
           'Mud_Pile', 'Puddle_Streaks'):
    o = bpy.data.objects.get(nm)
    if not o or not len(o.data.polygons):
        print(f"  {nm:<26} ausente")
        continue
    C = np.array([[(o.matrix_world @ p.center).x, (o.matrix_world @ p.center).y,
                   (o.matrix_world @ p.center).z] for p in o.data.polygons])
    u = C[:, 0] - np.array([road_x(v) for v in C[:, 1]])
    inside = np.abs(C[:, 1]) < HALF_LEN
    print(f"  {nm:<26} {len(C):>6} faces | u {u.min():>7.1f}..{u.max():<7.1f} "
          f"| y {C[:,1].min():>7.1f}..{C[:,1].max():<7.1f}")
    for lim in (14, 20, 30, 45):
        k = int((np.abs(u) < lim).sum())
        kk = int(((np.abs(u) < lim) & inside).sum())
        if k:
            print(f"      |u|<{lim:>3} m: {k:>5} faces ({kk} delas com |y|<{HALF_LEN:.0f})")
    # por faixa de y, a face mais proxima do eixo
    for y0 in range(-200, 200, 50):
        m = (C[:, 1] >= y0) & (C[:, 1] < y0 + 50)
        if m.sum():
            print(f"      y {y0:>5}..{y0+50:<5}: {int(m.sum()):>5} faces, "
                  f"|u| min {np.abs(u[m]).min():>6.1f} m")

# ---------------------------------------------------------------------------
sec("3 · COBERTURA DO CHAO — de onde a camera olha, o que ha e onde nao ha")
GROUND = ['Ground_Dirt', 'Dirt_Road', 'Dirt_Road_Bare', 'Dirt_Road_Trails',
          'Road_Edge_Gravel_Dusty', 'Cobblestone', 'Grass_Close', 'Aerial_Grass',
          'Terrain_Far', 'Sloped_Rock', 'Tall_Cliff', 'Broken_Rocks',
          'ROAD_PAVEMENT', 'ROAD_VERGE_L', 'ROAD_VERGE_R', 'BATTER_L', 'BATTER_R']
gobjs = [o for o in objs if o.name in GROUND or mat_of(o) in GROUND]
verts, faces = [], []
for o in gobjs:
    off = len(verts)
    mw = o.matrix_world
    verts += [mw @ v.co for v in o.data.vertices]
    for p in o.data.polygons:
        vs = list(p.vertices)
        for i in range(1, len(vs) - 1):
            faces.append((off + vs[0], off + vs[i], off + vs[i + 1]))
bvh = BVHTree.FromPolygons([tuple(v) for v in verts], faces, all_triangles=True)
print(f"  BVH de {len(gobjs)} objetos, {len(faces)} triangulos")


def zat(x, y):
    h = bvh.ray_cast(Vector((x, y, 900.0)), Vector((0, 0, -1)))
    return h[0].z if h[0] is not None else None


print("\n  perfil ao longo do eixo (y negativo = FRENTE do caminhao):")
print(f"  {'y':>7} {'z eixo':>9} {'u=-40':>9} {'u=+40':>9} {'u=-90':>9} {'u=+90':>9}")
for y in range(-400, 401, 20):
    row = [zat(road_x(y) + du, y) for du in (0, -40, 40, -90, 90)]
    s = "  ".join(("  ---  " if v is None else f"{v:7.1f}") for v in row)
    print(f"  {y:>7} {s}")

print("\n  BURACOS: fracao da grelha SEM chao, por anel de distancia a origem")
for r0, r1 in ((0, 60), (60, 120), (120, 200), (200, 300), (300, 450), (450, 700)):
    tot = miss = 0
    n = 0
    for a in np.arange(0, 360, 4.0):
        for r in np.arange(r0, r1, max(2.0, (r1 - r0) / 20)):
            x = r * math.cos(math.radians(a)); y = r * math.sin(math.radians(a))
            tot += 1
            if zat(x, y) is None:
                miss += 1
    print(f"    {r0:>4}..{r1:<4} m: {miss}/{tot} sem chao  ({100.0*miss/max(1,tot):.1f} %)")

print("\n  BURACO A FRENTE (y<0) e ATRAS (y>0), por setor de 20 m:")
for y0 in range(-460, 460, 40):
    miss = tot = 0
    for x in np.arange(-260, 261, 10.0):
        for y in np.arange(y0, y0 + 40, 10.0):
            tot += 1
            if zat(x, y) is None:
                miss += 1
    print(f"    y {y0:>5}..{y0+40:<5}: {miss:>4}/{tot:<4} sem chao ({100.0*miss/tot:>5.1f} %)")

# ---------------------------------------------------------------------------
sec("4 · O QUE A LENTE VE — raios da camera do app (retrato traseiro)")
# a camera do relato: atras do caminhao, ~12 m, 6 m de altura, olhando p/ -Y
CAM = Vector((0.0, 16.0, 6.5))
AIM = Vector((0.0, -30.0, 1.5))
allobjs = objs
vs2, fs2 = [], []
for o in allobjs:
    off = len(vs2)
    mw = o.matrix_world
    vs2 += [mw @ v.co for v in o.data.vertices]
    for p in o.data.polygons:
        q = list(p.vertices)
        for i in range(1, len(q) - 1):
            fs2.append((off + q[0], off + q[i], off + q[i + 1]))
bvh_all = BVHTree.FromPolygons([tuple(v) for v in vs2], fs2, all_triangles=True)
fwd = (AIM - CAM).normalized()
right = fwd.cross(Vector((0, 0, 1))).normalized()
up = right.cross(fwd).normalized()
FOV = math.radians(38.0)
W, H = 41, 23
sky = 0
faraway = {}
for j in range(H):
    for i in range(W):
        sx = (i / (W - 1) - 0.5) * 2 * math.tan(FOV / 2) * (W / H)
        sy = (0.5 - j / (H - 1)) * 2 * math.tan(FOV / 2)
        d = (fwd + right * sx + up * sy).normalized()
        h = bvh_all.ray_cast(CAM, d, 3000.0)
        if h[0] is None:
            sky += 1
        else:
            faraway[round(h[3] if h[3] is not None else -1)] = 1
print(f"  {W}x{H} raios: {sky} sem batida ({100.0*sky/(W*H):.0f} % ceu/vazio)")
print("  mapa (·=ceu, #=geometria), linha de cima = topo do quadro:")
for j in range(H):
    row = ""
    for i in range(W):
        sx = (i / (W - 1) - 0.5) * 2 * math.tan(FOV / 2) * (W / H)
        sy = (0.5 - j / (H - 1)) * 2 * math.tan(FOV / 2)
        d = (fwd + right * sx + up * sy).normalized()
        h = bvh_all.ray_cast(CAM, d, 3000.0)
        if h[0] is None:
            row += "."
        else:
            dist = (h[0] - CAM).length
            row += "#" if dist < 80 else ("+" if dist < 200 else "-")
    print("   " + row)

# ---------------------------------------------------------------------------
sec("5 · VEGETACAO — quantas arvores ficaram e onde")
for nm in ('Trunk_Oak', 'Trunk_Birch'):
    o = bpy.data.objects.get(nm)
    if not o:
        continue
    print(f"  {nm}: {len(o.data.polygons)} poligonos, {len(o.data.vertices)} verts")
near = [o for o in bpy.data.objects if o.name.startswith('TREE_')]
print(f"  {len(near)} troncos em objeto proprio (TREE_*)")
if near:
    d = sorted(math.hypot(o.matrix_world.translation.x + sum((v.co.x for v in o.data.vertices))/max(1,len(o.data.vertices)),
                          sum((v.co.y for v in o.data.vertices))/max(1,len(o.data.vertices)))
               for o in near)
    print(f"     raio {d[0]:.1f} .. {d[-1]:.1f} m")
for nm in ('Grass_Vegetation_Green', 'Grass_Vegetation_Dry', 'Forest_Bush',
           'Fallen_Generic_Leaves', 'Fallen_Maple_Leaves', 'Rock_Decal',
           'Broken_Rocks'):
    o = bpy.data.objects.get(nm)
    if not o or not len(o.data.polygons):
        print(f"  {nm:<26} ausente/vazio")
        continue
    C = np.array([[(o.matrix_world @ p.center).x, (o.matrix_world @ p.center).y]
                  for p in o.data.polygons])
    r = np.hypot(C[:, 0], C[:, 1])
    print(f"  {nm:<26} {len(C):>6} faces, raio {r.min():>6.1f}..{r.max():<7.1f} "
          f"(mediana {np.median(r):.1f})")

print("\nfim", flush=True)
