"""Assa `wheel_fh16.glb` — UMA roda do Volvo FH16 2012, normalizada.

POR QUE ESTE SCRIPT EXISTE
==============================================================================
O implemento traz a rodagem em 14 nós que reusam a MESMA malha: `pneu-corpo`
tem 44 593 vértices e `aro-rodas` 18 948, o que dá ~920 k vértices só de roda —
e o aro não tem textura NEM UV (é um disco cinza chapado, e ainda cai no
`TRAILER_STRUCT_METAL_RE` de models.ts, que o força a `roughness ≥ 0.62`). É ele
que lê como falso, não o pneu: o pneu do implemento tem base+MR+normal+AO em
1024², melhor que os 512² do Volvo.

O FH16, por outro lado, traz disco, cubo, porcas e pneu como peças separadas,
cada uma com cor e normal próprios. O que se quer é essa roda, instanciada.

O QUE O RIP ENTREGA, E POR QUE A EXTRAÇÃO É POR POSIÇÃO
==============================================================================
As rodas chegam MESCLADAS POR MATERIAL: `wheel_f_0_0_ftire_p0` é uma malha só
com os pneus dos dois eixos e dos dois lados. E a malha não é soldada — separar
por partes soltas devolve 5409 cacos, não 4 rodas. Mas uma roda é um sólido de
revolução em torno do eixo lateral, então ela é identificada pelo par
(x do eixo, y longitudinal), e é assim que este script recorta: mantém as faces
cujo CENTRO cai na caixa da roda pedida e apaga o resto.

Medido no `volvo_fh16_2012_4x2.glb` (coordenadas Blender, Z-up):

    eixo dianteiro  y = +1.793   pneu SIMPLES, largura 0.312
    eixo traseiro   y = -2.032   pneu DUPLO,   largura 0.627

O implemento é 3 eixos de rodado DUPLO (12 pneus a x ±1.11 / ±0.77, passo entre
eixos 1.252 m) mais 2 estepes deitados. Então saem DOIS objetos:

    WHEEL_DUAL    conjunto traseiro do FH16 (rdisc + rhub + porcas + par de
                  pneus) — vai nas 6 posições de rodado duplo
    WHEEL_SINGLE  conjunto dianteiro (fdisc + fhub + porcas + 1 pneu) — vai nos
                  2 estepes, que são roda avulsa

NORMALIZAÇÃO — o contrato com o engine
==============================================================================
Os dois objetos saem com:

  · centro do CUBO na origem;
  · eixo de rotação em +X, com a FACE EXTERNA olhando para +X. O Volvo tem a
    roda extraída do lado esquerdo (x < 0, face externa para −X), então ela é
    girada 180° em torno do eixo vertical. Giro, não espelhamento: espelhar
    inverteria a ordem de enrolamento e a roda apareceria pelo avesso onde
    algum material deixar de ser `doubleSided`;
  · diâmetro do PNEU exatamente 1.0.

Com isso o engine não precisa saber nada da geometria: ele mede o diâmetro do
pneu do implemento, usa esse número como escala uniforme, e orienta a instância
pelo eixo que mediu (X nas 12 de rodagem, Y nos estepes deitados).

MATERIAIS — renomeados de propósito
==============================================================================
`applyTrailerFinish()` em models.ts despacha por NOME de material. Os nomes do
rip (`wheel_r_0_rdisc_mat_0000_...`) não casam nada, o que deixaria o pneu com
`envMapIntensity` 1.35 espelhando o céu como plástico polido. Renomeando:

    pneu-fh16          casa `^pneu` em TRAILER_RUBBER_RE  → env 0.3
    roda-disco-fh16    não casa nada                      → fica com os mapas
    roda-cubo-fh16     idem
    roda-porcas-fh16   idem

Nenhum deles casa `TRAILER_STRUCT_METAL_RE` (`galvanizado|estrutura-principal|
^inox|metal-pouco-polido|metal-claro|^aro-rodas`), que é justamente o que
achatava o aro original.
"""
import bpy
import bmesh
import sys
import math
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, DST = argv[0], argv[1]

# (objeto de origem, centro x, centro y) de cada peça, medidos por inspect_wheel.py
DUAL = [
    ('wheel_r_0_rdisc_p1', -1.103, -2.032, 'roda-disco-fh16'),
    ('wheel_r_0_rhub_p1', -0.997, -2.032, 'roda-cubo-fh16'),
    ('wheel_f_0_0_fnuts_p0', -0.985, -2.032, 'roda-porcas-fh16'),
    ('wheel_f_0_0_ftire_p0', -0.922, -2.032, 'pneu-fh16'),
]
SINGLE = [
    ('wheel_f_0_0_fdisc_p1', -1.165, 1.793, 'roda-disco-fh16'),
    ('wheel_f_0_0_fhub_p1', -1.189, 1.793, 'roda-cubo-fh16'),
    ('wheel_f_0_0_fnuts_p0', -1.225, 1.793, 'roda-porcas-fh16'),
    ('wheel_f_0_0_ftire_p0', -1.013, 1.793, 'pneu-fh16'),
]
# Meia-janela do recorte. 0.45 em X separa os dois lados (que distam ~2.0 m) e
# 0.70 em Y separa os dois eixos (que distam 3.8 m), com folga larga para os dois.
HALF_X, HALF_Y = 0.45, 0.70


def log(*a):
    print('[bake]', *a)


def solo(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def carve(src_name, cx, cy, mat_name, tag):
    """Duplica `src_name` e apaga tudo que não é a roda em (cx, cy).

    Por `bmesh`, e não pelos operadores de edit-mode. A primeira versão marcava
    `polygon.select` em modo objeto e chamava `mesh.select_mode(type='FACE')`
    seguido de `mesh.delete`: o `select_mode` RECALCULA a seleção de face a
    partir da de vértice, que vem do importador com tudo marcado, então a
    máscara de face era jogada fora e o objeto inteiro sumia. Foi o que deixou o
    `rdisc` com 0 faces enquanto o cubo, as porcas e o pneu passavam.

    O recorte também parte do mundo ACHATADO: `src.copy()` preserva o pai, e o
    importador glTF pendura tudo num nó de conversão Y-up→Z-up. Comparar
    `polygon.center` (local) com números medidos em mundo compara referenciais
    diferentes.
    """
    src = bpy.data.objects[src_name]
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
    bm = bmesh.new()
    bm.from_mesh(me)
    doomed = []
    for f in bm.faces:
        c = f.calc_center_median()
        if abs(c.x - cx) > HALF_X or abs(c.y - cy) > HALF_Y:
            doomed.append(f)
    bmesh.ops.delete(bm, geom=doomed, context='FACES')
    bm.to_mesh(me)
    bm.free()
    me.update()

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
    objs = [carve(n, cx, cy, m, tag) for (n, cx, cy, m) in parts]
    objs = [o for o in objs if o.data.polygons]
    if len(objs) != len(parts):
        raise SystemExit(f'{tag}: alguma peça saiu vazia do recorte')

    # O CUBO manda no centro: ele é o que está no eixo de rotação em todos os
    # três eixos. O pneu serve de escala, e o disco/porcas seguem.
    hub = next(o for o in objs if o.name.endswith('roda-cubo-fh16'))
    tyre = next(o for o in objs if o.name.endswith('pneu-fh16'))
    disc = next(o for o in objs if o.name.endswith('roda-disco-fh16'))
    hlo, hhi = world_bounds([hub])
    centre = (hlo + hhi) / 2
    tlo, thi = world_bounds([tyre])
    dlo, dhi = world_bounds([disc])
    # diâmetro pelos DOIS eixos radiais (Y e Z), que num sólido de revolução são
    # o mesmo número — a média absorve o ruído de quantização do Draco.
    diameter = ((thi.y - tlo.y) + (thi.z - tlo.z)) / 2

    # PARA QUE LADO A RODA OLHA — MEDIDO, NÃO SUPOSTO.
    # A primeira versão daqui afirmava "a roda extraída é a do lado esquerdo,
    # logo a face externa aponta para −X" e girava 180° incondicionalmente. Duas
    # coisas deram errado de uma vez: a afirmação valia, mas o giro NÃO ACONTECIA
    # (ver `unit.rotation_mode` abaixo) — e ninguém percebeu, porque nada aqui
    # conferia o resultado. A roda saiu montada ao contrário: o disco enterrado
    # para dentro do rodado e, de fora, o vazio do aro.
    # O critério certo não depende de que lado o rip guardou: a face externa é
    # ONDE O DISCO ESTÁ. Ele é a tampa da roda; o pneu se distribui em volta.
    disc_cx = (dlo.x + dhi.x) / 2
    tyre_cx = (tlo.x + thi.x) / 2
    flip = disc_cx < tyre_cx
    log(f'{tag}: centro do cubo {tuple(round(v, 4) for v in centre)} · '
        f'Ø pneu {diameter:.4f} m · largura {thi.x - tlo.x:.4f} m · '
        f'disco em x {disc_cx:+.4f} vs pneu em {tyre_cx:+.4f} → '
        f'{"gira 180°" if flip else "já olha para +X"}')

    for o in objs:
        solo(o)
        for v in o.data.vertices:
            v.co = v.co - centre
        # `rotation_mode`: o importador glTF deixa os objetos em QUATERNION, e
        # num objeto assim escrever `rotation_euler` NÃO FAZ NADA — o Blender lê
        # `rotation_quaternion`. Era isso que engolia o giro sem uma linha de
        # erro. A escala passava porque `scale` é o mesmo campo nos dois modos.
        o.rotation_mode = 'XYZ'
        o.rotation_euler = (0, 0, math.pi if flip else 0)
        o.scale = (1 / diameter,) * 3
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # CONFERE, e falha alto se não bater. Numa roda montada certo a borda do
    # disco alcança a face externa do pneu (é a tampa dela); montada ao
    # contrário, o disco fica atrás de toda a largura do rodado.
    dlo, dhi = world_bounds([disc])
    tlo, thi = world_bounds([tyre])
    if dhi.x <= thi.x - 0.02:
        raise SystemExit(
            f'{tag}: disco em x ≤ {dhi.x:.4f} contra pneu até {thi.x:.4f} — '
            'a roda ficaria montada ao contrário. Bake abortado.')

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
        f'disco até x {dhi.x:+.4f}, pneu até {thi.x:+.4f} (disco por fora ✓)')
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
