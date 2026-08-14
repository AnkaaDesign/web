# Le o .glb EXPORTADO e diz o que ele tem, sem Blender no meio.
#
#   python probe_glb.py ../../public/environments/serra/set.glb
#
# Existe porque metade do que decide o comportamento no app so aparece no chunk
# JSON: se `EXT_mesh_gpu_instancing` saiu mesmo, se a folhagem ficou em MASK ou
# em BLEND, e quais materiais existem para o manifesto declarar.
import json
import os
import struct
import sys

p = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "..", "public", "environments", "serra", "set.glb")
data = open(p, "rb").read()
n = struct.unpack("<I", data[12:16])[0]
j = json.loads(data[20:20 + n].decode("utf-8"))

print(f"{os.path.basename(p)}  {len(data)/1e6:.2f} MB")
print("extensoes:", j.get("extensionsUsed"))
print(f"malhas {len(j.get('meshes', []))}  nos {len(j.get('nodes', []))}  "
      f"materiais {len(j.get('materials', []))}  imagens {len(j.get('images', []))}  "
      f"texturas {len(j.get('textures', []))}")

# --- instanciamento
inst_total = 0
print("\nEXT_mesh_gpu_instancing:")
for nd in j.get("nodes", []):
    ext = (nd.get("extensions") or {}).get("EXT_mesh_gpu_instancing")
    if not ext:
        continue
    acc = ext["attributes"].get("TRANSLATION")
    cnt = j["accessors"][acc]["count"] if acc is not None else 0
    mi = nd.get("mesh")
    mesh = j["meshes"][mi] if mi is not None else {}
    prims = mesh.get("primitives", [])
    tris = 0
    for pr in prims:
        a = pr.get("indices")
        if a is not None:
            tris += j["accessors"][a]["count"] // 3
        elif "POSITION" in pr.get("attributes", {}):
            tris += j["accessors"][pr["attributes"]["POSITION"]]["count"] // 3
    mats = [j["materials"][pr["material"]]["name"] for pr in prims
            if pr.get("material") is not None]
    inst_total += cnt
    print(f"  {mesh.get('name','?'):<28} {cnt:>5} instancias x {tris:>6} tri "
          f"= {cnt*tris:>9}  {mats}")
print(f"  TOTAL {inst_total} instancias")

# --- triangulos: unicos e desenhados
uniq = 0
for m in j.get("meshes", []):
    for pr in m.get("primitives", []):
        a = pr.get("indices")
        if a is not None:
            uniq += j["accessors"][a]["count"] // 3
        elif "POSITION" in pr.get("attributes", {}):
            uniq += j["accessors"][pr["attributes"]["POSITION"]]["count"] // 3

drawn = 0
mesh_tris = []
for m in j.get("meshes", []):
    t = 0
    for pr in m.get("primitives", []):
        a = pr.get("indices")
        if a is not None:
            t += j["accessors"][a]["count"] // 3
        elif "POSITION" in pr.get("attributes", {}):
            t += j["accessors"][pr["attributes"]["POSITION"]]["count"] // 3
    mesh_tris.append(t)
for nd in j.get("nodes", []):
    ext = (nd.get("extensions") or {}).get("EXT_mesh_gpu_instancing")
    mi = nd.get("mesh")
    if mi is None:
        continue
    if ext:
        acc = ext["attributes"].get("TRANSLATION")
        cnt = j["accessors"][acc]["count"] if acc is not None else 1
        drawn += mesh_tris[mi] * cnt
    else:
        drawn += mesh_tris[mi]
print(f"\ntriangulos: {uniq} unicos, {drawn} desenhados por quadro")

# --- draw calls: uma primitiva por no com malha
calls = 0
for nd in j.get("nodes", []):
    mi = nd.get("mesh")
    if mi is not None:
        calls += len(j["meshes"][mi].get("primitives", []))
print(f"draw calls (primitivas com no): {calls}")

# --- materiais e alpha
print("\nmateriais:")
for m in j.get("materials", []):
    am = m.get("alphaMode", "OPAQUE")
    cut = m.get("alphaCutoff", "")
    ds = m.get("doubleSided", False)
    tex = "tex" if (m.get("pbrMetallicRoughness", {}).get("baseColorTexture")) else "—"
    print(f"  {m['name']:<30} {am:<7} {str(cut):<5} {'2face' if ds else '1face':<6} {tex}")

# --- imagens
tot = 0
print("\nimagens (as maiores):")
imgs = []
for im in j.get("images", []):
    bv = im.get("bufferView")
    sz = j["bufferViews"][bv]["byteLength"] if bv is not None else 0
    tot += sz
    imgs.append((sz, im.get("name", "?"), im.get("mimeType", "")))
imgs.sort(reverse=True)
for sz, nm, mt in imgs[:14]:
    print(f"  {sz/1024:>8.0f} KB  {nm}  {mt}")
print(f"  soma {tot/1e6:.2f} MB de imagem em {len(imgs)} arquivos")
