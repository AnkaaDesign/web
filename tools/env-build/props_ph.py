# Poly Haven props, and the chainlink textures the fence is built from.
#
# WHY THIS FILE EXISTS AT ALL. build_industrial_park.py used to take its fence
# from a 3D-Ripper folder:
#
#   C:\Users\Kennedy\Downloads\3D Ripper Pro\Downloads\Svetlana07\...
#
# THAT PATH IS GONE. The script does not fail when it goes missing — build_fence
# logs "fence source missing" and returns — so running the committed build today
# produces a district with NO PERIMETER AT ALL, and the ground/HDRI seam the
# fence exists to hide comes straight back. The kit here is CC0 and lives beside
# the trailer project's other props, which is a better place for it than a
# ripper's download folder.
#
# THESE ARE PHOTOGRAMMETRY MESHES AND THEY ARE NOT CHEAP: 156 012 faces for a
# 0.4 m shrub, 60 928 for a road barrier, 20 338 for a lamp. Every one is
# decimated to a budget on import. The budgets are set by how close the piece
# ever gets to the camera, not by how much detail it has.
import bpy
import os
from mathutils import Vector, Matrix

ROOT = r"C:\Users\Kennedy\Downloads\ETS2\goodman_senec_realistic\props"

FENCE_DIR = os.path.join(ROOT, "modular_chainlink_fence", "textures")
WIRE_ALPHA = os.path.join(FENCE_DIR, "wire_diff_alpha.png")
POSTS_DIFF = os.path.join(FENCE_DIR, "modular_chainlink_fence_posts_diff_1k.jpg")
POSTS_NRM = os.path.join(FENCE_DIR, "modular_chainlink_fence_posts_nor_gl_1k.jpg")

# key -> (folder, target height in metres or None to keep, face budget)
#
# TARGET HEIGHT IS APPLIED, NOT TRUSTED. Poly Haven ships in metres and these
# measured true (a 1.68 m lamp head, a 0.83 m barrier) — but `street_lamp_02` is
# a WALL/short lamp at 1.68 m and this site needs a road column, so it is scaled
# deliberately rather than accidentally.
# NO `street_lamp_02`. It is an ornamental cast-iron lantern, and at road height
# it put an 8 m Victorian gas lamp beside a chemical plant. The road lighting is
# generated instead — see make_mast in build_industrial_park.py.
# THE SMALL PROPS ARE GONE, and the reason is a question of READABILITY rather
# than of polygons. `industrial_pastic_container` is 0.46 m, `plastic_crate_02`
# 0.51 m, `wooden_crate_01` 0.82 m. Beside a 19 m rig, seen from the 30-40 m the
# studio camera lives at, a 0.46 m blue bin is four blue pixels — and four blue
# pixels on grey concrete do not read as a bin, they read as a defect. The
# verdict on the build was exactly that: "esses elementos azuis estao terriveis,
# nem mesmo da pra entender oque sao".
#
# Yard dressing has to be sized to the shot. What survives is what states a
# scale a truck can be measured against: containers (6.1 m), skips (3.5 m) and
# the barrier, and the barrier only where something would actually be protected.
PROPS = {
    "barrier": ("concrete_road_barrier", None, 900),
}


def _meshes():
    return [o for o in bpy.data.objects if o.type == "MESH"]


def _bounds_world(obs):
    pts = []
    for o in obs:
        pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    return (Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))),
            Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))))


def _decimate(ob, budget, log):
    n = len(ob.data.polygons)
    if n <= budget:
        return
    md = ob.modifiers.new("dec", "DECIMATE")
    md.ratio = max(0.005, float(budget) / float(n))
    for o in bpy.data.objects:
        o.select_set(o is ob)
    bpy.context.view_layer.objects.active = ob
    # DESTRUCTIVE ON PURPOSE. The build exports with export_apply=False (see its
    # note: applying evaluates the depsgraph per object and loses instancing),
    # so a modifier left unapplied would ship at full density.
    bpy.ops.object.modifier_apply(modifier=md.name)
    log("    %-9s decimated %d -> %d faces" % (ob.name[:9], n, len(ob.data.polygons)))


def import_props(log, keys=None):
    """key -> (object, (sx, sy, sz)), each centred on its footprint with its
    base on z=0 and an identity transform."""
    out = {}
    for key, (folder, target_h, budget) in PROPS.items():
        if keys and key not in keys:
            continue
        path = os.path.join(ROOT, folder, folder + "_1k.gltf")
        if not os.path.exists(path):
            log("  prop missing: %s" % path)
            continue
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=path)
        fresh = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
        if not fresh:
            log("  prop %s imported nothing" % key)
            continue

        # UNPARENT AND BAKE before anything else. The glTF importer does not
        # rewrite vertices for Y-up; it hangs the meshes off a converter EMPTY
        # and puts the rotation there, so a later `location = (x, y, z)` is a
        # position in a frame tipped 90 degrees. That is what once sent a whole
        # perimeter somewhere vertical and off-site.
        for o in bpy.data.objects:
            o.select_set(o in fresh)
        bpy.context.view_layer.objects.active = fresh[0]
        bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        if len(fresh) > 1:
            bpy.ops.object.join()
        ob = bpy.context.view_layer.objects.active
        ob.name = "PH_" + key

        lo, hi = _bounds_world([ob])
        if target_h and hi.z - lo.z > 1e-6:
            k = target_h / (hi.z - lo.z)
            ob.data.transform(Matrix.Scale(k, 4))
            ob.data.update()
            lo, hi = _bounds_world([ob])
        ob.data.transform(Matrix.Translation(
            Vector((-(lo.x + hi.x) / 2.0, -(lo.y + hi.y) / 2.0, -lo.z))))
        ob.data.update()
        _decimate(ob, budget, log)

        # Drop the converter empties the kit came with, or they export as
        # invisible clutter.
        for o in list(bpy.data.objects):
            if o.type == "EMPTY" and not o.children:
                bpy.data.objects.remove(o, do_unlink=True)

        lo, hi = _bounds_world([ob])
        sz = (hi.x - lo.x, hi.y - lo.y, hi.z - lo.z)
        out[key] = (ob, sz)
        log("  %-9s %5.2f x %5.2f x %5.2f m  (%d faces)"
            % (key, sz[0], sz[1], sz[2], len(ob.data.polygons)))
    return out
