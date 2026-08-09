# Builds `/environments/distrito-industrial/set.glb`.
#
#   blender -b -P build_industrial_park.py
#
# WHAT CHANGED IN THIS PASS, AND WHY
# ---------------------------------------------------------------------------
# 0. THE FENCE SOURCE HAD DISAPPEARED. FENCE_SRC pointed into
#    `Downloads\3D Ripper Pro\...`, a folder that no longer exists. build_fence()
#    logs "fence source missing" and RETURNS — it does not raise — so running the
#    previous version of this file today produced a district with no perimeter at
#    all, and the ground/HDRI seam the fence exists to hide came straight back.
#    The perimeter is now generated here from the CC0 chainlink kit's textures
#    (props_ph.py), which also makes its height a number in this file instead of
#    a property of whatever kit happened to be on disk.
#
# 1. TWO CARRIAGEWAYS WITH A PLANTED MEDIAN. The truck still stands on x=0 —
#    that is not negotiable, the app parks it at the origin at z=0 — so the pair
#    is not centred on the truck: road A IS the truck's road, and road B runs
#    west of it behind a 10.5 m median. West, because the studio's default view
#    direction puts the camera east-southeast, so the second road and its median
#    land in the frame BEHIND the truck rather than under the camera.
#
# 2. THE ROAD/YARD JOINT IS THE DETAIL NOW. Previously one 32 cm kerb box and a
#    yard 14 cm BELOW the road, which is backwards: a kerb retains the higher
#    ground, it does not fence off a sunken one. The section is now
#    gutter -> kerb face -> yard, with the yard 12 cm ABOVE the carriageway, the
#    kerb segmented every 1.1 m so the joints read, and drainage inlets cut into
#    the gutter line. Every height change on this site is now explained by
#    something that would explain it in life — which is the standing lesson from
#    the apron slabs that shipped as "degraus no chao".
#
# 3. THE PAINT IS WORN, NOT PAINTED. Markings were flat quads on one flat tone,
#    which is the giveaway that they are decals: real paint fails in patches,
#    fails fastest in the wheelpath, and fails completely on bays nobody has
#    repainted. Every mark is now subdivided along its length and carries COLOR_0
#    wear, and a proportion of the bay lines are worn to nearly nothing.
#
# 4. THE SITE IS BIGGER AND THE FENCE IS FURTHER AND TALLER. Property line 225 ->
#    330 m (a 660 m square, more than double the enclosed area), fence 3.6 ->
#    ~4.3 m over a concrete plinth with barbed arms. The concrete no longer runs
#    to the wire: it stops and grass takes over, which is where the trees are.
#
# 5. THE TALL PIECES ARE SET BACK IN THE GEOMETRY. Nothing over 8 m stands
#    within 60 m of road A. That was previously done at load time by the
#    manifest's `pushback` block; that block MUST now be deleted from
#    environments.json, exactly as its own note says, or the recuo is applied
#    twice.
#
# COORDINATES. Blender space throughout: X right, Y forward (the direction the
# truck faces), Z up. The exporter converts to glTF Y-up on the way out.
#
# THE TRUCK. Tractor 2.9 x 4.0 x 6.0 m, trailer 2.67 x 4.23 x 15.1 m — a ~19 m
# rig running along +Y from the origin, standing ON road A at z=0.
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

# ---------------------------------------------------------------------------
# Site dimensions.
# ---------------------------------------------------------------------------
# Nothing may intrude here. The orbit camera pulls back to ~30 m to frame a
# 19 m rig, so a building at 24 m is a building the camera is standing inside.
CLEAR_RADIUS = 26.0

ROAD_W = 13.0               # carriageway: 2 x 5 m lanes + shoulders
ROAD_LEN = 1180.0           # runs the FULL ground, so it never ends on screen
ROAD_CROWN = 0.055          # fall from centreline to channel

GUTTER_W = 0.45             # concrete channel, flush with the asphalt
KERB_W = 0.17               # the face you see
KERB_SEG = 1.10             # one kerbstone; the joints are what read as kerb

# ROAD A IS THE TRUCK'S ROAD AND IT IS AT ZERO. The app parks the rig on the
# origin at z=0, so the median cannot be centred on the truck — it would put
# grass under the trailer. Road B goes WEST because view.ts aims the default
# camera from (+X, -Y): west is what the frame looks AT, east is behind the lens.
ROAD_A_X = 0.0
MEDIAN_W = 10.5
_EDGE = ROAD_W / 2.0 + GUTTER_W + KERB_W
ROAD_B_X = -(2.0 * _EDGE + MEDIAN_W)     # -24.74

# Property line. The fence stands here.
#
# 225 -> 330 -> 250, and the round trip is the lesson. 330 did put the wire well
# outside any orbit, which is what "mais longe por conta da camera" asked for —
# but it also bought 660 x 660 m of ground that the plant had no way to fill, so
# the buildings ended up 30 and 40 m apart just spanning it. The verdict was
# immediate and correct: "as construcoes ficam muito afastadas umas das outras".
#
# 250 keeps the fence at more than eight times the maximum orbit radius (~31 m),
# which is all the camera ever needed, and leaves a perimeter band the planting
# can actually fill instead of a field with a wire around it.
YARD_HALF = 250.0

# The PAVED yard, which is no longer the whole property. It stops well short of
# the wire and grass takes over — that band is where the trees stand, and it is
# also the honest answer to a 660 m concrete slab, which no plant has ever had.
#
# SMALLER THAN THE FIRST ATTEMPT AT THIS, and the top-down render is why: 468 x
# 490 m of concrete is not a yard, it is an airfield. The plant only owns as
# much slab as it has buildings to stand on and lorries to turn on; the rest of
# the property is turf, which is both what a real site looks like and where the
# brief's trees and grass patches go.
YARD_X0, YARD_X1 = -158.0, 142.0
YARD_Y0, YARD_Y1 = -140.0, 172.0

# The engine's camera.far is 600 m and the horizon-haze shell sits at 570 m, so
# the ground has to reach PAST the haze or its own edge shows as a lit band
# under the fog. At 590 m FogExp2(0.0028) is 93 % and the haze covers the rest.
GROUND = 1180.0

# Heights. The carriageway crown is the datum at z=0 because the truck stands on
# it; everything else is referred to that.
YARD_Z = 0.12               # the paved yard sits ABOVE the road, behind a kerb
KERB_TOP = 0.155
GRASS_Z = 0.02              # unpaved ground inside the fence, below the slab

SEED = 7
rnd = random.Random(SEED)


def log(m):
    print("[park] " + m, flush=True)


# ---------------------------------------------------------------------------
# Noise. Hash-based value noise with fBm on top — no period, no axis, no tile.
# (The sines this replaced painted a visible diamond lattice across the yard:
# sin*cos is separable and periodic, so more octaves only add more grids.)
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


def grass_z(x, y):
    return GRASS_Z + undul(x, y) * 1.4


def road_cx(x):
    """Which carriageway is x on? Returns the centreline, or None."""
    if abs(x - ROAD_A_X) <= ROAD_W / 2 + 0.001:
        return ROAD_A_X
    if abs(x - ROAD_B_X) <= ROAD_W / 2 + 0.001:
        return ROAD_B_X
    return None


def road_z(x, cx=None):
    """A carriageway is CROWNED, and the crown is not decoration: it is why the
    channel is the low point, why the gutter can be flush and still drain, and
    why a marking laid at a fixed z sinks into the asphalt near the kerb. Every
    mark on a road samples this."""
    if cx is None:
        cx = road_cx(x)
        if cx is None:
            return 0.0
    t = min(1.0, abs(x - cx) / (ROAD_W / 2.0))
    return -ROAD_CROWN * t * t


def on_paving(x, y):
    """True where the ground is paved or is the median.

    NOTHING GREEN MAY BE SEEDED HERE, and this is the fix for "a grama que fica
    antes da grade nao deveria atravessar a rua". The patch seeder only tested
    the YARD SLAB — so a patch at (0, 200) is outside the slab in y, passes the
    test, and gets planted in the middle of carriageway A where it runs north to
    the gate. Grass growing across an asphalt road is exactly as wrong as it
    sounds, and it was doing it on both roads at both ends of the site.
    """
    if ROAD_B_X - _EDGE - 1.5 <= x <= ROAD_A_X + _EDGE + 1.5:
        return True
    return (YARD_X0 - 2.0 <= x <= YARD_X1 + 2.0
            and YARD_Y0 - 2.0 <= y <= YARD_Y1 + 2.0)


def surface_z(x, y):
    """The height of whatever is at (x, y): road, median, yard or grass."""
    cx = road_cx(x)
    if cx is not None:
        return road_z(x, cx)
    if ROAD_B_X + _EDGE <= x <= ROAD_A_X - _EDGE:
        return YARD_Z + undul(x, y) * 0.6          # the median
    if YARD_X0 <= x <= YARD_X1 and YARD_Y0 <= y <= YARD_Y1:
        return yard_z(x, y)
    return grass_z(x, y)


# ---------------------------------------------------------------------------
# Layout.
#
# Read as a street. Road A is the truck's; road B is the through road west of
# the median. The logistics half — docks, warehouses, the site office — is EAST
# of road A, because that is the side a truck is served from. The process half —
# tanks, columns, racks, stacks — is WEST of road B, pushed back far enough that
# none of it is ever in the orbit.
#
# EVERYTHING IS AXIS-ALIGNED, AND THAT IS THE POINT. An earlier pass scattered
# pieces at 12, 18, 40, 215, 250 degrees and read as debris dropped on a field
# rather than as a plant. Real industrial sites are set out on a survey grid:
# buildings run parallel or perpendicular to the access road because the pipe
# runs, the rail spurs and the drainage all do. So every rotation is 0, 90, 180
# or 270.
#
# THE HEIGHT RULE. Nothing over 8 m tall stands within 60 m of road A. This used
# to be done at load time by the manifest's `pushback` block; it is baked in
# here now, and that block has to come out of environments.json.
#
#   (source, key, x, y, rotZ deg, note)
# ---------------------------------------------------------------------------
# 60 -> 45. "Levemente afastados da rua" was the ask, and 60 m was not slightly:
# it was the single biggest reason the plant read as scattered, because it
# pushed every tall piece — which is most of the process side — past a 60 m
# no-man's-land the low buildings could not fill on their own. 45 m still keeps
# a 24 m chimney out of a 31 m orbit by a wide margin.
TALL_SETBACK = 45.0

# PACKED INTO ROWS, WITH SERVICE GAPS. Every coordinate here was recomputed
# from the pieces' measured footprints (listed in ibc1.py and logged by
# dl_packs) so that neighbours sit 5-15 m apart rather than 20-40. That is not a
# style preference: a plant with 30 m of empty concrete between every unit is a
# car park with machinery parked on it, and audit_layout now MEASURES it and
# prints SPRAWL for anything whose nearest neighbour is further than 16 m.
#
# The rows, east to west:
#
#   x  ~15..33   pipe racks, running along the road as a low wall
#   x  ~29..66   the front row: docks, sheds, office — what a truck comes to
#   x  ~65..105  the second row: long halls and the barrel warehouse
#   x ~103..133  the tall row: chimney stacks, block cluster
#   x   0, -25   the two carriageways and the median
#   x -36..-57   the car park
#   x -38..-58   tank, basin, process block
#   x -60..-85   the office cluster the car park belongs to
#   x -85..-155  the process side, tallest furthest
LAYOUT = [
    # ---- EAST of road A: the logistics side. Low, close, facing the road.
    ("dl", "dock",     (  40.0,  16.0),  90, "loading docks"),
    ("dl", "shed_old", (  39.0, -14.0),   0, "old warehouse"),
    ("dl", "office",   (  40.0, -40.0),   0, "site office"),
    ("dl", "shed_sm",  (  40.0,  42.0),   0, "small warehouse"),
    ("dl", "hall_big", (  48.0,  74.0),   0, "main hall + canopy"),

    # ---- EAST, second row.
    ("ibc", 12,        (  80.0,  18.0),   0, "long hall"),
    ("ibc", 14,        (  78.0, -46.0),   0, "barrel warehouse"),
    ("ibc", 15,        (  78.0,  82.0),   0, "long shed"),
    ("ibc", 13,        (  86.0, -92.0),   0, "block cluster 11 m"),

    # ---- EAST, the tall row and the pipe racks on the kerb line.
    ("ibc", 11,        ( 118.0,  20.0),   0, "chimney stacks 24 m"),
    # 17, not 22: at 22 its east face overlapped the dock sheds by 1.6 m. A pipe
    # rack hard against the kerb line is also what a pipe rack does.
    ("ibc", 2,         (  17.0, 116.0),  90, "pipe rack 50 m"),
    ("ibc", 1,         (  22.0, -74.0),  90, "pipe rack 30 m"),

    # ---- WEST of road B: yard gear, then the offices the car park serves.
    ("ibc", 10,        ( -44.0, -54.0),   0, "white storage tank"),
    ("ibc", 7,         ( -42.0, -68.0),   0, "basin"),
    ("ibc", 6,         ( -52.0, -26.0),   0, "process block 11 m"),
    # THE OFFICE CLUSTER. The studio's default view looks west over the truck,
    # so this row IS the hero shot's middle distance — and the first render of
    # it was bare concrete with a car park drawn on it. A car park belongs to a
    # door; without one it reads as markings in a field.
    ("dl", "midcentury_a", ( -72.0,  22.0),  90, "office block"),
    ("dl", "midcentury_b", ( -72.0,  60.0),  90, "workshop"),
    ("dl", "midcentury_c", ( -70.0, -12.0),   0, "stores"),
    ("dl", "midcentury_d", ( -70.0, 102.0),  90, "training block"),

    # ---- WEST, the process side. Tallest furthest, all past TALL_SETBACK.
    ("ibc", 5,         ( -96.0, -70.0),   0, "column + vessel 29 m"),
    ("ibc", 8,         (-106.0,  30.0),   0, "plant complex 24 m"),
    ("ibc", 4,         (-118.0, -114.0),  0, "process unit + turbine"),
    ("ibc", 3,         (-125.0, 112.0),   0, "drum racks / walkway 38 m"),

    # ---- NORTH: the gate.
    ("dl", "booth",    (  12.0, 226.0),   0, "gate booth"),
    ("ibc", 9,         ( -14.0, 224.0),   0, "vent pole at the gate"),
]

# REPEATS, AND WHY THEY ARE ALLOWED HERE.
#
# An older note in this file forbade cloning outright — "the collection is
# SIXTEEN PIECES and the reference uses each one ONCE" — after a build that
# tripled the district into 34 pieces and stopped being the reference at all.
# That lesson was about inventing two more FACTORIES, and it still stands for
# the process side: there is one plant complex, one turbine hall, one set of
# stacks, because a site has one of each.
#
# It was over-applied to the sheds. A logistics yard genuinely has three or four
# near-identical dock sheds in a row — that is what a shed IS — and refusing to
# repeat them is a large part of why the front row had 30 m holes in it.
#
# These are LINKED duplicates: `dup.data = src.data`, so each costs one node and
# zero vertices, and the glTF exporter emits them as instances.
#
#   (source, key, x, y, rotZ, note)
DUPES = [
    # the dock row: four bays of the same shed, which is how one gets built
    ("dl", "dock",     (  40.0, 108.0),  90, "dock shed 2"),
    ("dl", "dock",     (  40.0, 138.0),  90, "dock shed 3"),
    ("dl", "shed_old", (  39.0, -66.0),   0, "old warehouse 2"),
    ("dl", "shed_sm",  (  40.0, -92.0),   0, "small warehouse 2"),
    ("dl", "shed_sm",  (  40.0, -114.0),  0, "small warehouse 3"),
    # second row, filling north of the long shed
    ("ibc", 14,        (  78.0, 128.0),   0, "barrel warehouse 2"),
    ("ibc", 15,        ( 112.0, 100.0),   0, "long shed 2"),
    ("ibc", 12,        ( 124.0, -60.0),   0, "long hall 2"),
    # west yard gear: tank farms come in pairs, basins in banks
    ("ibc", 10,        ( -44.0, -40.0),   0, "storage tank 2"),
    ("ibc", 7,         ( -42.0, -78.0),   0, "basin 2"),
    ("ibc", 7,         ( -42.0, -88.0),   0, "basin 3"),
    ("dl", "shed_old", ( -46.0, 120.0),   0, "west store"),
    ("dl", "office",   ( -46.0, 146.0),   0, "west office 2"),
]

# The mid-century file explodes into ~16 separate buildings (dl_packs
# .split_midcentury). They are two-storey masonry offices and workshops — the
# wrong thing to put inside a process plant and exactly the right thing to put
# ACROSS THE ROAD FROM IT, where they do the job the deleted second ring was
# invented for: they close the horizon without inventing another factory.
#
# Placed along the far south and the far north, they read as the district the
# plant sits in. Coordinates are (x, y, rot); the list is consumed in order and
# runs out when the buildings do.
MIDCENTURY_SITES = [
    (-158.0, 272.0,   0), (-104.0, 276.0,   0), ( -52.0, 270.0,   0),
    (  46.0, 274.0,   0), ( 100.0, 270.0,   0), ( 152.0, 276.0,   0),
    (-146.0, -270.0, 180), ( -88.0, -274.0, 180), ( -32.0, -268.0, 180),
    (  56.0, -272.0, 180), ( 112.0, -268.0, 180),
]

# Containers, skips and cabinets. 6 m boxes beside a 19 m rig are the best scale
# cue an open yard has — but scattered they read as loose props, so they are
# STACKED AND GROUPED the way a yard actually stores them.
# The container is 6.1 m LONG and 2.3 m WIDE, and the pitch has to follow the
# rotation or the boxes are inside each other.
#
# THAT IS THE "TEXTURA PISCANDO". It was never a texture: the rot-90 group was
# laid on a 2.5 m pitch along y, which is the pitch for the 2.3 m WIDTH — but at
# 90 degrees it is the 6.1 m LENGTH that runs along y, so each box overlapped the
# next by 3.6 m. Three containers occupying one container's volume is 3.6 m of
# coplanar rusty steel, and coplanar surfaces flicker. The placement audit now
# reports this as STACK rather than leaving it to be read off a screenshot.
#
#   rot 0  -> 6.1 along x, 2.3 along y  -> pitch 2.5 along y
#   rot 90 -> 2.3 along x, 6.1 along y  -> pitch 6.3 along y
CONTAINERS = [
    ( 24.0, -28.0, 90), ( 24.0, -34.3, 90), ( 24.0, -40.6, 90),
    ( 62.0,  60.0,  0), ( 62.0,  62.5,  0), ( 62.0,  65.0,  0),
    (-40.0,  86.0,  0), (-40.0,  88.5,  0),
    (-58.0, -100.0, 90),
]
SKIPS = [(30.0, -30.0, 12), (56.0, 32.0, -8)]
CABINETS = [(9.6, 60.0, 180), (9.6, -100.0, 180), (-34.5, 128.0, 0)]

# Vent poles, well clear of the orbit.
POLES = [(-38, 44), (58, 104), (-60, -96)]


# IBC1 pieces to thin, and the ratio. index -> keep fraction.
#
# THESE THREE ARE 5.4 MB OF THE EXPORT BETWEEN THEM — model_3 alone was 2.29 MB,
# more than every texture in the file put together. They are the open lattice
# pieces (drum racks, two pipe racks), which are expensive for the obvious
# reason: a truss is mostly edges. All three stand between 120 and 200 m from
# the origin, behind the near buildings, and none is ever the subject of a shot.
#
# Decimation is applied DESTRUCTIVELY because the export runs with
# export_apply=False — a Decimate modifier left unapplied ships at full density
# and quietly does nothing.
IBC_THIN = {3: 0.45, 1: 0.5, 2: 0.5}


# Internal service roads — (x0, x1, y0, y1) in metres.
#
# WHY THEY ARE FLUSH ASPHALT ON THE SLAB AND NOT REAL CARRIAGEWAYS. A proper
# road needs a level, a camber, a channel and a kerb, and where it met road A it
# would need a junction that reconciles the slab (+12 cm) with the carriageway
# (0 to -5.5 cm). An internal plant road is not built that way in life either:
# it is an asphalt overlay laid ON the concrete apron, 3-5 cm proud, marked but
# not kerbed. So that is what these are — which is simultaneously the honest
# construction and the one that cannot produce a level mismatch.
#
# They are laid in the gaps the building rows already leave, so they explain the
# gaps instead of the gaps being leftovers.
SERVICE_ROADS = [
    (   7.2, 132.0,   52.0,  60.0),    # east cross street, dock frontage
    ( -146.0, -32.0,  88.0,  96.0),    # west cross street, office row
]


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def thin_prototypes(ibc):
    for idx, ratio in IBC_THIN.items():
        entry = ibc.get(idx)
        if not entry:
            continue
        ob = entry[0]
        n = len(ob.data.polygons)
        md = ob.modifiers.new("dec", "DECIMATE")
        md.ratio = ratio
        for o in bpy.data.objects:
            o.select_set(o is ob)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.modifier_apply(modifier=md.name)
        log("  thinned model_%d %d -> %d faces" % (idx, n, len(ob.data.polygons)))


def _load(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, name + ".py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def place(obj, x, y, rot_deg, on="yard"):
    """Prototypes are recentred on their own footprint with the floor on z=0, so
    placement is an assignment and a rotation about the object origin keeps the
    piece on its mark.

    THE Z IS SAMPLED, NOT ZERO. The yard is 12 cm above the road and undulates
    +/- 6 cm; dropping a building at z=0 would leave daylight under it on the
    high spots. It is sunk 6 cm below the sampled surface so the joint is always
    a building meeting ground, never a building hovering over it.
    """
    obj.rotation_mode = "XYZ"
    obj.rotation_euler = (0.0, 0.0, math.radians(rot_deg))
    z = surface_z(x, y) if on == "yard" else grass_z(x, y)
    obj.location = (x, y, z - 0.06)


def clone(src, name):
    """Linked duplicate: `dup.data = src.data`, NOT `.copy()`. The mesh datablock
    is shared, so a clone costs one object and one draw call and zero vertices."""
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

    THIS IS THE PART THAT WAS ONCE MISSING. Four layouts were authored by
    writing coordinates and looking at a render, which catches nothing
    quantitative: not a building standing inside another, not a 30 m void that
    makes the plant read as scattered, not a piece blocking the truck. All three
    shipped. Reports OVERLAP, nearest-neighbour GAP, intrusion on CLEAR_RADIUS,
    and — new here — any tall piece inside TALL_SETBACK of road A.
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
    for li, lo_i, hi_i in boxes:
        h = hi_i.z - lo_i.z
        if h < 8.0:
            continue
        near_x = max(lo_i.x - ROAD_A_X, ROAD_A_X - hi_i.x, 0.0)
        if near_x < TALL_SETBACK:
            log("  SETBACK  %s is %.0f m tall and only %.0f m from road A"
                % (li, h, near_x))
            bad += 1
    for i in range(len(boxes)):
        li, lo_i, hi_i = boxes[i]
        dx = max(lo_i.x, 0.0, -hi_i.x)
        dy = max(lo_i.y, 0.0, -hi_i.y)
        if math.hypot(dx, dy) < CLEAR_RADIUS:
            log("  CLEAR    %s intrudes on the orbit (%.1f m)" % (li, math.hypot(dx, dy)))
            bad += 1
    # SPRAWL, WHICH IS THE METRIC THAT WAS MISSING. Overlap and clearance were
    # both measured; the thing nobody measured was EMPTINESS, and emptiness is
    # what the last build got wrong — "as construcoes ficam muito afastadas umas
    # das outras". A nearest-neighbour distance is one line of arithmetic and it
    # turns "looks scattered" into a number, which is the only form of it that
    # can be fixed on purpose.
    far = 0
    gaps = []
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
        gaps.append(best)
        if best > 16.0:
            log("  SPRAWL   %-22s %5.1f m to its nearest neighbour (%s)"
                % (li, best, who))
            far += 1
    if gaps:
        gaps.sort()
        log("  gaps: median %.1f m, worst %.1f m, %d over 16 m"
            % (gaps[len(gaps) // 2], gaps[-1], far))
    log("  audit: %d problems over %d pieces" % (bad, len(boxes)))
    return bad


def layout(ibc, dl):
    boxes = []
    used = 0
    mc_keys = sorted(k for k in dl if k.startswith("mc_"))
    mc_next = [0]

    def pick(source, key):
        if source == "ibc":
            return ibc.get(key)
        if key.startswith("midcentury_"):
            # a named draw from the mid-century pool, for the one office block
            # that belongs inside the fence
            if mc_next[0] < len(mc_keys):
                k = mc_keys[mc_next[0]]
                mc_next[0] += 1
                return dl.get(k)
            return None
        return dl.get(key)

    resolved = {}
    for source, key, (x, y), rot, note in LAYOUT:
        entry = pick(source, key)
        if entry is None:
            log("  MISSING %s/%s (%s)" % (source, key, note))
            continue
        ob = entry[0]
        resolved[(source, key)] = ob
        place(ob, x, y, rot)
        bpy.context.view_layer.update()
        lo, hi = world_bbox(ob)
        dx = max(lo.x, 0.0, -hi.x)
        dy = max(lo.y, 0.0, -hi.y)
        near = math.hypot(dx, dy)
        log("  %-14s -> (%7.1f,%7.1f) rot %3d  h=%5.1f near=%5.1f"
            % (note[:14], x, y, rot, hi.z - lo.z, near))
        boxes.append((note[:18], lo, hi))
        used += 1

    # ---- the repeats, into the SAME audit ---------------------------------
    # They go through world_bbox and into `boxes` exactly like the originals,
    # because a duplicate standing inside another building is still a building
    # standing inside another building.
    n_dup = 0
    for source, key, (x, y), rot, note in DUPES:
        src = resolved.get((source, key))
        if src is None:
            log("  MISSING dupe source %s/%s (%s)" % (source, key, note))
            continue
        d = clone(src, "dup_%02d" % n_dup)
        place(d, x, y, rot)
        bpy.context.view_layer.update()
        lo, hi = world_bbox(d)
        boxes.append((note[:18], lo, hi))
        n_dup += 1
    log("  repeats: %d linked duplicates" % n_dup)

    # the mid-century district, outside the wire
    n = 0
    for x, y, rot in MIDCENTURY_SITES:
        if mc_next[0] >= len(mc_keys):
            break
        entry = dl.get(mc_keys[mc_next[0]])
        mc_next[0] += 1
        if entry is None:
            continue
        place(entry[0], x, y, rot, on="grass")
        n += 1
    log("  mid-century district: %d buildings outside the wire" % n)

    entry = ibc.get(0)
    if entry:
        for i, (x, y, rot) in enumerate(CONTAINERS):
            place(clone(entry[0], "cont_%02d" % i), x, y, rot)
        place(entry[0], -50.0, 104.0, 0)
        log("  containers: %d" % (len(CONTAINERS) + 1))

    entry = ibc.get(9)
    if entry:
        for i, (x, y) in enumerate(POLES):
            place(clone(entry[0], "pole_%02d" % i), x, y, rnd.uniform(0, 360))
        log("  vent poles: %d" % len(POLES))

    entry = dl.get("skip")
    if entry:
        for i, (x, y, rot) in enumerate(SKIPS[1:]):
            place(clone(entry[0], "skip_%02d" % i), x, y, rot)
        place(entry[0], SKIPS[0][0], SKIPS[0][1], SKIPS[0][2])
        log("  skips: %d" % len(SKIPS))

    entry = dl.get("cabinet")
    if entry:
        for i, (x, y, rot) in enumerate(CABINETS[1:]):
            place(clone(entry[0], "cab_%02d" % i), x, y, rot)
        place(entry[0], CABINETS[0][0], CABINETS[0][1], CABINETS[0][2])
        log("  cabinets: %d" % len(CABINETS))

    audit_layout(boxes)
    log("  layout: %d/%d placed" % (used, len(LAYOUT)))


# ---------------------------------------------------------------------------
# Ground materials.
#
# These carry NO textures. They are NAMED SLOTS — the engine binds
# `/textures/asphalt_*`, `/textures/concrete_*` etc. to them at load time from
# environments.json `set.materials`. That keeps set.glb small and reuses the PBR
# sets the app already ships instead of baking a second copy of the same 4K
# asphalt into every environment.
#
# ANY NAME ADDED HERE MUST BE ADDED TO environments.json TOO — and the reverse
# matters more than it looks: set.ts collectSolids treats a mesh whose materials
# are ALL declared in that block as ground, i.e. not an obstacle the camera has
# to dodge. That is right for grass and paint and wrong for a fence, which is
# why the fence materials below are deliberately NOT named there.
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
             on_terrain=True, dz=0.0, flat_z=None, z_fn=None, cuts_y=None):
    """A subdivided plane that FOLLOWS the terrain.

    `cuts` matters more than it looks: the vertex-colour patchiness below is
    only as fine as the topology carrying it, and this is the surface the whole
    scene stands on.

    IT ALSO COSTS MORE THAN IT LOOKS, and `cuts_y` exists because of it. Every
    ground vertex carries position, normal, UV and COLOR_0 — about 40 bytes —
    and a square grid spends them uniformly whether or not the surface is
    square. A 13 x 1180 m carriageway cut 130 x 130 was sampling the ground
    every 10 CENTIMETRES across the road and every 9 METRES along it, and it
    cost 1.5 MB of the export per carriageway to get the ratio exactly backwards.
    """
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=max(1, cuts), y_segments=max(1, cuts_y or cuts),
                          size=0.5, matrix=Matrix.Identity(4))
    bmesh.ops.scale(bm, vec=(w, d, 1.0), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(cx, cy, 0.0), verts=bm.verts)
    uv = bm.loops.layers.uv.new("UVMap")
    for v in bm.verts:
        if z_fn is not None:
            v.co.z = z_fn(v.co.x, v.co.y) + dz
        else:
            v.co.z = (flat_z if flat_z is not None
                      else (yard_z(v.co.x, v.co.y) if on_terrain else 0.0)) + dz
    for f in bm.faces:
        for l in f.loops:
            l[uv].uv = (l.vert.co.x / uv_scale, l.vert.co.y / uv_scale)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    return ob


def add_slab(name, x0, x1, y0, y1, material, cell=4.5, uv_scale=8.0, z_fn=None,
             seed=1.0):
    """A rectangle of ground WITH THE ROAD CORRIDOR CUT OUT.

    THIS IS THE FIX FOR THE BUG THAT HID BOTH CARRIAGEWAYS. Making the yard sit
    ABOVE the road — which is what a kerb retaining made ground means — quietly
    inverted an assumption the whole ground stack had relied on since it was
    written: that the road is the HIGHEST surface, so it can be laid straight
    across everything else and simply win the depth test. It was, at z=0, over a
    yard at -14 cm.

    At +12 cm the yard stopped losing that test and became a 468 m concrete lid
    over both roads, the gutters, the kerbs and every marking on them. The
    top-down render is unambiguous: a plant with a green median and no roads
    either side of it.

    So ground that would span the corridor is emitted as two slabs instead, and
    the corridor itself is owned by exactly the meshes that belong there — the
    two carriageways, their gutters and kerbs, and the median between them.
    Surfaces BELOW the road (outland at -28 cm, outer at -30 cm) are left whole:
    they never contested it in the first place.
    """
    cw0, cw1 = ROAD_B_X - _EDGE, ROAD_A_X + _EDGE
    spans = []
    if x0 < cw0:
        spans.append((x0, min(x1, cw0)))
    if x1 > cw1:
        spans.append((max(x0, cw1), x1))
    out = []
    for i, (a, b) in enumerate(spans):
        w, d = b - a, y1 - y0
        if w <= 0.5 or d <= 0.5:
            continue
        ob = add_grid("%s_%d" % (name, i), w, d, material,
                      cx=(a + b) / 2.0, cy=(y0 + y1) / 2.0,
                      cuts=max(2, int(w / cell)), cuts_y=max(2, int(d / cell)),
                      uv_scale=uv_scale, z_fn=z_fn)
        paint_variation(ob, seed=seed + i * 0.7)
        out.append(ob)
    return out


def paint_variation(ob, seed=0.0, road_wear=False, cx=0.0):
    """Bake large-scale patchiness into the ground's vertex colours.

    A tiled PBR set repeated 200 times across a kilometre reads as one flat tone
    at distance: every tile averages to the same colour, so the plane looks
    painted rather than paved. Vertex colour multiplies the albedo, so a few
    octaves of low-frequency noise give the wear, damp and old-repair variation
    a real yard has, at the cost of one COLOR_0 attribute and no extra texture.

    FLOAT_COLOR on the CORNER domain via color_attributes, NOT the legacy
    vertex_colors API — that one makes a BYTE_COLOR layer, and a byte channel
    cannot hold what this writes. And the layer must be ACTIVE: Blender's glTF
    exporter writes the mesh's ACTIVE colour attribute, and a freshly added one
    is not automatically active. Several builds' worth of ground variation was
    computed, stored and then dropped for exactly that reason, shipping an
    all-white COLOR_0 while the log happily reported the range it had computed.
    """
    me = ob.data
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
        #   broad   whole regions of the yard damp or bleached  (~90 m)
        #   medium  wear around where things stand               (~22 m)
        #   fine    the grain that keeps it from looking airbrushed (~5 m)
        broad = fbm(x / 90.0, y / 90.0, s, 4)
        medium = fbm(x / 22.0, y / 22.0, s + 71, 4)
        fine = fbm(x / 5.0, y / 5.0, s + 131, 3)
        n = 0.56 * broad + 0.30 * medium + 0.14 * fine
        # fBm piles up around 0.5, so a straight remap wastes most of the range:
        # expanding about the midpoint spends all of it and gives the yard
        # genuinely light and genuinely dark regions rather than a grey wobble.
        n = min(1.0, max(0.0, (n - 0.5) * 2.1 + 0.5))
        k = 0.46 + 0.62 * n
        if road_wear:
            # Two darker bands where wheels actually track, and a lighter crown
            # between them: the read every driver has of every road.
            for lane in (cx - 3.1, cx + 3.1):
                k *= 1.0 - 0.16 * math.exp(-((x - lane) ** 2) / 2.2)
            k *= 1.0 + 0.05 * math.exp(-((x - cx) ** 2) / 3.0)
        k = max(0.38, min(1.0, k))
        lo_k = min(lo_k, k)
        hi_k = max(hi_k, k)
        # Damp ground is slightly cooler as well as darker; a pure grey ramp
        # reads as a lighting artefact rather than as a wet patch.
        attr.data[li].color = (k, k * 0.995, min(1.0, k * 0.982), 1.0)
    me.update()
    # READ BACK. Logging the k we computed only proves we did arithmetic; it
    # says nothing about whether the attribute kept it, which is exactly the
    # distinction that hid the all-white bug for several builds.
    rb = me.color_attributes.get("Col")
    r0 = min(c.color[0] for c in rb.data)
    r1 = max(c.color[0] for c in rb.data)
    log("    vcol %-9s computed %.2f..%.2f  stored %.2f..%.2f  (%d loops)"
        % (ob.name[:9], lo_k, hi_k, r0, r1, len(me.loops)))


# ---------------------------------------------------------------------------
# Painted markings.
#
# THE OLD MARKINGS WERE THE MOST ARTIFICIAL THING ON THE SITE, and not because
# of where they were: because every one of them was a single flat quad at one
# flat tone. Paint does not behave like that. It wears off in the wheelpath
# first, it survives in the gutter where nothing drives, it goes patchy over a
# rough patch of asphalt, and a bay at the far end of a yard nobody uses has
# been gone for years. One tone across every mark says "decal" no matter how
# good the tone is.
#
# So a mark here is not a quad. It is a STRIP subdivided along its own length,
# carrying COLOR_0 wear from four independent sources:
#
#   * an fBm field in world space, so neighbouring marks agree about which part
#     of the yard is worn — wear that stops at a mark's boundary is just another
#     way of drawing a rectangle
#   * the wheelpath, ~3.1 m either side of a carriageway's centreline
#   * a per-mark random health, so entire bays fade out while their neighbours
#     do not
#   * a touch of edge softening across the mark's width, because paint thins at
#     the edge of the roller
# ---------------------------------------------------------------------------
def add_marks(name, material, marks, seg_len=0.75, dz=0.012, z_fn=None):
    """`marks` is a list of (cx, cy, w, d, rot_deg, health).

    `health` 1.0 is fresh paint, 0.0 is gone. Everything else is measured off
    the world position, so the same yard looks the same from mark to mark.
    """
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    zf = z_fn or (lambda x, y: surface_z(x, y))
    health_of = {}
    for m in marks:
        cx, cy, w, d, rot, health = m
        rot = math.radians(rot)
        c, s = math.cos(rot), math.sin(rot)
        # subdivide along the LONGER axis, which is the direction paint wears
        # along; a 5 m bay line split into one quad wears uniformly and that is
        # the whole failure being fixed
        n = max(1, int(round(max(w, d) / seg_len)))
        along_y = d >= w
        # A LADDER, NOT A PILE OF QUADS. Built as independent quads, a 5 m bay
        # line was 7 segments x 4 unstitched vertices = 28; as shared
        # cross-sections it is 16, and the seam between two segments stops being
        # a place where the wear value can disagree with itself.
        sections = []
        for k in range(n + 1):
            t = k / float(n) - 0.5
            pair = []
            for e in (-0.5, 0.5):
                lx, ly = (e * w, t * d) if along_y else (t * w, e * d)
                x = cx + lx * c - ly * s
                y = cy + lx * s + ly * c
                v = bm.verts.new((x, y, zf(x, y) + dz))
                health_of[v] = health
                pair.append(v)
            sections.append(pair)
        for k in range(n):
            a0, a1 = sections[k]
            b0, b1 = sections[k + 1]
            f = bm.faces.new((a0, a1, b1, b0))
            for l in f.loops:
                l[uv].uv = (l.vert.co.x, l.vert.co.y)
    bm.verts.index_update()
    hv = {}
    for v, h in health_of.items():
        hv[v.index] = h
    bm.to_mesh(me)
    bm.free()

    attr = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="CORNER")
    try:
        me.color_attributes.active_color = attr
        me.color_attributes.render_color_index = me.color_attributes.find("Col")
    except Exception:
        pass
    lo_k, hi_k = 1e9, -1e9
    for li, loop in enumerate(me.loops):
        vi = loop.vertex_index
        p = me.vertices[vi].co
        x, y = p.x, p.y
        health = hv.get(vi, 1.0)
        # broad + fine wear, in WORLD space so it crosses mark boundaries
        n = 0.62 * fbm(x / 17.0, y / 17.0, 401, 4) + 0.38 * fbm(x / 3.1, y / 3.1, 457, 3)
        k = 0.30 + 1.05 * n
        cx = road_cx(x)
        if cx is not None:
            for lane in (cx - 3.1, cx + 3.1):
                k *= 1.0 - 0.42 * math.exp(-((x - lane) ** 2) / 2.6)
        k *= 0.30 + 0.75 * health
        k = max(0.10, min(1.0, k))
        lo_k = min(lo_k, k)
        hi_k = max(hi_k, k)
        # Worn paint does not go grey, it goes the colour of what is under it,
        # so the ramp is warmed very slightly toward the asphalt rather than
        # desaturated toward black.
        attr.data[li].color = (k, k * 0.985, k * 0.95, 1.0)
    me.update()
    me.materials.append(material)
    log("    %-10s %d marks -> %d faces, wear %.2f..%.2f"
        % (name, len(marks), len(me.polygons), lo_k, hi_k))
    return ob


def _dashes(cx, out, y0, y1, mark=3.0, gap=6.0, w=0.14, health=1.0):
    """CONTRAN dash spacing, 3 m mark / 6 m gap, with the geometry jittered.

    A dashed line laid on an exact 9 m pitch with an exact 3 m mark is a ruler,
    and the eye reads rulers as CG instantly. Real dashes are sprayed by a
    machine following a driver: the pitch drifts, the marks vary a few
    centimetres, and every so often one is short because the gun blocked.
    """
    y = y0
    i = 0
    while y < y1:
        j = _hash01(int(y), int(cx * 10), 733)
        m = mark * (0.88 + 0.24 * j)
        h = health * (0.55 + 0.55 * _hash01(int(y) * 3, i, 907))
        if _hash01(int(y), i, 331) > 0.06:          # the occasional missing dash
            out.append((cx + (j - 0.5) * 0.05, y + m / 2.0, w, m, 0.0, h))
        y += m + gap * (0.9 + 0.2 * _hash01(i, int(y), 137))
        i += 1


def _bay_rows(out, x0, y0, rows, per_row, bay_w=2.5, bay_d=5.0, aisle=6.5,
              line=0.12, along_y=True):
    """A parking aisle: two ranks of bays nose to nose with a lane between.

    Only the DIVIDERS are painted, not a box per bay — a real lot paints a T at
    each division and a continuous line at the head of the rank, which is both
    what it looks like and a third of the geometry.
    """
    for r in range(rows):
        xr = x0 - r * (bay_d + aisle)
        for k in range(per_row + 1):
            y = y0 + k * bay_w
            h = 0.30 + 0.70 * _hash01(int(y * 4), r * 17 + k, 613)
            # whole stretches of a lot go unrepainted; this is what makes some
            # bays nearly invisible while their neighbour is crisp
            h *= 0.45 + 0.75 * fbm(xr / 26.0, y / 26.0, 811, 3)
            out.append((xr - bay_d / 2.0, y, bay_d, line, 0.0, min(1.0, h)))
        head = 0.55 + 0.45 * _hash01(r, int(y0), 271)
        out.append((xr - bay_d, y0 + per_row * bay_w / 2.0, line,
                    per_row * bay_w, 0.0, head))


def build_markings(m_line):
    q = []
    # ---- both carriageways ------------------------------------------------
    for cx in (ROAD_A_X, ROAD_B_X):
        for sx in (-ROAD_W / 2 + 0.42, ROAD_W / 2 - 0.42):
            # The edge line is CONTINUOUS but it is not one 1180 m quad any
            # more: broken into 20 m runs, each with its own health, it fades
            # and returns the way a real edge line does.
            y = -ROAD_LEN / 2
            while y < ROAD_LEN / 2:
                seg = 20.0
                h = 0.35 + 0.65 * fbm(cx / 30.0, y / 30.0, 977, 3)
                q.append((cx + sx, y + seg / 2, 0.14, seg, 0.0, h))
                y += seg
        _dashes(cx, q, -330.0, 330.0)

    # ---- the gate: stop bar, crossing, and the give-way triangles ---------
    for cx in (ROAD_A_X, ROAD_B_X):
        q.append((cx, 224.0, ROAD_W - 0.9, 0.42, 0.0, 0.85))
        for k in range(7):
            q.append((cx - 4.5 + k * 1.5, 228.5, 0.55, 3.2, 0.0,
                      0.45 + 0.5 * _hash01(k, int(cx), 199)))

    # ---- hatching where the dock apron meets the road --------------------
    for k in range(11):
        q.append((20.0 + k * 0.9, 6.0 + k * 1.4, 3.4, 0.13, 32.0,
                  0.35 + 0.5 * _hash01(k, 7, 421)))

    # ---- the car park west of road B, and a smaller one east -------------
    # SIZED TO THE BUILDING THEY SERVE. 30 bays a row was 75 m of markings on
    # open concrete, which reads as a striped field rather than a car park —
    # a lot belongs to a door. These sit between road B and the office cluster.
    _bay_rows(q, -36.0, 10.0, rows=2, per_row=13)
    _bay_rows(q, -36.0, 48.0, rows=2, per_row=13)
    _bay_rows(q, 134.0, -50.0, rows=1, per_row=11)

    # ---- lorry bays along the east kerb: 3.5 x 18 m, which states the scale
    # of the thing standing on the road better than any car bay can
    # Pushed north to y ~96: at y=44 they sat directly behind the rig in the
    # default shot, so the hero frame's middle distance was a car park. It is
    # the dock building's job to be there.
    for k in range(6):
        y = -112.0 + k * 3.6
        q.append((16.0, y, 18.0, 0.15, 0.0,
                  0.30 + 0.6 * _hash01(k, 3, 557)))
    q.append((25.2, -112.0 + 5 * 3.6 / 2.0, 0.15, 6 * 3.6, 0.0, 0.7))

    ob = add_marks("markings", m_line, q)
    return ob


def build_kerbs(m_kerb, m_gutter):
    """The road/yard joint, which is what the brief asks to see.

    A CARRIAGEWAY DOES NOT SIMPLY STOP. It falls to a channel, the channel is a
    concrete gutter laid flush with the asphalt, the gutter is retained by a
    kerb, and the kerb holds back ground that is HIGHER than the road. The
    previous build had a single box beside a yard 14 cm BELOW the road, which is
    the one arrangement that explains nothing: a kerb with nothing behind it to
    retain, next to a step with nothing to justify it.

    KERBSTONES, NOT A KERB. The joints every 1.10 m are the detail: a 660 m
    extruded prism reads as a plastic strip at any distance, and the joint is
    the only thing that gives the eye a length to measure the site against.
    """
    kerbs = bmesh.new()
    gutters = bmesh.new()
    guv = gutters.loops.layers.uv.new("UVMap")
    kuv = kerbs.loops.layers.uv.new("UVMap")
    # KERBS STOP AT THE PROPERTY LINE, and that is realism and economy agreeing
    # for once. A kerb exists to retain made ground; past the gate the road runs
    # through open country and a rural carriageway has a verge, not a kerb.
    # Running it the full 1180 m was also 4 276 kerbstones and 3.7 MB of the
    # export — a fifth of the whole file spent on joints nobody can see at 500 m.
    n = 0
    y0, y1 = -YARD_HALF, YARD_HALF
    for cx in (ROAD_A_X, ROAD_B_X):
        for side in (-1, 1):
            xe = cx + side * ROAD_W / 2.0                  # channel line
            xg = xe + side * GUTTER_W                      # back of gutter
            xk = xg + side * KERB_W                        # back of kerb
            # ---- gutter: a flat strip from the asphalt edge to the kerb ----
            y = y0
            while y < y1:
                d = 6.0
                a, b = y, min(y1, y + d)
                za = road_z(xe, cx)
                vs = [gutters.verts.new((xe, a, za + 0.002)),
                      gutters.verts.new((xg, a, za + 0.020)),
                      gutters.verts.new((xg, b, za + 0.020)),
                      gutters.verts.new((xe, b, za + 0.002))]
                f = gutters.faces.new(vs)
                for l in f.loops:
                    l[guv].uv = (l.vert.co.x / 2.0, l.vert.co.y / 2.0)
                y += d
            # ---- kerbstones -------------------------------------------------
            y = y0
            i = 0
            while y < y1:
                # SEPARATE STONES ONLY WHERE THEY READ. The 1.5 cm joint every
                # 1.10 m is what gives the eye a length to measure the site
                # against — at 40 m. At 200 m it is four vertices per
                # sub-pixel gap, so past the near field the run becomes one
                # long prism and looks identical.
                near = abs(y) < 130.0
                seg = KERB_SEG if near else 9.0
                b = y + seg - (0.015 if near else 0.0)
                zb = road_z(xe, cx)
                top = KERB_TOP + 0.012 * (_hash01(i, int(cx), 53) - 0.5)
                lo_z = zb - 0.22
                x_in, x_out = (xg, xk) if side > 0 else (xk, xg)
                verts = {}
                for (px, py, pz) in ((x_in, y, lo_z), (x_out, y, lo_z),
                                     (x_out, b, lo_z), (x_in, b, lo_z),
                                     (x_in, y, top), (x_out, y, top),
                                     (x_out, b, top), (x_in, b, top)):
                    verts[(px, py, pz)] = kerbs.verts.new((px, py, pz))
                v = list(verts.values())
                for quad in ((0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1),
                             (3, 2, 6, 7), (0, 3, 7, 4), (1, 5, 6, 2)):
                    try:
                        f = kerbs.faces.new([v[k] for k in quad])
                    except ValueError:
                        continue
                    for l in f.loops:
                        l[kuv].uv = (l.vert.co.y / 1.2, l.vert.co.z / 1.2)
                n += 1
                y += seg
                i += 1

    for bm, mm, nm in ((kerbs, m_kerb, "kerbs"), (gutters, m_gutter, "gutters")):
        me = bpy.data.meshes.new(nm)
        ob = bpy.data.objects.new(nm, me)
        bpy.context.collection.objects.link(ob)
        bm.to_mesh(me)
        bm.free()
        me.materials.append(mm)
    log("  kerbs: %d stones + gutters on 4 channels" % n)


def build_ground():
    """The site, layer by layer, with every height change explained.

        line paint     +1.2 cm over whatever it lies on
        ROAD crown      0.0        <- the truck stands here
        road channel   -5.5 cm     (the carriageway is cambered, not flat)
        gutter          flush, rising 2 cm to the kerb
        kerb top       +15.5 cm
        yard           +12 cm, undulating +/- 6 cm  <- retained BY the kerb
        median         +12 cm, same datum as the yard
        grass inside   +2 cm, below the slab, because turf is not paving
        outland        -28 cm and falling away
        outer field    -30 cm

    NO PATCHES AND NO JOINT GRID, and the deletion is the fix rather than a
    retreat from it. A real yard IS a patchwork, but a hard-edged quad laid a
    centimetre above a flat plane does not read as a repair — it reads as a
    rectangle lying on the floor, and it is a z-fight waiting for a grazing
    camera. Variation comes only from things that cannot produce an edge: the
    vertex-colour field, and the tiled PBR set the engine binds at runtime.
    """
    m_yard = mat("GROUND_CONCRETE", (0.30, 0.30, 0.29, 1), 0.88)
    m_road = mat("ASPHALT_ROAD", (0.13, 0.13, 0.14, 1), 0.86)
    m_gutter = mat("CONCRETE_APRON", (0.34, 0.33, 0.31, 1), 0.85)
    m_gravel = mat("GRAVEL_SHOULDER", (0.28, 0.27, 0.25, 1), 0.93)
    # TWO GRASS MATERIALS BECAUSE THERE ARE TWO UV SCALES, and one material
    # cannot have both. Ground UVs here are metres/UV_M, and the manifest's
    # `repeat` then makes the tile UV_M/repeat metres — so UV_M and repeat have
    # to move together or the whole ground changes scale (that is what the
    # manifest's repeatNote is about).
    #
    # The near ground uses UV_M 8. The far ground CANNOT: `outer` is 1180 m
    # across, so at UV_M 8 its UVs reach +/-74 before repeat, and a mediump
    # varying — which is what a phone gives an interpolated UV — has a step of
    # ~12 cm up there, i.e. visible quantisation. The far bands use UV_M 64,
    # which is the existing GRASS_VERGE convention and why its repeat is 16.
    m_grass = mat("GRASS_VERGE", (0.17, 0.21, 0.12, 1), 0.94)     # far, UV_M 64
    m_near = mat("GRASS_NEAR", (0.16, 0.22, 0.11, 1), 0.94)       # near, UV_M 8
    m_line = mat("LINE_PAINT", (0.78, 0.76, 0.70, 1), 0.55)
    m_kerb = mat("KERB_CONCRETE", (0.40, 0.39, 0.37, 1), 0.80)

    # ---- outside everything, and why it reaches so far -------------------
    # OUTER FIELD first and lowest, so nothing it meets can z-fight with it. It
    # has to run past the haze shell at 570 m: a ground plane that ends inside
    # the far plane shows its own edge as a lit band under the fog, which was
    # the "estrada morrendo no nada" of the first build.
    g_out = add_grid("outer", GROUND, GROUND, m_gravel, cuts=56, uv_scale=64.0,
                     on_terrain=False, flat_z=-0.30)
    for v in g_out.data.vertices:
        v.co.z += 0.9 * undul(v.co.x * 0.35, v.co.y * 0.35)
    paint_variation(g_out, seed=3.1)

    # ---- the paved yard, either side of the road corridor ----------------
    add_slab("yard", YARD_X0, YARD_X1, YARD_Y0, YARD_Y1, m_yard,
             cell=4.6, uv_scale=8.0, z_fn=yard_z, seed=1.3)

    # ---- grass inside the wire, between the slab and the fence -----------
    # This band is the brief's "partes de grama antes das cercas", and it is
    # also what stops the plant reading as a slab with a fence drawn on it: a
    # real property line has unpaved ground behind it that nobody has any reason
    # to concrete.
    # The north and south bands straddle the corridor, so they go through
    # add_slab too; the east and west bands are clear of it and do not.
    add_slab("turf_n", -YARD_HALF, YARD_HALF, YARD_Y1, YARD_HALF, m_near,
             cell=8.0, z_fn=grass_z, seed=6.4)
    add_slab("turf_s", -YARD_HALF, YARD_HALF, -YARD_HALF, YARD_Y0, m_near,
             cell=8.0, z_fn=grass_z, seed=6.9)
    add_slab("turf_e", YARD_X1, YARD_HALF, YARD_Y0, YARD_Y1, m_near,
             cell=8.0, z_fn=grass_z, seed=7.3)
    add_slab("turf_w", -YARD_HALF, YARD_X0, YARD_Y0, YARD_Y1, m_near,
             cell=8.0, z_fn=grass_z, seed=7.7)

    # ---- the two carriageways -------------------------------------------
    # Spanning the whole ground, because a road that simply stops is the most
    # artificial thing a ground plane can do. Cambered, not flat: see road_z.
    for nm, cx in (("road_a", ROAD_A_X), ("road_b", ROAD_B_X)):
        # 10 across for the camber, 150 along for the wear field: the ratio a
        # 13 x 1180 m strip actually needs.
        r = add_grid(nm, ROAD_W, ROAD_LEN, m_road, cx=cx, cuts=10, cuts_y=150,
                     uv_scale=8.0, z_fn=lambda x, y, c=cx: road_z(x, c))
        paint_variation(r, seed=2.2 if cx == ROAD_A_X else 2.7,
                        road_wear=True, cx=cx)

    # ---- the median ------------------------------------------------------
    med = add_grid("median", MEDIAN_W, ROAD_LEN, m_near,
                   cx=(ROAD_A_X - _EDGE + ROAD_B_X + _EDGE) / 2.0,
                   cuts=8, cuts_y=140, uv_scale=8.0,
                   z_fn=lambda x, y: YARD_Z + undul(x, y) * 0.6)
    paint_variation(med, seed=8.8)

    build_markings(m_line)
    build_kerbs(m_kerb, m_gutter)
    build_outland(m_grass)
    return m_near


def build_outland(m_grass):
    """The land beyond the fence — and the "azulado depois da grama".

    WHAT THE BLUE BAND WAS. The engine draws a horizon-haze shell at 570 m
    painted with the PRESET's fogColor so fogged ground and fogged sky meet at
    one colour. That works when the sky is the procedural gradient. This
    environment uses the `rodovia` HDRI, whose horizon is a different hue, so
    the shell stopped being a blend and became a light-blue ribbon laid over the
    photograph. It is fixed in the manifest (`horizonColor`, measured off the
    HDRI's own horizon band), not here.

    AND NO BERM. A 3 m bank at 264 m drew a crisp dark ridge directly against
    that ribbon, and adding a hard silhouette in front of a seam does not hide
    the seam, it frames it. What is here instead is deliberately soft: very low,
    very broad relief that never presents an edge to the sky, so fog — not
    geometry — is what ends the ground.
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
        ob = add_grid(nm, w, d, m_grass, cx=cx, cy=cy, cuts=26, uv_scale=64.0,
                      on_terrain=False, flat_z=-0.28)
        for v in ob.data.vertices:
            x, y = v.co.x, v.co.y
            # Amplitude RAMPS IN with distance from the fence, so the ground
            # immediately outside the wire stays flat and level with the turf —
            # relief starting hard at the property line would be its own seam.
            t = min(1.0, max(0.0, (max(abs(x), abs(y)) - YARD_HALF) / 130.0))
            v.co.z += t * (2.4 * (fbm(x / 190.0, y / 190.0, 53, 4) - 0.5)
                           + 0.7 * (fbm(x / 46.0, y / 46.0, 97, 3) - 0.5))
        paint_variation(ob, seed=5.7)
    log("  outland: 4 bands, soft relief ramping in past the fence")


# ---------------------------------------------------------------------------
# Fence.
# ---------------------------------------------------------------------------
FENCE_H = 3.90              # to the top rail
FENCE_PLINTH = 0.45         # concrete upstand the posts are set into
FENCE_ARM = 0.55            # the barbed arm above the rail
FENCE_PITCH = 4.0           # post spacing


def _fence_mats():
    """Two materials WITH EMBEDDED TEXTURES, and deliberately not declared in
    environments.json.

    Everything else on the ground is a bare named slot the engine binds at
    runtime, which is what keeps set.glb small. The fence cannot be: its netting
    is an ALPHA CUTOUT and there is no chainlink alpha among the app's shared
    /textures. Keeping it out of the manifest's `materials` block matters for a
    second reason — set.ts collectSolids treats a mesh whose materials are all
    declared there as GROUND, i.e. not an obstacle. A perimeter the camera can
    fly through is not a perimeter.
    """
    props = _load("props_ph")
    wire = bpy.data.materials.get("FENCE_WIRE") or bpy.data.materials.new("FENCE_WIRE")
    wire.use_nodes = True
    nt = wire.node_tree
    b = nt.nodes.get("Principled BSDF")
    b.inputs["Roughness"].default_value = 0.72
    b.inputs["Metallic"].default_value = 0.25
    if os.path.exists(props.WIRE_ALPHA):
        img = bpy.data.images.load(props.WIRE_ALPHA, check_existing=True)
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = img
        t.extension = "REPEAT"
        nt.links.new(b.inputs["Base Color"], t.outputs["Color"])
        nt.links.new(b.inputs["Alpha"], t.outputs["Alpha"])
    else:
        log("  chainlink alpha missing: %s" % props.WIRE_ALPHA)
    # Alpha CUTOUT, not blend. Blended netting needs per-fragment sorting across
    # hundreds of metres of panel and still renders wrong against itself.
    # Clipped, it is order-independent and free. Blender has renamed these enums
    # more than once, so the value is probed rather than assumed.
    for val in ("CLIP", "DITHERED", "HASHED"):
        try:
            wire.blend_method = val
            break
        except TypeError:
            continue
    try:
        wire.alpha_threshold = 0.5
    except Exception:
        pass

    post = bpy.data.materials.get("FENCE_POST") or bpy.data.materials.new("FENCE_POST")
    post.use_nodes = True
    nt = post.node_tree
    b = nt.nodes.get("Principled BSDF")
    b.inputs["Roughness"].default_value = 0.55
    b.inputs["Metallic"].default_value = 0.85
    if os.path.exists(props.POSTS_DIFF):
        img = bpy.data.images.load(props.POSTS_DIFF, check_existing=True)
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = img
        nt.links.new(b.inputs["Base Color"], t.outputs["Color"])
    return wire, post


def _tube(bm, a, b, r, seg, mi):
    d = b - a
    ln = d.length
    if ln < 1e-6:
        return
    z = d.normalized()
    up = Vector((0, 0, 1)) if abs(z.z) < 0.95 else Vector((1, 0, 0))
    x = z.cross(up).normalized()
    y = z.cross(x)
    r0, r1 = [], []
    for i in range(seg):
        t = 2 * math.pi * i / seg
        o = x * math.cos(t) + y * math.sin(t)
        r0.append(bm.verts.new(a + o * r))
        r1.append(bm.verts.new(b + o * r))
    for i in range(seg):
        j = (i + 1) % seg
        bm.faces.new((r0[i], r0[j], r1[j], r1[i])).material_index = mi


def build_fence(m_kerb):
    """Perimeter fence on the property line, generated rather than imported.

    TALLER AND FURTHER, both asked for and both a number here now: ~4.35 m to
    the barbed tip against the old 3.6 m, standing at 330 m against 225 m. The
    old build's height was hostage to whatever kit was on disk — it normalised a
    ripped panel BY HEIGHT and then stretched X by 1.60 to get a believable post
    pitch, which is a lot of arithmetic to spend on not choosing.

    ONE MESH PER SIDE, not one object per panel. 2 640 m of perimeter at a 4 m
    pitch is 660 bays; as separate objects that is 660 draw calls for a thing
    that is 330 m away and mostly silhouette. Welded per side it is four.
    """
    wire, post = _fence_mats()
    total = 0
    for side in range(4):
        bm = bmesh.new()
        uv = bm.loops.layers.uv.new("UVMap")
        n = int((YARD_HALF * 2) / FENCE_PITCH)
        for i in range(n):
            t = -YARD_HALF + (i + 0.5) * FENCE_PITCH
            if side == 0:
                x, y, ax, ay = t, YARD_HALF, 1.0, 0.0
            elif side == 1:
                x, y, ax, ay = t, -YARD_HALF, 1.0, 0.0
            elif side == 2:
                x, y, ax, ay = YARD_HALF, t, 0.0, 1.0
            else:
                x, y, ax, ay = -YARD_HALF, t, 0.0, 1.0
            # Gates where each carriageway crosses the line. Only the north and
            # south runs are crossed; the east and west runs are continuous.
            if side in (0, 1) and (abs(t - ROAD_A_X) < ROAD_W * 0.75
                                   or abs(t - ROAD_B_X) < ROAD_W * 0.75):
                continue
            base = grass_z(x, y)
            a = Vector((x - ax * FENCE_PITCH / 2, y - ay * FENCE_PITCH / 2, base))
            b = Vector((x + ax * FENCE_PITCH / 2, y + ay * FENCE_PITCH / 2, base))
            # ---- posts, rails, netting ----------------------------------
            _tube(bm, a + Vector((0, 0, -0.35)), a + Vector((0, 0, FENCE_H)),
                  0.055, 6, 1)
            _tube(bm, a + Vector((0, 0, FENCE_H - 0.04)),
                  b + Vector((0, 0, FENCE_H - 0.04)), 0.032, 5, 1)
            _tube(bm, a + Vector((0, 0, FENCE_PLINTH + 0.06)),
                  b + Vector((0, 0, FENCE_PLINTH + 0.06)), 0.026, 5, 1)
            # netting: two triangles, and the only reason this is affordable
            zb, zt = base + FENCE_PLINTH, base + FENCE_H
            vs = [bm.verts.new((a.x, a.y, zb)), bm.verts.new((b.x, b.y, zb)),
                  bm.verts.new((b.x, b.y, zt)), bm.verts.new((a.x, a.y, zt))]
            f = bm.faces.new(vs)
            f.material_index = 0
            # 5 cm links: the UV has to be in METRES or the mesh scale changes
            # with the panel and the fence stops being one fence.
            span = FENCE_PITCH / 0.62
            hgt = (FENCE_H - FENCE_PLINTH) / 0.62
            for l, (u, v) in zip(f.loops, ((0, 0), (span, 0), (span, hgt), (0, hgt))):
                l[uv].uv = (u, v)
            # ---- barbed arm, leaning OUT over the approach --------------
            out = Vector((0, 1, 0)) if side == 0 else \
                  Vector((0, -1, 0)) if side == 1 else \
                  Vector((1, 0, 0)) if side == 2 else Vector((-1, 0, 0))
            tip = a + Vector((0, 0, FENCE_H)) + out * FENCE_ARM * 0.62 \
                + Vector((0, 0, FENCE_ARM * 0.78))
            _tube(bm, a + Vector((0, 0, FENCE_H - 0.05)), tip, 0.028, 4, 1)
            for k in range(3):
                s = (k + 1) / 3.0
                pa = a + Vector((0, 0, FENCE_H - 0.05)) + (tip - a - Vector((0, 0, FENCE_H - 0.05))) * s
                pb = pa + Vector((b.x - a.x, b.y - a.y, 0.0))
                _tube(bm, pa, pb, 0.009, 3, 1)
            total += 1
        for f in bm.faces:
            if f.material_index == 1 and len(f.loops) and not f.loops[0][uv].uv.length:
                for l in f.loops:
                    l[uv].uv = (l.vert.co.z * 0.5, 0.0)
        me = bpy.data.meshes.new("fence_%d" % side)
        ob = bpy.data.objects.new("fence_%d" % side, me)
        bpy.context.collection.objects.link(ob)
        bm.to_mesh(me)
        bm.free()
        me.materials.append(wire)
        me.materials.append(post)

    # ---- the concrete plinth the whole run stands on --------------------
    # It is why the fence can be tall without looking like a net on sticks, and
    # it is also the thing that hides the joint between wire and undulating turf.
    bmp = bmesh.new()
    puv = bmp.loops.layers.uv.new("UVMap")
    for side in range(4):
        step = 8.0
        n = int((YARD_HALF * 2) / step)
        for i in range(n):
            t = -YARD_HALF + (i + 0.5) * step
            if side in (0, 1) and (abs(t - ROAD_A_X) < ROAD_W * 0.75
                                   or abs(t - ROAD_B_X) < ROAD_W * 0.75):
                continue
            if side == 0:
                cx, cy, w, d = t, YARD_HALF, step, 0.26
            elif side == 1:
                cx, cy, w, d = t, -YARD_HALF, step, 0.26
            elif side == 2:
                cx, cy, w, d = YARD_HALF, t, 0.26, step
            else:
                cx, cy, w, d = -YARD_HALF, t, 0.26, step
            z = grass_z(cx, cy)
            res = bmesh.ops.create_cube(bmp, size=1.0,
                                        matrix=Matrix.Translation((cx, cy, z + FENCE_PLINTH / 2 - 0.12))
                                        @ Matrix.Diagonal((w, d, FENCE_PLINTH + 0.24, 1.0)))
            for v in res["verts"]:
                for lf in v.link_faces:
                    for l in lf.loops:
                        l[puv].uv = (l.vert.co.x / 2.0 + l.vert.co.y / 2.0, l.vert.co.z / 2.0)
    me = bpy.data.meshes.new("fence_plinth")
    ob = bpy.data.objects.new("fence_plinth", me)
    bpy.context.collection.objects.link(ob)
    bmp.to_mesh(me)
    bmp.free()
    me.materials.append(m_kerb)
    log("  fence: %d bays at %.1f m, %.2f m to the barb, on a %.2f m plinth"
        % (total, FENCE_PITCH, FENCE_H + FENCE_ARM * 0.78, FENCE_PLINTH))


# ---------------------------------------------------------------------------
# Planting.
#
# WHERE THE TREES CAN AND CANNOT GO, which is a camera question before it is a
# landscaping one. The orbit frames a 19 m rig and pulls in to a few metres, so
# anything inside ~45 m of the origin can end up between the lens and the truck.
# A building at that distance is a wall and obviously wrong; a tree is worse,
# because it is a thin thing that swings through frame and reads as a glitch.
#
# So the near median carries GRASS AND LOW SCRUB ONLY and the trees start at
# |y| > 52 m. That is not a compromise: junction sight lines are kept clear on
# real dual carriageways for exactly the same reason, so the rule that protects
# the camera is the rule that makes the median correct.
# ---------------------------------------------------------------------------
def plant(m_grass):
    veg = _load("veg")
    bark = mat("TREE_BARK", (0.20, 0.16, 0.13, 1), 0.92)
    leaf = mat("TREE_LEAF", (0.19, 0.26, 0.11, 1), 0.88)

    trees = [veg.make_tree("tree_%d" % i, 100 + i * 37,
                           7.0 + 5.5 * _hash01(i, 3, 61), bark, leaf,
                           lean=i * 1.1)
             for i in range(6)]
    # 0.7-1.15 m read as PEBBLES under 10 m trees — the perimeter render looked
    # like gravel scattered on the turf. Undergrowth has to be a fraction of the
    # canopy above it, not a hundredth.
    bushes = [veg.make_bush("bush_%d" % i, 200 + i * 53,
                            1.7 + 0.9 * _hash01(i, 9, 71), leaf)
              for i in range(4)]
    for t in trees + bushes:
        t.location = (0, 0, -500.0)          # the prototypes park underground

    n_tree = n_bush = 0

    def put(proto, x, y, tag, scale=1.0, on_grass=True):
        d = clone(proto, tag)
        d.rotation_mode = "XYZ"
        d.rotation_euler = (0.0, 0.0, _hash01(int(x), int(y), 17) * 6.283)
        s = scale * (0.82 + 0.36 * _hash01(int(y), int(x), 29))
        d.scale = (s, s, s)
        d.location = (x, y, (grass_z(x, y) if on_grass else surface_z(x, y)) - 0.10)
        return d

    # ---- the median: MOWN GRASS near the truck, an avenue further out -----
    #
    # NOTHING IS PLANTED WITHIN 78 m. The first version filled the near median
    # with scrub and the close-up render settled it: a generated bush is a
    # convincing mass at 60 m and a faceted lump at 10 m, and the near median is
    # the one piece of planting the studio camera can get close to. Mown grass
    # renders perfectly at any distance and is also what a real junction verge
    # looks like — sight lines are kept clear for the same reason the camera
    # needs them clear.
    med_x = (ROAD_A_X - _EDGE + ROAD_B_X + _EDGE) / 2.0
    y = -300.0
    i = 0
    while y < 300.0:
        i += 1
        jx = med_x + (_hash01(int(y), 1, 83) - 0.5) * (MEDIAN_W - 4.0)
        if abs(y) < 78.0:
            y += 12.0
            continue
        put(trees[i % len(trees)], jx, y, "med_tree_%d" % i, 1.0, on_grass=False)
        n_tree += 1
        y += 10.0 + 4.0 * _hash01(i, 2, 91)

    # ---- a belt inside the wire, which is what the fence is seen through -
    # Trees ON the property line do the job the deleted earth berm was invented
    # for, and do it without drawing a hard ridge against the sky: a broken
    # canopy occludes the ground/HDRI seam in patches instead of framing it.
    # TWO ROWS, STAGGERED, AND MUCH CLOSER TOGETHER. One row on a 12-20 m pitch
    # left daylight between every tree — "as arvores sao muito faltas" — and a
    # gappy single row does not occlude a horizon, which is the belt's actual
    # job. Two staggered rows on a 7-10 m pitch close into a canopy the way a
    # planted screen does, and because every tree is a linked duplicate of one of
    # six meshes, tripling the count costs nodes and no geometry at all.
    step = 7.0
    k = 0
    for row, (ring, phase) in enumerate(((YARD_HALF - 13.0, 0.0),
                                         (YARD_HALF - 27.0, step * 0.5))):
        for side in range(4):
            t = -ring + phase
            while t < ring:
                k += 1
                jitter = (_hash01(int(t), side * 7 + row, 131) - 0.5) * 7.0
                depth = ring - 7.0 * _hash01(side, int(t) + row, 151)
                if side == 0:
                    x, y2 = t + jitter, depth
                elif side == 1:
                    x, y2 = t + jitter, -depth
                elif side == 2:
                    x, y2 = depth, t + jitter
                else:
                    x, y2 = -depth, t + jitter
                t += step + 3.0 * _hash01(k, side, 171)
                # keep the gates and both carriageways clear
                if side in (0, 1) and (abs(x - ROAD_A_X) < 16.0
                                       or abs(x - ROAD_B_X) < 16.0):
                    continue
                put(trees[k % len(trees)], x, y2, "belt_tree_%d" % k, 1.12)
                n_tree += 1
                if _hash01(k, 4, 191) > 0.15:
                    put(bushes[k % len(bushes)],
                        x + 5.0 * (_hash01(k, 6, 211) - 0.5) * 2,
                        y2 + 5.0 * (_hash01(k, 7, 221) - 0.5) * 2,
                        "belt_bush_%d" % k)
                    n_bush += 1

    # ---- grass patches on the turf band, and weeds at the slab edge ------
    # Irregular discs, never rectangles — see veg.grass_patch for why that is
    # the whole difference between a patch and a decal.
    # DENSER AND OVERLAPPING. 46 isolated discs on a 660 m property read as
    # patches of something ELSE on bare ground rather than as rough grass — the
    # band has to be mostly covered for the gaps to read as the exception. They
    # are seeded on a jittered grid over the turf band rather than by polar
    # rejection, which is what left the first pass' bald quadrants.
    n_patch = 0
    i = 0
    patches = []
    gx = -YARD_HALF + 10.0
    while gx < YARD_HALF - 10.0:
        gy = -YARD_HALF + 10.0
        while gy < YARD_HALF - 10.0:
            i += 1
            x = gx + 16.0 * (_hash01(i, 11, 233) - 0.5)
            y = gy + 16.0 * (_hash01(i, 12, 239) - 0.5)
            gy += 22.0
            if on_paving(x, y):
                continue
            if _hash01(i, 15, 247) < 0.22:
                continue                       # the gaps, kept deliberate
            patches.append((x, y, 7.0 + 11.0 * _hash01(i, 13, 241), 300 + i))
            n_patch += 1
        gx += 22.0

    if patches:
        veg.grass_field("grass_patches", patches, m_grass, grass_z)
    # weeds where the slab meets the turf, which is where they actually grow
    for i in range(110):
        e = _hash01(i, 21, 251)
        if e < 0.5:
            x = YARD_X0 + (YARD_X1 - YARD_X0) * _hash01(i, 22, 257)
            y = (YARD_Y1 + 1.5) if e < 0.25 else (YARD_Y0 - 1.5)
        else:
            y = YARD_Y0 + (YARD_Y1 - YARD_Y0) * _hash01(i, 23, 263)
            x = (YARD_X1 + 1.5) if e < 0.75 else (YARD_X0 - 1.5)
        put(bushes[i % len(bushes)], x, y, "weed_%02d" % i, 0.42)
        n_bush += 1

    # THE PROTOTYPES MUST GO. They were parked at z=-500 to keep them out of
    # shot, which is not the same as keeping them out of the FILE: left linked
    # to the collection they export as six trees and four bushes buried half a
    # kilometre under the yard. Removing the OBJECT is safe — the clones hold
    # the mesh datablock alive, which is the whole point of a linked duplicate.
    for t in trees + bushes:
        bpy.data.objects.remove(t, do_unlink=True)

    log("  planting: %d trees, %d bushes, %d grass patches"
        % (n_tree, n_bush, n_patch))


def make_mast(name, material, height=9.5):
    """A column light for the road, generated.

    THE POLY HAVEN LAMP WAS THE WRONG LAMP. `street_lamp_02` is an ornamental
    cast-iron lantern — finial, scrolled bracket, glazed housing — and scaled to
    road height it put an 8 m Victorian gas lamp beside a chemical plant. It
    rendered exactly as absurd as that sounds, and it cost 2 598 faces and three
    textures to do it.

    A plant lights its roads with a galvanised mast and a flat floodlight head.
    That is 30 quads, it shares the fence's galvanised material so it adds no
    texture at all, and it is the same hand as everything else generated here —
    which is the homogeneity the brief asks for.
    """
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(material)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    _tube(bm, Vector((0, 0, -0.4)), Vector((0, 0, height * 0.55)), 0.15, 8, 0)
    _tube(bm, Vector((0, 0, height * 0.55)), Vector((0, 0, height)), 0.105, 8, 0)
    # the arm leans out over the carriageway, which is what makes it read as a
    # road light rather than a flagpole
    tip = Vector((1.75, 0, height + 0.42))
    _tube(bm, Vector((0, 0, height - 0.12)), tip, 0.075, 6, 0)
    res = bmesh.ops.create_cube(
        bm, size=1.0,
        matrix=Matrix.Translation(tip + Vector((0.28, 0, -0.06)))
        @ Matrix.Rotation(math.radians(-12), 4, "Y")
        @ Matrix.Diagonal((0.86, 0.42, 0.16, 1.0)))
    for v in res["verts"]:
        for f in v.link_faces:
            f.material_index = 0
    for f in bm.faces:
        for l in f.loops:
            l[uv].uv = (l.vert.co.z * 0.35, l.vert.co.x * 0.35)
    bm.to_mesh(me)
    bm.free()
    return ob


def dress(props):
    """Lamps, barriers and yard clutter — the things that say the site is used.

    LAMPS ARE WHY THE MANIFEST SAYS `lamps.enabled: false`: the set brings its
    own column line and the engine's procedural row would double it.
    """
    steel = bpy.data.materials.get("FENCE_POST") or mat("FENCE_POST", (0.55, 0.56, 0.58, 1), 0.5, 0.85)
    mast = make_mast("mast", steel)
    mast.location = (0, 0, -500.0)
    n = 0
    # Down the median, alternating which carriageway each arm reaches over —
    # which is how a single line of columns lights a dual carriageway — and
    # clear of the near field for the same reason the trees are.
    med_x = (ROAD_A_X - _EDGE + ROAD_B_X + _EDGE) / 2.0
    for k in range(-8, 9):
        y = k * 34.0
        if abs(y) < 60.0:
            continue
        d = clone(mast, "mast_m_%d" % k)
        d.rotation_mode = "XYZ"
        d.rotation_euler = (0, 0, math.radians(0 if k % 2 else 180))
        d.location = (med_x, y, YARD_Z - 0.06)
        n += 1
    # and along the east kerb of road A, arms reaching back over it
    # THE NEAR ONES COME OUT. A column stands at the kerb in life, and at the
    # kerb it also stands 8 m from the truck — the first hero render had one
    # bisecting the frame, and on an orbit it would sweep through every shot.
    # Nothing else changes: the line is still a kerb line, it just starts past
    # the rig.
    for k in range(-4, 7):
        y = k * 38.0 + 12.0
        if abs(y) < 60.0:
            continue
        x = ROAD_A_X + _EDGE + 1.1
        d = clone(mast, "mast_e_%d" % k)
        d.rotation_mode = "XYZ"
        d.rotation_euler = (0, 0, math.radians(180))
        d.location = (x, y, yard_z(x, y) - 0.05)
        n += 1
    bpy.data.objects.remove(mast, do_unlink=True)

    barrier = props.get("barrier")
    b = 0
    if barrier:
        # ONLY AT THE GATE. There used to be a second run of nine across open
        # concrete beside the tank farm, and it was the "negocio no chao muito
        # estranho nesse local": a line of decimated Jersey barriers protecting
        # nothing, in the middle of a yard, reading at an angle as some kind of
        # broken staircase lying on the floor. A barrier belongs where a vehicle
        # would otherwise hit something. Beside a tank in open yard, nothing
        # would.
        for k in range(10):
            d = clone(barrier[0], "bar_g_%d" % k)
            x = ROAD_A_X + _EDGE + 1.0
            y = 214.0 + k * 1.62
            d.location = (x, y, surface_z(x, y) - 0.04)
            d.rotation_mode = "XYZ"
            d.rotation_euler = (0, 0, math.radians(90))
            b += 1
        bpy.data.objects.remove(barrier[0], do_unlink=True)

    log("  dressing: %d masts, %d barriers at the gate" % (n, b))


# ---------------------------------------------------------------------------
def shrink_images(building_px=1024, prop_px=512):
    """Downscale embedded textures before export.

    The packs ship 2048-4096 px atlases and the exporter embeds them whole.
    Nothing here is seen closer than a few metres and the ground is bound at
    RUNTIME from /textures, so the embedded set only has to survive mid-distance
    viewing. Props get half of what buildings get: a 0.4 m bin does not need the
    same texel budget as a 34 m hall.

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
        nm = img.name.lower()
        cap = prop_px if any(k in nm for k in
                             ("lamp", "barrier", "utility", "crate", "container",
                              "wire", "posts", "d3_", "device23")) else building_px
        m = max(w, h)
        if m <= cap:
            continue
        s = cap / float(m)
        try:
            img.scale(max(1, int(w * s)), max(1, int(h * s)))
            n += 1
        except Exception as e:
            log("    could not scale %s (%dx%d): %s" % (img.name[:30], w, h, e))
    log("  shrank %d textures" % n)


def audit_placement():
    """Measure every placed object against the ground it stands on.

    WHY THIS EXISTS. The layout audit checks footprints against each other and
    against the camera, and it passed clean while the app was showing floating
    props, half-buried props and a row of containers z-fighting through each
    other. None of those are footprint problems, so nothing was looking for
    them. "Tem muitos items flutuando e ate com a textura quebrada" is a report
    about the THIRD dimension, and this is the pass that measures it.

    Four things get reported, all in metres:

      FLOAT   the object's lowest point is above the ground under it
      SUNK    it is far enough below to bury a door or a wheel
      STACK   two pieces sharing a mesh overlap in plan — which is what
              "textura piscando" is: not a texture bug at all, but two identical
              surfaces fighting for the same depth
      TALL    it breaks the graduated height rule (see below)

    THE HEIGHT RULE. "Denso proximo ao caminhao, mas com cuidado para nao ser
    construcoes muito altas que atrapalhem a camera" is a ratio, not a radius:
    what blocks an orbit is ANGLE. A single TALL_SETBACK number cannot express
    it — it either lets a 24 m stack stand at 46 m or pushes a 9 m shed out to
    60 for no reason. The rule here is height <= distance / 5, so 30 m buys a
    6 m shed, 60 m buys 12 m, and the 24 m stacks have to stand back at 120.
    That is what produces a skyline that opens away from the truck.
    """
    # FLUSH THE DEPSGRAPH FIRST. `world_bbox` reads `obj.matrix_world`, which is
    # a CACHE: assigning `.location` marks it dirty but does not recompute it.
    # Without this line every clone reports the prototype's matrix, i.e. the
    # origin — the first run of this audit duly announced that all 21 concrete
    # barriers were stacked on top of each other and that ten buildings were
    # standing on the truck. Both were the audit's own bug, and an audit that
    # invents faults is worse than no audit, because the fixes are real.
    bpy.context.view_layer.update()
    ground = {"GROUND_CONCRETE", "ASPHALT_ROAD", "CONCRETE_APRON", "KERB_CONCRETE",
              "LINE_PAINT", "GRASS_VERGE", "GRASS_NEAR", "GRAVEL_SHOULDER",
              "TREE_BARK", "TREE_LEAF", "FENCE_WIRE", "FENCE_POST"}
    rows = []
    for o in bpy.data.objects:
        if o.type != "MESH" or not o.data or not o.data.polygons:
            continue
        mats = {m.name for m in o.data.materials if m}
        if mats and mats <= ground:
            continue
        lo, hi = world_bbox(o)
        cx, cy = (lo.x + hi.x) / 2.0, (lo.y + hi.y) / 2.0
        gz = surface_z(cx, cy)
        rows.append((o, lo, hi, gz))

    n_float = n_sunk = n_tall = n_stack = 0
    for o, lo, hi, gz in rows:
        gap = lo.z - gz
        h = hi.z - lo.z
        if gap > 0.18:
            log("  FLOAT    %-20s %.2f m above the ground at (%.0f, %.0f)"
                % (o.name[:20], gap, (lo.x + hi.x) / 2, (lo.y + hi.y) / 2))
            n_float += 1
        # -0.75, not -0.45. ibc1.import_prototypes deliberately KEEPS the
        # author's Z rather than dropping each model's bbox to zero, because
        # half the pack has feed pipes and foundations below its floor line
        # (measured mins of 0.0, -0.0, -0.4, -0.6). Flagging those is flagging
        # the correct behaviour.
        elif gap < -0.75:
            log("  SUNK     %-20s %.2f m into the ground at (%.0f, %.0f)"
                % (o.name[:20], gap, (lo.x + hi.x) / 2, (lo.y + hi.y) / 2))
            n_sunk += 1
        dx = max(lo.x, 0.0, -hi.x)
        dy = max(lo.y, 0.0, -hi.y)
        near = math.hypot(dx, dy)
        # THE RULE ONLY BITES INSIDE 80 m, and that is not a softening — it is
        # what the geometry actually says. The orbit tops out around 31 m, so
        # what can block it is what is CLOSE; a 37 m drum rack at 124 m subtends
        # 17 degrees of background and obstructs nothing. Applying the ratio all
        # the way out demanded 187 m for that rack, which is past the fence, and
        # chasing it is what spread the plant into a field in the first place.
        if h > 3.0 and near < 80.0 and h > near / 5.0:
            log("  TALL     %-20s %.1f m tall at only %.0f m (allowed %.1f)"
                % (o.name[:20], h, near, near / 5.0))
            n_tall += 1

    # STACK: same mesh datablock, overlapping in plan. Two clones of one
    # container at a 2.5 m pitch when the container is 6.1 m long is not a
    # texture bug, it is 3.6 m of coplanar steel.
    by_mesh = {}
    for o, lo, hi, _gz in rows:
        by_mesh.setdefault(o.data.name, []).append((o, lo, hi))
    for nm, group in by_mesh.items():
        for i in range(len(group)):
            oi, loi, hii = group[i]
            for j in range(i + 1, len(group)):
                oj, loj, hij = group[j]
                ox = min(hii.x, hij.x) - max(loi.x, loj.x)
                oy = min(hii.y, hij.y) - max(loi.y, loj.y)
                oz = min(hii.z, hij.z) - max(loi.z, loj.z)
                if ox > 0.3 and oy > 0.3 and oz > 0.3:
                    log("  STACK    %-16s x %-16s overlap %.1f x %.1f x %.1f m"
                        % (oi.name[:16], oj.name[:16], ox, oy, oz))
                    n_stack += 1
    log("  placement: %d float, %d sunk, %d too tall, %d interpenetrating (%d pieces)"
        % (n_float, n_sunk, n_tall, n_stack, len(rows)))


def group_instances():
    """Parent the planting's linked duplicates to one empty per mesh, so the
    exporter can actually emit EXT_mesh_gpu_instancing.

    IT WAS NOT EMITTING. The export log said "exported with
    EXT_mesh_gpu_instancing" and that line only ever proved the KWARG was
    accepted — not that a single instance was written. Read back off the shipped
    file, `extensionsUsed` was `['EXT_texture_webp']` and nothing else: 1 057
    nodes referencing 80 meshes, i.e. the file was small (the mesh data really is
    shared) but the runtime had 1 057 draw calls to make. Blender only writes the
    extension for objects that share mesh data AND hang off a COMMON PARENT, and
    linked duplicates created with `.copy()` have no parent at all.

    ONLY THE PLANTING, AND THAT IS THE WHOLE SUBTLETY. three.js reads the
    extension into an InstancedMesh, and set.ts collectSolids deliberately SKIPS
    InstancedMesh when it gathers camera obstacles — "grama nao e obstaculo".
    Instancing the thirteen duplicated sheds would therefore be a silent
    regression: the camera would stop dodging them and start flying through
    them. So this groups tree and bush meshes and leaves every building alone.
    """
    groups = {}
    for o in bpy.data.objects:
        if o.type != "MESH" or not o.data or o.parent is not None:
            continue
        nm = o.data.name
        if not (nm.startswith("tree_") or nm.startswith("bush_")):
            continue
        groups.setdefault(nm, []).append(o)
    n = inst = 0
    for nm, objs in sorted(groups.items()):
        if len(objs) < 2:
            continue
        e = bpy.data.objects.new("inst_" + nm, None)
        bpy.context.collection.objects.link(e)
        for o in objs:
            o.parent = e
            # The empty is at the origin with an identity matrix, so the child's
            # local transform IS its world transform and nothing moves. Setting
            # the inverse explicitly rather than relying on the operator keeps
            # that true regardless of context.
            o.matrix_parent_inverse = Matrix.Identity(4)
        n += 1
        inst += len(objs)
    log("  instancing: %d groups covering %d objects" % (n, inst))


def export():
    os.makedirs(OUT_DIR, exist_ok=True)
    for o in bpy.data.objects:
        o.select_set(True)
    kw = dict(
        filepath=OUT,
        export_format="GLB",
        # export_apply=True evaluates the depsgraph PER OBJECT, so every linked
        # duplicate gets its own mesh copy and glTF instancing is lost. The
        # decimation the importers do is applied destructively for this reason.
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
        # THE GROUND VARIATION AND THE WORN PAINT LIVE OR DIE ON THIS LINE.
        #
        # The exporter's default is export_vertex_color='MATERIAL', which emits
        # real COLOR_0 only for meshes whose MATERIAL actually reads a Color
        # Attribute node. Our ground materials are bare named slots on purpose —
        # the engine binds their maps at runtime — so not one of them reads
        # vertex colour in Blender, and the exporter dutifully wrote an all-white
        # placeholder instead of the field the build had just computed. Every
        # vertex in every shipped set.glb was (1,1,1).
        #
        # 'ACTIVE' exports the mesh's active colour attribute regardless of what
        # the material does with it, which is exactly the contract we want.
        export_vertex_color="ACTIVE",
    )
    # GPU instancing, if this Blender has it. The planting is ~200 linked
    # duplicates of six tree meshes; as plain nodes that is 200 draw calls, as
    # EXT_mesh_gpu_instancing it is six. three.js reads the extension into an
    # InstancedMesh, and set.ts collectSolids already skips InstancedMesh when
    # it collects camera obstacles ("grama nao e obstaculo"), so this is a path
    # the engine was already written for. Optional because the kwarg's name has
    # moved between releases; without it the scene is identical and heavier.
    try:
        bpy.ops.export_scene.gltf(export_image_format="WEBP",
                                  export_image_quality=82,
                                  export_gpu_instances=True, **kw)
        log("  exported with EXT_mesh_gpu_instancing")
    except TypeError:
        try:
            bpy.ops.export_scene.gltf(export_image_format="WEBP",
                                      export_image_quality=82, **kw)
            log("  exported without GPU instancing (kwarg rejected)")
        except TypeError as e:
            log("  export kwargs rejected (%s); retrying bare" % e)
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
    ibc1 = _load("ibc1")
    dl_packs = _load("dl_packs")
    props_ph = _load("props_ph")

    log("prototypes")
    ibc = ibc1.import_prototypes(log)
    thin_prototypes(ibc)
    dl = dl_packs.import_prototypes(log)
    props = props_ph.import_props(log)

    log("layout")
    layout(ibc, dl)

    log("ground")
    m_near = build_ground()

    log("perimeter")
    build_fence(bpy.data.materials["KERB_CONCRETE"])

    log("planting")
    plant(m_near)
    dress(props)

    log("placement audit")
    audit_placement()

    log("export")
    group_instances()
    shrink_images()
    export()
    log("done")


main()
