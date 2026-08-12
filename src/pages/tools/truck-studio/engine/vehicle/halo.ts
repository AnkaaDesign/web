/* O HALO — a luz que vaza da lanterna para o pixel do lado.
   ===========================================================================
   O PEDIDO, em três relatos que são o MESMO defeito: *"possui o feixo de luz, mas
   nao indica na propria lanterna"* (o farol), *"essas lanternas secundarias,
   laterais do cavalo tambem devem estar acessas"* (as da saia, que já ESTAVAM
   acesas e medidas em `emiInt 6,5`), e *"essa lanterna do implemento nao emite
   luz, ela deveria mostrar um pouco da luz ao redor dela, sutil, mas deveria"*.

   Os três descrevem a mesma ausência. Uma lanterna acesa neste motor é um
   emissivo: o fragmento DELA fica claro e o pixel vizinho não muda em nada.
   Numa foto de verdade a lente estoura e derrama — é o borrão que diz ao olho
   "isto é uma fonte, não um adesivo branco". Sem ele, uma lente a 40 de
   radiância e um decalque branco pintado desenham o mesmo pixel.

   ===========================================================================
   POR QUE NÃO É `SpotLight`, E POR QUE NÃO É BLOOM.

   `SpotLight` está fora por contagem: `NUM_SPOT_LIGHTS` é chave de cache de
   programa de TODO material da cena (ver o cabeçalho de `scene/lamps.ts`), o pool
   é fixo em 12 e as 6 vagas do veículo já estão tomadas — 2 faróis, 2 da cauda e
   2 da traseira do cavalo. Um implemento tem 30 lanternas; não há vaga e não pode
   haver, porque criar uma recompila a cena inteira no quadro em que ela aparece.

   Bloom foi oferecido e recusado: ele resolveria, e cobra a composição inteira —
   o céu, o cromado, o inox e as fotos de DIA dos 58 chassis passariam a florescer
   junto, e o `EffectComposer` acrescenta passes sobre um implemento que já faz
   2 157 chamadas de desenho.

   O que sobra é o que a maioria dos configuradores faz e é suficiente para foto
   de produto: um QUADRADO ADITIVO virado para a câmera em cima de cada lanterna.
   Não ilumina nada — e não deve: quem ilumina é `beams.ts`. Ele desenha o
   derrame.

   ===========================================================================
   UMA CHAMADA DE DESENHO PARA TODAS, e é por isso que é `InstancedMesh`.

   São ~40 lanternas num comboio. Quarenta `Sprite` seriam quarenta chamadas de
   desenho por quadro para desenhar quarenta quadrados de duas faces. Uma
   `InstancedMesh` com dois atributos por instância (cor e raio) é UMA, e o
   billboard sai de graça no vértice — que é onde ele deveria estar de qualquer
   forma, porque `Sprite` refaz a conta na CPU.

   ⚠️ **E O QUADRADO É EMPURRADO PARA A CÂMERA, EM ESPAÇO DE VISTA.** Um billboard
   centrado no meio da lente tem metade de si DENTRO da carcaça, e o teste de
   profundidade corta essa metade: o halo aparece cortado ao meio, e o corte gira
   junto com a câmera. Somar alguns centímetros em `mvPosition.z` resolve para
   QUALQUER ângulo — é sempre "na direção do olho" — e continua deixando o teste
   de profundidade esconder o halo quando a lanterna está atrás do baú, que é o
   que separa isto de um decalque que atravessa o caminhão.

   ⚠️ **A COR VAI EM sRGB, CRUA.** Este material não tem `<tonemapping_fragment>`
   nem `<colorspace_fragment>`: ele soma no framebuffer, que a essa altura já está
   tonemapeado e codificado. Passar a cor pelo `THREE.Color` (que converte para o
   espaço linear de trabalho) faria o halo vermelho sair marrom. Os três bytes do
   hexa entram como estão — ver `corSRGB()`.

   ⚠️ NADA DE CRASE NOS BLOCOS DE GLSL — são template strings de JS, e uma crase
   de citação em comentário fecha o literal. Já quebrou o bundle quatro vezes
   neste projeto: o `tsc` acusa TS1005 e a bancada mede o binário velho. */
import * as THREE from 'three';

/**
 * Onde um halo fica. Em MUNDO, porque é assim que `lights.ts` mede.
 *
 * Um sítio é um AGLOMERADO de lâmpada e não um material: quem os separa é
 * `sitiosDaMalha()` em `lights.ts`, e o bloco de lá explica por quê (uma
 * primitiva do FH carrega as DUAS lanternas traseiras).
 */
export interface HaloSite {
  x: number; y: number; z: number;
  /**
   * Meia-medidas da lâmpada, em metros: `rx` ao longo da horizontal, `ry` na
   * vertical. O halo é um múltiplo delas.
   *
   * ⚠️ **DUAS E NÃO UMA, e o motivo é medido.** A versão anterior tirava um raio
   * único da SEGUNDA maior medida do aglomerado, e numa lanterna traseira de
   * 0,50 x 0,13 x 0,08 m essa segunda maior é a ALTURA: o halo saía com 0,18 m de
   * raio sobre uma lente de meio metro, ou seja **menor que a própria lanterna**.
   * Daí o relato *"o halo das lanternas principais esta muito sutil"* — ele não
   * estava fraco, estava pequeno. Com duas medidas o borrão acompanha a forma da
   * lente, e uma barra de LED larga ganha um derrame largo sem que a delimitadora
   * de 5 cm ao lado vire um farolete.
   */
  rx: number; ry: number;
  /** A cor resolvida da lâmpada, em hexa sRGB. */
  cor: number;
  /** De qual material ele veio. SÓ diagnóstico — a bancada precisa disso para
   *  dizer QUAL lanterna produziu um halo fora do lugar. */
  de?: string;
}

/**
 * Quantas vezes o raio da lâmpada o halo mede.
 *
 * 3,4 sobre uma lanterna de 5 cm dá um borrão de 17 cm de raio — grande o
 * bastante para o olho ler derrame e pequeno o bastante para as cinco lanternas
 * da saia não virarem uma faixa contínua (medido: elas ficam a ~1,1 m uma da
 * outra). O halo do farol sai maior porque a lâmpada é maior, que é o certo.
 */
const HALO_ESCALA = 3.2;
/** Tetos do halo, para um conjunto óptico grande não virar um farolete. */
const HALO_RX_MAX = 0.46, HALO_RY_MAX = 0.30;
/*
 * ⚠️ O QUE GOVERNA ESTES TRÊS NÚMEROS É O BLENDING, NÃO O GOSTO — e eles já foram
 * longe demais nas duas direções, o que vale registrar para não voltar.
 *
 * Com 3,4 / 0,55 / 0,42 E HALOS SOBREPOSTOS o resultado saturava:
 * `AdditiveBlending` soma, então dois halos âmbar no mesmo pixel dão 0,84 no
 * vermelho e 0,46 no verde, e três dão branco. Foi o *"as luzes parecem estar
 * flutuando"* e o *"a luz da lanterna lateral indo ate o frame superior"*.
 *
 * Baixar tudo para 2,2 / 0,24 / 0,30 tirou o branco e APAGOU junto o derrame que
 * o implemento já tinha de bom — *"as lanternas do implemento que estavam legais,
 * com uma luz, blur, nao estao mais"*.
 *
 * O erro não estava no tamanho, estava na SOBREPOSIÇÃO. Com um halo por PEÇA
 * aglomerada (ver `sitiosDaMalha()` em lights.ts) dois halos não caem mais no
 * mesmo pixel, e aí o derrame pode voltar a ser visível sem somar.
 */

/**
 * Pico do derrame, com a lanterna a pleno.
 *
 * 0,38 e não 1: o halo SOMA num framebuffer que já está em [0,1], então 1 no
 * miolo apagaria o desenho da lente por baixo e a lanterna viraria um disco
 * branco — exatamente o oposto do *"sutil, mas deveria"* do pedido. Em 0,38 o
 * miolo continua sendo a lente e o que se vê em volta é o vazamento.
 */
const HALO_PICO = 0.52;

/** Quanto o quadrado avança para a câmera, em metros de espaço de vista. */
const HALO_AVANCO = 0.07;

/* O quadrado é desenhado DEPOIS do vidro (que `material-setup.ts` põe em 20),
   porque um halo é sempre o que está mais perto do olho naquele ponto — ele
   acabou de ser empurrado para lá. */
const HALO_RENDER_ORDER = 30;

const VERT = /* glsl */`
attribute vec3 haloCor;
attribute vec2 haloRaio;
varying vec2 vHaloUv;
varying vec3 vHaloCor;
void main() {
  vHaloUv = uv;
  vHaloCor = haloCor;
  /* Só a TRANSLAÇÃO da instância interessa: a orientação do quadrado é a da
     câmera, e escala vem de haloRaio. Ler a coluna 3 evita decompor a matriz. */
  vec3 centro = vec3( instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2] );
  vec4 mv = modelViewMatrix * vec4( centro, 1.0 );
  mv.xy += position.xy * haloRaio * 2.0;   // vec2: largura e altura próprias
  mv.z += HALO_AVANCO;
  gl_Position = projectionMatrix * mv;
}
`;

/* A queda: 1 no centro, 0 na borda, ao quadrado. O quadrado é o que dá o miolo
   concentrado com a saia larga — uma queda linear desenha um disco com borda
   visível, que lê como adesivo redondo e não como luz. */
const FRAG = /* glsl */`
varying vec2 vHaloUv;
varying vec3 vHaloCor;
uniform float haloNivel;
void main() {
  float d = min( 1.0, length( vHaloUv - 0.5 ) * 2.0 );
  float a = 1.0 - d;
  a *= a;
  gl_FragColor = vec4( vHaloCor, a * haloNivel );
}
`;

let grupo: THREE.Group | null = null;
let malha: THREE.InstancedMesh | null = null;
let geo: THREE.PlaneGeometry | null = null;
let mat: THREE.ShaderMaterial | null = null;
const uNivel = { value: 0 };
let quantos = 0;

/**
 * Os três bytes do hexa, sem passar pelo `ColorManagement`.
 *
 * `THREE.Color.setHex()` converte de sRGB para o espaço linear de trabalho, e é
 * o certo para um material que vai ser tonemapeado. Este não vai — ver o
 * cabeçalho.
 */
function corSRGB(hex: number, destino: Float32Array, i: number) {
  destino[i] = ((hex >> 16) & 255) / 255;
  destino[i + 1] = ((hex >> 8) & 255) / 255;
  destino[i + 2] = (hex & 255) / 255;
}

const _m = new THREE.Matrix4();

/**
 * Refaz a malha de halos a partir dos sítios de TODAS as raízes vivas.
 *
 * Chamada por `setVehicleLightsLevel()`, e só quando alguma raiz foi remedida —
 * uma realocação por quadro durante o arrasto do controle de hora seria escrever
 * o mesmo conteúdo sessenta vezes por segundo. O que anda com a hora é `uNivel`.
 *
 * @param sitios em mundo, já com a cor resolvida.
 * @param pai onde pendurar o grupo. Tem de ser a CENA e não o `RIG`: os sítios
 *   estão em mundo, e o rig carrega um giro de 180° e um recuo de 4 m
 *   (`RIG_PLACEMENT`) que os desmontaria. Mesma doutrina dos vidros de cenário
 *   em `scene/lamps.ts`.
 */
export function rebuildLampHalos(sitios: HaloSite[], pai: THREE.Object3D | null) {
  quantos = sitios.length;
  ultimos = sitios.slice();
  if (!sitios.length) {
    if (malha) malha.count = 0;
    return 0;
  }
  if (!pai) return 0;
  if (!geo) {
    /* 1 x 1 centrado, então `position.xy` vai de −0,5 a 0,5 e o vértice
       multiplica direto pelo diâmetro. */
    geo = new THREE.PlaneGeometry(1, 1);
  }
  if (!mat) {
    mat = new THREE.ShaderMaterial({
      vertexShader: VERT.replace(/HALO_AVANCO/g, HALO_AVANCO.toFixed(4)),
      fragmentShader: FRAG,
      uniforms: { haloNivel: uNivel },
      transparent: true,
      blending: THREE.AdditiveBlending,
      /* NÃO escreve profundidade (senão o halo de uma lanterna recortaria o da
         vizinha) e CONTINUA testando (para o halo sumir atrás do baú). */
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
    });
  }
  if (!grupo) {
    grupo = new THREE.Group();
    grupo.name = 'ts-lamp-halos';
    /* Fora do enquadramento e das medidas: `frameAll()`, a sonda de reflexo e o
       atravessar todos medem caixas, e um halo é uma mancha que não é o produto.
       `Layers` seria a alavanca fina; a caixa é o que de fato incomoda, e
       `Box3.setFromObject()` respeita `visible` mas não layers — então o que
       resolve é o halo nunca entrar numa árvore que alguém mede. Ele pendura na
       CENA, ao lado do RIG, e nada que mede o veículo o alcança. */
  }
  if (grupo.parent !== pai) pai.add(grupo);

  /* Só realoca quando não CABE: uma `InstancedMesh` não cresce, então a
     capacidade sobe em degraus e trocar de cavalo (ou alongar o baú) reusa o
     buffer na esmagadora maioria das vezes. */
  if (malha && sitios.length > malha.instanceMatrix.count) {
    grupo.remove(malha);
    malha.dispose();
    malha = null;
  }
  if (!malha) {
    const cap = Math.max(32, sitios.length * 2);
    malha = new THREE.InstancedMesh(geo, mat, cap);
    malha.name = 'ts-lamp-halos-mesh';
    malha.frustumCulled = false;      // a caixa da instância não cobre o billboard
    malha.castShadow = false;
    malha.receiveShadow = false;
    malha.renderOrder = HALO_RENDER_ORDER;
    malha.geometry.setAttribute('haloCor',
      new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3));
    malha.geometry.setAttribute('haloRaio',
      new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2));
    grupo.add(malha);
  }

  const cores = malha.geometry.getAttribute('haloCor') as THREE.InstancedBufferAttribute;
  const raios = malha.geometry.getAttribute('haloRaio') as THREE.InstancedBufferAttribute;
  const bufCor = cores.array as Float32Array;
  const bufRaio = raios.array as Float32Array;
  sitios.forEach((s, i) => {
    _m.makeTranslation(s.x, s.y, s.z);
    malha!.setMatrixAt(i, _m);
    corSRGB(s.cor, bufCor, i * 3);
    bufRaio[i * 2] = Math.min(HALO_RX_MAX, s.rx * HALO_ESCALA);
    bufRaio[i * 2 + 1] = Math.min(HALO_RY_MAX, s.ry * HALO_ESCALA);
  });
  malha.count = sitios.length;
  malha.instanceMatrix.needsUpdate = true;
  cores.needsUpdate = true;
  raios.needsUpdate = true;
  return sitios.length;
}

/** Acende/apaga o derrame. `n` é o mesmo `rig.vehLights` da lâmpada. */
export function setLampHaloLevel(n: number) {
  uNivel.value = THREE.MathUtils.clamp(n, 0, 1) * HALO_PICO;
}

/* As posições, guardadas só para o diagnóstico. É delas que sai a trava mais
   importante deste módulo: a bancada mede a distância de cada halo ao vértice de
   lâmpada mais próximo, e um halo a mais de um palmo de qualquer lâmpada É o
   defeito *"luzes flutuando"*. Sem expor a posição, aquilo só se pega olhando. */
let ultimos: HaloSite[] = [];

/** Para o console e para a bancada. */
export function getLampHalos() {
  return {
    sitios: quantos,
    desenhados: malha ? malha.count : 0,
    nivel: Math.round((uNivel.value / HALO_PICO) * 100) / 100,
    pico: HALO_PICO,
    escala: HALO_ESCALA,
    raioMax: [HALO_RX_MAX, HALO_RY_MAX],
    naCena: !!grupo && !!grupo.parent,
    posicoes: ultimos.map((s) => ({
      p: [s.x, s.y, s.z].map((v) => Math.round(v * 1000) / 1000),
      r: [Math.min(HALO_RX_MAX, s.rx * HALO_ESCALA),
        Math.min(HALO_RY_MAX, s.ry * HALO_ESCALA)].map((v) => Math.round(v * 1000) / 1000),
      cor: s.cor.toString(16).padStart(6, '0'),
      de: s.de || '?',
    })),
  };
}
