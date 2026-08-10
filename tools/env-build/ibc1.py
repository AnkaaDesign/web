# "Industrial Buildings Collection Vol.1" — the OBJ package, not the ripped glTF.
#
# WHY THIS AND NOT THE .gltf NEXT DOOR. Both are the same collection, but the
# 3D-Ripper glTF carries 98 k triangles against this package's 293 k: the rip
# decimated it and collapsed almost every material onto one atlas. This is the
# store package, so it is what the buildings are actually supposed to look like.
#
# THE ONE THING IT DOES NOT SHIP is any material binding — no .mtl, not a single
# `usemtl` line, while five PBR atlases sit beside the meshes. So the pairing had
# to be established by test render (atlas_test.py), and it came out clean:
#
#   model_0..model_11   detailed process gear  -> Container
#                       Rivets, flange bolts and rust runs land on the geometry.
#                       Every other atlas smears across it.
#   model_12..model_15  low-poly building shells -> Walls / ConcreteLeaks
#                       These are UV'd for TILING (u runs -4.4..5.1 on model_13),
#                       i.e. cladding, and Walls is the only atlas with the
#                       horizontal plinth band prefab halls are textured with.
#                       ConcreteLeaks is the second skin so the halls are not
#                       all one building repeated.
#   model_16            a flat plane at y=2.7 with NO uv layer at all -> dropped.
#
# MetalTrim/MetalTrim2 are hazard-stripe trims (yellow/blue bands). They are
# correct as accents on railings inside the atlas, and obviously wrong stretched
# over a whole hall, which is exactly how the test render read them.
import bpy
import os
import glob

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_src_ibc1")

# model index -> atlas.
#
# HOW THIS WAS DETERMINED, because getting it wrong is what made the first two
# builds "tudo de metal oxidado".
#
# Neither file on disk knows. The OBJ package has no .mtl and not one `usemtl`
# line; the ripped glTF next door DOES carry bindings but they are collapsed —
# 99.8 % of its triangles are on `Container` alone (measured, not assumed).
# `Container` is the RUST atlas, so trusting either source paints the whole
# district in oxidised steel, which is exactly what happened.
#
# The authority is therefore the publisher's own render of the pack. Every model
# was rendered against all five atlases and matched to it, and the collection
# turns out to be mostly clean industrial finishes:
#
#   Walls          light grey corrugated cladding with a dark plinth band
#                  -> the long halls, and unmistakable: it is the only atlas
#                     with the plinth, and the halls in the reference have one
#   MetalTrim      white/pale plant finish with YELLOW safety paint that lands
#                  exactly on railings, ladders, walkways and pipe bands
#                  -> the tanks, vessels, walkways and process units
#   ConcreteLeaks  weathered grey-brown steel, no paint
#                  -> pipe-rack trusses, chimney stacks, small skids
#   Container      heavy rust. Correct for ONE thing in the pack — the shipping
#                  container — and wrong for everything else.
#   MetalTrim2     a second yellow-trim skin, close to MetalTrim but redder.
#                  Unused: giving ring clones their own skin means an
#                  OBJECT-linked material, which defeats glTF mesh instancing
#                  and costs more than the variation is worth. Variety here
#                  comes from four atlases across sixteen models instead.
ATLAS_OF = {
    0:  "Container",        # 20 ft shipping container — the one true rust
    1:  "ConcreteLeaks",    # pipe rack truss
    2:  "ConcreteLeaks",    # pipe rack truss
    3:  "MetalTrim",        # elevated walkway / pipe bridge, yellow rails
    4:  "MetalTrim",        # process unit, yellow pipe bands
    # MetalTrim2, NAO MetalTrim, e foi MEDIDO renderizando os cinco atlas.
    #
    # Com MetalTrim o corpo do vaso cai numa faixa VERDE-ESCURA do atlas e no
    # cenario, com a exposicao do app, le como PRETO — foi o relato "precisa
    # corrigir a textura desse item". O acabamento amarelo caia certo nos
    # guarda-corpos, o que mascarava o erro: parecia atlas certo com uma peca
    # escura de proposito.
    #
    # Com MetalTrim2 o costado vira aco galvanizado claro e intemperizado, o
    # amarelo continua caindo exatamente nos guarda-corpos, nas bandas de tubo e
    # na escada, e a coluna passa a ler como coluna de processo.
    #
    # A nota abaixo descartava MetalTrim2 inteiro dizendo que era "close to
    # MetalTrim but redder" e que dar pele propria a clones custaria material por
    # objeto. Isso e uma razao de INSTANCIACAO, nao de aparencia, e nunca foi um
    # argumento para nao testar atlas por modelo — que e o metodo que este mesmo
    # arquivo documenta. model_10 foi verificado no mesmo teste e continua certo
    # em MetalTrim (casco branco), entao a troca e so aqui.
    5:  "MetalTrim2",       # column + vessel
    6:  "ConcreteLeaks",    # process block
    7:  "ConcreteLeaks",    # basin
    # model_8 NAO E UM PREDIO, e chamar de "plant complex" custou uma rodada de
    # depuracao no lugar errado. Renderizado sozinho, inteiro e sem decimacao,
    # ele e SO O APARATO: tubulacao amarela, corrimaos, escadas, passarelas e
    # aros de tanque, com nenhum volume solido embaixo. Sao 10 278 faces em
    # 2 181 cascas soltas — proporcao de kit de vestimenta, nao de edificacao.
    #
    # Solto no patio ele le exatamente como o relato: "tubulacoes espalhadas que
    # se perderam de uma construcao". Nada se perdeu; a construcao nunca veio no
    # arquivo. Ele so funciona SOBREPOSTO a um galpao solido (ibc12, hall_big),
    # que e onde a tubulacao de uma planta de verdade fica.
    8:  "MetalTrim",        # aparato de planta: tubos, guarda-corpos, escadas
    9:  "ConcreteLeaks",    # vent pole
    10: "MetalTrim",        # storage tank — white shell in the reference
    11: "ConcreteLeaks",    # chimney stacks
    12: "Walls",            # long hall
    13: "Walls",            # block cluster
    14: "Walls",            # barrel warehouse
    15: "Walls",            # long shed
}

DROP = {16}                     # flat plane, no UVs, no purpose

# PECAS QUE SAO UMA CONSTRUCAO SO, PARTIDA EM DOIS ARQUIVOS.
#
# MEDIDO NAS COORDENADAS BRUTAS DO .obj, antes de qualquer recentragem:
#
#   model_8    x 0.6..31.0   z -28.5..39.9   y 0..24.4
#   model_11   x 0.8..31.0   z -28.6..40.0   y -0.6..24.1
#
# Sao o MESMO objeto, coincidindo a 20 cm nos tres eixos. model_11 e o volume
# solido; model_8 e o aparato dele — tubulacao, guarda-corpos, escadas,
# passarelas, aros de tanque — que sozinho nao tem edificacao nenhuma embaixo.
#
# POR QUE ISSO QUEBRAVA. import_prototypes recentra CADA modelo na propria
# pegada. Isso e correto para pecas independentes e destrutivo para duas metades
# da mesma peca: cada uma vai para o proprio centro e a relacao entre elas
# morre. Posicionadas depois em coordenadas diferentes, a tubulacao aparece
# boiando no patio a dezenas de metros do predio a que pertence — que e
# exatamente o relato "movendo um fez o resto se perder no ar".
#
# O pacote inteiro foi autorado numa cena unica, entao quase todos os modelos se
# sobrepoem em XZ. Isso NAO os torna pares: e so a planta original. O criterio
# aqui e caixa praticamente IDENTICA, que so este par satisfaz.
#
# Mesmo erro ja corrigido no pacote ibp (hall_big + hall_det, ver dl_packs.PAIRS)
# e nunca aplicado aqui.
PAIRS = {11: 8}                 # principal -> metade que entra junto
_PAIRED = set(PAIRS.values())

# Rough identification from the survey render, kept here because the layout
# table reads by index and an index alone says nothing:
#   0  20 ft container 6.1x2.3x2.6      1  pipe rack 29.8x10.0x5.0
#   2  pipe rack 50.3x16.9x5.9          3  column pair + rack 60.6x64.7x37.6
#   4  process unit 42.4x57.7x23.4      5  tall column 21.8x10.6x29.1
#   6  process block 12.1x8.8x11.2      7  basin 6.1x6.1x3.1
#   8  APARATO, NAO PREDIO 30.4x68.5    9  vent pole 1.6x1.6x6.0
#  10  storage tank 11.5x10.1x5.7      11  chimney stacks 30.2x68.6x24.6
#  12  long hall 29.4x64.4x5.4         13  block cluster 37.5x29.6x11.1
#  14  barrel warehouse 22.1x33.9x8.2  15  long shed 16.7x49.7x5.8


def _find(pat):
    hits = glob.glob(os.path.join(SRC, pat))
    return hits[0] if hits else None


def _hook(nt, bsdf, path, socket, non_color, normal=False):
    if not path or not os.path.exists(path):
        return False
    img = bpy.data.images.load(path, check_existing=True)
    if non_color:
        img.colorspace_settings.name = "Non-Color"
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    if normal:
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(nm.inputs["Color"], tex.outputs["Color"])
        nt.links.new(bsdf.inputs["Normal"], nm.outputs["Normal"])
    else:
        nt.links.new(bsdf.inputs[socket], tex.outputs["Color"])
    return True


def build_atlas(name):
    """One PBR material from the pack's loose atlas PNGs.

    The roughness/metallic maps are CHANNEL-PACKED and say so in the filename
    (`Container_Metallic-Container_Roughness@channels=G.png`). glTF packs
    roughness in G and metallic in B, and the suffix is authoritative — binding
    by the name alone swaps the two, which is a plastic-looking plant.
    """
    m = bpy.data.materials.get("IBC_" + name)
    if m:
        return m
    m = bpy.data.materials.new("IBC_" + name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    _hook(nt, b, _find(name + "_BaseColor.png"), "Base Color", False)
    _hook(nt, b, _find(name + "*Roughness@channels=G.png"), "Roughness", True)
    _hook(nt, b, _find(name + "*Metallic*@channels=B.png"), "Metallic", True)
    _hook(nt, b, _find(name + "_Normal.png"), None, True, normal=True)
    return m


_DL_MOD = None


def _load_dl():
    """dl_packs por caminho, nao por `import` — o build carrega estes modulos
    com importlib a partir do diretorio do ficheiro, e um `import dl_packs`
    normal so funciona por acaso de sys.path."""
    global _DL_MOD
    if _DL_MOD is None:
        import importlib.util
        p = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                         "dl_packs.py")
        if not os.path.exists(p):
            return None
        spec = importlib.util.spec_from_file_location("dl_packs_for_ibc", p)
        _DL_MOD = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(_DL_MOD)
    return _DL_MOD


def import_prototypes(log):
    """Import every model once, welded, recentred on its own footprint with the
    floor on z=0.

    Recentring here is what lets the layout table stay honest: `place()` becomes
    a location assignment, and a rotation about the object origin keeps the
    building on its mark instead of swinging it off (the old build had to
    re-measure the AABB after every rotation to undo exactly that).
    """
    from mathutils import Vector, Matrix
    protos = {}
    for p in sorted(glob.glob(os.path.join(SRC, "model_*.obj")),
                    key=lambda s: int(os.path.basename(s).split("_")[1].split(".")[0])):
        idx = int(os.path.basename(p).split("_")[1].split(".")[0])
        if idx in DROP or idx in _PAIRED:
            continue
        before = set(bpy.data.objects)
        # OBJ is Y-up; Blender is Z-up. The importer converts, so everything
        # downstream is authored in Blender space: X right, Y forward, Z up.
        bpy.ops.wm.obj_import(filepath=p, forward_axis="NEGATIVE_Z", up_axis="Y")
        # A METADE QUE VEM JUNTO ENTRA AQUI, no MESMO lote e ANTES do join, para
        # que as duas partam das coordenadas originais compartilhadas e sejam
        # recentradas UMA VEZ SO, juntas. Recentrar cada uma e o que separava.
        mate = PAIRS.get(idx)
        if mate is not None:
            mp = os.path.join(SRC, "model_%d.obj" % mate)
            if os.path.exists(mp):
                bpy.ops.wm.obj_import(filepath=mp, forward_axis="NEGATIVE_Z", up_axis="Y")
                log("  model_%d + model_%d importados juntos (mesma construcao)"
                    % (idx, mate))
        fresh = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
        if not fresh:
            log("  model_%d imported nothing" % idx)
            continue
        for o in bpy.data.objects:
            o.select_set(o in fresh)
        bpy.context.view_layer.objects.active = fresh[0]
        if len(fresh) > 1:
            bpy.ops.object.join()
        ob = bpy.context.view_layer.objects.active
        ob.name = "IBC_%02d" % idx

        # BAKE THE AXIS CONVERSION INTO THE MESH, rotation included.
        #
        # The importer does not rewrite vertices to turn Y-up into Z-up: it
        # leaves the data alone and puts a 90 deg X rotation on the OBJECT. That
        # is invisible until something assigns to `rotation_euler` to place the
        # building — which overwrites the conversion and lays the whole plant on
        # its side. (It reads as a merely wrong number in the log: model_4 is
        # 23.4 m tall and measured 57.7, its own depth.)
        #
        # Applying rotation here leaves every prototype with an identity
        # transform, so the layout owns rotation_euler outright and cannot
        # collide with the importer again.
        for o in bpy.data.objects:
            o.select_set(o is ob)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

        pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
        lo = Vector((min(q.x for q in pts), min(q.y for q in pts), min(q.z for q in pts)))
        hi = Vector((max(q.x for q in pts), max(q.y for q in pts), max(q.z for q in pts)))
        # CENTRE IN XY ONLY. Z IS THE AUTHOR'S, AND MUST STAY THAT WAY.
        #
        # This used to drop each model so its bounding-box minimum landed on
        # z=0. That is wrong for anything whose lowest geometry is not its
        # floor — and half this pack qualifies. The storage tank has feed pipes
        # running down past its base, so forcing bbox-min to zero rested the
        # tank on the pipe TIPS and left the vessel hanging in the air with
        # daylight under it ("ferragens flutuando no meio do nada").
        #
        # The pack does not need the help: measured straight out of the OBJ,
        # every model already sits on y=0 (min y of 0.0, -0.0, -0.4, -0.6).
        # They were authored on the ground. Keeping the author's height is both
        # simpler and the only version that is correct for pieces that are
        # supposed to be partly below grade.
        off = Vector(((lo.x + hi.x) / 2.0, (lo.y + hi.y) / 2.0, 0.0))
        ob.data.transform(Matrix.Translation(-off))
        ob.data.update()

        ob.data.materials.clear()
        ob.data.materials.append(build_atlas(ATLAS_OF.get(idx, "Container")))

        # ESTE PACK TAMBEM DISPUTA PROFUNDIDADE, e ninguem estava a olhar.
        #
        # `separate_coplanar` nasceu no dl_packs e ficou la — so os pacotes DL
        # passavam por ele. Medido no set.glb exportado, as UNICAS faces do
        # cenario inteiro em disputa exata (folga 0,00 mm, pegada identica) eram
        # 44,8 m2 em IBC_15 e outro tanto na duplicata dele: um pack que nunca
        # tinha sido tratado, a mostrar exatamente o defeito que a funcao existe
        # para matar. Os DL, que passavam, apareciam todos a 10 mm — separados,
        # como era suposto.
        #
        # E O PROTOTIPO E O SITIO CERTO: as duplicatas do layout partilham a
        # malha, entao tratar aqui trata todas as copias de uma vez.
        try:
            dl = _load_dl()
            if dl is not None:
                dl.separate_coplanar(ob, log)
        except Exception as e:                # nunca vale perder o predio
            log("  separate_coplanar falhou em %s: %s" % (ob.name, e))

        protos[idx] = (ob, (hi.x - lo.x, hi.y - lo.y, hi.z - lo.z))
    log("  prototypes: %d models (%d tris)"
        % (len(protos), sum(len(o.data.polygons) for o, _ in protos.values())))
    return protos
