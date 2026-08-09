/* Baú paramétrico — o conjunto NÃO-BRANCO.
   ---------------------------------------------------------------------------
   ARQUIVO ESPELHADO — ver nota em `trailer-geometry.ts`.

   POR QUE ESTE ARQUIVO EXISTE
   ---------------------------------------------------------------------------
   `TrailerBody` regenera só o material branco. Isso deixa de fora o teto, a
   cantoneira, o frame traseiro, os varões, as dobradiças, as lanternas e a
   faixa 3M — que são outros materiais. Ao subir a altura, o branco crescia e
   todo o resto ficava onde estava: abria um vão embaixo do teto e a ferragem
   das portas ficava amontoada no pé.

   O DESAFIO DE DESEMPENHO, E COMO ELE É RESOLVIDO
   ---------------------------------------------------------------------------
   O modelo tem 4 293 358 vértices em ~4 000 cascas. Decompor tudo em runtime
   é inviável. Mas quase toda essa massa é chassi, rodagem e parafusaria SOB O
   PISO, que não muda de jeito nenhum.

   Então a decomposição roda só na REGIÃO DO BAÚ (y > piso). Malhas cuja caixa
   inteira fica abaixo do piso são puladas sem serem tocadas — é o caso do
   grosso de `Metal-preto` (924 k v), `paralamas` (299 k) e da rodagem (992 k).

   Cinco malhas atravessam regiões com comportamentos diferentes (`parafusos`,
   `plastico-preto`, `metal-galvanizado-mantido`, `metal-estrutura-principal-
   padrao`, `borracha-preta`): elas PRECISAM ser fatiadas por casca, senão uma
   transformação de malha inteira arrasta o que devia ficar parado.

   A solda usa chave NUMÉRICA (grade de 0,5 mm empacotada em 45 bits, que cabe
   exato num double) em vez de string. Com 1,2 M de vértices, um `Map` de
   strings custaria centenas de MB. */

import * as THREE from 'three';
import { WHITE_RE } from './trailer-geometry';

/** Grade de solda, em metros. 0,5 mm: fino para separar peças, grosso o
 *  bastante para a chave caber em 45 bits num modelo de 15 m. */
const WELD = 5e-4;

/** Quão perto do teto uma casca precisa estar para ser considerada presa nele. */
const ROOF_BAND = 0.15;

/** Idem para o piso do baú. */
const FLOOR_BAND = 0.15;

/** Faixa colada às pontas em Z. */
const CAP_BAND = 0.10;

/** Faixa RÍGIDA em cada extremidade de uma peça que estica em Y.
 *  25 cm cobre folgadamente o gancho e o encaixe do varão (a haste útil dele
 *  vai de y 1,082 a 4,148) e as quinas soldadas dos perfis do frame. */
const END_CAP = 0.25;

/* --------------------------------------------------------------------------
   ARREMATE DA SAIA LATERAL — por que o piso não pode ser um corte cego
   --------------------------------------------------------------------------
   O filtro "casca inteiramente abaixo do piso → ignora" existe para pular o
   chassi, e funciona. Só que ele estava jogando fora, medido:

     · `Faixa-3M` lateral — 50 segmentos de 300 mm em y 1,335…1,385 (topo
       1,385 < piso 1,3919): a fita refletiva mora ABAIXO da chapa branca,
       na altura do friso. 25 por lado, passo 583,9 mm.
     · `lanterna-pisca-quadrado(LEDs)` — y 1,270…1,296. A MALHA INTEIRA era
       pulada antes mesmo da decomposição, porque a caixa dela toda fica sob
       o piso. 5 por lado, passo 2844,9 mm.
     · as lentes (`lente-sinaleita-traseira`) e as carcaças (`plastico-preto`)
       dessas mesmas lanternas, em y ≈ 1,283.

   Então o corte deixa de ser "abaixo do piso" e passa a ser "abaixo do piso
   E fora da saia": só entra o que está a menos de 15 cm do piso, é pequeno
   (nenhuma aresta acima de 35 cm — travessa de chassi tem 2,59 m) e fica na
   face externa. Esse material NÃO é transformado; ele existe só para poder
   entrar num conjunto repetido. */

/** Quanto abaixo do piso ainda conta como saia lateral. A peça mais baixa que
 *  precisamos é a lanterna lateral, em y 1,270 — 122 mm abaixo do piso. */
const SKIRT_BAND = 0.15;

/** Maior aresta de uma peça de arremate. O maior candidato real é o segmento
 *  de fita 3M, 300 mm; a menor peça de chassi que precisamos excluir é a
 *  travessa de 2,59 m. */
const TRIM_MAX = 0.35;

/** Malha sob o piso que ainda vale a pena decompor. Os monstros que o filtro
 *  precisa continuar pulando têm 335 k–924 k vértices; a lanterna lateral que
 *  ele precisa deixar passar tem 150. */
const HEAVY_VERTS = 50000;

/** Fração da meia-largura a partir da qual uma casca é "face externa".
 *  Medido: a face externa fica em |x| 1,28…1,33; a parafusaria de chassi que
 *  gerava conjunto falso (passo 520 mm) estava em x = 0,473. */
const OUTBOARD = 0.85;

/* --------------------------------------------------------------------------
   RABO DA TRASEIRA — a ferragem que mora ABAIXO do piso e mesmo assim anda
   --------------------------------------------------------------------------
   O corte "casca inteiramente abaixo do piso → ignora" e a exceção da saia
   lateral pressupõem que tudo que fica sob o piso é chassi, logo IMÓVEL. Medido
   no `trailer.glb`, isso varria junto o conjunto traseiro inteiro, que é
   solidário à PORTA e tem de recuar com ela:

     · `parachoque-peca1`(metal-preto, 384 v) ....... y 0,457…0,608
     · `faixa3M-parachoque-traseiro` (24 v) ......... y 0,472…0,572
     · `Material` #2 / lanterna (34 v) .............. y 1,100…1,152
     · `painel-curva-led-vermelho` (7 468 v) ........ y 1,102…1,235
     · `led-branco-e-red-sinaleira` (284 v) ......... y 1,103…1,205
     · `plastico-preto-polido` / lanterna (23 450 v)  y 1,089…1,254
     · `registro-tubo-marrom` (1 958 v) ............. y 1,147…1,267
     · `registro-corpo-laranja` (1 033 v) ........... y 1,150…1,267

   As cinco primeiras morriam no filtro de MALHA (`box.max.y <= floorY+0,02` e
   `box.max.y < floorY − 0,15`); as três últimas passavam a malha e morriam no
   filtro de CASCA. Resultado medido num baú 3,73 × 20,58 m: `dCtr = [0,0,0]`
   nas oito, com a parede traseira em z = −13,37 — o conjunto ficava boiando
   6,04 m à frente do baú. A saia lateral não salvava nenhuma: ela exige estar a
   menos de 15 cm do piso, e o para-choque está 935 mm abaixo dele.

   O que separa esse material do chassi não é a altura, é o Z: ele todo vive
   nos últimos 25 cm do veículo. Daí a faixa abaixo — e ela é estreita de
   propósito: o pneu estepe começa em z = −7,233 e continua fora. */

/** Profundidade da faixa traseira que leva ferragem presa à porta.
 *  A peça mais à frente é a tampa da lanterna, z máx −7,266 → 215 mm de z0. */
const REAR_TAIL = 0.25;

/* --------------------------------------------------------------------------
   BRAÇO ANCORADO NA TRASEIRA — o que começa na porta e avança para a frente
   --------------------------------------------------------------------------
   `CAP_BAND` (10 cm) só reconhece como traseira o que cabe inteiro nela. As
   travas laterais das portas (`Travas_laterais_portas-02`) começam em
   z = −7,517 e vão até −6,379: 1,14 m. Caíam em `span` e eram ESCALADAS —
   medido, num baú de 20,58 m: `metal-pouco-polido` crescia 437,2 mm em Z
   (1,10 → 1,54 m, +40 %) e o `engate-femea-preto` 441,0 mm, e mesmo assim
   paravam 22 cm antes da traseira nova. Peça parafusada na porta translada
   rígido, não estica: se ela ENCOSTA na traseira, é traseira inteira. */

/** Quão longe da traseira uma peça ainda pode ir sendo rígida. Medido: a maior
 *  é a trava lateral, 1,14 m; a menor peça que precisa continuar esticando é o
 *  friso lateral, que atravessa os 14,58 m. */
const REAR_REACH = 1.30;

/** Quão perto de z0 uma peça precisa começar para contar como presa na porta. */
const REAR_GRIP = 0.05;

/* --------------------------------------------------------------------------
   PERFIL DE VEDAÇÃO — o que estica pelo COMPRIMENTO e nunca pela seção
   --------------------------------------------------------------------------
   Uma borracha de porta é um perfil extrudado: a seção é constante e o que
   varia é o comprimento do corrido. O GLB, porém, entrega o corrido PARTIDO em
   cascas (a vertical da porta traseira vem em segmentos de 423 mm), e casca
   pequena cai em `follow` — que TRANSLADA o centro para a posição proporcional
   sem mudar o tamanho.

   Medido no app, entre 1,78 m e 2,88 m de altura: todas as 13 malhas de
   `borracha` mantêm a caixa EXATA (dX = dY = dZ = 0,0 mm) e só mudam de lugar.
   Para um perfil partido isso é o pior dos dois mundos: o espaçamento entre os
   segmentos cresce com `ky` e o comprimento não, então o corrido se ABRE em
   frestas — 96 mm de vão somados ao subir de 2,78 para 2,88 m, e o dobro disso
   ao descer para 1,78 m. É a "borracha estranha" que o cliente vê na portinhola
   e na porta traseira: ela não deforma, ela se PARTE.

   A correção é dar ao perfil a mesma lei da chapa que ele veda: o mapa
   proporcional aplicado ao EIXO DO CORRIDO. A chapa branca usa
   `y = floorY + (y − floorY)·ky` (`stretchY` em trailer-geometry.ts); o perfil
   passa a usar a mesma, e por isso os segmentos voltam a se encostar e a
   acompanhar a porta vértice a vértice. A seção não é tocada: só o eixo do
   corrido entra na conta.

   O teste é geométrico, como todo o resto deste arquivo: a peça tem de ser
   ESBELTA (o corrido mede pelo menos `SEAL_SLENDER` vezes cada um dos outros
   dois eixos) e de SEÇÃO PEQUENA (nenhum dos outros dois passa de
   `SEAL_SECTION`). Pelas medidas do modelo isso seleciona exatamente os
   segmentos verticais de vedação — 42,8 × 423 × 72 mm, esbeltez 5,9 — e deixa
   de fora a chapa da fechadura (163 × 423 × 7,7 mm, esbeltez 2,6), a maçaneta
   (89 × 29 × 13) e a vedação HORIZONTAL de 1 215 mm, cujo corrido não é o Y e
   que portanto continua transladando.

   Só vale para quem estava em `follow`. `stretch` (varão, poste de canto,
   montante) tem ponta rígida por `END_CAP` de propósito — é lá que estão o
   gancho e o encaixe — e não é o caso relatado. */

/** Seção máxima de um perfil de vedação, em metros. */
const SEAL_SECTION = 0.12;

/** Quantas vezes o corrido tem de ser mais longo que a seção. */
const SEAL_SLENDER = 4;

type YRule =
  /** Sobe inteiro com o teto (chapa do teto, cantoneira, trilhos). */
  | 'roof'
  /** Vai do piso ao teto — estica (poste de canto, varão, montante). */
  | 'stretch'
  /** Preso ao piso — não se mexe (friso de proteção, escada, lanterna baixa). */
  | 'floor'
  /** Solto no meio — segue a posição proporcional, sem deformar (dobradiça). */
  | 'follow';

type ZRule = 'front' | 'rear' | 'span';

/**
 * UM CONJUNTO FÍSICO que se repete — a treliça compartilhada por todas as peças
 * que compõem a mesma unidade montada.
 *
 * POR QUE ISTO PRECISA EXISTIR (medido no `trailer.glb`)
 * ---------------------------------------------------------------------------
 * Uma dobradiça de porta traseira é UMA peça montada, mas o GLB a entrega em
 * quatro cascas de tesselação diferente — e a detecção de conjuntos, que
 * agrupa por assinatura (contagem de vértices + caixa), mandava cada uma para
 * um lugar diferente. Por lado, em x ±1,151/±1,295:
 *
 *   corpo    8 888 v · 313×98×69 mm · y 2,479 3,165 3,850 → conjunto, âncora 2,479
 *   munhão     790 v ·  22×130×22 mm · y 1,794 2,479 3,165 3,850 → âncora 1,794
 *   parafuso 1 157 v ·  16×10×15 mm · y 1,734 2,419 3,105 3,790 → âncora 1,734
 *   chapinha   372 v ·  25×114×46 mm · y 2,476 3,158 3,840 → NENHUM conjunto
 *
 * 8888 + 790 + 1157 + 372 = 11 207, que é exatamente a contagem de vértices que
 * `docs/analise-ferragem.md` §5.2 atribui a UMA dobradiça. São a mesma peça.
 *
 * E o conjunto se recoloca com âncora PROPORCIONAL e passo FIXO:
 *   `y_i = floorY + (âncora − floorY)·ky + i·passo`
 * Duas âncoras diferentes ⇒ dois deslocamentos diferentes. A separação entre o
 * corpo (âncora 2,479, casa 0) e o munhão da MESMA dobradiça (âncora 1,794,
 * casa 1) é `passo · (ky − 1)`: zero em ky = 1 e **137 mm** em ky = 1,2. O
 * parafuso, que deveria ficar 60 mm abaixo do munhão, ia parar a 209 mm. E a
 * chapinha, que ficou de fora de tudo e seguia o mapa proporcional puro, subia
 * até 4,330 enquanto o corpo dela ia a 4,067 — 263 mm de separação.
 *
 * Duas outras coisas caíam junto:
 *  · a casca `1 947 v` em y 3,850 no lado −x é o munhão SOLDADO ao parafuso
 *    (790 + 1157 = 1947, e a caixa é a do munhão): a solda de 0,5 mm fundiu as
 *    duas naquela estação só. Com ela fora do grupo, o lado −x fechava treliça
 *    de 3 casas e o lado +x de 4 — e a contagem passava a crescer em alturas
 *    DIFERENTES nos dois lados do mesmo baú.
 *  · a casca `9 260 v` em y 1,794 é o corpo SOLDADO à chapinha (8888 + 372).
 *
 * A família resolve os três: uma âncora, um passo, uma contagem. Cada peça
 * guarda a CASA em que mora e o RESÍDUO dentro dela (os 60 mm do parafuso), e
 * é isso, e só isso, que a separa das irmãs em qualquer altura.
 */
interface Family {
  axis: 'y' | 'z';
  pitch: number;
  /** Centro da casa 0, em espaço de mundo, na medida de origem. */
  base: number;
  /** Casas que o modelo tem de origem. */
  slots: number;
  /** Regras herdadas — decidem como a âncora se move. */
  y: YRule;
  z: ZRule;
  /** Onde a casa 0 foi parar. Resolvido a cada `set()`. */
  at: number;
  /** PRIMEIRA casa que a medida corrente pede — pode ser NEGATIVA.
   *  A treliça é ancorada na ponta IMÓVEL (a dianteira em Z, o piso em Y) e
   *  cresce pela ponta que anda, então alongar o baú acrescenta casas ANTES da
   *  casa 0 do modelo. Resolvido a cada `set()`. Ver a nota em `set()`. */
  lo: number;
  /** Uma além da ÚLTIMA casa que a medida corrente pede. Resolvido a cada
   *  `set()`. */
  count: number;
}

/** Onde uma casca solta mora dentro da treliça de uma família. */
interface Latch {
  fam: Family;
  /** Casa que ela ocupa. */
  k: number;
  /** Deslocamento dela DENTRO da casa — é o que mantém o parafuso 60 mm
   *  abaixo do munhão em qualquer altura. */
  res: number;
}

interface Part {
  /** Índices de vértice desta casca dentro da geometria da malha. */
  idx: Int32Array;
  min: THREE.Vector3;
  max: THREE.Vector3;
  y: YRule;
  z: ZRule;
  /** Faz parte de um conjunto instanciado — a casca original é colapsada. */
  repeated?: boolean;
  /** Casca da saia lateral (sob o piso). Só serve de candidata a conjunto
   *  repetido; se não entrar em nenhum, fica intocada. */
  below?: boolean;
  /** Membro TRANSVERSAL de `span`: o centro acompanha o mapa de Z, a geometria
   *  vai RÍGIDA. É o que impede a travessa de piso de engordar 40 % junto com
   *  o comprimento. Ver `RIGID_Z_MAX`. */
  rigidZ?: boolean;
  /** Casca que não virou instância mas pertence a um conjunto físico — anda
   *  pela treliça dele, não pelo mapa proporcional. */
  latch?: Latch;
}

interface Piece {
  mesh: THREE.Mesh;
  /** Cópia das posições originais — toda transformação parte daqui, nunca da
   *  pose anterior, senão o erro acumula a cada arraste do slider. */
  base: Float32Array;
  parts: Part[];
}

/**
 * Um conjunto de peças IDÊNTICAS repetidas em passo regular — rebites do teto
 * (607 mm), faixa 3M (584 mm), lanternas laterais (2845 mm), nervuras da lona
 * (600 mm), dobradiças das portas (685 mm em Y).
 *
 * Estas não podem ser esticadas nem espalhadas proporcionalmente: um baú 3 m
 * mais longo leva MAIS rebites, com o mesmo espaçamento — não os mesmos
 * rebites mais afastados. Por isso o conjunto vira um `InstancedMesh` cuja
 * contagem é recalculada a cada medida, e as cópias originais são colapsadas.
 *
 * A detecção é por ASSINATURA (mesma malha, mesma contagem de vértices, mesma
 * caixa a 1 mm) mais regularidade de espaçamento. Não depende de nome de nó —
 * que neste arquivo mente em 7 casos.
 */
interface RepeatSet {
  axis: 'y' | 'z';
  pitch: number;
  /** Centro da primeira cópia, em espaço de mundo. */
  first: THREE.Vector3;
  /** Quantas cópias o modelo tem de origem — é o número de CASAS da treliça,
   *  não o de cascas encontradas: os rebites do teto ocupam 15 das 23. */
  count0: number;
  /** As cascas originais, que serão colapsadas para dar lugar às instâncias. */
  members: Part[];
  /** Caixa de UMA unidade, em mundo — é por ela que se decide se dois
   *  conjuntos são a mesma peça montada. */
  box: THREE.Box3;
  /** O conjunto físico a que este conjunto pertence. */
  fam: Family;
  /** Casa da família em que a primeira unidade deste conjunto mora. */
  k0: number;
  /** Deslocamento desta peça dentro da casa. */
  res: number;
  /** Casas de que ESTE conjunto se encarrega. Existe porque numa família com
   *  mais de um conjunto há casas ocupadas por casca solta (munhão soldado ao
   *  parafuso, corpo soldado à chapinha): instanciar por cima duplicaria a
   *  peça. Casas NOVAS, além de `fam.slots`, são preenchidas por todos. */
  own: Set<number>;
  mesh: THREE.InstancedMesh;
  /** Capacidade alocada no `InstancedMesh`.
   *  Sem guardar isto, o teto do `Math.min` acabava sendo `mesh.count`, que a
   *  própria rotina reescreve no fim — uma vez encolhido, o conjunto nunca
   *  mais voltava a crescer. */
  cap: number;
  /** Regras herdadas das cascas de origem, para mover o conjunto junto. */
  y: YRule;
  z: ZRule;
}

/** Uma treliça candidata, antes de virar `InstancedMesh`. */
interface Lattice {
  axis: 'y' | 'z';
  pitch: number;
  /** Estações ocupadas, em ordem; cada uma pode ter mais de uma casca. */
  stations: Part[][];
  /** Número de casas da treliça (inclui as vazias). */
  slots: number;
  /** Cascas absorvidas depois (mesma treliça, tesselação diferente). */
  extra: Part[];
}

/** Duas caixas se cruzam nos dois eixos que NÃO são o da repetição?
 *  É o teste de "mesma peça montada": as quatro cascas de uma dobradiça se
 *  sobrepõem em X e em Z e só se distinguem em Y, que é o eixo dela. A folga de
 *  60 mm cobre a diferença entre o corpo (x 0,995…1,308) e o munhão
 *  (x 1,284…1,306) sem alcançar o lado oposto do baú. */
function crossHit(aMin: THREE.Vector3, aMax: THREE.Vector3,
  bMin: THREE.Vector3, bMax: THREE.Vector3, axis: 'y' | 'z'): boolean {
  const other: ('x' | 'y' | 'z')[] = axis === 'z' ? ['x', 'y'] : ['x', 'z'];
  for (const k of other) if (aMin[k] - 0.06 > bMax[k] || bMin[k] - 0.06 > aMax[k]) return false;
  return true;
}

/** Centro da caixa de uma casca, em espaço de mundo. */
function center(p: Part): THREE.Vector3 {
  return new THREE.Vector3(
    (p.min.x + p.max.x) / 2, (p.min.y + p.max.y) / 2, (p.min.z + p.max.z) / 2);
}

/**
 * O MENOR vão que aparece pelo menos duas vezes.
 *
 * É o estimador de passo certo para treliça com buracos. A média não serve
 * (os rebites do teto dariam 954 mm, que não é passo de nada) e a moda também
 * não (dos 14 vãos deles, 8 são 1214 mm = 2 × 607 e só 6 são 607). O menor vão
 * repetido é 607 mm, que é o passo real. Exigir repetição evita adotar uma
 * folga de ponta como passo: na fita 3M o vão de 850 mm aparece uma vez só.
 */
function smallestRepeated(gaps: number[]): number {
  const s = [...gaps].sort((a, b) => a - b);
  for (const g of s) {
    let n = 0;
    for (const h of s) if (Math.abs(h - g) <= g * 0.10) n++;
    if (n >= 2) return g;
  }
  return s[0];
}

/**
 * Vão em Z, como fração do comprimento de fábrica, abaixo do qual uma casca de
 * `span` é MEMBRO TRANSVERSAL: ela acompanha o vão, mas não é esticada.
 *
 * O mapa de `span` (`z = z1 − (z1 − z)·kz`) escala POSIÇÃO e, por consequência,
 * ESPESSURA. Numa peça longa isso é o que se quer — a longarina de 14,44 m e o
 * trilho galvanizado de 14,58 m têm de crescer com o baú. Numa travessa de
 * piso de 45 mm é só engorda: medido, num baú de 20,58 m (kz = 1,4004) a
 * travessa saía com **63,0 mm** e a chapa de 8 mm com 11,2 mm — 40 % a mais de
 * aço que ninguém pediu.
 *
 * O corte sai da distribuição MEDIDA no `metal-preto` (as 117 cascas do estrado
 * que caem em `span`), que é fortemente bimodal:
 *
 *     maior vão FINO   =   208 mm  ( 1,415 % do comprimento)
 *     menor vão LONGO  = 2 430 mm  (16,536 %)
 *     razão do vale    = 11,7x  ·  79 cascas finas / 38 longas
 *
 * 6 % (882 mm na medida de fábrica) cai no meio da faixa vazia, longe das duas
 * bordas. É fração do comprimento, e não um valor em metros, para o corte
 * continuar valendo se um dia entrar um implemento de outro tamanho.
 *
 * NOTA sobre o que isto NÃO faz: as travessas deste modelo **não estão a passo
 * constante** — os vãos medidos vão de 195 a 550 mm, com desvio de até 0,45
 * casa de qualquer treliça. Por isso elas não podem virar `RepeatSet` (é
 * também por isso que `lattice()` já as recusa hoje), e a posição delas segue
 * proporcional. Ver o relatório I2 §6.
 */
const RIGID_Z_MAX = 0.06;

/** Acima disto a diferença entre dois eixos de escala é intenção, não ruído de
 *  float do exportador. 0,1 %: os nós legítimos do modelo variam ≤ 3,4 ppm. */
const SCALE_TOL = 1e-3;

/**
 * Devolve a REDONDEZA a um nó que a perdeu — correção de carga, feita uma vez.
 *
 * ATENÇÃO AO CRITÉRIO. A versão anterior desta função disparava em "a escala do
 * nó não é uniforme", e isso **estava errado**. Escala não-uniforme não é
 * defeito: é o jeito normal de um exportador dizer que a peça é mais fina num
 * eixo que nos outros. Medido nos DOIS `trailer.glb` em circulação (o do
 * desktop, 37 primitivas, e o do web, 2157):
 *
 *     geometria local do pneu   937,906 x 288,868 x 938,067
 *     escala do nó (web)          0,114871   0,119106   0,114871
 *
 * O eixo "estranho" (0,119106) multiplica **288,868 — a largura da banda de
 * rodagem**, não o diâmetro. O par que concorda multiplica os dois lados de
 * 937,9/938,1, que são o diâmetro. Ou seja: o pneu **já é redondo nos dois
 * arquivos** (0,017 % fora de círculo), e uniformizar a escala não o
 * "arredondava" — apenas estreitava a banda de 344 mm para 332 mm, 3,6 % a
 * menos, em cima de uma geometria que estava certa. O `0,0011430030` do desktop
 * é o mesmo `0,1143` do web composto com o 0,01 da raiz; os dois arquivos
 * dizem a mesma coisa.
 *
 * O teste correto não olha para a escala sozinha — ela não tem como estar
 * "errada" sem uma referência. Ele olha para o RESULTADO: dois eixos cujas
 * extensões LOCAIS são iguais descrevem geometria redonda naquele plano e
 * precisam continuar iguais depois de escalados. Se saem diferentes, aquilo é
 * ovalização de verdade e é o que se corrige — igualando **só esse par**. Um
 * eixo cuja extensão local já é diferente das outras não carrega promessa de
 * redondeza nenhuma e fica intocado.
 *
 * Consequência prática, e é o ponto: nos dois bakes atuais esta função não
 * encosta em nada (devolve 0). Ela não pode "aplicar duas vezes" nem estragar
 * um arquivo já correto, porque a condição de disparo é uma propriedade
 * MEDIDA do resultado, e depois de corrigida ela deixa de valer.
 *
 * Roda ANTES de qualquer medição — o resto desta classe mede em espaço de
 * mundo, e medir a pose errada seria propagá-la.
 */
export function roundOutScales(root: THREE.Object3D): number {
  root.updateWorldMatrix(true, true);

  /** Extensão da geometria do nó (e só dela) em cada eixo LOCAL. */
  const localExtent = (o: THREE.Object3D): [number, number, number] | null => {
    const m = o as THREE.Mesh;
    let g = m.isMesh ? m.geometry : null;
    /* Nó de transformação puro: a geometria mora nos filhos, que estão em
       escala 1 — é o layout do bake do web (`_gltfNode_N` → `*_pneu-corpo_0`). */
    if (!g) {
      for (const c of o.children) {
        const cm = c as THREE.Mesh;
        const uniformChild = Math.abs(c.scale.x - 1) < SCALE_TOL
          && Math.abs(c.scale.y - 1) < SCALE_TOL && Math.abs(c.scale.z - 1) < SCALE_TOL;
        if (cm.isMesh && cm.geometry && uniformChild) { g = cm.geometry; break; }
      }
    }
    if (!g) return null;
    if (!g.boundingBox) g.computeBoundingBox();
    const b = g.boundingBox;
    if (!b) return null;
    return [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
  };

  const targets: THREE.Object3D[] = [];
  const wanted = new Map<THREE.Object3D, [number, number, number]>();
  root.traverse((o) => {
    const s = o.scale;
    const a: [number, number, number] = [Math.abs(s.x), Math.abs(s.y), Math.abs(s.z)];
    const mx = Math.max(...a);
    if (!(mx > 0) || (mx - Math.min(...a)) / mx <= SCALE_TOL) return;
    const L = localExtent(o);
    if (!L) return;                       // sem geometria não há o que ficar oval
    /* Só pares cujo LADO LOCAL é igual prometem redondeza. Se o produto
       `escala x lado` desses dois já bate, a peça está redonda e nada aqui tem
       o que fazer — é o caso dos catorze pneus nos dois arquivos. */
    const out = a.slice() as [number, number, number];
    let oval = false;
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      const li = L[i], lj = L[j];
      if (!(li > 0 && lj > 0) || Math.abs(li - lj) / Math.max(li, lj) > SCALE_TOL) continue;
      const si = a[i] * li, sj = a[j] * lj;
      if (Math.abs(si - sj) / Math.max(si, sj) <= SCALE_TOL) continue;
      /* Ovalização confirmada. O valor de consenso é o do MENOR dos dois: a
         ovalização deste rip é sempre um eixo ESTUFADO, e encolher devolve a
         silhueta sem empurrar a peça contra a vizinha. */
      const k = Math.min(a[i], a[j]);
      out[i] = k; out[j] = k;
      oval = true;
    }
    if (!oval) return;
    targets.push(o);
    wanted.set(o, out);
  });

  const box = new THREE.Box3();
  const pivot = new THREE.Vector3();
  const local = new THREE.Vector3();
  const after = new THREE.Vector3();
  let fixed = 0;

  for (const o of targets) {
    const s = o.scale;
    const target = wanted.get(o);
    if (!target) continue;

    /* O pivô é o centro da caixa DO NÓ, em mundo — nos pneus é o eixo da roda.
       Escalar em torno da origem do nó (que nos pneus fica 2,1 m acima da
       geometria) jogaria a roda inteira para cima. */
    box.setFromObject(o);
    if (box.isEmpty()) continue;
    box.getCenter(pivot);
    o.worldToLocal(local.copy(pivot));

    o.scale.set(
      Math.sign(s.x || 1) * target[0],
      Math.sign(s.y || 1) * target[1],
      Math.sign(s.z || 1) * target[2],
    );
    o.updateMatrixWorld(true);

    /* De volta ao lugar. A diferença é medida no espaço do PAI, que é onde
       `position` mora — assim a compensação continua correta se o nó estiver
       pendurado numa hierarquia com rotação. */
    o.localToWorld(after.copy(local));
    const parent = o.parent;
    if (parent) {
      o.position.add(parent.worldToLocal(pivot.clone()).sub(parent.worldToLocal(after)));
    } else {
      o.position.add(pivot.clone().sub(after));
    }
    o.updateMatrixWorld(true);
    fixed++;
  }

  if (fixed) root.updateWorldMatrix(true, true);
  return fixed;
}

export interface AssemblyRefs {
  floorY: number;
  roofY: number;
  z0: number;
  z1: number;
  baseHeight: number;
  baseLength: number;
}

export class TrailerAssembly {
  private pieces: Piece[] = [];
  private repeats: RepeatSet[] = [];
  private families: Family[] = [];
  /** Maior |x| medido nas cascas — a face externa do conjunto.
   *  Sai das cascas, não de `Box3.setFromObject`: a caixa de um nó girado
   *  (o estepe deitado) é transformada pelos cantos e dá 1,99 m, o que
   *  desqualificaria toda a lataria. Pelas cascas dá 1,335 m. */
  private outerX = 0;
  /** Diagnóstico. */
  readonly stats = { meshes: 0, skipped: 0, parts: 0, verts: 0, repeats: 0, rounded: 0 };

  constructor(root: THREE.Object3D, private ref: AssemblyRefs) {
    const { floorY, z0 } = ref;
    /* PRIMEIRO de tudo: os pneus vêm ovalizados do rip. Ver `roundOutScales`. */
    this.stats.rounded = roundOutScales(root);
    root.updateWorldMatrix(true, true);

    const box = new THREE.Box3();
    const meshes: THREE.Mesh[] = [];
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      /* O branco é do `TrailerBody`; tocar nele aqui duplicaria a deformação. */
      if (mats.some((m) => WHITE_RE.test(m.name))) return;
      meshes.push(mesh);
    });

    for (const mesh of meshes) {
      this.stats.meshes++;
      box.setFromObject(mesh);

      const geo = mesh.geometry as THREE.BufferGeometry;
      const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
      if (!pos) { this.stats.skipped++; continue; }

      /* Sob o piso: chassi, rodagem, para-lamas — é aqui que os 3,3 milhões de
         vértices pesados são evitados. Mas o corte não pode ser cego: a
         lanterna lateral (150 vértices, y 1,270…1,296) fica inteira sob o piso
         e mesmo assim precisa repetir a cada 2844,9 mm. Então só some quem
         está longe do piso OU é pesado demais para valer a decomposição.

         E o corte tem uma segunda exceção além da saia: o RABO DA TRASEIRA.
         Cinco malhas do conjunto de lanternas e do para-choque (34 a 7 468
         vértices, y 0,457…1,235) ficam inteiras sob o piso e mesmo assim têm
         de recuar com a porta — sem isto elas ficavam paradas a 6,04 m da
         traseira nova. Elas se distinguem do chassi pelo Z, não pela altura. */
      const rearTail = box.max.z <= z0 + REAR_TAIL && pos.count <= HEAVY_VERTS;
      if (!rearTail && box.max.y <= floorY + 0.02
        && (box.max.y < floorY - SKIRT_BAND || pos.count > HEAVY_VERTS)) {
        this.stats.skipped++; continue;
      }

      /* Copia posição por posição pela API do atributo, NUNCA por `pos.array`.
         Os atributos deste GLB são INTERLEAVED: `pos.array` é o buffer inteiro
         (posição + normal + UV), então indexá-lo como se fosse só posição lê
         lixo. O sintoma medido foi `base.length/3` dar 4× a contagem real de
         vértices — e num caso um `n` FRACIONÁRIO (12909,33), que não existe. */
      const base = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        base[i * 3] = pos.getX(i);
        base[i * 3 + 1] = pos.getY(i);
        base[i * 3 + 2] = pos.getZ(i);
      }
      const parts = this.decompose(mesh, geo, base);
      if (!parts.length) { this.stats.skipped++; continue; }

      this.stats.parts += parts.length;
      this.stats.verts += pos.count;
      this.pieces.push({ mesh, base, parts });
    }

    this.buildRepeats(root);
    this.buildSkirtRepeats(root);
    this.lowerRivets(root);
    this.bindFamilies();
    this.stats.repeats = this.repeats.length;
  }

  /* --------------------------------------------------- conjuntos repetidos */

  /**
   * Acha as peças que se repetem em passo regular e as troca por instâncias.
   *
   * O QUE A VERSÃO ANTERIOR ERRAVA (medido no `trailer.glb`)
   * -------------------------------------------------------------------------
   * Ela só achava 2 conjuntos. Os cinco que faltavam falhavam por motivos
   * DIFERENTES, e cada um deles motivou uma mudança aqui:
   *
   * 1. REBITES DO TETO (607,0 mm). A premissa de que cada estação é um "par de
   *    anéis a 21 mm" estava errada: com solda de 0,5 mm cada estação é UMA
   *    casca só, uma cinta de 2530 × 25 × 21 mm atravessando o teto. Pior, das
   *    23 estações só 15 são a cinta inteira (48 vért.); as outras 8 vêm
   *    partidas ao meio pela tesselação em duas metades de 1265 mm (24 vért.
   *    cada) em x ±0,633. Resultado: o grupo de 15 tinha vãos 607/1214/1214 e
   *    reprovava em qualquer teste de "vão ≈ média" (média 954 mm).
   *    → A regularidade passou a ser TRELIÇA COM BURACOS, não progressão
   *      aritmética: passo = menor vão que se repete (607), e exige-se que
   *      cada estação caia em `primeira + k · passo`. As 15 caem em
   *      k = 0,1,3,5,6,8,10,11,13,15,16,17,18,20,22 → 23 casas, 65 % ocupadas.
   *    → E as 16 metades são ABSORVIDAS depois (mesma treliça, mesma altura,
   *      mesma profundidade) e colapsam junto.
   *
   * 2. FAIXA 3M (583,9 mm) e 3. LANTERNAS LATERAIS (2844,9 mm): não chegavam
   *    nem a ser candidatas — ficam abaixo do piso. Ver `SKIRT_BAND`.
   *
   * 4. LANTERNAS INTERNAS (2430 mm): são 6, mas ESCALONADAS — 3 em x = −1,213
   *    e 3 em x = +1,213, alternando. Cada fileira tem só 3 membros e o mínimo
   *    era 4. → mínimo 3, e o passo que sai é 4860 mm por fileira, que é o
   *    passo físico certo: quem repete é o PAR escalonado.
   *
   * 5. NERVURAS DA LONA FRIA (600,0 mm): não é falha de detecção. A lona é
   *    UMA casca conexa de 10 074 vértices e 13 m; os 23 anéis medidos em Z
   *    (vãos 198 | 600 ×19 | 402 | 1000 mm) estão dentro dela. Instanciar
   *    exigiria cortar triângulos e emendar tile a tile, e ela é forro
   *    INTERNO de teto. Fica esticando em Z (600 → 600·kz). Ver
   *    `docs/analise-rebites.md`.
   *
   * A assinatura continua sendo (contagem de vértices, caixa a 1 mm) — o que
   * saiu foi a chave de fileira embutida na string, que quebrava em qualquer
   * fronteira de bucket. As fileiras agora são achadas por proximidade.
   */
  private buildRepeats(root: THREE.Object3D) {
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const outX = this.outerX * OUTBOARD;

    for (const piece of this.pieces) {
      /* Peça da saia lateral só concorre se estiver na face externa. Sem isto,
         a parafusaria de chassi em x = 0,473 formava um conjunto falso de
         passo 520 mm bem no meio do assoalho. */
      const cand = piece.parts.filter(
        (p) => !p.below || Math.abs((p.min.x + p.max.x) / 2) >= outX);
      if (cand.length < 3) continue;

      const bySig = new Map<string, Part[]>();
      for (const p of cand) {
        const r = (v: number) => Math.round(v * 1000);
        const sig = `${p.idx.length}|${r(p.max.x - p.min.x)}|${r(p.max.y - p.min.y)}|${r(p.max.z - p.min.z)}`;
        let g = bySig.get(sig);
        if (!g) { g = []; bySig.set(sig, g); }
        g.push(p);
      }

      /* Uma casca só pode entrar num conjunto. Z primeiro: é o eixo em que o
         baú realmente cresce, e a repetição em Y (dobradiças) é secundária. */
      const claimed = new Set<Part>();
      const found: Lattice[] = [];
      for (const axis of ['z', 'y'] as const) {
        for (const group of bySig.values()) {
          const free = group.filter((p) => !claimed.has(p));
          if (free.length < 3) continue;
          /* FILEIRAS por proximidade nos DOIS eixos que não repetem.
             Os rebites do teto correm em linhas paralelas em X e as lanternas
             internas em duas alturas de X; misturar as linhas espalha os
             centros e mata a detecção. */
          for (const line of this.rows(free, axis)) {
            if (line.length < 3) continue;
            const lat = this.lattice(line, axis);
            if (!lat) continue;
            for (const st of lat.stations) for (const p of st) claimed.add(p);
            found.push(lat);
          }
        }
      }

      /* ABSORÇÃO — a mesma peça fatiada de outro jeito.
         As 8 estações partidas dos rebites do teto têm outra assinatura (24
         vért., 1265 mm de largura) mas a MESMA altura (25 mm), a MESMA
         profundidade (21 mm), o mesmo centro em Y (4,174) e caem na mesma
         treliça de 607 mm. Juntas cobrem exatamente o mesmo x que a cinta
         inteira, então trocá-las pela cinta é invisível — e é a única forma de
         não sobrar meia-cinta esticando ao lado do rebite instanciado. */
      for (const lat of found) {
        const a = lat.axis;
        const ref = lat.stations[0][0];
        const dAxis = ref.max[a] - ref.min[a];
        const dY = ref.max.y - ref.min.y;
        const cY = (ref.min.y + ref.max.y) / 2;
        const at0 = (ref.min[a] + ref.max[a]) / 2;
        const tol = Math.max(0.003, lat.pitch * 0.06);
        for (const p of cand) {
          if (claimed.has(p)) continue;
          if (Math.abs((p.max[a] - p.min[a]) - dAxis) > 0.005) continue;
          if (Math.abs((p.max.y - p.min.y) - dY) > 0.005) continue;
          if (Math.abs((p.min.y + p.max.y) / 2 - cY) > 0.05) continue;
          if (p.min.x < ref.min.x - 0.005 || p.max.x > ref.max.x + 0.005) continue;
          const d = (p.min[a] + p.max[a]) / 2 - at0;
          const k = Math.round(d / lat.pitch);
          if (k < 0 || k >= lat.slots) continue;
          if (Math.abs(d - k * lat.pitch) > tol) continue;
          claimed.add(p);
          lat.extra.push(p);
        }
      }

      for (const lat of found) {
        const first = center(lat.stations[0][0]);
        const template = this.templateOf(piece, lat.stations[0], first);
        if (!template) continue;

        const mat = piece.mesh.material as THREE.Material;
        /* Folga de 3× para o baú poder crescer sem realocar o buffer. */
        const cap = Math.max(8, lat.slots * 3);
        const im = new THREE.InstancedMesh(template, mat, cap);
        im.name = `REPEAT_${lat.axis}_${lat.slots}`;
        im.castShadow = im.receiveShadow = true;
        im.frustumCulled = false;
        /* A geometria do molde está em MUNDO; desfaz a matriz de `root` para
           o conjunto poder pendurar no modelo sem transformar duas vezes. */
        im.matrixAutoUpdate = false;
        im.matrix.copy(inv);
        root.add(im);

        const all = [...lat.stations.flat(), ...lat.extra];
        const head = lat.stations[0][0];
        this.enroll({
          axis: lat.axis, pitch: lat.pitch, first, count0: lat.slots,
          members: all, mesh: im, cap, y: head.y, z: head.z,
          box: new THREE.Box3(head.min.clone(), head.max.clone()),
        });
        for (const p of all) p.repeated = true;
      }
    }
  }

  /**
   * O ARREMATE DA SAIA, procurado NA MONTAGEM INTEIRA e não malha a malha.
   *
   * POR QUE ISTO PRECISOU EXISTIR (medido no app, no bake corrente)
   * -------------------------------------------------------------------------
   * `buildRepeats()` procura conjuntos DENTRO de cada malha: `for (const piece
   * of this.pieces)`, e desiste em `cand.length < 3`. Isso valia quando a fita
   * 3M lateral era uma malha só. No bake atual (2 157 primitivas) ela vem
   * repartida em **64 nós**, um ou dois segmentos em cada — nenhuma malha chega
   * a três candidatas, nenhuma treliça se forma, e todos os segmentos continuam
   * sendo `below`, que `set()` deixa EXATAMENTE onde estavam.
   *
   * O estrago, medido no implemento vivo contra a traseira do friso de
   * proteção (`metal-galvanizado-polido`, que escala com o comprimento):
   *
   *     comprimento    traseira do friso    traseira da fita    sobra
   *     14,695 m           −7,424               −7,477            53 mm
   *     12,500 m           −5,238               −7,407         2 169 mm
   *     10,000 m           −2,747               −7,407         4 660 mm
   *
   * Ou seja: encurtar o baú deixava 4,7 m de fita refletiva pendurada no ar,
   * atrás do frame metálico. É o relato, literal — "as faixas refletivas de
   * baixo quando mudo o tamanho continua indo fora do frame metálico".
   *
   * A correção não é um caso especial para fita: é reconhecer que a UNIDADE de
   * repetição pode estar espalhada por vários nós. A piscina aqui é GLOBAL, e o
   * que a mantém segura é ser a mesma peneira de sempre, só que aplicada duas
   * vezes: entram apenas cascas de saia (`below` — a menos de 15 cm do piso,
   * nenhuma aresta acima de 35 cm) que estejam na FACE EXTERNA, e a assinatura
   * ganha o MATERIAL, porque duas peças de materiais diferentes não podem
   * dividir um `InstancedMesh`.
   *
   * O molde sai de UMA malha (`templateOf` lê o buffer de uma `Piece`), então
   * uma estação repartida entre nós contribui só com a parte que mora na malha
   * da cabeça — o que sobra continua sendo colapsado como membro.
   */
  private buildSkirtRepeats(root: THREE.Object3D) {
    const outX = this.outerX * OUTBOARD;
    const owner = new Map<Part, Piece>();
    const pool: Part[] = [];
    for (const piece of this.pieces) {
      for (const p of piece.parts) {
        if (p.repeated || !p.below) continue;
        if (Math.abs((p.min.x + p.max.x) / 2) < outX) continue;
        owner.set(p, piece);
        pool.push(p);
      }
    }
    if (pool.length < 3) return;

    const bySig = new Map<string, Part[]>();
    for (const p of pool) {
      const piece = owner.get(p) as Piece;
      const mat = piece.mesh.material as THREE.Material;
      const r = (v: number) => Math.round(v * 1000);
      const sig = `${(mat && mat.name) || '?'}|${p.idx.length}`
        + `|${r(p.max.x - p.min.x)}|${r(p.max.y - p.min.y)}|${r(p.max.z - p.min.z)}`;
      let g = bySig.get(sig);
      if (!g) { g = []; bySig.set(sig, g); }
      g.push(p);
    }

    const claimed = new Set<Part>();
    const found: Lattice[] = [];
    for (const group of bySig.values()) {
      const free = group.filter((p) => !claimed.has(p));
      if (free.length < 3) continue;
      /* Só em Z: a saia é uma fileira ao longo do baú, e é em Z que ele cresce. */
      for (const line of this.rows(free, 'z')) {
        if (line.length < 3) continue;
        const lat = this.lattice(line, 'z');
        if (!lat) continue;
        for (const st of lat.stations) for (const p of st) claimed.add(p);
        found.push(lat);
      }
    }

    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    for (const lat of found) {
      const head = lat.stations[0];
      const piece = owner.get(head[0]);
      if (!piece) continue;
      const first = center(head[0]);
      const template = this.templateOf(piece, head.filter((p) => owner.get(p) === piece), first);
      if (!template) continue;

      const cap = Math.max(8, lat.slots * 3);
      const im = new THREE.InstancedMesh(template, piece.mesh.material as THREE.Material, cap);
      im.name = `REPEAT_skirt_${lat.slots}`;
      im.castShadow = im.receiveShadow = true;
      im.frustumCulled = false;
      im.matrixAutoUpdate = false;
      im.matrix.copy(inv);
      root.add(im);

      const all = [...lat.stations.flat(), ...lat.extra];
      const h0 = head[0];
      /* UMA FILEIRA QUE ATRAVESSA O BAÚ É `span`, e isso tem de ser dito aqui.
         A cabeça da treliça é a casca mais TRASEIRA (é assim que `lattice()`
         ordena), e a casca mais traseira costuma cair em `rear` pela regra de
         `decompose()`. Herdar `rear` faria a fileira INTEIRA transladar em
         bloco com a porta, sem nunca ganhar ou perder uma casa — de novo fita
         fora do frame, só que pelo outro motivo. Quem cobre mais da metade do
         baú é vão, não ferragem de porta. */
      const spans = lat.slots * lat.pitch > this.ref.baseLength * 0.5;
      this.enroll({
        axis: 'z', pitch: lat.pitch, first, count0: lat.slots,
        members: all, mesh: im, cap,
        y: h0.y, z: spans ? 'span' : h0.z,
        box: new THREE.Box3(h0.min.clone(), h0.max.clone()),
      });
      for (const p of all) p.repeated = true;
    }
  }

  /**
   * Separa um grupo de mesma forma em FILEIRAS, agrupando por proximidade nos
   * dois eixos que não são o da repetição.
   *
   * Antes isso era um bucket de 5 cm embutido na assinatura. O problema é a
   * fronteira: duas peças da mesma fileira em y 1,349 e 1,351 caíam em buckets
   * diferentes e o conjunto se partia. Por proximidade não existe fronteira.
   * A tolerância de 80 mm é maior que qualquer desalinhamento medido dentro de
   * uma fileira (o pior é 4 mm, na fita 3M) e menor que a menor distância
   * entre fileiras (315 mm, colunas da 3M na traseira).
   */
  private rows(parts: Part[], axis: 'y' | 'z'): Part[][] {
    const other: ('x' | 'y' | 'z')[] = axis === 'z' ? ['x', 'y'] : ['x', 'z'];
    const lines: { a: number; b: number; m: Part[] }[] = [];
    for (const p of parts) {
      const a = (p.min[other[0]] + p.max[other[0]]) / 2;
      const b = (p.min[other[1]] + p.max[other[1]]) / 2;
      let hit = lines.find((l) => Math.abs(l.a - a) < 0.08 && Math.abs(l.b - b) < 0.08);
      if (!hit) { hit = { a, b, m: [] }; lines.push(hit); }
      hit.m.push(p);
    }
    return lines.map((l) => l.m);
  }

  /**
   * Ajusta uma TRELIÇA (passo fixo, casas podendo estar vazias) a uma fileira.
   *
   * Por que treliça e não progressão aritmética: os rebites do teto ocupam 15
   * das 23 casas e a fita 3M começa com um vão de 850 mm (peça de ponta) antes
   * de entrar no passo de 583,9 mm. Testar "todo vão ≈ média" reprova os dois.
   */
  private lattice(members: Part[], axis: 'y' | 'z'): Lattice | null {
    const at = (p: Part) => (p.min[axis] + p.max[axis]) / 2;
    const sorted = [...members].sort((a, b) => at(a) - at(b));

    /* Estações: peças a menos de 35 % do passo umas das outras são a mesma
       unidade que se repete (e entram juntas no molde). */
    const raw: number[] = [];
    for (let i = 1; i < sorted.length; i++) raw.push(at(sorted[i]) - at(sorted[i - 1]));
    if (!raw.length) return null;
    const near = 0.35 * smallestRepeated(raw);
    const stations: Part[][] = [];
    let cur: Part[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      if (at(sorted[i]) - at(sorted[i - 1]) > near) { stations.push(cur); cur = []; }
      cur.push(sorted[i]);
    }
    stations.push(cur);
    if (stations.length < 3) return null;

    const pos = stations.map((s) => at(s[0]));
    const gaps: number[] = [];
    for (let i = 1; i < pos.length; i++) gaps.push(pos[i] - pos[i - 1]);
    let pitch = smallestRepeated(gaps);
    /* Nada abaixo de 10 cm: é ruído de tesselação, não peça repetida. */
    if (pitch < 0.10) return null;
    const tol = Math.max(0.003, pitch * 0.06);

    /* Âncora: a primeira peça pode estar FORA da treliça (a 3M começa com a
       peça de canto, 850 mm antes da primeira do passo). Testa todas e fica
       com a fase que encaixa mais estações. */
    let fit: number[] = [];
    for (let a = 0; a < pos.length; a++) {
      const keep: number[] = [];
      for (let i = 0; i < pos.length; i++) {
        const k = Math.round((pos[i] - pos[a]) / pitch);
        if (Math.abs(pos[i] - pos[a] - k * pitch) <= tol) keep.push(i);
      }
      if (keep.length > fit.length) fit = keep;
    }
    if (fit.length < 3) return null;
    /* Se um terço das estações não cabe na treliça, não é uma treliça. */
    if (fit.length < pos.length * 0.7) return null;

    const base = pos[fit[0]];
    const ks = fit.map((i) => Math.round((pos[i] - base) / pitch));
    for (let i = 1; i < ks.length; i++) if (ks[i] <= ks[i - 1]) return null;
    /* Refina o passo por mínimos quadrados sobre as casas ocupadas — com 22
       casas, 0,1 mm de erro por vão viraria 2 mm no fim. */
    let sk = 0, skk = 0;
    for (let i = 0; i < ks.length; i++) { sk += ks[i] * (pos[fit[i]] - base); skk += ks[i] * ks[i]; }
    if (skk > 0) pitch = sk / skk;

    const slots = ks[ks.length - 1] + 1;
    if (slots < 3) return null;
    /* Metade das casas vazias já não é padrão, é coincidência. */
    if (fit.length / slots < 0.5) return null;
    /* Conjunto curto não vale instanciar e é onde mora o falso positivo. */
    if ((slots - 1) * pitch < 1.0) return null;
    /* A unidade tem de ser MENOR que o passo dela. Isso descarta perfil longo
       fatiado em segmentos encostados, que não é repetição e sim extrusão. */
    const head = stations[fit[0]][0];
    if ((head.max[axis] - head.min[axis]) * 1.2 > pitch) return null;

    return { axis, pitch, stations: fit.map((i) => stations[i]), slots, extra: [] };
  }

  /* ----------------------------------------- rebites da ferragem inferior */

  /**
   * REQUISITO DO CLIENTE: "a ferragem inferior lateral também deve ter rebites
   * como a ferragem de cima, e devem estar alinhados com um corte que há na
   * ferragem inferior."
   *
   * O QUE FOI MEDIDO (offline, `trailer.glb`, solda de 0,5 mm)
   * -------------------------------------------------------------------------
   * A ferragem inferior lateral é o trilho galvanizado
   * (`metal-galvanizado-mantido`): x 1,2806…1,3066 · y 1,3094…1,5194 ·
   * z −7,4072…+7,1728, extrusão pura de 14,58 m.
   *
   * O corte aparece em `inox-ferragem/parafusos`: 56 cascas idênticas de
   * 13 × 94 × 13 mm em x = ±1,210, y 1,4401…1,5341 — 28 por lado. Elas vêm
   * SEMPRE aos pares, as duas bordas do mesmo corte:
   *
   *   z(+x) = −7,442 · (−6,512 −6,440) · (−5,510 −5,438) · (−4,508 −4,436) ·
   *           (−3,506 −3,434) · (−2,504 −2,432) · (−1,502 −1,430) ·
   *           (−0,500 −0,428) · (0,502 0,574) · (1,504 1,576) · (2,506 2,578) ·
   *           (3,508 3,580) · (4,510 4,582) · (5,512 5,584) · 6,514
   *   vãos  = 930 72 930 72 930 72 … (28 valores, sem uma exceção)
   *
   * → LARGURA DO CORTE = 72,0 mm.
   * → PASSO DO CORTE = 930 + 72 = **1002,0 mm**. Conferido pelas pontas:
   *   de −6,512 a +6,514 são 13,026 m = 13 × 1002,0 mm, exato.
   * → 13 cortes por lado, o primeiro com centro em z = −6,476.
   * → Altura do corte: centro em y = 1,487 (faixa 1,4401…1,5341).
   *
   * As duas cascas soltas (−7,442 e +6,514) não têm par: são o arremate das
   * pontas, não um corte. Por isso o pareamento exige as DUAS bordas.
   *
   * O MOLDE reaproveitado é o rebite do teto: 43 cascas de 6 × 6 × 12 mm em
   * y 4,0454…4,0514, todas em z = −7,405 (a fileira do friso de teto traseiro,
   * espaçadas 60/60/54 mm em X). Ele é rodado 90° em Y porque o eixo de 12 mm
   * dele aponta em Z (rebite cravado na face traseira) e aqui precisa apontar
   * para fora da lateral, em ±X.
   */
  private lowerRivets(root: THREE.Object3D) {
    const { floorY, roofY, z0, baseLength } = this.ref;

    /* 1. As bordas do corte, pela assinatura medida de 13 × 94 × 13 mm. */
    const near = (a: number, b: number, t: number) => Math.abs(a - b) <= t;
    const edges: Part[] = [];
    for (const piece of this.pieces) {
      for (const p of piece.parts) {
        if (!near(p.max.x - p.min.x, 0.013, 0.003)) continue;
        if (!near(p.max.y - p.min.y, 0.094, 0.006)) continue;
        if (!near(p.max.z - p.min.z, 0.013, 0.003)) continue;
        const dy = (p.min.y + p.max.y) / 2 - floorY;
        /* Faixa medida: o centro delas fica de 48 a 142 mm acima do piso. */
        if (dy < 0.02 || dy > 0.20) continue;
        edges.push(p);
      }
    }
    if (edges.length < 6) return;

    /* 2. Pareia as bordas: corte = duas bordas a 72,0 mm uma da outra. */
    const cuts: { x: number; y: number; z: number }[] = [];
    for (const side of [1, -1]) {
      const row = edges
        .filter((p) => Math.sign((p.min.x + p.max.x) / 2) === side)
        .map((p) => center(p))
        .sort((a, b) => a.z - b.z);
      for (let i = 1; i < row.length; i++) {
        const gap = row[i].z - row[i - 1].z;
        if (gap < 0.060 || gap > 0.085) continue;
        cuts.push({ x: side, y: (row[i].y + row[i - 1].y) / 2, z: (row[i].z + row[i - 1].z) / 2 });
        i++;
      }
    }

    /* 3. A face externa da ferragem inferior: a peça longa (mais de 80 % do
       comprimento) que corre rente ao piso. Medida: x = ±1,3066. */
    let faceX = 0;
    for (const piece of this.pieces) {
      for (const p of piece.parts) {
        if (p.max.z - p.min.z < baseLength * 0.8) continue;
        const dy = (p.min.y + p.max.y) / 2 - floorY;
        if (dy < -0.10 || dy > 0.20) continue;
        faceX = Math.max(faceX, Math.abs(p.min.x), Math.abs(p.max.x));
      }
    }
    if (faceX <= 0) return;

    /* 4. O molde: um rebite da fileira do teto. */
    let mold: { piece: Piece; part: Part } | null = null;
    for (const piece of this.pieces) {
      for (const p of piece.parts) {
        if (p.max.x - p.min.x > 0.015 || p.max.y - p.min.y > 0.015) continue;
        const d = p.max.z - p.min.z;
        if (d < 0.010 || d > 0.014) continue;
        if ((p.min.y + p.max.y) / 2 < roofY - ROOF_BAND) continue;
        if ((p.min.z + p.max.z) / 2 > z0 + 0.15) continue;
        if (!mold || p.idx.length > mold.part.idx.length) mold = { piece, part: p };
      }
    }
    if (!mold) return;

    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const mat = mold.piece.mesh.material as THREE.Material;

    for (const side of [1, -1]) {
      const mine = cuts.filter((c) => c.x === side).sort((a, b) => a.z - b.z);
      if (mine.length < 3) return;
      const gaps: number[] = [];
      for (let i = 1; i < mine.length; i++) gaps.push(mine[i].z - mine[i - 1].z);
      const pitch = smallestRepeated(gaps);
      if (pitch < 0.5) return;

      const geo = this.templateOf(mold.piece, [mold.part], center(mold.part));
      if (!geo) return;
      /* Cabeça do rebite aponta em −Z no molde; girando −90° em Y ela vai para
         +X, que é para onde a lateral direita olha (e +90° para a esquerda). */
      geo.applyMatrix4(new THREE.Matrix4().makeRotationY(side > 0 ? -Math.PI / 2 : Math.PI / 2));

      const count0 = Math.round((mine[mine.length - 1].z - mine[0].z) / pitch) + 1;
      const cap = Math.max(8, count0 * 3);
      const im = new THREE.InstancedMesh(geo, mat, cap);
      im.name = `RIVET_LOW_${side > 0 ? 'R' : 'L'}`;
      im.castShadow = im.receiveShadow = true;
      im.frustumCulled = false;
      im.matrixAutoUpdate = false;
      im.matrix.copy(inv);
      root.add(im);

      const y = mine.reduce((s, c) => s + c.y, 0) / mine.length;
      const first = new THREE.Vector3(side * faceX, y, mine[0].z);
      this.enroll({
        axis: 'z', pitch, first,
        count0, members: [], mesh: im, cap,
        box: new THREE.Box3(first.clone().addScalar(-0.02), first.clone().addScalar(0.02)),
        /* A ferragem inferior é presa ao piso: não sobe quando a altura muda,
           e acompanha o comprimento como qualquer peça que atravessa o baú. */
        y: 'floor', z: 'span',
      });
    }
  }

  /* ------------------------------------------------- conjuntos FÍSICOS */

  /**
   * Registra um conjunto repetido, por ora com uma família só dele.
   * `bindFamilies` depois junta os que forem a mesma peça montada.
   */
  private enroll(r: Omit<RepeatSet, 'fam' | 'k0' | 'res' | 'own'>) {
    const a = r.axis;
    const own = new Set<number>();
    for (const p of r.members) {
      own.add(Math.round(((p.min[a] + p.max[a]) / 2 - r.first[a]) / r.pitch));
    }
    /* Sem membros (os rebites da ferragem inferior são sintetizados, não
       achados) a treliça é cheia por definição. */
    if (!own.size) for (let i = 0; i < r.count0; i++) own.add(i);

    const fam: Family = {
      axis: a, pitch: r.pitch, base: r.first[a], slots: r.count0,
      y: r.y, z: r.z, at: r.first[a], lo: 0, count: r.count0,
    };
    this.repeats.push({ ...r, fam, k0: 0, res: 0, own });
    this.families.push(fam);
  }

  /**
   * Funde numa só família os conjuntos que são a MESMA peça montada, e prende
   * a ela as cascas que sobraram sem conjunto. Ver o comentário de `Family`.
   *
   * O critério é geométrico, nunca por nome: mesmo eixo, mesmo passo a 3 %,
   * mesmas regras de Y e Z, e caixas que se cruzam nos dois eixos que não
   * repetem. Pelos números do modelo isso funde exatamente o que deve —
   * as 3 peças da dobradiça de cada lado, os 4 nós de cada lanterna lateral e
   * os 2 de cada lanterna interna — e deixa separados os dois lados do baú,
   * que não se cruzam em X.
   */
  private bindFamilies() {
    const groups: { sets: RepeatSet[]; min: THREE.Vector3; max: THREE.Vector3 }[] = [];
    for (const r of this.repeats) {
      const g = groups.find((q) => {
        const h = q.sets[0];
        return h.axis === r.axis && h.y === r.y && h.z === r.z
          && Math.abs(h.pitch - r.pitch) <= Math.max(h.pitch, r.pitch) * 0.03
          && crossHit(q.min, q.max, r.box.min, r.box.max, r.axis);
      });
      if (!g) groups.push({ sets: [r], min: r.box.min.clone(), max: r.box.max.clone() });
      else { g.sets.push(r); g.min.min(r.box.min); g.max.max(r.box.max); }
    }

    this.families = [];
    for (const g of groups) {
      const a = g.sets[0].axis;
      /* Passo do conjunto com mais casas: é o que tem menos erro por vão. */
      const lead = g.sets.reduce((b, r) => (r.count0 > b.count0 ? r : b), g.sets[0]);
      let base = Infinity;
      for (const r of g.sets) base = Math.min(base, r.first[a]);

      const fam: Family = {
        axis: a, pitch: lead.pitch, base, slots: 0,
        y: g.sets[0].y, z: g.sets[0].z, at: base, lo: 0, count: 1,
      };
      for (const r of g.sets) {
        const d = r.first[a] - base;
        const k0 = Math.round(d / fam.pitch);
        const own = new Set<number>();
        for (const j of r.own) own.add(j + k0);
        r.fam = fam; r.k0 = k0; r.res = d - k0 * fam.pitch; r.own = own;
        fam.slots = Math.max(fam.slots, k0 + r.count0);
      }

      const loose = a === 'y' ? this.latchLoose(fam, g.min, g.max) : 0;
      /* Conjunto sozinho e sem casca solta: comportamento de sempre — ele
         preenche TODAS as casas, inclusive as vazias (os rebites do teto
         ocupam 15 das 23 e as outras 8 são dele). Onde há mais de uma peça na
         família, cada conjunto fica só com as casas que já eram dele: instanciar
         por cima de uma casca solta duplicaria a peça. */
      if (g.sets.length === 1 && loose === 0) {
        const own = new Set<number>();
        for (let j = 0; j < fam.slots; j++) own.add(j);
        g.sets[0].own = own;
      }
      this.families.push(fam);
    }
  }

  /**
   * Prende à família as cascas que ficaram sem conjunto mas moram na treliça
   * dele — a chapinha de 372 v que perdeu o grupo porque uma das três tem 373
   * vértices, e as duas cascas em que a solda de 0,5 mm fundiu peças vizinhas.
   *
   * Exige que a casa já esteja ocupada pelo conjunto. Sem isso, qualquer peça
   * que por acaso caísse no passo seria arrastada por ele.
   */
  private latchLoose(fam: Family, cmin: THREE.Vector3, cmax: THREE.Vector3): number {
    const busy = new Set<number>();
    for (const r of this.repeats) if (r.fam === fam) for (const j of r.own) busy.add(j);

    let n = 0;
    for (const piece of this.pieces) {
      for (const p of piece.parts) {
        if (p.repeated || p.below || p.latch) continue;
        if (p.y !== fam.y || p.z !== fam.z) continue;
        /* Peça maior que o passo não é uma unidade da treliça, é um perfil. */
        if (p.max.y - p.min.y >= fam.pitch) continue;
        if (!crossHit(cmin, cmax, p.min, p.max, 'y')) continue;
        const c = (p.min.y + p.max.y) / 2;
        const k = Math.round((c - fam.base) / fam.pitch);
        if (!busy.has(k)) continue;
        const res = c - fam.base - k * fam.pitch;
        if (Math.abs(res) > fam.pitch * 0.30) continue;
        p.latch = { fam, k, res };
        n++;
      }
    }
    return n;
  }

  /**
   * Extrai o molde de UMA ESTAÇÃO: triângulos em mundo, centrados nela.
   *
   * Recebe uma lista de cascas, não uma só, porque a unidade que se repete
   * pode ter mais de uma peça — o par de rebites do teto é o caso.
   *
   * A UV VIAJA JUNTO, e o motivo é o defeito que ela consertou.
   * ---------------------------------------------------------------------------
   * Este molde carregava só POSIÇÃO e NORMAL. Para um rebite de `inox-ferragem`
   * — cor chapada, sem mapa nenhum — isso basta e foi por isso que passou. Mas
   * o mesmo molde serve a `Faixa-3M`, e esse material é textura PURA: o fator
   * de cor-base dele é [1,1,1,1] e TODO o desenho refletivo mora no
   * `baseColorTexture` (1024², mais um `normalMap` de 1024²). Uma geometria sem
   * `uv` não deixa de amostrar a textura — ela amostra o mesmo texel (0,0) em
   * cada vértice. O resultado é a fita inteira pintada de uma cor só, fosca e
   * sem relevo: exatamente "as faixas ficam acinzentadas, opacas".
   *
   * E o defeito só aparecia AO MEXER NA MEDIDA porque o `InstancedMesh` nasce
   * com `instanceMatrix` zerada (todas as instâncias degeneradas, invisíveis) e
   * `TrailerAssembly` não roda `set()` no construtor: até o primeiro resize
   * quem estava na tela era a casca ORIGINAL, com a UV dela. O primeiro `set()`
   * colapsa as originais e entrega a cena às instâncias — e é aí que a fita
   * troca de aparência.
   *
   * Pelo bake atual isto vale para 76 primitivas de `Faixa-3M` e mais
   * `lanterna-pisca-quadrado(LEDs)`, `metal-galvanizado-mantido`, `borracha` e
   * `borracha-preta` — todo material instanciado que tenha mapa.
   *
   * `uv1` entra pelo mesmo motivo: é a TEXCOORD_1 que `livery.ts` usa nos
   * painéis recortados. Nenhuma das duas precisa de transformação — coordenada
   * de textura não é posição.
   *
   * A TANGENTE NÃO viaja, e é decisão. Ela é vec4 com handedness no `w`, e num
   * nó espelhado (7 deles aqui) o `w` teria de ser negado junto com a troca de
   * enrolamento abaixo. Sem o atributo, três monta o frame por derivada de tela,
   * que é o caminho padrão de qualquer malha sem TANGENT — e não há vizinho com
   * quem destoar, porque a casca original é colapsada.
   */
  private templateOf(piece: Piece, parts: Part[], center: THREE.Vector3): THREE.BufferGeometry | null {
    const geo = piece.mesh.geometry as THREE.BufferGeometry;
    const index = geo.getIndex();
    const nrmAttr = geo.getAttribute('normal') as THREE.BufferAttribute | undefined;
    if (!index) return null;

    /* Lidas pela API do atributo, nunca por `.array`: os atributos deste GLB são
       INTERLEAVED — a mesma armadilha anotada no construtor. */
    const uvAttr = geo.getAttribute('uv') as THREE.BufferAttribute | undefined;
    const uv1Attr = geo.getAttribute('uv1') as THREE.BufferAttribute | undefined;

    const want = new Set<number>();
    for (const part of parts) for (const i of part.idx) want.add(i);

    const m4 = piece.mesh.matrixWorld;
    const m3 = new THREE.Matrix3().getNormalMatrix(m4);
    const v = new THREE.Vector3();
    const pos: number[] = [], nrm: number[] = [], uv: number[] = [], uv1: number[] = [];

    /* NÓ ESPELHADO: 7 nós do modelo têm `scale.x` negativa (as lanternas
       traseiras 002, o painel de LED do triângulo, a lanterna lateral 002 e a
       fixação do forro). Determinante negativo inverte a ORDEM DE ENROLAMENTO,
       e aqui a matriz de mundo é ASSADA dentro do molde — a instância nasce com
       matriz de determinante positivo, então o renderer não tem mais como
       compensar (para uma malha comum ele inverte `frontFace` sozinho).
       Trocar dois vértices de cada triângulo devolve o enrolamento correto.
       Sem isto, o molde só não aparece pelo avesso porque os 35 materiais deste
       GLB são `doubleSided` — uma máscara, não uma correção: no dia em que
       alguém puser `side = FrontSide` (o branco já põe, em trailer-geometry.ts)
       as lanternas laterais instanciadas somem. */
    const mirrored = m4.determinant() < 0;

    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
      if (!want.has(a) || !want.has(b) || !want.has(c)) continue;
      for (const k of (mirrored ? [a, c, b] : [a, b, c])) {
        v.set(piece.base[k * 3], piece.base[k * 3 + 1], piece.base[k * 3 + 2]).applyMatrix4(m4);
        pos.push(v.x - center.x, v.y - center.y, v.z - center.z);
        if (nrmAttr) {
          v.set(nrmAttr.getX(k), nrmAttr.getY(k), nrmAttr.getZ(k)).applyMatrix3(m3).normalize();
          nrm.push(v.x, v.y, v.z);
        } else nrm.push(0, 1, 0);
        if (uvAttr) uv.push(uvAttr.getX(k), uvAttr.getY(k));
        if (uv1Attr) uv1.push(uv1Attr.getX(k), uv1Attr.getY(k));
      }
    }
    if (!pos.length) return null;

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    if (uv.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    if (uv1.length) g.setAttribute('uv1', new THREE.Float32BufferAttribute(uv1, 2));
    return g;
  }

  /**
   * Separa uma malha em cascas conexas e dá a cada uma o seu comportamento.
   *
   * A união é feita por VÉRTICE (não por triângulo): é o que permite usar uma
   * chave numérica e um único passe sobre o índice.
   */
  private decompose(mesh: THREE.Mesh, geo: THREE.BufferGeometry, base: Float32Array): Part[] {
    const n = base.length / 3;
    const index = geo.getIndex();
    if (!index) return [];

    /* Solda: grade de 0,5 mm, chave empacotada em 3×15 bits.
       A quantização é RELATIVA à caixa da própria malha, não absoluta.
       Uma chave absoluta (`round(v/WELD) + 16384`) estoura: no espaço de
       mundo deste app o baú fica em y≈7..10, e 10/0,0005 = 20 000, que somado
       ao offset passa de 32 767 e transborda para o campo vizinho. O efeito
       medido foi colisão em massa — `paralamas` virava UMA casca de 7,7 m e
       entrava na regra de esticar. Relativo ao mínimo da malha, o maior eixo
       (15 m de comprimento) dá 30 000 passos e cabe nos 15 bits. */
    let bx = Infinity, by = Infinity, bz = Infinity;
    for (let i = 0; i < n; i++) {
      if (base[i * 3] < bx) bx = base[i * 3];
      if (base[i * 3 + 1] < by) by = base[i * 3 + 1];
      if (base[i * 3 + 2] < bz) bz = base[i * 3 + 2];
    }
    /* A malha está em espaço LOCAL (cm, escala 0,01), então a grade de solda
       precisa ser convertida para as unidades dela. */
    const sc = new THREE.Vector3().setFromMatrixScale(mesh.matrixWorld);
    const gx = WELD / Math.max(1e-6, Math.abs(sc.x));
    const gy = WELD / Math.max(1e-6, Math.abs(sc.y));
    const gz = WELD / Math.max(1e-6, Math.abs(sc.z));

    const weld = new Map<number, number>();
    const rep = new Int32Array(n);
    let overflow = false;
    for (let i = 0; i < n; i++) {
      const qx = Math.round((base[i * 3] - bx) / gx);
      const qy = Math.round((base[i * 3 + 1] - by) / gy);
      const qz = Math.round((base[i * 3 + 2] - bz) / gz);
      if (qx > 32767 || qy > 32767 || qz > 32767) { overflow = true; break; }
      const k = qx * 1073741824 + qy * 32768 + qz;
      const prev = weld.get(k);
      if (prev === undefined) { weld.set(k, i); rep[i] = i; }
      else rep[i] = prev;
    }
    /* Se a malha for grande demais para a grade, não há solda confiável — e
       soldar errado é pior que não soldar, porque funde peças distantes numa
       casca só. Sem solda, cada ilha do índice ainda vira sua própria casca. */
    if (overflow) for (let i = 0; i < n; i++) rep[i] = i;

    const parent = new Int32Array(n);
    for (let i = 0; i < n; i++) parent[i] = rep[i];
    const find = (a: number): number => {
      while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; }
      return a;
    };
    const union = (a: number, b: number) => {
      const ra = find(a), rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    };
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
      union(a, b); union(a, c);
    }

    /* Agrupa índices por raiz. */
    const groups = new Map<number, number[]>();
    for (let i = 0; i < n; i++) {
      const r = find(i);
      let g = groups.get(r);
      if (!g) { g = []; groups.set(r, g); }
      g.push(i);
    }

    const m4 = mesh.matrixWorld;
    const v = new THREE.Vector3();
    const parts: Part[] = [];
    const { floorY, roofY, z0, z1 } = this.ref;

    for (const g of groups.values()) {
      const min = new THREE.Vector3(Infinity, Infinity, Infinity);
      const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
      for (const i of g) {
        v.set(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]).applyMatrix4(m4);
        min.min(v); max.max(v);
      }
      /* Casca sob o piso: em regra fica de fora, e com ela some a parafusaria
         de chassi, que é quase metade do nó `parafusos`. A exceção é o
         arremate da saia lateral — fita 3M em y 1,335…1,385 e lanternas
         laterais em y ≈ 1,283 — que entra só como CANDIDATO a conjunto
         repetido (`below`), nunca como peça transformável. */
      let below = false;
      if (max.y <= floorY + 0.02 && max.z > z0 + REAR_TAIL) {
        /* O `max.z` acima é o rabo da traseira: o registro de ar (y 1,147…
           1,267), a tampa da lanterna (1,089…1,254) e o para-choque (0,457…
           0,608) morrem aqui se o corte olhar só a altura, e ficam parados no
           meio do baú. Eles sobrevivem à malha e morriam na casca. */
        if (min.y < floorY - SKIRT_BAND) continue;
        if (max.x - min.x > TRIM_MAX || max.y - min.y > TRIM_MAX || max.z - min.z > TRIM_MAX) continue;
        below = true;
      }
      if (max.x > this.outerX) this.outerX = max.x;
      if (-min.x > this.outerX) this.outerX = -min.x;

      /* A regra é a ALTURA DA PEÇA, não "encosta nas duas faixas".
         Os varões medem 2,55 m mas começam 19 cm acima do piso — erravam a
         faixa de 15 cm por 4 cm e caíam em `roof`, transladando em vez de
         esticar. Quem ocupa mais de 60 % da altura do baú é membro vertical
         (varão, poste de canto, montante do frame, borracha de vedação) e
         cresce com ele; o resto se ancora no piso ou no teto. */
      const tall = (max.y - min.y) >= this.ref.baseHeight * 0.60;
      const touchesRoof = max.y >= roofY - ROOF_BAND;
      const touchesFloor = min.y <= floorY + FLOOR_BAND;

      let y: YRule;
      if (tall) y = 'stretch';
      else if (touchesRoof) y = 'roof';
      else if (touchesFloor) y = 'floor';
      else y = 'follow';

      /* Traseira é quem MORA no rabo (25 cm) ou quem ENCOSTA nele e avança
         pouco (a trava lateral da porta vai 1,14 m para a frente). Com só a
         faixa de 10 cm, a mangueira de ar (z −7,400…−7,350) e as travas
         caíam em `span` e eram esticadas: medido, +19,7 mm na mangueira e
         +437 mm na trava, que ainda parava 22 cm antes da traseira nova. */
      let z: ZRule;
      if (min.z > z1 - CAP_BAND) z = 'front';
      else if (max.z <= z0 + REAR_TAIL) z = 'rear';
      else if (min.z <= z0 + REAR_GRIP && max.z <= z0 + REAR_REACH) z = 'rear';
      else z = 'span';

      /* MEMBRO TRANSVERSAL: acompanha o vão, mas NÃO engorda.
         Ver a nota de `RIGID_Z_MAX`. A regra é o VÃO EM Z da casca, medido, e
         não o material nem o nome do nó — é isso que separa a travessa de
         piso (45 mm) da longarina (2,4 a 14,4 m) sem arrastar junto os trilhos
         galvanizados, que medem 14,58 m e têm de escalar. */
      const rigidZ = z === 'span'
        && (max.z - min.z) <= this.ref.baseLength * RIGID_Z_MAX;

      parts.push({ idx: Int32Array.from(g), min, max, y, z, below, rigidZ });
    }
    return parts;
  }

  /**
   * Aplica as medidas correntes.
   *
   * Trabalha em espaço LOCAL de cada malha, mas decide em espaço de mundo: as
   * regras são geométricas ("encosta no teto?") e só fazem sentido no
   * referencial do veículo. Como as malhas do baú não têm rotação, a conversão
   * é a escala/translação da própria matriz — extraída uma vez por peça.
   */
  set(height: number, length: number) {
    const { floorY, roofY, z0, z1, baseHeight, baseLength } = this.ref;
    const ky = height / baseHeight;
    const kz = length / baseLength;
    const dRoof = (floorY + (roofY - floorY) * ky) - roofY;
    const zBack = z1 - length;
    const dzRear = zBack - z0;

    /* Cada CONJUNTO FÍSICO resolve a âncora e a contagem uma vez só, e todas as
       peças dele — instanciadas ou soltas — leem daqui. É isto que impede o
       parafuso de andar diferente da dobradiça que ele prende: antes, cada
       peça tinha a sua própria âncora e o desencontro era `passo · (ky − 1)`,
       137 mm num baú 20 % mais alto.

       PASSO FIXO, MARGENS FIXAS, CONTAGEM VARIÁVEL.
       A âncora NÃO escala. Escalar a âncora e manter o passo — que era o que
       esta rotina fazia — move as DUAS pontas da treliça: a fábrica não desloca
       o primeiro rebite porque o baú ficou mais longo, ela só põe mais rebites.
       Media-se o estrago: num baú de 14,70 → 20,58 m o vão dianteiro das
       lanternas laterais abria 240 mm e o da fita 3M 70 mm.

       O datum é a ponta IMÓVEL de cada eixo:
       · em Z, a dianteira (`z1`), que carrega o pino-rei e não anda. Logo a
         casa mais dianteira fica EXATAMENTE onde estava e as casas novas
         entram atrás, em `lo` negativo, até a parede traseira nova.
       · em Y, o piso (`floorY`), que também não anda. A casa de baixo fica
         onde está e as novas entram em cima.

       A margem da ponta que ANDA é a única que sobra, e ela fica entre a
       margem de fábrica e a margem de fábrica + um passo — é o resto da
       divisão, e é inevitável com passo fixo e medida contínua. Nunca fica
       MENOR que a de fábrica, que é o que importa: a peça não encosta na
       parede nova. */
    for (const fam of this.families) {
      let at = fam.base;
      let lo = 0;
      let count = fam.slots;

      if (fam.axis === 'z') {
        if (fam.z === 'rear') {
          /* Conjunto presolidário à traseira: anda inteiro com ela, sem mudar
             de contagem — é um bloco, não uma treliça aberta. */
          at += dzRear;
        } else if (fam.z === 'span') {
          /* `z0 - zBack` é o alongamento (positivo quando o baú cresce), e
             `dzRear = zBack - z0` é o seu negativo. Cada passo inteiro ganho
             vale uma casa nova atrás. */
          lo = -Math.floor((z0 - zBack) / fam.pitch + 1e-9);
        }
      } else if (fam.y === 'roof') {
        at += dRoof;
      } else if (fam.y === 'stretch' || fam.y === 'follow') {
        /* Piso é o datum: a casa 0 fica na altura de fábrica e as novas sobem.
           Antes a âncora era escalada por `ky` e a dobradiça de baixo subia
           junto com o teto, deixando um vão no pé da porta. */
        count = fam.slots + Math.floor((height - baseHeight) / fam.pitch + 1e-9);
      }

      fam.at = at;
      fam.lo = lo;
      fam.count = Math.max(lo + 1, count);
    }

    const w = new THREE.Vector3();
    const inv = new THREE.Matrix4();

    for (const piece of this.pieces) {
      const geo = piece.mesh.geometry as THREE.BufferGeometry;
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      const m4 = piece.mesh.matrixWorld;
      inv.copy(m4).invert();

      for (const part of piece.parts) {
        /* Membro de conjunto instanciado: a casca original some, colapsada
           num ponto só. Triângulo de área zero não gera fragmento, então ela
           desaparece sem custo de render e sem precisar reconstruir o índice. */
        if (part.repeated) {
          const p0 = part.idx[0];
          const x0 = piece.base[p0 * 3], y0 = piece.base[p0 * 3 + 1], z0c = piece.base[p0 * 3 + 2];
          for (const i of part.idx) pos.setXYZ(i, x0, y0, z0c);
          continue;
        }

        /* Casca da saia lateral que não virou conjunto.
           A regra ANTIGA era "fica exatamente onde está", com o argumento de
           que a saia é solidária ao chassi. Isso vale para o que está SOB o
           assoalho, no meio do veículo — e não vale para o arremate da FACE
           EXTERNA, que é lataria: fita refletiva e lanterna lateral são presas
           na saia do baú e andam com ele. Medido, encurtando 14,695 → 10,0 m:
           4 660 mm de fita ficavam para trás da traseira do friso.
           `buildSkirtRepeats()` normalmente as instancia com passo fixo; esta
           é a rede de segurança para a fileira que não fechar treliça, e ela é
           RÍGIDA — o centro acompanha o vão, a peça não engorda. Melhor um
           passo que estica que uma fita fora do frame. */
        if (part.below) {
          if (Math.abs((part.min.x + part.max.x) / 2) < this.outerX * OUTBOARD) continue;
          const cz = (part.min.z + part.max.z) / 2;
          const dz = part.z === 'rear' ? dzRear : (z1 - (z1 - cz) * kz) - cz;
          for (const i of part.idx) {
            w.set(piece.base[i * 3], piece.base[i * 3 + 1], piece.base[i * 3 + 2]).applyMatrix4(m4);
            w.z += dz;
            w.applyMatrix4(inv);
            pos.setXYZ(i, w.x, w.y, w.z);
          }
          continue;
        }

        /* Deslocamento em Y da peça, decidido pela regra dela. */
        let dy = 0, stretch = false;
        if (part.latch) {
          /* Casca solta de um conjunto físico: anda pela treliça dele, com o
             resíduo que a separa das irmãs — são os 60 mm entre o parafuso e o
             munhão da dobradiça, que têm de sobreviver a qualquer altura. */
          const L = part.latch;
          dy = L.fam.at + L.k * L.fam.pitch + L.res - (part.min.y + part.max.y) / 2;
        } else if (part.y === 'roof') dy = dRoof;
        else if (part.y === 'floor') dy = 0;
        else if (part.y === 'stretch') stretch = true;
        else {
          const cy = (part.min.y + part.max.y) / 2;
          dy = (floorY + (cy - floorY) * ky) - cy;
        }

        /* PERFIL DE VEDAÇÃO: estica pelo CORRIDO, nunca pela seção.
           Ver o bloco de `SEAL_SECTION`. Um corrido partido em segmentos que
           só transladam abre fresta entre eles a cada mudança de altura; com o
           mapa proporcional aplicado ao Y os segmentos voltam a se encostar e a
           acompanhar a chapa da porta, que usa exatamente esta lei. A seção
           (X e Z) não entra na conta e por isso não muda. */
        const sx = part.max.x - part.min.x;
        const sy = part.max.y - part.min.y;
        const sz = part.max.z - part.min.z;
        const seal = part.y === 'follow'
          && sy >= SEAL_SLENDER * Math.max(sx, sz)
          && Math.max(sx, sz) <= SEAL_SECTION;

        /* CRESCE PELO CENTRO.
           Esticar a peça inteira deformaria as PONTAS — e é lá que estão o
           gancho e o encaixe do varão, e as quinas soldadas dos perfis do
           frame. Então cada extremidade fica RÍGIDA numa faixa de `END_CAP` e
           toda a elongação é absorvida pelo miolo. É também o que preserva o
           espaçamento visual entre presilhas: elas são cascas próprias e só
           acompanham a posição, sem deformar. */
        const lo = part.min.y, hi = part.max.y;
        const cap = Math.min(END_CAP, (hi - lo) * 0.4);
        const a = lo + cap, b = hi - cap;
        const mid = b - a;

        /* MEMBRO TRANSVERSAL: o CENTRO anda pelo mapa de `span` e a casca vai
           inteira atrás, rígida. Aplicar o mapa vértice a vértice — que é o que
           `span` faz — engordaria a peça na mesma razão do comprimento. Ver
           `RIGID_Z_MAX`. */
        let dzRigid = 0;
        if (part.rigidZ) {
          const cz = (part.min.z + part.max.z) / 2;
          dzRigid = (z1 - (z1 - cz) * kz) - cz;
        }

        for (const i of part.idx) {
          w.set(piece.base[i * 3], piece.base[i * 3 + 1], piece.base[i * 3 + 2]).applyMatrix4(m4);

          if (stretch) {
            /* Topo acompanha o teto; base fica onde está; miolo distribui. */
            if (w.y <= a) { /* ponta de baixo: rígida */ }
            else if (w.y >= b) w.y += dRoof;
            else if (mid > 1e-6) w.y += dRoof * ((w.y - a) / mid);
          } else if (seal) {
            w.y = floorY + (w.y - floorY) * ky;
          } else {
            w.y += dy;
          }

          /* Z: a dianteira fica parada porque carrega o pino-rei. */
          if (part.z === 'rear') w.z += dzRear;
          else if (part.rigidZ) w.z += dzRigid;
          else if (part.z === 'span') w.z = z1 - (z1 - w.z) * kz;

          w.applyMatrix4(inv);
          pos.setXYZ(i, w.x, w.y, w.z);
        }
      }

      pos.needsUpdate = true;
      geo.computeBoundingBox();
      geo.computeBoundingSphere();
    }

    /* Conjuntos repetidos: o PASSO fica, a CONTAGEM muda.
       É a diferença entre "mais rebites" e "os mesmos rebites mais afastados",
       e é o comportamento físico — a fábrica não espaça rebite para caber. */
    const m = new THREE.Matrix4();
    for (const r of this.repeats) {
      const fam = r.fam;

      /* O eixo que NÃO repete continua indo pela regra do próprio conjunto. */
      const f = r.first.clone();
      if (r.z === 'rear') f.z += dzRear;
      else if (r.z === 'span') f.z = z1 - (z1 - f.z) * kz;
      if (r.y === 'roof') f.y += dRoof;
      else if (r.y === 'stretch' || r.y === 'follow') f.y = floorY + (f.y - floorY) * ky;

      /* O teto é a CAPACIDADE alocada, não `mesh.count` — que a linha lá
         embaixo reescreve. Com `mesh.count` o conjunto encolhia uma vez e
         nunca mais voltava a crescer ao arrastar o slider de volta. */
      let n = 0;
      for (let j = fam.lo; j < fam.count && n < r.cap; j++) {
        /* Casa velha que não é deste conjunto pertence a outra peça da família
           (ou a uma casca solta) — instanciar aqui duplicaria. Casa NOVA, além
           das que o modelo trazia — tanto acima de `slots` quanto ABAIXO de 0,
           que é por onde o baú alongado cresce —, é preenchida por todo mundo:
           uma porta mais alta ganha a dobradiça inteira, corpo, munhão e
           parafuso juntos. O laço começa em `fam.lo` e não em `r.k0` porque as
           casas negativas são novas para todos; as casas de 0 a `k0` que não
           são deste conjunto já caem fora por `own`. */
        if (j >= 0 && j < fam.slots && !r.own.has(j)) continue;
        const at = fam.at + j * fam.pitch + r.res;
        m.makeTranslation(
          f.x,
          fam.axis === 'y' ? at : f.y,
          fam.axis === 'z' ? at : f.z,
        );
        r.mesh.setMatrixAt(n++, m);
      }
      r.mesh.count = n;
      r.mesh.instanceMatrix.needsUpdate = true;
      r.mesh.computeBoundingSphere();
    }
  }

  /** Devolve o conjunto à pose de origem. */
  reset() { this.set(this.ref.baseHeight, this.ref.baseLength); }
}
