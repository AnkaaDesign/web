# Recupera do set.glb publicado tudo o que a build precisa e NAO consegue
# regerar sem os packs crus. Rodar uma vez:
#
#     blender -b -P salvage_cache.py
#
# POR QUE ISTO EXISTE. Os `_src_*` sao gitignorados (.gitignore, "Fontes cruas
# dos cenarios") e vivem na maquina Windows. Nesta maquina eles nao existem, e
# sem eles:
#
#   ibc1.import_prototypes   -> 0 predios
#   dl_packs.import_prototypes -> 0 predios
#   trees_pack.build_prototypes -> excecao, cai nos impostores de cartao
#   props_ph.import_props    -> 0 props, e a CERCA FICA SEM TEXTURA
#
# ou seja: rodar a build hoje produzia um distrito vazio, e o modo de falha e
# silencioso — os tres modulos LOGAM e seguem em frente, exatamente a armadilha
# que o cabecalho do build ja documenta para o FENCE_SRC.
#
# Os predios ja estavam salvos: map-creator/prototypes.glb e um export de todos
# eles, origem-centrado, com as texturas embutidas (export_editor.py). Falta o
# resto, e o resto esta dentro do proprio set.glb publicado — as arvores como
# malhas instanciadas, a cerca e a barreira como materiais com textura embutida.
#
# ESTE ARQUIVO NAO SUBSTITUI OS PACKS. Ele preserva o que ja foi construido a
# partir deles. Trocar o pack de arvores, mudar o corte de alfa da folha ou
# reagrupar tronco/copa continua a exigir `_src_trees` — o que isto garante e que
# nao se PERCA o que existe so por a pasta de origem estar noutra maquina.
import bpy
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "_src_cache")

# A fonte e o set.glb publicado. O `.bak-*` e preferido quando existe, porque a
# build sobrescreve o set.glb — salvar a partir do proprio arquivo que se acabou
# de gerar seria recuperar o resultado, nao a fonte.
SET_CANDIDATES = [
    os.path.join(HERE, "..", "..", "public", "environments",
                 "distrito-industrial", "set.glb.bak-2026-08-10-servidor"),
    os.path.join(HERE, "..", "..", "public", "environments",
                 "distrito-industrial", "set.glb"),
]

PLANTS = ["tree_pk_%d" % i for i in range(6)] + ["bush_pk_%d" % i for i in range(4)]
PROPS = {"bar_g_0": "PH_barrier"}


def log(m):
    print("[salvage] %s" % m, flush=True)


def _save_image(img, path):
    """Grava a imagem do datablock em disco. `img.save_render` respeita o
    formato pedido; `img.filepath_raw` + `save` mantem os dados crus, que e o
    que interessa para um mapa de alfa."""
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    return path


def main():
    src = None
    for c in SET_CANDIDATES:
        c = os.path.normpath(c)
        if os.path.exists(c):
            src = c
            break
    if src is None:
        log("NENHUM set.glb encontrado — nada a recuperar")
        sys.exit(1)
    log("fonte: %s (%.1f MB)" % (src, os.path.getsize(src) / 1048576.0))

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)

    os.makedirs(CACHE, exist_ok=True)
    fence_dir = os.path.join(CACHE, "fence")
    os.makedirs(fence_dir, exist_ok=True)

    # ---- 1. as texturas da cerca -----------------------------------------
    #
    # _fence_mats() carrega POR CAMINHO DE ARQUIVO (props_ph.WIRE_ALPHA /
    # POSTS_DIFF), nao por datablock, entao recuperar o material nao basta: os
    # bytes tem de voltar para o disco.
    wrote = 0
    for mat_name, out_name in (("FENCE_WIRE", "wire_diff_alpha.png"),
                               ("FENCE_POST", "posts_diff.png")):
        m = bpy.data.materials.get(mat_name)
        if m is None or not m.node_tree:
            log("  %s ausente no set.glb" % mat_name)
            continue
        for n in m.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image:
                p = _save_image(n.image, os.path.join(fence_dir, out_name))
                log("  %-12s -> %s (%dx%d)"
                    % (mat_name, os.path.basename(p), n.image.size[0], n.image.size[1]))
                wrote += 1
                break

    # ---- 2. as plantas e a barreira, como um GLB de prototipos -----------
    keep = []
    for name in PLANTS:
        ob = bpy.data.objects.get(name)
        if ob is None or ob.type != "MESH":
            log("  planta ausente: %s" % name)
            continue
        ob.location = (0.0, 0.0, 0.0)
        ob.rotation_euler = (0.0, 0.0, 0.0)
        ob.scale = (1.0, 1.0, 1.0)
        keep.append(ob)

    for src_name, dst_name in PROPS.items():
        ob = bpy.data.objects.get(src_name)
        if ob is None or ob.type != "MESH":
            log("  prop ausente: %s" % src_name)
            continue
        # A BARREIRA VEM POSICIONADA, nao centrada. No set.glb ela e uma das dez
        # copias ja assentes no sitio; o que props_ph devolve e um prototipo com
        # transformacao identidade, pegada centrada e base em z=0. Recentrar aqui
        # e o que faz o cache ser trocavel pelo importador de verdade.
        ob.name = dst_name
        me = ob.data
        from mathutils import Vector, Matrix
        co = [Vector(v.co) for v in me.vertices]
        lo = Vector((min(c.x for c in co), min(c.y for c in co), min(c.z for c in co)))
        hi = Vector((max(c.x for c in co), max(c.y for c in co), max(c.z for c in co)))
        me.transform(Matrix.Translation(Vector((-(lo.x + hi.x) / 2.0,
                                                -(lo.y + hi.y) / 2.0, -lo.z))))
        me.update()
        ob.location = (0.0, 0.0, 0.0)
        ob.rotation_euler = (0.0, 0.0, 0.0)
        ob.scale = (1.0, 1.0, 1.0)
        keep.append(ob)

    keep_set = set(keep)
    for o in list(bpy.data.objects):
        if o not in keep_set:
            bpy.data.objects.remove(o, do_unlink=True)

    for o in bpy.data.objects:
        o.select_set(True)

    out = os.path.join(CACHE, "salvage.glb")
    kw = dict(filepath=out, export_format="GLB", export_apply=False,
              export_yup=True, export_cameras=False, export_lights=False,
              export_draco_mesh_compression_enable=False,
              export_vertex_color="ACTIVE")
    try:
        bpy.ops.export_scene.gltf(export_image_format="WEBP",
                                  export_image_quality=92, **kw)
    except TypeError:
        bpy.ops.export_scene.gltf(**kw)

    log("salvage.glb %.1f MB — %d objetos (%d plantas), %d texturas de cerca"
        % (os.path.getsize(out) / 1048576.0, len(keep),
           len([o for o in keep if "_pk_" in o.name]), wrote))
    log("-> %s" % CACHE)


main()
