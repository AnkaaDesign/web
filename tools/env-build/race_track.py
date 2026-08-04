# Nicholas3D "02- Industrial.Race.Track" — the SECOND industrial pack.
#
# WHY IT IS HERE. Vol.1 carries 200 k of its 218 k triangles on a single
# material ("Container"), one rusted metal atlas. No layout or tint fixes that:
# every structure is literally the same surface, which is what "todas as
# construções têm a mesma textura de metal enferrujado" is seeing. This pack
# brings MetalTrim, MetalTrim2 and ConcreteLeaks — genuinely different sets —
# and is the only real source of material variety available.
#
# ITS glTF LOST THE TEXTURE BINDINGS (images: 0), so they are recovered by
# texture_infer, whose rule reproduces all 15 of Vol.1's known bindings exactly.
import bpy
import os
import importlib.util

SRC = (r"C:\Users\Kennedy\Downloads\3D Ripper Pro\Downloads\Nicholas3D"
       r"\02- Industrial.Race.Track")

# Materials that are backdrop, not architecture. "HDRI" is a 440-triangle
# sphere wearing an overcast sky; it would sit inside our own sky and horizon
# haze. "Water" is 10 triangles of nothing.
DROP_MATERIALS = {"HDRI", "Water"}


def _load_infer():
    here = os.path.dirname(os.path.abspath(__file__))
    spec = importlib.util.spec_from_file_location(
        "texture_infer", os.path.join(here, "texture_infer.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _hook(nt, bsdf, path, socket, non_color, normal=False):
    if not path or not os.path.exists(path):
        return False
    img = bpy.data.images.load(path, check_existing=True)
    if non_color:
        img.colorspace_settings.name = "Non-Color"
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    if normal:
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(nm.inputs["Color"], tex.outputs["Color"])
        nt.links.new(bsdf.inputs["Normal"], nm.outputs["Normal"])
    else:
        nt.links.new(bsdf.inputs[socket], tex.outputs["Color"])
    return True


def import_textured(log):
    """Import the pack, bind inferred textures, drop the backdrop.

    @returns list of root objects, ready for the caller to place.
    """
    gl = None
    for f in sorted(os.listdir(SRC)):
        if f.endswith(".gltf"):
            gl = os.path.join(SRC, f)
            break
    if gl is None:
        log("  race track: no .gltf in " + SRC)
        return []

    ti = _load_infer()
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=gl)
    fresh = [o for o in bpy.data.objects if o not in before]

    mats = {sl.material for o in fresh if o.type == "MESH"
            for sl in o.material_slots if sl.material}
    maps = ti.infer(SRC, [m.name for m in mats])

    bound = 0
    for m in mats:
        d = maps.get(m.name) or {}
        if not m.use_nodes:
            m.use_nodes = True
        nt = m.node_tree
        bsdf = nt.nodes.get("Principled BSDF")
        if not bsdf:
            continue
        if _hook(nt, bsdf, d.get("base"), "Base Color", False):
            bound += 1
        _hook(nt, bsdf, d.get("rough"), "Roughness", True)
        _hook(nt, bsdf, d.get("metal"), "Metallic", True)
        _hook(nt, bsdf, d.get("normal"), None, True, normal=True)
        if d.get("directx"):
            # glTF expects OpenGL normals (green +Y). The single DirectX map in
            # this pack lands on a 1-triangle material, so it is reported
            # rather than corrected — but the flag is why it is not silent.
            log("  race track NOTE: %s ships a DirectX normal map" % m.name)

    # Names are taken BEFORE any removal. bpy.data.objects.remove() invalidates
    # the Python wrapper, so touching `o.name` on a deleted object afterwards
    # raises "StructRNA of type Object has been removed" — reading the survivors
    # by name is the only safe way back.
    fresh_names = [o.name for o in fresh]
    killed = 0
    for name in list(fresh_names):
        o = bpy.data.objects.get(name)
        if o is None or o.type != "MESH":
            continue
        mnames = {sl.material.name for sl in o.material_slots if sl.material}
        if mnames & DROP_MATERIALS:
            bpy.data.objects.remove(o, do_unlink=True)
            fresh_names.remove(name)
            killed += 1

    fresh = [bpy.data.objects[n] for n in fresh_names if n in bpy.data.objects]
    roots = [o for o in fresh if o.parent is None]
    # The importer wraps everything in a scene root; descend to the real groups.
    if len(roots) == 1 and roots[0].children:
        roots = list(roots[0].children)
        if len(roots) == 1 and roots[0].children:
            roots = list(roots[0].children)

    log("  race track: %d/%d materials textured, %d backdrop meshes dropped, "
        "%d groups available" % (bound, len(mats), killed, len(roots)))
    return roots
