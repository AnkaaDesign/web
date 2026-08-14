/* Painel de ajuste da tinta.
   ---------------------------------------------------------------------------
   Dirige vehicle/paint.ts AO VIVO e grava o resultado na cor — uma linha de
   `Paint`, na coluna `previewConfig`. Como `Paint` já carrega `manufacturer`,
   gravar na linha já é gravar "aquela cor daquela montadora": não existe chave
   de montadora dentro do JSON, e não deve existir.

   O FORMATO GRAVADO É O DO LABORATÓRIO. Os campos são `PaintParams`, com os
   nomes que `paint-lab.html` salva — `pearlFlip`, `flakeDensity`, `peelScale` e
   companhia. Não é coincidência nem herança: é o que `paintEffectFrom()` (em
   ../../index.tsx) reconhece ao ler de volta, pelo marcador `pearlFlip`. Uma
   receita salva aqui e uma colada do laboratório entram pelo mesmo caminho.

   POR QUE OS CAMPOS SÃO UMA TABELA E NÃO MARKUP.
   Todo campo aqui é o nome de uma propriedade de `PaintParams`. Escrever os
   <input> à mão no template daria ~15 lugares onde um nome pode divergir do
   motor, e a divergência é SILENCIOSA: setPaint() faz `if (k in params)`, então
   um `flakeDensityy` não erra, só não faz nada. Declarando os campos em GROUPS,
   com a chave tipada como keyof PaintParams, o TypeScript recusa o nome errado
   na compilação.

   POR QUE "APLICAR" NÃO É "SALVAR E FECHAR".
   O painel escreve na tinta a cada arrasto do slider, então o veículo na tela
   JÁ é o resultado antes de qualquer botão. "Aplicar" só promove o que está na
   tela a padrão daquela cor no banco; "Descartar" devolve ao que estava gravado.
   Fechar sem escolher deixa o ajuste vivo na sessão e não grava nada — que é o
   comportamento que permite comparar duas cores com o mesmo ajuste.

   ESTADO É DO MOTOR, NÃO DAQUI.
   O painel nunca guarda uma cópia dos valores: lê com getPaintParams() e escreve
   com setPaint(). Espelhar em variáveis locais é exatamente como uma segunda
   superfície começa a discordar da primeira. O único estado local é `baseline`,
   o que estava valendo quando o painel abriu, para o "Descartar" ter para onde
   voltar. */
import { $, el, root, errText } from '../core/dom';
import {
  getPaintParams, setPaint, PAINT_DEFAULTS_BY_FINISH,
  type PaintParams, type PaintFinish,
} from '../vehicle/paint';
import { getColor, saveColorRecipe, canPersistColors, FINISH_LABEL } from '../catalog/colors';
import { setStatus } from './chrome';
/* O PEDIDO DE QUADRO MORA AQUI, E NÃO EM `vehicle/paint.ts`.
   ---------------------------------------------------------------------------
   O laço de `scene/scene.ts` desenha sob demanda: quem muda o que a câmera vê
   tem de dizer que mudou, senão o quadro não vem. `setPaint()` muda uniformes —
   ou seja, muda a imagem — e mesmo assim NÃO invalida, e isso é deliberado:
   `paint.ts` é um sumidouro de dependência (importa `three` e mais nada), e
   inverter essa aresta fecharia um ciclo com `scene.ts` e daria `ReferenceError`
   no boot. Ver a nota de acyclicidade no topo de `scene.ts`.
   Então quem chama é quem pede o quadro. Esta é a ÚNICA superfície que escreve
   na tinta ao vivo, então é aqui que a dívida fecha — e o resto da interface já
   importa da cena desta mesma forma (`hud.ts`, `chrome.ts`). */
import { invalidate } from '../scene/scene';

/** Escreve na tinta E pede o quadro que mostra o resultado. Todo `setPaint()`
 *  deste arquivo passa por aqui — um caminho só, para não haver o quarto lugar
 *  que esqueceu de invalidar. */
function paint(patch: Partial<PaintParams>) {
  setPaint(patch);
  invalidate();
}

/* Os parâmetros que o painel expõe. É `PaintParams` menos `flakePx`, que é alvo
   de ANTIALIASING em pixels de tela e não uma propriedade da tinta — não há o
   que decidir nele olhando o caminhão.

   `color` ENTROU, e o motivo de ele estar fora não valia. O receio era que o
   painel reescrevesse o hex e fizesse "Vermelho Rubi" virar azul no catálogo
   inteiro. Mas quem grava é `saveColorRecipe()` → `previewConfig`, e NUNCA a
   coluna `hex`: o card, a amostra e o crachá continuam lendo a cor de catálogo.
   O que a receita carrega é a face MEDIDA da tinta, que sobrepõe o catálogo só
   na renderização 3D — é exatamente por isso que o `Vermelho Ruby` está gravado
   como `#750406` e a receita pede `#c01c28`.

   Pior: `recipeNow()` já gravava `color` (ele serializa o `PaintParams`
   inteiro). O painel PERSISTIA um campo que não deixava ninguém editar. E num
   acabamento LISO isso deixava o editor sem nenhum controle de cor, porque os
   três campos de cor que existiam (floco, meio, virada) são todos de efeito e
   só aparecem em metálico e perolizado. */
type Key = Exclude<keyof PaintParams, 'flakePx'>;

/* Sem texto de ajuda na interface. O que cada campo faz está anotado ao lado da
   declaração dele, abaixo: é onde a informação vale (para quem mexe nos limites)
   e não onde ela atrapalha (quinze parágrafos num painel de 300 px). */
interface RangeField {
  kind: 'range';
  key: Exclude<Key, 'finish' | 'color' | 'flakeColor' | 'pearlMid' | 'pearlFlip'>;
  label: string;
  min: number;
  max: number;
  step: number;
  /** só aparece nestes acabamentos; ausente = sempre */
  only?: PaintFinish[];
}
interface ColorField {
  kind: 'color';
  key: 'color' | 'flakeColor' | 'pearlMid' | 'pearlFlip';
  label: string;
  only?: PaintFinish[];
}
type Field = RangeField | ColorField;
interface Group { title: string; fields: Field[] }

/* Agrupado como a tinta é construída de verdade — base, floco, mica, verniz — e
   não como os uniformes estão ordenados no shader. */
const GROUPS: Group[] = [
  {
    title: 'Base',
    fields: [
      /* SEM `only`: toda tinta tem cor de base, e num acabamento liso ela é a
         única que existe — era o caso em que o painel abria sem nenhum controle
         de cor. Grava em `previewConfig.color` (a face medida), não no `hex` do
         catálogo; ver a nota de `Key` acima. "Padrão do acabamento" não a
         devolve ao original de propósito: `PAINT_DEFAULTS_BY_FINISH` é
         `Omit<PaintParams,'finish'|'color'>`, porque a cor é a identidade da
         tinta e não um valor de fábrica do acabamento. */
      { kind: 'color', key: 'color', label: 'Cor da base' },
      /* Um basecoat vive SOB o verniz, então é bem mais liso que uma superfície
         pintada nua — daí o teto baixo não ser 1 por acidente. */
      { kind: 'range', key: 'roughness', label: 'Rugosidade da base', min: 0, max: 1, step: 0.01 },
      /* Faixa inteira, 0..1, porque é a faixa que o motor usa de verdade:
         `PAINT_DEFAULTS_BY_FINISH` dá 0,88 à metálica e 0,82 à perolizada, e
         applyToMaterials() só faz clamp01. Um teto de 0,4 aqui — que foi o que
         este campo nasceu com — não conseguia sequer REPRESENTAR o valor vivo:
         o cursor encostava no fim da régua e, ao primeiro toque, derrubava a
         tinta de 0,88 para 0,4. Um controle que mente sobre o estado é pior que
         controle nenhum.
         O cuidado que o teto tentava embutir continua valendo e está aqui, em
         palavras: o three faz diffuse × (1 − metalness), então subir isto
         apaga o pigmento. É por isso que uma metálica clara aguenta 0,88 e uma
         cor saturada perde a cor bem antes. */
      { kind: 'range', key: 'metalness', label: 'Carga de alumínio', min: 0, max: 1, step: 0.005,
        only: ['metallic', 'pearl'] },
    ],
  },
  {
    title: 'Floco',
    fields: [
      { kind: 'range', key: 'flakeAmount', label: 'Quantidade de floco', min: 0, max: 1, step: 0.01,
        only: ['metallic', 'pearl'] },
      /* Células por METRO do ruído — densidade real, não um 0..1. Por isso a
         faixa é 40..900 e não 0..1: floco graúdo é número BAIXO. */
      { kind: 'range', key: 'flakeDensity', label: 'Densidade do floco', min: 40, max: 900, step: 10,
        only: ['metallic', 'pearl'] },
      { kind: 'range', key: 'flakeTilt', label: 'Inclinação do floco', min: 0, max: 1, step: 0.01,
        only: ['metallic', 'pearl'] },
      { kind: 'range', key: 'flakeGloss', label: 'Brilho do floco', min: 0, max: 1, step: 0.01,
        only: ['metallic', 'pearl'] },
      /* Segue a cor base sozinha até alguém escolher uma — ver syncDerivedColors()
         em vehicle/paint.ts. */
      { kind: 'color', key: 'flakeColor', label: 'Cor do floco', only: ['metallic', 'pearl'] },
    ],
  },
  /* VIAGEM DE COR, e não "Perolizado".
     Estes quatro campos não são de uma família de tinta, são de um EFEITO — e
     um metálico o tem. `PAINT_DEFAULTS_BY_FINISH` (vehicle/paint.ts) dá
     `pearlAmount: 0,12` ao metálico contra `0,85` do perolizado: é a mesma
     máquina em amplitude diferente, e é o que faz um metálico clarear de frente
     e escurecer de raspão — o flop, que qualquer prata de verdade tem.
     Marcados como `only: ['pearl']`, o efeito continuava acontecendo na tela e
     os controles dele ficavam escondidos: o usuário via a tinta virar e não
     tinha onde mexer. Sólido segue fora porque lá a carga é 0 — não há viagem
     nenhuma para ajustar. */
  {
    title: 'Viagem de cor',
    fields: [
      /* No metálico isto é o flop (0,12 de fábrica); no perolizado é a mica
         (0,85). O rótulo fala do EFEITO, que é o que os dois compartilham. */
      { kind: 'range', key: 'pearlAmount', label: 'Intensidade da viagem', min: 0, max: 1, step: 0.01,
        only: ['metallic', 'pearl'] },
      /* O tom do MEIO do percurso: é ele que separa um perolizado de dois tons de
         um de três. */
      { kind: 'color', key: 'pearlMid', label: 'Cor do meio', only: ['metallic', 'pearl'] },
      /* A cor no ângulo rasante. Derivada girando a matiz da base, o que em
         QUALQUER vermelho cai em âmbar; é aqui que se conserta. */
      { kind: 'color', key: 'pearlFlip', label: 'Cor da virada', only: ['metallic', 'pearl'] },
      /* Expoente do percurso: alto = a virada só aparece bem de raspão. */
      { kind: 'range', key: 'pearlTravel', label: 'Estreiteza da virada', min: 0.5, max: 6, step: 0.05,
        only: ['metallic', 'pearl'] },
    ],
  },
  {
    title: 'Verniz',
    fields: [
      { kind: 'range', key: 'gloss', label: 'Brilho do verniz', min: 0, max: 1, step: 0.01 },
      /* Casca de laranja. Um reflexo perfeito é o denúncia-CG mais alto que
         existe — daí não começar em 0. */
      { kind: 'range', key: 'peel', label: 'Casca de laranja', min: 0, max: 1, step: 0.01 },
      { kind: 'range', key: 'peelScale', label: 'Tamanho da casca', min: 10, max: 120, step: 1 },
      { kind: 'range', key: 'peelDetail', label: 'Detalhe da casca', min: 0, max: 1, step: 0.01 },
      /* Desloca os flocos lateralmente com o ângulo — é o que os faz parecer
         SUSPENSOS sob um filme, e não impressos. Metros: a faixa é minúscula. */
      { kind: 'range', key: 'coatThickness', label: 'Espessura do verniz', min: 0, max: 0.05, step: 0.001 },
    ],
  },
];

const isColorKey = (f: Field): f is ColorField => f.kind === 'color';

/* Guardados como REFERÊNCIA e não procurados por id: os dois nascem aqui, em
   tempo de execução, e `$` é por contrato para os ids que vêm em STUDIO_HTML
   (ver core/dom.ts). Guardar o nó que acabamos de criar também dispensa a
   pergunta "e se o template mudar?" — não há template envolvido. */
let panel: HTMLElement | null = null;
let subEl: HTMLElement | null = null;
let applyBtn: HTMLButtonElement | null = null;
let colorId: string | null = null;
/** O que estava valendo quando o painel abriu — o destino do "Descartar". */
let baseline: PaintParams | null = null;
const inputs = new Map<Key, HTMLInputElement>();
const rows = new Map<Key, HTMLElement>();
/* A SEÇÃO, para poder sumir inteira. Esconder as linhas uma a uma deixava o
   título órfão: num acabamento liso, "Floco" e "Viagem de cor" viravam dois
   cabeçalhos sem nada embaixo — o mesmo ruído que a regra de esconder campo
   existe para evitar, só que com outra cara. */
const groupEls = new Map<string, HTMLElement>();

const isOpen = () => !!panel && !panel.classList.contains('hidden');

/* ---------------- construção ---------------- */

function buildRow(f: Field): HTMLElement {
  const row = el('div', 'ts-pp-row');
  const head = el('label', 'ts-pp-head');
  head.appendChild(el('span', 'ts-pp-label', f.label));
  const val = el('span', 'ts-pp-val');
  head.appendChild(val);
  row.appendChild(head);

  const input = document.createElement('input');
  if (isColorKey(f)) {
    input.type = 'color';
    input.className = 'ts-pp-color';
  } else {
    input.type = 'range';
    input.className = 'ts-pp-range';
    input.min = String(f.min);
    input.max = String(f.max);
    input.step = String(f.step);
  }
  /* `input` e não `change`: o ajuste tem de acontecer DURANTE o arrasto. Um
     slider de tinta que só aplica ao soltar obriga a arrastar às cegas. */
  input.addEventListener('input', () => {
    const v: number | string = isColorKey(f) ? input.value : Number(input.value);
    paint({ [f.key]: v } as Partial<PaintParams>);
    if (!isColorKey(f)) val.textContent = fmt(Number(input.value), f);
  });
  row.appendChild(input);

  inputs.set(f.key, input);
  rows.set(f.key, row);
  return row;
}

/** Passo com uma casa decimal a mais que o próprio passo, para o número lido não
 *  pular de 0,3 para 0,3 enquanto o slider anda. */
function fmt(v: number, f: RangeField) {
  const dec = f.step >= 1 ? 0 : f.step >= 0.01 ? 2 : 3;
  return v.toFixed(dec).replace('.', ',');
}

function build() {
  panel = el('aside', 'ts-pp hidden');
  panel.id = 'paint-panel';

  const head = el('header', 'ts-pp-top');
  head.appendChild(el('h2', 'ts-pp-title', 'Ajuste da tinta'));
  subEl = el('p', 'ts-pp-sub');
  head.appendChild(subEl);
  const close = el('button', 'ts-pp-x', '✕');
  close.setAttribute('type', 'button');
  close.setAttribute('title', 'Fechar (Esc)');
  close.addEventListener('click', () => closePaintPanel());
  head.appendChild(close);
  panel.appendChild(head);

  const body = el('div', 'ts-pp-body');
  for (const g of GROUPS) {
    const sec = el('section', 'ts-pp-group');
    sec.appendChild(el('h3', 'ts-pp-gtitle', g.title));
    for (const f of g.fields) sec.appendChild(buildRow(f));
    groupEls.set(g.title, sec);
    body.appendChild(sec);
  }
  panel.appendChild(body);

  const foot = el('footer', 'ts-pp-foot');
  const reset = el('button', 'ts-pp-btn ghost', 'Padrão do acabamento');
  reset.setAttribute('type', 'button');
  reset.setAttribute('title', 'Volta aos valores de fábrica desta família de tinta');
  reset.addEventListener('click', () => {
    paint(PAINT_DEFAULTS_BY_FINISH[getPaintParams().finish]);
    sync();
    setStatus('Ajuste devolvido ao padrão do acabamento');
  });
  foot.appendChild(reset);

  const discard = el('button', 'ts-pp-btn ghost', 'Descartar');
  discard.setAttribute('type', 'button');
  discard.setAttribute('title', 'Volta ao que está gravado nesta cor');
  discard.addEventListener('click', () => {
    if (baseline) paint(baseline);
    sync();
    setStatus('Ajuste descartado');
  });
  foot.appendChild(discard);

  const apply = el('button', 'ts-pp-btn primary', 'Aplicar a esta cor');
  apply.setAttribute('type', 'button');
  apply.addEventListener('click', () => { void persist(apply); });
  applyBtn = apply;
  foot.appendChild(apply);
  panel.appendChild(foot);

  root.appendChild(panel);
}

/* ---------------- sincronizar com o motor ---------------- */

/**
 * Reapresenta TODOS os campos a partir da receita viva.
 *
 * Chamado ao abrir, ao trocar de cor e depois de qualquer botão que escreva no
 * motor sem passar pelos inputs. Não é chamado no `input` de um slider: aquele
 * já sabe o próprio valor, e reescrevê-lo no meio do arrasto brigaria com o
 * ponteiro.
 */
function sync() {
  const p = getPaintParams();
  for (const g of GROUPS) {
    let anyVisible = false;
    for (const f of g.fields) {
      const input = inputs.get(f.key);
      const row = rows.get(f.key);
      if (!input || !row) continue;

      /* Um campo que não pertence ao acabamento não fica desabilitado: some. Um
         slider de mica cinzento num acabamento sólido é ruído — e pior, sugere
         que existe algo ali para destravar. */
      const applies = !f.only || f.only.includes(p.finish);
      row.classList.toggle('hidden', !applies);
      if (!applies) continue;
      anyVisible = true;

      const v = p[f.key];
      if (isColorKey(f)) {
        input.value = typeof v === 'string' ? v : '#ffffff';
      } else {
        input.value = String(v);
        const val = row.querySelector('.ts-pp-val');
        if (val) val.textContent = fmt(Number(v), f);
      }
    }
    /* Nenhum campo deste grupo pertence ao acabamento: o título vai junto. */
    groupEls.get(g.title)?.classList.toggle('hidden', !anyVisible);
  }

  const c = colorId ? getColor(colorId) : undefined;
  if (subEl) {
    subEl.textContent = c
      ? `${c.name} · ${FINISH_LABEL[p.finish]}`
      : FINISH_LABEL[p.finish];
  }

  /* Sem tinta identificada (a lista embutida, com a API fora do ar) não há linha
     para gravar. O botão some em vez de falhar depois do clique. */
  if (applyBtn) applyBtn.classList.toggle('hidden', !colorId || !canPersistColors());
}

/* ---------------- gravar ---------------- */

/** A receita que vai para o banco: `PaintParams` inteiro, incluindo `color` e
 *  `finish`. Os dois vão junto de propósito — a receita descreve como a tinta se
 *  COMPORTA sob luz, e `paintEffectFrom()` os lê de volta como a face e o
 *  acabamento medidos, que sobrepõem o catálogo na renderização. */
const recipeNow = (): Record<string, unknown> => ({ ...getPaintParams() });

async function persist(btn: HTMLButtonElement) {
  if (!colorId) return;
  const c = getColor(colorId);
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = 'Gravando…';
  try {
    const recipe = recipeNow();
    await saveColorRecipe(colorId, recipe);
    /* A nova referência para o "Descartar": o que está gravado agora É isto. */
    baseline = getPaintParams();
    setStatus(`Ajuste gravado em ${c ? c.name : 'esta cor'}`);
  } catch (e) {
    setStatus('Não deu para gravar: ' + errText(e));
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

/* ---------------- superfície pública ---------------- */

export function openPaintPanel() {
  if (!panel) return;
  baseline = getPaintParams();
  panel.classList.remove('hidden');
  sync();
}

export function closePaintPanel() {
  if (panel) panel.classList.add('hidden');
}

/**
 * A cor que está no veículo mudou.
 *
 * O painel aberto se reapresenta na cor nova em vez de continuar editando a
 * anterior, e o "Descartar" passa a apontar para a receita DELA — senão
 * descartar depois de trocar de cor devolveria o ajuste da cor errada.
 */
export function setPaintPanelColor(id: string | null) {
  colorId = id;
  baseline = getPaintParams();
  if (isOpen()) sync();
}

export function initPaintPanel() {
  build();
  $('btn-paint').addEventListener('click', () => {
    if (isOpen()) closePaintPanel();
    else openPaintPanel();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) closePaintPanel();
  });
}
