# Builds `/environments/armazem/set.glb` from warehouse6.blend.
#
#   blender -b <warehouse6.blend> -P build_warehouse.py
#
# THE THREE PROBLEMS THIS FILE SOLVES
#
# 1. IT IS FULL. The source is a working storage warehouse: 982 k polys, of
#    which ~573 k are cardboard, shrink wrap, bottles, gas bottles, racking and
#    carts standing exactly where a truck would go. STRIP below clears the bay.
#
# 2. THE MATERIALS LIE ABOUT METAL. 32 of the 33 materials are plain Principled
#    BSDFs (good — nothing needs baking), but the author used `metallic` where
#    they meant `specular`: cardboard at m=0.0 is right, yet `plastik hijau`
#    is m=1.0, `plastik abu` m=0.75, and the FLOOR is a near-black m=0.74. Under
#    this app's IBL a metallic dielectric renders as a dark mirror — it would
#    look wrong in exactly the way that reads as "CG". METAL_OK is the whitelist.
#
# 3. THE CAMERA CANNOT GET OUT. The interior is 17.1 x 31.0 m with a 5.05 m
#    ceiling; the rig is 2.9 x 19.0 x 4.2 m. It FITS (6 m clear at each end) but
#    the orbit camera needs ~25 m and the walls are at 8.5 m. So the shell is
#    flipped to face INWARD and exported single-sided: from outside the near
#    wall simply is not drawn and the camera looks straight in, which is the
#    standard cutaway every architectural configurator uses. From inside, every
#    surface is still there.
#
import bpy, bmesh, math, os
from mathutils import Vector, Matrix

OUT_DIR = r"C:\Users\Kennedy\Documents\repositories\web\public\environments\armazem"
OUT = os.path.join(OUT_DIR, "set.glb")

# SCALE. The source is a 17.3 x 31.0 m shed with a 5.05 m ceiling and a 3.69 m
# gate. The rig is 19 m long and 4.23 m tall, so it FILLED the building — which
# is what "o armazém está pequeno demais em relação ao caminhão" was seeing.
#
# 1.75 puts it at 30.3 x 54.3 m with an 8.8 m clear height and a 6.5 m gate,
# which is a plausible mid-size distribution warehouse: the truck now occupies
# about a third of the length instead of two thirds, and there is headroom above
# the trailer instead of 0.8 m.
#
# Uniform, and everything scales — trusses, purlins, lamps, gates. That is fine
# for structure (a bigger shed genuinely has bigger trusses) but NOT for
# human-scale props, which is why HUMAN_SCALE below is scaled back down.
# NON-UNIFORM ON PURPOSE. "Duplicar novamente" doubles the floor again, but a
# uniform 4x would also put the ceiling at 20 m — and a 20 m ceiling makes the
# 4.2 m truck look lost, which is the same complaint in the other direction.
# Real distribution centres are wide and long and about 11-12 m clear, so the
# footprint scales 4x from source and the height only 2.3x:
#   17.3 x 31.0 x 5.05  ->  69 x 124 x 11.6 m
SCALE_XY = 4.0
SCALE_Z = 2.3
SCALE = SCALE_XY          # back-compat for the bay/centre maths below

# WHAT SCALES AND WHAT DOES NOT.
#
# Only the BUILDING grows. Boxes, racking, drums and pallets keep their real
# size — a 2x cardboard box is the loudest possible scale tell, and it is what
# made the first pass read wrong.
#
# But goods cannot simply be left alone either: the shell doubles around them
# and they end up huddled in the middle of a building twice the size. So goods
# are SPREAD, not scaled — each connected part keeps its own dimensions while
# its POSITION moves out by SCALE. See spread_goods().
#
# STRUCTURE also has to include everything physically attached to the shell —
# stairs, mezzanine, railings, conduit, gantries. Leaving those at 1x while the
# building doubles is exactly what produced the "peças flutuando" on the second
# level: a 1x staircase no longer reaches a 2x mezzanine.
STRUCTURE = (
    "01. rangka",        # frame / trusses
    "02. dinding depan", # front wall
    "03. dinding",       # walls + roof
    "04. besi lis",      # trim
    "05. gerbang",       # roller gates
    "06. lantai",        # floor
    "08. cat garis",     # painted floor lines
    "15. box besi",      # fixed steel platform (mezzanine deck)
    "19. trafo",         # wall transformer
    "20. saklar",        # wall switchgear
    "21. lampu",         # high-bay lights
    "22. tangga",        # stairs to the mezzanine
    "23. KLLNG",         # ceiling services
    "24. AC",            # air handling
    "25. kabel",         # conduit
    "28. PEMADAM",       # wall-mounted extinguishers
)

# THE BAY, IN FINAL (post-scale) METRES. Goods are cleared from this box and
# kept everywhere else — see keep_outside_bay(). 14 m wide x 34 m long inside a
# 30 x 54 m building leaves ~8 m of stacked goods down both walls and ~10 m at
# each end, which is what an actual warehouse looks like: a clear drive aisle
# through a full building, not an empty shed.
BAY_HALF_X = 15.0
BAY_HALF_Y = 24.0

# Grid the spread offsets snap to, in SOURCE metres. `09. kardus`,
# `11. bungkus plastik` and `10. bungkus` are NESTED layers of the same
# pallets — a box, its shrink wrap, its outer wrapping — occupying the same
# volume. Their loose parts have slightly different centroids, so offsetting
# each part by its own centroid pulled the wrap off the box by a few cm and
# left brown cardboard and grey plastic fighting for the same pixels. That is
# the "caixas mudando de cor" the camera was revealing. Snapping the offset to
# a 1 m cell gives every layer of one pallet the SAME offset, so they move as
# a unit and stay perfectly nested.
SPREAD_CELL = 1.0

# Objects thinned to the bay rather than deleted outright. Indonesian source
# names; gloss and source polycount in comments.
DECLUTTER = [
    "09. kardus",           # cardboard boxes          277 k
    "11. bungkus plastik",  # shrink-wrapped pallets   133 k
    "10. bungkus",          # wrapping                  22 k
    "12. botol",            # bottles                   28 k
    "14. gas",              # gas bottles               39 k
    "07. lemari",           # racking                   13 k
    "18. ondo",             # pallet stacks             25 k
]

# Genuinely removed: mobile equipment that would read as abandoned in the aisle.
STRIP = [
    "27. KERETA",           # trolleys                  24 k
]

# The only materials that are genuinely metal. Everything else gets metallic
# forced to 0 — see note 2 above.
METAL_OK = {
    "besi biru", "besi hijau", "besi kuning", "besi lis", "besi merah",
    "besi putih", "BESI LAMP",          # besi = iron
    "krum 1", "krum 1.001", "plat krum", "plat hitam",   # chrome / plate
    "seng",                              # corrugated zinc
    "gerbang",                           # the roller gate
}

# The closed skin: oriented inward and exported single-sided so the camera can
# orbit outside and still see in. Matched by object-name prefix.
# `01. rangka` / `04. besi lis` are deliberately NOT here — see
# orient_shell_inward() for why a truss must stay double-sided.
SHELL_WALLS = ("02. dinding depan", "03. dinding")

# Heavy meshes worth decimating, name -> target ratio.
DECIMATE = {
    "03. dinding": 0.22,    # 312 k of wall panelling; 0.22 keeps every opening
    "01. rangka": 0.60,     # structural frame, 26 k
    "21. lampu": 0.50,      # light housings, 18 k
    "24. AC": 0.40,
    # The goods are back (they were deleted outright before), and they are the
    # heaviest things in the file. They are also always 8 m+ from the camera,
    # stacked and self-similar, so they take decimation harder than anything
    # structural.
    # HARD. Tiling 2x2 multiplied the goods by four and the first build shipped
    # 1.65 M triangles — which, on top of the truck's own 7.1 M, cost the WebGL
    # context outright ("Web page caused context loss and was blocked"). These
    # are stacked, self-similar boxes seen from 10 m+ and they take it: 0.12
    # brings the whole set back under ~450 k with no visible loss at bay
    # distance. The truck is the poly budget in this app; the room is not.
    "09. kardus": 0.12,
    "11. bungkus plastik": 0.12,
    "07. lemari": 0.35,
    "18. ondo": 0.25,
    "12. botol": 0.12,
    "14. gas": 0.18,
    "10. bungkus": 0.20,
}


def log(m):
    print("[wh] " + m, flush=True)


def loose_parts(bm):
    """Connected components of a bmesh, as lists of faces. BFS over edge-linked
    faces — bmesh has no built-in for this and ops.separate(LOOSE) would explode
    a 277 k-poly object into thousands of Blender objects."""
    bm.faces.ensure_lookup_table()
    seen = [False] * len(bm.faces)
    out = []
    for f0 in bm.faces:
        if seen[f0.index]:
            continue
        comp, stack = [], [f0]
        seen[f0.index] = True
        while stack:
            f = stack.pop()
            comp.append(f)
            for e in f.edges:
                for nf in e.link_faces:
                    if not seen[nf.index]:
                        seen[nf.index] = True
                        stack.append(nf)
        out.append(comp)
    return out


def scale_structure():
    """Grow the building only. Goods are handled by spread_goods()."""
    n = 0
    for ob in bpy.data.objects:
        if ob.parent is not None or not ob.name.startswith(STRUCTURE):
            continue
        ob.scale = (ob.scale[0] * SCALE_XY, ob.scale[1] * SCALE_XY, ob.scale[2] * SCALE_Z)
        ob.location = (ob.location[0] * SCALE_XY, ob.location[1] * SCALE_XY,
                       ob.location[2] * SCALE_Z)
        n += 1
    bpy.context.view_layer.update()
    log("structure scaled x%.2f: %d objects" % (SCALE, n))


def spread_goods():
    """Move every loose part of the goods out by SCALE WITHOUT resizing it.

    new_vert = part_centre * SCALE + (vert - part_centre)

    So a pallet that stood 6 m from the centre line now stands 12 m out, still
    1.2 m across. That is what "aumentar apenas o armazém, manter as caixas
    como está" means geometrically: the room doubles, the contents do not, and
    they redistribute to line the new walls instead of clustering in the middle.

    Z is deliberately NOT spread — the floor is still the floor, and lifting a
    stack of boxes to 2x its height would leave it hanging in mid-air. Only the
    XY footprint moves.
    """
    moved = parts = 0
    for ob in bpy.data.objects:
        if ob.type != "MESH" or ob.parent is not None or ob.name.startswith(STRUCTURE):
            continue
        me = ob.data
        bm = bmesh.new()
        bm.from_mesh(me)

        # THE FLICKER FIX. Every goods mesh in this file has ~50/50 mixed face
        # normals (measured: kardus 139637 out / 137393 in). Their materials are
        # double-sided, and three.js flips the shading normal on back-facing
        # fragments — so as the camera orbits, each face crosses the
        # front/back-facing boundary and its lighting inverts. That is exactly
        # "as caixas mudando a iluminação de acordo com os movimentos da
        # câmera". Recalculating them consistently outward removes the
        # ambiguity at the source, which is better than hiding it by forcing
        # single-sided (that would punch holes in every open-topped crate).
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

        comps = loose_parts(bm)
        for comp in comps:
            verts = {v for f in comp for v in f.verts}
            if not verts:
                continue
            cx = sum(v.co.x for v in verts) / len(verts)
            cy = sum(v.co.y for v in verts) / len(verts)
            # Snap to SPREAD_CELL so nested layers share one offset — see the
            # constant. round() not floor(): floor biases every pallet toward
            # -X/-Y by half a cell.
            sx = round(cx / SPREAD_CELL) * SPREAD_CELL
            sy = round(cy / SPREAD_CELL) * SPREAD_CELL
            dx = sx * SCALE_XY - sx
            dy = sy * SCALE_XY - sy
            for v in verts:
                v.co.x += dx
                v.co.y += dy
        bm.normal_update()
        bm.to_mesh(me)
        bm.free()
        me.update()
        parts += len(comps)
        moved += 1
    log("goods spread x%.2f (size unchanged): %d objects, %d loose parts"
        % (SCALE, moved, parts))


def tile_goods():
    """Refill the enlarged floor with linked copies of the goods.

    Spreading moved the pallets apart but did not make more of them, so a 16x
    floor ended up holding the original handful — "o armazém continua faltando
    muita coisa". Tiling 2x2 on the source footprint puts the density back to a
    quarter of the original, which is what a real DC looks like once you allow
    for the aisles the bay filter cuts.

    NOT linked, deliberately: keep_outside_bay() runs after this and edits mesh
    data per object, so a shared datablock would let one tile's aisle cut punch
    the same hole in all four.
    """
    # source goods footprint, times the spread factor, gives the tile pitch
    pitch_x, pitch_y = 8.0 * SCALE_XY, 15.0 * SCALE_XY
    offsets = [(-pitch_x / 2, -pitch_y / 2), (pitch_x / 2, -pitch_y / 2),
               (-pitch_x / 2, pitch_y / 2), (pitch_x / 2, pitch_y / 2)]
    made = 0
    for ob in list(bpy.data.objects):
        if ob.type != "MESH" or ob.parent is not None or ob.name.startswith(STRUCTURE):
            continue
        if ob.name == "ext_ground":
            continue
        for k, (dx, dy) in enumerate(offsets):
            if k == 0:
                ob.location = (ob.location[0] + dx, ob.location[1] + dy, ob.location[2])
                continue
            dup = ob.copy()
            dup.data = ob.data.copy()
            dup.name = "%s.tile%d" % (ob.name, k)
            bpy.context.collection.objects.link(dup)
            dup.location = (ob.location[0] - offsets[0][0] + dx,
                            ob.location[1] - offsets[0][1] + dy,
                            ob.location[2])
            made += 1
    bpy.context.view_layer.update()
    log("goods tiled 2x2: %d linked copies" % made)


def strip_clutter():
    removed = 0
    for name in STRIP:
        ob = bpy.data.objects.get(name)
        if ob is None:
            log("  STRIP miss: %s" % name)
            continue
        n = len(ob.data.polygons) if ob.type == "MESH" else 0
        bpy.data.objects.remove(ob, do_unlink=True)
        removed += n
    log("stripped %s polys" % f"{removed:,}")


def keep_outside_bay():
    """Delete only the goods standing in the truck's bay, leaving the rest.

    WHY WHOLE LOOSE PARTS AND NOT JUST FACES. Deleting faces whose centroid
    falls in the bay would slice every pallet on the boundary in half and leave
    a row of hollow, open-backed boxes facing the camera — worse than an empty
    shed. So each object is split into connected components first (a BFS over
    edge-linked faces) and a component is dropped only if its whole bounding box
    overlaps the bay. Pallets survive or go as pallets.
    """
    total_before = total_after = 0
    # Prefix match so the tiles from tile_goods() get their aisle cut too —
    # without this, three of the four copies would stand in the truck's bay.
    names = [o.name for o in bpy.data.objects
             if o.type == "MESH" and any(o.name == d or o.name.startswith(d + ".tile")
                                         for d in DECLUTTER)]
    for name in names:
        ob = bpy.data.objects.get(name)
        if ob is None or ob.type != "MESH":
            continue

        me = ob.data
        before = len(me.polygons)
        total_before += before
        bm = bmesh.new()
        bm.from_mesh(me)
        bm.faces.ensure_lookup_table()
        M = ob.matrix_world

        seen = [False] * len(bm.faces)
        doomed = []
        for f0 in bm.faces:
            if seen[f0.index]:
                continue
            comp = []
            stack = [f0]
            seen[f0.index] = True
            lo = [1e18, 1e18]
            hi = [-1e18, -1e18]
            while stack:
                f = stack.pop()
                comp.append(f)
                for v in f.verts:
                    w = M @ v.co
                    lo[0] = min(lo[0], w.x); hi[0] = max(hi[0], w.x)
                    lo[1] = min(lo[1], w.y); hi[1] = max(hi[1], w.y)
                for e in f.edges:
                    for nf in e.link_faces:
                        if not seen[nf.index]:
                            seen[nf.index] = True
                            stack.append(nf)
            # AABB overlap against the bay box
            if lo[0] < BAY_HALF_X and hi[0] > -BAY_HALF_X and \
               lo[1] < BAY_HALF_Y and hi[1] > -BAY_HALF_Y:
                doomed.extend(comp)

        if doomed:
            bmesh.ops.delete(bm, geom=doomed, context="FACES")
        bm.to_mesh(me)
        bm.free()
        me.update()
        total_after += len(me.polygons)
        log("  bay-clear %-20s %7d -> %7d polys" % (name, before, len(me.polygons)))

        if len(me.polygons) == 0:
            bpy.data.objects.remove(ob, do_unlink=True)

    log("goods kept outside the bay: %s of %s polys"
        % (f"{total_after:,}", f"{total_before:,}"))


def fix_materials():
    """Force metallic off on dielectrics, give the one procedural material a
    flat colour it can actually export, and repaint the floor."""
    fixed = []
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        b = m.node_tree.nodes.get("Principled BSDF")
        if not b:
            continue

        # BESI LAMP is the only node-driven material in the file (noise +
        # voronoi into base colour). glTF cannot carry that, and an unlinked
        # socket exports as whatever stale value it holds — so set it.
        if b.inputs["Base Color"].is_linked:
            for l in list(b.inputs["Base Color"].links):
                m.node_tree.links.remove(l)
            b.inputs["Base Color"].default_value = (0.52, 0.52, 0.55, 1.0)
            fixed.append(m.name + " (unlinked procedural)")

        if m.name not in METAL_OK:
            if b.inputs["Metallic"].default_value > 0.0:
                fixed.append("%s m=%.2f->0" % (m.name, b.inputs["Metallic"].default_value))
                b.inputs["Metallic"].default_value = 0.0

    # The floor ships as near-black metal. A warehouse floor is sealed
    # concrete: mid grey, rough, dielectric. This is the single largest
    # surface in the scene and the truck's contact shadow lands on it.
    f = bpy.data.materials.get("lantai")
    if f and f.use_nodes:
        b = f.node_tree.nodes.get("Principled BSDF")
        if b:
            b.inputs["Base Color"].default_value = (0.19, 0.19, 0.18, 1.0)
            b.inputs["Roughness"].default_value = 0.72
            b.inputs["Metallic"].default_value = 0.0
            fixed.append("lantai -> sealed concrete")

    for f in fixed:
        log("  mat " + f)
    log("materials fixed: %d" % len(fixed))


def decimate():
    # Prefix match, not exact: tile_goods() produces "09. kardus.tile2" and
    # those are the copies that most need the reduction.
    targets = []
    for ob in bpy.data.objects:
        if ob.type != "MESH":
            continue
        for name, ratio in DECIMATE.items():
            if ob.name == name or ob.name.startswith(name + ".tile"):
                targets.append((ob.name, ratio))
                break
    for name, ratio in targets:
        ob = bpy.data.objects.get(name)
        if ob is None or ob.type != "MESH":
            continue
        before = len(ob.data.polygons)
        mod = ob.modifiers.new("dec", "DECIMATE")
        mod.ratio = ratio
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.modifier_apply(modifier=mod.name)
        log("  decimate %-20s %7d -> %7d" % (name, before, len(ob.data.polygons)))


def orient_shell_inward():
    """Make every wall/roof face point INTO the room, then cull backfaces.

    WHY PER-FACE AND NOT A BLANKET REVERSE. The first version just reversed
    every face in the shell, which assumes the source modelled it outward. It
    did not, consistently — so the reverse turned the near wall from
    "invisible from outside" into "solid from outside", and the cutaway broke.
    Guessing is not available here: the fix is to MEASURE each face against the
    building centre and flip only the ones actually facing out. That is
    deterministic whichever way the artist happened to model it.

    Backface culling then removes the near wall whenever the camera is outside
    it, which is what lets a 25 m orbit work around a 30 m building. The
    lighting normal flips with the geometry, so interior surfaces stay lit
    correctly from inside — the surfaces genuinely face the room now.

    ONLY the wall and roof skins. The frame (`01. rangka`) and trim
    (`04. besi lis`) are open lattice, not a closed shell: a radial test is
    meaningless on a truss and culling one would make half its members vanish.
    Those stay double-sided.
    """
    floor = bpy.data.objects.get("06. lantai")
    if floor:
        bb = [floor.matrix_world @ Vector(c) for c in floor.bound_box]
        cx = (min(v.x for v in bb) + max(v.x for v in bb)) / 2.0
        cy = (min(v.y for v in bb) + max(v.y for v in bb)) / 2.0
    else:
        cx = cy = 0.0
    centre = Vector((cx, cy, 2.2 * SCALE_Z))   # mid-height: makes the roof read as "up"

    done = flipped = kept = 0
    for ob in list(bpy.data.objects):
        if ob.type != "MESH" or not ob.name.startswith(SHELL_WALLS):
            continue

        # Private material copies: `seng`, `tembok putih` etc. are shared with
        # the trusses and the goods, and use_backface_culling lives on the
        # MATERIAL — culling the shared one would cull them too.
        for slot in ob.material_slots:
            if not slot.material:
                continue
            if slot.material.users > 1:
                slot.material = slot.material.copy()
            slot.material.use_backface_culling = True

        me = ob.data
        M = ob.matrix_world
        N = M.to_3x3().inverted_safe().transposed()
        bm = bmesh.new()
        bm.from_mesh(me)
        out = []
        for f in bm.faces:
            wn = (N @ f.normal).normalized()
            wc = M @ f.calc_center_median()
            if wn.dot((wc - centre).normalized()) > 0.0:
                out.append(f)
        if out:
            bmesh.ops.reverse_faces(bm, faces=out)
        flipped += len(out)
        kept += len(bm.faces) - len(out)
        bm.to_mesh(me)
        bm.free()
        me.update()
        done += 1

    log("shell oriented inward: %d objects, %s faces flipped, %s already inward"
        % (done, f"{flipped:,}", f"{kept:,}"))


def add_exterior():
    """Ground outside the building. Without it, anything visible through the
    gate or a culled wall is void — and void is the one thing that instantly
    reads as unfinished."""
    m = bpy.data.materials.get("EXT_ASPHALT") or bpy.data.materials.new("EXT_ASPHALT")
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    if b:
        b.inputs["Base Color"].default_value = (0.15, 0.15, 0.16, 1.0)
        b.inputs["Roughness"].default_value = 0.90
        b.inputs["Metallic"].default_value = 0.0

    me = bpy.data.meshes.new("ext_ground")
    ob = bpy.data.objects.new("ext_ground", me)
    bpy.context.collection.objects.link(ob)
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=16, y_segments=16, size=0.5,
                          matrix=Matrix.Identity(4))
    bmesh.ops.scale(bm, vec=(240.0, 240.0, 1.0), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(0.0, 0.0, -0.02), verts=bm.verts)
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        for l in f.loops:
            l[uv].uv = (l.vert.co.x / 6.0, l.vert.co.y / 6.0)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(m)
    log("exterior ground added (240 m)")


def report():
    tot = 0
    for o in bpy.data.objects:
        if o.type == "MESH":
            o.data.calc_loop_triangles()
            tot += len(o.data.loop_triangles)
    log("final triangles: %s across %d meshes"
        % (f"{tot:,}", len([o for o in bpy.data.objects if o.type == "MESH"])))


def export():
    os.makedirs(OUT_DIR, exist_ok=True)
    if bpy.context.scene.camera:
        bpy.data.objects.remove(bpy.context.scene.camera, do_unlink=True)
    bpy.ops.export_scene.gltf(
        filepath=OUT,
        export_format="GLB",
        export_apply=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
    )
    log("wrote %s  (%.1f MB)" % (OUT, os.path.getsize(OUT) / 1048576.0))


def main():
    # Order matters: scale FIRST so the bay filter measures against the final
    # metres, and decimate AFTER the filter so nothing is spent on geometry
    # that is about to be deleted.
    scale_structure()
    spread_goods()
    strip_clutter()
    tile_goods()
    keep_outside_bay()
    fix_materials()
    decimate()
    orient_shell_inward()
    add_exterior()
    report()
    export()
    log("done")


main()
