# Mede cada asset do Poly Haven baixado em _src_ph: triangulos, tamanho real e
# quantas imagens ele traz. Sem isto o orcamento de poligonos e chute.
#
#   blender -b -P probe_ph.py
import bpy
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "_src_ph")

rows = []
for name in sorted(os.listdir(SRC)):
    d = os.path.join(SRC, name)
    if not os.path.isdir(d):
        continue
    gltf = [f for f in os.listdir(d) if f.endswith(".gltf") or f.endswith(".glb")]
    if not gltf:
        rows.append((name, 0, 0, 0, 0, 0, 0, "sem gltf"))
        continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    try:
        bpy.ops.import_scene.gltf(filepath=os.path.join(d, gltf[0]))
    except Exception as e:
        rows.append((name, 0, 0, 0, 0, 0, 0, f"falhou: {e}"))
        continue
    tris = 0
    lo = [1e9] * 3
    hi = [-1e9] * 3
    for o in bpy.data.objects:
        if o.type != 'MESH':
            continue
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
        for v in o.data.vertices:
            p = o.matrix_world @ v.co
            for i in range(3):
                lo[i] = min(lo[i], p[i]); hi[i] = max(hi[i], p[i])
    img = 0
    px = 0
    for im in bpy.data.images:
        if im.size[0]:
            img += 1
            px = max(px, max(im.size))
    mats = len([m for m in bpy.data.materials if m.users])
    rows.append((name, tris, hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], img, px,
                 f"{mats} mat"))

print("\n" + "=" * 100)
print(f"{'asset':<26}{'tris':>8}{'dx':>7}{'dy':>7}{'dz':>7}{'img':>5}{'px':>6}  obs")
print("=" * 100)
for r in sorted(rows, key=lambda x: -x[1]):
    print(f"{r[0]:<26}{r[1]:>8}{r[2]:>7.2f}{r[3]:>7.2f}{r[4]:>7.2f}{r[5]:>5}{r[6]:>6}  {r[7]}")
print(f"TOTAL {sum(r[1] for r in rows)} triangulos em {len(rows)} assets")
