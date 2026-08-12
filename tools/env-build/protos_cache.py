# O recuo dos tres importadores quando os packs crus nao estao no disco.
#
# Ver salvage_cache.py para o porque. Em resumo: `_src_ibc1`, `_src_dl`,
# `_src_trees` e `_src_ph` sao gitignorados e vivem na maquina Windows. Sem eles
# a build nao falha — ela produz um distrito VAZIO, porque cada importador loga e
# devolve dicionario vazio. Este modulo devolve os mesmos objetos a partir de
# duas caches versionaveis:
#
#   map-creator/prototypes.glb   os 36 predios (export_editor.py)
#   _src_cache/salvage.glb       as 10 plantas e a barreira (salvage_cache.py)
#
# O CONTRATO E O DO IMPORTADOR DE VERDADE, e isso e o que torna a troca segura:
# devolve `{chave: (objeto, (sx, sy, sz))}` com transformacao identidade, pegada
# centrada e base em z=0 — que e exatamente o que layout()/place() assumem.
#
# O QUE JA VEM FEITO E NAO PODE SER REFEITO. Os prototipos do cache sairam da
# ponta do pipeline, entao ja passaram por `separate_coplanar`, `_decimate` e
# `thin_prototypes`. Aplicar de novo nao e inofensivo: decimar duas vezes tira
# 55% de 45% e a torre de colunas vira papel amassado. Quem chama tem de olhar
# `USED_CACHE` antes de re-tratar (build_industrial_park.thin_prototypes ja faz).
import bpy
import os

from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "_src_cache")
PROTO_GLB = os.path.join(HERE, "map-creator", "prototypes.glb")
SALVAGE_GLB = os.path.join(CACHE, "salvage.glb")
FENCE_DIR = os.path.join(CACHE, "fence")

# Marcado por load_buildings(); build_industrial_park le isto para nao redecimar.
USED_CACHE = {"buildings": False, "plants": False, "props": False}


def _log(m):
    print("[cache] %s" % m, flush=True)


def _import(path, log):
    """Importa um GLB e devolve so os objetos NOVOS, com a conversao de eixo
    ja assada na malha.

    O importador de glTF nao reescreve vertices para Y-up: ele pendura as malhas
    num EMPTY de conversao e poe a rotacao la. Um `location = (x, y, z)` depois
    disso e uma posicao num referencial deitado 90 graus — e esse e literalmente
    o bug que props_ph documenta ter mandado um perimetro inteiro para a
    vertical. Desparenteia e aplica antes de devolver."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    fresh = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in fresh if o.type == "MESH"]
    if meshes:
        for o in bpy.data.objects:
            o.select_set(o in meshes)
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in fresh:
        if o.type == "EMPTY" and not o.children:
            bpy.data.objects.remove(o, do_unlink=True)
    return [o for o in meshes if o.name in bpy.data.objects]


def _size(ob):
    co = [Vector(v.co) for v in ob.data.vertices]
    if not co:
        return (0.0, 0.0, 0.0)
    lo = Vector((min(c.x for c in co), min(c.y for c in co), min(c.z for c in co)))
    hi = Vector((max(c.x for c in co), max(c.y for c in co), max(c.z for c in co)))
    return (hi.x - lo.x, hi.y - lo.y, hi.z - lo.z)


def _load_dl_packs():
    """dl_packs por caminho — mesma razao que ibc1._load_dl documenta: o build
    carrega estes modulos com importlib a partir do diretorio do ficheiro, e um
    `import dl_packs` normal so funcionaria por acaso de sys.path."""
    import importlib.util
    import sys
    for key in ("dl_packs", "dl_packs_for_ibc"):
        if key in sys.modules:
            return sys.modules[key]
    p = os.path.join(HERE, "dl_packs.py")
    if not os.path.exists(p):
        return None
    spec = importlib.util.spec_from_file_location("dl_packs", p)
    mod = importlib.util.module_from_spec(spec)
    sys.modules["dl_packs"] = mod
    spec.loader.exec_module(mod)
    return mod


def available(kind):
    return {"buildings": os.path.exists(PROTO_GLB),
            "plants": os.path.exists(SALVAGE_GLB),
            "props": os.path.exists(SALVAGE_GLB)}.get(kind, False)


_BUILDINGS = None


def load_buildings(log=_log):
    """(ibc, dl) no formato dos dois importadores: ibc chaveado por INT, dl por
    string. `prototypes.glb` nomeia tudo `P_<chave>`.

    MEMOIZADO, e nao por economia. Os dois importadores chamam esta funcao — o
    ibc1 quer a metade IBC, o dl_packs a metade DL — e cada chamada importaria o
    GLB outra vez, deixando 36 predios duplicados NA ORIGEM. A origem e onde o
    caminhao estaciona; e a mesma armadilha que layout_from_file ja documenta
    para os prototipos nao usados."""
    global _BUILDINGS
    if _BUILDINGS is not None:
        return _BUILDINGS
    if not os.path.exists(PROTO_GLB):
        log("prototypes.glb ausente — sem predios")
        return {}, {}
    obs = _import(PROTO_GLB, log)
    ibc, dl = {}, {}
    for ob in obs:
        if not ob.name.startswith("P_"):
            continue
        key = ob.name[2:]
        ob.location = (0.0, 0.0, 0.0)
        ob.rotation_euler = (0.0, 0.0, 0.0)
        ob.scale = (1.0, 1.0, 1.0)
        if key.startswith("ibc") and key[3:].isdigit():
            idx = int(key[3:])
            ob.name = "IBC_%02d" % idx
            ibc[idx] = (ob, _size(ob))
        else:
            ob.name = ("MC_%s" % key[3:]) if key.startswith("mc_") else ("DL_" + key)
            dl[key] = (ob, _size(ob))
    # A SEPARACAO CORRE OUTRA VEZ, e nao e desperdicio.
    #
    # O cabecalho deste ficheiro diz que a cache ja passou por
    # `separate_coplanar` — e passou, pela versao que ele TINHA. Essa versao
    # ignorava qualquer par que partilhasse um vertice, e nestes ripes a porta
    # vem soldada na parede: 41 faces em MC_00, 11 em MC_01, mais nove pecas,
    # todas a 0,0 mm (audit_decals.py). O detetor foi corrigido em dl_packs; o
    # que esta gravado no prototypes.glb nao muda por causa disso.
    #
    # Correr aqui e o unico sitio que alcanca a cache sem os packs crus, e e
    # IDEMPOTENTE na pratica: cada build parte sempre do mesmo ficheiro e aplica
    # exatamente uma passagem — que e a disciplina que `_separate_pass` ja
    # documenta ("uma passagem, nao um ciclo").
    try:
        mod = _load_dl_packs()
        if mod is not None:
            n = 0
            for ob, _sz in list(ibc.values()) + list(dl.values()):
                n += mod.separate_coplanar(ob, lambda m: None)
            if n:
                log("separacao coplanar na cache: %d pecas afastadas" % n)
    except Exception as e:
        log("separate_coplanar falhou na cache (%s) — seguindo sem" % e)

    USED_CACHE["buildings"] = True
    log("prototypes.glb: %d IBC + %d DL (%d faces)"
        % (len(ibc), len(dl),
           sum(len(o.data.polygons) for o, _ in list(ibc.values()) + list(dl.values()))))
    _BUILDINGS = (ibc, dl)
    return _BUILDINGS


# A RAIZ FICA ENTERRADA, E O NUMERO E MEDIDO NO RENDER e nao estimado.
#
# `trees_pack.build_plant` assenta a base no 3.o percentil da madeira, o que
# funciona para uma raiz que so se espalha. Nao funciona para estes dois:
#
#   tree_pk_0  1 390 dos 3 971 vertices de casca estao entre z 0,30 e 0,60 num
#              raio de 1,3 m — nao e tronco, e uma GARRA de raizes apoiada no
#              chao. Renderizada, a arvore fica de pe sobre as raizes como um
#              mangue. E a reclamacao "as raizes estao para fora".
#   tree_pk_5  a verticilo mais baixo de ramos varre ate z 0,30 num raio de
#              3,2 m e entra pela grama adentro.
#
# Os outros quatro (pk_1..pk_4) medem e renderizam limpos: tronco entra no chao
# como tronco. Por isso a correcao e uma TABELA de dois e nao uma heuristica —
# uma regra por raio nao distingue raiz de ramo baixo, e pk_1 tem ramo legitimo a
# 2,36 m de raio que qualquer regra desse tipo enterraria.
PLANT_SINK = {
    "tree_pk_0": 0.55,
    "tree_pk_5": 0.90,
}


_SALVAGE = None


def _salvage(log):
    """Importa salvage.glb UMA VEZ e devolve {nome base: objeto}.

    MEMOIZADO PELA MESMA RAZAO QUE load_buildings, e aqui a fatura foi maior:
    load_props e load_plants sao chamados em momentos diferentes do main(), e
    cada um importava o arquivo inteiro. O segundo import trazia as 10 plantas e
    a barreira OUTRA VEZ; a funcao que chamava ficava com o que queria e o resto
    sobrava na cena, sem dono, NA ORIGEM — e a origem e onde o caminhao
    estaciona. Media no primeiro build: uma `PH_barrier.001` de 900 faces
    plantada dentro da cabine, mais `PLANT_BARK.001`/`PLANT_LEAF.001` e
    `concrete_road_barrier.001`, ou seja o atlas de folha de 2048 embutido duas
    vezes no .glb."""
    global _SALVAGE
    if _SALVAGE is not None:
        return _SALVAGE
    if not os.path.exists(SALVAGE_GLB):
        return {}
    out = {}
    for ob in _import(SALVAGE_GLB, log):
        base = ob.name.split(".")[0]
        ob.name = base
        ob.location = (0.0, 0.0, 0.0)
        ob.rotation_euler = (0.0, 0.0, 0.0)
        ob.scale = (1.0, 1.0, 1.0)
        out[base] = ob
    _SALVAGE = out
    return out


def load_plants(log=_log):
    """(trees, bushes) — listas de objetos, como trees_pack.build_prototypes."""
    obs = list(_salvage(log).values())
    if not obs:
        log("salvage.glb ausente — sem plantas")
        return [], []
    trees, bushes = [], []
    sunk = 0
    for ob in sorted(obs, key=lambda o: o.name):
        base = ob.name.split(".")[0]
        if not (base.startswith("tree_pk_") or base.startswith("bush_pk_")):
            continue
        ob.name = base
        ob.location = (0.0, 0.0, 0.0)
        ob.rotation_euler = (0.0, 0.0, 0.0)
        ob.scale = (1.0, 1.0, 1.0)
        dz = PLANT_SINK.get(base, 0.0)
        if dz:
            # Na MALHA, nao no objeto. plant() escreve `location` com a cota do
            # terreno, entao um deslocamento no objeto seria apagado na hora de
            # plantar; e a malha e partilhada por todas as instancias, que e onde
            # a correcao tem de viver.
            ob.data.transform(Matrix.Translation(Vector((0.0, 0.0, -dz))))
            ob.data.update()
            sunk += 1
        (trees if base.startswith("tree_") else bushes).append(ob)
    USED_CACHE["plants"] = True
    log("salvage.glb: %d arvores, %d arbustos (%d com a base corrigida)"
        % (len(trees), len(bushes), sunk))
    return trees, bushes


def load_props(log=_log):
    """key -> (objeto, tamanho), como props_ph.import_props."""
    ob = _salvage(log).get("PH_barrier")
    if ob is None:
        return {}
    USED_CACHE["props"] = True
    log("salvage.glb: 1 prop (barrier)")
    return {"barrier": (ob, _size(ob))}


def fence_textures():
    """(wire_alpha, posts_diff) ou (None, None). Caminhos de ARQUIVO, porque e
    assim que _fence_mats carrega."""
    w = os.path.join(FENCE_DIR, "wire_diff_alpha.png")
    p = os.path.join(FENCE_DIR, "posts_diff.png")
    return (w if os.path.exists(w) else None, p if os.path.exists(p) else None)
