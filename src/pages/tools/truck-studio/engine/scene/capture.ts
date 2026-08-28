/* High-resolution capture — what the "Baixar imagem" button actually downloads.

   WHY THIS MODULE EXISTS. The obvious implementation is one line:

       a.href = renderer.domElement.toDataURL('image/png');

   and that is what this used to be. The problem is not the encoding — PNG is
   lossless — it is the SIZE. That call reads back the on-screen drawing buffer,
   whose dimensions are fixed by two lines in scene.ts: `setSize(w, h)` with the
   holder's CSS size, and `setPixelRatio(min(devicePixelRatio, 2))`. So the
   exported file came out at *holder size x DPR, capped at 2x* — roughly
   1500x900 on a 1080p desktop monitor, and never more than 2x even on a 4K
   panel. Same code, half the pixels depending on the display.

   O QUE MUDOU DEPOIS DISSO, EM DUAS ETAPAS
   ---------------------------------------------------------------------------
   (1) TRÊS PRESETS, E A ARESTA LONGA É O ALVO. Antes existia um `scale` (3x o
   viewport), que reproduzia a queixa original com outro nome: a MESMA escolha
   dava arquivos diferentes em monitores diferentes. Agora o usuário escolhe uma
   ARESTA LONGA — 1920, 3840 ou 7680 — e a proporção é a DO QUE ESTÁ NA TELA.
   Dois monitores, a mesma escolha, o mesmo número de pixels.

   (2) A CAPTURA SAIU DA TELA. Esta é a correção do defeito relatado pelo dono do
   produto: *"quando vou tirar o render, a camera muda completamente de posicao
   do que estava; depois que o render e baixado ela volta."* Ele estava certo, e
   a causa eram DUAS coisas que a versão anterior fazia no objeto vivo:

     - `camera.setViewOffset(...)` era aplicado NA CÂMERA DO ESTÚDIO, uma vez por
       ladrilho. Dezesseis sub-frustums em ~1,4 s, cada um desenhado no canvas
       visível: o usuário via a vista saltar por dezesseis enquadramentos e
       voltar.
     - `renderer.setSize(tile, tile, false)` trocava o tamanho do BUFFER do canvas
       visível mantendo o tamanho CSS, então cada ladrilho aparecia esticado
       sobre a área inteira do render — o que amplificava o salto.

   A regra agora é dura e vale para os três presets:

     A CAPTURA NÃO TOCA NA CÂMERA VIVA E NÃO ESCREVE NO CANVAS VISÍVEL.

   Duas peças a garantem, e nenhuma depende de restaurar nada:

     - UMA CÓPIA DA CÂMERA. `captureCamera()` devolve uma PerspectiveCamera nova
       com a mesma pose, o mesmo frustum e a mesma matriz de mundo. Todo
       `setViewOffset`/`aspect`/`updateProjectionMatrix` acontece nela. Não há o
       que restaurar no `finally`, e — o que importa mais — uma exceção no meio
       do mosaico não pode deixar a câmera do estúdio enquadrando 1/16 da cena,
       que era o modo de falha mais assustador que este arquivo tinha.
       Copiar é também o que torna o mosaico IMUNE a a câmera se mexer no meio:
       os dezesseis ladrilhos saem do mesmo frustum, congelado no clique.
     - UM WebGLRenderTarget. Cada passe renderiza para um alvo fora de tela e
       volta por `readRenderTargetPixels`. O framebuffer padrão — o canvas que o
       usuário está olhando — não é ligado, não é limpo e não é desenhado em
       nenhum momento da captura. `renderer.setSize`/`setPixelRatio` saíram
       daqui: um render target tem o próprio viewport, então o buffer do canvas
       visível nem precisa mudar de tamanho.

   POR QUE `isXRRenderTarget = true` NO ALVO. Não é gambiarra decorativa; sem
   isso a imagem sai com OUTRAS CORES. Em three r0.179 (WebGLPrograms.js:6946 e
   :6979) o mapeamento de tons e a codificação de saída são desligados quando se
   renderiza para um render target — a menos que ele seja o alvo do XR:

       toneMapping    = (target === null || target.isXRRenderTarget) ? renderer.toneMapping : NoToneMapping
       outputColorSpace = target === null ? renderer.outputColorSpace
                        : (target.isXRRenderTarget ? target.texture.colorSpace : LinearSRGBColorSpace)

   Sem a marca, a captura sairia SEM o ACESFilmic e SEM o encode sRGB — linear,
   escura e dessaturada, nada parecida com a tela. Com ela mais
   `texture.colorSpace = SRGBColorSpace` e `texture.internalFormat = 'RGBA8'`
   (ver makeTarget: os três andam juntos, e sem o terceiro o resolve do MSAA
   falha e a imagem sai preta), o alvo passa exatamente pelo mesmo caminho de
   saída do canvas. É o mesmo contrato que o próprio three usa para o framebuffer
   do WebXR. Se um dia three remover a marca (o TODO deles é a issue #23278), o
   sintoma será cor errada na imagem salva, não uma exceção — daí este parágrafo.

   | Preset | Aresta | ~16:9      | MP   | Passes | Formato      |
   |--------|--------|------------|------|--------|--------------|
   | baixa  | 1920   | 1920x1080  |  2,1 | 1      | WebP q 0.92  |
   | média  | 3840   | 3840x2160  |  8,3 | 1      | PNG          |
   | alta   | 7680   | 7680x4320  | 33,2 | 16     | PNG          |

   POR QUE "ALTA" NÃO CABE NUM PASSE ÚNICO. Com 4 amostras o alvo custa ~40 bytes
   por pixel (cor + profundidade, multiamostrados). 33 MP seriam ~1,3 GB — perda
   de contexto garantida, o que derrubaria o estúdio inteiro em vez de apenas
   falhar em salvar um arquivo. E supersampling (renderizar 2x e reduzir)
   MULTIPLICA POR 4 exatamente o problema que precisa encolher.

   A saída é RENDERIZAR EM LADRILHOS, que o three suporta nativamente via
   `camera.setViewOffset(fullW, fullH, x, y, w, h)`: cada ladrilho é um render
   normal de <= 1920^2, com MSAA de verdade, lido para um canvas 2D do tamanho
   final. A memória de GPU fica CONSTANTE seja qual for a resolução pedida; o
   custo passa a ser RAM de canvas (7680x4320x4 ~ 132 MB) e N renders sequenciais.

   OS INVARIANTES, nenhum opcional:

   1. NADA VIVO É MUTADO PARA DESENHAR. Câmera copiada, alvo próprio. O que ainda
      é global — o mapa de sombra e o laço de render — está listado no item 4.

   2. A PROPORÇÃO DA IMAGEM É A DA CÂMERA QUE ESTÁ NA TELA. `camera.aspect` é o
      que decide o enquadramento do viewport, então é dele — e não do tamanho do
      holder, que pode estar um quadro à frente do `resize()` — que a saída é
      derivada. Detalhe que faz o ladrilho ser EXATO: `updateProjectionMatrix()`
      deriva o frustum completo de `aspect` e o view offset recorta um
      sub-retângulo NORMALIZADO dele (`offsetX / fullWidth`). Logo o mosaico só
      fecha sem distorção se `fullW / fullH == aspect` — e como as dimensões são
      ARREDONDADAS PARA MÚLTIPLOS da grade de ladrilhos, quem se ajusta é a
      CÓPIA: `cam.aspect = fullW / fullH`. O desvio em relação à tela é < 0,05 %,
      e o mosaico fica exato por construção em vez de por sorte.

   3. `toBlob`, nunca `toDataURL`. Um PNG de 33 MP em base64 é uma string de
      centenas de MB, e os navegadores limitam o tamanho de um `data:` que um
      download pode apontar.

   4. O laço de render fica PARADO em volta da operação inteira, e o MAPA DE
      SOMBRA é aumentado UMA VEZ para os 16 ladrilhos. São as duas únicas coisas
      globais que a captura ainda mexe, e as duas voltam no `finally`. O laço
      parado não é performance: com ele vivo, `applyAvoidance()` continuaria
      correndo a câmera do estúdio entre os ladrilhos — inofensivo para a imagem
      (que sai da cópia), mas seria trabalho de GPU disputando com o mosaico.

   POR QUE OS LADRILHOS NÃO COSTURAM. Tudo que roda por FRAGMENTO e depende só
   da cor ou da profundidade é invariante à posição do ladrilho: o tone mapping
   (ACESFilmic) é uma função da cor, e o fog é função da distância. Não existe
   nenhum passe de tela cheia nesta cena — um bloom ou uma vinheta costurariam,
   e é por isso que este comentário existe.

   O MAPA DE SOMBRA é a única coisa que não escala sozinha. É um alvo de
   profundidade 3072^2 fixo (SHADOW_MAP_SIZE em scene.ts), então numa imagem 4x
   mais nítida a sombra ficaria exatamente igual de grossa e a suavidade leria
   como defeito em vez de PCF. Ele é aumentado UMA VEZ para a sessão inteira de
   ladrilhos — o que finalmente amortiza as duas realocações que ele custa — e
   devolvido no `finally`.
   ATENÇÃO ao par `dispose()` + `needsUpdate`: `scene.ts` roda com
   `shadowMap.autoUpdate = false`, e o `WebGLShadowMap.render()` do three sai
   logo na entrada quando `autoUpdate` e `needsUpdate` são os dois falsos. Soltar
   o mapa sem marcar `needsUpdate` deixava `light.shadow.map` em null pelo resto
   da captura — a imagem saía SEM A SOMBRA do key light, em silêncio. As duas
   marcações abaixo são o conserto, e a do `finally` é o que devolve o mapa de
   3072 ao viewport.

   O QUE DELIBERADAMENTE NÃO É FEITO: o mapa de ambiente fica como está. */
import * as THREE from 'three';
import {
  renderer, scene, camera, holder, getKeyLight, startLoop, stopLoop, invalidateShadows,
} from './scene';
import { renderCycloramaReflection } from './cyclorama';
import { gradeTile } from './look';
import { root } from '../core/dom';
import { ceilingProfile, ceilingShadowMapSize, renderScale } from '../core/quality';
import { setPaintPixelScale, paintPixelScale } from '../vehicle/paint';
import { applyLod, releaseLod } from '../vehicle/lod';

/** Os três presets, pelo id que a interface e o localStorage usam. */
export type CaptureQuality = 'low' | 'medium' | 'high';

interface QualityPreset {
  /** rótulo pt-BR do menu */
  label: string;
  /** o que ele é para, em cinco palavras */
  hint: string;
  /** ARESTA LONGA alvo, em pixels — o ÚNICO botão do preset */
  edge: number;
  mime: string;
  ext: string;
  /** só para WebP/JPEG; PNG ignora */
  quality?: number;
  /** ladrilhos por eixo. 1 = passe único */
  tiles: number;
  /** aumentar o mapa de sombra para acompanhar a resolução */
  sharpenShadows: boolean;
}

/* UM PRESET É UMA RESOLUÇÃO, E SÓ.
   O teto de ÁREA que morava aqui (`maxPixels`) saiu: ele fazia "Alta · 7680"
   entregar 7303 px num viewport 4:3 — a mesma classe de surpresa que o `scale`
   por viewport tinha, só que mais difícil de perceber, porque o menu continuava
   dizendo 7680. A rede contra uma imagem grande demais não precisa ser um número
   por preset: se o canvas de composição não alocar, a captura DEGRADA para Média
   com mensagem (ver captureViewport), que é a resposta certa e já existia. */
export const CAPTURE_PRESETS: Record<CaptureQuality, QualityPreset> = {
  /* WebP com perdas a 0.92 é ~8x menor que o PNG equivalente e visualmente
     indistinguível nesta escala — é o preset "mando por e-mail agora". */
  low: {
    label: 'Baixa', hint: 'Rápida, para e-mail',
    edge: 1920,
    mime: 'image/webp', ext: 'webp', quality: 0.92,
    tiles: 1,
    /* A sombra FICA em 3072^2: a 1920 de aresta longa ela já é mais fina que o
       pixel da imagem, e as duas realocações que o aumento custa seriam pagas
       por nada. */
    sharpenShadows: false,
  },
  medium: {
    label: 'Média', hint: 'Padrão',
    edge: 3840,
    mime: 'image/png', ext: 'png',
    tiles: 1,
    sharpenShadows: true,
  },
  high: {
    label: 'Alta', hint: 'Impressão / zoom',
    edge: 7680,
    mime: 'image/png', ext: 'png',
    /* 4 x 4. Com aresta longa 7680 cada ladrilho fica em 1920, que é o tamanho
       em que um alvo multiamostrado ainda é barato (~150 MB a 4 amostras) em
       placa integrada. */
    tiles: 4,
    sharpenShadows: true,
  },
};

export const DEFAULT_QUALITY: CaptureQuality = 'medium';

/** Aresta máxima de um ÚNICO ladrilho. Ver o preset `high`. */
const MAX_TILE = 1920;

/* Teto do mapa de sombra aumentado. 4096^2 é uma duplicação do 3072^2 de
   regime e já são ~67 MB de alvo de profundidade; 8192^2 seriam 268 MB para uma
   diferença que o PCF borra de qualquer jeito. */
const MAX_SHADOW = 4096;

/** Amostras de MSAA do alvo de captura — as mesmas que `antialias: true` pede. */
const WANT_SAMPLES = 4;

/**
 * O que fica ATRÁS do veículo na imagem.
 *
 * `cena` é a captura de sempre: o quadro que está na tela, com cenário, céu e
 * tudo. `recorte` é o veículo sozinho sobre transparência, com a sombra de
 * contato preservada — ver o bloco "o fundo transparente".
 */
export type CaptureBackground = 'cena' | 'recorte';

export interface CaptureResult {
  blob: Blob;
  /** as dimensões reais da imagem exportada, depois de todos os limites */
  width: number;
  height: number;
  /** o preset que de fato rodou — pode ser MENOR que o pedido (ver `degraded`) */
  quality: CaptureQuality;
  /** quantos ladrilhos foram renderizados (1 = passe único) */
  tiles: number;
  /** o fundo que de fato saiu */
  background: CaptureBackground;
  /** não-nulo quando o preset pedido não coube nesta placa */
  degraded: string | null;
}

export interface CaptureOptions {
  quality?: CaptureQuality;
  /** `'recorte'` → veículo sobre transparência. Padrão `'cena'`. */
  background?: CaptureBackground;
  /** desligar o aumento do mapa de sombra (afordance de console) */
  sharpenShadows?: boolean;
  /** progresso do modo alta: `onTile(feitos, total)` */
  onTile?: (done: number, total: number) => void;
}

/* Promisified toBlob. `toBlob` reporta falha devolvendo null em vez de lançar, e
   a única coisa que não pode acontecer é uma promessa rejeitada pular o caminho
   de restauração do chamador — então todo modo de falha chega aqui como um null
   simples e quem chamou decide. */
function encode(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), mime, quality);
    } catch {
      resolve(null);
    }
  });
}

/** A maior aresta de buffer que este driver aceita. */
function edgeLimit(): number {
  const caps = renderer.capabilities;
  const gl = renderer.getContext();
  /* MAX_RENDERBUFFER_SIZE é o limite que de fato se aplica a um alvo de render, e
     nem sempre é igual a MAX_TEXTURE_SIZE; pegar o menor, e cair no limite de
     textura se a consulta voltar vazia (alguns drivers reportam 0 para
     parâmetros que não implementam). */
  const rbMax = Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)) || caps.maxTextureSize;
  return Math.max(1, Math.min(rbMax, caps.maxTextureSize));
}

/**
 * A proporção DO QUE ESTÁ NA TELA.
 *
 * `camera.aspect` e não `holder.clientWidth / clientHeight`: é o aspect da
 * câmera que decide o enquadramento do quadro que o usuário está vendo agora, e
 * os dois podem divergir por um instante (o `resize()` de scene.ts roda num
 * quadro, e a captura pode ser pedida antes dele). Capturar pelo holder nesse
 * intervalo daria uma imagem enquadrada diferente da tela — que é exatamente a
 * surpresa que este módulo tem de não produzir.
 */
function viewportAspect(): number {
  const a = camera.aspect;
  if (Number.isFinite(a) && a > 0) return a;
  const w = holder.clientWidth || 16;
  const h = holder.clientHeight || 9;
  return w / h;
}

/**
 * As dimensões de saída de um preset, dada a proporção do viewport.
 *
 * A aresta LONGA recebe `preset.edge`, exatamente; a curta sai da proporção.
 * Não há mais nenhum outro fator: o preset é uma resolução.
 */
function outputSize(aspect: number, preset: QualityPreset) {
  const outW = aspect >= 1 ? preset.edge : Math.round(preset.edge * aspect);
  const outH = aspect >= 1 ? Math.round(preset.edge / aspect) : preset.edge;
  return { outW: Math.max(1, outW), outH: Math.max(1, outH) };
}

/**
 * Quantos ladrilhos por eixo, e de que tamanho, para uma saída de outW x outH.
 *
 * TODO PRESET PASSA POR AQUI, inclusive os de "passe único" — que na prática são
 * os que o grid devolve como 1x1. Não é uniformidade por gosto: o alvo de render
 * é MULTIAMOSTRADO, e o que ele custa é `w * h * (cor + profundidade) *
 * amostras` ≈ 32 bytes por pixel a 4 amostras. Um passe único de 3840x1678 são
 * ~206 MB numa alocação só — e MEDIDO neste harness ele não volta: a captura
 * fica pendurada ANTES do primeiro `render()`, sem erro, esperando o driver.
 * Com o teto de `MAX_TILE` a mesma imagem sai em 2 ladrilhos de 1920x1678
 * (~103 MB cada, um de cada vez) e a memória de GPU passa a ser CONSTANTE seja
 * qual for o preset. `preset.tiles` deixou de ser "quantos ladrilhos" e virou o
 * MÍNIMO por eixo; quem manda é o maior entre ele e o que o teto exige.
 *
 * As dimensões voltam ARREDONDADAS para múltiplos exatos da grade — ver o
 * invariante 2 no cabeçalho: é isso que faz todo ladrilho ter o mesmo tamanho
 * (uma alocação de alvo para os 16) e o mosaico fechar sem sobreposição nem
 * folga. Quem se ajusta ao arredondamento é o `aspect` da CÓPIA da câmera.
 *
 * Conferido nos três presets, com o viewport 961x420 do harness:
 *   Baixa 1920x839  → 1x1 = 1  · ladrilho 1920x839
 *   Média 3840x1678 → 2x1 = 2  · ladrilho 1920x1678
 *   Alta  7680x3356 → 4x4 = 16 · ladrilho 1920x839   (os 16 verificados, intactos)
 */
function tiling(outW: number, outH: number, want: number, edgeMax: number) {
  const cap = Math.max(256, Math.min(MAX_TILE, edgeMax));
  /* Nunca menos ladrilhos do que o driver exige: se a placa só aceita 2048 e a
     imagem tem 7680, quatro por eixo é o MÍNIMO, não uma preferência. */
  let nx = Math.max(want, Math.ceil(outW / cap));
  let ny = Math.max(want, Math.ceil(outH / cap));
  /* Uma imagem menor que a grade pedida não precisa dela. */
  nx = Math.max(1, Math.min(nx, outW));
  ny = Math.max(1, Math.min(ny, outH));
  const tileW = Math.max(1, Math.round(outW / nx));
  const tileH = Math.max(1, Math.round(outH / ny));
  return { nx, ny, tileW, tileH, fullW: tileW * nx, fullH: tileH * ny };
}

/**
 * A CÓPIA da câmera do estúdio — o coração da correção deste módulo.
 *
 * `copy()` do three já traz pose, matriz de mundo, a INVERSA dela, o frustum e
 * as duas matrizes de projeção. As duas linhas que importam vêm depois:
 * desligar as duas atualizações automáticas. Sem elas, `renderer.render()` veria
 * uma câmera sem pai e recalcularia `matrixWorld` a partir de `matrix` — o que é
 * a mesma coisa HOJE, e deixaria de ser no dia em que a câmera do estúdio ganhar
 * um pai. Copiar a matriz de mundo e proibir o recálculo é correto nos dois
 * casos.
 *
 * O `aspect` recebido é o do MOSAICO (fullW/fullH), não o da tela: ver o
 * invariante 2.
 */
function captureCamera(aspect: number): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera();
  cam.copy(camera, false);
  cam.matrixAutoUpdate = false;
  cam.matrixWorldAutoUpdate = false;
  /* Uma câmera de estúdio nunca deveria ter um view offset posto, mas `copy()`
     traria um se tivesse — e ele se somaria ao recorte do ladrilho. */
  cam.clearViewOffset();
  cam.aspect = aspect;
  cam.updateProjectionMatrix();
  return cam;
}

/** O alvo fora de tela de um passe. Ver o cabeçalho para `isXRRenderTarget`. */
function makeTarget(w: number, h: number): THREE.WebGLRenderTarget {
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const maxSamples = Number(gl.getParameter(gl.MAX_SAMPLES)) || 0;
  const rt = new THREE.WebGLRenderTarget(w, h, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    depthBuffer: true,
    /* Nada nesta cena usa stencil, e o buffer combinado custaria a mesma banda
       de memória do de profundidade em cada resolve de ladrilho. */
    stencilBuffer: false,
    samples: Math.max(0, Math.min(WANT_SAMPLES, maxSamples)),
  });
  /* O TRIO que faz a imagem sair EXATAMENTE com as cores da tela. Os dois
     primeiros estão explicados no cabeçalho; o terceiro é obrigatório e foi
     descoberto medindo — sem ele a captura sai PRETA.

     `isXRRenderTarget` chega a `getInternalFormat(..., forceLinearTransfer)`
     (WebGLTextures.js:12088) e força o RENDERBUFFER MULTIAMOSTRADO a RGBA8,
     enquanto a textura de resolve, derivada de `colorSpace = SRGB`, ficaria
     SRGB8_ALPHA8. Os dois formatos entram no mesmo `blitFramebuffer` do resolve,
     que exige formatos compatíveis: o driver devolve GL_INVALID_OPERATION
     (1282), o resolve não acontece e `readRenderTargetPixels` lê um alvo nunca
     escrito — zeros. Nomear o formato interno alinha os dois lados em RGBA8, e
     como `outputColorSpace` continua vindo de `texture.colorSpace`, o shader
     segue escrevendo os bytes já codificados em sRGB.

     MEDIDO contra o canvas visível (mesmo tamanho, mesma câmera, ~45 000 canais
     amostrados), as quatro combinações possíveis:

       samples 4 + XR + RGBA8   erro médio 0,00 · máximo 0    ← esta
       samples 4 + XR           GL 1282, imagem toda preta
       samples 4 sem XR         erro médio 5,90 · máximo 55   (sem tone mapping)
       samples 0 + XR           erro médio 66,42              (codifica duas vezes)

     Ou seja: a imagem salva é o quadro da tela, byte a byte, só que maior. */
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  rt.texture.internalFormat = 'RGBA8';
  (rt as unknown as { isXRRenderTarget: boolean }).isXRRenderTarget = true;
  return rt;
}

/**
 * Uma linha de pixels do WebGL vem de baixo para cima; um ImageData vai de cima
 * para baixo. A cópia é por LINHA (`set` de um subarray é memcpy).
 *
 * `opaque` FORÇA o alfa a 255, e é o padrão. Não é preciosismo: numa captura
 * normal a cena É opaca (o fundo é céu ou cor de limpeza com alfa 1), mas um
 * único pixel com alfa < 255 vira transparência de verdade no PNG salvo — e o
 * canvas 2D é `alpha: false` justamente para isso não existir. Escrito byte a
 * byte, não por Uint32: um OR de máscara dependeria da ordem de bytes da
 * máquina.
 *
 * Com `opaque: false` o alfa ATRAVESSA, que é o recorte transparente. É a
 * única linha de código que separa uma coisa da outra no caminho de pixels —
 * ver o bloco "o fundo transparente" lá embaixo para o resto.
 */
function flipInto(src: Uint8Array, dst: Uint8ClampedArray, w: number, h: number,
  opaque = true) {
  const row = w * 4;
  for (let y = 0; y < h; y++) {
    dst.set(src.subarray((h - 1 - y) * row, (h - y) * row), y * row);
  }
  if (opaque) for (let i = 3; i < dst.length; i += 4) dst[i] = 255;
}

/* ---------------- o fundo transparente ----------------
   O PEDIDO: "as imagens renderizadas lá tenham fundo transparente, ou pelo menos
   que possa ser selecionado".

   O QUE ELE **NÃO** CUSTOU, e vale dizer primeiro porque é contraintuitivo:
   NÃO foi preciso ligar `alpha: true` no WebGLRenderer. Aquilo é uma flag de
   CONSTRUÇÃO — mudá-la afetaria todo quadro de tela pelo resto da sessão, para
   servir a um botão apertado algumas vezes por dia. E não é preciso porque esta
   captura já não desenha no canvas visível: ela renderiza para um
   `WebGLRenderTarget` com `RGBAFormat`, e **o canal alfa sempre esteve lá**. O
   que o jogava fora eram três linhas, todas neste arquivo:

     1. `flipInto()` forçava alfa 255 em todo pixel;
     2. `scene.background` continuava sendo o céu (ou a cor de limpeza);
     3. o canvas 2D de composição era `{ alpha: false }`.

   O QUE UM RECORTE É. Um caminhão sem fundo não é "a mesma cena sem o céu": é o
   VEÍCULO e a luz dele, e nada mais. Por isso a isolação é uma LISTA DE
   PERMISSÃO e não uma lista de exclusão — ficam o grupo `RIG` e as luzes, e todo
   o resto some. Escrito assim de propósito: uma exclusão por nome
   (`ts-set`, `ts-ciclorama`, `ts-haze`, domo, estrelas, postes, chuva) estaria
   incompleta no dia em que a cena ganhasse mais um filho, e o sintoma seria um
   poste flutuando num PNG que deveria ter só o caminhão. Com permissão, o
   padrão de qualquer coisa nova é ficar de fora, que é o lado certo de errar.

   A SOMBRA DE CONTATO É O QUE FAZ ISTO SER USÁVEL. Sem o piso do ciclorama não
   há sombra, e um veículo recortado sem sombra FLUTUA — é a diferença entre um
   recorte que entra num catálogo e um que precisa ser refeito no Photoshop. O
   plano abaixo usa `ShadowMaterial`, que é o único material do three que escreve
   SÓ a máscara de sombra no alfa: onde não há sombra ele não escreve nada, e o
   fundo continua transparente. Um `MeshBasicMaterial` com opacidade não serviria
   — ele pintaria o plano inteiro. */

/** Meia-aresta do plano de sombra, em metros. Cobre a órbita inteira do rig. */
const SHADOW_PLANE_HALF = 40;

let shadowPlane: THREE.Mesh | null = null;

function ensureShadowPlane(): THREE.Mesh {
  if (shadowPlane) return shadowPlane;
  const geo = new THREE.PlaneGeometry(SHADOW_PLANE_HALF * 2, SHADOW_PLANE_HALF * 2);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShadowMaterial({ opacity: 0.42 });
  mat.name = 'ts-capture-shadow';
  shadowPlane = new THREE.Mesh(geo, mat);
  shadowPlane.name = 'ts-capture-shadow';
  shadowPlane.receiveShadow = true;
  shadowPlane.castShadow = false;
  /* y = 0 é o piso do mundo — `groundAndCenter()` assenta os pneus nele e
     scene/cyclorama.ts põe o piso da sala no mesmo lugar. */
  shadowPlane.position.y = 0;
  return shadowPlane;
}

/**
 * Esconde tudo que não é o veículo nem luz, põe o plano de sombra e devolve a
 * função que desfaz. Sempre chamada dentro de um try/finally.
 */
function isolateVehicle(): () => void {
  const hidden: THREE.Object3D[] = [];
  const rig = scene.getObjectByName('RIG');
  for (const child of scene.children) {
    if (!child.visible) continue;                 // já escondido: não é nosso
    if (child === rig) continue;
    if ((child as THREE.Light).isLight) continue;
    /* O `target` da DirectionalLight é um Object3D solto na cena e cai aqui,
       escondido junto — e isso é INOFENSIVO, não um descuido: o three lê
       `target.matrixWorld`, e `updateMatrixWorld()` percorre nós invisíveis. A
       direção da chave e a caixa de sombra continuam exatamente onde estavam.
       (Verificado antes de escrever: `renderer.render()` chama
       `scene.updateMatrixWorld()` sem filtrar por visibilidade; quem filtra é o
       `projectObject`, que decide o que DESENHAR.) */
    child.visible = false;
    hidden.push(child);
  }
  const plane = ensureShadowPlane();
  const centre = rig ? rig.position : null;
  if (centre) plane.position.set(centre.x, 0, centre.z);
  scene.add(plane);
  /* O mapa de sombra tem de ser refeito: o ciclorama saiu da cena e o plano
     entrou, e os dois são receptores. `needsUpdate` direto porque scene.ts roda
     com `autoUpdate = false` e o laço está PARADO durante a captura —
     invalidateShadows() pediria um quadro que ninguém vai desenhar. */
  renderer.shadowMap.needsUpdate = true;
  return () => {
    scene.remove(plane);
    for (const o of hidden) o.visible = true;
    renderer.shadowMap.needsUpdate = true;
  };
}

/* Um quadro cedido ENTRE ladrilhos, não dentro: mantém a aba responsiva e deixa
   a pílula de progresso repintar "7/16" de verdade.

   SÓ COM A ABA VISÍVEL, e isso foi medido: numa aba escondida não há pintura a
   esperar, `requestAnimationFrame` nunca dispara e o `setTimeout` cai no
   *intensive throttling* do Chrome (um disparo por minuto depois de 5 min
   escondida). Uma captura de 16 ladrilhos passou de alguns segundos para 25 s
   POR LADRILHO. Sem ninguém olhando, o certo é não ceder nada.
   (Escrito aqui em vez de importado de ui/loader.ts: scene/ não importa ui/, e
   essa seta é o que mantém o engine portável.) */
function yieldFrame(): Promise<void> {
  if (document.hidden) return Promise.resolve();
  return new Promise<void>((r) => {
    let settled = false;
    const go = () => { if (!settled) { settled = true; r(); } };
    requestAnimationFrame(go);
    setTimeout(go, 250);
  });
}

/**
 * O mosaico — N x N renders FORA DA TELA compostos num canvas 2D. `nx * ny === 1`
 * é o caso do passe único, e passa pelo mesmo caminho de propósito: um segundo
 * caminho de render seria um segundo lugar de onde a câmera viva pode ser tocada.
 *
 * Devolve null quando o canvas de composição ou o alvo de render não puderam ser
 * alocados — 33 MP de RGBA são ~132 MB, e um navegador que recusa isso tem de
 * degradar para Média com uma mensagem, não travar.
 */
async function renderMosaic(
  cam: THREE.PerspectiveCamera,
  fullW: number, fullH: number, nx: number, ny: number, tileW: number, tileH: number,
  transparent: boolean,
  onTile?: (done: number, total: number) => void,
): Promise<HTMLCanvasElement | null> {
  const out = document.createElement('canvas');
  out.width = fullW;
  out.height = fullH;
  /* `alpha: false` no caminho normal: a composição é só escrita, e um alvo opaco
     é metade da banda de memória de um com alfa. No recorte ele TEM de ser
     `true` — um canvas 2D sem alfa força todo pixel a opaco na escrita, então o
     `putImageData` jogaria fora exatamente a transparência que o render target
     acabou de produzir. */
  const ctx = out.getContext('2d', { alpha: transparent });
  if (!ctx) return null;

  const total = nx * ny;
  /* O alvo anterior é quase sempre `null`, mas a sonda de reflexo (scene/probe.ts)
     também usa alvos — restaurar o que estava é mais barato que assumir. */
  const prevTarget = renderer.getRenderTarget();
  let rt: THREE.WebGLRenderTarget | null = null;
  /* Guardados ANTES do try, restaurados no finally: o fundo da cena e o alfa de
     limpeza são globais do renderizador, e uma exceção no meio do mosaico não
     pode deixar o estúdio com o céu desligado. */
  const prevBackground = scene.background;
  const prevClearAlpha = renderer.getClearAlpha();
  let restoreIsolation: (() => void) | null = null;
  /* A SOMBRA DA FOTO SAI NO TETO, mesmo com a vista rodando no piso.
     ---------------------------------------------------------------------------
     A regra do perfil de qualidade (ver o cabeçalho de `core/quality.ts`) é que
     a imagem BAIXADA é o produto e não se degrada nunca — um PC fraco pode ter
     uma vista 3D suave e ainda assim baixar a mesma foto que o PC bom baixa, só
     demorando mais.

     A resolução de render já obedecia por CONSTRUÇÃO: esta função renderiza em
     ladrilhos para um `WebGLRenderTarget` próprio, que tem o próprio viewport e
     não passa por `setPixelRatio` (ver o cabeçalho deste arquivo). O MAPA DE
     SOMBRA não obedecia, e era a única brecha: ele é global do renderizador, e
     no nível Baixo a foto sairia com uma sombra 1024² — visível, e justamente
     no contato do pneu com o chão, que é onde o olho procura.

     Levantar aqui é barato porque a captura já roda fora do laço e sob a
     cortina: o custo é uma realocação de alvo e um passe de sombra, pagos uma
     vez por foto, não por quadro. */
  const shadowCeil = ceilingShadowMapSize();
  const prevShadowSide = getKeyLight().shadow.mapSize.x;
  let restoreShadow: (() => void) | null = null;

  /* ---------------- O FLOCO METÁLICO É A OUTRA COISA QUE NÃO ESCALA ----------
     Mesma família do mapa de sombra logo acima, e descoberta pelo mesmo tipo de
     relato: *"no render (foto tirada) quando em qualidade máxima, os flakes
     metálicos ficam muito grandes"*.

     O shader da tinta escolhe a oitava do floco — e quanto dele é desenhado
     DISCRETO em vez de dissolvido em rugosidade — a partir de `fwidth()`, que
     mede o pixel DO BUFFER em curso. Aqui o buffer tem 7680 px de aresta contra
     os ~1920 da tela, então o mesmo floco de 3,3 mm passa de sub-pixel
     (invisível, virou brilho) a ~4 px (visível, e grande). Ver o bloco `uPxScale`
     em vehicle/paint.ts, onde os números estão.

     A razão é de ALTURA e sai do canvas real, não do preset: `fullH` já foi
     arredondado para a grade de ladrilhos, e `domElement.height` já inclui o
     `setPixelRatio` — que é justamente o que faz a mesma foto ser tirada de duas
     telas diferentes. Piso em 1: uma captura MENOR que a tela (o preset Baixa
     numa tela 4K) não pode ENGROSSAR o floco. */
  /* ⚠️ A REFERÊNCIA É A TELA NO TETO, NÃO O BUFFER DE AGORA. `domElement.height`
     passou a carregar a ESCALA DE RENDER do perfil de qualidade (ver
     `effectivePixelRatio()` em scene.ts), e ela não pertence a esta conta: a
     razão aqui existe para ancorar o floco da FOTO ao pixel da TELA, e a tela de
     referência é sempre a do nível Alta.

     Sem desfazer a escala, uma máquina rodando a 0,65 dividiria por um número
     1,54× menor, pediria uma oitava mais grossa e baixaria uma foto com o floco
     diferente do de uma máquina em Alta — que é precisamente a violação da regra
     "a imagem baixada é o produto e não se degrada nunca". */
  const prevPxScale = paintPixelScale();
  const telaNoTeto = Math.max(1, renderer.domElement.height / Math.max(0.25, renderScale()));
  /* O piso de 1 mora AQUI agora, e não dentro de `setPaintPixelScale()`: ele é
     regra da captura — uma foto MENOR que a tela não pode engrossar o floco —, e
     deixá-lo na função genérica impedia a tela de usar valores abaixo de 1, que
     é o que a escala de render precisa. */
  setPaintPixelScale(Math.max(1, fullH / telaNoTeto));

  try {
    if (shadowCeil > prevShadowSide) {
      const key = getKeyLight();
      key.shadow.mapSize.set(shadowCeil, shadowCeil);
      key.shadow.map?.dispose();
      key.shadow.map = null;
      renderer.shadowMap.needsUpdate = true;
      restoreShadow = () => {
        key.shadow.mapSize.set(prevShadowSide, prevShadowSide);
        key.shadow.map?.dispose();
        key.shadow.map = null;
        renderer.shadowMap.needsUpdate = true;
      };
    }
    if (transparent) {
      restoreIsolation = isolateVehicle();
      scene.background = null;
      renderer.setClearAlpha(0);
    }
    /* ---------------- O LOD, UMA VEZ, PARA O MOSAICO INTEIRO ----------------
       ⚠️ **A ALTURA É `fullH`, NUNCA A DO LADRILHO E NUNCA A DO VIEWPORT.** O
       mosaico recorta o MESMO frustum com `camera.setViewOffset(fullW, fullH,…)`
       (ver o item 2 dos INVARIANTES), então a densidade angular do ladrilho é a
       da imagem COMPLETA: no preset Alta são 7680x4320 em 4x4 ladrilhos de
       1920x1080, e uma peça mede ~4x mais pixels na foto que na tela de 1080p.
       Passar `tileH` faria o LOD julgar a foto pela régua da tela e apagar da
       IMAGEM BAIXADA peças que ela tem resolução de sobra para mostrar.

       ⚠️ **UMA VEZ, ANTES DO LAÇO.** A câmera foi congelada no clique (ver o
       bloco UMA CÓPIA DA CÂMERA), então a distância de cada peça ao olho é a
       mesma nos dezesseis ladrilhos e a decisão também é. Por ladrilho seria
       dezesseis varreduras de ~1 200 entradas para escrever o mesmo resultado —
       e, pior, dezesseis `shadowMap.needsUpdate` em quadros que não têm por que
       refazer o mapa.

       ⚠️ **O LIMIAR É O DO TETO, NÃO O DO PERFIL VIGENTE**, e hoje isso quer
       dizer ZERO: `ceilingProfile().lodMinPx` é 0 (a tabela do nível Alta em
       `core/quality.ts`). A regra fundadora é "a imagem baixada é o produto e não
       se degrada nunca" — a mesma que levanta o mapa de sombra logo acima —, e
       para um LOD que a auditoria mede como PERDA DE QUALIDADE (ver o cabeçalho
       de `vehicle/lod.ts`) ela significa: desligado na foto, sempre.

       E É POR ISSO QUE A CHAMADA EXISTE MESMO VALENDO ZERO — ela não é
       decorativa, ela é o CONSERTO. `applyLod(cam, fullH, 0)` não é um `return`
       precoce: é `releaseLod()`. Sem ela, uma foto tirada com o estúdio no nível
       Baixa sairia com os ~600 parafusos que o laço vivo tinha acabado de
       esconder — e sairia em silêncio, porque `stopLoop()` já parou o gancho de
       quadro que os devolveria. No dia em que o teto ganhar um limiar próprio, a
       linha passa a fazer as duas coisas sem mudar de forma. */
    applyLod(cam, fullH, ceilingProfile().lodMinPx);
    /* O REFLEXO DO PISO, UMA VEZ, PARA O MOSAICO INTEIRO.
       Ele é desenhado por um gancho de quadro, e durante a captura o laço está
       PARADO — sem esta linha o piso do estúdio refletiria o último
       enquadramento vivo em vez do da foto, que é um defeito que só aparece
       depois de salvar. Aqui e não dentro do laço de ladrilhos por duas razões:
       a matriz de textura tem de descrever o quadro COMPLETO (por isso antes do
       primeiro `setViewOffset()`), e refazer a passada por ladrilho custaria
       dezesseis renderizações da cena inteira por foto.
       No recorte transparente `isolateVehicle()` já escondeu a sala, e a função
       devolve false sozinha. */
    renderCycloramaReflection(cam);

    rt = makeTarget(tileW, tileH);
    /* Dois buffers, REUSADOS pelos 16 ladrilhos: um do tamanho do ladrilho para
       a leitura crua e um para o ImageData já virado. */
    const src = new Uint8Array(tileW * tileH * 4);
    const dst = new Uint8ClampedArray(tileW * tileH * 4);

    let done = 0;
    onTile?.(0, total);

    for (let ty = 0; ty < ny; ty++) {
      for (let tx = 0; tx < nx; tx++) {
        if (total > 1) {
          /* O recorte exato do frustum, NA CÓPIA. Os dois primeiros argumentos
             são o tamanho da imagem COMPLETA — é a razão `offset / full` que o
             three usa, então eles têm de descrever o mosaico inteiro, não o
             ladrilho. */
          cam.setViewOffset(fullW, fullH, tx * tileW, ty * tileH, tileW, tileH);
          cam.updateProjectionMatrix();
        }
        renderer.setRenderTarget(rt);
        renderer.render(scene, cam);
        /* Desligar o alvo é o que RESOLVE o multiamostrado para a textura de uma
           amostra que `readRenderTargetPixels` lê (WebGLRenderer.js:16528). Ler
           com o alvo ainda ligado devolveria o buffer não resolvido. */
        renderer.setRenderTarget(null);
        /* O FILTRO, ENTRE O RENDER E A LEITURA — e depois do desligamento acima,
           que é o que lhe entrega uma textura resolvida para amostrar.
           ⚠️ O RECORTE VAI JUNTO, e é ele que faz a vinheta da foto de 16
           ladrilhos ser a MESMA da foto de um só: `scene/look.ts` mede vinheta e
           grão na coordenada do QUADRO INTEIRO, não na do ladrilho. O `1 - …` do
           terceiro termo é a virada de eixo — `setViewOffset` conta de cima para
           baixo, o uv da textura conta de baixo para cima.
           Sem filtro ativo isto devolve o próprio `rt` e não aloca nada. */
        const read = gradeTile(
          rt, tileW, tileH,
          [tileW / fullW, tileH / fullH,
            (tx * tileW) / fullW, 1 - ((ty + 1) * tileH) / fullH],
          fullW / fullH,
          /* No recorte transparente a moldura não existe — ver `draw()` lá. */
          !transparent,
        );
        renderer.readRenderTargetPixels(read, 0, 0, tileW, tileH, src);
        flipInto(src, dst, tileW, tileH, !transparent);
        ctx.putImageData(new ImageData(dst, tileW, tileH), tx * tileW, ty * tileH);
        done++;
        onTile?.(done, total);
        if (done < total) await yieldFrame();
      }
    }
    return out;
  } catch (err: unknown) {
    /* Alocação recusada, contexto perdido, driver reclamando do tamanho: tudo
       chega aqui como "não deu", e quem chamou degrada. Uma exceção subindo
       daqui pularia o `finally` de captureViewport() e é o que não pode
       acontecer. */
    console.warn('[truck-studio] o mosaico de captura falhou', err);
    return null;
  } finally {
    renderer.setRenderTarget(prevTarget);
    rt?.dispose();
    /* ⚠️ **ANTES de `restoreIsolation()`, e a ordem não é estilo.** Os dois mexem
       em `.visible` e os dois restauram por LISTA PRÓPRIA — `isolateVehicle()`
       guarda os filhos diretos da cena que ELE escondeu, `lod.ts` guarda as
       malhas que ELE escondeu (ver POSSE POSITIVA no cabeçalho de lá). Hoje os
       conjuntos são disjuntos (um mexe acima do `RIG`, o outro dentro dele), mas
       soltar o mais interno primeiro é o que mantém a propriedade caso alguém
       amplie o alcance de qualquer um dos dois: o de fora nunca pode restaurar em
       cima de uma decisão do de dentro.
       Rodar isto aqui é barato mesmo quando não há nada a soltar: `releaseLod()`
       sai na primeira linha quando o contador de ocultas é zero. */
    releaseLod();
    restoreIsolation?.();
    scene.background = prevBackground;
    renderer.setClearAlpha(prevClearAlpha);
    /* NO `finally` como os outros três: uma exceção no meio do mosaico não pode
       deixar a vista do usuário com um mapa de sombra de 3072² que o perfil dele
       não pediu — seria a captura piorando permanentemente o desempenho da
       máquina que menos pode pagá-lo. */
    restoreShadow?.();
    /* E o floco volta ao pixel da TELA. Deixado para trás, ele faria a vista 3D
       escolher a oitava com o pixel de uma foto de 7680 — o mesmo defeito ao
       contrário, e permanente até o próximo recarregamento. */
    setPaintPixelScale(prevPxScale);
  }
}

/**
 * Renderiza a cena no preset pedido e devolve a imagem.
 *
 * BLOQUEANTE: o render acontece na thread principal e pode levar segundos no
 * preset alto. Quem chama tem de subir um indicador e deixar o navegador PINTÁ-LO
 * — dois quadros — antes de aguardar isto, senão o aviso só aparece depois de o
 * trabalho que ele anuncia ter acabado.
 *
 * O VIEWPORT NÃO SE MEXE. Nem durante, nem depois, nem depois de uma falha: a
 * câmera do estúdio não é tocada e o canvas visível não é escrito. O que o
 * usuário vê durante uma captura é a cena dele, parada, e o indicador de
 * progresso.
 */
export async function captureViewport(opts: CaptureOptions = {}): Promise<CaptureResult> {
  const aspect = viewportAspect();
  if (!Number.isFinite(aspect) || aspect <= 0) throw new Error('O viewport está sem tamanho.');

  let quality: CaptureQuality = opts.quality && CAPTURE_PRESETS[opts.quality]
    ? opts.quality : DEFAULT_QUALITY;
  let preset = CAPTURE_PRESETS[quality];
  let degraded: string | null = null;

  const background: CaptureBackground = opts.background === 'recorte' ? 'recorte' : 'cena';
  /* UM RECORTE É SEMPRE PNG. O preset Baixa é WebP com PERDAS a 0.92, e perda
     numa borda alfa produz franja — pixels meio-transparentes com cor de fundo
     grudada, que é exatamente o defeito que faz um recorte ser rejeitado. WebP
     sem perdas resolveria e custaria mais que o PNG nesta escala; PNG é o
     formato que quem recebe um recorte espera. Reescrito no `preset` local, e
     não em CAPTURE_PRESETS, que é constante compartilhada. */
  if (background === 'recorte' && preset.mime !== 'image/png') {
    preset = { ...preset, mime: 'image/png', ext: 'png', quality: undefined };
  }

  const edgeMax = edgeLimit();
  let { outW, outH } = outputSize(aspect, preset);

  /* O LIMITE DO DRIVER NÃO ENCOLHE MAIS A IMAGEM. Ele entra em `tiling()` como
     teto do LADRILHO, e uma placa mais fraca passa a pagar em número de
     ladrilhos em vez de em resolução — que é exatamente o que o ladrilhamento
     existe para permitir. Antes, um passe único acima do limite era reduzido e o
     usuário recebia 4000 px onde o menu prometia 7680. */
  const key = getKeyLight();
  /* .clone(), não uma referência: mapSize é um Vector2 vivo que estamos prestes
     a mutar no lugar, então guardar o objeto "salvaria" o valor novo. */
  const prevShadow = key.shadow.mapSize.clone();
  const wantShadow = Math.min(
    MAX_SHADOW,
    renderer.capabilities.maxTextureSize,
    /* Proporcional à nitidez ganha: quantas vezes a imagem é maior que a tela. */
    Math.round(prevShadow.x * Math.max(1, Math.max(outW, outH)
      / Math.max(1, Math.max(renderer.domElement.width, renderer.domElement.height)))),
  );
  const bumpShadow = (opts.sharpenShadows ?? preset.sharpenShadows) && wantShadow > prevShadow.x;

  stopLoop();
  try {
    /* o three dimensiona o mapa de sombra uma vez e guarda o alvo, então mudar
       mapSize sozinho não faz nada. Descartar e anular é a forma documentada de
       forçar a realocação no próximo render — e `needsUpdate` é o que autoriza
       esse render a acontecer, porque scene.ts roda com `autoUpdate = false`
       (ver o cabeçalho). UMA VEZ para os 16 ladrilhos: o three zera o
       `needsUpdate` no primeiro render, e os outros quinze reusam o mapa. */
    if (bumpShadow) {
      key.shadow.mapSize.set(wantShadow, wantShadow);
      key.shadow.map?.dispose();
      key.shadow.map = null;
      renderer.shadowMap.needsUpdate = true;
    }

    /* UM CAMINHO SÓ para os três presets — ver `tiling()`. */
    const mosaic = async (w: number, h: number, want: number) => {
      const t = tiling(w, h, want, edgeMax);
      outW = t.fullW;
      outH = t.fullH;
      return {
        tiles: t.nx * t.ny,
        canvas: await renderMosaic(
          captureCamera(t.fullW / t.fullH),
          t.fullW, t.fullH, t.nx, t.ny, t.tileW, t.tileH,
          background === 'recorte', opts.onTile,
        ),
      };
    };

    let { canvas, tiles } = await mosaic(outW, outH, preset.tiles);
    if (!canvas && quality !== 'medium') {
      /* O mosaico não coube — o canvas 2D de composição é o que falha primeiro
         (7680x4320 de RGBA são ~132 MB). Degradar para Média em vez de falhar: o
         usuário pediu uma imagem, e uma imagem menor é uma resposta; um erro não
         é. Só uma vez, e nunca de Média para Média. */
      quality = 'medium';
      /* Média já é PNG, então o reescrito do recorte não se perde aqui. */
      preset = CAPTURE_PRESETS.medium;
      const s = outputSize(aspect, preset);
      degraded = 'A resolução alta não coube nesta placa; a imagem saiu em '
        + s.outW + ' px.';
      ({ canvas, tiles } = await mosaic(s.outW, s.outH, preset.tiles));
    }
    if (!canvas) throw new Error('O navegador não conseguiu alocar a imagem.');

    let blob = await encode(canvas, preset.mime, preset.quality);
    /* WebP não é universal (Safari antigo). Um `toBlob` que devolve null por
       causa do MIME tem de virar PNG, não um erro — o usuário pediu a imagem
       rápida, e o formato é um detalhe de entrega. */
    if (!blob && preset.mime !== 'image/png') {
      blob = await encode(canvas, 'image/png');
      if (blob) degraded = (degraded ? degraded + ' ' : '') + 'WebP indisponível; saiu em PNG.';
    }
    if (!blob) throw new Error('O navegador não conseguiu codificar a imagem.');
    return { blob, width: outW, height: outH, quality, tiles, background, degraded };
  } finally {
    /* NÃO HÁ CÂMERA A RESTAURAR — é o ponto do módulo. O que volta é só o que é
       global: o mapa de sombra e o laço.
       `invalidateShadows()` em vez de escrever `needsUpdate` na mão porque ele
       também PEDE UM QUADRO: o laço de scene.ts é dirigido por sujeira, e sem o
       pedido o mapa de 3072 só seria realocado no próximo movimento do usuário —
       até lá a cena ficaria com a sombra da captura, que é mais fina mas custa
       uma realocação parada na memória. */
    if (bumpShadow) {
      key.shadow.mapSize.copy(prevShadow);
      key.shadow.map?.dispose();
      key.shadow.map = null;
      invalidateShadows();
    }
    /* Só retome se o estúdio ainda estiver na página. unmountStudio() para o
       laço e solta o `root`, e uma captura em voo através dessa troca de rota
       reiniciaria um laço que ninguém vê e ninguém vai parar. */
    if (root.isConnected) startLoop();
  }
}

/**
 * As dimensões que um preset PRODUZIRIA agora, sem renderizar nada.
 *
 * É o que faz o menu de qualidade mostrar "Alta · 7680 × 4320" em vez de só
 * "Alta": o número é o que torna a escolha informada. Mesma conta de
 * captureViewport(), pela mesma proporção — se estes dois divergirem, o menu
 * mente.
 */
export function previewSize(quality: CaptureQuality): { width: number; height: number } {
  const preset = CAPTURE_PRESETS[quality] || CAPTURE_PRESETS[DEFAULT_QUALITY];
  const { outW, outH } = outputSize(viewportAspect(), preset);
  const t = tiling(outW, outH, preset.tiles, edgeLimit());
  return { width: t.fullW, height: t.fullH };
}

/**
 * Quantos ladrilhos um preset renderizaria agora. É o que o menu usa para dizer
 * "16 ladrilhos" sem chutar — o número saía de `preset.tiles²`, que deixou de
 * ser a verdade quando o teto de MAX_TILE passou a poder aumentar a grade.
 */
export function previewTiles(quality: CaptureQuality): number {
  const preset = CAPTURE_PRESETS[quality] || CAPTURE_PRESETS[DEFAULT_QUALITY];
  const { outW, outH } = outputSize(viewportAspect(), preset);
  const t = tiling(outW, outH, preset.tiles, edgeLimit());
  return t.nx * t.ny;
}

/* ---------------- a MINIATURA de uma pose ----------------
   Quem consome: o criador de vídeo (`scene/timeline.ts` + `ui/timeline.ts`).
   Cada ponto da linha do tempo mostra O QUE A CÂMERA VIA ali — sem isso a tira
   é uma fileira de retângulos numerados, e escolher qual ponto ajustar vira
   tentativa e erro. É a diferença entre uma lista e um storyboard.

   ⚠️ ELA MORA AQUI, E NÃO NO CRIADOR, POR CAUSA DE TRÊS LINHAS. `makeTarget()`
   carrega o trio `colorSpace = SRGB` + `internalFormat = RGBA8` +
   `isXRRenderTarget` que este arquivo documenta ter descoberto MEDINDO — sem
   ele o resolve do multiamostrado falha com GL_INVALID_OPERATION e a leitura
   devolve zeros, ou seja **uma imagem toda preta, em silêncio**. Uma segunda
   implementação de "renderizar para fora da tela" nasceria com esse defeito e
   ninguém ligaria os pontos.

   ⚠️ E ELA NÃO TOCA A CÂMERA. A pose que ela retrata é a que a câmera JÁ TEM —
   é chamada no instante em que o usuário marca o ponto, então o enquadramento
   é exatamente o que ele está vendo. Daí também o tamanho: a altura sai da
   proporção VIVA da câmera, senão a miniatura sairia esticada em relação ao
   viewport que a produziu.

   O que ela deliberadamente NÃO faz, ao contrário de `captureViewport()`:
   não para o laço, não levanta o mapa de sombra, não reancora o floco metálico
   e não mexe no LOD. São ~200 px de aresta — as quatro coisas custariam duas
   realocações de alvo e um passe de sombra para um retrato do tamanho de uma
   unha, e as quatro voltariam a valer no quadro seguinte de qualquer forma. */

/** Aresta longa da miniatura, em pixels de buffer. */
const THUMB_EDGE = 224;

/**
 * Um retrato do que a câmera vê AGORA, como data URL.
 *
 * Síncrona (é um render e uma leitura de ~100 KB) e TOLERANTE: qualquer falha
 * — contexto perdido, alocação recusada, canvas 2D indisponível — devolve
 * `null`, e quem chamou segue sem miniatura. Um ponto sem retrato continua
 * sendo um ponto; uma exceção aqui derrubaria a marcação.
 */
export function poseThumbnail(edge = THUMB_EDGE): string | null {
  const aspect = camera.aspect > 0 && Number.isFinite(camera.aspect) ? camera.aspect : 16 / 9;
  /* PARES nos dois lados: nada aqui exige, mas um alvo ímpar já custou um
     defeito no gravador e o arredondamento é de graça. */
  const w = Math.max(2, Math.round(edge / 2) * 2);
  const h = Math.max(2, Math.round(w / aspect / 2) * 2);

  const prevTarget = renderer.getRenderTarget();
  let rt: THREE.WebGLRenderTarget | null = null;
  try {
    rt = makeTarget(w, h);
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    /* Desligar o alvo é o que RESOLVE o multiamostrado para a textura de uma
       amostra — a mesma armadilha do mosaico, algumas centenas de linhas acima. */
    renderer.setRenderTarget(null);
    /* A MINIATURA SAI FILTRADA, e é o certo: a tira de cartões é um storyboard
       do que o vídeo vai ser, não do que o renderizador entrega cru. São 224 px
       de aresta — o passe custa menos que a codificação WebP logo abaixo. */
    const graded = gradeTile(rt, w, h);
    const src = new Uint8Array(w * h * 4);
    renderer.readRenderTargetPixels(graded, 0, 0, w, h, src);
    const dst = new Uint8ClampedArray(w * h * 4);
    flipInto(src, dst, w, h, true);
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const ctx = out.getContext('2d', { alpha: false });
    if (!ctx) return null;
    ctx.putImageData(new ImageData(dst, w, h), 0, 0);
    /* WebP com perdas: são ~8 KB por ponto contra ~40 KB de PNG, e vinte e
       quatro deles ficam vivos em memória enquanto o percurso existir. O
       fallback não é decoração — um motor sem codificador WebP devolve um PNG
       com o mimetype trocado, e `toDataURL` não avisa: o teste do prefixo é a
       única forma de saber o que saiu. */
    const webp = out.toDataURL('image/webp', 0.72);
    return webp.startsWith('data:image/webp') ? webp : out.toDataURL('image/jpeg', 0.78);
  } catch (err: unknown) {
    console.warn('[truck-studio] a miniatura do ponto falhou', err);
    return null;
  } finally {
    renderer.setRenderTarget(prevTarget);
    rt?.dispose();
  }
}
