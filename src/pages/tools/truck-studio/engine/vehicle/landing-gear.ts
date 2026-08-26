/* A PATOLA DESCE QUANDO O IMPLEMENTO ESTÁ SOZINHO.
   ===========================================================================
   O PEDIDO (2026-08-16): *"quando estiver apenas o implemento sendo mostrado no
   Truck Studio, o suporte do implemento fique tocando no chão — mas não a frente
   da caixa, e sim o suporte mecânico abaixado"*.

   As duas metades do pedido importam, e a segunda é a que decide o desenho: o
   BAÚ NÃO SE MEXE. Um semirreboque desengatado que "encosta a patola no chão"
   baixando o nariz é outra pose do produto inteiro — muda a altura de carga, o
   ângulo do teto, o enquadramento e a foto de catálogo. O que ele pediu é o que
   um motorista faz na vida real: girar a manivela até o pé tocar o piso. O baú
   fica onde está; a perna é que cresce.

   ---------------------------------------------------------------------------
   O QUE O `.glb` TEM, MEDIDO (bancada `checks-patola*-0816.mjs`)

   `trailer-rig.ts` declara `landingGear: null` com a nota "não existe nó de
   patola neste GLB", e está certo quanto ao NOME: o bake é um
   `stitch_result_stitch_all` de 5 852 nós anônimos. Mas a GEOMETRIA existe, e
   ela é telescópica de verdade — quatro malhas, duas por perna, medidas no
   referencial da raiz do implemento:

       tubo EXTERNO  esquerda  y 0,303 … 1,110   (leva também a caixa da manivela)
       tubo EXTERNO  direita   y 0,300 … 1,072
       tubo INTERNO  esquerda  y 0,282 … 0,878   ← desce
       tubo INTERNO  direita   y 0,281 … 0,915   ← desce

   Os internos estão INTEIROS dentro dos externos: fotografados sozinhos são um
   tubo de 63 cm com sapata no pé, e montados só a sapata aparece por baixo. O
   plano de contato dos pneus está em **y = −0,020**, ou seja faltam **301 mm**
   — e 301 mm é exatamente o curso de uma patola real.

   Descer os dois internos por 301 mm deixa 277 mm de tubo ainda encaixado
   dentro do externo. É a pose de um conjunto estacionado, e a bancada a
   fotografou antes de uma linha deste arquivo ser escrita.

   ---------------------------------------------------------------------------
   COMO AS DUAS PERNAS SÃO ACHADAS — por FÍSICA, não por nome de nó

   Nenhum dos quatro nomes acima significa coisa alguma (`Metal-preto_0_329` e
   irmãos), e casá-los por número seria escrever no código o índice de um export
   que o próximo re-bake renumera em silêncio. A regra é a definição da peça:

     **a patola é o que sustenta a DIANTEIRA quando o cavalo sai — logo ela vive
     À FRENTE DA RODAGEM. Dela, a malha mais baixa DE CADA LADO que não toque o
     chão e seja alta o bastante para ser uma perna; e as duas têm de formar um
     par: espelhadas na linha de centro, no mesmo z e com o pé na mesma altura.**

   ⚠️ "À FRENTE DA RODAGEM" NÃO É DECORAÇÃO — foi a primeira versão a falhar na
   bancada. Sem ela, as duas malhas mais baixas do implemento (depois dos pneus)
   são os LAMEIROS do bogie: `x 0,758 / −1,114 · z −3,526`, um par que também
   desce meio metro e mora 6,5 m atrás da patola. E o "fim da rodagem" se acha
   sozinho, sem regexp de nome: **o que TOCA o chão é pneu**, por construção —
   `groundAndCenter()` em models.ts assentou o implemento por eles.

   ⚠️ "DE CADA LADO", E NÃO "AS DUAS MAIS BAIXAS" — a diferença é de 18 mm e ela
   decide tudo. O tubo interno da direita começa em 0,2815 e o externo em 0,300;
   um re-bake que invertesse essa ordem por um milímetro faria "as duas mais
   baixas" escolherem os dois tubos EXTERNOS, que passam no teste de espelho e
   desceriam a perna inteira para fora do mancal. Uma por lado não tem esse modo
   de falha: o par é sempre uma esquerda e uma direita.

   Se qualquer verificação falhar o módulo AVISA com os números e se desliga — a
   patola fica onde o bake a pôs, que é o comportamento de antes deste arquivo.

   ---------------------------------------------------------------------------
   ⚠️ POR QUE UM GRUPO, E POR QUE ELE FICA FORA DA FUSÃO

   As duas malhas viajam para um `Group` próprio (`PATOLA`), filho da raiz do
   implemento e na identidade. Duas razões, e a segunda é a que não é opcional:

     1. descer a patola vira UMA escrita, num nó só, em vez de duas escritas em
        nós enterrados a sete níveis de profundidade num grafo anônimo;
     2. `vehicle/merge.ts` funde por MATERIAL: as duas pernas são
        `metal-preto`, o mesmo material de 577 outras primitivas do implemento.
        Fundidas, os vértices delas ficam ASSADOS na pose do instante da fusão,
        dentro de um balde que atravessa o conjunto inteiro — e mover um pedaço
        de balde é impossível. O grupo dá à exclusão um nome estável
        (`LANDING_GEAR_MERGE_EXCLUSIONS`), e a exclusão custa **duas chamadas de
        desenho** das 552 do quadro: as duas pernas deixam de entrar num balde
        que continua existindo com 575 membros, ou seja nenhum balde a mais.

   ⚠️ A MATRIZ É REASSADA NA MUDANÇA DE PAI, e sem isso as pernas saltam para
   outro lugar do espaço. Os nós do implemento são CONGELADOS
   (`freezeMatrices()` em `models.ts`), então ninguém recompõe a matriz local
   deles depois — é o mesmo motivo, e a mesma conta, do CASULO em `merge.ts`.

   ⚠️ E O GRUPO NASCE CONGELADO JUNTO COM O RESTO. `buildLandingGear()` roda
   ANTES de `freezeMatrices()` de propósito; quem escreve `position` num nó
   congelado tem de chamar `updateMatrix()`, e `setLandingGearDown()` chama. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** O nome do grupo que carrega as duas pernas. Estável, e é ele que a exclusão
 *  da fusão casa — ver o ⚠️ do cabeçalho. */
export const LANDING_GEAR_GROUP = 'PATOLA';

/**
 * O que a fusão por material NÃO pode encostar, escrito por quem é dono da
 * peça. `studio.ts` — a raiz de composição — junta esta lista com as de
 * `trim.ts` e `models.ts`. Ver `MergePolicy` em `vehicle/merge.ts`.
 */
export const LANDING_GEAR_MERGE_EXCLUSIONS: {
  nodes: { re: RegExp; label: string }[];
} = {
  nodes: [{ re: new RegExp(`^${LANDING_GEAR_GROUP}$`), label: 'patola: pé no chão' }],
};

/* ---------------------------------------------------------------------------
   OS LIMIARES, e o que cada um descarta de verdade */

/** Uma malha que começa a menos disto do plano de contato é rodagem, não perna. */
const ACIMA_DO_CHAO = 0.08;
/** E uma que começa acima disto não é um pé — é ferragem de chassi. */
const PE_MAXIMO = 0.80;
/** Altura mínima para o que sobrou poder se chamar perna. */
const PERNA_MINIMA = 0.25;
/** Quanto os centros em x podem deixar de se cancelar e ainda ser um par. */
const ESPELHO = 0.08;
/** Quanto os centros em z podem divergir e ainda ser o mesmo eixo. */
const MESMO_Z = 0.15;
/** E quanto os dois pés podem estar em alturas diferentes. */
const MESMO_PE = 0.03;
/** Abaixo disto não há o que abaixar: a patola já está no chão. */
const QUEDA_MINIMA = 0.01;
/** Quem é rodagem, para achar o plano de contato em MUNDO. Mesmo critério de
 *  `TYRE_RE` em `models.ts`; duas cópias da pergunta divergiriam num re-bake,
 *  e é por isso que ela está escrita uma vez em cada lado com o mesmo texto. */
const PNEU_RE = /pneu|tire/i;
/** Uma malha que começa a menos disto do plano de contato é RODAGEM. É a mesma
 *  banda de `TYRE_CONTACT_BAND` em `models.ts`, e pela mesma razão: o estepe
 *  guardado sob o chassi é um pneu que não toca. */
const BANDA_DE_CONTATO = 0.05;
/** Folga entre o fim da rodagem e o começo da janela da patola. */
const FOLGA_DO_BOGIE = 0.20;

interface Patola {
  raiz: THREE.Object3D;
  grupo: THREE.Group;
  /**
   * O ponto mais baixo do pé, em espaço LOCAL DA RAIZ — com x e z, não só y.
   *
   * ⚠️ OS TRÊS EIXOS IMPORTAM, e ignorar x/z foi o defeito que a bancada pegou
   * (ver A QUEDA É MEDIDA NO MUNDO). O implemento ENGATADO é inclinado, então a
   * altura de mundo de um ponto local depende de onde ele está no comprimento.
   */
  peLocal: THREE.Vector3;
  /** O plano em que os pneus tocam, em espaço de MUNDO. */
  chaoMundo: number;
  /** A última queda aplicada, em metros de MUNDO. Só para `info()`. */
  queda: number;
  /** A pose corrente, para `info()` e para a bancada. */
  descida: boolean;
}

let patola: Patola | null = null;

/** Caixa POR VÉRTICE de uma malha, no referencial de `inv` (a inversa da raiz).
 *  `Box3.setFromObject` é a caixa de uma caixa girada, e aqui o erro entraria
 *  direto na altura da perna — é a mesma regra do resto de `vehicle/`. */
function caixaLocal(o: THREE.Mesh, inv: THREE.Matrix4, mm: THREE.Matrix4, vv: THREE.Vector3) {
  const pos = o.geometry?.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!pos || !pos.count) return null;
  o.updateWorldMatrix(true, false);
  mm.multiplyMatrices(inv, o.matrixWorld);
  const b = new THREE.Box3();
  for (let i = 0; i < pos.count; i++) b.expandByPoint(vv.fromBufferAttribute(pos, i).applyMatrix4(mm));
  return b;
}

/**
 * Acha as duas pernas, põe-nas num grupo e guarda quanto falta do chão.
 *
 * Chamada por `loadTrailer()`, DEPOIS de tudo que varre o implemento por
 * hierarquia (acabamento, ferragem, chapas, Thermo King, rodas) e ANTES de
 * `freezeMatrices()`. Idempotente por implemento: uma segunda chamada com a
 * mesma raiz não faz nada.
 *
 * Nunca lança. Quando não reconhece a peça, avisa com o motivo e desliga —
 * a patola fica exatamente onde o bake a pôs.
 */
/**
 * Esquece a patola do implemento que saiu de cena.
 *
 * `patola` é estado de MÓDULO e guarda referências para malhas do implemento.
 * Enquanto `loadTrailer()` rodava uma vez por página isso era inofensivo; com
 * o catálogo de implementos (2026-08-18) ele passou a rodar a cada troca de
 * chassi entre cavalo e rígido, e uma patola velha faria `setLandingGearDown()`
 * escrever pose em objetos que já foram descartados.
 *
 * Não descarta geometria: as malhas da patola são do implemento, e quem as
 * libera é o `disposeTree()` da raiz dele.
 */
export function forgetLandingGear(): void {
  patola = null;
}

export function buildLandingGear(raiz: THREE.Object3D): void {
  if (patola && patola.raiz === raiz) return;
  patola = null;

  raiz.updateWorldMatrix(true, true);
  const inv = raiz.matrixWorld.clone().invert();
  const mm = new THREE.Matrix4();
  const vv = new THREE.Vector3();

  const malhas: { o: THREE.Mesh; b: THREE.Box3 }[] = [];
  let chaoY = Infinity;
  raiz.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    const b = caixaLocal(o, inv, mm, vv);
    if (!b) return;
    malhas.push({ o, b });
    if (b.min.y < chaoY) chaoY = b.min.y;
  });
  if (!Number.isFinite(chaoY)) {
    console.warn('[patola] implemento sem geometria mensurável — a patola fica como está.');
    return;
  }

  /* ---- ONDE ACABA A RODAGEM ----
     ⚠️ E ISTO É O QUE SEPARA A PATOLA DOS PARA-LAMAS, que foi a primeira
     tentativa e falhou na bancada: *"as duas malhas mais baixas não formam um
     par espelhado (x 0,758 / −1,114 · z −3,526)"*. As duas malhas mais baixas do
     implemento inteiro, depois dos pneus, são os LAMEIROS do bogie — eles
     também vêm aos pares, também descem mais que meio metro, e estão 6,5 m atrás
     da patola.

     A frase que os separa é a definição da peça: **a patola é o que sustenta a
     dianteira quando o cavalo sai**, ou seja ela vive À FRENTE DA RODAGEM. E a
     rodagem se acha sozinha, sem uma regexp de nome: o que TOCA o chão é pneu,
     por construção — `groundAndCenter()` assentou o implemento por eles. */
  let bogieMaxZ = -Infinity;
  for (const r of malhas) {
    if (r.b.min.y <= chaoY + BANDA_DE_CONTATO) bogieMaxZ = Math.max(bogieMaxZ, r.b.max.z);
  }
  if (!Number.isFinite(bogieMaxZ)) {
    console.warn('[patola] rodagem não encontrada — sem ela não há "à frente do bogie".');
    return;
  }
  const janelaZ = bogieMaxZ + FOLGA_DO_BOGIE;

  const candidatas = malhas.filter((r) => {
    const alt = r.b.max.y - r.b.min.y;
    return r.b.min.z > janelaZ
      && r.b.min.y > chaoY + ACIMA_DO_CHAO
      && r.b.min.y < chaoY + PE_MAXIMO
      && alt >= PERNA_MINIMA;
  });

  /* ---- UMA PERNA POR LADO, e não "as duas mais baixas" ----
     A diferença é de 18 mm e ela decide tudo: o tubo INTERNO da direita começa
     em 0,2815 e o EXTERNO em 0,300. "As duas mais baixas" acerta hoje e erra no
     dia em que um re-bake inverter essa ordem por um milímetro — e erraria
     escolhendo dois tubos externos, que passariam no teste de espelho e
     desceriam a perna inteira para fora do mancal.
     Pegando a mais baixa DE CADA LADO, o par é necessariamente uma perna
     esquerda e uma direita, e as verificações abaixo dizem se elas são a mesma
     peça. */
  const maisBaixaDe = (sinal: number) => {
    let melhor: { o: THREE.Mesh; b: THREE.Box3 } | null = null;
    for (const r of candidatas) {
      const cx = (r.b.min.x + r.b.max.x) / 2;
      if (Math.sign(cx) !== sinal) continue;
      if (!melhor || r.b.min.y < melhor.b.min.y) melhor = r;
    }
    return melhor;
  };
  const a = maisBaixaDe(1);
  const b = maisBaixaDe(-1);
  if (!a || !b) {
    console.warn('[patola] não há uma candidata de cada lado à frente de z',
      janelaZ.toFixed(2), `(${candidatas.length} candidata(s)) — a patola fica como está.`);
    return;
  }

  const cxA = (a.b.min.x + a.b.max.x) / 2, cxB = (b.b.min.x + b.b.max.x) / 2;
  const czA = (a.b.min.z + a.b.max.z) / 2, czB = (b.b.min.z + b.b.max.z) / 2;
  if (Math.abs(cxA + cxB) > ESPELHO
    || Math.abs(czA - czB) > MESMO_Z
    || Math.abs(a.b.min.y - b.b.min.y) > MESMO_PE) {
    console.warn('[patola] as duas candidatas não formam um par'
      + ` (x ${cxA.toFixed(3)} / ${cxB.toFixed(3)}`
      + ` · z ${czA.toFixed(3)} / ${czB.toFixed(3)}`
      + ` · pé ${a.b.min.y.toFixed(3)} / ${b.b.min.y.toFixed(3)})`
      + ' — a patola fica como está.');
    return;
  }

  const peY = Math.min(a.b.min.y, b.b.min.y);

  /* ---- O GRUPO, e a reassadura da matriz ---- */
  const grupo = new THREE.Group();
  grupo.name = LANDING_GEAR_GROUP;
  raiz.add(grupo);
  grupo.updateMatrixWorld(true);
  for (const r of [a, b]) {
    mm.multiplyMatrices(inv, r.o.matrixWorld);
    grupo.add(r.o);
    r.o.matrix.copy(mm);
    r.o.matrix.decompose(r.o.position, r.o.quaternion, r.o.scale);
    /* `add()` NÃO suja o filho (three r179) e o nó pode já estar congelado. */
    r.o.matrixWorldNeedsUpdate = true;
  }

  /* ---- E A SAPATA, que o bake tem fina demais para aparecer ---- */
  const sapata = construirSapata([a, b], peY, grupo, inv, mm, vv);

  /* O QUE TOCA é a FACE DE BAIXO da sapata, quando ela existe. A chapa pende do
     tubo: topo em `peY − folga`, base 14 mm abaixo disso. */
  const baseY = sapata ? peY - SAPATA_FOLGA - SAPATA_ESPESSURA : peY;

  /* ---- O PLANO DE CONTATO EM MUNDO ---- */
  const chaoMundo = medirChaoMundo(raiz);
  if (chaoMundo === null) {
    console.warn('[patola] plano de contato não medido em mundo — a patola fica como está.');
    return;
  }

  patola = {
    raiz, grupo, chaoMundo, descida: false, queda: 0,
    peLocal: new THREE.Vector3((cxA + cxB) / 2, baseY, (czA + czB) / 2),
  };
  console.info('[patola] duas pernas achadas —',
    `x ${cxA.toFixed(3)} / ${cxB.toFixed(3)} · z ${czA.toFixed(3)}`,
    `· pé local ${baseY.toFixed(4)} · chão de mundo ${chaoMundo.toFixed(4)}`,
    sapata ? `· sapata ${(SAPATA_ABA * 2000).toFixed(0)} mm mais larga que a flange`
      : '· SEM sapata gerada');
}

/**
 * Onde os pneus tocam, em espaço de MUNDO.
 *
 * Por vértice e só nos pneus — é a mesma definição de `runningTyres()` em
 * `models.ts`, e ela não é reusada aqui porque aquela mede ANTES do
 * assentamento e em outro momento do ciclo. Medida UMA vez, na construção:
 * o implemento pousa nos pneus e continua pousado neles em qualquer pose que
 * `placeTrailer()` escolha, então este plano é constante para a sessão.
 */
function medirChaoMundo(raiz: THREE.Object3D): number | null {
  raiz.updateWorldMatrix(true, true);
  const v = new THREE.Vector3();
  let y = Infinity;
  raiz.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !PNEU_RE.test(o.name || '')) return;
    const pos = o.geometry?.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) return;
    o.updateWorldMatrix(true, false);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (v.y < y) y = v.y;
    }
  });
  return Number.isFinite(y) ? y : null;
}

/* ---------------------------------------------------------------------------
   A SAPATA — a chapa que toca o chão, e que o bake NÃO tem

   Pedido de 2026-08-16, depois de ver a patola descida: *"na peça que segura o
   implemento que vai no chão, deve ter uma superfície de uns 2 cm, mais larga
   que o suporte em si, na parte que toca o chão"*.

   MEDIDO no `.glb` antes de acrescentar nada (`checks-sapata-0816.mjs`), e o
   resultado corrige a primeira leitura que eu tinha feito:

       tubo, a 400–600 mm do pé      102 × 100 mm
       FLANGE de fábrica             existe — 0 … 7,7 mm acima do pé,
                                     avançando 69 mm além do tubo (⇒ 240 mm)

   Ou seja **a sapata de fábrica existe** e já é bem mais larga que o tubo. O que
   não existe é uma sapata que se VEJA: 7,7 mm de espessura, com a face de baixo
   assentada exatamente no plano de contato, some contra qualquer piso que não
   seja perfeitamente plano — nas fotos do distrito o tubo aparece entrando no
   chão cortado a prumo, que foi o que o dono do produto viu.

   Então o que se acrescenta é uma CHAPA que pende do pé: 20 mm além da flange em
   cada lado (280 mm no total) e 14 mm de espessura, que é a medida de uma sapata
   de aço de verdade. A flange de fábrica passa a ser o degrau de cima dela, e o
   conjunto lê como o sapatão que é.

   ⚠️ A LARGURA SAI DA FLANGE, e não do tubo — e essa é a única leitura do pedido
   que produz alguma coisa visível. "2 cm mais larga que o suporte" contado a
   partir dos 100 mm do tubo daria 140 mm: MENOS que os 240 da flange, ou seja
   uma chapa nascida já escondida debaixo dela.

   ⚠️ ELA NASCE 0,6 mm ABAIXO DO TUBO, e não coplanar com ele. A face de baixo do
   tubo e a de cima da chapa seriam o MESMO plano, e dois planos coincidentes
   brigam no z-buffer — o defeito aparece de raspão, intermitente, e só na
   captura. Meio milímetro é invisível e o remove por construção. É também por
   isso que a QUEDA passa a ser medida da chapa, e não do tubo: quem toca o chão
   é ela.

   ⚠️ E ELA REUSA O MATERIAL DA PERNA. Não é economia de memória — é a única
   forma de a chapa acompanhar o acabamento que `applyTrailerFinish()` já
   escolheu para o `metal-preto` e a sonda de reflexo que `refreshVehicleReflection()`
   já prendeu nele. Um material próprio sairia com outro brilho e outro reflexo,
   e o defeito só apareceria em cena com ambiente forte.

   As duas chapas são UMA malha (`mergeGeometries`): elas nunca se separam, e
   duas malhas seriam duas chamadas de desenho por nada. */

/** Quanto a chapa avança além do tubo, em cada lado. O "uns 2 cm" do pedido. */
const SAPATA_ABA = 0.020;
/** Espessura da chapa — aço de sapata de patola, medida de catálogo. */
const SAPATA_ESPESSURA = 0.014;
/** Quanto ela nasce abaixo do tubo, para não haver plano coincidente. */
const SAPATA_FOLGA = 0.0006;
/** Vértices dentro desta faixa acima do pé definem a SECÇÃO do tubo. */
const SAPATA_BANDA = 0.02;

function construirSapata(
  pernas: { o: THREE.Mesh; b: THREE.Box3 }[], peY: number, grupo: THREE.Group,
  inv: THREE.Matrix4, mm: THREE.Matrix4, vv: THREE.Vector3,
): THREE.Mesh | null {
  const partes: THREE.BufferGeometry[] = [];
  let material: THREE.Material | null = null;
  for (const r of pernas) {
    const pos = r.o.geometry?.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) continue;
    r.o.updateWorldMatrix(true, false);
    mm.multiplyMatrices(inv, r.o.matrixWorld);
    /* A SECÇÃO DO PÉ, e não a caixa da perna inteira: o tubo pode ter um
       ressalto lá em cima (na esquerda ele leva a caixa da manivela), e uma
       chapa dimensionada por aquilo sairia enorme. Só os vértices dos 20 mm de
       baixo entram. */
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      vv.fromBufferAttribute(pos, i).applyMatrix4(mm);
      if (vv.y > peY + SAPATA_BANDA) continue;
      if (vv.x < x0) x0 = vv.x; if (vv.x > x1) x1 = vv.x;
      if (vv.z < z0) z0 = vv.z; if (vv.z > z1) z1 = vv.z;
    }
    if (!(x1 > x0 && z1 > z0)) continue;
    const g = new THREE.BoxGeometry(
      x1 - x0 + 2 * SAPATA_ABA, SAPATA_ESPESSURA, z1 - z0 + 2 * SAPATA_ABA);
    g.translate((x0 + x1) / 2, peY - SAPATA_FOLGA - SAPATA_ESPESSURA / 2, (z0 + z1) / 2);
    partes.push(g);
    if (!material) {
      material = (Array.isArray(r.o.material) ? r.o.material[0] : r.o.material) || null;
    }
  }
  if (partes.length !== pernas.length || !material) {
    for (const g of partes) g.dispose();
    console.warn('[patola] não deu para medir a secção do pé — a perna fica sem sapata.');
    return null;
  }
  const geo = mergeGeometries(partes, false);
  for (const g of partes) g.dispose();
  if (!geo) {
    console.warn('[patola] mergeGeometries recusou as duas chapas — sem sapata.');
    return null;
  }
  const malha = new THREE.Mesh(geo, material);
  malha.name = `${LANDING_GEAR_GROUP}_SAPATA`;
  malha.castShadow = pernas[0].o.castShadow;
  malha.receiveShadow = true;
  /* `vehicle/lod.ts` lê este campo e o RECALCULA quando ele falta — escrevê-lo
     aqui evita uma medida de caixa envolvente por malha nova no primeiro
     quadro, e diz a verdade: a chapa tem ~28 cm. */
  geo.computeBoundingSphere();
  malha.userData.tsWorldDiameter = (geo.boundingSphere?.radius ?? 0.14) * 2;
  /* Congelada como todo o resto do implemento — ela é filha do grupo que se
     move, e não se move sozinha. `freezeMatrices()` ainda não passou por aqui
     (ver a ordem em `loadTrailer()`), então isto é redundante hoje e correto
     para sempre. */
  malha.matrixAutoUpdate = false;
  malha.updateMatrix();
  grupo.add(malha);
  return malha;
}

/**
 * Gira a manivela: pé no chão (`true`) ou recolhido (`false`).
 *
 * Idempotente e barato — uma escrita de `position.y` e o `updateMatrix()` que
 * um nó congelado exige. Devolve o estado EFETIVO, que é `false` quando não há
 * patola reconhecida.
 */
export function setLandingGearDown(down: boolean): boolean {
  if (!patola) return false;
  const quer = !!down;
  patola.descida = quer;
  patola.grupo.position.y = quer ? -quedaLocal(patola) : 0;
  /* ⚠️ OBRIGATÓRIO: o grupo é congelado junto com o implemento
     (`freezeMatrices()`), então escrever `position` sem isto não move nada — e
     falha em silêncio, que é o defeito que aquele bloco documenta. */
  patola.grupo.updateMatrix();
  patola.grupo.matrixWorldNeedsUpdate = true;
  return quer;
}

/* ---------------------------------------------------------------------------
   A QUEDA É MEDIDA NO MUNDO, E RESOLVIDA A CADA APLICAÇÃO

   ⚠️ A primeira versão media tudo em espaço LOCAL DA RAIZ — `pé local menos
   chão local` — e passou na bancada porque a bancada media no mesmo espaço
   errado. O relato pegou: *"a sapata só aparece quando NÃO está somente o
   implemento"*. Medido no cenário Estúdio, com só o implemento em cena:

       face de baixo da sapata   y de mundo  −0,0483
       pneus tocam               y de mundo  +0,0062
       ⇒ a chapa nascia 54,5 mm ENTERRADA no piso

   A causa é a INCLINAÇÃO DE ENGATE. `placeTrailer()` gira o implemento sobre o
   contato dos pneus para o pino descer sobre a quinta roda (~0,36° aqui, ver
   `trailer_meta.json`), e a patola fica ~8,6 m à frente do bogie: 8,6 · tg 0,36°
   = 54 mm. No referencial da raiz essa inclinação NÃO EXISTE — lá o pé encostava
   perfeitamente, com erro zero, num chão que não é o chão.

   Então a conta acontece em mundo, e RECALCULADA a cada `setLandingGearDown()`
   em vez de guardada: a inclinação muda com o cavalo (a altura da quinta roda é
   por cabine) e com todo `setTrailerDims()`. Um número gravado na construção
   estaria certo até a primeira troca de caminhão.

   ⚠️ E A CONVERSÃO DE VOLTA PARA LOCAL DIVIDE POR `elements[5]`. Uma escrita em
   `grupo.position.y` anda ao longo do eixo Y LOCAL da raiz, e o quanto disso
   vira altura de mundo é a componente y desse eixo — a segunda coluna da matriz
   de mundo, ou seja `elements[5]`, que carrega junto a escala da raiz. Dividir
   por ele é o que faz "desça 312 mm de mundo" virar o número local certo.
   ⚠️ NÃO usar `Vector3.transformDirection()` aqui: ela NORMALIZA, e queda é
   distância — foi assim que a primeira medição na bancada devolveu 10 mm em vez
   de 301. */
function quedaLocal(p: Patola): number {
  p.raiz.updateWorldMatrix(true, false);
  const peMundo = p.peLocal.clone().applyMatrix4(p.raiz.matrixWorld).y;
  const quedaMundo = peMundo - p.chaoMundo;
  p.queda = quedaMundo;
  if (!(quedaMundo > QUEDA_MINIMA)) return 0;
  const escalaY = p.raiz.matrixWorld.elements[5];
  return Math.abs(escalaY) > 1e-6 ? quedaMundo / escalaY : quedaMundo;
}

/** Diagnóstico para o console e para a bancada. */
export function landingGearInfo(): {
  achada: boolean; descida: boolean; curso: number; malhas: number;
} {
  /* `curso` é RESOLVIDO na hora, e não lido de um campo: ele depende da pose
     (ver A QUEDA É MEDIDA NO MUNDO), e um valor guardado responderia sobre o
     caminhão anterior. `quedaLocal()` não move nada — só mede. */
  if (patola) quedaLocal(patola);
  return {
    achada: !!patola,
    descida: !!patola?.descida,
    curso: patola ? patola.queda : 0,
    malhas: patola ? patola.grupo.children.length : 0,
  };
}
