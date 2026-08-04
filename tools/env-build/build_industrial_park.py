# Builds `/environments/distrito-industrial/set.glb`.
#
#   blender -b -P build_industrial_park.py
#
# WHAT CHANGED, AND WHY THE WHOLE FILE TURNED OVER
# ---------------------------------------------------------------------------
# 1. ONE SOURCE. The district is now built purely from "Industrial Buildings
#    Collection Vol.1" (the OBJ package — see ibc1.py for why that and not the
#    ripped glTF). The Race.Track pack is gone, and with it the `Arrows` group:
#    the yellow chevrons painted across the old yard were a 5 129-triangle decal
#    plane on the `ArrowsEmissive` material that the old drop list never
#    mentioned, so it shipped in every build.
#
# 2. A ROAD, NOT AN APRON. The buildings used to stand shoulder to shoulder at
#    24-30 m with the truck in a slot between them. The plant now opens on a
#    60 m corridor: process side west, halls east, nothing tall inside 40 m.
#    CLEAR_RADIUS is the hard floor and the layout pass prints a violation for
#    any piece that crosses it.
#
# 3. MATERIALS ARE MATCHED TO THE PUBLISHER'S RENDER, not to either file on
#    disk — because neither knows. The OBJ package ships no .mtl and no
#    `usemtl`, and the ripped glTF's bindings are collapsed onto one atlas
#    (measured: 99.8 % `Container`, which is the RUST atlas). Believing either
#    is what painted two builds entirely in oxidised steel. See ibc1.py.
#
# 4. THE GROUND HAS NO PATCHES OR JOINTS. An earlier pass built the yard as a
#    literal patchwork — asphalt repairs, dirt wear, a slab-joint grid — as
#    hard-edged quads a centimetre above the surface. The idea was right and the
#    execution was wrong: an untextured quad with a hard edge reads as a
#    rectangle lying on the floor, not as a repair, and each one was also a
#    z-fight waiting for a grazing camera. Variation now comes only from sources
#    that cannot produce an edge — the vertex-colour field and the runtime PBR
#    set. See build_ground().
#
# 5. THE HORIZON IS OCCLUDED, NOT BLENDED. Where CG ground meets HDRI sky is a
#    line no fog density can hide (see the long note at build_berm). So it is
#    covered: the chamfered-top fence stands on the property line at 235 m and
#    an earth berm rises behind it. The seam happens behind 3.6 m of netting and
#    3 m of soil instead of across open ground.
#
# COORDINATES. Blender space throughout: X right, Y forward (the direction the
# truck faces), Z up. The exporter converts to glTF Y-up on the way out.
#
# THE TRUCK. Tractor 2.9 x 4.0 x 6.0 m, trailer 2.67 x 4.23 x 15.1 m — a ~19 m
# rig running along +Y from the origin, standing ON the road at z=0.
import bpy
import bmesh
import math
import os
import random
import importlib.util
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = r"C:\Users\Kennedy\Documents\repositories\web\public\environments\distrito-industrial"
OUT = os.path.join(OUT_DIR, "set.glb")

FENCE_SRC = (r"C:\Users\Kennedy\Downloads\3D Ripper Pro\Downloads\Svetlana07"
             r"\01- Netting.Mesh.Fence.Kit.Low.poly.3D.model"
             r"\01941951658c40eb8bd45e117f912e17_Textured.gltf")

# ---------------------------------------------------------------------------
# Site dimensions.
# ---------------------------------------------------------------------------
# Nothing may intrude here. The orbit camera pulls back to ~30 m to frame a
# 19 m rig, so a building at 24 m is a building the camera is standing inside.
CLEAR_RADIUS = 20.0

ROAD_W = 13.0               # carriageway: 2 x 5 m lanes + shoulders
ROAD_LEN = 1180.0           # runs the FULL ground, so it never ends on screen

# Property line. The fence stands here and the berm rises just outside it.
#
# IT HAS TO ENCLOSE THE PLANT. At 165 m it did not: the second ring runs out to
# 330 m, so half the district stood on grass OUTSIDE its own fence, which reads
# as buildings dumped in a field. The ring is now capped at ~205 m and the line
# sits beyond it. Everything the eye reads as "the plant" is inside the wire.
YARD_HALF = 225.0

# The engine's camera.far is 600 m and the horizon-haze shell sits at 570 m, so
# the ground has to reach PAST the haze or its own edge shows as a lit band
# under the fog. At 590 m FogExp2(0.0028) is 93 % and the haze covers the rest.
GROUND = 1180.0

SEED = 7
rnd = random.Random(SEED)


def log(m):
    print("[park] " + m, flush=True)


# ---------------------------------------------------------------------------
# Terrain height.
#
# EVERY horizontal surface in the yard is sampled from this one function, which
# is the only reason patches, joints and markings can sit ON the ground instead
# of hovering over its low spots. The old build laid them at fixed z and the
# undulating yard punched through — "o chão piscando" was two coplanar surfaces
# fighting for the same depth.
#
# Three octaves, deliberately not harmonically related, so the surface never
# repeats within the near field. Peak amplitude is ~5.8 cm: enough that a wet
# reflection bends and a grazing sun rakes it, not enough to unsettle a trailer.
# ---------------------------------------------------------------------------
YARD_Z = -0.14


# ---------------------------------------------------------------------------
# Noise.
#
# WHY THIS REPLACED THE SINES, and it is the whole reason the yard read as
# "padronizado" no matter how the tint was adjusted.
#
# The previous field was a sum of PRODUCTS OF SINES — sin(x/47)*cos(y/41) and
# friends. That is not noise. sin*cos is separable and periodic, so it paints a
# perfectly regular lattice of alternating lobes, axis-aligned, repeating every
# 2*pi*period. On a 470 m plane seen from above that is a visible diamond grid
# across the entire yard, which is precisely what the screenshots show. No
# number of octaves fixes it: adding more periodic terms just adds more grids.
#
# This is hash-based value noise with fBm on top: the value at each lattice
# point comes from an integer hash, so there is no period at all, and the
# octaves are scaled by 2.03 rather than 2.0 so even the octave alignment does
# not repeat. Same cost, and the result has no direction and no tile.
# ---------------------------------------------------------------------------
def _hash01(i, j, s):
    n = (i * 374761393 + j * 668265263 + s * 1274126177) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFFFF) / float(0xFFFFFF)


def vnoise(x, y, s=0):
    i, j = int(math.floor(x)), int(math.floor(y))
    fx, fy = x - i, y - j
    u = fx * fx * (3.0 - 2.0 * fx)          # smoothstep, so no lattice creases
    v = fy * fy * (3.0 - 2.0 * fy)
    a = _hash01(i, j, s)
    b = _hash01(i + 1, j, s)
    c = _hash01(i, j + 1, s)
    d = _hash01(i + 1, j + 1, s)
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v


def fbm(x, y, s=0, octaves=5):
    """Fractional Brownian motion in 0..1 — organic, non-periodic, no axis."""
    amp, freq, tot, norm = 1.0, 1.0, 0.0, 0.0
    for k in range(octaves):
        tot += amp * vnoise(x * freq, y * freq, s + k * 17)
        norm += amp
        amp *= 0.5
        freq *= 2.03
    return tot / norm


def undul(x, y):
    """Ground relief in metres, centred on zero. Peak ~6 cm."""
    return 0.115 * (fbm(x / 34.0, y / 34.0, 11, 5) - 0.5) \
        + 0.045 * (fbm(x / 7.5, y / 7.5, 29, 3) - 0.5)


def yard_z(x, y):
    return YARD_Z + undul(x, y)


# ---------------------------------------------------------------------------
# Layout.
#
# Read as a street: the road runs north along +Y, the process side is west, the
# halls are east. Depth is staggered on purpose — a row of buildings all at the
# same setback is the strongest "kitbash" tell there is.
#
#   (model, x, y, rotZ deg, note)
# ---------------------------------------------------------------------------
# DENSITY IS A HORIZON TOOL, not just dressing. Spread thin, the plant left a
# clear sightline to the property line from almost every camera angle, so the
# ground/HDRI seam stayed on show. Packed the way the publisher's own render
# packs it — pieces almost touching — the buildings themselves occlude most of
# the far edge, and the fence only has to cover what is left.
#
# So the setback is now 20 m from the kerb rather than 40, and the pieces sit
# close enough to read as one facility. The corridor is still 40 m wide, which
# is more than twice the rig's length across.
# EVERYTHING IS AXIS-ALIGNED, AND THAT IS THE POINT.
#
# The previous pass scattered pieces at 12, 18, 40, 215, 250 degrees and read as
# debris dropped on a field rather than as a plant — "a bagunça". Real
# industrial sites are set out on a survey grid: buildings run parallel or
# perpendicular to the access road because the pipe runs, the rail spurs and the
# drainage all do. So every rotation here is 0, 90, 180 or 270, and the pieces
# sit in three ROWS either side of the road at consistent setbacks.
#
# The whole composition is also much smaller than before. The reference is a
# compact plant a couple of hundred metres across, not a 400 m field, and
# density is what makes it read as one facility — and what puts building
# silhouettes on the horizon instead of bare ground.
#
#   west setbacks (row centre):  -32   -62   -108
#   east setbacks (row centre):  +26   +58   +100
# PACKED, the way the publisher's own renders pack it.
#
# The reference is ONE DENSE FACILITY: pieces separated by service gaps of a few
# metres, reading as a single plant. Three previous attempts spread them on 30 m
# centres — tidy, aligned, and still wrong, because a plant with 30 m of empty
# concrete between every unit is a car park with machinery parked on it.
#
# Gaps here are 3-9 m, which is what a real site leaves for access. The layout
# pass below now MEASURES the result: every pair is checked for footprint
# overlap and the nearest neighbour gap is printed, so this table is verified
# rather than eyeballed. That check is the actual fix — the coordinates are just
# its first output.
LAYOUT = [
    # -- WEST: process side, packed. Tank and basin on the road, vessels and
    # the turbine behind, drum racks and the complex forming the back wall.
    (10, (-28.0,   46.0),   0, "white storage tank"),
    (7,  (-25.0,   28.0),   0, "basin"),
    (6,  (-28.0,    8.0),   0, "process block"),
    (4,  (-52.0,  -30.0),   0, "process unit + turbine"),
    (5,  (-32.0,   66.0),   0, "column + vessel 29 m"),
    (3,  (-78.0,   60.0),   0, "drum racks / walkway 38 m"),
    (8,  (-100.0, -60.0),   0, "plant complex"),

    # -- EAST: the halls, packed into an L against the road, stacks behind.
    (2,  ( 26.0,   30.0),  90, "pipe rack 50 m (road wall)"),
    (1,  ( 25.0,  -40.0),  90, "pipe rack 30 m"),
    (12, ( 52.0,   40.0),   0, "long hall"),
    (14, ( 48.0,  -40.0),   0, "barrel warehouse"),
    (11, ( 85.0,   30.0),   0, "chimney stacks"),
    (13, ( 85.0,  -50.0),   0, "block cluster"),
    (15, ( 50.0,  105.0),   0, "long shed"),
]

# SECOND RING — the same models pushed to 150-330 m.
#
# The pack has 16 pieces and placing each once stops the plant dead at ~120 m,
# after which the eye reads "a few props on a plane". These are LINKED
# duplicates: the mesh is already on the GPU, so each costs a draw call and no
# vertices. Rotations are unrepeated — the same silhouette twice at the same
# angle is what makes a kitbash look like one.
# NO SECOND RING. The collection is SIXTEEN PIECES and the reference uses each
# one ONCE.
#
# Every version of this build so far cloned them into a "second ring" — 34
# pieces at its worst, 12 at its tamest — on the theory that a plant which stops
# at 120 m reads as a few props on a plane. That theory produced a district with
# three times the buildings the pack contains, which is a different failure and
# a worse one: it stopped being the reference at all. "A cena tem muito mais
# construções que o original" is simply correct, and it is arithmetic, not
# taste.
#
# If the far field needs closing later, it gets closed by the fence and by
# atmosphere — not by inventing two more factories.
RING = []

# Containers. 195 triangles each, and the single best scale cue on an open
# yard: a 6 m box beside a 19 m rig states both sizes at once.
# ONE stack of containers, in one place, the way a yard actually stores them —
# not sixteen scattered across the site as loose scale cues. Same reasoning as
# RING: the pack ships one container and the reference does not carpet the plant
# with it.
CONTAINERS = [
    (-20,  70,  0), (-20,  76,  0),
    ( 22,  -8, 90), ( 22, -15, 90),
]

# Two vent poles. Was eight.
POLES = [(-21, 20), (23, 62)]


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def load_ibc1():
    spec = importlib.util.spec_from_file_location("ibc1", os.path.join(HERE, "ibc1.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def place(obj, x, y, rot_deg):
    """Prototypes are recentred on their own footprint with the floor on z=0
    (ibc1.import_prototypes), so placement is an assignment and a rotation about
    the object origin keeps the piece on its mark."""
    obj.rotation_mode = "XYZ"
    obj.rotation_euler = (0.0, 0.0, math.radians(rot_deg))
    obj.location = (x, y, 0.0)


def clone(src, name):
    """Linked duplicate: `dup.data = src.data`, NOT `.copy()`. The mesh
    datablock is shared, so a clone costs one object and one draw call and zero
    vertices — which is what makes a 22-building second ring affordable."""
    dup = src.copy()
    dup.data = src.data
    dup.name = name
    bpy.context.collection.objects.link(dup)
    return dup


def world_bbox(obj):
    pts = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return (Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))),
            Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))))


def audit_layout(boxes):
    """Measure what the layout table actually produced.

    THIS IS THE PART THAT WAS MISSING. Four layouts were authored by writing
    coordinates and looking at a render, which catches nothing quantitative:
    not a building standing inside another, not a 30 m void that makes the
    plant read as scattered, not a piece blocking the truck. All three shipped.

    `boxes` is [(label, lo, hi)] in world metres. Reports:
      * OVERLAP  — two footprints intersecting, always a bug
      * GAP      — nearest-neighbour distance, so sprawl is a number
      * CLEAR    — anything intruding on the camera's orbit
    """
    bad = 0
    for i in range(len(boxes)):
        li, lo_i, hi_i = boxes[i]
        for j in range(i + 1, len(boxes)):
            lj, lo_j, hi_j = boxes[j]
            ox = min(hi_i.x, hi_j.x) - max(lo_i.x, lo_j.x)
            oy = min(hi_i.y, hi_j.y) - max(lo_i.y, lo_j.y)
            if ox > 0.5 and oy > 0.5:
                log("  OVERLAP  %s x %s  (%.1f x %.1f m)" % (li, lj, ox, oy))
                bad += 1
    for i in range(len(boxes)):
        li, lo_i, hi_i = boxes[i]
        best, who = 1e9, "-"
        for j in range(len(boxes)):
            if i == j:
                continue
            lj, lo_j, hi_j = boxes[j]
            dx = max(lo_i.x - hi_j.x, lo_j.x - hi_i.x, 0.0)
            dy = max(lo_i.y - hi_j.y, lo_j.y - hi_i.y, 0.0)
            d = math.hypot(dx, dy)
            if d < best:
                best, who = d, lj
        flag = "  <-- SPRAWL" if best > 18.0 else ""
        log("  gap %-26s %5.1f m to %s%s" % (li, best, who, flag))
    log("  audit: %d overlaps over %d pieces" % (bad, len(boxes)))
    return bad


def layout(protos):
    used = 0
    boxes = []
    for idx, (x, y), rot, note in LAYOUT:
        entry = protos.get(idx)
        if entry is None:
            log("  MISSING model_%d (%s)" % (idx, note))
            continue
        ob = entry[0]
        place(ob, x, y, rot)
        bpy.context.view_layer.update()
        lo, hi = world_bbox(ob)
        # Distance from the orbit centre to the NEAREST POINT of the footprint
        # (zero on an axis the box straddles) — the standard point-to-AABB
        # distance, and the only measure that means anything here: a 70 m hall
        # centred at 90 m is not 90 m away, it is 55.
        dx = max(lo.x, 0.0, -hi.x)
        dy = max(lo.y, 0.0, -hi.y)
        near = math.hypot(dx, dy)
        flag = "   <-- INSIDE CLEAR_RADIUS" if near < CLEAR_RADIUS else ""
        log("  m%02d %-24s -> (%7.1f,%7.1f) rot %3d  h=%5.1f near=%5.1f%s"
            % (idx, note, x, y, rot, hi.z - lo.z, near, flag))
        boxes.append(("m%02d %s" % (idx, note[:20]), lo, hi))
        used += 1
    audit_layout(boxes)

    n = 0
    for i, (idx, (x, y), rot) in enumerate(RING):
        entry = protos.get(idx)
        if entry is None:
            continue
        place(clone(entry[0], "ring_%02d_%02d" % (idx, i)), x, y, rot)
        n += 1
    log("  second ring: %d clones" % n)

    entry = protos.get(0)
    if entry:
        for i, (x, y, rot) in enumerate(CONTAINERS):
            place(clone(entry[0], "cont_%02d" % i), x, y, rot)
        place(entry[0], -52.0, 96.0, 0)
        log("  containers: %d" % (len(CONTAINERS) + 1))

    entry = protos.get(9)
    if entry:
        for i, (x, y) in enumerate(POLES):
            place(clone(entry[0], "pole_%02d" % i), x, y, rnd.uniform(0, 360))
        place(entry[0], -19.0, 100.0, 0)
        log("  poles: %d" % (len(POLES) + 1))
    log("  layout: %d/%d placed" % (used, len(LAYOUT)))


# ---------------------------------------------------------------------------
# Ground materials.
#
# These carry NO textures. They are NAMED SLOTS — the engine binds
# `/textures/asphalt_*`, `/textures/concrete_*`, `/textures/dirt_*` etc. to them
# at load time from environments.json `set.materials`. That keeps set.glb small
# and reuses the PBR sets the app already ships instead of baking a second copy
# of the same 4K asphalt into every environment.
# ---------------------------------------------------------------------------
def mat(name, base=(0.5, 0.5, 0.5, 1.0), rough=0.9, metal=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    if b:
        b.inputs["Base Color"].default_value = base
        b.inputs["Roughness"].default_value = rough
        b.inputs["Metallic"].default_value = metal
    return m


def add_grid(name, w, d, material, cx=0.0, cy=0.0, cuts=1, uv_scale=8.0,
             on_terrain=True, dz=0.0, flat_z=None):
    """A subdivided plane that FOLLOWS the terrain.

    `cuts` matters more than it looks: the vertex-colour patchiness below is
    only as fine as the topology carrying it, and this is the surface the whole
    scene stands on.
    """
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=max(1, cuts), y_segments=max(1, cuts),
                          size=0.5, matrix=Matrix.Identity(4))
    bmesh.ops.scale(bm, vec=(w, d, 1.0), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(cx, cy, 0.0), verts=bm.verts)
    uv = bm.loops.layers.uv.new("UVMap")
    for v in bm.verts:
        v.co.z = (flat_z if flat_z is not None
                  else (yard_z(v.co.x, v.co.y) if on_terrain else 0.0)) + dz
    for f in bm.faces:
        for l in f.loops:
            l[uv].uv = (l.vert.co.x / uv_scale, l.vert.co.y / uv_scale)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    return ob


def add_quads(name, material, quads, uv_scale=2.0, dz=0.012, uv_rotate=False):
    """Many flat quads welded into ONE mesh.

    Patches, joints and every painted marking go through here. Built as separate
    objects they were 200+ draw calls for 400 triangles; as one mesh per
    material they are one each. Corner heights are sampled from yard_z, so a
    patch lies on the yard instead of hovering over its low spots.
    """
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    for q in quads:
        cx, cy, w, d = q[0], q[1], q[2], q[3]
        rot = math.radians(q[4]) if len(q) > 4 else 0.0
        c, s = math.cos(rot), math.sin(rot)
        vs = []
        for sx, sy in ((-0.5, -0.5), (0.5, -0.5), (0.5, 0.5), (-0.5, 0.5)):
            lx, ly = sx * w, sy * d
            x = cx + lx * c - ly * s
            y = cy + lx * s + ly * c
            vs.append(bm.verts.new((x, y, yard_z(x, y) + dz)))
        f = bm.faces.new(vs)
        # A repair patch laid at the same UV angle as the slab under it reads as
        # part of the slab. Rotating the UV is what makes it read as a repair.
        ur = rot + (math.radians(rnd.uniform(0, 90)) if uv_rotate else 0.0)
        cu, su = math.cos(ur), math.sin(ur)
        for l in f.loops:
            px, py = l.vert.co.x, l.vert.co.y
            l[uv].uv = ((px * cu - py * su) / uv_scale, (px * su + py * cu) / uv_scale)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    return ob


def paint_variation(ob, seed=0.0, road_wear=False):
    """Bake large-scale patchiness into the ground's vertex colours.

    A tiled PBR set repeated 200 times across a kilometre reads as one flat tone
    at distance: every tile averages to the same colour, so the plane looks
    painted rather than paved. Vertex colour multiplies the albedo, so a few
    octaves of low-frequency noise give the wear, damp and old-repair variation
    a real yard has, at the cost of one COLOR_0 attribute and no extra texture.

    FLOAT_COLOR on the CORNER domain via color_attributes, NOT the legacy
    vertex_colors API — that one makes a BYTE_COLOR layer, and a byte channel
    cannot hold what this writes.
    """
    me = ob.data
    # ONE attribute, and it must be the ACTIVE one.
    #
    # This is where every previous build silently lost its ground variation.
    # The layer was created and written correctly, but Blender's glTF exporter
    # writes the mesh's ACTIVE colour attribute — and a freshly added layer is
    # not automatically active. So `Col` was computed, filled, and dropped, and
    # what shipped in COLOR_0 was a default all-white layer. Every vertex in the
    # exported set.glb read (1.0, 1.0, 1.0): the yard had no patchiness at all,
    # which is why retuning the noise never changed anything on screen.
    #
    # Nothing here is decorative: clear any stale layers, add one, make it
    # active for both render and export, and assert the range that comes out.
    for a in list(me.color_attributes):
        me.color_attributes.remove(a)
    attr = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="CORNER")
    try:
        me.color_attributes.active_color = attr
        me.color_attributes.render_color_index = me.color_attributes.find("Col")
    except Exception as e:
        log("    could not set active colour attribute: %s" % e)
    lo_k, hi_k = 1e9, -1e9
    s = int(seed * 101.0)
    for li, loop in enumerate(me.loops):
        v = me.vertices[loop.vertex_index].co
        x, y = v.x, v.y
        # THREE SCALES, all fBm, none periodic.
        #   broad   whole regions of the yard damp or bleached  (~90 m)
        #   medium  wear around where things stand               (~22 m)
        #   fine    the grain that keeps it from looking airbrushed (~5 m)
        broad = fbm(x / 90.0, y / 90.0, s, 4)
        medium = fbm(x / 22.0, y / 22.0, s + 71, 4)
        fine = fbm(x / 5.0, y / 5.0, s + 131, 3)
        n = 0.56 * broad + 0.30 * medium + 0.14 * fine
        # fBm is a sum of independent octaves, so it piles up around 0.5 and a
        # straight remap wastes most of the output range: the first honest
        # build measured 0.59..0.94 where 0.38..1.0 was intended. Expanding
        # about the midpoint spends the whole range and gives the yard genuinely
        # light and genuinely dark regions rather than a narrow grey wobble.
        n = min(1.0, max(0.0, (n - 0.5) * 2.1 + 0.5))
        # Widened from the old 0.55..1.0. Real yards are far more contrasty
        # than the previous band allowed, and a narrow band is itself a way of
        # looking uniform.
        k = 0.46 + 0.62 * n
        if road_wear:
            # Two darker bands where wheels actually track. Polished asphalt in
            # the wheelpath and a lighter crown between them is the read every
            # driver has of every road they have ever seen.
            for lane in (-3.1, 3.1):
                k *= 1.0 - 0.16 * math.exp(-((x - lane) ** 2) / 2.2)
            k *= 1.0 + 0.05 * math.exp(-(x ** 2) / 3.0)
        k = max(0.38, min(1.0, k))
        lo_k = min(lo_k, k)
        hi_k = max(hi_k, k)
        # Damp ground is slightly cooler as well as darker; a pure grey ramp
        # reads as a lighting artefact rather than as a wet patch.
        attr.data[li].color = (k, k * 0.995, min(1.0, k * 0.982), 1.0)
    me.update()
    # READ BACK. Logging the k we computed only proves we did arithmetic; it
    # says nothing about whether the attribute kept it, which is exactly the
    # distinction that hid this bug for several builds.
    rb = me.color_attributes.get("Col")
    r0 = min(c.color[0] for c in rb.data)
    r1 = max(c.color[0] for c in rb.data)
    log("    vcol %-8s computed %.2f..%.2f  stored %.2f..%.2f  (%d loops)"
        % (ob.name[:8], lo_k, hi_k, r0, r1, len(me.loops)))


def build_ground():
    """The yard, and the reasoning behind every layer of it.

    THE PROBLEM. "O chão está muito padronizado, o que faz parecer falso." A
    single material tiled across a kilometre is uniform by construction, and
    uniformity is the one thing no real outdoor surface has. Retinting cannot
    fix it because the failure is not colour, it is the absence of history: real
    ground records what has happened to it.

    So the yard is assembled the way a real one is:

      * cast in BAYS with expansion joints between them (slab_joints)
      * REPAIRED in asphalt over concrete, at angles that ignore the bays
      * WORN to dirt where vehicles cut corners and where water stands
      * driven on, which polishes two bands into the carriageway (road_wear)

    HEIGHTS, and the z-fighting that made the old ground blink. The road is the
    datum at z=0 because the app places the truck at y=0 and it has to stand ON
    the carriageway. Everything else drops below it:

        line paint    +1.2 cm   (on the road)
        ROAD           0.0      <- truck sits here
        apron slabs   -2.0 cm
        yard          -14.0 cm, undulating to -8.2 cm at its highest
        patches/joints on the yard, sampled from yard_z
        outside grade -22.0 cm
    """
    m_yard = mat("GROUND_CONCRETE", (0.30, 0.30, 0.29, 1), 0.88)
    m_road = mat("ASPHALT_ROAD", (0.13, 0.13, 0.14, 1), 0.86)
    m_apron = mat("CONCRETE_APRON", (0.34, 0.33, 0.31, 1), 0.85)
    m_gravel = mat("GRAVEL_SHOULDER", (0.28, 0.27, 0.25, 1), 0.93)
    m_grass = mat("GRASS_VERGE", (0.17, 0.21, 0.12, 1), 0.94)
    m_line = mat("LINE_PAINT", (0.78, 0.76, 0.70, 1), 0.55)
    m_kerb = mat("KERB_CONCRETE", (0.40, 0.39, 0.37, 1), 0.80)

    # ---- outside the fence, and why it reaches so far ------------------
    # OUTER GRADE first and lowest, so nothing it meets can z-fight with it.
    # It has to run past the haze shell at 570 m: a ground plane that ends
    # inside the far plane shows its own edge as a lit band under the fog,
    # which was the "estrada morrendo no nada" of the first build.
    g_out = add_grid("outer", GROUND, GROUND, m_gravel, cuts=110, uv_scale=14.0,
                     on_terrain=False, flat_z=-0.22)
    for v in g_out.data.vertices:
        v.co.z += 0.9 * undul(v.co.x * 0.35, v.co.y * 0.35)
    paint_variation(g_out, seed=3.1)

    # (the land beyond the fence is build_outland's job)


    # ---- the yard ------------------------------------------------------
    g = add_grid("yard", YARD_HALF * 2, YARD_HALF * 2, m_yard, cuts=150, uv_scale=8.0)
    paint_variation(g, seed=1.3)

    # ---- the carriageway ------------------------------------------------
    # Flat at z=0 (a carriageway IS engineered flat, and the truck stands on it)
    # and spanning the whole ground, because a road that simply stops is the
    # most artificial thing a ground plane can do.
    road = add_grid("road", ROAD_W, ROAD_LEN, m_road, cuts=120, uv_scale=6.0,
                    on_terrain=False, flat_z=0.0)
    paint_variation(road, seed=2.2, road_wear=True)

    # ---- NO APRON SLABS ---------------------------------------------------
    # They are gone, and this is the "degraus no chão está estranho".
    #
    # Six slabs sat 12 cm proud of the yard, so each one ringed itself with a
    # 12 cm cliff hanging in open ground — a terrace with no retaining edge, no
    # kerb and no reason. Real aprons are either flush with the yard or bounded
    # by something that explains the height change. Ours had neither, so at a
    # low camera they read as ledges cut into the concrete.
    #
    # The yard is now one continuous surface from the kerb to the fence. The
    # only height change left in the site is the carriageway, which is 14 cm up
    # and has a kerb down both sides saying so.

    # NO GEOMETRIC PATCHES, AND NO SLAB-JOINT GRID. Both are deleted, and the
    # deletion is the fix, not a retreat from it.
    #
    # The idea was sound — a real yard IS a patchwork — but the execution put
    # hard-edged quads on the ground, and a hard edge with nothing to justify it
    # does not read as a repair. It reads as a rectangle lying on the floor:
    # "o chão está cheio de artefatos" was describing 96 pasted tan rectangles
    # and an 80-line grid, and it was right. Worse, every one of them was a
    # second surface a centimetre above the first, which is a z-fight waiting
    # for a grazing camera.
    #
    # Variation now comes only from things that CANNOT produce an edge: the
    # vertex-colour field below, which is continuous by construction, and the
    # tiled PBR set the engine binds at runtime. Anything that needs a visible
    # boundary — the road, the aprons — is a surface the site actually has, at
    # its own height, bounded by a kerb.
    build_markings(m_line)
    build_kerbs(m_kerb)
    build_outland(m_grass, m_gravel)




def build_markings(m):
    """Painted markings — real geometry a hair above the asphalt, not a decal
    texture, so they survive any camera angle at 2 triangles each."""
    q = []
    for sx in (-ROAD_W / 2 + 0.40, ROAD_W / 2 - 0.40):
        q.append((sx, 0.0, 0.14, ROAD_LEN))
    # Dashed centre line, 3 m mark / 6 m gap — CONTRAN spacing. Only out to
    # +/-320 m: past that the road is >70 % fogged and each dash is sub-pixel.
    y = -320.0
    while y < 320.0:
        q.append((0.0, y, 0.14, 3.0))
        y += 9.0
    q.append((0.0, 44.0, ROAD_W - 0.8, 0.42))          # stop bar
    for k in range(7):
        q.append((-4.5 + k * 1.5, 48.0, 0.55, 3.2))    # crossing
    # Parking bays east of the yard. 2.5 x 5.0 m is a car, and the eye knows it.
    for row in range(2):
        x0 = 78.0 + row * 12.0
        for k in range(12):
            q.append((x0, -60.0 + k * 2.5, 5.0, 0.12))
        q.append((x0, -60.0 + 11 * 2.5 / 2.0, 0.12, 12 * 2.5))
    # Keep-clear hatch at the rack plinth.
    for k in range(8):
        q.append((-20.5, 6.0 + k * 3.0, 3.0, 0.12))
    q.append((-22.0, 16.5, 0.12, 24.0))
    ob = add_quads("markings", m, q, uv_scale=1.0, dz=0.0)
    # markings ride the ROAD (flat z=0), not the yard, wherever they are on it
    for v in ob.data.vertices:
        if abs(v.co.x) < ROAD_W / 2 + 0.2:
            v.co.z = 0.012
    ob.data.update()
    log("  markings: %d quads" % len(q))


def build_kerbs(m):
    """Kerbs against the carriageway — in the near field, where they read as
    edge detail. The old build ringed the whole yard at +/-150 m, which put a
    hard 300 m rectangle right on the horizon and reinforced the very seam the
    fence exists to hide."""
    for name, x in (("kerb_w", -ROAD_W / 2 - 0.16), ("kerb_e", ROAD_W / 2 + 0.16)):
        me = bpy.data.meshes.new(name)
        ob = bpy.data.objects.new(name, me)
        bpy.context.collection.objects.link(ob)
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Identity(4))
        bmesh.ops.scale(bm, vec=(0.32, ROAD_LEN, 0.28), verts=bm.verts)
        bmesh.ops.translate(bm, vec=(x, 0.0, -0.02), verts=bm.verts)
        uv = bm.loops.layers.uv.new("UVMap")
        for f in bm.faces:
            for l in f.loops:
                l[uv].uv = (l.vert.co.y / 2.0, l.vert.co.z / 2.0)
        bm.to_mesh(me)
        bm.free()
        me.materials.append(m)



def build_outland(m_grass, m_gravel):
    """The land beyond the fence — and the "azulado depois da grama".

    WHAT THE BLUE BAND ACTUALLY IS. The engine draws a horizon-haze shell at
    570 m painted with the PRESET's fogColor, so that fogged ground and fogged
    sky meet at one colour and the seam disappears (scene.ts, makeHaze). That
    works when the sky is the procedural gradient, because the gradient's
    horizon is that same colour. This environment does not use it — it uses the
    `rodovia` HDRI, whose horizon is a different hue. So the shell stops being
    a blend and becomes a light-blue ribbon laid over the photograph.

    AND THE BERM MADE IT WORSE. A 3 m bank at 264 m is well inside the fog's
    reach but far too solid: it drew a crisp dark ridge directly against that
    ribbon. Adding a hard silhouette in front of a seam does not hide the seam,
    it frames it. So the bank is gone.

    What replaces it is deliberately soft: very low, very broad relief (~1.2 m
    over ~200 m wavelengths) that never presents an edge to the sky, running
    the whole way out so fog — not geometry — is what ends the ground. The
    occlusion job goes back to the things that can do it honestly: the fence on
    the line, and the outer ring of buildings just inside it.
    """
    _out = GROUND / 2.0
    _band = _out - YARD_HALF
    _mid = YARD_HALF + _band / 2.0
    for nm, cx, cy, w, d in (
        ("out_n", 0.0, _mid, GROUND, _band),
        ("out_s", 0.0, -_mid, GROUND, _band),
        ("out_e", _mid, 0.0, _band, YARD_HALF * 2),
        ("out_w", -_mid, 0.0, _band, YARD_HALF * 2),
    ):
        ob = add_grid(nm, w, d, m_grass, cx=cx, cy=cy, cuts=44, uv_scale=11.0,
                      on_terrain=False, flat_z=-0.20)
        for v in ob.data.vertices:
            x, y = v.co.x, v.co.y
            # Amplitude RAMPS IN with distance from the fence, so the ground
            # immediately outside the wire stays flat and level with the yard —
            # relief starting hard at the property line would be its own seam.
            t = min(1.0, max(0.0, (max(abs(x), abs(y)) - YARD_HALF) / 120.0))
            v.co.z += t * (2.4 * (fbm(x / 190.0, y / 190.0, 53, 4) - 0.5)
                           + 0.7 * (fbm(x / 46.0, y / 46.0, 97, 3) - 0.5))
        paint_variation(ob, seed=5.7)
    log("  outland: 4 bands, soft relief ramping in past the fence")


# ---------------------------------------------------------------------------
# Fence.
# ---------------------------------------------------------------------------
FENCE_H = 3.6
# see the note in build_fence(): normalising by height alone gives a 1.62 m post
# pitch, which is half what chain-link is actually built at
FENCE_X_STRETCH = 1.60


def build_fence():
    """Perimeter fence on the property line, using the CHAMFERED-TOP run.

    WHICH RUN, AND HOW IT IS FOUND. The kit is arranged as a shop-window row of
    four: a flat-top panel (32.4 units), two razor-wire coils (8.3), and the one
    that was asked for — the run whose posts bend outward at the top to carry
    extra wire rows, which is both the tallest at 38.7 units and the only one
    with real depth (9.9 units, because the arms lean out). So it is selected as
    the TALLEST run, which is unambiguous and survives the kit being renamed.

    THE KIT IS NOT IN METRES — its posts are 31 units for a ~3 m post. Chasing
    the unit is how earlier attempts failed. It is ignored: the run is
    normalised by HEIGHT to FENCE_H and tiled by its own scaled length, so no
    panel is ever cut in half.
    """
    if not os.path.exists(FENCE_SRC):
        log("  fence source missing: %s" % FENCE_SRC)
        return

    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=FENCE_SRC)
    fresh = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    if not fresh:
        log("  fence import produced no meshes")
        return

    runs = []
    for ob in fresh:
        pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
        dx = max(p.x for p in pts) - min(p.x for p in pts)
        dz = max(p.z for p in pts) - min(p.z for p in pts)
        runs.append((dz, dx, ob))
    runs.sort(key=lambda r: -r[0])
    log("  fence runs: " + ", ".join("%s(%.1f long x %.1f tall)" % (r[2].name, r[1], r[0])
                                     for r in runs))
    src = runs[0][2]

    # UNPARENT AND BAKE, and this is not housekeeping — it is the whole reason
    # the first build shipped no fence at all.
    #
    # The glTF importer does not rewrite vertices to turn Y-up into Z-up. It
    # hangs the meshes off a converter EMPTY and puts the rotation there. So
    # `dup.location = (x, y, z)` is not a world position, it is a position in a
    # frame tipped 90 deg about X — the whole perimeter went somewhere vertical
    # and off-site, and the yard/grass seam it exists to hide stayed naked.
    #
    # Clearing the parent and applying the transform leaves the panel axis-
    # correct with an identity matrix, so placement means what it says.
    for o in bpy.data.objects:
        o.select_set(o is src)
    bpy.context.view_layer.objects.active = src
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    pts = [src.matrix_world @ Vector(c) for c in src.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    k = FENCE_H / (hi.z - lo.z)
    # X IS STRETCHED PAST THE UNIFORM SCALE, on purpose and for two reasons.
    # Normalised by height alone the run is 4.97 m with posts every 1.62 m,
    # which is half the spacing real chain-link is built at — and it also means
    # 380 panels around the property instead of 240. Stretching X to a 2.6 m
    # post pitch is simultaneously the more accurate fence and a third fewer
    # draw calls. It makes the posts elliptical in plan by the same factor,
    # which at 235 m is a fraction of a pixel.
    src.scale = (k * FENCE_X_STRETCH, k, k)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    pts = [src.matrix_world @ Vector(c) for c in src.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    pw = hi.x - lo.x
    # centre the run on its own length, base on z=0, in MESH data so the linked
    # clones inherit it
    src.data.transform(Matrix.Translation(
        Vector((-(lo.x + hi.x) / 2.0, -(lo.y + hi.y) / 2.0, -lo.z))))
    src.data.update()
    log("  chamfered run '%s': %.2f m long at %.2f m tall (x%.4f, X x%.2f)"
        % (src.name, pw, FENCE_H, k, FENCE_X_STRETCH))

    # Alpha CUTOUT, not blend. The netting is an opacity-mapped sheet; blended
    # it needs per-fragment sorting across 240 panels and still renders wrong
    # against itself. Clipped, it is order-independent and free. Blender has
    # renamed these enums more than once, so the value is probed rather than
    # assumed.
    for slot in src.material_slots:
        m = slot.material
        if not m:
            continue
        for val in ("CLIP", "DITHERED", "HASHED"):
            try:
                m.blend_method = val
                break
            except TypeError:
                continue
        try:
            m.alpha_threshold = 0.5
        except Exception:
            pass

    # Drop the rest of the kit AND the converter empties it came with,
    # otherwise they export as invisible clutter.
    for o in list(bpy.data.objects):
        if o is src:
            continue
        if o in fresh or (o.type == "EMPTY" and not o.children):
            bpy.data.objects.remove(o, do_unlink=True)

    step = max(2.0, pw)
    n = 0
    for side in range(4):
        along = int((YARD_HALF * 2) / step)
        for i in range(along):
            t = -YARD_HALF + (i + 0.5) * step
            if side == 0:
                x, y, rot = t, YARD_HALF, 0
            elif side == 1:
                x, y, rot = t, -YARD_HALF, 0
            elif side == 2:
                x, y, rot = YARD_HALF, t, 90
            else:
                x, y, rot = -YARD_HALF, t, 90
            # Gate where the access road crosses the line.
            if side in (0, 1) and abs(t) < ROAD_W:
                continue
            dup = src.copy()
            dup.data = src.data
            dup.name = "fence_%d_%03d" % (side, i)
            bpy.context.collection.objects.link(dup)
            dup.parent = None
            dup.rotation_mode = "XYZ"
            dup.rotation_euler = (0.0, 0.0, math.radians(rot))
            # sunk 12 cm so the posts meet ground that undulates under them
            dup.location = (x, y, -0.12)
            n += 1
    bpy.data.objects.remove(src, do_unlink=True)
    log("  fence: %d chamfered panels on the property line (gate at the road)" % n)


# ---------------------------------------------------------------------------
def shrink_images(max_px=1024):
    """Downscale embedded textures before export.

    The pack's five atlases are 2048-4096 px PNGs and the exporter embeds them
    whole. Nothing here is seen closer than a few metres and the ground is bound
    at RUNTIME from /textures, so the embedded set only has to survive
    mid-distance viewing.

    NOT `img.has_data`: glTF/PNG images are lazy, so has_data is False until
    something touches the pixels and the whole loop silently no-ops. `size` is
    read from the header and is available immediately.
    """
    n = 0
    for img in bpy.data.images:
        try:
            w, h = img.size[0], img.size[1]
        except Exception:
            continue
        if w == 0 or h == 0:
            continue
        m = max(w, h)
        if m <= max_px:
            continue
        s = max_px / float(m)
        try:
            img.scale(max(1, int(w * s)), max(1, int(h * s)))
            n += 1
        except Exception as e:
            log("    could not scale %s (%dx%d): %s" % (img.name[:30], w, h, e))
    log("  shrank %d textures to <=%d px" % (n, max_px))


def export():
    os.makedirs(OUT_DIR, exist_ok=True)
    for o in bpy.data.objects:
        o.select_set(True)
    kw = dict(
        filepath=OUT,
        export_format="GLB",
        # export_apply=True evaluates the depsgraph PER OBJECT, so every linked
        # duplicate gets its own mesh copy and glTF instancing is lost. Nothing
        # here uses modifiers, so applying them is pure cost.
        export_apply=False,
        # DRACO IS OFF, and it is the vertex-colour ground that turns it off.
        # Blender's Draco encoder fails that primitive outright ("Failed to
        # encode point attributes") and the failure is FATAL — the exporter
        # aborts and leaves the previous set.glb in place, i.e. a silent no-op
        # build if you only watch the log for a traceback.
        export_draco_mesh_compression_enable=False,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        # THE GROUND VARIATION LIVES OR DIES ON THIS LINE.
        #
        # The exporter's default is export_vertex_color='MATERIAL', which emits
        # real COLOR_0 data only for meshes whose MATERIAL actually reads a
        # Color Attribute node. Our ground materials are bare named slots on
        # purpose — the engine binds their maps at runtime — so not one of them
        # reads vertex colour in Blender, and the exporter dutifully wrote an
        # all-white placeholder instead of the field the build had just
        # computed. Every vertex in every shipped set.glb was (1,1,1): the
        # patchiness existed in the build log and nowhere else, which is why
        # retuning the noise never once changed what was on screen.
        #
        # 'ACTIVE' exports the mesh's active colour attribute regardless of what
        # the material does with it, which is exactly the contract we want:
        # Blender computes it, three.js consumes it, and the material in between
        # does not have to know.
        export_vertex_color="ACTIVE",
    )
    try:
        bpy.ops.export_scene.gltf(export_image_format="WEBP",
                                  export_image_quality=82, **kw)
    except TypeError as e:
        log("  export kwargs rejected (%s); retrying without optional ones" % e)
        kw.pop("export_vertex_color", None)
        bpy.ops.export_scene.gltf(**kw)
    mb = os.path.getsize(OUT) / 1048576.0
    tris = 0
    for o in bpy.data.objects:
        if o.type == "MESH" and o.data:
            tris += len(o.data.polygons)
    log("wrote %s  (%.1f MB, %d objects, %d faces)"
        % (OUT, mb, len(bpy.data.objects), tris))


def main():
    clear_scene()
    ibc1 = load_ibc1()
    protos = ibc1.import_prototypes(log)
    layout(protos)
    build_ground()
    build_fence()
    shrink_images(1024)
    export()
    log("done")


main()
