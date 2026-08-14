/* ATRAVESSAR EM VEZ DE DESVIAR — quem tapa o caminhão SOME INTEIRO.
   ===========================================================================
   A ÓRBITA DEIXOU DE FUGIR DAS CONSTRUÇÕES. Até 2026-08-11, `applyAvoidance()`
   em scene.ts puxava a câmera para perto e a levantava quando um galpão entrava
   entre ela e o veículo — 200 linhas de rastreio por raio, histerese e
   amortecimento para nunca deixar o produto ser tapado. Funciona, e tem dois
   preços: a câmera se mexe sozinha (o usuário arrasta para um lado e o
   enquadramento vai para outro), e o cenário teve de ser AUTORADO em volta
   disso — é por isso que os postes deste set tinham um vão de 130 m bem onde o
   caminhão está. A decisão do dono do produto foi trocar o mecanismo pelo do
   estúdio: a câmera atravessa, e quem fica no caminho fica transparente.

   ===========================================================================
   RODADA 2 — POR OBJETO, E NÃO POR FRAGMENTO. Vale contar o que a primeira
   versão fazia e por que ela foi rejeitada assim que foi vista rodando, porque
   o desenho de agora é a resposta ponto a ponto àquelas fotos:

   A v1 abria um TÚNEL GEOMÉTRICO — um cilindro entre a lente e o veículo — e o
   testava por fragmento no shader, dissolvendo com trama ordenada em função da
   distância ao eixo do túnel. Três defeitos, todos visíveis na primeira foto:

     · TRANSPARÊNCIA PARCIAL COMO ESTADO PERMANENTE. A queda radial
       (`smoothstep(R*0,62, R)`) faz com que a maior parte da área tapada fique
       em MEIO caminho — *"levemente transparente mas ainda mostrando um pouco
       da construção"*. Uma parede a 50 % de trama não é nem parede nem vidro;
       é ruído sobre o produto, que é a única coisa que a foto tem de vender.
     · META ÁRVORE. O túnel corta a copa onde o cilindro passa, então sobrava
       meia árvore no ar — *"nem mesmo faz sentido somente parte de uma arvore
       ficar transparente"*. Um objeto ou está no caminho ou não está.
     · A FAIXA DA PISTA DISSOLVIA. A escolha de quem recebe o tratamento era a
       família de molhagem `built`, e `surfaceOf()` devolve `built` para todo
       material cujo NOME não casa a lista de chão — e `LINE_PAINT` (a pintura
       da faixa) não casa `ground|road|asphalt|…`. Resultado: a demarcação da
       rua pontilhava sob a câmera rasante, porque o chão passa entre a lente e
       o veículo o tempo todo.

   O desenho de agora conserta os três pela mesma troca: **a decisão é por
   OBJETO e é binária**, tomada na CPU contra volumes envolventes de verdade, e
   o shader só recebe o resultado.

     1. QUEM PODE TAPAR É QUEM TEM ALTURA, não quem tem certo material. A
        pergunta certa não é "que família de superfície é esta" e sim "isto pode
        ficar na frente do caminhão": uma demarcação de 5 mm de espessura no
        chão não pode, uma cerca de 2 m pode. É o MESMO critério de
        `setupShadows()` em set.ts — o que projeta sombra é o que tapa —, e ele
        exclui de graça a faixa da pista, o asfalto, o meio-fio e a grama, sem
        lista de exceções para manter.
     2. QUEM DECIDE É A SILHUETA EM TELA. Um objeto some quando o retângulo dele
        em NDC encosta no retângulo do veículo E ele está À FRENTE do ponto mais
        próximo do veículo (ver `wAlvoFrente`, que já foi o ponto mais distante e
        virou o mais próximo por causa de um relato). É a definição literal de
        "está na minha frente", e é tudo o que o cilindro da v1 tentava aproximar
        — mal, porque um cilindro de raio fixo cobre um cone visual que se abre: a
        v1 apagava coisas na BORDA da tela por estarem a 9 m do eixo, a 3 m da
        lente.
     3. O QUE VAI PARA O SHADER É UM NÚMERO POR OBJETO. Zero ou um, com uma
        dissolvência curta no tempo entre os dois. Nunca há gradiente ESPACIAL:
        o objeto inteiro tem o mesmo valor, então nunca sobra meia árvore, e o
        estado de repouso é sempre 0 ou 1 — a trama só existe durante os 0,10 s
        da troca, onde ela lê como dissolvência e não como defeito.

   ===========================================================================
   COMO UM NÚMERO POR OBJETO CHEGA AO SHADER. Este é o ponto difícil do módulo,
   e as duas alternativas óbvias não servem:

     · UM UNIFORME NO MATERIAL COMPARTILHADO não serve, e é a armadilha: as 11
       torres de iluminação deste set são 11 NÓS que apontam para a MESMA malha
       glTF, logo dividem geometria e material. Um uniforme por material apagaria
       os onze postes porque um está na frente. O mesmo vale para os galpões
       (`model_0` é referenciada por 8 nós).
     · UM ATRIBUTO POR VÉRTICE não serve pelo mesmo motivo, um nível abaixo:
       geometria compartilhada é atributo compartilhado. Clonar a geometria para
       desempatar custaria VRAM de verdade (são 176 k triângulos).

   Então cada malha que pode tapar ganha um CLONE DO PRÓPRIO MATERIAL, e o
   uniforme mora nele. Clone de material é barato de um jeito que clone de
   geometria não é: as texturas vão por referência (nenhum byte novo na GPU) e o
   programa é o mesmo (mesma chave de cache), então o custo real é uma subida de
   uniformes a mais por quadro por malha — o que o three já faz para qualquer
   cena com materiais distintos. São ~60 clones neste cenário.

   A VEGETAÇÃO É A EXCEÇÃO, e é onde o atributo é o instrumento certo: cada
   protótipo é UM `InstancedMesh` com dezenas de indivíduos, e o que precisa de
   valor próprio é a INSTÂNCIA, não a malha. Aí entra um
   `InstancedBufferAttribute` de um float — e o mesmo `#ifdef USE_INSTANCING`
   que o three já usa escolhe, dentro do shader, entre ler o atributo e ler o
   uniforme. Um caminho de código, dois modos de entrega.

   CASCA E COPA TÊM DE CONCORDAR. `tree_pk_3` (tronco) e `tree_pk_3_1` (folhas)
   são dois `InstancedMesh` irmãos que compartilham as matrizes de instância;
   julgados em separado, o tronco ficaria e a copa iria — que é exatamente a
   "meia árvore" que esta rodada existe para matar. O par é ESTRUTURAL (irmãos sob
   o `Group` de primitivas do GLTFLoader), julgado por uma caixa que é a UNIÃO das
   duas, e os dois recebem o mesmo valor. É a mesma `grupoDePrimitivas()` que
   `scenery.ts` usa para plantar — e o cabeçalho dela conta por que parear pelo
   sufixo `_1` do NOME é ambíguo e custou quatro dos dez protótipos.

   ===========================================================================
   POR QUE `discard` COM TRAMA, E NÃO `transparent = true`. Ligar transparência
   de verdade nos volumes construídos deste set os tiraria do passe opaco:
   perde-se o early-z, entra-se na ordenação por profundidade, e qualquer
   interpenetração (e há muita — docas, caixas, contêineres encostados) passa a
   piscar conforme a câmera gira. A trama ordenada 4x4 (Bayer) resolve com o
   material continuando OPACO: o buffer de profundidade segue exato e não há
   reordenação. E como o estado de repouso é binário, a trama só aparece durante
   a dissolvência.

   O objeto totalmente escondido é cortado NO VÉRTICE, não no fragmento: com
   `hide` em 1 o shader manda `gl_Position` para fora do frustum e a malha não
   rasteriza nada. Sai mais barato que descartar fragmento por fragmento, e é o
   caso comum (um galpão tapando o caminhão fica tapado por muitos quadros).

   E A SOMBRA DISSOLVE JUNTO — ver o bloco A SOMBRA SAI COM O OBJETO. Esta versão
   do arquivo dizia o contrário ("a sombra continua inteira, de propósito"), e o
   argumento não sobreviveu ao produto rodando. */
import * as THREE from 'three';
import { grupoDePrimitivas } from './scenery';
import { getProfile } from '../core/quality';

/* ---------------- os números ---------------- */

/**
 * Altura mínima, em metros, para uma malha ser candidata a tapar.
 *
 * O MESMO 0,35 de `SHADOW_CAST_MIN_H` em set.ts, e não por coincidência: o que
 * projeta sombra é o que tem volume, e o que tem volume é o que pode ficar na
 * frente. Abaixo disto está o chão e o que é pintado nele — asfalto, apron,
 * meio-fio, grama e a faixa da pista, que era o que dissolvia errado.
 */
const ALTURA_MIN = 0.35;

/**
 * Folga em volta da silhueta do veículo, em NDC (a tela vai de −1 a 1).
 *
 * 0,045 é ~2 % da largura de cada lado. Sem folga, um poste que raspa o
 * contorno da carreta fica meio pixel fora do teste e permanece opaco
 * exatamente onde incomoda; com folga demais o cenário abre um buraco maior que
 * o produto e a foto perde o entorno.
 */
const FOLGA_NDC = 0.045;

/**
 * HISTERESE — folga EXTRA para continuar escondido, depois de já estar.
 *
 * NÃO É REFINAMENTO, É CORREÇÃO DE PISCA. Sem ela o veredito é uma comparação
 * de fio de navalha: um poste cuja silhueta raspa o contorno da carreta, ou cuja
 * profundidade empata com o fundo do conjunto, troca de lado a cada quadro. O
 * resultado não é um pisca (a dissolvência amortece), é PIOR: o valor fica
 * pendurado no meio da rampa e nunca chega a 0 nem a 1 — exatamente a
 * transparência parcial permanente que esta rodada existe para eliminar.
 * Medido na bancada antes disto: `mast_m_2` estacionado em 0,04 e uma instância
 * de vegetação em 0,04, com a câmera PARADA.
 *
 * Duas grandezas porque o empate acontece nos dois eixos do teste: 0,05 em NDC
 * (~2,5 % da tela, um pouco mais que a própria folga) e 1,5 m de profundidade.
 */
const HISTERESE_NDC = 0.05;
const HISTERESE_W = 1.5;

/* A dissolvência é ASSIMÉTRICA, e curta dos dois lados. Entrando tem de ser
   rápida — enquanto ela corre o produto está parcialmente tapado, que é o
   estado que esta rodada existe para eliminar. Saindo pode respirar: devolver o
   cenário devagar é o que o olho aceita como "a construção voltou" em vez de
   "piscou". Ambas bem abaixo dos 0,18/0,42 da v1, onde a trama parcial era
   longa o bastante para ser lida como o estado final. */
const TAU_ENTRA = 0.10;
const TAU_SAI = 0.26;

/** Abaixo disto o vértice está no plano da câmera e a divisão por w explode. */
const W_MIN = 1e-3;

/** Amostras ao longo do corredor lente→veículo no pré-teste barato.
 *
 *  DO PERFIL, porque este é o maior custo fixo de CPU do laço: `updateSeeThrough`
 *  roda 60×/s sobre ~650 objetos (60 sólidos + as plantas instanciadas)
 *  INCLUSIVE em quadro pulado, e cada sólido paga até `AMOSTRAS + 1` chamadas de
 *  `Box3.distanceToPoint`. Numa máquina limitada por CPU — que é o caso do alvo
 *  desta passagem — cortar isso pela metade vale mais que qualquer botão de
 *  preenchimento.
 *
 *  É amostragem pura pela régua do perfil: metade das amostras ao longo do MESMO
 *  corredor só torna o pré-teste um pouco mais grosseiro, e quem decide de fato
 *  é o teste de retângulo em NDC que vem depois. */
const amostras = () => getProfile().seeThroughSamples;

/* ---------------- o shader ----------------
   O uniforme `uSeeHide` é declarado sempre e o atributo só sob instanciamento,
   porque um material pode servir aos dois casos (uma malha comum e um
   `InstancedMesh`): o three compila um programa por combinação de defines, e
   cada um cai no seu ramo. */
const PARS_VERT = /* glsl */`
#ifdef USE_INSTANCING
  attribute float aSeeHide;
  varying float vSeeHide;
#else
  uniform float uSeeHide;
#endif
`;

/* DEPOIS de `project_vertex`, que é quem escreve `gl_Position`. Mandar o vértice
   para (2,2,2,1) o põe fora do volume canônico em x, y e z ao mesmo tempo, e
   com todos os vértices no MESMO ponto o triângulo também degenera — duas
   razões independentes para nada ser rasterizado. */
const MAIN_VERT = /* glsl */`
#include <project_vertex>
#ifdef USE_INSTANCING
  vSeeHide = aSeeHide;
  if ( aSeeHide > 0.999 ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
#else
  if ( uSeeHide > 0.999 ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
#endif
`;

const PARS_FRAG = /* glsl */`
#ifdef USE_INSTANCING
  varying float vSeeHide;
#else
  uniform float uSeeHide;
#endif

/* Bayer 4x4 ordenado. A matriz clássica, normalizada para (0,1); o padrão fixo
   na TELA é o que faz a dissolvência parecer uma trama e não ruído — um dither
   aleatório cintilaria a cada quadro com a câmera parada.

   O laço de 16 no lugar de um índice dinâmico é deliberado e NÃO custa nada
   aqui: o teste lá embaixo só deixa entrar fragmento de objeto em dissolvência,
   e objeto em repouso é ou opaco (não entra) ou cortado no vértice (não chega a
   ter fragmento). Quem paga o laço são os poucos quadros da troca.

   NADA DE CRASE NESTE BLOCO. Isto é uma template string de JS: uma crase de
   citação em comentário de GLSL fecha o literal e o arquivo deixa de compilar
   (ou, pior, compila e morre no rAF). Já aconteceu duas vezes neste projeto. */
float seeBayer( vec2 fc ) {
  int x = int( mod( fc.x, 4.0 ) );
  int y = int( mod( fc.y, 4.0 ) );
  int i = x + y * 4;
  float m[16];
  m[0]=0.0;  m[1]=8.0;  m[2]=2.0;  m[3]=10.0;
  m[4]=12.0; m[5]=4.0;  m[6]=14.0; m[7]=6.0;
  m[8]=3.0;  m[9]=11.0; m[10]=1.0; m[11]=9.0;
  m[12]=15.0;m[13]=7.0; m[14]=13.0;m[15]=5.0;
  float v = 0.0;
  for ( int k = 0; k < 16; k++ ) { if ( k == i ) v = m[k]; }
  return ( v + 0.5 ) / 16.0;
}
`;

/* No TOPO do main. `clipping_planes_fragment` é o primeiro include do corpo em
   todo material do three, então substituí-lo por ele-mesmo-mais-isto é a única
   forma estável de rodar antes de qualquer amostragem — e o `discard` cedo é o
   que economiza a leitura das texturas do fragmento descartado. */
const MAIN_FRAG = /* glsl */`
#include <clipping_planes_fragment>
#ifdef USE_INSTANCING
  float seeHide = vSeeHide;
#else
  float seeHide = uSeeHide;
#endif
if ( seeHide > 0.0 && seeHide > seeBayer( gl_FragCoord.xy ) ) discard;
`;

/* ---------------- A SOMBRA SAI COM O OBJETO ----------------
   A primeira versão mantinha a sombra de propósito, com o argumento de que ela é
   o que separa "consigo ver o caminhão" de "o cenário sumiu": o galpão apagado
   continuava ancorando a cena com a sombra dele no chão. O dono do produto viu
   rodando e o argumento não sobreviveu — *"a sombra continua no caminhao mesmo
   quando a arvore esta escondida"* — e ele está certo, porque o caso que decide
   não é a sombra no CHÃO, é a sombra sobre a LATARIA: a rendilha de uma árvore
   que não está lá, atravessando a peça que a foto existe para vender.

   E O CAMINHO NÃO É `castShadow`, por duas razões, a segunda decisiva:

     1. a bandeira é BINÁRIA, então a sombra sairia no meio da dissolvência em vez
        de junto com ela; e
     2. **ela é POR MALHA.** As 593 plantas são doze `InstancedMesh`, e apagar a
        bandeira de um deles tiraria a sombra de TODAS as árvores daquela espécie —
        exatamente o erro de granularidade que esta rodada inteira existe para
        corrigir, reaparecendo no passe de sombra.

   A alavanca certa é `Object3D.customDepthMaterial`: o `WebGLShadowMap` a usa em
   lugar do `MeshDepthMaterial` interno dele, e nela cabe a MESMA injeção — mesmo
   uniforme para malha comum, mesmo atributo para instância. A sombra passa a
   dissolver com a mesma trama e no mesmo tempo que o objeto, por indivíduo.

   O QUE ELA TEM DE CARREGAR, e esquecer isto é como se descobre que ela existe:
   o three monta o material de profundidade dele COPIANDO `map`, `alphaMap`,
   `alphaTest` e `side` do material de origem. `PLANT_LEAF`, `PLANT_BARK` e
   `FENCE_WIRE` deste set são `alphaMode: MASK` com corte 0,38 — sem esses quatro
   campos a copa de cada árvore projetaria um CARTÃO retangular sólido, e o
   alambrado uma parede. */
function materialDeProfundidade(mat: THREE.MeshStandardMaterial,
  u: { value: number }) {
  const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  dm.map = mat.map;
  dm.alphaMap = mat.alphaMap;
  dm.alphaTest = mat.alphaTest;
  dm.side = mat.side;
  injetar(dm, u);
  return dm;
}

/** Materiais já tratados — a injeção é idempotente e a troca de cenário reusa. */
const instalados = new WeakSet<THREE.Material>();

/** Onde o uniforme de cada material clonado mora, para o passo de medida achar. */
interface ComUniforme { userData: { tsSeeU?: { value: number } } }

/**
 * Encadeia a injeção em `mat`. Idempotente.
 *
 * ENCADEIA em vez de substituir: `installMacro()` de set.ts já usa os dois
 * ganchos nos materiais de chão, e um dia pode usar aqui; sobrescrever apagaria
 * a variação macro sem erro nenhum.
 */
function injetar(mat: THREE.Material, u: { value: number }) {
  if (!mat || instalados.has(mat)) return;
  instalados.add(mat);

  const antesCompile = mat.onBeforeCompile;
  const antesChave = mat.customProgramCacheKey;

  mat.onBeforeCompile = function (shader, renderer) {
    if (antesCompile) antesCompile.call(this, shader, renderer);
    shader.uniforms.uSeeHide = u;
    shader.vertexShader = PARS_VERT + shader.vertexShader
      .replace('#include <project_vertex>', MAIN_VERT);
    shader.fragmentShader = PARS_FRAG + shader.fragmentShader
      .replace('#include <clipping_planes_fragment>', MAIN_FRAG);
  };
  /* Sem isto o three serve o programa CACHEADO, sem a injeção, para o segundo
     material em diante — a chave de cache dele não conhece onBeforeCompile. */
  mat.customProgramCacheKey = function () {
    return 'ts-see-v2|' + (antesChave ? antesChave.call(this) : '');
  };
  mat.needsUpdate = true;
}

/**
 * Clona o material de `mesh` para ele poder ter valor PRÓPRIO, e injeta.
 *
 * `Material.copy()` do three NÃO copia `onBeforeCompile` nem
 * `customProgramCacheKey` — são propriedades próprias de instância, não campos
 * da lista que ele copia. Um clone de material já tratado perderia a injeção
 * silenciosamente, então os dois ganchos são carregados à mão ANTES de injetar
 * (é isso que mantém a variação macro, se algum dia um material de chão virar
 * candidato).
 */
function clonarMaterial(mat: THREE.Material) {
  const c = mat.clone();
  c.onBeforeCompile = mat.onBeforeCompile;
  c.customProgramCacheKey = mat.customProgramCacheKey;
  const u = { value: 0 };
  injetar(c, u);
  (c as unknown as ComUniforme).userData.tsSeeU = u;
  return c;
}

/* ---------------- passo 1: quem é candidato ---------------- */

/**
 * Marca as malhas de `root` que podem tapar o veículo e prepara a entrega do
 * valor: clone de material para malha comum, atributo de instância para
 * `InstancedMesh`.
 *
 * RODA DENTRO DE `bindMaterials()`, e a vizinhança é obrigatória nos dois
 * sentidos: DEPOIS de o manifesto ter configurado tinta, rugosidade e macro
 * (senão o clone sai com os padrões do three), e ANTES de
 * `registerGroundMaterials()` (senão a molhagem ficaria registrada nos
 * ORIGINAIS e a chuva deixaria de alcançar as construções — o defeito que a
 * família `built` acabou de consertar).
 *
 * NÃO mede posição. As instâncias de vegetação ainda vão ser replantadas por
 * `arranjarCenario()` e as construções altas ainda vão ser recuadas por
 * `applyPushback()`; quem mede é `measureSeeThrough()`, depois disso.
 *
 * @returns quantas malhas comuns e quantas instanciadas entraram.
 */
export function installSeeThroughOnSet(root: THREE.Object3D,
  ehChao: (mat: THREE.Material) => boolean) {
  root.updateMatrixWorld(true);
  const cx = new THREE.Box3();
  let comuns = 0, instanciadas = 0, chao = 0, chaoAlto = 0;

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (!mats.length || !mats[0]) return;

    /* SEGUNDO CRITÉRIO: SUPERFÍCIE DE CHÃO NUNCA ATRAVESSA, por alta que a caixa
       dela seja.
       -----------------------------------------------------------------------
       Só a altura não bastou, e a bancada mostrou por quê: `kerbs` (o meio-fio
       de todo o distrito, uma malha só), `farmland` (o campo de trás),
       `yard_edge` e `outer` têm caixas envolventes ALTAS — o meio-fio acompanha
       o desnível do terreno, o campo tem relevo — e passavam pelo teste de
       altura. O resultado era um buraco no meio-fio e no gramado sempre que a
       lente ficava rasante, que é o mesmo defeito da faixa da pista um passo
       adiante.
       Quem responde é set.ts, e a resposta vem do MANIFESTO: os materiais
       nomeados em `set.materials` são de chão por declaração (e quem for
       construção declara `surface: 'built'`). Isso é dado autorado, não
       inferência de nome — que é o que já tinha falhado uma vez aqui. */
    if (ehChao(mats[0] as THREE.Material)) { chaoAlto++; return; }

    /* ALTURA OU ALTITUDE. A segunda metade do teste não é preciosismo: um
       painel de telhado é uma malha de espessura zero a 8 m do chão, e só a
       primeira metade o deixaria de fora — o telhado ficaria flutuando opaco
       depois de as paredes sumirem. Chão é o que é RASO e está EMBAIXO. */
    cx.setFromObject(mesh);
    if (cx.isEmpty()) return;
    if ((cx.max.y - cx.min.y) < ALTURA_MIN && cx.min.y < ALTURA_MIN) { chao++; return; }

    const im = mesh as THREE.InstancedMesh;
    if (im.isInstancedMesh) {
      /* Material COMPARTILHADO de propósito: aqui quem tem valor próprio é a
         instância, e ela o carrega no atributo. Clonar por malha aqui só
         multiplicaria material sem resolver nada. */
      for (const m of mats) if (m) injetar(m, DUMMY);
      garantirAtributo(im);
      /* O material de profundidade também é COMPARTILHADO aqui, e pode ser: o
         valor de cada árvore vem do atributo, que é da geometria. */
      im.customDepthMaterial =
        materialDeProfundidade(mats[0] as THREE.MeshStandardMaterial, DUMMY);
      im.userData.tsSee = true;
      instanciadas++;
      return;
    }

    if (Array.isArray(mesh.material)) {
      /* Malha multi-material: TODOS os materiais ganham clone e uniforme, e
         `escrever()` põe o mesmo valor em todos — uma malha dissolvida pela
         metade seria a "meia árvore" um nível abaixo. */
      mesh.material = mesh.material.map((m) => (m ? clonarMaterial(m) : m));
    } else {
      mesh.material = clonarMaterial(mesh.material);
    }
    /* O material de profundidade sai do PRIMEIRO material — o passe de sombra é
       um só por objeto, e é dele que o three copia máscara e lado. Ele reusa o
       MESMO uniforme, então sombra e superfície nunca podem discordar. */
    {
      const bruto = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const m0 = bruto as THREE.MeshStandardMaterial;
      const u0 = (m0 as unknown as ComUniforme).userData.tsSeeU;
      if (u0) mesh.customDepthMaterial = materialDeProfundidade(m0, u0);
    }
    mesh.userData.tsSee = true;
    comuns++;
  });

  return { comuns, instanciadas, chao, chaoAlto };
}

/* O material de um `InstancedMesh` nunca lê `uSeeHide` — o programa dele tem
   `USE_INSTANCING` e cai no ramo do atributo. Mas o uniforme precisa EXISTIR no
   `shader.uniforms`, ou o three não teria o que ligar caso o mesmo material
   apareça numa malha comum. Um holder só, compartilhado, sempre em zero. */
const DUMMY = { value: 0 };

/**
 * Garante o `aSeeHide` na geometria de `im`, com a CAPACIDADE alocada e não com
 * `count`.
 *
 * `scenery.ts` reescreve `im.count` no replantio, e um atributo dimensionado
 * pelo count de fábrica ficaria curto se ele crescesse. `instanceMatrix.count`
 * é a capacidade que o GLB reservou, que é o teto de verdade.
 *
 * GEOMETRIA COMPARTILHADA É ATRIBUTO COMPARTILHADO, e `EXT_mesh_gpu_instancing`
 * permite dois nós apontarem para a mesma malha glTF: se isso acontecer, os
 * dois `InstancedMesh` escreveriam no mesmo buffer e um apagaria o outro. O
 * dono é registrado na geometria e o segundo a chegar recebe uma cópia.
 */
function garantirAtributo(im: THREE.InstancedMesh) {
  let geo = im.geometry;
  /* O dono é o UUID e não o objeto: `userData` de geometria entra no
     `toJSON()` do three, e uma referência a `Object3D` ali seria um ciclo. */
  const dono = geo.userData.tsSeeDono;
  if (dono && dono !== im.uuid) {
    geo = geo.clone();
    im.geometry = geo;
  }
  geo.userData.tsSeeDono = im.uuid;
  const cap = Math.max(1, im.instanceMatrix.count);
  const atual = geo.getAttribute('aSeeHide') as THREE.InstancedBufferAttribute | undefined;
  if (!atual || atual.count < cap) {
    geo.setAttribute('aSeeHide',
      new THREE.InstancedBufferAttribute(new Float32Array(cap), 1));
  }
}

/* ---------------- passo 2: medir onde tudo está ---------------- */

interface Solido {
  mesh: THREE.Mesh;
  /** Os uniformes de todos os materiais da malha (quase sempre um). */
  us: { value: number }[];
  /**
   * Objetos que somem COM esta malha, sem serem ela.
   *
   * O caso real: `lamps.ts` põe um vidro aceso na luminária de cada torre do
   * cenário, e esse vidro é geometria NOSSA, com material próprio — não recebe a
   * injeção do mastro. Sem o vínculo, atravessar uma torre apagava o mastro e
   * deixava o vidro aceso FLUTUANDO no céu, sem poste. Foi fotografado na
   * bancada às 20:00.
   *
   * O vínculo é por `visible` e não pela dissolvência, e o motivo é que o vidro
   * usa um material COMPARTILHADO (é ele que `applyRig()` acende com a cor e o
   * nível do relógio): dar valor próprio a cada um exigiria clonar o material e
   * fazer applyRig percorrer os clones. O que se perde é a dissolvência de
   * 0,10 s num quadrilátero de 0,87 x 0,48 m a mais de 16 m — invisível — e o
   * que se ganha é o mastro continuar sendo o único dono do veredito.
   */
  sats: THREE.Object3D[];
  /** Caixa em MUNDO. Medida UMA vez: depois do arranjo o set não se mexe mais. */
  box: THREE.Box3;
  /** Centro e raio da envolvente, para o pré-teste barato. */
  cx: number; cy: number; cz: number; r: number;
  hide: number;
  want: number;
}

interface Grupo {
  /** Irmãos que compartilham as matrizes de instância (casca + copa). */
  malhas: THREE.InstancedMesh[];
  attrs: THREE.InstancedBufferAttribute[];
  n: number;
  /** 6 floats por instância: caixa em MUNDO. */
  boxes: Float32Array;
  /** 4 floats por instância: centro e raio. */
  esferas: Float32Array;
  hide: Float32Array;
  want: Uint8Array;
  sujo: boolean;
}

let solidos: Solido[] = [];
let grupos: Grupo[] = [];

/** Caixa do conjunto a proteger, em mundo, e o raio dela. */
let alvoBox: THREE.Box3 | null = null;
let alvoR = 0;

/**
 * Mede, em MUNDO, tudo que `installSeeThroughOnSet()` marcou.
 *
 * RODA DEPOIS DE `arranjarCenario()`, e a ordem é o ponto: o plantio reescreve
 * TODAS as matrizes de instância e o realinhamento move os onze postes, então
 * medir antes guardaria as posições de fábrica e o teste apontaria para árvores
 * que não estão mais lá. Ver a sequência em `applySet()`.
 *
 * @returns o que entrou, para o log de carga.
 */
export function measureSeeThrough(root: THREE.Object3D) {
  solidos = [];
  grupos = [];
  root.updateMatrixWorld(true);

  const cx = new THREE.Box3();
  const porGrupo = new Map<THREE.Object3D, THREE.InstancedMesh[]>();

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.userData.tsSee) return;
    const im = mesh as THREE.InstancedMesh;
    if (im.isInstancedMesh) {
      /* O MESMO agrupamento que `scenery.ts` usa para plantar, e importado dele
         em vez de recopiado: se os dois discordarem, um replanta a árvore inteira
         e o outro a dissolve pela metade. O cabeçalho de `grupoDePrimitivas()`
         conta por que o par NÃO pode ser feito pelo sufixo `_1` do nome. */
      const chave = grupoDePrimitivas(im);
      const l = porGrupo.get(chave);
      if (l) l.push(im); else porGrupo.set(chave, [im]);
      return;
    }
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const us: { value: number }[] = [];
    for (const m of mats) {
      const u = m && (m as unknown as ComUniforme).userData.tsSeeU;
      if (u) us.push(u);
    }
    if (!us.length) return;                    // clone perdido: não há o que escrever
    cx.setFromObject(mesh);
    if (cx.isEmpty()) return;
    const c = cx.getCenter(new THREE.Vector3());
    solidos.push({
      mesh, us, sats: [], box: cx.clone(),
      cx: c.x, cy: c.y, cz: c.z,
      r: cx.getSize(new THREE.Vector3()).length() / 2,
      hide: 0, want: 0,
    });
  });

  const m4 = new THREE.Matrix4();
  const bLocal = new THREE.Box3();
  const bInst = new THREE.Box3();
  for (const malhas of porGrupo.values()) {
    /* O menor `count` do grupo manda: casca e copa deviam ter o mesmo, e se
       divergirem escrever além do menor sairia da parte válida de um deles. */
    let n = Infinity;
    for (const im of malhas) n = Math.min(n, im.count);
    if (!Number.isFinite(n) || n <= 0) continue;

    const attrs: THREE.InstancedBufferAttribute[] = [];
    for (const im of malhas) {
      const a = im.geometry.getAttribute('aSeeHide') as THREE.InstancedBufferAttribute;
      if (a) attrs.push(a);
    }
    if (!attrs.length) continue;

    const boxes = new Float32Array(n * 6);
    const esferas = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      bInst.makeEmpty();
      for (const im of malhas) {
        if (!im.geometry.boundingBox) im.geometry.computeBoundingBox();
        const bb = im.geometry.boundingBox;
        if (!bb) continue;
        im.getMatrixAt(i, m4);
        /* Duas transformações, na ordem certa: a matriz da INSTÂNCIA leva o
           protótipo ao lugar dele dentro da malha, e a da MALHA leva a malha ao
           mundo. Trocar a ordem ou esquecer uma põe a árvore na origem — o
           mesmo tropeço que `scenery.ts` documenta no plantio. */
        bLocal.copy(bb).applyMatrix4(m4).applyMatrix4(im.matrixWorld);
        bInst.union(bLocal);
      }
      if (bInst.isEmpty()) continue;
      boxes[i * 6] = bInst.min.x; boxes[i * 6 + 1] = bInst.min.y;
      boxes[i * 6 + 2] = bInst.min.z; boxes[i * 6 + 3] = bInst.max.x;
      boxes[i * 6 + 4] = bInst.max.y; boxes[i * 6 + 5] = bInst.max.z;
      esferas[i * 4] = (bInst.min.x + bInst.max.x) / 2;
      esferas[i * 4 + 1] = (bInst.min.y + bInst.max.y) / 2;
      esferas[i * 4 + 2] = (bInst.min.z + bInst.max.z) / 2;
      esferas[i * 4 + 3] = bInst.min.distanceTo(bInst.max) / 2;
    }
    grupos.push({
      malhas, attrs, n, boxes, esferas,
      hide: new Float32Array(n), want: new Uint8Array(n), sujo: false,
    });
  }

  let plantas = 0;
  for (const g of grupos) plantas += g.n;
  return { solidos: solidos.length, grupos: grupos.length, plantas };
}

/** Esquece o cenário que saiu. Os uniformes morrem com os materiais clonados. */
export function clearSeeThrough() {
  solidos = [];
  grupos = [];
}

/**
 * Declara o volume a proteger. Chamado por `setVehicleFocus()`, que já recebe a
 * caixa do conjunto medida depois do engate; `null` desliga o mecanismo inteiro.
 */
export function setSeeThroughTarget(box: THREE.Box3 | null) {
  if (!box || box.isEmpty()) { alvoBox = null; alvoR = 0; return; }
  alvoBox = box.clone();
  alvoR = alvoBox.getSize(new THREE.Vector3()).length() / 2;
}

/* ---------------- o teste, por quadro ---------------- */

const _pv = new THREE.Matrix4();
const _c4 = new THREE.Vector4();
const _p = new THREE.Vector3();
const _q = new THREE.Vector3();
const _ab = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _cam = new THREE.Vector3();
const _tgt = new THREE.Vector3();
const _bx = new THREE.Box3();
/** |lente→mira|², reaproveitado por todos os candidatos do quadro. */
let eixoL2 = 1;
/** [x0, y0, x1, y1] em NDC. */
const _rAlvo = [0, 0, 0, 0];
const _rObj = [0, 0, 0, 0];
/**
 * Profundidade da FRENTE do conjunto (w de clip mínimo, o canto mais perto da
 * lente). Um candidato só tapa se estiver à frente disto.
 *
 * ERA O FUNDO, e a troca é a correção de *"as arvores estao sendo escondidas
 * mesmo atras do caminhao, e nao deveria"*. O fundo parecia mais generoso e certo
 * — "sumir com tudo que cobre qualquer parte do produto" — e é errado justamente
 * na vista que o relato mostra: **olhando ao longo do comprimento**, o conjunto
 * tem 19 m de profundidade na tela, então TODA árvore dentro desses 19 m que
 * encostasse no retângulo do caminhão sumia, inclusive as que estão a metros
 * ATRÁS dele. A silhueta em tela diz "se sobrepõe"; ela não diz "está na frente".
 *
 * Com a frente, some só o que está mais perto da lente que o ponto mais próximo
 * do conjunto — que é a leitura literal de "está na minha frente". O caso que se
 * perde é um objeto que cobre apenas a metade DISTANTE do produto (um galpão na
 * altura da carreta, com a lente na cabine); ele é bem mais raro que o caso que
 * se ganha, e nas vistas de lado — onde a profundidade do conjunto é 2,6 m e não
 * 19 — as duas regras dão o mesmo resultado.
 */
let wAlvoFrente = 0;

/**
 * Retângulo em NDC e a profundidade dos 8 cantos de `bx`.
 *
 * @returns o w MÍNIMO (o canto mais perto), `wMax` em `outW[0]`, ou −1 quando a
 *   caixa cruza o plano da câmera. Nesse caso não existe retângulo: a projeção
 *   de um ponto com w ≤ 0 se dobra para o lado errado da tela, e um retângulo
 *   calculado assim aponta para qualquer lugar. Quem chama trata o −1 como
 *   "está em volta da lente" — o pré-teste do corredor já garantiu que está no
 *   caminho, então some.
 */
function rectDaCaixa(bx: THREE.Box3, out: number[], outW: number[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  let wMin = Infinity, wMax = -Infinity;
  for (let i = 0; i < 8; i++) {
    _c4.set(
      (i & 1) ? bx.max.x : bx.min.x,
      (i & 2) ? bx.max.y : bx.min.y,
      (i & 4) ? bx.max.z : bx.min.z, 1).applyMatrix4(_pv);
    const w = _c4.w;
    if (w <= W_MIN) return -1;
    const ix = _c4.x / w, iy = _c4.y / w;
    if (ix < x0) x0 = ix;
    if (ix > x1) x1 = ix;
    if (iy < y0) y0 = iy;
    if (iy > y1) y1 = iy;
    if (w < wMin) wMin = w;
    if (w > wMax) wMax = w;
  }
  out[0] = x0; out[1] = y0; out[2] = x1; out[3] = y1;
  outW[0] = wMax;
  return wMin;
}
const _wOut = [0];

/**
 * A caixa está dentro do CONE de visada do veículo?
 *
 * Pré-teste barato, e a forma dele é a correção de um erro que a v1 cometia no
 * teste PRINCIPAL: **um cilindro de raio fixo não é o volume tapado.** O que
 * tapa o veículo é o sólido de sombra dele visto da lente, e esse abre — a 3 m
 * da lente, meio metro fora do eixo já é a borda da tela; a 20 m, nove metros
 * fora do eixo ainda é em cima do produto. Um cilindro de 9 m apagava o
 * primeiro caso (coisas na borda da tela sumindo) e um cilindro estreito
 * perderia o segundo.
 *
 * Então o raio cresce com `t`: `alvoR·t` é o raio da sombra do veículo no ponto
 * `t` do segmento. O 1,3 e o 0,6 m são folga — este é um FILTRO, e ele só pode
 * errar para o lado de deixar passar, porque quem decide de fato é a silhueta em
 * tela logo depois. O 0,08 dá raio a `t = 0`, onde senão só passaria quem
 * encosta na lente.
 *
 * `Box3.distanceToPoint()` (distância do ponto à caixa, zero por dentro) é o que
 * faz isto ser caixa-contra-eixo e não esfera-contra-eixo — a diferença que
 * impede uma cerca de 300 m de ser julgada pelo raio da envolvente dela, que
 * não quer dizer nada.
 */
function noCorredor(bx: THREE.Box3) {
  /* Lido UMA vez por chamada e não por iteração: são ~650 chamadas por quadro e
     `getProfile()` monta um objeto novo a cada leitura. */
  const n = amostras();
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    _p.copy(_cam).lerp(_tgt, t);
    /* O 1,2 m de folga fixa (era 0,6) cobre a HISTERESE: um objeto que só
       continua escondido por causa dela não pode ser rejeitado aqui antes de o
       teste exato ser consultado — seria a mesma navalha, um degrau acima. */
    if (bx.distanceToPoint(_p) <= alvoR * (0.08 + 1.3 * t) + 1.2) return true;
  }
  return false;
}

/**
 * Distância do centro (`x`,`y`,`z`) ao segmento lente→mira. O degrau mais barato
 * da rejeição: uma raiz quadrada e nada de caixa.
 */
function distEixo(x: number, y: number, z: number) {
  _ab.set(x - _cam.x, y - _cam.y, z - _cam.z);
  const t = THREE.MathUtils.clamp(_ab.dot(_dir) / eixoL2, 0, 1);
  return _p.copy(_cam).addScaledVector(_dir, t).distanceTo(_q.set(x, y, z));
}

/**
 * Veredito exato: a silhueta do objeto encosta na do veículo E ele está à frente
 * do fundo do veículo?
 *
 * `escondido` é o estado ATUAL, e é o que aplica a histerese — sair custa mais
 * que entrar. Ver HISTERESE_NDC.
 */
function tapa(bx: THREE.Box3, escondido: boolean) {
  const wMin = rectDaCaixa(bx, _rObj, _wOut);
  /* wMin < 0: a caixa engole a lente. O cone já disse que está no caminho, e o
     retângulo em tela não existe para um ponto atrás do plano da câmera — então
     some, que é o único veredito defensável. */
  if (wMin < 0) return true;
  const mais = escondido ? HISTERESE_NDC : 0;
  const frente = wAlvoFrente + (escondido ? HISTERESE_W : 0);
  return wMin < frente && encosta(_rObj, _rAlvo, mais);
}

/** Os retângulos se encostam? O do alvo já vem com a folga; `mais` é a histerese. */
function encosta(a: number[], b: number[], mais: number) {
  return a[0] <= b[2] + mais && a[2] >= b[0] - mais
    && a[1] <= b[3] + mais && a[3] >= b[1] - mais;
}

/**
 * Escreve o valor de um sólido nos uniformes dele.
 *
 * Todos os materiais da malha recebem o MESMO valor: uma malha multi-material
 * dividida ao meio pela dissolvência seria a "meia árvore" outra vez, um nível
 * abaixo.
 */
/** Alguma sombra mudou neste quadro? Ver `escrever()`. */
let sombraSuja = false;

function escrever(s: Solido) {
  for (const u of s.us) u.value = s.hide;
  /* Meio caminho conta como escondido: o satélite é pequeno e aceso, e deixá-lo
     ligado durante a dissolvência é justamente o "vidro sem poste". */
  const mostrar = s.hide < 0.5;
  for (const o of s.sats) if (o.visible !== mostrar) o.visible = mostrar;
  /* O mapa de sombra deste engine não se redesenha sozinho
     (`shadowMap.autoUpdate = false`), então mexer no valor não basta: o quadro
     tem de PEDIR o redesenho. */
  sombraSuja = true;
}

/**
 * Alguma sombra mudou desde a última consulta? Consome o aviso.
 *
 * Existe para não importar `renderer` aqui: scene.ts é quem tem o
 * `shadowMap.needsUpdate`, e uma seta de volta para lá só por um booleano seria
 * um ciclo de módulo.
 */
export function takeSeeThroughShadowDirty() {
  const v = sombraSuja;
  sombraSuja = false;
  return v;
}

/**
 * Liga `sat` ao veredito de `host`: ele passa a sumir junto.
 *
 * RODA DEPOIS DE `measureSeeThrough()`, que é quem monta a lista de sólidos.
 * Devolve false quando `host` não é um sólido registrado — o que é um estado
 * legítimo (uma torre em cenário sem atravessar, um host de chão) e não um erro.
 */
export function bindSeeThroughSatellite(host: THREE.Object3D | null | undefined,
  sat: THREE.Object3D | null | undefined) {
  if (!host || !sat) return false;
  for (const s of solidos) {
    if (s.mesh !== host) continue;
    if (!s.sats.includes(sat)) s.sats.push(sat);
    sat.visible = s.hide < 0.5;
    return true;
  }
  return false;
}

/** Exponencial com passo do RELÓGIO: a 120 Hz um passo fixo iria ao dobro. */
function passo(hide: number, want: number, dt: number) {
  const tau = want > hide ? TAU_ENTRA : TAU_SAI;
  const k = 1 - Math.exp(-Math.max(0, dt) / Math.max(1e-4, tau));
  const v = hide + (want - hide) * k;
  return Math.abs(v - want) < 0.004 ? want : v;
}

/**
 * Decide e escreve, uma vez por quadro.
 *
 * @returns true enquanto alguma dissolvência AINDA está correndo — e só nesse
 *   caso o chamador precisa pedir mais um quadro. Devolver "há algo escondido"
 *   faria o laço sujo-dirigido de scene.ts redesenhar para sempre em qualquer
 *   cenário com set, que é justamente o que aquele laço existe para não fazer:
 *   mover a câmera já invalida por conta própria, e com tudo assentado os
 *   valores de um quadro parado são idênticos aos do anterior.
 */
export function updateSeeThrough(camera: THREE.Camera, dt: number) {
  if (!solidos.length && !grupos.length) return false;

  /* SEM ALVO, TUDO VOLTA. Acontece de verdade: entre a troca de cavalo e o
     engate `vehicleFocus` é null por alguns quadros, e congelar o cenário
     escondido nessa janela deixaria um buraco no distrito sem nada dentro. */
  let temAlvo = !!alvoBox;
  if (temAlvo && alvoBox) {
    camera.updateMatrixWorld();
    _pv.multiplyMatrices(
      (camera as THREE.PerspectiveCamera).projectionMatrix, camera.matrixWorldInverse);
    _cam.setFromMatrixPosition(camera.matrixWorld);
    /* A MIRA É O CENTRO DA CAIXA DO CONJUNTO, e não `controls.target`: o alvo da
       órbita fica a 48 % da altura (ver CARD_TARGET_H em scene.ts) e o usuário
       ainda pode tê-lo deslocado com o botão direito. O eixo do cone tem de
       apontar para o PRODUTO, não para onde a órbita gira. */
    alvoBox.getCenter(_tgt);
    _dir.copy(_tgt).sub(_cam);
    eixoL2 = Math.max(_dir.lengthSq(), 1e-6);
    const wMin = rectDaCaixa(alvoBox, _rAlvo, _wOut);
    if (wMin < 0) {
      /* A CÂMERA ESTÁ DENTRO DO CAMINHÃO (ou a caixa cruza o plano da lente).
         Aí não há silhueta a proteger — e o expulsor de carroceria de scene.ts
         vai tirar a câmera de lá no mesmo quadro. Devolver o cenário é o
         comportamento certo para um estado que dura um quadro. */
      temAlvo = false;
    } else {
      wAlvoFrente = wMin;
      _rAlvo[0] -= FOLGA_NDC; _rAlvo[1] -= FOLGA_NDC;
      _rAlvo[2] += FOLGA_NDC; _rAlvo[3] += FOLGA_NDC;
    }
  }

  let andando = false;

  /* Folga do degrau mais barato. 1,4·alvoR cobre o raio do cone em qualquer
     `t ≤ 1` (o máximo é 1,38·alvoR), então rejeitar aqui nunca descarta um
     candidato que o cone aceitaria. */
  const folgaR = alvoR * 1.4 + 1.2;

  for (const s of solidos) {
    /* Rejeição em três degraus, do mais barato ao mais caro: esfera contra o
       eixo, caixa contra o cone, e só então a silhueta em tela. */
    const want = temAlvo
      && distEixo(s.cx, s.cy, s.cz) <= s.r + folgaR
      && noCorredor(s.box)
      && tapa(s.box, s.want === 1) ? 1 : 0;
    s.want = want;
    if (s.hide !== want) {
      s.hide = passo(s.hide, want, dt);
      escrever(s);
      if (s.hide !== want) andando = true;
    }
  }

  for (const g of grupos) {
    for (let i = 0; i < g.n; i++) {
      let want = 0;
      if (temAlvo
        && distEixo(g.esferas[i * 4], g.esferas[i * 4 + 1], g.esferas[i * 4 + 2])
          <= g.esferas[i * 4 + 3] + folgaR) {
        _bx.min.set(g.boxes[i * 6], g.boxes[i * 6 + 1], g.boxes[i * 6 + 2]);
        _bx.max.set(g.boxes[i * 6 + 3], g.boxes[i * 6 + 4], g.boxes[i * 6 + 5]);
        if (noCorredor(_bx) && tapa(_bx, g.want[i] === 1)) want = 1;
      }
      g.want[i] = want;
      if (g.hide[i] !== want) {
        g.hide[i] = passo(g.hide[i], want, dt);
        g.sujo = true;
        if (g.hide[i] !== want) andando = true;
      }
    }
    /* UMA subida por grupo por quadro, e só se algo mudou. Casca e copa recebem
       o MESMO vetor: é o que garante que a árvore vá inteira. */
    if (g.sujo) {
      g.sujo = false;
      for (const a of g.attrs) {
        (a.array as Float32Array).set(g.hide.subarray(0, Math.min(g.n, a.count)));
        a.needsUpdate = true;
      }
    }
  }

  return andando;
}

/** Para o console e para a bancada. */
export function getSeeThrough() {
  const escondidos: string[] = [];
  let solidosOcultos = 0, plantasOcultas = 0;
  for (const s of solidos) {
    if (s.want) {
      solidosOcultos++;
      if (escondidos.length < 12) escondidos.push(s.mesh.name || '(sem nome)');
    }
  }
  for (const g of grupos) {
    for (let i = 0; i < g.n; i++) if (g.want[i]) plantasOcultas++;
  }
  return {
    alvo: !!alvoBox,
    /* A caixa do conjunto, para a bancada poder medir profundidade contra ela —
       é a trava de "nada atrás do caminhão é escondido". */
    alvoCaixa: alvoBox
      ? [alvoBox.min.x, alvoBox.min.y, alvoBox.min.z,
        alvoBox.max.x, alvoBox.max.y, alvoBox.max.z]
      : null,
    raioAlvo: alvoR,
    solidos: solidos.length,
    grupos: grupos.length,
    plantas: grupos.reduce((s, g) => s + g.n, 0),
    solidosOcultos,
    plantasOcultas,
    escondidos,
  };
}
