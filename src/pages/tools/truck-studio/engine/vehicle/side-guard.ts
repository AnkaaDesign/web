/* A PROTEÇÃO LATERAL — a peça do semirreboque, montada no IMPLEMENTO.
   ===========================================================================

   ⚠️ ELA É DO BAÚ, E NÃO DO CAMINHÃO. Esta é a terceira versão da peça, e as
   duas primeiras erraram por motivos diferentes:

     1ª — desenhada a partir das COTAS do VW (três lâminas de 90 mm).
          *"você criou uma nova, totalmente diferente"*.
     2ª — desenhada a partir das MEDIDAS do semirreboque (duas barras de
          32 × 100). *"ainda está uma peça inventada"*.
     3ª — a peça EXTRAÍDA (`protecao_lateral_v1.glb`), mas pendurada no chassi
          do caminhão. *"veja que a inclinação da grade não está seguindo o
          implemento"* — e não estava mesmo: o baú assenta com a inclinação da
          mesa da longarina (0,912° no Scania P) e a grade ficava no plano do
          caminhão. A 8,4 m de corrido, 0,912° são **134 mm** de desencontro.

   O conserto não é somar a inclinação à peça — é dar-lhe o dono certo. No
   semirreboque a grade É do implemento, e é por isso que ali ela nunca teve
   esse problema. Sendo filha da raiz do baú, ela herda de graça:

     · a INCLINAÇÃO (o `pitchX` de `solveRigidMount`);
     · a POSIÇÃO (o baú anda quando a cabine muda, e ela vai junto);
     · o COMPRIMENTO (o corrido é recalculado a cada `setTrailerDims`);
     · e o ACABAMENTO — os quatro materiais dela existem no sobrechassi com os
       mesmos nomes, então ligar por NOME faz a peça receber a mesma tinta, o
       mesmo molhado e a mesma régua de frota que o resto do baú.

   O QUE ESTICA E O QUE LADRILHA
   ---------------------------------------------------------------------------
   O asset vem separado por PAPEL, decidido no bake pelo vão em z (o mesmo
   critério de `RIGID_Z_MAX`):

     `BARRA__*`   — as duas barras de 32 × 100 mm. ESTICAM em z.
     `ESTACAO__*` — suporte 90 × 250 × 65, montante 35 × 580 × 57, parafusos e
                    chapinhas: 8 componentes. LADRILHAM, com vão nunca maior
                    que 1 250 mm — o menor vão medido entre suportes no
                    implemento — e balanço de 300 mm nas pontas. Ver
                    `estacoes()`.

   É a doutrina de `TrailerAssembly`: **a peça não muda, a contagem muda**. Um
   baú de 6 m e um de 11 m têm a mesma estação, em número diferente. A diferença
   para lá é que aqui o passo é um TETO e não uma constante: um corrido nasce e
   morre em pontos que o caminhão escolhe (roda, tanque, traseira do baú), e uma
   corrida centrada num vão arbitrário põe suporte fora da barra — foi o que
   aconteceu, e está registrado em `PASSO`.
*/
import * as THREE from 'three';

/**
 * O asset, em `models/vehicles/`.
 *
 * ⚠️ `_v2` DESDE 2026-08-23, e o `_v1` FICA NO LUGAR: a árvore servida sai com
 * `Cache-Control: immutable`, então um asset publicado nunca é sobrescrito —
 * é a mesma regra do `vw_titan_6x2r.glb` (§43.4). A v2 acrescenta o que a v1
 * não tinha e por isso a grade parecia pendurada no ar: o **BRAÇO**, a
 * **MÃO-FRANCESA** e os **GRAMPOS**, ou seja a ferragem que a prende ao
 * chassi. Eles existiam no semirreboque o tempo todo; ficaram de fora porque a
 * janela de extração começava em |x| 1 190 e o braço nasce em 374.
 */
export const SIDE_GUARD_ASSET = 'protecao_lateral_v2.glb';

/** Comprimento do corrido de origem, de `protecao_lateral_v1_meta.json`. */
const COMPRIMENTO_ORIGEM = 3.380;
/** Passo MÁXIMO entre estações, medido no implemento (menor vão entre suportes).
 *
 * ⚠️ MÁXIMO, e não "o passo". Ele era o passo e só: `n = floor(vao/PASSO) + 1`
 * com a corrida centrada. Duas coisas quebravam nisso, e as duas apareceram na
 * mesma foto (*"a grade está muito longa, o suporte dela fica flutuando"*):
 *
 *  1. **num corrido MENOR que o passo a margem saía NEGATIVA.** Medido no 6x2:
 *     o corrido traseiro tem 973 mm e o `Math.max(2, …)` forçava DUAS estações
 *     a 1 250 mm, ou seja `margem = (973 − 1250)/2 = −138,5 mm` — uma estação
 *     138 mm ANTES do começo da barra e a outra 138 mm depois do fim dela. Um
 *     suporte pendurado no ar, que é literalmente a queixa.
 *  2. **as estações que caíam em obstáculo eram APAGADAS.** No corrido
 *     dianteiro de 4 362 mm sobravam DUAS, a 3 750 mm uma da outra, e no meio
 *     não havia nada segurando 3,7 m de perfil.
 *
 * A régua nova é a de um para-ciclista de verdade: **balanço limitado nas duas
 * pontas e vão nunca maior que o passo**, com a estação ANDANDO para sair do
 * obstáculo em vez de sumir. Só se ela não couber em lugar nenhum a meio passo
 * do lugar dela é que ela some — e aí o vão é o do caminhão (tanque, ARLA,
 * caixa de bateria), que é o mesmo vão que a peça real tem.
 */
const PASSO = 1.25;
/**
 * ▶▶▶ E O TETO DE APOIOS POR CORRIDO — **DOIS, sempre**. 2026-08-24.
 *
 * *"deve ter apenas 2 suportes, não 3, sempre"* — Kennedy, com o trecho
 * dianteiro do Scania 8x2, que a régua de `PASSO` enchia com três.
 *
 * `PASSO` continua sendo o teto do VÃO (é ele que impede dois apoios num
 * corrido de 4 m ficarem a 3,3 m um do outro em silêncio), mas quem manda no
 * NÚMERO é esta constante: o para-ciclista que o dono monta tem dois montantes
 * por seção, e uma seção mais longa ganha outro TRECHO, não um terceiro
 * montante. Quando os dois não dão conta do vão, o relato diz — ver `porTrecho`
 * na linha da proteção lateral.
 */
const ESTACOES_MAX = 2;
/**
 * Quanto o corrido pode passar da estação mais externa, em cada ponta.
 *
 * É o balanço da barra. 300 mm é o que se vê nas fotos de referência e o que
 * mantém a ponta rígida o bastante para não vibrar — e, com ele, a estação
 * nunca nasce fora do corrido, porque a conta parte das pontas para dentro.
 */
const BALANCO = 0.30;
/** Passo da busca quando uma estação precisa sair de cima de um obstáculo. */
const DESVIO_PASSO = 0.025;
/**
 * Quanto a face externa da grade fica para DENTRO da pele do flanco.
 *
 * MEDIDO no semirreboque: barras em |x| 1 275 contra 1 335 de meia-largura.
 * É o recuo que faz a grade não ser o ponto mais largo do conjunto — e o que
 * a mantém dentro dos 2 600 mm da CONTRAN 882/2021 em qualquer baú.
 */
export const RECUO_DA_PELE = 0.060;
/** Margem que o corrido guarda da TRASEIRA do baú. */
/**
 * ⚠️ 60 mm, não 200. O corrido de trás nasce entre a traseira do baú e o
 * tandem, e é o mais curto dos dois — no 6x2 sobravam 703 mm, e 200 mm de
 * margem comiam quase um terço disso. *"a grade da traseira deve ter esse
 * tamanho mais ou menos"*, e o tamanho marcado é o vão inteiro.
 */
const MARGEM_TRAS = 0.06;
/**
 * …e o ALVO, quando o vão comporta. 250 mm é o que separa a ponta da parede a
 * olho, sem ser a folga de meio metro da testeira — a traseira do baú tem
 * para-choque e para-barro logo abaixo, e uma folga grande demais ali abre um
 * buraco entre a grade e o conjunto traseiro.
 */
const MARGEM_TRAS_ALVO = 0.25;
/** O corrido que vale a pena ter atrás. Abaixo disto a margem cede. */
const TRECHO_BOM = 0.80;
/**
 * E da TESTEIRA — maior, e é o dono que fixa o número.
 *
 * *"a grade aqui deveria acabar um pouco antes, assim como na referência"* —
 * Kennedy, com a linha marcada na parede da testeira. Com 200 mm dos dois
 * lados o corrido morria rente à testeira e seguia visualmente para dentro do
 * vão da cabine; a foto de referência (o baú Ibiporã sobre chassi) mostra a
 * grade acabando bem antes dela. 450 mm é o que separa o fim do corrido da
 * parede sem abrir buraco no meio.
 */
const MARGEM_FRENTE = 0.45;
/**
 * Folga entre a ponta do corrido e o obstáculo à frente dela.
 *
 * MEDIDO: no 6x2 o corrido acabava em 3 802 e o tanque começa em 3 832 — 30 mm,
 * que a olho é encostar. Daí *"a parte da frente, encurte um pouco, está
 * tocando no tanque"*. 100 mm abre o vão sem comer o corrido.
 */
const FOLGA_PONTA = 0.100;
/** Folga em z para a roda do caminhão. O pneu tem ~500 mm de raio. */
/**
 * Meio-vão em torno do EIXO. O pneu tem ~510 mm de raio, então 750 deixava
 * 240 mm de ar de cada lado — folga de sobra, e cara nos dois corridos curtos.
 * 620 ainda deixa ~110 mm, que é mais do que a suspensão trabalha.
 */
const FOLGA_RODA = 0.62;
/**
 * Quanto uma peça do caminhão precisa estar POR DENTRO do plano da grade para
 * não atrapalhar.
 *
 * ⚠️ 155 mm, e o número agora é MEDIDO NO ASSET em vez de arbitrado. Ele já
 * foi 120 (chute: "a espessura do suporte mais respiro") e 95 (pior chute:
 * baixei para deixar o tanque do VM passar). Medido em
 * `protecao_lateral_v1.glb`, com x = 0 na face externa:
 *
 *     PONTA__plastico-preto                0 … 100 mm
 *     BARRA__metal-galvanizado-mantido    13 …  45 mm
 *     ESTACAO__inox-ferragem              54 …  87 mm
 *     ESTACAO__metal-preto                45 … **135** mm   ← o mais fundo
 *
 * Com a face externa em |x| 1 275 (2 600 mm de largura legal menos
 * `RECUO_DA_PELE`), o conjunto da grade OCUPA **1 140…1 275**. Qualquer coisa
 * do caminhão além de 1 140 está DENTRO da grade, não perto dela — e é
 * exatamente o que a foto do dono mostra com o tanque do VM (*"um monte de
 * itens sobrepondo outros … diminua o tamanho do tanque e recue um pouco para
 * não tocar nas grades metálicas laterais"*).
 *
 * 155 = 135 do conjunto + 20 mm de ar. É a mesma cadeia de `TETO_FLANCO` em
 * `truck-tanks.ts`, e as duas têm de andar juntas: uma diz o que é obstáculo,
 * a outra diz para onde o obstáculo é empurrado.
 */
/**
 * O quanto o CONJUNTO da grade entra, medido no asset (o mais fundo é
 * `ESTACAO__metal-preto`, 135 mm). Exportado porque `truck-tanks.ts` deriva o
 * teto do equipamento de flanco da MESMA medida — as duas constantes têm de
 * andar juntas, e já andaram separadas uma rodada: o teto ficou EXATAMENTE no
 * limiar de obstáculo e o tanque do Scania voltou a partir o corrido.
 */
export const GRADE_DENTRO = 0.135;
/**
 * E quanto entra o que fica na FACE — barra (13…45 mm) e tampa de ponta
 * (0…100). É o corredor que `wheelBayReach()` varre, e ele NÃO é
 * `GRADE_DENTRO`: o suporte da estação vai 135 mm para dentro, mas quem passa
 * na baia da roda é só a barra e a tampa. Medir a baia com os 135 punha coisa
 * a |x| 1 130 — 110 mm dentro da barra, longe de tocá-la — a partir o corrido,
 * e a grade do VW virava dois tocos num flanco de 8,5 m.
 */
export const GRADE_FACE_DENTRO = 0.100;
/**
 * ▶▶▶ E A FACE EXTERNA DELA — 1 275, e o número NÃO É A MEDIDA. 2026-08-24.
 *
 * ⚠️ A FACE REAL É 1 251: quem a fixa é `attachSideGuard()`, com
 * `xAlvo = skinX − RECUO_DA_PELE`, e a pele do sobrechassi está em 1 311 mm —
 * a barra montada foi medida na bancada em |x| 1 210…1 242. O comentário
 * anterior dizia "2 600 ÷ 2 menos `RECUO_DA_PELE`", que dá 1 240; 1 275 é a
 * meia-largura do SEMIRREBOQUE (1 335) menos o recuo. Nenhum dos três é o
 * outro, e a diferença tem 24 mm.
 *
 * ⚠️⚠️ E MESMO ASSIM ELA FICA EM 1 275 — a correção foi TENTADA e REVERTIDA no
 * mesmo dia, com a medida na mão. É DELA que `truck-tanks.ts` deriva
 * `TETO_FLANCO`, o ponto para onde tanque e ARLA são recuados; baixá-la para
 * 1 251 leva o teto de 1 100 para 1 076, e o recuo de flanco **não é um
 * encolhimento para todo mundo**: `TS_TANQUE_VM` é POSTO com a face externa no
 * teto, então o teto mais baixo empurra o conjunto inteiro — berço junto — para
 * dentro da longarina. Medido pela varredura geral, `TANK_R_2 ▸ chassis_p12`
 * passou de 30 para **54 mm** de penetração, contra um encaixe assumido de 40.
 * É a mesma armadilha que §46 registra pelo outro lado (*"o recuo por
 * TRANSLAÇÃO já enfiava o ARLA 62 mm dentro da longarina, invisível"*).
 *
 * O que a face menor consertaria — a estação caber em cima do tanque, em vez de
 * a ponta do corrido avançar 1 499 mm sem apoio — foi resolvido sem tocar no
 * tanque: quem cedeu os 10 mm foi `FOLGA_LATERAL`, do lado da GRADE, que é
 * quem tem ar sobrando. Ver §48.2.
 */
export const GRADE_FACE = 1.275;
/**
 * ▶ A folga do SUPORTE — 145 mm, e os 10 mm de ar são MEDIDOS. 2026-08-24.
 *
 * Ela era `GRADE_DENTRO + 0,020`, e os 20 mm de ar eram um arredondamento
 * confortável. Confortável demais: o teto para onde `recessFlankEquipment()`
 * recua tanque e ARLA é 1 100 mm e a face interna do montante, medida na cena,
 * está em **1 112** — sobram 12 mm de ar de verdade. Com 155 o limiar caía em
 * 1 096 e o tanque recuado, a 1 100, continuava sendo PAREDE para a estação:
 * nenhum apoio cabia sobre ele, e a ponta do corrido que passou a cobri-lo
 * (ver `FOLGA_BARRA`) saía com **1 499 mm de balanço** contra os 300 de
 * `BALANCO` — *"a grade está muito longa, o suporte dela fica flutuando"*, a
 * queixa que `PASSO` já registra.
 *
 * Com 145 o limiar vai a 1 106, o equipamento recuado passa por baixo dele e a
 * estação volta a caber em cima do tanque, com os 12 mm que a peça tem de
 * sobra. A alternativa era baixar o teto do equipamento — foi tentada e
 * revertida no mesmo dia, porque ela enfia o berço do tanque do VM na
 * longarina; está registrada no ⚠️⚠️ de `GRADE_FACE`.
 *
 * ⚠️ E QUEM CABE AQUI NÃO É A FERRAGEM. O braço e a mão-francesa entram até
 * |x| 638 e por isso têm lista PRÓPRIA (`truckArmObstacles`): a estação que
 * nasce sobre o tanque nasce SEM ferragem, que é o que o implementador faz.
 */
const FOLGA_LATERAL = GRADE_DENTRO + 0.010;
/**
 * ▶▶▶ E A FOLGA DA **BARRA** — 120 mm, e ela é OUTRA. 2026-08-24.
 *
 * *"essa grade metálica não está indo até onde deveria, mais ou menos onde está
 * aquele componente com tampa azul"* — Kennedy, com os dois flancos do Scania
 * bitruck: o corrido dianteiro morre em cima do tanque e deixa o ARLA, o berço
 * e o vão inteiro até o 2º direcional sem proteção nenhuma.
 *
 * A causa é UMA FOLGA SÓ FAZENDO DOIS SERVIÇOS. `FOLGA_LATERAL` (155 mm) é a
 * do SUPORTE, e com ela `truckObstacles()` marcava como parede tudo além de
 * `xGuarda − 155`. Medido no motor, no Scania 8x2:
 *
 *     face da grade (barra montada)     |x| 1 242   (pele 1 311 − 60)
 *     limiar de obstáculo, 155          |x| 1 087
 *     tanque e ARLA, já recuados        |x| 1 095…1 100   ← 13 mm ACIMA
 *
 * Ou seja: o recuo de flanco de `truck-tanks.ts` leva o equipamento até
 * `TETO_FLANCO` (1 100 mm) e o limiar da grade cai em 1 087 — as duas réguas
 * que o comentário de `GRADE_DENTRO` manda andar juntas passavam 13 mm uma da
 * outra, e o tanque voltava a AMPUTAR o corrido. A ponta ia de 2 425 (a borda
 * da baia do 2º direcional) para 1 932: **493 mm de grade a menos**, e é
 * exatamente o buraco da foto.
 *
 * ⚠️ O CONSERTO NÃO É AFASTAR MAIS O TANQUE — é perguntar QUEM ENCOSTA NELE.
 * Medido na peça montada, o que corre no plano do tanque é isto:
 *
 *     BARRA__metal-galvanizado    |x| 1 210…1 242   (32 mm de profundidade)
 *     PONTA__plastico-preto       |x| 1 154…1 255   (88 mm — a tampa)
 *     ESTACAO__metal-preto        |x| 1 112…1 210   (o suporte, 130 mm)
 *
 * A barra e a tampa passam POR FORA de um tanque a 1 100 com 54 mm de ar; quem
 * cairia dentro dele é o SUPORTE. É a mesma separação que `GRADE_FACE_DENTRO`
 * já fez para a baia da roda (§43.9), levada à lista de obstáculos:
 *
 *     lista que AMPUTA o corrido   → folga da BARRA   (100 + 20 = 120 mm)
 *     lista que bloqueia SUPORTE   → folga do SUPORTE (135 + 20 = 155 mm)
 *
 * e é o que o para-ciclista real faz: o perfil corre por fora do tanque e o
 * montante é que se afasta. `cabeSuporte()` continua com a lista inteira, de
 * propósito — ver `AMPUTA_MIN`, que é o mesmo argumento pelo lado do vão.
 */
export const FOLGA_BARRA = GRADE_FACE_DENTRO + 0.020;
/** Folga em z em torno de cada obstáculo. */
const FOLGA_OBSTACULO = 0.10;
/**
 * O que sobra de uma faixa de obstáculo depois de tirar a baia e ainda conta.
 *
 * ⚠️ 60 mm, e o número é de RUÍDO, não de peça. `truckObstacles()` devolve
 * célula quantizada e a baia é medida no corredor: a diferença entre as duas
 * beiras é da ordem de dezenas de milímetros. Medido no VM 8x2, o recorte da
 * faixa 2 052…6 352 pela baia 2 162…3 696 deixa **10 mm** de lasca dianteira —
 * e uma lasca de 10 mm empurrando a ponta 100 mm para trás é a definição de
 * cobrar duas vezes pelo mesmo arco.
 */
const LASCA = 0.06;
/**
 * Vão MÍNIMO de um obstáculo para que ele AMPUTE o corrido.
 *
 * ⚠️ Nem todo obstáculo é uma parede. `truckObstacles()` marca qualquer coisa
 * a menos de `FOLGA_LATERAL` do plano da grade, e nessa lista entram cabeças de
 * parafuso de 16 mm e chapinhas de 41 mm — no Scania são cinco delas, em
 * |x| 1 183, três milímetros além do limite. Amputar 670 mm de corrido por
 * causa de um parafuso é o oposto do que a peça real faz: a barra passa por
 * ele e quem se afasta é o SUPORTE (`cabeSuporte()` continua usando a lista
 * inteira, de propósito).
 *
 * 250 mm é o comprimento MEDIDO do suporte (90 × 250 × 65): abaixo disso a
 * peça cabe entre duas estações e não força ponta nenhuma. Usa-se 150, que é a
 * mesma ideia com margem — e ainda deixa de fora a célula de 100 mm que a
 * varredura arredonda para cima.
 */
const AMPUTA_MIN = 0.150;
/**
 * O ORÇAMENTO do recuo de ponta contra obstáculo pequeno.
 *
 * ⚠️ ELE É O QUE IMPEDE O DESASTRE DE §45.1. A regra "toda ponta recua do que
 * encosta nela" está certa e, sem teto, apagou a grade do VW inteira — porque
 * `truck_p4` é uma malha só e a lista de obstáculos dali cobre o chassi quase
 * todo. Com 220 mm por ponta, o pior caso é um corrido 440 mm mais curto, e
 * `TRECHO_MIN` decide se ele ainda vale.
 */
const RECUO_BARATO = 0.220;
/** Ar entre a ponta do corrido e o arco que ele pula. */
const FOLGA_ARCO = 0.050;
/** A faixa de altura do CORREDOR da grade, generosa o bastante para a
 *  inclinação do implemento (±67 mm sobre 8,4 m de baú). */
const CORREDOR_Y = [0.40, 1.16];
/**
 * O RAIO da baia, no plano (y, z) a partir do centro do eixo.
 *
 * 820 mm é o para-barro mais fundo deste acervo (o do 2º direcional chega a
 * ±730 em z e desce a 240 mm de solo) com um respiro. Acima disso o que existe
 * no corredor não é roda: é estribo, saia de cabine ou caixa — e nada disso
 * parte o corrido.
 */
const RAIO_BAIA = 0.82;
/** A altura do centro do eixo, de solo. Os quatro rips do acervo põem o eixo
 *  entre 496 e 528 mm; 520 erra no máximo 25 mm num raio de 820. */
const EIXO_Y = 0.52;
/** O teto do meio-vão. Sem ele um degrau perto de um eixo apagaria o corrido
 *  inteiro em silêncio. */
const CORREDOR_TETO = 0.88;
/**
 * ⚠️ ARCO DE RODA AMPUTA, SIM — e isentá-lo foi um erro de uma rodada só.
 *
 * A tentativa anterior marcou os para-lamas como `arco` e os tirou da conta da
 * PONTA, com o argumento de que o corrido já é partido na roda por
 * `FOLGA_RODA`. Não é suficiente: `FOLGA_RODA` são 620 mm e o para-lama do 2º
 * direcional ocupa ±730 em torno do eixo. A ponta do corrido passava a nascer
 * 110 mm DENTRO do arco — e é isso que a foto do VW mostra, o montante branco
 * da grade atravessando o para-lama.
 *
 * A marca continua sendo calculada porque ela é o diagnóstico (o portão diz
 * quem parte o corrido), mas quem decide é `AMPUTA_MIN`: o arco tem 1,4 m de
 * vão e amputa; a cabeça de parafuso tem 16 mm e não.
 */
const ARCO_RE = /paralama|lameiro|TS_PARALAMA/i;
/** As cotas de SOLO do asset. */
/** A faixa de altura do SUPORTE (90 × 250 × 65), medida no implemento.
 *
 *  Exportada desde 2026-08-24: o chamador precisa nomeá-la para chegar aos
 *  parâmetros seguintes de `truckObstacles()` (a folga que a lista defende). */
export const SUPORTE_Y = [0.840, 1.090];
/**
 * E a da ESTAÇÃO INTEIRA — o montante desce até 510 mm.
 *
 * ⚠️ AS DUAS FAIXAS SÃO NECESSÁRIAS, e usar uma só erra dos dois jeitos. §38
 * registra o primeiro: com a faixa inteira (510…1090) o ESTEPE, que morre em
 * y 678, passava a AMPUTAR o corrido e o baú de 8,4 m ficava com 1,3. Só que
 * com a faixa do suporte (840…1090) o MONTANTE — que é a peça mais baixa da
 * estação — atravessava o que houvesse entre 510 e 840: medido pela varredura
 * geral, 35 mm dentro de `truck_p5` no VW 4x2.
 *
 * Então são duas listas com dois donos: a do SUPORTE decide o que amputa o
 * CORRIDO, e a da ESTAÇÃO decide onde cabe um APOIO. É a mesma separação que
 * §38 já fez entre barra e suporte, levada um nível adiante.
 */
export const ESTACAO_Y = [0.500, 1.100];
/**
 * Corrido menor que isto não vira grade.
 *
 * ⚠️ 450 mm, e não 600. O corrido perde `recuoTampa` (118 mm) em CADA ponta
 * desde que o alcance da tampa passou a valer em toda fronteira, e com o piso
 * em 600 um vão bruto de 830 mm — que é o que sobra entre o 2º direcional e o
 * tandem do VW — caía por SETE milímetros e deixava três metros de flanco sem
 * proteção nenhuma. 450 mm com balanço de 300 nas pontas ainda é um trecho com
 * apoio no meio, e a norma quer continuidade.
 */
const TRECHO_MIN = 0.45;

const PAPEL_BARRA = 'BARRA__';
const PAPEL_ESTACAO = 'ESTACAO__';
const PAPEL_PONTA = 'PONTA__';
/* ───────── A FERRAGEM QUE PRENDE A GRADE AO CHASSI (v2) ─────────
   *"adicione os suportes delas, porque atualmente estão flutuando sem
   suporte; analise o modelo de semirreboque para pegar o modelo do suporte de
   lá"* — Kennedy, 2026-08-23.

   Medido em `semirreboque_frigorifico_paleteiro.glb`, cada uma das seis
   estações (três por flanco) tem, além do suporte e do montante:

     BRACO__   850 × 50 × 58 · |x| 374…1 224 · y 840…890  — a barra horizontal
     MAO__     397 × 248 × 45 · |x| 854…1 251 · y 626…874 — a diagonal que escora
     GRAMPO__   99 ×  80 × 60 · duas, |x| 379…478 e 480…579, y 890…970 — o par
                de chapas que abraça a longarina (que ali está em |x| 477…483)

   Os três ladrilham COM a estação (já vêm rezerados no z dela pelo bake), mas
   não em toda estação: o braço atravessa o caminhão inteiro em |x| e onde
   houver tanque, bateria ou estepe ele não passa. Ver `cabeBraco()`. */
const PAPEL_BRACO = 'BRACO__';
const PAPEL_MAO = 'MAO__';
const PAPEL_GRAMPO = 'GRAMPO__';
const FERRAGEM_RE = /^(BRACO__|MAO__|GRAMPO__)/;
/**
 * A ponta INTERNA do braço, no asset (x = 0 na face externa da grade, crescendo
 * para dentro em x negativo) — é ela que se leva até a longarina.
 *
 * Medido no semirreboque: o braço vai de |x| 374 a 1 224 e o datum do asset
 * está em 1 304, logo a ponta de dentro é −930 mm. A longarina de origem está
 * em |x| 477…483 (asset −824), e é por isso que ali o par de grampos a ABRAÇA:
 * ela é uma alma solta no meio do vão. Num rígido isso não vale — ver o bloco
 * de `bracoAlvoX` em `attachSideGuard()`.
 */
const BRACO_PONTA_DENTRO_X = -0.930;
/** A ponta EXTERNA do braço, no asset. Ela não anda: é onde ele encontra o
 *  montante, e é o ponto fixo do esticamento. */
const BRACO_PONTA_X = -0.080;
/**
 * ▶▶▶ A PONTA DE DENTRO DA MÃO-FRANCESA — e, desde 2026-08-24, o ALCANCE DA
 * CONSOLA INTEIRA.
 *
 * *"assim que deveria ser o suporte que segura essa grade no implemento,
 * literalmente desse jeito; eu diminuí o comprimento da barra horizontal que
 * conecta no implemento porque aqui está muito estranha"* — Kennedy, com um
 * `.glb` do suporte como ele o quer.
 *
 * Medido nesse arquivo, peça por peça, contra o `protecao_lateral_v2.glb`:
 *
 *     peça     no v2                        no modelo do dono
 *     BRACO    −930…−80  (850 mm)           **−446…−38  (408 mm)**
 *     MAO      −449…−52  (397 mm)           −449…−52 (a MESMA)
 *     GRAMPO   dois, −925…−419              **não existem**
 *
 * Ou seja: **o braço termina onde a mão termina** (−446 contra −449) e o par de
 * grampos sai. É uma consola TRIANGULAR, e não uma barra atravessando o vão.
 *
 * O motor fazia o contrário: esticava o braço até `pontaTravessa` (|x| 638 no
 * Scania), 164 mm ALÉM da mão, e ainda montava os grampos — que no semirreboque
 * abraçam a alma de uma longarina solta e aqui não abraçam nada. Medido na
 * cena, `GRAMPO__inox-ferragem` saía em |x| 553…1 047: meio metro de barra
 * pendurada no ar por cima do tanque, que é o "muito estranha" da foto.
 */
const MAO_PONTA_DENTRO_X = -0.449;
/** …e a de fora, no montante — a âncora de quem estica a mão. */
const MAO_PONTA_X = -0.052;
/** O grampo no asset: 890…970 mm de solo. A face inferior da longarina de
 *  origem está em 933, ou seja ele MORDE 37 mm por dentro do perfil — e é essa
 *  mordida que a translação de `GRAMPO_FUNDO_ORIGEM` conserva. */
/**
 * ▶▶▶ O TOPO DO BRAÇO NO ASSET — 890 mm, e o datum de TODA a ferragem.
 *
 * ⚠️ A FERRAGEM NÃO ESTICA: ELA SOBE. A versão anterior esticava o GRAMPO em y
 * para ele alcançar a longarina do implemento, e o fator saía absurdo — medido
 * no app, **×2,06 no VM e ×3,81 no VW**, uma chapa de 80 mm virando 305. Não
 * podia dar outra coisa: esticar em torno da base obriga a peça inteira a
 * crescer para o topo dela chegar lá. O braço, a mão-francesa e o par de
 * grampos são um conjunto RÍGIDO, e o que muda de implemento para implemento é
 * a ALTURA em que ele é aparafusado. Aqui é uma translação.
 */
const BRACO_TOPO_ORIGEM = 0.890;
/**
 * O ponto entre as duas chapas do grampo, no asset.
 *
 * No semirreboque o par abraça a alma da longarina (|x| 477…483) com uma chapa
 * de cada lado — 379…478 e 480…579 —, então o ponto de aperto é o |x| 479.
 *
 * ⚠️ EM REFERENCIAL DE ASSET, e o datum dele é 1 304 (x = 0 na face externa da
 * barra, crescendo para dentro em x NEGATIVO): 479 − 1 304 = **−825 mm**, e não
 * −479. Confere com a medida das duas chapas no arquivo, −823…−724 e
 * −925…−826, cujo encontro está em −824,5.
 *
 * É este ponto que se leva até o membro do implemento, e é por isso que o
 * grampo tem deslocamento PRÓPRIO em x: no semirreboque o braço ATRAVESSA a
 * longarina e sobra 451 mm do outro lado, então mandar o par junto com a ponta
 * do braço o punha meio metro adiante do que ele aperta.
 */
const GRAMPO_MEIO_X = -0.8245;
/** Quanto a ferragem pode subir ou descer. Fora disto o implemento não é
 *  parente deste asset e ela não entra — melhor sem do que torta. */
/* ⚠️ ATÉ 550 mm, e não 450. O plano de fixação do sobrechassi está em 1 135 mm
   de solo e o braço nasce em 890: no VW, cujo implemento assenta 241 mm mais
   alto que o do Scania, a subida é de 471 mm. Ver `BRACO_TOPO_ORIGEM`. */
const FERRAGEM_SOBE = [-0.06, 0.55];
/** Ar entre o topo do braço e a barriga do implemento. */
const FOLGA_BRACO_TETO = 0.015;
/**
 * ▶ QUANTO A GRADE DESCE em relação à cota do semirreboque.
 *
 * *"e acho que deveria abaixar um pouco a grade e os suportes"* — Kennedy,
 * 2026-08-23.
 *
 * O asset traz as barras em 510…610 e 910…1 010 mm de SOLO, medidas no
 * semirreboque. Descer 40 mm põe o conjunto em **470…570 e 870…970**, e o
 * ponto mais baixo — que não é 470, porque o baú é INCLINADO e sobre 8,4 m os
 * 0,9° dão ±67 mm — passa de 449 para **409 mm**.
 *
 * ⚠️ ISTO SÓ DESCE A GRADE, NÃO A FERRAGEM. A CONTRAN 805/1995 limita a borda
 * INFERIOR a 550 mm (é um teto, então descer só folga: sobram 141 mm em vez de
 * 101), mas o TOPO da estação e o braço continuam onde o implemento está —
 * senão a peça deixa de estar presa nele, que é o defeito que §46 fechou. O que
 * cresce é o pedaço do suporte acima da barra, e é o que um para-ciclista
 * montado mais baixo tem de verdade.
 */
export const DESCIDA = 0.040;
/**
 * ▶▶ O TOPO DA ESTAÇÃO NO ASSET — e a cota que fazia a grade FLUTUAR.
 *
 * *"o suporte dela no implemento de sobrechassi não se parece nada com o do
 * semirreboque, ela não está sendo presa realmente no implemento"* — Kennedy,
 * 2026-08-23.
 *
 * ⚠️ 1 090 mm É COTA DO SEMIRREBOQUE, e vinha sendo usada como se fosse cota da
 * PEÇA. No original ela é o ponto em que o suporte encontra a estrutura do
 * implemento — e é por isso que ali a grade nunca pareceu solta: medido, o
 * semirreboque tem `metal-preto` e `caixa-estrutura-preta` no corredor da grade
 * (|x| 1 100…1 296) descendo de 1 100 até 460 mm, ou seja o flanco dele é
 * estrutura de cima a baixo.
 *
 * O sobrechassi não é nada disso. Medido nos dois implementos, na janela que
 * vai do topo da barra de cima (1 010 mm de solo) ao assoalho, além de |x| 600:
 *
 *     semirreboque   estrutura em **47 células de z** (|x| 600…1 296)
 *     sobrechassi    **vazio** — só a pele do baú, em |x| 1 293…1 311
 *
 * Ou seja: no semirreboque o flanco é estrutura de cima a baixo e o suporte
 * encosta nela; no sobrechassi o implemento é um baú sobre longarinas
 * ESTREITAS e a primeira peça acima da grade está em **1 135 mm de solo**
 * (`metal-preto__b3`, os dois trilhos do assoalho em |x| 969…1 024 e
 * 1 209…1 264). Contra um topo de estação fixo em 1 090, isso é:
 *
 *     Scania P    1 135 mm      →  45 mm de ar
 *     Volvo VM    1 237 mm      → 147 mm de ar
 *     VW Const.   1 376 mm      → **286 mm de ar**
 *
 * (a barriga é a MESMA peça nos três — em referencial do implemento ela está
 * sempre em y local 166; o que muda é a altura em que o baú assenta.)
 *
 * Não é aparência: **a peça não encosta no implemento**. A régua nova é a única
 * que não depende do implemento de origem: o topo da estação é a BARRIGA DO
 * IMPLEMENTO MEDIDA, e o suporte cresce em y até lá. Ver `implementBelly()`.
 */
export const TOPO_ESTACAO = 1.090;
/** O topo da barra de cima. Abaixo daqui a estação NÃO estica: ali moram o
 *  montante entre as barras, as chapinhas e o parafuso de 613…708 mm, e todos
 *  têm cota própria em relação às barras. Só o que passa do corrido cresce. */
export const TOPO_BARRA = 1.010;
/**
 * Teto do esticamento do suporte.
 *
 * 600 mm cobre os três rígidos com folga (o pior é o VW, 286) e ainda recusa um
 * implemento que não seja parente deste — se a barriga estiver a mais de meio
 * metro do corrido, o que falta não é um suporte mais alto, é outra peça.
 */
const ESTICA_TOPO_MAX = 0.60;
/** Quanto o braço pode esticar ou encolher em x. Fora disto o implemento não é
 *  parente deste asset e a ferragem não entra — melhor sem do que torta. */
/* ⚠️ 0,42…1,45. Já foi 0,80…1,35, depois 0,55…1,45 e depois 0,45, e desce mais
   uma vez agora que o braço morre na MÃO-FRANCESA DA PRÓPRIA PEÇA
   (`MAO_PONTA_DENTRO_X`) em vez de atravessar o vão até a estrutura do
   implemento: a conta fecha em **0,434** — 850 mm de origem viram 369, que é o
   braço do modelo do dono (408 mm medidos, com a ponta de fora 42 mm mais para
   dentro que a do asset). Abaixo de 0,42 já não é este braço, e a ferragem não
   entra: melhor sem do que torta. */
const BRACO_ESCALA = [0.42, 1.45];
/** Meia-altura da faixa que o BRAÇO varre à procura de obstáculo. Ele mora em
 *  y 840…890 e é uma chapa de 50 mm; 70 mm de faixa dá 20 mm de ar de cada
 *  lado sem transformar cada parafuso do chassi em obstáculo. */
/* ⚠️ 780…990 E NÃO 820…910. A grade é filha do IMPLEMENTO e o implemento é
   INCLINADO (`pitchX`): sobre 8,4 m de baú, 0,9° são ±67 mm, então o braço que
   nominalmente mora em 840…890 mm de solo passa por 773…957 conforme o z. Com
   a faixa nominal a varredura não via a travessa traseira do VM — medido,
   47 mm de braço dentro de `chassis_p3`. */
/* ▶▶ E O PISO DESCEU A 560 EM 2026-08-24, porque a faixa era do BRAÇO e a
   ferragem não é só ele. A MÃO-FRANCESA mora em y 626…874 no asset — 214 mm
   ABAIXO do braço —, e desde que a ferragem passou a SUBIR com a barriga do
   implemento (§46, `subida` de 270 mm no Scania) a janela varrida começava em
   1 050 e a mão inteira ficava fora dela. Enquanto o tanque bloqueava a estação
   isso não aparecia; assim que a estação passou a caber sobre ele
   (`FOLGA_LATERAL`), a varredura geral mediu **28 mm de `MAO__metal-preto`
   dentro de `chassis_p15`, 27 dentro do bocal do ARLA e 20 dentro do corpo**.
   O piso é o fundo da mão (626) menos os 67 mm da inclinação. */
const BRACO_FAIXA_Y = [0.560, 0.990];
/** …e a faixa em |x| que ele ocupa: da ponta da mão-francesa do implemento
 *  (|x| 739, medida) até o montante. */
const BRACO_FAIXA_X = [0.70, 1.25];
/**
 * A faixa em que se procura a LONGARINA DO CAMINHÃO — e ela é ESTREITA.
 *
 * ⚠️ 300…560 mm, e não 200…750. §25.2 mediu a alma das duas longarinas deste
 * acervo em |x| 0,425 (8,6 m² de face no VM, 10,0 no Scania) e as longarinas do
 * sobrechassi a cavalo dela, em 0,374…0,439. Com a janela larga o máximo caía
 * no primeiro suporte que houvesse em 0,74 e o braço saía com 47 % do tamanho
 * — abaixo do mínimo, e a ferragem não era montada em caminhão nenhum.
 */
const CHASSI_FAIXA_X = [0.30, 0.56];
/** Ar entre a ponta do braço e a face externa da longarina. */
const BRACO_ENCOSTO = 0.025;
/** Folga em z em torno do que bloqueia o braço. */
const BRACO_FOLGA_Z = 0.09;

/* Cotas MEDIDAS no asset (`protecao_lateral_v1_meta.json`), e por isso fixas:
   o `_v1` é imutável por contrato de cache. A barra não começa no datum — ela
   começa 77 mm à frente dele — e a tampa de ponta fica 44 mm ALÉM do fim da
   barra, encavalada nela, que é como a peça real fecha o perfil. */
const BARRA_DESDE = 0.077;
const PONTA_ALEM = 0.044;
/** O nó que este módulo cria e destrói. */
const RAIZ = 'TS_PROTECAO_LATERAL';

export interface SideGuardOpts {
  /**
   * O SOLO, no referencial da raiz do implemento — o asset tem y = 0 ali.
   *
   * ⚠️ ERA O PISO DO BAÚ, e estava errado. As cotas da grade são de SOLO (a
   * borda inferior a 510 mm é o que a CONTRAN 805/1995 limita a 550), e o piso
   * varia de implemento para implemento: 1 392 mm no semirreboque contra
   * 1 151 no sobrechassi sobre o Scania. Ancorada no piso, a peça descia
   * 241 mm ao mudar de dono — *"está muito baixo a grade"*.
   */
  yGround: number;
  /** |x| da pele do flanco, no mesmo referencial. */
  skinX: number;
  /** Traseira e testeira do baú, no mesmo referencial (`z0 < z1`). */
  z0: number;
  z1: number;
  /**
   * Onde o corrido TEM de se partir, em z do IMPLEMENTO.
   *
   * Não são só as rodas: o suporte da estação desce do baú até a barra de
   * cima, passando pela faixa em que o caminhão guarda TANQUE, ARLA, caixa de
   * bateria, estepe e caixa de ferramentas. Medido no Scania P, os tanques vão
   * a |x| 1 239 e o estepe a 1 188, contra uma grade em 1 248 — um suporte ali
   * atravessaria a chapa do tanque. *"cuidado para os suportes que prendem no
   * implemento não atravessarem componentes como tanque, caixa de ferramentas
   * etc."* — Kennedy.
   *
   * Quem os mede é `truckObstacles()`, e é ele que sabe a que |x| a grade vai
   * ficar. Vazio faz um corrido só, de ponta a ponta.
   */
  obstaculos?: { z0: number; z1: number; vao?: number; arco?: boolean }[];
  /** Onde as rodas do caminhão passam, em z do implemento. Elas partem o
   *  CORRIDO; os obstáculos acima só suprimem SUPORTE. */
  rodasZ?: number[];
  /**
   * Meio-vão de CADA eixo, em metros — paralelo a `rodasZ`.
   *
   * ⚠️ `FOLGA_RODA` é um piso, não a medida. O para-lama do 2º direcional ocupa
   * ±730 mm em torno do eixo e os 620 mm da constante deixavam a ponta do
   * corrido 110 mm DENTRO dele — o montante branco atravessando o arco, que é
   * o que a foto do VW mostra. Quem mede é `wheelBayReach()`.
   */
  rodasMeia?: number[];
  /** Materiais do implemento, por nome. O asset traz só o NOME. */
  materiais?: Map<string, THREE.Material>;
  /**
   * ▶ Onde o BRAÇO da estação não passa, em z do implemento.
   *
   * Ele é diferente de `obstaculos`: aquele varre a faixa da grade (|x| além de
   * 1 120) e este varre o VÃO DE BAIXO DO CAMINHÃO (|x| 620…1 200 na altura de
   * 840…890 mm), que é por onde o braço atravessa. É uma lista muito mais
   * cheia — tanque, caixa de bateria, estepe, silencioso, reservatório de ar —
   * e é ela que decide QUAIS estações ganham ferragem. Onde não cabe, a estação
   * fica com suporte e montante, como na v1: é o que o implementador faz.
   */
  obstaculosBraco?: { z0: number; z1: number }[];
  /**
   * Onde não cabe uma ESTAÇÃO — a mesma varredura de `obstaculos`, na faixa de
   * altura da estação INTEIRA (510…1100) em vez da do suporte (840…1090). Ver
   * `ESTACAO_Y`: sem ela o montante atravessa o que estiver entre 510 e 840.
   */
  obstaculosEstacao?: { z0: number; z1: number }[];
  /**
   * O |x| do EIXO da longarina do SOBRECHASSI, medido no implemento.
   *
   * O par de grampos abraça a longarina, e ela não está no mesmo |x| em todo
   * implemento. O braço estica em x (extrusão pura, como a barra estica em z)
   * até o par cair em cima dela.
   */
  chassiX?: number;
  /**
   * A face INFERIOR da longarina do sobrechassi, em y de SOLO.
   *
   * ⚠️ ELA MOVE A FERRAGEM, NÃO A ESTICA. No semirreboque a longarina tem a
   * face de baixo em 933 mm e o grampo, que vai de 890 a 970, MORDE 37 mm do
   * perfil. Esticar o grampo até a longarina do implemento que o recebe dava
   * ×2,06 no VM e ×3,81 no VW — uma chapa de 80 mm virando 305. O conjunto
   * inteiro (braço, mão-francesa e grampos) SOBE `chassiBaixoY − 933 mm`, e a
   * mordida de 37 mm se conserva sozinha. Ver `GRAMPO_FUNDO_ORIGEM`.
   */
  chassiBaixoY?: number;
  /**
   * ▶ ATÉ ONDE A ESTRUTURA DO IMPLEMENTO VEM PARA FORA, em |x|, na altura do
   * braço — é ONDE o braço se prende, e é a resposta a *"o problema era o
   * suporte horizontal, que realmente prende no implemento"*.
   *
   * Medida por `implementBracket()`: no sobrechassi é a ponta da MÃO-FRANCESA,
   * |x| 739. Ausente, o braço volta a mirar `chassiX` — o caminho de volta para
   * um implemento sem esse membro.
   */
  pontaTravessa?: number;
  /**
   * ▶ A BARRIGA DO IMPLEMENTO acima do corredor da estação, em y de SOLO.
   *
   * É até aqui que o suporte cresce — e é o conserto de *"ela não está sendo
   * presa realmente no implemento"*. Sem ela o topo da estação fica na cota do
   * asset (1 090 mm), que é do semirreboque: no VW isso deixa **286 mm de ar**
   * entre a peça e o baú. Quem a mede é `implementBelly()`.
   */
  barrigaY?: number;
  /**
   * E onde o CAMINHÃO ocupa esse corredor — as faixas de z em que ele tem
   * geometria entre o topo da barra e a barriga, no plano da grade.
   *
   * A estação que cai numa delas NÃO cresce: ela fica com o topo do asset, e o
   * relato diz quantas ficaram. É a mesma lista de `truckObstacles()`, com a
   * faixa de altura de cima — sem ela um suporte esticado atravessaria o que
   * houvesse ali em silêncio.
   */
  obstaculosTopo?: { z0: number; z1: number }[];
}

/** Espelha uma geometria em X — e INVERTE O ENROLAMENTO junto.
 *
 *  ⚠️ Sem inverter, a peça aparece pelo avesso: o three descarta face por
 *  enrolamento, não pela normal declarada. É o mesmo erro que
 *  `bake_wheel_vm.py` registra ter cometido com a roda. */
function espelha(geo: THREE.BufferGeometry, eixo: 'x' | 'z'): THREE.BufferGeometry {
  const g = geo.clone();
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const le = (a: THREE.BufferAttribute, i: number) => (eixo === 'x' ? a.getX(i) : a.getZ(i));
  const es = (a: THREE.BufferAttribute, i: number, v: number) => {
    if (eixo === 'x') a.setX(i, v); else a.setZ(i, v);
  };
  for (let i = 0; i < pos.count; i++) es(pos, i, -le(pos, i));
  pos.needsUpdate = true;
  const nrm = g.getAttribute('normal') as THREE.BufferAttribute | undefined;
  if (nrm) {
    for (let i = 0; i < nrm.count; i++) es(nrm, i, -le(nrm, i));
    nrm.needsUpdate = true;
  }
  const idx = g.getIndex();
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      const b = idx.getX(i + 1), c = idx.getX(i + 2);
      idx.setX(i + 1, c); idx.setX(i + 2, b);
    }
    idx.needsUpdate = true;
  }
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

/**
 * Os trechos de CORRIDO — partidos só nas RODAS.
 *
 * ⚠️ A BARRA E O SUPORTE NÃO DESVIAM DA MESMA COISA, e tratá-los junto deixou
 * a grade com 1,3 m num baú de 8,4. A barra mora NA FACE da grade, por fora de
 * tudo: ela passa por cima do tanque, da caixa de bateria e do estepe sem
 * encostar em nenhum. Quem entra para dentro é o SUPORTE, que desce do baú
 * atravessando a faixa em que aquelas peças moram — e é só ele que se
 * suprime. É o que um caminhão real faz: o corrido é contínuo e os suportes
 * ficam onde cabem.
 *
 * A roda é outra história: ela ocupa a face inteira e parte o corrido de fato.
 */
function trechos(o: SideGuardOpts, recuoTampa = 0): {
  lista: { z0: number; z1: number }[]; margemTras: number;
} {
  /* ▶▶▶ O QUE ACABA ANTES DO BAÚ É O CONJUNTO, NÃO O CORRIDO.
     ------------------------------------------------------------------------
     *"essa grade lateral metálica está indo muito para trás, ela deve acabar
     antes do baú"* — Kennedy, 2026-08-22.

     `MARGEM_TRAS` recuava o DATUM do corrido 60 mm da parede traseira, e a
     conta parecia fechar: o trecho começava em −4 199 contra o baú em −4 259.
     Só que atrás do datum ainda moram duas peças — a tampa de ponta, que fica
     `PONTA_ALEM` além do fim da barra, e o corpo dela, que é a peça espelhada
     em z. Medido: o conjunto ia até −4 295, ou seja **36 mm ATRÁS da parede**,
     e é essa quina que aparece na foto.

     Então o recuo da tampa entra na conta do começo do corrido. Ele é MEDIDO
     no asset (não constante) porque a tampa é peça de tamanho fixo e o
     `_v1` é imutável por contrato de cache: se um dia o asset mudar, a conta
     acompanha sozinha. */
  /* ▶▶▶ E A TAMPA RECOLHE **TODA** FRONTEIRA, NÃO SÓ A TRASEIRA.
     ------------------------------------------------------------------------
     ⚠️ Esta é a segunda vez que o alcance da tampa entra na conta, e da
     primeira ele entrou pela metade. `recuoTampa` só descontava o começo do
     PRIMEIRO trecho; nas pontas que morrem numa RODA, o conjunto continuava
     passando 118 mm além do fim do corrido — e a varredura geral mediu
     exatamente isso: 55 e 56 mm de tampa dentro do cubo da roda traseira do VM,
     62 mm dentro do chassi do VW. A ponta não é a barra: ela é a barra mais a
     tampa, que fica `PONTA_ALEM` além dela e ainda tem corpo próprio.

     A régua passa a ser uma só: os limites saem do vão livre e DEPOIS todo
     limite recua `recuoTampa` para dentro. */
  const buracos = [...(o.rodasZ ?? [])].map((r, i) => {
    const meia = o.rodasMeia?.[i] ?? FOLGA_RODA;
    return { z0: r - meia, z1: r + meia };
  }).sort((a, b) => a.z0 - b.z0);
  /* ▶▶ A MARGEM DE TRÁS É UM ALVO QUE CEDE — 2026-08-25.
     ------------------------------------------------------------------------
     *"a grade metálica lateral está indo muito para trás, faça com que termine
     antes do final do baú"* — Kennedy, 2026-08-25.

     ⚠️ `MARGEM_TRAS` VALIA 60 mm POR UM MOTIVO QUE DEIXOU DE VALER. O
     comentário dela guarda a razão: *"o corrido de trás nasce entre a traseira
     do baú e o tandem, e é o mais curto dos dois — no 6x2 sobravam 703 mm, e
     200 mm de margem comiam quase um terço disso"*. Com o conjunto traseiro
     recuado (ver `BOGIE_POR_CAMINHAO` em `rear-bogie.ts`) o vão dobrou: medido
     no VM 8x2, são **1 642 mm** entre a traseira do baú e a baia do eixo
     auxiliar. A margem apertada era uma concessão à falta de espaço, e o
     espaço apareceu.

     Então ela deixa de ser constante e passa a ser ALVO COM PISO: pede-se
     `MARGEM_TRAS_ALVO`, cede-se até `MARGEM_TRAS` quando o que sobra não
     mantém um corrido de `TRECHO_BOM`. Assim o caminhão com espaço ganha a
     folga que o dono pediu e o que não tem espaço não perde a grade — que é o
     caso que fixou os 60 mm. */
  const primeiro = buracos.find((h) => h.z1 > o.z0);
  const vaoTras = (primeiro ? primeiro.z0 : o.z1) - o.z0;
  const margemTras = Math.min(MARGEM_TRAS_ALVO,
    Math.max(MARGEM_TRAS, vaoTras - TRECHO_BOM));
  const inicio = o.z0 + margemTras, fim = o.z1 - MARGEM_FRENTE;
  const bruto: { z0: number; z1: number }[] = [];
  let z = inicio;
  for (const h of buracos) {
    if (h.z1 <= inicio || h.z0 >= fim) continue;
    if (h.z0 - z >= TRECHO_MIN) bruto.push({ z0: z, z1: h.z0 });
    z = Math.max(z, h.z1);
  }
  if (fim - z >= TRECHO_MIN) bruto.push({ z0: z, z1: fim });
  /* ⚠️ SÓ A PONTA DA FRENTE RECUA DO OBSTÁCULO — e fazer isso em TODA ponta
     apagou a grade do VW.
     ------------------------------------------------------------------------
     A regra de §43.8 ("o corrido mais dianteiro recua até a face traseira do
     primeiro obstáculo") parecia acanhada, e a generalização parecia óbvia: se
     uma extremidade livre dentro de uma peça é colisão numa ponta, é colisão em
     todas. Errado, e o motivo é o rip: **`truck_p4` do VW é UMA malha com o
     caminhão inteiro dentro**, então `truckObstacles()` devolve ali
     `-4148…-3848 · -2948…-1548 · -1348…252 · 252…952 · 1652…3752 · 3652…6252`
     — o chassi quase todo. Com uma lista dessas, recuar TODA ponta come cada
     trecho até ele morrer em `TRECHO_MIN`: medido, o VW 8x2 saiu de dois
     corridos para **um de 713 mm num flanco de 8,5 m**, ou seja um caminhão sem
     para-ciclista. *"o vw está sem a grade lateral no implemento"* — Kennedy.

     A lista de obstáculos deste acervo não é confiável o bastante para governar
     as duas pontas. A ponta da frente continua recuando (é a que morre em cima
     do tanque, e o §43.8 tem a foto); as outras nascem numa RODA, e quem cuida
     delas é `rodasMeia` mais o recuo da tampa, que são medidas e não listas. */
  /* ▶ E TODA PONTA RECUA DO QUE ENCOSTA NELA — mas com ORÇAMENTO.
     ------------------------------------------------------------------------
     §45.1 conta o desastre de fazer isso sem teto: com a lista de obstáculos do
     VW (que cobre o chassi quase todo, porque `truck_p4` é uma malha só) cada
     trecho era comido até morrer. O que faltava não era desistir da regra, era
     PAGAR POR ELA: a ponta recua enquanto isso custar menos que
     `RECUO_BARATO`; passou disso, o corrido fica e a sobreposição vai para o
     relatório. Assim uma chapa de 30 mm no caminho da tampa é resolvida e uma
     lista de obstáculos ruim não apaga a grade.

     A lista é a da ESTAÇÃO (y 500…1 100), e não a do suporte: quem chega na
     ponta é a TAMPA, que tem 506 mm de altura. Medido no VW: 32 mm de tampa
     dentro de `truck_p4` em Zn −3 201, com a lista do suporte cega. */
  /* ▶▶▶ O QUE MORA DENTRO DE UMA BAIA JÁ FOI COBRADO — 2026-08-24.
     ------------------------------------------------------------------------
     *"e ainda está acabando antes do que deveria"* — Kennedy, com a ponta
     dianteira do Scania 8x2 morrendo 194 mm antes da roda.

     O corrido é partido na roda por `rodasMeia`, que desde §43.9 é MEDIDA no
     corredor da grade: ela já enxerga pneu, cubo, porca e PARA-LAMA, e já sai
     com `FOLGA_ARCO` de ar. Medido no Scania 8x2, a baia do 2º direcional é
     3 107 ± 682, ou seja o corrido nasce em 2 425 — e aí a lista de obstáculos
     vinha COBRAR A MESMA PEÇA outra vez: `t_paralama_0_p1` ocupa 2 432…3 732,
     dentro da baia de ponta a ponta, e empurrava a ponta para 2 231.

     Duas cobranças pelo mesmo arco. A faixa de obstáculo CONTIDA numa baia sai
     da conta das pontas — quem manda ali é a baia, que é medida. O que atravessa
     a fronteira dela continua valendo inteiro: é o caso do 3 832…6 332 do
     Scania, que começa na saia da cabine, fora de qualquer baia. */
  /* ⚠️ COM A TOLERÂNCIA DE `FOLGA_OBSTACULO`, e ela não é um arredondamento: é
     EXATAMENTE o que `truckObstacles()` acrescentou de cada lado ao converter a
     célula em faixa. Sem ela o teste falha por 93 mm — medido: o para-lama do
     2º direcional entra na lista da ESTAÇÃO como 2 332…2 632 enquanto a baia
     começa em 2 425, e a ponta voltava a recuar. */
  /* ⚠️⚠️ E A BAIA SE RECORTA DA FAIXA, EM VEZ DE TER DE CONTÊ-LA — 2026-08-25.
     ------------------------------------------------------------------------
     *"além disso a barra terá que extender"* — Kennedy, com a ponta dianteira
     do VM 8x2 morrendo 572 mm antes da roda do 2º direcional, acima dos 400 mm
     da CONTRAN 805/1995.

     O teste acima era de CONTENÇÃO: a faixa saía da conta só se coubesse
     INTEIRA numa baia. Serve quando a faixa é do arco e nada mais — que é o
     caso do Scania —, e falha quando o rip entrega a faixa COLADA no resto do
     caminhão. Medido no VM: `obstaculosEstacao` traz **2 052…6 352**, ou seja o
     para-lama do 2º direcional grudado na cabine e no que vem à frente dela,
     enquanto a baia é 2 162…3 696. A faixa não cabe na baia, a baia não some, e
     o mesmo arco é cobrado duas vezes: a ponta recuava de 2 162 para 1 952 e,
     com a tampa, o corrido acabava em 1 833.

     Recortar resolve os dois casos com uma régua só. O que sobra da faixa
     depois de tirar as baias é o que de fato não foi medido — no VM sobram
     10 mm de um lado (ruído de quantização, abaixo de `LASCA`) e a parte que
     está mesmo à frente da baia, que continua valendo inteira. No Scania nada
     muda: as faixas dele já não encostam nas baias. */
  const recorta = (h: { z0: number; z1: number; vao?: number }) => {
    let pedacos = [{ z0: h.z0, z1: h.z1, vao: h.vao }];
    for (const b of buracos) {
      const b0 = b.z0 - FOLGA_OBSTACULO, b1 = b.z1 + FOLGA_OBSTACULO;
      const novos: typeof pedacos = [];
      for (const p of pedacos) {
        if (b1 <= p.z0 || b0 >= p.z1) { novos.push(p); continue; }
        if (p.z0 < b0) novos.push({ z0: p.z0, z1: b0, vao: p.vao });
        if (p.z1 > b1) novos.push({ z0: b1, z1: p.z1, vao: p.vao });
      }
      pedacos = novos;
    }
    return pedacos.filter((p) => p.z1 - p.z0 >= LASCA);
  };
  const perto = (o.obstaculosEstacao ?? o.obstaculos ?? []).flatMap(recorta);
  for (const t of bruto) {
    const z1Antes = t.z1, z0Antes = t.z0;
    for (let passo = 0; passo < 8; passo++) {
      const dentro = perto
        .filter((h) => t.z1 > h.z0 - FOLGA_PONTA && t.z1 < h.z1)
        .sort((a, b) => a.z0 - b.z0)[0];
      if (!dentro) break;
      const z1 = dentro.z0 - FOLGA_PONTA;
      if (z1 <= t.z0 || z1 >= t.z1 || z1Antes - z1 > RECUO_BARATO) break;
      t.z1 = z1;
    }
    for (let passo = 0; passo < 8; passo++) {
      const dentro = perto
        .filter((h) => t.z0 < h.z1 + FOLGA_PONTA && t.z0 > h.z0)
        .sort((a, b) => b.z1 - a.z1)[0];
      if (!dentro) break;
      const z0 = dentro.z1 + FOLGA_PONTA;
      if (z0 >= t.z1 || z0 <= t.z0 || z0 - z0Antes > RECUO_BARATO) break;
      t.z0 = z0;
    }
  }

  const ult = bruto[bruto.length - 1];
  if (ult) {
    for (let passo = 0; passo < 8; passo++) {
      const dentro = (o.obstaculos ?? [])
        .flatMap(recorta)
        .filter((h) => (h.vao ?? Infinity) >= AMPUTA_MIN)
        .filter((h) => ult.z1 > h.z0 - FOLGA_PONTA && ult.z1 < h.z1)
        .sort((a, b) => a.z0 - b.z0)[0];
      if (!dentro) break;
      const z1 = dentro.z0 - FOLGA_PONTA;
      if (z1 - ult.z0 < TRECHO_MIN || z1 >= ult.z1) break;
      ult.z1 = z1;
    }
  }
  const out = bruto
    .map((t) => ({ z0: t.z0 + recuoTampa, z1: t.z1 - recuoTampa }))
    .filter((t) => t.z1 - t.z0 >= TRECHO_MIN);
  return { lista: out, margemTras };
}

/** Este z aceita um SUPORTE? Ele desce do baú e não pode atravessar tanque,
 *  caixa de bateria, estepe nem caixa de ferramentas. */
function cabeSuporte(z: number, o: SideGuardOpts): boolean {
  const lista = o.obstaculosEstacao ?? o.obstaculos ?? [];
  return !lista.some((h) => z > h.z0 && z < h.z1);
}

/** …e um BRAÇO? Ele vai muito mais para dentro, e por isso tem lista própria. */
function cabeBraco(z: number, o: SideGuardOpts): boolean {
  return !(o.obstaculosBraco ?? []).some((h) => z > h.z0 && z < h.z1);
}

/** …e um SUPORTE ESTICADO até a barriga? O corredor acima da barra costuma
 *  estar livre (a varredura geral não achou nada do caminhão além de |x| 458),
 *  mas quem responde é a medida e não o costume. */
function cabeTopo(z: number, o: SideGuardOpts): boolean {
  return !(o.obstaculosTopo ?? []).some((h) => z > h.z0 && z < h.z1);
}

/**
 * AS ESTAÇÕES DE UM CORRIDO, em z ABSOLUTO — balanço limitado, vão ≤ `PASSO`.
 *
 * A conta parte das PONTAS para dentro, e é isso que garante o que a versão
 * anterior não garantia: nenhuma estação nasce fora da barra. Com `BALANCO` de
 * cada lado sobra `vao − 2·BALANCO` para distribuir; o número de vãos é o menor
 * que mantém cada um ≤ `PASSO`, e eles saem iguais.
 *
 * Corrido curto demais para dois apoios (menos de `2·BALANCO`) leva UM, no meio
 * — é o que se faz com um pedaço de 400 mm entre a roda e a traseira.
 *
 * ⚠️ A estação que cai em obstáculo ANDA, não some. O suporte desce do baú
 * atravessando a faixa em que o caminhão guarda tanque, ARLA, bateria, estepe e
 * caixa de ferramentas (ver `truckObstacles()`), e a peça real faz exatamente
 * isto: o implementador desloca o suporte para o vão mais próximo. A busca é
 * simétrica e vai até meio passo; passou disso, o vão é do caminhão e a barra
 * atravessa sem apoio, como no caminhão de verdade.
 */
function estacoes(t: { z0: number; z1: number }, o: SideGuardOpts): number[] {
  const vao = t.z1 - t.z0;
  const util = vao - 2 * BALANCO;
  /* ⚠️ COM TETO — ver `ESTACOES_MAX`. A conta de `PASSO` continua sendo a que
     distribui; o teto é que decide quantas cabem. */
  const n = util <= 0 ? 1
    : Math.min(ESTACOES_MAX, Math.ceil(util / PASSO - 1e-9) + 1);
  const passo = n > 1 ? util / (n - 1) : 0;
  const limite = PASSO / 2;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const alvo = n > 1 ? t.z0 + BALANCO + i * passo : (t.z0 + t.z1) / 2;
    if (cabeSuporte(alvo, o)) { out.push(alvo); continue; }
    let achado: number | null = null;
    for (let d = DESVIO_PASSO; d <= limite && achado === null; d += DESVIO_PASSO) {
      for (const z of [alvo - d, alvo + d]) {
        /* Sem sair do próprio corrido: uma estação além da ponta é o defeito
           que esta função existe para não cometer. */
        if (z < t.z0 + 0.02 || z > t.z1 - 0.02) continue;
        if (cabeSuporte(z, o)) { achado = z; break; }
      }
    }
    if (achado !== null) out.push(achado);
  }
  /* Duas estações que o desvio empurrou uma para cima da outra viram uma. */
  return out.filter((z, i) => i === 0 || z - out[i - 1] > 0.15);
}

/**
 * O QUE O CAMINHÃO TEM NA FAIXA DA GRADE, em z do IMPLEMENTO.
 *
 * Varre a cabine por VÉRTICE e devolve as faixas de z em que existe geometria
 * a menos de `folga` do plano da grade, dentro da altura dela — e a folga é do
 * CHAMADOR porque ela é a espessura da peça que aquela lista defende:
 * `FOLGA_BARRA` para o corrido, `FOLGA_LATERAL` para o suporte. É por
 * VÉRTICE e não por caixa de malha pela razão de sempre nesta base: a caixa de
 * um nó que atravessa o caminhão (o `chassis_p12` do Scania tem 247 peças e vai
 * de ponta a ponta) não é a caixa de nenhuma peça dele.
 *
 * As RODAS entram por fora, pelo manifesto: o pneu é escondido por
 * `swapTruckWheels()` antes daqui, então varrer não o acharia.
 */
/**
 * O MEIO-VÃO DE CADA EIXO — o que o corrido tem de pular.
 *
 * ⚠️ NÃO É O PNEU E NÃO É O ARCO: É O CORREDOR DA GRADE.
 *
 * Esta é a terceira régua desta cota, e as duas primeiras erraram por medirem
 * uma PEÇA em vez de medirem o ESPAÇO que a peça ocupa:
 *
 *   1ª — `FOLGA_RODA` fixo, 620 mm. Dimensionado para o pneu (raio ~510), e o
 *        para-lama do 2º direcional tem 1,4 m: a ponta do corrido nascia
 *        110 mm dentro do arco (§43.9).
 *   2ª — o vão medido só nas malhas de ARCO. Melhor, e ainda cego: no tandem
 *        não há arco nenhum, então valia o piso de 620 — e o CUBO CROMADO da
 *        roda do VM, que chega a |x| 1 181, atravessava a barra da grade. A
 *        varredura geral mediu 55 e 63 mm de barra dentro do disco.
 *
 * A régua que não erra não pergunta "onde está a roda", e sim **"o que existe
 * no corredor por onde a barra passa"**: |x| além da face interna da grade, na
 * altura dela. Ali só há o que a barra encontraria de verdade — pneu, cubo,
 * porca, arco, para-barro —, e o que estiver 40 mm para dentro (o tanque
 * recuado, por exemplo) não conta, que é o certo. É a mesma lição de
 * "toda régua tirada da roda erra", pelo lado de fora.
 */
/** O último diagnóstico de `wheelBayReach()`, para o console e a bancada. */
export const wheelBayReach: {
  (cab: THREE.Object3D, N: THREE.Matrix4, eixosNorm: number[], xCorredor: number): number[];
  ultimo?: { meias: number[]; culpado: string[] };
} = _wheelBayReach;

function _wheelBayReach(
  cab: THREE.Object3D, N: THREE.Matrix4, eixosNorm: number[], xCorredor: number,
): number[] {
  const meias = eixosNorm.map(() => FOLGA_RODA);
  /* ⚠️ QUEM ESTICOU CADA BAIA, e não só quanto. Sem este nome, "a grade está
     curta" volta a ser uma foto sem diagnóstico — que é o defeito de método que
     esta frente inteira existe para não repetir. */
  const culpado: string[] = eixosNorm.map(() => '—');
  wheelBayReach.ultimo = { meias, culpado };
  if (!eixosNorm.length) return meias;
  cab.updateWorldMatrix(true, true);
  const cabInv = new THREE.Matrix4().copy(cab.matrixWorld).invert();
  const L2N = new THREE.Matrix4();
  const v = new THREE.Vector3();
  cab.traverse((node) => {
    const m = node as THREE.Mesh;
    if (!m.isMesh || !m.geometry || !m.visible) return;
    const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) return;
    L2N.copy(N).multiply(cabInv).multiply(m.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L2N);
      if (Math.abs(v.x) < xCorredor) continue;
      if (v.y < CORREDOR_Y[0] || v.y > CORREDOR_Y[1]) continue;
      /* ⚠️ A BAIA É REDONDA, e é isso que separa a roda da saia da cabine.
         ------------------------------------------------------------------
         A primeira tentativa filtrou por NOME (roda ou arco). Funciona no VM e
         no Scania e é cega no VW, cujo rip é UMA malha só (`truck_p4`, 186 k
         triângulos com o caminhão inteiro dentro): lá o para-barro de fábrica
         não tem nome próprio e a ponta do corrido nascia dentro dele.
         A segunda filtrou por "está no corredor a menos de um metro de um
         eixo", e ENCURTOU A GRADE PELA METADE — o estribo e a saia da cabine
         entram nessa conta, e o vão de cada baia ia ao teto.

         O que separa as duas coisas não é o nome nem a distância em z: é a
         FORMA. Roda, aro, cubo e para-barro moram num DISCO em torno do eixo;
         estribo, saia e caixa de bateria são compridos em z e ficam longe do
         centro dele. O critério é o raio no plano (y, z) a partir do centro do
         eixo, e ele é o mesmo em qualquer rip. */
      let k = -1, d = Infinity;
      for (let j = 0; j < eixosNorm.length; j++) {
        const dj = Math.hypot(v.y - EIXO_Y, v.z - eixosNorm[j]);
        if (dj < d) { d = dj; k = j; }
      }
      if (k < 0 || d > RAIO_BAIA) continue;
      const alvo = Math.min(Math.abs(v.z - eixosNorm[k]) + FOLGA_ARCO, CORREDOR_TETO);
      if (alvo > meias[k]) { meias[k] = alvo; culpado[k] = m.name || '(sem nome)'; }
    }
  });
  return meias;
}

export function truckObstacles(
  cab: THREE.Object3D, paraImplemento: (zNorm: number) => number,
  N: THREE.Matrix4, xGuarda: number, yGround: number, faixaY = SUPORTE_Y,
  porTriangulo = false, folga = FOLGA_LATERAL,
): { z0: number; z1: number }[] {
  cab.updateWorldMatrix(true, true);
  const cabInv = new THREE.Matrix4().copy(cab.matrixWorld).invert();
  const L2N = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const CEL = 0.10;
  /* `true` enquanto a célula só tiver visto ARCO DE RODA — ver `ARCO_RE`. */
  const ocupado = new Map<number, boolean>();
  /* ⚠️ A FAIXA É A DO SUPORTE, não a da grade. A barra mora na FACE e passa
     por fora de tudo; o que colide é o suporte, que ocupa y 840…1 090. Usar a
     faixa inteira (510…1 090) fazia o estepe — que morre em y 678 — cortar o
     corrido, e o baú de 8,4 m ficava com 1,3. */
  const yBaixo = yGround + faixaY[0] - 0.03;
  const yAlto = yGround + faixaY[1] + 0.03;

  cab.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry || !m.visible) return;
    const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) return;
    /* ⚠️ ARCO DE RODA NÃO AMPUTA O CORRIDO. O para-lama do 2º direcional
       (`TS_PARALAMA_DIR2`, montado por `front-fender.ts`) e os arcos do rip
       ocupam ±700 mm em torno do eixo — e o corrido JÁ é partido ali, por
       `FOLGA_RODA`. Contá-los como parede recuava a ponta mais 230 mm por
       nada. Eles continuam bloqueando SUPORTE (`cabeSuporte()` usa a lista
       inteira): o suporte desce do baú e atravessaria o arco. */
    let arco = false;
    for (let p: THREE.Object3D | null = m; p && p !== cab.parent; p = p.parent) {
      if (ARCO_RE.test(p.name || '')) { arco = true; break; }
    }
    L2N.copy(N).multiply(cabInv).multiply(m.matrixWorld);
    if (!porTriangulo) {
      for (let i = 0; i < pos.count; i++) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L2N);
        if (v.y < yBaixo || v.y > yAlto) continue;
        if (Math.abs(v.x) < xGuarda - folga) continue;
        const k = Math.round(v.z / CEL);
        ocupado.set(k, (ocupado.get(k) ?? true) && arco);
      }
      return;
    }
    /* ⚠️ POR TRIÂNGULO na lista da ESTAÇÃO — mesmo motivo de
       `truckArmObstacles()`: uma chapa cujos três vértices caem FORA da faixa
       ainda a atravessa pelo meio. Medido no VM 6x2, 11 mm de tampa de ponta
       dentro de `chs_base_0_p3` (a saia da cabine), com a varredura por vértice
       dizendo que ali não havia nada. A lista de AMPUTAÇÃO continua por
       vértice, de propósito: mudá-la mexeria no que §43.8 e §43.9 fecharam. */
    const idx = m.geometry.getIndex();
    const nT = idx ? idx.count / 3 : pos.count / 3;
    const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3();
    for (let f = 0; f < nT; f++) {
      const i0 = idx ? idx.getX(f * 3) : f * 3;
      const i1 = idx ? idx.getX(f * 3 + 1) : f * 3 + 1;
      const i2 = idx ? idx.getX(f * 3 + 2) : f * 3 + 2;
      pa.set(pos.getX(i0), pos.getY(i0), pos.getZ(i0)).applyMatrix4(L2N);
      pb.set(pos.getX(i1), pos.getY(i1), pos.getZ(i1)).applyMatrix4(L2N);
      pc.set(pos.getX(i2), pos.getY(i2), pos.getZ(i2)).applyMatrix4(L2N);
      if (Math.max(pa.y, pb.y, pc.y) < yBaixo || Math.min(pa.y, pb.y, pc.y) > yAlto) continue;
      const ax = Math.max(Math.abs(pa.x), Math.abs(pb.x), Math.abs(pc.x));
      if (ax < xGuarda - folga) continue;
      const z0 = Math.min(pa.z, pb.z, pc.z), z1 = Math.max(pa.z, pb.z, pc.z);
      for (let k = Math.round(z0 / CEL); k <= Math.round(z1 / CEL); k++) {
        ocupado.set(k, (ocupado.get(k) ?? true) && arco);
      }
    }
  });

  const faixas: { z0: number; z1: number; arco: boolean }[] = [];
  for (const k of [...ocupado.keys()].sort((a, b) => a - b)) {
    const z0 = k * CEL - CEL / 2, z1 = k * CEL + CEL / 2;
    const u = faixas[faixas.length - 1];
    if (u && z0 - u.z1 <= CEL) { u.z1 = z1; u.arco = u.arco && (ocupado.get(k) as boolean); }
    else faixas.push({ z0, z1, arco: ocupado.get(k) as boolean });
  }
  /* Do espaço do CAMINHÃO para o do IMPLEMENTO, e com a folga de montagem. */
  return faixas
    .map((f) => ({ z0: paraImplemento(f.z0) - FOLGA_OBSTACULO,
      z1: paraImplemento(f.z1) + FOLGA_OBSTACULO,
      arco: f.arco,
      /* ⚠️ O COMPRIMENTO MEDIDO, sem as folgas — é ele que decide se a peça
         AMPUTA o corrido ou só desloca um suporte. Ver `AMPUTA_MIN`. */
      vao: f.z1 - f.z0 }))
    .sort((a, b) => a.z0 - b.z0);
}

/**
 * ▶ O QUE O CAMINHÃO TEM NO CAMINHO DO BRAÇO, em z do IMPLEMENTO.
 *
 * Irmã de `truckObstacles()`, com outra janela e outro dono. Aquela pergunta
 * "o que chega perto do PLANO DA GRADE" e decide o corrido e o suporte; esta
 * pergunta "o que está no VÃO ENTRE A LONGARINA E O MONTANTE, na altura do
 * braço" e decide quais estações ganham ferragem.
 *
 * A faixa em |x| começa em 620 mm de propósito: a longarina do caminhão e o
 * sobrechassi moram para dentro disso e são o que o braço ABRAÇA, não o que ele
 * evita. O que sobra na janela é equipamento de flanco — tanque, caixa de
 * bateria, estepe, silencioso, reservatório de ar —, e ali um braço de 850 mm
 * atravessaria a chapa.
 *
 * Por VÉRTICE, e não por caixa de malha, pelo motivo de sempre nesta base: a
 * caixa de um nó que atravessa o caminhão inteiro não é a caixa de nenhuma
 * peça dele.
 */
export function truckArmObstacles(
  cab: THREE.Object3D, paraImplemento: (zNorm: number) => number,
  N: THREE.Matrix4, yGround: number, subida: number,
): { faixas: { z0: number; z1: number }[]; chassiFora: number } {
  cab.updateWorldMatrix(true, true);
  const cabInv = new THREE.Matrix4().copy(cab.matrixWorld).invert();
  const L2N = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const CEL = 0.10;
  const ocupado = new Set<number>();
  const yBaixo = yGround + subida + BRACO_FAIXA_Y[0];
  const yAlto = yGround + subida + BRACO_FAIXA_Y[1];
  /* …e, de quebra, ATÉ ONDE VAI A LONGARINA DO CAMINHÃO nessa mesma altura.
     Num rígido o sobrechassi senta nela, então quem manda no fim do braço é a
     mais externa das duas. */
  let fora = 0;
  cab.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry || !m.visible) return;
    const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) return;
    const idx = m.geometry.getIndex();
    const nT = idx ? idx.count / 3 : pos.count / 3;
    L2N.copy(N).multiply(cabInv).multiply(m.matrixWorld);
    /* ⚠️ POR TRIÂNGULO, E NÃO POR VÉRTICE — e é a exceção à regra desta base.
       Em toda outra varredura daqui o vértice é a unidade certa (a caixa de um
       nó que atravessa o caminhão não é a caixa de nenhuma peça dele). Aqui
       não: o `truck_p4` do VW é UMA malha com o caminhão inteiro, e ela tem
       triângulos GRANDES — uma chapa cujos três vértices caem FORA da faixa de
       780…990 mm ainda a atravessa pelo meio. Medido pela varredura geral,
       40 mm de braço dentro de uma dessas chapas, com a varredura por vértice
       dizendo que ali não havia nada. A caixa do triângulo enxerga. */
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let f = 0; f < nT; f++) {
      const i0 = idx ? idx.getX(f * 3) : f * 3;
      const i1 = idx ? idx.getX(f * 3 + 1) : f * 3 + 1;
      const i2 = idx ? idx.getX(f * 3 + 2) : f * 3 + 2;
      a.set(pos.getX(i0), pos.getY(i0), pos.getZ(i0)).applyMatrix4(L2N);
      b.set(pos.getX(i1), pos.getY(i1), pos.getZ(i1)).applyMatrix4(L2N);
      c.set(pos.getX(i2), pos.getY(i2), pos.getZ(i2)).applyMatrix4(L2N);
      const y0 = Math.min(a.y, b.y, c.y), y1 = Math.max(a.y, b.y, c.y);
      if (y1 < yBaixo || y0 > yAlto) continue;
      const ax0 = Math.min(Math.abs(a.x), Math.abs(b.x), Math.abs(c.x));
      const ax1 = Math.max(Math.abs(a.x), Math.abs(b.x), Math.abs(c.x));
      if (ax1 >= CHASSI_FAIXA_X[0] && ax1 <= CHASSI_FAIXA_X[1] && ax1 > fora) fora = ax1;
      if (ax1 < BRACO_FAIXA_X[0] || ax0 > BRACO_FAIXA_X[1]) continue;
      const z0 = Math.min(a.z, b.z, c.z), z1 = Math.max(a.z, b.z, c.z);
      for (let k = Math.round(z0 / CEL); k <= Math.round(z1 / CEL); k++) ocupado.add(k);
    }
  });
  void v;
  const faixas: { z0: number; z1: number }[] = [];
  for (const k of [...ocupado].sort((a, b) => a - b)) {
    const z0 = k * CEL - CEL / 2, z1 = k * CEL + CEL / 2;
    const u = faixas[faixas.length - 1];
    if (u && z0 - u.z1 <= CEL) u.z1 = z1;
    else faixas.push({ z0, z1 });
  }
  return {
    faixas: faixas.map((f) => ({
      z0: paraImplemento(f.z0) - BRACO_FOLGA_Z,
      z1: paraImplemento(f.z1) + BRACO_FOLGA_Z,
    })).sort((a, b) => a.z0 - b.z0),
    chassiFora: fora,
  };
}

/**
 * A LONGARINA DO SOBRECHASSI — |x| do eixo e face de BAIXO, em y de SOLO.
 *
 * É o que a ferragem da grade abraça, e ele muda de implemento para implemento
 * (medido: o sobrechassi desce a 901 mm no Scania, 953 no VM e 1 175 no VW).
 * Por VÉRTICE e na faixa |x| 300…620, que é onde a longarina mora nos três — o
 * mesmo corte que o portão de varredura usa para dizer "sobrechassi desce a".
 *
 * MEMOIZADO no `userData` do implemento: esta função varre a árvore inteira e
 * `placeTrailer()` roda a cada quadro de um arraste de comprimento. As cotas
 * que ela devolve não dependem do comprimento — a longarina estica em z.
 */
export function implementRail(
  t: THREE.Object3D, yGround: number,
): { x: number; y: number } | null {
  const memo = t.userData as { tsRail?: { x: number; y: number } | null; tsRailY?: number };
  if (memo.tsRail !== undefined && memo.tsRailY === yGround) return memo.tsRail;
  t.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(t.matrixWorld).invert();
  const L = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const baixo: { x: number; y: number }[] = [];
  let minY = Infinity;
  t.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh || !m.geometry || !m.visible) return;
    /* A própria grade não conta: ela é filha do implemento e desce a 510. */
    for (let p: THREE.Object3D | null = m; p; p = p.parent) {
      if (p.name === RAIZ) return;
    }
    if (/^(FUSAO__)?(BARRA|ESTACAO|PONTA|BRACO|MAO|GRAMPO)__/.test(m.name)) return;
    const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) return;
    L.copy(inv).multiply(m.matrixWorld);
    const passo = pos.count > 60000 ? 3 : 1;
    for (let i = 0; i < pos.count; i += passo) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L);
      const ax = Math.abs(v.x);
      if (ax < 0.30 || ax > 0.62) continue;
      const y = v.y - yGround;
      if (y < 0.40 || y > 1.80) continue;
      baixo.push({ x: ax, y });
      if (y < minY) minY = y;
    }
  });
  let r: { x: number; y: number } | null = null;
  if (Number.isFinite(minY)) {
    const naFace = baixo.filter((p) => p.y < minY + 0.03);
    if (naFace.length > 20) {
      /* ⚠️ A FACE EXTERNA, e não o eixo. No semirreboque o braço ABRAÇA a
         longarina porque ali ela é uma viga solta no meio do vão; num rígido o
         sobrechassi está SENTADO na longarina do caminhão, e um braço que
         atravesse o |x| dela entra no chassi — medido, 47 mm no VM. Num rígido
         a ferragem encosta na face de FORA e para ali, que é onde uma
         implementadora aparafusa. Percentil 95 para não pegar um parafuso
         solto como se fosse a alma da viga. */
      const xs = naFace.map((p) => p.x).sort((a, b) => a - b);
      r = { x: xs[Math.floor(xs.length * 0.95)], y: minY };
    }
  }
  memo.tsRail = r; memo.tsRailY = yGround;
  return r;
}

/** Estica uma geometria em X mantendo `x0` parado — extrusão pura, o mesmo
 *  argumento pelo qual a BARRA estica em z. */
function esticaX(geo: THREE.BufferGeometry, x0: number, k: number): THREE.BufferGeometry {
  const g = geo.clone();
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setX(i, x0 + (pos.getX(i) - x0) * k);
  pos.needsUpdate = true;
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

/** Move uma geometria em X. */
function moveX(geo: THREE.BufferGeometry, dx: number): THREE.BufferGeometry {
  const g = geo.clone();
  g.translate(dx, 0, 0);
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

/** Move uma geometria em Y — é assim que a FERRAGEM alcança a longarina do
 *  implemento que a recebe. Ela não estica: sobe. Ver `GRAMPO_FUNDO_ORIGEM`. */
function moveY(geo: THREE.BufferGeometry, dy: number): THREE.BufferGeometry {
  const g = geo.clone();
  g.translate(0, dy, 0);
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

/**
 * Estica em Y **só o que está acima de `yCorte`**, mantendo `yCorte` parado.
 *
 * É o que faz o suporte da estação alcançar a barriga do implemento sem mexer
 * em nada que tenha cota própria em relação às BARRAS. Abaixo do corte a
 * geometria não é tocada: ali moram o montante entre as barras (510…1 010), a
 * chapinha de 26 × 95 em 613…708 e o parafuso de 624…655, e todos eles são
 * medidos a partir do corrido, não do topo.
 *
 * ⚠️ ISTO SÓ É SEGURO PORQUE NENHUM COMPONENTE DO ASSET CRUZA `TOPO_BARRA`.
 * Medido em `protecao_lateral_v2.glb`, componente a componente: o montante vai
 * a 1 090 e o suporte de 840 a 1 090 (os dois passam do corte e crescem por
 * inteiro na parte de cima), e o inox tem três peças — 613…708, 624…655 e o
 * parafuso de topo em 1 045…1 065. Nenhuma começa abaixo de 1 010 e termina
 * acima, então nada é rasgado. Um asset novo que quebre isso precisa de outra
 * régua, e o portão `checks-grade-fixacao-0823.mjs` mede a costura.
 */
function esticaYAcima(
  geo: THREE.BufferGeometry, yCorte: number, k: number,
): THREE.BufferGeometry {
  const g = geo.clone();
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > yCorte) pos.setY(i, yCorte + (y - yCorte) * k);
  }
  pos.needsUpdate = true;
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

/**
 * …e o mesmo corte, MOVENDO em vez de esticar.
 *
 * O parafuso do topo da estação (21 × 21 × 96, em 1 045…1 065) tem de ANDAR com
 * a chapa que ele prende, e não crescer com ela: esticá-lo ×4,6 — que é o que o
 * VW pede — daria um pino de 92 mm. Peça de tamanho fixo anda; chapa estica. É
 * a mesma separação que a TAMPA DE PONTA já tem em relação à BARRA.
 */
function moveYAcima(
  geo: THREE.BufferGeometry, yCorte: number, dy: number,
): THREE.BufferGeometry {
  const g = geo.clone();
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > yCorte) pos.setY(i, y + dy);
  }
  pos.needsUpdate = true;
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

/**
 * ▶▶ A BARRIGA DO IMPLEMENTO acima do corredor da estação, em y de SOLO.
 *
 * *"ela não está sendo presa realmente no implemento"* — e não estava: o topo
 * da estação era a cota do SEMIRREBOQUE (1 090 mm) e a barriga do sobrechassi
 * está em 1 135 no Scania, 1 237 no VM e 1 376 no VW. Esta função é a régua que
 * faltava, e ela mede o implemento em vez de assumir o de origem.
 *
 * POR CÉLULA DE Z E DEPOIS A MEDIANA. A barriga é plana em z — a grade é filha
 * da raiz do implemento, então a inclinação de `pitchX` já saiu da conta e o
 * assoalho é horizontal neste referencial —, mas as PONTAS não: nas duas
 * células traseiras o que aparece é o para-choque, 100 mm mais baixo. A mediana
 * das células devolve o assoalho e ignora as duas pontas, que é o que uma
 * estação encontra em 95 % do corrido.
 *
 * MEMOIZADA no `userData`, como `implementRail()` e pelo mesmo motivo:
 * `placeTrailer()` passa por aqui a cada quadro de um arraste de comprimento, e
 * a cota não depende do comprimento — o baú estica em z e a barriga não desce.
 */
export function implementBelly(
  t: THREE.Object3D, yGround: number, xDe: number, xAte: number,
): number | null {
  const chave = `${yGround.toFixed(4)}|${xDe.toFixed(3)}|${xAte.toFixed(3)}`;
  const memo = t.userData as { tsBarriga?: number | null; tsBarrigaK?: string };
  if (memo.tsBarrigaK === chave && memo.tsBarriga !== undefined) return memo.tsBarriga;
  t.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(t.matrixWorld).invert();
  const L = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const CEL = 0.25;
  const cel = new Map<number, number>();
  t.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh || !m.geometry || !m.visible) return;
    /* A própria grade não conta — ela é filha do implemento e o suporte dela é
       justamente o que se quer medir CONTRA a barriga. */
    for (let p: THREE.Object3D | null = m; p; p = p.parent) if (p.name === RAIZ) return;
    if (/^(FUSAO__)?(BARRA|ESTACAO|PONTA|BRACO|MAO|GRAMPO)__/.test(m.name)) return;
    const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) return;
    L.copy(inv).multiply(m.matrixWorld);
    const passo = pos.count > 60000 ? 3 : 1;
    for (let i = 0; i < pos.count; i += passo) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L);
      const ax = Math.abs(v.x);
      if (ax < xDe || ax > xAte) continue;
      const y = v.y - yGround;
      /* Acima do corrido e abaixo do teto do baú: o que está no meio é o
         assoalho e a estrutura que o segura. */
      if (y < TOPO_BARRA + 0.02 || y > 2.0) continue;
      const k = Math.round(v.z / CEL);
      const u = cel.get(k);
      if (u === undefined || y < u) cel.set(k, y);
    }
  });
  const ys = [...cel.values()].sort((a, b) => a - b);
  const r = ys.length >= 8 ? ys[Math.floor(ys.length / 2)] : null;
  memo.tsBarriga = r; memo.tsBarrigaK = chave;
  return r;
}

/**
 * ▶▶ ATÉ ONDE A ESTRUTURA DO IMPLEMENTO VEM PARA FORA, na altura do braço.
 *
 * *"o problema era o suporte horizontal, que realmente prende no implemento"* —
 * Kennedy, 2026-08-23. É esta função que responde ONDE ele se prende, e a
 * resposta é do IMPLEMENTO e de mais ninguém.
 *
 * No semirreboque o braço morre na LONGARINA (alma em |x| 477…483, mesa de
 * baixo 415…545 em 933 mm) e o par de grampos a abraça. No sobrechassi essa
 * longarina existe — |x| 374…439, y local 1…181 — mas ela está 800 mm para
 * dentro e, na altura em que o braço do semirreboque mora (840…890 mm de solo),
 * o caminhão guarda tanque, caixa de bateria e estepe. O braço não passa, e foi
 * por isso que ele deixou de ser montado em 3 de 4 estações no VM e 2 de 3 no
 * VW: a grade ficava pendurada.
 *
 * O que o sobrechassi tem no lugar é MELHOR e é dele: a **mão-francesa**, uma
 * chapa que sai da longarina e vai até |x| 739, y local 11…231, repetida a cada
 * 695 mm ao longo dos 8,4 m. Ela está a 1 135 mm de solo — acima de tudo o que
 * o caminhão pendura no flanco — e é onde uma implementadora aparafusa.
 *
 * A régua: histograma de |x| em células de 25 mm, na faixa de altura do braço,
 * e a resposta é o |x| do fim da CORRIDA CONTÍNUA que começa na longarina.
 * Contínua de propósito — o trilho do assoalho em |x| 969…1 024 também aparece
 * na faixa, e ele é uma ilha: um braço que morresse nele passaria por 230 mm de
 * ar antes de encontrar qualquer coisa.
 *
 * MEMOIZADA, como `implementRail()` e pelo mesmo motivo.
 */
export function implementBracket(
  t: THREE.Object3D, yGround: number, yDe: number, yAte: number,
): number | null {
  const chave = `${yGround.toFixed(4)}|${yDe.toFixed(3)}|${yAte.toFixed(3)}`;
  const memo = t.userData as { tsPonta?: number | null; tsPontaK?: string };
  if (memo.tsPontaK === chave && memo.tsPonta !== undefined) return memo.tsPonta;
  t.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(t.matrixWorld).invert();
  const L = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const CEL = 0.025;
  const ocupado = new Set<number>();
  t.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh || !m.geometry || !m.visible) return;
    for (let p: THREE.Object3D | null = m; p; p = p.parent) if (p.name === RAIZ) return;
    if (/^(FUSAO__)?(BARRA|ESTACAO|PONTA|BRACO|MAO|GRAMPO)__/.test(m.name)) return;
    const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) return;
    L.copy(inv).multiply(m.matrixWorld);
    const passo = pos.count > 60000 ? 3 : 1;
    for (let i = 0; i < pos.count; i += passo) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L);
      const y = v.y - yGround;
      if (y < yDe || y > yAte) continue;
      const ax = Math.abs(v.x);
      if (ax < 0.20 || ax > 1.30) continue;
      ocupado.add(Math.round(ax / CEL));
    }
  });
  /* A corrida contínua a partir da longarina. Começa na primeira célula
     ocupada além de |x| 300 (a alma) e anda enquanto não houver buraco de mais
     de uma célula — 25 mm é menos que a chapa mais fina do implemento. */
  let k = Math.round(0.30 / CEL);
  while (k < Math.round(1.30 / CEL) && !ocupado.has(k)) k++;
  if (k >= Math.round(1.30 / CEL)) { memo.tsPonta = null; memo.tsPontaK = chave; return null; }
  let fim = k;
  for (let j = k; j <= Math.round(1.30 / CEL); j++) {
    if (ocupado.has(j)) fim = j;
    else if (j - fim > 1) break;
  }
  const r = fim * CEL + CEL / 2;
  memo.tsPonta = r; memo.tsPontaK = chave;
  return r;
}

/**
 * Apaga a proteção lateral que uma montagem anterior deixou.
 *
 * ⚠️ EXPORTADA PORQUE A MEDIDA VEM ANTES DA MONTAGEM. `implementBelly()` e
 * `implementBracket()` varrem a árvore do implemento à procura da peça mais
 * baixa acima da grade — e a grade da passagem anterior ainda está lá, com o
 * suporte dela subindo justamente até a barriga. Medida com ela dentro, a
 * barriga é o topo do próprio suporte, e a cota fica presa no primeiro valor
 * que sair. O `applyMerge()` piora: ele funde POR MATERIAL, e uma grade fundida
 * perde o nome e o pai, então nem o filtro de nome nem o de raiz a excluem.
 * Apagar antes de medir é a única regra que não depende de reconhecê-la.
 */
export function removeSideGuard(trailer: THREE.Object3D): void {
  const velho = trailer.getObjectByName(RAIZ);
  if (!velho) return;
  velho.traverse((n) => {
    const m = n as THREE.Mesh;
    if (m.isMesh && m.geometry) m.geometry.dispose();
  });
  velho.removeFromParent();
}

/**
 * Monta a proteção lateral no implemento.
 *
 * IDEMPOTENTE: apaga o que uma chamada anterior criou. `setTrailerDims()` passa
 * por aqui a cada arraste do controle de comprimento, e somar peça por
 * passagem é o defeito clássico deste motor.
 */
/**
 * A face INTERNA da barra da proteção, em espaço LOCAL do implemento.
 *
 * ⚠️ NÃO SE MEDE ISTO COM `Box3.setFromObject()`. Foi o que eu fiz primeiro, e
 * funcionava no bench e NÃO funcionava no app — o bench monta o implemento no
 * referencial dele, e o app o pendura no `rigGroup`, que carrega o `orientYaw`.
 * Com a guinada de π o `min.x` do mundo sai NEGATIVO, o teste de sanidade
 * (`> 0.5`) reprovava e o encolhimento da aba não acontecia, sem erro nenhum.
 * Quatro pedidos de "diminua a placa SCANIA" morreram nesse `if`.
 *
 * Aqui não entra matriz de mundo: a barra do kit tem x = 0 na face EXTERNA e
 * cresce para dentro em x negativo, então a face interna é a face-alvo menos a
 * profundidade da barra — e isso é verdade em qualquer pose.
 */
export function guardInnerX(kit: THREE.Object3D | null, skinX: number): number {
  const xAlvo = skinX - RECUO_DA_PELE;
  let dentro = 0;
  kit?.traverse((n) => {
    const m = n as THREE.Mesh;
    /* ⚠️ TODO O KIT, e não só a BARRA. A versão anterior media só
       `BARRA__*` e devolvia |x| 1 206 no 6x2 — mas o conjunto montado ocupa
       **1 116…1 251** (medido no app, 2026-08-22): quem entra 90 mm mais para
       dentro é o SUPORTE da estação, que é justamente a peça em que a aba do
       para-barro bate. Com a régua da barra a aba parava em 1 105, ou seja
       **11 mm** da face real da grade — que a olho é encostar, e é a queixa
       *"a placa scania está entrando dentro da grade"* voltando pela terceira
       vez. A face que a aba tem de respeitar é a do conjunto INTEIRO. */
    if (!m.isMesh || !m.geometry) return;
    if (!/^(BARRA__|ESTACAO__|PONTA__)/.test(m.name)) return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox;
    if (bb) dentro = Math.max(dentro, Math.abs(Math.min(bb.min.x, 0)));
  });
  return xAlvo - dentro;
}

export function attachSideGuard(
  trailer: THREE.Object3D, kit: THREE.Object3D | null, o: SideGuardOpts,
): string[] {
  removeSideGuard(trailer);
  if (!kit) return [];

  /* As malhas do asset, por papel. */
  const barras: THREE.Mesh[] = [];
  const estacao: THREE.Mesh[] = [];
  const pontas: THREE.Mesh[] = [];
  /* A FERRAGEM (v2): braço, mão-francesa e grampos. Ela ladrilha com a estação
     mas nem toda estação a recebe — ver `cabeBraco()`. */
  const ferragem: THREE.Mesh[] = [];
  kit.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    if (m.name.startsWith(PAPEL_BARRA)) barras.push(m);
    else if (m.name.startsWith(PAPEL_ESTACAO)) estacao.push(m);
    else if (m.name.startsWith(PAPEL_PONTA)) pontas.push(m);
    else if (FERRAGEM_RE.test(m.name)) ferragem.push(m);
  });
  if (!barras.length) return ['⚠ o asset da proteção lateral não tem barra.'];

  /* O ALCANCE DA TAMPA ATRÁS DO DATUM, medido no asset — ver o ▶▶▶ de
     `trechos()`. A de trás é a da frente espelhada em z, então o que ela
     ocupa para trás é o que a original ocupa para a frente. */
  let recuoTampa = 0;
  for (const pt of pontas) {
    pt.geometry.computeBoundingBox();
    const bb = pt.geometry.boundingBox;
    if (bb) recuoTampa = Math.max(recuoTampa, PONTA_ALEM + Math.max(0, bb.max.z));
  }
  const { lista, margemTras: margemTrasUsada } = trechos(o, recuoTampa);
  if (!lista.length) return ['proteção lateral: nenhum trecho coube no baú.'];

  const raiz = new THREE.Group();
  raiz.name = RAIZ;
  trailer.add(raiz);

  /* O material do implemento, pelo NOME que o asset carrega. Sem ele a peça
     ficaria com o material stub do arquivo — cinza fosco, fora da régua da
     frota e imune à tinta. */
  /* ⚠️ O NOME DO MATERIAL DO ASSET CARREGA O PAPEL, e a busca não tirava.
     ------------------------------------------------------------------------
     `protecao_lateral_v*.glb` batiza material E malha de `PAPEL__material`
     (`BARRA__metal-galvanizado-mantido`), e o sobrechassi tem o material com o
     nome CURTO (`metal-galvanizado-mantido`). Procurando pelo nome inteiro a
     busca nunca casava: a grade ficava com o material STUB do arquivo — fora
     da tinta, fora da régua de frota e SECA na chuva, que é justamente o que o
     cabeçalho deste módulo diz que não pode acontecer. O sintoma que a
     denunciou foi outro: `applyMerge()` funde POR MATERIAL, e a grade aparecia
     na cena como um balde só dela, `FUSAO__BARRA__metal-galvanizado-…`.
     Resolvidos os dois nomes, o curto primeiro. */
  const material = (m: THREE.Mesh): THREE.Material => {
    const bruto = (Array.isArray(m.material) ? m.material[0] : m.material)?.name || '';
    const curto = bruto.replace(/^[A-Z]+__/, '');
    return o.materiais?.get(curto) ?? o.materiais?.get(bruto)
      ?? (Array.isArray(m.material) ? m.material[0] : m.material);
  };

  const xAlvo = o.skinX - RECUO_DA_PELE;
  /* ▶ A DESCIDA (ver `DESCIDA`): o grupo nasce mais baixo e, para o topo da
     estação e o braço continuarem NO IMPLEMENTO, a barriga sobe a mesma coisa
     no referencial do asset. As duas linhas andam sempre juntas. */
  const yGrupo = o.yGround - DESCIDA;
  const barrigaY = o.barrigaY === undefined ? undefined : o.barrigaY + DESCIDA;

  /* ───────── A FERRAGEM SE AJUSTA AO IMPLEMENTO QUE A RECEBE ─────────
     Duas cotas, e as duas são MEDIDAS no implemento em vez de arbitradas:

       · o |x| da longarina do sobrechassi — o par de grampos tem de cair em
         cima dela, e ela não está onde estava no semirreboque. Quem estica é o
         BRAÇO, que é extrusão pura em x (mesmo argumento da barra em z);
       · a face de BAIXO dessa longarina — o grampo nasce em 890 mm de solo e
         sobe até mordê-la. Sem esticar, ele acabaria no ar num implemento com
         a longarina mais alta e DENTRO dela num mais baixo.

     Sem as duas o motor não monta ferragem: melhor sem do que torta. */
  /* ▶▶▶ ONDE O BRAÇO MORRE — e esta é a correção de 2026-08-23, §46.
     ------------------------------------------------------------------------
     *"o problema era o suporte horizontal, que realmente prende no implemento;
     olha o semirreboque, precisa desse mesmo suporte no sobrechassi"*.

     A versão anterior levava a ponta do braço até a LONGARINA — a do
     sobrechassi ou a do caminhão, a mais externa das duas — na altura em que
     ela mora no semirreboque, 840…890 mm de solo. Nos dois implementos a
     longarina existe, mas as duas frases seguintes são medidas e mudam tudo:

       · no semirreboque o flanco é ESTRUTURA de |x| 600 a 1 296, em 47 células
         de z, descendo até a barra da grade — o braço acha onde se prender em
         qualquer estação;
       · no sobrechassi, na MESMA janela, não há NADA além de |x| 600. O que
         existe naquela altura é o que o CAMINHÃO pendura: tanque, caixa de
         bateria, estepe. Daí `cabeBraco()` recusar a ferragem em 3 de 4
         estações no VM e 2 de 3 no VW — e a grade ficar pendurada.

     O sobrechassi tem outro membro, e é dele: a MÃO-FRANCESA, chapa que sai da
     longarina e vai até |x| 739 em y local 11…231, repetida a cada 695 mm nos
     8,4 m. Ela está a 1 135 mm de solo, ACIMA de tudo o que o caminhão pendura
     no flanco, e é ali que uma implementadora aparafusa. O braço passa a morrer
     nela — `o.pontaTravessa`, medida por `implementBracket()` — e o caminhão
     deixa de ter voz na questão, que é o que o dono mandou.

     `chassiX` continua sendo a régua quando a ponta não pôde ser medida: é o
     caminho de volta para um implemento que não tenha mão-francesa. */
  const alvoMedido = o.pontaTravessa ?? (o.chassiX !== undefined
    ? o.chassiX + BRACO_ENCOSTO : undefined);
  /* ▶▶ E O BRAÇO NÃO PASSA DA MÃO — 2026-08-24, ver `MAO_PONTA_DENTRO_X`.
     ------------------------------------------------------------------------
     A régua de §46 mandava o braço até a estrutura do implemento, e ela está
     certa para um implemento cuja estrutura desce ao lado da grade (o
     semirreboque). No sobrechassi ela fica 164 mm além da mão-francesa da
     PRÓPRIA PEÇA, e o que se vê é uma barra atravessando o vão livre por cima
     do tanque. A consola é um triângulo: o braço morre onde a mão morre, e
     quem prende de fato é o TOPO DA ESTAÇÃO, que sobe até a barriga do
     implemento e encosta nela (§46.4).

     `Math.max` porque |x| cresce para FORA: o alvo mais externo é o mais
     curto, e é o da mão. Num implemento cuja estrutura venha mais para fora do
     que ela — não há nenhum neste acervo — quem manda volta a ser a medida. */
  const alvoBracoX = alvoMedido === undefined ? undefined
    : Math.max(alvoMedido, xAlvo + MAO_PONTA_DENTRO_X);
  const bracoAlvoX = alvoBracoX !== undefined ? -(xAlvo - alvoBracoX) : null;
  const kBraco = bracoAlvoX === null ? 1
    : (bracoAlvoX - BRACO_PONTA_X) / (BRACO_PONTA_DENTRO_X - BRACO_PONTA_X);
  /* …e a mão pelo MESMO alvo, com a âncora dela. Fica 1 quando o braço já morre
     na ponta da mão, que é o caso deste acervo. */
  const kMao = bracoAlvoX === null ? 1
    : (bracoAlvoX - MAO_PONTA_X) / (MAO_PONTA_DENTRO_X - MAO_PONTA_X);
  /* ▶▶ E A QUE ALTURA. A ferragem SOBE, não estica (ver `BRACO_TOPO_ORIGEM`):
     o conjunto é rígido e o que muda é a cota em que ele é aparafusado. O topo
     do braço encosta na barriga do implemento, com `FOLGA_BRACO_TETO` de ar.
     Sem barriga medida, o caminho de volta é a face de baixo da longarina —
     que é o que o semirreboque usa. */
  const dyFerragem = barrigaY !== undefined
    ? (barrigaY - FOLGA_BRACO_TETO) - BRACO_TOPO_ORIGEM
    : o.chassiBaixoY !== undefined ? (o.chassiBaixoY + DESCIDA) - 0.933 : 0;
  /* ⚠️ O GRAMPO TEM DESLOCAMENTO PRÓPRIO em x, e mandá-lo junto com a ponta do
     braço punha o par 100 mm ADIANTE do que ele aperta: no asset o ponto de
     aperto (`GRAMPO_MEIO_X`) fica 451 mm para fora da ponta do braço, porque
     no semirreboque o braço ATRAVESSA a longarina e sobra do outro lado. Aqui
     quem tem de cair em cima do membro do implemento é o APERTO. */
  const grampoDx = alvoBracoX !== undefined
    ? -(xAlvo - alvoBracoX) - GRAMPO_MEIO_X : 0;
  /* ▶ O PAR DE GRAMPOS SÓ EXISTE ONDE HÁ ALMA PARA ABRAÇAR.
     No semirreboque ele aperta a longarina, que ali é uma alma solta no meio do
     vão (|x| 477…483) — por isso são DUAS chapas, uma de cada lado. Num
     implemento que traz a própria estrutura (`pontaTravessa` medida) não há o
     que apertar, e o par saía pendurado no ar sobre o tanque. O modelo do dono
     não os tem. Sem `pontaTravessa` — o caminho de volta, em que o braço mira a
     longarina — eles continuam. */
  const temGrampo = o.pontaTravessa === undefined;
  const temFerragem = ferragem.length > 0 && bracoAlvoX !== null
    && kBraco >= BRACO_ESCALA[0] && kBraco <= BRACO_ESCALA[1]
    && dyFerragem >= FERRAGEM_SOBE[0] && dyFerragem <= FERRAGEM_SOBE[1];

  /* ───────── E A ESTAÇÃO CRESCE ATÉ A BARRIGA DO IMPLEMENTO ─────────
     *"ela não está sendo presa realmente no implemento"*. O topo do suporte era
     `TOPO_ESTACAO`, que é cota do semirreboque; a barriga do sobrechassi está
     45 mm acima disso no Scania, 147 no VM e 286 no VW. Quem mede é
     `implementBelly()`, e o que cresce é só o que passa do corrido. */
  const alvoTopo = barrigaY === undefined ? TOPO_ESTACAO
    : Math.min(Math.max(barrigaY, TOPO_ESTACAO), TOPO_ESTACAO + ESTICA_TOPO_MAX);
  const dyTopo = alvoTopo - TOPO_ESTACAO;
  const kTopo = (alvoTopo - TOPO_BARRA) / (TOPO_ESTACAO - TOPO_BARRA);
  const estica = dyTopo > 0.005;
  /** A ESTAÇÃO, nas duas alturas: a esticada e a do asset. Uma estação que caia
   *  numa faixa de `obstaculosTopo` fica com a curta — o corredor acima da
   *  barra é dela e o motor não a empurra para dentro de nada. */
  const estacaoPronta = (lado: number, alta: boolean):
  { nome: string; geo: THREE.BufferGeometry; mat: THREE.Material }[] =>
    estacao.map((e) => {
      let geo = e.geometry;
      if (alta && estica) {
        /* A CHAPA estica; o PARAFUSO anda. Ver `esticaYAcima()`/`moveYAcima()`. */
        geo = /inox|parafuso/i.test(e.name)
          ? moveYAcima(geo, TOPO_BARRA, dyTopo)
          : esticaYAcima(geo, TOPO_BARRA, kTopo);
      }
      return { nome: e.name, geo: lado > 0 ? geo.clone() : espelha(geo, 'x'),
        mat: material(e) };
    });

  /** A ferragem já ajustada, uma vez por lado — as instâncias só a repetem. */
  const ferragemPronta = (lado: number): { nome: string; geo: THREE.BufferGeometry;
    mat: THREE.Material }[] => {
    const out2: { nome: string; geo: THREE.BufferGeometry; mat: THREE.Material }[] = [];
    for (const f of ferragem) {
      let geo = f.geometry;
      if (f.name.startsWith(PAPEL_BRACO)) geo = esticaX(geo, BRACO_PONTA_X, kBraco);
      else if (f.name.startsWith(PAPEL_GRAMPO)) {
        if (!temGrampo) continue;
        /* O par de grampos cai EM CIMA do membro do implemento — deslocamento
           próprio, não o da ponta do braço. Ver `grampoDx`. */
        geo = moveX(geo, grampoDx);
      } else if (f.name.startsWith(PAPEL_MAO)) {
        /* ▶ A MÃO ACOMPANHA O BRAÇO. Ela era fixa, e com o braço morrendo na
           estrutura do implemento a consola ficava aberta — o braço passando
           164 mm além da diagonal que deveria escorá-lo. Agora as duas pontas
           de dentro coincidem, que é o triângulo do modelo do dono. Estica em
           x, ancorada no montante: a altura não muda e a diagonal só deita. */
        if (kMao !== 1) geo = esticaX(geo, MAO_PONTA_X, kMao);
      } else continue;
      /* …e as três SOBEM juntas até a longarina do implemento. */
      if (dyFerragem !== 0) geo = moveY(geo, dyFerragem);
      out2.push({ nome: f.name, geo: lado > 0 ? geo.clone() : espelha(geo, 'x'),
        mat: material(f) });
    }
    return out2;
  };

  const porTrecho: number[] = [];
  let comBraco = 0, semBraco = 0;
  let topoAlto = 0, topoCurto = 0;
  for (const t of lista) {
    const vao = t.z1 - t.z0;
    /* UMA VEZ POR TRECHO, e não por lado: os obstáculos são medidos no plano da
       grade e valem para os dois flancos (tanque de um lado, ARLA do outro, e o
       envelope é o mesmo). Calcular por lado daria duas fileiras de suporte em
       z diferentes, que é o tipo de assimetria que só aparece na foto de cima. */
    const casasZ = estacoes(t, o);
    porTrecho.push(casasZ.length);
    for (const lado of [1, -1]) {
      const g = new THREE.Group();
      g.name = `${RAIZ}_${lado > 0 ? 'D' : 'E'}`;
      /* x: a face externa da barra (x = 0 no asset) vai para o plano alvo.
         y: o piso do baú (y = 0 no asset) vai para `floorY`.
         z: a ponta traseira do corrido (z = 0 no asset) vai para `t.z0`. */
      g.position.set(lado > 0 ? xAlvo : -xAlvo, yGrupo, t.z0);
      raiz.add(g);

      /* ⚠️ A BARRA NÃO COMEÇA NO DATUM DO ASSET: ela começa `BARRA_DESDE`
         (77 mm) à frente dele, e escalar em z leva esse offset junto. Com o
         grupo no `t.z0`, o corrido inteiro nascia 77·k mm ADIANTADO — 77 mm num
         trecho de 3,4 m e 195 num de 8,5. Somado ao alcance da tampa, era o que
         punha a ponta dentro da roda. Aqui o offset é descontado, e daí em
         diante `t.z0…t.z1` é literalmente onde a barra está. */
      const kz = vao / COMPRIMENTO_ORIGEM;
      for (const b of barras) {
        const geo = lado > 0 ? b.geometry : espelha(b.geometry, 'x');
        const m = new THREE.Mesh(lado > 0 ? geo.clone() : geo, material(b));
        m.name = `${b.name}_${lado > 0 ? 'D' : 'E'}`;
        /* ESTICA. As barras são extrusão pura em z: escalar é o que a peça
           real faz quando o implementador corta o perfil no comprimento. */
        m.scale.z = kz;
        m.position.z = -BARRA_DESDE * kz;
        m.castShadow = m.receiveShadow = true;
        g.add(m);
      }

      /* LADRILHA — em `InstancedMesh`, e não em malha por estação.
         Um baú de 8,4 m dá 7 estações por trecho; com 8 componentes, dois
         lados e dois trechos isso seriam 224 malhas novas A CADA RESIZE. É o
         mesmo motivo pelo qual `TrailerAssembly` instancia rebite e fita.

         Balanço limitado nas pontas e vão nunca maior que o passo — ver
         `estacoes()`, que também é quem desvia do tanque em vez de apagar o
         suporte. Um corrido pode ainda assim acabar sem suporte nenhum (todo
         ele sobre o tanque) e nesse caso a barra passa mesmo assim, que é o
         que a peça real faz. */
      /* ▶ DUAS FILEIRAS, e não uma: a estação que cresce até a barriga e a que
         fica na cota do asset porque o caminhão ocupa o corredor acima da barra
         naquele z. São dois `InstancedMesh` porque a geometria é outra — e é
         mais barato que uma malha por estação, que é o que este bloco existe
         para não fazer. */
      const mat4 = new THREE.Matrix4();
      for (const alta of [true, false]) {
        const casas = casasZ.filter((z) => (estica && cabeTopo(z, o)) === alta)
          .map((z) => z - t.z0);
        if (!casas.length) continue;
        if (lado > 0 && alta) topoAlto += casas.length;
        if (lado > 0 && !alta) topoCurto += casas.length;
        for (const e of estacaoPronta(lado, alta)) {
          const im = new THREE.InstancedMesh(e.geo, e.mat, casas.length);
          im.name = `${e.nome}_${lado > 0 ? 'D' : 'E'}${alta ? '' : '_C'}`;
          im.castShadow = im.receiveShadow = true;
          casas.forEach((dz, i) => im.setMatrixAt(i, mat4.makeTranslation(0, 0, dz)));
          im.instanceMatrix.needsUpdate = true;
          /* ⚠️ `frustumCulled = false`: a caixa de um `InstancedMesh` é a da
             geometria BASE, não a das instâncias — o three não a expande. Com o
             culling ligado, a fileira some quando a estação da origem sai de
             quadro. É o mesmo cuidado de `buildRepeats()`. */
          im.frustumCulled = false;
          g.add(im);
        }
      }

      /* ───────── A FERRAGEM, e só onde ela cabe ─────────
         O braço atravessa de |x| 374 a 1 224: onde houver tanque, caixa de
         bateria, estepe ou silencioso ele não passa, e a estação fica com
         suporte e montante só — que é o que o implementador faz. */
      if (temFerragem) {
        const casasF = casasZ.filter((z) => cabeBraco(z, o)).map((z) => z - t.z0);
        if (lado > 0) { comBraco += casasF.length; semBraco += casasZ.length - casasF.length; }
        if (casasF.length) {
          for (const f of ferragemPronta(lado)) {
            const im = new THREE.InstancedMesh(f.geo, f.mat, casasF.length);
            im.name = `${f.nome}_${lado > 0 ? 'D' : 'E'}`;
            im.castShadow = im.receiveShadow = true;
            casasF.forEach((dz, i) => im.setMatrixAt(i, mat4.makeTranslation(0, 0, dz)));
            im.instanceMatrix.needsUpdate = true;
            im.frustumCulled = false;
            g.add(im);
          }
        }
      }

      /* ───────── A TAMPA DE PONTA ─────────
         *"aqui no implemento semirreboque possui uma peça de plástico, que
         está faltando nesse"*. Ela é o fecho do perfil: sem ela o corrido
         acaba num corte cru de alumínio, que é o que a foto mostrava.

         NÃO ESCALA. A barra estica porque é extrusão pura; a tampa é uma peça
         moldada de tamanho fixo — esticá-la junto a deformaria em cada baú.
         Ela só ANDA até a ponta da barra já esticada.

         A de trás é a da frente ESPELHADA EM Z, e o espelho precisa inverter o
         sentido dos triângulos junto: sem isso a peça fica com as faces para
         dentro e some contra o `backface culling` — o mesmo cuidado que
         `espelha(…, 'x')` já toma para o outro lado do caminhão. */
      /* Com o offset descontado acima, a barra ocupa exatamente 0…vao. */
      const fimBarra = vao;
      const iniBarra = 0;
      /* ⚠️ A TAMPA NÃO USA O MATERIAL QUE O NOME DELA PEDE. No semirreboque ela
         é `plastico-preto`, e resolver por nome a deixava preta fosca no meio
         de um corrido de alumínio — *"essa parte preta deve ser metálica igual
         a grade em si"*. Ela é o FECHO do perfil e acompanha o perfil. */
      const matPonta = barras.length ? material(barras[0]) : undefined;
      for (const pt of pontas) {
        const baseX = lado > 0 ? pt.geometry : espelha(pt.geometry, 'x');
        for (const tras of [false, true]) {
          const geo = tras ? espelha(baseX, 'z') : baseX.clone();
          const m = new THREE.Mesh(geo, matPonta ?? material(pt));
          m.name = `${pt.name}_${lado > 0 ? 'D' : 'E'}_${tras ? 'T' : 'F'}`;
          m.position.z = tras ? iniBarra - PONTA_ALEM : fimBarra + PONTA_ALEM;
          m.castShadow = m.receiveShadow = true;
          g.add(m);
        }
      }
    }
  }
  raiz.updateWorldMatrix(true, true);

  const mm = (v: number) => (v * 1000).toFixed(0);
  const ferragemDiz = !ferragem.length ? '⚠ o asset não traz ferragem (v1?)'
    : !temFerragem ? `⚠ ferragem NÃO montada — alvo do braço em |x| `
      + `${alvoBracoX === undefined ? '?' : mm(alvoBracoX)} (escala `
      + `${kBraco.toFixed(2)}, aceita ${BRACO_ESCALA[0]}…${BRACO_ESCALA[1]}) · `
      + `subida ${mm(dyFerragem)} mm (aceita ${mm(FERRAGEM_SOBE[0])}…`
      + `${mm(FERRAGEM_SOBE[1])})`
      : `ferragem em ${comBraco} de ${comBraco + semBraco} estações por lado · `
        + `braço ×${kBraco.toFixed(2)} até |x| ${mm(alvoBracoX as number)} `
        + `(${o.pontaTravessa !== undefined ? 'ponta da MÃO-FRANCESA do implemento'
          : 'longarina — sem mão-francesa medida'}) · o conjunto SOBE `
        + `${mm(dyFerragem)} mm, braço em ${mm(BRACO_TOPO_ORIGEM - 0.050 + dyFerragem)}`
        + `…${mm(BRACO_TOPO_ORIGEM + dyFerragem)} mm de solo — nada estica em y`;
  /* ▶ A LINHA DA FIXAÇÃO, que é a que responde *"não está presa no
     implemento"*: quanto o suporte cresceu e até onde. */
  const fixacaoDiz = barrigaY === undefined
    ? '⚠ barriga do implemento NÃO medida — topo da estação na cota do asset '
      + `(${mm(TOPO_ESTACAO)} mm)`
    : !estica
      ? `estação no topo do asset (${mm(TOPO_ESTACAO)} mm) — barriga medida em `
        + `${mm(barrigaY)} mm, ${mm(barrigaY - TOPO_ESTACAO)} mm de diferença`
      : `grade ${mm(DESCIDA)} mm mais baixa (barras em ${mm(0.510 - DESCIDA)}…`
        + `${mm(0.610 - DESCIDA)} e ${mm(0.910 - DESCIDA)}…${mm(1.010 - DESCIDA)} de solo) · `
        + `suporte esticado ${mm(dyTopo)} mm (×${kTopo.toFixed(2)} acima da barra) — `
        + `topo ${mm(TOPO_ESTACAO)} → ${mm(alvoTopo)} mm, que é a BARRIGA do `
        + `implemento${barrigaY > alvoTopo ? ` (medida ${mm(barrigaY)}, no teto de `
          + `${mm(ESTICA_TOPO_MAX)} mm)` : ''} · ${topoAlto} de `
        + `${topoAlto + topoCurto} estações por lado encostam`;
  const quemEstica = wheelBayReach.ultimo?.culpado ?? [];
  const baias = (o.rodasZ ?? []).map((r, i) =>
    `${mm(r)}±${mm(o.rodasMeia?.[i] ?? FOLGA_RODA)} [${quemEstica[i] ?? '—'}]`).join(' · ');
  return [`proteção lateral · ${lista.length} trecho(s) `
    + `(${lista.map((t) => `${mm(t.z0)}…${mm(t.z1)}`).join(' · ')}) · `
    + `estações ${porTrecho.join('/')} (vão \u2264 ${mm(PASSO)} mm, balanço `
    + `${mm(BALANCO)} mm) · face em |x| ${mm(xAlvo)} `
    + `(pele ${mm(o.skinX)} − ${mm(RECUO_DA_PELE)}) · presa ao IMPLEMENTO`
    + ` · recuo da tampa ${mm(recuoTampa)} mm (o conjunto acaba ${mm(margemTrasUsada)} mm`
    + ' antes da parede traseira)'
    + ` · ${pontas.length ? `tampa de ponta nas 2 pontas (${pontas.length} malha(s))`
      : '⚠ SEM tampa de ponta no asset'}`,
  fixacaoDiz,
  ferragemDiz,
  `baias de roda (z ± meio-vão): ${baias || 'nenhuma'}`,
  `obstáculos no x da grade: ${(o.obstaculos ?? []).length
    ? (o.obstaculos ?? []).map((h) => `${mm(h.z0)}…${mm(h.z1)}`).join(' · ') : 'nenhum'}`
  + ` · baú ${mm(o.z0)}…${mm(o.z1)}`];
}
