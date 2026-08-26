"""Assa `wheel_vm.glb` — UMA roda do Volvo VM 2015, normalizada.

POR QUE UMA SEGUNDA RODA, E POR QUE ESTA
==============================================================================
*"troca todas as rodas dos 3 modelos de sobrechassi para usar as rodas desse
volvo, que sao as melhores desenhadas [...] enquanto dos outros sao muito mal
feitas"* — Kennedy, 2026-08-20, com foto da dianteira do VM.

`bake_wheel.py`, ao lado, assa a roda do FH16 e serve ao IMPLEMENTO. Esta serve
aos tres CHASSIS RIGIDOS (Volvo VM, Scania P, VW Constellation), e o alvo e
outro: o VM traz aro de aluminio polido de 10 furos com cubo e porcas
separados, e os outros dois trazem aro chapado de material unico.

O QUE MUDA EM RELACAO AO IRMAO — nada de recorte
==============================================================================
No FH16 as rodas chegam MESCLADAS POR MATERIAL (uma malha com os pneus dos dois
eixos e dos dois lados), e por isso aquele script recorta por posicao de face.
No VM nao: cada roda e um conjunto de nos PROPRIOS —

    wheel_f_0_0_f_{disc,hub,nuts,tire}_pN   dianteira esquerda, roda avulsa
    wheel_r_0_0_r_{disc,hub,nuts,tire}_pN   traseira esquerda, rodado DUPLO

Medido no `volvo_vm_2015_6x2r.glb` (espaco cru do glTF, Y-up):

    dianteira   x -1,226 … -0,856   Ø pneu 1,055   largura 0,308  (simples)
    traseira    x -1,269 … -0,627   Ø pneu 1,056   largura 0,611  (dupla)

Entao aqui a extracao e por NOME DE NO, e a unica coisa que sobra do irmao e a
NORMALIZACAO — que e o contrato com o engine e nao muda:

  · centro do CUBO na origem;
  · eixo de rotacao em +X, FACE EXTERNA para +X (giro de 180 graus, nunca
    espelho: espelhar inverte o enrolamento e a roda aparece pelo avesso);
  · diametro do PNEU exatamente 1,0.

⚠️ O CRITERIO DE LADO E MEDIDO, NAO SUPOSTO. A face externa e ONDE O DISCO
ESTA — ele e a tampa da roda e o pneu se distribui em volta. O irmao registra
o dia em que essa afirmacao foi feita ao contrario e a roda saiu montada pelo
avesso sem ninguem perceber; a conferencia no fim deste arquivo e a mesma.

MATERIAIS — renomeados, e o acabamento NAO se resolve aqui
==============================================================================
Os nomes do rip (`wheel_f_0_0_f_disc_mat_0002_steel_clean_114`) nao dizem nada
a ninguem. Renomeando:

    pneu-vm / pneu-vm-flanco           casa `^pneu` (env 0,3 no caminho do
                                       implemento) e e o que o engine mede
    roda-disco-vm / -escuro            aro de aluminio e a parte preta dele
    roda-cubo-vm-{dianteiro,traseiro}  as duas calotas
    roda-porcas-vm / -sombra           as porcas e o decalque de sombra delas

⚠️ **METALICIDADE E RUGOSIDADE NAO SAO ESCRITAS AQUI.** O rip entrega porcas e
cubo com metalicidade ZERO (o nome do material das porcas e literalmente
`white_crome`) e pneu com rugosidade 0,133 — o que o dono viu como *"os
parafusos nao estao metalicos como deveriam, nem a parte central, e os pneus
estao brilhando muito"*. O conserto mora em `engine/vehicle/truck-wheels.ts`,
com os numeros ao lado do porque, por dois motivos: um valor escrito aqui vira
um numero sem historia dentro de um binario, e o mesmo asset serve aos tres
chassis — ha um lugar so para acertar, e ele e o que o revisor le.

USO
==============================================================================
    blender -b --python tools/wheel-bake/bake_wheel_vm.py -- \\
        public/models/trucks/volvo_vm_2015_6x2r.glb \\
        public/models/vehicles/wheel_vm_v1.glb
"""
import bpy
import sys
import math
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, DST = argv[0], argv[1]

# (no de origem, nome de material de destino). Um no = uma peca de UMA roda.
SINGLE = [
    ('wheel_f_0_0_f_disc_p0', 'roda-disco-vm'),
    ('wheel_f_0_0_f_disc_p1', 'roda-disco-vm-escuro'),
    ('wheel_f_0_0_f_hub_p1', 'roda-cubo-vm-dianteiro'),
    ('wheel_f_0_0_f_nuts_p0', 'roda-porcas-vm'),
    ('wheel_f_0_0_f_nuts_p1', 'roda-porcas-vm-sombra'),
    ('wheel_f_0_0_f_tire_p3', 'pneu-vm'),
    ('wheel_f_0_0_f_tire_p2', 'pneu-vm-flanco'),
]
DUAL = [
    ('wheel_r_0_0_r_disc_p0', 'roda-disco-vm'),
    ('wheel_r_0_0_r_disc_p1', 'roda-disco-vm-escuro'),
    ('wheel_r_0_0_r_hub_p1', 'roda-cubo-vm-traseiro'),
    ('wheel_r_0_0_r_nuts_p0', 'roda-porcas-vm'),
    ('wheel_r_0_0_r_nuts_p1', 'roda-porcas-vm-sombra'),
    ('wheel_r_0_0_r_tire_p1', 'pneu-vm'),
    ('wheel_r_0_0_r_tire_p2', 'pneu-vm-flanco'),
]


def log(*a):
    print('[bake-vm]', *a)


def solo(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def pick(src_name, mat_name, tag):
    """Duplica `src_name` inteiro e achata a hierarquia.

    ⚠️ `src.copy()` PRESERVA O PAI, e o importador glTF pendura tudo num no de
    conversao Y-up -> Z-up. Sem soltar o pai e reescrever `matrix_world`, o
    `transform_apply` abaixo assa a conversao duas vezes. E a mesma armadilha
    que o `carve()` do irmao documenta.
    """
    src = bpy.data.objects.get(src_name)
    if src is None:
        raise SystemExit(f'{tag}: no `{src_name}` nao existe no arquivo de origem')
    dup = src.copy()
    dup.data = src.data.copy()
    dup.name = f'{tag}__{mat_name}'
    bpy.context.scene.collection.objects.link(dup)
    mw = src.matrix_world.copy()
    dup.parent = None
    dup.matrix_world = mw

    solo(dup)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    me = dup.data
    if me.materials:
        me.materials[0].name = mat_name
    log(f'  {tag}/{mat_name}: {len(me.polygons)} faces, {len(me.vertices)} verts')
    return dup


def world_bounds(objs):
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            for k in range(3):
                lo[k] = min(lo[k], w[k])
                hi[k] = max(hi[k], w[k])
    return lo, hi


def build(parts, tag):
    objs = [pick(n, m, tag) for (n, m) in parts]
    objs = [o for o in objs if o.data.polygons]
    if len(objs) != len(parts):
        raise SystemExit(f'{tag}: alguma peca saiu vazia')

    # O CUBO manda no centro: e ele que esta sobre o eixo de rotacao nos tres
    # eixos. O pneu da a escala; disco e porcas seguem.
    hub = next(o for o in objs if 'roda-cubo-vm' in o.name)
    tyre = next(o for o in objs if o.name.endswith('pneu-vm'))
    disc = next(o for o in objs if o.name.endswith('roda-disco-vm'))
    hlo, hhi = world_bounds([hub])
    centre = (hlo + hhi) / 2
    tlo, thi = world_bounds([tyre])
    dlo, dhi = world_bounds([disc])
    # Diametro pelos DOIS eixos radiais (Y e Z): num solido de revolucao sao o
    # mesmo numero, e a media absorve o ruido de quantizacao do Draco.
    diameter = ((thi.y - tlo.y) + (thi.z - tlo.z)) / 2

    # ⚠️ O LADO SAI DO SINAL DE X NA ORIGEM, e nao de "onde o disco esta".
    #
    # O irmao usa disco-contra-pneu, e naquele rip funciona. AQUI NAO: no rodado
    # DUPLO o `r_disc` e uma malha so com os aros das DUAS rodas, entao o centro
    # dele cai a 4 mm do centro do pneu — o teste vira ruido. E o cubo, que
    # seria o outro candidato, e o cubo DO EIXO e mora entre os dois pneus.
    #
    # O que nao e ambiguo: as pecas escolhidas la em cima sao as da roda
    # ESQUERDA (`wheel_f_0_0` / `wheel_r_0_0`, x < 0 no arquivo), e numa roda
    # esquerda a face externa olha para -X. Entao o giro e incondicional — e a
    # verificacao e que o lado seja mesmo esse, falhando alto se um re-bake
    # trocar a numeracao dos nos.
    disc_cx = (dlo.x + dhi.x) / 2
    tyre_cx = (tlo.x + thi.x) / 2
    if tyre_cx >= 0:
        raise SystemExit(
            f'{tag}: o pneu escolhido esta em x {tyre_cx:+.4f} — os nos da lista '
            'deixaram de ser os da roda ESQUERDA. Bake abortado.')
    flip = True
    log(f'{tag}: centro do cubo {tuple(round(v, 4) for v in centre)} · '
        f'Ø pneu {diameter:.4f} m · largura {thi.x - tlo.x:.4f} m · '
        f'pneu em x {tyre_cx:+.4f} (esquerda) · disco em {disc_cx:+.4f} → gira 180°')

    for o in objs:
        solo(o)
        for v in o.data.vertices:
            v.co = v.co - centre
        # ⚠️ `rotation_mode`: o importador glTF deixa os objetos em QUATERNION, e
        # num objeto assim escrever `rotation_euler` NAO FAZ NADA. Era isso que
        # engolia o giro do irmao sem uma linha de erro.
        o.rotation_mode = 'XYZ'
        o.rotation_euler = (0, 0, math.pi if flip else 0)
        o.scale = (1 / diameter,) * 3
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # CONFERE, e falha alto se a roda tiver saido pelo avesso. O criterio NAO e
    # "o disco alcanca a face externa do pneu": medido nesta roda, o flanco do
    # pneu sai 24 mm por fora da aba do aro, que e o que um pneu faz. O criterio
    # e que o aro esteja na METADE EXTERNA — montado ao contrario ele estaria
    # inteiro do outro lado, a meia largura de rodado de distancia.
    dlo, dhi = world_bounds([disc])
    tlo, thi = world_bounds([tyre])
    if dhi.x < (tlo.x + thi.x) / 2:
        raise SystemExit(
            f'{tag}: aro ate x {dhi.x:+.4f}, todo na metade INTERNA do pneu '
            f'({tlo.x:+.4f}…{thi.x:+.4f}) — a roda saiu pelo avesso. Bake abortado.')

    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    unit = bpy.context.view_layer.objects.active
    unit.name = tag

    lo, hi = world_bounds([unit])
    log(f'{tag}: normalizado → min {tuple(round(v, 4) for v in lo)} '
        f'max {tuple(round(v, 4) for v in hi)} · '
        f'aro ate x {dhi.x:+.4f}, pneu ate {thi.x:+.4f} '
        f'(flanco {1000 * (thi.x - dhi.x) * diameter:.0f} mm por fora do aro ✓)')
    return unit


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
log('importado', SRC)

keep = {build(DUAL, 'WHEEL_DUAL'), build(SINGLE, 'WHEEL_SINGLE')}
for o in list(bpy.data.objects):
    if o not in keep:
        bpy.data.objects.remove(o, do_unlink=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=DST,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_image_format='WEBP',
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_draco_position_quantization=16,
    export_draco_normal_quantization=12,
    export_draco_texcoord_quantization=14,
    export_cameras=False,
    export_lights=False,
)
log('exportado', DST)
