# Preview renders of the EXPORTED armazem set.glb.
#
#   blender -b -P shot_armazem.py
#
# Reads the .glb rather than the live build scene on purpose: this is the file
# the app loads, so anything the exporter drops or re-orients shows up here and
# nowhere else. A 19 x 2.6 x 4.0 m box stands at the origin as the rig, which
# is the only object in the frame whose size everyone already knows.
#
# Cycles on the CPU. EEVEE Next needs a GL context and in `-b` on this machine
# it writes an empty directory with no error at all.
import bpy, os, sys, math
from mathutils import Vector

GLB = r"C:\Users\Kennedy\Documents\repositories\web\public\environments\armazem\set.glb"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_shots_armazem")
os.makedirs(OUT, exist_ok=True)


def log(m):
    print("[shot] " + str(m)); sys.stdout.flush()


bpy.ops.wm.read_factory_settings(use_empty=True)
log("importing %.0f MB …" % (os.path.getsize(GLB) / 1e6))
bpy.ops.import_scene.gltf(filepath=GLB)

meshes = [o for o in bpy.data.objects if o.type == "MESH"]
lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
for o in meshes:
    o.data.calc_loop_triangles()
    for v in o.data.vertices:
        p = o.matrix_world @ v.co
        for i in range(3):
            lo[i] = min(lo[i], p[i]); hi[i] = max(hi[i], p[i])
log("%d objects, bounds x %.1f..%.1f  y %.1f..%.1f  z %.1f..%.1f"
    % (len(meshes), lo.x, hi.x, lo.y, hi.y, lo.z, hi.z))

# ---------------------------------------------------------------------------
# EMULATE WHAT THE ENGINE DOES TO THE FLOOR, or this preview lies.
#
# `GROUND_CONCRETE` is a reserved name: engine/scene/set.ts throws away whatever
# is bound to it and re-textures it from /textures/concrete_* with the manifest's
# repeat and tintRgb. So the shipped .glb carries a flat 0.42 grey there — and
# rendering THAT is what made every preview show a blown-out white sheet and
# hid the fact that the wear field was fine.
#
# Two things have to be reproduced for the render to mean anything:
#   1. the concrete PBR set at repeat 1 over UVs authored in metres/8;
#   2. COLOR_0 multiplied into the albedo. Blender's glTF importer brings the
#      attribute in but does NOT wire it, so without this the floor renders
#      identically whether the wear survived the bake or not.
TEXDIR = r"C:\Users\Kennedy\Documents\repositories\web\public\textures"


def dress_floor():
    m = bpy.data.materials.get("GROUND_CONCRETE")
    if not m:
        log("no GROUND_CONCRETE material — floor left flat")
        return
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    for n in list(nt.nodes):
        if n.type in ("TEX_IMAGE", "VERTEX_COLOR", "MIX_RGB", "MIX"):
            nt.nodes.remove(n)

    def img(fn, non_color=False):
        p = os.path.join(TEXDIR, fn)
        if not os.path.exists(p):
            log("  missing %s" % fn)
            return None
        i = bpy.data.images.load(p, check_existing=True)
        if non_color:
            i.colorspace_settings.name = "Non-Color"
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = i
        return t

    diff = img("concrete_diff.webp")
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Color"
    tint = nt.nodes.new("ShaderNodeRGB")
    tint.outputs[0].default_value = (0.56, 0.555, 0.54, 1)   # manifest tintRgb
    m1 = nt.nodes.new("ShaderNodeMixRGB"); m1.blend_type = "MULTIPLY"
    m1.inputs["Fac"].default_value = 1.0
    m2 = nt.nodes.new("ShaderNodeMixRGB"); m2.blend_type = "MULTIPLY"
    m2.inputs["Fac"].default_value = 1.0
    if diff:
        nt.links.new(m1.inputs["Color1"], diff.outputs["Color"])
    else:
        m1.inputs["Color1"].default_value = (0.5, 0.5, 0.49, 1)
    nt.links.new(m1.inputs["Color2"], tint.outputs[0])
    nt.links.new(m2.inputs["Color1"], m1.outputs["Color"])
    nt.links.new(m2.inputs["Color2"], vc.outputs["Color"])
    nt.links.new(b.inputs["Base Color"], m2.outputs["Color"])
    r = img("concrete_rough.webp", True)
    if r:
        nt.links.new(b.inputs["Roughness"], r.outputs["Color"])
    n = img("concrete_nor.jpg", True)
    if n:
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = 1.4
        nt.links.new(nm.inputs["Color"], n.outputs["Color"])
        nt.links.new(b.inputs["Normal"], nm.outputs["Normal"])
    log("floor dressed with the engine's concrete set + COLOR_0")


dress_floor()

# the rig stand-in: 19 m long, 2.6 m wide, 4.0 m tall, length along the aisle.
# In glTF/three the vehicle runs along Z, and Blender's importer maps that back
# to -Y, so the box is built along Y here.
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 2.0))
rig = bpy.context.object
rig.scale = (1.3, 9.5, 2.0)
rig.name = "RIG"
rm = bpy.data.materials.new("rig"); rm.use_nodes = True
rm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.86, 0.52, 0.05, 1)
rm.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.35
rig.data.materials.append(rm)

# No HDRI — this scene ships `hdri: null`, so the only light is the shell's own
# emissive strips. A near-black world is the honest test of that.
w = bpy.data.worlds.new("W"); bpy.context.scene.world = w
w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.04, 0.045, 0.055, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 1.0

sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = 20
sc.cycles.use_denoising = True
sc.view_settings.view_transform = "AgX"
sc.render.resolution_x = 1120
sc.render.resolution_y = 630


def shot(name, loc, target, lens=32):
    cd = bpy.data.cameras.new(name); cd.lens = lens
    cam = bpy.data.objects.new(name, cd)
    bpy.context.collection.objects.link(cam)
    cam.location = Vector(loc)
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam
    sc.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)
    log("shot " + name)


# EVERY CAMERA STAYS IN THE AISLE. The rack runs stand on x = +-11.6 with
# 1.10 m frames, so the clear span is about +-11.0 and anything beyond that is
# a camera inside the steel — which is what the first pass did at x = 14, and
# the "wide" shot at x = 22 was outside the building altogether, looking at an
# unlit roof.
shot("a_three_quarter", (13.0, -30.0, 5.2), (0.0, -8.0, 2.4), lens=35)
shot("b_down_aisle", (5.0, -46.0, 3.4), (0.0, 16.0, 3.4), lens=28)
shot("c_flank", (15.0, 5.0, 3.0), (0.0, 1.0, 2.2), lens=40)
shot("d_wide", (18.0, -52.0, 11.0), (0.0, -8.0, 3.5), lens=24)
log("done")
