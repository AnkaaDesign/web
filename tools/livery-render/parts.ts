/* AS PEÇAS DO LIVERY, uma a uma — a tabela que substitui o recorte por região.
   ---------------------------------------------------------------------------
   POR QUE ESTE ARQUIVO EXISTE

   A primeira bancada recortava o painel por REGIÃO: `band-top` era "tudo que
   estiver na faixa de cima", `post-rear` era "tudo que estiver no canto". O
   resultado é um GRUPO — cantoneira, fita, ferragem e borracha achatadas numa
   imagem só. Um grupo não pode ser reposicionado nem redimensionado sozinho, e
   foi exatamente isso que quebrou o desenho: alongar o baú esticava o montante
   inteiro, com a fita e os parafusos dentro dele.

   Aqui cada linha é UMA peça física, isolada por MATERIAL e por JANELA, com a
   regra que só ela obedece. A cantoneira estica; a fita ladrilha e nunca
   deforma; o rebite ladrilha noutro passo; o friso de proteção estica mas tem
   altura fixa. Eram regras diferentes dentro do mesmo pixel, e por isso não
   havia como acertar as duas.

   ---------------------------------------------------------------------------
   TODO NÚMERO AQUI FOI MEDIDO NO `trailer.glb`

   Nada é estimado e nada é copiado de desenho técnico. As medidas saíram da
   varredura das caixas dos acessores de POSITION com as matrizes de nó
   aplicadas — o mesmo método de `trailer-geometry.ts`. Estão em METROS e no
   referencial do MUNDO; a conversão para o referencial do painel acontece em
   `paneprobe.ts`, contra a pele branca daquela face.

   ---------------------------------------------------------------------------
   O REFERENCIAL DE CADA FACE É A CHAPA RECORTADA, NÃO A "PELE FINA"

   Quem define o datum é `addLiveryUV()`: ele normaliza sobre a caixa do painel
   que `buildLiveryPanels()` recorta — e o recorte leva TODO triângulo branco
   do slab de 40 mm, inclusive a parede que continua subindo por trás da
   cantoneira até o teto. Medido pelo recorte REPLICADO em `paneprobe.ts`:

     lateral   y 1,3919 … 4,1688   2 777,0 mm  ×  14 655,9 mm
     traseira  y 1,5917 … 4,1688   2 577,1 mm  ×   2 589,6 mm
     testeira  y 1,4119 … 4,1688   2 756,9 mm  ×   2 589,6 mm

   Houve uma rodada que mediu a "pele branca fina" (caixas de malha, topo em
   4,0464) e ancorou tudo nela: cada peça presa ao teto saiu 122 mm ACIMA do
   baú. O layout que sempre esteve certo (cantoneira y 0,2075 = o
   CANTONEIRA_DROP de livery-layers.ts) usava o datum do painel — é ele. */

/** Como a peça se comporta quando o baú muda de tamanho. */
export type Behaviour =
  /** Corre a face inteira e ESTICA no eixo dela; a espessura não muda.
   *  Fotografada por uma FATIA do meio — o perfil é uniforme ao longo da
   *  corrida, e a fatia mantém px/m em vez de esticar um recorte. SÓ serve
   *  para perfil uniforme: numa face com ferragem discreta (a traseira), a
   *  fatia do meio inventaria o baú inteiro com o que houver no meio. */
  | 'run'
  /** Repete num passo medido; a unidade NUNCA deforma. */
  | 'tile'
  /** Presa a uma ponta, largura fixa, altura acompanhando o painel. */
  | 'corner'
  /** Faixa horizontal fotografada INTEIRA, altura fixa, largura acompanhando o
   *  painel. É o comportamento das faces de largura FIXA POR NORMA (traseira e
   *  testeira, 2,60 m): o conteúdo é discreto (travas, dobradiças, lanternas),
   *  então nem fatia nem ladrilho — a faixa inteira, 1:1 para sempre. */
  | 'band'
  /** O miolo: fotografado inteiro, estica nos DOIS eixos. Na traseira a
   *  largura é fixa, então na prática só a altura estica — é o que faz os
   *  varões crescerem com o baú e as guias se redistribuírem em proporção. */
  | 'sheet';

export interface PartSpec {
  /** Identidade semântica — é ela que aparece no manifesto e no editor. */
  id: string;
  /** Como o editor deve tratá-la. */
  how: Behaviour;
  /** O que a isola. Peça de comportamento MISTO é duas peças; peça de canto ou
   *  de faixa é um GRUPO RÍGIDO e o filtro pode ser largo — quem recorta é a
   *  JANELA, e o grupo inteiro obedece uma regra só. */
  material: RegExp;
  /** Faixa vertical em MUNDO, medida. */
  y0: number; y1: number;
  /** Presa ao piso ou ao teto do painel. Em `sheet`, ignorada (estica). */
  anchor: 'floor' | 'roof';
  /** `tile`: passo em metros, medido entre centros de unidades vizinhas. */
  pitch?: number;
  /** `tile`: largura desenhada de uma unidade. Menor que o passo = há vão. */
  unit?: number;
  /** `tile`: coordenada u EM MUNDO do centro de uma unidade REAL — a FASE da
   *  treliça. Sem ela a bancada fotografa o meio do painel (que pode cair no
   *  vão) e o editor ladrilha a partir da borda, até um passo inteiro fora do
   *  lugar do bake. Com ela, a foto enquadra a unidade e o manifesto publica
   *  `phase` (distância da ponta DIANTEIRA ao centro da unidade mais próxima,
   *  módulo do passo) — a mesma âncora dianteira do 3D. */
  at?: number;
  /** `corner`: de qual ponta EM U (u0 = menor coordenada do mundo), e a
   *  largura. A conversão para a âncora do PAINEL (que é espelhada entre as
   *  faces) é de `paneprobe.anchorXFor()`, não daqui. */
  side?: 'start' | 'end';
  width?: number;
  /** `sheet`: recuo da janela a partir de cada ponta, em metros — o espaço
   *  dos montantes, que são peças próprias. */
  inset0?: number; inset1?: number;
  /** Profundidade do slab, para fora e para dentro da pele, em metros. */
  out?: number; in?: number;
  /** Nota que vai para o manifesto — o que a peça É, em português. */
  nota: string;
}

/* ------------------------------------------------------------- LATERAIS
   Medidas de `Lataria_externa_esquerda` e do que corre sobre ela. A face é
   simétrica, então a mesma tabela serve aos dois lados; o que muda é o sinal
   do eixo, resolvido em `paneprobe.ts`. */
export const SIDE_PARTS: PartSpec[] = [
  {
    id: 'rail-bottom', how: 'run', material: /metal-galvanizado-mantido/i,
    y0: 1.3094, y1: 1.5194, anchor: 'floor', in: 0.07,
    nota: 'Trilho galvanizado inferior — corre os 14 580 mm de ponta a ponta. '
      + 'Nasce 82,5 mm ABAIXO da pele branca, então só 127,5 mm dele entram no '
      + 'painel; o resto o compositor recorta.',
  },
  /* NÃO há peça `rub-rail`, e a ausência é MEDIDA: o "friso de proteção"
     (metal-galvanizado-polido, y 145–335 mm) mora 63–76 mm ATRÁS da pele
     branca — com a folha oclusora ligada na bancada a peça sai 0,00 % — é
     longarina interna, invisível no baú real. A rodada que o declarou peça
     do painel fotografava ATRAVÉS de uma pele invisível. */
  {
    id: 'cap-top', how: 'run', material: /metal-galvanizado-mantido/i,
    y0: 3.9614, y1: 4.1714, anchor: 'roof', in: 0.07,
    nota: 'Cantoneira de topo — 210 mm, corrida. O pé dela fica 50,5 mm abaixo '
      + 'do topo do branco e ela sobe 159,5 mm ACIMA dele, para dentro do teto.',
  },
  {
    id: 'tape-low', how: 'tile', material: /Faixa-3M/i,
    y0: 1.3400, y1: 1.3900, anchor: 'floor',
    pitch: 0.5839, unit: 0.300,
    nota: 'Fita refletiva 3M inferior — 25 segmentos de 300 mm no passo medido '
      + 'de 583,9 mm. Entre um segmento e o próximo aparece o trilho nu, e é por '
      + 'isso que a unidade desenhada é menor que o passo.',
  },
  /* NÃO há peça `rivet-row`, e a ausência é MEDIDA: o histograma fino do
     inox na janela do trilho (inv.mjs, seção `left_rivet_row`, 2026-08-11)
     mostra ferragem SÓ nas duas pontas (u −30..216 e 14445..14577 mm) — o
     bake não modela rebites correndo o trilho. As duas tentativas anteriores
     ("passo 930", "pares em 918/993") liam ferragem de outras cotas. Os
     rebites que o painel mostra são os das EMENDAS DE CHAPA, que são
     geometria procedural (`models.buildLiveryPanels`) e chegam ao editor pela
     grade de `getPlateGrid()` — não por foto. */
  /* Os MONTANTES de canto. São grupos rígidos — perfil galvanizado, o risco
     vertical de fita 3M e a ferragem de canto — presos à ponta, largura fixa,
     altura acompanhando o painel. O filtro é largo de propósito: a janela é
     quem recorta, e tudo dentro dela obedece a mesma regra. As larguras são as
     MEDIDAS da rodada de região (0,1535 / 0,1221 m), que valiam para o grupo
     e continuam valendo. */
  {
    id: 'post-rear', how: 'corner', material: /./,
    y0: 1.3089, y1: 4.0464, anchor: 'floor',
    side: 'start', width: 0.1535,
    nota: 'Montante traseiro da lateral — canto rígido com o risco vertical '
      + 'de fita e a ferragem da ponta.',
  },
  {
    id: 'post-front', how: 'corner', material: /./,
    y0: 1.3089, y1: 4.0464, anchor: 'floor',
    side: 'end', width: 0.1221,
    nota: 'Montante dianteiro da lateral.',
  },
];

/* ------------------------------------------------------------- TRASEIRA
   O marco (`metal-estrutura-principal-padrao`) emoldura o vão; dentro dele
   ficam as folhas, e sobre as folhas a ferragem que passa POR CIMA da arte —
   é ela que faz um texto atravessado sair cortado como sai no baú.

   A LARGURA DA TRASEIRA É FIXA POR NORMA (2,60 m), e é isso que dita os
   comportamentos: as faixas são `band` (a foto inteira, 1:1 para sempre) e o
   miolo é `sheet` (estica só na altura — os varões crescem, as guias se
   redistribuem em proporção, e o fecho INTEIRO mora na faixa de baixo, que
   não estica). Pele branca da traseira: y 1,5917 … 4,0521 (2 460 mm). */
export const REAR_PARTS: PartSpec[] = [
  {
    id: 'band-top', how: 'band', material: /./,
    out: 0.10, in: 0.08,
    y0: 4.0421, y1: 4.1721, anchor: 'roof',
    nota: 'Travessa superior do marco com as lanternas — faixa inteira, '
      + 'fotografada de ponta a ponta.',
  },
  {
    id: 'band-bottom', how: 'band', material: /./,
    out: 0.10, in: 0.08,
    y0: 1.3116, y1: 2.0517, anchor: 'floor',
    nota: 'Travessa inferior + fita 3M + o FECHO COMPLETO (batente, '
      + 'contra-fecho, manípulo e cames, inventariados até 460 mm do piso da '
      + 'folha). A faixa sobe até cobri-lo inteiro: um fecho cortado entre '
      + 'faixa fixa e miolo elástico racharia ao primeiro resize.',
  },
  {
    id: 'bumper', how: 'band', material: /metal-preto|faixa3M-parachoque/i,
    out: 0.06, in: 0.12,
    y0: 0.4570, y1: 0.6100, anchor: 'floor',
    nota: 'Para-choque traseiro. Fica muito abaixo da pele branca e o '
      + 'compositor o recorta; entra no manifesto para o painel poder '
      + 'mostrá-lo quando houver margem.',
  },
  {
    id: 'post-start', how: 'corner', material: /./,
    y0: 1.5087, y1: 4.0521, anchor: 'floor',
    side: 'start', width: 0.250,
    nota: 'Montante do marco com a coluna de dobradiças (talas a 202/884/'
      + '1566/2248 mm do pé da folha, passo 682 mm).',
    out: 0.10, in: 0.08,
  },
  {
    id: 'post-end', how: 'corner', material: /./,
    y0: 1.5087, y1: 4.0521, anchor: 'floor',
    side: 'end', width: 0.250,
    nota: 'Montante do marco oposto, espelho do outro.',
    out: 0.10, in: 0.08,
  },
  {
    id: 'centre', how: 'sheet', material: /./,
    out: 0.10, in: 0.09,
    y0: 2.0517, y1: 4.0421, anchor: 'floor',
    inset0: 0.250, inset1: 0.250,
    nota: 'O miolo das folhas: varões (u ≈ 605/1100/1337/1825 mm), guias '
      + '(y 868–933 e 1548–1593 mm), borracha central e vedação. Estica na '
      + 'altura: varão contínuo cresce sem denunciar, guia se redistribui em '
      + 'proporção — e o pé, do fecho para baixo, é da banda fixa.',
  },
];

/* ------------------------------------------------------------- TESTEIRA
   Largura fixa como a traseira → `band` e `corner`. Os montantes são LARGOS
   (450 mm) de propósito: as escadas/conduítes moram a ~370 mm de cada borda
   (inventário: u 345–400 e 2095–2145) e são peças de canto para todo efeito —
   fixas no canto, esticando só na altura. */
export const FRONT_PARTS: PartSpec[] = [
  {
    id: 'band-top', how: 'band', material: /./,
    y0: 3.9614, y1: 4.1714, anchor: 'roof',
    nota: 'Cantoneira de topo da testeira com as lanternas de vigia.',
  },
  {
    id: 'band-bottom', how: 'band', material: /./,
    y0: 1.3094, y1: 1.5194, anchor: 'floor',
    nota: 'Trilho inferior da testeira.',
  },
  {
    id: 'post-start', how: 'corner', material: /./,
    y0: 1.3289, y1: 4.1319, anchor: 'floor',
    side: 'start', width: 0.450,
    nota: 'Canto da testeira com a escada/conduíte (u 345–400 mm).',
  },
  {
    id: 'post-end', how: 'corner', material: /./,
    y0: 1.3289, y1: 4.1319, anchor: 'floor',
    side: 'end', width: 0.450,
    nota: 'Canto oposto da testeira, com o conduíte e a ferragem de vigia.',
  },
];
