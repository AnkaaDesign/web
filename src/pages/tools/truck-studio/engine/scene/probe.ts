/* Local reflection probe — what the chrome actually reflects.
   ---------------------------------------------------------------------------
   `scene.environment` is the scenario's HDRI: a photograph of somewhere else,
   standing in for the rest of the map. Every `metalness: 1` surface on the
   vehicle mirrors it, so the implement reflects a horizon and a treeline while
   parked two metres from a warehouse wall that is right there in the scene. On a
   15 m rail the HDRI's horizon draws a hard line that slides as the camera moves,
   which is what kept reading as a rendering fault on the flank.

   An image-based environment cannot know about local geometry. The only thing
   that can is a render FROM the vehicle's position, which is what this is: one
   CubeCamera pass over the scene with the vehicle itself hidden, prefiltered
   through PMREM so roughness still blurs it correctly, then bound as `envMap` on
   the vehicle's own materials. `scene.environment` is left alone and keeps
   lighting everything else.

   WHAT IT COSTS, AND WHY THAT IS ACCEPTABLE. Six faces at 256² over the full
   scene, plus a PMREM bake. That is expensive per invocation and worthless per
   frame — a parked trailer's surroundings do not change — so it runs on the
   events that actually invalidate it: a new scenario, a new cab, the implement
   moving. Never in the render loop.

   THE VEHICLE MUST BE HIDDEN. A probe that can see the truck bakes the truck's
   own panels into the reflection, and the flank then mirrors itself — a white
   smear that looks exactly like the defect this replaces. Hidden, not moved: the
   camera sits inside the vehicle's own volume, and its near plane is set past the
   bodywork so nothing else nearby clips in.

   WHAT IT IS NOT. This is a single probe, captured once, from one point. It is a
   correct reflection only for a surface AT that point; a rail 7 m away reflects
   the world as seen from the middle of the trailer. For a vehicle configurator
   that is the right trade — it puts the real building in the metal instead of a
   photograph of a field, and no viewer is going to check the parallax. */
import * as THREE from 'three';
import { renderer, scene } from './scene';
import { getProfile } from '../core/quality';

/** Cube face resolution. 256 is plenty once PMREM has blurred it by roughness.
 *
 *  DO PERFIL, e FUNÇÃO em vez de constante porque o nível pode mudar no meio da
 *  sessão — um valor congelado no tempo de import entregaria para sempre o
 *  tamanho do nível em que a página abriu.
 *
 *  Por que ele vale um botão: esta sonda faz SEIS renderizações completas da
 *  cena mais um PMREM a cada troca de cenário ou de cavalo — da ordem de 14 000
 *  chamadas de desenho num único quadro. Nunca no laço, mas numa GPU integrada
 *  é um engasgo visível bem no momento em que o usuário está olhando. Cair para
 *  128 corta 75 % do preenchimento dessas seis passadas (a geometria continua a
 *  mesma), e o resultado passa por PMREM logo em seguida, que borra por
 *  rugosidade — é amostragem, não decisão visual. */
const probeSize = () => getProfile().probeSize;
/** Past the bodywork the camera sits inside, so the truck cannot clip in. */
const PROBE_NEAR = 2.5;
const PROBE_FAR = 400;

let rt: THREE.WebGLCubeRenderTarget | null = null;
let cubeCam: THREE.CubeCamera | null = null;
/** O alvo do PMREM, REUSADO entre capturas. Ver o bloco de `assarPmrem()`. */
let pmremRT: THREE.WebGLRenderTarget | null = null;
let pmrem: THREE.PMREMGenerator | null = null;
let baked: THREE.Texture | null = null;

/* ===========================================================================
   ⚠️⚠️ POR QUE ESTE MÓDULO TEM UM `PMREMGenerator` PRÓPRIO, e NÃO usa o
   `pmrem` compartilhado que `scene.ts` exporta — apesar de a própria
   documentação do three dizer "you should not need more than one".
   ===========================================================================
   Porque as duas coisas juntas — alvo reusado E gerador compartilhado — formam
   uma armadilha silenciosa, e ela está no código do three:

     `_fromTexture(texture, renderTarget)` chama `_setSize()` SEMPRE (o
     `_cubeSize` acompanha a fonte), mas só chama `_allocateTargets()` quando
     `renderTarget` é nulo. E é dentro de `_allocateTargets()` que moram o
     `_pingPongRenderTarget`, os `_lodPlanes` e o `_blurMaterial` — todo o
     rascunho do borrão, dimensionado pelo `_cubeSize` DAQUELA chamada.

   Ou seja: dois consumidores de tamanhos diferentes, cada um passando o próprio
   alvo em cache, param de realocar o rascunho — e o segundo passa a borrar com
   um ping-pong dimensionado para o primeiro. `scene/skyblend.ts` assa equirect
   de 2048x1024 (`_cubeSize` 512); esta sonda assa cubo de 256 ou 128. Não são o
   mesmo número, e a divergência não dá erro: dá reflexo errado.

   Um gerador por tamanho de fonte é a forma de não ter esse acoplamento. O custo
   é um `_blurMaterial` e uma pirâmide de planos a mais em VRAM, que é troco
   perto do que a confusão custaria para achar.

   ⚠️ E POR ISSO `disposeReflectionProbe()` PODE descartar este gerador: ele é
   nosso. Descartar o de `scene.ts` daqui apagaria o borrão do céu misturado. */

export interface ProbeOptions {
  /** World point to capture from — normally the middle of the rig. */
  at: THREE.Vector3;
  /** Hidden for the capture. The vehicle must not see itself. */
  hide: THREE.Object3D[];
}

/**
 * Capture the scene from `at` and return a prefiltered environment texture.
 * Returns null if the capture could not run; callers keep the HDRI in that case.
 *
 * The returned texture is owned here and disposed on the next call, so callers
 * must re-read it rather than hold it across refreshes.
 */
export function captureReflectionProbe(opts: ProbeOptions): THREE.Texture | null {
  try {
    /* O ALVO É CACHEADO E O TAMANHO É DO PERFIL, então o cache tem de conferir
       o tamanho — não só a existência. Sem a segunda condição, uma sessão que
       abrisse em Alta e caísse para Baixo continuaria sondando a 256² para
       sempre, e o botão pareceria não fazer nada (que é exatamente a classe de
       defeito que esta passagem existe para corrigir). Trocar de tamanho é raro:
       acontece na mudança de nível, não a cada sonda. */
    const side = probeSize();
    if (rt && rt.width !== side) {
      rt.dispose(); rt = null;
      /* ⚠️ O ALVO DO PMREM CAI JUNTO, E ISSO É OBRIGATÓRIO — não é limpeza
         defensiva. Enquanto `pmremRT` for passado de volta, o three PULA
         `_allocateTargets()`, e é lá dentro que o `_pingPongRenderTarget` e os
         `_lodPlanes` são redimensionados pelo `_cubeSize` novo. Guardar o alvo
         de 256 e assar uma fonte de 128 nele borraria com a pirâmide errada.
         Soltando os dois, a próxima assadura realoca tudo em conjunto. */
      pmremRT?.dispose(); pmremRT = null;
      /* A câmera segura a referência ao alvo; um alvo novo pede uma câmera nova. */
      cubeCam = null;
    }
    if (!rt) {
      rt = new THREE.WebGLCubeRenderTarget(side, { type: THREE.HalfFloatType });
    }
    if (!pmrem) {
      pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileCubemapShader();
    }
    /* ⚠️ A CÂMERA É REUSADA, e não construída por captura. `new CubeCamera()`
       monta SEIS `PerspectiveCamera` e um `Group`, e a sonda dispara em cadeia
       na carga (cenário novo, cabine nova, implemento movido, troca de fundo do
       ciclorama). Não é o custo dominante desta função — as seis renderizações
       são —, mas é lixo que nasce exatamente no instante de engasgo, que é o
       pior instante possível para dar trabalho ao coletor. */
    if (!cubeCam) cubeCam = new THREE.CubeCamera(PROBE_NEAR, PROBE_FAR, rt);
    const cam = cubeCam;
    cam.position.copy(opts.at);
    cam.updateMatrixWorld(true);

    const wasVisible = opts.hide.map((o) => o.visible);
    opts.hide.forEach((o) => { o.visible = false; });
    /* The shadow map is not re-rendered for the probe: it is the scene's own,
       already current, and six extra depth passes would double the cost for a
       difference no reflection at this resolution can carry. */
    const autoUpdate = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    try {
      cam.update(renderer, scene);
    } finally {
      renderer.shadowMap.autoUpdate = autoUpdate;
      opts.hide.forEach((o, i) => { o.visible = wasVisible[i]; });
    }

    /* ---- O ALVO DO PMREM É REUSADO, e é a mesma receita de `skyblend.ts` ----
       `fromCubemap(cubemap, renderTarget)` aceita o alvo de volta e escreve
       NELE. Antes, cada captura alocava um alvo novo (256² viram uma folha
       cubeUV de 768 × 1024 em `HalfFloat`) e descartava o anterior — alocar e
       liberar VRAM é justamente o que faz um driver de memória compartilhada
       parar para respirar, e a sonda dispara em cadeia na carga.

       ⚠️ E O EFEITO COLATERAL BOM É A IDENTIDADE ESTÁVEL: `baked` passa a ser
       sempre a MESMA `Texture`. Quem consome (`refreshVehicleReflection()` em
       vehicle/models.ts) escreve `m.envMap = tex; m.needsUpdate = true` em todo
       material do veículo; com a textura mudando de identidade, o three tinha de
       subir uma textura nova e soltar a velha a cada sonda. Com ela estável, a
       reatribuição é um no-op de GPU. */
    const alvo = pmrem.fromCubemap(rt.texture, pmremRT || undefined);
    /* Só depois de a assadura VOLTAR: `fromCubemap` pode lançar num contexto
       perdido, e adotar o alvo antes disso deixaria o veículo apontando para um
       alvo meio escrito em vez de manter o anterior, velho mas correto. */
    pmremRT = alvo;
    baked = alvo.texture;
    return baked;
  } catch (e: unknown) {
    console.warn('[probe] captura falhou — os metais seguem no HDRI.',
      e instanceof Error ? e.message : String(e));
    return null;
  }
}

/** Free everything. Called when the studio unmounts. */
export function disposeReflectionProbe() {
  /* `baked` É A TEXTURA DE `pmremRT`, não um objeto independente — soltar o alvo
     já solta a textura dele. Um `baked.dispose()` a mais aqui era inofensivo
     antes (a textura era descartável), e passa a ser ruído agora que a
     identidade é a do alvo: descartar os dois emitiria dois eventos de dispose
     para o mesmo recurso. */
  baked = null;
  pmremRT?.dispose();
  pmremRT = null;
  rt?.dispose();
  rt = null;
  cubeCam = null;
  pmrem?.dispose();
  pmrem = null;
}
