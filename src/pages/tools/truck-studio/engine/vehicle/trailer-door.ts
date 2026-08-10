/* Porta lateral — as peças DO PRÓPRIO IMPLEMENTO, no vão que a medida abre.
   ---------------------------------------------------------------------------
   ARQUIVO ESPELHADO. Cópia idêntica em:
     truck-studio-desktop/src/studio/trailer-door.ts
     web/src/pages/tools/truck-studio/engine/vehicle/trailer-door.ts
   Não importa nada além de tipos. Ao mexer aqui, sincronize as duas cópias.

   ===========================================================================
   DE ONDE SAI CADA NÚMERO

   A porta do modelo da Ibiporã foi lida do `.gltf` COM HIERARQUIA — o único
   arquivo em que ela está montada. Os `.zip` de OBJ do mesmo modelo são
   capturas por chamada de desenho e perderam as matrizes de instância: as 86
   cabeças de rebite têm todas o mesmo centro. Medir a porta por eles leva a
   conclusões erradas com cara de certas, inclusive "a parede não é cortada".
   A subárvore `#porta-lateral` tem 188 nós com transformação real, em metros.

   A folha mede 870 × 2350 mm. Os números de layout, relativos ao PÉ e à borda
   correspondente da folha:

     4 dobradiças      borda dianteira, 1ª a 143 mm do pé, passo 688 mm
     1 varão           105 mm da borda do fecho, 15 mm além da folha por ponta
     4 guias de varão  35 mm de cada ponta, mais 0,362 e 0,638 da altura
     2 fechos de ponta nas extremidades do varão
     manípulo          163 mm do pé — é fecho BAIXO, não na altura do peito
     alavanca          8 mm do pé, 195 mm da borda do fecho

   NÃO HÁ MOLDURA SALIENTE. Os seis perfis galvanizados da porta estão em
   x −1,2265, ou seja 73 mm ATRÁS da crista da pele. Versões anteriores deste
   arquivo leram isso como "não existe batente" e desenharam a porta rasante
   numa parede lisa — mas o que aquele número diz é o contrário: o batente
   existe, é RECUADO, e é justamente ele que se vê pelo vão. A faixa escura em
   volta da folha na foto de catálogo não é sombra, é o batente a 73 mm.

   ===========================================================================
   AS PEÇAS JÁ ESTÃO NO `trailer.glb`

   Procurando no NOSSO implemento as medidas lidas do `.gltf`, cinco das sete
   famílias saem idênticas ao milímetro — são a mesma peça que as portas
   traseiras usam:

     manípulo         43 × 124 ×  247  ×4  inox-ferragem       IDÊNTICO
     contra-fecho     37 × 110 ×  271  ×4  inox-ferragem       IDÊNTICO
     fecho de ponta   35 ×  92 ×   75  ×8  inox-ferragem       IDÊNTICO
     guia             36 ×  58 ×  134  ×4  inox-ferragem       IDÊNTICO
     alavanca         12 × 150 ×   54  ×2  metal-pouco-polido  IDÊNTICO
     varão            25 ×  25 × 2490  ×4  inox-ferragem       (a porta usa 2380)
     tala             46 ×  92 ×  312  ×8  inox-ferragem       (a porta usa 283)

   As duas últimas são a mesma família num comprimento diferente, e as duas são
   EXTRUSÕES — esticar no próprio eixo é exato, o mesmo argumento que
   `trailer-geometry.ts` usa para a chapa lateral.

   Por isso NÃO EXISTE ASSET NOVO: o kit é extraído do `trailer.glb` em runtime
   (`extractDoorKit()` lá). A textura é a mesma por CONSTRUÇÃO, não por
   aproximação — é a mesma malha e o mesmo material. Uma tentativa anterior
   assava um `door_side.glb` à parte e ele saiu branco liso, porque um rip sem
   `usemtl` não tem material para levar junto.

   ===========================================================================
   COMO CADA PEÇA ACOMPANHA A MEDIDA

   Cada uma segue um comportamento que este projeto já tem em outro lugar:

     folha        frisos empilhados em Y, estica em Z    `RIBBED` do corpo branco
     varão        estica no próprio eixo                 extrusão pura
     dobradiças   PASSO FIXO, contagem varia             `RepeatSet` da fita 3M
     guias        duas nas pontas, duas por fração       idem
     manípulo     ancorado ao PÉ, não escala             peça pequena translada
     fechos       ancorados às pontas do varão           idem

   O passo fixo é a parte que importa: uma porta de 3 m não leva 4 dobradiças
   esticadas, leva 5 no mesmo passo de 688 mm. É a doutrina que `livery-layers.ts`
   já enuncia para a fita 3M — "um baú mais longo leva mais unidades, não as
   mesmas esticadas".
*/

/** Retângulo da FOLHA no plano do painel, em coordenadas finais do modelo. */
export interface DoorRect { y0: number; y1: number; z0: number; z1: number }

/**
 * O plano em que a porta é montada.
 *
 * `xSkin` é a CRISTA do friso daquela lateral e `sign` diz para que lado é
 * "fora". Os dois vêm medidos do corpo branco, nunca arbitrados.
 */
export interface DoorPlane { xSkin: number; sign: 1 | -1 }

/* ---------------------------------------------------------------- as peças */

/**
 * As catorze famílias da porta, na nomenclatura do conjunto real.
 *
 * A lista veio do INVENTÁRIO da `#porta-traseira-direita` — ver
 * `tools/trailer-bench/PORTA-TRASEIRA-DIREITA.md`, que traz cada peça em
 * coordenadas da porta. A versão anterior tinha sete famílias escolhidas a olho
 * e duas delas identificadas errado: o `134 × 58 × 36` de `metal-claro`, que ela
 * chamava de GUIA e espalhava em quatro alturas ao longo do varão, é peça do
 * FECHO e mora a 193 mm do pé; a guia de verdade é o `100 × 34 × 41`, são DUAS,
 * a 885 e 1565 mm, e vêm com um suporte no mesmo ponto.
 */
export type DoorPart =
  /* dobradiça */
  | 'TALA' | 'PINO' | 'PORCA' | 'TRAVA_PINO' | 'REBITE'
  /* varão */
  | 'VARAO' | 'CABECOTE' | 'GUIA' | 'SUPORTE_GUIA' | 'ANEL' | 'MACHO'
  /* fecho */
  | 'BATENTE' | 'SUPORTE_FECHO' | 'CONTRAFECHO' | 'MANIPULO' | 'ALAVANCA' | 'TRINCO'
  /* soldadas ao marco */
  | 'SUPORTE_TALA' | 'ENCAIXE'
  /* vedação */
  | 'BORRACHA_V' | 'BORRACHA_H';

/**
 * A assinatura de cada peça dentro do `trailer.glb`.
 *
 * `size` está no referencial DA PORTA — [profundidade para fora, altura,
 * comprimento] — e é dele que `extractDoorKit()` DERIVA a permutação de eixos,
 * em vez de alguém escrevê-la. Foi uma permutação escrita à mão que entregou um
 * kit inteiro deitado 90°: as medidas certas nos eixos errados, sem um erro
 * para denunciar. Derivada da própria medida, essa classe de defeito não volta.
 */
export interface DoorPartSpec {
  part: DoorPart;
  /** [X profundidade, Y altura, Z comprimento], em metros, como está no baú. */
  size: [number, number, number];
  /** O material que identifica a peça, no nome que o `trailer.glb` usa. */
  material: RegExp;
  /** Onde fica a origem da peça depois de normalizada. */
  anchor: 'centro' | 'base';
}

/**
 * A FERRAGEM, no material que o nosso bake usa.
 *
 * O rip da Ibiporã separa `metal-pouco-polido`, `metal-claro` e `parafusos`; o
 * nosso `trailer.glb` traz quase tudo como `inox-ferragem`. Casar por NOME
 * exato perdia peça — a `ALAVANCA` some do kit até hoje por isso. Quem
 * identifica é o TAMANHO, com 4 mm de tolerância; o material só delimita a
 * busca para que o casamento não vá pescar uma peça de chassi.
 */
const HW = /inox-ferragem|metal-pouco-polido|metal-claro|parafusos/i;
const RUBBER = /borracha-preta/i;
/**
 * O suporte da guia do varão tem MATERIAL PRÓPRIO no nosso bake.
 *
 * `suporte-varao-preto`, e não `inox-ferragem`. Enquanto ele não estava listado
 * aqui, o casamento por tamanho ia pescar em `inox-ferragem` a peça mais
 * parecida que houvesse — e havia: uma caixa de 8 triângulos, 45,3 × 35 × 38,9,
 * que é um CANTO do marco da traseira (x ±1,2654, y 4,1044) e passava a 3 mm,
 * dentro de `PART_TOL`. Ela era instanciada nas duas alturas de guia da porta
 * lateral, e é o que a tela relatou como "essas peças centrais estão estranhas".
 */
const GUIDE_MOUNT = /suporte-varao-preto/i;
/** O trinco que prende a folha aberta — também com material próprio. */
const LATCH = /engate-macho-preto/i;

/**
 * As dezenove peças, medidas na PORTA TRASEIRA DIREITA DO NOSSO `trailer.glb`.
 *
 * ESTA É A MUDANÇA QUE CONSERTOU O KIT. Até aqui os `size` vinham do rip da
 * Ibiporã, e o rip não é o nosso bake: quatro famílias — `SUPORTE_TALA`,
 * `ENCAIXE`, `BORRACHA_H` e `ALAVANCA` — nunca foram encontradas, e uma quinta
 * (`SUPORTE_GUIA`) era encontrada ERRADA. As medidas abaixo saíram de
 * `node tools/trailer-bench/dump-kit.mjs`, que varre o nosso GLB e devolve cada
 * malha da região da traseira agrupada por material e tamanho.
 *
 * O que estava errado, item por item:
 *
 *   SUPORTE_TALA   existe, `inox-ferragem` e não `metal-estrutura-principal-
 *                  padrao`: 25,4 × 113,8 × 45,9, n=4, no u do PINO, nas alturas
 *                  da tala. O filtro de material é que a escondia.
 *   ENCAIXE        existe, `inox-ferragem`: 101,5 × 36,5 × 44, n=8, 59,8 mm
 *                  além de cada ponta da folha. Mesmo filtro errado.
 *   BORRACHA_H     existe: a travessa tem 1215 mm no nosso bake, não os 1100
 *                  do rip — 115 mm fora, muito além de `PART_TOL`.
 *   ALAVANCA       existe: 39 × 149,5 × 10,7, e não 54 × 150 × 12.
 *   SUPORTE_GUIA   existe em MATERIAL PRÓPRIO (`suporte-varao-preto`),
 *                  38 × 44 × 41. Ver a nota em `GUIDE_MOUNT`.
 *
 * `size` está no referencial DA PORTA: [profundidade para fora, altura,
 * comprimento]. O inventário sai em (du, dv, dw) — ao longo do painel, altura,
 * para fora — então a conversão é `[dw, dv, du]`, que é o giro de −90° em Y que
 * leva a porta traseira à lateral.
 */
export const DOOR_PARTS: DoorPartSpec[] = [
  /* dobradiça */
  { part: 'TALA', size: [0.046, 0.092, 0.312], material: HW, anchor: 'centro' },
  { part: 'PINO', size: [0.0224, 0.1299, 0.0225], material: HW, anchor: 'centro' },
  { part: 'PORCA', size: [0.025, 0.034, 0.025], material: HW, anchor: 'centro' },
  /* Trava do pino: a peça de 16 × 10 × 15 que mora 50…60 mm abaixo de cada
     tala, no mesmo u e no mesmo w do pino. Três dimensões parecidas seriam
     permutação ambígua no casamento antigo; com a escolha de eixo por OFFSET
     MEDIDO (ver `extractDoorKit`) ela sai determinada. */
  { part: 'TRAVA_PINO', size: [0.015, 0.010, 0.016], material: HW, anchor: 'centro' },
  { part: 'REBITE', size: [0.0305, 0.0167, 0.0167], material: HW, anchor: 'centro' },
  /* varão */
  { part: 'VARAO', size: [0.0254, 2.490, 0.0251], material: HW, anchor: 'base' },
  { part: 'CABECOTE', size: [0.0425, 0.161, 0.083], material: HW, anchor: 'centro' },
  { part: 'GUIA', size: [0.0414, 0.034, 0.100], material: HW, anchor: 'centro' },
  { part: 'SUPORTE_GUIA', size: [0.041, 0.044, 0.038], material: GUIDE_MOUNT, anchor: 'centro' },
  { part: 'ANEL', size: [0.0358, 0.009, 0.036], material: HW, anchor: 'centro' },
  { part: 'MACHO', size: [0.035, 0.092, 0.0754], material: HW, anchor: 'centro' },
  /* as duas peças SOLDADAS AO MARCO — o macho da dobradiça e o encaixe que
     recebe o came do varão. As duas em `inox-ferragem`, como todo o resto. */
  { part: 'SUPORTE_TALA', size: [0.0459, 0.1138, 0.0254], material: HW, anchor: 'centro' },
  { part: 'ENCAIXE', size: [0.044, 0.0365, 0.1015], material: HW, anchor: 'centro' },
  /* --- a BORRACHA, extraída em vez de desenhada ---
     Dois perfis, os dois EXTRUSÕES, então esticar cada um no próprio eixo é
     exato — o mesmo argumento do varão e da chapa. Comprimentos do NOSSO bake:
     montante 2530 mm, travessa 1215 mm (`SEAL_V_LEN`/`SEAL_H_LEN`). */
  { part: 'BORRACHA_V', size: [0.0777, 2.530, 0.0479], material: RUBBER, anchor: 'base' },
  { part: 'BORRACHA_H', size: [0.0776, 0.0478, 1.215], material: RUBBER, anchor: 'centro' },
  /* fecho */
  { part: 'BATENTE', size: [0.013, 0.115, 0.0415], material: RUBBER, anchor: 'centro' },
  { part: 'SUPORTE_FECHO', size: [0.0355, 0.0582, 0.1339], material: HW, anchor: 'centro' },
  { part: 'CONTRAFECHO', size: [0.0365, 0.1103, 0.2711], material: HW, anchor: 'centro' },
  { part: 'MANIPULO', size: [0.0425, 0.124, 0.247], material: HW, anchor: 'centro' },
  { part: 'ALAVANCA', size: [0.0107, 0.1495, 0.039], material: HW, anchor: 'centro' },
  { part: 'TRINCO', size: [0.0124, 0.065, 0.054], material: LATCH, anchor: 'centro' },
];

/** Casamento de dimensão na busca do kit: 4 mm. Mais folgado casaria peças
 *  vizinhas do baú; mais apertado perderia a peça por arredondamento do bake. */
export const PART_TOL = 0.004;

/** Comprimento do varão no baú — denominador da escala em Y. */
const VARAO_LEN = 2.490;

/* ===========================================================================
   A SEÇÃO DA PORTA, MEDIDA NÓ A NÓ NO `.gltf`

   Tudo abaixo saiu de uma varredura da hierarquia com as matrizes aplicadas —
   `#porta-lateral` (nó 2472) MAIS os nós de borracha (`borracha-porta-lateral-01
   …04`) e de marco (`estrutura-principal-34…51`), que ficam FORA daquela
   subárvore. Escaparam de todas as leituras anteriores por isso, e a omissão
   deles é o que explica as versões erradas desta feature.

   ATRAVESSANDO A PAREDE (x, contra a crista da pele em −1,2995):

     marco    `metal-estrutura-principal-padrao`  −1,2935…−1,2284   6,0 … 71,1 mm
     borracha `borracha-preta`                    −1,2950…−1,2234   4,5 … 76,1 mm
     folha    `Cor_padrao_branco`, FRISADA        −1,2944…−1,2883   5,1 … 11,2 mm
     forro    `Cor_padrao_branco`, liso 2,3 mm    −1,2304…−1,2280  69,1 … 71,5 mm

   NÃO EXISTE REBAIXO. Marco, borracha e folha começam todos entre 4,5 e 6,0 mm
   atrás da crista: a porta é praticamente RASANTE com a parede. A faixa escura
   em volta dela nas fotos de catálogo não é sombra de um vão fundo — é o MARCO,
   e ele é escuro porque o MATERIAL é escuro. Uma versão anterior leu os 73 mm
   dos perfis internos como "profundidade do batente" e cavou um poço que o
   implemento não tem; é o "está afundando demais a chapa".

   O `−1,2304` que essa versão chamou de folha é o FORRO — a chapa lisa de
   2,3 mm que fecha a porta por dentro. A folha que se vê de fora é o nó 2354,
   frisada, a 5,1 mm.

   ATRAVESSANDO O PAINEL (z, a partir da borda da folha):

     borda do vão na chapa   z 0,2704           −94,4 mm
     marco                   z 0,2704…0,3491    −94,4 … −15,7 mm  (78,7 de largura)
     borracha                z 0,3282…0,3710    −36,6 … +6,2 mm   (42,8 de seção)
     folha                   z 0,3648…1,2348      0 … 870 mm

   A borracha MONTA nos dois: 20,9 mm sobre o marco e 6,2 mm sobre a folha. É o
   que uma vedação de porta faz, e é o que fecha a junta sem deixar fresta —
   nenhuma das três superfícies precisa adivinhar onde a outra termina.
   =========================================================================== */

/**
 * Folga do VÃO em relação à folha, por lado. MEDIDA: a pele abre de z 0,2704 a
 * 1,3292 (1 058,8 mm) para uma folha de 870,0 mm — 94,4 mm de cada lado.
 *
 * O número só é usável com MARCO e BORRACHA construídos, e é aí que duas
 * versões anteriores se perderam. Sem nada fechando a faixa, 94,4 mm de vão
 * viram buraco e se enxerga o interior do baú; a reação foi encolher a folga
 * para 12 mm e recuar a folha 25 mm, "para a folha tapar a vista". A conta nem
 * fechava: uma folha 12 mm maior que o vão, 25 mm atrás dele, só tapa o
 * interior até atan(12/25) = 25,6° fora da normal — abaixo de qualquer volta de
 * câmera do estúdio.
 */
export const DOOR_REVEAL = 0.0944;

/**
 * Quanto a folha fica para DENTRO da crista da pele. MEDIDA: 5,1 mm (pele em
 * x −1,2995, folha em −1,2944) — a folha é praticamente rasante com a parede.
 *
 * O valor importa para além do próprio recuo: as saliências de `OUT_*` abaixo
 * foram medidas contra a CRISTA no mesmo arquivo, ou seja num implemento cuja
 * folha está 5,1 mm atrás dela. Recuar a folha e deixar `OUT_*` como está
 * afasta a ferragem da folha que ela parafusa — com o recuo de 25 mm que este
 * arquivo já teve, sobravam 17 mm de ar entre a dobradiça e a porta, que é
 * exatamente a leitura de "a porta está virada para dentro". Voltando à medida,
 * as duas famílias de números voltam a ser consistentes por construção.
 */
export const LEAF_INSET = 0.0051;

/* marco — o perfil que contorna o vão */
/**
 * Largura do marco, da borda do vão para dentro. **78,7 mm — a medida.**
 *
 * Esteve 40 mm, "por decisão de aparência", e o preço era um FURO: o marco
 * cobria de 94,4 a 54,4 mm da folha, a borracha vai de 35,25 mm para fora até
 * 12,65 mm para dentro, e entre 54,4 e 35,25 sobravam 19 mm de fresta aberta
 * para o interior do baú em toda a volta da porta. Com 78,7 o marco chega a
 * 15,7 mm da folha e a borracha MONTA 19,55 mm sobre ele — que é exatamente o
 * que o rip mede ("a borracha monta 20,9 mm no marco") e o que o nosso bake
 * confirma no perfil da traseira (73,1 mm de largura, a 20 mm da folha).
 *
 * A queixa que motivou os 40 mm — "o marco renderiza claro e a porta some na
 * parede" — não se resolvia estreitando o marco: quem carrega o contorno escuro
 * é a borracha, e ela estava 38 mm à frente da parede, sem lugar de sombra. Ver
 * `SEAL_W`.
 */
export const FRAME_WIDTH = 0.0787;
/** Face do marco, atrás da crista. Medido: 6,0 mm. */
export const FRAME_FRONT = 0.0060;
/** Profundidade do marco. Medido: 65,1 mm (−1,2935 a −1,2284). */
export const FRAME_DEPTH = 0.0651;

/* --------------------------------------------------------------- moldura
   A TIRA GALVANIZADA em volta do vão — pedido de produto (2026-08-10): "uma
   moldurinha bem sutil em volta do frame metálico, uma pequena tira de
   elevação, galvanizada e não inox". É o arremate que um implemento montado
   tem na boca do vão, e as três medidas abaixo são DECISÃO DE APARÊNCIA
   (registradas aqui, não escondidas): estreita e quase rasante, para ler como
   arremate e não como segundo marco. */
/** Largura da tira, da borda do vão para FORA, sobre a parede. Esteve 22 mm e
 *  leu como segundo marco — "muito grosso, precisa ser 1/3". */
export const TRIM_WIDTH = 0.0073;
/** Quanto ela fica À FRENTE da crista do friso — a "pequena elevação".
 *  Dobrada de 2,5 para 5 mm no mesmo ajuste ("pode ser 2x a altura"). */
export const TRIM_PROUD = 0.005;
/** Até onde ela desce atrás da crista: 6,2 mm passa o vale do friso (5,2 mm)
 *  e fecha contra a chapa em qualquer fase, sem fresta por trás. */
export const TRIM_SINK = 0.0062;

/* --------------------------------------------------------------- borracha
   A VEDAÇÃO, MEDIDA NO NOSSO BAKE (porta traseira direita) — e é aqui que a
   versão anterior errava por 38 mm.

   O perfil extraído é `borracha-preta`, seção 47,9 × 77,6 mm. No implemento ele
   fica assim, contra a FOLHA:

     no plano do painel   linha de centro 11,3 mm PARA FORA da borda da folha,
                          ou seja monta 12,65 mm sobre a folha e sobra 35,25 mm
                          por cima do marco;
     em profundidade      centro 38,2 mm ATRÁS da face da folha — a face externa
                          da borracha fica 4,5 mm atrás da crista da pele, que é
                          1,5 mm À FRENTE do marco e é o que faz a vedação
                          encostar nos dois.

   `SEAL_W` já foi `LEAF_INSET − SEAL_FRONT` = +0,6 mm, e esse número é a POSIÇÃO
   DA FACE, não a do centro. Como `anchor: 'base'` centra a peça em profundidade,
   o perfil inteiro saía 38 mm PARA FORA da parede: é o "a borracha está
   estranha" e o "as borrachas devem ir um pouco para dentro". A conversão face →
   centro é a subtração de meia seção, e está escrita como conta abaixo para não
   voltar a ser esquecida. */
/** Seção da borracha no plano do painel. Medido: 47,9 mm. */
export const SEAL_SECTION = 0.0479;
/** Profundidade da borracha. Medido: 77,6 mm. */
export const SEAL_DEPTH = 0.0776;
/** Linha de centro da borracha, para FORA da borda da folha. Medido: 11,3 mm. */
export const SEAL_OUT = 0.0113;
/** Quanto ela monta SOBRE a folha — consequência das duas acima: 12,65 mm. */
export const SEAL_OVERLAP = SEAL_SECTION / 2 - SEAL_OUT;
/**
 * Quanto a FACE da borracha fica À FRENTE da face da folha. **4,5 mm.**
 *
 * Medido no nosso bake, e não derivado do rip. O rip dá 0,6 mm (folha a 5,1 mm
 * da crista, borracha a 4,5), e 0,6 mm não sobrevive à renderização: a folha é
 * FRISADA e as pontas de friso dela, no trecho em que a borracha monta por
 * cima (12,65 mm), ganham o teste de profundidade em ângulo rasante. Aparecem
 * como dentes brancos serrilhados dentro da faixa preta, ao longo de toda a
 * altura da porta. Com os 4,5 mm da nossa traseira, a borracha passa à frente
 * da CRISTA do friso da folha (que tem 5,2 mm de relevo) e o serrilhado some.
 */
export const SEAL_PROUD = 0.0045;
/** Face da borracha, atrás da crista da pele: 5,1 − 4,5 = 0,6 mm. */
export const SEAL_FRONT = LEAF_INSET - SEAL_PROUD;
/** `w` do CENTRO da borracha, medido da face da folha. Negativo: o grosso do
 *  perfil fica ATRÁS da folha, e é por isso que toda a ferragem passa por cima
 *  dela sem que ninguém precise ordenar nada. */
export const SEAL_W = SEAL_PROUD - SEAL_DEPTH / 2;
/** Comprimento de fábrica de cada perfil — o denominador da escala. */
const SEAL_V_LEN = 2.530, SEAL_H_LEN = 1.215;

/* As peças soldadas ao marco (macho da dobradiça, encaixe do varão) tiveram
   constantes INVENTADAS aqui — largura, altura e profundidade escolhidas "pelo
   que a peça tem de receber". Estava errado: elas existem no implemento, em
   `metal-estrutura-principal-padrao`, fora da subárvore da porta. Viraram
   `SUPORTE_TALA` e `ENCAIXE` em `DOOR_PARTS`, extraídas como o resto do kit. */

/** Folga entre o topo do perfil metálico inferior e o pé da porta. O perfil da
 *  saia sobe 127,5 mm acima da linha do piso do corpo branco; quem MEDE o topo
 *  é `TrailerBody`, aqui fica só o respiro acima dele. */
export const SILL_CLEARANCE = 0.008;

/** Pé da cantoneira de topo abaixo do teto: 207,4 mm (`CANTONEIRA_DROP` em
 *  `livery-layers.ts`, repetido porque este módulo não importa aquele). */
export const HEAD_DROP = 0.2074;

/* ===========================================================================
   O LAYOUT, TRANSCRITO DO INVENTÁRIO DA TRASEIRA DIREITA

   Cada número abaixo é uma linha de `PORTA-TRASEIRA-DIREITA.md`. As unidades
   são as de lá:

     u  ao longo do painel, a partir da borda da DOBRADIÇA
     v  altura a partir do pé da folha
     w  para FORA, a partir da FACE DA FOLHA

   `w` é o datum que este arquivo mais errou. Ele já foi ancorado na face da
   folha (e a ferragem afundou quando a folha recuou), depois na crista da pele
   (e a ferragem descolou da folha). O certo é o do inventário — a peça é
   parafusada NA FOLHA, então a folha é o datum —, e a conversão para a crista
   é uma linha só, em `layoutDoor()`: `d = w − LEAF_INSET`. Assim `LEAF_INSET`
   pode mudar sem soltar nada.

   A folha da traseira tem 1200 × 2450 mm. O que é medido a partir da borda da
   dobradiça fica ancorado em `z0`; o que está do lado do varão é reancorado na
   borda oposta (`1200 − u`), para a porta poder ter outra largura.
   =========================================================================== */

/* --- dobradiça: u da borda da charneira, v centrada na altura da folha --- */
/** Eixo da tala. Medido: u 64,2 · w 23,7. */
const TALA_U = 0.0642, TALA_W = 0.0237;
/**
 * Passo entre talas. **685,4 mm — o do NOSSO bake.**
 *
 * Esteve 682,05, que é o do rip. Sobre a folha traseira de 2460 mm os dois dão
 * n = 4, mas só 685,4 reproduz a primeira tala em 201,9 mm do pé, que é a
 * medida: (2460 − 3 × 685,4) / 2 = 201,9 exato. Com 682,05 ela nascia em 206,9.
 */
const TALA_PITCH = 0.6854;
/* A folga do pé até a 1ª tala na porta de fábrica — 201,9 mm, e a mesma no topo
   — não é constante: ela é CONSEQUÊNCIA de a folha ter 2460 mm e o passo 685,4.
   Já foi `TALA_FIRST` e servia de divisor da contagem, o que amarrava a folga
   de fábrica ao limite do que cabe. Ver `TALA_EDGE` e `talaHeights()`. */
/**
 * Margem mínima da tala à borda da folha, e o divisor da contagem. **60 mm**,
 * contra os 46 mm de meia tala.
 *
 * A contagem já usou `TALA_FIRST` como margem, e isso amarrava duas coisas que
 * não são a mesma: a folga DE FÁBRICA (201,9 mm, consequência de a folha ter
 * 2460 mm e o passo 685,4) e o LIMITE do que cabe. Com a folga como divisor,
 * uma folha de 2450 mm caía para três dobradiças — 10 mm a menos e uma
 * dobradiça a menos — porque `(2450 − 403,8) / 685,4 = 2,985`. Com a margem
 * real, 2450 e 2460 dão as mesmas quatro, e a de 2460 sai em 201,9 exato.
 */
const TALA_EDGE = 0.060;
/** Abaixo deste vão útil não cabem duas talas com respiro. */
const TALA_MIN_SPAN = 0.40;
/** Pino da dobradiça: u −80,3 (FORA da folha, sobre o marco) · w 35,2. */
const PINO_U = -0.0803, PINO_W = 0.0352;
/** Porcas do pino, 2 por tala, a ±32 mm do eixo dela. */
const PORCA_DV = 0.032;
/** Trava do pino: mesmo u e w do pino, 60 mm ABAIXO do eixo da tala. */
const TRAVA_PINO_DV = -0.060;
/** Rebites da tala: duas colunas (u 65,2 e 205,2), duas linhas (±37,5). */
const REBITE_U = [0.0652, 0.2052], REBITE_DV = 0.0375, REBITE_W = -0.0062;

/* --- varão: u a partir da borda OPOSTA à da dobradiça ---
   As cotas abaixo são a distância da borda LIVRE da folha (1200 − u), lidas no
   nosso bake sobre a folha traseira direita, cujo varão livre está em u 1091,9
   de 1200. O rip dá os mesmos espaçamentos RELATIVOS ao varão, deslocados 8,3 mm
   — o datum dele é outro. Como o kit é o nosso, o datum é o nosso. */
/** Eixo do varão: 108,1 mm da borda livre · w 22,9. */
const VARAO_D = 0.1081, VARAO_W = 0.0229;
/** Quanto o varão passa da folha em cada ponta: (2490 − 2460) / 2. */
const VARAO_OVER = 0.015;
/** Cabeçote de ponta: v 50,5 do pé e 50,5 do topo · w 22,2. */
const CABECOTE_V = 0.0505, CABECOTE_W = 0.0222;
/** Guias do varão: DUAS, em fração da altura. Medidas: 888,3 e 1571,6 de 2460 →
 *  0,3611 e 0,6389 — e as duas caem DENTRO das faixas lisas da folha
 *  ([0,3302 0,3903] e [0,6234 0,6835]), que é o que as faixas existem para
 *  receber. Ficam na medida, e não no centro da faixa: a peça é que manda. */
const GUIA_FRAC = [0.3611, 0.6389];
const GUIA_W = 0.0217, SUPORTE_GUIA_W = 0.0215;
/** Rebites da guia: dois, a ±33 mm do eixo do varão, na altura dela · w −7,7. */
const GUIA_REBITE_DD = 0.033, GUIA_REBITE_W = -0.0077;
/**
 * Anéis do varão: v 10 do pé e do topo · w 23. UM por ponta.
 *
 * O rip dizia quatro (10 · 104 · 2346 · 2440) e este arquivo os desenhava — mas
 * o NOSSO bake tem só dois por varão (`kit.json`: v 10,1 e 2450,1, nada em
 * 104). O par extra caía DENTRO do vão do cabeçote (que vai de −30 a +131 da
 * ponta): é o anel flutuando sobre a trava superior do varão que a tela
 * apontou como "parafusos no local errado".
 */
const ANEL_V = [0.010], ANEL_W = 0.0230;
/** Macho de ponta: 87,9 mm da borda livre · v −32,8 (ABAIXO da folha) · w 23. */
const MACHO_D = 0.0879, MACHO_OVER = 0.0328, MACHO_W = 0.0230;
/**
 * Rebites do cabeçote: ±31 mm do eixo do varão, DOIS pares por cabeçote, a
 * v 41 e 121 da ponta · w −6,2 — como o rip sempre disse.
 *
 * A fileira de 41 chegou a ser REMOVIDA daqui com base numa varredura dos
 * rebites da traseira que não a mostrava — mas a lista de Y daquele dump era
 * TRUNCADA, e o render da nossa própria traseira desmente a conclusão: cada
 * cabeçote mostra quatro parafusos, um par no topo e um no pé da chapa da
 * flange. A remoção é o "os dois parafusos da primeira peça que segura o
 * varão em cima estão sem". Uma lista cortada não é uma lista vazia.
 */
const CABECOTE_REBITE_DD = 0.031, CABECOTE_REBITE_V = [0.041, 0.121];
const CABECOTE_REBITE_W = -0.0062;

/* --- as duas peças soldadas ao MARCO, medidas no NOSSO bake --- */
/** Macho da dobradiça: mesmo u do pino, altura da tala · w 24,8. */
const SUPORTE_TALA_W = 0.0248;
/** Encaixe do varão: v −59,8 e +59,8 das pontas da folha, 90,4 mm da borda
 *  livre — ou seja no u do MACHO que ele recebe, e não no do varão · w 23. */
const ENCAIXE_OVER = 0.0598, ENCAIXE_D = 0.0904, ENCAIXE_W = 0.0230;
/** Rebite do encaixe: um, no eixo dele (90 mm da borda) · w −3,2. */
const ENCAIXE_REBITE_D = 0.0900, ENCAIXE_REBITE_W = -0.0032;

/* --- fecho: tudo a v ≈ 193 mm, altura de canela --- */
const FECHO_V = 0.1932;
/**
 * Batente do fecho: 384,8 mm da borda livre — e o número tem história.
 *
 * A porta traseira do nosso bake tem DOIS fechos completos (v 193 e v 373 mm,
 * um varão cada) e por isso DOIS batentes: (D 380,6 · v 193) e (D 322,3 ·
 * v 373), medidos em `kit.json`. Este arquivo já teve 376,5 (o número do rip,
 * certo) e foi "corrigido" para 318,3 quando uma medição achou o batente DO
 * OUTRO fecho e o pôs na altura deste — o resultado era a peça preta enfiada
 * na ponta do manípulo (tala do manípulo até ~316 mm; batente em 298…339).
 * Com 384,8 (o D 380,6 na convenção deste arquivo, que mede os três metais do
 * fecho +4,2 mm — manípulo 192,9/188,7, contra-fecho 228,6/224,4, suporte
 * 282,0/277,8) ele volta para onde o bake o mostra: 364…405 mm, livre da
 * ponta do manípulo, como o rip sempre disse.
 */
const BATENTE_D = 0.3848, BATENTE_W = 0.0340;
const SUPORTE_FECHO_D = 0.2820, SUPORTE_FECHO_W = 0.0239;
const CONTRAFECHO_D = 0.2286, CONTRAFECHO_W = 0.0232;
const MANIPULO_D = 0.1929, MANIPULO_W = 0.0220;
const ALAVANCA_D = 0.2200, ALAVANCA_V = 0.0077, ALAVANCA_W = 0.0057;
/** Trinco que prende a folha: mesmo u da alavanca, 50 mm do pé · w 6,5. */
const TRINCO_D = 0.2200, TRINCO_V = 0.0500, TRINCO_W = 0.0065;
/** Rebites do fecho, em [distância da borda livre, desvio da altura do fecho]:
 *  contra-fecho a 79,1 mm da borda e ±45 mm do eixo; suporte a 274,1 mm e
 *  ±33,5 mm. Relativos ao fecho, e não ao pé, porque o fecho é que os carrega
 *  quando a porta muda de altura. Os quatro a w −4,8. */
const FECHO_REBITE: [number, number][] = [
  [0.0791, -0.045], [0.0791, 0.045], [0.2741, -0.0335], [0.2741, 0.0335],
];
const FECHO_REBITE_W = -0.0048;

/**
 * Menor porta que a geometria aceita.
 *
 * Abaixo disto a ferragem se sobrepõe: o manípulo tem 247 mm e mora a 190 mm da
 * borda do fecho, e o varão a 105 mm. `TrailerBody` recusa e diz por quê, em
 * vez de emitir um amontoado.
 */
export const MIN_DOOR_WIDTH = 0.50;
export const MIN_DOOR_HEIGHT_GEO = 0.90;

/* --------------------------------------------------- as faixas lisas da folha
   A CHAPA DA PORTA NÃO É A CHAPA DA PAREDE, e isto é medido no nó 2354 contra o
   nó 212 (a pele ao lado):

     parede   4,3 + 13,0 + 35,7 = 53,0 mm, uniforme de ponta a ponta
     folha    4,1 + 13,7 + 35,2 = 53,0 mm, com QUATRO interrupções

   Mesmo perfil de friso, mesmo passo — mas a folha troca três segmentos de
   35,2 mm por faixas LISAS, e ainda tem uma no pé. Medidas do pé da folha
   (altura 2350,0 mm), e a soma fecha exata:

     0,0 …  281,2    281,2 mm   pé
     776,0 …  917,2    141,2 mm
     1465,0 … 1606,2    141,2 mm
     2101,0 … 2350,0    249,0 mm   topo

   É isso que se vê como "a chapa da porta tem uns espaçamentos entre alguns
   frisos". Recortar a folha da parede — que é o que este engine faz, e é o que
   garante o friso em FASE com o resto — traz o friso uniforme; as faixas são
   aplicadas depois, achatando o relevo na faixa de altura de cada uma. */

/** As faixas lisas, em fração da altura da folha. */
export const LEAF_FLAT_BANDS: [number, number][] = [
  [0.0000, 0.1197],   //    0,0 …  281,2 de 2350
  [0.3302, 0.3903],   //  776,0 …  917,2
  [0.6234, 0.6835],   // 1465,0 … 1606,2
  [0.8940, 1.0000],   // 2101,0 … 2350,0
];

/** Está esta altura (fração da folha) numa faixa lisa? */
export function inFlatBand(f: number): boolean {
  for (const [a, b] of LEAF_FLAT_BANDS) if (f >= a && f <= b) return true;
  return false;
}

/**
 * A folha fatiada em segmentos de altura, alternando LISO e FRISADO, em Y
 * absoluto — a lista completa, sem buracos, do pé ao topo.
 *
 * Existe porque o achatamento antes era decidido POR TRIÂNGULO: a faixa só era
 * aplicada quando os TRÊS vértices caíam dentro dela. As bordas das faixas são
 * fração da altura da folha e o friso vem recortado da parede, então elas nunca
 * coincidem com uma aresta de triângulo — e a fileira de friso que atravessava
 * a borda ficava inteira em relevo, com o degrau serrilhado que isso produz.
 * Com os segmentos, quem chama corta a geometria NA borda (`clipSlab`) e o
 * limite fica exato.
 */
export function flatSegments(leaf: DoorRect): { lo: number; hi: number; flat: boolean }[] {
  const { y0, y1 } = leaf;
  const h = y1 - y0;
  const out: { lo: number; hi: number; flat: boolean }[] = [];
  let cursor = y0;
  for (const [a, b] of LEAF_FLAT_BANDS) {
    const lo = y0 + a * h, hi = y0 + b * h;
    if (lo > cursor) out.push({ lo: cursor, hi: lo, flat: false });
    if (hi > cursor) { out.push({ lo: Math.max(lo, cursor), hi, flat: true }); cursor = hi; }
  }
  if (cursor < y1) out.push({ lo: cursor, hi: y1, flat: false });
  return out;
}

/**
 * A grade do friso de uma lateral, em Y absoluto: os VALES ficam em
 * `[row0 + k·pitch, row0 + k·pitch + valeH]` e o arco ocupa o resto do passo.
 * Medida por `TrailerBody` na própria malha, nunca arbitrada.
 */
export interface RibGrid { row0: number; pitch: number; valeH: number }

/**
 * `flatSegments()` com as bordas internas ANCORADAS NO VALE do friso.
 *
 * As faixas do modelo real casam com o friso por construção — elas trocam
 * segmentos INTEIROS de arco por chapa lisa, então toda borda de faixa cai
 * onde a chapa já está no plano do vale. As nossas eram fração da altura da
 * folha sobre um friso que vem recortado da parede: a fase é um acidente da
 * posição da porta, e uma borda podia cair no MEIO do arco. A faixa (que está
 * no plano do vale) encontrava o arco cortado a meia altura: um degrau aberto
 * de até 5,2 mm que lia como "a parte lisa está construída em cima do friso".
 * A segunda faixa de baixo saía perfeita por sorte — a borda dela caía no
 * vale, "continuando a descida do friso" — e é esse o comportamento que aqui
 * vira regra: borda de BAIXO desce até o fim do vale mais próximo, borda de
 * CIMA sobe até o começo do vale seguinte. As faixas só CRESCEM, então as
 * guias do varão (fração 0,3611/0,6389, com ≥68 mm de margem nominal para a
 * borda) continuam dentro delas em qualquer altura de porta.
 */
export function snapFlatSegments(
  leaf: DoorRect, grid?: RibGrid,
): { lo: number; hi: number; flat: boolean }[] {
  if (!grid || !(grid.pitch > 0) || !(grid.valeH > 0)) return flatSegments(leaf);
  const { y0, y1 } = leaf;
  const h = y1 - y0;
  const fase = (y: number) => {
    const p = (y - grid.row0) % grid.pitch;
    return p < 0 ? p + grid.pitch : p;
  };
  const eps = 1e-6;
  /* Borda inferior de faixa: se cair no arco, desce até o TETO do vale de
     baixo — o friso termina a descida e a chapa lisa continua no mesmo plano. */
  const paraBaixo = (y: number) => {
    const p = fase(y);
    return p <= grid.valeH + eps ? y : y - (p - grid.valeH);
  };
  /* Borda superior: sobe até o PISO do vale seguinte, onde o arco recomeça. */
  const paraCima = (y: number) => {
    const p = fase(y);
    return p <= grid.valeH + eps ? y : y + (grid.pitch - p);
  };
  const out: { lo: number; hi: number; flat: boolean }[] = [];
  let cursor = y0;
  for (const [a, b] of LEAF_FLAT_BANDS) {
    /* As pontas da folha (a === 0, b === 1) são borda de PORTA, não de faixa:
       ficam onde estão. */
    const lo = a <= 0 ? y0 : paraBaixo(y0 + a * h);
    const hi = b >= 1 ? y1 : paraCima(y0 + b * h);
    if (lo > cursor) out.push({ lo: cursor, hi: lo, flat: false });
    if (hi > cursor) { out.push({ lo: Math.max(lo, cursor), hi, flat: true }); cursor = hi; }
  }
  if (cursor < y1) out.push({ lo: cursor, hi: y1, flat: false });
  return out;
}

/* --------------------------------------------------------------- o recorte */

/** O VÃO na chapa, a partir do retângulo da folha. */
export function holeOf(leaf: DoorRect): DoorRect {
  return {
    y0: leaf.y0 - DOOR_REVEAL, y1: leaf.y1 + DOOR_REVEAL,
    z0: leaf.z0 - DOOR_REVEAL, z1: leaf.z1 + DOOR_REVEAL,
  };
}

/** Uma porta pequena demais para ser montada — a mensagem que o console dá. */
export function rejectReason(leaf: DoorRect): string | null {
  const w = leaf.z1 - leaf.z0, h = leaf.y1 - leaf.y0;
  if (w < MIN_DOOR_WIDTH) {
    return `largura ${(w * 1000).toFixed(0)} mm abaixo do mínimo `
      + `${(MIN_DOOR_WIDTH * 1000).toFixed(0)} mm — a ferragem do fecho não cabe`;
  }
  if (h < MIN_DOOR_HEIGHT_GEO) {
    return `altura ${(h * 1000).toFixed(0)} mm abaixo do mínimo `
      + `${(MIN_DOOR_HEIGHT_GEO * 1000).toFixed(0)} mm`;
  }
  return null;
}

/* ---------------------------------------------------------------- o layout */

/**
 * As alturas das dobradiças, numa porta.
 *
 * Exportada porque DUAS coisas dependem dela e precisam concordar: a ferragem
 * (`layoutDoor()`) e os suportes soldados ao marco (`doorFrameGeometry()`).
 * Calculada duas vezes, uma dobradiça giraria no ar assim que a regra mudasse
 * num dos dois lugares — e a regra já mudou duas vezes neste arquivo.
 *
 * Passo FIXO, contagem derivada, corrida CENTRADA. A folha da traseira do nosso
 * bake (2460 mm) sai idêntica à medida: n = 4, primeira a
 * (2460 − 3 × 685,4) / 2 = 201,9 mm do pé.
 *
 * `Math.floor` e não `Math.round`: com floor, `(n−1)·passo ≤ vão`, e daí sai a
 * garantia de que a primeira tala nunca fica a menos de `TALA_EDGE` da borda.
 * Com round ela poderia cair a 30 mm — metade da tala pendurada fora da folha.
 * O epsilon é para o caso exato (2460 mm dá 3,000000 e o binário às vezes dá
 * 2,999999), que é justamente a medida de fábrica.
 */
export function talaHeights(leaf: DoorRect): number[] {
  const h = leaf.y1 - leaf.y0;
  const span = h - 2 * TALA_EDGE;
  if (span < TALA_MIN_SPAN) return [];
  const n = Math.max(2, Math.floor(span / TALA_PITCH + 1e-9) + 1);
  const first = leaf.y0 + (h - (n - 1) * TALA_PITCH) / 2;
  return Array.from({ length: n }, (_, i) => first + i * TALA_PITCH);
}

/** Uma instância: onde a origem contratada da peça vai, e como ela é esticada. */
export interface DoorPlacement {
  part: DoorPart;
  x: number; y: number; z: number;
  /** Escala no próprio eixo. Só EXTRUSÕES usam — varão e os dois perfis de
   *  borracha —, e nelas é exato: esticar uma extrusão no eixo dela não
   *  deforma nada. Nenhuma outra peça escala: dobradiça, guia e manípulo são
   *  produto físico e não crescem com a porta. */
  sy?: number;
  sz?: number;
  /**
   * Instância do TOPO de uma peça de PONTA: espelhada verticalmente.
   *
   * O kit guarda UMA geometria por família, normalizada para a orientação da
   * ponta de BAIXO (`extractDoorKit`). Cabeçote, macho, encaixe e travessa de
   * borracha são assimétricos na vertical — no implemento a unidade do topo é
   * a imagem espelhada da de baixo. Sem isto, a peça de baixo era desenhada nas
   * DUAS pontas e o came do topo apontava para longe da boca do encaixe: "a
   * parte de segurar o varão superior não está batendo com a parte soldada".
   */
  flipY?: boolean;
}

/**
 * Onde cada peça vai, numa porta.
 *
 * A DOBRADIÇA FICA NA TRASEIRA E O VARÃO NA DIANTEIRA. A dianteira é +Z.
 *
 * Uma versão anterior deste arquivo afirmava o contrário, e a justificativa era
 * boa demais para ser conferida: "a porta abre para trás, com a charneira à
 * frente; ao contrário, uma porta que se soltasse em movimento viraria pá de ar
 * contra o fluxo". É um argumento de primeiros princípios, e o implemento o
 * desmente — nos renders de catálogo, com a traseira à direita do quadro, as
 * quatro dobradiças estão à DIREITA da folha e o varão à esquerda. Numa porta
 * de serviço lateral de frigorífico é assim que se monta: ela abre para a
 * frente e encosta na lateral, fora do caminho de quem carrega pela traseira.
 *
 * A consequência prática vai além destes números: a porta é peça de MÃO, então
 * inverter as pontas não é trocar duas coordenadas — é espelhar o conjunto em
 * Z, ferragem inclusive. Ver `mirrorAxis()` em `trailer-geometry.ts`, e o
 * cuidado que ela toma com o enrolamento.
 *
 * `DoorSpec` não tem campo de mão de abertura — é o mesmo tipo que o formulário
 * React emite —, então a regra é derivada, não perguntada.
 */
export function layoutDoor(leaf: DoorRect, plane: DoorPlane): DoorPlacement[] {
  const { xSkin, sign } = plane;
  /* `w` do inventário é medido da FACE DA FOLHA; a peça é parafusada nela. Esta
     linha é a única conversão para a crista da pele, e é o que faz `LEAF_INSET`
     poder mudar sem soltar a ferragem da porta. */
  const out = (w: number) => xSkin + sign * (w - LEAF_INSET);
  const { y0, y1, z0, z1 } = leaf;
  const h = y1 - y0;
  const p: DoorPlacement[] = [];
  const add = (part: DoorPart, w: number, y: number, z: number,
    s?: { sy?: number; sz?: number; flipY?: boolean }) =>
    p.push({ part, x: out(w), y, z, ...s });

  /* ========================================================== BORRACHA
     Quatro perfis EXTRAÍDOS, não um anel de caixas: dois montantes esticados em
     Y e duas travessas esticadas em Z, cada um no próprio eixo.

     A LINHA DE CENTRO de cada perfil fica `SEAL_OUT` PARA FORA da borda da
     folha — é assim que a medida vem do implemento, e é a forma que não depende
     de somar e subtrair meia seção em três lugares diferentes. Os montantes
     correm a altura inteira do quadro; as travessas correm a largura inteira e
     os cantos se sobrepõem, que é o que uma vedação de porta faz (a esquadria
     é contínua, não quatro peças topo a topo com quatro frestas).

     `anchor: 'base'` põe a origem no pé de cada perfil e o CENTRA nos outros
     dois eixos — daí `SEAL_W` ser a profundidade do CENTRO, não a da face. */
  {
    const cy0 = y0 - SEAL_OUT, cy1 = y1 + SEAL_OUT;
    const cz0 = z0 - SEAL_OUT, cz1 = z1 + SEAL_OUT;
    /* Montantes: do centro da travessa de baixo ao da de cima, mais meia seção
       em cada ponta, para o perfil fechar o canto por dentro. */
    const vLen = (cy1 - cy0) + SEAL_SECTION;
    for (const z of [cz0, cz1]) {
      add('BORRACHA_V', SEAL_W, cy0 - SEAL_SECTION / 2, z, { sy: vLen / SEAL_V_LEN });
    }
    /* A travessa é `anchor: 'centro'` — o eixo longo dela é Z, e ali a origem
       fica no MEIO. Ancorá-la como o montante (que é 'base', com a origem no
       pé do eixo Y) punha a peça inteira meio comprimento fora do lugar; era o
       que fazia a vedação horizontal nunca encostar no canto. */
    const hLen = (cz1 - cz0) + SEAL_SECTION;
    add('BORRACHA_H', SEAL_W, cy0, (cz0 + cz1) / 2, { sz: hLen / SEAL_H_LEN });
    /* A travessa de CIMA é a de baixo espelhada — o perfil tem lábio, e o
       lábio da travessa superior aponta para baixo. */
    add('BORRACHA_H', SEAL_W, cy1, (cz0 + cz1) / 2,
      { sz: hLen / SEAL_H_LEN, flipY: true });
  }

  /* ========================================================== DOBRADIÇA
     Passo FIXO, contagem derivada, corrida CENTRADA. A porta de fábrica
     (2450 mm) sai idêntica ao inventário: n = 4, primeira a
     (2450 − 3 × 682,05) / 2 = 201,9 mm do pé, que é a medida.
     Dividir o vão em partes iguais — como esta função já fez — faria o passo
     ser consequência da altura, e uma porta de 2 m sairia com a dobradiça no
     tamanho certo e no lugar errado. */
  {
    for (const y of talaHeights(leaf)) {
      add('TALA', TALA_W, y, z0 + TALA_U);
      /* O pino atravessa a tala e vive SOBRE O MARCO (u negativo): é ele o eixo
         de rotação, e por isso fica fora da folha. */
      add('PINO', PINO_W, y, z0 + PINO_U);
      /* O macho da dobradiça, SOLDADO AO MARCO, no mesmo Z do pino e na mesma
         altura da tala — as quatro unidades da traseira estão a passo 682,05,
         que é o da tala, e é isso que prova que são o par dela. */
      add('SUPORTE_TALA', SUPORTE_TALA_W, y, z0 + PINO_U);
      for (const dv of [-PORCA_DV, PORCA_DV]) add('PORCA', PINO_W, y + dv, z0 + PINO_U);
      /* A trava do pino, 60 mm abaixo do eixo — a peça que segura o pino no
         lugar. Estava fora do kit e é visível de perto. */
      add('TRAVA_PINO', PINO_W, y + TRAVA_PINO_DV, z0 + PINO_U);
      for (const u of REBITE_U) {
        for (const dv of [-REBITE_DV, REBITE_DV]) add('REBITE', REBITE_W, y + dv, z0 + u);
      }
    }
  }

  /* ============================================================== VARÃO
     Um varão só, na borda oposta à da charneira. A escala em Y é exata porque
     ele é extrusão de seção 25 × 25 mm — nenhuma outra peça é esticada. */
  const varaoZ = z1 - VARAO_D;
  const varaoY0 = y0 - VARAO_OVER, varaoY1 = y1 + VARAO_OVER;
  add('VARAO', VARAO_W, varaoY0, varaoZ, { sy: (varaoY1 - varaoY0) / VARAO_LEN });

  /* Cabeçotes, simétricos: 50,5 mm do pé e do topo, com os quatro rebites de
     cada um (duas colunas a ±31 mm do eixo, duas linhas a 41 e 121 mm da
     ponta). Os rebites entram porque a peça é parafusada na folha e sem eles o
     cabeçote lê como colado. */
  add('CABECOTE', CABECOTE_W, y0 + CABECOTE_V, varaoZ);
  add('CABECOTE', CABECOTE_W, y1 - CABECOTE_V, varaoZ, { flipY: true });
  for (const dd of [-CABECOTE_REBITE_DD, CABECOTE_REBITE_DD]) {
    for (const dv of CABECOTE_REBITE_V) {
      add('REBITE', CABECOTE_REBITE_W, y0 + dv, varaoZ + dd);
      add('REBITE', CABECOTE_REBITE_W, y1 - dv, varaoZ + dd);
    }
  }

  /* Guias: DUAS, em fração da altura — 0,3611 e 0,6389, que são os 888,3 e
     1571,6 mm medidos sobre os 2460 da folha. Cada uma com o seu suporte (peça
     PRETA, material próprio) e os dois rebites que a prendem. A versão anterior
     punha QUATRO guias, e a peça que ela chamava de guia era o suporte do
     fecho; a versão seguinte acertou a guia e errou o suporte, que caía numa
     caixa de canto do marco da traseira. */
  for (const f of GUIA_FRAC) {
    const gy = y0 + f * h;
    add('GUIA', GUIA_W, gy, varaoZ);
    add('SUPORTE_GUIA', SUPORTE_GUIA_W, gy, varaoZ);
    for (const dd of [-GUIA_REBITE_DD, GUIA_REBITE_DD]) {
      add('REBITE', GUIA_REBITE_W, gy, varaoZ + dd);
    }
  }

  /* Anéis: dois em cada ponta, ancorados ao pé e ao topo. */
  for (const dv of ANEL_V) {
    add('ANEL', ANEL_W, y0 + dv, varaoZ);
    add('ANEL', ANEL_W, y1 - dv, varaoZ);
  }

  /* Machos de ponta: passam da folha e entram no encaixe do marco. O de cima
     é o de baixo ESPELHADO — o came aponta para a boca que o recebe. */
  add('MACHO', MACHO_W, y0 - MACHO_OVER, z1 - MACHO_D);
  add('MACHO', MACHO_W, y1 + MACHO_OVER, z1 - MACHO_D, { flipY: true });

  /* E os ENCAIXES que os recebem, soldados ao marco: 59,8 mm além de cada ponta
     da folha e no Z DO MACHO — não no do varão. Os dois ficam a 20 mm de
     distância um do outro, e é o macho que tem de entrar no encaixe; alinhá-lo
     pelo varão deixava a ponta batendo 20 mm ao lado da boca. Medido no nosso
     bake: encaixe em u 1109,6 contra macho em 1112,1 e varão em 1091,9. */
  add('ENCAIXE', ENCAIXE_W, y0 - ENCAIXE_OVER, z1 - ENCAIXE_D);
  add('REBITE', ENCAIXE_REBITE_W, y0 - ENCAIXE_OVER, z1 - ENCAIXE_REBITE_D);
  /* O encaixe de cima espelhado, com a BOCA para baixo — é nela que o came
     do macho superior entra. */
  add('ENCAIXE', ENCAIXE_W, y1 + ENCAIXE_OVER, z1 - ENCAIXE_D, { flipY: true });
  add('REBITE', ENCAIXE_REBITE_W, y1 + ENCAIXE_OVER, z1 - ENCAIXE_REBITE_D);

  /* ============================================================== FECHO
     Tudo a 193 mm do PÉ. É fecho de baú frigorífico: altura de canela, não de
     peito. Ancorado ao pé, uma porta de 3 m não sobe o manípulo com ela. */
  const fy = y0 + FECHO_V;
  add('BATENTE', BATENTE_W, fy, z1 - BATENTE_D);
  add('SUPORTE_FECHO', SUPORTE_FECHO_W, fy, z1 - SUPORTE_FECHO_D);
  add('CONTRAFECHO', CONTRAFECHO_W, fy, z1 - CONTRAFECHO_D);
  add('MANIPULO', MANIPULO_W, fy, z1 - MANIPULO_D);
  for (const [d, dv] of FECHO_REBITE) add('REBITE', FECHO_REBITE_W, fy + dv, z1 - d);
  add('ALAVANCA', ALAVANCA_W, y0 + ALAVANCA_V, z1 - ALAVANCA_D);
  add('TRINCO', TRINCO_W, y0 + TRINCO_V, z1 - TRINCO_D);

  return p;
}

/* ------------------------------------------------------ marco e borracha */

/** Uma malha crua, no espaço final do modelo. */
export interface DoorSurface { position: number[]; normal: number[] }

/**
 * Um paralelepípedo fechado, com as seis faces e as normais DADAS.
 *
 * Sólido, e não casca de quadriláteros soltos, e essa escolha é o conserto de
 * uma classe inteira de defeito. A versão anterior montava marco e folha com
 * faces avulsas e tinha de RACIOCINAR, face a face, sobre qual delas seria vista
 * de qual ângulo — errar uma deixava uma linha de visão aberta para dentro do
 * baú, e o erro só aparecia numa volta de câmera específica. Um sólido não tem
 * como estar meio fechado.
 *
 * A normal é escrita, não deduzida do enrolamento, porque o material destas
 * peças é `DoubleSide`: com `FrontSide` uma ordem trocada APAGA a face em vez de
 * escurecê-la, e um buraco intermitente é o pior defeito para diagnosticar.
 */
function box(
  out: DoorSurface,
  x0: number, x1: number, y0: number, y1: number, z0: number, z1: number,
) {
  type V = [number, number, number];
  const quad = (a: V, b: V, c: V, d: V, n: V) => {
    for (const v of [a, b, c, a, c, d]) {
      out.position.push(v[0], v[1], v[2]);
      out.normal.push(n[0], n[1], n[2]);
    }
  };
  quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0]);
  quad([x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [-1, 0, 0]);
  quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0]);
  quad([x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [0, -1, 0]);
  quad([x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [0, 0, 1]);
  quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1]);
}

/**
 * Um quadro de quatro sólidos entre um retângulo externo e um interno.
 *
 * As quatro peças não se sobrepõem — as travessas correm a largura inteira e os
 * montantes só a altura livre entre elas. Sobrepor poria faces coplanares numa
 * cena que já tem coplanaridade nativa de sobra (ver o topo de
 * `trailer-geometry.ts`) e o canto piscaria.
 */
function ring(
  out: DoorSurface, x0: number, x1: number, o: DoorRect, i: DoorRect,
) {
  box(out, x0, x1, o.y0, i.y0, o.z0, o.z1);
  box(out, x0, x1, i.y1, o.y1, o.z0, o.z1);
  box(out, x0, x1, i.y0, i.y1, o.z0, i.z0);
  box(out, x0, x1, i.y0, i.y1, i.z1, o.z1);
}

const grow = (r: DoorRect, d: number): DoorRect =>
  ({ y0: r.y0 - d, y1: r.y1 + d, z0: r.z0 - d, z1: r.z1 + d });

/**
 * O MARCO — o perfil que contorna o vão, e a única superfície construída aqui.
 *
 * A BORRACHA saiu daqui e virou peça EXTRAÍDA (`BORRACHA_V`/`BORRACHA_H` em
 * `DOOR_PARTS`, posicionadas por `layoutDoor()`). Enquanto as duas coexistiam,
 * o baú ficava com duas vedações sobrepostas: o perfil de verdade e um anel de
 * caixas com outra seção, 4 mm atrás dele. É o "a borracha está estranha".
 *
 * A geometria é a medida, sem folga inventada:
 *
 *   perfil    do vão para dentro, `FRAME_WIDTH` (78,7 mm), de `FRAME_FRONT`
 *             (6,0 mm atrás da crista) até 71,1 mm de fundura
 *   retorno   os 12 mm mais fundos, seguindo até a borda da folha
 *
 * O perfil nasce em `FRAME_FRONT` — a MEDIDA — e não na crista: 0,6 mm à
 * frente da face da borracha, um marco na crista engolia a sobreposição de
 * 19,55 mm e deixava a vedação com 15,7 mm visíveis ("a borracha está muito
 * fina"). Recuado, a borracha monta sobre ele e é ela que fecha a junta sem
 * deixar fresta em ângulo nenhum: não há um plano de encontro para errar.
 */
export function doorFrameGeometry(
  leaf: DoorRect, plane: DoorPlane,
): { frame: DoorSurface; trim: DoorSurface } {
  const { xSkin, sign } = plane;
  const hole = holeOf(leaf);
  const frame: DoorSurface = { position: [], normal: [] };
  const trim: DoorSurface = { position: [], normal: [] };
  /* `sign` decide para que lado é "dentro"; os pares são normalizados para
     x0 < x1 para que as normais de `box()` continuem valendo. */
  const span = (a: number, b: number): [number, number] =>
    (sign > 0 ? [xSkin - b, xSkin - a] : [xSkin + a, xSkin + b]);

  /* O perfil visível: de `FRAME_FRONT` (6,0 mm atrás da crista — a MEDIDA) até
     71,1 mm de fundura, `FRAME_WIDTH` da borda do vão para dentro.

     Ele já correu até a crista, "para tapar a borda cortada da chapa". O preço
     era inverter a pilha: a face da borracha fica 0,6 mm atrás da crista
     (`SEAL_FRONT`), então um marco NA crista passava 0,6 mm à frente dela e
     ENGOLIA os 19,55 mm de sobreposição — da borracha sobravam 15,7 mm
     visíveis, e é o "a borracha está muito fina". Recuado à medida, a borracha
     fica 5,4 mm à frente do marco e MONTA sobre ele, como o rip descreve ("a
     borracha monta 20,9 mm no marco") e como a traseira do nosso bake mostra:
     a faixa preta inteira de ~48 mm, com o metal claro por fora. O rebaixo de
     6 mm na boca do vão é real — "marco, borracha e folha começam todos entre
     4,5 e 6,0 mm atrás da crista" — e a borda cortada da chapa, de espessura
     zero, não tem face para mostrar: o que se vê pelo degrau é a própria face
     do marco, 6 mm atrás, que é o que o implemento mostra. */
  const [fx0, fx1] = span(FRAME_FRONT, FRAME_FRONT + FRAME_DEPTH);
  ring(frame, fx0, fx1, hole, grow(hole, -FRAME_WIDTH));

  /* E o RETORNO DO FUNDO, no mesmo material e no mesmo anel: da borda interna
     do perfil até a borda da folha, nos 12 mm mais fundos.

     Ele existe porque o marco para 15,7 mm antes da folha — no implemento quem
     fecha esse vão é a borracha, que monta nos dois. Sem o retorno, um bake em
     que `BORRACHA_V`/`BORRACHA_H` não fossem encontradas deixaria uma fresta
     contínua para dentro do baú, e "um vão sem fundo" já mandou esta feature de
     volta uma vez. No fundo do perfil ele fica atrás da borracha em qualquer
     ângulo, então quando ela existe ele simplesmente não é visto.

     Aqui morava um segundo anel, em `borracha-preta`, com seção e profundidade
     próprias. Ele desenhava um quadro preto chapado que NÃO coincidia com o
     perfil extraído — duas vedações, uma por cima da outra, com 4 mm entre
     elas. É o "a borracha está estranha". */
  const [bx0, bx1] = span(FRAME_FRONT + FRAME_DEPTH - 0.012, FRAME_FRONT + FRAME_DEPTH);
  ring(frame, bx0, bx1, grow(hole, -FRAME_WIDTH), leaf);

  /* A MOLDURA: o anel galvanizado em volta do vão, POR FORA dele, sobre a
     parede — `TRIM_WIDTH` de largura, da elevação de `TRIM_PROUD` à frente da
     crista até `TRIM_SINK` atrás dela (passa o vale do friso, então fecha
     contra a chapa em qualquer fase). Vai em superfície PRÓPRIA porque o
     material é outro: galvanizado da saia, não o do marco. */
  const [tx0, tx1] = span(-TRIM_PROUD, TRIM_SINK);
  ring(trim, tx0, tx1, grow(hole, TRIM_WIDTH), hole);

  /* As peças SOLDADAS ao marco — macho da dobradiça e encaixe do varão — não
     são construídas aqui: elas existem no implemento e entram pelo mesmo
     caminho de todo o resto do kit. Ver `SUPORTE_TALA` e `ENCAIXE`. */

  return { frame, trim };
}
