"""Confere a colocação de `swapTrailerWheels()` sem abrir o navegador.

Repete, em Python, a mesma conta do engine — medida POR VÉRTICE, agrupamento de
rodado duplo, escala pelo diâmetro, recuo do cubo pelo avanço do pneu do molde —
e compara a caixa do pneu NOVO com a do pneu ORIGINAL que ele substitui. Se a
matemática estiver certa, as duas coincidem dentro do erro de quantização do
Draco.

Coordenadas: tudo é convertido de volta para o referencial glTF (Y-up), que é o
que o engine enxerga:  glTF (x, y, z) = Blender (x, z, -y).
"""
import bpy
import sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
TRAILER, WHEEL = argv[0], argv[1]

AXLE_BAND = 0.10


def gltf(v):
    return Vector((v.x, v.z, -v.y))


def load(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o.type == 'MESH']


def world_box(o):
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for v in o.data.vertices:
        w = gltf(o.matrix_world @ v.co)
        for k in range(3):
            lo[k] = min(lo[k], w[k])
            hi[k] = max(hi[k], w[k])
    return lo, hi


def mat_name(o):
    return o.data.materials[0].name if o.data.materials else ''


# ---- 1. o molde: até onde o pneu avança para fora do cubo (Ø = 1) ----
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=WHEEL)
reach = {}
for o in [o for o in bpy.data.objects if o.type == 'MESH']:
    # O importador do Blender funde as primitivas de um nó num objeto com vários
    # SLOTS de material; o GLTFLoader do three cria um Mesh por primitiva. Aqui
    # a peça do pneu sai pelo slot, que é o equivalente do lado de cá.
    slots = [i for i, m in enumerate(o.data.materials)
             if m and m.name.startswith('pneu-fh16')]
    if not slots:
        continue
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for p in o.data.polygons:
        if p.material_index not in slots:
            continue
        for vi in p.vertices:
            w = gltf(o.matrix_world @ o.data.vertices[vi].co)
            for k in range(3):
                lo[k] = min(lo[k], w[k])
                hi[k] = max(hi[k], w[k])
    tag = o.name.split('.')[0]
    reach[tag] = (hi.x, lo.x)
    print(f'[molde] {tag}: pneu x {lo.x:+.4f} .. {hi.x:+.4f} '
          f'(largura {hi.x - lo.x:.4f}, Ø {hi.y - lo.y:.4f})')

# ---- 2. o implemento: mede e agrupa ----
objs = load(TRAILER)
tyres = []
for o in objs:
    if mat_name(o) != 'pneu-corpo':
        continue
    lo, hi = world_box(o)
    d = [hi[k] - lo[k] for k in range(3)]
    axis = min(range(3), key=lambda k: d[k])
    radial = [k for k in range(3) if k != axis]
    tyres.append({
        'name': o.name, 'lo': lo, 'hi': hi, 'axis': axis,
        'centre': (lo + hi) / 2,
        'diameter': (d[radial[0]] + d[radial[1]]) / 2,
    })
print(f'\n[implemento] {len(tyres)} pneus medidos')

groups = []
for w in tyres:
    side = 1 if w['centre'].x >= 0 else -1
    hit = None
    for g in groups:
        if g[0]['axis'] == w['axis'] \
           and abs(g[0]['centre'].z - w['centre'].z) < AXLE_BAND \
           and (1 if g[0]['centre'].x >= 0 else -1) == side:
            hit = g
            break
    if hit is None:
        groups.append([w])
    else:
        hit.append(w)

print(f'[implemento] {len(groups)} conjuntos '
      f'({sum(1 for g in groups if len(g) >= 2)} duplos, '
      f'{sum(1 for g in groups if len(g) < 2)} avulsos)\n')

# ---- 3. coloca e confere ----
worst = 0.0
for g in sorted(groups, key=lambda g: (g[0]['axis'], g[0]['centre'].z, g[0]['centre'].x)):
    axis = g[0]['axis']
    tag = 'WHEEL_DUAL' if len(g) >= 2 else 'WHEEL_SINGLE'
    out_hi, out_lo = reach[tag]

    lo = Vector([min(w["lo"][k] for w in g) for k in range(3)])
    hi = Vector([max(w["hi"][k] for w in g) for k in range(3)])
    diameter = sum(w['diameter'] for w in g) / len(g)
    sign = (1 if (lo[axis] + hi[axis]) / 2 >= 0 else -1) if axis == 0 else -1

    # origem do conjunto no eixo axial, e onde as faces do pneu novo caem
    face = hi[axis] if sign > 0 else lo[axis]
    origin = face - sign * out_hi * diameter
    new_face = origin + sign * out_hi * diameter
    new_back = origin + sign * out_lo * diameter
    new_lo, new_hi = min(new_face, new_back), max(new_face, new_back)

    err_out = abs(new_face - face)
    err_in = abs(new_back - (lo[axis] if sign > 0 else hi[axis]))
    worst = max(worst, err_out, err_in)
    print(f'{tag:<13} eixo {"xyz"[axis]} z={(lo.z + hi.z) / 2:+7.3f} '
          f'lado {sign:+d} | original [{lo[axis]:+7.4f},{hi[axis]:+7.4f}] '
          f'novo [{new_lo:+7.4f},{new_hi:+7.4f}] '
          f'| Ø {diameter:.4f} · erro face {err_out * 1000:5.1f} mm '
          f'/ fundo {err_in * 1000:5.1f} mm')

print(f'\npior desvio: {worst * 1000:.1f} mm')
