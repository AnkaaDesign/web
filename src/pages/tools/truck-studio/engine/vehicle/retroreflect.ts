/* A FITA REFLETIVA REFLETE — retrorreflexão nas faixas 3M do implemento.
   ===========================================================================
   O PEDIDO: *"preciso que as faixas refletivas realmente reflitam as luzes"*.

   O QUE ELA ERA. `Faixa-3M` (76 primitivas no `trailer.glb`, mais
   `faixa3M-parachoque-traseiro`) é um `MeshStandardMaterial` comum: textura de
   cor, normal map, e nada mais. O brilho dela vinha só do ambiente, então à noite
   ela ficava exatamente tão apagada quanto a chapa branca ao lado — que é o
   oposto do que aquela fita existe para fazer.

   ===========================================================================
   POR QUE NÃO É `emissive`, E POR QUE NÃO É BRILHO ESPECULAR.

   `emissive` está errado por definição: uma fita retrorrefletiva não emite nada.
   Acesa sem fonte ela viraria uma lanterna — e a diferença entre fita e lanterna é
   justamente que a fita APAGA quando não há luz sobre ela. Foi a primeira coisa
   descartada.

   Brilho especular comum também não serve, e a razão é geométrica: um espelho
   devolve a luz no ângulo REFLETIDO (em torno de `reflect(-L, N)`), então ele
   acende quando a câmera está do outro lado da normal. Um retrorrefletor devolve a
   luz **de volta para a fonte** — as microesferas/microprismas fazem o raio sair
   paralelo ao que entrou. Ou seja o lóbulo dele não é em torno de `R`, é em torno
   de **`L`**. É por isso que a fita de um caminhão acende quando você a olha DE
   PERTO DA LUZ (o farol do seu carro, o flash da câmera) e some quando você a olha
   de lado.

   Então a conta é sobre o ÂNGULO DE OBSERVAÇÃO — o ângulo entre "para a fonte" e
   "para o olho":

       retro = Σ_luzes   cor_luz · max(N·L, 0) · ( BASE + GANHO · pow(max(L·V,0), K) )
                          \______/   \________/            \_______________________/
                        já traz a     ângulo de              ângulo de OBSERVAÇÃO
                        atenuação     ENTRADA                (1 quando a fonte
                        do spot                               está no olho)

   ===========================================================================
   OS NÚMEROS SÃO DE COMPOSIÇÃO, NÃO DE FOTOMETRIA — e isso é uma decisão, não um
   descuido.

   Lâmina prismática grau diamante tem coeficiente de retrorreflexão R_A da ordem
   de 500 cd/lx/m² a 0,2° de observação, caindo para ~10 a 2°. Um lóbulo tão
   fechado (K na casa dos milhares) seria FISICAMENTE certo e INVISÍVEL aqui: o
   estúdio orbita a câmera livremente e as fontes são postes a 9 m de altura e
   metros de distância do eixo do olhar, então o ângulo de observação real fica
   quase sempre entre 10° e 60°. Um retrorrefletor exato nunca acenderia numa foto
   deste produto, e entregar isso seria entregar nada.

   Então o lóbulo é ALARGADO de propósito (K = 4) e ganha um piso (BASE = 0,30) que
   é a parte "esta superfície é muito mais clara que a chapa ao lado", que é o que
   o olho lê como fita refletiva. O piso continua multiplicado por `N·L` e pela cor
   da luz: **sem fonte, continua zero.** É o que separa isto de um emissivo, e é o
   requisito que o pedido tem embutido.

   ===========================================================================
   DE ONDE VÊM AS LUZES: DAS PRÓPRIAS DO THREE, e não de um uniforme nosso.

   A tentação era passar as posições do pool de `lamps.ts` num array de uniformes.
   Não é preciso e seria uma segunda fonte de verdade: dentro do fragmento de um
   `MeshStandardMaterial` já existem `spotLights[]`, `directionalLights[]` e
   `pointLights[]`, com `getSpotLightInfo()` aplicando cone, penumbra e queda por
   distância. Injetar depois de `<lights_fragment_end>` dá acesso a tudo isso já
   pronto e sempre em sincronia — inclusive com os feixes do VEÍCULO, que
   `vehicle/beams.ts` põe no mesmo pool. O farol acendendo a fita do próprio
   implemento é, literalmente, o pedido.

   O QUE ISTO NÃO FAZ: sombra. O three atenua sombra dentro do laço desenrolado de
   `<lights_fragment_begin>`, não dentro de `getSpotLightInfo()`, e replicar aquele
   laço (com `UNROLLED_LOOP_INDEX` e os mapas) para uma faixa de 5 cm de altura não
   se paga. A fita brilha um pouco mesmo na sombra de si mesma; a 12 m de
   distância isso não se distingue.

   ⚠️ NADA DE CRASE NOS BLOCOS DE GLSL. São template strings de JS, e uma crase de
   citação em comentário fecha o literal — já quebrou o bundle três vezes neste
   projeto. */
import * as THREE from 'three';

/**
 * Quem é fita refletiva.
 *
 * Medido no `trailer.glb`: `Faixa-3M` (76 primitivas, x ±1,3 · y 1,3…4,1 ·
 * z −7,5…7,1 — a faixa de contorno e a da saia) e `faixa3M-parachoque-traseiro`
 * (1 primitiva, no para-choque). Os bakes de cavalo não têm fita nomeada; o dia
 * em que tiverem, o nome cai nesta regra sem mudança nenhuma.
 *
 * O corte é por NOME e não pela declaração do asset porque, ao contrário das
 * lâmpadas, não há declaração: retrorreflexão não existe em glTF. É um material do
 * NOSSO arquivo, versionado com o produto — a mesma razão pela qual as lanternas
 * do implemento podem confiar no nome (ver o cabeçalho de `lights.ts`).
 */
const FITA_RE = /faixa.?3m|retro.?reflet|reflective.?tape|conspicuity/i;

/**
 * O expoente do lóbulo de observação. 4 é largo de propósito — ver o cabeçalho.
 *
 * O que ele controla: a 0° de observação o termo vale 1; a 45°, `cos⁴45° = 0,25`;
 * a 75°, 0,004. Ou seja a fita ainda responde bem quando a fonte está a meio
 * caminho entre o olho e a normal, e apaga quando se olha de lado — que é o
 * comportamento que distingue a fita da chapa, na escala em que este produto é
 * fotografado.
 */
const RETRO_K = 4.0;
/** Pico do lóbulo, com a fonte no eixo do olhar. */
const RETRO_GANHO = 2.6;
/** O piso "esta superfície é fita", ainda multiplicado por N·L e pela cor da luz. */
const RETRO_BASE = 0.30;

/* ⚠️ ESTA FUNÇÃO ENTRA DEPOIS DE `<common>`, NÃO NO PONTO DA INJEÇÃO — e não é
   estilo, é a única posição que compila. `<lights_fragment_end>` fica DENTRO de
   `void main()`, e GLSL não admite função aninhada: pôr o corpo ali dá
   `ERROR: '{' : syntax error` em todo material de fita (medido, quatro variantes
   do `Faixa-3M`, todas reprovadas na bancada).
   E tem de ser depois de `<common>`, não no topo do arquivo: é `<common>` que
   declara `struct IncidentLight`, e o three só resolve os `#include` DEPOIS de
   `onBeforeCompile` — prefixar o shader inteiro poria a função antes do tipo que
   ela usa. */
const PARS_SOLTO = /* glsl */`
vec3 tsRetroTermo( const in vec3 luzCor, const in vec3 luzDir,
  const in vec3 n, const in vec3 v ) {
  float entrada = max( dot( n, luzDir ), 0.0 );
  float observacao = max( dot( luzDir, v ), 0.0 );
  return luzCor * entrada * ( TS_RETRO_BASE + TS_RETRO_GANHO * pow( observacao, TS_RETRO_K ) );
}
`;

/** O mesmo bloco, com o `#include` que ele substitui recolocado na frente. */
const PARS = '#include <common>\n' + PARS_SOLTO;

/* DEPOIS de `lights_fragment_end` e somando em `directSpecular`, não em
   `outgoingLight`: `<opaque_fragment>` monta `outgoingLight` a partir de
   `totalDiffuse + totalSpecular + totalEmissiveRadiance`, então somar DEPOIS dele
   não faz nada (armadilha já registrada nesta base, em ceiling.ts). E
   `directSpecular` em vez de `directDiffuse` porque `<aomap_fragment>` multiplica
   o indireto pelo AO e o direto não — a retrorreflexão não é oclusa por AO de
   textura, ela é um caminho óptico próprio.

   Os laços são simples, sem `#pragma unroll_loop_start`: o three troca
   `NUM_SPOT_LIGHTS` por um literal antes de compilar (replaceLightNums roda antes
   de unrollLoops), então o limite é constante e o driver desenrola sozinho. O
   pragma só é necessário para indexar os arrays de SOMBRA, que este bloco não usa. */
const MAIN = /* glsl */`
#include <lights_fragment_end>
{
  vec3 tsRetro = vec3( 0.0 );
  IncidentLight tsLuz;
  #if ( NUM_DIR_LIGHTS > 0 )
    for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
      getDirectionalLightInfo( directionalLights[ i ], tsLuz );
      tsRetro += tsRetroTermo( tsLuz.color, tsLuz.direction, geometryNormal, geometryViewDir );
    }
  #endif
  #if ( NUM_SPOT_LIGHTS > 0 )
    for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
      getSpotLightInfo( spotLights[ i ], geometryPosition, tsLuz );
      tsRetro += tsRetroTermo( tsLuz.color, tsLuz.direction, geometryNormal, geometryViewDir );
    }
  #endif
  #if ( NUM_POINT_LIGHTS > 0 )
    for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
      getPointLightInfo( pointLights[ i ], geometryPosition, tsLuz );
      tsRetro += tsRetroTermo( tsLuz.color, tsLuz.direction, geometryNormal, geometryViewDir );
    }
  #endif
  /* A COR DA FITA ENTRA, e é o que faz a faixa vermelha devolver vermelho e a
     branca devolver branco: diffuseColor.rgb ja e o albedo texturizado do
     material naquele fragmento. Sem isto a fita inteira devolveria a cor da
     lampada e as faixas alternadas sumiriam.
     NADA DE CRASE AQUI — ver o aviso no cabecalho deste arquivo. */
  reflectedLight.directSpecular += tsRetro * diffuseColor.rgb;
}
`;

const instalados = new WeakSet<THREE.Material>();
let contados = 0;

function injetar(mat: THREE.MeshStandardMaterial) {
  if (instalados.has(mat)) return false;
  instalados.add(mat);
  const antesCompile = mat.onBeforeCompile;
  const antesChave = mat.customProgramCacheKey;
  const num = (v: number) => v.toFixed(4);
  mat.onBeforeCompile = function (shader, renderer) {
    /* ENCADEIA em vez de substituir: estes materiais já passam por
       `material-setup.ts` e podem passar por `livery-layers.ts`; sobrescrever o
       gancho apagaria o que eles fazem sem erro nenhum. */
    if (antesCompile) antesCompile.call(this, shader, renderer);
    /* O ALVO PODE JÁ TER SIDO CONSUMIDO por outro módulo da cadeia — `paint.ts` e
       `material-setup.ts` também injetam, e quem roda antes pode ter substituído
       o `#include <common>`. Se ele não estiver mais lá, a função entra logo antes
       de `void main(`, que serve igual: o que ela precisa é que `struct
       IncidentLight` (de `<common>`) já esteja declarada, e `<common>` sempre vem
       antes de `main`. Sem esta rede, o `.replace()` viraria um no-op silencioso e
       o shader morreria com "tsRetroTermo undefined" no rAF. */
    let frag = shader.fragmentShader;
    frag = frag.includes('#include <common>')
      ? frag.replace('#include <common>', PARS)
      : frag.replace('void main(', PARS_SOLTO + '\nvoid main(');
    shader.fragmentShader = frag
      .replace('#include <lights_fragment_end>', MAIN)
      .replace(/TS_RETRO_BASE/g, num(RETRO_BASE))
      .replace(/TS_RETRO_GANHO/g, num(RETRO_GANHO))
      .replace(/TS_RETRO_K/g, num(RETRO_K));
  };
  /* Sem isto o three serve o programa CACHEADO, sem a injeção, para o segundo
     material em diante — a chave de cache dele não conhece onBeforeCompile. */
  mat.customProgramCacheKey = function () {
    return 'ts-retro-v1|' + (antesChave ? antesChave.call(this) : '');
  };
  mat.needsUpdate = true;
  return true;
}

/**
 * Instala a retrorreflexão nas fitas de `root`. Idempotente.
 *
 * Chamado por `setupCommon()`, ao lado de `registerVehicleLights()` — é o ponto
 * por onde TODA raiz de veículo passa. Vale para o material, não para a malha, e
 * é isso que faz a injeção sobreviver ao redimensionamento: `trailer-assembly.ts`
 * troca as 76 primitivas de fita por `InstancedMesh` compartilhando o MESMO
 * material, e a instância nasce com o programa já injetado.
 *
 * @returns quantos materiais novos receberam a injeção.
 */
export function registerRetroreflective(root: THREE.Object3D | null | undefined) {
  if (!root) return 0;
  let n = 0;
  const vistos = new Set<THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial;
      if (!mat || vistos.has(mat)) continue;
      vistos.add(mat);
      if (!FITA_RE.test(mat.name || '')) continue;
      if (injetar(mat)) { n++; contados++; }
    }
  });
  return n;
}

/** Para o console e para a bancada. */
export function getRetroreflective() {
  return { materiais: contados, k: RETRO_K, ganho: RETRO_GANHO, base: RETRO_BASE };
}
