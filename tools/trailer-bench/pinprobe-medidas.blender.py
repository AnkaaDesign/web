"""Produz `pinprobe-medidas.json` — as medidas de GLB que `pinprobe.mjs` não
consegue tirar sozinha.

    ~/blender-sdk/blender -b --factory-startup \
        --python tools/trailer-bench/pinprobe-medidas.blender.py -- \
        /srv/files/Estudio3D/v1 tools/trailer-bench/pinprobe-medidas.json

POR QUE EM BLENDER E NÃO EM NODE: os GLB são Draco, e um decodificador de Draco
em node seria uma dependência nova para uma sonda de bancada. O Blender já está
na máquina (`~/blender-sdk`, sem sudo) e já lê tudo.

O QUE ELE MEDE, e cada um espelha uma função do engine:

  · `rearProfiles[id]` — o perfil da traseira de cada cavalo, em bandas de
    100 mm, guardando o z MÍNIMO por banda no referencial normalizado. É
    `measureCabRearProfiles()` de `vehicle/models.ts`, vértice a vértice, com a
    mesma normalização `N(p,h)` de `coupling.ts`. Nada de caixa envolvente.

  · `rearLadders[id]` — o MESMO perfil por faixa de |x|, que é o que separa a
    asa da cabine do que o Thermo King de fato tem pela frente. Os degraus são
    cópia de `REAR_PROFILE_WIDTHS` e têm de andar junto com eles.

  · `trailer` — o lado implemento: contato e bogie pela banda de contato
    (`measureTyres`), pino e chapa pela forma (`measureKingpin`), e OS FUROS
    (`measureKingpinStations`). Os limiares abaixo são cópias dos de
    `trailer-rig.ts` e têm de andar junto com eles.
"""
import bpy, sys, json, math, os, re

argv = sys.argv[sys.argv.index("--") + 1:]
ASSETS, OUT = argv[0], argv[1]

# ---- limiares, espelhados de vehicle/trailer-rig.ts ----
TYRE_RE = re.compile(r'pneu|tire', re.I)
WHITE_RE = re.compile(r'Cor_padrao_branco|metalBranco', re.I)
CONTACT_BAND = 0.05
KP_HALF_X = 0.25
KP_SEARCH_DEPTH = 3.0
KP_MIN_DROP = 0.04
PLATE_RING = (0.08, 0.30)
KP_STATION_MAX_R = 0.22
KP_STATION_MIN_R = 0.07
KP_STATION_CLUSTER = 0.12
REAR_PROFILE_BAND = 0.10
# espelhado de REAR_PROFILE_WIDTHS em vehicle/models.ts
REAR_PROFILE_WIDTHS = [0.75, 1.05, 1.20, 1.35, 1.60]


def load(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)


def meshes():
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.data.vertices:
            yield o


def verts(o):
    """glTF (x, y, z) a partir do Blender (x, -z, y)."""
    mw = o.matrix_world
    for v in o.data.vertices:
        w = mw @ v.co
        yield (w.x, w.z, -w.y)


def mats(o):
    return ' '.join(m.name for m in o.data.materials if m)


# ============================ o lado CAVALO =================================
manifest = json.load(open(os.path.join(ASSETS, 'models/vehicles/hitch.json')))
rear = {}
ladders = {}
for key, ent in manifest['tractors'].items():
    src = os.path.join(ASSETS, ent['sourceFile'])
    if not os.path.exists(src):
        print('AUSENTE', src)
        continue
    load(src)
    yaw = ent.get('orientYaw', 0.0)
    gy = ent.get('groundY', 0.0)
    cx = ent.get('centerX', 0.0)
    cos, sin = math.cos(yaw), math.sin(yaw)
    bands = {}
    wbands = [dict() for _ in REAR_PROFILE_WIDTHS]
    for o in meshes():
        for (gx, gyv, gz) in verts(o):
            dx = gx - cx
            ny = gyv - gy
            nz = -dx * sin + gz * cos
            nx = abs(dx * cos + gz * sin)
            b = math.floor(ny / REAR_PROFILE_BAND)
            if b not in bands or nz < bands[b]:
                bands[b] = nz
            for k, lim in enumerate(REAR_PROFILE_WIDTHS):
                if nx > lim:
                    continue
                if b not in wbands[k] or nz < wbands[k][b]:
                    wbands[k][b] = nz

    def prof(d):
        return [{"y": (b + 0.5) * REAR_PROFILE_BAND, "z": z} for b, z in sorted(d.items())]
    rear[key] = prof(bands)
    ladders[key] = [{"halfWidth": lim, "profile": prof(wbands[k])}
                    for k, lim in enumerate(REAR_PROFILE_WIDTHS) if wbands[k]]
    print('perfil', key, len(rear[key]), 'bandas ·', len(ladders[key]), 'degraus')

# ========================== o lado IMPLEMENTO ===============================
load(os.path.join(ASSETS, 'models/vehicles/trailer.glb'))

# corpo branco -> floorY, roofY, z0, z1, largura  (TrailerBody.profile)
wx, wy, wz = [], [], []
for o in meshes():
    if not WHITE_RE.search(mats(o)):
        continue
    for p in verts(o):
        wx.append(p[0]); wy.append(p[1]); wz.append(p[2])
cx = (min(wx) + max(wx)) / 2
half = (max(wx) - min(wx)) / 2
z0, z1 = 1e9, -1e9
for i in range(len(wx)):
    if abs(wx[i] - cx) > half - 0.05:
        z0 = min(z0, wz[i]); z1 = max(z1, wz[i])
floorY, roofY = min(wy), max(wy)

# pneus -> contato e bogie  (measureTyres)
contactY = 1e9
tyres = [o for o in meshes() if TYRE_RE.search(o.name) or TYRE_RE.search(mats(o))]
for o in tyres:
    for p in verts(o):
        contactY = min(contactY, p[1])
cut = contactY + CONTACT_BAND
bzMin, bzMax, xs, n = 1e9, -1e9, 0.0, 0
for o in tyres:
    for p in verts(o):
        if p[1] > cut:
            continue
        bzMin = min(bzMin, p[2]); bzMax = max(bzMax, p[2]); xs += p[0]; n += 1
centerX = xs / n if n else 0.0

# pino e chapa pela FORMA  (measureKingpin)
zHi = z1
zLo = max(z0, zHi - KP_SEARCH_DEPTH)
janela = []
for o in meshes():
    if TYRE_RE.search(mats(o)):
        continue
    for p in verts(o):
        if abs(p[0]) > KP_HALF_X or p[2] < zLo or p[2] > zHi or p[1] > floorY:
            continue
        janela.append(p)
yMin = min(p[1] for p in janela)
low = [p for p in janela if p[1] <= yMin + 0.02]
kingpinX = (min(p[0] for p in low) + max(p[0] for p in low)) / 2
kingpinZ = (min(p[2] for p in low) + max(p[2] for p in low)) / 2
cell = {}
for p in janela:
    d = math.hypot(p[0] - kingpinX, p[2] - kingpinZ)
    if d <= PLATE_RING[0] or d >= PLATE_RING[1]:
        continue
    k = (round(p[0] / 0.05), round(p[2] / 0.05))
    if k not in cell or p[1] < cell[k]:
        cell[k] = p[1]
hist = {}
for y in cell.values():
    b = round(y * 500)
    hist[b] = hist.get(b, 0) + 1
bestBin = max(sorted(hist), key=lambda b: hist[b])
plateBottomY = bestBin / 500

# os FUROS pela forma  (measureKingpinStations)
cands = []
for o in meshes():
    pts = list(verts(o))
    bmin = (min(p[0] for p in pts), min(p[1] for p in pts), min(p[2] for p in pts))
    bmax = (max(p[0] for p in pts), max(p[1] for p in pts), max(p[2] for p in pts))
    if bmax[2] < zLo or bmin[2] > zHi or bmin[1] > floorY:
        continue
    sx, sz = bmax[0] - bmin[0], bmax[2] - bmin[2]
    r = max(sx, sz) / 2
    if r > KP_STATION_MAX_R or r < KP_STATION_MIN_R:
        continue
    if abs((bmin[0] + bmax[0]) / 2) > KP_HALF_X:
        continue
    cands.append({"cz": (bmin[2] + bmax[2]) / 2, "yMin": bmin[1],
                  "isPin": plateBottomY - bmin[1] >= KP_MIN_DROP})
cands.sort(key=lambda c: c["cz"])
groups = []
for c in cands:
    if groups and abs(c["cz"] - groups[-1][0]["cz"]) <= KP_STATION_CLUSTER:
        groups[-1].append(c)
    else:
        groups.append([c])
stations = [{"z": sum(c["cz"] for c in g) / len(g),
             "hasPin": any(c["isPin"] for c in g)} for g in groups]
stations.sort(key=lambda s: -s["z"])

# o THERMO KING — a peça que de fato chega perto da cabine
tk_path = os.path.join(ASSETS, 'models/vehicles/thermoking.glb')
tkDepth = 0.0
tkHalfWidth = 0.0
if os.path.exists(tk_path):
    load(tk_path)
    zmin, zmax = 1e9, -1e9
    for o in meshes():
        for p in verts(o):
            zmin = min(zmin, p[2]); zmax = max(zmax, p[2])
    # ⚠️ Profundidade do GLB CRU. No app, `state.tkDepth` é medido depois do
    # bloco de escala de `attachThermoKing()`; as duas batem em ~1 mm neste
    # acervo (0,451 m contra os 0,45 que a bancada mediu no engine), e é por isso
    # que a sonda pode usar esta. Se algum dia divergirem, quem manda é o engine.
    tkDepth = zmax - zmin
    xmin, xmax = 1e9, -1e9
    for o in meshes():
        for p in verts(o):
            xmin = min(xmin, p[0]); xmax = max(xmax, p[0])
    tkHalfWidth = (xmax - xmin) / 2

json.dump({
    "tkDepth": tkDepth,
    "tkHalfWidth": tkHalfWidth,
    "rearProfiles": rear,
    "rearLadders": ladders,
    "trailer": {
        "contactY": contactY, "centerX": centerX,
        "bogieZMin": bzMin, "bogieZMax": bzMax,
        "kingpinX": kingpinX, "kingpinZ": kingpinZ, "plateBottomY": plateBottomY,
        "pinDrop": plateBottomY - yMin,
        "floorY": floorY, "roofY": roofY, "frontWallZ": z1, "rearWallZ": z0,
        "width": max(wx) - min(wx), "length": z1 - z0,
        "stations": stations,
    },
}, open(OUT, 'w'), indent=1)
print('OK', len(rear), 'cavalos ·', len(stations), 'furos',
      [round(s["z"], 4) for s in stations])
