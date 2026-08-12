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

   O PLANO DE CORTE OBLÍQUO. Sem ele a câmera espelhada enxerga o que está ABAIXO
   do piso, e há geometria lá: a caixa do rig começa em y = −0,21 m. O resultado
   seria a barriga do implemento vazando pelo reflexo perto do ponto de contato.
   `makeOblique()` empurra o plano near da projeção para o próprio plano do piso,
   que é a solução clássica (Lengyel) e custa uma multiplicação de matriz. */
import * as THREE from 'three';
import { renderer, scene, camera as liveCamera } from './scene';

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
  /* O mapa de sombra é o da cena, já corrente. Refazê-lo para a passada de
     reflexo dobraria o custo por uma diferença que a metade da resolução e o
     borrão por distância não carregam. */
  renderer.shadowMap.autoUpdate = false;
  renderer.setRenderTarget(rt);
  renderer.clear();
  renderer.render(scene, reflector);
  renderer.setRenderTarget(prevTarget);
  renderer.shadowMap.autoUpdate = prevShadow;
  plane.visible = wasVisible;
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

/** Libera o alvo. Chamado quando o estúdio solta a cena. */
export function disposeFloorReflection() {
  target.rt?.dispose();
  target.rt = null;
  target.w = target.h = 0;
  uniforms.tReflect.value = null;
  clients.clear();
}

/** A câmera viva, para quem só quer a passada padrão. */
export const liveReflectionCamera = () => liveCamera;
