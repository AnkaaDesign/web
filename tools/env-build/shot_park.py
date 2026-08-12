# Preview the district the way the APP will show it.
#
#   blender -b -P shot_park.py
#
# THE POINT IS THE GROUND MATERIALS. set.glb ships them as bare named slots and
# the engine binds /textures/* to them at load (set.ts bindMaterials) from the
# environments.json `materials` block. Rendering the .blend as built would show
# the yard as flat grey — which is exactly the state in which four earlier
# layouts were signed off "by looking at a render", and it is why the ground
# read as padronizado in the app and fine in the preview.
#
# So this binds the same maps with the same repeat and tint the manifest
# declares, lights with the same HDRI at the same envRotation, and
# frames with view.ts's own VIEW_DIR. What comes out is close to the app.
#
# AXES. The app is Y-up and this file is Z-up: app (x, y, z) is Blender
# (x, -z, y). view.ts VIEW_DIR (2.20, 0.575, 1.17) is therefore Blender
# (2.20, -1.17, 0.575) — camera to the east and south, looking back over the
# truck at the median, the second carriageway and the process side. That is why
# road B is west: it is what the default shot looks AT.
import bpy
import math
import os
import sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.abspath(os.path.join(HERE, "..", ".."))
TEX = os.path.join(WEB, "public", "textures")
OUT = os.path.join(HERE, "_shots_park")
MANIFEST = os.path.join(WEB, "public", "environments", "environments.json")
ENV_ID = "distrito-industrial"

# ---------------------------------------------------------------------------
# A CONFIGURACAO E LIDA DO MANIFESTO, e nao mais copiada dele.
#
# Este arquivo existe para que "o preview nao possa discordar do app", e no
# entanto trazia uma segunda copia, a mao, de tudo o que o app le do
# environments.json: caminho do HDRI, repeat, tint, roughness, macro e
# envIntensity de cada material. Uma copia a mao de dados que mudam SEMPRE
# diverge, e esta ja tinha divergido em tres pontos ao mesmo tempo:
#
#   * `HDR` apontava para environments/rodovia/sky.hdr, que deixou de ser o
#     HDRI do cenario;
#   * `CONCRETE_APRON` estava com repeat 2.0 contra 1.0 no manifesto (o aproNote
#     documenta a mudanca de 2 para 1 — o preview ficou na versao velha);
#   * `TREE_BARK`/`TREE_LEAF` continuavam declarados depois de os materiais
#     terem passado a chamar-se PLANT_*, ou seja o preview pintava dois slots
#     que nao existem e nenhum dos dois que existem.
#
# Um preview que mente sobre a escala do ladrilho e sobre qual e o ceu e pior do
# que nenhum, porque e com ele que se assina "esta corrigido".
# ---------------------------------------------------------------------------
def _manifest():
    import json
    with open(MANIFEST, "r", encoding="utf-8") as f:
        doc = json.load(f)
    for e in doc.get("environments", []):
        if e.get("id") == ENV_ID:
            return e
    raise SystemExit("cenario %r nao esta no manifesto" % ENV_ID)


ENV = _manifest()
_SET = ENV.get("set") or {}
_MATS = {k: v for k, v in (_SET.get("materials") or {}).items()
         if isinstance(v, dict)}

HDR = os.path.join(WEB, "public", *ENV["hdri"].split("/"))
ENV_ROTATION = float(ENV.get("envRotation") or 0.0)
EXPOSURE = float(ENV.get("exposure") or 1.0)

# O `stem` sai do nome do arquivo de difuso declarado: "textures/grass_diff.webp"
# -> "grass". E o mesmo par que load_tex() remonta para achar rough/nor/ao.
def _stem(d):
    p = d.get("diffuse")
    if not p:
        return None
    base = os.path.basename(p)
    return base.split("_diff")[0] if "_diff" in base else base.split(".")[0]


# name -> (texture stem or None, repeat, tint, roughness)
BIND = {
    name: (_stem(d), float(d.get("repeat", 1.0)),
           tuple(d.get("tintRgb") or (1.0, 1.0, 1.0)),
           float(d.get("roughness", 0.9)))
    for name, d in _MATS.items()
}

SHOTS = [
    # (name, target, distance, direction, fov, lens note)
    ("a_hero", (0.0, 8.0, 1.4), 42.0, (2.20, -1.17, 0.575), 30.0),
    ("b_wide", (-14.0, 20.0, 2.0), 96.0, (2.20, -1.10, 0.86), 34.0),
    ("c_kerb", (2.0, -4.0, 0.5), 9.0, (1.30, -1.00, 0.20), 38.0),
    ("d_median", (-12.0, 62.0, 2.0), 34.0, (1.60, -1.30, 0.42), 36.0),
    ("e_park", (-52.0, 55.0, 1.5), 62.0, (1.90, -1.05, 0.62), 34.0),
    ("f_gate", (0.0, 232.0, 3.0), 62.0, (1.60, -1.40, 0.55), 34.0),
    ("g_top", (0.0, 10.0, 0.0), 470.0, (0.30, -0.30, 1.0), 40.0),
    # ---- as duas pontas novas da via interna --------------------------------
    # O BALAO, de cima e de perto. Tem de mostrar as tres coisas ao mesmo tempo:
    # o leque de aproximacao a abrir, a guia da ilha, e que nao ha fresta entre o
    # disco e o patio a volta.
    # O ENQUADRAMENTO DO KENNEDY, e ele existe porque `t_balao` (de cima) deixou
    # passar tres defeitos que so aparecem daqui: a folha do portao atravessada
    # na rua, o meio-fio do canteiro interrompido e a marcacao a ler como um anel
    # solto. Um render de cima mostra a PLANTA e esconde a leitura; a camera do
    # app esta atras do caminhao, quase ao nivel do olho, e e essa que decide.
    ("t0_balao_app", (-9.0, -55.0, 1.0), 78.0, (0.10, 1.0, 0.42), 34.0),
    ("t_balao", (-9.1, -116.0, 0.0), 92.0, (0.30, -0.45, 1.0), 38.0),
    # e do chao, que e como o app o mostra ao girar para sul
    ("u_balao_low", (-9.1, -104.0, 1.6), 46.0, (0.55, -1.0, 0.22), 36.0),
    # A RODOVIA E O ENTRONCAMENTO, de cima: nariz do canteiro, garganta, barras
    # de pare e o acostamento a taludar para a lavoura.
    ("v_rodovia", (-4.0, 228.0, 0.0), 108.0, (0.25, -0.55, 1.0), 38.0),
    # A PORTARIA no portao, da rua.
    ("w_portaria", (14.0, 140.0, 2.0), 34.0, (1.0, 0.85, 0.30), 36.0),
    # A LAVOURA CONTRA O HORIZONTE, que e a pergunta "o blur comeca cedo?".
    # Rasante de dentro do sitio para fora, sobre a cerca.
    ("x_horizonte", (0.0, 60.0, 3.2), 26.0, (0.15, 1.0, 0.045), 34.0),
    # The perimeter: turf band, tree belt, plinth, wire, barbed arms. This is
    # the shot that has to prove the fence is taller AND further, and that the
    # grass in front of it is a band rather than a rectangle.
    # Mira derivada da cerca ATUAL. Estava fixa em y=218 de quando a propriedade
    # ia a 250 m; com a cerca em 150 a camera apontava para campo vazio.
    ("h_fence", (45.0, 118.0, 3.0), 72.0, (-0.5, -1.0, 0.30), 34.0),
    # A boca da transversal na rua A, de cima e de perto. E o unico
    # enquadramento que mostra meio-fio, sarjeta, concordancia e o corte do
    # canteiro ao mesmo tempo — que e onde o defeito vive.
    ("i_junc", (10.0, -40.0, 0.0), 44.0, (0.25, -0.35, 1.0), 38.0),
    ("j_junc_low", (13.0, -40.0, 1.2), 26.0, (1.0, -0.75, 0.24), 36.0),
    # A abertura do canteiro vista de dentro da pista — o "buraco na
    # interseccao". E o unico enquadramento que mostra ao mesmo tempo o nariz do
    # canteiro, a sarjeta da travessia e o asfalto da ligacao.
    ("k_median_gap", (-9.0, -40.0, 1.2), 20.0, (1.2, 0.9, 0.30), 36.0),
    # As arvores de perto, na altura de quem olha do chao: e assim que o app as
    # mostra, e nao de cima.
    ("l_trees", (-9.0, 95.0, 2.0), 34.0, (1.3, -0.9, 0.16), 38.0),
    # O PATIO EM CHEIO, que e o enquadramento em que a queixa "parece varios
    # quadrados seguidos" aparece. Nenhum dos outros mostra area grande de laje e
    # de asfalto ao mesmo tempo e a distancia media, que e onde o campo de
    # variacao do chao se le como campo em vez de como textura.
    ("m_yard", (26.0, -26.0, 1.5), 58.0, (1.0, -1.0, 0.42), 34.0),
    # MC_00 DE FRENTE. E o predio onde `separate_coplanar` mais mexe (centenas
    # de pecas) e o que tem a fachada mais detalhada — janelas de montante fino,
    # portas, quadros. Se a funcao rasgar alguma coisa, rasga aqui, e sem este
    # enquadramento o estrago so aparece no app.
    ("n_mc00", (-52.8, 5.5, 3.5), 46.0, (0.55, -1.0, 0.30), 34.0),
    # O MESMO ENQUADRAMENTO DO APP: o veiculo esta na origem e a construcao fica
    # atras dele, vista de +X e quase ao nivel do olho. E assim que o defeito foi
    # relatado, e um render de outro angulo nao serve para dizer se ele saiu.
    ("o_mc_front", (-26.0, 5.0, 2.2), 58.0, (1.0, -0.10, 0.26), 34.0),
    # As outras duas candidatas do mesmo lado do sitio.
    ("p_mc02", (-47.2, -25.5, 3.0), 44.0, (1.0, -0.35, 0.28), 34.0),
    # A FAIXA SUL VISTA DE +Y, que e o que a camera do print mostra: com o
    # veiculo de lado e a cabine a esquerda, o eixo de vista e -Y e o ecra tem
    # +X a esquerda. Cobre MC_02, MC_03 e MC_12 de uma vez, para identificar a
    # construcao pela silhueta em vez de a adivinhar.
    ("q_south", (6.0, -24.0, 4.0), 112.0, (0.05, 1.0, 0.135), 34.0),
    # MC_03 de perto, do lado que a camera do app ve (+Y). E a peca do adesivo.
    ("s_mc03", (39.8, -19.5, 3.0), 34.0, (0.25, 1.0, 0.30), 34.0),
    # A CAMERA DO APP, reproduzida a partir da unica referencia que ela tem: o
    # veiculo esta preso na ORIGEM. No print ele aparece de lado, com a cabine a
    # esquerda, e a construcao fica atras dele — logo a camera olha ao longo de
    # -X, quase ao nivel do olho. Este enquadramento e o unico que permite dizer
    # QUAL construcao e, em vez de adivinhar pelo aspecto.
    ("r_from_truck", (-62.0, 10.0, 4.0), 104.0, (1.0, -0.10, 0.115), 32.0),
    # ---- OS DOIS AZIMUTES DO PRINT, e existem porque o azimute ja foi deduzido
    # errado duas vezes a partir da pose do veiculo.
    #
    # A regra que os fixa: a CABINE fica na ponta +Y do conjunto. Logo, num print
    # em que a cabine aparece a ESQUERDA, +Y aponta para a esquerda do ecra, o
    # eixo de vista e +X, e o que esta atras do veiculo e o bloco LESTE (MC_03,
    # MC_12, IBC_12). Com a cabine a DIREITA e o inverso: vista para -X e o que
    # se ve e o bloco OESTE (MC_02, MC_00, os tanques).
    ("y_leste_app", (8.0, 0.0, 2.0), 42.0, (-1.0, 0.30, 0.26), 34.0),
    ("z_oeste_app", (-14.0, -8.0, 2.0), 46.0, (1.0, 0.30, 0.26), 34.0),
    # O MESMO MC_02, mas de NORDESTE: e o angulo do print em que ele continuava
    # a cintilar depois de o MC_03 ja estar limpo, e nenhum dos outros o cobre.
    ("z2_mc02_ne", (-47.2, -25.5, 4.0), 44.0, (1.0, 0.55, 0.34), 34.0),
    # AS DUAS GUARITAS E AS DUAS CANCELAS, de cima. O enquadramento rasante
    # (w_portaria) mostra uma de cada vez e foi por isso que a cancela curta
    # passou: de cima ve-se se ela ALCANCA a pista, que e a unica pergunta.
    ("w2_praca", (-9.1, 126.0, 0.0), 54.0, (0.55, -0.70, 1.0), 38.0),
]


def log(m):
    print("[shot] " + m, flush=True)


def load_tex(nt, stem, kind, non_color):
    for ext in (".webp", ".jpg", ".png"):
        p = os.path.join(TEX, "%s_%s%s" % (stem, kind, ext))
        if os.path.exists(p):
            img = bpy.data.images.load(p, check_existing=True)
            if non_color:
                img.colorspace_settings.name = "Non-Color"
            t = nt.nodes.new("ShaderNodeTexImage")
            t.image = img
            return t
    return None


# Variacao macro por FRAGMENTO — o equivalente do MACRO_GLSL de set.ts.
#
# ESTE PREVIEW MENTIA POR OMISSAO, e era a omissao que mais importava. O macro e
# a unica fonte de variacao do chao que nao passa pela malha, e desde que o
# COLOR_0 foi limitado a cinco amostras por periodo ele passou a carregar TODA a
# banda media e fina. Um render sem ele mostra um chao muito mais chapado que o
# que o app desenha — e ajustar o build contra esse render seria ajustar contra
# uma cena que nao existe.
#
# Nao e o mesmo ruido (o motor amostra um canvas 256²; aqui e o Noise do Blender)
# e nao precisa de ser: o que tem de bater sao os PERIODOS e a amplitude, porque
# e disso que depende a leitura de "organico" contra "quadriculado". Os tres
# periodos sao em METROS DE MUNDO, iguais em todos os materiais — sujidade e
# propriedade do lugar, nao do ladrilho, e assim a mancha atravessa a fronteira
# entre asfalto e laje em vez de parar nela.
MACRO_P = ((70.0, 0.40), (16.3, 0.34), (4.5, 0.26))


def macro_node(nt, amount):
    """Devolve um socket de cor que vale ~1.0 em media, para multiplicar."""
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    acc = None
    hue_fac = None
    for i, (period, w) in enumerate(MACRO_P):
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (1.0 / period, 1.0 / period, 1.0 / period)
        # cada oitava com o seu eixo, como no shader
        mp.inputs["Rotation"].default_value = (0.0, 0.0, 0.57 * (i + 1))
        nt.links.new(mp.inputs["Vector"], geo.outputs["Position"])
        nz = nt.nodes.new("ShaderNodeTexNoise")
        nz.inputs["Detail"].default_value = 3.0
        nz.inputs["Roughness"].default_value = 0.5
        nz.inputs["Scale"].default_value = 1.0
        nt.links.new(nz.inputs["Vector"], mp.outputs["Vector"])
        sc = nt.nodes.new("ShaderNodeMath")
        sc.operation = "MULTIPLY"
        sc.inputs[1].default_value = w
        nt.links.new(sc.inputs[0], nz.outputs["Fac"])
        if i == 1:
            hue_fac = nz.outputs["Fac"]      # a oitava media conduz o matiz
        if acc is None:
            acc = sc.outputs["Value"]
        else:
            ad = nt.nodes.new("ShaderNodeMath")
            ad.operation = "ADD"
            nt.links.new(ad.inputs[0], acc)
            nt.links.new(ad.inputs[1], sc.outputs["Value"])
            acc = ad.outputs["Value"]
    # repor contraste (a media de tres tem 0,59 do desvio de uma) e centrar em 1
    ctr = nt.nodes.new("ShaderNodeMath")
    ctr.operation = "SUBTRACT"
    ctr.inputs[1].default_value = 0.5
    nt.links.new(ctr.inputs[0], acc)
    gain = nt.nodes.new("ShaderNodeMath")
    gain.operation = "MULTIPLY"
    gain.inputs[1].default_value = 1.75 * 2.0 * amount
    nt.links.new(gain.inputs[0], ctr.outputs["Value"])
    one = nt.nodes.new("ShaderNodeMath")
    one.operation = "ADD"
    one.inputs[1].default_value = 1.0
    nt.links.new(one.inputs[0], gain.outputs["Value"])
    cl = nt.nodes.new("ShaderNodeClamp")
    cl.inputs["Min"].default_value = 0.25
    cl.inputs["Max"].default_value = 1.75
    nt.links.new(cl.inputs["Value"], one.outputs["Value"])
    if hue_fac is None:
        return cl.outputs["Result"]
    # E O MATIZ, conduzido por OUTRA oitava. Um chao que varia so em valor le
    # como uma superficie unica mal iluminada; humidade puxa para o frio, po
    # puxa para o quente, e os dois campos sao independentes um do outro.
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "EASE"
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (0.93, 0.98, 1.08, 1.0)
    ramp.color_ramp.elements[1].position = 0.65
    ramp.color_ramp.elements[1].color = (1.07, 1.00, 0.90, 1.0)
    nt.links.new(ramp.inputs["Fac"], hue_fac)
    tint = nt.nodes.new("ShaderNodeMixRGB")
    tint.blend_type = "MULTIPLY"
    tint.inputs["Fac"].default_value = 1.0
    nt.links.new(tint.inputs["Color1"], cl.outputs["Result"])
    nt.links.new(tint.inputs["Color2"], ramp.outputs["Color"])
    return tint.outputs["Color"]


# `amount` por material, espelhando environments.json
MACRO_AMOUNT = {n: float((d.get("macro") or {}).get("amount", 0.0))
                for n, d in _MATS.items()
                if (d.get("macro") or {}).get("amount")}

# `break` por material — a quebra de periodicidade do PROPRIO mapa. Espelha
# environments.json e, como la, e ZERO no asfalto: uma textura sem feicao nao
# repete visivelmente e nao vale a leitura extra.
MACRO_BREAK = {n: float((d.get("macro") or {}).get("break", 0.0))
               for n, d in _MATS.items()
               if (d.get("macro") or {}).get("break")}

# `envIntensity` do manifesto. O Cycles nao tem equivalente por material — o
# HDRI ilumina tudo por igual — entao o preview aproxima-o pelo NIVEL ESPECULAR
# do Principled, que e o que decide quanto do ambiente volta para a camera.
#
# Sem isto o render nao consegue mostrar "o patio reflete muita luz", que e
# precisamente o defeito a julgar: o preview desenharia a laje com o especular
# de fabrica (0,5) enquanto o app a desenha a 0,13.
ENV_INTENSITY = {n: float(d["envIntensity"]) for n, d in _MATS.items()
                 if d.get("envIntensity") is not None}


def set_specular(bsdf, level):
    """Nivel especular, com o nome do socket que esta versao do Blender usa."""
    for nm in ("Specular IOR Level", "Specular"):
        if nm in bsdf.inputs:
            bsdf.inputs[nm].default_value = level
            return True
    return False


def break_tiling(nt, tex_node, repeat, strength):
    """Le o mesmo mapa uma segunda vez, noutra escala e angulo, e escolhe entre
    as duas com ruido de baixa frequencia.

    E o que responde a "a grama e o patio estao muito falsos" enquanto a rua
    passa: o asfalto e quase sem feicao e repetir ruido sem feicao e invisivel,
    mas a grama tem tufos e a laje tem manchas — feicoes que o olho reconhece e
    reencontra a cada 4 e 8 m. Variacao POR CIMA nao apaga isso; o que tem de
    deixar de repetir e a leitura do mapa.
    """
    uvn = nt.nodes.new("ShaderNodeUVMap")
    uvn.uv_map = "UVMap"
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (repeat * 0.618, repeat * 0.618, 1.0)
    mp.inputs["Rotation"].default_value = (0.0, 0.0, 0.6283)
    mp.inputs["Location"].default_value = (17.31, 9.07, 0.0)
    nt.links.new(mp.inputs["Vector"], uvn.outputs["UV"])
    alt = nt.nodes.new("ShaderNodeTexImage")
    alt.image = tex_node.image
    nt.links.new(alt.inputs["Vector"], mp.outputs["Vector"])

    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sel_mp = nt.nodes.new("ShaderNodeMapping")
    sel_mp.inputs["Scale"].default_value = (1.0 / 26.0,) * 3
    nt.links.new(sel_mp.inputs["Vector"], geo.outputs["Position"])
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Detail"].default_value = 2.0
    nz.inputs["Scale"].default_value = 1.0
    nt.links.new(nz.inputs["Vector"], sel_mp.outputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "EASE"
    ramp.color_ramp.elements[0].position = 0.40
    ramp.color_ramp.elements[1].position = 0.60
    nt.links.new(ramp.inputs["Fac"], nz.outputs["Fac"])
    fac = nt.nodes.new("ShaderNodeMath")
    fac.operation = "MULTIPLY"
    fac.inputs[1].default_value = strength
    nt.links.new(fac.inputs[0], ramp.outputs["Color"])

    mix = nt.nodes.new("ShaderNodeMixRGB")
    mix.blend_type = "MIX"
    nt.links.new(mix.inputs["Fac"], fac.outputs["Value"])
    nt.links.new(mix.inputs["Color1"], tex_node.outputs["Color"])
    nt.links.new(mix.inputs["Color2"], alt.outputs["Color"])
    return mix.outputs["Color"]


def bind_ground():
    """What set.ts bindMaterials does, in Blender."""
    n = 0
    for name, (stem, repeat, tint, rough) in BIND.items():
        m = bpy.data.materials.get(name)
        if not m:
            continue
        m.use_nodes = True
        nt = m.node_tree
        b = nt.nodes.get("Principled BSDF")
        b.inputs["Base Color"].default_value = (tint[0], tint[1], tint[2], 1.0)
        b.inputs["Roughness"].default_value = rough
        b.inputs["Metallic"].default_value = 0.0
        if not stem:
            n += 1
            continue
        mapping = nt.nodes.new("ShaderNodeMapping")
        mapping.inputs["Scale"].default_value = (repeat, repeat, 1.0)
        uvn = nt.nodes.new("ShaderNodeUVMap")
        uvn.uv_map = "UVMap"
        nt.links.new(mapping.inputs["Vector"], uvn.outputs["UV"])

        d = load_tex(nt, stem, "diff", False)
        if d:
            nt.links.new(d.inputs["Vector"], mapping.outputs["Vector"])
            # tint MULTIPLIES the map, the way a three.js material colour does
            mix = nt.nodes.new("ShaderNodeMixRGB")
            mix.blend_type = "MULTIPLY"
            mix.inputs["Fac"].default_value = 1.0
            mix.inputs["Color2"].default_value = (tint[0], tint[1], tint[2], 1.0)
            brk = MACRO_BREAK.get(name)
            if brk:
                nt.links.new(mix.inputs["Color1"],
                             break_tiling(nt, d, repeat, brk))
            else:
                nt.links.new(mix.inputs["Color1"], d.outputs["Color"])
            # ...and so does COLOR_0, which is the whole ground-variation system
            ca = nt.nodes.new("ShaderNodeVertexColor")
            ca.layer_name = "Col"
            mix2 = nt.nodes.new("ShaderNodeMixRGB")
            mix2.blend_type = "MULTIPLY"
            mix2.inputs["Fac"].default_value = 1.0
            nt.links.new(mix2.inputs["Color1"], mix.outputs["Color"])
            nt.links.new(mix2.inputs["Color2"], ca.outputs["Color"])
            # ...e o macro por fragmento, que desde a limitacao de banda do
            # COLOR_0 e quem carrega toda a variacao media e fina.
            amt = MACRO_AMOUNT.get(name)
            if amt:
                mix3 = nt.nodes.new("ShaderNodeMixRGB")
                mix3.blend_type = "MULTIPLY"
                mix3.inputs["Fac"].default_value = 1.0
                nt.links.new(mix3.inputs["Color1"], mix2.outputs["Color"])
                nt.links.new(mix3.inputs["Color2"], macro_node(nt, amt))
                nt.links.new(b.inputs["Base Color"], mix3.outputs["Color"])
            else:
                nt.links.new(b.inputs["Base Color"], mix2.outputs["Color"])
        r = load_tex(nt, stem, "rough", True)
        if r:
            nt.links.new(r.inputs["Vector"], mapping.outputs["Vector"])
            nt.links.new(b.inputs["Roughness"], r.outputs["Color"])
        nr = load_tex(nt, stem, "nor", True)
        if nr:
            nt.links.new(nr.inputs["Vector"], mapping.outputs["Vector"])
            nm = nt.nodes.new("ShaderNodeNormalMap")
            nm.inputs["Strength"].default_value = 1.8
            nt.links.new(nm.inputs["Color"], nr.outputs["Color"])
            nt.links.new(b.inputs["Normal"], nm.outputs["Normal"])
        n += 1
    # A tinta ainda quer o COLOR_0 multiplicado. A vegetacao NAO entra aqui: os
    # materiais PLANT_* trazem a textura embutida no set.glb (folha com alfa e
    # casca), entao reescrever a Base Color deles apagaria a folha e deixaria o
    # cartao chapado. Era o que acontecia com TREE_LEAF/TREE_BARK, que ja nem
    # existem — ver a nota no topo.
    for name in ("LINE_PAINT",):
        m = bpy.data.materials.get(name)
        if not m or name not in BIND:
            continue
        nt = m.node_tree
        b = nt.nodes.get("Principled BSDF")
        tint = BIND[name][2]
        ca = nt.nodes.new("ShaderNodeVertexColor")
        ca.layer_name = "Col"
        mix = nt.nodes.new("ShaderNodeMixRGB")
        mix.blend_type = "MULTIPLY"
        mix.inputs["Fac"].default_value = 1.0
        mix.inputs["Color1"].default_value = (tint[0], tint[1], tint[2], 1.0)
        nt.links.new(mix.inputs["Color2"], ca.outputs["Color"])
        nt.links.new(b.inputs["Base Color"], mix.outputs["Color"])
    log("bound %d ground materials" % n)


def world_hdri():
    w = bpy.data.worlds.new("w")
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes["Background"]
    if os.path.exists(HDR):
        env = nt.nodes.new("ShaderNodeTexEnvironment")
        env.image = bpy.data.images.load(HDR, check_existing=True)
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Rotation"].default_value = (0.0, 0.0, ENV_ROTATION)
        tc = nt.nodes.new("ShaderNodeTexCoord")
        nt.links.new(mp.inputs["Vector"], tc.outputs["Generated"])
        nt.links.new(env.inputs["Vector"], mp.outputs["Vector"])
        nt.links.new(bg.inputs["Color"], env.outputs["Color"])
        bg.inputs["Strength"].default_value = 1.0
        log("world: HDRI %s" % os.path.basename(HDR))
    else:
        bg.inputs["Color"].default_value = (0.42, 0.5, 0.62, 1)
        log("world: HDRI MISSING, flat sky")
    # A sun on top of the HDRI, because the app's preset `ensolarado` adds a
    # directional key the HDRI alone does not provide.
    bpy.ops.object.light_add(type="SUN", location=(60, -80, 120))
    s = bpy.context.active_object
    s.data.energy = 2.6
    s.data.angle = math.radians(1.6)
    s.rotation_euler = (math.radians(54), 0.0, math.radians(38))


def stand_in_truck():
    """A 19 x 2.6 x 4.0 m box on the origin.

    Nothing about this scene can be judged without it: "is the fence far
    enough", "is the tree in the way", "does the kerb read at this distance"
    are all questions about a 19 m rig that is not in the .glb, because the app
    supplies it.
    """
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    ob = bpy.context.active_object
    ob.name = "STANDIN_rig"
    ob.scale = (2.6, 19.0, 4.0)
    ob.location = (0.0, 8.0, 2.0)
    m = bpy.data.materials.new("standin")
    m.use_nodes = True
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.55, 0.06, 0.06, 1)
    m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.35
    ob.data.materials.append(m)
    return ob


def shoot(name, target, dist, direction, fov):
    tgt = Vector(target)
    d = Vector(direction).normalized()
    cam_d = bpy.data.cameras.new("c_" + name)
    cam_d.lens_unit = "FOV"
    cam_d.angle = math.radians(fov)
    cam = bpy.data.objects.new("c_" + name, cam_d)
    bpy.context.collection.objects.link(cam)
    cam.location = tgt + d * dist
    cam.rotation_euler = (tgt - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc = bpy.context.scene
    sc.camera = cam
    sc.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)
    log("  %s" % name)


def main():
    os.makedirs(OUT, exist_ok=True)
    # Build the district in this session — same code path as the export, so a
    # preview can never disagree with what shipped.
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "bip", os.path.join(HERE, "build_industrial_park.py"))
    mod = importlib.util.module_from_spec(spec)
    sys.modules["bip"] = mod
    spec.loader.exec_module(mod)          # runs main() and writes set.glb

    bind_ground()
    world_hdri()
    stand_in_truck()

    sc = bpy.context.scene
    # CYCLES, NOT EEVEE, and not by preference. Headless EEVEE crashed outright
    # on this scene (blender.crash.txt, after the build had already written
    # set.glb) — it wants a real GL context and this one has 311 k faces, an
    # alpha-clipped perimeter and a 5.7 MB HDRI to chew on without one. Cycles
    # on CPU is slower and cannot crash for that reason, and its contact shadows
    # are what the kerb and the tree line actually have to be judged on.
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 40
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 3
    # 64, NOT 6, and the perimeter render is what forced it. A shadow ray
    # crossing the tree belt passes through two staggered rows of three crossed
    # impostor cards plus the chainlink — easily a dozen alpha-cut surfaces —
    # and when a ray runs out of transparent bounces Cycles terminates it as
    # OPAQUE. The result was solid black rectangles standing among the trees,
    # which looks exactly like broken alpha and is not: the impostor sheets are
    # clean. A renderer setting, not an asset fault.
    #
    # It is still worth knowing at runtime: that same overlap is alpha-tested
    # overdraw on the GPU. It is cheap per pixel and it is not free.
    sc.cycles.transparent_max_bounces = 64
    sc.render.resolution_x = 1000
    sc.render.resolution_y = 600
    sc.render.image_settings.file_format = "PNG"
    sc.view_settings.exposure = math.log2(EXPOSURE)
    try:
        sc.view_settings.view_transform = "AgX"
    except TypeError:
        pass

    only = None
    for a in sys.argv:
        if a.startswith("--only="):
            only = a.split("=", 1)[1].split(",")
    for name, tgt, dist, d, fov in SHOTS:
        if only and name not in only:
            continue
        shoot(name, tgt, dist, d, fov)
    log("done -> %s" % OUT)


main()
