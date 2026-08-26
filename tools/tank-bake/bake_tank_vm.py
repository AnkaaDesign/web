"""Assa `tank_vm_v1.glb` — os DOIS tanques de combustivel do Volvo VM 2015,
normalizados, e sem o relevo VOLVO.

POR QUE
==============================================================================
*"troque os tanques de gasolina do modelo do Scania p360 pelo VOlvo VM que e
melhor desenhado, mas faca com que ele seja de inox, e tambem remova o texto
Volvo dele"* — Kennedy, 2026-08-22.

O rip do Scania P entrega o tanque como um CILINDRO liso de revolucao com duas
cintas e nada mais (`tanques_0_p3`, material `crome`, 0,683 x 0,702 x 0,986 m).
O VM entrega um tanque de secao retangular arredondada com nervura, tampa de
enchimento, respiro, cintas com braco de fixacao e chicote — que e o que o dono
chamou de melhor desenhado.

Irmao de `tools/wheel-bake/bake_wheel_vm.py`, e a doutrina e a mesma: o asset
so carrega GEOMETRIA NORMALIZADA e NOME DE MATERIAL; o acabamento (o inox) mora
em `engine/vehicle/truck-tanks.ts`, com os numeros ao lado do porque.

O QUE SAI DAQUI
==============================================================================
Dois nos, um por lado, e o contrato inteiro de `swapTruckTanks()` esta neles:

    TANK_R   o tanque que no rip esta em x > 0
    TANK_L   o tanque que no rip esta em x < 0

⚠️ **OS DOIS LADOS SAO ASSADOS, E NAO UM ESPELHADO.** Duas razoes, e a segunda
sozinha ja bastaria:

  1. os dois tanques do VM NAO sao espelhos um do outro — medido, a tampa de
     enchimento do lado x>0 fica na ponta TRASEIRA e a do lado x<0 na
     DIANTEIRA, e o chicote sai em pontos diferentes. Espelhar poria as duas
     tampas no mesmo canto;
  2. espelhar inverte o ENROLAMENTO e a peca aparece pelo avesso. Esse erro ja
     foi cometido nesta base (ver `bake_wheel_vm.py` e o `espelha()` de
     `side-guard.ts`, que existe justamente para inverter o indice junto).

NORMALIZACAO — o datum e a CASCA, nao o envelope
==============================================================================
Cada no sai transladado para que a origem caia em

    (face EXTERNA, TOPO, FRENTE)  da casca do tanque (material `Cinza_84`),

ou seja o tanque ocupa y de -H a 0 e z de 0 a L, e cresce da face externa para
a LINHA DE CENTRO do veiculo: TANK_R ocupa x de -W a 0 e TANK_L de 0 a +W.

Assim o motor coloca cada lado com uma TRANSLACAO pura — `x = +|xOut|` a
direita, `x = -|xOut|` a esquerda — sem espelho, sem giro e sem sinal para
errar.

⚠️ O DATUM E A CASCA E NAO A CAIXA DE TUDO porque e a casca que o motor casa
com o BARRIL do Scania. As cintas passam 2 mm por fora da casca e os bracos de
fixacao entram 53 mm por dentro dela; ancorar no envelope faria o tanque nascer
deslocado por essa sobra, que muda de lado para lado.

⚠️⚠️ O TANQUE DO RIP ESTA EMPINADO, E E AQUI QUE ISSO SE CONSERTA
==============================================================================
*"o tanque de gasolina ficou muito inclinado"* — Kennedy, 2026-08-22, com a
captura do flanco.

Nao era erro de colocacao: o tanque JA VEM torto do rip. Medido pelo centro de
secao das duas tampas, a ponta de tras sobe **2,05° no lado x>0 e 1,60° no lado
x<0** em relacao a ponta da frente. O caminhao doador NAO esta inclinado — as
seis rodas dele tocam y 0,000 — entao a inclinacao e da PECA, e provavelmente
acompanha alguma nervura do proprio chassi do VM.

Transplantada tal e qual, ela vira uma peca empinada pendurada num quadro
Scania que e reto: e o que a captura mostra. E ela nao pode ser corrigida no
motor, porque o motor coloca por TRANSLACAO PURA — meter um giro la
reintroduziria o sinal que a normalizacao existe para eliminar.

Entao o bake NIVELA cada lado antes de tomar o datum, e CONFERE que sobrou
menos de 0,2° de residuo. Os dois lados sao medidos separadamente, cada um com
o seu angulo: eles nao concordam entre si no arquivo de origem.

O criterio e o CENTRO DE SECAO DAS DUAS TAMPAS, e nao a pele de cima: o topo do
tanque carrega a tampa de enchimento e o respiro, e um ajuste de reta sobre ele
seguiria o bico em vez de seguir a peca. As tampas nao tem ferragem nenhuma.

O RELEVO "VOLVO" — 101 partes soltas por lado
==============================================================================
As letras NAO estao em textura. O mapa de normais da casca (`plastic_n`,
512x512) e so pedra batida, sem letra nenhuma: o VOLVO e GEOMETRIA, um relevo
em alto sobre a face externa.

E ele e feito de PARTES SOLTAS pousadas sobre a casca — a face de tras de cada
letra fica em x 1,177, que e exatamente onde a casca passa. Entao apagar as
partes NAO abre buraco: a casca continua fechada por baixo. Medido, por lado:

    101 partes · 1 685 vertices · faixa y 0,622…0,675 (53 mm de altura de
    letra) · z 0,393…0,726 no lado x>0 e 0,317…0,650 no lado x<0

O criterio e por FORMA e por SITIO, nao por indice de parte — indice de parte
morre no proximo re-bake:

    · pertence a casca (material `Cinza_84`);
    · nenhuma dimensao passa de 120 mm;
    · fica a menos de 50 mm da face EXTERNA da casca.

Medido no arquivo, isso da 101 e so 101 partes por lado, todas num unico
aglomerado em z. Ha outras 5 partes pequenas na casca, e as tres condicoes
juntas as deixam de fora (elas estao na face de DENTRO e no topo). O script
CONFERE o numero e a altura da faixa e ABORTA se o re-bake mudar a peca — um
apagamento silencioso que come 2 mm de casca e o defeito que este bloco existe
para impedir.

MATERIAIS — renomeados, e o INOX nao se resolve aqui
==============================================================================
    Cinza_84  ->  tanque-inox-vm    a casca (era cinza plastico, vira inox)
    Cinza_82  ->  tanque-cinta-vm   cintas, bracos e ferragem

⚠️ O CHICOTE DO SENSOR (`tanque_0_p1`, material `cores_83`) NAO ENTRA, e a
razao e o preco: ele sozinho traz `cores` 1024² e `n_bexi` 2048², e medido no
export sao **327 kB de 1 004 kB — 33 % do asset** para um cabo de 5 mm que sai
pela face de DENTRO do tanque, ou seja para o vao entre o tanque e a longarina.
Um mapa de normais de 2048² num cabo de 5 mm ja seria desproporcional no rip de
origem; pagar por ele num asset que carrega em toda troca de caminhao nao se
justifica. Sem ele o arquivo sai em **677 kB**.

⚠️ **METALICIDADE, RUGOSIDADE E COR NAO SAO ESCRITAS AQUI**, pelo mesmo motivo
do irmao: um numero escrito no binario vira um numero sem historia, e o
conserto tem de estar onde o revisor le. Ver `tuneVmTankMaterials()`.

USO
==============================================================================
    blender -b --factory-startup --python tools/tank-bake/bake_tank_vm.py -- \\
        public/models/trucks/volvo_vm_2015_6x2r.glb \\
        public/models/vehicles/tank_vm_v1.glb

⚠️ O SUFIXO `_v1` E IMUTAVEL. `/studio-assets/v1/` sai da API com
`Cache-Control: immutable`, entao SOBRESCREVER um `.glb` ja publicado prende a
versao errada no navegador de quem abriu o estudio naquela janela. Toda bake
seguinte ganha o proximo sufixo. A historia inteira esta no bloco de
`WHEEL_ASSET`, em `engine/vehicle/models.ts`.
"""
import bpy
import bmesh
import math
import sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, DST = argv[0], argv[1]

# As tres malhas do grupo `tanque_0` e o nome de material que cada uma leva.
PECAS = [
    ('tanque_0_p2', 'tanque-inox-vm'),      # a casca — e o datum
    ('tanque_0_p0', 'tanque-cinta-vm'),     # cintas, bracos, ferragem
]
CASCA = 'tanque-inox-vm'

# O relevo: nenhuma dimensao passa disto…
LETRA_MAX = 0.120
# …e a parte fica a menos disto da face EXTERNA da casca.
LETRA_PELE = 0.050
# Conferencias — ver o bloco do cabecalho.
LETRA_PARTES = 101
LETRA_ALTURA_MAX = 0.080

# Fatia de ponta usada para achar o centro de secao de cada tampa, em fracao do
# comprimento. 8 % pega a tampa inteira e nenhuma cinta.
TAMPA_FRAC = 0.08
# Residuo aceito depois de nivelar. 0,2° e menos que a quantizacao do Draco
# espalha sobre 1,3 m de tanque.
NIVEL_RESIDUO = math.radians(0.2)


def log(*a):
    print('[bake-tanque]', *a)


def solo(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


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


def pick(src_name, mat_name, tag, sinal):
    """Duplica `src_name`, achata a hierarquia e fica so com o lado pedido.

    ⚠️ `src.copy()` PRESERVA O PAI, e o importador glTF pendura tudo num no de
    conversao Y-up -> Z-up. Sem soltar o pai e reescrever `matrix_world`, o
    `transform_apply` assa a conversao duas vezes — a mesma armadilha que os
    dois scripts de roda documentam.
    """
    src = bpy.data.objects.get(src_name)
    if src is None:
        raise SystemExit(f'{tag}: no `{src_name}` nao existe em {SRC}')
    dup = src.copy()
    dup.data = src.data.copy()
    dup.name = f'{tag}__{mat_name}'
    bpy.context.scene.collection.objects.link(dup)
    mw = src.matrix_world.copy()
    dup.parent = None
    dup.matrix_world = mw
    solo(dup)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # o LADO, por centro de face: um vertice na linha de centro nao decide nada,
    # e nenhuma face do tanque cruza x = 0.
    bm = bmesh.new()
    bm.from_mesh(dup.data)
    fora = [f for f in bm.faces if (f.calc_center_median().x > 0) != (sinal > 0)]
    bmesh.ops.delete(bm, geom=fora, context='FACES')
    bm.to_mesh(dup.data)
    bm.free()
    dup.data.update()

    if dup.data.materials:
        dup.data.materials[0].name = mat_name
    return dup


def loose_parts(obj):
    """Rotula as partes soltas e devolve [(indices de vertice, caixa)]."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    lab = {}
    comp = 0
    for seed in bm.verts:
        if seed.index in lab:
            continue
        pilha = [seed]
        lab[seed.index] = comp
        while pilha:
            v = pilha.pop()
            for e in v.link_edges:
                w = e.other_vert(v)
                if w.index not in lab:
                    lab[w.index] = comp
                    pilha.append(w)
        comp += 1
    caixas = {}
    for v in bm.verts:
        c = lab[v.index]
        b = caixas.get(c)
        if b is None:
            caixas[c] = [v.co.copy(), v.co.copy(), [v.index]]
        else:
            for k in range(3):
                b[0][k] = min(b[0][k], v.co[k])
                b[1][k] = max(b[1][k], v.co[k])
            b[2].append(v.index)
    bm.free()
    return [(b[2], b[0], b[1]) for b in caixas.values()]


def tira_letras(casca, tag, sinal):
    """Apaga o relevo VOLVO da casca. Aborta se o bake nao bater com o medido."""
    lo, hi = world_bounds([casca])
    pele = hi.x if sinal > 0 else lo.x          # a face EXTERNA, em x
    alvo = []
    for idxs, plo, phi in loose_parts(casca):
        if max(phi[k] - plo[k] for k in range(3)) > LETRA_MAX:
            continue
        # Blender Z-up: a distancia ate a pele e so em X, que e lateral nos dois.
        perto = (pele - plo.x) if sinal > 0 else (phi.x - pele)
        if perto > LETRA_PELE:
            continue
        alvo.append((idxs, plo, phi))

    if len(alvo) != LETRA_PARTES:
        raise SystemExit(
            f'{tag}: o criterio de relevo casou {len(alvo)} partes e o medido sao '
            f'{LETRA_PARTES}. O rip mudou — reveja o bloco "O RELEVO" antes de '
            'apagar coisa nenhuma. Bake abortado.')
    # Blender Z-up: a ALTURA da letra e Z.
    zlo = min(p[1].z for p in alvo)
    zhi = max(p[2].z for p in alvo)
    if zhi - zlo > LETRA_ALTURA_MAX:
        raise SystemExit(
            f'{tag}: as {len(alvo)} partes ocupam {1000 * (zhi - zlo):.0f} mm de altura, '
            f'e uma letra tem 53. Isso nao e o letreiro. Bake abortado.')

    mortos = set()
    for idxs, _, _ in alvo:
        mortos.update(idxs)
    bm = bmesh.new()
    bm.from_mesh(casca.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in mortos], context='VERTS')
    bm.to_mesh(casca.data)
    bm.free()
    casca.data.update()
    log(f'  {tag}: relevo VOLVO fora — {len(alvo)} partes, {len(mortos)} vertices, '
        f'altura de letra {1000 * (zhi - zlo):.0f} mm')


def inclinacao(casca):
    """O quanto a peca sobe da tampa da frente para a de tras, em radianos.

    Blender e Z-up e o importador glTF ja converteu: X e lateral, Y e
    longitudinal e Z e a altura. Devolve (angulo, centro_frente, centro_tras).
    """
    ys = [v.co.y for v in casca.data.vertices]
    y0, y1 = min(ys), max(ys)
    faixa = max(0.02, (y1 - y0) * TAMPA_FRAC)

    def centro(a, b):
        zs = [v.co.z for v in casca.data.vertices if a <= v.co.y <= b]
        if not zs:
            raise SystemExit('tampa vazia ao medir a inclinacao')
        return (min(zs) + max(zs)) / 2, (a + b) / 2

    za, ya = centro(y0, y0 + faixa)
    zb, yb = centro(y1 - faixa, y1)
    return math.atan2(zb - za, yb - ya), za, zb


def nivela(objs, casca, tag):
    """Gira a peca em torno de X ate a linha das duas tampas ficar horizontal."""
    ang, _, _ = inclinacao(casca)
    if abs(ang) < 1e-6:
        log(f'  {tag}: ja estava nivelada')
        return
    ys = [v.co.y for v in casca.data.vertices]
    zs = [v.co.z for v in casca.data.vertices]
    pivo = Vector((0.0, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2))
    c, s_ = math.cos(-ang), math.sin(-ang)
    for o in objs:
        for v in o.data.vertices:
            dy, dz = v.co.y - pivo.y, v.co.z - pivo.z
            v.co.y = pivo.y + dy * c - dz * s_
            v.co.z = pivo.z + dy * s_ + dz * c
        o.data.update()
    resto, _, _ = inclinacao(casca)
    if abs(resto) > NIVEL_RESIDUO:
        raise SystemExit(
            f'{tag}: sobrou {math.degrees(resto):.3f}° depois de nivelar — '
            'a peca nao e um prisma e o criterio das tampas nao serve. Bake abortado.')
    log(f'  {tag}: nivelada — era {math.degrees(ang):+.2f}°, '
        f'sobrou {math.degrees(resto):+.3f}°')


def build(tag, sinal):
    objs = [pick(n, m, tag, sinal) for (n, m) in PECAS]
    vazias = [o.name for o in objs if not o.data.polygons]
    if vazias:
        raise SystemExit(f'{tag}: peca vazia depois do corte de lado — {vazias}')

    casca = next(o for o in objs if o.name.endswith(CASCA))
    tira_letras(casca, tag, sinal)
    # ⚠️ NIVELA ANTES DO DATUM. O datum e a caixa da casca, e a caixa de uma
    # peca torta e maior que a peca: tomar o topo antes de endireitar poria a
    # origem no canto de tras em cima, e nao no topo.
    nivela(objs, casca, tag)

    # O DATUM E A CASCA — ver o cabecalho.
    lo, hi = world_bounds([casca])
    # Blender Z-up: X lateral, Y = -z do glTF (longitudinal), Z = altura.
    datum = Vector((hi.x if sinal > 0 else lo.x,   # face EXTERNA
                    hi.y,                          # a FRENTE do veiculo (z minimo no glTF)
                    hi.z))                         # o TOPO
    for o in objs:
        solo(o)
        for v in o.data.vertices:
            v.co = v.co - datum
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # ⚠️ A CASCA SE MEDE ANTES DA FUSAO. `join()` funde tudo DENTRO do objeto
    # ativo, que e a propria casca (`PECAS[0]`) — depois dele `casca` ja e o
    # conjunto inteiro e a conferencia do datum passaria a medir as cintas.
    clo, chi = world_bounds([casca])
    if abs(chi.x if sinal > 0 else clo.x) > 1e-4 or abs(chi.z) > 1e-4 or abs(chi.y) > 1e-4:
        raise SystemExit(f'{tag}: a casca nao ficou com a origem no datum. Bake abortado.')

    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    unit = bpy.context.view_layer.objects.active
    unit.name = tag
    # ⚠️ O DADO DE MALHA TAMBEM, e nao so o objeto. O exportador escreve o nome
    # do OBJETO no no e o nome do DADO na malha glTF, e o `GLTFLoader` batiza os
    # `Mesh` pelo segundo. Sem esta linha o asset saia com malhas chamadas
    # `tanque_0_p2.001` — ou seja, o tanque NOVO nascia respondendo ao mesmo
    # `^tanques?_\d+_p\d+$` com que o motor acha o tanque VELHO. Hoje isso so
    # confundiria um portao; no dia em que a troca rodar duas vezes sobre a
    # mesma cabine, ela esconderia o proprio tanque que acabou de pendurar.
    unit.data.name = tag

    tlo, thi = world_bounds([unit])
    # De volta ao glTF Y-up para o relatorio, que e a lingua do motor.
    log(f'{tag}: casca {chi.x - clo.x:.3f} x {chi.z - clo.z:.3f} x {chi.y - clo.y:.3f} m '
        f'(larg x alt x compr) · envelope x [{tlo.x:+.3f},{thi.x:+.3f}] '
        f'y [{tlo.z:+.3f},{thi.z:+.3f}] z [{-thi.y:+.3f},{-tlo.y:+.3f}] · '
        f'{len(unit.data.polygons)} faces')
    return unit


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
log('importado', SRC)

fica = {build('TANK_R', +1), build('TANK_L', -1)}
for o in list(bpy.data.objects):
    if o not in fica:
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
