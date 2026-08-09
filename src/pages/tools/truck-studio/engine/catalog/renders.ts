/* Renders pré-produzidos dos cards — o que substituiu `ui/preview.ts`.
   ---------------------------------------------------------------------------
   O QUE SAIU. `ui/preview.ts` mantinha um SEGUNDO contexto WebGL vivo ao lado
   do estúdio, com PMREM próprio, `preserveDrawingBuffer:true` e uma cópia da
   geometria da cabine em VRAM. Cada card de cor era um render offscreen a
   960×600 mais um `toDataURL()`, e a paleta inteira da montadora — até 26
   cores — era aquecida DENTRO da cortina de carregamento, a cada troca de
   caminhão: de meio a quatro segundos de main thread congelada, todas as
   vezes, para produzir uma aproximação confessa da tinta (sem flocos, sem
   flop, sem casca de laranja). O card mentia sobre a pintura e cobrava caro
   por isso.

   O QUE ENTROU. Uma imagem por combinação, produzida offline com a tinta de
   verdade (`vehicle/paint.ts`) e a pose de `scene/view.ts` — a MESMA pose que
   `frameAll()` usa, para o card prometer o que a cena entrega. O cache passa a
   ser o cache HTTP do navegador, que é onde ele deveria estar desde o começo.

   CONVENÇÃO DE CAMINHO (travada — o desktop lê a mesma):

       renders/trucks/<manufacturerId>/<modelId>/<chassisId>/<colorId>.webp

   960 × 600 (16:10, casando `--ts-media-ratio` de selector.css), fundo
   TRANSPARENTE — é `selector.css` quem desenha o halo e a sombra elíptica sob
   o card, e um fundo assado quebraria esse gradiente.

   POR QUE UM MANIFESTO, E NÃO UMA SONDA. `assetUrl()` monta URL sem perguntar
   se ela existe, e todo carregador do engine degrada em silêncio por desenho
   (ver core/paths.ts). Sem `renders.json`, um passo de cor com 26 cards seria
   26 requisições 404 e 26 `onerror` — e a rede diria "erro" onde a verdade é
   "essa combinação ainda não foi produzida". O manifesto responde isso ANTES
   de qualquer requisição.

   E ELE PODE NÃO EXISTIR. Hoje, de fato, não existe: os renders serão
   produzidos depois, e o código entra antes. Manifesto ausente = `have` vazio
   = `renderUrl()` sempre null = todo card cai no placeholder de silhueta. Zero
   requisições, zero 404, nenhuma moldura vazia. */
import { RENDERS_DIR } from '../core/paths';
import { assetUrl } from './catalog';

/** Dimensão canônica de um render de card. O pipeline offline tem de bater. */
export const RENDER_SIZE: readonly [number, number] = [960, 600];

/**
 * O id reservado do render NEUTRO de um par modelo+chassi: a lataria sem tinta
 * escolhida, usada quando a cor pedida ainda não foi produzida.
 *
 * É um id de COR reservado dentro do manifesto, não uma cor do catálogo — por
 * isso a string é fixa aqui e não vem de `colors.ts`. Uma tinta com este id
 * colidiria; `neutro` é seguro porque a paleta usa nomes de cor de verdade.
 */
export const NEUTRAL_COLOR_ID = 'neutro';

/** O formato dos arquivos, sobrescrevível pelo manifesto. */
const DEFAULT_FORMAT = 'webp';

interface RenderIndex {
  format: string;
  /** 'scania/scania-s730/6x4' → Set de colorIds produzidos */
  have: Map<string, Set<string>>;
  /** 'scania/scania-s730' → lista de chassisIds que têm ALGUM render */
  byModel: Map<string, string[]>;
}

const EMPTY: RenderIndex = { format: DEFAULT_FORMAT, have: new Map(), byModel: new Map() };

let index: RenderIndex = EMPTY;
let loading: Promise<RenderIndex> | null = null;

const key = (manufacturerId: string, modelId: string, chassisId: string) =>
  manufacturerId + '/' + modelId + '/' + chassisId;

function parse(raw: unknown): RenderIndex {
  const j = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const have = new Map<string, Set<string>>();
  const byModel = new Map<string, string[]>();
  const src = (j.have && typeof j.have === 'object' ? j.have : {}) as Record<string, unknown>;
  for (const [path, colors] of Object.entries(src)) {
    if (!Array.isArray(colors) || !colors.length) continue;
    const ids = colors.filter((c): c is string => typeof c === 'string' && !!c.trim())
      .map((c) => c.trim());
    if (!ids.length) continue;
    have.set(path, new Set(ids));
    /* O índice por modelo é o que torna o passo 3 da cadeia de fallback O(1):
       "algum OUTRO chassi deste modelo tem esta cor?" não pode custar uma
       varredura do manifesto inteiro por card. */
    const cut = path.lastIndexOf('/');
    if (cut <= 0) continue;
    const model = path.slice(0, cut);
    const chassis = path.slice(cut + 1);
    const list = byModel.get(model);
    if (list) list.push(chassis);
    else byModel.set(model, [chassis]);
  }
  const format = typeof j.format === 'string' && j.format.trim() ? j.format.trim() : DEFAULT_FORMAT;
  return { format, have, byModel };
}

/**
 * Carrega `renders/renders.json`. Memoizado e NUNCA lança: uma falha aqui
 * significa "nenhum render produzido ainda", que é um estado normal e
 * completamente atendido pelo placeholder.
 *
 * Chamado no boot ao lado de `loadCatalog()`; qualquer consulta feita antes
 * dele simplesmente devolve null, e o card já nasce com o placeholder.
 */
export function loadRenders(): Promise<RenderIndex> {
  if (!loading) {
    loading = (async () => {
      const url = assetUrl(RENDERS_DIR + 'renders.json');
      try {
        const r = await fetch(url, { cache: 'no-cache' });
        if (!r.ok) throw new Error(url + ' → ' + r.status);
        index = parse(await r.json());
      } catch {
        /* console.info e não console.warn: enquanto o pipeline de renders não
           roda, este é o caminho ESPERADO — um warn treinaria todo mundo a
           ignorar o console. */
        console.info('[renders] renders.json indisponível — os cards usam o placeholder de silhueta.');
        index = EMPTY;
      }
      return index;
    })();
  }
  return loading;
}

/** Uma URL de render, já resolvida por `assetUrl()`. Nunca concatenada à mão. */
function url(manufacturerId: string, modelId: string, chassisId: string, colorId: string) {
  return assetUrl(
    RENDERS_DIR + 'trucks/' + manufacturerId + '/' + modelId + '/' + chassisId
    + '/' + colorId + '.' + index.format,
  );
}

/**
 * A URL do render deste modelo+chassi nesta cor, ou `null` quando nenhuma
 * combinação utilizável foi produzida.
 *
 * CADEIA DE FALLBACK, nesta ordem (a de DECISIONS §4, com o degrau 2b que o
 * manifesto torna barato):
 *   1. `modelo/chassi/cor` exato;
 *   2. `modelo/chassi/neutro` — a lataria sem cor, para o card ainda mostrar
 *      ESTE chassi;
 *   3. `modelo/<outro chassi>/cor` — o chassi muda a rodagem, não a cor da
 *      cabine, então uma cor certa num chassi vizinho diz mais sobre a tinta
 *      do que um neutro;
 *   4. `modelo/<outro chassi>/neutro`;
 *   5. `null` → o chamador cai na foto do manifesto e, na falta dela, no
 *      placeholder de silhueta. NUNCA uma moldura vazia.
 */
export function renderUrl(
  manufacturerId: string | null | undefined,
  modelId: string | null | undefined,
  chassisId: string | null | undefined,
  colorId: string | null | undefined,
): string | null {
  if (!manufacturerId || !modelId) return null;
  const model = manufacturerId + '/' + modelId;

  if (chassisId) {
    const own = index.have.get(key(manufacturerId, modelId, chassisId));
    if (own) {
      if (colorId && own.has(colorId)) return url(manufacturerId, modelId, chassisId, colorId);
      if (own.has(NEUTRAL_COLOR_ID)) {
        return url(manufacturerId, modelId, chassisId, NEUTRAL_COLOR_ID);
      }
    }
  }

  const siblings = index.byModel.get(model);
  if (!siblings) return null;
  if (colorId) {
    for (const c of siblings) {
      if (c === chassisId) continue;
      if (index.have.get(key(manufacturerId, modelId, c))?.has(colorId)) {
        return url(manufacturerId, modelId, c, colorId);
      }
    }
  }
  for (const c of siblings) {
    if (c === chassisId) continue;
    if (index.have.get(key(manufacturerId, modelId, c))?.has(NEUTRAL_COLOR_ID)) {
      return url(manufacturerId, modelId, c, NEUTRAL_COLOR_ID);
    }
  }
  return null;
}

/** Existe QUALQUER render para este par modelo+chassi? */
export function hasRender(
  manufacturerId: string | null | undefined,
  modelId: string | null | undefined,
  chassisId: string | null | undefined,
): boolean {
  return renderUrl(manufacturerId, modelId, chassisId, null) !== null;
}

/**
 * Aquece o cache HTTP das URLs passadas — o que sobrou de `warmCabPreview()`.
 *
 * `new Image()` e não `<link rel=prefetch>`: o link precisa entrar no
 * `document.head`, que é DOM do app e não do engine, e o navegador trata a
 * imagem decodificada como a mesma entrada de cache que o `<img>` do card vai
 * pedir. Sem `await`, sem tratamento de erro: aquecer é otimização, e uma URL
 * que falha aqui simplesmente falha de novo lá, onde já há fallback.
 */
export function prefetchRenders(urls: (string | null)[]) {
  for (const u of urls) {
    if (!u) continue;
    const img = new Image();
    img.decoding = 'async';
    img.src = u;
  }
}

/* ---------------- placeholder: a silhueta ----------------
   O terceiro degrau da cadeia, e o requisito explícito: "nunca um quadro
   vazio". Uma caixa cinza seria exatamente isso com outro nome.

   É SVG inline e não uma imagem: escala sem borrar em qualquer tamanho de
   card, herda a cor do CSS (`currentColor` via `--ts-ph-ink`) e não custa uma
   requisição. O nome do modelo vai num `<span>` IRMÃO, não dentro do SVG, para
   pegar a fonte e o `text-overflow` do resto da interface — texto dentro de
   SVG não quebra nem elide. */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Quantos eixos esta configuração tem, lido do id (`6x4` → 3, `4x2` → 2,
 * `8x4` → 4). A silhueta muda com ele, então dois chassis do mesmo modelo não
 * ficam com o mesmo desenho — que é o defeito que o card de foto compartilhada
 * tinha e que este passo existe para acabar.
 *
 * Qualquer id que não case com `NxM` cai em 3 eixos (o cavalo brasileiro
 * típico); o placeholder é uma indicação, não uma planta.
 */
export function axleCount(chassisId: string | null | undefined): number {
  const m = /^(\d+)x(\d+)$/.exec(String(chassisId || '').trim());
  if (!m) return 3;
  const wheels = Number(m[1]);
  if (!Number.isFinite(wheels) || wheels < 4) return 3;
  return Math.max(2, Math.min(5, Math.round(wheels / 2)));
}

function svgEl(tag: string, attrs: Record<string, string>) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

/**
 * Um cavalo mecânico de perfil, com o número de eixos do chassi.
 *
 * Traçado num viewBox 16:10 (o mesmo `--ts-media-ratio` da moldura) para o
 * desenho ficar centrado sem transformação nenhuma. Cabine + spoiler + quinta
 * roda + eixos, tudo em caminho fechado: uma silhueta cheia lê como veículo,
 * um contorno de linha lê como ícone.
 */
export function truckSilhouette(chassisId: string | null | undefined): SVGSVGElement {
  const svg = svgEl('svg', {
    viewBox: '0 0 320 200',
    /* Sem width/height: o CSS dá o tamanho, e um atributo aqui venceria a
       regra `width:100%` da moldura em navegadores que ainda respeitam o
       atributo de apresentação. */
    fill: 'none',
    'aria-hidden': 'true',
    focusable: 'false',
  }) as SVGSVGElement;
  svg.setAttribute('class', 'ts-ph__art');

  const axles = axleCount(chassisId);
  const GROUND = 148;
  const R = 13;

  /* Sombra de contato primeiro, para tudo o mais pintar por cima dela. */
  svg.appendChild(svgEl('ellipse', {
    cx: '160', cy: String(GROUND + R - 1), rx: '104', ry: '7',
    class: 'ts-ph__shadow',
  }));

  /* Corpo: para-choque → capô → para-brisa inclinado → teto → spoiler →
     traseira da cabine → chassi até a quinta roda. Um traçado só. */
  const body = 'M56 148 L56 128 L60 112 L74 106 L86 74 L96 66 L154 66 L160 74 L160 106'
    + ' L168 106 L168 60 L176 56 L188 60 L188 112 L246 112 L252 118 L252 132 L262 132'
    + ' L262 148 Z';
  svg.appendChild(svgEl('path', { d: body, class: 'ts-ph__body' }));

  /* Janela — o vazio que faz a massa acima virar uma CABINE e não um bloco. */
  svg.appendChild(svgEl('path', {
    d: 'M92 100 L102 76 L150 76 L150 100 Z', class: 'ts-ph__glass',
  }));

  /* Eixos: um dianteiro fixo sob a cabine, o resto em grupo traseiro. Espaçados
     por 30 px a partir da quinta roda para trás, que é a proporção de um
     conjunto real e o que faz 4x2 e 8x4 se distinguirem de relance. */
  const xs = [88];
  for (let i = 0; i < axles - 1; i++) xs.push(224 - i * 30);
  for (const cx of xs) {
    svg.appendChild(svgEl('circle', {
      cx: String(cx), cy: String(GROUND), r: String(R), class: 'ts-ph__tyre',
    }));
    svg.appendChild(svgEl('circle', {
      cx: String(cx), cy: String(GROUND), r: String(R - 6), class: 'ts-ph__hub',
    }));
  }
  return svg;
}

/**
 * A moldura de placeholder inteira: silhueta + nome do modelo, no verde do
 * projeto. É isto que entra na moldura de um card cujo render ainda não existe.
 *
 * @param label o nome do modelo (e do chassi, quando ele diferencia)
 */
export function renderPlaceholder(label: string, chassisId?: string | null): HTMLElement {
  const box = document.createElement('span');
  box.className = 'ts-ph';
  box.setAttribute('aria-hidden', 'true');
  box.appendChild(truckSilhouette(chassisId));
  const name = document.createElement('span');
  name.className = 'ts-ph__name';
  name.textContent = label || '';
  box.appendChild(name);
  return box;
}
