# Segunda passagem: por asset, quantas PECAS SOLTAS ele tem, se o material usa
# alfa (folhagem em cartao) e como cada peca se mede. E o que decide se a peca
# pode ser decimada (rocha) ou se a reducao tem de ser POR ILHA (cartao de
# folha vira pasta no decimador — ver lod_canopy em build_serra.py).
#
#   blender -b -P probe_ph2.py
import bpy
import bmesh
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "_src_ph")


def loose_parts(me):
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    seen = set()
    parts = []
    for v in bm.verts:
        if v.index in seen:
            continue
        stack = [v]
        seen.add(v.index)
        comp = [v.index]
        while stack:
            w = stack.pop()
            for e in w.link_edges:
                o = e.other_vert(w)
                if o.index not in seen:
                    seen.add(o.index)
                    comp.append(o.index)
                    stack.append(o)
        parts.append(comp)
    bm.free()
    return parts


for name in sorted(os.listdir(SRC)):
    d = os.path.join(SRC, name)
    if not os.path.isdir(d):
        continue
    gltf = [f for f in os.listdir(d) if f.endswith(".gltf")]
    if not gltf:
        continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(d, gltf[0]))
    alpha = []
    for m in bpy.data.materials:
        if not m.users or not m.node_tree:
            continue
        b = next((x for x in m.node_tree.nodes if x.type == 'BSDF_PRINCIPLED'), None)
        a = "opaco"
        if b and b.inputs['Alpha'].links:
            a = "ALFA"
        alpha.append(f"{m.name}:{a}")
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    tot = 0
    detail = []
    for o in meshes:
        o.data.calc_loop_triangles()
        n = len(o.data.loop_triangles)
        tot += n
        parts = loose_parts(o.data)
        sizes = sorted((len(p) for p in parts), reverse=True)
        detail.append(f"{o.name}({n}t,{len(parts)}pecas,maior={sizes[0] if sizes else 0}v)")
    print(f"\n{name}: {tot} tris, {len(meshes)} objetos | {' '.join(alpha)}")
    for x in detail[:8]:
        print("     " + x)
    if len(detail) > 8:
        print(f"     ... +{len(detail)-8} objetos")
