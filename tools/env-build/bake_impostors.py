# Bake Poly Haven plants into RGBA impostor atlases.
#
#   blender -b -P bake_impostors.py
#
# WHY. The brief asks for realistic Poly Haven trees. Measured, they cannot be
# used directly and it is not close:
#
#   island_tree_02   1 072 212 faces for a 3.4 m tree
#   searsia_lucida     377 192 faces for a 2.3 m shrub
#   jacaranda_tree   (bigger again)
#
# The perimeter belt is ~450 trees. At a million faces each that is half a
# BILLION triangles in a real-time scene, and decimating is not a way out: these
# have no leaf-card atlas to preserve — the leaves are modelled geometry, and
# `alphaMode: BLEND` over a JPG baseColor with no alpha channel confirms it —
# so a collapse decimator merges individual leaves into paste.
#
# THE ANSWER IS THE STANDARD ONE: render the real asset, once, offline, into an
# RGBA sheet, then draw it on crossed cards at runtime. The appearance IS the
# Poly Haven tree, photographed. Cost at runtime is 8 triangles.
#
# WHAT THIS BAKES, AND WHY IT LOOKS RIGHT
#
# * ORTHOGRAPHIC, not perspective — a card is flat, so any perspective baked in
#   fights the card's own projection and the tree appears to bulge.
# * FLAT-LIT. The runtime scene lights the card itself, so a baked sun would be
#   a second, contradictory light that no longer matches the scene's. The bake
#   uses a bright even world and no sun, which is as close to albedo as this
#   gets without a full bake pipeline.
# * FILM TRANSPARENT, and `view_transform = 'Standard'`. AgX would tone-map the
#   sheet, and then the runtime tone-maps it AGAIN.
# * A ROW OF AZIMUTHS. One card seen from behind is the same card mirrored, and
#   a whole belt of identical mirrored trees is very visible. Several angles in
#   one atlas let each tree pick a different column.
import bpy
import glob
import json
import math
import os
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "_src_ph")
OUT = os.path.join(SRC, "impostors")

# asset -> (atlas columns, pixels per column, target real height in metres)
#
# The heights are the SITE's requirement, not the asset's: island_tree_02 is a
# 3.4 m sapling and the belt wants 9 m canopy trees. Scaling the card is free
# and correct — what would be wrong is scaling the modelled geometry, because
# then the individual leaves scale too.
JOBS = {
    "jacaranda_tree": (4, 512, 11.0),
    "island_tree_02": (4, 512, 7.5),
    "searsia_lucida": (3, 384, 2.4),
}


def log(m):
    print("[imp] " + m, flush=True)


def load(asset):
    f = glob.glob(os.path.join(SRC, asset, "*.gltf"))
    if not f:
        return None
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=f[0])
    fresh = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    if not fresh:
        return None
    for o in bpy.data.objects:
        o.select_set(o in fresh)
    bpy.context.view_layer.objects.active = fresh[0]
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(fresh) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    # Leaves come in as BLEND over a JPG with no alpha, which in EEVEE/Cycles is
    # simply opaque — but it also makes them sort, which on a million faces is
    # slow and pointless. Force opaque.
    for slot in ob.material_slots:
        if not slot.material:
            continue
        try:
            slot.material.blend_method = "OPAQUE"
        except TypeError:
            pass
    return ob


def setup_world():
    w = bpy.data.worlds.new("w")
    bpy.context.scene.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    bg.inputs["Strength"].default_value = 1.15


def bake(asset, cols, px, target_h):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    setup_world()
    ob = load(asset)
    if ob is None:
        log("%s: nada importado" % asset)
        return
    vs = ob.data.vertices
    lo = Vector((min(v.co.x for v in vs), min(v.co.y for v in vs), min(v.co.z for v in vs)))
    hi = Vector((max(v.co.x for v in vs), max(v.co.y for v in vs), max(v.co.z for v in vs)))
    h = hi.z - lo.z
    span = max(hi.x - lo.x, hi.y - lo.y, h)
    log("%-16s %d faces, %.1f x %.1f x %.1f m"
        % (asset, len(ob.data.polygons), hi.x - lo.x, hi.y - lo.y, h))
    # centre on its own footprint, base on z=0
    ob.data.transform(Matrix.Translation(
        Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))))
    ob.data.update()

    # ONDE FICA A COPA, medido e nao chutado. O cartao horizontal tem de pousar
    # na altura em que a folhagem realmente esta; um 0,65 fixo poe a copa da
    # searsia (um arbusto de 2,4 m, folhagem quase ate o chao) no ar e a da
    # jacaranda (tronco limpo ate a metade) enterrada no tronco. A media das
    # cotas acima de 40 % da altura e uma medida da MASSA — os vertices sao as
    # folhas, entao a contagem ja pondera por onde ha folha.
    nv = len(ob.data.vertices)
    flat = [0.0] * (3 * nv)
    ob.data.vertices.foreach_get("co", flat)
    zs = flat[2::3]
    h1 = max(zs) or 1.0
    up = [z for z in zs if z > 0.40 * h1]
    crown = (sum(up) / len(up)) / h1 if up else 0.65

    # ---- O MACICO, e a razao dele -----------------------------------------
    #
    # MEDIDO no primeiro impostor: a copa da jacaranda cobre 32,9 % da propria
    # folha — 67 % da imagem e vazio. Isso e a arvore, nao o assado: e uma copa
    # aberta, fotografada isolada. Um cartao dela e majoritariamente buraco, e
    # cruzar tres folhas assim da um X esparso visto de cima em vez de uma copa.
    #
    # O corte de alfa NAO era o culpado: cutoff 0,38 preserva 28,6 % dos pixels e
    # cutoff 0,02 preservaria 32,9 %. Quatro pontos. Baixar o corte nao resolve
    # um vazio que esta na foto.
    #
    # O que resolve e fotografar um GRUPO. Tres exemplares embaralhados —
    # deslocados, girados e em escalas diferentes — preenchem os buracos uns dos
    # outros e a folha passa a ser uma massa. Custa ZERO no runtime: continua
    # sendo um cartao, so que agora com um bosque desenhado nele.
    #
    # Deslocamento pequeno de proposito (22 % do vao): afastar mais alargaria a
    # folha e cada peca plantada viraria tres arvores separadas em vez de uma
    # copa cheia.
    clump = 3 if h > 3.0 else 2
    extra = []
    for i in range(1, clump):
        dup = ob.copy()
        dup.data = ob.data
        bpy.context.collection.objects.link(dup)
        ang = 2.399 * i
        rad = span * 0.22
        s = 0.72 + 0.26 * ((i * 37) % 7) / 6.0
        dup.location = (math.cos(ang) * rad, math.sin(ang) * rad, 0.0)
        dup.rotation_euler = (0.0, 0.0, ang * 1.7)
        dup.scale = (s, s, s)
        extra.append(dup)
    bpy.context.view_layer.update()

    # O enquadramento passa a ser do GRUPO. Medir so o primeiro exemplar
    # cortaria os vizinhos na borda da folha.
    pts = []
    for o in [ob] + extra:
        pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    h = hi.z - lo.z
    span = max(hi.x - lo.x, hi.y - lo.y, h)
    log("  maciço de %d, envolvente %.1f x %.1f x %.1f m"
        % (clump, hi.x - lo.x, hi.y - lo.y, h))

    # FRAMED TO THE SILHOUETTE, NOT TO A SQUARE.
    #
    # The first bake used a square render at max(w, d, h) and searsia_lucida —
    # 4.8 m wide and 2.3 m tall — came out with 57 % of its sheet empty. That is
    # not just wasted texels: the card geometry has to cover the whole sheet, so
    # the empty half hung 1.55 m THROUGH the ground, which is what the placement
    # audit was reporting as a metre and a half of buried shrub.
    #
    # Rendering at the plant's own aspect makes the card the plant's own shape.
    # ortho_scale always applies to the LARGER render dimension, so setting the
    # resolution to the aspect makes both axes 1.12x the extents.
    wide = max(hi.x - lo.x, hi.y - lo.y)
    if wide >= h:
        rx, ry = px, max(16, int(round(px * h / wide)))
        ortho = wide * 1.12
    else:
        ry, rx = px, max(16, int(round(px * wide / h)))
        ortho = h * 1.12
    cam_d = bpy.data.cameras.new("c")
    cam_d.type = "ORTHO"
    # A little headroom so the crown never touches the edge of the sheet — a
    # leaf clipped at the boundary smears when the texture is sampled.
    cam_d.ortho_scale = ortho
    cam = bpy.data.objects.new("c", cam_d)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam

    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 24
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x = rx
    sc.render.resolution_y = ry
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    try:
        sc.view_settings.view_transform = "Standard"
    except TypeError:
        pass

    os.makedirs(OUT, exist_ok=True)
    for i in range(cols):
        a = 2.0 * math.pi * i / cols
        r = span * 2.2
        cam.location = Vector((math.cos(a) * r, math.sin(a) * r, h * 0.5))
        d = Vector((0.0, 0.0, h * 0.5)) - cam.location
        cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = os.path.join(OUT, "%s_%d.png" % (asset, i))
        bpy.ops.render.render(write_still=True)

    # ---- A VISTA DE CIMA, e por que ela nao existia --------------------------
    #
    # "as arvores parecem um X visto de cima, nao um circulo" — e a leitura esta
    # certa, porque de cima UM X E LITERALMENTE O QUE HA. Um impostor cruzado e
    # feito so de laminas VERTICAIS; da vertical cada lamina e uma reta, entao a
    # copa inteira sao 5 riscos saindo do tronco. Nenhuma quantidade de laminas
    # conserta isso: 5 riscos viram 8 riscos. Falta uma superficie que tenha
    # AREA quando olhada de cima, e isso e um cartao horizontal — que precisa de
    # uma foto de cima, que este bake nunca tirou.
    #
    # A camera enquadra a PLANTA (extensao em xy), nao a elevacao, e por isso e
    # quadrada e independente do enquadramento lateral acima.
    wide_xy = max(hi.x - lo.x, hi.y - lo.y)
    ortho_top = wide_xy * 1.12
    cam_d.ortho_scale = ortho_top
    sc.render.resolution_x = px
    sc.render.resolution_y = px
    cam.location = Vector((0.0, 0.0, h + span * 2.2))
    # -Z apontando para baixo, +Y do render alinhado com +Y do mundo: sem isso a
    # copa sai girada em relacao as laminas laterais da mesma arvore.
    cam.rotation_euler = (0.0, 0.0, 0.0)
    sc.render.filepath = os.path.join(OUT, "%s_top.png" % asset)
    bpy.ops.render.render(write_still=True)
    # GEOMETRY OF THE CARD, written beside the sheet rather than re-derived.
    #
    # The camera looks at (0, 0, h/2) through an ortho box `span * 1.12` tall,
    # so the visible band is h/2 +/- span*1.12/2 and the tree's BASE (z=0) lands
    # at this fraction up the image:
    #
    #     base = 0.5 - h / (2 * span * 1.12)
    #
    # That number is the whole reason a card sits on the ground instead of
    # hovering or sinking: the image is mostly empty above the crown, so a card
    # aligned by its own bottom edge would bury the trunk. The builder offsets
    # by `base` and the tree stands on z=0.
    ortho_x = ortho if rx >= ry else ortho * rx / float(ry)
    ortho_y = ortho if ry >= rx else ortho * ry / float(rx)
    k = target_h / max(h, 1e-6)
    card_w, card_h = ortho_x * k, ortho_y * k
    base = 0.5 - h / (2.0 * ortho_y)
    top_w = ortho_top * k
    with open(os.path.join(OUT, "%s.json" % asset), "w") as fh:
        json.dump({"card_w": card_w, "card_h": card_h, "base": base,
                   "cols": cols, "height": target_h, "source": asset,
                   # o cartao de copa: lado em metros e a que fracao da altura
                   # da planta ele pousa
                   "top_w": top_w, "crown": crown}, fh)
    log("  -> %d cols %dx%d px, card %.1f x %.1f m, base %.3f, planta %.1f m"
        % (cols, rx, ry, card_w, card_h, base, target_h))
    log("     copa: cartao de %.1f m a %.0f%% da altura" % (top_w, crown * 100.0))


def main():
    for asset, (cols, px, th) in JOBS.items():
        if os.path.isdir(os.path.join(SRC, asset)):
            bake(asset, cols, px, th)
        else:
            log("%s: nao baixado" % asset)
    log("done -> %s" % OUT)


main()
