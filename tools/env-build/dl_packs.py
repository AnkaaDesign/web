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


# ---------------------------------------------------------------------------
# DECALCOMANIAS SOLDADAS — correcao POR PECA, e nao por heuristica global.
#
# `separate_coplanar` ignora, de proposito, todo par que partilhe vertice: dois
# triangulos do mesmo quad partilham dois, e mexer neles rasga a malha. Foi
# exatamente o que aconteceu quando essa guarda foi afrouxada — as janelas dos
# MC_* saltaram na diagonal, porque mover uma face soldada arrasta os vertices
# das vizinhas.
#
# Mas ha decalcomanias que SAO soldadas: uma placa vermelha modelada dentro da
# parede, com o contorno cosido a ela. Medido no MC_03: 206 pares a menos de
# 4 mm, face pequena contida numa maior. Essas cintilam e a funcao global nunca
# lhes toca.
#
# A operacao segura e a MESMA de sempre, mas na ordem certa: CORTAR primeiro
# (`split_edges` no contorno do conjunto), mover depois. A face ganha vertices
# proprios, a parede fica exatamente onde estava, e o resultado e o que a peca
# devia ser — um adesivo aplicado sobre a parede.
#
# E CORRE SO NAS PECAS LISTADAS. Nao porque as outras estejam limpas, mas porque
# esta operacao ja provou ser capaz de estragar uma fachada: cada peca entra
# aqui depois de ser vista, uma de cada vez.
DECAL_FIX = {"MC_03"}

DECAL_MAX_AREA = 3.0        # m2 — acima disto e parede, nao adesivo
DECAL_GAP = 0.004           # so o que o buffer nao separa
DECAL_LIFT = 0.006          # 6 mm: invisivel a 5 m, decisivo para o buffer


def lift_welded_decals(ob, log):
    """Destaca e levanta as decalcomanias soldadas de UMA peca."""
    me = ob.data
    nf = len(me.polygons)
    if not nf:
        return 0
    ctr = Vector((0.0, 0.0, 0.0))
    for v in me.vertices:
        ctr += v.co
    ctr /= max(1, len(me.vertices))

    norm, cent, area = [], [], []
    for p in me.polygons:
        n = p.normal.copy()
        norm.append(n.normalized() if n.length > 1e-9 else n)
        cent.append(p.center.copy())
        area.append(p.area)

    # baldes grosseiros por normal, so para nao ser quadratico na peca inteira
    buckets = {}
    for i in range(nf):
        n = norm[i]
        key = (round(abs(n.x), 1), round(abs(n.y), 1), round(abs(n.z), 1))
        buckets.setdefault(key, []).append(i)

    picks = {}
    for ids in buckets.values():
        # "GRANDE" E RELATIVO, e o absoluto estava errado. Exigir que a parede
        # tivesse mais de 3 m2 nao encontrava nada no MC_03: as paredes dele
        # estao trianguladas em pedacos de 1 a 2 m2, e um adesivo de 5 cm2 e
        # perfeitamente coplanar com um deles. O que define adesivo nao e a
        # area da parede, e a RAZAO entre as duas — uma placa e uma ordem de
        # grandeza menor que o pedaco de parede que a carrega.
        small = [i for i in ids if 0.002 < area[i] <= DECAL_MAX_AREA]
        if len(ids) < 2 or not small:
            continue
        for i in small:
            ni = norm[i]
            for j in ids:
                if j == i or area[j] < area[i] * 2.5:
                    continue
                if abs(ni.dot(norm[j])) < 0.999:
                    continue
                if abs(ni.dot(cent[i] - cent[j])) > DECAL_GAP:
                    continue
                # o centro do pequeno tem de cair DENTRO do grande: faces
                # vizinhas falham isto, decalcomanias passam.
                up = Vector((0.0, 0.0, 1.0)) if abs(ni.z) < 0.9 \
                    else Vector((1.0, 0.0, 0.0))
                ax = ni.cross(up).normalized()
                ay = ni.cross(ax)
                poly = [(me.vertices[k].co.dot(ax), me.vertices[k].co.dot(ay))
                        for k in me.polygons[j].vertices]
                q = (cent[i].dot(ax), cent[i].dot(ay))
                inside, m = False, len(poly)
                for e in range(m):
                    a2, b2 = poly[e], poly[(e + 1) % m]
                    if (a2[1] > q[1]) != (b2[1] > q[1]):
                        xx = a2[0] + (q[1] - a2[1]) * (b2[0] - a2[0]) \
                            / ((b2[1] - a2[1]) or 1e-12)
                        if q[0] < xx:
                            inside = not inside
                if inside:
                    picks[i] = _outward(ni, cent[i], ctr)
                    break
    if not picks:
        return 0

    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    sel = {bm.faces[i]: d * DECAL_LIFT for i, d in picks.items() if i < len(bm.faces)}
    edges = set()
    for f in sel:
        for e in f.edges:
            if any(g not in sel for g in e.link_faces):
                edges.add(e)
    if edges:
        bmesh.ops.split_edges(bm, edges=list(edges))
    seen = set()
    for f, off in sel.items():
        for v in f.verts:
            if v in seen:
                continue
            v.co += off
            seen.add(v)
    bm.to_mesh(me)
    bm.free()
    me.update()
    log("    %-11s %d adesivos soldados destacados e levantados %d mm"
        % (ob.name[:11], len(sel), int(DECAL_LIFT * 1000)))
    return len(sel)


def _outward(n, face_center, piece_center):
    """A normal `n` virada para FORA da peca.

    Uma face isolada nao sabe onde e fora — `n` aponta para onde o autor do
    modelo enrolou os vertices, e nestes ripes isso e arbitrario. A peca sabe:
    para um painel numa fachada, "fora" e o sentido que se afasta do centro do
    edificio. Nao e infalivel (um painel numa parede interior aponta para dentro
    da sala), mas ali o painel continua visivel e separado, que e o que interessa
    — enquanto o sinal trocado numa fachada enterra a peca e ela desaparece.
    """
    v = face_center - piece_center
    return -n if n.dot(v) < 0.0 else n


def _drop_duplicate_faces(ob, log):
    """Apaga faces que ocupam LITERALMENTE o mesmo lugar que outra.

    ESTAS NUNCA PODIAM SER CORRIGIDAS POR AFASTAMENTO, e e por isso que ficaram
    para tras em todas as versoes anteriores. Uma face duplicada sobre os MESMOS
    vertices nao se pode afastar: mover os vertices move as duas, e a folga
    continua zero. Pior — o proprio detetor as ignorava, porque a guarda que
    protege triangulos vizinhos ("se partilham vertice, sao a mesma superficie")
    e verdadeira para vizinhos e falsa para gemeas: duas gemeas partilham TODOS
    os vertices.

    Medido no set.glb: IBC_15 e a sua duplicata levavam 44,8 m2 em 8 pares a
    0,00 mm — as unicas faces do cenario inteiro em disputa exata de
    profundidade. Nao ha nada a preservar numa delas: sao a mesma superficie
    desenhada duas vezes. O verso tambem nao se perde, porque o exportador
    escreve `doubleSided` nestes materiais.
    """
    me = ob.data
    # A UV ENTRA NA CHAVE, e sem ela isto apagava JANELAS.
    #
    # Nestes packs uma decalcomania — o vidro de uma janela, uma placa, um
    # letreiro — e modelada como uma face SOBRE os mesmos vertices da parede,
    # distinguida so pela UV (e as vezes pelo material). Com a chave a olhar so
    # para os vertices, as duas eram "a mesma face" e uma delas ia fora ao
    # acaso: metade das vezes a que caia era o vidro, e a fachada ficava com os
    # caixilhos vazios. Duas faces so sao verdadeiramente redundantes se
    # desenharem o MESMO pixel — mesmos vertices, mesma UV, mesmo material.
    uvl = me.uv_layers.active
    me_uv = uvl.data if uvl else None
    seen, dup = {}, []
    for p in me.polygons:
        uvk = ()
        if me_uv is not None:
            uvk = tuple(sorted((round(me_uv[li].uv[0], 5),
                                round(me_uv[li].uv[1], 5))
                               for li in p.loop_indices))
        k = (tuple(sorted(p.vertices)), uvk, p.material_index)
        if k in seen:
            dup.append(p.index)
        else:
            seen[k] = p.index
    if not dup:
        return 0
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.faces[i] for i in dup], context="FACES_ONLY")
    bm.to_mesh(me)
    bm.free()
    me.update()
    log("    %-11s %d faces gemeas apagadas (folga zero, nao afastavel)"
        % (ob.name[:11], len(dup)))
    return len(dup)


def separate_coplanar(ob, log, step=0.010, tol=0.012, rounds=4):
    """Afasta superficies que disputam profundidade — portas, placas, paineis.

    Z-FIGHTING NAO E BUG DE TEXTURA, e e assim que ele se apresenta: a porta de
    um galpao "piscando". Duas faces coincidentes disputam a mesma profundidade e
    qual vence depende do angulo da camera, entao a superficie cintila conforme a
    orbita anda. Vem do modelo original — sao paineis, portas e placas modelados
    EM CIMA da parede, sem folga, contando com a ordem de desenho do autor.

    ESTA E A TERCEIRA VERSAO E A PORTA CONTINUAVA PISCANDO. O que as duas
    anteriores erraram:

    1. AGRUPAR PLANO POR ARREDONDAMENTO. A chave era `round(n.dot(centro), 2)`,
       ou seja baldes de 1 cm. Duas faces a 3 mm uma da outra caem em baldes
       DIFERENTES sempre que a fronteira do balde passa entre elas — e a
       fronteira passa em algum lugar, entao o defeito escapava dependendo de
       onde o predio estivesse no espaco. O criterio agora e a DISTANCIA entre
       as duas (|dj - di| < tol), que nao tem fronteira.

    2. NAO CANONIZAR O SENTIDO. Uma placa modelada com verso, ou uma face
       virada para dentro da parede, tem normal OPOSTA e caia noutro grupo. Como
       o exportador do Blender escreve `doubleSided` por padrao nestes
       materiais, essa face e desenhada e briga do mesmo jeito. Agora frente e
       verso do mesmo plano caem no mesmo grupo.

    3. MOVER FACE, E NAO CASCA. Afastar uma face de cada par abre fenda entre
       ela e as faces vizinhas da mesma peca. A deteccao ja exige cascas
       distintas — logo a peca aplicada E uma casca inteira, e mover a casca
       toda e a unica operacao que nao pode rasgar nada.

    O passo tambem subiu de 4 mm para 1 cm: o buffer resolve ~0,7 mm a 100 m com
    o `near` mais apertado que o app usa, entao 4 mm ja bastariam — mas 1 cm e
    a espessura real de um painel aplicado e continua invisivel a 30 m.

    A CASCA MENOR E A QUE SE MOVE, e ela se move PARA FORA DA PECA.

    ERA "AO LONGO DA PROPRIA NORMAL", e essa foi a quarta versao a falhar — mas
    de outra maneira, e a maneira importa porque muda o sintoma. Uma porta destes
    ripes vem, com frequencia, com o enrolamento invertido: a normal dela aponta
    para DENTRO da parede. Empurrar 1 cm ao longo dela enterra a porta na parede
    em vez de a destacar, e o relato deixa de ser "esta piscando" para passar a
    ser "nem sequer aparece" — que foi exatamente o que se viu no app.

    O sentido certo nao esta na face: uma face isolada nao sabe o que e fora. Ele
    esta na PECA — a normal e orientada contra o vetor centro-da-peca -> centro-
    da-face, que para um painel numa fachada aponta sempre para fora do edificio.

    E AS DUPLICADAS EXATAS NAO SE AFASTAM, APAGAM-SE. Ver `_drop_duplicate_faces`.
    """
    # INTERRUPTOR DE DIAGNOSTICO. PARK_NO_SEP=1 desliga a separacao inteira, o
    # que permite render A/B com e sem ela sobre a MESMA cena — a unica forma de
    # dizer se um risco na fachada veio daqui ou ja vinha do pack.
    if os.environ.get("PARK_NO_SEP") == "1":
        return 0
    _drop_duplicate_faces(ob, log)
    total = _separate_pass(ob, step, tol)
    if total:
        log("    %-11s %d pecas aplicadas afastadas %d mm"
            % (ob.name[:11], total, int(step * 1000)))
    return total


def _separate_pass(ob, step, tol):
    """Uma passagem de deteccao e afastamento. Devolve quantas pecas moveu.

    UMA PASSAGEM, NAO UM CICLO. Iterar parecia obviamente melhor (afastar uma
    casca pode encosta-la na seguinte) e na pratica so amplificou o que ja estava
    errado: cada volta empurrava mais geometria, e o que se via no app eram
    fachadas rasgadas. Enquanto a deteccao nao for provadamente segura, correr
    menos e melhor que correr mais.
    """
    me = ob.data
    # centro geometrico da peca, para orientar o empurrao (ver acima)
    ctr = Vector((0.0, 0.0, 0.0))
    if len(me.vertices):
        for v in me.vertices:
            ctr += v.co
        ctr /= len(me.vertices)

    # ---- cascas (componentes conexos), por uniao-busca sobre as arestas ----
    bm = bmesh.new()
    bm.from_mesh(me)
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
    shell = [find(i) for i in range(len(parent))]
    bm.free()

    verts_of, area_of = {}, {}
    for vi, s in enumerate(shell):
        verts_of.setdefault(s, []).append(vi)
    for p in me.polygons:
        s = shell[p.vertices[0]]
        area_of[s] = area_of.get(s, 0.0) + p.area

    # ---- planos, com o sentido canonizado ---------------------------------
    groups = {}
    for p in me.polygons:
        n = p.normal.copy()
        if n.length < 1e-6:
            continue
        n.normalize()
        d = n.dot(p.center)
        flip = False
        for c in (n.x, n.y, n.z):
            if abs(c) > 1e-6:
                flip = c < 0.0
                break
        cn = -n if flip else n
        cd = -d if flip else d
        groups.setdefault((round(cn.x, 2), round(cn.y, 2), round(cn.z, 2)),
                          []).append((cd, p, n))

    push, face_push = {}, {}
    for key, items in groups.items():
        if len(items) < 2:
            continue
        cn = Vector(key)
        if cn.length < 1e-6:
            continue
        cn = cn.normalized()
        up = Vector((0.0, 0.0, 1.0)) if abs(cn.z) < 0.9 else Vector((1.0, 0.0, 0.0))
        ax = cn.cross(up)
        if ax.length < 1e-6:
            continue
        ax = ax.normalized()
        ay = cn.cross(ax)
        info = []
        for cd, p, own in items:
            us = [(me.vertices[vi].co.dot(ax), me.vertices[vi].co.dot(ay))
                  for vi in p.vertices]
            u0 = min(u for u, _ in us); u1 = max(u for u, _ in us)
            v0 = min(v for _, v in us); v1 = max(v for _, v in us)
            # A NORMAL VAI JA NORMALIZADA. Normalizar dentro do laco de pares
            # custava duas raizes quadradas por candidato, e sao milhoes de
            # candidatos: e sozinho a diferenca entre um build de tres minutos e
            # um de vinte.
            info.append((cd, (u0, v0, u1, v1), max(1e-9, (u1 - u0) * (v1 - v0)),
                         shell[p.vertices[0]], own.normalized(), p,
                         set(p.vertices)))
        # ORDENADO PELA PROFUNDIDADE NO PLANO: com isso o laco interno pode
        # parar assim que a diferenca passa de `tol`, o que transforma um teste
        # quadratico sobre a parede inteira num teste local.
        info.sort(key=lambda t: t[0])
        for i in range(len(info)):
            di, bi, ai, si, ni, pi_, vi_ = info[i]
            for j in range(i + 1, len(info)):
                dj, bj, aj, sj, nj, pj_, vj_ = info[j]
                if dj - di > tol:
                    break
                # MESMA CASCA NAO E MAIS MOTIVO PARA IGNORAR, e essa era a
                # porta que sobrava. O criterio "cascas distintas" descreve a
                # porta MODELADA POR CIMA da parede — mas parte destes ripes tem
                # a porta SOLDADA nela, compartilhando o contorno. Ali as duas
                # ficam na mesma casca e o par nunca era examinado, por mais que
                # disputassem a mesma profundidade.
                #
                # O que separa defeito de geometria sa nao e a casca, e o
                # COMPARTILHAMENTO DE VERTICE: dois triangulos do mesmo
                # quadrilatero, ou de quads vizinhos de uma parede triangulada,
                # sempre compartilham vertice. Um painel aplicado nunca
                # compartilha com a face que ele cobre — se compartilhasse,
                # seria a mesma superficie e nao haveria duas.
                #
                if vi_ & vj_:
                    continue
                ou = min(bi[2], bj[2]) - max(bi[0], bj[0])
                ov = min(bi[3], bj[3]) - max(bi[1], bj[1])
                if ou <= 0.0 or ov <= 0.0:
                    continue
                if ou * ov < 0.30 * min(ai, aj):
                    continue
                if si == sj:
                    # mesma casca: mover a casca levaria a parede junto, entao
                    # move-se a FACE menor. Uma fresta de 1 cm no contorno de uma
                    # porta e invisivel a 30 m; o cintilar nao e.
                    small_p, nd = (pi_, ni) if ai <= aj else (pj_, nj)
                    nd = _outward(nd, small_p.center, ctr)
                    face_push.setdefault(small_p.index, []).append(nd)
                    continue
                if area_of.get(si, 0.0) <= area_of.get(sj, 0.0):
                    small, nd, ref = si, ni, pi_.center
                else:
                    small, nd, ref = sj, nj, pj_.center
                nd = _outward(nd, ref, ctr)
                push.setdefault(small, {})[
                    (round(nd.x, 2), round(nd.y, 2), round(nd.z, 2))] = nd

    moved = 0
    for fi, dirs in face_push.items():
        off = Vector((0.0, 0.0, 0.0))
        for v in dirs:
            off += v
        if off.length < 1e-9:
            continue
        off = off.normalized() * step
        for vi in me.polygons[fi].vertices:
            me.vertices[vi].co += off
        moved += 1
    for s, dirs in push.items():
        off = Vector((0.0, 0.0, 0.0))
        for v in dirs.values():
            off += v
        if off.length < 1e-9:
            continue
        off = off.normalized() * step
        for vi in verts_of.get(s, ()):
            me.vertices[vi].co += off
        moved += 1
    if moved:
        me.update()
    return moved


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


def _split_buildings(ob, log, gap=2.5, absorb_below=9.0, absorb_within=26.0):
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

    # ---- ABSORB THE FRAGMENTS --------------------------------------------
    # THIS IS THE BUG THAT PUT PIECES OF BUILDINGS IN THE AIR. Clustering at
    # 2.5 m keeps the display grid's units apart correctly, but a building here
    # is not one solid lump: it has a canopy, a pipe run, a railing, a window
    # band standing a few metres off the wall. Those land in their OWN cluster,
    # get treated as a separate "building", and are then placed somewhere else
    # entirely — so the walls go to one coordinate and the window band and the
    # yellow pipe bridge stay hanging over open concrete.
    #
    # Widening the gap is not the fix: at 11 m the whole 99 x 93 m sheet
    # collapsed into ONE building (measured). So cluster tight, then give every
    # cluster too small to be a building to the nearest real one.
    def span_of(g):
        b = [1e18, 1e18, -1e18, -1e18]
        for k in groups[g]:
            c = comp[k]
            b[0] = min(b[0], c[0]); b[1] = min(b[1], c[1])
            b[2] = max(b[2], c[2]); b[3] = max(b[3], c[3])
        return b

    boxes = {g: span_of(g) for g in groups}
    big = [g for g in groups if max(boxes[g][2] - boxes[g][0],
                                    boxes[g][3] - boxes[g][1]) >= absorb_below]
    small = [g for g in groups if g not in big]
    moved = 0
    for g in small:
        bg = boxes[g]
        cx, cy = (bg[0] + bg[2]) / 2.0, (bg[1] + bg[3]) / 2.0
        best, who = 1e18, None
        for h in big:
            bh = boxes[h]
            dx = max(bh[0] - cx, cx - bh[2], 0.0)
            dy = max(bh[1] - cy, cy - bh[3], 0.0)
            d = math.hypot(dx, dy)
            if d < best:
                best, who = d, h
        if who is not None and best <= absorb_within:
            groups[who].extend(groups.pop(g))
            moved += 1
    log("    midcentury: %d shells -> %d buildings (%d fragmentos absorvidos)"
        % (len(keys), len(groups), moved))
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
                separate_coplanar(p, log)
                lo, hi = _bounds(p)
                p.name = "MC_%02d" % i
                if p.name in DECAL_FIX:
                    lift_welded_decals(p, log)
                protos["mc_%02d" % i] = (p, (hi.x - lo.x, hi.y - lo.y, hi.z - lo.z))
            log("  midcentury -> %d placeable buildings" % len(parts))
            done.add(key)
            continue

        _recentre(ob)
        separate_coplanar(ob, log)
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
