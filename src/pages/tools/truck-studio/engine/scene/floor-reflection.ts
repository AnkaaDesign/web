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
      `getProfile().floorReflection` vale `'full' | 'lod' | 'off'`. O `'off'` é
      tratado por `cyclorama.ts` (o gancho de quadro nem chama esta passada) e
      aqui, soltando o ALVO. O `'lod'` era o degrau do meio e foi ARRANCADO em
      2026-08-16 — ver a lápide dele lá embaixo, que explica por que a medição
      que o justificava continua certa e mesmo assim ele saiu.

   ⚠️⚠️ **ELA SÓ EXISTE NO CENÁRIO ESTÚDIO**, e isso muda quem é afetado por
      tudo que se escreve aqui. São TRÊS cenários no acervo
      (`public/environments/environments.json`): `distrito-industrial`, `serra` e
      `estudio`, e só o último acende o ciclorama. Quem roda no distrito ou na
      serra não paga um milissegundo desta passada — e, simetricamente, nenhum
      conserto feito aqui responde a uma queixa de fluidez vinda de lá.

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
/* ⚠️ `s` (as amostras do alvo) ENTRA NA CHAVE DO CACHE junto com `w`/`h`, e essa
   é a única razão de este objeto ter um campo novo. `samples` é parâmetro de
   CONSTRUTOR de `WebGLRenderTarget`: escrevê-lo num alvo já criado não realoca o
   renderbuffer multiamostrado, então um cache que só comparasse dimensões
   entregaria para sempre o alvo do nível em que a página abriu — que é
   exatamente a classe de defeito ("o botão não faz nada") que a §0 de
   `OTIMIZACAO-2026-08-14.md` documenta cinco vezes. */
const target = { rt: null as THREE.WebGLRenderTarget | null, w: 0, h: 0, s: -1 };
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
const _size = new THREE.Vector2();
const UP = new THREE.Vector3(0, 1, 0);

/* ===========================================================================
   ⚰️ O MODO 'lod' — LÁPIDE. ARRANCADO EM 2026-08-16.
   ===========================================================================
   Ele existia para tirar GEOMETRIA da segunda varredura: um plano de corte que
   escondia, só durante esta passada, toda malha cuja SEGUNDA MAIOR ARESTA em
   espaço de mundo fosse menor que 8 cm — a largura que o mip lido pelo piso
   (1,03 a 1,88 dentro da órbita de 8,6–22,4 m) não consegue resolver.

   POR QUE A MEDIÇÃO QUE O JUSTIFICAVA CONTINUA CERTA E MESMO ASSIM ELE SAIU.
   A medição era **14,1 fps a meio lado do alvo contra 14,7 a um quarto**: um
   quarto de lado é 1/4 dos fragmentos e devolveu 0,6 fps, logo o gargalo desta
   passada NÃO era preenchimento — era a segunda varredura de GEOMETRIA. Ela foi
   tirada com **1 968 malhas separadas** submetendo ~1 968 chamadas por passada.
   Com `mergeVehicle: 'all'` o implemento virou **45 baldes por material**, e a
   passada de reflexo submete hoje ~45 chamadas. **O chão da medição mudou; a
   conclusão dela não sobrevive à mudança de chão.**

   E o filtro deixou de filtrar junto: `collectThin()` media a segunda aresta da
   caixa de cada malha, e um balde fundido abraça o trailer inteiro — METROS de
   segunda aresta. Ele parou de esconder qualquer coisa do veículo e ficou só com
   o refugo do cenário, que no Estúdio (o único cenário onde esta passada roda,
   ver `cyclorama.ts`) é o conjunto vazio.

   O QUE SOBRAVA ERA SÓ CUSTO, e ele tinha três parcelas, todas pagas por quadro
   ou por meio segundo: `lodPlan()` percorria o grafo de cena INTEIRO a cada
   500 ms medindo caixas envolventes; `lodHide()`/`lodRestore()` escreviam
   `.visible` por candidato por quadro; e o ramo carregava um quarto estado de
   `renderer.shadowMap.needsUpdate` para o mapa de sombra não ser assado a partir
   da cena podada. **É o candidato nomeado para o Portão 3 ter medido o Médio
   (3,61 ms) MAIS LENTO que o Alto (3,23 ms)** — o Médio era o único nível em
   `'lod'`.

   ⚠️ O QUE O RESSUSCITARIA: a fusão sair do ar (`mergeVehicle` em `'off'` ou
   `'floor'`), ou um acervo novo que volte a trazer milhares de primitivas finas
   separadas. Nesse dia o corte de **8 cm** é o número a reusar, e a conta que o
   produz é: mip ~1,9 ⇒ ~3,7 texels de mip 0 por texel lido; lente de 30° sobre
   540 linhas ⇒ 0,0556°/texel; 3,7 × 0,0556° = 0,206°, que a 22,4 m são 8,0 cm. E
   a medida é a SEGUNDA maior aresta, nunca `userData.tsWorldDiameter`: um friso
   de flanco de 14,47 m por 2 cm tem diâmetro enorme e some no reflexo — é a
   largura que o olho lê, e são 27 trilhos assim no implemento.

   ✅ RESOLVIDO em 2026-08-16: `'lod'` SAIU da união de `getProfile().floorReflection`,
   que hoje é `'full' | 'off'`. O `tsc` passou sem uma queixa na remoção, o que é
   a prova de que nenhuma comparação viva contra `'lod'` sobrava em lugar nenhum —
   o valor só existia no tipo, degradando em silêncio.

   ⚠️ E o degrau de MEIO, para quem vier procurar "um jeito de custar menos sem
   sumir com o reflexo", NÃO é ressuscitar isto: é `floorReflectionMsaa` (4 → 0
   são 71 MB, e a mip que este reflexo de fato lê — 1,03 a 1,88 — já é o
   passa-baixa que o MSAA daria). O botão certo já existe; este aqui é o errado.
   =========================================================================== */

/* ---------------- a conta que esta passada nunca teve ----------------
   ⚠️⚠️ **ELA NUNCA FOI CONTABILIZADA POR NINGUÉM, E ESSE É O ACHADO.**

   O `submitTimeEma` do laço cronometra `t1 - t0` em volta de UMA linha —
   `renderer.render(scene, camera)` — e os `drawHooks` rodam ANTES do `t0`. Esta
   passada mora num deles (`cyclorama.ts`), logo ela nunca entrou no canal de
   submissão. A bancada tem o mesmo buraco em outro lugar: o `4,18 ms` da fusão
   mede um `renderer.render()` chamado À MÃO, sem os `drawHooks`. As duas réguas
   somem com a mesma passada, e o quadro de parede — que é a única que a contém —
   não sabe dizer quanto dela é isto.

   O corolário DOI: no cenário Estúdio a razão parede ÷ submissão, que é o que
   `reportFrameTime()` usa para separar "limitado por GPU" de "limitado por CPU",
   está sistematicamente inflada por uma renderização inteira de cena. Um
   diagnóstico de "GPU-bound" tirado lá pode ser só isto.

   Duas leituras de relógio por quadro (~0,1 µs) fecham o buraco. O EMA é o mesmo
   coeficiente do resto do engine. */
let passMs = 0;
let passes = 0;

/** Quanto a segunda passada custou, em ms de SUBMISSÃO, e quantas já rodaram.
 *  `ms` é 0 fora do Estúdio — lá a passada não é chamada. */
export const floorReflectionCost = () => ({ ms: passMs, passes });

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
  /* −1 e não 0: 0 é um número de amostras VÁLIDO (é o "sem multiamostragem" do
     nível Médio), então zerá-lo aqui faria a chave do cache casar por acidente
     com um pedido legítimo. `-1` é o único valor que nenhum perfil pode pedir. */
  target.s = -1;
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

function ensureTarget(w: number, h: number, s: number) {
  if (target.rt && target.w === w && target.h === h && target.s === s) return target.rt;
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
       graça aqui.

       ⚠️ **EM TEMPO ELE É QUASE DE GRAÇA; EM MEMÓRIA ELE É O ITEM.** A
       contabilidade completa dos 96,7 MB, a 1600×1080: 13,8 MB de cor RGBA16F,
       +4,6 de pirâmide de mipmaps, +6,9 de profundidade D24 e **+71,4 MB do
       resolve multiamostrado 4×**. Três quartos do segundo maior item isolado de
       VRAM da cena são ESTA LINHA — e numa integrada de memória compartilhada a
       memória é o que decide se roda, não o tempo.

       Por isso, desde 2026-08-15, ela vem do perfil (`floorReflectionMsaa`: 4 no
       Alto, 0 nos outros dois). O que segura o tremido no Médio é a própria
       leitura do piso: um `textureLod` a mip **1,03–1,88** dentro da órbita de
       8,6–22,4 m já passa o alvo por 2 a 3,7 texels borrados trilinearmente, que
       é o mesmo passa-baixa que o MSAA entrega. Não é equivalente — perto do
       ponto de contato do pneu o mip cai para ~1,0 e a aresta pode aparecer —,
       mas é a maior parte, por 71 MB. Ver o bloco do campo em `core/quality.ts`.

       ⚠️ 0 é "sem multiamostragem" para o three, e `samples` só tem efeito no
       CONSTRUTOR — daí ele entrar na chave do cache em `target.s`. */
    samples: Math.max(0, s | 0),
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
  target.w = w; target.h = h; target.s = s;
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
 * ⚠️ **QUAL DAS DUAS CÂMERAS É O DISCRIMINANTE DO NÍVEL.** A captura constrói
 * `new THREE.PerspectiveCamera()` (scene/capture.ts), que nunca é
 * `=== liveCamera` — e é essa identidade de objeto, sem parâmetro novo e sem
 * mudar assinatura nenhuma, que mantém a FOTO sempre no teto enquanto a viewport
 * obedece ao perfil. Um PC fraco pode ter uma vista sem multiamostragem no
 * reflexo e ainda assim baixar a mesma imagem que o PC bom baixa.
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

  /* ⚠️ `_size` É DE MÓDULO, e não um `new THREE.Vector2()` por chamada.
     `getSize()` ESCREVE no vetor que recebe, então alocar aqui era um objeto de
     lixo por quadro desenhado num caminho que já é o mais quente do cenário mais
     caro. Não vale um milissegundo; vale não somar pressão de coletor a um laço
     cuja queixa é justamente a VARIÂNCIA do quadro, não a média dele. */
  const size = renderer.getSize(_size);
  const pr = renderer.getPixelRatio();
  const w = Math.max(2, Math.min(MAX_DIM, Math.round(size.x * pr * SCALE)));
  const h = Math.max(2, Math.min(MAX_DIM, Math.round(size.y * pr * SCALE)));
  /* ⚠️ A CAPTURA CONTINUA NO TETO. A foto é o produto e sai sempre com a
     assinatura do nível Alto; uma câmera que não é a viva é, por construção, a
     de `scene/capture.ts`. Sem esta linha o Médio baixaria a multiamostragem do
     alvo TAMBÉM na foto, e o reflexo do piso sairia com a silhueta serrilhada
     numa imagem que ninguém pode degradar.

     ⚠️ E ISSO CUSTA DUAS REALOCAÇÕES POR FOTO no nível Médio: uma para subir ao
     teto e outra no primeiro quadro vivo depois. É deliberado, e é barato no
     lugar certo — a captura já roda atrás da própria cortina, é bloqueante e
     desenha um mosaico inteiro. Pagar 25 MB de realocação lá para não serrilhar
     o produto é o mesmo negócio que `ceilingProfile()` faz com o mapa de sombra. */
  const msaa = cam === liveCamera ? Math.max(0, getProfile().floorReflectionMsaa | 0) : 4;
  const rt = ensureTarget(w, h, msaa);

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
  /* ⚠️ `try/finally` E NÃO TRÊS LINHAS SOLTAS: `plane.visible = false` e o alvo
     de render estavam sendo restaurados por atribuição direta depois do
     `render()`, então uma exceção lá dentro (um material com `onBeforeCompile`
     quebrado, uma textura solta) deixava o piso do estúdio INVISÍVEL e o
     renderer apontando para o alvo do reflexo pelo resto da sessão. */
  const t0 = performance.now();
  try {
    /* O mapa de sombra é o da cena, já corrente. Refazê-lo para a passada de
       reflexo dobraria o custo por uma diferença que a metade da resolução e o
       borrão por distância não carregam.

       ⚠️ E ISTO NÃO IMPEDE O ASSADO: `WebGLShadowMap.render()` só sai cedo
       quando `autoUpdate` E `needsUpdate` são AMBOS falsos (three r179). Num
       quadro em que alguém invalidou a sombra é ESTA passada que assa o mapa e
       limpa a bandeira, e o quadro principal reusa — economia legítima, porque é
       a mesma geometria. `scene.ts` lê `needsUpdate` ANTES dos `drawHooks`
       justamente por causa disso. */
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(rt);
    /* ⚠️ **SEM `renderer.clear()` AQUI, E A AUSÊNCIA É A CORREÇÃO.**
       `renderer.render()` abre com `if (autoClear || forceClear) this.clear(...)`
       e `autoClear` é `true` (ninguém neste engine o desliga). O `clear()`
       explícito que havia nesta linha era, portanto, um SEGUNDO apagamento de
       tela cheia do mesmo alvo, por quadro desenhado, no cenário mais caro.
       A conta do que ele tocava à toa, no teto do alvo (1600 × 1080): 13,8 MB de
       cor RGBA16F + 6,9 MB de profundidade + 71,4 MB do resolve 4× — e num
       laço a 60 Hz isso é banda de memória de vídeo gasta escrevendo zeros por
       cima de zeros. Numa integrada de memória COMPARTILHADA, banda é o recurso
       que decide. */
    renderer.render(scene, reflector);
  } finally {
    renderer.setRenderTarget(prevTarget);
    renderer.shadowMap.autoUpdate = prevShadow;
    plane.visible = wasVisible;
  }
  /* Ver o bloco "a conta que esta passada nunca teve", lá em cima. Depois do
     `finally` de propósito: o que interessa é o custo da passada COMPLETA,
     restauração de estado incluída. */
  const dt = performance.now() - t0;
  passMs = passes ? passMs + (dt - passMs) * 0.1 : dt;
  passes++;
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
 * Fração da resolução do canvas usada no alvo. Instrumento de bancada, não
 * ajuste de perfil.
 *
 * ⚠️⚠️ **A MEDIÇÃO ANTIGA DELE PRECISA SER REFEITA, E ESTE É O PEDIDO.**
 * O que está registrado é *14,1 fps a meio lado contra 14,7 a um quarto* — 1/4
 * dos fragmentos por 0,6 fps —, e a conclusão tirada dali foi "o gargalo é
 * geometria, resolução não resolve". Ela foi tirada com **1 968 malhas
 * separadas**, ou seja com a passada limitada por SUBMISSÃO. Com
 * `mergeVehicle: 'all'` a passada submete ~45 chamadas: a parcela que dominava a
 * medida saiu do quadro, e o preenchimento — que era invisível debaixo dela —
 * passa a ser a fração que sobrou. **Não se pode copiar a conclusão; ela tem de
 * ser remedida no chão novo**, com `floorReflectionCost()` (que agora existe) em
 * vez de fps de cena inteira, e intercalada A/B como a bancada de ablação faz.
 *
 * Se `SCALE` voltar a devolver tempo, ele é o botão certo para o Médio — e é
 * mais barato que qualquer outro, porque o reflexo já é lido a mip 1,03–1,88 e
 * atenuado a no máximo 42 % de contraste.
 */
export function setFloorReflectionScale(s: number) {
  const v = THREE.MathUtils.clamp(s, 0.1, 1);
  if (v === SCALE) return;
  SCALE = v;
  /* Delegado em vez de repetido: era a mesma sequência escrita duas vezes, e
     desde que `target` ganhou `s` uma cópia esquecida deixaria a chave do cache
     meio-invalidada. Ela também zera `tReflect`, o que aqui é correto — não há
     alvo para o piso amostrar até a próxima passada. */
  releaseFloorReflectionTarget();
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
