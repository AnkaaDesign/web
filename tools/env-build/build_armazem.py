# Builds `/environments/armazem/set.glb` — the distribution-centre interior.
#
#   blender -b -P build_armazem.py
#   blender -b -P build_armazem.py -- --shots     (also writes preview renders)
#
# ---------------------------------------------------------------------------
# WHAT THIS REPLACES, AND WHY IT IS A REBUILD RATHER THAN AN EDIT
#
# The old armazem was warehouse6.blend scaled 4x in XY and 2.3x in Z to reach
# 69 x 124 x 11.6 m. Scaling a modelled building by four is why it never sat
# right next to a truck: every door, every purlin and every handrail on it was
# four times the size it claims to be, so the one object in the scene with a
# known size — the rig — made the building read as a toy.
#
# This one is built from three sources, and the rule that decides everything
# below is that PROPS ARE NEVER SCALED. A EUR-pallet is 800 x 1200 mm here
# because it is 800 x 1200 mm in the world.
#
#   1. THE SHELL — warehouse-fbx-model-free/source/Warehouse.fbx.
#      One 11 k-tri mesh, a barrel vault, both ends closed, materials
#      Metal / Emissive / WetConcrete, and its floor is a single 2-triangle
#      quad. Measured at 1:1 it is 16.0 x 46.1 m with 4.97 m at the ridge and
#      3.21 m at the eaves.
#
#      IT IS THE ONE THING THAT IS SCALED, x2, and that is a deliberate
#      exception with a reason. At 1:1 a 4.0 m tractor only clears the vault
#      within about 4 m either side of the centre line, and a 16 m span leaves
#      the orbit camera 8 m of lateral room for a 19 m rig — the truck could not
#      be seen. At 2x it is 32 x 92 m with 9.94 m at the ridge, which is an
#      ordinary distribution shed. What makes the exception safe is that this
#      shell has no human-scale detail to betray it: no doors, no stairs, no
#      handrails, no windows — just cladding ribs and a roller shutter, and a
#      rib pitch is not a size the eye knows.
#
#   2. THE PALLET AND THE TROLLEY — NotAnotherApocalypticCo/01-Euro.Pallet.
#      Trolley. Already 1:1 (the pallet measures 0.800 x 1.201 x 0.144 m, which
#      is EUR-1 to the millimetre) with a full 4K PBR set. Used as-is.
#
#   3. THE GIIMANN WAREHOUSE — for its SURFACES ONLY, and this is the one
#      judgement call worth writing down.
#
#      Its props were rendered in clay before anything was built with them, and
#      they are placeholders: `shelving` is a flat plate on four legs, `box` is
#      a featureless 3.6 x 7.8 x 3.4 m block, `ChamferCyl` is a disc. They read
#      as a warehouse in the game they came from because the TEXTURE carries
#      them at distance. In a configurator, parked against a truck, a smooth
#      block wearing a cardboard map is a smooth block.
#
#      So the racking and the cartons below are AUTHORED to real dimensions —
#      2.70 m bays, 1.10 m frames, 1.80 m lifts, cartons that stack on a EUR
#      footprint — and dressed in the pack's own `card*.jpeg` atlases. The
#      Giimann material still supplies the look; the geometry is built to
#      survive being looked at from three metres.
#
# COORDINATES. Blender Z-up throughout. The rig stands at the origin and runs
# along +Y, because the glTF exporter maps Blender +Y to -Z and the engine's
# convention (engine/scene/set.ts) is "vehicle at the origin, length along Z".
import bpy
import bmesh
import math
import os
import random
import sys
from mathutils import Vector, Matrix

# ---------------------------------------------------------------------------
# Sources and output.
# ---------------------------------------------------------------------------
SHELL_FBX = r"C:\Users\Kennedy\Downloads\warehouse-fbx-model-free\source\Warehouse.fbx"
SHELL_TEX = r"C:\Users\Kennedy\Downloads\warehouse-fbx-model-free\textures"
PALLET_GLTF = (r"C:\Users\Kennedy\Downloads\3D Ripper Pro\Downloads"
               r"\NotAnotherApocalypticCo\01- Euro.Pallet.Trolley"
               r"\5c522d4915b04450a4498b76d9638395_Textured.gltf")
GII_DIR = (r"C:\Users\Kennedy\Downloads\3D Ripper Pro\Downloads\Giimann"
           r"\03- Warehouse")
# The app's own shared PBR sets. Used as a SOURCE here and embedded, not left
# to the engine's runtime rebinding — see build_floor().
TEXTURES_DIR = r"C:\Users\Kennedy\Documents\repositories\web\public\textures"
# The cardboard atlases, by the suffix the rip left on the filename. `card1` is
# clean corrugated kraft; the numbered ones differ in tone and print, which is
# what stops a hundred cartons reading as one repeated object.
#
# THE `cardboard2_*` ATLASES ARE NOT HERE, and that is from looking at a render
# rather than at the filenames. They carry rip artefacts — a hard black
# diagonal scratch runs across at least two of them — and on a carton face that
# reads as a tear in the box. `card1`–`card4` are clean corrugated kraft in four
# tones, which is already more variety than a real pallet of cartons has.
CARTON_TEX = [
    "e12fe26547564ce2ad52d447d8d65c30_RGB_card1.jpeg",
    "b5ef67888dca41d589317cb5975d4e78_RGB_card2.jpeg",
    "1e08fd50979d42ecaecec7b4124a503f_RGB_card3.jpeg",
    "013cb60213a044309c0235cb6f280d46_RGB_card4.jpeg",
]

OUT_DIR = r"C:\Users\Kennedy\Documents\repositories\web\public\environments\armazem"
OUT = os.path.join(OUT_DIR, "set.glb")

SEED = 11
rnd = random.Random(SEED)

# ---------------------------------------------------------------------------
# Site dimensions. Everything downstream reads these.
# ---------------------------------------------------------------------------
# 2.8, up from 2.0. The first pass was measured against "does the rig fit" and
# that was the wrong question — it fitted, and the room still felt like a
# garage, because 9.9 m of ridge over a 4.0 m truck is only 6 m of air and the
# racks stood 11.6 m away on both sides. A real distribution centre is 12-15 m
# to the underside of the haunch and the cross-aisle in front of the dock is 30
# m of nothing. So: 44.8 x 129.5 m with 14.07 m at the ridge and 8.98 m at the
# eaves, which is an ordinary big-box DC and gives the truck three times its
# own height of headroom.
SHELL_SCALE = 3.2
HALF_W = 25.6                # interior half-span after scaling (51.2 m clear)
HALF_L = 74.0                # interior half-length (148 m clear)
RIDGE = 16.06                # roof height on the centre line
EAVES = 10.27                # roof height at the wall

# The truck lane. Nothing may stand inside it: the rig is 19 m long and the
# studio orbit reaches ~25 m from its centre, so this is both the parking bay
# and the camera's room to work.
LANE_HALF = 14.0             # 28 m clear aisle down the middle
RIG_LEN = 19.0

# Racking. Real numbers, not eyeballed: a 2.7 m bay between 0.09 m uprights on
# 1.10 m deep frames is the commonest europallet configuration there is, and
# 1.80 m lifts clear a 1.55 m loaded pallet with fingers to spare.
BAY_W = 2.70
FRAME_D = 1.10
UPRIGHT = 0.09
BEAM_H = 0.12
BEAM_T = 0.05
LIFT = 1.85
LEVELS = 5                   # beam pairs above the floor level
RACK_H = 0.15 + LIFT * LEVELS   # 9.4 m to the top beam, under a 14.07 m ridge

# EUR-1, and the unit load that stands on it.
PAL_W, PAL_L, PAL_H = 0.800, 1.200, 0.144


def log(m):
    print("[armazem] " + str(m))
    sys.stdout.flush()


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def dims(ob):
    """(lo, hi) of a mesh in OBJECT space, read from the vertices.

    NOT `ob.bound_box`. That is a cache the depsgraph refreshes on evaluation,
    and every transform here is done with `ob.data.transform()`, which does not
    trigger one — so reading it straight afterwards returns the size the mesh
    had one or two operations ago. It reported this shell as 5.0 m tall after a
    2x scale and the EUR-pallet as 80 x 120 metres, both of which are simply
    the pre-transform numbers. The vertices are never stale."""
    vs = ob.data.vertices
    if not vs:
        return Vector((0, 0, 0)), Vector((0, 0, 0))
    lo = Vector((min(v.co.x for v in vs), min(v.co.y for v in vs), min(v.co.z for v in vs)))
    hi = Vector((max(v.co.x for v in vs), max(v.co.y for v in vs), max(v.co.z for v in vs)))
    return lo, hi


# ---------------------------------------------------------------------------
# Materials.
#
# TWO KINDS, and the difference matters for the file size.
#
#   NAMED, UNTEXTURED — the floor. `GROUND_CONCRETE` is a reserved name the
#   engine rebinds to /textures/concrete_* at load (engine/scene/set.ts,
#   bindMaterials), so the set ships no floor texture at all and still gets a
#   4K PBR set. Its UVs are authored in METRES for that to mean anything; see
#   the note on build_floor().
#
#   TEXTURED — everything else. The shell's own maps, the pallet's 4K PBR and
#   the carton atlases ride inside the .glb, capped at 1024 by the bake chain.
# ---------------------------------------------------------------------------
def mat(name, base=(0.5, 0.5, 0.5, 1), rough=0.9, metal=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    if b:
        b.inputs["Base Color"].default_value = base
        b.inputs["Roughness"].default_value = rough
        b.inputs["Metallic"].default_value = metal
    return m


# ---------------------------------------------------------------------------
# GENERATED TEXTURES.
#
# WHY THIS EXISTS AT ALL. Everything in this set that is not a carton or a
# pallet was a FLAT COLOUR: the cladding, the racking, the columns, the dock
# doors, the plinth, the bollards. A flat colour under a soft area light has no
# high-frequency detail anywhere, so there is nothing for the eye to focus on
# and nothing to break the specular — which is what "tudo extremamente falso"
# is, precisely. It is the same failure the distrito ground had, arrived at from
# the other direction: there, a real texture was stretched until it vanished;
# here there was never a texture at all.
#
# AND WHY THEY ARE GENERATED RATHER THAN SOURCED. The three packs supply
# cardboard, a pallet, a concrete floor and one normal map — there is no
# painted steel, no galvanised sheet and no roller shutter anywhere in them.
# Rather than dress a warehouse in cardboard, the surfaces it needs are built
# here: albedo and roughness pairs with the wear a real one has (scuffs at
# fork height, dirt runs under the eaves, scratches along a beam).
#
# They are written as image DATABLOCKS, not files: the exporter embeds them and
# the bake chain resizes them to 1024 and re-encodes to WebP, so a 1024 source
# costs about 40 kB in the shipped set.
def _tex(name, size, fn, non_color=False):
    """Build an image datablock from fn(u, v) -> (r, g, b), evaluated on a grid.

    numpy throughout and one `foreach_set`: doing this pixel by pixel through
    `img.pixels` is minutes per texture, and there are eight of them.
    """
    import numpy as np
    hit = bpy.data.images.get(name)
    if hit:
        return hit
    u, v = np.meshgrid(np.linspace(0, 1, size, endpoint=False),
                       np.linspace(0, 1, size, endpoint=False))
    r, g, b = fn(u, v, np)
    px = np.empty((size, size, 4), dtype=np.float32)
    px[..., 0], px[..., 1], px[..., 2], px[..., 3] = r, g, b, 1.0
    img = bpy.data.images.new(name, size, size, alpha=False,
                              is_data=non_color)
    img.pixels.foreach_set(px.reshape(-1))
    # NO `img.pack()`. A generated image has no encoded form yet, so packing
    # stores raw floats and every later read fails with "IMB_load_image_from_
    # memory: unknown file-format (<packed data>)" — the exporter then reports
    # "has no size and cannot be exported" and drops the texture. Declaring the
    # format and leaving it as a GENERATED source lets the exporter encode it
    # from the pixel buffer at write time, which is what is wanted.
    img.file_format = "PNG"
    return img


def _noise(np, u, v, freq, seed=0.0):
    """Value noise on a wrapping lattice, smoothstep-interpolated."""
    x, y = u * freq, v * freq
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = x - x0, y - y0
    fx = fx * fx * (3 - 2 * fx)
    fy = fy * fy * (3 - 2 * fy)
    f = int(freq)

    def h(a, b):
        s = np.sin((a % f) * 12.9898 + (b % f) * 78.233 + seed) * 43758.5453
        return s - np.floor(s)

    a, b_ = h(x0, y0), h(x0 + 1, y0)
    c, d = h(x0, y0 + 1), h(x0 + 1, y0 + 1)
    return (a + (b_ - a) * fx) + ((c + (d - c) * fx) - (a + (b_ - a) * fx)) * fy


def _fbm(np, u, v, f0, oct=4, seed=0.0):
    out, amp, f = 0.0, 0.5, f0
    for i in range(oct):
        out = out + amp * _noise(np, u, v, max(2, int(f)), seed + i * 37.0)
        amp *= 0.5
        f *= 2.0
    return out


def make_steel(name, rgb, scuff=0.55, rust=0.0):
    """Painted steel: base hue, brushed grain, scratches, scuff at fork height
    and a little rust bloom where paint has been knocked off."""
    def alb(u, v, np):
        grain = _fbm(np, u, v, 64, 4, 3.0)
        dirt = _fbm(np, u, v, 8, 4, 11.0)
        # scratches: thin high-frequency streaks along the member
        scr = _noise(np, u * 0.06, v, 256, 21.0)
        scr = np.clip((scr - 0.80) / 0.20, 0, 1)
        k = 0.86 + 0.20 * grain - 0.22 * np.clip(dirt - 0.45, 0, 1)
        r = rgb[0] * k
        g = rgb[1] * k
        b = rgb[2] * k
        # bare metal where scratched
        r = r * (1 - scr) + 0.42 * scr
        g = g * (1 - scr) + 0.43 * scr
        b = b * (1 - scr) + 0.45 * scr
        if rust > 0:
            rr = np.clip((_fbm(np, u, v, 6, 4, 5.0) - 0.58) / 0.42, 0, 1) * rust
            r = r * (1 - rr) + 0.26 * rr
            g = g * (1 - rr) + 0.11 * rr
            b = b * (1 - rr) + 0.045 * rr
        return r, g, b

    def rgh(u, v, np):
        grain = _fbm(np, u, v, 64, 4, 3.0)
        dirt = _fbm(np, u, v, 8, 4, 11.0)
        k = 0.52 + 0.26 * grain + 0.20 * np.clip(dirt - 0.45, 0, 1) * scuff
        k = np.clip(k, 0.18, 0.95)
        return k, k, k

    return _tex(name + "_alb", 512, alb), _tex(name + "_rgh", 512, rgh, True)


def make_cladding():
    """Galvanised wall sheet: cool grey, faint vertical rib shading, dirt runs
    streaking down from the fixings, and a grubbier band low down."""
    def alb(u, v, np):
        rib = 0.5 + 0.5 * np.cos(u * math.pi * 2 * 24)
        base = 0.60 + 0.055 * rib
        spot = _fbm(np, u, v, 10, 4, 2.0)
        # runs: stretched vertically so they read as water streaks
        run = _fbm(np, u * 6.0, v * 0.35, 24, 4, 8.0)
        run = np.clip((run - 0.52) / 0.48, 0, 1)
        k = base - 0.13 * np.clip(spot - 0.5, 0, 1) - 0.16 * run
        k = k - 0.10 * np.clip((0.22 - v) / 0.22, 0, 1)      # grubby at the base
        k = np.clip(k, 0.22, 0.80)
        return k, k * 1.005, k * 1.02

    def rgh(u, v, np):
        run = np.clip((_fbm(np, u * 6.0, v * 0.35, 24, 4, 8.0) - 0.52) / 0.48, 0, 1)
        k = np.clip(0.46 + 0.30 * _fbm(np, u, v, 16, 3, 4.0) + 0.22 * run, 0.2, 0.95)
        return k, k, k

    return _tex("clad_alb", 1024, alb), _tex("clad_rgh", 1024, rgh, True)


def make_shutter():
    """Roller shutter: horizontal slats with a shadow line at every lap."""
    def alb(u, v, np):
        slat = np.abs(((v * 34.0) % 1.0) - 0.5) * 2.0
        edge = np.clip((slat - 0.72) / 0.28, 0, 1)
        k = 0.44 + 0.10 * (1 - slat) - 0.26 * edge
        k = k - 0.10 * np.clip(_fbm(np, u, v, 8, 3, 9.0) - 0.5, 0, 1)
        k = np.clip(k, 0.12, 0.62)
        return k, k * 1.01, k * 1.03

    def rgh(u, v, np):
        k = np.clip(0.52 + 0.24 * _fbm(np, u, v, 24, 3, 6.0), 0.25, 0.9)
        return k, k, k

    return _tex("shut_alb", 512, alb), _tex("shut_rgh", 512, rgh, True)


def bind_generated(m, alb, rgh, uv_scale=1.0):
    """Wire a generated albedo/roughness pair onto a material."""
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    co = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (uv_scale, uv_scale, uv_scale)
    nt.links.new(mp.inputs["Vector"], co.outputs["UV"])
    ta = nt.nodes.new("ShaderNodeTexImage"); ta.image = alb
    tr = nt.nodes.new("ShaderNodeTexImage"); tr.image = rgh
    tr.image.colorspace_settings.name = "Non-Color"
    nt.links.new(ta.inputs["Vector"], mp.outputs["Vector"])
    nt.links.new(tr.inputs["Vector"], mp.outputs["Vector"])
    nt.links.new(b.inputs["Base Color"], ta.outputs["Color"])
    nt.links.new(b.inputs["Roughness"], tr.outputs["Color"])
    return m


def use_vertex_color(m, layer="Col"):
    """Make a material CONSUME COLOR_0, which is the only way it gets exported.

    Blender's glTF exporter refuses to write a colour attribute the material
    does not reference — "The active Vertex Color will not be exported, as it
    is not used in the node tree of the material" — and it says so as a
    warning among hundreds of INFO lines, so it is easy to miss. It was missed:
    the whole floor-wear field (wheel tracks, rack aprons, oil, the dark rim at
    the walls) was computed, stored, logged, and then silently dropped at
    export, in this build and the one before it.

    glTF multiplies COLOR_0 into the base colour by spec, so all that is needed
    is for the node tree to mention it. Multiplying it into whatever the base
    colour already is keeps Blender's own preview honest as well.
    """
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    if not b:
        return False
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = layer
    mixn = nt.nodes.new("ShaderNodeMixRGB")
    mixn.blend_type = "MULTIPLY"
    mixn.inputs["Fac"].default_value = 1.0
    src = b.inputs["Base Color"]
    if src.is_linked:
        nt.links.new(mixn.inputs["Color1"], src.links[0].from_socket)
    else:
        mixn.inputs["Color1"].default_value = src.default_value
    nt.links.new(mixn.inputs["Color2"], vc.outputs["Color"])
    nt.links.new(src, mixn.outputs["Color"])
    return True


def hook_image(m, path, socket="Base Color", non_color=False, normal=False,
               scale=1.0):
    """Bind an image to a material socket. Returns False if the file is gone —
    a missing map must degrade to a flat colour, never abort the build."""
    if not path or not os.path.exists(path):
        log("  MISSING texture %s" % os.path.basename(path or "?"))
        return False
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    img = bpy.data.images.load(path, check_existing=True)
    if non_color:
        img.colorspace_settings.name = "Non-Color"
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    if scale != 1.0:
        mp = nt.nodes.new("ShaderNodeMapping")
        co = nt.nodes.new("ShaderNodeTexCoord")
        mp.inputs["Scale"].default_value = (scale, scale, scale)
        nt.links.new(mp.inputs["Vector"], co.outputs["UV"])
        nt.links.new(tex.inputs["Vector"], mp.outputs["Vector"])
    if normal:
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(nm.inputs["Color"], tex.outputs["Color"])
        nt.links.new(b.inputs["Normal"], nm.outputs["Normal"])
    else:
        nt.links.new(b.inputs[socket], tex.outputs["Color"])
    return True


# ---------------------------------------------------------------------------
# The shell.
# ---------------------------------------------------------------------------
def build_shell():
    """Import Warehouse.fbx, scale it, centre it on the origin and split its
    floor off so the floor can be rebuilt properly.

    THE FLOOR THAT COMES IN THE BOX IS TWO TRIANGLES. That is fine as geometry
    and useless as a surface: two triangles carry four UVs, so any texture on
    it is stretched across 32 x 92 m, which is exactly the failure the distrito
    ground had (see environments.json repeatNote). It is deleted and rebuilt by
    build_floor().
    """
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=SHELL_FBX)
    fresh = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    ob = fresh[0]
    ob.name = "shell"

    for o in bpy.data.objects:
        o.select_set(o is ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # scale about the origin, then centre the footprint on it
    ob.data.transform(Matrix.Scale(SHELL_SCALE, 4))
    lo, hi = dims(ob)
    ob.data.transform(Matrix.Translation(
        Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))))
    ob.data.update()
    lo, hi = dims(ob)
    log("shell %.2f x %.2f x %.2f m (scale %.1fx, x %.1f..%.1f  y %.1f..%.1f)"
        % (hi.x - lo.x, hi.y - lo.y, hi.z - lo.z, SHELL_SCALE,
           lo.x, hi.x, lo.y, hi.y))
    # These drive HALF_W/HALF_L/RIDGE at the top of the file; if the source FBX
    # is ever swapped they must be re-read from here, not assumed.
    if abs((hi.x - lo.x) / 2 - HALF_W) > 0.6 or abs((hi.z - lo.z) - RIDGE) > 0.6:
        log("  WARNING: shell does not match HALF_W %.1f / RIDGE %.1f — "
            "layout constants are stale" % (HALF_W, RIDGE))

    # --- materials -------------------------------------------------------
    # The pack ships WetConcrete for the floor and a normal map for the shell;
    # `Metal` and `Emissive` come in bare.
    m_metal = bpy.data.materials.get("Metal")
    if m_metal:
        m_metal.name = "WH_CLADDING"
        m_metal.use_nodes = True
        b = m_metal.node_tree.nodes.get("Principled BSDF")
        # Galvanised sheet: a light warm grey, rough enough not to mirror the
        # roof lights, with a touch of metalness so the ribs catch a highlight.
        b.inputs["Base Color"].default_value = (1, 1, 1, 1)
        b.inputs["Roughness"].default_value = 0.62
        b.inputs["Metallic"].default_value = 0.28
        hook_image(m_metal, os.path.join(SHELL_TEX, "Warehouse_normals.png"),
                   non_color=True, normal=True)
        # The shell's UVs were authored for the 16 x 46 m original, so after
        # SHELL_SCALE they cover 3.2x the area at the same texel density — the
        # generated panel texture has to be scaled back by the same factor or a
        # rib lands every 3 m instead of every metre.
        bind_generated(m_metal, *make_cladding(), uv_scale=SHELL_SCALE)
        use_vertex_color(m_metal)
        # PER-PANEL TONE ON THE CLADDING.
        #
        # A shed is built from sheets that were made in different batches,
        # weathered for different lengths of time and washed by different
        # amounts of rain, so no two panels are quite the same grey. The shell
        # ships as one flat tone, and at 51 x 148 m that is an enormous area of
        # exactly one colour — a large part of why the room read as CG.
        #
        # Written per FACE (all loops of a face get one value) rather than per
        # vertex, so the variation lands as panels with edges rather than as a
        # smooth gradient, and keyed off the face centroid so it is stable.
        me = ob.data
        for a in list(me.color_attributes):
            me.color_attributes.remove(a)
        at = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="CORNER")
        me.color_attributes.active_color = at
        for p in me.polygons:
            c = p.center
            s = math.sin(c.x * 0.9 + c.z * 0.4) * math.cos(c.y * 0.31 + c.z * 0.7)
            s += 0.55 * math.sin(c.y * 1.7 + c.x * 0.2)
            k = 0.90 + 0.13 * s
            # grime gathers low down and streaks below the eaves
            k -= 0.16 * max(0.0, 1.0 - c.z / 3.2) ** 1.5
            k = max(0.55, min(1.05, k))
            for li in p.loop_indices:
                at.data[li].color = (k, k * 0.997, k * 0.985, 1.0)
        me.update()

    m_em = bpy.data.materials.get("Emissive")
    if m_em:
        m_em.name = "WH_LIGHTS"
        m_em.use_nodes = True
        b = m_em.node_tree.nodes.get("Principled BSDF")
        b.inputs["Base Color"].default_value = (0.02, 0.02, 0.02, 1)
        # 4000 K high-bay. This is the ONLY light source in the room: the scene
        # has no HDRI (hdri: null in the manifest) and the engine rig lights a
        # exterior, so if these are dark the shed is dark.
        b.inputs["Emission Color"].default_value = (1.0, 0.965, 0.90, 1)
        # 7.5, down from 18. At 18 over a 51 x 148 m room every surface was
        # driven to the top of the range at once: the slab clipped to white,
        # the cladding clipped to white, and with no falloff between them there
        # was no shading gradient anywhere — which is most of what "nothing
        # looks to have depth" and "everything has the same coloring" were
        # describing. Emissive strips are a broad, soft source; they should
        # light a room to a comfortable level and leave the contrast to come
        # from what blocks them.
        b.inputs["Emission Strength"].default_value = 6.0
        b.inputs["Roughness"].default_value = 0.4

    # drop the 2-triangle floor
    wc = None
    for i, s in enumerate(ob.material_slots):
        if s.material and s.material.name == "WetConcrete":
            wc = i
    if wc is not None:
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        doomed = [f for f in bm.faces if f.material_index == wc]
        bmesh.ops.delete(bm, geom=doomed, context="FACES")
        bm.to_mesh(ob.data)
        bm.free()
        ob.data.update()
        log("  dropped %d floor face(s) from the shell" % len(doomed))
    return ob


def build_floor():
    """The floor, subdivided and UV'd IN METRES.

    `GROUND_CONCRETE` is a reserved name: the engine throws away whatever is
    bound here and re-textures it from /textures/concrete_* using `repeat` in
    environments.json. That only produces a sane tile if the UVs mean
    something, so they are authored as metres/UV_M and the manifest carries the
    matching repeat. UV_M 8 with repeat 1 gives an 8 m slab, which is what a
    poured warehouse floor bay actually measures.

    Subdivided at 2 m rather than left as a quad because the vertex colours
    below need topology to sit on.
    """
    UV_M = 8.0
    me = bpy.data.meshes.new("floor")
    ob = bpy.data.objects.new("floor", me)
    bpy.context.collection.objects.link(ob)
    bm = bmesh.new()
    nx = int(HALF_W * 2 / 2.0)
    ny = int(HALF_L * 2 / 2.0)
    bmesh.ops.create_grid(bm, x_segments=nx, y_segments=ny, size=0.5,
                          matrix=Matrix.Identity(4))
    bmesh.ops.scale(bm, vec=(HALF_W * 2, HALF_L * 2, 1.0), verts=bm.verts)
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        for l in f.loops:
            l[uv].uv = (l.vert.co.x / UV_M, l.vert.co.y / UV_M)
    bm.to_mesh(me)
    bm.free()
    # NOT CALLED `GROUND_CONCRETE` ANY MORE, and that is the point.
    #
    # That name is reserved: engine/scene/set.ts recognises it and REPLACES
    # whatever is bound here with its own /textures/concrete_* set. It was a
    # reasonable trade for the outdoor sets — the engine ships a 4K concrete and
    # the .glb stays small — but it means this set could never be judged on its
    # own, every preview showed a flat placeholder grey, and the one thing it
    # could not do was carry a floor tuned for THIS room. Renaming it opts out:
    # the engine leaves it alone and the floor below is what ships.
    m_floor = mat("WH_FLOOR", (1, 1, 1, 1), 0.95)
    d = os.path.join(TEXTURES_DIR, "concrete_diff.webp")
    if os.path.exists(d):
        hook_image(m_floor, d)
        hook_image(m_floor, os.path.join(TEXTURES_DIR, "concrete_rough.webp"),
                   socket="Roughness", non_color=True)
        hook_image(m_floor, os.path.join(TEXTURES_DIR, "concrete_nor.jpg"),
                   non_color=True, normal=True)
    else:
        log("  /textures/concrete_* not found — floor stays flat")
    use_vertex_color(m_floor)
    me.materials.append(m_floor)

    # Wear in COLOR_0. The engine rebinds the material, so a baked map would be
    # thrown away — vertex colour is the only channel that survives the port,
    # and it multiplies the albedo rather than only the ambient term.
    for a in list(me.color_attributes):
        me.color_attributes.remove(a)
    attr = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="CORNER")
    me.color_attributes.active_color = attr
    # WEAR, and it is deliberately much stronger than the first pass.
    #
    # That one ranged 0.72..1.02 but almost never left 0.95, so the slab came
    # out as one clean grey sheet — "o piso parece muito falso" is exactly what
    # an unworn floor looks like. A working warehouse floor is a record of
    # traffic: polished black wheel tracks down the aisle, a dirty apron where
    # pallets get dragged off the racks, tyre scuff at every turning point,
    # spills, and a dark rim where the wall meets the slab and nobody sweeps.
    def h(a, b, c=0.0):
        """cheap deterministic hash noise in [0,1)"""
        s = math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453
        return s - math.floor(s)

    def fbm(x, y, s=0.0):
        v, amp, f = 0.0, 0.5, 1.0
        for _ in range(4):
            xi, yi = x * f, y * f
            x0, y0 = math.floor(xi), math.floor(yi)
            fx, fy = xi - x0, yi - y0
            fx = fx * fx * (3 - 2 * fx)
            fy = fy * fy * (3 - 2 * fy)
            a = h(x0, y0, s); b = h(x0 + 1, y0, s)
            c = h(x0, y0 + 1, s); d = h(x0 + 1, y0 + 1, s)
            v += amp * ((a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy)
            amp *= 0.5; f *= 2.03
        return v

    for li, loop in enumerate(me.loops):
        v = me.vertices[loop.vertex_index].co
        x, y = v.x, v.y
        k = 1.0
        # broad grime, uncorrelated with anything structural
        k -= 0.10 * (fbm(x / 14.0, y / 14.0, 3.0) - 0.35)
        k -= 0.06 * (fbm(x / 3.2, y / 3.2, 11.0) - 0.5)
        # two polished wheel tracks down the aisle, wandering so they are not
        # two ruled lines
        for side in (-1, 1):
            tx = side * 1.28 + (fbm(y / 26.0, 0.5, 7.0) - 0.5) * 1.6
            k -= 0.17 * math.exp(-((x - tx) ** 2) / 0.34)
        # the apron in front of each rack run: forklifts turn here all day
        for rx in (RACK_X, -RACK_X):
            d = abs(abs(x) - (abs(rx) - FRAME_D / 2 - 1.6))
            if d < 4.5:
                k -= (1.0 - d / 4.5) ** 1.4 * (0.13 + 0.06 * fbm(x / 2.0, y / 2.0, 21.0))
        # dark rim along the walls
        edge = min(HALF_W - abs(x), HALF_L - abs(y))
        if edge < 2.6:
            k -= (1.0 - max(edge, 0.0) / 2.6) ** 1.6 * 0.20
        # a handful of oil spills, placed off the same hash so they are stable
        for i in range(7):
            sx = (h(i, 1.0, 5.0) - 0.5) * 2 * (RACK_X - 2)
            sy = (h(i, 2.0, 5.0) - 0.5) * 2 * (HALF_L - 8)
            r = 0.5 + h(i, 3.0, 5.0) * 1.9
            dd = math.hypot(x - sx, y - sy) / r
            if dd < 1.0:
                k -= (1.0 - dd * dd) * (0.10 + 0.14 * h(i, 4.0, 5.0))
        k = max(0.44, min(1.06, k))
        # grime is slightly cooler as well as darker; a pure grey ramp reads as
        # a lighting artefact rather than as dirt
        attr.data[li].color = (k, k * 0.995, k * 0.985, 1.0)
    me.update()
    rb = me.color_attributes.get("Col")
    log("  floor wear %.2f..%.2f over %d loops"
        % (min(c.color[0] for c in rb.data), max(c.color[0] for c in rb.data),
           len(me.loops)))
    log("floor %.0f x %.0f m, uv in metres/%.0f" % (HALF_W * 2, HALF_L * 2, UV_M))
    return ob


# ---------------------------------------------------------------------------
# Pallet racking, authored.
# ---------------------------------------------------------------------------
# 17.2, up from 11.6. "Os armários mais longe" — and it is also what a real
# site does: the racks stand back against the walls and the middle of the shed
# is the manoeuvring aisle, because a reach truck needs 3.5 m to turn and a
# lorry backing to a dock needs far more. Clear span between the rack faces is
# now 33.3 m against 22.
RACK_X = 20.4        # centre line of each rack run, either side of the lane


def box(name, material, cx, cy, cz, sx, sy, sz, uv_m=1.0, rot=None, tint=None):
    """One box, geometry CENTRED ON ITS OWN ORIGIN and placed by the object
    transform.

    The centring is the whole point and it was wrong the first time. Baking the
    world position into the mesh and leaving the object at (0,0,0) means every
    `rotation_euler` afterwards pivots about the WORLD origin, not the part —
    so a rack brace 30 m down the row swung out of the building entirely and
    the exported set measured z -22.9..28.4 inside a 10 m shed. With the mesh
    centred, rotation is local and placement is just `location`.

    UVs are in metres off the local coordinates, so a carton atlas lands at the
    same physical scale on every face whatever the box's proportions.
    """
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Identity(4))
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        n = f.normal
        for l in f.loops:
            p = l.vert.co
            if abs(n.z) > 0.5:
                u, v = p.x, p.y
            elif abs(n.x) > 0.5:
                u, v = p.y, p.z
            else:
                u, v = p.x, p.z
            l[uv].uv = (u / uv_m, v / uv_m)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    if tint is not None:
        # A FLAT PER-BOX TINT IN COLOR_0. Four carton atlases over 250 stacks
        # still gives 250 identical-looking towers, because what the eye tracks
        # at that distance is TONE, not print. A per-carton multiplier breaks
        # them apart for the cost of one attribute and no extra texture — and
        # it survives to the app, which vertex colour always does.
        for a in list(me.color_attributes):
            me.color_attributes.remove(a)
        at = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="CORNER")
        me.color_attributes.active_color = at
        for i in range(len(me.loops)):
            at.data[i].color = (tint[0], tint[1], tint[2], 1.0)
    ob.location = (cx, cy, cz)
    if rot:
        ob.rotation_euler = rot
    return ob


def build_structure():
    """The building fabric the shell does not have — and the reason the room
    read as flat.

    THE DIAGNOSIS. Warehouse.fbx is 11 k triangles of smooth barrel vault: two
    parallel walls and a curved roof, with nothing between them. Nothing
    projects, so nothing casts a shadow onto anything else, so every surface is
    lit identically and the eye gets no parallax and no occlusion — which is
    what "nothing looks to have depth" is describing. Scaling that shell up
    makes a bigger flat tube, not a deeper room.

    What a real shed has in that space, and what is authored here AT 1:1 so it
    keeps human scale no matter what SHELL_SCALE is doing:

      * portal columns down both walls on 8 m centres, with a haunch bracket
      * roof purlins running the length, which is what actually stripes a roof
      * roof lights — translucent panels every third bay
      * a sprinkler main with drops, hung under the ridge
      * dock doors, bumpers and a personnel door on the end wall
      * safety-yellow guards at every rack end and bollards down the aisle

    The last one is doing double duty: it is also the answer to "almost
    everything has the same coloring". The scene was grey shell, blue rack and
    tan carton and nothing else, so yellow guards, orange beams and a red
    hydrant board are the only saturated things in the room and they read as
    accents rather than as a repaint.
    """
    m_steel = mat("STRUCT_STEEL", (1, 1, 1, 1), 0.62, 0.75)
    bind_generated(m_steel, *make_steel("steel_grey", (0.29, 0.30, 0.315),
                                        scuff=0.5, rust=0.06), uv_scale=1.2)
    m_purlin = mat("STRUCT_PURLIN", (1, 1, 1, 1), 0.70, 0.60)
    bind_generated(m_purlin, *make_steel("steel_galv", (0.44, 0.45, 0.46),
                                         scuff=0.4), uv_scale=1.2)
    m_yellow = mat("SAFETY_YELLOW", (1, 1, 1, 1), 0.55)
    # bollards take the worst beating in the building, so the most scuff and
    # the most rust of anything here
    bind_generated(m_yellow, *make_steel("steel_yellow", (0.56, 0.36, 0.02),
                                         scuff=1.0, rust=0.22), uv_scale=2.4)
    m_pipe = mat("SPRINKLER_PIPE", (1, 1, 1, 1), 0.50, 0.40)
    bind_generated(m_pipe, *make_steel("steel_red", (0.36, 0.075, 0.05),
                                       scuff=0.4), uv_scale=1.0)
    m_roof_light = mat("ROOF_LIGHT", (0.78, 0.80, 0.80, 1), 0.35)
    b = m_roof_light.node_tree.nodes.get("Principled BSDF")
    b.inputs["Emission Color"].default_value = (0.86, 0.90, 1.0, 1)
    # daylight through a GRP panel — cooler and much weaker than the fittings,
    # so the roof reads as two different kinds of light rather than one wash
    b.inputs["Emission Strength"].default_value = 3.0

    parts = []
    BAY = 8.0
    n = int(HALF_L / BAY)

    for i in range(-n, n + 1):
        y = i * BAY
        for sx in (-1, 1):
            x = sx * (HALF_W - 0.34)
            # column: a plain 340 x 180 section is close enough at this range
            parts.append(box("col", m_steel, x, y, EAVES / 2, 0.34, 0.18, EAVES))
            # haunch bracket at the eaves, the diagonal every portal frame has
            parts.append(box("haunch", m_steel, x - sx * 0.85, y,
                             EAVES - 0.85, 2.4, 0.14, 0.14,
                             rot=(0, math.radians(38) * sx, 0)))
        # roof lights every third bay, in a pair either side of the ridge
        if i % 3 == 0:
            for sx in (-1, 1):
                parts.append(box("rooflight", m_roof_light, sx * 7.0, y,
                                 RIDGE - 0.65, 3.4, 2.6, 0.10,
                                 rot=(0, math.radians(11) * sx, 0)))

    # purlins: the length of the building, spaced up the arc. They are what
    # gives the roof its rhythm, and the shell's own curve gives them their
    # height for free.
    for k in range(1, 9):
        t = k / 9.0
        x = (t * 2 - 1) * (HALF_W - 1.2)
        z = EAVES + (RIDGE - EAVES) * math.cos((t * 2 - 1) * math.pi / 2) ** 0.9
        parts.append(box("purlin", m_purlin, x, 0.0, z - 0.22,
                         0.09, HALF_L * 2, 0.16))

    # sprinkler main under the ridge, with drops
    parts.append(box("main", m_pipe, 0.0, 0.0, RIDGE - 1.5, 0.14, HALF_L * 2, 0.14))
    for i in range(-int(HALF_L / 3.0), int(HALF_L / 3.0) + 1):
        parts.append(box("drop", m_pipe, 0.0, i * 3.0, RIDGE - 1.85, 0.05, 0.05, 0.6))

    # rack-end guards, and bollards down the truck lane
    for sx in (-1, 1):
        for y in (-38.0, -5.5, 5.5, 38.0):
            parts.append(box("guard", m_yellow, sx * (RACK_X - FRAME_D / 2 - 0.35),
                             y, 0.45, 0.16, 1.5, 0.9))
    for i in range(-6, 7):
        for sx in (-1, 1):
            parts.append(box("bollard", m_yellow, sx * LANE_HALF, i * 9.0, 0.55,
                             0.17, 0.17, 1.1))

    for o in bpy.data.objects:
        o.select_set(o in parts)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = "structure"
    log("structure: %d members (columns, purlins, roof lights, sprinkler, guards)"
        % len(parts))
    return ob


def build_dock_end():
    """Dock doors on the south end wall — the scene's focal point.

    The end wall was 51 x 16 m of unbroken white, which is both the biggest
    single surface in the frame and the emptiest. A dock line fixes that and
    explains the truck: it is what the rig is parked in front of.
    """
    m_door = mat("DOCK_DOOR", (1, 1, 1, 1), 0.58, 0.30)
    bind_generated(m_door, *make_shutter(), uv_scale=1.0)
    m_frame = mat("DOCK_FRAME", (1, 1, 1, 1), 0.62, 0.45)
    bind_generated(m_frame, *make_steel("steel_dark", (0.19, 0.20, 0.21),
                                        scuff=0.6, rust=0.10), uv_scale=1.5)
    m_bump = mat("DOCK_BUMPER", (0.028, 0.028, 0.030, 1), 0.88)
    m_yellow = bpy.data.materials.get("SAFETY_YELLOW") or mat("SAFETY_YELLOW", (0.52, 0.34, 0.02, 1), 0.55)
    y = -HALF_L + 0.30
    W, H = 3.2, 4.4
    parts = []
    for i in range(-2, 3):
        x = i * 7.5
        parts.append(box("door", m_door, x, y, H / 2 + 1.05, W, 0.12, H))
        parts.append(box("dframe", m_frame, x - W / 2 - 0.12, y - 0.02, H / 2 + 1.05,
                         0.20, 0.16, H + 0.3))
        parts.append(box("dframe", m_frame, x + W / 2 + 0.12, y - 0.02, H / 2 + 1.05,
                         0.20, 0.16, H + 0.3))
        parts.append(box("dhead", m_frame, x, y - 0.02, H + 1.28,
                         W + 0.64, 0.16, 0.26))
        for sgn in (-1, 1):
            parts.append(box("bumper", m_bump, x + sgn * (W / 2 + 0.05), y + 0.14,
                             0.62, 0.26, 0.22, 0.42))
        # the painted approach lane on the slab under each door
        for sgn in (-1, 1):
            parts.append(box("dockline", m_yellow, x + sgn * (W / 2 + 0.35),
                             y + 3.0, 0.006, 0.12, 6.0, 0.004))
    for o in bpy.data.objects:
        o.select_set(o in parts)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = "dock_end"
    log("dock end: 5 doors with frames, bumpers and approach lines")
    return ob


def build_slab_joints():
    """Saw-cut contraction joints, on a 6 m grid.

    Every poured industrial slab has them — the concrete is cut within a day of
    the pour so it cracks where you chose instead of where it wants to. Their
    absence is one of the loudest CG tells there is: an unbroken 45 x 130 m
    sheet of concrete does not exist anywhere in the world.

    Cut as thin DARK strips a hair above the slab rather than as real grooves:
    a groove needs the floor subdivided at the joint or it z-fights, and at any
    camera height above a metre a 6 mm dark line reads identically.
    """
    m = mat("SLAB_JOINT", (0.055, 0.055, 0.057, 1), 0.95)
    Z, W, P = 0.004, 0.022, 6.0
    parts = []
    n = int(HALF_W / P)
    for i in range(-n, n + 1):
        parts.append(box("jx", m, i * P, 0.0, Z, W, HALF_L * 2, 0.003))
    n = int(HALF_L / P)
    for i in range(-n, n + 1):
        parts.append(box("jy", m, 0.0, i * P, Z, HALF_W * 2, W, 0.003))
    for o in bpy.data.objects:
        o.select_set(o in parts)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = "slab_joints"
    log("slab joints: %d cuts on a %.0f m grid" % (len(parts), P))
    return ob


def build_plinth():
    """The dirty concrete kick band around the bottom of the walls.

    Real sheds have one — either a poured upstand or a rendered band — because
    the bottom metre of a steel wall gets hit by pallets. It is also the single
    cheapest way to stop the walls reading as an infinite flat sheet, which is
    most of why the first pass looked like a render: the cladding ran from the
    slab to the roof in one unbroken tone.
    """
    m = mat("WALL_PLINTH", (0.30, 0.295, 0.28, 1), 0.94)
    H, T = 1.15, 0.10
    parts = [
        box("pl", m, -HALF_W + T / 2, 0.0, H / 2, T, HALF_L * 2, H),
        box("pl", m, HALF_W - T / 2, 0.0, H / 2, T, HALF_L * 2, H),
        box("pl", m, 0.0, -HALF_L + T / 2, H / 2, HALF_W * 2, T, H),
        box("pl", m, 0.0, HALF_L - T / 2, H / 2, HALF_W * 2, T, H),
    ]
    for o in bpy.data.objects:
        o.select_set(o in parts)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = "wall_plinth"
    return ob


def build_markings():
    """Painted floor markings — real geometry a few millimetres proud, not a
    decal map.

    They have to be geometry because the floor is a NAMED material: the engine
    throws away anything bound to `GROUND_CONCRETE` and re-textures it, so a
    marking painted into the floor's albedo would simply not survive the port.
    Same reasoning as the distrito's LINE_PAINT.

    5 mm rather than the 12 mm the outdoor sets use: indoors the camera gets
    down to a metre off the slab and a centimetre-thick stripe reads as a kerb.
    """
    m_line = mat("FLOOR_PAINT_Y", (0.62, 0.46, 0.05, 1), 0.55)
    m_walk = mat("FLOOR_PAINT_W", (0.60, 0.60, 0.57, 1), 0.60)
    Z = 0.005
    parts = []
    L = HALF_L - 2.0
    # the truck lane, bounded both sides — this is the line the driver follows
    for sx in (-1, 1):
        parts.append(box("lane", m_line, sx * LANE_HALF, 0.0, Z,
                         0.12, L * 2, 0.004))
    # pedestrian walkway against each rack run, hatched
    for sx in (-1, 1):
        wx = sx * (RACK_X - FRAME_D / 2 - 1.30)
        for edge in (-0.62, 0.62):
            parts.append(box("walk", m_walk, wx + edge, 0.0, Z,
                             0.09, L * 2, 0.004))
        n = int(L * 2 / 1.1)
        for i in range(n):
            y = -L + i * 1.1
            parts.append(box("hatch", m_walk, wx, y, Z, 1.15, 0.07, 0.004,
                             rot=(0, 0, math.radians(38))))
    # cross-aisle bar where the two rack blocks meet
    parts.append(box("cross", m_line, 0.0, 0.0, Z, RACK_X * 2, 0.14, 0.004))
    for o in bpy.data.objects:
        o.select_set(o in parts)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = "floor_markings"
    log("markings: %d strips" % len(parts))
    return ob


def build_rack(x, y0, bays, m_steel, m_beam):
    """One rack run: uprights, braces and beam pairs.

    Modelled rather than kitbashed because the Giimann `shelving` prop is a
    plate on four legs — see the header. Parts are joined into ONE object per
    run so a 20-bay row is one draw call instead of several hundred.
    """
    parts = []
    span = bays * BAY_W
    for b in range(bays + 1):
        py = y0 + b * BAY_W
        for dy in (-FRAME_D / 2, FRAME_D / 2):
            parts.append(box("up", m_steel, x + dy, py, RACK_H / 2,
                             UPRIGHT, UPRIGHT, RACK_H))
        # frame bracing, a zig-zag between the two uprights
        for k in range(5):
            z0 = 0.5 + k * (RACK_H - 1.0) / 5
            z1 = 0.5 + (k + 1) * (RACK_H - 1.0) / 5
            mid = (z0 + z1) / 2
            ln = math.hypot(FRAME_D, z1 - z0)
            # the brace runs across the frame depth, so it is built along X and
            # tilted about Y; `rot` is local now that box() centres its mesh
            ang = math.atan2(z1 - z0, FRAME_D) * (1 if k % 2 else -1)
            parts.append(box("br", m_steel, x, py, mid, ln, 0.045, 0.045,
                             rot=(0, -ang, 0)))
    # BEAMS ARE ORANGE, UPRIGHTS ARE BLUE — and that is not decoration, it is
    # what pallet racking looks like everywhere in Europe (Dexion, Mecalux,
    # Stow all ship exactly this pair). It is also the cheapest fix available
    # for "almost everything has the same coloring": the beams are the members
    # the eye actually follows down a rack run, so colouring them separates the
    # horizontal structure from the vertical one and the racking stops reading
    # as one blue mass.
    for lv in range(LEVELS):
        z = 0.15 + lv * LIFT
        for dy in (-FRAME_D / 2 + 0.06, FRAME_D / 2 - 0.06):
            parts.append(box("bm", m_beam, x + dy, y0 + span / 2, z,
                             BEAM_T, span, BEAM_H))
    for o in bpy.data.objects:
        o.select_set(o in parts)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    r = bpy.context.view_layer.objects.active
    r.name = "rack_%+05.1f_%+06.1f" % (x, y0)
    return r


def build_unit_load(x, y, z, m_cartons, rot=0.0):
    """A palletised unit load: cartons stacked on a EUR footprint.

    Sizes come off the pallet, not out of the air — three carton sizes that
    tile 800 x 1200 mm exactly (2x3 of 400x400, 2x2 of 400x600, 1x2 of 800x600)
    so the stack has the interlocked look real palletising produces instead of
    a single extruded block.
    """
    parts = []
    patterns = [
        (0.400, 0.400, 0.36, 2, 3),
        (0.400, 0.600, 0.42, 2, 2),
        (0.800, 0.600, 0.38, 1, 2),
    ]
    cw, cl, ch, nx, ny = patterns[rnd.randrange(len(patterns))]
    layers = rnd.randint(2, 4)
    ca, sa = math.cos(rot), math.sin(rot)
    # one tone for the whole stack — cartons on a pallet came off one line, so
    # they match each other and differ from the next pallet, which is the
    # opposite of picking a random atlas per box
    base = rnd.uniform(0.66, 1.04)
    stack_tint = (base, base * rnd.uniform(0.95, 1.0), base * rnd.uniform(0.86, 0.97))
    m_stack = m_cartons[rnd.randrange(len(m_cartons))]
    for ly in range(layers):
        # alternate the pattern 90 degrees every other course, which is what
        # stops a stack looking extruded
        flip = ly % 2 == 1
        ax, ay, ex, ey = (cl, cw, ny, nx) if flip else (cw, cl, nx, ny)
        for ix in range(ex):
            for iy in range(ey):
                # OFFSETS ARE ROTATED HERE, and the whole stack is never turned
                # as a group. Joining first and then setting rotation_euler
                # pivots about the joined object's origin — which is wherever
                # the first carton happened to be, not the stack's centre — so
                # a 2 degree "settle" threw loads a metre off their pallets.
                ox = (ix - (ex - 1) / 2) * ax + rnd.uniform(-0.012, 0.012)
                oy = (iy - (ey - 1) / 2) * ay + rnd.uniform(-0.012, 0.012)
                px = x + ox * ca - oy * sa
                py = y + ox * sa + oy * ca
                pz = z + PAL_H + ch / 2 + ly * ch
                # a little per-box jitter on top of the stack tone, so a face
                # is never flat against its neighbour
                j = rnd.uniform(0.955, 1.045)
                parts.append(box(
                    "carton", m_stack,
                    px, py, pz, ax - 0.012, ay - 0.012, ch - 0.008,
                    uv_m=0.62,
                    rot=(0, 0, rot + rnd.uniform(-0.02, 0.02)),
                    tint=(stack_tint[0] * j, stack_tint[1] * j, stack_tint[2] * j)))
    for o in bpy.data.objects:
        o.select_set(o in parts)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    u = bpy.context.view_layer.objects.active
    u.name = "load"
    return u


# ---------------------------------------------------------------------------
# The pallet and the trolley, 1:1 out of their own rip.
# ---------------------------------------------------------------------------
def import_pallet_assets():
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=PALLET_GLTF)
    fresh = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    pallet = trolley = None
    for o in fresh:
        if "EuroPallet" in o.name and pallet is None:
            pallet = o
        elif "Trolley" in o.name and trolley is None:
            trolley = o
    for o in fresh:
        if o is not pallet and o is not trolley:
            bpy.data.objects.remove(o, do_unlink=True)
    for o, nm in ((pallet, "PROTO_pallet"), (trolley, "PROTO_trolley")):
        if not o:
            continue
        o.name = nm
        # BAKE THE WORLD MATRIX, not the object's own transform.
        #
        # `transform_apply` only folds in the object's OWN loc/rot/scale, and a
        # glTF import puts the mesh under a chain of nodes — this rip's 0.01
        # unit scale lives on a PARENT. Applying the child's transform
        # therefore did nothing at all and the pallet came in a hundred times
        # too big: 80 x 120 metres instead of 800 x 1200 mm. Unparenting first
        # and baking matrix_world is what actually flattens the chain.
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_basis = Matrix.Identity(4)
        o.data.transform(mw)
        o.data.update()
        # sit it on z = 0 and centre it in xy, so placement is an assignment
        lo, hi = dims(o)
        o.data.transform(Matrix.Translation(
            Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))))
        o.data.update()
        lo, hi = dims(o)
        log("  %s %.3f x %.3f x %.3f m" % (nm, hi.x - lo.x, hi.y - lo.y, hi.z - lo.z))
        # EUR-1 is 0.800 x 1.200 x 0.144. If this drifts, the rack pitch and the
        # carton patterns below are all wrong, so it is asserted rather than
        # trusted: this rip carries a 0.01 node scale and applying it wrongly
        # has already produced an 80-metre pallet once.
        if nm == "PROTO_pallet" and abs((hi.x - lo.x) - PAL_W) > 0.05:
            log("  WARNING: pallet is %.3f m wide, expected %.3f" % (hi.x - lo.x, PAL_W))

    # DOWNSCALE THE RIP'S 4K MAPS IN PLACE, BEFORE EXPORT.
    #
    # This pack ships six 4096x4096 PNGs. Blender holds an image as float RGBA,
    # so each one is 4096*4096*4*4 = 268 MB resident, and the exporter walks
    # them all at once: the export died with "Malloc returns null: len=67108864
    # in imb_alloc_buffer" and took the whole build with it.
    #
    # The bake chain would resize them to 1024 anyway, so nothing is lost that
    # ships — this only moves the resize earlier, where it also buys the export
    # a gigabyte of headroom and a good deal of time.
    # `im.size` is (0, 0) until the pixels are actually decoded, and a glTF
    # import leaves them lazy — so a plain `max(im.size) > 1024` test skipped
    # every one of the 4K maps this is here to catch and only caught the two
    # carton JPEGs that something else had already touched. Force the decode.
    for im in bpy.data.images:
        if im.source != "FILE":
            continue
        try:
            im.reload()
        except Exception:
            pass
        w, h = im.size
        if max(w, h) > 1024:
            nw = 1024 if w >= h else max(1, int(1024 * w / h))
            nh = 1024 if h >= w else max(1, int(1024 * h / w))
            im.scale(nw, nh)
            log("  scaled %s %dx%d -> %dx%d" % (im.name[:30], w, h, nw, nh))
    return pallet, trolley


def place(proto, x, y, z=0.0, rot=0.0, name="p"):
    """Linked duplicate: shares the mesh datablock, so a hundred pallets cost a
    hundred draw calls and one copy of the geometry."""
    d = proto.copy()
    d.data = proto.data
    d.name = name
    d.location = (x, y, z)
    d.rotation_euler = (0, 0, rot)
    bpy.context.collection.objects.link(d)
    return d


# ---------------------------------------------------------------------------
def main():
    log("build start")
    clear_scene()
    build_shell()
    build_floor()

    # --- materials for the authored kit ----------------------------------
    # Rack steel: the blue-and-orange of every European racking maker. Two
    # materials so uprights and beams differ, which is most of what makes a
    # rack read as a rack from across a room.
    # RACK STEEL, retuned. The first pass was (0.06, 0.13, 0.32) at roughness
    # 0.55 — a saturated flat blue that read as painted plastic, which is what
    # a pure hue with no texture and no variation always reads as. Real racking
    # is powder-coated steel that has been hit by pallets for ten years: much
    # darker, much less saturated, and rough enough that the roof lights sit on
    # it as a broad sheen instead of a mirror line.
    # Every one of these was a flat colour until now. Painted steel with grain,
    # scratches and scuff is the difference between "a blue box" and "a rack".
    m_up = mat("RACK_UPRIGHT", (1, 1, 1, 1), 0.72, 0.55)
    a, r = make_steel("steel_blue", (0.055, 0.095, 0.20), scuff=0.7, rust=0.10)
    bind_generated(m_up, a, r, uv_scale=1.6)
    m_beam = mat("RACK_BEAM", (1, 1, 1, 1), 0.66, 0.45)
    a, r = make_steel("steel_orange", (0.52, 0.16, 0.02), scuff=0.8, rust=0.14)
    bind_generated(m_beam, a, r, uv_scale=1.6)
    build_slab_joints()
    build_plinth()
    build_markings()
    build_structure()
    build_dock_end()
    m_cartons = []
    for i, fn in enumerate(CARTON_TEX):
        m = mat("CARTON_%d" % i, (1.0, 1.0, 1.0, 1), 0.90)
        # atlas x COLOR_0. Without the multiply the per-stack tint written in
        # box() would be exported but never used — glTF only reads COLOR_0 when
        # the material actually consumes it, and Blender only writes the
        # attribute when a node references it.
        if hook_image(m, os.path.join(GII_DIR, fn)):
            use_vertex_color(m)
        m_cartons.append(m)

    # --- racking ----------------------------------------------------------
    BAYS = 20
    span = BAYS * BAY_W
    runs = []
    for sx in (-1, 1):
        for y0 in (-span - 4.0, 4.0):
            runs.append(build_rack(sx * RACK_X, y0, BAYS, m_up, m_beam))
    log("racking: %d runs of %d bays (%.1f m each)" % (len(runs), BAYS, span))

    # --- loads on the racking + on the floor ------------------------------
    pallet, trolley = import_pallet_assets()
    nload = 0
    for sx in (-1, 1):
        for y0 in (-span - 4.0, 4.0):
            for b in range(BAYS):
                cy = y0 + (b + 0.5) * BAY_W
                for lv in range(LEVELS):
                    if rnd.random() < 0.24:        # a full rack reads as a wall
                        continue
                    z = 0.15 + lv * LIFT + BEAM_H / 2
                    for dx in (-0.30, 0.30):
                        if rnd.random() < 0.18:
                            continue
                        px = sx * RACK_X + dx
                        place(pallet, px, cy, z, 0.0, "pal")
                        build_unit_load(px, cy, z, m_cartons,
                                        rnd.uniform(-0.03, 0.03))
                        nload += 1
    log("unit loads on racking: %d" % nload)

    # --- the floor: staged pallets, trolleys, a picking row ---------------
    stage = []
    for i in range(9):
        y = -16.0 + i * 3.6
        stage.append((LANE_HALF + 1.2, y, 0.0))
    for i in range(6):
        stage.append((-LANE_HALF - 1.2, -12.0 + i * 4.2, math.pi / 2))
    for x, y, rot in stage:
        place(pallet, x, y, 0.0, rot, "pal_floor")
        if rnd.random() < 0.72:
            build_unit_load(x, y, 0.0, m_cartons, rot)
    if trolley:
        for x, y, r in ((LANE_HALF + 2.6, 6.0, 0.35),
                        (-LANE_HALF - 2.4, -6.5, -1.2),
                        (LANE_HALF + 3.1, -20.0, 2.4)):
            place(trolley, x, y, 0.0, r, "trolley")
    log("floor: %d staged pallets, trolleys placed" % len(stage))

    # --- export -----------------------------------------------------------
    os.makedirs(OUT_DIR, exist_ok=True)
    for o in bpy.data.objects:
        o.select_set(o.type == "MESH")
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons)
               for o in bpy.data.objects if o.type == "MESH")
    log("scene: %d objects, %d triangles"
        % (len([o for o in bpy.data.objects if o.type == 'MESH']), tris))
    # Raw out of Blender. The 35 MB ceiling is met by the bake chain that runs
    # after this (resize 1024 -> webp q92 -> draco), NOT here: the pallet rip
    # ships 4K PNGs — its normal map alone is 34 MB — and Blender's exporter
    # has no resize. See bake_armazem.sh.
    # export_vertex_color="ACTIVE" is load-bearing and was the difference
    # between shipping the wear and shipping a clean floor.
    #
    # The default is "MATERIAL": export COLOR_0 only where the material's node
    # tree references it. Wiring a Color Attribute node into Base Color through
    # a MixRGB is NOT a wiring this exporter recognises — it kept emitting "The
    # active Vertex Color will not be exported" 314 times, once per object, and
    # buried it among several hundred INFO lines. So every carton tint and the
    # entire floor-wear field were computed, stored, logged and discarded.
    # "ACTIVE" writes the active attribute and lets glTF's own rule (COLOR_0
    # multiplies base colour) do the work, which is what was wanted anyway.
    bpy.ops.export_scene.gltf(
        filepath=OUT, export_format="GLB", use_selection=True,
        export_apply=True, export_yup=True,
        export_materials="EXPORT", export_image_format="AUTO",
        export_draco_mesh_compression_enable=False,
        export_vertex_color="ACTIVE",
    )
    log("wrote %s (%.1f MB raw — bake chain still to run)"
        % (OUT, os.path.getsize(OUT) / 1e6))


if __name__ == "__main__":
    main()
