/* REFLEXO PLANAR DO PISO — o que faz o chão do estúdio ser um chão POLIDO.
   ===========================================================================
   POR QUE NÃO DÁ PARA FAZER ISTO COM `envMap`. Um piso liso com `roughness`
   baixa e um mapa de ambiente já devolve brilho, mas devolve o AMBIENTE: um
   cubemap é uma imagem do infinito, sem paralaxe, então o caminhão que está a
   dois metros aparece — quando aparece — do tamanho errado e no lugar errado. E
   a sonda de `scene/probe.ts`, que é a única fonte local que existe, é capturada
   com o VEÍCULO ESCONDIDO de propósito, ou seja é exatamente ela que não pode
   mostrar o caminhão. O reflexo que a referência tem — a cabine vermelha
   esticada no piso sob ela — só sai de uma segunda renderização.

   COMO FUNCIONA. Uma câmera virtual espelhada no plano do piso desenha a cena
   num alvo próprio; o material do piso projeta esse alvo de volta por uma matriz
   de textura e o soma como termo especular, pesado por Fresnel. É a construção
   do `Reflector` dos exemplos do three, com três diferenças que importam aqui:

   1. NÃO É UM ESPELHO, É UM PISO. O `Reflector` substitui a cor inteira do
      material pela do reflexo, então ele não recebe luz, não recebe SOMBRA e não
      tem cor própria. O piso do estúdio precisa das três coisas — a sombra de
      contato é o que apoia o pneu no chão. Por isso o reflexo entra por
      `onBeforeCompile` num `MeshStandardMaterial` de verdade, somado no fim, em
      vez de virar o material.
   2. O BORRÃO CRESCE COM A DISTÂNCIA. Concreto polido não é vidro: o reflexo
      abre conforme se afasta do ponto de contato. Cinco amostras com raio
      proporcional à distância do fragmento à câmera dão essa abertura por uma
      fração do custo de um borrão separável — e é a diferença entre "piso
      molhado" e "piso encerado".
   3. ELE CABE NO ORÇAMENTO OU NÃO ENTRA. A cena tem 4,4 M de triângulos e o
      reflexo é uma segunda passada por cima disso. `SCALE` desce a resolução do
      alvo (o custo de preenchimento cai com o quadrado) e `setFloorReflection()`
      permite desligar. MEDIDO na bancada — ver ARCHITECTURE §9.8.
      E DESDE O PERFIL DE QUALIDADE SÃO TRÊS ESTADOS, não dois:
      `getProfile().floorReflection` vale `'full' | 'lod' | 'off'`. O `'off'` é
      tratado por `cyclorama.ts` (o gancho de quadro nem chama esta passada) e
      aqui, soltando o ALVO — 96,7 MB. O `'lod'` é o degrau do meio e mora neste
      arquivo; ver o bloco O MODO 'lod' lá embaixo, que explica por que ele tira
      GEOMETRIA e não resolução.

   O PLANO DE CORTE OBLÍQUO. Sem ele a câmera espelhada enxerga o que está ABAIXO
   do piso, e há geometria lá: a caixa do rig começa em y = −0,21 m. O resultado
   seria a barriga do implemento vazando pelo reflexo perto do ponto de contato.
   `makeOblique()` empurra o plano near da projeção para o próprio plano do piso,
   que é a solução clássica (Lengyel) e custa uma multiplicação de matriz. */
import * as THREE from 'three';
import { renderer, scene, camera as liveCamera, onDrawFrame } from './scene';
/* MÓDULO FOLHA — não importa nada do engine, então lê-lo daqui não fecha ciclo.
   O mesmo caminho que `cyclorama.ts` já usa. */
import { getProfile, onQualityChange } from '../core/quality';

/** Fração da resolução do canvas usada no alvo do reflexo. */
let SCALE = 0.5;
/** Teto de resolução: acima disso o ganho visual não paga a taxa de preenchimento. */
const MAX_DIM = 1600;

const reflector = new THREE.PerspectiveCamera();
const target = { rt: null as THREE.WebGLRenderTarget | null, w: 0, h: 0 };
const textureMatrix = new THREE.Matrix4();

let enabled = true;
/** Materiais que receberam a injeção — atualizados a cada passada. */
const clients = new Set<THREE.MeshStandardMaterial>();
const uniforms = {
  tReflect: { value: null as THREE.Texture | null },
  reflectMatrix: { value: textureMatrix },
  reflectStrength: { value: 1.0 },
  reflectBlur: { value: 1.0 },
  /* ONDE O REFLEXO MORRE: (centro x, centro z, meio-lado em que começa a ceder,
     meio-lado em que zera). Quem preenche é o dono do piso — só ele sabe onde a
     parede está. Zerado, o reflexo cobre o plano inteiro. */
  reflectFade: { value: new THREE.Vector4(0, 0, 1e9, 1e9) },
  /* A PEGADA DO VEÍCULO: (centro x, centro z, meio-lado x, meio-lado z). Zerada
     em `w`/`z`, a oclusão de contato não existe — ver o bloco dela no shader. */
  contactBox: { value: new THREE.Vector4(0, 0, 0, 0) },
  /* (profundidade, alcance em metros) da oclusão de contato. */
  contactAo: { value: new THREE.Vector2(0.45, 2.6) },
};

/* ---------------- a matriz de textura ----------------
   Leva do espaço do OBJETO ao espaço de textura do alvo: projeção da câmera
   espelhada, e depois o remapeamento de [-1,1] para [0,1]. O `w` é preservado
   porque a divisão perspectiva acontece no fragmento (`texture2DProj`), não
   aqui — dividir no vértice interpolaria errado em superfícies grandes, que é
   exatamente o caso de um piso de 92 m. */
const BIAS = new THREE.Matrix4().set(
  0.5, 0, 0, 0.5,
  0, 0.5, 0, 0.5,
  0, 0, 0.5, 0.5,
  0, 0, 0, 1,
);

const _pos = new THREE.Vector3();
const _look = new THREE.Vector3();
const _up = new THREE.Vector3();
const _rot = new THREE.Matrix4();
const _plane = new THREE.Plane();
const _onPlane = new THREE.Vector3();
const _clip = new THREE.Vector4();
const _q = new THREE.Vector4();
const UP = new THREE.Vector3(0, 1, 0);

/* ===========================================================================
   O MODO 'lod' — REDUZIR GEOMETRIA, E NÃO RESOLUÇÃO
   ===========================================================================
   A MEDIÇÃO QUE MANDA, e ela já estava neste arquivo, em `setFloorReflectionScale`:
   **14,1 fps a meio lado contra 14,7 a um quarto.** Um quarto de lado é 1/4 dos
   fragmentos e devolveu 0,6 fps. Ou seja o gargalo desta passada NÃO é
   preenchimento — é a segunda varredura de GEOMETRIA (submissão de chamadas +
   transformação de vértice + passe de profundidade). Logo o degrau intermediário
   tem de tirar OBJETOS, não pixels.

   QUANTO DETALHE O REFLEXO CONSEGUE CARREGAR, pela conta e não pelo gosto:

     · o alvo é `size × pixelRatio × SCALE`, SCALE 0,5 — num 1080p a dpr 1 são
       960 × 540;
     · a lente é de 30° (ver `core/quality.ts`), então mip 0 vale
       30° / 540 = 0,0556° por texel;
     · a leitura é `textureLod` com `lod = clamp(log2(1 + d·0,12), 0, 4)`;
     · a órbita é presa entre ~8,6 e ~22,4 m.

   ⚠️ **E AQUI HÁ UM NÚMERO QUE A DOCUMENTAÇÃO DE `core/quality.ts` ARREDONDA
   PARA O LADO ERRADO.** Ela diz "lido até 4,0", e 4,0 é o TETO da expressão, não
   a faixa de trabalho: `lod = 4` exigiria `1 + 0,12·d = 16`, ou seja **d = 125 m**
   — cinco vezes o alcance da órbita. Dentro da órbita o nível real vai de
   `log2(1 + 0,12·8,6) = 1,03` a `log2(1 + 0,12·22,4) = 1,88`. Dimensionar o corte
   por mip 4 (60 × 34 pixels) tiraria coisa que o reflexo AINDA MOSTRA.

   Então a régua honesta é mip ~1,9, ou seja ~3,7 texels de mip 0 por texel lido.
   Uma feição precisa de mais que ~1 texel lido para existir, e o reflexo ainda é
   atenuado por Fresnel a no máximo `k = 0,42` (linha do TETO É 0,42) e por
   `k /= 1 + d·0,018`. Juntando: 3,7 × 0,0556° = 0,206°, que a 22,4 m são **8,0
   cm**; e o que sobrar disso entra na imagem com menos da metade do contraste
   que teria na vista direta. **8 cm é o corte, e ele é conservador nas duas
   pontas** — perto da câmera o mip cai para ~1,0 mas a peça também está mais
   perto, e as duas variações se cancelam em primeira ordem.

   ---------------------------------------------------------------------------
   POR QUE A MEDIDA É A SEGUNDA MAIOR ARESTA, E NÃO O DIÂMETRO

   A opção óbvia era casar com o `userData.tsWorldDiameter` que o LOD de tela
   grava (maior extensão da peça). **Ele responde a pergunta errada aqui**, e o
   contraexemplo mora neste próprio implemento: medido em `models.ts`, são
   1 131 malhas de ferragem em `inox-ferragem`/`metal-pouco-polido` com z-span
   < 0,50 m, mais 27 de TRILHO — `2 × capping strip de 14,55 m`, `4 × friso de
   flanco de 14,47 m`, `11 × proteção de piso de 14,32 m`. Um friso de 14,5 m de
   comprimento por ~2 cm de largura tem `tsWorldDiameter` ENORME e, no reflexo a
   mip 1,9, é um risco de 2 cm que texel nenhum resolve. Pelo diâmetro ele
   sobrevive; pela largura ele some — e é a largura que o olho lê.

   A SEGUNDA MAIOR ARESTA da caixa da peça é exatamente essa largura: numa
   esfera de 8 cm ela vale 8 cm (fica), num friso de 14,5 × 0,02 × 0,02 vale 2 cm
   (sai), na placa da traseira de 810 × 230 × 54 mm vale 23 cm (fica — e é a peça
   com o recorte Ankaa, que TEM de aparecer no chão do estúdio).

   `userData.tsWorldDiameter` continua sendo lido quando existe, mas só como
   ATALHO seguro: se a MAIOR aresta já é menor que o corte, a segunda também é, e
   não há caixa a medir. Se o campo não existir — e no momento em que isto foi
   escrito ele ainda não existia em lugar nenhum da árvore — nada se perde.

   ---------------------------------------------------------------------------
   POR QUE ISTO NÃO VAZA PARA A CAPTURA

   `renderFloorReflection()` tem DOIS chamadores: o gancho de quadro de
   `cyclorama.ts`, que passa a câmera VIVA, e `renderCycloramaReflection()`, que
   passa a câmera da CAPTURA — e aquele caminho não consulta o perfil de
   propósito ("um PC fraco pode ter uma vista sem reflexo e ainda assim baixar a
   mesma foto"). Como `cyclorama.ts` não é editável nesta rodada, o discriminante
   é o próprio argumento: a captura constrói `new THREE.PerspectiveCamera()`
   (scene/capture.ts), que nunca é `=== liveCamera`. Uma identidade de objeto, sem
   parâmetro novo e sem mudar assinatura nenhuma. */

/** Abaixo desta largura aparente (metros) a peça não sobrevive ao mip do reflexo. */
const LOD_THIN_M = 0.08;

/* As três arestas da caixa da GEOMETRIA, ordenadas, em unidades locais. Uma vez
   por geometria: `computeBoundingBox()` é O(vértices) e o implemento tem 5,3 M
   deles. Chaveado pela geometria e não pelo objeto porque a rodagem, os rebites
   e as travas reusam a MESMA malha dezenas de vezes — `wheels.ts` documenta 14
   nós sobre três geometrias. */
const lodExtents = new WeakMap<THREE.BufferGeometry, [number, number, number]>();

function localExtents(g: THREE.BufferGeometry): [number, number, number] | null {
  const hit = lodExtents.get(g);
  if (hit) return hit;
  if (!g.boundingBox) {
    /* Pode lançar em geometria sem `position` — e uma passada de reflexo não é
       lugar de derrubar o quadro. */
    try { g.computeBoundingBox(); } catch { return null; }
  }
  const b = g.boundingBox;
  if (!b) return null;
  const e: [number, number, number] = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
  if (!Number.isFinite(e[0]) || !Number.isFinite(e[1]) || !Number.isFinite(e[2])) return null;
  e.sort((a, c) => c - a);                       // maior primeiro
  lodExtents.set(g, e);
  return e;
}

/* O plano de corte: as malhas que a passada de reflexo esconde. Reconstruído
   raramente — ver `lodPlan()`. */
let lodList: THREE.Object3D[] = [];
let lodBuiltAt = 0;
let lodGeomCount = -1;
/* Meio segundo. A lista só fica errada entre uma troca de veículo/cenário e o
   próximo rebuild, e "errada" aqui significa desenhar por alguns quadros uma
   peça de 2 cm que ia sumir, ou deixar de desenhar uma que já não está na cena —
   nenhuma das duas é observável. Reconstruir por quadro seria uma terceira
   varredura completa do grafo por quadro, que é justamente o recurso que este
   modo existe para poupar num i5. */
const LOD_REBUILD_MS = 500;

const _lodBasis = new THREE.Vector3();

/** A maior escala que a matriz de mundo aplica. Conservadora de propósito:
 *  superestimar a peça só a mantém desenhada. */
function worldScale(o: THREE.Object3D): number {
  const m = o.matrixWorld.elements;
  const sx = _lodBasis.set(m[0], m[1], m[2]).length();
  const sy = _lodBasis.set(m[4], m[5], m[6]).length();
  const sz = _lodBasis.set(m[8], m[9], m[10]).length();
  return Math.max(sx, sy, sz);
}

function collectThin(o: THREE.Object3D, out: THREE.Object3D[]) {
  /* Subárvore já invisível não é nossa: quem a escondeu (o `isolateVehicle()` da
     captura, o `seethrough`, a escolha de vista "só o implemento", o LOD de
     tela) continua sendo o dono dela, e descer nela só custaria trabalho. */
  if (!o.visible) return;
  const mesh = o as THREE.Mesh;
  if (mesh.isMesh && mesh.geometry) {
    /* O ATALHO do LOD de tela, quando ele existir. Ver o bloco acima: a maior
       aresta menor que o corte implica a segunda também menor. */
    const d = (o.userData as { tsWorldDiameter?: number }).tsWorldDiameter;
    if (typeof d === 'number' && d > 0) {
      if (d < LOD_THIN_M) { out.push(o); return; }
    }
    const e = localExtents(mesh.geometry);
    if (e && e[1] * worldScale(o) < LOD_THIN_M) { out.push(o); return; }
  }
  for (const c of o.children) collectThin(c, out);
}

function lodPlan(): THREE.Object3D[] {
  const geoms = renderer.info.memory.geometries;
  const now = performance.now();
  if (geoms !== lodGeomCount || now - lodBuiltAt > LOD_REBUILD_MS) {
    lodGeomCount = geoms;
    lodBuiltAt = now;
    const next: THREE.Object3D[] = [];
    collectThin(scene, next);
    lodList = next;
  }
  return lodList;
}

/* O que ESTA passada escondeu, para devolver exatamente isso e nada mais.
   ⚠️ Reusado entre quadros (um array novo por quadro é lixo por nada) e SEMPRE
   esvaziado no `finally` de quem o preenche. */
const lodHidden: THREE.Object3D[] = [];

/**
 * Esconde o que não sobrevive ao mip do reflexo. Simétrica por construção: só
 * entra na lista de restauração o que estava VISÍVEL no instante em que
 * escondemos, então um objeto que outro dono já havia escondido não volta ligado.
 */
function lodHide() {
  for (const o of lodPlan()) {
    if (!o.visible) continue;
    o.visible = false;
    lodHidden.push(o);
  }
}

function lodRestore() {
  for (const o of lodHidden) o.visible = true;
  lodHidden.length = 0;
}

/* ---------------- o alvo no nível Baixo ----------------
   96,7 MB — 1600 × 1080 `HalfFloatType` com mipmaps E `samples: 4`, dos quais
   ~79 MB são só o buffer multiamostrado. É o SEGUNDO maior item isolado do
   orçamento de memória da cena, atrás apenas dos 341 MB dos conjuntos de chão e
   à frente do implemento inteiro. Numa integrada de memória compartilhada esse
   número pesa tanto quanto os 14,1 fps.

   Até aqui ele ficava alocado no `'off'`: `cyclorama.ts` deixa de CHAMAR a
   passada, mas ninguém solta o alvo — o nível Baixo economizava o tempo e
   continuava pagando a memória.

   ⚠️ E HAVIA UM SEGUNDO DEFEITO NO MESMO LUGAR, mais visível que o primeiro:
   `reflectStrength` é escrito no FIM de cada passada (`= 1`) e por
   `setFloorReflectionAmount()`, e nenhum dos dois roda quando a passada não
   acontece. Depois de uma CAPTURA no nível Baixo — que renderiza o reflexo de
   propósito, porque a foto sai sempre no teto — o uniforme fica em 1 e o alvo
   fica com o enquadramento da foto: a viewport passa a mostrar, parado, o
   reflexo de uma pose que não é a dela. Um gancho de quadro fecha os dois casos
   de uma vez, e é barato (uma comparação de string por quadro).

   Ele é registrado ANTES do de `cyclorama.ts` — este módulo é importado por
   aquele, então o corpo daqui roda primeiro e `drawHooks` preserva a ordem de
   inscrição. Não que a ordem importe para a correção: no `'off'` o gancho de lá
   sai na primeira linha. */
onDrawFrame(() => {
  if (getProfile().floorReflection !== 'off') return;
  if (uniforms.reflectStrength.value !== 0) uniforms.reflectStrength.value = 0;
  releaseFloorReflectionTarget();
});

/**
 * Devolve os 96,7 MB do alvo. O próximo `renderFloorReflection()` o realoca —
 * `ensureTarget()` é quem o cria, e ele não sabe nem se importa se já existiu.
 *
 * Diferente de `disposeFloorReflection()`, que também esquece os CLIENTES: aqui
 * o material do piso continua injetado e continua somando o termo (com o
 * uniforme em zero), porque a sala não foi desmontada — só a passada saiu.
 */
export function releaseFloorReflectionTarget() {
  if (!target.rt) return;
  target.rt.dispose();
  target.rt = null;
  target.w = target.h = 0;
  uniforms.tReflect.value = null;
}

/* E TAMBÉM NA BORDA DO NÍVEL, e não só no gancho de quadro: quem desce para
   Baixo com a aba em segundo plano (ou com o laço parado por `unmountStudio()`)
   não desenha quadro nenhum, e sem isto a memória só voltaria quando a pessoa
   olhasse de novo — que é exatamente quando ela não está sobrando. */
onQualityChange(() => {
  if (getProfile().floorReflection === 'off') releaseFloorReflectionTarget();
});

/* E NO BOOT, antes do primeiro quadro. Quem ABRE no nível Baixo nunca chama a
   passada, então nada zera o uniforme — e `setFloorReflectionAmount()`, que
   `cyclorama.ts` dispara já na inscrição do gancho de rig, o deixa em
   `glossMul`. O termo do piso viraria `textureLod(<sem textura>) * k` no
   primeiro quadro. Uma linha, e o estado nasce coerente em vez de depender de o
   gancho de quadro chegar primeiro. */
if (getProfile().floorReflection === 'off') uniforms.reflectStrength.value = 0;

/**
 * Empurra o plano `near` da projeção para o plano y = `planeY` do mundo.
 *
 * É o corte oblíquo de Lengyel, na mesma forma que o `Reflector` dos exemplos do
 * three usa: reescreve a TERCEIRA LINHA da matriz de projeção pelo plano de
 * corte em espaço de câmera, escalado. Sem isto a câmera espelhada enxerga o que
 * está abaixo do piso — e há geometria lá, a caixa do rig começa em y = −0,21 m.
 *
 * `bias` afasta o corte alguns milímetros do plano exato: no plano, a precisão
 * de profundidade produz uma costura piscando na linha de contato do pneu.
 */
function makeOblique(cam: THREE.PerspectiveCamera, planeY: number, bias: number) {
  _plane.setFromNormalAndCoplanarPoint(UP, _onPlane.set(0, planeY, 0));
  _plane.applyMatrix4(cam.matrixWorldInverse);
  _clip.set(_plane.normal.x, _plane.normal.y, _plane.normal.z, _plane.constant);

  const e = cam.projectionMatrix.elements;
  _q.x = (Math.sign(_clip.x) + e[8]) / e[0];
  _q.y = (Math.sign(_clip.y) + e[9]) / e[5];
  _q.z = -1;
  _q.w = (1 + e[10]) / e[14];
  _clip.multiplyScalar(2 / _clip.dot(_q));

  e[2] = _clip.x;
  e[6] = _clip.y;
  e[10] = _clip.z + 1 - bias;
  e[14] = _clip.w;
}

function ensureTarget(w: number, h: number) {
  if (target.rt && target.w === w && target.h === h) return target.rt;
  target.rt?.dispose();
  target.rt = new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    /* ---- O BORRÃO SAI DAQUI, E NÃO DE AMOSTRAS NO SHADER ----
       A primeira versão borrava com cinco amostras em cruz, com raio crescendo
       com a distância. Cinco amostras não são um borrão: são cinco CÓPIAS, e num
       raio grande elas se separam e desenham fantasmas em cruz. Era metade do
       "não está um blur smooth" que o dono do produto relatou.

       Com uma pirâmide de mipmaps, o borrão vira uma ÚNICA leitura em
       `textureLod()` com nível fracionário — trilinear, contínuo, sem fantasma,
       e mais barato que as cinco. O three regenera os níveis ao fim de cada
       `render()` num alvo, então isto não custa uma passada a mais. */
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    /* MULTIAMOSTRADO, apesar de a passada ser cara. A silhueta do caminhão no
       alvo é o que o piso desenha, e uma silhueta serrilhada a meia resolução
       cintila a cada quadro do giro — a outra metade do "tremido". O custo é de
       preenchimento, e esta passada é limitada por GEOMETRIA (medido: baixar a
       resolução do alvo não devolve fps), então o multiamostrado é quase de
       graça aqui. */
    samples: 4,
    /* LINEAR, E ISSO NÃO É ESCOLHA. O three só aplica tonemap e conversão de
       espaço de cor quando o destino é o CANVAS; desenhando num alvo, o que fica
       gravado é radiância linear. É o que este módulo quer, porque o reflexo é
       somado em `outgoingLight` — que também é linear e ainda não passou pelo
       tonemap. Marcar o alvo como sRGB aqui poria uma gama a mais no reflexo, e
       o sintoma seria um piso que clareia sozinho. `HalfFloat` pelo mesmo
       raciocínio: o painel aceso do teto passa de 1,0 e num alvo de 8 bits ele
       seria cortado em branco antes de chegar ao piso. */
    colorSpace: THREE.NoColorSpace,
    depthBuffer: true,
    stencilBuffer: false,
  });
  target.w = w; target.h = h;
  uniforms.tReflect.value = target.rt.texture;
  return target.rt;
}

/**
 * Desenha a passada de reflexo para `cam` e atualiza os uniformes dos clientes.
 *
 * Chamada por quadro pelo laço (via `cyclorama.ts`) e uma vez por `capture.ts`
 * antes do mosaico — ali com a câmera da CAPTURA e ANTES do `setViewOffset()`,
 * porque a matriz de textura tem de descrever o quadro inteiro e não o ladrilho.
 *
 * ⚠️ **QUAL DAS DUAS CÂMERAS É QUEM DECIDE O NÍVEL DE DETALHE.** Com
 * `floorReflection: 'lod'` a passada esconde o que não sobrevive ao mip do
 * reflexo — mas SÓ quando `cam` é a câmera viva. A captura passa uma câmera
 * própria e continua desenhando a cena inteira, porque a foto sai sempre no
 * teto. Ver o bloco O MODO 'lod'.
 *
 * @param cam      a câmera de quem vai desenhar o piso
 * @param planeY   altura do plano do piso, em metros (normalmente 0)
 * @param plane    a malha do piso — escondida durante a passada
 */
export function renderFloorReflection(
  cam: THREE.PerspectiveCamera, planeY: number, plane: THREE.Object3D,
) {
  if (!enabled || !clients.size) return;
  /* Câmera abaixo do piso: não há reflexo a desenhar, e a projeção oblíqua
     degeneraria. */
  if (cam.position.y <= planeY + 0.05) { uniforms.reflectStrength.value = 0; return; }

  /* ---- POR QUE NÃO HÁ ECONOMIA TEMPORAL AQUI ----
     Houve, por uma versão: a passada rodava em metade dos quadros enquanto a
     câmera andava, o que devolvia parte dos 15 fps que ela custa. O dono do
     produto viu o resultado na hora — *"não está um blur smooth, está meio que
     tremido"* — e ele estava certo: quadros alternados mostram o reflexo desta
     pose e o da pose anterior, e num giro lento a diferença entre as duas é de
     poucos pixels. Poucos pixels alternando a 30 Hz é exatamente a definição de
     tremido. Um reflexo é uma imagem ESPELHADA da cena; ele não pode atrasar em
     relação ao que a espelha, nem por um quadro. */

  const size = renderer.getSize(new THREE.Vector2());
  const pr = renderer.getPixelRatio();
  const w = Math.max(2, Math.min(MAX_DIM, Math.round(size.x * pr * SCALE)));
  const h = Math.max(2, Math.min(MAX_DIM, Math.round(size.y * pr * SCALE)));
  const rt = ensureTarget(w, h);

  /* ---- a câmera espelhada ----
     Posição e mira refletidas no plano, e o `up` refletido junto. A reflexão é
     uma transformação que INVERTE a orientação; construir a câmera por
     `lookAt()` com o `up` já espelhado devolve uma rotação PRÓPRIA que produz a
     mesma imagem — e é isto que evita ter de inverter o descarte de faces, que
     o three não expõe. */
  cam.updateMatrixWorld();
  _rot.extractRotation(cam.matrixWorld);
  /* Espelhar em y é trocar o sinal de y em torno do plano — a forma explícita da
     reflexão do `Reflector`, escrita direto porque a normal aqui é sempre
     (0,1,0) e a álgebra geral não acrescenta nada. */
  _pos.setFromMatrixPosition(cam.matrixWorld);
  _look.set(0, 0, -1).applyMatrix4(_rot).add(_pos);
  _pos.y = 2 * planeY - _pos.y;
  _look.y = 2 * planeY - _look.y;
  /* O `up` refletido é o que torna a rotação PRÓPRIA: `lookAt()` com ele produz
     a imagem espelhada sem inverter o descarte de faces — que o three não expõe
     e que, sem isto, faria toda superfície `FrontSide` sumir do reflexo. */
  _up.copy(UP).applyMatrix4(_rot);
  _up.y = -_up.y;

  reflector.position.copy(_pos);
  reflector.up.copy(_up);
  reflector.lookAt(_look);
  reflector.far = cam.far;
  reflector.updateMatrixWorld();
  /* A projeção é COPIADA e não recomposta: fov, aspecto, near e — o que
     importa — o `setViewOffset()` que a captura em mosaico instala têm de vir
     inteiros da câmera de quem vai desenhar o piso. */
  reflector.projectionMatrix.copy(cam.projectionMatrix);
  reflector.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
  makeOblique(reflector, planeY, 0.004);

  textureMatrix.copy(BIAS)
    .multiply(reflector.projectionMatrix)
    .multiply(reflector.matrixWorldInverse);

  const wasVisible = plane.visible;
  plane.visible = false;
  const prevTarget = renderer.getRenderTarget();
  const prevShadow = renderer.shadowMap.autoUpdate;
  /* O DEGRAU 'lod', E SÓ NA CÂMERA VIVA. Ver o bloco do modo 'lod' lá em cima:
     a captura passa uma câmera própria e continua desenhando a cena inteira,
     porque a foto sai sempre no teto. */
  const lod = cam === liveCamera && getProfile().floorReflection === 'lod';
  /* ⚠️ E O MAPA DE SOMBRA NÃO PODE SER ASSADO COM A CENA PODADA.
     `WebGLShadowMap.render()` só sai cedo quando `autoUpdate` E `needsUpdate`
     são AMBOS falsos (three r179). Ou seja, num quadro em que alguém invalidou a
     sombra, o `renderer.render()` desta passada assa o mapa — e limpa
     `needsUpdate` —, e o quadro principal reusa esse mapa. Sem LOD isso é uma
     economia legítima (é a mesma geometria); COM LOD seria um mapa de sombra sem
     a ferragem, produzido por uma passada que ninguém olha. Devolver a bandeira
     faz o quadro principal reassá-lo com a cena inteira. Só no ramo `lod`, para
     o caminho de sempre continuar pagando um assado e não dois — e o custo extra
     é raro por construção, porque `shadowMap.autoUpdate` é false e a
     invalidação de sombra é por borda, não por quadro. */
  const prevShadowNeeds = renderer.shadowMap.needsUpdate;
  /* ⚠️ `try/finally` E NÃO TRÊS LINHAS SOLTAS, e o `finally` já era necessário
     ANTES do LOD: `plane.visible = false` e o alvo de render estavam sendo
     restaurados por atribuição direta depois do `render()`, então uma exceção
     lá dentro (um material com `onBeforeCompile` quebrado, uma textura solta)
     deixava o piso do estúdio INVISÍVEL e o renderer apontando para o alvo do
     reflexo pelo resto da sessão. */
  try {
    if (lod) lodHide();
    /* O mapa de sombra é o da cena, já corrente. Refazê-lo para a passada de
       reflexo dobraria o custo por uma diferença que a metade da resolução e o
       borrão por distância não carregam. */
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, reflector);
  } finally {
    lodRestore();
    renderer.setRenderTarget(prevTarget);
    renderer.shadowMap.autoUpdate = prevShadow;
    if (lod && prevShadowNeeds) renderer.shadowMap.needsUpdate = true;
    plane.visible = wasVisible;
  }
  uniforms.reflectStrength.value = 1;
}

/* ---------------- a injeção no material ----------------
   Um `MeshStandardMaterial` normal — com luz, sombra e cor própria — que ganha
   um termo a mais no fim: somado, não misturado, porque um reflexo especular
   ACRESCENTA energia à superfície em vez de substituir o albedo dela. */
export function installFloorReflection(mat: THREE.MeshStandardMaterial) {
  if (clients.has(mat)) return;
  clients.add(mat);
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, rendererRef) => {
    prev?.call(mat, shader, rendererRef);
    shader.uniforms.tReflect = uniforms.tReflect;
    shader.uniforms.reflectMatrix = uniforms.reflectMatrix;
    shader.uniforms.reflectStrength = uniforms.reflectStrength;
    shader.uniforms.reflectBlur = uniforms.reflectBlur;
    shader.uniforms.reflectFade = uniforms.reflectFade;
    shader.uniforms.contactBox = uniforms.contactBox;
    shader.uniforms.contactAo = uniforms.contactAo;

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform mat4 reflectMatrix;
        varying vec4 vReflectCoord;
        varying vec3 vWorldPos;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 wp = modelMatrix * vec4(transformed, 1.0);
        vWorldPos = wp.xyz;
        vReflectCoord = reflectMatrix * wp;`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tReflect;
        uniform float reflectStrength;
        uniform float reflectBlur;
        uniform vec4 reflectFade;
        uniform vec4 contactBox;
        uniform vec2 contactAo;
        varying vec4 vReflectCoord;
        varying vec3 vWorldPos;
        /* Quanto do hemisfério o veículo tapa neste ponto do chão. 1 = céu
           livre. A distância é a de um RETÂNGULO (zero dentro dele), porque a
           pegada de um conjunto de 19 x 2,6 m não é um disco — com raio
           euclidiano a oclusão viraria uma poça redonda sob uma carreta reta. */
        float tsContact(vec2 p) {
          if (contactBox.z <= 0.0 || contactAo.x <= 0.0) return 1.0;
          vec2 q = abs(p - contactBox.xy) - contactBox.zw;
          float d = length(max(q, vec2(0.0)));
          return 1.0 - contactAo.x * (1.0 - smoothstep(0.0, contactAo.y, d));
        }
        /* A mesma variação de baixa frequência que paintGloss() escreve no
           albedo por vértice, aqui por fragmento. As duas descrevem a mesma
           laje, então valem os mesmos períodos — mudá-los de um lado só faria a
           mancha de brilho andar em relação à mancha de cor. */
        float tsFloorMottle(vec2 p) {
          return sin(p.x * 0.137 + p.y * 0.089) * cos(p.y * 0.113 - p.x * 0.071) * 0.62
               + sin(p.x * 0.481 - p.y * 0.377) * 0.38;
        }`)
      /* ---- A RUGOSIDADE NÃO É CONSTANTE, e é ela que resolve a EMENDA ----
         O defeito relatado nas emendas não era de geometria: piso e parede já
         se encontram no mesmo valor. Era de MATERIAL — um piso espelhado que
         termina numa linha reta contra uma parede fosca denuncia as duas como
         superfícies separadas, porque na vida real o brilho morre antes da
         junta (é ali que o piso é menos polido e mais sujo, e é ali que a
         parede começa a sombreá-lo).

         Então a rugosidade sobe rumo ao rodapé, junto com o reflexo, e o piso
         chega fosco à concordância. A variação por manchas na mesma linha é a
         outra metade: polimento de verdade abre mais em umas faixas que em
         outras, e um brilho perfeitamente uniforme em 92 m não existe. */
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        {
          vec2 rel = abs(vWorldPos.xz - reflectFade.xy);
          float edge = smoothstep(reflectFade.z, reflectFade.w, max(rel.x, rel.y));
          float m = tsFloorMottle(vWorldPos.xz);
          roughnessFactor = clamp(roughnessFactor * (1.0 + 0.42 * m) + 0.55 * edge, 0.02, 1.0);
        }`)
      /* ---- A OCLUSÃO DE CONTATO, E POR QUE ELA VAI EM `<aomap_fragment>` ----
         O QUE ELA CONSERTA: nas fotos da bancada o conjunto NÃO ENCOSTAVA no
         chão. Havia sombra de mapa sob ele, e mesmo assim ele flutuava — porque
         o mapa cobre só a luz DIRECIONAL. O hemi, o ambiente e o IBL chegavam
         debaixo de uma carreta de 19 x 2,6 m com a mesma força que têm no meio
         da sala, e num estúdio esses três são a maior parte da luz que o piso
         recebe. O que o olho lê como "está apoiado" é justamente a ausência
         deles: a fresta entre dois corpos não enxerga o hemisfério.

         `<aomap_fragment>` é o ponto certo por definição, e não por
         conveniência: é lá que o three aplica oclusão, e ele a aplica em
         `reflectedLight.indirectDiffuse` e `indirectSpecular` — o ambiente —
         deixando as luzes diretas intactas. Uma oclusão que também comesse a
         chave estaria escurecendo duas vezes a mesma sombra.

         E ELA MATA O REFLEXO JUNTO, mais abaixo (`k *= ao`): um piso
         espelhando o teto do estúdio bem embaixo do eixo traseiro é a outra
         metade do mesmo erro geométrico. */
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
        {
          float tsAo = tsContact(vWorldPos.xz);
          reflectedLight.indirectDiffuse *= tsAo;
          reflectedLight.indirectSpecular *= tsAo;
        }`)
      /* ANTES DO TONEMAP, E EM `gl_FragColor`. Este ponto de injeção não é
         escolha de estilo: `outgoingLight` é DECLARADO dentro de
         `<opaque_fragment>`, que na mesma linha já o grava em `gl_FragColor` —
         somar nele depois disso é escrever numa variável que ninguém mais lê, e
         o sintoma é um piso sem reflexo nenhum e sem erro de compilação. Somar
         em `gl_FragColor.rgb` imediatamente antes de `<tonemapping_fragment>`
         põe o reflexo exatamente onde ele pertence: ainda linear, ainda sujeito
         à mesma curva ACES que o resto do quadro. */
      .replace('#include <tonemapping_fragment>', `
        {
          /* Fora do frustum da câmera espelhada não há informação: w <= 0 é o
             que está atrás dela, e ali o reflexo tem de ser ZERO em vez de um
             ladrilho da borda. */
          float w = max(vReflectCoord.w, 1e-4);
          vec2 ruv = vReflectCoord.xy / w;

          /* ---- A LAJE NÃO É UM PLANO ----
             Nenhum piso de concreto polido é plano: ele ondula alguns
             milímetros por metro, e é ESSA ondulação que faz o reflexo de um
             showroom serpentear em vez de ser um espelho perfeito. Sem ela o
             chão lê como gelo — que foi a primeira leitura desta cena.

             A ondulação é aplicada na COORDENADA DO REFLEXO e não na geometria,
             e isso é deliberado: deformar a malha mexeria no plano em que o
             pneu se apoia e na sombra de contato, para ganhar o mesmo efeito. O
             que o olho lê como "chão ondulado" é o reflexo entortando, não o
             chão subindo.

             Duas oitavas, em metros de mundo, com períodos primos entre si
             (~30 m e ~9 m) para não fechar padrão dentro da sala. */
          vec2 wob = vec2(
            sin(vWorldPos.x * 0.21 + vWorldPos.z * 0.13)
              + 0.45 * sin(vWorldPos.x * 0.68 - vWorldPos.z * 0.51),
            cos(vWorldPos.z * 0.17 - vWorldPos.x * 0.11)
              + 0.45 * cos(vWorldPos.z * 0.73 + vWorldPos.x * 0.44));
          ruv += wob * 0.0022;
          /* O BORRÃO ABRE COM A DISTÂNCIA: d é a distância do fragmento à
             câmera; um piso encerado tem o reflexo nítido no contato e aberto
             no fundo, e é essa abertura que separa "polido" de "espelho".

             UMA LEITURA, com nível de mipmap fracionário. O nível é o logaritmo
             da abertura porque cada nível dobra o raio do filtro — é por isso
             que uma pirâmide dá um borrão CONTÍNUO onde N amostras dão N cópias.

             0,12 E TETO 4,0, e não os 0,34 e 5,0 da primeira calibração. Aqueles
             punham o nível 3 já aos 15 m — uma textura de 90 x 56 pixels — e o
             reflexo deixava de ser uma imagem para virar mancha: o que aparecia
             sob o caminhão era um borrão claro, não o caminhão. Um reflexo tem
             de ser RECONHECÍVEL; é ele que diz de quem é o chão. O borrão que se
             quer é o de um piso encerado, que ainda deixa ler a forma. */
          float d = length(vWorldPos - cameraPosition);
          float lod = clamp(log2(1.0 + d * 0.12 * reflectBlur), 0.0, 4.0);
          vec3 acc = textureLod(tReflect, ruv, lod).rgb;
          /* FRESNEL. Rasante reflete quase tudo, de cima quase nada — é o que
             faz o reflexo aparecer esticado quando a câmera baixa, que é
             exatamente a leitura da foto de referência.

             EXPOENTE 3 E PISO 0,10, e não a curva de Schlick pura (expoente 5,
             piso 0,04). Concreto polido não é vidro: ele tem uma camada de
             verniz sobre um substrato claro que espalha, então mesmo de cima ele
             devolve imagem — é por isso que se enxerga o caminhão no chão de um
             showroom olhando de pé. A curva ideal punha o reflexo em 4 % na pose
             de catálogo, que é o mesmo que não ter reflexo. */
          vec3 V = normalize(cameraPosition - vWorldPos);
          float f = pow(1.0 - clamp(dot(V, vec3(0.0, 1.0, 0.0)), 0.0, 1.0), 3.0);
          /* O TETO É 0,42, E NÃO 1,0. Com o rasante indo a 1,0 o piso vira
             ESPELHO: o caminhão aparece embaixo com o mesmo valor de cima, e o
             que se lê é uma lâmina d'água, não concreto. Um piso encerado
             devolve menos da metade mesmo no ângulo mais raso, porque o verniz
             espalha o que o substrato claro não absorve. MEDIDO: a 0,62 a faixa
             média do piso subia para 202 de luminância contra os ~165 do piso
             seco — ou seja o reflexo passava a ser mais claro que o chão. */
          float k = reflectStrength * mix(0.07, 0.42, f);
          /* E CAI COM A DISTÂNCIA. O reflexo de um objeto distante percorreu um
             caminho longo dentro do lobo especular e chega diluído; sem esta
             queda o fundo da sala reflete com a mesma força que o pé do pneu, e
             o piso perde a profundidade. */
          k /= 1.0 + d * 0.018;
          /* Dentro do quadro, e só. */
          vec2 edge = smoothstep(vec2(0.0), vec2(0.04), ruv)
                    * smoothstep(vec2(0.0), vec2(0.04), 1.0 - ruv);
          k *= edge.x * edge.y * step(0.0, vReflectCoord.w);
          /* E MORRE ANTES DO RODAPÉ. Um espelho que termina numa linha reta
             contra a parede denuncia o truque; o piso de um estúdio perde o
             brilho conforme se aproxima da concordância, porque é ali que ele
             está mais sujo e menos polido. A medida é de Chebyshev pelo mesmo
             motivo da clareada do piso: o que ele tem de acompanhar é o pé da
             parede, e o pé da parede é um quadrado. */
          vec2 rel = abs(vWorldPos.xz - reflectFade.xy);
          k *= 1.0 - smoothstep(reflectFade.z, reflectFade.w, max(rel.x, rel.y));
          /* E O CONTATO. Ver o bloco da oclusão de contato lá em cima: o chão
             embaixo do eixo traseiro não enxerga o teto do estúdio, então não
             tem como devolvê-lo.
             SEM CRASE NESTE COMENTÁRIO, e não é estilo: ele mora DENTRO de um
             template literal de JavaScript, e uma crase aqui o encerra no meio
             do GLSL. O tsc passa (o que sobra continua sendo JS válido) e o
             sintoma é um TypeError em tempo de render — a bancada inteira
             mediu zero por causa de uma. */
          k *= tsContact(vWorldPos.xz);
          gl_FragColor.rgb += acc * k;
        }
        #include <dithering_fragment>`);
  };
  mat.needsUpdate = true;
}

/** Tira o material da lista — chamado no dispose do dono. */
export function uninstallFloorReflection(mat: THREE.MeshStandardMaterial) {
  clients.delete(mat);
}

/**
 * Liga/desliga a passada. Desligada, o termo some do piso (o uniforme vai a
 * zero) e nenhuma renderização extra acontece.
 */
export function setFloorReflection(on: boolean) {
  enabled = on;
  if (!on) uniforms.reflectStrength.value = 0;
}

/** @returns {boolean} */
export const isFloorReflectionOn = () => enabled;

/** Quanto do reflexo entra: 1 = como autorado. Segue a pastilha de fundo. */
export function setFloorReflectionAmount(v: number) {
  uniforms.reflectBlur.value = 1;
  uniforms.reflectStrength.value = Math.max(0, v);
}

/**
 * Onde o reflexo cede e onde ele zera, em meio-lado a partir de (`cx`, `cz`).
 * É o dono do piso quem chama: só ele sabe onde a parede está.
 */
export function setFloorReflectionFade(cx: number, cz: number, inner: number, outer: number) {
  uniforms.reflectFade.value.set(cx, cz, inner, outer);
}

/**
 * A pegada do veículo, para a oclusão de contato do piso. Ver o bloco dela no
 * shader. `hx <= 0` desliga (nenhum veículo em cena).
 */
export function setFloorContact(cx: number, cz: number, hx: number, hz: number) {
  uniforms.contactBox.value.set(cx, cz, Math.max(0, hx), Math.max(0, hz));
}

/**
 * Fração da resolução do canvas usada no alvo. Existe para a bancada MEDIR se o
 * custo do reflexo é de geometria ou de preenchimento — MEDIDO: 14,1 fps a meio
 * lado contra 14,7 a um quarto, ou seja o gargalo é a segunda varredura de
 * geometria e resolução não resolve. Fica como instrumento, não como ajuste.
 *
 * É DESTA MEDIÇÃO que sai a forma do modo `'lod'`: um quarto de lado é 1/4 dos
 * fragmentos e devolveu 0,6 fps, então o degrau intermediário tira OBJETOS.
 */
export function setFloorReflectionScale(s: number) {
  const v = THREE.MathUtils.clamp(s, 0.1, 1);
  if (v === SCALE) return;
  SCALE = v;
  target.rt?.dispose();
  target.rt = null;
  target.w = target.h = 0;
}

/** O alvo cru, para diagnóstico. `null` antes da primeira passada. */
export const floorReflectionTarget = () => target.rt;

/** Libera o alvo E esquece os clientes. Chamado quando o estúdio solta a cena.
 *  Para soltar só a memória, mantendo a injeção de pé, ver
 *  `releaseFloorReflectionTarget()`. */
export function disposeFloorReflection() {
  releaseFloorReflectionTarget();
  clients.clear();
}

/** A câmera viva, para quem só quer a passada padrão. */
export const liveReflectionCamera = () => liveCamera;
