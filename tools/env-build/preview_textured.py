# Render set.glb THE WAY THE APP RENDERS IT.
#
# WHY THIS EXISTS. preview.py renders the raw .glb, whose ground materials are
# deliberately textureless — they are named slots the engine binds at runtime
# from environments.json. So every ground judgement made from preview.py was
# made on flat grey placeholders: the tiling, the vertex-colour field, the
# contrast between concrete and dirt, the normal-map relief at grazing angles —
# none of it was on screen. Shipping a ground and asking someone else whether it
# looked right was the direct consequence.
#
# This reads the SAME manifest the app reads and binds the SAME maps with the
# same repeat and the same linear tint, multiplies COLOR_0 in the way three.js
# does, and renders. What comes out is what the user sees.
#
#   blender -b -P preview_textured.py -- <out.png> [camX camY camZ tgtX tgtY tgtZ]
import bpy
import bmesh
import json
import math
import os
import sys
from mathutils import Vector, Matrix

REPO = r"C:\Users\Kennedy\Documents\repositories\web"
SET = os.path.join(REPO, r"public\environments\distrito-industrial\set.glb")
MANIFEST = os.path.join(REPO, r"public\environments\environments.json")
PUBLIC = os.path.join(REPO, "public")

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0]
cam = [float(v) for v in argv[1:4]] if len(argv) >= 4 else [46.0, -52.0, 22.0]
tgt = [float(v) for v in argv[4:7]] if len(argv) >= 7 else [0.0, 12.0, 3.0]
proxy_y = float(argv[7]) if len(argv) >= 8 else 6.0
SUN_EL = float(argv[8]) if len(argv) >= 9 else 52.0
SUN_AZ = float(argv[9]) if len(argv) >= 10 else 38.0


def log(m):
    print("[pvt] " + m, flush=True)


def asset(p):
    return os.path.join(PUBLIC, p.lstrip("/").replace("/", os.sep))


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SET)

man = json.load(open(MANIFEST, encoding="utf-8"))
env = [e for e in man["environments"] if e["id"] == "distrito-industrial"][0]
defs = env["set"]["materials"]

_cache = {}


def tex(nt, path, non_color, repeat):
    key = (path, non_color, repeat)
    if key in _cache:
        img = _cache[key]
    else:
        if not os.path.exists(path):
            log("  MISSING texture " + path)
            return None
        img = bpy.data.images.load(path, check_existing=True)
        if non_color:
            img.colorspace_settings.name = "Non-Color"
        _cache[key] = img
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = img
    t.extension = "REPEAT"
    # three.js: uv authored in metres/uv_scale by the build, then multiplied by
    # `repeat`. Mapping node reproduces exactly that.
    mp = nt.nodes.new("ShaderNodeMapping")
    co = nt.nodes.new("ShaderNodeTexCoord")
    mp.inputs["Scale"].default_value = (repeat, repeat, 1.0)
    nt.links.new(mp.inputs["Vector"], co.outputs["UV"])
    nt.links.new(t.inputs["Vector"], mp.outputs["Vector"])
    return t


bound = 0
for mat in bpy.data.materials:
    d = defs.get(mat.name)
    if not d:
        continue
    mat.use_nodes = True
    nt = mat.node_tree
    b = nt.nodes.get("Principled BSDF")
    if not b:
        continue
    rep = float(d.get("repeat", 1) or 1)

    base = tex(nt, asset(d["diffuse"]), False, rep) if d.get("diffuse") else None
    tint = d.get("tintRgb")
    # three.js multiplies map * material.color * COLOR_0. Reproduce both factors.
    src = base.outputs["Color"] if base else None
    if src is not None and tint:
        mx = nt.nodes.new("ShaderNodeMixRGB")
        mx.blend_type = "MULTIPLY"
        mx.inputs["Fac"].default_value = 1.0
        mx.inputs["Color2"].default_value = (tint[0], tint[1], tint[2], 1.0)
        nt.links.new(mx.inputs["Color1"], src)
        src = mx.outputs["Color"]
    elif src is None and tint:
        b.inputs["Base Color"].default_value = (tint[0], tint[1], tint[2], 1.0)

    # THE VERTEX COLOUR, which is the whole point of looking at this render:
    # the build bakes its patchiness into COLOR_0 and glTF/three multiply it
    # into the albedo. Without this node the ground looks uniform here and
    # varied in the app, which is the worst possible way to be wrong.
    if src is not None:
        vc = nt.nodes.new("ShaderNodeVertexColor")
        vc.layer_name = "Col"
        mx2 = nt.nodes.new("ShaderNodeMixRGB")
        mx2.blend_type = "MULTIPLY"
        mx2.inputs["Fac"].default_value = 1.0
        nt.links.new(mx2.inputs["Color1"], src)
        nt.links.new(mx2.inputs["Color2"], vc.outputs["Color"])
        src = mx2.outputs["Color"]
        nt.links.new(b.inputs["Base Color"], src)

    if d.get("rough"):
        t = tex(nt, asset(d["rough"]), True, rep)
        if t:
            nt.links.new(b.inputs["Roughness"], t.outputs["Color"])
    elif "roughness" in d:
        b.inputs["Roughness"].default_value = float(d["roughness"])
    if d.get("normal"):
        t = tex(nt, asset(d["normal"]), True, rep)
        if t:
            nm = nt.nodes.new("ShaderNodeNormalMap")
            nt.links.new(nm.inputs["Color"], t.outputs["Color"])
            nt.links.new(b.inputs["Normal"], nm.outputs["Normal"])
    if "metalness" in d:
        b.inputs["Metallic"].default_value = float(d["metalness"])
    bound += 1
log("bound %d/%d manifest materials" % (bound, len(defs)))

# Building materials came in from the .glb already textured; make sure their
# COLOR_0 (if any) does not wash them out — glTF import handles that itself.

# truck proxy, 2.9 x 19.0 x 4.2 m
me = bpy.data.meshes.new("TRUCK_PROXY")
ob = bpy.data.objects.new("TRUCK_PROXY", me)
bpy.context.collection.objects.link(ob)
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Identity(4))
bmesh.ops.scale(bm, vec=(2.9, 19.0, 4.2), verts=bm.verts)
bmesh.ops.translate(bm, vec=(0.0, proxy_y, 2.1), verts=bm.verts)
bm.to_mesh(me)
bm.free()
pm = bpy.data.materials.new("PROXY")
pm.use_nodes = True
pm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.80, 0.10, 0.08, 1)
me.materials.append(pm)

sc = bpy.context.scene
# CYCLES, not EEVEE. EEVEE Next segfaults headless on this machine once the
# manifest textures are bound (EXCEPTION_ACCESS_VIOLATION during the render
# call), and this render exists to be trusted, so it uses the path that does not
# fall over. It is also the honest one for judging a ground: grazing-angle
# normal-map response and contact shadow are exactly what EEVEE approximates.
sc.render.engine = "CYCLES"
sc.cycles.samples = 48
sc.cycles.use_denoising = True
sc.cycles.device = "CPU"
sc.render.resolution_x = 1500
sc.render.resolution_y = 850
sc.view_settings.view_transform = "AgX" if "AgX" in [
    i.identifier for i in bpy.types.ColorManagedViewSettings.bl_rna.properties["view_transform"].enum_items
] else "Filmic"

# `ensolarado`: key 0xffefe1 at az 38 / el 52, exposure ~1.05
sun_d = bpy.data.lights.new("Sun", type="SUN")
sun_d.energy = 3.1
sun_d.angle = math.radians(1.2)
sun_d.color = (1.0, 0.937, 0.882)
sun = bpy.data.objects.new("Sun", sun_d)
bpy.context.collection.objects.link(sun)
sun.rotation_euler = (math.radians(90.0 - SUN_EL), 0.0, math.radians(SUN_AZ + 90.0))

w = bpy.data.worlds.new("W")
sc.world = w
w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.44, 0.62, 0.86, 1)
w.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0


cam_d = bpy.data.cameras.new("Cam")
cam_d.lens = 40.0
cam_d.clip_start = 0.1
cam_d.clip_end = 4000.0
cam_ob = bpy.data.objects.new("Cam", cam_d)
bpy.context.collection.objects.link(cam_ob)
cam_ob.location = Vector(cam)
d = Vector(tgt) - Vector(cam)
cam_ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
sc.camera = cam_ob

sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
log("wrote " + OUT)
