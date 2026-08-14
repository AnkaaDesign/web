# Qual das duas direcoes do corredor e a que o relato fotografou?
#
#   blender -b -P audit_view.py
#
# Lanca os raios da lente do app nas DUAS direcoes (+Y e -Y do Blender) e
# imprime, por pixel, a INICIAL do objeto atingido. Nada de deducao de eixo:
# quem aparece a esquerda e a direita de cada quadro sai medido.
import bpy
import math
import os

from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(HERE, "_work_serra")
bpy.ops.wm.open_mainfile(filepath=os.path.join(WORK, os.environ.get("SERRA_FILE","05_veg.blend")))

objs = [o for o in bpy.data.objects if o.type == 'MESH' and len(o.data.polygons)]

# codigo de UMA letra por familia, para o mapa caber
CODE = [
    ('GUARDRAIL', 'G'), ('ROAD_PAVEMENT', 'A'), ('ROAD_MARK', '='), ('ROAD_STUD', '='),
    ('ROAD_VERGE', 'v'), ('BATTER_L', 'L'), ('BATTER_R', 'R'),
    ('Trunk_', 't'), ('TREE_', 't'), ('Background_Tree_Atlas', 'f'),
    ('Sloped_Rock', 'r'), ('Tall_Cliff', 'c'), ('Broken_Rocks', 'b'),
    ('Dirt_Road', 'd'), ('Road_Edge_Gravel', 'd'), ('Cobblestone', 'k'),
    ('Wood_Fence', 'F'), ('Metal_Fence', 'F'), ('Wood_Log', 'w'),
    ('LAND_APRON', '-'), ('FOREST_FAR', 'F'), ('MUDA', 'y'),
    ('PH_tufo', ':'), ('PH_fern', ';'), ('PH_mata', 'a'), ('PH_moita', 'a'),
    ('PH_rmusgo', 'o'), ('PH_matacao', 'O'), ('PH_aflora', 'X'),
    ('PH_musgo', '`'), ('PH_toco', 'T'), ('PH_raiz', 'Y'), ('PH_galho', '/'),
    ('PH_muda', 'y'), ('PROTO_', '?'), ('ROAD_DELINEATOR', 'i'),
    ('FOREST_FLOOR_PATCH', 'g'),
    ('Terrain_Far', '-'), ('Aerial_Grass', 'g'), ('Grass_Close', 'g'),
    ('Grass_Vegetation', ','), ('Forest_Bush', ','), ('Fallen_', '.'),
    ('Rock_Decal', '.'), ('Ground_Dirt', 'e'), ('Mud_Pile', 'm'),
    ('Puddle', 'p'),
]


def code_of(name):
    for pre, c in CODE:
        if name.startswith(pre):
            return c
    return '?'


tris, owner = [], []
verts = []
for o in objs:
    off = len(verts)
    mw = o.matrix_world
    verts += [mw @ v.co for v in o.data.vertices]
    c = code_of(o.name)
    for p in o.data.polygons:
        vs = list(p.vertices)
        for i in range(1, len(vs) - 1):
            tris.append((off + vs[0], off + vs[i], off + vs[i + 1]))
            owner.append(c)
bvh = BVHTree.FromPolygons([tuple(v) for v in verts], tris, all_triangles=True)
print(f"BVH: {len(tris)} triangulos de {len(objs)} objetos", flush=True)

W, H = 96, 34
FOV = math.radians(40.0)

for tag, camy, aimy in (("olhando para -Y", 18.0, -40.0), ("olhando para +Y", -18.0, 40.0)):
    CAM = Vector((0.0, camy, 7.0))
    AIM = Vector((0.0, aimy, 1.5))
    fwd = (AIM - CAM).normalized()
    right = fwd.cross(Vector((0, 0, 1))).normalized()   # medido, nao deduzido
    up = right.cross(fwd).normalized()
    print("\n" + "=" * (W + 6))
    print(f"{tag}   camera y={camy:+.0f}  |  'right' do quadro = "
          f"({right.x:+.2f}, {right.y:+.2f}, {right.z:+.2f})")
    print("=" * (W + 6))
    sky = 0
    for j in range(H):
        row = ""
        for i in range(W):
            sx = (i / (W - 1) - 0.5) * 2 * math.tan(FOV / 2) * (W / H) * 0.5
            sy = (0.5 - j / (H - 1)) * 2 * math.tan(FOV / 2)
            d = (fwd + right * sx + up * sy).normalized()
            h = bvh.ray_cast(CAM, d, 4000.0)
            if h[0] is None:
                row += " "
                sky += 1
            else:
                row += owner[h[2]]
        print("  " + row)
    print(f"  ceu/vazio: {sky}/{W*H} = {100.0*sky/(W*H):.0f} %")
    # de que lado o guarda-corpo aparece
    for half, rng in (("metade ESQUERDA", range(0, W // 2)), ("metade DIREITA", range(W // 2, W))):
        cnt = {}
        for j in range(H):
            for i in rng:
                sx = (i / (W - 1) - 0.5) * 2 * math.tan(FOV / 2) * (W / H) * 0.5
                sy = (0.5 - j / (H - 1)) * 2 * math.tan(FOV / 2)
                d = (fwd + right * sx + up * sy).normalized()
                h = bvh.ray_cast(CAM, d, 4000.0)
                if h[0] is not None:
                    cnt[owner[h[2]]] = cnt.get(owner[h[2]], 0) + 1
        top = sorted(cnt.items(), key=lambda x: -x[1])[:6]
        print(f"    {half}: " + "  ".join(f"{k}={v}" for k, v in top))

print("\nLEGENDA  G=defensa A=asfalto v=banqueta L/R=talude t=tronco f=copa "
      "r=Sloped_Rock c=Tall_Cliff b=Broken_Rocks d=estrada de chao k=Cobblestone "
      "F=cerca w=tora -=Terrain_Far g=grama ,=tufo .=folhas/decalque e=Ground_Dirt "
      "m=Mud_Pile p=poca")
