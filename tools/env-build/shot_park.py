# Preview the district the way the APP will show it.
#
#   blender -b -P shot_park.py
#
# THE POINT IS THE GROUND MATERIALS. set.glb ships them as bare named slots and
# the engine binds /textures/* to them at load (set.ts bindMaterials) from the
# environments.json `materials` block. Rendering the .blend as built would show
# the yard as flat grey — which is exactly the state in which four earlier
# layouts were signed off "by looking at a render", and it is why the ground
# read as padronizado in the app and fine in the preview.
#
# So this binds the same maps with the same repeat and tint the manifest
# declares, lights with the same rodovia HDRI at the same envRotation, and
# frames with view.ts's own VIEW_DIR. What comes out is close to the app.
#
# AXES. The app is Y-up and this file is Z-up: app (x, y, z) is Blender
# (x, -z, y). view.ts VIEW_DIR (2.20, 0.575, 1.17) is therefore Blender
# (2.20, -1.17, 0.575) — camera to the east and south, looking back over the
# truck at the median, the second carriageway and the process side. That is why
# road B is west: it is what the default shot looks AT.
import bpy
import math
import os
import sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.abspath(os.path.join(HERE, "..", ".."))
TEX = os.path.join(WEB, "public", "textures")
HDR = os.path.join(WEB, "public", "environments", "rodovia", "sky.hdr")
OUT = os.path.join(HERE, "_shots_park")

ENV_ROTATION = 4.7124
EXPOSURE = 1.05

# name -> (texture stem or None, repeat, tint, roughness)
# Mirrors environments.json `set.materials` for distrito-industrial.
BIND = {
    "GROUND_CONCRETE": ("concrete", 1.0, (0.50, 0.495, 0.475), 1.0),
    "ASPHALT_ROAD":    ("asphalt", 1.333, (0.28, 0.285, 0.30), 0.94),
    "CONCRETE_APRON":  ("concrete", 2.0, (0.72, 0.71, 0.68), 0.88),
    "KERB_CONCRETE":   ("concrete", 1.0, (0.84, 0.83, 0.80), 0.85),
    "LINE_PAINT":      (None, 1.0, (0.74, 0.72, 0.66), 0.55),
    "GRASS_VERGE":     ("grass", 16.0, (0.42, 0.46, 0.34), 0.94),
    "GRASS_NEAR":      ("grass", 2.0, (0.26, 0.36, 0.17), 0.93),
    "GRAVEL_SHOULDER": ("gravel", 8.0, (0.50, 0.49, 0.46), 0.93),
    "TREE_BARK":       (None, 1.0, (0.20, 0.16, 0.13), 0.92),
    "TREE_LEAF":       (None, 1.0, (0.19, 0.26, 0.11), 0.88),
}

SHOTS = [
    # (name, target, distance, direction, fov, lens note)
    ("a_hero", (0.0, 8.0, 1.4), 42.0, (2.20, -1.17, 0.575), 30.0),
    ("b_wide", (-14.0, 20.0, 2.0), 96.0, (2.20, -1.10, 0.86), 34.0),
    ("c_kerb", (2.0, -4.0, 0.5), 9.0, (1.30, -1.00, 0.20), 38.0),
    ("d_median", (-12.0, 62.0, 2.0), 34.0, (1.60, -1.30, 0.42), 36.0),
    ("e_park", (-52.0, 55.0, 1.5), 62.0, (1.90, -1.05, 0.62), 34.0),
    ("f_gate", (0.0, 232.0, 3.0), 62.0, (1.60, -1.40, 0.55), 34.0),
    ("g_top", (0.0, 10.0, 0.0), 470.0, (0.30, -0.30, 1.0), 40.0),
    # The perimeter: turf band, tree belt, plinth, wire, barbed arms. This is
    # the shot that has to prove the fence is taller AND further, and that the
    # grass in front of it is a band rather than a rectangle.
    ("h_fence", (55.0, 218.0, 2.0), 88.0, (-0.55, -1.0, 0.32), 34.0),
]


def log(m):
    print("[shot] " + m, flush=True)


def load_tex(nt, stem, kind, non_color):
    for ext in (".webp", ".jpg", ".png"):
        p = os.path.join(TEX, "%s_%s%s" % (stem, kind, ext))
        if os.path.exists(p):
            img = bpy.data.images.load(p, check_existing=True)
            if non_color:
                img.colorspace_settings.name = "Non-Color"
            t = nt.nodes.new("ShaderNodeTexImage")
            t.image = img
            return t
    return None


def bind_ground():
    """What set.ts bindMaterials does, in Blender."""
    n = 0
    for name, (stem, repeat, tint, rough) in BIND.items():
        m = bpy.data.materials.get(name)
        if not m:
            continue
        m.use_nodes = True
        nt = m.node_tree
        b = nt.nodes.get("Principled BSDF")
        b.inputs["Base Color"].default_value = (tint[0], tint[1], tint[2], 1.0)
        b.inputs["Roughness"].default_value = rough
        b.inputs["Metallic"].default_value = 0.0
        if not stem:
            n += 1
            continue
        mapping = nt.nodes.new("ShaderNodeMapping")
        mapping.inputs["Scale"].default_value = (repeat, repeat, 1.0)
        uvn = nt.nodes.new("ShaderNodeUVMap")
        uvn.uv_map = "UVMap"
        nt.links.new(mapping.inputs["Vector"], uvn.outputs["UV"])

        d = load_tex(nt, stem, "diff", False)
        if d:
            nt.links.new(d.inputs["Vector"], mapping.outputs["Vector"])
            # tint MULTIPLIES the map, the way a three.js material colour does
            mix = nt.nodes.new("ShaderNodeMixRGB")
            mix.blend_type = "MULTIPLY"
            mix.inputs["Fac"].default_value = 1.0
            mix.inputs["Color2"].default_value = (tint[0], tint[1], tint[2], 1.0)
            nt.links.new(mix.inputs["Color1"], d.outputs["Color"])
            # ...and so does COLOR_0, which is the whole ground-variation system
            ca = nt.nodes.new("ShaderNodeVertexColor")
            ca.layer_name = "Col"
            mix2 = nt.nodes.new("ShaderNodeMixRGB")
            mix2.blend_type = "MULTIPLY"
            mix2.inputs["Fac"].default_value = 1.0
            nt.links.new(mix2.inputs["Color1"], mix.outputs["Color"])
            nt.links.new(mix2.inputs["Color2"], ca.outputs["Color"])
            nt.links.new(b.inputs["Base Color"], mix2.outputs["Color"])
        r = load_tex(nt, stem, "rough", True)
        if r:
            nt.links.new(r.inputs["Vector"], mapping.outputs["Vector"])
            nt.links.new(b.inputs["Roughness"], r.outputs["Color"])
        nr = load_tex(nt, stem, "nor", True)
        if nr:
            nt.links.new(nr.inputs["Vector"], mapping.outputs["Vector"])
            nm = nt.nodes.new("ShaderNodeNormalMap")
            nm.inputs["Strength"].default_value = 1.8
            nt.links.new(nm.inputs["Color"], nr.outputs["Color"])
            nt.links.new(b.inputs["Normal"], nm.outputs["Normal"])
        n += 1
    # the two paint/foliage slots still want their COLOR_0 multiplied in
    for name in ("LINE_PAINT", "TREE_LEAF", "TREE_BARK"):
        m = bpy.data.materials.get(name)
        if not m:
            continue
        nt = m.node_tree
        b = nt.nodes.get("Principled BSDF")
        tint = BIND[name][2]
        ca = nt.nodes.new("ShaderNodeVertexColor")
        ca.layer_name = "Col"
        mix = nt.nodes.new("ShaderNodeMixRGB")
        mix.blend_type = "MULTIPLY"
        mix.inputs["Fac"].default_value = 1.0
        mix.inputs["Color1"].default_value = (tint[0], tint[1], tint[2], 1.0)
        nt.links.new(mix.inputs["Color2"], ca.outputs["Color"])
        nt.links.new(b.inputs["Base Color"], mix.outputs["Color"])
    log("bound %d ground materials" % n)


def world_hdri():
    w = bpy.data.worlds.new("w")
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes["Background"]
    if os.path.exists(HDR):
        env = nt.nodes.new("ShaderNodeTexEnvironment")
        env.image = bpy.data.images.load(HDR, check_existing=True)
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Rotation"].default_value = (0.0, 0.0, ENV_ROTATION)
        tc = nt.nodes.new("ShaderNodeTexCoord")
        nt.links.new(mp.inputs["Vector"], tc.outputs["Generated"])
        nt.links.new(env.inputs["Vector"], mp.outputs["Vector"])
        nt.links.new(bg.inputs["Color"], env.outputs["Color"])
        bg.inputs["Strength"].default_value = 1.0
        log("world: rodovia HDRI")
    else:
        bg.inputs["Color"].default_value = (0.42, 0.5, 0.62, 1)
        log("world: HDRI MISSING, flat sky")
    # A sun on top of the HDRI, because the app's preset `ensolarado` adds a
    # directional key the HDRI alone does not provide.
    bpy.ops.object.light_add(type="SUN", location=(60, -80, 120))
    s = bpy.context.active_object
    s.data.energy = 2.6
    s.data.angle = math.radians(1.6)
    s.rotation_euler = (math.radians(54), 0.0, math.radians(38))


def stand_in_truck():
    """A 19 x 2.6 x 4.0 m box on the origin.

    Nothing about this scene can be judged without it: "is the fence far
    enough", "is the tree in the way", "does the kerb read at this distance"
    are all questions about a 19 m rig that is not in the .glb, because the app
    supplies it.
    """
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    ob = bpy.context.active_object
    ob.name = "STANDIN_rig"
    ob.scale = (2.6, 19.0, 4.0)
    ob.location = (0.0, 8.0, 2.0)
    m = bpy.data.materials.new("standin")
    m.use_nodes = True
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.55, 0.06, 0.06, 1)
    m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.35
    ob.data.materials.append(m)
    return ob


def shoot(name, target, dist, direction, fov):
    tgt = Vector(target)
    d = Vector(direction).normalized()
    cam_d = bpy.data.cameras.new("c_" + name)
    cam_d.lens_unit = "FOV"
    cam_d.angle = math.radians(fov)
    cam = bpy.data.objects.new("c_" + name, cam_d)
    bpy.context.collection.objects.link(cam)
    cam.location = tgt + d * dist
    cam.rotation_euler = (tgt - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc = bpy.context.scene
    sc.camera = cam
    sc.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)
    log("  %s" % name)


def main():
    os.makedirs(OUT, exist_ok=True)
    # Build the district in this session — same code path as the export, so a
    # preview can never disagree with what shipped.
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "bip", os.path.join(HERE, "build_industrial_park.py"))
    mod = importlib.util.module_from_spec(spec)
    sys.modules["bip"] = mod
    spec.loader.exec_module(mod)          # runs main() and writes set.glb

    bind_ground()
    world_hdri()
    stand_in_truck()

    sc = bpy.context.scene
    # CYCLES, NOT EEVEE, and not by preference. Headless EEVEE crashed outright
    # on this scene (blender.crash.txt, after the build had already written
    # set.glb) — it wants a real GL context and this one has 311 k faces, an
    # alpha-clipped perimeter and a 5.7 MB HDRI to chew on without one. Cycles
    # on CPU is slower and cannot crash for that reason, and its contact shadows
    # are what the kerb and the tree line actually have to be judged on.
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 40
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 3
    sc.cycles.transparent_max_bounces = 6      # the netting is alpha-cut
    sc.render.resolution_x = 1000
    sc.render.resolution_y = 600
    sc.render.image_settings.file_format = "PNG"
    sc.view_settings.exposure = math.log2(EXPOSURE)
    try:
        sc.view_settings.view_transform = "AgX"
    except TypeError:
        pass

    only = None
    for a in sys.argv:
        if a.startswith("--only="):
            only = a.split("=", 1)[1].split(",")
    for name, tgt, dist, d, fov in SHOTS:
        if only and name not in only:
            continue
        shoot(name, tgt, dist, d, fov)
    log("done -> %s" % OUT)


main()
