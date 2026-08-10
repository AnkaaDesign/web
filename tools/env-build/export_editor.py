# Feeds the map creator.
#
#   blender -b -P export_editor.py
#
# Writes into map-creator/:
#   prototypes.glb  every placeable piece ONCE, at the origin, footprint-centred
#   catalog.json    key -> label, footprint, height, whether it is tall
#   layout.json     the CURRENT layout, in the format the editor reads and the
#                   build reads back
#
# WHY ONE GLB OF PROTOTYPES AND NOT set.glb. The editor has to place, move and
# duplicate pieces, so it needs them as SEPARATE, identifiable, origin-centred
# objects — set.glb is a district that has already been laid out, with every
# piece baked into its position. Exporting the prototypes is also much smaller:
# one copy of each mesh instead of one per placement.
#
# The layout round-trips: this writes layout.json, the editor edits it, and
# build_industrial_park.py reads it back in preference to its own table. That is
# the whole point — the coordinates stop living in a Python table that only
# changes when someone types a number and looks at a render.
import bpy
import json
import math
import os
import sys

os.environ["PARK_NO_BUILD"] = "1"

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "map-creator")


def log(m):
    print("[edit] " + m, flush=True)


def load(name):
    import importlib.util
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, name + ".py"))
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    park = load("build_industrial_park")
    ibc1 = load("ibc1")
    dl_packs = load("dl_packs")

    ibc = ibc1.import_prototypes(log)
    park.thin_prototypes(ibc)
    dl = dl_packs.import_prototypes(log)

    catalog = {}
    keep = []

    def register(key, label, ob, size):
        ob.name = "P_" + key
        ob.location = (0.0, 0.0, 0.0)
        ob.rotation_euler = (0.0, 0.0, 0.0)
        ob.scale = (1.0, 1.0, 1.0)
        catalog[key] = {
            "label": label,
            "w": round(size[0], 2),
            "d": round(size[1], 2),
            "h": round(size[2], 2),
            "node": "P_" + key,
        }
        keep.append(ob)

    IBC_LABEL = {
        0: "contêiner 20 pés", 1: "pipe rack 30 m", 2: "pipe rack 50 m",
        3: "torre de colunas 38 m", 4: "unidade de processo 23 m",
        5: "coluna + vaso 29 m", 6: "bloco de processo 11 m", 7: "bacia",
        # model_8 nao existe mais como peca separada: e o aparato do model_11 e
        # entra junto com ele (ibc1.PAIRS).
        9: "poste de respiro",
        10: "tanque de armazenagem",
        11: "complexo com tubulação 25 m", 12: "galpão longo",
        13: "conjunto de blocos 11 m", 14: "armazém de tambores",
        15: "galpão comprido",
    }
    for idx, (ob, size) in sorted(ibc.items()):
        register("ibc%02d" % idx, IBC_LABEL.get(idx, "IBC %d" % idx), ob, size)

    DL_LABEL = {
        "booth": "guarita com cancela", "shed_sm": "armazém pequeno",
        "hall_big": "galpão principal", "shed_old": "armazém antigo",
        "office": "escritório de obra", "dock": "galpão de docas",
        "cabinet": "armário de comando", "skip": "caçamba",
    }
    for key, (ob, size) in sorted(dl.items()):
        label = DL_LABEL.get(key)
        if label is None:
            label = "prédio urbano %s" % key.split("_")[-1] if key.startswith("mc_") else key
        register(key, label, ob, size)

    # Everything else that came in with the packs goes, or it exports too.
    for o in list(bpy.data.objects):
        if o not in keep:
            bpy.data.objects.remove(o, do_unlink=True)

    os.makedirs(OUT, exist_ok=True)
    for o in bpy.data.objects:
        o.select_set(True)
    kw = dict(filepath=os.path.join(OUT, "prototypes.glb"), export_format="GLB",
              export_apply=False, export_yup=True, export_cameras=False,
              export_lights=False,
              export_draco_mesh_compression_enable=False)
    try:
        bpy.ops.export_scene.gltf(export_image_format="WEBP",
                                  export_image_quality=80, **kw)
    except TypeError:
        bpy.ops.export_scene.gltf(**kw)

    # ---- the site, so the editor can draw the context it has to fit -------
    site = {
        "roadA": park.ROAD_A_X, "roadB": park.ROAD_B_X, "roadW": park.ROAD_W,
        "edge": park._EDGE, "medianW": park.MEDIAN_W,
        "fenceHalf": park.YARD_HALF,
        "yard": [park.YARD_X0, park.YARD_X1, park.YARD_Y0, park.YARD_Y1],
        "clearRadius": park.CLEAR_RADIUS,
        "tallSetback": park.TALL_SETBACK,
        "shiftX": park.SHIFT_X,
        "shiftY": park.SHIFT_Y,
        "serviceRoads": [list(r) for r in park.SERVICE_ROADS],
        "truck": {"w": 2.9, "len": 19.0, "h": 4.1},
    }

    # ---- the current layout, in the editor's format -----------------------
    items = []

    def resolve(source, key):
        if source == "ibc":
            return "ibc%02d" % key
        if key.startswith("midcentury_"):
            return None                      # drawn from the mc pool at build time
        return key

    mc_keys = sorted(k for k in catalog if k.startswith("mc_"))
    mc_next = [0]
    for source, key, (x, y), rot, note in park.LAYOUT:
        k = resolve(source, key)
        if k is None:
            if mc_next[0] >= len(mc_keys):
                continue
            k = mc_keys[mc_next[0]]
            mc_next[0] += 1
        if k not in catalog:
            continue
        items.append({"key": k, "x": x, "y": y, "rot": rot, "scale": 1.0,
                      "note": note, "inside": True})
    for source, key, (x, y), rot, note in park.DUPES:
        k = resolve(source, key)
        if k and k in catalog:
            items.append({"key": k, "x": x, "y": y, "rot": rot, "scale": 1.0,
                          "note": note, "inside": True})
    for x, y, rot in park.MIDCENTURY_SITES:
        if mc_next[0] >= len(mc_keys):
            break
        items.append({"key": mc_keys[mc_next[0]], "x": x, "y": y, "rot": rot,
                      "scale": 1.0, "note": "distrito vizinho", "inside": False})
        mc_next[0] += 1
    for i, (x, y, rot) in enumerate(park.CONTAINERS):
        items.append({"key": "ibc00", "x": x, "y": y, "rot": rot, "scale": 1.0,
                      "note": "contêiner %d" % i, "inside": True})
    for i, (x, y) in enumerate(park.POLES):
        items.append({"key": "ibc09", "x": x, "y": y, "rot": 0, "scale": 1.0,
                      "note": "poste %d" % i, "inside": True})
    for i, (x, y, rot) in enumerate(park.SKIPS):
        items.append({"key": "skip", "x": x, "y": y, "rot": rot, "scale": 1.0,
                      "note": "caçamba %d" % i, "inside": True})
    for i, (x, y, rot) in enumerate(park.CABINETS):
        items.append({"key": "cabinet", "x": x, "y": y, "rot": rot, "scale": 1.0,
                      "note": "armário %d" % i, "inside": True})

    with open(os.path.join(OUT, "catalog.json"), "w", encoding="utf-8") as f:
        json.dump({"site": site, "catalog": catalog}, f, ensure_ascii=False, indent=1)

    # NAO SOBRESCREVE UM layout.json QUE JA EXISTE.
    #
    # A partir do momento em que o editor existe, esse arquivo e do KENNEDY: e
    # onde o trabalho de arranjar o sitio fica gravado. Reexportar o catalogo
    # (para pegar um modelo novo, ou um rotulo corrigido) apagaria esse trabalho
    # sem avisar — e a unica pista seria o layout voltar ao estado da tabela.
    # O catalogo pode e deve ser regerado sempre; o layout, so quando pedido.
    lay = os.path.join(OUT, "layout.json")
    if os.path.exists(lay) and os.environ.get("PARK_RESET_LAYOUT") != "1":
        log("layout.json preservado (PARK_RESET_LAYOUT=1 para regerar da tabela)")
    else:
        with open(lay, "w", encoding="utf-8") as f:
            json.dump({"site": site, "items": items}, f, ensure_ascii=False, indent=1)

    mb = os.path.getsize(os.path.join(OUT, "prototypes.glb")) / 1048576.0
    log("prototypes.glb %.1f MB, %d tipos, %d peças no layout"
        % (mb, len(catalog), len(items)))
    log("-> %s" % OUT)


main()
