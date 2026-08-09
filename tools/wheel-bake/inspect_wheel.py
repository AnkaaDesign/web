"""Mapeia as RODAS do FH16 agrupando faces por posição, não por casca conexa.

O rip entrega cada malha de roda mesclada por MATERIAL e sem solda: separar por
partes soltas devolve 5409 cacos. Mas uma roda é um sólido de revolução em torno
do eixo LATERAL, então ela é identificada por um par (x do eixo, y longitudinal)
— e é por aí que se agrupa.

Eixos: o importador glTF converte Y-up → Z-up, então
    Blender X = glTF X  (lateral, eixo da roda)
    Blender Y = -glTF Z (longitudinal)
    Blender Z = glTF Y  (vertical)
"""
import bpy
import sys
from collections import defaultdict

argv = sys.argv[sys.argv.index('--') + 1:]
SRC = argv[0]
GRID = 0.25          # célula de agrupamento, em metros

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

for o in [o for o in bpy.data.objects if o.type == 'MESH']:
    if not o.name.startswith('wheel_'):
        continue
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    cells = defaultdict(lambda: [0, [1e9] * 3, [-1e9] * 3])
    me = o.data
    for p in me.polygons:
        c = p.center
        key = (round(c.x / GRID), round(c.y / GRID))
        e = cells[key]
        e[0] += 1
        for k in range(3):
            e[1][k] = min(e[1][k], c[k])
            e[2][k] = max(e[2][k], c[k])

    # funde células vizinhas: uma roda é maior que a grade
    merged = []
    for key, (n, lo, hi) in sorted(cells.items()):
        hit = None
        for m in merged:
            if abs(m['cx'] - (lo[0] + hi[0]) / 2) < 0.45 \
               and abs(m['cy'] - (lo[1] + hi[1]) / 2) < 0.70:
                hit = m
                break
        if hit is None:
            merged.append({'n': n, 'lo': list(lo), 'hi': list(hi),
                           'cx': (lo[0] + hi[0]) / 2, 'cy': (lo[1] + hi[1]) / 2})
        else:
            hit['n'] += n
            for k in range(3):
                hit['lo'][k] = min(hit['lo'][k], lo[k])
                hit['hi'][k] = max(hit['hi'][k], hi[k])
            hit['cx'] = (hit['lo'][0] + hit['hi'][0]) / 2
            hit['cy'] = (hit['lo'][1] + hit['hi'][1]) / 2

    print(f'\n== {o.name}  ({len(me.polygons)} faces, {len(me.vertices)} verts)')
    for m in sorted(merged, key=lambda m: (-m['n'])):
        lo, hi = m['lo'], m['hi']
        print(f"   faces {m['n']:6d}  centro "
              f"({(lo[0]+hi[0])/2:7.3f},{(lo[1]+hi[1])/2:7.3f},{(lo[2]+hi[2])/2:7.3f})  "
              f"dim ({hi[0]-lo[0]:6.3f},{hi[1]-lo[1]:6.3f},{hi[2]-lo[2]:6.3f})")
