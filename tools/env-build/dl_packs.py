# The four downloaded packs, imported the way ibc1.py imports the IBC1 package.
#
#   ibp          "Industrial Buildings Pack"        7 OBJ, 7 baked atlases
#   midcentury   "Mid-Century Industrial Buildings" 1 OBJ holding ~16 buildings
#   device       "Industrial device"                1 control cabinet, full PBR
#   trash        "Trash Container 3 PBR"            a pair of skips, full PBR
#
# WHAT THESE ADD THAT IBC1 CANNOT. IBC1 is a process plant: tanks, columns,
# pipe racks, chimneys. It has no building a TRUCK has any business at. These
# packs bring the loading docks, the warehouses, the site office and the gate
# booth — the things that explain why a rig is parked here at all.
#
# THE BINDINGS ARE NOT GUESSED. Same trap as IBC1: not one of the four ships an
# .mtl or a `usemtl` line, and ibc1.py's header records that assuming the
# pairing cost two builds. The pairing below was RENDERED (probe_dl.py, sheets
# in _shots_dl) and confirmed on the geometry: window frames land on windows,
# dock levellers on dock openings, rust on the model whose atlas is named
# `oldWarehouse`. The archive lists its PNGs and its OBJs in the same order and
# that order turned out to be the answer; the corroboration is model_2 and
# model_3 sharing a 34 m footprint, which is what a building and its separate
# "Details" mesh look like.
#
# UNITS AND UP-AXIS DIFFER PER PACK, measured rather than assumed:
#   ibp          centimetres, Z-up      (a 3444-unit warehouse is 34.4 m)
#   midcentury   metres,      Y-up      (99 x 93 m of buildings, 11 m tall)
#   device       centimetres, Y-up      (a 1.9 x 1.4 x 3.3 m cabinet)
#   trash        metres,      Z-up      (Y-up stood the skips on end)
import bpy
import bmesh
import os
import math
from mathutils import Vector, Matrix

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_src_dl")

# key -> (folder, model index, up axis, unit scale, basecolor, extra maps)
#
# `extra` is (normal, roughness, metallic, ao); None where the pack ships none.
# The ibp atlases are BAKED — lighting, dirt and panel lines are already in the
# colour — so they get no normal and a flat roughness. Feeding a baked atlas
# into a normal slot is how a flat wall grows a relief that contradicts its own
# painted shadows.
PACKS = {
    "booth":     ("ibp", 0, "Z", 0.01, "secuirityBooth.tga.png", None),
    "shed_sm":   ("ibp", 1, "Z", 0.01, "smallWarehouse.tga.png", None),
    "hall_big":  ("ibp", 2, "Z", 0.01, "suburbanFireDept.tga.png", None),
    "hall_det":  ("ibp", 3, "Z", 0.01, "suburbanFireDeptDetails.tga.png", None),
    "shed_old":  ("ibp", 4, "Z", 0.01, "oldWarehouse_clean.tga.png", None),
    "office":    ("ibp", 5, "Z", 0.01, "temporaryOffice.tga.png", None),
    "dock":      ("ibp", 6, "Z", 0.01, "warehouse.tga.png", None),
    "midcentury": ("midcentury", 0, "Y", 1.0, "IndustrialGeneric1D.png",
                   ("IndustrialGeneric1N.png", "IndustrialGeneric1R.png", None, None)),
    "cabinet":   ("device", 0, "Y", 0.01, "device23_basecolor.png",
                  ("device23_normal.png", "device23_roughness.png",
                   "device23_metallic.png", "device23_ao.png")),
    "skip":      ("trash", 0, "Z", 1.0, "d3_albedo2.tga.png",
                  ("d3_normal3.tga.png", "d3_roughness.tga.png",
                   "d3_metalness2.tga.png", "d3_ao.tga.png")),
}

# `hall_big` and `hall_det` are ONE building. Their footprints differ (34.4 x
# 21.8 against 34.1 x 18.3), so recentring each on its own box would slide the
# detail mesh a metre and a half off the shell it belongs to. They are imported
# together, keeping their source coordinates, and recentred once as a pair.
PAIRS = {"hall_big": "hall_det"}

# Triangle budget per piece. `cabinet` is 34 509 faces for a 1.9 m box — it was
# modelled for a hero render, and at the 40 m it will ever be seen from that is
# 34 000 triangles inside a few dozen pixels. Decimation is DESTRUCTIVE here on
# purpose: export_apply=False in the build (see its note), so a Decimate
# modifier left unapplied would export at full density and silently do nothing.
DECIMATE = {"cabinet": 3500, "skip": 2500}


def _img(path, non_color=False):
    if not path or not os.path.exists(path):
        return None
    im = bpy.data.images.load(path, check_existing=True)
    if non_color:
        im.colorspace_settings.name = "Non-Color"
    return im


def build_material(name, folder, basecolor, extra):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    d = os.path.join(SRC, folder)

    im = _img(os.path.join(d, basecolor))
    if im:
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = im
        nt.links.new(b.inputs["Base Color"], t.outputs["Color"])

    if not extra:
        # A baked atlas already contains its own shading. Flat-ish roughness and
        # no normal is the honest reading of it.
        b.inputs["Roughness"].default_value = 0.82
        b.inputs["Metallic"].default_value = 0.0
        return m

    nrm, rough, metal, ao = extra
    im = _img(os.path.join(d, nrm), True) if nrm else None
    if im:
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = im
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(nm.inputs["Color"], t.outputs["Color"])
        nt.links.new(b.inputs["Normal"], nm.outputs["Normal"])
    im = _img(os.path.join(d, rough), True) if rough else None
    if im:
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = im
        nt.links.new(b.inputs["Roughness"], t.outputs["Color"])
    im = _img(os.path.join(d, metal), True) if metal else None
    if im:
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = im
        nt.links.new(b.inputs["Metallic"], t.outputs["Color"])
    else:
        b.inputs["Metallic"].default_value = 0.0
    return m


def _import_raw(folder, idx, up):
    """Import one OBJ joined into a single object, transform applied, IN SOURCE
    COORDINATES — no recentring, so a caller can pair two files that were
    authored in the same scene."""
    path = os.path.join(SRC, folder, "model_%d.obj" % idx)
    if not os.path.exists(path):
        return None
    before = set(bpy.data.objects)
    if up == "Y":
        bpy.ops.wm.obj_import(filepath=path, forward_axis="NEGATIVE_Z", up_axis="Y")
    else:
        bpy.ops.wm.obj_import(filepath=path, forward_axis="Y", up_axis="Z")
    fresh = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    if not fresh:
        return None
    for o in bpy.data.objects:
        o.select_set(o in fresh)
    bpy.context.view_layer.objects.active = fresh[0]
    if len(fresh) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    # The OBJ importer expresses the axis conversion as an OBJECT rotation and
    # leaves the vertices alone. Baking it here is what lets the layout own
    # rotation_euler outright — see the long note in ibc1.import_prototypes.
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return ob


def _bounds(ob):
    vs = ob.data.vertices
    return (Vector((min(v.co.x for v in vs), min(v.co.y for v in vs), min(v.co.z for v in vs))),
            Vector((max(v.co.x for v in vs), max(v.co.y for v in vs), max(v.co.z for v in vs))))


def _recentre(ob, drop_to_zero=True):
    """Centre on the footprint; put the lowest point on z=0.

    UNLIKE ibc1, THESE PACKS DO NEED THE DROP. The IBC1 models were authored on
    y=0 and forcing bbox-min to zero rested a tank on its feed pipes. These come
    out of their source scenes at arbitrary heights — ibp model_1 sits 24 m up —
    so without this they hang in the sky."""
    lo, hi = _bounds(ob)
    ob.data.transform(Matrix.Translation(
        Vector((-(lo.x + hi.x) / 2.0, -(lo.y + hi.y) / 2.0, -lo.z if drop_to_zero else 0.0))))
    ob.data.update()


def _decimate(ob, budget, log):
    n = len(ob.data.polygons)
    if n <= budget:
        return
    md = ob.modifiers.new("dec", "DECIMATE")
    md.ratio = float(budget) / float(n)
    for o in bpy.data.objects:
        o.select_set(o is ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=md.name)
    log("    decimated %s %d -> %d faces" % (ob.name, n, len(ob.data.polygons)))


def _split_buildings(ob, log, gap=2.5):
    """Break the mid-century file into its individual buildings.

    IT IS ONE OBJ HOLDING SIXTEEN BUILDINGS laid out in a display grid — a
    shop-window sheet, not a scene. Placed whole it would drop a tidy 99 x 93 m
    lattice of identical spacing into the district, which is the single loudest
    kitbash tell there is (see the LAYOUT note in build_industrial_park.py).

    LOOSE PARTS ALONE ARE NOT BUILDINGS. A building here is several disconnected
    shells — walls, roof, a canopy, a railing — so separating by loose parts
    yields hundreds of fragments. They are therefore CLUSTERED afterwards: parts
    whose XY boxes come within `gap` metres are the same building. The display
    grid leaves far more than 2.5 m between units, so the clustering is
    unambiguous in exactly the way the source's own layout guarantees.
    """
    me = ob.data
    # Connected components over the edge graph, computed directly rather than
    # through bpy.ops.mesh.separate(type='LOOSE') — the operator would create
    # hundreds of objects only for us to join most of them back together.
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    parent = list(range(len(bm.verts)))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    for e in bm.edges:
        union(e.verts[0].index, e.verts[1].index)

    # XY box per component
    comp = {}
    for v in bm.verts:
        r = find(v.index)
        c = comp.get(r)
        if c is None:
            comp[r] = [v.co.x, v.co.y, v.co.x, v.co.y]
        else:
            c[0] = min(c[0], v.co.x)
            c[1] = min(c[1], v.co.y)
            c[2] = max(c[2], v.co.x)
            c[3] = max(c[3], v.co.y)
    bm.free()

    # Merge components whose boxes are within `gap` — union-find again, this
    # time over components rather than vertices.
    keys = list(comp.keys())
    cp = {k: k for k in keys}

    def cfind(a):
        while cp[a] != a:
            cp[a] = cp[cp[a]]
            a = cp[a]
        return a

    for i in range(len(keys)):
        bi = comp[keys[i]]
        for j in range(i + 1, len(keys)):
            bj = comp[keys[j]]
            dx = max(bi[0] - bj[2], bj[0] - bi[2], 0.0)
            dy = max(bi[1] - bj[3], bj[1] - bi[3], 0.0)
            if math.hypot(dx, dy) <= gap:
                a, b = cfind(keys[i]), cfind(keys[j])
                if a != b:
                    cp[b] = a

    groups = {}
    for k in keys:
        groups.setdefault(cfind(k), []).append(k)
    log("    midcentury: %d shells -> %d buildings" % (len(keys), len(groups)))
    return groups, comp


def split_midcentury(ob, log, min_span=4.0):
    """Return a list of separate building objects carved out of `ob`."""
    groups, boxes = _split_buildings(ob, log)
    # Map every vertex to its group, then build one mesh per group.
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.verts.ensure_lookup_table()
    parent = list(range(len(bm.verts)))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for e in bm.edges:
        ra, rb = find(e.verts[0].index), find(e.verts[1].index)
        if ra != rb:
            parent[rb] = ra
    root_of_group = {}
    for g, members in groups.items():
        for m in members:
            root_of_group[m] = g
    bm.free()

    vgroup = {}
    for i in range(len(parent)):
        vgroup[i] = root_of_group.get(find(i))

    out = []
    mat = ob.data.materials[0] if ob.data.materials else None
    src = ob.data
    for gi, (g, _members) in enumerate(sorted(groups.items())):
        idxs = [i for i, gg in vgroup.items() if gg == g]
        if len(idxs) < 8:
            continue
        keep = set(idxs)
        nb = bmesh.new()
        old = bmesh.new()
        old.from_mesh(src)
        old.verts.ensure_lookup_table()
        uv_src = old.loops.layers.uv.active
        uv_dst = nb.loops.layers.uv.new("UVMap")
        vmap = {}
        for f in old.faces:
            if not all(v.index in keep for v in f.verts):
                continue
            vs = []
            for v in f.verts:
                nv = vmap.get(v.index)
                if nv is None:
                    nv = nb.verts.new(v.co)
                    vmap[v.index] = nv
                vs.append(nv)
            try:
                nf = nb.faces.new(vs)
            except ValueError:
                continue
            if uv_src:
                for l_new, l_old in zip(nf.loops, f.loops):
                    l_new[uv_dst].uv = l_old[uv_src].uv
        old.free()
        if not nb.faces:
            nb.free()
            continue
        me = bpy.data.meshes.new("MC_%02d" % gi)
        nb.to_mesh(me)
        nb.free()
        nob = bpy.data.objects.new("MC_%02d" % gi, me)
        bpy.context.collection.objects.link(nob)
        if mat:
            me.materials.append(mat)
        lo, hi = _bounds(nob)
        if max(hi.x - lo.x, hi.y - lo.y) < min_span:
            bpy.data.objects.remove(nob, do_unlink=True)
            continue
        _recentre(nob)
        out.append(nob)
    return out


def import_prototypes(log):
    """key -> (object, (sx, sy, sz)). `midcentury` is returned exploded as
    `mc_00`, `mc_01`, ... one entry per building."""
    protos = {}
    done = set()
    for key, (folder, idx, up, unit, basecolor, extra) in PACKS.items():
        if key in done:
            continue
        ob = _import_raw(folder, idx, up)
        if ob is None:
            log("  %s: model_%d missing in %s" % (key, idx, folder))
            continue
        ob.name = "DL_" + key
        mat = build_material("DL_" + key, folder, basecolor, extra)
        ob.data.materials.clear()
        ob.data.materials.append(mat)

        # A pair is joined BEFORE recentring, so the detail mesh keeps its
        # position on the shell it details.
        mate_key = PAIRS.get(key)
        if mate_key:
            mf, mi, mu, mun, mbc, mex = PACKS[mate_key]
            mate = _import_raw(mf, mi, mu)
            if mate is not None:
                mate.data.materials.clear()
                mate.data.materials.append(build_material("DL_" + mate_key, mf, mbc, mex))
                for o in bpy.data.objects:
                    o.select_set(o in (ob, mate))
                bpy.context.view_layer.objects.active = ob
                bpy.ops.object.join()
                ob = bpy.context.view_layer.objects.active
                done.add(mate_key)
                log("  %s + %s joined as one building" % (key, mate_key))

        ob.data.transform(Matrix.Scale(unit, 4))
        ob.data.update()

        if key == "midcentury":
            parts = split_midcentury(ob, log)
            bpy.data.objects.remove(ob, do_unlink=True)
            for i, p in enumerate(parts):
                lo, hi = _bounds(p)
                p.name = "MC_%02d" % i
                protos["mc_%02d" % i] = (p, (hi.x - lo.x, hi.y - lo.y, hi.z - lo.z))
            log("  midcentury -> %d placeable buildings" % len(parts))
            done.add(key)
            continue

        _recentre(ob)
        if key in DECIMATE:
            _decimate(ob, DECIMATE[key], log)
        lo, hi = _bounds(ob)
        protos[key] = (ob, (hi.x - lo.x, hi.y - lo.y, hi.z - lo.z))
        log("  %-11s %6.1f x %6.1f x %6.1f m  (%d faces)"
            % (key, hi.x - lo.x, hi.y - lo.y, hi.z - lo.z, len(ob.data.polygons)))
        done.add(key)

    log("  dl packs: %d prototypes (%d faces)"
        % (len(protos), sum(len(o.data.polygons) for o, _ in protos.values())))
    return protos
