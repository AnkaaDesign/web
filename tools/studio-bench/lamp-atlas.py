# ATLAS DE LANTERNAS — a verdade sobre onde cada lâmpada está, em cada bake.
# =============================================================================
#     blender --background --factory-startup --python tools/studio-bench/lamp-atlas.py \
#             -- public/models/trucks/volvo_fh_2021_4x2.glb /tmp/atlas.json
#
# POR QUE BLENDER, E NÃO O PARSER DE glTF QUE JÁ EXISTE NESTE REPOSITÓRIO.
# Os 49 bakes usam `KHR_draco_mesh_compression`. Sem decodificar Draco só dá para
# ler o `min`/`max` do accessor de POSITION, ou seja a CAIXA de cada nó — e caixa
# é envelope, não conteúdo. Foi exatamente esse limite que produziu o defeito das
# "luzes flutuando": o nó `cabin_p9` do Scania S mede y 0,50…3,40 porque junta a
# lanterna do para-choque com a delimitadora do teto, e o centro dessa caixa não
# é lâmpada nenhuma. Blender importa o Draco e dá os VÉRTICES.
#
# O QUE ELE PRODUZ: para cada material de lâmpada, as ILHAS — os pedaços de
# geometria que não se tocam. Uma ilha é uma lanterna (ou uma barra de LED). É a
# única decomposição que serve, e serve inclusive para os 12 bakes em que UM
# material cobre o caminhão inteiro: ali a lente é uma casca SOLTA dentro da
# malha da carroceria, então a ilha a separa mesmo o material não separando.
#
# O atlas é usado para VERIFICAR o que o motor deduz em tempo de execução
# (`sitiosDaMalha()` em vehicle/lights.ts faz a mesma decomposição, por
# união-busca sobre o índice) e para responder "este chassi tem quantas lanternas,
# e onde?" sem abrir o app.
import bpy
import bmesh
import json
import os
import re
import sys

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = argv[0], argv[1]

# As MESMAS regras de vehicle/lights.ts. Copiadas de propósito: se o atlas
# importasse a regra do motor, ele concordaria com ele por construção e não
# verificaria nada.
INTERIOR_RE = re.compile(r'interior|dashboard|_gps\b|button|codrv|steering|intlight|ilum_l|painel-de-instr', re.I)
LAMPADA_RE = re.compile(r'lights?|lamps?|farol|faror|lanterna|led-|painel-curva|sinaleira|sinaleita|positional|pos_light', re.I)
NAO_LAMPADA_RE = re.compile(r'galvaniz|plain_grey|brushed_metal|plastic_hard|_steel\b|rubber|screw|parafus', re.I)
FAROL_RE = re.compile(r'lights?_w\b|_w$|farol|faror|head_?light|drl', re.I)
PECA_FAROL_RE = re.compile(r'^f_light', re.I)


def sufixo(nome):
    m = re.search(r'_mat_\d+_(.+)$', nome)
    return m.group(1) if m else nome


def emissivo_do_material(mat):
    """emissiveFactor e se há mapa emissivo, lidos do nó Principled."""
    if not mat or not mat.use_nodes:
        return (0.0, False)
    for n in mat.node_tree.nodes:
        if n.type != 'BSDF_PRINCIPLED':
            continue
        emi = n.inputs.get('Emission Color') or n.inputs.get('Emission')
        forca = n.inputs.get('Emission Strength')
        cor = (0.0, 0.0, 0.0)
        tem_mapa = False
        if emi is not None:
            if emi.is_linked:
                tem_mapa = True
                cor = (1.0, 1.0, 1.0)
            else:
                cor = tuple(emi.default_value)[:3]
        f = 1.0 if forca is None or forca.is_linked else float(forca.default_value)
        lum = (0.2126 * cor[0] + 0.7152 * cor[1] + 0.0722 * cor[2]) * f
        # o mapa de cor base também conta: no glTF o emissiveTexture costuma ser
        # o próprio baseColorTexture (medido: md5 idêntico no FH 2021).
        base = n.inputs.get('Base Color')
        if base is not None and base.is_linked:
            tem_mapa = True
        return (lum, tem_mapa)
    return (0.0, False)


def eh_lampada(nome, lum, tem_mapa):
    if INTERIOR_RE.search(nome):
        return (False, False)
    s = sufixo(nome)
    if NAO_LAMPADA_RE.search(s):
        return (False, False)
    farol = bool(FAROL_RE.search(s) or PECA_FAROL_RE.search(nome))
    if farol:
        return (True, True)
    if (lum > 1e-4 or LAMPADA_RE.search(s)) and tem_mapa:
        return (True, False)
    return (False, False)


bpy.ops.wm.read_factory_settings(use_empty=True)
# ⚠️ `merge_vertices=True` É OBRIGATÓRIO, e a primeira rodada sem ele devolveu
# **2 951 ilhas** num FH que tem seis materiais de lâmpada. A razão é do formato:
# glTF é sopa de triângulos com o vértice DUPLICADO em toda costura de UV e de
# normal, então "compartilhar índice de vértice" não quer dizer "estar colado".
# Sem soldar, a união-busca vê cada triângulo como um pedaço solto e a
# decomposição em ilhas não decompõe nada.
bpy.ops.import_scene.gltf(filepath=SRC, merge_vertices=True)

saida = {'modelo': os.path.basename(SRC), 'lampadas': [], 'materiais': []}

for obj in list(bpy.data.objects):
    if obj.type != 'MESH':
        continue
    me = obj.data
    if not me.polygons:
        continue
    slots = [s.material for s in obj.material_slots]
    alvos = {}
    for i, mat in enumerate(slots):
        if not mat:
            continue
        lum, tem_mapa = emissivo_do_material(mat)
        ok, farol = eh_lampada(mat.name, lum, tem_mapa)
        if ok:
            alvos[i] = (mat.name, farol, lum, tem_mapa)
    if not alvos:
        continue

    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()

    for slot_idx, (nome_mat, farol, lum, tem_mapa) in alvos.items():
        faces = [f for f in bm.faces if f.material_index == slot_idx]
        if not faces:
            continue
        # UNIÃO-BUSCA sobre os vértices das faces deste material: as ilhas.
        pai = {}

        def acha(a):
            r = a
            while pai.get(r, r) != r:
                r = pai[r]
            while pai.get(a, a) != a:
                pai[a], a = r, pai[a]
            return r

        for f in faces:
            vs = [v.index for v in f.verts]
            pai.setdefault(vs[0], vs[0])
            for v in vs[1:]:
                pai.setdefault(v, v)
                ra, rb = acha(vs[0]), acha(v)
                if ra != rb:
                    pai[rb] = ra

        ilhas = {}
        M = obj.matrix_world
        for f in faces:
            r = acha(f.verts[0].index)
            g = ilhas.get(r)
            if g is None:
                g = {'min': [1e9] * 3, 'max': [-1e9] * 3, 'soma': [0.0] * 3, 'n': 0}
                ilhas[r] = g
            for v in f.verts:
                w = M @ v.co
                for k in range(3):
                    if w[k] < g['min'][k]:
                        g['min'][k] = w[k]
                    if w[k] > g['max'][k]:
                        g['max'][k] = w[k]
                    g['soma'][k] += w[k]
                g['n'] += 1

        saida['materiais'].append({
            'material': nome_mat, 'objeto': obj.name, 'farol': farol,
            'emissivo': round(lum, 4), 'mapa': tem_mapa,
            'faces': len(faces), 'ilhas': len(ilhas),
        })
        for g in ilhas.values():
            if g['n'] < 3:
                continue
            saida['lampadas'].append({
                'material': nome_mat, 'objeto': obj.name, 'farol': farol,
                'centro': [round(g['soma'][k] / g['n'], 4) for k in range(3)],
                'min': [round(g['min'][k], 4) for k in range(3)],
                'max': [round(g['max'][k], 4) for k in range(3)],
                'verts': g['n'],
            })
    bm.free()

saida['lampadas'].sort(key=lambda l: (l['material'], l['centro'][2]))
with open(OUT, 'w') as fp:
    json.dump(saida, fp, indent=1)
print('ATLAS OK %s: %d lâmpadas em %d materiais'
      % (saida['modelo'], len(saida['lampadas']), len(saida['materiais'])))
