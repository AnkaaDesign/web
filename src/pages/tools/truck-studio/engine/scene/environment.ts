/* Swappable photoreal environments: an HDRI sky + image-based lighting, a real
   3D set (scene/set.ts) for the ground and everything standing on it, an
   optional street-lamp model, and the light preset toggled to match.
   ---------------------------------------------------------------------------
   This module owns the POLICY (which asset, when to load it, what to cache,
   when to dispose). scene.ts owns the mechanism and exposes exactly the hooks
   needed: setExternalEnvironment / setExposureBase / setSkyDomeVisible /
   setLamps / setLampModel / setHorizonHaze / setHorizonTint /
   setInteriorBounds, plus its PMREMGenerator. set.ts owns the .glb and, with
   it, every ground texture in the scene.

   WHAT THIS MODULE STOPPED DOING (2026-08-03), because the shape of the file
   only makes sense against it. The catalogue used to carry three PHOTO-BACKED
   scenes — `rodovia`, `patio-logistico`, `urbano`: an equirect panorama plus a
   procedural CG floor, i.e. a ground-projected dome (GroundedSkybox), a
   two-band near field with its own 2k/4k shared PBR ground sets, scattered
   props, a shadow catcher and a camera-containment clamp. Those scenes were
   removed from the manifest and every one of those mechanisms went with them.
   The two that remain — `distrito-industrial` and `armazem` — stand on
   MODELLED geometry, and set.ts binds the set's own textures from
   `set.materials.<NAME>`, an entirely separate path: this file no longer
   downloads a ground texture at all. What is left is the HDRI → PMREM path,
   the per-environment LRU that owns those PMREMs, the optional lamp .glb,
   the validation of the manifest's `set` block, and one progress bar spanning
   the three.

   WHY THE PMREM IS USED FOR scene.background TOO (and not the raw equirect)

   1. No VRAM duplication. Assign a raw equirect to scene.background and three
      builds its OWN copy behind your back: WebGLCubeMaps renders it into a
      cube render target sized image.height, or — the moment
      backgroundBlurriness > 0 — WebGLCubeUVMaps builds a SECOND PMREM with its
      own generator. Hand it a texture that is already CubeUV and
      WebGLCubeUVMaps.get() returns it untouched.
   2. envDef.backgroundBlur would otherwise be silently ignored: blurriness is
      only sampled in the ENVMAP_TYPE_CUBE_UV branch of three's backgroundCube
      shader, which a plain cube texture never reaches.
   3. It lets us dispose the source .hdr immediately — a 2k HDR is ~16 MB of
      half-float that nothing would ever sample again. (buildSkyEnv() in
      scene.ts does the same with its canvas.)
   4. Sharpness is fine: PMREM mip 0 is image.width / 4 per cube face, so a 2k
      HDRI gives 512 px faces — and a hero render wants a slightly soft sky
      behind the truck anyway.

   VRAM: the PMREM render target is 3·cubeSize x 4·cubeSize half-float RGBA
   ≈ 25 MB for a 2k source, ≈ 100 MB for a 4k one. The engine is a singleton
   that outlives the React page (see studio.ts), so the cache is capped and every
   eviction disposes the render target, not just its texture.

   ---------------------------------------------------------------------------
   THE SET IS THE GROUND  (envDef.set — scene/set.ts)

   Both shipped scenes name a `set`: a Draco'd .glb with modelled asphalt,
   kerbs, painted lines, racking and buildings. Three consequences for this
   module, and they are the reason the file is as small as it is:

     a) NO PROCEDURAL FLOOR TO ARBITRATE AGAINST. There is no dome to project
        a photo's floor over the modelled asphalt, no disc to lay on top of it,
        no 340 m strip underneath it and no shadow catcher to double the
        truck's shadow — none of those mechanisms exist any more, so there are
        no guards here either.
     b) THE SET'S TEXTURES ARE NOT OURS. `set.materials` names files per
        MATERIAL NAME, and set.ts binds them against the material names it
        actually finds in the .glb (bindMaterials()). A material named in the
        manifest but absent from the .glb is silently never fetched — which is
        exactly what makes an unused entry there free rather than a 404.
     c) THE HDRI STAYS. It is still the sky and, more importantly, still the
        IBL the paint reflects. `armazem` is the counter-example that proves it
        is optional: `hdri: null`, lit only by its own emissive strips.

   The one asset this module still downloads besides the HDRI is `lamps.model`
   — see the lamp-model section — and the set .glb, which it delegates to
   applySet() and only folds into the progress bar.
*/
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import {
  pmrem, applyPreset, setTimeOfDay, setHourOfDay, OPEN_HOUR, LIGHT_DEFAULTS,
  setExternalEnvironment, setExposureBase, getSkyMix,
  setSkyDomeVisible, setLamps, setLampModel,
  setHorizonHaze, setHorizonTint, setInteriorBounds,
} from './scene';
import { LIGHT_PRESETS } from './presets';
import { applySet, disposeSet, disposeSetTextures } from './set';
import { setCyclorama } from './cyclorama';
import { setSkyPair, disposeSkyBlend } from './skyblend';
import { disposeLampSiteLenses } from './lamps';
import type { SetDef, SetMaterialDef } from './set';
import { loadGLB } from '../vehicle/models';
import { prefetch } from '../core/prefetch';
import { assetUrl } from '../catalog/catalog';
import type { EnvironmentDef, RawBlock } from '../catalog/catalog';
import {
  getProfile, onQualityChange, hdrVariant,
} from '../core/quality';

/* ---------------- tipos ----------------
   O manifesto chega tipado de catalog.ts, mas os blocos que ele repassa crus
   (`set`, `lamps`) são RawBlock: é ESTE módulo que os valida, então tudo que
   sai deles entra como `unknown` e só vira número/string depois de passar por
   num()/path(). Os tipos que este módulo constrói a partir do bloco `set`
   moram em set.ts (SetDef/SetMaterialDef) — nada aqui duplica o contrato do
   catálogo. */

const rgbeLoader = new RGBELoader();

/* O manifesto tem 3 cenários (dois com HDRI e o estúdio, que não tem nenhum),
   então na prática quase nada é despejado — a LRU existe para que um manifesto
   editado à mão com 20 cenas não coma um gigabyte de VRAM pelo resto da sessão.
   O teto continua em 3 (e não em 2) nos níveis Alto e Médio de propósito: é uma
   folga, não uma contagem, e baixá-lo para o tamanho exato do catálogo faria a
   próxima cena adicionada despejar em toda troca.

   VEM DO PERFIL DESDE 2026-08-14 (`envCacheMax`: 3 / 3 / 2). Cada entrada com
   par de céus são dois equirects crus 2k meio-float — ~16,8 MB cada — e cada
   entrada de plate único é um PMREM de ~25 MB. Numa integrada de memória
   compartilhada um slot a menos é um item inteiro do orçamento; o que se perde é
   VELOCIDADE DE VOLTA a um cenário visitado antes (o download volta a acontecer,
   ou pelo menos a decodificação RGBE), nunca imagem.

   ⚠️ FUNÇÃO, não `const`: o nível muda no meio da sessão. Ver `podar()`. */
const maxCache = () => Math.max(1, getProfile().envCacheMax);

/* SÓ o PMREM. Os outros cinco campos (`sky`, `bg`, `ground`, `near`, `macro`)
   saíram em 2026-08-03 com o domo projetado e a faixa próxima: o equirect cru
   só existia para o domo amostrar, o `bg` era a foto do domo, e os três de chão
   apontavam para o cache compartilhado de conjuntos PBR que já não existe. As
   texturas do set são de set.ts, que tem o próprio descarte
   (disposeSetTextures). */
interface CacheEntry {
  rt: THREE.WebGLRenderTarget | null;
  /* O PAR DE CÉUS, e por que ele guarda o equirect CRU quando `rt` não guarda.
     -------------------------------------------------------------------------
     Um cenário com `hdriNight` atravessa de um plate para o outro em função da
     hora (scene/skyblend.ts), e cada mistura é um passe que LÊ os dois lados —
     então aqui o equirect não pode ser descartado depois de assar, como
     `toPmrem()` faz no caminho de um plate só. O que fica de fora do cache é o
     alvo da mistura e o PMREM dele: são 41 MB, valem para UMA cena por vez, e
     skyblend os solta na troca. Voltar ao cenário reassa em ~20 ms a partir
     destes dois, que é o que se quer guardar (o download e a decodificação). */
  dia?: THREE.DataTexture | null;
  noite?: THREE.DataTexture | null;
}
/* A CHAVE É A URL DO PAR DE HDRs, e ISSO É A CORREÇÃO DE UM DESPERDÍCIO REAL.
   ---------------------------------------------------------------------------
   Era `envDef.id`. E o manifesto de hoje tem DOIS cenários — `distrito-industrial`
   e `serra` — que apontam para os MESMOS dois arquivos:

     environments/distrito-industrial/sky.hdr
     environments/distrito-industrial/sky-night.hdr

   (o que difere entre eles é o `set.glb`, que é de set.ts e tem cache próprio).
   Com a chave no id, visitar os dois DECODIFICAVA o par duas vezes e retinha
   duas cópias idênticas: 4 × 16,8 MB ≈ **33,6 MB de VRAM desperdiçada**, mais um
   segundo parse RGBE de ~5,8 MB comprimidos. Chaveando pela URL as duas entradas
   viram uma, e a segunda visita nem chega a pedir bytes.

   A CHAVE INCLUI A VARIANTE, porque ela está dentro da própria URL
   (`sky@1k.hdr`): um par assado em 1024×512 não pode ser servido para quem
   pediu o de 2048, e vice-versa. Cai de graça — nada a fazer.

   POR QUE NÃO MEMOIZAR `loadHdr` POR URL, que era a outra saída possível: a
   `CacheEntry` é DONA das texturas (`disposeEntry` as descarta), e uma promessa
   memoizada por fora criaria um segundo dono para o mesmo objeto — descartar
   uma entrada mataria a textura que a outra ainda usa. Chavear o cache que já
   existe resolve o mesmo problema com UM dono.
   ⚠️ E é o defeito que `lampModels` (logo abaixo) tem e que não se repete aqui:
   aquele Map memoiza INCLUSIVE as falhas, nunca despeja e nunca descarta — é a
   única superfície de crescimento monótono deste módulo. Aqui a política de não
   cachear um HDRI que falhou continua valendo (ver `cacheable`). */
function hdriKey(envDef: EnvironmentDef): string | null {
  const d = path(envDef.hdri);
  if (!d) return null;      // sem HDRI não há nada que valha um slot de cache
  const n = path(envDef.hdriNight);
  return assetUrl(hdrPath(d)) + '|' + (n ? assetUrl(hdrPath(n)) : '');
}

/** @type {Map<string, CacheEntry>} */
const cache = new Map<string, CacheEntry>();

let current: EnvironmentDef | null = null;        // the applied envDef
/** A CHAVE da entrada que está na tela. Guardada em vez de recalculada de
 *  `current`: `hdriKey()` lê `hdrVariant()`, que muda com o nível, e uma chave
 *  recalculada depois de uma troca de nível não casaria com aquela sob a qual a
 *  entrada VIVA foi guardada — o despejo poderia então descartar as texturas que
 *  a cena está amostrando neste instante. */
let currentKey: string | null = null;
let seq = 0;               // guards against an out-of-order double apply

const num = (v: unknown, d: number) => (Number.isFinite(+(v as number)) ? +(v as number) : d);
const path = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/* ---------------- A VARIANTE DO HDR ----------------
   `sky.hdr` → `sky@1k.hdr`, e só quando o perfil pede E o manifesto declara que
   o arquivo existe (`hdrVariant()` já devolve '' nos dois casos contrários — ver
   `coldProfile()` em core/quality.ts).

   O QUE SE GANHA, medido: o par de HDRs do distrito + o alvo de mistura + o
   PMREM somam **75,5 MB** a 2048×1024 e **18,9 MB** a 1024×512, e o download cai
   de 9,53 MB para ~2,4 MB. Mais importante que os dois: a assadura do PMREM fica
   **~4× mais barata**, porque o custo escala com a ÁREA — os picos de 10-40 ms
   de `scene/skyblend.ts` viram 3-10 ms, e é justamente esse pico que engasga o
   arrasto do relógio.

   O QUE SE PERDE: o FUNDO, e só ele. O PMREM já borra o irradiance, então a
   ILUMINAÇÃO não muda de forma perceptível; quem perde nitidez é a mesma
   textura posta em `scene.background`, ou seja o céu que se vê. Defensável no
   Médio, certo no Baixo, **nunca na Alta** — e a tabela do perfil é assim.

   ⚠️ NÃO ENTRA EM `assetUrl()`. Aquela função é a junção de TODA URL do engine
   (glb, hdr, json, cards, miniaturas), e reescrever lá renomearia também os
   `.glb` e as `.webp` — arquivos que não têm variante nenhuma publicada. O mesmo
   raciocínio vale para `groundTexUrl()` em scene/set.ts.

   ⚠️ É FUNÇÃO e é lida NO MOMENTO DA CARGA: `hdrVariant()` é um botão FRIO, e a
   troca dele só chega ao ar na próxima borda de carga (a cortina de `studio.ts`,
   ou uma troca de cenário). Guardar o resultado num const de módulo congelaria a
   variante no nível em que a página abriu. */
function comVariante(p: string, sufixo: string): string {
  if (!sufixo || !p) return p;
  /* URL com esquema, âncora ou query fica INTOCADA: o sufixo é uma convenção da
     árvore de assets própria, e reescrever um `data:` ou um CDN de terceiro
     produziria um 404 mudo — o modo de falha que core/paths.ts documenta. */
  if (/^[a-z][a-z0-9+.-]*:/i.test(p) || p.includes('?') || p.includes('#')) return p;
  const ponto = p.lastIndexOf('.');
  const barra = p.lastIndexOf('/');
  if (ponto <= barra + 1) return p;          // o último segmento não tem extensão
  return p.slice(0, ponto) + sufixo + p.slice(ponto);
}

function hdrPath(p: string): string { return comVariante(p, hdrVariant()); }

/* ---------------- AS VARIANTES QUE O SERVIDOR DECLARA TER ----------------
   `core/quality.ts` só emite um sufixo de variante quando o MANIFESTO declara
   que os arquivos existem — a nota "VARIANTES DE ASSET" de lá explica por quê:
   pedir um asset inexistente é um 404 que este engine degrada em silêncio, e um
   retry no `onError` custaria 16 requisições perdidas por boot enquanto o deploy
   não chega, além de esconder um deploy pela metade.

   ⚠️ ONDE ISTO DEVERIA MORAR, E NÃO MORA. O lugar certo é `catalog/catalog.ts`,
   lendo uma chave de RAIZ de `environments.json` — `"textureVariants": ["@1k"]`
   — uma vez, no `doLoadCatalog()`, porque o que se declara é um fato do
   SERVIDOR (quais arquivos foram publicados) e não uma propriedade de um
   cenário. O próprio `core/quality.ts` diz isso: *"Quem alimenta isto é
   catalog.ts ao ler environments.json"*.

   Só que `normalizeEnvironment()` é uma LISTA BRANCA e o normalizador do
   catálogo não repassa a raiz do JSON para lugar nenhum — uma chave de raiz nova
   evapora no caminho, que é o mesmo modo de falha que `warnDroppedKeys()`
   documenta. O bloco `set`, ao contrário, chega aqui CRU (`RawBlock`), e este
   módulo é o único validador dele no engine. Então, por ora, a declaração é lida
   de `set.textureVariants`.

   ⚠️ CONSEQUÊNCIA A NÃO ESQUECER, e é por isso que a ausência NÃO limpa a lista:
   as texturas de chão são COMPARTILHADAS entre cenários (é o motivo de o
   `distrito-industrial` fechar em 7,8 MB), então "existe a variante @1k" é
   verdade para a árvore inteira ou para nenhuma. Um cenário que não declara nada
   não está dizendo "não existe" — está calado, e limpar a lista aí faria a
   variante piscar a cada troca de cenário. Declarar `[]` explicitamente, sim,
   desliga.

   ---------------------------------------------------------------------------
   ⚠️ ESTA FUNÇÃO FOI APAGADA NA INTEGRAÇÃO (2026-08-14), e o raciocínio acima é
   exatamente o motivo — ele conclui, corretamente, que a variante é um fato da
   ÁRVORE INTEIRA e não de um cenário, e que o certo seria "ler a raiz, chamar
   `setAvailableVariants()` uma vez, e apagar esta função".

   É o que passou a existir: `studio.ts` → `loadTextureVariants()`, lido da chave
   de RAIZ de `environments.json` e chamado **uma vez, no boot, antes do primeiro
   `applyChoice`** — que é antes de qualquer URL de textura ou de HDR ser montada.

   Deixar as duas em pé seria pior que qualquer uma sozinha: dois escritores de
   um estado GLOBAL lendo FONTES DIFERENTES (a raiz do JSON e o bloco `set` de um
   cenário), em que o último a rodar vence. Um cenário que declarasse `[]` apagaria
   a declaração da raiz, e a variante passaria a piscar conforme a ordem de visita
   — o defeito que o parágrafo acima previu, chegando pela outra porta.

   O que continua verdadeiro e ainda não foi feito: o lugar certo é `catalog.ts`,
   porque `normalizeEnvironment()` é uma lista branca e a raiz do JSON evapora
   nela. `loadTextureVariants()` contorna isso com um `fetch` próprio
   (`cache: 'force-cache'`, então sai do cache que `fetchJSON` acabou de encher).
   Quem for mexer em `catalog.ts` deve repassar a raiz e apagar aquele contorno. */

/* ---------------- progress ----------------
   Weighted, because the assets differ by an order of magnitude in size and an
   unweighted bar would sit at 20 % for the whole HDRI and then jump.

   ONE UNIT ≈ ONE MEGABYTE ON THE WIRE, measured from what is actually shipped
   in public/: a 2k .hdr is 5.8 MB, a set .glb 3,5-7,4 MB, and one of the PBR
   maps a set material names ~1.2 MB on average. Keeping the ratios in bytes is
   what makes the bar move at a roughly constant rate instead of stalling on the
   biggest file. Anything already resident gets weight 0 at the call site — a
   request that never happens must not be able to hold the bar back.

   THREE CLASSES, one per thing that is still downloaded:
     W_HDRI    the equirect .hdr.
     W_SET_GLB the set .glb. Ver a nota em applyEnvironment() sobre por que ele
               é ESTIMADO e não medido, e W_MAP para cada mapa que os materiais
               do set nomeiam (baixados por set.ts, reportados por
               applySet()).
     W_PROP    o .glb do poste: um modelo autocontido, com as texturas
               embutidas e Draco. MEDIDO na leva de props que existia até
               2026-08-03: 11,2 MB em 15 assets — média 0,75, mediana 0,69,
               extremos 0,25 e 2,18 (um jogo de postes com seis mapas 1k). 0,9
               fica do lado pesado da distribuição porque um poste É um dos
               assets mais pesados daquela leva. */
const W_HDRI = 6, W_MAP = 1.2;
/* O .glb do set: 3,5 MB (armazem) a 7,4 MB (distrito), contra os 5,8 MB que
   valem W_HDRI = 6. */
const W_SET_GLB = 6;
const W_PROP = 0.9;

function makeTracker(weights: number[], onProgress: (p: number) => void) {
  const total = weights.reduce((a: number, b: number) => a + b, 0);
  const done = weights.map(() => 0);
  const emit = () => {
    if (!total) { onProgress(1); return; }
    let s = 0;
    for (let i = 0; i < weights.length; i++) s += done[i] * weights[i];
    onProgress(Math.max(0, Math.min(1, s / total)));
  };
  return {
    /* monotonic: a loader that reports total=0 then completes must not make the
       bar go backwards */
    set(i: number, f: number) { done[i] = Math.max(done[i], Math.min(1, f)); emit(); },
    emit,
  };
}

/* Content-Length is missing whenever the response is gzip/br-encoded, which is
   the normal case for a .hdr served by Vite — then lengthComputable is false
   and we simply hold until the load callback fires. */
const fraction = (e: ProgressEvent) => (e && e.lengthComputable && e.total ? e.loaded / e.total : 0);

/* ---------------- loading ---------------- */

/* Every loader in this module RESOLVES with null on failure instead of
   rejecting: a missing HDRI has to degrade to the procedural sky, never to a
   black screen, and a missing lamp .glb to the procedural primitives. */
function loadHdr(url: string, onProg: (e: ProgressEvent) => void): Promise<THREE.DataTexture | null> {
  return new Promise(resolve => {
    rgbeLoader.load(url, tex => resolve(tex), onProg, err => {
      console.warn('[truck-studio] HDRI não carregou, usando céu procedural: ' + url, err);
      resolve(null);
    });
  });
}

/* O `loadTex()` que ficava aqui saiu com o campo próximo (2026-08-03): o único
   consumidor que restava era a `backgroundImage` do domo projetado. Quem carrega
   textura hoje é set.ts, que tem o próprio loader com o espaço de cor, o
   `repeat` e o descarte do set. */

/**
 * DataTexture equirect → render target PMREM.
 *
 * O parâmetro `keep` saiu junto com o domo projetado (2026-08-03): ele existia
 * porque o GroundedSkybox amostrava o equirect DIRETO, então quem chamava
 * precisava dizer "ainda preciso desta textura". Sem domo, nada mais lê o
 * equirect depois do PMREM, e ele é sempre descartado aqui.
 */
function toPmrem(tex: THREE.Texture): THREE.WebGLRenderTarget | null {
  try {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const w = (tex.image && tex.image.width) || 0;
    if (w > 2048) {
      /* cubeSize = width/4, e o alvo é 3·cubeSize x 4·cubeSize meio-float RGBA
         — 4k na entrada são ~100 MB de saída, POR ambiente em cache. */
      console.warn('[truck-studio] HDRI de ' + w + 'px: considere 2k para o web (VRAM do PMREM cresce com o quadrado).');
    }
    const rt = pmrem.fromEquirectangular(tex);
    tex.dispose();               // nada amostra o equirect depois disto
    return rt;
  } catch (err) {
    console.warn('[truck-studio] falha ao gerar o PMREM do HDRI', err);
    try { tex.dispose(); } catch (_) { /* ignore */ }
    return null;
  }
}

/* ---------------- modelo do poste ----------------
   A fileira procedural de postes (scene/lamps.ts) desenha primitivas — mastro,
   braço e luminária — a menos que o cenário nomeie um `.glb` em `lamps.model`.
   Quando nomeia, é ESTE módulo que baixa a geometria e entrega o Object3D
   pronto; lamps.ts mede, escala e orienta o que receber.

   POR QUE UM CARREGADOR PRÓPRIO, e não o cache de props que existia aqui até
   2026-08-03: aquele cache era uma LRU compartilhada com o scatter, com
   catálogo (`props.json`), contagem de falhas, política de despejo e pinos de
   cena — tudo dimensionado para as centenas de instâncias que o scatter
   espalhava. O scatter saiu junto com os cenários de foto, e sobrou UM modelo,
   trocado no máximo uma vez por cenário. Uma promessa memoizada por URL faz o
   mesmo trabalho sem nada daquilo.

   Nunca lança: um poste que não baixa degrada para as primitivas procedurais,
   que é exatamente o que um cenário sem `lamps.model` já usa. */
const lampModels = new Map<string, Promise<THREE.Object3D | null>>();

function loadLampModel(url: string,
  onProgress?: (f: number) => void): Promise<THREE.Object3D | null> {
  const hit = lampModels.get(url);
  if (hit) return hit;
  const p = loadGLB(url, onProgress)
    .then(root => (root as THREE.Object3D) || null)
    .catch((err: unknown) => {
      console.warn('[truck-studio] modelo de poste não carregou', url, err);
      /* Memoizar a FALHA também: sem isso, cada troca de cenário tentaria de
         novo o mesmo 404 e seguraria a barra de progresso por nada. */
      return null;
    });
  lampModels.set(url, p);
  return p;
}

/* ---------------- cache ---------------- */

function disposeEntry(entry: CacheEntry | null | undefined) {
  if (!entry) return;
  /* dispose the RENDER TARGET, not just rt.texture — the texture alone leaves
     the framebuffer and its attachment allocated. */
  if (entry.rt) entry.rt.dispose();
  /* E os dois equirects crus do par de céus, que uma entrada com `hdriNight`
     possui de verdade (ver CacheEntry). No caminho de um plate só não há nada
     aqui: toPmrem() descarta o equirect ao assar. As texturas do set nunca são
     nossas — pertencem a set.ts, que tem descarte próprio. */
  if (entry.dia) entry.dia.dispose();
  if (entry.noite) entry.noite.dispose();
}

function touch(key: string, entry: CacheEntry) {
  cache.delete(key);
  cache.set(key, entry);                      // Map keeps insertion order = LRU
  podar(key);
}

/**
 * Despeja até caber em `maxCache()`, pulando o que não pode ser despejado.
 *
 * ⚠️ ERA `break` E VIROU "PULAR", E A TROCA É DELIBERADA — a auditoria de
 * 2026-08-14 achou aqui um teto real de `MAX_CACHE + 1`. O laço antigo parava
 * de despejar assim que a MAIS ANTIGA fosse a entrada protegida (a que está na
 * tela ou a que acabou de entrar), em vez de olhar a seguinte: com a protegida
 * no fundo da ordem de inserção, nada jamais era despejado.
 *
 * Não foi consertado em silêncio porque o número muda: com `envCacheMax` em 2
 * (nível Baixo), um teto efetivo de 3 é **50 % mais VRAM do que o orçado** — e
 * o nível Baixo existe justamente para caber num orçamento. Com 3 no Alto o
 * erro era invisível (o catálogo tem 2 cenários com HDRI e nada chegava a
 * despejar), que é por que ele sobreviveu.
 *
 * O QUE CONTINUA VALENDO: **nunca despejar o que está na tela.** Descartar o
 * render target ou os equirects crus que `scene.environment` e o passe de
 * mistura estão amostrando renderiza lixo. Então o teto ainda pode ser furado —
 * por no máximo DUAS entradas, a de `protegido` e a de `currentKey`, e só
 * enquanto elas forem exatamente as duas mais antigas. Isso é um limite honesto
 * e nomeado, e não um `break` que parecia um teto e não era.
 */
function podar(protegido?: string) {
  const max = maxCache();
  while (cache.size > max) {
    let vitima: string | null = null;
    for (const k of cache.keys()) {                 // ordem de inserção = LRU
      if (k === protegido || k === currentKey) continue;
      vitima = k;
      break;
    }
    if (!vitima) break;                             // só restaram as protegidas
    disposeEntry(cache.get(vitima));
    cache.delete(vitima);
  }
}

/* O teto pode ENCOLHER no meio da sessão (Média → Baixa leva `envCacheMax` de 3
   para 2), e sem isto a memória a mais ficaria retida até a próxima troca de
   cenário — que num uso normal pode não vir nunca. Descartar um PMREM que não
   está em cena é invisível: o que ele custa é uma recarga na próxima visita. */
onQualityChange(() => { podar(); });

/** Release every cached PMREM and every texture the set holds, and return the
 *  scene to procedural. */
export function disposeEnvironments() {
  setExternalEnvironment(null);
  setHorizonHaze(null);
  /* O tint sai junto com a névoa que ele colore — deixá-lo ligado tingiria a
     névoa do próximo cenário com o horizonte deste. */
  setHorizonTint(null);
  disposeSet();
  /* A fileira procedural de postes sai da cena antes de qualquer descarte de
     geometria: as luminárias são clones que COMPARTILHAM a geometria do modelo
     carregado, e descartar uma que ainda está montada renderiza lixo. */
  setLampModel(null);                 // null ⇒ volta às primitivas procedurais
  setLamps(null);                     // null ⇒ a fileira embutida
  /* Os vidros das luminárias do cenário. `setLamps(null)` já os tira de cena
     (o layout volta a `roadside`), mas a geometria própria deles fica alocada —
     e este é o ponto de SAÍDA, onde ela tem de morrer. */
  disposeLampSiteLenses();
  /* E o par de céus: o alvo da mistura mais o PMREM dele são 41 MB, e eles NÃO
     estão no cache (só os dois equirects crus estão — ver CacheEntry). Sem esta
     linha o descarte diferido soltaria tudo menos justamente a maior parte.
     DEPOIS de setExternalEnvironment(null): é ele que desliga
     `scene.environment`, e descartar um render target ainda ligado à cena deixa
     o three amostrando textura morta até o próximo quadro. */
  disposeSkyBlend();
  for (const entry of cache.values()) disposeEntry(entry);
  cache.clear();
  /* Seguro aqui e em nenhum outro lugar: todo material que ainda podia apontar
     para uma destas acabou de receber o mapa procedural de volta nas chamadas
     acima. Cargas em voo NÃO são canceladas — elas resolvem para um cache de
     set já vazio, que é exatamente um cache frio. */
  disposeSetTextures();
  current = null;
  currentKey = null;
}

/* ---------------- apply ---------------- */

/**
 * Valida o bloco `set` do manifesto.
 *
 * Mesma disciplina dos outros blocos crus deste módulo: catalog.ts repassa o
 * objeto sem olhar, e é AQUI que ele vira dado tipado. Um `set` sem `url` é
 * tratado como ausente — degradar para HDRI sem geometria é sempre melhor do
 * que abortar a troca de ambiente.
 *
 * @returns {SetDef|null}
 */
function resolveSet(envDef: EnvironmentDef): SetDef | null {
  const raw = envDef.set;
  if (!raw || typeof raw !== 'object') return null;
  const url = path((raw as RawBlock).url);
  if (!url) return null;

  const out: SetDef = { url };

  const rot = (raw as RawBlock).rotationY;
  if (typeof rot === 'number' && isFinite(rot)) out.rotationY = rot;
  if ((raw as RawBlock).interior === true) out.interior = true;

  const b = (raw as RawBlock).bounds;
  if (b && typeof b === 'object') {
    const bb = b as RawBlock;
    const f = (k: string, d: number) => (Number.isFinite(+(bb[k] as number)) ? +(bb[k] as number) : d);
    out.bounds = { halfX: f('halfX', 20), halfZ: f('halfZ', 20), minY: f('minY', 1), maxY: f('maxY', 10) };
  }

  const mats = (raw as RawBlock).materials;
  if (mats && typeof mats === 'object') {
    const bound: Record<string, SetMaterialDef> = {};
    for (const [name, v] of Object.entries(mats as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const m = v as RawBlock;
      const def: SetMaterialDef = {};
      for (const k of ['diffuse', 'rough', 'normal', 'ao'] as const) {
        const p = path(m[k]);
        if (p) def[k] = p;
      }
      /* `repeat` é repetição UV final, não metros por tile: o build autora UV
         em metros/`uv_scale`, então quem escolhe o tamanho do ladrilho é o
         manifesto e a conta já vem feita. 0 ou negativo cairia num
         RepeatWrapping degenerado, daí o piso. */
      if (typeof m.repeat === 'number' && m.repeat > 0) def.repeat = m.repeat;
      if (Array.isArray(m.tintRgb) && m.tintRgb.length === 3 &&
        m.tintRgb.every((n) => typeof n === 'number' && isFinite(n))) {
        def.tintRgb = m.tintRgb as [number, number, number];
      }
      if (typeof m.roughness === 'number') def.roughness = Math.min(1, Math.max(0, m.roughness));
      if (typeof m.metalness === 'number') def.metalness = Math.min(1, Math.max(0, m.metalness));
      /* ESTES TRÊS FALTAVAM, e o `envIntensity` faltava desde sempre.
         Esta função é uma LISTA BRANCA: campo do manifesto que não é copiado
         aqui não chega em set.ts e some sem erro nenhum. `envIntensity` foi
         escrito no manifesto, comentado, medido e BAIXADO DUAS VEZES
         perseguindo "o chão está muito reflexivo" — e nenhuma das duas vezes
         chegou ao material, porque morria nesta linha que não existia. É o
         mesmo modo de falha que catalog.ts documenta em warnDroppedKeys().
         `normalScale` e `macro` entram junto porque são a outra metade da
         mesma correção (relevo que quebra o especular, e variação macro que
         quebra o ladrilho). */
      if (typeof m.envIntensity === 'number' && m.envIntensity >= 0) {
        def.envIntensity = m.envIntensity;
      }
      if (typeof m.normalScale === 'number' && isFinite(m.normalScale)) {
        def.normalScale = m.normalScale;
      }
      const mac = m.macro as RawBlock | undefined;
      if (mac && typeof mac === 'object'
        && typeof mac.scale === 'number' && mac.scale > 0
        && typeof mac.amount === 'number') {
        def.macro = { scale: mac.scale, amount: Math.min(1, Math.max(0, mac.amount)) };
      }
      bound[name] = def;
    }
    if (Object.keys(bound).length) out.materials = bound;
  }
  return out;
}

function applyToScene(envDef: EnvironmentDef, entry: CacheEntry,
  lampModel: THREE.Object3D | null, onSetProgress?: (f: number) => void) {
  /* "Tem foto de céu?" — e um PAR conta, senão a bruma do horizonte e o domo
     procedural decidiriam pelo caminho errado num cenário que tem os dois
     plates e nenhum `rt`. */
  const hasHdri = !!(entry && (entry.rt || (entry.dia && entry.noite)));

  /* A 3D SET IS THE WHOLE NEAR FIELD, AND THAT IS THE POINT.
     `set` (scene/set.ts) brings real modelled ground, kerbs, painted lines and
     buildings. Every SIMULATION of those used to have to be turned off here or
     it rendered THROUGH the real thing — the grounded dome projected the
     photo's floor over the modelled asphalt, the near band laid a 32 m disc on
     top of it, the procedural strip sat at y=-0.01 under everything and the
     shadow catcher doubled the truck's shadow against the set's own ground. In
     2026-08-03 all four were deleted along with the photo-backed scenes, so
     there is nothing left to guard against and no guards below.
     The HDRI stays: it is still the sky and, more importantly, still the IBL
     the paint reflects. */
  const setDef = resolveSet(envDef);

  /* O CENÁRIO DE ESTÚDIO, e por que ele é reconhecido pelo PRESET.
     ---------------------------------------------------------------------
     `ciclorama` é o único preset com sala própria (scene/cyclorama.ts), e é o
     preset que só o cenário `estudio` usa — `armazem` usa `estudio`, que é
     outro. Testar o preset em vez de acrescentar um campo ao manifesto mantém a
     correção inteira dentro de scene/**: `normalizeEnvironment()` é uma lista
     branca, então um campo novo teria de ser aberto em catalog/catalog.ts para
     não evaporar no meio do caminho.
     E, principalmente, isto vale para as DUAS fontes do cenário: a entrada do
     manifesto e o `STUDIO_ENVIRONMENT` embutido que `ensureStudioEnvironment()`
     acrescenta quando o manifesto não o traz. Corrigir só o JSON deixaria o
     caminho de fallback com poste de rua dentro do estúdio. */
  const isStudio = envDef.preset === 'ciclorama';

  /* A SALA DE CICLORAMA. Ela É o chão e É o fundo deste cenário — o `estudio`
     não tem bloco `set` e o maquinário de `shadowCatcher` saiu do engine em
     2026-08-03, então sem isto o caminhão flutua num vazio cinza sem sombra de
     contato. Ver o cabeçalho de scene/cyclorama.ts. */
  setCyclorama(isStudio);

  /* O CÉU PROCEDURAL só aparece quando não há HDRI para desenhar. `armazem` é
     exatamente esse caso (`hdri: null`): a casca fechada esconde o domo, mas ele
     continua sendo o fundo de qualquer fresta. Com HDRI, quem manda é o
     manifesto — e os dois cenários atuais trazem `showSkyDome: false`.
     O estúdio é a terceira situação: a sala de ciclorama é fechada, então o domo
     não teria por onde aparecer, e mantê-lo ligado só paga um PMREM de céu que
     nada amostra. */
  setSkyDomeVisible(isStudio ? false : (hasHdri ? envDef.showSkyDome === true : true));

  /* ---- GEOMETRIA REAL: o modelo do poste, depois o set ----
     ANTES de setLamps(), que distribui o pool: lamps.ts escala e orienta a
     luminária pela altura do próprio modelo, então o layout precisa rodar contra
     a geometria que ele vai de fato mover. `null` ⇒ mantém as primitivas
     procedurais, que é para onde um download quebrado degrada. */
  setLampModel(lampModel || null);

  /* Todo cenário ganha postes, inclusive o pátio: `null` é "a fileira embutida",
     não "nenhum", e quem não quer nenhum escreve `"lamps": { "enabled": false }`.
     Os SPOTLIGHTS são um pool fixo de 8 que setLampsEnabled() liga por
     dia/noite — isto aqui só move geometria, então é barato chamar por troca.

     O ESTÚDIO NUNCA TEM POSTE, e o default acima é justamente por que ele tinha:
     a entrada `estudio` do manifesto (e o `STUDIO_ENVIRONMENT` embutido) não
     declara `lamps`, o que aqui significa "a fileira embutida" e não "nenhum" —
     então oito postes de iluminação pública nasciam dentro do ciclorama. Era o
     "não deve ter esses postes de luz" do relatório. Os outros dois cenários já
     escrevem `{ enabled: false }` e por isso nunca mostraram o defeito. */
  setLamps(isStudio ? { enabled: false } : (envDef.lamps ? { ...envDef.lamps } : null));

  /* O SET É O CHÃO — não há mais plano procedural para arbitrar contra ele, que
     é por que `setSetGround()` deixou de existir. Nunca rejeita: applySet()
     engole a falha de rede e devolve false, e o cenário degrada para HDRI sem
     geometria em vez de abortar a troca. */
  /* Only for a set, and only over a photograph: the seam this hides is the one
     between the set's modelled ground and the HDRI behind it. With the
     procedural gradient dome there is nothing to hide — it already ends in the
     fog colour. `interior` opts out too: a warehouse has a roof, so hazing its
     horizon would put a band of fog across the far wall. */
  setHorizonHaze(setDef && hasHdri && !setDef.interior
    ? { strength: num((envDef.set as RawBlock)?.haze, 1) }
    : null);
  /* And the COLOUR that haze is painted in. The preset's fogColor is authored
     for the procedural sky and has no relationship to a given panorama's
     horizon (see setHorizonTint), so a scene standing against a photograph may
     name the tone its own plate actually has. Set together with the haze and
     cleared together with it: a scene without a set has no seam to match, and
     leaving the previous plate's tint on would tint the next one's fog.
     Read off `set.horizonColor` — it belongs to the same block as `haze`,
     which is the other half of the same knob. */
  setHorizonTint(setDef && hasHdri && !setDef.interior
    ? (((envDef.set as RawBlock)?.horizonColor as string | number) ?? null)
    : null);
  /* Confine the orbit for a closed set. Unconditional, including with null:
     leaving the previous scene's box in place would trap the camera in a
     34 x 62 m cage in the middle of a 1.2 km industrial estate.
     O ESTÚDIO É A EXCEÇÃO, e é uma exceção de ORDEM, não de gosto: a sala do
     ciclorama é gerada em código e centrada NO RIG (que não fica na origem), e
     por isso é ela quem chama `setInteriorBounds()`, com um centro. Chamar aqui
     também sobrescreveria aquela caixa por uma centrada na origem — e a última
     chamada da troca é esta, então o estúdio perderia a caixa certa em silêncio. */
  if (!isStudio) setInteriorBounds(setDef && setDef.bounds ? setDef.bounds : null);
  const setP = setDef ? applySet(setDef, onSetProgress)
    : Promise.resolve(disposeSet()).then(() => { if (onSetProgress) onSetProgress(1); return false; });


  const rot = num(envDef.envRotation, 0);

  /* O PAR DE CÉUS PRIMEIRO, porque ele produz as duas texturas que vão ser
     ligadas. `setSkyPair()` devolve null se faltar um lado — e aí o `||` abaixo
     cai no caminho de sempre, com o plate único. */
  /* `getSkyMix()` e nao `getNightness()`: desde 2026-08-24 a dissolvencia dos
     dois plates tem banda propria — mais larga e mais tardia —, porque
     `nightness` satura as 19:20 e o relogio vai ate 24:00. Ver `skyMixAt()` em
     scene/scene.ts. Aqui vale a hora CRUA e nao a tweenada: e a montagem, nao
     um quadro de tween. */
  const par = (entry.dia && entry.noite)
    ? setSkyPair(entry.dia, entry.noite, getSkyMix()) : null;
  if (!par) disposeSkyBlend();

  if (par) {
    /* FUNDO E REFLEXO DE FONTES DIFERENTES, e é o ponto do esquema: o fundo é o
       equirect misturado (reescrito a cada mudança de hora, portanto liso) e o
       reflexo é o PMREM dele (reassado por taxa). Ver scene/skyblend.ts.

       `blurriness` NÃO é repassado: `scene.backgroundBlurriness` só age sobre
       textura CubeUV, e o fundo aqui é equirect cru. Nenhum cenário com par
       declara desfoque (o distrito tem 0), e passar um valor que não faz nada
       seria pior que não passar. */
    setExternalEnvironment(par.env, {
      background: par.bg,
      rotation: rot,
      intensity: num(envDef.envIntensity, 1),
    });
  } else if (hasHdri) {
    /* `!`: `hasHdri` É `!!(entry && entry.rt)` — o tsc não propaga a narrowing
       através do booleano intermediário. */
    const tex = entry.rt!.texture;
    setExternalEnvironment(tex, {
      background: tex,
      rotation: rot,
      blurriness: num(envDef.backgroundBlur, 0),
      intensity: num(envDef.envIntensity, 1),
    });
  } else {
    setExternalEnvironment(null);
  }

  setExposureBase(num(envDef.exposure, 1));

  /* timeOfDay BEFORE preset: applyPreset() derives its default sun az/el from
     the CURRENT sceneState.timeOfDay, so the other order would hand a night
     preset the daytime sun angles.
     animate:false for both — an environment switch happens behind the selector
     overlay, and a 0.8 s crossfade between two unrelated rigs (plus a second
     beginTween cancelling the first mid-flight) reads as a glitch, not a
     transition. Note this also resets az/el/brightness to the preset defaults:
     the environment dictates the light rig, so the sidebar sliders must be
     re-read from sceneState afterwards.
     It is also what drives the rig hook that colours the dome, so the dome
     picks up its envIntensity on this call, not a frame later. */
  applyEnvironmentLighting(envDef, { animate: false });

  current = envDef;
  /* O set é o único trabalho assíncrono que sobrou aqui. applyEnvironment() só
     pode dizer "pronto" depois que ele estiver na cena. */
  return setP.then(() => undefined);
}

/**
 * Começa a baixar o que este cenário vai custar, sem aplicar nada.
 *
 * MORA AQUI porque é AQUI que se sabe o que um cenário custa. O bloco `set` do
 * manifesto chega como `RawBlock` — catalog.ts o repassa sem olhar, de propósito
 * — e `resolveSet()` é o único validador dele no engine. Um segundo leitor de
 * `set.url` em ui/selector.ts seria uma segunda definição do formato, e a
 * próxima mudança de manifesto entraria num lado e não no outro.
 *
 * Ordem intencional: o `set` primeiro. Ele é a geometria do cenário e a única
 * coisa cuja ausência deixa o caminhão flutuando; o HDRI só falta ao reflexo e
 * ao fundo, e o poste degrada para a primitiva procedural. Com `MAX_IN_FLIGHT`
 * em 2, quem entra primeiro é quem termina primeiro.
 *
 * NÃO É NECESSARIAMENTE COMPLETO, e isso é aceitável: `scene/set.ts` também
 * baixa os conjuntos PBR de chão que os materiais nomeados do set pedirem, e
 * esses caminhos só se conhecem depois de o `.glb` estar parseado e os materiais
 * casados (`bindMaterials`). Aquecer o set — o maior arquivo — já é o grosso da
 * espera; as texturas de chão são compartilhadas entre cenários e costumam já
 * estar no cache do navegador.
 */
export function prefetchEnvironment(envDef: EnvironmentDef | null | undefined): void {
  if (!envDef || typeof envDef !== 'object') return;
  /* A autorização do sufixo de variante já foi dada no boot, por
     `studio.ts` → `loadTextureVariants()`, a partir da chave de RAIZ do
     manifesto. Ver o bloco de `hdrVariant()` acima. */
  const set = resolveSet(envDef);
  const d = path(envDef.hdri);
  const n = path(envDef.hdriNight);
  prefetch([
    set ? set.url : null,
    /* COM A VARIANTE, obrigatoriamente. Aquecer `sky.hdr` para depois pedir
       `sky@1k.hdr` seria baixar 5,8 MB que ninguém vai ler — o prefetch deixaria
       de ser uma otimização e viraria o dobro do tráfego. */
    d ? hdrPath(d) : null,
    /* DEPOIS do de dia, e essa ordem é a que importa: com MAX_IN_FLIGHT em 2,
       quem entra primeiro termina primeiro, e o céu que abre a cena é o de dia
       (o estúdio abre às 17:45). */
    n ? hdrPath(n) : null,
    envDef.lamps ? path((envDef.lamps as RawBlock).model) : null,
  ], 'env');
}

/**
 * Apply a map/environment definition: load + cache its HDRI as a PMREM, load
 * its optional street-lamp .glb, bind scene.background / scene.environment,
 * mount the 3D set (which brings its own ground textures), toggle the
 * procedural sky dome and the street lamps, and apply the light preset + time
 * of day + exposure.
 *
 * Never rejects: a 404 or a decode error degrades to the procedural
 * environment (which needs zero downloaded assets) and resolves. Every
 * downgrade is independent — a dead lamp model falls back to the procedural
 * pole, a dead set .glb leaves the HDRI lighting an empty stage, and a dead
 * HDRI falls back to the procedural sky but still leaves the set standing.
 *
 * @param {Object} envDef            an entry from catalog.ts's `environments`
 * @param {(p:number)=>void} [onProgress]  0..1
 * @returns {Promise<Object|null>}   the applied envDef
 */
export async function applyEnvironment(envDef: EnvironmentDef | null | undefined,
  onProgress?: (p: number) => void): Promise<EnvironmentDef | null> {
  if (!envDef || typeof envDef !== 'object') return current;

  const token = ++seq;
  const report = typeof onProgress === 'function' ? onProgress : () => { };
  report(0);

  /* `hdriKey()`, `hdrPath()` e as URLs logo abaixo dependem de `hdrVariant()`,
     que só emite o sufixo depois de o manifesto declarar que o arquivo existe —
     e essa declaração acontece UMA vez, no boot, antes do primeiro
     `applyChoice`. Ver o bloco de `hdrVariant()` acima. */

  const hdriPath = path(envDef.hdri);
  const nightPath = hdriPath ? path(envDef.hdriNight) : null;
  /* As URLs FINAIS, já com a variante — e a chave de cache é feita das mesmas
     strings, para não haver como pedir um arquivo e guardar sob o nome de
     outro. */
  const hdriHref = hdriPath ? assetUrl(hdrPath(hdriPath)) : null;
  const nightHref = nightPath ? assetUrl(hdrPath(nightPath)) : null;
  const key = hdriKey(envDef);

  let entry = key ? cache.get(key) || null : null;
  let cacheable = true;               // false only for a freshly FAILED HDRI

  /* FORA do bloco `!entry`: o modelo do poste tem cache próprio, por URL, então
     uma entrada de AMBIENTE residente não diz nada sobre ele. Resolver de novo
     é de graça no acerto (consulta ao Map, sem await) e correto no erro. */
  const lampUrl = envDef.lamps ? path(envDef.lamps.model) : null;
  const lampHref = lampUrl ? assetUrl(lampUrl) : null;

  /* Layout dos slots: 0 HDRI, 1 modelo do poste, 2 set. O que já está residente
     pesa 0 — uma requisição que nunca acontece não pode segurar a barra.
     Eram 2..N mapas de chão avulsos entre o HDRI e o poste até 2026-08-03; o
     `ground` do manifesto nomeia hoje um TIPO e nenhum arquivo, e quem baixa
     textura de chão é set.ts, contado no slot do set. */
  const HDRI_SLOT = 0, LAMP_SLOT = 1, SET_SLOT = 2, NIGHT_SLOT = 3;
  /* PESO DO SET, e por que ele é estimado em vez de medido. O tamanho real só é
     conhecido depois do HEAD/GET, e pedir um HEAD por cenário para acertar a
     barra custaria um round trip antes de qualquer byte útil. A estimativa sai
     do que o manifesto JÁ diz: um `.glb` de set roda entre 3,5 e 7,4 MB, e cada
     material nomeado traz até quatro mapas de ~1,4 MB. Errar aqui deixa a barra
     irregular; não errar a ORDEM é o que importa, e essa é exata.
     SUPERESTIMA de propósito quando um material do manifesto não existe no
     .glb: set.ts só baixa os mapas dos materiais que ele ACHA na cena
     (bindMaterials), então um `DIRT_WORN` que sobrou no manifesto conta aqui e
     não é baixado. O efeito é a barra chegar em 100 % um pouco cedo, que é o
     lado certo de errar. */
  const setDefForWeight = resolveSet(envDef);
  const setMapCount = setDefForWeight && setDefForWeight.materials
    ? Object.values(setDefForWeight.materials).reduce((n, m) =>
      n + (m.diffuse ? 1 : 0) + (m.rough ? 1 : 0) + (m.normal ? 1 : 0) + (m.ao ? 1 : 0), 0)
    : 0;
  const weights = [
    (!entry && hdriPath) ? W_HDRI : 0,
    (lampHref && !lampModels.has(lampHref)) ? W_PROP : 0,
    setDefForWeight ? (W_SET_GLB + setMapCount * W_MAP) : 0,
    /* O plate de noite é do MESMO tamanho do de dia (mesma série, mesmo 2k), e a
       barra tem de saber disso: sem este slot o cenário chegaria a 100 % com
       5,6 MB ainda no fio, e o estúdio abriria com o céu de dia até o segundo
       download terminar. */
    (!entry && nightPath) ? W_HDRI : 0,
  ];
  const track = makeTracker(weights, report);

  /* Compile the equirect→cubeUV shader while the bytes are still in flight;
     it is a few ms of stall otherwise, right when the first frame lands. */
  if (!entry && hdriPath) { try { pmrem.compileEquirectangularShader(); } catch (_) { /* ignore */ } }

  /* HDRI e modelo do poste em PARALELO — são independentes, e o pequeno pega
     carona de graça. */
  const [hdr, lampObj, hdrNight] = await Promise.all([
    (!entry && hdriHref)
      ? loadHdr(hdriHref, e => track.set(HDRI_SLOT, fraction(e)))
        .then(t => { track.set(HDRI_SLOT, 1); return t; })
      : Promise.resolve(null),
    /* loadGLB() reporta uma FRAÇÃO, não um ProgressEvent — sem fraction() aqui. */
    lampHref
      ? loadLampModel(lampHref, f => track.set(LAMP_SLOT, f))
        .then(o => { track.set(LAMP_SLOT, 1); return o; })
      : Promise.resolve(null),
    (!entry && nightHref)
      ? loadHdr(nightHref, e => track.set(NIGHT_SLOT, fraction(e)))
        .then(t => { track.set(NIGHT_SLOT, 1); return t; })
      : Promise.resolve(null),
  ]);

  if (!entry) {
    if (hdr && hdrNight) {
      /* PAR COMPLETO: os dois crus ficam vivos e quem assa é skyblend, na hora
         de aplicar — porque o peso da mistura depende da HORA, e a hora só é
         conhecida depois de applyPreset()/setHourOfDay() em applyToScene(). */
      entry = { rt: null, dia: hdr, noite: hdrNight };
    } else {
      /* UM PLATE SÓ, inclusive quando o de noite falhou: o equirect cru não
         sobrevive a toPmrem() (nos dois caminhos, sucesso e falha) e a noite
         volta a ser o plate de dia escurecido, que é o degrade correto. */
      if (hdrNight) hdrNight.dispose();
      entry = { rt: hdr ? toPmrem(hdr) : null };
    }

    /* Do NOT cache a FAILED HDRI: caching it would make one dropped packet
       permanent for the whole session (the engine outlives the React page), and
       the user's only recourse would be a full reload. A successful load is
       cached even if a newer apply has already overtaken us — the bytes are
       decoded either way.
       UM CENÁRIO SEM HDRI DEIXOU DE OCUPAR SLOT (2026-08-14). Antes ele entrava
       no cache com `{ rt: null }` — uma entrada que não guarda um único byte e
       ainda assim empurrava um PMREM de verdade para fora quando o teto é 2. Com
       a chave na URL ele nem tem chave: `hdriKey()` devolve null, não há o que
       reencontrar, e a próxima visita reconstrói o mesmo objeto vazio de graça. */
    cacheable = !!key && (!!entry.rt || !!entry.dia);
    if (cacheable) touch(key!, entry);
  } else if (key) {
    /* ACERTO DE CACHE: refresca a ordem de uso. Faltava, e o efeito é uma LRU
       que na verdade despejava por ordem de CARGA — voltar a um cenário não o
       tornava "recente", então o mais antigo a ser carregado saía primeiro
       mesmo sendo o mais usado. Invisível com 2 cenários e um teto de 3; deixa
       de ser quando o teto é 2. */
    touch(key, entry);
  }

  /* A second applyEnvironment() started while we were awaiting — it owns the
     scene now. Bailing here is what keeps a fast double-click from binding the
     older HDRI on top of the newer one. */
  if (token !== seq) {
    /* uncached + superseded ⇒ nothing will ever reference these again */
    if (!cacheable) disposeEntry(entry);
    return current;
  }

  /* A ENTRADA QUE PASSA A ESTAR NA TELA — antes de qualquer outra poda poder
     acontecer. `podar()` nunca despeja `currentKey`, e é esta linha que diz qual
     é ele. Escrita aqui e não em `applyToScene()` porque a CHAVE (com a variante
     que foi de fato pedida) só existe neste escopo — ver o comentário de
     `currentKey`. */
  currentKey = key;

  /* AGUARDADO, para applyEnvironment() continuar significando "a cena está
     visualmente pronta" — e agora ela realmente está: applySet() só resolve com
     as texturas de chão decodificadas.

     `report(1)` ficava ACIMA deste await até 2026-08-03, e era metade da barra
     mentindo: o ambiente declarava 100% e só então baixava 29 MB de set. No
     `armazem` era pior — sem HDRI (`hdri: null`) e sem modelo de poste, o
     tracker nascia com TODOS os pesos zerados menos o do set, resolvia no mesmo
     tick e entregava a fatia inteira do ambiente em t≈0. */
  const setP = applyToScene(envDef, entry, lampObj, f => track.set(SET_SLOT, f));
  if (setP) await setP;
  report(1);
  return current;
}

/** @returns {Object|null} the envDef last applied */
export function getCurrentEnvironment() {
  return current;
}

/**
 * A LUZ QUE ESTE CENÁRIO PEDE — hora, face do relógio e preset.
 *
 * Extraída de `applyToScene()` porque ela tem um SEGUNDO chamador: o "Novo" do
 * menu de projeto (`project/document.ts`), que precisa devolver a iluminação ao
 * estado de fábrica **deste** cenário e não a um padrão global.
 *
 * A diferença não é cosmética, e foi ela que gerou o defeito: `LIGHT_DEFAULTS`
 * abre em `dourado` — sol rasante às 17:45 —, mas o cenário Estúdio pede
 * `ciclorama`, que é um preset de SALA (`env: 'room'`, `solar: false`). Um
 * "Novo" dentro do estúdio caía no `dourado` e punha luz de fim de tarde a céu
 * aberto dentro de um ciclorama fechado. Cada cenário declara o preset dele no
 * manifesto; quem reseta a luz tem de perguntar ao cenário, nunca a uma
 * constante.
 *
 * A ORDEM DAS TRÊS CHAMADAS É CARREGANTE, e é a razão de isto ser uma função em
 * vez de três linhas copiadas:
 *
 *  1. `setTimeOfDay()` antes do preset — `applyPreset()` deriva o azimute e a
 *     elevação padrão do sol a partir do `timeOfDay` CORRENTE, então a ordem
 *     inversa entrega a um preset de noite os ângulos de dia;
 *  2. a HORA antes do preset também. `setTimeOfDay()` estaciona o relógio na
 *     hora canônica da face (12:00 para `dia`), e num ambiente diurno isso
 *     desfaria a hora de abertura — o estúdio abriria às 17:45 e voltaria para o
 *     sol a pino. Devolver `OPEN_HOUR` ANTES do preset faz ele já nascer com a
 *     geometria rasante em vez de ser corrigido um passo depois;
 *  3. `applyPreset()` por último, e ele TAMBÉM reseta az/el/brightness para os
 *     padrões do preset — que é exatamente o que um reset quer.
 *
 * `animate: false` numa troca de cenário (ela acontece atrás da cortina, e um
 * crossfade de 0,8 s entre dois rigs sem relação lê como falha); animado quando
 * é o "Novo", onde a cena na tela é a mesma e a transição é a resposta visual de
 * que algo aconteceu.
 */
export function applyEnvironmentLighting(
  envDef: EnvironmentDef | null | undefined = current,
  opts: { animate?: boolean; reset?: boolean } = {},
) {
  if (!envDef) return false;
  const animate = !!opts.animate;
  setTimeOfDay(envDef.timeOfDay === 'noite' ? 'noite' : 'dia', { animate });
  if (envDef.timeOfDay !== 'noite') setHourOfDay(OPEN_HOUR, { animate });
  applyPreset(resetPreset(envDef, opts.reset), { animate });
  return true;
}

/**
 * Qual preset um RESET deve escolher — e por que ele nem sempre é o do manifesto.
 *
 * ⚠️ DEFEITO RELATADO com print: depois de um "Novo" no `distrito-industrial` a
 * cena ficou *"totalmente lavada"*. A causa: o manifesto daquele cenário declara
 * `preset: 'ensolarado'`, que é autorado para SOL A PINO — e o relógio do estúdio
 * abre às 17:45 (`OPEN_HOUR`), com o sol a 11°. Preset de meio-dia com geometria
 * de fim de tarde é exatamente a metade lavada do problema que a nota de
 * `OPEN_HOUR` descreve na direção oposta ("dourado no tom, meio-dia na forma").
 *
 * `LIGHT_DEFAULTS.preset` é `dourado`, e a escolha é DELIBERADA e está
 * documentada em scene.ts: *"é luz RASANTE, e é ela que faz a lataria mostrar o
 * que a tinta tem. Sol a pino bate quase perpendicular à chapa: a casca de
 * laranja some, o floco não cintila e o flop do perolizado não tem raspagem para
 * aparecer."* Num estúdio de PINTURA esse é o ponto inteiro do produto.
 *
 * Então um reset devolve o padrão do PRODUTO, não o do manifesto — com uma
 * exceção que não é negociável: um cenário de ESTÚDIO precisa de um preset de
 * estúdio. `ciclorama` é `env: 'room'` e `solar: false`; pôr `dourado` num
 * ciclorama fechado é o defeito irmão, que foi o relato anterior. A pergunta que
 * separa os dois casos é a do próprio preset (`LightPreset.studio`), não uma
 * lista de ids que a próxima cena esqueceria de atualizar.
 *
 * `reset: false` (o padrão, e o caminho da TROCA de cenário) mantém o manifesto
 * mandando: ali o preset é a apresentação autoral daquele lugar, e trocá-la seria
 * o estúdio discordando do catálogo.
 */
function resetPreset(envDef: EnvironmentDef, reset?: boolean): string {
  if (!reset) return envDef.preset;
  const doCenario = LIGHT_PRESETS[envDef.preset];
  return doCenario && doCenario.studio ? envDef.preset : LIGHT_DEFAULTS.preset;
}

