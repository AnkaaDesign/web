/* Livery editing, o núcleo: as TRÊS telas fabric independentes (lateral
   esquerda, direita, traseira), as CanvasTextures que elas alimentam pela
   LiveryUV (TEXCOORD_1) do baú, a foto do painel com a janela vazada, as guias
   de silhueta, as prévias dos cards e a escala real em centímetros.

   O que NÃO está aqui: o modelo de documento (fontes, desfazer, alinhamento,
   espelhamento) mora em ./livery-doc.ts, e a interface do editor (barra,
   inspetor, camadas, teclado, réguas) em ../ui/livery-editor.ts e
   ../ui/livery-guides.ts. Este módulo é a folha que os outros importam, e é o
   que impede que eles tenham de importar uns aos outros.
   studio.ts continua falando só com este arquivo. */
import * as THREE from 'three';
import * as fabric from 'fabric';
import { root, $, isMounted, evTarget } from '../core/dom';
import { VEHICLES_DIR } from '../core/paths';
import { assetUrl } from '../catalog/catalog';
import { invalidate } from '../scene/scene';
import { setPaintTarget } from './models';
import { setStatus } from '../ui/chrome';
import { initLiveryEditor } from '../ui/livery-editor';
/* A REPRESENTAÇÃO do painel — faixa refletiva, cantoneira e vãos de porta
   derivados das MEDIDAS do implemento. Ela é de ./livery-structure e desenha
   nos dois lugares em que o painel aparece DESENHADO: o palco do editor e a
   miniatura do card. Ela NÃO vira textura: essas peças já existem em geometria
   no baú (ver o cabeçalho daquele arquivo). Quem alimenta o 3D continua sendo
   exclusivamente a arte das telas fabric deste módulo — nada abaixo desta linha
   mudou de dono. */
import {
  refreshFromTrailer, mountStructureCanvas, mountFrontCanvas, drawStructureInto,
  drawFrontInto, onStructureRedrawn, setPanelDisplaySize,
} from './livery-structure';
import { hasLiveryArt, onLiveryArtReady } from './livery-art';

/* Reexportados para quem já falava com este módulo (studio.ts, o handle de
   depuração) não ter de saber que o editor mudou de arquivo. */
export { openEditor, closeEditor, showSurface } from '../ui/livery-editor';

/** The three paintable trailer panels. Every per-surface map is keyed by this. */
export type SurfaceKey = 'left' | 'right' | 'rear';

/** The subset of trailer_meta.json this module reads. */
export interface OutlineMeta {
  outlineSide?: number[][];
  outlineRear?: number[][];
}

/* ---------------- fabric canvases (live in the modal, always exist) -------- */
/* TRANSPARENTE por padrão, e não mais branco.
   O branco existia para imitar o painel do baú num retângulo vazio. Agora o
   painel de verdade está ali atrás — a foto da lateral e a das portas, POR BAIXO
   da tela, tanto no card quanto no editor (core/studio.css) — e um fundo branco
   opaco pintado por cima simplesmente a escondia.
   Consequência no 3D, que é a que importa: a tela vira textura do overlay
   (attachOverlays), então transparente = o baú aparece com o material dele
   mesmo. Era exatamente o que o branco produzia, só que agora sem uma camada de
   tinta branca por cima de tudo. O "Fundo" da barra continua podendo pintar a
   tela inteira de uma cor, e o "×" volta para cá. */
export const DEFAULT_BG = '';

/* ---------------- a tela de baixo é ARTE PURA ----------------
   `skipControlsDrawing` não é preferência de estilo: é a fronteira entre o
   EDITOR e a TEXTURA.

   O que acontecia sem ele: `StaticCanvas.renderCanvas()` (fabric 6.5.1) termina
   com `if (this.controlsAboveOverlay && !this.skipControlsDrawing)
   this.drawControls(ctx)` — e o `ctx` dessa chamada é o `contextContainer`, ou
   seja o **lowerCanvasEl**, que é exatamente o elemento de onde a
   `CanvasTexture` do baú lê. Resultado: a moldura de seleção e as oito alças de
   transformação do objeto ativo eram ASSADAS na textura e apareciam no
   implemento em 3D. Medido: com um retângulo selecionado, os pixels do
   lowerCanvasEl nos cantos da caixa vinham `(177,203,255,128)` — azul-claro
   translúcido do controle — em vez da arte.

   O upperCanvasEl existe justamente para isso e estava VAZIO. Então as alças
   passam a ser desenhadas lá (ver o laço de `after:render` mais abaixo), o
   editor continua idêntico aos olhos do usuário, e a textura vê só arte.
   `contextTopDirty` é o que faz o próprio fabric limpar a camada de cima no
   render seguinte — sem marcar, a alça velha ficaria como rastro. */
function makeFab(el: HTMLCanvasElement) {
  const c = new fabric.Canvas(el, { preserveObjectStacking: true, backgroundColor: DEFAULT_BG });
  (c as unknown as { skipControlsDrawing: boolean }).skipControlsDrawing = true;
  return c;
}
export const fabLeft = makeFab($<HTMLCanvasElement>('fabric-left'));
export const fabRight = makeFab($<HTMLCanvasElement>('fabric-right'));
export const fabRear = makeFab($<HTMLCanvasElement>('fabric-rear'));

export const surfaces: Record<SurfaceKey, fabric.Canvas> = { left: fabLeft, right: fabRight, rear: fabRear };
export const SURFACE_KEYS: SurfaceKey[] = ['left', 'right', 'rear'];
let activeSurface: SurfaceKey = 'left';
export const active = () => surfaces[activeSurface];
export const activeKey = () => activeSurface;
export const setActiveKey = (k: SurfaceKey) => { activeSurface = k; };

/** A outra lateral do baú — a traseira não tem par. */
export const otherSide = (key: SurfaceKey): SurfaceKey | null =>
  key === 'left' ? 'right' : key === 'right' ? 'left' : null;

export const CAPTIONS: Record<SurfaceKey, string> = {
  left: 'Lateral esquerda · pintura fica dentro da silhueta tracejada',
  right: 'Lateral direita · pintura fica dentro da silhueta tracejada',
  rear: 'Portas traseiras · pintura fica dentro da silhueta tracejada',
};

/* ---------------- escala real ----------------
   Semeada com uma medida plausível e SUBSTITUÍDA pela geometria de verdade em
   attachOverlays(), para que um baú diferente se corrija sozinho em vez de
   reportar centímetros errados calado.

   Os valores abaixo são SÓ a semente do primeiro quadro, antes de existir
   chapa recortada para medir. `measurePanel()` os reescreve com a chapa real. */
const PANEL_MM: Record<SurfaceKey, { w: number; h: number }> = {
  left: { w: 14655, h: 2777 },
  right: { w: 14655, h: 2777 },
  rear: { w: 2590, h: 2716 },
};

export const panelMM = (key: SurfaceKey) => PANEL_MM[key];

export function mmPerPx(key: SurfaceKey) {
  const c = surfaces[key], p = PANEL_MM[key];
  return { x: p.w / c.getWidth(), y: p.h / c.getHeight() };
}
/** A altura de letra segue o eixo vertical — por isso 'y' é o padrão. */
export const pxToCm = (px: number, key: SurfaceKey, axis: 'x' | 'y' = 'y') => px * mmPerPx(key)[axis] / 10;
export const cmToPx = (cm: number, key: SurfaceKey, axis: 'x' | 'y' = 'y') => cm * 10 / mmPerPx(key)[axis];

/* ---------------- a tela SEGUE a chapa ----------------
   O buffer da tela do fabric é dimensionado a partir da GEOMETRIA MEDIDA, com
   densidade constante em pixels por milímetro. Não é detalhe de performance: é
   a única coisa que mantém a arte em sincronia com o corpo branco.

   O QUE ESTAVA ERRADO. As telas nasciam com tamanho literal em
   core/template.ts (2048x344 nas laterais, 1024x1024 na traseira) e NADA
   redimensionava o buffer — a única chamada a `setDimensions()` usa
   `{ cssOnly: true }`, que muda a caixa na tela e não o backing store. Os
   2048x344 saíram de medir a FOTO `panels/lateral.png` (razão 5,9535), não a
   chapa: a chapa mede 14 655 x 2 777 mm, razão 5,2775. Como a arte é mapeada
   por `uv1` normalizada de 0 a 1, a diferença vira ANISOTROPIA — tudo que se
   desenhasse na lateral saía 12,8 % mais alto que largo no baú (4,9 % na
   traseira). Círculo virava elipse. E, como a chapa muda de razão a cada
   redimensionamento e a tela não mudava, a distorção ANDAVA com a medida: caía
   para ~7,9 % num baú de 20,58 m. A arte "desamassava" sozinha ao alongar.

   O QUE PASSA A VALER. `mm/px` é uma CONSTANTE do projeto, igual nos dois
   eixos e igual em qualquer medida. A tela é a chapa vezes a densidade, e só
   isso. Três consequências, todas desejadas:

   · a razão da tela bate com a razão da chapa em ~20 ppm (o resíduo é o
     arredondamento para pixel inteiro, e ele é atacado derivando a LARGURA da
     altura já arredondada — o erro relativo fica 0,5 / largura);
   · um logotipo de 400 mm continua com 400 mm depois de qualquer resize, sem
     reamostrar nada: mudar de medida só acrescenta ou tira pixels na borda, e
     as coordenadas de cada objeto do fabric continuam valendo;
   · `pxToCm` passa a dar o mesmo em 'x' e em 'y' — a régua em centímetros
     deixa de mentir 11,4 % na largura das letras.

   A densidade é o que a lateral de fábrica já usava (2048 px / 14 655 mm), para
   não degradar a resolução de quem já desenhou. O teto de 4096 px protege o
   limite de textura da GPU; se ele morder (baú acima de ~29 m, fora da faixa
   editável), a densidade cai e AÍ sim a arte é reescalada — uniformemente, por
   `rescaleObjects()`, que é uma reamostragem correta e não um `putImageData`
   de tamanhos diferentes. */

/** Pixels por MILÍMETRO de chapa, por face. Os dois valores são a densidade que
 *  cada tela já tinha na medida de fábrica — 2048 px na lateral de 14 655 mm e
 *  1024 px na traseira de 2 716 mm —, de modo que ninguém perca resolução na
 *  troca. Cada face tem a sua porque a traseira é 5x menor que a lateral: uma
 *  densidade só deixaria a traseira com 362 px de largura. */
const PX_PER_MM: Record<SurfaceKey, number> = {
  left: 2048 / 14655,
  right: 2048 / 14655,
  rear: 1024 / 2716,
};
/** Teto por eixo, para não estourar o limite de textura da GPU. */
const MAX_TEX_PX = 4096;
/** Piso, para a tela nunca ficar degenerada durante o boot. */
const MIN_TEX_PX = 64;

/**
 * O tamanho de buffer que uma chapa pede.
 *
 * Duas coisas acontecem aqui, e as duas importam:
 *
 * 1. A ARESTA CURTA sai da densidade; a LONGA sai da razão da chapa. Derivar a
 *    longa da razão, em vez de arredondar as duas independentemente, prende a
 *    razão da tela à razão da chapa dentro de meio pixel da aresta longa.
 * 2. Ainda assim meio pixel é ~200 ppm, então a aresta curta é PROCURADA numa
 *    janela de ±3 px: entre sete candidatos, o melhor costuma errar uma ordem
 *    de grandeza menos. A busca é determinística e o custo é sete divisões.
 */
function canvasFor(key: SurfaceKey, p: { w: number; h: number }) {
  const ar = p.w / Math.max(1e-6, p.h);
  /* Densidade nominal, rebaixada só se o teto de textura morder. */
  const d = Math.min(
    PX_PER_MM[key],
    MAX_TEX_PX / Math.max(1, p.w),
    MAX_TEX_PX / Math.max(1, p.h),
  );
  const wide = ar >= 1;
  const short0 = Math.round((wide ? p.h : p.w) * d);

  let best = { width: MIN_TEX_PX, height: MIN_TEX_PX }, bestErr = Infinity;
  for (let k = -3; k <= 3; k++) {
    const s = short0 + k;
    if (s < MIN_TEX_PX) continue;
    const long = Math.round(wide ? s * ar : s / ar);
    if (long < MIN_TEX_PX || long > MAX_TEX_PX) continue;
    const cand = wide ? { width: long, height: s } : { width: s, height: long };
    const err = Math.abs(cand.width / cand.height - ar) / ar;
    if (err < bestErr) { bestErr = err; best = cand; }
  }
  return best;
}

/** A chapa para a qual a tela CORRENTE foi dimensionada — as DUAS medidas.
 *  `measurePanel()` já reescreveu `PANEL_MM` quando `syncSurfaceAspect()` roda,
 *  e sem o par anterior não dá para converter a arte de pixel para milímetro.
 *  Guardar só a largura (como antes) cegava justamente o eixo que muda quando o
 *  usuário mexe na ALTURA — que é o caso relatado. */
const prevPanel: Record<SurfaceKey, { w: number; h: number }> = {
  left: { ...PANEL_MM.left }, right: { ...PANEL_MM.right }, rear: { ...PANEL_MM.rear },
};

/**
 * Leva a arte para a tela NOVA preservando MILÍMETRO e ÂNCORA REAIS.
 *
 * A arte do fabric é guardada em pixels de tela, e a tela muda de tamanho a
 * cada medida do baú. Duas coisas precisam sobreviver a essa troca, e nenhuma
 * das duas sobrevive sozinha:
 *
 * 1. O TAMANHO FÍSICO. Um logotipo de 400 mm continua com 400 mm. Como
 *    `canvasFor()` procura a aresta curta numa janela de ±3 px para casar a
 *    razão, a densidade oscila alguns décimos de por mil entre uma medida e
 *    outra; converter para milímetro e voltar absorve essa oscilação em vez de
 *    deixá-la virar um escalonamento cego (a versão anterior derivava o fator
 *    só da LARGURA e, numa mudança de altura pura, aplicava +0,59 % de escala
 *    do nada).
 *
 * 2. A ÂNCORA. O piso do baú é o datum físico: o teto sobe, o piso não sai do
 *    lugar (ver `mapZ`/`stretchY` em trailer-geometry.ts). Um adesivo colado a
 *    1 m do piso continua a 1 m do piso quando o baú fica mais alto. Mas
 *    `addLiveryUV()` faz `v = (max.y − y)/spanY`, ou seja **v = 0 é o TETO** —
 *    então a coordenada `top` do fabric é distância até o TETO, e mantê-la
 *    fazia a arte inteira SUBIR junto com o teto. Por isso o que se preserva
 *    aqui é a distância até a BORDA DE BAIXO da tela.
 */
interface Frame {
  /** tamanho do buffer da tela, em pixels */
  px: { w: number; h: number };
  /** chapa que essa tela representa, em milímetros */
  mm: { w: number; h: number };
}

function remapObjects(fab: fabric.Canvas, from: Frame, to: Frame) {
  const h1 = to.px.h;
  const ok = [from.px.w, from.px.h, from.mm.w, from.mm.h, to.px.w, to.px.h, to.mm.w, to.mm.h];
  if (ok.some((v) => !(v > 0))) return;
  /* px por mm, por eixo, antes e depois. A razão entre elas é TUDO o que a
     arte precisa saber sobre a troca de tela. */
  const sx = (to.px.w / to.mm.w) / (from.px.w / from.mm.w);
  const sy = (to.px.h / to.mm.h) / (from.px.h / from.mm.h);
  /* A escala do OBJETO é uniforme por decreto: `canvasFor()` mantém os dois
     eixos isotrópicos a partes por milhão, e usar dois fatores diferentes
     transformaria círculo em elipse ao primeiro resíduo de arredondamento. */
  const s = (sx + sy) / 2;
  const uniform = Math.abs(s - 1) > 1e-9;
  for (const o of fab.getObjects()) {
    const left = (o.left ?? 0) * sx;
    /* distância até o pé da tela, preservada */
    const fromBottom = from.px.h - (o.top ?? 0);
    const top = h1 - fromBottom * sy;
    o.set({ left, top });
    if (uniform) {
      o.set({ scaleX: (o.scaleX ?? 1) * s, scaleY: (o.scaleY ?? 1) * s });
      if (typeof o.strokeWidth === 'number') o.set({ strokeWidth: o.strokeWidth * s });
    }
    o.setCoords();
  }
}

/**
 * Põe o buffer da tela na proporção da chapa MEDIDA. Devolve `true` se mexeu.
 *
 * Chamada por `attachOverlays()`, que é o único portão por onde chapa nova
 * chega — no boot e a cada recorte de `models.setTrailerDims()`.
 */
export function syncSurfaceAspect(key: SurfaceKey): boolean {
  const fab = surfaces[key];
  const want = canvasFor(key, PANEL_MM[key]);
  const w0 = fab.getWidth(), h0 = fab.getHeight();
  if (w0 === want.width && h0 === want.height) return false;

  const before: Frame = { px: { w: w0, h: h0 }, mm: { ...prevPanel[key] } };
  const after: Frame = { px: { w: want.width, h: want.height }, mm: { ...PANEL_MM[key] } };
  prevPanel[key] = { ...PANEL_MM[key] };

  fab.setDimensions({ width: want.width, height: want.height });
  remapObjects(fab, before, after);

  /* ---- E A CAIXA NA TELA TEM DE SER REPOSTA ----
     `setDimensions()` sem `{ cssOnly: true }` escreve o tamanho do BUFFER
     também no `style` dos dois canvas — é o que o fabric faz, por contrato. O
     enquadramento que `sizeModalCanvas()` tinha calculado some junto, e o palco
     passa a mostrar a tela em PIXELS DE BUFFER.

     Medido no app, com o editor aberto, subindo de 2,78 m para 2,88 m: a tela
     ia de `1093 x 207,117 px` (o enquadramento certo) para `2064 x 406 px` — o
     tamanho cru do buffer. 1,89x mais larga e 1,96x mais alta que a janela do
     painel: a arte aparecia gigante e o pé dela caía muito abaixo da chapa. É
     exatamente o relato de "Sua marca fora e abaixo do painel, enorme" depois
     de mexer na altura. E não voltava sozinho: `sizeModalCanvas()` só roda ao
     abrir o editor, ao redimensionar a janela e ao mudar o zoom — nenhum desses
     acontece ao digitar uma medida.

     Então o enquadramento é REFEITO aqui, com o mesmo zoom que estava valendo.
     `sizeModalCanvas()` sai sozinha quando o modal ainda não tem layout, o que
     cobre o boot e o caso do editor fechado. */
  sizeModalCanvas(key, zoomOf(key));

  /* ---- E A TEXTURA TEM DE SER REALOCADA, NÃO SÓ REENVIADA ----
     Este é o defeito que fazia a arte simplesmente NÃO CHEGAR ao baú depois de
     qualquer mudança de medida, e ele é invisível em qualquer leitura de
     código JavaScript porque acontece dentro do WebGL.

     O three.js aloca a textura com `texStorage2D`, que é armazenamento
     IMUTÁVEL: o tamanho é fixado na PRIMEIRA subida e todas as seguintes são
     `texSubImage2D` dentro daquele retângulo. Trocar o buffer da tela (que é o
     que a linha acima faz, porque a chapa mudou de proporção) deixa a fonte
     maior que o destino, e o driver recusa a cópia. Medido no Chrome, ao subir
     o baú de 2,777 m para 3,519 m — a tela vai de 2037x386 para 2049x492:

         GL_INVALID_VALUE: glCopySubTextureCHROMIUM:
                           Offset overflows texture dimensions.        (x3)

     Três erros, um por face. O three não consulta `getError()`, então nada
     estoura: `needsUpdate` continua sendo aceito, `texture.version` continua
     subindo, e a GPU continua exibindo para sempre o ÚLTIMO conteúdo que coube
     — no caso, a tela em branco de antes de o usuário desenhar. Daí o sintoma
     relatado: "o livery não está sendo aplicado no modelo 3D".

     `dispose()` derruba o objeto de GPU (o three ouve o evento e apaga o
     `__version` da textura), então a subida seguinte volta a passar pelo
     caminho de ALOCAÇÃO e refaz o `texStorage2D` no tamanho novo. É a única
     operação que reabre esse caminho; nem `needsUpdate`, nem
     `source.needsUpdate`, nem trocar `image` fazem isso. */
  textures[key].dispose();

  fab.requestRenderAll();
  markDirty(key);
  return true;
}

/** Quanto a razão da tela se afasta da razão da chapa. Só arredondamento de
 *  pixel deve aparecer aqui — é o número que a verificação numérica lê. */
export function aspectError(key: SurfaceKey): number {
  const p = PANEL_MM[key], c = surfaces[key];
  const panel = p.w / p.h, canvas = c.getWidth() / c.getHeight();
  return Math.abs(canvas - panel) / panel;
}

/* u corre no Z nas laterais e no X na traseira; v sempre no Y.
   Espelha addLiveryUV() em ./models.ts — se aquilo mudar, isto muda junto.

   Mede a chapa INTEIRA, que é o que `addLiveryUV` normaliza: `uv1` vai de 0 a 1
   sobre os limites da própria chapa, saia e arremate de topo inclusos. Medir só
   a área frisada faria a régua bater e a arte sair deslocada. */
function measurePanel(mesh: THREE.Mesh, key: SurfaceKey) {
  const g = mesh.geometry;
  if (!g.boundingBox) g.computeBoundingBox();
  const size = (g.boundingBox as THREE.Box3).getSize(new THREE.Vector3());
  mesh.updateWorldMatrix(true, false);
  const s = mesh.getWorldScale(new THREE.Vector3());
  const w = key === 'rear' ? size.x * s.x : size.z * s.z;
  const h = size.y * s.y;
  if (w > 0.05 && h > 0.05) PANEL_MM[key] = { w: Math.round(w * 1000), h: Math.round(h * 1000) };
}

/* ---------------- textures ---------------- */
function makeTex(el: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(el);
  t.flipY = false;                      // matches glTF-exported LiveryUV orientation
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
export const texLeft = makeTex(fabLeft.lowerCanvasEl);
export const texRight = makeTex(fabRight.lowerCanvasEl);
export const texRear = makeTex(fabRear.lowerCanvasEl);
const textures: Record<SurfaceKey, THREE.CanvasTexture> = { left: texLeft, right: texRight, rear: texRear };

/* ---------------- 3D overlays ----------------
   Não há registro dos overlays criados. Havia um `liveryMeshes` colecionando os
   três arrays e NADA nunca o leu: um índice que só é escrito é uma referência
   que segura geometria depois de a carreta ter sido trocada. A textura já é
   compartilhada e viva, e o descarte vem junto com o descarte do baú. */

/* NO polygonOffset. It was here to win the depth test against the panel this
   overlay sits on, and it is not needed for that: the overlay SHARES the panel's
   geometry and is drawn later (renderOrder 2, and the transparent pass runs after
   the opaque one), so at equal depth three's default LessEqualDepth already lets
   it through.
 *
 * What the bias did instead was leak. `polygonOffsetFactor: -1` is SLOPE-SCALED:
 * the steeper the surface runs away from the camera, the further forward the
 * fragment is pushed. Sighting along the flank — which is the whole point of a
 * 15 m trailer — that slope is enormous, and the overlay was being pulled far
 * enough forward to pass the depth test IN FRONT OF THE PERIMETER RAIL that runs
 * along its bottom edge. The rail then read as a wide band of body colour that
 * snapped back to metal when the camera moved a few degrees.
 *
 * Kennedy's own observation is what identifies it, and it is decisive: the defect
 * is there in WHITE and gone when the implement is PAINTED. Painting changes two
 * things, and only one of them touches this overlay — `setBackgroundsForPaint()`
 * clears the canvas background to transparent, so the overlay stops covering
 * anything. The bias was still there; there was simply nothing left to draw with
 * it. Everything else about the two states is identical. */
function makeLiveryOverlay(mesh: THREE.Mesh, texture: THREE.CanvasTexture) {
  texture.channel = 1;
  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    metalness: 0.1,
    roughness: 0.55,
  });
  if (mat.map) mat.map.channel = 1;
  const overlay = new THREE.Mesh(mesh.geometry, mat);
  overlay.renderOrder = 2;
  mesh.add(overlay);
  overlay.position.set(0, 0, 0);
  return overlay;
}

export function attachOverlays(trailerRoot: THREE.Object3D) {
  const byName: Record<string, SurfaceKey> = { SIDE_L: 'left', SIDE_R: 'right', REAR: 'rear' };
  trailerRoot.traverse(node => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    const key = byName[o.name];
    if (!key) return;
    makeLiveryOverlay(o, textures[key]);
    measurePanel(o, key);          // a régua em cm sai daqui, não de um número escrito à mão
    /* E a TELA segue a chapa que acabou de ser medida. Sem esta linha o buffer
       ficaria no tamanho literal de core/template.ts e a arte sairia esticada
       na razão entre as duas proporções — ver a nota em `canvasFor()`. */
    syncSurfaceAspect(key);
    /* E a silhueta segue o METAL que corre por cima da chapa, remedido agora:
       a cantoneira acompanha o teto e o friso fica no piso, então a faixa
       pintável muda de fração a cada altura. Ver `measurePaintable()`. */
    measurePaintable(trailerRoot, o, key);
  });
  /* As duas superfícies que mostram a janela do painel dependem da faixa
     medida (é ela que diz onde a tela se encaixa na foto), então a publicação
     é refeita aqui — no boot a foto ainda pode não ter chegado, e aí
     `measurePanelWindows()` publica quando chegar. */
  for (const k of SURFACE_KEYS) {
    const win = windows[k];
    if (win) publishWindow(k, win);
    installGuide(k);
    drawPreview(k);
  }
  /* AS MEDIDAS REANCORAM PELO MESMO PORTÃO, e isso é deliberado:
     attachOverlays() é chamada nos DOIS momentos em que existem chapas novas —
     no boot e a cada recorte de `models.setTrailerDims()` (ver o gancho
     onTrailerPanelsRebuilt em studio.ts). É por aqui que a altura ajustada ao
     número inteiro de frisos volta para os campos do editor e a representação
     do painel é recomposta. Nenhuma malha nova é criada: a representação é 2D,
     e o 3D continua recebendo só a arte, pelas sobreposições acima. */
  refreshFromTrailer();
}

/* ---------------- quando a textura precisa subir para a GPU ----------------
   As alças de seleção e o laço de marquee são desenhados no upperCanvasEl, que
   NÃO é a fonte da textura — então trocar a seleção não exige upload nenhum.
   Condicionar needsUpdate a uma revisão de CONTEÚDO, em vez de a cada
   after:render, é o que impede o watchdog de 4 s de reenviar ~11 MB de textura
   para sempre com o estúdio parado. */
const rev: Record<SurfaceKey, number> = { left: 0, right: 0, rear: 0 };
const uploaded: Record<SurfaceKey, number> = { left: -1, right: -1, rear: -1 };

export function markDirty(key: SurfaceKey) { rev[key]++; }
export function markAllDirty() { for (const k of SURFACE_KEYS) rev[k]++; }

/* Os eventos transitórios entram para o 3D acompanhar o arrasto ao vivo —
   object:modified sozinho só dispara quando o gesto termina. */
const DIRTY_EVENTS = [
  'object:added', 'object:removed', 'object:modified',
  'object:moving', 'object:scaling', 'object:rotating', 'object:skewing',
  'text:changed', 'text:editing:exited',
] as const;

/* ---------------- panel outline guides ---------------- */
const FALLBACK_OUTLINE = [[0.015, 0.015], [0.985, 0.015], [0.985, 0.985], [0.015, 0.985]];
const outlines: Record<SurfaceKey, number[][]> =
  { left: FALLBACK_OUTLINE, right: FALLBACK_OUTLINE, rear: FALLBACK_OUTLINE };

/* ---------------- ONDE A CHAPA BRANCA REALMENTE APARECE ----------------
   A silhueta tracejada é a promessa que o editor faz ao cliente: "pinte aqui e
   sai assim no baú". Ela vinha de `trailer_meta.json`, e lá `outlineSide` é o
   QUADRADO UNITÁRIO — ou seja, a promessa era "o painel inteiro", quando o
   painel inteiro não é pintável.

   O que o recorte de `buildLiveryPanels()` entrega vai do PISO ao TETO, saia e
   arremate inclusos, porque é a chapa inteira que a `LiveryUV` normaliza. Mas
   sobre essa chapa correm perfis que NÃO são chapa: o friso de proteção
   lateral em baixo e a cantoneira galvanizada em cima. Arte colocada ali fica
   escondida atrás de metal — que é exatamente o relato: no editor o texto
   encosta na estrutura com folga, no implemento ele sai CORTADO.

   Então isto é MEDIDO no próprio implemento, a cada recorte, em vez de escrito
   à mão: números fixos valeriam para um `trailer.glb` só, e há mais de um bake
   em circulação (o do desktop tem 37 primitivas, o do web 2157). O critério é
   geométrico e não depende de nome de nó nem de material:

     · a peça tem de ALCANÇAR a face externa da chapa (`SKIN_REACH` de folga
       para trás, `SKIN_OUT` para a frente), que é o que separa um perfil
       aparafusado por fora de qualquer coisa que passe pelo interior do baú.
       Este critério já esteve escrito como "atravessar o plano MÉDIO do painel
       dentro de 60 mm", e não é a mesma coisa: o painel é uma casca de 11 mm,
       então 60 mm em torno do meio dele varrem o interior do baú. Ver
       `SKIN_REACH`;
     · e tem de ser CORRIDA — cobrir pelo menos `RAIL_SPAN` do comprimento do
       painel, que é o que descarta lanterna, dobradiça, rebite e trava, peças
       que ocupam um ponto e não uma faixa.

   O que sobra são as faixas em Y ocupadas por perfil. A área pintável é o
   MAIOR VÃO LIVRE entre elas — não "o painel menos uma margem fixa", porque a
   margem não é fixa: ela muda com a altura pedida (a cantoneira acompanha o
   teto, o friso fica no piso), e é justamente por isso que o defeito só
   apareceu depois de o usuário mexer na altura. */

/**
 * Quanto uma peça pode ficar ATRÁS da face externa da chapa e ainda contar como
 * perfil por cima dela. **20 mm.**
 *
 * Era 0,06 m — mas medidos a partir do PLANO MÉDIO do painel, e o painel é uma
 * casca de 11 mm (o relevo do friso). Ou seja: a janela de aceitação entrava
 * 60 mm PARA DENTRO DO BAÚ, e lá dentro há estrutura corrida. Medido no
 * `trailer.glb`, três peças eram lidas como perfil sem tocar a pele:
 *
 *   lateral-proteco-piso-02        x 1,135…1,240   64 mm atrás da crista
 *   stitch…metal-galvanizado-polido_0_13   x 1,235…1,238   66 mm atrás
 *   stitch…metal-galvanizado-polido_0_14   x 1,235…1,238   66 mm atrás
 *
 * As duas últimas ocupavam as faixas 295–445 mm e 1347–1497 mm do painel, e
 * partiam a área livre em três pedaços: o maior sobrava com 38,6 % da altura.
 * É o "adicionei uma porta e o painel ficou tomado pelo véu cinza" — e a porta
 * não tinha nada a ver com isso, ela só foi o momento em que se olhou.
 *
 * O teste agora é contra a FACE EXTERNA da chapa e só admite peça que CHEGUE
 * nela: um perfil aparafusado por fora passa, uma longarina interna não. Com a
 * correção sobram as duas faixas legítimas — o friso da saia (0–127 mm) e a
 * cantoneira (2569–2777 mm) — e 87,9 % de área pintável.
 */
const SKIN_REACH = 0.02;
/** E quanto ela pode se afastar para FORA e ainda ser perfil do painel. */
const SKIN_OUT = 0.20;
/** Fração do comprimento do painel que uma peça tem de cobrir para ser perfil. */
const RAIL_SPAN = 0.5;
/** Um vão menor que isto não é área de arte; é fresta entre ferragens. */
const MIN_BAND = 0.15;

/** Faixa pintável medida, em fração do painel a partir do PÉ. `null` = não deu
 *  para medir e vale o que veio do manifesto. */
const measured: Partial<Record<SurfaceKey, [number, number]>> = {};

function measurePaintable(trailerRoot: THREE.Object3D, panel: THREE.Mesh, key: SurfaceKey) {
  const g = panel.geometry;
  if (!g.boundingBox) g.computeBoundingBox();
  const pb = g.boundingBox as THREE.Box3;
  const spanY = pb.max.y - pb.min.y;
  if (!(spanY > 0.2)) return;

  const rear = key === 'rear';
  /* Eixo NORMAL à chapa e eixo em que ela CORRE. */
  const n: 'x' | 'z' = rear ? 'z' : 'x';
  const r: 'x' | 'z' = rear ? 'x' : 'z';
  /* A FACE EXTERNA da chapa, e o sentido de "para fora".
     Não é convenção nova: é a MESMA regra que recortou o painel em
     `buildLiveryPanels()` — SIDE_R sai do maior x, SIDE_L do menor, REAR do
     menor z. Usar o plano MÉDIO aqui, como esta função fazia, apagava a
     distinção entre "perfil aparafusado na pele" e "estrutura por dentro". */
  const dir = key === 'right' ? 1 : -1;
  const face = dir > 0 ? pb.max[n] : pb.min[n];
  const lo = pb.min[r], hi = pb.max[r];
  const runLen = hi - lo;
  if (!(runLen > 0.5)) return;

  /* Caixa de cada candidato no espaço do IMPLEMENTO, que é onde as chapas
     recortadas vivem. `applyMatrix4` sobre a caixa local é exato enquanto os
     nós não giram (é o caso deste bake: só escala e translação), e errar para
     mais aqui só encolheria a área pintável — por isso a peça ainda precisa
     passar nos dois testes acima para contar. */
  trailerRoot.updateWorldMatrix(true, true);
  const toLocal = trailerRoot.matrixWorld.clone().invert();
  const box = new THREE.Box3();
  const m = new THREE.Matrix4();
  const bands: [number, number][] = [];
  /* Quem produziu cada faixa. É diagnóstico e não enfeite: a área NÃO pintável
     é desenhada como um véu escuro sobre o painel (ver `guideMarkup`), e quando
     ele sai maior do que deveria — a queixa "o que é essa parte cinza" — não há
     como saber por qual peça sem isto. Uma caixa é uma CAIXA: uma malha só que
     agrupe peças espalhadas ocupa a faixa das duas, e é assim que um véu de
     meio painel nasce de uma ferragem de 5 cm. */
  const blame: string[] = [];

  trailerRoot.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.visible || !o.geometry) return;
    if (o === panel || /^(SIDE_L|SIDE_R|REAR)$/.test(o.name)) return;
    /* E as SOBREPOSIÇÕES DE ARTE, que são filhas das chapas e compartilham a
       geometria delas. Sem esta linha a primeira candidata é a própria arte —
       caixa idêntica à do painel, cobertura 100 % — e a medição conclui que
       não existe faixa livre nenhuma. Foi o que aconteceu na primeira
       execução: `outlineFrame` voltou o painel inteiro, que é justamente a
       promessa errada que esta função existe para desfazer. */
    if (o.parent && /^(SIDE_L|SIDE_R|REAR)$/.test(o.parent.name)) return;
    /* O branco é a própria chapa (e o corpo paramétrico atrás dela): não é
       obstáculo, é o que se está pintando. */
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((mm) => !!mm && /cor_padrao_branco|metalbranco/i.test(mm.name || ''))) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const gb = o.geometry.boundingBox;
    if (!gb) return;
    box.copy(gb).applyMatrix4(m.multiplyMatrices(toLocal, o.matrixWorld));
    if (box.isEmpty()) return;
    /* Alcança a pele por fora? `reach` é o ponto mais externo da peça e `back`
       o mais interno; a peça conta se o externo chega à face (com 20 mm de
       folga para trás) e o interno não está a mais de 20 cm para fora dela. */
    const reach = dir > 0 ? box.max[n] : box.min[n];
    const back = dir > 0 ? box.min[n] : box.max[n];
    if (dir * (reach - face) < -SKIN_REACH) return;
    if (dir * (back - face) > SKIN_OUT) return;
    const cover = Math.min(box.max[r], hi) - Math.max(box.min[r], lo);
    if (cover < runLen * RAIL_SPAN) return;
    const y0 = Math.max(box.min.y, pb.min.y), y1 = Math.min(box.max.y, pb.max.y);
    if (y1 > y0) {
      bands.push([y0, y1]);
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      blame.push(`${o.name || '(sem nome)'} [${mat?.name || '?'}] `
        + `${((y0 - pb.min.y) * 1000).toFixed(0)}–${((y1 - pb.min.y) * 1000).toFixed(0)} mm`);
    }
  });

  /* O maior vão LIVRE entre as faixas ocupadas. */
  bands.sort((a, b) => a[0] - b[0]);
  let cursor = pb.min.y, bestLo = pb.min.y, bestHi = pb.max.y, best = -1;
  const consider = (a: number, b: number) => { if (b - a > best) { best = b - a; bestLo = a; bestHi = b; } };
  for (const [a, b] of bands) {
    if (a > cursor) consider(cursor, a);
    if (b > cursor) cursor = b;
  }
  consider(cursor, pb.max.y);
  if (best < MIN_BAND) return;                     // medida implausível: não mente

  const v0 = (bestLo - pb.min.y) / spanY, v1 = (bestHi - pb.min.y) / spanY;
  measured[key] = [v0, v1];
  outlines[key] = [[0, v0], [1, v0], [1, v1], [0, v1]];

  /* Só reclama quando o véu come mais de um terço do painel. As duas faixas
     legítimas — o friso da saia e a cantoneira de topo — somam ~340 mm de
     2,78 m, ou seja 12 %; acima de 33 % é quase certo que uma caixa de malha
     agrupada está sendo lida como perfil corrido, e aí o número interessa. */
  if (v1 - v0 < 0.67) {
    console.warn(`[livery] painel ${key}: só ${((v1 - v0) * 100).toFixed(0)} %`
      + ` é pintável (de ${(v0 * 100).toFixed(0)} % a ${(v1 * 100).toFixed(0)} %`
      + ' da altura). Peças lidas como perfil corrido:', blame.join(' · '));
  }
}

function guideMarkup(poly: number[][], w: number, h: number) {
  const pts = poly.map(([u, v]) => [u * w, (1 - v) * h]);
  const path = 'M ' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L ') + ' Z';
  const sw = Math.max(2, w / 480);
  return `
    <path d="M0 0 H${w} V${h} H0 Z ${path}" fill="rgba(8,10,16,.5)" fill-rule="evenodd"/>
    <path d="${path}" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="${sw}"
      stroke-dasharray="${sw * 4} ${sw * 3}" vector-effect="non-scaling-stroke"/>`;
}

function installGuide(key: SurfaceKey) {
  const fab = surfaces[key];
  const w = fab.getWidth(), h = fab.getHeight();
  const wrap = fab.wrapperEl;
  /* A estrutura entra como PRIMEIRO filho do wrapper e a guia como ÚLTIMO: o
     fabric não usa z-index nos dois canvas dele, então a ordem de documento é a
     ordem de empilhamento. Chapa estrutural → arte do fabric → silhueta. */
  mountStructureCanvas(key, wrap);
  /* COM QUANTOS PIXELS o painel está na tela — é o que faz a pilha estrutural
     recompor na resolução do zoom em vez de numa constante. `installGuide()` é o
     lugar certo porque ele já roda em toda mudança de escala do palco (é ele que
     redimensiona a silhueta), então não há um segundo gancho a manter em dia.
     `getWidth()` é o tamanho em CSS; a densidade de tela quem aplica é
     `setPanelDisplaySize`. Ver RESOLUÇÃO SOB DEMANDA em ./livery-structure.ts. */
  setPanelDisplaySize(key, w);
  let svg = wrap.querySelector('.guide-svg');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('guide-svg');
    wrap.appendChild(svg);
  }
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.innerHTML = guideMarkup(outlines[key], w, h);
  /* A FERRAGEM, por cima da arte e por baixo da silhueta. Depois da `.guide-svg`
     existir, para entrar imediatamente antes dela — ver mountFrontCanvas(). É
     esta camada que substitui o que a foto do painel fazia: a cantoneira, a
     fita, os montantes e os varões passando SOBRE o desenho do cliente. */
  mountFrontCanvas(key, wrap);
}

/* A silhueta em pixels da tela. Alinhar "ao painel" e o encaixe das guias
   querem a área pintável, não o retângulo cru da tela. */
export function outlineFrame(key: SurfaceKey) {
  const c = surfaces[key], w = c.getWidth(), h = c.getHeight();
  const xs = outlines[key].map(([u]) => u * w);
  const ys = outlines[key].map(([, v]) => (1 - v) * h);
  const l = Math.min(...xs), t = Math.min(...ys);
  return { left: l, top: t, width: Math.max(...xs) - l, height: Math.max(...ys) - t };
}

/* A MEDIDA GANHA DO MANIFESTO, e isto é regra e não preferência: o
   `trailer_meta.json` traz o quadrado unitário nas duas faces, que é a única
   silhueta garantidamente errada — ela promete o painel inteiro. Enquanto
   `measurePaintable()` tiver um número para a face, o manifesto só serve de
   degradação para quando não houver chapa recortada para medir. */
export function setOutlines(meta: OutlineMeta | null) {
  if (!measured.left && meta && Array.isArray(meta.outlineSide) && meta.outlineSide.length >= 3) {
    outlines.left = meta.outlineSide;
    outlines.right = meta.outlineSide;
  }
  if (!measured.rear && meta && Array.isArray(meta.outlineRear) && meta.outlineRear.length >= 3) {
    outlines.rear = meta.outlineRear;
  }
  for (const k of SURFACE_KEYS) { installGuide(k); drawPreview(k); }
}

/* ---------------- sidebar previews ---------------- */
const prevEls: Record<SurfaceKey, HTMLCanvasElement> = {
  left: $<HTMLCanvasElement>('prev-left'),
  right: $<HTMLCanvasElement>('prev-right'),
  rear: $<HTMLCanvasElement>('prev-rear'),
};
const prevPending: Record<SurfaceKey, boolean> = { left: false, right: false, rear: false };

export function drawPreview(key: SurfaceKey) {
  const pc = prevEls[key];
  const ctx = pc?.getContext('2d');
  if (!pc || !ctx) return;
  const src = surfaces[key].lowerCanvasEl;
  ctx.clearRect(0, 0, pc.width, pc.height);
  /* Representação primeiro, arte por cima — a mesma ordem de documento do
     palco. O card e o editor mostram a mesma pilha, e é essa igualdade que faz
     a miniatura ser uma promessa honesta do que o editor abre. */
  drawStructureInto(ctx, key, pc.width, pc.height);
  ctx.drawImage(src, 0, 0, pc.width, pc.height);
  /* E a FERRAGEM por cima da arte, como no palco. Sem esta linha a miniatura
     mostraria a arte sangrando até a borda da chapa enquanto o editor a mostra
     cortada pela cantoneira — e a miniatura deixaria de ser uma promessa
     honesta do que o editor abre, que é a única coisa que ela precisa ser. */
  drawFrontInto(ctx, key, pc.width, pc.height);
  const poly = outlines[key];
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  poly.forEach(([u, v]: number[], i: number) => {
    const x = u * pc.width, y = (1 - v) * pc.height;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function schedulePreview(key: SurfaceKey) {
  if (prevPending[key]) return;
  prevPending[key] = true;
  requestAnimationFrame(() => { prevPending[key] = false; drawPreview(key); });
}

/* As alças que `skipControlsDrawing` tirou da tela de baixo entram aqui, na de
   CIMA — que é a camada de interação do fabric e não alimenta textura nenhuma.
   O usuário continua vendo moldura e alças exatamente como antes; o baú deixa
   de vê-las. `contextTopDirty` é o sinal que faz o próprio `renderAll()` limpar
   essa camada no quadro seguinte, senão a alça anterior fica como rastro. */
function paintControlsOnTop(c: fabric.Canvas) {
  const top = c.contextTop;
  if (!top) return;
  const dirty = c as unknown as { contextTopDirty: boolean };
  c.clearContext(top);
  if (!c.getActiveObject()) { dirty.contextTopDirty = false; return; }
  c.drawControls(top);
  dirty.contextTopDirty = true;
}

for (const k of SURFACE_KEYS) {
  const c = surfaces[k];
  for (const ev of DIRTY_EVENTS) c.on(ev, () => markDirty(k));
  c.on('after:render', () => {
    paintControlsOnTop(c);
    if (uploaded[k] === rev[k]) return;
    uploaded[k] = rev[k];
    textures[k].needsUpdate = true;
    /* Sem isto, desenhar no baú NÃO chega ao 3D. O laço de scene/scene.ts é sob
       demanda, e o fabric dispara este evento a partir dos próprios handlers de
       ponteiro e do próprio rAF dele — nada que o laço observe. `needsUpdate`
       sozinho só deixa a textura pronta para um quadro que ninguém pediu.
       Três quadros e não um: o upload pode aterrissar no seguinte. */
    invalidate(3);
    schedulePreview(k);
  });
}

/* ---------------- a foto do painel, e a janela dentro dela ----------------
   Cada superfície tem uma FOTO do painel real com o painel VAZADO: a lataria,
   os frisos, as dobradiças e a borracha central das portas são opacos, e onde
   entra tinta é transparente. A tela do fabric é montada exatamente sobre esse
   vazio e por BAIXO da foto — é isso que faz um texto atravessado pela borracha
   aparecer cortado no editor do mesmo jeito que vai sair no baú.

   Onde fica o vazio é MEDIDO na própria imagem, não escrito à mão: as fotos são
   reexportadas (as duas mudaram no meio desta sessão), e um retângulo fixo no
   código estaria errado no dia seguinte sem avisar ninguém.

   Como se mede, e por que não é só a caixa dos pixels transparentes: o fundo em
   volta do caminhão também é transparente, e ele encosta na borda da imagem. O
   que caracteriza a JANELA é ser transparente e estar CERCADA — então uma linha
   só conta se o trecho vazio dela tiver pixel opaco dos dois lados, a mesma
   regra vale por coluna, e a janela é a interseção das duas. O fundo cai fora
   por tocar a borda; a folga entre as lanternas do teto cai fora por não ser
   cercada na vertical. */
interface PanelWindow {
  /** proporção da FOTO inteira (largura/altura) */
  photoAr: number;
  /** posição e tamanho da janela, em fração da foto */
  x: number; y: number; w: number; h: number;
}

/* `assetUrl()` e não o caminho cru: os arquivos do estúdio moram na API, sob
   `STUDIO_BASE`, e `core/paths.ts` só entrega o pedaço relativo. Um
   `VEHICLES_DIR + 'panels/lateral.png'` resolveria contra a origem do WEB, que
   não tem mais os arquivos — e o sintoma seria um 404 mudo, porque as duas
   coisas que consomem isto (o `url()` da variável CSS e o `new Image()` da
   medição) degradam em silêncio.
   `assetUrl()` é idempotente por contrato, então resolver AQUI, uma vez, basta. */
const PANEL_IMAGE: Record<SurfaceKey, string> = {
  left: assetUrl(VEHICLES_DIR + 'panels/lateral.png'),
  right: assetUrl(VEHICLES_DIR + 'panels/lateral.png'),
  rear: assetUrl(VEHICLES_DIR + 'panels/traseira.png'),
};

/* Sem medida ainda (ou foto sem janela): a tela ocupa a caixa inteira e a foto
   volta a ficar ATRÁS dela — ver .ts-pw-ready em core/studio.css. Um fallback
   que deixasse a foto opaca por cima esconderia o desenho inteiro. */
const windows: Partial<Record<SurfaceKey, PanelWindow>> = {};

/** alpha até aqui conta como vazado — margem para o antialias da borda */
const CLEAR_A = 8;

function findWindow(img: HTMLImageElement): PanelWindow | null {
  const W = img.naturalWidth, H = img.naturalHeight;
  if (!W || !H) return null;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  let data: Uint8ClampedArray;
  try { data = ctx.getImageData(0, 0, W, H).data; }
  catch { return null; }                       // canvas de outra origem

  const clear = (px: number, py: number) => data[(py * W + px) * 4 + 3] <= CLEAR_A;
  /* Trechos curtos são frestas entre ferragens, não painel. 2% de cada eixo. */
  const minRunX = Math.max(4, Math.round(W * 0.02));
  const minRunY = Math.max(4, Math.round(H * 0.02));
  const hIn = new Uint8Array(W * H), vIn = new Uint8Array(W * H);

  for (let y = 0; y < H; y++) {
    let s = -1;
    for (let px = 0; px <= W; px++) {
      const isClear = px < W && clear(px, y);
      if (isClear) { if (s < 0) s = px; continue; }
      if (s < 0) continue;
      const e = px - 1;
      if (s > 0 && e < W - 1 && e - s + 1 >= minRunX) {
        for (let i = s; i <= e; i++) hIn[y * W + i] = 1;
      }
      s = -1;
    }
  }
  for (let px = 0; px < W; px++) {
    let s = -1;
    for (let y = 0; y <= H; y++) {
      const isClear = y < H && clear(px, y);
      if (isClear) { if (s < 0) s = y; continue; }
      if (s < 0) continue;
      const e = y - 1;
      if (s > 0 && e < H - 1 && e - s + 1 >= minRunY) {
        for (let i = s; i <= e; i++) vIn[i * W + px] = 1;
      }
      s = -1;
    }
  }

  let minX = W, maxX = -1, minY = H, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let px = 0; px < W; px++) {
      if (!hIn[y * W + px] || !vIn[y * W + px]) continue;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;                   // foto sem janela: opaca
  const w = (maxX - minX + 1) / W, h = (maxY - minY + 1) / H;
  /* Uma janela minúscula é medida errada (uma sombra vazada, um recorte solto),
     e aceitar isso encolheria a tela de desenho a um selo no meio da foto. */
  if (w < 0.2 || h < 0.2) return null;
  return { photoAr: W / H, x: minX / W, y: minY / H, w, h };
}

const pct = (v: number) => (v * 100).toFixed(3) + '%';

/* Publica a janela nas duas superfícies que a mostram — o card sobre o render e
   o palco do editor. Vai em variáveis CSS porque quem desenha isso é o CSS;
   daqui sai só a medida. */
/**
 * Onde a TELA fica dentro da foto — e por que não é a janela vazada.
 *
 * A tela do fabric cobre a chapa INTEIRA: `addLiveryUV()` normaliza `uv1` de 0
 * a 1 sobre os limites do recorte, piso a teto. A janela vazada da foto, por
 * sua vez, é só a parte PINTÁVEL — o que sobra entre o friso de proteção e a
 * cantoneira. Encaixar a tela dentro da janela, como se fazia, iguala duas
 * coisas diferentes: o pé da tela passa a valer o pé da janela, e toda a arte
 * desce em bloco. É essa a diferença que o usuário viu — o texto com folga
 * sobre a estrutura no editor e cortado por ela no implemento.
 *
 * Aqui a conta é a inversa e é exata: a tela é esticada para que a FAIXA
 * PINTÁVEL DELA (medida no 3D por `measurePaintable()`) caia exatamente sobre a
 * janela da foto. O excedente — saia e arremate — fica atrás da foto, que
 * continua desenhada por cima (`.stage-panel::after` em core/studio.css). O
 * resultado é o comportamento honesto: arte posta fora da faixa desaparece sob
 * a ferragem no editor exatamente como desaparece no baú.
 */
function canvasRect(key: SurfaceKey, win: PanelWindow) {
  const band = measured[key];
  if (!band) return { x: win.x, y: win.y, w: win.w, h: win.h };
  const [v0, v1] = band;
  const span = v1 - v0;
  if (!(span > 0.05)) return { x: win.x, y: win.y, w: win.w, h: win.h };
  const h = win.h / span;
  /* `v` corre de baixo para cima; a tela cresce para baixo. O topo da faixa
     (v1) fica a `1 − v1` da borda de cima da tela. */
  return { x: win.x, y: win.y - (1 - v1) * h, w: win.w, h };
}

function publishWindow(key: SurfaceKey, win: PanelWindow) {
  windows[key] = win;
  const r = canvasRect(key, win);
  const targets = [
    root.querySelector<HTMLElement>('.preview-card[data-surface="' + key + '"]'),
    stagePanels[key],
  ];
  /* A FOTO SAI DE CENA QUANDO HÁ ARTE VETORIAL para esta face.
     ---------------------------------------------------------------------
     Ela era a moldura opaca com a janela vazada, e fazia bem uma coisa (a
     ferragem por cima do desenho) e mal a outra: NÃO redimensiona. Um baú de
     8,40 m e um de 15,40 m recebiam a mesma imagem esticada, e com ela
     esticavam a fita 3M, a cantoneira e os varões — peças de dimensão fixa
     desenhadas com dimensão variável.

     Quem assume é a grade 3×3 (vehicle/livery-art.ts), composta no canvas da
     FRENTE, que faz o mesmo trabalho e acompanha a medida.

     O QUE A FOTO CONTINUA FAZENDO, e por isso ela não foi apagada: é dela que
     sai a JANELA — `findWindow()` mede o vazado para posicionar a tela do
     fabric. Trocar essa medição pela do manifesto é o passo seguinte e é
     independente; enquanto não for feito, a foto é medida e não é DESENHADA.
     `none` e não a remoção da variável: `.ts-pw-ready` continua valendo, então
     a caixa e o recorte da miniatura seguem exatamente os mesmos. */
  const usingArt = hasLiveryArt(key);
  for (const el of targets) {
    if (!el) continue;
    el.style.setProperty('--ts-pw-img', usingArt ? 'none' : 'url("' + PANEL_IMAGE[key] + '")');
    el.style.setProperty('--ts-pw-ar', String(win.photoAr));
    el.style.setProperty('--ts-pw-x', pct(r.x));
    el.style.setProperty('--ts-pw-y', pct(r.y));
    el.style.setProperty('--ts-pw-w', pct(r.w));
    el.style.setProperty('--ts-pw-h', pct(r.h));
    el.classList.add('ts-pw-ready');
  }
  /* A MINIATURA TEM DE RECORTAR, e é consequência direta da conta acima.
     `canvasRect()` devolve de propósito uma tela MAIOR que a janela — ela cobre
     a chapa inteira e só a faixa pintável dela cai sobre o vazado da foto. No
     card, essa tela é um `position: absolute` dentro de `.ts-panel__media`, que
     não tem recorte nenhum (`overflow: visible`, medido): a saia e o arremate
     de topo, que ficam fora da janela, são desenhados PARA FORA da moldura do
     cartão. É a arte "vazando por baixo da miniatura".
     A foto por cima é `inset: 0`, ou seja cobre só a moldura — não esconde o
     que passa dela. O recorte vai no estilo em linha porque `core/studio.css`
     tem outro dono; a regra é de quem calcula a caixa, e é aqui. */
  const media = root.querySelector<HTMLElement>(
    '.preview-card[data-surface="' + key + '"] .ts-panel__media',
  );
  if (media) media.style.overflow = 'hidden';
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    /* Quem chama desenha esta imagem num canvas e lê de volta com getImageData()
       para medir a janela vazada. Uma imagem de outra origem carregada sem CORS
       CONTAMINA o canvas, o getImageData lança SecurityError, e o `catch` de lá
       engole o erro — a medida simplesmente não acontece e o editor cai no
       fallback sem nada no console dizendo por quê.
       Não aparece em dev: o proxy do Vite faz a requisição same-origin. Só morde
       quando VITE_STUDIO_ASSETS_BASE aponta para a origem da API — produção. A
       API responde `Access-Control-Allow-Origin: *`, então isto basta.
       Antes de `src`, sempre: o atributo só vale se estiver posto quando a
       requisição parte. */
    img.crossOrigin = 'anonymous';
    img.addEventListener('load', () => resolve(img), { once: true });
    img.addEventListener('error', () => resolve(null), { once: true });
    img.src = url;
  });
}

/* Mede uma vez por ARQUIVO: as duas laterais usam a mesma foto, e varrer 1,7 M
   de pixels duas vezes para chegar ao mesmo número é trabalho jogado fora. */
async function measurePanelWindows() {
  const byUrl = new Map<string, Promise<PanelWindow | null>>();
  await Promise.all(SURFACE_KEYS.map(async (key) => {
    const url = PANEL_IMAGE[key];
    let job = byUrl.get(url);
    if (!job) {
      job = loadImage(url).then((img) => (img ? findWindow(img) : null));
      byUrl.set(url, job);
    }
    const win = await job;
    if (!win) {
      console.warn('[truck-studio] a foto do painel "' + key + '" não tem janela vazada —'
        + ' o desenho segue POR CIMA dela (comportamento antigo). Exporte o PNG com o'
        + ' painel transparente para o desenho entrar por baixo da ferragem.');
      return;
    }
    publishWindow(key, win);
    sizePreviewCanvas(key);
    drawPreview(key);
  }));
}

/* A prévia do card é um canvas de tamanho fixo no template; se a janela medida
   tiver outra proporção, o buffer é reajustado para o desenho não sair
   espremido dentro dele. Só a ALTURA muda — a largura é a resolução escolhida. */
function sizePreviewCanvas(key: SurfaceKey) {
  const win = windows[key];
  const pc = prevEls[key];
  if (!win || !pc) return;
  const fab = surfaces[key];
  const h = Math.max(24, Math.round(pc.width * (fab.getHeight() / fab.getWidth())));
  if (pc.height !== h) pc.height = h;
}

/* ---------------- cor do implemento ----------------
   O que aparece ATRÁS da arte, pela janela: o baú branco de fábrica ou, quando
   "pintar o implemento" está ligado, a mesma tinta do cavalo. Uma variável CSS
   porque os dois lugares que a mostram (card e editor) são desenhados por CSS,
   e porque assim não há um segundo estado a manter em sincronia. */
const IMPLEMENT_WHITE = '#ffffff';
let cabPaintHex = IMPLEMENT_WHITE;
let paintedImplement = false;

function syncImplementColor() {
  root.style.setProperty('--ts-implement', paintedImplement ? cabPaintHex : IMPLEMENT_WHITE);
}

/** A tinta escolhida para o cavalo; studio.ts chama a cada aplicação de cor. */
export function setCabPaintColor(hex: string | null | undefined) {
  cabPaintHex = hex || IMPLEMENT_WHITE;
  syncImplementColor();
}

/**
 * "Pintar o implemento com a cor do cavalo" SOME numa edição especial.
 *
 * O controle promete estender ao baú a tinta do cavalo, e numa edição especial
 * não existe tinta do cavalo para estender: a película É o produto. Medido no
 * `iveco_metallica_4x2.glb`, o desenho está ASSADO dentro do albedo — todos os
 * materiais de tinta chegam com um `map` chamado `*_carpaint_color_assada`,
 * enquanto no rip de fábrica o `carpaint_color` vem sem textura nenhuma. Por
 * isso o modelo declara `paintMaterials: []` e o seletor tira o passo da cor
 * (`seqFor`): não há cor a escolher.
 *
 * O que sobrava era este checkbox, o único lugar do app que ainda oferecia a
 * tinta de um caminhão que não tem tinta. Ligado, ele pintava o baú com
 * `cabPaintHex`, que numa edição especial é a cor que sobrou da ÚLTIMA escolha
 * — de outro caminhão. Esconder é a correção certa: desabilitar deixaria na
 * tela uma pergunta cuja resposta não existe.
 *
 * Desligar é obrigatório junto com esconder. Quem vem de um caminhão pintável
 * com a caixa marcada trocaria de modelo e ficaria com o baú tingido, sem
 * controle visível para desfazer.
 */
export function setSpecialEdition(on: boolean) {
  const box = $('paint-trailer') as HTMLInputElement;
  const row = box.closest('label');
  if (on && box.checked) {
    box.checked = false;
    /* Pelo mesmo caminho do clique — as duas metades andam juntas; ver
       `bindTrailerPaint()`. Um `checked = false` sozinho deixaria o material do
       baú pintado e o fundo branco das telas fora. */
    box.dispatchEvent(new Event('change'));
  }
  if (row) row.classList.toggle('hidden', on);
}

/* ---------------- palco ---------------- */
export const stagePanels: Record<SurfaceKey, HTMLElement> =
  { left: $('stage-left'), right: $('stage-right'), rear: $('stage-rear') };

/* Duas caixas, não uma: a FOTO é o que ocupa o palco, e a tela é a janela dentro
   dela. Antes só existia a tela, e era ela que era enquadrada.
   `zoom` multiplica o enquadramento; o excedente vira rolagem em .stage-scroll,
   porque com uma letra de 20 cm o usuário vai querer chegar perto dela. */
/** O zoom com que cada palco foi enquadrado pela última vez. `syncSurfaceAspect()`
 *  precisa dele para refazer o enquadramento sem que o editor tenha de avisar. */
const lastZoom: Record<SurfaceKey, number> = { left: 1, right: 1, rear: 1 };
const zoomOf = (key: SurfaceKey) => lastZoom[key];

export function sizeModalCanvas(key: SurfaceKey, zoom = 1) {
  const fab = surfaces[key];
  const win = windows[key];
  const panel = stagePanels[key];
  const stage = $('modal-stage');
  const maxW = stage.clientWidth - 40, maxH = stage.clientHeight - 52;
  if (maxW <= 0 || maxH <= 0) return;         // modal ainda sem layout
  lastZoom[key] = zoom;

  const outerAr = win ? win.photoAr : fab.getWidth() / fab.getHeight();
  let w = maxW, h = w / outerAr;
  if (h > maxH) { h = maxH; w = h * outerAr; }
  w *= zoom; h *= zoom;

  panel.style.width = w + 'px';
  panel.style.height = h + 'px';
  /* A CAIXA DA TELA É `canvasRect()`, E NÃO A JANELA VAZADA.
     As duas superfícies em que o painel aparece têm de usar a MESMA conta, e
     até aqui não usavam: o card é posicionado por `--ts-pw-*`, que
     `publishWindow()` publica a partir de `canvasRect()` — a tela ESTICADA, de
     modo que a faixa pintável dela caia sobre a janela da foto —, enquanto o
     palco do editor era dimensionado pela janela CRUA. O `.panel-window` já
     ficava na origem de `canvasRect()` (é `--ts-pw-x/y` no CSS), então origem e
     tamanho vinham de contas diferentes.

     O efeito é o defeito relatado: a chapa INTEIRA (piso a teto, que é o que a
     `uv1` normaliza) era espremida dentro da faixa PINTÁVEL, que é ~80 % dela.
     Com a faixa medida em 1,7266…3,9614 de um painel 1,3919…4,1688, a arte
     subia 9,74 % da altura da janela — 218 mm de baú. O cliente punha o texto
     com folga sobre o trilho no editor e o encontrava cortado por ele no 3D.
     Agora as duas caixas saem da mesma função e o editor mostra a posição real. */
  const r = win ? canvasRect(key, win) : null;
  fab.setDimensions(
    { width: (r ? w * r.w : w) + 'px', height: (r ? h * r.h : h) + 'px' },
    { cssOnly: true },
  );
  fab.calcOffset();
}

/* When the trailer panels are painted with the cab color, the livery canvases'
   solid white default background would hide the paint — switch backgrounds to
   transparent while painted, and restore the previous background after. */
/* The stashed background lives in a WeakMap rather than on the canvas: fabric's
   Canvas has no slot for it, and a side table keeps the "was it stashed at all?"
   question (which DEFAULT_BG vs. restore turns on) explicit. */
const bgBeforePaint = new WeakMap<fabric.Canvas, string | fabric.TFiller | undefined>();

export function setBackgroundsForPaint(painted: boolean) {
  for (const c of Object.values(surfaces)) {
    if (painted) {
      bgBeforePaint.set(c, c.backgroundColor);
      c.backgroundColor = '';
    } else {
      const prev = bgBeforePaint.get(c);
      c.backgroundColor = (prev === undefined || prev === null) ? DEFAULT_BG : prev;
      bgBeforePaint.delete(c);
    }
    c.renderAll();
  }
}

/* ---------------- "pintar o implemento com a cor do cavalo" ----------------
   O controle mora na barra do editor grande, e não junto da escolha de cor: a
   cor é do CAVALO (passo do seletor), e estendê-la ao baú é uma decisão sobre o
   IMPLEMENTO — tomada olhando para o painel que vai receber a tinta.

   As duas metades têm de andar juntas, e é por isso que estão na mesma função:
   models.setPaintTarget('both') troca o material dos painéis do baú pela tinta
   do cavalo, e setBackgroundsForPaint(true) tira o fundo BRANCO das telas do
   fabric — sem isso o branco continuaria desenhado POR CIMA da tinta e o
   implemento seguiria branco na tela. Desligar restaura o branco de fábrica.
   Ligar/desligar não mexe em nada que o usuário tenha desenhado: o que sai e
   volta é só o fundo. */
function bindTrailerPaint() {
  $('paint-trailer').addEventListener('change', (e) => {
    const { checked } = evTarget<HTMLInputElement>(e);
    setPaintTarget(checked ? 'both' : 'cab');
    setBackgroundsForPaint(checked);
    /* A chapa que aparece pela janela do painel segue a mesma decisão: ligado,
       o baú é da cor do cavalo, e o editor tem de mostrar a arte sobre ELA — um
       desenho que sumia no branco pode gritar sobre o vermelho, e vice-versa. */
    paintedImplement = checked;
    syncImplementColor();
    setStatus(checked
      ? 'Pintura aplicada à cabine e ao implemento (incluindo a frente)'
      : 'Pintura somente na cabine');
  });
}

/* ---------------- init ----------------
   A interface do editor vive em ../ui/livery-editor.ts. A importação daquele
   módulo fecha um ciclo com este (ele precisa das telas daqui), e o ciclo é
   seguro por uma razão concreta: nada lá toca um binding deste arquivo durante
   a AVALIAÇÃO do módulo — só dentro de funções, todas chamadas a partir do
   initLiveryEditor() abaixo. Manter essa propriedade é o que impede um
   ReferenceError de zona morta temporal no boot. */
export function initLivery() {
  bindTrailerPaint();
  syncImplementColor();
  /* A miniatura do card não observa o canvas estrutural — ela é um `drawImage`
     de uma vez só. Então quem recompõe avisa, e o card se redesenha. Sem isto,
     mudar uma medida atualizaria o 3D e o palco e deixaria o card velho. */
  onStructureRedrawn((k) => schedulePreview(k));
  /* A grade vetorial chega por `fetch`, DEPOIS de as janelas terem sido
     publicadas com a foto. Sem esta linha a ferragem apareceria no palco (o
     canvas da frente compõe sozinho) e a foto continuaria desenhada por cima
     dela até a próxima mudança de medida — as duas visíveis ao mesmo tempo, uma
     esticada e a outra não. Republicar é o que troca `--ts-pw-img` para `none`.
     Ver a nota em `publishWindow`. */
  onLiveryArtReady(() => {
    for (const k of SURFACE_KEYS) {
      const win = windows[k];
      if (win) publishWindow(k, win);
      schedulePreview(k);
    }
  });
  /* Fora do caminho crítico: são ~4,5 M de pixels varridos, e até a medida
     chegar os cards já estão desenhados com a foto atrás (o fallback). */
  void measurePanelWindows();

  for (const k of SURFACE_KEYS) {
    installGuide(k);
    surfaces[k].requestRenderAll();
    drawPreview(k);
  }

  initLiveryEditor();

  resumeLivery();
}

/* ---------------- watchdog, e o par que o liga e desliga ----------------
   Por que o watchdog existe: um buffer de canvas 2D pode ser descartado sob
   pressão de memória de GPU (os modelos são grandes), e `requestRenderAll`
   depende de rAF, que para quando a página não está compondo. Uma repintura
   SÍNCRONA periódica redesenha a partir do modelo de objetos do fabric, que é a
   fonte de verdade.
   O upload para a GPU continua preso à revisão de CONTEÚDO (markDirty/`rev`, lá
   em cima), então um repintar que produziu os mesmos pixels não custa textura
   nenhuma — um buffer descartado volta sem pagar um upload que ninguém precisa.
   É o que impede os ~13 MB das três texturas de subirem a cada 4 s, pela vida
   inteira da aba, com o estúdio parado.

   E por que ele tem par: o DOM do engine sobrevive à rota (ver core/dom.ts).
   Um `setInterval` criado no boot ficaria vivo em TODAS as outras telas do
   Ankaa. Ele já seria inerte lá — o `isMounted()` o faz sair cedo —, mas
   "inerte" é uma promessa que a próxima edição quebra sem ninguém perceber, e
   studio.ts já tem o par de ganchos (mount/unmount) para dizer a verdade.
   Os ouvintes de teclado e de resize NÃO estão aqui: são do editor, e
   ../ui/livery-editor.ts os guarda atrás de isMounted()/isOpen(). */
let watchdogTimer: ReturnType<typeof setInterval> | null = null;

export function resumeLivery() {
  if (watchdogTimer !== null) return;
  watchdogTimer = setInterval(() => {
    if (!isMounted() || document.hidden) return;
    try { for (const c of Object.values(surfaces)) c.renderAll(); } catch { /* ignora */ }
  }, 4000);
}

export function teardownLivery() {
  if (watchdogTimer === null) return;
  clearInterval(watchdogTimer);
  watchdogTimer = null;
}
