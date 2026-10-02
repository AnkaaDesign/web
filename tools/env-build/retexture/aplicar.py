"""Aplica as texturas regeneradas numa CÓPIA do set.glb (o original não é tocado).

Sempre parte do set.glb de web/public, então rodar de novo é idempotente.
Três operações:
  troca    — substitui os bytes de uma imagem existente (pelo nome da imagem)
  normal   — dá normalTexture a um material que não tinha
  variante — clona um material com outras texturas e o atribui a alguns nós
uso: aplicar.py SAIDA.glb
"""
import copy
import io
import json
import struct
import sys

from PIL import Image

SRC = '/home/kennedy/Documents/repositories/web/public/environments/distrito-industrial/set.glb'
R = '/home/kennedy/Pictures/truck-studio-texturas/'

# (nome da imagem no set.glb, arquivo, largura no app, qualidade webp)
TROCA = [
    ('IndustrialGeneric1D', R + 'predio-leste-MC03/novo/IndustrialGeneric1D_basecolor_2048x1024_v2.png', 2048, 90),
    ('IndustrialGeneric1N', R + 'predio-leste-MC03/novo/IndustrialGeneric1N_normal_2048x1024_v2.png', 2048, 96),
    ('suburbanFireDept', R + 'galpao-principal-marquise/novo/DL_hall_big_basecolor_2048x2048.png', 1024, 90),
    ('suburbanFireDeptDetails', R + 'galpao-principal-marquise/novo/DL_hall_det_basecolor_1024x1024.png', 1024, 90),
    ('smallWarehouse', R + 'galpao-pequeno/novo/DL_shed_sm_basecolor_2048x2048.png', 1024, 90),
    ('warehouse', R + 'galpoes-de-docas/novo/DL_dock_basecolor_2048x2048.png', 1024, 90),
    ('secuirityBooth', R + 'guarita/novo/DL_booth_basecolor_2048x2048.png', 1024, 90),
    ('Container_BaseColor', R + 'conteineres/novo/IBC_Container_A_azul_basecolor_1024x1024.png', 512, 90),
    ('Container_Normal', R + 'conteineres/novo/IBC_Container_A_azul_normal_512x512.png', 512, 96),
]
# (material, arquivo do normal, largura)
NORMAL = [
    ('DL_hall_big', R + 'galpao-principal-marquise/novo/DL_hall_big_normal_1024x1024.png', 1024),
    ('DL_hall_det', R + 'galpao-principal-marquise/novo/DL_hall_det_normal_1024x1024.png', 1024),
    ('DL_shed_sm', R + 'galpao-pequeno/novo/DL_shed_sm_normal_512x512.png', 512),
    ('DL_dock', R + 'galpoes-de-docas/novo/DL_dock_normal_512x512.png', 512),
    ('DL_booth', R + 'guarita/novo/DL_booth_normal_512x512.png', 512),
]
# material base, nome novo, {papel: (arquivo, largura, q)}, nós que recebem
VARIANTE = [
    ('IBC_Container', 'IBC_Container_B', {
        'cor': (R + 'conteineres/novo/IBC_Container_B_enferrujado_basecolor_1024x1024.png', 512, 90),
        'normal': (R + 'conteineres/novo/IBC_Container_B_enferrujado_normal_512x512.png', 512, 96),
    }, ['ibc00_026', 'ibc00_028', 'ibc00_030', 'ibc00_032']),
]


def webp(path, w, q):
    im = Image.open(path).convert('RGB')
    h = int(round(w * im.size[1] / im.size[0]))
    if im.size != (w, h):
        im = im.resize((w, h), Image.LANCZOS)
    b = io.BytesIO()
    im.save(b, 'WEBP', quality=q, method=6)
    return b.getvalue()


g = open(SRC, 'rb').read()
jl = struct.unpack('<I', g[12:16])[0]
j = json.loads(g[20:20 + jl])
bo = 20 + jl
bl = struct.unpack('<I', g[bo:bo + 4])[0]
BIN = g[bo + 8:bo + 8 + bl]
views = [BIN[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']] for v in j['bufferViews']]

img_por_nome = {im['name']: i for i, im in enumerate(j['images'])}
mat_por_nome = {m['name']: i for i, m in enumerate(j['materials'])}
log = []


def nova_imagem(nome, data):
    j['bufferViews'].append({'buffer': 0, 'byteLength': 0})
    views.append(data)
    j['images'].append({'bufferView': len(j['bufferViews']) - 1, 'mimeType': 'image/webp', 'name': nome})
    return len(j['images']) - 1


def nova_textura(modelo_tex, img):
    t = copy.deepcopy(j['textures'][modelo_tex])
    t['extensions'] = {'EXT_texture_webp': {'source': img}}
    t.pop('source', None)
    j['textures'].append(t)
    return len(j['textures']) - 1


for nome, arq, w, q in TROCA:
    i = img_por_nome[nome]
    antes = len(views[j['images'][i]['bufferView']])
    views[j['images'][i]['bufferView']] = webp(arq, w, q)
    log.append(f'troca    {nome:26s} {antes / 1024:7.0f} KB -> {len(views[j["images"][i]["bufferView"]]) / 1024:7.0f} KB  ({w} px)')

for mat, arq, w in NORMAL:
    m = j['materials'][mat_por_nome[mat]]
    assert 'normalTexture' not in m, mat
    base_tex = m['pbrMetallicRoughness']['baseColorTexture']['index']
    img = nova_imagem(mat + '_Normal', webp(arq, w, 96))
    m['normalTexture'] = {'index': nova_textura(base_tex, img)}
    log.append(f'normal   {mat:26s} novo normal map {w} px')

for base, novo, mapas, nos in VARIANTE:
    mi = mat_por_nome[base]
    m = copy.deepcopy(j['materials'][mi])
    m['name'] = novo
    if 'cor' in mapas:
        bt = m['pbrMetallicRoughness']['baseColorTexture']['index']
        img = nova_imagem(novo + '_BaseColor', webp(*mapas['cor']))
        m['pbrMetallicRoughness']['baseColorTexture'] = {'index': nova_textura(bt, img)}
    if 'normal' in mapas:
        nt = m['normalTexture']['index']
        img = nova_imagem(novo + '_Normal', webp(*mapas['normal']))
        m['normalTexture'] = dict(m['normalTexture'], index=nova_textura(nt, img))
    j['materials'].append(m)
    mn = len(j['materials']) - 1
    malha_nova = {}
    for n in j['nodes']:
        if n.get('name') not in nos:
            continue
        me = n['mesh']
        if me not in malha_nova:  # clona a malha (mesmos acessores) trocando o material
            c = copy.deepcopy(j['meshes'][me])
            c['name'] = c.get('name', 'mesh') + '_B'
            for p in c['primitives']:
                if p.get('material') == mi:
                    p['material'] = mn
            j['meshes'].append(c)
            malha_nova[me] = len(j['meshes']) - 1
        n['mesh'] = malha_nova[me]
    log.append(f'variante {novo:26s} em {len(nos)} nós: {", ".join(nos)}')


# ---- LAYOUT: troca de lugar e escala (layout.json: nome -> [x, z, rot_graus]) ----
import math
import numpy as np
LAYOUT = json.load(open(__import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), 'layout.json')))
ESCALA = {'DL_skip': 1.7, 'skip_035': 1.7}
CHAO = ('yard', 'turf', 'road_', 'svc_0', 'gutters', 'median', 'grass_patches', 'out_', 'outer', 'rb_')


def _acc(ai):
    a = j['accessors'][ai]
    v = views[a['bufferView']]
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[a['type']]
    dt = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[a['componentType']]
    return np.frombuffer(v, dtype=dt, count=a['count'] * n, offset=a.get('byteOffset', 0)).reshape(a['count'], n)


_tris = []
for n in j['nodes']:
    if 'mesh' in n and n.get('name', '').startswith(CHAO) and not n.get('translation') and not n.get('rotation'):
        for p in j['meshes'][n['mesh']]['primitives']:
            P = _acc(p['attributes']['POSITION']).astype(np.float64)
            _tris.append(P[_acc(p['indices']).reshape(-1, 3)])
_tris = np.concatenate(_tris)
_a, _b, _c = _tris[:, 0], _tris[:, 1], _tris[:, 2]


def chao_y(x, z):
    """Topo do chão em (x, z): o maior y entre os triângulos de chão que contêm o ponto."""
    v0 = _c[:, [0, 2]] - _a[:, [0, 2]]
    v1 = _b[:, [0, 2]] - _a[:, [0, 2]]
    v2 = np.array([x, z]) - _a[:, [0, 2]]
    d00 = (v0 * v0).sum(1); d01 = (v0 * v1).sum(1); d11 = (v1 * v1).sum(1)
    d20 = (v2 * v0).sum(1); d21 = (v2 * v1).sum(1)
    den = d00 * d11 - d01 * d01
    ok = np.abs(den) > 1e-12
    u = np.where(ok, (d11 * d20 - d01 * d21) / np.where(ok, den, 1), -1)
    v = np.where(ok, (d00 * d21 - d01 * d20) / np.where(ok, den, 1), -1)
    dentro = (u >= -1e-6) & (v >= -1e-6) & (u + v <= 1 + 1e-6)
    if not dentro.any():
        return None
    y = _a[:, 1] + u * (_c[:, 1] - _a[:, 1]) + v * (_b[:, 1] - _a[:, 1])
    return float(y[dentro].max())


def _qy(graus):
    r = math.radians(graus) / 2
    return [0.0, math.sin(r), 0.0, math.cos(r)]


for n in j['nodes']:
    nome = n.get('name')
    if nome not in LAYOUT:
        continue
    x, z, rot = LAYOUT[nome]
    sc = ESCALA.get(nome, 1.0)
    mn = [1e9] * 3; mx = [-1e9] * 3
    for p in j['meshes'][n['mesh']]['primitives']:
        a = j['accessors'][p['attributes']['POSITION']]
        mn = [min(m, v) for m, v in zip(mn, a['min'])]; mx = [max(m, v) for m, v in zip(mx, a['max'])]
    q = _qy(rot)
    cs = []
    for fx in np.linspace(0, 1, 7):
        for fz in np.linspace(0, 1, 7):
            lx = (mn[0] + fx * (mx[0] - mn[0])) * sc
            lz = (mn[2] + fz * (mx[2] - mn[2])) * sc
            c, s_ = math.cos(math.radians(rot)), math.sin(math.radians(rot))
            cs.append((x + c * lx + s_ * lz, z - s_ * lx + c * lz))
    ys = [y for y in (chao_y(px, pz) for px, pz in cs) if y is not None]
    y0 = min(ys) - 0.06 if sc == 1.0 else min(ys) - 0.02 - mn[1] * sc
    antes = (n.get('translation'), n.get('rotation'), n.get('scale'))
    n['translation'] = [x, y0, z]
    n['rotation'] = q
    if sc != 1.0:
        n['scale'] = [sc, sc, sc]
    log.append(f'layout   {nome:26s} ({antes[0][0]:.1f}, {antes[0][2]:.1f}) -> ({x:.1f}, {z:.1f}) rot {rot} escala {sc}  '
               f'chão {min(ys):+.3f}..{max(ys):+.3f} m')

nb = bytearray()
for v, data in zip(j['bufferViews'], views):
    while len(nb) % 4:
        nb.append(0)
    v['byteOffset'] = len(nb)
    v['byteLength'] = len(data)
    nb += data
while len(nb) % 4:
    nb.append(0)
j['buffers'][0]['byteLength'] = len(nb)
js = json.dumps(j, separators=(',', ':')).encode()
while len(js) % 4:
    js += b' '
out = (struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(nb)) + struct.pack('<I', len(js)) + b'JSON' + js
       + struct.pack('<I', len(nb)) + b'BIN\x00' + bytes(nb))
open(sys.argv[1], 'wb').write(out)
print('\n'.join(log))
print(f'set.glb {len(g) / 1048576:.1f} MB -> {len(out) / 1048576:.1f} MB')
