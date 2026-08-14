"""Constroi o cenario `serra` — rodovia de pista dupla numa encosta florestada.

    blender -b -P build_serra.py -- [--stage=prep,frame,grade,road,veg,tex,export]

===========================================================================
DE ONDE VEM, E O QUE FOI MEDIDO ANTES DE MEXER
===========================================================================

A fonte e `~/Downloads/DIRT SCENE PACKED TEXTURES.blend` (81 MB, texturas
empacotadas). Medida, ela e UMA cena de floresta FUNDIDA POR MATERIAL: 26
objetos MESH, todos com a MESMA origem (16,09, -1,66, 161,70), um material cada,
281 398 poligonos no total. Nao ha luz, nao ha camera, nao ha instanciamento —
`Background_Tree_Atlas.001` nao e uma arvore, e o objeto que carrega TODOS os
cartoes de folha da cena. Quem quiser mexer numa arvore mexe em ilhas de vertices
dentro de uma malha unica.

  ARVORES.  961 ilhas de `Trunk_Oak` + 177 de `Trunk_Birch`, cada uma com
  exatamente 39 vertices — sao instancias do mesmo tronco, assadas. Altura
  mediana 26,7 m (p90 31,3, max 39,4). Densidade medida no nucleo de 160x160 m:
  175,8 arvores por hectare. Isto e mata fechada de conifera adulta, e e a razao
  pela qual o pedido "afastar as arvores" nao e cosmetico: a 27 m de altura e
  176/ha, qualquer coisa pousada la dentro fica dentro de um poco.

  TERRENO.  Nao e plano e nao e uma rampa. E um planalto a ~174 m no quadrante
  (x 20..90, y -85..-20) que cai ate 106 m no canto oposto. Ajuste de plano da
  19,7% de declive medio (11,15 graus) com descida rumo a 123,9 graus, MAS o
  residuo depois do plano tem desvio padrao de 8,31 m — ou seja o plano explica
  pouco, a encosta e convoluta.

===========================================================================
POR QUE A ESTRADA E TERRAPLENADA, E NAO POUSADA
===========================================================================

Foram tentadas, por esta ordem, as duas alternativas mais baratas. As duas
falharam MEDIDAS, e ficam registadas para ninguem as repetir:

  1. FITA RETA E NIVELADA.  Varridos 8 560 corredores (angulo x posicao), a
     mediana do desvio RMS entre o terreno e a melhor reta de greide ao longo de
     260 m e 9,59 m; so 1 dos 8 560 fica abaixo de 3 m. Nao existe onde pousar
     uma reta nivelada nesta encosta.

  2. TRACADO QUE SEGUE A CURVA DE NIVEL.  Marcha com raio minimo rodoviario
     (300 e 500 m) tentando manter cota. Resultado: greide MEDIANO de 11,5 a
     18,2% e picos de 40 a 54%. A razao e geometrica e nao de afinacao — as
     curvas de nivel desta encosta viram com raio muito abaixo do minimo
     rodoviario, entao a estrada nao consegue virar depressa que chegue para as
     acompanhar e sai a cortar a rampa.

Logo o corredor TEM de ser cortado e aterrado, e isso e a resposta certa e nao
um remendo: e o que uma rodovia de serra e na vida real, e e exatamente a
"fenda mais espacada para entrar a estrada" do pedido. Corte a montante com
face de rocha, aterro a jusante com talude gramado.

===========================================================================
O CORREDOR ESCOLHIDO, E COMO
===========================================================================

Terceira varredura, agora com perfil vertical A SERIO em vez de uma reta:
tangente NIVELADA de +-20 m sob o caminhao (o app estaciona o veiculo na origem
com as rodas em y=0 — um greide ali poe o cavalo torto), depois rampa que abre
por smoothstep ate no maximo 2,5%. Dos 675 corredores aprovados:

    azimute 15 graus   centro (25, 45)   cota de projeto 147,9 m
    corte 6,6 m   aterro 7,3 m   |corte/aterro| medio 2,96 m
    consistencia de lado 1,00

`consistencia 1,00` e o numero que faz esta seccao existir: em TODAS as estacas
o terreno a -17 m esta acima do greide e o a +17 m esta abaixo. Corte sempre do
mesmo lado, aterro sempre do outro — ninguem tem de escolher por estaca, e a
seccao transversal pode ser autorada uma vez.

MATA QUE SOBRA: 235 arvores no cinturao esquerdo e 218 no direito (25 a 85 m),
106 nas pontas do tracado. 182 arvores caem dentro da obra. Ou seja abre-se a
clareira sem esvaziar a floresta, que era o pedido.

===========================================================================
EIXOS — a parte que se erra em silencio
===========================================================================

`scene.ts` diz: "azimuthDeg e 0 no +Z (a frente da cabine)". O exportador corre
com `export_yup`, que manda (x, y, z) do Blender para (x, z, -y) do three. Logo
three.z = -blender.y, e a rodovia TEM de correr no eixo Y do Blender para ficar
alinhada com a frente do caminhao. A cena e rodada de 90-15 = 75 graus para por
o azimute 15 no +Y.

Consequencia que decide o enquadramento: o lado do CORTE cai em -X do Blender,
que e -X do three, que e a ESQUERDA de quem olha para +Z. Ou seja o caminhao
fica com a face de rocha a esquerda e o vale aberto a direita — e como se
estaciona no acostamento direito de uma serra, com a vista para o vale.

===========================================================================
SECCAO TRANSVERSAL (meia-largura a partir do eixo)
===========================================================================

    0,00 -> 3,60   faixa de rolamento          abaulamento 2,0%
    3,60 -> 6,10   acostamento pavimentado     5,0%
    6,10 -> 8,20   banqueta de brita/pedrisco  8,0%
    8,20 -> ...    talude

  LADO DO CORTE (u<0): valeta de 1,2 m e 0,45 m de fundo colada a banqueta,
  depois talude a 1V:0,6H ate APANHAR o terreno natural. A apanha e por
  `min(z_natural, z_talude)`, que termina sozinha na cota certa — nao ha
  comprimento de talude autorado, ele e onde o terreno mandar.

  LADO DO ATERRO (u>0): talude a 1V:1,75H gramado, apanha por
  `max(z_natural, z_talude)`. Defensa metalica semi-maleavel por cima, que e o
  que uma serra tem e tambem o que esconde a linha de apanha.

Pista total 7,20 m, plataforma pavimentada 12,20 m. Sao as medidas de rodovia
rural de pista simples, nao numeros bonitos.

SINALIZACAO. Eixo em AMARELO duplo continuo (LFO-3, proibido ultrapassar — que
e o que uma serra tem e o que a geometria aqui justifica) e bordos em BRANCO
continuo. Amarelo no eixo e branco no bordo e a regra brasileira; trocar as
cores e o erro que denuncia cenario estrangeiro. Tachas refletivas ao longo dos
bordos, que o `vehicle/retroreflect.ts` do engine ja sabe acender de noite.

FOLGA DOS DECALQUES: 15 mm. O numero vem de `audit_decals.py` — camera com near
0,1 m e buffer de 24 bits da ~1,0 mm de resolucao de profundidade a 40 m e
~3,8 mm a 80 m, e 12 mm cobre os dois com folga. 15 mm fica acima disso e ainda
e invisivel de perfil.

===========================================================================
O QUE A FONTE TRAZ PARTIDO, E QUE E CORRIGIDO AQUI
===========================================================================

  * TRES IMAGENS 0x0. `Background_Tree_Atlas_Normal.png`,
    `Background_Tree_Atlas_Roughness.png` e `Grass_Close_Normal.png` apontam
    para caminhos que nao existem (`//../../SKETCHFAB PROJECTS/...`) e nao estao
    empacotadas. Sao os "Failed to create GPU texture" do log. Ficam
    DESLIGADAS — um no de imagem vazio ligado a Normal poe a normal a zero.

  * COLOR_0 BRANCO EM 16 OBJETOS. Os materiais com atributo 'Attribute' tem
    rgb=1,000 em TODOS os cantos (medido: min=med=max=1,0). Isso e 168 175
    cantos so no `Trunk_Oak`, que a 4 bytes sao 672 KB de branco puro dentro do
    .glb. Sao apagados. Fica so o atributo 'AO' dos 10 materiais de chao/rocha,
    esse sim com sinal (mediana 0,42 a 1,00), e que o glTF ja multiplica no
    baseColor com a mesma semantica do `Mix MULTIPLY` do ficheiro.

  * `blend_method` HASHED em tudo. Para o glTF interessa CLIP, que sai como
    `alphaMode: MASK`: folhagem em BLEND custa ordenacao por triangulo e ainda
    assim ordena mal.
"""

import bmesh
import bpy
import json
import math
import os
import sys
import time
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", ".."))
SRC = os.path.expanduser("~/Downloads/DIRT SCENE PACKED TEXTURES.blend")
OUTDIR = os.path.join(REPO, "public", "environments", "serra")
WORK = os.path.join(HERE, "_work_serra")

# ---------------------------------------------------------------- corredor
# medidos por varredura (ver cabecalho); a cota e recalculada por raycast fino
ROAD_AZIMUTH = 15.0          # graus no XY da cena de origem
ROAD_CX, ROAD_CY = 25.0, 45.0
ROAD_Z_SEED = 147.9

# =========================================================================
# O ALINHAMENTO, E POR QUE ELE DEIXOU DE SER UM GRAFO SOBRE Y
# =========================================================================
# A primeira versao punha o eixo em `road_x(t) = (|t|-55)^2 / 2800` — uma
# parabola de 1 400 m de raio sobre a coordenada Y, ou seja a estrada era o
# GRAFICO de uma funcao e a seccao transversal era medida ao longo de X. Isso e
# barato e funciona enquanto a curva for pequena; a 4,3 m de desvio em 175 m ela
# era pequena a ponto de nao existir, e o relato diz exatamente isso: *"a estrada
# esta muito estranha, muito padronizada"*. Uma reta de 350 m com o horizonte
# aberto no fim le como fita de CAD, e nenhum ajuste de textura conserta.
#
# ABRIR A CURVA NO MESMO ESQUEMA NAO SERVE, e o numero diz por que: com desvio
# lateral f(y), a tangente faz angulo a = atan(f'(y)) com Y, e uma seccao medida
# ao longo de X em vez de perpendicular a tangente sai ESTICADA por 1/cos(a). Nos
# 28 graus que esta curva precisa ter, isso e 13 % de largura a mais na ponta —
# a pista abriria de 7,00 para 7,95 m sozinha, o que se ve.
#
# Entao o eixo passa a ser uma POLIGONAL parametrizada por comprimento de arco:
# curvatura autorada, `psi` integrada dela, posicao integrada de `psi`, e a
# seccao montada no referencial de Frenet (tangente, normal). Custa uma inversao
# (x,y) -> (s,u) que a versao-grafico tinha de graca, e e o preco de a curva ser
# curva.
#
# POR QUE PARA A ESQUERDA, E DE PROPOSITO. A curva da frente vira para -X, que e
# o lado do CORTE — a estrada entra na encosta. Duas consequencias, as duas
# pedidas no relato: o que fecha a vista a frente passa a ser o talude de corte
# mais a mata em cima dele (*"assim voce pode completar aquela area com floresta
# tambem, e ficara escondido essa falha a frente"*), e a mata do lado de dentro
# da curva e vista de PERFIL, que e onde uma floresta parece funda. Virar para o
# vale faria o contrario: abriria o horizonte em vez de fechar.
#
# ATRAS VIRA PARA O OUTRO LADO, com raio bem maior. Duas curvas do mesmo lado
# leem como um arco de circunferencia (o cenario inteiro vira uma rotatoria);
# invertidas, leem como um S de serra. O raio maior atras e porque aquele lado
# aparece menos e nao precisa fechar tao depressa.
S_TANG = 26.0                # tangente NIVELADA e RETA sob o caminhao (metade)
LEN_F = 215.0                # comprimento de arco construido a frente (+s)
LEN_B = 180.0                # ... e atras (-s)
R_FRONT = 260.0              # raio da curva da frente (para -X, dentro da encosta)
R_BACK = 620.0               # raio da curva de tras (para +X)
CURVE_F = (26.0, 68.0, 155.0, 195.0)   # entrada/saida da clotoide, a frente
CURVE_B = (40.0, 86.0, 150.0, 176.0)   # ... e atras (em |s|)

# TETO DO GREIDE: 7,5 %, e a primeira tentativa com 3,5 % foi um erro MEDIDO.
# ------------------------------------------------------------------------
# Com 3,5 % os cinco trechos saturavam TODOS no teto, alternando de sinal, e o
# desvio contra o terreno ficava em 7,59 m de rms com pico de 19,4 m. Isso nao e
# um ajuste, e um ajuste impossivel a dizer que nao consegue: a encosta tem 19,7 %
# de declive medio, entao uma estrada que so pode fazer 3,5 % TEM de a cortar, e
# cortar 19 m de encosta nao e uma rodovia, e uma trincheira.
#
# 7,5 % e o que a norma brasileira admite em relevo montanhoso (a DNIT vai a 8-9 %
# em classe baixa) e e o que uma serra de verdade tem. O ganho nao e so de
# terraplenagem: uma estrada que SOBE de verdade a frente le como serra, e uma
# estrada plana num terreno de 20 % le como maquete.
GRADE_MAX = 0.075
# Sete trechos em vez de cinco, e o do meio E a tangente. Mais trechos deixam o
# perfil PERSEGUIR a encosta em vez de a cortar — e sao eles que poem lombada e
# concavidade no percurso, que e o que quebra a leitura de regua.
GRADE_KNOTS = (-180.0, -128.0, -80.0, -34.0, 34.0, 80.0, 128.0, 215.0)
GRADE_FLAT_I = 3             # indice do trecho que fica em ZERO, sempre
# Greide por TRECHO, e nao uma rampa por sentido.
# ------------------------------------------------------------------------
# A versao anterior tinha DUAS incognitas — uma rampa a frente e uma atras — e
# por isso a estrada subia monotona nos dois sentidos: 350 m de rampa unica com
# a mesma inclinacao do primeiro ao ultimo metro. Uma serra nao faz isso; ela
# sobe, alivia num patamar, torna a subir. Com cinco trechos e uma tangente
# nivelada no meio, o ajuste por minimos quadrados PERSEGUE o terreno em vez de
# o cortar em linha reta — o que baixa terraplenagem e, de graca, poe uma
# lombada e uma concavidade no perfil, que e o que quebra a leitura de regua.
GRADES = [0.0] * (len(GRADE_KNOTS) - 1)

# seccao transversal
#
# O ACOSTAMENTO SUBIU DE 2,50 PARA 3,00 m e a banqueta desceu de 2,10 para 1,55,
# a pedido — *"alem do acostamento estar muito estreito"*. A plataforma
# pavimentada vai de 12,20 para 13,10 m e a faixa de brita, que e a parte que le
# como TERRA e nao como estrada, encolhe 26 %. O que o olho mede num acostamento
# nao e a largura absoluta, e a razao dele para a faixa: era 0,69 e passa a 0,86.
W_LANE = 3.50                # faixa de rolamento
W_SHLD = 3.00                # acostamento pavimentado
W_VERGE = 1.55               # banqueta de brita
X_LANE = W_LANE
X_SHLD = W_LANE + W_SHLD                 # 6.50
X_VERGE = W_LANE + W_SHLD + W_VERGE      # 8.05
S_LANE, S_SHLD, S_VERGE = 0.020, 0.045, 0.080   # abaulamentos

DITCH_W, DITCH_D = 1.20, 0.45            # valeta do lado do corte
CUT_SLOPE = 0.60                         # 1V : 0,6H  (rocha) — valor CENTRAL
FILL_SLOPE = 1.75                        # 1V : 1,75H (gramado) — valor CENTRAL
# O TALUDE DEIXOU DE TER UMA INCLINACAO SO, e e a correcao de *"a elevacao que da
# ate a estrada esta muito generica, muito falsa"*. Numa serra de verdade a
# inclinacao muda com o material que aparece no corte: rocha sa fica em pe, solo
# alterado deita. Duas coisas mudam aqui e as duas sao de forma, nao de textura:
#
#   1. A INCLINACAO OSCILA COM A ESTACA. Um ruido de baixa frequencia (periodo de
#      dezenas de metros) faz o corte ir de 1V:0,45H a 1V:0,85H e o aterro de
#      1V:1,50H a 1V:2,05H. Como a apanha e por min/max contra o terreno, uma
#      inclinacao diferente muda TAMBEM onde o talude acaba — a linha de apanha
#      deixa de ser uma curva suave e passa a ter reentrancias.
#   2. A SUPERFICIE GANHA RELEVO PROPRIO. Deslocamento fBm ao longo da linha de
#      maior declive, com amplitude que nasce em ZERO na aresta da banqueta (a
#      plataforma tem de continuar limpa) e abre ate ~0,45 m no meio do talude.
#      No aterro esse deslocamento e ANISOTROPICO — alongado no sentido da
#      descida —, que e o que le como sulco de erosao e nao como amassado.
SLOPE_WOBBLE = 0.235                     # amplitude relativa da oscilacao
BATTER_NOISE = 0.42                      # m, deslocamento maximo da superficie
ROUND_TOP = 2.6                          # m de arredondamento na crista do corte
ROUND_TOE = 3.2                          # ... e no pe do aterro
BERM_AT = 7.0                            # altura de corte que passa a pedir banqueta
BERM_W = 2.4                             # largura da banqueta do talude
DEEP_ROCK = 2.8                          # escavacao alem disto vira rocha forte
PAVE_LIFT = 0.09                         # espessura do pavimento sobre o terreno
# TETOS DA APANHA. Sem eles o talude persegue o terreno para dentro do penhasco
# que a fonte tem a jusante e a marcha so para a 32 m de altura de aterro — o
# que nao e uma rodovia, e uma barragem. Com teto, o anel exterior cai direto na
# cota natural e le como face de rocha aparelhada, que e o que uma serra faz
# quando o aterro deixa de compensar.
MAX_BATTER = 24.0                        # alem da banqueta, em cada lado

DECAL_LIFT = 0.015                       # 15 mm — ver cabecalho
UV_M = 8.0                               # metros por UV no pavimento (contrato do app)
# ESCALAS MEDIDAS NA FONTE (tools: uvscale). O talude nasce colado ao terreno que
# a fonte ja texturiza, e um ladrilho diferente do vizinho denuncia a emenda mais
# do que qualquer erro de cor. Grama e valeta CASAM com o vizinho; a rocha do
# corte nao casa de proposito — `Sloped_Rock` esta esticado a 37,5 m por UV numa
# encosta vista de longe, e uma face de corte a 3 m de altura vista de 10 m com
# esse ladrilho nao tem rocha nenhuma. 12 m e o meio-termo: le como rocha de
# perto e nao briga com o macico atras.
# 6 m, e nao os 12 da rodada anterior. A nota de entao dizia "12 e o meio-termo:
# le como rocha de perto e nao briga com o macico atras" — e a bancada mostrou
# que nao le. Um talude de corte tem 3 a 8 m de geratriz; com o ladrilho a 12 m
# ve-se MENOS DE METADE de um ladrilho na altura toda da face, o que e o mesmo
# que uma mancha. A 6 m sao uma a uma e meia, e a face passa a ter rocha. O
# argumento de nao brigar com o macico continua a valer e continua satisfeito: o
# macico e `Sloped_Rock` da fonte com a UV dela, e a face de corte foi feita para
# NAO casar de proposito (ver o cabecalho).
UV_M_ROCK = 6.0                          # fonte: Sloped_Rock med 37,5
UV_M_GRASS = 10.44                       # fonte: Grass_Close med 10,44 — casa
UV_M_DIRT = 9.54                         # fonte: Ground_Dirt med 9,54 — casa
SKIRT = (1.3, 2.8)                       # aba do corredor sobre o terreno intacto

# limpeza da vegetacao (distancia ao eixo)
CLEAR_CUT = 17.0             # lado do corte: remove arvore ate aqui
CLEAR_FILL = 24.0            # lado do aterro
THIN_TO = 31.0               # e desbasta ate aqui
THIN_KEEP = 0.55

# LOD por distancia a origem (onde fica o caminhao)
LOD1_R, LOD2_R = 55.0, 110.0
# Alem de LOD2_R o LOD tira ARVORES INTEIRAS (LOD2_TREE_KEEP) em vez de esvaziar
# cada uma: 176 arvores/ha a 120 m nao se contam, mas uma arvore semitransparente
# ve-se sempre — ver o cabecalho de stage_veg.
LOD2_TREE_KEEP = 0.68
LOD1_CARD_KEEP = 0.88
LOD2_CARD_KEEP = 0.74
CLUTTER_R = 72.0             # tufos/folhas/decalques deixam de existir alem disto

GROUND_MATS = ['Ground_Dirt', 'Dirt_Road', 'Dirt_Road_Bare', 'Dirt_Road_Trails',
               'Road_Edge_Gravel_Dusty', 'Cobblestone', 'Grass_Close', 'Aerial_Grass',
               'Terrain_Far', 'Sloped_Rock', 'Tall_Cliff', 'Broken_Rocks', 'Rock_Decal',
               'Mud_Pile', 'Puddle_Streaks', 'Fallen_Generic_Leaves', 'Fallen_Maple_Leaves']
BASE_MATS = ['Aerial_Grass', 'Terrain_Far', 'Sloped_Rock', 'Tall_Cliff', 'Grass_Close',
             'Ground_Dirt', 'Dirt_Road', 'Broken_Rocks']
TREE_MATS = ['Trunk_Oak', 'Trunk_Birch', 'Background_Tree_Atlas']
CLUTTER_MATS = ['Grass_Vegetation_Green', 'Grass_Vegetation_Dry', 'Fallen_Generic_Leaves',
                'Fallen_Maple_Leaves', 'Rock_Decal', 'Puddle_Streaks', 'Forest_Bush']
BROKEN_IMAGES = ['Background_Tree_Atlas_Normal.png', 'Background_Tree_Atlas_Roughness.png',
                 'Grass_Close_Normal.png']

T0 = time.time()


def log(m):
    print(f"[serra {time.time()-T0:7.1f}s] {m}", flush=True)


def mat_of(o):
    return o.data.materials[0].name if o.data.materials and o.data.materials[0] else "?"


def by_mat():
    """Objetos DA FONTE, por material.

    So conta quem tem `o.name == mat_of(o)`, que e a assinatura que `stage_prep`
    poe nos 26 objetos originais. Sem esse filtro, o `CUT_FACE` e o `FILL_SLOPE`
    — que reutilizam de proposito os materiais `Sloped_Rock` e `Grass_Close` da
    fonte para nao trazerem textura nova — sobrescreviam a entrada do objeto
    original no dicionario, e as etapas seguintes passariam a mexer no talude
    julgando mexer no terreno.
    """
    return {mat_of(o): o for o in bpy.data.objects
            if o.type == 'MESH' and o.name == mat_of(o)}


# =========================================================================
# geometria do eixo — POLIGONAL POR COMPRIMENTO DE ARCO
# =========================================================================
def _shape(a, s0, s1, s2, s3):
    """0 antes de s0, sobe por smoothstep ate 1 em s1, cai de s2 a s3.

    E a forma da CURVATURA, nao a da curva: uma curvatura que salta de 0 para
    1/R num ponto poe uma descontinuidade de aceleracao lateral e, o que aqui
    importa mais, um JOELHO visivel no bordo do pavimento. Subindo por
    smoothstep, a curvatura tem derivada continua e o traçado e uma clotoide
    aproximada — que e o que um projeto rodoviario usa e o que faz a estrada
    parecer construida e nao desenhada.
    """
    if a <= s0 or a >= s3:
        return 0.0
    if a < s1:
        f = (a - s0) / max(1e-6, s1 - s0)
    elif a <= s2:
        return 1.0
    else:
        f = (s3 - a) / max(1e-6, s3 - s2)
    return f * f * (3 - 2 * f)


def curvature(s):
    """1/R com sinal, em rad/m. Negativo vira para -X (a encosta)."""
    if s >= 0.0:
        return -_shape(s, *CURVE_F) / R_FRONT
    return _shape(-s, *CURVE_B) / R_BACK


_ALIGN = None                # (S, X, Y, PSI, Z) amostrados a ALIGN_STEP
ALIGN_STEP = 0.5


def build_alignment():
    """Integra curvatura -> heading -> posicao, e o greide por cima.

    A ORIGEM E O CAMINHAO e a tangente ali e exatamente reta e nivelada: o app
    estaciona o veiculo em (0,0) com as rodas em y=0, e qualquer curvatura ou
    greide sob ele poe o cavalo torto em relacao ao implemento. `S_TANG` e
    `GRADE_KNOTS` garantem os dois — a curvatura so abre alem de 25 m e o greide
    so alem de 45 m.
    """
    global _ALIGN
    n_f = int(LEN_F / ALIGN_STEP)
    n_b = int(LEN_B / ALIGN_STEP)
    S = np.arange(-n_b, n_f + 1, dtype=np.float64) * ALIGN_STEP
    K = np.array([curvature(float(v)) for v in S])
    # heading: psi(0) = 0, integrado nos dois sentidos a partir do caminhao
    i0 = n_b
    PSI = np.zeros_like(S)
    for i in range(i0 + 1, len(S)):
        PSI[i] = PSI[i - 1] + 0.5 * (K[i] + K[i - 1]) * ALIGN_STEP
    for i in range(i0 - 1, -1, -1):
        PSI[i] = PSI[i + 1] - 0.5 * (K[i] + K[i + 1]) * ALIGN_STEP
    TX, TY = np.sin(PSI), np.cos(PSI)
    X = np.zeros_like(S)
    Y = np.zeros_like(S)
    for i in range(i0 + 1, len(S)):
        X[i] = X[i - 1] + 0.5 * (TX[i] + TX[i - 1]) * ALIGN_STEP
        Y[i] = Y[i - 1] + 0.5 * (TY[i] + TY[i - 1]) * ALIGN_STEP
    for i in range(i0 - 1, -1, -1):
        X[i] = X[i + 1] - 0.5 * (TX[i] + TX[i + 1]) * ALIGN_STEP
        Y[i] = Y[i + 1] - 0.5 * (TY[i] + TY[i + 1]) * ALIGN_STEP
    Z = np.array([_grade_int(float(v)) for v in S])
    _ALIGN = (S, X, Y, PSI, Z)
    return _ALIGN


def _grade_seg(i):
    return GRADES[i] if 0 <= i < len(GRADES) else 0.0


def _flat_mask(s):
    """0 sob o caminhao, 1 a partir de S_TANG+18 m. A tangente e INEGOCIAVEL.

    O app estaciona o conjunto na origem com as rodas em y=0. Um greide ali nao
    da "uma leve subida": da o cavalo com uma inclinacao e o implemento com
    outra, porque os dois pousam em pontos diferentes do perfil — e o engate
    passa a ler como defeito de modelo. O ajuste por minimos quadrados nao sabe
    disso e, deixado a vontade, poe 3,5 % debaixo do veiculo (foi o que fez na
    primeira execucao). Entao o resultado dele e MULTIPLICADO por esta mascara:
    o que a mascara zera, o ajuste nao tem como devolver.
    """
    a = abs(s)
    if a <= S_TANG:
        return 0.0
    f = min(1.0, (a - S_TANG) / 18.0)
    return f * f * (3 - 2 * f)


def grade_at(s):
    """Greide (m/m) na estaca `s`, interpolado entre os nos com smoothstep.

    Interpolado e nao em degrau: um degrau de greide e um vertice angular no
    perfil, e um vertice angular no perfil e uma quebra na linha de reflexo da
    lataria — o mesmo motivo pelo qual a rampa da versao anterior abria por
    smoothstep em vez de comecar com um joelho.
    """
    ks = GRADE_KNOTS
    if s <= ks[0] or s >= ks[-1]:
        return 0.0
    m = _flat_mask(s)
    if m <= 0.0:
        return 0.0
    for i in range(len(ks) - 1):
        if ks[i] <= s <= ks[i + 1]:
            f = (s - ks[i]) / (ks[i + 1] - ks[i])
            g0 = _grade_seg(i - 1) if i > 0 else 0.0
            g1 = _grade_seg(i)
            g2 = _grade_seg(i + 1) if i + 1 < len(GRADES) else 0.0
            # meio do trecho = greide do trecho; as pontas fazem a media com o
            # vizinho, que e o acordo vertical parabolico
            if f < 0.5:
                w = 0.5 + f
                w = w * w * (3 - 2 * w)
                return (g0 + (g1 - g0) * w) * m
            w = f - 0.5
            w = w * w * (3 - 2 * w)
            return (g1 + (g2 - g1) * w) * m
    return 0.0


_GZ = {}


def _grade_int(s):
    """Cota do eixo: integral do greide, memoizada com passo de 25 cm."""
    k = int(round(s * 4.0))
    v = _GZ.get(k)
    if v is not None:
        return v
    ss = k / 4.0
    n = max(2, int(abs(ss) / 0.5) + 1)
    u = np.linspace(0.0, ss, n)
    v = _GZ[k] = float(np.trapezoid([grade_at(float(x)) for x in u], u))
    return v


def align_at(s):
    """(x, y, psi, z) do eixo na estaca `s`, por interpolacao da poligonal."""
    S, X, Y, PSI, Z = _ALIGN
    return (float(np.interp(s, S, X)), float(np.interp(s, S, Y)),
            float(np.interp(s, S, PSI)), float(np.interp(s, S, Z)))


def frame_at(s):
    """Posicao, tangente e normal (para +u) na estaca `s`.

    A normal e (cos psi, -sin psi): em psi=0 ela e (1,0), ou seja `u` positivo
    aponta para +X, que e o lado do ATERRO — o mesmo sinal que a versao-grafico
    tinha, entao todo o resto do arquivo continua valendo.
    """
    x, y, psi, z = align_at(s)
    return (x, y, z, math.cos(psi), -math.sin(psi))


def offset_xy(s, u):
    x, y, z, nx, ny = frame_at(s)
    return (x + nx * u, y + ny * u)


def road_z(s):
    return float(np.interp(s, _ALIGN[0], _ALIGN[4]))


def to_su(px, py):
    """Inverte (x, y) -> (s, u) para UM ponto.

    Nao delega em `to_su_many`, e a razao e de custo: o plantio chama isto
    dezenas de milhares de vezes e a versao em blocos aloca tres matrizes por
    chamada so para tratar um ponto. Aqui e uma reducao sobre 850 amostras.
    """
    S, X, Y, PSI, _ = _ALIGN
    dx = X - px
    dy = Y - py
    j = int(np.argmin(dx * dx + dy * dy))
    ddx, ddy = px - X[j], py - Y[j]
    c, s_ = math.cos(PSI[j]), math.sin(PSI[j])
    return float(S[j] + ddx * s_ + ddy * c), float(ddx * c - ddy * s_)


def to_su_many(px, py, chunk=4096):
    """(x, y) -> (s, u) para arrays inteiros, em blocos.

    POR QUE FORCA BRUTA. A poligonal tem ~850 amostras e a cena tem dezenas de
    milhares de pontos a classificar; a matriz completa seria 850 x N floats, que
    a 50 000 pontos ja e 340 MB. Em blocos de 4 096 sao 28 MB e o numpy resolve
    cada bloco num produto so. Uma arvore espacial seria mais rapida e traria
    scipy para dentro do build por causa de tres segundos.

    O sinal de `u` vem do produto vetorial com a TANGENTE e nao de comparar x com
    o eixo: com 28 graus de heading, comparar coordenadas troca o sinal do lado
    errado da curva — e trocar o sinal de u troca corte por aterro.
    """
    S, X, Y, PSI, _ = _ALIGN
    out_s = np.empty(len(px))
    out_u = np.empty(len(px))
    TXs, TYs = np.sin(PSI), np.cos(PSI)
    for a in range(0, len(px), chunk):
        b = min(a + chunk, len(px))
        dx = px[a:b, None] - X[None, :]
        dy = py[a:b, None] - Y[None, :]
        d2 = dx * dx + dy * dy
        j = np.argmin(d2, axis=1)
        # refino: projeta no segmento tangente da amostra mais proxima
        ddx = px[a:b] - X[j]
        ddy = py[a:b] - Y[j]
        tproj = ddx * TXs[j] + ddy * TYs[j]
        out_s[a:b] = S[j] + tproj
        out_u[a:b] = ddx * np.cos(PSI[j]) - ddy * np.sin(PSI[j])
    return out_s, out_u


def cross_z(u):
    """queda do abaulamento a `u` metros do eixo (negativa)."""
    a = abs(u)
    if a <= X_LANE:
        return -S_LANE * a
    if a <= X_SHLD:
        return -(S_LANE * X_LANE + S_SHLD * (a - X_LANE))
    z = -(S_LANE * X_LANE + S_SHLD * W_SHLD)
    return z - S_VERGE * min(a - X_SHLD, W_VERGE)


Z_VERGE_EDGE = cross_z(X_VERGE)


# ---------------------------------------------------------------- ruido
def fbm(x, y, oct_=4, lac=2.0, gain=0.5, seed=0.0):
    """Ruido fractal barato e DETERMINISTICO — seno-hash, sem tabela.

    Nao precisa da qualidade de um Perlin: o que ele faz aqui e tirar a
    regularidade de superficies grandes (talude, avental de terreno). O que ele
    NAO pode ser e aleatorio entre execucoes — uma foto aprovada tem de sair
    igual amanha, que e a mesma regra do `mulberry32` do scenery.ts.
    """
    v, amp, f = 0.0, 1.0, 1.0
    for i in range(oct_):
        n = math.sin(x * f * 1.7 + seed * 3.1 + i * 11.3) * \
            math.cos(y * f * 1.3 - seed * 2.7 + i * 7.7) + \
            0.6 * math.sin((x * 0.9 + y * 1.1) * f + seed + i * 4.2)
        v += amp * n
        amp *= gain
        f *= lac
    return v / 1.9


def slope_of(s, side):
    """Inclinacao do talude na estaca `s`, do lado `side`. Ver SLOPE_WOBBLE."""
    w = fbm(s * 0.021, side * 4.0, oct_=2, seed=side * 5.0)
    if side < 0:
        return CUT_SLOPE * (1.0 + SLOPE_WOBBLE * w)
    return FILL_SLOPE * (1.0 + SLOPE_WOBBLE * w)


# =========================================================================
# etapas
# =========================================================================
def stage_prep():
    log("PREP — abrir a fonte, sanear materiais e atributos")
    bpy.ops.wm.open_mainfile(filepath=SRC)

    for o in list(bpy.data.objects):
        if o.type != 'MESH':
            bpy.data.objects.remove(o, do_unlink=True)
    for o in bpy.data.objects:
        o.name = o.data.name = mat_of(o)
        for ps in list(o.particle_systems):
            o.modifiers.remove(o.modifiers[ps.name]) if ps.name in o.modifiers else None
    # os sistemas de particulas da fonte estao todos vazios; os modificadores
    # que os seguram impedem `to_mesh` de ser barato mais a frente
    for o in bpy.data.objects:
        for m in list(o.modifiers):
            if m.type == 'PARTICLE_SYSTEM':
                o.modifiers.remove(m)
        if o.modifiers:
            bpy.context.view_layer.objects.active = o
            for m in list(o.modifiers):
                try:
                    bpy.ops.object.modifier_apply(modifier=m.name)
                    log(f"  modificador {m.type} aplicado em {o.name}")
                except Exception as e:
                    log(f"  !! modificador {m.type} em {o.name}: {e}")

    # imagens 0x0 -> desligar o no que as usa
    n = 0
    for m in bpy.data.materials:
        if not m.node_tree:
            continue
        for node in list(m.node_tree.nodes):
            if node.type == 'TEX_IMAGE' and node.image and node.image.size[0] == 0:
                for out in node.outputs:
                    for lk in list(out.links):
                        m.node_tree.links.remove(lk)
                m.node_tree.nodes.remove(node)
                n += 1
    for nm in BROKEN_IMAGES:
        im = bpy.data.images.get(nm)
        if im:
            bpy.data.images.remove(im)
    log(f"  {n} nos de imagem 0x0 desligados")

    # COLOR_0 branco puro -> apagar
    freed = 0
    for o in bpy.data.objects:
        for ca in list(o.data.color_attributes):
            k = len(ca.data)
            a = np.zeros(k * 4, dtype=np.float32)
            ca.data.foreach_get('color', a)
            if a.reshape(k, 4)[:, :3].min() > 0.999:
                o.data.color_attributes.remove(ca)
                freed += k
    log(f"  COLOR_0 branco removido: {freed} cantos (~{freed*4/1e6:.2f} MB no glb)")

    mask_alpha()

    os.makedirs(WORK, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(WORK, "01_prep.blend"))
    log(f"  gravado 01_prep.blend  ({len(bpy.data.objects)} objetos)")


MASK_MATS = ['Background_Tree_Atlas', 'Forest_Bush', 'Grass_Vegetation_Green',
             'Grass_Vegetation_Dry', 'Metal_Fence']


def mask_alpha():
    """Poe a folhagem em `alphaMode: MASK` — e nao, `blend_method` nao serve.

    O exportador glTF do Blender 5.x diz isto em letra gorda no proprio codigo
    (`search_node_tree.py`, `gather_alpha_info`): "Alpha mode is determined by
    the nodes too (previously it used the Eevee blend_method)". Ou seja
    `m.blend_method = 'CLIP'` e ignorado no export — a fonte saiu com quinze
    materiais de folhagem em `alphaMode: BLEND`, verificado no chunk JSON do
    .glb. O padrao que ele reconhece e um no `Math` de operacao GREATER_THAN
    entre a textura de opacidade e a entrada Alpha; o segundo operando vira o
    `alphaCutoff`.

    POR QUE ISTO IMPORTA, e por que so na folhagem. `Background_Tree_Atlas` e
    UMA malha com milhares de cartoes de folha a todas as profundidades. Em
    BLEND o GLTFLoader liga `transparent: true` e `depthWrite: false`, e a
    ordenacao passa a ser a ordem dos triangulos dentro da malha — folha de tras
    desenhada por cima de folha da frente, a copa inteira com oclusao errada.
    MASK escreve profundidade e o problema deixa de existir.

    OS DECALQUES DE CHAO FICAM EM BLEND, de proposito. `Rock_Decal`,
    `Fallen_*_Leaves`, `Dirt_Road*`, `Road_Edge_Gravel_Dusty` e
    `Puddle_Streaks` tem alfa suave exatamente para DILUIR a borda no terreno —
    e para isso que servem. Corta-los a 0,5 devolveria um recorte de tesoura em
    volta de cada mancha, e o argumento da ordenacao nao se aplica: sao chapas
    deitadas no chao, nao se sobrepoem entre si em profundidade.
    """
    n = 0
    for name in MASK_MATS:
        m = bpy.data.materials.get(name)
        if not m or not m.node_tree:
            continue
        nt = m.node_tree
        bsdf = next((x for x in nt.nodes if x.type == 'BSDF_PRINCIPLED'), None)
        if not bsdf or not bsdf.inputs['Alpha'].links:
            continue
        lk = bsdf.inputs['Alpha'].links[0]
        gt = nt.nodes.new('ShaderNodeMath')
        gt.operation = 'GREATER_THAN'
        gt.inputs[1].default_value = 0.40
        gt.location = (bsdf.location.x - 220, bsdf.location.y - 320)
        nt.links.new(gt.inputs[0], lk.from_socket)
        nt.links.remove(lk)
        nt.links.new(bsdf.inputs['Alpha'], gt.outputs[0])
        n += 1
    log(f"  {n} materiais de folhagem passados a alphaMode MASK (corte 0,40)")


def stage_frame():
    """Roda o azimute 15 para +Y, poe o caminhao na origem e o GREIDE em z=0.

    A COTA ZERO E O GREIDE AJUSTADO, NAO O TERRENO SOB O CAMINHAO, e a diferenca
    nao e academica: medido aqui, o terreno natural no ponto escolhido esta 1,26 m
    acima da reta de projeto ajustada ao longo de +-90 m. Ancorar no terreno
    levantaria a estrada inteira nesse 1,26 m e transferiria corte para aterro —
    os numeros de terraplenagem da varredura deixariam de valer, em silencio.

    E o ajuste e REFEITO AQUI, por raycast de 2 em 2 m contra a malha, em vez de
    herdar a constante da varredura: aquela correu sobre uma grelha de 4 m e
    serviu para ESCOLHER o corredor entre 8 560; para o construir, a cota tem de
    vir da geometria.
    """
    global GRADES
    log("FRAME — alinhar o corredor ao eixo Y e recentrar")
    bpy.ops.wm.open_mainfile(filepath=os.path.join(WORK, "01_prep.blend"))

    phi = math.radians(90.0 - ROAD_AZIMUTH)
    R = Matrix.Rotation(phi, 4, 'Z')
    c = R @ Vector((ROAD_CX, ROAD_CY, 0.0))

    # A ROTACAO E A TRANSLACAO EM XY VEM PRIMEIRO, e o ajuste do greide DEPOIS.
    # -----------------------------------------------------------------------
    # A ordem inverteu-se em relacao a versao anterior e tinha de inverter: o
    # alinhamento agora e uma poligonal CURVA definida no referencial final
    # (origem no caminhao, +Y a frente), entao nao ha como amostrar o terreno "ao
    # longo do eixo" antes de o referencial existir. Como a transformada de XY
    # nao mexe em z, ela pode ir primeiro sem prejudicar o ajuste vertical.
    M_xy = Matrix.Translation(Vector((-c.x, -c.y, 0.0))) @ R
    for o in bpy.data.objects:
        o.data.transform(M_xy @ o.matrix_world)
        o.matrix_world = Matrix.Identity(4)

    build_alignment()
    B = by_mat()
    bvh = build_bvh([B[m] for m in GROUND_MATS if m in B])

    ss, zs = [], []
    for s in np.arange(-LEN_B, LEN_F + 0.01, 2.0):
        x, y = offset_xy(float(s), 0.0)
        h = bvh.ray_cast(Vector((x, y, 900.0)), Vector((0, 0, -1)))
        if h[0] is not None:
            ss.append(float(s)); zs.append(h[0].z)
    ss = np.array(ss); zs = np.array(zs)

    # AJUSTE DO GREIDE POR TRECHO. Cada coluna da matriz e a integral de um
    # greide unitario naquele trecho — ou seja, o quanto a estrada sobe se
    # SO aquele trecho tiver 100 % de rampa. Minimos quadrados devolve as cinco
    # inclinacoes de uma vez; o teto de GRADE_MAX e aplicado depois e o ajuste
    # e REFEITO com os trechos saturados fixos, senao um trecho no teto
    # empurraria o erro dele para os vizinhos sem ninguem ver.
    # O TRECHO DA TANGENTE FICA FORA DO AJUSTE, nao entra como incognita: com a
    # mascara `_flat_mask` a coluna dele e identicamente zero, e uma coluna nula
    # torna o sistema singular. Tira-se a incognita em vez de a deixar passear.
    livres = [i for i in range(len(GRADES)) if i != GRADE_FLAT_I]

    def cols(sarr):
        out = []
        for i in livres:
            g = [0.0] * len(GRADES)
            g[i] = 1.0
            old = list(GRADES)
            GRADES[:] = g
            _GZ.clear()
            out.append(np.array([_grade_int(float(v)) for v in sarr]))
            GRADES[:] = old
        _GZ.clear()
        return np.c_[np.ones(len(sarr)), np.array(out).T]

    # DUAS PASSAGENS, e a segunda existe por causa do teto. Minimos quadrados nao
    # sabe do limite de GRADE_MAX; se um trecho sai acima dele e e simplesmente
    # cortado, o erro que ele carregava fica sem dono e os vizinhos continuam
    # onde estavam. Fixando os saturados e reajustando os restantes, o resto do
    # perfil ABSORVE o que o teto nao deixou passar.
    A = cols(ss)
    sol, *_ = np.linalg.lstsq(A, zs, rcond=None)
    g = np.clip(sol[1:], -GRADE_MAX, GRADE_MAX)
    sat = [k for k, i in enumerate(livres) if abs(sol[1 + k]) > GRADE_MAX]
    if sat:
        GRADES[:] = [0.0] * len(GRADES)
        for k, i in enumerate(livres):
            if k in sat:
                GRADES[i] = float(g[k])
        _GZ.clear()
        fixo = np.array([_grade_int(float(v)) for v in ss])
        A2 = np.c_[np.ones(len(ss)),
                   np.array([A[:, 1 + k] for k in range(len(livres)) if k not in sat]).T] \
            if len(sat) < len(livres) else np.c_[np.ones(len(ss))]
        sol2, *_ = np.linalg.lstsq(A2, zs - fixo, rcond=None)
        j = 0
        for k, i in enumerate(livres):
            if k in sat:
                continue
            GRADES[i] = float(np.clip(sol2[1 + j], -GRADE_MAX, GRADE_MAX))
            j += 1
        log(f"  {len(sat)} trecho(s) no teto de {GRADE_MAX*100:.1f} % — "
            f"perfil reajustado com eles fixos")
    else:
        GRADES[:] = [0.0] * len(GRADES)
        for k, i in enumerate(livres):
            GRADES[i] = float(g[k])
    GRADES[GRADE_FLAT_I] = 0.0
    _GZ.clear()
    build_alignment()
    prof = np.array([road_z(float(v)) for v in ss])
    z0 = float(np.mean(zs - prof))
    prof = prof + z0
    hit_here = bvh.ray_cast(Vector((0.0, 0.0, 900.0)), Vector((0, 0, -1)))
    log(f"  ajuste sobre {len(ss)} estacas: z0 {z0:.3f} m")
    log("  greides por trecho: " + "  ".join(
        f"[{GRADE_KNOTS[i]:+.0f}..{GRADE_KNOTS[i+1]:+.0f}] {GRADES[i]*100:+.2f}%"
        for i in range(len(GRADES))))
    if hit_here[0] is not None:
        log(f"  terreno no ponto do caminhao {hit_here[0].z:.3f} m  "
            f"=> corte de {hit_here[0].z-z0:+.2f} m ali")
    log(f"  desvio terreno-greide no eixo: rms {np.sqrt(np.mean((zs-prof)**2)):.2f} m  "
        f"max {np.abs(zs-prof).max():.2f} m")
    xe, ye, _, _ = align_at(LEN_F)
    xb, yb, _, _ = align_at(-LEN_B)
    log(f"  ponta da frente ({xe:+.1f}, {ye:+.1f})  heading "
        f"{math.degrees(align_at(LEN_F)[2]):+.1f} graus  |  "
        f"ponta de tras ({xb:+.1f}, {yb:+.1f})  heading "
        f"{math.degrees(align_at(-LEN_B)[2]):+.1f} graus")

    # `M @ o.matrix_world` E NAO SO `M`. Os 26 objetos da fonte nao estao na
    # origem: todos tem loc=(16,09, -1,66, 161,70), ou seja os dados da malha
    # estao 161,7 m abaixo do mundo. Transformar so os dados e depois zerar a
    # matriz do objeto DESCARTA esse deslocamento — e o resultado nao rebenta,
    # que e o perigo: a cena continua coerente consigo propria, so que 161,7 m
    # fora do sitio, e a terraplenagem passa a medir 194 m de aterro.
    M = Matrix.Translation(Vector((0.0, 0.0, -z0)))
    for o in bpy.data.objects:
        o.data.transform(M @ o.matrix_world)
        o.matrix_world = Matrix.Identity(4)
    json.dump(dict(z0=z0, grades=list(GRADES)),
              open(os.path.join(WORK, "profile.json"), "w"))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(WORK, "02_frame.blend"))
    log("  gravado 02_frame.blend")


def load_profile():
    """As etapas seguintes correm em processos novos — o greide vem do disco."""
    global GRADES, CATCH
    p = os.path.join(WORK, "profile.json")
    if os.path.exists(p):
        d = json.load(open(p))
        if 'grades' in d:
            GRADES[:] = [float(v) for v in d['grades']]
            _GZ.clear()
        if 'ts' in d:
            CATCH = (np.array(d['ts']), np.array(d['cut']), np.array(d['fill']))
        log("  greide lido do disco: " + " ".join(f"{v*100:+.2f}%" for v in GRADES))
    build_alignment()


CATCH = None


def catch_at(s, u):
    """largura da obra do lado em que `u` esta, na estaca `s`"""
    if CATCH is None:
        return CLEAR_CUT if u < 0 else CLEAR_FILL
    ts, cut, fil = CATCH
    return float(np.interp(s, ts, cut if u < 0 else fil))


def build_bvh(objs):
    verts, faces = [], []
    for o in objs:
        me, mw = o.data, o.matrix_world
        off = len(verts)
        verts += [mw @ v.co for v in me.vertices]
        for p in me.polygons:
            vs = list(p.vertices)
            for i in range(1, len(vs) - 1):
                faces.append((off + vs[0], off + vs[i], off + vs[i + 1]))
    return BVHTree.FromPolygons([tuple(v) for v in verts], faces, all_triangles=True)


# =========================================================================
# LAND — o avental de terreno, e por que ele e obrigatorio
# =========================================================================
LAND_R0 = 118.0              # onde o avental comeca a existir
LAND_BLEND = 96.0            # comprimento em que ele deixa de copiar a fonte
LAND_R1 = 1750.0             # ate onde vai
LAND_SECTORS = 144
SKYLINE_MIN = math.radians(1.15)   # elevacao minima da crista, vista da lente
EYE = (0.0, -19.0, 7.2)      # a lente do retrato traseiro, medida nas fotos


def stage_land():
    """Constroi o terreno que a fonte NAO TEM, e fecha o horizonte.

    O RELATO: *"esta ficando um espaco em branco na frente e atras"*. Nao e
    iluminacao nem bruma — e chao que acaba. Medido no `05_veg.blend` anterior,
    varrendo raios verticais numa grelha de 10 m:

        y 180..220  ->  2,8 % sem chao          y -140..-100  -> 38,2 %
        y 220..260  ->  8,5 %                   y -180..-140  -> 52,8 %
        y 260..300  -> 34,0 %                   y -220..-180  -> 85,8 %
        y 300..340  -> 65,1 %                   alem de -260  -> 100 %
        alem de 340 -> 100 %

    `Terrain_Far`, que e a casca de fundo da fonte, vai de y -176 a +335 e de
    x -299 a +273. Ou seja o cenario inteiro e uma placa de ~570 x 510 m com a
    borda a 200 m do caminhao — e a 200 m, numa lente de 40 graus, a borda cai
    DENTRO do quadro. O buraco branco das fotos e literalmente o fim do mundo.

    O AVENTAL NAO E UM DISCO PLANO. Ele e um campo de altura que:

      1. COPIA a fonte ate LAND_R0 e mistura por smoothstep ate LAND_R0+BLEND —
         a costura fecha porque nos primeiros 118 m o avental E o terreno da
         fonte, amostrado por raio vertical;
      2. continua o DECLIVE REGIONAL medido (ajuste de plano da propria fonte),
         para o vale nao virar planalto de repente;
      3. leva cristas em fBm ridged, que e o que da silhueta de serra em vez de
         duna;
      4. e ENTAO E CORRIGIDO POR MEDIDA. Para cada azimute, marcha-se o raio da
         lente e mede-se a maior elevacao angular da silhueta; onde ela nao
         chega a SKYLINE_MIN, uma crista suave e somada naquele setor ate
         chegar. Isso e o que garante que nao sobra buraco de ceu por baixo do
         horizonte — e a garantia e verificavel, nao estetica.

    A MALHA E POLAR e a celula cresce com o raio: 2,5 m no anel de dentro,
    ~55 m no de fora. Uma grelha cartesiana uniforme com a mesma resolucao perto
    custaria 1,2 milhao de quadrilateros para cobrir 3,5 km; a polar custa
    LAND_SECTORS x ~52 aneis.
    """
    log("LAND — construir o terreno que falta e fechar o horizonte")
    bpy.ops.wm.open_mainfile(filepath=os.path.join(WORK, "02_frame.blend"))
    load_profile()
    B = by_mat()
    # `Terrain_Far` FICA DE FORA DA SONDAGEM, e isto e a correcao de um degrau de
    # 8 m que o render mostrou como uma lasca verde-clara a 170 m, bem onde a
    # curva da frente comeca.
    # ---------------------------------------------------------------------
    # A fonte tem DUAS camadas de chao a alturas diferentes: o terreno detalhado
    # (`Aerial_Grass` e companhia), que acaba em y=132, e a casca de fundo
    # `Terrain_Far`, medida 8,21 m ABAIXO dele. Com a casca dentro da sondagem, o
    # avental copiava o detalhado enquanto ele existia e CAIA para a casca no
    # metro seguinte — um degrau vertical de 8 m no meio do quadro, com a barriga
    # do terreno detalhado exposta. Fora da sondagem, onde o detalhado acaba
    # entra `_h_perto`, que estende a cota do vizinho mais proximo.
    src = [B[m] for m in GROUND_MATS if m in B and m != 'Terrain_Far']
    bvh = build_bvh(src)

    # --- 1. declive regional, medido no que existe
    P = []
    for r in np.arange(30.0, 200.0, 12.0):
        for a in np.arange(0, 360, 15.0):
            x = r * math.cos(math.radians(a)); y = r * math.sin(math.radians(a))
            h = bvh.ray_cast(Vector((x, y, 900.0)), Vector((0, 0, -1)))
            if h[0] is not None:
                P.append((x, y, h[0].z))
    P = np.array(P)
    A = np.c_[P[:, 0], P[:, 1], np.ones(len(P))]
    (gx, gy, g0), *_ = np.linalg.lstsq(A, P[:, 2], rcond=None)
    log(f"  declive regional medido: {math.hypot(gx,gy)*100:.1f} % descendo para "
        f"{(math.degrees(math.atan2(-gy,-gx))) % 360:.0f} graus  "
        f"(sobre {len(P)} sondagens)")

    # --- 2. campo de altura
    def h_src(x, y):
        h = bvh.ray_cast(Vector((x, y, 900.0)), Vector((0, 0, -1)))
        if h[0] is not None:
            return h[0].z
        # SEM BATIDA: o terreno detalhado acabou. Marcha-se para DENTRO ate o
        # encontrar e devolve-se a cota dele — assim o avental sai da borda do
        # detalhado na mesma cota em vez de mergulhar. Sem isto, a mistura
        # arrancava do campo procedural, que nao conhece a corcova local, e a
        # emenda ficava um degrau de um a dois metros.
        r = math.hypot(x, y)
        if r < 1e-6:
            return None
        ux, uy = -x / r, -y / r
        d = 4.0
        while d < 70.0:
            hh = bvh.ray_cast(Vector((x + ux * d, y + uy * d, 900.0)),
                              Vector((0, 0, -1)))
            if hh[0] is not None:
                return hh[0].z
            d += 4.0
        return None

    def ridged(x, y, f, seed):
        return 1.0 - abs(fbm(x * f, y * f, oct_=3, seed=seed))

    RID = [0.0] * (LAND_SECTORS + 1)          # correcao por setor, passo 4

    def h_far(x, y):
        r = math.hypot(x, y)
        base = g0 + gx * x + gy * y
        # tres escalas de crista: a grande faz a serra, a media faz os contra-
        # fortes, a pequena tira a leitura de superficie matematica
        v = (58.0 * ridged(x, y, 1.0 / 1150.0, 1.0)
             + 22.0 * ridged(x, y, 1.0 / 430.0, 7.0)
             + 7.0 * fbm(x / 160.0, y / 160.0, oct_=3, seed=13.0))
        # a serra cresce com a distancia: perto ela seria uma parede
        k = min(1.0, max(0.0, (r - LAND_R0) / 900.0))
        a = math.atan2(y, x)
        j = (a % (2 * math.pi)) / (2 * math.pi) * LAND_SECTORS
        i0 = int(j) % LAND_SECTORS
        fj = j - int(j)
        add = RID[i0] * (1 - fj) + RID[(i0 + 1) % LAND_SECTORS] * fj
        bump = add * math.exp(-((r - 980.0) / 620.0) ** 2)
        return base + v * k * k + bump

    def height(x, y):
        r = math.hypot(x, y)
        hs = h_src(x, y)
        hf = h_far(x, y)
        if hs is None:
            return hf
        if r <= LAND_R0:
            return hs
        w = min(1.0, (r - LAND_R0) / LAND_BLEND)
        w = w * w * (3 - 2 * w)
        return hs * (1 - w) + hf * w

    # --- 3. a correcao medida da silhueta
    ex, ey, ez = EYE
    for it in range(3):
        pior = 0.0
        n_baixo = 0
        for i in range(LAND_SECTORS):
            a = (i + 0.5) / LAND_SECTORS * 2 * math.pi
            ca, sa = math.cos(a), math.sin(a)
            best = -9.9
            for r in np.arange(160.0, LAND_R1, 45.0):
                x = ex + ca * r
                y = ey + sa * r
                el = math.atan2(height(x, y) - ez, r)
                if el > best:
                    best = el
            if best < SKYLINE_MIN:
                n_baixo += 1
                falta = SKYLINE_MIN - best
                # quanto de crista falta a 980 m para levantar a silhueta
                RID[i] += falta * 980.0 * 1.25
                pior = max(pior, falta)
        log(f"  skyline passagem {it+1}: {n_baixo}/{LAND_SECTORS} setores abaixo de "
            f"{math.degrees(SKYLINE_MIN):.2f} graus  (pior {math.degrees(pior):.2f})")
        if not n_baixo:
            break
        # alisa a correcao, senao a serra vira serrote
        RID[:] = [(RID[(i - 1) % LAND_SECTORS] + 2 * RID[i % LAND_SECTORS]
                   + RID[(i + 1) % LAND_SECTORS]) / 4.0 for i in range(LAND_SECTORS + 1)]

    # --- 4. a malha polar
    # O ANEL DE DENTRO E FINO DE PROPOSITO. O corredor da frente termina em
    # (-50, +205), ou seja a 211 m da origem — ele passa POR CIMA do avental, e
    # `stage_grade` tem de o recortar. Recortar e por CENTRO DE FACE: com celula
    # de 15 m, uma face cujo centro caiu fora da obra ainda atravessa a pista
    # inteira. Ate 270 m a celula fica em 3 m, que e a ordem da malha da fonte;
    # so depois disso ela cresce, e ali ja nao ha nada a recortar.
    rs = [LAND_R0]
    while rs[-1] < LAND_R1:
        r = rs[-1]
        rs.append(r + (3.0 if r < 270.0 else max(3.0, r * 0.085)))
    rs = np.array(rs)
    nr, na = len(rs), LAND_SECTORS
    V, F, UV = [], [], []
    for ri, r in enumerate(rs):
        for ai in range(na):
            a = ai / na * 2 * math.pi
            x = float(r * math.cos(a)); y = float(r * math.sin(a))
            z = height(x, y)
            # 5 cm por baixo na faixa de mistura: o avental passa POR BAIXO do
            # que sobrou da fonte em vez de disputar profundidade com ele
            if r < LAND_R0 + LAND_BLEND:
                z -= 0.05
            V.append((x, y, z))
    for ri in range(nr - 1):
        for ai in range(na):
            a0 = ri * na + ai
            a1 = ri * na + (ai + 1) % na
            b0 = (ri + 1) * na + ai
            b1 = (ri + 1) * na + (ai + 1) % na
            F.append((a0, a1, b1, b0))
            for k in (a0, a1, b1, b0):
                UV.append((V[k][0] / 240.0, V[k][1] / 240.0))
    m_far = (B['Terrain_Far'].data.materials[0] if 'Terrain_Far' in B
             else _pbr('LAND_FAR', (0.42, 0.40, 0.33, 1), 0.95))
    o = _mk('LAND_APRON', m_far, V, F, UV)
    _face_up(o)
    _add_ao(o)
    log(f"  avental: {nr} aneis x {na} setores = {len(F)} quadrilateros, "
        f"de {LAND_R0:.0f} a {rs[-1]:.0f} m")

    # --- 5. a casca da fonte sai de onde o avental manda
    far = B.get('Terrain_Far')
    if far:
        doomed = [p.index for p in far.data.polygons
                  if math.hypot(p.center.x, p.center.y) > LAND_R0 + 4.0]
        if doomed:
            _del_faces(far, doomed)
        log(f"  Terrain_Far: -{len(doomed)} faces alem de {LAND_R0:.0f} m "
            f"(o avental assume dali)")

    # --- 6. medida de aceitacao, no mesmo raio das fotos
    bvh2 = build_bvh([x for x in bpy.data.objects
                      if x.type == 'MESH' and len(x.data.polygons)])
    buracos = 0
    total = 0
    for a in np.arange(0, 360, 2.0):
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        for el in (0.2, 0.6, 1.0, 1.6):
            d = Vector((ca, sa, math.tan(math.radians(el)))).normalized()
            total += 1
            if bvh2.ray_cast(Vector(EYE), d, 6000.0)[0] is None:
                buracos += 1
    log(f"  aceitacao: {buracos}/{total} raios da lente entre 0,2 e 1,6 graus "
        f"saem sem bater em nada ({100.0*buracos/total:.1f} %)")

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(WORK, "025_land.blend"))
    tri = sum(len(x.data.polygons) for x in bpy.data.objects if x.type == 'MESH')
    log(f"  gravado 025_land.blend  ({tri} poligonos)")


def _del_faces(o, idx):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.faces[i] for i in idx], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(o.data)
    bm.free()
    o.data.update()


def stage_grade():
    """RECORTA o corredor do terreno e devolve-o como geometria propria.

    A PRIMEIRA VERSAO DESLOCAVA OS VERTICES DO TERRENO, e ficou registada aqui
    porque falhou de um modo que so se ve a renderizar. A malha da fonte tem
    arestas de 0,9 a 2,8 m; puxar um vertice desses 8 ou 30 m para baixo nao
    cria um talude, cria um TRIANGULO ESTICADO de dezenas de metros com a
    textura esfregada ao longo dele — no render sairam chapas lisas e claras
    encostadas a estrada. Nao ha densidade para representar o talude, e nao
    havia como haver: a fonte nunca foi modelada para ser cortada.

    Alem disso o deslocamento poe as camadas de decalque (Rock_Decal,
    Grass_Close, Fallen_*) exatamente na mesma cota da plataforma — todas elas
    passam a ser `design_z` — e o resultado e o mosaico de manchas que apareceu
    no pavimento.

    A versao boa e a que a terraplenagem de verdade faz: REMOVE-SE o terreno
    dentro da obra e constroi-se a obra. As faces cujo centro cai dentro da
    linha de apanha sao apagadas e o corredor nasce com a sua propria malha,
    densidade autorada e um material por zona. Fora da apanha nao se toca em
    nada, e a costura fecha porque o anel exterior do corredor E a cota do
    terreno natural ali (menos 3 cm, para passar POR BAIXO do que sobrou em vez
    de disputar profundidade com ele).
    """
    log("GRADE — recortar o corredor e construir a terraplenagem")
    bpy.ops.wm.open_mainfile(filepath=os.path.join(WORK, "025_land.blend"))
    load_profile()
    B = by_mat()
    apron = bpy.data.objects.get('LAND_APRON')
    ground = [B[m] for m in GROUND_MATS if m in B]

    # `Terrain_Far` sai do calculo do terreno natural — ver `clean_far()`, que
    # corre no FIM, depois de a obra existir. O AVENTAL, esse, ENTRA: ele e a
    # unica superficie que existe alem de y ~130, que e onde a curva da frente
    # leva o corredor, e sem ele `z_nat` devolveria zero e a estrada acabaria
    # pendurada.
    det = [o for o in ground if mat_of(o) != 'Terrain_Far']
    if apron:
        det.append(apron)
    bvh_det = build_bvh(det)
    far = B.get('Terrain_Far')
    ground = det
    bvh = bvh_det

    def z_nat(x, y):
        h = bvh.ray_cast(Vector((x, y, 900.0)), Vector((0, 0, -1)))
        if h[0] is not None:
            return h[0].z
        h = bvh.ray_cast(Vector((x, y, -700.0)), Vector((0, 0, 1)))
        return h[0].z if h[0] is not None else 0.0

    # ---- estacas, agora em COMPRIMENTO DE ARCO
    ts = []
    t = -LEN_B
    while t <= LEN_F + 1e-6:
        ts.append(t)
        t += 1.0 if abs(t) < 70 else (2.0 if abs(t) < 130 else 4.0)
    ts = np.array(ts)

    # ---- linha de apanha, POR ESTACA E POR LADO, decidindo corte ou aterro
    #
    # A VARREDURA DIZIA "consistencia 1,00": em todas as estacas o terreno a
    # -17 m estava acima do greide e o a +17 m abaixo. Isso e VERDADE e mesmo
    # assim nao chega, e a diferenca custou tres rondas de render. A consistencia
    # foi medida a +-17 m sobre uma grelha de 4 m; a 9 ou 10 m do eixo, que e
    # onde o talude comeca, o terreno tem corcovas locais (o residuo depois do
    # ajuste de plano tem desvio padrao de 8,31 m). Medido no sitio: a +9,1 m o
    # terreno esta 3,8 m ACIMA do greide em y=39, e a +10,8 m esta 4,7 m acima em
    # y=29 — no lado que a seccao tratava como aterro. O resultado eram paredes
    # de terreno da fonte encostadas ao acostamento, penduradas sobre a pista.
    #
    # Logo o modo NAO se autora: mede-se a cota natural na aresta da banqueta e
    # e ela que decide. Corte de um lado e aterro do outro continua a ser o caso
    # comum, mas onde a encosta corcova o corte troca de lado sozinho — que e o
    # que uma seccao de transicao e numa estrada de verdade.
    catch, ditchw = {}, {}
    for side in (-1, 1):
        cs, dw = [], []
        for t in ts:
            t = float(t)
            cz = road_z(t)
            zv = cz + Z_VERGE_EDGE
            px, py = offset_xy(t, side * (X_VERGE + 0.8))
            over = z_nat(px, py) - zv
            w = float(np.clip(over / 1.2, 0.0, 1.0))     # quanta valeta se justifica
            d, lim = 0.0, MAX_BATTER
            while d < lim:
                d += 0.5
                qx, qy = offset_xy(t, side * (X_VERGE + d))
                zn = z_nat(qx, qy)
                zb = zn + (batter_z(zv, d, zn, 0.0, t, side) - zn) * end_fade(t)
                if abs(zb - zn) < 0.03:
                    break
            cs.append(min(d, lim))
            dw.append(w)
        catch[side] = smooth1d(np.array(cs), 5)
        ditchw[side] = smooth1d(np.array(dw), 7)
        log(f"  lado {'esquerdo (montante)' if side < 0 else 'direito (jusante)':<20}: "
            f"talude {catch[side].min():.1f}..{catch[side].max():.1f} m alem da banqueta "
            f"(media {catch[side].mean():.1f})  |  valeta media {ditchw[side].mean():.2f}")

    def cc(t):
        return X_VERGE + float(np.interp(t, ts, catch[-1]))

    def cf(t):
        return X_VERGE + float(np.interp(t, ts, catch[1]))

    # ---- densificar a malha junto da obra ANTES de a cortar
    #
    # O CORTE E POR CENTRO DE FACE, e sozinho isso nao chega: `Terrain_Far` tem
    # arestas de 10,8 m, entao uma face cujo centro caiu fora da apanha ainda
    # atravessa a obra INTEIRA e fica pendurada sobre o asfalto. Foi o que o
    # render mostrou — chapas de terreno a esvoacar nas bordas do corredor.
    #
    # A correcao nao e apagar mais (isso abriria buraco do outro lado), e ter
    # faces pequenas de modo a que "o centro esta dentro" e "a face esta dentro"
    # passem a querer dizer o mesmo. Duas passagens de subdivisao levam 10,8 m a
    # 2,7 m, que e a ordem do resto da malha; o erro de recorte desce ao tamanho
    # de uma face e a aba do corredor cobre-o.
    for o in ground:
        for _ in range(3):
            bm = bmesh.new()
            bm.from_mesh(o.data)
            cs_ = np.array([[f.calc_center_median().x, f.calc_center_median().y]
                            for f in bm.faces]) if len(bm.faces) else np.zeros((0, 2))
            big = set()
            if len(cs_):
                fs, fu = to_su_many(cs_[:, 0], cs_[:, 1])
                for i, f in enumerate(bm.faces):
                    if fs[i] < -LEN_B - 12 or fs[i] > LEN_F + 12:
                        continue
                    if abs(fu[i]) > 52:
                        continue
                    if max((e.calc_length() for e in f.edges), default=0) > 2.2:
                        big.update(f.edges)
            if big:
                bmesh.ops.subdivide_edges(bm, edges=list(big), cuts=1,
                                          use_grid_fill=True)
                bm.to_mesh(o.data)
            bm.free()
        o.data.update()
    log("  malha do terreno densificada junto da obra (aresta alvo 2,2 m)")

    # ---- apagar o terreno dentro da obra
    killed = kept = 0
    for o in ground:
        me = o.data
        if not len(me.polygons):
            continue
        C = np.array([[p.center.x, p.center.y] for p in me.polygons])
        fs, fu = to_su_many(C[:, 0], C[:, 1])
        doomed = []
        for i in range(len(fs)):
            if fs[i] < -LEN_B or fs[i] > LEN_F:
                continue
            if -cc(fs[i]) < fu[i] < cf(fs[i]):
                doomed.append(i)
        if doomed:
            _del_faces(o, doomed)
            killed += len(doomed)
        kept += len(me.polygons)
    log(f"  {killed} faces de terreno removidas da obra, {kept} intactas")

    # A APANHA VAI PARA O DISCO. `stage_veg` corre noutro processo e precisa
    # dela: a obra e que decide o que fica a flutuar, e a obra nao tem largura
    # constante — no aterro vai de 8,2 a 29,2 m do eixo. Uma zona de limpeza
    # autorada em metros fixos deixaria tufos pendurados sempre que a apanha
    # passasse dela, que foi o que o render mostrou.
    prof = json.load(open(os.path.join(WORK, "profile.json")))
    prof.update(ts=[float(v) for v in ts],
                cut=[X_VERGE + float(v) for v in catch[-1]],
                fill=[X_VERGE + float(v) for v in catch[1]])
    json.dump(prof, open(os.path.join(WORK, "profile.json"), "w"))

    build_corridor(ts, catch, ditchw, z_nat, B)
    band_clear(cc, cf)
    clean_far(far)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(WORK, "03_grade.blend"))
    tri = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
    log(f"  gravado 03_grade.blend  ({tri} poligonos)")


def final_ground():
    """BVH da superficie FINAL: o que sobrou do terreno mais as zonas do corredor."""
    objs = [o for o in bpy.data.objects if o.type == 'MESH' and len(o.data.polygons) and (
        (o.name == mat_of(o) and mat_of(o) in GROUND_MATS and mat_of(o) != 'Terrain_Far')
        or o.name in ('ROAD_PAVEMENT', 'ROAD_VERGE_L', 'ROAD_VERGE_R', 'ROAD_DITCH',
                      'BATTER_L', 'BATTER_R', 'LAND_APRON', 'FOREST_FLOOR_PATCH',
                      'ACCESS_TRACK'))]
    return build_bvh(objs)


def band_clear(cc, cf):
    """Apaga, em TUDO o que nao e chao nem corredor, as faces dentro da obra.

    Passagem generica de proposito. A limpeza por objeto (arvores, tufos) trata
    do que se sabe que existe; esta trata do que se esqueceu — e o que se
    esqueceu foi a `Wood_Fence` da fonte, que ficou a flutuar a 3,4 m do chao a
    8,5 m do eixo, dentro da faixa onde a terraplenagem levou o terreno que a
    suportava. Uma cerca de madeira pendurada sobre o acostamento de uma rodovia
    nova nao se justifica de nenhum modo, e o mesmo vale para toras e postes.
    """
    #
    # NAO TOCA EM ARVORES NEM EM TUFOS, e isso e uma correcao e nao um detalhe:
    # esta passagem apaga por FACE, e uma arvore cortada por face fica um tronco
    # partido a meio com meia copa em cima. Quem sabe apagar arvore e
    # `stage_veg`, que decide por ILHA e leva o tronco e a copa juntos. Medido
    # quando faltava esta guarda: -5 310 faces de `Trunk_Oak` e -15 887 de
    # `Background_Tree_Atlas`, todas a meio de arvores.
    keep = {'ROAD_PAVEMENT', 'ROAD_VERGE_L', 'ROAD_VERGE_R', 'ROAD_DITCH',
            'BATTER_L', 'BATTER_R'}
    skip = set(GROUND_MATS) | set(TREE_MATS) | set(CLUTTER_MATS)
    total = 0
    for o in bpy.data.objects:
        if o.type != 'MESH' or o.name in keep or mat_of(o) in skip:
            continue
        me = o.data
        if not len(me.polygons):
            continue
        C = np.array([[p.center.x, p.center.y] for p in me.polygons])
        fs, fu = to_su_many(C[:, 0], C[:, 1])
        doomed = []
        for i in range(len(fs)):
            if fs[i] < -LEN_B - 6 or fs[i] > LEN_F + 6:
                continue
            lim = (cc(fs[i]) if fu[i] < 0 else cf(fs[i])) + 1.5
            if abs(fu[i]) < lim:
                doomed.append(i)
        if doomed:
            _del_faces(o, doomed)
            total += len(doomed)
            log(f"  na obra: {o.name} -{len(doomed)} faces")
    log(f"  {total} faces avulsas removidas da obra")


def clean_far(far):
    """`Terrain_Far` perde as faces que furam a superficie final.

    CORRE NO FIM, e a ordem e o defeito que esta correcao emenda. Feita antes do
    corte, o teste comparava-a com o terreno detalhado que AINDA existia sobre a
    obra, dava "esta por baixo" e mantinha a face; depois a terraplenagem levava
    esse terreno e o talude de aterro descia, e a casca de fundo passava a
    aflorar 3 a 4 m acima do aterro, a 15-20 m do eixo. Era a chapa escura que o
    render mostrou a 50-70 m a frente, e o motivo pelo qual apagar `Terrain_Far`
    "por raio" nunca ia resolver: ela nao aflora onde esta perto, aflora onde a
    obra baixou o chao.

    MEDIDO na fonte: ate 30 m do caminhao ela esta 8,21 m abaixo do detalhado e
    nunca acima; alem de 100 m fura em 14 a 19% dos pontos, ate +41,8 m. E
    indispensavel como fundo — o terreno detalhado cobre 100% do anel 40-60 m
    mas 0% alem de 240 m —, logo o criterio tem de ser por face e nao por raio.
    """
    if not far:
        return
    bvh = final_ground()
    doomed = []
    for p in far.data.polygons:
        c = p.center
        h = bvh.ray_cast(Vector((c.x, c.y, 700.0)), Vector((0, 0, -1)))
        if h[0] is not None and c.z > h[0].z - 0.5:
            doomed.append(p.index)
    if doomed:
        bm = bmesh.new()
        bm.from_mesh(far.data)
        bm.faces.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[bm.faces[i] for i in doomed], context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
        bm.to_mesh(far.data)
        bm.free()
        far.data.update()
    log(f"  Terrain_Far: -{len(doomed)} faces que furavam a superficie final, "
        f"{len(far.data.polygons)} ficam como fundo")


END_FADE = 32.0                          # comprimento em que a obra se dissolve


def end_fade(t):
    """1 no corpo da obra, 0 nas pontas — a terraplenagem tem de ACABAR.

    Sem isto o corredor termina numa PAREDE VERTICAL: o talude esta a varios
    metros da cota natural em y=+-175 e a malha simplesmente para, deixando uma
    face de topo em pe. No render era uma laje verde a flutuar no horizonte,
    vista de perfil a 175 m.

    O amortecimento e aplicado a TUDO (pavimento, banqueta e talude) e nao so ao
    talude, e tem de ser: fazer o talude voltar ao terreno e deixar a plataforma
    na cota de projeto poria a estrada a flutuar ate cinco metros no ar na ponta
    (e o desvio maximo medido entre greide e terreno no eixo). Ao amortecer os
    tres juntos, a estrada mergulha no terreno e desaparece — que e o que uma
    estrada faz ao passar uma lombada, e o que as arvores e a bruma do app
    acabam de esconder.
    """
    lim = LEN_F if t >= 0 else LEN_B
    a = (abs(t) - (lim - END_FADE)) / END_FADE
    if a <= 0.0:
        return 1.0
    if a >= 1.0:
        return 0.0
    a = 1.0 - a
    return a * a * (3 - 2 * a)


def batter_z(zv, d, zn, ditch_w=1.0, s=0.0, side=-1):
    """Cota de projeto a `d` metros da aresta da banqueta. UMA formula, sem modo.

    A versao anterior escolhia entre "corte" e "aterro" por estaca e por lado, e
    isso partiu-se onde tinha de se partir: a escolha e DISCRETA, e onde ela
    trocava entre duas estacas vizinhas o talude mudava de forma de uma vez (a
    valeta aparecia, o sentido invertia) e os quadrilateros entre as duas
    ficavam uma cortina de faces esticadas. Via-se no render como um leque
    escuro encostado ao acostamento.

    A forma certa nao escolhe — LIMITA. Toma-se o terreno natural e aperta-se
    entre duas rectas:

        z = min( max(z_natural, recta de aterro), recta de corte )

    Onde o terreno esta acima da recta de corte, corta-se; onde esta abaixo da
    de aterro, aterra-se; entre as duas fica o terreno como esta. As duas rectas
    sao continuas em `d` e em `t`, logo a superficie tambem e, e a transicao
    corte-aterro passa a ser o que e numa estrada de verdade: um sitio onde o
    talude vai afinando ate desaparecer, e nao uma emenda.

    A valeta segue o mesmo principio: a profundidade dela e proporcional a
    quanto se cortou (`ditch_w`), entao nasce e morre suavemente em vez de
    aparecer inteira na estaca em que o modo trocava.

    ===================================================================
    O QUE MUDOU NESTA RODADA, e por que a formula ganhou `s` e `side`.
    ===================================================================
    O relato diz *"a elevacao que da ate a estrada esta muito generica, muito
    falsa"* e a razao e geometrica: com UMA inclinacao para toda a obra, o
    talude e uma superficie regrada de geratriz constante — a mesma reta
    varrida 400 m. Nao ha textura que salve uma forma dessas, porque o que
    denuncia e a SILHUETA contra o ceu, que sai perfeitamente recta.

    Tres correcoes, todas de forma:

      1. INCLINACAO POR ESTACA (`slope_of`), com ruido de periodo ~48 m. Como a
         apanha e por min/max, mudar a inclinacao muda TAMBEM onde o talude
         morre — a linha de apanha ganha reentrancias em vez de acompanhar a
         estrada.
      2. BANQUETA DE TALUDE onde o corte passa de BERM_AT. E o que uma serra faz
         de verdade (corte alto sem banqueta nao se sustenta), e visualmente e o
         que quebra a face unica em duas com um degrau no meio.
      3. ARREDONDAMENTO da crista do corte e do pe do aterro. Uma aresta viva
         entre o talude e o terreno natural nao existe na natureza nem depois de
         uma escavadeira: a crista sempre desmorona um pouco. Sem ela a
         interseccao le como corte de faca — e era exatamente o que se via.
    """
    cut_k = slope_of(s, -1) if side < 0 else CUT_SLOPE
    fill_k = slope_of(s, 1) if side > 0 else FILL_SLOPE
    d_eff = max(0.0, d - DITCH_W)
    # banqueta: acima de BERM_AT de altura o talude anda BERM_W na horizontal
    h = d_eff / max(1e-3, cut_k)
    if h > BERM_AT:
        n_berm = int((h - BERM_AT) / max(1.0, BERM_AT)) + 1
        d_eff = max(0.0, d_eff - n_berm * BERM_W)
    z_fill = zv - d / fill_k
    z_cut = zv + d_eff / cut_k
    z = min(max(zn, z_fill), z_cut)
    # ARREDONDAMENTO: perto do ponto em que o talude apanha o terreno, mistura
    # com a cota natural em vez de cruzar em aresta viva.
    gap_cut = z_cut - zn
    if gap_cut > 0.0 and gap_cut < ROUND_TOP:
        w = gap_cut / ROUND_TOP
        w = w * w * (3 - 2 * w)
        z = zn + (z - zn) * w
    gap_fill = zn - z_fill
    if gap_fill > 0.0 and gap_fill < ROUND_TOE:
        w = gap_fill / ROUND_TOE
        w = w * w * (3 - 2 * w)
        z = zn + (z - zn) * w
    if ditch_w > 0.0 and d <= DITCH_W:
        f = d / DITCH_W
        z -= DITCH_D * ditch_w * (1.0 - abs(2.0 * f - 1.0))
    return z


def smooth1d(a, r):
    """A apanha e medida por raycast e vem serrilhada — o terreno da fonte tem
    pedras e decalques que fazem a marcha parar um metro antes ou depois. Uma
    linha de apanha serrilhada le como recorte de tesoura; uma alisada le como
    talude. O raio e pequeno de proposito: alisar de mais devolveria a reta
    paralela a estrada que a apanha por min/max existe para evitar."""
    k = np.ones(2 * r + 1) / (2 * r + 1)
    return np.convolve(np.pad(a, r, mode='edge'), k, 'valid')


def _mk(name, mat, verts, faces, uvs):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    uvl = me.uv_layers.new(name='UVMap')
    k = 0
    for p in me.polygons:
        for _ in p.loop_indices:
            uvl.data[k].uv = uvs[k]
            k += 1
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    for p in me.polygons:
        p.use_smooth = False
    return o


def _face_up(o):
    """Vira para cima as faces que sairam de costas.

    As zonas sao geradas como grelha (estaca x no da seccao), e no lado ESQUERDO
    o indice da coluna anda em -x: o produto vetorial inverte-se e a normal
    aponta para baixo. Com face culling isso e um BURACO — no render era um
    retangulo preto encostado a banqueta esquerda, que parecia geometria em
    falta e nao geometria virada. Testar `normal.z` e suficiente aqui porque
    estas malhas sao folhas de chao: nenhuma delas tem face que deva olhar para
    baixo.
    """
    bm = bmesh.new()
    bm.from_mesh(o.data)
    flip = [f for f in bm.faces if f.normal.z < 0]
    if flip:
        bmesh.ops.reverse_faces(bm, faces=flip)
        bm.to_mesh(o.data)
    bm.free()
    o.data.update()
    return len(flip)


def _pbr(name, base=(0.5, 0.5, 0.5, 1), rough=0.9, metal=0.0, cull=True):
    """Material liso, SEM mapas — e de proposito.

    O pavimento, a banqueta e a sinalizacao sao ligados em tempo de execucao
    pelo `materials` do manifesto (`bindMaterials()` em set.ts), que monta o
    conjunto PBR de /textures sobre o nome do material. Trazer mapas no .glb
    seria carregar duas vezes o asfalto que o app ja serve — e o
    `repeatNote` do distrito-industrial explica o resto do contrato: a UV vem em
    METROS a dividir por UV_M, e o periodo do ladrilho passa a ser UV_M/repeat.
    """
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = base
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    m.blend_method = 'OPAQUE'
    # Culling so no que este ficheiro gera: `_face_up()` garante o enrolamento
    # das folhas de chao. Nas malhas da fonte fica desligado — winding
    # inconsistente com culling ligado abre buraco, e nao ha como verificar 26
    # malhas a olho.
    #
    # `cull=False` E PARA A DEFENSA, e e um defeito que quase passou. Os panos do
    # W sao gerados percorrendo +t e depois subindo, o que da normal em +X — ou
    # seja apontada para FORA da pista. Com culling ligado a defensa desaparecia
    # vista de dentro da estrada, que e de onde ela e olhada quase sempre; so
    # aparecia de fora, que foi por acaso o angulo da miniatura. Um pano de
    # defensa e chapa fina e tem de ser visto dos dois lados de qualquer modo.
    m.use_backface_culling = bool(cull)
    return m


def _add_ao(o, per_row=None):
    """Poe no objeto o atributo de cor 'AO' que os materiais da fonte MULTIPLICAM.

    ISTO NAO E ENFEITE, E UMA CORRECAO DE MATERIAL PRETO. Dez materiais da fonte
    (`Sloped_Rock`, `Grass_Close`, `Aerial_Grass`, `Ground_Dirt`, ...) tem o
    albedo ligado a um `Mix` MULTIPLY entre a textura e um no VERTEX_COLOR de
    camada 'AO'. Numa malha que NAO tem essa camada o no devolve preto, e
    preto vezes textura e preto: os taludes do corredor — que reutilizam esses
    materiais de proposito, para casarem com o terreno ao lado — sairam pretos
    no render.

    O valor nao e branco chapado. `per_row` da, por no da seccao, um fator de
    oclusao: o fundo da valeta e o pe do talude ficam a ~0,7 e abrem para 1,0
    ao subir. E o que um mapa de AO teria ali (canto concavo), custa nada, e e o
    que impede o talude de ler como cartolina recortada.
    """
    me = o.data
    ca = me.color_attributes.get('AO') or me.color_attributes.new(
        name='AO', type='FLOAT_COLOR', domain='CORNER')
    n = len(me.loops)
    buf = np.ones(n * 4, dtype=np.float32)
    if per_row is not None:
        cols = len(per_row)
        for li, lp in enumerate(me.loops):
            v = lp.vertex_index % cols
            f = per_row[v]
            buf[li * 4:li * 4 + 3] = f
    ca.data.foreach_set('color', buf)
    me.update()
    try:
        me.color_attributes.active_color = ca
        me.color_attributes.render_color_index = list(me.color_attributes).index(ca)
    except Exception:
        pass


def _zone_mesh(name, mat, ts, rows, uv_rows):
    """rows[i] = lista de (x, y, z) da estaca i; todas com o mesmo comprimento.

    AS LINHAS PASSARAM A TRAZER X E Y. Com o eixo curvo nao existe mais "a
    coordenada X da estaca": cada no e um ponto do referencial de Frenet, e quem
    o calcula e `offset_xy`. A coordenada V da UV continua a ser o COMPRIMENTO DE
    ARCO — que e o que mantem o ladrilho do asfalto com o mesmo passo dentro e
    fora da curva. Usar `y` ali encurtaria o ladrilho conforme a estrada virasse,
    e o pavimento pareceria encolher na curva.
    """
    n = len(rows[0])
    V, F, UV = [], [], []
    for i, t in enumerate(ts):
        for (x, y, z) in rows[i]:
            V.append((x, y, z))
    for i in range(len(ts) - 1):
        for j in range(n - 1):
            a = i * n + j
            F.append((a, a + 1, a + n + 1, a + n))
            UV += [(uv_rows[i][j], ts[i] / UV_M), (uv_rows[i][j + 1], ts[i] / UV_M),
                   (uv_rows[i + 1][j + 1], ts[i + 1] / UV_M), (uv_rows[i + 1][j], ts[i + 1] / UV_M)]
    o = _mk(name, mat, V, F, UV)
    _face_up(o)
    return o


def build_corridor(ts, catch, ditchw, z_nat, B):
    """Constroi o corredor com topologia REGULAR e material por QUANTO se mexeu.

    A largura do talude muda de estaca para estaca — e o que a apanha significa —
    mas o NUMERO de nos por estaca e fixo: distribuem-se proporcionalmente entre
    a banqueta e a apanha. A grelha fica regular e a densidade adapta-se sozinha.

    O material nao vem do lado nem de um modo autorado, vem da MEDIDA: cada
    quadrilatero compara a cota de projeto com a natural e fica rocha se ali se
    escavou, grama se ali se aterrou ou se nao se mexeu. Sao dois slots no mesmo
    objeto e o exportador glTF separa-os em primitivas — sem objeto a mais e sem
    textura nova, porque os dois materiais sao os da propria fonte
    (`Sloped_Rock`, `Grass_Close`), o que faz o talude casar com o terreno que
    fica encostado a ele.
    """
    m_asf = _pbr('ROAD_ASPHALT', (0.16, 0.16, 0.17, 1), 0.93)
    m_grv = _pbr('ROAD_VERGE_GRAVEL', (0.36, 0.34, 0.31, 1), 0.96)
    m_rock = (B['Sloped_Rock'].data.materials[0] if 'Sloped_Rock' in B
              else _pbr('CUT_ROCK', (0.34, 0.32, 0.30, 1), 0.88))
    m_grass = (B['Grass_Close'].data.materials[0] if 'Grass_Close' in B
               else _pbr('FILL_GRASS', (0.22, 0.28, 0.14, 1), 0.92))
    m_cliff = (B['Tall_Cliff'].data.materials[0] if 'Tall_Cliff' in B else m_rock)

    NB = 18

    def run(pts, scale):
        acc = [0.0]
        for k in range(1, len(pts)):
            acc.append(acc[-1] + math.dist(pts[k], pts[k - 1]))
        return [v / scale for v in acc]

    pav, uv_pav = [], []
    ver = {-1: [], 1: []}; uv_ver = {-1: [], 1: []}
    bat = {-1: [], 1: []}; uv_bat = {-1: [], 1: []}
    dig = {-1: [], 1: []}          # quanto se escavou em cada no, para o material

    for i, t in enumerate(ts):
        t = float(t)
        cz = road_z(t)
        zv = cz + Z_VERGE_EDGE
        ef = end_fade(t)
        cx0, cy0 = offset_xy(t, 0.0)
        zc0 = z_nat(cx0, cy0)

        def lay(u):
            """cota da plataforma a `u` do eixo, ja amortecida na ponta"""
            return zc0 + (cz + cross_z(u) + PAVE_LIFT - zc0) * ef

        def P(u, dz=0.0):
            x, y = offset_xy(t, u)
            return (x, y, lay(u) + dz)

        # A BORDA DO PAVIMENTO NAO E UMA RETA, e este e o unico ponto do arquivo
        # em que uma coisa e deslocada so para nao parecer desenhada. Um bordo de
        # asfalto de verdade tem a largura variando alguns centimetros por causa
        # de como a vibroacabadora anda, e tem mordidas onde o acostamento cedeu.
        # 12 cm de ondulacao lenta mais mordidas ocasionais de ate 35 cm.
        edge_l = -X_SHLD - 0.12 * fbm(t * 0.05, -3.0, oct_=2, seed=2.0) \
            - 0.35 * max(0.0, fbm(t * 0.013, 9.0, oct_=1, seed=4.0) - 0.55)
        edge_r = X_SHLD + 0.12 * fbm(t * 0.05, 3.0, oct_=2, seed=6.0) \
            + 0.35 * max(0.0, fbm(t * 0.013, -9.0, oct_=1, seed=8.0) - 0.55)

        row = [P(edge_l), P(-X_LANE), P(-X_LANE / 2), P(0.0),
               P(X_LANE / 2), P(X_LANE), P(edge_r)]
        pav.append(row); uv_pav.append(run(row, UV_M))
        for side in (-1, 1):
            ue = edge_r if side > 0 else -edge_l
            r = [P(side * ue), P(side * (ue + (X_VERGE - X_SHLD) * 0.55)),
                 P(side * X_VERGE)]
            ver[side].append(r); uv_ver[side].append(run(r, UV_M))
            w = float(np.interp(t, ts, catch[side]))
            dw = float(np.interp(t, ts, ditchw[side]))
            rb, dg = [], []
            for k in range(NB + 1):
                f = k / NB
                d = f * max(w, 0.5)
                x, y = offset_xy(t, side * (X_VERGE + d))
                zn = z_nat(x, y)
                z = zn + (batter_z(zv, d, zn, dw, t, side) - zn) * ef
                # RELEVO PROPRIO DO TALUDE. Amplitude zero na aresta da banqueta
                # (a plataforma tem de ficar limpa) e no pe (senao a linha de
                # apanha fica serrilhada), maxima no meio. No ATERRO o ruido e
                # esticado no sentido da descida — periodo curto atravessado, longo
                # ao longo da estrada — e e isso que le como sulco de erosao.
                env = math.sin(math.pi * min(1.0, f)) ** 1.4
                if side > 0:
                    n = fbm(t * 0.11, d * 0.62, oct_=3, seed=21.0)
                else:
                    n = fbm(t * 0.07, d * 0.30, oct_=3, seed=33.0)
                z += BATTER_NOISE * env * ef * n
                rb.append((x, y, z)); dg.append(zn - z)
            for extra in SKIRT:        # aba: passa POR BAIXO do que sobrou
                x, y = offset_xy(t, side * (X_VERGE + w + extra))
                rb.append((x, y, z_nat(x, y) - 0.03)); dg.append(0.0)
            bat[side].append(rb); dig[side].append(dg)
            uv_bat[side].append(run(rb, UV_M_ROCK))

    pave = _zone_mesh('ROAD_PAVEMENT', m_asf, ts, pav, uv_pav)
    paint_pavement(pave, ts)
    for side, nm in ((-1, 'ROAD_VERGE_L'), (1, 'ROAD_VERGE_R')):
        _add_ao(_zone_mesh(nm, m_grv, ts, ver[side], uv_ver[side]))
    # oclusao por no do talude: escuro no pe (valeta / encontro com a banqueta),
    # abrindo para 1,0 no primeiro terco da subida
    nnodes = NB + 1 + len(SKIRT)
    ao_row = [min(1.0, 0.70 + 0.30 * min(1.0, (k / max(1, NB)) / 0.33))
              for k in range(nnodes)]
    nrock = ncliff = ngrass = 0
    for side, nm in ((-1, 'BATTER_L'), (1, 'BATTER_R')):
        o = _zone_mesh(nm, m_rock, ts, bat[side], uv_bat[side])
        _add_ao(o, ao_row)
        o.data.materials.append(m_grass)
        o.data.materials.append(m_cliff)
        n = len(bat[side][0]) - 1
        for i in range(len(ts) - 1):
            for j in range(n):
                d4 = (dig[side][i][j] + dig[side][i][j + 1] +
                      dig[side][i + 1][j] + dig[side][i + 1][j + 1]) / 4.0
                if d4 > DEEP_ROCK:
                    # TERCEIRA ZONA: onde a escavacao passa de DEEP_ROCK ja nao e
                    # solo alterado, e macico — e `Tall_Cliff` da fonte e a
                    # textura que tem estratificacao. Sem esta faixa o corte de
                    # 8 m tinha a MESMA cara do de 0,5 m, que e metade do
                    # "generico" do relato.
                    o.data.polygons[i * n + j].material_index = 2
                    ncliff += 1
                elif d4 > 0.35:
                    nrock += 1
                else:
                    o.data.polygons[i * n + j].material_index = 1
                    ngrass += 1
    log(f"  corredor: pavimento, 2 banquetas e 2 taludes  "
        f"({nrock} faces em rocha, {ncliff} em macico, {ngrass} em grama)")


def paint_pavement(o, ts):
    """Pinta o desgaste do asfalto em COLOR_0 — sem textura nova, sem draw call.

    O glTF multiplica COLOR_0 no baseColor e o `GLTFLoader` liga
    `vertexColors:true` sozinho, entao um atributo de cor por vertice e um mapa
    de sujeira de graça: zero bytes de imagem, zero material a mais, e ele
    sobrevive ao `bindMaterials()` do manifesto porque o manifesto so troca
    MAPAS.

    O que ele desenha, e por que cada um:

      · TRILHA DE RODA. Duas faixas a 0,9 m do eixo de cada faixa de rolamento,
        um pouco mais CLARAS e nao mais escuras — o pneu pole o agregado e o
        ligante sai; asfalto rodado e mais claro que asfalto novo. E o detalhe
        que mais depressa faz uma pista parecer usada.
      · MANCHA CENTRAL. Entre as trilhas fica o oleo e a borracha, mais escuro.
      · BORDO SUJO. Os ultimos 40 cm do acostamento recebem terra que desce do
        talude e brita que sai da banqueta.
      · REMENDOS. Manchas de baixa frequencia, mais escuras, com borda dura —
        e o recapeamento local que toda rodovia de serra tem.
    """
    me = o.data
    ca = me.color_attributes.get('AO') or me.color_attributes.new(
        name='AO', type='FLOAT_COLOR', domain='CORNER')
    n = len(me.loops)
    buf = np.ones(n * 4, dtype=np.float32)
    co = np.zeros(len(me.vertices) * 3, dtype=np.float32)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    S, U = to_su_many(co[:, 0].astype(np.float64), co[:, 1].astype(np.float64))
    for li, lp in enumerate(me.loops):
        vi = lp.vertex_index
        s, u = float(S[vi]), float(U[vi])
        a = abs(u)
        v = 1.0
        # AMPLITUDES DOBRADAS em relacao a primeira versao. Aquela usava 0,085 na
        # trilha e 0,11 no remendo, e a bancada nao mostrou nada: sob um sol de
        # 17h45 e com o macro do manifesto por cima, 8 % de variacao no albedo
        # desaparece. O que se ve numa foto de rodovia e um contraste bem maior
        # entre a trilha polida e o resto, e e ele que faz a pista parecer rodada.
        # trilha de roda: centro da faixa a ~1,75 m, rodado a +-0,9 m dali
        for c in (0.92, 2.62):
            v += 0.17 * math.exp(-((a - c) / 0.46) ** 2)
        v -= 0.10 * math.exp(-(a / 0.60) ** 2)            # mancha de eixo
        if a > X_LANE + 0.30:                              # acostamento menos rodado
            v -= 0.07 * min(1.0, (a - X_LANE - 0.30) / 1.2)
        if a > X_SHLD - 0.60:                              # bordo sujo
            v -= 0.26 * min(1.0, (a - (X_SHLD - 0.60)) / 0.60)
        p = fbm(s * 0.035, u * 0.12, oct_=2, seed=41.0)
        v -= 0.20 * max(0.0, p - 0.30)                     # remendo
        v += 0.06 * fbm(s * 0.4, u * 0.9, oct_=2, seed=57.0)
        buf[li * 4:li * 4 + 3] = max(0.48, min(1.20, v))
    ca.data.foreach_set('color', buf)
    me.update()
    try:
        me.color_attributes.active_color = ca
        me.color_attributes.render_color_index = list(me.color_attributes).index(ca)
    except Exception:
        pass
    log("  pavimento: trilha de roda, mancha de eixo, bordo sujo e remendos em COLOR_0")


def stage_road():
    log("ROAD — plataforma, sinalizacao, tachas e defensa")
    bpy.ops.wm.open_mainfile(filepath=os.path.join(WORK, "03_grade.blend"))
    load_profile()

    # a plataforma ja veio do GRADE junto com os taludes — aqui so entra o que
    # assenta SOBRE ela, e por isso tudo leva PAVE_LIFT + DECAL_LIFT
    m_yel = _pbr('ROAD_MARK_YELLOW', (0.62, 0.44, 0.05, 1), 0.62)
    m_wht = _pbr('ROAD_MARK_WHITE', (0.74, 0.73, 0.70, 1), 0.62)
    m_std = _pbr('ROAD_STUD', (0.80, 0.80, 0.78, 1), 0.28, 0.15)
    m_rail = _pbr('GUARDRAIL_STEEL', (0.55, 0.56, 0.57, 1), 0.42, 0.90, cull=False)

    m_post = _pbr('ROAD_DELINEATOR', (0.78, 0.77, 0.74, 1), 0.55)

    # ---- estacas: densas na tangente, esparsas nas pontas
    ts = []
    t = -LEN_B
    while t <= LEN_F + 1e-6:
        ts.append(t)
        t += 1.0 if abs(t) < 70 else (2.0 if abs(t) < 130 else 4.0)
    ts = np.array(ts)

    def deck(t, u, lift=PAVE_LIFT + DECAL_LIFT):
        x, y = offset_xy(t, u)
        return (x, y, road_z(t) + cross_z(u) + lift)

    # ---- sinalizacao horizontal
    #
    # A MARCACAO GANHOU DESGASTE, e ele nao e cosmetico: uma faixa contínua
    # perfeita de 400 m e o item que mais grita "modelo" numa foto de rodovia.
    # `wear` mede, por estaca, um ruido lento; onde ele passa do limiar a faixa
    # simplesmente NAO E EMITIDA naquele trecho — que e como uma faixa apagada
    # se comporta de verdade (some em pedaços, nao esmaece por igual).
    def stripe(u_c, w, mat, name, dash=None, wear=0.0, seed=0.0):
        V, F, UV = [], [], []
        n = 0
        for i in range(len(ts) - 1):
            t0, t1 = float(ts[i]), float(ts[i + 1])
            if dash:
                per, on = dash
                if (t0 % per) > on:
                    continue
            if wear > 0.0 and fbm(t0 * 0.028, seed, oct_=2, seed=seed) > (1.0 - wear) * 1.15:
                continue
            for tt in (t0, t1):
                for u in (u_c - w / 2, u_c + w / 2):
                    V.append(deck(tt, u))
            a = n * 4
            F.append((a, a + 1, a + 3, a + 2))
            UV += [(0, t0 / 4), (1, t0 / 4), (1, t1 / 4), (0, t1 / 4)]
            n += 1
        return _mk(name, mat, V, F, UV) if n else None

    stripe(-0.10, 0.10, m_yel, 'ROAD_MARK_CENTER_L', wear=0.10, seed=1.0)
    stripe(+0.10, 0.10, m_yel, 'ROAD_MARK_CENTER_R', wear=0.10, seed=1.6)
    stripe(-(X_LANE - 0.06), 0.12, m_wht, 'ROAD_MARK_EDGE_L', wear=0.22, seed=3.0)
    stripe(+(X_LANE - 0.06), 0.12, m_wht, 'ROAD_MARK_EDGE_R', wear=0.22, seed=5.0)

    # ---- tachas refletivas: quadrados de 10 cm sobre os bordos
    V, F, UV = [], [], []
    n = 0
    for t in np.arange(-LEN_B, LEN_F, 12.0):
        for sgn in (-1, 1):
            u = sgn * (X_LANE + 0.12)
            x, y, z = deck(float(t), u, PAVE_LIFT + DECAL_LIFT + 0.008)
            _, _, _, nx, ny = frame_at(float(t))
            tx, ty = -ny, nx
            for du, dt in ((-0.05, -0.05), (0.05, -0.05), (0.05, 0.05), (-0.05, 0.05)):
                V.append((x + nx * du + tx * dt, y + ny * du + ty * dt, z))
            a = n * 4
            F.append((a, a + 1, a + 2, a + 3))
            UV += [(0, 0), (1, 0), (1, 1), (0, 1)]
            n += 1
    _mk('ROAD_STUDS', m_std, V, F, UV)

    # ---- defensa metalica: SO ONDE O ATERRO PEDE, e com terminais
    #
    # A versao anterior corria de -118 a +118 sem interrupcao, 236 m de perfil W
    # identico. Isso e metade do *"muito padronizada"* do relato — e tambem esta
    # errado como engenharia: defensa se poe onde ha o que proteger. Aqui a
    # regra e medida no proprio corredor: altura de aterro na aresta da banqueta
    # maior que RAIL_MIN_H. Trechos curtos sao costurados e trechos minusculos
    # descartados, senao o resultado e uma fileira de retalhos.
    ground = final_ground()

    def fill_h(t, side):
        """quanto o terreno natural esta ABAIXO da aresta da banqueta, deste lado"""
        x, y = offset_xy(t, side * (X_VERGE + 3.0))
        h = ground.ray_cast(Vector((x, y, 900.0)), Vector((0, 0, -1)))
        if h[0] is None:
            return 0.0
        return (road_z(t) + Z_VERGE_EDGE) - h[0].z

    RAIL_MIN_H = 1.25
    step = 2.0
    tt = np.arange(-LEN_B + 6, LEN_F - 6, step)

    def trechos(side):
        """Costura os pontos que pedem defensa em trechos utilizaveis.

        O LADO E MEDIDO, NAO AUTORADO, e essa e a correcao de uma suposicao que a
        versao anterior fazia em silencio: a defensa estava cravada em +X porque
        `+X e o lado do aterro`. Com o traçado curvo isso deixou de ser verdade em
        parte do percurso — a curva entra na encosta e troca qual lado esta em
        aterro. Uma defensa do lado do CORTE nao protege de nada, e ainda esconde
        o talude que a cena precisa mostrar.
        """
        need = np.array([fill_h(float(v), side) > RAIL_MIN_H for v in tt])
        runs, i = [], 0
        while i < len(need):
            if not need[i]:
                i += 1
                continue
            j = i
            while j + 1 < len(need) and need[j + 1]:
                j += 1
            runs.append([i, j])
            i = j + 1
        merged = []
        for r in runs:
            # vao curto entre dois trechos: costura. Uma defensa que para e
            # recomeca a 15 m nao existe em obra — ou passa, ou nao passa.
            if merged and (r[0] - merged[-1][1]) * step < 26.0:
                merged[-1][1] = r[1]
            else:
                merged.append(r)
        return [(float(tt[a]), float(tt[b])) for a, b in merged
                if (b - a) * step >= 28.0]

    V, F, UV = [], [], []
    nq = 0

    def quad(p0, p1, p2, p3):
        nonlocal nq
        V.extend([p0, p1, p2, p3])
        a = nq * 4
        F.append((a, a + 1, a + 2, a + 3))
        UV.extend([(0, 0), (1, 0), (1, 1), (0, 1)])
        nq += 1

    TERM = 6.0                       # comprimento do terminal que mergulha
    por_lado = {}
    for side in (-1, 1):
        segs = trechos(side)
        por_lado[side] = segs
        for (s0, s1) in segs:
            rts = np.arange(s0, s1 + 0.01, 2.0)

            def hgt(t, a=s0, b=s1):
                """no terminal a defensa desce ate ao chao — e o que um terminal e"""
                d = min(t - a, b - t)
                return 1.0 if d > TERM else max(0.0, d / TERM) ** 0.8

            for i in range(len(rts) - 1):
                t0, t1 = float(rts[i]), float(rts[i + 1])
                p0 = deck(t0, side * (X_VERGE - 0.55), PAVE_LIFT)
                p1 = deck(t1, side * (X_VERGE - 0.55), PAVE_LIFT)
                k0, k1 = hgt(t0), hgt(t1)
                for (h0, h1) in ((0.52, 0.68), (0.68, 0.84)):
                    quad((p0[0], p0[1], p0[2] + h0 * k0),
                         (p1[0], p1[1], p1[2] + h0 * k1),
                         (p1[0], p1[1], p1[2] + h1 * k1),
                         (p0[0], p0[1], p0[2] + h1 * k0))
            for t in np.arange(s0 + 2, s1 - 1.9, 4.0):
                t = float(t)
                k = hgt(t)
                if k < 0.25:
                    continue
                x, y, z = deck(t, side * (X_VERGE - 0.49), PAVE_LIFT)
                _, _, _, nx, ny = frame_at(t)
                tx, ty = -ny, nx
                for (du, dt) in ((0.0, 0.05), (0.05, 0.0)):
                    quad((x - nx * du - tx * dt, y - ny * du - ty * dt, z - 0.55),
                         (x + nx * du + tx * dt, y + ny * du + ty * dt, z - 0.55),
                         (x + nx * du + tx * dt, y + ny * du + ty * dt, z + 0.70 * k),
                         (x - nx * du - tx * dt, y - ny * du - ty * dt, z + 0.70 * k))
    if nq:
        _mk('GUARDRAIL', m_rail, V, F, UV)
    for side in (-1, 1):
        log(f"  defensa {'montante' if side < 0 else 'jusante'}: "
            + (", ".join(f"{a:+.0f}..{b:+.0f}" for a, b in por_lado[side]) or "nenhuma")
            + "  (medida pela altura de aterro)")

    # ---- balizadores onde NAO ha defensa
    #
    # Uma serra sinaliza os dois bordos. Onde ha aterro poe-se defensa; onde nao
    # ha, poe-se baliza — e e por isso que estas so nascem fora dos trechos
    # acima, senao ficariam a espetar por tras do perfil W. Como usam
    # `ROAD_STUD`, o `retroreflect.ts` ja as acende de noite sem uma linha a mais
    # no engine.
    V, F, UV = [], [], []
    nq = 0
    nb = 0
    for side in (-1, 1):
        for t in np.arange(-LEN_B + 10, LEN_F - 10, 24.0):
            t = float(t)
            if any(a - 3 < t < b + 3 for a, b in por_lado[side]):
                continue
            x, y, z = deck(t, side * (X_VERGE - 0.30), PAVE_LIFT)
            _, _, _, nx, ny = frame_at(t)
            tx, ty = -ny, nx
            for (a, b) in ((nx, ny), (tx, ty)):
                quad((x - a * 0.045, y - b * 0.045, z),
                     (x + a * 0.045, y + b * 0.045, z),
                     (x + a * 0.045, y + b * 0.045, z + 1.05),
                     (x - a * 0.045, y - b * 0.045, z + 1.05))
            nb += 1
    if nq:
        _mk('ROAD_DELINEATORS', m_post, V, F, UV)
    log(f"  {nb} balizadores onde nao ha defensa")

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(WORK, "04_road.blend"))
    tri = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
    log(f"  gravado 04_road.blend   ({tri} poligonos na cena)")


# =========================================================================
def island_map(me):
    """ilhas de vertices ligados -> lista de listas de indices"""
    n = len(me.vertices)
    par = list(range(n))

    def find(a):
        while par[a] != a:
            par[a] = par[par[a]]
            a = par[a]
        return a

    for e in me.edges:
        ra, rb = find(e.vertices[0]), find(e.vertices[1])
        if ra != rb:
            par[rb] = ra
    g = {}
    for i in range(n):
        g.setdefault(find(i), []).append(i)
    return list(g.values())


def stage_veg():
    """Abre a clareira e faz o LOD — TUDO decidido por ARVORE, nunca por raio.

    DUAS COISAS QUE A PRIMEIRA VERSAO ERROU, as duas visiveis so a renderizar:

    1. COPAS ORFAS.  As copas eram casadas com as arvores derrubadas por um raio
       fixo de 3 m. Uma conifera de 27 m tem a copa espalhada por bem mais do que
       isso — as ilhas de cartao mais exteriores ficavam de fora do raio, o
       tronco desaparecia e a folhagem ficava a flutuar sobre o asfalto. Agora
       cada ilha de copa procura o tronco MAIS PROXIMO e segue o destino dele.
       Sem raio, sem afinacao: uma copa pertence a arvore de que esta mais perto.

    2. TRONCOS PELADOS NO HORIZONTE.  O LOD tirava 66% dos cartoes das arvores
       alem de 110 m. Numa arvore de cartoes isso nao a simplifica, TRANSPARENTA:
       contra o ceu, a crista da encosta ficou uma fileira de postes. Alem de
       110 m o LOD passa a tirar ARVORES INTEIRAS (tronco e copa juntos) e a
       aliviar so um pouco as que ficam. Uma mata um pouco mais rala a 120 m nao
       se ve; uma arvore semitransparente ve-se sempre.
    """
    log("VEG — abrir a clareira, desbastar e aplicar LOD")
    bpy.ops.wm.open_mainfile(filepath=os.path.join(WORK, "04_road.blend"))
    load_profile()
    B = by_mat()
    rng = np.random.default_rng(20260812)

    # ---- 1. levantar TODAS as arvores e decidir o destino de cada uma
    trees = []          # (x, y, obj, [indices], destino)
    for mname in ('Trunk_Oak', 'Trunk_Birch'):
        o = B.get(mname)
        if not o:
            continue
        me = o.data
        n = len(me.vertices)
        co = np.zeros(n * 3, dtype=np.float32)
        me.vertices.foreach_get('co', co)
        co = co.reshape(n, 3)
        for ids in island_map(me):
            c = co[ids].mean(axis=0)
            trees.append([float(c[0]), float(c[1]), o, ids, 'keep'])

    TS, TU = to_su_many(np.array([t[0] for t in trees], dtype=np.float64),
                        np.array([t[1] for t in trees], dtype=np.float64)) \
        if trees else (np.zeros(0), np.zeros(0))
    nobra = nthin = nlod = 0
    for k, tr in enumerate(trees):
        x, y = tr[0], tr[1]
        s, u = float(TS[k]), float(TU[k])
        r = math.hypot(x, y)
        clear = max(CLEAR_CUT if u < 0 else CLEAR_FILL, catch_at(s, u) + 2.0)
        if abs(u) < clear and -LEN_B - 25 < s < LEN_F + 25:
            tr[4] = 'obra'; nobra += 1
        elif abs(u) < THIN_TO and -LEN_B - 25 < s < LEN_F + 25 and rng.random() > THIN_KEEP:
            tr[4] = 'desbaste'; nthin += 1
        elif r >= LOD2_R and rng.random() > LOD2_TREE_KEEP:
            tr[4] = 'lod'; nlod += 1
    log(f"  arvores: {len(trees)} totais -> {nobra} na obra, {nthin} desbastadas na "
        f"orla, {nlod} raleadas alem de {LOD2_R:.0f} m")

    dead = np.array([[t[0], t[1]] for t in trees if t[4] != 'keep']) if any(
        t[4] != 'keep' for t in trees) else np.zeros((0, 2))
    alive = np.array([[t[0], t[1]] for t in trees if t[4] == 'keep'])

    for mname in ('Trunk_Oak', 'Trunk_Birch'):
        o = B.get(mname)
        if not o:
            continue
        drop = np.zeros(len(o.data.vertices), dtype=bool)
        for tr in trees:
            if tr[2] is o and tr[4] != 'keep':
                drop[tr[3]] = True
        before = len(o.data.polygons)
        delete_verts(o, drop)
        log(f"  {mname}: {before} -> {len(o.data.polygons)} poligonos")

    # ---- 2. copas seguem o tronco MAIS PROXIMO
    o = B.get('Background_Tree_Atlas')
    if o is not None and len(dead):
        me = o.data
        n = len(me.vertices)
        co = np.zeros(n * 3, dtype=np.float32)
        me.vertices.foreach_get('co', co)
        co = co.reshape(n, 3)
        isl = island_map(me)
        drop = np.zeros(n, dtype=bool)
        nc = 0
        for ids in isl:
            c = co[ids].mean(axis=0)
            dd = np.hypot(dead[:, 0] - c[0], dead[:, 1] - c[1]).min()
            da = np.hypot(alive[:, 0] - c[0], alive[:, 1] - c[1]).min() if len(alive) else 1e9
            if dd < da:                       # a arvore mais proxima caiu
                drop[ids] = True
                nc += 1
        before = len(me.polygons)
        delete_verts(o, drop)
        log(f"  copas: {nc} de {len(isl)} ilhas seguiram a sua arvore  "
            f"({before} -> {len(me.polygons)} poligonos)")

    # ---- 3. entulho de chao
    for mname in CLUTTER_MATS:
        o = B.get(mname)
        if not o:
            continue
        me = o.data
        n = len(me.vertices)
        co = np.zeros(n * 3, dtype=np.float32)
        me.vertices.foreach_get('co', co)
        co = co.reshape(n, 3)
        drop = np.hypot(co[:, 0], co[:, 1]) > CLUTTER_R
        cs, cu = to_su_many(co[:, 0].astype(np.float64), co[:, 1].astype(np.float64))
        band = np.array([catch_at(float(a), float(b)) + 1.0 for a, b in zip(cs, cu)])
        drop |= (np.abs(cu) < band) & (cs > -LEN_B - 5) & (cs < LEN_F + 5)
        before = len(me.polygons)
        delete_verts(o, drop)
        log(f"  {mname}: {before} -> {len(me.polygons)} poligonos")

    # ---- 4. o que ficou a flutuar sobre a obra
    unfloat(B)

    # ---- 5. alivio de cartoes nas copas que sobraram longe, e troncos decimados
    lod_canopy(B, rng)

    # ---- 6. as estradas de chao da fonte
    dirt_tracks(B, rng)

    # ---- 7. a mata que continua alem do sitio
    far_forest(B, rng)

    # ---- 8. arvores perto saem para objetos proprios, TRONCO E COPA JUNTOS
    split_near_trees(B)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(WORK, "05_veg.blend"))
    tri = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
    log(f"  gravado 05_veg.blend   ({tri} poligonos na cena)")


SPLIT_R = 46.0          # raio em que a arvore vira objeto proprio
SPLIT_MAX = 40          # teto de objetos novos, para nao explodir draw calls


def split_near_trees(B):
    """Separa as arvores perto do veiculo em objetos INDIVIDUAIS, COM A COPA.

    E uma correcao de comportamento do app, nao arrumacao. `seethrough.ts`
    dissolve o que fica entre a lente e o veiculo POR OBJETO INTEIRO (o mesmo
    GOTCHA dos onze postes do distrito, que sao onze nos na mesma malha), e o
    unico teste que impede uma malha de dissolver e o material dela estar
    declarado como chao no manifesto — os testes de altura nao salvam nada aqui,
    porque a caixa da copa tem 100 m.

    Ou seja havia so duas saidas, e ambas mas:

      * NAO declarar `Trunk_Oak`: um unico tronco a passar na frente da cabine
        dissolvia AS 900 ARVORES da cena de uma vez.
      * Declarar: nada dissolve, e o utilizador que esta a compor uma pintura
        fica com um tronco fixo em cima da cabine.

    A terceira saida e esta: as arvores que podem MESMO tapar o veiculo — as que
    estao a menos de SPLIT_R, que sao as que a orbita cruza — passam a ser um
    objeto cada, e so elas ficam fora do manifesto. Dissolvem uma a uma. O resto
    da mata continua em malhas a granel e declarado como chao, portanto nunca
    dissolve.

    ===================================================================
    A COPA VEM JUNTO, e a versao anterior deixava-a para tras.
    ===================================================================
    O argumento de entao era: *"o caminhao tem 4 m e a copa comeca acima disso,
    entao copa quase nunca esta entre a lente e a lataria"*. O "quase" era o
    defeito. A orbita deste estudio sobe e chega perto; quando ela sobe, a copa
    ENTRA no corredor — e como o tronco dissolvia e a copa nao, o que se via era
    uma copa PENDURADA no ar sem arvore por baixo. E o mesmo defeito de "meia
    arvore" que `seethrough.ts` inteiro existe para matar, so que produzido no
    lado do cenario.

    A saida e um objeto com DOIS SLOTS de material (casca e folha): uma malha
    multi-material recebe clone e uniforme em TODOS os materiais e
    `escrever()` poe o mesmo valor nos dois, entao a arvore vai inteira. Isso
    esta escrito em `installSeeThroughOnSet` e e a razao pela qual esta funcao
    junta as duas geometrias em vez de criar dois objetos irmaos.
    """
    atlas = B.get('Background_Tree_Atlas')
    made = 0
    novos_todos = []
    for mname in ('Trunk_Oak', 'Trunk_Birch'):
        o = B.get(mname)
        if not o or not len(o.data.vertices):
            continue
        me = o.data
        n = len(me.vertices)
        co = np.zeros(n * 3, dtype=np.float32)
        me.vertices.foreach_get('co', co)
        co = co.reshape(n, 3)
        cand = []
        for ids in island_map(me):
            c = co[ids].mean(axis=0)
            r = math.hypot(float(c[0]), float(c[1]))
            if r < SPLIT_R:
                cand.append((r, ids, (float(c[0]), float(c[1]))))
        cand.sort(key=lambda x: x[0])
        cand = cand[:max(0, SPLIT_MAX - made)]
        if not cand:
            continue
        take = np.zeros(n, dtype=bool)
        for _, ids, _c in cand:
            take[ids] = True
        dup = o.copy()
        dup.data = o.data.copy()
        bpy.context.scene.collection.objects.link(dup)
        delete_verts(dup, ~take)      # a copia fica so com os troncos proximos
        delete_verts(o, take)         # e o original perde-os
        # agora parte a copia em pecas ligadas — uma por arvore
        bpy.ops.object.select_all(action='DESELECT')
        dup.select_set(True)
        bpy.context.view_layer.objects.active = dup
        bpy.ops.mesh.separate(type='LOOSE')
        novos = [x for x in bpy.context.selected_objects if x is not o]
        # MATERIAL PROPRIO, e sem isto o resto da funcao nao servia de nada:
        # `installSeeThroughOnSet` decide pelo NOME DO MATERIAL, nao pelo objeto.
        # Separar os troncos em objetos mas deixa-los com `Trunk_Oak` faria os
        # vinte herdarem a decisao da massa — declarados no manifesto, nenhum
        # dissolvia; nao declarados, a massa toda dissolvia com eles. A copia do
        # material reutiliza os MESMOS datablocks de imagem, entao nao entra
        # textura nova no .glb: e um material a mais, nao um atlas a mais.
        near = bpy.data.materials.get(f"TREE_NEAR_BARK_{mname[6:].upper()}")
        if near is None:
            near = o.data.materials[0].copy()
            near.name = f"TREE_NEAR_BARK_{mname[6:].upper()}"
        for i, x in enumerate(novos):
            x.name = x.data.name = f"TREE_NEAR_{mname[6:].upper()}_{i:03d}"
            x.data.materials.clear()
            x.data.materials.append(near)
        made += len(novos)
        novos_todos += novos
        log(f"  {mname}: {len(novos)} troncos a menos de {SPLIT_R:.0f} m viraram objeto proprio")

    # ---- e agora a copa de cada um deles
    if atlas is not None and novos_todos and len(atlas.data.vertices):
        me = atlas.data
        n = len(me.vertices)
        co = np.zeros(n * 3, dtype=np.float32)
        me.vertices.foreach_get('co', co)
        co = co.reshape(n, 3)
        isl = island_map(me)
        # centro em XY de cada tronco separado, e o centro de cada ilha de copa
        bases = []
        for x in novos_todos:
            vs = np.array([[v.co.x, v.co.y] for v in x.data.vertices])
            bases.append(vs.mean(axis=0))
        bases = np.array(bases)
        # os troncos que FICARAM a granel tambem competem: uma ilha de copa que
        # pertence a um deles nao pode vir para ca, senao a copa da massa some
        rest = []
        for mname in ('Trunk_Oak', 'Trunk_Birch'):
            o = B.get(mname)
            if not o or not len(o.data.vertices):
                continue
            c2 = np.zeros(len(o.data.vertices) * 3, dtype=np.float32)
            o.data.vertices.foreach_get('co', c2)
            c2 = c2.reshape(-1, 3)
            for ids in island_map(o.data):
                rest.append(c2[ids].mean(axis=0)[:2])
        rest = np.array(rest) if rest else np.zeros((0, 2))

        assign = {}
        drop = np.zeros(n, dtype=bool)
        for ids in isl:
            c = co[ids].mean(axis=0)[:2]
            d_near = np.hypot(bases[:, 0] - c[0], bases[:, 1] - c[1])
            j = int(np.argmin(d_near))
            if len(rest):
                d_rest = np.hypot(rest[:, 0] - c[0], rest[:, 1] - c[1]).min()
                if d_rest < d_near[j]:
                    continue
            if d_near[j] > 14.0:
                continue
            assign.setdefault(j, []).append(ids)
            drop[ids] = True

        leaf = bpy.data.materials.get('TREE_NEAR_LEAF')
        if leaf is None:
            leaf = me.materials[0].copy()
            leaf.name = 'TREE_NEAR_LEAF'
        moved = 0
        for j, groups in assign.items():
            host = novos_todos[j]
            ids = sorted({i for g in groups for i in g})
            remap = {v: k for k, v in enumerate(ids)}
            verts = [tuple(co[i]) for i in ids]
            faces = []
            for p in me.polygons:
                vs = list(p.vertices)
                if all(v in remap for v in vs):
                    faces.append(tuple(remap[v] for v in vs))
            if not faces:
                continue
            tmp = bpy.data.meshes.new(host.name + "_leaf")
            tmp.from_pydata(verts, [], faces)
            tmp.update()
            # UV: copiada do atlas por vertice, que e o unico jeito de a folha
            # continuar a apontar para o cartao certo do atlas
            uvl_src = me.uv_layers.active
            if uvl_src:
                by_vert = {}
                for p in me.polygons:
                    for li in p.loop_indices:
                        by_vert[me.loops[li].vertex_index] = tuple(uvl_src.data[li].uv)
                uvl = tmp.uv_layers.new(name='UVMap')
                for p in tmp.polygons:
                    for li in p.loop_indices:
                        uvl.data[li].uv = by_vert.get(ids[tmp.loops[li].vertex_index], (0, 0))
            tmp.materials.append(leaf)
            ob = bpy.data.objects.new(host.name + "_leaf", tmp)
            bpy.context.scene.collection.objects.link(ob)
            # JUNTA no tronco: um objeto, dois slots
            bpy.ops.object.select_all(action='DESELECT')
            ob.select_set(True)
            host.select_set(True)
            bpy.context.view_layer.objects.active = host
            bpy.ops.object.join()
            moved += 1
        delete_verts(atlas, drop)
        log(f"  copas: {moved} arvores proximas levaram a copa junta "
            f"(atlas fica com {len(atlas.data.polygons)} poligonos)")
    log(f"  {made} arvores podem dissolver individualmente na frente do veiculo")


# =========================================================================
# ESTRADAS DE CHAO — uma fica como entrada da mata, o resto vira piso
# =========================================================================
TRACK_MATS = ['Dirt_Road', 'Dirt_Road_Bare', 'Dirt_Road_Trails',
              'Road_Edge_Gravel_Dusty']
KEEP_SIDE = +1           # o lado do ATERRO, que e onde esta a cerca de madeira
KEEP_S = (-10.0, 60.0)   # janela de estaca em que a entrada e conservada


def dirt_tracks(B, rng):
    """Uma trilha fica como ENTRADA DA MATA; as outras deixam de ser estrada.

    O RELATO: *"tem algumas estradas de chao literalmente atravessando a
    estrada"*, *"a estrada de chao ... pode manter, so garanta de remover a
    cerca dela, seria como uma entrada para a floresta, ja a ... nao faz sentido
    algum, cubra com elementos da propria floresta"*.

    O QUE ESTA LA, MEDIDO. Quatro malhas da fonte carregam traçados de terra
    (`Dirt_Road` 4 590 faces, `Dirt_Road_Trails` 2 228, `Road_Edge_Gravel_Dusty`
    1 169, `Dirt_Road_Bare` 200) e elas NAO sao uma estrada cada: sao os
    materiais de uma rede de trilhas que atravessa o sitio inteiro, de u -57 a
    u +111. Depois da terraplenagem, os pedaços que sobraram junto ao corredor
    chegam a |u| = 10,9 m — ou seja encostam no pe do talude e leem como uma
    estrada de terra que bate na rodovia e para. Sao 317 faces a menos de 14 m
    do eixo somando as quatro malhas.

    A DECISAO E POR COMPONENTE CONEXO e nao por material, porque o material nao
    separa uma trilha da outra. Cada componente e classificado pelo lado e pela
    estaca do centroide; sobrevive o que esta do lado do aterro na janela
    `KEEP_S` — que e o traçado que a `Wood_Fence` da fonte acompanha, e o unico
    que tem para onde ir (desce para o vale). Todo o resto vira piso de floresta.

    "VIRAR PISO" NAO E APAGAR. Apagar abriria buraco no terreno — estas malhas
    SAO o chao ali, nao um decalque por cima dele. As faces condenadas sao
    movidas para `FOREST_FLOOR_PATCH` com o material `Grass_Close` da propria
    fonte e UV recalculada na escala dele; a geometria fica onde estava e so a
    aparencia muda. Depois `stage_props` planta grama, samambaia e pedra por
    cima, que e literalmente o *"cubra com elementos da propria floresta"*.
    """
    # a cerca sai inteira — foi pedida
    for nm in ('Wood_Fence', 'Metal_Fence'):
        o = B.get(nm)
        if o and len(o.data.polygons):
            log(f"  {nm}: removida ({len(o.data.polygons)} faces)")
            bpy.data.objects.remove(o, do_unlink=True)
            B.pop(nm, None)

    m_grass = B['Grass_Close'].data.materials[0] if 'Grass_Close' in B else None
    if m_grass is None:
        return
    V, F, UV = [], [], []
    kept = moved = 0
    for nm in TRACK_MATS:
        o = B.get(nm)
        if not o or not len(o.data.polygons):
            continue
        me = o.data
        n = len(me.vertices)
        co = np.zeros(n * 3, dtype=np.float32)
        me.vertices.foreach_get('co', co)
        co = co.reshape(n, 3)
        comps = island_map(me)
        # a que componente cada face pertence
        owner = {}
        for ci, ids in enumerate(comps):
            for i in ids:
                owner[i] = ci
        doomed = []
        keepc = set()
        for ci, ids in enumerate(comps):
            c = co[ids].mean(axis=0)
            cs, cu = to_su(float(c[0]), float(c[1]))
            r = math.hypot(float(c[0]), float(c[1]))
            if r > 130.0:
                keepc.add(ci)             # longe, nao incomoda ninguem
                continue
            if cu * KEEP_SIDE > 0 and KEEP_S[0] < cs < KEEP_S[1]:
                keepc.add(ci)
        for p in me.polygons:
            ci = owner.get(p.vertices[0], -1)
            if ci in keepc:
                kept += 1
                continue
            doomed.append(p.index)
            base = len(V)
            for v in p.vertices:
                V.append(tuple(co[v]))
                UV.append((float(co[v][0]) / UV_M_GRASS, float(co[v][1]) / UV_M_GRASS))
            F.append(tuple(range(base, base + len(p.vertices))))
            moved += 1
        if doomed:
            _del_faces(o, doomed)
    if F:
        patch = _mk('FOREST_FLOOR_PATCH', m_grass, V, F, UV)
        _face_up(patch)
        _add_ao(patch)
    log(f"  trilhas: {moved} faces viraram piso de floresta, {kept} ficam como "
        f"entrada da mata")


# =========================================================================
# MATA DISTANTE — a floresta nao pode acabar onde o sitio acaba
# =========================================================================
FAR_R0, FAR_R1 = 122.0, 980.0
FAR_N = 900


def far_forest(B, rng):
    """Instancia UMA arvore da propria fonte pelo anel de 122 a 980 m.

    POR QUE INSTANCIA E NAO GEOMETRIA. O `.glb` ja pesa 11,9 MB e 9,6 disso sao
    imagens; clonar 600 arvores como malha somaria ~70 000 poligonos ao arquivo.
    Como `EXT_mesh_gpu_instancing` guarda so a matriz de cada individuo, 600
    copias custam 600 x 64 bytes = 38 KB e UM draw call — e o `GLTFLoader` do
    three devolve um `InstancedMesh`, que e justamente a forma que
    `seethrough.ts` sabe dissolver POR INSTANCIA.

    O PROTOTIPO SAI DA CENA, nao de um acervo. E a arvore mediana da propria
    mata, tronco e copa, recentrada na base: qualquer outra arvore teria casca e
    folha diferentes das ~750 que ficam, e a emenda entre a mata de perto e a de
    longe seria visivel exatamente na distancia em que o olho compara as duas.

    NAO E DECORACAO, E A CORRECAO DO *"espaco em branco"*. O avental de terreno
    fecha o horizonte com CHAO; sem arvore em cima dele o que se ve e um morro
    pelado colado a uma floresta fechada, que e pior que o buraco.
    """
    trunk = B.get('Trunk_Oak')
    atlas = B.get('Background_Tree_Atlas')
    if not trunk or not atlas or not len(trunk.data.vertices):
        return
    # --- escolher a arvore prototipo: a mais proxima da mediana de altura
    tc = np.zeros(len(trunk.data.vertices) * 3, dtype=np.float32)
    trunk.data.vertices.foreach_get('co', tc)
    tc = tc.reshape(-1, 3)
    cands = []
    for ids in island_map(trunk.data):
        a = tc[ids]
        c = a.mean(axis=0)
        r = math.hypot(float(c[0]), float(c[1]))
        if 55.0 < r < 115.0:
            cands.append((float(a[:, 2].max() - a[:, 2].min()), ids,
                          (float(c[0]), float(c[1]), float(a[:, 2].min()))))
    if not cands:
        return
    cands.sort(key=lambda x: x[0])
    hgt, ids, base = cands[len(cands) // 2]

    ac = np.zeros(len(atlas.data.vertices) * 3, dtype=np.float32)
    atlas.data.vertices.foreach_get('co', ac)
    ac = ac.reshape(-1, 3)
    leaf_ids = []
    for isl in island_map(atlas.data):
        c = ac[isl].mean(axis=0)
        if math.hypot(c[0] - base[0], c[1] - base[1]) < 7.0:
            leaf_ids += list(isl)
    proto = _extract_proto('FOREST_FAR', [(trunk, ids, 'FOREST_FAR_BARK'),
                                          (atlas, leaf_ids, 'FOREST_FAR_LEAF')], base)
    if proto is None:
        return
    tri = len(proto.data.polygons)

    # --- onde plantar: anel, evitando a obra, densidade caindo com o raio
    bvh = final_ground()
    holder = instance_holder()
    made = 0
    tries = 0
    while made < FAR_N and tries < FAR_N * 40:
        tries += 1
        r = FAR_R0 * ((FAR_R1 / FAR_R0) ** float(rng.random()))
        a = float(rng.random()) * 2 * math.pi
        x, y = r * math.cos(a), r * math.sin(a)
        cs, cu = to_su(x, y)
        if -LEN_B - 30 < cs < LEN_F + 30 and abs(cu) < catch_at(cs, cu) + 8.0:
            continue
        h = bvh.ray_cast(Vector((x, y, 1200.0)), Vector((0, 0, -1)))
        if h[0] is None:
            continue
        inst = proto.copy()             # LINKED: mesma malha, so a matriz muda
        bpy.context.scene.collection.objects.link(inst)
        inst.parent = holder
        sc = 0.78 + 0.55 * float(rng.random())
        inst.location = (x, y, h[0].z - 0.35)
        inst.rotation_euler = (0.0, 0.0, float(rng.random()) * 2 * math.pi)
        inst.scale = (sc, sc, sc * (0.9 + 0.3 * float(rng.random())))
        inst.name = f"FOREST_FAR_{made:04d}"
        made += 1
    proto.hide_render = True
    bpy.data.objects.remove(proto, do_unlink=True)
    log(f"  mata distante: {made} instancias de {tri} poligonos entre "
        f"{FAR_R0:.0f} e {FAR_R1:.0f} m (1 draw call)")


def instance_holder():
    """O Empty sob o qual TODA instancia tem de nascer.

    NAO E ARRUMACAO — sem ele o `EXT_mesh_gpu_instancing` simplesmente nao sai.
    O exportador do Blender (`exporter.py::manage_gpu_instancing`) so agrupa
    filhos DO MESMO NO: ele percorre `node.children`, junta os que apontam para a
    mesma malha e so entao escreve a extensao. Objetos irmaos na raiz da cena,
    por mais que partilhem `o.data`, saem um nodo cada — medido num teste de nove
    cubos: com pai, 2 malhas e 3 nodos; sem pai, 9 nodos e nenhuma extensao.

    Um Empty serve para todos os prototipos: o agrupamento e por MALHA dentro do
    pai, e o exportador cria um nodo-suporte por conjunto.
    """
    e = bpy.data.objects.get('INSTANCES')
    if e is None:
        e = bpy.data.objects.new('INSTANCES', None)
        bpy.context.scene.collection.objects.link(e)
    return e


def _extract_proto(name, parts, base):
    """Copia ilhas de varias malhas para UM objeto multi-material na origem."""
    objs = []
    for src, ids, matname in parts:
        me = src.data
        co = np.zeros(len(me.vertices) * 3, dtype=np.float32)
        me.vertices.foreach_get('co', co)
        co = co.reshape(-1, 3)
        want = set(ids)
        remap = {}
        verts = []
        for i in sorted(want):
            remap[i] = len(verts)
            verts.append((float(co[i][0] - base[0]), float(co[i][1] - base[1]),
                          float(co[i][2] - base[2])))
        faces = [tuple(remap[v] for v in p.vertices) for p in me.polygons
                 if all(v in remap for v in p.vertices)]
        if not faces:
            continue
        tmp = bpy.data.meshes.new(name + "_" + matname)
        tmp.from_pydata(verts, [], faces)
        tmp.update()
        uvl_src = me.uv_layers.active
        if uvl_src:
            by_vert = {}
            for p in me.polygons:
                for li in p.loop_indices:
                    by_vert[me.loops[li].vertex_index] = tuple(uvl_src.data[li].uv)
            uvl = tmp.uv_layers.new(name='UVMap')
            order = sorted(want)
            for p in tmp.polygons:
                for li in p.loop_indices:
                    uvl.data[li].uv = by_vert.get(order[tmp.loops[li].vertex_index], (0, 0))
        mat = bpy.data.materials.get(matname)
        if mat is None:
            mat = me.materials[0].copy()
            mat.name = matname
        tmp.materials.append(mat)
        ob = bpy.data.objects.new(name + "_" + matname, tmp)
        bpy.context.scene.collection.objects.link(ob)
        objs.append(ob)
    if not objs:
        return None
    bpy.ops.object.select_all(action='DESELECT')
    for x in objs:
        x.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    objs[0].name = objs[0].data.name = name
    return objs[0]


def unfloat(B):
    """Apaga as ilhas de vegetacao que ficaram sem chao por baixo.

    A limpeza pela linha de apanha ja tira quase tudo, mas nao tira o que estava
    assente numa face de terreno que a obra removeu SEM que o tufo caia dentro da
    banda — bordos, decalques inclinados, moitas encavalitadas. No render eram
    manchas escuras suspensas: `Forest_Bush` a 4,4 m do chao, `Grass_Vegetation_Dry`
    a 4,1 m e `Rock_Decal` a 5,9 m, todas sobre o talude de aterro.

    O teste e por ILHA e pelo vertice MAIS BAIXO dela: um tufo de erva tem o topo
    a mais de um metro do chao por construcao, entao medir pelo centro condenaria
    vegetacao boa. Enterrado nao se testa — nao se ve, e empurrar para cima o que
    esta meio enterrado e como o terreno da fonte ja e.
    """
    ground = [o for o in bpy.data.objects if o.type == 'MESH' and (
        mat_of(o) in GROUND_MATS or o.name in
        ('ROAD_PAVEMENT', 'ROAD_VERGE_L', 'ROAD_VERGE_R', 'ROAD_DITCH',
         'BATTER_L', 'BATTER_R'))]
    bvh = build_bvh(ground)
    total = 0
    for mname in CLUTTER_MATS + ['Wood_Log', 'Wood_Fence', 'Metal_Fence']:
        o = B.get(mname)
        if not o or not len(o.data.vertices):
            continue
        me = o.data
        n = len(me.vertices)
        co = np.zeros(n * 3, dtype=np.float32)
        me.vertices.foreach_get('co', co)
        co = co.reshape(n, 3)
        drop = np.zeros(n, dtype=bool)
        k = 0
        for ids in island_map(me):
            a = co[ids]
            if math.hypot(float(a[:, 0].mean()), float(a[:, 1].mean())) > 90:
                continue
            j = int(np.argmin(a[:, 2]))
            x, y, z = float(a[j, 0]), float(a[j, 1]), float(a[j, 2])
            # O RAIO PARTE DE BEM ACIMA, e nao de junto da base. Partindo de
            # `z + 0.15` para baixo, um tufo SEMIENTERRADO — que e como a fonte
            # espalha erva, e o normal — nunca encontra o chao, porque o chao
            # esta ACIMA do ponto de partida. O teste devolvia "sem chao" e
            # apagava 78% da erva. Partindo de +50 m o chao aparece sempre, e a
            # diferenca `z - chao` distingue as duas coisas: negativa e
            # enterrado (fica), maior que 1 m e a flutuar (sai).
            h = bvh.ray_cast(Vector((x, y, z + 50.0)), Vector((0, 0, -1)), 120.0)
            if h[0] is None or (z - h[0].z) > 1.0:
                drop[ids] = True
                k += 1
        if k:
            before = len(me.polygons)
            delete_verts(o, drop)
            log(f"  flutuando: {mname} -{k} ilhas  ({before} -> {len(me.polygons)} pol.)")
            total += k
    log(f"  {total} ilhas sem chao removidas")


def delete_verts(o, mask):
    if not mask.any():
        return
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.verts.ensure_lookup_table()
    doomed = [bm.verts[i] for i in np.nonzero(mask)[0]]
    bmesh.ops.delete(bm, geom=doomed, context='VERTS')
    bm.to_mesh(o.data)
    bm.free()
    o.data.update()


def lod_canopy(B, rng):
    """Alivio de cartoes nas copas distantes, NUNCA decimador.

    Um decimador de colapso junta cartoes de folha vizinhos numa so face e o
    resultado e pasta — o mesmo aviso que `trees_pack.py` ja deixou escrito.
    Aqui o alivio e brando de proposito: o corte grosso alem de 110 m ja foi
    feito em `stage_veg` tirando arvores INTEIRAS, que e a operacao que nao
    transparenta ninguem. Isto so tira o excesso de densidade dentro das copas
    que ficaram.
    """
    o = B.get('Background_Tree_Atlas')
    if not o:
        return
    me = o.data
    n = len(me.vertices)
    co = np.zeros(n * 3, dtype=np.float32)
    me.vertices.foreach_get('co', co)
    co = co.reshape(n, 3)
    isl = island_map(me)
    drop = np.zeros(n, dtype=bool)
    k1 = k2 = 0
    for ids in isl:
        c = co[ids].mean(axis=0)
        r = float(math.hypot(c[0], c[1]))
        if r < LOD1_R:
            continue
        keep = LOD1_CARD_KEEP if r < LOD2_R else LOD2_CARD_KEEP
        if rng.random() > keep:
            drop[ids] = True
            k1 += r < LOD2_R
            k2 += r >= LOD2_R
    before = len(me.polygons)
    delete_verts(o, drop)
    log(f"  LOD copas: -{k1} cartoes em {LOD1_R:.0f}-{LOD2_R:.0f} m, "
        f"-{k2} alem  ({before} -> {len(me.polygons)} poligonos)")

    for mname in ('Trunk_Oak', 'Trunk_Birch'):
        t = B.get(mname)
        if not t:
            continue
        before = len(t.data.polygons)
        split_far_and_decimate(t)
        log(f"  LOD {mname}: {before} -> {len(t.data.polygons)} poligonos")


def split_far_and_decimate(o):
    """Separa o que esta alem de LOD1_R, decima so isso, e volta a juntar."""
    me = o.data
    n = len(me.vertices)
    co = np.zeros(n * 3, dtype=np.float32)
    me.vertices.foreach_get('co', co)
    co = co.reshape(n, 3)
    isl = island_map(me)
    far = np.zeros(n, dtype=bool)
    for ids in isl:
        c = co[ids].mean(axis=0)
        if math.hypot(c[0], c[1]) >= LOD1_R:
            far[ids] = True
    if not far.any():
        return
    # duplica o objeto, apaga o oposto em cada copia, decima o distante, junta
    near = o
    dup = o.copy()
    dup.data = o.data.copy()
    dup.name = o.name + "_FAR"
    bpy.context.scene.collection.objects.link(dup)
    delete_verts(near, far)
    delete_verts(dup, ~far)
    md = dup.modifiers.new('dec', 'DECIMATE')
    md.ratio = 0.45
    bpy.context.view_layer.objects.active = dup
    bpy.ops.object.modifier_apply(modifier='dec')
    bpy.ops.object.select_all(action='DESELECT')
    dup.select_set(True)
    near.select_set(True)
    bpy.context.view_layer.objects.active = near
    bpy.ops.object.join()


# =========================================================================
# PROPS — o acervo do Poly Haven, plantado por instanciamento de GPU
# =========================================================================
SRC_PH = os.path.join(HERE, "_src_ph")

# key            asset                    objeto contem      alvo  alfa  material
PROTOS = [
    ('tufo_a', 'grass_medium_02', 'grass_medium_02_a', 240, True, 'PH_GRAMA_TUFO'),
    ('tufo_b', 'grass_medium_02', 'grass_medium_02_b', 260, True, 'PH_GRAMA_TUFO'),
    ('tufo_c', 'grass_medium_02', 'grass_medium_02_c', 240, True, 'PH_GRAMA_TUFO'),
    ('tufo_d', 'grass_medium_02', 'grass_medium_02_d', 300, True, 'PH_GRAMA_TUFO'),
    ('tufo_e', 'grass_medium_02', 'grass_medium_02_e', 260, True, 'PH_GRAMA_TUFO'),
    ('fern_a', 'fern_02', 'fern_02_a', 420, True, 'PH_SAMAMBAIA'),
    ('fern_b', 'fern_02', 'fern_02_b', 620, True, 'PH_SAMAMBAIA'),
    ('fern_c', 'fern_02', 'fern_02_c', 600, True, 'PH_SAMAMBAIA'),
    ('mata_a', 'shrub_03', 'shrub_03_a', 520, True, 'PH_ARBUSTO_BAIXO'),
    ('mata_b', 'shrub_03', 'shrub_03_b', 520, True, 'PH_ARBUSTO_BAIXO'),
    ('moita_a', 'shrub_02', 'shrub_02_a', 900, True, 'PH_ARBUSTO'),
    ('moita_b', 'shrub_02', 'shrub_02_b', 900, True, 'PH_ARBUSTO'),
    ('rmusgo_1', 'rock_moss_set_01', 'rock01', 420, False, 'PH_ROCHA_MUSGO'),
    ('rmusgo_2', 'rock_moss_set_01', 'rock03', 380, False, 'PH_ROCHA_MUSGO'),
    ('rmusgo_3', 'rock_moss_set_01', 'rock04', 420, False, 'PH_ROCHA_MUSGO'),
    ('rmusgo_4', 'rock_moss_set_01', 'rock06', 400, False, 'PH_ROCHA_MUSGO'),
    # `boulder_01` FOI TENTADO E SAIU. Fica registado para nao voltar: e
    # fotogrametria com 270 pecas soltas e 66 122 triangulos, e o decimador de
    # colapso PARA em 26 613 (razao 0,40) por mais que se peca 0,01 — geometria
    # nao-manifold nao colapsa. Com 30 instancias isso eram 798 000 triangulos, ou
    # seja mais do que a cena inteira, por causa de uma pedra. `rock_moss_set_01`
    # e malha limpa e desce a 420 exatos, entao o matacao sai do mesmo conjunto —
    # e ainda poupa um jogo de texturas.
    ('matacao', 'rock_moss_set_01', 'rock05', 620, False, 'PH_ROCHA_MUSGO'),
    ('matacao2', 'rock_moss_set_01', 'rock02', 560, False, 'PH_ROCHA_MUSGO'),
    ('toco', 'tree_stump_01', 'tree_stump_01', 480, False, 'PH_TOCO'),
    ('raiz_a', 'pine_roots', 'pine_roots_a', 520, False, 'PH_RAIZ'),
    ('raiz_b', 'pine_roots', 'pine_roots_b', 520, False, 'PH_RAIZ'),
    ('galho_a', 'dry_branches_medium_01', 'dry_branches_medium_01_a', 400, False,
     'PH_GALHADA'),
    ('galho_b', 'dry_branches_medium_01', 'dry_branches_medium_01_b', 400, False,
     'PH_GALHADA'),
    ('aflora', 'rock_face_01', 'rock_face_01', 900, False, 'PH_AFLORAMENTO'),
    ('musgo_a', 'moss_01', 'moss_01_e', 40, True, 'PH_MUSGO'),
    ('musgo_b', 'moss_01', 'moss_01_f', 40, True, 'PH_MUSGO'),
]

# key -> (quantos, zonas, escala). Zona: (nome, peso).
#
# A ESCALA E POR PROTOTIPO E FOI MEDIDA, nao arbitrada. O acervo do Poly Haven e
# fotogrametria de pecas REAIS e vem no tamanho real, que quase nunca e o tamanho
# que a cena quer: os tufos de `grass_medium_02` medem de 8 a 25 cm (sao touceiras
# pequenas), o musgo mede 1 a 3 cm (e uma placa de musgo, nao um tapete) e as
# samambaias tem 30 a 60 cm de envergadura. Plantados a 1,0 nao se veem. Cada
# linha aqui leva o par (min, max) que poe a peca no porte que a cena precisa —
# e o log de `_import_proto` imprime a medida de origem, para conferir.
PLANTIO = {
    'tufo_a': (150, [('aterro', 3), ('banqueta', 4), ('valeta', 1), ('piso', 2)], (2.2, 3.6)),
    'tufo_b': (150, [('aterro', 3), ('banqueta', 4), ('valeta', 1), ('piso', 2)], (1.6, 2.8)),
    'tufo_c': (140, [('aterro', 3), ('banqueta', 3), ('piso', 3)], (1.8, 3.0)),
    'tufo_d': (120, [('aterro', 2), ('piso', 5), ('orla', 2)], (1.3, 2.2)),
    'tufo_e': (120, [('aterro', 2), ('piso', 4), ('orla', 2)], (1.1, 1.9)),
    'fern_a': (76, [('valeta', 3), ('pecorte', 3), ('piso', 4)], (1.5, 2.4)),
    'fern_b': (70, [('valeta', 2), ('pecorte', 3), ('piso', 4)], (1.2, 1.9)),
    'fern_c': (66, [('pecorte', 3), ('piso', 5)], (1.3, 2.1)),
    'mata_a': (80, [('aterro', 3), ('orla', 3), ('piso', 2)], (1.8, 3.2)),
    'mata_b': (76, [('aterro', 3), ('orla', 3), ('piso', 2)], (2.0, 3.4)),
    'moita_a': (44, [('orla', 4), ('aterro', 2)], (0.9, 1.5)),
    'moita_b': (42, [('orla', 4), ('aterro', 2)], (0.9, 1.4)),
    'rmusgo_1': (36, [('pecorte', 3), ('piso', 4), ('valeta', 2)], (0.45, 1.0)),
    'rmusgo_2': (34, [('pecorte', 3), ('piso', 4), ('valeta', 2)], (0.40, 0.9)),
    'rmusgo_3': (32, [('pecorte', 3), ('piso', 4)], (0.45, 1.0)),
    'rmusgo_4': (30, [('pecorte', 3), ('piso', 4)], (0.40, 0.9)),
    'matacao': (24, [('pecorte', 4), ('piso', 3), ('aterro', 1)], (0.8, 1.6)),
    'matacao2': (22, [('pecorte', 4), ('piso', 3), ('aterro', 1)], (0.7, 1.4)),
    'toco': (20, [('piso', 5), ('orla', 2)], (0.8, 1.3)),
    'raiz_a': (18, [('cristacorte', 3), ('piso', 3)], (1.0, 1.8)),
    'raiz_b': (18, [('cristacorte', 3), ('piso', 3)], (1.0, 1.8)),
    'galho_a': (26, [('piso', 5), ('orla', 2)], (1.8, 3.2)),
    'galho_b': (26, [('piso', 5), ('orla', 2)], (2.2, 4.0)),
    'aflora': (26, [('facecorte', 4), ('pecorte', 2)], (0.34, 0.72)),
    'musgo_a': (70, [('pecorte', 3), ('valeta', 2), ('piso', 3)], (8.0, 20.0)),
    'musgo_b': (70, [('pecorte', 3), ('valeta', 2), ('piso', 3)], (8.0, 20.0)),
}
MUDA_N = 150                 # coniferas jovens, feitas da propria mata
# O RAIO DO PLANTIO ENCOLHEU DE 96 PARA 64 m, e nao e economia: e onde a
# densidade e vista. A orbita do estudio gira a 8-30 m do veiculo, e alem de
# ~60 m a mata ja e massa — os cartoes de chao da fonte e as ~750 coniferas
# resolvem aquilo. Espalhar as mesmas mil pecas por 29 000 m2 em vez de 11 500
# nao deixa a cena mais densa; deixa-a igualmente rala em todo o lado.
PROP_R = 64.0


def stage_props():
    """Planta o acervo do Poly Haven — a densidade que o relato pede.

    *"quero uma cena extremamente densa, viva e realista, sem pontos em branco"*.
    O que a fonte tem de sub-bosque sao CARTOES DEITADOS (`Grass_Vegetation_*`,
    `Fallen_*`, `Rock_Decal`): manchas na textura do chao, sem volume. Elas
    resolvem a cor e nao resolvem a silhueta, e e a silhueta que faz um piso de
    floresta parecer piso de floresta a 8 m da lente.

    TUDO POR `EXT_mesh_gpu_instancing`, e a escolha nao e de arrumacao:

      · CUSTO NO ARQUIVO. Uma instancia sao 64 bytes de matriz. As ~1 000 pecas
        aqui somam ~64 KB; as mesmas 1 000 como malha somariam centenas de
        milhares de poligonos ao .glb.
      · CUSTO EM DRAW CALL. Um por PROTOTIPO, nao por individuo. Sao 25.
      · E, o que decide: o `GLTFLoader` do three devolve `InstancedMesh`, e
        `seethrough.ts` sabe dissolver instancia a instancia pelo atributo
        `aSeeHide`. Ou seja o arbusto que ficar entre a lente e a lataria some
        SOZINHO, sem levar os outros — que e o pedido *"os elementos deve se
        esconder para nao aparecer na frente entre a camera e o caminhao"*.

    QUEM DISSOLVE E QUEM NAO. `installSeeThroughOnSet` deixa de fora o que o
    manifesto declara como chao. Tufo de grama e musgo FICAM declarados de
    proposito — sao baixos, nunca tapam um caminhao de 4 m, e vê-los piscar
    junto ao pneu seria um defeito e nao um recurso. Samambaia, arbusto,
    matacao, toco, raiz, galhada e afloramento ficam de fora e dissolvem.

    NADA FLUTUA E NADA ATRAVESSA: cada peca e apoiada por raio vertical contra a
    superficie FINAL (terreno + corredor + avental) e enterrada uns centimetros;
    a rocha ainda e alinhada a NORMAL do terreno, senao uma pedra numa encosta de
    30 graus fica de pe como um monumento.
    """
    log("PROPS — plantar o acervo do Poly Haven por instancia de GPU")
    bpy.ops.wm.open_mainfile(filepath=os.path.join(WORK, "05_veg.blend"))
    load_profile()
    B = by_mat()
    rng = np.random.default_rng(20260813)

    protos = {}
    for key, asset, sub, alvo, alfa, matname in PROTOS:
        o = _import_proto(asset, sub, key, alvo, alfa, matname)
        if o is not None:
            protos[key] = o
    log(f"  {len(protos)} prototipos importados e reduzidos")
    if not protos:
        log("  !! nenhum prototipo — _src_ph esta vazio? (python fetch_polyhaven.py ...)")

    # A CONIFERA JOVEM SAI DA PROPRIA MATA e nao do acervo. As mudas do Poly
    # Haven sao fotogrametria de agulha por agulha — `pine_sapling_medium` tem
    # 6,0 MILHOES de triangulos e `fir_sapling_medium` 1,5 milhao — e reduzi-las
    # ao orcamento (2 500 tri) deixaria um pau seco, porque a reducao de um
    # cartao de folha e apagar o cartao. A arvore da fonte a 12 % de escala e
    # uma muda de 3 m com a MESMA casca e a MESMA folha das 750 vizinhas, por
    # ~130 triangulos.
    muda = _extract_from_forest(B, 'MUDA')

    bvh = final_ground()
    zonas = _zonas()
    total = 0
    for key, o in protos.items():
        n, mix, esc = PLANTIO.get(key, (0, [], (1.0, 1.0)))
        made = _plantar(o, key, n, mix, zonas, bvh, rng, escala=esc,
                        alinha_normal=key.startswith(('rmusgo', 'matacao', 'aflora',
                                                      'musgo', 'toco', 'galho', 'raiz')))
        total += made
    if muda is not None:
        total += _plantar(muda, 'muda', MUDA_N,
                          [('piso', 5), ('orla', 3), ('aterro', 2)],
                          zonas, bvh, rng, alinha_normal=False,
                          escala=(0.085, 0.155))
        bpy.data.objects.remove(muda, do_unlink=True)
    for o in protos.values():
        bpy.data.objects.remove(o, do_unlink=True)
    log(f"  {total} pecas plantadas em {len(protos)+1} prototipos")

    mask_alpha_props()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(WORK, "06_props.blend"))
    tri = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
    log(f"  gravado 06_props.blend  ({tri} poligonos de GEOMETRIA, "
        f"{len(bpy.data.objects)} objetos)")


def _import_proto(asset, sub, key, alvo, alfa, matname):
    """Traz UM objeto de um .gltf do Poly Haven, reduz e recentra na base."""
    d = os.path.join(SRC_PH, asset)
    if not os.path.isdir(d):
        return None
    gl = [f for f in os.listdir(d) if f.endswith('.gltf')]
    if not gl:
        return None
    antes = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(d, gl[0]))
    novos = [x for x in bpy.data.objects if x not in antes]
    alvo_o = None
    for x in sorted(novos, key=lambda z: z.name):
        if x.type == 'MESH' and sub in x.name:
            alvo_o = x
            break
    if alvo_o is None:
        for x in novos:
            bpy.data.objects.remove(x, do_unlink=True)
        return None
    # A MATRIZ E LIDA ANTES DE APAGAR OS IRMAOS, e a ordem e o defeito que isto
    # emenda: o .gltf do Poly Haven pendura as malhas num no pai, entao apagar o
    # pai primeiro desliga a transformada e a peca aparece rodada 90 graus (glTF
    # e Y-up) ou fora do sitio. Le-se a matriz de mundo, desprende-se, e so
    # depois se apaga o resto.
    mw = alvo_o.matrix_world.copy()
    alvo_o.parent = None
    for x in novos:
        if x is not alvo_o:
            bpy.data.objects.remove(x, do_unlink=True)
    alvo_o.data.transform(mw)
    alvo_o.matrix_world = Matrix.Identity(4)
    zs = [v.co.z for v in alvo_o.data.vertices]
    xs = [v.co.x for v in alvo_o.data.vertices]
    ys = [v.co.y for v in alvo_o.data.vertices]
    cx = (min(xs) + max(xs)) / 2.0
    cy = (min(ys) + max(ys)) / 2.0
    alvo_o.data.transform(Matrix.Translation(Vector((-cx, -cy, -min(zs)))))
    alvo_o.data.calc_loop_triangles()
    n0 = len(alvo_o.data.loop_triangles)
    _reduce(alvo_o, alvo, alfa)
    alvo_o.data.calc_loop_triangles()
    n1 = len(alvo_o.data.loop_triangles)
    dx = [v.co.x for v in alvo_o.data.vertices]
    dz = [v.co.z for v in alvo_o.data.vertices]
    log(f"    {key:<9} {n0:>7} -> {n1:>5} tri  (alvo {alvo})  "
        f"{max(dx)-min(dx):.2f} x {max(dz)-min(dz):.2f} m")
    # material proprio, com nome que o manifesto (e o `surfaceOf` do app) conhece
    if alvo_o.data.materials:
        m = alvo_o.data.materials[0]
        if m.name != matname:
            ex = bpy.data.materials.get(matname)
            if ex is not None and ex is not m:
                alvo_o.data.materials[0] = ex
            else:
                m.name = matname
    alvo_o.name = alvo_o.data.name = f"PROTO_{key}"
    return alvo_o


def _reduce(o, alvo, alfa):
    """Reduz `o` a ~`alvo` triangulos. Cartao de folha NUNCA e colapsado.

    A regra vem de `lod_canopy` e de `trees_pack.py`: um decimador de colapso
    junta dois cartoes de folha vizinhos numa face so e o resultado e pasta. Em
    malha ALFA a reducao e por ILHA — apaga-se a folha inteira, que e o que a
    natureza faz quando ha menos folha. Em malha opaca (rocha, toco, raiz) o
    colapso e a ferramenta certa e aguenta 98 %: sao fotogrametria com dezenas
    de milhares de triangulos numa pedra de 30 cm.
    """
    me = o.data
    me.calc_loop_triangles()
    n = len(me.loop_triangles)
    if n <= alvo:
        return
    if alfa:
        isl = island_map(me)
        # ilhas por tamanho: apaga as MENORES primeiro, que sao as folhas de
        # detalhe; apagar as grandes tiraria a silhueta
        rng = np.random.default_rng(len(isl) * 7 + n)
        order = sorted(range(len(isl)), key=lambda i: len(isl[i]))
        drop = np.zeros(len(me.vertices), dtype=bool)
        # estimativa: triangulos por vertice
        tpv = n / max(1, len(me.vertices))
        cur = n
        for i in order:
            if cur <= alvo:
                break
            if rng.random() < 0.12:      # deixa passar algumas, para nao ficar so grande
                continue
            drop[isl[i]] = True
            cur -= len(isl[i]) * tpv
        delete_verts(o, drop)
        me.calc_loop_triangles()
        if len(me.loop_triangles) > alvo * 1.6:
            md = o.modifiers.new('dec', 'DECIMATE')
            md.ratio = max(0.05, alvo / max(1, len(me.loop_triangles)))
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier='dec')
        return
    # EM PASSAGENS, e nao numa razao so. O decimador de colapso trava onde a
    # malha e nao-manifold, e fotogrametria e nao-manifold em toda a parte:
    # `boulder_01` parou em 40 % por mais que se pedisse 1 %. Repetindo com a
    # razao recalculada, cada passagem parte do que a anterior conseguiu; quando
    # duas seguidas nao andam, desiste-se e diz-se.
    for _ in range(4):
        me.calc_loop_triangles()
        cur = len(me.loop_triangles)
        if cur <= alvo * 1.08:
            return
        md = o.modifiers.new('dec', 'DECIMATE')
        md.ratio = max(0.004, alvo / cur)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier='dec')
        me.calc_loop_triangles()
        if len(me.loop_triangles) > cur * 0.92:
            return


def _extract_from_forest(B, name):
    """Uma conifera da fonte, tronco e copa, na origem — para servir de muda."""
    trunk = B.get('Trunk_Oak')
    atlas = B.get('Background_Tree_Atlas')
    if not trunk or not atlas or not len(trunk.data.vertices):
        return None
    tc = np.zeros(len(trunk.data.vertices) * 3, dtype=np.float32)
    trunk.data.vertices.foreach_get('co', tc)
    tc = tc.reshape(-1, 3)
    best = None
    for ids in island_map(trunk.data):
        a = tc[ids]
        c = a.mean(axis=0)
        r = math.hypot(float(c[0]), float(c[1]))
        if 60.0 < r < 100.0:
            best = (ids, (float(c[0]), float(c[1]), float(a[:, 2].min())))
            break
    if best is None:
        return None
    ids, base = best
    ac = np.zeros(len(atlas.data.vertices) * 3, dtype=np.float32)
    atlas.data.vertices.foreach_get('co', ac)
    ac = ac.reshape(-1, 3)
    leaf = []
    for i in island_map(atlas.data):
        c = ac[i].mean(axis=0)
        if math.hypot(c[0] - base[0], c[1] - base[1]) < 7.0:
            leaf += list(i)
    return _extract_proto(name, [(trunk, ids, 'PH_MUDA_CASCA'),
                                 (atlas, leaf, 'PH_MUDA_FOLHA')], base)


def _zonas():
    """Amostradores de posicao, um por zona. Devolvem (x, y) candidatos.

    As zonas sao definidas em (estaca, offset) e nao em (x, y), e tem de ser: com
    o eixo curvo, "a 12 m do acostamento" nao e uma faixa reta. Quem converte e
    `offset_xy`, o mesmo referencial de Frenet do corredor — entao a orla da mata
    acompanha a curva em vez de a cortar.
    """
    def band(lo_f, hi_f, lados=(-1, 1)):
        """`lo_f`/`hi_f` recebem a APANHA daquela estaca e devolvem o offset.

        Passar funcoes em vez de numeros e o que deixa uma zona ser definida em
        relacao a linha de apanha, que muda de estaca para estaca: "o talude de
        aterro" nao e uma faixa de largura fixa, e tudo o que ha entre a banqueta
        e onde a obra morre — e ali a obra vai de 1,7 a 19,5 m do eixo.
        """
        def f(rng):
            side = lados[int(rng.integers(0, len(lados)))]
            s = float(rng.uniform(-LEN_B + 6, LEN_F - 6))
            w = catch_at(s, side)
            lo, hi = lo_f(w), hi_f(w)
            if hi <= lo + 0.15:
                return offset_xy(s, side * (lo + 0.15))
            return offset_xy(s, side * float(rng.uniform(lo, hi)))
        return f

    def disc(r0, r1):
        def f(rng):
            r = float(np.sqrt(rng.uniform(r0 * r0, r1 * r1)))
            a = float(rng.uniform(0, 2 * math.pi))
            return (r * math.cos(a), r * math.sin(a))
        return f

    K = lambda v: (lambda w: v)                    # noqa: E731 — bound constante
    return {
        # banqueta de brita e o primeiro metro de talude
        'banqueta': band(K(X_SHLD + 0.35), K(X_VERGE + 1.6)),
        # valeta e o pe do corte
        'valeta': band(K(X_VERGE + 0.2), K(X_VERGE + 3.2), lados=(-1,)),
        # face do talude de corte, do pe ate perto da apanha
        'facecorte': band(K(X_VERGE + 2.0), lambda w: w - 1.5, lados=(-1,)),
        'pecorte': band(K(X_VERGE + 0.8), K(X_VERGE + 5.5), lados=(-1,)),
        # a CRISTA: o metro antes e os dois depois de o corte apanhar o terreno
        'cristacorte': band(lambda w: w - 1.0, lambda w: w + 2.5, lados=(-1,)),
        # talude de aterro, da banqueta ate a apanha
        'aterro': band(K(X_VERGE + 1.0), lambda w: w - 0.5, lados=(1,)),
        # orla da mata, logo alem da apanha
        'orla': band(lambda w: w + 1.0, lambda w: w + 9.0),
        # piso de floresta
        'piso': disc(14.0, PROP_R),
    }


"""Quanto de cada peca fica ENTERRADO, em fracao da altura dela.

NAO E AFINACAO, E A CORRECAO DO QUE O RENDER MOSTROU. A primeira execucao
enterrava tudo 6 cm e o resultado esta fotografado: matacoes e afloramentos
PENDURADOS no talude, com a barriga escura a aparecer por baixo. A razao e
geometrica e nao de valor — a base do modelo e aproximadamente PLANA e o talude
tem 45 a 60 graus, entao apoiar a peca pelo ponto mais alto do terreno deixa o
resto dela no ar por metade da propria largura.

Duas coisas mudam por causa disso:

  1. A COTA VEM DO PONTO MAIS BAIXO da pegada, e nao do centro. Sondam-se cinco
     raios (centro e quatro a meia largura) e usa-se o MENOR — assim a peca
     entra no terreno do lado de cima em vez de flutuar do lado de baixo.
  2. E ainda se afunda esta fracao. Uma rocha meio enterrada le como afloramento,
     que e o que ela e; uma rocha pousada le como adereço.
"""
AFUNDA = {
    'aflora': 0.46, 'matacao': 0.42, 'matacao2': 0.42,
    'rmusgo_1': 0.40, 'rmusgo_2': 0.40, 'rmusgo_3': 0.40, 'rmusgo_4': 0.40,
    'toco': 0.16, 'raiz_a': 0.35, 'raiz_b': 0.35,
    'galho_a': 0.22, 'galho_b': 0.22, 'musgo_a': 0.25, 'musgo_b': 0.25,
}


def _plantar(proto, key, n, mix, zonas, bvh, rng, alinha_normal=False,
             escala=(0.82, 1.35)):
    if n <= 0 or proto is None:
        return 0
    # meia-largura e altura do prototipo, para saber onde sondar e quanto afundar
    co = np.array([[v.co.x, v.co.y, v.co.z] for v in proto.data.vertices])
    raio0 = float(max(co[:, 0].max() - co[:, 0].min(),
                      co[:, 1].max() - co[:, 1].min())) * 0.5
    alt0 = float(co[:, 2].max() - co[:, 2].min())
    frac = AFUNDA.get(key, 0.08)
    pesos = np.array([w for _, w in mix], dtype=float)
    pesos /= pesos.sum()
    nomes = [z for z, _ in mix]
    holder = instance_holder()
    made = 0
    tries = 0
    postos = []
    while made < n and tries < n * 60:
        tries += 1
        z = nomes[int(rng.choice(len(nomes), p=pesos))]
        f = zonas.get(z)
        if f is None:
            continue
        x, y = f(rng)
        if math.hypot(x, y) > PROP_R * 1.35:
            continue
        cs, cu = to_su(x, y)
        # NUNCA na plataforma: 40 cm de folga alem da banqueta
        if -LEN_B - 4 < cs < LEN_F + 4 and abs(cu) < X_VERGE + 0.4:
            continue
        h = bvh.ray_cast(Vector((x, y, 400.0)), Vector((0, 0, -1)))
        if h[0] is None:
            continue
        # espacamento minimo dentro do mesmo prototipo, para nao ficar aos pares
        if postos:
            P = np.array(postos)
            if np.hypot(P[:, 0] - x, P[:, 1] - y).min() < 1.15:
                continue
        postos.append((x, y))
        inst = proto.copy()
        bpy.context.scene.collection.objects.link(inst)
        inst.parent = holder
        sc = float(rng.uniform(*escala))
        # A COTA E O PONTO MAIS BAIXO DA PEGADA. Ver o cabecalho de AFUNDA.
        # OITO SONDAS EM DOIS ANEIS, e nao quatro num so: com quatro, um matacao
        # apanhado por uma diagonal do relevo continuava a boiar de um canto — foi
        # fotografado na miniatura, duas pedras com vao por baixo. O anel de dentro
        # apanha a corcova local e o de fora apanha a inclinacao geral.
        rr = max(0.18, raio0 * sc * 0.95)
        zmin = h[0].z
        for k in range(8):
            a2 = k * math.pi / 4.0
            for f2 in (0.55, 1.0):
                ox, oy = rr * f2 * math.cos(a2), rr * f2 * math.sin(a2)
                hh = bvh.ray_cast(Vector((x + ox, y + oy, 400.0)), Vector((0, 0, -1)))
                if hh[0] is not None:
                    zmin = min(zmin, hh[0].z)
        inst.location = (x, y, zmin - max(0.12, frac * alt0 * sc))
        rz = float(rng.uniform(0, 2 * math.pi))
        if alinha_normal:
            nrm = h[1]
            # ALINHA A NORMAL DO TERRENO POR INTEIRO, e nao a 70 % como na
            # primeira versao: com 70 % a peca ficava com a base a apontar para
            # um sitio e o talude para outro, e a diferenca abria justamente o vao
            # que se via por baixo. Uma pedra meio enterrada e alinhada nao le
            # como decalque — o que leria como decalque era a pedra ASSENTE, e
            # essa deixou de existir.
            ax = Vector((0, 0, 1)).cross(nrm)
            ang = Vector((0, 0, 1)).angle(nrm)
            if ax.length > 1e-5:
                m = (Matrix.Rotation(ang, 4, ax.normalized())
                     @ Matrix.Rotation(rz, 4, 'Z'))
                inst.rotation_euler = m.to_euler()
            else:
                inst.rotation_euler = (0, 0, rz)
        else:
            inst.rotation_euler = (float(rng.uniform(-0.05, 0.05)),
                                   float(rng.uniform(-0.05, 0.05)), rz)
        inst.scale = (sc, sc * float(rng.uniform(0.94, 1.06)), sc)
        inst.name = f"PH_{key}_{made:04d}"
        made += 1
    return made


def mask_alpha_props():
    """Os materiais alfa do acervo tambem tem de sair em `alphaMode: MASK`.

    Mesmo GOTCHA do `mask_alpha()` da fonte, e vale a pena repetir por que:
    `blend_method` e IGNORADO pelo exportador glTF do Blender 5.x, entao sem o
    no `Math GREATER_THAN` a samambaia sairia em BLEND, com `depthWrite:false`, e
    dentro de uma moita as folhas de tras seriam desenhadas por cima das da
    frente. Com 700 tufos instanciados isso e a cena inteira a ordenar mal.
    """
    n = 0
    for m in bpy.data.materials:
        if not m.name.startswith('PH_') or not m.node_tree:
            continue
        nt = m.node_tree
        bsdf = next((x for x in nt.nodes if x.type == 'BSDF_PRINCIPLED'), None)
        if not bsdf or not bsdf.inputs['Alpha'].links:
            continue
        if any(x.type == 'MATH' and x.operation == 'GREATER_THAN' for x in nt.nodes):
            continue
        lk = bsdf.inputs['Alpha'].links[0]
        gt = nt.nodes.new('ShaderNodeMath')
        gt.operation = 'GREATER_THAN'
        gt.inputs[1].default_value = 0.35
        nt.links.new(gt.inputs[0], lk.from_socket)
        nt.links.remove(lk)
        nt.links.new(bsdf.inputs['Alpha'], gt.outputs[0])
        n += 1
    log(f"  {n} materiais do acervo passados a alphaMode MASK")


# =========================================================================
def shrink_textures():
    """Reduz as texturas. CORRE NO MESMO PROCESSO DO EXPORT, e tem de correr.

    Era uma etapa propria que gravava `06_tex.blend`, e nao fazia NADA — o
    ficheiro seguinte reabria com as imagens no tamanho original. A razao e que
    `image.scale()` mexe so no buffer em memoria: o `packed_file` continua a
    conter os bytes codificados de origem, e e ele que o .blend grava. Medido
    depois de "reduzir" 4096 para 1024 e reabrir: 4096x4096, packed_bytes
    7 579 079. O .glb saia com os mesmos 22,69 MB ate ao byte, que foi o sinal.

    Sem etapa intermedia o buffer reduzido e o que o exportador le, e a reducao
    passa a existir.
    """
    # MEDIDO no primeiro .glb: `Aerial_Grass_Diffuse` (4,90 MB) e
    # `Aerial_Grass_Normal` (4,84 MB) davam 9,74 dos 20,41 MB de imagem — 48% do
    # ficheiro em DUAS texturas. E elas nao carregam detalhe nenhum: a UV do
    # `Aerial_Grass` esta a 159 m por unidade (medido), ou seja um ladrilho cobre
    # o sitio inteiro. A 1024 px isso da 6,4 pixeis por metro; e uma variacao
    # macro de cor, nao uma superficie. A 512/256 continua a ser exatamente a
    # mesma variacao e sai ~8 MB do ficheiro.
    LIMIT = {'Aerial_Grass_Diffuse.jpg': 512, 'Aerial_Grass_Normal.jpg': 256,
             'Aerial_Grass_Roughness.png.001': 256, 'Aerial_Grass_Roughness.png': 256,
             'Terrain_Far_Diffuse.jpg': 512}
    DEFAULT = 1024
    # O ACERVO ENTRA A 512, E A NORMAL A 256.
    # ------------------------------------------------------------------
    # Onze assets do Poly Haven trazem 1 024 em tres mapas cada; a 1 024 isso
    # sao ~4,5 MB de WebP so em props, quase metade do que o .glb inteiro pesa
    # hoje. E nao ha detalhe a perder: a maior peca do acervo aqui e um matacao
    # de 1,8 m visto a 8 m ou mais, e a 512 ele tem 280 pixeis de largura em
    # tela na pior das hipoteses. A normal desce mais um degrau porque o que ela
    # carrega numa pedra e relevo de centimetro, que a 8 m nao existe.
    PH_LIMIT, PH_NORMAL = 512, 256
    tot0 = tot1 = 0
    for im in bpy.data.images:
        w, h = im.size
        if w == 0:
            continue
        tot0 += w * h * 4
        lim = LIMIT.get(im.name, DEFAULT)
        low = im.name.lower()
        if _is_prop_image(im):
            lim = PH_NORMAL if ('nor' in low or 'gl' in low) else PH_LIMIT
        if max(w, h) > lim:
            s = lim / max(w, h)
            im.scale(max(1, int(w * s)), max(1, int(h * s)))
            log(f"  {im.name}: {w}x{h} -> {im.size[0]}x{im.size[1]}")
        tot1 += im.size[0] * im.size[1] * 4
    log(f"  imagens descomprimidas {tot0/1e6:.0f} MB -> {tot1/1e6:.0f} MB")


def _is_prop_image(im):
    """A imagem e EXCLUSIVA do acervo?

    A exclusividade nao e preciosismo. `PH_MUDA_CASCA` e uma COPIA do material
    `Trunk_Oak` — e uma copia de material reutiliza os mesmos datablocks de
    imagem, que e justamente o que a faz nao custar textura nova. Sem este teste,
    o atlas de casca das ~750 coniferas caia para 512 por ser "do acervo": medido
    na primeira execucao, `Trunk_Oak_Diffuse.png` foi de 234x1024 para 117x512
    sem ninguem pedir.
    """
    usado_por_props = False
    for m in bpy.data.materials:
        if not m.node_tree or not m.users:
            continue
        toca = any(nd.type == 'TEX_IMAGE' and nd.image is im
                   for nd in m.node_tree.nodes)
        if not toca:
            continue
        if m.name.startswith('PH_'):
            usado_por_props = True
        else:
            return False
    return usado_por_props


def stage_export():
    log("EXPORT — reduzir texturas, depois glb draco + webp")
    src = os.path.join(WORK, "06_props.blend")
    if not os.path.exists(src):
        src = os.path.join(WORK, "05_veg.blend")
    bpy.ops.wm.open_mainfile(filepath=src)
    shrink_textures()
    os.makedirs(OUTDIR, exist_ok=True)
    out = os.path.join(OUTDIR, "set.glb")

    # medidas para o bloco `bounds` do manifesto — em coordenadas do three
    xs, ys, zs = [], [], []
    for o in bpy.data.objects:
        if o.type != 'MESH':
            continue
        for v in o.bound_box:
            p = o.matrix_world @ Vector(v)
            xs.append(p.x); ys.append(p.y); zs.append(p.z)
    log(f"  caixa blender  x {min(xs):.1f}..{max(xs):.1f}  "
        f"y {min(ys):.1f}..{max(ys):.1f}  z {min(zs):.1f}..{max(zs):.1f}")
    log(f"  caixa three    x {min(xs):.1f}..{max(xs):.1f}  "
        f"y {min(zs):.1f}..{max(zs):.1f}  z {-max(ys):.1f}..{-min(ys):.1f}")

    # quantos individuos partilham cada malha — e o que vira instancia
    users = {}
    for o in bpy.data.objects:
        if o.type == 'MESH':
            users[o.data.name] = users.get(o.data.name, 0) + 1
    inst = sum(v for v in users.values() if v > 1)
    log(f"  {inst} objetos partilham {sum(1 for v in users.values() if v > 1)} malhas "
        f"=> saem em EXT_mesh_gpu_instancing")

    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=out, export_format='GLB', use_selection=True,
        export_yup=True, export_apply=True,
        # `export_gpu_instances` E O QUE FAZ ESTE CENARIO CABER.
        # ------------------------------------------------------------------
        # Sem ele, cada uma das ~1 600 pecas plantadas (props e mata distante)
        # sairia como uma malha propria no .glb — centenas de milhares de
        # poligonos gravados e 1 600 draw calls no app. Com ele, os individuos
        # que PARTILHAM a mesma malha viram uma primitiva mais um bloco de
        # matrizes (EXT_mesh_gpu_instancing), e o `GLTFLoader` do three monta um
        # `InstancedMesh` — que e exatamente a forma que `seethrough.ts` sabe
        # dissolver por individuo. Copiar objeto com `o.copy()` SEM copiar
        # `o.data` e o que produz essa partilha; copiar os dois desligaria isto
        # em silencio.
        export_gpu_instances=True,
        export_image_format='WEBP', export_image_quality=82,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_draco_color_quantization=8,
        export_vertex_color='ACTIVE',
        export_animations=False, export_skins=False, export_morph=False,
        export_cameras=False, export_lights=False, export_extras=False,
        export_tangents=False, export_unused_images=False,
    )
    log(f"  gravado {out}  ({os.path.getsize(out)/1e6:.2f} MB)")
    tri = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
    uniq = sum(len(m.polygons) for m in bpy.data.meshes if m.users)
    log(f"  {len(bpy.data.objects)} objetos, {tri} poligonos desenhados, "
        f"{uniq} de geometria unica, "
        f"{len(bpy.data.materials)} materiais, {len(bpy.data.images)} imagens")


STAGES = dict(prep=stage_prep, frame=stage_frame, land=stage_land,
              grade=stage_grade, road=stage_road, veg=stage_veg,
              props=stage_props, export=stage_export)

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    want = None
    for a in argv:
        if a.startswith('--stage='):
            want = a.split('=', 1)[1].split(',')
    if not want:
        want = list(STAGES)
    for s in want:
        STAGES[s]()
    log("fim")
