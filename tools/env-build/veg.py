# Trees, bushes and grass patches — generated, not imported.
#
# WHY GENERATED. Nothing on this machine ships a tree: the four downloaded packs
# are buildings and machinery, and the Poly Haven props next door are a 0.4 m
# shrub at 156 012 faces. Buying detail that will be seen at 200 m for the price
# of a whole district's triangle budget is the wrong trade twice over.
#
# The second reason is the one that actually decides it. The brief asks for a
# scene that reads as ONE PLACE — "garanta que tudo ficara bem homogenio". A
# photogrammetry shrub next to a hand-built kerb next to a baked-atlas warehouse
# reads as three sources, because it is. Everything green in this scene comes
# out of this file, so it at least disagrees with itself consistently.
#
# NO ALPHA ANYWHERE. Cross-quad foliage needs an opacity map, and the only
# alpha-cut texture the project has is the chainlink. A leaf card with no alpha
# is a green rectangle, so the crowns are SOLID BLOBS with a broken silhouette
# instead — the shape does the work a texture would.
#
# COLOUR COMES FROM COLOR_0. TREE_LEAF and TREE_BARK are named slots with no
# maps (the engine binds by name from environments.json and there is no bark
# texture to bind), so a flat tint would give a billiard ball. Every vertex is
# painted instead: darker toward the crown's interior, warmer at the tips,
# and a per-tree hue offset so no two read as the same plant.
import bpy
import bmesh
import math
from mathutils import Vector, Matrix


def _hash01(i, j, s):
    n = (i * 374761393 + j * 668265263 + s * 1274126177) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFFFF) / float(0xFFFFFF)


def _vnoise3(x, y, z, s=0):
    i, j, k = int(math.floor(x)), int(math.floor(y)), int(math.floor(z))
    fx, fy, fz = x - i, y - j, z - k
    u = fx * fx * (3 - 2 * fx)
    v = fy * fy * (3 - 2 * fy)
    w = fz * fz * (3 - 2 * fz)
    def h(a, b, c):
        return _hash01(a * 7919 + c * 104729, b, s)
    x00 = h(i, j, k) * (1 - u) + h(i + 1, j, k) * u
    x10 = h(i, j + 1, k) * (1 - u) + h(i + 1, j + 1, k) * u
    x01 = h(i, j, k + 1) * (1 - u) + h(i + 1, j, k + 1) * u
    x11 = h(i, j + 1, k + 1) * (1 - u) + h(i + 1, j + 1, k + 1) * u
    return (x00 * (1 - v) + x10 * v) * (1 - w) + (x01 * (1 - v) + x11 * v) * w


def paint(me, fn):
    """Write an active FLOAT_COLOR corner attribute from fn(x, y, z) -> rgb.

    ACTIVE MATTERS. Blender's glTF exporter writes the mesh's ACTIVE colour
    attribute and a freshly added layer is not automatically active — the
    district shipped several builds' worth of all-white COLOR_0 for exactly this
    reason. It is set here and the build exports with export_vertex_color=ACTIVE.
    """
    for a in list(me.color_attributes):
        me.color_attributes.remove(a)
    attr = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="CORNER")
    try:
        me.color_attributes.active_color = attr
        me.color_attributes.render_color_index = me.color_attributes.find("Col")
    except Exception:
        pass
    for li, loop in enumerate(me.loops):
        co = me.vertices[loop.vertex_index].co
        r, g, b = fn(co.x, co.y, co.z)
        attr.data[li].color = (r, g, b, 1.0)
    me.update()


def _cyl(bm, base, top, r0, r1, seg, mat_index=0):
    """Tapered cylinder from `base` to `top`, no caps at the top (the crown
    covers it) — a cap nobody sees is triangles nobody needs."""
    d = (top - base)
    ln = d.length
    if ln < 1e-5:
        return []
    z = d.normalized()
    up = Vector((0, 0, 1)) if abs(z.z) < 0.95 else Vector((1, 0, 0))
    x = z.cross(up).normalized()
    y = z.cross(x)
    ring0, ring1 = [], []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        o = x * math.cos(a) + y * math.sin(a)
        ring0.append(bm.verts.new(base + o * r0))
        ring1.append(bm.verts.new(top + o * r1))
    for i in range(seg):
        j = (i + 1) % seg
        f = bm.faces.new((ring0[i], ring0[j], ring1[j], ring1[i]))
        f.material_index = mat_index
    return ring1


def _blob(bm, centre, radius, squash, seed, mat_index=1, rings=5, seg=9):
    """A lumpy spheroid. Latitude/longitude rather than an icosphere so the
    polygon count is tunable to the metre.

    THE FIRST VERSION OF THIS RENDERED AS ORIGAMI. 4 x 7 segments, flat-shaded,
    with a lump amplitude of +/-37 % produced faceted crystals sitting on the
    median — the close-up shot is unambiguous, they read as crumpled paper, not
    as plants. Three things were wrong and all three are fixed here: the
    resolution was too low to carry a curved silhouette, the displacement was
    large enough to turn every quad into a visible plane, and nothing ever set
    use_smooth (see _smooth), so Blender shaded each of those planes flat.

    The lump is still what makes the silhouette — without it a crown is a
    sphere and a row of them is beads on a string — but it is now higher
    frequency and lower amplitude, which is the difference between a lumpy mass
    and a polyhedron.
    """
    verts = []
    for a in range(1, rings):
        phi = math.pi * a / rings
        row = []
        for b in range(seg):
            th = 2 * math.pi * b / seg
            n = Vector((math.sin(phi) * math.cos(th),
                        math.sin(phi) * math.sin(th),
                        math.cos(phi)))
            k = (0.80 + 0.30 * _vnoise3(n.x * 3.4 + seed, n.y * 3.4, n.z * 3.4, seed)
                 + 0.10 * _vnoise3(n.x * 7.1, n.y * 7.1 + seed, n.z * 7.1, seed + 9))
            p = Vector((n.x * radius * k, n.y * radius * k, n.z * radius * k * squash))
            row.append(bm.verts.new(centre + p))
        verts.append(row)
    top = bm.verts.new(centre + Vector((0, 0, radius * squash)))
    bot = bm.verts.new(centre - Vector((0, 0, radius * squash * 0.82)))
    for a in range(len(verts) - 1):
        for b in range(seg):
            c = (b + 1) % seg
            f = bm.faces.new((verts[a][b], verts[a][c], verts[a + 1][c], verts[a + 1][b]))
            f.material_index = mat_index
    for b in range(seg):
        c = (b + 1) % seg
        bm.faces.new((top, verts[0][c], verts[0][b])).material_index = mat_index
        bm.faces.new((bot, verts[-1][b], verts[-1][c])).material_index = mat_index


def _smooth(me, angle=1.05):
    """Smooth-shade the mesh, with an autosmooth split so the trunk keeps its
    silhouette instead of melting into the crown.

    NOT COSMETIC. A blob at this polygon count is defined by its NORMALS: flat
    normals give you the polyhedron you actually modelled, smooth normals give
    you the mass you meant. This one line is most of the difference between the
    origami on the median and something that reads as a plant.
    """
    for p in me.polygons:
        p.use_smooth = True
    # Blender moved autosmooth from a mesh flag to a modifier and back; do the
    # equivalent by hand so the result does not depend on which release this is.
    try:
        me.set_sharp_from_angle(angle=angle)
    except AttributeError:
        try:
            me.use_auto_smooth = True
            me.auto_smooth_angle = angle
        except AttributeError:
            pass


def make_tree(name, seed, height, bark, leaf, lean=0.0):
    """One tree, trunk and crown in a single mesh with two material slots.

    ~330 faces. Six of these are generated and every tree on site is a linked
    duplicate of one of them, so the whole plantation costs six meshes.
    """
    rnd = (lambda k: _hash01(seed * 31 + k, seed * 7 + 3, 991))
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(bark)
    me.materials.append(leaf)
    bm = bmesh.new()

    trunk_h = height * (0.40 + 0.10 * rnd(1))
    r0 = height * 0.030
    tilt = Vector((math.cos(lean) * 0.06 * (rnd(2) - 0.5),
                   math.sin(lean) * 0.06 * (rnd(3) - 0.5), 0)) * height
    # Two trunk segments so the lean is a bend and not a tilted pole.
    mid = Vector((0, 0, trunk_h * 0.55)) + tilt * 0.35
    top = Vector((0, 0, trunk_h)) + tilt
    _cyl(bm, Vector((0, 0, -0.15)), mid, r0 * 1.25, r0 * 0.82, 7, 0)
    _cyl(bm, mid, top, r0 * 0.82, r0 * 0.58, 7, 0)

    nb = 3 + int(rnd(4) * 2.5)
    crown_r = height * (0.20 + 0.05 * rnd(5))
    for i in range(nb):
        a = 2 * math.pi * (i + rnd(10 + i)) / nb
        reach = crown_r * (0.55 + 0.55 * rnd(20 + i))
        rise = height * (0.16 + 0.16 * rnd(30 + i))
        tip = top + Vector((math.cos(a) * reach, math.sin(a) * reach, rise))
        _cyl(bm, top + Vector((0, 0, height * 0.02 * i)), tip, r0 * 0.5, r0 * 0.22, 5, 0)
        _blob(bm, tip, crown_r * (0.62 + 0.30 * rnd(40 + i)),
              0.80 + 0.22 * rnd(50 + i), seed * 13 + i, 1)
    # A central mass so the crown is one canopy rather than a ring of pompoms.
    _blob(bm, top + Vector((0, 0, height * 0.20)), crown_r * 1.02,
          0.74 + 0.16 * rnd(6), seed * 5 + 77, 1, rings=5, seg=8)

    bm.to_mesh(me)
    bm.free()
    _smooth(me)

    hue = rnd(9)
    zs = [v.co.z for v in me.vertices]
    zlo, zhi = min(zs), max(zs)

    def col(x, y, z):
        if z < trunk_h * 0.92 and math.hypot(x, y) < r0 * 2.2:
            k = 0.55 + 0.5 * _vnoise3(x * 6, y * 6, z * 3, seed)
            return (k, k * 0.94, k * 0.86)
        # Height in the crown reads as light reaching it; the noise keeps a
        # single blob from being one flat tone.
        t = 0.0 if zhi <= zlo else (z - zlo) / (zhi - zlo)
        n = _vnoise3(x * 1.7, y * 1.7, z * 1.7, seed + 5)
        k = 0.50 + 0.46 * t + 0.34 * n
        warm = 0.90 + 0.22 * hue
        return (k * warm * 0.94, k * (1.02 - 0.10 * hue), k * 0.62)

    paint(me, col)
    return ob


def make_bush(name, seed, size, leaf):
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(leaf)
    bm = bmesh.new()
    # More lobes, each smaller, sitting lower: a bush is a clump of growth, and
    # two fat spheres is the shape that made these read as boulders.
    n = 4 + int(_hash01(seed, 3, 7) * 3.5)
    for i in range(n):
        a = 2 * math.pi * i / n + _hash01(seed, i, 11)
        d = size * 0.46 * _hash01(seed, i, 13)
        h = size * (0.26 + 0.20 * _hash01(seed, i, 19))
        _blob(bm, Vector((math.cos(a) * d, math.sin(a) * d, h)),
              size * (0.30 + 0.20 * _hash01(seed, i, 17)), 0.80,
              seed * 3 + i, 0, rings=4, seg=7)
    bm.to_mesh(me)
    bm.free()
    _smooth(me)
    zs = [v.co.z for v in me.vertices]
    zlo, zhi = min(zs), max(zs)

    def col(x, y, z):
        t = 0.0 if zhi <= zlo else (z - zlo) / (zhi - zlo)
        # two frequencies, so the mass has dark pockets between lobes rather
        # than one smooth ramp — that shadowing is what sells foliage when
        # there is no alpha map to cut real gaps in it
        n = 0.62 * _vnoise3(x * 3.1, y * 3.1, z * 3.1, seed) \
            + 0.38 * _vnoise3(x * 9.0, y * 9.0, z * 9.0, seed + 4)
        k = 0.30 + 0.46 * t + 0.42 * n
        return (k * 0.84, k, k * 0.54)

    paint(me, col)
    return ob


def grass_field(name, specs, material, height_fn, segs=24, dz=0.035):
    """ALL the grass patches, as ONE mesh.

    `specs` is [(cx, cy, radius, seed)].

    WHY ONE MESH AND NOT ONE OBJECT PER PATCH. Each patch is unique geometry —
    the outline is noise-modulated per patch, so unlike the trees they cannot be
    instanced — and a couple of hundred separate objects is a couple of hundred
    draw calls for about 12 000 triangles of grass.

    AND WHY NOT bpy.ops.object.join(). That was the first attempt and it took
    Blender down: the operator exited the process outright in background mode,
    with no traceback and no exception to catch — the build simply printed its
    layout audit and then "Blender quit". Operators want a context that -b does
    not really have. Building the mesh directly is both faster and the only
    version that cannot do that.
    """
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(material)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    meta = []
    for cx, cy, radius, seed in specs:
        centre = bm.verts.new((cx, cy, height_fn(cx, cy) + dz))
        meta.append((centre, cx, cy, radius, seed))
        ring = []
        for i in range(segs):
            a = 2 * math.pi * i / segs
            k = 0.55 + 0.75 * _vnoise3(math.cos(a) * 1.9 + seed,
                                       math.sin(a) * 1.9, 0.0, seed)
            r = radius * k
            x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
            v = bm.verts.new((x, y, height_fn(x, y) + dz))
            meta.append((v, cx, cy, radius, seed))
            ring.append(v)
        for i in range(segs):
            bm.faces.new((centre, ring[i], ring[(i + 1) % segs]))
    for f in bm.faces:
        for l in f.loops:
            l[uv].uv = (l.vert.co.x / 8.0, l.vert.co.y / 8.0)
    bm.verts.index_update()
    owner = {}
    for v, cx, cy, radius, seed in meta:
        owner[v.index] = (cx, cy, radius, seed)
    bm.to_mesh(me)
    bm.free()

    def col(x, y, z, vi=None):
        cx, cy, radius, seed = owner.get(vi, (x, y, 1.0, 0))
        n = 0.5 * _vnoise3(x / 9.0, y / 9.0, 0.0, seed) \
            + 0.5 * _vnoise3(x / 2.4, y / 2.4, 0.0, seed + 3)
        d = math.hypot(x - cx, y - cy) / max(0.001, radius)
        # Thinner and browner at the rim, where a patch is worn by whatever
        # walks past it.
        k = (0.52 + 0.55 * n) * (1.0 - 0.26 * min(1.0, d))
        return (k * 1.06, k, k * 0.72)

    for a in list(me.color_attributes):
        me.color_attributes.remove(a)
    attr = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="CORNER")
    try:
        me.color_attributes.active_color = attr
        me.color_attributes.render_color_index = me.color_attributes.find("Col")
    except Exception:
        pass
    for li, loop in enumerate(me.loops):
        vi = loop.vertex_index
        co = me.vertices[vi].co
        attr.data[li].color = col(co.x, co.y, co.z, vi) + (1.0,)
    me.update()
    return ob


def grass_patch(name, cx, cy, radius, seed, material, height_fn, segs=26, dz=0.035):
    """An irregular disc of grass.

    NOT A RECTANGLE, and that is the whole point. The build's own history
    records what a hard-edged quad on open ground looks like: "o chao esta cheio
    de artefatos" was 96 pasted tan rectangles. A grass edge against concrete is
    a real boundary in life and may be hard — but a STRAIGHT one on four sides
    is a decal. The radius here is fBm-modulated per segment, so the patch has
    an outline that could have grown.
    """
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(material)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    centre = bm.verts.new((cx, cy, height_fn(cx, cy) + dz))
    ring = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        k = 0.55 + 0.75 * _vnoise3(math.cos(a) * 1.9 + seed, math.sin(a) * 1.9, 0.0, seed)
        r = radius * k
        x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
        ring.append(bm.verts.new((x, y, height_fn(x, y) + dz)))
    for i in range(segs):
        j = (i + 1) % segs
        bm.faces.new((centre, ring[i], ring[j]))
    for f in bm.faces:
        for l in f.loops:
            l[uv].uv = (l.vert.co.x / 8.0, l.vert.co.y / 8.0)
    bm.to_mesh(me)
    bm.free()

    def col(x, y, z):
        n = 0.5 * _vnoise3(x / 9.0, y / 9.0, 0.0, seed) + 0.5 * _vnoise3(x / 2.4, y / 2.4, 0.0, seed + 3)
        d = math.hypot(x - cx, y - cy) / max(0.001, radius)
        # Thinner and browner at the rim, where a patch is worn by whatever
        # walks past it.
        k = (0.52 + 0.55 * n) * (1.0 - 0.26 * min(1.0, d))
        return (k * 1.06, k, k * 0.72)

    paint(me, col)
    return ob
