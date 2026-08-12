# Builds `/environments/distrito-industrial/set.glb`.
#
#   blender -b -P build_industrial_park.py
#
# WHAT CHANGED IN THIS PASS, AND WHY
# ---------------------------------------------------------------------------
# 0. THE FENCE SOURCE HAD DISAPPEARED. FENCE_SRC pointed into
#    `Downloads\3D Ripper Pro\...`, a folder that no longer exists. build_fence()
#    logs "fence source missing" and RETURNS — it does not raise — so running the
#    previous version of this file today produced a district with no perimeter at
#    all, and the ground/HDRI seam the fence exists to hide came straight back.
#    The perimeter is now generated here from the CC0 chainlink kit's textures
#    (props_ph.py), which also makes its height a number in this file instead of
#    a property of whatever kit happened to be on disk.
#
# 1. TWO CARRIAGEWAYS WITH A PLANTED MEDIAN. The truck still stands on x=0 —
#    that is not negotiable, the app parks it at the origin at z=0 — so the pair
#    is not centred on the truck: road A IS the truck's road, and road B runs
#    west of it behind a 10.5 m median. West, because the studio's default view
#    direction puts the camera east-southeast, so the second road and its median
#    land in the frame BEHIND the truck rather than under the camera.
#
# 2. THE ROAD/YARD JOINT IS THE DETAIL NOW. Previously one 32 cm kerb box and a
#    yard 14 cm BELOW the road, which is backwards: a kerb retains the higher
#    ground, it does not fence off a sunken one. The section is now
#    gutter -> kerb face -> yard, with the yard 12 cm ABOVE the carriageway, the
#    kerb segmented every 1.1 m so the joints read, and drainage inlets cut into
#    the gutter line. Every height change on this site is now explained by
#    something that would explain it in life — which is the standing lesson from
#    the apron slabs that shipped as "degraus no chao".
#
# 3. THE PAINT IS WORN, NOT PAINTED. Markings were flat quads on one flat tone,
#    which is the giveaway that they are decals: real paint fails in patches,
#    fails fastest in the wheelpath, and fails completely on bays nobody has
#    repainted. Every mark is now subdivided along its length and carries COLOR_0
#    wear, and a proportion of the bay lines are worn to nearly nothing.
#
# 4. THE SITE IS BIGGER AND THE FENCE IS FURTHER AND TALLER. Property line 225 ->
#    330 m (a 660 m square, more than double the enclosed area), fence 3.6 ->
#    ~4.3 m over a concrete plinth with barbed arms. The concrete no longer runs
#    to the wire: it stops and grass takes over, which is where the trees are.
#
# 5. THE TALL PIECES ARE SET BACK IN THE GEOMETRY. Nothing over 8 m stands
#    within 60 m of road A. That was previously done at load time by the
#    manifest's `pushback` block; that block MUST now be deleted from
#    environments.json, exactly as its own note says, or the recuo is applied
#    twice.
#
# COORDINATES. Blender space throughout: X right, Y forward (the direction the
# truck faces), Z up. The exporter converts to glTF Y-up on the way out.
#
# THE TRUCK. Tractor 2.9 x 4.0 x 6.0 m, trailer 2.67 x 4.23 x 15.1 m — a ~19 m
# rig running along +Y from the origin, standing ON road A at z=0.
import bpy
import bmesh
import json
import math
import os
import random
import struct
import sys
import importlib.util
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))

# O DESTINO E RELATIVO AO PROPRIO ARQUIVO, e nao um caminho absoluto do Windows.
#
# Era `C:\Users\Kennedy\Documents\repositories\web\public\...`. Num checkout
# Linux isso nao e um caminho invalido — e um NOME DE ARQUIVO valido: o export
# escrevia um arquivo chamado `C:\Users\...\set.glb` dentro do diretorio de
# trabalho e a build terminava anunciando sucesso, com o set.glb de verdade
# intacto. Mesmo modo de falha do FENCE_SRC: nada quebra, so nada acontece.
# PARK_OUT_DIR continua a permitir apontar para outro lugar quando for preciso.
OUT_DIR = os.environ.get("PARK_OUT_DIR") or os.path.normpath(
    os.path.join(HERE, "..", "..", "public", "environments", "distrito-industrial"))
OUT = os.path.join(OUT_DIR, "set.glb")

# ---------------------------------------------------------------------------
# Site dimensions.
# ---------------------------------------------------------------------------
# Nothing may intrude here. The orbit camera pulls back to ~30 m to frame a
# 19 m rig, so a building at 24 m is a building the camera is standing inside.
CLEAR_RADIUS = 26.0

ROAD_W = 13.0               # carriageway: 2 x 5 m lanes + shoulders
ROAD_LEN = 1180.0           # o comprimento do CHAO; ver ROAD_Y0/ROAD_Y1
ROAD_CROWN = 0.055          # fall from centreline to channel

# ---------------------------------------------------------------------------
# ONDE A VIA INTERNA COMECA E ACABA — e por que ela deixou de correr 1180 m.
#
# Ela e uma RUA INTERNA e corria os 1180 m do chao, entrando na bruma pelas duas
# pontas. O comentario original defendia isso ("a road that simply stops is the
# most artificial thing a ground plane can do") e estava a responder a pergunta
# errada: o problema nunca foi a rua PARAR, foi ela parar EM NADA. Uma rua que
# se dissolve na neblina nos dois sentidos nao diz para onde vai, e uma via
# interna de planta que atravessa 1,2 km de campo aberto nao e uma via interna.
#
# Agora cada ponta termina em algo que a EXPLICA:
#
#   NORTE  ela sai pelo portao e, 78 m depois, morre numa RODOVIA que cruza o
#          campo de leste a oeste. E a rodovia que continua ate a bruma — e ela
#          pode, porque e o que uma rodovia faz. A saida da planta passa a ter
#          destino em vez de horizonte.
#
#   SUL    ela NAO sai da propriedade. Termina num BALAO dentro do sitio, que e
#          como uma via de servico termina quando o que ela serve acaba: dando
#          onde virar. Sem isto o lado sul tinha portao, guarita e 440 m de
#          asfalto para chegar ao nada.
#
# Os numeros sao escolhidos contra a orbita, contra a laje e contra a cerca, nao
# por gosto: o balao fica a 105 m da origem (a camera vai a ~31 m) e inteiro
# dentro do patio, e a rodovia fica 86 m FORA da cerca.
HIGHWAY_Y = 236.0           # eixo da rodovia
HIGHWAY_W = 15.0            # pista da rodovia, um pouco mais larga que a interna
HIGHWAY_SHOULDER = 5.0      # acostamento + talude de brita, de cada lado

# -105 E NAO -116, E O NUMERO SAI DA LAJE. Com o centro em -116 o disco chegava
# a y=-137,5 e a laje acaba em YARD_Y0 = -133: quatro metros e meio de balao
# ficavam POR CIMA da faixa de turfa, com a grama (a +1 cm) a furar o asfalto
# (a -5 cm). Aparecia no render t_balao como uma mancha castanha no bordo sul.
# O centro e agora derivado do que o contem, com 6 m de folga para a guia e para
# a variacao do relevo — ver ROUNDABOUT_FIT, que FALHA a build se isto voltar a
# nao caber.
ROUNDABOUT_CY = -105.0      # centro do balao
# O DISCO TEM DE CABER NO RECORTE DA LAJE, e nao cabia — este era o "ainda esta
# sem os meio fios da parte externa da rotatoria".
#
# `add_slab` abre no patio um corredor de 38,98 m (as duas pistas mais o
# canteiro), ou seja 19,49 m de meia-largura. Com RO 21,5 o disco transbordava
# 2,01 m para cada lado, e ali a LAJE (+7 cm) passa por cima do asfalto do balao
# (-5 cm) e ganha o teste de profundidade: os flancos leste e oeste do balao
# ficavam cobertos de betao, com a guia externa enterrada por baixo. Nao havia
# guia a acrescentar — havia guia escondida.
#
# 10,5 + 8,5 = 19,0, que deixa 32 cm de folga para a propria guia (17 cm) e para
# a ondulacao do terreno. A pista circulatoria perde 1 m de largura e continua
# com 8,5 m, que e mais do que os 7 m de uma rotatoria de duas faixas.
#
# O RAIO EXTERNO E QUE E FIXO, E A ILHA E QUE ANDA DENTRO DELE.
#
# "diminua o diametro do circulo central da rotatoria". A tentacao e encolher o
# balao inteiro, e nao da: o bordo do disco tem de continuar a alcancar a ponta
# das duas pistas. A pista A vai a x=9,75 e a B a x=-27,99, ou seja 18,87 m do
# centro — com RO abaixo disso o asfalto da pista morre ANTES do disco e o
# leque de aproximacao nasce sem borda onde assentar. Por cima, RO+guia tem de
# caber nos 19,49 m do recorte da laje (a verificacao logo abaixo). Sobra a
# janela [18,9 .. 19,3] e RO fica onde estava.
#
# Entao o que encolhe e a ILHA, e a pista circulatoria fica com o que ela
# larga: 21 m de diametro passam a 15, e a circulatoria vai de 8,5 para 11,5 m.
# Larga para uma rotatoria de rua, certa para esta: quem a usa e um conjunto de
# 19 m que precisa de raio para inverter, que e o motivo de o balao existir.
ROUNDABOUT_RI = 7.5         # ilha central (grama, com guia)
ROUNDABOUT_W = 11.5         # pista circulatoria
ROUNDABOUT_RO = ROUNDABOUT_RI + ROUNDABOUT_W

# A ponta sul das duas pistas. Fica ao NORTE do circulo inteiro: o leque de
# aproximacao (build_roundabout) e que liga a reta ao arco, e ele so pode ser uma
# superficie regrada valida se a reta estiver toda fora do disco. O ponto mais ao
# norte do disco esta em ROUNDABOUT_CY + ROUNDABOUT_RO; 1,5 m de folga garante
# que nenhum vertice do leque nasca invertido.
ROAD_Y0 = ROUNDABOUT_CY + ROUNDABOUT_RO + 1.5
# E a ponta norte morre no bordo do pavimento da rodovia.
ROAD_Y1 = HIGHWAY_Y - HIGHWAY_W / 2.0
# A garganta do entroncamento: o canteiro morre num nariz este tanto antes da
# rodovia e o asfalto ocupa o corredor inteiro dai em diante. E o que da lugar
# para convergir ao entrar, e sem isso o canteiro encosta dorso-a-dorso na
# rodovia (ver a nota junto a `breaks`).
MEDIAN_THROAT = 22.0

GUTTER_W = 0.45             # concrete channel, flush with the asphalt
KERB_W = 0.17               # the face you see
KERB_SEG = 1.10             # one kerbstone; the joints are what read as kerb

# ROAD A IS THE TRUCK'S ROAD AND IT IS AT ZERO. The app parks the rig on the
# origin at z=0, so the median cannot be centred on the truck — it would put
# grass under the trailer. Road B goes WEST because view.ts aims the default
# camera from (+X, -Y): west is what the frame looks AT, east is behind the lens.
# O CAMINHAO FICA NA FAIXA ESQUERDA, E POR ISSO A VIA E QUE SE DESLOCA.
#
# O app estaciona o veiculo na ORIGEM e isso nao e negociavel. Com a rua A
# centrada em x=0, a origem cai exatamente sobre o eixo — o caminhao montava a
# linha tracejada, que e a leitura de "no centro da via, nao numa faixa".
#
# Deslocar a rua 3,25 m para leste (meia faixa) poe o eixo em +3,25 e faz x=0
# virar o CENTRO DA FAIXA ESQUERDA. Nada mais precisa mudar: meio-fio, sarjeta,
# canteiro e todas as marcacoes sao derivados destas duas constantes.
ROAD_A_X = 3.25
MEDIAN_W = 10.5
_EDGE = ROAD_W / 2.0 + GUTTER_W + KERB_W
# relativo a rua A, senao mover uma abre ou fecha o canteiro
ROAD_B_X = ROAD_A_X - (2.0 * _EDGE + MEDIAN_W)

# O RECORTE QUE add_slab ABRE NO PATIO, e a meia-largura dele. O balao tem de
# caber aqui dentro (ver ROUNDABOUT_RI) e este e o unico sitio onde as duas
# constantes se encontram, entao e aqui que a verificacao mora — falhar a build
# e o unico modo de falha que nao se descobre tarde, olhando um render.
CORRIDOR_HALF = (ROAD_A_X + _EDGE - (ROAD_B_X - _EDGE)) / 2.0
if ROUNDABOUT_RO + KERB_W >= CORRIDOR_HALF:
    raise SystemExit(
        "o balao transborda o recorte da laje: RO+guia %.2f m contra %.2f m de "
        "meia-largura do corredor. A laje (+7 cm) cobriria o asfalto do balao "
        "(-5 cm) nos flancos, e com ele a guia externa."
        % (ROUNDABOUT_RO + KERB_W, CORRIDOR_HALF))

# Property line. The fence stands here.
#
# 225 -> 330 -> 250, and the round trip is the lesson. 330 did put the wire well
# outside any orbit, which is what "mais longe por conta da camera" asked for —
# but it also bought 660 x 660 m of ground that the plant had no way to fill, so
# the buildings ended up 30 and 40 m apart just spanning it. The verdict was
# immediate and correct: "as construcoes ficam muito afastadas umas das outras".
#
# 250 keeps the fence at more than eight times the maximum orbit radius (~31 m),
# which is all the camera ever needed, and leaves a perimeter band the planting
# can actually fill instead of a field with a wire around it.
YARD_HALF = 150.0

# The PAVED yard, which is no longer the whole property. It stops well short of
# the wire and grass takes over — that band is where the trees stand, and it is
# also the honest answer to a 660 m concrete slab, which no plant has ever had.
#
# SMALLER THAN THE FIRST ATTEMPT AT THIS, and the top-down render is why: 468 x
# 490 m of concrete is not a yard, it is an airfield. The plant only owns as
# much slab as it has buildings to stand on and lorries to turn on; the rest of
# the property is turf, which is both what a real site looks like and where the
# brief's trees and grass patches go.
# Y deslocado 20 m para o sul junto com as construcoes: o pedido de "mover o
# caminhao um pouco mais para frente" so pode ser atendido movendo o SITIO, ja
# que o veiculo esta preso na origem. Mover as construcoes sem mover a laje
# deixaria as pecas do sul fora do piso.
YARD_X0, YARD_X1 = -108.75, 109.25
YARD_Y0, YARD_Y1 = -133.0, 103.0

# O BALAO TEM DE CABER NA LAJE, e isto falha a build quando nao cabe.
#
# Nao e zelo: o modo de falha e SILENCIOSO e ja aconteceu. Com o centro em
# -116 o disco passava 4,5 m alem de YARD_Y0 e ficava por cima da faixa de
# turfa; nada no build reclamou, o log deu "balao: r 21.5 m" e o defeito so
# apareceu ao olhar o render — grama a furar asfalto. As duas constantes vivem
# 30 linhas separadas, entao qualquer mexida numa delas volta a poder abrir
# isto. A folga de 6 m cobre a guia da ilha e a ondulacao do terreno.
ROUNDABOUT_FIT = ROUNDABOUT_CY - ROUNDABOUT_RO - 6.0
if ROUNDABOUT_FIT < YARD_Y0:
    raise SystemExit(
        "o balao nao cabe na laje: bordo sul em %.1f m contra YARD_Y0 %.1f m. "
        "Suba ROUNDABOUT_CY ou desca YARD_Y0."
        % (ROUNDABOUT_CY - ROUNDABOUT_RO, YARD_Y0))

# The engine's camera.far is 600 m and the horizon-haze shell sits at 570 m, so
# the ground has to reach PAST the haze or its own edge shows as a lit band
# under the fog. At 590 m FogExp2(0.0028) is 93 % and the haze covers the rest.
GROUND = 1180.0

# Heights. The carriageway crown is the datum at z=0 because the truck stands on
# it; everything else is referred to that.
# AS COTAS FORAM MEDIDAS CONTRA A OBRA E ESTAVAM QUASE AO DOBRO.
#
# Relato: "as ruas secundarias parecem ter alturas diferentes da principal, as
# secundarias parecem ser mais elevadas". Medido, era verdade e por muito: a via
# interna corria a +14..17 cm sobre o eixo da pista, ou seja +20 cm sobre a
# canaleta — mais alto que o proprio dorso do meio-fio que devia conte-la. Uma
# rua que passa por cima da guia nao le como rua, le como plataforma, e e
# exatamente isso que se ve de cima.
#
# A referencia de obra e simples e nao e discutivel: um meio-fio tem 12 a 15 cm
# de face vista, medidos da canaleta. Com a canaleta a -5,5 cm, o dorso cai em
# +7 a +9,5 cm — e a laje, que fica atras dele, um pouco abaixo disso. Estava em
# +12 (laje) e +15,5 (dorso), ou seja 21 cm de face vista.
#
# Passa a +7 e +9,5. O sitio inteiro e derivado destes dois numeros (a grama, o
# canteiro, a guia, a sarjeta, o rebaixo da laje e a rampa do entroncamento
# saem todos daqui), entao a proporcao muda uma vez, num lugar so.
YARD_Z = 0.07               # the paved yard sits ABOVE the road, behind a kerb
KERB_TOP = 0.095
GRASS_Z = 0.01              # unpaved ground inside the fence, below the slab

# UMA LAJE DE CONCRETO E PLANA, e tratar isso como detalhe foi o que deixou toda
# a guia do sitio inconsistente.
#
# `undul` da +-8 cm e a laje usava-o INTEIRO, enquanto o dorso do meio-fio da
# pista e a constante KERB_TOP. Medido: a face vista dessa guia varia entre
# 1,4 cm e 16,4 cm ao longo do mesmo troco — nuns pontos ela desaparece dentro
# da laje, noutros vira um degrau de 16 cm. Nao e a guia que esta errada, e o
# chao por tras dela que sobe e desce como se fosse terra.
#
# Um patio industrial e betonado com regua: +-2 cm em dezenas de metros e ja
# muito. 0,25 do relevo do terreno da exatamente isso e conserva a leitura de
# que a laje acompanha o sitio, em vez de flutuar sobre ele.
SLAB_FLAT = 0.25

# QUANTO O DORSO DO MEIO-FIO FICA ACIMA DO QUE ELE RETEM. Um so numero para
# todas as guias do cenario — pista, via interna, canteiro e bordo do patio.
# Enquanto a pista usava cota FIXA e a via interna usava "laje + 3,5 cm", as
# duas divergiam ate 5,7 cm e liam-se como pecas de obras diferentes.
KERB_REVEAL = 0.025

# QUANTO A VIA INTERNA CORRE ABAIXO DA LAJE. Ela ja esteve 3 cm ACIMA (e por
# isso parecia mais alta que a pista) e depois rente. Rente tambem nao serve:
# uma guia entre duas superficies a mesma cota nao e guia, e um ressalto de
# 2,5 cm. Com 6 cm de rebaixo a via fica praticamente na cota da pista (+1 cm
# contra 0) e a guia ganha os 8,5 cm de face que fazem dela uma guia.
SVC_DROP = 0.06

SEED = 7
rnd = random.Random(SEED)


def log(m):
    print("[park] " + m, flush=True)


# ---------------------------------------------------------------------------
# Noise. Hash-based value noise with fBm on top — no period, no axis, no tile.
# (The sines this replaced painted a visible diamond lattice across the yard:
# sin*cos is separable and periodic, so more octaves only add more grids.)
# ---------------------------------------------------------------------------
def _hash01(i, j, s):
    n = (i * 374761393 + j * 668265263 + s * 1274126177) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFFFF) / float(0xFFFFFF)


def vnoise(x, y, s=0):
    i, j = int(math.floor(x)), int(math.floor(y))
    fx, fy = x - i, y - j
    u = fx * fx * (3.0 - 2.0 * fx)          # smoothstep, so no lattice creases
    v = fy * fy * (3.0 - 2.0 * fy)
    a = _hash01(i, j, s)
    b = _hash01(i + 1, j, s)
    c = _hash01(i, j + 1, s)
    d = _hash01(i + 1, j + 1, s)
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v


# O EIXO ERA O DEFEITO, e "no axis" no comentario antigo era uma intencao e nao
# uma propriedade. vnoise e ruido de VALOR numa grelha de inteiros: as curvas de
# nivel de uma oitava sao quadrados arredondados alinhados com x e com y. Somar
# oitavas em 2,03x nao desfaz isso — empilha quadrados de tamanhos diferentes
# sobre os MESMOS dois eixos, e o resultado e um chao que parece ladrilhado numa
# escala que nao corresponde a ladrilho nenhum.
#
# Girar o dominio a cada oitava resolve a partir da segunda: cada uma passa a ter
# os seus eixos e a soma nao tem nenhum. A PRIMEIRA continua alinhada, e como ela
# leva mais da metade do peso, so a rotacao nao basta — quem trata a primeira e a
# deformacao de dominio em fbm_org.
_ROT_C, _ROT_S = math.cos(0.6180339887), math.sin(0.6180339887)


def fbm(x, y, s=0, octaves=5):
    """Fractional Brownian motion in 0..1, com o dominio girado a cada oitava."""
    amp, freq, tot, norm = 1.0, 1.0, 0.0, 0.0
    for k in range(octaves):
        tot += amp * vnoise(x * freq, y * freq, s + k * 17)
        norm += amp
        amp *= 0.5
        freq *= 2.03
        x, y = x * _ROT_C - y * _ROT_S, x * _ROT_S + y * _ROT_C
    return tot / norm


def fbm_org(x, y, s=0, octaves=4, warp=0.75):
    """fBm com DEFORMACAO DE DOMINIO — o campo que nao parece uma grelha.

    O ponto e lido depois de ser empurrado por um campo de ruido proprio. E a
    diferenca entre uma mancha e uma mancha com FORMA: a borda dobra, entra,
    volta e as vezes se estrangula, em vez de ser sempre a mesma bolha convexa
    com o mesmo feitio e os mesmos dois eixos. E o que responde a "muito
    padronizado, parece varios quadrados seguidos" — o alinhamento estava no
    ruido, nao na malha nem na textura.

    `warp` e em unidades do proprio dominio: 0,75 e da ordem da celula, forte o
    bastante para que a forma da mancha deixe de ser reconhecivel como celula e
    fraca o bastante para nao dobrar o campo sobre si mesmo (o que faria
    filamentos, que e outro aspecto artificial, so que mais caro).
    """
    wx = fbm(x + 5.2, y + 1.3, s + 311, 2) - 0.5
    wy = fbm(x - 3.7, y + 8.1, s + 523, 2) - 0.5
    return fbm(x + warp * wx, y + warp * wy, s, octaves)


def undul(x, y):
    """Ground relief in metres, centred on zero. Peak ~6 cm."""
    return 0.115 * (fbm(x / 34.0, y / 34.0, 11, 5) - 0.5) \
        + 0.045 * (fbm(x / 7.5, y / 7.5, 29, 3) - 0.5)


def yard_z(x, y):
    return YARD_Z + undul(x, y) * SLAB_FLAT


def grass_z(x, y):
    return GRASS_Z + undul(x, y) * 1.4


def road_cx(x):
    """Which carriageway is x on? Returns the centreline, or None."""
    if abs(x - ROAD_A_X) <= ROAD_W / 2 + 0.001:
        return ROAD_A_X
    if abs(x - ROAD_B_X) <= ROAD_W / 2 + 0.001:
        return ROAD_B_X
    return None


def road_z(x, cx=None):
    """A carriageway is CROWNED, and the crown is not decoration: it is why the
    channel is the low point, why the gutter can be flush and still drain, and
    why a marking laid at a fixed z sinks into the asphalt near the kerb. Every
    mark on a road samples this."""
    if cx is None:
        cx = road_cx(x)
        if cx is None:
            return 0.0
    t = min(1.0, abs(x - cx) / (ROAD_W / 2.0))
    return -ROAD_CROWN * t * t


def on_service_road(x, y, pad=0.0):
    for x0, x1, y0, y1 in SERVICE_ROADS:
        if x0 - pad <= x <= x1 + pad and y0 - pad <= y <= y1 + pad:
            return True
    return False


def on_paving(x, y):
    """True where the ground is paved or is the median.

    NOTHING GREEN MAY BE SEEDED HERE, and this is the fix for "a grama que fica
    antes da grade nao deveria atravessar a rua". The patch seeder only tested
    the YARD SLAB — so a patch at (0, 200) is outside the slab in y, passes the
    test, and gets planted in the middle of carriageway A where it runs north to
    the gate. Grass growing across an asphalt road is exactly as wrong as it
    sounds, and it was doing it on both roads at both ends of the site.
    """
    # O CORREDOR SO E CORREDOR ONDE HA VIA, e ele corria os 1180 m do chao.
    #
    # A faixa de exclusao ia de y=-590 a y=+590, quando a via morre no balao em
    # y=-124. O efeito estava no fundo do enquadramento do estudio: a turfa a sul
    # tem 17 m de largura e 218 de comprimento, e os 42 m centrais dela — os que
    # ficam mesmo por tras do balao, que e para onde a camera olha por cima do
    # implemento — eram os unicos do perimetro inteiro onde nao podia nascer
    # arvore nenhuma. Era o "nessa area deve ter arvores, nessa parte de grama".
    #
    # Ao sul do balao quem responde e o teste da laje, logo abaixo: ate YARD_Y0
    # ha betao (o rabo do corredor) e dai para fora ha turfa, que e plantavel.
    if (ROAD_B_X - _EDGE - 1.5 <= x <= ROAD_A_X + _EDGE + 1.5
            and ROUNDABOUT_CY - ROUNDABOUT_RO - 2.0 <= y <= ROAD_Y1 + 8.0):
        return True
    return (YARD_X0 - 2.0 <= x <= YARD_X1 + 2.0
            and YARD_Y0 - 2.0 <= y <= YARD_Y1 + 2.0)


def service_ramp_z(x, y):
    """Cota do asfalto interno em (x, y), ou None se ali nao ha via interna.

    UMA COPIA SO da rampa: ver svc_surface_z. Eram duas — esta e a `svc_z`
    local de build_service_roads — e elas ja tinham divergido em qual folga
    aplicavam, que e como a laje passava POR CIMA da boca do entroncamento."""
    if not on_service_road(x, y, pad=FLARE_R + 0.5):
        return None
    return svc_surface_z(x, y)


# 3 m, NAO 6,5. O rebaixo tem de cobrir o corredor da via inteiro (ver
# yard_surface), e quanto mais longo o retorno mais larga fica a depressao que
# acompanha cada rua. 3 m e mais que a celula da laje (2,2 m) — logo nenhum
# vertice fica preso a meio da transicao — e curto o bastante para o que se ve
# ser a laje a cair para a sarjeta, e nao um vale.
SLAB_BLEND = 3.0           # em quantos metros a laje volta ao nivel dela


def yard_surface(x, y):
    """A laje, REBAIXADA onde uma via interna desce para encontrar a pista.

    ESTE ERA O DEFEITO DA JUNCAO, e nao era a curva: era ordem de superficies.
    A rampa da via interna desce de +15 cm ate -5,5 cm para casar com o asfalto
    da pista. A laje, porem, e um plano SOLIDO a +12 cm que comeca no dorso do
    meio-fio. Entao os primeiros 5 m da rampa — a boca inteira do entroncamento —
    passavam POR BAIXO do concreto, e o que aparecia era laje cobrindo a juncao.

    O REBAIXO AGORA ENTRA EM RAMPA, e essa e a segunda correcao. Ele era um
    RETANGULO: `on_service_road(pad=6,5)` ligado, tudo dentro rebaixado, tudo
    fora nao. Longe da pista isso nao aparece, porque ali o rebaixo vale zero —
    mas dentro dos 5 m de rampa o rebaixo chega a 20 cm, e o contorno da caixa
    virava um DEGRAU DE 20 CM correndo paralelo a via, 6,5 m ao lado dela. Uma
    laje de patio com um degrau reto no meio do nada e exatamente a leitura de
    "a altura esta bugada".

    Com o peso caindo por smoothstep ate zero em SLAB_BLEND, o rebaixo vira uma
    concordancia — que e o que ele e em obra: o piso acompanha o rebaixo da
    entrada e volta ao nivel alguns metros depois, sem quina nenhuma.
    """
    z = yard_z(x, y)
    for x0, x1, y0, y1 in SERVICE_ROADS:
        if not (x0 - 0.5 <= x <= x1 + 0.5):
            continue
        off = 0.0
        for _cx, side, e, my0, my1 in get_mouths():
            if abs(my0 - y0) > 1e-6 or abs(my1 - y1) > 1e-6:
                continue
            off = max(off, flare_offset((x - e) * side))
        d = max(y0 - off - y, y - (y1 + off), 0.0)
        if d > SLAB_BLEND:
            continue
        k = 1.0 - d / SLAB_BLEND
        k = k * k * (3.0 - 2.0 * k)
        # A LAJE TEM DE PASSAR POR BAIXO DA VIA, SEMPRE — e desligar isto foi o
        # erro que fez "a textura do patio vazar para a rua".
        #
        # Enquanto a via interna era um recapeamento POR CIMA da laje, quem
        # cobria quem estava resolvido pela propria cota. Baixando a via 6 cm
        # para ela ficar ao nivel da pista, a relacao inverteu-se: a laje passou
        # a ser a superficie mais alta dentro do corredor da via, e o motor
        # desenha-a por cima do asfalto — concreto do patio no meio da rua.
        #
        # O rebaixo existia exatamente para isto e eu tinha-o condicionado a
        # "so onde a guia nao da conta", raciocinando sobre o degrau na BORDA e
        # esquecendo o corredor INTEIRO. Volta a ser incondicional.
        target = svc_surface_z(x, y) - 0.03
        if target < z:
            z += (target - z) * k
    return z


def median_z(x, y):
    """O canteiro. Mesmo datum da laje, com o relevo amortecido."""
    # O canteiro e grama, mas grama CONTIDA entre duas guias: se ele ondular
    # mais que a laje, o dorso do meio-fio que o retem volta a variar. Segue a
    # laje, com um resto de relevo proprio para nao ficar um plano morto.
    return YARD_Z + undul(x, y) * (SLAB_FLAT * 1.4)


def outland_z(x, y):
    """A cota do campo FORA da cerca — e ela tem de ser UMA funcao.

    ERA DUAS, E ESSE ERA O "PISCANDO" MAIS GRAVE DA CENA. `outer` (a brita,
    plana em -0,30 com +/-7 cm de relevo proprio) e `out_n/s/e/w` (a grama, em
    -0,28 com relevo que chega a +/-1,5 m) sao dois planos INDEPENDENTES
    cobrindo exatamente a mesma faixa de 150 a 590 m. O comentario do build
    dizia "OUTER FIELD first and lowest, so nothing it meets can z-fight with
    it" — e isso era verdade antes de cada um dos dois ganhar seu proprio
    relevo, depois do que os 2 cm de folga nao significam mais nada.

    Medido em 20 000 amostras do campo: a brita fica ACIMA da grama em 52,4 %
    da area, com penetracao maxima de 91 cm. Nao e z-fighting fino que so
    aparece de longe — sao duas superficies trancadas uma na outra, e e
    exatamente o mosqueado bege/oliva que aparece alem do cinturao de arvores
    no render de cima.

    Agora a brita e derivada DESTA cota (menos uma folga fixa), entao ela nao
    pode mais emergir, seja qual for o relevo que se ponha aqui.
    """
    t = min(1.0, max(0.0, (max(abs(x), abs(y)) - YARD_HALF) / 130.0))
    return -0.28 + t * (2.4 * (fbm(x / 190.0, y / 190.0, 53, 4) - 0.5)
                        + 0.7 * (fbm(x / 46.0, y / 46.0, 97, 3) - 0.5))


def surface_z(x, y):
    """The height of whatever is at (x, y): road, median, yard or grass.

    ESTA FUNCAO NAO SABIA QUE EXISTEM VIAS INTERNAS, e e por isso que "as linhas
    nao estao seguindo corretamente". Toda marcacao que nao passa um z_fn cai
    aqui, e aqui a laje era `yard_z` — o plano teorico a +12 cm. Mas a laje real
    e `yard_surface`, REBAIXADA em toda a caixa do entroncamento para deixar a
    rampa passar, e por cima dela ainda vem o recapeamento da via interna, que
    desce a -5,5 cm ao encontrar a pista.

    Medido na ultima divisa do estacionamento, em (11, -34): a laje ali esta a
    -3,4 cm e a marcacao era assentada a +12 cm. Quinze centimetros de tinta
    pairando, com sombra propria, atravessando o meio-fio da boca — exatamente
    o toco branco solto que aparece no render de cima.
    """
    cx = road_cx(x)
    if cx is not None:
        return road_z(x, cx)
    if on_service_paving(x, y):
        return svc_surface_z(x, y)
    if ROAD_B_X + _EDGE <= x <= ROAD_A_X - _EDGE:
        return median_z(x, y)                      # the median
    if YARD_X0 <= x <= YARD_X1 and YARD_Y0 <= y <= YARD_Y1:
        return yard_surface(x, y)
    return grass_z(x, y)


# ---------------------------------------------------------------------------
# Layout.
#
# Read as a street. Road A is the truck's; road B is the through road west of
# the median. The logistics half — docks, warehouses, the site office — is EAST
# of road A, because that is the side a truck is served from. The process half —
# tanks, columns, racks, stacks — is WEST of road B, pushed back far enough that
# none of it is ever in the orbit.
#
# EVERYTHING IS AXIS-ALIGNED, AND THAT IS THE POINT. An earlier pass scattered
# pieces at 12, 18, 40, 215, 250 degrees and read as debris dropped on a field
# rather than as a plant. Real industrial sites are set out on a survey grid:
# buildings run parallel or perpendicular to the access road because the pipe
# runs, the rail spurs and the drainage all do. So every rotation is 0, 90, 180
# or 270.
#
# THE HEIGHT RULE. Nothing over 8 m tall stands within 60 m of road A. This used
# to be done at load time by the manifest's `pushback` block; it is baked in
# here now, and that block has to come out of environments.json.
#
#   (source, key, x, y, rotZ deg, note)
# ---------------------------------------------------------------------------
# 60 -> 45. "Levemente afastados da rua" was the ask, and 60 m was not slightly:
# it was the single biggest reason the plant read as scattered, because it
# pushed every tall piece — which is most of the process side — past a 60 m
# no-man's-land the low buildings could not fill on their own. 45 m still keeps
# a 24 m chimney out of a 31 m orbit by a wide margin.
TALL_SETBACK = 45.0

# DESLOCAMENTO DO SITIO, e ele pertence AO BUILD, nao ao arquivo de layout.
#
# O app estaciona o caminhao na origem, entao "por o caminhao na faixa esquerda"
# e "move-lo para frente" so podem ser feitos movendo o CENARIO. As pecas do
# editor ficam num referencial local — o mesmo que o editor desenha — e o sitio
# inteiro e posto no mundo por estes dois numeros.
#
# POR QUE NAO NO layout.json. Foi assim na primeira versao e quebrou na primeira
# oportunidade: um layout salvo numa sessao anterior do editor trazia o `site`
# antigo junto, sem o deslocamento, e o build obedeceu ao arquivo. Resultado —
# as construcoes num referencial e as ruas noutro, 3,25 m e 25 m de diferenca.
# Layout guarda ONDE AS PECAS ESTAO ENTRE SI; o build guarda onde o sitio fica.
SHIFT_X = 3.25
SHIFT_Y = -25.0

# PACKED INTO ROWS, WITH SERVICE GAPS. Every coordinate here was recomputed
# from the pieces' measured footprints (listed in ibc1.py and logged by
# dl_packs) so that neighbours sit 5-15 m apart rather than 20-40. That is not a
# style preference: a plant with 30 m of empty concrete between every unit is a
# car park with machinery parked on it, and audit_layout now MEASURES it and
# prints SPRAWL for anything whose nearest neighbour is further than 16 m.
#
# The rows, east to west:
#
#   x  ~15..33   pipe racks, running along the road as a low wall
#   x  ~29..66   the front row: docks, sheds, office — what a truck comes to
#   x  ~65..105  the second row: long halls and the barrel warehouse
#   x ~103..133  the tall row: chimney stacks, block cluster
#   x   0, -25   the two carriageways and the median
#   x -36..-57   the car park
#   x -38..-58   tank, basin, process block
#   x -60..-85   the office cluster the car park belongs to
#   x -85..-155  the process side, tallest furthest
LAYOUT = [
    # ---- EAST of road A: the logistics side. Low, close, facing the road.
    ("dl", "dock",     (  40.0,  16.0),  90, "loading docks"),
    ("dl", "shed_old", (  39.0, -14.0),   0, "old warehouse"),
    ("dl", "office",   (  40.0, -40.0),   0, "site office"),
    ("dl", "shed_sm",  (  40.0,  42.0),   0, "small warehouse"),
    ("dl", "hall_big", (  48.0,  74.0),   0, "main hall + canopy"),

    # ---- EAST, second row.
    ("ibc", 12,        (  80.0,  18.0),   0, "long hall"),
    ("ibc", 14,        (  78.0, -46.0),   0, "barrel warehouse"),
    # 92, not 82: the east cross street runs y 52..60 and the shed's footprint
    # started at 57.2, i.e. a service road through a building.
    ("ibc", 15,        (  78.0,  92.0),   0, "long shed"),
    ("ibc", 13,        (  86.0, -92.0),   0, "block cluster 11 m"),

    # ---- EAST, the tall row and the pipe racks on the kerb line.
    ("ibc", 11,        ( 118.0,  20.0),   0, "chimney stacks 24 m"),
    # 17, not 22: at 22 its east face overlapped the dock sheds by 1.6 m. A pipe
    # rack hard against the kerb line is also what a pipe rack does.
    ("ibc", 2,         (  17.0, 116.0),  90, "pipe rack 50 m"),
    ("ibc", 1,         (  22.0, -74.0),  90, "pipe rack 30 m"),

    # ---- WEST of road B: yard gear, then the offices the car park serves.
    ("ibc", 10,        ( -44.0, -54.0),   0, "white storage tank"),
    ("ibc", 7,         ( -42.0, -68.0),   0, "basin"),
    # 11.2 m at 51 m broke height <= near/5. Moved out rather than exempted.
    ("ibc", 6,         ( -66.0, -26.0),   0, "process block 11 m"),
    # THE OFFICE CLUSTER. The studio's default view looks west over the truck,
    # so this row IS the hero shot's middle distance — and the first render of
    # it was bare concrete with a car park drawn on it. A car park belongs to a
    # door; without one it reads as markings in a field.
    ("dl", "midcentury_a", ( -72.0,  22.0),  90, "office block"),
    ("dl", "midcentury_b", ( -72.0,  60.0),  90, "workshop"),
    ("dl", "midcentury_c", ( -82.0,  -4.0),   0, "stores"),
    ("dl", "midcentury_d", ( -70.0, 102.0),  90, "training block"),

    # ---- WEST, the process side. Tallest furthest, all past TALL_SETBACK.
    ("ibc", 5,         ( -96.0, -70.0),   0, "column + vessel 29 m"),
    ("ibc", 8,         (-106.0,  30.0),   0, "plant complex 24 m"),
    ("ibc", 4,         (-118.0, -114.0),  0, "process unit + turbine"),
    ("ibc", 3,         (-125.0, 112.0),   0, "drum racks / walkway 38 m"),

    # ---- NORTH: the gate.
    ("dl", "booth",    (  12.0, 226.0),   0, "gate booth"),
    ("ibc", 9,         ( -14.0, 224.0),   0, "vent pole at the gate"),
]

# REPEATS, AND WHY THEY ARE ALLOWED HERE.
#
# An older note in this file forbade cloning outright — "the collection is
# SIXTEEN PIECES and the reference uses each one ONCE" — after a build that
# tripled the district into 34 pieces and stopped being the reference at all.
# That lesson was about inventing two more FACTORIES, and it still stands for
# the process side: there is one plant complex, one turbine hall, one set of
# stacks, because a site has one of each.
#
# It was over-applied to the sheds. A logistics yard genuinely has three or four
# near-identical dock sheds in a row — that is what a shed IS — and refusing to
# repeat them is a large part of why the front row had 30 m holes in it.
#
# These are LINKED duplicates: `dup.data = src.data`, so each costs one node and
# zero vertices, and the glTF exporter emits them as instances.
#
#   (source, key, x, y, rotZ, note)
DUPES = [
    # the dock row: four bays of the same shed, which is how one gets built
    ("dl", "dock",     (  40.0, 108.0),  90, "dock shed 2"),
    ("dl", "dock",     (  40.0, 138.0),  90, "dock shed 3"),
    ("dl", "shed_old", (  39.0, -66.0),   0, "old warehouse 2"),
    ("dl", "shed_sm",  (  40.0, -92.0),   0, "small warehouse 2"),
    ("dl", "shed_sm",  (  40.0, -114.0),  0, "small warehouse 3"),
    # second row, filling north of the long shed
    ("ibc", 14,        (  78.0, 136.0),   0, "barrel warehouse 2"),
    ("ibc", 15,        ( 112.0, 100.0),   0, "long shed 2"),
    ("ibc", 12,        ( 124.0, -60.0),   0, "long hall 2"),
    # west yard gear: tank farms come in pairs, basins in banks
    ("ibc", 10,        ( -44.0, -40.0),   0, "storage tank 2"),
    ("ibc", 7,         ( -42.0, -78.0),   0, "basin 2"),
    ("ibc", 7,         ( -42.0, -88.0),   0, "basin 3"),
    ("dl", "shed_old", ( -46.0, 120.0),   0, "west store"),
    ("dl", "office",   ( -46.0, 146.0),   0, "west office 2"),
]

# The mid-century file explodes into ~16 separate buildings (dl_packs
# .split_midcentury). They are two-storey masonry offices and workshops — the
# wrong thing to put inside a process plant and exactly the right thing to put
# ACROSS THE ROAD FROM IT, where they do the job the deleted second ring was
# invented for: they close the horizon without inventing another factory.
#
# Placed along the far south and the far north, they read as the district the
# plant sits in. Coordinates are (x, y, rot); the list is consumed in order and
# runs out when the buildings do.
MIDCENTURY_SITES = [
    (-158.0, 272.0,   0), (-104.0, 276.0,   0), ( -52.0, 270.0,   0),
    (  46.0, 274.0,   0), ( 100.0, 270.0,   0), ( 152.0, 276.0,   0),
    (-146.0, -270.0, 180), ( -88.0, -274.0, 180), ( -32.0, -268.0, 180),
    (  56.0, -272.0, 180), ( 112.0, -268.0, 180),
]

# Containers, skips and cabinets. 6 m boxes beside a 19 m rig are the best scale
# cue an open yard has — but scattered they read as loose props, so they are
# STACKED AND GROUPED the way a yard actually stores them.
# The container is 6.1 m LONG and 2.3 m WIDE, and the pitch has to follow the
# rotation or the boxes are inside each other.
#
# THAT IS THE "TEXTURA PISCANDO". It was never a texture: the rot-90 group was
# laid on a 2.5 m pitch along y, which is the pitch for the 2.3 m WIDTH — but at
# 90 degrees it is the 6.1 m LENGTH that runs along y, so each box overlapped the
# next by 3.6 m. Three containers occupying one container's volume is 3.6 m of
# coplanar rusty steel, and coplanar surfaces flicker. The placement audit now
# reports this as STACK rather than leaving it to be read off a screenshot.
#
#   rot 0  -> 6.1 along x, 2.3 along y  -> pitch 2.5 along y
#   rot 90 -> 2.3 along x, 6.1 along y  -> pitch 6.3 along y
CONTAINERS = [
    ( 24.0, -28.0, 90), ( 24.0, -34.3, 90), ( 24.0, -40.6, 90),
    ( 62.0,  60.0,  0), ( 62.0,  62.5,  0), ( 62.0,  65.0,  0),
    (-40.0,  74.0,  0), (-40.0,  76.5,  0),
    (-58.0, -100.0, 90),
]
SKIPS = [(30.0, -30.0, 12), (56.0, 32.0, -8)]
CABINETS = [(9.6, 60.0, 180), (9.6, -100.0, 180), (-34.5, 128.0, 0)]

# Vent poles, well clear of the orbit.
POLES = [(-38, 44), (58, 104), (-60, -96)]


# IBC1 pieces to thin, and the ratio. index -> keep fraction.
#
# THESE THREE ARE 5.4 MB OF THE EXPORT BETWEEN THEM — model_3 alone was 2.29 MB,
# more than every texture in the file put together. They are the open lattice
# pieces (drum racks, two pipe racks), which are expensive for the obvious
# reason: a truss is mostly edges. All three stand between 120 and 200 m from
# the origin, behind the near buildings, and none is ever the subject of a shot.
#
# Decimation is applied DESTRUCTIVELY because the export runs with
# export_apply=False — a Decimate modifier left unapplied ships at full density
# and quietly does nothing.
IBC_THIN = {3: 0.45, 1: 0.5, 2: 0.5}


# Internal service roads — (x0, x1, y0, y1) in metres.
#
# WHY THEY ARE FLUSH ASPHALT ON THE SLAB AND NOT REAL CARRIAGEWAYS. A proper
# road needs a level, a camber, a channel and a kerb, and where it met road A it
# would need a junction that reconciles the slab (+12 cm) with the carriageway
# (0 to -5.5 cm). An internal plant road is not built that way in life either:
# it is an asphalt overlay laid ON the concrete apron, 3-5 cm proud, marked but
# not kerbed. So that is what these are — which is simultaneously the honest
# construction and the one that cannot produce a level mismatch.
#
# They are laid in the gaps the building rows already leave, so they explain the
# gaps instead of the gaps being leftovers.
# Deslocadas com o resto do sitio: +3,25 em X (a via principal andou meia faixa)
# e -20 em Y (o caminhao foi para frente).
# AS PONTAS ENCOSTAM NA PISTA, nao no meio-fio.
#
# Antes comecavam em 10,45 — 8 cm depois do dorso do meio-fio — e paravam ali. A
# via interna fica na laje (+15 cm) e a pista esta a -5 cm, entao a "juncao" era
# 20 cm de degrau com uma tira de concreto no meio: a rua nao se encontrava com
# a rua. Agora vao ate a BORDA DO PAVIMENTO (ROAD_W/2) e a cota desce em rampa
# nos ultimos metros — ver svc_z. E o rebaixo que existe em qualquer entrada.
SERVICE_ROADS = [
    # A RUA DA DOCA ACABA EM x=62, e ela ia a 135,25.
    #
    # Dois motivos, e o primeiro nao tem nada a ver com o pedido. A laje termina
    # em x=109,25: os ultimos 26 m dessa rua eram asfalto correndo POR CIMA da
    # faixa de grama, abrindo o meio-fio do canteiro perimetral, e morrendo 15 m
    # antes da cerca. Uma rua que sai do piso e para no mato.
    #
    # O segundo e o que destravou a mudanca pedida. O "long hall" tem 64,4 m e a
    # faixa livre entre esta rua e a transversal tinha 63 m: o galpao NAO CABIA
    # entre as duas, e por isso ele estava com a ponta sul 6,7 m dentro da
    # transversal. Nao havia para onde "mover um pouco para dentro" — ao norte
    # batia aqui, ao sul batia nos pipe racks. Encurtar a rua ate x=62 devolve a
    # faixa: ela continua servindo tudo o que servia (galpao principal ate x=47,8,
    # contêineres ate x=56) e deixa de atravessar a testada do galpao.
    (   9.75,  62.00,  27.0,  35.0),   # east cross street, dock frontage
    # Encurtada de -142,75 pelo mesmo motivo da rua da doca: a laje comeca em
    # -108,75, entao os 34 m finais eram asfalto por cima da faixa de grama, com
    # o meio-fio do canteiro perimetral aberto para deixar passar uma rua que nao
    # servia nada ali. Agora ela morre dentro do patio, com arremate de guia.
    ( -106.00, -27.99,  63.0,  71.0),  # west cross street, office row
    # TRANSVERSAL COMPLETA, atravessando as duas pistas e o canteiro. As duas
    # acima morrem numa pista so; esta liga os dois lados do sitio, que e o que
    # falta para o patio funcionar como um patio e nao como duas metades.
    ( -106.0, 103.0, -44.0, -36.0),
]

# ---------------------------------------------------------------------------
# ENTRONCAMENTOS — a geometria da boca, num lugar so.
#
# O "L" TERRIVEL ERA TRES DEFEITOS SOMADOS, e nenhum deles era o raio:
#
# 1. O MEIO-FIO E A SARJETA SUMIAM NUM RETANGULO. build_kerbs e build_yard_edge
#    apagavam tudo dentro de `on_service_road(pad=6.5)` — uma CAIXA de 21 m de
#    frente. A concordancia, que e um quarto de circulo, nao tem nada a ver com
#    uma caixa: sobrava meio-fio pendurado onde a curva ja tinha aberto, e
#    faltava meio-fio onde ela ja tinha fechado. Ver i_junc.png: a peca preta
#    termina no ar, com a ponta aberta, dos dois lados da boca.
#
# 2. AS UV NAO ERAM REFEITAS. add_grid escreve uv = posicao/8 e SO DEPOIS o
#    build empurrava os vertices da borda para abrir a boca. As UV ficaram as do
#    retangulo: o asfalto da concordancia saia esticado ate 2,5x — literalmente
#    "perder as texturas".
#
# 3. A BORDA DA CONCORDANCIA MANTINHA O DEGRAU DE 3 cm. O arremate que abaixa a
#    borda ate a laje testa `abs(v.co.y - y0) < eps` DEPOIS de mover o vertice,
#    entao justamente os vertices da curva nao casavam mais e ficavam com o
#    friso escuro que o arremate existe para matar.
#
# A boca correta e uma so curva servindo tres coisas: o asfalto vai ate o raio
# R, a sarjeta ocupa os 45 cm imediatamente FORA dele e o meio-fio os 17 cm
# seguintes. Como tudo e concentrico no mesmo centro, as tres se encontram por
# construcao e nao por ajuste.
#
#   d = distancia da borda da pista;  recuo(d) = R - sqrt(R^2 - (R-d)^2)
#
# que e a mesma expressao que a borda do asfalto ja usava — de proposito: o
# meio-fio TEM de ser tangente ao asfalto que ele contorna.
FLARE_R = 6.0            # raio da concordancia, medido na borda do pavimento
FLARE_MIN_SPAN = 20.0    # abaixo disso o trecho e a ligacao pelo canteiro
MOUTH_TAPER = 8.0        # arremate do meio-fio depois do arco, em rampa

# ---------------------------------------------------------------------------
# ABERTURA DO CANTEIRO — a mesma boca, num raio menor.
#
# A ligacao pelo canteiro nao cabe numa concordancia de 6 m (ela tem 11,74 m e
# mora inteira nos 10,5 m de canteiro), e por isso ficou de fora de `mouths()`.
# Mas "nao cabe 6 m" nunca quis dizer "canto em esquadro", e era exatamente isso
# que estava construido: as quatro quinas da abertura em angulo reto.
#
# O RAIO E 2 m: o menor que ainda le como concordancia na rasante e o maior que
# cabe sem comer o canteiro — o recuo da grama e R - 62 cm = 1,38 m de cada
# lado, num canteiro de 10,5 m de largura.
#
# AS QUATRO PECAS SAO O MESMO CIRCULO, e e so por isso que nao abre buraco:
#
#   asfalto    r > R          build_service_roads, via mouth_flare
#   sarjeta    [R-45, R]      build_median_noses -> _corner_arc
#   meio-fio   [R-62, R-45]   idem
#   canteiro   r < R-62       build_ground, via flare_offset(R-62)
#
# JA FOI CONSTRUIDO EM PECAS SEPARADAS e o resultado esta em
# 09-canteiro-elevado-e-buracos.png: o nariz do canteiro parava no dorso do
# meio-fio enquanto a canaleta longitudinal ja tinha aberto 62 cm, e sobrava um
# quadrado de 62 x 62 cm em cada quina por onde aparecia a brita 63 cm abaixo.
# Quem garante o fechamento aqui nao e o ajuste, e o centro unico: nas duas
# pontas do arco os quatro raios caem sobre as retas que eles continuam.
MEDIAN_GAP_R = 2.0

# QUEM ENCOSTA NUM ARCO ENCOSTA NUMA CORDA, e essa e a diferenca entre a boca de
# 6 m (que fecha) e esta aqui (que nao fechava). As tres pecas concordam sobre o
# CIRCULO, mas cada uma o inscreve com o seu proprio passo: o asfalto por coluna
# da grelha, a guia por passo angular, o canteiro por coluna da grelha dele. Tres
# poligonos inscritos no mesmo circulo com passos diferentes nao coincidem —
# sobra uma fresta de corda entre eles, medida em 0,4 a 6,8 cm.
#
# Na boca de 6 m isso nunca apareceu porque o PATIO passa por baixo de tudo ali:
# a fresta existe e mostra laje. Na abertura do canteiro nao ha nada por baixo, e
# a fresta mostra a brita 63 cm abaixo.
#
# Duas correcoes, e nenhuma delas e "calibrar o passo" (isso nao fecha: onde um
# poligono tem vertice o outro tem meio de corda, seja qual for a resolucao):
#
#   MED_TUCK   o canteiro para 8,5 cm DENTRO do meio-fio em vez de rente ao
#              dorso dele. 8,5 cm e meia largura de guia, entao a grama fica
#              debaixo de um solido 3,5 cm mais alto e some — e a corda dela,
#              que afunda no maximo 6 cm, ainda cai fora do dorso.
#   o forro    uma superficie de asfalto 5 cm abaixo do MENOR entre canteiro e
#              via, cobrindo a abertura inteira. Derivada, como `outer`, para
#              que nao possa emergir; o que sobrar de fresta mostra asfalto
#              escuro em vez de brita clara.
MED_TUCK = KERB_W / 2.0


# ---------------------------------------------------------------------------
# QUEM ATRAVESSA O CANTEIRO — e a resposta e NINGUEM, num sitio so.
#
# O canteiro deixou de abrir para a transversal (ver `breaks`, em build_ground),
# e a correcao foi aplicada tres vezes em tres sitios: `gap_mouths` esvaziou,
# `_channel_runs` parou de abrir a canaleta de dentro e `build_service_roads`
# parou de deitar asfalto no trecho do meio. Cada um desses sitios anotou-se a
# si proprio como "o ultimo".
#
# NAO ERAM TRES, ERAM CINCO. `build_median_noses` continuava a atravessar o
# canteiro de lado a lado com guia e sarjeta em CADA transversal que cruzasse o
# par de pistas, e o forro de asfalto continuava a ser emitido por baixo da
# grama — o teste dele (`[] if not breaks else ...`) ja nao dizia o que dizia,
# porque `breaks` ganhou o nariz norte e deixou de poder ser vazio. O que se via
# era exatamente o que os outros tres cortes existiam para tirar: DOIS friso
# escuros a cortar o canteiro de ponta a ponta, 40 m a frente do caminhao, sem
# travessia nenhuma entre eles.
#
# Nao ha aqui condicao nova: ha UMA leitura, e as quatro pecas da travessia
# (vao do canteiro, quinas, nariz e forro) passam a le-la. Reabrir a travessia
# volta a ser uma linha — devolver as transversais que atravessam —, e as quatro
# voltam juntas em vez de tres delas.
def median_crossings():
    """As transversais que ATRAVESSAM o canteiro: (x0, x1, y0, y1).

    Vazia enquanto o canteiro correr inteiro. Devolver aqui as de SERVICE_ROADS
    que cruzam as duas pistas reabre a travessia com tudo o que ela precisa.
    """
    return []


def svc_spans(x0, x1):
    """Parte um trecho de via interna nos pedacos que NAO ficam sobre uma pista.

    Uma transversal que atravessa o sitio cruza as duas pistas. Deitar asfalto
    por cima delas seria uma segunda superficie quase coplanar com a primeira —
    cintilacao garantida — e alem disso errado: num cruzamento quem manda e a
    via principal, o pavimento dela e continuo e a transversal encosta de cada
    lado. Entao ela e emitida em pedacos.

    NIVEL DE MODULO porque build_kerbs precisa da MESMA lista que
    build_service_roads: e a divergencia entre as duas leituras do que e um
    entroncamento que produzia meio-fio sem asfalto e asfalto sem meio-fio.
    """
    cuts = sorted((cx - ROAD_W / 2.0, cx + ROAD_W / 2.0)
                  for cx in (ROAD_A_X, ROAD_B_X))
    out, a = [], x0
    for lo, hi in cuts:
        if hi <= a or lo >= x1:
            continue
        if lo > a:
            out.append((a, min(lo, x1)))
        a = max(a, hi)
    if a < x1:
        out.append((a, x1))
    return [(p, r) for p, r in out if r - p > 1.0]


def mouths():
    """Toda boca que merece concordancia: (cx, side, e, y0, y1).

    `side` +1 = a via interna sai para LESTE da pista, -1 para oeste. `e` e a
    borda do pavimento onde ela encosta.

    O TRECHO CURTO NAO ENTRA, e essa excecao e geometrica e nao estetica. A
    ligacao entre as duas pistas tem 11,7 m e mora INTEIRA dentro do canteiro de
    10,5 m. Alargar as pontas dela em 6 m poria asfalto sobre a grama do
    canteiro nos dois extremos e deixaria o vao do canteiro (derivado de
    SERVICE_ROADS, reto) sem nada por baixo no meio — o mesmo buraco de brita
    que ja custou uma correcao. Uma abertura de canteiro nao e uma boca com
    meio-fio, e nao deve virar uma.
    """
    # E A BOCA VOLTADA PARA O CANTEIRO NAO EXISTE MAIS.
    #
    # Este era o segundo sitio do mesmo defeito, e foi o que sobrou depois de
    # fechar `_channel_runs`: o canteiro deixou de abrir, mas a transversal
    # continuava a declarar boca no lado INTERNO de cada pista — e uma boca traz
    # consigo o vao na canaleta e o arco de `build_service_kerbs`. O resultado e
    # o meio-fio do canteiro interrompido por um retangulo de cantos
    # arredondados no meio da grama, com a grama inteira por baixo.
    #
    # Uma via que nao pode atravessar o canteiro nao tem boca do lado dele: ela
    # entra e sai pela direita. `inner` sai da posicao das duas pistas.
    med_x = (ROAD_A_X + ROAD_B_X) / 2.0
    out = []
    for x0, x1, y0, y1 in SERVICE_ROADS:
        for sx0, sx1 in svc_spans(x0, x1):
            if sx1 - sx0 < FLARE_MIN_SPAN:
                continue
            for cx in (ROAD_A_X, ROAD_B_X):
                inner = -1 if cx > med_x else 1
                if inner != 1 and abs(sx0 - (cx + ROAD_W / 2.0)) < 0.5:
                    out.append((cx, 1, cx + ROAD_W / 2.0, y0, y1))
                if inner != -1 and abs(sx1 - (cx - ROAD_W / 2.0)) < 0.5:
                    out.append((cx, -1, cx - ROAD_W / 2.0, y0, y1))
    return out


def gap_mouths():
    """As quatro quinas da abertura do canteiro: (cx, side, e, y0, y1).

    Mesmo formato de `mouths()` e mesma construcao; o que muda e o raio, que e
    MEDIAN_GAP_R. Sao os trechos que `mouths()` recusa — os curtos, que moram
    dentro do canteiro. Separado e nao unificado porque o raio nao e o unico
    disso que difere: aqui nao ha arremate em rampa (o nariz atravessa a largura
    toda), nao ha linha de bordo contornando (a abertura tem 11,7 m, uma linha
    ali diria "nao cruze" no unico ponto onde cruzar e o proposito) e quem
    constroi o arco e build_median_noses e nao build_service_kerbs.
    """
    # VAZIO DESDE QUE O CANTEIRO DEIXOU DE ABRIR. A abertura do canteiro foi
    # fechada (ver a nota em `breaks`, em build_ground), e estas quatro quinas
    # so existem para arrematar essa abertura: sem ela, o que elas desenhariam
    # seria meio-fio em arco no meio da grama. A funcao fica — com a construcao
    # inteira preservada — porque reabrir a travessia e uma linha em `breaks`, e
    # entao ela volta a ser precisa exactamente como esta.
    return []


MOUTHS = None            # preenchido no primeiro uso; SERVICE_ROADS ja existe
GAP_MOUTHS = None


def get_mouths():
    global MOUTHS
    if MOUTHS is None:
        MOUTHS = mouths()
    return MOUTHS


def get_gap_mouths():
    global GAP_MOUTHS
    if GAP_MOUTHS is None:
        GAP_MOUTHS = gap_mouths()
    return GAP_MOUTHS


def road_flares(sx0, sx1):
    """Os fins de trecho que ganham concordancia, com o raio de cada um.

    Devolve [(e, sgn, r)] para o trecho de via interna [sx0, sx1] — FLARE_R nos
    trechos longos, MEDIAN_GAP_R na ligacao pelo canteiro. UMA leitura so, para
    que asfalto, guia e canteiro nao possam discordar sobre onde a curva comeca.
    """
    r = FLARE_R if (sx1 - sx0) >= FLARE_MIN_SPAN else MEDIAN_GAP_R
    ends = []
    for cx in (ROAD_A_X, ROAD_B_X):
        if abs(sx0 - (cx + ROAD_W / 2.0)) < 0.5:
            ends.append((cx + ROAD_W / 2.0, 1.0, r))
        if abs(sx1 - (cx - ROAD_W / 2.0)) < 0.5:
            ends.append((cx - ROAD_W / 2.0, -1.0, r))
    return ends


def flare_offset(d, r=FLARE_R):
    """Recuo da borda a uma distancia `d` da pista. Vale r junto a pista (boca
    cheia) e zero em d=r (tangente a reta). E o quarto de circulo, nao uma rampa
    reta disfarcada."""
    if d < 0.0 or d > r:
        return 0.0
    return r - math.sqrt(max(0.0, r * r - (r - d) ** 2))


def mouth_flare(x, ends):
    """Quanto a borda da via interna recua em (x), pelas bocas em `ends`.

    `ends` e [(e, sgn, r)] com sgn +1 se a via sai para leste da borda `e`. O
    RAIO VEM NA TUPLA e nao de FLARE_R: a abertura do canteiro usa 2 m e o resto
    usa 6 m, e um raio implicito aqui era a forma mais barata de o asfalto curvar
    num raio e o meio-fio noutro.
    """
    best = 0.0
    for e, sgn, r in ends:
        best = max(best, flare_offset((x - e) * sgn, r))
    return best


def in_mouth_kerb(x, y, cx, side, e, y0, y1):
    """O vertice esta na parte da borda que ganha meio-fio de verdade?

    Vale do encontro com a pista ate o fim do arremate. Fora disso a borda da
    via interna continua sendo um recapeamento sarrafeado ate a laje.
    """
    d = (x - e) * side
    return -0.5 <= d <= FLARE_R + MOUTH_TAPER


def on_service_paving(x, y):
    """Dentro do asfalto da via interna, JA CONTANDO a concordancia.

    O retangulo de SERVICE_ROADS nao e o pavimento: a boca alarga ate 6 m alem
    dele. Quem precisa saber disso e todo mundo que assenta alguma coisa no
    chao — a cota de uma marcacao, e se uma vaga esta pintada em cima de um
    entroncamento.
    """
    for x0, x1, y0, y1 in SERVICE_ROADS:
        if not (x0 - 0.05 <= x <= x1 + 0.05):
            continue
        off = 0.0
        for ms, r in ((get_mouths(), FLARE_R), (get_gap_mouths(), MEDIAN_GAP_R)):
            for _cx, side, e, my0, my1 in ms:
                if abs(my0 - y0) > 1e-6 or abs(my1 - y1) > 1e-6:
                    continue
                off = max(off, flare_offset((x - e) * side, r))
        if y0 - off <= y <= y1 + off:
            return True
    return False


def _line_meets_service(a, b, clear=0.5, n=8):
    """O segmento a-b encosta no pavimento de uma via interna?"""
    for k in range(n + 1):
        t = k / float(n)
        x = a[0] + (b[0] - a[0]) * t
        y = a[1] + (b[1] - a[1]) * t
        for dx, dy in ((0.0, 0.0), (clear, 0.0), (-clear, 0.0),
                       (0.0, clear), (0.0, -clear)):
            if on_service_paving(x + dx, y + dy):
                return True
    return False


def svc_surface_z(x, y):
    """Cota da via interna, descendo em rampa ate a pista no entroncamento.

    A RAMPA E O QUE FAZ AS DUAS RUAS SE ENCONTRAREM. A laje esta 12 cm acima da
    pista por construcao (o meio-fio segura terreno mais alto), entao uma via
    interna deitada na laje chega 20 cm acima do asfalto. Sem transicao isso e
    um degrau que nenhum veiculo sobe — e le como as duas ruas nao se tocando. A
    rampa acontece em 5 m, que e o comprimento de um rebaixo de entrada de
    verdade.

    O `max` com o canteiro e uma folga de 3 mm que nao custa nada e fecha um
    caso de borda real: a laje usa `undul` cheio e o canteiro usa 0,6 dele, de
    modo que nos pontos mais fundos do relevo o canteiro pode subir ate 3,2 cm
    acima da laje — exatamente a espessura do recapeamento. Onde a transversal
    cruza o canteiro isso e grama emergindo pelo asfalto.
    """
    # A TRAVESSIA SUBSTITUI A GRAMA, NAO SE APOIA NELA — e era isso o
    # "continua mais alto naquela separacao do canteiro".
    #
    # Medido no .glb: canteiro em z 0,095..0,145 e a travessia sobre ele
    # chegando a 0,197. A conta que produzia isso era `max(laje+3cm,
    # canteiro+3cm)`, ou seja a via cruzava o canteiro deitada na cota do PATIO,
    # que usa `undul` cheio enquanto o canteiro usa 0,6 dele. Sobravam ate 6 cm
    # de asfalto acima da grama, mais 3,5 cm de guia por cima: uma faixa quase
    # 10 cm alta atravessando um canteiro que deveria ser o ponto alto dali.
    #
    # No canteiro a via nao e recapeamento sobre laje nenhuma: ela ocupa o lugar
    # da grama. Entao a cota dela E a do canteiro, e a guia volta a ser os 3,5 cm
    # que ela e em qualquer meio-fio.
    # E ELA NAO E MAIS UM RECAPEAMENTO POR CIMA DA LAJE.
    #
    # Os 3 cm existiam para os dois planos nao disputarem profundidade: a laje e
    # amostrada numa grelha de 2,2 m e a via na dela, e entre vertices comuns as
    # duas podem cruzar-se. Mas levantar a VIA para resolver isso e pagar o
    # z-fight com altura, e a altura era exatamente a queixa — a via somava os
    # 3 cm aos 12 da laje e acabava acima do dorso do meio-fio.
    #
    # A folga continua a existir; muda de lado. `yard_surface` ja REBAIXA a laje
    # ate `svc_surface_z - 3 cm` em toda a vizinhanca de uma via interna (era o
    # mecanismo que deixava a rampa do entroncamento passar). Com a via rente a
    # laje, esse mesmo rebaixo poe a laje 3 cm ABAIXO da via — a mesma margem,
    # obtida baixando o que nao se ve em vez de levantar o que se ve.
    if ROAD_B_X + _EDGE <= x <= ROAD_A_X - _EDGE:
        z = median_z(x, y) - SVC_DROP
    else:
        z = yard_z(x, y) - SVC_DROP
    for cx in (ROAD_A_X, ROAD_B_X):
        for sgn in (1.0, -1.0):
            e = cx + sgn * ROAD_W / 2.0
            t = (x - e) * sgn
            if -0.3 <= t < 5.0:
                k = max(0.0, min(1.0, t / 5.0))
                return road_z(e, cx) * (1.0 - k) + z * k
    return z

# Vagas pintadas — (x da testada, y inicial, nº de vagas, largura, profundidade).
#
# PERPENDICULARES AO MEIO-FIO, encostadas na rua A. As vagas antigas foram
# removidas por serem coordenadas orfas: descreviam um estacionamento que o
# editor tinha movido. Estas voltam porque foram PEDIDAS num lugar especifico e
# esse lugar tem o que justifica vaga — meio-fio de um lado, galpoes do outro.
# (x, y, vagas, largura, profundidade, eixo)
#
# eixo "y": a testada corre em Y e as vagas avancam para +X — encostadas no
#           meio-fio da rua A, que e o caso original.
# eixo "x": a testada corre em X e as vagas avancam para -Y — encostadas na
#           borda sul da transversal.
PARKING = [
    (11.0, -34.0, 19, 2.5, 5.0, "y"),
    # Pedido: mais um estacionamento na faixa ao sul da transversal, entre ela e
    # os galpoes. Comeca em x=20 e nao em x=15: dentro disso ainda e a boca do
    # entroncamento com a rua A, e o pavimento ali pertence a curva.
    (20.0, -45.0, 17, 2.5, 5.0, "x"),
]


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def thin_prototypes(ibc):
    # A CACHE JA VEM DECIMADA e redecimar nao e inofensivo: IBC_THIN tira 55 % do
    # model_3, e 45 % de 45 % deixa a torre de colunas com 20 % da malha — o que
    # em decimador de colapso nao e uma torre mais leve, e papel amassado.
    # prototypes.glb e exportado DEPOIS desta funcao (export_editor.py chama
    # thin_prototypes antes de registar), entao o que esta na cache ja passou.
    cache = sys.modules.get("protos_cache")
    if cache is not None and cache.USED_CACHE.get("buildings"):
        log("  prototipos vieram da cache — thin_prototypes ignorado (ja aplicado)")
        return
    for idx, ratio in IBC_THIN.items():
        entry = ibc.get(idx)
        if not entry:
            continue
        ob = entry[0]
        n = len(ob.data.polygons)
        md = ob.modifiers.new("dec", "DECIMATE")
        md.ratio = ratio
        for o in bpy.data.objects:
            o.select_set(o is ob)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.modifier_apply(modifier=md.name)
        log("  thinned model_%d %d -> %d faces" % (idx, n, len(ob.data.polygons)))


def _load(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, name + ".py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def place(obj, x, y, rot_deg, on="yard"):
    """Prototypes are recentred on their own footprint with the floor on z=0, so
    placement is an assignment and a rotation about the object origin keeps the
    piece on its mark.

    THE Z IS SAMPLED, NOT ZERO. The yard is 12 cm above the road and undulates
    +/- 6 cm; dropping a building at z=0 would leave daylight under it on the
    high spots. It is sunk 6 cm below the sampled surface so the joint is always
    a building meeting ground, never a building hovering over it.
    """
    obj.rotation_mode = "XYZ"
    obj.rotation_euler = (0.0, 0.0, math.radians(rot_deg))
    z = surface_z(x, y) if on == "yard" else grass_z(x, y)
    obj.location = (x, y, z - 0.06)


def clone(src, name):
    """Linked duplicate: `dup.data = src.data`, NOT `.copy()`. The mesh datablock
    is shared, so a clone costs one object and one draw call and zero vertices."""
    dup = src.copy()
    dup.data = src.data
    dup.name = name
    bpy.context.collection.objects.link(dup)
    return dup


def world_bbox(obj):
    pts = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return (Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))),
            Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))))


def _meshes_touch(a, b):
    """As malhas de a e b realmente se cruzam? Sem objeto, assume que sim.

    BVH e nao amostragem: dois galpoes podem se cruzar so pela beirada do
    telhado, e uma grade de pontos passa por baixo disso. So roda para os pares
    que a envolvente ja aprovou, entao sao poucos.
    """
    if a is None or b is None:
        return True
    try:
        from mathutils.bvhtree import BVHTree
        dg = bpy.context.evaluated_depsgraph_get()
        ta = BVHTree.FromObject(a, dg)
        tb = BVHTree.FromObject(b, dg)
        return bool(ta.overlap(tb))
    except Exception as e:
        log("    BVH indisponivel (%s) — mantendo o teste por envolvente" % e)
        return True


def audit_layout(boxes):
    """Measure what the layout table actually produced.

    THIS IS THE PART THAT WAS ONCE MISSING. Four layouts were authored by
    writing coordinates and looking at a render, which catches nothing
    quantitative: not a building standing inside another, not a 30 m void that
    makes the plant read as scattered, not a piece blocking the truck. All three
    shipped. Reports OVERLAP, nearest-neighbour GAP, intrusion on CLEAR_RADIUS,
    and — new here — any tall piece inside TALL_SETBACK of road A.
    """
    bad = 0
    # A CAIXA ENVOLVENTE MENTE, e este audit acabou de ser pego mentindo.
    #
    # `ibc12` ("long hall") nao e um galpao: sao DOIS galpoes de ~15 m nas pontas
    # de um lote, com 33 m de patio vazio entre eles. A envolvente cobre os 64 m
    # inteiros, entao qualquer peca posta no vao — que e chao livre, e onde ela
    # visivelmente cabe — era reportada como OVERLAP com o galpao. Um audit que
    # acusa colisao com o ar treina quem o le a ignora-lo.
    #
    # Entao a envolvente vira o FILTRO BARATO e a malha da o veredito: so os
    # poucos pares cujas caixas se cruzam pagam um BVH, e so eles sao reportados.
    boxes = [(b + (None,))[:4] for b in boxes]
    for i in range(len(boxes)):
        li, lo_i, hi_i, ob_i = boxes[i]
        for j in range(i + 1, len(boxes)):
            lj, lo_j, hi_j, ob_j = boxes[j]
            ox = min(hi_i.x, hi_j.x) - max(lo_i.x, lo_j.x)
            oy = min(hi_i.y, hi_j.y) - max(lo_i.y, lo_j.y)
            if ox > 0.5 and oy > 0.5 and not _meshes_touch(ob_i, ob_j):
                log("  vao      %s x %s  (envolventes cruzam em %.1f x %.1f m,"
                    " malhas nao se tocam)" % (li, lj, ox, oy))
                continue
            if ox > 0.5 and oy > 0.5:
                # AS DUAS PEGADAS SAO IMPRESSAS, e nao so a interseccao. Saber
                # que dois predios se cruzam em 17 x 13 m nao diz para que lado
                # afastar; saber onde cada um comeca e acaba, diz.
                log("  OVERLAP  %s x %s  (%.1f x %.1f m)" % (li, lj, ox, oy))
                log("           %-22s x %7.1f..%7.1f  y %7.1f..%7.1f"
                    % (li, lo_i.x, hi_i.x, lo_i.y, hi_i.y))
                log("           %-22s x %7.1f..%7.1f  y %7.1f..%7.1f"
                    % (lj, lo_j.x, hi_j.x, lo_j.y, hi_j.y))
                bad += 1
    # NA RUA — a checagem que faltava, e e a classe de defeito que acabou de ser
    # relatada ("mova aquela que esta invadindo a rua"). O audit media sobreposicao
    # entre PECAS e distancia da rua A, mas nunca se uma peca estava POR CIMA de
    # uma via interna: a via e chao, nao e peca, entao nada colidia com ela.
    for li, lo_i, hi_i, _ob in boxes:
        for sx0, sx1, sy0, sy1 in SERVICE_ROADS:
            ox = min(hi_i.x, sx1) - max(lo_i.x, sx0)
            oy = min(hi_i.y, sy1) - max(lo_i.y, sy0)
            if ox > 0.3 and oy > 0.3:
                log("  NA RUA   %-22s invade a via interna (%.1f x %.1f m)"
                    % (li, ox, oy))
                bad += 1
    for li, lo_i, hi_i, _ob in boxes:
        h = hi_i.z - lo_i.z
        if h < 8.0:
            continue
        near_x = max(lo_i.x - ROAD_A_X, ROAD_A_X - hi_i.x, 0.0)
        if near_x < TALL_SETBACK:
            log("  SETBACK  %s is %.0f m tall and only %.0f m from road A"
                % (li, h, near_x))
            bad += 1
    for i in range(len(boxes)):
        li, lo_i, hi_i, _ob = boxes[i]
        dx = max(lo_i.x, 0.0, -hi_i.x)
        dy = max(lo_i.y, 0.0, -hi_i.y)
        if math.hypot(dx, dy) < CLEAR_RADIUS:
            log("  CLEAR    %s intrudes on the orbit (%.1f m)" % (li, math.hypot(dx, dy)))
            bad += 1
    # SPRAWL, WHICH IS THE METRIC THAT WAS MISSING. Overlap and clearance were
    # both measured; the thing nobody measured was EMPTINESS, and emptiness is
    # what the last build got wrong — "as construcoes ficam muito afastadas umas
    # das outras". A nearest-neighbour distance is one line of arithmetic and it
    # turns "looks scattered" into a number, which is the only form of it that
    # can be fixed on purpose.
    far = 0
    gaps = []
    for i in range(len(boxes)):
        li, lo_i, hi_i, _ob = boxes[i]
        best, who = 1e9, "-"
        for j in range(len(boxes)):
            if i == j:
                continue
            lj, lo_j, hi_j, _obj = boxes[j]
            dx = max(lo_i.x - hi_j.x, lo_j.x - hi_i.x, 0.0)
            dy = max(lo_i.y - hi_j.y, lo_j.y - hi_i.y, 0.0)
            d = math.hypot(dx, dy)
            if d < best:
                best, who = d, lj
        gaps.append(best)
        if best > 16.0:
            log("  SPRAWL   %-22s %5.1f m to its nearest neighbour (%s)"
                % (li, best, who))
            far += 1
    if gaps:
        gaps.sort()
        log("  gaps: median %.1f m, worst %.1f m, %d over 16 m"
            % (gaps[len(gaps) // 2], gaps[-1], far))
    log("  audit: %d problems over %d pieces" % (bad, len(boxes)))
    return bad


LAYOUT_JSON = os.path.join(HERE, "map-creator", "layout.json")


def layout_from_file(ibc, dl, path):
    """Place the district from map-creator/layout.json.

    THIS IS WHY THE EDITOR EXISTS. Every coordinate in the tables below was
    typed by hand and checked by looking at a render, and the record of that
    approach in this file is not good: buildings inside each other, a service
    road through a shed, a 30 m hole in a row, a plant that read as scattered
    across four separate attempts. The editor moves that work to a plan view
    with a live audit, and this function is the other half of the loop — the
    saved file WINS over the tables, so what was arranged is what gets built.

    The tables stay as the fallback and as the seed the exporter reads, so a
    fresh checkout still builds a district without anyone opening a browser.
    """
    with open(path, "r", encoding="utf-8") as f:
        doc = json.load(f)
    items = doc.get("items") or []
    shift_x, shift_y = SHIFT_X, SHIFT_Y
    log("  layout.json: deslocamento de sítio (%.2f, %.2f) m — do build, não do arquivo"
        % (shift_x, shift_y))
    used = set()
    boxes = []
    n = 0
    for it in items:
        key = it.get("key", "")
        entry = None
        if key.startswith("ibc") and key[3:].isdigit():
            entry = ibc.get(int(key[3:]))
        else:
            entry = dl.get(key)
        if entry is None:
            log("  layout.json: peça desconhecida %r" % key)
            continue
        src = entry[0]
        if key in used:
            ob = clone(src, "%s_%03d" % (key, n))
        else:
            ob = src
            used.add(key)
        # DESLOCAMENTO DE SITIO. "Mover o caminhao para frente" so pode ser
        # feito movendo o cenario — o app estaciona o veiculo na origem e nao ha
        # como desloca-lo pelo lado da cena. Aplicado aqui, e nao reescrevendo as
        # 43 pecas, para que o arquivo do editor continue sendo o que voce
        # arrumou; `site.shiftY` no layout.json guarda o mesmo numero para o
        # editor desenhar igual.
        place(ob, float(it.get("x", 0.0)) + shift_x,
              float(it.get("y", 0.0)) + shift_y,
              float(it.get("rot", 0.0)),
              on="yard" if it.get("inside", True) else "grass")
        s = float(it.get("scale", 1.0) or 1.0)
        if abs(s - 1.0) > 1e-3:
            ob.scale = (s, s, s)
        bpy.context.view_layer.update()
        lo, hi = world_bbox(ob)
        boxes.append((str(it.get("note") or key)[:18], lo, hi, ob))
        n += 1
    # OS PROTOTIPOS NAO USADOS TEM DE SUMIR.
    #
    # A tabela embutida posicionava todo modelo do pacote, entao nunca sobrava
    # nenhum. Um layout do editor NAO tem essa obrigacao — e nem deveria: usar 43
    # das 37 pecas do catalogo, repetindo umas e dispensando outras, e
    # exatamente o que o editor serve para permitir.
    #
    # So que um prototipo nunca posicionado continua onde foi importado: na
    # ORIGEM. E a origem e onde o caminhao estaciona. O sintoma no log e uma
    # peca "a 0 m" da orbita; na tela sao prédios empilhados sobre o veiculo.
    # Mesma armadilha ja corrigida para os props e para as plantas.
    dropped = 0
    for pool in (ibc, dl):
        for key, entry in list(pool.items()):
            ob = entry[0]
            tag = ("ibc%02d" % key) if isinstance(key, int) else key
            if tag not in used:
                bpy.data.objects.remove(ob, do_unlink=True)
                pool.pop(key, None)
                dropped += 1
    if dropped:
        log("  layout.json: %d protótipos não usados removidos da origem" % dropped)

    audit_layout(boxes)
    log("  layout.json: %d peças posicionadas (%s)" % (n, os.path.basename(path)))
    return n


def layout(ibc, dl):
    if os.path.exists(LAYOUT_JSON):
        try:
            if layout_from_file(ibc, dl, LAYOUT_JSON):
                return
        except Exception as e:
            log("  layout.json ilegível (%s) — usando a tabela embutida" % e)
    return layout_tables(ibc, dl)


def layout_tables(ibc, dl):
    boxes = []
    used = 0
    mc_keys = sorted(k for k in dl if k.startswith("mc_"))
    mc_next = [0]

    def pick(source, key):
        if source == "ibc":
            return ibc.get(key)
        if key.startswith("midcentury_"):
            # a named draw from the mid-century pool, for the one office block
            # that belongs inside the fence
            if mc_next[0] < len(mc_keys):
                k = mc_keys[mc_next[0]]
                mc_next[0] += 1
                return dl.get(k)
            return None
        return dl.get(key)

    resolved = {}
    for source, key, (x, y), rot, note in LAYOUT:
        entry = pick(source, key)
        if entry is None:
            log("  MISSING %s/%s (%s)" % (source, key, note))
            continue
        ob = entry[0]
        resolved[(source, key)] = ob
        place(ob, x, y, rot)
        bpy.context.view_layer.update()
        lo, hi = world_bbox(ob)
        dx = max(lo.x, 0.0, -hi.x)
        dy = max(lo.y, 0.0, -hi.y)
        near = math.hypot(dx, dy)
        log("  %-14s -> (%7.1f,%7.1f) rot %3d  h=%5.1f near=%5.1f"
            % (note[:14], x, y, rot, hi.z - lo.z, near))
        boxes.append((note[:18], lo, hi))
        used += 1

    # ---- the repeats, into the SAME audit ---------------------------------
    # They go through world_bbox and into `boxes` exactly like the originals,
    # because a duplicate standing inside another building is still a building
    # standing inside another building.
    n_dup = 0
    for source, key, (x, y), rot, note in DUPES:
        src = resolved.get((source, key))
        if src is None:
            log("  MISSING dupe source %s/%s (%s)" % (source, key, note))
            continue
        d = clone(src, "dup_%02d" % n_dup)
        place(d, x, y, rot)
        bpy.context.view_layer.update()
        lo, hi = world_bbox(d)
        boxes.append((note[:18], lo, hi))
        n_dup += 1
    log("  repeats: %d linked duplicates" % n_dup)

    # the mid-century district, outside the wire
    n = 0
    for x, y, rot in MIDCENTURY_SITES:
        if mc_next[0] >= len(mc_keys):
            break
        entry = dl.get(mc_keys[mc_next[0]])
        mc_next[0] += 1
        if entry is None:
            continue
        place(entry[0], x, y, rot, on="grass")
        n += 1
    log("  mid-century district: %d buildings outside the wire" % n)

    entry = ibc.get(0)
    if entry:
        for i, (x, y, rot) in enumerate(CONTAINERS):
            place(clone(entry[0], "cont_%02d" % i), x, y, rot)
        place(entry[0], -50.0, 104.0, 0)
        log("  containers: %d" % (len(CONTAINERS) + 1))

    entry = ibc.get(9)
    if entry:
        for i, (x, y) in enumerate(POLES):
            place(clone(entry[0], "pole_%02d" % i), x, y, rnd.uniform(0, 360))
        log("  vent poles: %d" % len(POLES))

    entry = dl.get("skip")
    if entry:
        for i, (x, y, rot) in enumerate(SKIPS[1:]):
            place(clone(entry[0], "skip_%02d" % i), x, y, rot)
        place(entry[0], SKIPS[0][0], SKIPS[0][1], SKIPS[0][2])
        log("  skips: %d" % len(SKIPS))

    entry = dl.get("cabinet")
    if entry:
        for i, (x, y, rot) in enumerate(CABINETS[1:]):
            place(clone(entry[0], "cab_%02d" % i), x, y, rot)
        place(entry[0], CABINETS[0][0], CABINETS[0][1], CABINETS[0][2])
        log("  cabinets: %d" % len(CABINETS))

    audit_layout(boxes)
    log("  layout: %d/%d placed" % (used, len(LAYOUT)))


# ---------------------------------------------------------------------------
# Ground materials.
#
# These carry NO textures. They are NAMED SLOTS — the engine binds
# `/textures/asphalt_*`, `/textures/concrete_*` etc. to them at load time from
# environments.json `set.materials`. That keeps set.glb small and reuses the PBR
# sets the app already ships instead of baking a second copy of the same 4K
# asphalt into every environment.
#
# ANY NAME ADDED HERE MUST BE ADDED TO environments.json TOO — and the reverse
# matters more than it looks: set.ts collectSolids treats a mesh whose materials
# are ALL declared in that block as ground, i.e. not an obstacle the camera has
# to dodge. That is right for grass and paint and wrong for a fence, which is
# why the fence materials below are deliberately NOT named there.
# ---------------------------------------------------------------------------
def mat(name, base=(0.5, 0.5, 0.5, 1.0), rough=0.9, metal=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    if b:
        b.inputs["Base Color"].default_value = base
        b.inputs["Roughness"].default_value = rough
        b.inputs["Metallic"].default_value = metal
    return m


def add_grid(name, w, d, material, cx=0.0, cy=0.0, cuts=1, uv_scale=8.0,
             on_terrain=True, dz=0.0, flat_z=None, z_fn=None, cuts_y=None):
    """A subdivided plane that FOLLOWS the terrain.

    `cuts` matters more than it looks: the vertex-colour patchiness below is
    only as fine as the topology carrying it, and this is the surface the whole
    scene stands on.

    IT ALSO COSTS MORE THAN IT LOOKS, and `cuts_y` exists because of it. Every
    ground vertex carries position, normal, UV and COLOR_0 — about 40 bytes —
    and a square grid spends them uniformly whether or not the surface is
    square. A 13 x 1180 m carriageway cut 130 x 130 was sampling the ground
    every 10 CENTIMETRES across the road and every 9 METRES along it, and it
    cost 1.5 MB of the export per carriageway to get the ratio exactly backwards.
    """
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=max(1, cuts), y_segments=max(1, cuts_y or cuts),
                          size=0.5, matrix=Matrix.Identity(4))
    bmesh.ops.scale(bm, vec=(w, d, 1.0), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(cx, cy, 0.0), verts=bm.verts)
    uv = bm.loops.layers.uv.new("UVMap")
    for v in bm.verts:
        if z_fn is not None:
            v.co.z = z_fn(v.co.x, v.co.y) + dz
        else:
            v.co.z = (flat_z if flat_z is not None
                      else (yard_z(v.co.x, v.co.y) if on_terrain else 0.0)) + dz
    for f in bm.faces:
        for l in f.loops:
            l[uv].uv = (l.vert.co.x / uv_scale, l.vert.co.y / uv_scale)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    return ob


def reuv(ob, uv_scale=8.0):
    """Reescreve a UV a partir da posicao ATUAL do vertice.

    add_grid escreve a UV enquanto constroi, o que e certo — mas qualquer coisa
    que mova um vertice depois disso deixa a UV para tras, e a textura passa a
    ser a de onde o vertice ESTAVA. Na concordancia isso vale um fator de 2,5 de
    estiramento no ponto exato que a camera olha.
    """
    me = ob.data
    uv = me.uv_layers.active
    if uv is None:
        return
    for li, loop in enumerate(me.loops):
        co = me.vertices[loop.vertex_index].co
        uv.data[li].uv = (co.x / uv_scale, co.y / uv_scale)
    me.update()


def _corridor_tail(name, cw0, cw1, y0, material, uv_scale, z_fn, seed):
    """A laje que fecha o corredor viario a SUL do balao.

    O bordo de cima nao e uma recta, e o ARCO SUL do disco do balao: para cada
    abscissa, a laje sobe ate onde o asfalto do balao comeca. Feito com uma
    recta, ou sobrava a meia-lua entre a recta e o circulo (brita a vista), ou a
    laje passava POR CIMA do lobo sul do balao — e a laje esta 12 cm acima da
    pista, portanto ganharia o teste de profundidade e poria uma tampa de betao
    sobre o retorno. E o mesmo par de erros que o docstring de add_slab conta
    ter custado as duas pistas inteiras.
    """
    cols = 34
    rows = 5
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    grid = []
    for c in range(cols + 1):
        x = cw0 + (cw1 - cw0) * c / float(cols)
        dx = x - ROUNDABOUT_CX
        under = ROUNDABOUT_RO * ROUNDABOUT_RO - dx * dx
        y_top = ROUNDABOUT_CY - math.sqrt(under) if under > 0.0 else ROUNDABOUT_CY
        y_top = max(y_top, y0 + 0.5)
        col = []
        zf = z_fn or yard_surface
        for r in range(rows + 1):
            y = y0 + (y_top - y0) * r / float(rows)
            col.append(bm.verts.new((x, y, zf(x, y))))
        grid.append(col)
    for c in range(cols):
        for r in range(rows):
            bm.faces.new((grid[c][r], grid[c][r + 1],
                          grid[c + 1][r + 1], grid[c + 1][r]))
    for f in bm.faces:
        for l in f.loops:
            l[uv].uv = (l.vert.co.x / uv_scale, l.vert.co.y / uv_scale)
    me = bpy.data.meshes.new("%s_tail" % name)
    ob = bpy.data.objects.new("%s_tail" % name, me)
    bpy.context.collection.objects.link(ob)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    paint_variation(ob, seed=seed + 2.4)
    return [ob]


def add_slab(name, x0, x1, y0, y1, material, cell=4.5, uv_scale=8.0, z_fn=None,
             seed=1.0):
    """A rectangle of ground WITH THE ROAD CORRIDOR CUT OUT.

    THIS IS THE FIX FOR THE BUG THAT HID BOTH CARRIAGEWAYS. Making the yard sit
    ABOVE the road — which is what a kerb retaining made ground means — quietly
    inverted an assumption the whole ground stack had relied on since it was
    written: that the road is the HIGHEST surface, so it can be laid straight
    across everything else and simply win the depth test. It was, at z=0, over a
    yard at -14 cm.

    At +12 cm the yard stopped losing that test and became a 468 m concrete lid
    over both roads, the gutters, the kerbs and every marking on them. The
    top-down render is unambiguous: a plant with a green median and no roads
    either side of it.

    So ground that would span the corridor is emitted as two slabs instead, and
    the corridor itself is owned by exactly the meshes that belong there — the
    two carriageways, their gutters and kerbs, and the median between them.
    Surfaces BELOW the road (outland at -28 cm, outer at -30 cm) are left whole:
    they never contested it in the first place.
    """
    cw0, cw1 = ROAD_B_X - _EDGE, ROAD_A_X + _EDGE
    out = []

    # O RECORTE SO VALE ONDE O CORREDOR TEM DONO, e isso deixou de ser sempre.
    #
    # Ele corria a ALTURA INTEIRA do retangulo, porque quando foi escrito a pista
    # tambem corria os 1180 m. Com ela a terminar no balao, o corredor a sul dele
    # ficou sem dono nenhum — nem pista, nem sarjeta, nem canteiro, nem laje — e
    # o que aparecia por baixo era a brita do campo, 37 cm abaixo. Dava-se em
    # DOIS sitios de uma vez: nos ~26 m de laje entre o balao e YARD_Y0, e na
    # faixa de turfa `turf_s` inteira, que fica toda a sul do disco. A mancha
    # castanha ao lado do balao em t_balao.png era a soma das duas.
    road_lo = ROUNDABOUT_CY - ROUNDABOUT_RO
    if y1 <= road_lo or y0 >= ROAD_Y1:
        w, d = x1 - x0, y1 - y0
        if w > 0.5 and d > 0.5:
            ob = add_grid("%s_0" % name, w, d, material,
                          cx=(x0 + x1) / 2.0, cy=(y0 + y1) / 2.0,
                          cuts=max(2, int(w / cell)), cuts_y=max(2, int(d / cell)),
                          uv_scale=uv_scale, z_fn=z_fn)
            paint_variation(ob, seed=seed)
            out.append(ob)
        return out

    spans = []
    if x0 < cw0:
        spans.append((x0, min(x1, cw0)))
    if x1 > cw1:
        spans.append((max(x0, cw1), x1))
    if y0 < road_lo:
        out += _corridor_tail(name, cw0, cw1, y0, material, uv_scale, z_fn, seed)
    for i, (a, b) in enumerate(spans):
        w, d = b - a, y1 - y0
        if w <= 0.5 or d <= 0.5:
            continue
        ob = add_grid("%s_%d" % (name, i), w, d, material,
                      cx=(a + b) / 2.0, cy=(y0 + y1) / 2.0,
                      cuts=max(2, int(w / cell)), cuts_y=max(2, int(d / cell)),
                      uv_scale=uv_scale, z_fn=z_fn)
        paint_variation(ob, seed=seed + i * 0.7)
        out.append(ob)
    return out


def paint_variation(ob, seed=0.0, road_wear=False, cx=0.0):
    """Bake large-scale patchiness into the ground's vertex colours.

    A tiled PBR set repeated 200 times across a kilometre reads as one flat tone
    at distance: every tile averages to the same colour, so the plane looks
    painted rather than paved. Vertex colour multiplies the albedo, so a few
    octaves of low-frequency noise give the wear, damp and old-repair variation
    a real yard has, at the cost of one COLOR_0 attribute and no extra texture.

    FLOAT_COLOR on the CORNER domain via color_attributes, NOT the legacy
    vertex_colors API — that one makes a BYTE_COLOR layer, and a byte channel
    cannot hold what this writes. And the layer must be ACTIVE: Blender's glTF
    exporter writes the mesh's ACTIVE colour attribute, and a freshly added one
    is not automatically active. Several builds' worth of ground variation was
    computed, stored and then dropped for exactly that reason, shipping an
    all-white COLOR_0 while the log happily reported the range it had computed.
    """
    me = ob.data
    for a in list(me.color_attributes):
        me.color_attributes.remove(a)
    attr = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="CORNER")
    try:
        me.color_attributes.active_color = attr
        me.color_attributes.render_color_index = me.color_attributes.find("Col")
    except Exception as e:
        log("    could not set active colour attribute: %s" % e)
    # ---- BANDA LIMITADA PELA PROPRIA MALHA ------------------------------
    #
    # ISTO E O "A TEXTURA DA RUA PRINCIPAL PARECE DIFERENTE DAS OUTRAS", e a
    # causa e aliasing, nao material: a pista e uma tira de 13 x 1180 m cortada
    # 10 x 150, ou seja um vertice a cada 1,3 m atravessado e a cada 7,9 m ao
    # longo. A oitava fina deste campo tem 5 m de periodo. Amostrar 5 m de cada
    # 7,9 m nao produz detalhe fino: produz manchas longas e arbitrarias — que e
    # exatamente o aspecto borrado e remendado que a pista tinha e o patio (com
    # celula de 2,2 m, que resolve os 5 m) nao tinha.
    #
    # O peso da oitava que a malha nao aguenta e REDISTRIBUIDO para as que ela
    # aguenta, em vez de simplesmente descartado — senao a superficie perde
    # contraste junto e fica lavada. O detalhe fino de verdade nesta escala vem
    # do `macro` do manifesto, que e por fragmento e nao depende de vertice
    # nenhum; este campo aqui so tem por que carregar a variacao larga.
    #
    # A celula e MEDIDA e nao passada por parametro: um percentil alto do
    # comprimento das arestas pega a direcao GROSSA de uma malha anisotropica,
    # que e a que limita.
    el = []
    for e in me.edges:
        a = me.vertices[e.vertices[0]].co
        b = me.vertices[e.vertices[1]].co
        el.append((a - b).length)
        if len(el) >= 4000:
            break
    el.sort()
    cell = el[int(0.9 * (len(el) - 1))] if el else 1.0
    w_b, w_m, w_f = 0.56, 0.30, 0.14
    # CINCO AMOSTRAS POR PERIODO, NAO DUAS E MEIA — e este numero foi MEDIDO
    # contra o defeito, num A/B de tres renders do mesmo enquadramento:
    #
    #   base            manchas quadradas no patio e na pista
    #   COLOR_0 branco  as manchas DESAPARECEM
    #   ladrilho x40    as manchas CONTINUAM
    #
    # Ou seja: os "varios quadrados seguidos" nunca foram a textura, eram este
    # campo. E a razao esta nos numeros do proprio log: `road_a` tem celula de
    # 7,9 m e carregava a oitava de 22 m — 2,8 amostras por periodo. Nyquist
    # deixa passar (>2), mas Nyquist so promete que o sinal e recuperavel, nao
    # que a RECONSTRUCAO seja parecida com ele: interpolar linearmente entre
    # vertices a 2,8 amostras por periodo devolve um mosaico de quadrilateros,
    # com a derivada a saltar em cada aresta. O olho le a aresta, nao o ruido.
    #
    # A cinco amostras a reconstrucao linear ja e suave e a malha desaparece.
    # O preco e que a pista, o canteiro e a grama ficam SO com a mancha larga —
    # e por isso esta mudanca nao vive sozinha: o detalhe medio e fino passou
    # para o macro por fragmento (set.ts), que nao tem malha nenhuma e portanto
    # nao tem celula nenhuma. A malha carrega o que consegue reconstruir; o
    # fragmento carrega o resto.
    SAMPLES = 5.0
    p_f = max(5.0, cell * SAMPLES)
    if p_f > 12.0:                       # ja seria a oitava media
        w_b += w_f * 0.35
        w_m += w_f * 0.65
        w_f = 0.0
    if cell * SAMPLES > 22.0:            # nem a de 22 m
        w_b += w_m
        w_m = 0.0
    log("    banda %-9s celula %.1f m -> pesos %.2f/%.2f/%.2f fina %.1f m"
        % (ob.name[:9], cell, w_b, w_m, w_f, p_f))

    # ---- UM CAMPO SO PARA O SITIO INTEIRO -------------------------------
    #
    # ISTO E "AS RUAS SECUNDARIAS ESTAO COM OUTRA TEXTURA DIFERENTE", e nao era
    # textura: medido no .glb, pista e via interna usam o MESMO material
    # (ASPHALT_ROAD) e a MESMA escala de UV (8 m por unidade). O que diferia era
    # o COLOR_0 — porque cada malha recebia uma SEMENTE PROPRIA.
    #
    # Duas sementes diferentes sao dois campos estatisticamente independentes. A
    # mancha larga tem 90 m de periodo, entao uma via de 78 m cabe inteira dentro
    # de uma unica mancha: ela sai clara de ponta a ponta enquanto a pista ao
    # lado esta escura, e o olho nao le "duas manchas", le "dois materiais". A
    # fronteira entre elas e uma reta, o que fecha a leitura.
    #
    # Sujeira e propriedade do LUGAR, nao da malha. Com uma semente unica o campo
    # atravessa as bordas: a mancha que escurece o fim do patio continua na via
    # que sai dele, que e o que acontece em obra e o que faz o chao parecer um
    # chao so. Tambem e o que responde a "muito padronizada, nao organica" —
    # nada mais tem contorno com a forma da malha que o carrega.
    lo_k, hi_k = 1e9, -1e9
    s = 0
    # UMA VEZ POR VERTICE, NAO POR CANTO. O campo so depende de (x, y), e um
    # vertice de grelha aparece em quatro loops: era quatro vezes a mesma conta.
    # A folga paga a deformacao de dominio, que custa tres avaliacoes em vez de
    # uma, e ainda sobra.
    cache = {}
    for li, loop in enumerate(me.loops):
        vi = loop.vertex_index
        k = cache.get(vi)
        if k is None:
            v = me.vertices[vi].co
            x, y = v.x, v.y
            #   broad   whole regions of the yard damp or bleached  (~90 m)
            #   medium  wear around where things stand               (~22 m)
            #   fine    the grain that keeps it from looking airbrushed (~5 m)
            n = w_b * fbm_org(x / 90.0, y / 90.0, s, 4)
            if w_m:
                n += w_m * fbm_org(x / 22.0, y / 22.0, s + 71, 4)
            if w_f:
                n += w_f * fbm_org(x / p_f, y / p_f, s + 131, 3)
            # fBm piles up around 0.5, so a straight remap wastes most of the
            # range: expanding about the midpoint spends all of it and gives the
            # yard genuinely light and genuinely dark regions rather than a grey
            # wobble.
            #
            # SATURA MACIO. O corte duro em 0 e 1 nao so limitava: ele criava
            # PLATOS — regioes inteiras exatamente no mesmo valor, com um
            # contorno nitido onde o corte comecava. Um plato de tom uniforme com
            # borda definida e, no olho, uma mancha PINTADA, e a borda dela
            # herdava a forma quadrada do ruido. tanh chega perto dos extremos
            # sem nunca os atingir: mesmo contraste, sem contorno.
            n = 0.5 + 0.5 * math.tanh((n - 0.5) * 3.4)
            k = 0.46 + 0.62 * n
            cache[vi] = k
        v = me.vertices[vi].co
        x, y = v.x, v.y
        if road_wear:
            # Two darker bands where wheels actually track, and a lighter crown
            # between them: the read every driver has of every road.
            for lane in (cx - 3.1, cx + 3.1):
                k *= 1.0 - 0.16 * math.exp(-((x - lane) ** 2) / 2.2)
            k *= 1.0 + 0.05 * math.exp(-((x - cx) ** 2) / 3.0)
        k = max(0.38, min(1.0, k))
        lo_k = min(lo_k, k)
        hi_k = max(hi_k, k)
        # Damp ground is slightly cooler as well as darker; a pure grey ramp
        # reads as a lighting artefact rather than as a wet patch.
        attr.data[li].color = (k, k * 0.995, min(1.0, k * 0.982), 1.0)
    me.update()
    # READ BACK. Logging the k we computed only proves we did arithmetic; it
    # says nothing about whether the attribute kept it, which is exactly the
    # distinction that hid the all-white bug for several builds.
    rb = me.color_attributes.get("Col")
    r0 = min(c.color[0] for c in rb.data)
    r1 = max(c.color[0] for c in rb.data)
    log("    vcol %-9s computed %.2f..%.2f  stored %.2f..%.2f  (%d loops)"
        % (ob.name[:9], lo_k, hi_k, r0, r1, len(me.loops)))


# ---------------------------------------------------------------------------
# Painted markings.
#
# THE OLD MARKINGS WERE THE MOST ARTIFICIAL THING ON THE SITE, and not because
# of where they were: because every one of them was a single flat quad at one
# flat tone. Paint does not behave like that. It wears off in the wheelpath
# first, it survives in the gutter where nothing drives, it goes patchy over a
# rough patch of asphalt, and a bay at the far end of a yard nobody uses has
# been gone for years. One tone across every mark says "decal" no matter how
# good the tone is.
#
# So a mark here is not a quad. It is a STRIP subdivided along its own length,
# carrying COLOR_0 wear from four independent sources:
#
#   * an fBm field in world space, so neighbouring marks agree about which part
#     of the yard is worn — wear that stops at a mark's boundary is just another
#     way of drawing a rectangle
#   * the wheelpath, ~3.1 m either side of a carriageway's centreline
#   * a per-mark random health, so entire bays fade out while their neighbours
#     do not
#   * a touch of edge softening across the mark's width, because paint thins at
#     the edge of the roller
# ---------------------------------------------------------------------------
# A TINTA SOBE COM A DISTANCIA, e isso e aritmetica de depth buffer, nao gosto.
#
# O buffer e LINEAR de 24 bits (scene.ts explica por que nao e logaritmico: um
# depth escrito no shader desliga o polygonOffset da GPU, e o estudio depende
# dele nos decalques do veiculo). A resolucao vale ~ z^2*(far-near)/(near*far*2^24).
# Com near ~0,3 e far 700 isso da 2,0e-7 * z^2 metros: 0,8 mm a 60 m — de sobra
# para os 1,2 cm de origem — mas 1,8 cm a 300 m e 7 cm a 590 m.
#
# E a linha de bordo corre os 1180 m INTEIROS da pista. Ou seja: do portao para
# fora, cada faixa pintada estava abaixo da precisao do buffer e disputava
# profundidade com o asfalto — a cintilacao na rua indo para o horizonte.
#
# 4,5e-7 FOI LONGE DEMAIS e a primeira tentativa esta registrada aqui de
# proposito. Ela dava 17 cm de levantamento a 590 m — invisivel em subtensao
# angular, mas NAO na rasante: a 2 m de altura de camera a linha se descola do
# asfalto, ganha sombra propria e vira um friso branco de pe sobre a pista. Foi
# o "as linhas nao estao seguindo corretamente".
#
# O termo quadratico continua certo, o que estava errado era achar que ele podia
# cobrir 590 m. A resposta e cobrir MENOS ESTRADA: alem de MARK_MAX_R a faixa ja
# e sub-pixel e nao ha nada para preservar, e uma rodovia sem faixa depois da
# divisa e o que existe na vida real. Com 240 m, 1,0e-7 da 1,8 cm no extremo
# contra 1,1 cm de necessidade — 1,6x de folga, e 1,3 cm a 100 m, que ninguem ve.
MARK_DZ_K = 1.0e-7
MARK_MAX_R = 240.0


def add_marks(name, material, marks, seg_len=0.75, dz=0.012, z_fn=None):
    """`marks` is a list of (cx, cy, w, d, rot_deg, health).

    `health` 1.0 is fresh paint, 0.0 is gone. Everything else is measured off
    the world position, so the same yard looks the same from mark to mark.
    """
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    zf = z_fn or (lambda x, y: surface_z(x, y))
    health_of = {}
    for m in marks:
        cx, cy, w, d, rot, health = m
        rot = math.radians(rot)
        c, s = math.cos(rot), math.sin(rot)
        # subdivide along the LONGER axis, which is the direction paint wears
        # along; a 5 m bay line split into one quad wears uniformly and that is
        # the whole failure being fixed
        n = max(1, int(round(max(w, d) / seg_len)))
        along_y = d >= w
        # A LADDER, NOT A PILE OF QUADS. Built as independent quads, a 5 m bay
        # line was 7 segments x 4 unstitched vertices = 28; as shared
        # cross-sections it is 16, and the seam between two segments stops being
        # a place where the wear value can disagree with itself.
        sections = []
        for k in range(n + 1):
            t = k / float(n) - 0.5
            pair = []
            for e in (-0.5, 0.5):
                lx, ly = (e * w, t * d) if along_y else (t * w, e * d)
                x = cx + lx * c - ly * s
                y = cy + lx * s + ly * c
                lift = dz + MARK_DZ_K * (x * x + y * y)
                v = bm.verts.new((x, y, zf(x, y) + lift))
                health_of[v] = health
                pair.append(v)
            sections.append(pair)
        for k in range(n):
            a0, a1 = sections[k]
            b0, b1 = sections[k + 1]
            f = bm.faces.new((a0, a1, b1, b0))
            for l in f.loops:
                l[uv].uv = (l.vert.co.x, l.vert.co.y)
    bm.verts.index_update()
    hv = {}
    for v, h in health_of.items():
        hv[v.index] = h
    bm.to_mesh(me)
    bm.free()

    attr = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="CORNER")
    try:
        me.color_attributes.active_color = attr
        me.color_attributes.render_color_index = me.color_attributes.find("Col")
    except Exception:
        pass
    lo_k, hi_k = 1e9, -1e9
    for li, loop in enumerate(me.loops):
        vi = loop.vertex_index
        p = me.vertices[vi].co
        x, y = p.x, p.y
        health = hv.get(vi, 1.0)
        # broad + fine wear, in WORLD space so it crosses mark boundaries
        n = 0.62 * fbm(x / 17.0, y / 17.0, 401, 4) + 0.38 * fbm(x / 3.1, y / 3.1, 457, 3)
        k = 0.30 + 1.05 * n
        cx = road_cx(x)
        if cx is not None:
            for lane in (cx - 3.1, cx + 3.1):
                k *= 1.0 - 0.42 * math.exp(-((x - lane) ** 2) / 2.6)
        k *= 0.30 + 0.75 * health
        k = max(0.10, min(1.0, k))
        lo_k = min(lo_k, k)
        hi_k = max(hi_k, k)
        # Worn paint does not go grey, it goes the colour of what is under it,
        # so the ramp is warmed very slightly toward the asphalt rather than
        # desaturated toward black.
        attr.data[li].color = (k, k * 0.985, k * 0.95, 1.0)
    me.update()
    me.materials.append(material)
    log("    %-10s %d marks -> %d faces, wear %.2f..%.2f"
        % (name, len(marks), len(me.polygons), lo_k, hi_k))
    return ob


def _dashes(cx, out, y0, y1, mark=3.0, gap=6.0, w=0.14, health=1.0):
    """CONTRAN dash spacing, 3 m mark / 6 m gap, with the geometry jittered.

    A dashed line laid on an exact 9 m pitch with an exact 3 m mark is a ruler,
    and the eye reads rulers as CG instantly. Real dashes are sprayed by a
    machine following a driver: the pitch drifts, the marks vary a few
    centimetres, and every so often one is short because the gun blocked.
    """
    y = y0
    i = 0
    while y < y1:
        j = _hash01(int(y), int(cx * 10), 733)
        m = mark * (0.88 + 0.24 * j)
        h = health * (0.55 + 0.55 * _hash01(int(y) * 3, i, 907))
        if _hash01(int(y), i, 331) > 0.06:          # the occasional missing dash
            out.append((cx + (j - 0.5) * 0.05, y + m / 2.0, w, m, 0.0, h))
        y += m + gap * (0.9 + 0.2 * _hash01(i, int(y), 137))
        i += 1


def _bay_rows(out, x0, y0, rows, per_row, bay_w=2.5, bay_d=5.0, aisle=6.5,
              line=0.12, along_y=True):
    """A parking aisle: two ranks of bays nose to nose with a lane between.

    Only the DIVIDERS are painted, not a box per bay — a real lot paints a T at
    each division and a continuous line at the head of the rank, which is both
    what it looks like and a third of the geometry.
    """
    for r in range(rows):
        xr = x0 - r * (bay_d + aisle)
        for k in range(per_row + 1):
            y = y0 + k * bay_w
            h = 0.30 + 0.70 * _hash01(int(y * 4), r * 17 + k, 613)
            # whole stretches of a lot go unrepainted; this is what makes some
            # bays nearly invisible while their neighbour is crisp
            h *= 0.45 + 0.75 * fbm(xr / 26.0, y / 26.0, 811, 3)
            out.append((xr - bay_d / 2.0, y, bay_d, line, 0.0, min(1.0, h)))
        head = 0.55 + 0.45 * _hash01(r, int(y0), 271)
        out.append((xr - bay_d, y0 + per_row * bay_w / 2.0, line,
                    per_row * bay_w, 0.0, head))


EDGE_INSET = 0.42          # do bordo do pavimento ao eixo da linha


def mouth_edge_marks(q):
    """A linha de bordo contornando a boca — o arco que faltava.

    E O MESMO CENTRO DE TUDO O QUE JA ESTA NA BOCA. O asfalto vai ate o raio R,
    a sarjeta e o meio-fio ocupam os 62 cm por FORA dele, e a linha de bordo fica
    42 cm por DENTRO: raio R + 42 cm, concentrico. Nas duas pontas do arco esse
    raio cai exatamente sobre a reta que ele continua — em cima da pista, no eixo
    da linha reta; na via interna, a 42 cm da borda dela. Nao ha emenda a ajustar
    porque nao ha duas construcoes diferentes, so uma trocando de trecho.

    Depois do arco a linha segue reta pela borda da via interna ate encontrar a
    linha de bordo que build_service_roads ja desenha, fechando a volta.
    """
    r = FLARE_R + EDGE_INSET
    n = 0
    for mi, (cx, side, e, y0, y1) in enumerate(get_mouths()):
        for ci, (yc, sgn_y) in enumerate(((y0, -1.0), (y1, 1.0))):
            c = (e + side * FLARE_R, yc + sgn_y * FLARE_R)
            ty = -sgn_y
            steps = 12
            arc = r * math.pi / 2.0
            for k in range(steps):
                u = (k + 0.5) / steps
                a = u * math.pi / 2.0
                px = c[0] - side * r * math.cos(a)
                py = c[1] + ty * r * math.sin(a)
                # o eixo local +y da marca aponta na tangente do arco
                rot = math.degrees(math.atan2(-side * math.sin(a),
                                              ty * math.cos(a)))
                h = 0.35 + 0.65 * fbm(px / 30.0, py / 30.0, 977, 3)
                q.append((px, py, 0.14, arc / steps + 0.02, rot, h))
                n += 1
            # o prolongamento reto pela borda da via interna, ate a linha que
            # build_service_roads retoma
            ye = yc + ty * EDGE_INSET
            x0 = c[0]
            x1 = e + side * (FLARE_R + MOUTH_TAPER + 2.0)
            ln = abs(x1 - x0)
            if ln > 1.0:
                h = 0.35 + 0.65 * fbm(x0 / 30.0, ye / 30.0, 977, 3)
                q.append(((x0 + x1) / 2.0, ye, ln, 0.14, 0.0, h))
                n += 1
    return n


def build_markings(m_line):
    q = []
    # ---- both carriageways ------------------------------------------------
    for cx in (ROAD_A_X, ROAD_B_X):
        for sx in (-ROAD_W / 2 + 0.42, ROAD_W / 2 - 0.42):
            # The edge line is CONTINUOUS but it is not one 1180 m quad any
            # more: broken into 20 m runs, each with its own health, it fades
            # and returns the way a real edge line does.
            #
            # E ELA PARA EM MARK_MAX_R. Corria os 1180 m da pista, e o ultimo
            # terco disso estava abaixo da resolucao do depth buffer: tinta
            # disputando profundidade com o asfalto. Ver MARK_DZ_K. A 240 m uma
            # faixa de 14 cm ja e meio pixel, entao o fim dela nao se le — e o
            # que se lia era o cintilar.
            #
            # E ELA ABRE ONDE A BOCA ABRE. A linha de bordo marca a BORDA DO
            # PAVIMENTO, e no entroncamento a borda deixa de ser reta: ela
            # descreve o mesmo quarto de circulo que o meio-fio. Uma linha reta
            # cortando a boca esta desenhando uma borda que nao existe, e ainda
            # diz "nao entre" exatamente onde entrar e o proposito. O trecho
            # curvo e emitido por mouth_edge_marks, e os vaos aqui vem do MESMO
            # _channel_runs que abre o meio-fio — entao a reta acaba onde o arco
            # comeca, por construcao e nao por ajuste.
            side = 1 if sx > 0 else -1
            # ...e agora ela para tambem onde a PISTA para. MARK_MAX_R continua a
            # valer como teto (ver acima), mas a pista deixou de ser simetrica em
            # torno da origem: com o limite so em +/-240 a tinta seguia 147 m
            # alem do balao, pintando bordo sobre a brita do campo.
            for a0, a1 in _channel_runs(cx, side, max(-MARK_MAX_R, ROAD_Y0),
                                        min(MARK_MAX_R, ROAD_Y1)):
                y = a0
                while y < a1 - 0.5:
                    seg = min(20.0, a1 - y)
                    h = 0.35 + 0.65 * fbm(cx / 30.0, y / 30.0, 977, 3)
                    q.append((cx + sx, y + seg / 2, 0.14, seg, 0.0, h))
                    y += seg
        _dashes(cx, q, max(-MARK_MAX_R, ROAD_Y0), min(MARK_MAX_R, ROAD_Y1))
    mouth_edge_marks(q)

    # ---- the gate: stop bar and crossing ---------------------------------
    # DERIVADO DE YARD_HALF, nao mais um 224 fixo. A cerca foi de 330 para 250 e
    # depois para 150, e este numero ficou para tras: a barra de "pare" estava
    # 74 m ALEM do portao, no meio do campo aberto.
    for cx in (ROAD_A_X, ROAD_B_X):
        q.append((cx, YARD_HALF - 26.0, ROAD_W - 0.9, 0.42, 0.0, 0.85))
        for k in range(7):
            q.append((cx - 4.5 + k * 1.5, YARD_HALF - 21.5, 0.55, 3.2, 0.0,
                      0.45 + 0.5 * _hash01(k, int(cx), 199)))

    # ---- SEM VAGAS, SEM HACHURA DE DOCA, SEM BAIAS DE CARRETA ------------
    #
    # Elas sairam, e a razao e a mesma para as tres: eram coordenadas FIXAS,
    # amarradas a posicoes de predios da tabela antiga. As construcoes agora vem
    # do editor (map-creator/layout.json) e podem estar em qualquer lugar — mas
    # as marcacoes continuavam onde sempre estiveram.
    #
    # O resultado e uma marcacao que nao descreve nada: 26 vagas pintadas em
    # concreto vazio porque o estacionamento que elas serviam foi movido, e uma
    # hachura de manobra a 30 m da doca mais proxima. Foi o relato "faz uma
    # marcacao que nao deveria".
    #
    # Piso pintado pertence a um EDIFICIO, nao a uma coordenada. Enquanto o
    # editor nao souber colocar um estacionamento como peca, o certo e nao
    # pintar: um patio limpo e correto, um estacionamento fantasma nao e.
    # As marcacoes de via — bordas, eixo, pare e faixa — sao derivadas das ruas,
    # que o editor nao move, e por isso continuam aqui.

    # ---- vagas, de volta e num lugar pedido ------------------------------
    # Perpendiculares ao meio-fio da rua A. Diferente das que sairam, estas nao
    # sao um numero solto: a faixa tem meio-fio de um lado e galpao do outro, que
    # e o que faz uma vaga significar alguma coisa.
    for px, py, bays, bw, bd, axis in PARKING:
        # A DIVISA QUE CAI NA BOCA NAO E PINTADA, e essa era a "ultima marcacao
        # do estacionamento": em (11, -34) a primeira divisa entrava na
        # concordancia do entroncamento — meia vaga desenhada sobre asfalto de
        # cruzamento, atravessando o meio-fio do arco. Ninguem pinta vaga na
        # boca de uma rua. O teste e o pavimento REAL da via interna
        # (on_service_paving ja conta o alargamento), com 50 cm de folga, e nao
        # uma coordenada escrita a mao — para que mover a via ou o raio continue
        # apagando a vaga certa.
        keep = []
        for k in range(bays + 1):
            if axis == "y":
                a, b = (px, py + k * bw), (px + bd, py + k * bw)
            else:
                a, b = (px + k * bw, py), (px + k * bw, py - bd)
            if _line_meets_service(a, b):
                continue
            keep.append(k)
        if not keep:
            continue
        for k in keep:
            t = py + k * bw if axis == "y" else px + k * bw
            h = 0.30 + 0.70 * _hash01(int(t * 4), k, 613)
            h *= 0.45 + 0.75 * fbm(px / 26.0, t / 26.0, 811, 3)
            if axis == "y":
                q.append((px + bd / 2.0, t, bd, 0.12, 0.0, min(1.0, h)))
            else:
                q.append((t, py - bd / 2.0, 0.12, bd, 0.0, min(1.0, h)))
        # testada, no fundo das vagas — derivada das divisas que sobraram, senao
        # ela continua atravessando o pedaco que acabou de ser apagado
        t0, t1 = keep[0] * bw, keep[-1] * bw
        hh = 0.55 + 0.4 * _hash01(int(px), bays, 271)
        if axis == "y":
            q.append((px + bd, py + (t0 + t1) / 2.0, 0.12, t1 - t0, 0.0, hh))
        else:
            q.append((px + (t0 + t1) / 2.0, py - bd, t1 - t0, 0.12, 0.0, hh))

    ob = add_marks("markings", m_line, q)
    return ob


def _merge(spans):
    out = []
    for a, b in sorted(spans):
        if out and a <= out[-1][1]:
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([a, b])
    return out


def _channel_runs(cx, side, lo=None, hi=None):
    """Os trechos de y onde ESTA canaleta (sarjeta + meio-fio) existe.

    O COMPLEMENTO E CALCULADO, nao testado por amostragem. Antes cada pedra
    perguntava `on_service_road(meio_da_pedra, pad=6.5)` e pulava se desse
    verdadeiro: uma caixa, avaliada no ponto medio de um passo de 1,10 m (ou de
    9 m longe do centro). Duas consequencias, as duas visiveis em i_junc.png —
    a abertura nao coincidia com a curva, e a ultima pedra antes do vao caia
    onde calhasse, com a ponta aberta para a boca.

    Aqui a abertura de uma boca e EXATAMENTE [y0-R, y1+R], que e onde o arco a
    substitui, e as pedras sao ladrilhadas dentro do intervalo restante — entao
    a fiada comeca e termina no ponto em que o arco a pega.
    """
    e = cx + side * ROAD_W / 2.0
    gaps = []
    for ms, r in ((get_mouths(), FLARE_R), (get_gap_mouths(), MEDIAN_GAP_R)):
        for mcx, mside, _me, y0, y1 in ms:
            if mcx == cx and mside == side:
                gaps.append((y0 - r, y1 + r))
    # A ABERTURA DO CANTEIRO TAMBEM ABRE PELO RAIO, e nao mais pela largura da
    # via. Enquanto ela abria [y0-62cm, y1+62cm] a fiada longitudinal seguia reta
    # ate 62 cm da via e o nariz vinha em esquadro: as duas se encontravam em
    # angulo. Agora o arco de _corner_arc pega a fiada exatamente em y0-R, que e
    # o ponto onde ele e tangente a ela.
    #
    # A ultima rede continua sendo a largura da via: uma travessia que por algum
    # motivo nao produza boca nenhuma ainda tem de furar a canaleta, senao volta
    # o meio-fio atravessado no meio da rua.
    # A CANALETA DE DENTRO NAO ABRE MAIS, e e o "meio fio do canteiro central
    # continua atravessando".
    #
    # Enquanto a transversal cruzava o par de pistas, as QUATRO canaletas tinham
    # de abrir: as duas de fora para ela entrar, as duas de dentro para ela
    # atravessar o canteiro. O canteiro foi fechado (ver `breaks`), mas este
    # laco continuou a abrir as quatro — e o resultado e um canteiro de grama
    # inteiro com o meio-fio dele interrompido no meio, que le exatamente como
    # uma travessia que ficou por acabar.
    #
    # `inner` e o lado que olha para o canteiro: em A e o oeste (side -1), em B
    # o leste (+1). Derivado da posicao das duas pistas, nao escrito a mao.
    med_x = (ROAD_A_X + ROAD_B_X) / 2.0
    inner = -1 if cx > med_x else 1
    for x0, x1, sy0, sy1 in SERVICE_ROADS:
        if side == inner:
            continue
        if x0 - 0.6 <= e <= x1 + 0.6:
            gaps.append((sy0 - GUTTER_W - KERB_W, sy1 + GUTTER_W + KERB_W))
    # A CANALETA SO EXISTE ONDE A PISTA EXISTE. O limite inferior era -YARD_HALF
    # (a cerca sul) de quando a pista atravessava a propriedade de lado a lado;
    # com ela a terminar no balao, meio-fio e sarjeta seguiam em frente e
    # ATRAVESSAVAM o disco inteiro — dois riscos escuros a cortar a ilha central,
    # que e o que t_balao.png mostrava. O topo continua na cerca: da porteira
    # para fora a via e rural, com acostamento de brita e sem guia.
    # E ELA VAI ATE AO BORDO DO BALAO, NAO ATE ROAD_Y0.
    #
    # ROAD_Y0 e onde acaba o PAVIMENTO RECTO das pistas; dali ao arco vai o
    # leque, que e asfalto na mesma e continua a ser uma via com bordo. Parar a
    # canaleta na recta deixava esses 2 a 18 m (conforme a abscissa) sem guia
    # nenhuma dos dois lados de cada pista — metade do "faltando uma parte do
    # meio fio" mora aqui, a outra metade no proprio anel (ver rb_mouths).
    #
    # Cada canaleta para no arco DA PROPRIA ABSCISSA, e e isso que a faz
    # encontrar a guia do anel exactamente no ponto em que o anel a larga: as
    # duas leem o mesmo circulo no mesmo x.
    if lo is None:
        arc = rb_arc_y(e)
        lo = max(arc if arc is not None else ROAD_Y0, -YARD_HALF)
    hi = min(ROAD_Y1, YARD_HALF) if hi is None else hi
    runs, a = [], lo
    for g0, g1 in _merge(gaps):
        if g0 > a:
            runs.append((a, min(g0, hi)))
        a = max(a, g1)
    if a < hi:
        runs.append((a, hi))
    return [(p, q) for p, q in runs if q - p > 0.3]


def _kerb_block(bm, uv, a0, a1, b0, b1, top_a, top_b, lo_a, lo_b, s_a, s_b):
    """Uma pedra de meio-fio entre duas secoes transversais.

    `a0/a1` e a secao inicial (dorso, frente) e `b0/b1` a final. `s` e a
    ABSCISSA CURVILINEA e nao o y: e ela que faz a textura do meio-fio correr
    junto com a peca em vez de encolher no arco, onde y quase nao anda.
    """
    vs = [bm.verts.new((a0[0], a0[1], lo_a)),
          bm.verts.new((a1[0], a1[1], lo_a)),
          bm.verts.new((b1[0], b1[1], lo_b)),
          bm.verts.new((b0[0], b0[1], lo_b)),
          bm.verts.new((a0[0], a0[1], top_a)),
          bm.verts.new((a1[0], a1[1], top_a)),
          bm.verts.new((b1[0], b1[1], top_b)),
          bm.verts.new((b0[0], b0[1], top_b))]
    s_of = {}
    for k in (0, 1, 4, 5):
        s_of[vs[k]] = s_a
    for k in (2, 3, 6, 7):
        s_of[vs[k]] = s_b
    for quad in ((0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1),
                 (3, 2, 6, 7), (0, 3, 7, 4), (1, 5, 6, 2)):
        try:
            f = bm.faces.new([vs[k] for k in quad])
        except ValueError:
            continue
        for l in f.loops:
            l[uv].uv = (s_of[l.vert] / 1.2, l.vert.co.z / 1.2)


def _gutter_quad(bm, uv, pts):
    """`pts` = [(x, y, z)] x4. O sentido e normalizado pela area com sinal, para
    que toda sarjeta olhe para cima — a fiada oeste de cada pista saia com o
    sentido invertido, o que so nao aparecia porque o exportador do Blender
    escreve doubleSided por padrao."""
    ar = 0.0
    for i in range(4):
        x0, y0, _ = pts[i]
        x1, y1, _ = pts[(i + 1) % 4]
        ar += x0 * y1 - x1 * y0
    if ar < 0:
        pts = list(reversed(pts))
    f = bm.faces.new([bm.verts.new(p) for p in pts])
    for l in f.loops:
        l[uv].uv = (l.vert.co.x / 2.0, l.vert.co.y / 2.0)


def svc_kerb_top(x, y_road, y_back):
    """Cota do dorso de uma guia de via interna em (x).

    O DORSO NAO PODE SER UMA CONSTANTE, e era — KERB_TOP, os mesmos 15,5 cm em
    toda a extensao. Isso funciona na pista principal, que e plana em z=0 com a
    laje a +12: a guia mostra 3,5 cm e pronto. Na via interna nao funciona,
    porque ela DESCE EM RAMPA nos ultimos 5 m antes da pista, de +15 cm ate
    -5,5 cm, enquanto o dorso ficava parado la em cima. A guia engordava de
    3,5 cm para mais de 20 cm ao se aproximar da boca, e o que se le disso nao e
    "a guia cresceu": e "a laje afundou". Foi o relato "os cantos estao
    estranhos, chega a parecer que a altura esta bugada".

    O `max` e porque a guia tem dois lados e tem de fazer sentido para os dois:
    ela retem a laje e delimita o asfalto, entao o dorso fica 3,5 cm acima do
    MAIS ALTO dos dois — que e a definicao de um meio-fio.
    """
    # `yard_z` E NAO `yard_surface`: a laje NOMINAL, nao a rebaixada.
    #
    # `yard_surface` cai ate 9 cm junto da via, para passar por baixo do
    # asfalto. Se o dorso do meio-fio seguisse esse rebaixo, ele mergulharia
    # junto — a guia afundaria exatamente onde ela mais se ve. Uma guia e uma
    # peca ASSENTE: a cota dela vem do nivel de projeto da laje, e e a laje que
    # se acomoda a ela, nao o contrario.
    return max(svc_surface_z(x, y_road), yard_z(x, y_back)) + KERB_REVEAL


def _corner_arc(kerbs, kuv, gutters, guv, side, e, yc, sgn_y, tag, r, back_z):
    """Um quarto de guia + sarjeta contornando a quina de um entroncamento.

    NIVEL DE MODULO porque ha dois clientes com a mesma quina e raios
    diferentes: a boca do entroncamento (build_service_kerbs, R = 6 m, grama de
    patio atras) e a abertura do canteiro (build_median_noses, R = 2 m, canteiro
    atras). Enquanto isto era um closure de um deles, o outro construia a quina
    a mao — e foi assim que a abertura do canteiro acabou em esquadro.

    Tudo e concentrico em `c`: o pavimento vai ate `r`, a sarjeta ocupa os 45 cm
    imediatamente por dentro e o meio-fio os 17 cm seguintes. Nas duas pontas do
    arco (u=0 e u=1) esses tres raios caem exatamente sobre as retas que eles
    continuam, sem nenhum ajuste — a tangencia e consequencia da construcao e
    nao de um numero calibrado.

    `back_z(x, y)` e a cota do que o meio-fio retem atras: laje no patio,
    canteiro no canteiro. O dorso fica 3,5 cm acima do MAIS ALTO entre ela e o
    asfalto, que e a definicao de um meio-fio.
    """
    r_gut = r - GUTTER_W
    r_bak = r - GUTTER_W - KERB_W
    c = (e + side * r, yc + sgn_y * r)
    ty = -sgn_y

    def pt(rr, u):
        a = u * math.pi / 2.0
        return (c[0] - side * rr * math.cos(a), c[1] + ty * rr * math.sin(a))

    arc_len = r * math.pi / 2.0
    steps = max(6, int(round(arc_len / KERB_SEG)))
    for k in range(steps):
        u0, u1 = k / float(steps), (k + 1) / float(steps)
        # 1,5 cm de junta, como na fiada reta: a junta e o que da ao olho um
        # comprimento para medir a obra.
        uj = u1 - 0.015 / arc_len
        p0, p1 = pt(r, u0), pt(r, u1)
        zs0, zs1 = svc_surface_z(*p0), svc_surface_z(*p1)
        _gutter_quad(gutters, guv,
                     [(p0[0], p0[1], zs0 + 0.002),
                      pt(r_gut, u0) + (zs0 + 0.020,),
                      pt(r_gut, u1) + (zs1 + 0.020,),
                      (p1[0], p1[1], zs1 + 0.002)])
        b0, b1 = pt(r_bak, u0), pt(r_bak, uj)
        j = 0.012 * (_hash01(k, tag, 53) - 0.5)
        t0 = max(zs0, back_z(*b0)) + 0.035 + j
        t1 = max(zs1, back_z(*b1)) + 0.035 + j
        _kerb_block(kerbs, kuv,
                    pt(r_bak, u0), pt(r_gut, u0),
                    pt(r_bak, uj), pt(r_gut, uj),
                    t0, t1, zs0 - 0.22, zs1 - 0.22,
                    u0 * arc_len, uj * arc_len)
    return steps


def build_service_kerbs(kerbs, kuv, gutters, guv):
    """Meio-fio e sarjeta da via interna: a boca E o corpo dela.

    ERA SO A BOCA, e o relato foi direto: "as ruas de interseccao nao tem o
    rodape separando rua e chao". Estava certo — o arco virava a esquina, corria
    8 m e morria, e dali em diante a via interna era uma fita de asfalto
    desenhada sobre a laje, sem nada explicando onde uma acaba e a outra comeca.
    Uma rua tem guia dos dois lados, do comeco ao fim.

    A GEOMETRIA E A MESMA DOS DOIS TRECHOS, e e por isso que eles fecham: o
    pavimento vai ate o raio R (ou ate a borda reta), a sarjeta ocupa os 45 cm
    imediatamente por fora e o meio-fio os 17 cm seguintes. Nas duas pontas do
    arco esses raios caem exatamente sobre xe / xg / xk na pista e sobre
    y0 / y0-45 / y0-62 na via interna, sem nenhum ajuste — a tangencia e
    consequencia da construcao.

    O ARREMATE SO EXISTE NA PONTA LIVRE. Onde a via morre no patio, o dorso
    desce em rampa ate rente a laje em 8 m, que e como um meio-fio termina de
    verdade quando o pavimento vira patio e nao ha mais nada a reter. Onde ela
    encontra a pista, quem arremata e o arco.

    A LIGACAO PELO CANTEIRO NAO ENTRA. Ela tem 11,7 m e mora inteira dentro do
    canteiro; quem a delimita e o nariz do canteiro (build_median_noses), que ja
    atravessa a largura toda. Guia ali seria guia dentro de guia.
    """
    n = 0

    def straight(yc, sgn_y, xa, xb, fade_a=False, fade_b=False):
        """Fiada reta pela borda da via, de xa a xb (xa pode ser > xb)."""
        out = 0
        yg = yc + sgn_y * GUTTER_W
        yb = yc + sgn_y * (GUTTER_W + KERB_W)
        span = xb - xa
        if abs(span) < 0.4:
            return 0
        steps = max(1, int(round(abs(span) / KERB_SEG)))
        sgn_x = 1.0 if span > 0 else -1.0

        def top_at(x):
            f = 1.0
            if fade_a:
                f = min(f, abs(x - xa) / MOUTH_TAPER)
            if fade_b:
                f = min(f, abs(xb - x) / MOUTH_TAPER)
            f = max(0.0, min(1.0, f))
            flat = yard_surface(x, yb) + 0.015
            return flat + (svc_kerb_top(x, yc, yb) - flat) * f

        for k in range(steps):
            x0 = xa + span * (k / float(steps))
            x1 = xa + span * ((k + 1) / float(steps))
            z0, z1 = svc_surface_z(x0, yc), svc_surface_z(x1, yc)
            _gutter_quad(gutters, guv,
                         [(x0, yc, z0 + 0.002), (x0, yg, z0 + 0.020),
                          (x1, yg, z1 + 0.020), (x1, yc, z1 + 0.002)])
            _kerb_block(kerbs, kuv,
                        (x0, yb), (x0, yg),
                        (x1 - sgn_x * 0.015, yb), (x1 - sgn_x * 0.015, yg),
                        top_at(x0), top_at(x1), z0 - 0.22, z1 - 0.22,
                        abs(x0 - xa), abs(x1 - xa))
            out += 1
        return out

    def arc(cx, side, e, yc, sgn_y, tag):
        return _corner_arc(kerbs, kuv, gutters, guv, side, e, yc, sgn_y, tag,
                           FLARE_R, yard_surface)

    ms = get_mouths()
    for ri, (x0, x1, y0, y1) in enumerate(SERVICE_ROADS):
        for si, (sx0, sx1) in enumerate(svc_spans(x0, x1)):
            if sx1 - sx0 < FLARE_MIN_SPAN:
                continue
            m_lo = m_hi = None
            for cx, side, e, my0, my1 in ms:
                if abs(my0 - y0) > 1e-6 or abs(my1 - y1) > 1e-6:
                    continue
                if side > 0 and abs(sx0 - e) < 0.5:
                    m_lo = (cx, side, e)
                if side < 0 and abs(sx1 - e) < 0.5:
                    m_hi = (cx, side, e)
            for ci, (yc, sgn_y) in enumerate(((y0, -1.0), (y1, 1.0))):
                tag = ri * 31 + si * 7 + ci
                if m_lo is not None:
                    n += arc(m_lo[0], m_lo[1], m_lo[2], yc, sgn_y, tag)
                    xa, fade_a = m_lo[2] + m_lo[1] * FLARE_R, False
                else:
                    xa, fade_a = sx0, True
                if m_hi is not None:
                    n += arc(m_hi[0], m_hi[1], m_hi[2], yc, sgn_y, tag + 3)
                    xb, fade_b = m_hi[2] + m_hi[1] * FLARE_R, False
                else:
                    xb, fade_b = sx1, True
                n += straight(yc, sgn_y, xa, xb, fade_a, fade_b)
    return n


def build_median_noses(kerbs, kuv, gutters, guv):
    """O NARIZ DO CANTEIRO, que era a ultima aba solta do entroncamento.

    Onde a transversal atravessa, o canteiro simplesmente PARAVA: um plano de
    espessura zero a +12 cm terminando no ar sobre asfalto a -3 cm. Na rasante
    da camera isso le como um tapete com a ponta levantada — e o mesmo defeito
    do "L", so que na peca do meio, e por isso ele entra no mesmo pacote.

    Um canteiro nao termina, ele e ARREMATADO: o nariz e guia mais sarjeta
    atravessando a largura toda, exatamente como as bordas longitudinais dele.
    O vao do canteiro passa a ser 62 cm MAIOR que a via de cada lado (era 15 cm
    menor) porque agora ha guia e sarjeta para ocupar essa faixa — e o vao
    continua sem fresta, que era o que os 15 cm negativos protegiam.
    """
    n = 0
    # ATE A BORDA DO PAVIMENTO, e nao ate o dorso do meio-fio — cada quina
    # aberta era um buraco de verdade.
    #
    # O nariz ia de _EDGE a _EDGE (dorso a dorso). A canaleta longitudinal, por
    # sua vez, abre em [y0-62cm, y1+62cm] para deixar a travessia passar. Sobrava
    # em cada quina um quadrado de 62 x 62 cm que NINGUEM cobria: nem o nariz
    # (que parava 62 cm antes), nem a canaleta (que ja tinha aberto), nem o
    # canteiro (que termina no dorso), nem o asfalto (que comeca na borda da
    # pista). Por ali aparecia a camada de brita, 63 cm abaixo — sao os quatro
    # buracos nas quinas, um por canto de cada abertura.
    #
    # Indo ate ROAD_W/2 o nariz cobre exatamente esse quadrado dos dois lados e o
    # anel fecha. Onde ele passa por cima da sarjeta longitudinal nao ha disputa:
    # a sarjeta e uma face rasa e o meio-fio e um solido que a contem.
    #
    # E ELE VIRA A QUINA, que era a ultima aresta em esquadro da abertura. O
    # nariz reto de ponta a ponta encontrava a fiada longitudinal em angulo
    # reto — asfalto em esquadro, grama em esquadro, guia em esquadro. Agora ele
    # corre reto so entre os pontos de tangencia (x_lo+R a x_hi-R) e cada ponta e
    # um quarto de circulo de _corner_arc, o MESMO que a boca do entroncamento
    # usa, com R = MEDIAN_GAP_R. Nas duas pontas do arco os raios caem sobre a
    # fiada longitudinal (u=0) e sobre o nariz reto (u=1) por construcao.
    #
    # E ELE SO EXISTE ONDE HA TRAVESSIA. Ver `median_crossings`: com o canteiro
    # fechado, um nariz e guia mais sarjeta a atravessar grama intacta.
    x_lo, x_hi = ROAD_B_X + ROAD_W / 2.0, ROAD_A_X - ROAD_W / 2.0
    R = MEDIAN_GAP_R
    for ri, (x0, x1, y0, y1) in enumerate(median_crossings()):
        for ci, (yc, sgn) in enumerate(((y0, -1.0), (y1, 1.0))):
            yg = yc + sgn * GUTTER_W
            yb = yc + sgn * (GUTTER_W + KERB_W)
            tag = ri * 31 + ci * 11 + 101
            n += _corner_arc(kerbs, kuv, gutters, guv, 1, x_lo, yc, sgn,
                             tag, R, median_z)
            n += _corner_arc(kerbs, kuv, gutters, guv, -1, x_hi, yc, sgn,
                             tag + 5, R, median_z)
            x, i = x_lo + R, 0
            while x < x_hi - R - 0.05:
                b = min(x_hi - R, x + KERB_SEG)
                # A cota acompanha a RAMPA: a 62 cm da pista o asfalto da
                # transversal ainda esta descendo, e um nariz na cota da laje
                # ali seria o degrau de volta.
                z0, z1 = svc_surface_z(x, yc), svc_surface_z(b, yc)
                _gutter_quad(gutters, guv,
                             [(x, yc, z0 + 0.002), (x, yg, z0 + 0.020),
                              (b, yg, z1 + 0.020), (b, yc, z1 + 0.002)])
                j = 0.012 * (_hash01(i, int(yc), 59) - 0.5)
                _kerb_block(kerbs, kuv, (x, yb), (x, yg),
                            (b - 0.015, yb), (b - 0.015, yg),
                            max(z0, median_z(x, yb)) + 0.035 + j,
                            max(z1, median_z(b, yb)) + 0.035 + j,
                            z0 - 0.22, z1 - 0.22, x, b)
                n += 1
                x, i = b, i + 1
    return n


def build_kerbs(m_kerb, m_gutter):
    """The road/yard joint, which is what the brief asks to see.

    A CARRIAGEWAY DOES NOT SIMPLY STOP. It falls to a channel, the channel is a
    concrete gutter laid flush with the asphalt, the gutter is retained by a
    kerb, and the kerb holds back ground that is HIGHER than the road. The
    previous build had a single box beside a yard 14 cm BELOW the road, which is
    the one arrangement that explains nothing: a kerb with nothing behind it to
    retain, next to a step with nothing to justify it.

    KERBSTONES, NOT A KERB. The joints every 1.10 m are the detail: a 660 m
    extruded prism reads as a plastic strip at any distance, and the joint is
    the only thing that gives the eye a length to measure the site against.
    """
    kerbs = bmesh.new()
    gutters = bmesh.new()
    guv = gutters.loops.layers.uv.new("UVMap")
    kuv = kerbs.loops.layers.uv.new("UVMap")
    # KERBS STOP AT THE PROPERTY LINE, and that is realism and economy agreeing
    # for once. A kerb exists to retain made ground; past the gate the road runs
    # through open country and a rural carriageway has a verge, not a kerb.
    # Running it the full 1180 m was also 4 276 kerbstones and 3.7 MB of the
    # export — a fifth of the whole file spent on joints nobody can see at 500 m.
    n = 0
    for cx in (ROAD_A_X, ROAD_B_X):
        for side in (-1, 1):
            xe = cx + side * ROAD_W / 2.0                  # channel line
            xg = xe + side * GUTTER_W                      # back of gutter
            xk = xg + side * KERB_W                        # back of kerb
            za = road_z(xe, cx)
            # A abertura da canaleta agora vem de _channel_runs, que a deriva da
            # boca em vez de amostrar uma caixa: onde ela abre, e o arco de
            # build_mouth_kerbs que continua a fiada.
            for a0, a1 in _channel_runs(cx, side):
                # ---- gutter: a flat strip from the asphalt edge to the kerb --
                y = a0
                while y < a1 - 0.05:
                    b = min(a1, y + 6.0)
                    _gutter_quad(gutters, guv,
                                 [(xe, y, za + 0.002), (xg, y, za + 0.020),
                                  (xg, b, za + 0.020), (xe, b, za + 0.002)])
                    y = b
                # ---- kerbstones ---------------------------------------------
                y = a0
                i = 0
                while y < a1 - 0.05:
                    # SEPARATE STONES ONLY WHERE THEY READ. The 1.5 cm joint
                    # every 1.10 m is what gives the eye a length to measure the
                    # site against — at 40 m. At 200 m it is four vertices per
                    # sub-pixel gap, so past the near field the run becomes one
                    # long prism and looks identical.
                    near = abs(y) < 130.0
                    seg = min(KERB_SEG if near else 9.0, a1 - y)
                    b = y + seg - (0.015 if near and seg > 0.2 else 0.0)
                    # O DORSO SEGUE O QUE A GUIA RETEM, e nao uma constante.
                    #
                    # Era `KERB_TOP` fixo sobre uma laje que ondulava +-8 cm:
                    # medida ao longo de um mesmo troco, a face vista variava
                    # entre 1,4 cm e 16,4 cm — a guia mergulhava na laje num
                    # ponto e virava degrau 20 m adiante. E era tambem a origem
                    # de "as guias inconsistentes": a via interna ja usava a
                    # regra do terreno e a pista nao, entao as duas nunca
                    # coincidiam onde se encontravam.
                    #
                    # Agora todas as guias do cenario usam a MESMA expressao —
                    # o que ela retem, mais KERB_REVEAL — e a consistencia deixa
                    # de ser coincidencia. Do lado do canteiro quem retem e o
                    # canteiro; do lado de fora, a laje.
                    back = (median_z(xk, (y + b) / 2.0)
                            if ROAD_B_X + _EDGE <= xk <= ROAD_A_X - _EDGE
                            else yard_z(xk, (y + b) / 2.0))
                    top = max(za, back) + KERB_REVEAL \
                        + 0.012 * (_hash01(i, int(cx * 7), 53) - 0.5)
                    lo_z = za - 0.22
                    _kerb_block(kerbs, kuv, (xk, y), (xg, y), (xk, b), (xg, b),
                                top, top, lo_z, lo_z, y, b)
                    n += 1
                    y += seg
                    i += 1

    m = build_service_kerbs(kerbs, kuv, gutters, guv)
    m += build_median_noses(kerbs, kuv, gutters, guv)
    # O SOLIDO E FECHADO, entao as normais podem ser recalculadas com seguranca —
    # e no arco elas nao sao deriváveis de "x cresce, y cresce" como eram na
    # fiada reta.
    bmesh.ops.recalc_face_normals(kerbs, faces=kerbs.faces)

    for bm, mm, nm in ((kerbs, m_kerb, "kerbs"), (gutters, m_gutter, "gutters")):
        me = bpy.data.meshes.new(nm)
        ob = bpy.data.objects.new(nm, me)
        bpy.context.collection.objects.link(ob)
        bm.to_mesh(me)
        bm.free()
        me.materials.append(mm)
    log("  kerbs: %d stones on 4 channels + %d contornando %d bocas"
        % (n, m, len(get_mouths())))


def build_ground():
    """The site, layer by layer, with every height change explained.

        line paint     +1.2 cm over whatever it lies on
        ROAD crown      0.0        <- the truck stands here
        road channel   -5.5 cm     (the carriageway is cambered, not flat)
        gutter          flush, rising 2 cm to the kerb
        kerb top       +15.5 cm
        yard           +12 cm, undulating +/- 6 cm  <- retained BY the kerb
        median         +12 cm, same datum as the yard
        grass inside   +2 cm, below the slab, because turf is not paving
        outland        -28 cm and falling away
        outer field    -30 cm

    NO PATCHES AND NO JOINT GRID, and the deletion is the fix rather than a
    retreat from it. A real yard IS a patchwork, but a hard-edged quad laid a
    centimetre above a flat plane does not read as a repair — it reads as a
    rectangle lying on the floor, and it is a z-fight waiting for a grazing
    camera. Variation comes only from things that cannot produce an edge: the
    vertex-colour field, and the tiled PBR set the engine binds at runtime.
    """
    m_yard = mat("GROUND_CONCRETE", (0.30, 0.30, 0.29, 1), 0.88)
    m_road = mat("ASPHALT_ROAD", (0.13, 0.13, 0.14, 1), 0.86)
    m_gutter = mat("CONCRETE_APRON", (0.34, 0.33, 0.31, 1), 0.85)
    m_gravel = mat("GRAVEL_SHOULDER", (0.28, 0.27, 0.25, 1), 0.93)
    # TWO GRASS MATERIALS BECAUSE THERE ARE TWO UV SCALES, and one material
    # cannot have both. Ground UVs here are metres/UV_M, and the manifest's
    # `repeat` then makes the tile UV_M/repeat metres — so UV_M and repeat have
    # to move together or the whole ground changes scale (that is what the
    # manifest's repeatNote is about).
    #
    # The near ground uses UV_M 8. The far ground CANNOT: `outer` is 1180 m
    # across, so at UV_M 8 its UVs reach +/-74 before repeat, and a mediump
    # varying — which is what a phone gives an interpolated UV — has a step of
    # ~12 cm up there, i.e. visible quantisation. The far bands use UV_M 64,
    # which is the existing GRASS_VERGE convention and why its repeat is 16.
    m_grass = mat("GRASS_VERGE", (0.17, 0.21, 0.12, 1), 0.94)     # far, UV_M 64
    m_near = mat("GRASS_NEAR", (0.16, 0.22, 0.11, 1), 0.94)       # near, UV_M 8
    m_line = mat("LINE_PAINT", (0.78, 0.76, 0.70, 1), 0.55)
    m_kerb = mat("KERB_CONCRETE", (0.40, 0.39, 0.37, 1), 0.80)

    # ---- outside everything, and why it reaches so far -------------------
    # OUTER FIELD first and lowest, so nothing it meets can z-fight with it. It
    # has to run past the haze shell at 570 m: a ground plane that ends inside
    # the far plane shows its own edge as a lit band under the fog, which was
    # the "estrada morrendo no nada" of the first build.
    # A cota vem de outland_z MENOS 35 cm, e nao de um -0,30 com relevo proprio:
    # ver outland_z para a medicao. Enquanto os dois planos tiverem relevos
    # independentes NAO EXISTE folga constante que resolva — 2 cm nao resolvia,
    # 20 cm tambem nao resolveria, porque a diferenca entre os dois relevos
    # chega a 1,5 m. Derivar um do outro e o que torna a folga uma garantia.
    g_out = add_grid("outer", GROUND, GROUND, m_gravel, cuts=56, uv_scale=64.0,
                     z_fn=lambda x, y: outland_z(x, y) - 0.35)
    paint_variation(g_out, seed=3.1)

    # ---- the paved yard, either side of the road corridor ----------------
    # cell 2.2, nao 4.6: a laje precisa de vertices suficientes dentro dos 5 m
    # de rampa para acompanhar o rebaixo em vez de cortar reto por cima dele.
    add_slab("yard", YARD_X0, YARD_X1, YARD_Y0, YARD_Y1, m_yard,
             cell=2.2, uv_scale=8.0, z_fn=yard_surface, seed=1.3)

    # ---- grass inside the wire, between the slab and the fence -----------
    # This band is the brief's "partes de grama antes das cercas", and it is
    # also what stops the plant reading as a slab with a fence drawn on it: a
    # real property line has unpaved ground behind it that nobody has any reason
    # to concrete.
    # The north and south bands straddle the corridor, so they go through
    # add_slab too; the east and west bands are clear of it and do not.
    add_slab("turf_n", -YARD_HALF, YARD_HALF, YARD_Y1, YARD_HALF, m_near,
             cell=8.0, z_fn=grass_z, seed=6.4)
    add_slab("turf_s", -YARD_HALF, YARD_HALF, -YARD_HALF, YARD_Y0, m_near,
             cell=8.0, z_fn=grass_z, seed=6.9)
    add_slab("turf_e", YARD_X1, YARD_HALF, YARD_Y0, YARD_Y1, m_near,
             cell=8.0, z_fn=grass_z, seed=7.3)
    add_slab("turf_w", -YARD_HALF, YARD_X0, YARD_Y0, YARD_Y1, m_near,
             cell=8.0, z_fn=grass_z, seed=7.7)

    # ---- the two carriageways -------------------------------------------
    # Spanning the whole ground, because a road that simply stops is the most
    # artificial thing a ground plane can do. Cambered, not flat: see road_z.
    # DE ROAD_Y0 A ROAD_Y1, e nao mais os 1180 m do chao: ver o bloco de
    # ROAD_Y0. Os cortes ao longo caem proporcionalmente ao novo comprimento —
    # manter 150 num trecho de 322 m dava 2,1 m de celula contra os 7,9 m de
    # antes, e a celula da malha e o que limita a banda do COLOR_0
    # (paint_variation): mais cortes teriam MUDADO a aparencia do asfalto de
    # tabela, que e o defeito que 12-textura-rua-principal.png documenta.
    _road_len = ROAD_Y1 - ROAD_Y0
    _road_cy = (ROAD_Y0 + ROAD_Y1) / 2.0

    # O ABAULAMENTO ACHATA-SE NA BOCA DA RODOVIA.
    #
    # Uma pista abaulada tem o eixo 5,5 cm acima do bordo; a rodovia que ela
    # encontra tem, no bordo dela, exactamente essa cota mais baixa. Encostadas
    # sem mais nada, as duas deixam um degrau de 5,5 cm ao longo de toda a boca —
    # o risco escuro atravessado no entroncamento em v_rodovia.png. Em obra o
    # abaulamento da via secundaria morre contra o bordo da principal, e e isso:
    # nos ultimos 12 m o perfil transversal vai a plano na cota do bordo.
    JOIN_BLEND = 12.0

    def _road_join_z(x, y, c):
        z = road_z(x, c)
        d = ROAD_Y1 - y
        if d >= JOIN_BLEND:
            return z
        t = 1.0 - max(0.0, d) / JOIN_BLEND
        t = t * t * (3.0 - 2.0 * t)
        return z + (-ROAD_CROWN - z) * t

    for nm, cx in (("road_a", ROAD_A_X), ("road_b", ROAD_B_X)):
        r = add_grid(nm, ROAD_W, _road_len, m_road, cx=cx, cy=_road_cy,
                     cuts=10, cuts_y=max(2, int(_road_len / 7.9)),
                     uv_scale=8.0, z_fn=lambda x, y, c=cx: _road_join_z(x, y, c))
        paint_variation(r, seed=2.2 if cx == ROAD_A_X else 2.7,
                        road_wear=True, cx=cx)

    # ---- the median ------------------------------------------------------
    # O CANTEIRO ABRE ONDE UMA TRANSVERSAL CRUZA. Ele corre os 1180 m inteiros;
    # uma via que atravessa o sitio teria de passar por cima da grama, e grama
    # atravessada por asfalto e o mesmo erro que a grama atravessando a rua.
    # Entao ele sai em trechos, com vao nos cruzamentos.
    med_cx = (ROAD_A_X - _EDGE + ROAD_B_X + _EDGE) / 2.0
    # O VAO E MAIOR QUE A VIA EM EXATAMENTE UMA GUIA MAIS UMA SARJETA.
    #
    # Historia deste numero, porque ele ja errou nos dois sentidos. Com folga de
    # 1 m sobrava um metro de nada em cada borda e por ali aparecia a brita 30 cm
    # abaixo — a "textura do chao onde deveria ser rua". Foi corrigido para 15 cm
    # MENOR que a via, e ai o asfalto sobrepunha a borda e nao havia fresta —
    # mas o canteiro passava a terminar em plano de espessura zero sobre o
    # asfalto, que e a aba levantada de build_median_noses.
    #
    # Agora o vao e 62 cm maior de cada lado e essa faixa e ocupada por guia e
    # sarjeta, exatamente como as bordas longitudinais do canteiro. Sem fresta e
    # com arremate: as duas coisas que as duas tentativas anteriores trocavam
    # uma pela outra.
    # MED_TUCK: a grama entra sob o meio-fio do nariz em vez de parar no dorso.
    # Ver o comentario de MED_TUCK — e o que impede a corda do canteiro de abrir
    # fresta contra a corda da guia no arco da quina.
    _nose = GUTTER_W + KERB_W - MED_TUCK
    # O CANTEIRO DEIXOU DE ABRIR PARA A TRANSVERSAL.
    #
    # A abertura existia para a transversal poder ATRAVESSAR o par de pistas — e
    # ela so precisava de atravessar enquanto nao havia onde inverter o sentido.
    # Com o balao no fim da via interna, quem vem por uma pista e quer a outra
    # inverte no retorno, que e como um par de pistas com canteiro funciona na
    # vida real: as transversais entram e saem pela direita e o canteiro corre
    # inteiro. Fechar a abertura tambem devolve ao canteiro os 8 m de grama que a
    # travessia comia mesmo em frente ao caminhao, que e onde a camera olha.
    #
    # Nada mais muda: as bocas de entroncamento (`mouths`), a guia e a sarjeta
    # continuam a abrir onde a transversal encontra CADA pista — o que sai e so a
    # travessia do meio.
    breaks = [(y0, y1) for _x0, _x1, y0, y1 in median_crossings()]
    # O CANTEIRO VIVE ENTRE AS DUAS PISTAS, entao ele tem os limites delas. Ao
    # sul ele para antes do leque do balao (ROAD_Y0): num balao o canteiro
    # central acaba na entrada e as duas pistas fundem-se na circulatoria —
    # deixar a grama chegar ao arco seria desenhar um canteiro entrando no balao.
    # O NARIZ NORTE E UM VAO COMO OS OUTROS, e por isso entra em `breaks`.
    #
    # O canteiro nao pode ir dorso-a-dorso com a rodovia: numa boca em T as duas
    # pistas alargam antes do entroncamento e o canteiro morre num nariz, dando
    # a garganta por onde se converge para entrar. Terminado a direito, ele
    # aparecia como um rectangulo verde encostado ao asfalto da rodovia — foi o
    # que f_gate.png mostrou. Declarado aqui como vao, ele ganha de graca o
    # mesmo recuo de raio que os narizes das transversais ja tem.
    breaks = sorted(breaks + [(ROAD_Y1 - MEDIAN_THROAT, ROAD_Y1 + 1.0)])
    segs, a = [], ROAD_Y0
    for b0, b1 in breaks:
        if b1 <= ROAD_Y0 or b0 >= ROAD_Y1:
            continue
        if b0 > a:
            segs.append((a, b0))
        a = max(a, b1)
    if a < ROAD_Y1:
        segs.append((a, ROAD_Y1))
    # ---- e o VAO TEM QUINA ARREDONDADA -----------------------------------
    #
    # O corte reto de ponta a ponta deixava o canteiro em esquadro nas quatro
    # quinas da abertura, encostado num asfalto que tambem estava em esquadro.
    # Arredondar o asfalto sozinho descobre a brita; arredondar a guia sozinha
    # poe guia sobre grama. As tres recuam pelo MESMO circulo, e esta e a
    # terceira: a grama para no dorso do meio-fio, que no arco esta a
    # R - 45 cm - 17 cm do centro.
    #
    # O recuo e medido a partir da BORDA EM X do proprio canteiro (que e onde o
    # dorso do meio-fio longitudinal esta) e vale exatamente esse mesmo raio,
    # entao a curva sai tangente as duas retas que encontra: a fiada
    # longitudinal em x = borda, o nariz reto em y = yc - 62 cm.
    # O RAIO E A ORIGEM ANDAM JUNTOS, senao o arco deixa de ser concentrico. Com
    # a grama entrando MED_TUCK sob a guia, o raio cresce por MED_TUCK e a
    # origem recua por MED_TUCK — as duas correcoes se cancelam no centro, que
    # continua sendo exatamente o centro do arco da guia.
    _r_bak = MEDIAN_GAP_R - GUTTER_W - KERB_W + MED_TUCK
    _mx0, _mx1 = med_cx - MEDIAN_W / 2.0, med_cx + MEDIAN_W / 2.0

    def _med_recuo(x):
        return max(flare_offset(x - (_mx0 - MED_TUCK), _r_bak),
                   flare_offset((_mx1 + MED_TUCK) - x, _r_bak))

    for i, (s0, s1) in enumerate(segs):
        if s1 - s0 < 2.0:
            continue
        # `b1` de um vao e o inicio deste trecho, `b0` e o fim dele. As duas
        # pontas do canteiro no limite do sitio nao encostam em vao nenhum.
        gap_lo = any(abs(s0 - b1) < 1e-6 for _b0, b1 in breaks)
        gap_hi = any(abs(s1 - b0) < 1e-6 for b0, _b1 in breaks)
        # ---- A PONTA SUL E A ILHA DIVISORIA DO BALAO -----------------------
        #
        # O canteiro acabava a direito em ROAD_Y0, e o que ficava entre essa
        # recta e o arco era leque — asfalto de lado a lado, sem nada a separar
        # a entrada de uma pista da entrada da outra. Um par de pistas nao entra
        # assim num balao: o canteiro afina e morre CONTRA o anel, e e essa
        # ponta que da a guia onde o anel fecha (ver rb_mouths).
        #
        # A ponta vai ate meia guia ALEM do bordo do pavimento, e nao ate ele: a
        # guia do anel ocupa [RO, RO+17 cm], entao com a grama a acabar em
        # RO+8,5 cm ela fica debaixo do meio da pedra. E o mesmo MED_TUCK das
        # quinas, e pela mesma razao — dois poligonos inscritos no mesmo circulo
        # com passos diferentes nao coincidem, e a corda que sobra tem de cair
        # SOB um solido em vez de ao lado dele.
        nose_s = abs(s0 - ROAD_Y0) < 1e-6
        _r_nose = ROUNDABOUT_RO + KERB_W / 2.0
        # 16 colunas dao 66 cm de passo: a flecha da corda contra o arco fica em
        # 3 mm, ou seja um vigesimo da largura da guia que a cobre.
        cuts = 8 if not (gap_lo or gap_hi or nose_s) else \
            max(16 if nose_s else 8, int(MEDIAN_W / (_r_bak / 5.0)))
        med = add_grid("median_%d" % i, MEDIAN_W, s1 - s0, m_near,
                       cx=med_cx, cy=(s0 + s1) / 2.0,
                       cuts=cuts, cuts_y=max(2, int((s1 - s0) / 8.0)),
                       uv_scale=8.0, z_fn=median_z)
        if gap_lo or gap_hi or nose_s:
            for v in med.data.vertices:
                on_lo = gap_lo and abs(v.co.y - s0) < 1e-4
                on_hi = gap_hi and abs(v.co.y - s1) < 1e-4
                on_nose = nose_s and abs(v.co.y - s0) < 1e-4
                if on_nose:
                    arc = rb_arc_y(v.co.x, _r_nose)
                    if arc is not None and arc < v.co.y:
                        v.co.y = arc
                        v.co.z = median_z(v.co.x, v.co.y)
                    continue
                if not (on_lo or on_hi):
                    continue
                off = _med_recuo(v.co.x)
                if off <= 0.0:
                    continue
                v.co.y += off if on_lo else -off
                # A COTA E REAMOSTRADA na posicao final. add_grid avaliou
                # median_z no retangulo; sem reamostrar, o vertice que anda
                # 1,38 m leva consigo a altura de onde ele estava, e o nariz
                # (que le median_z na posicao certa) abre uma fresta contra ele.
                v.co.z = median_z(v.co.x, v.co.y)
            med.data.update()
            reuv(med, 8.0)
        paint_variation(med, seed=8.8 + i)

    # ---- FORRO DA ABERTURA DO CANTEIRO -----------------------------------
    #
    # O QUE O PATIO FAZ EM TODA A RESTO DO SITIO, e que aqui nao havia ninguem
    # para fazer. Numa boca de entroncamento, asfalto, sarjeta, guia e grama sao
    # quatro superficies encostando umas nas outras — e onde elas nao encostam
    # perfeitamente aparece a laje do patio, que passa por baixo de todas. Entre
    # as duas pistas nao ha patio: por baixo da abertura do canteiro so existe a
    # brita, 63 cm abaixo, e cada fresta de corda vira um risco claro.
    #
    # DERIVADO, NAO POSICIONADO — a licao de `outer`. A cota e o MENOR entre a do
    # canteiro e a da via menos 5 cm, entao nao existe relevo que faca este forro
    # emergir por cima do que ele forra, seja qual for a rampa do entroncamento.
    # O FORRO SO EXISTE ONDE HA VAO — e o teste disso e `median_crossings`, nao
    # `breaks`. Enquanto era `if not breaks`, o nariz norte (que entra em
    # `breaks` sempre) mantinha o forro vivo: 607 vertices de asfalto emitidos
    # por baixo de grama intacta, em cada transversal, para sempre.
    for x0, x1, y0, y1 in median_crossings():
        ax0 = ROAD_B_X + ROAD_W / 2.0 - 0.4
        ax1 = ROAD_A_X - ROAD_W / 2.0 + 0.4
        ay0, ay1 = y0 - MEDIAN_GAP_R - 0.4, y1 + MEDIAN_GAP_R + 0.4
        lin = add_grid("median_gap_liner", ax1 - ax0, ay1 - ay0, m_road,
                       cx=(ax0 + ax1) / 2.0, cy=(ay0 + ay1) / 2.0,
                       cuts=14, cuts_y=14, uv_scale=8.0,
                       z_fn=lambda x, y: min(median_z(x, y),
                                             svc_surface_z(x, y)) - 0.05)
        paint_variation(lin, seed=9.9)

    build_service_roads(m_road, m_line)
    build_highway(m_road, m_gravel, m_line)
    build_roundabout(m_road, m_near, m_kerb, m_line)
    build_markings(m_line)
    build_kerbs(m_kerb, m_gutter)
    build_yard_edge(m_kerb)
    build_outland(m_grass)
    return m_near


ROUNDABOUT_CX = (ROAD_A_X - _EDGE + ROAD_B_X + _EDGE) / 2.0
ROUNDABOUT_CROWN = 0.05


def roundabout_z(x, y):
    """A cota do pavimento do balao. Cai para fora, como um balao real drena."""
    r = math.hypot(x - ROUNDABOUT_CX, y - ROUNDABOUT_CY)
    t = min(1.0, r / max(ROUNDABOUT_RO, 1e-6))
    return -ROUNDABOUT_CROWN * t * t


def in_roundabout(x, y, pad=0.0):
    return math.hypot(x - ROUNDABOUT_CX, y - ROUNDABOUT_CY) <= ROUNDABOUT_RO + pad


def rb_arc_y(x, r=None):
    """A ordenada do bordo NORTE do disco nesta abscissa, ou None fora dele.

    O bordo norte e onde TUDO o que vem do norte tem de morrer: o asfalto das
    duas pistas, a canaleta de cada uma delas e a ponta do canteiro. Enquanto
    cada uma dessas pecas parava numa RECTA (em ROAD_Y0), o que ficava entre a
    recta e o circulo era o leque — e o leque nao tem guia, entao a metade norte
    do bordo do balao corria sem meio-fio nenhum. E o "na rotatoria esta
    faltando uma parte do meio fio", medido: 173 graus de vao contra 187 de
    guia, ou seja mais de metade do anel.
    """
    rr = ROUNDABOUT_RO if r is None else r
    dx = x - ROUNDABOUT_CX
    under = rr * rr - dx * dx
    return ROUNDABOUT_CY + math.sqrt(under) if under > 0.0 else None


def rb_rel(a):
    """O angulo `a` do circulo, medido a partir do NORTE (+y), em [-pi, pi]."""
    return math.atan2(math.cos(a), math.sin(a))


def rb_mouths():
    """Os vaos do bordo do balao, em `rb_rel`: UM POR PISTA, e nao um so.

    O vao era calculado sobre o CORREDOR INTEIRO — as duas pistas mais o
    canteiro entre elas —, porque era isso que o leque cobria. Num par de pistas
    com canteiro central o que entra no balao sao duas bocas de 13 m com uma
    ilha divisoria entre elas; a ilha e a ponta do proprio canteiro, e e ela que
    da a guia onde fechar o anel.

    Os limites saem das mesmas constantes que desenham a via: a boca vai da
    borda do canteiro (ROAD_x -/+ _EDGE, que e o dorso da guia interna) a borda
    externa do pavimento (ROAD_x -/+ ROAD_W/2). Assim a guia do anel comeca
    exactamente onde a canaleta longitudinal a vem buscar.
    """
    out = []
    for cx, inner in ((ROAD_B_X, +1.0), (ROAD_A_X, -1.0)):
        rels = []
        for xx in (cx + inner * _EDGE, cx - inner * ROAD_W / 2.0):
            s = (xx - ROUNDABOUT_CX) / ROUNDABOUT_RO
            rels.append(math.asin(max(-1.0, min(1.0, s))))
        out.append((min(rels), max(rels)))
    return out


def rb_in_mouth(rel, pad=0.0):
    for lo, hi in rb_mouths():
        if lo - pad <= rel <= hi + pad:
            return True
    return False


def build_roundabout(m_road, m_near, m_kerb, m_line):
    """O retorno no fim da via interna.

    TRES SUPERFICIES, E A ORDEM ENTRE ELAS E O DESENHO INTEIRO. A tentacao e
    fazer a pista circulatoria como um ANEL e encostar as duas pistas nele; o
    encontro de um retangulo com um anel nao fecha sem recortar o retangulo, e
    recortar geometria de grade e onde este arquivo ja se queimou (ver o
    median_gap_liner, que existe porque quatro superficies "encostavam"). Aqui:

      1. o pavimento e um DISCO CHEIO, nao um anel. Nada tem de encostar em nada
         no meio dele.
      2. a ilha central e GRAMA POR CIMA do disco, retida por guia — que e
         exatamente a relacao que o canteiro ja tem com a pista, e portanto uma
         relacao ja provada nesta cena em vez de uma nova.
      3. entre a ponta reta das pistas e o arco do disco vai um LEQUE: uma
         superficie regrada de uma borda a outra. E o que uma aproximacao de
         balao e na vida real — a pista abre em leque ao chegar —, e como as
         duas bordas sao dadas, ela nao pode abrir fresta contra nenhuma.

    UM LEQUE POR PISTA, E NAO UM SO PELO CORREDOR INTEIRO — e esta e a correcao
    de 2026-08-10. O leque unico dizia, em geometria, que as duas pistas se
    fundem antes de entrar; a consequencia era que o bordo NORTE do balao,
    173 graus dele, nao tinha onde ter guia — o asfalto ia de um flanco ao outro
    e morria contra a laje numa aresta nua. Era "na rotatoria esta faltando uma
    parte do meio fio", e era mais de metade do anel.

    Um par de pistas com canteiro central entra num balao por DUAS bocas, com a
    ponta do canteiro entre elas. Entao: um leque por pista, a ilha divisoria e
    a ponta do proprio canteiro (build_ground, `nose_s`), e a guia do anel abre
    so nas duas bocas (rb_mouths) em vez de em todo o norte.
    """
    seg = 96

    # ---- 1. o disco -------------------------------------------------------
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    hub = bm.verts.new((ROUNDABOUT_CX, ROUNDABOUT_CY,
                        roundabout_z(ROUNDABOUT_CX, ROUNDABOUT_CY)))
    rings = []
    # Aneis concentricos ate ao bordo: um leque de triangulos a partir do centro
    # daria celulas de 21 m na borda, e o COLOR_0 do chao e limitado em banda
    # pela celula da malha (ver paint_variation) — uma celula de 21 m nao carrega
    # variacao nenhuma.
    steps = 7
    for k in range(1, steps + 1):
        r = ROUNDABOUT_RO * k / float(steps)
        ring = []
        for i in range(seg):
            a = 2.0 * math.pi * i / seg
            x = ROUNDABOUT_CX + r * math.cos(a)
            y = ROUNDABOUT_CY + r * math.sin(a)
            ring.append(bm.verts.new((x, y, roundabout_z(x, y))))
        rings.append(ring)
    for i in range(seg):
        j = (i + 1) % seg
        bm.faces.new((hub, rings[0][i], rings[0][j]))
    for k in range(steps - 1):
        for i in range(seg):
            j = (i + 1) % seg
            bm.faces.new((rings[k][i], rings[k + 1][i], rings[k + 1][j], rings[k][j]))
    for f in bm.faces:
        for l in f.loops:
            l[uv].uv = (l.vert.co.x / 8.0, l.vert.co.y / 8.0)
    me = bpy.data.meshes.new("rb_pave")
    ob = bpy.data.objects.new("rb_pave", me)
    bpy.context.collection.objects.link(ob)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(m_road)
    paint_variation(ob, seed=12.3)

    # ---- 2. o leque de aproximacao, UM POR PISTA -------------------------
    #
    # As abscissas de cada leque sao as da PISTA, e nao as do corredor: entre as
    # duas fica a ponta do canteiro (a ilha divisoria), que e grama e nao
    # asfalto. Ver o docstring.
    cols = 24
    rows = 6
    for ai, (ax0, ax1) in enumerate(((ROAD_B_X - ROAD_W / 2.0,
                                      ROAD_B_X + ROAD_W / 2.0),
                                     (ROAD_A_X - ROAD_W / 2.0,
                                      ROAD_A_X + ROAD_W / 2.0))):
        bm = bmesh.new()
        uv = bm.loops.layers.uv.new("UVMap")
        grid = []
        for c in range(cols + 1):
            x = ax0 + (ax1 - ax0) * c / float(cols)
            # y do arco nesta abscissa. Fora do disco em x, cai para o proprio
            # ROAD_Y0 e a coluna do leque tem comprimento zero — o que e o
            # comportamento certo nas duas pontas.
            arc = rb_arc_y(x)
            y_arc = arc if arc is not None else ROAD_Y0
            col = []
            for r in range(rows + 1):
                t = r / float(rows)
                y = ROAD_Y0 + (y_arc - ROAD_Y0) * t
                # A COTA INTERPOLA ENTRE AS DUAS SUPERFICIES QUE ELE LIGA. A
                # pista e abaulada em torno do proprio eixo e o balao cai para
                # fora; assentar o leque numa das duas leis deixaria um degrau
                # de ate 5,5 cm na outra ponta, que e a altura de uma sarjeta.
                cx = road_cx(x)
                z_road = road_z(x, cx) if cx is not None else -ROAD_CROWN
                z = z_road + (roundabout_z(x, y) - z_road) * t
                col.append(bm.verts.new((x, y, z)))
            grid.append(col)
        for c in range(cols):
            for r in range(rows):
                a, b = grid[c][r], grid[c][r + 1]
                d, e = grid[c + 1][r], grid[c + 1][r + 1]
                if (a.co - b.co).length < 1e-5 and (d.co - e.co).length < 1e-5:
                    continue
                bm.faces.new((a, b, e, d))
        for f in bm.faces:
            for l in f.loops:
                l[uv].uv = (l.vert.co.x / 8.0, l.vert.co.y / 8.0)
        me = bpy.data.meshes.new("rb_apron_%d" % ai)
        ob = bpy.data.objects.new("rb_apron_%d" % ai, me)
        bpy.context.collection.objects.link(ob)
        bm.to_mesh(me)
        bm.free()
        me.materials.append(m_road)
        paint_variation(ob, seed=12.9 + ai * 0.6)

    # ---- 3. a ilha central: grama por cima, retida por guia ---------------
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    isl_z = median_z(ROUNDABOUT_CX, ROUNDABOUT_CY)
    hub = bm.verts.new((ROUNDABOUT_CX, ROUNDABOUT_CY, isl_z))
    prev = None
    for k in range(1, 4):
        r = ROUNDABOUT_RI * k / 3.0
        ring = []
        for i in range(seg):
            a = 2.0 * math.pi * i / seg
            x = ROUNDABOUT_CX + r * math.cos(a)
            y = ROUNDABOUT_CY + r * math.sin(a)
            ring.append(bm.verts.new((x, y, median_z(x, y))))
        if prev is None:
            for i in range(seg):
                bm.faces.new((hub, ring[i], ring[(i + 1) % seg]))
        else:
            for i in range(seg):
                j = (i + 1) % seg
                bm.faces.new((prev[i], ring[i], ring[j], prev[j]))
        prev = ring
    for f in bm.faces:
        for l in f.loops:
            l[uv].uv = (l.vert.co.x / 8.0, l.vert.co.y / 8.0)
    me = bpy.data.meshes.new("rb_island")
    ob = bpy.data.objects.new("rb_island", me)
    bpy.context.collection.objects.link(ob)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(m_near)
    paint_variation(ob, seed=13.4)

    # ---- a guia da ilha, em pedras, como todas as outras do sitio ---------
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    n_stone = max(24, int(2.0 * math.pi * ROUNDABOUT_RI / KERB_SEG))
    for i in range(n_stone):
        a0 = 2.0 * math.pi * i / n_stone
        a1 = 2.0 * math.pi * (i + 1) / n_stone - 0.012      # a junta
        pts = []
        for a in (a0, a1):
            ca, sa = math.cos(a), math.sin(a)
            back = Vector((ROUNDABOUT_CX + (ROUNDABOUT_RI) * ca,
                           ROUNDABOUT_CY + (ROUNDABOUT_RI) * sa, 0.0))
            front = Vector((ROUNDABOUT_CX + (ROUNDABOUT_RI + KERB_W) * ca,
                            ROUNDABOUT_CY + (ROUNDABOUT_RI + KERB_W) * sa, 0.0))
            top = median_z(back.x, back.y) + KERB_REVEAL
            low = roundabout_z(front.x, front.y) - 0.02
            pts.append((back, front, top, low))
        (b0, f0, t0, l0), (b1, f1, t1, l1) = pts
        vs = [bm.verts.new((b0.x, b0.y, t0)), bm.verts.new((f0.x, f0.y, t0)),
              bm.verts.new((f0.x, f0.y, l0)), bm.verts.new((b1.x, b1.y, t1)),
              bm.verts.new((f1.x, f1.y, t1)), bm.verts.new((f1.x, f1.y, l1))]
        f_top = bm.faces.new((vs[0], vs[1], vs[4], vs[3]))   # dorso
        f_face = bm.faces.new((vs[1], vs[2], vs[5], vs[4]))  # face vista
        s0 = ROUNDABOUT_RI * a0
        s1 = ROUNDABOUT_RI * a1
        # As faces sao guardadas na hora em que nascem. `bm.faces[-1]` exige a
        # tabela de indices actualizada e levanta "outdated internal index
        # table" — e reconstruir a tabela por pedra num anel de 68 seria pagar
        # por uma referencia que ja se tem.
        for f, coords in ((f_top, ((s0, 0.0), (s0, KERB_W),
                                   (s1, KERB_W), (s1, 0.0))),
                          (f_face, ((s0, 0.0), (s0, 0.14),
                                    (s1, 0.14), (s1, 0.0)))):
            for l, c in zip(f.loops, coords):
                l[uv].uv = c
    # ---- E A GUIA DE FORA, que faltava ------------------------------------
    #
    # "na rotatoria voce colocou os meio fios, mas na parte do patio nao e ficou
    # muito rigido a curva". As duas queixas sao a mesma: sem guia, o asfalto do
    # balao morria contra a laje numa aresta nua de 135 lados, e uma aresta nua e
    # sempre o que le como poligono. Uma guia dá borda a curva — e e tambem o que
    # ha em obra, porque e ela que retem a laje 12 cm acima da pista.
    #
    # A fiada abre onde o leque entra: ali a pista continua, e por-lhe guia
    # atravessada seria fechar a propria entrada do balao.
    #
    # DOIS VAOS, UM POR PISTA — era UM, pelo corredor inteiro, e por isso 173
    # dos 360 graus do anel nao tinham guia. Ver rb_mouths: os limites saem das
    # bordas de cada pista, entao mexer na largura da via continua a abrir a
    # guia certa, e o trecho ENTRE as duas bocas (a frente da ilha divisoria)
    # passa a ser fiada como qualquer outro pedaco do anel.
    n_out = max(48, int(2.0 * math.pi * ROUNDABOUT_RO / KERB_SEG))
    for i in range(n_out):
        a0 = 2.0 * math.pi * i / n_out
        a1 = 2.0 * math.pi * (i + 1) / n_out - 0.010
        am = (a0 + a1) / 2.0
        if rb_in_mouth(rb_rel(am)):
            continue
        pts = []
        for a in (a0, a1):
            ca, sa = math.cos(a), math.sin(a)
            front = Vector((ROUNDABOUT_CX + ROUNDABOUT_RO * ca,
                            ROUNDABOUT_CY + ROUNDABOUT_RO * sa, 0.0))
            back = Vector((ROUNDABOUT_CX + (ROUNDABOUT_RO + KERB_W) * ca,
                           ROUNDABOUT_CY + (ROUNDABOUT_RO + KERB_W) * sa, 0.0))
            # O QUE ESTA PEDRA RETEM DEPENDE DE ONDE ELA ESTA. Em quase todo o
            # anel e a laje; na frente da ilha divisoria e o CANTEIRO, que corre
            # 5 cm mais alto e com outro relevo. Ler a laje ali poria o dorso
            # abaixo da grama que ele contem — a guia desaparecia exactamente no
            # trecho que esta correcao existe para acrescentar.
            top = (median_z(back.x, back.y)
                   if ROAD_B_X + _EDGE <= back.x <= ROAD_A_X - _EDGE
                   and back.y > ROUNDABOUT_CY
                   else yard_surface(back.x, back.y)) + KERB_REVEAL
            low = roundabout_z(front.x, front.y) - 0.02
            pts.append((back, front, top, low))
        (b0, f0, t0, l0), (b1, f1, t1, l1) = pts
        vs = [bm.verts.new((b0.x, b0.y, t0)), bm.verts.new((f0.x, f0.y, t0)),
              bm.verts.new((f0.x, f0.y, l0)), bm.verts.new((b1.x, b1.y, t1)),
              bm.verts.new((f1.x, f1.y, t1)), bm.verts.new((f1.x, f1.y, l1))]
        f_top = bm.faces.new((vs[0], vs[1], vs[4], vs[3]))
        f_face = bm.faces.new((vs[1], vs[2], vs[5], vs[4]))
        s0, s1 = ROUNDABOUT_RO * a0, ROUNDABOUT_RO * a1
        for f, coords in ((f_top, ((s0, 0.0), (s0, KERB_W), (s1, KERB_W), (s1, 0.0))),
                          (f_face, ((s0, 0.0), (s0, 0.14), (s1, 0.14), (s1, 0.0)))):
            for l, c in zip(f.loops, coords):
                l[uv].uv = c

    me = bpy.data.meshes.new("rb_kerb")
    ob = bpy.data.objects.new("rb_kerb", me)
    bpy.context.collection.objects.link(ob)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(m_kerb)

    # ---- a marcacao: DUAS voltas, e as duas CIRCULAM ----------------------
    #
    # "a faixa deveria ser circulando a rotatoria, nao no meio da rua". Havia
    # uma volta so, encostada a ilha, e a 100 m ela le como um anel solto no
    # meio de um descampado de asfalto: nada marcava a BORDA da pista
    # circulatoria, que e a linha que da forma ao retorno visto de longe.
    #
    # Uma rotatoria tem as duas. A INTERNA e continua — a ilha nunca e cortada.
    # A EXTERNA acompanha o bordo do pavimento e ABRE nas entradas, pelos mesmos
    # dois arcos que abrem a guia externa (rb_mouths), para nao dizer "nao entre"
    # exatamente onde entrar e o proposito.
    marks = []
    for r_line, skip_entry in ((ROUNDABOUT_RI + KERB_W + 0.55, False),
                               (ROUNDABOUT_RO - 0.45, True)):
        n_arc = max(72, int(2.0 * math.pi * r_line / 1.1))
        for i in range(n_arc):
            a0 = 2.0 * math.pi * i / n_arc
            a1 = 2.0 * math.pi * (i + 1) / n_arc
            am = (a0 + a1) / 2.0
            if skip_entry and rb_in_mouth(rb_rel(am)):
                continue
            x = ROUNDABOUT_CX + r_line * math.cos(am)
            y = ROUNDABOUT_CY + r_line * math.sin(am)
            ln = r_line * (a1 - a0) * 1.06
            h = 0.35 + 0.65 * fbm(x / 30.0, y / 30.0, 977, 3)
            marks.append((x, y, 0.12, ln, math.degrees(am), h))
    # ---- AS FAIXAS DA APROXIMACAO, que faltavam --------------------------
    #
    # "alem de tambem estar faltando as faixas da rua". As marcacoes das pistas
    # param em ROAD_Y0 (onde o pavimento delas acaba) e dai para o balao ficavam
    # 23 m de asfalto sem uma linha — justamente o troco em que o condutor tem
    # de saber onde e a sua faixa. Sao tres coisas, todas sobre o leque:
    #   * a linha de bordo de cada pista, prolongada ate ao arco;
    #   * o eixo tracejado a morrer 6 m antes (num balao as faixas fundem-se);
    #   * a linha de RETENCAO na entrada, em arco, que e o "de a preferencia".
    for cx in (ROAD_A_X, ROAD_B_X):
        for sx in (-ROAD_W / 2 + 0.42, ROAD_W / 2 - 0.42):
            x = cx + sx
            dx = x - ROUNDABOUT_CX
            under = ROUNDABOUT_RO * ROUNDABOUT_RO - dx * dx
            y_arc = ROUNDABOUT_CY + math.sqrt(under) if under > 0 else ROAD_Y0
            y = y_arc + 0.6
            while y < ROAD_Y0 + 0.4:
                seg = min(4.0, ROAD_Y0 + 0.4 - y)
                if seg < 0.4:
                    break
                h = 0.35 + 0.65 * fbm(x / 30.0, y / 30.0, 977, 3)
                marks.append((x, y + seg / 2.0, 0.14, seg, 0.0, h))
                y += seg
        # eixo tracejado ate 6 m do arco
        under = ROUNDABOUT_RO * ROUNDABOUT_RO - (cx - ROUNDABOUT_CX) ** 2
        y_arc = ROUNDABOUT_CY + math.sqrt(under) if under > 0 else ROAD_Y0
        _dashes(cx, marks, y_arc + 6.0, ROAD_Y0 + 0.4)

    if marks:
        add_marks("rb_markings", m_line, marks, seg_len=0.8, dz=0.012,
                  z_fn=lambda x, y: (roundabout_z(x, y) if in_roundabout(x, y)
                                     else road_z(x, road_cx(x) or 0.0)))
    _mo = rb_mouths()
    log("  balao: r %.1f m (ilha %.1f, circulatoria %.1f), 2 bocas de %.0f m, "
        "guia aberta em %.0f de 360 graus, %d pedras na ilha"
        % (ROUNDABOUT_RO, ROUNDABOUT_RI, ROUNDABOUT_W, ROAD_W,
           math.degrees(sum(hi - lo for lo, hi in _mo)), n_stone))


def build_highway(m_road, m_gravel, m_line):
    """A rodovia que cruza a saida da planta.

    ELA E A UNICA COISA NA CENA QUE PODE CORRER ATE A BRUMA, e e por isso que ela
    existe: a via interna deixou de o fazer (ver ROAD_Y0/ROAD_Y1) e alguma coisa
    tem de explicar para onde vai um caminhao que sai pelo portao. Uma rodovia
    que se perde no horizonte nao le como defeito — le como rodovia.

    Corre a GROUND inteira em x, 86 m ao norte da cerca, com acostamento de brita
    dos dois lados e eixo tracejado. O pavimento e abaulado em torno do proprio
    eixo, pela mesma road_z das outras pistas, so que no eixo transposto.
    """
    half = HIGHWAY_W / 2.0

    def hz(x, y):
        t = min(1.0, abs(y - HIGHWAY_Y) / half)
        return -ROAD_CROWN * t * t

    r = add_grid("highway", GROUND, HIGHWAY_W, m_road, cx=0.0, cy=HIGHWAY_Y,
                 cuts=150, cuts_y=10, uv_scale=8.0, z_fn=hz)
    paint_variation(r, seed=14.2, road_wear=True, cx=0.0)

    # Acostamento de brita, e ele TALUDA ATE O CAMPO em vez de acabar em degrau.
    #
    # O bordo do pavimento esta a ~-9,5 cm e o campo a -28 cm e caindo: uma
    # faixa plana de brita deixa um degrau de ~19 cm correndo 1,2 km ao lado da
    # rodovia, que a 200 m le como uma fita clara com sombra propria. Alargado
    # para 5 m e interpolando de uma cota a outra, o mesmo material passa a ser
    # o talude que uma estrada rural tem de facto.
    for sy in (-1.0, 1.0):
        w = HIGHWAY_SHOULDER
        cy = HIGHWAY_Y + sy * (half + w / 2.0)
        y_in = HIGHWAY_Y + sy * half

        def _sz(x, y, _sy=sy, _yin=y_in, _w=w):
            t = min(1.0, max(0.0, abs(y - _yin) / _w))
            t = t * t * (3.0 - 2.0 * t)
            return (-ROAD_CROWN - 0.04) + (outland_z(x, y) - 0.06
                                           - (-ROAD_CROWN - 0.04)) * t

        s = add_grid("hw_shoulder_%s" % ("n" if sy > 0 else "s"),
                     GROUND, w, m_gravel, cx=0.0, cy=cy,
                     cuts=120, cuts_y=4, uv_scale=64.0, z_fn=_sz)
        paint_variation(s, seed=14.6 + sy)

    # ---- a garganta: o corredor inteiro em asfalto na aproximacao ---------
    #
    # Entre o nariz do canteiro e a rodovia nao ha canteiro, ha pavimento. Este
    # e o mesmo papel do `median_gap_liner` nas transversais e do `rb_apron` no
    # balao: sob o vao do canteiro tem de haver uma superficie de pleno direito,
    # senao cada fresta entre pista, sarjeta e grama mostra o que estiver por
    # baixo — aqui, a brita do campo 63 cm abaixo.
    tx0 = ROAD_B_X - ROAD_W / 2.0 - 0.4
    tx1 = ROAD_A_X + ROAD_W / 2.0 + 0.4
    ty0 = ROAD_Y1 - MEDIAN_THROAT - MEDIAN_GAP_R - 0.4
    th = add_grid("hw_throat", tx1 - tx0, ROAD_Y1 - ty0, m_road,
                  cx=(tx0 + tx1) / 2.0, cy=(ty0 + ROAD_Y1) / 2.0,
                  cuts=16, cuts_y=8, uv_scale=8.0,
                  z_fn=lambda x, y: min(road_z(x, road_cx(x)) if road_cx(x) is not None
                                        else -ROAD_CROWN,
                                        median_z(x, y)) - 0.05)
    paint_variation(th, seed=15.4)

    marks = []
    # eixo tracejado, com o vao aberto onde as duas pistas internas chegam
    y = HIGHWAY_Y
    x = -GROUND / 2.0
    while x < GROUND / 2.0:
        ln = 4.0
        gap = 8.0
        near_junction = any(abs(x - cx) < ROAD_W * 0.9 for cx in (ROAD_A_X, ROAD_B_X))
        if not near_junction:
            h = 0.35 + 0.65 * fbm(x / 30.0, y / 30.0, 977, 3)
            marks.append((x + ln / 2.0, y, ln, 0.16, 0.0, h))
        x += ln + gap
    # linhas de bordo continuas, abertas nas duas bocas
    for sy in (-1.0, 1.0):
        ey = HIGHWAY_Y + sy * (half - 0.42)
        x = -GROUND / 2.0
        while x < GROUND / 2.0:
            seg = 20.0
            xm = x + seg / 2.0
            # so o lado sul e cortado: e por ele que a via interna entra
            if sy < 0 and any(abs(xm - cx) < ROAD_W * 0.85
                              for cx in (ROAD_A_X, ROAD_B_X)):
                x += seg
                continue
            h = 0.35 + 0.65 * fbm(xm / 30.0, ey / 30.0, 977, 3)
            marks.append((xm, ey, seg, 0.14, 0.0, h))
            x += seg
    # e a barra de PARE de cada pista interna, no bordo da rodovia
    for cx in (ROAD_A_X, ROAD_B_X):
        marks.append((cx, ROAD_Y1 - 1.2, ROAD_W - 0.9, 0.42, 0.0, 0.9))
    add_marks("hw_markings", m_line, marks, seg_len=1.0, dz=0.012,
              z_fn=lambda x, y: hz(x, y) if abs(y - HIGHWAY_Y) <= half
              else road_z(x, road_cx(x) or 0.0))
    log("  rodovia: %.0f m em y=%.0f, %d marcacoes" % (GROUND, HIGHWAY_Y, len(marks)))


def build_outland(m_grass):
    """The land beyond the fence — and the "azulado depois da grama".

    WHAT THE BLUE BAND WAS. The engine draws a horizon-haze shell at 570 m
    painted with the PRESET's fogColor so fogged ground and fogged sky meet at
    one colour. That works when the sky is the procedural gradient. This
    environment uses the `rodovia` HDRI, whose horizon is a different hue, so
    the shell stopped being a blend and became a light-blue ribbon laid over the
    photograph. It is fixed in the manifest (`horizonColor`, measured off the
    HDRI's own horizon band), not here.

    AND NO BERM. A 3 m bank at 264 m drew a crisp dark ridge directly against
    that ribbon, and adding a hard silhouette in front of a seam does not hide
    the seam, it frames it. What is here instead is deliberately soft: very low,
    very broad relief that never presents an edge to the sky, so fog — not
    geometry — is what ends the ground.
    """
    _out = GROUND / 2.0
    _band = _out - YARD_HALF
    _mid = YARD_HALF + _band / 2.0
    for nm, cx, cy, w, d in (
        ("out_n", 0.0, _mid, GROUND, _band),
        ("out_s", 0.0, -_mid, GROUND, _band),
        ("out_e", _mid, 0.0, _band, YARD_HALF * 2),
        ("out_w", -_mid, 0.0, _band, YARD_HALF * 2),
    ):
        # A amplitude entra em rampa com a distancia da cerca (ver outland_z),
        # para que o chao logo depois do arame fique plano e nivelado com a
        # grama de dentro — relevo comecando de supetao na divisa seria a sua
        # propria emenda.
        ob = add_grid(nm, w, d, m_grass, cx=cx, cy=cy, cuts=26, uv_scale=64.0,
                      z_fn=outland_z)
        paint_variation(ob, seed=5.7)
    log("  outland: 4 bands, soft relief ramping in past the fence")
    build_farmland()


# ---------------------------------------------------------------------------
# A LAVOURA — o que estava fora da cerca e por que quatro planos verdes nao
# resolviam o horizonte.
#
# O relato e "o blur comeca muito cedo e fica muito falso". A bruma nao comecava
# cedo: ela comeca em r=570 m e o chao vai a 590, exatamente como foi desenhado.
# O que comecava cedo era a INFORMACAO. Passada a cerca havia 440 m de um unico
# plano de grama com um campo de ruido por cima — nenhuma borda, nenhuma
# estrutura, nada com tamanho conhecido. Um plano sem escala nao le como
# distancia; le como neblina que comecou. Por isso qualquer valor de `haze`
# parecia errado: nao havia nada por tras dela para ser revelado.
#
# O que da profundidade a um campo aberto real e a PARCELA. Talhoes de tamanhos
# diferentes, cada um com a sua cultura, o seu tom e a SUA DIRECAO DE PLANTIO,
# separados por carreadores. As linhas de plantio de um talhao convergem para o
# ponto de fuga dele e nao para o do vizinho, e e essa discordancia entre vizinhos
# que o olho le como quilometros. Custa uma malha e nenhuma textura nova.
#
# NADA AQUI E INSTANCIADO, e isso e uma medicao e nao uma economia: a orbita para
# em ~31 m e a lavoura comeca a 150 m, entao nenhuma planta desta area chega a
# ter 2 px de altura. Geometria por pe de soja seria orcamento gasto onde nem o
# mipmap chega. O que se ve a 150-590 m e tom, borda e direcao de linha — e as
# tres cabem no COLOR_0.
# ---------------------------------------------------------------------------
# (tom base, forca da listra de plantio, passo da linha em metros)
CROPS = [
    ((0.30, 0.42, 0.16), 0.16, 1.9),     # soja fechada, verde escuro
    ((0.44, 0.52, 0.21), 0.20, 1.7),     # soja mais clara
    ((0.58, 0.58, 0.28), 0.22, 2.2),     # soja secando, amarelando
    ((0.62, 0.55, 0.36), 0.15, 3.0),     # palhada / restolho
    ((0.46, 0.38, 0.28), 0.26, 2.6),     # solo preparado, linha de grade forte
    ((0.36, 0.46, 0.22), 0.12, 2.0),     # pasto, quase sem linha
]


def _outland_free(x, y, pad=0.0):
    """Ha lavoura em (x, y)? Nao dentro da cerca, nem sob a rodovia, nem sob a
    faixa que liga o portao a ela."""
    if max(abs(x), abs(y)) <= YARD_HALF + pad:
        return False
    if abs(y - HIGHWAY_Y) <= HIGHWAY_W / 2.0 + HIGHWAY_SHOULDER + pad + 1.0:
        return False
    if YARD_HALF <= y <= ROAD_Y1 + pad:
        for cx in (ROAD_A_X, ROAD_B_X):
            if abs(x - cx) <= ROAD_W / 2.0 + 2.0 + pad:
                return False
    return True


def build_farmland():
    m_crop = mat("CROP_FIELD", (0.38, 0.44, 0.20, 1), 0.95)
    lim = GROUND / 2.0 - 6.0
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    col = bm.loops.layers.float_color.new("Col")

    n_parcel = 0
    # Grade IRREGULAR: as linhas da grade sao sorteadas em vez de uniformes, e
    # depois cada talhao ainda recua as suas bordas. Uma grade regular de 440 m
    # de campo aberto le como um tabuleiro, que e o defeito oposto ao que isto
    # veio resolver.
    def _lines(a, b, lo, hi, s):
        out, t = [a], a
        i = 0
        while t < b:
            t += lo + (hi - lo) * _hash01(i, s, 733)
            i += 1
            out.append(min(t, b))
        return out

    xs = _lines(-lim, lim, 95.0, 210.0, 11)
    ys = _lines(-lim, lim, 95.0, 210.0, 23)

    for iy in range(len(ys) - 1):
        for ix in range(len(xs) - 1):
            x0, x1 = xs[ix], xs[ix + 1]
            y0, y1 = ys[iy], ys[iy + 1]
            # o carreador entre talhoes: 3 a 7 m de borda que nao e plantada
            m = 3.0 + 4.0 * _hash01(ix, iy, 337)
            x0, x1, y0, y1 = x0 + m, x1 - m, y0 + m, y1 - m
            if x1 - x0 < 25.0 or y1 - y0 < 25.0:
                continue
            # O talhao inteiro tem de estar livre. Testar so o centro deixava
            # meio talhao por cima da rodovia.
            if not all(_outland_free(px, py, 2.0)
                       for px in (x0, (x0 + x1) / 2.0, x1)
                       for py in (y0, (y0 + y1) / 2.0, y1)):
                continue
            k = int(_hash01(ix, iy, 401) * len(CROPS)) % len(CROPS)
            tint, stripe, pitch = CROPS[k]
            ang = math.radians(_hash01(ix, iy, 419) * 180.0)
            ca, sa = math.cos(ang), math.sin(ang)
            # ~14 m por celula: fino o bastante para o talhao acompanhar o
            # relevo do outland_z (que chega a +/-1,5 m) e grosso o bastante
            # para 40 talhoes nao custarem uma malha de cidade.
            nx = max(2, int((x1 - x0) / 14.0))
            ny = max(2, int((y1 - y0) / 14.0))
            grid = []
            for j in range(ny + 1):
                row = []
                for i in range(nx + 1):
                    x = x0 + (x1 - x0) * i / nx
                    y = y0 + (y1 - y0) * j / ny
                    row.append(bm.verts.new((x, y, outland_z(x, y) + 0.02)))
                grid.append(row)
            for j in range(ny):
                for i in range(nx):
                    f = bm.faces.new((grid[j][i], grid[j][i + 1],
                                      grid[j + 1][i + 1], grid[j + 1][i]))
                    for l in f.loops:
                        p = l.vert.co
                        l[uv].uv = (p.x / 64.0, p.y / 64.0)
                        # A LISTRA E A LINHA DE PLANTIO, projetada no eixo do
                        # talhao. Uma onda de periodo `pitch` nao sobrevive a uma
                        # celula de 14 m, e nao precisa: o que se le a 200 m e o
                        # BATIMENTO dela contra o relevo, mais a mudanca de
                        # direcao de um talhao para o outro. O termo de baixa
                        # frequencia e que carrega a leitura.
                        s = p.x * ca + p.y * sa
                        row_hi = 0.5 + 0.5 * math.sin(s * (2.0 * math.pi / pitch))
                        row_lo = 0.5 + 0.5 * math.sin(s * (2.0 * math.pi / 21.0))
                        v = 1.0 + stripe * (row_lo - 0.5) * 2.0 \
                            + stripe * 0.35 * (row_hi - 0.5) * 2.0
                        # e a irregularidade do proprio talhao: falha de plantio,
                        # baixada mais verde, cabeceira mais rala
                        v *= 0.86 + 0.28 * fbm(p.x / 55.0, p.y / 55.0, 613, 3)
                        l[col] = (tint[0] * v, tint[1] * v, tint[2] * v, 1.0)
            n_parcel += 1

    me = bpy.data.meshes.new("farmland")
    ob = bpy.data.objects.new("farmland", me)
    bpy.context.collection.objects.link(ob)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(m_crop)
    # A CAMADA TEM DE FICAR ACTIVA, senao nada disto chega ao .glb. Mesmo
    # armadilha que paint_variation documenta: o exportador grava a camada de cor
    # ACTIVA, e uma acabada de criar nao e activa por si. Aqui o COLOR_0 nao e
    # variacao — e a propria cultura de cada talhao —, entao perde-lo nao daria
    # um campo mais chapado, daria um campo BRANCO.
    try:
        attr = me.color_attributes.get("Col")
        if attr is not None:
            me.color_attributes.active_color = attr
            me.color_attributes.render_color_index = me.color_attributes.find("Col")
    except Exception as e:
        log("    lavoura: nao consegui activar o COLOR_0 (%s)" % e)
    log("  lavoura: %d talhoes de %d culturas, %d faces"
        % (n_parcel, len(CROPS), len(me.polygons)))


# ---------------------------------------------------------------------------
# Fence.
# ---------------------------------------------------------------------------
FENCE_H = 3.90              # to the top rail
FENCE_PLINTH = 0.45         # concrete upstand the posts are set into
FENCE_ARM = 0.55            # the barbed arm above the rail
FENCE_PITCH = 4.0           # post spacing


def _fence_mats():
    """Two materials WITH EMBEDDED TEXTURES, and deliberately not declared in
    environments.json.

    Everything else on the ground is a bare named slot the engine binds at
    runtime, which is what keeps set.glb small. The fence cannot be: its netting
    is an ALPHA CUTOUT and there is no chainlink alpha among the app's shared
    /textures. Keeping it out of the manifest's `materials` block matters for a
    second reason — set.ts collectSolids treats a mesh whose materials are all
    declared there as GROUND, i.e. not an obstacle. A perimeter the camera can
    fly through is not a perimeter.
    """
    props = _load("props_ph")
    wire = bpy.data.materials.get("FENCE_WIRE") or bpy.data.materials.new("FENCE_WIRE")
    wire.use_nodes = True
    nt = wire.node_tree
    b = nt.nodes.get("Principled BSDF")
    b.inputs["Roughness"].default_value = 0.72
    b.inputs["Metallic"].default_value = 0.25
    if os.path.exists(props.WIRE_ALPHA):
        img = bpy.data.images.load(props.WIRE_ALPHA, check_existing=True)
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = img
        t.extension = "REPEAT"
        nt.links.new(b.inputs["Base Color"], t.outputs["Color"])
        nt.links.new(b.inputs["Alpha"], t.outputs["Alpha"])
    else:
        log("  chainlink alpha missing: %s" % props.WIRE_ALPHA)
    # Alpha CUTOUT, not blend. Blended netting needs per-fragment sorting across
    # hundreds of metres of panel and still renders wrong against itself.
    # Clipped, it is order-independent and free. Blender has renamed these enums
    # more than once, so the value is probed rather than assumed.
    for val in ("CLIP", "DITHERED", "HASHED"):
        try:
            wire.blend_method = val
            break
        except TypeError:
            continue
    try:
        wire.alpha_threshold = 0.5
    except Exception:
        pass

    post = bpy.data.materials.get("FENCE_POST") or bpy.data.materials.new("FENCE_POST")
    post.use_nodes = True
    nt = post.node_tree
    b = nt.nodes.get("Principled BSDF")
    b.inputs["Roughness"].default_value = 0.55
    b.inputs["Metallic"].default_value = 0.85
    if os.path.exists(props.POSTS_DIFF):
        img = bpy.data.images.load(props.POSTS_DIFF, check_existing=True)
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = img
        nt.links.new(b.inputs["Base Color"], t.outputs["Color"])
    return wire, post


def _tube(bm, a, b, r, seg, mi):
    d = b - a
    ln = d.length
    if ln < 1e-6:
        return
    z = d.normalized()
    up = Vector((0, 0, 1)) if abs(z.z) < 0.95 else Vector((1, 0, 0))
    x = z.cross(up).normalized()
    y = z.cross(x)
    r0, r1 = [], []
    for i in range(seg):
        t = 2 * math.pi * i / seg
        o = x * math.cos(t) + y * math.sin(t)
        r0.append(bm.verts.new(a + o * r))
        r1.append(bm.verts.new(b + o * r))
    for i in range(seg):
        j = (i + 1) % seg
        bm.faces.new((r0[i], r0[j], r1[j], r1[i])).material_index = mi


def build_fence(m_kerb):
    """Perimeter fence on the property line, generated rather than imported.

    TALLER AND FURTHER, both asked for and both a number here now: ~4.35 m to
    the barbed tip against the old 3.6 m, standing at 330 m against 225 m. The
    old build's height was hostage to whatever kit was on disk — it normalised a
    ripped panel BY HEIGHT and then stretched X by 1.60 to get a believable post
    pitch, which is a lot of arithmetic to spend on not choosing.

    ONE MESH PER SIDE, not one object per panel. 2 640 m of perimeter at a 4 m
    pitch is 660 bays; as separate objects that is 660 draw calls for a thing
    that is 330 m away and mostly silhouette. Welded per side it is four.
    """
    wire, post = _fence_mats()
    total = 0
    for side in range(4):
        bm = bmesh.new()
        uv = bm.loops.layers.uv.new("UVMap")
        n = int((YARD_HALF * 2) / FENCE_PITCH)
        for i in range(n):
            t = -YARD_HALF + (i + 0.5) * FENCE_PITCH
            if side == 0:
                x, y, ax, ay = t, YARD_HALF, 1.0, 0.0
            elif side == 1:
                x, y, ax, ay = t, -YARD_HALF, 1.0, 0.0
            elif side == 2:
                x, y, ax, ay = YARD_HALF, t, 0.0, 1.0
            else:
                x, y, ax, ay = -YARD_HALF, t, 0.0, 1.0
            # Gates where each carriageway crosses the line. SO O LADO NORTE:
            # desde que a via interna termina no balao (ver ROAD_Y0), nada
            # atravessa a divisa sul, e um vao de 20 m no arame por onde nao
            # passa rua nenhuma e simplesmente um buraco na cerca.
            if side == 0 and (abs(t - ROAD_A_X) < ROAD_W * 0.75
                              or abs(t - ROAD_B_X) < ROAD_W * 0.75):
                continue
            base = grass_z(x, y)
            a = Vector((x - ax * FENCE_PITCH / 2, y - ay * FENCE_PITCH / 2, base))
            b = Vector((x + ax * FENCE_PITCH / 2, y + ay * FENCE_PITCH / 2, base))
            # ---- posts, rails, netting ----------------------------------
            _tube(bm, a + Vector((0, 0, -0.35)), a + Vector((0, 0, FENCE_H)),
                  0.055, 6, 1)
            _tube(bm, a + Vector((0, 0, FENCE_H - 0.04)),
                  b + Vector((0, 0, FENCE_H - 0.04)), 0.032, 5, 1)
            _tube(bm, a + Vector((0, 0, FENCE_PLINTH + 0.06)),
                  b + Vector((0, 0, FENCE_PLINTH + 0.06)), 0.026, 5, 1)
            # netting: two triangles, and the only reason this is affordable
            zb, zt = base + FENCE_PLINTH, base + FENCE_H
            vs = [bm.verts.new((a.x, a.y, zb)), bm.verts.new((b.x, b.y, zb)),
                  bm.verts.new((b.x, b.y, zt)), bm.verts.new((a.x, a.y, zt))]
            f = bm.faces.new(vs)
            f.material_index = 0
            # 5 cm links: the UV has to be in METRES or the mesh scale changes
            # with the panel and the fence stops being one fence.
            span = FENCE_PITCH / 0.62
            hgt = (FENCE_H - FENCE_PLINTH) / 0.62
            for l, (u, v) in zip(f.loops, ((0, 0), (span, 0), (span, hgt), (0, hgt))):
                l[uv].uv = (u, v)
            # ---- barbed arm, leaning OUT over the approach --------------
            out = Vector((0, 1, 0)) if side == 0 else \
                  Vector((0, -1, 0)) if side == 1 else \
                  Vector((1, 0, 0)) if side == 2 else Vector((-1, 0, 0))
            tip = a + Vector((0, 0, FENCE_H)) + out * FENCE_ARM * 0.62 \
                + Vector((0, 0, FENCE_ARM * 0.78))
            _tube(bm, a + Vector((0, 0, FENCE_H - 0.05)), tip, 0.028, 4, 1)
            for k in range(3):
                s = (k + 1) / 3.0
                pa = a + Vector((0, 0, FENCE_H - 0.05)) + (tip - a - Vector((0, 0, FENCE_H - 0.05))) * s
                pb = pa + Vector((b.x - a.x, b.y - a.y, 0.0))
                _tube(bm, pa, pb, 0.009, 3, 1)
            total += 1
        for f in bm.faces:
            if f.material_index == 1 and len(f.loops) and not f.loops[0][uv].uv.length:
                for l in f.loops:
                    l[uv].uv = (l.vert.co.z * 0.5, 0.0)
        me = bpy.data.meshes.new("fence_%d" % side)
        ob = bpy.data.objects.new("fence_%d" % side, me)
        bpy.context.collection.objects.link(ob)
        bm.to_mesh(me)
        bm.free()
        me.materials.append(wire)
        me.materials.append(post)

    # ---- the concrete plinth the whole run stands on --------------------
    # It is why the fence can be tall without looking like a net on sticks, and
    # it is also the thing that hides the joint between wire and undulating turf.
    bmp = bmesh.new()
    puv = bmp.loops.layers.uv.new("UVMap")
    for side in range(4):
        step = 8.0
        n = int((YARD_HALF * 2) / step)
        for i in range(n):
            t = -YARD_HALF + (i + 0.5) * step
            # SO O LADO NORTE ABRE, e este `continue` tinha ficado para tras.
            #
            # build_fence ja passou a fechar a divisa sul (a via interna termina
            # no balao), mas o rodape continuou a saltar os dois lados: onde a
            # cerca voltou a existir, ela ficava assente em coisa nenhuma e o
            # arame descia direto na turfa. E exatamente o "precisa do rodape
            # onde era uma cerca aberta". O teste tem de ser o MESMO dos dois
            # lacos, senao volta a divergir.
            if side == 0 and (abs(t - ROAD_A_X) < ROAD_W * 0.75
                              or abs(t - ROAD_B_X) < ROAD_W * 0.75):
                continue
            if side == 0:
                cx, cy, w, d = t, YARD_HALF, step, 0.26
            elif side == 1:
                cx, cy, w, d = t, -YARD_HALF, step, 0.26
            elif side == 2:
                cx, cy, w, d = YARD_HALF, t, 0.26, step
            else:
                cx, cy, w, d = -YARD_HALF, t, 0.26, step
            z = grass_z(cx, cy)
            res = bmesh.ops.create_cube(bmp, size=1.0,
                                        matrix=Matrix.Translation((cx, cy, z + FENCE_PLINTH / 2 - 0.12))
                                        @ Matrix.Diagonal((w, d, FENCE_PLINTH + 0.24, 1.0)))
            for v in res["verts"]:
                for lf in v.link_faces:
                    for l in lf.loops:
                        l[puv].uv = (l.vert.co.x / 2.0 + l.vert.co.y / 2.0, l.vert.co.z / 2.0)
    me = bpy.data.meshes.new("fence_plinth")
    ob = bpy.data.objects.new("fence_plinth", me)
    bpy.context.collection.objects.link(ob)
    bmp.to_mesh(me)
    bmp.free()
    me.materials.append(m_kerb)
    build_gates(wire, post)
    log("  fence: %d bays at %.1f m, %.2f m to the barb, on a %.2f m plinth"
        % (total, FENCE_PITCH, FENCE_H + FENCE_ARM * 0.78, FENCE_PLINTH))


def build_gates(wire, post):
    """The gates. There were none.

    THE FENCE HAD A HOLE, NOT A GATE. build_fence simply SKIPS the bays where a
    carriageway crosses the property line, which leaves a 20 m gap in the wire
    with nothing in it — "esta faltando o portao da grade". A gap says the fence
    is unfinished; a gate says the site is guarded and open for business, and it
    is the single most legible thing at an entrance.

    Each carriageway gets a sliding gate PARKED OPEN alongside its opening,
    which is what a working plant's gate looks like during the day, plus a pair
    of heavier posts marking the reveal. A closed gate would also mean a truck
    that cannot have arrived.
    """
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    n = 0
    for cx in (ROAD_A_X, ROAD_B_X):
        half = ROAD_W * 0.75
        # UM PORTAO SO, e ele e o do norte. Ver a nota gemea em build_fence: a
        # divisa sul deixou de ser atravessada, entao um portao la seria um
        # portao para lado nenhum.
        for sy in (1.0,):
            y = sy * YARD_HALF
            base = grass_z(cx, y)
            # ---- gate posts: heavier and taller than a fence post ---------
            for sx in (-1.0, 1.0):
                px = cx + sx * half
                _tube(bm, Vector((px, y, base - 0.5)),
                      Vector((px, y, base + FENCE_H + 0.75)), 0.13, 8, 1)
            # ---- the leaf, parked open along the fence line ---------------
            #
            # ELA RECOLHE PARA FORA, E ISSO ERA UM BUG MEDIDO. `x0 = cx + half`
            # mandava as DUAS folhas para leste. Na pista A isso e o lado de fora
            # e esta certo; na pista B o lado de fora e OESTE, e a folha ia parar
            # em x -11,19..-0,95 — ou seja atravessava o canteiro inteiro
            # (-14,37..-3,87) e ainda entrava na pista A (que comeca em -3,25).
            # E a "grade que esta ultrapassando a rua".
            #
            # E ELA COBRE A ABERTURA. Tinha `half * 1.05` = 10,2 m para um vao de
            # 19,5 m: uma folha que, fechada, deixaria metade do portao aberto —
            # que e o que se le como "muito pequena" mesmo estando recolhida.
            out = 1.0 if cx > (ROAD_A_X + ROAD_B_X) / 2.0 else -1.0
            leaf_w = 2.0 * half * 0.96
            x_in = cx + out * (half + 0.55)
            x0, x1 = min(x_in, x_in + out * leaf_w), max(x_in, x_in + out * leaf_w)
            zt = base + FENCE_H - 0.15
            zb = base + 0.22
            # frame: bottom rail (which is what the leaf runs on), top rail,
            # two stiles and two diagonal braces
            _tube(bm, Vector((x0, y, zb)), Vector((x1, y, zb)), 0.045, 5, 1)
            _tube(bm, Vector((x0, y, zt)), Vector((x1, y, zt)), 0.045, 5, 1)
            _tube(bm, Vector((x0, y, zb)), Vector((x0, y, zt)), 0.045, 5, 1)
            _tube(bm, Vector((x1, y, zb)), Vector((x1, y, zt)), 0.045, 5, 1)
            _tube(bm, Vector((x0, y, zb)), Vector((x1, y, zt)), 0.028, 4, 1)
            mid = (x0 + x1) / 2.0
            _tube(bm, Vector((mid, y, zb)), Vector((mid, y, zt)), 0.035, 4, 1)
            # netting infill
            vs = [bm.verts.new((x0, y, zb)), bm.verts.new((x1, y, zb)),
                  bm.verts.new((x1, y, zt)), bm.verts.new((x0, y, zt))]
            f = bm.faces.new(vs)
            f.material_index = 0
            for l, (u, v) in zip(f.loops, ((0, 0), (leaf_w / 0.62, 0),
                                           (leaf_w / 0.62, (zt - zb) / 0.62),
                                           (0, (zt - zb) / 0.62))):
                l[uv].uv = (u, v)
            n += 1
    me = bpy.data.meshes.new("gates")
    ob = bpy.data.objects.new("gates", me)
    bpy.context.collection.objects.link(ob)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(wire)
    me.materials.append(post)
    log("  gates: %d sliding leaves, parked open" % n)


def build_service_roads(m_road, m_line):
    """Internal asphalt, RENTE a laje — nao por cima dela.

    A via interna era um recapeamento 3 cm proud. Somados aos 12 cm da laje,
    corria a +15 cm sobre o eixo da pista, acima do dorso do meio-fio: "as ruas
    secundarias parecem ser mais elevadas que a principal". Agora a cota vem de
    `svc_surface_z`, que e a da laje, e a folga contra o z-fight vem do rebaixo
    de `yard_surface` — ver o comentario la. O que se levanta e o que nao se ve.
    """
    q = []
    n = 0
    eps = 1e-4
    for x0, x1, y0, y1 in SERVICE_ROADS:
        d = y1 - y0
        for (sx0, sx1) in svc_spans(x0, x1):
            # A TRANSVERSAL NAO ATRAVESSA MAIS O CANTEIRO, e este e o terceiro e
            # ultimo sitio do mesmo defeito.
            #
            # `svc_spans` parte a transversal nos trechos que nao sao pista: um
            # a oeste, um a leste, e o do MEIO, que corre dentro do canteiro. Com
            # o canteiro fechado (ver `breaks`) esse trecho do meio ficou a ser
            # construido por baixo da grama — asfalto a -3 cm, forro a -8 cm e
            # grama a +7 cm, portanto invisivel. O que se VE e o que vem com ele:
            # a guia a +12 cm e a sarjeta, um retangulo de cantos arredondados
            # pousado no meio do canteiro, que e o "meio fio da divisao que o
            # canteiro central tinha ainda esta la".
            #
            # Medido: svc_03 com 378 vertices, median_gap_liner com 607, gutters
            # com 96 e kerbs com 312, todos entre x -14,4 e -3,9.
            if ROAD_B_X + ROAD_W / 2.0 - 0.5 <= sx0 and sx1 <= ROAD_A_X - ROAD_W / 2.0 + 0.5:
                continue
            # Resolucao em X bem mais fina que o necessario para a cota: quem
            # pede e a CONCORDANCIA abaixo, que so pode ser tao curva quanto o
            # numero de colunas dentro do raio. Em Y sobe para 4 cortes porque a
            # fiada da borda anda ate 6 m ao abrir a boca, e com 2 cortes o
            # quadrilatero vizinho virava um trapezio de 10 m de altura.
            #
            # E A COLUNA E DIMENSIONADA PELO RAIO, nao por um passo fixo. Um
            # passo de 1,2 m dava 5 colunas dentro do raio de 6 m — o suficiente
            # para ler como curva —, mas dentro do raio de 2 m da abertura do
            # canteiro dava UMA, ou seja um chanfro reto. O passo e r/5 nos dois
            # casos, entao a curva tem a mesma resolucao angular em qualquer
            # raio.
            _rmin = min([r for _e, _s, r in road_flares(sx0, sx1)] or [6.0])
            ob = add_grid("svc_%02d" % n, sx1 - sx0, d, m_road,
                          cx=(sx0 + sx1) / 2.0, cy=(y0 + y1) / 2.0,
                          cuts=max(8, int((sx1 - sx0) / min(1.2, _rmin / 5.0))),
                          cuts_y=max(4, int(d / 2.0)),
                          uv_scale=8.0, z_fn=svc_surface_z)

            # ---- CONCORDANCIA: a boca abre em quarto de circulo -----------
            #
            # Um entroncamento em esquadro nao existe em obra: um caminhao nao
            # faz a curva. A borda da via transversal sai reta, curva num raio R
            # e chega TANGENTE a borda da via principal — e e esse alargamento
            # que le como "encontro" em vez de duas fitas encostadas.
            #
            # O RAIO E O MESMO FLARE_R QUE O MEIO-FIO USA. Era um `R = 6.0`
            # local; enquanto for local, mexer nele desalinha silenciosamente o
            # asfalto do arco de meio-fio que o contorna.
            #
            # OS SINALIZADORES SAO LIDOS ANTES DE MOVER, e essa ordem era o
            # terceiro defeito da boca. O arremate que abaixa a borda ate a laje
            # testava `abs(v.co.y - y0) < eps` DEPOIS do deslocamento, entao
            # justamente os vertices da curva ja nao casavam: a concordancia
            # ficava com o degrau de 3 cm que o arremate existe para matar, e e
            # o friso escuro que contorna a boca em i_junc.png.
            # A LIGACAO PELO CANTEIRO TAMBEM CURVA, num raio menor (2 m em vez
            # de 6). Ela ficava de fora e as quatro quinas da abertura eram
            # cantos vivos. Quem decide o raio e road_flares, uma leitura so,
            # partilhada com a guia e com o recuo do canteiro.
            ends = road_flares(sx0, sx1)
            marks = []
            for v in ob.data.vertices:
                marks.append((abs(v.co.x - sx0) < eps or abs(v.co.x - sx1) < eps,
                              abs(v.co.y - y0) < eps,
                              abs(v.co.y - y1) < eps))
            if ends:
                for v, (_on_end, on_lo, on_hi) in zip(ob.data.vertices, marks):
                    if not (on_lo or on_hi):
                        continue
                    best = mouth_flare(v.co.x, ends)
                    if best > 0.0:
                        v.co.y += -best if on_lo else best
                ob.data.update()

            # A BORDA DESCE ATE O PISO — e o fim do "rodape".
            #
            # Um recapeamento 3 cm acima da laje resolve o z-fight e, em troca,
            # cria um degrau vertical de 3 cm em todo o perimetro. De pe isso e
            # invisivel; na rasante da camera vira um friso escuro contornando a
            # via, como tapete sobre o piso. Asfalto lancado sobre concreto e
            # SARRAFEADO ate zero na borda, entao o anel externo desce.
            #
            # SALVO ONDE HA MEIO-FIO. Sarrafear a borda da boca seria desfazer a
            # juncao que o arco acabou de construir: a sarjeta encosta na borda
            # do pavimento NA COTA DELE, e uma borda abaixada 3 cm ali reabre o
            # degrau do lado de dentro. Onde existe guia, quem faz o arremate e a
            # guia — que e a unica leitura em que "curva suave" e "continuar o
            # rodape" nao se contradizem.
            #
            # NAS LATERAIS DE UM TRECHO COM GUIA NAO HA SARRAFEAMENTO NENHUM,
            # e isso mudou junto com o meio-fio passar a correr a via inteira.
            # Antes a guia so existia nos 14 m da boca e o resto da borda era
            # recapeamento sarrafeado; agora as duas laterais tem guia de ponta
            # a ponta, e abaixar a borda 3 cm por baixo da sarjeta reabriria o
            # degrau que a sarjeta existe para cobrir. Sobra a PONTA LIVRE — onde
            # a via morre no patio sem encontrar pista nenhuma —, e ali sim o
            # asfalto e sarrafeado ate o piso.
            for v, (on_end, on_lo, on_hi) in zip(ob.data.vertices, marks):
                if not (on_end or on_lo or on_hi):
                    continue
                if ends and (on_lo or on_hi):
                    continue                      # lateral com guia
                if on_end and any(abs(v.co.x - e) < 0.5 for e, _s, _r in ends):
                    continue                      # encosta na pista, ja esta na cota dela
                v.co.z = min(v.co.z, yard_z(v.co.x, v.co.y))
            ob.data.update()

            # AS UV SAO REFEITAS DEPOIS DE TUDO — o "nao perder texturas".
            #
            # add_grid escreve uv = posicao/8 e SO ENTAO o deslocamento da
            # concordancia acontece. As UV ficavam as do retangulo: no vertice
            # que anda 6 m, o asfalto era esticado por um fator de ate 2,5 na
            # ultima fiada, bem na boca, que e o pedaco que a camera olha.
            # Reescrever a partir da posicao FINAL custa uma passada e devolve a
            # escala do ladrilho em toda a curva.
            reuv(ob, 8.0)
            paint_variation(ob, seed=9.1 + n)
            n += 1

        # ---- linha de bordo, parando antes de cada cruzamento -------------
        # Uma linha continua atravessando a boca de um entroncamento e a
        # marcacao que nao pode existir ali: diz "nao cruze" no unico ponto onde
        # cruzar e o proposito.
        # O TESTE ERA NO CENTRO DO TRECHO, e por isso ele nao protegia nada.
        #
        # Com trechos de 16 m, o primeiro centro livre de svc_04 caia em x=17,75
        # — fora da zona — mas o trecho que ele gera vai de 9,75 a 25,75, ou
        # seja, ENTRA 5 m dentro da rampa do entroncamento. A linha era assentada
        # na cota plana da laje enquanto o asfalto descia, e o resultado sao os
        # dois tocos brancos inclinados, pairando ate 20 cm, que aparecem soltos
        # sobre a boca. Testar a EXTENSAO e a correcao; a cota tambem foi
        # corrigida (surface_z), mas uma faixa continua atravessando a boca de um
        # entroncamento e a marcacao que nao pode existir ali de qualquer forma.
        def spans_junction(a, b):
            for c in (ROAD_A_X, ROAD_B_X):
                if b > c - ROAD_W / 2.0 - (FLARE_R + 2.0) \
                        and a < c + ROAD_W / 2.0 + (FLARE_R + 2.0):
                    return True
            return False

        if (x1 - x0) > d:
            for sy in (y0 + 0.45, y1 - 0.45):
                t = x0
                while t < x1:
                    seg = 16.0
                    if not spans_junction(t, t + seg):
                        h = 0.30 + 0.6 * fbm(t / 21.0, sy / 21.0, 613, 3)
                        q.append((t + seg / 2, sy, seg, 0.12, 0.0, h))
                    t += seg
        else:
            for sx in (x0 + 0.45, x1 - 0.45):
                t = y0
                while t < y1:
                    seg = 16.0
                    h = 0.30 + 0.6 * fbm(sx / 21.0, t / 21.0, 617, 3)
                    q.append((sx, t + seg / 2, 0.12, seg, 0.0, h))
                    t += seg
    if q:
        # A TINTA SEGUE A VIA, e nao a laje. Enquanto a via era `laje + 3 cm` as
        # duas expressoes davam o mesmo numero fora dos entroncamentos e o erro
        # so aparecia na rampa; agora que a via e rente a laje mas MERGULHA ao
        # encontrar a pista, so `svc_surface_z` acompanha.
        add_marks("svc_markings", m_line, q, z_fn=svc_surface_z)
    log("  service roads: %d trechos, %d linhas de bordo" % (n, len(q)))


def build_yard_edge(m_kerb):
    """A kerb around the paved yard, which is what turns the turf into a bed.

    "A grama ... deveria ser como se fosse um canteiro depois do piso." A canteiro
    is not a material change, it is an EDGE: paving stops against a kerb and the
    planting sits behind it. Without one the slab just fades into grass, which
    reads as the concrete having run out rather than as a landscaped verge.

    Skipped where the carriageways and the service roads cross, because a kerb
    across a road is a kerb no lorry could climb.
    """
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    n = 0
    step = 9.0

    def crosses(x, y):
        if ROAD_B_X - _EDGE - 1.0 <= x <= ROAD_A_X + _EDGE + 1.0:
            return True
        for sx0, sx1, sy0, sy1 in SERVICE_ROADS:
            if sx0 - 1.5 <= x <= sx1 + 1.5 and sy0 - 1.5 <= y <= sy1 + 1.5:
                return True
        return False

    edges = [("s", YARD_X0, YARD_X1, YARD_Y0, True), ("n", YARD_X0, YARD_X1, YARD_Y1, True),
             ("w", YARD_Y0, YARD_Y1, YARD_X0, False), ("e", YARD_Y0, YARD_Y1, YARD_X1, False)]
    for _nm, a0, a1, fixed, along_x in edges:
        t = a0
        while t < a1:
            b = min(a1, t + step)
            x0, y0 = (t, fixed) if along_x else (fixed, t)
            x1, y1 = (b, fixed) if along_x else (fixed, b)
            if crosses((x0 + x1) / 2.0, (y0 + y1) / 2.0):
                t += step
                continue
            zt = yard_z((x0 + x1) / 2.0, (y0 + y1) / 2.0) + 0.03
            half = 0.13
            if along_x:
                corners = ((x0, y0 - half), (x1, y1 - half), (x1, y1 + half), (x0, y0 + half))
            else:
                corners = ((x0 - half, y0), (x1 - half, y1), (x1 + half, y1), (x0 + half, y0))
            lo_z = zt - 0.40
            vb = [bm.verts.new((cxx, cyy, lo_z)) for cxx, cyy in corners]
            vt = [bm.verts.new((cxx, cyy, zt)) for cxx, cyy in corners]
            for quad in ((vt[0], vt[1], vt[2], vt[3]),
                         (vb[0], vb[3], vb[2], vb[1]),
                         (vb[0], vb[1], vt[1], vt[0]),
                         (vb[2], vb[3], vt[3], vt[2]),
                         (vb[1], vb[2], vt[2], vt[1]),
                         (vb[3], vb[0], vt[0], vt[3])):
                try:
                    f = bm.faces.new(quad)
                except ValueError:
                    continue
                for l in f.loops:
                    l[uv].uv = (l.vert.co.x / 1.2 + l.vert.co.y / 1.2, l.vert.co.z / 1.2)
            n += 1
            t += step
    me = bpy.data.meshes.new("yard_edge")
    ob = bpy.data.objects.new("yard_edge", me)
    bpy.context.collection.objects.link(ob)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(m_kerb)
    log("  yard edge: %d kerb runs bounding the planting" % n)


# ---------------------------------------------------------------------------
# Planting.
#
# WHERE THE TREES CAN AND CANNOT GO, which is a camera question before it is a
# landscaping one. The orbit frames a 19 m rig and pulls in to a few metres, so
# anything inside ~45 m of the origin can end up between the lens and the truck.
# A building at that distance is a wall and obviously wrong; a tree is worse,
# because it is a thin thing that swings through frame and reads as a glitch.
#
# So the near median carries GRASS AND LOW SCRUB ONLY and the trees start at
# |y| > 52 m. That is not a compromise: junction sight lines are kept clear on
# real dual carriageways for exactly the same reason, so the rule that protects
# the camera is the rule that makes the median correct.
# ---------------------------------------------------------------------------
def plantable(x, y, pad=1.5):
    """Ha GRAMA em (x, y)? A pergunta que faltava a plantacao.

    `on_paving` sozinho nao chega: ele conhece o corredor viario e a laje, e nao
    conhece nem o balao (que e um disco, nao um retangulo) nem as vias internas
    nem a rodovia. Somados, sao as quatro superficies onde apareceu arvore.

    A folga existe porque uma arvore nao e um ponto: a copa tem 2 a 3 m de raio
    e o tronco tem de ficar longe o suficiente do bordo para a copa nao pairar
    sobre a pista.
    """
    if on_paving(x, y):
        return False
    if in_roundabout(x, y, pad):
        return False
    if on_service_road(x, y, pad):
        return False
    if abs(y - HIGHWAY_Y) <= HIGHWAY_W / 2.0 + HIGHWAY_SHOULDER + pad:
        return False
    # o corredor das duas pistas onde ele corre FORA da cerca (portao -> rodovia)
    if YARD_HALF <= y <= ROAD_Y1 + pad:
        for cx in (ROAD_A_X, ROAD_B_X):
            if abs(x - cx) <= ROAD_W / 2.0 + 2.0 + pad:
                return False
    return True


def plant(m_grass):
    veg = _load("veg")

    # IMPOSTORS OF THE REAL POLY HAVEN PLANTS, one prototype per baked column.
    #
    # These replace the procedural blobs outright. The blobs were honest about
    # their constraint — no alpha map anywhere in the project, so foliage had to
    # be solid mass — and bake_impostors.py removes that constraint by
    # photographing the actual CC0 asset onto transparent film. What stands in
    # the belt now IS a jacaranda, at six triangles.
    #
    # Falls back to the generated trees if the bake has not been run, because a
    # missing texture directory should not turn the district bald.
    # ---- GEOMETRIA DE VERDADE, quando o pack esta no disco ----------------
    #
    # `_src_trees` traz troncos, ramos e cartoes de folha modelados. Ele SUBSTITUI
    # o impostor, e o motivo e o que 08-arvores-de-perto.png mostra: um cartao
    # cruzado resolve a silhueta a 60 m e nao resolve nada a 10 m, e o cinturao e
    # visto das duas distancias. O impostor fica como recuo — um pack ausente nao
    # pode deixar o distrito careca.
    #
    # O CUSTO E O QUE TORNA ISTO POSSIVEL, e nao mudou: continuam a ser ~10 malhas
    # instanciadas 450 vezes. O que mudou foi o conteudo de cada malha — 2 a 5 k
    # faces em vez de 6 triangulos —, e como o instancing e por malha, o .glb
    # cresce uma vez e nao 450.
    try:
        tp = _load("trees_pack")
        trees, bushes = tp.build_prototypes(log=lambda m: log("  " + m))
    except Exception as e:
        log("  pack de arvores indisponivel (%s) — voltando aos impostores" % e)
        trees, bushes = [], []
    if trees:
        log("  plantas: %d arvores, %d arbustos (geometria do pack)"
            % (len(trees), len(bushes)))

    for spec, target in () if trees else (
            ("jacaranda_tree", trees), ("island_tree_02", trees),
            ("searsia_lucida", bushes)):
        meta_path = os.path.join(veg.IMPOSTORS, spec + ".json")
        if not os.path.exists(meta_path):
            continue
        import json as _json
        meta = _json.load(open(meta_path))
        # A COPA E UMA FOTO SO POR ESPECIE — a vista de cima nao tem azimute a
        # variar, e o cartao ainda gira por semente na hora de montar a planta.
        top_png = os.path.join(veg.IMPOSTORS, "%s_top.png" % spec)
        top_mat = (veg.card_material("PLANT_%s_top" % spec[:9], top_png)
                   if os.path.exists(top_png) else None)
        if top_mat is None:
            log("  SEM vista de cima para %s — rode bake_impostors.py de novo,"
                " senao a copa continua sendo um X" % spec)
        for c in range(meta["cols"]):
            png = os.path.join(veg.IMPOSTORS, "%s_%d.png" % (spec, c))
            if not os.path.exists(png):
                continue
            m = veg.card_material("PLANT_%s_%d" % (spec[:9], c), png)
            target.append(veg.make_card_plant(
                "card_%s_%d" % (spec[:9], c), m, top_mat,
                meta["card_w"], meta["card_h"], meta["base"],
                top_w=meta.get("top_w", 0.0), crown=meta.get("crown", 0.65),
                height=meta.get("height", 0.0),
                # 5 laminas, nao 3. Sozinhas elas nunca fecham a copa (ver
                # make_card_plant: de cima uma lamina vertical e uma reta) — quem
                # fecha e o cartao de copa. Cinco continuam valendo pelo giro da
                # silhueta lateral, que e onde a camera do estudio olha.
                blades=5 if target is trees else 3, seed=c * 17))

    if not trees:
        log("  impostors ausentes — usando arvores geradas (rode bake_impostors.py)")
        bark = mat("TREE_BARK", (0.20, 0.16, 0.13, 1), 0.92)
        leaf = mat("TREE_LEAF", (0.19, 0.26, 0.11, 1), 0.88)
        trees = [veg.make_tree("tree_%d" % i, 100 + i * 37,
                               7.0 + 5.5 * _hash01(i, 3, 61), bark, leaf,
                               lean=i * 1.1) for i in range(6)]
        bushes = [veg.make_bush("bush_%d" % i, 200 + i * 53,
                                1.7 + 0.9 * _hash01(i, 9, 71), leaf)
                  for i in range(4)]
    if not bushes:
        bushes = trees
    log("  plantas: %d arvores, %d arbustos (impostores)" % (len(trees), len(bushes)))
    for t in trees + bushes:
        t.location = (0, 0, -500.0)          # the prototypes park underground

    n_tree = n_bush = 0

    def put(proto, x, y, tag, scale=1.0, on_grass=True):
        d = clone(proto, tag)
        d.rotation_mode = "XYZ"
        d.rotation_euler = (0.0, 0.0, _hash01(int(x), int(y), 17) * 6.283)
        s = scale * (0.82 + 0.36 * _hash01(int(y), int(x), 29))
        d.scale = (s, s, s)
        # 3 cm, not 10. The 10 cm sink existed to stop a SOLID blob showing
        # daylight under itself on undulating ground. An impostor card already
        # has its foot on its own origin (bake_impostors writes the `base`
        # fraction for exactly that), so sinking it again just buries the trunk.
        d.location = (x, y, (grass_z(x, y) if on_grass else surface_z(x, y)) - 0.03)
        return d

    # ---- the median: MOWN GRASS near the truck, an avenue further out -----
    #
    # NOTHING IS PLANTED WITHIN 78 m. The first version filled the near median
    # with scrub and the close-up render settled it: a generated bush is a
    # convincing mass at 60 m and a faceted lump at 10 m, and the near median is
    # the one piece of planting the studio camera can get close to. Mown grass
    # renders perfectly at any distance and is also what a real junction verge
    # looks like — sight lines are kept clear for the same reason the camera
    # needs them clear.
    # A ALAMEDA VIVE NO CANTEIRO, LOGO TEM OS LIMITES DELE.
    #
    # Ela corria de y=-300 a y=+300 de quando o canteiro corria os 1180 m. Com o
    # canteiro entre ROAD_Y0 e ROAD_Y1, tudo fora disso ficava plantado em chao
    # nu — e o render f_gate mostrou o resultado exacto: uma arvore de 9 m de pe
    # NO MEIO DO ASFALTO DA RODOVIA, e outra sobre a pista interna. `surface_z`
    # devolve uma cota para qualquer (x, y), entao nada nesta funcao tinha como
    # perceber que ali ja nao havia canteiro por baixo.
    #
    # A folga de 14 m nas duas pontas nao e decorativa: ao sul e o leque do
    # balao, ao norte e a linha de visao de quem espera para entrar na rodovia.
    # Arvore em nariz de canteiro de entroncamento tapa exactamente o que o
    # condutor precisa de ver, que e a mesma razao por que a alameda ja se
    # afastava 78 m do cruzamento junto ao caminhao.
    med_x = (ROAD_A_X - _EDGE + ROAD_B_X + _EDGE) / 2.0
    MED_TREE_EDGE = 14.0
    # A ALAMEDA ABRE NA PORTARIA, e a folga sai de onde a guarita ESTA, nao de um
    # numero escrito aqui.
    #
    # A guarita mora no canteiro, entre as duas pistas, e a alameda corre por
    # cima dela: as duas arvores mais proximas nasciam praticamente na porta,
    # tapando a cabine e a cancela — que e o unico ponto do cenario onde alguem
    # tem mesmo de ver. Uma portaria e o oposto de um sitio arborizado; a
    # visibilidade e a funcao dela.
    #
    # A posicao vem da cena porque quem a decide e o `layout.json` do editor: se
    # a guarita for arrastada, a clareira anda com ela. 16 m e o raio que tira as
    # duas vizinhas imediatas (a alameda tem passo de 10 a 14 m) e devolve a
    # fiada logo a seguir.
    BOOTH_CLEAR = 16.0
    booths = [o.matrix_world.translation.copy() for o in bpy.data.objects
              if o.type == "MESH" and is_booth(o)]
    if booths:
        log("  alameda: clareira de %.0f m em torno de %d guarita(s)"
            % (BOOTH_CLEAR, len(booths)))

    def near_booth(x, y):
        return any(math.hypot(x - b.x, y - b.y) < BOOTH_CLEAR for b in booths)

    y = ROAD_Y0 + MED_TREE_EDGE
    i = 0
    # O TECTO E O FIM DO CANTEIRO, NAO O FIM DA PISTA, e a diferenca sao os 22 m
    # de garganta: com o limite em ROAD_Y1 as ultimas arvores caiam entre o
    # nariz do canteiro e a rodovia, isto e em cima do asfalto da garganta. Uma
    # delas aparece de pe no meio do entroncamento em v_rodovia.png.
    while y < ROAD_Y1 - MEDIAN_THROAT - MED_TREE_EDGE:
        i += 1
        jx = med_x + (_hash01(int(y), 1, 83) - 0.5) * (MEDIAN_W - 4.0)
        if abs(y) < 78.0:
            y += 12.0
            continue
        if near_booth(jx, y):
            y += 10.0 + 4.0 * _hash01(i, 2, 91)
            continue
        put(trees[i % len(trees)], jx, y, "med_tree_%d" % i, 1.0, on_grass=False)
        n_tree += 1
        y += 10.0 + 4.0 * _hash01(i, 2, 91)

    # ---- a belt inside the wire, which is what the fence is seen through -
    # Trees ON the property line do the job the deleted earth berm was invented
    # for, and do it without drawing a hard ridge against the sky: a broken
    # canopy occludes the ground/HDRI seam in patches instead of framing it.
    # TWO ROWS, STAGGERED, AND MUCH CLOSER TOGETHER. One row on a 12-20 m pitch
    # left daylight between every tree — "as arvores sao muito faltas" — and a
    # gappy single row does not occlude a horizon, which is the belt's actual
    # job. Two staggered rows on a 7-10 m pitch close into a canopy the way a
    # planted screen does, and because every tree is a linked duplicate of one of
    # six meshes, tripling the count costs nodes and no geometry at all.
    # TRES FIADAS, NAO DUAS, e passo mais curto. O pedido e "mais densidade de
    # arvores ao redor, na parte interna, onde tem gramado", e a faixa de turfa
    # entre a laje e o arame tem 17 a 41 m de largura conforme o lado — cabem
    # tres fiadas com folga. A terceira entra ATRAS das outras duas (mais perto
    # do arame) para o cinturao ganhar profundidade em vez de so ficar mais
    # cheio: uma cortina de duas fiadas le como sebe, de tres le como mata.
    #
    # O CUSTO CONTINUA A SER ZERO EM GEOMETRIA. Cada arvore e uma duplicata
    # ligada de uma de seis malhas e sai instanciada por EXT_mesh_gpu_instancing,
    # entao passar de 259 para ~430 plantas acrescenta nos e matrizes, nao
    # vertices — que e a mesma conta que justificou passar de uma fiada para duas.
    # AS FIADAS SAO MEDIDAS CONTRA A FAIXA DE TURFA DE CADA LADO, e nao contra a
    # cerca — e este era o lado SUL careca.
    #
    # As tres fiadas estavam em cotas fixas (139, 130 e 120 m do centro), o que
    # supunha uma faixa de turfa igual nos quatro lados. Ela nao e: a laje acaba
    # em y=+103 ao norte e em y=-133 ao SUL, entao ao sul a turfa tem 17 m
    # enquanto os outros lados tem 41 a 47. As fiadas de 130 e de 120 caiam
    # inteiras EM CIMA DA LAJE, `plantable` recusava-as, e da terceira fiada
    # sobrava metade — uma so, e furada. Vista do estudio isso e exactamente o
    # trecho de fundo por tras do balao, que e para onde a camera olha por cima
    # do implemento: "nessa area deve ter arvores, nessa parte de grama".
    #
    # Agora cada lado le a PROPRIA faixa: do bordo da laje (mais 3 m, que e a
    # folga da copa contra o betao) ate 4 m aquem do arame. O cinturao continua
    # a ser uma cortina e nao um bosque porque a faixa usada e limitada a 30 m —
    # os lados largos mantem as fiadas juntas, perto do arame, que e onde elas
    # ocluem o horizonte; o lado sul usa os 10 m que tem e ganha as tres.
    BELT_ROWS = 3
    BELT_DEPTH = 30.0        # quanto da faixa o cinturao ocupa, no maximo
    _band_inner = (YARD_Y1, -YARD_Y0, YARD_X1, -YARD_X0)

    def belt_row(side, row):
        b1 = YARD_HALF - 4.0
        b0 = max(_band_inner[side] + 3.0, b1 - BELT_DEPTH)
        w = (b1 - b0) / float(BELT_ROWS)
        return b1 - (row + 0.5) * w, w

    step = 5.6
    k = 0
    for row, phase in enumerate((0.0, step * 0.5, step * 0.25)):
        for side in range(4):
            ring, band_w = belt_row(side, row)
            t = -ring + phase
            while t < ring:
                k += 1
                jitter = (_hash01(int(t), side * 7 + row, 131) - 0.5) * 7.0
                # O DESVIO EM PROFUNDIDADE E O DA PROPRIA FIADA. Eram 7 m fixos:
                # numa faixa de 10 m isso atira metade da fiada para fora dela,
                # ou para cima da laje (recusada) ou para cima do arame.
                depth = ring + (_hash01(side, int(t) + row, 151) - 0.5) * band_w * 0.7
                if side == 0:
                    x, y2 = t + jitter, depth
                elif side == 1:
                    x, y2 = t + jitter, -depth
                elif side == 2:
                    x, y2 = depth, t + jitter
                else:
                    x, y2 = -depth, t + jitter
                t += step + 3.0 * _hash01(k, side, 171)
                # ARVORE SO ONDE HA GRAMA — e a regra e o CHAO, nao a distancia.
                #
                # Isto era `abs(x - ROAD_A_X) < 16`, uma faixa de exclusao em
                # torno das duas pistas. Enquanto a pista atravessava a
                # propriedade de lado a lado o efeito coincidia com o certo; ao
                # tirar a exclusao do lado sul (onde ja nao ha saida) o que
                # apareceu foi arvore de pe NO ASFALTO DO BALAO e no meio do
                # patio — porque nada nesta funcao perguntava o que havia por
                # baixo. `grass_z` devolve uma cota para qualquer (x, y), entao
                # a planta assenta feliz sobre betao.
                #
                # `plantable` pergunta ao proprio chao. Mantem o portao livre
                # como antes, e passa a manter livres tambem o balao, o patio,
                # as vias internas e a rodovia — sem precisar de saber onde eles
                # estao.
                if not plantable(x, y2):
                    continue
                if side == 0 and (abs(x - ROAD_A_X) < 16.0
                                  or abs(x - ROAD_B_X) < 16.0):
                    continue
                put(trees[k % len(trees)], x, y2, "belt_tree_%d" % k, 1.12)
                n_tree += 1
                if _hash01(k, 4, 191) > 0.15:
                    bx = x + 5.0 * (_hash01(k, 6, 211) - 0.5) * 2
                    by = y2 + 5.0 * (_hash01(k, 7, 221) - 0.5) * 2
                    # O ARBUSTO TEM DE SER TESTADO NO SITIO DELE. Ele e deslocado
                    # ate 5 m da arvore, entao herdar o "pode plantar" dela poe
                    # arbusto no asfalto ao lado de uma arvore correcta.
                    if plantable(bx, by, 0.8):
                        put(bushes[k % len(bushes)], bx, by, "belt_bush_%d" % k)
                        n_bush += 1

    # ---- grass patches on the turf band, and weeds at the slab edge ------
    # Irregular discs, never rectangles — see veg.grass_patch for why that is
    # the whole difference between a patch and a decal.
    # DENSER AND OVERLAPPING. 46 isolated discs on a 660 m property read as
    # patches of something ELSE on bare ground rather than as rough grass — the
    # band has to be mostly covered for the gaps to read as the exception. They
    # are seeded on a jittered grid over the turf band rather than by polar
    # rejection, which is what left the first pass' bald quadrants.
    n_patch = 0
    i = 0
    patches = []
    gx = -YARD_HALF + 10.0
    while gx < YARD_HALF - 10.0:
        gy = -YARD_HALF + 10.0
        while gy < YARD_HALF - 10.0:
            i += 1
            x = gx + 16.0 * (_hash01(i, 11, 233) - 0.5)
            y = gy + 16.0 * (_hash01(i, 12, 239) - 0.5)
            gy += 22.0
            if on_paving(x, y):
                continue
            if _hash01(i, 15, 247) < 0.22:
                continue                       # the gaps, kept deliberate
            patches.append((x, y, 7.0 + 11.0 * _hash01(i, 13, 241), 300 + i))
            n_patch += 1
        gx += 22.0

    if patches:
        veg.grass_field("grass_patches", patches, m_grass, grass_z)
    # weeds where the slab meets the turf, which is where they actually grow
    for i in range(110):
        e = _hash01(i, 21, 251)
        if e < 0.5:
            x = YARD_X0 + (YARD_X1 - YARD_X0) * _hash01(i, 22, 257)
            y = (YARD_Y1 + 1.5) if e < 0.25 else (YARD_Y0 - 1.5)
        else:
            y = YARD_Y0 + (YARD_Y1 - YARD_Y0) * _hash01(i, 23, 263)
            x = (YARD_X1 + 1.5) if e < 0.75 else (YARD_X0 - 1.5)
        if not plantable(x, y, 0.4):
            continue
        put(bushes[i % len(bushes)], x, y, "weed_%02d" % i, 0.42)
        n_bush += 1

    # THE PROTOTYPES MUST GO. They were parked at z=-500 to keep them out of
    # shot, which is not the same as keeping them out of the FILE: left linked
    # to the collection they export as six trees and four bushes buried half a
    # kilometre under the yard. Removing the OBJECT is safe — the clones hold
    # the mesh datablock alive, which is the whole point of a linked duplicate.
    for t in trees + bushes:
        bpy.data.objects.remove(t, do_unlink=True)

    log("  planting: %d trees, %d bushes, %d grass patches"
        % (n_tree, n_bush, n_patch))


def make_mast(name, material, height=9.5):
    """A column light for the road, generated.

    THE POLY HAVEN LAMP WAS THE WRONG LAMP. `street_lamp_02` is an ornamental
    cast-iron lantern — finial, scrolled bracket, glazed housing — and scaled to
    road height it put an 8 m Victorian gas lamp beside a chemical plant. It
    rendered exactly as absurd as that sounds, and it cost 2 598 faces and three
    textures to do it.

    A plant lights its roads with a galvanised mast and a flat floodlight head.
    That is 30 quads, it shares the fence's galvanised material so it adds no
    texture at all, and it is the same hand as everything else generated here —
    which is the homogeneity the brief asks for.
    """
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(material)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    _tube(bm, Vector((0, 0, -0.4)), Vector((0, 0, height * 0.55)), 0.15, 8, 0)
    _tube(bm, Vector((0, 0, height * 0.55)), Vector((0, 0, height)), 0.105, 8, 0)
    # the arm leans out over the carriageway, which is what makes it read as a
    # road light rather than a flagpole
    tip = Vector((1.75, 0, height + 0.42))
    _tube(bm, Vector((0, 0, height - 0.12)), tip, 0.075, 6, 0)
    res = bmesh.ops.create_cube(
        bm, size=1.0,
        matrix=Matrix.Translation(tip + Vector((0.28, 0, -0.06)))
        @ Matrix.Rotation(math.radians(-12), 4, "Y")
        @ Matrix.Diagonal((0.86, 0.42, 0.16, 1.0)))
    for v in res["verts"]:
        for f in v.link_faces:
            f.material_index = 0
    for f in bm.faces:
        for l in f.loops:
            l[uv].uv = (l.vert.co.z * 0.35, l.vert.co.x * 0.35)
    bm.to_mesh(me)
    bm.free()
    return ob


def is_booth(ob):
    """A guarita, seja ela o prototipo ou uma copia do layout.

    E DUAS FAMILIAS DE NOME, e essa e a armadilha que custou uma build inteira.
    `layout_from_file` usa o PROPRIO objeto do pacote na primeira vez que uma
    chave aparece — ele chama-se `DL_booth` — e a partir da segunda clona com
    `"%s_%03d" % (key, n)`, ou seja `booth_040`. Quem filtrar por um dos dois
    encontra exatamente metade das guaritas, e a segunda (que existe justamente
    porque foi duplicada) fica sem cancela e com arvore em cima.
    """
    return ob.name.startswith("DL_booth") or ob.name.startswith("booth_")


def build_gate_booms():
    """A CANCELA DE CADA GUARITA, gerada — e a do rip nao serve.

    O PROBLEMA MEDIDO. A guarita e uma peca inteira do pacote `ibp`, cancela
    incluida, e a cancela dela tem 3,78 m: nasce no x local 0,4 e morre em 3,42,
    o que em mundo (escala 1,25) a faz parar em x = -4,84. A borda da pista A
    esta em -3,25. Ou seja: a cancela do modelo nao chega a pista — fecha um
    metro e meio de canteiro e para no ar. E o "a barra esta muito pequena", e
    nao e questao de gosto, e de nao alcancar aquilo que existe para fechar.

    POR QUE GERAR EM VEZ DE ESTICAR. Esticar a casca do rip por 3x esticaria
    junto a UV dela, e a UV e onde moram as faixas vermelhas e brancas: uma
    cancela de 12 m com quatro faixas de 3 m le como um poste pintado, nao como
    uma cancela. Gerada, a faixa e GEOMETRIA — um bloco por faixa, 0,9 m cada —
    e o comprimento deixa de ter relacao com a textura. E a mesma decisao (e o
    mesmo tipo de peca) de `make_mast`, `build_fence` e `build_gates`.

    ONDE ELA ACABA. Na borda DE LA da pista, e nao no eixo. A primeira versao
    parava no eixo por um argumento de transito (uma cancela por faixa) e o
    veredicto foi imediato e correto: "nao cobrem nem metade da rua". Numa
    portaria de planta a cancela fecha a PISTA, porque o que ela controla e a
    entrada e nao a faixa — e uma barra que morre no meio do asfalto le como
    barra partida. Sao 13,6 m de vao, longos para uma cancela de rua e certos
    para uma de 13 m de pista, que e a que existe aqui.

    O PIVO SAI DA CAIXA DA PROPRIA GUARITA, e nao de um afastamento escrito. Com
    as duas cabines lado a lado no canteiro sobra menos de um metro entre elas e
    o bordo, e um pivo posicionado por numero fixo ora ficava dentro da cabine
    ora dentro da pista. Medida a caixa depois de tirar o braco do rip, o pivo
    fica 55 cm alem da face externa: o contrapeso (50 cm) cabe entre ele e a
    parede, e a barra nasce onde a barra nasce em obra — encostada a guarita, do
    lado de fora.

    O SENTIDO SAI DA ROTACAO DA GUARITA, nao de uma tabela: a guarita 1 esta a
    0 graus e olha para leste (pista A), a 2 esta a 180 e olha para oeste (pista
    B). Espelhar a guarita no `layout.json` espelha a cancela junto, que e o que
    "duplique e espelhe" tem de significar para as duas metades baterem.
    """
    booths = [o for o in bpy.data.objects if o.type == "MESH" and is_booth(o)]
    if not booths:
        return 0

    # ---- 1. fora a cancela do rip -----------------------------------------
    #
    # A malha e PARTILHADA pelas duas guaritas (duplicata ligada), entao isto
    # corre uma vez e vale para as duas. O corte e em x local > 0,5: a cabine
    # inteira — telhado, guarda-corpo, degrau — acaba em 0,35, e tudo o que
    # existe alem disso e o braco e o contrapeso dele. Medido casca a casca.
    me = booths[0].data
    bm = bmesh.new()
    bm.from_mesh(me)
    old = [f for f in bm.faces if f.calc_center_median().x > 0.5]
    if old:
        bmesh.ops.delete(bm, geom=old, context="FACES")
        bm.to_mesh(me)
        me.update()
    bm.free()

    # ---- 2. a cancela gerada ----------------------------------------------
    red = mat("GATE_BOOM_RED", (0.38, 0.03, 0.03, 1.0), 0.45)
    white = mat("GATE_BOOM_WHITE", (0.80, 0.80, 0.80, 1.0), 0.45)
    STRIPE = 0.90            # uma faixa
    ARM_Z = 1.05             # altura do braco sobre o piso
    ARM_R = 0.075            # meia-espessura
    bms = (bmesh.new(), bmesh.new())
    uvs = [b.loops.layers.uv.new("UVMap") for b in bms]

    def box(bm, uv, x0, x1, y0, y1, z0, z1):
        v = bmesh.ops.create_cube(bm, size=1.0)["verts"]
        for p in v:
            p.co.x = x0 if p.co.x < 0 else x1
            p.co.y = y0 if p.co.y < 0 else y1
            p.co.z = z0 if p.co.z < 0 else z1
        for f in bm.faces:
            for l in f.loops:
                if not l[uv].uv.length:
                    l[uv].uv = (l.vert.co.x * 0.5, l.vert.co.z * 0.5)

    n = 0
    for ob in booths:
        bx, by = ob.matrix_world.translation.x, ob.matrix_world.translation.y
        # +1 = o braco sai para leste (pista A); -1 para oeste (pista B)
        east = math.cos(ob.rotation_euler.z) >= 0.0
        sgn = 1.0 if east else -1.0
        cx = ROAD_A_X if east else ROAD_B_X
        bpy.context.view_layer.update()
        lo, hi = world_bbox(ob)
        pivot = (hi.x if east else lo.x) + sgn * 0.55
        tip = cx + sgn * ROAD_W / 2.0   # a borda de la da pista servida
        span = abs(tip - pivot)
        base = median_z(pivot, by)
        # ---- pivo: coluna + contrapeso ------------------------------------
        box(bms[1], uvs[1], min(pivot, pivot + sgn * 0.22),
            max(pivot, pivot + sgn * 0.22), by - 0.16, by + 0.16,
            base, base + ARM_Z + 0.28)
        box(bms[1], uvs[1], min(pivot - sgn * 0.50, pivot),
            max(pivot - sgn * 0.50, pivot), by - 0.13, by + 0.13,
            base + ARM_Z - 0.14, base + ARM_Z + 0.14)
        # ---- o braco, uma faixa por bloco ---------------------------------
        k = 0
        d = 0.0
        while d < span - 0.05:
            seg = min(STRIPE, span - d)
            a = pivot + sgn * d
            b = pivot + sgn * (d + seg)
            # o braco AFINA para a ponta, como um braco real: o momento cai
            r = ARM_R * (1.0 - 0.35 * (d / max(span, 1e-6)))
            box(bms[k % 2], uvs[k % 2], min(a, b), max(a, b),
                by - r, by + r, base + ARM_Z - r, base + ARM_Z + r)
            d += seg
            k += 1
        n += 1
        log("  cancela: guarita em (%.1f, %.1f) fecha %.1f m ate o eixo da pista"
            % (bx, by, span))

    for bm, m, nm in ((bms[0], red, "gate_boom_a"), (bms[1], white, "gate_boom_b")):
        mesh = bpy.data.meshes.new(nm)
        o = bpy.data.objects.new(nm, mesh)
        bpy.context.collection.objects.link(o)
        bm.to_mesh(mesh)
        bm.free()
        mesh.materials.append(m)
    return n


def dress(props):
    """Lamps, barriers and yard clutter — the things that say the site is used.

    LAMPS ARE WHY THE MANIFEST SAYS `lamps.enabled: false`: the set brings its
    own column line and the engine's procedural row would double it.
    """
    steel = bpy.data.materials.get("FENCE_POST") or mat("FENCE_POST", (0.55, 0.56, 0.58, 1), 0.5, 0.85)
    mast = make_mast("mast", steel)
    mast.location = (0, 0, -500.0)
    n = 0
    # Down the median, alternating which carriageway each arm reaches over —
    # which is how a single line of columns lights a dual carriageway — and
    # clear of the near field for the same reason the trees are.
    med_x = (ROAD_A_X - _EDGE + ROAD_B_X + _EDGE) / 2.0
    # A FILEIRA ACOMPANHA A PISTA, e nao mais um alcance fixo. Com y = k*34 ate
    # +/-272 havia mastro a 179 m ao sul do fim da via (o balao) e a 44 m ao
    # norte da rodovia: postes de iluminacao viaria plantados no campo, sem via
    # nenhuma por baixo. `MAST_EDGE` deixa o ultimo poste antes da ponta em vez
    # de em cima dela.
    MAST_EDGE = 8.0
    for k in range(-8, 9):
        y = k * 34.0
        if abs(y) < 60.0:
            continue
        if not (ROAD_Y0 + MAST_EDGE <= y <= ROAD_Y1 - MAST_EDGE):
            continue
        d = clone(mast, "mast_m_%d" % k)
        d.rotation_mode = "XYZ"
        d.rotation_euler = (0, 0, math.radians(0 if k % 2 else 180))
        d.location = (med_x, y, YARD_Z - 0.06)
        n += 1
    # and along the east kerb of road A, arms reaching back over it
    # THE NEAR ONES COME OUT. A column stands at the kerb in life, and at the
    # kerb it also stands 8 m from the truck — the first hero render had one
    # bisecting the frame, and on an orbit it would sweep through every shot.
    # Nothing else changes: the line is still a kerb line, it just starts past
    # the rig.
    for k in range(-4, 7):
        y = k * 38.0 + 12.0
        if abs(y) < 60.0:
            continue
        if not (ROAD_Y0 + MAST_EDGE <= y <= ROAD_Y1 - MAST_EDGE):
            continue
        x = ROAD_A_X + _EDGE + 1.1
        d = clone(mast, "mast_e_%d" % k)
        d.rotation_mode = "XYZ"
        d.rotation_euler = (0, 0, math.radians(180))
        d.location = (x, y, yard_z(x, y) - 0.05)
        n += 1
    bpy.data.objects.remove(mast, do_unlink=True)

    barrier = props.get("barrier")
    b = 0
    if barrier:
        # ONLY AT THE GATE. There used to be a second run of nine across open
        # concrete beside the tank farm, and it was the "negocio no chao muito
        # estranho nesse local": a line of decimated Jersey barriers protecting
        # nothing, in the middle of a yard, reading at an angle as some kind of
        # broken staircase lying on the floor. A barrier belongs where a vehicle
        # would otherwise hit something. Beside a tank in open yard, nothing
        # would.
        # ...E "AO PE DO PORTAO" PASSOU A SER O PORTAO DE VERDADE. O y estava
        # fixo em 214,0 de quando a cerca ficava a 250 m; com YARD_HALF em 150 os
        # dez blocos estavam 64 m ALEM do arame, alinhados no meio do campo
        # aberto, a proteger exactamente o mesmo nada que a fiada removida acima
        # protegia. Derivado de YARD_HALF, como a barra de "pare" ja e.
        for k in range(10):
            d = clone(barrier[0], "bar_g_%d" % k)
            x = ROAD_A_X + _EDGE + 1.0
            y = YARD_HALF - 14.0 + k * 1.62
            d.location = (x, y, surface_z(x, y) - 0.04)
            d.rotation_mode = "XYZ"
            d.rotation_euler = (0, 0, math.radians(90))
            b += 1
        bpy.data.objects.remove(barrier[0], do_unlink=True)

    log("  dressing: %d masts, %d barriers at the gate" % (n, b))


# ---------------------------------------------------------------------------
def shrink_images(building_px=1024, prop_px=512):
    """Downscale embedded textures before export.

    The packs ship 2048-4096 px atlases and the exporter embeds them whole.
    Nothing here is seen closer than a few metres and the ground is bound at
    RUNTIME from /textures, so the embedded set only has to survive mid-distance
    viewing. Props get half of what buildings get: a 0.4 m bin does not need the
    same texel budget as a 34 m hall.

    NOT `img.has_data`: glTF/PNG images are lazy, so has_data is False until
    something touches the pixels and the whole loop silently no-ops. `size` is
    read from the header and is available immediately.
    """
    n = 0
    for img in bpy.data.images:
        try:
            w, h = img.size[0], img.size[1]
        except Exception:
            continue
        if w == 0 or h == 0:
            continue
        nm = img.name.lower()
        if "leaf" in nm or "plant" in nm:
            # A FOLHA E A EXCECAO, e o motivo e o RECORTE e nao o detalhe. Este
            # atlas leva 80 silhuetas; a 1024 px cada uma fica com ~110 px e o
            # corte de alfa passa a acontecer numa borda de dois ou tres pixels —
            # a folha ganha serrilha e as ervas finas desaparecem por completo,
            # porque uma haste de meio pixel nao sobrevive ao mipmap. E tambem a
            # textura mais vista da cena: sao 450 plantas.
            cap = 2048
        else:
            cap = prop_px if any(k in nm for k in
                                 ("lamp", "barrier", "utility", "crate",
                                  "container", "wire", "posts", "d3_",
                                  "device23")) else building_px
        m = max(w, h)
        if m <= cap:
            continue
        s = cap / float(m)
        try:
            img.scale(max(1, int(w * s)), max(1, int(h * s)))
            n += 1
        except Exception as e:
            log("    could not scale %s (%dx%d): %s" % (img.name[:30], w, h, e))
    log("  shrank %d textures" % n)


def audit_placement():
    """Measure every placed object against the ground it stands on.

    WHY THIS EXISTS. The layout audit checks footprints against each other and
    against the camera, and it passed clean while the app was showing floating
    props, half-buried props and a row of containers z-fighting through each
    other. None of those are footprint problems, so nothing was looking for
    them. "Tem muitos items flutuando e ate com a textura quebrada" is a report
    about the THIRD dimension, and this is the pass that measures it.

    Four things get reported, all in metres:

      FLOAT   the object's lowest point is above the ground under it
      SUNK    it is far enough below to bury a door or a wheel
      STACK   two pieces sharing a mesh overlap in plan — which is what
              "textura piscando" is: not a texture bug at all, but two identical
              surfaces fighting for the same depth
      TALL    it breaks the graduated height rule (see below)

    THE HEIGHT RULE. "Denso proximo ao caminhao, mas com cuidado para nao ser
    construcoes muito altas que atrapalhem a camera" is a ratio, not a radius:
    what blocks an orbit is ANGLE. A single TALL_SETBACK number cannot express
    it — it either lets a 24 m stack stand at 46 m or pushes a 9 m shed out to
    60 for no reason. The rule here is height <= distance / 5, so 30 m buys a
    6 m shed, 60 m buys 12 m, and the 24 m stacks have to stand back at 120.
    That is what produces a skyline that opens away from the truck.
    """
    # FLUSH THE DEPSGRAPH FIRST. `world_bbox` reads `obj.matrix_world`, which is
    # a CACHE: assigning `.location` marks it dirty but does not recompute it.
    # Without this line every clone reports the prototype's matrix, i.e. the
    # origin — the first run of this audit duly announced that all 21 concrete
    # barriers were stacked on top of each other and that ten buildings were
    # standing on the truck. Both were the audit's own bug, and an audit that
    # invents faults is worse than no audit, because the fixes are real.
    bpy.context.view_layer.update()
    # PLANT_BARK/PLANT_LEAF ENTRARAM AQUI, e a ausencia deles era uma auditoria
    # a gritar lobo 212 vezes por build.
    #
    # A lista sempre dispensou a vegetacao — `TREE_BARK`/`TREE_LEAF` estao ca
    # desde o inicio. So que as arvores geradas foram substituidas pelas do pack
    # e os materiais passaram a chamar-se PLANT_*, o que reinscreveu 555 plantas
    # numa auditoria que mede a BASE DA CAIXA ENVOLVENTE contra o terreno. A
    # caixa de uma arvore comeca na ponta da raiz — tree_pk_1 desce a -1,28 m —,
    # entao toda arvore correctamente plantada era reportada SUNK, e as tres
    # linhas TALL que importam ficavam enterradas em 212 linhas que nao.
    # Enterrar a raiz E o comportamento certo; ver protos_cache.PLANT_SINK.
    ground = {"GROUND_CONCRETE", "ASPHALT_ROAD", "CONCRETE_APRON", "KERB_CONCRETE",
              "LINE_PAINT", "GRASS_VERGE", "GRASS_NEAR", "GRAVEL_SHOULDER",
              "TREE_BARK", "TREE_LEAF", "PLANT_BARK", "PLANT_LEAF",
              "FENCE_WIRE", "FENCE_POST"}
    rows = []
    for o in bpy.data.objects:
        if o.type != "MESH" or not o.data or not o.data.polygons:
            continue
        mats = {m.name for m in o.data.materials if m}
        if mats and mats <= ground:
            continue
        lo, hi = world_bbox(o)
        cx, cy = (lo.x + hi.x) / 2.0, (lo.y + hi.y) / 2.0
        gz = surface_z(cx, cy)
        rows.append((o, lo, hi, gz))

    n_float = n_sunk = n_tall = n_stack = 0
    for o, lo, hi, gz in rows:
        gap = lo.z - gz
        h = hi.z - lo.z
        if gap > 0.18:
            log("  FLOAT    %-20s %.2f m above the ground at (%.0f, %.0f)"
                % (o.name[:20], gap, (lo.x + hi.x) / 2, (lo.y + hi.y) / 2))
            n_float += 1
        # -0.75, not -0.45. ibc1.import_prototypes deliberately KEEPS the
        # author's Z rather than dropping each model's bbox to zero, because
        # half the pack has feed pipes and foundations below its floor line
        # (measured mins of 0.0, -0.0, -0.4, -0.6). Flagging those is flagging
        # the correct behaviour.
        # An impostor card's box is the SHEET, and the sheet carries a
        # transparent border below the plant's foot by construction. Measuring a
        # card's bbox against the ground measures the border, not the plant.
        elif gap < -0.75 and not o.data.name.startswith("card_"):
            log("  SUNK     %-20s %.2f m into the ground at (%.0f, %.0f)"
                % (o.name[:20], gap, (lo.x + hi.x) / 2, (lo.y + hi.y) / 2))
            n_sunk += 1
        dx = max(lo.x, 0.0, -hi.x)
        dy = max(lo.y, 0.0, -hi.y)
        near = math.hypot(dx, dy)
        # THE RULE ONLY BITES INSIDE 80 m, and that is not a softening — it is
        # what the geometry actually says. The orbit tops out around 31 m, so
        # what can block it is what is CLOSE; a 37 m drum rack at 124 m subtends
        # 17 degrees of background and obstructs nothing. Applying the ratio all
        # the way out demanded 187 m for that rack, which is past the fence, and
        # chasing it is what spread the plant into a field in the first place.
        if h > 3.0 and near < 80.0 and h > near / 5.0:
            log("  TALL     %-20s %.1f m tall at only %.0f m (allowed %.1f)"
                % (o.name[:20], h, near, near / 5.0))
            n_tall += 1

    # STACK: same mesh datablock, overlapping in plan. Two clones of one
    # container at a 2.5 m pitch when the container is 6.1 m long is not a
    # texture bug, it is 3.6 m of coplanar steel.
    by_mesh = {}
    for o, lo, hi, _gz in rows:
        by_mesh.setdefault(o.data.name, []).append((o, lo, hi))
    for nm, group in by_mesh.items():
        for i in range(len(group)):
            oi, loi, hii = group[i]
            for j in range(i + 1, len(group)):
                oj, loj, hij = group[j]
                ox = min(hii.x, hij.x) - max(loi.x, loj.x)
                oy = min(hii.y, hij.y) - max(loi.y, loj.y)
                oz = min(hii.z, hij.z) - max(loi.z, loj.z)
                if ox > 0.3 and oy > 0.3 and oz > 0.3:
                    log("  STACK    %-16s x %-16s overlap %.1f x %.1f x %.1f m"
                        % (oi.name[:16], oj.name[:16], ox, oy, oz))
                    n_stack += 1
    log("  placement: %d float, %d sunk, %d too tall, %d interpenetrating (%d pieces)"
        % (n_float, n_sunk, n_tall, n_stack, len(rows)))


def group_instances():
    """Parent the planting's linked duplicates to one empty per mesh, so the
    exporter can actually emit EXT_mesh_gpu_instancing.

    IT WAS NOT EMITTING. The export log said "exported with
    EXT_mesh_gpu_instancing" and that line only ever proved the KWARG was
    accepted — not that a single instance was written. Read back off the shipped
    file, `extensionsUsed` was `['EXT_texture_webp']` and nothing else: 1 057
    nodes referencing 80 meshes, i.e. the file was small (the mesh data really is
    shared) but the runtime had 1 057 draw calls to make. Blender only writes the
    extension for objects that share mesh data AND hang off a COMMON PARENT, and
    linked duplicates created with `.copy()` have no parent at all.

    ONLY THE PLANTING, AND THAT IS THE WHOLE SUBTLETY. three.js reads the
    extension into an InstancedMesh, and set.ts collectSolids deliberately SKIPS
    InstancedMesh when it gathers camera obstacles — "grama nao e obstaculo".
    Instancing the thirteen duplicated sheds would therefore be a silent
    regression: the camera would stop dodging them and start flying through
    them. So this groups tree and bush meshes and leaves every building alone.
    """
    groups = {}
    for o in bpy.data.objects:
        if o.type != "MESH" or not o.data or o.parent is not None:
            continue
        nm = o.data.name
        if not (nm.startswith("tree_") or nm.startswith("bush_")
                or nm.startswith("card_")):
            continue
        groups.setdefault(nm, []).append(o)
    n = inst = 0
    for nm, objs in sorted(groups.items()):
        if len(objs) < 2:
            continue
        e = bpy.data.objects.new("inst_" + nm, None)
        bpy.context.collection.objects.link(e)
        for o in objs:
            o.parent = e
            # The empty is at the origin with an identity matrix, so the child's
            # local transform IS its world transform and nothing moves. Setting
            # the inverse explicitly rather than relying on the operator keeps
            # that true regardless of context.
            o.matrix_parent_inverse = Matrix.Identity(4)
        n += 1
        inst += len(objs)
    log("  instancing: %d groups covering %d objects" % (n, inst))


def export():
    os.makedirs(OUT_DIR, exist_ok=True)
    for o in bpy.data.objects:
        o.select_set(True)
    kw = dict(
        filepath=OUT,
        export_format="GLB",
        # export_apply=True evaluates the depsgraph PER OBJECT, so every linked
        # duplicate gets its own mesh copy and glTF instancing is lost. The
        # decimation the importers do is applied destructively for this reason.
        export_apply=False,
        # DRACO IS OFF, and it is the vertex-colour ground that turns it off.
        # Blender's Draco encoder fails that primitive outright ("Failed to
        # encode point attributes") and the failure is FATAL — the exporter
        # aborts and leaves the previous set.glb in place, i.e. a silent no-op
        # build if you only watch the log for a traceback.
        export_draco_mesh_compression_enable=False,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        # THE GROUND VARIATION AND THE WORN PAINT LIVE OR DIE ON THIS LINE.
        #
        # The exporter's default is export_vertex_color='MATERIAL', which emits
        # real COLOR_0 only for meshes whose MATERIAL actually reads a Color
        # Attribute node. Our ground materials are bare named slots on purpose —
        # the engine binds their maps at runtime — so not one of them reads
        # vertex colour in Blender, and the exporter dutifully wrote an all-white
        # placeholder instead of the field the build had just computed. Every
        # vertex in every shipped set.glb was (1,1,1).
        #
        # 'ACTIVE' exports the mesh's active colour attribute regardless of what
        # the material does with it, which is exactly the contract we want.
        export_vertex_color="ACTIVE",
    )
    # GPU instancing, if this Blender has it. The planting is ~200 linked
    # duplicates of six tree meshes; as plain nodes that is 200 draw calls, as
    # EXT_mesh_gpu_instancing it is six. three.js reads the extension into an
    # InstancedMesh, and set.ts collectSolids already skips InstancedMesh when
    # it collects camera obstacles ("grama nao e obstaculo"), so this is a path
    # the engine was already written for. Optional because the kwarg's name has
    # moved between releases; without it the scene is identical and heavier.
    try:
        bpy.ops.export_scene.gltf(export_image_format="WEBP",
                                  export_image_quality=82,
                                  export_gpu_instances=True, **kw)
        log("  exported with EXT_mesh_gpu_instancing")
    except TypeError:
        try:
            bpy.ops.export_scene.gltf(export_image_format="WEBP",
                                      export_image_quality=82, **kw)
            log("  exported without GPU instancing (kwarg rejected)")
        except TypeError as e:
            log("  export kwargs rejected (%s); retrying bare" % e)
            kw.pop("export_vertex_color", None)
            bpy.ops.export_scene.gltf(**kw)
    mb = os.path.getsize(OUT) / 1048576.0
    tris = 0
    for o in bpy.data.objects:
        if o.type == "MESH" and o.data:
            tris += len(o.data.polygons)
    log("wrote %s  (%.1f MB, %d objects, %d faces)"
        % (OUT, mb, len(bpy.data.objects), tris))


def patch_glb_alpha(path, cutoff=0.38):
    """Forca alphaMode=MASK nos materiais recortados, DEPOIS da exportacao.

    POR QUE O ARQUIVO E CORRIGIDO EM VEZ DO MATERIAL. Este build define
    `blend_method = 'CLIP'` e `alpha_threshold` nos materiais de folhagem e da
    tela do alambrado, com um comentario explicando que recorte e obrigatorio.
    Medido no .glb exportado, TODOS sairam assim:

        PLANT_jacaranda_0   alphaMode BLEND   alphaCutoff ausente
        FENCE_WIRE          alphaMode BLEND   alphaCutoff ausente

    O exportador nao leu `blend_method` — a propriedade mudou de nome e de
    semantica entre versoes do Blender (o mesmo tipo de instabilidade que este
    arquivo ja contorna em tres outros lugares probando enums).

    A CONSEQUENCIA NAO E COSMETICA. BLEND faz o GLTFLoader ligar `transparent` e
    DESLIGAR `depthWrite`. Com ~450 cartoes cruzados que se sobrepoem por
    construcao, nao existe ordem de desenho correta: as copas se atravessam, os
    retangulos dos cartoes aparecem, e arvores somem atras de arvores. E o
    relato "as arvores continuam completamente quebradas".

    MASK e recorte por pixel: independente de ordem, sem sorting, e o alambrado
    volta a funcionar contra si mesmo. Corrigir o ARQUIVO em vez do material e
    deliberado — o que importa e o que o three.js recebe, e afirmar a saida
    sobrevive a proxima mudanca de API do exportador.
    """
    with open(path, "rb") as f:
        data = bytearray(f.read())
    magic, ver, total = struct.unpack_from("<III", data, 0)
    jl, jt = struct.unpack_from("<II", data, 12)
    doc = json.loads(bytes(data[20:20 + jl]).decode("utf-8"))
    hit = []
    for m in doc.get("materials", []):
        n = m.get("name", "")
        if n.startswith("PLANT_") or n == "FENCE_WIRE":
            m["alphaMode"] = "MASK"
            m["alphaCutoff"] = cutoff
            m["doubleSided"] = True
            hit.append(n)
    if not hit:
        log("  alpha: nenhum material de recorte encontrado")
        return
    blob = json.dumps(doc, separators=(",", ":")).encode("utf-8")
    blob += b" " * ((4 - len(blob) % 4) % 4)          # chunks alinhados em 4
    rest = bytes(data[20 + jl:])
    out = bytearray()
    out += struct.pack("<III", magic, ver, 12 + 8 + len(blob) + len(rest))
    out += struct.pack("<II", len(blob), jt)
    out += blob
    out += rest
    with open(path, "wb") as f:
        f.write(out)
    # LE DE VOLTA. Reescrever o cabecalho e exatamente o tipo de coisa que falha
    # em silencio, e um .glb corrompido so aparece no app.
    with open(path, "rb") as f:
        chk = f.read()
    m2, v2, t2 = struct.unpack_from("<III", chk, 0)
    j2, _ = struct.unpack_from("<II", chk, 12)
    d2 = json.loads(chk[20:20 + j2].decode("utf-8"))
    bad = [x.get("name") for x in d2.get("materials", [])
           if (x.get("name", "").startswith("PLANT_") or x.get("name") == "FENCE_WIRE")
           and x.get("alphaMode") != "MASK"]
    log("  alpha: %d materiais -> MASK cutoff %.2f | glb %s, %d bytes%s"
        % (len(hit), cutoff,
           "valido" if (m2 == magic and t2 == len(chk)) else "CORROMPIDO",
           len(chk), "" if not bad else "  FALHOU em %s" % bad))


# ---------------------------------------------------------------------------
# O QUE A REDE DE DECALQUES NAO APANHA — peca a peca, depois de vista.
#
# `audit_decals` exige que a caixa 2D da face pequena esteja INTEIRA dentro da
# caixa da face grande (o `sx0 > bx0 - 0.01 and sx1 < bx1 + 0.01 ...` de
# `_pass`). Uma peca assente EM CIMA DA EMENDA entre dois paineis de parede
# coplanares nao esta contida em nenhum dos dois: as duas comparacoes sao
# rejeitadas, a peca passa a rede inteira, e o ficheiro sai com folga zero.
#
# MEDIDO, e e o caso que originou esta tabela — a porta do 2o andar do MC_02,
# relatada como "piscando" num print do app:
#
#   porta   1,215 x 2,468 m, base em z 3,627 (o nivel do passadico)
#           plano y = -2,159 local, x de -0,658 a  0,557
#   parede  chega ali em DOIS paineis, com a emenda em x = -0,499 local
#           (11,55 m2 a oeste dela, 12,81 m2 a leste)
#
# A porta atravessa a emenda, logo nao cabe em nenhum dos dois paineis, e
# `audit_decals -- --prefix=MC_` imprimia "TOTAL: 0 faces em disputa" com ela a
# 0,07 mm da parede.
#
# ISSO CORRIGE TAMBEM A NOTA DE audit_decals.py:62, que e o unico facto citado
# para justificar CLEAR = 50 mm: ela diz que esta porta "ficou a 18,4 mm e
# CONTINUOU a cintilar". Nao continuou por causa do limiar — aquela funcao nunca
# chegou a move-la.
#
# A TABELA E EM COORDENADAS LOCAIS DA PECA, de proposito: o prototipo e
# recentrado na propria pegada com o piso em z=0 (ver `place`), entao mover a
# peca no layout.json ou roda-la nao invalida a entrada. E cada linha declara o
# que espera encontrar; quando nao encontra, a build GRITA, em vez de exportar
# em silencio um cenario que voltou a cintilar.
#
# QUANDO ESTE BLOCO TEM DE SAIR: se `audit_decals` passar a testar sobreposicao
# de area em vez de contencao em caixa, ele apanha esta porta sozinho e a
# entrada aqui empurra-a uma segunda vez. Nesse dia, apagar a linha.
LIFT_BY_HAND = [
    dict(piece="MC_02", note="porta do 2o andar, sobre o passadico",
         local=(-0.050, -2.159, 4.856), radius=1.0, normal=(0.0, 1.0, 0.0),
         max_area=4.0, push=0.050, faces=2, area=3.00),
]


def lift_by_hand():
    """Afasta da parede as pecas listadas em LIFT_BY_HAND, e SO essas."""
    for e in LIFT_BY_HAND:
        obs = [o for o in bpy.data.objects
               if o.type == "MESH" and o.data and o.data.polygons
               and (o.name == e["piece"]
                    or o.name.startswith(e["piece"] + "."))]
        if not obs:
            log("  LIFT FALHOU: nao ha peca %s na cena" % e["piece"])
            continue
        n = Vector(e["normal"]).normalized()
        p = Vector(e["local"])
        for ob in obs:
            me = ob.data
            hit = [f.index for f in me.polygons
                   if f.area <= e["max_area"]
                   and abs(f.normal.dot(n)) > 0.999
                   and (f.center - p).length <= e["radius"]]
            got = sum(me.polygons[i].area for i in hit)
            if len(hit) != e["faces"] or abs(got - e["area"]) > 0.1 * e["area"]:
                log("  LIFT FALHOU em %s (%s): esperava %d faces / %.2f m2, "
                    "achou %d / %.2f m2 — a peca mudou, reveja a entrada"
                    % (ob.name, e["note"], e["faces"], e["area"],
                       len(hit), got))
                continue
            # CORTAR PRIMEIRO, MOVER DEPOIS, que e a ordem de
            # `lift_welded_decals`: se um vertice for partilhado com a parede,
            # mover sem cortar arrasta a parede junto.
            #
            # E O SENTIDO VEM DA TABELA, NAO DE `f.normal`. Nestes ripes o
            # enrolamento da face e arbitrario, e metade das vezes a normal
            # aponta para dentro — ai o empurrao ENTERRA a porta, e o defeito
            # deixa de ser "cintila" para ser "desapareceu", que e pior porque
            # nao se ve. `normal` acima e a direcao para FORA, medida.
            bm = bmesh.new()
            bm.from_mesh(me)
            bm.faces.ensure_lookup_table()
            fs = [bm.faces[i] for i in hit]
            bmesh.ops.split_edges(
                bm, edges=list({ed for f in fs for ed in f.edges}))
            d = n * e["push"]
            for f in fs:
                for v in f.verts:
                    v.co += d
            bm.to_mesh(me)
            me.update()
            bm.free()
            log("  %s: %s — %d faces (%.2f m2) afastadas %.0f mm"
                % (ob.name, e["note"], len(hit), got, e["push"] * 1000.0))


def main():
    clear_scene()
    ibc1 = _load("ibc1")
    dl_packs = _load("dl_packs")
    props_ph = _load("props_ph")

    log("prototypes")
    ibc = ibc1.import_prototypes(log)
    thin_prototypes(ibc)
    dl = dl_packs.import_prototypes(log)
    props = props_ph.import_props(log)

    log("layout")
    layout(ibc, dl)

    log("ground")
    m_near = build_ground()

    log("perimeter")
    build_fence(bpy.data.materials["KERB_CONCRETE"])

    log("planting")
    plant(m_near)
    dress(props)
    # DEPOIS de `layout`, porque ela le a posicao e a rotacao das guaritas que
    # o layout.json pos na cena — e ANTES da separacao de decalques, para que a
    # cancela gerada passe pela mesma rede que todo o resto.
    build_gate_booms()

    log("placement audit")
    audit_placement()

    log("separacao de decalques")
    # A ULTIMA REDE CONTRA O CINTILAR, e ela corre AQUI e nao num passo a mao.
    #
    # `separate_coplanar` trata o prototipo no import e apanha a maioria; o que
    # sobra sao os pares que so existem depois de tudo montado, e os que a
    # propria separacao descobre ao afastar a peca de cima. Medido nesta cena:
    # 200 -> 98 -> 38 -> 1 -> 0. Corrigir isto sobre o .glb, depois, funcionava
    # exatamente ate a build seguinte reescrever o ficheiro.
    try:
        _dec = _load("audit_decals")
        # OITO PASSAGENS, e nao quatro. Com a folga-alvo em 50 mm cada
        # afastamento descobre mais do que descobria com 12: a serie medida
        # passou de 200/98/38/1/0 para 626/322/92/57/..., ou seja quatro
        # passagens deixavam 57 faces por tratar. Uma passagem que nao acha nada
        # sai do laco, entao o custo de pedir oito e zero quando quatro chegam.
        _n = _dec.sweep([o for o in bpy.data.objects
                         if o.type == "MESH" and o.data and o.data.polygons],
                        log=lambda m: log("  " + m), rounds=8)
        log("  %d faces coplanares afastadas" % _n)
    except Exception as e:
        log("  audit_decals falhou (%s) — exportando sem" % e)

    # DEPOIS da rede, e nao antes: estas sao exatamente as pecas que ela nao ve,
    # e correr aqui garante que nenhuma passagem dela desfaz o afastamento.
    lift_by_hand()

    log("export")
    group_instances()
    shrink_images()
    export()
    patch_glb_alpha(OUT)
    log("done")


# IMPORTABLE, NOT ONLY RUNNABLE. The map creator's exporter needs to read
# LAYOUT, DUPES and the site constants out of this file without building the
# district first — importing a module should not cost a full export.
if os.environ.get("PARK_NO_BUILD") != "1":
    main()
