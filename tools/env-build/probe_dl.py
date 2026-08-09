# Contact sheet for the four downloaded packs.
#
#   blender -b -P probe_dl.py
#
# WHY THIS EXISTS. None of the four packs ships an .mtl or a single `usemtl`
# line, exactly like the IBC1 package — so nothing on disk says which PNG
# belongs to which mesh. ibc1.py's header records what guessing costs: two whole
# builds came out "tudo de metal oxidado" because the binding was assumed.
#
# The packs also disagree about units and about which axis is up. Measured off
# the raw OBJ:
#
#   ibp/*        685..3444 units, footprint >> height          -> cm, Z-up
#   midcentury   99.1 x 11.3 x 93.6, ymin -0.28                -> m,  Y-up
#   device       185.8 x 327.3 x 142.5                         -> cm, ambiguous
#   trash        1.7 x 3.5 x 0.9                               -> m,  ambiguous
#
# So this renders every model against its candidate texture, from a fixed
# three-quarter camera with a 2 m scale cube beside it. One look settles
# identity, scale, up-axis and the texture pairing at once.
import bpy
import os
import glob
import math
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "_src_dl")
OUT = os.path.join(HERE, "_shots_dl")

# (pack, model index, candidate basecolor, up axis, unit scale)
#
# The ibp pairing is ZIP ORDER — the archive lists its seven PNGs and then its
# seven OBJs, and pairing them in order is corroborated by geometry:
# model_2 (34.4 x 21.8) and model_3 (34.1 x 18.3) share a footprint, which is
# what a building and its separate "Details" mesh look like, and they land on
# suburbanFireDept / suburbanFireDeptDetails.
CASES = [
    ("ibp", 0, "secuirityBooth.tga.png",          "Z", 0.01),
    ("ibp", 1, "smallWarehouse.tga.png",          "Z", 0.01),
    ("ibp", 2, "suburbanFireDept.tga.png",        "Z", 0.01),
    ("ibp", 3, "suburbanFireDeptDetails.tga.png", "Z", 0.01),
    ("ibp", 4, "oldWarehouse_clean.tga.png",      "Z", 0.01),
    ("ibp", 5, "temporaryOffice.tga.png",         "Z", 0.01),
    ("ibp", 6, "warehouse.tga.png",               "Z", 0.01),
    ("midcentury", 0, "IndustrialGeneric1D.png",  "Y", 1.0),
    ("device", 0, "device23_basecolor.png",       "Y", 0.01),
    ("device", 0, "device23_basecolor.png",       "Z", 0.01),
    ("trash", 0, "d3_albedo2.tga.png",            "Y", 1.0),
    ("trash", 0, "d3_albedo2.tga.png",            "Z", 1.0),
]


def log(m):
    print("[probe] " + m, flush=True)


def scale_cube():
    """A 2 m cube on the origin. Without it a render says nothing about size —
    every model fills the frame because the camera is framed to it."""
    bpy.ops.mesh.primitive_cube_add(size=2.0, location=(0, 0, 1.0))
    c = bpy.context.active_object
    m = bpy.data.materials.new("scale")
    m.use_nodes = True
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.8, 0.1, 0.1, 1)
    c.data.materials.append(m)
    return c


def setup_world():
    w = bpy.data.worlds.new("w")
    bpy.context.scene.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.35, 0.4, 0.48, 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.4
    bpy.ops.object.light_add(type="SUN", location=(20, -20, 40))
    bpy.context.active_object.data.energy = 3.0
    bpy.context.active_object.rotation_euler = (math.radians(52), 0, math.radians(35))


def frame(ob, cam, sz):
    """Three-quarter view from the south-east, framed on the model's own size."""
    r = max(sz) * 0.85 + 4.0
    cam.location = Vector((r * 1.25, -r * 1.35, r * 0.72 + 3.0))
    d = Vector((0, 0, max(1.0, sz[2] * 0.42))) - cam.location
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def run(pack, idx, tex, up, unit, out_png):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    setup_world()
    path = os.path.join(SRC, pack, "model_%d.obj" % idx)
    if not os.path.exists(path):
        log("missing %s" % path)
        return
    before = set(bpy.data.objects)
    # forward/up pair has to be consistent: the importer rejects a forward that
    # is the same axis as up.
    if up == "Y":
        bpy.ops.wm.obj_import(filepath=path, forward_axis="NEGATIVE_Z", up_axis="Y")
    else:
        bpy.ops.wm.obj_import(filepath=path, forward_axis="Y", up_axis="Z")
    fresh = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    if not fresh:
        log("%s/model_%d imported nothing" % (pack, idx))
        return
    for o in bpy.data.objects:
        o.select_set(o in fresh)
    bpy.context.view_layer.objects.active = fresh[0]
    if len(fresh) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    ob.data.transform(Matrix.Scale(unit, 4))

    # STRAIGHT OFF THE VERTICES, not ob.bound_box. bound_box is a cache the
    # depsgraph refreshes; reading it right after `ob.data.transform(...)`
    # returns the PRE-scale box, which is how the first probe run reported a
    # security booth as 685 x 746 m.
    vs = ob.data.vertices
    lo = Vector((min(v.co.x for v in vs), min(v.co.y for v in vs), min(v.co.z for v in vs)))
    hi = Vector((max(v.co.x for v in vs), max(v.co.y for v in vs), max(v.co.z for v in vs)))
    # centre on the footprint and drop the lowest point to z=0, so the scale
    # cube beside it is an honest comparison
    ob.data.transform(Matrix.Translation(
        Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))))
    ob.data.update()
    sz = (hi.x - lo.x, hi.y - lo.y, hi.z - lo.z)

    m = bpy.data.materials.new("probe")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.85
    tp = os.path.join(SRC, pack, tex)
    if os.path.exists(tp):
        t = m.node_tree.nodes.new("ShaderNodeTexImage")
        t.image = bpy.data.images.load(tp, check_existing=True)
        m.node_tree.links.new(b.inputs["Base Color"], t.outputs["Color"])
    else:
        log("  texture missing: %s" % tex)
    ob.data.materials.clear()
    ob.data.materials.append(m)

    scale_cube()
    cam_d = bpy.data.cameras.new("c")
    cam = bpy.data.objects.new("c", cam_d)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    frame(ob, cam, sz)

    sc = bpy.context.scene
    # Blender has renamed this enum in both directions across releases
    # (EEVEE -> EEVEE_NEXT -> EEVEE), so probe it rather than assume.
    for eng in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT", "BLENDER_WORKBENCH"):
        try:
            sc.render.engine = eng
            break
        except TypeError:
            continue
    sc.render.resolution_x = 520
    sc.render.resolution_y = 380
    sc.render.filepath = out_png
    sc.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    log("%-11s model_%d  up=%s  %6.1f x %6.1f x %6.1f m  <- %s"
        % (pack, idx, up, sz[0], sz[1], sz[2], tex))


def main():
    os.makedirs(OUT, exist_ok=True)
    for n, (pack, idx, tex, up, unit) in enumerate(CASES):
        run(pack, idx, tex, up, unit,
            os.path.join(OUT, "%02d_%s_%d_%s.png" % (n, pack, idx, up)))
    log("done -> %s" % OUT)


main()
