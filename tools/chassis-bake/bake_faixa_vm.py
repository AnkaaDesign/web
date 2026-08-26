"""Assa `faixa_refletiva_vm_v1.glb` — a faixa refletiva traseira do Volvo VM.

POR QUE
==============================================================================
*"a faixa refletiva da traseira deve ser do volvo, em todos, inclusive do
Scania"* — Kennedy, 2026-08-22.

Os TRES rigidos do acervo tem faixa traseira, e as tres sao diferentes:

    Volvo VM   `chassis_p4`   100 v · 2,124 x 0,099 m · tex `faixas_refletivas`
                              1024x1024 COM ALFA — atlas 3M de verdade, com
                              microprisma, "APROVADO DENATRAN" e a marca 3M
    Scania P   `chassis_p38`  150 v · 2,389 x 0,109 m · tex `refletivas`
                              4096x256, chevron Avery Dennison de passo fino
    VW Titan   `truck_p56`     18 v · 2,568 x 0,115 m · tex `faixa` 1024x256

A do VM e a unica com atlas de fita real (as outras duas sao uma tira chapada
esticada), e e a que o dono escolheu para os tres.

⚠️ E O GANHO NAO E SO DE TEXTURA. `retroreflect.ts` instala retrorreflexao por
NOME DE MATERIAL (`FITA_RE = /faixa.?3m|retro.?reflet|reflective.?tape|
conspicuity/i`), e NENHUM dos tres nomes de rip casa — `faixas_refletivas`,
`refletivas` e `faixa.002` passam batido. Ou seja: hoje a faixa traseira dos
tres rigidos NAO retrorreflete, enquanto a do implemento reflete. O material
sai daqui batizado `Faixa-3M-traseira`, que casa, e a faixa passa a acender no
farol como a do bau.

⚠️⚠️ A PLACA E ACHATADA AQUI, E ESSE E O CONSERTO DE 2026-08-22 (2a passada)
==============================================================================
*"a faixa do scania esta errado"* — e a causa era GEOMETRICA, nao de textura.

A faixa do VM nao e uma placa vertical: ela tem **1,684° de inclinacao propria**
(a face de cima recua 2,9 mm em 99 de altura), porque a barra do VM e inclinada.
As tres barras tem inclinacoes DIFERENTES, medidas na face de frente:

    Volvo VM   2,9 mm em 99 mm   =  1,68°
    VW Titan   5,2 mm em 114     =  2,61°
    Scania P   ~1 mm em 90       =  0,64°  (praticamente plana)

Ancorada pela borda de BAIXO na face da barra do Scania, a placa inclinada
afunda: no topo ela fica 2,6 mm ATRAS da chapa, e o renderizador come 2/3 da
faixa. Na captura sobravam duas tirinhas — a de cima e a de baixo — com preto no
meio, que foi exatamente o que o dono viu.

Entao o molde sai DAQUI **vertical**: mede-se a inclinacao pela face da frente
(o vertice mais avancado da fatia de baixo contra o da fatia de cima) e gira-se
em torno de X ate zera-la. Quem cuida do resto e o motor, que assenta a placa
uma margem A FRENTE do ponto mais avancado da faixa nativa — ver `MARGEM` em
`rear-tape.ts`. Placa vertical + margem = a faixa fica proud entre 3 e 8 mm nos
tres caminhoes, e isso e o que uma fita colada numa barra realmente e.

NORMALIZACAO — o contrato com `swapRearTape()`
==============================================================================
A peca sai com:

  · LARGURA exatamente 1,0 e centrada em x — entao a escala e a largura que o
    motor mede na faixa que ele vai substituir;
  · BORDA DE BAIXO em y = 0;
  · FACE DE TRAS em z = 0, com a espessura crescendo para −z (para a frente do
    caminhao, ja que no rip a traseira e +z).

⚠️ A ESCALA E UNIFORME, e isso e medido, nao suposto: a razao altura/largura
das tres faixas e 0,0466 (VM), 0,0456 (Scania) e 0,0448 (VW) — 4 % de espalho.
Escalar pela largura entrega a altura certa dentro desses 4 %, e uma escala
nao-uniforme distorceria o passo do chevron nos dois eixos de forma diferente.

USO
==============================================================================
    blender -b --factory-startup --python tools/chassis-bake/bake_faixa_vm.py -- \\
        public/models/trucks/volvo_vm_2015_6x2r.glb \\
        public/models/vehicles/faixa_refletiva_vm_v1.glb

⚠️ O SUFIXO `_v1` E IMUTAVEL — `/studio-assets/v1/` sai da API com
`Cache-Control: immutable`. Ver o bloco de `WHEEL_ASSET` em `models.ts`.
"""
import bpy
import math
import sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, DST = argv[0], argv[1]

NO = 'chassis_p4'
MAT = 'Faixa-3M-traseira'
TAG = 'FAIXA_TRASEIRA'
# Conferencias — os numeros medidos no rip.
LARG = (2.00, 2.30)
ALT = (0.06, 0.18)
ESP_MAX = 0.030
# Residuo aceito depois de achatar.
NIVEL_RESIDUO = math.radians(0.3)


def log(*a):
    print('[bake-faixa]', *a)


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
log('importado', SRC)

src = bpy.data.objects.get(NO)
if src is None:
    raise SystemExit(f'no `{NO}` nao existe em {SRC}')

# ⚠️ `src.copy()` PRESERVA O PAI, e o importador glTF pendura tudo num no de
# conversao Y-up -> Z-up. Mesma armadilha dos outros bakes desta base.
dup = src.copy()
dup.data = src.data.copy()
dup.name = TAG
bpy.context.scene.collection.objects.link(dup)
mw = src.matrix_world.copy()
dup.parent = None
dup.matrix_world = mw
bpy.ops.object.select_all(action='DESELECT')
dup.select_set(True)
bpy.context.view_layer.objects.active = dup
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

lo = Vector((1e9,) * 3)
hi = Vector((-1e9,) * 3)
for v in dup.data.vertices:
    for k in range(3):
        lo[k] = min(lo[k], v.co[k])
        hi[k] = max(hi[k], v.co[k])
# Blender Z-up: X lateral · Y = -z do glTF (longitudinal) · Z = altura.
larg, alt, esp = hi.x - lo.x, hi.z - lo.z, hi.y - lo.y
log(f'{NO}: {len(dup.data.vertices)} v · {len(dup.data.polygons)} faces · '
    f'{larg:.3f} x {alt:.3f} x {esp:.4f} m')
if not (LARG[0] <= larg <= LARG[1]) or not (ALT[0] <= alt <= ALT[1]) or esp > ESP_MAX:
    raise SystemExit(f'{NO} nao tem forma de faixa ({larg:.3f} x {alt:.3f} x {esp:.4f}). '
                     'O rip mudou. Bake abortado.')

def inclinacao(obj):
    """Quanto a FACE DA FRENTE recua da borda de baixo para a de cima.

    Blender Z-up: X lateral, Y longitudinal (a face da frente e o MENOR y,
    porque a traseira do caminhao e +z no glTF e glTF z = -Blender y), Z altura.

    ⚠️ O AJUSTE E POR MINIMOS QUADRADOS SOBRE **TODOS** OS VERTICES, e as duas
    tentativas anteriores erraram por nao ver que a peca e uma CHAPA SEM
    ESPESSURA. Medido: a caixa da faixa tem 2,9 mm em y — e a INCLINACAO
    sozinha ja vale 2,9 mm em 99 de altura. Ou seja a espessura e ~0 e todo o
    espalho em y E a inclinacao.

    A 1a versao mediu por `min(y)` de duas fatias de borda e sobrou 0,326°: nas
    bordas a chapa dobra, e o vertice mais avancado da fatia e o da dobra. A 2a
    tentou selecionar "a face" por uma fracao da espessura — e como a espessura
    e a propria inclinacao, isso selecionou o TERCO DE BAIXO da chapa e o
    residuo foi a 3,232°. Numa chapa plana o ajuste certo e sobre a chapa
    inteira.
    """
    face = [(v.co.z, v.co.y) for v in obj.data.vertices]
    if len(face) < 4:
        raise SystemExit(f'so {len(face)} vertices — nao da para ajustar')
    n = len(face)
    sz = sum(p[0] for p in face); sy = sum(p[1] for p in face)
    szz = sum(p[0] * p[0] for p in face); szy = sum(p[0] * p[1] for p in face)
    den = n * szz - sz * sz
    if abs(den) < 1e-12:
        return 0.0, n
    return (n * szy - sz * sy) / den, n


ang, nface = inclinacao(dup)
if abs(ang) > 1e-6:
    a = math.atan(ang)
    ys = [v.co.y for v in dup.data.vertices]
    zs = [v.co.z for v in dup.data.vertices]
    py, pz = (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2
    c, sn = math.cos(a), math.sin(a)
    for v in dup.data.vertices:
        dy, dz = v.co.y - py, v.co.z - pz
        v.co.y = py + dy * c - dz * sn
        v.co.z = pz + dy * sn + dz * c
    dup.data.update()
    resto, _ = inclinacao(dup)
    if abs(math.atan(resto)) > NIVEL_RESIDUO:
        raise SystemExit(f'a faixa sobrou com {math.degrees(math.atan(resto)):.3f}° depois de '
                         'achatar — a peca nao e uma placa. Bake abortado.')
    log(f'achatada — era {math.degrees(a):+.3f}° ({nface} vertices), sobrou '
        f'{math.degrees(math.atan(resto)):+.4f}°')
else:
    log('ja estava vertical')

# recalcula a caixa depois do giro
lo = Vector((1e9,) * 3)
hi = Vector((-1e9,) * 3)
for v in dup.data.vertices:
    for k in range(3):
        lo[k] = min(lo[k], v.co[k])
        hi[k] = max(hi[k], v.co[k])
larg = hi.x - lo.x

# O DATUM: centro em x · borda de baixo em z(blender) · face de TRAS em y.
# No rip a traseira do caminhao e +z do glTF, que em Blender e −y. A face de
# tras e portanto o MENOR y, e a espessura cresce para +y (a frente).
datum = Vector(((lo.x + hi.x) / 2, lo.y, lo.z))
for v in dup.data.vertices:
    v.co = (v.co - datum) / larg
dup.data.update()

lo2 = Vector((1e9,) * 3)
hi2 = Vector((-1e9,) * 3)
for v in dup.data.vertices:
    for k in range(3):
        lo2[k] = min(lo2[k], v.co[k])
        hi2[k] = max(hi2[k], v.co[k])
if abs(hi2.x + lo2.x) > 1e-4 or abs(hi2.x - lo2.x - 1.0) > 1e-4 \
        or abs(lo2.z) > 1e-4 or abs(lo2.y) > 1e-4:
    raise SystemExit(f'normalizacao errada: x[{lo2.x:.5f},{hi2.x:.5f}] '
                     f'y[{lo2.y:.5f},{hi2.y:.5f}] z[{lo2.z:.5f},{hi2.z:.5f}]. Bake abortado.')
log(f'normalizada → largura 1,000 · altura {hi2.z:.4f} · espessura {hi2.y:.5f} '
    f'(razao alt/larg do rip: {alt / larg:.4f})')

if dup.data.materials:
    dup.data.materials[0].name = MAT
# ⚠️ O DADO DE MALHA TAMBEM, e nao so o objeto — o `GLTFLoader` batiza os `Mesh`
# pelo nome da malha glTF, que o exportador tira do DADO. Ver o bloco
# equivalente em `bake_tank_vm.py`.
dup.data.name = TAG

for o in list(bpy.data.objects):
    if o is not dup:
        bpy.data.objects.remove(o, do_unlink=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=DST,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_image_format='WEBP',
    export_draco_mesh_compression_enable=False,   # 100 vertices: Draco so acrescenta cabecalho
    export_cameras=False,
    export_lights=False,
)
log('exportado', DST)
